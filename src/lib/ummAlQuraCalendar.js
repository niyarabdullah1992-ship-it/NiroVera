/** Official holidays from encoded Umm al-Qura starts — never guess the last Ramadan day. */

import {
  addLaborDays,
  announcedRamadanFrom,
  announcedRamadanLength,
  announcedRamadanStartShift,
  isRamadanDay,
  laborDayKey,
  lastRamadanDay,
  ramadanWindowOn,
  RAMADAN_WINDOWS,
  ruleValue,
} from "./laborRules.js";

/** Operational Arafah Gregorian dates (Umm al-Qura), same honesty as Ramadan starts. */
export const ARAFAH_DAYS = [
  { from: "2025-06-05" },
  { from: "2026-05-26" },
  { from: "2027-05-16" },
  { from: "2028-05-04" },
];

export { isRamadanDay, ramadanWindowOn, lastRamadanDay, announcedRamadanLength };

export function laborCalendarOf(data) {
  return data?.laborCalendar || data?.settings?.laborCalendar || {};
}

export function ramadanWindowForYear(year) {
  const y = Number(year);
  return RAMADAN_WINDOWS.find((w) => Number(String(w.from).slice(0, 4)) === y) || null;
}

export function ramadanAnnouncementOf(year, calendar) {
  const win = ramadanWindowForYear(year);
  const length = announcedRamadanLength(win, calendar);
  const startShift = announcedRamadanStartShift(win, calendar);
  const from = announcedRamadanFrom(win, calendar);
  const fromCompany = calendar?.[year] || calendar?.[String(year)] || null;
  return {
    year: Number(year),
    window: win,
    predictedFrom: win?.from || "",
    from,
    startShift,
    startPending: !!win && startShift == null,
    length,
    pending: !!win && length == null,
    announcedAt: fromCompany?.announcedAt || null,
    announcedBy: fromCompany?.announcedBy || null,
    startAnnouncedAt: fromCompany?.startAnnouncedAt || null,
    startAnnouncedBy: fromCompany?.startAnnouncedBy || null,
    lastDay: win ? lastRamadanDay(win, calendar) : "",
    day30: from ? addLaborDays(from, 29) : "",
  };
}

export function eidFitrSpan(year, calendar) {
  const win = ramadanWindowForYear(year);
  if (!win) return null;
  const last = lastRamadanDay(win, calendar);
  const from = addLaborDays(last, 1);
  const days = ruleValue("leave.eid.fitrDays", from);
  return {
    id: "fitr",
    from,
    to: addLaborDays(from, days - 1),
    days,
    locked: announcedRamadanLength(win, calendar) != null,
  };
}

export function eidAdhaSpan(year) {
  const row = ARAFAH_DAYS.find((w) => Number(String(w.from).slice(0, 4)) === Number(year));
  if (!row) return null;
  const days = ruleValue("leave.eid.adhaDays", row.from);
  return {
    id: "adha",
    from: row.from,
    to: addLaborDays(row.from, days - 1),
    days,
    locked: true,
  };
}

function civicHolidayOnDay(day) {
  const md = String(day || "").slice(5);
  if (md === "09-23") {
    return { id: "national", from: day, to: day, days: ruleValue("leave.nationalDay.days", day) };
  }
  if (md === "02-22") {
    return { id: "founding", from: day, to: day, days: ruleValue("leave.foundingDay.days", day) };
  }
  return null;
}

function eidHolidayOnDay(day, calendar) {
  const year = Number(String(day || "").slice(0, 4));
  const fitr = eidFitrSpan(year, calendar) || eidFitrSpan(year - 1, calendar);
  if (fitr && fitr.from <= day && day <= fitr.to) return fitr;
  const adha = eidAdhaSpan(year) || eidAdhaSpan(year - 1);
  if (adha && adha.from <= day && day <= adha.to) return adha;
  return null;
}

