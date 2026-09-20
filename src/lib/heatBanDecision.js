/** Ministerial decision 3337 of 15/07/1435 AH — banning work under the sun.
 *  Not a Labour Law article. The decision was issued on articles 122 and 243 of the
 *  Labour Law (royal decree M/51 of 23/08/1426 AH), it amends paragraph (أولاً) of
 *  ministerial decision 1/1559 of 22/06/1431 AH, and it counts as part of it.
 *  It is a standing decision, not an annual one — the ministry re-announces it every season.
 *  `DECISION_3337_TEXT_AR` is the decision's own wording: change it only when a new
 *  decision issues, and keep the figures in `laborRules` in step with it.
 */

import { heatBanWindow } from "./contractLawDerivations.js";

/** The signed scan, shipped with the app so the decision is readable, not just quoted. */
export const HEAT_BAN_DECISION_PDF = "/heat-ban-decision-3337.pdf";

export const HEAT_BAN_DECISION = {
  id: "3337",
  hijriDate: "1435-07-15",
  amends: { id: "1/1559", hijriDate: "1431-06-22" },
  basisArticles: ["122", "243"],
  citeArticle: "122",
};

/** Verbatim paragraph (أولاً) as the decision rewrote it. */
export const DECISION_3337_TEXT_AR = "لا يجوز تشغيل العامل في الأعمال المكشوفة تحت أشعة الشمس من الساعة الثانية عشر ظهراً إلى الساعة الثالثة مساءً خلال الفترة الواقعة بين اليوم الخامس والعشرين من برج الجوزاء الموافق الخامس عشر من شهر يونية، إلى نهاية اليوم الرابع والعشرين من برج السنبلة الموافق الخامس عشر من شهر سبتمبر من كل عام ميلادي.";

export const DECISION_3337_TEXT_EN = "A worker may not be employed in works exposed to the sun from twelve noon until three in the afternoon, during the period from the twenty-fifth day of Gemini — corresponding to the fifteenth of June — to the end of the twenty-fourth day of Virgo, corresponding to the fifteenth of September, of every Gregorian year.";

export function heatBanDecisionLabel(ar = true) {
  return ar
    ? `قرار وزاري رقم ${HEAT_BAN_DECISION.id} وتاريخ 15/7/1435هـ`
    : `Ministerial decision ${HEAT_BAN_DECISION.id} of 15/07/1435 AH`;
}

export function heatBanDecisionTitle(ar = true) {
  return ar
    ? `نص القرار الوزاري رقم ${HEAT_BAN_DECISION.id} — حظر العمل تحت أشعة الشمس`
    : `Ministerial decision ${HEAT_BAN_DECISION.id} — work under the sun`;
}

/** The decision's own words, then how the platform reads them into a clock and a season. */
export function heatBanDecisionGist(ar = true, onDate) {
  const win = heatBanWindow(onDate);
  return ar
    ? `«${DECISION_3337_TEXT_AR}»\n\nما تقرأه المنصة من هذا النص: منع الإنجاز الميداني المكشوف من ${win.startLabel} إلى ${win.endLabel} ${win.seasonAr}. العمل داخل المنشأة أو في مكان مظلّل خارج الحظر، ويُنقل العمل المكشوف إلى ما قبل ${win.startLabel} أو ما بعد ${win.endLabel}.`
    : `“${DECISION_3337_TEXT_EN}”\n\nWhat the platform reads from it: exposed field completion is blocked from ${win.startLabel} to ${win.endLabel} ${win.seasonEn}. Indoor or shaded work is outside the ban, and exposed work moves to before ${win.startLabel} or after ${win.endLabel}.`;
}

/** Where the decision came from, and the employer duty that rides with it. */
export function heatBanDecisionDutiesNote(ar = true) {
  const { id, amends } = HEAT_BAN_DECISION;
  return ar
    ? `صدر القرار ${id} على المادتين 122 و243 من نظام العمل، ويعدّل الفقرة (أولاً) من القرار الوزاري رقم ${amends.id} وتاريخ 22/6/1431هـ ويُعدّ جزءاً لا يتجزأ منه. والمادة 122 تلزم صاحب العمل باتخاذ احتياطات الحماية دون أن يحمّل العامل أو يقتطع من أجره شيئاً مقابلها.`
    : `Decision ${id} was issued on articles 122 and 243 of the Labour Law; it amends paragraph (أولاً) of ministerial decision ${amends.id} of 22/06/1431 AH and counts as part of it. Article 122 obliges the employer to take the protective precautions without charging the worker or deducting from his wage for them.`;
}

export function isHeatBanRuleId(id) {
  return String(id || "").startsWith("hours.heat.");
}
