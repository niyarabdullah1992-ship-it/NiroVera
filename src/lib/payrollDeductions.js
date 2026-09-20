// Evidence-bound payroll deductions.
// A deduction is never a free number: it is the sum of documented lines, each with a
// mandatory source (attendance / advance / manual), and manual lines require a written
// reason plus an AuditLog entry. item.deductions stays the computed mirror of the lines.
import { getCompanyData, updateCompany } from "@/lib/store";
import { logAudit } from "@/lib/auditLog";
import { checkArticle90Gate, checkArticle92LoanGate } from "@/lib/payrollDerivations";
import { runLockReason } from "@/lib/payroll";
import { PAYROLL_DENY, canFeedPayroll, canManagePayroll, ownsPayrollItem, payrollFeedInReach } from "@/lib/payrollRights";

const uid = () => `ded_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export const DEDUCTION_SOURCES = ["attendance", "advance", "manual"];
export const GENERATED_DEDUCTION_SOURCES = ["discipline"];

export const sourceLabel = (source, ar) =>
  ({
    attendance: ar ? "غياب معتمد" : "Approved absence",
    advance: ar ? "سلفة موثّقة" : "Documented advance",
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
  const manual = line?.source === "manual";
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
  if (line.source !== "manual" && !String(line?.sourceRefId || "").trim()) return "REFERENCE_REQUIRED";
  const refProblem = referenceProblem(companyId, line.source, line.sourceRefId, item);
  if (refProblem) return refProblem;

  if (line.source === "advance" && !checkArticle92LoanGate(item, amount).ok) return "ARTICLE_92_LOAN";
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
  const derived = line && line.source !== "manual";
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