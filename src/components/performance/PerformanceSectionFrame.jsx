import React from "react";
import Nv7SectionHead, { nv7Tab } from "@/components/shared/Nv7SectionHead";

const NASKH = "'Noto Naskh Arabic', 'Amiri', serif";
const MONO = "'IBM Plex Mono', monospace";

/** Theme tokens — navy fill stays dark so light labels stay readable. */
export const PERF_LINE = "var(--nv-line)";
export const PERF_SOFT = "var(--nv-line3)";
export const PERF_NAVY = "var(--nv-navy)";
export const PERF_INK = "var(--nv-ink)";
export const PERF_MUTED = "var(--nv-muted)";
export const PERF_BODY = "var(--nv-ink2)";
export const PERF_GREEN = "var(--nv-ok-ink)";
export const PERF_SURFACE = "var(--nv-soft)";
export const PERF_WHITE = "var(--nv-card)";
const PERF_ON = "var(--nv-btn-ink)";

export function perfTab(on) {
  return {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: on ? 700 : 400,
    padding: "9px 16px",
    border: `1px solid ${on ? PERF_NAVY : PERF_LINE}`,
    background: on ? PERF_NAVY : PERF_WHITE,
    color: on ? PERF_ON : PERF_BODY,
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
    background: fill ? "var(--nv-ok-fill)" : (on ? PERF_NAVY : PERF_WHITE),
    color: fill || on ? PERF_ON : PERF_INK,
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
      <Nv7SectionHead
        kicker={kicker}
        title={title}
        hint={hint}
        meta={range}
        tabs={tabs.length ? (
          <div className="nv-perf-tabs" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {tabs.map((item) => {
              const on = tool === item.value;
              return (
                <button key={item.value} type="button" onClick={() => onTool?.(item.value)} style={nv7Tab(on)}>
                  {item.label}
                  {item.count > 0 ? (
                    <span dir="ltr" style={{ fontFamily: MONO, fontSize: 10.5, background: on ? "#0B3D27" : "rgba(255,255,255,.24)", color: "#fff", padding: "1px 6px", borderRadius: 3 }}>
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      />

      {children}
    </div>
  );
}
