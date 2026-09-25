/**
 * Owner board chrome — Design System v2 (same law as /app stamps).
 * Document 14 · controls 10 · chips 999 · status on top 3px edge.
 * Nested inside PlatformStampShell — no second hero banner.
 */

import React from "react";
import { DS_CONTROL_RADIUS, DS_EDGE_PX, DS_PILL_RADIUS, DS_RADIUS, DS_SHADOW } from "@/lib/designSystem";
import { statusBanner } from "@/lib/platformStyles";

export const OWNER_MONO = { fontFamily: "'IBM Plex Mono', monospace" };

export const ownerStack = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

export const ownerGrid = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
};

export function ownerPaper(state = "mute") {
  const fill = state === "ok" ? "var(--nv-ok-fill)"
    : state === "warn" ? "var(--nv-warn-fill)"
      : state === "bad" ? "var(--nv-bad-fill)"
        : "var(--nv-line)";
  return {
    background: "var(--nv-card)",
    border: "1px solid var(--nv-line)",
    borderTop: `${DS_EDGE_PX}px solid ${fill}`,
    borderRadius: DS_RADIUS,
    boxShadow: DS_SHADOW,
    boxSizing: "border-box",
  };
}

export function ownerInset() {
  return {
    background: "var(--nv-inset, var(--nv-soft))",
    border: "1px solid var(--nv-line)",
    borderRadius: DS_CONTROL_RADIUS,
    padding: "10px 12px",
    boxSizing: "border-box",
  };
}

export function ownerField() {
  return {
    fontFamily: "inherit",
    width: "100%",
    padding: "9px 11px",
    fontSize: 13,
    color: "var(--nv-ink)",
    background: "var(--nv-card)",
    border: "1px solid var(--nv-line)",
    borderRadius: DS_CONTROL_RADIUS,
    boxSizing: "border-box",
  };
}

export function ownerPrimaryBtn() {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "9px 14px",
    fontSize: 13,
    fontWeight: 600,
    border: "none",
    borderRadius: DS_CONTROL_RADIUS,
    background: "var(--nv-accent)",
    color: "#fff",
    cursor: "pointer",
  };
}

export function ownerGhostBtn() {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid var(--nv-line)",
    borderRadius: DS_CONTROL_RADIUS,
    background: "var(--nv-card)",
    color: "var(--nv-ink)",
    cursor: "pointer",
  };
}

export function ownerChip(on) {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    padding: "6px 11px",
    border: `1px solid ${on ? "var(--nv-navy)" : "var(--nv-line)"}`,
    background: on ? "var(--nv-navy)" : "var(--nv-card)",
    color: on ? "var(--nv-btn-ink, #fff)" : "var(--nv-ink2)",
    fontWeight: on ? 700 : 400,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: DS_PILL_RADIUS,
  };
}

export function ownerStatusChip(state = "mute") {
  const bg = state === "ok" ? "var(--nv-ok-soft, color-mix(in oklab, var(--nv-accent) 12%, var(--nv-card)))"
    : state === "warn" ? "var(--nv-warn-soft)"
      : state === "bad" ? "var(--nv-bad-soft)"
        : "var(--nv-inset, var(--nv-soft))";
  const fg = state === "ok" ? "var(--nv-ok-ink, var(--nv-accent-deep))"
    : state === "warn" ? "var(--nv-warn-ink)"
      : state === "bad" ? "var(--nv-bad-ink, var(--nv-danger))"
        : "var(--nv-ink2)";
  const bd = state === "ok" ? "var(--nv-ok-line, var(--nv-accent-border))"
    : state === "warn" ? "var(--nv-warn-line)"
      : state === "bad" ? "var(--nv-bad-line)"
        : "var(--nv-line)";
  return {
    display: "inline-flex",
    width: "fit-content",
    padding: "3px 9px",
    borderRadius: DS_PILL_RADIUS,
    fontSize: 11,
    fontWeight: 600,
    background: bg,
    color: fg,
    border: `1px solid ${bd}`,
    whiteSpace: "nowrap",
  };
}

export function OwnerStatTile({ label, value, note, state = "mute", warn }) {
  const tone = warn ? "warn" : state;
  return (
    <div style={{ ...ownerPaper(tone), padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{label}</span>
      <span dir="ltr" style={{ ...OWNER_MONO, fontSize: 26, fontWeight: 500, color: warn ? "var(--nv-warn-ink)" : "var(--nv-ink)", lineHeight: 1.1 }}>
        {value}
      </span>
      {note ? <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.65 }}>{note}</span> : null}
    </div>
  );
}

/** Gate / save feedback — same soft warn banner as /app alerts (statusBanner). */
export function ownerGateBanner(gate, ar) {
  if (!gate || gate.ok) return null;
  return (
    <div style={{ ...statusBanner.warn, marginTop: 8 }}>
      {ar ? gate.reason : gate.reasonEn}
    </div>
  );
}

export function ownerOkBanner(text) {
  if (!text) return null;
  return (
    <div style={{ ...statusBanner.ok, marginTop: 8 }}>
      {text}
    </div>
  );
}

export function OwnerSectionHead({ kicker, title, meta, ar: _ar }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        {kicker ? <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--nv-muted)", letterSpacing: "0.02em" }}>{kicker}</p> : null}
        {title ? <h2 className="nv-h" style={{ margin: kicker ? "4px 0 0" : 0, fontSize: 16, fontWeight: 700, color: "var(--nv-ink)" }}>{title}</h2> : null}
      </div>
      {meta ? <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{meta}</div> : null}
    </div>
  );
}
