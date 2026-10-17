/**
 * The app-level duty ticker — pure. One reading of «today's duty» for the punch card, the header
 * pill and the Layout ticker, so an alert fires on any page of the app, not only on بصمتي.
 *
 *   dutyContextOf({ data, user, attendance, now, shift? })  → the inputs deriveDutyAlerts reads
 *   breakClockOf(ctx, nowMs)                                → the running break: { kind, endAt, … }
 *   planDutyTick({ data, user, attendance, now, existingKeys, managerId, ar }) → { ctx, duty, clock, plans }
 *
 * Notices are planned with the app profile of planDutyAlertNotices: once per shift + alert id,
 * the 5h rule once per five-hour block without rest, one notice per break end. A key already in
 * `existingKeys` (the bell's keys) is never planned again, so two ticks in the same minute — or two
 * tabs — send nothing twice. Figures come from laborRules through deriveDutyAlerts.
 */
import { getTodaysShift } from "./attendanceDerivations.js";
import { deriveDutyAlerts, dutyShiftKey, planDutyAlertNotices, planNursingExpiryNotices } from "./dutyAlerts.js";
import { resolveDayBreaks, punchClockMinutes } from "./actualDuty.js";
import { employeeShiftOnDay, rosterBreakWindows, sunExposureMark, SUN_FIELD } from "./shiftWeek.js";
import { stationPrayerTimes } from "./prayerTimes.js";
import { isRamadanDay } from "./laborRules.js";
import { hoursPolicyOf } from "./laborHoursPolicy.js";
import { laborCalendarOf } from "./ummAlQuraCalendar.js";
import { toRiyadhDateKey } from "./riyadhDate.js";

/** Riyadh midnight of a duty day as epoch ms (Asia/Riyadh is UTC+3 all year). */
export function riyadhDayStartMs(dayKey) {
  const t = Date.parse(`${String(dayKey).slice(0, 10)}T00:00:00+03:00`);
  return Number.isFinite(t) ? t : null;
}

const toMs = (now) => (now instanceof Date ? now.getTime() : typeof now === "number" ? now : Date.parse(now ?? "") || Date.now());

/**
 * Everything the duty alerts read for this person today. `shift` may be passed (tests, a manager
 * preview); otherwise today's published shift. Returns null when there is no shift.
 */
export function dutyContextOf({ data, user, attendance, now = Date.now(), shift: given } = {}) {
  if (!user?.id) return null;
  const nowMs = toMs(now);
  const onDate = toRiyadhDateKey(new Date(nowMs));
  const shift = given || getTodaysShift(data, user);
  if (!shift?.start || !shift?.end) return null;
  const schedule = (data?.schedules || []).find((row) => String(row.stationId) === String(shift.stationId)) || null;
  // The published shift type behind today's assignment: its rest, placed breaks and exposure mark.
  const dutyShift = { ...(employeeShiftOnDay(schedule, user.id, onDate) || {}), ...shift };
  const employee = (data?.employees || []).find((row) => String(row.id) === String(user.id)) || user;
  const station = (data?.stations || []).find((row) => String(row.id) === String(shift.stationId || user.stationId)) || null;
  const laborCalendar = laborCalendarOf(data);
  const ramadan = isRamadanDay(onDate, laborCalendar);
  let prayers = null;
  try { prayers = station ? stationPrayerTimes(station, onDate, { ramadan }) : null; } catch { prayers = null; }
  const exposed = schedule ? sunExposureMark(schedule, user.id, onDate, dutyShift).mark === SUN_FIELD : false;
  const att = attendance || {};
  return {
    onDate,
    nowMs,
    shift: dutyShift,
    employee,
    company: data,
    station,
    prayers,
    exposed,
    ramadan,
    laborCalendar,
    punches: {
      checkIn: att.check_in_at || att.checkInAt || null,
      checkOut: att.check_out_at || att.checkOutAt || null,
      breaks: att.breaks,
    },
    shiftKey: dutyShiftKey(user.id, onDate, dutyShift),
  };
}

/** deriveDutyAlerts on a context. */
export function dutyAlertsOf(ctx, now) {
  if (!ctx) return { alerts: [], current: null, exempt: "", open: false };
  return deriveDutyAlerts({
    shift: ctx.shift,
    punches: ctx.punches,
    prayers: ctx.prayers,
    exposed: ctx.exposed,
    onDate: ctx.onDate,
    laborCalendar: ctx.laborCalendar,
    ramadan: ctx.ramadan,
    employee: ctx.employee,
    company: ctx.company,
    now: new Date(now ?? ctx.nowMs),
  });
}

