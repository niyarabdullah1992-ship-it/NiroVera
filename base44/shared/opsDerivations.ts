/** Operations derivation rules — single source for server (and mirrored tests).
 *  Design ref: NiroVera Platform.dc.html class Component (ops / task points / cert gate).
 */
import { deriveBranchEscalationChain } from "./orgDerivations.ts";
import { HEAT_BAN_STATE_LEVEL, heatBanWindow, isHeatBanDate, isHeatBanMinuteOfDay } from "./contractLawDerivations.ts";
import { heatBanDecisionLabel } from "./heatBanDecision.ts";
import { citeRule, explainRule } from "./laborRules.ts";

export const PRIORITY_VALUE: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Flexible work kinds — office and field companies alike. Default is general. */
export const WORK_KINDS = ["gn", "ad", "of", "tr", "pm", "cm", "em", "pr", "cp"] as const;

export type WorkKind = (typeof WORK_KINDS)[number];

export const WORK_KIND_LABELS: Record<WorkKind, { ar: string; en: string }> = {
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
export const CERT_FOR: Record<string, string | null> = {
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

export const CERT_LABELS: Record<string, { ar: string; en: string }> = {
  fa: { ar: "الإسعافات الأولية", en: "First aid" },
  loto: { ar: "العزل والوسم LOTO", en: "Lock-out / tag-out" },
  wah: { ar: "العمل على ارتفاع", en: "Work at height" },
  cs: { ar: "الأماكن المحصورة", en: "Confined space" },
};

export function normalizeWorkKind(raw: unknown, fallback: WorkKind | string = "gn"): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return fallback;
  const id = trimmed.toLowerCase();
  if ((WORK_KINDS as readonly string[]).includes(id)) return id;
  // Free-text custom work type for companies outside the preset list.
  return trimmed.slice(0, 80);
}

export function workKindLabel(kind: unknown, lang: "ar" | "en" = "ar"): string {
  const id = String(kind || "").trim();
  if (!id) return lang === "en" ? "General" : "عام";
  if (WORK_KIND_LABELS[id as WorkKind]) {
    return WORK_KIND_LABELS[id as WorkKind][lang === "en" ? "en" : "ar"];
  }
  return id;
}

export type AssignMode = "one" | "some" | "all";

export type OpsTaskLike = {
  dueAt?: string | null;
  createdAt?: string | null;
  startAt?: string | null;
  paceStartAt?: string | null;
  paceSpreadTarget?: number | null;
  paceDayPlan?: Record<string, number> | null;
  paceDayLog?: Record<string, number> | null;
  paceBlocker?: Record<string, unknown> | null;
  paceWeekdays?: unknown;
  paceDates?: unknown;
  status?: string;
  completedCount?: number;
  targetCount?: number;
  stationId?: string | null;
  pointsAwarded?: number | null;
  approvedAt?: string | null;
  escalationLevel?: number | null;
  comments?: unknown[];
  rejectReason?: string | null;
  planHorizon?: string | null;
  planPinned?: boolean;
};

function localDayStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Local calendar days from today to due (not UTC ISO shift). */
export function dayDiffFromToday(iso: string, today = new Date()) {
  if (!iso) return NaN;
  const due = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return NaN;
  return Math.round((due.getTime() - localDayStart(today).getTime()) / 86400000);
}

export function isoDayKey(value?: string | Date | null, today = new Date()) {
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

export function calendarDaysInclusive(fromIso: string, toIso: string) {
  const from = isoDayKey(fromIso);
  const to = isoDayKey(toIso);
  if (!from || !to) return 0;
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export function listMatchingPaceDays({
  startAt,
  dueAt,
  weekdays,
  dates,
}: {
  startAt?: string | null;
  dueAt?: string | null;
  weekdays?: unknown;
  dates?: unknown;
} = {}) {
  const from = isoDayKey(startAt);
  const to = isoDayKey(dueAt);
  if (!from || !to || from > to) return [] as string[];
  const picked = [...new Set((Array.isArray(dates) ? dates : [])
    .map((v) => String(v || "").trim().slice(0, 10))
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= from && v <= to))]
    .sort();
  if (Array.isArray(dates) && dates.length) return picked;
  const wanted = [...new Set((Array.isArray(weekdays) ? weekdays : [])
    .map((n) => Math.round(Number(n)))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
  const days: string[] = [];
  let day = from;
  while (day && day <= to) {
    const dt = new Date(`${day}T00:00:00`);
    if (!wanted.length || wanted.includes(dt.getDay())) days.push(day);
    dt.setDate(dt.getDate() + 1);
    day = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }
  return days;
}

export function taskPaceInput(task: OpsTaskLike | null | undefined, today?: Date) {
  return {
    targetCount: task?.targetCount,
    completedCount: task?.completedCount,
    dueAt: task?.dueAt,
    startAt: task?.startAt || task?.createdAt,
    paceStartAt: task?.paceStartAt,
    paceSpreadTarget: task?.paceSpreadTarget,
    paceDayPlan: task?.paceDayPlan,
    weekdays: (task as { paceWeekdays?: unknown } | null | undefined)?.paceWeekdays,
    paceDates: (task as { paceDates?: unknown } | null | undefined)?.paceDates,
    today,
  };
}

export type DailyTaskPace = {
  active: boolean;
  target: number;
  done: number;
  remaining: number;
  days: number;
  daysLeft: number;
  even: number;
  extra: number;
  todayExpected: number;
  plannedShare: number;
  overdue: boolean;
  notYet: boolean;
  offDay?: boolean;
  due: string;
  start: string;
  redistributed: boolean;
  custom: boolean;
  spreadTarget: number;
  baseDone: number;
  dayPlan: Record<string, number>;
  paceDays?: string[];
};

/** Normalize { "YYYY-MM-DD": n } day quotas. Drops empty/invalid days. */
export function normalizePaceDayPlan(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const day = isoDayKey(key);
    const n = Math.max(0, Math.round(Number(val) || 0));
    if (!day || n <= 0) continue;
    out[day] = (out[day] || 0) + n;
  }
  return out;
}

export function paceDayPlanEntries(raw: unknown): Array<{ day: string; amount: number }> {
  const plan = normalizePaceDayPlan(raw);
  return Object.keys(plan)
    .sort()
    .map((day) => ({ day, amount: plan[day] }));
}

export function paceDayPlanTotal(raw: unknown): number {
  return paceDayPlanEntries(raw).reduce((sum, row) => sum + row.amount, 0);
}

/** Spread targetCount evenly — or by paceDayPlan custom day quotas. */
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
}: {
  targetCount?: number | null;
  completedCount?: number | null;
  dueAt?: string | null;
  startAt?: string | null;
  paceStartAt?: string | null;
  paceSpreadTarget?: number | null;
  paceDayPlan?: Record<string, number> | null;
  weekdays?: unknown;
  paceDates?: unknown;
  today?: Date;
} = {}): DailyTaskPace {
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
  const empty: DailyTaskPace = {
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
  const even = Math.floor(spreadTarget / days);
  const extra = spreadTarget % days;
  const overdue = todayKey > due;
  const firstDay = paceDays[0] || windowStart;
  const beforeStart = todayKey < firstDay;
  const onDay = !paceDays.length || paceDays.includes(todayKey);
  const offDay = !beforeStart && !overdue && !onDay;
  let todayExpected = 0;
  if (overdue) {
    todayExpected = remaining;
  } else if (!beforeStart && onDay) {
    const dayIndex = paceDays.length
      ? Math.max(0, paceDays.indexOf(todayKey))
      : Math.min(days - 1, Math.max(0, calendarDaysInclusive(windowStart, todayKey) - 1));
    todayExpected = even + (dayIndex < extra ? 1 : 0);
    todayExpected = Math.min(remaining, todayExpected);
  }
  const plannedShare = Math.min(remaining, even + (extra > 0 ? 1 : 0));
  return {
    active: true,
    target,
    done,
    remaining,
    days,
    daysLeft: overdue
      ? 0
      : (paceDays.length
        ? paceDays.filter((d) => d >= todayKey).length
        : Math.max(0, calendarDaysInclusive(todayKey, due))),
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

export function dailyPaceCopy(pace: DailyTaskPace | null | undefined, ar = true) {
  if (!pace?.active) return null;
  const todayLabel = ar ? "حصة اليوم" : "Today's quota";
  if (pace.notYet) {
    const share = Math.max(0, Number(pace.plannedShare) || 0);
    return {
      tone: "ok" as const,
      kicker: ar ? "لم يحن يومه" : "Its day has not come",
      metrics: [
        { label: todayLabel, value: String(share) },
        { label: ar ? "المستهدف" : "Target", value: String(pace.target) },
        { label: ar ? "الأيام" : "Days", value: String(pace.days) },
      ],
      hint: ar
        ? "حصة اليوم من تقسيم العدد على أيام التوزيع — التنفيذ لم يحن موعده بعد."
        : "Today's quota is the count split across spread days — work has not started yet.",
    };
  }
  if (pace.offDay) {
    return {
      tone: "ok" as const,
      kicker: ar ? "اليوم خارج التوزيع" : "Today is off the spread",
      metrics: [
        { label: todayLabel, value: "0" },
        { label: ar ? "المستهدف" : "Target", value: String(pace.target) },
        { label: ar ? "الأيام" : "Days", value: String(pace.days) },
      ],
      hint: ar
        ? "هذا اليوم ليس من أيام التوزيع المختارة — حصة اليوم 0."
        : "Today is not one of the selected spread days — today's quota is 0.",
    };
  }
  if (pace.remaining <= 0) {
    return {
      tone: "done" as const,
      kicker: pace?.custom
        ? (ar ? "خطة أيام محددة" : "Custom day plan")
        : (ar ? "التوزيع على الأيام" : "Spread across days"),
      metrics: [
        { label: todayLabel, value: "0" },
        { label: ar ? "المستهدف" : "Target", value: String(pace.target) },
        { label: ar ? "الأيام" : "Days", value: String(pace.days) },
      ],
      hint: ar ? "اكتمل العدد المستهدف" : "Target count is met",
    };
  }
  if (pace.overdue) {
    return {
      tone: "warn" as const,
      kicker: pace?.custom
        ? (ar ? "خطة أيام — متأخر" : "Day plan — behind")
        : (ar ? "متأخر عن التوزيع" : "Behind the spread"),
      metrics: [
        { label: todayLabel, value: String(pace.remaining) },
        { label: ar ? "المتبقي" : "Left", value: String(pace.remaining) },
        { label: ar ? "الأيام" : "Days", value: "0" },
      ],
      hint: ar ? "المتبقي يُنجز اليوم" : "Remaining is due today",
    };
  }
  return {
    tone: "ok" as const,
    kicker: pace.custom
      ? (ar ? "خطة أيام محددة" : "Custom day plan")
      : (ar ? "التوزيع على الأيام" : "Spread across days"),
    metrics: [
      { label: todayLabel, value: String(pace.todayExpected) },
      { label: ar ? "المستهدف" : "Target", value: String(pace.target) },
      { label: ar ? "الأيام" : "Days", value: String(pace.days) },
    ],
    hint: pace.custom
      ? (ar ? "حصة الأيام المحددة في الخطة — اليوم فقط إن وُجدت له كمية" : "Quota from the custom day plan — today only if scheduled")
      : pace.paceDays?.length
        ? (ar ? "يُقسَّم العدد على أيام التوزيع المختارة من تاريخ البدء حتى الاستحقاق" : "The count is split across the selected spread days from start to due")
        : pace.redistributed
          ? (ar ? "أُعيد توزيع المتبقي بالتساوي من يوم إعادة الضبط" : "Remainder re-split evenly from the rebaseline day")
          : (ar ? "يُقسَّم العدد بالتساوي من تاريخ البدء حتى الاستحقاق" : "The count is split evenly from the start date to the due date"),
  };
}

/** Units logged on a calendar day from paceDayLog. */
export function taskPaceLoggedOnDay(task: OpsTaskLike | null | undefined, day: Date | string = new Date()) {
  const key = isoDayKey(day);
  if (!key) return 0;
  const map = task?.paceDayLog && typeof task.paceDayLog === "object" ? task.paceDayLog : null;
  if (!map) return 0;
  return Math.max(0, Number((map as Record<string, number>)[key]) || 0);
}

export function applyOpsPaceDayLog(
  task: OpsTaskLike & Record<string, unknown>,
  amount = 1,
  at = new Date().toISOString(),
) {
  const day = isoDayKey(at);
  const raw = Math.round(Number(amount));
  const add = Number.isFinite(raw) ? raw : 0;
  const prev = task?.paceDayLog && typeof task.paceDayLog === "object"
    ? task.paceDayLog as Record<string, number>
    : {};
  const nextVal = Math.max(0, (Number(prev[day]) || 0) + add);
  return {
    ...task,
    paceDayLog: { ...prev, [day]: nextVal },
  };
}

/** Unsend a task-thread message within three minutes of posting. */
export const OPS_MESSAGE_DELETE_WINDOW_MS = 3 * 60 * 1000;

export function applyOpsCommentDelete(
  task: OpsTaskLike & Record<string, unknown>,
  commentId: string,
  {
    now = Date.now(),
    actorId = "",
    actorIds = [],
    windowMs = OPS_MESSAGE_DELETE_WINDOW_MS,
    lang = "ar",
  }: { now?: number; actorId?: string; actorIds?: string[]; windowMs?: number; lang?: string } = {},
) {
  const id = String(commentId || "").trim();
  const comments = Array.isArray(task?.comments) ? task.comments as any[] : [];
  const found = comments.find((c) => String(c?.id || "") === id);
  if (!found) {
    return { ok: false as const, error: "COMMENT_NOT_FOUND", reason: lang === "en" ? "Message not found." : "الرسالة غير موجودة." };
  }
  if (found.is_auto || found.is_rejection || found.is_escalation) {
    return {
      ok: false as const,
      error: "PROTECTED",
      reason: lang === "en"
        ? "Reject and escalation reasons stay on the card so the cause stays visible."
        : "أسباب الرفض والتصعيد تبقى في البطاقة ليُعرف السبب.",
    };
  }
  const atMs = new Date(found.at || found.createdAt || 0).getTime();
  const ageMs = Number.isFinite(atMs) ? now - atMs : Infinity;
  if (ageMs > windowMs) {
    return { ok: false as const, error: "WINDOW", reason: lang === "en" ? "Messages can only be deleted within 3 minutes of sending." : "انتهت مهلة الثلاث دقائق للحذف." };
  }
  const aid = String(found.authorId || found.author_id || "").trim();
  const actors = new Set([actorId, ...(Array.isArray(actorIds) ? actorIds : [])].map((x) => String(x || "").trim()).filter(Boolean));
  if (actors.size && aid && !actors.has(aid)) {
    return { ok: false as const, error: "FORBIDDEN", reason: lang === "en" ? "You can only delete your own message." : "لا تُحذف إلا رسالتك." };
  }
  const add = String(found.kind || "") === "log" ? Math.max(0, Math.round(Number(found.amount) || 0)) : 0;
  const approved = task.status === "completed" || !!(task as { approvedAt?: string }).approvedAt;
  if (approved && add > 0) {
    return { ok: false as const, error: "LOCKED", reason: lang === "en" ? "Logged completion cannot be removed after approval." : "لا يُحذف سجل الإنجاز بعد الاعتماد." };
  }
  let next: OpsTaskLike & Record<string, unknown> = {
    ...task,
    comments: comments.filter((c) => String(c?.id || "") !== id),
  };
  if (add > 0) {
    const nextCount = Math.max(0, (Number(task.completedCount) || 0) - add);
    const targetN = Math.max(1, Number(task.targetCount) || 1);
    next.completedCount = nextCount;
    next.completed_tasks = nextCount;
    if (task.status === "awaiting_approval" && nextCount < targetN) next.status = "active";
    next = applyOpsPaceDayLog(next, -add, found.at || found.createdAt);
  }
  return { ok: true as const, task: next, comment: found, ageMs };
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
}: {
  task?: OpsTaskLike | null;
  pace?: DailyTaskPace | null;
  amountJustLogged?: number;
  today?: Date;
  applied?: boolean;
  missed?: boolean;
} = {}) {
  if (!pace?.active || pace.overdue || pace.notYet) return null;
  const expected = Math.max(0, Number(pace.todayExpected) || 0);
  if (expected <= 0) return null;
  const day = isoDayKey(today);
  const add = Math.max(0, Math.round(Number(amountJustLogged) || 0));
  const onDay = taskPaceLoggedOnDay(task, today);
  const before = applied ? Math.max(0, onDay - add) : onDay;
  const logged = Math.max(0, before + add);
  const stored = task?.paceBlocker && typeof task.paceBlocker === "object" ? task.paceBlocker as any : null;
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
    kind: shown <= 0 ? "missed" as const : "partial" as const,
    status: "open" as const,
  };
}

export function derivePaceLogShortfall({
  pace,
  amount,
  remainingBefore,
  task,
  today,
}: {
  pace?: DailyTaskPace | null;
  amount?: number;
  remainingBefore?: number;
  task?: OpsTaskLike | null;
  today?: Date;
} = {}) {
  const add = amount != null ? Number(amount) : 0;
  const missed = amount != null && !(add > 0);
  if (task) return derivePaceBlocker({ task, pace, amountJustLogged: add, today, missed });
  const remBefore = remainingBefore != null ? Number(remainingBefore) : pace?.remaining;
  const synthetic = {
    targetCount: pace?.target || 0,
    completedCount: Math.max(0, (Number(pace?.target) || 0) - Math.max(0, remBefore || 0)),
    paceDayLog: {},
  };
  return derivePaceBlocker({ task: synthetic, pace, amountJustLogged: add, today, missed });
}

export function paceShortfallCopy(
  shortfall: ReturnType<typeof derivePaceBlocker>,
  ar = true,
) {
  if (!shortfall) return null;
  // المنجز هو مصدر الحقيقة — لا تعتمد على kind المخزَّن إن تعارض
  const missed = Number(shortfall.logged) <= 0;
  return {
    caseKey: missed ? "missed" as const : "partial" as const,
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

export function applyOpsPaceBlockerResolve(
  task: OpsTaskLike & Record<string, unknown>,
  input: {
    at?: string;
    day?: string;
    reason?: string;
    resolution?: "extend" | "redistribute";
    expected?: number;
    logged?: number;
    gap?: number;
    byId?: string | null;
    byName?: string;
  } = {},
) {
  const at = input.at || new Date().toISOString();
  const day = isoDayKey(input.day || at);
  const reason = String(input.reason || "").trim();
  const resolution = input.resolution === "extend" ? "extend" : "redistribute";
  const prev = task?.paceBlocker && typeof task.paceBlocker === "object" ? task.paceBlocker as any : {};
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

export function boardPaceCopy(
  board: { active?: number; todayExpected?: number } | null | undefined,
  ar = true,
) {
  if (!board?.active) return null;
  return {
    tone: "ok" as const,
    kicker: ar ? "التوزيع على الأيام" : "Spread across days",
    metrics: [
      { label: ar ? "اليوم" : "Today", value: String(board.todayExpected || 0) },
      { label: ar ? "الأوامر" : "Orders", value: String(board.active) },
    ],
    hint: ar ? "مجموع إيقاع اليوم للأوامر المؤرخة" : "Sum of today's pace on dated orders",
  };
}

export function dailyPaceLabel(pace: DailyTaskPace | null | undefined, ar = true) {
  const copy = dailyPaceCopy(pace, ar);
  if (!copy) return "";
  const today = copy.metrics[0]?.value || "0";
  return `${copy.kicker} · ${today} · ${copy.hint}`;
}

export function deriveBoardDailyPace(tasks: OpsTaskLike[], today = new Date()) {
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
export function planHorizonFromDue(iso: string | null | undefined, today = new Date()) {
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
export function taskPlanHorizon(task: OpsTaskLike | null | undefined, today = new Date()) {
  if (task?.planPinned && task?.planHorizon) return String(task.planHorizon);
  return planHorizonFromDue(task?.dueAt, today);
}

/** Cap on materialized occurrences from one New-task recurrence. */
export const TASK_RECURRENCE_MAX = 52;
/** Max repeats inside one calendar month (days 1–31). */
export const TASK_RECURRENCE_TIMES_MAX = 31;

export function clampTimesPerMonth(raw: unknown): number | null {
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
] as const;

export const RECURRENCE_HORIZONS = [
  { id: "m", ar: "هذا الشهر", en: "This month" },
  { id: "q", ar: "ثلاثة أشهر", en: "Three months" },
  { id: "y", ar: "سنة", en: "A year" },
] as const;

export type TaskRecurrenceKind = "once" | "weekly" | "selected_dates" | "monthly_weekday" | "monthly_dates";

export type TaskRecurrence = {
  kind: TaskRecurrenceKind;
  weekday?: number | null;
  weekdays?: number[];
  dates?: string[];
  timesPerMonth?: number;
  monthDays?: number[];
  horizon?: "m" | "q" | "y";
  seriesId?: string | null;
  occurrence?: number;
  occurrenceCount?: number;
};

function isoFromYmd(y: number, month: number, d: number) {
  return `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function dateFromIsoDay(iso: string) {
  const key = isoDayKey(iso);
  const m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function addCalendarDays(iso: string, n: number) {
  const dt = dateFromIsoDay(iso);
  if (!dt) return "";
  dt.setDate(dt.getDate() + n);
  return isoFromYmd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function listIsoDaysInRange(fromIso: string, toIso: string, max = 366) {
  const from = isoDayKey(fromIso);
  const to = isoDayKey(toIso);
  if (!from || !to || from > to) return [];
  const days: string[] = [];
  for (let day = from; day && day <= to; day = addCalendarDays(day, 1)) {
    days.push(day);
    if (days.length >= max) break;
  }
  return days;
}

export const PACE_CHIP_DAYS_MAX = 62;
export const PACE_DATES_MAX = 366;

export const TASK_WINDOW_SPANS = [
  { id: "w", ar: "أسبوع", en: "Week" },
  { id: "m", ar: "شهر", en: "Month" },
  { id: "y", ar: "سنة", en: "Year" },
] as const;

export function taskWindowSpanEnd(startIso: string, span: string) {
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

export function applyTaskWindowSpan(
  form: Record<string, unknown> | null | undefined,
  span: string,
  today: Date = new Date(),
) {
  const start = isoDayKey(form?.startAt as string | Date | undefined) || isoDayKey(today);
  return { startAt: start, dueAt: taskWindowSpanEnd(start, span) };
}

export function formPaceMode(form: Record<string, unknown> | null | undefined) {
  const mode = String(form?.paceMode || "all");
  if (mode === "weekdays" || mode === "dates") return mode;
  return "all";
}

export function clipIsoDatesToWindow(dates: unknown, startAt: unknown, dueAt: unknown, max = PACE_DATES_MAX) {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(startAt || "").trim()) ? String(startAt).trim().slice(0, 10) : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(dueAt || "").trim()) ? String(dueAt).trim().slice(0, 10) : "";
  return normalizeIsoDates(dates, max).filter((d) => (!from || d >= from) && (!to || d <= to));
}

export function formPaceInput(form: Record<string, unknown> | null | undefined, today?: Date) {
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

export function checkTaskPaceFromForm(form: Record<string, unknown> | null | undefined) {
  const win = checkTaskWindowFromForm({ ...form, recurrenceKind: "daily" });
  if (!win.ok) return win;
  const mode = formPaceMode(form);
  if (mode === "weekdays") {
    const days = normalizeWeekdays(form?.paceWeekdays, form?.recurrenceWeekdays ?? form?.recurrenceWeekday);
    if (!days.length) {
      return {
        ...win,
        ok: false as const,
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
        ok: false as const,
        error: "PACE_DAY_REQUIRED",
        reason: "حدّد الأيام داخل الفترة.",
        reasonEn: "Pick the days inside the date range.",
      };
    }
  }
  return { ok: true as const, ...win };
}

export function normalizeWeekdays(raw: unknown, fallback?: unknown) {
  const src = Array.isArray(raw)
    ? raw
    : (fallback != null && fallback !== "" ? [fallback] : []);
  return [...new Set(src
    .map((n) => Math.round(Number(n)))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))]
    .sort((a, b) => a - b);
}

export function normalizeIsoDates(raw: unknown, max = TASK_RECURRENCE_MAX) {
  return [...new Set((Array.isArray(raw) ? raw : [])
    .map((v) => String(v || "").trim().slice(0, 10))
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v)))]
    .sort()
    .slice(0, max);
}

export const TASK_RECURRENCE_MONTHS_MAX = 24;
export const TASK_RECURRENCE_EXTRA_DAYS_MAX = 366;

export function clampDurationPart(raw: unknown, max: number) {
  if (raw === "" || raw == null) return 0;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}

export function recurrenceDurationEnd(startIso: string, months: unknown, extraDays: unknown) {
  const dt = dateFromIsoDay(startIso);
  if (!dt) return "";
  const m = clampDurationPart(months, TASK_RECURRENCE_MONTHS_MAX);
  const d = clampDurationPart(extraDays, TASK_RECURRENCE_EXTRA_DAYS_MAX);
  if (m < 1 && d < 1) return "";
  dt.setMonth(dt.getMonth() + m);
  dt.setDate(dt.getDate() + d);
  return isoFromYmd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function taskWindowFromForm(form: Record<string, unknown> | null | undefined) {
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

export function checkTaskWindowFromForm(form: Record<string, unknown> | null | undefined) {
  const kind = String(form?.recurrenceKind || "daily");
  const win = taskWindowFromForm(form);
  if (kind === "daily" || kind === "once" || kind === "range" || kind === "weekly") {
    if (!win.startAt || !win.dueAt) {
      return {
        ok: false as const,
        error: "RECURRENCE_RANGE_REQUIRED",
        reason: "حدّد تاريخ البدء وتاريخ الاستحقاق.",
        reasonEn: "Pick the start and due dates.",
        ...win,
      };
    }
    if (win.startAt > win.dueAt) {
      return {
        ok: false as const,
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
            ok: false as const,
            error: "RECURRENCE_DAY_REQUIRED",
            reason: "حدّد الأيام داخل الفترة.",
            reasonEn: "Pick the days inside the date range.",
            ...win,
          };
        }
      } else if (!normalizeWeekdays(form?.recurrenceWeekdays, form?.recurrenceWeekday).length) {
        return {
          ok: false as const,
          error: "RECURRENCE_WEEKDAY_REQUIRED",
          reason: "حدّد أيام الأسبوع للمهمة.",
          reasonEn: "Pick the weekdays for the task.",
          ...win,
        };
      }
    }
    return { ok: true as const, ...win };
  }
  if (!win.startAt) {
    return {
      ok: false as const,
      error: "RECURRENCE_START_REQUIRED",
      reason: "حدّد تاريخ البدء.",
      reasonEn: "Pick a start date.",
      ...win,
    };
  }
  if (!win.dueAt) {
    return {
      ok: false as const,
      error: "RECURRENCE_DURATION_REQUIRED",
      reason: "اكتب مدة المهمة بالأشهر.",
      reasonEn: "Enter the task duration in months.",
      ...win,
    };
  }
  return { ok: true as const, ...win };
}

export function recurrenceHorizonEnd(startIso: string, horizon: string) {
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

export function recurrenceWindowEnd(from: string, rec: { horizon?: string } | null | undefined, dueAt?: string | null) {
  const due = dueAt != null && String(dueAt).trim() ? isoDayKey(dueAt) : "";
  if (due && due >= from) return due;
  return recurrenceHorizonEnd(from, rec?.horizon || "m");
}

export function normalizeTaskRecurrence(raw: unknown): TaskRecurrence {
  if (!raw || typeof raw !== "object") return { kind: "once" };
  const row = raw as Record<string, unknown>;
  const kind = String(row.kind || "once") as TaskRecurrenceKind;
  if (kind === "once" || !kind) return { kind: "once" };
  const weekdayN = Number(row.weekday);
  const weekday = Number.isInteger(weekdayN) && weekdayN >= 0 && weekdayN <= 6 ? weekdayN : null;
  const weekdays = normalizeWeekdays(row.weekdays, weekday);
  const dates = normalizeIsoDates(row.dates);
  const timesPerMonth = clampTimesPerMonth(row.timesPerMonth) ?? undefined;
  const monthDays = [...new Set((Array.isArray(row.monthDays) ? row.monthDays : [])
    .map((n) => Math.round(Number(n)))
    .filter((n) => n >= 1 && n <= 31))]
    .sort((a, b) => a - b)
    .slice(0, TASK_RECURRENCE_TIMES_MAX);
  const horizon = ["m", "q", "y"].includes(String(row.horizon || ""))
    ? String(row.horizon) as "m" | "q" | "y"
    : "m";
  if (kind === "weekly") return { kind: "weekly", weekday: weekdays[0] ?? null, weekdays, horizon };
  if (kind === "selected_dates") return { kind: "selected_dates", dates, horizon };
  if (kind === "monthly_dates") return { kind: "monthly_dates", monthDays, horizon };
  if (kind === "monthly_weekday") return { kind: "monthly_weekday", weekday, timesPerMonth, horizon };
  return { kind: "once" };
}

export function taskRecurrenceFromForm(form: Record<string, unknown> | null | undefined): TaskRecurrence {
  const kind = String(form?.recurrenceKind || "daily");
  if (kind === "daily" || kind === "once" || kind === "range" || kind === "weekly"
    || (kind === "yearly" && form?.recurrenceYearSpread !== "months")) return { kind: "once" };
  if (form?.recurrenceDayMode === "dates") {
    const n = clampTimesPerMonth(form?.recurrenceTimes) || TASK_RECURRENCE_TIMES_MAX;
    const days = (Array.isArray(form?.recurrenceMonthDays) ? form.recurrenceMonthDays : []).slice(0, n);
    return normalizeTaskRecurrence({
      kind: "monthly_dates",
      monthDays: days,
      horizon: kind === "yearly" ? "y" : (form?.recurrenceHorizon || "m"),
    });
  }
  return normalizeTaskRecurrence({
    kind: "monthly_weekday",
    weekday: form?.recurrenceWeekday,
    timesPerMonth: form?.recurrenceTimes,
    horizon: kind === "yearly" ? "y" : (form?.recurrenceHorizon || "m"),
  });
}

export function expandTaskRecurrence(
  recurrence: unknown,
  { startAt, dueAt, today = new Date() }: { startAt?: string | null; dueAt?: string | null; today?: Date } = {},
) {
  const rec = normalizeTaskRecurrence(recurrence);
  const from = isoDayKey(startAt, today) || isoDayKey(today);
  if (rec.kind === "once") {
    const to = isoDayKey(dueAt, today) || from;
    return [{ startAt: from, dueAt: to < from ? from : to }];
  }
  const to = recurrenceWindowEnd(from, rec, dueAt);
  if (!to || to < from) return [];
  const dates: string[] = [];
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
    const seen: Record<string, number> = {};
    for (let day = from; day && day <= to; day = addCalendarDays(day, 1)) {
      const dt = dateFromIsoDay(day);
      if (!dt || dt.getDay() !== rec.weekday) continue;
      const ym = day.slice(0, 7);
      seen[ym] = (seen[ym] || 0) + 1;
      if (seen[ym] <= rec.timesPerMonth) dates.push(day);
      if (dates.length >= TASK_RECURRENCE_MAX) break;
    }
  } else if (rec.kind === "monthly_dates") {
    const wanted = new Set(rec.monthDays || []);
    if (!wanted.size) return [];
    for (let day = from; day && day <= to; day = addCalendarDays(day, 1)) {
      if (wanted.has(Number(day.slice(8, 10)))) dates.push(day);
      if (dates.length >= TASK_RECURRENCE_MAX) break;
    }
  }
  return dates.map((day) => ({ startAt: day, dueAt: day }));
}

export function checkTaskRecurrenceGate(
  recurrence: unknown,
  opts: { startAt?: string | null; dueAt?: string | null; today?: Date } = {},
) {
  const rec = normalizeTaskRecurrence(recurrence);
  if (rec.kind === "once") {
    return { ok: true as const, windows: expandTaskRecurrence(rec, opts), recurrence: rec };
  }
  if (rec.kind === "weekly" && !(rec.weekdays?.length || rec.weekday != null)) {
    return {
      ok: false as const,
      error: "RECURRENCE_WEEKDAY_REQUIRED",
      reason: "حدّد أيام الأسبوع للمهمة.",
      reasonEn: "Pick the weekdays for the task.",
      windows: [] as { startAt: string; dueAt: string }[],
    };
  }
  if (rec.kind === "monthly_weekday" && rec.weekday == null) {
    return {
      ok: false as const,
      error: "RECURRENCE_WEEKDAY_REQUIRED",
      reason: "حدّد يوم الأسبوع للمهمة المتكررة.",
      reasonEn: "Pick a weekday for the repeating task.",
      windows: [] as { startAt: string; dueAt: string }[],
    };
  }
  if (rec.kind === "selected_dates" && !(rec.dates || []).length) {
    return {
      ok: false as const,
      error: "RECURRENCE_DAY_REQUIRED",
      reason: "حدّد الأيام داخل الفترة.",
      reasonEn: "Pick the days inside the date range.",
      windows: [] as { startAt: string; dueAt: string }[],
    };
  }
  if (rec.kind === "monthly_weekday" && rec.timesPerMonth == null) {
    return {
      ok: false as const,
      error: "RECURRENCE_TIMES_REQUIRED",
      reason: "اكتب كم مرة في الشهر تتكرر المهمة.",
      reasonEn: "Enter how many times per month the task repeats.",
      windows: [] as { startAt: string; dueAt: string }[],
    };
  }
  if (rec.kind === "monthly_dates" && !(rec.monthDays || []).length) {
    return {
      ok: false as const,
      error: "RECURRENCE_DAY_REQUIRED",
      reason: "حدّد أيام الشهر التي تتكرر فيها المهمة.",
      reasonEn: "Pick the month days the task repeats on.",
      windows: [] as { startAt: string; dueAt: string }[],
    };
  }
  const windows = expandTaskRecurrence(rec, opts);
  if (!windows.length) {
    return {
      ok: false as const,
      error: "RECURRENCE_EMPTY",
      reason: "لا مواعيد في هذه المدة من تاريخ البدء.",
      reasonEn: "No dates fall in this window from the start date.",
      windows,
    };
  }
  return { ok: true as const, windows, recurrence: rec };
}

export function taskRecurrenceLabel(rec: unknown, ar = true) {
  const row = normalizeTaskRecurrence(rec);
  if (row.kind === "once") return "";
  const meta = rec && typeof rec === "object" ? rec as TaskRecurrence : {};
  const occ = meta.occurrence && meta.occurrenceCount
    ? (ar ? `${meta.occurrence} من ${meta.occurrenceCount}` : `${meta.occurrence} of ${meta.occurrenceCount}`)
    : "";
  const tail = occ ? ` · ${occ}` : "";
  const weekdayNames = (ids: number[]) => ids
    .map((id) => WEEKDAY_OPTIONS.find((w) => w.id === id))
    .filter(Boolean)
    .map((d) => (ar ? d!.ar : d!.en));
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

export function clampEffortWeight(raw: unknown) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Points = priority value (3/2/1) × effort weight (1–5). Granted only after approval. */
export function taskPoints(priority: string | null | undefined, effortWeight: unknown) {
  const pv = PRIORITY_VALUE[String(priority || "medium")] ?? 1;
  return pv * clampEffortWeight(effortWeight);
}

export function isOverdue(task: OpsTaskLike, today = new Date()) {
  if (!task.dueAt) return false;
  if (isOpsTaskDeleted(task) || task.status === "completed" || task.approvedAt) return false;
  return dayDiffFromToday(task.dueAt, today) < 0;
}

export function isDueToday(task: OpsTaskLike, today = new Date()) {
  if (!task.dueAt) return false;
  return dayDiffFromToday(task.dueAt, today) === 0;
}

export function isAwaitingApproval(task: OpsTaskLike) {
  if (task.status === "awaiting_approval" || task.status === "pending_review") return true;
  const done = Number(task.completedCount) || 0;
  const target = Math.max(1, Number(task.targetCount) || 1);
  return done >= target && !task.approvedAt && task.status !== "completed";
}

export function isDone(task: OpsTaskLike) {
  return task.status === "completed" || !!task.approvedAt;
}

export function isOpsTaskDeleted(task?: OpsTaskLike | null) {
  return Boolean((task as any)?.deletedAt) || task?.status === "cancelled";
}

export function isOpsTaskArchived(task?: OpsTaskLike | null) {
  return !!task && (isOpsTaskDeleted(task) || isDone(task));
}

export function isEscalated(task: OpsTaskLike) {
  return (Number(task?.escalationLevel) || 0) > 0 && !isDone(task);
}

/** Fallback ladder when the company has no custom HR tiers. */
export const OPS_ROLE_LADDER = ["station_manager", "pgm", "ops_manager", "director", "owner"] as const;

type EscalationPerson = {
  id?: string;
  employeeId?: string;
  role?: string;
  stationId?: string | null;
  managedStations?: string[];
  hrLevelId?: string | null;
  hrStationId?: string | null;
  hrClusterId?: string | null;
  isOwner?: boolean;
  name?: string;
};

type EscalationData = {
  employees?: EscalationPerson[];
  hrLevels?: Array<{ id?: string; order?: number; role?: string; scope?: string; active?: boolean; stationIds?: string[] }>;
  hrClusters?: Array<{ id?: string; stationIds?: string[] }>;
  orgTree?: Array<{ id: string; parentId?: string | null; type?: string; refId?: string; title?: string }>;
  stations?: Array<{ id?: string; stationId?: string; managerId?: string | null; parentStationId?: string | null; parentBranchId?: string | null }>;
  ownerId?: string;
  directorId?: string;
};

function personId(p: EscalationPerson | null | undefined) {
  return p?.id || p?.employeeId || null;
}

export function expandStationIds(
  stations: EscalationData["stations"],
  ids: Array<string | null | undefined>,
) {
  const kids = new Map<string, string[]>();
  (stations || []).forEach((station) => {
    const parent = String(station.parentStationId || station.parentBranchId || "").trim();
    const id = String(station.id || station.stationId || "").trim();
    if (!parent || !id) return;
    const bucket = kids.get(parent) || [];
    bucket.push(id);
    kids.set(parent, bucket);
  });
  const out = new Set<string>();
  (ids || []).forEach((raw) => {
    const seed = String(raw || "").trim();
    if (!seed || seed === "all") return;
    const stack = [seed];
    while (stack.length) {
      const current = stack.pop();
      if (!current || out.has(current)) continue;
      out.add(current);
      (kids.get(current) || []).forEach((child) => stack.push(child));
    }
  });
  return out;
}

function userCoversStation(
  user: { stationId?: string | null; managedStations?: string[] } | null | undefined,
  data: EscalationData | null | undefined,
  stationId?: string | null,
) {
  if (!stationId) return true;
  const home = String(user?.stationId || "").trim();
  const extras = (user?.managedStations || []).map((id) => String(id || "").trim()).filter(Boolean);
  return expandStationIds(data?.stations, [home, ...extras]).has(String(stationId));
}

function opsHrGroups(data?: EscalationData | null) {
  const levels = Array.isArray(data?.hrLevels) ? data.hrLevels : [];
  const orders = [...new Set(levels.map((l) => l.order))].sort((a, b) => Number(a) - Number(b));
  return orders
    .map((order) => ({
      order,
      scope: levels.find((l) => l.order === order)?.scope || "company",
      manager: levels.find((l) => l.order === order && l.role === "manager") || null,
    }))
    .filter((g) => g.manager && g.manager.active !== false);
}

export function opsStageCount(data?: EscalationData | null, stationId?: string | null) {
  const branch = deriveBranchEscalationChain(stationId || null, data);
  if (branch.length) return branch.length;
  const hr = opsHrGroups(data).length;
  return hr > 0 ? hr + 1 : OPS_ROLE_LADDER.length;
}

export function opsHandlersAt(levelIdx: number, task: OpsTaskLike, data?: EscalationData | null) {
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
      if (e.hrLevelId !== group.manager?.id) return false;
      if (group.manager.stationIds?.length && stationId && !group.manager.stationIds.includes(stationId)) return false;
      if (group.scope === "station") return e.hrStationId === stationId;
      if (group.scope === "cluster") {
        const cluster = (data?.hrClusters || []).find((c) => (c.stationIds || []).includes(stationId || ""));
        return cluster ? e.hrClusterId === cluster.id : false;
      }
      return true;
    });
  }
  const role = OPS_ROLE_LADDER[levelIdx];
  if (!role) return [];
  return employees.filter((e) => {
    const isOwner = e.role === "owner" || e.isOwner;
    if (role === "owner") return !!isOwner;
    if (e.role !== role) return false;
    if (role === "station_manager") {
      return !stationId || userCoversStation(e, data, stationId);
    }
    return true;
  });
}

export function nextOpsEscalation(task: OpsTaskLike, data?: EscalationData | null, rejecterId?: string | null) {
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
  return { escalate: false, nextLevel: current, handlers: [] as EscalationPerson[], atTop: true };
}

export function checkRejectReasonGate(reason: unknown, lang = "ar") {
  if (!String(reason || "").trim()) {
    return {
      ok: false as const,
      error: "REASON_REQUIRED",
      reason: lang === "ar" ? "اكتب سبب الرفض — لا رفض بلا سبب مكتوب." : "Write a rejection reason — no silent reject.",
    };
  }
  return { ok: true as const };
}

export function applyOpsReject(task: OpsTaskLike & Record<string, unknown>, input: {
  reason?: string;
  escalate?: boolean;
  nextLevel?: number;
  reviewerId?: string | null;
  reviewerName?: string;
  now?: string;
} = {}) {
  const at = input.now || new Date().toISOString();
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const stored = Math.max(0, Math.round(Number(task.rejectCount) || 0));
  const fromComments = comments.filter((c: { is_rejection?: boolean }) => c && c.is_rejection).length;
  const rejectCount = Math.max(stored, fromComments) + 1;
  const entry = {
    id: `rej_${at}`,
    authorId: input.reviewerId || null,
    authorName: input.reviewerName || "",
    text: String(input.reason || "").trim(),
    isIssue: false,
    is_rejection: true,
    is_escalation: !!input.escalate,
    at,
  };
  if (input.escalate) {
    return {
      ...task,
      status: "awaiting_approval",
      rejectCount,
      escalationLevel: input.nextLevel,
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

export function opsRejectionCount(task: OpsTaskLike & { rejectCount?: number; comments?: Array<{ is_rejection?: boolean }> }) {
  const stored = Math.max(0, Math.round(Number(task?.rejectCount) || 0));
  const fromComments = (Array.isArray(task?.comments) ? task.comments : [])
    .filter((c) => c && c.is_rejection)
    .length;
  return Math.max(stored, fromComments);
}

export function isOpsTaskAssignee(
  task: OpsTaskLike & { memberIds?: string[] },
  user: { id?: string; employeeId?: string } | null,
) {
  const uid = String(user?.id || user?.employeeId || "");
  if (!uid || !task) return false;
  if (String(taskAssigneeId(task) || "") === uid) return true;
  const members = Array.isArray(task.memberIds) ? task.memberIds.map(String) : [];
  return members.includes(uid);
}

export function canEmployeeEscalateOpsTask(
  task: OpsTaskLike & { memberIds?: string[]; rejectCount?: number; comments?: Array<{ is_rejection?: boolean }> },
  user: { id?: string; employeeId?: string } | null,
  data?: EscalationData | null,
) {
  if (!task || isDone(task) || isOpsTaskDeleted(task)) return false;
  if (isAwaitingApproval(task)) return false;
  if (!isOpsTaskAssignee(task, user)) return false;
  if (opsRejectionCount(task) < OPS_EMPLOYEE_ESCALATE_AFTER) return false;
  return nextOpsEscalation(task, data).escalate;
}

export function applyOpsEmployeeEscalate(task: OpsTaskLike & Record<string, unknown>, input: {
  reason?: string;
  nextLevel?: number;
  actorId?: string | null;
  actorName?: string;
  now?: string;
} = {}) {
  const at = input.now || new Date().toISOString();
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const text = String(input.reason || "").trim() || "تصعيد من المنفّذ بعد ثلاثة رفض.";
  return {
    ...task,
    status: "awaiting_approval",
    escalationLevel: input.nextLevel,
    escalatedAt: at,
    employeeEscalatedAt: at,
    comments: [...comments, {
      id: `esc_${at}`,
      authorId: input.actorId || null,
      authorName: input.actorName || "",
      text,
      isIssue: false,
      is_rejection: false,
      is_escalation: true,
      kind: "employee_escalate",
      at,
    }],
  };
}

export function canReviewOpsTask(
  task: OpsTaskLike,
  user: { id?: string; employeeId?: string; role?: string; stationId?: string | null; managedStations?: string[]; isOwner?: boolean; admin?: boolean } | null,
  data?: EscalationData | null,
) {
  if (!user || !task || isDone(task)) return false;
  if (user.isOwner || user.admin || user.role === "owner" || user.role === "admin") return true;
  const uidEarly = String(user.id || user.employeeId || "");
  const branch = deriveBranchEscalationChain(task.stationId, data);
  if (branch.length && uidEarly) {
    const at = Math.max(0, Number(task.escalationLevel) || 0);
    return branch.slice(at).some((s) => String(s.employeeId) === uidEarly);
  }
  const level = Math.max(0, Number(task.escalationLevel) || 0);
  const handlers = opsHandlersAt(level, task, data);
  const uid = String(user.id || user.employeeId || "");
  if (uid && handlers.some((h) => String(personId(h)) === uid)) return true;
  const role = user.role;
  if (level === 0 && ["director", "ops_manager", "station_manager", "pgm"].includes(String(role))) {
    if (role === "station_manager") {
      return !task.stationId || userCoversStation(user, data, task.stationId);
    }
    return true;
  }
  if (level > 0 && ["director", "ops_manager", "pgm"].includes(String(role))) return true;
  return false;
}

/** Every ops counter is derived from the scoped rows — never stored literals. */
export function deriveHorizonGroups(tasks: OpsTaskLike[], today = new Date()) {
  const order = ["y", "h", "q", "m", "w"] as const;
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

export function deriveOpsCounts(tasks: OpsTaskLike[], today = new Date()) {
  const raw = Array.isArray(tasks) ? tasks : [];
  const kept = raw.filter((t) => !isOpsTaskDeleted(t));
  const list = kept.filter((t) => !isDone(t));
  const done = kept.filter((t) => isDone(t)).length;
  const overdue = list.filter((t) => isOverdue(t, today)).length;
  const dueToday = list.filter((t) => isDueToday(t, today)).length;
  const awaiting = list.filter((t) => isAwaitingApproval(t)).length;
  const escalated = list.filter((t) => isEscalated(t)).length;
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

export function certCodeOf(cert: Record<string, unknown> | null | undefined) {
  if (!cert) return "";
  const raw = String(cert.code || cert.kind || cert.certCode || cert.category || cert.name || "").toLowerCase();
  if (["fa", "first_aid", "first-aid", "إسعاف"].some((k) => raw.includes(k.replace("_", "")))) return "fa";
  if (raw.includes("loto") || raw.includes("عزل")) return "loto";
  if (raw.includes("wah") || raw.includes("ارتفاع") || raw.includes("height")) return "wah";
  if (raw.includes("cs") || raw.includes("محصور") || raw.includes("confined")) return "cs";
  if (CERT_FOR[raw] !== undefined || CERT_LABELS[raw]) return raw;
  return raw;
}

export function certIsCurrent(cert: Record<string, unknown> | null | undefined, today = new Date()) {
  if (!cert) return false;
  const status = String(cert.status || "approved").toLowerCase();
  if (status === "rejected" || status === "pending" || status === "expired") return false;
  const exp = cert.expiryDate || cert.expiresAt || cert.exp || cert.validUntil;
  if (!exp) return status === "approved" || status === "valid" || status === "active" || !cert.status;
  const end = new Date(`${String(exp).slice(0, 10)}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() >= localDayStart(today).getTime();
}

export function employeeLacksCert(
  employee: { employeeId?: string; id?: string; name?: string; certificates?: unknown[] } | null,
  required: string | null,
  today = new Date(),
) {
  if (!required) return false;
  const certs = Array.isArray(employee?.certificates) ? employee.certificates : [];
  return !certs.some((c) => certCodeOf(c as Record<string, unknown>) === required && certIsCurrent(c as Record<string, unknown>, today));
}

export type AssignGatePerson = {
  employeeId: string;
  id?: string;
  name?: string;
  stationId?: string | null;
  homeStationId?: string | null;
  certificates?: unknown[];
};

/** Home workplace of an employee — not the executing station of a task. */
export function employeeHomeStationId(person?: {
  homeStationId?: string | null;
  stationId?: string | null;
  station_id?: string | null;
} | null) {
  return String(person?.homeStationId || person?.stationId || person?.station_id || "").trim();
}

/**
 * Temporary dispatch: employee keeps their home branch; the task executes elsewhere.
 * Not an HR transfer.
 */
export function opsVisitorStamp(person: {
  homeStationId?: string | null;
  stationId?: string | null;
  station_id?: string | null;
  visitor?: boolean;
} | null | undefined, executeStationId?: string | null) {
  const homeStationId = employeeHomeStationId(person);
  const execute = String(executeStationId || "").trim();
  const visitor = !!(homeStationId && execute && homeStationId !== execute);
  return { homeStationId: homeStationId || null, visitor };
}

export function isOpsVisitorTask(task?: {
  stationId?: string | null;
  homeStationId?: string | null;
  visitor?: boolean;
} | null) {
  if (!task) return false;
  return opsVisitorStamp(
    { homeStationId: task.homeStationId, stationId: task.homeStationId, visitor: task.visitor },
    task.stationId,
  ).visitor === true;
}

export function taskAssignScope(task?: { assignMode?: string | null; memberIds?: string[] | null } | null) {
  const mode = String(task?.assignMode || "one");
  if (mode === "all") return "station" as const;
  if (mode === "some") {
    const n = (Array.isArray(task?.memberIds) ? task.memberIds : []).filter(Boolean).length;
    return n === 1 ? "person" as const : "group" as const;
  }
  return "person" as const;
}

export function taskAssignScopeLabel(task?: { assignMode?: string | null; memberIds?: string[] | null } | null, ar = true) {
  const scope = taskAssignScope(task);
  if (scope === "station") return ar ? "الفرع" : "Station";
  if (scope === "group") return ar ? "عدة أشخاص" : "Several people";
  return ar ? "شخص" : "Person";
}

export function taskAssigneeIds(task?: {
  assignMode?: string | null;
  memberIds?: string[] | null;
  ownerId?: string | null;
  employee_id?: string | null;
  assignedTo?: string | null;
} | null) {
  const members = (Array.isArray(task?.memberIds) ? task.memberIds : []).map(String).filter(Boolean);
  const mode = String(task?.assignMode || "one");
  if ((mode === "some" || mode === "all") && members.length) {
    return [...new Set(members)];
  }
  const owner = String(task?.ownerId || task?.employee_id || task?.assignedTo || "").trim();
  if (owner) return [owner];
  return [...new Set(members)];
}

export function taskAssigneePeople(
  task?: {
    assignMode?: string | null;
    memberIds?: string[] | null;
    ownerId?: string | null;
    employee_id?: string | null;
    assignedTo?: string | null;
    ownerName?: string | null;
  } | null,
  people: Array<{ id?: string; employeeId?: string; name?: string }> = [],
) {
  const ids = taskAssigneeIds(task);
  const out: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();
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

export function taskPeopleCountLabel(count: number, ar = true) {
  const n = Math.max(0, Number(count) || 0);
  if (!ar) return n === 1 ? "1 person" : `${n} people`;
  if (n === 0) return "لا أحد";
  if (n === 1) return "1 شخص";
  if (n === 2) return "شخصان";
  if (n >= 3 && n <= 10) return `${n} أشخاص`;
  return `${n} شخصًا`;
}

function matchOpsPerson(people: Array<{ id?: string; employeeId?: string; name?: string }> | undefined, id?: string | null) {
  const want = String(id || "").trim();
  if (!want) return null;
  return (people || []).find((person) => (
    String(person?.id || "") === want || String(person?.employeeId || "") === want
  )) || null;
}

export function taskCreatorName(
  task?: {
    createdBy?: string | null;
    createdByName?: string | null;
    actionLog?: Array<{ type?: string; byName?: string }>;
  } | null,
  people: Array<{ id?: string; employeeId?: string; name?: string }> = [],
) {
  const named = String(task?.createdByName || "").trim();
  if (named) return named;
  const fromLog = (Array.isArray(task?.actionLog) ? task.actionLog : []).find((entry) => entry?.type === "create");
  const logName = String(fromLog?.byName || "").trim();
  if (logName) return logName;
  return String(matchOpsPerson(people, task?.createdBy)?.name || "").trim();
}

/**
 * Server-side assignment gate. Validates that an owner/team exists in the
 * company. Expired competency certificates are informational only.
 */
export function checkAssignGate(input: {
  workKind: string;
  assignMode: AssignMode;
  ownerId?: string | null;
  memberIds?: string[];
  stationId?: string | null;
  people: AssignGatePerson[];
  lang?: "ar" | "en";
  today?: Date;
}) {
  const required = CERT_FOR[input.workKind] ?? null;
  const lang = input.lang === "en" ? "en" : "ar";
  if (!required) return { ok: true as const, required: null, blocked: [] as AssignGatePerson[] };

  const label = CERT_LABELS[required]?.[lang] || required;
  const byId = new Map<string, AssignGatePerson>();
  for (const p of input.people || []) {
    if (p.employeeId) byId.set(String(p.employeeId), p);
    if (p.id) byId.set(String(p.id), p);
  }

  if (input.assignMode === "one") {
    if (!input.ownerId) {
      return {
        ok: false as const,
        required,
        blocked: [],
        reason: lang === "ar" ? "لا يمكن الإسناد: لم يُحدَّد مسؤول." : "Cannot assign: no owner selected.",
        certLabel: label,
      };
    }
    if (!byId.get(input.ownerId)) {
      return {
        ok: false as const,
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
        ok: false as const,
        required,
        blocked: [],
        reason: lang === "ar" ? "لا يمكن الإسناد: لم يُختَر أحد من الفريق." : "Cannot assign: no team members selected.",
        certLabel: label,
      };
    }
    if (ids.some((id) => !byId.has(id))) {
      return {
        ok: false as const,
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
      ok: false as const,
      required,
      blocked: [],
      reason: lang === "ar" ? "لا يمكن الإسناد: لا طاقم في هذا الفرع." : "Cannot assign: no crew at this station.",
      certLabel: label,
    };
  }

  return { ok: true as const, required, blocked: [], certLabel: label };
}

export type AssignmentHistoryEntry = {
  fromId?: string | null;
  toId: string;
  byId?: string | null;
  reason?: string;
  at: string;
  kind?: "acting" | "transfer" | "delegate" | "end";
  delegatedAt?: string | null;
  actingUntil?: string | null;
  endedAt?: string | null;
  transferredAt?: string | null;
  fromName?: string;
  toName?: string;
  byName?: string;
};

export function taskAssigneeId(task: { ownerId?: string | null; employee_id?: string | null; assignedTo?: string | null } | null | undefined) {
  return task?.ownerId || task?.employee_id || task?.assignedTo || null;
}

export function latestAssignment(task: { assignmentHistory?: AssignmentHistoryEntry[] } | null | undefined) {
  const hist = Array.isArray(task?.assignmentHistory) ? task.assignmentHistory : [];
  return hist.length ? hist[hist.length - 1] : null;
}

/** YYYY-MM-DD for the latest delegation start, if any. */
export function taskDelegatedAt(task: {
  delegatedAt?: string | null;
  assignmentHistory?: AssignmentHistoryEntry[];
} | null | undefined) {
  const direct = String(task?.delegatedAt || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const entry = latestOpenDelegation(task) || latestAssignment(task);
  const fromEntry = String(entry?.delegatedAt || entry?.at || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(fromEntry) ? fromEntry : "";
}

export function latestOpenDelegation(task: { assignmentHistory?: AssignmentHistoryEntry[] } | null | undefined) {
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

export function taskDelegationMeta(task: {
  delegatedAt?: string | null;
  actingUntil?: string | null;
  delegationEndedAt?: string | null;
  delegationActive?: boolean | null;
  delegationById?: string | null;
  delegationByName?: string | null;
  originalOwnerId?: string | null;
  ownerName?: string | null;
  assignmentHistory?: AssignmentHistoryEntry[];
} | null | undefined) {
  const hist = Array.isArray(task?.assignmentHistory) ? task.assignmentHistory : [];
  let open: AssignmentHistoryEntry | null = null;
  let ended: AssignmentHistoryEntry | null = null;
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

function stampLabel(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16).replace("T", " ");
  return raw.slice(0, 10);
}

function formatAuditWhen(iso?: string | null) {
  const raw = String(iso || "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return stampLabel(raw);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function assignmentHistoryNote(entry: AssignmentHistoryEntry | null | undefined, lang = "ar") {
  if (!entry) return "";
  const from = entry.fromName || "—";
  const to = entry.toName || "—";
  const reason = String(entry.reason || "").trim();
  const kind = entry.kind === "transfer"
    ? "transfer"
    : (entry.kind === "acting" ? "acting" : (entry.kind === "end" ? "end" : "delegate"));
  const until = stampLabel(entry.actingUntil);
  const when = stampLabel(entry.delegatedAt || entry.transferredAt || entry.at);
  const ended = String(entry.endedAt || (kind === "end" ? entry.at : "") || "").slice(0, 10);
  if (lang === "en") {
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
    const base = reason ? `Delegated from ${from} to ${to} — ${reason}` : `Delegated from ${from} to ${to}`;
    const range = when && until ? `${when} → ${until}` : (when || until);
    return range ? `${base} · ${range}` : base;
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
  const base = reason ? `وُكِّل من ${from} إلى ${to} — ${reason}` : `وُكِّل من ${from} إلى ${to}`;
  const range = when && until ? `${when} → ${until}` : (when || until);
  return range ? `${base} · ${range}` : base;
}

/** Manager-only توكيل. Closed / approved / awaiting-review tasks stay on the proof chain. */
export function canReassignOpsTask(
  task: OpsTaskLike & { assignMode?: string; ownerId?: string | null; employee_id?: string | null; assignedTo?: string | null },
  user: EscalationPerson & { admin?: boolean } | null | undefined,
  data?: EscalationData | null,
) {
  if (!user || !task) return false;
  if (isDone(task) || isAwaitingApproval(task)) return false;
  const uid = user.id || user.employeeId;
  const isOwner = user.role === "owner" || user.isOwner || user.admin
    || (data?.ownerId && uid && String(uid) === String(data.ownerId));
  if (isOwner) return true;
  if (!["director", "ops_manager", "pgm", "station_manager"].includes(String(user.role || ""))) return false;
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

export function checkReassignGate(input: {
  task: OpsTaskLike & { assignMode?: string; ownerId?: string | null; employee_id?: string | null; assignedTo?: string | null };
  user: EscalationPerson & { admin?: boolean };
  data?: EscalationData | null;
  toId?: string | null;
  reason?: string;
  kind?: "acting" | "transfer" | "delegate";
  delegatedAt?: string | null;
  actingUntil?: string | null;
  people?: Array<{ employeeId?: string; id?: string }>;
  lang?: "ar" | "en";
}) {
  const lang = input.lang === "en" ? "en" : "ar";
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

  if (!canReassignOpsTask(input.task, input.user, input.data)) {
    return {
      ok: false as const,
      error: "REASSIGN_FORBIDDEN",
      reason: lang === "ar"
        ? "التوكيل للمدير فقط — وبعد الإنجاز أو الاعتماد لا يُعاد إسناد المهمة."
        : "Only a manager can delegate, and a completed or approved task cannot be reassigned.",
    };
  }
  if (!reason) {
    return {
      ok: false as const,
      error: "REASON_REQUIRED",
      reason: lang === "ar"
        ? "اكتب سبب التوكيل أو النقل."
        : "Write why the task is being reassigned.",
    };
  }
  if (!toId) {
    return {
      ok: false as const,
      error: "ASSIGNEE_REQUIRED",
      reason: lang === "ar" ? "اختر الموظف المستلم." : "Pick the receiving employee.",
    };
  }
  if (kind !== "transfer" && !delegatedAt) {
    return {
      ok: false as const,
      error: "DELEGATED_AT_REQUIRED",
      reason: lang === "ar"
        ? "حدّد بداية التوكيل."
        : "Set when the delegation starts.",
    };
  }
  if (kind === "transfer" && !delegatedAt) {
    return {
      ok: false as const,
      error: "TRANSFER_DATE_REQUIRED",
      reason: lang === "ar"
        ? "حدّد تاريخ النقل."
        : "Set the transfer date.",
    };
  }
  if (kind !== "transfer" && !actingUntil) {
    return {
      ok: false as const,
      error: "ACTING_UNTIL_REQUIRED",
      reason: lang === "ar"
        ? "حدّد نهاية التوكيل."
        : "Set when the delegation ends.",
    };
  }
  if (kind !== "transfer" && delegatedAt && actingUntil && actingUntil < delegatedAt) {
    return {
      ok: false as const,
      error: "ACTING_UNTIL_INVALID",
      reason: lang === "ar"
        ? "نهاية التوكيل يجب أن تكون في يوم البداية أو بعده."
        : "Delegation end must be on or after the start date.",
    };
  }
  if (kind !== "transfer" && actingUntil && actingUntil < todayKey) {
    return {
      ok: false as const,
      error: "ACTING_UNTIL_INVALID",
      reason: lang === "ar"
        ? "نهاية التوكيل يجب أن تكون اليوم أو لاحقًا."
        : "Delegation end must be today or later.",
    };
  }
  const fromId = String(taskAssigneeId(input.task) || "");
  if (fromId && fromId === toId) {
    return {
      ok: false as const,
      error: "SELF_REASSIGN_FORBIDDEN",
      reason: lang === "ar" ? "لا توكيل إلى نفس المسؤول الحالي." : "Cannot delegate to the current assignee.",
    };
  }
  const people = Array.isArray(input.people) ? input.people : [];
  if (people.length && !people.some((p) => String(p.employeeId || p.id) === toId)) {
    return {
      ok: false as const,
      error: "ASSIGNEE_OUT_OF_SCOPE",
      reason: lang === "ar"
        ? "الموظف المختار خارج نطاق الفرع الظاهر."
        : "Selected employee is outside the visible station scope.",
    };
  }
  return {
    ok: true as const,
    kind,
    delegatedAt,
    actingUntil: kind === "transfer" ? "" : actingUntil,
    fromId: fromId || null,
    toId,
  };
}

export function applyOpsReassign(task: OpsTaskLike & Record<string, unknown>, input: {
  fromId?: string | null;
  toId: string;
  byId?: string | null;
  reason?: string;
  at?: string;
  kind?: "acting" | "transfer" | "delegate";
  delegatedAt?: string | null;
  actingUntil?: string | null;
  fromName?: string;
  toName?: string;
  byName?: string;
  homeStationId?: string | null;
  toStationId?: string | null;
  visitor?: boolean;
  lang?: "ar" | "en";
} = { toId: "" }) {
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
  const entry: AssignmentHistoryEntry = {
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
  const prevLog = Array.isArray((task as any).actionLog) ? (task as any).actionLog : [];
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
    assignmentHistory: [...(Array.isArray(task.assignmentHistory) ? task.assignmentHistory as AssignmentHistoryEntry[] : []), entry],
    actionLog: [
      ...prevLog,
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
    transferredAt: (task as any).transferredAt || null,
    transferredById: (task as any).transferredById || null,
    transferredByName: (task as any).transferredByName || null,
  };
}

export function taskTransferMeta(task: {
  transferredAt?: string | null;
  transferredById?: string | null;
  transferredByName?: string | null;
  assignmentKind?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  assignmentHistory?: AssignmentHistoryEntry[];
} | null | undefined) {
  const hist = Array.isArray(task?.assignmentHistory) ? task.assignmentHistory : [];
  let entry: AssignmentHistoryEntry | null = null;
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

export function canEndOpsDelegation(
  task: OpsTaskLike & {
    assignMode?: string;
    ownerId?: string | null;
    employee_id?: string | null;
    assignedTo?: string | null;
    originalOwnerId?: string | null;
    delegatedAt?: string | null;
    actingUntil?: string | null;
    delegationEndedAt?: string | null;
    delegationActive?: boolean | null;
    delegationById?: string | null;
    delegationByName?: string | null;
    ownerName?: string | null;
    assignmentHistory?: AssignmentHistoryEntry[];
  },
  user: EscalationPerson & { admin?: boolean } | null | undefined,
  data?: EscalationData | null,
) {
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

export function checkEndDelegationGate(input: {
  task: OpsTaskLike & Record<string, unknown>;
  user: EscalationPerson & { admin?: boolean };
  data?: EscalationData | null;
  reason?: string;
  lang?: "ar" | "en";
}) {
  const lang = input.lang === "en" ? "en" : "ar";
  const reason = String(input.reason || "").trim();
  if (!canEndOpsDelegation(input.task as any, input.user, input.data)) {
    return {
      ok: false as const,
      error: "END_DELEGATION_FORBIDDEN",
      reason: lang === "ar"
        ? "إنهاء الوكالة للموكِّل أو المدير فقط، وعلى وكالة نشطة."
        : "Only the delegator or a manager can end an active delegation.",
    };
  }
  if (!reason) {
    return {
      ok: false as const,
      error: "REASON_REQUIRED",
      reason: lang === "ar" ? "اكتب سبب إنهاء الوكالة." : "Write why the delegation is ending.",
    };
  }
  const meta = taskDelegationMeta(input.task as any);
  const restoreId = String(meta?.fromId || (input.task as any)?.originalOwnerId || "").trim();
  if (!restoreId) {
    return {
      ok: false as const,
      error: "RESTORE_OWNER_MISSING",
      reason: lang === "ar"
        ? "لا يمكن إرجاع المهمة — المالك الأصلي غير معروف."
        : "Cannot restore the task — original owner is unknown.",
    };
  }
  return { ok: true as const, restoreId, meta };
}

export function applyOpsEndDelegation(task: OpsTaskLike & Record<string, unknown>, input: {
  restoreId?: string | null;
  byId?: string | null;
  reason?: string;
  endedAt?: string | null;
  fromName?: string;
  toName?: string;
  byName?: string;
  lang?: "ar" | "en";
} = {}) {
  const meta = taskDelegationMeta(task as any) || {} as any;
  const restoreId = String(input.restoreId || meta.fromId || task.originalOwnerId || "").trim();
  const endedAtRaw = String(input.endedAt || "").trim().slice(0, 10);
  const endedAt = /^\d{4}-\d{2}-\d{2}$/.test(endedAtRaw)
    ? endedAtRaw
    : new Date().toISOString().slice(0, 10);
  const at = `${endedAt}T12:00:00.000Z`;
  const fromId = taskAssigneeId(task);
  const reason = String(input.reason || "").trim();
  const entry: AssignmentHistoryEntry = {
    fromId,
    toId: restoreId,
    byId: input.byId || null,
    reason,
    at,
    kind: "end",
    delegatedAt: meta.start || (task as any).delegatedAt || null,
    actingUntil: meta.end || (task as any).actingUntil || null,
    endedAt,
    fromName: input.fromName || meta.toName || (task as any).ownerName || "",
    toName: input.toName || meta.fromName || "",
    byName: input.byName || "",
  };
  const note = assignmentHistoryNote(entry, input.lang === "en" ? "en" : "ar");
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const prevLog = Array.isArray((task as any).actionLog) ? (task as any).actionLog : [];
  return {
    ...task,
    ownerId: restoreId,
    assignedTo: restoreId,
    employee_id: restoreId,
    ownerName: entry.toName || task.ownerName,
    assignmentKind: null,
    delegationActive: false,
    delegationEndedAt: endedAt,
    delegatedAt: meta.start || (task as any).delegatedAt || null,
    actingUntil: meta.end || (task as any).actingUntil || null,
    assignmentHistory: [...(Array.isArray(task.assignmentHistory) ? task.assignmentHistory as AssignmentHistoryEntry[] : []), entry],
    actionLog: [
      ...prevLog,
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

export function applyOpsExtendDue(task: OpsTaskLike & Record<string, unknown>, input: {
  dueAt?: string;
  reason?: string;
  byId?: string | null;
  byName?: string;
  lang?: "ar" | "en";
  at?: string;
  expected?: number;
  logged?: number;
  gap?: number;
  blockerDay?: string;
  day?: string;
  resolveBlocker?: boolean;
} = {}) {
  const at = input.at || new Date().toISOString();
  const nextDue = String(input.dueAt || "").trim();
  const reason = String(input.reason || "").trim();
  const prevLog = Array.isArray((task as any).actionLog) ? (task as any).actionLog : [];
  const comments = Array.isArray(task.comments) ? task.comments : [];
  let next: OpsTaskLike & Record<string, unknown> = {
    ...task,
    dueAt: nextDue || task.dueAt,
    actionLog: [
      ...prevLog,
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
      ...comments,
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
      at,
      reason,
      resolution: "extend",
      day: input.blockerDay || input.day,
      expected: input.expected,
      logged: input.logged,
      gap: input.gap,
      byId: input.byId,
      byName: input.byName,
    });
  }
  return next;
}

/** Re-split current remaining count evenly from today through due. */
export function applyOpsRedistributeRemaining(task: OpsTaskLike & Record<string, unknown>, input: {
  reason?: string;
  byId?: string | null;
  byName?: string;
  lang?: "ar" | "en";
  at?: string;
  paceStartAt?: string;
  expected?: number;
  logged?: number;
  gap?: number;
  blockerDay?: string;
  day?: string;
  resolveBlocker?: boolean;
} = {}) {
  const at = input.at || new Date().toISOString();
  const today = isoDayKey(input.paceStartAt || at);
  const target = Math.max(1, Number(task.targetCount) || 1);
  const done = Math.max(0, Number(task.completedCount) || 0);
  const remaining = Math.max(0, target - done);
  const reason = String(input.reason || "").trim();
  const prevLog = Array.isArray((task as any).actionLog) ? (task as any).actionLog : [];
  const comments = Array.isArray(task.comments) ? task.comments : [];
  let next: OpsTaskLike & Record<string, unknown> = {
    ...task,
    paceStartAt: today,
    paceSpreadTarget: remaining,
    paceDayPlan: {},
    actionLog: [
      ...prevLog,
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
      ...comments,
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
      at,
      reason,
      resolution: "redistribute",
      day: input.blockerDay || input.day || today,
      expected: input.expected,
      logged: input.logged,
      gap: input.gap,
      byId: input.byId,
      byName: input.byName,
    });
  }
  return next;
}

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
export function riyadhClock(now: Date | string | number = new Date()) {
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
] as const;

export type TaskMode = (typeof TASK_MODES)[number]["id"];

export function normalizeTaskMode(value: unknown): TaskMode | "" {
  const raw = String(value ?? "").trim().toLowerCase();
  return (TASK_MODES.some((m) => m.id === raw) ? raw : "") as TaskMode | "";
}

export function taskModeLabel(value: unknown, lang: "ar" | "en" = "ar") {
  const row = TASK_MODES.find((m) => m.id === normalizeTaskMode(value));
  if (!row) return lang === "ar" ? "طبيعة غير محدَّدة" : "Nature not set";
  return lang === "ar" ? row.ar : row.en;
}

/** The place is stated, never defaulted — a silent onsite would decide the sun ban for the crew. */
export function checkTaskModeGate(value: unknown, lang: "ar" | "en" = "ar") {
  const mode = normalizeTaskMode(value);
  if (mode) return { ok: true as const, mode };
  return {
    ok: false as const,
    error: "TASK_MODE_REQUIRED",
    reason: "حدِّد مكان التنفيذ: حضوري داخل المنشأة، أو ميداني في الهواء الطلق، أو عن بُعد. الميداني وحده يخضع لحظر العمل تحت أشعة الشمس.",
    reasonEn: "State where the work happens: on-site indoors, field in the open air, or remote. Only field work falls under the midday sun ban.",
    lang,
  };
}

/** Open-air field work — the nature the supervisor chose, not a guess from the work kind. */
export function isOutdoorFieldTask(task: { mode?: string | null } | null | undefined) {
  if (!task || typeof task !== "object") return false;
  return normalizeTaskMode(task.mode) === "field";
}

/** Field work is still at a site: only remote waives today's check-in. */
export function taskWaivesSiteAttendance(task: { mode?: string | null } | null | undefined) {
  return normalizeTaskMode(task?.mode) === "remote";
}

/**
 * What the chosen place actually costs at logging time — the attendance stamp and
 * the sun ban, with the banned hours named. One source, so the create form, the
 * switch dialog and the task card cannot drift apart.
 */
export function taskModeConsequence(
  value: unknown,
  { ar = true, onDate }: { ar?: boolean; onDate?: string | Date | null } = {},
) {
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
export function checkTaskHeatBanGate(
  task: { mode?: string | null } | null | undefined,
  { now = new Date(), amount = 1 }: { now?: Date | string | number; amount?: unknown } = {},
) {
  if (Math.max(0, Math.round(Number(amount) || 0)) < 1) return { ok: true as const, skipped: "no_unit" as const };
  if (!isOutdoorFieldTask(task)) return { ok: true as const, skipped: "not_outdoor" as const };
  const clock = riyadhClock(now);
  if (!clock) return { ok: true as const, skipped: "no_clock" as const };
  if (!isHeatBanDate(clock.dayKey)) return { ok: true as const, skipped: "off_season" as const };
  if (!isHeatBanMinuteOfDay(clock.minutes, clock.dayKey)) return { ok: true as const, skipped: "off_window" as const };
  const win = heatBanWindow(clock.dayKey);
  const badge = explainRule("hours.heat.startHour", clock.dayKey);
  // The hours are decision 3337's; the cited article is only the basis it was issued on.
  const cite = citeRule("hours.heat.cite", clock.dayKey);
  return {
    ok: false as const,
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
export function deriveTaskHeatBanNotice(
  task: { mode?: string | null; startAt?: string | null; dueAt?: string | null } | null | undefined,
  { startAt, dueAt }: { startAt?: string | null; dueAt?: string | null } = {},
) {
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

export function cumulativePaceExpected(pace: DailyTaskPace | null | undefined, today = new Date()) {
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
    let pacedCum = 0;
    for (let i = 0; i < paced.length; i += 1) {
      if (paced[i] > todayKey) break;
      pacedCum += pace.even + (i < pace.extra ? 1 : 0);
    }
    const pacedBase = pace.redistributed ? Math.max(0, Number(pace.baseDone) || 0) : 0;
    return Math.min(pace.target, pacedBase + pacedCum);
  }
  const dayIndex = calendarDaysInclusive(start, todayKey) - 1;
  let cum = 0;
  for (let i = 0; i <= dayIndex; i += 1) {
    cum += pace.even + (i < pace.extra ? 1 : 0);
  }
  const base = pace.redistributed ? Math.max(0, Number(pace.baseDone) || 0) : 0;
  return Math.min(pace.target, base + cum);
}

export function checkAutoEscalateGate(
  task: OpsTaskLike,
  data?: EscalationData | null,
  now = new Date(),
  opts: { force?: boolean } = {},
) {
  if (isDone(task)) return { ok: false as const, error: "DONE" };
  if (isAwaitingApproval(task)) return { ok: false as const, error: "AWAITING" };

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
      if (pace.overdue || opts.force || hour >= 18) {
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

  if (!breach) return { ok: false as const, error: "NO_BREACH" };

  const dayKey = riyadhDayKey(now);
  if (task.lastAutoEscalationDay === dayKey && !pace.overdue && !opts.force) {
    return { ok: false as const, error: "ALREADY_TODAY" };
  }

  const next = nextOpsEscalation(task, data, null);
  if (!next.escalate) {
    return { ok: false as const, error: "AT_TOP", atTop: true, breachReason, breachReasonEn };
  }

  return {
    ok: true as const,
    nextLevel: next.nextLevel,
    handlers: next.handlers,
    breachReason,
    breachReasonEn,
    pace,
    expected: cumulativePaceExpected(pace, now),
    done,
  };
}

export function applyOpsAutoEscalate(
  task: OpsTaskLike,
  { nextLevel, breachReason, breachReasonEn, now }: {
    nextLevel: number;
    breachReason?: string;
    breachReasonEn?: string;
    now?: Date | string;
  },
) {
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

export function runOpsEscalationSweep(
  tasks: OpsTaskLike[],
  data?: EscalationData | null,
  now = new Date(),
  opts: { force?: boolean } = {},
) {
  let escalated = 0;
  const details: Array<{ taskId?: string; ref?: string; level: number }> = [];
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

export function canUndoOpsAction(task: OpsTaskLike | null | undefined, { now = Date.now(), windowMs = 3 * 60 * 1000 }: { now?: number; windowMs?: number } = {}) {
  if (!task) return false;
  const created = new Date((task as any).createdAt || (task as any).created_date || 0).getTime();
  if (Number.isFinite(created) && now - created <= windowMs && !((task.completedCount || 0) > 0) && !task.approvedAt) {
    return { ok: true, target: "create" as const };
  }
  const log = Array.isArray((task as any).actionLog) ? (task as any).actionLog : [];
  const last = log[log.length - 1];
  if (!last) return false;
  const at = new Date(last.at || 0).getTime();
  if (!Number.isFinite(at) || now - at > windowMs) return false;
  if (["acting", "extend", "comment", "blocker", "delegate"].includes(last.type)) {
    return { ok: true, target: last.type, entry: last };
  }
  return false;
}

export function applyOpsSoftDelete(task: OpsTaskLike, input: {
  at?: string;
  byId?: string | null;
  byName?: string;
  reason?: string;
  ack?: boolean;
  undoCreate?: boolean;
} = {}) {
  const at = input.at || new Date().toISOString();
  const why = String(input.reason || "").trim();
  const logged = Math.max(0, Number(task.completedCount) || 0);
  const prevLog = Array.isArray((task as any).actionLog) ? (task as any).actionLog : [];
  return {
    ...task,
    status: "cancelled",
    deletedAt: at,
    deletedBy: input.byId || null,
    deletedByName: input.byName || "",
    deleteReason: why,
    deleteAck: input.ack !== false,
    actionLog: [
      ...prevLog,
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

export function canDeleteOpsTask(task: OpsTaskLike | null | undefined, user: any) {
  if (!task || isOpsTaskDeleted(task) || isDone(task) || isAwaitingApproval(task)) return false;
  const uid = String(user?.id || user?.employeeId || "");
  const creator = String((task as any).createdBy || "");
  const manager = !!(user && (
    user.role === "owner" || user.isOwner || user.admin
    || ["director", "ops_manager", "pgm", "station_manager"].includes(user.role)
  ));
  if (manager) return true;
  return !!(uid && creator && uid === creator);
}

export function checkDeleteOpsTaskGate(task: OpsTaskLike | null | undefined, user: any, {
  now = Date.now(),
  reason = "",
  ack = false,
  undoCreate = false,
}: { now?: number; reason?: string; ack?: boolean; undoCreate?: boolean } = {}) {
  if (!task) {
    return { ok: false, error: "TASK_REQUIRED", reason: "المهمة غير موجودة.", reasonEn: "The task was not found." };
  }
  if (isOpsTaskDeleted(task)) {
    return { ok: false, error: "ALREADY_DELETED", reason: "المهمة محذوفة أصلًا.", reasonEn: "The task is already deleted." };
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
  const creator = String((task as any).createdBy || "");
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
    return { ok: false, error: "REASON_REQUIRED", reason: "اكتب سبب الحذف.", reasonEn: "Write the deletion reason." };
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

export function buildTaskAuditTimeline(task: OpsTaskLike | null | undefined, lang = "ar") {
  if (!task) return [];
  const ar = lang === "ar";
  const rows: Array<{ id: string; type: string; at: string; when: string; by: string; tone: string; text: string; reason?: string }> = [];
  const createdAt = (task as any).createdAt || (task as any).created_date;
  if (createdAt) {
    rows.push({
      id: "create",
      type: "create",
      at: createdAt,
      when: formatAuditWhen(createdAt),
      by: (task as any).createdByName || "",
      tone: "#14284B",
      text: ar
        ? `أُنشئت المهمة${(task as any).createdByName ? ` بواسطة ${(task as any).createdByName}` : ""}`
        : `Task created${(task as any).createdByName ? ` by ${(task as any).createdByName}` : ""}`,
    });
  }
  for (const entry of (Array.isArray(task.assignmentHistory) ? task.assignmentHistory : [])) {
    rows.push({
      id: (entry as any).id || `hist_${entry.at || entry.delegatedAt}`,
      type: entry.kind || "delegate",
      at: String(entry.at || entry.delegatedAt || (entry as any).transferredAt || ""),
      when: formatAuditWhen(entry.at || entry.delegatedAt || (entry as any).transferredAt),
      by: entry.byName || "",
      tone: entry.kind === "transfer" ? "#B91C1C" : "#B45309",
      text: assignmentHistoryNote(entry, lang),
    });
  }
  for (const entry of (Array.isArray((task as any).actionLog) ? (task as any).actionLog : [])) {
    if (!entry || entry.type === "create" || entry.type === "delete" || entry.type === "undo_create") continue;
    const labelMap: Record<string, string> = {
      undo: ar ? `تُراجع إجراء: ${entry.undoneType || "—"}` : `Undid action: ${entry.undoneType || "—"}`,
      extend: ar ? `مُدّد الموعد إلى ${entry.toDue || "—"}` : `Due extended to ${entry.toDue || "—"}`,
      redistribute_pace: ar ? "وُزِّع المتبقي على الأيام" : "Remainder redistributed across days",
      acting: ar ? "توكيل" : "Delegation",
      delegate: ar ? "توكيل" : "Delegation",
      transfer: ar ? "نقل ملكية" : "Ownership transfer",
      comment: ar ? "تعليق" : "Comment",
      blocker: ar ? "عائق" : "Blocker",
    };
    rows.push({
      id: entry.id || `log_${entry.at}`,
      type: entry.type,
      at: entry.at,
      when: formatAuditWhen(entry.at),
      by: entry.byName || "",
      reason: String(entry.reason || "").trim(),
      tone: "#64748B",
      text: labelMap[entry.type] || entry.type,
    });
  }
  if (task.approvedAt) {
    rows.push({
      id: "approve",
      type: "approve",
      at: task.approvedAt,
      when: formatAuditWhen(task.approvedAt),
      by: (task as any).approvedByName || "",
      tone: "#15803D",
      text: ar ? "اعتُمد الإنجاز" : "Completion approved",
    });
  }
  const deleteLog = (Array.isArray((task as any).actionLog) ? (task as any).actionLog : [])
    .find((entry: any) => entry && (entry.type === "delete" || entry.type === "undo_create"));
  if ((task as any).deletedAt || deleteLog) {
    const at = (task as any).deletedAt || deleteLog.at;
    const why = String((task as any).deleteReason || deleteLog?.reason || "").trim();
    const logged = Math.max(0, Number(deleteLog?.loggedCount ?? task.completedCount) || 0);
    const target = Math.max(1, Number(task.targetCount) || 1);
    const who = String((task as any).deletedByName || deleteLog?.byName || "").trim();
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
