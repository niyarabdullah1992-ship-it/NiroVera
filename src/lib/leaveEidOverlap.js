/** Implementing regulations Art. 24(2) — Eid overlap as live judgment.
 *  Weekly rest inside Eid is compensated. Annual leave is extended (holidays
 *  are not charged). Sick leave still pays full wage on those days. National
 *  or Founding Day falling inside an Eid is not an extra day.
 */

import { addLaborDays, citeRule, laborDayKey } from "./laborRules.js";
import { isOfficialHoliday, officialHolidayOn } from "./ummAlQuraCalendar.js";

function weeklyRestDowOf(company) {
  const raw = company?.hoursPolicy?.workPosting?.weeklyRestDow
    ?? company?.attendanceSettings?.hoursPolicy?.workPosting?.weeklyRestDow
    ?? company?.workPosting?.weeklyRestDow;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 0 && n <= 6) return n;
  return 5;
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

export function deriveEidOverlap({ start, end, type, company, calendar } = {}) {
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
    chargeable: chargeableSpanExcludingHolidays(from, to, calendar),
  };
}
