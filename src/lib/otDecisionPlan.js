/** otDecisions writers — pure (draft in, draft mutated), so the store stays thin and node can test them.
 *  Entry shape payroll reads: otDecisions["<employeeId>:<YYYY-MM-DD>"] =
 *    { decision: "pending" | "pending_worker_cap_consent" | "approve" | "comp_leave" | "reject",
 *      overtimeMinutes, holiday?: true, source?: "holiday_work" | "actual_punch" | "ot_assignment",
 *      workedProven?: true, actualMinutes?, plannedMinutes?, workerCapConsentAt? }
 *  «pending» is never unpaid: it is a decision the manager still owes (pay or compensatory leave).
 */

import { checkOtDecisionGate, isOtDecisionOpen, overtimeYearUsageOutsideAssignments } from "./attendanceDerivations.js";
import { deriveActualDuty } from "./actualDuty.js";
import { employeeShiftOnDay, holidayWorkOn, weekNamedOvertime } from "./shiftWeek.js";
import { laborCalendarOf } from "./ummAlQuraCalendar.js";

/**
 * Art. 107(3) — confirmed «عمل في العطلة» on a published week becomes an otDecisions entry flagged
 * `holiday: true`, every hour as overtime, decision «pending» for the manager's pay choice.
 * An entry already decided is never rewritten.
 */
export function stampHolidayWorkOvertime(d, schedule, weekStart) {
  const calendar = laborCalendarOf(d);
  d.otDecisions = d.otDecisions || {};
  const stamped = [];
  for (const employee of d.employees || []) {
    if (!employee?.holidayWork) continue;
    const named = weekNamedOvertime(schedule, employee, weekStart, d, calendar, true);
    for (const row of named.rows) {
      if (row.kind !== "holiday" || !holidayWorkOn(employee, row.dateKey)) continue;
      const key = `${employee.id}:${row.dateKey}`;
      const prev = d.otDecisions[key];
      if (prev && !isOtDecisionOpen(prev)) continue;
      d.otDecisions[key] = {
        ...(prev || {}),
        decision: prev?.decision === "pending_worker_cap_consent" ? prev.decision : "pending",
        holiday: true,
        kind: "holiday",
        article: "107/3",
        overtimeMinutes: Math.max(Number(prev?.overtimeMinutes) || 0, row.overtimeMinutes),
        plannedMinutes: row.overtimeMinutes,
        source: prev?.source === "actual_punch" ? "actual_punch" : "holiday_work",
        workedProven: prev?.workedProven || undefined,
        at: new Date().toISOString(),
      };
      stamped.push(key);
    }
  }
  return stamped;
}

/** The rostered shift this person holds that day on any station's roster (their own first). */
export function rosterShiftFor(d, employee, dayKey) {
  const own = String(employee?.profile?.workStationId || employee?.stationId || "");
  const list = [...(d?.schedules || [])].sort((a, b) => (String(b.stationId) === own) - (String(a.stationId) === own));
  for (const schedule of list) {
    const shift = employeeShiftOnDay(schedule, employee.id, dayKey);
    if (shift) return shift;
  }
  return null;
}

/**
 * Arts 101/106/107 — a checked-out day is read against the rostered shift and its ACTUAL overtime
 * is written to otDecisions for the manager (pending). Worked hours are proven: paid or turned into
 * compensatory leave, never rejected (checkOtDecisionGate «OT_WORKED_NO_REJECT»).
 */
export function stampActualOvertime(d, employee, dayKey, row) {
  if (!employee?.id || !row) return null;
  const checkIn = row.checkInAt || row.check_in_at;
  const checkOut = row.checkOutAt || row.check_out_at;
  if (!checkIn || !checkOut) return null;
  const calendar = laborCalendarOf(d);
  const shift = rosterShiftFor(d, employee, dayKey);
  const actual = deriveActualDuty({ checkIn, checkOut, shift, onDate: dayKey, employee, company: d, laborCalendar: calendar, breaks: row.breaks });
  if (!actual.ok) return actual;
  row.workedMinutes = actual.workedMinutes;
  row.overtimeMinutes = actual.overtimeMinutes;
  row.actualFlags = actual.flags.map((flag) => flag.error);
  if (actual.overtimeMinutes <= 0) return actual;
  d.otDecisions = d.otDecisions || {};
  const key = `${employee.id}:${dayKey}`;
  const prev = d.otDecisions[key];
  if (prev && !isOtDecisionOpen(prev)) {
    prev.actualMinutes = actual.overtimeMinutes;
    return actual;
  }
  d.otDecisions[key] = {
    ...(prev || {}),
    decision: prev?.decision === "pending_worker_cap_consent" ? prev.decision : "pending",
    overtimeMinutes: actual.overtimeMinutes,
    actualMinutes: actual.overtimeMinutes,
    holiday: actual.holiday || prev?.holiday === true || undefined,
    kind: actual.kind || prev?.kind,
    source: "actual_punch",
    workedProven: true,
    flags: actual.flags.map((flag) => flag.error),
    at: new Date().toISOString(),
  };
  return actual;
}

