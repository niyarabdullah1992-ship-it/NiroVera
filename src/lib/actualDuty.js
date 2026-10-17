/** Actual duty from punches (Arts 101, 106, 107) — read against the ROSTERED shift, never a fixed 07:00/8h.
 *  Pure: no store access. The store feeds the result into otDecisions for the manager's pay decision.
 */

import { citeRule, ruleValue } from "./laborRules.js";
import { art108Limits, hoursBasisOf, hoursPolicyOf, isEmployeeOffDay, ordinaryDayCap } from "./laborHoursPolicy.js";
import { isOfficialHoliday } from "./ummAlQuraCalendar.js";
import { actualShiftHours, isTwelveStayDuty, rosterBreakWindows } from "./shiftWeek.js";
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

/**
 * The rests a day of punches actually had, as clocks inside the presence: the recorded breaks
 * when the row carries a `breaks` list (even empty — then none was taken), else the roster's
 * placed break (`rosterBreakWindows`) clipped to [check-in, check-out or now]. A planned break
 * outside the presence is not a rest. Returns { breaks: [{ start, end, minutes }], recorded }.
 * `windows` are the roster windows (minutes on the shift day's clock).
 */
export function effectiveDutyBreaks({ recordedBreaks, windows = [], inMinutes, untilMinutes } = {}) {
  if (Array.isArray(recordedBreaks)) {
    return {
      recorded: true,
      breaks: recordedBreaks
        .filter((row) => row?.start && row?.end)
        .map((row) => ({ start: String(row.start), end: String(row.end), minutes: minutesBetween(row.start, row.end) })),
    };
  }
  if (inMinutes == null || untilMinutes == null) return { recorded: false, breaks: [] };
  const out = [];
  for (const w of windows) {
    // Windows and punches share the shift day's clock (the caller lifts after-midnight minutes by 1440).
    const from = Math.max(w.startMin, inMinutes);
    const to = Math.min(w.endMin, untilMinutes);
    if (to - from <= 0) continue;
    out.push({ start: clock(from), end: clock(to), minutes: to - from, startMin: from, endMin: to });
  }
  return { recorded: false, breaks: out };
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

/**
 * The Art. 101 breaches a closed day of punches proves, read with the rests it actually had
 * (`effectiveDutyBreaks`: recorded breaks, else the roster's placed break inside the presence) —
 * the same reading the live duty alerts use, so a breach the worker was warned about is the
 * breach that is recorded. Returns the `deriveActualDuty` flags that are Art. 101 breaches:
 * ACTUAL_NO_BREAK (more than the consecutive-hours limit without a rest) and
 * ACTUAL_PRESENCE_OVER_CAP (presence above the workplace ceiling). [] while the day is open.
 */
export function actualDutyBreaches({ checkIn, checkOut, shift, onDate, employee, company, laborCalendar, breaks } = {}) {
  const inM = punchClockMinutes(checkIn);
  const outRaw = punchClockMinutes(checkOut);
  if (inM == null || outRaw == null) return [];
  const outM = outRaw <= inM ? outRaw + 1440 : outRaw;
  const shiftStart = shift?.start ? punchClockMinutes(shift.start) : null;
  // A check-in just after midnight on a shift that started the evening before sits on the next day's clock.
  const lift = shiftStart != null && inM + 720 < shiftStart ? 1440 : 0;
  const eff = effectiveDutyBreaks({
    recordedBreaks: breaks,
    windows: shift ? rosterBreakWindows(shift, onDate) : [],
    inMinutes: inM + lift,
    untilMinutes: outM + lift,
  });
  const duty = deriveActualDuty({
    checkIn: clock(inM),
    checkOut: clock(outM),
    shift,
    onDate,
    employee,
    company,
    laborCalendar,
    breaks: eff.breaks.map((row) => ({ start: row.start, end: row.end })),
  });
  if (!duty.ok) return [];
  return duty.flags.filter((flag) => flag.error === "ACTUAL_NO_BREAK" || flag.error === "ACTUAL_PRESENCE_OVER_CAP");
}