/**
 * The break running now, if any — for the header pill and the card's countdown.
 * - flex («راحة مرنة ببصمة»): the open punched break; its end = its start minute + the minutes left —
 *   or, with none punched, the assumed break while it runs (`assumed: true`).
 * - fixed: the roster's break window the clock is inside (no punch), inside the presence.
 * Minute-aligned to the same clock the alerts read, so the countdown reaches 0:00 the minute the
 * «انتهت راحتك» notice fires. Art. 103 / no check-in / a closed day → null.
 * Returns { kind, start, end, startAt, endAt, remainingMs, overMs, minutes } or null.
 */
export function breakClockOf(ctx, now) {
  if (!ctx?.punches?.checkIn || ctx.punches.checkOut) return null;
  const nowMs = toMs(now ?? ctx.nowMs);
  const dayStart = riyadhDayStartMs(ctx.onDate);
  if (dayStart == null) return null;
  if (hoursPolicyOf(ctx.company, ctx.employee).continuousWork103 === true) return null;
  const shiftStart = punchClockMinutes(ctx.shift.start);
  const lift = (m) => (m != null && shiftStart != null && m + 720 < shiftStart ? m + 1440 : m);
  const at = (mins) => dayStart + mins * 60000;
  const hm = (mins) => {
    const m = ((Math.round(mins) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  const out = (kind, startMin, endMin) => ({
    kind,
    start: hm(startMin),
    end: hm(endMin),
    startAt: at(startMin),
    endAt: at(endMin),
    minutes: endMin - startMin,
    remainingMs: Math.max(0, at(endMin) - nowMs),
    overMs: Math.max(0, nowMs - at(endMin)),
  });
  if (ctx.shift.breakMode === "flex") {
    const day = resolveDayBreaks({ shift: ctx.shift, breaks: ctx.punches.breaks, checkIn: ctx.punches.checkIn, now: new Date(nowMs), onDate: ctx.onDate, prayers: ctx.prayers, company: ctx.company, employee: ctx.employee });
    if (!day.flex) return null;
    if (day.open) return out("flex", day.open.startMin, day.open.startMin + day.remaining);
    // None punched: the assumed break runs on the same clock until its end (a punch replaces it).
    if (day.assumedRunning) return { ...out("flex", day.assumed.startMin, day.assumed.endMin), assumed: true };
    return null;
  }
  if (Array.isArray(ctx.punches.breaks)) return null;
  const inM = lift(punchClockMinutes(ctx.punches.checkIn));
  let nowM = Math.floor((nowMs - dayStart) / 60000);
  if (inM != null && nowM < inM) nowM += 1440;
  const w = rosterBreakWindows(ctx.shift, ctx.onDate).find((row) => row.startMin <= nowM && nowM < row.endMin && row.startMin >= inM);
  return w ? out("fixed", w.startMin, w.endMin) : null;
}

/** «12:34» — minutes and seconds left (or past) on a break clock; hours fold in past 59 minutes. */
export function countdownLabel(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/**
 * One tick for one person: the context, the alerts, the break clock and the notices to send now.
 * `existingKeys` are the keys already on the bell (data.notifications); a plan is only ever new.
 */
export function planDutyTick({ data, user, attendance, now = Date.now(), existingKeys, managerId = null, ar = true, shift } = {}) {
  const keys = existingKeys || (data?.notifications || []).map((row) => row.key).filter(Boolean);
  // Art. 154: the nursing right's end is told on any day, shift or not — the employee only.
  const me = user?.id ? ((data?.employees || []).find((row) => String(row.id) === String(user.id)) || user) : null;
  const expiry = me ? planNursingExpiryNotices({ employee: me, onDate: toRiyadhDateKey(new Date(toMs(now))), existingKeys: keys, ar }) : [];
  const ctx = dutyContextOf({ data, user, attendance, now, shift });
  if (!ctx) return { ctx: null, duty: null, clock: null, plans: expiry };
  const duty = dutyAlertsOf(ctx, now);
  const clock = breakClockOf(ctx, now);
  const plans = duty.open
    ? planDutyAlertNotices({ alerts: duty.alerts, employee: ctx.employee, managerId, shiftKey: ctx.shiftKey, existingKeys: keys, ar, app: true })
    : [];
  return { ctx, duty, clock, plans: [...expiry, ...plans] };
}

/** When the ticker should run next: the next minute boundary, or the break's end if sooner. */
export function nextDutyTickAt(nowMs, clock) {
  const nextMinute = Math.floor(nowMs / 60000) * 60000 + 60000;
  if (clock && clock.endAt > nowMs && clock.endAt < nextMinute) return clock.endAt;
  return nextMinute;
}
