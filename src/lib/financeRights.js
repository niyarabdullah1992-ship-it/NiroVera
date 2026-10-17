/**
 * One rights model for the money surface: payroll.
 *
 * Each surface used to re-derive "who is this person" on its own, which is how the
 * same hole appeared twice (a local fallback more permissive than the cloud function
 * it stands in for). The role sets, the station reach and the manage/self split all
 * live here now; the per-surface modules add only what is specific to their gates.
 *
 * A view is derived from rights. Someone who holds management rights may step down
 * to their personal view; someone who does not has no control that lifts them up,
 * and every hidden action is still refused by the gate with a named Arabic reason.
 */
import { canAdjustPayroll } from "@/lib/permissions";

export const SENIOR_ROLES = ["owner", "director", "ops_manager", "admin"];
export const STATION_ROLES = ["station_manager", "pgm"];
export const FINANCE_ROLES = ["financial_officer"];

/** Home station plus explicit extra coverage. */
export function stationReachOf(user) {
  const raw = user?.managedStations ?? user?.managedStationIds;
  const managed = Array.isArray(raw) ? raw : String(raw || "").split(/[،,]/);
  return new Set([user?.stationId, ...managed].map((id) => String(id || "").trim()).filter(Boolean));
}

export function isSeniorUser(user, data) {
  if (!user) return false;
  const role = String(user.role || "");
  return SENIOR_ROLES.includes(role) || !!user.isOwner || (!!data?.ownerId && user.id === data.ownerId);
}

/** The shared identity every money surface starts from. */
export function financeActor(user, data) {
  const role = String(user?.role || "");
  const senior = isSeniorUser(user, data);
  return {
    userId: user?.id || "",
    role,
    senior,
    stationManager: !senior && STATION_ROLES.includes(role),
    financeOfficer: !senior && FINANCE_ROLES.includes(role),
    reach: stationReachOf(user),
  };
}

/**
 * The normalised actor the local money fallbacks run on, resolved from the stored
 * session against the company roster.
 *
 * "An unknown session falls to least privilege" turned out not to be a money rule —
 * the HR register needed the very same one — so the derivation lives in
 * `fallbackActor` and every local fallback now shares a single copy of it.
 */
export { fallbackActor as moneyActor } from "@/lib/fallbackActor";

export const MANAGE = "manage";
export const SELF = "self";

/**
 * Does this account decide anything on this surface, or only act on its own row?
 * Payroll defers to the existing HR permission so the two never drift apart.
 */
export function canManageSurface(surface, user, data) {
  const who = financeActor(user, data);
  if (surface === "payroll") return canAdjustPayroll(user, data);
  return who.senior || who.stationManager || who.financeOfficer;
}

/**
 * The view actually rendered. `requested` comes from the URL, so it is treated as
 * a preference, never as a grant: an account without management rights is pinned
 * to its own view whatever the URL says.
 */
export function resolveFinanceView(surface, user, data, requested, railSide = "") {
  const canManage = canManageSurface(surface, user, data);
  if (!canManage) return SELF;
  if (railSide === "employee") return SELF;
  if (railSide === "manage") return MANAGE;
  return requested === SELF ? SELF : MANAGE;
}

export const FINANCE_VIEW_COPY = {
  manage: {
    ar: "عرض الإدارة — ما أقرّره",
    en: "Management view — what I decide",
    switchAr: "عرض ما يخصّني",
    switchEn: "Switch to my view",
  },
  self: {
    ar: "عرض الموظف — ما يخصّني",
    en: "Employee view — what concerns me",
    switchAr: "عرض الإدارة",
    switchEn: "Switch to management view",
  },
};

/** Why a surface is showing the personal view — stated, not implied. */
export const SELF_VIEW_NOTE = {
  payroll: {
    ar: "هذا العرض لقسيمتك أنت. تحرير البنود واعتماد الصرف وحماية الأجور للإدارة.",
    en: "This view is your own payslip. Editing lines, approving payment and wage protection belong to management.",
  },
};
