import React from "react";
import { MUTED, NAVY } from "@/lib/platformStyles";
import { buildWorkProofAuditTimeline } from "@/lib/workProofDerivations";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";

export default function ProofAuditTimeline({ proof, ar }) {
  const rows = buildWorkProofAuditTimeline(proof, ar ? "ar" : "en");
  if (!rows.length) return null;
  return (
    <OpsTaskSection
      title={ar ? "سجل التدقيق" : "Audit trail"}
      count={rows.length}
      hint={ar
        ? "من أنشأ ومن عدّل ومن أغلق — كل موظفي الفرع يرون السجل."
        : "Who created, edited, and closed — visible to everyone at the branch."}
    >
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
              {i < rows.length - 1 ? <span style={{ flex: 1, width: 1, background: "#E2E8F0", marginTop: 4 }} /> : null}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: NAVY, lineHeight: 1.55, textWrap: "pretty" }}>{row.text}</div>
              {row.detail ? (
                <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.55, marginTop: 3, textWrap: "pretty" }}>
                  {row.detail}
                </div>
              ) : null}
              <div style={{ fontSize: 10, color: MUTED, marginTop: 2, fontFamily: "'IBM Plex Sans',sans-serif" }} dir="ltr">
                {row.when}
              </div>
            </div>
          </div>
        ))}
      </div>
    </OpsTaskSection>
  );
}
