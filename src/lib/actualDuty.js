/** Actual duty from punches (Arts 101, 106, 107) — read against the ROSTERED shift, never a fixed 07:00/8h.
 *  Pure: no store access. The store feeds the result into otDecisions for the manager's pay decision.
 */

import { citeRule, ruleValue } from "./laborRules.js";
import { art108Limits, hoursBasisOf, hoursPolicyOf, isEmployeeOffDay, ordinaryDayCap } from "./laborHoursPolicy.js";
import { isOfficialHoliday } from "./ummAlQuraCalendar.js";
import { actualShiftHours, isTwelveStayDuty, rosterBreakWindows } from "./shiftWeek.js";
import { checkConsecutiveWorkGate, minutesBetween, resolveFlexDayBreaks, riyadhClockOf, shiftRestMinutes } from "./shiftDerivations.js";
import { nursingCreditOf, nursingHourOn } from "./dutyRequests.js";

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
      breaks: clockBreaks(recordedBreaks)
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

/**
 * A day record's break list read as clocks: ISO punch instants → Riyadh "HH:MM" (the day record keeps
 * the instants as proof); "HH:MM" rows and minutes-only rows pass through; an open break (no end) drops.
 */
export function clockBreaks(list) {
  return (Array.isArray(list) ? list : [])
    .map((row) => {
      if (!row) return null;
      if (row.start == null && row.end == null) return Number(row.minutes) > 0 ? { minutes: Number(row.minutes) } : null;
      const s = riyadhClockOf(row.start);
      const e = riyadhClockOf(row.end);
      if (s == null || e == null) return null;
      return { start: clock(s), end: clock(e) };
    })
    .filter(Boolean);
}

/**
 * One flex day read from its punches (shiftDerivations.resolveFlexDayBreaks) with the hours policy's
 * Art. 103 flag. Not flex → `forDuty: null` and callers keep the fixed reading.
 */
export function resolveDayBreaks({ shift, breaks, checkIn, checkOut, now, onDate, prayers = null, company, employee, plan = null } = {}) {
  return resolveFlexDayBreaks({
    plan,
    shift,
    breaks,
    checkIn,
    checkOut,
    now,
    onDate,
    prayers,
    continuous103: hoursPolicyOf(company, employee).continuousWork103 === true,
  });
}

/**
 * The break list to store on a day record when it closes: an open punched break ends at the checkout,
 * and an unpunched flex break is written as assumed («مفترضة — لم تُثبت ببصمة»). Times are ISO instants
 * placed from the check-in instant. Returns the new list, or the given list when nothing changes.
 */
export function closeDayBreaks({ shift, breaks, checkIn, checkOut, onDate, prayers = null, company, employee, plan = null } = {}) {
  const list = Array.isArray(breaks) ? breaks.map((row) => ({ ...row })) : [];
  const day = resolveDayBreaks({ shift, breaks: list, checkIn, checkOut, onDate, prayers, company, employee, plan });
  if (!day.flex) return breaks;
  for (const row of list) {
    if (row && row.source !== "assumed" && row.start && !row.end) row.end = checkOut;
  }
  if (day.assumed && !list.some((row) => row?.source === "assumed")) {
    const inMs = new Date(checkIn).getTime();
    const inM = day.flex.shiftStart != null ? liftTo(riyadhClockOf(checkIn), day.flex.shiftStart) : null;
    if (Number.isFinite(inMs) && inM != null) {
      const base = inMs - (inMs % 60000);
      const iso = (m) => new Date(base + (m - inM) * 60000).toISOString();
      list.push({ start: iso(day.assumed.startMin), end: iso(day.assumed.endMin), source: "assumed" });
    } else {
      list.push({ start: day.assumed.start, end: day.assumed.end, source: "assumed" });
    }
  }
  return list;
}

function liftTo(m, shiftStart) {
  return m != null && m + 720 < shiftStart ? m + 1440 : m;
}

