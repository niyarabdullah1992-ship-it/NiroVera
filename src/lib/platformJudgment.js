/** The platform is the judge inside the company.
 *  Labour Law and ministerial decisions are the source of the verdict.
 *  The ministry inspects the sealed trail; it does not run the roster.
 *  A dispute that leaves the company stays with the labour disputes body.
 */

export const PLATFORM_FORUM = "platform";
export const MINISTRY_ROLE = "monitor";

export const PLATFORM_JUDGE_TITLE_AR = "حكم المنصة";
export const PLATFORM_JUDGE_TITLE_EN = "Platform judgment";

export const PLATFORM_JUDGE_LEDE_AR = "يحمي العامل والشركة. الوزارة ترى السجل ولا تُشغّل الجدول.";
export const PLATFORM_JUDGE_LEDE_EN = "Protects worker and company. The ministry sees the trail and does not run the roster.";

export const PLATFORM_JUDGE_STANCE_AR =
  "المنصة تحكم داخل الشركة: تحمي العامل وتحمي الشركة معاً. الحكم مختوم ولا يُتجاوز. الوزارة تراقب السجل.";
export const PLATFORM_JUDGE_STANCE_EN =
  "The platform judges inside the company: it protects the worker and the company together. A sealed verdict is not overridden. The ministry inspects the trail.";

export const PLATFORM_RAIL_EMPTY_AR =
  "لا حكم مستحق. لا مخالفة ساعات أو راحة، ولا واجب حماية غير ملبّى هذا الأسبوع.";
export const PLATFORM_RAIL_EMPTY_EN =
  "No judgment due. No hours or rest breach, and no unmet protection duty this week.";

export const ARBITRATION_DISCLAIMER_AR =
  "حكم تشغيلي من المنصة على نظام العمل والقرارات المعتمدة. يحمي العامل والشركة، ولا يجوز تجاوزه داخل الشركة. الوزارة تراقب السجل. النزاع الذي يخرج عن الشركة يبقى لهيئة التسوية.";
export const ARBITRATION_DISCLAIMER_EN =
  "An operational verdict from the platform on the Labour Law and adopted decisions. It protects worker and company, and cannot be overridden inside the company. The ministry inspects the trail. A dispute that leaves the company stays with the labour disputes body.";

export const REQUESTS_LAW_TITLE_AR = "حكم المنصة على طلبك";
export const REQUESTS_LAW_TITLE_EN = "Platform judgment on your request";

export const REQUESTS_LAW_LEDE_AR = "مواد نظام العمل مصدر الحكم. المنصة تقرّر القبول أو الوقف داخل الشركة، والوزارة تراقب السجل.";
export const REQUESTS_LAW_LEDE_EN = "Labour Law articles are the source of the verdict. The platform decides accept or hold inside the company, and the ministry inspects the trail.";

export const REQUESTS_LAW_FOOT_AR =
  "شارة المادة تظهر فقط إن كان المصدر نظام العمل السعودي أو قراراً وزارياً. ما عداه قرار تشغيلي داخل الشركة.";
export const REQUESTS_LAW_FOOT_EN =
  "An article chip appears only when the source is the Saudi Labour Law or a ministerial decision. Anything else is an operational decision inside the company.";

const STATION_ONLY_GATES = new Set(["not_empty"]);

/** Who a named gate protects. Labour / ministerial / hours rest → both. Station coverage → company. */
export function judgmentProtects({ source, gateId, entitled } = {}) {
  const gate = String(gateId || "");
  if (STATION_ONLY_GATES.has(gate)) return { employee: false, company: true };
  if (entitled === "none" && source === "product") return { employee: false, company: true };
  return { employee: true, company: true };
}

export function judgmentProtectsCopy(protects, ar = true) {
  const both = protects?.employee && protects?.company;
  if (both) return ar ? "يحمي العامل والشركة — حكم المنصة" : "Protects worker and company — platform judgment";
  if (protects?.company) return ar ? "يحمي الشركة — حكم المنصة" : "Protects the company — platform judgment";
  if (protects?.employee) return ar ? "يحمي العامل — حكم المنصة" : "Protects the worker — platform judgment";
  return ar ? "حكم المنصة" : "Platform judgment";
}

export function attachPlatformJudgment(row, { ar = true, source, gateId, entitled } = {}) {
  const protects = judgmentProtects({
    source: source || row?.source,
    gateId: gateId || row?.gateId,
    entitled: entitled || row?.entitledParty,
  });
  return {
    ...row,
    forum: PLATFORM_FORUM,
    ministryRole: MINISTRY_ROLE,
    overrideAllowed: false,
    actor: row?.actor || "system",
    protects,
    judgment: judgmentProtectsCopy(protects, ar),
  };
}
