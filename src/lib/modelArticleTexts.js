/**
 * Annex 1 of ministerial decision 115921 (1446/08/19) — «النموذج الموحد للائحة تنظيم العمل».
 * The article texts the performance chain quotes, keyed «model:N». Quoted from the ministry's PDF
 * (Implementing Regulations and their annexes); only the PDF's broken ligatures are mended.
 * laborArticleTexts.js holds the Labour Law; this file holds the model regulation only.
 */
import { HRSD_IMPLEMENTING_REGS_URL } from "./laborRules.js";

export const MODEL_SOURCE_AR = "ملحق (1) النموذج الموحد للائحة تنظيم العمل — القرار الوزاري 115921 وتاريخ 1446/08/19";
export const MODEL_SOURCE_EN = "Annex 1, the unified model work-organisation regulation — Ministerial Decision 115921 of 1446/08/19";
export const MODEL_SOURCE_URL = HRSD_IMPLEMENTING_REGS_URL;

const t = (article, section, ar, en) => ({ key: `model:${article}`, article, section, ar, en });

export const MODEL_ARTICLE_TEXTS = [
  t("18", "تقارير الأداء",
    "تُعِدُّ المنشأة تقارير عن الأداء بصفة دورية، مرة كل سنة على الأقل لجميع العاملين وفقاً للنماذج التي تضعها لذلك؛ على أن تتضمن العناصر التالية:\n1. المقدرة على العمل، ودرجة إتقانه (الكفاءة).\n2. سلوك العامل، ومدى تعاونه مع رؤسائه، وزملائه، وعملاء المنشأة.\n3. المواظبة.",
    "The establishment prepares performance reports periodically, at least once a year for all workers, on the forms it sets for that; the report covers: (1) ability to do the work and the degree of mastery (competence); (2) the worker's conduct and his cooperation with his superiors, colleagues and the establishment's clients; (3) attendance."),
  t("19", "تقارير الأداء",
    "يُقيَّم أداء العامل في التقرير بالتقديرات التي تحددها المنشأة؛ على أن يتبع في ذلك مقياس من خمسة مستويات.",
    "The worker's performance is rated in the report on the grades the establishment sets, following a five-level scale."),
  t("20", "تقارير الأداء",
    "يُعدّ التقرير بمعرفة الرئيس المباشر للعامل؛ على أن يعتمد من (صاحب الصلاحية)، ويُخطر العامل بصورة من التقرير فور اعتماده، ويحق للعامل أن يتظلم من التقرير وفقاً لقواعد التظلم المنصوص عليها في هذه اللائحة.",
    "The report is prepared by the worker's direct superior and approved by the competent authority; the worker is notified with a copy as soon as it is approved, and may grieve it under the grievance rules of this regulation."),
  t("21", "العلاوات",
    "1. يجوز للمنشأة منح العاملين علاوات سنوية، يتم تحديد نسبتها بناءً على المركز المالي للمنشأة.\n2. يكون العامل مؤهلاً لاستحقاق العلاوة متى حصل في تقريره الدوري على مستوى متوسط على الأقل في النموذج الذي تضعه المنشأة، وذلك بعد مضي سنة كاملة من تاريخ التحاقه بالعمل، أو من تاريخ حصوله على العلاوة السابقة.\n3. يجوز لإدارة المنشأة منح العامل علاوة استثنائية وفقاً للضوابط التي تضعها في هذا الشأن.",
    "(1) The establishment may grant annual increments at a rate set by its financial position. (2) A worker qualifies for the increment when his periodic report is at least «average», a full year after joining or after his previous increment. (3) Management may grant an exceptional increment under the controls it sets."),
  t("22", "الترقيات",
    "أ. تضع المنشأة سلماً وظيفياً لوظائفها تحدد فيه عدد، ومسميات الوظائف - وفقاً لما جاء في دليل التصنيف والتوصيف المهني السعودي - ودرجة كل وظيفة، وشروط شغلها، وبداية أجرها فيه.\nب. يكون العامل مؤهلاً للترقية إلى وظيفة أعلى؛ متى توفرت الشروط التالية:\n1. وجود الوظيفة الشاغرة الأعلى.\n2. توافر مؤهلات شغل الوظيفة المرشح للترقية إليها.\n3. حصوله على مستوى فوق المتوسط على الأقل في آخر تقرير دوري.\n4. موافقة صاحب الصلاحية.\n5. يجوز لإدارة المنشأة منح العامل ترقية استثنائية؛ وفقاً للضوابط التي تضعها في هذا الشأن.",
    "(a) The establishment sets a job ladder (number and titles of jobs per the Saudi occupational classification, each job's grade, its requirements and starting wage). (b) A worker qualifies for promotion when: a higher post is vacant; he holds its qualifications; his last periodic report is at least «above average»; the competent authority approves. Management may grant an exceptional promotion under its controls."),
  t("23", "الترقيات",
    "إذا توافرت شروط الترقية لوظيفة أعلى في أكثر من عامل؛ فإن المفاضلة للترقية تكون كالآتي:\n1. ترشيح صاحب الصلاحية.\n2. الحاصل على تقدير أعلى.\n3. الحاصل على شهادات علمية أعلى، أو دورات تدريبية أكثر.\n4. الأكثر خبرة عملية بمجال عمل المنشأة.\n5. الأقدمية في العمل بالمنشأة.",
    "If more than one worker meets the promotion conditions, preference goes in this order: the competent authority's nomination; the higher rating; higher qualifications or more training courses; more practical experience in the establishment's field; seniority in the establishment."),
  t("71", "التظلم",
    "1. للعامل أن يتظلم من أي تصرف، أو إجراء، أو جزاء يتخذ في حقه من قبل المنشأة، ويقدم التظلم كتابة إلى الجهة المختصة بالمنشأة خلال ثلاثين يوماً - عدا أيام العطل الرسمية - من تاريخ إبلاغه بالقرار، أو الإجراء أو الجزاء المتظلم منه، ولا يضار العامل من تقديم تظلمه، ويخطر العامل بنتيجة البت في تظلمه، في ميعاد لا يتجاوز خمسة عشر يوماً - عدا أيام العطل الرسمية - من تاريخ تقديمه التظلم.\n2. إذا رفض تظلم العامل أو لم يبت فيه كتابة خلال خمسة عشر يوماً من تاريخ تقديمه التظلم كان له حق الاعتراض أمام المحاكم العمالية خلال ثلاثين يوماً - عدا أيام العطل الرسمية - من تاريخ رفض تظلمه أو انتهاء المدة المحددة للبت في التظلم أيهما أقرب.",
    "(1) The worker may grieve any act, measure or penalty taken against him, in writing to the competent body within thirty days (official holidays aside) of being notified; he is not harmed for grieving, and is told the result within fifteen days (holidays aside) of filing. (2) If refused, or not decided in writing within fifteen days, he may object before the labour courts within thirty days (holidays aside) of the refusal or the lapse, whichever is earlier."),
];

/** «model:18», «18», 18 → the article row, or null. */
export function modelArticleText(raw) {
  const id = String(raw ?? "").replace(/^model:/, "").trim();
  return MODEL_ARTICLE_TEXTS.find((row) => row.article === id) || null;
}

/** Several articles as one reading: each under its own «النموذج الموحد م N» heading. */
export function modelArticlesBody(list, ar = true) {
  const ids = (Array.isArray(list) ? list : [list]).map((v) => String(v ?? "").replace(/^model:/, "").trim()).filter(Boolean);
  return ids
    .map(modelArticleText)
    .filter(Boolean)
    .map((row) => `${ar ? `النموذج الموحد م${row.article} — ${row.section}` : `Model Art. ${row.article}`}\n${ar ? row.ar : row.en}`)
    .join("\n\n");
}

/** The law object RightHint / StatuteLink read: { label, model: ["18","19"] }. */
export function modelLaw(articles, ar = true) {
  const ids = (Array.isArray(articles) ? articles : [articles]).map(String);
  const label = ar
    ? `النموذج الموحد م${ids.join(" · م")}`
    : `Model Art${ids.length > 1 ? "s" : ""}. ${ids.join(" · ")}`;
  return { label, model: ids };
}
