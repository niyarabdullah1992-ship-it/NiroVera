/**
 * Who may read and write on the assets & custody surface.
 * These rules mirror the guards in base44/functions/assets/entry.ts — the local
 * fallback substitutes for that function, so it must never be more permissive.
 * The role sets and the station reach come from the shared money-surface model in
 * lib/financeRights.js so assets, expenses, inventory and payroll cannot drift.
 */
import { financeActor } from "@/lib/financeRights";

export function assetRights(user, data) {
  const who = financeActor(user, data);
  return {
    userId: who.userId,
    senior: who.senior,
    stationManager: who.stationManager,
    readAll: who.senior || who.financeOfficer,
    reach: who.reach,
    canCreate: who.senior || who.stationManager,
    canDelete: who.senior,
    canPickAnyStation: who.senior,
  };
}

function inReach(rights, stationId) {
  if (rights.senior) return true;
  if (!stationId) return true;
  return rights.reach.has(String(stationId));
}

/** A transferred asset sits in one branch but stays on the buying branch's book,
 *  so both branches keep authority over it. */
function reachesAsset(rights, asset) {
  if (inReach(rights, asset?.stationId)) return true;
  return !!asset?.originStationId && inReach(rights, asset.originStationId);
}

const DENY = {
  REGISTER: {
    error: "ASSET_REGISTER_DENIED",
    reason: "تعديل سجل الأصول لمدير الفرع المالك أو الإدارة.",
    reasonEn: "Editing the asset register is for the owning station manager or management.",
  },
  OUT_OF_REACH: {
    error: "ASSET_OUT_OF_REACH",
    reason: "هذا الأصل في فرع خارج نطاقك.",
    reasonEn: "This asset sits in a station outside your scope.",
  },
  DELETE: {
    error: "ASSET_DELETE_DENIED",
    reason: "حذف أصل من السجل للإدارة العليا فقط.",
    reasonEn: "Deleting a register row is for senior management only.",
  },
  DELETE_HAS_TRAIL: {
    error: "ASSET_DELETE_HAS_TRAIL",
    reason: "هذا الأصل له سجل عهدة أو صيانة أو بلاغ فقدان — لا يُحذف. أغلقه بالشطب ليبقى تاريخه في السجل.",
    reasonEn: "This asset already carries a custody, maintenance or loss trail — it is not deleted. Retire it so its history stays in the register.",
  },
  LOST_OPEN: {
    error: "ASSET_LOST_DENIED",
    reason: "فتح بلاغ الفقدان لمدير الفرع المالك أو الإدارة.",
    reasonEn: "Opening a loss report is for the owning station manager or management.",
  },
  LOST_CLOSE: {
    error: "ASSET_LOST_DECISION_DENIED",
    reason: "إغلاق بلاغ الفقدان لمدير الفرع المالك أو الإدارة.",
    reasonEn: "Closing a loss case is for the owning station manager or management.",
  },
  HANDOVER: {
    error: "ASSET_HANDOVER_DENIED",
    reason: "تسليم العهدة لحائز الأصل أو مدير فرعه.",
    reasonEn: "A handover is for the current holder or their station manager.",
  },
  MAINTENANCE: {
    error: "ASSET_MAINTENANCE_DENIED",
    reason: "تسجيل الصيانة لحائز الأصل أو مدير فرعه.",
    reasonEn: "Logging maintenance is for the current holder or their station manager.",
  },
};

const holds = (rights, asset) => !!asset && String(asset.holderId || "") === String(rights.userId);

/**
 * An asset that was handed over, serviced or reported lost carries accountability
 * history; deleting the register row would take that history down with it. Only a
 * row that never left the register — a data-entry mistake — may be deleted.
 * The initial custody row written when the asset is created is not a trail.
 */
export function assetDeleteErasesTrail(asset, custody = [], maintenance = []) {
  const rows = (custody || []).filter((row) => String(row.assetId || "") === String(asset?.id || ""));
  const handedOver = rows.some((row) => !!row.fromId || row.notes !== "initial");
  const serviced = (maintenance || []).some((row) => String(row.assetId || "") === String(asset?.id || ""));
  return handedOver || serviced || !!asset?.lostCase || !!(asset?.lostHistory || []).length;
}

/** action: save | delete | status | resolve | handover | maintenance */
export function checkAssetWriteGate(rights, asset, action, ledger = null) {
  const station = asset?.stationId || "";
  if (action === "delete") {
    if (!rights.canDelete) return { ok: false, ...DENY.DELETE };
    if (ledger && assetDeleteErasesTrail(asset, ledger.custody, ledger.maintenance)) {
      return { ok: false, ...DENY.DELETE_HAS_TRAIL };
    }
    return { ok: true };
  }
  if (action === "handover" || action === "maintenance") {
    const deny = action === "handover" ? DENY.HANDOVER : DENY.MAINTENANCE;
    if (rights.senior) return { ok: true };
    if (holds(rights, asset)) return { ok: true };
    if (rights.stationManager && inReach(rights, station)) return { ok: true };
    return { ok: false, ...deny };
  }
  const deny = action === "status" ? DENY.LOST_OPEN : action === "resolve" ? DENY.LOST_CLOSE : DENY.REGISTER;
  if (rights.senior) return { ok: true };
  if (!rights.stationManager) return { ok: false, ...deny };
  if (!reachesAsset(rights, asset)) return { ok: false, ...DENY.OUT_OF_REACH };
  return { ok: true };
}

/** Same disclosure rule as the cloud: senior/finance read the company, a manager
 *  reads the stations they cover plus what those stations bought and lent out,
 *  everyone else reads their station and own custody. */
export function visibleAssetsFor(rights, assets) {
  if (rights.readAll) return assets;
  return (assets || []).filter((asset) => reachesAsset(rights, asset) || holds(rights, asset));
}
