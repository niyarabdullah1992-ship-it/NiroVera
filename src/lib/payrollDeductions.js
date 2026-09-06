// Evidence-bound payroll deductions.
// A deduction is never a free number: it is the sum of documented lines, each with a
// mandatory source (attendance / advance / manual), and manual lines require a written
// reason plus an AuditLog entry. item.deductions stays the computed mirror of the lines.
import { updateCompany } from "@/lib/store";
import { logAudit } from "@/lib/auditLog";
import { checkArticle90Gate, checkArticle92LoanGate } from "@/lib/payrollDerivations";

const uid = () => `ded_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export const DEDUCTION_SOURCES = ["attendance", "advance", "manual"];

export const sourceLabel = (source, ar) =>
  ({
    attendance: ar ? "غياب معتمد" : "Approved absence",
    advance: ar ? "سلفة موثّقة" : "Documented advance",
    manual: ar ? "خصم يدوي مبرَّر" : "Justified manual",
  }[source] || source);

export const deductionLines = (item) => (item?.deductionLines || []);

export const deductionsTotal = (item) =>
  deductionLines(item).reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

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
  const amount = Number(line?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "INVALID_AMOUNT";
  if (!DEDUCTION_SOURCES.includes(line?.source)) return "SOURCE_REQUIRED";
  const reason = String(line?.reason || "").trim();
  if (line.source === "manual" && reason.length < 5) return "REASON_REQUIRED";
  if (line.source !== "manual" && !String(line?.sourceRefId || "").trim()) return "REFERENCE_REQUIRED";

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
  mutateItem(companyId, month, item.id, (target) => {
    const line = target.deductionLines.find((entry) => entry.id === lineId);
    if (!line) return;
    line.disputeStatus = status; // "accepted" | "rejected"
    line.resolvedAt = new Date().toISOString();
    if (status === "accepted") line.amount = 0;
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