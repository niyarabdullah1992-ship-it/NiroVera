/** Server twin of src/lib/platformJudgment.js — platform is the judge; ministry monitors. */

export const PLATFORM_FORUM = "platform" as const;
export const MINISTRY_ROLE = "monitor" as const;

export const PLATFORM_JUDGE_TITLE_AR = "حكم المنصة";
export const PLATFORM_JUDGE_TITLE_EN = "Platform judgment";

export const PLATFORM_JUDGE_LEDE_AR = "يحمي العامل والشركة. الوزارة ترى السجل ولا تُشغّل الجدول.";
export const PLATFORM_JUDGE_LEDE_EN = "Protects worker and company. The ministry sees the trail and does not run the roster.";

export const PLATFORM_JUDGE_STANCE_AR =
  "المنصة تحكم داخل الشركة: تحمي العامل وتحمي الشركة معاً. الحكم مختوم ولا يُتجاوز. الوزارة تراقب السجل.";
export const PLATFORM_JUDGE_STANCE_EN =
  "The platform judges inside the company: it protects the worker and the company together. A sealed verdict is not overridden. The ministry inspects the trail.";

export const ARBITRATION_DISCLAIMER_AR =
  "حكم تشغيلي من المنصة على نظام العمل والقرارات المعتمدة. يحمي العامل والشركة، ولا يجوز تجاوزه داخل الشركة. الوزارة تراقب السجل. النزاع الذي يخرج عن الشركة يبقى لهيئة التسوية.";
export const ARBITRATION_DISCLAIMER_EN =
  "An operational verdict from the platform on the Labour Law and adopted decisions. It protects worker and company, and cannot be overridden inside the company. The ministry inspects the trail. A dispute that leaves the company stays with the labour disputes body.";

const STATION_ONLY_GATES = new Set(["morning_cover", "not_empty"]);

export function judgmentProtects({ source, gateId, entitled }: {
  source?: string;
  gateId?: string;
  entitled?: string;
} = {}) {
  const gate = String(gateId || "");
  if (STATION_ONLY_GATES.has(gate)) return { employee: false, company: true };
  if (entitled === "none" && source === "product") return { employee: false, company: true };
  return { employee: true, company: true };
}

export function judgmentProtectsCopy(protects: { employee?: boolean; company?: boolean } | undefined, ar = true) {
  const both = protects?.employee && protects?.company;
  if (both) return ar ? "يحمي العامل والشركة — حكم المنصة" : "Protects worker and company — platform judgment";
  if (protects?.company) return ar ? "يحمي الشركة — حكم المنصة" : "Protects the company — platform judgment";
  if (protects?.employee) return ar ? "يحمي العامل — حكم المنصة" : "Protects the worker — platform judgment";
  return ar ? "حكم المنصة" : "Platform judgment";
}

export function attachPlatformJudgment<T extends Record<string, unknown>>(row: T, extras: {
  ar?: boolean;
  source?: string;
  gateId?: string;
  entitled?: string;
} = {}) {
  const protects = judgmentProtects({
    source: extras.source || (row.source as string | undefined),
    gateId: extras.gateId || (row.gateId as string | undefined),
    entitled: extras.entitled || (row.entitledParty as string | undefined),
  });
  return {
    ...row,
    forum: PLATFORM_FORUM,
    ministryRole: MINISTRY_ROLE,
    overrideAllowed: false as const,
    actor: (row.actor as string | undefined) || "system",
    protects,
    judgment: judgmentProtectsCopy(protects, extras.ar !== false),
  };
}
