/** Dated Labour Law rules as encoded in NiroVera.
 *
 *  This is the operational system — not ministry product accreditation.
 *  A number on screen must come from ruleAt(). A statutory chip appears only
 *  when the in-force row has an `article`. Product-only encodings (grace,
 *  attachment threshold, WPS day) stay silent so we never invent a المادة.
 *
 *  Adding a new law version = a new row with a later effectiveFrom.
 *  Old dates keep the old value.
 */

import { articleOfficialText, BOE_LABOUR_LAW_URL } from "./laborArticleTexts.ts";

export const HRSD_CATALOGUE_URL = "https://www.hrsd.gov.sa/knowledge-centre/decisions-and-regulations/regulation-and-procedures";
export const HRSD_IMPLEMENTING_REGS_URL = "https://www.hrsd.gov.sa/sites/default/files/2025-04/%D8%A7%D9%84%D9%84%D8%A7%D8%A6%D8%AD%D8%A9%20%D8%A7%D9%84%D8%AA%D9%86%D9%81%D9%8A%D8%B0%D9%8A%D8%A9%20%D9%84%D9%86%D8%B8%D8%A7%D9%85%20%D8%A7%D9%84%D8%B9%D9%85%D9%84%20%D9%88%D9%85%D9%84%D8%AD%D9%82%D8%A7%D8%AA%D9%87%D8%A7.pdf";
export { BOE_LABOUR_LAW_URL };

export type LaborRuleUnit =
  | "days"
  | "hours"
  | "minutes"
  | "ratio"
  | "day_of_month"
  | "count"
  | "years";

export type LaborRuleSource = "labour" | "wps" | "gosi" | "product" | "ministerial" | "programme";

export type LaborRule = {
  id: string;
  value: number;
  unit: LaborRuleUnit;
  /** Labour Law article number as a string, e.g. "90". Null = do not cite. */
  article: string | null;
  source: LaborRuleSource;
  effectiveFrom: string;
  effectiveTo?: string | null;
  hintAr: string;
  hintEn: string;
};

export type LaborCite = {
  id: string;
  article: string;
  value: number;
  unit: LaborRuleUnit;
  labelAr: string;
  labelEn: string;
  hintAr: string;
  hintEn: string;
  /** Official BOE article wording (Arabic). */
  textAr?: string;
  /** Official BOE article wording (English). */
  textEn?: string;
  sourceUrl: string;
};

/** How the product encodes the law today — until a newer dated row is added. */
const ENCODED_FROM = "2005-01-01";

const AMENDMENT_2025 = "2025-02-19";
const BEFORE_AMENDMENT_2025 = "2025-02-18";

function row(
  id: string,
  value: number,
  unit: LaborRuleUnit,
  article: string | null,
  source: LaborRuleSource,
  hintAr: string,
  hintEn: string,
  dates: { from?: string; to?: string | null } = {},
): LaborRule {
  return {
    id,
    value,
    unit,
    article,
    source,
    effectiveFrom: dates.from || ENCODED_FROM,
    effectiveTo: dates.to || null,
    hintAr,
    hintEn,
  };
}

