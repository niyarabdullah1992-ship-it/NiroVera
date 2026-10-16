/**
 * The annual performance report — unified model regulation (Annex 1, decision 115921):
 *   م18 — a report at least once a year for every worker, covering (1) ability and competence,
 *          (2) conduct and cooperation with superiors, colleagues and clients, (3) attendance;
 *   م19 — rated on the company's grades, on a five-level scale;
 *   م20 — prepared by the direct manager, approved by the authority, a copy given to the worker
 *          as soon as it is approved, and he may grieve it under the grievance rules (م71: within
 *          30 days, holidays aside, of being told; a written answer within 15);
 *   م21–23 — the increment needs at least «average» a year on, promotion at least «above average»
 *          on the last report (with a vacant higher post, its qualifications and the authority's
 *          approval), ties settled in the order of Art. 23.
 *
 * The platform's review cycle is the report: a rating recorded in manager review / calibration is
 * the manager's report, and closing the cycle is the approval — that is when the copy reaches the
 * worker in «أدائي». Pure; server twin base44/shared/perfReport.ts.
 */
import { daysAfterExcludingHolidays } from "./rightsRequests.js";

/** Model Art. 19 — the five levels. The cut-offs are the company's grades on the 0–100 derived score. */
export const PERF_LEVELS = [
  { level: 5, key: "excellent", ar: "ممتاز", en: "Excellent", min: 90 },
  { level: 4, key: "above", ar: "فوق المتوسط", en: "Above average", min: 75 },
  { level: 3, key: "average", ar: "متوسط", en: "Average", min: 60 },
  { level: 2, key: "below", ar: "دون المتوسط", en: "Below average", min: 45 },
  { level: 1, key: "weak", ar: "ضعيف", en: "Weak", min: 0 },
];

/** Model Art. 18 — what the report covers; each element carries its own level. */
export const PERF_ELEMENTS = [
  { key: "competence", ar: "المقدرة على العمل ودرجة إتقانه (الكفاءة)", en: "Ability and competence" },
  { key: "conduct", ar: "السلوك والتعاون مع الرؤساء والزملاء والعملاء", en: "Conduct and cooperation" },
  { key: "attendance", ar: "المواظبة", en: "Attendance" },
];

export const PERF_GRIEVANCE_DAYS = 30;
export const PERF_GRIEVANCE_REPLY_DAYS = 15;

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};
const fail = (error, reason, reasonEn, extra = {}) => ({ ok: false, error, reason, reasonEn, ...extra });

export function perfLevelOf(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  return PERF_LEVELS.find((row) => n >= row.min) || PERF_LEVELS[PERF_LEVELS.length - 1];
}

export function perfLevelByNumber(level) {
  return PERF_LEVELS.find((row) => row.level === Number(level)) || null;
}

/** Model Art. 18: the three elements, each on the five-level scale, before a rating is recorded. */
export function checkReportElementsGate(elements = {}) {
  const missing = PERF_ELEMENTS.filter((row) => !perfLevelByNumber(elements?.[row.key]));
  if (missing.length) {
    return fail("REPORT_ELEMENTS_REQUIRED",
      `التقرير يتضمن الكفاءة والسلوك والمواظبة بمستوى من خمسة لكلٍّ منها — ناقص: ${missing.map((row) => row.ar).join("، ")} (النموذج الموحد م18–19).`,
      "The report rates competence, conduct and attendance on the five-level scale (model Arts. 18–19).",
      { missing: missing.map((row) => row.key) });
  }
  return { ok: true, elements: Object.fromEntries(PERF_ELEMENTS.map((row) => [row.key, Number(elements[row.key])])) };
}

/**
 * The worker's copies: one per closed (approved) cycle in which he was rated.
 * → [{ cycleId, period, from, to, rating, level, elements, ratedByName, approvedAt, grievance, grievanceBy }]
 */
export function perfReportsFor({ cycles = [], ratings = [], employeeId, isHoliday } = {}) {
  const id = String(employeeId || "");
  const out = [];
  for (const cycle of cycles || []) {
    if (String(cycle?.status) !== "closed") continue;
    const rating = (ratings || []).find((row) => row?.cycleId === cycle.id && String(row.employeeId) === id);
    if (!rating) continue;
    const approvedAt = dateOnly(cycle.closedAt) || dateOnly(cycle.to);
    out.push({
      ratingId: rating.id,
      cycleId: cycle.id,
      period: cycle.period,
      from: cycle.from,
      to: cycle.to,
      rating: rating.rating,
      level: perfLevelOf(rating.rating),
      elements: rating.elements || null,
      justification: rating.justification || null,
      ratedByName: rating.ratedByName || "",
      approvedAt,
      grievanceBy: approvedAt ? daysAfterExcludingHolidays(approvedAt, PERF_GRIEVANCE_DAYS, isHoliday) : "",
      grievance: rating.grievance || null,
    });
  }
  return out.sort((a, b) => String(b.approvedAt).localeCompare(String(a.approvedAt)));
}

