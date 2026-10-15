/**
 * لائحة تنظيم العمل — the establishment's approved schedule of offences and penalties.
 *
 *   المادة 67 — لا يُوقَّع جزاء غير وارد في النظام أو في لائحة تنظيم العمل.
 *   المادة 68 — لا يُشدَّد الجزاء عند التكرار إذا انقضى 180 يوماً على إبلاغ الجزاء السابق.
 *   المادة 70 — الغرامة عن المخالفة الواحدة لا تزيد على أجر خمسة أيام.
 *
 * Until the establishment records its own approved regulation, the ministry's model schedule is
 * shown as guidance only (`source: "model"`); once recorded (`source: "own"`), a sanction must name
 * a clause from it. Each clause has up to four steps (first … fourth time); a step reads as a
 * written warning, a percentage of the daily wage, a number of days, or dismissal.
 */

const DAY = 86400000;

function dateOnly(v) {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function daysBetween(a, b) {
  const x = dateOnly(a);
  const y = dateOnly(b);
  if (!x || !y) return null;
  return Math.round((new Date(`${y}T00:00:00Z`) - new Date(`${x}T00:00:00Z`)) / DAY);
}

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** «10 يناير 2026» — reads the same way inside right-to-left text, unlike 2026-01-10. */
export function regulationDate(iso, ar = true) {
  const d = dateOnly(iso);
  if (!d) return "";
  const m = Number(d.slice(5, 7)) - 1;
  return `${Number(d.slice(8, 10))} ${(ar ? MONTHS_AR : MONTHS_EN)[m]} ${d.slice(0, 4)}`;
}

const LATE_PLUS = "بالإضافة إلى حسم أجر دقائق التأخر";
const HOURS_PLUS = "بالإضافة إلى حسم أجر ساعات التأخر";
const LEFT_PLUS = "بالإضافة إلى حسم أجر مدة ترك العمل";
const ABSENT_PLUS = "بالإضافة إلى حسم أجر مدة الغياب";
const DEFER_ONCE = "تأجيل الترقية أو الحرمان من العلاوة لمرة واحدة";
const AWARD = "فصل مع المكافأة";
const ESCALATE = ["يومان", "ثلاثة أيام", "خمسة أيام", AWARD];
const ART80_NO_AWARD = "فصل بدون مكافأة أو إشعار أو تعويض بموجب المادة (الثمانين)";

/** The three penalty tables of Annex 1 (النموذج الموحد للائحة تنظيم العمل), in their order. */
export const MODEL_GROUPS = [
  { id: "time", ar: "أولاً: مخالفات تتعلق بمواعيد العمل", en: "I. Offences relating to working hours" },
  { id: "org", ar: "ثانياً: مخالفات تتعلق بتنظيم العمل", en: "II. Offences relating to work organisation" },
  { id: "conduct", ar: "ثالثاً: مخالفات تتعلق بسلوك العامل", en: "III. Offences relating to the worker's conduct" },
];

const clause = (group, no, id, ar, en, steps, extra = {}) => ({ id, group, no, ar, en, steps, ...extra });

/**
 * The ministry's unified model regulation (Implementing Regulations, Annex 1) — its three penalty
 * tables transcribed cell by cell. Percentages are a share of the daily wage (the tables' header);
 * "يوم/يومان/ثلاثة أيام…" are days' wage deducted. A shorter list means the annex leaves the later
 * times empty ("-------"). Ids of the earlier seven-row schedule are kept where they map.
 */
export const MODEL_REGULATION = {
  source: "model",
  approvalNo: "",
  approvedAt: "",
  clauses: [
    clause("time", 1, "late15", "التأخر عن مواعيد الحضور للعمل لغاية (15) دقيقة دون إذن أو عذر مقبول، إذا لم يترتب على ذلك تعطيل عمال آخرين", "Late up to 15 minutes without leave or excuse, not holding up other workers", ["إنذار كتابي", "5%", "10%", "20%"]),
    clause("time", 2, "time_2", "التأخر عن مواعيد الحضور للعمل لغاية (15) دقيقة دون إذن أو عذر مقبول، إذا ترتب على ذلك تعطيل عمال آخرين", "Late up to 15 minutes without leave or excuse, holding up other workers", ["إنذار كتابي", "15%", "25%", "50%"]),
    clause("time", 3, "late30", "التأخر عن مواعيد الحضور للعمل أكثر من (15) دقيقة لغاية (30) دقيقة دون إذن أو عذر مقبول، إذا لم يترتب على ذلك تعطيل عمال آخرين", "Late 15–30 minutes without leave or excuse, not holding up other workers", ["10%", "15%", "25%", "50%"]),
    clause("time", 4, "time_4", "التأخر عن مواعيد الحضور للعمل أكثر من (15) دقيقة لغاية (30) دقيقة دون إذن أو عذر مقبول، إذا ترتب على ذلك تعطيل عمال آخرين", "Late 15–30 minutes without leave or excuse, holding up other workers", ["25%", "50%", "75%", "يوم"]),
    clause("time", 5, "time_5", "التأخر عن مواعيد الحضور للعمل أكثر من (30) دقيقة لغاية (60) دقيقة دون إذن أو عذر مقبول، إذا لم يترتب على ذلك تعطيل عمال آخرين", "Late 30–60 minutes without leave or excuse, not holding up other workers", ["25%", "50%", "75%", "يوم"]),
    clause("time", 6, "time_6", "التأخر عن مواعيد الحضور للعمل أكثر من (30) دقيقة لغاية (60) دقيقة دون إذن أو عذر مقبول، إذا ترتب على ذلك تعطيل عمال آخرين", "Late 30–60 minutes without leave or excuse, holding up other workers", ["30%", "50%", "يوم", "يومان"], { plus: LATE_PLUS }),
    clause("time", 7, "time_7", "التأخر عن مواعيد الحضور للعمل لمدة تزيد على ساعة دون إذن أو عذر مقبول، سواء ترتب أو لم يترتب على ذلك تعطيل عمال آخرين", "Late more than one hour without leave or excuse", ["إنذار كتابي", "يوم", "يومان", "ثلاثة أيام"], { plus: HOURS_PLUS }),
    clause("time", 8, "early", "ترك العمل أو الانصراف قبل الميعاد دون إذن أو عذر مقبول بما لا يتجاوز (15) دقيقة", "Leaving work or leaving early without leave or excuse, up to 15 minutes", ["إنذار كتابي", "10%", "25%", "يوم"], { plus: LEFT_PLUS }),
    clause("time", 9, "time_9", "ترك العمل أو الانصراف قبل الميعاد دون إذن أو عذر مقبول بما يتجاوز (15) دقيقة", "Leaving work or leaving early without leave or excuse, over 15 minutes", ["10%", "25%", "50%", "يوم"], { plus: LEFT_PLUS }),
    clause("time", 10, "time_10", "البقاء في أماكن العمل أو العودة إليها بعد انتهاء مواعيد العمل دون إذن مسبق", "Staying at or returning to the workplace after hours without prior leave", ["إنذار كتابي", "10%", "25%", "يوم"]),
    clause("time", 11, "absent1", "الغياب دون إذن كتابي أو عذر مقبول لمدة يوم، خلال السنة العقدية الواحدة", "One day's absence without written leave or excuse, within one contract year", ["50%", "يوم", "يومان", "ثلاثة أيام"]),
    clause("time", 12, "time_12", "الغياب المتصل دون إذن كتابي أو عذر مقبول من يومين إلى ستة أيام، خلال السنة العقدية الواحدة", "Continuous absence of two to six days without written leave or excuse, within one contract year", ["يومان", "ثلاثة أيام", "أربعة أيام", DEFER_ONCE], { plus: ABSENT_PLUS }),
    clause("time", 13, "time_13", "الغياب المتصل دون إذن كتابي أو عذر مقبول من سبعة أيام إلى عشرة أيام، خلال السنة العقدية الواحدة", "Continuous absence of seven to ten days without written leave or excuse, within one contract year", ["أربعة أيام", "خمسة أيام", DEFER_ONCE, "الفصل من العمل مع المكافأة إذا لم يتجاوز مجموع الغياب (30) يوماً"], { plus: ABSENT_PLUS }),
    clause("time", 14, "time_14", "الغياب المتصل دون إذن كتابي أو عذر مقبول من أحد عشر يوماً إلى أربعة عشر يوماً، خلال السنة العقدية الواحدة", "Continuous absence of eleven to fourteen days without written leave or excuse, within one contract year", ["خمسة أيام", `${DEFER_ONCE} مع توجيه إنذار بالفصل طبقاً للمادة (الثمانين) من نظام العمل`, "الفصل من العمل طبقاً للمادة (الثمانين) من نظام العمل"], { plus: ABSENT_PLUS, art80: "consecutive" }),
    clause("time", 15, "time_15", "الانقطاع عن العمل دون سبب مشروع مدة تزيد على خمسة عشر يوماً متصلة، خلال السنة العقدية الواحدة", "Interruption of work without a legitimate reason for more than fifteen consecutive days, within one contract year", ["الفصل دون مكافأة أو تعويض، على أن يسبقه إنذار كتابي بعد الغياب مدة عشرة أيام، في نطاق حكم المادة (الثمانين) من النظام"], { art80: "consecutive" }),
    clause("time", 16, "time_16", "الغياب المتقطع دون سبب مشروع مدداً تزيد في مجموعها على ثلاثين يوماً خلال السنة العقدية الواحدة", "Intermittent absence without a legitimate reason totalling more than thirty days within one contract year", ["الفصل دون مكافأة أو تعويض، على أن يسبقه إنذار كتابي بعد الغياب مدة عشرين يوماً، في نطاق حكم المادة (الثمانين) من النظام"], { art80: "intermittent" }),

    clause("org", 1, "org_1", "التواجد دون مبرر في غير مكان العمل المخصص للعامل أثناء وقت الدوام", "Being, without reason, away from the assigned workplace during working time", ["10%", "25%", "50%", "يوم"]),
    clause("org", 2, "org_2", "استقبال زائرين في غير أمور عمل المنشأة في أماكن العمل، دون إذن من الإدارة", "Receiving visitors on non-work matters at the workplace without management's leave", ["إنذار كتابي", "10%", "15%", "25%"]),
    clause("org", 3, "org_3", "استعمال آلات ومعدات وأدوات المنشأة لأغراض خاصة، دون إذن", "Using the establishment's machines, equipment or tools for private purposes without leave", ["إنذار كتابي", "10%", "25%", "50%"]),
    clause("org", 4, "org_4", "تدخل العامل، دون وجه حق، في أي عمل ليس في اختصاصه، أو لم يعهد به إليه", "Interfering without right in work outside one's remit or not assigned", ["50%", "يوم", "يومان", "ثلاثة أيام"]),
    clause("org", 5, "org_5", "الخروج أو الدخول من غير المكان المخصص لذلك", "Leaving or entering other than through the designated place", ["إنذار كتابي", "10%", "15%", "25%"]),
    clause("org", 6, "org_6", "الإهمال في تنظيف الآلات وصيانتها، أو عدم العناية بها، أو عدم التبليغ عما بها من خلل", "Neglecting to clean or maintain machines, or failing to report a fault", ["50%", "يوم", "يومان", "ثلاثة أيام"]),
    clause("org", 7, "org_7", "عدم وضع أدوات الإصلاح والصيانة واللوازم الأخرى في الأماكن المخصصة لها، بعد الانتهاء من العمل", "Not returning repair and maintenance tools and supplies to their places after work", ["إنذار كتابي", "25%", "50%", "يوم"]),
    clause("org", 8, "org_8", "تمزيق أو إتلاف إعلانات أو بلاغات إدارة المنشأة", "Tearing or destroying the management's notices or announcements", ESCALATE),
    clause("org", 9, "custody", "الإهمال في العهد التي بحوزته، مثال: (سيارات، آلات، أجهزة، معدات، أدوات… إلخ)", "Neglect of custody items in one's possession (vehicles, machines, devices, equipment, tools…)", ESCALATE),
    clause("org", 10, "org_10", "الأكل في مكان العمل، أو غير المكان المعد له، أو في غير أوقات الراحة", "Eating at the workstation, outside the designated place, or outside break times", ["إنذار كتابي", "10%", "15%", "25%"]),
    clause("org", 11, "org_11", "النوم أثناء العمل", "Sleeping during work", ["إنذار كتابي", "10%", "25%", "50%"]),
    clause("org", 12, "org_12", "النوم في الحالات التي تستدعي يقظة مستمرة", "Sleeping where continuous alertness is required", ["50%", "يوم", "يومان", "ثلاثة أيام"]),
    clause("org", 13, "org_13", "التسكع، أو وجود العامل في غير مكان عمله، أثناء ساعات العمل", "Loitering, or being away from one's place of work during working hours", ["10%", "25%", "50%", "يوم"]),
    clause("org", 14, "org_14", "التلاعب في إثبات الحضور والانصراف", "Tampering with attendance records", ["يوم", "يومان", DEFER_ONCE, AWARD]),
    clause("org", 15, "org_15", "عدم إطاعة الأوامر العادية الخاصة بالعمل، أو عدم تنفيذ التعليمات الخاصة بالعمل والمعلقة في مكان ظاهر", "Disobeying ordinary work orders, or not following posted work instructions", ["25%", "50%", "يوم", "يومان"]),
    clause("org", 16, "org_16", "التحريض على مخالفة الأوامر والتعليمات الخطية الخاصة بالعمل", "Inciting others to disobey written work orders and instructions", ESCALATE),
    clause("org", 17, "smoke", "التدخين في الأماكن المحظورة والمعلن عنها للمحافظة على سلامة العمال والمنشأة", "Smoking in prohibited, posted places kept for the safety of workers and the establishment", ESCALATE),
    clause("org", 18, "org_18", "الإهمال أو التهاون في العمل الذي قد ينشأ عنه ضرر في صحة العمال أو سلامتهم أو في المواد أو الأدوات والأجهزة", "Negligence at work that may harm workers' health or safety, or materials, tools and equipment", ESCALATE),

    clause("conduct", 1, "conduct_1", "التشاجر مع الزملاء أو مع الغير، أو إحداث مشاغبات في مكان العمل", "Quarrelling with colleagues or others, or causing disturbances at the workplace", ["يوم", "يومان", "ثلاثة أيام", "خمسة أيام"]),
    clause("conduct", 2, "conduct_2", "التمارض، أو ادعاء العامل كذباً أنه أصيب أثناء العمل أو بسببه", "Malingering, or falsely claiming an injury at or because of work", ["يوم", "يومان", "ثلاثة أيام", "خمسة أيام"]),
    clause("conduct", 3, "conduct_3", "الامتناع عن إجراء الكشف الطبي عند طلب طبيب المنشأة، أو رفض اتباع التعليمات الطبية أثناء العلاج", "Refusing a medical examination requested by the establishment's doctor, or refusing medical instructions during treatment", ["يوم", "يومان", "ثلاثة أيام", "خمسة أيام"]),
    clause("conduct", 4, "conduct_4", "مخالفة التعليمات الصحية المعلقة بأماكن العمل", "Breaching the health instructions posted at the workplace", ["50%", "يوم", "يومان", "خمسة أيام"]),
    clause("conduct", 5, "conduct_5", "الكتابة على جدران المنشأة، أو لصق إعلانات عليها", "Writing on the establishment's walls or posting notices on them", ["إنذار كتابي", "10%", "25%", "50%"]),
    clause("conduct", 6, "conduct_6", "رفض التفتيش الإداري عند الانصراف", "Refusing the administrative search on leaving", ["25%", "50%", "يوم", "يومان"]),
    clause("conduct", 7, "conduct_7", "عدم تسليم النقود المحصلة لحساب المنشأة في المواعيد المحددة دون تبرير مقبول", "Not handing over money collected for the establishment on time without acceptable justification", ESCALATE),
    clause("conduct", 8, "ppe", "الامتناع عن ارتداء الملابس والأجهزة المقررة للوقاية وللسلامة", "Refusing to wear the prescribed protective and safety clothing and devices", ["إنذار كتابي", "يوم", "يومان", "خمسة أيام"]),
    clause("conduct", 9, "conduct_9", "تعمد الخلوة مع الجنس الآخر في أماكن العمل", "Deliberate seclusion with the other sex at the workplace", ESCALATE),
    clause("conduct", 10, "conduct_10", "الإيحاء للآخرين بما يخدش الحياء قولاً أو فعلاً", "Indecent suggestion to others by word or act", ESCALATE),
    clause("conduct", 11, "conduct_11", "الاعتداء على زملاء العمل بالقول أو الإشارة أو باستعمال وسائل الاتصال الإلكترونية بالشتم أو التحقير", "Verbally abusing or insulting colleagues, by gesture or electronic means", ESCALATE),
    clause("conduct", 12, "conduct_12", "الاعتداء بالإيذاء الجسدي على زملاء العمل، أو على غيرهم بطريقة إباحية", "Physical assault on colleagues, or indecent assault on others", [ART80_NO_AWARD], { art80: "assault" }),
    clause("conduct", 13, "conduct_13", "الاعتداء الجسدي أو القولي أو بأي وسيلة من وسائل الاتصال الإلكترونية على صاحب العمل أو المدير المسؤول أو أحد الرؤساء أثناء العمل أو بسببه", "Physical, verbal or electronic assault on the employer, the responsible manager or a superior at or because of work", [ART80_NO_AWARD], { art80: "assault" }),
    clause("conduct", 14, "conduct_14", "تقديم بلاغ أو شكوى كيدية", "Filing a malicious report or complaint", ["ثلاثة أيام", "خمسة أيام", AWARD]),
    clause("conduct", 15, "conduct_15", "عدم الامتثال لطلب لجنة التحقيق بالحضور", "Not appearing when summoned by the investigation committee", ESCALATE),
    clause("conduct", 16, "conduct_16", "عدم التقيد بالزي الرسمي المعتمد بالمنشأة", "Not complying with the establishment's approved uniform", ["يوم", "يومان", "ثلاثة أيام", "خمسة أيام"]),
  ],
};

const AR_DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_DIGITS[d]).trim();

