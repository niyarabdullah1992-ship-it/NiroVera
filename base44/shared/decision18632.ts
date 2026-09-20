/** Ministerial decision 18632 of 1441 AH — night hours.
 *  Twin of src/lib/decision18632.js medical / classification helpers.
 *  Official PDF is the source of truth. Not a Labour Law article.
 */

import { ruleValue } from "./laborRules.ts";

export const DECISION_18632 = {
  id: "18632",
  hijriFrom: "1441-05-01",
  gregorianFrom: "2020-01-01",
};

export const NIGHT_MEDICAL_TYPE = "night_medical";
export const NIGHT_MEDICAL_LABEL_AR = "شهادة تجنب العمل الليلي";
export const NIGHT_MEDICAL_LABEL_EN = "Certificate to avoid night work";
export const NIGHT_MEDICAL_FILE_REQUIRED_AR = "أرفق الشهادة الطبية التي تبيّن الحاجة لتجنب العمل الليلي. بلا توقيع رقمي.";
export const NIGHT_MEDICAL_FILE_REQUIRED_EN = "Attach the medical certificate showing the need to avoid night work. No digital signature.";
export const NIGHT_MEDICAL_AVOID_QUOTE_AR = "في حال تم تقديم شهادة طبية تبيّن أنه بحاجة لتجنب العمل الليلي للمحافظة على صحته.";
export const NIGHT_MEDICAL_TRANSFER_QUOTE_AR = "في حال تبين أن العامل الليلي غير لائق للعمل الليلي لأسباب صحية، يتم نقله إلى وظيفة أخرى في ساعات العمل المعتادة مماثلة ويكون لائقاً فيها للعمل.";
export const NIGHT_MEDICAL_OPEN_ENDED_AR = "بلا مدة — حتى تقرير لاحق";
export const NIGHT_MEDICAL_OPEN_ENDED_EN = "No period — until a later report";
export const NIGHT_MEDICAL_DURATION_LABEL_AR = "مدة التقرير كما كتبها الطبيب";
export const NIGHT_MEDICAL_DURATION_LABEL_EN = "Report period as written by the doctor";
export const NIGHT_MEDICAL_UNTIL_LABEL_AR = "تاريخ الانتهاء كما كتبه الطبيب";
export const NIGHT_MEDICAL_UNTIL_LABEL_EN = "End date as written by the doctor";
export const NIGHT_MEDICAL_DURATION_HINT_AR = "اختياري. كما ورد في التقرير — مثال: ثلاثة أشهر. إن تُرك فارغاً فالشهادة بلا مدة حتى تقرير لاحق يغيّر اللياقة. القرار 18632 لا يفرض مدة.";
export const NIGHT_MEDICAL_DURATION_HINT_EN = "Optional. As written on the report — e.g. three months. If left empty, the certificate has no period until a later report changes fitness. Decision 18632 does not set a duration.";
export const NIGHT_MEDICAL_UNTIL_HINT_AR = "اختياري. يُؤخذ من التقرير فقط. بعد هذا التاريخ لا يحظر هذا الملف الإسناد الليلي، ما لم يُسجَّل تقرير لاحق أو يبقَ الملف غير لائق.";
export const NIGHT_MEDICAL_UNTIL_HINT_EN = "Optional. Taken from the report only. After this date this file no longer blocks night assignment, unless a later report or a still-unfit file says otherwise.";
export const NIGHT_MEDICAL_ON_FILE_AR = "شهادة تجنب العمل الليلي تبقى في الملف. لا تُرفض لرفع الحظر — المدة وفق التقرير أو بلا مدة حتى تقرير لاحق يغيّر اللياقة.";
export const NIGHT_MEDICAL_ON_FILE_EN = "The certificate to avoid night work stays on file. It is not rejected to lift the ban — the period is the doctor's, or none until a later report changes fitness.";

function isYes(value: unknown) {
  if (value === true || value === 1 || value === "1") return true;
  return /^(yes|true|نعم)$/i.test(String(value || "").trim());
}

function clockMinutes(hhmm: string) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  const hour = Number.isFinite(h) ? ((h % 24) + 24) % 24 : 0;
  const min = Number.isFinite(m) ? m : 0;
  return hour * 60 + min;
}

export function nightMinutesInWindow(start?: string, end?: string, onDate?: string | Date) {
  const nightStart = Number(ruleValue("hours.night.startHour", onDate) ?? 23) * 60;
  const morningEnd = Number(ruleValue("hours.night.endHour", onDate) ?? 6) * 60;
  let a = clockMinutes(start || "");
  let b = clockMinutes(end || "");
  if (b <= a) b += 1440;
  let minutes = 0;
  for (let wrap = 0; wrap < 2; wrap += 1) {
    const day = wrap * 1440;
    minutes += Math.max(0, Math.min(b, day + morningEnd) - Math.max(a, day));
    minutes += Math.max(0, Math.min(b, day + 1440) - Math.max(a, day + nightStart));
  }
  return minutes;
}

export function performsNightWork(shift?: { start?: string; end?: string } | null, onDate?: string | Date) {
  if (!shift?.start || !shift?.end) return false;
  return nightMinutesInWindow(shift.start, shift.end, onDate) > 0;
}

function isStoredNightMedicalFile(file?: { url?: string; name?: string } | null) {
  return !!(file && (String(file.url || "").trim() || String(file.name || "").trim()));
}

export function isNightMedicalRequest(request?: { type?: string } | null) {
  return request?.type === NIGHT_MEDICAL_TYPE;
}

