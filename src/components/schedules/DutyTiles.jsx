import React from "react";
import { DS_RADIUS, DS_SHADOW } from "@/lib/designSystem";
import { mono } from "@/components/schedules/scheduleChrome";
import { dutyEdge } from "@/components/schedules/dutyStatus";

/**
 * One skeleton for the three employee duty pages (بصمتي · سجلي · جدولي):
 * green head (AttendanceSectionFrame) → three tiles → main column + fixed side column.
 * Layout classes live in index.css (.nv-duty-tiles / .nv-duty-board / .nv-duty-col).
 */

/** KPI tile — card, 3px status edge on top, muted label, value, optional note. */
export function DutyTile({ tone = "mute", label, children, note, dataKey }) {
  return (
    <div
      data-duty-tile={dataKey || undefined}
      data-tone={tone}
      style={{
        background: "var(--nv-card)",
        border: "1px solid var(--nv-line)",
        borderRadius: DS_RADIUS,
        boxShadow: DS_SHADOW,
        padding: "12px 16px 13px",
        display: "flex",
        flexDirection: "column",
        gap: 5,
        minWidth: 0,
        position: "relative",
        overflow: "hidden",
        textAlign: "start",
      }}
    >
      <span aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 3, background: dutyEdge(tone) }} />
      <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.4 }}>{label}</span>
      {children}
      {note ? <span style={{ fontSize: 11, color: "var(--nv-ink3, var(--nv-muted))", lineHeight: 1.6 }}>{note}</span> : null}
    </div>
  );
}

/** Big tile number (mono, LTR) with an optional Arabic unit after it. */
export function DutyNumber({ value, unit, children }) {
  return (
    <span style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
      <strong dir="ltr" style={{ ...mono, fontSize: 22, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.1 }}>{value}</strong>
      {unit ? <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>{unit}</span> : null}
      {children}
    </span>
  );
}

/** Tile headline text (shift name, status word…). */
export function DutyHeadline({ children, color }) {
  return (
    <span style={{ fontSize: 18, fontWeight: 700, color: color || "var(--nv-ink)", lineHeight: 1.35, minWidth: 0 }}>
      {children}
    </span>
  );
}

/** Three tiles — the first a little wider; on a phone the first spans the row. */
export function DutyTiles({ children }) {
  const count = React.Children.toArray(children).filter(Boolean).length;
  if (!count) return null;
  return <div className="nv-duty-tiles" data-duty-tiles="1" data-count={count}>{children}</div>;
}

/** Main column + fixed side column (تنبيهاتي → توعية → page extras). */
export function DutyBoard({ main, side }) {
  const solo = !side;
  return (
    <div className="nv-duty-board" data-duty-board="1" data-solo={solo ? "1" : undefined}>
      <div className="nv-duty-col" data-duty-main="1">{main}</div>
      {solo ? null : <aside className="nv-duty-col nv-duty-side" data-duty-side="1">{side}</aside>}
    </div>
  );
}
