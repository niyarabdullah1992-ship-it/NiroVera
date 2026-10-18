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

/* ─────────── the report's elements from evidence (م18) — one scale from task to report ─────────── */

/**
 * المواظبة ← the duty record of the period (lib/dutyDay: absence = a past published shift with no
 * punch, no approved leave, not a holiday; lateness from the published shift start, approved
 * استئذان aside). Each level holds both ceilings — the worse of the two decides:
 *   5 ممتاز          no absence      · late on ≤ 2% of scheduled days
 *   4 فوق المتوسط    absence ≤ 1%    · late ≤ 5%
 *   3 متوسط          absence ≤ 3%    · late ≤ 10%
 *   2 دون المتوسط    absence ≤ 6%    · late ≤ 20%
 *   1 ضعيف           beyond those
 * A company mapping, documented here and shown with the figures; the manager may change the level
 * with a written reason.
 */
export const ATTENDANCE_LEVEL_MAP = [
  { level: 5, absentPctMax: 0, latePctMax: 2 },
  { level: 4, absentPctMax: 1, latePctMax: 5 },
  { level: 3, absentPctMax: 3, latePctMax: 10 },
  { level: 2, absentPctMax: 6, latePctMax: 20 },
  { level: 1, absentPctMax: 100, latePctMax: 100 },
];

const pct1 = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/** { scheduled, attended, absent, lateDays } of the period → { level, absentPct, latePct, adherencePct } or null. */
export function attendanceLevelOf(totals = {}) {
  const scheduled = Math.max(0, Number(totals?.scheduled) || 0);
  if (!scheduled) return null;
  const absent = Math.max(0, Number(totals.absent) || 0);
  const lateDays = Math.max(0, Number(totals.lateDays) || 0);
  const attended = Math.max(0, Number(totals.attended) || 0);
  const absentPct = pct1(absent, scheduled);
  const latePct = pct1(lateDays, scheduled);
  const row = ATTENDANCE_LEVEL_MAP.find((r) => absentPct <= r.absentPctMax && latePct <= r.latePctMax) || ATTENDANCE_LEVEL_MAP[ATTENDANCE_LEVEL_MAP.length - 1];
  return { level: row.level, scheduled, attended, absent, lateDays, absentPct, latePct, adherencePct: pct1(attended, scheduled) };
}

/**
 * The report pre-filled from the period's evidence:
 *   competence ← the mean task quality level (taskQualitySummary) rounded · basis n tasks
 *   attendance ← attendanceLevelOf(duty totals)
 *   conduct    ← no level: the manager's judgment; signed sanctions and proven complaints shown beside it
 */
export function reportPrefill({ quality, attendance, conduct } = {}) {
  const n = Math.max(0, Number(quality?.n) || 0);
  const avg = n ? Number(quality.avg) : null;
  const att = attendanceLevelOf(attendance || {});
  return {
    competence: { level: n && Number.isFinite(avg) ? Math.min(5, Math.max(1, Math.round(avg))) : null, basis: { n, avg, legacy: Math.max(0, Number(quality?.legacy) || 0) } },
    attendance: { level: att ? att.level : null, basis: att || { scheduled: 0 } },
    conduct: { level: null, basis: { sanctions: Math.max(0, Number(conduct?.sanctions) || 0), complaints: Math.max(0, Number(conduct?.complaints) || 0) } },
  };
}

export const REPORT_CHANGE_REASON_MIN = 10;
export const REPORT_GAP_REASON_MIN = 15;

/**
 * The manager confirms or changes each pre-filled element — a change carries its reason; and when the
 * overall level (from the 0–100 rating) sits two levels or more from the elements' mean, he justifies it.
 */
