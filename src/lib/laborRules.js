/** Client mirror of base44/shared/laborRules.ts — keep in sync.
 *  Labour Law as dated operational rules. Cite a المادة only when source is labour.
 */

import { articleOfficialText, BOE_LABOUR_LAW_URL, HRSD_LABOUR_LAW_PDF, HRSD_LABOUR_LAW_EDITION } from "./laborArticleTexts.js";

export const HRSD_CATALOGUE_URL = "https://www.hrsd.gov.sa/knowledge-centre/decisions-and-regulations/regulation-and-procedures";
export const HRSD_IMPLEMENTING_REGS_URL = "https://www.hrsd.gov.sa/sites/default/files/2025-04/%D8%A7%D9%84%D9%84%D8%A7%D8%A6%D8%AD%D8%A9%20%D8%A7%D9%84%D8%AA%D9%86%D9%81%D9%8A%D8%B0%D9%8A%D8%A9%20%D9%84%D9%86%D8%B8%D8%A7%D9%85%20%D8%A7%D9%84%D8%B9%D9%85%D9%84%20%D9%88%D9%85%D9%84%D8%AD%D9%82%D8%A7%D8%AA%D9%87%D8%A7.pdf";
export { BOE_LABOUR_LAW_URL, HRSD_LABOUR_LAW_PDF, HRSD_LABOUR_LAW_EDITION };

const ENCODED_FROM = "2005-01-01";

const AMENDMENT_2025 = "2025-02-19";
const BEFORE_AMENDMENT_2025 = "2025-02-18";

