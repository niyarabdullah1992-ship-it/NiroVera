/** Client mirror of base44/shared/opsDerivations.ts — keep in sync. */
import { deriveBranchEscalationChain } from "./orgDerivations.js";
import { userCoversStation } from "./stationTree.js";
import { HEAT_BAN_STATE_LEVEL, heatBanWindow, isHeatBanDate, isHeatBanMinuteOfDay } from "./contractLawDerivations.js";
import { heatBanDecisionLabel } from "./heatBanDecision.js";
import { citeRule, explainRule } from "./laborRules.js";

export const PRIORITY_VALUE = { high: 3, medium: 2, low: 1 };

/** Flexible work kinds — office and field companies alike. Default is general. */
export const WORK_KINDS = ["gn", "ad", "of", "tr", "pm", "cm", "em", "pr", "cp"];

export const WORK_KIND_LABELS = {
  gn: { ar: "عام", en: "General" },
  ad: { ar: "إداري", en: "Administrative" },
  of: { ar: "مكتبي / تنسيقي", en: "Office / coordination" },
  tr: { ar: "تدريب / تطوير", en: "Training / development" },
  pm: { ar: "صيانة وقائية", en: "Preventive maintenance" },
  cm: { ar: "صيانة تصحيحية", en: "Corrective maintenance" },
  em: { ar: "طارئ", en: "Emergency" },
  pr: { ar: "مشروع", en: "Project" },
  cp: { ar: "امتثال", en: "Compliance" },
};

/** Optional competency hint for field kinds only — never required for assignment. */
export const CERT_FOR = {
  gn: null,
  ad: null,
  of: null,
  tr: null,
  pm: "loto",
  cm: "loto",
  em: "fa",
  pr: "wah",
  cp: null,
};

export const CERT_LABELS = {
  fa: { ar: "الإسعافات الأولية", en: "First aid" },
  loto: { ar: "العزل والوسم LOTO", en: "Lock-out / tag-out" },
  wah: { ar: "العمل على ارتفاع", en: "Work at height" },
  cs: { ar: "الأماكن المحصورة", en: "Confined space" },
};

export function normalizeWorkKind(raw, fallback = "gn") {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return fallback;
  const id = trimmed.toLowerCase();
  if (WORK_KINDS.includes(id)) return id;
  // Free-text custom work type for companies outside the preset list.
  return trimmed.slice(0, 80);
}

export function workKindLabel(kind, lang = "ar") {
  const id = String(kind || "").trim();
  if (!id) return lang === "en" ? "General" : "عام";
  if (WORK_KIND_LABELS[id]) return WORK_KIND_LABELS[id][lang === "en" ? "en" : "ar"];
  return id;
}

