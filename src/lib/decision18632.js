/** Ministerial decision 18632 of 1441 AH — night hours.
 *  Official PDF is the source of truth. Not a Labour Law article.
 */

import { addLaborDays, isRamadanDay, laborDayKey, laborDaysBetween, ruleValue } from "./laborRules.js";

function isStoredNightMedicalFile(file) {
  return !!(file && (String(file.url || "").trim() || String(file.name || "").trim()));
}

export const DECISION_18632 = {
  id: "18632",
  hijriFrom: "1441-05-01",
  gregorianFrom: "2020-01-01",
};

function isYes(value) {
  if (value === true || value === 1 || value === "1") return true;
  return /^(yes|true|نعم)$/i.test(String(value || "").trim());
}

export const NIGHT_FACILITY_FLAGS = [
  { key: "nightFirstAidReady", ar: "إسعافات أولية ليلية", en: "Night first aid" },
  { key: "nightEmergencyTransferReady", ar: "نقل إسعافي عند الطوارئ", en: "Emergency night transfer" },
  { key: "nightFoodAccessReady", ar: "وصول لطعام في الليل", en: "Night food access" },
];

function clockMinutes(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  const hour = Number.isFinite(h) ? ((h % 24) + 24) % 24 : 0;
  const min = Number.isFinite(m) ? m : 0;
  return hour * 60 + min;
}

export function nightMinutesInWindow(start, end, onDate) {
  const nightStart = ruleValue("hours.night.startHour", onDate) * 60;
  const morningEnd = ruleValue("hours.night.endHour", onDate) * 60;
  let a = clockMinutes(start);
  let b = clockMinutes(end);
  if (b <= a) b += 1440;
  let minutes = 0;
  for (let wrap = 0; wrap < 2; wrap += 1) {
    const day = wrap * 1440;
    minutes += Math.max(0, Math.min(b, day + morningEnd) - Math.max(a, day));
    minutes += Math.max(0, Math.min(b, day + 1440) - Math.max(a, day + nightStart));
  }
  return minutes;
}

/** أي عمل داخل 23:00–06:00 — حتى أقل من ثلاث ساعات. */
export function performsNightWork(shift, onDate) {
  if (!shift?.start || !shift?.end) return false;
  return nightMinutesInWindow(shift.start, shift.end, onDate) > 0;
}

/** عامل ليلي: ثلاث ساعات فأكثر داخل 23:00–06:00 فقط. */
export function isNightWorker(shift, onDate) {
  if (!shift?.start || !shift?.end) return false;
  const need = (ruleValue("hours.night.workerHours", onDate) || 3) * 60;
  return nightMinutesInWindow(shift.start, shift.end, onDate) >= need;
}

export function classifyNightAssignment(shift, onDate) {
  const minutes = shift?.start && shift?.end ? nightMinutesInWindow(shift.start, shift.end, onDate) : 0;
  return {
    minutes,
    hours: Math.round((minutes / 60) * 10) / 10,
    performs: minutes > 0,
    worker: minutes >= ((ruleValue("hours.night.workerHours", onDate) || 3) * 60),
  };
}

export function hasWrittenNightConsent(employee) {
  const withdrawn = employee?.profile?.nightConsentWithdrawnAt;
  const given = employee?.profile?.nightConsentAt;
  if (given && (!withdrawn || String(withdrawn) < String(given))) return true;
  return (employee?.otherRequests || []).some((row) => (
    row?.type === "night_consent"
    && row.status === "approved"
    && row.decision === "agree"
    && !row.withdrawnAt
  ));
}

export function isNightWorkerXorExempt({
  onDate,
  employee,
  schedule,
  laborCalendar,
  yearDays,
  consecutiveMonths,
  shareMonths,
  datedYearDays,
} = {}) {
  if (isRamadanDay(onDate, laborCalendar)) {
    return { exempt: true, reason: "ramadan_night" };
  }
  // Thresholds need a real year lookback. A two-day draft is not «5 days a year».
  if ((datedYearDays ?? 0) < 28) {
    void employee;
    void schedule;
    return { exempt: false, reason: "insufficient_lookback" };
  }
  const dayCap = ruleValue("hours.night.incidentalYearDays", onDate) || 5;
  if ((yearDays ?? 0) <= dayCap) {
    return { exempt: true, reason: "incidental_year_days", yearDays };
  }
  if ((consecutiveMonths ?? 0) <= 1) {
    return { exempt: true, reason: "incidental_month", consecutiveMonths };
  }
  if ((shareMonths ?? 0) < 2) {
    return { exempt: true, reason: "incidental_month_share", shareMonths };
  }
  return { exempt: false };
}

