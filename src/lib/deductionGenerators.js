// Generates documented payroll deduction lines from approved records — instead of
// re-typing amounts manually in payroll.
// Idempotent: the same sourceRefId never produces a line twice.
import { addDeductionLine, deductionLines, removeDeductionLine } from "@/lib/payrollDeductions";
import { checkArticle92LoanGate } from "@/lib/payrollDerivations";
import { getRun, ensurePayrollRun, monthKey, syncEmployeeSalaryToPayroll } from "@/lib/payroll";
import { getCompanyData } from "@/lib/store";

/**
 * Art. 116: an approved unpaid leave is wage not due, not an Art. 92 deduction. Instead of posting
 * an "attendance" deduction line (which counted toward the Art. 93 half-wage cap and could block
 * the month), the open payroll line is re-derived — it carries the days as `unpaidLeaveCut`.
 */
export function refreshUnpaidLeaveWage(companyId, employeeId) {
  syncEmployeeSalaryToPayroll(companyId, employeeId);
  return null;
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
  // Art. 2: the wage a fine is measured on is the actual wage (basic + allowances) — the same figure
  // the fines register (Art. 73) records, so the register and the payslip carry one amount.
  const daily = ((Number(item.base) || 0) + (Number(item.allowances) || 0)) / 30;
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
export function advanceDeductionRef(requestId) {
  return `ADV-${String(requestId || "").trim()}`;
}

/** An approved «سلفة» (not an allowance — that is paid, not recovered). */
function isRecoverableAdvance(row) {
  return row?.type === "advance" && row?.moneyKind !== "allowance" && String(row?.status || "") === "approved" && Number(row?.amount) > 0;
}

/** What the payroll has already taken back for one advance, across every run. */
export function advanceRecovered(data, employeeId, requestId) {
  const ref = advanceDeductionRef(requestId);
  let sum = 0;
  for (const run of data?.payrollRuns || []) {
    for (const item of run?.items || []) {
      if (String(item.employeeId) !== String(employeeId)) continue;
      for (const line of deductionLines(item)) if (line.sourceRefId === ref) sum += Number(line.amount) || 0;
    }
  }
  return Math.round(sum * 100) / 100;
}

/**
 * Art. 92(1): an approved advance is recovered from the wage in instalments of at most 10% of it. The
 * approval used to stop at «معتمد» — nothing reached the payroll, and the manager had to type an ADV-
 * line by hand each month. This posts the month's instalment on the open line: the smaller of what is
 * left and what the 10% cap still allows this month. Idempotent per month and advance.
 */
export function postAdvanceInstallment(companyId, employeeId, request, actor, month = monthKey(new Date())) {
  if (!isRecoverableAdvance(request)) return "NOT_AN_ADVANCE";
  ensurePayrollRun(companyId, month);
  const data = getCompanyData(companyId);
  const run = getRun(data, month);
  const item = run?.items.find((row) => row.employeeId === employeeId);
  if (!item || item.paid) return "NO_OPEN_ITEM";
  const refId = advanceDeductionRef(request.id);
  if (deductionLines(item).some((line) => line.sourceRefId === refId)) return "ALREADY_GENERATED";
  const left = Math.round((Number(request.amount) - advanceRecovered(data, employeeId, request.id)) * 100) / 100;
  if (left <= 0) return "SETTLED";
  const room = checkArticle92LoanGate(item, 0);
  const capLeft = Math.round(((room.max ?? 0) - (room.total ?? 0)) * 100) / 100;
  const amount = Math.min(left, capLeft);
  if (!(amount > 0)) return "CAP_REACHED";
  return addDeductionLine(companyId, month, item, {
    amount,
    source: "advance",
    sourceRefId: refId,
    reason: `قسط سلفة ${Number(request.amount).toLocaleString("en-US")} ر.س — المتبقي بعده ${Math.max(0, left - amount).toLocaleString("en-US")} ر.س`,
  }, actor);
}

/** Every approved advance still owed gets this month's instalment (the payroll page runs it on open). */
export function reconcileAdvanceInstallments(companyId, month = monthKey(new Date()), actor = null) {
  const data = getCompanyData(companyId);
  let posted = 0;
  for (const employee of data?.employees || []) {
    for (const row of employee.otherRequests || []) {
      if (!isRecoverableAdvance(row)) continue;
      // addDeductionLine answers null when the line was posted, an error code otherwise
      if (postAdvanceInstallment(companyId, employee.id, row, actor, month) === null) posted += 1;
    }
  }
  return posted;
}