/**
 * The manager's overtime decision as a plan: `{ ok, key, entry, result }`, or a named refusal.
 * - Proven work (punches / confirmed holiday duty) cannot be rejected (Art. 107).
 * - Passing the annual 720h cap needs the WORKER's consent (Regs Art. 22): without it the plan records
 *   «pending_worker_cap_consent» (consent requested) instead of deciding — a manager tick is not consent.
 */
export function planOtDecision(live, employeeId, dateKey, {
  decision,
  overtimeMinutes,
  by,
  workerConsent,
  enjoyDate,
  windowAgreed,
  extraHoursYtd = 0,
  extraCreditDaysYtd = 0,
} = {}) {
  const day = String(dateKey || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { ok: false, error: "DATE_REQUIRED", reason: "حدد يوم الإضافي.", reasonEn: "Set the overtime day." };
  }
  const key = `${employeeId}:${day}`;
  const existing = live?.otDecisions?.[key] || null;
  const punch = (live?.personalAttendance || []).find((row) => String(row.employeeId) === String(employeeId) && String(row.date || "").slice(0, 10) === day);
  const workedProven = existing?.workedProven === true || existing?.holiday === true
    || !!(punch && (punch.checkOutAt || punch.check_out_at));
  const workerCapConsent = !!existing?.workerCapConsentAt;
  const minutes = existing?.workedProven || existing?.holiday
    ? Math.max(Number(overtimeMinutes) || 0, Number(existing.overtimeMinutes) || 0)
    : overtimeMinutes;
  const usage = overtimeYearUsageOutsideAssignments(live?.otDecisions, employeeId, day);
  const gate = checkOtDecisionGate({
    overtimeMinutes: minutes,
    decision,
    alreadyDecided: !!existing && !isOtDecisionOpen(existing),
    workerConsent,
    annualCapConsent: workerCapConsent,
    enjoyDate,
    windowAgreed,
    workedProven,
    onDate: day,
    overtimeHoursYtd: Math.round((usage.hours + (Number(extraHoursYtd) || 0)) * 10) / 10,
    creditDaysYtd: Math.round((usage.creditDays + (Number(extraCreditDaysYtd) || 0)) * 1000) / 1000,
  });
  if (!gate.ok && gate.error === "OT_ANNUAL_CAP") {
    return {
      ok: true,
      key,
      cap: gate.cap,
      capConsentRequested: true,
      entry: {
        decision: "pending_worker_cap_consent",
        requestedDecision: String(decision || "approve"),
        overtimeMinutes: Math.max(0, Number(minutes) || 0),
        capConsentRequestedAt: new Date().toISOString(),
        capConsentRequestedBy: by || "",
        workerConsent: workerConsent === true ? true : undefined,
        enjoyDate: enjoyDate || undefined,
        windowAgreed: windowAgreed === true ? true : undefined,
        workedProven: workedProven || undefined,
      },
      result: {
        ok: true,
        decision: "pending_worker_cap_consent",
        capConsentRequested: true,
        reason: `طُلبت موافقة العامل على تجاوز ${gate.cap} ساعة في السنة (اللائحة م22) — القرار ينتظر قبوله من طلباتي.`,
        reasonEn: `The worker's consent to pass ${gate.cap} hours a year was requested (Regs Art. 22) — the decision waits for his acceptance in My Requests.`,
      },
    };
  }
  if (!gate.ok) return gate;
  return {
    ok: true,
    key,
    entry: {
      decision: gate.decision,
      overtimeMinutes: gate.overtimeMinutes,
      at: new Date().toISOString(),
      by: by || "",
      workerConsent: gate.workerConsent || undefined,
      annualCapConsent: workerCapConsent ? true : undefined,
      enjoyDate: enjoyDate || undefined,
      windowAgreed: windowAgreed === true ? true : undefined,
    },
    result: { ok: true, decision: gate.decision },
  };
}