export function pregnancyNightBan(employee, onDate) {
  const profile = employee?.profile || employee || {};
  const due = String(profile.expectedBirthDate || profile.dueDate || "").slice(0, 10);
  const extraUntil = String(profile.nightPregnancyBanUntil || profile.nursingNightBanUntil || "").slice(0, 10);
  const day = laborDayKey(onDate);
  const weeksNeed = ruleValue("hours.night.pregnancyBanWeeks", onDate) || 24;
  const pregnant = !!(isYes(profile.pregnant) || due);
  if (extraUntil && /^\d{4}-\d{2}-\d{2}$/.test(extraUntil) && day <= extraUntil) {
    return { ban: true, extra: true, weeksNeed };
  }
  if (!pregnant) return { ban: false, weeksNeed };
  if (!due) return { ban: true, missingDate: true, weeksNeed };
  const daysToDue = laborDaysBetween(day, due);
  if (daysToDue <= weeksNeed * 7 && daysToDue >= -14) {
    return { ban: true, weeksToDue: Math.round((daysToDue / 7) * 10) / 10, weeksNeed };
  }
  return { ban: false, weeksNeed };
}

export function checkNightPregnancyBan({ employee, shift, onDate } = {}) {
  if (!performsNightWork(shift, onDate)) return { ok: true, error: null };
  const ban = pregnancyNightBan(employee, onDate);
  if (!ban.ban) return { ok: true, error: null, ban };
  const profile = employee?.profile || {};
  // ج-1 / ج-3 only. The automatic ج-2 pregnancy ban requires ordinary-hours work — no night minutes.
  if (ban.extra && isYes(profile.nightTransferImpossible) && !isNightWorker(shift, onDate) && isYes(profile.nightPayPreserved)) {
    return { ok: true, error: null, via: "reduce_below_threshold", ban };
  }
  return {
    ok: false,
    error: "NIGHT_PREGNANCY_BAN",
    reason: ban.missingDate
      ? "الحامل محظورة من العمل الليلي قبل الوضع بأربعة وعشرين أسبوعاً على الأقل — سجّل تاريخ الوضع المتوقع (القرار 18632)."
      : ban.extra
        ? "شهادة طبية تمدّد حظر العمل الليلي للحامل أو المرضع — لا إسناد ليلي في هذه الفترة (القرار 18632)."
        : "يحظر العمل الليلي للحامل قبل الوضع بأربعة وعشرين أسبوعاً على الأقل، مع عمل مناسب في الساعات المعتادة (القرار 18632).",
    reasonEn: ban.missingDate
      ? "Night work is banned for a pregnant worker for at least 24 weeks before birth — record the expected birth date (decision 18632)."
      : ban.extra
        ? "A medical certificate extends the night ban for a pregnant or nursing worker (decision 18632)."
        : "Night work is banned for a pregnant worker for at least 24 weeks before birth, with suitable ordinary-hours work (decision 18632).",
    ban,
  };
}

export function checkNightMedicalFitness({ employee, shift, onDate } = {}) {
  if (!isNightWorker(shift, onDate)) return { ok: true, error: null };
  const profile = employee?.profile || {};
  const status = String(profile.nightFitnessStatus || profile.nightMedicalStatus || "").toLowerCase();
  if (status === "unfit" || status === "failed" || isYes(profile.nightMedicalUnfit)) {
    return {
      ok: false,
      error: "NIGHT_MEDICAL_UNFIT",
      reason: "تقرير اللياقة الليلية غير لائق — لا يُستمر في إسناد العامل الليلي (القرار 18632).",
      reasonEn: "The night-fitness report is unfit — night-worker assignment may not continue (decision 18632).",
    };
  }
  return { ok: true, error: null };
}

/** Stored night-fitness report on the employee file — establishment upload, not a status flag. */
export function nightMedicalReportOf(employee) {
  const profile = employee?.profile || {};
  if (isStoredNightMedicalFile(profile.nightMedicalReport)) return profile.nightMedicalReport;
  const files = profile.nightMedicalFiles;
  if (Array.isArray(files)) {
    const hit = files.find((row) => isStoredNightMedicalFile(row));
    if (hit) return hit;
  }
  return null;
}

