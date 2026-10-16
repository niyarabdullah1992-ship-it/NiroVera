/**
 * «⚖ حقك» / «⚖ التزامك» — one plain hint per request card, built from the record itself.
 *
 * Each builder answers three lines for THIS item:
 *   right  — «حقك:» (employee) or «التزامك:» (manager) — one sentence with the record's dates/amounts.
 *   ifNot  — «إن لم يُطبَّق:» — the worker's next remedy, or, for the manager, the consequence of delay.
 *   action — the ready flow that remedy opens (a rights request with its kind preselected, the decision,
 *            or the labour court portal).
 *   law    — the article (or decision / regulation article) whose official text the hint opens.
 *   due    — the legal date the manager must act by, when the law sets one (feeds companyObligations).
 *
 * Pure: no store, no React; every figure comes from existing derivations (laborRules, leaveTypes,
 * rightsRequests, exitRequests, compLeave, otOffer…). Safe in node tests.
 */
import { ruleValue } from "./laborRules.js";
import { regulationDate } from "./workRegulation.js";
import { remainingLeaveDays, statutoryLeaveFloor, usedLeaveDays } from "./leaveTypes.js";
import {
  ART81_EXIT_TYPE,
  DAMAGE_OBJECTION_TYPE,
  DOCUMENTS_RETURN_TYPE,
  GRIEVANCE_TYPE,
  LEAVE_CARRY_TYPE,
  NIGHT_AVOID_TYPE,
  daysAfterExcludingHolidays,
  damageObjectionDeadline,
  employerNoticeOf,
  grievanceState, GRIEVANCE_ROUTE, DAMAGE_OBJECTION_ROUTE,
} from "./rightsRequests.js";
import { EXIT_ROUTE_NOTICE75, RESIGNATION_TYPE, resignationState } from "./exitRequests.js";
import { compBalance } from "./compLeave.js";
import { hoursAr, otOffer, sar } from "./otOffer.js";
import { isArticle106Assignment, isOvertimeAssignment, otCompensationOf } from "./overtimeAssignment.js";
import { nursingRightUntil } from "./dutyRequests.js";
import { heatBanWindow } from "./contractLawDerivations.js";
import { PAY_HINT_BUILDERS } from "./rightHints.pay.js";
import { DISC_HINT_BUILDERS } from "./rightHints.disc.js";
import { ATT_HINT_BUILDERS } from "./rightHints.att.js";

export const LABOUR_COURT_URL = "https://najiz.sa";

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

function addDays(iso, n) {
  const d = dateOnly(iso);
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + Number(n));
  return dt.toISOString().slice(0, 10);
}

/** «30 أكتوبر» — the year only when it differs from today's. */
export function hintDate(iso, today, ar = true) {
  const d = dateOnly(iso);
  if (!d) return "";
  const full = regulationDate(d, ar);
  return dateOnly(today).slice(0, 4) === d.slice(0, 4) ? full.replace(/\s\d{4}$/, "") : full;
}

const PENDING = new Set(["pending", "pending_manager", "pending_hr", "under_review", "revise", "postponed"]);
export const isPendingHintStatus = (status) => PENDING.has(String(status || "pending"));

/* ── law references ─────────────────────────────────────────────────────── */
const art = (article, ar) => ({ article: String(article), label: ar ? `المادة ${article}` : `Art. ${article}` });
const dec = (id, ar) => ({ decisionId: String(id), label: ar ? `القرار ${id}` : `Decision ${id}` });
const regs = (n, ar) => ({ regs: String(n), label: ar ? `اللائحة م${n}` : `Regs Art. ${n}` });
const product = (ar) => ({ product: true, label: ar ? "قرار تشغيلي" : "Operational" });

/* ── ready flows ────────────────────────────────────────────────────────── */
const ACT = {
  grievance: (ar) => ({ kind: "rights", rightsKind: GRIEVANCE_TYPE, to: GRIEVANCE_ROUTE, label: ar ? "قدّم تظلماً" : "File a grievance" }),
  objection: (ar) => ({ kind: "rights", rightsKind: DAMAGE_OBJECTION_TYPE, to: DAMAGE_OBJECTION_ROUTE, label: ar ? "اعترض على الخصم" : "Object to the deduction" }),
  documents: (ar) => ({ kind: "rights", rightsKind: DOCUMENTS_RETURN_TYPE, label: ar ? "اطلب وثائقك" : "Ask for your documents" }),
  court: (ar) => ({ kind: "href", href: LABOUR_COURT_URL, external: true, label: ar ? "المحكمة العمالية (ناجز)" : "Labour court (Najiz)" }),
  decide: (ar) => ({ kind: "decide", label: ar ? "افتح القرار" : "Open the decision" }),
};

/** The grievance window a refusal opens (Model regulation Art. 71: 30 days, holidays not counted). */
function grievanceBy(row, c) {
  const told = dateOnly(row?.reviewedAt) || dateOnly(row?.decidedAt);
  return told ? daysAfterExcludingHolidays(told, 30, c.isHoliday) : "";
}

