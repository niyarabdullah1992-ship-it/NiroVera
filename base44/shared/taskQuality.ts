// deno-lint-ignore-file no-explicit-any
// Backend copy of src/lib/taskQuality.js — keep the two in step.
/**
 * Task quality level — the first link of one five-level scale that runs task → periodic performance →
 * annual report (unified model regulation, Annex 1 of decision 115921: م18 the report's elements,
 * م19 the five-level scale, م20 the worker's copy and his grievance, م71 the grievance rules).
 *
 *   Approval picks a level 1–5 (the PERF_LEVELS labels). Levels 1, 2 and 5 carry a one-line reason.
 *   Points = taskPoints × the level's weight {5:100%, 4:90%, 3:75%, 2:50%, 1:25%}, rounded, never 0.
 *   Who receives points does not change: every assignee still gets the task's points. On a task with
 *   several assignees the approver may set one person's level apart from the task level — each
 *   override with its reason — so that person's points follow his own level.
 *   A task approved before this existed has no level («بلا مستوى»): its points stand as granted and
 *   it is left out of every quality average.
 *
 * The employee may object to his level within five working days (platform policy, drawn from the
 * grievance principle of النموذج الموحد م71 — not a statutory period). The approver's superior in the
 * task's escalation chain, or HR, decides in writing; the approver never decides on his own rating.
 *
 * Pure. Server twin: base44/shared/taskQuality.ts (scripts/test-task-quality.mjs keeps them equal).
 */
import { PERF_LEVELS, perfLevelByNumber } from "./perfReport.ts";
import { daysAfterExcludingHolidays } from "./rightsRequests.ts";
import { nextOpsEscalation, taskPoints } from "./opsDerivations.ts";

export const TASK_QUALITY_WEIGHTS = { 5: 100, 4: 90, 3: 75, 2: 50, 1: 25 };
/** The levels whose choice must be explained — the two low ones and «ممتاز». */
export const QUALITY_REASON_LEVELS = [1, 2, 5];
export const QUALITY_REASON_MIN = 8;
/** Platform policy (not law): object to a task's level within five working days of its approval. */
export const QUALITY_OBJECTION_WORKING_DAYS = 5;
export const QUALITY_OBJECTION_REASON_MIN = 15;
/** The decision follows the model's grievance clock: a written answer within 15 days (م71/1). */
export const QUALITY_DECISION_DAYS = 15;
export const QUALITY_DECISION_NOTE_MIN = 15;
export const QUALITY_DECIDER_ROLES = ["owner", "admin", "hr_manager"];

const fail = (error: any, reason: any, reasonEn: any, extra: any = {}): any => ({ ok: false, error, reason, reasonEn, ...extra });
const text = (v: any): any => String(v ?? "").trim();
const dateOnly = (v: any): any => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

/** 1–5 → the PERF_LEVELS row (the same labels the annual report uses), else null. */
export function qualityLevel(level: any) {
  const n = Number(level);
  return Number.isInteger(n) ? perfLevelByNumber(n) : null;
}

export function qualityWeight(level: any) {
  return qualityLevel(level) ? TASK_QUALITY_WEIGHTS[Number(level)] : null;
}

/** The points a level earns on a task worth `base`: rounded, and approved work never earns zero. */
export function qualityPoints(base: any, level: any) {
  const b = Math.max(0, Number(base) || 0);
  const w = qualityWeight(level);
  if (!b || w == null) return b;
  return Math.max(1, Math.round((b * w) / 100));
}

export function qualityReasonRequired(level: any) {
  return QUALITY_REASON_LEVELS.includes(Number(level));
}

/**
 * Who receives a task's points — unchanged by quality levels and identical to the server's
 * awardPoints: the owner («one»), the named members («some»), or the station crew («all»).
 */
export function taskRecipientIds(task: any, employees: any = [], idOf: any = (e) => e?.employeeId || e?.id) {
  if (task?.assignMode === "one" && task.ownerId) return [String(task.ownerId)];
  if (task?.assignMode === "some") return [...new Set((task.memberIds || []).map(String).filter(Boolean))];
  const crew = (employees || []).filter((e) => !task?.stationId || String(e.stationId || e.station_id || "") === String(task.stationId));
  const ids = crew.map((e) => String(idOf(e) || "")).filter(Boolean);
  return [...new Set(ids)];
}

