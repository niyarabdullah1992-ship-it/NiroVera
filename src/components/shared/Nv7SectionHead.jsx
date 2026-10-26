import React from "react";
import { BORDER, CARD, MUTED, NAVY, NAVY_FILL } from "@/lib/platformStyles";

/**
 * v7 section header — the «طلباتي» identity for every section, both lanes:
 * one deep-green band holding only the numbered kicker, the title and one hint line.
 * Tabs, switches and figures never sit on the green; they live in one white strip under it.
 */
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
    border: on ? `1px solid ${NAVY_FILL}` : `1px solid ${BORDER}`,
    background: on ? NAVY_FILL : CARD,
    color: on ? "#FFFFFF" : NAVY,
    fontWeight: on ? 700 : 500,
    boxShadow: on ? "0 1px 2px rgba(12,20,16,.12)" : "none",
    whiteSpace: "nowrap",
  };
}

/** Count chip on a strip tab (mono). */
export function nv7Count(on) {
  return {
    fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
    fontSize: 10.5,
    padding: "1px 6px",
    borderRadius: 3,
    background: on ? "rgba(255,255,255,.22)" : NAVY_FILL,
    color: "#fff",
  };
}

/** The white strip under a band: figures first, then the section's tabs. */
export function Nv7Strip({ meta, tabs }) {
  if (!meta && !tabs) return null;
  return (
    <div
      data-sec-strip="1"
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
        color: NAVY,
        textAlign: "start",
      }}
    >
      {meta ? <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0, fontSize: 12, color: MUTED }}>{meta}</div> : null}
      {tabs || null}
    </div>
  );
}

/** The green band itself — kicker «NN · القسم», title, hint. Nothing else. */
export function Nv7Band({ kicker, title, hint, num = "" }) {
  const parts = String(kicker || "").split("·").map((part) => part.trim()).filter(Boolean);
  const index = num || (parts.length > 1 ? parts[0] : "");
  const rest = num ? (kicker || "") : (parts.length > 1 ? parts.slice(1).join(" · ") : (kicker || ""));
  const arabicIndex = /[\u0600-\u06FF]/.test(index);
  return (
    <header
      className="nv7-section-head"
      data-sec-head="1"
      style={{
        background: "linear-gradient(135deg,#0B3D27 0%,#0F5535 100%)",
        borderRadius: 12,
        padding: "14px 18px",
        boxShadow: "0 6px 18px rgba(6,61,38,.16)",
        display: "flex",
        flexDirection: "column",
        gap: 1,
        color: "#fff",
        textAlign: "start",
      }}
    >
      {kicker || index ? (
        <span className="nv7-section-kicker" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#A9CDB8", fontWeight: 600, fontSize: 10.5, letterSpacing: 0 }}>
          <span aria-hidden style={{ width: 12, height: 2, background: "#C8A45A", borderRadius: 8, display: "inline-block" }} />
          {index ? <span dir={arabicIndex ? undefined : "ltr"} style={{ fontFamily: arabicIndex ? "inherit" : "var(--font-mono, 'IBM Plex Mono', monospace)", letterSpacing: ".04em" }}>{index}</span> : null}
          {rest ? <span>{rest}</span> : null}
        </span>
      ) : null}
      <h1 className="nv-h" style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1.4, letterSpacing: 0 }}>{title}</h1>
      {hint ? (
        <div className="nv7-section-hint" style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: "#C5DBCD", maxWidth: 720 }}>{hint}</div>
      ) : null}
    </header>
  );
}

export default function Nv7SectionHead({ kicker, title, hint, meta, tabs, num }) {
  const band = <Nv7Band kicker={kicker} title={title} hint={hint} num={num} />;
  if (!meta && !tabs) return band;
  return (
    <div data-sec-wrap="1" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      {band}
      <Nv7Strip meta={meta} tabs={tabs} />
    </div>
  );
}
