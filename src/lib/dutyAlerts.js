/**
 * Live duty alerts for the employee during the day — pure derivation, no store, no clock of its own.
 *
 * Given the shift, the day's punches, the roster's break, the station's prayer times, the sun
 * exposure, the date (Ramadan from the owner's labour calendar), the 3337 heat window and «now»,
 * it returns the alerts that apply at this minute:
 *   { id, level: "info"|"warn", breach, ruleId, textAr, textEn, at, atMinutes, cite, hint }
 * - break_soon / break_now / break_over — the roster's break (Art. 101), «راحة ثابتة».
 * - «راحة مرنة ببصمة» (flex): flex_window_closing (warn: the window ends in 15 min, no break yet),
 *   flex_break_running / flex_break_over (warn: past its minutes — late return, not a breach),
 *   flex_remaining (a split part left), flex_break_assumed_start (none punched: the assumed break
 *   begins now — notice only, no breach), flex_break_ended (its end), flex_break_assumed (taken, Art. 102).
 *   The 4h30 / 5h alerts read the punched breaks and the assumed one (a rest, like a fixed break).
 * - rest_5h_soon (warn, not a breach) → rest_5h_breach — the consecutive-hours limit (Art. 101);
 *   none under Art. 103 (continuous work) or for an Art. 108 category outside Art. 101.
 * - presence_soon (warn) → presence_breach — the workplace ceiling (Art. 101 / Art. 108 category).
 * - heat_soon / heat_now — the 12:00–15:00 open-sun window, in season and only on exposed work (3337).
 * - ramadan_hours / ramadan_over — 6 h a day, 36 a week, for a worker recorded as Muslim (Art. 98).
 * - prayer_next — the next prayer inside the shift (info).
 * - nursing_start — her Art. 154 nursing hour at the end of the shift has begun (end / split placement);
 *   nursing_expiry — the right ends in 30 days or less, and on its last day (nursingExpiryAlert).
 *   Both are the employee's own — never the manager's.
 * Every figure comes from laborRules (`ruleValue`); the lead times below are product choices.
 * A closed day returns the breaches its punches prove (`actualDutyBreaches`) with `recorded: true`.
 */
import { citeRule, isRamadanDay, religionOnFile, ruleValue } from "./laborRules.js";
import { art108Limits, hoursPolicyOf } from "./laborHoursPolicy.js";
import { heatBanWindow, isHeatBanDate } from "./contractLawDerivations.js";
import { HEAT_BAN_DECISION } from "./heatBanDecision.js";
import { actualDutyBreaches, effectiveDutyBreaks, punchClockMinutes, resolveDayBreaks } from "./actualDuty.js";
import { prayersInShift, rosterBreakWindows } from "./shiftWeek.js";
import { nursingHourOn } from "./dutyRequests.js";
import { breakDayOf, isLateReturnOpen } from "./attendanceQueue.js";
import { toRiyadhDateKey } from "./riyadhDate.js";

/** Product lead times (minutes) — when a warning starts before its limit. Not statutory figures. */
export const DUTY_ALERT_LEAD = Object.freeze({
  breakSoon: 15,
  breakOverShown: 15,
  flexWindowClosing: 15,
  restWarnBefore: 30,
  presenceWarnBefore: 30,
  heatWarnBefore: 30,
});

/** Alerts the employee is notified of (once per shift), and those the direct manager is told of. */
export const DUTY_NOTIFY_EMPLOYEE = Object.freeze(["break_soon", "rest_5h_breach", "heat_now", "flex_window_closing", "flex_break_over"]);
export const DUTY_NOTIFY_MANAGER = Object.freeze(["rest_5h_breach", "presence_breach"]);
/**
 * The app-level ticker's set (Layout, every page): the break's start and end — punched or fixed —,
 * the 4h30 warning, the 5h rule once per five-hour block without rest, the 3337 window, the flex
 * window closing. One notice per break end («flex_break_ended» / «flex_break_over» share its key).
 */
export const DUTY_NOTIFY_APP = Object.freeze([
  "break_soon", "break_now", "break_over",
  "rest_5h_soon", "rest_5h_breach",
  "heat_now", "flex_window_closing", "flex_break_assumed_start", "flex_break_ended", "flex_break_over",
  "nursing_start",
]);

/** Days before the nursing right's last day when she is told it ends (product lead, not statutory). */
export const NURSING_EXPIRY_LEAD_DAYS = 30;

/** Which alert shows when several apply — breaches first, then what needs doing soonest. */
const PRIORITY = [
  "presence_breach", "rest_5h_breach", "heat_now",
  "presence_soon", "rest_5h_soon", "flex_break_over", "flex_break_ended", "flex_window_closing", "break_soon",
  "flex_break_running", "flex_break_assumed_start", "break_now", "nursing_start", "heat_soon",
  "ramadan_over", "flex_break_assumed", "flex_remaining", "break_over", "nursing_expiry", "prayer_next", "ramadan_hours",
];

