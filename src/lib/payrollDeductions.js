// Evidence-bound payroll deductions.
// A deduction is never a free number: it is the sum of documented lines, each with a
// mandatory source (attendance / advance / manual), and manual lines require a written
// reason plus an AuditLog entry. item.deductions stays the computed mirror of the lines.
import { getCompanyData, updateCompany } from "@/lib/store";
import { logAudit } from "@/lib/auditLog";
import { checkArticle90Gate, checkArticle92LoanGate, contractWage } from "@/lib/payrollDerivations";
import { checkCourtDebtGate, checkDamageLineGate, COURT_DEBT_KINDS, damageCaseIdFor, damageCaseOfLine, damageRefundsFor } from "@/lib/payrollLaw";
import { runLockReason } from "@/lib/payroll";
import { PAYROLL_DENY, canFeedPayroll, canManagePayroll, ownsPayrollItem, payrollFeedInReach } from "@/lib/payrollRights";

const uid = () => `ded_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

// Art. 92 lists the deductions that need no written consent: employer advances (1), contributions
// (2, GOSI — on the line itself), savings fund (3), the housing scheme (4), sanctions and damage (5)
// and court debts (6). Everything else is "manual" and needs the worker's written consent.
export const DEDUCTION_SOURCES = ["attendance", "advance", "damage", "savings_fund", "housing_scheme", "court_debt", "manual"];
export { COURT_DEBT_KINDS };
export const GENERATED_DEDUCTION_SOURCES = ["discipline"];
// Sources entered by payroll itself (not derived from an approval elsewhere) — they need payroll rights.
const PAYROLL_ENTERED = ["manual", "damage", "savings_fund", "housing_scheme", "court_debt"];

export const sourceLabel = (source, ar) =>
  ({
    attendance: ar ? "غياب معتمد" : "Approved absence",
    advance: ar ? "سلفة موثّقة" : "Documented advance",
    damage: ar ? "تلف أو فقد — المادة 91" : "Damage or loss — Art. 91",
    savings_fund: ar ? "صندوق الادخار — المادة 92/3" : "Savings fund — Art. 92/3",
    housing_scheme: ar ? "مشروع المساكن — المادة 92/4" : "Housing scheme — Art. 92/4",
    court_debt: ar ? "دين بحكم قضائي — المادة 92/6" : "Court-ordered debt — Art. 92/6",
    manual: ar ? "خصم يدوي مبرَّر" : "Justified manual",
    discipline: ar ? "جزاء موقَّع" : "Signed sanction",
  }[source] || source);

export const deductionLines = (item) => (item?.deductionLines || []);

export const deductionsTotal = (item) =>
  deductionLines(item).reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

/**
 * A derived deduction has to point at a real event, not at typed characters. The
 * generators already mint namespaced references (`ATT-…`, `DSC-…`), so the reference is
 * required to carry its source's namespace, and where the record actually lives in the
 * store — a signed sanction — it must exist and belong to this same employee.
 *
 * Attendance and advance references stop at the namespace check: the absence generator
 * mints them from whatever the settling surface passes, so nothing resolvable is stored
 * yet. Making those verifiable is one change at that call site — persist the settlement
 * row and pass its id — not a change here.
 */
const REFERENCE_NAMESPACE = { attendance: "ATT-", advance: "ADV-", discipline: "DSC-" };

function referenceProblem(companyId, source, sourceRefId, item) {
  const namespace = REFERENCE_NAMESPACE[source];
  if (!namespace) return null;
  const ref = String(sourceRefId || "").trim();
  if (!ref.toUpperCase().startsWith(namespace)) return "REFERENCE_SHAPE";
  if (source !== "discipline") return null;
  const cases = getCompanyData(companyId)?.disciplinaryCases || [];
  const row = cases.find((entry) => String(entry.id) === ref.slice(namespace.length));
  if (!row) return "REFERENCE_NOT_FOUND";
  if (String(row.employeeId || "") !== String(item?.employeeId || "")) return "REFERENCE_NOT_YOURS";
  return null;
}

function mutateItem(companyId, month, itemId, mutate) {
  updateCompany(companyId, (d) => {
    const run = (d.payrollRuns || []).find((entry) => entry.month === month);
    const item = run?.items.find((entry) => entry.id === itemId);
    if (!item || item.paid) return;
    item.deductionLines = item.deductionLines || [];
    mutate(item);
    item.deductions = deductionsTotal(item);
  });
}

// Returns an error code instead of silently accepting an undocumented deduction.
export function addDeductionLine(companyId, month, item, line, actor) {
  // A hand-typed line charges a wage on someone's say-so, so it needs payroll rights.
  // A derived line is already justified by an approved record, and is posted by
  // whoever approved that record — usually the station manager, not payroll.
  const manual = PAYROLL_ENTERED.includes(line?.source);
  if (manual ? !canManagePayroll(companyId) : !canFeedPayroll(companyId)) {
    return manual ? PAYROLL_DENY.DEDUCTION.error : PAYROLL_DENY.FEED.error;
  }
  if (!manual && !payrollFeedInReach(companyId, item)) return PAYROLL_DENY.FEED_REACH.error;
  const locked = runLockReason(companyId, month);
  if (locked) return locked;
  const amount = Number(line?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "INVALID_AMOUNT";
  if (![...DEDUCTION_SOURCES, ...GENERATED_DEDUCTION_SOURCES].includes(line?.source)) return "SOURCE_REQUIRED";
  const reason = String(line?.reason || "").trim();
  if (line.source === "manual" && reason.length < 5) return "REASON_REQUIRED";
  // Art. 92: no deduction for a private right without the worker's written consent, outside
  // the listed cases (advance, GOSI, savings fund, housing scheme, sanction, court debt).
  if (line.source === "manual" && line.consent !== true) return "CONSENT_REQUIRED";
  if (line.source !== "manual" && !String(line?.sourceRefId || "").trim()) return "REFERENCE_REQUIRED";
  const refProblem = referenceProblem(companyId, line.source, line.sourceRefId, item);
  if (refProblem) return refProblem;

  if (line.source === "advance" && !checkArticle92LoanGate(item, amount).ok) return "ARTICLE_92_LOAN";
  const sumOf = (src) => deductionLines(item).filter((row) => row.source === src).reduce((s, row) => s + (Number(row.amount) || 0), 0);
  let lawExtras = {};
  if (line.source === "damage") {
    // Art. 91: five days' wage a month, no written consent (Art. 92/5), and the notice day starts
    // the worker's fifteen-working-day objection window.
    const gate = checkDamageLineGate({ amount, monthlyWage: contractWage(item), monthUsed: sumOf("damage"), noticeOn: line.damageNoticeOn });
    if (!gate.ok) return gate.error;
    // The damage case id ties instalments together and lets an objection name exactly what it contests.
    lawExtras = { damageNoticeOn: String(line.damageNoticeOn).slice(0, 10), objectionLastDay: gate.objectionLastDay, damageCaseId: damageCaseIdFor(line) };
  }
  if (line.source === "court_debt") {
    const kind = COURT_DEBT_KINDS.some((row) => row.key === line.courtDebtKind) ? line.courtDebtKind : "other";
    const employee = (getCompanyData(companyId)?.employees || []).find((row) => row.id === item.employeeId);
    const pending = (employee?.profile?.courtDebts || []).map((row) => ({ kind: row.kind, amount: row.outstanding ?? row.amount }));
    const gate = checkCourtDebtGate({ amount, monthlyWage: contractWage(item), monthUsed: sumOf("court_debt"), kind, rulingAllowsMore: line.rulingAllowsMore === true, pending });
    if (!gate.ok) return gate.error;
    lawExtras = { courtDebtKind: kind, ...(line.rulingAllowsMore === true ? { rulingAllowsMore: true } : {}) };
  }
  const projected = deductionsTotal(item) + amount;
  if (!checkArticle90Gate({ ...item, deductions: projected }).ok) return "ARTICLE_93_EXCEEDED";

  const entry = {
    id: uid(),
    payrollItemId: item.id,
    employeeId: item.employeeId,
    amount,
    source: line.source,
    sourceRefId: String(line.sourceRefId || "").trim() || null,
    reason,
    ...(line.source === "manual" ? { consent: true, consentNote: String(line.consentNote || "").trim() } : {}),
    ...lawExtras,
    createdBy: actor?.id || "unknown",
    createdByName: actor?.name || "",
    createdAt: new Date().toISOString(),
    disputeStatus: "none",
  };
  mutateItem(companyId, month, item.id, (target) => { target.deductionLines.push(entry); });

  logAudit(
    companyId,
    "payroll_deduction_added",
    actor?.name || actor?.id || "unknown",
    `${entry.source} deduction ${amount} for employee ${item.employeeId} (${month}) — ${reason || entry.sourceRefId}`
  );
  return null;
}

export function removeDeductionLine(companyId, month, item, lineId, actor) {
  const line = deductionLines(item).find((entry) => entry.id === lineId);
  const derived = line && !PAYROLL_ENTERED.includes(line.source);
  if (derived ? !canFeedPayroll(companyId) : !canManagePayroll(companyId)) {
    return derived ? PAYROLL_DENY.FEED.error : PAYROLL_DENY.DEDUCTION.error;
  }
  if (derived && !payrollFeedInReach(companyId, item)) return PAYROLL_DENY.FEED_REACH.error;
  const locked = runLockReason(companyId, month);
  if (locked) return locked;
  mutateItem(companyId, month, item.id, (target) => {
    target.deductionLines = target.deductionLines.filter((entry) => entry.id !== lineId);
  });
  logAudit(
    companyId,
    "payroll_deduction_removed",
    actor?.name || actor?.id || "unknown",
    `Removed ${line?.source || ""} deduction ${line?.amount || ""} for employee ${item.employeeId} (${month})`
  );
}

export function disputeDeductionLine(companyId, month, item, lineId, note, actor) {
  // Objecting is the charged employee's own right — and only theirs.
  if (!ownsPayrollItem(companyId, item) && !canManagePayroll(companyId)) return PAYROLL_DENY.DISPUTE_OWN.error;
  mutateItem(companyId, month, item.id, (target) => {
    const line = target.deductionLines.find((entry) => entry.id === lineId);
    if (!line) return;
    line.disputeStatus = "open";
    line.disputeNote = String(note || "").slice(0, 500);
    line.disputedAt = new Date().toISOString();
  });
  logAudit(companyId, "payroll_deduction_disputed", actor?.name || actor?.id || "unknown", `Dispute opened on deduction ${lineId} (${month})`);
}

export function resolveDeductionDispute(companyId, month, item, lineId, status, actor) {
  if (!canManagePayroll(companyId)) return PAYROLL_DENY.DISPUTE_RESOLVE.error;
  mutateItem(companyId, month, item.id, (target) => {
    const line = target.deductionLines.find((entry) => entry.id === lineId);
    if (!line) return;
    line.disputeStatus = status; // "accepted" | "rejected"
    line.resolvedAt = new Date().toISOString();
    line.resolvedBy = actor?.name || actor?.id || "unknown";
    // Accepting drops the charge to zero, but the line has to keep saying what was
    // charged and why: a wage deduction that silently becomes "0 — no reason" is a
    // cancelled charge with its own evidence erased.
    if (status === "accepted") {
      if (line.originalAmount == null) line.originalAmount = Number(line.amount) || 0;
      line.amount = 0;
    }
  });
  logAudit(companyId, "payroll_deduction_dispute_resolved", actor?.name || actor?.id || "unknown", `Dispute ${status} on deduction ${lineId} (${month})`);
}

// Backfills legacy rows: a pre-existing free-typed number becomes one explicit
// "legacy" manual line so the total keeps matching while gaining a visible source.
export function backfillLegacyDeduction(companyId, month, item) {
  const legacy = Number(item?.deductions) || 0;
  if (!legacy || deductionLines(item).length) return;
  mutateItem(companyId, month, item.id, (target) => {
    target.deductionLines.push({
      id: uid(),
      payrollItemId: target.id,
      employeeId: target.employeeId,
      amount: legacy,
      source: "manual",
      sourceRefId: null,
      reason: "Legacy deduction recorded before evidence linking",
      createdBy: "system",
      createdByName: "system",
      createdAt: new Date().toISOString(),
      disputeStatus: "none",
      legacy: true,
    });
  });
}

/**
 * Art. 91: an accepted damage objection means the deduction was not owed. On an open line the
 * charge drops to zero (keeping what was charged); a line already paid is refunded on the current
 * month's open line as `damageRefunds`. Idempotent — a refunded line is stamped `refundedAt`.
 */
/** Every damage line of one employee across runs, with where it lives. */
function employeeDamageLines(runs, employeeId) {
  const out = [];
  for (const run of runs || []) {
    const item = (run.items || []).find((row) => row.employeeId === employeeId);
    for (const line of item?.deductionLines || []) if (line?.source === "damage") out.push({ line, item, run });
  }
  return out;
}

/** An objection raised before it carried its case: linked to the case its notice day names, if one exists. */
function linkObjectionCase(objection, lines) {
  if (objection?.type !== "damage_objection" || objection.damageCaseId || objection.deductionLineId) return false;
  const told = String(objection.notifiedOn || "").slice(0, 10);
  if (!told) return false;
  const caseId = `DMG-${told}`;
  if (!lines.some(({ line }) => damageCaseOfLine(line) === caseId)) return false;
  objection.damageCaseId = caseId;
  return true;
}

export function reconcileDamageObjections(companyId, currentMonth) {
  const data = getCompanyData(companyId);
  // Read first: the page calls this on every open, and a write with nothing to do is noise.
  const due = (data?.employees || []).some((employee) => {
    const objections = (employee.otherRequests || []).filter((row) => row?.type === "damage_objection");
    if (!objections.length) return false;
    const lines = employeeDamageLines(data.payrollRuns, employee.id);
    if (!lines.length) return false;
    const linked = objections.map((o) => {
      const copy = { ...o };
      linkObjectionCase(copy, lines);
      return copy;
    });
    return damageRefundsFor(linked, lines.map((row) => row.line)).length > 0;
  });
  if (!due) return 0;
  let changed = 0;
  updateCompany(companyId, (d) => {
    const current = (d.payrollRuns || []).find((run) => run.month === currentMonth);
    for (const employee of d.employees || []) {
      const objections = employee.otherRequests || [];
      if (!objections.some((row) => row?.type === "damage_objection")) continue;
      const lines = employeeDamageLines(d.payrollRuns, employee.id);
      if (!lines.length) continue;
      for (const o of objections) linkObjectionCase(o, lines);
      for (const refund of damageRefundsFor(objections, lines.map((row) => row.line))) {
        const hit = lines.find((row) => row.line.id === refund.lineId);
        if (!hit) continue;
        const { line, item } = hit;
        const at = new Date().toISOString();
        if (!item.paid && item.settledNet == null) {
          if (line.originalAmount == null) line.originalAmount = Number(line.amount) || 0;
          line.amount = Math.round(Math.max(0, line.originalAmount - refund.amount) * 100) / 100;
          line.disputeStatus = "accepted";
          line.refundedAt = at;
          line.refundedAmount = refund.amount;
          line.refundObjectionId = refund.objectionId;
          item.deductions = deductionsTotal(item);
          changed += 1;
          continue;
        }
        const open = (current?.items || []).find((row) => row.employeeId === employee.id && !row.paid && row.settledNet == null);
        if (!open) continue;
        open.damageRefunds = Math.round(((Number(open.damageRefunds) || 0) + refund.amount) * 100) / 100;
        line.refundedAt = at;
        line.refundedAmount = refund.amount;
        line.refundObjectionId = refund.objectionId;
        line.refundedInMonth = currentMonth;
        changed += 1;
      }
    }
  });
  if (changed) logAudit(companyId, "payroll_damage_refund", "system", `Art. 91 accepted objections refunded on ${changed} line(s)`);
  return changed;
}
