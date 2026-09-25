/** Official holidays from encoded Umm al-Qura starts — never guess the last Ramadan day. */

import {
  addLaborDays,
  announcedRamadanFrom,
  announcedRamadanLength,
  announcedRamadanStartShift,
  isRamadanDay,
  laborDayKey,
  lastRamadanDay,
  ownerHolidayBag,
  ownerRamadanRuling,
  ramadanWindowOn,
  RAMADAN_WINDOWS,
  rulingCivicDate,
  rulingEidSpan,
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

/** Platform لوحة المالك rulings — apply to every company calendar. */
const PLATFORM_OWNER_KEY = "powercare_platform_owner";
let platformOwnerMemory = null;

export function readPlatformOwnerBoard() {
  if (platformOwnerMemory && typeof platformOwnerMemory === "object") return { ...platformOwnerMemory };
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = JSON.parse(localStorage.getItem(PLATFORM_OWNER_KEY) || "null");
    return raw && typeof raw === "object" ? raw : null;
  } catch {
    return null;
  }
}

export function writePlatformOwnerBoard(next) {
  const bag = next && typeof next === "object" ? { ...next } : {};
  platformOwnerMemory = bag;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(PLATFORM_OWNER_KEY, JSON.stringify(bag));
    } catch {
      /* ignore quota */
    }
  }
  return bag;
}

/** Test-only — clear or inject platform owner rulings without localStorage. */
export function setPlatformOwnerBoardForTest(bag) {
  platformOwnerMemory = bag && typeof bag === "object" ? { ...bag } : null;
}

export function laborCalendarOf(data) {
  const base = { ...(data?.laborCalendar || data?.settings?.laborCalendar || {}) };
  const companyHolidays = data?.settings?.ownerBoard?.holidays;
  const platform = readPlatformOwnerBoard();
  const holidays = {
    ...(base.ownerHolidays || {}),
    ...(companyHolidays && typeof companyHolidays === "object" ? companyHolidays : {}),
    ...(platform?.holidays && typeof platform.holidays === "object" ? platform.holidays : {}),
  };
  if (Object.keys(holidays).length) base.ownerHolidays = holidays;
  const ramadanYears = platform?.ramadan && typeof platform.ramadan === "object" ? platform.ramadan : null;
  if (ramadanYears) {
    for (const [year, row] of Object.entries(ramadanYears)) {
      if (!row || typeof row !== "object") continue;
      base[year] = { ...(base[year] || {}), ...row };
    }
  }
  return base;
}

export function ramadanWindowForYear(year) {
  const y = Number(year);
  return RAMADAN_WINDOWS.find((w) => Number(String(w.from).slice(0, 4)) === y) || null;
}

