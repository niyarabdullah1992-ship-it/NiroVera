/** Actual duty from punches (Arts 101, 106, 107) — read against the ROSTERED shift, never a fixed 07:00/8h.
 *  Pure: no store access. The store feeds the result into otDecisions for the manager's pay decision.
 */

import { citeRule, ruleValue } from "./laborRules.js";
import { art108Limits, hoursBasisOf, hoursPolicyOf, isEmployeeOffDay, ordinaryDayCap } from "./laborHoursPolicy.js";
import { isOfficialHoliday } from "./ummAlQuraCalendar.js";
import { actualShiftHours, isTwelveStayDuty } from "./shiftWeek.js";
import { checkConsecutiveWorkGate, minutesBetween, shiftRestMinutes } from "./shiftDerivations.js";

/** "HH:MM", or an ISO instant read on the Riyadh clock → minutes after midnight. null when unreadable. */
export function punchClockMinutes(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const hm = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const part = (type) => Number(parts.find((row) => row.type === type)?.value || 0);
  return part("hour") * 60 + part("minute");
}

function clock(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * One day of punches → presence, rest, worked, ordinary and overtime minutes, plus named breaches.
 * - Rest (Art. 102) is deducted: recorded breaks first, else the rostered rest when presence passed five hours.
 * - Overtime (Art. 107): all of it on an official holiday or an unrostered off day (107(3));
 *   on the weekly criterion (Art. 98 basis weekly, or a 12h-stay duty) only what passes the rostered shift;
 *   otherwise what passes the day's ordinary cap (98 / 99 / Ramadan / Art. 108 category).
 * - Flags: presence > 12 h (Art. 101, or the Art. 108 ceiling), work > 10 h (Art. 106 / category),
 *   more than five hours without a rest (Art. 101, unless Art. 103 continuous work).
 */
export function deriveActualDuty({
  checkIn,
  checkOut,
  shift = null,
  onDate,
  employee,
  company,
  laborCalendar,
  breaks,
} = {}) {
  const inM = punchClockMinutes(checkIn);
  const outRaw = punchClockMinutes(checkOut);
  if (inM == null || outRaw == null) {
    return { ok: false, open: true, reason: "لا انصراف مسجّل بعد — لا تُحسب ساعات.", reasonEn: "No checkout yet — no hours are computed." };
  }
  const outM = outRaw <= inM ? outRaw + 1440 : outRaw;
  const presence = outM - inM;
  const consecMax = ruleValue("hours.rest.maxConsecutiveHours", onDate) || 5;
  const recordedBreaks = Array.isArray(breaks) ? breaks : null;
  const breakMinutes = recordedBreaks
    ? recordedBreaks.reduce((sum, row) => sum + (row?.start && row?.end ? minutesBetween(row.start, row.end) : Math.max(0, Number(row?.minutes) || 0)), 0)
    : null;
  const rosterRest = shift ? shiftRestMinutes(shift) : null;
  const statutoryRest = ruleValue("hours.rest.duringShiftMinutes", onDate) || 30;
  const rest = breakMinutes != null
    ? breakMinutes
    : (presence > consecMax * 60 ? (rosterRest == null ? statutoryRest : rosterRest) : 0);
  const worked = Math.max(0, presence - Math.min(rest, presence));

  const holiday = isOfficialHoliday(onDate, laborCalendar);
  const offDay = !shift && isEmployeeOffDay(onDate, company, employee);
  const rosteredMinutes = shift ? Math.round(actualShiftHours(shift, onDate, employee) * 60) : 0;
  const basis = hoursBasisOf(company, employee).basis;
  const weeklyCriterion = basis === "weekly" || (shift && isTwelveStayDuty(shift, onDate));
  const dayCapMinutes = Math.round((ordinaryDayCap(employee, company, onDate, laborCalendar) || 8) * 60);

  let overtime = 0;
  let kind = "";
  if (holiday) {
    overtime = worked;
    kind = "holiday";
  } else if (offDay) {
    overtime = worked;
    kind = "weekly_rest";
  } else if (weeklyCriterion) {
    overtime = Math.max(0, worked - rosteredMinutes);
    kind = overtime ? "beyond_roster" : "";
  } else if (Number.isFinite(dayCapMinutes)) {
    overtime = Math.max(0, worked - dayCapMinutes);
    kind = overtime ? "beyond_day_cap" : "";
  }
  const ordinary = Math.max(0, worked - overtime);
  const grace = ruleValue("hours.grace.minutes", onDate) || 0;
  const shiftStart = shift?.start ? punchClockMinutes(shift.start) : null;
  const lateMinutes = shiftStart == null ? 0 : Math.max(0, inM - shiftStart - grace);

  const limits = art108Limits(employee, onDate, laborCalendar);
  const policy = hoursPolicyOf(company, employee);
  const stayCap = limits ? limits.workplaceHours : ruleValue("hours.workplace.maxHours", onDate);
  const workCap = limits ? limits.dayHours : ruleValue("hours.ot.exceptionDayHours", onDate);
  const flags = [];
  if (presence > stayCap * 60) {
    flags.push({
      error: "ACTUAL_PRESENCE_OVER_CAP",
      article: limits ? "اللائحة م23" : "101",
      reason: `بقاء فعلي ${Math.round((presence / 60) * 10) / 10} ساعة في موقع العمل فوق ${stayCap} — ${limits ? "اللائحة م23" : "المادة 101"}.`,
      reasonEn: `Actual presence ${Math.round((presence / 60) * 10) / 10} h at the workplace above ${stayCap} — ${limits ? "Regs Art. 23" : "Art. 101"}.`,
      cite: citeRule("hours.workplace.maxHours", onDate),
    });
  }
  if (worked > workCap * 60) {
    flags.push({
      error: "ACTUAL_WORK_OVER_CAP",
      article: limits ? "اللائحة م23" : "106",
      reason: `عمل فعلي ${Math.round((worked / 60) * 10) / 10} ساعة فوق ${Math.round(workCap * 100) / 100} — ${limits ? "سقف فئة المادة 108 (اللائحة م23)" : "المادة 106"}.`,
      reasonEn: `Actual work ${Math.round((worked / 60) * 10) / 10} h above ${Math.round(workCap * 100) / 100} — ${limits ? "Art. 108 category cap (Regs Art. 23)" : "Art. 106"}.`,
      cite: citeRule("hours.ot.exceptionDayHours", onDate),
    });
  }
  const consec = checkConsecutiveWorkGate({
    start: clock(inM),
    end: clock(outM),
    breaks: recordedBreaks || undefined,
    restMinutes: recordedBreaks ? breakMinutes : (presence > consecMax * 60 ? (rosterRest == null ? undefined : rosterRest) : 0),
    breakCount: shift?.breakCount,
    onDate,
    continuous103: policy.continuousWork103 === true,
    maxConsecutiveHours: limits?.consecutiveHours || undefined,
    exempt101: !!limits && limits.consecutiveHours == null,
  });
  if (!consec.ok) {
    flags.push({ error: "ACTUAL_NO_BREAK", article: "101", reason: consec.reason, reasonEn: consec.reasonEn, cite: consec.cite });
  }
  return {
    ok: true,
    open: false,
    presenceMinutes: presence,
    restMinutes: Math.min(rest, presence),
    workedMinutes: worked,
    rosteredMinutes,
    ordinaryMinutes: ordinary,
    overtimeMinutes: overtime,
    lateMinutes,
    holiday,
    offDay,
    kind,
    flags,
  };
}