export function clampEffortWeight(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Points = priority value (3/2/1) × effort weight (1–5). Granted only after approval. */
export function taskPoints(priority, effortWeight) {
  const pv = PRIORITY_VALUE[String(priority || "medium")] ?? 1;
  return pv * clampEffortWeight(effortWeight);
}

function localDayStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function dayDiffFromToday(iso, today = new Date()) {
  if (!iso) return NaN;
  const due = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return NaN;
  return Math.round((due.getTime() - localDayStart(today).getTime()) / 86400000);
}

export function isoDayKey(value, today = new Date()) {
  if (!value) {
    const d = today instanceof Date ? today : new Date(today);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = raw.length === 10 ? new Date(`${raw}T00:00:00`) : new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function calendarDaysInclusive(fromIso, toIso) {
  const from = isoDayKey(fromIso);
  const to = isoDayKey(toIso);
  if (!from || !to) return 0;
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export function listMatchingPaceDays({ startAt, dueAt, weekdays, dates } = {}) {
  const from = isoDayKey(startAt);
  const to = isoDayKey(dueAt);
  if (!from || !to || from > to) return [];
  const picked = [...new Set((Array.isArray(dates) ? dates : [])
    .map((v) => String(v || "").trim().slice(0, 10))
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= from && v <= to))]
    .sort();
  if (Array.isArray(dates) && dates.length) return picked;
  const wanted = [...new Set((Array.isArray(weekdays) ? weekdays : [])
    .map((n) => Math.round(Number(n)))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
  const days = [];
  let day = from;
  while (day && day <= to) {
    const dt = new Date(`${day}T00:00:00`);
    if (!wanted.length || wanted.includes(dt.getDay())) days.push(day);
    dt.setDate(dt.getDate() + 1);
    day = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }
  return days;
}

export function taskPaceInput(task, today) {
  return {
    targetCount: task?.targetCount,
    completedCount: task?.completedCount,
    dueAt: task?.dueAt,
    startAt: task?.startAt || task?.createdAt,
    paceStartAt: task?.paceStartAt,
    paceSpreadTarget: task?.paceSpreadTarget,
    paceDayPlan: task?.paceDayPlan,
    weekdays: task?.paceWeekdays,
    paceDates: task?.paceDates,
    today,
  };
}

/** Normalize { "YYYY-MM-DD": n } day quotas. Drops empty/invalid days. */
export function normalizePaceDayPlan(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    const day = isoDayKey(key);
    const n = Math.max(0, Math.round(Number(val) || 0));
    if (!day || n <= 0) continue;
    out[day] = (out[day] || 0) + n;
  }
  return out;
}

export function paceDayPlanEntries(raw) {
  const plan = normalizePaceDayPlan(raw);
  return Object.keys(plan)
    .sort()
    .map((day) => ({ day, amount: plan[day] }));
}

export function paceDayPlanTotal(raw) {
  return paceDayPlanEntries(raw).reduce((sum, row) => sum + row.amount, 0);
}

/** Spread targetCount evenly — or by paceDayPlan custom day quotas. Derived todayExpected; plan is stored. */
export function deriveDailyTaskPace({
  targetCount,
  completedCount = 0,
  dueAt,
  startAt,
  paceStartAt,
  paceSpreadTarget,
  paceDayPlan,
  weekdays,
  paceDates,
  today = new Date(),
} = {}) {
  const target = Math.max(0, Math.round(Number(targetCount) || 0));
  const done = Math.max(0, Number(completedCount) || 0);
  const remaining = Math.max(0, target - done);
  const todayKey = isoDayKey(today);
  // A task with no due date has no time quota — never fabricate today as its deadline.
  const due = dueAt != null && String(dueAt).trim() ? isoDayKey(dueAt) : "";
  const start = isoDayKey(startAt) || todayKey;
  const plan = normalizePaceDayPlan(paceDayPlan);
  const planEntries = paceDayPlanEntries(plan);
  const hasCustom = planEntries.length > 0;
  const rebaseRaw = !hasCustom && paceStartAt != null && String(paceStartAt).trim() !== ""
    ? isoDayKey(paceStartAt)
    : "";
  const redistributed = Boolean(rebaseRaw);
  const empty = {
    active: false,
    target,
    done,
    remaining,
    days: 0,
    daysLeft: 0,
    even: 0,
    extra: 0,
    todayExpected: 0,
    plannedShare: 0,
    overdue: false,
    notYet: false,
    offDay: false,
    due: due || "",
    start: start || "",
    redistributed: false,
    custom: false,
    spreadTarget: target,
    baseDone: 0,
    dayPlan: {},
    paceDays: [],
  };

  if (hasCustom) {
    const planTotal = paceDayPlanTotal(plan);
    const lastDay = planEntries[planEntries.length - 1].day;
    const firstDay = planEntries[0].day;
    const effectiveDue = due || lastDay;
    const overdue = todayKey > effectiveDue;
    const notYet = !overdue && todayKey < firstDay;
    const plannedLeft = planEntries.filter((row) => row.day >= todayKey && row.day <= effectiveDue).length;
    let todayExpected = 0;
    if (overdue) {
      todayExpected = remaining;
    } else if (!notYet) {
      todayExpected = Math.min(remaining, Math.max(0, Number(plan[todayKey]) || 0));
    }
    const plannedShare = Math.min(remaining, Math.max(0, Number(plan[firstDay]) || 0));
    return {
      active: target > 0 && planTotal > 0,
      target,
      done,
      remaining,
      days: planEntries.length,
      daysLeft: overdue ? 0 : Math.max(plannedLeft, calendarDaysInclusive(todayKey, effectiveDue)),
      even: 0,
      extra: 0,
      todayExpected,
      plannedShare,
      overdue,
      notYet,
      offDay: false,
      due: effectiveDue,
      start: firstDay,
      redistributed: false,
      custom: true,
      spreadTarget: planTotal,
      baseDone: 0,
      dayPlan: plan,
      paceDays: planEntries.map((row) => row.day),
    };
  }

  if (target < 1 || !due) return empty;
  const windowStart = redistributed
    ? (rebaseRaw <= due ? rebaseRaw : due)
    : (start <= due ? start : due);
  const spreadTarget = redistributed
    ? Math.max(0, Math.round(Number(paceSpreadTarget != null ? paceSpreadTarget : remaining) || 0))
    : target;
  const baseDone = redistributed ? Math.max(0, target - spreadTarget) : 0;
  const filtered = (Array.isArray(paceDates) && paceDates.length) || (Array.isArray(weekdays) && weekdays.length)
    ? listMatchingPaceDays({ startAt: windowStart, dueAt: due, weekdays, dates: paceDates })
    : null;
  if (filtered && !filtered.length) return empty;
  const paceDays = filtered || [];
  const days = Math.max(1, paceDays.length || calendarDaysInclusive(windowStart, due));
  const overdue = todayKey > due;
  const firstDay = paceDays[0] || windowStart;
  const beforeStart = todayKey < firstDay;
  const onDay = !paceDays.length || paceDays.includes(todayKey);
  const offDay = !beforeStart && !overdue && !onDay;
  const daysLeft = overdue
    ? 0
    : (paceDays.length
      ? paceDays.filter((d) => d >= todayKey).length
      : Math.max(0, calendarDaysInclusive(todayKey, due)));
  const workFrom = beforeStart ? firstDay : todayKey;
  const workDaysLeft = overdue
    ? 0
    : (paceDays.length
      ? paceDays.filter((d) => d >= workFrom).length
      : Math.max(0, calendarDaysInclusive(workFrom, due)));
  const splitDays = Math.max(1, workDaysLeft);
  const even = Math.floor(remaining / splitDays);
  const extra = remaining % splitDays;
  let todayExpected = 0;
  if (overdue) {
    todayExpected = remaining;
  } else if (!beforeStart && onDay) {
    todayExpected = Math.min(remaining, even + (extra > 0 ? 1 : 0));
  }
  const plannedShare = Math.min(remaining, even + (extra > 0 ? 1 : 0));
  return {
    active: true,
    target,
    done,
    remaining,
    days,
    daysLeft,
    even,
    extra,
    todayExpected,
    plannedShare,
    overdue,
    notYet: beforeStart,
    offDay,
    due,
    start: windowStart,
    redistributed,
    custom: false,
    spreadTarget,
    baseDone,
    dayPlan: {},
    paceDays,
  };
}

export function dailyPaceCopy(pace, ar = true) {
  if (!pace?.active) return null;
  const todayLabel = ar ? "حصة اليوم" : "Today's quota";
  const daysLabel = ar ? "الأيام المتبقية" : "Days left";
  const daysValue = String(pace.daysLeft ?? pace.days ?? 0);
  if (pace.notYet) {
    const share = Math.max(0, Number(pace.plannedShare) || 0);
    return {
      tone: "ok",
      kicker: ar ? "لم يحن يومه" : "Its day has not come",
      metrics: [
        { label: todayLabel, value: String(share) },
        { label: ar ? "المتبقي" : "Left", value: String(pace.remaining) },
        { label: daysLabel, value: daysValue },
      ],
      hint: ar
        ? "يُقسَّم المتبقي على الأيام المتبقية حتى الاستحقاق — التنفيذ لم يحن موعده بعد."
        : "The remainder is split across remaining days until due — work has not started yet.",
    };
  }
  if (pace.offDay) {
    return {
      tone: "ok",
      kicker: ar ? "اليوم خارج التوزيع" : "Today is off the spread",
      metrics: [
        { label: todayLabel, value: "0" },
        { label: ar ? "المتبقي" : "Left", value: String(pace.remaining) },
        { label: daysLabel, value: daysValue },
      ],
      hint: ar
        ? "هذا اليوم ليس من أيام التوزيع المختارة — حصة اليوم 0."
        : "Today is not one of the selected spread days — today's quota is 0.",
    };
  }
  if (pace.remaining <= 0) {
    return {
      tone: "done",
      kicker: pace?.custom
        ? (ar ? "خطة أيام محددة" : "Custom day plan")
        : (ar ? "التوزيع على الأيام" : "Spread across days"),
      metrics: [
        { label: todayLabel, value: "0" },
        { label: ar ? "المتبقي" : "Left", value: "0" },
        { label: daysLabel, value: daysValue },
      ],
      hint: ar ? "اكتمل العدد المستهدف" : "Target count is met",
    };
  }
  if (pace.overdue) {
    return {
      tone: "warn",
      kicker: pace?.custom
        ? (ar ? "خطة أيام — متأخر" : "Day plan — behind")
        : (ar ? "متأخر عن التوزيع" : "Behind the spread"),
      metrics: [
        { label: todayLabel, value: String(pace.remaining) },
        { label: ar ? "المتبقي" : "Left", value: String(pace.remaining) },
        { label: daysLabel, value: "0" },
      ],
      hint: ar ? "المتبقي يُنجز اليوم" : "Remaining is due today",
    };
  }
  return {
    tone: "ok",
    kicker: pace.custom
      ? (ar ? "خطة أيام محددة" : "Custom day plan")
      : (ar ? "التوزيع على الأيام" : "Spread across days"),
    metrics: [
      { label: todayLabel, value: String(pace.todayExpected) },
      { label: ar ? "المتبقي" : "Left", value: String(pace.remaining) },
      { label: daysLabel, value: daysValue },
    ],
    hint: pace.custom
      ? (ar ? "حصة الخطة لليوم — المتبقي يُحسب على الأيام المتبقية" : "Today's planned quota — remainder counted against remaining days")
      : pace.paceDays?.length
        ? (ar ? "يُقسَّم المتبقي على أيام التوزيع المتبقية حتى الاستحقاق" : "The remainder is split across remaining spread days until due")
        : pace.redistributed
          ? (ar ? "أُعيد توزيع المتبقي بالتساوي على الأيام المتبقية" : "Remainder re-split evenly across remaining days")
          : (ar ? "يُقسَّم المتبقي بالتساوي على الأيام المتبقية حتى الاستحقاق" : "The remainder is split evenly across remaining days until due"),
  };
}

/** Units logged on a calendar day from paceDayLog. */
export function taskPaceLoggedOnDay(task, day = new Date()) {
  const key = isoDayKey(day);
  if (!key) return 0;
  const map = task?.paceDayLog && typeof task.paceDayLog === "object" ? task.paceDayLog : null;
  if (!map) return 0;
  return Math.max(0, Number(map[key]) || 0);
}

export function applyOpsPaceDayLog(task, amount = 1, at = new Date().toISOString()) {
  const day = isoDayKey(at);
  const raw = Math.round(Number(amount));
  const add = Number.isFinite(raw) ? raw : 0;
  const prev = task?.paceDayLog && typeof task.paceDayLog === "object" ? task.paceDayLog : {};
  const nextVal = Math.max(0, (Number(prev[day]) || 0) + add);
  return {
    ...task,
    paceDayLog: { ...prev, [day]: nextVal },
  };
}

/** Unsend a task-thread message within three minutes of posting. */
export const OPS_MESSAGE_DELETE_WINDOW_MS = 3 * 60 * 1000;

export function applyOpsCommentDelete(task, commentId, {
  now = Date.now(),
  actorId = "",
  actorIds = [],
  windowMs = OPS_MESSAGE_DELETE_WINDOW_MS,
  lang = "ar",
} = {}) {
  const id = String(commentId || "").trim();
  const comments = Array.isArray(task?.comments) ? task.comments : [];
  const found = comments.find((c) => String(c?.id || "") === id);
  if (!found) {
    return { ok: false, error: "COMMENT_NOT_FOUND", reason: lang === "en" ? "Message not found." : "الرسالة غير موجودة." };
  }
  if (found.is_auto || found.is_rejection || found.is_escalation) {
    return {
      ok: false,
      error: "PROTECTED",
      reason: lang === "en"
        ? "Reject and escalation reasons stay on the card so the cause stays visible."
        : "أسباب الرفض والتصعيد تبقى في البطاقة ليُعرف السبب.",
    };
  }
  const atMs = new Date(found.at || found.createdAt || 0).getTime();
  const ageMs = Number.isFinite(atMs) ? now - atMs : Infinity;
  if (ageMs > windowMs) {
    return { ok: false, error: "WINDOW", reason: lang === "en" ? "Messages can only be deleted within 3 minutes of sending." : "انتهت مهلة الثلاث دقائق للحذف." };
  }
  const aid = String(found.authorId || found.author_id || "").trim();
  const actors = new Set([actorId, ...(Array.isArray(actorIds) ? actorIds : [])].map((x) => String(x || "").trim()).filter(Boolean));
  if (actors.size && aid && !actors.has(aid)) {
    return { ok: false, error: "FORBIDDEN", reason: lang === "en" ? "You can only delete your own message." : "لا تُحذف إلا رسالتك." };
  }
  const add = String(found.kind || "") === "log" ? Math.max(0, Math.round(Number(found.amount) || 0)) : 0;
  const approved = task.status === "completed" || !!task.approvedAt;
  if (approved && add > 0) {
    return { ok: false, error: "LOCKED", reason: lang === "en" ? "Logged completion cannot be removed after approval." : "لا يُحذف سجل الإنجاز بعد الاعتماد." };
  }
  let next = { ...task, comments: comments.filter((c) => String(c?.id || "") !== id) };
  if (add > 0) {
    const nextCount = Math.max(0, (Number(task.completedCount) || 0) - add);
    const targetN = Math.max(1, Number(task.targetCount) || 1);
    next.completedCount = nextCount;
    next.completed_tasks = nextCount;
    if (task.status === "awaiting_approval" && nextCount < targetN) next.status = "active";
    next = applyOpsPaceDayLog(next, -add, found.at || found.createdAt);
  }
  return { ok: true, task: next, comment: found, ageMs };
}

/**
 * Remainder card / pace blocker — only after an incomplete log or «بلا إنجاز».
 * Idle 0 before any action is not a shortfall (would keep the card always on).
 */
export function derivePaceBlocker({
  task,
  pace,
  amountJustLogged = 0,
  today = new Date(),
  applied = false,
  missed = false,
} = {}) {
  if (!pace?.active || pace.overdue || pace.notYet) return null;
  const expected = Math.max(0, Number(pace.todayExpected) || 0);
  if (expected <= 0) return null;
  const day = isoDayKey(today);
  const add = Math.max(0, Math.round(Number(amountJustLogged) || 0));
  const onDay = taskPaceLoggedOnDay(task, today);
  const before = applied ? Math.max(0, onDay - add) : onDay;
  const logged = Math.max(0, before + add);
  const stored = task?.paceBlocker && typeof task.paceBlocker === "object" ? task.paceBlocker : null;
  const storedOpenToday = stored?.status === "open" && String(stored.day || "") === day;
  const entryShort = add > 0 && add < expected;
  const partialDay = logged > 0 && logged < expected;
  const declaredMissed = !!missed || (applied && add === 0);
  if (logged >= expected && !entryShort) return null;
  if (!entryShort && !partialDay && !declaredMissed && !storedOpenToday) return null;
  if (!entryShort && !declaredMissed && stored?.status === "resolved" && String(stored.day || "") === day) return null;

  const shown = entryShort ? add : (declaredMissed && logged <= 0 ? 0 : logged);
  const target = Math.max(1, Number(task?.targetCount) || pace?.target || 1);
  const done = Math.max(0, Number(task?.completedCount) || 0);
  const remainingAfter = Math.max(0, target - done - (applied ? 0 : add));

  return {
    day,
    expected,
    logged: shown,
    gap: expected - shown,
    remainingAfter,
    daysLeft: pace.daysLeft,
    due: pace.due || "",
    kind: shown <= 0 ? "missed" : "partial",
    status: "open",
  };
}

/** Compatibility wrapper — prefer derivePaceBlocker. */
export function derivePaceLogShortfall({ pace, amount, remainingBefore, task, today } = {}) {
  const add = amount != null ? Number(amount) : 0;
  const missed = amount != null && !(add > 0);
  if (task) {
    return derivePaceBlocker({ task, pace, amountJustLogged: add, today, missed });
  }
  const remBefore = remainingBefore != null ? Number(remainingBefore) : pace?.remaining;
  const synthetic = {
    targetCount: pace?.target || 0,
    completedCount: Math.max(0, (Number(pace?.target) || 0) - Math.max(0, remBefore || 0)),
    paceDayLog: {},
  };
  return derivePaceBlocker({
    task: synthetic,
    pace,
    amountJustLogged: add,
    today,
    missed,
  });
}

export function paceShortfallCopy(shortfall, ar = true) {
  if (!shortfall) return null;
  // المنجز هو مصدر الحقيقة — لا تعتمد على kind المخزَّن إن تعارض
  const missed = Number(shortfall.logged) <= 0;
  return {
    caseKey: missed ? "missed" : "partial",
    caseLabel: missed
      ? (ar ? "حالة 1 — لم تُنجز من الأساس" : "Case 1 — not started today")
      : (ar ? "حالة 2 — أُنجزت جزئيًا" : "Case 2 — partially completed"),
    title: missed
      ? (ar ? "عائق — المهمة لم تُنجز اليوم" : "Blocker — nothing completed today")
      : (ar ? "عائق — إنجاز جزئي عن تارقت اليوم" : "Blocker — partial vs today's target"),
    reason: missed
      ? (ar
        ? `لم يُسجَّل أي إنجاز من حصة اليوم. التارقت ${shortfall.expected}، المنجز 0 (نقص ${shortfall.gap}). المتبقي على المهمة ${shortfall.remainingAfter} عبر ${shortfall.daysLeft} يوم حتى ${shortfall.due || "—"}.`
        : `Nothing was logged toward today's quota. Target ${shortfall.expected}, done 0 (short ${shortfall.gap}). Task remaining ${shortfall.remainingAfter} over ${shortfall.daysLeft} days until ${shortfall.due || "—"}.`)
      : (ar
        ? `أُنجز جزء من الحصة: ${shortfall.logged} من ${shortfall.expected} (نقص ${shortfall.gap}). المتبقي على المهمة ${shortfall.remainingAfter} عبر ${shortfall.daysLeft} يوم حتى ${shortfall.due || "—"}.`
        : `Part of the quota was done: ${shortfall.logged} of ${shortfall.expected} (short ${shortfall.gap}). Task remaining ${shortfall.remainingAfter} over ${shortfall.daysLeft} days until ${shortfall.due || "—"}.`),
    reasonLabel: missed
      ? (ar ? "سبب عدم إنجاز المهمة اليوم (مطلوب)" : "Reason nothing was completed today (required)")
      : (ar ? "سبب عدم إكمال الحصة اليوم (مطلوب)" : "Reason the quota was not finished today (required)"),
    reasonPlaceholder: missed
      ? (ar
        ? "مثال: لم يبدأ العمل، غياب الفريق، إيقاف الموقع…"
        : "e.g. work never started, team absent, site stopped…")
      : (ar
        ? "مثال: نقص عمالة، عطل معدة، انتظار اعتماد…"
        : "e.g. staffing gap, equipment fault, waiting approval…"),
    extendHint: ar
      ? "مدّد الموعد لإعطاء أيام إضافية للمتبقي."
      : "Extend the due date to add days for the remainder.",
    redistributeHint: ar
      ? "وزّع المتبقي بالتساوي على الأيام المتبقية بدءًا من اليوم."
      : "Distribute the remainder evenly across remaining days from today.",
    choiceHint: ar
      ? "حالتان للعائق: (1) لم تُنجز من الأساس (2) أُنجزت جزئيًا — اكتب السبب ثم تمديد الأيام أو التوزيع."
      : "Two blocker cases: (1) not started (2) partial — write the reason, then extend days or redistribute.",
  };
}

export function applyOpsPaceBlockerResolve(task, input = {}) {
  const at = input.at || new Date().toISOString();
  const day = isoDayKey(input.day || at);
  const reason = String(input.reason || "").trim();
  const resolution = input.resolution === "extend" ? "extend" : "redistribute";
  const prev = task?.paceBlocker && typeof task.paceBlocker === "object" ? task.paceBlocker : {};
  return {
    ...task,
    paceBlocker: {
      ...prev,
      day,
      expected: Number(input.expected != null ? input.expected : prev.expected) || 0,
      logged: Number(input.logged != null ? input.logged : prev.logged) || 0,
      gap: Number(input.gap != null ? input.gap : prev.gap) || 0,
      reason,
      resolution,
      status: "resolved",
      resolvedAt: at,
      byId: input.byId || null,
      byName: input.byName || "",
    },
  };
}

export function boardPaceCopy(board, ar = true) {
  if (!board?.active) return null;
  return {
    tone: "ok",
    kicker: ar ? "التوزيع على الأيام" : "Spread across days",
    metrics: [
      { label: ar ? "اليوم" : "Today", value: String(board.todayExpected) },
      { label: ar ? "الأوامر" : "Orders", value: String(board.active) },
    ],
    hint: ar ? "مجموع إيقاع اليوم للأوامر المؤرخة" : "Sum of today's pace on dated orders",
  };
}

export function dailyPaceLabel(pace, ar = true) {
  const copy = dailyPaceCopy(pace, ar);
  if (!copy) return "";
  const today = copy.metrics[0]?.value || "0";
  return `${copy.kicker} · ${today} · ${copy.hint}`;
}

export function deriveBoardDailyPace(tasks, today = new Date()) {
  let todayExpected = 0;
  let active = 0;
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    if (isDone(task) || isAwaitingApproval(task)) return;
    const pace = deriveDailyTaskPace(taskPaceInput(task, today));
    if (!pace.active) return;
    active += 1;
    todayExpected += pace.todayExpected;
  });
  return { active, todayExpected };
}

/** Remaining days to due date: ≤7 weekly, ≤31 monthly, ≤92 quarterly, ≤183 half-year, else annual. */
export function planHorizonFromDue(iso, today = new Date()) {
  if (!iso) return "w";
  const d = dayDiffFromToday(iso, today);
  if (Number.isNaN(d)) return "w";
  if (d <= 7) return "w";
  if (d <= 31) return "m";
  if (d <= 92) return "q";
  if (d <= 183) return "h";
  return "y";
}

/** Live plan bucket from remaining days. A pinned horizon stays only when explicitly pinned. */
export function taskPlanHorizon(task, today = new Date()) {
  if (task?.planPinned && task?.planHorizon) return String(task.planHorizon);
  return planHorizonFromDue(task?.dueAt, today);
}

/** Cap on materialized occurrences from one New-task recurrence. */
export const TASK_RECURRENCE_MAX = 52;
/** Max repeats inside one calendar month (days 1–31). */
export const TASK_RECURRENCE_TIMES_MAX = 31;

export function clampTimesPerMonth(raw) {
  if (raw === "" || raw == null) return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(TASK_RECURRENCE_TIMES_MAX, n);
}

export const WEEKDAY_OPTIONS = [
  { id: 0, ar: "الأحد", en: "Sunday" },
  { id: 1, ar: "الاثنين", en: "Monday" },
  { id: 2, ar: "الثلاثاء", en: "Tuesday" },
  { id: 3, ar: "الأربعاء", en: "Wednesday" },
  { id: 4, ar: "الخميس", en: "Thursday" },
  { id: 5, ar: "الجمعة", en: "Friday" },
  { id: 6, ar: "السبت", en: "Saturday" },
];

export const RECURRENCE_HORIZONS = [
  { id: "m", ar: "هذا الشهر", en: "This month" },
  { id: "q", ar: "ثلاثة أشهر", en: "Three months" },
  { id: "y", ar: "سنة", en: "A year" },
];

function isoFromYmd(y, month, d) {
  return `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function dateFromIsoDay(iso) {
  const key = isoDayKey(iso);
  const m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function addCalendarDays(iso, n) {
  const dt = dateFromIsoDay(iso);
  if (!dt) return "";
  dt.setDate(dt.getDate() + n);
  return isoFromYmd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function listIsoDaysInRange(fromIso, toIso, max = 366) {
  const from = isoDayKey(fromIso);
  const to = isoDayKey(toIso);
  if (!from || !to || from > to) return [];
  const days = [];
  for (let day = from; day && day <= to; day = addCalendarDays(day, 1)) {
    days.push(day);
    if (days.length >= max) break;
  }
  return days;
}

export const PACE_CHIP_DAYS_MAX = 62;
export const PACE_DATES_MAX = 800;

export function normalizeMonthDays(raw) {
  return [...new Set((Array.isArray(raw) ? raw : [])
    .map((n) => Math.round(Number(n)))
    .filter((n) => n >= 1 && n <= 31))]
    .sort((a, b) => a - b);
}

/** Repeat day-of-month numbers (1–31) across the start→due window. */
export function expandMonthDaysInWindow(startAt, dueAt, monthDays, max = PACE_DATES_MAX) {
  const from = isoDayKey(startAt);
  const to = isoDayKey(dueAt);
  const wanted = new Set(normalizeMonthDays(monthDays));
  if (!from || !to || from > to || !wanted.size) return [];
  const days = [];
  for (let day = from; day && day <= to; day = addCalendarDays(day, 1)) {
    if (wanted.has(Number(day.slice(8, 10)))) {
      days.push(day);
      if (days.length >= max) break;
    }
  }
  return days;
}

export function syncPaceSelection(form, startAt, dueAt) {
  return {
    paceDates: clipIsoDatesToWindow(form?.paceDates, startAt, dueAt),
  };
}

export const TASK_WINDOW_SPANS = [
  { id: "w", ar: "أسبوع", en: "Week" },
  { id: "m", ar: "شهر", en: "Month" },
  { id: "y", ar: "سنة", en: "Year" },
];

/** Inclusive end of a week / month / year window from start. */
export function taskWindowSpanEnd(startIso, span) {
  const dt = dateFromIsoDay(startIso);
  if (!dt) return "";
  if (span === "w") dt.setDate(dt.getDate() + 6);
  else if (span === "m") {
    dt.setMonth(dt.getMonth() + 1);
    dt.setDate(dt.getDate() - 1);
  } else if (span === "y") {
    dt.setFullYear(dt.getFullYear() + 1);
    dt.setDate(dt.getDate() - 1);
  } else return isoDayKey(startIso);
  return isoFromYmd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function applyTaskWindowSpan(form, span, today = new Date()) {
  const start = isoDayKey(form?.startAt) || isoDayKey(today);
  return { startAt: start, dueAt: taskWindowSpanEnd(start, span) };
}

export function formPaceMode(form) {
  const mode = String(form?.paceMode || "all");
  if (mode === "weekdays" || mode === "dates" || mode === "specific") return mode;
  return "all";
}

export function clipIsoDatesToWindow(dates, startAt, dueAt, max = PACE_DATES_MAX) {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(startAt || "").trim()) ? String(startAt).trim().slice(0, 10) : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(dueAt || "").trim()) ? String(dueAt).trim().slice(0, 10) : "";
  return normalizeIsoDates(dates, max).filter((d) => (!from || d >= from) && (!to || d <= to));
}

export function formPaceInput(form, today) {
  const mode = formPaceMode(form);
  const weekdays = mode === "weekdays"
    ? normalizeWeekdays(form?.paceWeekdays, form?.recurrenceWeekdays ?? form?.recurrenceWeekday)
    : [];
  const paceDates = mode === "dates"
    ? clipIsoDatesToWindow(form?.paceDates || form?.recurrencePickedDays, form?.startAt, form?.dueAt)
    : [];
  return {
    targetCount: form?.targetCount,
    dueAt: form?.dueAt,
    startAt: form?.startAt,
    weekdays: weekdays.length ? weekdays : undefined,
    paceDates: paceDates.length ? paceDates : undefined,
    today,
  };
}

export function checkTaskPaceFromForm(form) {
  const win = checkTaskWindowFromForm({ ...form, recurrenceKind: "daily" });
  if (!win.ok) return win;
  const mode = formPaceMode(form);
  if (mode === "specific") {
    return {
      ...win,
      ok: false,
      error: "PACE_KIND_REQUIRED",
      reason: "اختر إن كان التوزيع يومًا ثابتًا في الفترة أو أيامًا مرنة من التقويم.",
      reasonEn: "Choose a fixed weekday in the window, or pick specific dates on the calendar.",
    };
  }
  if (mode === "weekdays") {
    const days = normalizeWeekdays(form?.paceWeekdays, form?.recurrenceWeekdays ?? form?.recurrenceWeekday);
    if (!days.length) {
      return {
        ...win,
        ok: false,
        error: "PACE_WEEKDAY_REQUIRED",
        reason: "حدّد أيام الأسبوع للتوزيع.",
        reasonEn: "Pick the weekdays for the spread.",
      };
    }
  }
  if (mode === "dates") {
    const dates = listMatchingPaceDays({
      startAt: win.startAt,
      dueAt: win.dueAt,
      dates: form?.paceDates || form?.recurrencePickedDays,
    });
    if (!dates.length) {
      return {
        ...win,
        ok: false,
        error: "PACE_DAY_REQUIRED",
        reason: "حدّد الأيام داخل الفترة.",
        reasonEn: "Pick the days inside the date range.",
      };
    }
  }
  return { ok: true, ...win };
}

export function normalizeWeekdays(raw, fallback) {
  const src = Array.isArray(raw)
    ? raw
    : (fallback != null && fallback !== "" ? [fallback] : []);
  return [...new Set(src
    .map((n) => Math.round(Number(n)))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))]
    .sort((a, b) => a - b);
}

export function normalizeIsoDates(raw, max = TASK_RECURRENCE_MAX) {
  return [...new Set((Array.isArray(raw) ? raw : [])
    .map((v) => String(v || "").trim().slice(0, 10))
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v)))]
    .sort()
    .slice(0, max);
}

export const TASK_RECURRENCE_MONTHS_MAX = 24;
export const TASK_RECURRENCE_EXTRA_DAYS_MAX = 366;

export function clampDurationPart(raw, max) {
  if (raw === "" || raw == null) return 0;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}

export function recurrenceDurationEnd(startIso, months, extraDays) {
  const dt = dateFromIsoDay(startIso);
  if (!dt) return "";
  const m = clampDurationPart(months, TASK_RECURRENCE_MONTHS_MAX);
  const d = clampDurationPart(extraDays, TASK_RECURRENCE_EXTRA_DAYS_MAX);
  if (m < 1 && d < 1) return "";
  dt.setMonth(dt.getMonth() + m);
  dt.setDate(dt.getDate() + d);
  return isoFromYmd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function taskWindowFromForm(form) {
  const kind = String(form?.recurrenceKind || "daily");
  const startAt = String(form?.startAt || "").trim().slice(0, 10);
  if (kind === "daily" || kind === "once" || kind === "range" || kind === "weekly") {
    return { startAt, dueAt: String(form?.dueAt || "").trim().slice(0, 10) };
  }
  return {
    startAt,
    dueAt: startAt ? recurrenceDurationEnd(startAt, form?.recurrenceMonths, 0) : "",
  };
}

export function checkTaskWindowFromForm(form) {
  const kind = String(form?.recurrenceKind || "daily");
  const win = taskWindowFromForm(form);
  if (kind === "daily" || kind === "once" || kind === "range" || kind === "weekly") {
    if (!win.startAt || !win.dueAt) {
      return {
        ok: false,
        error: "RECURRENCE_RANGE_REQUIRED",
        reason: "حدّد تاريخ البدء وتاريخ الاستحقاق.",
        reasonEn: "Pick the start and due dates.",
        ...win,
      };
    }
    if (win.startAt > win.dueAt) {
      return {
        ok: false,
        error: "RECURRENCE_RANGE_ORDER",
        reason: "تاريخ البدء بعد الاستحقاق.",
        reasonEn: "Start date is after the due date.",
        ...win,
      };
    }
    if (kind === "weekly") {
      if (form?.recurrenceDayMode === "dates") {
        if (!normalizeIsoDates(form?.recurrencePickedDays).length) {
          return {
            ok: false,
            error: "RECURRENCE_DAY_REQUIRED",
            reason: "حدّد الأيام داخل الفترة.",
            reasonEn: "Pick the days inside the date range.",
            ...win,
          };
        }
      } else if (!normalizeWeekdays(form?.recurrenceWeekdays, form?.recurrenceWeekday).length) {
        return {
          ok: false,
          error: "RECURRENCE_WEEKDAY_REQUIRED",
          reason: "حدّد أيام الأسبوع للمهمة.",
          reasonEn: "Pick the weekdays for the task.",
          ...win,
        };
      }
    }
    return { ok: true, ...win };
  }
  if (!win.startAt) {
    return {
      ok: false,
      error: "RECURRENCE_START_REQUIRED",
      reason: "حدّد تاريخ البدء.",
      reasonEn: "Pick a start date.",
      ...win,
    };
  }
  if (!win.dueAt) {
    return {
      ok: false,
      error: "RECURRENCE_DURATION_REQUIRED",
      reason: "اكتب مدة المهمة بالأشهر.",
      reasonEn: "Enter the task duration in months.",
      ...win,
    };
  }
  return { ok: true, ...win };
}

export function recurrenceHorizonEnd(startIso, horizon) {
  const dt = dateFromIsoDay(startIso);
  if (!dt) return startIso;
  if (horizon === "m") {
    const end = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
    return isoFromYmd(end.getFullYear(), end.getMonth() + 1, end.getDate());
  }
  const end = horizon === "q"
    ? new Date(dt.getFullYear(), dt.getMonth() + 3, dt.getDate())
    : new Date(dt.getFullYear() + 1, dt.getMonth(), dt.getDate());
  end.setDate(end.getDate() - 1);
  return isoFromYmd(end.getFullYear(), end.getMonth() + 1, end.getDate());
}

export function recurrenceWindowEnd(from, rec, dueAt) {
  const due = dueAt != null && String(dueAt).trim() ? isoDayKey(dueAt) : "";
  if (due && due >= from) return due;
  return recurrenceHorizonEnd(from, rec?.horizon || "m");
}

export function normalizeTaskRecurrence(raw) {
  if (!raw || typeof raw !== "object") return { kind: "once" };
  const kind = String(raw.kind || "once");
  if (kind === "once" || !kind) return { kind: "once" };
  const weekdayN = Number(raw.weekday);
  const weekday = Number.isInteger(weekdayN) && weekdayN >= 0 && weekdayN <= 6 ? weekdayN : null;
  const weekdays = normalizeWeekdays(raw.weekdays, weekday);
  const dates = normalizeIsoDates(raw.dates);
  const timesPerMonth = clampTimesPerMonth(raw.timesPerMonth);
  const monthDays = [...new Set((Array.isArray(raw.monthDays) ? raw.monthDays : [])
    .map((n) => Math.round(Number(n)))
    .filter((n) => n >= 1 && n <= 31))]
    .sort((a, b) => a - b)
    .slice(0, TASK_RECURRENCE_TIMES_MAX);
  const horizon = ["m", "q", "y"].includes(raw.horizon) ? raw.horizon : "m";
  if (kind === "weekly") return { kind: "weekly", weekday: weekdays[0] ?? null, weekdays, horizon };
  if (kind === "selected_dates") return { kind: "selected_dates", dates, horizon };
  if (kind === "monthly_dates") return { kind: "monthly_dates", monthDays, horizon };
  if (kind === "monthly_weekday") return { kind: "monthly_weekday", weekday, timesPerMonth, horizon };
  return { kind: "once" };
}

export function taskRecurrenceFromForm(form) {
  const kind = String(form?.recurrenceKind || "daily");
  if (kind === "daily" || kind === "once" || kind === "range" || kind === "weekly"
    || (kind === "yearly" && form?.recurrenceYearSpread !== "months")) return { kind: "once" };
  if (form?.recurrenceDayMode === "dates") {
    const n = clampTimesPerMonth(form.recurrenceTimes) || TASK_RECURRENCE_TIMES_MAX;
    const days = (Array.isArray(form.recurrenceMonthDays) ? form.recurrenceMonthDays : []).slice(0, n);
    return normalizeTaskRecurrence({
      kind: "monthly_dates",
      monthDays: days,
      horizon: kind === "yearly" ? "y" : (form.recurrenceHorizon || "m"),
    });
  }
  return normalizeTaskRecurrence({
    kind: "monthly_weekday",
    weekday: form.recurrenceWeekday,
    timesPerMonth: form.recurrenceTimes,
    horizon: kind === "yearly" ? "y" : (form.recurrenceHorizon || "m"),
  });
}

export function expandTaskRecurrence(recurrence, { startAt, dueAt, today = new Date() } = {}) {
  const rec = normalizeTaskRecurrence(recurrence);
  const from = isoDayKey(startAt, today) || isoDayKey(today);
  if (rec.kind === "once") {
    const to = isoDayKey(dueAt, today) || from;
    return [{ startAt: from, dueAt: to < from ? from : to }];
  }
  const to = recurrenceWindowEnd(from, rec, dueAt);
  if (!to || to < from) return [];
  const dates = [];
  if (rec.kind === "weekly") {
    const wanted = new Set(rec.weekdays?.length ? rec.weekdays : (rec.weekday != null ? [rec.weekday] : []));
    if (!wanted.size) return [];
    for (let day = from; day && day <= to; day = addCalendarDays(day, 1)) {
      const dt = dateFromIsoDay(day);
      if (dt && wanted.has(dt.getDay())) dates.push(day);
      if (dates.length >= TASK_RECURRENCE_MAX) break;
    }
  } else if (rec.kind === "selected_dates") {
    const wanted = new Set(rec.dates || []);
    if (!wanted.size) return [];
    for (const day of [...wanted].sort()) {
      if (day < from || day > to) continue;
      dates.push(day);
      if (dates.length >= TASK_RECURRENCE_MAX) break;
    }
  } else if (rec.kind === "monthly_weekday") {
    if (rec.weekday == null || rec.timesPerMonth == null) return [];
    const seen = {};
    for (let day = from; day && day <= to; day = addCalendarDays(day, 1)) {
      const dt = dateFromIsoDay(day);
      if (!dt || dt.getDay() !== rec.weekday) continue;
      const ym = day.slice(0, 7);
      seen[ym] = (seen[ym] || 0) + 1;
      if (seen[ym] <= rec.timesPerMonth) dates.push(day);
      if (dates.length >= TASK_RECURRENCE_MAX) break;
    }
  } else if (rec.kind === "monthly_dates") {
    const wanted = new Set(rec.monthDays);
    if (!wanted.size) return [];
    for (let day = from; day && day <= to; day = addCalendarDays(day, 1)) {
      if (wanted.has(Number(day.slice(8, 10)))) dates.push(day);
      if (dates.length >= TASK_RECURRENCE_MAX) break;
    }
  }
  return dates.map((day) => ({ startAt: day, dueAt: day }));
}

export function checkTaskRecurrenceGate(recurrence, opts = {}) {
  const rec = normalizeTaskRecurrence(recurrence);
  if (rec.kind === "once") {
    return { ok: true, windows: expandTaskRecurrence(rec, opts), recurrence: rec };
  }
  if (rec.kind === "weekly" && !(rec.weekdays?.length || rec.weekday != null)) {
    return {
      ok: false,
      error: "RECURRENCE_WEEKDAY_REQUIRED",
      reason: "حدّد أيام الأسبوع للمهمة.",
      reasonEn: "Pick the weekdays for the task.",
      windows: [],
    };
  }
  if (rec.kind === "monthly_weekday" && rec.weekday == null) {
    return {
      ok: false,
      error: "RECURRENCE_WEEKDAY_REQUIRED",
      reason: "حدّد يوم الأسبوع للمهمة المتكررة.",
      reasonEn: "Pick a weekday for the repeating task.",
      windows: [],
    };
  }
  if (rec.kind === "selected_dates" && !(rec.dates || []).length) {
    return {
      ok: false,
      error: "RECURRENCE_DAY_REQUIRED",
      reason: "حدّد الأيام داخل الفترة.",
      reasonEn: "Pick the days inside the date range.",
      windows: [],
    };
  }
  if (rec.kind === "monthly_weekday" && rec.timesPerMonth == null) {
    return {
      ok: false,
      error: "RECURRENCE_TIMES_REQUIRED",
      reason: "اكتب كم مرة في الشهر تتكرر المهمة.",
      reasonEn: "Enter how many times per month the task repeats.",
      windows: [],
    };
  }
  if (rec.kind === "monthly_dates" && !rec.monthDays.length) {
    return {
      ok: false,
      error: "RECURRENCE_DAY_REQUIRED",
      reason: "حدّد أيام الشهر التي تتكرر فيها المهمة.",
      reasonEn: "Pick the month days the task repeats on.",
      windows: [],
    };
  }
  const windows = expandTaskRecurrence(rec, opts);
  if (!windows.length) {
    return {
      ok: false,
      error: "RECURRENCE_EMPTY",
      reason: "لا مواعيد في هذه المدة من تاريخ البدء.",
      reasonEn: "No dates fall in this window from the start date.",
      windows: [],
    };
  }
  return { ok: true, windows, recurrence: rec };
}

export function taskRecurrenceLabel(rec, ar = true) {
  const row = normalizeTaskRecurrence(rec);
  if (row.kind === "once") return "";
  const occ = rec?.occurrence && rec?.occurrenceCount
    ? (ar ? `${rec.occurrence} من ${rec.occurrenceCount}` : `${rec.occurrence} of ${rec.occurrenceCount}`)
    : "";
  const tail = occ ? (ar ? ` · ${occ}` : ` · ${occ}`) : "";
  const weekdayNames = (ids) => (ids || [])
    .map((id) => WEEKDAY_OPTIONS.find((w) => w.id === id))
    .filter(Boolean)
    .map((d) => (ar ? d.ar : d.en));
  if (row.kind === "weekly") {
    const names = weekdayNames(row.weekdays?.length ? row.weekdays : (row.weekday != null ? [row.weekday] : []));
    const joined = names.join(ar ? "، " : ", ");
    return ar ? `كل ${joined}${tail}` : `Every ${joined}${tail}`;
  }
  if (row.kind === "selected_dates") {
    const n = (row.dates || []).length;
    return ar ? `${n} أيام محددة${tail}` : `${n} selected days${tail}`;
  }
  const day = WEEKDAY_OPTIONS.find((w) => w.id === row.weekday);
  const dayName = day ? (ar ? day.ar : day.en) : "";
  if (row.kind === "monthly_weekday") {
    const n = row.timesPerMonth || 0;
    return ar
      ? (n === 1 ? `مرة في الشهر · ${dayName}${tail}` : `${n} مرات في الشهر · ${dayName}${tail}`)
      : `${n}× a month · ${dayName}${tail}`;
  }
  if (row.kind === "monthly_dates") {
    const days = (row.monthDays || []).join(ar ? "، " : ", ");
    return ar ? `أيام ${days} من الشهر${tail}` : `Days ${days} of the month${tail}`;
  }
  return "";
}

export function isOverdue(task, today = new Date()) {
  if (!task.dueAt) return false;
  if (isOpsTaskDeleted(task) || task.status === "completed" || task.approvedAt) return false;
  return dayDiffFromToday(task.dueAt, today) < 0;
}

export function isDueToday(task, today = new Date()) {
  if (!task.dueAt) return false;
  return dayDiffFromToday(task.dueAt, today) === 0;
}

export function isAwaitingApproval(task) {
  if (task.status === "awaiting_approval" || task.status === "pending_review") return true;
  const done = Number(task.completedCount) || 0;
  const target = Math.max(1, Number(task.targetCount) || 1);
  return done >= target && !task.approvedAt && task.status !== "completed";
}

export function isDone(task) {
  return task.status === "completed" || !!task.approvedAt;
}

export function isOpsTaskDeleted(task) {
  return Boolean(task?.deletedAt) || task?.status === "cancelled";
}

export function isOpsTaskArchived(task) {
  return isOpsTaskDeleted(task) || isDone(task);
}

export function isEscalated(task) {
  return (Number(task?.escalationLevel) || 0) > 0 && !isDone(task);
}

/** Fallback ladder when the company has no custom HR tiers. */
export const OPS_ROLE_LADDER = ["station_manager", "pgm", "ops_manager", "director", "owner"];

function personId(p) {
  return p?.id || p?.employeeId || null;
}

function opsHrGroups(data) {
  const levels = Array.isArray(data?.hrLevels) ? data.hrLevels : [];
  const orders = [...new Set(levels.map((l) => l.order))].sort((a, b) => a - b);
  return orders
    .map((order) => ({
      order,
      scope: levels.find((l) => l.order === order)?.scope || "company",
      manager: levels.find((l) => l.order === order && l.role === "manager") || null,
    }))
    .filter((g) => g.manager && g.manager.active !== false);
}

export function opsStageCount(data, stationId) {
  const branch = deriveBranchEscalationChain(stationId || null, data);
  if (branch.length) return branch.length;
  const hr = opsHrGroups(data).length;
  return hr > 0 ? hr + 1 : OPS_ROLE_LADDER.length;
}

export function opsHandlersAt(levelIdx, task, data) {
  const employees = Array.isArray(data?.employees) ? data.employees : [];
  const stationId = task?.stationId || null;
  const branch = deriveBranchEscalationChain(stationId, data);
  if (branch.length) {
    const step = branch[levelIdx];
    if (!step) return [];
    return employees.filter((e) => String(e.id || e.employeeId) === String(step.employeeId));
  }
  const groups = opsHrGroups(data);
  if (groups.length) {
    if (levelIdx === 0) {
      return employees.filter((e) => (
        e.role === "station_manager"
        && userCoversStation(e, data, stationId)
      ));
    }
    const group = groups[levelIdx - 1];
    if (!group?.manager) return [];
    return employees.filter((e) => {
      if (e.hrLevelId !== group.manager.id) return false;
      if (group.manager.stationIds?.length && stationId && !group.manager.stationIds.includes(stationId)) return false;
      if (group.scope === "station") return e.hrStationId === stationId;
      if (group.scope === "cluster") {
        const cluster = (data.hrClusters || []).find((c) => (c.stationIds || []).includes(stationId));
        return cluster ? e.hrClusterId === cluster.id : false;
      }
      return true;
    });
  }
  const role = OPS_ROLE_LADDER[levelIdx];
  if (!role) return [];
  return employees.filter((e) => {
    const isOwner = e.role === "owner" || e.isOwner;
    if (role === "owner") return isOwner;
    if (e.role !== role) return false;
    if (role === "station_manager") {
      return !stationId || userCoversStation(e, data, stationId);
    }
    return true;
  });
}

export function nextOpsEscalation(task, data, rejecterId) {
  const current = Math.max(0, Number(task?.escalationLevel) || 0);
  const stages = opsStageCount(data, task?.stationId);
  for (let lvl = current + 1; lvl < stages; lvl += 1) {
    const handlers = opsHandlersAt(lvl, task, data);
    const others = rejecterId
      ? handlers.filter((h) => String(personId(h)) !== String(rejecterId))
      : handlers;
    if (others.length) {
      return { escalate: true, nextLevel: lvl, handlers: others, atTop: false };
    }
  }
  return { escalate: false, nextLevel: current, handlers: [], atTop: true };
}

export function checkRejectReasonGate(reason, lang = "ar") {
  if (!String(reason || "").trim()) {
    return {
      ok: false,
      error: "REASON_REQUIRED",
      reason: lang === "ar" ? "اكتب سبب الرفض — لا رفض بلا سبب مكتوب." : "Write a rejection reason — no silent reject.",
    };
  }
  return { ok: true };
}

export function applyOpsReject(task, { reason, escalate, nextLevel, reviewerId, reviewerName, now } = {}) {
  const at = now || new Date().toISOString();
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const rejectCount = opsRejectionCount(task) + 1;
  const entry = {
    id: `rej_${at}`,
    authorId: reviewerId || null,
    authorName: reviewerName || "",
    text: String(reason || "").trim(),
    isIssue: false,
    is_rejection: true,
    is_escalation: !!escalate,
    at,
  };
  if (escalate) {
    return {
      ...task,
      status: "awaiting_approval",
      rejectCount,
      escalationLevel: nextLevel,
      rejectReason: entry.text,
      escalatedAt: at,
      comments: [...comments, entry],
    };
  }
  return {
    ...task,
    status: "active",
    rejectCount,
    completedCount: Math.max(0, (Number(task.completedCount) || 0) - 1),
    rejectReason: entry.text,
    comments: [...comments, entry],
    approvedAt: null,
  };
}

export const OPS_EMPLOYEE_ESCALATE_AFTER = 3;

export function opsRejectionCount(task) {
  const stored = Math.max(0, Math.round(Number(task?.rejectCount) || 0));
  const fromComments = (Array.isArray(task?.comments) ? task.comments : [])
    .filter((c) => c && c.is_rejection)
    .length;
  return Math.max(stored, fromComments);
}

export function isOpsTaskAssignee(task, user) {
  const uid = String(user?.id || user?.employeeId || "");
  if (!uid || !task) return false;
  if (String(taskAssigneeId(task) || "") === uid) return true;
  const members = Array.isArray(task.memberIds) ? task.memberIds.map(String) : [];
  return members.includes(uid);
}

/** Own task, named group member, or whole-station assignment on the viewer's branch. */
export function canSeeOpsTask(task, user, { isManager = false } = {}) {
  if (!task || !user) return false;
  if (isManager) return true;
  if (isOpsTaskAssignee(task, user)) return true;
  if (String(task.assignMode || "") === "all") {
    const home = String(user.stationId || user.station_id || "");
    return !!(home && home === String(task.stationId || ""));
  }
  return false;
}

export function canEmployeeEscalateOpsTask(task, user, data) {
  if (!task || isDone(task) || isOpsTaskDeleted(task)) return false;
  if (isAwaitingApproval(task)) return false;
  if (!isOpsTaskAssignee(task, user)) return false;
  if (opsRejectionCount(task) < OPS_EMPLOYEE_ESCALATE_AFTER) return false;
  return nextOpsEscalation(task, data).escalate;
}

export function applyOpsEmployeeEscalate(task, { reason, nextLevel, actorId, actorName, now } = {}) {
  const at = now || new Date().toISOString();
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const text = String(reason || "").trim() || "تصعيد من المنفّذ بعد ثلاثة رفض.";
  return {
    ...task,
    status: "awaiting_approval",
    escalationLevel: nextLevel,
    escalatedAt: at,
    employeeEscalatedAt: at,
    comments: [...comments, {
      id: `esc_${at}`,
      authorId: actorId || null,
      authorName: actorName || "",
      text,
      isIssue: false,
      is_rejection: false,
      is_escalation: true,
      kind: "employee_escalate",
      at,
    }],
  };
}

export function canReviewOpsTask(task, user, data) {
  if (!user || !task || isDone(task)) return false;
  if (user.isOwner || user.admin || user.role === "owner" || user.role === "admin") return true;
  const uid = String(user.id || user.employeeId || "");
  const branch = deriveBranchEscalationChain(task.stationId, data);
  if (branch.length && uid) {
    const level = Math.max(0, Number(task.escalationLevel) || 0);
    return branch.slice(level).some((s) => String(s.employeeId) === uid);
  }
  const level = Math.max(0, Number(task.escalationLevel) || 0);
  const handlers = opsHandlersAt(level, task, data);
  if (uid && handlers.some((h) => String(personId(h)) === uid)) return true;
  const role = user.role;
  if (level === 0 && ["director", "ops_manager", "station_manager", "pgm"].includes(role)) {
    if (role === "station_manager") {
      return !task.stationId || userCoversStation(user, data, task.stationId);
    }
    return true;
  }
  if (level > 0 && ["director", "ops_manager", "pgm"].includes(role)) return true;
  return false;
}

export function deriveOpsCounts(tasks, today = new Date()) {
  const raw = Array.isArray(tasks) ? tasks : [];
  const kept = raw.filter((t) => !isOpsTaskDeleted(t));
  const list = kept.filter((t) => !isDone(t));
  const done = kept.filter(isDone).length;
  const overdue = list.filter((t) => isOverdue(t, today)).length;
  const dueToday = list.filter((t) => isDueToday(t, today)).length;
  const awaiting = list.filter(isAwaitingApproval).length;
  const escalated = list.filter(isEscalated).length;
  return {
    total: list.length,
    done,
    overdue,
    today: dueToday,
    awaiting,
    escalated,
    active: list.length,
    badge: overdue + awaiting,
    pointsAwarded: kept.reduce((n, t) => n + (Number(t.pointsAwarded) || 0), 0),
  };
}

export function deriveHorizonGroups(tasks, today = new Date()) {
  const order = ["y", "h", "q", "m", "w"];
  const list = Array.isArray(tasks) ? tasks : [];
  return order.map((id) => {
    const rows = list.filter((t) => taskPlanHorizon(t, today) === id);
    const units = rows.reduce(
      (acc, t) => ({
        done: acc.done + (Number(t.completedCount) || 0),
        target: acc.target + Math.max(1, Number(t.targetCount) || 1),
      }),
      { done: 0, target: 0 },
    );
    const pct = units.target ? Math.round((units.done / units.target) * 100) : 0;
    return { id, count: rows.length, unitsDone: units.done, unitsTarget: units.target, pct };
  });
}

export function certCodeOf(cert) {
  if (!cert) return "";
  const raw = String(cert.code || cert.kind || cert.certCode || cert.category || cert.name || "").toLowerCase();
  if (["fa", "first_aid", "first-aid", "إسعاف"].some((k) => raw.includes(k.replace("_", "")))) return "fa";
  if (raw.includes("loto") || raw.includes("عزل")) return "loto";
  if (raw.includes("wah") || raw.includes("ارتفاع") || raw.includes("height")) return "wah";
  if (raw.includes("cs") || raw.includes("محصور") || raw.includes("confined")) return "cs";
  if (CERT_FOR[raw] !== undefined || CERT_LABELS[raw]) return raw;
  return raw;
}

export function certIsCurrent(cert, today = new Date()) {
  if (!cert) return false;
  const status = String(cert.status || "approved").toLowerCase();
  if (status === "rejected" || status === "pending" || status === "expired") return false;
  const exp = cert.expiryDate || cert.expiresAt || cert.exp || cert.validUntil;
  if (!exp) return status === "approved" || status === "valid" || status === "active" || !cert.status;
  const end = new Date(`${String(exp).slice(0, 10)}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() >= localDayStart(today).getTime();
}

export function employeeLacksCert(employee, required, today = new Date()) {
  if (!required) return false;
  const certs = Array.isArray(employee?.certificates) ? employee.certificates : [];
  return !certs.some((c) => certCodeOf(c) === required && certIsCurrent(c, today));
}

/** Home workplace of an employee — not the executing station of a task. */
export function employeeHomeStationId(person) {
  return String(person?.homeStationId || person?.stationId || person?.station_id || "").trim();
}

/**
 * Temporary dispatch: employee keeps their home branch; the task executes elsewhere.
 * Not an HR transfer.
 */
export function opsVisitorStamp(person, executeStationId) {
  const homeStationId = employeeHomeStationId(person);
  const execute = String(executeStationId || "").trim();
  const visitor = !!(homeStationId && execute && homeStationId !== execute);
  return { homeStationId: homeStationId || null, visitor };
}

export function isOpsVisitorTask(task) {
  if (!task) return false;
  const stamp = opsVisitorStamp(
    { homeStationId: task.homeStationId, stationId: task.homeStationId, visitor: task.visitor },
    task.stationId,
  );
  return stamp.visitor === true;
}

/** Who the work order is for: one person, several people, or the whole station. */
export function taskAssignScope(task) {
  const mode = String(task?.assignMode || "one");
  if (mode === "all") return "station";
  if (mode === "some") {
    const n = (Array.isArray(task?.memberIds) ? task.memberIds : []).filter(Boolean).length;
    return n === 1 ? "person" : "group";
  }
  return "person";
}

export function taskAssignScopeLabel(task, ar = true) {
  const scope = taskAssignScope(task);
  if (scope === "station") return ar ? "الفرع" : "Station";
  if (scope === "group") return ar ? "عدة أشخاص" : "Several people";
  return ar ? "شخص" : "Person";
}

export function taskAssigneeIds(task) {
  const members = (Array.isArray(task?.memberIds) ? task.memberIds : []).map(String).filter(Boolean);
  const mode = String(task?.assignMode || "one");
  if ((mode === "some" || mode === "all") && members.length) {
    return [...new Set(members)];
  }
  const owner = String(task?.ownerId || task?.employee_id || task?.assignedTo || "").trim();
  if (owner) return [owner];
  return [...new Set(members)];
}

export function taskAssigneePeople(task, people = []) {
  const ids = taskAssigneeIds(task);
  const out = [];
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const hit = matchOpsPerson(people, id);
    out.push({ id, name: String(hit?.name || "").trim() || id });
  }
  if (!out.length && String(task?.ownerName || "").trim()) {
    out.push({ id: String(task?.ownerId || "owner"), name: String(task.ownerName).trim() });
  }
  return out;
}

export function taskPeopleCountLabel(count, ar = true) {
  const n = Math.max(0, Number(count) || 0);
  if (!ar) return n === 1 ? "1 person" : `${n} people`;
  if (n === 0) return "لا أحد";
  if (n === 1) return "1 شخص";
  if (n === 2) return "شخصان";
  if (n >= 3 && n <= 10) return `${n} أشخاص`;
  return `${n} شخصًا`;
}

function matchOpsPerson(people, id) {
  const want = String(id || "").trim();
  if (!want) return null;
  return (people || []).find((person) => (
    String(person?.id || "") === want || String(person?.employeeId || "") === want
  )) || null;
}

export function taskCreatorName(task, people = []) {
  const named = String(task?.createdByName || "").trim();
  if (named) return named;
  const fromLog = (Array.isArray(task?.actionLog) ? task.actionLog : []).find((entry) => entry?.type === "create");
  const logName = String(fromLog?.byName || "").trim();
  if (logName) return logName;
  return String(matchOpsPerson(people, task?.createdBy)?.name || "").trim();
}

/**
 * Assignment gate (same rules as server). Validates that an owner/team exists
 * in the company. Expired competency certificates are informational only.
 */
export function checkAssignGate(input) {
  const required = CERT_FOR[input.workKind] ?? null;
  const lang = input.lang === "en" ? "en" : "ar";
  if (!required) return { ok: true, required: null, blocked: [] };

  const label = CERT_LABELS[required]?.[lang] || required;
  const byId = new Map();
  for (const p of input.people || []) {
    if (p.employeeId) byId.set(String(p.employeeId), p);
    if (p.id) byId.set(String(p.id), p);
  }

  if (input.assignMode === "one") {
    if (!input.ownerId) {
      return {
        ok: false,
        required,
        blocked: [],
        reason: lang === "ar" ? "لا يمكن الإسناد: لم يُحدَّد مسؤول." : "Cannot assign: no owner selected.",
        certLabel: label,
      };
    }
    if (!byId.get(input.ownerId)) {
      return {
        ok: false,
        required,
        blocked: [],
        reason: lang === "ar"
          ? "لا يمكن الإسناد: المسؤول ليس ضمن موظفي هذه الشركة."
          : "Cannot assign: owner is not an employee of this company.",
        certLabel: label,
      };
    }
  } else if (input.assignMode === "some") {
    const ids = input.memberIds || [];
    if (!ids.length) {
      return {
        ok: false,
        required,
        blocked: [],
        reason: lang === "ar" ? "لا يمكن الإسناد: لم يُختَر أحد من الفريق." : "Cannot assign: no team members selected.",
        certLabel: label,
      };
    }
    if (ids.some((id) => !byId.has(id))) {
      return {
        ok: false,
        required,
        blocked: [],
        reason: lang === "ar"
          ? "لا يمكن الإسناد: أحد المحددين ليس ضمن موظفي هذه الشركة."
          : "Cannot assign: a selected member is not an employee of this company.",
        certLabel: label,
      };
    }
  } else if (!input.people.length) {
    return {
      ok: false,
      required,
      blocked: [],
      reason: lang === "ar" ? "لا يمكن الإسناد: لا طاقم في هذا الفرع." : "Cannot assign: no crew at this station.",
      certLabel: label,
    };
  }

  return { ok: true, required, blocked: [], certLabel: label };
}

export function taskAssigneeId(task) {
  return task?.ownerId || task?.employee_id || task?.assignedTo || null;
}

export function latestAssignment(task) {
  const hist = Array.isArray(task?.assignmentHistory) ? task.assignmentHistory : [];
  return hist.length ? hist[hist.length - 1] : null;
}

/** YYYY-MM-DD for the latest delegation start, if any. */
export function taskDelegatedAt(task) {
  const direct = String(task?.delegatedAt || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const entry = latestOpenDelegation(task) || latestAssignment(task);
  const fromEntry = String(entry?.delegatedAt || entry?.at || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(fromEntry) ? fromEntry : "";
}

/** Last delegate/acting entry that has not been closed by a following end. */
export function latestOpenDelegation(task) {
  const hist = Array.isArray(task?.assignmentHistory) ? task.assignmentHistory : [];
  for (let i = hist.length - 1; i >= 0; i -= 1) {
    const e = hist[i];
    if (!e) continue;
    if (e.kind === "end") return null;
    if (e.kind === "transfer") return null;
    if (e.kind === "delegate" || e.kind === "acting" || e.delegatedAt) return e;
  }
  return null;
}

/** Reference block for the task card: start, planned end, actual end, parties. */
export function taskDelegationMeta(task) {
  const hist = Array.isArray(task?.assignmentHistory) ? task.assignmentHistory : [];
  let open = null;
  let ended = null;
  for (let i = hist.length - 1; i >= 0; i -= 1) {
    const e = hist[i];
    if (!e) continue;
    if (!ended && e.kind === "end") {
      ended = e;
      continue;
    }
    if (!open && (e.kind === "delegate" || e.kind === "acting" || (e.delegatedAt && e.kind !== "transfer" && e.kind !== "end"))) {
      open = e;
      break;
    }
  }
  if (!open && !task?.delegatedAt && !ended) return null;
  const start = String(task?.delegatedAt || open?.delegatedAt || open?.at || ended?.delegatedAt || "").slice(0, 10);
  const end = String(task?.actingUntil || open?.actingUntil || ended?.actingUntil || "").slice(0, 10);
  const endedAt = String(task?.delegationEndedAt || ended?.endedAt || (ended ? String(ended.at || "").slice(0, 10) : "") || "").slice(0, 10);
  const active = !!(start && !endedAt && task?.delegationActive !== false && latestOpenDelegation(task));
  return {
    start: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : "",
    end: /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : "",
    endedAt: /^\d{4}-\d{2}-\d{2}$/.test(endedAt) ? endedAt : "",
    active,
    byId: task?.delegationById || open?.byId || null,
    byName: task?.delegationByName || open?.byName || ended?.byName || "",
    fromId: open?.fromId || task?.originalOwnerId || null,
    fromName: open?.fromName || "",
    toId: open?.toId || null,
    toName: open?.toName || task?.ownerName || "",
    reason: open?.reason || "",
  };
}

function stampLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16).replace("T", " ");
  return raw.slice(0, 10);
}

function formatAuditWhen(iso) {
  const raw = String(iso || "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return stampLabel(raw);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeHistoryKind(kind) {
  const raw = String(kind || "").trim();
  if (raw === "transfer" || raw === "ownership_transfer") return "transfer";
  if (raw === "acting") return "acting";
  if (raw === "end" || raw === "end_delegation") return "end";
  if (raw === "members" || raw === "set_members") return "members";
  if (raw === "delegate") return "delegate";
  return raw || "delegate";
}

export function assignmentHistoryNote(entry, lang = "ar") {
  if (!entry) return "";
  const from = entry.fromName || "—";
  const to = entry.toName || "—";
  const reason = String(entry.reason || "").trim();
  const kind = normalizeHistoryKind(entry.kind);
  const until = stampLabel(entry.actingUntil);
  const when = stampLabel(entry.delegatedAt || entry.transferredAt || entry.at);
  const ended = String(entry.endedAt || (kind === "end" ? entry.at : "") || "").slice(0, 10);
  if (lang === "en") {
    if (kind === "members") {
      const base = reason
        ? `Assignees changed from ${from} to ${to} — ${reason}`
        : `Assignees changed from ${from} to ${to}`;
      return when ? `${base} · ${when}` : base;
    }
    if (kind === "end") {
      const base = reason
        ? `Delegation ended — returned from ${from} to ${to} — ${reason}`
        : `Delegation ended — returned from ${from} to ${to}`;
      return ended ? `${base} · ${ended}` : base;
    }
    if (kind === "transfer") {
      const base = reason
        ? `Ownership transferred from ${from} to ${to} — ${reason}`
        : `Ownership transferred from ${from} to ${to}`;
      const by = entry.byName ? ` · by ${entry.byName}` : "";
      return when ? `${base}${by} · ${when}` : `${base}${by}`;
    }
    if (kind === "acting" || kind === "delegate") {
      const base = reason
        ? `Delegated from ${from} to ${to} — ${reason}`
        : `Delegated from ${from} to ${to}`;
      const range = when && until ? `${when} → ${until}` : (when || until);
      return range ? `${base} · ${range}` : base;
    }
    return reason ? `Delegated from ${from} to ${to} — ${reason}` : `Delegated from ${from} to ${to}`;
  }
  if (kind === "members") {
    const base = reason
      ? `تغيّر المسندون من ${from} إلى ${to} — ${reason}`
      : `تغيّر المسندون من ${from} إلى ${to}`;
    return when ? `${base} · ${when}` : base;
  }
  if (kind === "end") {
    const base = reason
      ? `أُنهيت الوكالة — عادت من ${from} إلى ${to} — ${reason}`
      : `أُنهيت الوكالة — عادت من ${from} إلى ${to}`;
    return ended ? `${base} · ${ended}` : base;
  }
  if (kind === "transfer") {
    const base = reason
      ? `نُقلت الملكية من ${from} إلى ${to} — ${reason}`
      : `نُقلت الملكية من ${from} إلى ${to}`;
    const by = entry.byName ? ` · بواسطة ${entry.byName}` : "";
    return when ? `${base}${by} · ${when}` : `${base}${by}`;
  }
  if (kind === "acting" || kind === "delegate") {
    const base = reason
      ? `وُكِّل من ${from} إلى ${to} — ${reason}`
      : `وُكِّل من ${from} إلى ${to}`;
    const range = when && until ? `${when} → ${until}` : (when || until);
    return range ? `${base} · ${range}` : base;
  }
  return reason ? `وُكِّل من ${from} إلى ${to} — ${reason}` : `وُكِّل من ${from} إلى ${to}`;
}

/** Manager-only توكيل. Closed / approved / awaiting-review tasks stay on the proof chain. */
export function canReassignOpsTask(task, user, data) {
  if (!user || !task) return false;
  if (isDone(task) || isAwaitingApproval(task)) return false;
  const uid = user.id || user.employeeId;
  const isOwner = user.role === "owner" || user.isOwner || user.admin
    || (data?.ownerId && uid && String(uid) === String(data.ownerId));
  if (isOwner) return true;
  if (!["director", "ops_manager", "pgm", "station_manager"].includes(user.role)) return false;
  if (user.role === "station_manager") {
    const sid = task.stationId;
    if (!sid) return true;
    if (userCoversStation(user, data, sid)) return true;
    return (data?.stations || []).some((s) => {
      const id = s.id || s.stationId;
      return id === sid && uid && s.managerId && String(s.managerId) === String(uid);
    });
  }
  return true;
}

export function checkReassignGate(input) {
  const lang = input.lang === "en" ? "en" : "ar";
  const task = input.task;
  const user = input.user;
  const toId = String(input.toId || "").trim();
  const reason = String(input.reason || "").trim();
  const kind = input.kind === "transfer"
    ? "transfer"
    : (input.kind === "acting" ? "acting" : "delegate");
  const actingUntilRaw = String(input.actingUntil || "").trim().slice(0, 10);
  const actingUntil = /^\d{4}-\d{2}-\d{2}$/.test(actingUntilRaw) ? actingUntilRaw : "";
  const delegatedAtRaw = String(input.delegatedAt || "").trim().slice(0, 10);
  const delegatedAt = /^\d{4}-\d{2}-\d{2}$/.test(delegatedAtRaw) ? delegatedAtRaw : "";
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  if (!canReassignOpsTask(task, user, input.data)) {
    return {
      ok: false,
      error: "REASSIGN_FORBIDDEN",
      reason: lang === "ar"
        ? "التوكيل للمدير فقط — وبعد الإنجاز أو الاعتماد لا يُعاد إسناد المهمة."
        : "Only a manager can delegate, and a completed or approved task cannot be reassigned.",
    };
  }
  if (!reason) {
    return {
      ok: false,
      error: "REASON_REQUIRED",
      reason: lang === "ar"
        ? "اكتب سبب التوكيل أو النقل."
        : "Write why the task is being reassigned.",
    };
  }
  if (!toId) {
    return {
      ok: false,
      error: "ASSIGNEE_REQUIRED",
      reason: lang === "ar" ? "اختر الموظف المستلم." : "Pick the receiving employee.",
    };
  }
  if (kind !== "transfer" && !delegatedAt) {
    return {
      ok: false,
      error: "DELEGATED_AT_REQUIRED",
      reason: lang === "ar"
        ? "حدّد بداية التوكيل."
        : "Set when the delegation starts.",
    };
  }
  if (kind === "transfer" && !delegatedAt) {
    return {
      ok: false,
      error: "TRANSFER_DATE_REQUIRED",
      reason: lang === "ar"
        ? "حدّد تاريخ النقل."
        : "Set the transfer date.",
    };
  }
  if (kind !== "transfer" && !actingUntil) {
    return {
      ok: false,
      error: "ACTING_UNTIL_REQUIRED",
      reason: lang === "ar"
        ? "حدّد نهاية التوكيل."
        : "Set when the delegation ends.",
    };
  }
  if (kind !== "transfer" && delegatedAt && actingUntil && actingUntil < delegatedAt) {
    return {
      ok: false,
      error: "ACTING_UNTIL_INVALID",
      reason: lang === "ar"
        ? "نهاية التوكيل يجب أن تكون في يوم البداية أو بعده."
        : "Delegation end must be on or after the start date.",
    };
  }
  if (kind !== "transfer" && actingUntil && actingUntil < todayKey) {
    return {
      ok: false,
      error: "ACTING_UNTIL_INVALID",
      reason: lang === "ar"
        ? "نهاية التوكيل يجب أن تكون اليوم أو لاحقًا."
        : "Delegation end must be today or later.",
    };
  }
  const fromId = String(taskAssigneeId(task) || "");
  if (fromId && fromId === toId) {
    return {
      ok: false,
      error: "SELF_REASSIGN_FORBIDDEN",
      reason: lang === "ar" ? "لا توكيل إلى نفس المسؤول الحالي." : "Cannot delegate to the current assignee.",
    };
  }
  const people = Array.isArray(input.people) ? input.people : [];
  if (people.length && !people.some((p) => String(p.employeeId || p.id) === toId)) {
    return {
      ok: false,
      error: "ASSIGNEE_OUT_OF_SCOPE",
      reason: lang === "ar"
        ? "الموظف المختار خارج نطاق الفرع الظاهر."
        : "Selected employee is outside the visible station scope.",
    };
  }
  return {
    ok: true,
    kind,
    delegatedAt,
    actingUntil: kind === "transfer" ? "" : actingUntil,
    fromId: fromId || null,
    toId,
  };
}

export function applyOpsReassign(task, input = {}) {
  const delegatedAtRaw = String(input.delegatedAt || input.at || "").trim().slice(0, 10);
  const delegatedAt = /^\d{4}-\d{2}-\d{2}$/.test(delegatedAtRaw)
    ? delegatedAtRaw
    : new Date().toISOString().slice(0, 10);
  const at = input.at && String(input.at).includes("T")
    ? String(input.at)
    : `${delegatedAt}T12:00:00.000Z`;
  const fromId = input.fromId || taskAssigneeId(task) || null;
  const toId = input.toId;
  const reason = String(input.reason || "").trim();
  const kind = input.kind === "transfer"
    ? "transfer"
    : (input.kind === "acting" ? "acting" : "delegate");
  const untilRaw = String(input.actingUntil || "").trim().slice(0, 10);
  const actingUntil = kind !== "transfer" && /^\d{4}-\d{2}-\d{2}$/.test(untilRaw) ? untilRaw : "";
  const entry = {
    fromId,
    toId,
    byId: input.byId || null,
    reason,
    at,
    kind,
    delegatedAt: kind === "transfer" ? null : delegatedAt,
    transferredAt: kind === "transfer" ? delegatedAt : null,
    actingUntil: actingUntil || null,
    fromName: input.fromName || "",
    toName: input.toName || "",
    byName: input.byName || "",
  };
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const note = assignmentHistoryNote(entry, input.lang === "en" ? "en" : "ar");
  const visit = opsVisitorStamp({
    homeStationId: input.homeStationId,
    stationId: input.toStationId || input.homeStationId,
    visitor: input.visitor,
  }, task.stationId);
  const base = {
    ...task,
    ownerId: toId,
    assignedTo: toId,
    employee_id: toId,
    ownerName: entry.toName || task.ownerName,
    assignMode: "one",
    memberIds: [],
    homeStationId: visit.homeStationId,
    visitor: visit.visitor,
    assignmentHistory: [...(Array.isArray(task.assignmentHistory) ? task.assignmentHistory : []), entry],
    actionLog: [
      ...(Array.isArray(task.actionLog) ? task.actionLog : []),
      {
        id: `act_${at}`,
        type: kind === "transfer" ? "ownership_transfer" : (kind === "acting" ? "acting" : "delegate"),
        at,
        byId: entry.byId,
        byName: entry.byName,
        fromId,
        toId,
        fromName: entry.fromName,
        toName: entry.toName,
        reason,
        delegatedAt: entry.delegatedAt,
        transferredAt: entry.transferredAt,
        actingUntil: actingUntil || null,
      },
    ],
    comments: [...comments, {
      id: `reassign_${at}`,
      authorId: entry.byId,
      authorName: entry.byName,
      text: note,
      isIssue: false,
      is_reassignment: true,
      at,
      delegatedAt: entry.delegatedAt,
      transferredAt: entry.transferredAt,
      actingUntil: actingUntil || null,
    }],
  };
  if (kind === "transfer") {
    return {
      ...base,
      // Permanent ownership — new owner is the proof owner going forward.
      originalOwnerId: toId,
      assignmentKind: "transfer",
      transferredAt: delegatedAt,
      transferredById: input.byId || null,
      transferredByName: input.byName || "",
      delegatedAt: null,
      actingUntil: null,
      delegationActive: false,
      delegationEndedAt: null,
      delegationById: null,
      delegationByName: null,
    };
  }
  return {
    ...base,
    originalOwnerId: task.originalOwnerId || fromId,
    assignmentKind: kind,
    delegatedAt,
    actingUntil: actingUntil || null,
    delegationActive: true,
    delegationEndedAt: null,
    delegationById: input.byId || null,
    delegationByName: input.byName || "",
    transferredAt: task.transferredAt || null,
    transferredById: task.transferredById || null,
    transferredByName: task.transferredByName || null,
  };
}

function sameIdSet(a, b) {
  const left = [...new Set((a || []).map(String).filter(Boolean))].sort();
  const right = [...new Set((b || []).map(String).filter(Boolean))].sort();
  if (left.length !== right.length) return false;
  return left.every((id, i) => id === right[i]);
}

function personNamesJoined(ids, people, lang = "ar") {
  const sep = lang === "en" ? ", " : "، ";
  const names = (ids || []).map((id) => {
    const hit = matchOpsPerson(people, id);
    return String(hit?.name || "").trim() || String(id);
  }).filter(Boolean);
  return names.length ? names.join(sep) : "—";
}

/** Manager may reshape the station team on an open task — not ownership transfer. */
export function checkSetMembersGate(input = {}) {
  const lang = input.lang === "en" ? "en" : "ar";
  const task = input.task;
  const memberIds = [...new Set((input.memberIds || []).map(String).filter(Boolean))];
  if (!canReassignOpsTask(task, input.user, input.data)) {
    return {
      ok: false,
      error: "REASSIGN_FORBIDDEN",
      reason: lang === "ar"
        ? "تغيير المسندين للمدير فقط — وبعد الإنجاز أو الاعتماد لا يُعاد تشكيل الفريق."
        : "Only a manager can change assignees, and a completed or approved task cannot be reshaped.",
    };
  }
  if (!memberIds.length) {
    return {
      ok: false,
      error: "MEMBERS_REQUIRED",
      reason: lang === "ar" ? "اختر شخصًا واحدًا على الأقل." : "Pick at least one person.",
    };
  }
  const people = Array.isArray(input.people) ? input.people : [];
  if (people.length && memberIds.some((id) => !matchOpsPerson(people, id))) {
    return {
      ok: false,
      error: "ASSIGNEE_OUT_OF_SCOPE",
      reason: lang === "ar"
        ? "أحد المحددين خارج طاقم الفرع الظاهر."
        : "A selected member is outside the visible station crew.",
    };
  }
  const current = taskAssigneeIds(task);
  if (sameIdSet(current, memberIds)) {
    return { ok: true, memberIds, unchanged: true };
  }
  return { ok: true, memberIds, unchanged: false };
}

/** Replace the task's assignee list (station-scoped). Owner stays if still on the list. */
export function applyOpsSetMembers(task, input = {}) {
  const memberIds = [...new Set((input.memberIds || []).map(String).filter(Boolean))];
  const people = Array.isArray(input.people) ? input.people : [];
  const lang = input.lang === "en" ? "en" : "ar";
  const prevIds = taskAssigneeIds(task);
  if (!memberIds.length || sameIdSet(prevIds, memberIds)) return task;

  const at = input.at && String(input.at).includes("T")
    ? String(input.at)
    : new Date().toISOString();
  const ownerStill = memberIds.includes(String(task.ownerId || task.employee_id || task.assignedTo || ""));
  const nextOwnerId = ownerStill
    ? String(task.ownerId || task.employee_id || task.assignedTo)
    : memberIds[0];
  const nextOwner = matchOpsPerson(people, nextOwnerId);
  const fromName = personNamesJoined(prevIds, people, lang);
  const toName = personNamesJoined(memberIds, people, lang);
  const entry = {
    fromId: prevIds[0] || null,
    toId: nextOwnerId,
    fromIds: prevIds,
    toIds: memberIds,
    byId: input.byId || null,
    reason: String(input.reason || "").trim(),
    at,
    kind: "members",
    fromName,
    toName,
    byName: input.byName || "",
  };
  const note = assignmentHistoryNote(entry, lang);
  const comments = Array.isArray(task.comments) ? task.comments : [];
  return {
    ...task,
    assignMode: "some",
    memberIds,
    ownerId: nextOwnerId,
    assignedTo: nextOwnerId,
    employee_id: nextOwnerId,
    ownerName: nextOwner?.name || task.ownerName || "",
    assignmentHistory: [...(Array.isArray(task.assignmentHistory) ? task.assignmentHistory : []), entry],
    actionLog: [
      ...(Array.isArray(task.actionLog) ? task.actionLog : []),
      {
        id: `members_${at}`,
        type: "members",
        at,
        byId: entry.byId,
        byName: entry.byName,
        fromIds: prevIds,
        toIds: memberIds,
        fromName,
        toName,
        reason: entry.reason,
      },
    ],
    comments: [...comments, {
      id: `members_${at}`,
      authorId: entry.byId,
      authorName: entry.byName,
      text: note,
      isIssue: false,
      is_reassignment: true,
      at,
    }],
  };
}

/** Latest permanent ownership transfer — reference on the task card. */
export function taskTransferMeta(task) {
  const hist = Array.isArray(task?.assignmentHistory) ? task.assignmentHistory : [];
  let entry = null;
  for (let i = hist.length - 1; i >= 0; i -= 1) {
    if (hist[i]?.kind === "transfer") {
      entry = hist[i];
      break;
    }
  }
  const at = String(task?.transferredAt || entry?.transferredAt || entry?.at || "").slice(0, 10);
  if (!entry && !/^\d{4}-\d{2}-\d{2}$/.test(at) && task?.assignmentKind !== "transfer") return null;
  return {
    at: /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : "",
    byId: task?.transferredById || entry?.byId || null,
    byName: task?.transferredByName || entry?.byName || "",
    fromId: entry?.fromId || null,
    fromName: entry?.fromName || "",
    toId: entry?.toId || task?.ownerId || null,
    toName: entry?.toName || task?.ownerName || "",
    reason: entry?.reason || "",
  };
}

/** الموكِّل (who recorded the open delegation) may end it; managers may too. */
export function canEndOpsDelegation(task, user, data) {
  if (!user || !task) return false;
  if (isDone(task) || isAwaitingApproval(task)) return false;
  const meta = taskDelegationMeta(task);
  if (!meta?.active) return false;
  const uid = String(user.id || user.employeeId || "");
  if (!uid) return false;
  if (meta.byId && String(meta.byId) === uid) return true;
  if (meta.fromId && String(meta.fromId) === uid) return true;
  if (task.originalOwnerId && String(task.originalOwnerId) === uid) return true;
  return canReassignOpsTask(task, user, data);
}

export function checkEndDelegationGate(input) {
  const lang = input.lang === "en" ? "en" : "ar";
  const reason = String(input.reason || "").trim();
  if (!canEndOpsDelegation(input.task, input.user, input.data)) {
    return {
      ok: false,
      error: "END_DELEGATION_FORBIDDEN",
      reason: lang === "ar"
        ? "إنهاء الوكالة للموكِّل أو المدير فقط، وعلى وكالة نشطة."
        : "Only the delegator or a manager can end an active delegation.",
    };
  }
  if (!reason) {
    return {
      ok: false,
      error: "REASON_REQUIRED",
      reason: lang === "ar" ? "اكتب سبب إنهاء الوكالة." : "Write why the delegation is ending.",
    };
  }
  const meta = taskDelegationMeta(input.task);
  const restoreId = String(meta?.fromId || input.task?.originalOwnerId || "").trim();
  if (!restoreId) {
    return {
      ok: false,
      error: "RESTORE_OWNER_MISSING",
      reason: lang === "ar"
        ? "لا يمكن إرجاع المهمة — المالك الأصلي غير معروف."
        : "Cannot restore the task — original owner is unknown.",
    };
  }
  return { ok: true, restoreId, meta };
}

export function applyOpsEndDelegation(task, input = {}) {
  const meta = taskDelegationMeta(task) || {};
  const restoreId = String(input.restoreId || meta.fromId || task.originalOwnerId || "").trim();
  const endedAtRaw = String(input.endedAt || "").trim().slice(0, 10);
  const endedAt = /^\d{4}-\d{2}-\d{2}$/.test(endedAtRaw)
    ? endedAtRaw
    : new Date().toISOString().slice(0, 10);
  const at = `${endedAt}T12:00:00.000Z`;
  const fromId = taskAssigneeId(task);
  const reason = String(input.reason || "").trim();
  const entry = {
    fromId,
    toId: restoreId,
    byId: input.byId || null,
    reason,
    at,
    kind: "end",
    delegatedAt: meta.start || task.delegatedAt || null,
    actingUntil: meta.end || task.actingUntil || null,
    endedAt,
    fromName: input.fromName || meta.toName || task.ownerName || "",
    toName: input.toName || meta.fromName || "",
    byName: input.byName || "",
  };
  const note = assignmentHistoryNote(entry, input.lang === "en" ? "en" : "ar");
  const comments = Array.isArray(task.comments) ? task.comments : [];
  return {
    ...task,
    ownerId: restoreId,
    assignedTo: restoreId,
    employee_id: restoreId,
    ownerName: entry.toName || task.ownerName,
    assignmentKind: null,
    delegationActive: false,
    delegationEndedAt: endedAt,
    // Keep start/end as reference on the card
    delegatedAt: meta.start || task.delegatedAt || null,
    actingUntil: meta.end || task.actingUntil || null,
    assignmentHistory: [...(Array.isArray(task.assignmentHistory) ? task.assignmentHistory : []), entry],
    actionLog: [
      ...(Array.isArray(task.actionLog) ? task.actionLog : []),
      {
        id: `end_deleg_${at}`,
        type: "end_delegation",
        at,
        byId: entry.byId,
        byName: entry.byName,
        fromId,
        toId: restoreId,
        fromName: entry.fromName,
        toName: entry.toName,
        reason,
        delegatedAt: entry.delegatedAt,
        actingUntil: entry.actingUntil,
        endedAt,
      },
    ],
    comments: [...comments, {
      id: `end_deleg_${at}`,
      authorId: entry.byId,
      authorName: entry.byName,
      text: note,
      isIssue: false,
      is_reassignment: true,
      at,
      endedAt,
    }],
  };
}

/** Soft-delete / undo within a short window after create or last action. */
export function canUndoOpsAction(task, { now = Date.now(), windowMs = 3 * 60 * 1000 } = {}) {
  if (!task) return false;
  const created = new Date(task.createdAt || task.created_date || 0).getTime();
  if (Number.isFinite(created) && now - created <= windowMs && !(task.completedCount > 0) && !task.approvedAt) {
    return { ok: true, target: "create" };
  }
  const log = Array.isArray(task.actionLog) ? task.actionLog : [];
  const last = log[log.length - 1];
  if (!last) return false;
  const at = new Date(last.at || 0).getTime();
  if (!Number.isFinite(at) || now - at > windowMs) return false;
  if (["acting", "extend", "comment", "blocker", "delegate"].includes(last.type)) {
    return { ok: true, target: last.type, entry: last };
  }
  return false;
}

export function applyOpsExtendDue(task, input = {}) {
  const at = input.at || new Date().toISOString();
  const nextDue = String(input.dueAt || "").trim();
  const reason = String(input.reason || "").trim();
  let next = {
    ...task,
    dueAt: nextDue || task.dueAt,
    actionLog: [
      ...(Array.isArray(task.actionLog) ? task.actionLog : []),
      {
        id: `ext_${at}`,
        type: "extend",
        at,
        byId: input.byId || null,
        byName: input.byName || "",
        fromDue: task.dueAt || null,
        toDue: nextDue || null,
        reason,
      },
    ],
    comments: [
      ...(Array.isArray(task.comments) ? task.comments : []),
      {
        id: `ext_c_${at}`,
        authorId: input.byId || null,
        authorName: input.byName || "",
        text: input.lang === "en"
          ? `Blocker · due extended to ${nextDue || "—"} — ${reason || "blocker"}`
          : `عائق · مُدّد الموعد إلى ${nextDue || "—"} — ${reason || "عائق"}`,
        isIssue: true,
        at,
      },
    ],
  };
  if (input.resolveBlocker !== false && reason) {
    next = applyOpsPaceBlockerResolve(next, {
      ...input,
      at,
      reason,
      resolution: "extend",
      day: input.blockerDay || input.day,
      expected: input.expected,
      logged: input.logged,
      gap: input.gap,
    });
  }
  return next;
}

/** Re-split current remaining count evenly from today through due. */
export function applyOpsRedistributeRemaining(task, input = {}) {
  const at = input.at || new Date().toISOString();
  const today = isoDayKey(input.paceStartAt || at);
  const target = Math.max(1, Number(task.targetCount) || 1);
  const done = Math.max(0, Number(task.completedCount) || 0);
  const remaining = Math.max(0, target - done);
  const reason = String(input.reason || "").trim();
  let next = {
    ...task,
    paceStartAt: today,
    paceSpreadTarget: remaining,
    paceDayPlan: {},
    actionLog: [
      ...(Array.isArray(task.actionLog) ? task.actionLog : []),
      {
        id: `pace_${at}`,
        type: "redistribute_pace",
        at,
        byId: input.byId || null,
        byName: input.byName || "",
        paceStartAt: today,
        paceSpreadTarget: remaining,
        reason,
      },
    ],
    comments: [
      ...(Array.isArray(task.comments) ? task.comments : []),
      {
        id: `pace_c_${at}`,
        authorId: input.byId || null,
        authorName: input.byName || "",
        text: input.lang === "en"
          ? `Blocker · remainder ${remaining} re-split from ${today} — ${reason || "partial pace"}`
          : `عائق · وُزِّع المتبقي ${remaining} من ${today} — ${reason || "إنجاز جزئي عن الإيقاع"}`,
        isIssue: true,
        at,
      },
    ],
  };
  if (input.resolveBlocker !== false && reason) {
    next = applyOpsPaceBlockerResolve(next, {
      ...input,
      at,
      reason,
      resolution: "redistribute",
      day: input.blockerDay || input.day || today,
      expected: input.expected,
      logged: input.logged,
      gap: input.gap,
    });
  }
  return next;
}

export function canDeleteOpsTask(task, user) {
  if (!task || isOpsTaskDeleted(task) || isDone(task) || isAwaitingApproval(task)) return false;
  const uid = String(user?.id || user?.employeeId || "");
  const creator = String(task.createdBy || "");
  const manager = !!(user && (
    user.role === "owner" || user.isOwner || user.admin
    || ["director", "ops_manager", "pgm", "station_manager"].includes(user.role)
  ));
  if (manager) return true;
  return !!(uid && creator && uid === creator);
}

export function checkDeleteOpsTaskGate(task, user, { now = Date.now(), reason = "", ack = false, undoCreate = false } = {}) {
  if (!task) {
    return {
      ok: false,
      error: "TASK_REQUIRED",
      reason: "المهمة غير موجودة.",
      reasonEn: "The task was not found.",
    };
  }
  if (isOpsTaskDeleted(task)) {
    return {
      ok: false,
      error: "ALREADY_DELETED",
      reason: "المهمة محذوفة أصلًا.",
      reasonEn: "The task is already deleted.",
    };
  }
  if (isDone(task) || isAwaitingApproval(task)) {
    return {
      ok: false,
      error: "PROOF_CHAIN_LOCKED",
      reason: "بعد الاعتماد أو انتظار الاعتماد لا يُحذف الإثبات — يبقى في الأرشيف.",
      reasonEn: "After approval or while awaiting review the proof cannot be deleted — it stays in the archive.",
    };
  }
  const uid = String(user?.id || user?.employeeId || "");
  const creator = String(task.createdBy || "");
  const manager = !!(user && (
    user.role === "owner" || user.isOwner || user.admin
    || ["director", "ops_manager", "pgm", "station_manager"].includes(user.role)
  ));
  if (uid && creator && uid !== creator && !manager) {
    return {
      ok: false,
      error: "DELETE_FORBIDDEN",
      reason: "الحذف لمن أنشأ المهمة أو للمدير.",
      reasonEn: "Only the creator or a manager can delete the task.",
    };
  }
  if (undoCreate) {
    if ((Number(task.completedCount) || 0) > 0) {
      return {
        ok: false,
        error: "REASON_REQUIRED",
        reason: "سُجّل إنجاز جزئي — احذف بسبب وإقرار ليبقى في سجل التدقيق.",
        reasonEn: "Partial completion is logged — delete with a reason and acknowledgement so it stays in the audit trail.",
      };
    }
    const undo = canUndoOpsAction(task, { now });
    if (!undo || undo.target !== "create") {
      return {
        ok: false,
        error: "UNDO_WINDOW_CLOSED",
        reason: "انتهت مهلة الثلاث دقائق للتراجع السريع.",
        reasonEn: "The 3-minute quick-undo window has closed.",
      };
    }
    return { ok: true, target: "create", undoCreate: true };
  }
  const why = String(reason || "").trim();
  if (!why) {
    return {
      ok: false,
      error: "REASON_REQUIRED",
      reason: "اكتب سبب الحذف.",
      reasonEn: "Write the deletion reason.",
    };
  }
  if (!ack) {
    return {
      ok: false,
      error: "ACK_REQUIRED",
      reason: "أقرّ أن الحذف يُبقي المهمة في سجل التدقيق.",
      reasonEn: "Acknowledge that deletion keeps the task in the audit trail.",
    };
  }
  return { ok: true, target: "delete", reason: why };
}

export function buildTaskAuditTimeline(task, lang = "ar") {
  if (!task) return [];
  const ar = lang === "ar";
  const rows = [];
  const seen = new Set();
  const createdAt = task.createdAt || task.created_date;
  if (createdAt) {
    rows.push({
      id: "create",
      type: "create",
      at: createdAt,
      when: formatAuditWhen(createdAt),
      by: task.createdByName || "",
      reason: "",
      tone: "#14284B",
      text: ar
        ? `أُنشئت المهمة${task.createdByName ? ` بواسطة ${task.createdByName}` : ""}`
        : `Task created${task.createdByName ? ` by ${task.createdByName}` : ""}`,
    });
    seen.add(`create|${createdAt}`);
  }

  const pushAssign = (entry, fallbackType) => {
    if (!entry) return;
    const kind = normalizeAssignKind(entry.kind || entry.type || fallbackType);
    if (!kind) return;
    const at = entry.at || entry.delegatedAt || entry.transferredAt || entry.endedAt;
    const key = `${kind}|${at || ""}|${entry.fromId || ""}|${entry.toId || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    const from = entry.fromName || "—";
    const to = entry.toName || "—";
    const reason = String(entry.reason || "").trim();
    const until = stampLabel(entry.actingUntil);
    let text = "";
    let tone = "#B45309";
    if (kind === "end") {
      text = ar
        ? `أُنهيت الوكالة — عادت من ${from} إلى ${to}`
        : `Delegation ended — returned from ${from} to ${to}`;
      tone = "#64748B";
    } else if (kind === "transfer") {
      text = ar
        ? `نُقلت الملكية من ${from} إلى ${to}`
        : `Ownership transferred from ${from} to ${to}`;
      tone = "#B91C1C";
    } else if (kind === "members") {
      text = ar
        ? `تغيّر المسندون من ${from} إلى ${to}`
        : `Assignees changed from ${from} to ${to}`;
      tone = "#0F766E";
    } else {
      text = ar ? `وُكِّل من ${from} إلى ${to}` : `Delegated from ${from} to ${to}`;
      if (until) text = ar ? `${text} حتى ${until}` : `${text} until ${until}`;
    }
    rows.push({
      id: entry.id || `assign_${kind}_${at}`,
      type: kind,
      at,
      when: formatAuditWhen(at),
      by: entry.byName || "",
      reason,
      tone,
      text,
    });
  };

  for (const entry of (Array.isArray(task.assignmentHistory) ? task.assignmentHistory : [])) {
    pushAssign(entry);
  }
  for (const entry of (Array.isArray(task.actionLog) ? task.actionLog : [])) {
    if (!entry || !normalizeAssignKind(entry.type || entry.kind)) continue;
    pushAssign(entry);
  }

  const deleteLog = (Array.isArray(task.actionLog) ? task.actionLog : [])
    .find((entry) => entry && (entry.type === "delete" || entry.type === "undo_create"));
  if (task.deletedAt || deleteLog) {
    const at = task.deletedAt || deleteLog.at;
    const why = String(task.deleteReason || deleteLog?.reason || "").trim();
    const logged = Math.max(0, Number(deleteLog?.loggedCount ?? task.completedCount) || 0);
    const target = Math.max(1, Number(task.targetCount) || 1);
    const who = String(task.deletedByName || deleteLog?.byName || "").trim();
    const byLine = who ? (ar ? ` بواسطة ${who}` : ` by ${who}`) : "";
    let text = ar ? `حُذفت المهمة${byLine}` : `Task deleted${byLine}`;
    if (logged > 0) {
      text = ar
        ? `حُذفت المهمة${byLine} — الإنجاز المسجّل ${logged}/${target} يبقى في السجل`
        : `Task deleted${byLine} — logged progress ${logged}/${target} stays in the record`;
    } else if (deleteLog?.type === "undo_create") {
      text = ar
        ? `حُذفت المهمة ضمن مهلة التراجع${byLine}`
        : `Task deleted within the undo window${byLine}`;
    }
    rows.push({
      id: deleteLog?.id || "deleted",
      type: "delete",
      at,
      when: formatAuditWhen(at),
      by: who,
      reason: why,
      tone: "#DC2626",
      text,
    });
  }

  return rows
    .filter((r) => r.at)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function normalizeAssignKind(type) {
  const raw = String(type || "").trim();
  if (raw === "ownership_transfer" || raw === "transfer") return "transfer";
  if (raw === "end_delegation" || raw === "end") return "end";
  if (raw === "members" || raw === "set_members") return "members";
  if (raw === "acting" || raw === "delegate") return "delegate";
  return "";
}

export function applyOpsSoftDelete(task, input = {}) {
  const at = input.at || new Date().toISOString();
  const why = String(input.reason || "").trim();
  const logged = Math.max(0, Number(task.completedCount) || 0);
  return {
    ...task,
    status: "cancelled",
    deletedAt: at,
    deletedBy: input.byId || null,
    deletedByName: input.byName || "",
    deleteReason: why,
    deleteAck: input.ack !== false,
    actionLog: [
      ...(Array.isArray(task.actionLog) ? task.actionLog : []),
      {
        id: `del_${at}`,
        type: input.undoCreate ? "undo_create" : "delete",
        at,
        byId: input.byId || null,
        byName: input.byName || "",
        reason: why,
        ack: input.ack !== false,
        loggedCount: logged,
      },
    ],
  };
}

/** Riyadh calendar day for escalation sweeps (Asia/Riyadh). */
export function riyadhDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function riyadhHour(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value || 0);
}

/** Riyadh wall clock of an instant — never the browser's zone. */
export function riyadhClock(now = new Date()) {
  const at = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return {
    dayKey: riyadhDayKey(at),
    hour,
    minute,
    minutes: hour * 60 + minute,
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

/**
 * Task nature — three surfaces, not two. `remote` waives the site fingerprint;
 * `field` is open-air work the ministerial sun ban reaches; `onsite` is indoor
 * work at the facility, which the ban does not touch. The work kind cannot
 * stand in for this: the default kind is عام, and an office task would read as
 * open air.
 */
export const TASK_MODES = [
  { id: "onsite", ar: "حضوري داخل المنشأة", en: "On-site · indoors" },
  { id: "field", ar: "ميداني في الهواء الطلق", en: "Field · open air" },
  { id: "remote", ar: "عن بُعد", en: "Remote" },
];

export function normalizeTaskMode(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return TASK_MODES.some((m) => m.id === raw) ? raw : "";
}

export function taskModeLabel(value, lang = "ar") {
  const row = TASK_MODES.find((m) => m.id === normalizeTaskMode(value));
  if (!row) return lang === "ar" ? "طبيعة غير محدَّدة" : "Nature not set";
  return lang === "ar" ? row.ar : row.en;
}

/** The place is stated, never defaulted — a silent onsite would decide the sun ban for the crew. */
export function checkTaskModeGate(value, lang = "ar") {
  const mode = normalizeTaskMode(value);
  if (mode) return { ok: true, mode };
  return {
    ok: false,
    error: "TASK_MODE_REQUIRED",
    reason: "حدِّد مكان التنفيذ: حضوري داخل المنشأة، أو ميداني في الهواء الطلق، أو عن بُعد. الميداني وحده يخضع لحظر العمل تحت أشعة الشمس.",
    reasonEn: "State where the work happens: on-site indoors, field in the open air, or remote. Only field work falls under the midday sun ban.",
    lang,
  };
}

/** Open-air field work — the nature the supervisor chose, not a guess from the work kind. */
export function isOutdoorFieldTask(task) {
  if (!task || typeof task !== "object") return false;
  return normalizeTaskMode(task.mode) === "field";
}

/** Field work is still at a site: only remote waives today's check-in. */
export function taskWaivesSiteAttendance(task) {
  return normalizeTaskMode(task?.mode) === "remote";
}

/**
 * What the chosen place actually costs at logging time — the attendance stamp and
 * the sun ban, with the banned hours named. One source, so the create form, the
 * switch dialog and the task card cannot drift apart.
 */
export function taskModeConsequence(value, { ar = true, onDate } = {}) {
  const mode = normalizeTaskMode(value);
  if (!mode) return "";
  if (mode === "remote") {
    return ar
      ? "لا تُطلب بصمة موقع، والإثبات يبقى مطلوباً عند التسجيل."
      : "No site check-in is required, and proof is still required to log.";
  }
  if (mode === "onsite") {
    return ar
      ? "التسجيل يتطلب بصمة اليوم، وحظر العمل تحت أشعة الشمس لا يسري."
      : "Logging requires today's check-in, and the sun ban does not apply.";
  }
  const win = heatBanWindow(onDate);
  return ar
    ? `التسجيل يتطلب بصمة اليوم، ويُرفض بين ${win.startLabel} و${win.endLabel} ${win.seasonAr} — حظر العمل تحت أشعة الشمس.`
    : `Logging requires today's check-in, and is refused between ${win.startLabel} and ${win.endLabel} ${win.seasonEn} — the sun ban.`;
}

/**
 * Ministerial midday sun ban on the logged unit — Proof Cycle step 2.
 * A logged field unit is a realized fact carrying place and time, so it is
 * refused inside the window. Merely holding a task that spans the window is
 * lawful — the hands may work before it opens or after it closes — so creation
 * only carries the named notice below.
 */
export function checkTaskHeatBanGate(task, { now = new Date(), amount = 1 } = {}) {
  if (Math.max(0, Math.round(Number(amount) || 0)) < 1) return { ok: true, skipped: "no_unit" };
  if (!isOutdoorFieldTask(task)) return { ok: true, skipped: "not_outdoor" };
  const clock = riyadhClock(now);
  if (!clock) return { ok: true, skipped: "no_clock" };
  if (!isHeatBanDate(clock.dayKey)) return { ok: true, skipped: "off_season" };
  if (!isHeatBanMinuteOfDay(clock.minutes, clock.dayKey)) return { ok: true, skipped: "off_window" };
  const win = heatBanWindow(clock.dayKey);
  const badge = explainRule("hours.heat.startHour", clock.dayKey);
  // The hours are decision 3337's; the cited article is only the basis it was issued on.
  const cite = citeRule("hours.heat.cite", clock.dayKey);
  return {
    ok: false,
    error: "HEAT_BAN",
    ruleId: "hours.heat.startHour",
    labelAr: badge?.labelAr || "قرار وزاري",
    labelEn: badge?.labelEn || "Ministerial decision",
    cite,
    dayKey: clock.dayKey,
    at: clock.label,
    window: win,
    reason: `موقوف — حظر العمل تحت أشعة الشمس: لا يُسجَّل إنجاز ميداني بين ${win.startLabel} و${win.endLabel} بتوقيت الرياض ${win.seasonAr}. الوقت الآن ${clock.label}، فسجّل الإنجاز بعد ${win.endLabel}. الساعتان والموسم من ${heatBanDecisionLabel(true)}، الصادر على ${cite?.labelAr || "نظام العمل"}.`,
    reasonEn: `Blocked — midday sun ban: no field completion may be logged between ${win.startLabel} and ${win.endLabel} Riyadh time ${win.seasonEn}. It is now ${clock.label} — log after ${win.endLabel}. The hours and the season come from ${heatBanDecisionLabel(false)}, issued on ${cite?.labelEn || "the Labour Law"}.`,
  };
}

/**
 * Named creation notice — never a block, because holding the task is lawful
 * whatever the clock says. Severity follows the task's own span: `alert` when it
 * touches the ban season, `cite` when it does not, so the open-air place still
 * carries the decision as reference without borrowing an alarm it has not
 * earned. The heavier `block` level belongs to `checkTaskHeatBanGate` alone.
 */
export function deriveTaskHeatBanNotice(task, { startAt, dueAt } = {}) {
  if (!isOutdoorFieldTask(task)) return null;
  const from = isoDayKey(startAt ?? task?.startAt) || isoDayKey(new Date());
  const to = isoDayKey(dueAt ?? task?.dueAt) || from;
  if (!from || !to || to < from) return null;
  let day = from;
  let hit = false;
  for (let guard = 0; guard < 400 && day <= to; guard += 1) {
    if (isHeatBanDate(day)) { hit = true; break; }
    const next = new Date(`${day}T00:00:00`);
    next.setDate(next.getDate() + 1);
    day = isoDayKey(next);
  }
  const onDay = hit ? day : from;
  const win = heatBanWindow(onDay);
  const badge = explainRule("hours.heat.startHour", onDay);
  const cite = citeRule("hours.heat.cite", onDay);
  const shared = {
    ruleId: "hours.heat.startHour",
    labelAr: badge?.labelAr || "قرار وزاري",
    labelEn: badge?.labelEn || "Ministerial decision",
    cite,
    window: win,
    inSeason: hit,
  };
  if (!hit) {
    return {
      ...shared,
      id: "heat_ban_off_season",
      level: HEAT_BAN_STATE_LEVEL.off_season,
      textAr: `مدة هذه المهمة خارج موسم حظر العمل تحت أشعة الشمس ${win.seasonAr}، فلا ساعة موقوفة عليها. النافذة ${win.startLabel}–${win.endLabel} داخل الموسم — ${heatBanDecisionLabel(true)}.`,
      textEn: `This task's window falls outside the sun-ban season ${win.seasonEn}, so no hour on it is stopped. The banned window is ${win.startLabel}–${win.endLabel} inside the season — ${heatBanDecisionLabel(false)}.`,
    };
  }
  return {
    ...shared,
    id: "heat_ban",
    level: HEAT_BAN_STATE_LEVEL.before_window,
    textAr: `مدة هذه المهمة تمسّ موسم حظر العمل تحت أشعة الشمس ${win.seasonAr} — ${heatBanDecisionLabel(true)}. الإسناد جائز، والتنفيذ الميداني خارج ${win.startLabel}–${win.endLabel}؛ أما تسجيل إنجاز ميداني داخل النافذة فمرفوض.`,
    textEn: `This task's window touches the midday sun-ban season ${win.seasonEn}. Assignment is allowed and field work may run outside ${win.startLabel}–${win.endLabel}; logging a field completion inside the window is refused.`,
  };
}

/** Cumulative units expected through today on a paced multi-day task. */
export function cumulativePaceExpected(pace, today = new Date()) {
  if (!pace?.active) return 0;
  const todayKey = isoDayKey(today);
  const start = pace.start;
  if (!start || todayKey < start) return 0;
  if (pace.overdue) return pace.target;
  if (pace.custom && pace.dayPlan && typeof pace.dayPlan === "object") {
    let cum = 0;
    for (const [day, amt] of Object.entries(pace.dayPlan)) {
      if (String(day) <= todayKey) cum += Math.max(0, Number(amt) || 0);
    }
    return Math.min(pace.target, cum);
  }
  const paced = Array.isArray(pace.paceDays) ? pace.paceDays : [];
  if (paced.length) {
    let cum = 0;
    for (let i = 0; i < paced.length; i += 1) {
      if (paced[i] > todayKey) break;
      cum += pace.even + (i < pace.extra ? 1 : 0);
    }
    const base = pace.redistributed ? Math.max(0, Number(pace.baseDone) || 0) : 0;
    return Math.min(pace.target, base + cum);
  }
  const dayIndex = calendarDaysInclusive(start, todayKey) - 1;
  let cum = 0;
  for (let i = 0; i <= dayIndex; i += 1) {
    cum += pace.even + (i < pace.extra ? 1 : 0);
  }
  const base = pace.redistributed ? Math.max(0, Number(pace.baseDone) || 0) : 0;
  return Math.min(pace.target, base + cum);
}

/**
 * Auto-escalate gate — end of Riyadh workday or overdue when pace quota is unmet.
 * Proof Cycle step 4: burn time quota without progress → next handler on branch ladder.
 */
export function checkAutoEscalateGate(task, data, now = new Date(), { force = false } = {}) {
  if (isDone(task)) return { ok: false, error: "DONE" };
  if (isAwaitingApproval(task)) return { ok: false, error: "AWAITING" };

  const done = Number(task.completedCount) || 0;
  const target = Math.max(1, Number(task.targetCount) || 1);
  const pace = deriveDailyTaskPace(taskPaceInput(task, now));

  let breach = false;
  let breachReason = "";
  let breachReasonEn = "";

  if (pace.active) {
    const expected = cumulativePaceExpected(pace, now);
    if (done < expected) {
      const hour = riyadhHour(now);
      if (pace.overdue || force || hour >= 18) {
        breach = true;
        breachReason = pace.overdue
          ? "تصعيد تلقائي — تجاوز الاستحقاق دون إنجاز المستهدف."
          : "تصعيد تلقائي — لم يُسجَّل إنجاز اليوم المطلوب حتى نهاية الدوام.";
        breachReasonEn = pace.overdue
          ? "Auto-escalated — past due without meeting the target."
          : "Auto-escalated — today's pace quota was not logged by end of shift.";
      }
    }
  } else if (isOverdue(task, now) && done < target) {
    breach = true;
    breachReason = "تصعيد تلقائي — مهمة متأخرة دون إغلاق.";
    breachReasonEn = "Auto-escalated — overdue task still open.";
  }

  if (!breach) return { ok: false, error: "NO_BREACH" };

  const dayKey = riyadhDayKey(now);
  if (task.lastAutoEscalationDay === dayKey && !pace.overdue && !force) {
    return { ok: false, error: "ALREADY_TODAY" };
  }

  const next = nextOpsEscalation(task, data, null);
  if (!next.escalate) {
    return { ok: false, error: "AT_TOP", atTop: true, breachReason, breachReasonEn };
  }

  return {
    ok: true,
    nextLevel: next.nextLevel,
    handlers: next.handlers,
    breachReason,
    breachReasonEn,
    pace,
    expected: cumulativePaceExpected(pace, now),
    done,
  };
}

export function applyOpsAutoEscalate(task, { nextLevel, breachReason, breachReasonEn, now } = {}) {
  const when = now instanceof Date ? now : new Date(now || Date.now());
  const at = when.toISOString();
  const dayKey = riyadhDayKey(when);
  const comments = Array.isArray(task.comments) ? task.comments : [];
  return {
    ...task,
    escalationLevel: nextLevel,
    escalatedAt: at,
    autoEscalated: true,
    lastAutoEscalationDay: dayKey,
    comments: [
      ...comments,
      {
        id: `auto_${at}`,
        authorId: null,
        authorName: "النظام",
        text: breachReason || "تصعيد تلقائي — إيقاع الإنجاز لم يُستوفَ.",
        textEn: breachReasonEn || "Auto-escalated — pace quota not met.",
        isIssue: true,
        is_escalation: true,
        is_auto: true,
        at,
      },
    ],
  };
}

/** Hourly / end-of-day sweep — returns updated task list + count escalated. */
export function runOpsEscalationSweep(tasks, data, now = new Date(), opts = {}) {
  let escalated = 0;
  const details = [];
  const nextTasks = (Array.isArray(tasks) ? tasks : []).map((task) => {
    const gate = checkAutoEscalateGate(task, data, now, opts);
    if (!gate.ok) return task;
    const updated = applyOpsAutoEscalate(task, {
      nextLevel: gate.nextLevel,
      breachReason: gate.breachReason,
      breachReasonEn: gate.breachReasonEn,
      now,
    });
    escalated += 1;
    details.push({ taskId: task.id, ref: task.ref, level: gate.nextLevel });
    return updated;
  });
  return { tasks: nextTasks, escalated, details };
}
