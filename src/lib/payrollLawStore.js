// Store writes for the wage-protection rules in lib/payrollLaw.js: payday (Art. 90 / model
// regulation Art. 17), the company minimum (Art. 89), weekly instalments (Art. 90(1)), annual
// leave paid in advance (Art. 109) and the final settlement paid mark (Art. 88).
// Kept out of store.js on purpose: every write here goes through updateCompany like the rest.
import { getCompanyData, updateCompany } from "@/lib/store";
import { logAudit } from "@/lib/auditLog";
import { notifyMoney } from "@/lib/moneyNotifications";
import { PAYROLL_DENY, canManagePayroll, payrollActor } from "@/lib/payrollRights";
import { ensurePayrollRun } from "@/lib/payroll";
import { contractWage, lineTransferDue } from "@/lib/payrollDerivations";
import { annualLeaveAdvanceAmount, payPeriodOf, weeklyInstalments } from "@/lib/payrollLaw";

const actorName = (companyId) => payrollActor(companyId).user?.name || "unknown";
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

/** Day of month wages are paid. Empty clears it (the WPS window alone then applies). */
export function setPayrollPayday(companyId, day) {
  if (!canManagePayroll(companyId)) return PAYROLL_DENY.SETTINGS.error;
  const n = Math.floor(Number(day));
  const value = n >= 1 && n <= 31 ? n : null;
  updateCompany(companyId, (d) => {
    d.settings = d.settings || {};
    if (value) d.settings.payrollPayday = value;
    else delete d.settings.payrollPayday;
  });
  logAudit(companyId, "payroll_payday_set", actorName(companyId), value ? `Payday set to day ${value} of the month (Art. 90)` : "Payday cleared");
  return null;
}

/** A company-recorded minimum wage — an internal warning; only the Council of Ministers sets a binding one (Art. 89). */
export function setCompanyMinimumWage(companyId, amount) {
  if (!canManagePayroll(companyId)) return PAYROLL_DENY.SETTINGS.error;
  const n = Number(amount);
  const value = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  updateCompany(companyId, (d) => {
    d.settings = d.settings || {};
    if (value) d.settings.minimumWage = value;
    else delete d.settings.minimumWage;
  });
  logAudit(companyId, "payroll_minimum_wage_set", actorName(companyId), value ? `Company minimum wage recorded: ${value} (Art. 89 — internal warning)` : "Company minimum wage cleared");
  return null;
}

/**
 * Art. 90(1): pay every weekly-cycle worker the instalments of the weeks that have ended. Each
 * instalment is recorded on the line (`weeklyPayments`); the month-end transfer carries the rest.
 */
export function payWeeklyInstalments(companyId, month, { isOff, today = todayIso() } = {}) {
  if (!canManagePayroll(companyId)) return { error: PAYROLL_DENY.MANAGE.error };
  const paid = [];
  updateCompany(companyId, (d) => {
    const run = (d.payrollRuns || []).find((row) => row.month === month);
    if (!run || run.status === "sent") return;
    const employees = new Map((d.employees || []).map((employee) => [employee.id, employee]));
    for (const item of run.items || []) {
      if (item.paid || payPeriodOf(employees.get(item.employeeId)) !== "weekly") continue;
      item.weeklyPayments = item.weeklyPayments || [];
      for (const row of weeklyInstalments(item, month, isOff)) {
        if (row.paidAt || row.end > today || !(row.amount > 0)) continue;
        const at = new Date().toISOString();
        item.weeklyPayments.push({ key: row.key, start: row.start, end: row.end, amount: row.amount, paidAt: at, by: actorName(companyId) });
        paid.push({ employeeId: item.employeeId, name: item.employeeName || item.employeeId, key: row.key, amount: row.amount });
      }
    }
  });
  for (const row of paid) {
    notifyMoney(companyId, row.employeeId, {
      ar: `صُرف أجر الأسبوع ${row.key} (${row.amount.toLocaleString()} ر.س) — المادة 90.`,
      en: `Your wage for week ${row.key} (${row.amount} SAR) was paid — Art. 90.`,
      to: "/app/payroll",
      key: `week-${row.key}-${row.employeeId}`,
    });
  }
  if (paid.length) logAudit(companyId, "payroll_weekly_paid", actorName(companyId), `Weekly instalments paid (${month}): ${paid.map((r) => `${r.name} ${r.key} ${r.amount}`).join(" · ")}`);
  return { paid: paid.length };
}

/**
 * Art. 109: pay an approved annual leave in advance. Stamps the leave and records the amount on the
 * line of the month it starts in — the same wage, paid earlier, so the net does not change; only the
 * month-end transfer carries less.
 */
