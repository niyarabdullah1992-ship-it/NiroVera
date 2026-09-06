import React from "react";
import { boardPaceCopy, dailyPaceCopy } from "@/lib/opsDerivations";
import { BORDER, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

const NUM = {
  fontFamily: "'IBM Plex Sans',sans-serif",
  fontSize: 22,
  fontWeight: 600,
  lineHeight: 1,
  letterSpacing: "-0.02em",
};

export default function DailyPaceStrip({ ar = true, pace, board, compact = false, emptyHint = "" }) {
  const copy = board ? boardPaceCopy(board, ar) : dailyPaceCopy(pace, ar);
  if (!copy) {
    if (!emptyHint) return null;
    return (
      <div
        style={{
          border: `1px solid ${BORDER}`,
          background: SURFACE,
          borderRadius: 9,
          padding: "7px 12px",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: "0.01em" }}>
          {ar ? "التوزيع على الأيام" : "Spread across days"}
        </div>
        <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.4, marginTop: 4 }}>
          {emptyHint}
        </div>
      </div>
    );
  }

  const valueColor = copy.tone === "warn" ? "#B45309" : copy.tone === "done" ? MUTED : NAVY;

  if (compact) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 5,
          padding: "2px 8px",
          borderRadius: 20,
          border: `1px solid ${BORDER}`,
          background: SURFACE,
          whiteSpace: "nowrap",
        }}
      >
        <span dir="ltr" style={{ ...NUM, fontSize: 12, color: valueColor }}>{copy.metrics[0].value}</span>
        <span style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{ar ? "اليوم" : "today"}</span>
      </span>
    );
  }

  return (
    <div
      title={copy.hint}
      style={{
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        borderRadius: 9,
        padding: "7px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
          {copy.kicker}
        </div>
        <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
          {copy.metrics.map((metric, index) => (
            <div
              key={metric.label}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 6,
                paddingInline: index === 0 ? 0 : 12,
                borderInlineStart: index === 0 ? "none" : `1px solid ${BORDER}`,
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>{metric.label}</span>
              <span dir="ltr" style={{ ...NUM, fontSize: 16, color: index === 0 ? valueColor : NAVY }}>{metric.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.4, marginTop: 4 }}>
        {copy.hint}
      </div>
    </div>
  );
}