/** Default «إن لم يُطبَّق» for the worker: a refusal without ground → grievance within 30 days. */
function workerRemedy(row, c) {
  const { ar } = c;
  const by = String(row?.status) === "rejected" ? grievanceBy(row, c) : "";
  return {
    ifNot: ar
      ? (by ? `إن رُفض دون سند: تظلّم كتابةً حتى ${hintDate(by, c.today, ar)} (النموذج الموحد م71).` : "إن رُفض دون سند: لك التظلم كتابةً خلال 30 يوماً من إبلاغك (النموذج الموحد م71).")
      : (by ? `If refused without ground: grieve in writing by ${hintDate(by, c.today, ar)} (Model regulation Art. 71).` : "If refused without ground: grieve in writing within 30 days (Model regulation Art. 71)."),
    action: ACT.grievance(ar),
  };
}

/** Default consequence for the manager. */
function managerRemedy(c, text) {
  const { ar } = c;
  return {
    ifNot: text || (ar ? "وإلا صار للموظف حق التظلم خلال 30 يوماً ثم اللجوء للمحكمة العمالية." : "Otherwise the worker may grieve within 30 days, then go to the labour court."),
    action: ACT.decide(ar),
  };
}

const nameOf = (c) => c.emp?.name || (c.ar ? "الموظف" : "the worker");
const daysOf = (row) => Math.max(0, Number(row?.days) || 0);

function pack(row, c, { right, rightManager, law, worker, manager, due }) {
  const isManager = c.view === "manager";
  const tail = isManager ? managerRemedy(c, manager) : (worker || workerRemedy(row, c));
  return {
    view: isManager ? "manager" : "employee",
    word: c.ar ? (isManager ? "التزامك" : "حقك") : (isManager ? "Your duty" : "Your right"),
    right: isManager ? (rightManager || right) : right,
    ifNot: tail.ifNot,
    action: tail.action,
    law,
    due: isManager && due && isPendingHintStatus(row?.status) ? dateOnly(due) : "",
  };
}

