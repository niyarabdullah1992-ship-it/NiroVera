/** Week-first rota: employee × day, ministry publish gates, night (18632) watch. */

import { calendarDateKey, dayAssignmentMap } from "./attendanceCalendar.js";
import { checkHeatBanGate, heatBanWindow, isHeatBanDate, shiftOverlapsHeatBan } from "./contractLawDerivations.js";
import { HEAT_BAN_DECISION, heatBanDecisionLabel } from "./heatBanDecision.js";
import { isoDayKey, riyadhClock } from "./opsDerivations.js";
import {
  checkNightMedicalFitness,
  nightMedicalDutyState,
  checkNightPregnancyBan,
  classifyNightAssignment,
  hasWrittenNightConsent,
  isNightWorker,
  isNightWorkerXorExempt,
  nightConsiderationNote,
  nightFacilityBags,
  nightFacilityGaps,
  nightMinutesInWindow as nightMinutesInDecisionWindow,
  performsNightWork,
} from "./decision18632.js";
import { isRamadanHoursSubject } from "./employeeProfileFields.js";
import { citeLeaveType, citeRule, explainRule, isRamadanDay, laborDayKey, ruleValue } from "./laborRules.js";
import { deriveNamedOvertime, isJuvenile, isWeeklyRestDay } from "./laborHoursPolicy.js";
import { approvedLeaveOnDay, isNursingSubject, isOnApprovedLeave, leaveTypeLabel } from "./leaveTypes.js";
import { isEidHoliday } from "./leaveEidOverlap.js";
import { isOfficialHoliday } from "./ummAlQuraCalendar.js";
import { checkConsecutiveWorkGate, minutesBetween } from "./shiftDerivations.js";
import {
  attachPlatformJudgment,
  judgmentProtects,
  judgmentProtectsCopy,
  PLATFORM_RAIL_EMPTY_AR,
  PLATFORM_RAIL_EMPTY_EN,
} from "./platformJudgment.js";

export {
  classifyNightAssignment,
  isNightWorker,
  performsNightWork,
};

export const SW = {
  ink: "#14213d",
  muted: "#6b7280",
  mid: "#4b5567",
  line: "#dfe3ea",
  soft: "#eef0f4",
  wash: "#fafbfc",
  hair: "#f2f4f7",
  row: "#f7f8fa",
  card: "#fff",
  green: "#137a49",
  greenDot: "#1d9a5b",
  greenBg: "#f2faf6",
  greenBd: "#bfe6d2",
  gold: "#8a6516",
  goldDot: "#c9962b",
  goldBg: "#fdf6e8",
  goldBd: "#ecd9a8",
  abs: "#8a1c2b",
  absBg: "#fbf1f2",
  absBd: "#e9c4c9",
};

export const SHIFT_PALETTE = [
  { color: "#1d9a5b", bg: "#f2faf6", fg: "#0f5c37" },
  { color: "#c9962b", bg: "#fdf6e8", fg: "#6b4f10" },
  { color: "#4b5567", bg: "#f1f2f5", fg: "#2b3242" },
  { color: "#8a1c2b", bg: "#fbf1f2", fg: "#5d1620" },
  { color: "#2f6fa8", bg: "#eef5fb", fg: "#1c4468" },
];

export const REST_STYLE = { color: "#c7ccd6", bg: "#fff", fg: "#6b7280" };
/** Unified leave paint — dark brown, never green (green stays for ملفي decision glow). */
export const LEAVE_STYLE = { color: "#4a2c14", bg: "#efe0cc", fg: "#3d2410" };
/** Article chip sitting on a leave mark — light brown, not mint and not navy. */
export const LEAVE_CITE_STYLE = { color: "#6b4423", bg: "#f3e6d4", fg: "#6b4423" };

const WD_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export function parseDateKey(key) {
  const parts = String(key || "").slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !n && n !== 0)) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function weekStartDate(date = new Date()) {
  const day = date instanceof Date ? date : parseDateKey(date) || new Date();
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - day.getDay());
}

export function weekKeyFromDate(date = new Date()) {
  return calendarDateKey(weekStartDate(date));
}

export function weekDateKeys(weekStart) {
  const start = weekStart instanceof Date ? weekStartDate(weekStart) : weekStartDate(parseDateKey(weekStart) || new Date());
  return Array.from({ length: 7 }, (_, index) => calendarDateKey(addDays(start, index)));
}

export function weekDays(weekStart) {
  const start = weekStart instanceof Date ? weekStartDate(weekStart) : weekStartDate(parseDateKey(weekStart) || new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return {
      date,
      key: calendarDateKey(date),
      wd: date.getDay(),
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      weekend: date.getDay() === 5 || date.getDay() === 6,
    };
  });
}

export function weekdayLabel(wd, ar = true) {
  return (ar ? WD_AR : WD_EN)[wd] || "";
}