export const LABOR_RULES: LaborRule[] = [
  row("leave.annual.days", 21, "days", "109", "labour", "إجازة سنوية 21 يوماً بأجر كامل، وترتفع إلى 30 يوماً بعد خمس سنوات خدمة.", "Annual leave 21 days on full pay, rising to 30 after five years of service."),
  row("leave.annual.afterFiveYearsDays", 30, "days", "109", "labour", "ترتفع الإجازة السنوية إلى 30 يوماً بعد خمس سنوات خدمة.", "Annual leave rises to 30 days after five years of service."),
  row("leave.annual.carry.cite", 1, "days", "110", "labour", "يجوز تأجيل الإجازة السنوية إلى السنة التالية بموافقة صاحب العمل. لصاحب العمل التأجيل حتى 90 يوماً بعد سنة الاستحقاق، وأبعد من ذلك بموافقة كتابية على ألا يتجاوز نهاية السنة التالية.", "Annual leave may be postponed to the next year with the employer's approval. The employer may postpone up to 90 days after the entitlement year, and further only with written consent, not beyond the end of the following year."),
  row("leave.annual.deferMaxDays", 90, "days", "110", "labour", "تأجيل صاحب العمل للإجازة السنوية بعد سنة الاستحقاق لا يزيد على تسعين يوماً إلا بموافقة العامل كتابة.", "The employer may postpone annual leave after the entitlement year by no more than ninety days without the worker's written consent."),
  row("leave.sick.days", 120, "days", "117", "labour", "إجازة مرضية خلال السنة الواحدة: 30 يوماً بأجر كامل، ثم 60 بثلاثة أرباع الأجر، ثم 30 بلا أجر — 120 يوماً متصلة أو متقطعة من تاريخ أول إجازة مرضية.", "Sick leave in one year: 30 days at full pay, then 60 at three-quarters, then 30 unpaid — 120 days continuous or intermittent from the first sick leave."),
  row("leave.maternity.days", 70, "days", "151", "labour", "إجازة وضع عشرة أسابيع بأجر كامل — النص قبل نفاذ تعديل 19 فبراير 2025.", "Maternity leave of ten weeks on full pay — the text before the 19 February 2025 amendment.", { to: BEFORE_AMENDMENT_2025 }),
  row("leave.maternity.days", 84, "days", "151", "labour", "إجازة وضع اثنا عشر أسبوعاً بأجر كامل. ستة أسابيع بعد الوضع وجوبية، وتوزَّع الستة الباقية ابتداءً من أربعة أسابيع قبل التاريخ المرجح بشهادة طبية.", "Maternity leave of twelve weeks on full pay. Six weeks after birth are mandatory; the remaining six may start up to four weeks before the expected date with a medical certificate.", { from: AMENDMENT_2025 }),
  row("leave.maternity.mandatoryPostDays", 42, "days", "151", "labour", "الأسابيع الستة التالية للوضع وجوبية.", "The six weeks after birth are mandatory.", { from: AMENDMENT_2025 }),
  row("leave.maternity.preDaysMax", 28, "days", "151", "labour", "يجوز بدء الإجازة قبل أربعة أسابيع من التاريخ المرجح للوضع.", "Leave may start up to four weeks before the expected date of birth.", { from: AMENDMENT_2025 }),
  row("leave.maternity.unpaidExtendDays", 30, "days", "151", "labour", "يجوز تمديد إجازة الوضع شهراً دون أجر.", "Maternity leave may be extended by one unpaid month.", { from: AMENDMENT_2025 }),
  row("leave.maternity.disabledChildDays", 30, "days", "151", "labour", "إنجاب طفل مريض أو من ذوي الإعاقة يحتاج مرافقاً: شهر إضافي بأجر كامل بعد إجازة الوضع — المادة 151 فقرة 2.", "A sick or disabled newborn who needs a constant companion: one extra month on full pay after maternity leave — Article 151(2).", { from: AMENDMENT_2025 }),
  row("leave.paternity.days", 3, "days", "113", "labour", "إجازة مولود ثلاثة أيام بأجر كامل خلال سبعة أيام من تاريخ الولادة.", "Paternity leave of three days on full pay within seven days of the birth."),
  row("leave.paternity.windowDays", 7, "days", "113", "labour", "تُؤخذ إجازة المولود خلال سبعة أيام من تاريخ الولادة.", "Paternity leave must be taken within seven days of the birth."),
  row("leave.marriage.days", 5, "days", "113", "labour", "إجازة زواج خمسة أيام بأجر كامل من تاريخ الواقعة.", "Marriage leave of five days on full pay from the date of the event."),
  row("leave.bereavement.days", 5, "days", "113", "labour", "إجازة خمسة أيام لوفاة الزوج أو أحد الأصول أو الفروع، من تاريخ الواقعة.", "Five days on the death of a spouse, parent or child, from the date of the event."),
  row("leave.bereavement_sibling.days", 3, "days", "113", "labour", "إجازة ثلاثة أيام لوفاة الأخ أو الأخت، من تاريخ الواقعة.", "Three days on the death of a sibling, from the date of the event.", { from: AMENDMENT_2025 }),
  row("leave.hajj.days", 10, "days", "114", "labour", "إجازة حج لا تقل عن عشرة أيام ولا تزيد على خمسة عشر يوماً شاملة عيد الأضحى، مرة واحدة بعد سنتين متصلتين إن لم يُؤدَّ الحج من قبل.", "Hajj leave of ten to fifteen days including Eid al-Adha, once after two consecutive years if Hajj has not been performed before."),
  row("leave.hajj.maxDays", 15, "days", "114", "labour", "الحد الأعلى لإجازة الحج خمسة عشر يوماً شاملة عيد الأضحى.", "Hajj leave may not exceed fifteen days including Eid al-Adha."),
  row("leave.hajj.minServiceYears", 2, "years", "114", "labour", "يشترط لإجازة الحج سنتان متصلتان في الخدمة.", "Hajj leave requires two consecutive years of service."),
  row("leave.exam.cite", 1, "days", "115", "labour", "إجازة أداء الامتحان وفق شروط المادة 115: بأجر إن وافق صاحب العمل وكانت السنة غير معادة، وبلا أجر إن أُعيدت. يُقدَّم الطلب قبل خمسة عشر يوماً مع إثبات.", "Exam leave under Article 115: paid if the employer agrees and it is a first sitting; unpaid if a repeat. Fifteen days' notice and proof."),
  row("leave.exam.noticeDays", 15, "days", "115", "labour", "يُقدَّم طلب إجازة الامتحان قبل موعدها بخمسة عشر يوماً على الأقل.", "The exam-leave request must be submitted at least fifteen days before it is due."),
  row("leave.unpaid.cite", 1, "days", "116", "labour", "الإجازة بلا أجر توقف عقد العمل فيما زاد على عشرين يوماً ما لم يتفق الطرفان على خلاف ذلك.", "Unpaid leave suspends the contract for any period beyond twenty days unless the parties agree otherwise."),
  row("leave.eid.cite", 1, "days", "112", "labour", "إجازة الأعياد والمناسبات بأجر كامل وفق ما تحدده اللائحة.", "Paid leave on the Eids and occasions specified in the Regulations."),
  row("leave.eid.fitrDays", 4, "days", null, "ministerial", "اللائحة التنفيذية مادة 24: عيد الفطر أربعة أيام تبدأ من اليوم التالي لـ 29 رمضان حسب تقويم أم القرى. ليست شارة مادة.", "Implementing regulations Art. 24: Eid al-Fitr is four days starting the day after 29 Ramadan on the Umm al-Qura calendar. No Labour Law chip."),
  row("leave.eid.adhaDays", 4, "days", null, "ministerial", "اللائحة التنفيذية مادة 24: عيد الأضحى أربعة أيام تبدأ من يوم الوقوف بعرفة.", "Implementing regulations Art. 24: Eid al-Adha is four days starting on the Day of Arafah."),
  row("leave.nationalDay.days", 1, "days", null, "ministerial", "اللائحة التنفيذية مادة 24: اليوم الوطني يوم واحد في أول يوم من برج الميزان حسب أم القرى.", "Implementing regulations Art. 24: National Day is one day on the first day of Libra on the Umm al-Qura calendar."),
  row("leave.foundingDay.days", 1, "days", null, "ministerial", "اللائحة التنفيذية مادة 24: يوم التأسيس يوم واحد في 22 فبراير.", "Implementing regulations Art. 24: Founding Day is one day on 22 February."),
  row("leave.eid.overlap.cite", 1, "days", null, "ministerial", "اللائحة مادة 24 ثانياً: تداخل العيد مع الراحة الأسبوعية يُعوَّض، ومع السنوية تُمدَّد، ومع المرضية يُدفع الأجر الكامل. اليوم الوطني أو التأسيس مع أحد العيدين لا يُعوَّض.", "Implementing regulations Art. 24(2): overlap with weekly rest is compensated, annual leave is extended, sick leave still pays full wage for the Eid days. National or Founding Day falling in an Eid is not extra-compensated."),
  row("leave.noOtherEmployer.cite", 1, "days", "118", "labour", "لا يعمل العامل لدى صاحب عمل آخر أثناء أي إجازة في هذا الفصل، وإلا جاز حرمانه من أجر الإجازة أو استرداده.", "A worker may not work for another employer during any leave in this chapter; otherwise leave pay may be withheld or recovered."),
  row("leave.nursing.dailyMinutes", 60, "minutes", "154", "labour", "بعد العودة من إجازة الوضع: فترات إرضاع لا تزيد في مجموعها على ساعة في اليوم، ضمن ساعات العمل الفعلية وبلا تخفيض أجر.", "After returning from maternity leave: nursing rest totalling not more than one hour a day, counted as actual hours with no wage cut."),
  row("leave.emergency.days", 5, "days", null, "product", "رصيد اضطراري داخلي — ليست مادة مستقلة.", "Internal emergency balance — not a standalone article."),
  row("leave.attachment.thresholdDays", 5, "days", null, "product", "بوابة مرفق للمنصة إن تجاوز الطلب هذا الحد.", "Product attachment gate when the request exceeds this many days."),

  row("hours.shift.ordinaryHours", 8, "hours", "98", "labour", "ساعات العمل العادية في اليوم ثمانٍ، أو ثمان وأربعون في الأسبوع.", "Ordinary hours are eight a day, or forty-eight a week."),
  row("hours.week.ordinaryMaxHours", 48, "hours", "98", "labour", "الحد الأسبوعي لساعات العمل العادية ثمان وأربعون ساعة.", "Weekly cap on ordinary hours is forty-eight."),
  row("hours.ramadan.ordinaryHours", 6, "hours", "98", "labour", "في رمضان تُخفَّض ساعات العمل الفعلية للمسلمين إلى ست ساعات في اليوم.", "In Ramadan, actual hours for Muslims are reduced to six a day."),
  row("hours.ramadan.weekMaxHours", 36, "hours", "98", "labour", "في رمضان تُخفَّض ساعات العمل الفعلية للمسلمين إلى ست وثلاثين ساعة في الأسبوع.", "In Ramadan, actual hours for Muslims are reduced to thirty-six a week."),
  row("hours.rest.betweenShiftsHours", 11, "hours", null, "product", "فاصل تشغيلي 11 ساعة بين نهاية وردية وبداية التالية — ليس حكم المادة 101.", "Operational 11-hour gap between shifts — not Article 101."),
  row("hours.workplace.maxHours", 11, "hours", "101", "labour", "لا يجوز أن يبقى العامل في مكان العمل أكثر من إحدى عشرة ساعة في اليوم.", "A worker may not remain at the workplace more than eleven hours a day.", { to: "2015-03-24" }),
  row("hours.workplace.maxHours", 12, "hours", "101", "labour", "لا يجوز أن يبقى العامل في مكان العمل أكثر من اثنتي عشرة ساعة في اليوم.", "A worker may not remain at the workplace more than twelve hours a day.", { from: "2015-03-25" }),
  row("hours.rest.maxConsecutiveHours", 5, "hours", "101", "labour", "لا يجوز تشغيل العامل أكثر من خمس ساعات متواصلة دون راحة.", "A worker may not work more than five consecutive hours without a rest."),
  row("hours.rest.duringShiftMinutes", 30, "minutes", "101", "labour", "فترة الراحة والصلاة والطعام لا تقل عن نصف ساعة في المرة الواحدة خلال مجموع ساعات العمل.", "Rest, prayer and meal period of at least half an hour at a time during total working hours."),
  row("hours.rest.notWorkingHours.cite", 1, "days", "102", "labour", "فترات الراحة والصلاة والطعام المنصوص عليها في المادة 101 ليست ساعات عمل فعلية.", "The rest, prayer and meal periods in Article 101 are not actual working hours."),
  row("hours.rest.weeklyHours", 24, "hours", "104", "labour", "راحة أسبوعية متصلة لا تُستبدل بأجر.", "Continuous weekly rest, never substituted with pay."),
  row("hours.ot.premium", 1.5, "ratio", "107", "labour", "أجر العمل الإضافي: ساعة ونصف.", "Overtime pay: time-and-a-half."),
  row("hours.ot.compLeave.cite", 1, "days", "107", "labour", "يجوز بموافقة العامل احتساب أيام إجازة تعويضية مدفوعة بدل أجر الساعات الإضافية (من 19 فبراير 2025).", "With the worker's consent, paid compensatory leave may replace overtime pay (from 19 February 2025).", { from: AMENDMENT_2025 }),
  row("hours.ot.exceptionDayHours", 10, "hours", "106", "labour", "حتى في حالات الاستثناء من المواد 98 و101 و104(1)، لا تزيد ساعات العمل الفعلية على عشر ساعات في اليوم.", "Even when Articles 98, 101 and 104(1) are waived, actual hours may not exceed ten a day."),
  row("hours.ot.exceptionWeekHours", 60, "hours", "106", "labour", "حتى في حالات الاستثناء، لا تزيد ساعات العمل الفعلية على ستين ساعة في الأسبوع. الحد السنوي للإضافي بقرار وزاري — بلا شارة مادة.", "Even in exception cases, actual hours may not exceed sixty a week. The annual overtime cap is a ministerial decision — no Labour Law chip."),
  row("hours.ot.annualMaxHours", 720, "hours", null, "ministerial", "اللائحة التنفيذية مادة 22: لا تزيد ساعات الإضافي على 720 ساعة في السنة، ويجوز زيادتها بموافقة العامل. ليست شارة مادة من نظام العمل.", "Implementing regulations Art. 22: overtime may not exceed 720 hours in a year, and may be increased with the worker's consent. No Labour Law chip."),
  row("hours.ot.compLeave.minHoursPerOtHour", 1.5, "hours", null, "ministerial", "اللائحة مادة 22 مكرر: الإجازة التعويضية لا تقل عن ساعة ونصف عن كل ساعة عمل إضافي.", "Implementing regulations Art. 22 bis: compensatory leave is at least one-and-a-half hours for each overtime hour."),
  row("hours.ot.compLeave.windowDays", 60, "days", null, "ministerial", "اللائحة مادة 22 مكرر: يُحدَّد موعد التمتع بالإجازة التعويضية خلال 60 يوماً من الإضافي ما لم يُتفق على خلاف ذلك.", "Implementing regulations Art. 22 bis: the date for taking compensatory leave is set within 60 days of the overtime unless otherwise agreed."),
  row("hours.ot.compLeave.maxDaysPerYear", 30, "days", null, "ministerial", "اللائحة مادة 22 مكرر: لا تزيد الإجازة التعويضية على 30 يوماً في السنة. إن ترك العمل قبل التمتع بها تُدفع أجرتها.", "Implementing regulations Art. 22 bis: compensatory leave may not exceed 30 days in a year. If the worker leaves before taking it, it is paid out."),
  row("hours.grace.minutes", 10, "minutes", null, "product", "سماح تأخير تشغيلي — ليس مادة نظام.", "Operational late grace — not a statutory article."),
  row("hours.settlement.windowDays", 45, "days", null, "product", "نافذة تسوية الغياب داخل الحضور.", "Absence-settlement window inside attendance."),

  row("payroll.month.conventionDays", 30, "days", null, "product", "اتفاق حساب الساعة من الأجر الشهري (30×8).", "Hourly-from-monthly convention (30×8)."),
  row("payroll.loan.capRatio", 0.1, "ratio", "92", "labour", "استرداد سلفة صاحب العمل: لا يزيد الحسم على عشرة في المائة من الأجر.", "Recovery of an employer advance: the deduction may not exceed ten percent of the wage."),
  row("payroll.deduction.capRatio", 0.5, "ratio", "93", "labour", "لا يجوز أن يتجاوز مجموع المبالغ المحسومة نصف الأجر المستحق، ما لم يثبت لدى هيئة تسوية الخلافات العمالية إمكان زيادة الحسم على ذلك.", "Total deductions may not exceed half the wage due, unless the labour disputes body allows a higher deduction."),
  row("payroll.wps.fileWindowDays", 30, "days", null, "wps", "نافذة رفع ملف حماية الأجور: 30 يوماً من تاريخ الاستحقاق (قرار الوزارة من 1 مارس 2025). ليست مادة من نظام العمل.", "Wage-protection file window: 30 days from entitlement (ministry decision from 1 March 2025). Not a Labour Law article."),
  row("payroll.wps.deadlineDayOfMonth", 30, "day_of_month", null, "wps", "مهلة حماية الأجور: 30 يوماً من نهاية شهر الاستحقاق. ليست مادة من نظام العمل.", "Wage-protection deadline: 30 days from the end of the entitlement month. Not a Labour Law article."),
  row("payroll.wage.payment.cite", 1, "days", "90", "labour", "يُدفع الأجر بالعملة الرسمية وفي مواعيده، ويجوز تحويله عبر البنوك المعتمدة.", "Wages are paid in the official currency on the due dates, and may be transferred through licensed banks."),

  row("contract.indefinite.cite", 1, "days", "75", "labour", "العقد غير محدد المدة يُنهى بإشعار مكتوب لسبب مشروع وفق المادة 75.", "An indefinite contract ends by written notice for a legitimate reason under Article 75."),
  row("contract.fixed.cite", 1, "days", "55", "labour", "العقد محدد المدة ينتهي بانقضاء مدته. استمرار الطرفين يحوّله وفق المادة 55، مع مراعاة المادة 37 لغير السعودي.", "A fixed-term contract ends when its term expires. Continued performance converts it under Article 55, subject to Article 37 for non-Saudis."),
  row("contract.nonSaudi.fixed.cite", 1, "days", "37", "labour", "عقد غير السعودي مكتوب ومحدد المدة. إن لم تُذكر المدة عُدّ سنة من تاريخ المباشرة ويتجدد لمثلها.", "A non-Saudi contract is written and fixed-term. If the term is omitted it is deemed one year from the start date and renews for a like period."),
  row("contract.nonSaudi.deemedTermDays", 365, "days", "37", "labour", "المدة المفترضة لعقد غير السعودي إن لم تُذكر المدة: سنة.", "Deemed term for a non-Saudi contract when duration is omitted: one year."),
  row("contract.written.cite", 1, "days", "51", "labour", "يُكتب عقد العمل من نسختين يحتفظ كل طرف بنسخة، ويُوثَّق وفق الأحكام النظامية.", "The employment contract is written in two copies, one for each party, and documented under the applicable rules."),
  row("contract.model.cite", 1, "days", "52", "labour", "نموذج الوزارة الموحّد لكل نوع عقد، وللطرفين إضافة بنود لا تخالف النظام.", "The Ministry's unified model for each contract type; the parties may add clauses that do not conflict with the Law."),
  row("contract.fixed.continuation.cite", 1, "days", "55", "labour", "إن استمر الطرفان بعد انتهاء المدة عُدّ العقد غير محدد المدة للسعودي، مع مراعاة المادة 37 لغير السعودي. التجديد ثلاث مرات أو أربع سنوات أيهما أقل ثم الاستمرار يحوّل العقد.", "If both parties continue after the term ends, a Saudi contract is deemed indefinite, subject to Article 37 for non-Saudis. Three consecutive renewals or four years, whichever is less, then continuing, converts the contract."),
  row("contract.fixed.maxConsecutiveRenewals", 3, "count", "55", "labour", "ثلاثة تجديدات متتالية حدّ التحويل إلى غير محدد المدة.", "Three consecutive renewals is the conversion cap to an indefinite term."),
  row("contract.fixed.maxYearsBeforeIndefinite", 4, "years", "55", "labour", "مدة العقد الأصلي مع التجديد أربع سنوات أيهما أقل.", "Original term plus renewals of four years, whichever threshold is reached first."),
  row("contract.pattern.flexible.cite", 1, "days", null, "ministerial", "اللائحة مادة 27: العمل المرن للسعوديين، أجره بالساعة، بلا إجازات مدفوعة ولا مكافأة نهاية خدمة ولا تجربة. الإرسال الحي لقوى عند الاعتماد.", "Implementing regulations Art. 27: flexible work is for Saudis, paid hourly, without paid leave, EOS award or probation. Live Qiwa send waits for credentials."),
  row("contract.pattern.flexible.nitaqatHours", 160, "hours", null, "ministerial", "اللائحة مادة 27: 160 ساعة عمل مرن مكتملة تعادل نقطة توطين للمنشأة.", "Implementing regulations Art. 27: 160 completed flexible hours equal one Saudization point."),
  row("contract.pattern.remote.cite", 1, "days", null, "ministerial", "العمل عن بُعد يُذكر في العقد ويُحفظ في الملف. الإرسال الحي لقوى عند الاعتماد.", "Remote work is stated in the contract and stored on the file. Live Qiwa send waits for credentials."),
  row("contract.pattern.partTime.cite", 1, "days", null, "ministerial", "اللائحة مادة 27: عقد العمل لبعض الوقت مكتوب ومحدد المدة وساعاته أقل من نصف ساعات المنشأة.", "Implementing regulations Art. 27: a part-time contract is written and fixed-term, with hours less than half the establishment's usual hours."),
  row("contract.casual.maxDays", 90, "days", null, "ministerial", "اللائحة مادة 1: استمرار العقد المؤقت أو العرضي أكثر من 90 يوماً يحوّله إلى عقد يخضع لأحكام النظام.", "Implementing regulations Art. 1: a temporary or casual contract that continues more than 90 days becomes subject to the Law."),
  row("contract.probation.maxDays", 180, "days", "53", "labour", "فترة التجربة تُذكر صراحة في العقد ولا تتجاوز 180 يوماً.", "Probation must be stated in the contract and may not exceed 180 days."),
  row("contract.probation.warnDays", 15, "days", null, "product", "تنبيه تشغيلي قبل انتهاء فترة التجربة بخمسة عشر يوماً — ليست مادة من نظام العمل.", "Operational watch fifteen days before probation ends — not a Labour Law article."),
  row("contract.probation.excludeOfficialHolidays.cite", 1, "days", null, "ministerial", "لائحة تنظيم العمل النموذجية: لا تدخل إجازات العيدين واليوم الوطني ويوم التأسيس والإجازة المرضية في حساب مدة التجربة.", "Model work-organization regulations: the two Eids, National Day, Founding Day and sick leave do not count toward the probation period."),
  row("contract.probation.once.cite", 1, "days", "54", "labour", "لا تجوز التجربة أكثر من مرة لدى صاحب عمل واحد إلا في مهنة أخرى أو بعد انقطاع لا يقل عن ستة أشهر.", "Probation may not be repeated with the same employer except in another occupation or after a break of at least six months."),
  row("contract.probation.rehireGapMonths", 6, "count", "54", "labour", "الاستثناء الثاني لتكرار التجربة: انقطاع لا يقل عن ستة أشهر.", "The second exception to repeating probation: a break of at least six months."),
  row("contract.notice.employerMonthlyDays", 60, "days", "75", "labour", "مهلة إشعار صاحب العمل في العقد غير المحدد بأجر شهري: 60 يوماً.", "Employer notice on an indefinite monthly-wage contract: 60 days."),
  row("contract.notice.workerMonthlyDays", 60, "days", "75", "labour", "قبل 19 فبراير 2025: إشعار أي من الطرفين 60 يوماً إذا كان الأجر شهرياً.", "Before 19 February 2025: either party's notice was 60 days if wages were monthly.", { to: BEFORE_AMENDMENT_2025 }),
  row("contract.notice.workerMonthlyDays", 30, "days", "75", "labour", "مهلة إشعار العامل في العقد غير المحدد بأجر شهري: 30 يوماً.", "Worker notice on an indefinite monthly-wage contract: 30 days.", { from: AMENDMENT_2025 }),
  row("contract.notice.otherDays", 30, "days", "75", "labour", "مهلة الإشعار لغير الأجر الشهري، وللطرفين: 30 يوماً.", "Notice for non-monthly pay, both parties: 30 days."),
  row("contract.notice.compensation.cite", 1, "days", "76", "labour", "من لم يراعِ مهلة الإشعار يدفع للطرف الآخر أجر المهلة ما لم يُتفق على أكثر.", "A party who does not observe the notice period pays the other party the wage for that period unless more is agreed."),
  row("contract.notice.jobSearchDaysPerWeek", 1, "days", "78", "labour", "إذا كان الإشعار من صاحب العمل: يوم كامل في الأسبوع للبحث عن عمل، بأجر، يختاره العامل بإشعار في اليوم السابق.", "If notice is given by the employer: one paid day a week to look for work, chosen by the worker with notice the day before."),
  row("contract.notice.jobSearchHoursPerWeek", 8, "hours", "78", "labour", "أو ثماني ساعات أثناء الأسبوع للبحث عن عمل، بأجر، بدل اليوم الكامل.", "Or eight paid hours during the week to look for work, instead of the full day."),
  row("contract.maternity.noDismissal.cite", 1, "days", "155", "labour", "يحظر فصل العاملة أو إنذارها بالفصل أثناء الحمل أو إجازة الوضع، ويشمل المرض الناشئ عنهما حتى 180 يوماً.", "A female worker may not be dismissed or given notice of dismissal during pregnancy or maternity leave, including related illness up to 180 days."),
  row("contract.resignation.autoAcceptDays", 30, "days", "79 مكرر", "labour", "الاستقالة المكتوبة تُعد مقبولة بعد 30 يوماً دون رد (المادة 79 مكرر).", "A written resignation is deemed accepted after 30 days without a reply (Article 79 bis).", { from: AMENDMENT_2025 }),
  row("contract.resignation.postponeMaxDays", 60, "days", "79 مكرر", "labour", "يجوز تأجيل قبول الاستقالة بمسوغ مكتوب حتى 60 يوماً (المادة 79 مكرر).", "Acceptance may be postponed with written justification for up to 60 days (Article 79 bis).", { from: AMENDMENT_2025 }),
  row("contract.resignation.withdrawDays", 7, "days", "79 مكرر", "labour", "للعامل سحب الاستقالة خلال 7 أيام من تقديمها (المادة 79 مكرر).", "The worker may withdraw the resignation within 7 days of submitting it (Article 79 bis).", { from: AMENDMENT_2025 }),
  row("contract.termination.cite", 1, "days", "74", "labour", "إنهاء العقد بسبب نظامي من المادة 74، مع المادة 80 و81 عند الفصل أو الترك.", "Ending the contract uses a statutory Article 74 reason, with Articles 80 and 81 for dismissal or leaving."),
  row("eos.gratuity.cite", 1, "days", "84", "labour", "مكافأة نهاية الخدمة: نصف شهر عن كل سنة من السنوات الخمس الأولى، وشهر عن كل سنة تالية، على آخر أجر.", "End-of-service award: half a month per year for the first five years, then a full month per later year, on last wage."),
  row("eos.resignation.cite", 1, "days", "85", "labour", "عند الاستقالة: لا مكافأة قبل سنتين، وثلث المكافأة من سنتين إلى خمس، وثلثان من خمس إلى عشر، والكاملة بعد عشر سنوات.", "On resignation: no award before two years; one-third from two to five; two-thirds from five to ten; the full award after ten years."),
  row("eos.art80.cite", 1, "days", "80", "labour", "الفصل وفق المادة 80 بغير مكافأة ولا إشعار ولا تعويض، بعد إتاحة الفرصة للعامل لبيان معارضته.", "Article 80 dismissal is without award, notice or compensation, after the worker is given a chance to state his objection."),
  row("eos.art81.cite", 1, "days", "81", "labour", "ترك العمل وفق المادة 81 يحفظ للعامل حقوقه النظامية كلها، ومنها مكافأة المادة 84 كاملة.", "Leaving under Article 81 preserves all statutory rights, including the full Article 84 award."),
  row("eos.art87.cite", 1, "days", "87", "labour", "تستحق المكافأة كاملة إذا ترك العامل العمل نتيجة قوة قاهرة، أو تركته العاملة خلال ستة أشهر من زواجها أو ثلاثة أشهر من الوضع.", "The full award is due if the worker leaves due to force majeure, or if a female worker leaves within six months of marriage or three months of childbirth."),
  row("eos.resignation.fullYears", 10, "years", "85", "labour", "الاستقالة بعد عشر سنوات تستحق المكافأة كاملة.", "Resignation after ten years is entitled to the full award."),
  row("eos.resignation.twoThirdsYears", 5, "years", "85", "labour", "الاستقالة بعد خمس سنوات وقبل عشر تستحق ثلثي المكافأة.", "Resignation after five and before ten years is entitled to two-thirds of the award."),
  row("eos.resignation.oneThirdYears", 2, "years", "85", "labour", "الاستقالة بعد سنتين وقبل خمس تستحق ثلث المكافأة. قبل سنتين لا تستحق.", "Resignation after two and before five years is entitled to one-third. Before two years there is no award."),
  row("eos.art87.marriageMonths", 6, "count", "87", "labour", "ترك العاملة خلال ستة أشهر من الزواج يستحق المكافأة كاملة.", "A female worker leaving within six months of marriage is entitled to the full award."),
  row("eos.art87.birthMonths", 3, "count", "87", "labour", "ترك العاملة خلال ثلاثة أشهر من الوضع يستحق المكافأة كاملة.", "A female worker leaving within three months of childbirth is entitled to the full award."),
  row("eos.settlement.employerDays", 7, "days", "88", "labour", "تصفية الحقوق خلال أسبوع على الأكثر إن أنهى صاحب العمل العلاقة.", "Settle entitlements within one week at most if the employer ended the relation."),
  row("eos.settlement.workerDays", 14, "days", "88", "labour", "تصفية الحقوق خلال أسبوعين إن أنهى العامل العقد.", "Settle entitlements within two weeks if the worker ended the contract."),
  row("eos.unusedLeave.cite", 1, "days", "111", "labour", "عند الترك يستحق أجرة أيام الإجازة المستحقة إن لم يتمتع بها، وأجرة الإجازة عن أجزاء السنة بنسبة ما قضاه في العمل.", "On leaving, pay is due for unused leave days, and for the incomplete leave year in proportion to time worked."),
  row("eos.unlawful.cite", 1, "days", "77", "labour", "إنهاء غير مشروع: خمسة عشر يوماً عن كل سنة إن كان العقد غير محدد، أو أجر المدة الباقية إن كان محدد المدة، وبحد أدنى أجر شهرين — ما لم يُنص على تعويض في العقد. لا يُضاف إلى مكافأة نهاية الخدمة إلا بحكم.", "Unlawful termination: fifteen days' wage per year if indefinite, or the remaining term if fixed, with a floor of two months' wage — unless the contract sets compensation. Not added to the end-of-service total except by ruling."),
  row("eos.unlawful.perYearDays", 15, "days", "77", "labour", "تعويض العقد غير المحدد: خمسة عشر يوماً عن كل سنة خدمة.", "Indefinite-contract indemnity: fifteen days' wage per year of service."),
  row("eos.unlawful.minMonths", 2, "count", "77", "labour", "حد أدنى لتعويض الإنهاء غير المشروع: أجر شهرين.", "Floor for unlawful-termination compensation: two months' wage."),
  row("discipline.penalties.cite", 1, "days", "66", "labour", "الجزاءات التأديبية الجائز توقيعها: إنذار، غرامة، حرمان من علاوة أو تأجيلها، تأجيل ترقية، إيقاف، فصل في الحالات المقررة.", "Disciplinary penalties that may be imposed: warning, fine, withholding or deferring an increment, deferring promotion, suspension, and dismissal in the prescribed cases."),
  row("discipline.listedOnly.cite", 1, "days", "67", "labour", "لا يُوقَّع جزاء غير وارد في النظام أو في لائحة تنظيم العمل.", "No penalty may be imposed that is not provided for in the Law or the work-organization regulations."),
  row("discipline.repeat.cooloffDays", 180, "days", "68", "labour", "لا يُشدَّد الجزاء عند التكرار إذا مضى 180 يوماً على إبلاغ الجزاء السابق.", "A repeat penalty may not be increased if 180 days have passed since notice of the previous penalty."),
  row("discipline.charge.maxDays", 30, "days", "69", "labour", "لا يُتهم العامل بمخالفة مضى على كشفها أكثر من ثلاثين يوماً، ولا يُوقَّع الجزاء بعد انتهاء التحقيق بأكثر من ثلاثين يوماً.", "A worker may not be accused more than thirty days after the offence was discovered, nor penalised more than thirty days after the investigation ended."),
  row("discipline.fine.maxDays", 5, "days", "70", "labour", "غرامة المخالفة الواحدة لا تزيد على أجر خمسة أيام، ولا يُحسم وفاءً للغرامات أكثر من أجر خمسة أيام في الشهر، ولا يزيد الإيقاف دون أجر على خمسة أيام في الشهر.", "A single-offence fine may not exceed five days' wage, monthly fine deductions may not exceed five days' wage, and unpaid suspension may not exceed five days in a month."),
  row("discipline.hearing.cite", 1, "days", "71", "labour", "لا جزاء إلا بعد إبلاغ كتابي بما نُسب واستجواب وتحقيق الدفاع وإثبات ذلك في محضر بالملف.", "No penalty without written notice of the accusation, questioning, hearing the defence, and minutes placed on the file."),
  row("discipline.appeal.internalDays", 30, "days", "72", "labour", "التظلم الداخلي من الجزاء خلال 30 يوماً.", "Internal appeal of a sanction within 30 days."),
  row("discipline.decision.days", 15, "days", "72", "labour", "البت في التظلم خلال 15 يوماً.", "Decide the internal appeal within 15 days."),
  row("discipline.fines.register.cite", 1, "days", "73", "labour", "سجل الغرامات: الاسم والأجر ومقدار الغرامة وسببها وتاريخها. تُصرف الغرامات لنفع العمال عبر اللجنة العمالية أو بموافقة الوزارة.", "Fine register: name, wage, amount, reason, and date. Fines are used for the workers' benefit by the labour committee, or with the Ministry's approval."),
  row("hours.night.startHour", 23, "hours", null, "product", "تصنيف الوردية الليلية يبدأ الساعة 23:00 — قرار تشغيلي مرمّز، ليست شارة مادة حتى يُثبَّت الرقم.", "Night-shift classification starts at 23:00 — encoded operationally, no Labour Law chip until the article is confirmed."),
  row("hours.night.endHour", 6, "hours", null, "product", "تصنيف الوردية الليلية ينتهي الساعة 06:00.", "Night-shift classification ends at 06:00."),
  row("hours.heat.startHour", 12, "hours", null, "ministerial", "حظر العمل في الميدان المكشوف من 12:00 — قرار وزاري سنوي من الوزارة، ليست شارة مادة من نظام العمل.", "Outdoor field-work ban from 12:00 — an annual ministerial decision, not a Labour Law article chip."),
  row("hours.heat.endHour", 15, "hours", null, "ministerial", "حظر العمل في الميدان المكشوف حتى 15:00.", "Outdoor field-work ban until 15:00."),
  row("hours.heat.fromMonth", 6, "count", null, "ministerial", "بداية موسم حظر الشمس: يونيو.", "Heat-ban season starts in June."),
  row("hours.heat.fromDay", 15, "day_of_month", null, "ministerial", "حظر الشمس من 15 يونيو حتى 15 سبتمبر وفق إعلان الوزارة لعام 2026.", "Heat ban from 15 June to 15 September per the ministry's 2026 announcement."),
  row("hours.heat.toMonth", 9, "count", null, "ministerial", "نهاية موسم حظر الشمس: سبتمبر.", "Heat-ban season ends in September."),
  row("hours.heat.toDay", 15, "day_of_month", null, "ministerial", "آخر يوم لحظر الشمس: 15 سبتمبر.", "Last heat-ban day: 15 September."),
  row("leave.sick.fullPayDays", 30, "days", "117", "labour", "الإجازة المرضية: ثلاثون يوماً بأجر كامل.", "Sick leave: thirty days at full pay."),
  row("leave.sick.halfPayDays", 60, "days", "117", "labour", "ثم ستون يوماً بثلاثة أرباع الأجر.", "Then sixty days at three-quarters pay."),
  row("leave.sick.midPayRatio", 0.75, "ratio", "117", "labour", "شريحة الإجازة المرضية الوسطى بثلاثة أرباع الأجر.", "The middle sick-leave band is paid at three-quarters."),
  row("leave.sick.unpaidDays", 30, "days", "117", "labour", "ثم ثلاثون يوماً بلا أجر.", "Then thirty days without pay."),
  row("leave.unpaid.suspendAfterDays", 20, "days", "116", "labour", "إيقاف عقد العمل فيما زاد على عشرين يوماً من الإجازة بلا أجر، ما لم يتفق الطرفان على خلاف ذلك.", "The contract is suspended for unpaid leave beyond twenty days, unless the parties agree otherwise."),

  row("compliance.establishment.dataUpdateDays", 10, "days", null, "ministerial", "اللائحة مادة 4 مكرر: تحديث بيانات المنشأة عبر المنصة المعتمدة خلال 10 أيام من أي تغيير في العنوان أو البيانات.", "Implementing regulations Art. 4 bis: update establishment data on the approved platform within 10 days of a change of address or particulars."),
  row("compliance.doc.expiryWarnDays", 60, "days", null, "product", "تنبيه انتهاء وثيقة قبل هذا العدد من الأيام.", "Document-expiry warning window."),
  row("compliance.gosi.employeeRate", 0.0975, "ratio", null, "gosi", "نسبة اشتراك الموظف كما هي مرمّزة للعرض.", "Employee GOSI rate as currently encoded."),
  row("compliance.gosi.employerRate", 0.1175, "ratio", null, "gosi", "نسبة اشتراك صاحب العمل كما هي مرمّزة للعرض.", "Employer GOSI rate as currently encoded."),
  row("compliance.ajeer.cite", 1, "days", null, "programme", "أجير خدمة وزارية للعمالة الزائرة/المؤقتة — الإرسال الحي قيد الاعتمادات الرسمية.", "Ajeer is a ministry service for visiting/temporary labour — live send waits for official credentials."),
  row("safety.hygiene.cite", 1, "days", "121", "labour", "يحفظ صاحب العمل المنشأة في حالة صحية ونظيفة ويؤمّن الإنارة والمياه وفق ما يحدده الوزير.", "The employer keeps the establishment hygienic and clean and provides lighting and water as the Minister determines."),
  row("safety.precautions.cite", 1, "days", "122", "labour", "يتخذ صاحب العمل الاحتياطات اللازمة لحماية العمال من أخطار العمل والآلات، ولا يحمّلهم كلفتها.", "The employer takes the precautions needed to protect workers from work and machinery hazards, and does not charge them for that protection."),
  row("safety.inform.cite", 1, "days", "123", "labour", "يُحاط العامل قبل مزاولة العمل بمخاطر المهنة، ويُلزم بوسائل الوقاية، وتُوفَّر مهمات الوقاية الشخصية.", "The worker is informed of occupational hazards before starting work, required to use protection, and provided with PPE."),
  row("safety.ppe.cite", 1, "days", "123", "labour", "يوفر صاحب العمل مهمات الوقاية الشخصية المناسبة ويدرب العمال على استخدامها.", "The employer provides suitable personal protective equipment and trains workers in its use."),
];

