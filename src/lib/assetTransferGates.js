/** Inter-station asset transfer gates — no store import. */

export function checkAssetTransferRequestGate({ asset, fromStationId, toStationId, reason }) {
  if (!asset) {
    return { ok: false, error: "ASSET_REQUIRED", reason: "اختر الأصل.", reasonEn: "Choose the asset." };
  }
  if (asset.status === "lost" || asset.status === "retired") {
    return {
      ok: false,
      error: "ASSET_NOT_MOVABLE",
      reason: "أصل مفقود أو مستبعد لا يُطلب.",
      reasonEn: "A lost or retired asset cannot be requested.",
    };
  }
  const from = String(fromStationId || asset.stationId || "");
  const to = String(toStationId || "");
  if (!from || !to || from === to) {
    return {
      ok: false,
      error: "STATIONS_REQUIRED",
      reason: "النقل بين فرعين مختلفين.",
      reasonEn: "Transfer is between two different stations.",
    };
  }
  if (String(reason || "").trim().length <= 5) {
    return {
      ok: false,
      error: "REASON_REQUIRED",
      reason: "اكتب سبب الطلب.",
      reasonEn: "Write the request reason.",
    };
  }
  return { ok: true, from, to, reason: String(reason).trim() };
}

const SENIOR_ROLES = ["owner", "director", "ops_manager", "admin"];
const REVIEW_ROLES = ["station_manager", "pgm"];

/** Only the owning station's manager (or management) may decide a transfer, and
 *  nobody decides their own request. The board render and the write share this gate. */
export function checkAssetTransferReviewGate({ transfer, user, ownerId }) {
  if (!transfer) {
    return { ok: false, error: "NOT_FOUND", reason: "لم يُعد هذا الطلب موجودًا.", reasonEn: "This request no longer exists." };
  }
  if (transfer.status !== "pending") {
    return { ok: false, error: "NOT_PENDING", reason: "الطلب ليس بانتظار الموافقة.", reasonEn: "This request is not awaiting approval." };
  }
  const role = String(user?.role || "");
  const senior = !!user && (SENIOR_ROLES.includes(role) || (!!ownerId && user.id === ownerId) || !!user.isOwner);
  if (senior || role === "financial_officer") return { ok: true };
  const raw = user?.managedStations ?? user?.managedStationIds;
  const managed = Array.isArray(raw) ? raw : String(raw || "").split(/[،,]/);
  const reach = new Set([user?.stationId, ...managed].map((id) => String(id || "").trim()).filter(Boolean));
  if (!REVIEW_ROLES.includes(role) || !reach.has(String(transfer.fromStationId || ""))) {
    return {
      ok: false,
      error: "REVIEW_DENIED",
      reason: "اعتماد النقل لمدير الفرع المالك أو الإدارة.",
      reasonEn: "Approving a transfer is for the owning station manager or management.",
    };
  }
  if (String(transfer.reqById || "") === String(user?.id || "")) {
    return {
      ok: false,
      error: "SELF_REVIEW",
      reason: "لا يعتمد الطلب من رفعه.",
      reasonEn: "The requester cannot approve their own request.",
    };
  }
  return { ok: true };
}

/** Book cost stays on the buyer (origin). Physical station moves to the receiver. */
export function applyApprovedAssetMove(asset, transfer) {
  if (!asset || !transfer || String(asset.id) !== String(transfer.assetId)) return asset;
  return {
    ...asset,
    stationId: transfer.toStationId,
    originStationId: asset.originStationId || transfer.fromStationId,
  };
}
