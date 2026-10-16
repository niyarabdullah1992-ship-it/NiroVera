import { excusedStartMinutes } from "./dutyRequests.js";
import { employeeScheduledOn, hasPublishedScheduleOn } from "./attendanceCalendar.js";
import { employeeShiftOnDay, isWeekDayPublished } from "./shiftWeek.js";
import { isStatutoryOffDay } from "./leaveTypes.js";

/**
 * One duty day, one source of truth. Every surface that counts a person's attendance, absence or
 * lateness — the employee's «شهري» line, the operational calendar's day cells, «حصيلة الشهر»,
 * «مقارنة الموظفين», the file's year/career and the smart search — reads this derivation.
 *
 * Absence (Art. 80 counting): a past day the person was ASSIGNED a published shift, with no punch,
 * no approved leave and not an official holiday. A published day the person is not on is rest —
 * never an absence. Lateness is measured from the published shift start, minus an approved
 * استئذان or a nursing hour at the start (Art. 154).
 */

export function rowsByDateKey(rows = []) {
  return Object.fromEntries(rows.map((row) => [String(row.date || row.dateKey || "").slice(0, 10), row]));
}

/**
 * One day of my register — the same derivation كشفي used (no new rule):
 * leave/official holiday outside attendance, open day, manual approval, late from the
 * published shift start, on time, absent on a scheduled past day, not punched yet today.
 * Days after today read as scheduled / rest only.
 * Returns a dutyStatus key in `status`.
 */
export function myDutyDay({ employee, data, row, key, todayKey, calendar, ar = true }) {
  const off = isStatutoryOffDay(employee, key, calendar);
  const scheduled = employeeScheduledOn(data?.schedules, employee?.id, key);
  const published = hasPublishedScheduleOn(data?.schedules, key);
  const schedule = (data?.schedules || []).find((item) => String(item.stationId) === String(employee?.stationId || data?.stations?.[0]?.id)) || null;
  const rosterLive = schedule ? isWeekDayPublished(schedule, key) : published;
  const shift = off ? null : employeeShiftOnDay(schedule, employee?.id, key);
  const inAt = row?.check_in_at || row?.checkInAt || null;
  const outAt = row?.check_out_at || row?.checkOutAt || null;
  const rawLate = Number(row?.late_minutes || row?.lateMinutes || 0);
  // An approved استئذان covering the shift start, or a nursing hour placed at the start (Art. 154), is not lateness.
  const excuse = rawLate > 0 && shift ? excusedStartMinutes(employee, key, shift.start) : { minutes: 0, reason: "" };
  const lateMinutes = Math.max(0, rawLate - excuse.minutes);
  const excusedNote = excuse.minutes && rawLate
    ? (excuse.reason === "nursing"
      ? (ar ? "ساعة الرضاعة أول الدوام — من ساعات العمل الفعلية." : "Nursing hour at shift start — counted as work.")
      : (ar ? "استئذان معتمد — لا يُحتسب تأخيراً." : "Approved permission — not counted as lateness."))
    : "";
  const manual = !!(row?.manual_override || row?.location_status === "manual" || row?.override_by);
  let status = "rest";
  let note = ar ? "لا وردية منشورة." : "No published shift.";
  if (off && !inAt) {
    status = off.kind === "official" ? "holiday" : "leave";
    note = off.kind === "official"
      ? (ar ? `${off.labelAr} — عطلة بأجر كامل، خارج حساب الحضور` : `${off.labelEn} — a paid holiday, outside attendance`)
      : (ar ? "إجازة معتمدة — خارج حساب الحضور." : "Approved leave — outside attendance.");
  } else if (key > todayKey) {
    status = shift || scheduled ? "upcoming" : (rosterLive || published ? "rest" : "unscheduled");
    note = shift || scheduled ? (ar ? "مجدول — لم يحن بعد." : "Scheduled — not yet.") : note;
  } else if (inAt && !outAt) {
    status = key === todayKey ? "present" : "open";
    note = ar ? "حضور بلا انصراف." : "Checked in with no checkout.";
    if (key === todayKey && (lateMinutes > 0 || (row?.status === "late" && !excuse.minutes))) status = "late";
  } else if (manual && inAt) {
    status = "manual";
    note = ar ? "اعتمده المدير يدوياً." : "Approved manually by a manager.";
  } else if (lateMinutes > 0 || (row?.status === "late" && !excuse.minutes)) {
    status = "late";
    note = ar ? `${lateMinutes} دقيقة بعد بداية الوردية` : `${lateMinutes} minutes after shift start`;
    if (excusedNote) note = `${note} · ${excusedNote}`;
  } else if (inAt) {
    status = "ontime";
    note = excusedNote;
  } else if (!rosterLive && !scheduled) {
    status = "unscheduled";
    note = ar ? "لا وردية منشورة." : "No published shift.";
  } else if (scheduled || shift) {
    // Assigned a published shift and no punch: pending today, absent once the day has passed.
    if (key === todayKey) {
      status = "pending";
      note = ar ? "مجدول اليوم — لم يُسجَّل بعد." : "Scheduled today — not punched yet.";
    } else {
      status = "absent";
      note = ar ? "مجدول ولم يسجّل." : "Scheduled and did not punch.";
    }
  }
  // Otherwise the roster is published but the person is not on it that day: rest, not absence.
  return { key, status, note, shift, inAt, outAt, lateMinutes, manual, row: row || null, off: off || null, excuse: excuse.minutes ? excuse.reason : "" };
}

export function isoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Month totals — counted from the same day records (the «شهري» line, the calendar, the file). */
export function monthTotals(days = []) {
  const seen = days.filter((day) => day && day.status !== "upcoming");
  const attended = seen.filter((day) => ["ontime", "late", "manual", "open", "present"].includes(day.status)).length;
  const scheduled = attended + seen.filter((day) => ["absent", "pending"].includes(day.status)).length;
  const lateDays = seen.filter((day) => day.status === "late" || (day.lateMinutes > 0 && day.inAt)).length;
  const lateMinutes = seen.reduce((sum, day) => sum + (day.inAt ? Number(day.lateMinutes) || 0 : 0), 0);
  const absent = seen.filter((day) => day.status === "absent").length;
  const leave = seen.filter((day) => day.status === "leave" || day.status === "holiday").length;
  const manual = seen.filter((day) => day.status === "manual").length;
  return { attended, scheduled, lateDays, lateMinutes, absent, leave, manual };
}

/**
 * The operational calendar's per-person state for a duty day — mapped from the same status:
 * on (attended) · late · abs · leave; anything else (rest, pending, upcoming, unscheduled) is no state.
 */
export function dutyPersonState(day) {
  const status = day?.status;
  if (status === "late") return "late";
  if (status === "absent") return "abs";
  if (status === "leave" || status === "holiday") return "leave";
  if (["ontime", "present", "manual", "open"].includes(status)) return day.lateMinutes > 0 && day.inAt ? "late" : "on";
  return null;
}
