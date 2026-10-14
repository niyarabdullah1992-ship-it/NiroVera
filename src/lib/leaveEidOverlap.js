/** Implementing regulations Art. 24(2) — Eid overlap as live judgment.
 *  Weekly rest inside Eid is compensated. Annual leave is extended (holidays
 *  are not charged). Sick leave still pays full wage on those days. National
 *  or Founding Day falling inside an Eid is not an extra day.
 */

import { addLaborDays, citeRule, laborDayKey } from "./laborRules.js";
import { isOfficialHoliday, officialHolidayOn } from "./ummAlQuraCalendar.js";

function postingOf(company) {
  return company?.hoursPolicy?.workPosting
    || company?.attendanceSettings?.hoursPolicy?.workPosting
    || company?.workPosting
    || {};
}

/** Art. 104 weekly rest weekday — Friday unless the establishment posted another. */
export function weeklyRestDowOf(company) {
  const n = Number(postingOf(company).weeklyRestDow);
  if (Number.isInteger(n) && n >= 0 && n <= 6) return n;
  return 5;
}

export const WEEKDAY_NAMES_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const WEEKDAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function countOneOrTwo(raw) {
  const n = Number(raw);
  if (n === 1 || n === 2) return n;
  return null;
}

/**
 * How many weekly off days apply to this person.
 * File override first, then establishment posting. Default two
 * (Art. 104 + company extra). One = six-day week — only the statutory rest.
 */
export function weeklyRestDayCountOf(company, employee) {
  const fromFile = countOneOrTwo(employee?.profile?.weeklyRestDayCount ?? employee?.weeklyRestDayCount);
  if (fromFile) return fromFile;
  const fromCompany = countOneOrTwo(postingOf(company).weeklyRestDayCount ?? postingOf(company).companyRestDays);
  return fromCompany || 2;
}

