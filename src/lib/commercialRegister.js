/**
 * السجل التجاري والفروع — وفق نظام السجل التجاري السعودي الجديد.
 *
 * المصدر: نظام السجل التجاري — مرسوم ملكي م/83 وتاريخ 1446/3/19هـ (نُشر 1446/4/1هـ، ونفاذه بعد 180 يومًا).
 * البند (ثالثًا) من المرسوم: مهلة خمس سنوات من نفاذ النظام لتصحيح أوضاع السجلات الفرعية، وتُشطب جميعها
 * بانتهائها وفق آلية وزارة التجارة. م9: قيد أنشطة مختلفة دون اشتراط التجانس. م16: عرض بيانات القيد في المتجر.
 * فالمنشأة بسجل واحد، ورقم السجل الفرعي القائم يُحفظ على الفرع للتوثيق فقط، والفرع تابع للسجل الرئيسي في كل حساب.
 *
 * والتوطين (نطاقات) يُحسب في قوى على مستوى الكيان — المنشأة بفروعها — لا لكل فرع وحده؛
 * فنسبة الفرع في المنصة قراءة للاطلاع، والنطاق الرسمي للمنشأة كلها في قوى.
 *
 * لا يُخزَّن هنا رقم مشتق: الدوال تقرأ السجل وتعيد نصًّا أو قرارًا مسمّى السبب.
 */

export const CR_NUMBER_RE = /^\d{10}$/;

/** Arabic-Indic and Persian digits → ASCII, spaces and dashes dropped. */
export function normalizeCrNumber(value) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\s\-–—_.]/g, "")
    .trim();
}

/** The company's single register number when the blob carries it (the settings record is the source). */
export function companyCrNumber(data) {
  return normalizeCrNumber(
    data?.settings?.crNumber || data?.settings?.commercialRegistration || data?.crNumber || data?.commercialRegistration || "",
  );
}

/**
 * بوابة رقم السجل الفرعي القائم على فرع.
 * فارغ = إزالة الرقم (الفرع تحت السجل الرئيسي وحده، وهو الوضع النظامي).
 * @returns {{ok:true, value:string} | {ok:false, error:string, reason:string, reasonEn:string}}
 */
export function checkBranchLegacyCrGate({ value, stationId, stations = [], companyCr = "" } = {}) {
  const next = normalizeCrNumber(value);
  if (!next) return { ok: true, value: "" };
  if (!CR_NUMBER_RE.test(next)) {
    return {
      ok: false,
      error: "CR_FORMAT",
      reason: "رقم السجل التجاري عشرة أرقام.",
      reasonEn: "A commercial registration number is ten digits.",
    };
  }
  if (companyCr && next === normalizeCrNumber(companyCr)) {
    return {
      ok: false,
      error: "CR_IS_MAIN",
      reason: "هذا رقم السجل الرئيسي للمنشأة؛ الفرع يتبعه دون إدخال رقم.",
      reasonEn: "That is the company's main register; the branch already falls under it.",
    };
  }
  const taken = (stations || []).find(
    (item) => String(item?.id) !== String(stationId) && normalizeCrNumber(item?.legacySubCr) === next,
  );
  if (taken) {
    return {
      ok: false,
      error: "CR_DUP",
      reason: `هذا السجل الفرعي مسجّل على «${taken.name || "فرع آخر"}».`,
      reasonEn: `That sub-register is already on “${taken.name || "another branch"}”.`,
    };
  }
  return { ok: true, value: next };
}

/** One line telling where the branch stands under the register law. */
export function branchRegisterLine(station, { isRoot = false, companyCr = "", ar = true } = {}) {
  const main = normalizeCrNumber(companyCr);
  if (isRoot) {
    return ar
      ? `سجل تجاري واحد للمنشأة وكل فروعها${main ? ` (${main})` : ""}، ورقمه يُدار في «إعدادات المنشأة».`
      : `One commercial register for the company and all its branches${main ? ` (${main})` : ""}, managed in Company settings.`;
  }
  const legacy = normalizeCrNumber(station?.legacySubCr);
  if (legacy) {
    return ar
      ? `يتبع السجل الرئيسي${main ? ` ${main}` : ""}. له سجل فرعي قائم (${legacy}) في مهلة التصحيح، ويُشطب بانتهائها.`
      : `Falls under the main register${main ? ` ${main}` : ""}. Carries a pre-existing sub-register (${legacy}) in its correction period; it is struck off when the period ends.`;
  }
  return ar
    ? `يتبع السجل الرئيسي للمنشأة${main ? ` ${main}` : ""}؛ لا يحتاج سجلًا خاصًّا به.`
    : `Falls under the company's main register${main ? ` ${main}` : ""}; it needs no register of its own.`;
}
