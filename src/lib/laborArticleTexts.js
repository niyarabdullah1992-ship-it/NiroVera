/** Official Labour Law article wording (BOE), dated by in-force version.
 *  Twin: base44/shared/laborArticleTexts.ts — keep in sync.
 *  Operational encodings stay in laborRules.hintAr; this file is the statute.
 */

export const BOE_LABOUR_LAW_URL =
  "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1";

/** Official HRSD Labour Law PDF served by the product (M/51 1426 as amended through M/44 8/2/1446). */
export const HRSD_LABOUR_LAW_PDF = "/labor-law.pdf";
export const HRSD_LABOUR_LAW_EDITION = {
  decree: "M/51",
  decreeHijri: "1426-08-23",
  lastAmend: "M/44",
  lastAmendHijri: "1446-02-08",
  lastAmendGregorian: "2025-02-19",
};

const FROM = "2005-01-01";
const AMEND_2015 = "2015-03-25";
const BEFORE_2015 = "2015-03-24";
const AMEND_2025 = "2025-02-19";
const BEFORE_2025 = "2025-02-18";

function v(article, ar, en, dates = {}) {
  return {
    article,
    ar,
    en,
    effectiveFrom: dates.from || FROM,
    effectiveTo: dates.to || null,
    amendedBy: dates.amendedBy || null,
  };
}