/**
 * The approval gate: a level, its reason where required, and per-assignee overrides (several
 * assignees only, each a real assignee, each with its reason). An override equal to the task level
 * is dropped — it is the default.
 */
export function checkTaskQualityGate({ level, reason, overrides = {}, assigneeIds = [] }: any = {}) {
  const row = qualityLevel(level);
  if (!row) {
    return fail("QUALITY_LEVEL_REQUIRED",
      "اختر مستوى جودة الإنجاز من خمسة قبل الاعتماد (النموذج الموحد م19).",
      "Pick the quality level (1–5) before approving (model Art. 19).");
  }
  const why = text(reason);
  if (qualityReasonRequired(row.level) && why.length < QUALITY_REASON_MIN) {
    return fail("QUALITY_REASON_REQUIRED",
      `مستوى «${row.ar}» يحتاج سبباً في سطر — يقرؤه الموظف مع المستوى.`,
      `«${row.en}» needs a one-line reason — the employee reads it with the level.`,
      { level: row.level });
  }
  const ids = [...new Set((assigneeIds || []).map(String).filter(Boolean))];
  const out: any = {};
  for (const [rawId, value] of Object.entries(overrides || {})) {
    const id = String(rawId);
    const lv = value && typeof value === "object" ? value.level : value;
    if (lv === undefined || lv === null || lv === "") continue;
    if (ids.length < 2) {
      return fail("QUALITY_OVERRIDE_SINGLE",
        "المستوى الفردي لكل منفّذ متاح حين يكون للمهمة أكثر من منفّذ.",
        "A per-person level applies only when the task has several assignees.");
    }
    if (!ids.includes(id)) {
      return fail("QUALITY_OVERRIDE_NOT_ASSIGNEE",
        "المستوى الفردي لمنفّذ ليس على المهمة.", "That person is not an assignee of the task.", { employeeId: id });
    }
    const own = qualityLevel(lv);
    if (!own) return fail("QUALITY_LEVEL_REQUIRED", "مستوى المنفّذ من 1 إلى 5.", "A person's level is 1–5.", { employeeId: id });
    if (own.level === row.level) continue;
    const ownWhy = text(value?.reason);
    if (ownWhy.length < QUALITY_REASON_MIN) {
      return fail("QUALITY_OVERRIDE_REASON_REQUIRED",
        "اكتب سبب اختلاف مستوى هذا المنفّذ عن مستوى المهمة.",
        "Write why this person's level differs from the task's.", { employeeId: id });
    }
    out[id] = { level: own.level, weight: TASK_QUALITY_WEIGHTS[own.level], reason: ownWhy };
  }
  return { ok: true, level: row.level, weight: TASK_QUALITY_WEIGHTS[row.level], reason: why, overrides: out };
}

/** Writes the level onto the task: level, weight, reason, approver, time, and each person's override. */
export function applyTaskQuality(task: any, gate: any, { basePoints, byId, byName, at, reviewLevel, recipientIds = [] }: any = {}) {
  const base = Number.isFinite(Number(basePoints)) ? Number(basePoints) : taskPoints(task?.priority, task?.effortWeight);
  const when = at || new Date().toISOString();
  const overrides: any = {};
  for (const [id, o] of Object.entries(gate?.overrides || {})) {
    overrides[id] = { ...o, points: qualityPoints(base, o.level), by: byId || null, at: when };
  }
  const points = qualityPoints(base, gate.level);
  return {
    ...task,
    pointsAwarded: points,
    quality: {
      level: gate.level,
      weight: gate.weight,
      reason: gate.reason || "",
      basePoints: base,
      points,
      by: byId || null,
      byName: byName || "",
      at: when,
      reviewLevel: Math.max(0, Number(reviewLevel ?? task?.escalationLevel) || 0),
      recipientIds: [...new Set((recipientIds || []).map(String).filter(Boolean))],
      overrides,
    },
  };
}

