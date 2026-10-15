/**
 * What an overtime assignment is worth to this worker — both ways, in his own numbers.
 *
 *   المادة 107 — أجر الساعة الإضافية = أجر الساعة (من الأجر الفعلي، المادة 2) + 50% من أجر الساعة الأساسي.
 *               ويجوز بموافقة العامل احتساب إجازة تعويضية مدفوعة بدل الأجر.
 *   اللائحة 22 مكرر — الإجازة لا تقل عن ساعة ونصف عن كل ساعة إضافية، تُحدَّد خلال 60 يوماً، ولا تزيد
 *               على 30 يوماً في السنة؛ وإن ترك العمل قبل التمتع بها تُدفع أجرتها.
 *   اللائحة 22 — لا تزيد الساعات الإضافية على 720 ساعة في السنة إلا بموافقة العامل.
 *
 * Month = 30 days, day = the ordinary shift hours (8), the same divisor payroll uses.
 */

import { employeeWageSplit } from "./employeeFileView.js";
import { hourlyFromBase, overtimePay } from "./payrollDerivations.js";
import { compLeaveDaysInYear, defaultCompLeaveEnjoyDate, otCreditDays, otHoursInYear, parseOtHours } from "./overtimeAssignment.js";
import { ruleValue } from "./laborRules.js";
import { regulationDate } from "./workRegulation.js";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function sar(n, ar = true) {
  const v = r2(n);
  const s = v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return ar ? `${s} ر.س` : `SAR ${s}`;
}

/** Hours as words people read: «ساعة»، «ساعتان»، «3 ساعات»، «4.5 ساعة». */
export function hoursAr(h) {
  const n = r2(h);
  if (n === 1) return "ساعة واحدة";
  if (n === 2) return "ساعتان";
  if (Number.isInteger(n) && n >= 3 && n <= 10) return `${n} ساعات`;
  return `${n} ساعة`;
}

/** «لساعة واحدة»، «لساعتين»، «لـ3 ساعات». */
function forHoursAr(h) {
  const n = r2(h);
  if (n === 1) return "لساعة واحدة";
  if (n === 2) return "لساعتين";
  if (Number.isInteger(n) && n >= 3 && n <= 10) return `لـ${n} ساعات`;
  return `لـ${n} ساعة`;
}

/**
 * Both choices for one assignment: { known, pay: {...}, leave: {...}, year: {...}, notes: [] }.
 * `known` is false when the file has no basic wage — pay is then computed in payroll, not here.
 */
export function otOffer({ employee, hours, date, exceptId } = {}) {
  const h = parseOtHours(hours) ?? 0;
  const day = String(date || "").slice(0, 10);
  const year = day.slice(0, 4) || String(new Date().getFullYear());
  const wage = employeeWageSplit(employee?.profile || {}, employee);
  const base = Number(wage.base) || 0;
  const allowances = Number(wage.allowances) || 0;
  const known = base > 0;
  const hourlyActual = hourlyFromBase(base + allowances);
  const premiumPart = hourlyFromBase(base) * ((Number(ruleValue("hours.ot.premium", day || undefined)) || 1.5) - 1);
  const perHour = r2(hourlyActual + premiumPart);
  const total = known ? overtimePay(base, h, allowances) : 0;
  const leaveHoursPer = Number(ruleValue("hours.ot.compLeave.minHoursPerOtHour", day || undefined)) || 1.5;
  const dayHours = Number(ruleValue("hours.shift.ordinaryHours", day || undefined)) || 8;
  const leaveHours = r2(h * leaveHoursPer);
  const leaveDays = otCreditDays(h, day || undefined);
  const others = employee?.otherRequests || [];
  const hoursYtd = otHoursInYear(others, year, exceptId);
  const capHours = Number(ruleValue("hours.ot.annualMaxHours", day || undefined)) || 720;
  const leaveYtd = compLeaveDaysInYear(others, year, exceptId);
  const capLeave = Number(ruleValue("hours.ot.compLeave.maxDaysPerYear", day || undefined)) || 30;
  const takeBy = day ? defaultCompLeaveEnjoyDate(day) : "";
  return {
    hours: h,
    known,
    pay: {
      base,
      allowances,
      actual: base + allowances,
      hourlyActual: r2(hourlyActual),
      premiumPart: r2(premiumPart),
      perHour,
      total,
      basicOnly: known ? r2(hourlyFromBase(base) * 1.5 * h) : 0,
      wagePart: r2(hourlyActual * h),
      extraPart: r2(premiumPart * h),
    },
    leave: {
      perOtHour: leaveHoursPer,
      hours: leaveHours,
      days: leaveDays,
      dayHours,
      takeBy,
      worth: known ? r2(hourlyActual * leaveHours) : 0,
    },
    year: {
      hoursYtd,
      hoursAfter: r2(hoursYtd + h),
      capHours,
      overCap: hoursYtd + h > capHours,
      leaveYtd,
      leaveAfter: Math.round((leaveYtd + leaveDays) * 1000) / 1000,
      capLeave,
      leaveOverCap: leaveYtd + leaveDays > capLeave,
    },
  };
}

