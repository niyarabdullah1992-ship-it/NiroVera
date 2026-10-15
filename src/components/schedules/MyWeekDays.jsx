import React, { useMemo } from "react";
import { CalendarOff, Coffee, Flag, Moon, Sun, Sunset } from "lucide-react";
import {
  employeeShiftOnDay,
  leaveOnDayView,
  shiftHours,
  shiftTypeStyle,
  sunExposureCellState,
  SUN_FIELD,
  SW,
  weekCellAlert,
  weekCellAlertTone,
  weekDays,
  weekdayLabel,
} from "@/lib/shiftWeek";
import { formatShiftHm } from "@/lib/shiftDerivations";
import { calendarDateKey } from "@/lib/attendanceCalendar";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { chip, mono } from "@/components/schedules/scheduleChrome";
import { DUTY_LEAVE_STYLE as LEAVE_STYLE, DUTY_REST_STYLE as REST_STYLE, dutyChip, dutyLabel } from "@/components/schedules/dutyStatus";
import { revealNode } from "@/components/schedules/dutyLinks";

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Scoped layout rules — 7 columns on desktop, 4 on a tablet, one row per day on a phone. */
const DAYS_CSS = `
.nv-my-days-wrap { container-type: inline-size; min-width: 0; }
.nv-my-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; padding: 14px 18px 4px; }
.nv-my-day { display: flex; flex-direction: column; gap: 6px; min-height: 148px; }
.nv-my-day .nv-my-day-body { display: flex; flex-direction: column; gap: 4px; flex: 1 1 auto; justify-content: center; }
@container (max-width: 860px) {
  .nv-my-day { padding: 10px 8px 9px !important; }
  .nv-my-day .nv-my-day-time { font-size: 11px !important; }
}
@container (max-width: 760px) {
  .nv-my-days { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@container (max-width: 520px) {
  .nv-my-days { grid-template-columns: minmax(0, 1fr); gap: 6px; padding: 12px 14px 4px; }
  .nv-my-day { flex-direction: row; align-items: center; min-height: 0; gap: 12px; padding: 10px 12px !important; }
  .nv-my-day .nv-my-day-head { flex: 0 0 74px; flex-direction: column !important; align-items: flex-start !important; gap: 2px !important; }
  .nv-my-day .nv-my-day-body { flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .nv-my-day .nv-my-day-foot { display: none !important; }
}
`;

