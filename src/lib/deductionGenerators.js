// Generates documented payroll deduction lines from approved records — instead of
// re-typing amounts manually in payroll.
// Idempotent: the same sourceRefId never produces a line twice.
import { addDeductionLine, deductionLines, removeDeductionLine } from "@/lib/payrollDeductions";
import { getRun, ensurePayrollRun, monthKey } from "@/lib/payroll";
import { getCompanyData } from "@/lib/store";

export function generateAbsenceDeduction(companyId, employeeId, attendanceRecordId, days, actor) {
  const month = monthKey();
  ensurePayrollRun(companyId, month);
  const data = getCompanyData(companyId);
  const run = getRun(data, month);
  const item = run?.items.find((i) => i.employeeId === employeeId);
  if (!item || item.paid) return "NO_OPEN_ITEM";
  const refId = `ATT-${attendanceRecordId}`;
  if (deductionLines(item).some((l) => l.sourceRefId === refId)) return "ALREADY_GENERATED";
  const daily = (Number(item.base) || 0) / 30;
  return addDeductionLine(companyId, month, item, {
    amount: Math.round(daily * days * 100) / 100,
    source: "attendance",
    sourceRefId: refId,
    reason: `غياب معتمد ${days} يوم · Approved unpaid absence (${days} day${days === 1 ? "" : "s"})`,
  }, actor);
}

export function disciplineDeductionRef(caseId) {
  return `DSC-${String(caseId || "").trim()}`;
}

export function generateDisciplineDeduction(companyId, employeeId, caseRow, actor) {
  const days = Number(caseRow?.cutDays || caseRow?.fineDays || 0);
  if (days <= 0) return "NO_CUT";
  const when = caseRow?.signedAt || caseRow?.decidedAt || new Date().toISOString();
  const month = monthKey(new Date(when));
  ensurePayrollRun(companyId, month);
  const data = getCompanyData(companyId);
  const run = getRun(data, month);
  const item = run?.items.find((row) => row.employeeId === employeeId);
  if (!item || item.paid) return "NO_OPEN_ITEM";
  const refId = disciplineDeductionRef(caseRow?.id);
  if (!refId || refId === "DSC-") return "REFERENCE_REQUIRED";
  if (deductionLines(item).some((line) => line.sourceRefId === refId)) return "ALREADY_GENERATED";
  const daily = (Number(item.base) || 0) / 30;
  return addDeductionLine(companyId, month, item, {
    amount: Math.round(daily * days * 100) / 100,
    source: "discipline",
    sourceRefId: refId,
    reason: `جزاء موقَّع ${days} يوم · ${caseRow?.note || caseRow?.reason || caseRow?.penalty || ""}`.trim(),
  }, actor);
}

export function liftDisciplineDeduction(companyId, employeeId, caseRow, actor) {
  const refId = disciplineDeductionRef(caseRow?.id);
  const when = caseRow?.signedAt || caseRow?.decidedAt || new Date().toISOString();
  const month = monthKey(new Date(when));
  const data = getCompanyData(companyId);
  const run = getRun(data, month);
  const item = run?.items.find((row) => row.employeeId === employeeId);
  if (!item || item.paid) return "NO_OPEN_ITEM";
  const line = deductionLines(item).find((row) => row.sourceRefId === refId);
  if (!line) return "NOT_FOUND";
  return removeDeductionLine(companyId, month, item, line.id, actor);
}