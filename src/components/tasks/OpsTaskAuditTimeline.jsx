import React from "react";
import { MUTED, NAVY } from "@/lib/platformStyles";
import { buildTaskAuditTimeline } from "@/lib/opsDerivations";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";

/** Creation, delegation/transfer, and attested delete (reason stays). */
export default function OpsTaskAuditTimeline({ task, ar }) {
  const rows = buildTaskAuditTimeline(task, ar ? "ar" : "en");

  if (!rows.length) return null;
  return (
    <OpsTaskSection title={ar ? "سجل التدقيق" : "Audit trail"} count={rows.length}>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {rows.map((row, i) => (
          <div
            key={row.id || `${row.at}-${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "14px 1fr",
              gap: 10,
              padding: "7px 0",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.tone || "#94A3B8", marginTop: 4, flexShrink: 0 }} />
              {i < rows.length - 1 ? <span style={{ flex: 1, width: 1, background: "var(--nv-line)", marginTop: 4 }} /> : null}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: NAVY, lineHeight: 1.55, textWrap: "pretty" }}>{row.text}</div>
              {row.type === "delete" && (
                <div style={{ fontSize: 11, color: NAVY, lineHeight: 1.55, marginTop: 3, textWrap: "pretty" }}>
                  {ar ? "حذفها:" : "Deleted by:"} {row.by || (ar ? "غير مذكور" : "Not recorded")}
                </div>
              )}
              {row.type !== "create" && (
                <div style={{ fontSize: 11, color: row.reason ? "var(--nv-warn-ink)" : MUTED, lineHeight: 1.55, marginTop: 3, textWrap: "pretty" }}>
                  {ar ? "السبب:" : "Reason:"} {row.reason || (ar ? "غير مذكور" : "Not recorded")}
                </div>
              )}
              <div style={{ fontSize: 10, color: MUTED, marginTop: 2, fontFamily: "'IBM Plex Sans',sans-serif" }} dir="ltr">
                {row.when}
                {row.type !== "delete" && row.by ? ` · ${row.by}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </OpsTaskSection>
  );
}
