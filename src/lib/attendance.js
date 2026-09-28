import { base44 } from "@/api/base44Client";
import { employeeScheduledOn, hasPublishedScheduleOn } from "@/lib/attendanceCalendar";
import { isStatutoryOffDay } from "@/lib/leaveTypes";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";

// Thin helpers around the supabaseAttendance backend function, shared by the
// check-in widget, manager dashboards, and the task-gating check in Operations.
export async function getTodayAttendance(employeeId) {
  try {
    const res = await base44.functions.invoke("supabaseAttendance", { action: "getTodayStatus", employeeId });
    return res?.data?.attendance || null;
  } catch {
    return null;
  }
}

export function isActiveAttendance(att) {
  if (!att?.check_in_at || att.check_out_at) return false;
  const inZone = att.in_zone === true || att.inZone === true || att.location_status === "inside";
  const manualOverride = att.manual_override === true || att.manualOverride === true || att.location_status === "manual";
  return inZone || manualOverride;
}

export function isCheckedIn(att) {
  return isActiveAttendance(att);
}

export function isScheduledToday(employee, data) {
  if (!employee?.id) return false;
  return employeeScheduledOn(data?.schedules, employee.id, toRiyadhDateKey());
}

export function hasPublishedScheduleToday(data) {
  return hasPublishedScheduleOn(data?.schedules, toRiyadhDateKey());
}

export function checkedInToday(att) {
  return !!(att?.check_in_at || att?.checkInAt);
}

export function getAttendanceStatus(employee, attRow, data) {
  if (checkedInToday(attRow)) return attRow.status === "late" ? "late" : "present";
  if (isStatutoryOffDay(employee, toRiyadhDateKey(), laborCalendarOf(data))) return "on_leave";
  if (hasPublishedScheduleToday(data) && !isScheduledToday(employee, data)) return "not_scheduled";
  return "absent";
}

/** Same rate the attendance screen shows: present+late ÷ expected today. */
export function deriveTeamAttendanceToday(employees = [], attendanceRows = [], data) {
  const byId = Object.fromEntries(
    (attendanceRows || []).map((row) => [String(row.employee_id ?? row.employeeId), row]),
  );
  const counts = { present: 0, late: 0, absent: 0, onLeave: 0, notScheduled: 0 };
  for (const employee of employees) {
    const status = getAttendanceStatus(employee, byId[String(employee.id)], data);
    if (status === "on_leave") counts.onLeave += 1;
    else if (status === "not_scheduled") counts.notScheduled += 1;
    else if (status === "absent") counts.absent += 1;
    else if (status === "late") counts.late += 1;
    else counts.present += 1;
  }
  const rostered = Math.max(0, employees.length - counts.notScheduled);
  const scheduled = Math.max(0, rostered - counts.onLeave);
  const presentLike = counts.present + counts.late;
  const rate = scheduled > 0 ? Math.round((presentLike / scheduled) * 100) : 0;
  return { ...counts, scheduled, presentLike, rate };
}

export {
  earlyCheckoutFromScheduledEnd,
  getTodaysShift,
  hmToMinutes,
  isForgottenCheckout,
  lateMinutesFromScheduledStart,
  selfPunchScheduleGate,
} from "./attendanceDerivations.js";

/** Company policy: employee must punch from the station geofence. */
export function isLocationRequired(settings) {
  return settings?.gps_enabled === true && settings?.gps_required === true && !settings?.emergency_active;
}

const POLICY_PUNCH_ERRORS = new Set([
  "ON_APPROVED_LEAVE",
  "NOT_SCHEDULED",
  "GPS_REQUIRED",
  "STATION_LOCATION_REQUIRED",
  "OUTSIDE_STATION",
  "ALREADY_CHECKED_IN",
  "ALREADY_CHECKED_OUT",
  "NOT_CHECKED_IN",
  "Forbidden",
]);

export function isAttendancePolicyError(code) {
  return POLICY_PUNCH_ERRORS.has(code);
}