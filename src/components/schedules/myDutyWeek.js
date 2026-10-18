import { useMemo } from "react";
import {
  checkWeekPublishGates,
  employeeShiftOnDay,
  employeeWorkStationId,
  findStationById,
  leaveOnDayView,
  stationDisplayName,
} from "@/lib/shiftWeek";
import { calendarDateKey } from "@/lib/attendanceCalendar";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { useMyDayRows } from "@/components/schedules/MyWeekDays";

/**
 * One person's week on their home roster — schedule, station, gates run on this person
 * alone (no coworker hours or alerts) and the seven day rows. Used by بصمتي, سجلي and the
 * employee file duty tab.
 */
export default function useMyDutyWeek({ employee, data, weekStart, ar = true }) {
  const laborCalendar = laborCalendarOf(data);
  const stationId = employeeWorkStationId(employee);
  const schedule = useMemo(() => {
    const list = data?.schedules || [];
    const home = list.find((row) => String(row.stationId) === String(stationId));
    if (home) return home;
    // No home branch: the schedule that carries this person's assignments.
    const carrying = list.find((row) => Object.values(row.assignments || {}).some((day) => (
      day && typeof day === "object" && Object.values(day).some((ids) => Array.isArray(ids) && ids.map(String).includes(String(employee?.id)))
    )));
    return carrying || { shiftTypes: [], assignments: {} };
  }, [data?.schedules, stationId, employee?.id]);
  const station = findStationById(data?.stations || [], schedule?.stationId || stationId);
  const stationName = stationDisplayName(station);
  const types = schedule?.shiftTypes || [];
  const gates = useMemo(() => checkWeekPublishGates({
    schedule,
    employees: employee ? [employee] : [],
    weekStart,
    stationId: schedule?.stationId || stationId,
    station,
    settings: data?.settings,
    company: data,
    ar,
    laborCalendar,
  }), [schedule, employee, weekStart, stationId, station, data, ar, laborCalendar]);
  const dayRows = useMyDayRows({ employee, schedule, gates, weekStart, laborCalendar, ar });
  return { laborCalendar, stationId, schedule, station, stationName, types, gates, dayRows };
}

function atClock(dateKey, hm) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const [hh, mm] = String(hm || "00:00").split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}

function shiftSpan(dateKey, shift) {
  const start = atClock(dateKey, shift.start);
  let end = atClock(dateKey, shift.end || shift.start);
  if (end <= start) end = new Date(end.getTime() + 86400000);
  return { start, end };
}

/** "بعد 15 س" / "غداً" — relative time to a shift edge. */
export function inLabel(ms, ar) {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return ar ? `بعد ${mins} د` : `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return ar ? `بعد ${hours} س` : `in ${hours} h`;
  const daysN = Math.round(hours / 24);
  if (ar) return daysN === 1 ? "غداً" : daysN === 2 ? "بعد يومين" : `بعد ${daysN} أيام`;
  return daysN === 1 ? "tomorrow" : `in ${daysN} days`;
}

/**
 * Next (or current) shift — from yesterday's night forward, two weeks out, by the clock.
 * `afterKey` skips every day up to and including that date (بصمتي: the shift after today's).
 */
export function findNextShift({ me, schedule, ar = true, laborCalendar, now = new Date(), afterKey = "" }) {
  const meId = me?.id;
  if (!meId) return null;
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = -1; i < 15; i += 1) {
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const key = calendarDateKey(date);
    if (afterKey && key <= afterKey) continue;
    if (me && leaveOnDayView(me, key, ar, laborCalendar)) continue;
    const shift = employeeShiftOnDay(schedule, meId, key);
    if (!shift?.start) continue;
    const span = shiftSpan(key, shift);
    if (span.end <= now) continue;
    return { key, date, shift, ...span, live: span.start <= now };
  }
  return null;
}
