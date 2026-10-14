/** Decision 18632 — who each night right applies to.
 *  performer = any minute in 23:00–06:00.
 *  worker = three hours or more in that window.
 */

export function nightRightScopeLabel(scope, ar = true) {
  if (scope === "worker") return ar ? "عامل ليلي فقط" : "Night worker only";
  if (scope === "performer") return ar ? "يؤدي عملاً ليلياً" : "Performs night work";
  return ar ? "يؤدي عملاً ليلياً والعامل الليلي" : "Performs night work and night worker";
}

export function nightRightApplies(scope, who) {
  if (scope === "both") return true;
  if (scope === "worker") return who === "worker";
  if (scope === "performer") return who === "performer" || who === "worker";
  return false;
}

/** Table rows — same order as the 18632 explainer. `inRequests` = yellow items in طلباتي. */
export const NIGHT_WORK_RIGHTS = [
  {
    id: "rest",
    gateId: "night_rest",
    scope: "both",
    inRequests: false,
    letter: "ر",
    ar: "راحة 12 ساعة بين يومي عمل",
    en: "12-hour rest between work days",
    performer: true,
    worker: true,
    hintAr: "إن دخل أحد اليومين نافذة الليل",
    hintEn: "If either work day enters the night window",
    whereAr: "بوابة الجدول عند الإسناد",
    whereEn: "Roster gate on assignment",
  },
  {
    id: "performer_comp",
    gateId: "night_performer_comp",
    scope: "both",
    inRequests: true,
    letter: "ت",
    ar: "تعويض ساعات أو أجر أو بدل أو نقل",
    en: "Compensate in hours, pay, allowance, or transport",
    performer: true,
    worker: true,
    hintAr: "لكل من يدخل النافذة ولو أقل من ثلاث ساعات",
    hintEn: "Anyone in the window, even under three hours",
    whereAr: "إعداد الليل في الجدول — قرار المنشأة",
    whereEn: "Night settings on the roster — establishment choice",
    request: false,
  },
  {
    id: "pregnancy",
    gateId: "night_pregnancy",
    scope: "both",
    inRequests: true,
    letter: "ح",
    ar: "حظر الحمل 24 أسبوعاً قبل الوضع",
    en: "Pregnancy night ban 24 weeks before birth",
    performer: true,
    worker: true,
    hintAr: "مع عمل مناسب في الساعات المعتادة",
    hintEn: "With suitable ordinary-hours work",
    whereAr: "ملف الموظف — تاريخ الوضع المتوقع",
    whereEn: "Employee file — expected birth date",
    request: false,
  },
  {
    id: "xor",
    gateId: "night_compensate",
    scope: "worker",
    inRequests: true,
    letter: "ب",
    ar: "بدل مناسب أو تخفيض ساعات مع حفظ الأجر",
    en: "Suitable allowance or reduced hours with pay preserved",
    performer: false,
    worker: true,
    performerNoteAr: "لا — إلا إن صار عامل ليلي",
    performerNoteEn: "No — unless they become a night worker",
    hintAr: "إلا الليلي العرضي ورمضان",
    hintEn: "Except incidental night and Ramadan",
    whereAr: "إعداد الليل في الجدول — تقليص أو بدل",
    whereEn: "Night settings on the roster — reduce or allowance",
    request: false,
  },
  {
    id: "rotate",
    gateId: "night_rotate",
    scope: "worker",
    inRequests: true,
    letter: "د",
    ar: "تدوير بعد 3 أشهر أو موافقة خطية",
    en: "Rotate after 3 months or written consent",
    performer: false,
    worker: true,
    performerNoteAr: "لا",
    performerNoteEn: "No",
    hintAr: "موافقة محفوظة مع حق التراجع — لا تجديد شهري",
    hintEn: "Consent on file with withdraw right — no monthly renewal",
    whereAr: "يُفتح تلقائياً في طلباتي بعد ثلاثة أشهر كعامل ليلي",
    whereEn: "Opens automatically in My Requests after three months as a night worker",
    request: "consent",
  },
  {
    id: "medical",
    gateId: "night_medical",
    scope: "worker",
    inRequests: true,
    letter: "ل",
    ar: "تقرير لياقة طبية",
    en: "Medical fitness report",
    performer: false,
    worker: true,
    performerNoteAr: "لا",
    performerNoteEn: "No",
    hintAr: "قبل الإسناد وسنوياً وعند ظهور مشكلة — للملف",
    hintEn: "Before assignment, yearly, and when health issues appear — on the file",
    whereAr: "يُرفع من طلباتي — لياقة ليلية",
    whereEn: "Raised from My Requests — night fitness",
    request: "fitness",
  },
];

export function nightWorkRequestRights() {
  return NIGHT_WORK_RIGHTS.filter((row) => row.inRequests);
}

export function nightWorkRightById(id) {
  return NIGHT_WORK_RIGHTS.find((row) => row.id === id) || null;
}

export function nightWorkRightByGate(gateId) {
  return NIGHT_WORK_RIGHTS.find((row) => row.gateId === gateId) || null;
}
