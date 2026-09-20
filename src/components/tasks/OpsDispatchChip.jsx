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
        padding: "3px 9px",
        borderRadius: 8,
        border: "1px solid #FDBA74",
        background: "#FFF7ED",
        color: "#9A3412",
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
