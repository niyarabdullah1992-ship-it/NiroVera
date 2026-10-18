import React from "react";
import { CalendarOff, Coffee, Flag, Moon, Sun, Sunset } from "lucide-react";
import { SUN_FIELD, SUN_OFFICE, shiftTypeStyle } from "@/lib/shiftWeek";
import { formatShiftHm } from "@/lib/shiftDerivations";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { mono } from "@/components/schedules/scheduleChrome";
import { DUTY_LEAVE_STYLE, DUTY_REST_STYLE, dutyChip, dutyLabel } from "@/components/schedules/dutyStatus";

/**
 * One duty-day look for the whole section — the «أيامي» card: the shift's own tint, its symbol
 * (☀ صباحي · ◐ مسائي · ☾ ليلي · ☕ راحة), the clocks in mono, and small chips (مكشوف / مظلّل).
 * Shared by «أيامي», «تعيينات الفرع» (management), «جدول الفرع — للاطلاع» and the operational
 * calendar, so a night reads as a night everywhere.
 */

export const TILE_GAP = 4;

/** morning | evening | night | rest — from the label first, else the start hour. */
export function shiftKindOf(shift) {
  if (!shift) return "rest";
  const label = String(shift.label || "");
  if (/ليل|night/i.test(label)) return "night";
  if (/مساء|evening/i.test(label)) return "evening";
  if (/صباح|morning/i.test(label)) return "morning";
  const hour = Number(String(shift.start || "").split(":")[0]);
  if (hour >= 20 || hour < 4) return "night";
  if (hour >= 12) return "evening";
  return "morning";
}

export const KIND_ICON = { night: Moon, evening: Sunset, morning: Sun, rest: Coffee, leave: CalendarOff, holiday: Flag };

export function KindIcon({ kind, size = 16, style }) {
  const Icon = KIND_ICON[kind] || Coffee;
  return <Icon aria-hidden style={{ width: size, height: size, flex: "none", ...style }} strokeWidth={2} />;
}

/** The first letter of a name — the name badge text. */
export function letterOf(text) {
  // A letter, not a digit: «12 بقاء» reads ب, «الليلي» reads ل.
  const clean = String(text || "").replace(/(^|\s)ال(?=\p{L})/gu, "$1").trim();
  const letter = clean.match(/\p{L}/u);
  return letter ? letter[0] : (clean.slice(0, 1) || "·");
}

const HOLIDAY_STYLE = { bg: "var(--nv-shift-holiday)", color: "var(--nv-shift-holiday-ink)", fg: "var(--nv-shift-holiday-ink)" };

/** Surface colours for a tile kind — the same pairs «أيامي» uses. */
export function tilePalette(kind, style) {
  if (kind === "holiday") return HOLIDAY_STYLE;
  if (kind === "leave") return DUTY_LEAVE_STYLE;
  if (kind === "shift") return style || DUTY_REST_STYLE;
  return DUTY_REST_STYLE;
}

/** Tile surface for a roster cell. kind: "shift" | "rest" | "leave" | "holiday" | "empty". */
export function rosterTileStyle({ kind, style, tone = null, mine = false, interactive = false, extra = {} }) {
  const palette = tilePalette(kind, style);
  const base = {
    fontFamily: "inherit",
    position: "relative",
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 70,
    boxSizing: "border-box",
    borderRadius: DS_CONTROL_RADIUS + 2,
    padding: "9px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 5,
    textAlign: "start",
    cursor: interactive ? "pointer" : "default",
    background: palette.bg,
    color: palette.fg,
    border: kind === "leave"
      ? `1.5px dashed ${palette.color}`
      : `1px solid ${palette.color}`,
    boxShadow: mine && kind === "shift" ? "inset 0 0 0 1px var(--nv-ok-fill)" : "none",
  };
  if (tone) {
    return { ...base, border: `1px solid ${tone.line || "var(--nv-line)"}`, background: tone.soft, color: tone.ink, ...extra };
  }
  return { ...base, ...extra };
}

/**
 * The inside of a duty tile: symbol + name, the clocks, then any chips.
 * `label` is what the day is (a shift label, «راحة», a leave type …).
 */
