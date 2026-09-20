/** Hours-policy flags (99/100/103/105/108/17) and named overtime from the published rota.
 *  Caps come from ruleValue — never hard-code 8 / 9 / 48 in callers.
 */

import { citeRule, laborDaysBetween, laborDayKey, ruleValue } from "./laborRules.js";
import { isRamadanDay, isRamadanHoursSubject } from "./laborRules.js";
import { remainingLeaveDays, usedLeaveDays } from "./leaveTypes.js";
import { isOfficialHoliday } from "./ummAlQuraCalendar.js";

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
    hoursExempt108: flagOn(profile.hoursExempt108),
    workPosting: bag.workPosting || company?.workPosting || company?.attendanceSettings?.workPosting || {},
    nurseryChildrenCount: Number(bag.nurseryChildrenCount ?? company?.nurseryChildrenCount) || 0,
  };
}

export function isHoursExempt108(employee, company) {
  return hoursPolicyOf(company, employee).hoursExempt108 === true;
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
export function deriveNamedOvertime({
  days = [],
  employee,
  company,
  laborCalendar,
  ar = true,
} = {}) {
  const rows = [];
  let weekHours = 0;
  let weekOt = 0;
  const firstKey = days[0]?.key;
  const weekCap = ordinaryWeekCap(employee, company, firstKey, laborCalendar);
  for (const day of days) {
    const hours = Math.max(0, Number(day.hours) || 0);
    if (hours <= 0) continue;
    weekHours += hours;
    const holiday = day.holiday === true || isOfficialHoliday(day.key, laborCalendar);
    const restDay = day.restDay === true || isWeeklyRestDay(day.key, company, day.key);
    const dayCap = ordinaryDayCap(employee, company, day.key, laborCalendar);
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
        : (isRamadanDay(day.key, laborCalendar) && isRamadanHoursSubject(employee) ? "ramadan" : (hoursPolicyOf(company, employee).hazardousHours || hoursPolicyOf(company, employee).extendedNine ? "art99" : "ordinary"));
      ruleId = kind === "juvenile"
        ? "hours.juvenile.ordinaryHours"
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
    named: rows.map((row) => row.label),
  };
}

export function nameOtKind(kind, cap, ar = true) {
  if (kind === "holiday") return ar ? "ساعات عيد / عطلة رسمية — كلها إضافي (المادة 107)" : "Eid / official-holiday hours — all overtime (Art. 107)";
  if (kind === "weekly_rest") return ar ? "ساعات يوم الراحة الأسبوعية — كلها إضافي (المادة 107)" : "Weekly-rest hours — all overtime (Art. 107)";
  if (kind === "ramadan") return ar ? `فوق سقف رمضان ${cap} ساعة — إضافي` : `Above the Ramadan ${cap}h cap — overtime`;
  if (kind === "juvenile") return ar ? `فوق سقف الحدث ${cap} ساعة — إضافي` : `Above the juvenile ${cap}h cap — overtime`;
  if (kind === "art99") return ar ? `فوق سقف المادة 99 (${cap} ساعة) — إضافي` : `Above the Article 99 ${cap}h cap — overtime`;
  if (kind === "week_excess") return ar ? `فوق السقف الأسبوعي ${cap} ساعة — إضافي` : `Above the weekly ${cap}h cap — overtime`;
  return ar ? `فوق الساعات العادية ${cap} ساعة — إضافي` : `Above ordinary ${cap}h — overtime`;
}

export function checkThreeWeekAverageGate({ weekHours = [], onDate, employee, company, laborCalendar } = {}) {
  const policy = hoursPolicyOf(company, employee);
  if (!policy.rotatingShifts) return { ok: true, skipped: true };
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
  if (workerConsent !== true || ministryConsent !== true) {
    return {
      ok: false,
      error: "ARTICLE_105_CONSENT",
      reason: "موقوف — المادة 105: تجميع الراحة الأسبوعية يحتاج موافقة العامل كتابة وموافقة الوزارة.",
      reasonEn: "Blocked — Article 105: banking weekly rest needs the worker's written consent and the Ministry's approval.",
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
