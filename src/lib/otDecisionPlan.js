/** otDecisions writers — pure (draft in, draft mutated), so the store stays thin and node can test them.
 *  Entry shape payroll reads: otDecisions["<employeeId>:<YYYY-MM-DD>"] =
 *    { decision: "pending" | "pending_worker_cap_consent" | "approve" | "comp_leave" | "reject",
 *      overtimeMinutes, holiday?: true, source?: "holiday_work" | "actual_punch" | "ot_assignment",
 *      workedProven?: true, actualMinutes?, plannedMinutes?, workerCapConsentAt? }
 *  «pending» is never unpaid: it is a decision the manager still owes (pay or compensatory leave).
 */

import { checkOtDecisionGate, isOtDecisionOpen, overtimeYearUsageOutsideAssignments } from "./attendanceDerivations.js";
import { actualDutyBreaches, deriveActualDuty } from "./actualDuty.js";
import { addDays, employeeShiftOnDay, holidayWorkOn, parseDateKey, weekDateKeys, weekKeyFromDate, weekNamedOvertime, weekPublishState } from "./shiftWeek.js";
import { laborCalendarOf } from "./ummAlQuraCalendar.js";
import { toRiyadhDateKey } from "./riyadhDate.js";
import { OT_STATUS, isOvertimeAssignment, otCompensationOf, parseOtHours, OT_COMP_CREDIT } from "./overtimeAssignment.js";

const OT_KEY_DAY = (dayKey) => String(dayKey || "").slice(0, 10);

/**
 * Minutes an approved overtime ASSIGNMENT (any compensation — pay or compensatory leave) already
 * covers on that day. Those hours were compensated through the assignment (Art. 107 / Regs Art. 22 bis),
 * so the punch path must not open a second decision for them.
 */
export function assignmentMinutesOn(employee, dayKey, { compensation } = {}) {
  const day = OT_KEY_DAY(dayKey);
  return (employee?.otherRequests || []).reduce((sum, row) => {
    if (!isOvertimeAssignment(row) || row.status !== OT_STATUS.approved) return sum;
    if (compensation && otCompensationOf(row) !== compensation) return sum;
    if (String(row.date || "").slice(0, 10) !== day) return sum;
    return sum + Math.round((parseOtHours(row.hours) || 0) * 60);
  }, 0);
}

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
      // The roster is a plan, not proof: once punches proved the day, their ACTUAL minutes stay —
      // a re-publish never raises (or lowers) them back to the planned figure.
      const proven = prev?.workedProven === true;
      d.otDecisions[key] = {
        ...(prev || {}),
        decision: prev?.decision === "pending_worker_cap_consent" ? prev.decision : "pending",
        holiday: true,
        kind: "holiday",
        article: "107/3",
        overtimeMinutes: proven ? Number(prev.actualMinutes ?? prev.overtimeMinutes) || 0 : row.overtimeMinutes,
        plannedMinutes: row.overtimeMinutes,
        source: proven ? "actual_punch" : "holiday_work",
        workedProven: proven || undefined,
        at: new Date().toISOString(),
      };
      stamped.push(key);
    }
  }
  return stamped;
}

/**
 * Art. 107(3) — the holiday duty was withdrawn from the roster: the open entry the publish stamped
 * from the PLAN goes with it. An entry the punches proved, or one already decided, stays.
 */
export function withdrawHolidayWorkOvertime(d, employeeId, dayKey) {
  const key = `${employeeId}:${OT_KEY_DAY(dayKey)}`;
  const prev = d?.otDecisions?.[key];
  if (!prev || !isOtDecisionOpen(prev) || prev.workedProven === true || prev.source !== "holiday_work") return false;
  delete d.otDecisions[key];
  return true;
}

/**
 * Regs Art. 22 bis — a compensatory-leave assignment approved after the punches already opened a
 * decision for the same day: the assigned hours leave that open entry (they are compensated by the
 * leave), so the same hours are never also paid. Returns the minutes left on the entry.
 */