/* ── leave builders ─────────────────────────────────────────────────────── */
const LEAVE = {
  annual(row, c) {
    const { ar, today, emp } = c;
    const floor = statutoryLeaveFloor("annual", emp?.profile, today) || ruleValue("leave.annual.days", today);
    const left = remainingLeaveDays(emp?.profile, emp?.leaveRequests, "annual", today, c.data, emp);
    const notice = ruleValue("leave.annual.noticeDays", today) || 30;
    const start = hintDate(row.startDate, today, ar);
    return pack(row, c, {
      law: art("109", ar),
      right: ar
        ? `إجازتك السنوية ${floor} يوماً بأجر كامل يُدفع مقدّماً قبل ${start || "بدئها"}؛ المتبقي لك ${left} يوماً.`
        : `Annual leave is ${floor} days on full pay, paid in advance before ${start || "it starts"}; ${left} days left.`,
      rightManager: ar
        ? `أجر إجازة ${nameOf(c)} (${daysOf(row)} أيام) يُدفع مقدّماً قبل ${start || "بدئها"}، وإن حددت الشركة موعدها فبإشعار ${notice} يوماً.`
        : `${nameOf(c)}'s leave pay (${daysOf(row)} days) is due in advance before ${start || "it starts"}; a company-set date needs ${notice} days' notice.`,
      due: row.startDate,
    });
  },
  sick(row, c) {
    const { ar, today, emp } = c;
    const full = Number(ruleValue("leave.sick.fullPayDays", today)) || 0;
    const part = Number(ruleValue("leave.sick.halfPayDays", today)) || 0;
    const none = Number(ruleValue("leave.sick.unpaidDays", today)) || 0;
    const used = usedLeaveDays(emp?.leaveRequests, "sick", today, emp?.profile?.hireDate);
    const fullLeft = Math.max(0, full - used);
    const band = used < full ? (ar ? "بأجر كامل" : "full pay") : used < full + part ? (ar ? "بثلاثة أرباع الأجر" : "three-quarters pay") : (ar ? "بلا أجر" : "unpaid");
    return pack(row, c, {
      law: art("117", ar),
      right: ar
        ? `أول ${full} يوماً من مرضك في السنة بأجر كامل، ثم ${part} بثلاثة أرباعه، ثم ${none} بلا أجر؛ بقي لك بأجر كامل ${fullLeft} يوماً.`
        : `The first ${full} sick days a year are full pay, then ${part} at three-quarters, then ${none} unpaid; ${fullLeft} full-pay days left.`,
      rightManager: ar
        ? `إجازة ${nameOf(c)} المرضية بتقرير معتمد لا تُرفض، وتُحتسب ${band} (استخدم ${used} يوماً هذه السنة).`
        : `${nameOf(c)}'s certified sick leave is not refused; it counts at ${band} (${used} days used this year).`,
      due: row.startDate,
    });
  },
  exam(row, c) {
    const { ar, today } = c;
    const n = ruleValue("leave.exam.noticeDays", today) || 15;
    const by = addDays(row.startDate, -n);
    return pack(row, c, {
      law: art("115", ar),
      right: ar
        ? `بأجر إن وافقت الشركة على دراستك وكانت السنة غير معادة؛ يُقدَّم قبل ${n} يوماً من الامتحان${by ? `، أي حتى ${hintDate(by, today, ar)}` : ""}.`
        : `Paid when the company approved your study and the year is not repeated; file ${n} days ahead${by ? `, by ${hintDate(by, today, ar)}` : ""}.`,
      rightManager: ar
        ? `إجازة امتحان ${nameOf(c)} بأجر إن سبقت موافقتك على الدراسة والسنة غير معادة؛ قرّر قبل ${hintDate(row.startDate, today, ar) || "الامتحان"}.`
        : `${nameOf(c)}'s exam leave is paid when study was approved and the year is not repeated; decide before ${hintDate(row.startDate, today, ar) || "the exam"}.`,
      due: row.startDate,
    });
  },
  occasion(row, c) {
    const { ar, today } = c;
    const type = String(row.type || "").toLowerCase();
    const days = ruleValue(`leave.${type}.days`, today) || daysOf(row);
    const window = type === "paternity" ? ruleValue("leave.paternity.windowDays", today) : 0;
    return pack(row, c, {
      law: art("113", ar),
      right: ar
        ? `${days} أيام بأجر كامل من تاريخ الواقعة${window ? `، تُؤخذ خلال ${window} أيام من الولادة` : ""} — لا تُخصم من رصيدك السنوي.`
        : `${days} days on full pay from the event${window ? `, taken within ${window} days of the birth` : ""} — not from your annual balance.`,
      rightManager: ar
        ? `${days} أيام بأجر كامل لـ${nameOf(c)} من تاريخ الواقعة — حق لا يُخصم من السنوية.`
        : `${days} paid days for ${nameOf(c)} from the event — not from annual leave.`,
      due: row.startDate,
    });
  },
  maternity(row, c) {
    const { ar, today } = c;
    const type = String(row.type || "").toLowerCase();
    const total = type === "maternity" ? ruleValue("leave.maternity.days", row.startDate || today) : ruleValue(`leave.${type}.days`, today);
    const mandatory = Math.round((Number(ruleValue("leave.maternity.mandatoryPostDays", today)) || 42) / 7);
    const line = type === "maternity_extend"
      ? (ar ? `تمديد شهر دون أجر بعد إجازة الوضع، ولا يجوز فصلك أو إنذارك أثناءه (المادة 155).` : "A one-month unpaid extension after maternity leave; no dismissal meanwhile (Art. 155).")
      : type === "maternity_companion"
        ? (ar ? `شهر بأجر كامل بعد إجازة الوضع لمرافقة مولود مريض أو ذي إعاقة.` : "A paid month after maternity leave to accompany a sick or disabled newborn.")
        : (ar ? `${total} يوماً بأجر كامل؛ الأسابيع ${mandatory === 6 ? "الستة" : mandatory} بعد الوضع وجوبية، ولا يجوز فصلك أو إنذارك أثناءها (المادة 155).` : `${total} days on full pay; the ${mandatory} weeks after birth are mandatory, and no dismissal meanwhile (Art. 155).`);
    return pack(row, c, {
      law: art("151", ar),
      right: line,
      rightManager: ar ? `إجازة ${nameOf(c)}: ${line}` : `${nameOf(c)}: ${line}`,
      manager: ar ? "وإلا عُدّ الفصل أو الإنذار أثناءها باطلاً، وللعاملة التظلم ثم المحكمة العمالية." : "Otherwise a dismissal or warning meanwhile is void; she may grieve, then go to court.",
      due: row.startDate,
    });
  },
  iddah(row, c) {
    const { ar, today } = c;
    const m = ruleValue("leave.iddah.days", today);
    const o = ruleValue("leave.iddah.nonMuslimDays", today);
    return pack(row, c, {
      law: art("160", ar),
      right: ar ? `عدّة بأجر كامل من تاريخ الوفاة: ${m} يوماً للمسلمة و${o} يوماً لغيرها.` : `Iddah on full pay from the death: ${m} days for a Muslim, ${o} otherwise.`,
      due: row.startDate,
    });
  },
  hajj(row, c) {
    const { ar, today } = c;
    const lo = ruleValue("leave.hajj.days", today);
    const hi = ruleValue("leave.hajj.maxDays", today);
    const yrs = ruleValue("leave.hajj.minServiceYears", today);
    return pack(row, c, {
      law: art("114", ar),
      right: ar ? `${lo}–${hi} يوماً بأجر كامل شاملة عيد الأضحى، مرة واحدة في الخدمة بعد ${yrs === 2 ? "سنتين متصلتين" : `${yrs} سنوات`}.` : `${lo}–${hi} paid days including Eid al-Adha, once in service after ${yrs} continuous years.`,
      due: row.startDate,
    });
  },
  eid(row, c) {
    const { ar } = c;
    return pack(row, c, { law: art("112", ar), right: ar ? "أيام الأعياد والمناسبات الوطنية بأجر كامل، وإن عملت فيها فهي ساعات إضافية (المادة 107)." : "Eids and national days are paid; work on them counts as overtime (Art. 107)." });
  },
  unpaid(row, c) {
    const { ar, today } = c;
    const n = ruleValue("leave.unpaid.suspendAfterDays", today) || 20;
    return pack(row, c, {
      law: art("116", ar),
      right: ar ? `إجازة بلا أجر باتفاق الطرفين؛ ما زاد منها على ${n} يوماً يوقف العقد إلا إن اتُّفق على خلافه.` : `Unpaid leave by agreement; beyond ${n} days it suspends the contract unless agreed otherwise.`,
      due: row.startDate,
    });
  },
  job_search(row, c) {
    const { ar, today, emp } = c;
    const notice = employerNoticeOf(emp, today);
    return pack(row, c, {
      law: art("78", ar),
      right: ar
        ? `يوم كامل في الأسبوع بأجره للبحث عن عمل${notice ? ` حتى نهاية مهلة الإشعار ${hintDate(notice.until, today, ar)}` : " خلال مهلة إشعار الشركة"} — تختاره أنت بإشعار قبل يوم، دون موافقة.`
        : `One paid day a week to look for work${notice ? ` until the notice ends ${hintDate(notice.until, today, ar)}` : " during the company's notice"} — you pick it with a day's notice; no approval.`,
      manager: ar ? "لا يُرفض ولا يُحسم أجره؛ وإلا صار للموظف حق التظلم ثم المحكمة العمالية." : "It is neither refused nor docked; otherwise the worker may grieve, then go to court.",
      due: row.startDate,
    });
  },
  comp(row, c) {
    const { ar, today, emp } = c;
    const bal = compBalance(emp, today);
    return pack(row, c, {
      law: art("107", ar),
      right: ar
        ? `إجازتك التعويضية رصيد مستقل (${hoursAr(bal.left)})${bal.nextTakeBy ? ` تتمتع به حتى ${hintDate(bal.nextTakeBy, today, ar)}` : ""}، ولا يسقط؛ وإن تركت العمل قبلها تُصرف أجرتها.`
        : `Comp leave is its own balance (${bal.left} h)${bal.nextTakeBy ? `, take it by ${hintDate(bal.nextTakeBy, today, ar)}` : ""}; it does not lapse and is paid out if you leave.`,
      due: row.startDate,
    });
  },
  work_injury(row, c) {
    const { ar } = c;
    return pack(row, c, {
      law: art("137", ar),
      right: ar ? "علاجك على الشركة أو التأمينات، وأجرك أو بدله مكفول حتى الشفاء، ولا تُخصم أيامها من أي رصيد." : "Treatment is on the company or GOSI, pay or allowance runs until recovery, and no balance is charged.",
      due: row.startDate,
    });
  },
  dialysis(row, c) {
    const { ar } = c;
    return pack(row, c, { law: regs("42", ar), right: ar ? "أيام الغسيل الكلوي بتقرير طبي حق لك وفق النموذج الموحد م42 — لا تُخصم من رصيدك السنوي." : "Dialysis days on a medical report are yours under Model regulation Art. 42 — not from annual leave.", due: row.startDate });
  },
  therapy(row, c) {
    const { ar } = c;
    return pack(row, c, { law: product(ar), right: ar ? "جلسات العلاج تيسيرٌ لذوي الإعاقة وفق ملحق اللائحة — بتقرير طبي." : "Therapy sessions are a disability accommodation under the regulation's annex — with a report.", due: row.startDate });
  },
  discretionary(row, c) {
    const { ar } = c;
    return pack(row, c, { law: product(ar), right: ar ? "أيام تقديرية تمنحها الشركة فوق المستحق النظامي — ليست مادة في النظام." : "Discretionary days above the statutory floor — not a Labour Law article.", due: row.startDate });
  },
};