/** Model Arts. 20 and 71: the worker grieves his approved report within 30 days (holidays aside). */
export function checkPerfGrievanceGate({ report, reason, today, isHoliday } = {}) {
  if (!report) return fail("REPORT_NOT_FOUND", "لا تقرير معتمد بهذا الرقم.", "No approved report found.");
  if (report.grievance) return fail("REPORT_GRIEVANCE_EXISTS", "تظلمتَ من هذا التقرير من قبل — تابع التظلم القائم.", "You already grieved this report.");
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const last = report.grievanceBy || daysAfterExcludingHolidays(report.approvedAt, PERF_GRIEVANCE_DAYS, isHoliday);
  if (last && day > last) {
    return fail("REPORT_GRIEVANCE_LATE",
      `مضت ثلاثون يوماً — عدا العطل الرسمية — على إبلاغك بالتقرير (آخر يوم ${last}) (النموذج الموحد م20 · م71).`,
      `Thirty days, holidays aside, have passed since the report reached you (last day ${last}) (model Arts. 20 · 71).`, { last });
  }
  if (String(reason || "").trim().length < 15) {
    return fail("REPORT_GRIEVANCE_REASON", "اكتب تظلمك: أي عنصر في التقرير تراه غير صحيح، ولماذا.", "Write which part of the report you contest and why.");
  }
  return { ok: true, replyBy: daysAfterExcludingHolidays(day, PERF_GRIEVANCE_REPLY_DAYS, isHoliday) };
}

/** HR decides in writing; nobody decides his own grievance. An upheld grievance may set a new rating. */
export function checkDecidePerfGrievanceGate({ grievance, decision, note, actorId, employeeId, newRating } = {}) {
  if (!grievance || grievance.decision) return fail("GRIEVANCE_NOT_OPEN", "لا تظلم مفتوح على هذا التقرير.", "No open grievance on this report.");
  if (actorId && String(actorId) === String(employeeId)) return fail("GRIEVANCE_SELF", "لا يبتّ أحد في تظلمه.", "Nobody decides his own grievance.");
  if (!["upheld", "refused"].includes(decision)) return fail("GRIEVANCE_DECISION_REQUIRED", "اختر: قبول التظلم أو رفضه.", "Uphold or refuse.");
  if (String(note || "").trim().length < 15) return fail("GRIEVANCE_NOTE_REQUIRED", "اكتب نتيجة البتّ وسببها — تُبلَّغ للعامل كتابةً (النموذج الموحد م71).", "Write the decision and its reason (model Art. 71).");
  if (decision === "upheld" && newRating !== undefined && newRating !== null && newRating !== "") {
    const n = Number(newRating);
    if (!Number.isFinite(n) || n < 0 || n > 100) return fail("GRIEVANCE_RATING_INVALID", "الدرجة المعدّلة بين 0 و100.", "The revised rating is between 0 and 100.");
    return { ok: true, newRating: Math.round(n) };
  }
  return { ok: true, newRating: null };
}

/** Where the worker's grievance stands: pending (with the reply date), overdue, upheld or refused. */
export function perfGrievanceState(grievance, today) {
  if (!grievance) return null;
  if (grievance.decision) return { stage: grievance.decision, replyBy: grievance.replyBy };
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  return { stage: grievance.replyBy && day > grievance.replyBy ? "overdue" : "pending", replyBy: grievance.replyBy };
}

/**
 * Model Arts. 21–23 for reference: what the last approved report allows — never an automatic raise.
 * hireDate / lastIncrementAt are read from the file when present.
 */
export function advancementReading({ reports = [], hireDate, lastIncrementAt, today } = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const last = reports[0] || null;
  const level = last?.level?.level || 0;
  const since = dateOnly(lastIncrementAt) || dateOnly(hireDate);
  const yearOn = since ? Date.parse(`${day}T00:00:00Z`) - Date.parse(`${since}T00:00:00Z`) >= 365 * 86400000 : false;
  return {
    last,
    increment: { eligible: Boolean(last) && level >= 3 && yearOn, levelOk: level >= 3, yearOn, since },
    promotion: { levelOk: level >= 4 },
  };
}