const WORD_DAYS = [
  [/عشرة\s*أيام|ten days/i, 10],
  [/تسعة\s*أيام|nine days/i, 9],
  [/ثمانية\s*أيام|eight days/i, 8],
  [/سبعة\s*أيام|seven days/i, 7],
  [/ستة\s*أيام|six days/i, 6],
  [/خمسة\s*أيام|five days/i, 5],
  [/أربعة\s*أيام|four days/i, 4],
  [/ثلاثة\s*أيام|three days/i, 3],
  [/يومان|يومين|two days/i, 2],
];

function daysIn(s) {
  for (const [re, n] of WORD_DAYS) if (re.test(s)) return n;
  const n = /(\d+)\s*(?:أيام|يوم|days?)/i.exec(s);
  if (n) return Number(n[1]);
  if (/يوم|one day|a day/i.test(s)) return 1;
  return 0;
}

/**
 * Read one step cell into a listed penalty (Law Art. 66 · model regulation Art. 58):
 *   { ok, kind, days } where kind is one of
 *   warning (إنذار كتابي / لفت نظر) · fine (a % of the daily wage, or N days' wage, ≤ 5) ·
 *   promotion / increment (تأجيل الترقية / الحرمان من العلاوة — `either` when the cell names both) ·
 *   suspend (الإيقاف عن العمل بدون أجر، N days ≤ 5) · dismissal_with_award (الفصل مع المكافأة) ·
 *   dismiss (الفصل بدون مكافأة — Art. 80 cases only; still needs its Art. 80 ground at raising).
 */
