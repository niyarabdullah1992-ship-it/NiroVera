// deno-lint-ignore-file no-explicit-any
/**
 * Backend copy of the comp-leave balance gate (src/lib/compLeave.js): the balance is the hours of
 * approved overtime the worker took as leave (Art. 107 · regs 22 bis), less comp days and comp-hour
 * permissions already taken or pending. Kept equal by scripts/test-cloud-parity.mjs.
 */
import { ruleValue } from "./laborRules.ts";

const LIVE = new Set(["approved", "pending", "pending_manager", "under_review", "revise"]);
const r2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
const minutes = (v: any) => {
  const m = String(v || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function compDayHours(onDate?: string) {
  return Number(ruleValue("hours.shift.ordinaryHours", onDate || undefined)) || 8;
}

export function compEarnedHours(employee: any) {
  return r2((employee?.otherRequests || [])
    .filter((row: any) => row?.type === "overtime" && (row.assignment === true || row.source === "assignment"))
    .filter((row: any) => row.status === "approved" && (row.compensation || row.compensationChoice) === "credit")
    .reduce((sum: number, row: any) => {
      const per = Number(ruleValue("hours.ot.compLeave.minHoursPerOtHour", row.date || undefined)) || 1.5;
      const ot = Number(row.hours) > 0 ? Number(row.hours) : 0;
      return sum + (row.compHours != null ? Number(row.compHours) : ot * per);
    }, 0));
}

export function compUsedHours(employee: any, exceptId?: string) {
  const leaves = (employee?.leaveRequests || [])
    .filter((row: any) => row?.id !== exceptId && String(row?.type || "").toLowerCase() === "comp" && LIVE.has(String(row.status || "pending")))
    .reduce((s: number, row: any) => s + (Number(row.days) || 0) * compDayHours(row.startDate), 0);
  const hours = (employee?.otherRequests || [])
    .filter((row: any) => row?.id !== exceptId && row?.type === "permission" && row.compLeave === true && LIVE.has(String(row.status || "pending")))
    .reduce((s: number, row: any) => {
      const a = minutes(row.time);
      const b = minutes(row.timeTo);
      return s + (a != null && b != null && b > a ? (b - a) / 60 : Number(row.hours) || 0);
    }, 0);
  return r2(leaves + hours);
}

/** Gate for taking comp leave: `days` whole days or `hours` on one day. */
export function checkTakeCompLeaveGate({ employee, days = 0, hours = 0, on, exceptId }: any = {}) {
  const want = r2(days ? Number(days) * compDayHours(on) : Number(hours) || 0);
  if (!(want > 0)) return { ok: false, error: "COMP_AMOUNT", reason: "حدّد المدة من رصيدك التعويضي.", reasonEn: "Set how much of your comp balance to take." };
  const earned = compEarnedHours(employee);
  if (earned <= 0) return { ok: false, error: "COMP_NONE", reason: "لا رصيد إجازة تعويضية — يتكوّن حين تختار الإجازة بدل أجر تكليف إضافي معتمد (المادة 107).", reasonEn: "No comp-leave balance yet (Art. 107)." };
  const left = r2(earned - compUsedHours(employee, exceptId));
  if (want > left + 0.001) return { ok: false, error: "COMP_OVER", reason: `رصيدك التعويضي ${left} ساعة — المطلوب ${want} ساعة.`, reasonEn: `Your comp balance is ${left} h — you asked for ${want} h.`, left, want };
  return { ok: true, hours: want, left };
}