export function absorbAssignmentIntoActualOt(d, employeeId, request) {
  if (!isOvertimeAssignment(request) || otCompensationOf(request) !== OT_COMP_CREDIT) return null;
  const key = `${employeeId}:${OT_KEY_DAY(request.date)}`;
  const prev = d?.otDecisions?.[key];
  if (!prev || !isOtDecisionOpen(prev) || prev.source !== "actual_punch") return null;
  const covered = Math.round((parseOtHours(request.hours) || 0) * 60);
  const left = Math.max(0, (Number(prev.overtimeMinutes) || 0) - covered);
  if (left <= 0) {
    delete d.otDecisions[key];
    return 0;
  }
  prev.overtimeMinutes = left;
  prev.assignmentMinutes = (Number(prev.assignmentMinutes) || 0) + covered;
  return left;
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
 * Art. 101 breaches a closed day proves (`actualDutyBreaches`: the rests it actually had — recorded
 * breaks, else the roster's break inside the presence) — written where the day's breaches already
 * live: the attendance row's `actualFlags` (the same codes stampActualOvertime writes). Adds, never
 * removes, and returns the codes added. An open day writes nothing.
 */
export function stampActualDutyBreaches(d, employee, dayKey, row) {
  if (!employee?.id || !row) return [];
  const checkIn = row.checkInAt || row.check_in_at;
  const checkOut = row.checkOutAt || row.check_out_at;
  if (!checkIn || !checkOut) return [];
  const shift = rosterShiftFor(d, employee, dayKey);
  const flags = actualDutyBreaches({ checkIn, checkOut, shift, onDate: dayKey, employee, company: d, laborCalendar: laborCalendarOf(d), breaks: row.breaks });
  const have = new Set(Array.isArray(row.actualFlags) ? row.actualFlags : []);
  const added = flags.map((flag) => flag.error).filter((code) => !have.has(code));
  if (added.length || !Array.isArray(row.actualFlags)) row.actualFlags = [...have, ...added];
  return added;
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
  // A planned-only entry the manager closed as «not worked» reopens when punches prove the day.
  const closedUnworked = prev && prev.decision === "reject" && prev.workedProven !== true;
  if (prev && !isOtDecisionOpen(prev) && !closedUnworked) {
    prev.actualMinutes = actual.overtimeMinutes;
    // A PAID assignment already approved for the day («ot_assignment»): its hours are not opened again.
    // Punches beyond it reopen the day as ONE pending decision for the full actual minutes (the
    // assignment's hours inside), so no hour is lost and none is paid twice.
    const assigned = prev.source === "ot_assignment" ? Number(prev.overtimeMinutes) || 0 : 0;
    if (assigned > 0 && actual.overtimeMinutes > assigned) {
      d.otDecisions[key] = {
        ...prev,
        decision: "pending",
        assignmentMinutes: assigned,
        assignmentDecision: prev.decision,
        overtimeMinutes: actual.overtimeMinutes,
        source: "actual_punch",
        workedProven: true,
        flags: actual.flags.map((flag) => flag.error),
        at: new Date().toISOString(),
      };
    }
    return actual;
  }
  // Hours an approved COMPENSATORY-LEAVE assignment already compensates are not opened again here —
  // otherwise the same hours are paid and taken as leave. (A paid assignment owns its own decided
  // «ot_assignment» entry, handled above; when the punches came first, the open entry carries it.)
  const covered = assignmentMinutesOn(employee, dayKey, { compensation: OT_COMP_CREDIT });
  const minutes = Math.max(0, actual.overtimeMinutes - covered);
  row.otCoveredByAssignment = covered || undefined;
  if (minutes <= 0) {
    if (prev && isOtDecisionOpen(prev) && prev.source === "actual_punch") delete d.otDecisions[key];
    return actual;
  }
  const reopened = closedUnworked ? { decision: "pending", by: undefined, reopenedAt: new Date().toISOString() } : {};
  d.otDecisions[key] = {
    ...(prev || {}),
    ...reopened,
    decision: !closedUnworked && prev?.decision === "pending_worker_cap_consent" ? prev.decision : "pending",
    overtimeMinutes: minutes,
    actualMinutes: actual.overtimeMinutes,
    assignmentMinutes: covered || undefined,
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
  today,
} = {}) {
  const day = String(dateKey || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { ok: false, error: "DATE_REQUIRED", reason: "حدد يوم الإضافي.", reasonEn: "Set the overtime day." };
  }
  const key = `${employeeId}:${day}`;
  const existing = live?.otDecisions?.[key] || null;
  const punch = (live?.personalAttendance || []).find((row) => String(row.employeeId) === String(employeeId) && String(row.date || "").slice(0, 10) === day);
  // Only real punches prove work (Art. 107). A holiday entry stamped from the published roster is a
  // PLAN: it may be paid once worked, or closed as «not worked» — it is never proof by itself.
  const workedProven = existing?.workedProven === true
    || !!(punch && (punch.checkOutAt || punch.check_out_at));
  const workerCapConsent = !!existing?.workerCapConsentAt;
  // Punches are the figure: a proven entry is decided on its own minutes (net of any compensatory-leave
  // assignment), never on a planned or typed figure.
  const proven = existing?.workedProven === true ? Number(existing.overtimeMinutes) || 0 : 0;
  const minutes = proven > 0
    ? proven
    : (Number(overtimeMinutes) || Number(existing?.overtimeMinutes) || 0);
  const asOf = String(today || toRiyadhDateKey()).slice(0, 10);
  const plannedOnly = existing?.holiday === true && !workedProven;
  if (plannedOnly && day >= asOf && String(decision || "approve") !== "reject") {
    return {
      ok: false,
      error: "OT_NOT_WORKED_YET",
      reason: "موقوف — المادة 107: العمل في العطلة ما زال مخططاً في الجدول ولم يُثبته الحضور والانصراف بعد — يُقرَّر أجره بعد أن يُعمل.",
      reasonEn: "Blocked — Article 107: the holiday work is still only planned on the roster and no punches prove it yet — its pay is decided once it is worked.",
    };
  }
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
      notWorked: plannedOnly && gate.decision === "reject" ? true : undefined,
    },
    result: { ok: true, decision: gate.decision },
  };
}

