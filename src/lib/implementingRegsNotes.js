/**
 * The Implementing Regulations of the Labour Law and their annexes — ministerial decision 115921
 * (1446/08/19), replacing decision 70273, in force from 20 Sha'ban 1446.
 *
 * Numbering rule used across the platform:
 *   «اللائحة م N»          — the Implementing Regulations, Arts. 1–40 (+ bis); Arts. 2, 36, 37 are repealed.
 *   «النموذج الموحد م N»   — Annex 1, the unified model work-organisation regulation (72 articles).
 *   «الملحق 2»             — Annex 2, accommodations for disability and chronic or temporary illness.
 *
 * Wording only — the numbers that the platform enforces are read from laborRules, never typed twice.
 */
import { ruleValue } from "./laborRules.js";

/** One line under every «أنظمة الوزارة» panel — the instrument the «اللائحة» rows cite. */
export const REGS_DECISION_AR = "اللائحة التنفيذية لنظام العمل وملحقاتها: القرار الوزاري 115921 وتاريخ 1446/08/19 — حلّ محل القرار 70273، ويُعمل به من 20 شعبان 1446.";
export const REGS_DECISION_EN = "Implementing Regulations of the Labour Law and annexes: Ministerial Decision 115921 of 1446/08/19 — replaces Decision 70273, in force from 20 Sha'ban 1446.";

export function regsDecisionLine(ar = true) {
  return ar ? REGS_DECISION_AR : REGS_DECISION_EN;
}

function rv(id, onDate, fallback) {
  try { return ruleValue(id, onDate || undefined); } catch { return fallback; }
}

/** Overtime numbers the platform enforces (Regs Arts. 22 and 22 bis) — from laborRules. */
export function overtimeRegsValues(onDate) {
  return {
    cap: rv("hours.ot.annualMaxHours", onDate, 720),
    perHour: rv("hours.ot.compLeave.minHoursPerOtHour", onDate, 1.5),
    windowDays: rv("hours.ot.compLeave.windowDays", onDate, 60),
    maxDays: rv("hours.ot.compLeave.maxDaysPerYear", onDate, 30),
    premium: rv("hours.ot.premium", onDate, 1.5),
  };
}

/** Regs Arts. 22 and 22 bis — appended to every Art. 107 row. */
export function overtimeRegsNote(ar = true, onDate) {
  const v = overtimeRegsValues(onDate);
  return ar
    ? `اللائحة م22: لا يزيد الإضافي على ${v.cap} ساعة في السنة إلا بموافقة العامل · م22 مكرر: الإجازة التعويضية بموافقته لا تقل عن ${v.perHour} ساعة عن كل ساعة إضافية، يُحدَّد موعدها خلال ${v.windowDays} يوماً، ولا تزيد على ${v.maxDays} يوماً في السنة، ويُصرف أجر ما لم يُستعمل منها إن ترك العمل.`
    : `Regs Art. 22: overtime stays within ${v.cap} hours a year unless the worker consents · Art. 22 bis: compensatory leave, with his consent, is at least ${v.perHour} hours per overtime hour, dated within ${v.windowDays} days, at most ${v.maxDays} days a year, and paid out if he leaves before using it.`;
}

/** Regs Art. 24 ثانياً — an Eid or occasion overlapping rest, annual or sick leave. */
export function eidOverlapRegsNote(ar = true) {
  return ar
    ? "اللائحة م24: العيد في يوم الراحة الأسبوعية يُعوَّض بمثله قبله أو بعده · داخل الإجازة السنوية تُمدَّد بقدره · داخل المرضية يُستحق عنه الأجر كاملاً · اليوم الوطني أو التأسيس داخل أيام العيد لا يُعوَّض."
    : "Regs Art. 24: an Eid on the weekly rest day is made up before or after it · inside annual leave the leave is extended by it · inside sick leave it is paid in full · National or Founding Day falling inside the Eid is not made up.";
}

/** Annual leave (Art. 109) — what Regs Arts. 24 and 26 do to it. */
export function annualLeaveRegsNote(ar = true) {
  return ar
    ? "اللائحة م24: أيام العيد داخل السنوية تُمدِّدها ولا تُخصم · م26: المرض أثناء السنوية يوقفها ثم تُستأنف بعد المرضية."
    : "Regs Art. 24: Eid days inside annual leave extend it, never charged · Art. 26: sickness during annual leave pauses it, which resumes after the sick leave.";
}

