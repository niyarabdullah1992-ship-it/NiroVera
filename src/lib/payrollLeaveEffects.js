/**
 * What the month's approved leave does to the wage, by the Law — so the run carries it without
 * anyone working it out by hand.
 *
 *   المادة 117 — الإجازة المرضية في السنة الواحدة (من أول إجازة مرضية): 30 يوماً بأجر كامل،
 *   ثم 60 بثلاثة أرباع الأجر، ثم 30 بلا أجر. العيد داخل المرضية بأجر كامل (اللائحة 24/2).
 *   المادة 109 — الإجازة السنوية بأجر يُدفع مقدّماً.
 *   الإجازة بلا أجر — باتفاق مكتوب، تُقرأ من الحضور المقفل.
 * Work injuries (Arts. 137–139) are already on the line from workInjury.
 */

import { ruleValue } from "./laborRules.js";
import { chargeableSickDays, sickStatutoryYearWindow } from "./leaveTypes.js";

const DAY = 86400000;

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

function eachDay(a, b) {
  const out = [];
  if (!a || !b || a > b) return out;
  for (let t = parse(a).getTime(), end = parse(b).getTime(); t <= end; t += DAY) out.push(iso(new Date(t)));
  return out;
}

function monthRange(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!m) return null;
  const last = new Date(Number(m[1]), Number(m[2]), 0).getDate();
  return { start: `${m[1]}-${m[2]}-01`, end: `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}` };
}

const approved = (r) => ["approved", "accepted"].includes(String(r?.status || "").toLowerCase());
const typeOf = (r) => String(r?.type || "").toLowerCase();

function requestDays(r) {
  const a = dateOnly(r.startDate);
  const b = dateOnly(r.endDate) || (a ? iso(new Date(parse(a).getTime() + (Math.max(1, Number(r.days) || 1) - 1) * DAY)) : "");
  return eachDay(a, b);
}

/**
 * The month's sick days split into the Art. 117 bands, counted from the first sick leave of the
 * statutory year, and what they take off the wage. Daily wage = monthly actual wage ÷ 30.
 */
export function sickMonth({ employee, month, monthlyWage = 0, calendar } = {}) {
  const range = monthRange(month);
  const empty = { days: 0, fullDays: 0, quarterDays: 0, unpaidDays: 0, beyondDays: 0, reduction: 0, unpaid: 0, daily: 0 };
  if (!range) return empty;
  const requests = (employee?.leaveRequests || []).filter((r) => typeOf(r) === "sick" && approved(r));
  if (!requests.length) return empty;
  const days = [...new Set(requests.flatMap(requestDays))].sort().filter((d) => chargeableSickDays(d, d, calendar) > 0);
  const inMonth = days.filter((d) => d >= range.start && d <= range.end);
  if (!inMonth.length) return empty;
  const full = Number(ruleValue("leave.sick.fullPayDays")) || 30;
  const mid = Number(ruleValue("leave.sick.halfPayDays")) || 60;
  const unpaidBand = Number(ruleValue("leave.sick.unpaidDays")) || 30;
  const midRatio = Number(ruleValue("leave.sick.midPayRatio")) || 0.75;
  const out = { ...empty, days: inMonth.length };
  for (const d of inMonth) {
    const win = sickStatutoryYearWindow(requests, d);
    const index = days.filter((x) => x >= win.start && x <= d).length;
    if (index <= full) out.fullDays += 1;
    else if (index <= full + mid) out.quarterDays += 1;
    else if (index <= full + mid + unpaidBand) out.unpaidDays += 1;
    else out.beyondDays += 1;
  }
  const daily = Math.max(0, Number(monthlyWage) || 0) / 30;
  const r2 = (x) => Math.round(x * 100) / 100;
  out.daily = r2(daily);
  out.reduction = r2(out.quarterDays * daily * (1 - midRatio));
  out.unpaid = r2((out.unpaidDays + out.beyondDays) * daily);
  return out;
}

