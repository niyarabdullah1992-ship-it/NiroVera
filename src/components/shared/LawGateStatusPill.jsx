import React from "react";
import { lawGatePillLabel, lawGatePillStyle } from "@/lib/lawGateStatus";
import { DS_PILL_RADIUS } from "@/lib/designSystem";

/** Soft meaning pill — Design System v2 soft + 1px + 999. */
export default function LawGateStatusPill({
  status = "void",
  label,
  who = "",
  detail = "",
  ar = true,
  style,
}) {
  const text = label || lawGatePillLabel(status, { ar, who, detail });
  return (
    <span
      data-law-gate-pill={status}
      title={text}
      style={lawGatePillStyle(status, style)}
    >
      {text}
    </span>
  );
}

export function LawGateArticleBadge({ article, style }) {
  const code = String(article || "").trim();
  if (!code) return null;
  return (
    <span
      data-law-gate-article={code}
      dir="ltr"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 28,
        height: 28,
        padding: "0 7px",
        borderRadius: DS_PILL_RADIUS,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
        background: "var(--nv-soft, #F7F8FA)",
        color: "var(--nv-ink2, #334155)",
        border: "1px solid var(--nv-line, #E2E8F0)",
        flexShrink: 0,
        ...style,
      }}
    >
      {code}
    </span>
  );
}

/** Soft platform-ops chip — not a Labour Law or ministerial cite. */
export function LawGatePlatformBadge({ ar = true, style }) {
  return (
    <span
      data-law-gate-platform="1"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 22,
        padding: "0 8px",
        borderRadius: DS_PILL_RADIUS,
        fontSize: 10,
        fontWeight: 700,
        background: "var(--nv-mute-soft, #F5F6F8)",
        color: "var(--nv-mute-ink, #4B5567)",
        border: "1px solid var(--nv-mute-line, #DFE3EA)",
        flexShrink: 0,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {ar ? "منصة" : "Platform"}
    </span>
  );
}