export function checkReportEvidenceGate({ elements = {}, prefill, reasons = {}, rating } = {}) {
  const base = checkReportElementsGate(elements);
  if (!base.ok) return base;
  const changed = {};
  for (const el of PERF_ELEMENTS) {
    const from = prefill?.[el.key]?.level ?? null;
    if (from == null || from === base.elements[el.key]) continue;
    const why = String(reasons?.[el.key] || "").trim();
    if (why.length < REPORT_CHANGE_REASON_MIN) {
      const a = perfLevelByNumber(from);
      const b = perfLevelByNumber(base.elements[el.key]);
      return fail("REPORT_ELEMENT_REASON_REQUIRED",
        `غيّرتَ «${el.ar}» عن المستوى المشتق من الأدلة (${a?.ar} ← ${b?.ar}) — اكتب السبب (النموذج الموحد م18).`,
        `You changed «${el.en}» from the evidence level (${a?.en} → ${b?.en}) — write why (model Art. 18).`,
        { element: el.key });
    }
    changed[el.key] = { from, to: base.elements[el.key], reason: why };
  }
  const values = PERF_ELEMENTS.map((el) => base.elements[el.key]);
  const elementAvg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  const overall = perfLevelOf(rating);
  const gap = overall ? Math.abs(overall.level - elementAvg) : 0;
  const overallWhy = String(reasons?.overall || "").trim();
  if (overall && gap >= 2 && overallWhy.length < REPORT_GAP_REASON_MIN) {
    return fail("REPORT_OVERALL_GAP_REASON",
      `التقدير العام «${overall.ar}» يبعد ${gap} مستوى عن متوسط العناصر (${elementAvg}) — اكتب ما يبرّر الفرق (النموذج الموحد م19).`,
      `The overall «${overall.en}» is ${gap} levels from the elements' mean (${elementAvg}) — justify the gap (model Art. 19).`,
      { gap, elementAvg });
  }
  return {
    ok: true,
    elements: base.elements,
    elementAvg,
    overallLevel: overall?.level ?? null,
    evidence: prefill || null,
    elementReasons: { ...changed, ...(gap >= 2 ? { overall: { gap, elementAvg, reason: overallWhy } } : {}) },
  };
}