export function laborDayKey(value?: string | Date | null) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const raw = String(value ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Umm al-Qura Gregorian windows for Ramadan — operational, not a live ministry calendar. */
export const RAMADAN_WINDOWS = [
  { from: "2025-03-01", to: "2025-03-29" },
  { from: "2026-02-18", to: "2026-03-19" },
  { from: "2027-02-08", to: "2027-03-09" },
  { from: "2028-01-28", to: "2028-02-26" },
] as const;

export function isRamadanDay(value?: string | Date | null) {
  const day = laborDayKey(value);
  return RAMADAN_WINDOWS.some((w) => w.from <= day && day <= w.to);
}

/** In-force row for an id on a local calendar day. Latest effectiveFrom wins. */
export function ruleAt(id: string, onDate?: string | Date | null, catalog: LaborRule[] = LABOR_RULES) {
  const day = laborDayKey(onDate);
  const rows = catalog.filter((r) => r.id === id);
  if (!rows.length) return null;
  const inForce = rows.filter(
    (r) => r.effectiveFrom <= day && (!r.effectiveTo || day <= r.effectiveTo),
  );
  if (!inForce.length) return null;
  return [...inForce].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] || null;
}

export function ruleValue(id: string, onDate?: string | Date | null, catalog?: LaborRule[]) {
  const row = ruleAt(id, onDate, catalog);
  if (!row || typeof row.value !== "number") {
    throw new Error(`LABOR_RULE_MISSING:${id}`);
  }
  return row.value;
}

