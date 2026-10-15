import React from "react";
import { DS_CONTROL_RADIUS, DS_RADIUS, DS_SHADOW } from "@/lib/designSystem";

/**
 * One chrome for every جدول الدوام surface.
 * Panel = slab (card fill, 1px line, shell radius). Section head = 15/700 + 12 muted note.
 * Chip = 24px tall, control radius, 1px border, tone from the ok/warn/bad/mute families.
 * Status never fills a card — it sits in a small chip beside the label (warn/bad only) or on the number.
 */
export const slab = {
  background: "var(--nv-card, #fff)",
  border: "1px solid var(--nv-line, #E2E8F0)",
  borderRadius: DS_RADIUS,
  boxShadow: DS_SHADOW,
  minWidth: 0,
};

export const mono = {
  fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
  fontVariantNumeric: "tabular-nums",
};

export const TONE_TOKEN = { ok: "ok", warn: "warn", bad: "bad", mute: "mute" };

export function toneVar(tone, degree) {
  const token = TONE_TOKEN[tone] || "mute";
  return `var(--nv-${token}-${degree})`;
}

/** Map a law-gate / week-check status onto the four tone families. */
export function statusTone(status) {
  if (status === "blocked" || status === "violation") return "bad";
  if (status === "waiting" || status === "alert" || status === "coming") return "warn";
  if (status === "settled") return "ok";
  return "mute";
}

export function chip(tone = "mute", extra = {}) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 24,
    boxSizing: "border-box",
    padding: "0 9px",
    borderRadius: DS_CONTROL_RADIUS,
    border: `1px solid ${toneVar(tone, "line")}`,
    background: toneVar(tone, "soft"),
    color: toneVar(tone, "ink"),
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: "nowrap",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    letterSpacing: 0,
    textAlign: "start",
    unicodeBidi: "plaintext",
    ...extra,
  };
}

/** Chip-shaped button — same geometry as `chip`, on/off is navy, never a status colour. */
export function chipButton(on = false, extra = {}) {
  return {
    ...chip("mute", {
      fontFamily: "inherit",
      cursor: "pointer",
      border: `1px solid ${on ? "var(--nv-navy)" : "var(--nv-line, #E2E8F0)"}`,
      background: on ? "var(--nv-navy)" : "var(--nv-card, #fff)",
      color: on ? "var(--nv-btn-ink, #fff)" : "var(--nv-ink2, #334155)",
      fontWeight: on ? 700 : 500,
    }),
    ...extra,
  };
}

/** Mono source badge — 18632 / 3337 / 98 … — mute family only, never a status. */
export function sourceBadge(extra = {}) {
  return chip("mute", {
    ...mono,
    minWidth: 34,
    justifyContent: "center",
    padding: "0 7px",
    fontSize: 10,
    fontWeight: 600,
    flexShrink: 0,
    direction: "ltr",
    unicodeBidi: "isolate",
    background: "var(--nv-soft, #F7F8FA)",
    color: "var(--nv-ink2, #334155)",
    border: "1px solid var(--nv-line, #E2E8F0)",
    ...extra,
  });
}

export const headTitle = { fontSize: 15, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.4, letterSpacing: 0 };
export const headNote = { fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.65, letterSpacing: 0 };

export function SectionHead({ title, note, trailing, as: Tag = "div", style }) {
  return (
    <Tag
      style={{
        padding: "14px 18px",
        borderBottom: "1px solid var(--nv-line2, #EEF2F7)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 160px" }}>
        <span style={headTitle}>{title}</span>
        {note ? <span style={headNote}>{note}</span> : null}
      </div>
      {trailing ? <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>{trailing}</div> : null}
    </Tag>
  );
}

/** Row inside a panel: 12px padding, hairline below, no own box. */
export const row = {
  padding: "11px 18px",
  borderBottom: "1px solid var(--nv-line2, #EEF2F7)",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

/**
 * Collapsible group inside a slab — native <details>, so no motion to tame.
 * Summary = 13/700 title + 12 muted note + chevron.
 */
export function Collapsible({ title, note, defaultOpen = false, open, onToggle, children, trailing, id, dataAttr }) {
  const controlled = typeof open === "boolean";
  return (
    <details
      id={id}
      className="nv-sched-fold"
      data-fold={dataAttr || undefined}
      {...(controlled ? { open } : { open: defaultOpen || undefined })}
      onToggle={controlled && onToggle ? (event) => onToggle(event.currentTarget.open) : undefined}
      style={{ borderBottom: "1px solid var(--nv-line2, #EEF2F7)", minWidth: 0 }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
          userSelect: "none",
        }}
      >
        <span className="nv-sched-fold-chevron" aria-hidden style={{ fontSize: 11, color: "var(--nv-muted)", flexShrink: 0 }}>▸</span>
        <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: "1 1 auto" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)", letterSpacing: 0 }}>{title}</span>
          {note ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.55 }}>{note}</span> : null}
        </span>
        {trailing ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexShrink: 0 }}>{trailing}</span> : null}
      </summary>
      <div style={{ padding: "0 0 4px" }}>{children}</div>
    </details>
  );
}

export function prefersReducedMotion() {
  try {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  } catch {
    return false;
  }
}

/** Quiet text action — underline, muted; used for every row action in the schedule. */
export function quietAction(extra = {}) {
  return {
    fontFamily: "inherit",
    fontSize: 11.5,
    fontWeight: 600,
    padding: "2px 0",
    border: "none",
    background: "transparent",
    color: "var(--nv-ink2, #334155)",
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 3,
    textDecorationColor: "var(--nv-line, #E2E8F0)",
    display: "inline-flex",
    alignItems: "center",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    letterSpacing: 0,
    ...extra,
  };
}

/** Small ghost button — outline control, used for secondary panel actions. */
export function ghostButton(extra = {}) {
  return {
    fontFamily: "inherit",
    fontSize: 11.5,
    fontWeight: 600,
    padding: "5px 10px",
    border: "1px solid var(--nv-line, #E2E8F0)",
    borderRadius: DS_CONTROL_RADIUS,
    background: "var(--nv-card, #fff)",
    color: "var(--nv-ink, #14284B)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    ...extra,
  };
}