/** One person's level on a task: his override, else the task level; null for a legacy approval. */
export function taskQualityFor(task: any, employeeId: any) {
  const q = task?.quality;
  const row = q ? qualityLevel(q.level) : null;
  if (!row) return null;
  const own = employeeId != null ? q.overrides?.[String(employeeId)] : null;
  const level = own ? qualityLevel(own.level) : row;
  if (!level) return null;
  return {
    level: level.level,
    label: level,
    weight: TASK_QUALITY_WEIGHTS[level.level],
    reason: own ? own.reason : (q.reason || ""),
    points: own ? Number(own.points) : Number(q.points),
    override: Boolean(own),
    source: own?.source || "approval",
    by: q.by,
    byName: q.byName || "",
    at: q.at,
  };
}

/** The points one person holds for a proven task — his level's points, or the legacy grant. */
export function taskPointsFor(task: any, employeeId: any) {
  const q = taskQualityFor(task, employeeId);
  if (q && Number.isFinite(q.points) && q.points > 0) return q.points;
  const stored = Number(task?.pointsAwarded);
  return Number.isFinite(stored) && stored > 0 ? stored : taskPoints(task?.priority, task?.effortWeight);
}

/**
 * The period's quality for one person over proven tasks: how many carry a level, their mean (one
 * decimal), the rounded level, the spread 5→1 and the legacy count kept out of the mean.
 */
export function taskQualitySummary(tasks: any = [], employeeId: any) {
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let n = 0;
  let sum = 0;
  let legacy = 0;
  for (const task of tasks || []) {
    const q = taskQualityFor(task, employeeId);
    if (!q) { legacy += 1; continue; }
    dist[q.level] += 1;
    sum += q.level;
    n += 1;
  }
  const avg = n ? Math.round((sum / n) * 10) / 10 : null;
  const level = avg == null ? null : Math.min(5, Math.max(1, Math.round(avg)));
  return { n, avg, level, label: level ? perfLevelByNumber(level) : null, dist, legacy };
}

/** «مهمة معتمدة واحدة» · «مهمتين معتمدتين» · «5 مهام معتمدة» · «34 مهمة معتمدة». */
export function arApprovedTasks(n: any) {
  const k = Math.max(0, Number(n) || 0);
  if (k === 1) return "مهمة معتمدة واحدة";
  if (k === 2) return "مهمتين معتمدتين";
  if (k >= 3 && k <= 10) return `${k} مهام معتمدة`;
  return `${k} مهمة معتمدة`;
}

/** «متوسط 4.2 (فوق المتوسط) من 34 مهمة · ممتاز 12 · …» — the calm line under the period. */
export function taskQualityLine(summary: any, ar: any = true) {
  if (!summary?.n) {
    return ar
      ? (summary?.legacy ? `لا مهام بمستوى جودة في الفترة — ${summary.legacy} اعتُمدت قبل المستويات (بلا مستوى)` : "لا مهام معتمدة بمستوى جودة في الفترة")
      : (summary?.legacy ? `No task carries a quality level — ${summary.legacy} approved before levels` : "No approved task carries a quality level in this period");
  }
  const spread = PERF_LEVELS.filter((row) => summary.dist[row.level]).map((row) => `${ar ? row.ar : row.en} ${summary.dist[row.level]}`).join(" · ");
  const head = ar
    ? `متوسط ${summary.avg} (${summary.label?.ar}) من ${arApprovedTasks(summary.n)}`
    : `Average ${summary.avg} (${summary.label?.en}) over ${summary.n} approved task${summary.n === 1 ? "" : "s"}`;
  const tail = summary.legacy ? (ar ? ` · بلا مستوى ${summary.legacy}` : ` · no level ${summary.legacy}`) : "";
  return `${head} · ${spread}${tail}`;
}

/* ─────────────── the employee's objection to his level — platform policy (م71 principle) ─────────────── */

const isWeekend = (iso: any): any => {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d === 5 || d === 6;
};

/** n working days after `from` — Friday, Saturday and official holidays aside. */
export function workingDaysAfter(from: any, n: any, isHoliday: any) {
  return daysAfterExcludingHolidays(from, n, (iso) => isWeekend(iso) || (typeof isHoliday === "function" && isHoliday(iso)));
}