export function parseRegulationStep(text) {
  const s = latin(text);
  if (!s || /^[-–—_.\s]+$/.test(s)) return { ok: false, kind: "", days: 0 };
  // A cell that starts with deferral is that penalty, even if it adds a dismissal warning.
  const promotion = /تأجيل\s*الترقية|defer(?:ring)?\s*promotion/i.test(s);
  const increment = /العلاوة|increment/i.test(s);
  if (/^(?:ال)?(?:تأجيل|حرمان|الحرمان)|^(?:defer|withhold)/i.test(s) && (promotion || increment)) {
    if (promotion && increment) return { ok: true, kind: "promotion", days: 0, either: ["promotion", "increment"] };
    return { ok: true, kind: promotion ? "promotion" : "increment", days: 0 };
  }
  if (/(?:^|\s)(?:ال)?فصل|dismiss/i.test(s)) {
    if (/مع\s*(?:ال)?مكافأة|with (?:the )?award/i.test(s)) return { ok: true, kind: "dismissal_with_award", days: 0 };
    return { ok: true, kind: "dismiss", days: 0 };
  }
  if (promotion || increment) {
    if (promotion && increment) return { ok: true, kind: "promotion", days: 0, either: ["promotion", "increment"] };
    return { ok: true, kind: promotion ? "promotion" : "increment", days: 0 };
  }
  if (/إيقاف|suspen/i.test(s)) {
    const d = daysIn(s);
    return d >= 1 && d <= 5 ? { ok: true, kind: "suspend", days: d } : { ok: false, kind: "suspend", days: d, over: d > 5 };
  }
  if (/إنذار|لفت\s*نظر|warning|caution/i.test(s)) return { ok: true, kind: "warning", days: 0 };
  const pct = /^(\d+(?:\.\d+)?)\s*[%٪]|^[%٪]\s*(\d+(?:\.\d+)?)/.exec(s);
  if (pct) {
    const n = Number(pct[1] || pct[2]);
    if (n > 0 && n < 100) return { ok: true, kind: "fine", days: Math.round(n) / 100 };
    if (n === 100) return { ok: true, kind: "fine", days: 1 };
    return { ok: false, kind: "", days: 0 };
  }
  const d = daysIn(s);
  if (d) return d >= 1 && d <= 5 ? { ok: true, kind: "fine", days: d } : { ok: false, kind: "fine", days: d, over: true };
  return { ok: false, kind: "", days: 0 };
}

