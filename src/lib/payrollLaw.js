/**
 * Wage-protection rules of the Labour Law that sit around the monthly line — pure, node-testable.
 *
 *   المادة 88  — تصفية الحقوق خلال أسبوع (أو أسبوعين إن أنهى العامل العقد)، ولصاحب العمل حسم أي دين
 *                مستحق له بسبب العمل من المبالغ المستحقة للعامل.
 *   المادة 89  — الحد الأدنى للأجور بقرار من مجلس الوزراء فقط.
 *   المادة 90  — الأجر بالعملة الرسمية؛ اليومية والأسبوعي والقطعة والساعة: مرة كل أسبوع على الأقل.
 *                اللائحة النموذجية م15/م17 — يوم الدفع، وإن وافق راحةً أو عطلة رسمية فيوم العمل السابق.
 *   المادة 91  — حسم التلف: أجر خمسة أيام في الشهر، وتظلم خلال خمسة عشر يوم عمل من الإبلاغ.
 *   المادة 92  — صندوق الادخار، مشروع المساكن، دين بحكم قضائي (ربع الأجر، النفقة أولاً).
 *   المادة 96  — القطعة والعمولات: متوسط أجر السنة الأخيرة.
 *   المادة 97  — التوقيف في قضية تتصل بالعمل: 50٪ من الأجر حتى 180 يوماً، يُرد إن بُرّئ.
 *   المادة 107 — ساعات العطل والأعياد ساعات إضافية.
 *   المادة 109 — أجر الإجازة السنوية يُدفع مقدّماً.
 *   المادة 116 — الإجازة بلا أجر: الأجر غير مستحق عن أيامها — ليست حسماً من المادة 92.
 */

import { citeRule, ruleValue } from "./laborRules.js";
import {
  contractWage,
  enrichLine,
  lineComponents,
  lineNet,
  lineTransferDue,
  WAGE_CURRENCY,
} from "./payrollDerivations.js";
import { checkDamageDeductionGate } from "./laborProtectionGates.js";
import { damageObjectionDeadline } from "./rightsRequests.js";

const DAY = 86400000;
const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;

