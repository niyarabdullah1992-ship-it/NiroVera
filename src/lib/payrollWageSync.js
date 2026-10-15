import { injuryMonth } from "./workInjury.js";
import { sickMonth } from "./payrollLeaveEffects.js";
/** Derived wage parts for one payroll line: contract split, GOSI, approved overtime. */

import { approvedOvertimeHoursForMonth, approvedOvertimeHoursForYear } from "./attendanceDerivations.js";
import { deriveSaudiStatus } from "./complianceDerivations.js";
import { contractAllowanceSplit, employeeWageSplit } from "./employeeFileView.js";
import { readGosiRegisteredAt } from "./facts/people.js";
import { gosiLine } from "./payrollDerivations.js";
import { detentionMonth, detentionRefund, holidayOvertimeHours, unpaidLeaveMonth } from "./payrollLaw.js";
import { isOfficialHoliday, laborCalendarOf } from "./ummAlQuraCalendar.js";
import { readPersonalAttendance } from "./facts/attendance.js";

/** True / false when identity is settled. Null when it is unknown or mismatched — nothing is withheld. */
export function payrollSaudiFlag(employee) {
  if (!employee) return null;
  const status = deriveSaudiStatus(employee);
  if (!status.countable || status.mismatch || status.unresolved) return null;
  return status.saudi === true;
}

function allowanceKeyPresent(profile) {
  return profile?.allowances != null && profile.allowances !== "";
}

function baseKeyPresent(profile) {
  return profile?.baseSalary != null && profile.baseSalary !== "";
}

/**
 * The next derived fields for an unpaid line.
 * Housing and transport are copied only when the file or a matching contract split has them.
 * Overtime hours come from approved attendance decisions for the month (zero stays zero).
 * Returns null for a settled line so a paid wage is never rewritten.
 */
