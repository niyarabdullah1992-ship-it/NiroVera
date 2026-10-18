/**
 * Contract suspension by unpaid leave — shared by end of service and anything else that
 * measures continuous service. Mirror of src/lib/contractSuspension.js — keep in sync.
 *
 *   المادة 116 — يُعد عقد العمل موقوفاً خلال مدة الإجازة بلا أجر فيما زاد على عشرين يوماً،
 *                ما لم يتفق الطرفان على خلاف ذلك.
 *   المادة 2   — الخدمة المتصلة تشمل غياب العامل بدون أجر الذي لا تزيد مدته على عشرين يوماً
 *                متقطعة خلال سنة العمل.
 *
 * So, per contract year (counted from the hire date), unpaid-leave days up to 20 stay inside
 * the service; every day beyond is a suspended day that does not count. A leave the parties
 * agreed would not suspend the contract (`agreedOtherwise` / `contractNotSuspended` /
 * `agreedNotSuspended`) suspends nothing.
 *
 * Single source of truth: the day-by-day count is leaveTypes.unpaidSuspensionPlan (the same plan the
 * leave branch shows when the request is approved) — this module only windows and groups it.
 *
 * Pure: no store, node-testable.
 */

import { ruleValue } from "./laborRules.ts";
import { unpaidAgreedOtherwise, unpaidSuspensionPlan } from "./leaveDerivations.ts";

const DAY = 86400000;

function dateOnly(v: any) {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function parse(d: string) {
  return new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
}

function iso(dt: Date) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function addYears(d: string, n: number) {
  const dt = parse(d);
  dt.setFullYear(dt.getFullYear() + n);
  return iso(dt);
}

/** Approved unpaid leave that counts toward suspension (Art. 116). */
export function isSuspendingUnpaidLeave(row: any) {
  if (!row) return false;
  if (String(row.type || "").toLowerCase() !== "unpaid") return false;
  if (!["approved", "accepted"].includes(String(row.status || "").toLowerCase())) return false;
  return !unpaidAgreedOtherwise(row);
}

/**
 * Suspended days between `from` (hire date — contract years run from it) and `to`, with the
 * per-year breakdown. Returns { days, allowance, years: [{ start, end, suspended }] }.
 */
export function suspensionDetail(leaveRequests: any[] = [], from: any, to: any, { allowance }: { allowance?: number } = {}) {
  const start = dateOnly(from);
  const end = dateOnly(to);
  const plan = unpaidSuspensionPlan(leaveRequests || [], start || undefined);
  const free = Number.isFinite(Number(allowance)) ? Number(allowance) : Number(plan.cap) || Number(ruleValue("leave.unpaid.suspendAfterDays")) || 20;
  if (!start || !end || end < start) return { days: 0, allowance: free, years: [] as any[] };
  const days = plan.days.filter((d: string) => d >= start && d <= end);
  const years: any[] = [];
  if (!days.length) return { days: 0, allowance: free, years };
  for (let n = 0; ; n += 1) {
    const ys = addYears(start, n);
    if (ys > end) break;
    const ye = iso(new Date(parse(addYears(start, n + 1)).getTime() - DAY));
    const suspended = days.filter((d: string) => d >= ys && d <= ye).length;
    if (suspended) years.push({ start: ys, end: ye, suspended });
  }
  return { days: days.length, allowance: free, years };
}

/** Unpaid-leave days beyond 20 in each contract year — they do not count as service. */
export function suspendedDaysFromUnpaidLeave(leaveRequests: any[] = [], from: any, to: any, options: { allowance?: number } = {}) {
  return suspensionDetail(leaveRequests, from, to, options).days;
}