function row(id, value, unit, article, source, hintAr, hintEn, dates = {}) {
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

export const LABOR_RULES = [
  row("leave.annual.days", 21, "days", "109", "labour", "إجازة سنوية 21 يوماً بأجر كامل، وترتفع إلى 30 يوماً بعد خمس سنوات خدمة.", "Annual leave 21 days on full pay, rising to 30 after five years of service."),
  row("leave.annual.afterFiveYearsDays", 30, "days", "109", "labour", "ترتفع الإجازة السنوية إلى 30 يوماً بعد خمس سنوات خدمة.", "Annual leave rises to 30 days after five years of service."),
  row("leave.annual.carry.cite", 1, "days", "110", "labour", "يجوز تأجيل الإجازة السنوية إلى السنة التالية بموافقة صاحب العمل. لصاحب العمل التأجيل حتى 90 يوماً بعد سنة الاستحقاق، وأبعد من ذلك بموافقة كتابية على ألا يتجاوز نهاية السنة التالية.", "Annual leave may be postponed to the next year with the employer's approval. The employer may postpone up to 90 days after the entitlement year, and further only with written consent, not beyond the end of the following year."),
  row("leave.annual.deferMaxDays", 90, "days", "110", "labour", "تأجيل صاحب العمل للإجازة السنوية بعد سنة الاستحقاق لا يزيد على تسعين يوماً إلا بموافقة العامل كتابة.", "The employer may postpone annual leave after the entitlement year by no more than ninety days without the worker's written consent."),
  row("leave.annual.noticeDays", 30, "days", "109", "labour", "إذا حدّد صاحب العمل ميعاد الإجازة السنوية وجب إشعار العامل قبل ثلاثين يوماً على الأقل. طلب العامل لتواريخه لا يخضع لهذه المهلة.", "If the employer sets the annual-leave dates, the worker must be notified at least thirty days ahead. A worker-chosen request is not subject to this notice."),
  row("leave.sick.days", 120, "days", "117", "labour", "إجازة مرضية خلال السنة الواحدة: 30 يوماً بأجر كامل، ثم 60 بثلاثة أرباع الأجر، ثم 30 بلا أجر — 120 يوماً متصلة أو متقطعة من تاريخ أول إجازة مرضية.", "Sick leave in one year: 30 days at full pay, then 60 at three-quarters, then 30 unpaid — 120 days continuous or intermittent from the first sick leave."),
  row("leave.maternity.days", 70, "days", "151", "labour", "إجازة وضع عشرة أسابيع بأجر كامل — النص قبل نفاذ تعديل 19 فبراير 2025.", "Maternity leave of ten weeks on full pay — the text before the 19 February 2025 amendment.", { to: BEFORE_AMENDMENT_2025 }),
  row("leave.maternity.days", 84, "days", "151", "labour", "إجازة وضع اثنا عشر أسبوعاً بأجر كامل. ستة أسابيع بعد الوضع وجوبية، وتوزَّع الستة الباقية ابتداءً من أربعة أسابيع قبل التاريخ المرجح بشهادة طبية.", "Maternity leave of twelve weeks on full pay. Six weeks after birth are mandatory; the remaining six may start up to four weeks before the expected date with a medical certificate.", { from: AMENDMENT_2025 }),
  row("leave.maternity.mandatoryPostDays", 42, "days", "151", "labour", "الأسابيع الستة التالية للوضع وجوبية.", "The six weeks after birth are mandatory.", { from: AMENDMENT_2025 }),
  row("leave.maternity.preDaysMax", 28, "days", "151", "labour", "يجوز بدء الإجازة قبل أربعة أسابيع من التاريخ المرجح للوضع.", "Leave may start up to four weeks before the expected date of birth.", { from: AMENDMENT_2025 }),
  row("leave.maternity.unpaidExtendDays", 30, "days", "151", "labour", "يجوز تمديد إجازة الوضع شهراً دون أجر.", "Maternity leave may be extended by one unpaid month.", { from: AMENDMENT_2025 }),
  row("leave.maternity.disabledChildDays", 30, "days", "151", "labour", "إنجاب طفل مريض أو من ذوي الإعاقة يحتاج مرافقاً: شهر إضافي بأجر كامل بعد إجازة الوضع — المادة 151 فقرة 2.", "A sick or disabled newborn who needs a constant companion: one extra month on full pay after maternity leave — Article 151(2).", { from: AMENDMENT_2025 }),
  row("leave.maternity_extend.days", 30, "days", "151", "labour", "تمديد إجازة الوضع شهراً دون أجر بعد انتهائها — المادة 151 فقرة 1. ليست إجازة المادة 116 فلا يُوقف العقد بعد 20 يوماً.", "One unpaid month after maternity leave ends — Article 151(1). It is not Article 116 leave, so the contract does not suspend after 20 days.", { from: AMENDMENT_2025 }),
  row("leave.maternity_companion.days", 30, "days", "151", "labour", "شهر بأجر كامل بعد إجازة الوضع لمرافقة مولود مريض أو ذي إعاقة يحتاج مرافقاً مستمراً، مع حق تمديد شهر دون أجر — المادة 151 فقرة 2.", "One paid month after maternity leave to accompany a sick or disabled newborn who needs a constant companion, with a further unpaid month — Article 151(2).", { from: AMENDMENT_2025 }),
  row("leave.paternity.days", 3, "days", "113", "labour", "إجازة مولود ثلاثة أيام بأجر كامل خلال سبعة أيام من تاريخ الولادة.", "Paternity leave of three days on full pay within seven days of the birth."),
  row("leave.paternity.windowDays", 7, "days", "113", "labour", "تُؤخذ إجازة المولود خلال سبعة أيام من تاريخ الولادة.", "Paternity leave must be taken within seven days of the birth."),
  row("leave.marriage.days", 5, "days", "113", "labour", "إجازة زواج خمسة أيام بأجر كامل من تاريخ الواقعة.", "Marriage leave of five days on full pay from the date of the event."),
  row("leave.bereavement.days", 5, "days", "113", "labour", "إجازة خمسة أيام من تاريخ الواقعة: للعامل وفاة زوجه أو أصل أو فرع. وفاة زوج العاملة مسار العدّة في المادة 160، فتبقى لها هنا وفاة الأصل أو الفرع فقط.", "Five days from the event: a male worker for spouse, parent or child. A female worker's husband death is iddah under Article 160; this type is parent or child only for her."),
  row("leave.bereavement_sibling.days", 3, "days", "113", "labour", "إجازة ثلاثة أيام لوفاة الأخ أو الأخت، من تاريخ الواقعة.", "Three days on the death of a sibling, from the date of the event.", { from: AMENDMENT_2025 }),
  row("leave.hajj.days", 10, "days", "114", "labour", "إجازة حج لا تقل عن عشرة أيام ولا تزيد على خمسة عشر يوماً شاملة عيد الأضحى، مرة واحدة بعد سنتين متصلتين إن لم يُؤدَّ الحج من قبل.", "Hajj leave of ten to fifteen days including Eid al-Adha, once after two consecutive years if Hajj has not been performed before."),
  row("leave.hajj.maxDays", 15, "days", "114", "labour", "الحد الأعلى لإجازة الحج خمسة عشر يوماً شاملة عيد الأضحى.", "Hajj leave may not exceed fifteen days including Eid al-Adha."),
  row("leave.hajj.minServiceYears", 2, "years", "114", "labour", "يشترط لإجازة الحج سنتان متصلتان في الخدمة.", "Hajj leave requires two consecutive years of service."),
  row("leave.exam.cite", 1, "days", "115", "labour", "إجازة أداء الامتحان وفق نص المادة 115: بأجر إن وافق صاحب العمل وكانت السنة غير معادة، وبلا أجر إن أُعيدت. إن لم يوافق على الانتساب تبقى الإجازة من السنوية أو بلا أجر — لا يُرفض الطلب المستوفي. يُقدَّم الطلب قبل خمسة عشر يوماً مع إثبات المواعيد. إن وصل الجدول بعد المهلة: الورقة وتاريخ صدورها في يومها أو اليوم التالي. إثبات الأداء ورقة ثانية بعد الامتحان على البطاقة نفسها.", "Exam leave under the text of Article 115: paid if the employer agrees and it is a first sitting; unpaid if a repeat. If enrolment is refused the leave stays from annual or unpaid — a qualifying request is not refused. Fifteen days' notice with the timetable. If the paper arrives late: attach it with its issue date on that day or the next. Sitting proof is a second paper after the exam, on the same card."),
  row("leave.exam.noticeDays", 15, "days", "115", "labour", "يُقدَّم طلب إجازة الامتحان قبل موعدها بخمسة عشر يوماً على الأقل. إن وصل جدول المواعيد بعد المهلة يُقبل الطلب بورقة الجدول وتاريخ صدورها في يوم الورقة أو اليوم التالي — المهلة لا تسقط.", "The exam-leave request must be submitted at least fifteen days before it is due. If the timetable paper arrives after that window, the request is accepted with the paper and its issue date on that day or the next — the notice does not lapse."),
  row("leave.unpaid.cite", 1, "days", "116", "labour", "الإجازة بلا أجر توقف عقد العمل فيما زاد على عشرين يوماً ما لم يتفق الطرفان على خلاف ذلك.", "Unpaid leave suspends the contract for any period beyond twenty days unless the parties agree otherwise."),
  row("leave.eid.cite", 1, "days", "112", "labour", "إجازة الأعياد والمناسبات بأجر كامل وفق ما تحدده اللائحة.", "Paid leave on the Eids and occasions specified in the Regulations."),
  row("leave.eid.fitrDays", 4, "days", null, "ministerial", "اللائحة التنفيذية مادة 24: عيد الفطر أربعة أيام تبدأ من اليوم التالي لـ 29 رمضان حسب تقويم أم القرى. ليست شارة مادة.", "Implementing regulations Art. 24: Eid al-Fitr is four days starting the day after 29 Ramadan on the Umm al-Qura calendar. No Labour Law chip."),
  row("leave.eid.adhaDays", 4, "days", null, "ministerial", "اللائحة التنفيذية مادة 24: عيد الأضحى أربعة أيام تبدأ من يوم الوقوف بعرفة.", "Implementing regulations Art. 24: Eid al-Adha is four days starting on the Day of Arafah."),
  row("leave.nationalDay.days", 1, "days", null, "ministerial", "إجازة اليوم الوطني — يوم واحد في 23 سبتمبر (أول يوم من برج الميزان حسب أم القرى). اللائحة التنفيذية مادة 24.", "National Day leave — one day on 23 September (first day of Libra on the Umm al-Qura calendar). Implementing regulations Art. 24."),
  row("leave.foundingDay.days", 1, "days", null, "ministerial", "إجازة يوم التأسيس — يوم واحد في 22 فبراير. اللائحة التنفيذية مادة 24.", "Founding Day leave — one day on 22 February. Implementing regulations Art. 24."),
  row("leave.eid.overlap.cite", 1, "days", null, "ministerial", "اللائحة مادة 24 ثانياً: تداخل العيد مع الراحة الأسبوعية يُعوَّض، ومع السنوية تُمدَّد، ومع المرضية يُدفع الأجر الكامل. اليوم الوطني أو التأسيس مع أحد العيدين لا يُعوَّض.", "Implementing regulations Art. 24(2): overlap with weekly rest is compensated, annual leave is extended, sick leave still pays full wage for the Eid days. National or Founding Day falling in an Eid is not extra-compensated."),
  row("leave.noOtherEmployer.cite", 1, "days", "118", "labour", "لا يعمل العامل لدى صاحب عمل آخر أثناء أي إجازة في هذا الفصل، وإلا جاز حرمانه من أجر الإجازة أو استرداده.", "A worker may not work for another employer during any leave in this chapter; otherwise leave pay may be withheld or recovered."),
  row("leave.nursing.dailyMinutes", 60, "minutes", "154", "labour", "بعد العودة من إجازة الوضع: فترات إرضاع لا تزيد في مجموعها على ساعة في اليوم، ضمن ساعات العمل الفعلية وبلا تخفيض أجر.", "After returning from maternity leave: nursing rest totalling not more than one hour a day, counted as actual hours with no wage cut."),
  row("leave.iddah.days", 130, "days", "160", "labour", "عدّة المسلمة المتوفى عنها زوجها: أربعة أشهر وعشرة أيام بأجر كامل من تاريخ الوفاة — 130 يوماً بحساب شهر العمل 30 يوماً.", "Iddah for a Muslim widow: four months and ten days on full pay from the date of death — 130 days on the 30-day work-month."),
  row("leave.iddah.nonMuslimDays", 15, "days", "160", "labour", "عدّة غير المسلمة المتوفى عنها زوجها: خمسة عشر يوماً بأجر كامل من تاريخ الوفاة.", "Iddah for a non-Muslim widow: fifteen days on full pay from the date of death."),
  row("leave.iddah.cite", 1, "days", "160", "labour", "المادة 160: عدّة بأجر كامل. المسلمة 4 أشهر و10 أيام، وغير المسلمة 15 يوماً. تمديد بلا أجر إن كانت حاملاً حتى تضع، ولا تُكمَّل العدة بعد الوضع. وثائق مؤيدة، ولا عمل لدى الغير.", "Article 160: paid iddah. A Muslim widow has 4 months and 10 days; a non-Muslim widow has 15 days. Unpaid extension if pregnant until birth; remaining iddah is not used after birth. Supporting papers, and no other employer."),
  row("leave.emergency.days", 5, "days", null, "product", "رصيد اضطراري داخلي — ليست مادة مستقلة.", "Internal emergency balance — not a standalone article."),
  row("leave.attachment.thresholdDays", 5, "days", null, "product", "بوابة مرفق للمنصة إن تجاوز الطلب هذا الحد.", "Product attachment gate when the request exceeds this many days."),

  row("hours.shift.ordinaryHours", 8, "hours", "98", "labour", "ساعات العمل العادية في اليوم ثمانٍ، أو ثمان وأربعون في الأسبوع.", "Ordinary hours are eight a day, or forty-eight a week."),
  row("hours.week.ordinaryMaxHours", 48, "hours", "98", "labour", "الحد الأسبوعي لساعات العمل العادية ثمان وأربعون ساعة.", "Weekly cap on ordinary hours is forty-eight."),
  row("hours.ramadan.ordinaryHours", 6, "hours", "98", "labour", "في رمضان تُخفَّض ساعات العمل الفعلية للمسلمين إلى ست ساعات في اليوم. الفراغ على الملف = مسلم. غير المسلم المسجّل مستثنى.", "In Ramadan, actual hours for Muslims are reduced to six a day. An empty file is treated as Muslim. A recorded non-Muslim is exempt."),
  row("hours.ramadan.weekMaxHours", 36, "hours", "98", "labour", "في رمضان تُخفَّض ساعات العمل الفعلية للمسلمين إلى ست وثلاثين ساعة في الأسبوع. الفراغ على الملف = مسلم. غير المسلم المسجّل مستثنى.", "In Ramadan, actual hours for Muslims are reduced to thirty-six a week. An empty file is treated as Muslim. A recorded non-Muslim is exempt."),
  row("hours.ramadan.compressedTwelveStay.cite", 1, "days", "98", "labour", "المادة 98 معياران: خمسة أيام وثماني ساعات معيار يومي فينزل في رمضان إلى ست ساعات. أربعة أيام بقاء 12 ساعة وأربعة راحة معيار أسبوعي فتبقى الـ12 ساعة بقاء.", "Article 98 has two criteria: five days × eight hours is daily, so Ramadan drops to six. Four 12h-stay days + four rest is weekly, so the 12h stay remains."),
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
  row("hours.ot.art106.inventoryMaxDays", 30, "days", "106", "labour", "المادة 106: الجرد السنوي وإعداد الميزانية وضغط العمل غير العادي — التكليف الإجباري لا يزيد على ثلاثين يوماً في السنة.", "Article 106: annual inventory, preparing the budget, and unusual work pressure — mandatory assignment may not exceed thirty days in the year."),
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
  row("contract.workplace.transfer.cite", 1, "days", "58", "labour", "لا يُنقل العامل إلى مكان يقتضي تغيير محل إقامته إلا بموافقته كتابةً. للضرورة العارضة حتى ثلاثين يوماً في السنة دون موافقة، مع تحمل صاحب العمل تكاليف الانتقال والإقامة.", "A worker may not be moved to a place that requires changing residence except with written consent. For incidental necessity up to thirty days a year, the employer may assign without consent and bears travel and lodging."),
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
  row("discipline.increment.maxMonths", 12, "months", "66", "labour", "حرمان العلاوة أو تأجيلها لا يزيد على سنة متى كانت مقررة من صاحب العمل.", "Withholding or deferring an increment may not exceed one year when the increment is granted by the employer."),
  row("discipline.promotion.maxMonths", 12, "months", "66", "labour", "تأجيل الترقية لا يزيد على سنة متى كانت مقررة من صاحب العمل.", "Deferring promotion may not exceed one year when promotion is granted by the employer."),
  row("discipline.listedOnly.cite", 1, "days", "67", "labour", "لا يُوقَّع جزاء غير وارد في النظام أو في لائحة تنظيم العمل.", "No penalty may be imposed that is not provided for in the Law or the work-organization regulations."),
  row("discipline.repeat.cooloffDays", 180, "days", "68", "labour", "لا يُشدَّد الجزاء عند التكرار إذا مضى 180 يوماً على إبلاغ الجزاء السابق.", "A repeat penalty may not be increased if 180 days have passed since notice of the previous penalty."),
  row("discipline.charge.maxDays", 30, "days", "69", "labour", "لا يُتهم العامل بمخالفة مضى على كشفها أكثر من ثلاثين يوماً، ولا يُوقَّع الجزاء بعد انتهاء التحقيق بأكثر من ثلاثين يوماً.", "A worker may not be accused more than thirty days after the offence was discovered, nor penalised more than thirty days after the investigation ended."),
  row("discipline.fine.maxDays", 5, "days", "70", "labour", "غرامة المخالفة الواحدة لا تزيد على أجر خمسة أيام، ولا يُحسم وفاءً للغرامات أكثر من أجر خمسة أيام في الشهر، ولا يزيد الإيقاف دون أجر على خمسة أيام في الشهر.", "A single-offence fine may not exceed five days' wage, monthly fine deductions may not exceed five days' wage, and unpaid suspension may not exceed five days in a month."),
  row("discipline.workplace.cite", 1, "days", "70", "labour", "لا جزاء على أمر ارتُكب خارج مكان العمل ما لم يكن متصلاً بالعمل أو بصاحبه أو بمديره المسؤول.", "No penalty for an act committed outside the workplace unless it is connected with the work, the employer, or the responsible manager."),
  row("discipline.hearing.cite", 1, "days", "71", "labour", "لا جزاء إلا بعد إبلاغ كتابي بما نُسب واستجواب وتحقيق الدفاع وإثبات ذلك في محضر بالملف. ويجوز الاستجواب شفاهة في المخالفات البسيطة (إنذار أو غرامة لا تجاوز أجر يوم) على أن يُثبت في المحضر.", "No penalty without written notice of the accusation, questioning, hearing the defence, and minutes placed on the file. Questioning may be oral for minor offences (a warning or a fine not exceeding one day's wage) if that is recorded in the minutes."),
  row("discipline.appeal.internalDays", 30, "days", "72", "labour", "التظلم الداخلي من الجزاء خلال 30 يوماً عدا أيام العطل الرسمية.", "Internal appeal of a sanction within 30 days excluding official holidays."),
  row("discipline.decision.days", 15, "days", "72", "labour", "البت في التظلم خلال 15 يوماً.", "Decide the internal appeal within 15 days."),
  row("discipline.fines.register.cite", 1, "days", "73", "labour", "سجل الغرامات: الاسم والأجر ومقدار الغرامة وسببها وتاريخها. تُصرف الغرامات لنفع العمال عبر اللجنة العمالية أو بموافقة الوزارة.", "Fine register: name, wage, amount, reason, and date. Fines are used for the workers' benefit by the labour committee, or with the Ministry's approval."),
  row("discipline.record.eraseDays", 365, "days", null, "product", "الجزاء يُمحى من سجل الموظف الظاهر بعد سنة من توقيعه، ويبقى في أرشيف الشركة.", "A sanction drops off the employee's visible record one year after it is signed, and stays in the company archive."),
  row("hours.night.startHour", 23, "hours", null, "ministerial", "القرار 18632 لسنة 1441هـ (ساري 2020-01-01 / 1441-05-01): الليل من 23:00. الساعات العادية من 06:00.", "Decision 18632 of 1441 AH (from 2020-01-01 / 1441-05-01): night starts at 23:00. Ordinary hours start at 06:00.", { from: "2020-01-01" }),
  row("hours.night.endHour", 6, "hours", null, "ministerial", "القرار 18632: الليل حتى 06:00، ثم ساعات عادية.", "Decision 18632: night ends at 06:00, then ordinary hours.", { from: "2020-01-01" }),
  row("hours.night.workerHours", 3, "hours", null, "ministerial", "القرار 18632: عامل ليلي من يعمل ثلاث ساعات فأكثر بين 23:00 و06:00. أي دقيقة داخل النافذة = يؤدي عملاً ليلياً، ولو قلت عن ثلاث ساعات.", "Decision 18632: a night worker works three hours or more between 23:00 and 06:00. Any minute in that window performs night work, even under three hours.", { from: "2020-01-01" }),
  row("hours.night.restHours", 12, "hours", null, "ministerial", "القرار 18632: راحة لا تقل عن 12 ساعة بين يومي عمل لكل من يؤدي عملاً ليلياً — ليست حصراً على العامل الليلي.", "Decision 18632: at least 12 hours rest between two work days for anyone who performs night work — not only night workers.", { from: "2020-01-01" }),
  row("hours.night.rotateWeeks", 13, "weeks", null, "ministerial", "القرار 18632: لا إسناد متواصل كعامل ليلي فوق ثلاثة أشهر، ثم يُدوَّر لساعات عادية شهراً على الأقل، أو موافقة خطية محفوظة مع حق التراجع في أي وقت. لا تجديد شهري واجب. أسبوع صباحي واحد لا يصفّر العدّ.", "Decision 18632: no continuous night-worker assignment beyond three months, then rotate to ordinary hours for at least one month, or keep written consent on file with the right to withdraw at any time. Monthly renewal is not a legal duty. One morning week does not reset the clock.", { from: "2020-01-01" }),
  row("hours.night.rotateOrdinaryWeeks", 4, "weeks", null, "ministerial", "القرار 18632: التدوير لساعات عادية لا يقل عن شهر واحد (~4 أسابيع تقويمية) قبل إعادة عدّ الثلاثة أشهر.", "Decision 18632: rotation to ordinary hours is at least one month (~4 calendar weeks) before the three-month count resets.", { from: "2020-01-01" }),
  row("hours.night.compensateOrReduce", 1, "count", null, "ministerial", "القرار 18632: من يؤدي عملاً ليلياً يُعوَّض بساعات أو أجر أو مزايا مماثلة (بدل/نقل). للمنشأة حرية اختيار تقليص الساعات أو بدل أو تغيير العمل الليلي. إن اختارت تقليصاً أو بدلاً فلها سحبه والبدء من جديد. البدل مبلغ تختاره المنشأة (أجر أو نقل) ويُصرف مع الراتب. للعامل الليلي بدل مناسب أو تخفيض الساعات مع حفظ وزن الساعات العادية والأجر والمزايا — إلا الليلي العرضي (رمضان، أو دون عتبة شهر / 25٪ لشهرين / 5 أيام في السنة). بعد ثلاثة أشهر يبقى التدوير أو موافقة الموظف الخطية.", "Decision 18632: anyone who performs night work is compensated in hours, pay, or similar benefits (allowance / transport). The establishment freely chooses reduced hours, an allowance, or a change of night work. If it chose a reduction or an allowance, it may withdraw that choice and start over. The allowance is an amount the establishment names (pay or transport) and it pays with salary. A night worker gets a suitable allowance or reduced hours with ordinary-hour weight, pay and benefits preserved — except incidental night (Ramadan, or under the month / 25% for two months / 5 days a year thresholds). After three months, rotation or the worker's written consent still applies.", { from: "2020-01-01" }),
  row("hours.night.pregnancyBanWeeks", 24, "weeks", null, "ministerial", "القرار 18632: يحظر العمل الليلي للحامل قبل الوضع بأربعة وعشرين أسبوعاً على الأقل، مع عمل مناسب في الساعات المعتادة. فترات إضافية بشهادة؛ وإن تعذّر النقل في حالتي الشهادة الطبية — لا الحظر التلقائي للحامل — تُخفَّض الساعات إلى ست ساعات كحد أدنى مع حفظ الأجر والمزايا.", "Decision 18632: night work is banned for a pregnant worker for at least 24 weeks before birth, with suitable ordinary-hours work. Extra periods with a certificate; if transfer is impossible in the medical-certificate cases — not the automatic pregnancy ban — hours drop to at least six with pay and benefits preserved.", { from: "2020-01-01" }),
  row("hours.night.incidentalYearDays", 5, "days", null, "ministerial", "القرار 18632: الليلي العرضي دون أكثر من 5 أيام في السنة — أو دون شهر / دون 25٪ من العمل الشهري لشهرين فأكثر — لا يُلزم بمانع التعويض أو التخفيض الخاص بالعامل الليلي.", "Decision 18632: incidental night of no more than 5 days a year — or under one month / under 25% of monthly work for two or more months — does not trigger the night-worker compensate-or-reduce block.", { from: "2020-01-01" }),
  row("hours.night.medicalYearMonths", 12, "months", null, "ministerial", "القرار 18632: للعامل الليلي طلب تقرير طبي قبل الإسناد، وسنوياً أثناء الإسناد، وعند ظهور مشكلة صحية. يُحفظ في الملف ولا يُعرض للغير دون موافقة، ويُستخدم للياقة الليلية فقط.", "Decision 18632: a night worker may request a medical report before assignment, yearly while assigned, and when health problems appear. Stored on the file, not shown to others without consent, and used only for night fitness.", { from: "2020-01-01" }),
  row("hours.heat.cite", 1, "count", "122", "labour", "النظام لا يذكر ساعة ولا موسماً لحظر العمل تحت أشعة الشمس؛ الساعتان والموسم من القرار الوزاري رقم 3337 وتاريخ 15/7/1435هـ، الصادر على المادتين 122 و243، والمعدِّل للفقرة (أولاً) من القرار 1/1559. والمادة 122 تلزم صاحب العمل باتخاذ احتياطات الحماية دون تحميل العامل تكلفتها.", "The Labour Law names no hour and no season for the sun-exposure ban; the hours and the season come from ministerial decision 3337 of 15/07/1435 AH, issued on articles 122 and 243 and amending paragraph (أولاً) of decision 1/1559. Article 122 obliges the employer to take the protective precautions without charging the worker for them."),
  row("hours.heat.startHour", 12, "hours", null, "ministerial", "حظر العمل المكشوف تحت أشعة الشمس من 12:00 — نصّ القرار الوزاري 3337، فالرقم قراري لا نصّ مادة.", "Sun-exposed work is banned from 12:00 — the wording of ministerial decision 3337, so the figure is the decision's, not an article's."),
  row("hours.heat.endHour", 15, "hours", null, "ministerial", "حظر العمل في الميدان المكشوف حتى 15:00.", "Outdoor field-work ban until 15:00."),
  row("hours.heat.fromMonth", 6, "count", null, "ministerial", "بداية موسم حظر الشمس: يونيو.", "Heat-ban season starts in June."),
  row("hours.heat.fromDay", 15, "day_of_month", null, "ministerial", "حظر الشمس من 15 يونيو حتى 15 سبتمبر من كل عام ميلادي — نصّ القرار الوزاري 3337 نفسه، قرار دائم لا إعلان سنوي.", "Sun ban from 15 June to 15 September of every Gregorian year — fixed by ministerial decision 3337 itself, a standing decision and not an annual announcement."),
  row("hours.heat.toMonth", 9, "count", null, "ministerial", "نهاية موسم حظر الشمس: سبتمبر.", "Heat-ban season ends in September."),
  row("hours.heat.toDay", 15, "day_of_month", null, "ministerial", "آخر يوم لحظر الشمس: 15 سبتمبر.", "Last heat-ban day: 15 September."),
  row("leave.sick.fullPayDays", 30, "days", "117", "labour", "الإجازة المرضية: ثلاثون يوماً بأجر كامل.", "Sick leave: thirty days at full pay."),
  row("leave.sick.halfPayDays", 60, "days", "117", "labour", "ثم ستون يوماً بثلاثة أرباع الأجر.", "Then sixty days at three-quarters pay."),
  row("leave.sick.midPayRatio", 0.75, "ratio", "117", "labour", "شريحة الإجازة المرضية الوسطى بثلاثة أرباع الأجر.", "The middle sick-leave band is paid at three-quarters."),
  row("leave.sick.unpaidDays", 30, "days", "117", "labour", "ثم ثلاثون يوماً بلا أجر.", "Then thirty days without pay."),
  row("leave.unpaid.suspendAfterDays", 20, "days", "116", "labour", "إيقاف عقد العمل فيما زاد على عشرين يوماً من الإجازة بلا أجر، ما لم يتفق الطرفان على خلاف ذلك.", "The contract is suspended for unpaid leave beyond twenty days, unless the parties agree otherwise."),

  row("compliance.establishment.dataUpdateDays", 10, "days", null, "ministerial", "اللائحة مادة 4 مكرر: تحديث بيانات المنشأة عبر المنصة المعتمدة خلال 10 أيام من أي تغيير في العنوان أو البيانات.", "Implementing regulations Art. 4 bis: update establishment data on the approved platform within 10 days of a change of address or particulars."),
  row("compliance.doc.expiryWarnDays", 60, "days", null, "product", "تنبيه انتهاء وثيقة قبل هذا العدد من الأيام.", "Document-expiry warning window."),
  row("compliance.gosi.employeeRate", 0.0975, "ratio", null, "gosi", "حصة الموظف للمشترك القديم: 9٪ معاشات + 0.75٪ ساند = 9.75٪. تُطبَّق أيضاً إذا خلا تاريخ التسجيل في التأمينات. لا تُكتب يدوياً.", "Old-subscriber employee share: 9% annuity + 0.75% SANED = 9.75%. Also used when the GOSI registration date is empty. Not typed by hand."),
  row("compliance.gosi.employerRate", 0.1175, "ratio", null, "gosi", "حصة صاحب العمل للمشترك القديم: 9٪ معاشات + 0.75٪ ساند + 2٪ أخطار مهنية = 11.75٪.", "Old-subscriber employer share: 9% annuity + 0.75% SANED + 2% occupational hazards = 11.75%."),
  row("compliance.gosi.sanedRate", 0.0075, "ratio", null, "gosi", "ساند: 0.75٪ على المشترك و0.75٪ على صاحب العمل. تبقى للقديم والجديد.", "SANED: 0.75% on the subscriber and 0.75% on the employer, for both old and new subscribers."),
  row("compliance.gosi.wageCeiling", 45000, "sar", null, "gosi", "سقف الأجر الخاضع للتأمينات: 45,000 ر.س.", "GOSI contributory-wage ceiling: 45,000 SAR."),
  row("compliance.gosi.expatEmployerRate", 0.02, "ratio", null, "gosi", "الوافد: 2٪ أخطار مهنية على صاحب العمل وحده.", "Non-Saudi: 2% occupational-hazard share on the employer only."),
  row("compliance.gosi.newAnnuityRate", 0.09, "ratio", null, "gosi", "فرع المعاشات للمشترك الجديد: 9٪ على كل طرف من 3 يوليو 2024 حتى 30 يونيو 2025. نظام التأمينات 1445هـ (م/273) وجدول المؤسسة.", "New-subscriber annuity: 9% each side from 3 July 2024 through 30 June 2025. Social Insurance Law 1445 AH (M/273) and the GOSI schedule.", { from: "2024-07-03", to: "2025-06-30" }),
  row("compliance.gosi.newAnnuityRate", 0.095, "ratio", null, "gosi", "فرع المعاشات للمشترك الجديد: 9.5٪ على كل طرف من 1 يوليو 2025 حتى 30 يونيو 2026.", "New-subscriber annuity: 9.5% each side from 1 July 2025 through 30 June 2026.", { from: "2025-07-01", to: "2026-06-30" }),
  row("compliance.gosi.newAnnuityRate", 0.1, "ratio", null, "gosi", "فرع المعاشات للمشترك الجديد: 10٪ على كل طرف من 1 يوليو 2026 حتى 30 يونيو 2027. ساري في 28 سبتمبر 2026.", "New-subscriber annuity: 10% each side from 1 July 2026 through 30 June 2027. In force on 28 September 2026.", { from: "2026-07-01", to: "2027-06-30" }),
  row("compliance.gosi.newAnnuityRate", 0.105, "ratio", null, "gosi", "فرع المعاشات للمشترك الجديد: 10.5٪ على كل طرف من 1 يوليو 2027 حتى 30 يونيو 2028.", "New-subscriber annuity: 10.5% each side from 1 July 2027 through 30 June 2028.", { from: "2027-07-01", to: "2028-06-30" }),
  row("compliance.gosi.newAnnuityRate", 0.11, "ratio", null, "gosi", "فرع المعاشات للمشترك الجديد: 11٪ على كل طرف من 1 يوليو 2028. هذا سقف الجدول المنشور.", "New-subscriber annuity: 11% each side from 1 July 2028. This is the published schedule's ceiling.", { from: "2028-07-01" }),
  row("compliance.ajeer.cite", 1, "days", null, "programme", "أجير خدمة وزارية للعمالة الزائرة/المؤقتة — الإرسال الحي قيد الاعتمادات الرسمية.", "Ajeer is a ministry service for visiting/temporary labour — live send waits for official credentials."),
  row("safety.hygiene.cite", 1, "days", "121", "labour", "يحفظ صاحب العمل المنشأة في حالة صحية ونظيفة ويؤمّن الإنارة والمياه وفق ما يحدده الوزير.", "The employer keeps the establishment hygienic and clean and provides lighting and water as the Minister determines."),
  row("safety.precautions.cite", 1, "days", "122", "labour", "يتخذ صاحب العمل الاحتياطات اللازمة لحماية العمال من أخطار العمل والآلات، ولا يحمّلهم كلفتها.", "The employer takes the precautions needed to protect workers from work and machinery hazards, and does not charge them for that protection."),
  row("safety.inform.cite", 1, "days", "123", "labour", "يُحاط العامل قبل مزاولة العمل بمخاطر المهنة، ويُلزم بوسائل الوقاية، وتُوفَّر مهمات الوقاية الشخصية.", "The worker is informed of occupational hazards before starting work, required to use protection, and provided with PPE."),
  row("safety.ppe.cite", 1, "days", "123", "labour", "يوفر صاحب العمل مهمات الوقاية الشخصية المناسبة ويدرب العمال على استخدامها.", "The employer provides suitable personal protective equipment and trains workers in its use."),

  row("hours.posting.cite", 1, "days", "17", "labour", "يُعلن في مكان ظاهر بمقر العمل جدول مواعيد العمل وفترات الراحة ويوم الراحة الأسبوعية ومواعيد النوبات.", "The work-hours table, rest periods, weekly rest day and shift times must be posted in a conspicuous place at the workplace."),
  row("hours.art99.extendedDayHours", 9, "hours", "99", "labour", "يجوز بقرار وزاري رفع ساعات اليوم إلى تسع لبعض الفئات أو الأعمال غير المتصلة.", "A ministerial decision may raise the daily hours to nine for certain categories or non-continuous work."),
  row("hours.art99.hazardousDayHours", 7, "hours", "99", "labour", "يجوز بقرار وزاري تخفيض ساعات اليوم إلى سبع في الأعمال الخطرة أو الضارة.", "A ministerial decision may reduce the daily hours to seven in hazardous or harmful work."),
  row("hours.art100.averageWeeks", 3, "count", "100", "labour", "إن زاد اليوم أو الأسبوع عن سقف المادة 98 في منشأة لا تقف يومياً، لا يزيد المتوسط على ثلاثة أسابيع أو أقل عن ثماني ساعات في اليوم أو 48 في الأسبوع.", "Where daily stop is impossible, a rise above Article 98 still may not average, over three weeks or less, more than eight hours a day or 48 a week."),
  row("hours.art103.cite", 1, "days", "103", "labour", "إن حتّم استمرار العمل دون توقف، تُمنح فترات راحة بديلة وتُحسب من ساعات العمل الفعلية.", "Where continuity of work is required, alternative rest periods are granted and counted as actual hours."),
  row("hours.art105.bankMaxWeeks", 8, "weeks", "105", "labour", "تجميع الراحة الأسبوعية في الأماكن النائية لا يزيد على ثمانية أسابيع، بموافقة العامل كتابة وموافقة الوزارة.", "Banking weekly rest in remote places may not exceed eight weeks, with the worker's written consent and the Ministry's approval."),
  row("hours.art108.cite", 1, "days", "108", "labour", "المادة 108: لا تسري أحكام المادتين 98 و101 على مناصب الإدارة العالية ذات سلطة صاحب العمل، والأعمال التجهيزية أو التكميلية، والعمل المتقطع بالضرورة، وعمال الحراسة والنظافة عدا الحراسة الأمنية المدنية — ويُحدَّد في اللائحة الحد الأقصى لساعات الفقرات 2–4. ليست استثناءً من المادة 104.", "Article 108: Arts 98 and 101 do not apply to senior management posts with the employer's authority, preparatory or complementary work, necessarily intermittent work, and guards/cleaners except civil security guards — the Regulations set the hour ceilings for paragraphs 2–4. Not an exemption from Article 104."),
  row("hours.juvenile.minAgeYears", 15, "years", "162", "labour", "لا تشغيل دون الخامسة عشرة من العمر (المادة 162).", "No employment under fifteen years of age (Article 162)."),
  row("hours.juvenile.maxAgeYears", 18, "years", "162", "labour", "الحدث دون الثامنة عشرة — حدّ السن في المادة 162 وما يتصل بها.", "A juvenile is under eighteen — the age ceiling in Article 162 and related rules."),
  row("hours.juvenile.ordinaryHours", 6, "hours", "164", "labour", "تشغيل الحدث الفعلي لا يزيد على ست ساعات في اليوم.", "A juvenile's actual work may not exceed six hours a day."),
  row("hours.juvenile.ramadanHours", 4, "hours", "164", "labour", "في رمضان لا يزيد تشغيل الحدث الفعلي على أربع ساعات.", "In Ramadan a juvenile's actual work may not exceed four hours."),
  row("hours.juvenile.maxStretchHours", 4, "hours", "164", "labour", "لا يعمل الحدث أكثر من أربع ساعات متصلة دون راحة.", "A juvenile may not work more than four consecutive hours without a rest."),
  row("hours.juvenile.maxPresenceHours", 7, "hours", "164", "labour", "لا يبقى الحدث في مكان العمل أكثر من سبع ساعات.", "A juvenile may not remain at the workplace more than seven hours."),
  row("hours.juvenile.nightBanHours", 12, "hours", "163", "labour", "يحظر تشغيل الحدث أثناء فترة ليل لا تقل عن اثنتي عشرة ساعة متتالية.", "A juvenile may not work during a night period of less than twelve consecutive hours."),
  row("hours.juvenile.no106.cite", 1, "days", "164", "labour", "لا تسري على الأحداث استثناءات المادة 106، ولا تشغيل في الراحة أو الأعياد أو السنوية.", "Article 106 exceptions do not apply to juveniles, nor may they work on weekly rest, Eids or annual leave."),
  row("contract.illness.noDismiss.cite", 1, "days", "82", "labour", "لا إنهاء بسبب المرض قبل استنفاذ الإجازة المرضية. للعامل وصل السنوية بالمرضية.", "Service may not end for illness before sick leave is exhausted. The worker may join annual leave to sick leave."),
  row("contract.wageType.consent.cite", 1, "days", "59", "labour", "لا نقل من الأجر الشهري إلى يومي أو أسبوعي أو قطعة أو ساعة بغير موافقة كتابية.", "A monthly wage may not switch to daily, weekly, piece or hourly pay without written consent."),
  row("contract.essentialChange.cite", 1, "days", "60", "labour", "لا تكليف بعمل يختلف جوهرياً بغير موافقة كتابية، إلا لضرورة عارضة.", "Substantially different work needs written consent, except incidental necessity."),
  row("contract.essentialChange.maxDays", 30, "days", "60", "labour", "الضرورة العارضة لتكليف مختلف لا تتجاوز ثلاثين يوماً في السنة.", "Incidental necessity for different work may not exceed thirty days in the year."),
  row("contract.serviceCertificate.cite", 1, "days", "64", "labour", "شهادة الخدمة بلا تقييم واجبة عند انتهاء العلاقة.", "A service certificate with no appraisal is required when the relation ends."),
  row("contract.returnDocuments.cite", 1, "days", "64", "labour", "إعادة الشهادات والوثائق المودعة واجبة عند الإغلاق.", "Returning deposited certificates and documents is required at close-out."),
  row("eos.allElements.cite", 1, "days", "86", "labour", "إن اتفق الطرفان دخلت العمولات والنسب في أجر تسوية المكافأة.", "If the parties so agree, commissions and percentages enter the wage on which the award is settled."),
  row("payroll.damage.capDays", 5, "days", "91", "labour", "حسم التلف لا يزيد على أجر خمسة أيام في الشهر، مستقل عن غرامات المادة 70.", "A damage deduction may not exceed five days' wage in a month, distinct from Article 70 fines."),
  row("leave.maternity.medicalCare.cite", 1, "days", "153", "labour", "على صاحب العمل توفير الرعاية الطبية للمرأة العاملة أثناء الحمل والولادة.", "The employer shall provide medical care for the female worker during pregnancy and childbirth."),
  row("facility.nursery.womenMin", 50, "count", "159", "labour", "إن بلغ عدد العاملات خمسين ولهن عشرة أطفال دون ست سنوات يلزم مكان رعاية.", "If fifty female workers have ten children under six, a care place is required."),
  row("facility.nursery.childrenMin", 10, "count", "159", "labour", "عتبة الأطفال دون ست سنوات لمكان الرعاية: عشرة.", "The under-six children threshold for a care place: ten."),
];

/**
 * Umm al-Qura Gregorian starts for 1 Ramadan.
 * Sighting may move the start one day earlier or later. Until the company
 * records that start, the day before the prediction is treated as Ramadan
 * when a company calendar is present. Day 30 waits for 29/30.
 */
export const RAMADAN_WINDOWS = [
  { from: "2025-03-01", announcedLength: 29 },
  { from: "2026-02-18" },
  { from: "2027-02-08" },
  { from: "2028-01-28" },
];

export function laborDayKey(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const raw = String(value ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function addLaborDays(iso, n) {
  const day = laborDayKey(iso);
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return day;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(n));
  return laborDayKey(d);
}

export function laborDaysBetween(from, to) {
  const a = new Date(`${laborDayKey(from)}T00:00:00`);
  const b = new Date(`${laborDayKey(to)}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function laborCalendarYear(win, calendar) {
  if (!win || !calendar) return null;
  const year = Number(String(win.from).slice(0, 4));
  return calendar[year] || calendar[String(year)] || null;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function calendarYearBag(calendar, year) {
  if (!calendar || !/^\d{4}$/.test(String(year))) return null;
  const bag = calendar[String(year)] || calendar[Number(year)] || null;
  return bag && typeof bag === "object" ? bag : null;
}

/**
 * Company-head Ramadan ruling. Null when unset (ministry window stays).
 * A stored but invalid date does not invent a window — the gate names the block.
 */
export function ownerRamadanRuling(calendar, year) {
  const bag = calendarYearBag(calendar, year);
  if (!bag) return null;
  const hasFrom = Object.prototype.hasOwnProperty.call(bag, "ownerRamadanFrom");
  const hasTo = Object.prototype.hasOwnProperty.call(bag, "ownerRamadanTo");
  if (!hasFrom && !hasTo) return null;
  const from = String(bag.ownerRamadanFrom || "").slice(0, 10);
  const to = String(bag.ownerRamadanTo || "").slice(0, 10);
  if (!ISO_DAY.test(from)) {
    return {
      ok: false,
      error: "RAMADAN_DATE",
      reason: "موعد بداية رمضان ناقص أو غير صالح — اكتبه سنة-شهر-يوم ثم احفظ ليصبح حكماً.",
      reasonEn: "Ramadan start is missing or invalid — enter YYYY-MM-DD, then save so it rules.",
    };
  }
  if (to && !ISO_DAY.test(to)) {
    return {
      ok: false,
      error: "RAMADAN_END",
      reason: "موعد نهاية رمضان غير صالح — اكتبه سنة-شهر-يوم أو اتركه حتى يُعلن 29 أو 30.",
      reasonEn: "Ramadan end is not a valid date — enter YYYY-MM-DD or leave it until 29 or 30 is announced.",
    };
  }
  if (ISO_DAY.test(to) && to < from) {
    return {
      ok: false,
      error: "RAMADAN_SPAN",
      reason: "نهاية رمضان قبل بدايته — صحّح الموعد قبل أن يحكم التقويم.",
      reasonEn: "Ramadan end is before the start — correct the dates before they rule the calendar.",
    };
  }
  let length = null;
  if (ISO_DAY.test(to)) {
    const span = laborDaysBetween(from, to) + 1;
    if (span !== 29 && span !== 30) {
      return {
        ok: false,
        error: "RAMADAN_LENGTH",
        reason: "رمضان 29 أو 30 يوماً — النهاية يجب أن تقع على اليوم 29 أو 30 من البداية.",
        reasonEn: "Ramadan is 29 or 30 days — the end must fall on day 29 or 30 from the start.",
      };
    }
    length = span;
  }
  return { ok: true, year: Number(year), from, to: ISO_DAY.test(to) ? to : "", length };
}

export function ownerHolidayBag(calendar) {
  const bag = calendar?.ownerHolidays;
  return bag && typeof bag === "object" ? bag : null;
}

/** Civic Art. 112 date. Ministry 23 Sep / 22 Feb unless the owner saved an explicit override. */
export function rulingCivicDate(id, calendar) {
  const base = id === "national" ? { month: 9, day: 23 } : id === "founding" ? { month: 2, day: 22 } : null;
  if (!base) return null;
  const row = ownerHolidayBag(calendar)?.[id];
  if (!row || row.overridden !== true) return { ...base, overridden: false, nameAr: "", nameEn: "" };
  const month = Number(row.month);
  const day = Number(row.day);
  const probe = new Date(2024, month - 1, day);
  const valid = Number.isInteger(month) && month >= 1 && month <= 12 && probe.getMonth() === month - 1 && probe.getDate() === day;
  if (!valid) {
    return {
      ...base,
      overridden: false,
      invalid: true,
      error: "HOLIDAY_DATE",
      reason: "موعد الإجازة الرسمية المحفوظ غير صالح — اليوم والشهر لا يكوّنان تاريخاً.",
      reasonEn: "The saved official-holiday date is not a real day — month and day do not form a date.",
      nameAr: "",
      nameEn: "",
    };
  }
  return {
    month,
    day,
    overridden: true,
    nameAr: String(row.nameAr || "").trim(),
    nameEn: String(row.nameEn || "").trim(),
  };
}

/** Explicit Eid span. Null keeps the Umm al-Qura span — an override must name its dates. */
export function rulingEidSpan(id, calendar) {
  if (id !== "fitr" && id !== "adha") return null;
  const row = ownerHolidayBag(calendar)?.[id];
  if (!row || row.overridden !== true) return null;
  const from = String(row.from || "").slice(0, 10);
  const to = String(row.to || "").slice(0, 10);
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || to < from) return null;
  return { id, from, to, days: laborDaysBetween(from, to) + 1, locked: true, ownerRuled: true };
}

/** -1 / 0 / +1 after sighting. Null until the company records the start. */
export function announcedRamadanStartShift(win, calendar) {
  const bag = laborCalendarYear(win, calendar);
  if (!bag) return null;
  const n = Number(bag.ramadanStartShift);
  if (n === -1 || n === 0 || n === 1) return n;
  const raw = String(bag.ramadanFrom || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const shift = laborDaysBetween(win.from, raw);
    if (shift >= -1 && shift <= 1) return shift;
  }
  return null;
}

export function announcedRamadanFrom(win, calendar) {
  if (!win) return "";
  const year = Number(String(win.from).slice(0, 4));
  const ruling = ownerRamadanRuling(calendar, year);
  if (ruling?.ok && ruling.from) return ruling.from;
  const shift = announcedRamadanStartShift(win, calendar);
  if (shift == null) return win.from;
  return addLaborDays(win.from, shift);
}

export function ramadanWindowOn(value, calendar) {
  const day = laborDayKey(value);
  return RAMADAN_WINDOWS.find((w) => {
    const year = Number(String(w.from).slice(0, 4));
    const ruling = ownerRamadanRuling(calendar, year);
    const from = announcedRamadanFrom(w, calendar);
    const startPending = !(ruling && ruling.ok) && calendar != null && announcedRamadanStartShift(w, calendar) == null;
    const first = startPending ? addLaborDays(w.from, -1) : from;
    const last = addLaborDays(from, 29);
    return first <= day && day <= last;
  }) || null;
}

export function announcedRamadanLength(win, calendar) {
  if (!win) return null;
  const year = Number(String(win.from).slice(0, 4));
  const ruling = ownerRamadanRuling(calendar, year);
  if (ruling?.ok && (ruling.length === 29 || ruling.length === 30)) return ruling.length;
  const fromCal = calendar?.[year]?.ramadanLength ?? calendar?.[String(year)]?.ramadanLength;
  if (fromCal === 29 || fromCal === 30) return fromCal;
  if (win.announcedLength === 29 || win.announcedLength === 30) return win.announcedLength;
  return null;
}

export function lastRamadanDay(win, calendar) {
  if (!win) return "";
  const len = announcedRamadanLength(win, calendar);
  return addLaborDays(announcedRamadanFrom(win, calendar), len === 29 ? 28 : 29);
}

/** Art. 98: apply unless the file explicitly records non-Muslim. Empty religion stays protected. */
export function isRamadanHoursSubject(employee) {
  const raw = String(employee?.profile?.religion || employee?.religion || "").trim().toLowerCase();
  if (!raw) return true;
  const compact = raw.replace(/[\s-]+/g, "_");
  if (compact === "non_muslim" || raw.includes("غير مسلم") || raw.includes("غير مسلمة")) return false;
  return true;
}

/** Art. 98: days 1–29 from the announced (or predicted) start; day 30 only if not announced as 29. */
export function isRamadanDay(value, calendar) {
  const day = laborDayKey(value);
  const win = ramadanWindowOn(day, calendar);
  if (!win) return false;
  const from = announcedRamadanFrom(win, calendar);
  const year = Number(String(win.from).slice(0, 4));
  const ruling = ownerRamadanRuling(calendar, year);
  const idx = laborDaysBetween(from, day) + 1;
  if (idx < 1) return !(ruling && ruling.ok) && calendar != null && announcedRamadanStartShift(win, calendar) == null;
  if (idx <= 29) return true;
  if (idx === 30) return announcedRamadanLength(win, calendar) !== 29;
  return false;
}

export function ruleAt(id, onDate, catalog = LABOR_RULES) {
  const day = laborDayKey(onDate);
  const rows = catalog.filter((r) => r.id === id);
  if (!rows.length) return null;
  const inForce = rows.filter(
    (r) => r.effectiveFrom <= day && (!r.effectiveTo || day <= r.effectiveTo),
  );
  if (!inForce.length) return null;
  return [...inForce].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] || null;
}

export function ruleValue(id, onDate, catalog) {
  const row = ruleAt(id, onDate, catalog);
  if (!row || typeof row.value !== "number") {
    throw new Error(`LABOR_RULE_MISSING:${id}`);
  }
  return row.value;
}

const RULE_UNITS = {
  days: { arOne: "يوم", arDual: "يومان", arMany: "أيام", enOne: "day", enMany: "days" },
  hours: { arOne: "ساعة", arDual: "ساعتان", arMany: "ساعات", enOne: "hour", enMany: "hours" },
  minutes: { arOne: "دقيقة", arDual: "دقيقتان", arMany: "دقائق", enOne: "minute", enMany: "minutes" },
  years: { arOne: "سنة", arDual: "سنتان", arMany: "سنوات", enOne: "year", enMany: "years" },
  months: { arOne: "شهر", arDual: "شهران", arMany: "أشهر", enOne: "month", enMany: "months" },
  weeks: { arOne: "أسبوع", arDual: "أسبوعان", arMany: "أسابيع", enOne: "week", enMany: "weeks" },
};

function arNounForCount(value, pack) {
  const n = Number(value);
  if (!Number.isFinite(n)) return pack.arOne;
  if (n === 2) return pack.arDual || pack.arOne;
  if (n === 1 || n % 1 !== 0) return pack.arOne;
  const lastTwo = Math.abs(Math.trunc(n)) % 100;
  if (lastTwo >= 3 && lastTwo <= 10) return pack.arMany;
  return pack.arOne;
}

/** Localized in-force figure: "12 ساعة" not "12 ساعات"; "1 يوم" not "1 days". */
export function formatRuleFigure(value, unit, ar = true) {
  if (value == null || value === "") return "";
  const key = String(unit || "").trim().toLowerCase();
  if (key === "ratio") return `${value}×`;
  const pack = RULE_UNITS[key];
  if (!pack) return `${value} ${unit || ""}`.trim();
  if (ar) {
    const noun = arNounForCount(value, pack);
    if (Number(value) === 2 && pack.arDual) return noun;
    return `${value} ${noun}`;
  }
  const one = Number(value) === 1;
  return `${value} ${one ? pack.enOne : pack.enMany}`;
}

export function citeRule(id, onDate, catalog) {
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
    localPdf: official?.localPdf || HRSD_LABOUR_LAW_PDF,
  };
}

export function leaveRuleId(type) {
  const key = String(type || "").trim().toLowerCase();
  return key ? `leave.${key}.days` : "";
}

export function citeLeaveType(type, onDate) {
  const key = String(type || "").trim().toLowerCase();
  if (!key) return null;
  return citeRule(`leave.${key}.days`, onDate) || citeRule(`leave.${key}.cite`, onDate);
}

/** Hint + optional المادة. Product/WPS/GOSI rows return text without a statutory chip. */
export function explainRule(id, onDate, catalog) {
  const row = ruleAt(id, onDate, catalog);
  if (!row) return null;
  const labour = row.source === "labour" && row.article;
  return {
    id: row.id,
    source: row.source,
    article: labour ? row.article : null,
    value: row.value,
    unit: row.unit,
    labelAr: labour
      ? `المادة ${row.article}`
      : (String(row.id).startsWith("hours.night.")
        ? "قرار 18632"
        : (String(row.id).startsWith("hours.heat.")
          ? "قرار 3337"
          : (row.source === "ministerial" ? "قرار وزاري" : null))),
    labelEn: labour
      ? `Art. ${row.article}`
      : (String(row.id).startsWith("hours.night.")
        ? "Decision 18632"
        : (String(row.id).startsWith("hours.heat.")
          ? "Decision 3337"
          : (row.source === "ministerial" ? "Ministerial decision" : null))),
    hintAr: row.hintAr,
    hintEn: row.hintEn,
    sourceUrl: HRSD_CATALOGUE_URL,
  };
}

export function explainLeaveType(type, onDate) {
  const key = String(type || "").trim().toLowerCase();
  if (!key) return null;
  return explainRule(`leave.${key}.days`, onDate) || explainRule(`leave.${key}.cite`, onDate);
}
