/**
 * Who may read, review and pay on the expenses surface.
 * Mirrors base44/functions/expenses/entry.ts — the local fallback stands in for
 * that function, so it must never be more permissive. Built on the shared money
 * model in lib/financeRights.js.
 */
import { SENIOR_ROLES, STATION_ROLES } from "@/lib/financeRights";

const MANAGER_ROLES = ["director", "ops_manager", "pgm", "station_manager", "admin"];
const FINANCE_REVIEW_ROLES = ["financial_officer", "director", "ops_manager", "admin"];
const SENIOR_LIST = SENIOR_ROLES.filter((role) => role !== "admin");

/**
 * `auth` is the normalised actor the fallback already builds
 * ({ userId, role, owner, stationId, managedStations }).
 */
export function expenseRights(auth) {
  const manager = auth.owner || MANAGER_ROLES.includes(auth.role);
  const finance = auth.owner || FINANCE_REVIEW_ROLES.includes(auth.role);
  return {
    manager,
    finance,
    cfo: finance,
    senior: auth.owner || SENIOR_LIST.includes(auth.role),
    canPickStations: manager || finance,
  };
}

export function claimStationIds(claim) {
  return claim.stationIds?.length ? claim.stationIds : [claim.stationId];
}

/** Mirrors the station reach the `expenses` cloud function grants each role. */
export function reachableStationIds(auth, cap, stations) {
  if (cap.senior || cap.finance) return stations.map((station) => station.stationId);
  if (auth.role === "pgm") return (auth.managedStations || []).filter(Boolean);
  if (STATION_ROLES.includes(auth.role)) return [auth.stationId, ...(auth.managedStations || [])].filter(Boolean);
  return [auth.stationId].filter(Boolean);
}

/** Same disclosure rule as the cloud: senior/finance see all, a manager sees their
 *  stations, and everyone else sees only the claims they raised. */
export function visibleClaims(claims, auth, cap, reachable) {
  if (cap.senior || cap.finance) return claims;
  if (cap.manager) return claims.filter((claim) => claimStationIds(claim).some((id) => reachable.includes(id)));
  return claims.filter((claim) => claim.requesterId === auth.userId);
}

export const EXPENSE_DENY = {
  FINANCE_ONLY: {
    error: "FINANCE_ONLY",
    reason: "اعتماد المطالبة وصرفها من المالية فقط — لا يملك حسابك هذه الصلاحية.",
    reasonEn: "Approving and paying a claim is finance-only — your account does not hold that right.",
  },
  MANAGER_FIRST: {
    error: "MANAGER_STEP_PENDING",
    reason: "المطالبة بانتظار مدير الفرع — لا تُعتمد من الوعاء قبل مراجعته.",
    reasonEn: "The claim is still awaiting the station manager — it cannot be approved from the vessel first.",
  },
  MANAGER_DENIED: {
    error: "EXPENSE_MANAGER_REVIEW_DENIED",
    reason: "مراجعة المطالبة لمدير الفرع أو الإدارة — لا يملك حسابك هذه الصلاحية.",
    reasonEn: "Reviewing a claim belongs to the station manager or management — your account does not hold that right.",
  },
  FINANCE_DENIED: {
    error: "EXPENSE_FINANCE_REVIEW_DENIED",
    reason: "اعتماد المالية لمن يملك صلاحية المالية.",
    reasonEn: "Finance approval is for finance rights holders.",
  },
  CFO_DENIED: {
    error: "EXPENSE_CFO_REVIEW_DENIED",
    reason: "اعتماد المدير المالي لمن يملك صلاحية المالية.",
    reasonEn: "CFO approval is for finance rights holders.",
  },
  SELF_REVIEW: {
    error: "EXPENSE_SELF_REVIEW",
    reason: "لا يعتمد الطلب من رفعه.",
    reasonEn: "The requester cannot approve their own request.",
  },
};

/**
 * Same two-eyes shape as checkAssetTransferReviewGate: senior management is the
 * terminal authority, but a station manager does not review the claim they raised.
 */
export function checkExpenseSelfReview(auth, cap, claim) {
  if (cap.senior) return { ok: true };
  if (claim && String(claim.requesterId || "") === String(auth.userId)) {
    return { ok: false, ...EXPENSE_DENY.SELF_REVIEW };
  }
  return { ok: true };
}
