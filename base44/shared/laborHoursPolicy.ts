// deno-lint-ignore-file no-explicit-any
/**
 * Server twin of the parts of src/lib/laborHoursPolicy.js (and the helpers it leans on in
 * leaveEidOverlap.js, leaveTypes.js and shiftWeek.js) that the actual-duty read needs: the Art. 99 / 98
 * / Ramadan day cap, juveniles (Arts 161–164), Art. 108 categories (Regs Art. 23), the Art. 98 hours
 * basis, weekly off days, the Art. 154 nursing subject and the rostered actual hours (Art. 102).
 * Keep in lockstep with the client; parity is asserted by scripts/test-hours-followup.mjs.
 */
import { isRamadanDay, isRamadanHoursSubject, laborDayKey, laborDaysBetween, ruleValue } from "./laborRules.ts";
import { minutesBetween, shiftRestMinutes } from "./shiftDerivations.ts";

export function flagOn(value: any) {
  const s = String(value ?? "").trim().toLowerCase();
  return value === true || s === "1" || s === "true" || s === "yes" || s === "نعم";
}

export const HOURS_BASIS = ["daily", "weekly"];

export function hoursPolicyOf(company: any, employee?: any) {
  const bag = { ...(company?.hoursPolicy || {}), ...(company?.attendanceSettings?.hoursPolicy || {}) };
  const profile = employee?.profile || {};
  return {
    extendedNine: flagOn(profile.extendedNine) || flagOn(bag.extendedNine),
    hazardousHours: flagOn(profile.hazardousHours) || flagOn(bag.hazardousHours),
    continuousWork103: flagOn(bag.continuousWork103),
    hoursBasis: HOURS_BASIS.includes(bag.hoursBasis) ? bag.hoursBasis : "",
    workPosting: bag.workPosting || company?.workPosting || company?.attendanceSettings?.workPosting || {},
  };
}

/* ---------------- Art. 108 + Regs Art. 23 ---------------- */
const ART108_IDS = ["management", "preparatory", "intermittent", "guard", "cleaner"];

export function art108CategoryOf(employee: any) {
  const profile = employee?.profile || {};
  const raw = String(profile.hoursCategory108 || "").trim();
  if (ART108_IDS.includes(raw)) return { category: raw, legacy: false };
  return { category: "", legacy: flagOn(profile.hoursExempt108) };
}

export function art108Limits(employee: any, onDate: string, laborCalendar?: any): any {
  const { category } = art108CategoryOf(employee);
  if (!category) return null;
  const ramadan = isRamadanDay(onDate, laborCalendar) && isRamadanHoursSubject(employee);
  const week = ramadan ? ruleValue("hours.art108.ramadanWeekHours", onDate) : ruleValue("hours.art108.weekHours", onDate);
  if (category === "management") {
    return { category, dayHours: Infinity, weekHours: Infinity, workplaceHours: Infinity, consecutiveHours: null, dailyRestHours: null, extraDayMinutes: 0, ramadan };
  }
  if (category === "preparatory") {
    const extra = (ruleValue("hours.art108.prepMinutes", onDate) || 15) + (ruleValue("hours.art108.complementaryMinutes", onDate) || 15);
    const base = ramadan ? ruleValue("hours.ramadan.ordinaryHours", onDate) : ruleValue("hours.shift.ordinaryHours", onDate);
    const baseWeek = ramadan ? ruleValue("hours.ramadan.weekMaxHours", onDate) : ruleValue("hours.week.ordinaryMaxHours", onDate);
    return {
      category,
      dayHours: base + extra / 60,
      weekHours: baseWeek,
      workplaceHours: ruleValue("hours.workplace.maxHours", onDate),
      consecutiveHours: ruleValue("hours.rest.maxConsecutiveHours", onDate),
      dailyRestHours: null,
      extraDayMinutes: extra,
      ramadan,
    };
  }
  if (category === "intermittent") {
    const rest = ruleValue("hours.art108.intermittentDailyRestHours", onDate) || 10;
    return {
      category,
      dayHours: ramadan ? ruleValue("hours.art108.intermittentRamadanHours", onDate) : ruleValue("hours.art108.intermittentDayHours", onDate),
      weekHours: week,
      workplaceHours: 24 - rest,
      consecutiveHours: null,
      dailyRestHours: rest,
      extraDayMinutes: 0,
      ramadan,
    };
  }
  return {
    category,
    dayHours: ramadan ? ruleValue("hours.art108.guardRamadanHours", onDate) : ruleValue("hours.art108.guardDayHours", onDate),
    weekHours: week,
    workplaceHours: Infinity,
    consecutiveHours: category === "cleaner" ? ruleValue("hours.art108.cleanerConsecutiveHours", onDate) : null,
    dailyRestHours: null,
    extraDayMinutes: 0,
    ramadan,
  };
}

