/** Derived wage parts for one payroll line: contract split, GOSI, approved overtime. */

import { approvedOvertimeHoursForMonth, approvedOvertimeHoursForYear } from "./attendanceDerivations.js";
import { deriveSaudiStatus } from "./complianceDerivations.js";
import { contractAllowanceSplit, employeeWageSplit } from "./employeeFileView.js";
import { readGosiRegisteredAt } from "./facts/people.js";
import { gosiLine } from "./payrollDerivations.js";

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
export function derivePayrollWagePatch(item, employee, { otDecisions, month } = {}) {
  if (!item || item.paid || item.settledNet != null) return null;
  const profile = employee?.profile || {};
  const wage = employee ? employeeWageSplit(profile, employee) : null;
  const night = wage ? wage.night : (Number(item.nightAllowance) || 0);
  const base = employee && baseKeyPresent(profile) ? (Number(profile.baseSalary) || 0) : (Number(item.base) || 0);
  let allowances = Number(item.allowances) || 0;
  const split = Boolean(wage?.split);
  if (split) allowances = wage.housing + wage.transport + wage.other + night;
  else if (employee && allowanceKeyPresent(profile)) allowances = (Number(profile.allowances) || 0) + night;

  const isSaudi = employee ? payrollSaudiFlag(employee) : (item.isSaudi === true ? true : item.isSaudi === false ? false : null);
  const registeredAt = readGosiRegisteredAt(employee);
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
    const quote = gosiLine({ base, allowances }, { saudi: true, onDate: month, registeredAt });
    gosi.gosiEmployee = quote.blocked ? 0 : quote.employeeShare;
    gosi.gosiClass = quote.subscriberClass;
    gosi.gosiBlocked = quote.blocked;
    gosi.gosiBlockReason = quote.reason || "";
    gosi.gosiEmployeeRate = quote.employeeRate;
    gosi.gosiEmployerRate = quote.employerRate;
  } else if (isSaudi === false) {
    const quote = gosiLine({ base, allowances }, { saudi: false });
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
    ? { housingAllowance: wage.housing, transportAllowance: wage.transport, otherAllowances: wage.other }
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