const LEAVE_ALIAS = {
  marriage: "occasion", bereavement: "occasion", bereavement_sibling: "occasion", paternity: "occasion",
  maternity: "maternity", maternity_extend: "maternity", maternity_companion: "maternity",
  emergency: "discretionary", grant: "discretionary",
};

/* ── other-request / rights / duty builders ─────────────────────────────── */
const OTHER = {
  [GRIEVANCE_TYPE](row, c) {
    const { ar, today } = c;
    const gs = grievanceState(row, today, c.isHoliday) || {};
    const reply = hintDate(gs.replyBy, today, ar);
    const court = hintDate(gs.courtBy, today, ar);
    return pack(row, c, {
      law: regs("71", ar),
      right: ar
        ? (gs.stage === "accepted" ? "قُبل تظلمك — يُلغى ما تظلمت منه ويُحفظ القرار في ملفك." : `الشركة ترد عليك كتابةً خلال 15 يوماً${reply ? `، أي حتى ${reply}` : ""}، ولا يُضار المتظلم.`)
        : (gs.stage === "accepted" ? "Your grievance was accepted." : `The company answers in writing within 15 days${reply ? `, by ${reply}` : ""}; you are not harmed for grieving.`),
      rightManager: ar ? `بُتّ في تظلم ${nameOf(c)} كتابةً خلال 15 يوماً${reply ? `، حتى ${reply}` : ""}.` : `Decide ${nameOf(c)}'s grievance in writing within 15 days${reply ? `, by ${reply}` : ""}.`,
      worker: {
        ifNot: ar ? `إن لم يُرد أو رُفض: لك المحكمة العمالية خلال 30 يوماً${court ? ` — حتى ${court}` : ""}.` : `If unanswered or refused: the labour court within 30 days${court ? ` — by ${court}` : ""}.`,
        action: ACT.court(ar),
      },
      manager: ar ? "وإلا صار للموظف حق اللجوء للمحكمة العمالية." : "Otherwise the worker may go to the labour court.",
      due: gs.replyBy,
    });
  },
  [DAMAGE_OBJECTION_TYPE](row, c) {
    const { ar, today } = c;
    const last = damageObjectionDeadline(row.notifiedOn || row.date);
    const cap = ruleValue("payroll.damage.capDays", today) || 5;
    return pack(row, c, {
      law: art("91", ar),
      right: ar ? `قبول اعتراضك يرد المبلغ، ولا يُحسم للتلف أكثر من أجر ${cap} أيام في الشهر.` : `If accepted the amount is refunded; a damage deduction never exceeds ${cap} days' pay a month.`,
      rightManager: ar ? `قبول اعتراض ${nameOf(c)} يرد المبلغ؛ وحسم التلف لا يزيد على أجر ${cap} أيام في الشهر.` : `Accepting ${nameOf(c)}'s objection refunds it; damage deductions cap at ${cap} days' pay a month.`,
      worker: {
        ifNot: ar ? `إن رُفض: لك المحكمة العمالية خلال 15 يوم عمل من إبلاغك${last ? ` — حتى ${hintDate(last, today, ar)}` : ""}، وإلا سقط الحق.` : `If refused: the labour court within 15 working days${last ? ` — by ${hintDate(last, today, ar)}` : ""}, or the right lapses.`,
        action: ACT.court(ar),
      },
      manager: ar ? `وإلا لجأ للمحكمة العمالية${last ? ` حتى ${hintDate(last, today, ar)}` : ""}.` : `Otherwise the worker goes to the labour court${last ? ` by ${hintDate(last, today, ar)}` : ""}.`,
      due: last,
    });
  },
  [LEAVE_CARRY_TYPE](row, c) {
    const { ar, today } = c;
    const n = ruleValue("leave.annual.deferMaxDays", today) || 90;
    return pack(row, c, {
      law: art("110", ar),
      right: ar ? `تأجيل إجازتك للسنة التالية بموافقة الشركة؛ وتأجيل الشركة لها لا يزيد على ${n} يوماً بعد سنة الاستحقاق إلا بموافقتك كتابةً.` : `Carrying leave needs the company's agreement; the company may defer it ${n} days at most without your written consent.`,
    });
  },
  [ART81_EXIT_TYPE](row, c) {
    const { ar } = c;
    return pack(row, c, {
      law: art("81", ar),
      right: ar ? "تترك العمل دون إشعار مع احتفاظك بكل حقوقك النظامية في حالات المادة 81." : "You leave without notice and keep all your legal rights in the Article 81 cases.",
      rightManager: ar ? `ترك ${nameOf(c)} العمل وفق المادة 81 يحفظ حقوقه كاملة، وتُصفّى خلال أسبوعين (المادة 88).` : `${nameOf(c)} keeps every right under Art. 81; settle within two weeks (Art. 88).`,
      manager: ar ? "وإلا تأخرت التصفية وصار له حق المطالبة أمام المحكمة العمالية." : "Otherwise the settlement is late and he may claim before the labour court.",
    });
  },
  [DOCUMENTS_RETURN_TYPE](row, c) {
    const { ar, today, emp } = c;
    const end = dateOnly(emp?.profile?.contractExit?.effectiveDate);
    return pack(row, c, {
      law: art("64", ar),
      right: ar ? `وثائقك المودعة تُعاد عند انتهاء العقد${end ? ` (${hintDate(end, today, ar)})` : ""} — لا يُرفض الطلب.` : `Deposited documents are returned at contract end${end ? ` (${hintDate(end, today, ar)})` : ""} — not refused.`,
      rightManager: ar ? `أعد وثائق ${nameOf(c)} المودعة${end ? ` عند انتهاء عقده ${hintDate(end, today, ar)}` : ""} — لا تُرفض.` : `Return ${nameOf(c)}'s documents${end ? ` at contract end ${hintDate(end, today, ar)}` : ""}.`,
      due: end,
    });
  },
  [NIGHT_AVOID_TYPE](row, c) {
    const { ar } = c;
    return pack(row, c, { law: dec("18632", ar), right: ar ? "بشهادة طبية تُنقل لعمل نهاري مماثل، أو تُخفض ساعاتك الليلية إلى 6 بالأجر نفسه." : "On a medical certificate you move to similar day work, or night hours drop to 6 at the same pay." });
  },
  [RESIGNATION_TYPE](row, c) {
    const { ar, today } = c;
    const rs = resignationState(row, today);
    if (row.exitRoute === EXIT_ROUTE_NOTICE75) {
      return pack(row, c, {
        law: art("75", ar),
        right: ar ? `ينتهي عقدك في ${hintDate(rs.endsOn, today, ar)} بانقضاء مهلة إشعارك — دون حاجة لقبول، وتُصفّى حقوقك خلال أسبوعين.` : `Your contract ends on ${hintDate(rs.endsOn, today, ar)} when the notice runs out — no acceptance needed; settlement within two weeks.`,
        rightManager: ar ? `عقد ${nameOf(c)} ينتهي في ${hintDate(rs.endsOn, today, ar)} بإشعاره — ابدأ إنهاء الخدمة وصفِّ حقوقه خلال أسبوعين بعده (المادة 88).` : `${nameOf(c)}'s contract ends ${hintDate(rs.endsOn, today, ar)} — start offboarding and settle within two weeks (Art. 88).`,
        manager: ar ? "وإلا تأخرت تصفية حقوقه وصار له حق المطالبة أمام المحكمة العمالية." : "Otherwise the settlement is late and he may claim in court.",
        due: rs.endsOn,
      });
    }
    const deemed = hintDate(rs.postponedUntil || rs.deemedAcceptedOn, today, ar);
    return pack(row, c, {
      law: art("79 مكرر", ar),
      right: ar
        ? (rs.postponedUntil ? `أُجّل القبول حتى ${deemed} — تُقبل استقالتك بحكم النظام عندها.` : `تُعد استقالتك مقبولة بحكم النظام في ${deemed} إن لم يُرد عليك${rs.withdrawUntil ? `، ولك سحبها حتى ${hintDate(rs.withdrawUntil, today, ar)}` : ""}.`)
        : (rs.postponedUntil ? `Acceptance postponed to ${deemed} — accepted by law then.` : `Your resignation is deemed accepted on ${deemed} without a reply${rs.withdrawUntil ? `; withdraw by ${hintDate(rs.withdrawUntil, today, ar)}` : ""}.`),
      rightManager: ar
        ? `استقالة ${nameOf(c)} لا تُرفض: اقبلها، أو أجّلها بإيضاح مكتوب قبل ${deemed} حتى ${rs.postponeMax || 60} يوماً.`
        : `${nameOf(c)}'s resignation is not refused: accept, or postpone in writing before ${deemed}, up to ${rs.postponeMax || 60} days.`,
      worker: {
        ifNot: ar ? "إن لم تُصفَّ حقوقك خلال أسبوعين من آخر يوم عمل: تظلّم ثم المحكمة العمالية (المادة 88)." : "If not settled within two weeks of your last day: grieve, then the labour court (Art. 88).",
        action: ACT.grievance(ar),
      },
      manager: ar ? `وإلا صارت مقبولة بحكم النظام في ${deemed}.` : `Otherwise it is accepted by law on ${deemed}.`,
      due: rs.postponedUntil || rs.deemedAcceptedOn,
    });
  },
  advance(row, c) {
    const { ar, emp } = c;
    if (row.moneyKind === "allowance") {
      return pack(row, c, { law: product(ar), right: ar ? "البدل يُصرف أو يُرفض بقرار مكتوب يُحفظ سببه في سجل التدقيق." : "An allowance is paid or refused with a written, audited reason." });
    }
    const p = emp?.profile || {};
    const wage = (Number(p.baseSalary) || 0) + (Number(p.allowances) || 0);
    const ratio = Number(ruleValue("payroll.loan.capRatio")) || 0.1;
    const cap = wage > 0 ? Math.floor(wage * ratio) : 0;
    const pct = Math.round(ratio * 100);
    return pack(row, c, {
      law: art("92", ar),
      right: ar ? `قسط استرداد السلفة لا يتجاوز ${pct}% من أجرك${cap ? ` — ${sar(cap, ar)} في الشهر` : ""}.` : `An advance instalment may not exceed ${pct}% of your wage${cap ? ` — ${sar(cap, ar)} a month` : ""}.`,
      rightManager: ar ? `إن صُرفت السلفة لـ${nameOf(c)} فقسطها لا يتجاوز ${pct}% من أجره${cap ? ` (${sar(cap, ar)} شهرياً)` : ""}.` : `If paid, ${nameOf(c)}'s instalment caps at ${pct}% of the wage${cap ? ` (${sar(cap, ar)} a month)` : ""}.`,
      manager: ar ? "وإلا رُدّ الزائد للموظف وصار له حق التظلم." : "Otherwise the excess is refunded and the worker may grieve.",
    });
  },
  overtime(row, c) {
    const { ar, today, emp } = c;
    if (!isOvertimeAssignment(row)) return null;
    const offer = otOffer({ employee: emp, hours: row.hours, date: row.date, exceptId: row.id });
    const total = offer.known ? sar(offer.pay.total, ar) : "";
    const mand = isArticle106Assignment(row);
    const credit = otCompensationOf(row) === "credit";
    return pack(row, c, {
      law: art(mand ? "106" : "107", ar),
      right: ar
        ? `${mand ? "التكليف الإجباري لحالات المادة 106 فقط، و" : ""}ساعتك الإضافية = أجر ساعتك + 50% من أساسيها${total ? ` — ${total} لهذه الساعات` : ""}، أو إجازة تعويضية باختيارك.`
        : `${mand ? "Mandatory only in Art. 106 cases; " : ""}an overtime hour = your hourly wage + 50% of basic${total ? ` — ${total} here` : ""}, or comp leave if you choose.`,
      rightManager: ar
        ? (credit ? `إجازة ${nameOf(c)} التعويضية (${hoursAr(offer.leave.hours)}) يتمتع بها حتى ${hintDate(offer.leave.takeBy, today, ar)}.` : `أجر إضافي ${nameOf(c)}${total ? ` (${total})` : ""} يُصرف مع راتب الشهر.`)
        : (credit ? `${nameOf(c)}'s comp leave (${offer.leave.hours} h) by ${hintDate(offer.leave.takeBy, today, ar)}.` : `${nameOf(c)}'s overtime pay${total ? ` (${total})` : ""} goes with the month's salary.`),
      manager: ar ? "وإلا صار أجراً متأخراً عن موعده (المادة 90)." : "Otherwise it becomes late pay (Art. 90).",
    });
  },
  leave_topup(row, c) {
    const { ar, today } = c;
    const n = ruleValue("leave.annual.days", today);
    return pack(row, c, { law: art("109", ar), right: ar ? `رصيدك النظامي لا يقل عن ${n} يوماً؛ الزيادة فوقه بقرار الشركة.` : `Your statutory floor is ${n} days; anything above is the company's decision.` });
  },
  study_consent(row, c) {
    const { ar } = c;
    return pack(row, c, { law: art("115", ar), right: ar ? "بموافقة الشركة على دراستك تصير إجازة امتحانك بأجر، والموافقة نهائية لا تُسحب." : "With the company's consent your exam leave is paid, and the consent is final." });
  },
  night_fitness(row, c) {
    const { ar } = c;
    return pack(row, c, { law: dec("18632", ar), right: ar ? "تقرير لياقتك يُحفظ في ملفك؛ وتقرير «غير لائق» يمنع تكليفك بعمل ليلي." : "Your fitness report stays on file; an «unfit» report bars night assignments." });
  },
  night_consent(row, c) {
    const { ar } = c;
    return pack(row, c, { law: dec("18632", ar), right: ar ? "استمرارك عاملاً ليلياً يحتاج موافقتك الخطية، ولك سحبها في أي وقت." : "Staying a night worker needs your written consent, which you may withdraw any time." });
  },
  custody(row, c) {
    const { ar } = c;
    return pack(row, c, { law: art("91", ar), right: ar ? "العهدة تُسلَّم وتُعاد موثّقة، ولا يُحسم ثمن تلفها إلا بتقدير يحق لك التظلم منه." : "Custody is handed and returned on record; damage is deducted only on an assessment you may contest." });
  },
  nursing_hour(row, c) {
    const { ar, today, emp } = c;
    const until = nursingRightUntil(row.childBirthDate || emp?.profile?.childBirthDate);
    const mins = ruleValue("leave.nursing.dailyMinutes", today) || 60;
    return pack(row, c, {
      law: art("154", ar),
      right: ar ? `فترات رضاعة لا تزيد على ${mins === 60 ? "ساعة" : `${mins} دقيقة`} يومياً تُحسب من ساعات العمل${until ? ` حتى ${hintDate(until, today, ar)}` : ""}، دون خصم من الأجر.` : `Nursing breaks up to ${mins} minutes a day count as work${until ? ` until ${hintDate(until, today, ar)}` : ""}, with no pay cut.`,
      due: row.date || row.startDate,
    });
  },
  pregnancy_notice(row, c) {
    const { ar } = c;
    return pack(row, c, { law: dec("18632", ar), right: ar ? "لا تُكلَّفين بعمل ليلي قبل الوضع بـ24 أسبوعاً، ولا يجوز فصلك أو إنذارك أثناء الحمل (المادة 155)." : "No night work in the 24 weeks before birth, and no dismissal during pregnancy (Art. 155).", due: row.date || row.startDate });
  },
  heat_report(row, c) {
    const { ar, today } = c;
    const w = heatBanWindow(today);
    return pack(row, c, {
      law: dec("3337", ar),
      right: ar ? `لا عمل مكشوفاً تحت الشمس من ${w.startLabel} إلى ${w.endLabel} ${w.seasonAr} — تُنقل لمكان مظلّل، ويُسجَّل بلاغك.` : `No exposed work from ${w.startLabel} to ${w.endLabel} ${w.seasonEn} — you move to shade; your report is logged.`,
      manager: ar ? "وإلا سُجّلت مخالفة على المنشأة يراها الموظف والإدارة." : "Otherwise a violation is recorded against the establishment.",
      due: row.date || row.startDate,
    });
  },
  family_duties(row, c) {
    const { ar } = c;
    return pack(row, c, { law: dec("18632", ar), right: ar ? "تُراعى مسؤولياتك العائلية عند جدولتك للعمل الليلي." : "Your family responsibilities are considered when you are rostered at night.", due: row.date || row.startDate });
  },
  doc(row, c) {
    const { ar } = c;
    if (row.docKind === "contract") {
      return pack(row, c, { law: art("51", ar), right: ar ? "نسخة من عقدك حقك ولا تُرفض — لكل طرف نسخة، ولك طلب كتابته في أي وقت." : "A copy of your contract is yours and not refused — each party keeps one." });
    }
    if (row.docKind === "exp" || row.docKind === "clear") {
      return pack(row, c, { law: art("64", ar), right: ar ? "شهادة الخدمة دون مقابل عند انتهاء العلاقة، ولا تُضمَّن ما يسيء إليك." : "A free service certificate at the end of service, with nothing that harms you." });
    }
    return pack(row, c, { law: product(ar), right: ar ? "تصدر الوثيقة في ملفك، والرفض يُكتب سببه في سجل التدقيق." : "The letter is issued on your file; a refusal writes its reason on the audit trail." });
  },
  punch(row, c) {
    const { ar } = c;
    return pack(row, c, { law: product(ar), right: ar ? "تصحيح الحضور قبل إقفال المسير حتى لا يُحسم أجر وقت عملته." : "Fix attendance before payroll closes so no worked time is docked." });
  },
  generic(row, c) {
    const { ar } = c;
    return pack(row, c, { law: product(ar), right: ar ? "يُبتّ في طلبك كتابةً، والرفض يُكتب سببه في سجل التدقيق." : "Your request is decided in writing; a refusal writes its reason on the audit trail." });
  },
};

