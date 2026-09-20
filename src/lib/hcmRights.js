/**
 * Rights for the HR register — org units, jobs, positions, employment actions,
 * review cycles and ratings — stated once for the screen and for the local
 * fallback, exactly as `assetRights` / `expenseRights` / `inventoryRights` /
 * `payrollRights` do for the money surfaces.
 *
 * The role sets and the refusal texts below are the ones the `hcm` cloud function
 * already enforces. They live here so the fallback cannot drift wider than the
 * server it stands in for: reading the register is for managers, changing the
 * structure is for senior roles, and somebody else's assignment is not a personal
 * file.
 */
import { getCompanyData, getSession } from "@/lib/store";
import { fallbackActor } from "@/lib/fallbackActor";

export const HCM_SENIOR_ROLES = ["owner", "director", "ops_manager", "pgm", "admin", "hr_manager"];
export const HCM_MANAGER_ROLES = [...HCM_SENIOR_ROLES, "station_manager", "supervisor"];

export const HCM_DENY = {
  REGISTER: {
    error: "HCM_REGISTER_DENIED",
    reason: "سجل الإجراءات الوظيفية للمسؤولين — افتح ملفك الشخصي لعرض إسنادك.",
    reasonEn: "The employment register is for managers — open your own file to see your assignment.",
  },
  ASSIGNMENT: {
    error: "HCM_ASSIGNMENT_DENIED",
    reason: "إسناد موظف آخر للمسؤولين — افتح ملفك الشخصي لعرض إسنادك أنت.",
    reasonEn: "Another person's assignment is for managers — open your own file to see yours.",
  },
  STRUCTURE: {
    error: "HCM_STRUCTURE_DENIED",
    reason: "تغيير الهيكل الوظيفي أو خطط الأهداف يحتاج صلاحية إدارية.",
    reasonEn: "Changing the job structure or goal plans requires a senior role.",
  },
};

/** The actor the HR fallback runs on: unknown session, least privilege. */
export function hcmActor(companyId) {
  const data = getCompanyData(companyId);
  const who = fallbackActor(companyId, getSession(), data);
  const senior = who.owner || HCM_SENIOR_ROLES.includes(who.role);
  return { ...who, senior, manager: senior || HCM_MANAGER_ROLES.includes(who.role) };
}

export function hcmDenied(deny) {
  return { ok: false, error: deny.error, reason: deny.reason, reasonEn: deny.reasonEn };
}
