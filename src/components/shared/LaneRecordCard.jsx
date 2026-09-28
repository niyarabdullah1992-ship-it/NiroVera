import React, { useState } from "react";

const MONO = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontVariantNumeric: "tabular-nums",
  direction: "ltr",
  unicodeBidi: "isolate",
};

const TONE = {
  ok: { edge: "var(--nv-ok-fill)", pill: "var(--nv-ok-soft)", ink: "var(--nv-ok-ink)", bar: "var(--nv-ok-fill)" },
  warn: { edge: "var(--nv-warn-fill)", pill: "var(--nv-warn-soft)", ink: "var(--nv-warn-ink)", bar: "var(--nv-warn-fill)" },
  bad: { edge: "var(--nv-bad-fill)", pill: "var(--nv-bad-soft)", ink: "var(--nv-bad-ink)", bar: "var(--nv-bad-fill)" },
  neutral: { edge: "var(--nv-navy, #0B3D27)", pill: "var(--nv-soft)", ink: "var(--nv-ink2)", bar: "var(--nv-ok-fill)" },
};

function toneOf(name) {
  return TONE[name] || TONE.neutral;
}

/**
 * Shared list card for a work order, an outside-party proof, or a station guest.
 * Facts stay derived; the chrome is the same on all three lanes.
 */
export default function LaneRecordCard({
  title,
  refId,
  meta = [],
  badge,
  statusLabel,
  tone = "neutral",
  facts = [],
  progress,
  note,
  chips,
  mark,
  markGold = false,
  children,
  onOpen,
  actions,
  fresh = false,
  dataState,
}) {
  const [hover, setHover] = useState(false);
  const paint = toneOf(fresh ? "ok" : tone);
  const items = (Array.isArray(meta) ? meta : []).filter(Boolean);
  const pct = progress
    ? Math.min(100, Math.max(0, Number(progress.pct) || 0))
    : 0;

  return (
    <article
      role="button"
      tabIndex={0}
      data-nv-task-state={dataState || undefined}
      onClick={() => onOpen?.()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "14px 16px 12px",
        borderRadius: 14,
        borderTop: `3px solid ${paint.edge}`,
        borderRight: `1px solid ${hover ? "var(--nv-ok-line)" : "var(--nv-line)"}`,
        borderBottom: `1px solid ${hover ? "var(--nv-ok-line)" : "var(--nv-line)"}`,
        borderLeft: `1px solid ${hover ? "var(--nv-ok-line)" : "var(--nv-line)"}`,
        background: fresh ? "var(--nv-g1)" : hover ? "var(--nv-hover)" : "var(--nv-card)",
        boxShadow: hover
          ? "0 10px 24px var(--nv-shadow)"
          : "var(--nv-paper)",
        cursor: onOpen ? "pointer" : "default",
        textAlign: "start",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
        {mark ? (
          <span
            aria-hidden
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: markGold ? "var(--nv-warn-soft)" : "var(--nv-navy)",
              color: markGold ? "var(--nv-warn-ink)" : "#FBF3E1",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: markGold ? "inset 0 0 0 1px #E7D7A8" : "inset 0 0 0 1px rgba(200,164,90,.35)",
            }}
          >
            {mark}
          </span>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
            <h3
              style={{
                margin: 0,
                fontFamily: "var(--font-heading)",
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1.35,
                color: "var(--nv-ink)",
                letterSpacing: 0,
              }}
            >
              {title || "—"}
            </h3>
            {badge ? (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--nv-ok-ink)",
                background: "var(--nv-ok-soft)",
                borderRadius: 999,
                padding: "2px 8px",
              }}
              >
                {badge}
              </span>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
            {refId ? (
              <span dir="ltr" style={{ ...MONO, fontSize: 11, color: "var(--nv-ink3)" }}>{refId}</span>
            ) : null}
            {items.map((item) => (
              <span
                key={item}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: String(item).includes("خارج النطاق") || String(item).includes("Outside range") ? "var(--nv-bad-ink)" : "var(--nv-ink2)",
                  background: String(item).includes("خارج النطاق") || String(item).includes("Outside range") ? "var(--nv-bad-soft)" : "var(--nv-soft)",
                  borderRadius: 999,
                  padding: "2px 8px",
                  maxWidth: "100%",
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        {statusLabel ? (
          <span
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              height: 26,
              padding: "0 10px",
              borderRadius: 999,
              background: paint.pill,
              color: paint.ink,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>

      {facts.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          {facts.map((fact) => (
            <div
              key={fact.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                minWidth: 0,
                padding: "8px 10px",
                borderRadius: 8,
                background: "var(--nv-page)",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--nv-ink3)" }}>{fact.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span
                  dir={fact.mono ? "ltr" : undefined}
                  style={{
                    fontSize: 12.5,
                    fontWeight: 650,
                    color: fact.tone === "bad" ? "var(--nv-bad-ink)" : fact.tone === "warn" ? "var(--nv-warn-ink)" : "var(--nv-ink)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    ...(fact.mono ? MONO : null),
                  }}
                >
                  {fact.value || "—"}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {note ? (
        <span style={{
          alignSelf: "flex-start",
          maxWidth: "100%",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--nv-bad-ink)",
          background: "var(--nv-bad-soft)",
          borderRadius: 8,
          padding: "3px 8px",
        }}
        >
          {note}
        </span>
      ) : null}

      {chips ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{chips}</div> : null}

      {children}

      {progress ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            {progress.label ? (
              <span style={{ fontSize: 11, color: "var(--nv-ink3)", fontWeight: 700 }}>{progress.label}</span>
            ) : null}
            <span dir="ltr" style={{ ...MONO, fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>
              {progress.count || `${progress.done ?? 0}/${progress.target ?? 1}`}
            </span>
            <span dir="ltr" style={{ ...MONO, fontSize: 12, fontWeight: 600, color: "var(--nv-ink3)" }}>{`${pct}%`}</span>
            {progress.extra ? (
              <span style={{ fontSize: 11, color: "var(--nv-ink3)", fontWeight: 700 }}>{progress.extra}</span>
            ) : null}
          </div>
          <span style={{ display: "block", height: 6, borderRadius: 999, background: "var(--nv-ok-soft)", overflow: "hidden" }}>
            <span style={{ display: "block", width: `${pct === 0 ? 0 : pct}%`, height: "100%", borderRadius: 999, background: paint.bar }} />
          </span>
        </div>
      ) : null}

      {actions ? (
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            paddingTop: 10,
            borderTop: "1px solid var(--nv-line)",
          }}
        >
          {actions}
        </div>
      ) : null}
    </article>
  );
}