/* ---------------- Art. 98 basis ---------------- */
export function hoursBasisOf(company: any, employee: any, station?: any) {
  const own = String(employee?.profile?.hoursBasis || "").trim();
  if (HOURS_BASIS.includes(own)) return { basis: own, source: "employee" };
  const stationId = employee?.profile?.workStationId || employee?.stationId;
  const site = station || (stationId != null ? (company?.stations || []).find((row: any) => String(row?.id) === String(stationId)) : null);
  const fromSite = String(site?.hoursBasis || "").trim();
  if (HOURS_BASIS.includes(fromSite)) return { basis: fromSite, source: "station" };
  const policy = hoursPolicyOf(company);
  if (policy.hoursBasis) return { basis: policy.hoursBasis, source: "company" };
  return { basis: "", source: "" };
}

/* ---------------- juveniles (Art. 161) ---------------- */
export function ageYearsOn(employee: any, onDate: string) {
  const birth = String(employee?.profile?.birthDate || employee?.birthDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const years = laborDaysBetween(birth, laborDayKey(onDate)) / 365.25;
  return Number.isFinite(years) ? years : null;
}

export function isJuvenile(employee: any, onDate: string) {
  const years = ageYearsOn(employee, onDate);
  if (years == null) return false;
  return years >= ruleValue("hours.juvenile.minAgeYears", onDate) && years < ruleValue("hours.juvenile.maxAgeYears", onDate);
}

/** The day's ordinary cap: juvenile (164) → Art. 108 category → Ramadan (98) → Art. 99 → 8 h. */
export function ordinaryDayCap(employee: any, company: any, onDate: string, laborCalendar?: any) {
  if (isJuvenile(employee, onDate)) {
    if (isRamadanDay(onDate, laborCalendar) && isRamadanHoursSubject(employee)) return ruleValue("hours.juvenile.ramadanHours", onDate);
    return ruleValue("hours.juvenile.ordinaryHours", onDate);
  }
  const limits108 = art108Limits(employee, onDate, laborCalendar);
  if (limits108) return limits108.dayHours;
  if (isRamadanDay(onDate, laborCalendar) && isRamadanHoursSubject(employee)) return ruleValue("hours.ramadan.ordinaryHours", onDate);
  const policy = hoursPolicyOf(company, employee);
  if (policy.hazardousHours) return ruleValue("hours.art99.hazardousDayHours", onDate);
  if (policy.extendedNine) return ruleValue("hours.art99.extendedDayHours", onDate);
  return ruleValue("hours.shift.ordinaryHours", onDate);
}

/** The week's ordinary cap — twin of src/lib/laborHoursPolicy.js ordinaryWeekCap (98 / Ramadan / 108 / juvenile). */
export function ordinaryWeekCap(employee: any, company: any, onDate: string, laborCalendar?: any) {
  if (isJuvenile(employee, onDate)) return ordinaryDayCap(employee, company, onDate, laborCalendar) * 6;
  const limits108 = art108Limits(employee, onDate, laborCalendar);
  if (limits108) return limits108.weekHours;
  if (isRamadanDay(onDate, laborCalendar) && isRamadanHoursSubject(employee)) return ruleValue("hours.ramadan.weekMaxHours", onDate);
  return ruleValue("hours.week.ordinaryMaxHours", onDate);
}

/* ---------------- weekly off days (Art. 104) — twin of leaveEidOverlap.js ---------------- */
function postingOf(company: any) {
  return company?.hoursPolicy?.workPosting || company?.attendanceSettings?.hoursPolicy?.workPosting || company?.workPosting || {};
}
function fileOffDows(employee: any): number[] {
  const raw = employee?.profile?.weeklyOffDows;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6))].slice(0, 2) as number[];
}
function countOneOrTwo(raw: any) {
  const n = Number(raw);
  return n === 1 || n === 2 ? n : null;
}
function weeklyRestDowOf(company: any, employee: any) {
  const own = fileOffDows(employee);
  if (own.length) return own[0];
  const n = Number(postingOf(company).weeklyRestDow);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : 5;
}
function weeklyRestDayCountOf(company: any, employee: any) {
  const own = fileOffDows(employee);
  if (own.length) return own.length;
  const fromFile = countOneOrTwo(employee?.profile?.weeklyRestDayCount ?? employee?.weeklyRestDayCount);
  if (fromFile) return fromFile;
  const fromCompany = countOneOrTwo(postingOf(company).weeklyRestDayCount ?? postingOf(company).companyRestDays);
  return fromCompany || 2;
}
export function weeklyOffDows(company: any, employee: any): number[] {
  const own = fileOffDows(employee);
  if (own.length) return own;
  const posting = postingOf(company);
  const listed = posting.weeklyOffDows || posting.companyRestDows;
  if (Array.isArray(listed) && listed.length) {
    const days = [...new Set(listed.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6))] as number[];
    const fromFile = countOneOrTwo(employee?.profile?.weeklyRestDayCount ?? employee?.weeklyRestDayCount);
    return fromFile === 1 ? days.slice(0, 1) : days;
  }
  const statutory = weeklyRestDowOf(company, employee);
  if (weeklyRestDayCountOf(company, employee) <= 1) return [statutory];
  return [statutory, (statutory + 1) % 7];
}
function weekKeysAround(dateKey: string): string[] {
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (!y) return [];
  const start = new Date(y, m - 1, d - new Date(y, m - 1, d).getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  });
}
function assignedOn(schedule: any, employeeId: any, dateKey: string) {
  const assignments = schedule?.assignments || {};
  let day = assignments[dateKey];
  if (!day || typeof day !== "object" || Array.isArray(day)) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    day = assignments[dow] || assignments[String(dow)];
  }
  if (!day || typeof day !== "object" || Array.isArray(day)) return false;
  return (schedule?.shiftTypes || []).some((shift: any) => (day[shift.id] || []).includes(employeeId));
}
/** Twin of leaveEidOverlap.weekWorkedKeys: rostered or punched days of this person's week. */
export function weekWorkedKeys(company: any, employee: any, dateKey: string): string[] {
  const id = employee?.id;
  if (id == null) return [];
  return weekKeysAround(dateKey).filter((key) => (
    (company?.schedules || []).some((schedule: any) => assignedOn(schedule, id, key))
    || (company?.personalAttendance || []).some((row: any) => (
      String(row?.employeeId ?? row?.employee_id) === String(id)
      && String(row?.date || row?.dateKey || "").slice(0, 10) === key
      && (row?.checkInAt || row?.check_in_at)
    ))
  ));
}
/**
 * Twin of leaveEidOverlap.isRestDayWork — the file's rest-day count decides (Arts 104, 107): the week's
 * worked days past 7 − count are rest days worked. Pinned file weekdays, when set, decide by weekday.
 */