/** Plain words for a parsed step. */
export function regulationStepLabel(step, ar = true) {
  if (!step?.ok) return ar ? "غير مقروء" : "Unreadable";
  if (step.kind === "warning") return ar ? "إنذار كتابي" : "Written warning";
  if (step.kind === "dismiss") return ar ? "فصل بدون مكافأة في حالات المادة 80" : "Dismissal without award in Article 80 cases";
  if (step.kind === "dismissal_with_award") return ar ? "فصل من العمل مع المكافأة" : "Dismissal with the end-of-service award";
  if (step.kind === "promotion" && step.either) return ar ? "تأجيل الترقية أو الحرمان من العلاوة لمرة واحدة" : "Defer promotion or withhold the increment, once";
  if (step.kind === "promotion") return ar ? "تأجيل الترقية مدة لا تزيد على سنة" : "Defer promotion up to one year";
  if (step.kind === "increment") return ar ? "الحرمان من العلاوة أو تأجيلها مدة لا تزيد على سنة" : "Withhold or defer the increment up to one year";
  if (step.kind === "suspend") return ar ? `إيقاف عن العمل بدون أجر ${step.days === 1 ? "يوماً" : step.days === 2 ? "يومين" : `${step.days} أيام`}` : `Unpaid suspension of ${step.days} day(s)`;
  if (step.days < 1) return ar ? `غرامة ${Math.round(step.days * 100)}% من أجر يوم` : `Fine of ${Math.round(step.days * 100)}% of a day's wage`;
  if (step.days === 1) return ar ? "غرامة أجر يوم" : "Fine of one day's wage";
  if (step.days === 2) return ar ? "غرامة أجر يومين" : "Fine of two days' wage";
  return ar ? `غرامة أجر ${step.days} أيام` : `Fine of ${step.days} days' wage`;
}

