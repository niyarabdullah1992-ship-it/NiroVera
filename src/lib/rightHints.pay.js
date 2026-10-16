/**
 * «حقك / التزامك» for payroll and قسيمتي — one hint per payslip line, deduction line, payroll item,
 * end-of-service figure and custody set-off. Same three-line shape as src/lib/rightHints.js:
 *   right  — the right (employee) or duty (manager) for THIS item, with its amounts and dates.
 *   ifNot  — what to do if it is not applied (employee) / the consequence of delay (manager).
 *   action — one ready flow: a rights request (`to: rightsRouteFor(kind)`), the
 *            payroll tab or employee file, or the labour court.
 *   law    — the article whose official text the hint opens.
 *   due    — manager only: the legal date to act by, when the law sets one.
 *
 * Pure (no store, no React); figures come from laborRules / payrollDerivations / the record passed in.
 * Self-contained on purpose — it does not import rightHints.js (which registers this module).
 */
import { ruleValue } from "./laborRules.js";
import { overtimePay } from "./payrollDerivations.js";
import { regulationDate } from "./workRegulation.js";
import { DAMAGE_OBJECTION_TYPE, GRIEVANCE_TYPE, damageObjectionDeadline, rightsRouteFor } from "./rightsRequests.js";

const COURT_URL = "https://najiz.sa";

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};
const num = (v) => Number(v) || 0;
/** «يوم واحد»، «يومين»، «3 أيام»، «12 يوماً». */
const dAr = (v) => {
  const n = Math.round(num(v) * 10) / 10;
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومين";
  return Number.isInteger(n) && n >= 3 && n <= 10 ? `${n} أيام` : `${n} يوماً`;
};
const r2 = (n) => Math.round(num(n) * 100) / 100;

/** «2,500 ر.س» / «SAR 2,500». */
export function paySar(n, ar = true) {
  const v = r2(Math.abs(num(n)));
  const s = v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return ar ? `${s} ر.س` : `SAR ${s}`;
}

function payDate(iso, today, ar) {
  const d = dateOnly(iso);
  if (!d) return "";
  const full = regulationDate(d, ar);
  return dateOnly(today).slice(0, 4) === d.slice(0, 4) ? full.replace(/\s\d{4}$/, "") : full;
}

