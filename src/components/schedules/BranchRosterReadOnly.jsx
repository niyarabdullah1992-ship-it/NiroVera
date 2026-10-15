import React, { useMemo, useState } from "react";
import {
  employeeShiftOnDay,
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

const NAME_COL = 132;
const GRID = `${NAME_COL}px repeat(7,minmax(78px,1fr))`;
const MIN_W = NAME_COL + 7 * 78;

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
  if (start && end) {
    return (
      <span dir="ltr" style={{ display: "inline-flex", flexWrap: "wrap", justifyContent: "center", columnGap: 3 }}>
        {clock(start)}
        <span aria-hidden>–</span>
        {clock(end)}
      </span>
    );
  }
  return clock(start || end);
}

/**
 * «جدول الفرع — للاطلاع» — the branch week, read only, for the employee lane.
 * Same cell colours and legend as the admin grid, but no buttons: no cycle, no brush,
 * no مكشوف/مظلّل toggles, no hours and no alerts of anyone. Another person's leave
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
                      gap: 6,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: mine ? 700 : 600, color: SW.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "1 1 auto" }} title={employee.name}>
                      {employee.name}
                    </span>
                    {mine ? <FileSelfBadge ar={ar} /> : null}
                  </span>
                  {days.map((day) => {
                    const leave = leaveOnDayView(employee, day.key, ar, laborCalendar);
                    const shift = leave ? null : employeeShiftOnDay(schedule, employee.id, day.key);
                    const holiday = leave?.source === "official_holiday";
                    const style = leave ? (leave.style || LEAVE_STYLE) : (shift ? shiftTypeStyle(shift, types.findIndex((row) => row.id === shift.id)) : REST_STYLE);
                    const empty = !published && !shift && !leave;
                    const label = leave
                      ? (holiday || mine ? leave.type : (ar ? "إجازة" : "Leave"))
                      : shift ? shift.label : empty ? (ar ? "بلا جدول" : "No roster") : (ar ? "راحة" : "Rest");
                    return (
                      <span
                        key={day.key}
                        role="cell"
                        title={`${employee.name} — ${weekdayLabel(day.wd, ar)} — ${label}`}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 3,
                          minHeight: 52,
                          minWidth: 0,
                          padding: "5px 4px",
                          boxSizing: "border-box",
                          margin: leave ? 3 : 0,
                          borderRadius: leave ? 8 : 0,
                          border: holiday
                            ? "1.5px solid var(--nv-shift-holiday-ink, #6B5320)"
                            : leave
                              ? "1.5px dashed var(--nv-shift-leave-line, #B99656)"
                              : "none",
                          borderInlineStart: leave ? undefined : "1px solid var(--nv-line2)",
                          background: holiday ? "var(--nv-shift-holiday)" : leave ? "var(--nv-shift-leave)" : style.bg,
                          color: holiday ? "var(--nv-shift-holiday-ink)" : style.fg,
                          boxShadow: mine && !leave ? "inset 0 2px 0 var(--nv-ok-fill)" : "none",
                        }}
                      >
                        <span style={cellText}>{label}</span>
                        {shift ? (
                          <span style={{ fontSize: 9.5, opacity: 0.85, lineHeight: 1.4, fontWeight: 500, maxWidth: "100%" }}>
                            <HoursSpan shift={shift} lang={lang} format={timeFormat} />
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "10px 18px 6px", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          {types.map((shift, index) => {
            const style = shiftTypeStyle(shift, index);
            return (
              <span key={shift.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--nv-ink3)" }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: style.bg, border: `1px solid ${style.color}`, boxSizing: "border-box" }} />
                {shift.label}
              </span>
            );
          })}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--nv-ink3)" }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: REST_STYLE.bg, border: `1px solid ${REST_STYLE.color}`, boxSizing: "border-box" }} />
            {ar ? "راحة" : "Rest"}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--nv-ink3)" }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: LEAVE_STYLE.bg, border: `1px dashed ${LEAVE_STYLE.color}`, boxSizing: "border-box" }} />
            {ar ? "إجازة" : "Leave"}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--nv-ink3)" }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: "var(--nv-shift-holiday)", border: "1px solid var(--nv-shift-holiday-ink)", boxSizing: "border-box" }} />
            {ar ? "اليوم الوطني · يوم التأسيس · العيد" : "National Day · Founding Day · Eid"}
          </span>
        </div>
        <p style={{ margin: 0, padding: "2px 18px 12px", fontSize: 11, color: SW.muted, lineHeight: 1.7 }}>
          {ar
            ? "للاطلاع فقط — لا ساعات ولا تنبيهات لغيرك، ونوع إجازة الزميل لا يظهر. لتغيير ورديتك اطلبها من «طلباتي»."
            : "View only — no one else's hours or alerts, and a colleague's leave type is not shown. To change your shift, ask from My Requests."}
        </p>
      </Collapsible>
    </section>
  );
}
