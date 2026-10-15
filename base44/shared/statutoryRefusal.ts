// deno-lint-ignore-file no-explicit-any
// Backend copy of src/lib/statutoryRefusal.js — keep the two in step (scripts/test-cloud-parity.mjs).
/**
 * Requests the law makes the worker's right. Management may not refuse them at its discretion
 * ("work pressure", "we can't spare you"). It may refuse only when a condition of the right is not
 * met — and must say which one, after checking. A filing mistake is returned for correction instead.
 *
 *   المادة 117 — «للعامل الذي يثبت مرضه الحق في إجازة مرضية…»: the right rests on proof of illness.
 *   المادة 113 — «للعامل الحق في إجازة بأجر كامل…» for marriage, a birth, a death.
 *   المادة 151 — «للمرأة العاملة الحق في إجازة وضع…».
 *   المادة 160 — عدة المرأة العاملة المتوفى عنها زوجها.
 *   المادة 154 — «يحق للمرأة العاملة… فترة أو فترات للراحة لا تزيد في مجموعها على الساعة في اليوم» لإرضاع مولودها.
 *   المادة 64 — شهادة الخدمة تُعطى عند طلب العامل دون مقابل.
 *
 * Pure module: no imports, safe in node tests.
 */

const PROOF = { key: "no_proof", ar: "لم يُقدَّم ما يثبت الواقعة رغم طلبه", en: "No proof of the event was given, though it was asked for" };
const DATES = { key: "dates_mismatch", ar: "التواريخ المطلوبة لا تطابق المستند", en: "The dates asked do not match the document" };
const SAME_EVENT = { key: "already_taken", ar: "أُخذت الإجازة نفسها عن الواقعة نفسها", en: "The same leave was already taken for the same event" };

export const REFUSAL_GROUNDS = {
  sick: [
    { key: "report_unverifiable", ar: "التقرير الطبي لا يظهر عند التحقق في منصة صحة", en: "The medical report does not show when checked on the Seha platform" },
    { key: "not_accredited", ar: "التقرير ليس من جهة طبية معتمدة", en: "The report is not from an accredited medical provider" },
    DATES,
    { key: "no_report", ar: "لم يُقدَّم تقرير طبي رغم طلبه", en: "No medical report was given, though it was asked for" },
  ],
  marriage: [PROOF, DATES, SAME_EVENT],
  bereavement: [PROOF, DATES, { key: "relation", ar: "صلة القرابة ليست من المنصوص عليها في المادة 113", en: "The relation is not one Article 113 names" }, SAME_EVENT],
  bereavement_sibling: [PROOF, DATES, SAME_EVENT],
  paternity: [PROOF, DATES, SAME_EVENT],
  maternity: [PROOF, DATES, SAME_EVENT],
  maternity_extend: [PROOF, DATES],
  maternity_companion: [{ key: "no_medical", ar: "لا تقرير طبي بمرض المولود أو إعاقته", en: "No medical report of the child's illness or disability" }, DATES],
  iddah: [PROOF, DATES],
  night_avoid: [
    { key: "not_accredited", ar: "الشهادة ليست من مركز صحي حكومي ولا خاص معتمد في قائمة التأمين الطبي", en: "The certificate is not from a government or an approved insured provider" },
    { key: "no_need", ar: "الشهادة لا تبيّن الحاجة لتجنب العمل الليلي", en: "The certificate does not show a need to avoid night work" },
    DATES,
  ],
  nursing_hour: [
    { key: "child_age", ar: "تجاوز عمر الطفل المدة المقررة للرضاعة", en: "The child is past the nursing period" },
    { key: "over_hour", ar: "المطلوب يتجاوز ساعة في اليوم", en: "The request exceeds one hour a day" },
    { key: "no_birth_record", ar: "لا يوجد ما يثبت الولادة على الملف", en: "No proof of the birth on file" },
  ],
};

/** Requests that are never refused — only acknowledged, or returned to fix a mistake. */
export const NEVER_REFUSED = {
  pregnancy_notice: {
    ar: "إبلاغ الحمل يُستلم ولا يُرفض — يُثبت حماية الحامل (ومنها عدم تشغيلها ليلاً). إن كان فيه خطأ فأعده للتعديل.",
    en: "A pregnancy notice is received, never refused — it records the pregnant worker's protections. If it has a mistake, return it for a change.",
  },
  contract_copy: {
    ar: "المادة 51: لكل طرف نسخة من عقد العمل، ولكل منهما أن يطلب كتابته في أي وقت — لا يُرفض.",
    en: "Article 51: each party keeps a copy of the contract and may ask for it in writing at any time — not refused.",
  },
  documents_return: {
    ar: "المادة 64: يعيد صاحب العمل إلى العامل جميع ما أودعه لديه من شهادات أو وثائق — لا يُرفض.",
    en: "Article 64: the employer returns every certificate or document the worker deposited — not refused.",
  },
  art81_exit: {
    ar: "المادة 81: ترك العمل في حالاتها حق للعامل لا يتوقف على قبولك — يُستلم البلاغ، والخلاف إن وقع أمام المحكمة العمالية.",
    en: "Article 81: leaving in its cases is the worker's right, not subject to your acceptance — acknowledge it; any dispute goes to the labour court.",
  },
  service_certificate: {
    ar: "المادة 64: شهادة الخدمة حق للعامل عند طلبه ودون مقابل — لا تُرفض. إن نقصت بياناتها فأعدها للتعديل.",
    en: "Article 64: a service certificate is the worker's right on request and free of charge — it is not refused. If details are missing, return it for a change.",
  },
};

