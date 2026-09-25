import React from "react";

/** v7 section header: deep-green card, gold dash, white title, tabs on the green. */
export function nv7Tab(on) {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 34,
    minWidth: 96,
    padding: "0 14px",
    borderRadius: 7,
    fontSize: 12.5,
    cursor: "pointer",
    border: on ? "none" : "1px solid rgba(255,255,255,.35)",
    background: on ? "#FFFFFF" : "transparent",
    color: on ? "#0B3D27" : "#FFFFFF",
    fontWeight: on ? 700 : 500,
    boxShadow: on ? "0 1px 2px rgba(12,20,16,.12)" : "none",
    whiteSpace: "nowrap",
  };
}

export default function Nv7SectionHead({ kicker, title, hint, meta, tabs }) {
  const parts = String(kicker || "").split("·").map((part) => part.trim()).filter(Boolean);
  const index = parts[0] || "";
  const rest = parts.slice(1).join(" · ");
  return (
    <header
      className="nv7-section-head"
      style={{
        background: "linear-gradient(135deg,#0B3D27 0%,#0F5535 100%)",
        borderRadius: 12,
        padding: "14px 18px",
        boxShadow: "0 6px 18px rgba(6,61,38,.16)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        color: "#fff",
        textAlign: "start",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
          {kicker ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#A9CDB8", fontWeight: 600, fontSize: 10.5 }}>
              <span aria-hidden style={{ width: 12, height: 2, background: "#C8A45A", display: "inline-block" }} />
              {index ? <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{index}</span> : null}
              {rest ? <span>{rest}</span> : (!index ? <span>{kicker}</span> : null)}
            </span>
          ) : null}
          <h1 className="nv-h" style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1.35 }}>{title}</h1>
          {hint ? (
            <div style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: "#C5DBCD", maxWidth: 680 }}>{hint}</div>
          ) : null}
        </div>
        {meta ? <div style={{ flexShrink: 0, color: "#C5DBCD", fontSize: 12 }}>{meta}</div> : null}
      </div>
      {tabs || null}
    </header>
  );
}