/** Unpaid leave (Art. 116) — Regs Art. 25. */
export function unpaidLeaveRegsNote(ar = true) {
  return ar
    ? "اللائحة م25: ما زاد على عشرين يوماً يوقف العقد وتتوقف آثاره ما لم يُتفق على خلافه، ويُمدَّد العقد المحدد المدة بمقدار مدة التوقف."
    : "Regs Art. 25: beyond twenty days the contract is suspended and its effects stop unless agreed otherwise; a fixed-term contract is extended by the suspension.";
}

/** Sick leave (Art. 117) — Regs Arts. 24 and 26, model Art. 41. */
export function sickLeaveRegsNote(ar = true) {
  return ar
    ? "اللائحة م26: المرضية أثناء السنوية توقف السنوية ثم تُستأنف، والراحة الأسبوعية داخل المرضية لا تُعوَّض · م24: العيد داخل المرضية بأجر كامل · النموذج الموحد م41: بشهادة طبيب المنشأة أو مرجع طبي معتمد."
    : "Regs Art. 26: sick leave during annual leave pauses the annual leave, which then resumes; a weekly rest inside sick leave is not made up · Art. 24: an Eid inside sick leave is on full pay · Model regulation Art. 41: on a certificate from the company doctor or an accredited provider.";
}

/** Dialysis and treatment days — model Art. 42 and Annex 2 (sixth section). */
export function treatmentDaysRegsNote(ar = true) {
  return ar
    ? "النموذج الموحد م42: يوم الغسيل الكلوي إجازة مدفوعة الأجر بتقرير الجهة المعالجة · الملحق 2: أيام الغياب للعلاج الطبيعي أو الوظيفي أو الغسيل أو الكيميائي أو الإشعاعي إجازات مدفوعة، ومن له جلسات صباحية يُراعى في وردية الصباح."
    : "Model regulation Art. 42: each kidney-dialysis day is paid leave on the treating provider's report · Annex 2: absence for physical or occupational therapy, dialysis, chemotherapy or radiotherapy is paid leave, and morning-session patients are kept on the morning shift.";
}

/** Regs Art. 9(1–3) — the definitions Annex 2 rests on. */
export function disabilityDefinitionsRegsNote(ar = true) {
  return ar
    ? "اللائحة م9/1–3: الشخص ذو الإعاقة بتقرير طبي أو بطاقة من الوزارة · الترتيبات التيسيرية وفق كود البناء والملحق 2 · القدرة على العمل استيفاء شروط الوظيفة."
    : "Regs Art. 9(1–3): a person with a disability per a medical report or ministry card · accommodations per the building code and Annex 2 · ability to work means meeting the job's requirements.";
}

/** Regs Art. 20 — the workplace clause in the contract (Art. 58). */
export function workplaceClauseRegsNote(ar = true) {
  return ar
    ? "اللائحة م20: شرط في العقد يحدد مكان العمل في أي مكان بالمملكة أو يجيز النقل حسب مقتضيات العمل يُعدّ موافقة كتابية من العامل على النقل."
    : "Regs Art. 20: a contract clause setting the workplace anywhere in the Kingdom, or allowing transfer as work requires, counts as the worker's written consent to the transfer.";
}

/** Regs Art. 34 — night work a juvenile may do by exception (Art. 163). */
export function juvenileNightRegsNote(ar = true) {
  return ar
    ? "اللائحة م34: يجوز تشغيل الحدث ليلاً استثناءً في منشأة يقتصر العمل فيها على أفراد الأسرة، والمدارس المهنية ومراكز التدريب، والمخابز عدا التاسعة مساءً حتى الرابعة صباحاً، وحالات القوة القاهرة والطوارئ."
    : "Regs Art. 34: a juvenile may work at night by exception in a family-only establishment, vocational schools and training centres, bakeries outside 21:00–04:00, and force majeure or emergencies.";
}

