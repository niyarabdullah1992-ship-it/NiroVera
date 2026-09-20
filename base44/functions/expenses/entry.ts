import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { approvalStepsForAmount, checkApproveClaimGate, checkSubmitClaimGate, claimNeedsCfo, toBudgetStatus } from '../../shared/expenseDerivations.ts';

const managerRoles = ["director", "ops_manager", "pgm", "station_manager"];
const seniorRoles = ["owner", "director", "ops_manager"];
const expenseTypes = ["travel", "accommodation", "fuel", "overtime_meals", "tools_equipment", "training", "other"];

// Mirrors src/lib/expenseRights.js — the local fallback stands in for this function
// and must never be more permissive. A refusal has to name itself in Arabic, and a
// station manager does not review the claim they raised.
const DENY = {
  MANAGER: { error: "EXPENSE_MANAGER_REVIEW_DENIED", reason: "مراجعة المطالبة لمدير الفرع أو الإدارة — لا يملك حسابك هذه الصلاحية.", reasonEn: "Reviewing a claim belongs to the station manager or management — your account does not hold that right." },
  FINANCE: { error: "EXPENSE_FINANCE_REVIEW_DENIED", reason: "اعتماد المالية لمن يملك صلاحية المالية.", reasonEn: "Finance approval is for finance rights holders." },
  CFO: { error: "EXPENSE_CFO_REVIEW_DENIED", reason: "اعتماد المدير المالي لمن يملك صلاحية المالية.", reasonEn: "CFO approval is for finance rights holders." },
  SELF: { error: "EXPENSE_SELF_REVIEW", reason: "لا يعتمد الطلب من رفعه.", reasonEn: "The requester cannot approve their own request." },
};
const deny = (gate, status = 403) => Response.json({ error: gate.error, code: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const platformUser = await base44.auth.me().catch(() => null);
    let auth = null;
    if (platformUser?.role === "admin" && body.companyId) auth = { companyId: body.companyId, userId: body.userId || null, role: "owner", name: platformUser.full_name || "Admin", stationId: null, managedStations: [] };
    if (!auth && body.sessionToken && body.companyId) {
      const sessions = await base44.asServiceRole.entities.CompanySession.filter({ token: body.sessionToken, companyId: body.companyId });
      const session = sessions[0];
      if (session && new Date(session.expiresAt).getTime() > Date.now()) {
        if (session.role === "owner") auth = { companyId: body.companyId, userId: session.userId || null, role: "owner", name: "Owner", stationId: null, managedStations: [] };
        else {
          const employees = await base44.asServiceRole.entities.Employee.filter({ companyId: body.companyId, employeeId: session.userId });
          const employee = employees[0];
          if (employee) auth = { companyId: body.companyId, userId: employee.employeeId, role: employee.role, name: employee.name, stationId: employee.stationId || null, managedStations: employee.managedStations || [] };
        }
      }
    }
    if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const isManager = managerRoles.includes(auth.role) || auth.role === "owner";
    const isFinance = auth.role === "financial_officer" || auth.role === "owner";
    const allStations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId });
    const visibleStationIds = seniorRoles.includes(auth.role) || isFinance ? allStations.map((station) => station.stationId) : auth.role === "pgm" ? auth.managedStations : auth.role === "station_manager" ? [auth.stationId, ...auth.managedStations].filter(Boolean) : [auth.stationId].filter(Boolean);
    const claimStations = (claim) => claim.stationIds?.length ? claim.stationIds : [claim.stationId];

    /**
     * The station vessel. src/lib/localExpensesFallback.js refuses an approval that
     * would overrun it, and this handler booked the money with no such check at all —
     * the local layer was stricter than the server it stands in for.
     *
     * Limits live on the budget blob the `budget` function owns; approved spend is
     * read from the claim ledger here. A station with no configured limit is not
     * refused: no vessel was ever set for it, and inventing one would block every
     * approval in a company that has not filled the board in.
     */
    const vesselRefusal = async (claim) => {
      const blobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category: "stationBudgets" });
      const raw = blobs[0]?.payload;
      let budgets = Array.isArray(raw) ? raw : (Array.isArray(raw?.budgets) ? raw.budgets : []);
      if (!budgets.length) {
        const legacy = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category: "expenseBudget" });
        const legacyRaw = legacy[0]?.payload;
        budgets = Array.isArray(legacyRaw) ? legacyRaw : (Array.isArray(legacyRaw?.budgets) ? legacyRaw.budgets : []);
      }
      const budget = budgets.find((row) => row && row.stationId === claim.stationId && Number(row.limit) > 0);
      if (!budget) return null;
      const ledger = await base44.asServiceRole.entities.ExpenseClaim.filter({ companyId: auth.companyId }, "-created_date", 500);
      const gate = checkApproveClaimGate(
        { ...claim, status: toBudgetStatus(claim.status) },
        budget,
        ledger.map((entry) => ({ ...entry, status: toBudgetStatus(entry.status) })),
      );
      if (gate.ok) return null;
      // The refusal is a reviewable event: the claim stayed where it was because the
      // vessel is spent, so the attempt is written on the claim before it is raised.
      const trail = Array.isArray(claim.vesselBlocks) ? claim.vesselBlocks : [];
      await base44.asServiceRole.entities.ExpenseClaim.update(claim.id, {
        vesselBlocks: [...trail, {
          at: new Date().toISOString(),
          stage: claim.status === "cfo_pending" ? "cfo" : "finance",
          byId: auth.userId || auth.name,
          byName: auth.name,
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          heldStatus: claim.status,
        }].slice(-10),
      });
      await base44.asServiceRole.entities.AuditLog.create({
        companyId: auth.companyId,
        action: "expense.vessel_block",
        performedBy: auth.name,
        details: `${claim.ref || claim.id}: ${gate.reason}`,
        reason: gate.reason,
      });
      return Response.json({ error: gate.error, code: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
    };

    if (body.action === "list") {
      const claims = await base44.asServiceRole.entities.ExpenseClaim.filter({ companyId: auth.companyId }, "-created_date", 500);
      const visible = isFinance || seniorRoles.includes(auth.role) ? claims : isManager ? claims.filter((claim) => claimStations(claim).some((id) => visibleStationIds.includes(id))) : claims.filter((claim) => claim.requesterId === auth.userId);
      const stations = allStations.filter((station) => visibleStationIds.includes(station.stationId));
      return Response.json({ claims: visible, stations, canManagerReview: isManager, canFinanceReview: isFinance, canCfoReview: isFinance, canPickStations: isManager || isFinance });
    }

    if (body.action === "submit") {
      const beforeTaxAmount = Number(body.beforeTaxAmount); const taxAmount = Number(body.taxAmount); const afterTaxAmount = Number(body.afterTaxAmount); const quantity = body.quantity == null || body.quantity === "" ? null : Number(body.quantity); const invoiceNumber = String(body.invoiceNumber || "").trim(); const amount = afterTaxAmount; const canPickStations = isManager || isFinance;
      let stationIds = [auth.stationId].filter(Boolean); let stationScope = "single";
      if (canPickStations && body.stationScope === "all") { stationIds = visibleStationIds; stationScope = "all"; }
      if (canPickStations && body.stationScope === "selected") { stationIds = [...new Set(Array.isArray(body.stationIds) ? body.stationIds : [])].filter((id) => visibleStationIds.includes(id)); stationScope = "selected"; }
      const customExpenseType = String(body.customExpenseType || "").trim();
      const totalsMatch = Math.abs((beforeTaxAmount + taxAmount) - afterTaxAmount) < 0.01;
      if (!stationIds.length || !expenseTypes.includes(body.expenseType) || (body.expenseType === "other" && !customExpenseType) || beforeTaxAmount < 0 || taxAmount < 0 || amount <= 0 || !totalsMatch || (quantity != null && (!Number.isFinite(quantity) || quantity <= 0)) || !body.expenseDate || !body.receiptUrl) return Response.json({ error: "Invalid expense data" }, { status: 400 });
      const surface = checkSubmitClaimGate({ title: customExpenseType || String(body.description || ""), stationId: stationIds[0], amount, receiptUrl: body.receiptUrl });
      if (!surface.ok) return Response.json({ error: surface.reason || surface.error, code: surface.error, reason: surface.reason, reasonEn: surface.reasonEn }, { status: 400 });
      await base44.asServiceRole.entities.ExpenseClaim.create({ companyId: auth.companyId, requesterId: auth.userId || "owner", requesterName: auth.name, stationId: stationIds[0], stationIds, stationScope, expenseType: body.expenseType, customExpenseType, beforeTaxAmount, taxAmount, afterTaxAmount, quantity, invoiceNumber, amount, totalAmount: amount * stationIds.length, currency: "SAR", expenseDate: body.expenseDate, description: String(body.description || ""), receiptUrl: String(body.receiptUrl), status: "submitted", managerReviewedBy: null, managerReviewedAt: null, financeReviewedBy: null, financeReviewedAt: null });
      return Response.json({ ok: true });
    }

    if (body.action === "managerReview") {
      if (!isManager) return deny(DENY.MANAGER);
      const claims = await base44.asServiceRole.entities.ExpenseClaim.filter({ id: body.claimId, companyId: auth.companyId }); const claim = claims[0];
      const inScope = seniorRoles.includes(auth.role) || claimStations(claim || {}).some((id) => visibleStationIds.includes(id));
      if (!claim || claim.status !== "submitted" || !inScope || !["manager_approved", "manager_rejected"].includes(body.decision)) return Response.json({ error: "Expense cannot be reviewed" }, { status: 400 });
      if (!seniorRoles.includes(auth.role) && String(claim.requesterId || "") === String(auth.userId || "")) return deny(DENY.SELF);
      const reviewedAt = new Date().toISOString();
      let nextStatus = body.decision;
      if (body.decision === "manager_approved") {
        const steps = approvalStepsForAmount(claim.afterTaxAmount ?? claim.amount);
        nextStatus = steps.includes("fin") ? "manager_approved" : "finance_approved";
      }
      await base44.asServiceRole.entities.ExpenseClaim.update(claim.id, { status: nextStatus, managerReviewedBy: auth.userId || auth.name, managerReviewedAt: reviewedAt, ...(nextStatus === "finance_approved" ? { approvedAt: reviewedAt } : {}) });
      return Response.json({ ok: true });
    }

    if (body.action === "financeReview") {
      if (!isFinance) return deny(DENY.FINANCE);
      const claims = await base44.asServiceRole.entities.ExpenseClaim.filter({ id: body.claimId, companyId: auth.companyId }); const claim = claims[0];
      if (!claim || claim.status !== "manager_approved" || !["finance_approved", "finance_rejected"].includes(body.decision)) return Response.json({ error: "Expense is not ready for finance review" }, { status: 400 });
      if (body.decision === "finance_approved") {
        const refused = await vesselRefusal(claim);
        if (refused) return refused;
      }
      const reviewedAt = new Date().toISOString();
      let nextStatus = body.decision;
      if (body.decision === "finance_approved" && claimNeedsCfo(claim.afterTaxAmount ?? claim.amount)) nextStatus = "cfo_pending";
      await base44.asServiceRole.entities.ExpenseClaim.update(claim.id, { status: nextStatus, financeReviewedBy: auth.userId || auth.name, financeReviewedAt: reviewedAt, ...(nextStatus === "finance_approved" ? { approvedAt: reviewedAt } : {}) });
      return Response.json({ ok: true });
    }

    if (body.action === "cfoReview") {
      if (!isFinance) return deny(DENY.CFO);
      const claims = await base44.asServiceRole.entities.ExpenseClaim.filter({ id: body.claimId, companyId: auth.companyId }); const claim = claims[0];
      if (!claim || claim.status !== "cfo_pending" || !["cfo_approved", "cfo_rejected"].includes(body.decision)) return Response.json({ error: "Expense is not ready for CFO review" }, { status: 400 });
      if (body.decision === "cfo_approved") {
        const refused = await vesselRefusal(claim);
        if (refused) return refused;
      }
      const reviewedAt = new Date().toISOString();
      await base44.asServiceRole.entities.ExpenseClaim.update(claim.id, { status: body.decision, cfoReviewedBy: auth.userId || auth.name, cfoReviewedAt: reviewedAt, ...(body.decision === "cfo_approved" ? { approvedAt: reviewedAt } : {}) });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Expenses error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});