export function ramadanAnnouncementOf(year, calendar) {
  const win = ramadanWindowForYear(year);
  const ruling = ownerRamadanRuling(calendar, year);
  const length = ruling?.ok && (ruling.length === 29 || ruling.length === 30)
    ? ruling.length
    : announcedRamadanLength(win, calendar);
  const startShift = announcedRamadanStartShift(win, calendar);
  const from = ruling?.ok && ruling.from ? ruling.from : announcedRamadanFrom(win, calendar);
  const fromCompany = calendar?.[year] || calendar?.[String(year)] || null;
  return {
    year: Number(year),
    window: win,
    predictedFrom: win?.from || "",
    from,
    startShift,
    startPending: !!win && !(ruling && ruling.ok) && startShift == null,
    length,
    pending: !!win && length == null,
    ownerRuled: !!(ruling && ruling.ok),
    ownerGate: ruling && ruling.ok === false ? ruling : null,
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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function holidayTitle(id, ar, calendar, fallbackAr, fallbackEn) {
  const row = ownerHolidayBag(calendar)?.[id];
  if (row?.overridden === true) {
    const name = ar ? String(row.nameAr || "").trim() : String(row.nameEn || "").trim();
    if (name) return name;
  }
  return ar ? fallbackAr : fallbackEn;
}

function civicHolidayOnDay(day, calendar) {
  for (const id of ["national", "founding"]) {
    const rule = rulingCivicDate(id, calendar);
    if (!rule) continue;
    const md = `${pad2(rule.month)}-${pad2(rule.day)}`;
    if (String(day || "").slice(5) === md) {
      return { id, from: day, to: day, days: ruleValue(id === "national" ? "leave.nationalDay.days" : "leave.foundingDay.days", day), ownerRuled: !!rule.overridden };
    }
  }
  return null;
}

function eidHolidayOnDay(day, calendar) {
  const ownerFitr = rulingEidSpan("fitr", calendar);
  const ownerAdha = rulingEidSpan("adha", calendar);
  if (ownerFitr && ownerFitr.from <= day && day <= ownerFitr.to) return ownerFitr;
  if (ownerAdha && ownerAdha.from <= day && day <= ownerAdha.to) return ownerAdha;
  const year = Number(String(day || "").slice(0, 4));
  if (!ownerFitr) {
    const fitr = eidFitrSpan(year, calendar) || eidFitrSpan(year - 1, calendar);
    if (fitr && fitr.from <= day && day <= fitr.to) return fitr;
  }
  if (!ownerAdha) {
    const adha = eidAdhaSpan(year) || eidAdhaSpan(year - 1);
    if (adha && adha.from <= day && day <= adha.to) return adha;
  }
  return null;
}

export function officialHolidayOn(value, calendar) {
  const day = laborDayKey(value);
  const eid = eidHolidayOnDay(day, calendar);
  const civic = civicHolidayOnDay(day, calendar);
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
  const nextAnnual = (month, date) => {
    const md = `${pad2(month)}-${pad2(date)}`;
    const here = `${year}-${md}`;
    return here >= day ? here : `${year + 1}-${md}`;
  };
  const nationalRule = rulingCivicDate("national", calendar);
  const foundingRule = rulingCivicDate("founding", calendar);
  const national = nextAnnual(nationalRule.month, nationalRule.day);
  const founding = nextAnnual(foundingRule.month, foundingRule.day);
  const ownerFitr = rulingEidSpan("fitr", calendar);
  const ownerAdha = rulingEidSpan("adha", calendar);
  const fitrYear = eidFitrSpan(year, calendar)?.from >= day ? year : year + 1;
  const adhaYear = eidAdhaSpan(year)?.from >= day ? year : year + 1;
  const fitr = ownerFitr || eidFitrSpan(fitrYear, calendar);
  const adha = ownerAdha || eidAdhaSpan(adhaYear);
  const nationalMoved = !!(nationalRule.overridden && (nationalRule.month !== 9 || nationalRule.day !== 23));
  const foundingMoved = !!(foundingRule.overridden && (foundingRule.month !== 2 || foundingRule.day !== 22));
  return [
    {
      id: "national",
      ar: holidayTitle("national", true, calendar, "إجازة اليوم الوطني", "National Day leave"),
      en: holidayTitle("national", false, calendar, "إجازة اليوم الوطني", "National Day leave"),
      from: national,
      to: national,
      days: ruleValue("leave.nationalDay.days", national),
      ownerRuled: !!nationalRule.overridden,
      noteAr: nationalMoved
        ? `يوم واحد — حكم المالك ${national}`
        : "يوم واحد — 23 سبتمبر · أول يوم من برج الميزان حسب أم القرى",
      noteEn: nationalMoved
        ? `One day — owner ruling ${national}`
        : "One day — 23 September · first day of Libra on the Umm al-Qura calendar",
      ruleId: "leave.nationalDay.days",
    },
    {
      id: "founding",
      ar: holidayTitle("founding", true, calendar, "إجازة يوم التأسيس", "Founding Day leave"),
      en: holidayTitle("founding", false, calendar, "إجازة يوم التأسيس", "Founding Day leave"),
      from: founding,
      to: founding,
      days: ruleValue("leave.foundingDay.days", founding),
      ownerRuled: !!foundingRule.overridden,
      noteAr: foundingMoved ? `يوم واحد — حكم المالك ${founding}` : "يوم واحد — 22 فبراير",
      noteEn: foundingMoved ? `One day — owner ruling ${founding}` : "One day — 22 February",
      ruleId: "leave.foundingDay.days",
    },
    {
      id: "fitr",
      ar: holidayTitle("fitr", true, calendar, "إجازة عيد الفطر", "Eid al-Fitr leave"),
      en: holidayTitle("fitr", false, calendar, "إجازة عيد الفطر", "Eid al-Fitr leave"),
      from: fitr?.from || "",
      to: fitr?.to || "",
      days: fitr?.days || ruleValue("leave.eid.fitrDays", day),
      locked: !!fitr?.locked,
      ownerRuled: !!fitr?.ownerRuled,
      noteAr: fitr?.ownerRuled
        ? "حكم المالك على موعد عيد الفطر — الأيام المحفوظة هي العطلة"
        : fitr?.locked
          ? "أربعة أيام تبدأ من اليوم التالي لآخر يوم رمضان بعد إعلان 29 أو 30"
          : "أربعة أيام بعد آخر يوم رمضان — اليوم 30 معلّق حتى إعلان أم القرى",
      noteEn: fitr?.ownerRuled
        ? "Owner ruling for Eid al-Fitr — the saved days are the holiday"
        : fitr?.locked
          ? "Four days starting the day after the last Ramadan day once 29 or 30 is announced"
          : "Four days after the last Ramadan day — day 30 waits for the Umm al-Qura announcement",
      ruleId: "leave.eid.fitrDays",
    },
    {
      id: "adha",
      ar: holidayTitle("adha", true, calendar, "إجازة عيد الأضحى", "Eid al-Adha leave"),
      en: holidayTitle("adha", false, calendar, "إجازة عيد الأضحى", "Eid al-Adha leave"),
      from: adha?.from || "",
      to: adha?.to || "",
      days: adha?.days || ruleValue("leave.eid.adhaDays", day),
      ownerRuled: !!adha?.ownerRuled,
      noteAr: adha?.ownerRuled ? "حكم المالك على موعد عيد الأضحى — الأيام المحفوظة هي العطلة" : "أربعة أيام تبدأ من يوم الوقوف بعرفة",
      noteEn: adha?.ownerRuled ? "Owner ruling for Eid al-Adha — the saved days are the holiday" : "Four days starting on the Day of Arafah",
      ruleId: "leave.eid.adhaDays",
    },
  ];
}

/** Short leave-kind name (no «إجازة» prefix) for titles that already say إجازة … */
export function officialHolidayKindLabel(id, ar = true, calendar) {
  const key = String(id || "").trim().toLowerCase();
  const titled = holidayTitle(
    key,
    ar,
    calendar,
    key === "national" ? "اليوم الوطني" : key === "founding" ? "يوم التأسيس" : key === "fitr" ? "عيد الفطر" : key === "adha" ? "عيد الأضحى" : "",
    key === "national" ? "National Day" : key === "founding" ? "Founding Day" : key === "fitr" ? "Eid al-Fitr" : key === "adha" ? "Eid al-Adha" : "",
  );
  if (!titled) return ar ? "عطلة رسمية" : "Official holiday";
  if (ar) return titled.replace(/^إجازة\s+/, "");
  return titled.replace(/\s+leave$/i, "");
}

/** Full Art. 112 holiday leave label — إجازة اليوم الوطني / إجازة يوم التأسيس / … */
export function officialHolidayLeaveLabel(id, ar = true, calendar) {
  const kind = officialHolidayKindLabel(id, ar, calendar);
  if (!kind) return ar ? "إجازة عطلة رسمية" : "Official-holiday leave";
  return ar ? `إجازة ${kind.replace(/^إجازة\s+/, "")}` : (/leave$/i.test(kind) ? kind : `${kind} leave`);
}

/** National Day / Founding Day — Art. 112 locks the rota; not a طلباتي raise. */
export function isRosterLockedCivicHoliday(id) {
  const key = String(id || "").trim().toLowerCase();
  return key === "national" || key === "founding";
}