/** The copy's source line per element: «من 34 مهمة معتمدة بمتوسط 4.2» … and the manager's change. */
export function reportElementSource(report, key, ar = true) {
  const ev = report?.evidence?.[key] || null;
  const given = Number(report?.elements?.[key]) || null;
  const change = report?.elementReasons?.[key] || null;
  let line = "";
  if (key === "competence") {
    const n = Number(ev?.basis?.n) || 0;
    line = n
      ? (ar ? `من ${n === 1 ? "مهمة معتمدة واحدة" : n === 2 ? "مهمتين معتمدتين" : n <= 10 ? `${n} مهام معتمدة` : `${n} مهمة معتمدة`} بمتوسط ${ev.basis.avg}` : `From ${n} approved task${n === 1 ? "" : "s"}, mean ${ev.basis.avg}`)
      : (ar ? "لا مهام بمستوى جودة في الفترة — تقدير المدير" : "No task with a quality level in the period — the manager's judgment");
  } else if (key === "attendance") {
    const b = ev?.basis || {};
    line = Number(b.scheduled)
      ? (ar ? `من ${b.scheduled} يوم دوام مجدول: حضر ${b.attended}، غياب ${b.absent}، تأخر ${b.lateDays}` : `From ${b.scheduled} scheduled days: attended ${b.attended}, absent ${b.absent}, late ${b.lateDays}`)
      : (ar ? "لا دوام مجدول مسجّل في الفترة — تقدير المدير" : "No scheduled duty recorded in the period — the manager's judgment");
  } else if (key === "conduct") {
    const b = ev?.basis || {};
    line = ar
      ? `تقدير المدير · للعلم: جزاءات موقّعة ${Number(b.sanctions) || 0}، شكاوى ثبتت ${Number(b.complaints) || 0}`
      : `The manager's judgment · for reference: signed sanctions ${Number(b.sanctions) || 0}, proven complaints ${Number(b.complaints) || 0}`;
  }
  if (!ev) line = ar ? "تقرير قبل ربط العناصر بالأدلة" : "A report from before elements were tied to evidence";
  if (change && given) {
    const a = perfLevelByNumber(change.from);
    const b = perfLevelByNumber(change.to);
    line += ar ? ` · عدّله المدير من «${a?.ar}» إلى «${b?.ar}»: ${change.reason}` : ` · changed by the manager from ${a?.en} to ${b?.en}: ${change.reason}`;
  }
  return line;
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
      evidence: rating.evidence || null,
      elementReasons: rating.elementReasons || null,
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
export function perfMinistryRows({ reports = [], hireDate, lastIncrementAt, today, ar = true, notes = {}, quality = null, objections = [] } = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const last = reports[0] || null;
  const yearAgo = new Date(Date.parse(`${day}T00:00:00Z`) - 365 * 86400000).toISOString().slice(0, 10);
  const recent = last && last.approvedAt >= yearAgo;
  const open = reports.find((r) => r.grievance && !r.grievance.decision) || null;
  const adv = advancementReading({ reports, hireDate, lastIncrementAt, today: day });
  const changed = last?.elementReasons ? PERF_ELEMENTS.filter((el) => last.elementReasons[el.key]).length : 0;
  const openObjections = (objections || []).filter((o) => o && !o.decision);
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
      key: "model-18-evidence",
      source: "model",
      badge: ar ? "النموذج الموحد م18" : "Model Art. 18",
      title: ar ? "عناصر التقرير من الأدلة: الكفاءة من مستويات مهامك، والمواظبة من سجل دوامك، والسلوك تقدير مديرك" : "Elements from evidence: competence from your task levels, attendance from your duty record, conduct by your manager",
      ...(!last
        ? { status: "void", pill: info(ar) }
        : !last.evidence
          ? { status: "void", pill: ar ? "تقرير قبل ربط العناصر بالأدلة" : "Report predates evidence-based elements" }
          : {
            status: "settled",
            pill: changed
              ? (ar ? `من الأدلة · عدّل المدير ${changed === 1 ? "عنصراً واحداً" : `${changed} عناصر`} بسبب مكتوب` : `From evidence · ${changed} changed with a written reason`)
              : (ar ? "من الأدلة كما اشتُقّت" : "From evidence as derived"),
            sub: PERF_ELEMENTS.map((el) => `${ar ? el.ar : el.en}: ${reportElementSource(last, el.key, ar)}`).join(" — "),
          }),
    },
    {
      key: "model-19-tasks",
      source: "model",
      badge: ar ? "النموذج الموحد م19" : "Model Art. 19",
      title: ar ? "مستوى جودة كل مهمة معتمدة على المقياس نفسه من خمسة مستويات" : "Each approved task rated on the same five-level scale",
      ...(quality?.n
        ? { status: "settled", pill: ar ? `متوسط ${quality.avg} من ${quality.n} ${quality.n <= 10 && quality.n >= 3 ? "مهام" : "مهمة"}` : `Mean ${quality.avg} over ${quality.n} tasks` }
        : { status: "void", pill: ar ? "لا مهام بمستوى بعد" : "No task level yet" }),
    },
    {
      key: "model-71-task",
      source: "model",
      badge: ar ? "سياسة المنصة · مبدأ م71" : "Platform policy · Art. 71 principle",
      title: ar ? "الاعتراض على مستوى مهمة خلال خمسة أيام عمل من اعتماده — يبتّ فيه رئيس المعتمِد أو الموارد البشرية كتابةً" : "Object to a task's level within five working days — the approver's superior or HR decides in writing",
      ...(openObjections.length
        ? { status: "waiting", pill: ar ? `${openObjections.length} اعتراض بانتظار البتّ` : `${openObjections.length} objection(s) awaiting a decision` }
        : { status: "void", pill: info(ar) }),
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