/** The lines the worker reads, plain and in his numbers. */
export function otOfferLines(offer, ar = true) {
  const { pay, leave, year, hours } = offer;
  const rowsPay = offer.known ? [
    [ar ? "أجر ساعتك (أجرك الفعلي ÷ 30 ÷ 8)" : "Your hourly wage (actual ÷ 30 ÷ 8)", sar(pay.hourlyActual, ar)],
    [ar ? "+ 50% من أجر ساعتك الأساسي" : "+ 50% of your basic hourly", sar(pay.premiumPart, ar)],
    [ar ? "= الساعة الإضافية" : "= one overtime hour", sar(pay.perHour, ar)],
    [ar ? "× عدد الساعات" : "× hours", String(hours)],
    [ar ? "المجموع — مع راتب الشهر" : "Total — with the month's pay", sar(pay.total, ar), true],
  ] : [];
  const rowsLeave = [
    [ar ? "عن كل ساعة إضافية" : "Per overtime hour", ar ? "ساعة ونصف" : "1.5 hours"],
    [ar ? "مدة إجازتك" : "Your leave", ar ? `${hoursAr(leave.hours)} (${leave.days} يوم)` : `${leave.hours} h (${leave.days} day)`, true],
    leave.takeBy ? [ar ? "تتمتع بها حتى" : "Take it by", regulationDate(leave.takeBy, ar)] : null,
    [ar ? "إن تركت العمل قبلها" : "If you leave first", ar ? "تُصرف أجرتها" : "It is paid out"],
  ].filter(Boolean);
  const lines = {
    rowsPay,
    rowsLeave,
    payTitle: ar ? `أجر إضافي · ${offer.known ? sar(pay.total) : "يُحسب في المسير"}` : `Overtime pay · ${offer.known ? sar(pay.total, false) : "computed in payroll"}`,
    payHow: offer.known
      ? (ar
        ? `الساعة = أجر ساعتك ${sar(pay.hourlyActual)} (أجرك الفعلي ${sar(pay.actual)} ÷ 30 ÷ 8) + 50% من أجر ساعتك الأساسي ${sar(pay.premiumPart)} = ${sar(pay.perHour)}. ${forHoursAr(hours)}: ${sar(pay.wagePart)} + ${sar(pay.extraPart)} = ${sar(pay.total)}، يُصرف مع راتب الشهر (المادة 107).`
        : `Per hour ${sar(pay.perHour, false)}: your hourly wage ${sar(pay.hourlyActual, false)} + 50% of your basic hourly ${sar(pay.premiumPart, false)} (Art. 107). × ${hours} h = ${sar(pay.total, false)}, paid with the month's salary.`)
      : (ar ? "لا أجر أساسي مسجّل في ملفك — يُحسب المبلغ في المسير بالقاعدة نفسها (المادة 107)." : "No basic wage on your file — payroll computes it by the same rule (Art. 107)."),
    leaveTitle: ar ? `إجازة تعويضية · ${hoursAr(leave.hours)}` : `Compensatory leave · ${leave.hours} h`,
    leaveHow: ar
      ? `ساعة ونصف عن كل ساعة إضافية (اللائحة 22 مكرر): ${hoursAr(hours)} × 1.5 = ${hoursAr(leave.hours)}، أي ${leave.days} من يوم عمل (${leave.dayHours} ساعات) تُضاف إلى رصيدك مدفوعة الأجر${leave.worth ? ` — قيمتها نحو ${sar(leave.worth)} من أجرك` : ""}.${leave.takeBy ? ` تتمتع بها حتى ${regulationDate(leave.takeBy)} ما لم يُتفق على موعد أبعد.` : ""} وإن تركت العمل قبل أخذها تُصرف لك أجرتها.`
      : `1.5 hours per overtime hour (regs Art. 22 bis): ${hours} × 1.5 = ${leave.hours} h = ${leave.days} of a working day, paid. Take it by ${leave.takeBy || "—"} unless agreed later; paid out if you leave first.`,
    yearLine: ar
      ? `إضافيك هذه السنة بعد هذا التكليف ${year.hoursAfter} من ${year.capHours} ساعة${year.overCap ? " — يتجاوز السقف ويحتاج إقرارك" : ""} · إجازتك التعويضية ${year.leaveAfter} من ${year.capLeave} يوماً إن اخترتها${year.leaveOverCap ? " — تتجاوز السقف فلا تُتاح" : ""}.`
      : `Overtime this year after this: ${year.hoursAfter} of ${year.capHours} h · compensatory leave ${year.leaveAfter} of ${year.capLeave} days if chosen.`,
    compare: offer.known && leave.worth
      ? (ar
        ? `الفرق: الأجر ${sar(pay.total)} نقداً، والإجازة ${hoursAr(leave.hours)} راحة بأجرك المعتاد. الاختيار لك وحدك (المادة 107).`
        : `Pay is ${sar(pay.total, false)} in cash; leave is ${leave.hours} h of paid rest. The choice is yours alone (Art. 107).`)
      : (ar ? "الاختيار لك وحدك — لا يحوّل المدير الأجر إلى إجازة (المادة 107)." : "The choice is yours alone (Art. 107)."),
  };
  return lines;
}