export function payAnnualLeaveInAdvance(companyId, employeeId, leaveId) {
  if (!canManagePayroll(companyId)) return { error: PAYROLL_DENY.MANAGE.error };
  const data = getCompanyData(companyId);
  const employee = (data?.employees || []).find((row) => row.id === employeeId);
  const leave = (employee?.leaveRequests || []).find((row) => row.id === leaveId);
  if (!leave) return { error: "LEAVE_NOT_FOUND", reason: "الإجازة غير موجودة.", reasonEn: "Leave not found." };
  if (String(leave.type) !== "annual" || !["approved", "accepted"].includes(String(leave.status))) {
    return { error: "NOT_APPROVED_ANNUAL", reason: "تُصرف مقدّماً الإجازة السنوية المعتمدة فقط — المادة 109.", reasonEn: "Only an approved annual leave is paid in advance — Art. 109." };
  }
  if (leave.advancePaidAt) return { error: "ALREADY_PAID", reason: "صُرف أجر هذه الإجازة مقدّماً بالفعل.", reasonEn: "This leave's pay was already advanced." };
  const month = String(leave.startDate || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "LEAVE_DATES", reason: "الإجازة بلا تاريخ بداية.", reasonEn: "The leave has no start date." };
  ensurePayrollRun(companyId, month);
  const run = (getCompanyData(companyId)?.payrollRuns || []).find((row) => row.month === month);
  const line = (run?.items || []).find((row) => row.employeeId === employeeId);
  const profile = employee.profile || {};
  const wage = line ? contractWage(line) : (Number(profile.baseSalary) || 0) + (Number(profile.allowances) || 0);
  const start = String(leave.startDate).slice(0, 10);
  const end = String(leave.endDate || leave.startDate).slice(0, 10);
  const days = Number(leave.days) > 0 ? Number(leave.days) : Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1;
  const amount = annualLeaveAdvanceAmount({ days, monthlyWage: wage });
  const at = new Date().toISOString();
  const by = actorName(companyId);
  updateCompany(companyId, (d) => {
    const emp = (d.employees || []).find((row) => row.id === employeeId);
    const target = (emp?.leaveRequests || []).find((row) => row.id === leaveId);
    if (!target) return;
    Object.assign(target, { advancePaidAt: at, advancePayAmount: amount, advancePaidBy: by });
    const item = ((d.payrollRuns || []).find((row) => row.month === month)?.items || []).find((row) => row.employeeId === employeeId);
    if (item && !item.paid && item.settledNet == null) {
      item.leaveAdvances = item.leaveAdvances || [];
      item.leaveAdvances.push({ leaveId, days, amount, paidAt: at, by });
    }
  });
  logAudit(companyId, "payroll_annual_leave_advance", by, `Art. 109 advance for ${employee.name || employeeId}: ${days} days, ${amount} (${start})`);
  notifyMoney(companyId, employeeId, {
    ar: `صُرف أجر إجازتك السنوية (${days} يوماً، ${amount.toLocaleString()} ر.س) مقدّماً قبل بدئها — المادة 109.`,
    en: `Your annual-leave pay (${days} days, ${amount} SAR) was paid in advance — Art. 109.`,
    to: "/app/payroll",
    key: `leave-advance-${leaveId}`,
  });
  return { ok: true, amount, days };
}

/** Art. 88: mark the final settlement paid — it closes the one- or two-week settlement window. */
export function recordFinalSettlementPaid(companyId, employeeId, { amount, paidOn } = {}) {
  if (!canManagePayroll(companyId)) return { error: PAYROLL_DENY.MANAGE.error, reason: PAYROLL_DENY.MANAGE.reason, reasonEn: PAYROLL_DENY.MANAGE.reasonEn };
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(paidOn || "")) ? paidOn : todayIso();
  let name = employeeId;
  updateCompany(companyId, (d) => {
    const emp = (d.employees || []).find((row) => row.id === employeeId);
    if (!emp) return;
    name = emp.name || employeeId;
    emp.profile = emp.profile || {};
    emp.profile.contractExit = {
      ...(emp.profile.contractExit || {}),
      settlementPaidAt: day,
      settlementAmount: Math.round((Number(amount) || 0) * 100) / 100,
      settlementPaidBy: actorName(companyId),
    };
  });
  logAudit(companyId, "offboarding_settlement_paid", actorName(companyId), `Art. 88 final settlement paid for ${name}: ${Number(amount) || 0} on ${day}`);
  notifyMoney(companyId, employeeId, {
    ar: `صُرفت تصفية مستحقاتك النهائية (${(Number(amount) || 0).toLocaleString()} ر.س) — المادة 88.`,
    en: `Your final settlement (${Number(amount) || 0} SAR) was paid — Art. 88.`,
    to: "/app/payroll",
    key: `settlement-${employeeId}`,
  });
  return { ok: true, paidAt: day };
}

export { lineTransferDue };