export function officialHolidayOn(value, calendar) {
  const day = laborDayKey(value);
  const eid = eidHolidayOnDay(day, calendar);
  const civic = civicHolidayOnDay(day);
  if (eid && civic) return { ...eid, absorbedCivic: civic.id };
  return eid || civic || null;
}

export function isOfficialHoliday(value, calendar) {
  return !!officialHolidayOn(value, calendar);
}

/** Art. 72: count calendar days after `from`, skipping official holidays. */
export function countDaysExcludingOfficialHolidays(from, to, calendar) {
  const start = laborDayKey(from);
  const end = laborDayKey(to);
  if (!start || !end || end <= start) return 0;
  let count = 0;
  let cursor = addLaborDays(start, 1);
  while (cursor && cursor <= end) {
    if (!isOfficialHoliday(cursor, calendar)) count += 1;
    cursor = addLaborDays(cursor, 1);
  }
  return count;
}

/** Inclusive span skipping official holidays — Art. 72 clocks, not annual-leave balance. */
export function countInclusiveDaysExcludingOfficialHolidays(from, to, calendar) {
  const start = laborDayKey(from);
  const end = laborDayKey(to);
  if (!start || !end || end < start) return 0;
  let count = 0;
  let cursor = start;
  while (cursor && cursor <= end) {
    if (!isOfficialHoliday(cursor, calendar)) count += 1;
    cursor = addLaborDays(cursor, 1);
  }
  return count;
}

export function officialHolidayList(onDate, calendar) {
  const day = laborDayKey(onDate);
  const year = Number(day.slice(0, 4));
  const next = (month, date) => {
    const here = `${year}-${month}-${date}`;
    return here >= day ? here : `${year + 1}-${month}-${date}`;
  };
  const national = next("09", "23");
  const founding = next("02", "22");
  const fitrYear = eidFitrSpan(year, calendar)?.from >= day ? year : year + 1;
  const adhaYear = eidAdhaSpan(year)?.from >= day ? year : year + 1;
  const fitr = eidFitrSpan(fitrYear, calendar);
  const adha = eidAdhaSpan(adhaYear);
  return [
    {
      id: "national",
      ar: "اليوم الوطني",
      en: "National Day",
      from: national,
      to: national,
      days: ruleValue("leave.nationalDay.days", national),
      noteAr: "يوم واحد — أول يوم من برج الميزان حسب أم القرى",
      noteEn: "One day — first day of Libra on the Umm al-Qura calendar",
    },
    {
      id: "founding",
      ar: "يوم التأسيس",
      en: "Founding Day",
      from: founding,
      to: founding,
      days: ruleValue("leave.foundingDay.days", founding),
      noteAr: "يوم واحد — 22 فبراير",
      noteEn: "One day — 22 February",
    },
    {
      id: "fitr",
      ar: "عيد الفطر",
      en: "Eid al-Fitr",
      from: fitr?.from || "",
      to: fitr?.to || "",
      days: fitr?.days || ruleValue("leave.eid.fitrDays", day),
      locked: !!fitr?.locked,
      noteAr: fitr?.locked
        ? "أربعة أيام تبدأ من اليوم التالي لآخر يوم رمضان بعد إعلان 29 أو 30"
        : "أربعة أيام بعد آخر يوم رمضان — اليوم 30 معلّق حتى إعلان أم القرى",
      noteEn: fitr?.locked
        ? "Four days starting the day after the last Ramadan day once 29 or 30 is announced"
        : "Four days after the last Ramadan day — day 30 waits for the Umm al-Qura announcement",
    },
    {
      id: "adha",
      ar: "عيد الأضحى",
      en: "Eid al-Adha",
      from: adha?.from || "",
      to: adha?.to || "",
      days: adha?.days || ruleValue("leave.eid.adhaDays", day),
      noteAr: "أربعة أيام تبدأ من يوم الوقوف بعرفة",
      noteEn: "Four days starting on the Day of Arafah",
    },
  ];
}
