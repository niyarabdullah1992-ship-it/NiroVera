/** Hours-policy flags (99/100/103/105/108/17) and named overtime from the published rota.
 *  Caps come from ruleValue — never hard-code 8 / 9 / 48 in callers.
 */

import { citeRule, laborDaysBetween, laborDayKey, ruleValue } from "./laborRules.js";
import { isRamadanDay, isRamadanHoursSubject } from "./laborRules.js";
import { remainingLeaveDays, usedLeaveDays } from "./leaveTypes.js";
import { isOfficialHoliday } from "./ummAlQuraCalendar.js";
import { weeklyOffDows } from "./leaveEidOverlap.js";

export const PAY_CYCLES = ["monthly", "daily", "weekly", "piece", "hourly"];

function flagOn(value) {
  const s = String(value ?? "").trim().toLowerCase();
  return value === true || s === "1" || s === "true" || s === "yes" || s === "نعم";
}

export function hoursPolicyOf(company, employee) {
  const bag = {
    ...(company?.hoursPolicy || {}),
    ...(company?.attendanceSettings?.hoursPolicy || {}),
  };
  const profile = employee?.profile || {};
  return {
    extendedNine: flagOn(profile.extendedNine) || flagOn(bag.extendedNine),
    hazardousHours: flagOn(profile.hazardousHours) || flagOn(bag.hazardousHours),
    rotatingShifts: flagOn(bag.rotatingShifts) || company?.schedule?.rotating === true,
    continuousWork103: flagOn(bag.continuousWork103),
    remoteRestBank105: flagOn(bag.remoteRestBank105),
    art105WorkerConsent: flagOn(bag.art105WorkerConsent),
    art105MinistryConsent: flagOn(bag.art105MinistryConsent),
    art105BankedWeeks: Number(bag.art105BankedWeeks) || 0,
    // Art. 108 — a named category (Regs Art. 23), never a bare boolean. A legacy boolean with no
    // category is not an exemption: the file must choose (art108CategoryOf → legacy).
    hoursExempt108: !!art108CategoryOf(employee).category,
    hoursCategory108: art108CategoryOf(employee).category,
    legacy108: art108CategoryOf(employee).legacy,
    art100ApprovalNo: String(bag.art100ApprovalNo || "").trim(),
    art100ApprovalDate: String(bag.art100ApprovalDate || "").slice(0, 10),
    hoursBasis: HOURS_BASIS.includes(bag.hoursBasis) ? bag.hoursBasis : "",
    workPosting: bag.workPosting || company?.workPosting || company?.attendanceSettings?.workPosting || {},
    nurseryChildrenCount: Number(bag.nurseryChildrenCount ?? company?.nurseryChildrenCount) || 0,
    nurseryOnSite: flagOn(bag.nurseryOnSite),
  };
}

export function isHoursExempt108(employee, company) {
  return hoursPolicyOf(company, employee).hoursExempt108 === true;
}

/* ---------------- Art. 108 + Regs Art. 23 — categories with their own ceilings ---------------- */
export const ART108_CATEGORIES = [
  { id: "management", ar: "منصب إدارة عليا بسلطة صاحب العمل (المادة 108 فقرة 1)", en: "Senior management with the employer's authority (Art. 108(1))" },
  { id: "preparatory", ar: "أعمال تجهيزية أو تكميلية — 15 + 15 دقيقة (اللائحة م23/6)", en: "Preparatory / complementary work — 15 + 15 min (Regs Art. 23(6))" },
  { id: "intermittent", ar: "عمل متقطع بالضرورة — 10 ساعات، 8 في رمضان (اللائحة م23/7)", en: "Necessarily intermittent work — 10 h, 8 in Ramadan (Regs Art. 23(7))" },
  { id: "guard", ar: "حراسة — عدا الحراسة الأمنية المدنية — 12 ساعة، 10 في رمضان (اللائحة م23/8)", en: "Guarding — not civil security — 12 h, 10 in Ramadan (Regs Art. 23(8))" },
  { id: "cleaner", ar: "نظافة — 12 ساعة، 10 في رمضان، ولا أكثر من 6 متوالية (اللائحة م23/5 و8)", en: "Cleaning — 12 h, 10 in Ramadan, never 6+ in a row (Regs Art. 23(5),(8))" },
];
const ART108_IDS = ART108_CATEGORIES.map((row) => row.id);