const OTHER_ALIAS = {
  loan: "advance",
  overtime: "overtime",
  leave_credit: "leave_topup",
  manual_punch: "punch",
  checkout_fix: "punch",
  salary_letter: "doc",
  employment_letter: "doc",
  document: "doc",
  permission: "generic",
  shift_change: "generic",
  other_request: "generic",
};

/** Registry of every builder, keyed by request/leave type — exposed so tests can check coverage. */
export const RIGHT_HINT_BUILDERS = { leave: LEAVE, other: OTHER, leaveAlias: LEAVE_ALIAS, otherAlias: OTHER_ALIAS };
RIGHT_HINT_BUILDERS.pay = PAY_HINT_BUILDERS;
RIGHT_HINT_BUILDERS.disc = DISC_HINT_BUILDERS;
RIGHT_HINT_BUILDERS.att = ATT_HINT_BUILDERS;

/**
 * The hint for one request row (as flattenWorkspaceRows builds it: { family, type, status, employee, … }).
 * ctx: { view: "employee"|"manager", today, lang|ar, isHoliday, data }.
 */
export function rightHintFor(row, ctx = {}) {
  if (!row) return null;
  const ar = ctx.ar ?? (ctx.lang ? ctx.lang === "ar" : true);
  const today = dateOnly(ctx.today) || new Date().toISOString().slice(0, 10);
  const c = { ...ctx, ar, today, view: ctx.view === "manager" ? "manager" : "employee", emp: ctx.employee || row.employee || null };
  const type = String(row.type || "").toLowerCase();
  if (row.family === "leave") {
    const fn = LEAVE[type] || LEAVE[LEAVE_ALIAS[type]] || LEAVE.discretionary;
    return fn(row, c);
  }
  if (row.docKind) return OTHER.doc(row, c);
  if (isOvertimeAssignment(row)) return OTHER.overtime(row, c);
  const fn = OTHER[type] || OTHER[OTHER_ALIAS[type]] || OTHER.generic;
  return fn(row, c) || OTHER.generic(row, c);
}
