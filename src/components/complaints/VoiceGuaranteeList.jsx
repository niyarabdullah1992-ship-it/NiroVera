import React from "react";

/** Channel guarantees. Separators are the platform line, in light and night. */
export default function VoiceGuaranteeList({ rows = [], ar }) {
  return (
    <section style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--nv-paper)" }}>
      <header style={{ padding: "14px 16px", borderBottom: "1px solid var(--nv-line)" }}>
        <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{ar ? "ما تضمنه لك القناة" : "What the channel guarantees"}</strong>
      </header>
      {rows.map((row, index) => (
        <div
          key={row.tag}
          style={{
            padding: "12px 16px",
            borderBottom: index === rows.length - 1 ? "none" : "1px solid var(--nv-line)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-warn-ink)" }}>{row.tag}</span>
          <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.65 }}>{row.t}</span>
        </div>
      ))}
    </section>
  );
}