const info = (ar) => (ar ? "للعلم" : "For reference");

export const PERF_MINISTRY_CARDS = (ar = true) => [
  {
    key: "model",
    badge: ar ? "النموذج الموحد" : "Model reg.",
    title: ar ? "النموذج الموحد — تقرير الأداء والعلاوة والترقية" : "Model regulation — the report, increments, promotion",
    scope: ar ? "تقرير سنوي بعناصره (م18)، خمسة مستويات (م19)، صورة للعامل والتظلم (م20)، العلاوة (م21)، الترقية والمفاضلة (م22–23)." : "Annual report and its elements (18), five levels (19), the worker's copy and grievance (20), increments (21), promotion and ties (22–23).",
  },
];

/** «أنظمة الوزارة — ما يخص أدائي» — read from the worker's approved reports. */
export function perfMinistryRows({ reports = [], hireDate, lastIncrementAt, today, ar = true, notes = {} } = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const last = reports[0] || null;
  const yearAgo = new Date(Date.parse(`${day}T00:00:00Z`) - 365 * 86400000).toISOString().slice(0, 10);
  const recent = last && last.approvedAt >= yearAgo;
  const open = reports.find((r) => r.grievance && !r.grievance.decision) || null;
  const adv = advancementReading({ reports, hireDate, lastIncrementAt, today: day });
  const rows = [
    {
      key: "model-18",
      source: "model",
      badge: ar ? "النموذج الموحد م18–19" : "Model Arts. 18–19",
      title: ar ? "تقرير أداء مرة في السنة على الأقل — الكفاءة والسلوك والمواظبة بخمسة مستويات" : "A report at least yearly — competence, conduct, attendance on five levels",
      note: notes.report || "",
      ...(recent
        ? { status: "settled", pill: ar ? `${last.period} · ${last.level?.ar || "—"}` : `${last.period} · ${last.level?.en || "—"}` }
        : last
          ? { status: "waiting", pill: ar ? `آخر تقرير ${last.approvedAt}` : `Last report ${last.approvedAt}` }
          : { status: "void", pill: ar ? "لا تقرير معتمد بعد" : "No approved report yet" }),
    },
    {
      key: "model-20",
      source: "model",
      badge: ar ? "النموذج الموحد م20" : "Model Art. 20",
      title: ar ? "صورة التقرير لك فور اعتماده، ولك التظلم منه خلال 30 يوماً" : "Your copy on approval; grieve within 30 days",
      ...(open
        ? { status: "waiting", pill: ar ? `تظلم بانتظار البتّ حتى ${open.grievance.replyBy || "—"}` : `Grievance awaiting a decision by ${open.grievance.replyBy || "—"}` }
        : last && day <= last.grievanceBy && !last.grievance
          ? { status: "waiting", pill: ar ? `لك التظلم حتى ${last.grievanceBy}` : `You may grieve until ${last.grievanceBy}` }
          : last
            ? { status: "settled", pill: ar ? "النسخة لديك" : "Copy received" }
            : { status: "void", pill: info(ar) }),
    },
    {
      key: "model-21",
      source: "model",
      badge: ar ? "النموذج الموحد م21" : "Model Art. 21",
      title: ar ? "العلاوة السنوية: «متوسط» على الأقل بعد سنة من الالتحاق أو العلاوة السابقة" : "Annual increment: at least «average», a year on",
      note: notes.advancement || "",
      sub: last ? (ar ? `آخر تقدير: ${last.level?.ar || "—"}${adv.increment.since ? ` · منذ ${adv.increment.since}` : ""}` : `Last: ${last.level?.en || "—"}`) : undefined,
      status: "void",
      pill: adv.increment.eligible ? (ar ? "مؤهل — للعلم" : "Eligible — reference") : info(ar),
    },
    {
      key: "model-22",
      source: "model",
      badge: ar ? "النموذج الموحد م22–23" : "Model Arts. 22–23",
      title: ar ? "الترقية: وظيفة أعلى شاغرة، ومؤهلاتها، و«فوق المتوسط» على الأقل في آخر تقرير، وموافقة صاحب الصلاحية" : "Promotion: a vacant higher post, its qualifications, at least «above average», the authority's approval",
      status: "void",
      pill: adv.promotion.levelOk ? (ar ? "التقدير يكفي — للعلم" : "Rating suffices — reference") : info(ar),
    },
  ];
  return rows;
}
