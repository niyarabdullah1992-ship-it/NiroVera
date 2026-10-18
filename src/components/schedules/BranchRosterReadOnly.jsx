import React, { useMemo, useState } from "react";
import {
  employeeShiftOnDay,
  employeeWeekHours,
  SUN_FIELD,
  sunExposureCellState,
  LEAVE_STYLE,
  leaveOnDayView,
  REST_STYLE,
  shiftTypeStyle,
  SW,
  weekDays,
  weekdayLabel,
} from "@/lib/shiftWeek";
import { formatShiftHm } from "@/lib/shiftDerivations";
import { isOfficialHoliday } from "@/lib/ummAlQuraCalendar";
import { isViewerOwnFile } from "@/lib/employeeFileView";
import { FileSelfBadge } from "@/components/employees/ProfileHero";
import { chip, Collapsible, mono, slab } from "@/components/schedules/scheduleChrome";
import { NameLetter, RosterLegend, rosterTileStyle, SunPill, TileLabel, TILE_GAP } from "@/components/schedules/rosterTile";

// Same grid as the editor («تعيينات الفرع»): 128px names, seven day columns.
const NAME_COL = 150;
const GRID = `${NAME_COL}px repeat(7,minmax(70px,1fr))`;
const MIN_W = 700;

const CSS = `
.nv-branch-ro-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.nv-branch-ro-name { position: sticky; inset-inline-start: 0; z-index: 1; }
`;

function wideScreen() {
  try {
    return typeof window === "undefined" || !window.matchMedia || window.matchMedia("(min-width: 641px)").matches;
  } catch {
    return true;
  }
}

function HoursSpan({ shift, lang, format }) {
  const start = formatShiftHm(shift?.start, format, lang);
  const end = formatShiftHm(shift?.end, format, lang);
  if (!start && !end) return null;
  const clock = (label) => <span dir="ltr" style={{ ...mono, fontVariantNumeric: "tabular-nums" }}>{label}</span>;
  // The editor's wording: «من 07:00 إلى 15:00».
  if (lang === "ar") return start && end ? <>من {clock(start)} إلى {clock(end)}</> : clock(start || end);
  return start && end ? <>{clock(start)}–{clock(end)}</> : clock(start || end);
}

/**
 * «جدول الفرع — للاطلاع» — the branch week, read only, for the employee lane.
 * Same cell colours and legend as the admin grid, but no buttons: no cycle, no brush,
 * no مكشوف/مظلّل toggles (the marks the management set show on every row), no hours and no alerts of
 * anyone but you. Another person's leave
 * shows as «إجازة» only — the leave type stays on that person's own row and file.
 */
