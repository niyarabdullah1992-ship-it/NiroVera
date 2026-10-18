/**
 * A worker who is at work on a day his approved leave covers: he may cut the leave from that day.
 * The days before stay leave; the rest of the leave is cancelled and its days go back to the balance.
 * Not allowed in the six mandatory weeks after childbirth (Art. 151) — the law forbids working then.
 * Pure: no store, safe in node.
 */
import { approvedLeaveOnDay, leaveCoverRange, computeDays } from "./leaveTypes.js";
import { ruleValue } from "./laborRules.js";

function addDays(key, n) {
  const d = new Date(`${String(key).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * `chargeable(start, end, type)` counts days the way the balance does (annual and sick skip rest days and
 * holidays); without it, calendar days are counted.
 */
export function planLeaveCutForAttendance(employee, day, { chargeable } = {}) {
  const leave = approvedLeaveOnDay(employee, new Date(`${day}T12:00:00`));
  if (!leave) return { ok: false, error: "NO_LEAVE" };
  const type = String(leave.type || "").toLowerCase();
  if (type === "maternity" && leave.eventDate) {
    const post = Number(ruleValue("leave.maternity.mandatoryPostDays", day)) || 42;
    const last = addDays(leave.eventDate, post - 1);
    if (day >= String(leave.eventDate).slice(0, 10) && day <= last) {
      return {
        ok: false,
        error: "MATERNITY_MANDATORY",
        reason: `لا يجوز تشغيلك في الأسابيع الستة التالية للوضع (حتى ${last}) — المادة 151. الإجازة باقية.`,
        reasonEn: `You may not work in the six weeks after birth (until ${last}) — Article 151. The leave stays.`,
      };
    }
  }
  const { start, end } = leaveCoverRange(leave);
  const whole = day <= start;
  const newEnd = whole ? "" : addDays(day, -1);
  const count = (a, b) => {
    if ((type === "annual" || type === "sick") && typeof chargeable === "function") {
      const n = Number(chargeable(a, b, type));
      if (Number.isFinite(n)) return n;
    }
    return computeDays(a, b);
  };
  const keptDays = whole ? 0 : count(start, newEnd);
  const freedDays = count(day, end);
  return { ok: true, leave, type, start, end, whole, newEnd, keptDays, freedDays };
}

/** Arabic count of days: يوم واحد، يومان، 3 أيام، 11 يوماً. */
export function daysAr(n) {
  const v = Math.round(Number(n) || 0);
  if (v === 1) return "يوم واحد";
  if (v === 2) return "يومان";
  if (v >= 3 && v <= 10) return `${v} أيام`;
  return `${v} يوماً`;
}
