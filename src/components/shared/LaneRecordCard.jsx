import React, { useState } from "react";

const MONO = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontVariantNumeric: "tabular-nums",
  direction: "ltr",
  unicodeBidi: "isolate",
};

const TONE = {
  ok: { edge: "#3C7D50", pill: "#E6F2EA", ink: "#2F6B43", bar: "#3C7D50" },
  warn: { edge: "#C8A45A", pill: "#FBF3E1", ink: "#8A5A12", bar: "#C8A45A" },
  bad: { edge: "#9B2335", pill: "#FBEBED", ink: "#9B2335", bar: "#9B2335" },
  neutral: { edge: "#0B3D27", pill: "#F4F7F5", ink: "#3A4048", bar: "#3C7D50" },
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
        border: `1px solid ${hover ? "#C5DBCD" : "#E4E9E6"}`,
        borderTop: `3px solid ${paint.edge}`,
        background: fresh ? "#F2F7F4" : hover ? "#F7FBF8" : "#FFFFFF",
        boxShadow: hover
          ? "0 10px 24px rgba(6,61,38,.08)"
          : "0 1px 2px rgba(12,20,16,.04)",
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
              background: markGold ? "#FBF3E1" : "#0B3D27",
              color: markGold ? "#8A5A12" : "#FBF3E1",
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
                color: "#111418",
                letterSpacing: 0,
              }}
            >
              {title || "—"}
            </h3>
            {badge ? (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#2F6B43",
                background: "#E6F2EA",
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
              <span dir="ltr" style={{ ...MONO, fontSize: 11, color: "#555C66" }}>{refId}</span>
            ) : null}
            {items.map((item) => (
              <span
                key={item}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: String(item).includes("خارج النطاق") || String(item).includes("Outside range") ? "#9B2335" : "#3A4048",
                  background: String(item).includes("خارج النطاق") || String(item).includes("Outside range") ? "#FBEBED" : "#F4F7F5",
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
                background: "#F4F7F5",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: "#8E9A93" }}>{fact.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span
                  dir={fact.mono ? "ltr" : undefined}
                  style={{
                    fontSize: 12.5,
                    fontWeight: 650,
                    color: fact.tone === "bad" ? "#9B2335" : fact.tone === "warn" ? "#8A5A12" : "#111418",
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
          color: "#9B2335",
          background: "#FBEBED",
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
              <span style={{ fontSize: 11, color: "#8E9A93", fontWeight: 700 }}>{progress.label}</span>
            ) : null}
            <span dir="ltr" style={{ ...MONO, fontSize: 13, fontWeight: 700, color: "#111418" }}>
              {progress.count || `${progress.done ?? 0}/${progress.target ?? 1}`}
            </span>
            <span dir="ltr" style={{ ...MONO, fontSize: 12, fontWeight: 600, color: "#8E9A93" }}>{`${pct}%`}</span>
            {progress.extra ? (
              <span style={{ fontSize: 11, color: "#555C66", fontWeight: 700 }}>{progress.extra}</span>
            ) : null}
          </div>
          <span style={{ display: "block", height: 6, borderRadius: 999, background: "#E6F2EA", overflow: "hidden" }}>
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
            borderTop: "1px solid #EEF1EF",
          }}
        >
          {actions}
        </div>
      ) : null}
    </article>
  );
}
