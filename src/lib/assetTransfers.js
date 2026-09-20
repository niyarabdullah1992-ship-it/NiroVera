/** Inter-station asset transfer requests — origin stays on the buyer; the receiver does not take the book cost. */

import { getCompanyData, updateCompany } from "./store.js";
import { applyApprovedAssetMove, checkAssetTransferRequestGate, checkAssetTransferReviewGate } from "./assetTransferGates.js";
import { notifyMoneyMany, stationManagerIds } from "./moneyNotifications.js";

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export { applyApprovedAssetMove, checkAssetTransferRequestGate, checkAssetTransferReviewGate };

export function listAssetTransfers(data) {
  return Array.isArray(data?.assetTransfers) ? data.assetTransfers : [];
}

export function requestAssetTransfer(companyId, payload) {
  const gate = checkAssetTransferRequestGate(payload);
  if (!gate.ok) return gate;
  let created = null;
  updateCompany(companyId, (data) => {
    data.assetTransfers = data.assetTransfers || [];
    created = {
      id: uid("tr"),
      assetId: payload.asset.id,
      assetCode: payload.asset.assetCode || payload.asset.qrCode || "",
      assetName: payload.asset.name || "",
      fromStationId: gate.from,
      toStationId: gate.to,
      reason: gate.reason,
      status: "pending",
      reqBy: payload.reqBy || "",
      reqById: payload.reqById || "",
      reqAt: new Date().toISOString().slice(0, 10),
    };
    data.assetTransfers.unshift(created);
  });
  if (created) {
    const data = getCompanyData(companyId);
    notifyMoneyMany(companyId, [
      created.reqById,
      ...stationManagerIds(data, created.fromStationId),
      ...stationManagerIds(data, created.toStationId),
    ], {
      ar: `طلب نقل أصل «${created.assetName}» إلى فرع آخر — بانتظار موافقة المالك.`,
      en: `Asset transfer requested for «${created.assetName}» — waiting on the owning manager.`,
      to: "/app/assets?tab=xfer",
      key: `ast-xfer-${created.id}`,
    });
  }
  return { ok: true, transfer: created };
}

export function reviewAssetTransfer(companyId, { transferId, decision, actorName, actor }) {
  const dec = decision === "rejected" ? "rejected" : "done";
  const current = getCompanyData(companyId);
  const gate = checkAssetTransferReviewGate({
    transfer: listAssetTransfers(current).find((entry) => entry.id === transferId),
    user: actor,
    ownerId: current?.ownerId,
  });
  if (!gate.ok) return { ok: false, ...gate };
  let updated = null;
  updateCompany(companyId, (data) => {
    const row = (data.assetTransfers || []).find((entry) => entry.id === transferId);
    if (!row || row.status !== "pending") return;
    row.status = dec;
    row.okBy = actorName || "";
    row.okAt = new Date().toISOString().slice(0, 10);
    if (dec === "done") {
      row.doneAt = row.okAt;
      data.assets = (data.assets || []).map((asset) => applyApprovedAssetMove(asset, row));
    }
    updated = row;
  });
  if (!updated) {
    return {
      ok: false,
      error: "NOT_PENDING",
      reason: "الطلب ليس بانتظار الموافقة.",
      reasonEn: "This request is not awaiting approval.",
    };
  }
  if (updated) {
    // The decision reaches the same people the request did — the requester plus both
    // branches — because the losing branch and the gaining branch both keep a figure
    // on this asset. The text names the asset and the reason that was written on the
    // request, so the notice is readable without opening the row.
    const data = getCompanyData(companyId);
    notifyMoneyMany(companyId, [
      updated.reqById,
      ...stationManagerIds(data, updated.fromStationId),
      ...stationManagerIds(data, updated.toStationId),
    ], {
      ar: updated.status === "done"
        ? `نُقل الأصل «${updated.assetName}» — ${updated.reason || "بلا سبب مكتوب"} المنشأ يبقى على الشاري.`
        : `رُفض طلب نقل الأصل «${updated.assetName}» — الطلب كان: ${updated.reason || "بلا سبب مكتوب"}`,
      en: updated.status === "done"
        ? `Asset «${updated.assetName}» moved — ${updated.reason || "no reason written"} The origin stays on the buyer.`
        : `The transfer request for asset «${updated.assetName}» was rejected — the request was: ${updated.reason || "no reason written"}`,
      to: "/app/assets?tab=xfer",
      key: `ast-xfer-done-${updated.id}`,
    });
  }
  return { ok: true, transfer: updated };
}