export const LABOR_ARTICLE_TEXTS = [
  v(
    "17",
    "يجب على صاحب العمل أن يعلن في مكان ظاهر بمقر العمل جدول مواعيد العمل، وفترات الراحة، ويوم الراحة الأسبوعية، ومواعيد العمل اليومي للنوبات.",
    "The employer must post in a conspicuous place at the workplace the work-hours table, rest periods, the weekly rest day, and the daily shift times.",
  ),

  v(
    "37",
    "يجب أن يكون عقد عمل غير السعودي مكتوبًا ومحدد المدة. وإذا خلا العقد من بيان مدته تعد مدة رخصة العمل هي مدة العقد.",
    "A non-Saudi worker's contract must be in writing and for a fixed term. If the contract does not state its duration, the duration of the work permit shall be deemed the duration of the contract.",
    { to: BEFORE_2025 },
  ),
  v(
    "37",
    "يجب أن يكون عقد عمل غير السعودي مكتوباً ومحدد المدة. وإذا خلا العقد من بيان مدته تعد مدته (سنة) من تاريخ مباشرة العامل الفعلية، وإذا استمر العمل بعد انتهاء هذه المدة، عُدَّ متجدداً لمدة مماثلة.",
    "A non-Saudi worker's contract must be in writing and for a fixed term. If the contract does not state its duration, the duration shall be deemed one year from the date the worker actually starts work. If work continues after that term ends, the contract shall be deemed renewed for a like period.",
    { from: AMEND_2025, amendedBy: "M/44" },
  ),

  v(
    "51",
    "يجب أن يكتب عقد العمل من نسختين على الأقل يحتفظ كل طرف بنسخة. ويُعد العقد قائماً ولو كان غير مكتوب، وفي هذه الحالة يكون للعامل وحده إثبات العقد وحقوقه التي نشأت له بجميع طرق الإثبات. ويكون لكل من الطرفين أن يطلب كتابة العقد في أي وقت. أما عمال الحكومة والمؤسسات العامة فيقوم قرار أو أمر التعيين الصادر من الجهة المختصة مقام العقد.",
    "The work contract shall be written in at least two copies, each party retaining one. The contract shall be deemed to exist even if it is not in writing; in that case the worker alone may prove the contract and the rights arising for him by all means of proof. Either party may request that the contract be put in writing at any time. For government and public-institution workers, the appointment decision or order issued by the competent authority stands in place of the contract.",
    { to: BEFORE_2025 },
  ),
  v(
    "51",
    "يجب أن يكتب عقد العمل من نسختين، يحتفظ كل طرف بنسخة. ولصاحب العمل توثيق العقد وفق الأحكام النظامية ذات الصلة. ويُعد العقد قائماً ولو كان غير مكتوب، وفي هذه الحالة يكون للعامل وحده إثبات العقد وحقوقه التي نشأت له بجميع طرق الإثبات. ويكون لكل من الطرفين أن يطلب كتابة العقد في أي وقت. أما عمال الحكومة والمؤسسات العامة فيقوم قرار أو أمر التعيين الصادر من الجهة المختصة مقام العقد.",
    "The work contract shall be written in two copies, each party retaining one. The employer may document the contract in accordance with the applicable statutory provisions. The contract shall be deemed to exist even if it is not in writing; in that case the worker alone may prove the contract and the rights arising for him by all means of proof. Either party may request that the contract be put in writing at any time. For government and public-institution workers, the appointment decision or order issued by the competent authority stands in place of the contract.",
    { from: AMEND_2025, amendedBy: "M/44" },
  ),

  v(
    "52",
    "1 - مع مراعاة ما ورد في المادة (السابعة والثلاثين) من هذا النظام، تضع الوزارة نموذجاً موحداً لعقد العمل، يحتوي بصورة أساسية على: اسم صاحب العمل ومكانه، واسم العامل وجنسيته، وما يلزم لإثبات شخصيته، وعنوان إقامته، والأجر المتفق عليه بما في ذلك المزايا والبدلات، ونوع العمل ومكانه، وتاريخ الالتحاق به، ومدته إن كان محدد المدة.\n\n2 - يجب أن يكون عقد العمل وفق النموذج المشار إليه في الفقرة (1) من هذه المادة، ولطرفي العقد أن يضيفا إليه بنوداً أخرى، بما لا يتعارض مع أحكام هذا النظام ولائحته والقرارات الصادرة تنفيذاً له.",
    "1 - Without prejudice to Article (37) of this Law, the Ministry shall issue a unified model employment contract containing, as a minimum: the employer's name and place; the worker's name and nationality and what is needed to establish identity; the residence address; the agreed wage including benefits and allowances; the type and place of work; the date of joining; and the duration if the contract is for a fixed term.\n\n2 - The employment contract must follow the model referred to in paragraph (1). The parties may add other clauses that do not conflict with this Law, its Regulations, or decisions issued in implementation of it.",
    { from: AMEND_2015, to: BEFORE_2025, amendedBy: "M/46" },
  ),
  v(
    "52",
    "1 - مع مراعاة ما ورد في المادة (السابعة والثلاثين) من هذا النظام، تضع الوزارة نموذجاً موحداً لكل نوع من أنواع عقد العمل، يحتوي بصورة أساسية على: اسم صاحب العمل ومكانه، واسم العامل وجنسيته، وما يلزم لإثبات شخصيته، وعنوان إقامته، والأجر المتفق عليه بما في ذلك المزايا والبدلات، ونوع العمل ومكانه، وتاريخ الالتحاق به، ومدة العقد إن كان محدد المدة، وحقوق كل طرف والتزاماته الأساسية.\n\n2 - يجب أن يكون عقد العمل وفق النموذج المشار إليه في الفقرة (1) من هذه المادة، ولطرفي العقد أن يضيفا إليه بنوداً أخرى، بما لا يتعارض مع أحكام هذا النظام ولائحته والقرارات الصادرة تنفيذاً له.",
    "1 - Without prejudice to Article (37) of this Law, the Ministry shall issue a unified model for each type of employment contract containing, as a minimum: the employer's name and place; the worker's name and nationality and what is needed to establish identity; the residence address; the agreed wage including benefits and allowances; the type and place of work; the date of joining; the duration of the contract if it is for a fixed term; and the basic rights and obligations of each party.\n\n2 - The employment contract must follow the model referred to in paragraph (1). The parties may add other clauses that do not conflict with this Law, its Regulations, or decisions issued in implementation of it.",
    { from: AMEND_2025, amendedBy: "M/44" },
  ),

  v(
    "53",
    "إذا كان العامل خاضعاً لفترة تجربة، وجب النص على ذلك صراحة في عقد العمل، وتحديدها بوضوح، بحيث لا تزيد على تسعين يوماً. ويجوز باتفاق مكتوب بين العامل وصاحب العمل تمديد فترة التجربة، على ألا تزيد على مائة وثمانين يوماً. ولا تدخل في حساب فترة التجربة إجازة عيدي الفطر والأضحى والإجازة المرضية. ولكل من الطرفين الحق في إنهاء العقد خلال هذه الفترة ما لم يتضمن العقد نصّا يعطي الحق في الإنهاء لأحدهما.",
    "If the worker is subject to a probation period, this must be expressly stated in the work contract and clearly specified so that it does not exceed ninety days. The parties may, by written agreement, extend probation provided it does not exceed one hundred and eighty days. Eid al-Fitr, Eid al-Adha and sick leave are not counted toward probation. Either party may terminate the contract during this period unless the contract gives the right of termination to one of them only.",
    { from: AMEND_2015, to: BEFORE_2025, amendedBy: "M/46" },
  ),
  v(
    "53",
    "إذا كان العامل خاضعاً للتجربة، وجب النص على ذلك صراحة في عقد العمل، وتحديد مدتها بوضوح، على ألا يزيد مجموع المدة في جميع الأحوال على (مائة وثمانين) يوماً. وتبين اللائحة الأحكام المتصلة بذلك بما في ذلك ما يتعلق بالإجازات التي لا تدخل في حساب المدة. ولكل من الطرفين الحق في إنهاء العقد خلال هذه المدة.",
    "If the worker is subject to probation, this must be expressly stated in the work contract and its duration clearly specified, provided that the total duration shall in all cases not exceed one hundred and eighty days. The Regulations shall set out the related provisions, including leaves that are not counted toward the period. Either party may terminate the contract during this period.",
    { from: AMEND_2025, amendedBy: "M/44" },
  ),

  v(
    "54",
    "لا يجوز وضع العامل تحت التجربة أكثر من مرة واحدة لدى صاحب عمل واحد. واستثناءً من ذلك يجوز باتفاق طرفي العقد — كتابة — إخضاع العامل لفترة تجربة أخرى بشرط أن تكون في مهنة أخرى أو عمل آخر، أو أن يكون قد مضى على انتهاء علاقة العامل بصاحب العمل مدة لا تقل عن ستة أشهر.",
    "A worker may not be placed on probation more than once with the same employer. By way of exception the parties may agree in writing to a further probation period provided it is in another occupation or another job, or at least six months have passed since the worker's relation with the employer ended.",
    { from: AMEND_2015, amendedBy: "M/46" },
  ),

  v(
    "55",
    "1 - ينتهي عقد العمل المحدد المدة بانقضاء مدته، فإذا استمر طرفاه في تنفيذ عُدَّ العقدُ مجدداً لمدة غير محددة. مع مراعاة ما نصت عليه المادة (السابعة والثلاثون) من هذا النظام بالنسبة إلى غير السعوديين.\n\n2 - إذا تضمن العقد المحدد المدة شرطاً يقضي بتجديده لمدة مماثلة أو لمدة محددة، فإنه يتجدد للمدة المتفق عليها. فإن تعدد التجديد ثلاث مرات متتالية، أو بلغت مدة العقد الأصلي مع مدة التجديد أربع سنوات أيهما أقل واستمر الطرفان في تنفيذه؛ تحوّل العقد إلى عقد غير محدد المدة.",
    "1 - A fixed-term contract ends when its term expires. If both parties continue to perform it, the contract shall be deemed renewed for an indefinite term, without prejudice to Article (37) of this Law in respect of non-Saudis.\n\n2 - If a fixed-term contract contains a clause renewing it for a like or specified term, it renews for the agreed term. If it is renewed three consecutive times, or the original term plus renewals amount to four years, whichever is less, and the parties continue to perform it, the contract converts to an indefinite-term contract.",
    { from: AMEND_2015, amendedBy: "M/46" },
  ),

  v(
    "58",
    "1. لا يجوز لصاحب العمل أن ينقل العامل بغير موافقته - كتابةً - من مكان عمله الأصلي إلى مكان آخر يقتضي تغيير محل إقامته.\n\n2. لصاحب العمل - في حالات الضرورة التي قد تقتضيها ظروف عارضة ولمدة لا تتجاوز ثلاثين يوماً في السنة - تكليف العامل بعمل في مكان يختلف عن المكان المتفق عليه دون اشتراط موافقته، على أن يتحمل صاحب العمل تكاليف انتقال العامل وإقامته خلال تلك المدة.",
    "1. The employer may not transfer the worker, without his written consent, from his original workplace to another place that requires a change of residence.\n\n2. In cases of necessity arising from incidental circumstances, and for a period not exceeding thirty days in the year, the employer may assign the worker to work in a place other than the agreed place without requiring his consent, provided the employer bears the worker's travel and accommodation costs during that period.",
  ),

  v(
    "59",
    "لا يجوز نقل العامل ذي الأجر الشهري إلى فئة عمال اليومية أو العمال المعينين بالأجر الأسبوعي أو بالقطعة أو بالساعة إلا إذا وافق العامل على ذلك كتابة، مع عدم الإخلال بالحقوق التي اكتسبها في المدة التي قضاها بالأجر الشهري.",
    "A monthly-wage worker may not be moved to the class of daily-wage workers or of workers engaged on a weekly, piece-rate or hourly wage except with the worker's written consent, without prejudice to the rights acquired during the period spent on a monthly wage.",
  ),

  v(
    "60",
    "مع عدم الإخلال بما تضمنته المادة (الثامنة والثلاثون) من هذا النظام، لا يجوز تكليف العامل بعمل يختلف اختلافاً جوهرياً عن العمل المتفق عليه بغير موافقته الكتابية، إلا في حالات الضرورة التي قد تقتضيها ظروف عارضة ولمدة لا تتجاوز ثلاثين يوماً في السنة.",
    "Without prejudice to Article (38) of this Law, a worker may not be assigned work that differs substantially from the agreed work without his written consent, except in cases of necessity arising from incidental circumstances and for a period not exceeding thirty days in the year.",
  ),

  v(
    "64",
    "يلتزم صاحب العمل عند انتهاء عقد العمل بما يأتي:\n1 - أن يعطي العامل - بناء على طلبه - شهادة خدمة دون مقابل، يوضح فيها تاريخ التحاقه بالعمل وتاريخ انتهائه ومهنته ومقدار أجره الأخير. ولا يجوز أن تتضمن الشهادة ما قد يسيء إلى سمعة العامل أو يقلل فرص العمل أمامه.\n2 - أن يعيد إلى العامل جميع ما أودعه لديه من شهادات أو وثائق.",
    "Upon the end of the work contract the employer shall:\n1 - Give the worker, at his request and free of charge, a service certificate stating the date of joining, the date of leaving, his occupation and his last wage. The certificate may not contain anything that would harm the worker's reputation or reduce his chances of work.\n2 - Return to the worker all certificates or documents he deposited with the employer.",
  ),

  v(
    "66",
    "الجزاءات التأديبية التي يجوز توقيعها على العامل:\n1 - الإنذار.\n2 - الغرامة.\n3 - الحرمان من العلاوة أو تأجيلها لمدة لا تزيد على سنة متى كانت مقررة من صاحب العمل.\n4 - تأجيل الترقية مدة لا تزيد على سنة متى كانت مقررة من صاحب العمل.\n5 - الإيقاف عن العمل مع الحرمان من الأجر.\n6 - الفصل من العمل في الحالات المقررة في النظام.",
    "The disciplinary penalties that may be imposed on the worker are:\n1 - Warning.\n2 - Fine.\n3 - Withholding or deferring an increment for a period not exceeding one year when the increment is granted by the employer.\n4 - Deferring promotion for a period not exceeding one year when promotion is granted by the employer.\n5 - Suspension from work without pay.\n6 - Dismissal in the cases prescribed in the Law.",
  ),

  v(
    "67",
    "لا يجوز لصاحب العمل أن يوقع على العامل جزاءً غير وارد في هذا النظام أو في لائحة تنظيم العمل.",
    "The employer may not impose on the worker a penalty that is not provided for in this Law or in the work-organization regulations.",
  ),

  v(
    "68",
    "لا يجوز تشديد الجزاء في حالة تكرار المخالفة إذا كان قد انقضى على المخالفة السابقة مائة وثمانون يوماً من تاريخ إبلاغ العامل بتوقيع الجزاء عليه عن تلك المخالفة.",
    "A penalty may not be increased for a repeated offence if one hundred and eighty days have elapsed from the date the worker was notified of the penalty for the previous offence.",
  ),

  v(
    "69",
    "لا يجوز اتهام العامل بمخالفة مضى على كشفها أكثر من ثلاثين يوماً، ولا يجوز توقيع جزاء تأديبي بعد تاريخ انتهاء التحقيق في المخالفة وثبوتها في حق العامل بأكثر من ثلاثين يوماً.",
    "A worker may not be accused of an offence more than thirty days after it was discovered. A disciplinary penalty may not be imposed more than thirty days after the investigation of the offence ended and it was established against the worker.",
  ),

  v(
    "70",
    "لا يجوز توقيع جزاء تأديبي على العامل لأمر ارتكبه خارج مكان العمل ما لم يكن متصلاً بالعمل أو بصاحبه أو مديره المسؤول. كما لا يجوز أن يوقع على العامل عن المخالفة الواحدة غرامة تزيد قيمتها على أجرة خمسة أيام، ولا توقيع أكثر من جزاء واحد على المخالفة الواحدة، ولا أن تُقتطع من أجره وفاءً للغرامات التي توقع عليه أكثر من أجر خمسة أيام في الشهر الواحد، ولا أن تزيد مدة إيقافه عن العمل دون أجر على خمسة أيام في الشهر.",
    "A disciplinary penalty may not be imposed on a worker for an act committed outside the workplace unless it is connected with the work, the employer, or the responsible manager. A worker may not be fined for a single offence more than five days' wage, nor may more than one penalty be imposed for a single offence, nor may more than five days' wage be deducted from his pay in one month in satisfaction of fines, nor may unpaid suspension exceed five days in a month.",
  ),

  v(
    "71",
    "لا يجوز توقيع جزاء على العامل إلا بعد إبلاغه كتابة بما نُسب إليه واستجوابه وتحقيق دفاعه وإثبات ذلك في محضر يودع في ملفه الخاص. ويجوز أن يكون الاستجواب شفاهة في المخالفات البسيطة التي يعاقب عليها بالإنذار أو الغرامة بما لا يتجاوز أجر يوم واحد على أن يثبت ذلك في المحضر.",
    "A penalty may not be imposed on the worker except after notifying him in writing of what is attributed to him, questioning him, hearing his defence, and recording that in minutes placed on his file. Questioning may be oral for minor offences punishable by a warning or a fine not exceeding one day's wage, provided that is recorded in the minutes.",
  ),

  v(
    "72",
    "يجب أن يبلغ العامل بقرار توقيع الجزاء عليه كتابة، فإذا امتنع عن الاستلام أو كان غائباً فيرسل البلاغ بكتاب مسجل على عنوانه المبين في ملفه، وله التظلم كتابة للجهة المختصة لدى صاحب العمل خلال (ثلاثين) يوماً -عدا أيام العطل الرسمية- من تاريخ إبلاغه بالقرار، فإن رُفض تظلمه أو لم يُبت فيه كتابة خلال (خمسة عشر) يوماً من تقديمه كان له حق الاعتراض أمام المحاكم العمالية على القرار الخاص بتوقيع الجزاء عليه خلال (ثلاثين) يوماً -عدا أيام العطل الرسمية- من تاريخ رفض تظلمه أو انتهاء المدة المحددة للبت في التظلم أيهما أقرب.",
    "The worker must be notified in writing of the decision imposing the penalty. If he refuses to receive it or is absent, notice shall be sent by registered mail to the address in his file. He may appeal in writing to the employer's competent body within thirty days — excluding official holidays — from the date he is notified of the decision. If the appeal is rejected or not decided in writing within fifteen days of submission, he may challenge the penalty decision before the labour courts within thirty days — excluding official holidays — from the date of rejection or the end of the period for deciding the appeal, whichever is sooner.",
    { from: AMEND_2025, amendedBy: "M/44" },
  ),
  v(
    "72",
    "يجب أن يبلغ العامل بقرار توقيع الجزاء عليه كتابة، فإذا امتنع عن الاستلام أو كان غائبًا فيرسل البلاغ بكتاب مسجل على عنوانه المبين في ملفه، وللعامل حق الاعتراض على القرار الخاص بتوقيع الجزاء عليه خلال خمسة عشر يومًا- عدا أيام العطل الرسمية- من تاريخ إبلاغه بالقرار النهائي بإيقاع الجزاء عليه، ويقدم الاعتراض إلى هيئة تسوية الخلافات العمالية، ويجب عليها أن تصدر قرارها خلال ثلاثين يومًا من تاريخ تسجيل الاعتراض لديها.",
    "The worker must be notified in writing of the decision imposing the penalty. If he refuses to receive it or is absent, notice shall be sent by registered mail to the address in his file. The worker may object to the final penalty decision within fifteen days — excluding official holidays — from the date he is notified of it. The objection is submitted to the Commission for the Settlement of Labor Disputes, which must issue its decision within thirty days of registration.",
    { to: BEFORE_2025 },
  ),

  v(
    "73",
    "يجب على صاحب العمل أن يكتب الغرامات التي يوقعها على العامل في سجل خاص، مع بيان اسم العامل ومقدار أجره ومقدار الغرامة وسبب توقيعها وتاريخ ذلك. ولا يجوز التصرف في الغرامات إلا فيما يعود بالنفع على عمال المنشأة، على أن يكون التصرف بهذه الغرامات من قبل اللجنة العمالية في المنشأة، وفي حالة عدم وجود لجنة يكون التصرف في الغرامات بموافقة الوزارة.",
    "The employer shall record fines imposed on the worker in a special register, stating the worker's name, wage, the amount of the fine, the reason, and the date. Fines may not be disposed of except for the benefit of the establishment's workers, by the establishment's labour committee, or with the Ministry's approval if there is no committee.",
    { from: AMEND_2015, amendedBy: "M/46" },
  ),

  v(
    "74",
    "ينتهي عقد العمل في أي من الأحوال الآتية:\n1 - إذا اتفق الطرفان على إنهائه، بشرط أن تكون موافقة العامل كتابية.\n2 - إذا انتهت المدة المحددة في العقد، ما لم يكن العقد قد تجدد صراحة وفق أحكام هذا النظام؛ فيستمر إلى أجله.\n3 - بناءً على إرادة أحد الطرفين في العقود غير المحددة المدة، وفقاً لما ورد في المادة (الخامسة والسبعين) من هذا النظام.\n4 - بلوغ العامل سن التقاعد وفق ما تقضي به أحكام نظام التأمينات الاجتماعية، ما لم يتفق الطرفان على الاستمرار في العمل بعد هذه السن.\n5 - القوة القاهرة.\n6 - إغلاق المنشأة نهائياً.\n7 - إنهاء النشاط الذي يعمل فيه العامل، ما لم يُتفق على غير ذلك.\n8 - أي حالة أخرى ينص عليها نظام آخر.",
    "The work contract shall terminate in any of the following cases:\n1 - If the two parties agree to terminate it, provided the worker's consent is in writing.\n2 - If the term specified in the contract expires, unless the contract has been expressly renewed in accordance with this Law, in which case it continues to its term.\n3 - At the will of either party in indefinite-term contracts, in accordance with Article (75) of this Law.\n4 - When the worker reaches retirement age in accordance with the Social Insurance Law, unless the parties agree to continue work after that age.\n5 - Force majeure.\n6 - Permanent closure of the establishment.\n7 - Termination of the activity in which the worker is employed, unless otherwise agreed.\n8 - Any other case provided for in another law.",
    { from: AMEND_2015, to: BEFORE_2025, amendedBy: "M/46" },
  ),
  v(
    "74",
    "ينتهي عقد العمل في أي من الأحوال الآتية:\n1 - إذا اتفق الطرفان على إنهائه، بشرط أن تكون موافقة العامل كتابية.\n2 - إذا انتهت المدة المحددة في العقد، ما لم يكن العقد قد تجدد صراحة وفق أحكام هذا النظام؛ فيستمر إلى أجله.\n3 - بناءً على إرادة أحد الطرفين في العقود غير المحددة المدة، وفقاً لما ورد في المادة (الخامسة والسبعين) من هذا النظام.\n3 (مكرر) - الاستقالة.\n4 - بلوغ العامل سن التقاعد وفق ما تقضي به أحكام نظام التأمينات الاجتماعية، ما لم يتفق الطرفان على الاستمرار في العمل بعد هذه السن.\n5 - القوة القاهرة.\n6 - إغلاق المنشأة نهائياً.\n7 - إنهاء النشاط الذي يعمل فيه العامل، ما لم يُتفق على غير ذلك.\n7 (مكرر) - صدور قرار أو حكم نهائي من المحكمة المختصة؛ بإنهاء عقد العامل في أي من إجراءات الإفلاس المفتتحة وفق نظام الإفلاس.\n8 - أي حالة أخرى ينص عليها نظام آخر.",
    "The work contract shall terminate in any of the following cases:\n1 - If the two parties agree to terminate it, provided the worker's consent is in writing.\n2 - If the term specified in the contract expires, unless the contract has been expressly renewed in accordance with this Law, in which case it continues to its term.\n3 - At the will of either party in indefinite-term contracts, in accordance with Article (75) of this Law.\n3 (bis) - Resignation.\n4 - When the worker reaches retirement age in accordance with the Social Insurance Law, unless the parties agree to continue work after that age.\n5 - Force majeure.\n6 - Permanent closure of the establishment.\n7 - Termination of the activity in which the worker is employed, unless otherwise agreed.\n7 (bis) - Issuance of a final decision or judgment by the competent court terminating the worker's contract in any bankruptcy procedure opened under the Bankruptcy Law.\n8 - Any other case provided for in another law.",
    { from: AMEND_2025, amendedBy: "M/44" },
  ),

  v(
    "75",
    "إذا كان العقد غير محدد المدة، جاز لأي من طرفيه إنهاؤه بناءً على سبب مشروع يجب بيانه بموجب إشعار يوجه إلى الطرف الآخر كتابةً قبل الإنهاء بمدة تحدد في العقد، على ألا تقل عن ستين يوماً إذا كان أجر العامل يدفع شهريًّا، ولا تقل عن ثلاثين يوماً بالنسبة إلى غيره.",
    "If the contract is of indefinite term, either party may terminate it for a legitimate reason that must be stated in a written notice to the other party before termination, for a period specified in the contract of not less than sixty days if the worker's wage is paid monthly, and not less than thirty days for others.",
    { from: AMEND_2015, to: BEFORE_2025, amendedBy: "M/46" },
  ),
  v(
    "75",
    "1- إذا كان العقد غير محدد المدة وكان الأجر يدفع شهريًّا، جاز لأي من طرفيه إنهاؤه بناءً على سبب مشروع، وفق ما يلي: أ- إذا كان الإنهاء من طرف العامل، فيجب عليه أن يوجه إشعاراً كتابيًّا بذلك لصاحب العمل قبل (ثلاثين) يوماً على الأقل من تاريخ الإنهاء. ب- إذا كان الإنهاء من طرف صاحب العمل، فيجب عليه أن يوجه إشعاراً كتابيًّا بذلك للعامل قبل (ستين) يوماً على الأقل من تاريخ الإنهاء.\n\n2- إذا كان العقد غير محدد المدة وكان الأجر لا يدفع شهريًّا، فيجب أن يوجه الطرف الذي سيُنهي العقد بناءً على سبب مشروع -سواء كان العامل أو صاحب العمل- إشعاراً كتابيًّا بذلك للطرف الآخر قبل (ثلاثين) يوماً على الأقل من تاريخ الإنهاء.",
    "1- If the contract is of indefinite term and wages are paid monthly, either party may terminate it for a legitimate reason, as follows: (a) If termination is by the worker, he must give the employer written notice at least thirty days before the termination date. (b) If termination is by the employer, he must give the worker written notice at least sixty days before the termination date.\n\n2- If the contract is of indefinite term and wages are not paid monthly, the party terminating the contract for a legitimate reason — whether the worker or the employer — must give the other party written notice at least thirty days before the termination date.",
    { from: AMEND_2025, amendedBy: "M/44" },
  ),

  v(
    "76",
    "إذا لم يراعِ الطرف الذي أنهى العقد المهلة المحددة للإشعار وفقاً للمادة (الخامسة والسبعين) من هذا النظام فإنه يلتزم بأن يدفع للطرف الآخر عن مهلة الإشعار مبلغاً مساوياً لأجر العامل عن المهلة نفسها، ما لم يتفق الطرفان على أكثر من ذلك.",
    "If the party that ended the contract does not observe the notice period specified in accordance with Article (75) of this Law, that party shall pay the other party an amount equal to the worker's wage for the same period, unless the parties agree on more than that.",
    { from: AMEND_2015, amendedBy: "M/46" },
  ),

  v(
    "77",
    "ما لم يتضمن العقد تعويضاً محدداً مقابل إنهائه من أحد الطرفين لسبب غير مشروع، يستحق الطرف المتضرر من إنهاء العقد تعويضاً على النحو الآتي:\n1 - أجر خمسة عشر يوماً عن كل سنة من سنوات خدمة العامل، إذا كان العقد غير محدد المدة.\n2 - أجر المدة الباقية من العقد إذا كان العقد محدد المدة.\n3 - يجب ألا يقل التعويض المشار إليه في الفقرتين (1) و(2) من هذه المادة عن أجر العامل لمدة شهرين.",
    "Unless the contract specifies compensation for termination by either party for an unlawful reason, the injured party is entitled to compensation as follows:\n1 - Fifteen days' wage for each year of the worker's service, if the contract is of indefinite term.\n2 - The wage for the remaining period of the contract, if the contract is of fixed term.\n3 - The compensation in paragraphs (1) and (2) shall not be less than two months' wage.",
    { from: AMEND_2015, amendedBy: "M/46" },
  ),

  v(
    "78",
    "إذا كان الإشعار من جانب صاحب العمل، فيحق للعامل أن يتغيب خلال مهلة الإشعار يوماً كاملاً في الأسبوع أو ثماني ساعات أثناء الأسبوع، وذلك للبحث عن عمل آخر مع استحقاقه لأجر هذا اليوم أو ساعات الغياب. ويكون للعامل تحديد يوم الغياب وساعاته بشرط أن يُشعر صاحب العمل بذلك في اليوم السابق للغياب على الأقل. ولصاحب العمل أن يعفي العامل من العمل أثناء مهلة الإشعار مع احتساب مدة خدمته مستمرة إلى حين انتهاء تلك المهلة، والتزام صاحب العمل بما يترتب على ذلك من آثار وبخاصة استحقاق العامل أجره عن مهلة الإشعار.",
    "If notice is given by the employer, the worker may be absent during the notice period for one full day a week, or eight hours during the week, to look for other work, with pay for that day or those hours. The worker chooses the day or hours, provided he notifies the employer at least the day before. The employer may exempt the worker from work during the notice period, counting service as continuous until that period ends, and remaining bound by the consequences, in particular paying the worker's wage for the notice period.",
    { from: AMEND_2015, amendedBy: "M/46" },
  ),

  v(
    "79",
    "لا ينقضي عقد العمل بوفاة صاحب العمل، ما لم تكن شخصيته قد روعيت في إبرام العقد، ولكنه ينتهي بوفاة العامل أو بعجزه عن أداء عمله، وذلك بموجب شهادة طبية معتمدة من الجهات الصحية المخولة، أو من الطبيب المخول الذي يعينه صاحب العمل.",
    "The work contract does not terminate upon the death of the employer unless the employer's person was taken into account in concluding the contract, but it terminates upon the death of the worker or the worker's incapacity to perform the work, pursuant to a medical certificate issued by the competent health authorities or by the authorised physician designated by the employer.",
  ),
  v(
    "79 مكرر",
    "1- يُعد طلب الاستقالة المقدم مقبولاً إذا مضى على تقديمه (ثلاثون) يوماً دون ردٍّ من صاحب العمل. ولصاحب العمل تأجيل قبول طلب الاستقالة مدة لا تزيد على (ستين) يوماً إذا اقتضت مصلحة العمل ذلك، ووفق إيضاح مسبب مكتوب يقدم للعامل، على أن يكون تأجيل القبول قبل انتهاء مدة الثلاثين يوماً المشار إليها في هذه الفقرة. وتحتسب مدة تأجيل القبول من تاريخ تقديم الإيضاح المشار إليه للعامل.\n\n2- ينتهي عقد العمل بالاستقالة من تاريخ قبول صاحب العمل بها أو مضي مدة الثلاثين يوماً المشار إليها في الفقرة (1) من هذه المادة دون رد من صاحب العمل، أو مرور مدة تأجيل القبول المشار إليها في الفقرة (1) من هذه المادة.\n\n3- للعامل العدول عن طلب الاستقالة خلال مدة لا تتجاوز (سبعة) أيام من تاريخ تقديمه، ما لم يقبلها صاحب العمل قبل العدول.\n\n4- لا يصح أن يُحدد في طلب الاستقالة تاريخ مؤجل لها.\n\n5- يُعد عقد العمل سارياً خلال مدة طلب الاستقالة، ويلتزم طرفا العقد بتنفيذ جميع الالتزامات الناشئة عنه خلالها.\n\n6- يستحق العامل الذي انتهى عقده بالاستقالة جميع حقوقه المقررة بموجب هذا النظام.",
    "1- A submitted resignation request shall be deemed accepted if thirty days pass without a reply from the employer. The employer may postpone acceptance for a period not exceeding sixty days if the interest of the work so requires, with a written reasoned explanation given to the worker, provided the postponement is made before the thirty-day period in this paragraph ends. The postponement period is counted from the date that explanation is given to the worker.\n\n2- The work contract ends by resignation from the date the employer accepts it, or upon expiry of the thirty days in paragraph (1) without a reply, or upon expiry of the postponement period in paragraph (1).\n\n3- The worker may withdraw the resignation request within a period not exceeding seven days from submitting it, unless the employer has accepted it before the withdrawal.\n\n4- A resignation request may not specify a deferred date for the resignation.\n\n5- The work contract remains in force during the resignation-request period, and both parties must perform all obligations arising from it during that period.\n\n6- A worker whose contract ends by resignation is entitled to all rights prescribed under this Law.",
    { from: AMEND_2025, amendedBy: "M/44" },
  ),

  v(
    "80",
    "لا يجوز لصاحب العمل فسخ العقد دون مكافأة العامل، أو إشعاره، أو تعويضه؛ إلا في الحالات الآتية، وبشرط أن يتيح له الفرصة لكي يبدي أسباب معارضته للفسخ:\n1 - إذا وقع من العامل اعتداء على صاحب العمل أو المدير المسؤول أو أحد رؤسائه أو مرؤوسيه أثناء العمل أو بسببه.\n2 - إذا لم يؤدِّ العامل التزاماته الجوهرية المترتبة على عقد العمل أو لم يطع الأوامر المشروعة أو لم يراعِ عمداً التعليمات – التي أعلن عنها صاحب العمل في مكان ظاهر – الخاصة بسلامة العمل والعمال رغم إنذاره كتابة.\n3 - إذا ثبت اتباع العامل سلوكاً سيئاً، أو ارتكابه عملاً مخلاً بالشرف أو الأمانة.\n4 - إذا وقع من العامل - عمداً - أيُّ فعلٍ أو تقصيرٍ يقصد به إلحاق خسارة مادية بصاحب العمل، بشرط أن يبلغ صاحب العمل الجهات المختصة بالحادث خلال أربع وعشرين ساعة من وقت علمه بوقوعه.\n5 - إذا ثبت أن العامل لجأ إلى التزوير ليحصل على العمل.\n6 - إذا كان العامل مُعيَّناً تحت الاختبار.\n7 - إذا تغيب العامل دون سبب مشروع أكثر من ثلاثين يوماً خلال السنة العقدية الواحدة أو أكثر من خمسة عشر يوماً متتالية، على أن يسبق الفصل إنذار كتابي من صاحب العمل للعامل بعد غيابه عشرين يوماً في الحالة الأولى وانقطاعه عشرة أيام في الحالة الثانية.\n8 - إذا ثبت أن العامل استغل مركزه الوظيفي بطريقة غير مشروعة للحصول على نتائج ومكاسب شخصية.\n9 - إذا ثبت أن العامل أفشى الأسرار الصناعية أو التجارية الخاصة بالعمل الذي يعمل فيه.",
    "The employer may not terminate the contract without an award, notice or compensation except in the following cases, and provided the worker is given the opportunity to state the reasons for objecting to the termination:\n1 - If the worker assaults the employer, the responsible manager, or any of his superiors or subordinates, during or by reason of the work.\n2 - If the worker fails to perform the essential obligations arising from the work contract, or to obey legitimate orders, or wilfully fails to observe the instructions announced by the employer in a conspicuous place relating to work and worker safety, despite a written warning.\n3 - If the worker is proven to have followed a bad course of conduct, or to have committed an act violating honour or honesty.\n4 - If the worker wilfully commits any act or omission intended to cause the employer material loss, provided the employer reports the incident to the competent authorities within twenty-four hours of learning of it.\n5 - If it is proven that the worker resorted to forgery to obtain the work.\n6 - If the worker is appointed on probation.\n7 - If the worker is absent without a legitimate reason for more than thirty days during one contractual year or more than fifteen consecutive days, provided dismissal is preceded by a written warning from the employer after twenty days' absence in the first case and ten days' interruption in the second.\n8 - If it is proven that the worker exploited his position in an unlawful manner to obtain personal results and gains.\n9 - If it is proven that the worker disclosed industrial or commercial secrets of the work in which he is employed.",
    { from: AMEND_2015, amendedBy: "M/46" },
  ),

  v(
    "81",
    "يحق للعامل أن يترك العمل دون إشعار مع احتفاظه بحقوقه النظامية كلها، وذلك في أي من الحالات الآتية:\n1 - إذا لم يقم صاحب العمل بالوفاء بالتزاماته العقدية أو النظامية الجوهرية إزاء العامل.\n2 - إذا ثبت أن صاحب العمل أو من يمثله قد أدخل عليه الغش وقت التعاقد فيما يتعلق بشروط العمل وظروفه.\n3 - إذا كلفه صاحب العمل دون رضاه بعمل يختلف جوهريًّا عن العمل المتفق عليه، وخلافًا لما تقرره المادة الستون من هذا النظام.\n4 - إذا وقع من صاحب العمل أو من أحد أفراد أسرته أو من المدير المسؤول اعتداء يتسم بالعنف، أو سلوك مخل بالآداب نحو العامل أو أحد أفراد أسرته.\n5 - إذا اتسمت معاملة صاحب العمل أو المدير المسؤول بمظاهر من القسوة والجور أو الإهانة.\n6 - إذا كان في مقر العمل خطر جسيم يهدد سلامة العامل أو صحته، بشرط أن يكون صاحب العمل قد علم بوجوده، ولم يتخذ من الإجراءات ما يدل على إزالته.\n7 - إذا كان صاحب العمل أو من يمثله قد دفع العامل بتصرفاته وعلى الأخص بمعاملته الجائرة أو بمخالفته شروط العقد إلى أن يكون العامل في الظاهر هو الذي أنهى العقد.",
    "The worker may leave the work without notice while retaining all of his statutory rights in any of the following cases:\n1 - If the employer fails to fulfil the essential contractual or statutory obligations toward the worker.\n2 - If it is proven that the employer or his representative committed fraud at the time of contracting in relation to the conditions and circumstances of the work.\n3 - If the employer assigns him, without his consent, work that differs substantially from the agreed work, contrary to Article (60) of this Law.\n4 - If the employer, a member of his family, or the responsible manager commits a violent assault or indecent conduct toward the worker or a member of the worker's family.\n5 - If the treatment of the employer or the responsible manager is characterised by cruelty, injustice or humiliation.\n6 - If there is in the workplace a serious danger threatening the worker's safety or health, provided the employer knew of it and did not take measures indicating its removal.\n7 - If the employer or his representative, by his conduct and in particular by unfair treatment or by breach of the contract, has driven the worker to appear to be the one who ended the contract.",
  ),

  v(
    "82",
    "لا يجوز لصاحب العمل إنهاء خدمة العامل بسبب المرض، قبل استنفاذه المدد المحددة للإجازة المنصوص عليها في هذا النظام، وللعامل الحق في أن يطلب وصل إجازته السنوية بالمرضية.",
    "The employer may not terminate the worker's service because of illness before the worker has exhausted the leave periods prescribed in this Law. The worker is entitled to request that his annual leave be joined to the sick leave.",
  ),

  v(
    "84",
    "إذا انتهت علاقة العمل وجب على صاحب العمل أن يدفع إلى العامل مكافأة عن مدة خدمته تحسب على أساس أجر نصف شهر عن كل سنة من السنوات الخمس الأولى، وأجر شهر عن كل سنة من السنوات التالية، ويتخذ الأجر الأخير أساسًا لحساب المكافأة، ويستحق العامل مكافأة عن أجزاء السنة بنسبة ما قضاه منها في العمل.",
    "Upon the end of the work relation, the employer shall pay the worker an end-of-service award of a half-month wage for each of the first five years and a one-month wage for each of the following years. The award shall be calculated on the basis of the last wage, and the worker shall be entitled to an award for portions of the year in proportion to the time spent on the job.",
  ),

  v(
    "85",
    "إذا كان انتهاء علاقة العمل بسبب استقالة العامل يستحق في هذه الحالة ثلث المكافأة بعد خدمة لا تقل مدتها عن سنتين متتاليتين، ولا تزيد على خمس سنوات، ويستحق ثلثيها إذا زادت مدة خدمته على خمس سنوات متتالية ولم تبلغ عشر سنوات، ويستحق المكافأة كاملة إذا بلغت مدة خدمته عشر سنوات فأكثر.",
    "If the work relation ends due to the worker's resignation, he shall be entitled to one third of the award after a service of not less than two consecutive years and not more than five years, to two thirds if his service exceeds five successive years but is less than ten years, and to the full award if his service amounts to ten years or more.",
  ),

  v(
    "86",
    "إذا اتفق الطرفان على خلاف ما ورد في المادة (الرابعة والثمانين) من هذا النظام بحيث تدخل في الأجر الذي تسوى على أساسه المكافأة جميع مبالغ العمولات أو النسب المئوية من المبيعات وما أشبه ذلك مما يدفع إلى العامل وتكون قابلة بطبيعتها للزيادة والنقص، وجب العمل بهذا الاتفاق.",
    "If the parties agree, contrary to Article (84) of this Law, that the wage on which the award is settled shall include all commissions or percentages of sales and the like paid to the worker that are by nature liable to increase and decrease, that agreement shall be applied.",
  ),

  v(
    "87",
    "استثناءً مما ورد في المادة الخامسة والثمانين من هذا النظام تستحق المكافأة كاملة في حالة ترك العامل العمل نتيجة لقوة قاهرة خارجة عن إرادته، كما تستحقها العاملة إذا أنهت العقد خلال ستة أشهر من تاريخ عقد زواجها أو ثلاثة أشهر من تاريخ وضعها.",
    "As an exception to Article (85) of this Law, the full award is due if the worker leaves the work as a result of a force majeure beyond his control. A female worker is likewise entitled to the full award if she ends the contract within six months from the date of her marriage contract or three months from the date of giving birth.",
  ),

  v(
    "88",
    "إذا انتهت خدمة العامل وجب على صاحب العمل أن يدفع له أجره ويصفّي حقوقه خلال أسبوع — على الأكثر — من تاريخ انتهاء العلاقة العقدية. أما إذا كان العامل هو الذي أنهى العقد، وجب على صاحب العمل تصفية حقوقه كاملة خلال مدة لا تزيد على أسبوعين. ولصاحب العمل أن يحسم أي دين مستحق له بسبب العمل من المبالغ المستحقة للعامل.",
    "If the worker's service ends, the employer shall pay the worker his wage and settle his entitlements within one week at most from the date the contractual relation ended. If the worker is the one who ended the contract, the employer shall settle the entitlements in full within a period not exceeding two weeks. The employer may deduct any debt due to him by reason of the work from the amounts due to the worker.",
  ),

  v(
    "90",
    "1 - يجب دفع أجر العامل وكل مبلغ مستحق له بالعملة الرسمية للبلاد كما يجب دفع الأجر في ساعات العمل ومكانه وفق الأحكام الآتية:\nأ - العمال باليومية: تُصرف أجورهم مرة كل أسبوع على الأقل.\nب - العمال ذوو الأجور الشهرية: تُصرف أجورهم مرة في الشهر.\nج - إذا كان العمل يؤدى بالقطعة ويحتاج لمدة تزيد على أسبوعين، فيجب أن يحصل العامل على دفعة كل أسبوع تتناسب مع ما أتمه من العمل ويُصرف باقي الأجر كاملاً خلال الأسبوع التالي لتسليم العمل.\nد - في غير الأحوال المذكورة تؤدى للعمال أجورهم مرة كل أسبوع على الأقل.\n2 - يجوز دفع الأجور عن طريق البنوك المعتمدة في المملكة، ذات الخدمات المعلوماتية، وفق الشروط والقواعد التي تحددها الوزارة بالتنسيق مع البنك المركزي السعودي.",
    "1 - The worker's wage and every amount due to him must be paid in the official currency of the country, and wages must be paid during working hours and at the workplace, in accordance with the following:\n(a) Daily-wage workers: wages paid at least once a week.\n(b) Monthly-wage workers: wages paid once a month.\n(c) If the work is performed by the piece and requires more than two weeks, the worker shall receive a weekly instalment commensurate with work completed, and the remainder in full during the week following delivery of the work.\n(d) In cases other than those mentioned, workers shall be paid at least once a week.\n2 - Wages may be paid through licensed banks in the Kingdom that provide information services, in accordance with the conditions and rules specified by the Ministry in coordination with the Saudi Central Bank.",
    { from: AMEND_2015, amendedBy: "M/46" },
  ),

  v(
    "91",
    "إذا تسبب العامل في فقد أو إتلاف أو تدمير آلات أو منتجات يملكها أو هي في عهدته وكان ذلك ناشئاً عن خطئه أو مخالفته تعليمات صاحب العمل ولم يكن نتيجة خطأ الغير أو قوة قاهرة، فلصاحب العمل أن يقتطع من أجر العامل القيمة اللازمة للإصلاح أو لإعادة الوضع إلى ما كان عليه على ألا يزيد ما يقتطع لهذا الغرض على أجر خمسة أيام في كل شهر. ولصاحب العمل حق التظلم إن كان له مقتض، وذلك بطلب ما هو أكثر من ذلك إذا كان للعامل مال آخر يمكن الاستيفاء منه. وللعامل أن يتظلم مما نُسب إليه أو من تقدير صاحب العمل للتعويض أمام المحكمة العمالية. فإذا حكمت بعدم أحقية صاحب العمل في الرجوع على العامل بما اقتطعه منه أو ببعضه وجب على صاحب العمل أن يرد إلى العامل ما اقتطع منه دون وجه حق خلال سبعة أيام من تاريخ صدور الحكم.",
    "If the worker causes the loss, damage or destruction of machinery or products owned by the employer or in the worker's custody, arising from his fault or from breach of the employer's instructions and not from the fault of another or force majeure, the employer may deduct from the worker's wage the amount needed for repair or restoration, provided the deduction for that purpose does not exceed five days' wage in any month. The employer may complain where warranted and claim more if the worker has other property from which recovery can be made. The worker may challenge what is attributed to him or the employer's assessment of compensation before the labour court. If the court holds that the employer was not entitled to recover all or part of what was deducted, the employer shall return the amount wrongly deducted within seven days of the judgment.",
  ),

  v(
    "92",
    "لا يجوز حسم أي مبلغ من أجور العامل لقاء حقوق خاصة دون موافقة خطية منه، إلا في الحالات الآتية:\n1 - استرداد قروض صاحب العمل، بشرط ألا يزيد ما يُحسم من العامل في هذه الحالة على 10% من أجره.\n2 - الاشتراكات التأمينات الاجتماعية وأي اشتراكات أخرى مستحقة على العامل ومقررة نظاماً.\n3 - اشتراكات العامل في صندوق الادخار والقروض المستحقة للصندوق.\n4 - أقساط أي مشروع يقوم به صاحب العمل لبناء المساكن بقصد تمليكها للعمال أو أي مزية أخرى.\n5 - الغرامات التي توقع على العامل بسبب المخالفات التي يرتكبها، وكذلك المبلغ الذي يقتطع منه مقابل ما أتلفه.\n6 - استيفاء دين إنفاذاً لأي حكم قضائي، على ألا يزيد ما يُحسم شهرياً لقاء ذلك على ربع الأجر المستحق للعامل ما لم يتضمن الحكم خلاف ذلك.\nوتُجمع النفقة الشرعية أولاً، ثم المأكل والملبس والمسكن قبل الديون الأخرى.",
    "No amount shall be deducted from the worker's wages against private rights without his written consent, except in the following cases:\n1 - Recovery of employer loans, provided the deduction does not exceed 10% of his wage.\n2 - Social insurance contributions and any other contributions due from the worker as provided by law.\n3 - The worker's contributions to thrift funds and loans due to such funds.\n4 - Instalments of any employer housing scheme intended to transfer ownership to workers, or any other benefit.\n5 - Fines imposed for offences, and amounts deducted for damage caused.\n6 - Satisfaction of a debt pursuant to a court judgment, provided the monthly deduction does not exceed one quarter of the wage due unless the judgment provides otherwise.\nLegal maintenance is collected first, then food, clothing and housing, before other debts.",
  ),

  v(
    "93",
    "لا يجوز- في جميع الأحوال- أن تزيد نسبة المبالغ المحسومة على نصف أجر العامل المستحق، ما لم يثبت لدى هيئة تسوية الخلافات العمالية إمكان الزيادة في الحسم على تلك النسبة، أو يثبت لديها حاجة العامل إلى أكثر من نصف أجره، وفي هذه الحالة الأخيرة لا يعطى العامل أكثر من ثلاثة أرباع أجره، مهما كان الأمر.",
    "In all cases, deductions made may not exceed half the worker's due wage, unless the Commission for the Settlement of Labor Disputes determines that further deductions can be made or that the worker is in need of more than half his wage. In the latter case, the worker may not be given more than three quarters of his wage, whatever the case.",
  ),

  v(
    "98",
    "لا يجوز تشغيل العامل تشغيلًا فعليًّا أكثر من ثماني ساعات في اليوم الواحد، إذا اعتمد صاحب العمل المعيار اليومي، أو أكثر من ثمان وأربعين ساعة في الأسبوع، إذا اعتمد المعيار الأسبوعي. وتخفض ساعات العمل الفعلية خلال شهر رمضان للمسلمين، بحيث لا تزيد على ست ساعات في اليوم، أو ست وثلاثين ساعة في الأسبوع.",
    "A worker may not actually work more than eight hours a day if the employer adopts the daily standard, or more than forty-eight hours a week if the weekly standard is adopted. Actual working hours during the month of Ramadan shall be reduced for Muslims so as not to exceed six hours a day or thirty-six hours a week.",
  ),

  v(
    "99",
    "يجوز زيادة ساعات العمل المنصوص عليها في المادة (الثامنة والتسعين) من هذا النظام إلى تسع ساعات في اليوم لبعض فئات العمال، أو في الصناعات والأعمال التي لا يشتغل فيها العامل بصفة مستمرة. كما يجوز تخفيضها إلى سبع ساعات في اليوم لبعض فئات العمال أو في الصناعات والأعمال الخطرة أو الضارة. وتحدد فئات العمال أو الصناعات أو الأعمال المشار إليها بقرار من الوزير.",
    "The working hours provided for in Article (98) of this Law may be increased to nine hours a day for certain categories of workers, or in industries and work in which the worker is not employed continuously. They may also be reduced to seven hours a day for certain categories of workers or in hazardous or harmful industries and work. The categories of workers or the industries or work referred to shall be specified by a decision of the Minister.",
  ),

  v(
    "100",
    "يجوز لصاحب العمل في المنشآت التي يقتضي العمل فيها أسلوباً لا يسمح بالوقف اليومي لساعات العمل المحددة في المادة (الثامنة والتسعين) من هذا النظام، أو في بعض الأنشطة المحددة بقرار من الوزير، زيادة ساعات العمل على ثماني ساعات في اليوم أو ثمان وأربعين ساعة في الأسبوع، بشرط ألا يزيد متوسط ساعات العمل عند احتسابه لمدة ثلاثة أسابيع أو أقل على ثماني ساعات في اليوم أو ثمان وأربعين ساعة في الأسبوع.",
    "In establishments whose work requires a method that does not allow a daily stop of the hours specified in Article (98) of this Law, or in certain activities specified by a ministerial decision, the employer may increase working hours beyond eight a day or forty-eight a week, provided that the average working hours, calculated over a period of three weeks or less, do not exceed eight hours a day or forty-eight hours a week.",
  ),

  v(
    "101",
    "تنظم ساعات العمل وفترات الراحة خلال اليوم، بحيث لا يعمل أي عامل أكثر من خمس ساعات متتالية دون فترة للراحة والصلاة والطعام لا تقل عن نصف ساعة في المرة الواحدة خلال مجموع ساعات العمل، وبحيث لا يبقى العامل في مكان العمل أكثر من إحدى عشرة ساعة في اليوم الواحد.",
    "Working hours and rest periods during the day shall be organised so that no worker works more than five consecutive hours without a period for rest, prayer and food of not less than half an hour at a time during the total working hours, and so that the worker does not remain at the workplace more than eleven hours a day.",
    { to: BEFORE_2015 },
  ),
  v(
    "101",
    "تنظم ساعات العمل وفترات الراحة خلال اليوم، بحيث لا يعمل العامل أكثر من خمس ساعات متتالية دون فترة للراحة والصلاة والطعام لا تقل عن نصف ساعة في المرة الواحدة خلال مجموع ساعات العمل، وبحيث لا يبقى العامل في مكان العمل أكثر من اثنتي عشرة ساعة في اليوم الواحد.",
    "Working hours and rest periods during the day shall be organised so that the worker does not work more than five consecutive hours without a period for rest, prayer and food of not less than half an hour at a time during the total working hours, and so that the worker does not remain at the workplace more than twelve hours a day.",
    { from: AMEND_2015, amendedBy: "M/46" },
  ),

  v(
    "102",
    "لا تدخل الفترات المخصصة للراحة والصلاة والطعام ضمن ساعات العمل الفعلية، ولا يكون العامل خلال هذه الفترات تحت سلطة صاحب العمل، ولا يجوز لصاحب العمل أن يلزم العامل بالبقاء خلالها في مكان العمل.",
    "The periods designated for rest, prayer and food shall not be counted within actual working hours. During those periods the worker shall not be under the employer's authority, and the employer may not require the worker to remain at the workplace during them.",
  ),

  v(
    "108",
    "لا تسري أحكام المادتين الثامنة والتسعين والأولى بعد المائة من هذا النظام على الحالات الآتية:\n1 - الأشخاص الذين يشغلون مناصب عالية ذات مسؤولية في الإدارة والتوجيه، إذا كان من شأن هذه المناصب أن يتمتع شاغلوها بسلطات صاحب العمل على العمال.\n2 - الأعمال التجهيزية أو التكميلية التي يجب إنجازها قبل ابتداء العمل أو بعده.\n3 - العمل الذي يكون متقطعاً بالضرورة.\n4 - العمال المخصصون للحراسة والنظافة، عدا عمال الحراسة الأمنية المدنية.\nوتحدد اللائحة الأعمال المبينة في الفقرات 2 و3 و4 من هذه المادة والحد الأقصى لساعات العمل فيها.",
    "The provisions of Articles 98 and 101 of this Law do not apply to the following cases:\n1 - Persons who occupy high posts of responsibility in management and direction, if the nature of such posts is such that their holders enjoy the employer's authority over the workers.\n2 - Preparatory or complementary work that must be performed before work begins or after it ends.\n3 - Work that is necessarily intermittent.\n4 - Workers assigned to guarding and cleaning, except civil security guards.\nThe Regulations shall specify the work in paragraphs 2, 3 and 4 and the maximum working hours therein.",
      ),

  v(
    "103",
    "يجوز للوزير تحديد الحالات والأعمال التي يتحتم فيها استمرار العمل دون توقف لأسباب فنية أو بسبب طبيعة الإنتاج أو الخدمة التي تقدمها المنشأة. وفي هذه الحالات يجب على صاحب العمل أن يمنح العمال فترات راحة بديلة تحسب من ساعات العمل الفعلية.",
    "The Minister may specify the cases and work in which continuity of work without interruption is required for technical reasons or because of the nature of the production or service the establishment provides. In those cases the employer must grant the workers alternative rest periods that count as actual working hours.",
  ),

  v(
    "104",
    "1- يوم الجمعة يوم الراحة الأسبوعية لجميع العمال.ويجوز لصاحب العمل- بعد إبلاغ مكتب العمل المختص- أن يستبدل بهذا اليوم لبعض عماله أي يوم من أيام الأسبوع، وعليه أن يمكنهم من القيام بواجباتهم الدينية، ولا يجوز تعويض يوم الراحة الأسبوعية بمقابل نقدي.\n\n2- يكون يوم الراحة الأسبوعية بأجر كامل، ولا يقل عن أربع وعشرين ساعة متتالية.",
    "1- Friday is the weekly rest day for all workers. The employer may — after notifying the competent labour office — substitute any other day of the week for some of his workers, and must enable them to perform their religious duties. The weekly rest day may not be compensated with a cash equivalent.\n\n2- The weekly rest day is with full pay and shall not be less than twenty-four consecutive hours.",
  ),

  v(
    "105",
    "استثناءً من حكم المادة (الرابعة بعد المائة) من هذا النظام، يجوز في الأماكن النائية وعن أعمال محددة بقرار من الوزير تجميع الراحات الأسبوعية المستحقة للعامل عن مدة لا تزيد على ثمانية أسابيع إذا وافق العامل كتابة وبعد موافقة الوزارة، وتُمنح للعامل مجمعة.",
    "By way of exception from Article (104) of this Law, in remote places and for work specified by a ministerial decision, the weekly rests due to the worker may be accumulated for a period not exceeding eight weeks if the worker consents in writing and after the Ministry's approval, and they shall be granted to the worker in a lump.",
  ),

  v(
    "106",
    "يجوز لصاحب العمل عدم التقيد بأحكام المواد الثامنة والتسعين والأولى بعد المائة والفقرة (1) من المادة الرابعة بعد المائة من هذا النظام في الحالات الآتية:\n1 - أعمال الجرد السنوي، وإعداد الميزانية، والتصفية، وقفل الحسابات، والاستعداد للبيع بأثمان مخفضة، والاستعداد للمواسم، بشرط ألا يزيد عدد الأيام التي يشتغل فيها العمال على ثلاثين يوماً في السنة.\n2 - إذا كان العمل لمنع وقوع حادث خطر، أو إصلاح ما نشأ عنه، أو تلافي خسارة محققة لمواد قابلة للتلف.\n3 - إذا كان التشغيل بقصد مواجهة ضغط عمل غير عادي.\n4 - الأعياد والمواسم والمناسبات الأخرى والأعمال الموسمية التي تحدد بقرار من الوزير.\nولا يجوز في جميع الحالات المتقدمة أن تزيد ساعات العمل الفعلية على عشر ساعات في اليوم، أو ستين ساعة في الأسبوع. ويحدد الوزير بقرار منه الحد الأقصى لساعات العمل الإضافية التي يسمح بها في السنة.",
    "The employer may, in the following cases, not observe Articles 98 and 101 and paragraph (1) of Article 104 of this Law:\n1 - Annual inventory, preparing the budget, liquidation, closing accounts, preparing for discounted sales, and preparing for seasons, provided the days on which workers work do not exceed thirty in the year.\n2 - Preventing a dangerous accident, repairing what resulted from it, or avoiding certain loss of perishable materials.\n3 - Meeting unusual work pressure.\n4 - Festivals, seasons and other occasions and seasonal work specified by a ministerial decision.\nIn all the foregoing cases, actual working hours may not exceed ten a day or sixty a week. The Minister shall, by decision, set the annual maximum of overtime hours permitted.",
  ),

  v(
    "107",
    "1- يجب على صاحب العمل أن يدفع للعامل أجراً إضافيًّا عن ساعات العمل الإضافية يوازي أجر الساعة مضافًا إليه 50% من أجره الأساسي.\n2 - إذا كان التشغيل في المنشأة على أساس المعيار الأسبوعي لساعات العمل تعد الساعات التي تزيد على الساعات المتخذة لهذا المعيار ساعات عمل إضافية.\n3 - تعد جميع ساعات العمل التي تؤدَّى في أيام العطل والأعياد ساعات إضافية.",
    "1- The employer must pay the worker overtime pay for overtime hours equal to the hourly wage plus 50% of his basic wage.\n2- If the establishment operates on the weekly hours standard, hours in excess of that standard are overtime hours.\n3- All hours worked on rest days and official holidays are overtime hours.",
    { to: BEFORE_2025 },
  ),
  v(
    "107",
    "1- يجب على صاحب العمل أن يدفع للعامل أجراً إضافيًّا عن ساعات العمل الإضافية يوازي أجر الساعة مضافاً إليه (50%) من أجره الأساسي، ويجوز لصاحب العمل بموافقة العامل أن يحتسب للعامل أيام إجازة تعويضية مدفوعة الأجر بدلاً عن الأجر المستحق للعامل لساعات العمل الإضافية. وتبين اللائحة الأحكام المتصلة بذلك.\n\n2 - إذا كان التشغيل في المنشأة على أساس المعيار الأسبوعي لساعات العمل تعد الساعات التي تزيد على الساعات المتخذة لهذا المعيار ساعات عمل إضافية.\n\n3 - تعد جميع ساعات العمل التي تؤدَّى في أيام العطل والأعياد ساعات إضافية.",
    "1- The employer must pay the worker overtime pay for overtime hours equal to the hourly wage plus 50% of his basic wage. With the worker's consent, the employer may credit paid compensatory leave days in place of the overtime pay due. The Regulations shall set out the related provisions.\n\n2- If the establishment operates on the weekly hours standard, hours in excess of that standard are overtime hours.\n\n3- All hours worked on rest days and official holidays are overtime hours.",
    { from: AMEND_2025, amendedBy: "M/44" },
  ),

  v(
    "109",
    "1- يستحق العامل عن كل عام إجازة سنوية لا تقل مدتها عن واحد وعشرين يومًا، تُزاد إلى مدة لا تقل عن ثلاثين يومًا إذا أمضى العامل في خدمة صاحب العمل خمس سنوات متصلة، وتكون الإجازة بأجر يدفع مقدمًا.\n\n2 - يجب أن يتمتع العامل بإجازته في سنة استحقاقها، ولا يجوز النزول عنها، أو أن يتقاضى بدلًا نقديًّا عوضًا عن الحصول عليها أثناء خدمته، ولصاحب العمل أن يحدد مواعيد هذه الإجازات وفقًا لمقتضيات العمل، أو يمنحها بالتناوب لكي يؤمن سير عمله، وعليه إشعار العامل بالميعاد المحدد لتمتعه بالإجازة بوقت كافٍ لا يقل عن ثلاثين يومًا.",
    "1- A worker is entitled, for each year, to annual leave of not less than twenty-one days, increased to not less than thirty days if the worker has spent five continuous years in the employer's service. The leave is with pay paid in advance.\n\n2- The worker must take the leave in the year it falls due. It may not be waived, nor may a cash equivalent be taken in lieu of it during service. The employer may set the dates of such leave according to work requirements, or grant it in rotation to secure the progress of work, and must notify the worker of the date set for taking the leave with sufficient notice of not less than thirty days.",
  ),

  v(
    "110",
    "1- للعامل بموافقة صاحب العمل أن يؤجل إجازته السنوية أو أياماً منها إلى السنة التالية.\n2 - لصاحب العمل حق تأجيل إجازة العامل بعد نهاية سنة استحقاقها إذا اقتضت ظروف العمل ذلك لمدة لا تزيد على تسعين يوماً، فإذا اقتضت ظروف العمل استمرار التأجيل وجب الحصول على موافقة العامل كتابة، على ألا يتعدى التأجيل نهاية السنة التالية لسنة استحقاق الإجازة.",
    "1- The worker may, with the employer's approval, postpone his annual leave or days thereof to the following year.\n2- The employer may postpone the worker's leave after the end of the year it falls due, if work circumstances so require, for a period not exceeding ninety days. If work circumstances require further postponement, the worker's written consent is required, and postponement may not go beyond the end of the year following the year of entitlement.",
  ),

  v(
    "111",
    "للعامل إذا ترك العمل الحق في الحصول على أجرة عن أيام الإجازة المستحقة إذا لم يتمتع بها، وذلك بالنسبة إلى المدة التي لم يحصل على إجازته عنها. كما يستحق أجرة الإجازة عن أجزاء السنة بنسبة ما قضاه منها في العمل.",
    "If the worker leaves the work he is entitled to pay for the leave days due if he has not taken them, in respect of the period for which he has not obtained his leave. He is also entitled to leave pay for portions of the year in proportion to the time spent in the work.",
  ),

  v(
    "112",
    "لكل عامل الحق في إجازة بأجر كامل في الأعياد والمناسبات التي تحددها اللائحة.",
    "Every worker is entitled to leave with full pay on the Eids and occasions specified in the Regulations.",
  ),

  v(
    "113",
    "مع مراعاة إجازات المرأة العاملة المحددة بموجب هذا النظام، للعامل الحق في إجازة بأجر كامل لمدة خمسة أيام في حالة وفاة زوجه أو أحد أصوله أو فروعه، أو عند زواجه، وثلاثة أيام في حالة ولادة مولود له. ويحق لصاحب العمل أن يطلب الوثائق المؤيدة للحالات المشار إليها.",
    "Without prejudice to the leaves of a female worker specified under this Law, a worker is entitled to leave with full pay of five days on the death of a spouse or of an ascendant or descendant, or on marriage, and three days on the birth of a child to him. The employer may require supporting documents for the cases referred to.",
    { from: AMEND_2015, to: BEFORE_2025, amendedBy: "M/46" },
  ),
  v(
    "113",
    "مع مراعاة إجازات المرأة العاملة المحددة بموجب هذا النظام، للعامل الحق في إجازة بأجر كامل لمدة (خمسة) أيام عند زواجه، أو في حالة وفاة زوجه أو أحد أصوله أو فروعه، و(ثلاثة) أيام في حالة وفاة الأخ أو الأخت؛ تحتسب جميعها من تاريخ الواقعة. و(ثلاثة) أيام في حالة ولادة مولود له خلال (سبعة) أيام من تاريخ الولادة. ويحق لصاحب العمل أن يطلب الوثائق المؤيدة لهذه الحالات.",
    "Without prejudice to the leaves of a female worker specified under this Law, a worker is entitled to leave with full pay of five days on marriage, or on the death of a spouse or of an ascendant or descendant, and three days on the death of a brother or sister; all counted from the date of the event; and three days on the birth of a child to him, within seven days of the date of birth. The employer may require supporting documents for these cases.",
    { from: AMEND_2025, amendedBy: "M/44" },
  ),

  v(
    "114",
    "للعامل الحق في الحصول على إجازة بأجر لا تقل مدتها عن عشرة أيام ولا تزيد على خمسة عشر يومًا بما فيها إجازة عيد الأضحى؛ وذلك لأداء فريضة الحج لمرة واحدة طوال مدة خدمته إذا لم يكن قد أداها من قبل، ويشترط لاستحقاق هذه الإجازة أن يكون العامل قد أمضى في العمل لدى صاحب العمل سنتين متصلتين على الأقل، ولصاحب العمل أن يحدد عدد العمال الذين يمنحون هذه الإجازة سنويًّا وفقًا لمقتضيات العمل.",
    "A worker is entitled to paid leave of not less than ten days and not more than fifteen days, including Eid al-Adha leave, to perform Hajj once throughout the period of service if he has not performed it before. Entitlement requires that the worker has spent at least two continuous years in work with the employer. The employer may determine the number of workers granted this leave each year according to work requirements.",
  ),

  v(
    "115",
    "1 - للعامل - إذا وافق صاحب العمل على انتسابه إلى مؤسسة تعليمية أو قَبِل استمراره فيها – الحق في إجازة بأجر كامل لتأدية الامتحان عن سنة غير معادة تحدد مدتها بعد أيام الامتحان الفعلية. أما إذا كان الامتحان عن سنة معادة فيكون للعامل الحق في إجازة دون أجر بعدد أيام الامتحان الفعلية. ويحرم العامل من أجر الإجازة إذا ثبت أنه لم يؤدِّ الامتحان، مع عدم الإخلال بحق صاحب العمل في مساءلته تأديبيًّا.\n\n2 - إذا لم يحصل العامل على موافقة صاحب العمل على انتسابه إلى مؤسسة تعليمية، فله أن يحصل على إجازة لتأدية الامتحان بعدد أيام الامتحان الفعلية تحتسب من إجازته السنوية في حال توافرها، وعند تعذر ذلك فللعامل أن يحصل على إجازة دون أجر بعدد أيام الامتحان الفعلية.\n\n3 - على العامل أن يتقدم بطلب الإجازة قبل موعدها بخمسة عشر يوماً على الأقل.\n\n4 - لصاحب العمل أن يطلب من العامل تقديم الوثائق المؤيدة لطلب الإجازة، وكذلك ما يدل على أدائه الامتحان.",
    "1 - If the employer agrees to the worker's enrolment in an educational institution or to his continuing therein, the worker is entitled to leave with full pay to sit an examination for a non-repeated year, for a duration matching the actual examination days. If the examination is for a repeated year, the worker is entitled to unpaid leave for the actual examination days. The worker is denied the leave wage if it is proven that he did not sit the examination, without prejudice to the employer's right to disciplinary action.\n\n2 - If the worker does not obtain the employer's approval to enrol in an educational institution, he may take leave to sit the examination for the actual examination days, counted from his annual leave if available; otherwise he may take unpaid leave for the actual examination days.\n\n3 - The worker must apply for the leave at least fifteen days before it is due.\n\n4 - The employer may require supporting documents for the leave application and proof of having taken the examination.",
    { from: AMEND_2015, amendedBy: "M/46" },
  ),

  v(
    "116",
    "يجوز للعامل بموافقة صاحب العمل الحصول على إجازة دون أجر، يتفق الطرفان على تحديد مدتها، ويعد عقد العمل موقوفًا خلال مدة الإجازة فيما زاد على عشرين يومًا، ما لم يتفق الطرفان على خلاف ذلك.",
    "A worker may, with the employer's approval, obtain leave without pay for a duration agreed by the two parties. The work contract shall be deemed suspended for the duration of the leave in excess of twenty days, unless both parties agree otherwise.",
  ),

  v(
    "117",
    "للعامل الذي يثبت مرضه الحق في إجازة مرضية بأجر عن الثلاثين يومًا الأولى، وبثلاثة أرباع الأجر عن الستين يومًا التالية، ودون أجر للثلاثين يومًا التي تلي ذلك خلال السنة الواحدة، سواء أكانت هذه الإجازات متصلة أم متقطعة، ويقصد بالسنة الواحدة: السنة التي تبدأ من تاريخ أول إجازة مرضية.",
    "A worker whose illness is established is entitled to sick leave with pay for the first thirty days, with three-quarters pay for the following sixty days, and without pay for the thirty days thereafter, during one year, whether these leaves are continuous or intermittent. One year means the year beginning from the date of the first sick leave.",
  ),

  v(
    "118",
    "لا يجوز للعامل أثناء تمتعه بأي من إجازاته المنصوص عليها في هذا الفصل أن يعمل لدى صاحب عمل آخر، فإذا أثبت صاحب العمل أن العامل قد خالف ذلك فله أن يحرمه من أجره عن مدة الإجازة أو يسترد ما سبق أن أداه إليه من ذلك الأجر.",
    "A worker may not, while enjoying any of the leaves provided for in this Chapter, work for another employer. If the employer proves that the worker has done so, he may deprive him of his wage for the leave period or recover what he has already paid of that wage.",
  ),

  v(
    "121",
    "على صاحب العمل حفظ المنشأة في حالة صحية ونظيفة، وإنارتها وتأمين المياه الصالحة للشرب والاغتسال، وغير ذلك من قواعد الحماية والسلامة والصحة المهنية وإجراءاتها ومستوياتها وفقًا لما يحدده الوزير بقرار منه.",
    "The employer shall keep the establishment in a hygienic and clean condition, light it, and provide water fit for drinking and washing, and such other occupational protection, safety and health rules, procedures and standards as the Minister determines by decision.",
  ),

  v(
    "122",
    "على كل صاحب عمل أن يتخذ الاحتياطات اللازمة لحماية العمال من الأخطار والأمراض الناجمة عن العمل، والآلات المستعملة، ووقاية العمل وسلامته، وعليه أن يعلن في مكان ظاهر في المنشأة التعليمات الخاصة بسلامة العمل والعمال، وذلك باللغة العربية وبأي لغة أخرى يفهمها العمال عند الاقتضاء، ولا يجوز لصاحب العمل أن يحمّل العمال أو يقتطع من أجورهم أي مبلغ لقاء توفير هذه الحماية.",
    "Every employer shall take the precautions necessary to protect workers from hazards and diseases arising from the work and the machinery used, and to safeguard the work. He shall post in a conspicuous place in the establishment the instructions on work and worker safety, in Arabic and in any other language the workers understand where needed. The employer may not charge the workers or deduct from their wages any amount for providing this protection.",
  ),

  v(
    "123",
    "على صاحب العمل إحاطة العامل قبل مزاولة العمل بمخاطر مهنته، وإلزامه باستعمال وسائل الوقاية المقررة لها، وعليه أن يوفر أدوات الوقاية الشخصية المناسبة للعمال، وتدريبهم على استخدامها.",
    "The employer shall inform the worker, before starting work, of the hazards of his occupation, require him to use the prescribed protective means, provide suitable personal protective equipment, and train the workers in its use.",
  ),

  v(
    "149",
    "ملغاة.",
    "Repealed.",
    { from: AMEND_2025, amendedBy: "M/44" },
  ),

  v(
    "151",
    "1 - للمرأة العاملة الحق في إجازة وضع بأجر كامل لمدة عشرة أسابيع توزعها كيف تشاء؛ تبدأ بحدٍّ أقصى بأربعة أسابيع قبل التاريخ المرجح للوضع، ويحدد التاريخ المرجح للوضع بموجب شهادة طبية مصدقة من جهة صحية. 2 - يحظر تشغيل المرأة بعد الوضع بأي حال من الأحوال خلال الستة أسابيع التالية له، ولها الحق في تمديد الإجازة مدة شهر دون أجر. 3 - للمرأة العاملة - في حالة إنجاب طفل مريض أو من ذوي الاحتياجات الخاصة وتتطلب حالته الصحية مرافقاً مستمراً له - الحق في إجازة مدتها شهر بأجر كامل تبدأ بعد انتهاء مدة إجازة الوضع، ولها الحق في تمديد الإجازة لمدة شهر دون أجر.",
    "1 - A female worker is entitled to maternity leave with full pay of ten weeks, which she may allocate as she wishes, starting at most four weeks before the expected date of delivery, determined by a medical certificate authenticated by a health authority. 2 - A woman may not in any case be employed during the six weeks following childbirth, and she may extend the leave by one month without pay. 3 - A female worker who gives birth to a sick child or a child with special needs whose health condition requires a constant companion is entitled to leave of one month with full pay starting after maternity leave ends, and she may extend that leave by one month without pay.",
    { from: AMEND_2015, to: BEFORE_2025, amendedBy: "M/46" },
  ),
  v(
    "151",
    "1- للمرأة العاملة الحق في إجازة وضع بأجر كامل لمدة (اثني عشر) أسبوعاً، منها وجوبيًّا الأسابيع الستة التالية للوضع، ولها أن توزع الأسابيع الستة المتبقية وفق ما تراه، ابتداءً من أربعة أسابيع قبل التاريخ المرجح للوضع. ويحدد التاريخ المرجح للوضع بموجب شهادة طبية مصدقة من جهة صحية. وفي حال قل المتبقي من مدة الإجازة عن (ستة) أسابيع نتيجة تأخر الوضع عن تاريخه المرجح، فتحتسب المدة المكملة لها إجازة دون أجر. وفي جميع الأحوال يحق للمرأة العاملة تمديد هذه الإجازة (شهراً) دون أجر.\n\n2- للمرأة العاملة -في حالة إنجاب طفل مريض أو من ذوي الإعاقة تتطلب حالته الصحية مرافقاً مستمراً له- الحق في إجازة مدتها (شهر) بأجر كامل تبدأ بعد انتهاء مدة إجازة الوضع، ولها الحق في تمديد الإجازة لمدة شهر دون أجر.",
    "1- A female worker is entitled to maternity leave with full pay of twelve weeks, of which the six weeks following childbirth are mandatory, and she may allocate the remaining six weeks as she sees fit, starting up to four weeks before the expected date of delivery. The expected date is determined by a medical certificate authenticated by a health authority. If the remainder of the leave is less than six weeks because delivery is later than the expected date, the completing period is counted as unpaid leave. In all cases the female worker may extend this leave by one month without pay.\n\n2- A female worker who gives birth to a sick child or a child with a disability whose health condition requires a constant companion is entitled to leave of one month with full pay starting after maternity leave ends, and she may extend that leave by one month without pay.",
    { from: AMEND_2025, amendedBy: "M/44" },
  ),

  v(
    "154",
    "يحق للمرأة العاملة عندما تعود إلى مزاولة عملها بعد إجازة الوضع أن تأخذ بقصد إرضاع مولودها فترة أو فترات للاستراحة لا تزيد في مجموعها على الساعة في اليوم الواحد، وذلك علاوة على فترات الراحة الممنوحة لجميع العمال، وتحسب هذه الفترة أو الفترات من ساعات العمل الفعلية، ولا يترتب عليها تخفيض الأجر.",
    "When a female worker returns to work after maternity leave she is entitled, for the purpose of nursing her child, to a rest period or periods totalling not more than one hour a day, in addition to the rest periods granted to all workers. That period counts as actual working hours and does not reduce her wage.",
  ),

  v(
    "155",
    "يحظر على صاحب العمل فصل العاملة أو إنذارها بالفصل أثناء حملها أو أثناء تمتعها بإجازة الوضع، ويشمل ذلك مدة مرضها الناشئ عن الحمل أو الوضع، على أن يثبت المرض بشهادة طبية معتمدة، وألا تتجاوز مدة غيابها (مائة وثمانين) يوماً.",
    "The employer is prohibited from dismissing a female worker or giving her notice of dismissal during her pregnancy or while she is on maternity leave, including the period of illness arising from pregnancy or childbirth, provided the illness is established by an authenticated medical certificate and her absence does not exceed one hundred and eighty days.",
    { from: AMEND_2015, amendedBy: "M/134" },
  ),

  v(
    "160",
    "1- للمرأة العاملة المسلمة التي يتوفى زوجها الحق في إجازة عدة بأجر كامل لمدة لا تقل عن أربعة أشهر وعشرة أيام من تاريخ الوفاة، ولها الحق في تمديد هذه الإجازة دون أجر إن كانت حاملاً - خلال هذه الفترة - حتى تضع حملها، ولا يجوز لها الاستفادة من باقي إجازة العدة الممنوحة لها بموجب هذا النظام بعد وضع حملها.\n\n2- للمرأة العاملة غير المسلمة التي يتوفى زوجها الحق في إجازة بأجر كامل لمدة خمسة عشر يوماً. وفي جميع الأحوال لا يجوز للعاملة المتوفى عنها زوجها ممارسة أي عمل لدى الغير خلال هذه المدة. ويحق لصاحب العمل أن يطلب الوثائق المؤيدة للحالات المشار إليها.",
    "1- A Muslim female worker whose husband dies is entitled to iddah leave with full pay of not less than four months and ten days from the date of death. She may extend this leave without pay if she is pregnant during that period until she gives birth, and she may not use the remainder of the iddah leave granted under this Law after giving birth.\n\n2- A non-Muslim female worker whose husband dies is entitled to leave with full pay of fifteen days. In all cases a female worker whose husband has died may not work for another party during this period. The employer may require supporting documents for the cases referred to.",
    { from: AMEND_2015, amendedBy: "M/46" },
  ),

  v(
    "153",
    "على صاحب العمل أن يوفر الرعاية الطبية للمرأة العاملة أثناء الحمل والولادة.",
    "The employer shall provide medical care for the female worker during pregnancy and childbirth.",
  ),

  v(
    "159",
    "على صاحب العمل في جميع الأماكن التي يعمل فيها نساء وفي جميع المهن أن يوفر لهن مقاعد لاستراحة النساء العاملات. وعلى كل صاحب عمل يشغّل خمسين عاملة فأكثر أن يهيئ مكاناً مناسباً يتوافر فيه العدد الكافي من المربيات لرعاية أطفال العاملات الذين تقل أعمارهم عن ست سنوات، وذلك إذا بلغ عدد الأطفال عشرة فأكثر.",
    "In every place where women work, and in every occupation, the employer shall provide seats for women workers to rest. An employer who employs fifty or more female workers shall prepare a suitable place with a sufficient number of attendants to care for the workers' children under six years of age, if the number of such children is ten or more.",
  ),

  v(
    "161",
    "لا يجوز تشغيل الأحداث في الأعمال الخطرة أو الصناعات الضارة، أو في المهن والأعمال التي يحتمل أن تعرض صحتهم أو سلامتهم أو أخلاقهم للخطر، بسبب طبيعتها أو الظروف التي تؤدى فيها. ويحدد الوزير بقرار منه الأعمال والصناعات والمهن المشار إليها.",
    "Juveniles may not be employed in hazardous work or harmful industries, or in occupations and work that may endanger their health, safety or morals by reason of their nature or the conditions in which they are performed. The Minister shall, by decision, specify the work, industries and occupations referred to.",
  ),

  v(
    "162",
    "1 - لا يجوز تشغيل أي شخص لم يتم الخامسة عشرة من عمره ولا يسمح له بدخول أماكن العمل، وللوزير أن يرفع هذه السن في بعض الصناعات أو المناطق أو بالنسبة لبعض فئات الأحداث بقرار منه.\n2 - استثناءً من الفقرة (1) من هذه المادة يجوز للوزير أن يسمح بتشغيل أو عمل الأشخاص الذين تتراوح أعمارهم ما بين (13) و(15) سنة في أعمال خفيفة، يراعى فيها الآتي:\n2/1 - ألا يحتمل أن تكون ضارة بصحتهم أو نموهم.\n2/2 - ألا تعطل مواظبتهم في المدرسة واشتراكهم في برامج التوجيه أو التدريب المهني، أو تضعف قدرتهم على الاستفادة من التعليم الذي يتلقونه.",
    "1 - No person who has not completed fifteen years of age may be employed, nor may he be allowed to enter workplaces. The Minister may raise that age in certain industries or regions or for certain categories of juveniles by decision.\n2 - By way of exception from paragraph (1), the Minister may permit the employment or work of persons aged between thirteen and fifteen years in light work, provided that:\n2/1 - it is not likely to be harmful to their health or development;\n2/2 - it does not prejudice their school attendance or participation in vocational guidance or training programmes, or reduce their ability to benefit from the education they receive.",
  ),

  v(
    "163",
    "يحظر تشغيل الأحداث أثناء فترة من الليل لا تقل عن اثنتي عشرة ساعة متتالية إلا في الحالات التي يحددها الوزير بقرار منه.",
    "Juveniles may not be employed during a night period of less than twelve consecutive hours, except in cases specified by a decision of the Minister.",
  ),

  v(
    "164",
    "لا يجوز تشغيل الأحداث تشغيلاً فعلياً أكثر من ست ساعات في اليوم الواحد لسائر شهور السنة، عدا شهر رمضان فيجب ألا تزيد ساعات العمل الفعلية فيه على أربع ساعات. وتنظم ساعات العمل بحيث لا يعمل الحدث أكثر من أربع ساعات متصلة، دون فترة أو أكثر للراحة والطعام والصلاة، لا تقل في المرة الواحدة عن نصف ساعة، وبحيث لا يبقى في مكان العمل أكثر من سبع ساعات. ولا يجوز تشغيل الأحداث في أيام الراحة الأسبوعية أو في أيام الأعياد والعطلات الرسمية والإجازة السنوية. ولا تسري عليهم الاستثناءات التي نصت عليها المادة السادسة بعد المائة من هذا النظام.",
    "Juveniles may not actually work more than six hours a day in all months of the year, except Ramadan when actual hours may not exceed four. Hours shall be organised so that a juvenile does not work more than four consecutive hours without one or more periods for rest, food and prayer of at least half an hour each, and so that he does not remain at the workplace more than seven hours. Juveniles may not work on weekly rest days, Eids, official holidays or annual leave. The exceptions in Article 106 do not apply to them.",
  ),
];

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function laborDayKey(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const raw = String(value ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Canonical article key: "93", "79 مكرر". */
export function normalizeArticleKey(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
  s = s.replace(/^المادة\s*/i, "").replace(/^art(?:icle)?\.?\s*/i, "");
  s = s.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  if (/^79\s*(مكرر|bis)$/i.test(s)) return "79 مكرر";
  return s;
}

/** In-force official wording for a Labour Law article number. */
export function articleOfficialText(article, onDate) {
  const key = normalizeArticleKey(article);
  if (!key) return null;
  const day = laborDayKey(onDate);
  const rows = LABOR_ARTICLE_TEXTS.filter((r) => r.article === key);
  if (!rows.length) return null;
  const inForce = rows.filter(
    (r) => r.effectiveFrom <= day && (!r.effectiveTo || day <= r.effectiveTo),
  );
  const row = inForce.slice().sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (!row) return null;
  return {
    article: row.article,
    ar: row.ar,
    en: row.en,
    sourceUrl: BOE_LABOUR_LAW_URL,
    localPdf: HRSD_LABOUR_LAW_PDF,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    amendedBy: row.amendedBy,
  };
}