/** `{ category, legacy }` — legacy = the old boolean on file with no category chosen (not an exemption). */
export function art108CategoryOf(employee) {
  const profile = employee?.profile || {};
  const raw = String(profile.hoursCategory108 || "").trim();
  if (ART108_IDS.includes(raw)) return { category: raw, legacy: false };
  return { category: "", legacy: flagOn(profile.hoursExempt108) };
}

export function art108CategoryLabel(category, ar = true) {
  const row = ART108_CATEGORIES.find((item) => item.id === category);
  return row ? (ar ? row.ar : row.en) : "";
}

/**
 * The ceilings that replace Arts 98/101 for an Art. 108 category (Regs Art. 23).
 * null = no category (ordinary rules apply). Infinity = no ceiling in the text (senior management).
 * Art. 104 (weekly rest) is never lifted by Art. 108.
 */
export function art108Limits(employee, onDate, laborCalendar) {
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

/** Weekly cap for one person this week — Art. 108 category first, then the Art. 98 cap. */
export function art108WeekCap(employee, onDate, laborCalendar, dutyDays = 0) {
  const limits = art108Limits(employee, onDate, laborCalendar);
  if (!limits) return null;
  return limits.weekHours + (limits.extraDayMinutes / 60) * Math.max(0, Number(dutyDays) || 0);
}

/* ---------------- Art. 98 — the hours basis (daily 8 / weekly 48) on record ---------------- */
export const HOURS_BASIS = ["daily", "weekly"];

/** `{ basis, source }` — employee file, then the site, then the company. "" = not recorded. */
export function hoursBasisOf(company, employee, station) {
  const own = String(employee?.profile?.hoursBasis || "").trim();
  if (HOURS_BASIS.includes(own)) return { basis: own, source: "employee" };
  const stationId = employee?.profile?.workStationId || employee?.stationId;
  const site = station || (stationId != null ? (company?.stations || []).find((row) => String(row?.id) === String(stationId)) : null);
  const fromSite = String(site?.hoursBasis || "").trim();
  if (HOURS_BASIS.includes(fromSite)) return { basis: fromSite, source: "station" };
  const policy = hoursPolicyOf(company);
  if (policy.hoursBasis) return { basis: policy.hoursBasis, source: "company" };
  return { basis: "", source: "" };
}

/* ---------------- Art. 100 — rotation averaging needs the Ministry's approval on record ---------------- */
export function art100ApprovalOf(company) {
  const policy = hoursPolicyOf(company);
  const no = policy.art100ApprovalNo;
  const date = policy.art100ApprovalDate;
  const recorded = !!no && /^\d{4}-\d{2}-\d{2}$/.test(date);
  return { rotating: policy.rotatingShifts, recorded, approved: policy.rotatingShifts && recorded, no, date };
}

export function ageYearsOn(employee, onDate) {
  const birth = String(employee?.profile?.birthDate || employee?.birthDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const years = laborDaysBetween(birth, laborDayKey(onDate)) / 365.25;
  return Number.isFinite(years) ? years : null;
}

/** Art. 161: حدث = أتم 15 ولم يتم 18. Missing birth date is not a silent juvenile. */
export function isJuvenile(employee, onDate) {
  const years = ageYearsOn(employee, onDate);
  if (years == null) return false;
  const min = ruleValue("hours.juvenile.minAgeYears", onDate);
  const max = ruleValue("hours.juvenile.maxAgeYears", onDate);
  return years >= min && years < max;
}

export function ordinaryDayCap(employee, company, onDate, laborCalendar) {
  if (isJuvenile(employee, onDate)) {
    if (isRamadanDay(onDate, laborCalendar) && isRamadanHoursSubject(employee)) {
      return ruleValue("hours.juvenile.ramadanHours", onDate);
    }
    return ruleValue("hours.juvenile.ordinaryHours", onDate);
  }
  const limits108 = art108Limits(employee, onDate, laborCalendar);
  if (limits108) return limits108.dayHours;
  if (isRamadanDay(onDate, laborCalendar) && isRamadanHoursSubject(employee)) {
    return ruleValue("hours.ramadan.ordinaryHours", onDate);
  }
  const policy = hoursPolicyOf(company, employee);
  if (policy.hazardousHours) return ruleValue("hours.art99.hazardousDayHours", onDate);
  if (policy.extendedNine) return ruleValue("hours.art99.extendedDayHours", onDate);
  return ruleValue("hours.shift.ordinaryHours", onDate);
}

export function ordinaryWeekCap(employee, company, onDate, laborCalendar) {
  if (isJuvenile(employee, onDate)) {
    return ordinaryDayCap(employee, company, onDate, laborCalendar) * 6;
  }
  const limits108 = art108Limits(employee, onDate, laborCalendar);
  if (limits108) return limits108.weekHours;
  if (isRamadanDay(onDate, laborCalendar) && isRamadanHoursSubject(employee)) {
    return ruleValue("hours.ramadan.weekMaxHours", onDate);
  }
  return ruleValue("hours.week.ordinaryMaxHours", onDate);
}

export function weeklyRestDow(company, onDate) {
  const raw = hoursPolicyOf(company).workPosting?.weeklyRestDow;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 0 && n <= 6) return n;
  return 5;
}

export function isWeeklyRestDay(dateKey, company, onDate) {
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (!y) return false;
  return new Date(y, m - 1, d).getDay() === weeklyRestDow(company, onDate || dateKey);
}

export function checkWorkPostingGate({ company, station, settings } = {}) {
  const posting = hoursPolicyOf(company || { attendanceSettings: settings, workPosting: station?.workPosting }).workPosting
    || station?.workPosting
    || {};
  const postedAt = String(posting.postedAt || "").slice(0, 10);
  const posted = posting.posted === true || /^\d{4}-\d{2}-\d{2}$/.test(postedAt);
  const cite = citeRule("hours.posting.cite");
  if (posted) {
    return {
      ok: true,
      posted: true,
      postedAt,
      table: posting,
      cite,
    };
  }
  return {
    ok: false,
    error: "WORK_POSTING_MISSING",
    reason: "تنبيه — المادة 17: لم يُعلَن في موقع العمل جدول مواعيد العمل وفترات الراحة ويوم الراحة ومواعيد النوبة.",
    reasonEn: "Notice — Article 17: the work-hours table, rest periods, weekly rest day and shift times have not been posted at the workplace.",
    posted: false,
    table: posting,
    cite,
  };
}

/** Named overtime from published-shift hours vs 98/99/Ramadan/164, plus 107 rest-day and Eid hours. */
/** This person's off weekdays (file first, then the establishment) — Arts 104/107. */
export function isEmployeeOffDay(dateKey, company, employee) {
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (!y) return false;
  return weeklyOffDows(company, employee).includes(new Date(y, m - 1, d).getDay());
}

/**
 * `criterion`: "daily" names hours past the day cap; "weekly" (Art. 107(2)) names only the hours past
 * the week cap. Empty = the Art. 98 basis on record (hoursBasisOf), else daily.
 * Holiday / weekly-rest hours are always overtime in full (Art. 107(3)).
 */
export function deriveNamedOvertime({
  days = [],
  employee,
  company,
  laborCalendar,
  criterion = "",
  ar = true,
} = {}) {
  const rows = [];
  let weekHours = 0;
  let weekOt = 0;
  const firstKey = days[0]?.key;
  const basis = criterion || hoursBasisOf(company, employee).basis || "daily";
  const dutyDays = days.filter((day) => Number(day.hours) > 0).length;
  const weekCap = art108WeekCap(employee, firstKey, laborCalendar, dutyDays) ?? ordinaryWeekCap(employee, company, firstKey, laborCalendar);
  for (const day of days) {
    const hours = Math.max(0, Number(day.hours) || 0);
    if (hours <= 0) continue;
    weekHours += hours;
    const holiday = day.holiday === true || isOfficialHoliday(day.key, laborCalendar);
    const restDay = typeof day.restDay === "boolean" ? day.restDay : isEmployeeOffDay(day.key, company, employee);
    const dayCap = basis === "weekly" ? Infinity : ordinaryDayCap(employee, company, day.key, laborCalendar);
    let ot = 0;
    let kind = "";
    let ruleId = "hours.ot.premium";
    if (holiday) {
      ot = hours;
      kind = "holiday";
      ruleId = "hours.ot.premium";
    } else if (restDay) {
      ot = hours;
      kind = "weekly_rest";
      ruleId = "hours.ot.premium";
    } else if (hours > dayCap) {
      ot = Math.round((hours - dayCap) * 100) / 100;
      kind = isJuvenile(employee, day.key)
        ? "juvenile"
        : art108CategoryOf(employee).category
          ? "art108"
          : (isRamadanDay(day.key, laborCalendar) && isRamadanHoursSubject(employee) ? "ramadan" : (hoursPolicyOf(company, employee).hazardousHours || hoursPolicyOf(company, employee).extendedNine ? "art99" : "ordinary"));
      ruleId = kind === "juvenile"
        ? "hours.juvenile.ordinaryHours"
        : kind === "art108"
          ? (art108CategoryOf(employee).category === "intermittent" ? "hours.art108.intermittentDayHours" : "hours.art108.guardDayHours")
          : (kind === "ramadan" ? "hours.ramadan.ordinaryHours" : (kind === "art99" ? (hoursPolicyOf(company, employee).hazardousHours ? "hours.art99.hazardousDayHours" : "hours.art99.extendedDayHours") : "hours.shift.ordinaryHours"));
    }
    if (ot > 0) {
      weekOt += ot;
      rows.push({
        dateKey: day.key,
        hours,
        overtimeHours: ot,
        overtimeMinutes: Math.round(ot * 60),
        kind,
        holiday: kind === "holiday",
        dayCap,
        ruleId,
        label: nameOtKind(kind, dayCap, ar),
      });
    }
  }
  if (weekHours > weekCap) {
    const extra = Math.round((weekHours - weekCap) * 100) / 100;
    const already = Math.round(weekOt * 100) / 100;
    if (extra > already) {
      const add = Math.round((extra - already) * 100) / 100;
      weekOt += add;
      rows.push({
        dateKey: firstKey,
        hours: weekHours,
        overtimeHours: add,
        overtimeMinutes: Math.round(add * 60),
        kind: "week_excess",
        dayCap: weekCap,
        ruleId: "hours.week.ordinaryMaxHours",
        label: nameOtKind("week_excess", weekCap, ar),
      });
    }
  }
  const totalHours = Math.round(weekOt * 100) / 100;
  return {
    rows,
    totalHours,
    totalMinutes: Math.round(totalHours * 60),
    weekHours: Math.round(weekHours * 100) / 100,
    weekCap,
    basis,
    named: rows.map((row) => row.label),
  };
}

export function nameOtKind(kind, cap, ar = true) {
  if (kind === "holiday") return ar ? "عمل في العطلة — ساعاته إضافي (م107/3)" : "Holiday work — all hours are overtime (Art. 107(3))";
  if (kind === "weekly_rest") return ar ? "ساعات يوم الراحة الأسبوعية — كلها إضافي (المادة 107)" : "Weekly-rest hours — all overtime (Art. 107)";
  if (kind === "ramadan") return ar ? `فوق سقف رمضان ${cap} ساعة — إضافي` : `Above the Ramadan ${cap}h cap — overtime`;
  if (kind === "art108") return ar ? `فوق سقف فئة المادة 108 (${Math.round(cap * 100) / 100} ساعة، اللائحة م23) — إضافي` : `Above the Art. 108 category ${Math.round(cap * 100) / 100}h cap (Regs Art. 23) — overtime`;
  if (kind === "juvenile") return ar ? `فوق سقف الحدث ${cap} ساعة — إضافي` : `Above the juvenile ${cap}h cap — overtime`;
  if (kind === "art99") return ar ? `فوق سقف المادة 99 (${cap} ساعة) — إضافي` : `Above the Article 99 ${cap}h cap — overtime`;
  if (kind === "week_excess") return ar ? `فوق السقف الأسبوعي ${cap} ساعة — إضافي` : `Above the weekly ${cap}h cap — overtime`;
  return ar ? `فوق الساعات العادية ${cap} ساعة — إضافي` : `Above ordinary ${cap}h — overtime`;
}

export function checkThreeWeekAverageGate({ weekHours = [], onDate, employee, company, laborCalendar } = {}) {
  const policy = hoursPolicyOf(company, employee);
  if (!policy.rotatingShifts) return { ok: true, skipped: true };
  // Art. 100 needs the Ministry's approval — a flag without its number and date averages nothing.
  if (!art100ApprovalOf(company).approved) {
    return {
      ok: true,
      skipped: true,
      approvalMissing: true,
      reason: "المادة 100: التناوب مفعّل لكن موافقة الوزارة (رقمها وتاريخها) غير مسجّلة — يبقى سقف 48 ساعة لكل أسبوع.",
      reasonEn: "Article 100: rotation is on but the Ministry approval (number and date) is not recorded — the 48-hour cap stays per week.",
      cite: citeRule("hours.art100.averageWeeks", onDate),
    };
  }
  const weeks = ruleValue("hours.art100.averageWeeks", onDate);
  const list = (weekHours || []).slice(0, weeks).map((n) => Math.max(0, Number(n) || 0));
  if (!list.length) return { ok: true, pending: true };
  const avg = list.reduce((s, n) => s + n, 0) / list.length;
  const dayCap = ruleValue("hours.shift.ordinaryHours", onDate);
  const weekCap = ordinaryWeekCap(employee, company, onDate, laborCalendar);
  const dayAvg = avg / 6;
  const cite = citeRule("hours.art100.averageWeeks", onDate);
  if (avg > weekCap || dayAvg > dayCap) {
    return {
      ok: false,
      error: "ARTICLE_100_AVERAGE",
      reason: `موقوف — المادة 100: متوسط ${weeks} أسابيع (${avg.toFixed(1)} ساعة) يتجاوز سقف المادة 98.`,
      reasonEn: `Blocked — Article 100: the ${weeks}-week average (${avg.toFixed(1)} h) exceeds the Article 98 cap.`,
      avg,
      weekCap,
      dayCap,
      cite,
    };
  }
  return { ok: true, avg, weekCap, dayCap, cite };
}

export function checkArt105BankGate({ company, employee, bankedWeeks, workerConsent, ministryConsent } = {}) {
  const policy = hoursPolicyOf(company, employee);
  if (!policy.remoteRestBank105) return { ok: true, skipped: true };
  const cap = ruleValue("hours.art105.bankMaxWeeks");
  const cite = citeRule("hours.art105.bankMaxWeeks");
  const worker = workerConsent === undefined ? policy.art105WorkerConsent : workerConsent;
  const ministry = ministryConsent === undefined ? policy.art105MinistryConsent : ministryConsent;
  if (worker !== true || ministry !== true) {
    return {
      ok: false,
      error: "ARTICLE_105_CONSENT",
      reason: "موقوف — المادة 105: تجميع الراحة الأسبوعية يحتاج اتفاق صاحب العمل والعمال وموافقة الوزارة.",
      reasonEn: "Blocked — Article 105: banking weekly rest needs the employer–worker agreement and the Ministry's approval.",
      cite,
    };
  }
  if (Number(bankedWeeks) > cap) {
    return {
      ok: false,
      error: "ARTICLE_105_CAP",
      reason: `موقوف — المادة 105: لا يُجمَّع أكثر من ${cap} أسابيع راحة.`,
      reasonEn: `Blocked — Article 105: weekly rest may not be banked for more than ${cap} weeks.`,
      cap,
      cite,
    };
  }
  return { ok: true, cap, cite };
}

export function remainingSickDays(employee, onDate) {
  const cap = ruleValue("leave.sick.days", onDate);
  const used = usedLeaveDays(employee?.leaveRequests || [], "sick", onDate, employee?.profile?.hireDate);
  return { cap, used, left: Math.max(0, cap - used) };
}

export function remainingAnnualDays(employee, onDate) {
  const n = remainingLeaveDays(employee?.profile || {}, employee?.leaveRequests || [], "annual", onDate);
  return Math.max(0, Number(n) || 0);
}

export function formatOtPremiumLabel(onDate, ar = true) {
  const premium = ruleValue("hours.ot.premium", onDate);
  return ar ? `أجر ${premium}×` : `${premium}× pay`;
}