/** The regulation in force for the company: its own approved one, else the model as guidance. */
export function regulationOf(data) {
  const own = data?.workRegulation;
  if (own && Array.isArray(own.clauses) && own.clauses.length) return { ...own, source: "own" };
  return MODEL_REGULATION;
}

/** Problems with a draft regulation before it is saved. Empty list → it may be saved. */
export function checkRegulationDraft(draft, ar = true) {
  const errors = [];
  if (!String(draft?.approvalNo || "").trim()) errors.push(ar ? "اكتب رقم اعتماد اللائحة." : "Enter the approval number.");
  if (!dateOnly(draft?.approvedAt)) errors.push(ar ? "اكتب تاريخ الاعتماد." : "Enter the approval date.");
  const clauses = draft?.clauses || [];
  if (!clauses.length) errors.push(ar ? "أضف بنداً واحداً على الأقل." : "Add at least one clause.");
  clauses.forEach((c, i) => {
    const name = String(c.ar || c.en || "").trim();
    if (!name) errors.push(ar ? `البند ${i + 1}: اكتب المخالفة.` : `Clause ${i + 1}: write the offence.`);
    const steps = (c.steps || []).filter((x) => String(x || "").trim());
    if (!steps.length) errors.push(ar ? `البند ${i + 1}: اكتب جزاء المرة الأولى.` : `Clause ${i + 1}: write the first-time penalty.`);
    steps.forEach((x, j) => {
      const p = parseRegulationStep(x);
      if (!p.ok) {
        errors.push(p.over
          ? (ar ? `البند ${i + 1}، المرة ${j + 1}: الغرامة لا تزيد على أجر خمسة أيام (المادة 70).` : `Clause ${i + 1}, time ${j + 1}: a fine may not exceed five days (Art. 70).`)
          : (ar ? `البند ${i + 1}، المرة ${j + 1}: «${x}» لا يُقرأ — اكتب أحد جزاءات المادة 66: إنذار كتابي، أو نسبة مثل 10%، أو أياماً حتى 5، أو إيقاف بدون أجر، أو تأجيل الترقية / الحرمان من العلاوة، أو فصل مع المكافأة، أو فصل بدون مكافأة (المادة 80).` : `Clause ${i + 1}, time ${j + 1}: “${x}” is unreadable.`));
      }
    });
  });
  return errors;
}

