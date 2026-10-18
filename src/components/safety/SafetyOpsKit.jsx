import React from "react";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";

export const safetyShell = {
  background: "var(--nv-card)",
  border: "1px solid var(--nv-line)",
  borderRadius: 12,
  boxShadow: "0 1px 2px rgba(12,20,16,.04)",
  overflow: "hidden",
};

function toneInk(tone) {
  if (tone === "bad") return "var(--nv-bad-ink, #9B2335)";
  if (tone === "warn") return "var(--nv-warn-ink, #8A5A12)";
  if (tone === "ok") return "var(--nv-ok-ink, #3C7D50)";
  return "var(--nv-ink)";
}

/** One row of figures — label, mono value, the line that says what it means. Status colour is meaning only. */
export function SafetyKpiRow({ items = [], dataKey }) {
  return (
    <div data-safety-kpis={dataKey || ""} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 10 }}>
      {items.map((item) => (
        <div key={item.label} data-kpi={item.key || item.label} style={{ ...safetyShell, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11.5, color: "var(--nv-ink3)" }}>{item.label}</span>
          <strong dir="ltr" style={{ font: `700 22px ${MONO}`, textAlign: "start", color: toneInk(item.tone), unicodeBidi: "isolate" }}>
            {item.value == null || item.value === "" ? "—" : item.value}
          </strong>
          <span style={{ fontSize: 11, color: "var(--nv-ink3)", lineHeight: 1.55 }}>{item.sub || "—"}</span>
        </div>
      ))}
    </div>
  );
}

/** A card with a title row (and an optional trailing note) over its body. */
export function SafetyPanel({ title, note, trailing, children, dataKey, pad = true }) {
  return (
    <section data-safety-panel={dataKey || ""} style={safetyShell}>
      <header style={{ padding: "12px 16px", borderBottom: "1px solid var(--nv-line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <strong style={{ fontSize: 13.5, color: "var(--nv-ink)" }}>{title}</strong>
          {note ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.6 }}>{note}</span> : null}
        </span>
        {trailing || null}
      </header>
      <div style={pad ? { padding: "14px 16px" } : undefined}>{children}</div>
    </section>
  );
}
