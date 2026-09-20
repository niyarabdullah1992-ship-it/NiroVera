import React from "react";
import { X, QrCode, FileText, AlertTriangle, ArrowLeftRight, Pencil, CheckCircle2 } from "lucide-react";
import AssetStatusBadge from "@/components/assets/AssetStatusBadge";
import CustodyTimeline from "@/components/assets/CustodyTimeline";
import MaintenanceLog from "@/components/assets/MaintenanceLog";
import { assetAlerts as getAssetAlerts, endOfLifeDate as getEndOfLifeDate } from "@/lib/assetAlerts";
import { assetDeleteErasesTrail } from "@/lib/assetRights";
import { formatDateTime } from "@/lib/dateFormat";
import {
  INK, MUTED, BORDER, SURFACE, CARD, ui, dialogOverlay, dialogCard,
} from "@/lib/platformStyles";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";

const Row = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
    <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
    <span style={{ fontSize: 13, color: INK, textAlign: "end" }}>{value || "—"}</span>
  </div>
);

export default function AssetDetail({
  asset,
  custody,
  maintenance,
  lang,
  stationName,
  onClose,
  onHandover,
  onEdit,
  onAddMaintenance,
  onMarkLost,
  onResolveLost,
  onDelete,
}) {
  const ar = lang === "ar";
  const alerts = getAssetAlerts(asset, lang);
  const lostCase = asset.lostCase && typeof asset.lostCase === "object" ? asset.lostCase : null;
  const hasTrail = assetDeleteErasesTrail(asset, custody, maintenance);
  const pastCases = Array.isArray(asset.lostHistory) ? asset.lostHistory : [];
  const link = `${window.location.origin}/app/assets?asset=${encodeURIComponent(asset.qrCode || asset.assetCode)}`;
  const qr = `https://quickchart.io/qr?size=200&text=${encodeURIComponent(link)}`;

  return (
    <div style={{ ...dialogOverlay, alignItems: "flex-end" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...dialogCard,
          maxWidth: 680,
          maxHeight: "92vh",
          borderRadius: "16px 16px 0 0",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: INK }}>{asset.name}</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{asset.assetCode}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AssetStatusBadge status={asset.status} lang={lang} />
            <button type="button" onClick={onClose} style={{ ...ui.btnGhost, padding: 6 }} aria-label={ar ? "إغلاق" : "Close"}>
              <X size={16} />
            </button>
          </div>
        </div>

        {alerts.length > 0 && (
          <div style={{ borderRadius: 10, border: "1px solid #FDE68A", background: "#FFFBEB", padding: 12 }}>
            {alerts.map((a) => (
              <p key={a} style={{ margin: "0 0 4px", fontSize: 12, color: "#92400E", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={13} /> {a}
              </p>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,1fr) auto" }}>
          <div>
            <Row label={ar ? "الفئة" : "Category"} value={asset.category} />
            <Row label={ar ? "الحائز الحالي" : "Current holder"} value={asset.holderName} />
            <Row label={ar ? "الفرع الحالي" : "Current station"} value={`${stationName(asset.stationId)}${asset.site ? ` · ${asset.site}` : ""}`} />
            <Row
              label={ar ? "المنشأ" : "Origin"}
              value={asset.originStationId && String(asset.originStationId) !== String(asset.stationId)
                ? (ar ? `اشتراه ${stationName(asset.originStationId)} ونُقل — على ميزانيته` : `Bought by ${stationName(asset.originStationId)} and moved — on that budget`)
                : (ar ? `شراء مباشر على ميزانية ${stationName(asset.originStationId || asset.stationId)}` : `Direct buy on ${stationName(asset.originStationId || asset.stationId)}`)}
            />
            <Row label={ar ? "تاريخ الشراء" : "Purchase date"} value={asset.purchaseDate} />
            <Row label={ar ? "القيمة" : "Value"} value={asset.value ? Number(asset.value).toLocaleString("en-US") : ""} />
            <Row label={ar ? "نهاية الضمان" : "Warranty end"} value={asset.warrantyEndDate} />
            <Row label={ar ? "نهاية العمر الافتراضي" : "End of useful life"} value={getEndOfLifeDate(asset)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <img
              src={qr}
              alt="QR"
              style={{ width: 112, height: 112, borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fff", padding: 4 }}
            />
            <span style={{ fontSize: 11, color: MUTED, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <QrCode size={12} /> {asset.qrCode}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {asset.status !== "lost" && onHandover ? (
            <button type="button" onClick={onHandover} style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ArrowLeftRight size={14} /> {ar ? "تسليم العهدة" : "Hand over"}
            </button>
          ) : null}
          {onEdit ? (
            <button type="button" onClick={onEdit} style={{ ...ui.btnSecondary, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Pencil size={14} /> {ar ? "تعديل" : "Edit"}
            </button>
          ) : null}
          {asset.status !== "lost" ? (
            onMarkLost ? (
              <button type="button" onClick={onMarkLost} style={{ ...ui.btnDanger, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={14} /> {ar ? "بلاغ فقدان" : "Report lost"}
              </button>
            ) : null
          ) : onResolveLost ? (
            <button type="button" onClick={onResolveLost} style={{ ...ui.btnSecondary, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={14} /> {ar ? "إغلاق بلاغ الفقدان" : "Close lost case"}
            </button>
          ) : null}
          {onDelete ? (
            hasTrail ? (
              // The gate would refuse this anyway; saying so here is cheaper than a toast.
              <span style={{ fontSize: 11, color: MUTED, alignSelf: "center", maxWidth: 320 }}>
                {ar
                  ? "لا يُحذف: للأصل سجل عهدة أو صيانة أو بلاغ فقدان — أغلقه بالشطب ليبقى تاريخه."
                  : "Not deletable: this asset carries a custody, maintenance or loss trail — retire it instead."}
              </span>
            ) : (
              <ConfirmDeleteDialog
                title={ar ? "حذف الأصل" : "Delete asset"}
                description={ar
                  ? "أصل بلا سجل عهدة — يُحذف كخطأ إدخال. الأصول التي سُلّمت أو صينت لا تُحذف، تُشطب."
                  : "An asset with no custody trail is deleted as a data-entry mistake. Assets that were handed over or serviced are retired, not deleted."}
                confirmLabel={ar ? "حذف" : "Delete"}
                onConfirm={onDelete}
                trigger={(
                  <button type="button" style={{ ...ui.btnDanger, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {ar ? "حذف الأصل" : "Delete asset"}
                  </button>
                )}
              />
            )
          ) : null}
        </div>

        {lostCase ? (
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, background: SURFACE, padding: 12 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 650, color: INK }}>
              {ar ? "بلاغ الفقدان" : "Loss report"}
            </h4>
            <Row label={ar ? "سبب فتح البلاغ" : "Why the case was opened"} value={lostCase.reason} />
            <Row
              label={ar ? "فتحه" : "Opened by"}
              value={lostCase.openedBy ? `${lostCase.openedBy}${lostCase.openedAt ? ` · ${formatDateTime(lostCase.openedAt, lang)}` : ""}` : ""}
            />
            {lostCase.closedAt || lostCase.decision ? (
              <>
                <Row
                  label={ar ? "القرار" : "Decision"}
                  value={lostCase.decision === "charged"
                    ? (ar ? "تحميل / شطب — الأصل مستبعد" : "Charged / written off — asset retired")
                    : (ar ? "عُثر عليه — الأصل متاح" : "Found — asset available")}
                />
                <Row label={ar ? "سبب القرار" : "Decision reason"} value={lostCase.decisionReason} />
                <Row
                  label={ar ? "أغلقه" : "Closed by"}
                  value={lostCase.closedBy ? `${lostCase.closedBy}${lostCase.closedAt ? ` · ${formatDateTime(lostCase.closedAt, lang)}` : ""}` : ""}
                />
              </>
            ) : (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "#92400E", lineHeight: 1.7 }}>
                {ar
                  ? "البلاغ مفتوح — لا يُغلق إلا بقرار مكتوب: تحميل وشطب، أو العثور عليه."
                  : "The case is open — it closes only on a written decision: charged / written off, or found."}
              </p>
            )}
            <p style={{ margin: "8px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
              {ar
                ? "سبب الفتح يبقى كما كُتب؛ قرار الإغلاق يُضاف إليه ولا يستبدله."
                : "The opening reason stays as written; the closing decision is added to it, never over it."}
            </p>
            {pastCases.length ? (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 11, color: MUTED }}>
                  {ar ? `بلاغات سابقة على هذا الأصل (${pastCases.length})` : `Earlier loss cases on this asset (${pastCases.length})`}
                </span>
                {pastCases.map((past, index) => (
                  <p key={past.closedAt || index} style={{ margin: "6px 0 0", fontSize: 11, color: INK, lineHeight: 1.7 }}>
                    {ar ? "فُتح: " : "Opened: "}{past.reason || (ar ? "بلا سبب مكتوب" : "no reason written")}
                    {" · "}
                    {past.decision === "charged" ? (ar ? "أُغلق بالتحميل والشطب" : "closed as charged") : (ar ? "أُغلق بالعثور عليه" : "closed as found")}
                    {": "}{past.decisionReason || (ar ? "بلا سبب مكتوب" : "no reason written")}
                    {past.closedAt ? ` · ${formatDateTime(past.closedAt, lang)}` : ""}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {(asset.documents || []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {asset.documents.map((d) => (
              <a
                key={d.url}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                style={{ ...ui.btnGhost, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
              >
                <FileText size={13} /> {d.name}
              </a>
            ))}
          </div>
        )}

        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 650, color: INK }}>
            {ar ? "سجل العهدة" : "Custody trail"}
          </h4>
          <div className="nv-asset-panel" style={{ background: SURFACE, borderRadius: 14, boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)", border: `1px solid ${BORDER}`, padding: 12 }}>
            <CustodyTimeline records={custody} lang={lang} />
          </div>
        </div>

        <div className="nv-asset-panel" style={{ background: CARD, borderRadius: 14, boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)", border: `1px solid ${BORDER}`, padding: 12 }}>
          <MaintenanceLog records={maintenance} lang={lang} onAdd={onAddMaintenance} />
        </div>
      </div>
    </div>
  );
}
