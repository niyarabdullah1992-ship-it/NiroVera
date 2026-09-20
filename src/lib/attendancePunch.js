/** Named gates for manual check-in and checkout correction. No invented hours. */

import { isOnApprovedLeave } from "./leaveTypes.js";
import { toRiyadhDateKey } from "./riyadhDate.js";
import { checkJuvenileHoursGate } from "./laborProtectionGates.js";
import { isWeeklyRestDay } from "./laborHoursPolicy.js";
import { isOfficialHoliday } from "./ummAlQuraCalendar.js";
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
    return { ok: true, kind, date: day, time: parsePunchClock(time) };
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
  return { ok: true, kind, date: day, time: parsePunchClock(time) };
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
}) {
  const day = toRiyadhDateKey(date);
  const clock = parsePunchClock(time) || (kind === "checkout_fix" ? "" : riyadhNowClock(now));
  const at = clock ? riyadhClockIso(day, clock) : now.toISOString();
  const inAt = kind === "checkout_fix"
    ? (existing?.checkInAt || existing?.check_in_at || at)
    : at;
  const outAt = kind === "checkout_fix" ? at : (existing?.checkOutAt || existing?.check_out_at || null);
  return {
    id: existing?.id || `pa_${employee?.id || "emp"}_${day}`,
    employeeId: employee?.id,
    employeeName: employee?.name || existing?.employeeName || "",
    stationId: stationId || employee?.stationId || existing?.stationId || null,
    date: day,
    checkInAt: inAt,
    checkOutAt: outAt,
    status: existing?.status || "present",
    lateMinutes: existing?.lateMinutes || existing?.late_minutes || 0,
    locationStatus: "manual",
    manualOverride: true,
    overrideBy: by || "",
    excusedNote: String(reason || "").trim(),
    localPreview: true,
  };
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
    localPreview: !!row.localPreview,
  };
}
