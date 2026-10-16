/**
 * «حقوقي» — the worker's rights as plain lines, each computed from his own file:
 *   annual leave left (Arts. 109/111, carried days included) · next salary date (Art. 90 + company
 *   payday, model regulation Art. 17) · the 50% deduction cap (Art. 93) · end-of-service award to date
 *   (Art. 84, deriveEos) · overtime awaiting pay (Art. 107) · full-pay sick days left (Art. 117) ·
 *   compensatory leave (Art. 107 / regs 22 bis) · any open time-limited right (grievance reply/court
 *   window, damage-objection window, the Art. 78 job-search day while the employer's notice runs).
 *
 * Pure: no store, no React; safe in node tests. Figures come from existing derivations only.
 */
import { ruleValue } from "./laborRules.js";
import { annualBalanceSplit, usedLeaveDays } from "./leaveTypes.js";
import { companyPayday } from "./payrollLaw.js";
import { deriveEos } from "./offboardingDerivations.js";
import { employeeWageSplit } from "./employeeFileView.js";
import { compBalance } from "./compLeave.js";
import { hoursAr, otOffer, sar } from "./otOffer.js";
import { isOvertimeAssignment, otCompensationOf } from "./overtimeAssignment.js";
import { DAMAGE_OBJECTION_TYPE, GRIEVANCE_TYPE, employerNoticeOf, grievanceState } from "./rightsRequests.js";
import { hintDate } from "./rightHints.js";

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

