import React from "react";
import { Sun } from "lucide-react";
import { LEAVE_STYLE, REST_STYLE, SUN_FIELD, SUN_OFFICE, shiftTypeStyle } from "@/lib/shiftWeek";

/**
 * One roster week, one look — the طلباتي tile: white card, hairline, radius 10, a letter badge
 * naming the kind. Shared by «تعيينات الفرع» (management) and «جدول الفرع — للاطلاع» (employee),
 * so the two grids never drift apart. Colour stays meaning: the shift's own tint, rest quiet,
 * leave dashed gold, an official holiday solid.
 */

export const TILE_GAP = 4;

/** The first letter of a shift / name — the badge text. */
export function letterOf(text) {
  // A letter, not a digit: «12 بقاء» reads ب, «الليلي» reads ل.
  const clean = String(text || "").replace(/(^|\s)ال(?=\p{L})/gu, "$1").trim();
  const letter = clean.match(/\p{L}/u);
  return letter ? letter[0] : (clean.slice(0, 1) || "·");
}

/** Tile surface for a roster cell. kind: "shift" | "rest" | "leave" | "holiday" | "empty". */
export function rosterTileStyle({ kind, style, tone = null, mine = false, interactive = false, extra = {} }) {
  const base = {
    fontFamily: "inherit",
    position: "relative",
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 62,
    boxSizing: "border-box",
    borderRadius: 10,
    padding: "7px 6px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    textAlign: "center",
    cursor: interactive ? "pointer" : "default",
    transition: "box-shadow .15s ease, border-color .15s ease",
  };
  if (tone) {
    return { ...base, border: `1px solid ${tone.line || "var(--nv-line)"}`, background: tone.soft, color: tone.ink, ...extra };
  }
  if (kind === "holiday") {
    return { ...base, border: "1.5px solid var(--nv-shift-holiday-ink, #6B5320)", background: "var(--nv-shift-holiday)", color: "var(--nv-shift-holiday-ink)", ...extra };
  }
  if (kind === "leave") {
    return { ...base, border: `1.5px dashed var(--nv-shift-leave-line, ${LEAVE_STYLE.color})`, background: "var(--nv-shift-leave)", color: LEAVE_STYLE.fg, ...extra };
  }
  if (kind === "shift") {
    return {
      ...base,
      border: `1px solid ${style?.color || "var(--nv-line)"}`,
      background: style?.bg || "var(--nv-card)",
      color: style?.fg || "var(--nv-ink)",
      boxShadow: mine ? "inset 0 0 0 1px var(--nv-ok-fill)" : "none",
      ...extra,
    };
  }
  // Rest / no roster: a quiet card — present, never shouting.
  return { ...base, border: "1px solid var(--nv-line2)", background: "var(--nv-soft)", color: kind === "empty" ? "var(--nv-muted)" : REST_STYLE.fg, fontWeight: 500, ...extra };
}

/** The letter badge inside a shift tile (ص / م / ل …), tinted by the shift. */
export function ShiftLetter({ label, style }) {
  return (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        flex: "none",
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10.5,
        fontWeight: 700,
        background: "var(--nv-card)",
        color: style?.fg || "var(--nv-ink)",
        border: `1px solid ${style?.color || "var(--nv-line)"}`,
      }}
    >
      {letterOf(label)}
    </span>
  );
}

/** Label line of a tile: badge + name of the shift (or rest / leave word without a badge). */
export function TileLabel({ label, style, badge = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, maxWidth: "100%", minWidth: 0 }}>
      {badge ? <ShiftLetter label={label} style={style} /> : null}
      <span style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{label}</span>
    </span>
  );
}

/** The person's letter badge in the name column — the طلباتي kind badge. */
export function NameLetter({ name, mine = false }) {
  return (
    <span
      aria-hidden
      style={{
        width: 26,
        height: 26,
        flex: "none",
        borderRadius: 8,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        background: mine ? "var(--nv-btn-fill, #0B3D27)" : "var(--nv-ok-soft)",
        color: mine ? "var(--nv-btn-ink, #fff)" : "var(--nv-ok-ink)",
      }}
    >
      {letterOf(name)}
    </span>
  );
}

/** «مكشوف / مظلّل» as it reads on a settled cell — the same pill on both grids. */
export function SunPill({ mark, ar = true, faded = false }) {
  if (mark !== SUN_FIELD && mark !== SUN_OFFICE) return null;
  return (
    <span
      data-ro-sun={mark}
      style={{
        position: "absolute",
        insetInline: 5,
        bottom: 5,
        height: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        borderRadius: 999,
        background: mark === SUN_FIELD ? "var(--nv-bad, #B42318)" : "var(--nv-ok, #1F7A4D)",
        color: "#fff",
        whiteSpace: "nowrap",
        overflow: "hidden",
        opacity: faded ? 0.88 : 1,
      }}
    >
      {mark === SUN_FIELD ? <Sun aria-hidden style={{ width: 10, height: 10, flex: "none" }} strokeWidth={2.4} /> : null}
      {mark === SUN_FIELD ? (ar ? "مكشوف" : "Exposed") : (ar ? "مظلّل" : "Shaded")}
    </span>
  );
}

function LegendPill({ children, swatch }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--nv-ink2)", border: "1px solid var(--nv-line)", background: "var(--nv-card)", borderRadius: 999, padding: "4px 10px 4px 8px" }}>
      {swatch}
      {children}
    </span>
  );
}

/** Legend in pills — the StatusFilterPills look, read only. */
export function RosterLegend({ types = [], ar = true, leaveLabel, holidayLabel, sun = false, trailing = null }) {
  return (
    <div data-roster-legend style={{ padding: "12px 18px 8px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {types.map((shift, index) => {
        const style = shiftTypeStyle(shift, index);
        return <LegendPill key={shift.id} swatch={<ShiftLetter label={shift.label} style={style} />}>{shift.label}</LegendPill>;
      })}
      <LegendPill swatch={<span style={{ width: 14, height: 14, borderRadius: 4, border: "1px solid var(--nv-line2)", background: "var(--nv-soft)", boxSizing: "border-box" }} />}>{ar ? "راحة" : "Rest"}</LegendPill>
      <LegendPill swatch={<span style={{ width: 14, height: 14, borderRadius: 4, background: "var(--nv-shift-leave)", border: `1.5px dashed ${LEAVE_STYLE.color}`, boxSizing: "border-box" }} />}>{leaveLabel || (ar ? "إجازة" : "Leave")}</LegendPill>
      <LegendPill swatch={<span style={{ width: 14, height: 14, borderRadius: 4, background: "var(--nv-shift-holiday)", border: "1.5px solid var(--nv-shift-holiday-ink)", boxSizing: "border-box" }} />}>{holidayLabel || (ar ? "اليوم الوطني · يوم التأسيس · العيد" : "National Day · Founding Day · Eid")}</LegendPill>
      {sun ? (
        <>
          <LegendPill swatch={<span style={{ width: 14, height: 14, borderRadius: 999, background: "var(--nv-bad, #B42318)" }} />}>{ar ? "مكشوف" : "Exposed"}</LegendPill>
          <LegendPill swatch={<span style={{ width: 14, height: 14, borderRadius: 999, background: "var(--nv-ok, #1F7A4D)" }} />}>{ar ? "مظلّل" : "Shaded"}</LegendPill>
        </>
      ) : null}
      {trailing}
    </div>
  );
}
