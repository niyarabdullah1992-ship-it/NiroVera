/**
 * Workforce / org chrome — the platform's chrome, not a second one.
 * Cards = slab geometry (--nv-card, 1px --nv-line, radius 12, DS_SHADOW); chips = scheduleChrome chip;
 * figures in IBM Plex Mono (Latin digits); one green accent for "me"/selection; tokens only (dark mode flips).
 */

import React from "react";
import { chip, chipButton, mono } from "@/components/schedules/scheduleChrome";

export const ORG_MONO = mono;

/** A grade code (م3 · G4 …) — a quiet mute chip with the code in mono. */
export function gradeBadge(extra = {}) {
  return chip("mute", { ...mono, fontSize: 10.5, height: 20, padding: "0 6px", direction: "ltr", unicodeBidi: "isolate", justifyContent: "center", minWidth: 28, ...extra });
}

export function OrgLockMark({ size = 18, icon = 11, title = "وحدة ثابتة" }) {
  return (
    <span
      title={title}
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size > 20 ? 8 : 5,
        background: "var(--nv-soft)",
        border: "1px solid var(--nv-line)",
        color: "var(--nv-ink2)",
        flex: "none",
      }}
    >
      <svg width={icon} height={icon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="10" height="7" rx="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        <circle cx="8" cy="10.5" r=".6" fill="currentColor" />
      </svg>
    </span>
  );
}

/** Filter chip (platform chipButton; on = navy). */
export function orgKindChip(on = false) {
  return chipButton(on, { fontSize: 11 });
}

/**
 * One fold row inside a slab — chevron · 13/700 title · muted note on the start side, a mono
 * meta on the end side; the body opens below with the slab's 18px gutter. Same rhythm as the
 * schedule's Collapsible, kept controlled so the summary links can open a fold from afar.
 */
export function OrgCollapsibleArticle({
  title,
  meta,
  extra,
  open,
  onToggle,
  children,
  articleStyle,
}) {
  return (
    <article style={{ borderBottom: "1px solid var(--nv-line2, var(--nv-line))", minWidth: 0, ...articleStyle }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", flexWrap: "wrap", minWidth: 0 }}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={Boolean(open)}
          style={{ all: "unset", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "inherit", color: "var(--nv-ink)", flex: "1 1 220px", minWidth: 0 }}
        >
          <span className="nv-org-fold-chevron" data-open={open ? "1" : "0"} aria-hidden style={{ fontSize: 11, color: "var(--nv-muted)", flex: "none" }}>▸</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 13, fontWeight: 700 }}>{title}</strong>
            {meta != null ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.55 }}>{meta}</span> : null}
          </span>
        </button>
        {extra ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{extra}</span> : null}
      </div>
      {open ? <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>{children}</div> : null}
    </article>
  );
}