/* ---------------- planned roster overtime (a plan, not proof) ---------------- */

export const PLANNED_OT_LABEL_AR = "مخطط — لم يُعمل بعد";
export const PLANNED_OT_LABEL_EN = "Planned — not worked yet";

/**
 * How the decision board treats one day — the same rules as planOtDecision:
 * - punches proved it → a decision the manager owes (pay or compensatory leave, never reject);
 * - a holiday entry stamped from the published roster but unproven → «planned»; payable only once the
 *   day has passed (OT_NOT_WORKED_YET before), and closable as «not worked»;
 * - roster-named overtime with no entry at all → «planned», not payable: the decision opens when the
 *   punches stamp the day (stampActualOvertime);
 * - any other open entry (an assignment re-opened, a cap-consent request) → decidable as before.
 */
export function otDayStatus(entry, dateKey, today) {
  const day = OT_KEY_DAY(dateKey);
  const asOf = String(today || toRiyadhDateKey()).slice(0, 10);
  if (entry && !isOtDecisionOpen(entry)) return { planned: false, payable: false, closable: false, decided: true };
  if (entry?.workedProven === true) return { planned: false, payable: true, closable: false, decided: false };
  if (entry?.holiday === true) return { planned: true, payable: day < asOf, closable: true, decided: false };
  if (entry) return { planned: false, payable: true, closable: false, decided: false };
  return { planned: true, payable: false, closable: false, decided: false };
}

function scheduleForWeek(d, employee, weekKey) {
  const own = String(employee?.profile?.workStationId || employee?.stationId || "");
  const list = [...(d?.schedules || [])].sort((a, b) => (String(b.stationId) === own) - (String(a.stationId) === own));
  const keys = weekDateKeys(weekKey);
  return list.find((schedule) => keys.some((key) => employeeShiftOnDay(schedule, employee.id, key))) || null;
}

/**
 * Art. 107 — overtime the PUBLISHED roster already names for the current and next week (beyond the
 * day/week cap, weekly rest, confirmed holiday work) that no punch has proven yet. Shown on the board
 * labelled «مخطط — لم يُعمل بعد»: visible to the manager and the worker, never payable until worked.
 * Returns [{ weekKey, stationId, employeeId, rows: [{ dateKey, overtimeMinutes, kind }] }].
 */
export function plannedOtWeeks(d, employees = [], { today } = {}) {
  const asOf = String(today || toRiyadhDateKey()).slice(0, 10);
  const todayDate = parseDateKey(asOf) || new Date();
  const current = weekKeyFromDate(todayDate);
  const next = weekKeyFromDate(addDays(parseDateKey(current), 7));
  const calendar = laborCalendarOf(d);
  const out = [];
  for (const employee of employees || []) {
    if (!employee?.id) continue;
    for (const weekKey of [current, next]) {
      const schedule = scheduleForWeek(d, employee, weekKey);
      if (!schedule) continue;
      const state = weekPublishState(schedule, weekKey, todayDate);
      if (!(state.kind === "published" || (state.kind === "edited" && state.snap))) continue;
      const named = weekNamedOvertime(schedule, employee, weekKey, d, calendar, true);
      const byDay = new Map();
      for (const row of named.rows || []) {
        if (!(row.overtimeMinutes > 0)) continue;
        byDay.set(row.dateKey, { dateKey: row.dateKey, kind: row.kind, overtimeMinutes: (byDay.get(row.dateKey)?.overtimeMinutes || 0) + row.overtimeMinutes });
      }
      const rows = [...byDay.values()].filter((row) => otDayStatus(d?.otDecisions?.[`${employee.id}:${row.dateKey}`], row.dateKey, asOf).planned);
      if (!rows.length) continue;
      out.push({ weekKey, stationId: String(schedule.stationId || ""), employeeId: String(employee.id), rows });
    }
  }
  return out;
}
