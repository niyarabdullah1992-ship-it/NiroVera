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

/** The ministry's model schedule (guidance — the approved regulation governs). */
export const MODEL_REGULATION = {
  source: "model",
  approvalNo: "",
  approvedAt: "",
  clauses: [
    { id: "late15", ar: "التأخر حتى 15 دقيقة دون إذن", en: "Late by up to 15 minutes without leave", steps: ["إنذار كتابي", "5%", "10%", "20%"] },
    { id: "late30", ar: "التأخر من 15 إلى 30 دقيقة", en: "Late by 15 to 30 minutes", steps: ["10%", "15%", "25%", "50%"] },
    { id: "early", ar: "الانصراف قبل الموعد دون إذن", en: "Leaving before the end without leave", steps: ["إنذار كتابي", "10%", "15%", "يوم"] },
    { id: "absent1", ar: "الغياب يوماً دون عذر", en: "One day absent without excuse", steps: ["يومان", "3 أيام", "4 أيام", "فصل"] },
    { id: "ppe", ar: "عدم ارتداء معدات السلامة", en: "Not wearing safety gear", steps: ["10%", "25%", "يوم", "يومان"] },
    { id: "smoke", ar: "التدخين في مكان محظور", en: "Smoking in a prohibited place", steps: ["إنذار كتابي", "10%", "25%", "يوم"] },
    { id: "custody", ar: "إهمال العهدة أو الأدوات", en: "Neglect of custody or tools", steps: ["إنذار كتابي", "25%", "يوم", "يومان"] },
  ],
};

const AR_DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_DIGITS[d]).trim();

/**
 * Read one step cell into a listed penalty: { kind: "warning"|"fine"|"dismiss", days, ok }.
 * Percent → a fine of that share of a day's wage; "يوم/يومان/N أيام" → a fine of N days (≤ 5);
 * "فصل" → dismissal (still needs an Art. 80 ground at raising).
 */
export function parseRegulationStep(text) {
  const s = latin(text);
  if (!s) return { ok: false, kind: "", days: 0 };
  if (/إنذار|warning/i.test(s)) return { ok: true, kind: "warning", days: 0 };
  if (/فصل|dismiss/i.test(s)) return { ok: true, kind: "dismiss", days: 0 };
  const pct = /^(\d+(?:\.\d+)?)\s*[%٪]/.exec(s);
  if (pct) {
    const n = Number(pct[1]);
    if (n > 0 && n < 100) return { ok: true, kind: "fine", days: Math.round(n) / 100 };
    if (n === 100) return { ok: true, kind: "fine", days: 1 };
    return { ok: false, kind: "", days: 0 };
  }
  if (/يومان|يومين|two days/i.test(s)) return { ok: true, kind: "fine", days: 2 };
  const n = /(\d+)/.exec(s);
  if (n && /أيام|يوم|day/i.test(s)) {
    const d = Number(n[1]);
    return d >= 1 && d <= 5 ? { ok: true, kind: "fine", days: d } : { ok: false, kind: "fine", days: d, over: true };
  }
  if (/^يوم$|^one day$/i.test(s)) return { ok: true, kind: "fine", days: 1 };
  return { ok: false, kind: "", days: 0 };
}

/** Plain words for a parsed step. */
export function regulationStepLabel(step, ar = true) {
  if (!step?.ok) return ar ? "غير مقروء" : "Unreadable";
  if (step.kind === "warning") return ar ? "إنذار كتابي" : "Written warning";
  if (step.kind === "dismiss") return ar ? "فصل في الحالات المقررة" : "Dismissal in the prescribed cases";
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
          : (ar ? `البند ${i + 1}، المرة ${j + 1}: «${x}» لا يُقرأ — اكتب إنذار كتابي، أو نسبة مثل 10%، أو أياماً حتى 5، أو فصل.` : `Clause ${i + 1}, time ${j + 1}: “${x}” is unreadable.`));
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

const RANK = { warning: 0, increment: 30, promotion: 30, fine: 10, suspend: 20, dismiss: 90 };

/** A comparable weight for a listed penalty, so the chosen one can be checked against the clause. */
export function penaltyWeight(kind, days = 0) {
  const base = RANK[kind];
  if (base == null) return null;
  return kind === "fine" || kind === "suspend" ? base + Number(days || 0) : base;
}

/** Compare the chosen penalty to the clause step: "same" | "lighter" | "harsher". */
export function compareToRegulation(kind, days, step) {
  if (!step?.ok) return "";
  const a = penaltyWeight(kind, days);
  const b = penaltyWeight(step.kind, step.days);
  if (a == null || b == null) return "";
  if (kind === step.kind && Math.abs(Number(days || 0) - Number(step.days || 0)) < 0.001) return "same";
  return a > b ? "harsher" : "lighter";
}

/** The reference written on the case and its paper. */
export function regulationRef(regulation, clause, ar = true) {
  if (!clause) return "";
  const n = (regulation?.clauses || []).findIndex((c) => c.id === clause.id) + 1;
  if (regulation?.source === "own") {
    const no = String(regulation.approvalNo || "").trim();
    return ar
      ? `البند ${n} من لائحة تنظيم العمل المعتمدة${no ? ` رقم ${no}` : ""}${regulation.approvedAt ? ` بتاريخ ${regulationDate(regulation.approvedAt, true)}` : ""}`
      : `Clause ${n} of the approved work-organization regulation${no ? ` no. ${no}` : ""}${regulation.approvedAt ? ` dated ${regulationDate(regulation.approvedAt, false)}` : ""}`;
  }
  return ar ? `البند ${n} من النموذج الاسترشادي للوزارة` : `Clause ${n} of the ministry's model schedule`;
}

let seq = 0;
export function newClauseId() {
  seq += 1;
  return `cl_${Date.now().toString(36)}${seq}`;
}
