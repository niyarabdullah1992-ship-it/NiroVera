/**
 * الإجازة التعويضية — its own balance, in hours, never mixed into annual leave.
 *
 *   المادة 107 — بموافقة العامل تُحتسب أيام إجازة تعويضية مدفوعة الأجر بدل أجر الساعات الإضافية.
 *   اللائحة 22 مكرر — لا تقل عن ساعة ونصف عن كل ساعة إضافية؛ يُحدَّد موعد التمتع بها خلال 60 يوماً ما لم
 *   يُتفق على خلاف ذلك؛ لا تزيد على 30 يوماً في السنة؛ وإن ترك العامل العمل قبل التمتع بها تُدفع أجرتها.
 *
 * Grants come from approved overtime assignments where the worker chose leave. Uses are whole-day
 * leave requests of type "comp" and hour permissions marked `compLeave`. Uses draw from the grant
 * whose take-by date comes first. Pending uses hold their hours so the balance cannot be spent twice.
 */

import { otCreditDays, parseOtHours, defaultCompLeaveEnjoyDate } from "./overtimeAssignment.js";
import { ruleValue } from "./laborRules.js";

export const COMP_LEAVE_TYPE = "comp";
export const COMP_SOON_DAYS = 7;

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const between = (a, b) => Math.round((new Date(`${dateOnly(b)}T00:00:00Z`) - new Date(`${dateOnly(a)}T00:00:00Z`)) / 86400000);

export function compDayHours(onDate) {
  return Number(ruleValue("hours.shift.ordinaryHours", onDate || undefined)) || 8;
}