export function derivePayrollWagePatch(item, employee, { otDecisions, month, company } = {}) {
  if (!item || item.paid || item.settledNet != null) return null;
  const profile = employee?.profile || {};
  const wage = employee ? employeeWageSplit(profile, employee) : null;
  const night = wage ? wage.night : (Number(item.nightAllowance) || 0);
  const base = employee && baseKeyPresent(profile) ? (Number(profile.baseSalary) || 0) : (Number(item.base) || 0);
  let allowances = Number(item.allowances) || 0;
  const split = Boolean(wage?.split);
  if (split) allowances = wage.housing + wage.transport + wage.other + night;
  else if (employee && (allowanceKeyPresent(profile) || (wage?.extras || 0) > 0)) allowances = (Number(profile.allowances) || 0) + (wage?.extras || 0) + night;

  const isSaudi = employee ? payrollSaudiFlag(employee) : (item.isSaudi === true ? true : item.isSaudi === false ? false : null);
  const registeredAt = readGosiRegisteredAt(employee);
  // GOSI counts basic + housing + commissions: pass housing only when the contract split is known.
  const gosiParts = {
    base,
    allowances,
    housingAllowance: wage && (split || allowances === 0) ? wage.housing : (item.housingAllowance ?? undefined),
    commissionAmount: wage ? wage.commission || 0 : Number(item.commissionAmount) || 0,
  };
  const gosi = {
    gosiEmployee: 0,
    gosiRegisteredAt: registeredAt,
    gosiAsOf: month || "",
    gosiClass: "",
    gosiBlocked: false,
    gosiBlockReason: "",
    gosiEmployeeRate: null,
    gosiEmployerRate: null,
  };
  if (isSaudi === true) {
    const quote = gosiLine(gosiParts, { saudi: true, onDate: month, registeredAt });
    gosi.gosiEmployee = quote.blocked ? 0 : quote.employeeShare;
    gosi.gosiClass = quote.subscriberClass;
    gosi.gosiBlocked = quote.blocked;
    gosi.gosiBlockReason = quote.reason || "";
    gosi.gosiEmployeeRate = quote.employeeRate;
    gosi.gosiEmployerRate = quote.employerRate;
  } else if (isSaudi === false) {
    const quote = gosiLine(gosiParts, { saudi: false });
    gosi.gosiEmployeeRate = 0;
    gosi.gosiEmployerRate = quote.employerRate;
  }
  const overtimeHours = month
    ? approvedOvertimeHoursForMonth(otDecisions, item.employeeId, month)
    : Math.max(0, Number(item.overtimeHours) || 0);
  const overtimeHoursYtd = month
    ? approvedOvertimeHoursForYear(otDecisions, item.employeeId, month)
    : Math.max(0, Number(item.overtimeHoursYtd) || 0);

  const fields = {
    base,
    allowances,
    nightAllowance: night,
    isSaudi,
    ...gosi,
    overtimeHours,
    overtimeHoursYtd,
    // Art. 137 (establishment outside GOSI occupational hazards): 75% after the 60th day; Art. 139 days unpaid.
    ...(() => {
      if (!employee || !month) return { injuryDays: 0, injuryReducedDays: 0, injuryReduction: 0, injuryUnpaid: 0, injuryCovered: null };
      const inj = injuryMonth({ employee, company, month, monthlyWage: base + allowances });
      return { injuryDays: inj.days, injuryReducedDays: inj.reducedDays, injuryExcludedDays: inj.excludedDays, injuryReduction: inj.reduction, injuryUnpaid: inj.unpaid, injuryCovered: inj.covered, injuryWageStop: inj.wageStop, injuryAllowance: inj.allowance, injuryHospitalDays: inj.hospitalDays };
    })(),
    // Art. 117: the month's sick days in their bands — three-quarters after 30, unpaid after 90.
    ...(() => {
      if (!employee || !month) return { sickDays: 0, sickQuarterDays: 0, sickUnpaidDays: 0, sickReduction: 0, sickUnpaid: 0 };
      const sick = sickMonth({ employee, month, monthlyWage: base + allowances });
      return { sickDays: sick.days, sickFullDays: sick.fullDays, sickQuarterDays: sick.quarterDays, sickUnpaidDays: sick.unpaidDays + sick.beyondDays, sickReduction: sick.reduction, sickUnpaid: sick.unpaid };
    })(),
    // Art. 116: approved unpaid-leave days are wage not due — they cut the gross, never an Art. 92
    // deduction line, so they stay outside the Art. 93 half-wage cap.
    ...(() => {
      if (!employee || !month) return { unpaidLeaveDays: 0, unpaidLeaveCut: 0 };
      const unpaid = unpaidLeaveMonth({ employee, month, monthlyWage: base + allowances });
      return { unpaidLeaveDays: unpaid.days, unpaidLeaveCut: unpaid.cut };
    })(),
    // Art. 97: detained in a work-related case — half the wage up to 180 days; refund on acquittal.
    ...(() => {
      const detention = employee?.profile?.workDetention;
      if (!employee || !month || !detention?.from) return { detentionDays: 0, detentionCut: 0, refunds: 0 };
      const det = detentionMonth({ detention, month, monthlyWage: base + allowances });
      const acquittedMonth = String(detention.acquittedAt || "").slice(0, 7);
      const refund = acquittedMonth === month ? detentionRefund({ detention, monthlyWage: base + allowances }) : 0;
      return { detentionDays: det.days, detentionCut: det.cut, refunds: refund };
    })(),
    // Art. 107(3): hours on official holidays are overtime — those no decision already carries.
    ...(() => {
      if (!month || !company) return { holidayOvertimeHours: 0 };
      const calendar = laborCalendarOf(company);
      const hol = holidayOvertimeHours({
        employeeId: item.employeeId,
        month,
        attendance: readPersonalAttendance(company),
        otDecisions,
        isHoliday: (day) => isOfficialHoliday(day, calendar),
      });
      return { holidayOvertimeHours: hol.hours, holidayOvertimeFlagged: hol.fromDecisions };
    })(),
    // Art. 2 named lines, shown apart on the payslip.
    remoteAreaAllowance: wage ? wage.remote || 0 : Number(item.remoteAreaAllowance) || 0,
    medicalDistanceAllowance: wage ? wage.medical || 0 : Number(item.medicalDistanceAllowance) || 0,
    mealAllowance: wage ? wage.meals || 0 : Number(item.mealAllowance) || 0,
    hazardAllowance: wage ? wage.hazard || 0 : Number(item.hazardAllowance) || 0,
    livingAllowance: wage ? wage.living || 0 : Number(item.livingAllowance) || 0,
    commissionAmount: wage ? wage.commission || 0 : Number(item.commissionAmount) || 0,
  };
  // A real split copies the contract parts. A line with no lump still carries the
  // three named allowances at whatever the file holds (zero when no rule sets one).
  if (wage && (split || allowances === 0)) {
    fields.housingAllowance = wage.housing;
    fields.transportAllowance = wage.transport;
    fields.otherAllowances = wage.other;
  }

  const previousContract = (Number(item.base) || 0) + (Number(item.allowances) || 0);
  const nextContract = base + allowances;
  if (item.qiwaWage == null || Math.abs(Number(item.qiwaWage) - previousContract) < 1) {
    fields.qiwaWage = nextContract;
  }

  const persistProfile = wage?.splitFrom === "contract"
    ? { housingAllowance: wage.housing, transportAllowance: wage.transport, otherAllowances: wage.otherPlain ?? wage.other }
    : null;

  return { fields, split, persistProfile };
}

/** Line plus its derived wage, for the slip before the store write lands. */
export function facePayrollItem(item, employee, context) {
  const patch = derivePayrollWagePatch(item, employee, context);
  if (!patch) return item;
  const next = { ...item, ...patch.fields };
  if (patch.fields.housingAllowance == null) {
    delete next.housingAllowance;
    delete next.transportAllowance;
    delete next.otherAllowances;
  }
  return next;
}

export { contractAllowanceSplit };
