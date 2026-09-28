import React from "react";
import { formatDateTime } from "@/lib/dateFormat";
import { BORDER, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

/** Compact case-level trail — who did what when. Not the company/owner ledger. */
export default function VoiceAuditTrail({ events = [], ar }) {
  if (!events.length) return null;
  return (
    <details style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 11px" }}>
      <summary style={{ cursor: "pointer", listStyle: "none", fontSize: 11, fontWeight: 600, color: NAVY }}>
        {ar ? `مسار القرار · ${events.length}` : `Decision path · ${events.length}`}
      </summary>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 0 }}>
        {events.map((row, index) => (
          <div
            key={row.id || `${row.at}-${index}`}
            style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: 10, padding: "6px 0" }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.tone || "var(--nv-muted)", marginTop: 4, flexShrink: 0 }} />
              {index < events.length - 1 ? <span style={{ flex: 1, width: 1, background: BORDER, marginTop: 4 }} /> : null}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: NAVY, lineHeight: 1.55 }}>
                {row.actor} · {row.text}
              </div>
              {row.detail ? (
                <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.55, marginTop: 3 }}>«{row.detail}»</div>
              ) : null}
              <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
                {formatDateTime(row.at, ar ? "ar" : "en") || "—"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
