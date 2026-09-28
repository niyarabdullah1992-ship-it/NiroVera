import React from "react";

export default function VoiceChainBoard({ chain = [], note, ar }) {
  return (
    <section style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, boxShadow: "var(--nv-paper)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingBottom: 10, borderBottom: "1px solid var(--nv-line)", marginBottom: 6 }}>
        <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{ar ? "سلسلة المراجعة" : "Review chain"}</strong>
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>{note || "—"}</span>
      </div>
      {chain.length === 0 ? (
        <span style={{ fontSize: 12, color: "var(--nv-muted)", padding: "8px 0" }}>—</span>
      ) : chain.map((step, index) => {
        const current = index === 0;
        const status = current ? (ar ? "الآن" : "Now") : index === 1 ? (ar ? "التالي" : "Next") : "—";
        return (
          <div key={step.num || step.name} style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "9px 0" }}>
            <span style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 700,
              fontSize: 11,
              background: current ? "#3C7D50" : "var(--nv-card)",
              color: current ? "#fff" : "var(--nv-ink2)",
              border: current ? "1px solid #3C7D50" : "1px solid var(--nv-line)",
            }}
            >
              {index + 1}
            </span>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{step.name || "—"}</strong>
              <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>
                {current ? (ar ? "المستوى الأول" : "First level") : (ar ? "عند تجاوز المهلة" : "When the window is missed")}
              </span>
            </div>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              height: 22,
              padding: "0 9px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              color: current ? "var(--nv-ok-ink)" : "var(--nv-muted)",
              background: current ? "var(--nv-ok-soft)" : "var(--nv-soft)",
            }}
            >
              {status}
            </span>
          </div>
        );
      })}
    </section>
  );
}