/** Days of an approved leave type that fall inside the month. */
function daysOfType(employee, month, type) {
  const range = monthRange(month);
  if (!range) return { days: 0, starts: [] };
  const rows = (employee?.leaveRequests || []).filter((r) => typeOf(r) === type && approved(r));
  let days = 0;
  const starts = [];
  for (const r of rows) {
    const inside = requestDays(r).filter((d) => d >= range.start && d <= range.end);
    days += inside.length;
    if (inside.length && dateOnly(r.startDate) >= range.start) starts.push(dateOnly(r.startDate));
  }
  return { days, starts };
}

/**
 * Every leave effect on one person's month, each with its basis and its money: sick bands (117),
 * annual leave paid in advance (109), unpaid leave, and work injury (137–139) read off the line.
 */
export function leaveEffects({ employee, month, line = {}, monthlyWage = 0, calendar, ar = true } = {}) {
  const rows = [];
  const sick = sickMonth({ employee, month, monthlyWage, calendar });
  if (sick.days) {
    rows.push({
      id: "sick", cite: "117",
      title: ar ? `إجازة مرضية · ${sick.days} يوماً` : `Sick leave · ${sick.days} days`,
      detail: ar
        ? [sick.fullDays ? `${sick.fullDays} بأجر كامل` : "", sick.quarterDays ? `${sick.quarterDays} بثلاثة أرباع` : "", sick.unpaidDays + sick.beyondDays ? `${sick.unpaidDays + sick.beyondDays} بلا أجر` : ""].filter(Boolean).join(" · ")
        : [sick.fullDays ? `${sick.fullDays} full pay` : "", sick.quarterDays ? `${sick.quarterDays} at three-quarters` : "", sick.unpaidDays + sick.beyondDays ? `${sick.unpaidDays + sick.beyondDays} unpaid` : ""].filter(Boolean).join(" · "),
      amount: -(sick.reduction + sick.unpaid),
      tone: sick.reduction + sick.unpaid > 0 ? "warn" : "ok",
      beyond: sick.beyondDays,
    });
  }
  const annual = daysOfType(employee, month, "annual");
  if (annual.days) {
    rows.push({
      id: "annual", cite: "109",
      title: ar ? `إجازة سنوية · ${annual.days} يوماً` : `Annual leave · ${annual.days} days`,
      detail: annual.starts.length
        ? (ar ? `تبدأ ${annual.starts.join("، ")} — أجرها يُدفع مقدّماً قبل بدئها` : `Starts ${annual.starts.join(", ")} — its pay goes out before it starts`)
        : (ar ? "بأجر كامل — لا أثر على الصافي" : "Full pay — no effect on the net"),
      amount: 0,
      tone: annual.starts.length ? "warn" : "ok",
    });
  }
  const unpaid = daysOfType(employee, month, "unpaid");
  if (unpaid.days) {
    rows.push({
      id: "unpaid", cite: ar ? "اتفاق" : "Agreement",
      title: ar ? `إجازة بلا أجر · ${unpaid.days} يوماً` : `Unpaid leave · ${unpaid.days} days`,
      detail: ar ? "تُحسم في «بنود الخصم» من الحضور المقفل — لا تُحسب هنا مرتين" : "Taken in the deduction lines from locked attendance — not counted twice here",
      amount: 0,
      tone: "mute",
    });
  }
  const injuryCut = (Number(line.injuryReduction) || 0) + (Number(line.injuryUnpaid) || 0) + (Number(line.injuryWageStop) || 0);
  if (Number(line.injuryDays) > 0) {
    rows.push({
      id: "injury", cite: "137–139",
      title: ar ? `إصابة عمل · ${line.injuryDays} يوماً` : `Work injury · ${line.injuryDays} days`,
      detail: injuryCut > 0 ? (ar ? "بنص النظام — ليست حسماً من المادة 92" : "Set by law — not an Art. 92 deduction") : (ar ? "بأجر كامل" : "Full pay"),
      amount: -injuryCut,
      tone: injuryCut > 0 ? "warn" : "ok",
    });
  }
  return { rows, sick };
}
