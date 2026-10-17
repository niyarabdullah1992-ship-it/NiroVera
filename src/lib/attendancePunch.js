/** Named gates for manual check-in and checkout correction. No invented hours. */

import { isOnApprovedLeave } from "./leaveTypes.js";
import { toRiyadhDateKey } from "./riyadhDate.js";
import { checkJuvenileHoursGate } from "./laborProtectionGates.js";
import { isWeeklyRestDay } from "./laborHoursPolicy.js";
import { isOfficialHoliday, officialHolidayLeaveLabel, officialHolidayOn } from "./ummAlQuraCalendar.js";
import { ruleValue } from "./laborRules.js";

export function parsePunchClock(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function clockFromPunchReason(reason) {
  const head = String(reason || "").split("·")[0] || "";
  return parsePunchClock(head.replace(/[^\d:]/g, " ").trim().split(/\s+/)[0]);
}

export function riyadhClockIso(dateKey, hhmm) {
  const day = toRiyadhDateKey(dateKey);
  const clock = parsePunchClock(hhmm);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !clock) return "";
  return new Date(`${day}T${clock}:00+03:00`).toISOString();
}

export function riyadhNowClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type) => parts.find((row) => row.type === type)?.value || "00";
  return parsePunchClock(`${part("hour")}:${part("minute")}`);
}

export function attendanceOnDate(rows, employeeId, dateKey) {
  const day = toRiyadhDateKey(dateKey);
  const id = String(employeeId || "");
  return (rows || []).find((row) => (
    String(row.employeeId ?? row.employee_id) === id
    && String(row.date || row.dateKey || "").slice(0, 10) === day
  )) || null;
}

function hasIn(row) {
  return !!(row?.checkInAt || row?.check_in_at);
}

function hasOut(row) {
  return !!(row?.checkOutAt || row?.check_out_at);
}