function counts(row) {
  const r = String(row?.rulingOutcome || "");
  if (r === "void") return false;
  return Boolean(row?.signedAt || row?.decidedAt);
}

/**
 * Which time this is for the clause (Art. 68): previous signed sanctions under the same clause,
 * chained back while each is within 180 days of the next. Returns the step (1…n) and the priors.
 */
export function regulationRepeat({ cases = [], employeeId, clauseId, today, cooloffDays = 180, excludeId } = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const priors = (cases || [])
    .filter((row) => String(row.employeeId) === String(employeeId) && row.regulationClauseId === clauseId && row.id !== excludeId)
    .filter(counts)
    .map((row) => ({ row, at: dateOnly(row.signedAt || row.decidedAt) }))
    .filter((x) => x.at && x.at <= day)
    .sort((a, b) => b.at.localeCompare(a.at));
  let cursor = day;
  const chain = [];
  for (const p of priors) {
    const gap = daysBetween(p.at, cursor);
    if (gap == null || gap > cooloffDays) break;
    chain.push(p);
    cursor = p.at;
  }
  return { time: chain.length + 1, chain: chain.map((x) => x.row), lastAt: chain[0]?.at || "", lapsed: priors.length > chain.length };
}

/** What the regulation says for this person and clause today. */
export function regulationStepFor({ regulation, clauseId, cases = [], employeeId, today, cooloffDays = 180, excludeId, ar = true } = {}) {
  const clause = (regulation?.clauses || []).find((c) => c.id === clauseId);
  if (!clause) return null;
  const steps = (clause.steps || []).filter((x) => String(x || "").trim());
  const rep = regulationRepeat({ cases, employeeId, clauseId, today, cooloffDays, excludeId });
  const index = Math.min(rep.time, steps.length) - 1;
  const parsed = parseRegulationStep(steps[index]);
  const timeAr = ["الأولى", "الثانية", "الثالثة", "الرابعة"][rep.time - 1] || `رقم ${rep.time}`;
  return {
    clause,
    time: rep.time,
    lastAt: rep.lastAt,
    lastAtLabel: regulationDate(rep.lastAt, ar),
    lapsed: rep.lapsed,
    stepIndex: index,
    stepText: steps[index] || "",
    step: parsed,
    label: regulationStepLabel(parsed, ar),
    timeLabel: ar ? `المرة ${timeAr}` : `Time ${rep.time}`,
    beyond: rep.time > steps.length,
  };
}

