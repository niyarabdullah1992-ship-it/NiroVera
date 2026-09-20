import React from "react";

const NASKH = "'Noto Naskh Arabic', 'Amiri', serif";
const MONO = "'IBM Plex Mono', monospace";

export const PERF_LINE = "#dfe3ea";
export const PERF_SOFT = "#eef0f4";
export const PERF_NAVY = "#14213d";
export const PERF_INK = "#14213d";
export const PERF_MUTED = "#6b7280";
export const PERF_BODY = "#4b5567";
export const PERF_GREEN = "#137a49";
export const PERF_SURFACE = "#fafbfc";
export const PERF_WHITE = "#fff";

export function perfTab(on) {
  return {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: on ? 700 : 400,
    padding: "9px 16px",
    border: `1px solid ${on ? PERF_NAVY : PERF_LINE}`,
    background: on ? PERF_NAVY : PERF_WHITE,
    color: on ? "#fff" : PERF_BODY,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    borderRadius: 10,
  };
}

export function perfBtn(on = false, fill = false) {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    fontWeight: 600,
    padding: "8px 13px",
    border: fill ? "none" : `1px solid ${on ? PERF_NAVY : PERF_LINE}`,
    background: fill ? PERF_GREEN : (on ? PERF_NAVY : PERF_WHITE),
    color: fill || on ? "#fff" : PERF_INK,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: 10,
  };
}

function KickerLine({ kicker }) {
  const parts = String(kicker || "").split("·").map((part) => part.trim()).filter(Boolean);
  const index = parts[0] || "";
  const rest = parts.slice(1).join(" · ");
  return (
    <span style={{ fontSize: 11, letterSpacing: ".14em", color: PERF_MUTED, display: "flex", gap: 7, alignItems: "center" }}>
      {index ? <span dir="ltr" style={{ fontFamily: MONO }}>{index}</span> : null}
      {rest ? <span>·</span> : null}
      <span>{rest || kicker}</span>
    </span>
  );
}

/** HTML-faithful performance chrome — one flush stack, sharp slabs, comparison first. */
export default function PerformanceSectionFrame({
  ar,
  kicker,
  title,
  hint,
  range,
  tabs = [],
  tool,
  onTool,
  children,
}) {
  return (
    <div
      className="nv-perf-frame"
      dir={ar ? "rtl" : "ltr"}
      style={{
        width: "min(1320px, 100%)",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        color: PERF_INK,
        fontSize: 13,
        fontFamily: "'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif",
      }}
    >
      <style>{`@media (max-width: 920px) { .nv-perf-head { flex-wrap: wrap; } }`}</style>
      <section
        className="nv-perf-head"
        style={{
          background: PERF_WHITE,
          border: `1px solid ${PERF_LINE}`,
          padding: "18px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 18,
          flexWrap: "nowrap",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          <KickerLine kicker={kicker} />
          <h1 style={{ margin: 0, fontFamily: NASKH, fontSize: 24, fontWeight: 600, color: PERF_INK, lineHeight: 1.35 }}>
            {title}
          </h1>
          {hint ? (
            <p style={{ margin: 0, fontSize: 12, color: PERF_BODY, lineHeight: 1.85, maxWidth: 820 }}>{hint}</p>
          ) : null}
        </div>
        {range}
      </section>

      {tabs.length ? (
        <div
          className="nv-perf-tabs"
          style={{
            background: PERF_WHITE,
            border: `1px solid ${PERF_LINE}`,
            borderTop: "none",
            padding: "9px 14px",
            display: "flex",
            gap: 5,
            flexWrap: "wrap",
            alignItems: "center",
            boxSizing: "border-box",
          }}
        >
          {tabs.map((item) => {
            const on = tool === item.value;
            return (
              <button key={item.value} type="button" onClick={() => onTool?.(item.value)} style={perfTab(on)}>
                {item.num ? (
                  <span dir="ltr" style={{ fontFamily: MONO, fontSize: 10, opacity: 0.75 }}>{item.num}</span>
                ) : null}
                {item.label}
                {item.count > 0 ? (
                  <span
                    dir="ltr"
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      background: on ? "#1d9a5b" : "#f5f6f8",
                      color: on ? "#fff" : PERF_BODY,
                      padding: "1px 7px",
                    }}
                  >
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {children}
    </div>
  );
}
