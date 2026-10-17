/**
 * Overtime computed and recorded automatically when a day closes (Arts 98, 104, 107; Regs Art. 22).
 *
 * deriveAutoOvertimeCore — pure arithmetic, twinned in base44/shared/autoOvertime.ts:
 *   - an official holiday, or the weekly rest day: every worked minute is overtime (Arts 104, 107(3));
 *   - otherwise the day's overtime (beyond the day cap: 8 h, Ramadan 6 h, Art. 99, Art. 108 category,
 *     or beyond the roster on the weekly criterion) PLUS what this day's ordinary minutes carry the
 *     week past its cap (48 h, Ramadan 36 h, Art. 108 category) — never counted twice.
 * dayOvertimeFor — the store's reading: deriveActualDuty for the day, the rostered rest day, the
 *   week's ordinary minutes before it (each earlier day read the same way; `weekRows` adds cloud
 *   rows the local store does not hold), the week cap.
 * Payment stays in the existing flow: hour + 50% (Art. 107) or compensatory leave by consent, the
 * 720 h cap and its consent (Regs Art. 22) — the decision is the manager's, never the platform's.
 */
import { citeRule, ruleValue } from "./laborRules.js";
import { isEmployeeOffDay, ordinaryWeekCap } from "./laborHoursPolicy.js";
import { deriveActualDuty } from "./actualDuty.js";
import { employeeOnCompressedTwelveWeek, employeeShiftOnDay, weekDateKeys, weekKeyFromDate, parseDateKey } from "./shiftWeek.js";
import { laborCalendarOf } from "./ummAlQuraCalendar.js";

/** Labels per kind — the article comes from the catalog. */
export const AUTO_OT_KINDS = Object.freeze({
  holiday: { ar: "عمل في عطلة رسمية", en: "Work on an official holiday", ruleId: "hours.ot.premium" },
  weekly_rest: { ar: "عمل في يوم الراحة الأسبوعية", en: "Work on the weekly rest day", ruleId: "hours.rest.weeklyHours" },
  beyond_day_cap: { ar: "فوق ساعات اليوم", en: "Beyond the day's hours", ruleId: "hours.shift.ordinaryHours" },
  beyond_roster: { ar: "فوق الوردية (المعيار الأسبوعي)", en: "Beyond the roster (weekly criterion)", ruleId: "hours.shift.ordinaryHours" },
  beyond_week_cap: { ar: "فوق ساعات الأسبوع", en: "Beyond the week's hours", ruleId: "hours.week.ordinaryMaxHours" },
});

/**
 * @param {object} i
 * @param {number} i.workedMinutes          worked (presence − rest, Art. 102)
 * @param {number} i.dayOvertimeMinutes     beyond the day cap / roster (deriveActualDuty)
 * @param {string} [i.dayKind]              deriveActualDuty's kind
 * @param {boolean} [i.holiday]             official holiday
 * @param {boolean} [i.restDay]             the weekly rest day (rostered or not)
 * @param {number} [i.weekPriorOrdinaryMinutes] ordinary minutes this week before this day
 * @param {number} [i.weekCapMinutes]       the week's ordinary cap (Infinity = none)
 * @returns {{ overtimeMinutes, ordinaryMinutes, dayMinutes, weekMinutes, kind }}
 */
export function deriveAutoOvertimeCore({
  workedMinutes = 0,
  dayOvertimeMinutes = 0,
  dayKind = "",
  holiday = false,
  restDay = false,
  weekPriorOrdinaryMinutes = 0,
  weekCapMinutes = Infinity,
} = {}) {
  const worked = Math.max(0, Math.round(Number(workedMinutes) || 0));
  if (holiday) return { overtimeMinutes: worked, ordinaryMinutes: 0, dayMinutes: worked, weekMinutes: 0, kind: worked ? "holiday" : "" };
  if (restDay) return { overtimeMinutes: worked, ordinaryMinutes: 0, dayMinutes: worked, weekMinutes: 0, kind: worked ? "weekly_rest" : "" };
  const day = Math.min(worked, Math.max(0, Math.round(Number(dayOvertimeMinutes) || 0)));
  const ordinaryToday = worked - day;
  const prior = Math.max(0, Number(weekPriorOrdinaryMinutes) || 0);
  const cap = Number.isFinite(Number(weekCapMinutes)) ? Math.max(0, Number(weekCapMinutes)) : Infinity;
  const week = Number.isFinite(cap) ? Math.max(0, Math.min(ordinaryToday, prior + ordinaryToday - cap)) : 0;
  const kind = day > 0 ? (dayKind || "beyond_day_cap") : week > 0 ? "beyond_week_cap" : "";
  return { overtimeMinutes: day + week, ordinaryMinutes: ordinaryToday - week, dayMinutes: day, weekMinutes: week, kind };
}

function closedRowOn(d, employeeId, dayKey, extraRows = []) {
  return [...(extraRows || []), ...(d?.personalAttendance || [])].find((row) => (
    String(row.employeeId ?? row.employee_id) === String(employeeId)
    && String(row.date || row.dateKey || "").slice(0, 10) === dayKey
    && (row.checkInAt || row.check_in_at)
    && (row.checkOutAt || row.check_out_at)
  )) || null;
}

/** The rostered shift this person holds that day (their own station first) and its schedule. */
function rosterOn(d, employee, dayKey) {
  const own = String(employee?.profile?.workStationId || employee?.stationId || "");
  const list = [...(d?.schedules || [])].sort((a, b) => (String(b.stationId) === own) - (String(a.stationId) === own));
  for (const schedule of list) {
    const shift = employeeShiftOnDay(schedule, employee.id, dayKey);
    if (shift) return { shift, schedule };
  }
  return { shift: null, schedule: null };
}