export function qualityObjectionBy(task: any, isHoliday: any) {
  const at = dateOnly(task?.quality?.at);
  return at ? workingDaysAfter(at, QUALITY_OBJECTION_WORKING_DAYS, isHoliday) : "";
}

export function qualityObjectionOf(task: any, employeeId: any) {
  return (Array.isArray(task?.qualityObjections) ? task.qualityObjections : [])
    .find((row) => String(row.employeeId) === String(employeeId)) || null;
}

function isRecipient(task: any, employeeId: any) {
  const id = String(employeeId || "");
  if (!id) return false;
  const listed = task?.quality?.recipientIds;
  if (Array.isArray(listed) && listed.length) return listed.map(String).includes(id);
  if (String(task?.ownerId || "") === id) return true;
  return (Array.isArray(task?.memberIds) ? task.memberIds.map(String) : []).includes(id);
}

export function checkQualityObjectionGate({ task, employeeId, reason, today, isHoliday }: any = {}) {
  if (!task?.quality || !qualityLevel(task.quality.level)) {
    return fail("QUALITY_NOT_SET", "لا مستوى جودة على هذه المهمة للاعتراض عليه.", "This task carries no quality level.");
  }
  if (!isRecipient(task, employeeId)) {
    return fail("QUALITY_OBJECTION_NOT_ASSIGNEE", "الاعتراض لمن اعتُمد إنجازه على هذه المهمة.", "Only an assignee of the task may object.");
  }
  if (qualityObjectionOf(task, employeeId)) {
    return fail("QUALITY_OBJECTION_EXISTS", "اعترضتَ على مستوى هذه المهمة من قبل — تابع الاعتراض القائم.", "You already objected to this level.");
  }
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const last = qualityObjectionBy(task, isHoliday);
  if (last && day > last) {
    return fail("QUALITY_OBJECTION_LATE",
      `مضت خمسة أيام عمل على اعتماد المستوى (آخر يوم ${last}) — سياسة المنصة المستمدة من مبدأ التظلم في النموذج الموحد م71. يبقى لك التظلم من تقرير الأداء السنوي (م20).`,
      `Five working days have passed since the level was set (last day ${last}) — platform policy after model Art. 71. You may still grieve the annual report (Art. 20).`,
      { last });
  }
  if (text(reason).length < QUALITY_OBJECTION_REASON_MIN) {
    return fail("QUALITY_OBJECTION_REASON", "اكتب اعتراضك: لماذا ترى المستوى غير صحيح، وما الذي أغفله.", "Write why the level is wrong and what it missed.");
  }
  return { ok: true, last, replyBy: daysAfterExcludingHolidays(day, QUALITY_DECISION_DAYS, isHoliday) };
}

export function applyQualityObjection(task: any, { employeeId, employeeName = "", reason, at, replyBy }: any = {}) {
  const when = at || new Date().toISOString();
  const mine = taskQualityFor(task, employeeId);
  const row = {
    id: `qobj_${String(employeeId)}_${when}`,
    employeeId: String(employeeId),
    employeeName,
    level: mine?.level ?? null,
    reason: text(reason),
    filedAt: when,
    replyBy: replyBy || "",
    decision: null,
  };
  return {
    ...task,
    qualityObjections: [...(Array.isArray(task.qualityObjections) ? task.qualityObjections : []), row],
    comments: [...(Array.isArray(task.comments) ? task.comments : []), {
      id: `qobjc_${when}`,
      authorId: String(employeeId),
      authorName: employeeName,
      text: row.reason,
      kind: "quality_objection",
      isIssue: false,
      is_rejection: false,
      is_escalation: true,
      at: when,
    }],
  };
}

/** Who decides: HR / the owner, or the approver's next level in the task's escalation chain — never the approver. */
export function canDecideQualityObjection(task: any, user: any, data: any) {
  const uid = String(user?.id || user?.employeeId || "");
  if (!uid || !task?.quality) return false;
  if (uid === String(task.quality.by || "")) return false;
  if (user.isOwner || user.admin || QUALITY_DECIDER_ROLES.includes(String(user.role || ""))) return true;
  const next = nextOpsEscalation({ ...task, escalationLevel: Math.max(0, Number(task.quality.reviewLevel) || 0) }, data, task.quality.by);
  return (next.handlers || []).some((h) => String(h?.id || h?.employeeId || "") === uid);
}