export default function BranchRosterReadOnly({
  roster = [],
  schedule,
  types = [],
  weekStart,
  laborCalendar,
  currentUser,
  published = true,
  stationName = "",
  ar = true,
  lang = "ar",
  timeFormat,
  defaultOpen,
  title,
}) {
  const [open, setOpen] = useState(() => (typeof defaultOpen === "boolean" ? defaultOpen : wideScreen()));
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const branch = String(stationName || "").replace(/^فرع\s+/u, "");
  const count = roster.length;
  const countLabel = ar
    ? (count === 1 ? "موظف واحد" : count === 2 ? "موظفان" : count <= 10 ? `${count} موظفين` : `${count} موظفاً`)
    : `${count} people`;

  const note = ar
    ? `${countLabel}${branch ? ` في فرع ${branch}` : ""} · الأسماء والورديات فقط — التعديل من الإدارة`
    : `${countLabel}${branch ? ` at ${branch}` : ""} · names and shifts only — editing is management's`;

  const cellText = { fontSize: 11, fontWeight: 600, lineHeight: 1.35, textAlign: "center", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  return (
    <section data-branch-roster-ro="1" style={{ ...slab, overflow: "hidden" }}>
      <style>{CSS}</style>
      <Collapsible
        dataAttr="branch-roster"
        open={open}
        onToggle={setOpen}
        title={title || (ar ? "جدول الفرع — للاطلاع" : "Branch roster — view only")}
        note={note}
        trailing={published ? null : <span style={chip("mute")}>{ar ? "مسودة — قد تتغيّر" : "Draft — may change"}</span>}
      >
        <div className="nv-branch-ro-scroll" role="region" aria-label={ar ? "جدول الفرع — قراءة فقط" : "Branch roster — read only"} tabIndex={0}>
          <div role="table" style={{ minWidth: MIN_W }}>
            <div role="row" style={{ display: "grid", gridTemplateColumns: GRID, borderTop: `1px solid ${SW.line}`, borderBottom: `1px solid ${SW.line}` }}>
              <span role="columnheader" className="nv-branch-ro-name" style={{ background: "var(--nv-soft)", padding: "8px 14px", fontSize: 11, color: SW.muted, textAlign: "start" }}>
                {ar ? "الموظف" : "Employee"}
              </span>
              {days.map((day) => {
                const holiday = !!isOfficialHoliday(day.key, laborCalendar);
                return (
                  <span key={day.key} role="columnheader" style={{ background: holiday ? "var(--nv-shift-head-holiday)" : "var(--nv-soft)", padding: "7px 4px", display: "flex", flexDirection: "column", gap: 1, alignItems: "center", borderInlineStart: "1px solid var(--nv-line2)" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: holiday ? "var(--nv-shift-holiday-ink)" : (day.weekend ? SW.muted : SW.mid) }}>{weekdayLabel(day.wd, ar)}</span>
                    <span dir="ltr" style={{ ...mono, fontSize: 10, color: SW.muted }}>{day.day}</span>
                  </span>
                );
              })}
            </div>

            {count === 0 ? (
              <div style={{ padding: "16px 18px", fontSize: 12.5, color: SW.mid, lineHeight: 1.8 }}>
                {ar ? "لا موظفون على جدول الفرع هذا الأسبوع." : "Nobody is on the branch roster this week."}
              </div>
            ) : null}

            {roster.map((employee) => {
              const mine = isViewerOwnFile(employee, currentUser);
              return (
                <div key={employee.id} role="row" data-branch-row={mine ? "self" : "peer"} style={{ display: "grid", gridTemplateColumns: GRID, borderBottom: "1px solid var(--nv-line2)" }}>
                  <span
                    role="rowheader"
                    className="nv-branch-ro-name"
                    style={{
                      background: mine ? "var(--nv-ok-soft)" : SW.card,
                      borderInlineStart: mine ? "3px solid var(--nv-ok-fill)" : "3px solid transparent",
                      padding: "8px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <NameLetter name={employee.name} mine={mine} />
                    <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: "1 1 auto" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: mine ? 700 : 600, color: SW.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "1 1 auto" }} title={employee.name}>
                          {employee.name}
                        </span>
                        {mine ? <FileSelfBadge ar={ar} /> : null}
                      </span>
                      {/* Hours are shown on your own row only — never a colleague's. */}
                      {mine ? (
                        <span style={{ fontSize: 10.5, color: SW.muted }}><span style={mono}>{employeeWeekHours(schedule, employee.id, weekStart, employee, laborCalendar)}</span> {ar ? "س" : "h"}</span>
                      ) : null}
                    </span>
                  </span>
                  {days.map((day) => {
                    const leave = leaveOnDayView(employee, day.key, ar, laborCalendar);
                    const shift = leave ? null : employeeShiftOnDay(schedule, employee.id, day.key);
                    const holiday = leave?.source === "official_holiday";
                    const style = leave ? (leave.style || LEAVE_STYLE) : (shift ? shiftTypeStyle(shift, types.findIndex((row) => row.id === shift.id)) : REST_STYLE);
                    const empty = !published && !shift && !leave;
                    // مكشوف / مظلّل as the management set it — on every row, read only (Decision 3337 is the
                    // branch's safety, not a private detail). Shown once a mark exists, same as the admin grid.
                    const sun = shift ? sunExposureCellState(schedule, employee.id, day.key, { shift }) : null;
                    const sunMark = sun?.touches && sun.mark ? sun.mark : "";
                    const label = leave
                      ? (holiday || mine ? leave.type : (ar ? "إجازة" : "Leave"))
                      : shift ? shift.label : empty ? (ar ? "بلا جدول" : "No roster") : (ar ? "راحة" : "Rest");
                    const kind = holiday ? "holiday" : leave ? "leave" : shift ? "shift" : empty ? "empty" : "rest";
                    return (
                      <span key={day.key} role="cell" style={{ display: "flex", padding: TILE_GAP, minWidth: 0, borderInlineStart: "1px solid var(--nv-line2)" }}>
                        <span
                          data-ro-cell={kind}
                          title={`${employee.name} — ${weekdayLabel(day.wd, ar)} — ${label}${sunMark ? ` — ${sunMark === SUN_FIELD ? (ar ? "مكشوف" : "Exposed") : (ar ? "مظلّل" : "Shaded")}` : ""}`}
                          style={rosterTileStyle({ kind, style, mine, extra: sunMark ? { paddingBottom: 30 } : {} })}
                        >
                          <TileLabel label={label} style={style} badge={kind === "shift"} />
                          {shift ? (
                            <span style={{ fontSize: 9.5, opacity: 0.85, lineHeight: 1.45, fontWeight: 500, maxWidth: "100%", textAlign: "center" }} dir={ar ? "rtl" : "ltr"}>
                              <HoursSpan shift={shift} lang={lang} format={timeFormat} />
                            </span>
                          ) : null}
                          <SunPill mark={sunMark} ar={ar} faded={sun?.source !== "cell"} />
                        </span>
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <RosterLegend types={types} ar={ar} sun />
        <p style={{ margin: 0, padding: "2px 18px 12px", fontSize: 11, color: SW.muted, lineHeight: 1.7 }}>
          {ar
            ? "للاطلاع فقط — «مكشوف / مظلّل» كما حددته الإدارة، ولا ساعات ولا تنبيهات لغيرك، ونوع إجازة الزميل لا يظهر. لتغيير ورديتك اطلبها من «طلباتي»."
            : "View only — no one else's hours or alerts, and a colleague's leave type is not shown. To change your shift, ask from My Requests."}
        </p>
      </Collapsible>
    </section>
  );
}
