import React from "react";
import { boardPaceCopy, dailyPaceCopy } from "@/lib/opsDerivations";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { BORDER, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

const NUM = {
  fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
  fontSize: 22,
  fontWeight: 600,
  lineHeight: 1,
  letterSpacing: "-0.02em",
  fontVariantNumeric: "tabular-nums",
  direction: "ltr",
  unicodeBidi: "isolate",
};

export default function DailyPaceStrip({ ar = true, pace, board, compact = false, embedded = false, emptyHint = "" }) {
  const copy = board ? boardPaceCopy(board, ar) : dailyPaceCopy(pace, ar);
  if (!copy) {
    if (!emptyHint) return null;
    return (
      <div
        style={{
          border: `1px solid ${BORDER}`,
          background: SURFACE,
          borderRadius: DS_CONTROL_RADIUS,
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

  const valueColor = copy.tone === "warn" ? "var(--nv-warn-ink)" : copy.tone === "done" ? MUTED : NAVY;

  if (compact) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 5,
          padding: "2px 8px",
          borderRadius: 999,
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
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 18,
        flexWrap: "wrap",
        padding: embedded ? "8px 12px" : "10px 14px",
        border: embedded ? "none" : `1px solid ${BORDER}`,
        borderTop: embedded ? `1px solid ${BORDER}` : undefined,
        background: embedded ? "transparent" : SURFACE,
        borderRadius: embedded ? 0 : DS_CONTROL_RADIUS,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>{copy.kicker}</span>
        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.45 }}>{copy.hint}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", flex: "0 0 auto" }}>
        {copy.metrics.map((metric, index) => (
          <div
            key={metric.label}
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 6,
              paddingInline: 12,
              borderInlineStart: index === 0 ? "none" : `1px solid ${BORDER}`,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, whiteSpace: "nowrap" }}>{metric.label}</span>
            <span dir="ltr" style={{ ...NUM, fontSize: 18, color: index === 0 ? valueColor : NAVY }}>{metric.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