export function checkDecideQualityObjectionGate({ task, objectionId, decision, note, newLevel, actorId }: any = {}) {
  const row = (Array.isArray(task?.qualityObjections) ? task.qualityObjections : []).find((o) => o.id === objectionId) || null;
  if (!row || row.decision) return fail("QUALITY_OBJECTION_NOT_OPEN", "لا اعتراض مفتوح بهذا الرقم.", "No open objection found.");
  if (actorId && String(actorId) === String(task?.quality?.by || "")) {
    return fail("QUALITY_OBJECTION_APPROVER", "لا يبتّ المعتمِد في اعتراض على تقديره — يبتّ رئيسه أو الموارد البشرية.", "The approver does not decide an objection to his own rating.");
  }
  if (actorId && String(actorId) === String(row.employeeId)) return fail("QUALITY_OBJECTION_SELF", "لا يبتّ أحد في اعتراضه.", "Nobody decides his own objection.");
  if (!["upheld", "refused"].includes(decision)) return fail("QUALITY_DECISION_REQUIRED", "اختر: قبول الاعتراض أو رفضه.", "Uphold or refuse.");
  if (text(note).length < QUALITY_DECISION_NOTE_MIN) {
    return fail("QUALITY_DECISION_NOTE", "اكتب نتيجة البتّ وسببها — تُبلَّغ للموظف كتابةً.", "Write the decision and its reason — sent to the employee in writing.");
  }
  if (decision === "upheld") {
    const lv = qualityLevel(newLevel);
    if (!lv || lv.level === Number(row.level)) {
      return fail("QUALITY_NEW_LEVEL_REQUIRED", "قبول الاعتراض يحدّد المستوى الجديد، مختلفاً عن السابق.", "Upholding sets a new, different level.");
    }
    return { ok: true, decision, newLevel: lv.level, objection: row };
  }
  return { ok: true, decision, newLevel: null, objection: row };
}

/**
 * Records the written decision; an upheld objection sets that person's own level (an override from
 * the objection). → { task, employeeId, delta } — delta is the points change for his ledger.
 */
export function applyQualityObjectionDecision(task: any, { objectionId, decision, note, newLevel, byId, byName, at }: any = {}) {
  const when = at || new Date().toISOString();
  const rows = Array.isArray(task.qualityObjections) ? task.qualityObjections : [];
  const row = rows.find((o) => o.id === objectionId);
  if (!row) return { task, employeeId: null, delta: 0 };
  const before = taskPointsFor(task, row.employeeId);
  let next = {
    ...task,
    qualityObjections: rows.map((o) => (o.id === objectionId
      ? { ...o, decision, note: text(note), newLevel: decision === "upheld" ? Number(newLevel) : null, decidedAt: when, decidedBy: byId || null, decidedByName: byName || "" }
      : o)),
  };
  if (decision === "upheld" && qualityLevel(newLevel)) {
    const lv = Number(newLevel);
    const base = Number(task.quality?.basePoints) || taskPoints(task.priority, task.effortWeight);
    next = {
      ...next,
      quality: {
        ...task.quality,
        overrides: {
          ...(task.quality?.overrides || {}),
          [row.employeeId]: { level: lv, weight: TASK_QUALITY_WEIGHTS[lv], reason: text(note), points: qualityPoints(base, lv), source: "objection", by: byId || null, at: when },
        },
      },
    };
  }
  const after = taskPointsFor(next, row.employeeId);
  next = {
    ...next,
    comments: [...(Array.isArray(next.comments) ? next.comments : []), {
      id: `qdec_${when}`,
      authorId: byId || null,
      authorName: byName || "",
      text: text(note),
      kind: "quality_decision",
      decision,
      isIssue: false,
      is_rejection: false,
      at: when,
    }],
  };
  return { task: next, employeeId: row.employeeId, delta: after - before };
}

export function qualityObjectionState(row: any, today: any) {
  if (!row) return null;
  if (row.decision) return { stage: row.decision, replyBy: row.replyBy };
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  return { stage: row.replyBy && day > row.replyBy ? "overdue" : "pending", replyBy: row.replyBy };
}
