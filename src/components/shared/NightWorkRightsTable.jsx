import React from "react";
import LawGateStatusPill, { LawGateArticleBadge } from "@/components/shared/LawGateStatusPill";
import { NIGHT_WORK_RIGHTS } from "@/lib/nightWorkRights";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";

/** 18632 applies-map as a NiroVera document: 1px line, status pills only. */
export default function NightWorkRightsTable({
  ar = true,
  rows = NIGHT_WORK_RIGHTS,
  showCite = false,
}) {
  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "0 2px",
        }}
      >
        <span style={{ fontSize: 10.5, color: "var(--nv-muted)", lineHeight: 1.6 }}>
          {ar ? "ينطبق · يؤدي عملاً ليلياً أو عامل ليلي" : "Applies · performs night work or night worker"}
        </span>
        {showCite ? <LawGateArticleBadge article="18632" /> : null}
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "9px 11px",
            border: "1px solid var(--nv-line)",
            borderRadius: DS_CONTROL_RADIUS,
            background: "var(--nv-card)",
            minWidth: 0,
          }}
        >
          <strong style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.5 }}>
            {ar ? row.ar : row.en}
          </strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <AppliesPill
              ar={ar}
              who={ar ? "يؤدي عملاً ليلياً" : "Performs night work"}
              on={row.performer}
              offLabel={ar ? (row.performerNoteAr || "بلا أثر") : (row.performerNoteEn || "No effect")}
            />
            <AppliesPill
              ar={ar}
              who={ar ? "عامل ليلي" : "Night worker"}
              on
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function AppliesPill({ ar, who, on, offLabel }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, color: "var(--nv-muted)", whiteSpace: "nowrap" }}>{who}</span>
      <LawGateStatusPill
        ar={ar}
        status={on ? "settled" : "void"}
        label={on ? (ar ? "استقرّ" : "Settled") : offLabel}
      />
    </span>
  );
}

export function NightWorkDefinition({ ar, windowText, performerText, workerText }) {
  const cell = (label, value) => (
    <>
      <span style={{ color: "var(--nv-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--nv-ink)" }}>{value}</span>
    </>
  );
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0,1fr)",
        gap: "6px 12px",
        padding: "10px 12px",
        background: "var(--nv-inset, var(--nv-soft))",
        border: "1px solid var(--nv-line)",
        borderRadius: 10,
        fontSize: 12,
        lineHeight: 1.7,
      }}
    >
      {cell(ar ? "نافذة الليل" : "Night window", windowText)}
      {cell(ar ? "يؤدي عملاً ليلياً" : "Performs night work", performerText)}
      {cell(ar ? "عامل ليلي" : "Night worker", workerText)}
    </div>
  );
}
