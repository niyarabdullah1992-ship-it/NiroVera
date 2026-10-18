/**
 * What a work-order card reads beyond the count: where the order should be by today, how the last
 * seven days went, the last entry and its proof, who on a team did what, and the points it carries.
 * Pure helpers over the task record — the card shows them, nothing here writes.
 */
import { calendarDaysInclusive, deriveDailyTaskPace, isoDayKey, normalizePaceDayPlan, taskPaceInput, taskPoints } from "./opsDerivations.js";

function addDays(key, n) {
  const [y, m, d] = String(key).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Units logged per day, from the day log, else from the thread's log entries. */
export function taskDayLog(task) {
  const fromLog = task?.paceDayLog && typeof task.paceDayLog === "object" ? task.paceDayLog : null;
  if (fromLog && Object.keys(fromLog).length) {
    const out = {};
    for (const [k, v] of Object.entries(fromLog)) {
      const day = isoDayKey(k);
      if (day) out[day] = (out[day] || 0) + Math.max(0, Number(v) || 0);
    }
    return out;
  }
  const out = {};
  for (const c of Array.isArray(task?.comments) ? task.comments : []) {
    if (c?.kind !== "log") continue;
    const day = isoDayKey(c.at || c.createdAt);
    if (day) out[day] = (out[day] || 0) + Math.max(0, Number(c.amount) || 0);
  }
  return out;
}

/** The days the order is meant to be worked, in order (its own day list, or every day start → due). */
function workDays(task, pace) {
  if (pace.custom) return Object.keys(pace.dayPlan || {}).sort();
  if (Array.isArray(pace.paceDays) && pace.paceDays.length) return pace.paceDays;
  const start = pace.start;
  const due = pace.due;
  if (!start || !due || start > due) return [];
  const n = calendarDaysInclusive(start, due);
  return Array.from({ length: Math.min(n, 400) }, (_, i) => addDays(start, i));
}

/**
 * Where the order should be by the end of today against where it is.
 * gap > 0 ahead, gap < 0 behind. `active` false for orders with no due date or nothing to count.
 */
export function taskRhythm(task, today = new Date()) {
  const todayKey = isoDayKey(today);
  const pace = deriveDailyTaskPace(taskPaceInput(task, today));
  const target = Math.max(0, Math.round(Number(task?.targetCount) || 0));
  const done = Math.max(0, Number(task?.completedCount) || 0);
  const settled = task?.status === "completed" || task?.status === "awaiting_approval";
  // A one- or two-unit order has no rhythm to speak of — the due date says it all.
  if (target < 3 || !pace.due || settled) return { active: false, expected: 0, gap: 0, done, target, markPct: 0 };
  const days = workDays(task, pace);
  let expected;
  if (pace.custom) {
    const plan = normalizePaceDayPlan(task.paceDayPlan);
    expected = Object.entries(plan).filter(([d]) => d <= todayKey).reduce((n, [, v]) => n + v, 0);
  } else {
    const elapsed = days.filter((d) => d <= todayKey).length;
    expected = days.length ? Math.round((target * elapsed) / days.length) : target;
  }
  expected = Math.min(target, Math.max(0, expected));
  return {
    active: true,
    expected,
    gap: done - expected,
    done,
    target,
    markPct: Math.round((expected / target) * 100),
  };
}

/**
 * The last seven days, oldest first: done (met the day's share), partial, missed, today (not yet),
 * off (not a work day for this order).
 */
export function taskLastSevenDays(task, today = new Date()) {
  if (Math.max(0, Math.round(Number(task?.targetCount) || 0)) < 3) return [];
  const todayKey = isoDayKey(today);
  const pace = deriveDailyTaskPace(taskPaceInput(task, today));
  const log = taskDayLog(task);
  const days = new Set(workDays(task, pace));
  const target = Math.max(0, Math.round(Number(task?.targetCount) || 0));
  const quota = pace.custom
    ? null
    : Math.max(1, Math.round(target / Math.max(1, days.size || 1)));
  const plan = pace.custom ? normalizePaceDayPlan(task.paceDayPlan) : {};
  const out = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = addDays(todayKey, -i);
    const logged = log[day] || 0;
    const share = pace.custom ? (plan[day] || 0) : (days.has(day) ? quota : 0);
    let state;
    if (!share && !logged) state = "off";
    else if (logged >= share && logged > 0) state = "done";
    else if (logged > 0) state = "partial";
    else if (day === todayKey) state = "today";
    else state = "missed";
    out.push({ day, logged, share, state });
  }
  return out;
}

/** The latest progress entry on the thread: when, by whom, how much, and its first picture if any. */
export function taskLastEntry(task) {
  const logs = (Array.isArray(task?.comments) ? task.comments : []).filter((c) => c?.kind === "log");
  const last = logs[logs.length - 1];
  if (!last) return null;
  const files = Array.isArray(last.files) ? last.files : [];
  const image = files.find((f) => /^data:image\//.test(String(f?.url || "")) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(String(f?.url || f?.name || "")));
  return {
    at: last.at || last.createdAt || "",
    by: String(last.authorName || "").trim(),
    amount: Math.max(0, Number(last.amount) || 0),
    note: String(last.text || "").trim(),
    image: image?.url || "",
    files: files.length,
  };
}

/** Who on a team order logged how much — largest share first. */
export function taskContributions(task) {
  const map = new Map();
  for (const c of Array.isArray(task?.comments) ? task.comments : []) {
    if (c?.kind !== "log") continue;
    const name = String(c.authorName || "").trim();
    if (!name) continue;
    map.set(name, (map.get(name) || 0) + Math.max(0, Number(c.amount) || 0));
  }
  return [...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

/** Points the order carries (priority × effort), and whether they were already granted. */
export function taskPointsLine(task) {
  if (task?.status === "completed" && task?.pointsAwarded != null) return { points: Number(task.pointsAwarded) || 0, granted: true };
  return { points: taskPoints(task?.priority, task?.effortWeight), granted: false };
}

/** Days until due as a short label and tone: today / tomorrow / in N days / N days late. */
export function taskDueChip(task, ar = true, today = new Date()) {
  if (!task?.dueAt || task.status === "completed") return null;
  const due = isoDayKey(task.dueAt);
  const d = calendarDaysInclusive(isoDayKey(today), due) - 1;
  if (Number.isNaN(d)) return null;
  const days = (n) => (n === 1 ? "يوم" : n === 2 ? "يومين" : n <= 10 ? `${n} أيام` : `${n} يوماً`);
  if (d < 0) {
    const n = Math.abs(calendarDaysInclusive(due, isoDayKey(today)) - 1);
    return { tone: "bad", text: ar ? `متأخرة ${days(n)}` : `${n}d late` };
  }
  if (d === 0) return { tone: "warn", text: ar ? "تُستحق اليوم" : "Due today" };
  if (d === 1) return { tone: "warn", text: ar ? "تُستحق غداً" : "Due tomorrow" };
  return { tone: "mute", text: ar ? `بعد ${days(d)}` : `In ${d} days` };
}

/** «نقطة» with the Arabic number agreement. */
export function pointsWord(n, ar = true) {
  if (!ar) return n === 1 ? "1 point" : `${n} points`;
  if (n === 1) return "نقطة واحدة";
  if (n === 2) return "نقطتان";
  if (n >= 3 && n <= 10) return `${n} نقاط`;
  return `${n} نقطة`;
}
