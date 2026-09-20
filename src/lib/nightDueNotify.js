/** One employee notice per 18632 due cycle — never weekly spam. */
import { nightDueAdminAudience } from "./dutyScope.js";
import { statutoryGlowState } from "./statutoryItem.js";
import {
  nightCycleKey,
  nightMonthsFromWeeks,
  nightRotateDue,
  pendingNightRotate,
} from "./nightRotateCycle.js";
import { employeeWorkStationId, weekStartDate } from "./shiftWeek.js";

export function nightDueNotifyKey(employeeId, cycleKey) {
  return `18632-due:${employeeId}:${cycleKey}`;
}

export function nightDueAdminNotifyKey(managerId, employeeId, cycleKey) {
  return `18632-due-admin:${managerId}:${employeeId}:${cycleKey}`;
}

export function scheduleForEmployee(data, employee, schedules) {
  const sid = String(employeeWorkStationId(employee) || employee?.stationId || "");
  const list = schedules || data?.schedules || [];
  return list.find((row) => String(row.stationId) === sid) || { shiftTypes: [], assignments: {} };
}

export function nightDueNotifyText(months, ar = true) {
  return ar
    ? `مستحق في طلباتي بعد ${months} أشهر كعامل ليلي (القرار 18632). وافق أو ارفض. إن وافقت تُحفظ الموافقة مع حق سحبها في أي وقت.`
    : `Due in My Requests after ${months} months as a night worker (decision 18632). Agree or refuse. If you agree, consent stays on file with the right to withdraw at any time.`;
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
    const schedule = scheduleForEmployee(data, employee, schedules);
    if (statutoryGlowState({ kind: "18632", employee, schedule, weekStart: start }) !== "due") continue;
    const rotate = nightRotateDue({ employee, schedule, weekStart: start });
    const pending = pendingNightRotate(employee);
    const cycleKey = rotate.cycleKey || pending?.cycleKey || nightCycleKey(start);
    const key = nightDueNotifyKey(employee.id, cycleKey);
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
    const schedule = scheduleForEmployee(data, employee, schedules);
    if (statutoryGlowState({ kind: "18632", employee, schedule, weekStart: start }) !== "due") continue;
    const rotate = nightRotateDue({ employee, schedule, weekStart: start });
    const pending = pendingNightRotate(employee);
    const cycleKey = rotate.cycleKey || pending?.cycleKey || nightCycleKey(start);
    const months = rotate.months ?? pending?.months ?? nightMonthsFromWeeks(rotate.weeks || pending?.weeks || 0);
    const text = nightDueAdminNotifyText(employee.name, months, ar);
    for (const manager of nightDueAdminAudience(data, employee)) {
      const key = nightDueAdminNotifyKey(manager.id, employee.id, cycleKey);
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
