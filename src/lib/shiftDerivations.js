/** Client mirror of base44/shared/shiftDerivations.ts — keep in sync. */

import { citeRule, isRamadanDay, isRamadanHoursSubject, ruleValue } from "./laborRules.js";
import { checkHeatBanGate, heatBanWindow, isHeatBanDate, monthHasHeatBanDay, shiftOverlapsNight } from "./contractLawDerivations.js";

export function minutesBetween(start, end) {
  const [sh, sm] = String(start || "0:0").split(":").map(Number);
  const [eh, em] = String(end || "0:0").split(":").map(Number);
  let m = (eh * 60 + em) - (sh * 60 + sm);
  if (m < 0) m += 1440;
  return m;
}

export function checkConsecutiveWorkGate(input = {}) {
  const onDate = input.onDate;
  const maxHours = ruleValue("hours.rest.maxConsecutiveHours", onDate);
  const minRest = ruleValue("hours.rest.duringShiftMinutes", onDate);
  const cite = citeRule("hours.rest.maxConsecutiveHours", onDate);
  const span = minutesBetween(input.start || "00:00", input.end || "00:00");
  const maxMin = maxHours * 60;
  if (span <= 0 || span <= maxMin) {
    return { ok: true, cite, span, maxHours, minRest, restMinutes: 0, maxBlock: Math.max(0, span) };
  }
  const rest = input.restMinutes == null ? minRest : Math.max(0, Number(input.restMinutes) || 0);
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
  const work = Math.max(0, span - rest);
  const maxBlock = Math.ceil(work / 2);
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
    };
  }
  return { ok: true, cite, span, maxHours, minRest, restMinutes: rest, maxBlock };
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
  const consecFails = shiftTypes
    .map((st) => ({ st, gate: checkConsecutiveWorkGate({ start: st.start, end: st.end, restMinutes: st.restMinutes, onDate }) }))
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
      labelAr: restOk ? `راحة أسبوعية ${weeklyRestHours} ساعة متصلة` : `${restBreachName} بلا يوم راحة`,
      labelEn: restOk ? `${weeklyRestHours} h continuous weekly rest` : `${restBreachName} has no rest day`,
    },
    {
      id: "coverage",
      ok: openCells === 0,
      labelAr: openCells === 0 ? "كل ورديات الشهر مُسندة" : `${openCells} خلية بلا إسناد`,
      labelEn: openCells === 0 ? "Every shift this month is assigned" : `${openCells} unassigned cells`,
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
