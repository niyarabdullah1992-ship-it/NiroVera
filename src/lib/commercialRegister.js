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

import { isCompanyRootStation, isHrUnit, isManagerUnit } from "./stationTree.js";

export const CR_NUMBER_RE = /^\d{10}$/;
/** م11: تأكيد سنوي للبيانات · م15: يُعلَّق القيد إن لم يُقدَّم خلال 90 يومًا من استحقاقه، ومعه كل التراخيص. */
export const CR_ANNUAL_WARN_DAYS = 30;
export const CR_SUSPEND_AFTER_DAYS = 90;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function dayDiff(fromKey, toKey) {
  const a = Date.UTC(+fromKey.slice(0, 4), +fromKey.slice(5, 7) - 1, +fromKey.slice(8, 10));
  const b = Date.UTC(+toKey.slice(0, 4), +toKey.slice(5, 7) - 1, +toKey.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/** Places where trade is done (م16 asks the register data on show in each): the head office and every branch workplace. */
export function registerDisplayPlaces(stations = []) {
  return (stations || []).filter((s) => s && !isHrUnit(s) && (isCompanyRootStation(s) || !isManagerUnit(s)));
}

/**
 * بوابة موعد التأكيد السنوي (م11). فارغ = إزالة الموعد.
 * @returns {{ok:true, value:string} | {ok:false, error:string, reason:string, reasonEn:string}}
 */
export function checkRegisterAnnualDueGate(value) {
  const next = String(value ?? "").trim();
  if (!next) return { ok: true, value: "" };
  if (!DATE_RE.test(next) || Number.isNaN(Date.parse(next))) {
    return { ok: false, error: "CR_DUE_DATE", reason: "اكتب موعد التأكيد السنوي تاريخًا صحيحًا.", reasonEn: "Enter the annual confirmation due date as a valid date." };
  }
  return { ok: true, value: next };
}

/** Where the annual confirmation stands today. */
export function deriveRegisterAnnualStatus(data, today) {
  const due = String(data?.commercialRegister?.annualConfirmDue || "");
  if (!DATE_RE.test(due) || !DATE_RE.test(String(today || ""))) return { state: "unset", due: "", days: null };
  const days = dayDiff(today, due); // >0 ahead, <0 overdue
  if (days < -CR_SUSPEND_AFTER_DAYS) return { state: "suspendable", due, days };
  if (days < 0) return { state: "overdue", due, days };
  if (days <= CR_ANNUAL_WARN_DAYS) return { state: "soon", due, days };
  return { state: "ok", due, days };
}

/**
 * Register alerts for the ministry watch surface — named reasons, articles cited, nothing invented.
 * @returns {Array<{ id, gate, level, count, to, ruleId, textAr, textEn, actionAr, actionEn }>}
 */
export function deriveRegisterAlerts(data, today) {
  const alerts = [];
  const annual = deriveRegisterAnnualStatus(data, today);
  const base = { to: "/app/hr", ruleId: null, actionAr: "السجل التجاري", actionEn: "Commercial register" };
  if (annual.state === "unset") {
    alerts.push({ ...base, id: "cr_annual_unset", gate: "CR_ANNUAL_UNSET", level: "warn", count: 1,
      textAr: "موعد التأكيد السنوي للسجل التجاري غير مسجَّل (نظام السجل التجاري م11).",
      textEn: "The commercial register's annual confirmation date is not recorded (Commercial Register Law art. 11)." });
  } else if (annual.state === "soon") {
    alerts.push({ ...base, id: "cr_annual_soon", gate: "CR_ANNUAL_DUE", level: "warn", count: 1,
      textAr: `التأكيد السنوي للسجل التجاري خلال ${annual.days} يومًا (${annual.due}) — م11.`,
      textEn: `Commercial register annual confirmation due in ${annual.days} day(s) (${annual.due}) — art. 11.` });
  } else if (annual.state === "overdue") {
    alerts.push({ ...base, id: "cr_annual_overdue", gate: "CR_ANNUAL_OVERDUE", level: "critical", count: 1,
      textAr: `فات التأكيد السنوي للسجل التجاري منذ ${-annual.days} يومًا؛ بعد ${CR_SUSPEND_AFTER_DAYS} يومًا يُعلَّق القيد ومعه كل التراخيص (م15).`,
      textEn: `Commercial register annual confirmation is ${-annual.days} day(s) late; after ${CR_SUSPEND_AFTER_DAYS} days the register is suspended with all licences (art. 15).` });
  } else if (annual.state === "suspendable") {
    alerts.push({ ...base, id: "cr_annual_suspendable", gate: "CR_SUSPENDABLE", level: "critical", count: 1,
      textAr: `مضى أكثر من ${CR_SUSPEND_AFTER_DAYS} يومًا على موعد التأكيد السنوي: السجل التجاري معرَّض للتعليق مع كل التراخيص (م15).`,
      textEn: `More than ${CR_SUSPEND_AFTER_DAYS} days past the annual confirmation: the register is liable to suspension with all licences (art. 15).` });
  }
  const unchecked = registerDisplayPlaces(data?.stations || []).filter((s) => !DATE_RE.test(String(s.crDisplayCheckedAt || "")));
  if (unchecked.length) {
    alerts.push({ ...base, id: "cr_display_unchecked", gate: "CR_DISPLAY_UNCHECKED", level: "warn", count: unchecked.length,
      textAr: `${unchecked.length} موقعًا لم يُتحقَّق فيه من عرض بيانات السجل التجاري في مكان واضح (م16).`,
      textEn: `${unchecked.length} place(s) not checked for showing the commercial register data in plain view (art. 16).` });
  }
  return alerts;
}