/**
 * Model regulation Art. 68: the decision states «الجزاء الذي سوف يتعرض له في حالة تكرار المخالفة».
 * The step for the next time under the clause (the last step again once the ladder is used up — Art. 62).
 */
export function regulationNextStep(regulation, clauseId, time, ar = true) {
  const clause = (regulation?.clauses || []).find((c) => c.id === clauseId);
  if (!clause) return null;
  const steps = (clause.steps || []).filter((x) => String(x || "").trim());
  if (!steps.length) return null;
  const index = Math.min(Math.max(Number(time) || 1, 1), steps.length - 1);
  const parsed = parseRegulationStep(steps[index]);
  return { text: steps[index], step: parsed, label: regulationStepLabel(parsed, ar), last: Number(time) >= steps.length };
}

const RANK = { warning: 0, fine: 10, suspend: 20, increment: 30, promotion: 30, dismissal_with_award: 80, dismiss: 90 };

/** A comparable weight for a listed penalty, so the chosen one can be checked against the clause. */
export function penaltyWeight(kind, days = 0) {
  const base = RANK[kind];
  if (base == null) return null;
  return kind === "fine" || kind === "suspend" ? base + Number(days || 0) : base;
}

/** Compare the chosen penalty to the clause step: "same" | "lighter" | "harsher". */
export function compareToRegulation(kind, days, step) {
  if (!step?.ok) return "";
  if (Array.isArray(step.either) && step.either.includes(kind)) return "same";
  const a = penaltyWeight(kind, days);
  const b = penaltyWeight(step.kind, step.days);
  if (a == null || b == null) return "";
  if (kind === step.kind && Math.abs(Number(days || 0) - Number(step.days || 0)) < 0.001) return "same";
  return a > b ? "harsher" : "lighter";
}

function clauseNumber(regulation, clause) {
  const group = MODEL_GROUPS.find((g) => g.id === clause?.group);
  if (group && Number(clause?.no) > 0) return { group, no: Number(clause.no) };
  return { group: null, no: (regulation?.clauses || []).findIndex((c) => c.id === clause?.id) + 1 };
}

/** The reference written on the case and its paper. */
export function regulationRef(regulation, clause, ar = true) {
  if (!clause) return "";
  const { group, no: n } = clauseNumber(regulation, clause);
  const table = group ? (ar ? ` من جدول «${group.ar}»` : ` of table “${group.en}”`) : "";
  if (regulation?.source === "own") {
    const no = String(regulation.approvalNo || "").trim();
    return ar
      ? `البند ${n}${table} من لائحة تنظيم العمل المعتمدة${no ? ` رقم ${no}` : ""}${regulation.approvedAt ? ` بتاريخ ${regulationDate(regulation.approvedAt, true)}` : ""}`
      : `Clause ${n}${table} of the approved work-organization regulation${no ? ` no. ${no}` : ""}${regulation.approvedAt ? ` dated ${regulationDate(regulation.approvedAt, false)}` : ""}`;
  }
  return ar
    ? `البند ${n}${table} من النموذج الموحد للائحة تنظيم العمل (الملحق 1 باللائحة التنفيذية)`
    : `Clause ${n}${table} of the unified model regulation (Implementing Regulations, Annex 1)`;
}

