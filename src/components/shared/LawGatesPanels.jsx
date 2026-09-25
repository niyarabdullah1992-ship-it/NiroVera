import React from "react";
import LawGateAlertRow from "@/components/shared/LawGateAlertRow";
import LawGateStatusPill from "@/components/shared/LawGateStatusPill";
import { buildLawGatesBoard } from "@/lib/lawGatesBoard";
import { DS_RADIUS, DS_SHADOW } from "@/lib/designSystem";

const panelShell = {
  background: "var(--nv-card, #fff)",
  border: "1px solid var(--nv-line, #E2E8F0)",
  borderRadius: DS_RADIUS,
  boxShadow: DS_SHADOW,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

function PanelHeader({ title }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--nv-line, #E2E8F0)" }}>
      <strong style={{ fontSize: 14, fontWeight: 700, color: "var(--nv-ink, #14284B)" }}>{title}</strong>
    </div>
  );
}

function HeatPanel({ panel, ar }) {
  const season = panel.season || {};
  return (
    <article style={panelShell} data-law-gates="3337">
      <PanelHeader title={panel.title} />
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto minmax(0,1fr)",
            gap: "6px 12px",
            padding: "10px 12px",
            background: "var(--nv-inset, var(--nv-soft, #F7F8FA))",
            border: "1px solid var(--nv-line, #E2E8F0)",
            borderRadius: 10,
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          <span style={{ color: "var(--nv-muted)" }}>{ar ? "تعريف الموسم" : "Season"}</span>
          <span style={{ fontWeight: 600, color: "var(--nv-ink)" }}>
            {ar ? season.rangeAr : season.rangeEn}
            <span style={{ display: "block", fontSize: 10, fontWeight: 400, color: "var(--nv-muted)" }}>
              {ar ? season.zodiacAr : season.zodiacEn}
            </span>
          </span>
          <span style={{ color: "var(--nv-muted)" }}>{ar ? "النافذة اليومية" : "Daily window"}</span>
          <span dir="ltr" style={{ fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>{season.window}</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>
          {ar ? season.noteAr : season.noteEn}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(panel.rows || []).map((row) => (
            <LawGateAlertRow
              key={row.id}
              slab
              ar={ar}
              status={row.status}
              pillLabel={row.pillLabel}
              article={row.article || "3337"}
              summary={
                <span>
                  <strong style={{ color: "var(--nv-ink)" }}>{row.title}</strong>
                  <span style={{ display: "block", fontSize: 11, color: "var(--nv-muted)", marginTop: 2 }}>{row.summary}</span>
                </span>
              }
            />
          ))}
        </div>
        <div
          style={{
            padding: "11px 12px",
            background: "var(--nv-inset, var(--nv-soft, #F7F8FA))",
            border: "1px solid var(--nv-line, #E2E8F0)",
            borderRadius: 10,
            fontSize: 11.5,
            lineHeight: 1.85,
            color: "var(--nv-ink2)",
          }}
        >
          <strong style={{ color: "var(--nv-ink)" }}>{panel.quoteTitle}</strong>
          {" — "}
          {ar ? panel.quoteNoteAr : panel.quoteNoteEn}
          <br />
          «{ar ? panel.quoteAr : panel.quoteEn}»
        </div>
      </div>
    </article>
  );
}

function NightPanel({ panel, ar }) {
  return (
    <article style={panelShell} data-law-gates="18632">
      <PanelHeader title={panel.title} />
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {(panel.rows || []).map((row) => (
          <LawGateAlertRow
            key={row.id}
            slab
            ar={ar}
            status={row.status}
            who={row.who}
            detail={row.detail}
            pillLabel={row.pillLabel}
            article={row.article || "18632"}
            summary={row.summary}
          />
        ))}
      </div>
    </article>
  );
}

function LabourPanel({ panel, ar }) {
  return (
    <article style={panelShell} data-law-gates="labour">
      <PanelHeader title={panel.title} />
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {(panel.rows || []).map((row) => (
          <LawGateAlertRow
            key={row.article}
            ar={ar}
            article={row.article}
            status={row.status}
            who={row.who}
            detail={row.detail}
            pillLabel={row.pillLabel}
            summary={row.summary}
          />
        ))}
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>{panel.footer}</p>
      </div>
    </article>
  );
}

/**
 * Three-panel law compliance alerts — Decision 3337, Decision 18632, Labour Law checks.
 * Soft cards + status pills (leading) · summary · article badge (trailing). No thick top edge.
 */
export default function LawGatesPanels({
  gates,
  company,
  onDate,
  ar = true,
  showHeat = true,
  showNight = true,
  showLabour = true,
}) {
  const board = buildLawGatesBoard({ gates, company, onDate, ar });
  return (
    <div
      data-law-gates-board="1"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        gap: 14,
        alignItems: "start",
      }}
    >
      {showHeat ? <HeatPanel panel={board.heat} ar={ar} /> : null}
      {showNight ? <NightPanel panel={board.night} ar={ar} /> : null}
      {showLabour ? <LabourPanel panel={board.labour} ar={ar} /> : null}
    </div>
  );
}

export { LawGateStatusPill, LawGateAlertRow };