/** Weekdays that must not be charged against Article 109 for this employee. */
export function weeklyOffDows(company, employee) {
  const posting = postingOf(company);
  const listed = posting.weeklyOffDows || posting.companyRestDows;
  if (Array.isArray(listed) && listed.length) {
    return [...new Set(listed.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
  }
  const statutory = weeklyRestDowOf(company);
  if (weeklyRestDayCountOf(company, employee) <= 1) return [statutory];
  return [statutory, (statutory + 1) % 7];
}

export function isWeeklyOffDay(dateKey, company, employee) {
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (!y) return false;
  return weeklyOffDows(company, employee).includes(new Date(y, m - 1, d).getDay());
}

function scheduleForEmployee(company, employee) {
  const stationId = employee?.profile?.workStationId || employee?.stationId;
  if (stationId == null || String(stationId).trim() === "") return null;
  return (company?.schedules || []).find((row) => String(row.stationId) === String(stationId)) || null;
}

function assignmentMapOn(schedule, dateKey) {
  const assignments = schedule?.assignments || {};
  const dated = assignments[dateKey];
  if (dated && typeof dated === "object" && !Array.isArray(dated)) return dated;
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (!y) return null;
  const dow = new Date(y, m - 1, d).getDay();
  const weekly = assignments[dow] || assignments[String(dow)];
  return weekly && typeof weekly === "object" && !Array.isArray(weekly) ? weekly : null;
}

function employeeAssignedOn(schedule, employeeId, dateKey) {
  const day = assignmentMapOn(schedule, dateKey);
  if (!day || employeeId == null) return false;
  return (schedule?.shiftTypes || []).some((shift) => (day[shift.id] || []).includes(employeeId));
}

function nearbyDateKey(dateKey, delta) {
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (!y) return "";
  const next = new Date(y, m - 1, d + Number(delta));
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

function employeeHasRosterNearby(schedule, employeeId, dateKey) {
  for (let delta = -7; delta <= 7; delta += 1) {
    if (employeeAssignedOn(schedule, employeeId, nearbyDateKey(dateKey, delta))) return true;
  }
  return false;
}

/**
 * 4-on/4-off (and any painted rest): a rest cell on this person's roster
 * is not annual leave. A published duty cell is a work day even if it falls
 * on Friday or Saturday.
 */
export function employeeRosterDayKind(company, employee, dateKey) {
  const schedule = scheduleForEmployee(company, employee);
  if (!schedule || employee?.id == null) return "unknown";
  if (employeeAssignedOn(schedule, employee.id, dateKey)) return "duty";
  if (employeeHasRosterNearby(schedule, employee.id, dateKey)) return "rest";
  return "unknown";
}

/** Named rest days for this employee — first is Art. 104, second is company extra. */
export function weeklyOffLabels(company, employee, ar = true) {
  const names = ar ? WEEKDAY_NAMES_AR : WEEKDAY_NAMES_EN;
  const statutory = weeklyRestDowOf(company);
  return weeklyOffDows(company, employee).map((dow) => ({
    dow,
    kind: dow === statutory ? "law" : "company",
    name: names[dow] || String(dow),
    title: dow === statutory
      ? (ar ? `${names[dow]} — راحة نظامية (المادة 104)` : `${names[dow]} — statutory rest (Art. 104)`)
      : (ar ? `${names[dow]} — راحة الشركة` : `${names[dow]} — company rest`),
  }));
}

function isWeeklyRestOn(dateKey, company) {
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (!y) return false;
  return new Date(y, m - 1, d).getDay() === weeklyRestDowOf(company);
}

export function isEidHoliday(value, calendar) {
  const hit = officialHolidayOn(value, calendar);
  return hit?.id === "fitr" || hit?.id === "adha";
}

export function civicHolidayId(value) {
  const md = laborDayKey(value).slice(5);
  if (md === "09-23") return "national";
  if (md === "02-22") return "founding";
  return "";
}

/** Civic day absorbed into Eid — Art. 24(2): no extra compensation. */
export function mergeHolidayHit(eid, civic) {
  if (eid && civic) return { ...eid, absorbedCivic: civic.id };
  return eid || civic || null;
}

export function eachInclusiveDay(start, end, visit) {
  let cursor = laborDayKey(start);
  const last = laborDayKey(end);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cursor) || !/^\d{4}-\d{2}-\d{2}$/.test(last) || last < cursor) return 0;
  let n = 0;
  while (cursor && cursor <= last) {
    n += 1;
    visit?.(cursor);
    cursor = addLaborDays(cursor, 1);
  }
  return n;
}

export function officialHolidayDaysInRange(start, end, calendar) {
  let n = 0;
  eachInclusiveDay(start, end, (day) => {
    if (isOfficialHoliday(day, calendar)) n += 1;
  });
  return n;
}

export function eidDaysInRange(start, end, calendar) {
  let n = 0;
  eachInclusiveDay(start, end, (day) => {
    if (isEidHoliday(day, calendar)) n += 1;
  });
  return n;
}

export function weeklyRestDaysInsideEid(start, end, company, calendar) {
  const days = [];
  eachInclusiveDay(start, end, (day) => {
    if (isEidHoliday(day, calendar) && isWeeklyRestOn(day, company)) days.push(day);
  });
  return days;
}

/** Calendar span minus official holidays — Art. 24(2) extend / full-pay. */
export function chargeableSpanExcludingHolidays(startDate, endDate, calendar) {
  const start = laborDayKey(startDate);
  const end = laborDayKey(endDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return 0;
  return Math.max(0, eachInclusiveDay(start, end) - officialHolidayDaysInRange(start, end, calendar));
}

function isAnnualUnchargedRestDay(dateKey, company, employee) {
  const kind = employeeRosterDayKind(company, employee, dateKey);
  if (kind === "duty") return false;
  if (kind === "rest") return true;
  return isWeeklyOffDay(dateKey, company, employee);
}

/**
 * Annual leave (Art. 109) is 21 *work* days.
 * Duty cells on this person's roster are charged even on Friday/Saturday.
 * Roster rest (including 4-on/4-off), Art. 104, company weekly rest, and
 * official holidays are not charged.
 */
export function chargeableAnnualWorkDays(startDate, endDate, calendar, company, employee) {
  const start = laborDayKey(startDate);
  const end = laborDayKey(endDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return 0;
  let n = 0;
  eachInclusiveDay(start, end, (day) => {
    if (isOfficialHoliday(day, calendar)) return;
    if (isAnnualUnchargedRestDay(day, company, employee)) return;
    n += 1;
  });
  return n;
}

export function weeklyOffDaysInRange(start, end, company, employee) {
  const days = [];
  eachInclusiveDay(start, end, (day) => {
    if (isAnnualUnchargedRestDay(day, company, employee)) days.push(day);
  });
  return days;
}

export function deriveEidOverlap({ start, end, type, company, calendar, employee } = {}) {
  const from = laborDayKey(start);
  const to = laborDayKey(end);
  const cite = citeRule("leave.eid.overlap.cite", from) || citeRule("leave.eid.cite", from);
  const holidayDays = officialHolidayDaysInRange(from, to, calendar);
  const eidDays = eidDaysInRange(from, to, calendar);
  const restDays = weeklyRestDaysInsideEid(from, to, company, calendar);
  let civicAbsorbed = 0;
  eachInclusiveDay(from, to, (day) => {
    const hit = officialHolidayOn(day, calendar);
    if (hit?.absorbedCivic) civicAbsorbed += 1;
  });
  const key = String(type || "").trim().toLowerCase();
  return {
    cite,
    holidayDays,
    eidDays,
    civicAbsorbed,
    compensateRestDays: restDays.length,
    restDays,
    extendAnnualDays: key === "annual" ? holidayDays : 0,
    sickFullPayDays: key === "sick" ? holidayDays : 0,
    chargeable: key === "annual"
      ? chargeableAnnualWorkDays(from, to, calendar, company, employee)
      : chargeableSpanExcludingHolidays(from, to, calendar),
  };
}