export function TileBody({ kind, shiftKind, label, shift, style, lang = "ar", timeFormat, compact = false, children }) {
  const ar = lang === "ar";
  const palette = tilePalette(kind, style);
  const iconKind = kind === "shift" ? shiftKind : kind === "leave" ? "leave" : kind === "holiday" ? "holiday" : "rest";
  const clock = (hm) => formatShiftHm(hm, timeFormat, lang);
  return (
    <>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: kind === "shift" || kind === "leave" || kind === "holiday" ? palette.fg : "var(--nv-muted)", minWidth: 0, maxWidth: "100%" }}>
        <KindIcon kind={iconKind} size={compact ? 13 : 15} />
        <span style={{ fontSize: kind === "shift" ? (compact ? 12 : 13.5) : 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{label}</span>
      </span>
      {shift ? (
        <span dir={ar ? "rtl" : "ltr"} style={{ fontSize: compact ? 10.5 : 11.5, color: "var(--nv-ink2)", display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 3, rowGap: 0, minWidth: 0 }}>
          <span style={{ ...mono, fontWeight: 600, whiteSpace: "nowrap", unicodeBidi: "isolate" }}>{clock(shift.start)}</span>
          {/* The dash travels with the end clock, so a narrow tile breaks as «23:00 / – 07:00». */}
          <span style={{ whiteSpace: "nowrap" }}>
            <span aria-hidden>– </span>
            <span style={{ ...mono, fontWeight: 600, unicodeBidi: "isolate" }}>{clock(shift.end)}</span>
          </span>
        </span>
      ) : null}
      {children}
    </>
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

/** «مكشوف / مظلّل» on a settled cell — the «أيامي» chip, read only. */
export function SunChip({ mark, ar = true }) {
  if (mark !== SUN_FIELD && mark !== SUN_OFFICE) return null;
  return (
    <span
      data-ro-sun={mark}
      style={dutyChip(mark === SUN_FIELD ? "exposed" : "ok", { height: 20, fontSize: 10, padding: "0 6px", gap: 3 })}
    >
      <Sun aria-hidden style={{ width: 11, height: 11, flex: "none" }} strokeWidth={2.4} />
      {mark === SUN_FIELD ? dutyLabel("exposed", ar) : (ar ? "مظلّل" : "Shaded")}
    </span>
  );
}

function LegendPill({ children, swatch }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--nv-ink2)", border: "1px solid var(--nv-line)", background: "var(--nv-card)", borderRadius: 999, padding: "3px 10px 3px 8px" }}>
      {swatch}
      {children}
    </span>
  );
}

function Swatch({ palette, dashed = false, kind }) {
  return (
    <span style={{ width: 20, height: 20, borderRadius: 6, background: palette.bg, border: `1px ${dashed ? "dashed" : "solid"} ${palette.color}`, color: palette.fg, boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <KindIcon kind={kind} size={11} />
    </span>
  );
}

/** Legend in pills, each with its symbol — read only. */
export function RosterLegend({ types = [], ar = true, leaveLabel, holidayLabel, sun = false, trailing = null }) {
  return (
    <div data-roster-legend style={{ padding: "12px 18px 8px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {types.map((shift, index) => (
        <LegendPill key={shift.id} swatch={<Swatch palette={shiftTypeStyle(shift, index)} kind={shiftKindOf(shift)} />}>{shift.label}</LegendPill>
      ))}
      <LegendPill swatch={<Swatch palette={DUTY_REST_STYLE} kind="rest" />}>{ar ? "راحة" : "Rest"}</LegendPill>
      <LegendPill swatch={<Swatch palette={DUTY_LEAVE_STYLE} dashed kind="leave" />}>{leaveLabel || (ar ? "إجازة" : "Leave")}</LegendPill>
      <LegendPill swatch={<Swatch palette={HOLIDAY_STYLE} kind="holiday" />}>{holidayLabel || (ar ? "اليوم الوطني · يوم التأسيس · العيد" : "National Day · Founding Day · Eid")}</LegendPill>
      {sun ? (
        <>
          <SunChip mark={SUN_FIELD} ar={ar} />
          <SunChip mark={SUN_OFFICE} ar={ar} />
        </>
      ) : null}
      {trailing}
    </div>
  );
}