export function formatWeekLabel(weekStart, ar = true) {
  const days = weekDays(weekStart);
  const a = days[0];
  const b = days[6];
  if (ar) {
    if (a.month === b.month) return `${a.day} → ${b.day} ${MONTHS_AR[b.month]} ${b.year}`;
    return `${a.day} ${MONTHS_AR[a.month]} → ${b.day} ${MONTHS_AR[b.month]} ${b.year}`;
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (a.month === b.month) return `${a.day} → ${b.day} ${months[b.month]} ${b.year}`;
  return `${a.day} ${months[a.month]} → ${b.day} ${months[b.month]} ${b.year}`;
}

export function weekRelativeLabel(weekStart, today = new Date(), ar = true) {
  const cur = weekStartDate(weekStart);
  const now = weekStartDate(today);
  const diff = Math.round((cur.getTime() - now.getTime()) / (7 * 86400000));
  if (diff === 0) return ar ? "الأسبوع الجاري" : "This week";
  if (diff === 1) return ar ? "الأسبوع القادم" : "Next week";
  if (diff === -1) return ar ? "الأسبوع الماضي" : "Last week";
  const n = Math.abs(diff);
  if (ar) {
    const unit = n === 2 ? "أسبوعين" : n <= 10 ? `${n} أسابيع` : `${n} أسبوعاً`;
    return diff > 0 ? `بعد ${unit}` : `قبل ${unit}`;
  }
  return diff > 0 ? `in ${n} weeks` : `${n} weeks ago`;
}

export function shiftHours(shift) {
  if (!shift?.start || !shift?.end) return 0;
  return Math.round((minutesBetween(shift.start, shift.end) / 60) * 10) / 10;
}

/** Art. 102: rest / prayer / meal in Art. 101 is not actual working time. Art. 154 nursing hour is actual work. */
export function actualShiftHours(shift, onDate, employee) {
  const span = shiftHours(shift);
  if (!span) return 0;
  const consecMax = ruleValue("hours.rest.maxConsecutiveHours", onDate);
  const minRestMin = ruleValue("hours.rest.duringShiftMinutes", onDate);
  const restMin = shift.restMinutes == null
    ? (span > consecMax ? minRestMin : 0)
    : Math.max(0, Number(shift.restMinutes) || 0);
  const deducted = isNursingSubject(employee, onDate) ? Math.min(restMin, minRestMin) : restMin;
  return Math.max(0, Math.round((span - deducted / 60) * 10) / 10);
}

/**
 * Art. 101 stay vs Art. 106 actual vs Art. 101 consecutive rest.
 * A 12-hour window is workplace stay, not twelve hours of actual work.
 */
export function checkWorkplaceStayDutyGate({ shift, onDate, employee } = {}) {
  if (!shift?.start || !shift?.end) {
    return { ok: false, error: "SHIFT_REQUIRED", reason: "حدد بداية الوردية ونهايتها.", reasonEn: "Set the shift start and end." };
  }
  const span = shiftHours(shift);
  const actual = actualShiftHours(shift, onDate, employee);
  const workplaceMax = ruleValue("hours.workplace.maxHours", onDate);
  const exceptionDay = ruleValue("hours.ot.exceptionDayHours", onDate);
  const consec = checkConsecutiveWorkGate({
    start: shift.start,
    end: shift.end,
    restMinutes: shift.restMinutes,
    onDate,
  });
  if (span > workplaceMax) {
    return {
      ok: false,
      error: "WORKPLACE_STAY",
      reason: `البقاء ${span} ساعة يتجاوز المادة 101 (${workplaceMax} ساعة في موقع العمل).`,
      reasonEn: `A ${span}h stay exceeds Article 101 (${workplaceMax}h at the workplace).`,
      span,
      actual,
      workplaceMax,
      exceptionDay,
    };
  }
  if (!consec.ok) {
    return {
      ok: false,
      error: consec.error || "REST_5H_REQUIRED",
      reason: consec.reason,
      reasonEn: consec.reasonEn,
      span,
      actual,
      workplaceMax,
      exceptionDay,
    };
  }
  if (actual > exceptionDay) {
    return {
      ok: false,
      error: "ART_106_DAY",
      reason: `الساعات الفعلية ${actual} تتجاوز المادة 106 (${exceptionDay} ساعات حتى في الاستثناء). اجعل الراحة داخل الوردية كافية.`,
      reasonEn: `Actual hours ${actual} exceed Article 106 (${exceptionDay}h even in exceptions). Put enough rest inside the stay.`,
      span,
      actual,
      workplaceMax,
      exceptionDay,
    };
  }
  return {
    ok: true,
    span,
    actual,
    restHours: Math.round((span - actual) * 10) / 10,
    workplaceMax,
    exceptionDay,
  };
}

/**
 * Four duty days × 12h stay + four rest days.
 * Allowed as an 8-day cycle painted on the 7-day week when stay / actual / rest hold.
 */
export function checkFourOnFourDutyPattern({ shift, onDate, employee } = {}) {
  const workDays = 4;
  const restDays = 4;
  const stay = checkWorkplaceStayDutyGate({ shift, onDate, employee });
  if (!stay.ok) {
    return { ...stay, workDays, restDays, cycleDays: workDays + restDays };
  }
  const weeklyOrdinary = ruleValue("hours.week.ordinaryMaxHours", onDate) || 48;
  const weeklyActual = Math.round(workDays * stay.actual * 10) / 10;
  return {
    ok: true,
    workDays,
    restDays,
    cycleDays: 8,
    span: stay.span,
    actual: stay.actual,
    restHours: stay.restHours,
    weeklyActual,
    weeklyOrdinary,
    paintsOnSevenDayWeek: true,
    reason: `أربعة أيام دوام و12 ساعة بقاء وأربعة راحة جائزة: البقاء ${stay.span} ضمن المادة 101، الفعلية ${stay.actual} ضمن المادة 106، وأربعة راحة تغطي المادة 104. الدورة ثمانية أيام تُرسم على أسبوع السبعة.`,
    reasonEn: `Four 12h-stay duty days and four rest days are allowed: stay ${stay.span}h within Art. 101, actual ${stay.actual}h within Art. 106, and four rest days cover Art. 104. The cycle is eight days painted on a seven-day week.`,
    ramadanKeepsTwelveStay: true,
  };
}

/** Workplace-stay ceiling (Art. 101) — the 4×12 + 4 rest system. */
export function isTwelveStayDuty(shift, onDate) {
  const span = shiftHours(shift);
  const max = ruleValue("hours.workplace.maxHours", onDate);
  return span > 0 && span === max;
}

/**
 * Art. 98 has two criteria.
 * Five days × 8 hours uses the daily cap — Muslims drop to 6 in Ramadan.
 * Four days × 12h stay + four rest uses the weekly criterion — the 12h stay remains.
 */
export function ramadanUsesDailySixCap(shift, onDate, employee) {
  if (isJuvenile(employee, onDate)) return true;
  return !isTwelveStayDuty(shift, onDate);
}

/** This week's duties are only 12h-stay days, and at most four — the compressed system. */
export function employeeOnCompressedTwelveWeek(schedule, employee, weekStart) {
  if (!employee?.id) return false;
  let twelve = 0;
  let other = 0;
  for (const key of weekDateKeys(weekStart)) {
    if (isOnApprovedLeave(employee, key)) continue;
    const shift = employeeShiftOnDay(schedule, employee.id, key);
    if (!shift) continue;
    if (isTwelveStayDuty(shift, key)) twelve += 1;
    else other += 1;
  }
  return twelve > 0 && other === 0 && twelve <= 4;
}

export function nightMinutesInWindow(start, end, onDate) {
  return nightMinutesInDecisionWindow(start, end, onDate);
}

/** عامل ليلي فقط: ≥3 ساعات في 23:00–06:00. ليس «بعد منتصف الليل». */
export function isNightShift(shift, onDate) {
  return isNightWorker(shift, onDate);
}

export function isMorningShift(shift) {
  if (!shift?.start) return false;
  if (/ليل|night/i.test(shift.label || "")) return false;
  if (/صباح|morning/i.test(shift.label || "")) return true;
  const hour = Number(String(shift.start).split(":")[0]);
  return hour >= 5 && hour < 12 && !isNightShift(shift);
}

export function isEveningShift(shift) {
  if (!shift?.start) return false;
  if (/ليل|night/i.test(shift.label || "")) return false;
  if (/مساء|evening/i.test(shift.label || "")) return true;
  const hour = Number(String(shift.start).split(":")[0]);
  return hour >= 12 && hour < 23 && !isNightShift(shift);
}

export function shiftTypeStyle(shift, index = 0) {
  if (!shift) return REST_STYLE;
  const label = String(shift.label || "");
  if (isNightShift(shift) || /ليل|night/i.test(label)) return SHIFT_PALETTE[2];
  if (/مساء|evening/i.test(label)) return SHIFT_PALETTE[1];
  if (/صباح|morning/i.test(label)) return SHIFT_PALETTE[0];
  return SHIFT_PALETTE[index % SHIFT_PALETTE.length];
}

/** History mark — same words as the week grid: ليلي / صباحي / مسائي. */
export function shiftCompactMark(shift, { ar = true, onDate } = {}) {
  if (!shift) return "·";
  const label = String(shift.label || "").trim();
  if (label) return label;
  if (isNightShift(shift, onDate) || /ليل|night/i.test(String(shift.id || ""))) return ar ? "ليلي" : "Night";
  if (/مساء|evening/i.test(String(shift.id || ""))) return ar ? "مسائي" : "Evening";
  if (isMorningShift(shift) || /صباح|morning/i.test(String(shift.id || ""))) return ar ? "صباحي" : "Morning";
  const start = String(shift.start || "").slice(0, 5);
  return start || (ar ? "وردية" : "Shift");
}

/** History heatmap mark — same letters as the HTML roster strip. */
export function shiftHistMark(shift, { ar = true, leave = false } = {}) {
  if (leave) return ar ? "إ" : "L";
  if (!shift) return "·";
  const label = String(shift.label || "");
  if (isNightShift(shift) || /ليل|night/i.test(label)) return ar ? "ل" : "N";
  if (/مساء|evening/i.test(label)) return ar ? "م" : "E";
  if (isMorningShift(shift) || /صباح|morning/i.test(label)) return ar ? "ص" : "M";
  return (label || (ar ? "و" : "S")).slice(0, 1);
}

export function restGapHours(fromShift, toShift) {
  if (!fromShift?.end || !toShift?.start) return 24;
  const [ah, am] = String(fromShift.end).split(":").map(Number);
  const [bh, bm] = String(fromShift.start || "0:0").split(":").map(Number);
  const [ch, cm] = String(toShift.start).split(":").map(Number);
  let end = ah * 60 + (am || 0);
  const fromStart = bh * 60 + (bm || 0);
  if (end <= fromStart) end += 1440;
  const next = ch * 60 + (cm || 0) + 1440;
  return Math.round(((next - end) / 60) * 10) / 10;
}

function neighborDateKey(dateKey, delta) {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  return calendarDateKey(addDays(date, delta));
}

/** Decision 18632 — 12-hour rest between work days when either day performs night work. */
export function checkNightRestApplyGate({ schedule, employee, dateKey, shift } = {}) {
  if (!employee?.id || !dateKey || !shift) return { ok: true };
  const need = ruleValue("hours.night.restHours", dateKey) || 12;
  const prevKey = neighborDateKey(dateKey, -1);
  const nextKey = neighborDateKey(dateKey, 1);
  const prev = prevKey ? employeeShiftOnDay(schedule, employee.id, prevKey) : null;
  const following = nextKey ? employeeShiftOnDay(schedule, employee.id, nextKey) : null;
  const win = nightWindowLabel(dateKey);
  const fail = (left, right, leftKey, rightKey) => {
    if (!left || !right) return null;
    if (!(performsNightWork(left, leftKey) || performsNightWork(right, rightKey))) return null;
    if (restGapHours(left, right) >= need) return null;
    return {
      ok: false,
      error: "NIGHT_REST_REQUIRED",
      ruleId: "hours.night.restHours",
      decisionId: "18632",
      reason: `القرار 18632: راحة لا تقل عن ${need} ساعات بين يومي عمل إذا دخل أحدهما ${win}.`,
      reasonEn: `Decision 18632: at least ${need} hours rest between two work days if either day enters ${win}.`,
    };
  };
  return fail(prev, shift, prevKey, dateKey) || fail(shift, following, dateKey, nextKey) || { ok: true };
}

/** Displayed week plus the civil day before and after — a 4-day duty block can cross Sunday. */
export function adjacentDutySpanKeys(weekStart) {
  const start = weekStartDate(weekStart);
  return [calendarDateKey(addDays(start, -1)), ...weekDateKeys(start), calendarDateKey(addDays(start, 7))];
}

/** Consecutive calendar days that both have a duty — rest days are not a pair. */
export function adjacentDutyPairs(schedule, employee, weekStart) {
  if (!employee?.id) return [];
  const span = adjacentDutySpanKeys(weekStart);
  const pairs = [];
  for (let index = 0; index < span.length - 1; index += 1) {
    const fromKey = span[index];
    const toKey = span[index + 1];
    if (isOnApprovedLeave(employee, fromKey) || isOnApprovedLeave(employee, toKey)) continue;
    const from = employeeShiftOnDay(schedule, employee.id, fromKey);
    const to = employeeShiftOnDay(schedule, employee.id, toKey);
    if (!from || !to) continue;
    pairs.push({ fromKey, toKey, from, to, gap: restGapHours(from, to) });
  }
  return pairs;
}

/** 18632: each pair of consecutive duty days, not a weekly 12-hour pot. Four duty days = three gaps. */
export function nightRestPairHits(schedule, employee, weekStart) {
  const need = ruleValue("hours.night.restHours", weekDateKeys(weekStart)[0]) || 12;
  return adjacentDutyPairs(schedule, employee, weekStart).filter((pair) => (
    (performsNightWork(pair.from, pair.fromKey) || performsNightWork(pair.to, pair.toKey))
    && pair.gap < need
  ));
}

export function cloneDayMap(day) {
  const copy = {};
  if (!day || typeof day !== "object") return copy;
  for (const [key, value] of Object.entries(day)) {
    copy[key] = Array.isArray(value) ? [...value] : value;
  }
  return copy;
}

export function employeeShiftOnDay(schedule, employeeId, dateKey, opts = {}) {
  const day = dayAssignmentMap(schedule?.assignments, dateKey, opts);
  if (!day) return null;
  return (schedule.shiftTypes || []).find((shift) => (day[shift.id] || []).includes(employeeId)) || null;
}

/** Shifts that do not perform night work — morning / evening only. */
export function ordinaryShiftTypes(shiftTypes = [], onDate) {
  return (shiftTypes || []).filter((shift) => !performsNightWork(shift, onDate));
}

export function ordinaryShiftId(shiftTypes = [], kind, onDate) {
  const pool = ordinaryShiftTypes(shiftTypes, onDate);
  if (!pool.length) return null;
  const k = String(kind || "").trim().toLowerCase();
  const hour = (shift) => Number(String(shift?.start || "").slice(0, 2));
  if (k === "morning" || k === "صباحي") {
    return (
      pool.find((shift) => shift.id === "morning" || /صباح|morning/i.test(shift.label || ""))?.id
      || pool.find((shift) => Number.isFinite(hour(shift)) && hour(shift) < 12)?.id
      || pool[0].id
    );
  }
  if (k === "evening" || k === "مسائي") {
    return (
      pool.find((shift) => shift.id === "evening" || /مساء|evening/i.test(shift.label || ""))?.id
      || pool.find((shift) => Number.isFinite(hour(shift)) && hour(shift) >= 12)?.id
      || pool[pool.length - 1].id
    );
  }
  return pool[0].id;
}

export function weekNightDateKeys(schedule, employeeId, weekStart) {
  return weekDateKeys(weekStart).filter((key) => {
    const shift = employeeShiftOnDay(schedule, employeeId, key);
    return !!(shift && performsNightWork(shift, key));
  });
}

export function cycleShiftId(shiftTypes = [], currentId, brushId, opts = {}) {
  // null/undefined = cycle every type on the roster, including night. "" = paint rest.
  if (brushId != null) return brushId || null;
  const pool = opts.ordinaryOnly === true ? ordinaryShiftTypes(shiftTypes, opts.onDate) : (shiftTypes || []);
  const order = [...pool.map((shift) => shift.id), null];
  if (!order.length) return null;
  const index = order.indexOf(currentId || null);
  if (index < 0) return order[0];
  return order[(index + 1) % order.length];
}

/** Over 3 months as a night worker and no written consent — manager may assign morning or evening. Night stays on the roster. */
export function employeeNeedsNightRotateChoice(employee, schedule, dateKey) {
  if (!employee?.id || !dateKey) return false;
  if (hasNightConsent(employee, dateKey)) return false;
  const weekStart = weekStartDate(dateKey);
  const streak = nightStreakWeeks(schedule, employee.id, weekStart) + 1;
  const rotate = ruleValue("hours.night.rotateWeeks", dateKey) || 13;
  return streak > rotate;
}

function sameCalendarMonth(iso, onDate) {
  if (!iso) return false;
  if (!onDate) return true;
  const when = onDate instanceof Date ? onDate : weekStartDate(onDate);
  const month = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}`;
  return String(iso).slice(0, 7) === month;
}

/** Written consent stays on file until withdrawn — 18632 does not require monthly re-consent. */
export function hasNightConsent(employee, _onDate) {
  void _onDate;
  return hasWrittenNightConsent(employee);
}

export const NIGHT_REMEDY_KINDS = ["allowance", "reduce", "rotate"];

/** Live establishment choice — withdrawn reduce/allowance is gone until they choose again. */
export function activeNightRemedy(employee) {
  const row = employee?.profile?.nightRemedy;
  if (!row || row.withdrawnAt) return null;
  if (!NIGHT_REMEDY_KINDS.includes(row.kind)) return null;
  return row;
}

export function nightRemedyIsWithdrawable(remedy) {
  const row = remedy?.kind ? remedy : activeNightRemedy(remedy);
  return row?.kind === "allowance" || row?.kind === "reduce";
}

export function withdrawableNightRemedyEmployees(employees = []) {
  return (employees || []).filter((employee) => nightRemedyIsWithdrawable(activeNightRemedy(employee)));
}

/** Chose reduced hours — no longer a night worker under 18632 until the establishment withdraws. */
export function hasNightHoursReduction(employee, onDate) {
  if (activeNightRemedy(employee)?.kind === "reduce") return true;
  return sameCalendarMonth(employee?.profile?.nightHoursReducedAt, onDate);
}

export const NIGHT_REDUCE_HOUR_CHOICES = [1, 2, 3];

export function nightReduceCutHours(value) {
  const n = Number(value);
  return NIGHT_REDUCE_HOUR_CHOICES.includes(n) ? n : 0;
}

export function nightCutHoursLabel(cutHours, ar = true) {
  const n = nightReduceCutHours(cutHours);
  if (!n) return "";
  if (ar) {
    if (n === 1) return "ساعة واحدة";
    if (n === 2) return "ساعتان";
    return `${n} ساعات`;
  }
  return n === 1 ? "1 hour" : `${n} hours`;
}

export function checkNightReduceHoursGate({ cutHours, shift } = {}) {
  const cut = nightReduceCutHours(cutHours);
  if (!cut) {
    return {
      ok: false,
      error: "CUT_HOURS_REQUIRED",
      reason: "حدّد كم ساعة تُنقص من وردية الموظف.",
      reasonEn: "Set how many hours to cut from this person's shift.",
    };
  }
  if (shift?.start && shift?.end && shiftHours(shift) - cut <= 0) {
    return {
      ok: false,
      error: "CUT_EXCEEDS_SHIFT",
      reason: "التقليص لا يُبقي ساعات في الوردية.",
      reasonEn: "That cut would leave no hours on the shift.",
    };
  }
  return { ok: true, cutHours: cut };
}

export const NIGHT_ALLOWANCE_KINDS = ["pay", "transport"];

export function nightAllowanceKind(value) {
  return NIGHT_ALLOWANCE_KINDS.includes(value) ? value : "";
}

export function nightAllowanceAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

export function checkNightAllowanceGate({ amount, allowanceKind } = {}) {
  const kind = nightAllowanceKind(allowanceKind);
  if (!kind) {
    return {
      ok: false,
      error: "ALLOWANCE_KIND_REQUIRED",
      reason: "اختَر أجرًا أو بدل نقل.",
      reasonEn: "Choose pay or a transport benefit.",
    };
  }
  const sar = nightAllowanceAmount(amount);
  if (!sar) {
    return {
      ok: false,
      error: "ALLOWANCE_AMOUNT_REQUIRED",
      reason: "حدّد مبلغ التعويض بالريال.",
      reasonEn: "Name the compensation amount in riyals.",
    };
  }
  return { ok: true, allowanceKind: kind, amount: sar };
}

export function nightAllowancePayLabel(amount, allowanceKind, ar = true) {
  const sar = nightAllowanceAmount(amount);
  const kind = nightAllowanceKind(allowanceKind);
  const kindAr = kind === "transport" ? "بدل نقل" : "أجر";
  const kindEn = kind === "transport" ? "transport" : "pay";
  if (!sar) return ar ? kindAr : kindEn;
  const shown = Number.isInteger(sar) ? String(sar) : sar.toFixed(2);
  return ar ? `${kindAr} ${shown} ر.س` : `${kindEn} ${shown} SAR`;
}

/** Live 18632 allowance that payroll adds this month — withdrawn or boolean stamps pay nothing. */
export function payableNightAllowance(employee) {
  const remedy = activeNightRemedy(employee);
  if (remedy?.kind === "allowance") {
    return nightAllowanceAmount(remedy.amount ?? employee?.profile?.nightAllowance);
  }
  const raw = employee?.profile?.nightAllowance;
  if (typeof raw === "number") return nightAllowanceAmount(raw);
  return 0;
}

function clockMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
}

function formatClockMinutes(mins) {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60) % 24).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** Shorten a duty from its end — the chosen cut, not a fixed under-3h night. */
export function shortenShiftByHours(shift, cutHours) {
  const cut = nightReduceCutHours(cutHours);
  if (!shift?.start || !shift?.end || !cut) return null;
  const start = clockMinutes(shift.start);
  let end = clockMinutes(shift.end);
  if (end <= start) end += 1440;
  const nextEnd = end - cut * 60;
  if (nextEnd <= start) return null;
  return {
    label: `${String(shift.label || "ليلي").replace(/\s*−\d+س$/, "")} −${cut}س`,
    start: shift.start,
    end: formatClockMinutes(nextEnd),
    restMinutes: shift.restMinutes,
    cutHours: cut,
  };
}

export function ensureCutNightShiftType(schedule, baseShift, cutHours) {
  const spec = shortenShiftByHours(baseShift, cutHours);
  if (!spec) return null;
  const found = (schedule.shiftTypes || []).find((shift) => (
    shift.start === spec.start && shift.end === spec.end && nightReduceCutHours(shift.cutHours) === spec.cutHours
  ));
  if (found) return found;
  const created = {
    id: `sft_cut_${String(spec.start).replace(":", "")}_${String(spec.end).replace(":", "")}_${spec.cutHours}`,
    label: spec.label,
    start: spec.start,
    end: spec.end,
    restMinutes: spec.restMinutes ?? 30,
    cutHours: spec.cutHours,
  };
  schedule.shiftTypes = [...(schedule.shiftTypes || []), created];
  return created;
}

/** Late window that ends at midnight — under 3 hours in 23:00–06:00 and not after 00:00. */
export function reducedNightShiftSpec(onDate) {
  const startHour = ruleValue("hours.night.startHour", onDate) ?? 23;
  const workerHours = ruleValue("hours.night.workerHours", onDate) || 3;
  const span = Math.max(30, workerHours * 60 - 30);
  const startMins = startHour * 60;
  const endMins = Math.min(startMins + span, 1440) % 1440;
  const fmt = (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  return {
    label: "ليلي مخفّض",
    start: fmt(startMins),
    end: fmt(endMins),
    restMinutes: 30,
  };
}

function isNightCompensationFlag(value) {
  if (value === true || value === 1 || value === "1") return true;
  if (typeof value === "number" && value > 0) return true;
  return /^(true|yes|ok|allowance|ot|compensat)/i.test(String(value || "").trim());
}

const NIGHT_COMPENSATION_KEYS = [
  "nightCompensation",
  "nightAllowance",
  "nightCompensated",
  "nightOtTreatment",
  "nightPremium",
  "nightTransport",
  "nightTransportAllowance",
  "nightBenefit",
];

/** Recorded بدل / allowance / OT treatment — not the generic payroll lump. */
export function hasRecordedNightCompensation({ schedule, station, settings, employee, shift } = {}) {
  if (activeNightRemedy(employee)?.kind === "allowance") return true;
  const bags = [schedule, station, settings, settings?.attendance, employee?.profile, shift];
  return bags.some((bag) => bag && NIGHT_COMPENSATION_KEYS.some((key) => isNightCompensationFlag(bag[key])));
}

/** Clock span shorter than the ordinary day (Art. 98 eight hours) — rest break is not a reduction. */
export function nightAssignmentHoursReduced(shift, onDate) {
  if (!shift?.start || !shift?.end) return false;
  const ordinary = ruleValue("hours.shift.ordinaryHours", onDate) || 8;
  return shiftHours(shift) + 1e-9 < ordinary;
}

export function countNightWorkerDaysInYear(schedule, employeeId, onDate) {
  const year = String(laborDayKey(onDate)).slice(0, 4);
  let days = 0;
  for (const key of Object.keys(schedule?.assignments || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !key.startsWith(year)) continue;
    if (isNightWorker(employeeShiftOnDay(schedule, employeeId, key, { datedOnly: true }), key)) days += 1;
  }
  return days;
}

export function consecutiveNightWorkerMonths(schedule, employeeId, onDate) {
  const day = parseDateKey(onDate) || new Date();
  let months = 0;
  for (let back = 0; back < 18; back += 1) {
    const cursor = new Date(day.getFullYear(), day.getMonth() - back, 1);
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const prefix = `${y}-${m}-`;
    let hit = false;
    for (const key of Object.keys(schedule?.assignments || {})) {
      if (!key.startsWith(prefix)) continue;
      if (isNightWorker(employeeShiftOnDay(schedule, employeeId, key, { datedOnly: true }), key)) {
        hit = true;
        break;
      }
    }
    if (!hit) break;
    months += 1;
  }
  return months;
}

export function monthsWithNightShareAtLeast(schedule, employeeId, onDate, share = 0.25) {
  const day = parseDateKey(onDate) || new Date();
  let count = 0;
  for (let back = 0; back < 12; back += 1) {
    const cursor = new Date(day.getFullYear(), day.getMonth() - back, 1);
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const prefix = `${y}-${m}-`;
    let nightMin = 0;
    let totalMin = 0;
    for (const key of Object.keys(schedule?.assignments || {})) {
      if (!key.startsWith(prefix)) continue;
      const shift = employeeShiftOnDay(schedule, employeeId, key, { datedOnly: true });
      if (!shift) continue;
      totalMin += minutesBetween(shift.start, shift.end);
      nightMin += nightMinutesInWindow(shift.start, shift.end, key);
    }
    if (totalMin > 0 && nightMin / totalMin >= share) count += 1;
    else if (back > 0) break;
  }
  return count;
}

export function checkNightPerformerCompensationGate({
  shift,
  onDate,
  employee,
  schedule,
  station,
  settings,
} = {}) {
  const ruleId = "hours.night.compensateOrReduce";
  const explained = explainRule(ruleId, onDate);
  if (!performsNightWork(shift, onDate)) {
    return { ok: true, error: null, ruleId, via: null };
  }
  if (hasRecordedNightCompensation({ schedule, station, settings, employee, shift })) {
    return { ok: true, error: null, ruleId, via: "compensate", cite: explained };
  }
  if (hasNightHoursReduction(employee, onDate)) {
    return { ok: true, error: null, ruleId, via: "reduce", cite: explained };
  }
  return {
    ok: false,
    error: "NIGHT_PERFORMER_COMPENSATION",
    ruleId,
    reason: "من يؤدي عملاً ليلياً يستحق تعويضاً بساعات أو أجر أو مزايا مماثلة (بدل/نقل) — القرار 18632.",
    reasonEn: "Anyone who performs night work is owed compensation in hours, pay, or similar benefits (allowance / transport) — decision 18632.",
    cite: explained,
  };
}

/** Named XOR for a night worker — skipped when 18632 treats the night as incidental. */
export function checkNightCompensateOrReduceGate({
  shift,
  onDate,
  employee,
  schedule,
  station,
  settings,
  laborCalendar,
} = {}) {
  const ruleId = "hours.night.compensateOrReduce";
  const explained = explainRule(ruleId, onDate);
  if (!shift || !isNightWorker(shift, onDate)) {
    return { ok: true, error: null, ruleId, via: null };
  }
  const yearPrefix = String(laborDayKey(onDate)).slice(0, 4);
  const datedYearDays = Object.keys(schedule?.assignments || {}).filter((key) => (
    /^\d{4}-\d{2}-\d{2}$/.test(key) && key.startsWith(yearPrefix)
  )).length;
  const exempt = isNightWorkerXorExempt({
    onDate,
    employee,
    schedule,
    laborCalendar,
    yearDays: countNightWorkerDaysInYear(schedule, employee?.id, onDate),
    consecutiveMonths: consecutiveNightWorkerMonths(schedule, employee?.id, onDate),
    shareMonths: monthsWithNightShareAtLeast(schedule, employee?.id, onDate, 0.25),
    datedYearDays,
  });
  if (exempt.exempt) {
    return { ok: true, error: null, ruleId, via: "exempt", exempt, cite: explained };
  }
  if (nightAssignmentHoursReduced(shift, onDate) || hasNightHoursReduction(employee, onDate)) {
    return { ok: true, error: null, ruleId, via: "reduce", cite: explained };
  }
  if (hasRecordedNightCompensation({ schedule, station, settings, employee, shift })) {
    return { ok: true, error: null, ruleId, via: "compensate", cite: explained };
  }
  return {
    ok: false,
    error: "NIGHT_COMPENSATE_OR_REDUCE",
    ruleId,
    reason: "العامل الليلي يوجب بدلاً مناسباً أو تخفيض ساعات مع حفظ وزن الساعات العادية والأجر والمزايا (القرار 18632).",
    reasonEn: "A night worker requires a suitable allowance or reduced hours with ordinary-hour weight, pay and benefits preserved (decision 18632).",
    cite: explained,
  };
}

export function assignEmployeeDayOnSchedule(schedule, dateKey, employeeId, shiftTypeId) {
  const current = dayAssignmentMap(schedule?.assignments, dateKey) || {};
  const day = cloneDayMap(current);
  for (const shift of schedule.shiftTypes || []) {
    day[shift.id] = (day[shift.id] || []).filter((id) => id !== employeeId);
  }
  if (shiftTypeId && (schedule.shiftTypes || []).some((shift) => shift.id === shiftTypeId)) {
    day[shiftTypeId] = [...(day[shiftTypeId] || []), employeeId];
  }
  schedule.assignments = schedule.assignments || {};
  schedule.assignments[dateKey] = day;
  return schedule;
}

export function ensureReducedNightShiftType(schedule, onDate) {
  const spec = reducedNightShiftSpec(onDate);
  const found = (schedule.shiftTypes || []).find((shift) => shift.start === spec.start && shift.end === spec.end);
  if (found) return found;
  const created = {
    id: "sft_night_reduced",
    label: spec.label,
    start: spec.start,
    end: spec.end,
    restMinutes: spec.restMinutes,
  };
  schedule.shiftTypes = [...(schedule.shiftTypes || []), created];
  return created;
}

/** reduce = cut the chosen hours from that night duty. rotate = ordinary hours or rest. */
export function remapEmployeeNightWorkerDays(schedule, employeeId, weekStart, mode = "reduce", { cutHours } = {}) {
  const start = weekStartDate(weekStart);
  const cut = nightReduceCutHours(cutHours);
  if (mode === "reduce" && cut) {
    let moved = 0;
    let shiftId = null;
    for (const day of weekDays(start)) {
      const shift = employeeShiftOnDay(schedule, employeeId, day.key);
      if (!isNightShift(shift, day.key)) continue;
      const target = ensureCutNightShiftType(schedule, shift, cut);
      if (!target) continue;
      assignEmployeeDayOnSchedule(schedule, day.key, employeeId, target.id);
      shiftId = target.id;
      moved += 1;
    }
    return { ok: true, moved, shiftId, mode, cutHours: cut };
  }
  const target = mode === "reduce"
    ? ensureReducedNightShiftType(schedule, start)
    : mode === "evening"
      ? ((schedule.shiftTypes || []).find((shift) => isEveningShift(shift)) || null)
      : ((schedule.shiftTypes || []).find((shift) => isMorningShift(shift)) || null);
  let moved = 0;
  for (const day of weekDays(start)) {
    const shift = employeeShiftOnDay(schedule, employeeId, day.key);
    if (!isNightShift(shift, day.key)) continue;
    assignEmployeeDayOnSchedule(schedule, day.key, employeeId, target?.id || null);
    moved += 1;
  }
  return { ok: true, moved, shiftId: target?.id || null, mode, cutHours: cut || null };
}

/** Count dated night-worker weeks. Reset only after ≥1 month (~4 weeks) of ordinary hours. */
export function nightStreakWeeks(schedule, employeeId, weekStart, lookback = 40) {
  const start = weekStart instanceof Date ? weekStartDate(weekStart) : weekStartDate(parseDateKey(weekStart) || new Date());
  let weeks = 0;
  let ordinaryRun = 0;
  const ordinaryNeed = ruleValue("hours.night.rotateOrdinaryWeeks", start) || 4;
  for (let back = 1; back <= lookback; back += 1) {
    const prev = addDays(start, -7 * back);
    const keys = weekDateKeys(prev);
    const any = keys.some((key) => isNightWorker(employeeShiftOnDay(schedule, employeeId, key, { datedOnly: true }), key));
    if (any) {
      weeks += 1;
      ordinaryRun = 0;
    } else {
      ordinaryRun += 1;
      if (ordinaryRun >= ordinaryNeed) break;
    }
  }
  return weeks;
}

/** Workplace on the employee file — not header scope, not the first listed station. */
export function employeeWorkStationId(employee) {
  const id = employee?.stationId;
  return id != null && String(id).trim() ? String(id) : null;
}

export function findStationById(stations = [], stationId) {
  if (!stationId) return null;
  return (stations || []).find((row) => String(row.id || row.stationId) === String(stationId)) || null;
}

export function stationDisplayName(station, fallback = "") {
  if (!station) return fallback;
  return String(station.name || station.nameAr || station.code || fallback || "").trim();
}

/** Avoid «جدول فرع فرع الخفجي» when the station name already starts with فرع. */
export function rosterBranchPhrase(stationName = "", ar = true) {
  const name = String(stationName || "").trim();
  if (!name) return "";
  if (ar && /^(فرع|محطة)\s/.test(name)) return name;
  return ar ? `فرع ${name}` : name;
}

/**
 * Which station's week the roster table shows.
 * ملفي / mine is locked to the viewer's work station — header «كل الفروع» never substitutes another branch.
 * Manage uses the header station when one branch is scoped; otherwise the work station, then fallback.
 */
/** People the calendar / file roster shows for a lane — mine is the work branch only. */
export function calendarLaneEmployees({
  lane = "mine",
  employee,
  employees = [],
  managed = [],
} = {}) {
  const workStationId = employeeWorkStationId(employee);
  const branch = (employees || []).filter((row) => (
    workStationId && String(row.stationId || "") === String(workStationId)
  ));
  if (lane === "manage") {
    if (managed.length) return managed;
    return branch.length ? branch : (employee ? [employee] : []);
  }
  if (!employee) return branch;
  const self = branch.find((row) => row.id === employee.id) || employee;
  return [self, ...branch.filter((row) => row.id !== employee.id)];
}

/**
 * People whose approved leave paints the operational calendar.
 * ملفي / mine = work-station roster only. Header «فرع آخر» does not leak in.
 * إدارة may add header-scoped colleagues.
 */
export function calendarOverlayEmployees({
  lane = "mine",
  employee,
  employees = [],
  managed = [],
  headerPeople = [],
} = {}) {
  const lanePeople = calendarLaneEmployees({ lane, employee, employees, managed });
  if (lane !== "manage") return lanePeople;
  const seen = new Set();
  const out = [];
  for (const row of [...lanePeople, ...(headerPeople || [])]) {
    const id = row?.id;
    if (id == null || seen.has(String(id))) continue;
    seen.add(String(id));
    out.push(row);
  }
  return out;
}

export function rosterTableStation({
  lane = "mine",
  employee,
  headerScope,
  stations = [],
  fallbackStationId = null,
} = {}) {
  const workStationId = employeeWorkStationId(employee);
  const scoped = headerScope && headerScope !== "all" ? String(headerScope) : null;
  const stationId = lane === "manage"
    ? (scoped || workStationId || (fallbackStationId ? String(fallbackStationId) : null))
    : workStationId;
  const station = findStationById(stations, stationId);
  return {
    stationId,
    station,
    stationName: stationDisplayName(station),
    workStationId,
    lockedToWork: lane !== "manage",
    missingWorkStation: lane !== "manage" && !workStationId,
    headerAll: !scoped,
  };
}

/** ملفي stays on the work branch. Other station weeks live in إدارة. */
export function rosterMineScopeCopy({
  stationName = "",
  headerOther = false,
  ar = true,
} = {}) {
  const name = String(stationName || "").trim();
  const branch = rosterBranchPhrase(name, ar);
  if (ar) {
    return {
      line: branch
        ? `ملفك يرى ${branch} وجدول الفرع فقط.`
        : "ملفك يرى فرعك وجدول الفرع فقط.",
      action: "الجداول الأخرى من إدارة.",
      emphasize: !!headerOther,
    };
  }
  return {
    line: name
      ? `Your file shows the ${name} branch and its roster only.`
      : "Your file shows your branch and its roster only.",
    action: "Other rosters are in Manage.",
    emphasize: !!headerOther,
  };
}

export function rosterTableHeading({
  lane = "mine",
  stationName = "",
  missingWorkStation = false,
  canManage = false,
  ar = true,
} = {}) {
  const name = String(stationName || "").trim();
  if (lane !== "manage" && missingWorkStation) {
    return {
      pageTitle: ar ? "جدول الدوام" : "Duty roster",
      gridTitle: ar ? "ملفي" : "My file",
      gridLead: "",
      emptyReason: ar
        ? "لا فرع عمل مسجّل على ملفك — لا جدول يُعرض حتى يُربط ملفك بفرع."
        : "No work branch is on your file — no roster until your file is linked to a station.",
    };
  }
  const branch = rosterBranchPhrase(name, ar);
  if (lane !== "manage") {
    const other = canManage
      ? (ar ? " الجداول الأخرى من إدارة." : " Other rosters are in Manage.")
      : "";
    return {
      pageTitle: branch ? (ar ? `جدول ${branch}` : `${name} roster`) : (ar ? "جدول الدوام" : "Duty roster"),
      gridTitle: branch ? (ar ? `جدول ${branch}` : `${name} roster`) : (ar ? "ملفي" : "My file"),
      gridLead: branch
        ? (ar ? `جدول ${branch} — فرعك فقط.${other}` : `${name} roster — your branch only.${other}`)
        : "",
      emptyReason: "",
    };
  }
  return {
    pageTitle: branch ? (ar ? `جدول ${branch}` : `${name} roster`) : (ar ? "جدول الدوام" : "Duty roster"),
    gridTitle: branch ? (ar ? `تعيينات ${branch}` : `${name} assignments`) : (ar ? "التعيينات" : "Assignments"),
    gridLead: branch ? (ar ? `محرّر ${branch}.` : `Editor for ${name}.`) : "",
    emptyReason: !name
      ? (ar
        ? "لا فرع محدد — اختر فرعاً من الهيدر أو اربط ملفك بفرع عمل."
        : "No branch is selected — pick one in the header or link your file to a work station.")
      : "",
  };
}

export function weekRosterEmployees(schedule, employees = [], stationId, dateKeys, options = {}) {
  const homeOnly = options === true ? true : !!(options && options.homeOnly);
  const assigned = new Set();
  const keys = Array.isArray(dateKeys) && dateKeys.length ? dateKeys.map(String) : null;
  if (keys) {
    for (const key of keys) {
      const day = dayAssignmentMap(schedule?.assignments, key);
      if (!day) continue;
      for (const ids of Object.values(day)) {
        if (Array.isArray(ids)) ids.forEach((id) => assigned.add(String(id)));
      }
    }
  } else {
    for (const day of Object.values(schedule?.assignments || {})) {
      if (!day || typeof day !== "object" || Array.isArray(day)) continue;
      for (const ids of Object.values(day)) {
        if (Array.isArray(ids)) ids.forEach((id) => assigned.add(String(id)));
      }
    }
  }
  return (employees || []).filter((employee) => {
    if (!stationId) return !homeOnly;
    if (String(employee.stationId || "") === String(stationId)) return true;
    if (homeOnly) return false;
    return assigned.has(String(employee.id));
  });
}

export function leaveOnDayView(employee, dateKey, ar = true) {
  const request = approvedLeaveOnDay(employee, dateKey);
  if (!request) return null;
  const cite = citeLeaveType(request.type, dateKey);
  return {
    request,
    type: leaveTypeLabel(request.type, ar),
    article: ar ? (cite?.labelAr || "") : (cite?.labelEn || ""),
    articleId: cite?.article || "",
    style: LEAVE_STYLE,
  };
}

export function employeeWeekHours(schedule, employeeId, weekStart, employee) {
  const person = employee?.id === employeeId ? employee : null;
  return weekDateKeys(weekStart).reduce((sum, key) => {
    if (person && isOnApprovedLeave(person, key)) return sum;
    const shift = employeeShiftOnDay(schedule, employeeId, key);
    return sum + (shift ? actualShiftHours(shift, key, person) : 0);
  }, 0);
}

/** Art. 107 named OT from this week's published rota versus 98/99/Ramadan/164. */
export function weekNamedOvertime(schedule, employee, weekStart, company, laborCalendar, ar = true) {
  const days = weekDays(weekStart).map((day) => {
    const onLeave = !!(employee && isOnApprovedLeave(employee, day.key));
    const shift = !onLeave && employee?.id ? employeeShiftOnDay(schedule, employee.id, day.key) : null;
    return {
      key: day.key,
      hours: shift ? actualShiftHours(shift, day.key, employee) : 0,
      restDay: !!shift && isWeeklyRestDay(day.key, company, day.key),
      holiday: isOfficialHoliday(day.key, laborCalendar),
    };
  });
  return deriveNamedOvertime({ days, employee, company, laborCalendar, ar });
}

export function weekValidityOptions(ar = true) {
  return [
    { id: "week", label: ar ? "هذا الأسبوع فقط" : "This week only", note: ar ? "ينتهي بنهاية الأسبوع المعروض" : "Ends with the week on screen" },
    { id: "until", label: ar ? "يتكرر حتى تاريخ" : "Repeats until a date", note: ar ? "يُعاد تطبيق النمط أسبوعياً حتى التاريخ المحدّد" : "The pattern repeats weekly until that date" },
    { id: "open", label: ar ? "مفتوح بلا نهاية" : "Open-ended", note: ar ? "يبقى ساري المفعول حتى تنشر جدولاً جديداً" : "Stays in force until you publish a replacement" },
  ];
}

export function weekValidityNote(schedule, weekStart, ar = true) {
  const kind = schedule?.validity || "week";
  if (kind === "until") {
    const until = String(schedule?.validUntil || "").slice(0, 10);
    const pretty = until ? formatIsoDay(until, ar) : "—";
    return ar
      ? `محدود: يتكرر أسبوعياً حتى ${pretty}، ثم يتوقف ويصبح كل يوم بعده «بلا جدول منشور».`
      : `Limited: repeats weekly until ${pretty}, then every later day is unscheduled.`;
  }
  if (kind === "open") {
    return ar
      ? "غير محدود: يتكرر أسبوعياً بلا نهاية. أي يوم قادم يرث نمط هذا الأسبوع حتى تنشر بديلاً."
      : "Open: repeats weekly. Later days inherit this week until you publish a replacement.";
  }
  return ar
    ? `محدود: ${formatWeekLabel(weekStart, true)}. الأسبوع التالي يحتاج نشراً جديداً.`
    : `Limited to ${formatWeekLabel(weekStart, false)}. Next week needs a new publish.`;
}

function formatIsoDay(iso, ar = true) {
  const date = parseDateKey(iso);
  if (!date) return iso || "—";
  if (!ar) return iso;
  return `${date.getDate()} ${MONTHS_AR[date.getMonth()]} ${date.getFullYear()}`;
}

export function weekPublishState(schedule, weekStart, today = new Date()) {
  const key = weekKeyFromDate(weekStart);
  const snap = schedule?.publishedWeeks?.[key];
  const dirty = !!(schedule?.weekDirty?.[key]);
  const end = addDays(weekStartDate(weekStart), 6);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const past = end < todayStart;
  if (snap && !dirty) return { kind: "published", key, snap };
  if ((snap || past) && dirty) return { kind: "edited", key, snap };
  if (past) return { kind: "implicit", key, snap: null };
  return { kind: "draft", key, snap: null };
}

export function isWeekDayPublished(schedule, dateKey, today = new Date()) {
  const date = parseDateKey(dateKey);
  if (!date) return false;
  const state = weekPublishState(schedule, date, today);
  if (state.kind === "published" || state.kind === "implicit") return true;
  return hasAnyAssignment(schedule, dateKey) && state.kind !== "draft";
}

function hasAnyAssignment(schedule, dateKey) {
  const day = dayAssignmentMap(schedule?.assignments, dateKey);
  if (!day) return false;
  return (schedule.shiftTypes || []).some((shift) => (day[shift.id] || []).length > 0);
}

export function checkShiftChangeApplyGate({ schedule, employee, dateKey, shiftTypeId, employees = [], laborCalendar } = {}) {
  if (!dateKey) {
    return { ok: false, error: "DATE_REQUIRED", reason: "حدد يوم الوردية.", reasonEn: "Set the shift date." };
  }
  if (employee && isOnApprovedLeave(employee, dateKey)) {
    return {
      ok: false,
      error: "ON_LEAVE",
      reason: "لا يُسند من له إجازة معتمدة.",
      reasonEn: "Someone on approved leave is never assigned a shift.",
    };
  }
  const next = shiftTypeId ? (schedule?.shiftTypes || []).find((shift) => shift.id === shiftTypeId) : null;
  if (shiftTypeId && !next) {
    return { ok: false, error: "SHIFT_REQUIRED", reason: "نوع الوردية غير موجود.", reasonEn: "That shift type is missing." };
  }
  if (next && employee?.id) {
    const restGate = checkNightRestApplyGate({ schedule, employee, dateKey, shift: next });
    if (!restGate.ok) return restGate;
  }
  if (next && performsNightWork(next, dateKey)) {
    const pregnancy = checkNightPregnancyBan({ employee, shift: next, onDate: dateKey });
    if (!pregnancy.ok) return pregnancy;
  }
  if (next && isNightWorker(next, dateKey)) {
    const medical = checkNightMedicalFitness({ employee, shift: next, onDate: dateKey });
    if (!medical.ok) return medical;
    if (hasNightHoursReduction(employee, dateKey)) {
      const remedy = activeNightRemedy(employee);
      const cut = nightReduceCutHours(remedy?.cutHours);
      if (cut) {
        const from = Number(remedy.fromHours) || (ruleValue("hours.shift.ordinaryHours", dateKey) || 8);
        const maxHours = from - cut;
        if (shiftHours(next) > maxHours + 1e-9) {
          return {
            ok: false,
            error: "NIGHT_HOURS_REDUCED",
            reason: `تقليص ${nightCutHoursLabel(cut, true)} مسجّل — لا تُسند وردية أطول من ${maxHours} ساعات. اسحب التقليص من إعداد الليل للبدء من جديد.`,
            reasonEn: `A cut of ${nightCutHoursLabel(cut, false)} is on file — do not assign a shift longer than ${maxHours} hours. Withdraw the reduction in night settings to start over.`,
          };
        }
      } else {
        return {
          ok: false,
          error: "NIGHT_HOURS_REDUCED",
          reason: `تقليص ساعات الليل مسجّل — لا يُسند كعامل ليلي (أقل من ${ruleValue("hours.night.workerHours", dateKey)} ساعات في ${nightWindowLabel(dateKey)}). اسحب التقليص من إعداد الليل للبدء من جديد.`,
          reasonEn: `Reduced night hours are on file — they are not assigned as a night worker (under ${ruleValue("hours.night.workerHours", dateKey)} hours in ${nightWindowLabel(dateKey)}). Withdraw the reduction in night settings to start over.`,
        };
      }
    }
    const weekStart = weekStartDate(dateKey);
    const streak = nightStreakWeeks(schedule, employee?.id, weekStart) + 1;
    const rotate = ruleValue("hours.night.rotateWeeks", dateKey) || 13;
    if (streak > rotate && !hasNightConsent(employee, dateKey)) {
      return {
        ok: false,
        error: "NIGHT_CONSENT_REQUIRED",
        reason: "تجاوز ثلاثة أشهر كعامل ليلي دون موافقة خطية — أسند صباحي أو مسائي. وردية الليل تبقى على الجدول. إن وافق الموظف من طلباتي يُفتح الليل من جديد (القرار 18632).",
        reasonEn: "More than three months as a night worker without written consent — assign morning or evening. The night shift stays on the roster. If the worker agrees in My Requests, night opens again (decision 18632).",
        streak,
      };
    }
  }
  if (next) {
    const stay = checkWorkplaceStayDutyGate({ shift: next, onDate: dateKey, employee });
    if (!stay.ok) return stay;
  }
  if (next && isOfficialHoliday(dateKey, laborCalendar)) {
    return {
      ok: false,
      error: "OFFICIAL_HOLIDAY",
      reason: "لا تُسند وردية في عطلة رسمية بأجر كامل — المادة 112.",
      reasonEn: "A shift is not assigned on a paid official holiday — Article 112.",
    };
  }
  if (next && isRamadanDay(dateKey, laborCalendar) && isRamadanHoursSubject(employee) && ramadanUsesDailySixCap(next, dateKey, employee)) {
    const hrs = actualShiftHours(next, dateKey, employee);
    const cap = ruleValue("hours.ramadan.ordinaryHours", dateKey);
    if (hrs > cap) {
      return {
        ok: false,
        error: "RAMADAN_DAY_CAP",
        reason: `نظام الثماني ساعات (خمسة دوام) في رمضان ${cap} ساعات فعلية — المادة 98. وردية 12 ساعة بقاء وأربعة راحة تبقى 12.`,
        reasonEn: `The eight-hour five-day system drops to ${cap} actual hours in Ramadan — Art. 98. A 12h-stay four-on/four-off duty stays 12.`,
      };
    }
  }
  void employees;
  return { ok: true };
}

function articleChip(ruleId, onDate, fallbackAr) {
  const cite = ruleId ? citeRule(ruleId, onDate) : null;
  const explained = !cite && ruleId ? explainRule(ruleId, onDate) : null;
  const article = cite?.labelAr || explained?.labelAr || fallbackAr || null;
  const articleEn = cite?.labelEn || explained?.labelEn || fallbackAr || null;
  return { article, articleEn, ruleId: ruleId || null };
}

function clockHourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function nightWindowLabel(onDate) {
  return `${clockHourLabel(ruleValue("hours.night.startHour", onDate))}–${clockHourLabel(ruleValue("hours.night.endHour", onDate))}`;
}

/** Riyadh civil day for live heat-ban alerts — same clock as ops / work-proof. */
export function heatBanTodayKey(today = new Date()) {
  if (typeof today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(String(today).slice(0, 10))) {
    return String(today).slice(0, 10);
  }
  const at = today instanceof Date ? today : new Date(today);
  const clock = riyadhClock(Number.isNaN(at.getTime()) ? new Date() : at);
  return clock?.dayKey || isoDayKey(at);
}

/**
 * Live sun-ban fire: the day itself is in season and is not already past
 * on the Riyadh clock. A week that merely overlaps the season is not enough.
 */
export function isLiveHeatBanDay(dateKey, today = new Date()) {
  const key = isoDayKey(dateKey) || String(dateKey || "").slice(0, 10);
  if (!isHeatBanDate(key)) return false;
  return key >= heatBanTodayKey(today);
}

/** In-season day on a week that has already ended — historical cell paint only. */
export function isHistoricalHeatBanDay(dateKey, today = new Date(), weekEndKey = "") {
  const key = isoDayKey(dateKey) || String(dateKey || "").slice(0, 10);
  if (!isHeatBanDate(key)) return false;
  const todayKey = heatBanTodayKey(today);
  const end = isoDayKey(weekEndKey) || String(weekEndKey || "").slice(0, 10);
  return key < todayKey && !!end && end < todayKey;
}

export function checkWeekPublishGates({
  schedule,
  employees = [],
  weekStart,
  stationId,
  station,
  settings,
  company,
  ar = true,
  laborCalendar,
  today = new Date(),
} = {}) {
  const onDate = weekDateKeys(weekStart)[0];
  const days = weekDays(weekStart);
  const types = schedule?.shiftTypes || [];
  const roster = weekRosterEmployees(schedule, employees, stationId, days.map((day) => day.key));
  const weeklyCap = ruleValue("hours.week.ordinaryMaxHours", onDate);
  const exceptionDay = ruleValue("hours.ot.exceptionDayHours", onDate);
  const exceptionWeek = ruleValue("hours.ot.exceptionWeekHours", onDate);
  const workplaceMax = ruleValue("hours.workplace.maxHours", onDate);
  const gapHours = ruleValue("hours.rest.betweenShiftsHours", onDate);
  const nightRest = ruleValue("hours.night.restHours", onDate);
  const rotateWeeks = ruleValue("hours.night.rotateWeeks", onDate);
  const restMinutesNeed = ruleValue("hours.rest.duringShiftMinutes", onDate);

  const ramadanDayCap = ruleValue("hours.ramadan.ordinaryHours", onDate);
  const ramadanWeekCap = ruleValue("hours.ramadan.weekMaxHours", onDate);
  const overCap = [];
  const over60 = [];
  const perDayOver10 = [];
  const perDayOver12 = [];
  const noBreak = [];
  const gapUnder11 = [];
  const nightNoRest = [];
  const noWeeklyRest = [];
  const leaveClash = [];
  const ramadanOverDay = [];
  const ramadanOverWeek = [];
  const holidayWork = [];
  const eidRestDue = [];
  let leaveDays = 0;
  let assigned = 0;
  let totalHours = 0;

  for (const employee of roster) {
    let hours = 0;
    let ramadanHours = 0;
    let restDays = 0;
    const keys = days.map((day) => day.key);
    keys.forEach((key, index) => {
      const day = days[index];
      const onLeave = isOnApprovedLeave(employee, key);
      const shift = employeeShiftOnDay(schedule, employee.id, key);
      if (onLeave) {
        leaveDays += 1;
        restDays += 1;
        if (shift) {
          const label = `${employee.name} (${day.day} ${MONTHS_AR[day.month]} — ${shift.label || shift.id})`;
          if (!leaveClash.includes(label)) leaveClash.push(label);
        }
        return;
      }
      if (!shift) {
        restDays += 1;
        return;
      }
      assigned += 1;
      const spanHrs = shiftHours(shift);
      const hrs = actualShiftHours(shift, key, employee);
      hours += hrs;
      if (isOfficialHoliday(key, laborCalendar)) {
        const label = `${employee.name} (${day.day} ${MONTHS_AR[day.month]})`;
        if (!holidayWork.includes(label)) holidayWork.push(label);
      }
      if (isRamadanDay(key, laborCalendar) && isRamadanHoursSubject(employee) && ramadanUsesDailySixCap(shift, key, employee)) {
        ramadanHours += hrs;
        if (hrs > ramadanDayCap) {
          const label = `${employee.name} (${day.day} ${MONTHS_AR[day.month]})`;
          if (!ramadanOverDay.includes(label)) ramadanOverDay.push(label);
        }
      }
      if (spanHrs > workplaceMax && !perDayOver12.includes(employee.name)) perDayOver12.push(employee.name);
      if (hrs > exceptionDay && !perDayOver10.includes(employee.name)) perDayOver10.push(employee.name);
      const rest = shift.restMinutes == null ? restMinutesNeed : Number(shift.restMinutes) || 0;
      const consec = checkConsecutiveWorkGate({ start: shift.start, end: shift.end, restMinutes: rest, onDate: key });
      if (!consec.ok && !noBreak.includes(shift.label || shift.id)) noBreak.push(shift.label || shift.id);
      if (index < 6) {
        const next = employeeShiftOnDay(schedule, employee.id, keys[index + 1]);
        if (next) {
          const gap = restGapHours(shift, next);
          if (gap < gapHours && !gapUnder11.includes(employee.name)) gapUnder11.push(employee.name);
        }
      }
    });
    if (nightRestPairHits(schedule, employee, weekStart).length && !nightNoRest.includes(employee.name)) {
      nightNoRest.push(employee.name);
    }
    totalHours += hours;
    if (hours > weeklyCap) overCap.push(employee.name);
    if (hours > exceptionWeek) over60.push(employee.name);
    if (ramadanHours > ramadanWeekCap && !ramadanOverWeek.includes(employee.name)) ramadanOverWeek.push(employee.name);
    if (restDays === 0) noWeeklyRest.push(employee.name);
    const eidRestDays = days.filter((day) => isEidHoliday(day.key, laborCalendar) && isWeeklyRestDay(day.key, company, day.key));
    if (eidRestDays.length) {
      const otherRest = days.filter((day) => {
        if (isEidHoliday(day.key, laborCalendar)) return false;
        if (isOnApprovedLeave(employee, day.key)) return true;
        return !employeeShiftOnDay(schedule, employee.id, day.key);
      });
      if (otherRest.length === 0 && !eidRestDue.includes(employee.name)) eidRestDue.push(employee.name);
    }
  }

  const uncovered = days.filter((day) => {
    if (day.weekend) return false;
    return !roster.some((employee) => {
      if (isOnApprovedLeave(employee, day.key)) return false;
      return isMorningShift(employeeShiftOnDay(schedule, employee.id, day.key));
    });
  });

  const nightsThisWeek = roster.filter((employee) =>
    days.some((day) => {
      if (isOnApprovedLeave(employee, day.key)) return false;
      return isNightWorker(employeeShiftOnDay(schedule, employee.id, day.key), day.key);
    }),
  );
  const performersThisWeek = roster.filter((employee) =>
    days.some((day) => {
      if (isOnApprovedLeave(employee, day.key)) return false;
      return performsNightWork(employeeShiftOnDay(schedule, employee.id, day.key), day.key);
    }),
  );
  const rotate = nightsThisWeek
    .map((employee) => ({
      employee,
      weeks: nightStreakWeeks(schedule, employee.id, weekStart) + 1,
    }))
    .filter((row) => row.weeks > rotateWeeks);
  const rotateBlocking = rotate.filter((row) => !hasNightConsent(row.employee, weekStart));

  const nightNoRemedy = nightsThisWeek.filter((employee) =>
    days.some((day) => {
      if (isOnApprovedLeave(employee, day.key)) return false;
      const shift = employeeShiftOnDay(schedule, employee.id, day.key);
      if (!isNightWorker(shift, day.key)) return false;
      return !checkNightCompensateOrReduceGate({
        shift,
        onDate: day.key,
        employee,
        schedule,
        station,
        settings,
        laborCalendar,
      }).ok;
    }),
  ).map((employee) => employee.name);

  const nightPerformerNoComp = performersThisWeek.filter((employee) =>
    days.some((day) => {
      if (isOnApprovedLeave(employee, day.key)) return false;
      const shift = employeeShiftOnDay(schedule, employee.id, day.key);
      if (!performsNightWork(shift, day.key)) return false;
      return !checkNightPerformerCompensationGate({
        shift,
        onDate: day.key,
        employee,
        schedule,
        station,
        settings,
      }).ok;
    }),
  ).map((employee) => employee.name);

  const nightPregnancyBlock = [];
  const nightMedicalBlock = [];
  const nightMedicalFileGap = [];
  const nightConsideration = [];
  const nightPayFlag = [];
  for (const employee of roster) {
    for (const day of days) {
      if (isOnApprovedLeave(employee, day.key)) continue;
      const shift = employeeShiftOnDay(schedule, employee.id, day.key);
      if (!shift) continue;
      const preg = checkNightPregnancyBan({ employee, shift, onDate: day.key });
      if (!preg.ok && !nightPregnancyBlock.includes(employee.name)) nightPregnancyBlock.push(employee.name);
      const med = nightMedicalDutyState({ employee, shift, onDate: day.key });
      if (med.block && !nightMedicalBlock.includes(employee.name)) nightMedicalBlock.push(employee.name);
      else if (med.unmet && !nightMedicalFileGap.includes(employee.name)) nightMedicalFileGap.push(employee.name);
    }
    if (performersThisWeek.includes(employee)) {
      const note = nightConsiderationNote(employee, onDate, ar);
      if (note && !nightConsideration.includes(employee.name)) nightConsideration.push(employee.name);
      if (employee?.profile?.nightPayDiscrimination && !nightPayFlag.includes(employee.name)) {
        nightPayFlag.push(employee.name);
      }
    }
  }
  const facilityGaps = performersThisWeek.length
    ? nightFacilityGaps(nightFacilityBags({ schedule, station, settings, company }))
    : [];

  const heatWin = heatBanWindow(onDate);
  const todayKey = heatBanTodayKey(today);
  const weekEndKey = days[6]?.key || "";
  const heatSeason = days.some((day) => isLiveHeatBanDay(day.key, todayKey));
  const sunClash = [];
  const sunUnmarked = [];
  if (heatSeason) {
    for (const shift of types) {
      const used = days.some((day) => {
        const map = dayAssignmentMap(schedule?.assignments, day.key);
        return (map?.[shift.id] || []).length > 0 && isLiveHeatBanDay(day.key, todayKey);
      });
      if (!used) continue;
      const gate = checkHeatBanGate({ start: shift.start, end: shift.end, outdoor: shift.outdoor === true, summer: true });
      if (!gate.ok) {
        sunClash.push(shift.label || shift.id);
        continue;
      }
      if (shift.outdoor === true || shift.outdoor === false) continue;
      if (shiftOverlapsHeatBan(shift.start, shift.end, { outdoor: true, summer: true })) {
        sunUnmarked.push(shift.label || shift.id);
      }
    }
  }
  const sunBanPeople = [];
  const sunUnmarkedPeople = [];
  if (heatSeason) {
    for (const employee of roster) {
      for (const day of days) {
        if (!isLiveHeatBanDay(day.key, todayKey) || isOnApprovedLeave(employee, day.key)) continue;
        const shift = employeeShiftOnDay(schedule, employee.id, day.key);
        if (!shift) continue;
        const shiftName = shift.label || shift.id;
        if (sunClash.includes(shiftName) && !sunBanPeople.includes(employee.name)) {
          sunBanPeople.push(employee.name);
        } else if (sunUnmarked.includes(shiftName) && !sunUnmarkedPeople.includes(employee.name)) {
          sunUnmarkedPeople.push(employee.name);
        }
      }
    }
  }

  const ramadan = days.some((day) => isRamadanDay(day.key, laborCalendar));
  const ramadanBlocked = ramadanOverDay.length > 0 || ramadanOverWeek.length > 0;
  const nightWin = nightWindowLabel(onDate);
  const weeklyRestHours = ruleValue("hours.rest.weeklyHours", onDate);
  const consecHours = ruleValue("hours.rest.maxConsecutiveHours", onDate);
  const rotateMonths = Math.round((rotateWeeks / 4.33) * 10) / 10;
  const pregWeeks = ruleValue("hours.night.pregnancyBanWeeks", onDate);
  const nightWorkerHours = ruleValue("hours.night.workerHours", onDate);

  const names = (list) => list.join(ar ? "، " : ", ");
  const gateDefs = [
    {
      id: "hours_48",
      ok: overCap.length === 0,
      block: true,
      ...articleChip("hours.week.ordinaryMaxHours", onDate),
      title: ar ? `أعلى حمل أسبوعي ${weeklyCap} ساعة` : `Weekly load cap ${weeklyCap} hours`,
      note: overCap.length
        ? (ar ? `${names(overCap)} يتجاوزون ${weeklyCap} ساعة. المحسوب أثقل أسبوع لأثقل موظف.` : `${names(overCap)} exceed ${weeklyCap} hours.`)
        : (ar ? `لا أحد يتجاوز ${weeklyCap} ساعة في هذا الأسبوع — محسوبة لكل أسبوع تقويمي على حدة.` : `Nobody exceeds ${weeklyCap} hours this calendar week.`),
    },
    {
      id: "hours_106",
      ok: over60.length === 0 && perDayOver10.length === 0,
      block: true,
      ...articleChip("hours.ot.exceptionDayHours", onDate),
      title: ar ? `حدّ الاستثناء: ${exceptionDay} ساعات يومياً أو ${exceptionWeek} أسبوعياً` : `Exception cap: ${exceptionDay}h/day or ${exceptionWeek}h/week`,
      note: (over60.length === 0 && perDayOver10.length === 0)
        ? (ar ? `لا يوم يتجاوز ${exceptionDay} ساعات، ولا أسبوع يتجاوز ${exceptionWeek} ساعة.` : `No day exceeds ${exceptionDay} hours, no week exceeds ${exceptionWeek}.`)
        : `${perDayOver10.length ? (ar ? `${names(perDayOver10)} تجاوزوا ${exceptionDay} ساعات في يوم. ` : `${names(perDayOver10)} exceeded ${exceptionDay}h in a day. `) : ""}${over60.length ? (ar ? `${names(over60)} تجاوزوا ${exceptionWeek} ساعة أسبوعياً.` : `${names(over60)} exceeded ${exceptionWeek}h this week.`) : ""}`,
    },
    {
      id: "workplace",
      ok: perDayOver12.length === 0,
      block: true,
      ...articleChip("hours.workplace.maxHours", onDate),
      title: ar ? `لا بقاء في موقع العمل أكثر من ${workplaceMax} ساعة في اليوم` : `No more than ${workplaceMax}h at the workplace in a day`,
      note: perDayOver12.length
        ? (ar ? `${names(perDayOver12)} — وردية تتجاوز ${workplaceMax} ساعة بقاء في الموقع.` : `${names(perDayOver12)} — a shift stays longer than ${workplaceMax}h.`)
        : (ar ? `أطول وردية في الجدول ضمن ${workplaceMax} ساعة.` : `Longest shift stays within ${workplaceMax} hours.`),
    },
    {
      id: "gap_11",
      ok: gapUnder11.length === 0,
      block: false,
      ...articleChip("hours.rest.betweenShiftsHours", onDate),
      title: ar ? `فاصل تشغيلي ${gapHours} ساعة بين ورديتين` : `Operational ${gapHours}-hour gap between shifts`,
      note: gapUnder11.length
        ? (ar ? `${names(gapUnder11)} — الفاصل بين ورديتين متتاليتين أقل من ${gapHours} ساعة. سياسة تشغيلية، ليست المادة 101.` : `${names(gapUnder11)} — gap under ${gapHours} hours. Operational, not Art. 101.`)
        : (ar ? `كل انتقال بين يومين متتاليين فيه ${gapHours} ساعة أو أكثر.` : `Every back-to-back pair has at least ${gapHours} hours.`),
    },
    {
      id: "night_rest",
      ok: nightNoRest.length === 0,
      block: true,
      ...articleChip("hours.night.restHours", onDate, "القرار 18632"),
      title: ar ? `راحة ${nightRest} ساعة بين كل يومي دوام إذا دخل أحدهما الليل` : `${nightRest}-hour rest between consecutive duty days if either enters night`,
      note: nightNoRest.length
        ? (ar ? `${names(nightNoRest)} — فاصل أقل من ${nightRest} ساعة بين يومي دوام متتاليين ودخل أحدهما ${nightWin}. أربعة أيام دوام = ثلاثة فواصل.` : `${names(nightNoRest)} — under ${nightRest} hours between consecutive duty days, and one day enters ${nightWin}. Four duty days = three gaps.`)
        : (ar ? `كل فاصل بين يومي دوام متتاليين فيه ${nightRest} ساعة أو أكثر إن دخل أحدهما ${nightWin}. أربعة أيام دوام متتالية = ثلاثة فواصل. ليل ثم ليل من 07:00 إلى 23:00 جائز.` : `Every gap between consecutive duty days is ${nightRest} hours or more if either day enters ${nightWin}. Four consecutive duty days = three gaps. Night then night from 07:00 to 23:00 is allowed.`),
    },
    {
      id: "rest_5h",
      ok: noBreak.length === 0,
      block: true,
      ...articleChip("hours.rest.maxConsecutiveHours", onDate),
      title: ar ? `لا عمل أكثر من ${consecHours} ساعات متواصلة دون راحة ${restMinutesNeed} دقيقة` : `No more than ${consecHours} consecutive hours without a ${restMinutesNeed}-minute rest`,
      note: noBreak.length
        ? (ar ? `${names(noBreak)} — وردية تتجاوز ${consecHours} ساعات بلا راحة مقرّرة.` : `${names(noBreak)} — a shift exceeds ${consecHours} hours without a rest.`)
        : (ar ? `كل وردية تتجاوز ${consecHours} ساعات فيها راحة ${restMinutesNeed} دقيقة. والراحة ليست ساعات عمل — المادة 102.` : `Shifts over ${consecHours} hours include a ${restMinutesNeed}-minute rest. Rest is not working time — Art. 102.`),
    },
    {
      id: "eid_rest_compensate",
      ok: eidRestDue.length === 0,
      block: false,
      ...articleChip("leave.eid.overlap.cite", onDate),
      title: ar ? "تداخل العيد مع الراحة الأسبوعية يُعوَّض" : "Eid falling on weekly rest is compensated",
      note: eidRestDue.length
        ? (ar ? `${names(eidRestDue)} — الراحة الأسبوعية داخل العيد. عوّض بيوم راحة خارج العيد.` : `${names(eidRestDue)} — weekly rest falls inside Eid. Compensate with a rest day outside Eid.`)
        : (ar ? "لا راحة أسبوعية داخل أيام العيد دون تعويض." : "No weekly rest inside Eid without a compensating day."),
    },
    {
      id: "weekly_rest",
      ok: noWeeklyRest.length === 0,
      block: true,
      ...articleChip("hours.rest.weeklyHours", onDate),
      title: ar ? `راحة أسبوعية ${weeklyRestHours} ساعة متصلة` : `${weeklyRestHours}-hour continuous weekly rest`,
      note: noWeeklyRest.length
        ? (ar ? `${names(noWeeklyRest)} — بلا يوم راحة كامل في هذا الأسبوع.` : `${names(noWeeklyRest)} have no full rest day this week.`)
        : (ar ? "لكل موظف يوم راحة كامل في هذا الأسبوع، ولا يُستبدل بأجر." : "Everyone has a full rest day this week, never replaced by pay."),
    },
    {
      id: "night_rotate",
      ok: rotateBlocking.length === 0,
      block: true,
      ...articleChip("hours.night.rotateWeeks", onDate, "القرار 18632"),
      title: ar ? `تدوير العامل الليلي بعد ${rotateMonths} أشهر` : `Rotate a night worker after ${rotateMonths} months`,
      note: rotateBlocking.length
        ? (ar
          ? `${rotateBlocking.map((row) => `${row.employee.name} (${Math.round((row.weeks / 4.33) * 10) / 10} شهر)`).join("، ")} — موافقة خطية محفوظة مع حق التراجع، أو تقليص تحت ${nightWorkerHours} ساعات، أو تدوير لساعات عادية شهراً على الأقل.`
          : `${rotateBlocking.map((row) => `${row.employee.name} (${Math.round((row.weeks / 4.33) * 10) / 10} mo)`).join(", ")} — written consent on file with the right to withdraw, hours under ${nightWorkerHours} night hours, or rotate to ordinary hours for at least one month.`)
        : rotate.length
          ? (ar
            ? `${rotate.map((row) => row.employee.name).join("، ")} تجاوزوا ${rotateMonths} أشهر كعمّال ليليين، وموافقتهم الخطية محفوظة مع حق التراجع.`
            : `${rotate.map((row) => row.employee.name).join(", ")} exceeded ${rotateMonths} months as night workers — written consent is on file with the right to withdraw.`)
          : (ar ? `لا عامل ليلي تجاوز ${rotateMonths} أشهر متواصلة دون شهر عادي أو موافقة محفوظة.` : `No night worker has exceeded ${rotateMonths} continuous months without a full ordinary month or consent on file.`),
    },
    {
      id: "night_compensate",
      ok: nightNoRemedy.length === 0,
      block: true,
      error: nightNoRemedy.length ? "NIGHT_COMPENSATE_OR_REDUCE" : null,
      ...articleChip("hours.night.compensateOrReduce", onDate, "القرار 18632"),
      title: ar ? "العامل الليلي: بدل أو تخفيض ساعات" : "Night worker: allowance or reduced hours",
      note: nightNoRemedy.length
        ? (ar
          ? `${names(nightNoRemedy)} — اختَر تقليص الساعات أو بدلاً أو تغيير العمل الليلي. التقليص والبدل يُسحبان للبدء من جديد.`
          : `${names(nightNoRemedy)} — choose reduced hours, an allowance, or a change of night work. A reduction or allowance can be withdrawn to start over.`)
        : nightsThisWeek.length
          ? (ar ? "كل عامل ليلي فيه بدل مسجّل أو تخفيض ساعات، أو ليلي عرضي مستثنى." : "Every night worker has a recorded allowance, reduced hours, or an incidental exemption.")
          : (ar ? `لا عامل ليلي (≥${nightWorkerHours} ساعات في ${nightWin}) هذا الأسبوع.` : `No night worker (≥${nightWorkerHours} hours in ${nightWin}) this week.`),
    },
    {
      id: "night_performer_comp",
      ok: nightPerformerNoComp.length === 0,
      block: true,
      error: nightPerformerNoComp.length ? "NIGHT_PERFORMER_COMPENSATION" : null,
      ...articleChip("hours.night.compensateOrReduce", onDate, "القرار 18632"),
      title: ar ? "تعويض من يؤدي عملاً ليلياً" : "Compensate anyone who performs night work",
      note: nightPerformerNoComp.length
        ? (ar ? `${names(nightPerformerNoComp)} — عمل داخل ${nightWin} بلا بدل/نقل/تعويض مسجّل.` : `${names(nightPerformerNoComp)} — work inside ${nightWin} without recorded allowance, transport, or compensation.`)
        : performersThisWeek.length
          ? (ar ? `كل من يدخل ${nightWin} له تعويض مسجّل (ساعات/أجر/بدل/نقل).` : `Everyone who enters ${nightWin} has recorded compensation (hours / pay / allowance / transport).`)
          : (ar ? "لا عمل داخل نافذة الليل هذا الأسبوع." : "No work inside the night window this week."),
    },
    {
      id: "night_pregnancy",
      ok: nightPregnancyBlock.length === 0,
      block: true,
      error: nightPregnancyBlock.length ? "NIGHT_PREGNANCY_BAN" : null,
      ...articleChip("hours.night.pregnancyBanWeeks", onDate, "القرار 18632"),
      title: ar ? `حظر ليلي للحامل قبل الوضع بـ${pregWeeks} أسبوعاً` : `Pregnancy night ban — ${pregWeeks} weeks before birth`,
      note: nightPregnancyBlock.length
        ? (ar ? `${names(nightPregnancyBlock)} — إسناد داخل ${nightWin} داخل حظر الحمل.` : `${names(nightPregnancyBlock)} — assignment inside ${nightWin} during the pregnancy night ban.`)
        : (ar ? `لا إسناد ليلي لحامل داخل ${pregWeeks} أسبوعاً قبل الوضع — يُوفَّر عمل مناسب في الساعات المعتادة.` : `No night assignment for a pregnant worker inside the ${pregWeeks}-week ban — suitable ordinary-hours work must be provided.`),
    },
    {
      id: "night_medical",
      ok: nightMedicalBlock.length === 0 && nightMedicalFileGap.length === 0,
      block: nightMedicalBlock.length > 0,
      error: nightMedicalBlock.length
        ? "NIGHT_MEDICAL_UNFIT"
        : (nightMedicalFileGap.length ? "NIGHT_MEDICAL_FILE_MISSING" : null),
      ...articleChip("hours.night.medicalYearMonths", onDate, "القرار 18632"),
      title: ar ? "لياقة العامل الليلي الطبية" : "Night-worker medical fitness",
      note: nightMedicalBlock.length
        ? (ar ? `${names(nightMedicalBlock)} — تقرير غير لائق، ولا يُستمر في إسناد العامل الليلي.` : `${names(nightMedicalBlock)} — an unfit report; night-worker assignment may not continue.`)
        : nightMedicalFileGap.length
          ? (ar
            ? `${names(nightMedicalFileGap)} — لا تقرير لياقة طبية محفوظ (ملف + تاريخ)، أو مضى عام أثناء الإسناد.`
            : `${names(nightMedicalFileGap)} — no night-fitness report on file (file + date), or a year has passed while assigned.`)
          : nightsThisWeek.length
            ? (ar ? "كل عامل ليلي فيه تقرير لياقة محفوظ بتاريخ. التقرير للملف فقط ولا يُعرض للغير دون موافقة." : "Every night worker has a dated fitness report on the file. The report stays on the file and is not shown to others without consent.")
            : (ar ? "لا عامل ليلي هذا الأسبوع — لا واجب تقرير طبي." : "No night worker this week — no medical-report duty."),
    },
    {
      id: "night_facilities",
      ok: facilityGaps.length === 0,
      block: true,
      error: facilityGaps.length ? "NIGHT_FACILITY_GAP" : null,
      ...articleChip("hours.night.restHours", onDate, "القرار 18632"),
      title: ar ? "التزامات المنشأة لليل: إسعاف وطعام" : "Night workplace duties: first aid and food",
      note: facilityGaps.length
        ? (ar
          ? `ناقص قبل النشر: ${facilityGaps.map((row) => row.ar).join("، ")}. أعلام إعدادات — ليست وحدة عيادة.`
          : `Unset before publish: ${facilityGaps.map((row) => row.en).join(", ")}. Settings flags — not a clinic module.`)
        : performersThisWeek.length
          ? (ar ? "إسعاف أولي ونقل طارئ ووصول لطعام ليلي مسجّلة على الفرع أو الشركة." : "Night first aid, emergency transfer, and food access are recorded on the station or company.")
          : (ar ? "لا عمل ليلي يستدعي أعلام المنشأة هذا الأسبوع." : "No night work that needs workplace flags this week."),
    },
    {
      id: "night_pay_equality",
      ok: nightPayFlag.length === 0,
      block: false,
      ...articleChip("hours.night.compensateOrReduce", onDate, "القرار 18632"),
      title: ar ? "لا تمييز في الأجر بسبب الليل" : "No pay discrimination because of night work",
      note: nightPayFlag.length
        ? (ar ? `${names(nightPayFlag)} — وُسم تمييز أجر ليلي على الملف (القرار 18632 أ–ب).` : `${names(nightPayFlag)} — a night-pay discrimination flag is on the file (decision 18632 a–b).`)
        : (ar ? "لا وسم تمييز أجر ليلي على الملف — ملاحظة تشغيلية، بلا تدقيق مسير." : "No night-pay discrimination flag is on the file — operational note, not a payroll audit."),
    },
    {
      id: "night_consideration",
      ok: true,
      block: false,
      ...articleChip("hours.night.rotateWeeks", onDate, "القرار 18632"),
      title: ar ? "يراعى كبار السن والمسؤوليات العائلية" : "Consider older workers and family duties",
      note: nightConsideration.length
        ? (ar ? `${names(nightConsideration)} — يراعى قدر الإمكان، وليست مانعاً.` : `${names(nightConsideration)} — considered as far as possible, not a block.`)
        : (ar ? "يراعى قدر الإمكان كبار السن وذوو المسؤوليات العائلية عند الإسناد الليلي — ملاحظة، ليست مانعاً." : "Older workers and those with family responsibilities are considered as far as possible — a note, not a block."),
    },
    {
      id: "morning_cover",
      ok: uncovered.length === 0,
      block: true,
      article: null,
      articleEn: null,
      title: ar ? "تغطية الوردية الصباحية" : "Morning-shift coverage",
      note: uncovered.length
        ? (ar
          ? `${uncovered.length} يوم عمل بلا وردية صباحية: ${uncovered.map((day) => `${day.day} ${MONTHS_AR[day.month]}`).join("، ")}. النقص عبء جدولة، لا يُحتسب غياباً على أحد.`
          : `${uncovered.length} workdays without a morning shift. A coverage gap is a roster fault, not an absence.`)
        : (ar ? "كل يوم عمل فيه صباحي واحد على الأقل." : "Every workday has at least one morning shift."),
    },
    {
      id: "heat_ban",
      ok: sunClash.length === 0,
      block: false,
      ...articleChip("hours.heat.startHour", onDate, "قرار الحظر"),
      title: ar ? "لا يُجبر العامل على العمل في نافذة حظر الشمس" : "A worker may not be compelled to work in the sun-ban window",
      note: sunClash.length
        ? `${weekHeatBanWorkerNotice(names(sunBanPeople.length ? sunBanPeople : sunClash), onDate, { ar })} ${ar ? "تنبيه حماية، وليس مانعاً للنشر." : "A protection notice, not a publish block."}`
        : heatSeason
          ? (ar ? `موسم الحظر ساري (${heatWin.seasonAr}) ولا وردية موسومة ميداناً تمسّ ${heatWin.startLabel} – ${heatWin.endLabel}.` : `Heat-ban season is in force (${heatWin.seasonEn}) and no shift marked open-air touches ${heatWin.startLabel}–${heatWin.endLabel}.`)
          : (ar ? "خارج موسم حظر الشمس." : "Outside the heat-ban season."),
    },
    {
      id: "heat_place",
      ok: sunUnmarked.length === 0,
      block: false,
      ...articleChip("hours.heat.startHour", onDate, "قرار الحظر"),
      title: ar ? "وسم الميدان المكشوف قبل حظر الشمس" : "Mark open-air before the sun ban",
      note: sunUnmarked.length
        ? `${weekHeatBanWorkerNotice(names(sunUnmarkedPeople.length ? sunUnmarkedPeople : sunUnmarked), onDate, { ar })} ${ar ? "وسم الميدان مكشوفاً أو داخلياً — الحظر لا يُطبَّق على العمل الداخلي." : "Mark the shift open-air or indoor — the ban does not apply to indoor work."}`
        : heatSeason
          ? (ar ? "كل وردية تمس نافذة الحظر موسومة داخلياً أو ميداناً مكشوفاً — الحظر لا يُطبَّق على العمل الداخلي." : "Every shift that touches the ban window is marked indoor or open-air — the ban does not apply to indoor work.")
          : (ar ? "خارج الموسم — لا نافذة ظهر لحظر الشمس." : "Off season — no midday sun-ban window."),
    },
    {
      id: "ramadan",
      ok: !ramadanBlocked,
      block: true,
      ...articleChip("hours.ramadan.ordinaryHours", onDate),
      title: ar ? `ساعات رمضان ${ramadanDayCap} يومياً أو ${ramadanWeekCap} أسبوعياً` : `Ramadan hours ${ramadanDayCap} a day or ${ramadanWeekCap} a week`,
      note: !ramadan
        ? (ar ? "لا أيام رمضان في هذا الأسبوع." : "No Ramadan days this week.")
        : ramadanBlocked
          ? (ar
            ? `${ramadanOverDay.length ? `${names(ramadanOverDay)} تجاوزوا ${ramadanDayCap} ساعات في يوم رمضان. ` : ""}${ramadanOverWeek.length ? `${names(ramadanOverWeek)} تجاوزوا ${ramadanWeekCap} ساعة على أيام رمضان في الأسبوع.` : ""} اليوم 30 معلّق حتى إعلان 29 أو 30.`
            : `${ramadanOverDay.length ? `${names(ramadanOverDay)} exceeded ${ramadanDayCap}h on a Ramadan day. ` : ""}${ramadanOverWeek.length ? `${names(ramadanOverWeek)} exceeded ${ramadanWeekCap}h across Ramadan days this week.` : ""} Day 30 waits for the 29/30 announcement.`)
          : (ar
            ? `ثمانية ساعات × خمسة أيام تنزل إلى ${ramadanDayCap} فعلية. اثنا عشر ساعة بقاء × أربعة أيام وأربعة راحة تبقى 12. غير المسلم المسجّل مستثنى.`
            : `Eight hours × five days drop to ${ramadanDayCap} actual. 12h stay × four days + four rest stays 12. A file marked non-Muslim is exempt.`),
    },
    {
      id: "official_holiday",
      ok: holidayWork.length === 0,
      block: true,
      ...articleChip("leave.eid.cite", onDate),
      title: ar ? "لا وردية في عطلة رسمية" : "No shift on an official holiday",
      note: holidayWork.length
        ? (ar ? `${names(holidayWork)} — عطلة بأجر كامل (المادة 112).` : `${names(holidayWork)} — a paid official holiday (Article 112).`)
        : (ar ? "لا تعيين يمسّ عيداً أو يوماً وطنياً أو يوم التأسيس." : "No assignment falls on an Eid, National Day, or Founding Day."),
    },
    {
      id: "not_empty",
      ok: assigned > 0,
      block: true,
      article: null,
      articleEn: null,
      title: ar ? "الجدول غير فارغ" : "Roster is not empty",
      note: assigned > 0
        ? (ar ? `${assigned} تعيين في هذا الأسبوع.` : `${assigned} assignments this week.`)
        : (ar ? "لا تعيينات — لا شيء يُنشر." : "No assignments — nothing to publish."),
    },
    {
      id: "leave_excluded",
      ok: true,
      block: false,
      article: null,
      articleEn: null,
      ruleId: null,
      title: ar ? "إجازة معتمدة تبقى إجازة" : "Approved leave stays leave",
      note: leaveDays
        ? (ar
          ? `${leaveClash.length ? `${names(leaveClash)} على إجازة معتمدة. ` : ""}${leaveDays} يوم إجازة في الأسبوع — الإجازة تبقى إجازة، والنشر جائز.`
          : `${leaveClash.length ? `${names(leaveClash)} are on approved leave. ` : ""}${leaveDays} leave day(s) this week — leave stays leave, and publish is allowed.`)
        : (ar ? "لا إجازات معتمدة في هذا الأسبوع." : "No approved leave this week."),
    },
  ];

  const cellMarks = {};
  const markCell = (employeeId, dateKey, gateId, level, hint) => {
    if (!employeeId || !dateKey || !WEEK_CELL_ALERT_IDS.has(gateId)) return;
    const key = `${employeeId}:${dateKey}`;
    const prev = cellMarks[key];
    if (!prev || (level === "block" && prev.level !== "block")) {
      cellMarks[key] = hint ? { id: gateId, level, hint } : { id: gateId, level };
    }
  };
  const rotateBlockIds = new Set(rotateBlocking.map((row) => row.employee.id));
  for (const employee of roster) {
    const keys = days.map((day) => day.key);
    keys.forEach((key, index) => {
      const onLeave = isOnApprovedLeave(employee, key);
      const shift = employeeShiftOnDay(schedule, employee.id, key);
      if (onLeave) {
        return;
      }
      if (!shift) return;
      if (isOfficialHoliday(key, laborCalendar)) markCell(employee.id, key, "official_holiday", "block");
      if (eidRestDue.includes(employee.name) && isEidHoliday(key, laborCalendar) && isWeeklyRestDay(key, company, key)) {
        markCell(employee.id, key, "eid_rest_compensate", "warn");
      }
      if (isRamadanDay(key, laborCalendar) && isRamadanHoursSubject(employee) && ramadanUsesDailySixCap(shift, key, employee) && actualShiftHours(shift, key, employee) > ramadanDayCap) {
        markCell(employee.id, key, "ramadan", "block");
      }
      if (ramadanOverWeek.includes(employee.name) && isRamadanDay(key, laborCalendar)) {
        markCell(employee.id, key, "ramadan", "block");
      }
      if (shiftHours(shift) > workplaceMax) markCell(employee.id, key, "workplace", "block");
      if (actualShiftHours(shift, key, employee) > exceptionDay) markCell(employee.id, key, "hours_106", "block");
      const rest = shift.restMinutes == null ? restMinutesNeed : Number(shift.restMinutes) || 0;
      if (!checkConsecutiveWorkGate({ start: shift.start, end: shift.end, restMinutes: rest, onDate: key }).ok) {
        markCell(employee.id, key, "rest_5h", "block");
      }
      if (index < 6) {
        const next = employeeShiftOnDay(schedule, employee.id, keys[index + 1]);
        if (next) {
          const gap = restGapHours(shift, next);
          if (gap < gapHours) {
            markCell(employee.id, key, "gap_11", "warn");
            markCell(employee.id, keys[index + 1], "gap_11", "warn");
          }
        }
      }
      if (overCap.includes(employee.name)) markCell(employee.id, key, "hours_48", "block");
      if (over60.includes(employee.name)) markCell(employee.id, key, "hours_106", "block");
      if (noWeeklyRest.includes(employee.name)) markCell(employee.id, key, "weekly_rest", "block");
      if (rotateBlockIds.has(employee.id) && isNightWorker(shift, key)) markCell(employee.id, key, "night_rotate", "block");
      if (nightNoRemedy.includes(employee.name) && isNightWorker(shift, key)) markCell(employee.id, key, "night_compensate", "block");
      if (nightPerformerNoComp.includes(employee.name) && performsNightWork(shift, key)) {
        markCell(employee.id, key, "night_performer_comp", "block");
      }
      if (!checkNightPregnancyBan({ employee, shift, onDate: key }).ok) markCell(employee.id, key, "night_pregnancy", "block");
      {
        const medical = nightMedicalDutyState({ employee, shift, onDate: key });
        if (medical.block) markCell(employee.id, key, "night_medical", "block");
        else if (medical.unmet) markCell(employee.id, key, "night_medical", "warn");
      }
      if (facilityGaps.length && performsNightWork(shift, key)) markCell(employee.id, key, "night_facilities", "block");
      if (isLiveHeatBanDay(key, todayKey)) {
        const shiftName = shift.label || shift.id;
        if (sunClash.includes(shiftName)) {
          markCell(employee.id, key, "heat_ban", "warn", weekHeatBanWorkerNotice(employee.name, key, { ar }));
        } else if (sunUnmarked.includes(shiftName)) {
          markCell(employee.id, key, "heat_place", "warn", weekHeatBanWorkerNotice(employee.name, key, { ar }));
        }
      } else if (isHistoricalHeatBanDay(key, todayKey, weekEndKey)) {
        const histKind = !checkHeatBanGate({ start: shift.start, end: shift.end, outdoor: shift.outdoor === true, summer: true }).ok
          ? "heat_ban"
          : (shift.outdoor !== true && shift.outdoor !== false && shiftOverlapsHeatBan(shift.start, shift.end, { outdoor: true, summer: true })
            ? "heat_place"
            : null);
        if (histKind) {
          markCell(employee.id, key, histKind, "warn", weekHeatBanWorkerNotice(employee.name, key, { ar }));
        }
      }
    });
    for (const pair of nightRestPairHits(schedule, employee, weekStart)) {
      if (keys.includes(pair.fromKey)) markCell(employee.id, pair.fromKey, "night_rest", "block");
      if (keys.includes(pair.toKey)) markCell(employee.id, pair.toKey, "night_rest", "block");
    }
  }

  const blockers = gateDefs.filter((gate) => !gate.ok && gate.block);
  const warnings = gateDefs.filter((gate) => !gate.ok && !gate.block);
  return {
    checks: gateDefs,
    blockers,
    warnings,
    blocked: blockers.length > 0,
    assigned,
    totalHours: Math.round(totalHours),
    uncovered,
    overCap,
    nightsThisWeek,
    performersThisWeek,
    nightNoRemedy,
    nightPerformerNoComp,
    facilityGaps,
    rotate,
    rotateBlocking,
    leaveDays,
    leaveClash,
    cellMarks,
  };
}

/** Gates that paint a roster cell — same ids as «فحص ما قبل النشر», never a second rule set. */
export const WEEK_CELL_ALERT_IDS = new Set([
  "hours_48",
  "hours_106",
  "workplace",
  "gap_11",
  "night_rest",
  "rest_5h",
  "weekly_rest",
  "night_rotate",
  "night_compensate",
  "night_performer_comp",
  "night_pregnancy",
  "night_medical",
  "night_facilities",
  "heat_ban",
  "heat_place",
  "ramadan",
  "official_holiday",
  "eid_rest_compensate",
]);

/** Named worker-protection notice — Decision 3337 / Arts. 122+243. Roster alert only, never a publish block. */
export function weekHeatBanWorkerNotice(name, onDate, { ar = true } = {}) {
  const win = heatBanWindow(onDate);
  const who = String(name || "").trim();
  const cite = heatBanDecisionLabel(ar);
  if (ar) {
    return `${who ? `${who} — ` : ""}لا يحق لصاحب العمل أن يجبره على العمل في الميدان المكشوف من ${win.startLabel} إلى ${win.endLabel} ${win.seasonAr}. ${cite}، على المادتين 122 و243.`;
  }
  return `${who ? `${who} — ` : ""}the employer has no right to compel him to work in the open air from ${win.startLabel} to ${win.endLabel} ${win.seasonEn}. ${cite}, on articles 122 and 243.`;
}

/** Circular copy — classification, rule name, one sentence, basis footer. Instrument is metadata, not a pill. */
export function weekHeatBanStripCopy(onDate, { ar = true } = {}) {
  const win = heatBanWindow(onDate);
  const articles = HEAT_BAN_DECISION.basisArticles.join(ar ? " و" : " and ");
  return {
    classification: ar ? "إنذار حماية" : "Protection alert",
    instrument: ar ? `قرار ${HEAT_BAN_DECISION.id}` : `Decision ${HEAT_BAN_DECISION.id}`,
    headline: ar ? "حظر العمل تحت أشعة الشمس" : "Sun-ban on open-air work",
    body: ar
      ? `لا يحق لصاحب العمل أن يجبره على العمل في الميدان المكشوف من ${win.startLabel} إلى ${win.endLabel} ${win.seasonAr}.`
      : `The employer has no right to compel him to work in the open air from ${win.startLabel} to ${win.endLabel} ${win.seasonEn}.`,
    footer: ar ? `على المادتين ${articles}` : `On articles ${articles}`,
  };
}

/** First named blocker title from the same week checks — the disabled publish control reads this. */
export function weekPublishSubmitBlock(gates, { ar = true } = {}) {
  const blockers = gates?.blockers || [];
  if (!blockers.length) return "";
  const first = String(blockers[0].title || "").trim();
  if (!first) return "";
  if (blockers.length === 1) return first;
  const second = String(blockers[1].title || "").trim();
  if (blockers.length === 2 && second) {
    return ar ? `${first} — و${second}.` : `${first} — and ${second}.`;
  }
  const more = blockers.length - 1;
  return ar
    ? `${first} — و${more} موانع أخرى.`
    : `${first} — and ${more} more.`;
}

export function weekCellAlert(gates, employeeId, dateKey) {
  if (!employeeId || !dateKey) return null;
  return gates?.cellMarks?.[`${employeeId}:${dateKey}`] || null;
}

export function weekCellAlertTone(alert) {
  if (!alert?.level) return null;
  return {
    color: alert.level === "block" ? SW.abs : SW.gold,
    level: alert.level,
  };
}

/**
 * Week-check ids that light «تنبيهات الإدارة» when unmet.
 * Same derivation as «فحص ما قبل النشر» — selector only.
 * Coverage / empty roster / info-leave / consideration notes stay out.
 */
export const WEEK_DUTY_STRIP_IDS = new Set([
  ...WEEK_CELL_ALERT_IDS,
  "night_pay_equality",
]);

/** Product-only week checks — no Labour Law article and no ministerial decision. */
export const WEEK_POLICY_ONLY_IDS = new Set(["gap_11"]);

/** Decision 18632 publish blocks — never warn-only. Night stays judged at publish. */
export const MINISTRY_NIGHT_PUBLISH_BLOCK_IDS = [
  "night_rest",
  "night_rotate",
  "night_compensate",
  "night_performer_comp",
  "night_pregnancy",
  "night_facilities",
];

/** Only the 3-month night-rotate gate offers morning / evening. Night stays on the roster. */
export const NIGHT_ORDINARY_CHOICE_GATES = new Set(["night_rotate"]);

/** Night blockers that wait on the worker's written consent — never a manager decision. */
export const NIGHT_CONSENT_WAIT_GATES = new Set(["night_rotate"]);

export function cardHasGate(card, gates) {
  if (!card || !gates) return false;
  if (gates.has(card.gateId)) return true;
  return (card.items || []).some((row) => gates.has(row.gateId));
}

export function cardWantsOrdinaryChoice(card) {
  return cardHasGate(card, NIGHT_ORDINARY_CHOICE_GATES);
}

export function cardAwaitsNightConsent(card) {
  return cardHasGate(card, NIGHT_CONSENT_WAIT_GATES);
}

export function nightConsentWaitCopy(ar = true, { audience = "manager" } = {}) {
  if (audience === "employee") {
    return ar
      ? "تجاوزت ثلاثة أشهر كعامل ليلي. وافق من طلباتي لتبقى على الليل، أو تُدوَّر إلى صباحي أو مسائي. وردية الليل تبقى على الجدول."
      : "You have exceeded three months as a night worker. Agree in My Requests to stay on night, or you are rotated to morning or evening. The night shift stays on the roster.";
  }
  return ar
    ? "تجاوز ثلاثة أشهر كعامل ليلي دون موافقة. اختر صباحي أو مسائي لهذا الموظف — لا تُحذف وردية الليل من الجدول. إن وافق من طلباتي يبقى على الليل."
    : "More than three months as a night worker without consent. Choose morning or evening for this person — the night shift is not removed from the roster. If they agree in My Requests, they stay on night.";
}

/** Ministry / Labour Law surface of week-publish checks — skips company-policy-only ids. */
export function weekMinistrySurfaceChecks(checks = []) {
  return (checks || []).filter((row) => row && !WEEK_POLICY_ONLY_IDS.has(row.id));
}

const WEEK_DUTY_STRIP_SKIP_IDS = new Set([
  "leave_excluded",
  "night_consideration",
  "night_medical",
  "morning_cover",
  "not_empty",
]);

const WEEK_DUTY_NIGHT_IDS = new Set([
  "night_rest",
  "night_rotate",
  "night_compensate",
  "night_performer_comp",
  "night_pregnancy",
  "night_medical",
  "night_facilities",
  "night_pay_equality",
]);

const WEEK_DUTY_HEAT_IDS = new Set(["heat_ban", "heat_place"]);
const NIGHT_CONSENT_ONLY_LABELS = new Set(["موافقة خطية مفتوحة", "Open written consent"]);

function dutyStripDecisionId(gateId) {
  if (WEEK_DUTY_NIGHT_IDS.has(gateId)) return "18632";
  if (WEEK_DUTY_HEAT_IDS.has(gateId)) return "3337";
  return null;
}

function compareDutyStripCards(left, right) {
  if (left.level !== right.level) return left.level === "block" ? -1 : 1;
  return String(left.name || "").localeCompare(String(right.name || ""), "ar");
}

function finishDutyStrip(cards, presentOpts = {}) {
  const list = [...cards].sort(compareDutyStripCards);
  const pack = {
    cards: list,
    empty: list.length === 0,
    anyDue: list.length > 0,
    anyBlock: list.some((row) => row.level === "block"),
  };
  const grouped = groupDutyStripByPerson(pack, presentOpts);
  return {
    ...pack,
    people: grouped.people,
  };
}

export function weekDutyStripEmptyCopy(ar = true) {
  return ar ? PLATFORM_RAIL_EMPTY_AR : PLATFORM_RAIL_EMPTY_EN;
}

function dutyStripRawLabel(employee, check, hint, ar) {
  if (hint) return hint;
  const name = String(employee?.name || "").trim();
  const title = String(check?.title || "").trim();
  if (!name) return title;
  return ar ? `${name} — ${title}` : `${name} — ${title}`;
}

export function dutyStripBody(text, name) {
  const raw = String(text || "");
  const who = String(name || "").trim();
  if (who && raw.startsWith(`${who} — `)) return raw.slice(who.length + 3);
  return raw;
}

/** Two presenters, same week-check rows. Section chrome carries the audience; the card does not. */
export function presentDutyStripCard(card, { audience = "manager", ar = true } = {}) {
  if (!card) return card;
  const name = String(card.name || "").trim();
  const heat = WEEK_DUTY_HEAT_IDS.has(card.gateId);
  const night = WEEK_DUTY_NIGHT_IDS.has(card.gateId);
  const heatCopy = heat ? weekHeatBanStripCopy(card.onDate, { ar }) : null;
  const headline = heatCopy?.headline || String(card.title || "").trim();
  const medical = card.gateId === "night_medical";
  const body = heatCopy?.body
    || (medical
      ? (card.level === "block"
        ? (ar ? "تقرير غير لائق — لا يُستمر في إسناد العامل الليلي." : "An unfit report — night-worker assignment may not continue.")
        : (ar ? "لا تقرير طبي مسجّل" : "No medical report is on file."))
      : (card.body || ""));
  const subject = audience === "manager" && name
    ? (ar ? `بشأن: ${name}` : `Re: ${name}`)
    : "";
  const decisionId = card.decisionId || dutyStripDecisionId(card.gateId);
  return attachPlatformJudgment({
    ...card,
    audience,
    voice: "",
    classification: heatCopy?.classification
      || (night
        ? (ar ? "إنذار حماية" : "Protection alert")
        : (ar ? "تنبيه إداري" : "Administrative notice")),
    instrument: heatCopy?.instrument
      || (decisionId ? (ar ? `قرار ${decisionId}` : `Decision ${decisionId}`) : ""),
    headline,
    subject,
    byline: subject,
    body,
    footer: heatCopy?.footer || "",
    label: body || headline,
    requestsHref: (medical || card.gateId === "night_rotate")
      ? (audience === "employee" ? "/app/requests" : "/app/requests/manage")
      : (card.requestsHref || ""),
  }, { ar, gateId: card.gateId, source: card.source, entitled: card.entitledParty });
}

export function presentDutyStrip(pack, {
  audience = "manager",
  employeeId,
  ar = true,
} = {}) {
  let cards = [...(pack?.cards || [])];
  if (audience === "employee" || employeeId) {
    const id = String(employeeId || "");
    cards = cards.filter((row) => String(row.employeeId) === id);
  }
  return finishDutyStrip(cards.map((card) => presentDutyStripCard(card, { audience, ar })), { audience, ar });
}

/** Station publish blocks — named once on the rail, never as a person circular. */
export const WEEK_STATION_STRIP_IDS = new Set(["morning_cover", "not_empty"]);

export function weekStationDutyNotes(gates) {
  return (gates?.checks || [])
    .filter((row) => row && !row.ok && WEEK_STATION_STRIP_IDS.has(row.id))
    .map((row) => ({
      id: row.id,
      title: row.title,
      note: row.note || "",
      level: row.block ? "block" : "warn",
    }));
}

const DUTY_STRIP_LEVEL_RANK = { block: 0, warn: 1, cite: 2 };

function dutyStripPersonKey(card) {
  return String(card?.employeeId || card?.name || card?.id || "unknown");
}

/**
 * One circular per person. Flat cards stay for gates/tests;
 * the schedule rail reads `people` so أحمد السالم is not four circulars.
 */
export function groupDutyStripByPerson(pack, { ar = true, audience = "manager" } = {}) {
  const groups = new Map();
  for (const card of pack?.cards || []) {
    if (!card) continue;
    const key = dutyStripPersonKey(card);
    if (!groups.has(key)) {
      groups.set(key, {
        id: `person:${key}`,
        employeeId: card.employeeId || null,
        name: String(card.name || "").trim(),
        href: card.href || (card.employeeId ? `/app/employees/${encodeURIComponent(card.employeeId)}` : ""),
        audience: card.audience || audience,
        items: [],
      });
    }
    groups.get(key).items.push(card);
  }

  const people = [...groups.values()].map((group) => {
    const items = [...group.items].sort((left, right) => {
      const leftRank = DUTY_STRIP_LEVEL_RANK[left.level] ?? 9;
      const rightRank = DUTY_STRIP_LEVEL_RANK[right.level] ?? 9;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return String(left.headline || left.title || "").localeCompare(
        String(right.headline || right.title || ""),
        "ar",
      );
    });
    const block = items.some((row) => row.level === "block");
    const protection = items.some((row) => row.decisionId === "18632" || row.decisionId === "3337");
    const instruments = [...new Set(items.map((row) => row.instrument).filter(Boolean))];
    const firstStatute = items.find((row) => row.decisionId === "18632" || row.decisionId === "3337")
      || items.find((row) => row.decisionId || row.ruleId);
    const name = group.name;
    const protects = items.reduce((acc, row) => {
      const next = row.protects || judgmentProtects({
        gateId: row.gateId,
        source: row.source,
        entitled: row.entitledParty,
      });
      return { employee: acc.employee || next.employee, company: acc.company || next.company };
    }, { employee: false, company: false });
    return {
      ...group,
      items,
      itemCount: items.length,
      decisionId: firstStatute?.decisionId || null,
      ruleId: firstStatute?.ruleId || null,
      requestsHref: items.find((row) => row.requestsHref)?.requestsHref || "",
      gateId: items.find((row) => row.gateId)?.gateId || null,
      onDate: items.find((row) => row.onDate)?.onDate || null,
      level: block ? "block" : "warn",
      glow: block ? "block" : "due",
      classification: protection
        ? (ar ? "إنذار حماية" : "Protection alert")
        : (ar ? "تنبيه إداري" : "Administrative notice"),
      instrument: instruments.join(" · "),
      subject: audience === "manager" && name
        ? (ar ? `بشأن: ${name}` : `Re: ${name}`)
        : "",
      lede: dutyItemCountCopy(items.length, { ar, audience }),
      headline: "",
      body: "",
      footer: "",
      forum: "platform",
      ministryRole: "monitor",
      protects,
      judgment: judgmentProtectsCopy(protects, ar),
    };
  }).sort((left, right) => {
    if (left.level !== right.level) return left.level === "block" ? -1 : 1;
    return String(left.name || "").localeCompare(String(right.name || ""), "ar");
  });

  return {
    cards: pack?.cards || [],
    people,
    empty: people.length === 0,
    anyDue: people.length > 0,
    anyBlock: people.some((row) => row.level === "block"),
  };
}

export function dutyItemCountCopy(count, { ar = true, audience = "manager" } = {}) {
  const n = Number(count) || 0;
  if (!n) return "";
  if (ar) {
    const word = n === 1 ? "تنبيه واحد" : n === 2 ? "تنبيهان" : `${n} تنبيهات`;
    return audience === "manager" ? `${word} على جدوله` : `${word} على جدولك`;
  }
  const word = n === 1 ? "1 alert" : `${n} alerts`;
  return audience === "manager" ? `${word} on this roster` : `${word} on your roster`;
}

export function dutyStripPeopleSummary(grouped, ar = true) {
  const people = grouped?.people?.length || 0;
  const alerts = grouped?.cards?.length || 0;
  if (!people) return "";
  if (ar) {
    const alertWord = alerts === 1 ? "تنبيه واحد" : alerts === 2 ? "تنبيهان" : `${alerts} تنبيهات`;
    const who = people === 1 ? "شخص واحد" : people === 2 ? "شخصان" : `${people} أشخاص`;
    return `${alertWord} · ${who}`;
  }
  const alertWord = alerts === 1 ? "1 alert" : `${alerts} alerts`;
  const who = people === 1 ? "1 person" : `${people} people`;
  return `${alertWord} · ${who}`;
}

/** Select unmet warn/block week-check rows. Pass audience to present; default is الإدارة. */
export function weekDutyStripAlerts(gates, {
  employees = [],
  ar = true,
  audience = "manager",
  employeeId,
} = {}) {
  const roster = Array.isArray(employees) ? employees : [];
  const byId = new Map(roster.map((row) => [String(row.id), row]));
  const peopleByGate = new Map();
  const hintByKey = new Map();
  const dateByPersonGate = new Map();

  for (const [key, mark] of Object.entries(gates?.cellMarks || {})) {
    if (!mark?.id || !WEEK_DUTY_STRIP_IDS.has(mark.id) || WEEK_DUTY_STRIP_SKIP_IDS.has(mark.id)) continue;
    const split = String(key).indexOf(":");
    if (split < 0) continue;
    const emp = byId.get(String(key.slice(0, split)));
    if (!emp) continue;
    if (!peopleByGate.has(mark.id)) peopleByGate.set(mark.id, new Map());
    peopleByGate.get(mark.id).set(String(emp.id), emp);
    const personGate = `${emp.id}:${mark.id}`;
    if (mark.hint) hintByKey.set(personGate, mark.hint);
    const dateKey = key.slice(split + 1);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && !dateByPersonGate.has(personGate)) {
      dateByPersonGate.set(personGate, dateKey);
    }
  }

  const cards = [];
  for (const check of gates?.checks || []) {
    if (!check || check.ok) continue;
    if (WEEK_DUTY_STRIP_SKIP_IDS.has(check.id) || !WEEK_DUTY_STRIP_IDS.has(check.id)) continue;
    const level = check.block ? "block" : "warn";
    let people = [...(peopleByGate.get(check.id)?.values() || [])];
    if (!people.length) {
      people = roster.filter((row) => row?.name && String(check.note || "").includes(row.name));
    }
    for (const emp of people) {
      cards.push({
        id: `${check.id}:${emp.id}`,
        gateId: check.id,
        employeeId: emp.id,
        name: emp.name,
        href: `/app/employees/${encodeURIComponent(emp.id)}`,
        level,
        glow: level === "block" ? "block" : "due",
        title: check.title,
        label: dutyStripRawLabel(emp, check, hintByKey.get(`${emp.id}:${check.id}`), ar),
        onDate: dateByPersonGate.get(`${emp.id}:${check.id}`) || null,
        decisionId: dutyStripDecisionId(check.id),
        ruleId: check.ruleId || null,
        requestsHref: (check.id === "night_rotate" || check.id === "night_medical")
          ? (audience === "employee" ? "/app/requests" : "/app/requests/manage")
          : "",
      });
    }
  }
  return presentDutyStrip({ cards }, { audience, employeeId, ar });
}

/** Keep the 3-month night-due rail, but never red-glow a satisfied written consent. */
export function attachNightDueStripCards(pack, nightGroups, {
  ar = true,
  audience = "manager",
  employeeId,
} = {}) {
  const cards = [...(pack?.cards || [])].map((card) => ({
    ...card,
    label: card.name ? `${card.name} — ${dutyStripBody(card.label || card.title, card.name)}` : (card.label || card.title),
  }));
  const haveRotate = new Set(
    cards.filter((row) => row.gateId === "night_rotate").map((row) => String(row.employeeId)),
  );
  for (const group of nightGroups || []) {
    for (const person of group.people || []) {
      if (!person?.id || haveRotate.has(String(person.id))) continue;
      const labels = person.labels || [];
      if (labels.length && labels.every((label) => NIGHT_CONSENT_ONLY_LABELS.has(label))) continue;
      const rotateDue = labels.some((label) => label === "دوران أو موافقة" || label === "Rotate or consent");
      const pending = labels.some((label) => label === "اختيار في طلباتي" || label === "Choice in Requests");
      if (labels.length && !rotateDue && !pending) continue;
      const level = rotateDue ? "block" : "warn";
      const title = ar ? "تدوير العامل الليلي بعد 3 أشهر" : "Rotate a night worker after 3 months";
      const extra = labels.length ? ` · ${labels.join(" · ")}` : "";
      cards.push({
        id: `night_rotate:${person.id}`,
        gateId: "night_rotate",
        employeeId: person.id,
        name: person.name,
        href: person.href || `/app/employees/${encodeURIComponent(person.id)}`,
        level,
        glow: level === "block" ? "block" : "due",
        title,
        label: `${person.name} — ${title}${extra}`,
        decisionId: "18632",
        ruleId: "hours.night.rotateWeeks",
        requestsHref: audience === "employee" ? "/app/requests" : "/app/requests/manage",
      });
      haveRotate.add(String(person.id));
    }
  }
  return presentDutyStrip({ cards }, { audience, employeeId, ar });
}

/** Person-level labour hours on the employee file — not station coverage. */
export const EMPLOYEE_FILE_HOUR_CHECK_IDS = [
  "hours_48",
  "hours_106",
  "workplace",
  "gap_11",
  "night_rest",
  "rest_5h",
  "weekly_rest",
  "night_rotate",
  "night_compensate",
  "night_performer_comp",
  "night_pregnancy",
  "night_medical",
  "night_facilities",
  "night_pay_equality",
  "night_consideration",
  "heat_ban",
  "heat_place",
  "ramadan",
  "official_holiday",
  "leave_excluded",
];

/** 18632 worker cards — only when THIS person is ≥3h in 23:00–06:00 (or a pending night consent). */
const FILE_NIGHT_WORKER_CHECK_IDS = new Set([
  "night_rotate",
  "night_compensate",
  "night_medical",
  "night_pay_equality",
  "night_consideration",
]);

/** 18632 performer cards — any minute in 23:00–06:00. Station compensation is not this. */
const FILE_NIGHT_PERFORM_CHECK_IDS = new Set([
  "night_rest",
  "night_performer_comp",
  "night_facilities",
]);

const FILE_NIGHT_PREGNANCY_CHECK_IDS = new Set(["night_pregnancy"]);

function hasPendingNightConsentOnFile(employee) {
  return (employee?.otherRequests || []).some((row) => (
    row?.type === "night_consent" && (row.status || "pending") === "pending"
  ));
}

/** This person's 18632 week — never the station `nightCompensation` flag. */
export function employeeWeekNightScope({ employee, schedule, weekStart } = {}) {
  const start = weekStartDate(weekStart || new Date());
  let performs = false;
  let worker = false;
  if (employee?.id) {
    for (const day of weekDays(start)) {
      if (isOnApprovedLeave(employee, day.key)) continue;
      const shift = employeeShiftOnDay(schedule, employee.id, day.key);
      if (!shift) continue;
      if (performsNightWork(shift, day.key)) performs = true;
      if (isNightWorker(shift, day.key)) worker = true;
    }
  }
  return { performs, worker, start };
}

function fileNightCheckInPersonScope(row, scope, employee) {
  if (!row?.ok) return true;
  if (FILE_NIGHT_WORKER_CHECK_IDS.has(row.id)) {
    return !!(scope.worker || hasPendingNightConsentOnFile(employee));
  }
  if (FILE_NIGHT_PERFORM_CHECK_IDS.has(row.id)) return !!scope.performs;
  if (FILE_NIGHT_PREGNANCY_CHECK_IDS.has(row.id)) return false;
  return true;
}

/** File checks speak about this person — never the station empty-night essay. */
function personalizeFileNightCheck(row, { scope, ar }) {
  if (!row || (!FILE_NIGHT_WORKER_CHECK_IDS.has(row.id) && !FILE_NIGHT_PERFORM_CHECK_IDS.has(row.id))) return row;
  if (!row.ok) return row;
  const emptyWatch = /لا عامل ليلي|No night worker/.test(String(row.note || ""));
  if (!emptyWatch) return row;
  if (row.id === "night_rotate" && scope.worker) {
    return { ...row, note: ar ? "هذا الملف ضمن مدة العامل الليلي هذا الأسبوع." : "This file is within the night-worker window this week." };
  }
  if (row.id === "night_compensate" && scope.worker) {
    return { ...row, note: ar ? "بدل أو تخفيض ساعات مسجّل على هذا الملف، أو ليلي عرضي مستثنى." : "Allowance, reduced hours, or an incidental exemption is on this file." };
  }
  if (row.id === "night_medical" && scope.worker) {
    return { ...row, note: ar ? "تقرير اللياقة الليلية محفوظ في الملف بتاريخ." : "The night-fitness report is dated and on this file." };
  }
  return row;
}

export function employeeFileLaborWeek({ employee, schedule, weekStart, ar = true, station, settings, company, laborCalendar, today = new Date() } = {}) {
  const start = weekStartDate(weekStart || new Date());
  const gates = checkWeekPublishGates({
    schedule: schedule || { shiftTypes: [], assignments: {} },
    employees: employee ? [employee] : [],
    weekStart: start,
    stationId: employee?.stationId,
    station,
    settings,
    company,
    laborCalendar,
    ar,
    today,
  });
  const pub = weekPublishState(schedule, start);
  const scope = employeeWeekNightScope({ employee, schedule, weekStart: start });
  const checks = (gates.checks || [])
    .filter((row) => EMPLOYEE_FILE_HOUR_CHECK_IDS.includes(row.id))
    .filter((row) => fileNightCheckInPersonScope(row, scope, employee))
    .map((row) => personalizeFileNightCheck(row, { scope, ar }));
  return {
    hours: employee ? employeeWeekHours(schedule, employee.id, start, employee) : 0,
    checks,
    blockers: checks.filter((row) => !row.ok && row.block),
    warnings: checks.filter((row) => !row.ok && !row.block),
    leaveDays: gates.leaveDays || 0,
    published: pub.kind === "published" || pub.kind === "implicit",
    weekStart: start,
    nightScope: scope,
  };
}

export function buildNightWatch({ schedule, employees, weekStart, stationId, ar = true, employeeId } = {}) {
  const days = weekDays(weekStart);
  const roster = weekRosterEmployees(schedule, employees, stationId, days.map((day) => day.key))
    .filter((employee) => !employeeId || String(employee.id) === String(employeeId));
  return roster
    .filter((employee) => days.some((day) => {
      if (isOnApprovedLeave(employee, day.key)) return false;
      return isNightShift(employeeShiftOnDay(schedule, employee.id, day.key), day.key);
    }))
    .map((employee) => {
      const weeks = nightStreakWeeks(schedule, employee.id, weekStart) + 1;
      const months = weeks <= 1 ? 0 : Math.round((weeks / 4.33) * 10) / 10;
      const over = weeks > (ruleValue("hours.night.rotateWeeks", days[0].key) || 13);
      const ok = hasNightConsent(employee, weekStart);
      const nightReq = (employee.otherRequests || []).find((row) => row.type === "night_consent" && (row.status || "pending") === "pending");
      const pending = !!nightReq;
      return {
        employee,
        weeks,
        months,
        over,
        pending,
        violation: pending && !ok,
        consented: ok,
        span: ar ? `${months} شهر متواصل` : `${months} continuous months`,
        color: over ? (ok ? SW.gold : SW.abs) : SW.green,
        note: over
          ? (ok
            ? (ar ? "موافقة خطية محفوظة مع حق التراجع في أي وقت. لا تجديد شهري واجب. التدوير لساعات عادية شهراً على الأقل يصفّر العدّ — أسبوع صباحي واحد لا يكفي." : "Written consent is on file with the right to withdraw at any time. Monthly renewal is not a legal duty. Rotation to ordinary hours for at least one month resets the clock — one morning week is not enough.")
            : (ar ? "سارية حتى يختار الموظف: موافقة خطية محفوظة (حق التراجع)، أو تقليص تحت 3 ساعات، أو تدوير لساعات عادية شهراً على الأقل. سكوت المدير لا يغلقها." : "In force until the worker chooses: written consent on file (right to withdraw), hours under 3 night hours, or rotation to ordinary hours for at least one month. Manager silence does not close it."))
          : (ar ? "ضمن المدة النظامية. بعد ثلاثة أشهر كعامل ليلي تُفتح الموافقة أو التدوير." : "Within the statutory window. After three months as a night worker, consent or rotation opens."),
      };
    });
}

/** Employee-file night board — only the open file, never the first night person on the station. */
export function employeeFileNightPanel({ employee, schedule, weekStart, ar = true } = {}) {
  if (!employee?.id) return { rows: [], names: [], text: "" };
  const rows = buildNightWatch({
    schedule,
    employees: [employee],
    weekStart,
    stationId: employeeWorkStationId(employee),
    ar,
    employeeId: String(employee.id),
  }).filter((row) => String(row.employee?.id) === String(employee.id));
  return {
    rows,
    names: rows.map((row) => row.employee?.name).filter(Boolean),
    text: rows.map((row) => [row.span, row.note].filter(Boolean).join(" ")).join("\n"),
  };
}

/**
 * What the employee-file hours / 18632 strip may print.
 * Coworkers on the same station never enter this copy.
 */
export function employeeFileHoursView({ employee, schedule, weekStart, ar = true, coworkers = [], station, settings, company, laborCalendar } = {}) {
  const panel = employeeFileNightPanel({ employee, schedule, weekStart, ar });
  const pack = employeeFileLaborWeek({ employee, schedule, weekStart, ar, station, settings, company, laborCalendar });
  const otherNames = (coworkers || [])
    .filter((row) => row?.id && String(row.id) !== String(employee?.id))
    .map((row) => String(row.name || "").trim())
    .filter(Boolean);
  const text = [
    panel.text,
    ...pack.checks.map((row) => `${row.title} ${row.note}`),
  ].join("\n");
  return {
    employeeId: employee?.id || null,
    nightRows: panel.rows,
    checks: pack.checks,
    hours: pack.hours,
    blockers: pack.blockers,
    warnings: pack.warnings,
    published: pack.published,
    text,
    hasCoworkerName: otherNames.some((name) => text.includes(name)),
  };
}

export function buildHistory({
  schedule,
  employees,
  stationId,
  fromKey,
  toKey,
  query = "",
  mode = "emp",
  today = new Date(),
  ar = true,
}) {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to) return { days: [], rows: [], dayRows: [], workDays: 0, skipped: 0 };
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const all = [];
  for (let cursor = start, guard = 0; cursor <= end && guard < 400; cursor = addDays(cursor, 1), guard += 1) {
    all.push({
      date: cursor,
      key: calendarDateKey(cursor),
      wd: cursor.getDay(),
      day: cursor.getDate(),
      month: cursor.getMonth(),
    });
  }
  const work = all.filter((day) => day.wd !== 5 && day.wd !== 6);
  const published = work.filter((day) => {
    const state = weekPublishState(schedule, day.date, today);
    return state.kind === "published" || state.kind === "implicit" || hasAnyAssignment(schedule, day.key);
  });
  const q = String(query || "").trim();
  const roster = weekRosterEmployees(schedule, employees, stationId, published.map((day) => day.key)).filter((employee) => !q || String(employee.name || "").includes(q));
  const types = schedule?.shiftTypes || [];
  const rows = roster.map((employee) => {
    const tally = {};
    let hours = 0;
    const cells = published.map((day) => {
      const leave = leaveOnDayView(employee, day.key, ar);
      if (leave) {
        tally.leave = (tally.leave || 0) + 1;
        return {
          mark: shiftHistMark(null, { ar, leave: true }),
          night: false,
          leave: true,
          bg: leave.style.bg,
          border: leave.style.color,
          color: leave.style.fg,
          tip: `${day.day} ${MONTHS_AR[day.month]} — ${ar ? "إجازة" : "Leave"} ${leave.type}${leave.article ? ` · ${leave.article}` : ""}`,
        };
      }
      const shift = employeeShiftOnDay(schedule, employee.id, day.key);
      if (shift) {
        tally[shift.id] = (tally[shift.id] || 0) + 1;
        hours += shiftHours(shift);
      }
      const style = shiftTypeStyle(shift, types.findIndex((row) => row.id === shift?.id));
      return {
        mark: shiftHistMark(shift, { ar }),
        night: !!(shift && isNightShift(shift, day.key)),
        bg: shift ? style.bg : "#fafbfc",
        border: shift ? style.color : "#eef0f4",
        color: shift ? style.fg : "#6b7280",
        tip: `${day.day} ${MONTHS_AR[day.month]} — ${shift ? shift.label : (ar ? "راحة" : "Rest")}`,
      };
    });
    const summary = types
      .filter((shift) => tally[shift.id])
      .map((shift) => `${shift.label} ${tally[shift.id]}`)
      .concat(tally.leave ? [`${ar ? "إجازة" : "Leave"} ${tally.leave}`] : [])
      .join(" · ");
    return {
      employee,
      name: employee.name,
      cells,
      hours: String(Math.round(hours)),
      summary: summary || (ar ? "لا وردية في المدى" : "No shift in range"),
    };
  });
  const dayRows = published.map((day) => {
    const groups = types.map((shift) => {
      const names = roster
        .filter((employee) => {
          if (isOnApprovedLeave(employee, day.key)) return false;
          return employeeShiftOnDay(schedule, employee.id, day.key)?.id === shift.id;
        })
        .map((employee) => employee.name);
      const style = shiftTypeStyle(shift, types.indexOf(shift));
      return names.length ? { name: shift.label, names: names.join(ar ? "، " : ", "), ...style } : null;
    }).filter(Boolean);
    return {
      label: `${weekdayLabel(day.wd, ar)} ${day.day} ${ar ? MONTHS_AR[day.month] : day.month + 1}`,
      count: groups.reduce((sum, group) => sum + group.names.split(ar ? "،" : ",").length, 0),
      empty: groups.length === 0,
      groups,
    };
  });
  return {
    days: published,
    rows,
    dayRows,
    workDays: published.length,
    skipped: work.length - published.length,
    mode,
    nightMarks: rows.reduce((sum, row) => sum + row.cells.filter((cell) => cell.night).length, 0),
  };
}
