/**
 * The guard layer the wage run never had.
 *
 * Payroll writes straight to the store through lib/payroll.js and
 * lib/payrollDeductions.js — there is no service in front of them, so until now the
 * page-level `canAdjustPayroll` check was the only thing standing between any signed-in
 * account and someone else's wage. Splitting the surface into a management view and an
 * employee payslip view puts those modules in an employee's browser, so the rules have
 * to live under the mutators, not over them.
 *
 * Two levels, because the proof cycle feeds payroll from other surfaces:
 * - manage: editing lines, paying, settings, manual deductions, resolving a dispute.
 * - feed:   materialising the month's run and writing a *derived* line that an approved
 *           attendance or discipline record already justifies. A station manager who
 *           approved that record holds this, even without payroll rights.
 */
import { getCompanyData, getSession } from "@/lib/store";
import { canAdjustPayroll, canApproveReports, isCompanyOwner } from "@/lib/permissions";
import { stationReachOf } from "@/lib/financeRights";

export const PAYROLL_DENY = {
  MANAGE: {
    error: "PAYROLL_MANAGE_DENIED",
    reason: "تحرير مسير الأجور واعتماد الصرف لمن يملك صلاحية الرواتب.",
    reasonEn: "Editing the wage run and approving payment is for payroll rights holders.",
  },
  DEDUCTION: {
    error: "PAYROLL_DEDUCTION_DENIED",
    reason: "إضافة بند خصم يدوي أو حذفه لمن يملك صلاحية الرواتب.",
    reasonEn: "Adding or removing a manual deduction line is for payroll rights holders.",
  },
  FEED: {
    error: "PAYROLL_FEED_DENIED",
    reason: "قيد الخصم المشتقّ لمن اعتمد المصدر — لا يملك حسابك هذه الصلاحية.",
    reasonEn: "A derived deduction is posted by whoever approved its source — your account does not hold that right.",
  },
  RUN_OPEN: {
    error: "PAYROLL_RUN_OPEN_DENIED",
    reason: "فتح مسير الشهر لمن يملك صلاحية الرواتب أو يعتمد سجلات المصدر.",
    reasonEn: "Opening the month's run is for payroll rights holders or approvers of its source records.",
  },
  DISPUTE_RESOLVE: {
    error: "PAYROLL_DISPUTE_DENIED",
    reason: "البتّ في الاعتراض لمن يملك صلاحية الرواتب.",
    reasonEn: "Settling a dispute is for payroll rights holders.",
  },
  DISPUTE_OWN: {
    error: "PAYROLL_DISPUTE_NOT_YOURS",
    reason: "الاعتراض على بند الخصم لصاحب البند نفسه.",
    reasonEn: "A deduction line is disputed by the person it is charged to.",
  },
  SETTINGS: {
    error: "PAYROLL_SETTINGS_DENIED",
    reason: "إعدادات المسير للإدارة العليا فقط.",
    reasonEn: "Run settings are for senior management only.",
  },
  MONTH_CLOSED: {
    error: "PAYROLL_MONTH_CLOSED",
    reason: "الشهر مؤرشف — يُقرأ ولا يُعدَّل.",
    reasonEn: "This month is archived — read only.",
  },
  RUN_LOCKED: {
    error: "RUN_LOCKED",
    reason: "لا تعديل بعد الاعتماد.",
    reasonEn: "Cannot edit lines after approval.",
  },
  FEED_REACH: {
    error: "PAYROLL_FEED_OUT_OF_REACH",
    reason: "قيد الخصم المشتقّ داخل فروعك فقط — هذا الموظف خارج نطاقك.",
    reasonEn: "A derived deduction is posted only inside your own stations — this employee is outside your reach.",
  },
};

/** The signed-in employee record for this company, as the store sees it. */
export function payrollActor(companyId) {
  const session = getSession();
  const data = getCompanyData(companyId);
  const user = (data?.employees || []).find((row) => row.id === session?.userId) || null;
  return { user, data, userId: user?.id || session?.userId || "" };
}

export function canManagePayroll(companyId) {
  const { user, data } = payrollActor(companyId);
  return canAdjustPayroll(user, data);
}

/** Whoever may approve the source record that justifies a derived line. */
export function canFeedPayroll(companyId) {
  const { user, data } = payrollActor(companyId);
  if (!user) return false;
  return canAdjustPayroll(user, data) || isCompanyOwner(user, data) || canApproveReports(user);
}

/**
 * Feed rights come from having approved the source record, and that authority stops at
 * the approver's own branches. Without this a station manager could charge a wage in a
 * branch they never see — payroll rights are company-wide, feed rights are not.
 */
export function payrollFeedInReach(companyId, item) {
  const { user, data } = payrollActor(companyId);
  if (!user) return false;
  if (canAdjustPayroll(user, data) || isCompanyOwner(user, data)) return true;
  const employee = (data?.employees || []).find((row) => row.id === item?.employeeId);
  const station = String(employee?.stationId || item?.stationId || "").trim();
  if (!station) return false;
  return stationReachOf(user).has(station);
}

export function ownsPayrollItem(companyId, item) {
  const { userId } = payrollActor(companyId);
  return !!userId && String(item?.employeeId || "") === String(userId);
}

/** Mutators in this family report refusal as a code string, matching their
 *  existing contract ("INVALID_AMOUNT", "NO_OPEN_ITEM", …) rather than throwing.
 *  A refusal is only a guard if the person reading the screen is told why, so
 *  callers resolve the code back into its named reason. */
const DENY_BY_CODE = Object.fromEntries(Object.values(PAYROLL_DENY).map((deny) => [deny.error, deny]));

export function payrollDenyReason(code, ar = true) {
  const deny = DENY_BY_CODE[String(code || "")];
  if (!deny) return "";
  return ar ? deny.reason : deny.reasonEn;
}