const hm = (mins) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
/** «15 دقيقة» / «10 دقائق» / «دقيقتان» — Arabic counted noun. */
export function minutesAr(n) {
  const v = Math.round(Number(n) || 0);
  if (v === 1) return "دقيقة واحدة";
  if (v === 2) return "دقيقتين";
  return v % 100 >= 3 && v % 100 <= 10 ? `${v} دقائق` : `${v} دقيقة`;
}
const hoursLabel = (minutes) => `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;
/** «5 ساعات» / «10 ساعات» / «15 ساعة» — Arabic counted noun for whole hours. */
export function hoursAr(n) {
  const v = Math.round(Number(n) || 0);
  if (v === 1) return "ساعة واحدة";
  if (v === 2) return "ساعتين";
  return v % 100 >= 3 && v % 100 <= 10 ? `${v} ساعات` : `${v} ساعة`;
}

/** «now» → minutes after Riyadh midnight. A number passes through. */
export function riyadhMinutesOf(now) {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  const at = now instanceof Date ? now : new Date(now ?? Date.now());
  if (Number.isNaN(at.getTime())) return null;
  return punchClockMinutes(at.toISOString());
}

function clockOf(value) {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function alert(id, level, ruleId, onDate, { textAr, textEn, atMinutes, breach = false, hint = null, recorded = false, meta = null }) {
  return {
    id,
    level,
    breach: !!breach,
    ruleId,
    textAr,
    textEn,
    at: atMinutes == null ? "" : hm(atMinutes),
    atMinutes: atMinutes == null ? null : atMinutes,
    cite: citeRule(ruleId, onDate),
    hint,
    ...(meta ? { meta } : {}),
    ...(recorded ? { recorded: true } : {}),
  };
}

/**
 * @param {object} input
 * @param {object} input.shift      today's shift type { start, end, restMinutes?, breaks?, label?, id? }
 * @param {object} input.punches    { checkIn, checkOut, breaks? } — ISO instants or "HH:MM"
 * @param {Array}  [input.breakWindows] the roster's break windows (default rosterBreakWindows(shift))
 * @param {object} [input.prayers]  the station's prayer day (stationPrayerTimes); null → no prayer alert
 * @param {boolean} [input.exposed] the shift / task is marked exposed (open sun) today
 * @param {string} input.onDate     "YYYY-MM-DD"
 * @param {object} [input.laborCalendar] owner labour calendar (Ramadan ruling)
 * @param {boolean} [input.ramadan] override for the Ramadan reading
 * @param {number} [input.weekWorkedMinutes] worked minutes this week before today (Ramadan weekly cap)
 * @param {object} [input.employee] @param {object} [input.company]
 * @param {Date|number} input.now
 * @returns {{ alerts: Array, current: object|null, exempt: ""|"art103"|"art108", open: boolean }}
 */
export function deriveDutyAlerts({
  shift,
  punches = {},
  breakWindows,
  prayers = null,
  exposed = false,
  onDate,
  laborCalendar,
  ramadan,
  weekWorkedMinutes = 0,
  employee,
  company,
  now,
} = {}) {
  const empty = { alerts: [], current: null, exempt: "", open: false };
  const inRaw = punchClockMinutes(punches?.checkIn);
  if (!shift?.start || !shift?.end || inRaw == null) return empty;
  const shiftStart = clockOf(shift.start);
  const shiftSpan = (() => {
    const e = clockOf(shift.end);
    let d = e - shiftStart;
    if (d <= 0) d += 1440;
    return d;
  })();
  const shiftEnd = shiftStart + shiftSpan;
  // Every minute below is on the shift day's clock: after-midnight minutes of a night shift add 1440.
  const lift = (m) => (m != null && m + 720 < shiftStart ? m + 1440 : m);
  const inM = lift(inRaw);
  const policy = hoursPolicyOf(company, employee);
  const limits = art108Limits(employee, onDate, laborCalendar);
  const exempt = policy.continuousWork103 === true ? "art103" : (limits && limits.consecutiveHours == null ? "art108" : "");

  if (punches?.checkOut) {
    const flags = actualDutyBreaches({
      checkIn: punches.checkIn,
      checkOut: punches.checkOut,
      shift,
      onDate,
      employee,
      company,
      laborCalendar,
      breaks: punches.breaks,
    });
    const alerts = flags.map((flag) => alert(
      flag.error === "ACTUAL_NO_BREAK" ? "rest_5h_breach" : "presence_breach",
      "warn",
      flag.error === "ACTUAL_NO_BREAK" ? "hours.rest.maxConsecutiveHours" : "hours.workplace.maxHours",
      onDate,
      { textAr: `سُجّل في يومك: ${flag.reason}`, textEn: `Recorded on your day: ${flag.reasonEn}`, breach: true, recorded: true, hint: { kind: "rest", item: { date: onDate } } },
    ));
    return { alerts, current: alerts[0] || null, exempt, open: false };
  }

  let nowM = riyadhMinutesOf(now);
  if (nowM == null) return empty;
  if (nowM < inM) nowM += 1440;
  if (nowM < inM) return empty;

  const consecMax = (limits?.consecutiveHours || ruleValue("hours.rest.maxConsecutiveHours", onDate)) * 60;
  const minRest = ruleValue("hours.rest.duringShiftMinutes", onDate);
  const stayCap = (limits ? limits.workplaceHours : ruleValue("hours.workplace.maxHours", onDate)) * 60;
  const windows = Array.isArray(breakWindows) ? breakWindows : rosterBreakWindows(shift, onDate);
  const alerts = [];
  // «راحة مرنة ببصمة»: the day read from the break punches (Art. 103 / Art. 108 exemptions keep none).
  const flexDay = !exempt && shift?.breakMode === "flex"
    ? resolveDayBreaks({ shift, breaks: punches?.breaks, checkIn: punches.checkIn, now: nowM, onDate, prayers, company, employee })
    : null;
  const flex = flexDay?.flex || null;

  /* ── the roster's break and the five-hour limit (Art. 101) ── */
  if (!exempt && flex) {
    const allowed = flexDay.remaining;
    if (flexDay.open && flexDay.overMinutes > 0) {
      alerts.push(alert("flex_break_over", "warn", "hours.rest.duringShiftMinutes", onDate, {
        atMinutes: flexDay.open.startMin + allowed,
        meta: { overMinutes: flexDay.overMinutes, breakStart: flexDay.open.start },
        textAr: `راحتك تجاوزت مدتها — ${minutesAr(flexDay.overMinutes)} فوق ${minutesAr(allowed)}، يراها مديرك عودةً متأخرة.`,
        textEn: `Your break has run over — ${flexDay.overMinutes} min past ${allowed} min; your manager sees it as a late return.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    } else if (flexDay.open && flexDay.runningMinutes >= allowed) {
      // The minute the punched break's minutes run out — «انتهت راحتك — عُد للعمل».
      alerts.push(alert("flex_break_ended", "warn", "hours.rest.duringShiftMinutes", onDate, {
        atMinutes: flexDay.open.startMin + allowed,
        meta: { breakStart: flexDay.open.start },
        textAr: `انتهت راحتك عند ${hm(flexDay.open.startMin + allowed)} — عُد للعمل واضغط «أنهيت راحتي».`,
        textEn: `Your break ended at ${hm(flexDay.open.startMin + allowed)} — back to work, and tap “I ended my break”.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    } else if (flexDay.open) {
      alerts.push(alert("flex_break_running", "info", "hours.rest.duringShiftMinutes", onDate, {
        atMinutes: flexDay.open.startMin + allowed,
        textAr: `في راحتك منذ ${flexDay.open.start} — باقٍ ${minutesAr(Math.max(0, allowed - flexDay.runningMinutes))}، لا تُحسب من ساعات العمل.`,
        textEn: `On your break since ${flexDay.open.start} — ${Math.max(0, allowed - flexDay.runningMinutes)} min left, not counted as work.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    } else if (flexDay.assumedRunning) {
      // None punched: the assumed break begins now — told once, counted down like a punched one.
      const a = flexDay.assumed;
      alerts.push(alert("flex_break_assumed_start", "info", "hours.rest.notWorkingHours.cite", onDate, {
        atMinutes: a.startMin,
        meta: { start: a.start, end: a.end, breakStart: a.start, endMin: a.endMin, assumed: true },
        textAr: `بدأت راحتك الآن (\u2066${a.start}–${a.end}\u2069) — لم تبصم لها، فتُحتسب تلقائياً.`,
        textEn: `Your break has started (${a.start}–${a.end}) — you did not punch it, so it counts automatically.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    } else if (flexDay.assumed && !flexDay.punched.length && flexDay.planned && flexDay.assumed.startMin === flexDay.planned.startMin
      && nowM >= flexDay.assumed.endMin && nowM - flexDay.assumed.endMin < DUTY_ALERT_LEAD.breakOverShown) {
      // The assumed break's minutes ran out — «انتهت راحتك», keyed to its start like a punched one.
      const a = flexDay.assumed;
      alerts.push(alert("flex_break_ended", "warn", "hours.rest.duringShiftMinutes", onDate, {
        atMinutes: a.endMin,
        meta: { breakStart: a.start, assumed: true },
        textAr: `انتهت راحتك عند ${a.end} — عُد للعمل.`,
        textEn: `Your break ended at ${a.end} — back to work.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    } else if (!flexDay.punched.length && !flexDay.assumed && flexDay.windowState === "open" && flex.toMin - nowM <= DUTY_ALERT_LEAD.flexWindowClosing) {
      const left = flex.toMin - nowM;
      alerts.push(alert("flex_window_closing", "warn", "hours.rest.duringShiftMinutes", onDate, {
        atMinutes: flex.toMin,
        meta: { minutesLeft: left },
        textAr: `نافذة الراحة تنتهي بعد ${minutesAr(left)} — لم تأخذ راحتك بعد، وإلا افتُرضت دون بصمة.`,
        textEn: `The break window ends in ${left} min — you have not taken your break; otherwise it is assumed without a punch.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    } else if (!flexDay.punched.length && !flexDay.assumed && (flexDay.windowState === "before" || flexDay.windowState === "open")) {
      // The worker's own break: he chooses when, inside the window, and proves it by punch.
      alerts.push(alert("flex_break_yours", "info", "hours.rest.duringShiftMinutes", onDate, {
        atMinutes: flex.fromMin,
        textAr: `راحتك بيدك — ${minutesAr(flex.minutes)} تختار وقتها بين ${flex.from} و${flex.to}${flex.splitEffective ? `، ويمكن تقسيمها جزأين (${minutesAr(flex.minPart)} على الأقل لكل جزء)` : ""}. اضغط «بدأت راحتي» ثم «أنهيت راحتي».`,
        textEn: `Your break is yours — ${flex.minutes} min, you choose when between ${flex.from} and ${flex.to}${flex.splitEffective ? `, in up to two parts (${flex.minPart} min each at least)` : ""}. Tap “I started my break”, then “I ended my break”.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    } else if (flexDay.assumed) {
      alerts.push(alert("flex_break_assumed", "info", "hours.rest.notWorkingHours.cite", onDate, {
        atMinutes: flexDay.assumed.startMin,
        textAr: `لم تُثبت راحتك ببصمة — افتُرضت \u2066${flexDay.assumed.start}–${flexDay.assumed.end}\u2069 وتُخصم من ساعاتك (المادة 102).`,
        textEn: `Your break was not punched — it is assumed at ${flexDay.assumed.start}–${flexDay.assumed.end} and deducted (Art. 102).`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    } else if (flexDay.punched.length && flex.splitEffective && flexDay.windowState === "open" && allowed >= flex.minPart) {
      alerts.push(alert("flex_remaining", "info", "hours.rest.duringShiftMinutes", onDate, {
        atMinutes: flex.toMin,
        textAr: `باقٍ ${minutesAr(allowed)} من راحتك — حتى ${flex.to}.`,
        textEn: `${allowed} min of your break left — until ${flex.to}.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    }
  }

  if (!exempt) {
    const upcoming = flex ? null : windows.find((w) => w.startMin > nowM);
    const during = flex ? null : windows.find((w) => w.startMin <= nowM && nowM < w.endMin && w.startMin >= inM);
    const ended = flex ? null : [...windows].reverse().find((w) => w.endMin <= nowM && nowM - w.endMin < DUTY_ALERT_LEAD.breakOverShown && w.startMin >= inM);
    if (upcoming && upcoming.startMin - nowM <= DUTY_ALERT_LEAD.breakSoon && !Array.isArray(punches?.breaks)) {
      const left = upcoming.startMin - nowM;
      alerts.push(alert("break_soon", "info", "hours.rest.duringShiftMinutes", onDate, {
        atMinutes: upcoming.startMin,
        meta: { minutesLeft: left },
        textAr: `راحتك بعد ${minutesAr(left)} — \u2066${upcoming.start}–${upcoming.end}\u2069، لا تُحسب من ساعات العمل.`,
        textEn: `Your break is in ${left} min — ${upcoming.start}–${upcoming.end}, not counted as work.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    }
    if (during && !Array.isArray(punches?.breaks)) {
      alerts.push(alert("break_now", "info", "hours.rest.duringShiftMinutes", onDate, {
        atMinutes: during.startMin,
        meta: { start: during.start, end: during.end, endMin: during.endMin },
        textAr: `بدأت راحتك — حتى ${during.end}.`,
        textEn: `Your break has started — until ${during.end}.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    }
    if (ended && !Array.isArray(punches?.breaks)) {
      alerts.push(alert("break_over", "info", "hours.rest.duringShiftMinutes", onDate, {
        atMinutes: ended.endMin,
        meta: { start: ended.start, end: ended.end },
        textAr: `انتهت راحتك عند ${ended.end}.`,
        textEn: `Your break ended at ${ended.end}.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    }
    // Flex: the punched breaks and the assumed one are the rests — an assumed break is a rest like a
    // fixed one (no Art. 101 breach); an open or running break holds the count.
    const eff = flex
      ? { recorded: true, breaks: flexDay.rows.filter((row) => row.startMin <= nowM && row.endMin != null).map((row) => ({ start: row.start, end: row.end, startMin: row.startMin, endMin: row.endMin })) }
      : effectiveDutyBreaks({ recordedBreaks: punches?.breaks, windows, inMinutes: inM, untilMinutes: nowM });
    const rests = eff.breaks
      .map((row) => ({ from: row.startMin ?? lift(clockOf(row.start)), to: row.endMin ?? lift(clockOf(row.end)) }))
      .filter((row) => row.from != null && row.to != null && row.to - row.from >= minRest && row.from >= inM);
    // A roster break that starts this very minute is a rest already (its clipped length is still 0).
    const windowNow = !flex && !eff.recorded && windows.some((w) => w.startMin <= nowM && nowM < w.endMin && w.startMin >= inM && w.minutes >= minRest);
    const inRest = (flex && (!!flexDay.open || !!flexDay.assumedRunning)) || windowNow || rests.some((row) => row.from <= nowM && nowM < row.to);
    const lastRestEnd = rests.filter((row) => row.to <= nowM).reduce((max, row) => Math.max(max, row.to), inM);
    const stretch = inRest ? 0 : nowM - lastRestEnd;
    // A rest still ahead before the limit is the plan working — no warning.
    const restAhead = !eff.recorded && windows.some((w) => w.startMin > nowM && w.startMin - lastRestEnd <= consecMax && w.minutes >= minRest);
    const limitAt = lastRestEnd + consecMax;
    // One block per full stretch of the limit without rest: 5h → 1, 10h → 2 … (each repeats the notice).
    const block = Math.floor(stretch / consecMax);
    // «بدأت راحتي» can be offered at once: a flex shift with minutes left, its window open, no break running.
    const startable = !!flex && !flexDay.open && flexDay.remaining > 0 && flexDay.windowState === "open"
      && (!flexDay.punched.length || (flex.splitEffective && flexDay.remaining >= flex.minPart));
    const restMeta = { since: hm(lastRestEnd), sinceMin: lastRestEnd, stretch, block, consecHours: consecMax / 60, minRest, startable };
    if (stretch >= consecMax) {
      alerts.push(alert("rest_5h_breach", "warn", "hours.rest.maxConsecutiveHours", onDate, {
        atMinutes: lastRestEnd + block * consecMax,
        breach: true,
        meta: restMeta,
        textAr: `تجاوزت ${hoursAr((consecMax / 60) * block)} بلا راحة منذ ${hm(lastRestEnd)} — لك راحة ${minRest} دقيقة الآن، المادة 101.`,
        textEn: `Over ${(consecMax / 60) * block} hours without a break since ${hm(lastRestEnd)} — you are owed a ${minRest}-minute rest now, Art. 101.`,
        hint: { kind: "rest", item: { date: onDate, stretchHours: Math.round((stretch / 60) * 10) / 10 } },
      }));
    } else if (stretch >= consecMax - DUTY_ALERT_LEAD.restWarnBefore && !restAhead) {
      alerts.push(alert("rest_5h_soon", "warn", "hours.rest.maxConsecutiveHours", onDate, {
        atMinutes: limitAt,
        meta: restMeta,
        textAr: `عملت ${hoursLabel(stretch)} متواصلة — خذ راحة ${minRest} دقيقة قبل ${hm(limitAt)} (حد ${consecMax / 60} ساعات، المادة 101).`,
        textEn: `${hoursLabel(stretch)} worked in a row — take a ${minRest}-minute break before ${hm(limitAt)} (${consecMax / 60}-hour limit, Art. 101).`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    }
  }

  /* ── presence at the workplace (Art. 101; an Art. 108 category its own ceiling) ── */
  if (Number.isFinite(stayCap)) {
    const presence = nowM - inM;
    const capAt = inM + stayCap;
    if (presence > stayCap) {
      alerts.push(alert("presence_breach", "warn", "hours.workplace.maxHours", onDate, {
        atMinutes: capAt,
        breach: true,
        textAr: `بقاؤك في موقع العمل تجاوز ${stayCap / 60} ساعة منذ ${hm(capAt)} — المادة 101 لا تجيز أكثر.`,
        textEn: `Your presence at work passed ${stayCap / 60} hours at ${hm(capAt)} — Art. 101 allows no more.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    } else if (presence >= stayCap - DUTY_ALERT_LEAD.presenceWarnBefore) {
      alerts.push(alert("presence_soon", "warn", "hours.workplace.maxHours", onDate, {
        atMinutes: capAt,
        textAr: `يبلغ بقاؤك ${stayCap / 60} ساعة عند ${hm(capAt)} — حد البقاء في موقع العمل، المادة 101.`,
        textEn: `Your presence reaches ${stayCap / 60} hours at ${hm(capAt)} — the workplace ceiling, Art. 101.`,
        hint: { kind: "rest", item: { date: onDate } },
      }));
    }
  }

  /* ── the open-sun window (Decision 3337): in season, exposed work only ── */
  if (exposed === true && isHeatBanDate(onDate)) {
    const win = heatBanWindow(onDate);
    const from = win.startHour * 60;
    const to = win.endHour * 60;
    const overlaps = shiftStart < to && shiftEnd > from;
    if (overlaps) {
      if (nowM >= from && nowM < to) {
        alerts.push(alert("heat_now", "warn", "hours.heat.cite", onDate, {
          atMinutes: from,
          breach: true,
          textAr: `نافذة حظر العمل المكشوف بدأت — لا عمل تحت الشمس حتى ${win.endLabel} (القرار ${HEAT_BAN_DECISION.id}). انتقل إلى مكان مظلّل.`,
          textEn: `The open-sun ban window has started — no work in the sun until ${win.endLabel} (Decision ${HEAT_BAN_DECISION.id}). Move to shade.`,
          hint: { kind: "heat", item: { date: onDate, exposed: true } },
        }));
      } else if (nowM < from && from - nowM <= DUTY_ALERT_LEAD.heatWarnBefore) {
        alerts.push(alert("heat_soon", "info", "hours.heat.cite", onDate, {
          atMinutes: from,
          textAr: `يبدأ حظر العمل المكشوف بعد ${minutesAr(from - nowM)} (\u2066${win.startLabel}–${win.endLabel}\u2069، القرار ${HEAT_BAN_DECISION.id}).`,
          textEn: `The open-sun ban starts in ${from - nowM} min (${win.startLabel}–${win.endLabel}, Decision ${HEAT_BAN_DECISION.id}).`,
          hint: { kind: "heat", item: { date: onDate, exposed: true } },
        }));
      }
    }
  }

  /* ── Ramadan hours (Art. 98) — a worker recorded as Muslim ── */
  const isRamadan = ramadan == null ? isRamadanDay(onDate, laborCalendar) : !!ramadan;
  if (isRamadan && religionOnFile(employee) === "muslim") {
    const dayCap = ruleValue("hours.ramadan.ordinaryHours", onDate) * 60;
    const weekCap = ruleValue("hours.ramadan.weekMaxHours", onDate) * 60;
    const effRest = exempt ? 0 : flex
      ? flexDay.rows.reduce((sum, row) => sum + (row.endMin != null && row.endMin <= nowM ? row.minutes : row.startMin < nowM ? nowM - row.startMin : 0), 0)
      : effectiveDutyBreaks({ recordedBreaks: punches?.breaks, windows, inMinutes: inM, untilMinutes: nowM }).breaks
        .reduce((sum, row) => sum + row.minutes, 0);
    const worked = Math.max(0, nowM - inM - effRest);
    const week = Math.max(0, Number(weekWorkedMinutes) || 0) + worked;
    if (worked >= dayCap || week >= weekCap) {
      alerts.push(alert("ramadan_over", "warn", "hours.ramadan.ordinaryHours", onDate, {
        atMinutes: nowM,
        textAr: worked >= dayCap
          ? `تجاوزت ${dayCap / 60} ساعات اليوم في رمضان — ما زاد إضافي بأجره (المادتان 98 و107).`
          : `بلغت ${weekCap / 60} ساعة هذا الأسبوع في رمضان — ما زاد إضافي بأجره (المادتان 98 و107).`,
        textEn: worked >= dayCap
          ? `Past ${dayCap / 60} hours today in Ramadan — anything above is paid overtime (Arts. 98, 107).`
          : `${weekCap / 60} hours this Ramadan week — anything above is paid overtime (Arts. 98, 107).`,
        hint: { kind: "ramadan", item: { date: onDate, dayHours: Math.round((worked / 60) * 10) / 10 } },
      }));
    } else {
      alerts.push(alert("ramadan_hours", "info", "hours.ramadan.ordinaryHours", onDate, {
        atMinutes: inM + dayCap + effRest,
        textAr: `رمضان: ساعاتك ${dayCap / 60} يومياً و${weekCap / 60} أسبوعياً — تكتمل اليوم عند ${hm(inM + dayCap + effRest)}.`,
        textEn: `Ramadan: your hours are ${dayCap / 60} a day and ${weekCap / 60} a week — today's end at ${hm(inM + dayCap + effRest)}.`,
        hint: { kind: "ramadan", item: { date: onDate } },
      }));
    }
  }

  /* ── Art. 154: her nursing hour at the end of the shift (end / split placement) ── */
  const nursing = nursingHourOn(employee, onDate);
  if (nursing?.endMinutes) {
    const from = shiftEnd - nursing.endMinutes;
    if (nowM >= from && nowM < shiftEnd) {
      alerts.push(alert("nursing_start", "info", "leave.nursing.dailyMinutes", onDate, {
        atMinutes: from,
        meta: { start: hm(from), end: hm(shiftEnd), minutes: nursing.endMinutes },
        textAr: `بدأت ساعة رضاعتك (م 154) — \u2066${hm(from)}–${hm(shiftEnd)}\u2069، تُحسب من ساعات العمل ولا يُخصم بها الأجر.`,
        textEn: `Your nursing hour has started (Art. 154) — ${hm(from)}–${hm(shiftEnd)}, counted as work with no wage cut.`,
        hint: { kind: "nursing", item: { birthDate: employee?.profile?.nursingHour?.childBirthDate || "" } },
      }));
    }
  }
  const expiry = nursingExpiryAlert(employee, onDate);
  if (expiry) alerts.push(expiry);

  /* ── the next prayer inside the shift (info) ── */
  const next = prayersInShift(shift, prayers).find((p) => p.minutes > nowM);
  if (next) {
    alerts.push(alert("prayer_next", "info", "hours.rest.duringShiftMinutes", onDate, {
      atMinutes: next.minutes,
      textAr: `الصلاة القادمة: ${next.ar}`,
      textEn: `Next prayer: ${next.en}`,
      hint: { kind: "rest", item: { date: onDate } },
    }));
  }

  alerts.sort((a, b) => PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id));
  return { alerts, current: alerts[0] || null, exempt, open: true };
}

/**
 * «تنبيهاتي»: a flex break that closed past its minutes and waits on no decision — the same reading
 * the manager's queue uses (attendanceQueue.isLateReturnOpen / breakDayOf). A late return (warn),
 * never a legal breach: the rest was taken, only the return was late. null when none.
 * `row` is the day record (check_in_at / check_out_at / breaks, as the punch card holds it).
 */
export function lateReturnAlertOf({ employee, row, data, now = new Date() } = {}) {
  if (!employee?.id || !(row?.check_in_at || row?.checkInAt)) return null;
  const record = { ...row, check_in_at: row.check_in_at || row.checkInAt, check_out_at: row.check_out_at || row.checkOutAt || null };
  if (!isLateReturnOpen(employee, record, data, now)) return null;
  const day = breakDayOf(employee, record, data, now);
  const allowed = Math.max(0, Number(day.flex?.minutes) || 0);
  const over = Math.max(0, Number(day.overMinutes) || 0);
  const taken = Math.max(0, Number(day.taken) || allowed + over);
  const onDate = String(record.date || record.dateKey || "").slice(0, 10) || toRiyadhDateKey(now);
  return alert("flex_late_return", "warn", "hours.rest.duringShiftMinutes", onDate, {
    atMinutes: null,
    meta: { overMinutes: over, allowedMinutes: allowed, takenMinutes: taken },
    textAr: `عدت من راحتك متأخراً ${minutesAr(over)} — أخذت ${minutesAr(taken)} من ${minutesAr(allowed)}.`,
    textEn: `You came back from your break ${over} min late — ${taken} of ${allowed} min.`,
    hint: { kind: "rest", item: { date: onDate } },
  });
}

/** One live duty alert as a «تنبيهاتي» card (the rail's shape) — the employee's own, never a coworker's. */
export function dutyAlertRailCard(row, { employee, ar = true } = {}) {
  if (!row) return null;
  return {
    id: `duty:${row.id}:${row.ruleId}`,
    employeeId: employee?.id || null,
    name: String(employee?.name || "").trim(),
    href: "/app/attendance",
    classification: ar ? "تنبيه إداري" : "Administrative notice",
    instrument: "",
    // A late return is a manager's call, not a breach — said in the headline, since the rail shows only that.
    headline: row.id === "flex_late_return"
      ? (ar ? `${row.textAr} يقرّر فيها مديرك — ليست مخالفة نظامية.` : `${row.textEn} Your manager decides — not a legal breach.`)
      : (ar ? row.textAr : row.textEn),
    subject: "",
    body: row.id === "flex_late_return"
      ? (ar ? "يراها مديرك عودةً متأخرة ويقرّر فيها — ليست مخالفة نظامية، فراحتك أُخذت." : "Your manager sees it as a late return and decides on it — not a legal breach; your rest was taken.")
      : "",
    footer: "",
    level: row.level === "block" ? "block" : "warn",
    glow: "due",
    audience: "employee",
    decisionId: null,
    // No article badge on a late return: «101» beside it reads as an Art. 101 breach.
    ruleId: row.id === "flex_late_return" ? null : row.ruleId,
    onDate: row.hint?.item?.date || null,
    alertId: row.id,
  };
}

function daysBetween(a, b) {
  const x = Date.parse(`${String(a).slice(0, 10)}T00:00:00Z`);
  const y = Date.parse(`${String(b).slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / 86400000) : NaN;
}

/**
 * «ينتهي حق ساعة الرضاعة في …» — while the right is active and its last day is 30 days away or less
 * (`meta.stage` "soon"), and on the last day itself ("day"). null otherwise.
 */
export function nursingExpiryAlert(employee, onDate) {
  const nursing = nursingHourOn(employee, onDate);
  if (!nursing?.until) return null;
  const left = daysBetween(onDate, nursing.until);
  if (!Number.isFinite(left) || left < 0 || left > NURSING_EXPIRY_LEAD_DAYS) return null;
  const stage = left === 0 ? "day" : "soon";
  return alert("nursing_expiry", "info", "leave.nursing.dailyMinutes", onDate, {
    atMinutes: null,
    meta: { until: nursing.until, stage, daysLeft: left },
    textAr: `ينتهي حق ساعة الرضاعة في \u2066${nursing.until}\u2069`,
    textEn: `Your nursing-hour right ends on ${nursing.until}`,
    hint: { kind: "nursing", item: { birthDate: employee?.profile?.nursingHour?.childBirthDate || "" } },
  });
}

/**
 * The expiry notice for the bell — once 30 days ahead and once on the day, the employee only.
 * Keyed to the right's last day, so a tick on any page, any day of the window, sends it once.
 */
export function planNursingExpiryNotices({ employee, onDate, existingKeys = [], ar = true } = {}) {
  if (!employee?.id) return [];
  const row = nursingExpiryAlert(employee, onDate);
  if (!row) return [];
  const key = `nursing-expiry:${employee.id}:${row.meta.until}:${row.meta.stage}`;
  if ((existingKeys || []).includes(key)) return [];
  return [{ userId: employee.id, key, text: ar ? row.textAr : row.textEn, to: "/app/requests", alertId: row.id, level: row.level, breach: false, live: true }];
}

/** One shift's identity for notice keys: employee × day × shift. */
export function dutyShiftKey(employeeId, onDate, shift) {
  return `${String(employeeId || "")}:${String(onDate || "").slice(0, 10)}:${String(shift?.id || shift?.start || "")}`;
}

/** The short notice texts pushed to the bell. */
export function dutyNoticeText(alertRow, { ar = true, audience = "employee", name = "", app = false } = {}) {
  const who = String(name || "").trim() || (ar ? "موظف" : "A worker");
  if (app && audience !== "manager") {
    const text = appNoticeText(alertRow, ar);
    if (text) return text;
  }
  if (audience === "manager") {
    if (alertRow.id === "presence_breach") {
      return ar
        ? `${who} تجاوز بقاؤه في موقع العمل حد المادة 101 اليوم (منذ ${alertRow.at}) — أنهِ دوامه أو وثّق السبب.`
        : `${who} passed the Art. 101 workplace ceiling today (since ${alertRow.at}) — end the duty or record why.`;
    }
    // The same start the worker's own notice names («بلا راحة منذ …»), then the moment the limit passed.
    const since = alertRow.meta?.since || alertRow.at;
    const passed = alertRow.meta?.since && alertRow.at && alertRow.at !== alertRow.meta.since ? alertRow.at : "";
    return ar
      ? `${who} يعمل بلا راحة منذ ${since}${passed ? ` — تجاوز 5 ساعات عند ${passed}` : " — تجاوز 5 ساعات"}. المادة 101: امنحه راحته الآن.`
      : `${who} has worked without a break since ${since}${passed ? ` — passed 5 hours at ${passed}` : " — over 5 hours"}. Art. 101: give the break now.`;
  }
  if (alertRow.id === "break_soon") {
    const left = alertRow.meta?.minutesLeft ?? DUTY_ALERT_LEAD.breakSoon;
    return ar ? `راحتك بعد ${minutesAr(left)} — ${alertRow.at}.` : `Your break is in ${left} minutes — ${alertRow.at}.`;
  }
  if (alertRow.id === "flex_window_closing") {
    const left = alertRow.meta?.minutesLeft ?? DUTY_ALERT_LEAD.flexWindowClosing;
    return ar ? `نافذة الراحة تنتهي بعد ${minutesAr(left)} — اضغط «بدأت راحتي».` : `The break window ends in ${left} minutes — tap “I started my break”.`;
  }
  if (alertRow.id === "flex_break_over") {
    return ar ? "راحتك تجاوزت مدتها — اضغط «أنهيت راحتي» عند عودتك." : "Your break has run over — tap “I ended my break” when back.";
  }
  if (alertRow.id === "rest_5h_breach") {
    return ar ? "تجاوزت 5 ساعات بلا راحة — لك راحة الآن (المادة 101)." : "Over 5 hours without a break — you are owed one now (Art. 101).";
  }
  if (alertRow.id === "heat_now") {
    return ar ? "نافذة حظر العمل المكشوف بدأت — لا عمل تحت الشمس (القرار 3337)." : "The open-sun ban window has started — no work in the sun (Decision 3337).";
  }
  return ar ? alertRow.textAr : alertRow.textEn;
}

/** The app-level ticker's employee texts — every figure from the catalog via the alert's meta. */
function appNoticeText(row, ar) {
  const meta = row.meta || {};
  if (row.id === "flex_break_ended" || row.id === "flex_break_over" || row.id === "break_over") {
    return ar ? "انتهت راحتك — عُد للعمل." : "Your break is over — back to work.";
  }
  if (row.id === "flex_break_assumed_start") {
    return ar
      ? `بدأت راحتك الآن (\u2066${meta.start}–${meta.end}\u2069) — لم تبصم لها، فتُحتسب تلقائياً`
      : `Your break starts now (${meta.start}–${meta.end}) — you did not punch it, so it counts automatically`;
  }
  if (row.id === "break_now") {
    return ar
      ? `بدأت راحتك الآن (\u2066${meta.start}–${meta.end}\u2069) — لا تُحسب من ساعات العمل.`
      : `Your break starts now (${meta.start}–${meta.end}) — not counted as work.`;
  }
  if (row.id === "rest_5h_breach") {
    const hours = (Number(meta.consecHours) || 0) * Math.max(1, Number(meta.block) || 1);
    const art = row.cite?.labelAr || "المادة 101";
    const artEn = row.cite?.labelEn || "Art. 101";
    return ar
      ? `أكملت ${hoursAr(hours)} متواصلة — راحتك النظامية الآن (${art}): ${minutesAr(meta.minRest)} على الأقل لا تُحسب من ساعات العمل.`
      : `${hours} hours in a row — your statutory rest is due now (${artEn}): at least ${meta.minRest} minutes, not counted as work.`;
  }
  if (row.id === "rest_5h_soon") return ar ? row.textAr : row.textEn;
  if (row.id === "nursing_start") {
    return ar
      ? `بدأت ساعة رضاعتك (م 154) — \u2066${meta.start}–${meta.end}\u2069`
      : `Your nursing hour has started (Art. 154) — ${meta.start}–${meta.end}`;
  }
  return "";
}

/** The ticker's dedupe key per alert: one per shift, the 5h rule once per block of a stretch, one per break end. */
function appNoticeKey(shiftKey, row) {
  const meta = row.meta || {};
  if (row.id === "rest_5h_breach") return `duty-alert:${shiftKey}:rest_5h_breach:${meta.since || ""}:${meta.block || 1}`;
  if (row.id === "rest_5h_soon") return `duty-alert:${shiftKey}:rest_5h_soon:${meta.since || ""}`;
  if (row.id === "flex_break_ended" || row.id === "flex_break_over") return `duty-alert:${shiftKey}:break_end:${meta.breakStart || ""}`;
  if (row.id === "flex_break_assumed_start") return `duty-alert:${shiftKey}:assumed_start:${meta.start || ""}`;
  if (row.id === "break_now" || row.id === "break_over") return `duty-alert:${shiftKey}:${row.id}:${meta.start || ""}`;
  if (row.id === "nursing_start") return `duty-alert:${shiftKey}:nursing_start:${meta.start || ""}`;
  return `duty-alert:${shiftKey}:${row.id}`;
}

/**
 * Bell notices for this minute's alerts — the employee once per shift per alert, and the direct
 * manager once for a real Art. 101 breach (`rest_5h_breach` after the break was due, or
 * `presence_breach`). Keys: `duty-alert:<shiftKey>:<alertId>` (employee) and
 * `duty-alert-mgr:<managerId>:<shiftKey>:<alertId>`; a key already in `existingKeys` is skipped.
 * Returns [{ userId, key, text, to }].
 */
export function planDutyAlertNotices({ alerts = [], employee, managerId, shiftKey, existingKeys = [], ar = true, app = false } = {}) {
  if (!employee?.id || !shiftKey) return [];
  const seen = new Set((existingKeys || []).filter(Boolean));
  const plans = [];
  const notify = app ? DUTY_NOTIFY_APP : DUTY_NOTIFY_EMPLOYEE;
  for (const row of alerts) {
    if (!row || row.recorded) continue;
    if (notify.includes(row.id)) {
      const key = app ? appNoticeKey(shiftKey, row) : `duty-alert:${shiftKey}:${row.id}`;
      // The 3337 worker notice (heatBanNotify) already told this person the window opened today.
      const day = String(shiftKey).split(":")[1] || "";
      const heatTold = row.id === "heat_now" && seen.has(`3337-worker:${employee.id}:${day}`);
      if (!seen.has(key) && !heatTold) {
        seen.add(key);
        // The 5h rule on a flex shift with minutes left carries the one-tap «بدأت راحتي» (focus=break).
        const startBreak = app && row.id === "rest_5h_breach" && row.meta?.startable === true;
        plans.push({
          userId: employee.id,
          key,
          text: dutyNoticeText(row, { ar, app }),
          to: startBreak ? "/app/attendance?focus=break" : "/app/attendance",
          ...(app ? { alertId: row.id, level: row.level, breach: row.breach, live: true } : {}),
          ...(startBreak ? { action: "break_start" } : {}),
        });
      }
    }
    if (row.breach && DUTY_NOTIFY_MANAGER.includes(row.id) && managerId && String(managerId) !== String(employee.id)) {
      const key = `duty-alert-mgr:${managerId}:${shiftKey}:${row.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        plans.push({ userId: managerId, key, text: dutyNoticeText(row, { ar, audience: "manager", name: employee.name }), to: "/app/attendance" });
      }
    }
  }
  return plans;
}
