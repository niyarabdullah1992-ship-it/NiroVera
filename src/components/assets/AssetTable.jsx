import React from "react";
import AssetStatusBadge from "@/components/assets/AssetStatusBadge";
import { INK, MUTED, BORDER, SURFACE, tableShell, emptyState, tableHeadRow } from "@/lib/platformStyles";

export default function AssetTable({ assets, lang, stationName, activeStationId, onOpen }) {
  const ar = lang === "ar";
  const headers = ar
    ? ["الأصل والرقم", "الفئة", "الحائز", "الفرع الحالي", "المنشأ", "الحالة"]
    : ["Asset & code", "Category", "Holder", "Current station", "Origin", "Status"];

  if (!assets.length) {
    return <div style={emptyState}>{ar ? "لا توجد أصول مطابقة للفلتر." : "No assets match these filters."}</div>;
  }

  return (
    <div style={tableShell}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={tableHeadRow}>
              {headers.map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "start", fontWeight: 600, color: MUTED, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr
                key={a.id}
                onClick={() => onOpen(a)}
                style={{ borderTop: `1px solid ${BORDER}`, cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = SURFACE; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ color: INK, fontWeight: 600 }}>{a.name}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                    {a.assetCode || a.qrCode || "—"}
                  </div>
                </td>
                <td style={{ padding: "12px 14px", color: MUTED }}>{a.category || "—"}</td>
                <td style={{ padding: "12px 14px", color: INK }}>{a.holderName || "—"}</td>
                <td style={{ padding: "12px 14px", color: MUTED }}>
                  {stationName(a.stationId)}{a.site ? ` · ${a.site}` : ""}
                  {activeStationId && String(a.stationId) !== String(activeStationId) ? (
                    <div style={{ marginTop: 2, fontSize: 10 }}>{ar ? "فرع آخر — للاطّلاع" : "Other station — read only"}</div>
                  ) : null}
                </td>
                <td style={{ padding: "12px 14px", color: MUTED }}>
                  {a.originStationId ? stationName(a.originStationId) : (ar ? "شراء مباشر" : "Direct buy")}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <AssetStatusBadge status={a.status} lang={lang} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