/** A rostered shift on the declared weekly rest day — the roster's own reading (not a compressed 12h week). */
export function isRosteredRestDay(d, employee, dayKey, shift, schedule) {
  if (!shift || !isEmployeeOffDay(dayKey, d, employee)) return false;
  const week = weekKeyFromDate(parseDateKey(dayKey) || new Date());
  return !(schedule && employeeOnCompressedTwelveWeek(schedule, employee, week));
}

/** One closed day read for overtime, with the week before it given. */
function readDay(d, employee, dayKey, row, priorOrdinary, calendar, rosterGiven) {
  const { shift, schedule } = rosterGiven || rosterOn(d, employee, dayKey);
  const actual = deriveActualDuty({
    checkIn: row.checkInAt || row.check_in_at,
    checkOut: row.checkOutAt || row.check_out_at,
    shift,
    onDate: dayKey,
    employee,
    company: d,
    laborCalendar: calendar,
    breaks: row.breaks,
  });
  if (!actual.ok) return { actual, auto: null };
  const capHours = ordinaryWeekCap(employee, d, dayKey, calendar);
  const auto = deriveAutoOvertimeCore({
    workedMinutes: actual.workedMinutes,
    dayOvertimeMinutes: actual.overtimeMinutes,
    dayKind: actual.kind,
    holiday: actual.holiday,
    restDay: actual.offDay || isRosteredRestDay(d, employee, dayKey, shift, schedule),
    weekPriorOrdinaryMinutes: priorOrdinary,
    weekCapMinutes: Number.isFinite(capHours) ? Math.round(capHours * 60) : Infinity,
  });
  return { actual, auto, shift };
}

/** Ordinary minutes this week before `dayKey` — each earlier closed day read in order. */
export function weekOrdinaryBefore(d, employee, dayKey, { weekRows = [] } = {}) {
  const calendar = laborCalendarOf(d);
  let running = 0;
  for (const key of weekDateKeys(dayKey)) {
    if (key >= dayKey) break;
    const row = closedRowOn(d, employee.id, key, weekRows);
    if (!row) continue;
    const { auto } = readDay(d, employee, key, row, running, calendar);
    if (auto) running += auto.ordinaryMinutes;
  }
  return running;
}

/**
 * The day's overtime as it is recorded: { ok, actual, overtimeMinutes, dayMinutes, weekMinutes, kind,
 * holiday, article, ramadan } — or deriveActualDuty's refusal while the day is open.
 */
export function dayOvertimeFor(d, employee, dayKey, row, { weekRows = [], weekPriorOrdinaryMinutes = null } = {}) {
  const calendar = laborCalendarOf(d);
  // The server's own count of the week (its attendance rows, the shared twin) wins when it is given.
  const prior = Number.isFinite(Number(weekPriorOrdinaryMinutes)) && weekPriorOrdinaryMinutes !== null
    ? Math.max(0, Number(weekPriorOrdinaryMinutes))
    : weekOrdinaryBefore(d, employee, dayKey, { weekRows });
  const { actual, auto } = readDay(d, employee, dayKey, row, prior, calendar);
  if (!auto) return actual;
  const meta = AUTO_OT_KINDS[auto.kind] || null;
  const cite = meta ? citeRule(meta.ruleId, dayKey) : null;
  return {
    ok: true,
    actual,
    overtimeMinutes: auto.overtimeMinutes,
    ordinaryMinutes: auto.ordinaryMinutes,
    dayMinutes: auto.dayMinutes,
    weekMinutes: auto.weekMinutes,
    kind: auto.kind,
    holiday: actual.holiday === true,
    restDay: auto.kind === "weekly_rest",
    article: cite?.article || "",
    payArticle: citeRule("hours.ot.premium", dayKey)?.article || "",
    premium: ruleValue("hours.ot.premium", dayKey),
  };
}

/** «1:30» — minutes as hours:minutes. */
export function otClock(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * The employee's one quiet line after checkout: «إضافي اليوم 1:30 — سُجّل تلقائياً (المادة 107) ·
 * بانتظار قرار الأجر/الإجازة». Reads the recorded otDecisions entry; null when the day has none.
 */
export function autoOvertimeLine(entry, { ar = true, onDate } = {}) {
  if (!entry || !(Number(entry.overtimeMinutes) > 0) || entry.source !== "actual_punch") return null;
  const art = citeRule("hours.ot.premium", onDate)?.article || "";
  const open = entry.decision === "pending" || entry.decision === "pending_worker_cap_consent";
  const status = !open
    ? (entry.decision === "comp_leave" ? (ar ? "قُرّرت إجازة تعويضية" : "Compensatory leave decided") : (ar ? "قُرّر الأجر" : "Pay decided"))
    : entry.decision === "pending_worker_cap_consent"
      ? (ar ? "بانتظار موافقتك على تجاوز الحد السنوي" : "Awaiting your consent past the annual cap")
      : (ar ? "بانتظار قرار الأجر/الإجازة" : "Awaiting the pay / leave decision");
  return {
    minutes: Number(entry.overtimeMinutes),
    clock: otClock(entry.overtimeMinutes),
    article: art,
    open,
    textAr: `إضافي اليوم ${otClock(entry.overtimeMinutes)} — سُجّل تلقائياً (المادة ${art}) · ${status}`,
    textEn: `Overtime today ${otClock(entry.overtimeMinutes)} — recorded automatically (Art. ${art}) · ${status}`,
    status,
  };
}
