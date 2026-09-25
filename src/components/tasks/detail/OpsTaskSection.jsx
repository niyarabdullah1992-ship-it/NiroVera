import React from "react";
import { docFrame, DS_STATES } from "@/lib/designSystem";
import { MUTED } from "@/lib/platformStyles";

const TONE_STATE = {
  warn: "waiting",
  ok: "settled",
  bad: "blocked",
};

/** Uniform section card — DS v2 paper + 3px top status edge (same family as طلباتي). */
export default function OpsTaskSection({ title, hint, count, aside, tone, children }) {
  const stateId = TONE_STATE[tone] || null;
  const frame = stateId
    ? docFrame(stateId)
    : {
        background: "var(--nv-inset, var(--nv-soft))",
        border: "1px solid var(--nv-line)",
        borderRadius: 14,
        boxShadow: "none",
      };
  const titleColor = stateId
    ? `var(--nv-${DS_STATES[stateId].token}-ink)`
    : "var(--nv-ink)";

  return (
    <section
      data-nv-task-section
      data-nv-state={stateId || "void"}
      style={{
        ...frame,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        flexShrink: 0,
      }}
    >
      {(title || hint || count != null || aside) && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title ? (
              <div style={{ fontSize: 12, fontWeight: 650, color: titleColor, letterSpacing: "0.01em" }}>{title}</div>
            ) : null}
            {hint ? (
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, marginTop: 4 }}>{hint}</div>
            ) : null}
          </div>
          {count != null && (
            <span
              dir="ltr"
              style={{
                fontSize: 11,
                color: MUTED,
                fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {count}
            </span>
          )}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