function nextMonth(month) {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** This month's payday, or next month's once it has passed. null when the company set none. */
export function nextPayday(settings, today, isOff = () => false) {
  const day = dateOnly(today);
  if (!day) return null;
  const month = day.slice(0, 7);
  const now = companyPayday(settings, month, isOff);
  if (!now) return null;
  return day <= now.due ? now : companyPayday(settings, nextMonth(month), isOff);
}

/** Every payroll line on file: the monthly runs' items (and a flat `payroll` list when present). */
export function payrollItemsOf(data) {
  const runs = (data?.payrollRuns || []).flatMap((run) => (run?.items || []).map((item) => ({ month: run.month, ...item })));
  return [...runs, ...(Array.isArray(data?.payroll) ? data.payroll : [])];
}

const art = (article, ar) => ({ article: String(article), label: ar ? `المادة ${article}` : `Art. ${article}` });
const regs = (n, ar) => ({ regs: String(n), label: ar ? `اللائحة م${n}` : `Regs Art. ${n}` });

/**
 * ctx: { employee, data (company data: settings, payroll), today, lang|ar, isOff(iso), isHoliday(iso) }.
 * Returns ordered lines: { id, text, figure, unit, note, law, action? } — time-limited rights first.
 */
export function buildMyRights(ctx = {}) {
  const ar = ctx.ar ?? (ctx.lang ? ctx.lang === "ar" : true);
  const emp = ctx.employee;
  if (!emp) return [];
  const today = dateOnly(ctx.today) || new Date().toISOString().slice(0, 10);
  const p = emp.profile || {};
  const reqs = emp.leaveRequests || [];
  const others = emp.otherRequests || [];
  const d = (iso) => hintDate(iso, today, ar);
  const urgent = [];
  const lines = [];

  // ── open, time-limited rights ───────────────────────────────────────────
  for (const row of others) {
    if (row?.type !== GRIEVANCE_TYPE || ["withdrawn"].includes(row.status)) continue;
    const gs = grievanceState(row, today, ctx.isHoliday);
    if (!gs) continue;
    if (gs.stage === "pending" && gs.replyBy && gs.replyBy >= today) {
      urgent.push({
        id: `grievance-reply-${row.id}`,
        text: ar ? "ترد الشركة على تظلمك كتابةً حتى" : "The company answers your grievance by",
        figure: d(gs.replyBy), unit: "", due: gs.replyBy,
        law: regs("71", ar),
      });
    } else if ((gs.stage === "refused" || gs.stage === "overdue") && gs.courtBy && gs.courtBy >= today) {
      urgent.push({
        id: `grievance-court-${row.id}`,
        text: ar ? (gs.stage === "refused" ? "رُفض تظلمك — لك المحكمة العمالية حتى" : "لم يُرد على تظلمك — لك المحكمة العمالية حتى") : "You may go to the labour court by",
        figure: d(gs.courtBy), unit: "", due: gs.courtBy,
        law: regs("71", ar),
        action: { kind: "href", href: "https://najiz.sa", external: true, label: ar ? "ناجز" : "Najiz" },
      });
    }
  }
  const objected = new Set(others.filter((r) => r?.type === DAMAGE_OBJECTION_TYPE).map((r) => String(r.damageCaseId || r.deductionLineId || "")));
  for (const item of payrollItemsOf(ctx.data)) {
    if (String(item?.employeeId) !== String(emp.id)) continue;
    for (const line of item.deductionLines || []) {
      if (line?.source !== "damage") continue;
      const last = dateOnly(line.objectionLastDay);
      if (!last || last < today) continue;
      if (objected.has(String(line.damageCaseId || "")) || objected.has(String(line.id || ""))) continue;
      urgent.push({
        id: `damage-${line.id}`,
        text: ar ? `لك الاعتراض على خصم إتلاف ${sar(Number(line.amount) || 0, ar)} حتى` : `You may object to a ${sar(Number(line.amount) || 0, ar)} damage deduction by`,
        figure: d(last), unit: "", due: last,
        law: art("91", ar),
        action: { kind: "rights", rightsKind: DAMAGE_OBJECTION_TYPE, label: ar ? "اعترض" : "Object" },
      });
    }
  }
  const notice = employerNoticeOf(emp, today);
  if (notice) {
    urgent.push({
      id: "job-search",
      text: ar ? "يوم بأجره كل أسبوع للبحث عن عمل، حتى نهاية الإشعار" : "One paid job-search day a week, until the notice ends",
      figure: d(notice.until), unit: "", due: notice.until,
      law: art("78", ar),
      action: { kind: "raise", requestKind: "leave", leaveType: "job_search", label: ar ? "حدّد اليوم" : "Pick the day" },
    });
  }
  urgent.sort((a, b) => String(a.due).localeCompare(String(b.due)));

  // ── standing rights ─────────────────────────────────────────────────────
  const split = annualBalanceSplit(p, reqs, today, ctx.data, emp);
  if (split.currentTotal != null) {
    lines.push({
      id: "annual",
      text: ar ? "رصيد إجازتك السنوية بأجر كامل" : "Annual leave left on full pay",
      figure: String(split.remaining), unit: ar ? "يوماً" : "days",
      note: split.carryLeft > 0
        ? ((reqs.some((r) => String(r?.type || "").toLowerCase() === "annual" && r?.status === "approved") || p?.leaveOpeningBalance?.asOf)
          ? (ar ? `منها ${split.carryLeft} مرحّلة من سنة سابقة — لا تسقط، وتُصرف أجرتها عند انتهاء الخدمة` : `${split.carryLeft} carried — never lost; paid at exit`)
          : (ar ? `منها ${split.carryLeft} من سنوات لا سجل إجازات لها في المنصة — تؤكدها الموارد البشرية برصيد افتتاحي، ولا تسقط` : `${split.carryLeft} from years with no leave record here — HR confirms them; never lost`))
        : (ar ? "ما لا تأخذه تُصرف أجرته عند انتهاء الخدمة" : "Untaken days are paid at exit"),
      law: art(split.carryLeft > 0 ? "111" : "109", ar),
    });
  }

  const wage = (() => {
    const w = employeeWageSplit(p, emp);
    return Math.max(0, (Number(w.base) || 0) + (Number(w.allowances) || 0));
  })();
  const pay = nextPayday(ctx.data?.settings, today, ctx.isOff);
  lines.push({
    id: "payday",
    text: pay
      ? (ar ? `يُودَع راتبك${pay.shifted ? " (قُدّم لأن موعده راحة أو عطلة)" : ""} في` : `Your salary is deposited${pay.shifted ? " (moved earlier: rest day or holiday)" : ""} on`)
      : (ar ? "يُصرف راتبك في موعده كل شهر — لم تحدّد الشركة يوم الدفع بعد" : "Your salary is paid on time each month — no payday set yet"),
    figure: pay ? d(pay.due) : "", unit: "",
    law: art("90", ar),
  });
  if (wage > 0) {
    const ratio = Number(ruleValue("payroll.deduction.capRatio", today)) || 0.5;
    lines.push({
      id: "deduction-cap",
      text: ar ? "أقصى ما يُحسم من أجرك في الشهر (نصفه)" : "The most that may be deducted a month (half)",
      figure: sar(Math.floor(wage * ratio), ar), unit: "",
      law: art("93", ar),
    });
  }

  const hire = dateOnly(p.hireDate);
  if (hire && hire <= today && wage > 0) {
    const eos = deriveEos({ hireDate: hire, profile: p, leaveRequests: reqs }, new Date(`${today}T12:00:00`).getTime());
    if (!eos.preStart) {
      lines.push({
        id: "eos",
        text: ar ? "مكافأة نهاية خدمتك المستحقة حتى اليوم" : "End-of-service award accrued to date",
        figure: sar(eos.article84Full, ar), unit: "",
        note: ar ? `عن ${Math.floor(eos.years * 10) / 10} سنة خدمة — نصف شهر عن كل سنة من الخمس الأولى ثم شهر` : `${Math.floor(eos.years * 10) / 10} years of service`,
        law: art("84", ar),
      });
    }
  }

  const month = today.slice(0, 7);
  const otRows = others.filter((r) => isOvertimeAssignment(r) && r.status === "approved" && otCompensationOf(r) === "pay" && !r.paidAt && String(r.date || "").slice(0, 7) >= month);
  if (otRows.length) {
    let total = 0;
    let hours = 0;
    for (const r of otRows) {
      const o = otOffer({ employee: emp, hours: r.hours, date: r.date, exceptId: r.id });
      total += o.known ? o.pay.total : 0;
      hours += o.hours;
    }
    lines.push({
      id: "ot-pay",
      text: ar ? `أجر ساعات إضافية معتمدة (${hoursAr(Math.round(hours * 100) / 100)}) يُصرف مع راتب الشهر` : `Approved overtime (${hours} h) paid with the month's salary`,
      figure: total > 0 ? sar(Math.round(total * 100) / 100, ar) : "—", unit: "",
      law: art("107", ar),
    });
  }

  const full = Number(ruleValue("leave.sick.fullPayDays", today)) || 0;
  if (full) {
    const used = usedLeaveDays(reqs, "sick", today, hire);
    lines.push({
      id: "sick",
      text: ar ? "أيام مرضية متبقية بأجر كامل هذه السنة" : "Full-pay sick days left this year",
      figure: String(Math.max(0, full - used)), unit: ar ? "يوماً" : "days",
      note: ar ? `ثم ${ruleValue("leave.sick.halfPayDays", today)} بثلاثة أرباع الأجر` : `then ${ruleValue("leave.sick.halfPayDays", today)} at three-quarters`,
      law: art("117", ar),
    });
  }

  const bal = compBalance(emp, today);
  if (bal.left > 0) {
    lines.push({
      id: "comp",
      text: ar ? `إجازة تعويضية عن إضافي${bal.nextTakeBy ? ` — تمتع بها حتى ${d(bal.nextTakeBy)}` : ""}` : `Comp leave for overtime${bal.nextTakeBy ? ` — take by ${d(bal.nextTakeBy)}` : ""}`,
      figure: hoursAr(bal.left), unit: "",
      law: art("107", ar),
    });
  }

  return [...urgent, ...lines];
}
