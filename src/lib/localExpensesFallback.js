/**
 * Expenses + budget board when the `expenses` / `budget` cloud functions are down.
 */
import { getCompanyData, getSession, updateCompany } from "@/lib/store";
import {
  annotateLegacyStockSurface,
  approvalStepsForAmount,
  checkApproveClaimGate,
  checkMarkPaidGate,
  checkRejectClaimGate,
  checkSubmitClaimGate,
  claimNeedsCfo,
  deriveCompanyBudget,
  deriveExpenseAlert,
  enrichClaim,
  toBudgetStatus,
} from "@/lib/expenseDerivations";
import { notifyMoneyMany, notifyMoneyReviewers, stationManagerIds } from "@/lib/moneyNotifications";
import { EXPENSE_DENY, checkExpenseSelfReview, expenseRights, reachableStationIds, visibleClaims } from "@/lib/expenseRights";
import { moneyActor } from "@/lib/financeRights";
import { readExpenseClaims, readStationBudgets } from "@/lib/facts";

const TYPES = ["travel", "accommodation", "fuel", "overtime_meals", "tools_equipment", "training", "other"];
const DEFAULT_STATION_LIMIT = 50000;

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function actor(companyId) {
  return moneyActor(companyId, getSession(), getCompanyData(companyId));
}

function stationRows(data) {
  return (data?.stations || []).map((station) => ({
    ...station,
    stationId: station.stationId || station.id,
    id: station.id || station.stationId,
  }));
}

function fail(message, extra = {}) {
  const error = new Error(message);
  error.response = { data: { error: message, ...extra } };
  throw error;
}

function toExpenseStatus(status) {
  if (status === "pending") return "submitted";
  if (status === "approved") return "finance_approved";
  if (status === "rejected") return "manager_rejected";
  if (status === "paid") return "finance_approved";
  return status || "submitted";
}

function notifyClaim(companyId, claim, payload) {
  const ids = [claim?.requesterId, ...(stationManagerIds(getCompanyData(companyId), claim?.stationId) || [])];
  notifyMoneyMany(companyId, ids, { ...payload, to: "/app/expenses?tab=claims" });
  notifyMoneyReviewers(companyId, { ...payload, to: "/app/expenses?tab=claims" });
}