/** Statutory chip payload. Null when the in-force row has no Labour Law article. */
export function citeRule(id: string, onDate?: string | Date | null, catalog?: LaborRule[]): LaborCite | null {
  const row = ruleAt(id, onDate, catalog);
  if (!row?.article || row.source !== "labour") return null;
  const official = articleOfficialText(row.article, onDate);
  return {
    id: row.id,
    article: row.article,
    value: row.value,
    unit: row.unit,
    labelAr: `المادة ${row.article}`,
    labelEn: `Art. ${row.article}`,
    hintAr: row.hintAr,
    hintEn: row.hintEn,
    textAr: official?.ar || "",
    textEn: official?.en || "",
    sourceUrl: official?.sourceUrl || BOE_LABOUR_LAW_URL,
  };
}

export function leaveRuleId(type: string) {
  const key = String(type || "").trim().toLowerCase();
  return key ? `leave.${key}.days` : "";
}

export function citeLeaveType(type: string, onDate?: string | Date | null) {
  const key = String(type || "").trim().toLowerCase();
  if (!key) return null;
  return citeRule(`leave.${key}.days`, onDate) || citeRule(`leave.${key}.cite`, onDate);
}

export type LaborExplain = {
  id: string;
  source: LaborRuleSource;
  article: string | null;
  value: number;
  unit: LaborRuleUnit;
  labelAr: string | null;
  labelEn: string | null;
  hintAr: string;
  hintEn: string;
  sourceUrl: string;
};

/** Hint + optional المادة. Product/WPS/GOSI rows return text without a statutory chip. */
export function explainRule(
  id: string,
  onDate?: string | Date | null,
  catalog?: LaborRule[],
): LaborExplain | null {
  const row = ruleAt(id, onDate, catalog);
  if (!row) return null;
  const labour = row.source === "labour" && row.article;
  return {
    id: row.id,
    source: row.source,
    article: labour ? row.article : null,
    value: row.value,
    unit: row.unit,
    labelAr: labour ? `المادة ${row.article}` : (row.source === "ministerial" ? "قرار وزاري" : null),
    labelEn: labour ? `Art. ${row.article}` : (row.source === "ministerial" ? "Ministerial decision" : null),
    hintAr: row.hintAr,
    hintEn: row.hintEn,
    sourceUrl: HRSD_CATALOGUE_URL,
  };
}

export function explainLeaveType(type: string, onDate?: string | Date | null) {
  const key = String(type || "").trim().toLowerCase();
  if (!key) return null;
  return explainRule(`leave.${key}.days`, onDate) || explainRule(`leave.${key}.cite`, onDate);
}
