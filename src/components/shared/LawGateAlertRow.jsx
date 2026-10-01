import React from "react";
import LawGateStatusPill, { LawGateArticleBadge } from "@/components/shared/LawGateStatusPill";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";

/**
 * One law-gate row (Arabic RTL):
 * شريط الحالة + رقم المادة، ثم النص بعرض كامل حتى لا يُضغط عمودياً.
 */
export default function LawGateAlertRow({
  status = "void",
  pillLabel,
  who = "",
  detail = "",
  summary,
  hint,
  article,
  ar = true,
  slab = false,
  children,
}) {
  const body = (
    <>
      <div
        dir={ar ? "rtl" : "ltr"}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 8,
          width: "100%",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            width: "100%",
            minWidth: 0,
          }}
        >
          <span style={{ minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
            <LawGateStatusPill status={status} label={pillLabel} who={who} detail={detail} ar={ar} />
          </span>
          {article ? <LawGateArticleBadge article={article} /> : null}
        </div>
        {summary ? (
          <span
            style={{
              display: "block",
              width: "100%",
              minWidth: 0,
              fontSize: 11.5,
              lineHeight: 1.75,
              color: "var(--nv-ink2, #334155)",
              textAlign: ar ? "right" : "left",
              overflowWrap: "anywhere",
              whiteSpace: "normal",
            }}
          >
            {summary}
          </span>
        ) : null}
      </div>
      {hint ? (
        <span style={{ fontSize: 10.5, color: "var(--nv-muted, #6B7280)", lineHeight: 1.7 }}>{hint}</span>
      ) : null}
      {children}
    </>
  );

  if (!slab) {
    return (
      <div data-law-gate-row={article || status} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        {body}
      </div>
    );
  }

  return (
    <div
      data-law-gate-row={article || status}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "9px 11px",
        border: "1px solid var(--nv-line, #E2E8F0)",
        borderRadius: DS_CONTROL_RADIUS,
        background: "var(--nv-card, #fff)",
        fontSize: 11.5,
        lineHeight: 1.8,
        color: "var(--nv-ink2, #334155)",
        minWidth: 0,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {body}
    </div>
  );
}
