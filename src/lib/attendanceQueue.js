/**
 * «بصمات اليوم بلا حكم» — one reading of what waits on the manager, shared by the queue, the team
 * list, the section tab and the side-menu badge (they must never disagree).
 * A row may carry several faces at once (e.g. a late return AND no checkout): it is listed under each.
 */
import { getTodaysShift, todaysShiftEnded } from "./attendanceDerivations.js";
import { isExcusedEarlyCheckout } from "./dutyRequests.js";
import { resolveDayBreaks } from "./actualDuty.js";
import { toRiyadhDateKey } from "./riyadhDate.js";

export const QUEUE_FACES = ["manual", "outside", "missing", "early", "late_return"];

function nowMinutesOf(now) {
  return now.getHours() * 60 + now.getMinutes();
}

/** The pending «طلب بصمة يدوية» of this person, if any. */
export function pendingManualPunch(employee) {
  return (employee?.otherRequests || []).find((item) => (item.type === "manual_punch" || item.type === "checkout_fix") && (item.status || "pending") === "pending") || null;
}

/** The flex-break reading of the person's day (punched / assumed, and what ran past its minutes). */
export function breakDayOf(employee, row, data, now = new Date()) {
  return resolveDayBreaks({
    shift: getTodaysShift(data, employee, now),
    breaks: row?.breaks,
    checkIn: row?.check_in_at,
    checkOut: row?.check_out_at,
    now,
    onDate: toRiyadhDateKey(now),
    company: data,
    employee,
  });
}

/** A closed over-long flex break with no decision yet — a late return, not a legal breach. */
export function isLateReturnOpen(employee, row, data, now = new Date()) {
  const day = breakDayOf(employee, row, data, now);
  return !!day.flex && !day.open && day.overMinutes > 0 && !day.punched.some((item) => item.review);
}

/** «بلا انصراف» only once the shift has ended (+1 h) — an open record mid-shift is normal. */
export function isPastCheckoutMissing(employee, row, data, now = new Date()) {
  if (!(row?.check_in_at && !row?.check_out_at && row?.status !== "absent")) return false;
  return todaysShiftEnded(getTodaysShift(data, employee, now), nowMinutesOf(now), 60);
}

/** Every face this person's day shows in the queue, in a stable order. [] = nothing to decide. */
export function queueFacesOf(employee, row, data, now = new Date()) {
  const faces = [];
  if (pendingManualPunch(employee)) faces.push("manual");
  if (row?.location_status === "outside") faces.push("outside");
  if (isPastCheckoutMissing(employee, row, data, now)) faces.push("missing");
  if (row?.early_checkout) {
    // Leaving inside her Art. 154 nursing minutes at the end of the shift is not an early checkout.
    const day = String(row.date || "").slice(0, 10) || toRiyadhDateKey(now);
    const excused = isExcusedEarlyCheckout(employee, day, row.check_out_at, getTodaysShift(data, employee, now)?.end);
    if (!excused) faces.push("early");
  }
  if (isLateReturnOpen(employee, row, data, now)) faces.push("late_return");
  return faces;
}

/** The queue: [{ employee, row, faces }] for everyone with at least one face. */
export function attendanceDecisionQueue(employees = [], rows = [], data = null, now = new Date()) {
  const byId = Object.fromEntries((rows || []).map((r) => [String(r.employee_id ?? r.employeeId), r]));
  const out = [];
  for (const employee of employees || []) {
    const row = byId[String(employee.id)];
    const faces = queueFacesOf(employee, row, data, now);
    if (faces.length) out.push({ employee, row, faces });
  }
  return out;
}