function clock(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Where worked time starts for a punch at `inM` (minutes on the Riyadh clock) on `shift`: the published
 * start when the punch was earlier (up to 12 h before it), else the punch itself. Returned on the same
 * scale as `inM` (it may pass 1440 when the shift starts at or after midnight). Twin in reportsDerivations.ts.
 */
export function earlyPunchStart(inM, shift) {
  if (inM == null || !shift?.start) return inM;
  const start = punchClockMinutes(shift.start);
  if (start == null) return inM;
  const earlyBy = ((start - inM) % 1440 + 1440) % 1440;
  return earlyBy > 0 && earlyBy <= 720 ? inM + earlyBy : inM;
}

/**
 * One day of punches → presence, rest, worked, ordinary and overtime minutes, plus named breaches.
 * - Rest (Art. 102) is deducted: recorded breaks first, else the rostered rest when presence passed five hours.
 * - Overtime (Art. 107): all of it on an official holiday or an unrostered off day (107(3));
 *   on the weekly criterion (Art. 98 basis weekly, or a 12h-stay duty) only what passes the rostered shift;
 *   otherwise what passes the day's ordinary cap (98 / 99 / Ramadan / Art. 108 category).
 * - Flags: presence > 12 h (Art. 101, or the Art. 108 ceiling), work > 10 h (Art. 106 / category),
 *   more than five hours without a rest (Art. 101, unless Art. 103 continuous work).
 * - Art. 154: the nursing minutes she was away for (nursingCreditOf) are added to worked and ordinary
 *   minutes (`nursingCreditMinutes`; `presenceWorkedMinutes` is the punches alone); overtime and the
 *   Art. 106 flag read the punches alone, so nursing never makes overtime. Its start part is not lateness.
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
  // An early punch is not work: time starts at the published shift start (the attendance policy —
  // «البصمة المبكرة لا تُحتسب ساعات عمل»). Early = up to 12 h before the start, so a punch after
  // midnight on a shift that began the evening before still reads as late, not as early.
  // Presence (Art. 101 stay cap, consecutive hours) stays the real punch; worked time is read from effIn.
  const effIn = earlyPunchStart(inM, shift);
  const presence = outM - inM;
  const workSpan = Math.max(0, outM - effIn);
  const consecMax = ruleValue("hours.rest.maxConsecutiveHours", onDate) || 5;
  // «راحة مرنة ببصمة»: the punched (or assumed) breaks are deducted, never the roster's; Art. 101 reads
  // only the punched ones. Fixed and continuous shifts keep the recorded list, else the roster's rest.
  const flexDay = shift?.breakMode === "flex" ? resolveDayBreaks({ shift, breaks, checkIn, checkOut, onDate, company, employee }) : null;
  const flexOn = !!flexDay?.flex;
  const recordedBreaks = flexOn ? flexDay.forDuty : (Array.isArray(breaks) ? clockBreaks(breaks) : null);
  const breakMinutes = recordedBreaks
    ? recordedBreaks.reduce((sum, row) => sum + (row?.start && row?.end ? minutesBetween(row.start, row.end) : Math.max(0, Number(row?.minutes) || 0)), 0)
    : null;
  const rosterRest = shift ? shiftRestMinutes(shift) : null;
  const statutoryRest = ruleValue("hours.rest.duringShiftMinutes", onDate) || 30;
  const rest = breakMinutes != null
    ? breakMinutes
    : (workSpan > consecMax * 60 ? (rosterRest == null ? statutoryRest : rosterRest) : 0);
  const worked = Math.max(0, workSpan - Math.min(rest, workSpan));

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
  const grace = ruleValue("hours.grace.minutes", onDate) || 0;
  const shiftStart = shift?.start ? punchClockMinutes(shift.start) : null;
  const shiftEndRaw = shift?.end ? punchClockMinutes(shift.end) : null;
  const shiftEnd = shiftStart == null || shiftEndRaw == null ? null : (shiftEndRaw <= shiftStart ? shiftEndRaw + 1440 : shiftEndRaw);
  // Art. 154: the nursing hour on a rostered work day — its start part is not lateness, and the
  // minutes she was away inside it count as actual work. Computed on the punches alone, so they
  // never make overtime (overtime above is read on the minutes worked).
  const nursing = shift && !holiday && !offDay ? nursingHourOn(employee, onDate) : null;
  const credit = nursingCreditOf(nursing, { inMinutes: effIn, outMinutes: outM, shiftStart, shiftEnd, workedMinutes: worked, rosteredMinutes });
  const ordinary = Math.max(0, worked - overtime) + credit.minutes;
  const lateMinutes = shiftStart == null ? 0 : Math.max(0, inM - shiftStart - grace - (nursing?.startMinutes || 0));

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
  const consecBreaks = flexOn ? flexDay.forConsec : recordedBreaks;
  const consec = checkConsecutiveWorkGate({
    start: clock(inM),
    end: clock(outM),
    breaks: consecBreaks || undefined,
    restMinutes: flexOn
      ? consecBreaks.reduce((sum, row) => sum + minutesBetween(row.start, row.end), 0)
      : (recordedBreaks ? breakMinutes : (presence > consecMax * 60 ? (rosterRest == null ? undefined : rosterRest) : 0)),
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
    restMinutes: Math.min(rest, workSpan),
    workedMinutes: worked + credit.minutes,
    presenceWorkedMinutes: worked,
    nursingCreditMinutes: credit.minutes,
    ...(nursing ? { nursing: { start: credit.start, mid: credit.mid, end: credit.end, excusedStart: nursing.startMinutes, excusedEnd: nursing.endMinutes } } : {}),
    rosteredMinutes,
    ordinaryMinutes: ordinary,
    overtimeMinutes: overtime,
    lateMinutes,
    holiday,
    offDay,
    kind,
    flags,
    breakMode: flexOn ? "flex" : (flexDay?.mode || "fixed"),
    ...(flexOn
      ? {
          breaks: flexDay.rows.map((row) => ({ start: row.start, end: row.end, minutes: row.minutes, source: row.source, short: row.minutes < flexDay.flex.minPart && row.source === "punch" })),
          breakAssumed: !!flexDay.assumed,
          lateReturnMinutes: flexDay.overMinutes,
          shortBreaks: flexDay.shortCount,
        }
      : {}),
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
  // A flex day: deriveActualDuty reads its punches itself (Art. 101 on the punched breaks only).
  const eff = shift?.breakMode === "flex" ? { breaks: null } : effectiveDutyBreaks({
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
    breaks: eff.breaks ? eff.breaks.map((row) => ({ start: row.start, end: row.end })) : breaks,
  });
  if (!duty.ok) return [];
  return duty.flags.filter((flag) => flag.error === "ACTUAL_NO_BREAK" || flag.error === "ACTUAL_PRESENCE_OVER_CAP");
}
