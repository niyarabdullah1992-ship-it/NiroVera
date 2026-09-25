import React from "react";
import LawGateStatusPill, { LawGateArticleBadge } from "@/components/shared/LawGateStatusPill";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";

/**
 * One law-gate row (Arabic RTL):
 * leading (يمين) = حالة · وسط = نص · trailing (يسار) = رقم المادة
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
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          width: "100%",
        }}
      >
        <LawGateStatusPill status={status} label={pillLabel} who={who} detail={detail} ar={ar} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 11.5,
            lineHeight: 1.7,
            color: "var(--nv-ink2, #334155)",
            textAlign: ar ? "right" : "left",
          }}
        >
          {summary}
        </span>
        {article ? <LawGateArticleBadge article={article} /> : null}
      </div>
      {hint ? (
        <span style={{ fontSize: 10.5, color: "var(--nv-muted, #6B7280)", lineHeight: 1.7 }}>{hint}</span>
      ) : null}
      {children}
    </>
  );

  if (!slab) {
    return (
      <div data-law-gate-row={article || status} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
      }}
    >
      {body}
    </div>
  );
}