/* ------------------------- announcement and acknowledgement (Arts. 12–13) ------------------------- */

function addDay(iso, n = 1) {
  const d = dateOnly(iso);
  if (!d) return "";
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Model regulation Art. 72: binding on workers from the day after it is announced. */
export function regulationEffectiveFrom(regulation) {
  return addDay(regulation?.announcedAt, 1);
}

/**
 * Where the regulation stands for the workers today:
 *   model     — no own regulation recorded (the model is guidance)
 *   draft     — recorded but not announced (Law Art. 13(3) / Regs Art. 2(3): announce it in a visible place)
 *   announced — announced; in force from the day after (model Art. 72)
 *   inForce   — in force
 */
export function regulationStanding(regulation, today) {
  if (regulation?.source !== "own") return { id: "model", inForce: false };
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const announced = dateOnly(regulation.announcedAt);
  if (!announced) return { id: "draft", inForce: false, effectiveFrom: "" };
  const from = regulationEffectiveFrom(regulation);
  return from <= day ? { id: "inForce", inForce: true, effectiveFrom: from, announcedAt: announced } : { id: "announced", inForce: false, effectiveFrom: from, announcedAt: announced };
}

/** Publishing (announcing) needs an approved, readable regulation. */
export function checkPublishRegulationGate(regulation, { today, ar = true } = {}) {
  if (regulation?.source !== "own") {
    return { ok: false, error: "REGULATION_NOT_RECORDED", reason: "سجّل لائحة المنشأة المعتمدة أولاً — لا يُعلَن النموذج الاسترشادي (المادة 13).", reasonEn: "Record the approved regulation first — the model is not announced (Art. 13)." };
  }
  const errors = checkRegulationDraft(regulation, ar);
  if (errors.length) return { ok: false, error: "REGULATION_INVALID", reason: errors[0], reasonEn: "The regulation has unreadable or missing entries.", errors };
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  if (dateOnly(regulation.approvedAt) > day) {
    return { ok: false, error: "REGULATION_APPROVAL_FUTURE", reason: "لا تُعلَن اللائحة قبل تاريخ اعتمادها.", reasonEn: "The regulation is not announced before its approval date." };
  }
  return { ok: true, effectiveFrom: addDay(day, 1) };
}

/** A stamp that changes whenever the regulation is re-saved — an acknowledgement is for one version. */
export function regulationVersion(regulation) {
  return String(regulation?.version || regulation?.savedAt || regulation?.approvedAt || "").slice(0, 19);
}

/** Who confirmed reading the announced regulation, and who has not (model Art. 3(3), Art. 53(1/هـ)). */
export function regulationAckStatus(regulation, employees = []) {
  const version = regulationVersion(regulation);
  const acks = regulation?.acks || {};
  const active = (employees || []).filter((e) => e && e.id && !e.archived && !e.terminatedAt && e.status !== "terminated");
  const acked = [];
  const pending = [];
  for (const e of active) {
    const row = acks[e.id];
    if (row && (!version || String(row.version || "") === version)) acked.push({ employee: e, at: row.at });
    else pending.push({ employee: e });
  }
  return { version, acked, pending, total: active.length, share: active.length ? acked.length / active.length : 0 };
}

/** The acknowledgement row to store under `workRegulation.acks[employeeId]`. */
export function planRegulationAck(regulation, employee, now = new Date().toISOString()) {
  if (regulation?.source !== "own" || !dateOnly(regulation.announcedAt)) {
    return { ok: false, error: "REGULATION_NOT_ANNOUNCED", reason: "لم تُعلَن لائحة تنظيم العمل بعد.", reasonEn: "The work regulation has not been announced." };
  }
  if (!employee?.id) return { ok: false, error: "EMPLOYEE_REQUIRED", reason: "الإقرار مربوط بموظف.", reasonEn: "The acknowledgement is tied to an employee." };
  return { ok: true, employeeId: employee.id, ack: { at: now, version: regulationVersion(regulation), name: employee.name || "" } };
}

let seq = 0;
export function newClauseId() {
  seq += 1;
  return `cl_${Date.now().toString(36)}${seq}`;
}