export function isEmployeeOffDay(dateKey: string, company: any, employee: any, workedKeys: string[] | null = null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return false;
  const fixed = fileOffDows(employee);
  if (fixed.length) {
    const [y, m, d] = dateKey.split("-").map(Number);
    return fixed.includes(new Date(y, m - 1, d).getDay());
  }
  const week = new Set(weekKeysAround(dateKey));
  const worked = [...new Set([...(Array.isArray(workedKeys) ? workedKeys : weekWorkedKeys(company, employee, dateKey)), dateKey])]
    .filter((key) => week.has(key))
    .sort();
  return worked.indexOf(dateKey) >= 7 - weeklyRestDayCountOf(company, employee);
}

/* ---------------- Art. 154 nursing subject — twin of leaveTypes.js ---------------- */
const dateOnly = (iso: any) => {
  const s = String(iso || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};
function addCalendarDays(iso: string, n: number) {
  const m = String(iso || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(n));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nursingMonthsUntil(birth: string, months: number) {
  if (!birth) return "";
  const [y, m, d] = birth.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last) - 1 || 0);
  return target.toISOString().slice(0, 10);
}
export function isNursingSubject(employee: any, onDate: string) {
  const profile = employee?.profile || {};
  const gender = String(profile.gender || "").toLowerCase();
  if (gender !== "female" && !gender.includes("أنث")) return false;
  const day = dateOnly(onDate) || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const ended = (employee?.leaveRequests || []).filter((r: any) => (
    String(r.type || "").toLowerCase() === "maternity" && r.status === "approved" && dateOnly(r.endDate) && dateOnly(r.endDate) < day
  ));
  if (!ended.length) return false;
  const lastLeave = [...ended].sort((a: any, b: any) => dateOnly(b.endDate).localeCompare(dateOnly(a.endDate)))[0];
  const birth = dateOnly(lastLeave.eventDate) || dateOnly(profile.childBirthDate) || addCalendarDays(dateOnly(lastLeave.endDate), -41);
  const until = dateOnly(profile.nursingUntil) || nursingMonthsUntil(birth, 24);
  return !!until && day <= until;
}

/* ---------------- rostered hours — twin of shiftWeek.js ---------------- */
export function shiftHours(shift: any) {
  if (!shift?.start || !shift?.end) return 0;
  return Math.round((minutesBetween(shift.start, shift.end) / 60) * 10) / 10;
}
/** Art. 102: rest is not actual work; Art. 154 nursing hour is. */
export function actualShiftHours(shift: any, onDate: string, employee: any) {
  const span = shiftHours(shift);
  if (!span) return 0;
  const consecMax = ruleValue("hours.rest.maxConsecutiveHours", onDate);
  const minRestMin = ruleValue("hours.rest.duringShiftMinutes", onDate);
  const recorded = shiftRestMinutes(shift);
  const restMin = recorded == null ? (span > consecMax ? minRestMin : 0) : recorded;
  const deducted = isNursingSubject(employee, onDate) ? Math.min(restMin, minRestMin) : restMin;
  return Math.max(0, Math.round((span - deducted / 60) * 10) / 10);
}
export function isTwelveStayDuty(shift: any, onDate: string) {
  const span = shiftHours(shift);
  return span > 0 && span === ruleValue("hours.workplace.maxHours", onDate);
}