export function shiftKind(shift) {
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

const KIND_ICON = { night: Moon, evening: Sunset, morning: Sun, rest: Coffee };

function dayMonth(day, ar) {
  return (
    <>
      <span dir="ltr" style={mono}>{day.day}</span>
      {" "}
      {(ar ? MONTHS_AR : MONTHS_EN)[day.month]}
    </>
  );
}

function hoursWord(n, ar) {
  const value = Number.isInteger(n) ? n : Number(n.toFixed(1));
  return ar ? <><span dir="ltr" style={mono}>{value}</span> س</> : <><span style={mono}>{value}</span> h</>;
}

/** Short words for a day's alert on the employee's own card (the full text stays in «أنظمة الوزارة»). */
const ALERT_SHORT = {
  hours_48: { ar: "فوق 48 ساعة", en: "Over 48 h" },
  hours_106: { ar: "فوق الحد", en: "Over the cap" },
  workplace: { ar: "بقاء طويل", en: "Long stay" },
  night_rest: { ar: "راحة ناقصة بعد الليل", en: "Short rest after night" },
  rest_5h: { ar: "بلا استراحة", en: "No break" },
  weekly_rest: { ar: "راحة أسبوعية ناقصة", en: "Weekly rest short" },
  night_rotate: { ar: "تدوير الليل", en: "Night rotation" },
  night_compensate: { ar: "تعويض ليلي", en: "Night compensation" },
  night_performer_comp: { ar: "تعويض ليلي", en: "Night compensation" },
  night_pregnancy: { ar: "حمل — لا ليل", en: "Pregnancy — no night" },
  night_medical: { ar: "لياقة ليلية", en: "Night fitness" },
  night_facilities: { ar: "تجهيزات الليل", en: "Night facilities" },
  ramadan: { ar: "ساعات رمضان", en: "Ramadan hours" },
  official_holiday: { ar: "عطلة رسمية", en: "Official holiday" },
  eid_rest_compensate: { ar: "تعويض راحة العيد", en: "Eid rest owed" },
  juvenile: { ar: "حدث", en: "Juvenile" },
  juvenile_hours: { ar: "ساعات الحدث", en: "Juvenile hours" },
  juvenile_night: { ar: "حدث — لا ليل", en: "Juvenile — no night" },
  overtime_107: { ar: "عمل إضافي", en: "Overtime" },
  ramadan_week_36: { ar: "فوق 36 ساعة رمضان", en: "Over 36 h Ramadan" },
  maternity_postnatal: { ar: "بعد الوضع", en: "After birth" },
};

/** One person's seven days — leave, shift, cell alert and the 3337 mark per day. */
export function useMyDayRows({ employee, schedule, gates, weekStart, laborCalendar, ar = true }) {
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const empId = employee?.id;
  return useMemo(() => days.map((day) => {
    const leave = employee ? leaveOnDayView(employee, day.key, ar, laborCalendar) : null;
    const shift = leave || !empId ? null : employeeShiftOnDay(schedule, empId, day.key);
    const alert = empId ? weekCellAlert(gates, empId, day.key) : null;
    const sun = shift ? sunExposureCellState(schedule, empId, day.key, { shift }) : null;
    const sunField = !!(sun?.live && sun.mark === SUN_FIELD);
    // What the day card shows: the mark picked for a shift inside the ban hours.
    const sunMark = sun?.asks && (sun.mark || sun.inSeason) ? (sun.mark || "unset") : null;
    // 3337 already shows as the sun chip; every other alert gets a short word on the card itself.
    const sunAlert = alert?.id === "heat_ban" || alert?.id === "heat_place";
    const short = alert && !sunAlert ? (ALERT_SHORT[alert.id] || null) : null;
    const check = alert && !sunAlert ? (gates?.checks || []).find((row) => row.id === alert.id) : null;
    const alertLabel = short ? (ar ? short.ar : short.en) : (check?.title || "");
    return { day, leave, shift, alert, alertLabel, alertTitle: check?.title || "", tone: weekCellAlertTone(alert), sunField, sunMark };
  }), [days, employee, empId, schedule, gates, ar, laborCalendar]);
}

export function weekLegend(types = [], ar = true) {
  return [
    ...types.map((shift, index) => ({ key: shift.id, label: shift.label, style: shiftTypeStyle(shift, index), dashed: false })),
    { key: "rest", label: dutyLabel("rest", ar), style: REST_STYLE },
    { key: "leave", label: ar ? "إجازة معتمدة" : "Approved leave", style: LEAVE_STYLE, dashed: true },
    { key: "holiday", label: ar ? "إجازة رسمية" : "Official holiday", style: { bg: "var(--nv-shift-holiday)", color: "var(--nv-shift-holiday-ink)" } },
  ];
}

/**
 * Seven day cards + legend. Used by «جدولي» and by the employee file (الدوام وأنظمة الوزارة).
 * Read-only — no cell editing, no other person's row.
 */
export default function MyWeekDays({
  dayRows,
  types = [],
  published = true,
  ar = true,
  lang = "ar",
  timeFormat,
  alertsLabel,
  /** yyyy-mm-dd from a «افتح اليوم» link — outlined and scrolled into view. */
  focusKey = "",
}) {
  const todayKey = calendarDateKey(new Date());
  const clock = (hm) => formatShiftHm(hm, timeFormat, lang);
  const legend = weekLegend(types, ar);
  return (
    <div className="nv-my-days-wrap">
      <style>{DAYS_CSS}</style>
      <div className="nv-my-days">
        {dayRows.map(({ day, leave, shift, tone, sunMark, alertLabel, alertTitle }) => {
          const today = day.key === todayKey;
          const past = day.key < todayKey;
          const holiday = leave?.source === "official_holiday";
          const index = shift ? types.findIndex((row) => row.id === shift.id) : -1;
          const style = leave ? (holiday ? { bg: "var(--nv-shift-holiday)", color: "var(--nv-shift-holiday-ink)", fg: "var(--nv-shift-holiday-ink)" } : LEAVE_STYLE) : shiftTypeStyle(shift, index);
          const kind = shiftKind(shift);
          const Icon = leave ? (holiday ? Flag : CalendarOff) : KIND_ICON[kind];
          const restLabel = !published && !shift && !leave ? dutyLabel("unscheduled", ar) : dutyLabel("rest", ar);
          return (
            <div
              key={day.key}
              className="nv-my-day"
              data-today={today ? "1" : undefined}
              data-focus={focusKey && focusKey === day.key ? "1" : undefined}
              ref={focusKey && focusKey === day.key ? (node) => { if (node && !node.dataset.revealed) { node.dataset.revealed = "1"; revealNode(node); } } : undefined}
              data-kind={leave ? (holiday ? "holiday" : "leave") : kind}
              title={tone ? (ar ? `على هذا اليوم ملاحظة — انظر «${alertsLabel || "تنبيهاتي"}»` : "This day has a note — see the alerts") : undefined}
              style={{
                position: "relative",
                boxSizing: "border-box",
                padding: "11px 11px 10px",
                borderRadius: DS_CONTROL_RADIUS,
                background: shift || leave ? style.bg : REST_STYLE.bg,
                border: today
                  ? "2px solid var(--nv-navy)"
                  : leave && !holiday
                    ? `1.5px dashed ${LEAVE_STYLE.color}`
                    : `1px solid ${shift || leave ? style.color : REST_STYLE.color}`,
                opacity: past && !today && focusKey !== day.key ? 0.62 : 1,
                boxShadow: focusKey && focusKey === day.key ? "0 0 0 3px var(--nv-warn-fill)" : undefined,
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              <div className="nv-my-day-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: today ? "var(--nv-navy)" : SW.ink }}>{weekdayLabel(day.wd, ar)}</span>
                  <span style={{ fontSize: 11, color: SW.muted, whiteSpace: "nowrap" }}>{dayMonth(day, ar)}</span>
                </span>
                {today ? <span style={chip("mute", { height: 20, fontSize: 10, padding: "0 7px", background: "var(--nv-navy)", color: "var(--nv-btn-ink, #fff)", border: "1px solid var(--nv-navy)" })}>{ar ? "اليوم" : "Today"}</span> : null}
              </div>
              <div className="nv-my-day-body">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: shift || leave ? style.fg : SW.muted, minWidth: 0 }}>
                  <Icon aria-hidden style={{ width: 16, height: 16, flex: "none" }} strokeWidth={2} />
                  <span style={{ fontSize: shift ? 15 : 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {leave ? leave.type : shift ? shift.label : restLabel}
                  </span>
                </span>
                {shift ? (
                  <span className="nv-my-day-time" style={{ fontSize: 12, color: SW.mid, whiteSpace: "nowrap" }}>
                    <span dir="ltr" style={{ ...mono, fontWeight: 600 }}>{clock(shift.start)} – {clock(shift.end)}</span>
                  </span>
                ) : leave?.article ? (
                  <span style={{ fontSize: 10.5, color: SW.muted, lineHeight: 1.5 }}>{leave.article}</span>
                ) : null}
                {sunMark ? (
                  <span
                    data-sun-day={sunMark}
                    title={ar ? "حظر العمل المكشوف (3337) — 12:00 إلى 15:00" : "Open-sun ban (3337) — 12:00 to 15:00"}
                    style={dutyChip(sunMark === SUN_FIELD ? "exposed" : sunMark === "unset" ? "alert" : "ok", { height: 20, fontSize: 10, padding: "0 6px", gap: 3, alignSelf: "flex-start" })}
                  >
                    <Sun aria-hidden style={{ width: 11, height: 11, flex: "none" }} strokeWidth={2.4} />
                    {sunMark === SUN_FIELD ? dutyLabel("exposed", ar) : sunMark === "unset" ? (ar ? "لم يُحدَّد بعد" : "Not set yet") : (ar ? "مظلّل" : "Shaded")}
                  </span>
                ) : null}
                {alertLabel && tone ? (
                  <span data-day-alert="1" title={alertTitle} style={{ display: "inline-flex", alignItems: "center", alignSelf: "flex-start", height: 20, padding: "0 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: tone.ink, background: tone.soft, border: `1px solid ${tone.line}`, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {alertLabel}
                  </span>
                ) : null}
              </div>
              <div className="nv-my-day-foot" style={{ fontSize: 11, color: SW.muted, display: "flex", justifyContent: "space-between", gap: 4 }}>
                {shift ? <span>{hoursWord(shiftHours(shift), ar)}</span> : <span>&nbsp;</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "10px 18px 4px", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        {legend.map((item) => (
          <span key={item.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--nv-ink3)" }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: item.style.bg, border: `1px ${item.dashed ? "dashed" : "solid"} ${item.style.color}`, boxSizing: "border-box" }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
