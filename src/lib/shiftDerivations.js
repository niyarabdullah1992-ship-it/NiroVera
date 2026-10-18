/** Client mirror of base44/shared/shiftDerivations.ts — keep in sync. */

import { citeRule, isRamadanDay, isRamadanHoursSubject, ruleValue } from "./laborRules.js";
import { checkHeatBanGate, heatBanWindow, isHeatBanDate, monthHasHeatBanDay, shiftOverlapsNight } from "./contractLawDerivations.js";
import { rosterLawChecks } from "./rosterLawGates.js";

export function minutesBetween(start, end) {
  const [sh, sm] = String(start || "0:0").split(":").map(Number);
  const [eh, em] = String(end || "0:0").split(":").map(Number);
  let m = (eh * 60 + em) - (sh * 60 + sm);
  if (m < 0) m += 1440;
  return m;
}

/** Clock "HH:MM" → minutes after the shift start (wraps past midnight). */
function offsetFromStart(start, clock) {
  return minutesBetween(start || "00:00", clock || "00:00");
}

/**
 * Breaks inside a shift as offsets from its start. `breaks` = [{ start, end }] clocks or [{ minutes }]
 * (an unplaced break). Sorted; unplaced breaks return `null` offsets.
 */
export function shiftBreaks(shift) {
  const list = Array.isArray(shift?.breaks) ? shift.breaks : [];
  return list
    .map((row) => {
      if (row?.start && row?.end) {
        const from = offsetFromStart(shift.start, row.start);
        const minutes = minutesBetween(row.start, row.end);
        return { from, to: from + minutes, minutes };
      }
      const minutes = Math.max(0, Number(row?.minutes) || 0);
      return minutes ? { from: null, to: null, minutes } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.from ?? 0) - (b.from ?? 0));
}

/** Total rest inside a shift — a flex break's minutes, else the breaks list when present, else restMinutes. */
export function shiftRestMinutes(shift) {
  if (shift?.breakMode === "flex" && Number(shift?.flexBreak?.minutes) > 0) return Math.round(Number(shift.flexBreak.minutes));
  const breaks = shiftBreaks(shift);
  if (breaks.length) return breaks.reduce((sum, row) => sum + row.minutes, 0);
  return shift?.restMinutes == null ? null : Math.max(0, Number(shift.restMinutes) || 0);
}

/* ── Break mode per shift type (Arts 101–103) ────────────────────────────────────────────────
 * «راحة ثابتة» fixed (the default, and any missing value): the roster places the break; nothing to press.
 * «راحة مرنة ببصمة» flex: the shift type sets `flexBreak: { minutes, from, to, split, earlyEnd }`;
 *   the worker punches «بدأت راحتي» / «أنهيت راحتي» inside the window.
 * «عمل متواصل (المادة 103)» continuous: the hours policy's Art. 103 flag — never stored on a shift type.
 */
export const BREAK_MODES = ["fixed", "flex", "continuous"];