function dateOnly(v) {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function parse(d) {
  return new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
}

function iso(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function addDays(d, n) {
  const dt = parse(d);
  dt.setDate(dt.getDate() + n);
  return iso(dt);
}

function monthRange(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!m) return null;
  const last = new Date(Number(m[1]), Number(m[2]), 0).getDate();
  return { start: `${m[1]}-${m[2]}-01`, end: `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}`, days: last };
}

function eachDay(a, b) {
  const out = [];
  if (!a || !b || a > b) return out;
  for (let t = parse(a).getTime(), end = parse(b).getTime(); t <= end; t += DAY) out.push(iso(new Date(t)));
  return out;
}

const APPROVED = ["approved", "accepted"];
const isApproved = (row) => APPROVED.includes(String(row?.status || "").toLowerCase());

function requestDays(row) {
  const a = dateOnly(row?.startDate);
  if (!a) return [];
  const b = dateOnly(row?.endDate) || addDays(a, Math.max(1, Number(row?.days) || 1) - 1);
  return eachDay(a, b);
}

/** Daily actual wage: the monthly actual wage over thirty (the payroll convention). */
export function dailyWage(monthlyWage) {
  return Math.max(0, Number(monthlyWage) || 0) / Number(ruleValue("payroll.month.conventionDays") || 30);
}

// ─── Art. 90 — pay cycle ──────────────────────────────────────────────────────────────────────

/** Wage types Art. 90 pays at least weekly: daily, weekly, piece and hourly. */
export const WEEKLY_WAGE_TYPES = ["daily", "weekly", "piece", "hourly"];

/** "weekly" | "monthly" — from the wage type (or an explicit pay cycle) on the file. */
export function payPeriodOf(employee) {
  const profile = employee?.profile || employee || {};
  const raw = String(profile.payCycle || profile.wageType || "monthly").trim().toLowerCase();
  return WEEKLY_WAGE_TYPES.includes(raw) ? "weekly" : "monthly";
}

/** Step back from `day` while it is a rest day or an official holiday (model regulation Art. 17). */
export function previousWorkingDay(day, isOff = () => false) {
  let d = dateOnly(day);
  if (!d) return "";
  for (let guard = 0; guard < 14 && isOff(d); guard += 1) d = addDays(d, -1);
  return d;
}

/** The month cut into weekly pay periods — 1–7, 8–14, 15–21, 22–28, 29–end — each due on its last working day. */
export function weeklyPeriods(month, isOff = () => false) {
  const range = monthRange(month);
  if (!range) return [];
  const step = Number(ruleValue("payroll.weeklyCycle.days")) || 7;
  const out = [];
  for (let start = 1, index = 0; start <= range.days; start += step, index += 1) {
    const endDay = Math.min(range.days, start + step - 1);
    const s = `${month}-${String(start).padStart(2, "0")}`;
    const e = `${month}-${String(endDay).padStart(2, "0")}`;
    out.push({ index, key: `${month}-W${index + 1}`, start: s, end: e, days: endDay - start + 1, due: previousWorkingDay(e, isOff) });
  }
  return out;
}

/** Each weekly instalment's share of the month's net, by days; the last absorbs the rounding. */
export function weeklyInstalments(line, month, isOff = () => false) {
  const periods = weeklyPeriods(month, isOff);
  const range = monthRange(month);
  if (!periods.length || !range) return [];
  const net = Math.max(0, lineNet(line));
  let given = 0;
  return periods.map((p, i) => {
    const amount = i === periods.length - 1 ? r2(net - given) : r2((net * p.days) / range.days);
    given = r2(given + amount);
    const paid = (line?.weeklyPayments || []).find((row) => row?.key === p.key && row?.paidAt);
    return { ...p, amount, paidAt: paid?.paidAt || null, paidAmount: paid ? Number(paid.amount) || 0 : 0 };
  });
}

/** Art. 90(1): a weekly-cycle worker whose ended week is still unpaid past its due day. */
export function checkWeeklyCycleGate({ employee, line, month, today, isOff } = {}) {
  if (payPeriodOf(employee) !== "weekly") return { ok: true, weekly: false };
  const day = dateOnly(today) || iso(new Date());
  const cite = citeRule("payroll.weeklyCycle.days");
  const rows = weeklyInstalments(line, month, isOff);
  const late = rows.filter((row) => !row.paidAt && row.due && day > row.due);
  if (!late.length) return { ok: true, weekly: true, rows, cite };
  return {
    ok: false,
    weekly: true,
    error: "ART90_WEEKLY_LATE",
    reason: `تنبيه — المادة 90: أجر ${late.length} أسبوع لم يُصرف بعد موعده (آخرها ${late[late.length - 1].due}). الأجر غير الشهري يُصرف مرة كل أسبوع على الأقل.`,
    reasonEn: `Notice — Article 90: ${late.length} week(s) of wage are past their due day (last ${late[late.length - 1].due}). A non-monthly wage is paid at least once a week.`,
    late,
    rows,
    cite,
  };
}

// ─── Art. 90 + model regulation Arts. 15/17 — company payday ──────────────────────────────────

/** The company's payday for the month — null when none is set (the WPS window still applies). */
export function companyPayday(settings, month, isOff = () => false) {
  const day = Math.floor(Number(settings?.payrollPayday));
  const range = monthRange(month);
  if (!range || !(day >= 1 && day <= 31)) return null;
  const scheduled = `${month}-${String(Math.min(day, range.days)).padStart(2, "0")}`;
  const due = previousWorkingDay(scheduled, isOff);
  return { day, scheduled, due, shifted: due !== scheduled, cite: citeRule("payroll.payday.restShift.cite") };
}

/**
 * Wage overdue (Arts. 90/94): the payday passed and lines of the month are still unpaid. Weekly-cycle
 * lines are judged on their weeks, not on the monthly payday.
 */
export function wageOverdue({ settings, month, items = [], today, isOff, employeeOf } = {}) {
  const payday = companyPayday(settings, month, isOff);
  const day = dateOnly(today) || iso(new Date());
  if (!payday) return { set: false, overdue: false, unpaid: 0 };
  const monthly = items.filter((item) => payPeriodOf(employeeOf?.(item)) === "monthly");
  const unpaid = monthly.filter((item) => !item.paid && lineTransferDue(item) > 0);
  const overdue = day > payday.due && unpaid.length > 0;
  return {
    set: true,
    ...payday,
    overdue,
    unpaid: unpaid.length,
    error: overdue ? "WAGE_OVERDUE" : undefined,
    reason: overdue
      ? `تأخر صرف الأجر — يوم الدفع ${payday.due}${payday.shifted ? ` (قُدّم من ${payday.scheduled} لأنه راحة أو عطلة رسمية — اللائحة م17)` : ""} مضى و${unpaid.length} بنداً لم يُصرف. المادة 90؛ والتأخير بلا مسوغ يُعرّض لغرامة المادة 94.`
      : undefined,
    reasonEn: overdue
      ? `Wage overdue — payday ${payday.due}${payday.shifted ? ` (moved from ${payday.scheduled}, a rest day or holiday — model regulation Art. 17)` : ""} has passed with ${unpaid.length} line(s) unpaid. Article 90; an unjustified delay exposes the employer to the Article 94 fine.`
      : undefined,
  };
}

// ─── Art. 92 — deduction sources outside the worker's written consent ─────────────────────────

/** Court-debt kinds in the order Art. 92(6) collects them: maintenance, then food, clothing and housing, then others. */
export const COURT_DEBT_KINDS = [
  { key: "maintenance", rank: 1, ar: "دين نفقة", en: "Maintenance" },
  { key: "food", rank: 2, ar: "دين مأكل", en: "Food" },
  { key: "clothing", rank: 2, ar: "دين ملبس", en: "Clothing" },
  { key: "housing", rank: 2, ar: "دين مسكن", en: "Housing" },
  { key: "other", rank: 3, ar: "دين آخر", en: "Other debt" },
];

export function courtDebtRank(kind) {
  return COURT_DEBT_KINDS.find((row) => row.key === kind)?.rank || 3;
}

/**
 * Art. 92(6): a debt under a court ruling — at most a quarter of the wage due per month unless the
 * ruling says otherwise, and maintenance before food, clothing and housing before other debts.
 * `pending` lists the other open court debts this month as [{ kind, amount }].
 */
export function checkCourtDebtGate({ amount, monthlyWage, monthUsed = 0, kind = "other", rulingAllowsMore = false, pending = [] } = {}) {
  const cite = citeRule("payroll.courtDebt.capRatio");
  const ratio = Number(ruleValue("payroll.courtDebt.capRatio")) || 0.25;
  const wage = Math.max(0, Number(monthlyWage) || 0);
  const cap = r2(wage * ratio);
  const rank = courtDebtRank(kind);
  const ahead = (pending || []).filter((row) => courtDebtRank(row?.kind) < rank && Number(row?.amount) > 0);
  if (ahead.length) {
    return {
      ok: false,
      error: "COURT_DEBT_ORDER",
      reason: "موقوف — المادة 92: يُستوفى دين النفقة أولاً، ثم دين المأكل والملبس والمسكن، قبل الديون الأخرى. استوفِ الدين الأسبق أولاً.",
      reasonEn: "Blocked — Article 92: maintenance is collected first, then food, clothing and housing debts, before other debts. Collect the earlier-ranked debt first.",
      cite,
    };
  }
  const next = r2(Number(monthUsed) + Number(amount));
  if (!rulingAllowsMore && wage > 0 && next > cap + 0.005) {
    return {
      ok: false,
      error: "COURT_DEBT_CAP",
      reason: `موقوف — المادة 92: ما يُحسم شهرياً لدين بحكم قضائي لا يزيد على ربع الأجر (${cap.toLocaleString()} ر.س) ما لم يتضمن الحكم خلاف ذلك.`,
      reasonEn: `Blocked — Article 92: a court-ordered debt may take at most a quarter of the wage a month (${cap} SAR) unless the ruling says otherwise.`,
      cap,
      cite,
    };
  }
  return { ok: true, cap, cite };
}

/**
 * Art. 91 + 92(5): the damage deduction needs no written consent, but it needs the day the worker was
 * told — the fifteen-working-day objection window runs from it — and stays within five days' wage a month.
 */
export function checkDamageLineGate({ amount, monthlyWage, monthUsed = 0, noticeOn, today } = {}) {
  const told = dateOnly(noticeOn);
  const cite = citeRule("payroll.damage.objectionWorkingDays");
  if (!told) {
    return {
      ok: false,
      error: "DAMAGE_NOTICE_REQUIRED",
      reason: "موقوف — المادة 91: حدد تاريخ إبلاغ العامل بالتلف وتقديره — منه تبدأ مهلة تظلمه خمسة عشر يوم عمل.",
      reasonEn: "Blocked — Article 91: set the day the worker was told of the damage and its estimate — his fifteen-working-day objection window runs from it.",
      cite,
    };
  }
  const day = dateOnly(today) || iso(new Date());
  if (told > day) {
    return { ok: false, error: "DAMAGE_NOTICE_FUTURE", reason: "تاريخ الإبلاغ في المستقبل — المادة 91.", reasonEn: "The notice day is in the future — Article 91.", cite };
  }
  const cap = checkDamageDeductionGate({ amount, monthlyWage, monthUsed });
  if (!cap.ok) return cap;
  const objectionLastDay = damageObjectionDeadline(told);
  return { ok: true, cap: cap.cap, objectionLastDay, objectionOpen: day <= objectionLastDay, cite };
}

/**
 * Accepted Art. 91 objections → what is owed back. An objection matches a damage line by its
 * `deductionLineId`, else by the notice day and amount.
 */
export function damageRefundsFor(objections = [], damageLines = []) {
  const accepted = (objections || []).filter((row) => String(row?.type) === "damage_objection" && isApproved(row));
  const out = [];
  for (const line of damageLines || []) {
    if (line?.source !== "damage" || line.refundedAt) continue;
    const charged = Number(line.originalAmount ?? line.amount) || 0;
    const hit = accepted.find((o) => (o.deductionLineId && o.deductionLineId === line.id)
      || (dateOnly(o.notifiedOn) && dateOnly(o.notifiedOn) === dateOnly(line.damageNoticeOn) && Math.abs((Number(o.amount) || 0) - charged) < 1));
    if (hit && charged > 0) out.push({ lineId: line.id, objectionId: hit.id, amount: r2(charged) });
  }
  return out;
}

// ─── Art. 97 — detention in a work-related case ───────────────────────────────────────────────

/**
 * The month under a work-related detention: half the wage for the first 180 days, nothing beyond.
 * `detention` = { from, to?, acquittedAt? }. Returns days and the wage not due on the line.
 */
export function detentionMonth({ detention, month, monthlyWage = 0 } = {}) {
  const empty = { days: 0, halfDays: 0, unpaidDays: 0, cut: 0 };
  const from = dateOnly(detention?.from);
  const range = monthRange(month);
  if (!from || !range) return empty;
  const to = dateOnly(detention?.to || detention?.releasedAt) || range.end;
  const maxDays = Number(ruleValue("payroll.detention.maxDays")) || 180;
  const ratio = Number(ruleValue("payroll.detention.payRatio")) || 0.5;
  const daily = dailyWage(monthlyWage);
  const out = { ...empty };
  for (const d of eachDay(from, to)) {
    if (d < range.start || d > range.end) continue;
    const index = Math.round((parse(d).getTime() - parse(from).getTime()) / DAY) + 1;
    out.days += 1;
    if (index <= maxDays) out.halfDays += 1;
    else out.unpaidDays += 1;
  }
  out.cut = r2(out.halfDays * daily * (1 - ratio) + out.unpaidDays * daily);
  return out;
}

/** Art. 97: on acquittal, what was withheld inside the 180 paid days goes back to the worker. */
export function detentionRefund({ detention, monthlyWage = 0 } = {}) {
  const from = dateOnly(detention?.from);
  if (!from || !dateOnly(detention?.acquittedAt)) return 0;
  const to = dateOnly(detention?.to || detention?.releasedAt || detention?.acquittedAt);
  const maxDays = Number(ruleValue("payroll.detention.maxDays")) || 180;
  const ratio = Number(ruleValue("payroll.detention.payRatio")) || 0.5;
  const days = Math.min(maxDays, eachDay(from, to).length);
  return r2(days * dailyWage(monthlyWage) * (1 - ratio));
}

// ─── Art. 116 — unpaid leave is wage not due ──────────────────────────────────────────────────

/** Approved unpaid-leave days (Art. 116, and the unpaid maternity extension) in the month, and the wage not due. */
export function unpaidLeaveMonth({ employee, month, monthlyWage = 0 } = {}) {
  const range = monthRange(month);
  if (!range) return { days: 0, cut: 0 };
  const rows = (employee?.leaveRequests || []).filter((row) => ["unpaid", "maternity_extend"].includes(String(row?.type || "").toLowerCase()) && isApproved(row));
  const days = new Set(rows.flatMap(requestDays).filter((d) => d >= range.start && d <= range.end));
  return { days: days.size, cut: r2(days.size * dailyWage(monthlyWage)) };
}

// ─── Art. 107(3) — holiday hours are overtime ─────────────────────────────────────────────────

function punchHours(row) {
  const a = row?.checkInAt || row?.check_in_at;
  const b = row?.checkOutAt || row?.check_out_at;
  if (!a || !b) return Math.max(0, Number(row?.workedMinutes) || 0) / 60;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms / 3600000 : 0;
}

/**
 * Hours worked on official holidays in the month. Decisions flagged `holiday: true` are already in
 * the approved overtime (they are reported, not added). Other holiday punches add their hours less
 * any overtime a decision already approved for that day, so no hour is paid twice.
 */
export function holidayOvertimeHours({ employeeId, month, attendance = [], otDecisions = {}, isHoliday = () => false } = {}) {
  const id = String(employeeId || "");
  const prefix = `${month}-`;
  let fromDecisions = 0;
  const flagged = new Set();
  for (const [key, row] of Object.entries(otDecisions || {})) {
    if (!key.startsWith(`${id}:`)) continue;
    const day = key.slice(id.length + 1);
    if (!day.startsWith(prefix) || row?.holiday !== true) continue;
    // A holiday decision of any status owns that day: pending hours wait for the manager's pay or
    // comp-leave choice (worked hours can't be rejected), so the punch path never pays them first.
    flagged.add(day);
    if (row?.decision !== "approve" && row?.decision !== "pay") continue;
    fromDecisions += Math.max(0, Number(row.overtimeMinutes) || 0) / 60;
    flagged.add(day);
  }
  let fromAttendance = 0;
  for (const row of attendance || []) {
    if (String(row?.employeeId || row?.employee_id || "") !== id) continue;
    const day = String(row?.date || row?.attendanceDate || "").slice(0, 10);
    if (!day.startsWith(prefix) || flagged.has(day) || !isHoliday(day)) continue;
    if (["absent", "rejected"].includes(String(row?.status || "").toLowerCase()) || row?.approved === false) continue;
    const decided = otDecisions?.[`${id}:${day}`];
    const already = decided && (decided.decision === "approve" || decided.decision === "pay") ? Math.max(0, Number(decided.overtimeMinutes) || 0) / 60 : 0;
    fromAttendance += Math.max(0, punchHours(row) - already);
  }
  const round = (x) => Math.round(x * 10) / 10;
  return { fromDecisions: round(fromDecisions), fromAttendance: round(fromAttendance), hours: round(fromAttendance) };
}

// ─── Art. 89 — company minimum ────────────────────────────────────────────────────────────────

/** A floor only the Council of Ministers sets in law; a company-recorded floor is an internal warning. */
export function checkMinimumWageGate({ line, minimum } = {}) {
  const floor = Number(minimum);
  const cite = citeRule("payroll.minimumWage.cite");
  if (!(floor > 0)) return { ok: true, set: false, cite };
  const wage = contractWage(line || {});
  if (wage >= floor) return { ok: true, set: true, floor, wage, cite };
  return {
    ok: false,
    set: true,
    error: "BELOW_MINIMUM_WAGE",
    reason: `تنبيه — الأجر (${wage.toLocaleString()} ر.س) دون الحد الأدنى المسجّل (${floor.toLocaleString()} ر.س). المادة 89: الحد الملزم يضعه مجلس الوزراء.`,
    reasonEn: `Notice — the wage (${wage} SAR) is below the recorded minimum (${floor} SAR). Article 89: a binding floor is set by the Council of Ministers.`,
    floor,
    wage,
    cite,
  };
}

// ─── Art. 96 — average wage for piece and commission workers ──────────────────────────────────

/** Piece / output wage, or a wage that is wholly commissions and percentages. */
export function isAverageWageBasis(employee) {
  const profile = employee?.profile || employee || {};
  const type = String(profile.wageType || "").toLowerCase();
  if (type === "piece" || type === "commission") return true;
  if (profile.commissionOnly === true) return true;
  return !(Number(profile.baseSalary) > 0) && Number(profile.commissionAmount) > 0;
}

function shiftMonth(month, n) {
  const [y, m] = String(month).split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Average actual wage over the settled lines of the last year (Art. 96) — overtime stays out. */
export function averageActualWage(payrollRuns = [], employeeId, endMonth) {
  const end = /^\d{4}-\d{2}$/.test(String(endMonth || "")) ? endMonth : iso(new Date()).slice(0, 7);
  const months = Number(ruleValue("payroll.averageWage.months")) || 12;
  const from = shiftMonth(end, -(months - 1));
  const rows = [];
  for (const run of payrollRuns || []) {
    if (!run?.month || run.month < from || run.month > end) continue;
    const item = (run.items || []).find((row) => String(row.employeeId) === String(employeeId));
    if (!item || !(item.paid || item.settledNet != null)) continue;
    rows.push((Number(item.base) || 0) + (Number(item.allowances) || 0) + (Number(item.bonus) || 0));
  }
  if (!rows.length) return { average: 0, months: 0, from, to: end, cite: citeRule("payroll.averageWage.months") };
  return { average: r2(rows.reduce((s, x) => s + x, 0) / rows.length), months: rows.length, from, to: end, cite: citeRule("payroll.averageWage.months") };
}

// ─── Art. 109 — annual leave paid in advance ──────────────────────────────────────────────────

export function annualLeaveAdvanceAmount({ days, monthlyWage } = {}) {
  return r2(Math.max(0, Number(days) || 0) * dailyWage(monthlyWage));
}

/** Approved annual leave starting within `horizonDays` (or already started) whose pay has not gone out. */
export function checkAnnualLeaveAdvanceGate({ leave, today, horizonDays = 7 } = {}) {
  const cite = citeRule("leave.annual.advancePay.cite");
  if (String(leave?.type || "").toLowerCase() !== "annual" || !isApproved(leave)) return { ok: true, cite };
  if (leave.advancePaidAt) return { ok: true, paid: true, cite };
  const start = dateOnly(leave.startDate);
  const day = dateOnly(today) || iso(new Date());
  if (!start || addDays(day, horizonDays) < start) return { ok: true, upcoming: false, cite };
  const started = day >= start;
  return {
    ok: false,
    error: "ART109_ADVANCE_UNPAID",
    started,
    reason: started
      ? `تنبيه — المادة 109: بدأت الإجازة السنوية في ${start} ولم يُصرف أجرها مقدّماً.`
      : `تنبيه — المادة 109: الإجازة السنوية تبدأ ${start} — يُصرف أجرها مقدّماً قبل بدئها.`,
    reasonEn: started
      ? `Notice — Article 109: annual leave began on ${start} and its pay was not advanced.`
      : `Notice — Article 109: annual leave starts ${start} — its pay goes out before it starts.`,
    cite,
  };
}

/** Every approved annual leave needing its advance pay, across employees. */
export function pendingAnnualAdvances(employees = [], today, horizonDays = 14) {
  const out = [];
  for (const employee of employees || []) {
    for (const leave of employee?.leaveRequests || []) {
      const gate = checkAnnualLeaveAdvanceGate({ leave, today, horizonDays });
      if (!gate.ok) out.push({ employee, leave, gate, days: requestDays(leave).length });
    }
  }
  return out.sort((a, b) => String(a.leave.startDate).localeCompare(String(b.leave.startDate)));
}

// ─── Art. 88 — final settlement ───────────────────────────────────────────────────────────────

/** Employer advances (loans) approved and not yet recovered through payroll. */
export function outstandingAdvances(employee, payrollRuns = []) {
  const granted = (employee?.otherRequests || [])
    .filter((row) => String(row?.type) === "advance" && row?.moneyKind !== "allowance" && isApproved(row))
    .reduce((s, row) => s + Math.max(0, Number(row.amount) || 0), 0);
  let recovered = 0;
  for (const run of payrollRuns || []) {
    const item = (run?.items || []).find((row) => String(row.employeeId) === String(employee?.id));
    for (const line of item?.deductionLines || []) if (line?.source === "advance") recovered += Math.max(0, Number(line.amount) || 0);
  }
  return r2(Math.max(0, granted - recovered));
}

/**
 * Art. 88: what is owed at exit — the final partial month's wage, the end-of-service award and leave
 * pay — less work-related debts the employer may set off: outstanding advances in full, custody
 * damage within Art. 91's five days' wage (the rest is claimed before the labour court). Never below zero.
 */
export function deriveFinalSettlement({ employee, eos, payrollRuns = [], exitDate, monthlyWage, custodyDebt = 0, extras = 0, deadline } = {}) {
  const exit = dateOnly(exitDate);
  const wage = Math.max(0, Number(monthlyWage ?? eos?.wage) || 0);
  const daily = dailyWage(wage);
  let partialDays = 0;
  let partialWage = 0;
  let monthPaid = false;
  if (exit) {
    const month = exit.slice(0, 7);
    const item = ((payrollRuns || []).find((run) => run?.month === month)?.items || []).find((row) => String(row.employeeId) === String(employee?.id));
    monthPaid = Boolean(item && (item.paid || item.settledNet != null));
    if (!monthPaid) {
      partialDays = Math.min(Number(ruleValue("payroll.month.conventionDays") || 30), Number(exit.slice(8, 10)));
      partialWage = r2(partialDays * daily);
    }
  }
  const advances = outstandingAdvances(employee, payrollRuns);
  const custody = Math.max(0, Number(custodyDebt) || 0);
  const custodyCap = r2(daily * (Number(ruleValue("payroll.damage.capDays")) || 5));
  const custodySetOff = Math.min(custody, custodyCap);
  const dues = r2(partialWage + Math.max(0, Number(eos?.total) || 0) + Math.max(0, Number(extras) || 0));
  const setOff = r2(Math.min(dues, advances + custodySetOff));
  const paidAt = employee?.profile?.contractExit?.settlementPaidAt || null;
  return {
    exitDate: exit || null,
    partialDays,
    partialWage,
    monthPaid,
    eosTotal: Math.max(0, Number(eos?.total) || 0),
    extras: r2(extras),
    dues,
    advances,
    custodyDebt: custody,
    custodySetOff,
    custodyCap,
    custodyToCourt: r2(custody - custodySetOff),
    setOff,
    net: r2(dues - setOff),
    paidAt,
    paidLate: Boolean(paidAt && deadline?.due && String(paidAt).slice(0, 10) > deadline.due),
    open: !paidAt,
    cite: citeRule(deadline?.workerEnded ? "eos.settlement.workerDays" : "eos.settlement.employerDays"),
  };
}

// ─── Implementing regulations Art. 5(2) — the combined wage sheet ─────────────────────────────

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One CSV of the month: every line with its wage parts, deductions by source, net and transfer. */
export function wageSheetCsv(items = [], { month = "", nameOf, ar = true } = {}) {
  const head = ar
    ? ["الشهر", "رقم الموظف", "الموظف", "الأساسي", "البدلات", "المكافأة", "ساعات إضافية", "منها عطل وأعياد", "أجر الإضافي", "مردود", "خصومات المادة 92", "التأمينات (حصة الموظف)", "أجر غير مستحق نظاماً", "الصافي", "صُرف مقدّماً", "المتبقي للتحويل", "العملة", "الحالة"]
    : ["Month", "Employee ID", "Employee", "Basic", "Allowances", "Bonus", "OT hours", "of which holiday", "OT pay", "Refunds", "Art. 92 deductions", "GOSI (employee)", "Wage not due by law", "Net", "Paid ahead", "Transfer due", "Currency", "Status"];
  const rows = [head];
  for (const raw of items) {
    const line = enrichLine(raw);
    const c = lineComponents(line);
    rows.push([
      month,
      line.employeeId,
      nameOf?.(line) || line.employeeName || "",
      r2(c.base), r2(c.allowances), r2(c.bonus),
      c.overtimeHours, c.holidayOvertimeHours, r2(c.overtimePay), r2(c.refunds),
      r2(c.deductions), r2(c.gosiEmployee),
      r2(c.injuryCut + c.sickCut + c.unpaidLeaveCut + c.detentionCut),
      r2(c.net), r2(c.paidAhead), lineTransferDue(line),
      String(line.currency || WAGE_CURRENCY).toUpperCase(),
      line.paid ? (ar ? "مدفوع" : "Paid") : (ar ? "غير مدفوع" : "Unpaid"),
    ]);
  }
  return `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