function isNightClock(hhmm, onDate) {
  const match = String(hhmm || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const mins = Number(match[1]) * 60 + Number(match[2]);
  const start = ruleValue("hours.night.startHour", onDate) * 60;
  const end = ruleValue("hours.night.endHour", onDate) * 60;
  return mins >= start || mins < end;
}

export function checkPunchRecordGate({
  type,
  employee,
  attendance,
  date,
  time,
  reason,
  requireTime = false,
  company,
  laborCalendar,
} = {}) {
  const kind = type === "checkout_fix" ? "checkout_fix" : "manual_punch";
  const day = String(date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return {
      ok: false,
      error: "DATE_REQUIRED",
      reason: "حدد تاريخ الحضور.",
      reasonEn: "Set the attendance date.",
    };
  }
  if (String(reason || "").trim().length < 3) {
    return {
      ok: false,
      error: "REASON_REQUIRED",
      reason: "اكتب سبب التسجيل اليدوي.",
      reasonEn: "Write why this manual record is needed.",
    };
  }
  if (requireTime && !parsePunchClock(time)) {
    return {
      ok: false,
      error: "TIME_REQUIRED",
      reason: kind === "checkout_fix" ? "حدد وقت الانصراف." : "حدد وقت الحضور.",
      reasonEn: kind === "checkout_fix" ? "Set the checkout time." : "Set the check-in time.",
    };
  }
  if (isOnApprovedLeave(employee, new Date(`${day}T12:00:00`))) {
    return {
      ok: false,
      error: "ON_APPROVED_LEAVE",
      reason: kind === "checkout_fix"
        ? "لا يمكن تصحيح الانصراف — لديك إجازة معتمدة لهذا اليوم."
        : "لا يمكن تسجيل الحضور — لديك إجازة معتمدة لهذا اليوم.",
      reasonEn: kind === "checkout_fix"
        ? "Checkout correction blocked — you have approved leave for this day."
        : "Check-in blocked — you have approved leave for this day.",
    };
  }
  // Art. 107(3): work on an official holiday is recorded (never refused) and every hour is overtime.
  // Juveniles stay barred (Art. 164) by the juvenile gate below.
  const holiday = officialHolidayOn(day, laborCalendar);
  const holidayNote = holiday
    ? {
      holiday: true,
      overtimeAll: true,
      holidayName: officialHolidayLeaveLabel(holiday.id, true, laborCalendar),
      note: `${officialHolidayLeaveLabel(holiday.id, true, laborCalendar)} — عمل في العطلة: ساعاته كلها إضافي (م107/3).`,
      noteEn: `${officialHolidayLeaveLabel(holiday.id, false, laborCalendar)} — holiday work: every hour is overtime (Art. 107(3)).`,
    }
    : {};
  if (kind === "manual_punch") {
    if (hasIn(attendance)) {
      return {
        ok: false,
        error: "ALREADY_CHECKED_IN",
        reason: "الحضور مسجّل لهذا اليوم — لا يُعاد ختمه.",
        reasonEn: "Check-in is already on file for this day — it is not stamped again.",
      };
    }
    const juvenileIn = checkJuvenileHoursGate({
      employee,
      onDate: day,
      hours: 0,
      nightHours: isNightClock(time, day) ? 1 : 0,
      restDay: isWeeklyRestDay(day, company, day),
      holiday: isOfficialHoliday(day, laborCalendar),
      company,
      laborCalendar,
    });
    if (!juvenileIn.ok) return juvenileIn;
    return { ok: true, kind, date: day, time: parsePunchClock(time), ...holidayNote };
  }
  if (!hasIn(attendance)) {
    return {
      ok: false,
      error: "NOT_CHECKED_IN",
      reason: "لا انصراف يُصحَّح قبل حضور مسجّل.",
      reasonEn: "Checkout cannot be corrected before a recorded check-in.",
    };
  }
  if (hasOut(attendance)) {
    return {
      ok: false,
      error: "ALREADY_CHECKED_OUT",
      reason: "الانصراف مسجّل لهذا اليوم — لا يُختلق وقت آخر.",
      reasonEn: "Checkout is already on file for this day — another time is not invented.",
    };
  }
  const juvenileOut = checkJuvenileHoursGate({
    employee,
    onDate: day,
    hours: 0,
    nightHours: isNightClock(time, day) ? 1 : 0,
    restDay: isWeeklyRestDay(day, company, day),
    holiday: isOfficialHoliday(day, laborCalendar),
    company,
    laborCalendar,
  });
  if (!juvenileOut.ok) return juvenileOut;
  return { ok: true, kind, date: day, time: parsePunchClock(time), ...holidayNote };
}

export function buildManualAttendanceRow({
  existing,
  employee,
  date,
  time,
  kind,
  by,
  reason,
  stationId,
  now = new Date(),
  lateness = null,
}) {
  const day = toRiyadhDateKey(date);
  const clock = parsePunchClock(time) || (kind === "checkout_fix" ? "" : riyadhNowClock(now));
  let at = clock ? riyadhClockIso(day, clock) : now.toISOString();
  const inAt = kind === "checkout_fix"
    ? (existing?.checkInAt || existing?.check_in_at || at)
    : at;
  // An overnight shift: a checkout clock at or before the check-in is the next morning.
  if (kind === "checkout_fix" && inAt && new Date(at).getTime() <= new Date(inAt).getTime()) {
    at = new Date(new Date(at).getTime() + 86400000).toISOString();
  }
  const outAt = kind === "checkout_fix" ? at : (existing?.checkOutAt || existing?.check_out_at || null);
  return {
    id: existing?.id || `pa_${employee?.id || "emp"}_${day}`,
    employeeId: employee?.id,
    employeeName: employee?.name || existing?.employeeName || "",
    stationId: stationId || employee?.stationId || existing?.stationId || null,
    date: day,
    checkInAt: inAt,
    checkOutAt: outAt,
    status: lateness ? lateness.status : (existing?.status || "present"),
    lateMinutes: lateness ? lateness.lateMinutes : (existing?.lateMinutes || existing?.late_minutes || 0),
    locationStatus: "manual",
    manualOverride: true,
    overrideBy: by || "",
    excusedNote: String(reason || "").trim(),
    ...(kind === "checkout_fix" ? { checkoutNote: String(reason || "").trim() } : { checkInNote: String(reason || "").trim() }),
    localPreview: true,
  };
}

/**
 * Lateness of a manual check-in at `clock` on a shift starting `shiftStart` — measured from the published
 * start like a real punch (no grace), less her Art. 154 start minutes. null when there is no shift.
 */
export function manualPunchLateness({ clock, shiftStart, nursingStartMinutes = 0 } = {}) {
  const at = parsePunchClock(clock);
  const start = parsePunchClock(shiftStart);
  if (!at || !start) return null;
  const toM = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
  let late = toM(at) - toM(start);
  if (late < -720) late += 1440; // after midnight on a shift that began the evening before
  if (late > 720) late -= 1440;
  const minutes = Math.max(0, late - Math.max(0, Number(nursingStartMinutes) || 0));
  return minutes > 0 ? { status: "late", lateMinutes: minutes } : { status: "present", lateMinutes: 0 };
}

/**
 * The time a manager writes for a punch: required, never after now, and a checkout after the check-in
 * (an earlier clock on an overnight shift is the next morning). Named reasons.
 */
export function checkManualTimeGate({ kind, date, time, checkInAt, now = new Date() } = {}) {
  const out = kind === "checkout_fix" || kind === "out";
  const clock = parsePunchClock(time);
  if (!clock) {
    return { ok: false, error: "TIME_REQUIRED", reason: out ? "حدد وقت الانصراف." : "حدد وقت الحضور.", reasonEn: out ? "Set the checkout time." : "Set the check-in time." };
  }
  let at = new Date(riyadhClockIso(date, clock)).getTime();
  const inMs = checkInAt ? new Date(checkInAt).getTime() : NaN;
  if (out && Number.isFinite(inMs) && at <= inMs) at += 86400000;
  if (at > now.getTime() + 60000) {
    return { ok: false, error: "TIME_IN_FUTURE", reason: out ? "لا يُسجَّل انصراف بوقت لم يأتِ بعد." : "لا يُسجَّل حضور بوقت لم يأتِ بعد.", reasonEn: out ? "A checkout is not recorded at a time that has not come yet." : "A check-in is not recorded at a time that has not come yet." };
  }
  return { ok: true, clock, at: new Date(at).toISOString() };
}

/** The checkout time the manager's field opens on: the shift end once it has passed, else now (Riyadh clock). */
export function defaultManualCheckoutClock(shift, now = new Date()) {
  const nowClock = riyadhNowClock(now);
  const end = parsePunchClock(shift?.end);
  const start = parsePunchClock(shift?.start);
  if (!end) return nowClock;
  const toM = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
  const overnight = start && toM(end) <= toM(start);
  if (overnight) return nowClock;
  return toM(end) <= toM(nowClock) ? end : nowClock;
}

export function toCloudAttendanceRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    employee_id: row.employeeId ?? row.employee_id,
    employeeId: row.employeeId ?? row.employee_id,
    station_id: row.stationId || row.station_id || null,
    date: row.date || row.dateKey,
    check_in_at: row.checkInAt || row.check_in_at || null,
    check_out_at: row.checkOutAt || row.check_out_at || null,
    status: row.status || (row.checkInAt || row.check_in_at ? "present" : null),
    late_minutes: row.lateMinutes || row.late_minutes || 0,
    location_status: row.locationStatus || row.location_status || "manual",
    manual_override: row.manualOverride ?? row.manual_override ?? true,
    override_by: row.overrideBy || row.override_by || "",
    excused_note: row.excusedNote || row.excused_note || "",
    excused: !!row.excused,
    excused_by_name: row.excusedByName || row.excused_by_name || "",
    excused_at: row.excusedAt || row.excused_at || null,
    early_checkout: !!(row.earlyCheckout || row.early_checkout),
    localPreview: !!row.localPreview,
    ...(Array.isArray(row.breaks) ? { breaks: row.breaks } : {}),
  };
}

/**
 * Leaving before the published shift end — the server's rule (supabaseAttendance checkOut): minutes
 * on the Riyadh clock against the end, less her Art. 154 end minutes. An overnight shift ends tomorrow.
 */
export function isEarlyCheckoutAt(shift, checkOutAt, nursingEndMinutes = 0) {
  const end = String(shift?.end || "").match(/^(\d{1,2}):(\d{2})$/);
  const start = String(shift?.start || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!end || !checkOutAt) return false;
  const endM = Number(end[1]) * 60 + Number(end[2]);
  const startM = start ? Number(start[1]) * 60 + Number(start[2]) : null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(checkOutAt));
  let outM = Number(parts.find((p) => p.type === "hour")?.value || 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value || 0);
  let endAbs = endM;
  if (startM != null && endM <= startM) {
    endAbs += 1440; // overnight: the shift ends the next morning
    if (outM < startM) outM += 1440;
  }
  const excuse = Math.max(0, Number(nursingEndMinutes) || 0);
  return outM < endAbs - excuse;
}

