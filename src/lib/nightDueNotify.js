/** One employee notice per 18632 due cycle — never weekly spam. */
import { nightDueAdminAudience } from "./dutyScope.js";
import { statutoryGlowState } from "./statutoryItem.js";
import {
  nightCycleKey,
  nightMonthsFromWeeks,
  nightRotateDue,
  nightScheduleFor,
  pendingNightRotate,
} from "./nightRotateCycle.js";
import { employeeWorkStationId, weekStartDate } from "./shiftWeek.js";

/**
 * One notice per request: the key carries the open request's id, so a request that lapsed with the
 * roster and reopened the same month is announced again (the old key was employee + month only).
 */
export function nightDueNotifyKey(employeeId, cycleKey, requestId = "") {
  return `18632-due:${employeeId}:${cycleKey}${requestId ? `:${requestId}` : ""}`;
}

export function nightDueAdminNotifyKey(managerId, employeeId, cycleKey, requestId = "") {
  return `18632-due-admin:${managerId}:${employeeId}:${cycleKey}${requestId ? `:${requestId}` : ""}`;
}

export function scheduleForEmployee(data, employee, schedules) {
  const sid = String(employeeWorkStationId(employee) || employee?.stationId || "");
  const list = schedules || data?.schedules || [];
  return list.find((row) => String(row.stationId) === sid) || { shiftTypes: [], assignments: {} };
}

/** The roster that holds the worker's nights — own station, else a covered one (nightScheduleFor). */
export function nightRosterForEmployee(data, employee, schedules, weekStart) {
  const list = schedules || data?.schedules || [];
  const held = nightScheduleFor({ ...(data || {}), schedules: list }, employee, weekStart || new Date());
  return held && list.includes(held) ? held : scheduleForEmployee(data, employee, schedules);
}

export function nightDueNotifyText(months, ar = true) {
  return ar
    ? `مستحق في طلباتي بعد ${months} أشهر كعامل ليلي (القرار 18632). وافق أو ارفض. إن وافقت تُحفظ الموافقة مع حق سحبها في أي وقت.`
    : `Due in My Requests after ${months} months as a night worker (decision 18632). Agree or refuse. If you agree, consent stays on file with the right to withdraw at any time.`;
}

/** The worker's request closed by the roster (no night this week) — said once per request. */
export function nightLapseNotifyText(ar = true) {
  return ar
    ? "أُغلق طلب موافقة العمل الليلي (القرار 18632) لأن جدولك هذا الأسبوع بلا ليالٍ. إن عادت الليالي يُفتح لك طلب جديد في طلباتي."
    : "Your night-work consent request (decision 18632) closed because this week has no nights. If nights return, a new request opens in My Requests.";
}

export function nightLapseAdminNotifyText(employeeName, ar = true) {
  const name = String(employeeName || "").trim() || (ar ? "موظف" : "A worker");
  return ar
    ? `أُغلق طلب موافقة ${name} الليلية (القرار 18632) — جدوله هذا الأسبوع بلا ليالٍ.`
    : `${name}'s night consent request (decision 18632) closed — no nights this week.`;
}

export function nightDueAdminNotifyText(employeeName, months, ar = true) {
  const name = String(employeeName || "").trim() || (ar ? "موظف" : "A worker");
  return ar
    ? `${name} مستحق موافقة خطية ليلية (القرار 18632) بعد ${months} أشهر. يوافق أو يرفض من طلباتي. سكوتك لا يغلقها.`
    : `${name} is due for night written consent (decision 18632) after ${months} months. They agree or refuse in My Requests. Your silence does not close it.`;
}

/**
 * Employees whose 18632 glow is due, with an idempotent key on employee + period.
 * A second call with the same keys returns nothing.
 */
export function planNightDueNotifications({
  employees = [],
  data,
  schedules,
  weekStart,
  existingKeys = [],
  ar = true,
} = {}) {
  const start = weekStartDate(weekStart || new Date());
  const seen = new Set((existingKeys || []).filter(Boolean));
  const plans = [];
  for (const employee of employees) {
    if (!employee?.id) continue;
    const schedule = nightRosterForEmployee(data, employee, schedules, start);
    if (statutoryGlowState({ kind: "18632", employee, schedule, weekStart: start }) !== "due") continue;
    const rotate = nightRotateDue({ employee, schedule, weekStart: start });
    const pending = pendingNightRotate(employee);
    const cycleKey = rotate.cycleKey || pending?.cycleKey || nightCycleKey(start);
    const key = nightDueNotifyKey(employee.id, cycleKey, pending?.id);
    if (seen.has(key)) continue;
    seen.add(key);
    const months = rotate.months ?? pending?.months ?? nightMonthsFromWeeks(rotate.weeks || pending?.weeks || 0);
    plans.push({
      employeeId: employee.id,
      cycleKey,
      key,
      text: nightDueNotifyText(months, ar),
    });
  }
  return plans;
}

/**
 * One إدارة notice per manager × employee × due cycle.
 * Fires even when the worker's طلباتي row is already open.
 */
export function planNightDueAdminNotifications({
  employees = [],
  data,
  schedules,
  weekStart,
  existingKeys = [],
  ar = true,
} = {}) {
  const start = weekStartDate(weekStart || new Date());
  const seen = new Set((existingKeys || []).filter(Boolean));
  const plans = [];
  for (const employee of employees) {
    if (!employee?.id) continue;
    const schedule = nightRosterForEmployee(data, employee, schedules, start);
    if (statutoryGlowState({ kind: "18632", employee, schedule, weekStart: start }) !== "due") continue;
    const rotate = nightRotateDue({ employee, schedule, weekStart: start });
    const pending = pendingNightRotate(employee);
    const cycleKey = rotate.cycleKey || pending?.cycleKey || nightCycleKey(start);
    const months = rotate.months ?? pending?.months ?? nightMonthsFromWeeks(rotate.weeks || pending?.weeks || 0);
    const text = nightDueAdminNotifyText(employee.name, months, ar);
    for (const manager of nightDueAdminAudience(data, employee)) {
      const key = nightDueAdminNotifyKey(manager.id, employee.id, cycleKey, pending?.id);
      if (seen.has(key)) continue;
      seen.add(key);
      plans.push({
        employeeId: employee.id,
        managerId: manager.id,
        cycleKey,
        key,
        text,
      });
    }
  }
  return plans;
}
