import React from "react";

/** Official article or decision paragraph. Empty wording stays «—». */
export default function MinistryStatuteBlock({
  kicker,
  text,
  ar = true,
  article = "",
  decisionId = "",
}) {
  return (
    <div
      data-ministry-statute=""
      data-ministry-article={article || undefined}
      data-ministry-decision={decisionId || undefined}
      dir={ar ? "rtl" : "ltr"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "8px 10px",
        background: "var(--nv-page, #F4F7F5)",
        border: "1px solid var(--nv-line)",
        borderInlineStart: "3px solid var(--nv-ok-fill, #3C7D50)",
        borderRadius: 10,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--nv-ok-ink, #2F6B43)" }}>{kicker}</span>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.85, color: "var(--nv-ink, #111418)", whiteSpace: "pre-wrap" }}>
        {text || "—"}
      </p>
    </div>
  );
}