function clockMinutes(v) {
  const m = String(v || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Approved overtime assignments the worker took as leave: [{ id, hours, earnedOn, takeBy }]. */
export function compGrants(employee) {
  return (employee?.otherRequests || [])
    .filter((row) => row?.type === "overtime" && (row.assignment === true || row.source === "assignment"))
    .filter((row) => row.status === "approved" && (row.compensation || row.compensationChoice) === "credit")
    .map((row) => {
      const ot = parseOtHours(row.hours) || 0;
      const per = Number(ruleValue("hours.ot.compLeave.minHoursPerOtHour", row.date || undefined)) || 1.5;
      return {
        id: row.id,
        hours: r2(row.compHours != null ? row.compHours : ot * per),
        earnedOn: dateOnly(row.date),
        takeBy: dateOnly(row.enjoyDate) || defaultCompLeaveEnjoyDate(row.date),
        agreedLater: row.windowAgreed === true,
      };
    })
    .filter((g) => g.hours > 0)
    .sort((a, b) => a.takeBy.localeCompare(b.takeBy));
}

/** Hours one use takes: a whole-day leave request, or a permission's clock window. */
export function compUseHours(row, kind) {
  if (kind === "leave") {
    const days = Number(row.days) || 0;
    return r2(days * compDayHours(row.startDate));
  }
  const from = clockMinutes(row.time);
  const to = clockMinutes(row.timeTo);
  if (from == null || to == null || to <= from) return r2(Number(row.hours) || 0);
  return r2((to - from) / 60);
}

const LIVE = new Set(["approved", "pending", "pending_manager", "under_review", "revise"]);

/** Leave days and hour permissions drawn from the comp balance (pending ones hold their hours). */
export function compUses(employee) {
  const leaves = (employee?.leaveRequests || [])
    .filter((row) => String(row?.type || "").toLowerCase() === COMP_LEAVE_TYPE && LIVE.has(String(row.status || "pending")))
    .map((row) => ({ id: row.id, kind: "leave", on: dateOnly(row.startDate), hours: compUseHours(row, "leave"), approved: row.status === "approved" }));
  const hours = (employee?.otherRequests || [])
    .filter((row) => row?.type === "permission" && row.compLeave === true && LIVE.has(String(row.status || "pending")))
    .map((row) => ({ id: row.id, kind: "hours", on: dateOnly(row.date), hours: compUseHours(row, "hours"), approved: row.status === "approved" }));
  return [...leaves, ...hours].sort((a, b) => a.on.localeCompare(b.on));
}

/**
 * The balance: grants with what is left on each, totals, the next date to take it by, and what is
 * past its date. { grants, earned, used, held, left, nextTakeBy, soon, overdue, days }
 */
export function compBalance(employee, today, { exceptId } = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const grants = compGrants(employee).map((g) => ({ ...g, left: g.hours }));
  const uses = compUses(employee).filter((u) => u.id !== exceptId);
  for (const use of uses) {
    let need = use.hours;
    for (const g of grants) {
      if (need <= 0) break;
      const take = Math.min(g.left, need);
      g.left = r2(g.left - take);
      need = r2(need - take);
    }
  }
  const earned = r2(grants.reduce((s, g) => s + g.hours, 0));
  const used = r2(uses.filter((u) => u.approved).reduce((s, u) => s + u.hours, 0));
  const held = r2(uses.filter((u) => !u.approved).reduce((s, u) => s + u.hours, 0));
  const left = r2(grants.reduce((s, g) => s + g.left, 0));
  const open = grants.filter((g) => g.left > 0);
  const next = open[0] || null;
  return {
    grants,
    earned,
    used,
    held,
    left,
    days: r2(left / compDayHours(day)),
    nextTakeBy: next?.takeBy || "",
    nextLeft: next?.left || 0,
    soon: next ? between(day, next.takeBy) >= 0 && between(day, next.takeBy) <= COMP_SOON_DAYS : false,
    overdue: open.filter((g) => g.takeBy && g.takeBy < day && !g.agreedLater),
  };
}

/** Gate for taking comp leave: whole days (`days`) or hours on one day (`hours`). */
export function checkTakeCompLeaveGate({ employee, days = 0, hours = 0, on, today, exceptId } = {}) {
  const want = r2(days ? Number(days) * compDayHours(on) : Number(hours) || 0);
  if (!(want > 0)) {
    return { ok: false, error: "COMP_AMOUNT", reason: "حدّد المدة من رصيدك التعويضي.", reasonEn: "Set how much of your comp balance to take." };
  }
  const bal = compBalance(employee, today || on, { exceptId });
  if (bal.earned <= 0) {
    return { ok: false, error: "COMP_NONE", reason: "لا رصيد إجازة تعويضية — يتكوّن حين تختار الإجازة بدل أجر تكليف إضافي معتمد (المادة 107).", reasonEn: "No comp-leave balance yet — it comes from approved overtime taken as leave (Art. 107)." };
  }
  if (want > bal.left + 0.001) {
    return {
      ok: false,
      error: "COMP_OVER",
      reason: `رصيدك التعويضي ${hoursWord(bal.left)}${bal.held ? ` (محجوز منه ${hoursWord(bal.held)} لطلبات قيد الاعتماد)` : ""} — المطلوب ${hoursWord(want)}.`,
      reasonEn: `Your comp balance is ${bal.left} h — you asked for ${want} h.`,
    };
  }
  return { ok: true, hours: want, balance: bal };
}

export function hoursWord(h) {
  const n = r2(h);
  if (n === 1) return "ساعة واحدة";
  if (n === 2) return "ساعتان";
  if (Number.isInteger(n) && n >= 3 && n <= 10) return `${n} ساعات`;
  return `${n} ساعة`;
}

/** Regs 22 bis — unused comp leave is paid out when the worker leaves: hours × actual hourly wage. */
export function compPayout(employee, today, actualMonthlyWage) {
  const bal = compBalance(employee, today);
  const hourly = (Number(actualMonthlyWage) || 0) / (30 * compDayHours(today));
  return { hours: bal.left, amount: r2(bal.left * hourly), hourly: r2(hourly) };
}

/**
 * Reminders: the worker 7 days before a take-by date and on it; managers once it has passed with
 * hours left (they must set a date with him). [{ userId, key, text, to }]
 */
export function planCompLeaveNotices({ data, today, existingKeys = [], audienceOf } = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const seen = new Set((existingKeys || []).filter(Boolean));
  const plans = [];
  const push = (userId, key, text, to) => {
    if (!userId || seen.has(key)) return;
    seen.add(key);
    plans.push({ userId, key, text, to });
  };
  for (const employee of data?.employees || []) {
    const bal = compBalance(employee, day);
    for (const g of bal.grants.filter((x) => x.left > 0 && x.takeBy)) {
      const left = between(day, g.takeBy);
      if (left >= 0 && left <= COMP_SOON_DAYS) {
        const stage = left === 0 ? "0" : "7";
        push(employee.id, `comp:${employee.id}:${g.id}:${stage}`, left === 0
          ? `اليوم آخر موعد للتمتع بإجازتك التعويضية (${hoursWord(g.left)}) — اطلبها من طلباتي أو اتفق مع مسؤولك على موعد أبعد (اللائحة 22 مكرر).`
          : `باقي ${left} أيام على موعد التمتع بإجازتك التعويضية (${hoursWord(g.left)}) — اطلبها من طلباتي (اللائحة 22 مكرر).`, "/app/requests");
      }
      if (left < 0 && !g.agreedLater) {
        for (const m of (audienceOf ? audienceOf(employee) : []).filter((u) => u?.id && String(u.id) !== String(employee.id))) {
          push(m.id, `comp:${employee.id}:${g.id}:over:${m.id}`, `فات موعد تمتع ${employee.name || "موظف"} بإجازته التعويضية (${hoursWord(g.left)}، الموعد ${g.takeBy}) — حدّد معه موعداً؛ ولا تسقط، وإن ترك العمل تُصرف أجرتها (اللائحة 22 مكرر).`, "/app/requests/manage");
        }
      }
    }
  }
  return plans;
}

/** Days equivalent, for showing beside hours. */
export function compDays(hours, onDate) {
  return r2((Number(hours) || 0) / compDayHours(onDate));
}

export { otCreditDays };

/**
 * One-time move: overtime credits that were once added to the annual total are taken back out of it
 * — the comp balance now holds them. Returns true when something changed.
 */
export function moveCompCreditsOutOfAnnual(data) {
  let changed = false;
  for (const emp of data?.employees || []) {
    for (const row of emp.otherRequests || []) {
      if (row?.type !== "overtime" || !row.balanceApplied || row.compMovedOut) continue;
      const days = Number(row.appliedDays) || 0;
      const totals = emp.profile?.leaveTotals;
      if (days > 0 && totals && Number.isFinite(Number(totals.annual))) {
        totals.annual = Math.round((Number(totals.annual) - days) * 1000) / 1000;
      }
      row.compMovedOut = true;
      row.balanceApplied = false;
      changed = true;
    }
  }
  return changed;
}