function isoMedicalDay(raw) {
  const day = String(raw || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

export function nightMedicalIssuedAtOf(employee) {
  const file = nightMedicalReportOf(employee);
  const profile = employee?.profile || {};
  for (const raw of [file?.from, file?.issuedAt, file?.issued, file?.date, file?.at, profile.nightMedicalIssuedAt]) {
    const day = isoMedicalDay(raw);
    if (day) return day;
  }
  return "";
}

export function nightMedicalFromOf(employee) {
  const file = nightMedicalReportOf(employee);
  return isoMedicalDay(file?.from) || nightMedicalIssuedAtOf(employee);
}

export function nightMedicalToOf(employee) {
  if (isPermanentNightMedical(employee)) return "";
  const file = nightMedicalReportOf(employee);
  const profile = employee?.profile || {};
  for (const raw of [file?.to, file?.until, file?.expiresAt, file?.reportUntil, profile.nightMedicalUntil]) {
    const day = isoMedicalDay(raw);
    if (day) return day;
  }
  return "";
}

/** Yearly fitness interval from hours.night.medicalYearMonths — not the 3-month rotation. */
export function nightMedicalYearSpanDays(onDate) {
  const months = Number(ruleValue("hours.night.medicalYearMonths", onDate)) || 12;
  return Math.max(1, Math.round(months * 365.25 / 12));
}

function isPermanentNightMedical(employee) {
  const file = nightMedicalReportOf(employee);
  const profile = employee?.profile || {};
  return file?.permanent === true || profile.nightMedicalPermanent === true;
}

/** Explicit to, or yearly fallback only for legacy issuedAt-only files (no from/to/permanent). */
export function nightMedicalUntilOf(employee, onDate) {
  if (isPermanentNightMedical(employee)) return "";
  const explicit = nightMedicalToOf(employee);
  if (explicit) return explicit;
  const file = nightMedicalReportOf(employee);
  if (file?.from || file?.to || file?.permanent === true) return "";
  const issued = nightMedicalIssuedAtOf(employee);
  if (!issued) return "";
  return addLaborDays(issued, nightMedicalYearSpanDays(onDate || issued));
}

/** File present AND (دائم OR today within [from, to] inclusive). Legacy issuedAt-only uses yearly until. */
export function nightMedicalFileSatisfied(employee, onDate) {
  const file = nightMedicalReportOf(employee);
  if (!file) return false;
  if (isPermanentNightMedical(employee)) return true;
  const today = laborDayKey(onDate);
  const from = nightMedicalFromOf(employee);
  const to = nightMedicalToOf(employee);
  if (from && to) return from <= today && today <= to;
  const issued = nightMedicalIssuedAtOf(employee);
  if (!issued) return false;
  const until = nightMedicalUntilOf(employee, onDate);
  if (!until) return false;
  return issued <= today && today <= until;
}

/** Info-only yearly review when دائم and a year has passed. Never marks دائم expired. */
export function nightMedicalYearlyReviewDue(employee, onDate) {
  if (!isPermanentNightMedical(employee) || !nightMedicalReportOf(employee)) return false;
  const issued = nightMedicalIssuedAtOf(employee);
  if (!issued) return false;
  const due = addLaborDays(issued, nightMedicalYearSpanDays(onDate || issued));
  return laborDayKey(onDate) > due;
}

/**
 * 18632 medical duty for a night worker.
 * Unfit still blocks assignment. Missing / yearly-stale file is unmet but does not newly block publish.
 */
export function nightMedicalDutyState({ employee, shift, onDate } = {}) {
  if (!isNightWorker(shift, onDate)) {
    return { ok: true, unmet: false, block: false, error: null, stale: false };
  }
  const unfit = checkNightMedicalFitness({ employee, shift, onDate });
  if (!unfit.ok) {
    return { ok: false, unmet: true, block: true, error: unfit.error, stale: false, reason: unfit.reason, reasonEn: unfit.reasonEn };
  }
  if (nightMedicalFileSatisfied(employee, onDate)) {
    const reviewDue = nightMedicalYearlyReviewDue(employee, onDate);
    return {
      ok: true,
      unmet: false,
      block: false,
      error: null,
      stale: false,
      reviewDue,
      reason: reviewDue
        ? "مضى عام على تقرير اللياقة الليلية الدائم — مراجعة سنوية في الملف، لا انتهاء (القرار 18632)."
        : undefined,
      reasonEn: reviewDue
        ? "A year has passed on the permanent night-fitness report — a yearly file review, not an expiry (decision 18632)."
        : undefined,
    };
  }
  const file = nightMedicalReportOf(employee);
  const to = nightMedicalToOf(employee);
  const today = laborDayKey(onDate);
  const periodEnded = !!(file && to && to < today);
  return {
    ok: false,
    unmet: true,
    block: false,
    error: "NIGHT_MEDICAL_FILE_MISSING",
    stale: periodEnded,
    reviewDue: false,
    reason: periodEnded
      ? "انتهت فترة تقرير اللياقة الليلية — يُحدَّث ويُحفظ في الملف (القرار 18632)."
      : "لا تقرير لياقة طبية محفوظ للعامل الليلي — ملف وفترة أو دائم في الملف (القرار 18632).",
    reasonEn: periodEnded
      ? "The night-fitness period has ended — renew it and keep it on the file (decision 18632)."
      : "No night-fitness medical report is on file — a file and a period or permanent mark are required (decision 18632).",
  };
}

export function canViewNightMedical({ viewer, employee, canManage } = {}) {
  if (!viewer || !employee) return false;
  if (String(viewer.id) === String(employee.id)) return true;
  if (canManage) return true;
  return isYes(employee?.profile?.nightMedicalShareConsent);
}

export function nightFacilityBags({ schedule, station, settings, company } = {}) {
  return [
    schedule,
    station,
    station?.settings,
    settings,
    settings?.attendance,
    company,
    company?.attendanceSettings,
    company?.nightFacilities,
  ].filter(Boolean);
}

export function nightFacilityGaps(bags = []) {
  const list = Array.isArray(bags) ? bags : nightFacilityBags(bags);
  return NIGHT_FACILITY_FLAGS.filter((flag) => !list.some((bag) => bag && bag[flag.key] === true));
}

export function nightConsiderationNote(employee, onDate, ar = true) {
  const profile = employee?.profile || {};
  let older = isYes(profile.olderWorkerConsideration);
  const birth = String(profile.birthDate || "").slice(0, 10);
  if (birth) {
    const years = laborDaysBetween(birth, onDate) / 365.25;
    if (years >= 50) older = true;
  }
  const family = isYes(profile.familyResponsibilities);
  if (!older && !family) return null;
  return ar
    ? "يراعى قدر الإمكان كبار السن وذوو المسؤوليات العائلية عند الإسناد الليلي (القرار 18632) — ملاحظة، ليست مانعاً."
    : "Older workers and those with family responsibilities are considered as far as possible for night assignment (decision 18632) — a note, not a block.";
}

export function decision18632Gist(ar = true) {
  return ar
    ? "القرار 18632 لسنة 1441هـ (ساري من 2020-01-01 / 1441-05-01): الليل 23:00–06:00. أي عمل داخل النافذة = يؤدي عملاً ليلياً. عامل ليلي = ثلاث ساعات فأكثر في النافذة."
    : "Decision 18632 of 1441 AH (from 2020-01-01 / 1441-05-01): night is 23:00–06:00. Any work in that window performs night work. A night worker works three hours or more in the window.";
}

export function decision18632RightsNote(ar = true) {
  return ar
    ? "حقوق العمل الليلي (18632): راحة 12 ساعة بين يومي عمل لمن يؤدي عملاً ليلياً. تعويض بالساعات أو الأجر أو بدل/نقل. للعامل الليلي بدل مناسب أو تخفيض الساعات مع حفظ وزن الساعات العادية والأجر والمزايا — ما لم يكن ليلاً عرضياً (رمضان، أو دون عتبة شهر / 25٪ لشهرين / 5 أيام في السنة). بعد 3 أشهر كعامل ليلي: تدوير لساعات عادية شهراً على الأقل، أو موافقة خطية محفوظة مع حق التراجع في أي وقت. لا تجديد شهري واجب. حق في تقرير طبي قبل الإسناد وسنوياً وعند ظهور مشكلة صحية — للملف فقط وبموافقة. الحامل: حظر ليلي قبل الوضع بـ24 أسبوعاً على الأقل مع عمل مناسب في الساعات المعتادة."
    : "Night-work rights (18632): 12 hours' rest between work days for anyone who performs night work. Compensation in hours, pay, or similar benefits (allowance / transport). A night worker gets a suitable allowance or reduced hours with ordinary-hour weight, pay and benefits preserved — unless the night work is incidental (Ramadan, or under the month / 25% for two months / 5 days a year thresholds). After 3 months as a night worker: rotate to ordinary hours for at least one month, or keep written consent on file with the right to withdraw at any time. Monthly renewal is not a legal duty. A medical report may be requested before assignment, yearly, and when health problems appear — on the file only, and not shown to others without consent. Pregnancy: night ban for at least 24 weeks before birth, with suitable ordinary-hours work.";
}
