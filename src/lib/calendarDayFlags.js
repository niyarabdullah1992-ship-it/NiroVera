/**
 * What a duty day leaves behind beyond present / late / absent — read for the operational calendar.
 * Pure. One reading per person per day, from the same derivations the decision queue and the punch
 * card use (no new rule):
 *
 *   violations  — late return from a flex break (not excused), early checkout (not inside the
 *                 Art. 154 nursing minutes), recorded overtime minutes.
 *   awaiting    — punches that still wait on a manager: outside the range and not approved,
 *                 a forgotten checkout, a late return with no review, an open overtime decision.
 *   pending     — طلباتي requests for that day still pending: leave covering it, a duty request
 *                 (استئذان، تبديل وردية …) dated on it, a manual punch / checkout fix for it.
 *
 * A manual punch request is listed under «pending» only — never twice.
 */
import { getShiftOnDate, hmToMinutes, isForgottenCheckout, isOtDecisionOpen, riyadhMinutesOf } from "./attendanceDerivations.js";
import { isDutyRequestType, isExcusedEarlyCheckout, DUTY_REQUEST_META } from "./dutyRequests.js";
import { resolveDayBreaks } from "./actualDuty.js";
import { leaveCoverRange, leaveTypeLabel } from "./leaveTypes.js";

const isPending = (row) => (row?.status || "pending") === "pending";
const dayOf = (value) => String(value || "").slice(0, 10);

function endOfDay(dateKey) {
  // 23:59 Riyadh on that day — caps an open break on a closed past day.
  return new Date(`${dateKey}T23:59:00+03:00`);
}

/** Minutes the checkout fell before the published shift end (0 when not early). */
export function earlyLeaveMinutes(shift, checkOut) {
  const end = hmToMinutes(shift?.end);
  const out = checkOut ? riyadhMinutesOf(checkOut) : null;
  if (end == null || out == null) return 0;
  let diff = end - out;
  if (diff < 0) diff += 1440;
  // More than 12 h "early" is an overnight wrap, not an early checkout.
  return diff > 0 && diff <= 720 ? diff : 0;
}

/** Pending طلباتي rows for this person on this day: [{ kind, id, label, labelEn }]. */
export function pendingRequestsOn(employee, dateKey) {
  const out = [];
  for (const request of employee?.leaveRequests || []) {
    if (!isPending(request) || String(request.type || "").toLowerCase() === "eid") continue;
    const { start, end } = leaveCoverRange(request);
    if (!start || !end || dateKey < start || dateKey > end) continue;
    out.push({
      kind: "leave",
      id: request.id || `${employee.id}-leave-${start}`,
      label: `طلب ${leaveTypeLabel(request.type, true, undefined, dateKey)}`,
      labelEn: `${leaveTypeLabel(request.type, false, undefined, dateKey)} request`,
    });
  }
  for (const request of employee?.otherRequests || []) {
    if (!isPending(request)) continue;
    if (dayOf(request.date || request.dateKey || request.startDate) !== dateKey) continue;
    if (request.type === "manual_punch" || request.type === "checkout_fix") {
      out.push({
        kind: "punch",
        id: request.id || `${employee.id}-punch-${dateKey}`,
        label: request.type === "checkout_fix" ? "طلب تصحيح انصراف" : "طلب بصمة يدوية",
        labelEn: request.type === "checkout_fix" ? "Checkout fix request" : "Manual punch request",
      });
    } else if (isDutyRequestType(request.type)) {
      const meta = DUTY_REQUEST_META[request.type] || {};
      out.push({
        kind: "duty",
        id: request.id || `${employee.id}-${request.type}-${dateKey}`,
        label: `طلب ${meta.ar || "دوام"}`,
        labelEn: `${meta.en || "Duty"} request`,
      });
    }
  }
  return out;
}

/**
 * One person's day: { lateReturn, lateReturnExcused, early, overtime, awaiting: [face], pending: [...] }.
 * Minutes are whole minutes; awaiting faces are "outside" | "missing" | "late_return" | "ot".
 */
export function personDayFlags({ employee, row, data, dateKey, todayKey, now = new Date() }) {
  const empty = { lateReturn: 0, lateReturnExcused: false, early: 0, overtime: 0, awaiting: [], pending: [] };
  if (!employee?.id || !dateKey) return empty;
  const pending = pendingRequestsOn(employee, dateKey);
  const checkIn = row?.check_in_at || row?.checkInAt || null;
  const checkOut = row?.check_out_at || row?.checkOutAt || null;
  if (!checkIn) return { ...empty, pending };

  const shift = getShiftOnDate(data, employee, dateKey);
  const clockNow = dateKey < todayKey ? endOfDay(dateKey) : now;

  // Late return: the same flex-break reading as «بصمات اليوم بلا حكم».
  let lateReturn = 0;
  let lateReturnExcused = false;
  let lateReturnOpen = false;
  if (shift?.breakMode === "flex") {
    const day = resolveDayBreaks({ shift, breaks: row?.breaks, checkIn, checkOut, now: clockNow, onDate: dateKey, company: data, employee });
    if (day.flex && !day.open && day.overMinutes > 0) {
      const reviewed = (day.punched || []).filter((item) => item.review);
      lateReturnExcused = reviewed.some((item) => item.review?.decision === "excused");
      lateReturn = lateReturnExcused ? 0 : day.overMinutes;
      lateReturnOpen = !reviewed.length;
    }
  }

  const earlyRaw = row?.early_checkout || row?.earlyCheckout;
  const early = earlyRaw && checkOut && !isExcusedEarlyCheckout(employee, dateKey, checkOut, shift?.end)
    ? Math.max(1, earlyLeaveMinutes(shift, checkOut))
    : 0;

  const otEntry = data?.otDecisions?.[`${employee.id}:${dateKey}`] || null;
  const overtime = checkOut
    ? Math.max(0, Math.round(Number(row?.overtimeMinutes ?? row?.overtime_minutes ?? otEntry?.actualMinutes ?? otEntry?.overtimeMinutes) || 0))
    : 0;

  const awaiting = [];
  if (row?.location_status === "outside" && !row?.excused) awaiting.push("outside");
  if (!checkOut && shift && isForgottenCheckout(shift, row, dateKey < todayKey ? endOfDay(dateKey).getTime() + 86400000 : now.getTime())) awaiting.push("missing");
  if (lateReturnOpen && lateReturn > 0) awaiting.push("late_return");
  if (otEntry && overtime > 0 && isOtDecisionOpen(otEntry)) awaiting.push("ot");

  return { lateReturn, lateReturnExcused, early, overtime, awaiting, pending };
}

export const AWAIT_LABEL = {
  outside: ["خارج النطاق بلا اعتماد", "Outside range, not approved"],
  missing: ["حضور بلا انصراف", "No checkout"],
  late_return: ["عودة متأخرة بلا قرار", "Late return, no decision"],
  ot: ["إضافي بانتظار القرار", "Overtime awaiting a decision"],
};

/** Plain «ساعة و15 دقيقة» / «40 دقيقة». */
export function minutesPhrase(minutes, ar = true) {
  const n = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (!ar) return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
  if (!h) return `${m} دقيقة`;
  const hours = h === 1 ? "ساعة" : h === 2 ? "ساعتان" : `${h} ساعات`;
  return m ? `${hours} و${m} دقيقة` : hours;
}