/** One line for an assignment row, the same on both sides: hours, then the choice and its value. */
export function otAssignmentLine(request, employee, ar = true) {
  const hours = parseOtHours(request?.hours);
  const head = hours != null ? (ar ? hoursAr(hours) : `${hours} h`) : "";
  const comp = request?.compensation || request?.compensationChoice || "";
  if (comp !== "pay" && comp !== "credit") {
    return ar ? `${head} · بانتظار اختيار الموظف للتعويض` : `${head} · awaiting the worker's choice`;
  }
  const offer = otOffer({ employee, hours: request.hours, date: request.date, exceptId: request.id });
  if (comp === "credit") {
    return ar
      ? `${head} · اختار: إجازة تعويضية ${hoursAr(offer.leave.hours)}${request.enjoyDate ? ` يتمتع بها حتى ${regulationDate(request.enjoyDate)}` : ""}`
      : `${head} · chose: ${offer.leave.hours} h compensatory leave`;
  }
  return ar
    ? `${head} · اختار: أجر إضافي ${offer.known ? sar(offer.pay.total) : "(يُحسب في المسير)"} مع راتب الشهر`
    : `${head} · chose: overtime pay ${offer.known ? sar(offer.pay.total, false) : ""}`;
}

/**
 * The month's overtime on the payslip, line by line: each approved assignment the worker took as pay
 * (its date, hours, amount), the rest from approved attendance, and — with no amount — the hours he
 * chose as compensatory leave. Amounts add up to the run's overtime pay.
 * Returns { rows: [{ id, label, hours, amount, source, info }], assignedHours, attendanceHours, compHours }.
 */
export function otMonthBreakdown({ employee, month, totalHours = 0, totalPay = 0, base = 0, allowances = 0, ar = true } = {}) {
  const m = String(month || "").slice(0, 7);
  const inMonth = (row) => String(row?.date || "").slice(0, 7) === m;
  const assigned = (employee?.otherRequests || [])
    .filter((row) => row?.type === "overtime" && (row.assignment === true || row.source === "assignment") && row.status === "approved" && inMonth(row))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const pay = assigned.filter((row) => (row.compensation || row.compensationChoice) === "pay");
  const comp = assigned.filter((row) => (row.compensation || row.compensationChoice) === "credit");
  const total = Math.max(0, Number(totalHours) || 0);
  const payTotal = Math.max(0, Number(totalPay) || 0);
  const rows = [];
  let usedHours = 0;
  let usedPay = 0;
  const assignedHours = pay.reduce((s, row) => s + (parseOtHours(row.hours) || 0), 0);
  const fits = assignedHours > 0 && assignedHours <= total + 0.001;
  if (fits) {
    for (const row of pay) {
      const h = parseOtHours(row.hours) || 0;
      const amount = overtimePay(base, h, allowances);
      usedHours += h;
      usedPay += amount;
      rows.push({
        id: `ot-${row.id}`,
        label: ar ? `أجر إضافي — تكليف ${regulationDate(row.date)} · ${hoursAr(h)}` : `Overtime — assignment ${row.date} · ${h} h`,
        hours: h,
        amount,
        source: ar ? `اخترت الأجر وأقررت به · المادة 107: أجر الساعة + 50% من الأساسي${row.recordedBy ? ` · كلّفك ${row.recordedBy}` : ""}` : "You chose pay · Art. 107",
      });
    }
  }
  const restHours = r2(total - usedHours);
  const restPay = r2(payTotal - usedPay);
  if (restHours > 0.001 || (!rows.length)) {
    rows.push({
      id: "ot",
      label: ar ? `أجر إضافي${rows.length ? " من الحضور" : ""} — ${hoursAr(restHours)}` : `Overtime${rows.length ? " — attendance" : ""} — ${restHours} h`,
      hours: restHours,
      amount: rows.length ? restPay : payTotal,
      source: ar ? "الحضور المقفل والإضافي المعتمد · المادة 107: أجر الساعة + 50% من الأساسي" : "Locked attendance · Art. 107",
    });
  }
  const compHours = comp.reduce((s, row) => s + (parseOtHours(row.hours) || 0), 0);
  if (compHours > 0) {
    const leaveHours = r2(comp.reduce((s, row) => s + (row.compHours != null ? Number(row.compHours) : (parseOtHours(row.hours) || 0) * 1.5), 0));
    rows.push({
      id: "ot-comp",
      label: ar ? `${hoursAr(compHours)} إضافية حُوّلت إلى إجازة تعويضية باختيارك` : `${compHours} overtime h taken as compensatory leave`,
      hours: compHours,
      amount: 0,
      info: true,
      valueText: ar ? `${hoursAr(leaveHours)} إجازة` : `${leaveHours} h leave`,
      source: ar ? "لا مبلغ في القسيمة — أُضيفت إلى رصيدك التعويضي (المادة 107 · اللائحة 22 مكرر)" : "No amount — added to your comp balance",
    });
  }
  return { rows, assignedHours: r2(assignedHours), attendanceHours: restHours > 0 ? restHours : 0, compHours: r2(compHours) };
}
