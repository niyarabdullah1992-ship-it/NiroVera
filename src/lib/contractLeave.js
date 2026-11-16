import { updateCompany } from "@/lib/store";
import { appendOrgStructureEvent } from "@/lib/orgStructureLog";

/**
 * Leave written in the contract, as Qiwa asks for it: annual leave in days (21 at least — the
 * establishment may give more, never less; 30 after five years of service) and the weekly rest
 * (one day or two, and which weekdays). The annual figure becomes the person's balance in «طلباتي»;
 * the rest days are the file's rest days that the roster and attendance read.
 */
export const ANNUAL_MIN = 21;
export const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
// default rest days by count: Friday first, then Saturday, Thursday, Sunday… (never fewer than one — Art. 104)
const REST_ORDER = [5, 6, 4, 0, 1, 2];
export const REST_MIN = 1;
export const REST_MAX = 6;
export function restDefaults(count) {
  const n = Math.min(REST_MAX, Math.max(REST_MIN, Number(count) || REST_MIN));
  return REST_ORDER.slice(0, n).sort((a, b) => a - b);
}
export const REST_DEFAULTS = { 1: restDefaults(1), 2: restDefaults(2), 3: restDefaults(3) };
export function restWord(n) {
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومان";
  return `${n} أيام`;
}

export function contractLeaveOf(employee) {
  const p = employee?.profile || {};
  const annual = Number(p.contractAnnualLeaveDays) || null;
  const dows = Array.isArray(p.weeklyOffDows) ? p.weeklyOffDows.map(Number).filter((n) => n >= 0 && n <= 6) : [];
  const restCount = Number(p.weeklyRestCount) || dows.length || null;
  return { annual, restCount, restDows: dows };
}

export function clampAnnual(value) {
  const n = Math.round(Number(value) || 0);
  return Math.max(ANNUAL_MIN, n || ANNUAL_MIN);
}

/** Save the contract leave on a file; the balance and the rest days follow, and the log names who did it. */
export function applyContractLeave(companyId, employeeId, { annual, restCount, restDows } = {}) {
  updateCompany(companyId, (d) => {
    const e = (d.employees || []).find((x) => String(x.id) === String(employeeId));
    if (!e) return;
    const days = clampAnnual(annual);
    const count = Math.min(REST_MAX, Math.max(REST_MIN, Math.round(Number(restCount) || REST_MIN)));
    // Only the count is written in the contract; which weekdays is the roster's (جدول الدوام). Leave and
    // attendance read the roster's rest days, else the establishment's default for that count.
    const dows = [];
    const before = contractLeaveOf(e);
    e.profile = {
      ...(e.profile || {}),
      contractAnnualLeaveDays: days,
      weeklyRestCount: count,
      weeklyOffDows: dows,
      leaveTotals: { ...(e.profile?.leaveTotals || {}), annual: days },
    };
    if (before.annual !== days || before.restCount !== count) {
      appendOrgStructureEvent(d, {
        type: "grade",
        employeeId: e.id,
        to: `${e.name}: إجازة سنوية ${days} يوماً · راحة أسبوعية ${restWord(count)}`,
      });
    }
  });
}
