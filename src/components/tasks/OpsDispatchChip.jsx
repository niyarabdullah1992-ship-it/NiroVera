import React from "react";

/** Employee executing a task away from their home station — not a visitor-proof guest. */
export default function OpsDispatchChip({ homeName, ar = true }) {
  const home = homeName || (ar ? "فرع آخر" : "another branch");
  return (
    <span
      title={ar ? `فرعه ${home} — ينفّذ العمل هنا مؤقتًا، وليس زائرًا.` : `Home station ${home} — executing here temporarily, not a visitor.`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "flex-start",
        width: "max-content",
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: "2px 9px",
        borderRadius: 999,
        border: "1px solid var(--nv-warn-line)",
        background: "var(--nv-warn-soft)",
        color: "var(--nv-warn-ink)",
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {ar ? `من ${home}` : `From ${home}`}
    </span>
  );
}
