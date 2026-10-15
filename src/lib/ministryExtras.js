/**
 * Ministry duties that rest on a document or a declaration, not on the roster cells:
 *  - Labour Law Art. 104(1): a weekly rest day other than Friday needs the labour office notified
 *    and workers enabled to perform their religious duties.
 *  - Decision 18632, requirements (a) and (f): night workers equal to day workers in training and promotion,
 *    and a published night-work procedures guide.
 *  - Labour Law Arts. 165 and 166: a juvenile's documents on file, and the labour office told in the first week.
 * Each returns what is missing — the week gates turn it into a warning (never a publish block).
 */
import { hoursPolicyOf } from "./laborHoursPolicy.js";

export const FRIDAY_DOW = 5;

/** Rest days the establishment declared (0 = Sunday … 6 = Saturday). */
export function declaredRestDows(company) {
  const posting = hoursPolicyOf(company)?.workPosting || company?.hoursPolicy?.workPosting || {};
  const listed = Array.isArray(posting.weeklyOffDows) ? posting.weeklyOffDows.map(Number).filter((n) => n >= 0 && n <= 6) : [];
  if (listed.length) return listed;
  const first = Number.isInteger(Number(posting.weeklyRestDow)) ? Number(posting.weeklyRestDow) : FRIDAY_DOW;
  return [first];
}

/**
 * Art. 104(1) — empty when Friday is everyone's rest day, or when both conditions are on file.
 * Rest days are set per person on the file; anyone whose file rest leaves Friday out counts.
 */
export function fridaySwapGaps(company, employees = []) {
  const fileWithoutFriday = (employees || []).some((person) => {
    const raw = person?.profile?.weeklyOffDows;
    return Array.isArray(raw) && raw.length > 0 && !raw.map(Number).includes(FRIDAY_DOW);
  });
  if (declaredRestDows(company).includes(FRIDAY_DOW) && !fileWithoutFriday) return [];
  const posting = company?.hoursPolicy?.workPosting || {};
  const gaps = [];
  if (!String(posting.fridaySwapNotifiedAt || "").trim()) {
    gaps.push({ key: "fridaySwapNotifiedAt", ar: "إبلاغ مكتب العمل باستبدال الجمعة", en: "Labour office notified of replacing Friday" });
  }
  if (posting.religiousDutiesEnabled !== true) {
    gaps.push({ key: "religiousDutiesEnabled", ar: "تمكين العمال من أداء واجباتهم الدينية", en: "Workers enabled to perform their religious duties" });
  }
  return gaps;
}

export const NIGHT_EMPLOYER_DUTIES = [
  { key: "nightTrainingParity", clause: "أ", ar: "تساوي العامل الليلي بالنهاري في التأهيل والتدريب والترقية", en: "Night workers equal to day workers in qualification, training and promotion" },
  { key: "nightGuidePublished", clause: "و", ar: "دليل إجراءات العمل الليلي منشور للعاملين", en: "Night-work procedures guide published to workers" },
];

/** Decision 18632 (a) and (f) — declared on the roster or the company, like the night facility flags. */
export function nightEmployerDutyGaps(bags = []) {
  const list = (bags || []).filter(Boolean);
  return NIGHT_EMPLOYER_DUTIES.filter((duty) => !list.some((bag) => bag?.[duty.key] === true));
}

export const JUVENILE_DOCS = [
  { key: "juvenileIdDoc", ar: "الهوية أو شهادة الميلاد", en: "ID or birth certificate" },
  { key: "juvenileFitnessCert", ar: "شهادة لياقة صحية مصدّقة", en: "Certified fitness certificate" },
  { key: "juvenileGuardianConsent", ar: "موافقة ولي الأمر", en: "Guardian consent" },
];

/** Arts. 165–166 — what is missing on a juvenile's file. */
export function juvenileDocGaps(employee) {
  const profile = employee?.profile || {};
  const gaps = JUVENILE_DOCS.filter((doc) => profile[doc.key] !== true);
  if (!String(profile.juvenileOfficeNotifiedAt || "").trim()) {
    gaps.push({ key: "juvenileOfficeNotifiedAt", ar: "إبلاغ مكتب العمل (المادة 166)", en: "Labour office notified (Art. 166)" });
  }
  return gaps;
}
