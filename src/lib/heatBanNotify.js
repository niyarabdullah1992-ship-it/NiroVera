/**
 * Decision 3337 — notices at the start of the midday ban window (12:00 on a season day).
 * Not a publish gate: a reminder to the exposed worker and his managers, plus one plain
 * information line for every employee. Keys are per person × day, so each fires once.
 */
import { nightDueAdminAudience } from "./dutyScope.js";
import { scheduleForEmployee } from "./nightDueNotify.js";
import { heatBanWindow, isHeatBanDate } from "./contractLawDerivations.js";
import {
  SUN_FIELD,
  employeeShiftOnDay,
  isRosterLeaveDay,
  shiftTouchesHeatWindow,
  sunExposureMark,
} from "./shiftWeek.js";

function dayKeyOf(now) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** True between the window start and end on a season day (local clock). */
export function heatBanWindowOpen(now = new Date()) {
  const key = dayKeyOf(now);
  if (!isHeatBanDate(key)) return false;
  const win = heatBanWindow(key);
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= win.startHour * 60 && minutes < win.endHour * 60;
}

export function heatBanInfoText(win, ar = true) {
  return ar
    ? `معلومة — حظر العمل المكشوف (القرار 3337): من ${win.startLabel} إلى ${win.endLabel} اليوم يُمنع العمل تحت أشعة الشمس المباشرة في المواقع المكشوفة، ${win.seasonAr}.`
    : `Information — open-sun ban (Decision 3337): from ${win.startLabel} to ${win.endLabel} today, work in direct sun at exposed sites is banned, ${win.seasonEn}.`;
}

export function heatBanWorkerText(win, shiftLabel, ar = true) {
  return ar
    ? `مخالفة حظر الشمس — بدأت الآن ساعات الحظر (${win.startLabel}–${win.endLabel}). ورديتك اليوم «${shiftLabel}» محدَّدة «مكشوف»، ووفق القرار 3337 لا يجوز تشغيلك تحت أشعة الشمس حتى ${win.endLabel}. يحق لك رفض العمل المكشوف والانتقال إلى مكان مظلّل.`
    : `Sun-ban alert — the ban hours have started (${win.startLabel}–${win.endLabel}). Your “${shiftLabel}” shift today is marked exposed: you may not be required to work in the sun until ${win.endLabel} (Decision 3337).`;
}

export function heatBanManagerText(win, name, shiftLabel, exposed, ar = true) {
  const who = String(name || "").trim() || (ar ? "موظف" : "A worker");
  if (exposed) {
    return ar
      ? `مخالفة حظر الشمس — بدأت ساعات الحظر (${win.startLabel}–${win.endLabel}). ${who} في وردية «${shiftLabel}» محدَّد «مكشوف» اليوم، وتشغيله تحت الشمس مخالفة للقرار 3337: أوقف عمله المكشوف أو انقله إلى مكان مظلّل حتى ${win.endLabel}.`
      : `Sun-ban alert — the ban hours have started (${win.startLabel}–${win.endLabel}). ${who} on “${shiftLabel}” is marked exposed today: stop sun work or move them to shade until ${win.endLabel} (Decision 3337).`;
  }
  return ar
    ? `تنبيه حظر الشمس — ${who} في وردية «${shiftLabel}» تلمس ساعات الحظر اليوم ولم يُحدَّد «مكشوف / مظلّل». تأكد أنه لا يعمل تحت الشمس حتى ${win.endLabel} (القرار 3337).`
    : `Sun-ban alert — ${who} on “${shiftLabel}” touches the ban hours today with no exposed/shaded mark. Make sure they are not in the sun until ${win.endLabel} (Decision 3337).`;
}

/**
 * Plans for this moment. Empty outside the window. Each plan: { userId, key, text }.
 */
export function planHeatBanNotices({ data, now = new Date(), existingKeys = [], laborCalendar, ar = true } = {}) {
  if (!data || !heatBanWindowOpen(now)) return [];
  const key = dayKeyOf(now);
  const win = heatBanWindow(key);
  const seen = new Set((existingKeys || []).filter(Boolean));
  const plans = [];
  const push = (userId, noticeKey, text) => {
    if (!userId || seen.has(noticeKey)) return;
    seen.add(noticeKey);
    plans.push({ userId, key: noticeKey, text });
  };
  const employees = (data.employees || []).filter((row) => row?.id && row.status !== "terminated" && row.status !== "inactive");
  for (const employee of employees) {
    // Information for everyone, once a day.
    push(employee.id, `3337-info:${employee.id}:${key}`, heatBanInfoText(win, ar));
    if (isRosterLeaveDay(employee, key, laborCalendar)) continue;
    const schedule = scheduleForEmployee(data, employee);
    const shift = employeeShiftOnDay(schedule, employee.id, key);
    if (!shift || !shiftTouchesHeatWindow(shift)) continue;
    const { mark } = sunExposureMark(schedule, employee.id, key, shift);
    const exposed = mark === SUN_FIELD;
    const label = shift.label || shift.id;
    // The live duty alert («نافذة حظر العمل المكشوف بدأت», dutyAlerts.js) may have told him first — once is enough.
    const dutyTold = [...seen].some((k) => k.startsWith(`duty-alert:${employee.id}:${key}:`) && k.endsWith(":heat_now"));
    if (exposed && !dutyTold) push(employee.id, `3337-worker:${employee.id}:${key}`, heatBanWorkerText(win, label, ar));
    if (exposed || !mark) {
      for (const manager of nightDueAdminAudience(data, employee)) {
        push(manager.id, `3337-admin:${manager.id}:${employee.id}:${key}`, heatBanManagerText(win, employee.name, label, exposed, ar));
      }
    }
  }
  return plans;
}
