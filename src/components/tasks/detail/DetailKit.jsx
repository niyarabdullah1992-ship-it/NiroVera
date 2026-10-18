import React from "react";
import { Printer } from "lucide-react";

/**
 * The inside of a work order, a work proof, or a visitor pass: a dark-green head that says where
 * the record stands (state, the one number that matters, the next date), then plain facts as
 * label-over-value cells — no read-only input boxes pretending to be a form.
 */

export const DK = {
  bg: "linear-gradient(160deg, #0B3D27 0%, #0F5535 100%)",
  ink: "#fff",
  soft: "#C5DBCD",
  faint: "#A9CDB8",
  line: "rgba(255,255,255,.14)",
  gold: "#C8A45A",
  ok: "#7FD1A3",
  bad: "#F4A3A3",
};

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" };

const PILL = {
  ok: { bg: "rgba(127,209,163,.16)", ink: "#CFF0DC", line: "rgba(127,209,163,.4)" },
  warn: { bg: "rgba(200,164,90,.18)", ink: "#F3E3BC", line: "rgba(200,164,90,.5)" },
  bad: { bg: "rgba(244,163,163,.16)", ink: "#FBD5D5", line: "rgba(244,163,163,.45)" },
  mute: { bg: "rgba(255,255,255,.10)", ink: DK.soft, line: DK.line },
};

export function HeroPill({ tone = "mute", children, data, live = false }) {
  const p = PILL[tone] || PILL.mute;
  return (
    <span data-hero-pill={data} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: p.bg, color: p.ink, border: `1px solid ${p.line}`, whiteSpace: "nowrap" }}>
      {live ? <span aria-hidden className="nv-live-dot" style={{ width: 7, height: 7, borderRadius: 999, background: DK.gold }} /> : null}
      {children}
    </span>
  );
}

/** Dark head: kind label + pills + optional menu, then the big figure, then any extra (bar, rail), then mini facts. */
export function DetailHero({ kind, pills = null, menu = null, figure = null, aside = null, children = null, facts = [] }) {
  return (
    <section data-detail-hero="1" style={{ background: DK.bg, color: DK.ink, borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 8px 22px rgba(6,61,38,.18)", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 600, color: DK.faint }}>
          <span aria-hidden style={{ width: 12, height: 2, background: DK.gold, borderRadius: 8 }} />
          {kind}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginInlineStart: "auto" }}>
          {pills}
          {menu}
        </span>
      </div>
      {figure || aside ? (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: "1 1 200px" }}>{figure}</div>
          {aside ? <div style={{ flexShrink: 0 }}>{aside}</div> : null}
        </div>
      ) : null}
      {children}
      {facts.filter(Boolean).length ? (
        <dl className="nv-hero-facts" style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 0, borderTop: `1px solid ${DK.line}`, paddingTop: 12 }}>
          {facts.filter(Boolean).map((f, i) => (
            <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "0 12px", borderInlineStart: i ? `1px solid ${DK.line}` : "none", minWidth: 0 }}>
              <dt style={{ fontSize: 11, color: DK.faint }}>{f.label}</dt>
              <dd style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: f.tone === "bad" ? DK.bad : f.tone === "gold" ? "#F3E3BC" : DK.ink, ...(f.mono ? MONO : null), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

/** Print on the dark head — the record as one A4 sheet. */
export function HeroPrintButton({ onClick, ar = true, label }) {
  const text = label || (ar ? "طباعة" : "Print");
  return (
    <button
      type="button"
      data-hero-print="1"
      onClick={onClick}
      title={text}
      aria-label={text}
      style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.28)", background: "rgba(255,255,255,.06)", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
    >
      <Printer size={14} strokeWidth={2} aria-hidden />
      {text}
    </button>
  );
}

/** Big headline figure on the dark head: value + unit + one line under it. */
export function HeroFigure({ value, unit, line, lineTone, mono = true, placeholder = false }) {
  return (
    <>
      <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <strong data-hero-placeholder={placeholder ? "1" : undefined} style={{ ...(mono ? MONO : null), fontSize: 30, fontWeight: 700, lineHeight: 1.05, color: placeholder ? "rgba(255,255,255,.38)" : DK.ink }}>{value}</strong>
        {unit ? <span style={{ fontSize: 13, color: DK.soft }}>{unit}</span> : null}
      </span>
      {line ? <span style={{ fontSize: 12.5, fontWeight: 700, color: lineTone === "bad" ? DK.bad : lineTone === "warn" ? "#F3E3BC" : lineTone === "ok" ? "#CFF0DC" : DK.soft }}>{line}</span> : null}
    </>
  );
}

/** Progress on dark, with an optional mark where the record should be by now. */
export function HeroBar({ pct = 0, markPct = 0, markTitle = "", tone = "gold" }) {
  const fill = tone === "bad" ? DK.bad : tone === "ok" ? DK.ok : DK.gold;
  return (
    <span aria-hidden data-hero-bar="1" style={{ position: "relative", display: "block", height: 8, borderRadius: 999, background: "rgba(255,255,255,.14)" }}>
      <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: `${Math.min(100, Math.max(0, pct))}%`, borderRadius: 999, background: fill }} />
      {markPct > 0 && markPct < 100 ? (
        <span title={markTitle} style={{ position: "absolute", insetInlineStart: `calc(${markPct}% - 1px)`, top: -4, bottom: -4, width: 2, borderRadius: 2, background: "#fff" }} />
      ) : null}
    </span>
  );
}

/** One fact: small label over the value. In a FactGrid the cells line up as a table without boxes. */
export function Fact({ label, children, ltr = false, wide = false, multiline = false, tone }) {
  return (
    <div data-fact={label} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, gridColumn: wide ? "1 / -1" : undefined, padding: "10px 12px", borderRadius: 10, background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nv-muted)" }}>{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        style={{
          fontSize: 13.5,
          fontWeight: 650,
          color: tone === "bad" ? "var(--nv-bad-ink)" : "var(--nv-ink)",
          lineHeight: 1.6,
          whiteSpace: multiline ? "normal" : "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: ltr ? "end" : undefined,
          minWidth: 0,
        }}
      >
        {children == null || children === "" ? "—" : children}
      </span>
    </div>
  );
}

export function FactGrid({ children, min = 150 }) {
  return (
    <div data-fact-grid="1" style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 8 }}>
      {children}
    </div>
  );
}

const DOT_DARK = {
  done: { bg: DK.ok, border: DK.ok },
  partial: { bg: DK.gold, border: DK.gold },
  missed: { bg: "transparent", border: DK.bad },
  today: { bg: "transparent", border: DK.gold },
  off: { bg: "rgba(255,255,255,.14)", border: "rgba(255,255,255,.14)" },
};

/** The last seven days on the dark head, oldest first, with the weekday initials under them. */
export function HeroSevenDays({ days = [], ar = true }) {
  if (!days.length) return null;
  const names = ar ? ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"] : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return (
    <span data-hero-seven="1" style={{ display: "inline-flex", gap: 6 }}>
      {days.map((d) => {
        const dow = new Date(`${d.day}T12:00:00`).getDay();
        return (
          <span key={d.day} title={`${d.day.slice(8)}/${d.day.slice(5, 7)}${d.logged ? ` · ${d.logged}` : ""}`} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span data-day-state={d.state} style={{ width: 14, height: 14, borderRadius: 999, background: DOT_DARK[d.state].bg, border: `2px solid ${DOT_DARK[d.state].border}`, boxSizing: "border-box" }} />
            <span style={{ fontSize: 9.5, color: DK.faint }}>{names[dow]}</span>
          </span>
        );
      })}
    </span>
  );
}