function normalizeClaim(raw, stations) {
  const stationId = raw.stationId || raw.stationIds?.[0] || stations[0]?.stationId;
  const stationIds = raw.stationIds?.length ? raw.stationIds : (stationId ? [stationId] : []);
  const amount = Number(raw.afterTaxAmount ?? raw.amount) || 0;
  const status = toExpenseStatus(raw.status);
  return {
    ...raw,
    id: raw.id || uid("exp"),
    requesterId: raw.requesterId || raw.ownerId || "owner",
    requesterName: raw.requesterName || raw.owner || "—",
    stationId: stationIds[0] || stationId,
    stationIds,
    stationScope: raw.stationScope || (stationIds.length > 1 ? "selected" : "single"),
    expenseType: TYPES.includes(raw.expenseType) ? raw.expenseType : (raw.title ? "other" : "tools_equipment"),
    customExpenseType: raw.customExpenseType || (raw.expenseType === "other" || !raw.expenseType ? (raw.title || raw.description || "") : ""),
    beforeTaxAmount: Number(raw.beforeTaxAmount ?? amount) || 0,
    taxAmount: Number(raw.taxAmount) || 0,
    afterTaxAmount: amount,
    amount,
    totalAmount: Number(raw.totalAmount) || amount * Math.max(1, stationIds.length),
    currency: raw.currency || "SAR",
    expenseDate: raw.expenseDate || String(raw.createdAt || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    description: raw.description || raw.title || "",
    receiptUrl: raw.receiptUrl || "",
    status,
    title: raw.title || raw.description || raw.customExpenseType || "مطالبة",
    ref: raw.ref || raw.id,
  };
}

const VESSEL_STAGE = {
  finance: ["اعتماد المالية", "finance approval"],
  cfo: ["اعتماد المدير المالي", "CFO approval"],
  vessel: ["الاعتماد من الوعاء التشغيلي", "approval from the operating vessel"],
};

/** The vessel test, asked the same way at every stage that books money on it. */
function vesselGateFor(data, claim) {
  const budget = data.stationBudgets.find((row) => row.stationId === claim.stationId) || null;
  const projected = { ...claim, status: toBudgetStatus(claim.status) };
  return checkApproveClaimGate(projected, budget, data.expenseClaims.map((entry) => ({
    ...entry,
    status: toBudgetStatus(entry.status),
  })));
}

/**
 * A vessel refusal is a reviewable event, not a toast. The claim really did reach the
 * reviewer and it stayed where it was because the branch's vessel is exhausted, so the
 * attempt is written on the claim and announced before the refusal is raised.
 *
 * It has to happen outside `updateCompany`: that call rolls back on a throw, so a
 * refusal raised inside it took the record of itself down with the transaction.
 */
function refuseOnVessel(companyId, auth, claimId, stage, gate) {
  let blocked = null;
  updateCompany(companyId, (data) => {
    ensureLedger(data);
    const claim = data.expenseClaims.find((entry) => entry.id === claimId);
    if (!claim) return;
    const trail = Array.isArray(claim.vesselBlocks) ? claim.vesselBlocks : [];
    claim.vesselBlocks = [...trail, {
      at: new Date().toISOString(),
      stage,
      byId: auth.userId,
      byName: auth.name,
      error: gate.error,
      reason: gate.reason,
      reasonEn: gate.reasonEn,
      heldStatus: claim.status,
    }].slice(-10);
    blocked = { ...claim };
  });
  if (blocked) {
    const [stageAr, stageEn] = VESSEL_STAGE[stage] || VESSEL_STAGE.vessel;
    notifyClaim(companyId, blocked, {
      ar: `تعذّر قيد «${blocked.title}» على وعاء الفرع عند ${stageAr} — ${gate.reason} المطالبة باقية بانتظار القرار.`,
      en: `«${blocked.title}» could not be booked on the station vessel at ${stageEn} — ${gate.reasonEn} The claim stays awaiting a decision.`,
      key: `exp-vessel-block-${blocked.id}-${stage}-${blocked.vesselBlocks.length}`,
    });
  }
  fail(gate.reason || gate.error, { reason: gate.reason, reasonEn: gate.reasonEn, error: gate.error });
}

function ensureLedger(data) {
  const stations = stationRows(data);
  const merged = [
    ...readExpenseClaims(data),
    ...(Array.isArray(data.expenses) ? data.expenses : []),
  ];
  const byId = new Map();
  merged.forEach((raw) => {
    const claim = normalizeClaim(raw, stations);
    if (!byId.has(claim.id)) byId.set(claim.id, claim);
  });
  data.expenseClaims = [...byId.values()].map(annotateLegacyStockSurface);
  if (!readStationBudgets(data).length) {
    data.stationBudgets = stations.map((station) => ({
      stationId: station.stationId,
      stationName: station.name,
      limit: DEFAULT_STATION_LIMIT,
      currency: "SAR",
    }));
  } else {
    data.stationBudgets = readStationBudgets(data);
  }
  return data;
}

const rights = expenseRights;

export function localExpensesCall(session, action, payload = {}) {
  const companyId = session?.companyId;
  if (!companyId) fail("Missing companyId");
  const auth = actor(companyId);
  const cap = rights(auth);

  if (action === "list") {
    const current = getCompanyData(companyId);
    const needsMigrate = !Array.isArray(current?.stationBudgets) || !current.stationBudgets.length
      || (!(current?.expenseClaims || []).length && Array.isArray(current?.expenses) && current.expenses.length);
    if (needsMigrate) updateCompany(companyId, (data) => { ensureLedger(data); });
    const data = getCompanyData(companyId) || { stations: [] };
    ensureLedger(data);
    const stations = stationRows(data);
    const reachable = reachableStationIds(auth, cap, stations);
    return {
      claims: visibleClaims(data.expenseClaims, auth, cap, reachable),
      stations: stations.filter((station) => reachable.includes(station.stationId)),
      canManagerReview: cap.manager,
      canFinanceReview: cap.finance,
      canCfoReview: cap.cfo,
      canPickStations: cap.canPickStations,
    };
  }

  if (action === "submit") {
    const beforeTaxAmount = Number(payload.beforeTaxAmount);
    const taxAmount = Number(payload.taxAmount);
    const afterTaxAmount = Number(payload.afterTaxAmount);
    const quantity = payload.quantity == null || payload.quantity === "" ? null : Number(payload.quantity);
    const customExpenseType = String(payload.customExpenseType || "").trim();
    const totalsMatch = Math.abs((beforeTaxAmount + taxAmount) - afterTaxAmount) < 0.01;
    if (!TYPES.includes(payload.expenseType) || (payload.expenseType === "other" && !customExpenseType)) {
      fail("Invalid expense data", { error: "TYPE_REQUIRED", reason: "نوع المصروف غير صالح.", reasonEn: "Expense type is invalid." });
    }
    if (!totalsMatch) {
      fail("مجموع الضريبة لا يطابق الفاتورة.", { error: "TOTALS_MISMATCH", reason: "مجموع الضريبة لا يطابق الفاتورة.", reasonEn: "Tax plus before-tax must equal after-tax." });
    }
    if (afterTaxAmount <= 0) {
      fail("المبلغ يجب أن يكون أكبر من صفر.", { error: "AMOUNT_REQUIRED", reason: "المبلغ يجب أن يكون أكبر من صفر.", reasonEn: "Amount must be greater than zero." });
    }
    if (!payload.expenseDate || !payload.receiptUrl) {
      fail("Invalid expense data", { error: "RECEIPT_REQUIRED", reason: "الإيصال وتاريخ الفاتورة مطلوبان.", reasonEn: "Receipt and invoice date are required." });
    }
    const current = getCompanyData(companyId) || { stations: [] };
    const visible = stationRows(current).map((station) => station.stationId);
    let stationIds = [payload.stationId || auth.stationId].filter((id) => id && visible.includes(id));
    if (!stationIds.length) stationIds = [payload.stationId || auth.stationId].filter(Boolean);
    let stationScope = "single";
    if (cap.canPickStations && payload.stationScope === "all") {
      stationIds = visible;
      stationScope = "all";
    }
    if (cap.canPickStations && payload.stationScope === "selected") {
      stationIds = [...new Set(Array.isArray(payload.stationIds) ? payload.stationIds : [])].filter((id) => visible.includes(id));
      stationScope = "selected";
    }
    if (!stationIds.length) fail("Invalid expense data");
    const title = customExpenseType || String(payload.description || "").trim();
    const gate = checkSubmitClaimGate({
      title,
      stationId: stationIds[0],
      amount: afterTaxAmount,
      receiptUrl: payload.receiptUrl,
    });
    if (!gate.ok) fail(gate.reason || gate.error, { reason: gate.reason, reasonEn: gate.reasonEn, error: gate.error });
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      data.expenseClaims.unshift({
        id: uid("exp"),
        ref: `EXP-${String(data.expenseClaims.length + 2200).padStart(4, "0")}`,
        requesterId: auth.userId,
        requesterName: auth.name,
        owner: auth.name,
        stationId: stationIds[0],
        stationIds,
        stationScope,
        expenseType: payload.expenseType,
        customExpenseType,
        title: gate.title,
        beforeTaxAmount,
        taxAmount,
        afterTaxAmount,
        quantity,
        invoiceNumber: String(payload.invoiceNumber || "").trim(),
        amount: afterTaxAmount,
        totalAmount: afterTaxAmount * stationIds.length,
        currency: "SAR",
        expenseDate: payload.expenseDate,
        description: String(payload.description || ""),
        receiptUrl: String(payload.receiptUrl),
        status: "submitted",
        submittedAt: new Date().toISOString(),
        created_date: new Date().toISOString(),
      });
    });
    notifyClaim(companyId, { requesterId: auth.userId, stationId: stationIds[0] }, {
      ar: `مطالبة مصروف جديدة بانتظار المدير — ${title}.`,
      en: `New operating claim waiting on the station manager — ${title}.`,
      key: `exp-submit-${title}-${stationIds[0]}-${afterTaxAmount}`,
    });
    return { ok: true };
  }

  if (action === "managerReview") {
    if (!cap.manager) fail(EXPENSE_DENY.MANAGER_DENIED.reason, EXPENSE_DENY.MANAGER_DENIED);
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const claim = data.expenseClaims.find((entry) => entry.id === payload.claimId);
      if (!claim || claim.status !== "submitted" || !["manager_approved", "manager_rejected"].includes(payload.decision)) {
        fail("Expense cannot be reviewed");
      }
      const eyes = checkExpenseSelfReview(auth, cap, claim);
      if (!eyes.ok) fail(eyes.reason, eyes);
      claim.managerReviewedBy = auth.userId;
      claim.managerReviewedAt = new Date().toISOString();
      if (payload.decision === "manager_approved") {
        const steps = approvalStepsForAmount(claim.afterTaxAmount ?? claim.amount);
        claim.status = steps.includes("fin") ? "manager_approved" : "finance_approved";
        if (claim.status === "finance_approved") claim.approvedAt = claim.managerReviewedAt;
      } else {
        claim.status = payload.decision;
        claim.rejectReason = String(payload.reason || "").trim() || "rejected";
      }
    });
    const afterMgr = getCompanyData(companyId)?.expenseClaims?.find((entry) => entry.id === payload.claimId);
    if (afterMgr) {
      const approved = payload.decision === "manager_approved";
      notifyClaim(companyId, afterMgr, {
        ar: approved
          ? (afterMgr.status === "finance_approved"
            ? `اعتُمدت مطالبة «${afterMgr.title}» من المدير — المبلغ ≤500 ولا يحتاج مالية.`
            : `مدير الفرع اعتمد «${afterMgr.title}» — بانتظار المالية.`)
          : `رُفضت مطالبة «${afterMgr.title}» من المدير.`,
        en: approved
          ? (afterMgr.status === "finance_approved"
            ? `Manager finalized «${afterMgr.title}» — amount ≤500, no finance step.`
            : `Station manager approved «${afterMgr.title}» — waiting on finance.`)
          : `Manager rejected «${afterMgr.title}».`,
        key: `exp-mgr-${afterMgr.id}-${afterMgr.status}`,
      });
    }
    return { ok: true };
  }

  if (action === "financeReview") {
    if (!cap.finance) fail(EXPENSE_DENY.FINANCE_DENIED.reason, EXPENSE_DENY.FINANCE_DENIED);
    if (payload.decision === "finance_approved") {
      const current = getCompanyData(companyId) || { stations: [] };
      ensureLedger(current);
      const pending = current.expenseClaims.find((entry) => entry.id === payload.claimId);
      if (pending && pending.status === "manager_approved") {
        const gate = vesselGateFor(current, pending);
        if (!gate.ok) refuseOnVessel(companyId, auth, pending.id, "finance", gate);
      }
    }
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const claim = data.expenseClaims.find((entry) => entry.id === payload.claimId);
      if (!claim || claim.status !== "manager_approved" || !["finance_approved", "finance_rejected"].includes(payload.decision)) {
        fail("Expense is not ready for finance review");
      }
      if (payload.decision === "finance_approved") {
        const budget = data.stationBudgets.find((row) => row.stationId === claim.stationId) || null;
        const projected = { ...claim, status: toBudgetStatus(claim.status) };
        const gate = checkApproveClaimGate(projected, budget, data.expenseClaims.map((entry) => ({
          ...entry,
          status: toBudgetStatus(entry.status),
        })));
        if (!gate.ok) fail(gate.reason || gate.error, { reason: gate.reason, reasonEn: gate.reasonEn, error: gate.error });
        const next = claimNeedsCfo(claim.afterTaxAmount ?? claim.amount) ? "cfo_pending" : "finance_approved";
        claim.status = next;
        if (next === "finance_approved") claim.approvedAt = new Date().toISOString();
      } else {
        claim.status = payload.decision;
        claim.rejectReason = String(payload.reason || "").trim() || "rejected";
      }
      claim.financeReviewedBy = auth.userId;
      claim.financeReviewedAt = new Date().toISOString();
    });
    const afterFin = getCompanyData(companyId)?.expenseClaims?.find((entry) => entry.id === payload.claimId);
    if (afterFin) {
      notifyClaim(companyId, afterFin, {
        ar: afterFin.status === "cfo_pending"
          ? `المالية وافقت على «${afterFin.title}» — بانتظار المدير المالي (فوق 5,000).`
          : afterFin.status === "finance_approved"
            ? `المالية اعتمدت «${afterFin.title}».`
            : `المالية رفضت «${afterFin.title}».`,
        en: afterFin.status === "cfo_pending"
          ? `Finance signed «${afterFin.title}» — waiting on the CFO (above 5,000).`
          : afterFin.status === "finance_approved"
            ? `Finance approved «${afterFin.title}».`
            : `Finance rejected «${afterFin.title}».`,
        key: `exp-fin-${afterFin.id}-${afterFin.status}`,
      });
    }
    return { ok: true };
  }

  if (action === "cfoReview") {
    if (!cap.cfo) fail(EXPENSE_DENY.CFO_DENIED.reason, EXPENSE_DENY.CFO_DENIED);
    if (payload.decision === "cfo_approved") {
      const current = getCompanyData(companyId) || { stations: [] };
      ensureLedger(current);
      const pending = current.expenseClaims.find((entry) => entry.id === payload.claimId);
      if (pending && pending.status === "cfo_pending") {
        const gate = vesselGateFor(current, pending);
        if (!gate.ok) refuseOnVessel(companyId, auth, pending.id, "cfo", gate);
      }
    }
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const claim = data.expenseClaims.find((entry) => entry.id === payload.claimId);
      if (!claim || claim.status !== "cfo_pending" || !["cfo_approved", "cfo_rejected"].includes(payload.decision)) {
        fail("Expense is not ready for CFO review");
      }
      if (payload.decision === "cfo_approved") {
        const budget = data.stationBudgets.find((row) => row.stationId === claim.stationId) || null;
        const projected = { ...claim, status: toBudgetStatus(claim.status) };
        const gate = checkApproveClaimGate(projected, budget, data.expenseClaims.map((entry) => ({
          ...entry,
          status: toBudgetStatus(entry.status),
        })));
        if (!gate.ok) fail(gate.reason || gate.error, { reason: gate.reason, reasonEn: gate.reasonEn, error: gate.error });
        claim.status = "cfo_approved";
        claim.approvedAt = new Date().toISOString();
      } else {
        claim.status = "cfo_rejected";
        claim.rejectReason = String(payload.reason || "").trim() || "rejected";
      }
      claim.cfoReviewedBy = auth.userId;
      claim.cfoReviewedAt = new Date().toISOString();
    });
    const afterCfo = getCompanyData(companyId)?.expenseClaims?.find((entry) => entry.id === payload.claimId);
    if (afterCfo) {
      notifyClaim(companyId, afterCfo, {
        ar: afterCfo.status === "cfo_approved"
          ? `المدير المالي اعتمد «${afterCfo.title}» وقُيّدت على وعاء الفرع.`
          : `المدير المالي رفض «${afterCfo.title}».`,
        en: afterCfo.status === "cfo_approved"
          ? `CFO approved «${afterCfo.title}» and booked it on the station vessel.`
          : `CFO rejected «${afterCfo.title}».`,
        key: `exp-cfo-${afterCfo.id}-${afterCfo.status}`,
      });
    }
    return { ok: true };
  }

  fail("Unknown action");
  return { ok: false };
}

