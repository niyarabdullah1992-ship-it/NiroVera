import React, { useMemo, useState } from "react";
import {
  listAssetTransfers,
  requestAssetTransfer,
  reviewAssetTransfer,
  checkAssetTransferRequestGate,
  checkAssetTransferReviewGate,
} from "@/lib/assetTransfers";
import { MUTED, NAVY, field, labelMuted, ui, tableShell, SURFACE, OK, WARN, BAD, cardShell } from "@/lib/platformStyles";
import { toast } from "@/components/ui/use-toast";

export default function AssetTransferBoard({
  companyId,
  assets = [],
  stations = [],
  data,
  currentUser,
  activeStationId,
  ar,
  mineOnly = false,
  onApplied,
}) {
  const [assetId, setAssetId] = useState("");
  const otherStation = (stations.find((row) => String(row.id) !== String(activeStationId)) || stations[0])?.id || "";
  const [toId, setToId] = useState(otherStation);
  const [reason, setReason] = useState("");
  const allTransfers = listAssetTransfers(data);
  // In the personal lens the ledger is the requests this person raised — another
  // branch's pending move is not their business to read.
  const transfers = mineOnly
    ? allTransfers.filter((row) => String(row.reqById || "") === String(currentUser?.id || ""))
    : allTransfers;
  const asset = assets.find((row) => row.id === assetId);
  const stationName = (id) => stations.find((row) => String(row.id) === String(id))?.name || id || "—";
  const gate = checkAssetTransferRequestGate({
    asset,
    fromStationId: asset?.stationId,
    toStationId: toId,
    reason,
  });

  // Same gate the write enforces, so a row never shows a decision it would refuse.
  const canApprove = (row) =>
    checkAssetTransferReviewGate({ transfer: row, user: currentUser, ownerId: data?.ownerId }).ok;

  const movable = useMemo(
    () => assets.filter((row) => row.status !== "lost" && row.status !== "retired" && String(row.stationId) !== String(toId)),
    [assets, toId],
  );

  const submit = (event) => {
    event.preventDefault();
    const result = requestAssetTransfer(companyId, {
      asset,
      fromStationId: asset?.stationId,
      toStationId: toId,
      reason,
      reqBy: currentUser?.name || "",
      reqById: currentUser?.id || "",
    });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    setReason("");
    setAssetId("");
    toast({ description: ar ? "أُرسل طلب النقل." : "Transfer request sent." });
    onApplied?.();
  };

  const decide = async (row, decision) => {
    const result = reviewAssetTransfer(companyId, {
      transferId: row.id,
      decision,
      actorName: currentUser?.name || "",
      actor: currentUser,
    });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    if (decision === "approved" || result.transfer?.status === "done") {
      await onApplied?.(result.transfer);
    } else {
      onApplied?.();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={tableShell}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(170px,1.4fr) 120px 120px minmax(160px,1.3fr) minmax(170px,auto)",
          gap: 10,
          padding: "10px 16px",
          background: SURFACE,
          fontSize: 10,
          fontWeight: 600,
          color: MUTED,
        }}>
          {(ar ? ["الأصل", "من فرع", "إلى فرع", "الطلب", "الحالة"] : ["Asset", "From", "To", "Request", "Status"]).map((label) => <span key={label}>{label}</span>)}
        </div>
        {transfers.length === 0 ? (
          <p style={{ margin: 0, padding: 16, fontSize: 12, color: MUTED }}>
            {mineOnly
              ? (ar ? "لم ترفع طلب نقل بعد." : "You have not raised a transfer request yet.")
              : (ar ? "لا طلبات نقل بعد." : "No transfer requests yet.")}
          </p>
        ) : transfers.map((row) => (
          <div
            key={row.id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(170px,1.4fr) 120px 120px minmax(160px,1.3fr) minmax(170px,auto)",
              gap: 10,
              padding: "12px 16px",
              borderTop: "1px solid var(--nv-line)",
              alignItems: "center",
              background: row.status === "pending" && canApprove(row) ? "#fdf6e8" : "transparent",
              color: NAVY,
            }}
          >
            <span>
              <span style={{ display: "block", fontWeight: 700 }}>{row.assetName}</span>
              {/* Who asked and when — a storage id told the reader nothing. */}
              <span style={{ fontSize: 10, color: MUTED }}>
                {[row.assetCode, row.reqBy ? (ar ? `طلبه ${row.reqBy}` : `raised by ${row.reqBy}`) : "", row.reqAt]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span style={{ fontSize: 12, color: MUTED }}>{stationName(row.fromStationId)}</span>
            <span style={{ fontSize: 12, color: MUTED }}>{stationName(row.toStationId)}</span>
            <span style={{ fontSize: 12 }}>{row.reason}</span>
            <span>
              {row.status === "pending" && canApprove(row) ? (
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => decide(row, "approved")} style={{ ...ui.btnPrimary, height: 28, padding: "0 10px" }}>
                    {ar ? "وافق وسلّم" : "Approve & hand over"}
                  </button>
                  <button type="button" onClick={() => decide(row, "rejected")} style={{ ...ui.btnDanger, height: 28, padding: "0 10px" }}>
                    {ar ? "ارفض" : "Reject"}
                  </button>
                </span>
              ) : (
                <span style={row.status === "done" ? OK : row.status === "rejected" ? BAD : WARN}>
                  {row.status === "done" ? (ar ? "نُقل" : "Moved") : row.status === "rejected" ? (ar ? "مرفوض" : "Rejected") : (ar ? "ينتظر موافقة المالك" : "Awaiting owner")}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="nv-doc" style={{ ...cardShell, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", padding: 16 }}>
        <div>
          <label style={labelMuted}>{ar ? "الأصل المطلوب — من أي فرع" : "Asset — from any station"}</label>
          <select value={assetId} onChange={(event) => setAssetId(event.target.value)} style={field} disabled={!movable.length}>
            <option value="">{movable.length ? (ar ? "— اختر —" : "— Choose —") : (ar ? "لا أصل قابل للنقل إلى هذا الفرع" : "No asset can move to this station")}</option>
            {movable.map((row) => (
              <option key={row.id} value={row.id}>{row.name} · {stationName(row.stationId)}</option>
            ))}
          </select>
          {!movable.length ? (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
              {ar
                ? "كل الأصول الظاهرة موجودة أصلًا في الفرع الوجهة، أو هي مفقودة/مستبعدة. غيّر الوجهة أو اعرض أصول فرع آخر."
                : "Every visible asset already sits at the destination, or is lost/retired. Change the destination or show another station's assets."}
            </p>
          ) : null}
        </div>
        <div>
          <label style={labelMuted}>{ar ? "إلى فرع" : "To station"}</label>
          <select value={toId} onChange={(event) => setToId(event.target.value)} style={field}>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelMuted}>{ar ? "سبب الطلب" : "Reason"}</label>
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={ar ? "الفرع بلا مركبة صيانة — طلب مدير الفرع" : "Receiving station has no maintenance vehicle"} style={field} />
        </div>
        <div style={{ gridColumn: "1 / -1", fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
          {gate.ok
            ? (ar ? "المنقول يبقى على ميزانية شاريه ويُذكر منشأه على البطاقة." : "The transferred asset stays on the buyer's budget and keeps its origin on the card.")
            : (ar ? gate.reason : gate.reasonEn)}
        </div>
        <div>
          <button type="submit" disabled={!gate.ok} style={{ ...ui.btnPrimary, opacity: gate.ok ? 1 : 0.45 }}>
            {gate.ok ? (ar ? "أرسل طلب النقل" : "Send transfer request") : (ar ? gate.reason : gate.reasonEn)}
          </button>
        </div>
      </form>
    </div>
  );
}
