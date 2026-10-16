import React from "react";
import { StatusFlag } from "@/components/shared/StatusFlag";
import { chip, mono, sourceBadge, statusTone } from "@/components/schedules/scheduleChrome";

/**
 * The three ministry sources — 18632 / 3337 / نظام العمل — as one balanced row of cards.
 * Shared by «أنظمة الوزارة والتنبيهات» (management) and «أنظمة الوزارة — ما يحميك» (employee, file).
 * Three equal columns while the slab is wide; one column once it is narrow (container query,
 * so the same card works in a full page, a side column, or a phone).
 */
const CARDS_CSS = `
.nv-ministry-cards-wrap { container-type: inline-size; min-width: 0; }
.nv-ministry-cards { display: grid; grid-template-columns: repeat(var(--nv-mc-cols, 3), minmax(0, 1fr)); gap: 10px; align-items: stretch; }
.nv-ministry-card { transition: border-color .15s ease, box-shadow .15s ease; }
.nv-ministry-card:hover { border-color: var(--nv-ink3, #94A3B8); }
.nv-ministry-card:focus-visible { outline: 2px solid var(--nv-navy); outline-offset: 2px; }
@container (max-width: 640px) {
  .nv-ministry-cards { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .nv-ministry-card { transition: none; } }
`;

export const MINISTRY_SOURCE_KEYS = ["18632", "3337", "labour"];

export function ministrySourceLabel(source, ar = true) {
  if (source === "18632") return "18632";
  if (source === "3337") return "3337";
  if (source === "labour") return ar ? "نظام العمل" : "Labour Law";
  return ar ? "الكل" : "All";
}

/** Short badge on a card / row — the decision number, or م/51 for the Labour Law. */
export function ministryBadgeText(source, ar = true) {
  if (source === "labour") return ar ? "م/51" : "M/51";
  return source;
}

export function ministryBadgeStyle(source, ar = true, extra = {}) {
  return sourceBadge(source === "labour" && ar ? { direction: "rtl", ...extra } : extra);
}

/** Arabic badge text reads in the platform face — a monospace font pulls Arabic letters apart. */
function badgeFace(text) {
  return /[\u0600-\u06FF]/.test(String(text || "")) ? { fontFamily: "inherit", direction: "rtl", letterSpacing: 0 } : {};
}

export function Counter({ value, label, tone, size = 15 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, whiteSpace: "nowrap" }}>
      <strong dir="ltr" style={{ ...mono, fontSize: size, fontWeight: 700, color: value ? `var(--nv-${tone}-ink)` : "var(--nv-ink3, var(--nv-muted))" }}>{value}</strong>
      <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{label}</span>
    </span>
  );
}

/**
 * cards: [{ key, title, scope, block, warn, settled, tone }]
 * active: the selected source key or "all"; onPick(key) toggles.
 */
export default function MinistrySourceCards({ cards = [], active = "all", onPick, ar = true, settledLabel, style }) {
  return (
    <div className="nv-ministry-cards-wrap" style={{ "--nv-mc-cols": Math.min(3, Math.max(1, cards.length)), ...style }}>
      <style>{CARDS_CSS}</style>
      <div className="nv-ministry-cards" data-source-cards="1">
        {cards.map((card) => {
          const on = active === card.key;
          return (
            <button
              key={card.key}
              type="button"
              className="nv-ministry-card"
              data-source-card={card.key}
              data-tone={card.tone}
              aria-pressed={on}
              onClick={() => onPick?.(on ? "all" : card.key)}
              title={on ? (ar ? "اضغط لعرض الكل" : "Click to show all") : (ar ? "اضغط لتصفية هذا المصدر" : "Click to filter this source")}
              style={{
                fontFamily: "inherit",
                textAlign: "start",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "14px 14px 12px",
                minWidth: 0,
                height: "100%",
                boxSizing: "border-box",
                background: "var(--nv-card, #fff)",
                color: "var(--nv-ink)",
                border: `1px solid ${on ? "var(--nv-navy)" : "var(--nv-line, #E2E8F0)"}`,
                borderRadius: "var(--nv-radius, 12px)",
                boxShadow: on ? "0 0 0 1px var(--nv-navy)" : "none",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                <span style={ministryBadgeStyle(card.badge ? "" : card.key, ar, badgeFace(card.badge || ministryBadgeText(card.key, ar)))}>{card.badge || ministryBadgeText(card.key, ar)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.45, minWidth: 0 }}>{card.title}</span>
                <StatusFlag tone={card.tone} ar={ar} flag={card.tone === "bad" ? (ar ? "مانع قائم" : "Blocker open") : card.tone === "warn" ? (ar ? "تنبيه قائم" : "Alert open") : ""} />
              </span>
              <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7, flex: "1 1 auto" }}>{card.scope}</span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  paddingTop: 8,
                  borderTop: "1px solid var(--nv-line2, #EEF2F7)",
                }}
              >
                {card.counters ? card.counters : (<>
                <Counter value={card.block} label={ar ? "مانع" : "block"} tone="bad" />
                {card.violation ? <Counter value={card.violation} label={ar ? "مخالفة" : "violation"} tone="bad" /> : null}
                <Counter value={card.warn} label={ar ? "تنبيه" : "alert"} tone="warn" />
                <Counter value={card.settled} label={settledLabel || (ar ? "مستوفى" : "settled")} tone="ok" />
                </>)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Source filter chips under the cards — «الكل» resets. */
export function MinistrySourceTabs({ active = "all", onPick, ar = true, chipButton, counts }) {
  return (
    <div
      role="tablist"
      aria-label={ar ? "مصدر الفحص" : "Check source"}
      style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}
    >
      {["all", ...MINISTRY_SOURCE_KEYS].map((key) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={active === key}
          onClick={() => onPick?.(key)}
          style={chipButton(active === key)}
        >
          {ministrySourceLabel(key, ar)}
          {counts && Number.isFinite(counts[key]) ? (
            <span dir="ltr" style={{ ...mono, fontSize: 10, opacity: 0.75 }}>{counts[key]}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** One law row — source badge · plain title + note · status chip. Same geometry on every surface. */
export function MinistryRow({ source, badge, status, pill, title, note, sub, compact = false, ar = true, rowKey, clause, action }) {
  const tone = statusTone(status);
  return (
    <div
      data-ministry-row={rowKey || undefined}
      data-status={status}
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0,1fr) auto",
        alignItems: compact ? "center" : "start",
        gap: 10,
        padding: compact ? "7px 18px" : "10px 18px",
        borderBottom: "1px solid var(--nv-line2, #EEF2F7)",
        minWidth: 0,
      }}
    >
      <span style={ministryBadgeStyle(badge ? "" : source, ar, badgeFace(badge || ministryBadgeText(source, ar)))}>{badge || ministryBadgeText(source, ar)}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: compact ? 12 : 12.5, fontWeight: compact ? 500 : 600, color: compact ? "var(--nv-ink2)" : "var(--nv-ink)", lineHeight: 1.55, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: compact ? "nowrap" : "normal" }}>
          {title}
          {clause ? <span style={{ fontWeight: 500, color: "var(--nv-muted)" }}>{` — ${clause}`}</span> : null}
        </span>
        {!compact && note ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>{note}</span> : null}
        {sub ? <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.5 }}>{sub}</span> : null}
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, minWidth: 0, maxWidth: "100%" }}>
        <span style={chip(tone, { fontWeight: 600 })} title={typeof pill === "string" ? pill : undefined}>{pill}</span>
        {action || null}
      </span>
    </div>
  );
}