/** Regs Art. 1(1) — temporary / casual work running past ninety days. */
export const TEMP_CONVERSION_DAYS = 90;
export function tempConversionRegsNote(ar = true) {
  return ar
    ? `اللائحة م1: إذا استمر العقد المؤقت أو العرضي أكثر من ${TEMP_CONVERSION_DAYS} يوماً تحوّل إلى عقد يخضع لجميع أحكام نظام العمل، أياً كان مسمى التأشيرة أو مدة الإقامة.`
    : `Regs Art. 1: a temporary or casual contract that runs past ${TEMP_CONVERSION_DAYS} days becomes a contract under the whole Labour Law, whatever the visa title or residence term.`;
}

/** Regs Arts. 1(2), 17 and 27 ثالثاً — the labour courts' jurisdiction. */
export function labourCourtRegsNote(ar = true) {
  return ar
    ? "تختص المحاكم العمالية بخلافات العقد المؤقت والعرضي والموسمي (اللائحة م1/2)، وعقود التدريب والتأهيل (م17)، والعمل لبعض الوقت والمرن (م27 ثالثاً)."
    : "The labour courts hear disputes over temporary, casual and seasonal contracts (Regs Art. 1(2)), training and qualification contracts (Art. 17), and part-time and flexible work (Art. 27 third).";
}

/** Regs Art. 12 — a non-Saudi's contract is always fixed-term. */
export function nonSaudiFixedRegsNote(ar = true) {
  return ar
    ? "اللائحة م12: عقد غير السعودي محدد المدة مهما طالت مدته أو مدد تجديده، ولا يتحول إلى غير محدد المدة ولو اتفق الطرفان."
    : "Regs Art. 12: a non-Saudi's contract is fixed-term however long it runs or is renewed, and never becomes open-ended even by agreement.";
}

/** Regs Art. 13 — Ajeer. */
export function ajeerRegsNote(ar = true) {
  return ar
    ? "اللائحة م13: العامل غير السعودي الذي تُقرّ الوزارة عمله عبر برنامج «أجير» لا يُعد مخالفاً للمادة 39."
    : "Regs Art. 13: a non-Saudi worker whose work the ministry approves through the Ajeer programme does not breach Art. 39.";
}

/** Model Arts. 1–2 — definitions used by the pay surfaces. */
export function wageDefinitionsModelNote(ar = true) {
  return ar
    ? "النموذج الموحد م1: الأجر الأساسي كل ما يُعطى مقابل العمل مضافاً إليه العلاوات الدورية، والأجر الفعلي الأساسي مع سائر الزيادات المستحقة · م2: التقويم المعمول به في المنشأة."
    : "Model regulation Art. 1: the basic wage is all paid for the work plus periodic raises; the actual wage adds every other increase due · Art. 2: the calendar the establishment uses.";
}

/** Model Art. 57 — the cases in which the contract ends. */
export function contractEndModelNote(ar = true) {
  return ar
    ? "النموذج الموحد م57: ينتهي العقد باتفاق الطرفين بموافقة العامل الكتابية، أو بانتهاء مدته ما لم يُجدَّد، أو بإرادة أحدهما في غير المحدد (75)، أو بالاستقالة (79 مكرر)، أو ببلوغ سن التقاعد، أو القوة القاهرة، أو إغلاق المنشأة أو إنهاء النشاط، أو بحكم في إجراءات الإفلاس."
    : "Model regulation Art. 57: the contract ends by written agreement, at its term unless renewed, by either party in an open-ended contract (75), by resignation (79 bis), at retirement age, by force majeure, on closure or end of the activity, or by a bankruptcy ruling.";
}

/** Regs Arts. 7, 8, 10, 14 — run on Qiwa, outside the platform. */
export function qiwaRegsNote(ar = true) {
  return ar
    ? "اللائحة م7 (قنوات التوظيف) · م8 (نسب التوطين — نطاقات) · م10 (تراخيص التوظيف والاستقدام والإسناد) · م14 (الاستقدام ونقل الخدمات وتغيير المهنة) — تُدار عبر منصة قوى."
    : "Regs Art. 7 (employment channels) · Art. 8 (Saudization — Nitaqat) · Art. 10 (recruitment and outsourcing licences) · Art. 14 (recruitment, transfer of services, change of profession) — handled on Qiwa.";
}
