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

/** Regs Art. 1(1) — temporary / casual work running past ninety days (contract.casual.maxDays). */
export function tempConversionRegsNote(ar = true, onDate) {
  const days = rv("contract.casual.maxDays", onDate, 90);
  return ar
    ? `اللائحة م1: إذا استمر العقد المؤقت أو العرضي أكثر من ${days} يوماً تحوّل إلى عقد يخضع لجميع أحكام نظام العمل، أياً كان مسمى التأشيرة أو مدة الإقامة.`
    : `Regs Art. 1: a temporary or casual contract that runs past ${days} days becomes a contract under the whole Labour Law, whatever the visa title or residence term.`;
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

/** Regs Art. 21 — forced labour defined; Art. 61(5) (housing) binds the private and non-profit sectors. */
export function forcedLabourRegsNote(ar = true) {
  return ar
    ? "اللائحة م21/1: تشغيل العامل سخرة كل عمل أو خدمة تُفرض عنوة عليه ولم ينص عليها العقد وتتم تحت التهديد بعقاب ولم يؤدها بمحض اختياره — عدا ما تفرضه الطوارئ أو القوة القاهرة كالحروب والحرائق والفيضانات والمجاعات والزلازل والأوبئة · م21/2: السكن اللائق أو بدله (المادة 61/5) يسري على القطاع الخاص والقطاع غير الربحي، والنقل أو بدله في المادة 61/6."
    : "Regs Art. 21(1): forced labour is any work or service imposed on the worker by force, not in his contract, under threat of a penalty and not freely given — except what emergencies or force majeure impose (war, fire, flood, famine, earthquake, epidemics) · Art. 21(2): decent housing or its allowance (Art. 61(5)) applies to the private and non-profit sectors; transport or its allowance is Art. 61(6).";
}

/** Regs Art. 30 — remote places (Art. 146). */
export function remotePlacesRegsNote(ar = true) {
  return ar
    ? "اللائحة م30: البعيد عن العمران موقع يبعد عن النطاق العمراني الذي تحدده الأمانات والبلديات أكثر من 50 كم بطريق معبّد أو 25 كم بغير معبّد، أو تجمع سكاني لا تتوفر به المرافق والخدمات — وتترتب عليه المادة 146 (حوانيت، ترفيه، رعاية طبية وعلاج الأسرة، مدارس، مساجد، محو أمية بحسب ما يحدده الوزير) والمادة 147 (مساكن أو مخيمات ووجبات)."
    : "Regs Art. 30: a remote place is a site more than 50 km from the municipal urban boundary by paved road or 25 km unpaved, or a cluster without utilities and services — Art. 146 (shops, recreation, medical care and family treatment, schools, mosques, literacy as the Minister sets) and Art. 147 (housing or camps, meals) follow.";
}

/** Model Arts. 9 and 12 — transfer with a change of residence. */
export function relocationModelNote(ar = true) {
  return ar
    ? "النموذج الموحد م9: لا نقل يقتضي تغيير محل الإقامة بغير موافقة العامل كتابةً، وفي الضرورة العارضة حتى ثلاثين يوماً في السنة تتحمل المنشأة انتقاله وإقامته · م12: يستحق المنقول نفقات نقله ومن يعولهم شرعاً المقيمين معه، والإركاب ونقل الأمتعة، ما لم يكن النقل بناءً على رغبته."
    : "Model Art. 9: no transfer that changes the residence without the worker's written consent; in an incidental necessity of up to thirty days a year the company bears his travel and stay · Art. 12: the transferred worker is owed his and his resident dependants' travel, tickets and moving costs, unless the move was his own wish.";
}

/** Model Art. 24 — secondment. */
export function missionModelNote(ar = true) {
  return ar
    ? "النموذج الموحد م24: في الانتداب خارج مقر العمل تؤمّن المنشأة وسائل النقل (أو مقابلها بموافقة العامل)، ومقابل السكن والطعام ما لم تؤمّنه، والبدل اليومي حسب درجة العامل — تُحدَّد في قرار الانتداب، وتُحتسب من مغادرة مقر العمل إلى العودة."
    : "Model Art. 24: on a mission away from the base the company provides transport (or cash with the worker's consent), lodging and food or their cost, and a daily allowance by grade — set in the mission decision and counted from leaving the base to returning.";
}

/** Model Art. 11 — tickets: at the start, on annual leave, and the return at the end of service. */
export function repatriationModelNote(ar = true) {
  return ar
    ? "النموذج الموحد م11: الإركاب عند التعاقد وعند الإجازة السنوية بحسب العقد، وعند انتهاء الخدمة طبقاً للمادة 40/1 (تذكرة عودة العامل غير السعودي إلى بلده) — ولا تتحملها المنشأة إن ثبت عدم صلاحيته خلال التجربة، أو رغب العودة دون سبب مشروع، أو رُحّل لمخالفة بقرار إداري أو حكم قضائي."
    : "Model Art. 11: tickets at hiring and on annual leave as the contract says, and at the end of service per Art. 40(1) (the non-Saudi worker's return ticket home) — not borne if he proved unfit in probation, chose to return without a legitimate reason, or was deported for a violation.";
}

/** Model Art. 46 — wage when the establishment prevents a ready worker. */
export function preventedWageModelNote(ar = true) {
  return ar
    ? "النموذج الموحد م46: إذا حضر العامل في الوقت المحدد أو تبيّن أنه مستعد للعمل ولم يمنعه إلا سبب راجع إلى المنشأة فله أجر المدة التي لم يؤدِّ فيها العمل."
    : "Model Art. 46: a worker who came on time, or was shown ready, and was kept from working only by a cause on the company's side is owed the wage for that time.";
}

/** Model Arts. 18–20 — the annual performance report. */
export function performanceReportModelNote(ar = true) {
  return ar
    ? "النموذج الموحد م18: تقرير أداء مرة في السنة على الأقل يتضمن المقدرة والكفاءة، والسلوك والتعاون، والمواظبة · م19: بمقياس من خمسة مستويات · م20: يعدّه الرئيس المباشر ويعتمده صاحب الصلاحية، ويُخطر العامل بصورة منه فور اعتماده، وله التظلم منه وفق قواعد التظلم (م71)."
    : "Model Art. 18: a performance report at least once a year covering ability and competence, conduct and cooperation, and attendance · Art. 19: on a five-level scale · Art. 20: prepared by the direct manager, approved by the authority, a copy given to the worker on approval, who may grieve it under Art. 71.";
}

/** Model Arts. 21–23 — increments and promotions. */
export function incrementsModelNote(ar = true) {
  return ar
    ? "النموذج الموحد م21: العلاوة السنوية بحسب المركز المالي، ويستحقها من نال «متوسط» على الأقل بعد سنة من التحاقه أو من علاوته السابقة · م22: الترقية بوظيفة أعلى شاغرة، ومؤهلاتها، و«فوق المتوسط» على الأقل في آخر تقرير، وموافقة صاحب الصلاحية · م23: عند التساوي: ترشيح صاحب الصلاحية، ثم التقدير الأعلى، ثم الشهادات والدورات، ثم الخبرة، ثم الأقدمية."
    : "Model Art. 21: the annual increment follows the company's finances; due to whoever rated at least «average» a year after joining or after the last increment · Art. 22: promotion needs a vacant higher post, its qualifications, at least «above average» on the last report, and the authority's approval · Art. 23: ties go to the authority's nominee, then the higher rating, then qualifications and courses, then experience, then seniority.";
}

/** Model Arts. 47–48 — prohibited items and the worker's duties. */
export function workerDutiesModelNote(ar = true) {
  return ar
    ? "النموذج الموحد م47: على المنشأة ومن له سلطة على العمال منع دخول أي مادة محرّمة شرعاً إلى أماكن العمل، وتُطبَّق على من وُجدت لديه أو تعاطاها العقوبات المقررة · م48: على العامل إنجاز العمل وفق أصول المهنة وتعليمات المنشأة، والعناية بأدواتها وإعادة غير المستهلك، وحسن السلوك، والعون دون أجر إضافي في الكوارث، والخضوع للفحوص الطبية المطلوبة، وحفظ الأسرار المهنية."
    : "Model Art. 47: the company and anyone with authority over workers keep any religiously forbidden substance out of the workplace, and the set penalties apply to whoever holds or uses it · Art. 48: the worker does the work by the trade's rules and lawful instructions, cares for the company's tools and returns what is unused, behaves well, helps without extra pay in disasters, takes required medical exams, and keeps work secrets.";
}

/** Model Art. 53 — the uniform. */
export function uniformModelNote(ar = true) {
  return ar
    ? "النموذج الموحد م53/1: تضع المنشأة اشتراطات زي العاملين: لا يعارض الأحكام الشرعية، ومظهر مهني لائق يناسب المهام، ومحتشم غير شفاف، مع العقوبات المترتبة على مخالفتها، وتُعلَن على حدة في مكان ظاهر أو بوسيلة تكفل علم الخاضعين لها وإقرارهم بالعلم بها."
    : "Model Art. 53(1): the company sets the staff uniform rules — consistent with Sharia, a decent professional look fit for the tasks, modest and not transparent — with the penalties for breaching them, announced separately in a visible place or by a means that ensures those bound know them and acknowledge it.";
}

/** Model Art. 69 (with Arts. 61 and 68) — the penalties record in the service file. */
export function penaltiesRecordModelNote(ar = true) {
  return ar
    ? "النموذج الموحد م69: لكل عامل صحيفة جزاءات يُدوَّن فيها نوع المخالفة وتاريخ وقوعها والجزاء الموقّع، وتُحفظ في ملف خدمته · م61: لا يُشدَّد الجزاء عند التكرار إذا انقضى على المخالفة السابقة مائة وثمانون يوماً من إبلاغه بها · م68: يُبلَّغ العامل كتابةً بالجزاء وبما يتعرض له عند التكرار."
    : "Model Art. 69: each worker has a penalties record listing the offence, the date it happened and the penalty, kept in his service file · Art. 61: no increase on a repeat once 180 days have passed since he was told of the previous penalty · Art. 68: the worker is told in writing of the penalty and of what a repeat brings.";
}
