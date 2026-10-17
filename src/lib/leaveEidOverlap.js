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

/**
 * The rest days HR set on this person's file (0 = Sunday … 6 = Saturday): the first is the Art. 104 day,
 * the second (optional) the company rest. Empty → the establishment default applies.
 */
export function fileOffDows(employee) {
  const raw = employee?.profile?.weeklyOffDows;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].slice(0, 2);
}

/** Art. 104 weekly rest weekday — the file's first rest day, else the establishment's, else Friday. */
export function weeklyRestDowOf(company, employee) {
  const own = fileOffDows(employee);
  if (own.length) return own[0];
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
  const own = fileOffDows(employee);
  if (own.length) return own.length;
  const fromFile = countOneOrTwo(employee?.profile?.weeklyRestDayCount ?? employee?.weeklyRestDayCount);
  if (fromFile) return fromFile;
  const fromCompany = countOneOrTwo(postingOf(company).weeklyRestDayCount ?? postingOf(company).companyRestDays);
  return fromCompany || 2;
}

/** Weekdays that must not be charged against Article 109 for this employee. */
export function weeklyOffDows(company, employee) {
  const own = fileOffDows(employee);
  if (own.length) return own;
  const posting = postingOf(company);
  const listed = posting.weeklyOffDows || posting.companyRestDows;
  if (Array.isArray(listed) && listed.length) {
    const days = [...new Set(listed.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
    // A file set to one rest day keeps only the statutory (first) day the management chose.
    const fromFile = countOneOrTwo(employee?.profile?.weeklyRestDayCount ?? employee?.weeklyRestDayCount);
    return fromFile === 1 ? days.slice(0, 1) : days;
  }
  const statutory = weeklyRestDowOf(company);
  if (weeklyRestDayCountOf(company, employee) <= 1) return [statutory];
  return [statutory, (statutory + 1) % 7];
}

/** Sunday-start week of a date key — the roster's week. */
function weekKeysAround(dateKey) {
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (!y) return [];
  const start = new Date(y, m - 1, d - new Date(y, m - 1, d).getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  });
}

/** Days of this person's week that hold work: a rostered shift (any branch) or a punched check-in. */
export function weekWorkedKeys(company, employee, dateKey) {
  const id = employee?.id;
  if (id == null) return [];
  const keys = weekKeysAround(dateKey);
  return keys.filter((key) => (
    (company?.schedules || []).some((schedule) => employeeAssignedOn(schedule, id, key))
    || (company?.personalAttendance || []).some((row) => (
      String(row?.employeeId ?? row?.employee_id) === String(id)
      && String(row?.date || row?.dateKey || "").slice(0, 10) === key
      && (row?.checkInAt || row?.check_in_at)
    ))
  ));
}

/**
 * Is work on `dateKey` work on a weekly rest day (Arts 104, 107)? The file is the criterion: HR sets how
 * many rest days this person has (the statutory day alone, or with the company day), not which weekday.
 * So the week's worked days past 7 − that count are the rest days worked — never "Friday" or "Saturday"
 * by name. Only when HR pinned weekdays on the file (`weeklyOffDows`) does the weekday decide.
 */
export function isRestDayWork(dateKey, company, employee, workedKeys = null) {
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
  const allowed = 7 - weeklyRestDayCountOf(company, employee);
  const excess = worked.length - allowed;
  if (excess <= 0) return false;
  // Which worked days were the rest days: his usual rest weekdays first (a mid-week rest is a Tuesday),
  // then the latest days of the week.
  const usual = rosterRestDows(company, employee, dateKey) || [];
  const dowOf = (key) => { const [yy, mm, dd] = key.split("-").map(Number); return new Date(yy, mm - 1, dd).getDay(); };
  const ranked = [...worked].sort((a, b) => (usual.includes(dowOf(b)) - usual.includes(dowOf(a))) || (b < a ? -1 : b > a ? 1 : 0));
  return ranked.slice(0, excess).includes(dateKey);
}

/**
 * The weekdays this person's own roster keeps as rest — read from the weeks around `dateKey` (±3): a weekday
 * left empty in most of the weeks he is rostered. So a rest day in mid-week (a Tuesday) is his rest day,
 * not Friday by name. Capped at the file's count; null when the roster says nothing.
 */
export function rosterRestDows(company, employee, dateKey) {
  const id = employee?.id;
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (id == null || !y || !(company?.schedules || []).length) return null;
  const tally = new Array(7).fill(0);
  let weeks = 0;
  for (let w = -3; w <= 3; w += 1) {
    const at = new Date(y, m - 1, d + w * 7);
    const keys = weekKeysAround(`${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`);
    const on = keys.map((key) => (company.schedules || []).some((schedule) => employeeAssignedOn(schedule, id, key)));
    if (!on.some(Boolean)) continue;
    weeks += 1;
    on.forEach((assigned, dow) => { if (!assigned) tally[dow] += 1; });
  }
  if (!weeks) return null;
  const count = weeklyRestDayCountOf(company, employee);
  const dows = tally
    .map((n, dow) => ({ dow, n }))
    .filter((row) => row.n * 2 >= weeks)
    .sort((a, b) => b.n - a.n || a.dow - b.dow)
    .slice(0, count)
    .map((row) => row.dow);
  return dows.length ? dows : null;
}

/**
 * The roster against the file's rest count for one week: `worked` duty days leave `rosterRest` rest days;
 * when that is fewer than the file's count, `extra` days of the week are rest days worked (all overtime,
 * Art. 107). Not a ban — the roster may ask it — but it must not pass unseen.
 */
export function restCountMismatch(company, employee, workedCount) {
  const fileRest = weeklyRestDayCountOf(company, employee);
  const worked = Math.max(0, Math.min(7, Number(workedCount) || 0));
  const rosterRest = 7 - worked;
  const extra = Math.max(0, fileRest - rosterRest);
  return { fileRest, rosterRest, worked, extra, mismatch: extra > 0 };
}

export function isWeeklyOffDay(dateKey, company, employee) {
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (!y) return false;
  const dow = new Date(y, m - 1, d).getDay();
  if (!fileOffDows(employee).length) {
    const own = rosterRestDows(company, employee, dateKey);
    if (own) return own.includes(dow);
  }
  return weeklyOffDows(company, employee).includes(dow);
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
  const statutory = weeklyRestDowOf(company, employee);
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

/**
 * Day by day, what an annual-leave span does to the balance (Art. 109 — work days only):
 *   charge      a work day — taken from the balance
 *   dutyOnRest  a published shift on what would be his weekly rest — a work day, taken
 *   law         his Art. 104 rest day — not taken
 *   company     his company rest day — not taken
 *   cycle       a rest cell of his roster cycle (e.g. 4-on/4-off) — not taken
 *   holiday     an official holiday — not taken; the leave is extended
 */
export function annualDayBreakdown(startDate, endDate, calendar, company, employee) {
  const start = laborDayKey(startDate);
  const end = laborDayKey(endDate);
  const days = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return { days, counts: {}, charged: 0, calendarDays: 0 };
  const statutory = weeklyRestDowOf(company, employee);
  eachInclusiveDay(start, end, (key) => {
    const [y, m, d] = key.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    const holiday = officialHolidayOn(key, calendar);
    let kind;
    if (holiday) kind = "holiday";
    else {
      const roster = employeeRosterDayKind(company, employee, key);
      const weekly = isWeeklyOffDay(key, company, employee);
      if (roster === "duty") kind = weekly && !rosterRestDows(company, employee, key) ? "dutyOnRest" : "charge";
      else if (roster === "rest") {
        // His own rest weekdays from the roster: the statutory one is the establishment's day when it is
        // among them, else the first of them (a mid-week rest pair is still «نظامي + شركة»).
        const own = rosterRestDows(company, employee, key);
        const law = own ? (own.includes(statutory) ? statutory : own[0]) : statutory;
        kind = weekly ? (dow === law ? "law" : "company") : "cycle";
      }
      else if (weekly) kind = dow === statutory ? "law" : "company";
      else kind = "charge";
    }
    days.push({ key, dow, kind, holiday: holiday || null });
  });
  const counts = days.reduce((acc, day) => ({ ...acc, [day.kind]: (acc[day.kind] || 0) + 1 }), {});
  return { days, counts, charged: (counts.charge || 0) + (counts.dutyOnRest || 0), calendarDays: days.length };
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