function budgetView(companyId) {
  const data = getCompanyData(companyId) || { stations: [] };
  ensureLedger(data);
  const claims = data.expenseClaims.map((claim) => enrichClaim({
    ...claim,
    status: claim.paidAt ? "paid" : toBudgetStatus(claim.status),
    owner: claim.owner || claim.requesterName,
    hasReceipt: !!claim.receiptUrl,
  }));
  const company = deriveCompanyBudget(data.stationBudgets, claims);
  return {
    ok: true,
    budgets: company.rows,
    claims,
    company,
    alert: deriveExpenseAlert(claims),
  };
}

export function localBudgetCall(companyId, payload = {}) {
  const action = String(payload.action || "list");
  const auth = actor(companyId);
  const cap = rights(auth);
  if (["approve", "reject", "markPaid"].includes(action) && !cap.finance) {
    fail(EXPENSE_DENY.FINANCE_ONLY.reason, EXPENSE_DENY.FINANCE_ONLY);
  }

  if (action === "list" || action === "seedDemo") {
    const current = getCompanyData(companyId);
    if (!Array.isArray(current?.stationBudgets) || !current.stationBudgets.length) {
      updateCompany(companyId, (data) => { ensureLedger(data); });
    }
    return budgetView(companyId);
  }

  if (action === "submitClaim") {
    const gate = checkSubmitClaimGate(payload);
    if (!gate.ok) fail(gate.reason || gate.error, { reason: gate.reason, reasonEn: gate.reasonEn, error: gate.error });
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      data.expenseClaims.unshift({
        id: uid("exp"),
        ref: String(payload.ref || `EXP-${String(data.expenseClaims.length + 2200).padStart(4, "0")}`),
        title: gate.title,
        owner: String(payload.owner || auth.name),
        requesterName: String(payload.owner || auth.name),
        requesterId: auth.userId,
        stationId: gate.stationId,
        stationIds: [gate.stationId],
        amount: gate.amount,
        afterTaxAmount: gate.amount,
        beforeTaxAmount: gate.amount,
        taxAmount: 0,
        currency: "SAR",
        receiptUrl: String(payload.receiptUrl).trim(),
        expenseType: "other",
        customExpenseType: gate.title,
        expenseDate: new Date().toISOString().slice(0, 10),
        status: "submitted",
        submittedAt: new Date().toISOString(),
      });
    });
    return budgetView(companyId);
  }

  if (action === "approve") {
    const current = getCompanyData(companyId) || { stations: [] };
    ensureLedger(current);
    const pending = current.expenseClaims.find((entry) => entry.id === payload.claimId);
    if (pending && pending.status !== "submitted") {
      const preGate = vesselGateFor(current, pending);
      if (!preGate.ok && preGate.error === "BUDGET_EXCEEDED") {
        refuseOnVessel(companyId, auth, pending.id, "vessel", preGate);
      }
    }
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const claim = data.expenseClaims.find((entry) => entry.id === payload.claimId);
      if (claim?.status === "submitted") {
        fail(EXPENSE_DENY.MANAGER_FIRST.reason, EXPENSE_DENY.MANAGER_FIRST);
      }
      const budget = data.stationBudgets.find((row) => row.stationId === claim?.stationId) || null;
      const projected = claim ? { ...claim, status: toBudgetStatus(claim.status) } : null;
      const gate = checkApproveClaimGate(projected, budget, data.expenseClaims.map((entry) => ({
        ...entry,
        status: toBudgetStatus(entry.status),
      })));
      if (!gate.ok) fail(gate.reason || gate.error, { reason: gate.reason, reasonEn: gate.reasonEn, error: gate.error });
      claim.status = "finance_approved";
      claim.approvedAt = new Date().toISOString();
    });
    return budgetView(companyId);
  }

  if (action === "reject") {
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const claim = data.expenseClaims.find((entry) => entry.id === payload.claimId);
      const gate = checkRejectClaimGate(claim ? { ...claim, status: toBudgetStatus(claim.status) } : null);
      if (!gate.ok) fail(gate.reason || gate.error, { reason: gate.reason, reasonEn: gate.reasonEn, error: gate.error });
      claim.status = "manager_rejected";
      claim.rejectReason = String(payload.reason || "rejected").trim() || "rejected";
    });
    return budgetView(companyId);
  }

  if (action === "markPaid") {
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const claim = data.expenseClaims.find((entry) => entry.id === payload.claimId);
      const gate = checkMarkPaidGate(claim ? { ...claim, status: toBudgetStatus(claim.status) } : null);
      if (!gate.ok) fail(gate.reason || gate.error, { reason: gate.reason, reasonEn: gate.reasonEn, error: gate.error });
      claim.paidAt = new Date().toISOString();
      claim.status = "finance_approved";
    });
    return budgetView(companyId);
  }

  return budgetView(companyId);
}