type NightMedicalPeriodSource = {
  reportUntil?: string;
  doctorEndDate?: string;
  nightMedicalUnfitUntil?: string;
  nightMedicalUntil?: string;
  reportDuration?: string;
  doctorDuration?: string;
  nightMedicalDuration?: string;
};

type NightMedicalEmployee = {
  profile?: NightMedicalPeriodSource & {
    nightMedicalReport?: NightMedicalPeriodSource & { url?: string; name?: string };
    nightFitnessStatus?: string;
    nightMedicalStatus?: string;
    nightMedicalUnfit?: unknown;
    nightMedicalShareConsent?: unknown;
  };
  otherRequests?: Array<NightMedicalPeriodSource & {
    type?: string;
    withdrawnAt?: string;
    file?: { url?: string; name?: string };
    files?: Array<{ url?: string; name?: string }>;
    senderFile?: { url?: string; name?: string };
  }>;
  id?: string;
};

function nightMedicalDayKey(value?: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(date);
}

export function nightMedicalUntilOf(source?: NightMedicalPeriodSource | null) {
  if (!source) return "";
  for (const key of ["reportUntil", "doctorEndDate", "nightMedicalUnfitUntil", "nightMedicalUntil"] as const) {
    const raw = String(source[key] || "").trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  }
  return "";
}

export function nightMedicalDurationOf(source?: NightMedicalPeriodSource | null) {
  if (!source) return "";
  for (const key of ["reportDuration", "doctorDuration", "nightMedicalDuration"] as const) {
    const raw = String(source[key] || "").trim();
    if (raw) return raw;
  }
  return "";
}

export function isNightMedicalPeriodCurrent(source?: NightMedicalPeriodSource | null, onDate?: string | Date) {
  const until = nightMedicalUntilOf(source);
  if (!until) return true;
  return nightMedicalDayKey(onDate) <= until;
}

function isNightMedicalFitStatus(profile?: NightMedicalEmployee["profile"]) {
  const status = String(profile?.nightFitnessStatus || profile?.nightMedicalStatus || "").toLowerCase();
  return status === "fit" || status === "passed";
}

function isNightMedicalUnfitStatus(profile?: NightMedicalEmployee["profile"]) {
  const status = String(profile?.nightFitnessStatus || profile?.nightMedicalStatus || "").toLowerCase();
  return status === "unfit" || status === "failed" || isYes(profile?.nightMedicalUnfit);
}

export function nightMedicalReportOf(employee?: NightMedicalEmployee | null) {
  const profile = employee?.profile || {};
  if (isStoredNightMedicalFile(profile.nightMedicalReport)) return profile.nightMedicalReport;
  for (const row of employee?.otherRequests || []) {
    if (!isNightMedicalRequest(row) || row.withdrawnAt) continue;
    const file = row.file || (Array.isArray(row.files) ? row.files[0] : null) || row.senderFile;
    if (isStoredNightMedicalFile(file)) return file;
  }
  return null;
}

export function hasNightMedicalAvoidReport(employee?: NightMedicalEmployee | null, onDate?: string | Date) {
  if (!employee) return false;
  const profile = employee.profile || {};
  if (isNightMedicalFitStatus(profile)) return false;
  for (const row of employee.otherRequests || []) {
    if (!isNightMedicalRequest(row) || row.withdrawnAt) continue;
    const file = row.file || (Array.isArray(row.files) ? row.files[0] : null) || row.senderFile;
    if (!isStoredNightMedicalFile(file)) continue;
    if (isNightMedicalPeriodCurrent(row, onDate)) return true;
  }
  if (isStoredNightMedicalFile(profile.nightMedicalReport) && isNightMedicalPeriodCurrent({
    reportUntil: profile.nightMedicalUnfitUntil,
    nightMedicalUnfitUntil: profile.nightMedicalUnfitUntil,
    ...profile.nightMedicalReport,
  }, onDate)) {
    return true;
  }
  return isNightMedicalUnfitStatus(profile) && isNightMedicalPeriodCurrent(profile, onDate);
}

export function checkNightMedicalFitness({
  employee,
  shift,
  onDate,
}: {
  employee?: NightMedicalEmployee | null;
  shift?: { start?: string; end?: string } | null;
  onDate?: string | Date;
} = {}) {
  if (!performsNightWork(shift, onDate)) return { ok: true, error: null as string | null };
  if (!hasNightMedicalAvoidReport(employee, onDate)) return { ok: true, error: null as string | null };
  return {
    ok: false,
    error: "NIGHT_MEDICAL_UNFIT",
    ruleId: "hours.night.medicalAvoid",
    reason: `${NIGHT_MEDICAL_AVOID_QUOTE_AR} ${NIGHT_MEDICAL_TRANSFER_QUOTE_AR} لا يُسند عملاً ليلياً ولا يُجبر عليه (القرار 18632).`,
    reasonEn: "A medical certificate was submitted showing the need to avoid night work to preserve health — transfer to equivalent ordinary-hours work. Night work is not rostered and cannot be forced (decision 18632).",
  };
}

export function canViewNightMedical({
  viewer,
  employee,
}: {
  viewer?: { id?: string } | null;
  employee?: NightMedicalEmployee | null;
} = {}) {
  if (!viewer || !employee) return false;
  if (String(viewer.id) === String(employee.id)) return true;
  return isYes(employee?.profile?.nightMedicalShareConsent);
}