export function refusalKind(row: any) {
  const type = String(row?.type || "").toLowerCase();
  if (row?.family === "leave") return type;
  if (type === "document" && row?.docKind === "exp") return "service_certificate";
  if (type === "document" && row?.docKind === "contract") return "contract_copy";
  return type;
}

/** null = ordinary request (free reasoned refusal); [] = never refused; list = refusal only on these grounds. */
export function refusalGroundsFor(row: any) {
  const kind = refusalKind(row);
  if (NEVER_REFUSED[kind]) return [];
  return REFUSAL_GROUNDS[kind] || null;
}

export function groundLabel(row: any, key: any, ar = true) {
  const hit = (refusalGroundsFor(row) || []).find((g) => g.key === key);
  return hit ? (ar ? hit.ar : hit.en) : "";
}

/**
 * Gate for a manager refusing. `ground` must be one of the kind's grounds and `verified` true
 * (the manager says he checked). Employees withdrawing their own request are never stopped here.
 */
export function checkGroundedRefusalGate(row: any, { ground, verified, actor }: any = {}) {
  if (actor === "employee") return { ok: true };
  const kind = refusalKind(row);
  const never = NEVER_REFUSED[kind];
  if (never) {
    return { ok: false, error: "NOT_REFUSABLE", reason: `موقوف — ${never.ar}`, reasonEn: `Blocked — ${never.en}` };
  }
  const grounds = REFUSAL_GROUNDS[kind];
  if (!grounds) return { ok: true, free: true };
  const hit = grounds.find((g) => g.key === ground);
  if (!hit) {
    return {
      ok: false,
      error: "REFUSAL_GROUND_REQUIRED",
      reason: "هذه الإجازة حق نظامي — لا تُرفض لظروف العمل. ارفضها فقط إن لم يثبت شرطها: اختر السبب. وإن كان الخطأ في التعبئة فأعدها للتعديل.",
      reasonEn: "This is a statutory right — it is not refused for work reasons. Refuse only if its condition is not met: pick the ground. If it is a filing mistake, return it for a change.",
      grounds,
    };
  }
  if (verified !== true) {
    return {
      ok: false,
      error: "REFUSAL_VERIFY_REQUIRED",
      reason: "أقرّ بأنك تحققت من السبب قبل الرفض — يصل للموظف مع حقه في رفع ما يثبت.",
      reasonEn: "Confirm you checked the ground before refusing — it reaches the worker with the right to send proof.",
      grounds,
    };
  }
  return { ok: true, ground: hit };
}

/** Text that goes on the request and to the worker. */
export function refusalText(row: any, ground: any, note: any, ar = true) {
  const label = groundLabel(row, ground, ar);
  const extra = String(note || "").trim();
  if (!label) return extra;
  return extra ? `${label} — ${extra}` : label;
}

/** What the worker reads with a grounded refusal. */
export function refusalWorkerLine(row: any, ar = true) {
  const kind = refusalKind(row);
  if (kind === "sick") {
    return ar
      ? "يمكنك رفع تقرير صحيح من منصة صحة بطلب جديد. الأيام التي لم تحضر فيها دون إجازة معتمدة تُعامل وفق لائحة تنظيم العمل؛ والأيام التي حضرت فيها تبقى حضوراً."
      : "You may file a new request with a valid Seha report. Days you were away without approved leave follow the work regulation; days you attended stay attendance.";
  }
  return ar
    ? "يمكنك رفع الطلب من جديد مع ما يثبت الواقعة."
    : "You may file again with proof of the event.";
}

/** Art. 64(1): what a service certificate must state. */
export const SERVICE_CERT_AR = "المادة 64: تُعطى شهادة الخدمة عند طلب العامل دون مقابل، ويبين فيها تاريخ التحاقه بالعمل وتاريخ انتهائه، ومهنته، ومقدار أجره الأخير — ولا يُذكر فيها ما يسيء إلى سمعته أو يقلل فرص العمل أمامه.";
export const SERVICE_CERT_EN = "Article 64: a service certificate is given on the worker's request, free of charge, stating his start date, end date, profession and last wage — and nothing that harms his reputation or narrows his job chances.";