function addDays(iso, n) {
  const d = dateOnly(iso);
  if (!d) return "";
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

const art = (a, ar) => ({ article: String(a), label: ar ? `المادة ${a}` : `Art. ${a}` });
const model = (n, ar) => ({ regs: `model-${n}`, label: ar ? `النموذج الموحد م${n}` : `Model regulation Art. ${n}` });
const gosiLaw = (ar) => ({ product: true, label: ar ? "نظام التأمينات" : "GOSI law" });

const rightsTo = (kind) => rightsRouteFor(kind);
const ACT = {
  grievance: (ar) => ({ kind: "rights", rightsKind: GRIEVANCE_TYPE, to: rightsTo(GRIEVANCE_TYPE), label: ar ? "قدّم تظلماً" : "File a grievance" }),
  objection: (ar) => ({ kind: "rights", rightsKind: DAMAGE_OBJECTION_TYPE, to: rightsTo(DAMAGE_OBJECTION_TYPE), label: ar ? "اعترض على الخصم" : "Object to the deduction" }),
  court: (ar) => ({ kind: "href", href: COURT_URL, external: true, label: ar ? "المحكمة العمالية (ناجز)" : "Labour court (Najiz)" }),
  wps: (ar) => ({ kind: "route", to: "/app/payroll?tab=wps", label: ar ? "افتح حماية الأجور" : "Open wage protection" }),
  run: (ar) => ({ kind: "route", to: "/app/payroll", label: ar ? "افتح المسير" : "Open the run" }),
  deduct: (ar) => ({ kind: "route", to: "/app/payroll?tab=deduct", label: ar ? "افتح بنود الخصم" : "Open the deductions" }),
  gosi: (ar) => ({ kind: "route", to: "/app/payroll?tab=gosi", label: ar ? "افتح التأمينات" : "Open GOSI" }),
  file: (ar, id) => ({ kind: "route", to: id ? `/app/employees/${encodeURIComponent(id)}` : "/app/employees", label: ar ? "افتح ملف الموظف" : "Open the file" }),
};

const nameOf = (c) => c.name || c.employee?.name || (c.ar ? "الموظف" : "the worker");

/** Assemble the hint for the lane. `employee`/`manager` are { right, ifNot, action } overrides. */
function pack(c, { law, employee, manager, due }) {
  const isManager = c.view === "manager";
  const lane = isManager ? manager : employee;
  return {
    view: isManager ? "manager" : "employee",
    word: c.ar ? (isManager ? "التزامك" : "حقك") : (isManager ? "Your duty" : "Your right"),
    right: lane.right,
    ifNot: lane.ifNot,
    action: lane.action,
    law,
    due: isManager ? dateOnly(due) : "",
  };
}

const workerGrieve = (c, text) => ({
  ifNot: text || (c.ar ? "إن لم يُطبَّق: تظلّم كتابةً، ثم لك المحكمة العمالية." : "If not applied: grieve in writing, then the labour court."),
  action: ACT.grievance(c.ar),
});

/* ── builders: (ctx) → hint ─────────────────────────────────────────────── */

const B = {
  /** The month's wage: due date and WPS (Arts 90/94, model regulation Arts 15/17). ctx: amount, payday {due, scheduled, shifted}, paid, paidAt. */
  wage(c) {
    const { ar, today } = c;
    const amount = paySar(c.amount, ar);
    const due = dateOnly(c.payday?.due) || dateOnly(c.due);
    const shifted = Boolean(c.payday?.shifted);
    const when = due ? payDate(due, today, ar) : "";
    const paidOn = c.paid ? payDate(c.paidAt, today, ar) : "";
    const law = shifted ? model(17, ar) : art(90, ar);
    const late = !c.paid && due && dateOnly(today) > due;
    return pack(c, {
      law,
      due: c.paid ? "" : due,
      employee: {
        right: ar
          ? (c.paid
            ? `صُرف صافي أجرك ${amount}${paidOn ? ` في ${paidOn}` : ""} بالريال إلى حسابك عبر حماية الأجور.`
            : when
              ? `صافي أجرك ${amount} يُودَع بالريال في حسابك عبر حماية الأجور يوم ${when}${shifted ? " — قُدّم لأن موعده راحة أو عطلة" : ""}.`
              : `صافي أجرك ${amount} يُصرف مرة في الشهر بالريال إلى حسابك عبر حماية الأجور.`)
          : (c.paid
            ? `Your wage of ${amount} was paid${paidOn ? ` on ${paidOn}` : ""} in SAR to your account through wage protection.`
            : when
              ? `Your wage of ${amount} is deposited in SAR through wage protection on ${when}${shifted ? " — moved earlier as the day is a rest day or holiday" : ""}.`
              : `Your wage of ${amount} is paid once a month in SAR to your account through wage protection.`),
        ...workerGrieve(c, ar
          ? `${late ? "تأخر عن موعده: " : "إن تأخر دون مسوغ: "}تظلّم كتابةً، ولك أن تطلب من المحكمة العمالية أمراً بصرفه (المادة 94).`
          : `${late ? "It is late: " : "If late without cause: "}grieve in writing; the labour court may order it paid (Art. 94).`),
      },
      manager: {
        right: ar
          ? (c.paid
            ? `صُرف أجر ${nameOf(c)} ${amount}${paidOn ? ` في ${paidOn}` : ""} — يبقى قيده في ملف حماية الأجور.`
            : `صرف ${amount} لـ${nameOf(c)} بالريال عبر ملف حماية الأجور${when ? ` بحلول ${when}` : " مرة في الشهر"}${shifted ? " (يوم العمل السابق للراحة)" : ""}.`)
          : (c.paid
            ? `${nameOf(c)}'s wage of ${amount} was paid${paidOn ? ` on ${paidOn}` : ""} — its record stays in the WPS file.`
            : `Pay ${amount} to ${nameOf(c)} in SAR through the WPS file${when ? ` by ${when}` : " once a month"}${shifted ? " (the working day before the rest day)" : ""}.`),
        ifNot: ar
          ? `${late ? "مضى الموعد: " : ""}التأخير بلا مسوغ يتيح للعامل أمراً من المحكمة العمالية بصرفه مع غرامة (المادة 94)، ويُرصد في حماية الأجور.`
          : `${late ? "The day has passed: " : ""}an unjustified delay lets the worker obtain a labour-court order with a fine (Art. 94), and WPS records it.`,
        action: ACT.wps(ar),
      },
    });
  },

  /** The run's WPS file: within the file window of entitlement. ctx: month, heads, deadline. */
  wps(c) {
    const { ar, today } = c;
    const days = ruleValue("payroll.wps.fileWindowDays", today);
    const when = payDate(c.deadline, today, ar);
    return pack(c, {
      law: model(15, ar),
      due: c.deadline,
      employee: {
        right: ar ? `يُرفع أجرك في ملف حماية الأجور خلال ${dAr(days)} من استحقاقه، ويُودع في حسابك البنكي.` : `Your wage goes into the WPS file within ${days} days of entitlement and into your bank account.`,
        ...workerGrieve(c),
      },
      manager: {
        right: ar
          ? `رفع ملف حماية الأجور${c.heads ? ` لـ${c.heads} عاملاً` : ""} خلال ${dAr(days)} من الاستحقاق${when ? ` — بحلول ${when}` : ""}، وإيداع الأجور في حسابات العمال.`
          : `Upload the WPS file${c.heads ? ` for ${c.heads} worker(s)` : ""} within ${days} days of entitlement${when ? ` — by ${when}` : ""}, depositing wages into workers' accounts.`,
        ifNot: ar ? "وإلا عُدّ الأجر متأخراً في حماية الأجور، وللعامل أمر المحكمة العمالية بصرفه (المادة 94)." : "Otherwise WPS records the wage as late, and the worker may obtain a court order (Art. 94).",
        action: ACT.wps(ar),
      },
    });
  },

  /** Overtime (Art. 107 + model regulation Art. 16). ctx: hours, amount, base, allowances, compHours. */
  overtime(c) {
    const { ar } = c;
    const hours = r2(c.hours);
    const rate = overtimePay(c.base, 1, c.allowances);
    const amount = c.amount != null ? num(c.amount) : overtimePay(c.base, hours, c.allowances);
    const comp = r2(c.compHours);
    const rateText = rate > 0 ? paySar(rate, ar) : "";
    return pack(c, {
      law: art(107, ar),
      employee: {
        right: ar
          ? (comp > 0 && !hours
            ? `${comp} ساعة إضافية أُخذت إجازة تعويضية بموافقتك الخطية بدل أجرها — لا مبلغ في القسيمة.`
            : `ساعة إضافيك = أجر ساعتك الفعلي + 50٪ من أجر الساعة الأساسي${rateText ? ` = ${rateText}` : ""}؛ ${hours} ساعة = ${paySar(amount, ar)}، تُصرف آخر شهر التكليف.`)
          : (comp > 0 && !hours
            ? `${comp} overtime hour(s) were taken as compensatory leave with your written consent instead of pay — no amount on the slip.`
            : `An overtime hour = your actual hourly wage + 50% of the basic hourly wage${rateText ? ` = ${rateText}` : ""}; ${hours} h = ${paySar(amount, ar)}, paid at the end of the month of assignment.`),
        ...workerGrieve(c, ar ? "إن نقصت الساعات أو السعر: تظلّم كتابةً بالساعات المعتمدة من البصمة." : "If hours or rate fall short: grieve in writing with the approved punch hours."),
      },
      manager: {
        right: ar
          ? `صرف ${hours} ساعة إضافية لـ${nameOf(c)} × ${rateText || "أجر الساعة + 50٪ من الأساسي"} = ${paySar(amount, ar)} مع مسير شهر التكليف، أو إجازة تعويضية بموافقته الخطية.`
          : `Pay ${hours} overtime hour(s) to ${nameOf(c)} × ${rateText || "hourly + 50% of basic"} = ${paySar(amount, ar)} with the month's run, or compensatory leave with written consent.`,
        ifNot: ar ? "وإلا بقي الإضافي ديناً للعامل يطالب به بتظلم ثم أمام المحكمة العمالية." : "Otherwise the overtime stays a debt the worker may claim by grievance, then in court.",
        action: ACT.run(ar),
      },
    });
  },

  /** GOSI: the worker's share is a statutory deduction (Art. 92/2); registration and remittance are the employer's. ctx: amount, saudi. */
  gosi(c) {
    const { ar } = c;
    const amount = paySar(c.amount, ar);
    return pack(c, {
      law: c.view === "manager" ? gosiLaw(ar) : art(92, ar),
      employee: {
        right: ar
          ? `حصتك في التأمينات ${amount} تُحسم نظاماً دون موافقة (المادة 92/2) وتُورَّد باسمك؛ حصة صاحب العمل عليه ولا تُحسم من أجرك.`
          : `Your GOSI share of ${amount} is deducted by law (Art. 92(2)) and remitted in your name; the employer's share is its own and never taken from your wage.`,
        ...workerGrieve(c, ar ? "إن لم تظهر الاشتراكات في سجلك بالتأمينات: تظلّم واطلب تسجيلك وتوريدها." : "If the contributions are not on your GOSI record: grieve and ask for registration and remittance."),
      },
      manager: {
        right: ar
          ? `تسجيل ${nameOf(c)} في التأمينات وتوريد الحصتين شهرياً على الأجر الخاضع — حصة العامل ${amount}، وحصة المنشأة عليها لا تُحسم من أجره.`
          : `Register ${nameOf(c)} with GOSI and remit both shares monthly on the contributory wage — the worker's ${amount}; the establishment's share is never taken from the wage.`,
        ifNot: ar ? "وإلا تُحتسب غرامة التأخير في التأمينات، وتتحمل المنشأة ما يفوت العامل من تغطية." : "Otherwise GOSI's late fine applies and the establishment bears any lost cover.",
        action: ACT.gosi(ar),
      },
    });
  },

  /** Unpaid leave: wage not due, not a deduction (Art. 116). ctx: days, amount. */
  unpaidLeave(c) {
    const { ar, today } = c;
    const days = num(c.days);
    const amount = paySar(c.amount, ar);
    const after = ruleValue("leave.unpaid.suspendAfterDays", today);
    const suspended = Math.max(0, days - after);
    return pack(c, {
      law: art(116, ar),
      employee: {
        right: ar
          ? `${dAr(days)} بلا أجر بموافقتك: ${amount} أجر غير مستحق لا خصماً${suspended ? `، و${dAr(suspended)} فوق ${after} يوقف فيها العقد` : `، ولا يوقف العقد ما لم تزد على ${dAr(after)}`}.`
          : `${days} unpaid day(s) by agreement: ${amount} is wage not due, not a deduction${suspended ? `; ${suspended} day(s) past ${after} suspend the contract` : `; the contract is not suspended unless past ${after} days`}.`,
        ...workerGrieve(c, ar ? "إن حُسبت أيام لم تطلبها بلا أجر: تظلّم كتابةً." : "If days you did not take unpaid were counted: grieve in writing."),
      },
      manager: {
        right: ar
          ? `تُنزل ${amount} عن ${dAr(days)} أجراً غير مستحق — لا بنداً في خصومات المادة 92${suspended ? `؛ و${dAr(suspended)} فوق ${after} لا تُحسب في مدة الخدمة` : ""}.`
          : `Lower ${amount} for ${days} day(s) as wage not due — not an Art. 92 deduction${suspended ? `; ${suspended} day(s) past ${after} do not count as service` : ""}.`,
        ifNot: ar ? "إن لم تكن بموافقة العامل الموثّقة صار ما نُزّل حسماً بلا سند يُرد له." : "Without the worker's documented agreement the cut is an undocumented deduction to be refunded.",
        action: ACT.run(ar),
      },
    });
  },

  /** Work-related detention: half the wage up to 180 days, refunded on acquittal (Art. 97). ctx: days, amount. */
  detention(c) {
    const { ar, today } = c;
    const ratio = Math.round(ruleValue("payroll.detention.payRatio", today) * 100);
    const max = ruleValue("payroll.detention.maxDays", today);
    const amount = paySar(c.amount, ar);
    return pack(c, {
      law: art(97, ar),
      employee: {
        right: ar
          ? `توقيفك ${dAr(num(c.days))} في قضية تتصل بالعمل: يُصرف لك ${ratio}٪ من أجرك حتى ${dAr(max)}، ويُرد المحسوم ${amount} إن بُرّئت أو حُفظت القضية.`
          : `Detained ${num(c.days)} day(s) in a work-related case: you are paid ${ratio}% of your wage up to ${max} days, and ${amount} is refunded on acquittal or dismissal of the case.`,
        ...workerGrieve(c, ar ? "إن صدرت البراءة ولم يُرد المحسوم: تظلّم كتابةً بنسخة الحكم." : "If acquitted and not refunded: grieve in writing with the ruling."),
      },
      manager: {
        right: ar
          ? `صرف ${ratio}٪ من أجر ${nameOf(c)} مدة التوقيف حتى ${dAr(max)}، ورد ${amount} كاملاً إن بُرّئ أو حُفظت القضية.`
          : `Pay ${nameOf(c)} ${ratio}% of the wage during detention up to ${max} days, and refund ${amount} in full on acquittal.`,
        ifNot: ar ? "حجب النصف أو تأخير الرد بعد البراءة حسمٌ بلا سند يُرد بأمر المحكمة العمالية." : "Withholding the half or the refund after acquittal is an undocumented deduction a court will reverse.",
        action: ACT.run(ar),
      },
    });
  },

  /** A refund line (Art. 91 accepted objection / Art. 97 acquittal). ctx: amount. */
  refund(c) {
    const { ar } = c;
    const amount = paySar(c.amount, ar);
    return pack(c, {
      law: art(91, ar),
      employee: {
        right: ar ? `رُدّ لك ${amount} — ما اقتُطع دون وجه حق يُرد خلال 7 أيام من الحكم أو قبول الاعتراض.` : `${amount} refunded — what was taken without right is returned within 7 days of the ruling or accepted objection.`,
        ...workerGrieve(c),
      },
      manager: {
        right: ar ? `رد ${amount} لـ${nameOf(c)} خلال 7 أيام من الحكم أو قبول الاعتراض.` : `Refund ${amount} to ${nameOf(c)} within 7 days of the ruling or accepted objection.`,
        ifNot: ar ? "وإلا صار للعامل طلبه أمام المحكمة العمالية." : "Otherwise the worker may claim it in the labour court.",
        action: ACT.run(ar),
      },
    });
  },

  /** Work injury (Arts 137–139). ctx: days, mode: "full" | "reduced" | "excluded" | "gosi", amount. */
  injury(c) {
    const { ar } = c;
    const days = num(c.days);
    const amount = paySar(c.amount, ar);
    if (c.mode === "excluded") {
      return pack(c, {
        law: art(139, ar),
        employee: {
          right: ar
            ? `لا تُحرم من معونة الإصابة (${dAr(days)}، ${amount}) إلا بقرار مكتوب يثبت تعمّدك أو سوء سلوك مقصوداً أو رفضك العلاج دون سبب.`
            : `Injury pay (${days} day(s), ${amount}) is withheld only by a written decision proving intent, deliberate misconduct or refusing treatment without cause.`,
          ...workerGrieve(c, ar ? "إن لم يثبت السبب: تظلّم من القرار كتابةً." : "If the ground is not proven: grieve the decision in writing."),
        },
        manager: {
          right: ar ? `حجب ${amount} عن ${nameOf(c)} يحتاج قراراً مكتوباً يثبت إحدى حالات المادة 139 الثلاث.` : `Withholding ${amount} from ${nameOf(c)} needs a written decision proving one of Art. 139's three cases.`,
          ifNot: ar ? "بلا إثبات يُرد المبلغ مع معونة المادة 137 كاملة." : "Without proof the amount is owed with the full Art. 137 pay.",
          action: ACT.file(ar, c.employeeId),
        },
      });
    }
    if (c.mode === "gosi") {
      return pack(c, {
        law: gosiLaw(ar),
        employee: {
          right: ar
            ? `إصابتك ${dAr(days)} مغطاة بالأخطار المهنية: التأمينات تصرف بدلك اليومي عن العجز المؤقت والعلاج، ولا يُجمع البدل مع الأجر.`
            : `Your ${days}-day injury is covered by occupational hazards: GOSI pays the daily allowance and treatment — never together with the wage.`,
          ...workerGrieve(c, ar ? "إن لم يُبلَّغ عن الإصابة أو تأخر البدل: تظلّم واطلب الإبلاغ." : "If the injury was not reported or the allowance is late: grieve and ask for the report."),
        },
        manager: {
          right: ar ? `إبلاغ التأمينات بإصابة ${nameOf(c)} في موعدها، وعدم الجمع بين الأجر والبدل اليومي.` : `Report ${nameOf(c)}'s injury to GOSI on time, and never pay the wage alongside the daily allowance.`,
          ifNot: ar ? "تأخر الإبلاغ يحمّل المنشأة ما يفوت العامل من البدل." : "A late report leaves the establishment liable for the lost allowance.",
          action: ACT.gosi(ar),
        },
      });
    }
    return pack(c, {
      law: art(137, ar),
      employee: {
        right: ar
          ? `عجزك المؤقت من إصابة عمل: أجرك كاملاً أول 60 يوماً ثم 75٪ طوال العلاج${c.mode === "reduced" ? ` — هنا ${dAr(days)} بعد اليوم 60 (${amount})` : ` — هنا ${dAr(days)}`}، ولا يُسترد ما دُفع.`
          : `Temporary disability from a work injury: full wage for 60 days, then 75% through treatment${c.mode === "reduced" ? ` — here ${days} day(s) after day 60 (${amount})` : ` — here ${days} day(s)`}; nothing paid is recovered.`,
        ...workerGrieve(c),
      },
      manager: {
        right: ar
          ? `صرف معونة ${nameOf(c)}: الأجر كاملاً أول 60 يوماً ثم 75٪ طوال العلاج${c.mode === "reduced" ? ` (${amount} نقص بنص النظام لا حسماً)` : ""}.`
          : `Pay ${nameOf(c)}'s injury aid: full wage for 60 days, then 75% through treatment${c.mode === "reduced" ? ` (${amount} is set by law, not a deduction)` : ""}.`,
        ifNot: ar ? "وإلا صار الفرق ديناً للعامل يُطالب به أمام المحكمة العمالية." : "Otherwise the gap is a debt the worker may claim in court.",
        action: ACT.run(ar),
      },
    });
  },

  /** Sick-pay bands (Art. 117). ctx: days, amount, band: "quarter" | "unpaid". */
  sick(c) {
    const { ar, today } = c;
    const full = ruleValue("leave.sick.fullPayDays", today);
    const mid = ruleValue("leave.sick.halfPayDays", today);
    const unpaid = ruleValue("leave.sick.unpaidDays", today);
    const days = num(c.days);
    const amount = paySar(c.amount, ar);
    const band = c.band === "unpaid"
      ? (ar ? "بلا أجر" : "unpaid")
      : c.band === "quarter"
        ? (ar ? "بثلاثة أرباع الأجر" : "at three-quarters")
        : (ar ? "بشرائحها" : "across the bands");
    return pack(c, {
      law: art(117, ar),
      employee: {
        right: ar
          ? `مرضك المثبت: ${dAr(full)} بأجر كامل، ثم ${mid} بثلاثة أرباعه، ثم ${unpaid} بلا أجر في السنة التي تبدأ بأول إجازة؛ هنا ${dAr(days)} ${band} (${amount}).`
          : `Proven sickness: ${full} days at full pay, then ${mid} at three-quarters, then ${unpaid} unpaid in the year from the first sick leave; here ${days} day(s) ${band} (${amount}).`,
        ...workerGrieve(c, ar ? "إن حُسبت أيام قبل استنفاد الشريحة السابقة: تظلّم كتابةً." : "If days were cut before the earlier band ran out: grieve in writing."),
      },
      manager: {
        right: ar
          ? `${dAr(days)} لـ${nameOf(c)} ${band} بعد استنفاد ${dAr(c.band === "unpaid" ? full + mid : full)} في سنته المرضية — ${amount} نقص بنص النظام لا حسماً.`
          : `${days} day(s) for ${nameOf(c)} ${band} after ${c.band === "unpaid" ? full + mid : full} days in the sick year — ${amount} set by law, not a deduction.`,
        ifNot: ar ? "إن سبق الشريحة صار حسماً بلا سند يُرد للعامل." : "Applied early, it becomes an undocumented deduction to refund.",
        action: ACT.run(ar),
      },
    });
  },

  /** Documented deductions and the half-wage cap (Arts 92/93). ctx: amount, total, cap, over. */
  deduction(c) {
    const { ar } = c;
    const total = paySar(c.total ?? c.amount, ar);
    const cap = num(c.cap) > 0 ? paySar(c.cap, ar) : "";
    const over = Boolean(c.over) || (num(c.cap) > 0 && num(c.total ?? c.amount) > num(c.cap));
    return pack(c, {
      law: art(over ? 93 : 92, ar),
      employee: {
        right: ar
          ? `لا يُحسم من أجرك إلا بسند مكتوب أو موافقتك الخطية، ومجموع الحسم ${total}${cap ? ` لا يتجاوز نصف أجرك (${cap})` : " لا يتجاوز نصف أجرك"}.`
          : `Nothing is deducted without a written instrument or your consent, and the total ${total}${cap ? ` may not pass half your wage (${cap})` : " may not pass half your wage"}.`,
        ...workerGrieve(c, ar
          ? (over ? "تجاوز النصف: تظلّم كتابةً، ولك أمر المحكمة العمالية برد ما زاد (المادة 94)." : "إن حُسم بلا سند: اعترض على البند، ولك أمر المحكمة برده (المادة 94).")
          : (over ? "Over half: grieve in writing; a labour-court order returns the excess (Art. 94)." : "If deducted without an instrument: object to the line; a court order returns it (Art. 94).")),
      },
      manager: {
        right: ar
          ? `خصم ${nameOf(c)} ${total}${cap ? ` من سقف ${cap} — نصف الأجر المستحق` : ""}؛ كل بند بسند مكتوب أو موافقة خطية.`
          : `${nameOf(c)}'s deductions ${total}${cap ? ` of a ${cap} cap — half the wage due` : ""}; every line on a written instrument or consent.`,
        ifNot: ar
          ? (over ? "الدفع موقوف حتى يُصحَّح، وما زاد يُرد بأمر المحكمة العمالية (المادة 94)." : "حسم بلا سند يُرد للعامل بأمر المحكمة العمالية (المادة 94).")
          : (over ? "Payment stays blocked until corrected; the excess is returned by court order (Art. 94)." : "An undocumented deduction is returned by court order (Art. 94)."),
        action: ACT.deduct(ar),
      },
    });
  },

  /** Employer loan / advance instalment — 10% of the wage (Art. 92/1). ctx: amount, wage. */
  loan(c) {
    const { ar, today } = c;
    const ratio = ruleValue("payroll.loan.capRatio", today);
    const cap = num(c.wage) > 0 ? paySar(num(c.wage) * ratio, ar) : "";
    const amount = paySar(c.amount, ar);
    const pct = Math.round(ratio * 100);
    return pack(c, {
      law: art(92, ar),
      employee: {
        right: ar
          ? `قسط السلفة ${amount} لا يتجاوز ${pct}٪ من أجرك${cap ? ` (${cap})` : ""} شهرياً.`
          : `The advance instalment ${amount} may not pass ${pct}% of your wage${cap ? ` (${cap})` : ""} a month.`,
        ...workerGrieve(c, ar ? "إن زاد القسط: تظلّم كتابةً لإعادته إلى الحد." : "If the instalment is higher: grieve to bring it back to the cap."),
      },
      manager: {
        right: ar
          ? `استرداد سلفة ${nameOf(c)} بقسط ${amount} لا يزيد على ${pct}٪ من أجره${cap ? ` (${cap})` : ""}.`
          : `Recover ${nameOf(c)}'s advance at ${amount}, no more than ${pct}% of the wage${cap ? ` (${cap})` : ""}.`,
        ifNot: ar ? "ما زاد على الحد يُرد للعامل بأمر المحكمة العمالية (المادة 94)." : "Any excess is returned by court order (Art. 94).",
        action: ACT.deduct(ar),
      },
    });
  },

  /** Damage deduction — 5 days' wage a month; objection within 15 working days (Art. 91). ctx: amount, wage, noticeOn, objectionLastDay. */
  damage(c) {
    const { ar, today } = c;
    const capDays = ruleValue("payroll.damage.capDays", today);
    const window = ruleValue("payroll.damage.objectionWorkingDays", today);
    const conv = ruleValue("payroll.month.conventionDays", today);
    const cap = num(c.wage) > 0 ? paySar((num(c.wage) / conv) * capDays, ar) : "";
    const amount = paySar(c.amount, ar);
    const last = dateOnly(c.objectionLastDay) || damageObjectionDeadline(c.noticeOn);
    const open = last && dateOnly(today) <= last;
    const when = payDate(last, today, ar);
    return pack(c, {
      law: art(91, ar),
      due: open ? last : "",
      employee: {
        right: ar
          ? `حسم التلف ${amount} لا يتجاوز أجر ${capDays} أيام في الشهر${cap ? ` (${cap})` : ""}، ولا يُحسم إن كان بخطأ غيرك أو قوة قاهرة.`
          : `The damage deduction ${amount} may not pass ${capDays} days' wage a month${cap ? ` (${cap})` : ""}, and none if caused by others or force majeure.`,
        ifNot: ar
          ? (when ? (open ? `اعترض على نسبته أو تقديره حتى ${when} (${window} يوم عمل من إبلاغك).` : `مضت مهلة الاعتراض (${when}) — يبقى لك التظلم أمام المحكمة العمالية.`) : `اعترض خلال ${window} يوم عمل من إبلاغك بالتقدير.`)
          : (when ? (open ? `Object to the fault or the valuation by ${when} (${window} working days from notice).` : `The objection window closed (${when}) — the labour court remains.`) : `Object within ${window} working days of the notice.`),
        // From a payroll line: «الجزاءات» opens the objection prefilled from that very line.
        action: open || !when
          ? { ...ACT.objection(ar), ...(c.lineId ? { to: `${rightsTo(DAMAGE_OBJECTION_TYPE)}&line=${encodeURIComponent(c.lineId)}` } : {}) }
          : ACT.court(ar),
      },
      manager: {
        right: ar
          ? `حسم تلف ${nameOf(c)} ${amount} بحد أجر ${capDays} أيام شهرياً${cap ? ` (${cap})` : ""}، بعد إبلاغه بالتقدير كتابةً${when ? `؛ مهلة اعتراضه حتى ${when}` : ""}.`
          : `Deduct ${nameOf(c)}'s damage ${amount} within ${capDays} days' wage a month${cap ? ` (${cap})` : ""}, after written notice${when ? `; objection open until ${when}` : ""}.`,
        ifNot: ar ? "إن قُبل الاعتراض أو حكمت المحكمة بعدم الأحقية يُرد المحسوم خلال 7 أيام." : "If the objection is upheld or the court rules against it, refund within 7 days.",
        action: ACT.deduct(ar),
      },
    });
  },

  /** Unreturned custody set off at exit — capped like Art. 91; the rest goes to court. ctx: debt, setOff, toCourt, wage. */
  custody(c) {
    const { ar, today } = c;
    const capDays = ruleValue("payroll.damage.capDays", today);
    const conv = ruleValue("payroll.month.conventionDays", today);
    const cap = num(c.wage) > 0 ? paySar((num(c.wage) / conv) * capDays, ar) : "";
    const setOff = paySar(c.setOff ?? c.debt, ar);
    const rest = num(c.toCourt);
    return pack(c, {
      law: art(91, ar),
      employee: {
        right: ar
          ? `لا يُحسم من تصفيتك عن عهدة لم تُسلَّم إلا ${setOff}${cap ? ` بحد أجر ${capDays} أيام (${cap})` : ""}، وما زاد لا يُؤخذ إلا بحكم.`
          : `Only ${setOff} is set off from your settlement for unreturned custody${cap ? `, capped at ${capDays} days' wage (${cap})` : ""}; anything more needs a ruling.`,
        ifNot: ar ? "إن أعدت العهدة أو اعترضت على تقديرها: اعترض على الخصم." : "If you returned it or contest its value: object to the deduction.",
        action: ACT.objection(ar),
      },
      manager: {
        right: ar
          ? `اقتطاع ${setOff} من تصفية ${nameOf(c)}${cap ? ` بحد أجر ${capDays} أيام (${cap})` : ""}${rest ? `؛ الباقي ${paySar(rest, ar)} يُطلب أمام المحكمة العمالية` : ""}.`
          : `Set off ${setOff} from ${nameOf(c)}'s settlement${cap ? ` within ${capDays} days' wage (${cap})` : ""}${rest ? `; the remaining ${paySar(rest, ar)} is claimed in court` : ""}.`,
        ifNot: ar ? "اقتطاع فوق الحد يُرد للعامل خلال 7 أيام من الحكم." : "A set-off beyond the cap is refunded within 7 days of a ruling.",
        action: ACT.file(ar, c.employeeId),
      },
    });
  },

  /** End-of-service award (Arts 84–87; 96 for average wages). ctx: eos (deriveEos result). */
  eos(c) {
    const { ar } = c;
    const e = c.eos || {};
    const years = r2(e.years);
    const amount = paySar(e.gratuity, ar);
    const wage = paySar(e.wage, ar);
    const basis = e.averageBasis ? (ar ? " (متوسط أجر السنة الأخيرة — المادة 96)" : " (last year's average — Art. 96)") : "";
    let law = art(84, ar);
    let rightAr = `نصف أجر شهر عن كل سنة من الخمس الأولى وأجر شهر عن كل سنة بعدها: ${years} سنة على أجر ${wage}${basis} = ${amount}.`;
    let rightEn = `Half a month per year for the first five, a full month thereafter: ${years} year(s) on ${wage}${basis} = ${amount}.`;
    if (e.art80) {
      law = art(80, ar);
      rightAr = "الفصل وفق المادة 80 بلا مكافأة — ولا يكون إلا بإحدى حالاتها بعد تحقيق مكتوب وإتاحة الدفاع.";
      rightEn = "Dismissal under Art. 80 carries no award — only in one of its cases, after a written investigation and a chance to answer.";
    } else if (e.art81) {
      law = art(81, ar);
      rightAr = `ترك العمل وفق المادة 81 يحفظ حقوقك كاملة: ${amount}.`;
      rightEn = `Leaving under Art. 81 keeps your full rights: ${amount}.`;
    } else if (e.art87) {
      law = art(87, ar);
      const mm = ruleValue("eos.art87.marriageMonths", c.today);
      const bm = ruleValue("eos.art87.birthMonths", c.today);
      rightAr = `المكافأة كاملة ${amount} — قوة قاهرة، أو إنهاء العاملة خلال ${mm} أشهر من الزواج أو ${bm} من الوضع.`;
      rightEn = `The full award ${amount} — force majeure, or a woman ending within ${mm} months of marriage or ${bm} of giving birth.`;
    } else if (num(e.fraction) < 1) {
      law = art(85, ar);
      const third = num(e.fraction) <= 0 ? (ar ? "لا مكافأة" : "no award") : num(e.fraction) < 0.5 ? (ar ? "ثلث المكافأة" : "a third") : (ar ? "ثلثا المكافأة" : "two-thirds");
      rightAr = `استقالة بعد ${years} سنة: ${third} — ${amount} (لا شيء قبل سنتين، الثلث حتى 5، الثلثان حتى 10، كاملة بعدها).`;
      rightEn = `Resigning after ${years} year(s): ${third} — ${amount} (none before 2, a third to 5, two-thirds to 10, full after).`;
    }
    return pack(c, {
      law,
      employee: { right: ar ? rightAr : rightEn, ...workerGrieve(c, ar ? "إن نقصت عند التصفية: تظلّم كتابةً، ثم المحكمة العمالية." : "If short at settlement: grieve in writing, then the labour court.") },
      manager: {
        right: ar ? `مكافأة ${nameOf(c)}: ${rightAr}` : `${nameOf(c)}'s award: ${rightEn}`,
        ifNot: ar ? "تُصرف ضمن التصفية خلال أسبوع إن أنهت المنشأة العلاقة، وأسبوعين إن أنهاها العامل (المادة 88)." : "Paid in the settlement within a week if the employer ended it, two if the worker did (Art. 88).",
        action: ACT.file(ar, c.employeeId),
      },
    });
  },

  /** Final settlement within 7 / 14 days (Art. 88). ctx: settlement (deriveSettlementDeadline), total. */
  settlement(c) {
    const { ar, today } = c;
    const s = c.settlement || {};
    const days = num(s.days) || 7;
    const span = ar ? (days === 14 ? "أسبوعين" : "أسبوع") : (days === 14 ? "two weeks" : "a week");
    const when = payDate(s.due, today, ar);
    const total = c.total != null ? paySar(c.total, ar) : "";
    const late = Boolean(s.late);
    return pack(c, {
      law: art(88, ar),
      due: s.closed ? "" : s.due,
      employee: {
        right: ar
          ? (s.closed ? `صُرفت تصفيتك${total ? ` ${total}` : ""} — أُغلقت المهلة.` : `تُصفّى حقوقك${total ? ` ${total}` : ""} كاملة خلال ${span} من انتهاء العلاقة${when ? ` — بحلول ${when}` : ""}.`)
          : (s.closed ? `Your settlement${total ? ` of ${total}` : ""} was paid — the window is closed.` : `Your entitlements${total ? ` (${total})` : ""} are settled within ${span} of the end${when ? ` — by ${when}` : ""}.`),
        ifNot: ar ? (late ? "مضت المهلة: طالب بها أمام المحكمة العمالية." : "إن تأخرت: لك المطالبة أمام المحكمة العمالية.") : (late ? "The window passed: claim it in the labour court." : "If late: claim it in the labour court."),
        action: ACT.court(ar),
      },
      manager: {
        right: ar
          ? (s.closed ? `صُرفت تصفية ${nameOf(c)}${total ? ` ${total}` : ""}.` : `صرف تصفية ${nameOf(c)}${total ? ` ${total}` : ""} خلال ${span}${when ? ` — بحلول ${when}` : ""}؛ ولك حسم دين العمل منها.`)
          : (s.closed ? `${nameOf(c)}'s settlement${total ? ` of ${total}` : ""} is paid.` : `Pay ${nameOf(c)}'s settlement${total ? ` of ${total}` : ""} within ${span}${when ? ` — by ${when}` : ""}; work debts may be set off.`),
        ifNot: ar ? `${late ? "مضت المهلة: " : ""}وإلا طالب العامل بها أمام المحكمة العمالية.` : `${late ? "The window passed: " : ""}otherwise the worker claims it in the labour court.`,
        action: ACT.file(ar, c.employeeId),
      },
    });
  },

  /** Leave cash at exit (Art. 111). ctx: days, amount. */
  leaveCash(c) {
    const { ar } = c;
    const days = r2(c.days);
    const amount = paySar(c.amount, ar);
    return pack(c, {
      law: art(111, ar),
      employee: {
        right: ar
          ? `أجر ${dAr(days)} إجازة لم تتمتع بها = ${amount}، ويُحسب كسر السنة بنسبة ما عملته منها.`
          : `Pay for ${days} untaken leave day(s) = ${amount}, with the part year counted pro rata.`,
        ...workerGrieve(c, ar ? "إن نقص الرصيد عن سجل إجازاتك: تظلّم كتابةً." : "If the balance is below your leave record: grieve in writing."),
      },
      manager: {
        right: ar ? `صرف أجر ${dAr(days)} إجازة غير مستمتع بها لـ${nameOf(c)} = ${amount} ضمن التصفية.` : `Pay ${nameOf(c)} for ${days} untaken leave day(s) = ${amount} in the settlement.`,
        ifNot: ar ? "وإلا بقي ديناً في التصفية يُطالب به أمام المحكمة العمالية." : "Otherwise it stays owed and may be claimed in court.",
        action: ACT.file(ar, c.employeeId),
      },
    });
  },

  /** Unlawful-termination compensation (Art. 77). ctx: amount. */
  unlawful(c) {
    const { ar, today } = c;
    const per = ruleValue("eos.unlawful.perYearDays", today);
    const min = ruleValue("eos.unlawful.minMonths", today);
    const amount = paySar(c.amount, ar);
    const months = min === 2 ? "شهرين" : `${min} أشهر`;
    return pack(c, {
      law: art(77, ar),
      employee: {
        right: ar ? `إن ثبت الإنهاء غير المشروع: ${dAr(per)} عن كل سنة أو باقي العقد المحدد، بحد أدنى أجر ${months} — تقديره ${amount}.` : `If termination is unlawful: ${per} days a year or the fixed term's rest, at least ${min} months' wage — about ${amount}.`,
        ifNot: ar ? "تطالب به أمام المحكمة العمالية — لا يُضاف إلى التصفية تلقائياً." : "Claimed in the labour court — not added to the settlement automatically.",
        action: ACT.court(ar),
      },
      manager: {
        right: ar ? `إنهاء بلا سبب مشروع يُلزم بتعويض ${dAr(per)} عن كل سنة بحد أدنى أجر ${months} — تقديره ${amount}.` : `An unlawful termination owes ${per} days a year, at least ${min} months — about ${amount}.`,
        ifNot: ar ? "تحكم به المحكمة العمالية إن طالب العامل." : "The labour court awards it if the worker claims.",
        action: ACT.file(ar, c.employeeId),
      },
    });
  },
};

/** Annual leave pay in advance (Art. 109). ctx: days, startDate. */
B.annualAdvance = function annualAdvance(c) {
  const { ar, today } = c;
  const days = num(c.days);
  const when = payDate(c.startDate, today, ar);
  return pack(c, {
    law: art(109, ar),
    due: c.startDate,
    employee: {
      right: ar ? `أجر إجازتك السنوية (${dAr(days)}) يُدفع مقدّماً قبل بدئها${when ? ` — قبل ${when}` : ""}.` : `Your annual-leave pay (${days} days) is paid in advance${when ? ` — before ${when}` : ""}.`,
      ...workerGrieve(c),
    },
    manager: {
      right: ar ? `صرف أجر إجازة ${nameOf(c)} السنوية (${dAr(days)}) مقدّماً قبل بدئها${when ? ` — قبل ${when}` : ""}.` : `Pay ${nameOf(c)}'s annual-leave wage (${days} days) in advance${when ? ` — before ${when}` : ""}.`,
      ifNot: ar ? "وإلا صار الأجر متأخراً وللعامل التظلم ثم المحكمة العمالية." : "Otherwise the wage is late; the worker may grieve, then go to court.",
      action: ACT.run(ar),
    },
  });
};

/** One GOSI follow-up task (register / exclude / injury / wage change / monthly payment). ctx: task, what (its detail line). */
B.gosiTask = function gosiTask(c) {
  const { ar, today } = c;
  const t = c.task || {};
  const when = payDate(t.due, today, ar);
  const office = t.kind === "injury_office";
  const what = c.what || "";
  return pack(c, {
    law: office ? { regs: "28", label: ar ? "اللائحة م28" : "Regs Art. 28" } : gosiLaw(ar),
    due: t.done ? "" : t.due,
    employee: {
      right: ar ? `${what}${when ? ` — بحلول ${when}` : ""}؛ وهو على صاحب العمل لا عليك.` : `${what}${when ? ` — by ${when}` : ""}; it is the employer's duty, not yours.`,
      ...workerGrieve(c, ar ? "إن لم يُنفَّذ: تظلّم كتابةً واطلب التسجيل أو الإبلاغ." : "If not done: grieve in writing for the registration or report."),
    },
    manager: {
      right: ar
        ? `${what}${when ? ` — بحلول ${when}` : ""}${t.done ? "؛ نُفّذ وحُفظ مرجعه." : "، ثم سجّل تاريخ التنفيذ ورقمه هنا إثباتاً."}`
        : `${what}${when ? ` — by ${when}` : ""}${t.done ? "; done, reference kept." : ", then record the date and reference here as proof."}`,
      ifNot: ar
        ? (office ? "تأخر الإبلاغ يحرم العامل حقه في تقدير الإصابة ويحمّل المنشأة التعويض." : "وإلا تُحتسب غرامة التأخير في التأمينات، وتتحمل المنشأة ما يفوت العامل من تغطية.")
        : (office ? "A late report costs the worker the injury assessment and leaves the establishment liable." : "Otherwise GOSI's late fine applies and the establishment bears any lost cover."),
      action: ACT.gosi(ar),
    },
  });
};

/** Court-ordered debt — a quarter of the wage a month unless the ruling says otherwise (Art. 92/6). ctx: amount, wage. */
B.courtDebt = function courtDebt(c) {
  const { ar, today } = c;
  const ratio = ruleValue("payroll.courtDebt.capRatio", today);
  const cap = num(c.wage) > 0 ? paySar(num(c.wage) * ratio, ar) : "";
  const amount = paySar(c.amount, ar);
  return pack(c, {
    law: art(92, ar),
    employee: {
      right: ar ? `قسط دين الحكم ${amount} لا يتجاوز ربع أجرك${cap ? ` (${cap})` : ""} شهرياً ما لم ينص الحكم على غيره، والنفقة تُقدَّم أولاً.` : `The court-debt instalment ${amount} may not pass a quarter of your wage${cap ? ` (${cap})` : ""} unless the ruling says so; maintenance comes first.`,
      ...workerGrieve(c, ar ? "إن زاد على الربع دون نص في الحكم: تظلّم كتابةً." : "If above a quarter without the ruling saying so: grieve in writing."),
    },
    manager: {
      right: ar ? `حسم ${amount} من أجر ${nameOf(c)} إنفاذاً للحكم بحد ربع الأجر${cap ? ` (${cap})` : ""} ما لم ينص الحكم على غيره.` : `Deduct ${amount} from ${nameOf(c)} under the ruling within a quarter of the wage${cap ? ` (${cap})` : ""} unless it says otherwise.`,
      ifNot: ar ? "ما زاد على الحد يُرد للعامل بأمر المحكمة العمالية (المادة 94)." : "Any excess is returned by court order (Art. 94).",
      action: ACT.deduct(ar),
    },
  });
};

/** A work-site duty (Arts 144–148, decision 18632). ctx: duty { cite, ar, en, met, howAr, howEn }. */
B.siteDuty = function siteDuty(c) {
  const { ar } = c;
  const d = c.duty || {};
  const law = d.cite === "18632"
    ? { decisionId: "18632", label: ar ? "القرار 18632" : "Decision 18632" }
    : art(d.cite || "146", ar);
  const what = ar ? (d.ar || "") : (d.en || "");
  const how = ar ? d.howAr : d.howEn;
  return pack(c, {
    law,
    employee: {
      right: ar ? `${what}${d.met ? ` — مغطّى: ${how || "بخدمة أو بدل"}.` : " — خدمة في الموقع أو بدل نقدي بالعقد."}` : `${what}${d.met ? ` — covered: ${how || "a service or allowance"}.` : " — a service on site or a cash allowance by contract."}`,
      ...workerGrieve(c, ar ? "إن لم يُغطَّ: تظلّم كتابةً واطلب الخدمة أو بدلها." : "If not covered: grieve in writing for the service or its allowance."),
    },
    manager: {
      right: ar ? `${what} — ${d.met ? `مغطّى: ${how || "بخدمة أو بدل"}` : "يحتاج تغطية بخدمة أو بدل في العقد"}.` : `${what} — ${d.met ? `covered: ${how || "service or allowance"}` : "needs a service or a contract allowance"}.`,
      ifNot: ar ? "وإلا عُدّ إخلالاً بالتزام نظامي يُرصد في تفتيش الوزارة ويتظلم منه العامل." : "Otherwise it is a breach the ministry inspection records and the worker may grieve.",
      action: ACT.file(ar, c.employeeId),
    },
  });
};

/** Payslip row id → builder kind (slipRows ids from PayrollSlipBoard / PayslipLedger). */
const ROW_KIND = {
  base: "wage", housing: "wage", transport: "wage", other: "wage", allowances: "wage", hazard: "wage",
  living: "wage", remote: "wage", medical: "wage", meals: "wage", commission: "wage", night: "wage", bonus: "wage",
  gosi: "gosi",
  unpaidLeave: "unpaidLeave",
  detention: "detention",
  refunds: "refund",
  injury137: "injury", injury139: "injury", injuryFull: "injury", injuryGosi: "injury", injuryGosiStop: "injury",
  sick117q: "sick", sick117u: "sick",
  deduct: "deduction",
};
const INJURY_MODE = { injury137: "reduced", injury139: "excluded", injuryFull: "full", injuryGosi: "gosi", injuryGosiStop: "gosi" };

export const PAY_HINT_BUILDERS = B;

/**
 * The hint for one payroll thing. kind: a builder name above, or a payslip row id (`base`, `gosi`,
 * `sick117q`, `ot-…`). ctx: { view: "employee"|"manager", lang|ar, today, name, employeeId, …figures }.
 */
export function payHintFor(kind, ctx = {}) {
  const ar = ctx.ar ?? (ctx.lang ? ctx.lang === "ar" : true);
  const today = dateOnly(ctx.today) || new Date().toISOString().slice(0, 10);
  const c = { ...ctx, ar, today, view: ctx.view === "manager" ? "manager" : "employee" };
  const key = String(kind || "");
  if (B[key]) return B[key](c);
  if (/^ot/i.test(key) || key === "overtime") return B.overtime(c);
  const mapped = ROW_KIND[key];
  if (!mapped) return null;
  if (mapped === "injury") return B.injury({ ...c, mode: c.mode || INJURY_MODE[key] });
  if (mapped === "sick") return B.sick({ ...c, band: c.band || (key === "sick117u" ? "unpaid" : "quarter") });
  return B[mapped](c);
}

/** The hint for one deduction line (DeductionLinesDialog / PayrollMineDeductions). line: { kind|source, amount, damageNoticeOn, objectionLastDay }. */
export function deductionLineHint(line = {}, ctx = {}) {
  const k = String(line.kind || line.source || line.type || "").toLowerCase();
  const base = { ...ctx, amount: line.amount };
  if (k.includes("damage") || line.damageNoticeOn) {
    return payHintFor("damage", { ...base, noticeOn: line.damageNoticeOn, objectionLastDay: line.objectionLastDay, lineId: line.id });
  }
  if (k.includes("advance") || k.includes("loan")) return payHintFor("loan", base);
  if (k.includes("custody")) return payHintFor("custody", { ...base, debt: line.amount });
  if (k.includes("court")) return payHintFor("courtDebt", base);
  return payHintFor("deduction", { ...base, total: ctx.total ?? line.amount });
}

/**
 * The hint for one payslip row (slipRows / PayslipLedger rows). Allowance rows carry none — the wage
 * hint sits once on the base row. ctx: { view, ar, today, name, employeeId, item, net, payday, base,
 * allowances, cap }.
 */
export function slipRowHint(row, ctx = {}) {
  if (!row) return null;
  const id = String(row.id || "");
  const item = ctx.item || {};
  const c = { ...ctx, amount: row.amount };
  if (id === "base") return payHintFor("wage", { ...c, amount: ctx.net ?? row.amount, paid: Boolean(item.paid), paidAt: item.paidAt });
  if (id === "ot-comp") return payHintFor("overtime", { ...c, hours: 0, compHours: row.hours, amount: 0 });
  if (/^ot/.test(id)) return payHintFor("overtime", { ...c, hours: row.hours });
  const days = {
    unpaidLeave: item.unpaidLeaveDays,
    detention: item.detentionDays,
    injury137: item.injuryReducedDays,
    injury139: item.injuryExcludedDays,
    injuryFull: item.injuryDays,
    injuryGosi: item.injuryDays,
    injuryGosiStop: item.injuryDays,
    sick117q: item.sickQuarterDays,
    sick117u: item.sickUnpaidDays,
  };
  if (id === "deduct") return payHintFor("deduction", { ...c, total: row.amount });
  if (id in days) return payHintFor(id, { ...c, days: days[id] });
  if (id === "gosi" || id === "refunds") return payHintFor(id, c);
  return null;
}

export const PAY_HINT_KINDS = Object.keys(B);
export const PAY_ROW_KINDS = Object.keys(ROW_KIND);
export { addDays as payAddDays };