const clockOfHm = (hm) => {
  const m = String(hm ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const hmOfClock = (mins) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const hoursText = (mins) => `${Math.floor(mins / 60)}:${String(Math.round(mins % 60)).padStart(2, "0")}`;

/** "HH:MM" or an ISO instant → minutes after Riyadh midnight (UTC+3, no DST); null when unreadable. */
export function riyadhClockOf(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const hm = clockOfHm(raw);
  if (hm != null) return hm;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  const mins = Math.floor(at.getTime() / 60000) + 180;
  return ((mins % 1440) + 1440) % 1440;
}

/** The break mode a shift type runs under. Art. 103 (the hours policy flag) wins; else flex or fixed. */
export function shiftBreakMode(shift, { continuous103 = false } = {}) {
  if (continuous103 === true) return "continuous";
  return shift?.breakMode === "flex" ? "flex" : "fixed";
}

/**
 * A flex shift type's break on the shift day's clock (null unless breakMode is "flex"):
 * { minutes, from, to, split, splitEffective, earlyEnd, minPart, span, shiftStart, fromOff, toOff, fromMin, toMin }.
 * Offsets are minutes after the shift start; fromMin / toMin are minutes after the shift day's midnight.
 */
export function flexBreakOf(shift, onDate) {
  if (shift?.breakMode !== "flex") return null;
  const shiftStart = clockOfHm(shift.start);
  if (shiftStart == null || clockOfHm(shift.end) == null) return null;
  const span = minutesBetween(shift.start, shift.end) || 1440;
  const cfg = shift.flexBreak && typeof shift.flexBreak === "object" ? shift.flexBreak : {};
  const minPart = ruleValue("hours.rest.duringShiftMinutes", onDate) || 30;
  const minutes = Math.max(0, Math.round(Number(cfg.minutes) || 0));
  const fromClock = clockOfHm(cfg.from);
  const toClock = clockOfHm(cfg.to);
  const fromOff = fromClock == null ? null : offsetFromStart(shift.start, cfg.from);
  const toOff = toClock == null ? null : offsetFromStart(shift.start, cfg.to);
  const split = cfg.split === true;
  return {
    minutes,
    from: fromClock == null ? "" : hmOfClock(fromClock),
    to: toClock == null ? "" : hmOfClock(toClock),
    split,
    splitEffective: split && minutes >= minPart * 2,
    earlyEnd: cfg.earlyEnd === true,
    minPart,
    span,
    shiftStart,
    fromOff,
    toOff,
    fromMin: fromOff == null ? null : shiftStart + fromOff,
    toMin: toOff == null ? null : shiftStart + toOff,
  };
}

/**
 * Art. 101 for a flex break — the shape of checkConsecutiveWorkGate, with named reasons:
 * SHIFT_STAY_OVER_CAP (presence above the 12 h workplace ceiling), FLEX_MINUTES_BELOW_MIN,
 * FLEX_WINDOW_REQUIRED, FLEX_WINDOW_OUTSIDE_SHIFT, FLEX_WINDOW_TOO_SHORT, FLEX_WINDOW_TOO_LATE (the
 * work before the window passes the consecutive-hours limit), FLEX_WINDOW_TOO_EARLY (the work after it
 * does), FLEX_NO_LAWFUL_PLACEMENT (no start inside the window keeps both sides within the limit).
 */
export function checkFlexBreakGate({ shift, onDate, maxConsecutiveHours } = {}) {
  const flex = flexBreakOf(shift, onDate);
  const maxHours = Number(maxConsecutiveHours) > 0 ? Number(maxConsecutiveHours) : ruleValue("hours.rest.maxConsecutiveHours", onDate);
  const maxMin = maxHours * 60;
  const minRest = ruleValue("hours.rest.duringShiftMinutes", onDate);
  const cite = citeRule("hours.rest.duringShiftMinutes", onDate);
  const art = cite?.labelAr || "المادة 101";
  const artEn = cite?.labelEn || "Art. 101";
  const base = { mode: "flex", cite, maxHours, minRest, span: flex?.span ?? 0, restMinutes: flex?.minutes ?? 0, flex };
  const fail = (error, reason, reasonEn) => ({ ...base, ok: false, error, reason, reasonEn, maxBlock: base.span });
  if (!flex) return fail("FLEX_SHIFT_REQUIRED", "حدد بداية الوردية ونهايتها.", "Set the shift start and end.");
  const stayCap = ruleValue("hours.workplace.maxHours", onDate);
  if (flex.span > stayCap * 60) {
    return fail(
      "SHIFT_STAY_OVER_CAP",
      `حضور الوردية ${hoursText(flex.span)} ساعة فوق ${stayCap} ساعة في موقع العمل (${art}).`,
      `A ${hoursText(flex.span)} h presence is above ${stayCap} h at the workplace (${artEn}).`,
    );
  }
  if (flex.minutes < minRest) {
    return fail(
      "FLEX_MINUTES_BELOW_MIN",
      `مدة الراحة ${flex.minutes} دقيقة أقل من ${minRest} دقيقة نظامية (${art}).`,
      `A ${flex.minutes}-minute break is below the statutory ${minRest} minutes (${artEn}).`,
    );
  }
  if (flex.fromOff == null || flex.toOff == null) {
    return fail("FLEX_WINDOW_REQUIRED", "حدد نافذة الراحة: من وإلى.", "Set the break window: from and to.");
  }
  if (flex.fromOff >= flex.span || flex.toOff > flex.span || flex.toOff <= flex.fromOff) {
    return fail(
      "FLEX_WINDOW_OUTSIDE_SHIFT",
      `نافذة الراحة ⁦${flex.from}–${flex.to}⁩ خارج الوردية ⁦${shift.start}–${shift.end}⁩.`,
      `The ${flex.from}–${flex.to} break window is outside the ${shift.start}–${shift.end} shift.`,
    );
  }
  if (flex.toOff - flex.fromOff < flex.minutes) {
    return fail(
      "FLEX_WINDOW_TOO_SHORT",
      `النافذة ⁦${flex.from}–${flex.to}⁩ أقصر من مدة الراحة ${flex.minutes} دقيقة.`,
      `The ${flex.from}–${flex.to} window is shorter than the ${flex.minutes}-minute break.`,
    );
  }
  const note = flex.split && !flex.splitEffective
    ? { noteAr: `التقسيم يحتاج ${minRest * 2} دقيقة على الأقل — جزءان كل منهما ${minRest}.`, noteEn: `Splitting needs at least ${minRest * 2} minutes — two parts of ${minRest}.` }
    : {};
  if (flex.span <= maxMin) return { ...base, ok: true, maxBlock: flex.span, ...note };
  const consecCite = citeRule("hours.rest.maxConsecutiveHours", onDate);
  const cArt = consecCite?.labelAr || "المادة 101";
  const cArtEn = consecCite?.labelEn || "Art. 101";
  if (flex.fromOff > maxMin) {
    return fail(
      "FLEX_WINDOW_TOO_LATE",
      `تبدأ نافذة الراحة ${flex.from} بعد ${hoursText(flex.fromOff)} من بداية الوردية — لا يبقى العمل قبلها ${maxHours} ساعات أو أقل (${cArt}).`,
      `The window opens at ${flex.from}, ${hoursText(flex.fromOff)} into the shift — the work before it cannot stay within ${maxHours} hours (${cArtEn}).`,
    );
  }
  if (flex.span - flex.toOff > maxMin) {
    return fail(
      "FLEX_WINDOW_TOO_EARLY",
      `تنتهي نافذة الراحة ${flex.to} ويبقى بعدها ${hoursText(flex.span - flex.toOff)} عمل فوق حد ${maxHours} ساعات (${cArt}).`,
      `The window closes at ${flex.to} with ${hoursText(flex.span - flex.toOff)} of work after it — above the ${maxHours}-hour limit (${cArtEn}).`,
    );
  }
  // One part: a start s with s ≤ limit before it and span − s − minutes ≤ limit after it.
  const lo = Math.max(flex.fromOff, flex.span - flex.minutes - maxMin);
  const hi = Math.min(flex.toOff - flex.minutes, maxMin);
  let ok = lo <= hi;
  let maxBlock = ok ? Math.max(lo, flex.span - lo - flex.minutes) : flex.span;
  if (!ok && flex.splitEffective) {
    // Two parts: the first as late as the limit allows, the second as late as the window allows.
    const p1 = minRest;
    const p2 = flex.minutes - minRest;
    const s1 = Math.min(maxMin, flex.toOff - flex.minutes);
    const e1 = s1 + p1;
    const s2 = Math.min(e1 + maxMin, flex.toOff - p2);
    ok = s1 >= flex.fromOff && s2 >= e1 && flex.span - (s2 + p2) <= maxMin;
    if (ok) maxBlock = Math.max(s1, s2 - e1, flex.span - s2 - p2);
  }
  if (!ok) {
    return fail(
      "FLEX_NO_LAWFUL_PLACEMENT",
      `لا موضع للراحة داخل النافذة ⁦${flex.from}–${flex.to}⁩ يُبقي العمل قبلها وبعدها ${maxHours} ساعات أو أقل (${cArt}).`,
      `No start inside the ${flex.from}–${flex.to} window keeps the work before and after it within ${maxHours} hours (${cArtEn}).`,
    );
  }
  return { ...base, ok: true, maxBlock, ...note };
}

/**
 * The break mode of one shift type, validated: BREAK_MODE_UNKNOWN, BREAK_MODE_NEEDS_103 (a stored
 * «continuous» without the Minister's decision on the hours policy), and the flex gate's reasons.
 * Fixed is checked by checkConsecutiveWorkGate as before. Returns { ok, mode, error?, reason?, reasonEn?, cite }.
 */
export function checkShiftBreakModeGate({ shift, onDate, continuous103 = false, maxConsecutiveHours } = {}) {
  const stored = shift?.breakMode;
  if (stored != null && stored !== "" && !BREAK_MODES.includes(stored)) {
    return { ok: false, mode: "fixed", error: "BREAK_MODE_UNKNOWN", reason: "نوع الراحة غير معروف — اختر ثابتة أو مرنة ببصمة.", reasonEn: "Unknown break mode — choose fixed or flex.", cite: citeRule("hours.rest.duringShiftMinutes", onDate) };
  }
  if (stored === "continuous" && continuous103 !== true) {
    const cite = citeRule("hours.art103.cite", onDate);
    return {
      ok: false,
      mode: "fixed",
      error: "BREAK_MODE_NEEDS_103",
      reason: `العمل المتواصل يحتاج قرار الوزير — فعّله من «لدي قرار الوزير للعمل المتواصل» أعلى أنواع الورديات (${cite?.labelAr || "المادة 103"}).`,
      reasonEn: `Continuous work needs the Minister's decision — turn it on in «We hold the Minister's decision» above the shift types (${cite?.labelEn || "Art. 103"}).`,
      cite,
    };
  }
  const mode = shiftBreakMode(shift, { continuous103 });
  if (mode === "continuous") return { ok: true, mode, via: "art103", cite: citeRule("hours.art103.cite", onDate) };
  if (mode === "flex") return checkFlexBreakGate({ shift, onDate, maxConsecutiveHours });
  return { ok: true, mode, cite: citeRule("hours.rest.duringShiftMinutes", onDate) };
}

/**
 * The break list on an attendance day record → rows on the shift day's clock (after-midnight minutes
 * of a night shift add 1440). Each row: { start, end, startMin, endMin, minutes, open, source, short,
 * review, startAt, endAt }. An open break (no end) runs to `until` when given, else has no end.
 */
export function readDayBreaks(list, { shiftStart = null, until = null } = {}) {
  const lift = (m) => (m != null && shiftStart != null && m + 720 < shiftStart ? m + 1440 : m);
  return (Array.isArray(list) ? list : [])
    .map((row) => {
      const s = lift(riyadhClockOf(row?.start));
      if (s == null) return null;
      const eRaw = riyadhClockOf(row?.end);
      let e = eRaw == null ? null : lift(eRaw);
      if (e != null && e < s) e += 1440;
      const open = e == null;
      const endMin = open ? (until == null ? null : Math.max(s, until)) : e;
      return {
        start: hmOfClock(s),
        end: endMin == null ? "" : hmOfClock(endMin),
        startMin: s,
        endMin,
        minutes: endMin == null ? 0 : endMin - s,
        open,
        source: row?.source === "assumed" ? "assumed" : "punch",
        short: row?.short === true,
        review: row?.review || null,
        startAt: row?.start || null,
        endAt: row?.end || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startMin - b.startMin);
}

/**
 * Where an unpunched flex break is assumed (Art. 102 still deducts it): at the prayer inside the
 * window nearest its middle, else the window's middle — for the full minutes, kept inside the
 * window and, when it fits, inside the presence. `latestStart` / `earliestStart` keep the work before
 * (and after) it within the Art. 101 limit: the latest point that still keeps ≤ 5 h before it.
 * `prayers` is a computePrayerTimes / stationPrayerTimes day ({ minutes: { fajr, dhuhr, asr, maghrib, isha } }) or null.
 */
export function placeAssumedFlexBreak({ flex, prayers = null, inMin = null, outMin = null, latestStart = null, earliestStart = null } = {}) {
  if (!flex || flex.fromMin == null || flex.toMin == null || !flex.minutes) return null;
  const minutes = flex.minutes;
  const mid = (flex.fromMin + flex.toMin) / 2;
  let lo = flex.fromMin;
  let hi = Math.max(flex.fromMin, flex.toMin - minutes);
  const pLo = inMin == null ? lo : Math.max(lo, inMin);
  const pHi = outMin == null ? hi : Math.min(hi, outMin - minutes);
  if (pLo <= pHi) { lo = pLo; hi = pHi; }
  // Art. 101: no more than the consecutive-hours limit before it (latestStart) and, when the window
  // allows, after it (earliestStart). The limit before wins — the break must begin by the 5h mark.
  if (latestStart != null) hi = Math.max(flex.fromMin, Math.min(hi, latestStart));
  if (earliestStart != null) lo = Math.min(hi, Math.max(lo, earliestStart));
  if (lo > hi) lo = hi;
  let best = null;
  for (const key of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) {
    let at = prayers?.minutes?.[key];
    if (!Number.isFinite(at)) continue;
    if (at + 720 < flex.shiftStart) at += 1440;
    if (at < flex.fromMin || at >= flex.toMin) continue;
    const d = Math.abs(at - mid);
    if (!best || d < best.d) best = { d, key, at };
  }
  const want = best ? best.at : Math.round(mid - minutes / 2);
  const startMin = Math.min(Math.max(want, lo), hi);
  return {
    start: hmOfClock(startMin),
    end: hmOfClock(startMin + minutes),
    startMin,
    endMin: startMin + minutes,
    minutes,
    source: "assumed",
    placedBy: best ? "prayer" : "middle",
    prayerKey: best?.key || "",
  };
}

/**
 * One flex day read from its punches: { mode, flex, rows, punched, open, assumed, taken, remaining,
 * runningMinutes, overMinutes (late return beyond the allowed minutes), shortCount, windowState,
 * forDuty (rests deducted — punched and assumed), forConsec (the rests for Art. 101 — punched and
 * assumed: an assumed break is a rest like a fixed one, not a breach), planned, assumedRunning }.
 * Not flex → { mode, flex: null, …, forDuty: null } and the caller keeps its own reading.
 * With none punched, the assumed break is decided at check-in (`planned`): the nearest prayer in the
 * window, else its middle, no later than the consecutive-hours limit after the check-in. It begins
 * when the clock reaches its start — `assumedRunning` until its end, as a punched break would — and a
 * «بدأت راحتي» punch replaces it. A checkout inside it ends it there.
 */
export function resolveFlexDayBreaks({ shift, breaks, checkIn, checkOut, now, onDate, prayers = null, continuous103 = false, plan: ownParts = null } = {}) {
  const mode = shiftBreakMode(shift, { continuous103 });
  const flex = mode === "flex" ? flexBreakOf(shift, onDate) : null;
  const out = { mode, flex, rows: [], punched: [], open: null, assumed: null, taken: 0, remaining: flex?.minutes || 0, runningMinutes: 0, overMinutes: 0, shortCount: 0, windowState: "", forDuty: null, forConsec: null, planned: null, assumedRunning: false };
  if (!flex) return out;
  const lift = (m) => (m != null && m + 720 < flex.shiftStart ? m + 1440 : m);
  const inM = lift(riyadhClockOf(checkIn));
  let outM = lift(riyadhClockOf(checkOut));
  if (inM != null && outM != null && outM <= inM) outM += 1440;
  let nowM = outM != null ? outM : lift(riyadhClockOf(now));
  if (inM != null && nowM != null && nowM < inM) nowM += 1440;
  out.windowState = nowM == null || flex.fromMin == null ? "" : nowM < flex.fromMin ? "before" : nowM < flex.toMin ? "open" : "closed";
  out.forDuty = [];
  out.forConsec = [];
  if (inM == null) return out;
  const rows = readDayBreaks(breaks, { shiftStart: flex.shiftStart, until: nowM })
    .map((row) => (row.open && outM != null ? { ...row, open: false, closedAtCheckout: true } : row));
  const punched = rows.filter((row) => row.source === "punch");
  const open = punched.find((row) => row.open) || null;
  const taken = punched.filter((row) => !row.open).reduce((sum, row) => sum + row.minutes, 0);
  const running = open && nowM != null ? Math.max(0, nowM - open.startMin) : 0;
  out.punched = punched;
  out.open = open;
  out.taken = taken;
  out.runningMinutes = running;
  out.remaining = Math.max(0, flex.minutes - taken);
  out.overMinutes = Math.max(0, taken + running - flex.minutes);
  out.shortCount = punched.filter((row) => !row.open && row.minutes < flex.minPart).length;
  let assumed = null;
  out.planned = null;
  out.assumedRunning = false;
  if (!punched.length) {
    const stored = rows.find((row) => row.source === "assumed");
    const endM = nowM;
    const consecMax = (ruleValue("hours.rest.maxConsecutiveHours", onDate) || 5) * 60;
    const touches = endM != null && inM < flex.toMin && endM > flex.fromMin;
    // Decided at check-in, so the notice can fire the minute it begins: never later than the 5h mark.
    // The worker's own plan (one lawful block) is where an unpunched break is assumed — his choice first.
    const ownPlan = ownParts ? checkRestPlanGate({ shift, onDate, parts: ownParts, continuous103 }) : null;
    const ownBlock = ownPlan?.ok && ownPlan.rows.length === 1 ? { ...ownPlan.rows[0], source: "assumed", fromPlan: true } : null;
    const placed = ownBlock || (inM < flex.toMin
      ? placeAssumedFlexBreak({ flex, prayers, inMin: inM, latestStart: inM + consecMax, earliestStart: flex.shiftStart + flex.span - consecMax - flex.minutes })
      : null);
    const plan = placed && placed.startMin >= inM ? placed : null;
    out.planned = plan;
    if (stored) {
      assumed = { ...stored, source: "assumed" };
    } else if (plan && endM != null && endM >= plan.startMin && (outM == null || plan.startMin < outM)) {
      assumed = outM != null && plan.endMin > outM
        ? { ...plan, end: hmOfClock(outM), endMin: outM, minutes: outM - plan.startMin, closedAtCheckout: true }
        : plan;
      out.assumedRunning = outM == null && endM < plan.endMin;
    } else if (touches && outM != null && outM - inM > consecMax) {
      assumed = placeAssumedFlexBreak({ flex, prayers, inMin: inM, outMin: outM });
    }
  }
  out.assumed = assumed;
  out.rows = [...punched, ...(assumed ? [assumed] : [])].sort((a, b) => a.startMin - b.startMin);
  out.forDuty = out.rows.filter((row) => row.endMin != null && row.endMin > row.startMin).map((row) => ({ start: row.start, end: row.end }));
  // Art. 101: an assumed break is a rest like a fixed one — the 5h check reads it too (no breach).
  out.forConsec = out.forDuty.slice();
  return out;
}

/** The platform rule for a long shift: more than the ordinary day (Art. 98, 8 h) opens a one-hour rest. */
export const LONG_SHIFT_REST_MINUTES = 60;

/**
 * A shift longer than the ordinary day gets a one-hour flex break the worker places himself in بصمتي —
 * split in two by default, the window from the first half hour after the start to the last before the end.
 * Returns the patch to apply, or null (short shift · already flex · continuous Art. 103 · fixed by choice).
 */
export function longShiftRestPatch(shift, onDate) {
  // The worker sets his own rest (owner's rule): the roster holds no break settings. Every shift with more than
  // five hours (Art. 101) gets a rest the worker places in بصمتي — its length read from the shift's hours: what
  // the duty holds past the ordinary eight (8:30 → 30, 9:00 → 60), never under the statutory minimum and at most
  // an hour. The window is the whole duty; a rest of twice the minimum may be split.
  if (!shift || shift.breakMode === "continuous") return null;
  const start = clockOfHm(shift.start);
  if (start == null || clockOfHm(shift.end) == null) return null;
  const span = minutesBetween(shift.start, shift.end) || 1440;
  const consecMax = (Number(ruleValue("hours.rest.maxConsecutiveHours", onDate)) || 5) * 60;
  if (span <= consecMax) return null;
  const ordinary = (Number(ruleValue("hours.shift.ordinaryHours", onDate)) || 8) * 60;
  const minPart = ruleValue("hours.rest.duringShiftMinutes", onDate) || 30;
  const minutes = Math.min(LONG_SHIFT_REST_MINUTES, Math.max(minPart, span - ordinary));
  const flexBreak = {
    minutes,
    from: hmOfClock(start),
    to: hmOfClock(start + span),
    split: minutes >= minPart * 2,
    earlyEnd: false,
  };
  const fb = shift.flexBreak || {};
  const same = shift.breakMode === "flex" && Number(shift.restMinutes) === minutes
    && Number(fb.minutes) === minutes && fb.from === flexBreak.from && fb.to === flexBreak.to
    && fb.split === flexBreak.split && fb.earlyEnd === false;
  if (same) return null;
  return { breakMode: "flex", restMinutes: minutes, flexBreak };
}

/**
 * The worker's own rest plan on a flex shift — he chooses where his break sits, ahead of time.
 * parts: [{ start: "HH:MM", minutes }] — one block, or two parts when the shift splits the break.
 * Named reasons: NOT_FLEX_BREAK, REST_PLAN_EMPTY, REST_PLAN_SPLIT_OFF, REST_PLAN_PART_SHORT,
 * REST_PLAN_TOTAL, REST_PLAN_OUTSIDE_WINDOW, REST_PLAN_OVERLAP, REST_PLAN_CONSECUTIVE (Art. 101: no more
 * than the consecutive-hours limit of work before, between or after the parts).
 * ok → { rows: [{ start, end, startMin, endMin, minutes }] } on the shift day's clock.
 */
export function checkRestPlanGate({ shift, onDate, parts = [], continuous103 = false } = {}) {
  const cite = citeRule("hours.rest.maxConsecutiveHours", onDate);
  const art = cite?.labelAr || "المادة 101";
  const artEn = cite?.labelEn || "Art. 101";
  const fail = (error, reason, reasonEn) => ({ ok: false, error, reason, reasonEn, cite });
  const flex = shiftBreakMode(shift, { continuous103 }) === "flex" ? flexBreakOf(shift, onDate) : null;
  if (!flex) return fail("NOT_FLEX_BREAK", "راحة هذه الوردية ثابتة في الجدول.", "This shift's break is fixed on the roster.");
  const list = (Array.isArray(parts) ? parts : []).filter((row) => row && clockOfHm(row.start) != null);
  if (!list.length) return fail("REST_PLAN_EMPTY", "اختر وقت بداية راحتك.", "Choose when your break starts.");
  if (list.length > 1 && !flex.splitEffective) return fail("REST_PLAN_SPLIT_OFF", "هذه الوردية لا تقسّم الراحة — اختر وقتاً واحداً.", "This shift does not split the break — choose one time.");
  const lift = (m) => (m + 720 < flex.shiftStart ? m + 1440 : m);
  const rows = list.map((row) => {
    const startMin = lift(clockOfHm(row.start));
    const minutes = Math.round(Number(row.minutes) || 0);
    return { start: hmOfClock(startMin), end: hmOfClock(startMin + minutes), startMin, endMin: startMin + minutes, minutes };
  }).sort((a, b) => a.startMin - b.startMin);
  if (rows.some((row) => row.minutes < flex.minPart)) {
    return fail("REST_PLAN_PART_SHORT", `كل جزء من الراحة ${flex.minPart} دقيقة على الأقل (${citeRule("hours.rest.duringShiftMinutes", onDate)?.labelAr || "المادة 101"}).`, `Each part is at least ${flex.minPart} minutes.`);
  }
  const total = rows.reduce((sum, row) => sum + row.minutes, 0);
  if (total !== flex.minutes) return fail("REST_PLAN_TOTAL", `مجموع الراحة ${total} دقيقة — المطلوب ${flex.minutes}.`, `The parts add up to ${total} min — the break is ${flex.minutes}.`);
  // The time is open across the duty hours — he writes it himself; only the shift's own edges bound it.
  const dutyEnd = flex.shiftStart + flex.span;
  if (rows.some((row) => row.startMin < flex.shiftStart || row.endMin > dutyEnd)) {
    return fail("REST_PLAN_OUTSIDE_WINDOW", `الراحة داخل ساعات دوامك ⁦${hmOfClock(flex.shiftStart)}–${hmOfClock(dutyEnd)}⁩.`, `The break sits inside your duty hours ${hmOfClock(flex.shiftStart)}–${hmOfClock(dutyEnd)}.`);
  }
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].startMin < rows[i - 1].endMin) return fail("REST_PLAN_OVERLAP", "الجزءان متداخلان — اجعل الثاني بعد نهاية الأول.", "The parts overlap — start the second after the first ends.");
  }
  const maxMin = (ruleValue("hours.rest.maxConsecutiveHours", onDate) || 5) * 60;
  const shiftEnd = flex.shiftStart + flex.span;
  let from = flex.shiftStart;
  for (const row of [...rows, { startMin: shiftEnd, endMin: shiftEnd }]) {
    if (row.startMin - from > maxMin) {
      const hours = Math.round(((row.startMin - from) / 60) * 10) / 10;
      return fail(
        "REST_PLAN_CONSECUTIVE",
        `بهذا الوقت تعمل ${Math.floor((row.startMin - from) / 60)}:${String((row.startMin - from) % 60).padStart(2, "0")} ساعة متواصلة من ${hmOfClock(from)} إلى ${hmOfClock(row.startMin)} — الحد ${maxMin / 60} ساعات (${art}).`,
        `That puts ${hours} hours of work in a row from ${hmOfClock(from)} to ${hmOfClock(row.startMin)} — the limit is ${maxMin / 60} hours (${artEn}).`,
      );
    }
    from = row.endMin;
  }
  return { ok: true, rows, cite };
}

/** Every lawful start for a one-block plan (or the first part), every `step` minutes inside the window. */
export function restPlanStarts({ shift, onDate, minutes, step = 15, continuous103 = false } = {}) {
  const flex = shiftBreakMode(shift, { continuous103 }) === "flex" ? flexBreakOf(shift, onDate) : null;
  if (!flex || flex.fromMin == null || flex.toMin == null) return [];
  const out = [];
  for (let m = flex.fromMin; m + minutes <= flex.toMin; m += step) out.push(hmOfClock(m));
  return out;
}

/**
 * The plan's choices, already lawful: `single` — every start for the whole break in one block;
 * `pairs` — for a split break, each first-part start with the second-part starts that keep Art. 101.
 */
export function restPlanChoices({ shift, onDate, continuous103 = false, step = 15, avoid = [] } = {}) {
  const flex = shiftBreakMode(shift, { continuous103 }) === "flex" ? flexBreakOf(shift, onDate) : null;
  if (!flex) return { flex: null, single: [], pairs: [], avoided: 0 };
  // Times already taken in the day (a prayer, a nursing hour) are left out of the choices, so the worker's
  // own rest does not swallow them. If avoiding them would leave nothing, they are offered after all.
  const busy = (Array.isArray(avoid) ? avoid : [])
    .map((row) => ({ from: Number(row?.from), to: Number(row?.to ?? row?.from) }))
    .filter((row) => Number.isFinite(row.from));
  const lift = (m) => (m + 720 < flex.shiftStart ? m + 1440 : m);
  const clashes = (parts) => parts.some((part) => {
    const a = lift(clockOfHm(part.start));
    const b = a + part.minutes;
    return busy.some((row) => {
      const from = lift(row.from);
      const to = Math.max(from + 1, lift(row.to));
      return from < b && to > a;
    });
  });
  const lawful = (parts) => checkRestPlanGate({ shift, onDate, parts, continuous103 }).ok;
  let avoided = 0;
  const ok = (parts) => {
    if (!lawful(parts)) return false;
    if (busy.length && clashes(parts)) { avoided += 1; return false; }
    return true;
  };
  const single = restPlanStarts({ shift, onDate, minutes: flex.minutes, step, continuous103 })
    .filter((start) => ok([{ start, minutes: flex.minutes }]));
  const pairs = [];
  if (flex.splitEffective) {
    const half = Math.floor(flex.minutes / 2);
    const rest = flex.minutes - half;
    const starts = restPlanStarts({ shift, onDate, minutes: Math.min(half, rest), step, continuous103 });
    for (const first of starts) {
      const seconds = starts.filter((second) => ok([{ start: first, minutes: half }, { start: second, minutes: rest }]));
      if (seconds.length) pairs.push({ first, seconds, firstMinutes: half, secondMinutes: rest });
    }
  }
  if (busy.length && !single.length && !pairs.length) return restPlanChoices({ shift, onDate, continuous103, step });
  return { flex, single, pairs, avoided };
}

/**
 * «بدأت راحتي» / «أنهيت راحتي» on a flex shift — one gate for the punch card and the server.
 * input: { action: "start"|"end", shift, breaks (the day record's list), checkIn, checkOut, now, onDate,
 * continuous103 }. Times may be ISO instants or "HH:MM". Named reasons: NOT_FLEX_BREAK, NOT_CHECKED_IN,
 * DAY_CLOSED, BREAK_ALREADY_OPEN, BREAK_WINDOW_NOT_OPEN («تبدأ نافذة الراحة 11:00»), BREAK_WINDOW_CLOSED,
 * BREAK_ALREADY_TAKEN (no split), BREAK_DONE, BREAK_REMAINDER_SHORT, NO_OPEN_BREAK, BREAK_BELOW_MIN
 * («أقل راحة نظامية 30 دقيقة (المادة 101)») — unless the shift type allows an early end: then ok with
 * `short: true` and the reason kept, so the card can say it will be recorded short.
 */
export function checkFlexBreakPunchGate(input = {}) {
  const { action, shift, breaks, checkIn, checkOut, now, onDate, continuous103 = false } = input;
  const cite = citeRule("hours.rest.duringShiftMinutes", onDate);
  const art = cite?.labelAr || "المادة 101";
  const artEn = cite?.labelEn || "Art. 101";
  const day = resolveFlexDayBreaks({ shift, breaks, checkIn, checkOut: null, now, onDate, continuous103 });
  const flex = day.flex;
  const base = { cite, remaining: day.remaining, taken: day.taken, open: day.open, runningMinutes: day.runningMinutes, windowState: day.windowState, flex };
  const fail = (error, reason, reasonEn) => ({ ...base, ok: false, error, reason, reasonEn });
  if (!flex) return fail("NOT_FLEX_BREAK", "راحة هذه الوردية ثابتة في الجدول — لا تحتاج بصمة.", "This shift's break is fixed on the roster — no punch needed.");
  if (riyadhClockOf(checkIn) == null) return fail("NOT_CHECKED_IN", "سجّل حضورك أولاً — الراحة داخل الدوام.", "Check in first — the break sits inside the duty.");
  if (checkOut) return fail("DAY_CLOSED", "اليوم مغلق بالانصراف.", "The day is closed by the checkout.");
  if (action === "start") {
    if (day.open) return fail("BREAK_ALREADY_OPEN", `راحتك مفتوحة منذ ${day.open.start} — أنهِها أولاً.`, `Your break has been open since ${day.open.start} — end it first.`);
    if (day.windowState === "before") return fail("BREAK_WINDOW_NOT_OPEN", `تبدأ نافذة الراحة ${flex.from}`, `The break window opens at ${flex.from}`);
    if (day.windowState === "closed") return fail("BREAK_WINDOW_CLOSED", `انتهت نافذة الراحة ${flex.to}`, `The break window closed at ${flex.to}`);
    if (day.punched.length && !flex.splitEffective) return fail("BREAK_ALREADY_TAKEN", "أخذت راحتك اليوم — هذه الوردية لا تقسّم الراحة.", "You have taken today's break — this shift does not split it.");
    if (day.remaining <= 0) {
      const taken = Math.round(Number(day.taken) || 0);
      return taken > flex.minutes
        ? fail("BREAK_DONE", `أخذت ${taken} دقيقة راحة اليوم من ${flex.minutes} — الزيادة ${taken - flex.minutes} دقيقة عودة متأخرة.`, `You took ${taken} minutes of break today out of ${flex.minutes} — the extra ${taken - flex.minutes} is a late return.`)
        : fail("BREAK_DONE", `أخذت راحتك كاملة اليوم (${flex.minutes} دقيقة).`, `You have taken your full break today (${flex.minutes} minutes).`);
    }
    if (day.punched.length && day.remaining < flex.minPart) {
      return fail("BREAK_REMAINDER_SHORT", `الباقي ${day.remaining} دقيقة أقل من ${flex.minPart} — لا يكفي جزءاً نظامياً (${art}).`, `The ${day.remaining} minutes left are under ${flex.minPart} — not a lawful part (${artEn}).`);
    }
    return { ...base, ok: true, part: day.punched.length + 1 };
  }
  if (action === "end") {
    if (!day.open) return fail("NO_OPEN_BREAK", "لا راحة مفتوحة لإنهائها.", "There is no open break to end.");
    const minutes = day.runningMinutes;
    const over = Math.max(0, minutes - day.remaining);
    if (minutes < flex.minPart) {
      const reason = `أقل راحة نظامية ${flex.minPart} دقيقة (${art})`;
      const reasonEn = `The statutory minimum break is ${flex.minPart} minutes (${artEn})`;
      if (flex.earlyEnd) return { ...base, ok: true, short: true, minutes, over, reason, reasonEn, error: "BREAK_BELOW_MIN" };
      return { ...fail("BREAK_BELOW_MIN", reason, reasonEn), minutes, endsAtMin: day.open.startMin + flex.minPart };
    }
    // Ending a part here may leave a remainder too short to be a lawful part — it then counts as work.
    const leftover = Math.max(0, day.remaining - minutes);
    if (flex.splitEffective && leftover > 0 && leftover < flex.minPart) {
      return {
        ...base,
        ok: true,
        short: false,
        minutes,
        over,
        leftover,
        warn: `إن أنهيتها الآن سيبقى ${leftover} دقيقة لا تكفي جزءاً (أقل من ${flex.minPart}) — تُحسب عملاً لا راحة.`,
        warnEn: `Ending now leaves ${leftover} min — under the ${flex.minPart}-minute part, so it counts as work, not rest.`,
      };
    }
    return { ...base, ok: true, short: false, minutes, over };
  }
  return fail("BREAK_ACTION_UNKNOWN", "إجراء راحة غير معروف.", "Unknown break action.");
}

/** A client-placed assumed break the server may store: inside the window, the full minutes (or cut by the checkout inside it), no punches. */
export function checkAssumedBreakGate({ shift, breaks, start, end, onDate, checkOut = null } = {}) {
  const flex = flexBreakOf(shift, onDate);
  const fail = (error, reason, reasonEn) => ({ ok: false, error, reason, reasonEn });
  if (!flex) return fail("NOT_FLEX_BREAK", "راحة هذه الوردية ثابتة.", "This shift's break is fixed.");
  if (readDayBreaks(breaks).some((row) => row.source === "punch")) return fail("BREAK_PUNCHED", "الراحة مثبتة ببصمة — لا تُفترض.", "The break is punched — it is not assumed.");
  const lift = (m) => (m != null && m + 720 < flex.shiftStart ? m + 1440 : m);
  const s = lift(clockOfHm(start));
  let e = lift(clockOfHm(end));
  if (s == null || e == null) return fail("ASSUMED_BREAK_TIME", "وقت الراحة المفترضة غير مقروء.", "The assumed break time is unreadable.");
  if (e < s) e += 1440;
  const outClock = checkOut == null ? null : riyadhClockOf(checkOut);
  let outM = outClock == null ? null : lift(outClock);
  if (outM != null && outM < s) outM += 1440;
  const cutAtCheckout = outM != null && e === outM && e - s > 0 && e - s < flex.minutes;
  if (e - s !== flex.minutes && !cutAtCheckout) return fail("ASSUMED_BREAK_MINUTES", `الراحة المفترضة ${flex.minutes} دقيقة كاملة.`, `An assumed break is the full ${flex.minutes} minutes.`);
  if (s < flex.fromMin || e > flex.toMin) return fail("ASSUMED_BREAK_OUTSIDE", `الراحة المفترضة داخل النافذة ⁦${flex.from}–${flex.to}⁩.`, `An assumed break sits inside the ${flex.from}–${flex.to} window.`);
  return { ok: true, start: hmOfClock(s), end: hmOfClock(e), minutes: e - s };
}

/**
 * Art. 101 — no more than five consecutive hours without a rest of ≥ 30 minutes "each time".
 * One or more breaks: `breaks` (placed or unplaced) or `breakCount` with `restMinutes` split evenly.
 * A missing restMinutes uses the statutory 30 so existing 8 h windows still publish.
 * `continuous103`: the Minister's continuous-work case — rest is organised during work (Art. 103).
 * `maxConsecutiveHours`: a category ceiling (Regs Art. 23(5) cleaners: 6). `exempt101`: Art. 108 category.
 */
export function checkConsecutiveWorkGate(input = {}) {
  const onDate = input.onDate;
  const maxHours = Number(input.maxConsecutiveHours) > 0 ? Number(input.maxConsecutiveHours) : ruleValue("hours.rest.maxConsecutiveHours", onDate);
  const minRest = ruleValue("hours.rest.duringShiftMinutes", onDate);
  const cite = citeRule("hours.rest.maxConsecutiveHours", onDate);
  const span = minutesBetween(input.start || "00:00", input.end || "00:00");
  const maxMin = maxHours * 60;
  if (input.exempt101 === true) {
    return { ok: true, via: "art108", cite: citeRule("hours.art108.cite", onDate), span, maxHours, minRest, restMinutes: 0, maxBlock: span };
  }
  if (input.continuous103 === true) {
    return { ok: true, via: "art103", cite: citeRule("hours.art103.cite", onDate), span, maxHours, minRest, restMinutes: 0, maxBlock: span };
  }
  // «راحة مرنة ببصمة»: the window decides, not a placed or centred break.
  if (input.breakMode === "flex") {
    return checkFlexBreakGate({ shift: { start: input.start, end: input.end, breakMode: "flex", flexBreak: input.flexBreak }, onDate, maxConsecutiveHours: input.maxConsecutiveHours });
  }
  if (span <= 0 || span <= maxMin) {
    return { ok: true, cite, span, maxHours, minRest, restMinutes: 0, maxBlock: Math.max(0, span) };
  }
  const placed = shiftBreaks({ start: input.start, breaks: input.breaks });
  if (placed.length) {
    const rest = placed.reduce((sum, row) => sum + row.minutes, 0);
    const qualifying = placed.filter((row) => row.minutes >= minRest);
    let maxBlock;
    if (!qualifying.length) {
      maxBlock = span - rest;
    } else if (qualifying.every((row) => row.from != null)) {
      let cursor = 0;
      maxBlock = 0;
      for (const row of qualifying) {
        maxBlock = Math.max(maxBlock, row.from - cursor);
        cursor = row.to;
      }
      maxBlock = Math.max(maxBlock, span - cursor);
    } else {
      maxBlock = Math.ceil(Math.max(0, span - rest) / (qualifying.length + 1));
    }
    if (!qualifying.length || maxBlock > maxMin) {
      return {
        ok: false,
        error: qualifying.length ? "REST_5H_BLOCK_TOO_LONG" : "REST_5H_REQUIRED",
        reason: qualifying.length
          ? `مع ${qualifying.length} راحة يبقى أطول مقطع ${Math.round((maxBlock / 60) * 10) / 10} ساعة فوق حد ${maxHours} ساعات — ${cite?.labelAr || "المادة 101"}.`
          : `لا راحة لا تقل عن ${minRest} دقيقة في المرة الواحدة — لا يجوز العمل أكثر من ${maxHours} ساعات متواصلة (${cite?.labelAr || "المادة 101"}).`,
        reasonEn: qualifying.length
          ? `With ${qualifying.length} rest(s) the longest block is ${Math.round((maxBlock / 60) * 10) / 10} h above the ${maxHours} h cap — Labour Law ${cite?.labelEn || "Art. 101"}.`
          : `No rest of at least ${minRest} minutes at a time — no more than ${maxHours} consecutive hours (Labour Law ${cite?.labelEn || "Art. 101"}).`,
        cite,
        span,
        maxHours,
        minRest,
        restMinutes: rest,
        maxBlock,
        breaks: qualifying.length,
      };
    }
    return { ok: true, cite, span, maxHours, minRest, restMinutes: rest, maxBlock, breaks: qualifying.length };
  }
  const rest = input.restMinutes == null ? minRest : Math.max(0, Number(input.restMinutes) || 0);
  const count = Math.max(1, Math.floor(Number(input.breakCount) || 1));
  if (rest < minRest) {
    return {
      ok: false,
      error: "REST_5H_REQUIRED",
      reason: `لا يجوز تشغيل العامل أكثر من ${maxHours} ساعات متواصلة دون راحة لا تقل عن ${minRest} دقيقة — ${cite?.labelAr || "المادة 101"}.`,
      reasonEn: `A worker may not work more than ${maxHours} consecutive hours without a rest of at least ${minRest} minutes — Labour Law ${cite?.labelEn || "Art. 101"}.`,
      cite,
      span,
      maxHours,
      minRest,
      restMinutes: rest,
      maxBlock: span,
    };
  }
  // Each rest must be ≥ minRest "in one go" — a total too small to split stays fewer breaks.
  const breaks = Math.max(1, Math.min(count, Math.floor(rest / minRest)));
  const work = Math.max(0, span - rest);
  const maxBlock = Math.ceil(work / (breaks + 1));
  if (maxBlock > maxMin) {
    return {
      ok: false,
      error: "REST_5H_BLOCK_TOO_LONG",
      reason: `حتى مع راحة ${rest} دقيقة يبقى أطول مقطع ${Math.round((maxBlock / 60) * 10) / 10} ساعة فوق حد ${maxHours} ساعات — ${cite?.labelAr || "المادة 101"}.`,
      reasonEn: `Even with a ${rest}-minute rest the longest block is ${Math.round((maxBlock / 60) * 10) / 10} h above the ${maxHours} h cap — Labour Law ${cite?.labelEn || "Art. 101"}.`,
      cite,
      span,
      maxHours,
      minRest,
      restMinutes: rest,
      maxBlock,
      breaks,
    };
  }
  return { ok: true, cite, span, maxHours, minRest, restMinutes: rest, maxBlock, breaks };
}

function workplaceMinutesOnDay(spans, day) {
  const dayStart = (day - 1) * 1440;
  const dayEnd = dayStart + 1440;
  let first = null;
  let last = null;
  for (const sp of spans) {
    const a = Math.max(sp.start, dayStart);
    const b = Math.min(sp.end, dayEnd);
    if (b <= a) continue;
    if (first == null || a < first) first = a;
    if (last == null || b > last) last = b;
  }
  if (first == null) return 0;
  return last - first;
}

export function dateKey(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function weekIndex(year, monthIndex, day) {
  return Math.floor((day - 1 + new Date(year, monthIndex, 1).getDay()) / 7);
}

function weekLength(year, monthIndex, w) {
  const days = daysInMonth(year, monthIndex);
  let n = 0;
  for (let d = 1; d <= days; d++) if (weekIndex(year, monthIndex, d) === w) n++;
  return n;
}

function cellOf(assignments, year, monthIndex, day, shiftId) {
  const key = dateKey(year, monthIndex, day);
  return Array.isArray(assignments?.[key]?.[shiftId]) ? assignments[key][shiftId] : [];
}

function spansOf(employeeId, shiftTypes, assignments, year, monthIndex) {
  const out = [];
  const days = daysInMonth(year, monthIndex);
  for (let d = 1; d <= days; d++) {
    for (const st of shiftTypes) {
      if (!cellOf(assignments, year, monthIndex, d, st.id).includes(employeeId)) continue;
      const a = String(st.start).split(":").map(Number);
      const b = String(st.end).split(":").map(Number);
      const start = (d - 1) * 1440 + a[0] * 60 + a[1];
      let end = (d - 1) * 1440 + b[0] * 60 + b[1];
      if (end <= start) end += 1440;
      out.push({ d, label: st.label || st.id, start, end });
    }
  }
  return out.sort((x, y) => x.start - y.start);
}

function shiftAssignedOnHeatBanDay(assignments, year, monthIndex, days, shiftId) {
  let anyAssigned = false;
  for (let d = 1; d <= days; d++) {
    const ids = cellOf(assignments, year, monthIndex, d, shiftId);
    if (!ids.length) continue;
    anyAssigned = true;
    if (isHeatBanDate(dateKey(year, monthIndex, d))) return { anyAssigned: true, onHeatDay: true };
  }
  return { anyAssigned, onHeatDay: false };
}

function shiftHeatSeasonApplies(assignments, year, monthIndex, days, shiftId) {
  const { anyAssigned, onHeatDay } = shiftAssignedOnHeatBanDay(assignments, year, monthIndex, days, shiftId);
  if (anyAssigned) return onHeatDay;
  return monthHasHeatBanDay(year, monthIndex);
}

function employeeForGate(id, employees = []) {
  return employees.find((row) => String(row?.id) === String(id) || String(row?.employeeId) === String(id)) || { id };
}

export function checkPublishGates({
  year,
  monthIndex,
  shiftTypes = [],
  assignments = {},
  onLeaveIds = [],
  restDow = 5,
  namesById = {},
  employees = [],
  // Full schedule (sunExposure marks, night flags) — enables the 18632 / juvenile / 3337 per-person blocks, as on the server.
  schedule = null,
  station = null,
  settings = null,
  company = null,
  laborCalendar = null,
  today = undefined,
}) {
  const onLeave = new Set([...onLeaveIds].map(String));
  const days = daysInMonth(year, monthIndex);

  let filled = 0;
  let staffable = 0;
  for (let d = 1; d <= days; d++) {
    const restDay = new Date(year, monthIndex, d).getDay() === restDow;
    for (const st of shiftTypes) {
      const ids = cellOf(assignments, year, monthIndex, d, st.id).filter((id) => !onLeave.has(id));
      if (restDay) continue;
      staffable++;
      if (ids.length) filled++;
    }
  }
  const openCells = Math.max(0, staffable - filled);
  const coveragePct = staffable ? Math.round((filled / staffable) * 100) : 0;

  const wMin = {};
  const wRamadanMin = {};
  const wDays = {};
  const assignedIds = new Set();

  for (let d = 1; d <= days; d++) {
    const w = weekIndex(year, monthIndex, d);
    const ramadanDay = isRamadanDay(dateKey(year, monthIndex, d));
    for (const st of shiftTypes) {
      for (const id of cellOf(assignments, year, monthIndex, d, st.id)) {
        if (onLeave.has(id)) continue;
        assignedIds.add(id);
        const mins = minutesBetween(st.start, st.end);
        wMin[id] = wMin[id] || {};
        wDays[id] = wDays[id] || {};
        wMin[id][w] = (wMin[id][w] || 0) + mins;
        (wDays[id][w] = wDays[id][w] || new Set()).add(d);
        if (ramadanDay) {
          wRamadanMin[id] = wRamadanMin[id] || {};
          wRamadanMin[id][w] = (wRamadanMin[id][w] || 0) + mins;
        }
      }
    }
  }

  const onDate = dateKey(year, monthIndex, 1);
  const weeklyCap = ruleValue("hours.week.ordinaryMaxHours", onDate);
  const workplaceMax = ruleValue("hours.workplace.maxHours", onDate);
  const ramadanDayCap = ruleValue("hours.ramadan.ordinaryHours", onDate);
  const ramadanWeekCap = ruleValue("hours.ramadan.weekMaxHours", onDate);
  const exceptionDayCap = ruleValue("hours.ot.exceptionDayHours", onDate);
  const exceptionWeekCap = ruleValue("hours.ot.exceptionWeekHours", onDate);
  // Art 98: empty religion is Muslim/protected; recorded non-Muslim is exempt.
  const weekArticle = citeRule("hours.week.ordinaryMaxHours", onDate)?.article;
  const workplaceArticle = citeRule("hours.workplace.maxHours", onDate)?.article;
  const ramadanArticle = citeRule("hours.ramadan.weekMaxHours", onDate)?.article;
  const weeklyRestArticle = citeRule("hours.rest.weeklyHours", onDate)?.article;
  const exceptionArticle = citeRule("hours.ot.exceptionDayHours", onDate)?.article;

  const weeklyMaxHours = Math.round(Math.max(0, ...Object.values(wMin).flatMap((o) => Object.values(o)), 0) / 60);

  let workplaceBreach = null;
  for (const id of assignedIds) {
    const sp = spansOf(id, shiftTypes, assignments, year, monthIndex);
    for (let d = 1; d <= days; d++) {
      const stay = workplaceMinutesOnDay(sp, d);
      if (stay > workplaceMax * 60) {
        workplaceBreach = {
          name: namesById[id] || id,
          hours: Math.round((stay / 60) * 10) / 10,
          d,
        };
        break;
      }
    }
    if (workplaceBreach) break;
  }

  let ramadanDayBreach = null;
  let ramadanWeekBreach = null;
  let ramadanDaysInMonth = 0;
  for (let d = 1; d <= days; d++) {
    if (isRamadanDay(dateKey(year, monthIndex, d))) ramadanDaysInMonth++;
  }
  for (const id of assignedIds) {
    if (!isRamadanHoursSubject(employeeForGate(id, employees))) continue;
    for (let d = 1; d <= days; d++) {
      const key = dateKey(year, monthIndex, d);
      if (!isRamadanDay(key)) continue;
      for (const st of shiftTypes) {
        if (!cellOf(assignments, year, monthIndex, d, st.id).includes(id)) continue;
        const mins = minutesBetween(st.start, st.end);
        if (mins > ramadanDayCap * 60) {
          ramadanDayBreach = { name: namesById[id] || id, hours: Math.round((mins / 60) * 10) / 10, d };
          break;
        }
      }
      if (ramadanDayBreach) break;
    }
    const ramadanWeeks = wRamadanMin[id] || {};
    for (const mins of Object.values(ramadanWeeks)) {
      if (mins / 60 > ramadanWeekCap) {
        ramadanWeekBreach = { name: namesById[id] || id, hours: Math.round(mins / 60) };
        break;
      }
    }
    if (ramadanDayBreach && ramadanWeekBreach) break;
  }

  let exceptionDayBreach = null;
  let exceptionWeekBreach = null;
  for (const id of assignedIds) {
    for (let d = 1; d <= days; d++) {
      let mins = 0;
      for (const st of shiftTypes) {
        if (!cellOf(assignments, year, monthIndex, d, st.id).includes(id)) continue;
        mins += minutesBetween(st.start, st.end);
      }
      if (mins > exceptionDayCap * 60) {
        exceptionDayBreach = { name: namesById[id] || id, hours: Math.round((mins / 60) * 10) / 10, d };
        break;
      }
    }
    for (const [, mins] of Object.entries(wMin[id] || {})) {
      if (mins / 60 > exceptionWeekCap) {
        exceptionWeekBreach = { name: namesById[id] || id, hours: Math.round(mins / 60) };
        break;
      }
    }
    if (exceptionDayBreach && exceptionWeekBreach) break;
  }

  let doubleOk = true;
  for (let i = 0; i < shiftTypes.length; i++) {
    for (let j = i + 1; j < shiftTypes.length; j++) {
      for (let d = 1; d <= days; d++) {
        const A = cellOf(assignments, year, monthIndex, d, shiftTypes[i].id);
        const B = cellOf(assignments, year, monthIndex, d, shiftTypes[j].id);
        if (A.some((x) => B.includes(x) && !onLeave.has(x))) {
          doubleOk = false;
          break;
        }
      }
      if (!doubleOk) break;
    }
    if (!doubleOk) break;
  }

  const noRest = Object.entries(wDays).filter(([, o]) =>
    Object.entries(o).some(([w, set]) => weekLength(year, monthIndex, Number(w)) === 7 && set.size >= 7),
  );
  const restBreachName = noRest.length ? namesById[noRest[0][0]] || noRest[0][0] : "";
  const restOk = !restBreachName;

  const leaveOnMatrix = [];
  for (let d = 1; d <= days; d++) {
    for (const st of shiftTypes) {
      for (const id of cellOf(assignments, year, monthIndex, d, st.id)) {
        if (onLeave.has(id) && !leaveOnMatrix.includes(id)) leaveOnMatrix.push(id);
      }
    }
  }

  const consecArticle = citeRule("hours.rest.maxConsecutiveHours", onDate)?.article;
  const policy = { ...(company?.hoursPolicy || {}), ...(company?.attendanceSettings?.hoursPolicy || {}) };
  const continuous103 = policy.continuousWork103 === true || String(policy.continuousWork103) === "true";
  const consecFails = shiftTypes
    .map((st) => ({ st, gate: checkConsecutiveWorkGate({ start: st.start, end: st.end, restMinutes: st.restMinutes, breaks: st.breaks, breakCount: st.breakCount, breakMode: st.breakMode, flexBreak: st.flexBreak, continuous103, onDate }) }))
    .filter((row) => !row.gate.ok);
  const consecFail = consecFails[0] || null;
  const heatFails = shiftTypes
    .map((st) => ({
      st,
      gate: checkHeatBanGate({
        start: st.start,
        end: st.end,
        outdoor: st.outdoor,
        summer: shiftHeatSeasonApplies(assignments, year, monthIndex, days, st.id),
      }),
    }))
    .filter((row) => !row.gate.ok);
  const heatFail = heatFails[0] || null;
  // The hours and the season are the rule rows', so the roster check cannot outlive them.
  const heatWin = heatBanWindow(onDate);
  const nightCount = shiftTypes.filter((st) => shiftOverlapsNight(st.start, st.end)).length;
  const nightWin = `${String(ruleValue("hours.night.startHour", onDate)).padStart(2, "0")}:00–${String(ruleValue("hours.night.endHour", onDate)).padStart(2, "0")}:00`;
  const nightWorkerHours = ruleValue("hours.night.workerHours", onDate);
  const weeklyRestHours = ruleValue("hours.rest.weeklyHours", onDate);

  const checks = [
    {
      id: "hours_48",
      ok: weeklyMaxHours <= weeklyCap,
      article: weekArticle,
      labelAr: `أعلى حمل أسبوعي ${weeklyMaxHours} ساعة من حد ${weeklyCap}`,
      labelEn: `Heaviest weekly load ${weeklyMaxHours} h against the ${weeklyCap} h cap`,
    },
    {
      id: "hours_106",
      ok: !exceptionDayBreach && !exceptionWeekBreach,
      article: exceptionArticle,
      labelAr: exceptionDayBreach
        ? `${exceptionDayBreach.name}: ${exceptionDayBreach.hours} ساعة فعلية في اليوم ${exceptionDayBreach.d} فوق حد ${exceptionDayCap}`
        : exceptionWeekBreach
          ? `${exceptionWeekBreach.name}: ${exceptionWeekBreach.hours} ساعة في الأسبوع فوق حد ${exceptionWeekCap}`
          : `حتى في الاستثناء: لا أكثر من ${exceptionDayCap} ساعات في اليوم أو ${exceptionWeekCap} في الأسبوع`,
      labelEn: exceptionDayBreach
        ? `${exceptionDayBreach.name}: ${exceptionDayBreach.hours} actual hours on day ${exceptionDayBreach.d} above the ${exceptionDayCap} h cap`
        : exceptionWeekBreach
          ? `${exceptionWeekBreach.name}: ${exceptionWeekBreach.hours} h in a week above the ${exceptionWeekCap} h cap`
          : `Even in exception cases: no more than ${exceptionDayCap} h a day or ${exceptionWeekCap} h a week`,
    },
    {
      id: "hours_ramadan",
      ok: !ramadanDayBreach && !ramadanWeekBreach,
      article: ramadanDaysInMonth ? ramadanArticle : undefined,
      labelAr: !ramadanDaysInMonth
        ? "لا أيام رمضان في هذا الشهر"
        : ramadanDayBreach
          ? `${ramadanDayBreach.name}: ${ramadanDayBreach.hours} ساعة في يوم رمضاني فوق حد ${ramadanDayCap}`
          : ramadanWeekBreach
            ? `${ramadanWeekBreach.name}: ${ramadanWeekBreach.hours} ساعة في أسبوع رمضاني فوق حد ${ramadanWeekCap}`
            : `رمضان: حد ${ramadanDayCap} ساعات يومياً أو ${ramadanWeekCap} أسبوعياً للمسلمين — غير المسلم المسجّل على الملف مستثنى`,
      labelEn: !ramadanDaysInMonth
        ? "No Ramadan days this month"
        : ramadanDayBreach
          ? `${ramadanDayBreach.name}: ${ramadanDayBreach.hours} h on a Ramadan day above the ${ramadanDayCap} h cap`
          : ramadanWeekBreach
            ? `${ramadanWeekBreach.name}: ${ramadanWeekBreach.hours} h in a Ramadan week above the ${ramadanWeekCap} h cap`
            : `Ramadan: ${ramadanDayCap} h a day or ${ramadanWeekCap} h a week for Muslims — a file marked non-Muslim is exempt`,
    },
    {
      id: "workplace_hours",
      ok: !workplaceBreach,
      article: workplaceArticle,
      labelAr: workplaceBreach
        ? `${workplaceBreach.name}: بقاء ${workplaceBreach.hours} ساعة في موقع العمل يوم ${workplaceBreach.d} فوق حد ${workplaceMax}`
        : `لا بقاء في موقع العمل أكثر من ${workplaceMax} ساعة في اليوم`,
      labelEn: workplaceBreach
        ? `${workplaceBreach.name}: ${workplaceBreach.hours} h at the workplace on day ${workplaceBreach.d} above the ${workplaceMax} h cap`
        : `No more than ${workplaceMax} h remaining at the workplace in a day`,
    },
    {
      id: "double_shift",
      ok: doubleOk,
      article: null,
      labelAr: doubleOk ? "لا إسناد لورديتين في يوم واحد" : "موظف مسند إلى ورديتين في يوم واحد",
      labelEn: doubleOk ? "Nobody is assigned two shifts in one day" : "Someone is assigned two shifts in one day",
    },
    {
      id: "rest_5h",
      ok: !consecFail,
      article: consecArticle,
      labelAr: consecFail
        ? `${consecFail.st.label || consecFail.st.id}: ${consecFail.gate.reason}`
        : `لا عمل أكثر من ${ruleValue("hours.rest.maxConsecutiveHours", onDate)} ساعات متواصلة دون راحة ${ruleValue("hours.rest.duringShiftMinutes", onDate)} دقيقة`,
      labelEn: consecFail
        ? `${consecFail.st.label || consecFail.st.id}: ${consecFail.gate.reasonEn}`
        : `No more than ${ruleValue("hours.rest.maxConsecutiveHours", onDate)} consecutive hours without a ${ruleValue("hours.rest.duringShiftMinutes", onDate)}-minute rest`,
    },
    {
      id: "weekly_rest",
      ok: restOk,
      article: weeklyRestArticle,
      labelAr: restOk ? `راحة أسبوعية ${weeklyRestHours} ساعة متصلة` : `${restBreachName} مجدول أسبوعًا كاملًا بلا يوم راحة`,
      labelEn: restOk ? `${weeklyRestHours} h continuous weekly rest` : `${restBreachName} is scheduled a full week with no rest day`,
    },
    {
      id: "coverage",
      ok: openCells === 0,
      labelAr: openCells === 0 ? "كل ورديات الشهر مُسندة" : `${openCells} خلية في الشهر بلا إسناد`,
      labelEn: openCells === 0 ? "Every shift this month is assigned" : `${openCells} cell${openCells === 1 ? "" : "s"} unassigned this month`,
    },
    {
      id: "leave_excluded",
      ok: true,
      block: false,
      labelAr: leaveOnMatrix.length
        ? `${leaveOnMatrix.map((id) => namesById[id] || id).join("، ")} على إجازة معتمدة — الإجازة تبقى إجازة، والنشر جائز`
        : onLeave.size
          ? `${onLeave.size} على إجازة معتمدة — مستبعدون من الإسناد`
          : "لا إجازات معتمدة في هذا الشهر",
      labelEn: leaveOnMatrix.length
        ? `${leaveOnMatrix.map((id) => namesById[id] || id).join(", ")} on approved leave — leave stays leave, and publish is allowed`
        : onLeave.size
          ? `${onLeave.size} on approved leave — excluded from assignment`
          : "No approved leave this month",
    },
    {
      id: "heat_ban",
      ok: !heatFail,
      labelAr: heatFail
        ? `${heatFail.st.label || heatFail.st.id}: حظر ${heatWin.startLabel}–${heatWin.endLabel} للميدان المكشوف ${heatWin.seasonAr}`
        : "لا تداخل مع حظر الشمس للميدان المكشوف",
      labelEn: heatFail
        ? `${heatFail.st.label || heatFail.st.id}: ${heatWin.startLabel}–${heatWin.endLabel} outdoor ban ${heatWin.seasonEn}`
        : "No overlap with the outdoor heat ban",
    },
    {
      id: "night_class",
      ok: true,
      labelAr: nightCount ? `${nightCount} وردية تدخل ${nightWin} (يؤدي عملاً ليلياً — عامل ليلي إن بلغت ${nightWorkerHours} ساعات)` : "لا وردية تدخل نافذة الليل في هذا الشهر",
      labelEn: nightCount ? `${nightCount} shifts enter ${nightWin} (night work — night worker if ${nightWorkerHours} hours or more)` : "No shift enters the night window this month",
    },
  ];

  if (schedule) {
    // Same per-person blocks as the server checkPublishGates (18632, juveniles 161–166, 3337) — same ids, same rule rows.
    const law = rosterLawChecks({
      year,
      monthIndex,
      schedule: { ...schedule, shiftTypes, assignments },
      employees,
      station,
      settings,
      company,
      laborCalendar,
      today,
    });
    const lawIds = new Set(law.map((row) => row.id));
    for (let i = checks.length - 1; i >= 0; i -= 1) if (lawIds.has(checks[i].id)) checks.splice(i, 1);
    for (const row of law) {
      checks.push({ id: row.id, ok: row.ok, block: row.block, article: row.article, labelAr: row.labelAr, labelEn: row.labelEn, noteAr: row.noteAr, noteEn: row.noteEn });
    }
  }

  const failed = checks.find((c) => !c.ok && c.block !== false) || null;
  return { checks, blocked: !!failed, failed, openCells, weeklyMaxHours, coveragePct };
}

export const STANDARD_SHIFT_WINDOWS = [
  { key: "morning", ar: "صباحي", en: "Morning", start: "07:00", end: "15:00", restMinutes: 30 },
  { key: "evening", ar: "مسائي", en: "Evening", start: "15:00", end: "23:00", restMinutes: 30 },
  { key: "night", ar: "ليلي", en: "Night", start: "23:00", end: "07:00", restMinutes: 30 },
  { key: "twelve", ar: "12 بقاء", en: "12h stay", start: "07:00", end: "19:00", restMinutes: 120 },
];

export function shiftWindowKey(start, end) {
  return `${String(start || "").slice(0, 5)}-${String(end || "").slice(0, 5)}`;
}

/** HH:MM clock for roster cells — follows the header 12/24 preference. */
export function formatShiftHm(hm, format = "24", lang = "ar") {
  const raw = String(hm || "").trim().slice(0, 5);
  if (!/^\d{1,2}:\d{2}$/.test(raw)) return raw;
  const [h, m] = raw.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return raw;
  const date = new Date(2000, 0, 1, h, m);
  const locale = lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
  const twelve = format === "12";
  return date.toLocaleTimeString(locale, {
    hour: twelve ? "numeric" : "2-digit",
    minute: "2-digit",
    hourCycle: twelve ? "h12" : "h23",
  });
}

/** Roster cell / aria — the duty window, not the start alone. Honours header 12/24. */
export function shiftHoursLine(shift, lang = "ar", format = "24") {
  const startRaw = String(shift?.start || "").trim().slice(0, 5);
  const endRaw = String(shift?.end || "").trim().slice(0, 5);
  if (!startRaw && !endRaw) return "";
  const start = startRaw ? formatShiftHm(startRaw, format, lang) : "";
  const end = endRaw ? formatShiftHm(endRaw, format, lang) : "";
  if (start && end) return lang === "ar" ? `من ${start} إلى ${end}` : `${start}–${end}`;
  return start || end;
}

export function nextDistinctShift(shiftTypes = [], ar = true) {
  const used = new Set((shiftTypes || []).map((s) => shiftWindowKey(s.start, s.end)));
  const unused = STANDARD_SHIFT_WINDOWS.find((slot) => !used.has(shiftWindowKey(slot.start, slot.end)));
  if (!unused) return null;
  return {
    label: ar ? unused.ar : unused.en,
    start: unused.start,
    end: unused.end,
    restMinutes: unused.restMinutes ?? 30,
  };
}

/** Restore a cleared start/end from the matching standard window. */
export function repairedShiftWindow(shift) {
  const start = String(shift?.start || "").slice(0, 5);
  const end = String(shift?.end || "").slice(0, 5);
  if (start && end) return null;
  const match = STANDARD_SHIFT_WINDOWS.find((slot) =>
    (start && slot.start === start) || (end && slot.end === end) || (!start && !end && slot.key === "morning"),
  );
  if (!match) return null;
  return { start: match.start, end: match.end };
}

export function duplicateShiftGroups(shiftTypes = []) {
  const map = new Map();
  for (const shift of shiftTypes || []) {
    const key = shiftWindowKey(shift.start, shift.end);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(shift);
  }
  return [...map.values()].filter((group) => group.length > 1);
}

function keepScore(shift) {
  const label = String(shift?.label || "").trim();
  if (/^(صباحي|مسائي|ليلي|Morning|Evening|Night)$/i.test(label)) return 3;
  if (/^(وردية|Shift)\s*\d+$/i.test(label)) return 0;
  return 1;
}

/** Keep one row per time window; extras are merged into the kept id. */
export function planDuplicateShiftMerge(shiftTypes = []) {
  const dropIds = [];
  const keepByDrop = {};
  for (const group of duplicateShiftGroups(shiftTypes)) {
    const sorted = [...group].sort((a, b) => keepScore(b) - keepScore(a));
    const keep = sorted[0];
    for (const extra of sorted.slice(1)) {
      dropIds.push(extra.id);
      keepByDrop[extra.id] = keep.id;
    }
  }
  return { dropIds, keepByDrop };
}
