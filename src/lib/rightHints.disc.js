/**
 * «حقك / التزامك» for the discipline, employee-file, voice and safety surfaces.
 *
 * Same shape as src/lib/rightHints.js: { view, word, right, ifNot, action, law, due } — three lines
 * computed for THIS item (dates, days, amounts from the record). Employee views read «حقك», HR and
 * managers read «التزامك». Pure: no store, no React — every figure comes from existing derivations
 * (laborRules, disciplineBoard, employerDuties, abuseComplaint, contractLawDerivations).
 *
 * Statute checked against the Labour Law and Implementing Regulations texts:
 *   Arts. 66–72 discipline (closed list; 180-day repeat; 30-day accusation/signing; 5-day caps;
 *   written notice + hearing; written decision, grievance 30 days excl. holidays, ruling 15 days, court 30),
 *   Art. 80 dismissal (grounds, hearing, written warning, 24h report), Arts. 51–55 contract,
 *   Art. 64 certificate + documents, Regs Art. 6 passport/iqama, Arts. 42–48 training, Art. 143 medical,
 *   Arts. 121–123 safety, Art. 141 + Regs Art. 28 injury reporting, Art. 142 first aid,
 *   model regulation Arts. 54–56 abuse (5 working days, confidential), model Art. 71 grievance.
 */
import { citeRule, ruleAt, ruleValue } from "./laborRules.js";
import { regulationDate } from "./workRegulation.js";
import { daysAfterExcludingHolidays, DOCUMENTS_RETURN_TYPE, GRIEVANCE_TYPE, rightsRouteFor } from "./rightsRequests.js";
import { faceOf, penaltyLabel } from "./disciplineBoard.js";
import { art80Ground, resolvePenaltyKind } from "./disciplineDerivations.js";
import { HELD_DOCUMENT_KINDS, medicalExamStatus, trainingDocumentationDue } from "./employerDuties.js";
import { ABUSE_WORKING_DAYS, abuseCaseClocks, addWorkingDays } from "./abuseComplaint.js";

const LABOUR_COURT_URL = "https://najiz.sa";

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

/** «30 أكتوبر» — the year only when it differs from today's (same as rightHints.hintDate). */
function hd(iso, today, ar = true) {
  const d = dateOnly(iso);
  if (!d) return "";
  const full = regulationDate(d, ar);
  return dateOnly(today).slice(0, 4) === d.slice(0, 4) ? full.replace(/\s\d{4}$/, "") : full;
}

/* ── law references ─────────────────────────────────────────────────────── */
const art = (a, ar) => ({ article: String(a), label: ar ? `المادة ${a}` : `Art. ${a}` });
const regs = (n, ar) => ({ regs: String(n), label: ar ? `اللائحة م${n}` : `Regs Art. ${n}` });
const model = (n, ar) => ({ regs: `model-${n}`, label: ar ? `النموذج الموحد م${n}` : `Model regulation Art. ${n}` });
const product = (ar) => ({ product: true, label: ar ? "قرار تشغيلي" : "Operational" });

/** The law reference a LABOR_RULES row names (labour article, or an operational rule). */
export function lawOfRule(ruleId, ar = true, onDate) {
  const c = citeRule(ruleId, onDate);
  if (c?.article) return art(c.article, ar);
  const row = ruleAt(ruleId, onDate);
  const m = row && row.source !== "product" ? String(row.hintAr || "").match(/اللائحة\s*(?:مادة|م)\s*(\d+)/) : null;
  if (m) return regs(m[1], ar);
  return product(ar);
}

/* ── ready flows ────────────────────────────────────────────────────────── */
const rightsTo = (kind) => rightsRouteFor(kind);
const ACT = {
  grievance: (ar) => ({ kind: "rights", rightsKind: GRIEVANCE_TYPE, to: rightsTo(GRIEVANCE_TYPE), label: ar ? "قدّم تظلماً" : "File a grievance" }),
  documents: (ar) => ({ kind: "rights", rightsKind: DOCUMENTS_RETURN_TYPE, to: rightsTo(DOCUMENTS_RETURN_TYPE), label: ar ? "اطلب وثائقك" : "Ask for your documents" }),
  object: (ar) => ({ kind: "object", to: "/app/discipline?tab=mine", label: ar ? "اعترض على الجزاء" : "Object to the sanction" }),
  court: (ar) => ({ kind: "href", href: LABOUR_COURT_URL, external: true, label: ar ? "المحكمة العمالية (ناجز)" : "Labour court (Najiz)" }),
  decide: (ar, to) => ({ kind: "decide", ...(to ? { to } : {}), label: ar ? "افتح القرار" : "Open the decision" }),
  open: (ar, to, label) => (to ? { kind: "open", to, label: label || (ar ? "افتح الملف" : "Open the file") } : null),
  voice: (ar) => ({ kind: "open", to: "/app/complaints", label: ar ? "ارفع شكوى" : "Raise a complaint" }),
};

function ctxOf(ctx = {}) {
  const ar = ctx.ar ?? (ctx.lang ? ctx.lang === "ar" : true);
  const today = dateOnly(ctx.today) || new Date().toISOString().slice(0, 10);
  return { ...ctx, ar, today, view: ctx.view === "manager" ? "manager" : "employee" };
}

const nameOf = (c, emp) => String(emp?.name || c.employee?.name || "").trim() || (c.ar ? "الموظف" : "the worker");

/** One hint in the shared shape. `worker`/`manager` = { ifNot, action }. */
function pack(c, { law, right, rightManager, worker, manager, due }) {
  const m = c.view === "manager";
  const tail = m ? manager : worker;
  return {
    view: m ? "manager" : "employee",
    word: c.ar ? (m ? "التزامك" : "حقك") : (m ? "Your duty" : "Your right"),
    right: m ? (rightManager || right) : right,
    ifNot: tail?.ifNot || "",
    action: tail?.action || null,
    law,
    due: m && due ? dateOnly(due) : "",
  };
}

/* ══ discipline (Arts. 66–72, 80) ═════════════════════════════════════════ */

/** The case's stage from its record (same faces as the discipline board). */
export function disciplineStageOf(item) {
  return faceOf(item?.status).id;
}

/** Last day to grieve: 30 days, official holidays not counted, from the day the decision reached him. */
export function disciplineGrievanceBy(item, isHoliday) {
  const from = dateOnly(item?.notifyDeliveredAt) || dateOnly(item?.signedAt || item?.decidedAt);
  const n = Number(ruleValue("discipline.appeal.internalDays")) || 30;
  return from ? daysAfterExcludingHolidays(from, n, isHoliday) : "";
}

/** Last day to rule on a grievance (15 days of filing, holidays skipped as the ruling gate does). */
export function disciplineRulingBy(item, isHoliday) {
  const from = dateOnly(item?.appealedAt);
  const n = Number(ruleValue("discipline.decision.days")) || 15;
  return from ? daysAfterExcludingHolidays(from, n, isHoliday) : "";
}

/** Last day to object before the labour court: 30 days excl. holidays from the refusal or the lapsed ruling. */
export function disciplineCourtBy(item, isHoliday) {
  const ruled = dateOnly(item?.rulingAt);
  const lapse = disciplineRulingBy(item, isHoliday);
  const from = ruled && (!lapse || ruled <= lapse) ? ruled : lapse;
  return from ? daysAfterExcludingHolidays(from, 30, isHoliday) : "";
}

function art80Hint(item, c, emp) {
  const { ar } = c;
  const ground = art80Ground(item?.dismissGround);
  const g = ground ? (ar ? ground.ar : ground.en) : "";
  const extra = ground?.warning || ground?.absence
    ? (ar ? "، وبعد إنذاره كتابةً" : ", after a written warning")
    : ground?.report24h ? (ar ? "، وبإبلاغ الجهات المختصة خلال 24 ساعة من العلم" : ", reporting the authorities within 24 hours") : "";
  const extraMine = ground?.warning || ground?.absence
    ? (ar ? "، وبعد إنذارك كتابةً" : ", after a written warning")
    : extra;
  return pack(c, {
    law: art("80", ar),
    right: ar
      ? `لا تُفصل دون مكافأة أو إشعار إلا في حالة من حالات المادة 80${g ? ` («${g}»)` : ""}، وبعد إتاحة الفرصة لك لإبداء أسباب معارضتك${extraMine}.`
      : `No dismissal without award or notice except in an Article 80 case${g ? ` (“${g}”)` : ""}, after you are heard${extraMine}.`,
    rightManager: ar
      ? `فصل ${nameOf(c, emp)} دون مكافأة لحالة من المادة 80${g ? ` («${g}»)` : ""} فقط، بقرار مكتوب بعد سماع أسباب معارضته${extra}.`
      : `Dismissing ${nameOf(c, emp)} without award only in an Article 80 case${g ? ` (“${g}”)` : ""}, in writing after hearing him${extra}.`,
    worker: {
      ifNot: ar ? "إن فُصلت خارج حالاتها أو دون سماعك: لك المحكمة العمالية والتعويض عن الإنهاء لغير سبب مشروع (المادة 77)." : "If dismissed outside those cases or unheard: the labour court and compensation for termination without valid reason (Art. 77).",
      action: ACT.court(ar),
    },
    manager: {
      ifNot: ar ? "وإلا عُدّ إنهاءً لغير سبب مشروع واستحق التعويض والمكافأة (المادة 77)." : "Otherwise it is termination without a valid reason, with compensation and the award (Art. 77).",
      action: ACT.decide(ar),
    },
  });
}

/**
 * The hint for one sanction file. item = the disciplinaryCases row; ctx: { view, ar, today, isHoliday,
 * employee, to }. Each stage names its own clock from the record.
 */
export function disciplineCaseHint(item, ctx = {}) {
  if (!item) return null;
  const c = ctxOf(ctx);
  const { ar, today, isHoliday } = c;
  const emp = ctx.employee || null;
  const name = nameOf(c, emp);
  const stage = disciplineStageOf(item);
  const kind = resolvePenaltyKind(item);
  const pen = penaltyLabel(item, ar) || (ar ? "الجزاء" : "the penalty");
  const cap = Number(ruleValue("discipline.fine.maxDays", today)) || 5;
  const charge = Number(ruleValue("discipline.charge.maxDays", today)) || 30;
  const repeat = Number(ruleValue("discipline.repeat.cooloffDays", today)) || 180;
  const open = ACT.decide(ar, ctx.to);

  if (kind === "dismiss" && (stage === "notified" || stage === "defence")) return art80Hint(item, c, emp);

  if (stage === "notified") {
    const by = addDays(item.discoveredAt, charge);
    return pack(c, {
      law: art("71", ar),
      right: ar
        ? `لا يُوقَّع عليك «${pen}» قبل إبلاغك كتابةً بما نُسب إليك وسماع دفاعك في محضر يودع ملفك.`
        : `“${pen}” is not imposed before written notice of the charge and a hearing recorded in your file.`,
      rightManager: ar
        ? `أبلغ ${name} كتابةً واسمع دفاعه في محضر قبل أي جزاء${by ? `؛ ولا يُتّهم بعد ${charge} يوماً من كشف المخالفة — حتى ${hd(by, today, ar)}` : ""}.`
        : `Notify ${name} in writing and hear the defence in minutes before any penalty${by ? `; no charge after ${charge} days from discovery — by ${hd(by, today, ar)}` : ""}.`,
      worker: {
        ifNot: ar ? "إن وُقّع دون سماعك: تظلّم كتابةً خلال 30 يوماً من إبلاغك بالقرار، عدا العطل الرسمية (المادة 72)." : "If imposed without a hearing: grieve in writing within 30 days of notice, holidays excluded (Art. 72).",
        action: ACT.grievance(ar),
      },
      manager: {
        ifNot: ar ? "وإلا سقط الاتهام بمضيّ المهلة (المادة 69)، وبطل كل جزاء بلا محضر." : "Otherwise the charge lapses (Art. 69), and a penalty without minutes is void.",
        action: open,
      },
      due: by,
    });
  }

  if (stage === "defence") {
    const ended = dateOnly(item.hearingEndedAt || item.hearingAt || item.investigationEndedAt);
    const by = addDays(ended, charge);
    const capLine = kind === "fine" || kind === "suspend"
      ? (ar ? `، ولا يتجاوز الحسم أو الإيقاف أجر ${cap} أيام في الشهر (المادة 70)` : `, and cuts or suspension stay within ${cap} days a month (Art. 70)`)
      : "";
    return pack(c, {
      law: art("69", ar),
      right: ar
        ? `لا يُوقَّع عليك الجزاء بعد ${charge} يوماً من انتهاء التحقيق${by ? ` — أي بعد ${hd(by, today, ar)}` : ""}${capLine}.`
        : `No penalty more than ${charge} days after the investigation ended${by ? ` — after ${hd(by, today, ar)}` : ""}${capLine}.`,
      rightManager: ar
        ? `وقّع جزاء ${name} أو احفظ الملف خلال ${charge} يوماً من انتهاء التحقيق${by ? ` — حتى ${hd(by, today, ar)}` : ""}${capLine}.`
        : `Sign ${name}'s penalty or close the file within ${charge} days of the investigation${by ? ` — by ${hd(by, today, ar)}` : ""}${capLine}.`,
      worker: {
        ifNot: ar ? "إن وُقّع بعد المهلة: تظلّم كتابةً خلال 30 يوماً من إبلاغك بالقرار (المادة 72)." : "If signed after the window: grieve in writing within 30 days of notice (Art. 72).",
        action: ACT.grievance(ar),
      },
      manager: {
        ifNot: ar ? "وإلا امتنع توقيع الجزاء بعد المهلة (المادة 69)." : "Otherwise the penalty can no longer be signed (Art. 69).",
        action: open,
      },
      due: by,
    });
  }

  if (stage === "signed") {
    const by = disciplineGrievanceBy(item, isHoliday);
    const delivered = Boolean(dateOnly(item.notifyDeliveredAt) || item.notifyMethod);
    return pack(c, {
      law: art("72", ar),
      right: ar
        ? `لك التظلم كتابةً من «${pen}» خلال 30 يوماً عدا العطل الرسمية من إبلاغك${by ? ` — حتى ${hd(by, today, ar)}` : ""}.`
        : `You may grieve “${pen}” in writing within 30 days of notice, holidays excluded${by ? ` — by ${hd(by, today, ar)}` : ""}.`,
      rightManager: delivered
        ? (ar ? `مهلة تظلّم ${name} مفتوحة${by ? ` حتى ${hd(by, today, ar)}` : ""} — وإن تظلّم فالبتّ كتابةً خلال 15 يوماً.` : `${name}'s grievance window is open${by ? ` until ${hd(by, today, ar)}` : ""}; a grievance is ruled on in writing within 15 days.`)
        : (ar ? `سلّم القرار لـ${name} كتابةً، وبكتاب مسجّل على عنوانه في ملفه إن امتنع أو غاب.` : `Deliver the decision to ${name} in writing, by registered letter to his address if he refuses or is absent.`),
      worker: {
        ifNot: ar ? `إن لم تتظلّم${by ? ` حتى ${hd(by, today, ar)}` : " في المهلة"} استقرّ الجزاء على ملفك.` : `If you do not grieve${by ? ` by ${hd(by, today, ar)}` : ""}, the penalty settles on your file.`,
        action: ACT.object(ar),
      },
      manager: {
        ifNot: delivered
          ? (ar ? "لا يُغلق الملف قبل انقضاء مهلته." : "The file does not close before the window ends.")
          : (ar ? "وإلا بقيت مهلة تظلّمه مفتوحة، لأنها تبدأ من إبلاغه." : "Otherwise his window stays open, since it starts from delivery."),
        action: open,
      },
      due: by,
    });
  }

  if (stage === "objected") {
    const by = disciplineRulingBy(item, isHoliday);
    const court = disciplineCourtBy(item, isHoliday);
    return pack(c, {
      law: art("72", ar),
      right: ar
        ? `يُبتّ في تظلّمك كتابةً خلال 15 يوماً من تقديمه${by ? ` — حتى ${hd(by, today, ar)}` : ""}.`
        : `Your grievance is ruled on in writing within 15 days${by ? ` — by ${hd(by, today, ar)}` : ""}.`,
      rightManager: ar
        ? `بُتّ في تظلّم ${name} كتابةً خلال 15 يوماً من تقديمه${by ? ` — حتى ${hd(by, today, ar)}` : ""}.`
        : `Rule on ${name}'s grievance in writing within 15 days${by ? ` — by ${hd(by, today, ar)}` : ""}.`,
      worker: {
        ifNot: ar ? `إن رُفض أو لم يُبتّ فيه: لك الاعتراض أمام المحكمة العمالية خلال 30 يوماً عدا العطل${court ? ` — حتى ${hd(court, today, ar)}` : ""}.` : `If refused or unanswered: the labour court within 30 days, holidays excluded${court ? ` — by ${hd(court, today, ar)}` : ""}.`,
        action: ACT.court(ar),
      },
      manager: {
        ifNot: ar ? `وإلا صار له الاعتراض أمام المحكمة العمالية${court ? ` حتى ${hd(court, today, ar)}` : ""}.` : `Otherwise he may object before the labour court${court ? ` by ${hd(court, today, ar)}` : ""}.`,
        action: open,
      },
      due: by,
    });
  }

  // closed — settled: the repeat clock (Art. 68), and the court if the grievance was refused.
  const told = dateOnly(item.notifyDeliveredAt) || dateOnly(item.signedAt || item.decidedAt);
  const lift = told ? addDays(told, repeat) : "";
  const refused = Boolean(dateOnly(item.appealedAt)) && item.rulingOutcome !== "void";
  const court = refused ? disciplineCourtBy(item, isHoliday) : "";
  return pack(c, {
    law: art("68", ar),
    right: ar
      ? `لا يُشدَّد عليك الجزاء إن تكررت المخالفة بعد ${repeat} يوماً من إبلاغك به${lift ? ` — أي بعد ${hd(lift, today, ar)}` : ""}.`
      : `A repeat is not penalised more heavily ${repeat} days after notice${lift ? ` — after ${hd(lift, today, ar)}` : ""}.`,
    rightManager: ar
      ? `لا تشديد على ${name} عند التكرار بعد ${repeat} يوماً من إبلاغه${lift ? ` — بعد ${hd(lift, today, ar)}` : ""}.`
      : `No heavier penalty on ${name} for a repeat after ${repeat} days${lift ? ` — after ${hd(lift, today, ar)}` : ""}.`,
    worker: refused && court
      ? { ifNot: ar ? `إن رُفض تظلّمك: لك المحكمة العمالية حتى ${hd(court, today, ar)}.` : `If your grievance was refused: the labour court by ${hd(court, today, ar)}.`, action: ACT.court(ar) }
      : { ifNot: ar ? "إن شُدّد عليك بعد المهلة: تظلّم كتابةً خلال 30 يوماً من إبلاغك (المادة 72)." : "If a repeat is aggravated after the window: grieve within 30 days (Art. 72).", action: ACT.grievance(ar) },
    manager: {
      ifNot: ar ? "وإلا بطل التشديد وصار له حق التظلم ثم المحكمة العمالية." : "Otherwise the aggravation is void and he may grieve, then go to court.",
      action: open,
    },
  });
}

/** «حقوقي في هذا المسار» — one hint per listed right (rule row). */
export function disciplineRuleHint(ruleId, text, ctx = {}) {
  const c = ctxOf(ctx);
  const { ar, today } = c;
  const law = lawOfRule(ruleId, ar, today);
  const appealRow = ruleId === "discipline.decision.days";
  return pack(c, {
    law,
    right: text,
    worker: appealRow
      ? { ifNot: ar ? "إن رُفض تظلّمك أو لم يُبتّ فيه: المحكمة العمالية خلال 30 يوماً عدا العطل." : "If refused or unanswered: the labour court within 30 days.", action: ACT.court(ar) }
      : { ifNot: ar ? "إن وُقّع عليك جزاء بخلافه: اعترض كتابةً خلال 30 يوماً عدا العطل من إبلاغك (المادة 72)." : "If a penalty breaks it: object in writing within 30 days of notice (Art. 72).", action: ACT.object(ar) },
    manager: { ifNot: ar ? "وإلا بطل الجزاء وصار للموظف التظلم ثم المحكمة العمالية." : "Otherwise the penalty is void; the worker may grieve, then go to court.", action: ACT.decide(ar) },
  });
}

/* ══ employee file ════════════════════════════════════════════════════════ */

/** The contract on file (Arts. 51–55): written in two copies, probation ≤ 180 days in all, the term. */
export function contractHint(employee, ctx = {}) {
  if (!employee) return null;
  const c = ctxOf(ctx);
  const { ar, today } = c;
  const p = employee.profile || {};
  const name = nameOf(c, employee);
  const fixed = /fixed|محدد/.test(String(p.contract?.type || p.contractType || ""));
  const end = dateOnly(p.contract?.endDate || p.contractEndDate);
  const probMax = Number(ruleValue("contract.probation.maxDays", today)) || 180;
  const probation = ctx.probation || null;
  const probLine = p.probation
    ? (ar
      ? `، والتجربة منصوص عليها فيه لا تتجاوز ${probMax} يوماً بمجموعها${probation?.remaining != null ? ` — بقي ${probation.remaining} يوماً` : ""}`
      : `; probation is stated in it, ${probMax} days at most in all${probation?.remaining != null ? ` — ${probation.remaining} days left` : ""}`)
    : "";
  const termLine = fixed && end ? (ar ? `، وينتهي في ${hd(end, today, ar)} ما لم يُجدَّد` : `; it ends on ${hd(end, today, ar)} unless renewed`) : "";
  const signed = Boolean(p.contract?.fileUrl || p.contract?.generated || p.contract?.signedAt);
  return pack(c, {
    law: art(p.probation ? "53" : "51", ar),
    right: ar
      ? `عقدك مكتوب من نسختين ولك نسختك منه${termLine}${probLine}.`
      : `Your contract is written in two copies and one is yours${termLine}${probLine}.`,
    rightManager: ar
      ? `${signed ? "" : "اكتب "}عقد ${name} من نسختين وسلّمه نسخته${termLine}${probLine}.`
      : `${signed ? "Keep" : "Write"} ${name}'s contract in two copies and hand him one${termLine}${probLine}.`,
    worker: {
      ifNot: ar ? "إن لم تُسلَّم نسختك: اطلبها من طلباتي، وللعامل إثبات العقد بجميع طرق الإثبات (المادة 51)." : "If you have no copy: ask for it in My requests; the worker may prove the contract by any means (Art. 51).",
      action: { kind: "doc", to: "/app/requests?kind=doc&doc=contract", label: ar ? "اطلب نسخة العقد" : "Ask for the contract copy" },
    },
    manager: {
      ifNot: ar ? "وإلا جاز للعامل إثبات العقد وحقوقه بجميع طرق الإثبات (المادة 51)." : "Otherwise the worker may prove the contract and his rights by any means (Art. 51).",
      action: ACT.open(ar, ctx.to || "", ar ? "حدّث العقد" : "Update the contract"),
    },
    due: fixed ? end : "",
  });
}

/** A file alert (EmpAlertsStrip row) whose rule row names an article — the hint carries the alert's own value. */
export function fileAlertHint(alert, employee, ctx = {}) {
  if (!alert) return null;
  const c = ctxOf(ctx);
  const { ar, today } = c;
  const row = alert.ruleId ? ruleAt(alert.ruleId, today) : null;
  const law = alert.ruleId ? lawOfRule(alert.ruleId, ar, today) : product(ar);
  const plain = row ? (ar ? row.hintAr : row.hintEn) : "";
  const value = String(alert.value || "").trim();
  const leave = String(alert.ruleId || "").startsWith("leave.");
  if (String(alert.ruleId || "").startsWith("eos.")) {
    return pack(c, {
      law,
      right: plain,
      rightManager: plain,
      worker: { ifNot: ar ? "إن لم تُصرف خلال أسبوع من انتهاء العلاقة (أسبوعين إن أنهيتها أنت): لك المحكمة العمالية (المادة 88)." : "If not paid within a week of the end (two if you ended it): the labour court (Art. 88).", action: ACT.court(ar) },
      manager: { ifNot: ar ? "وإلا تأخرت التصفية وصار له المطالبة أمام المحكمة العمالية (المادة 88)." : "Otherwise the settlement is late and he may claim in court (Art. 88).", action: ACT.open(ar, alert.href || ctx.to || "") },
    });
  }
  return pack(c, {
    law,
    right: [plain, value && !plain.includes(value) ? (ar ? `في ملفك: ${value}.` : `On your file: ${value}.`) : ""].filter(Boolean).join(" ") || value,
    rightManager: [plain, value ? (ar ? `في ملف ${nameOf(c, employee)}: ${value}.` : `On ${nameOf(c, employee)}'s file: ${value}.`) : ""].filter(Boolean).join(" "),
    worker: leave
      ? { ifNot: ar ? "إن رُفضت إجازتك أو أُجّلت دون سند: تظلّم كتابةً خلال 30 يوماً (النموذج الموحد م71)." : "If your leave is refused without ground: grieve within 30 days.", action: ACT.grievance(ar) }
      : { ifNot: ar ? "إن لم يُصحَّح ما يمسّ حقك: تظلّم كتابةً خلال 30 يوماً (النموذج الموحد م71)." : "If it is not corrected: grieve in writing within 30 days.", action: ACT.grievance(ar) },
    manager: {
      ifNot: ar ? "وإلا بقي الملف مخالفاً عند التفتيش وصار للموظف حق التظلم." : "Otherwise the file stays non-compliant at inspection and the worker may grieve.",
      action: ACT.open(ar, alert.href || ctx.to || "", ar ? "افتح البند" : "Open the item"),
    },
  });
}

/** Training record (Arts. 42–48 · Regs Art. 16): documented within 30 days of the programme's end. */
export function trainingHint(record, ctx = {}) {
  if (!record) return null;
  const c = ctxOf(ctx);
  const { ar, today } = c;
  const doc = trainingDocumentationDue(record, today);
  const bond = Number(record.bond?.days) || 0;
  return pack(c, {
    law: art("48", ar),
    right: ar
      ? `تدريب «${record.course || "—"}» يُثبت في ملفك${bond ? `، والتزامك بعده ${bond} يوماً منصوص عليه كتابةً` : ""}، ولا تُحمَّل تكلفته إلا إن تركته دون عذر أو أخللت بالمدة المشروطة.`
      : `Training “${record.course || "—"}” stays on your file${bond ? `; the ${bond}-day bond is in writing` : ""}; you bear its cost only in the Law's cases.`,
    rightManager: doc
      ? (ar ? `وثّق تدريب «${record.course || "—"}» في منصة الوزارة خلال 30 يوماً من انتهائه — حتى ${hd(doc.due, today, ar)}.` : `Document “${record.course || "—"}” on the Ministry platform within 30 days — by ${hd(doc.due, today, ar)}.`)
      : (ar ? `تدريب «${record.course || "—"}» موثّق — يبقى في سجل التدريب (المواد 42–48).` : `“${record.course || "—"}” is documented — it stays on the training register.`),
    worker: {
      ifNot: ar ? "إن طُولبت بتكلفة لا يُلزمك بها النظام: تظلّم كتابةً خلال 30 يوماً." : "If charged a cost the Law does not put on you: grieve within 30 days.",
      action: ACT.grievance(ar),
    },
    manager: {
      ifNot: doc?.over
        ? (ar ? "تجاوزت المهلة — تُسجَّل مخالفة عند التفتيش (اللائحة م16)." : "The window passed — an inspection violation (Regs Art. 16).")
        : (ar ? "وإلا سُجّلت مخالفة عند التفتيش (اللائحة م16)." : "Otherwise it is an inspection violation (Regs Art. 16)."),
      action: ACT.open(ar, ctx.to || "", ar ? "وثّقه" : "Document it"),
    },
    due: doc?.due || "",
  });
}

/** Periodic medical exam (Art. 143): at least yearly for workers exposed to an occupational disease. */
export function medicalExamHint(employee, ctx = {}) {
  if (!employee) return null;
  const c = ctxOf(ctx);
  const { ar, today } = c;
  const med = medicalExamStatus(employee, today);
  if (!med.required) return null;
  const hazard = String(employee.profile?.exposureHazard || "").trim();
  return pack(c, {
    law: art("143", ar),
    right: ar
      ? `لتعرّضك${hazard ? ` لـ«${hazard}»` : " لخطر مهني"} تُفحص فحصاً شاملاً على حساب الشركة مرة كل سنة على الأقل — الموعد ${hd(med.due, today, ar)}، وتُثبت النتيجة في ملفك.`
      : `Being exposed${hazard ? ` to “${hazard}”` : ""}, you get a full exam at the company's cost at least yearly — due ${hd(med.due, today, ar)}; the result goes on your file.`,
    rightManager: ar
      ? `افحص ${nameOf(c, employee)} فحصاً شاملاً${med.over ? ` — متأخر منذ ${hd(med.due, today, ar)}` : ` حتى ${hd(med.due, today, ar)}`}، وأثبت النتيجة في السجل وفي ملفه.`
      : `Examine ${nameOf(c, employee)}${med.over ? ` — overdue since ${hd(med.due, today, ar)}` : ` by ${hd(med.due, today, ar)}`}, and record the result.`,
    worker: {
      ifNot: ar ? "إن فات الموعد: اطلبه من صوت الموظف، فالفحص التزام على الشركة." : "If the date passes: raise it in Employee voice — the exam is the company's duty.",
      action: ACT.voice(ar),
    },
    manager: {
      ifNot: ar ? "وإلا سُجّلت مخالفة سلامة عند التفتيش." : "Otherwise it is a safety violation at inspection.",
      action: ACT.open(ar, ctx.to || "", ar ? "أثبت الفحص" : "Record the exam"),
    },
    due: med.due,
  });
}

/** A document the employer holds (Regs Art. 6 · Law Art. 64/2). */
export function heldDocumentHint(doc, employee, ctx = {}) {
  if (!doc) return null;
  const c = ctxOf(ctx);
  const { ar, today } = c;
  const k = HELD_DOCUMENT_KINDS.find((x) => x.id === doc.kind);
  const label = k ? (ar ? k.ar : k.en) : (ar ? "الوثيقة" : "the document");
  const banned = Boolean(k?.nonSaudiBan);
  const returned = dateOnly(doc.returnedAt);
  const end = dateOnly(employee?.profile?.contractExit?.effectiveDate);
  return pack(c, {
    law: banned ? regs("6", ar) : art("64", ar),
    right: banned
      ? (ar ? `${label} لك — لا تحتفظ بها الشركة${returned ? `؛ أُعيدت ${hd(returned, today, ar)}` : " وتُعاد إليك فوراً"}.` : `Your ${label.toLowerCase()} is yours — the company does not keep it${returned ? `; returned ${hd(returned, today, ar)}` : "; it is returned now"}.`)
      : (ar ? `ما أودعته من شهادات ووثائق يُعاد إليك عند انتهاء العقد${end ? ` (${hd(end, today, ar)})` : ""}.` : `What you deposited is returned at contract end${end ? ` (${hd(end, today, ar)})` : ""}.`),
    rightManager: banned
      ? (ar ? `لا تحتفظ بـ${label} ${nameOf(c, employee)}${returned ? ` — أُعيدت ${hd(returned, today, ar)}` : " — أعدها إليه الآن وسجّل تاريخ الإعادة"}.` : `Do not keep ${nameOf(c, employee)}'s ${label.toLowerCase()}${returned ? "" : " — return it now and record the date"}.`)
      : (ar ? `أعد إلى ${nameOf(c, employee)} ما أودعه عند انتهاء عقده${end ? ` ${hd(end, today, ar)}` : ""}.` : `Return what ${nameOf(c, employee)} deposited at contract end${end ? ` ${hd(end, today, ar)}` : ""}.`),
    worker: { ifNot: ar ? "إن لم تُعد: اطلب وثائقك، ولا يُرفض الطلب." : "If not returned: ask for your documents — it is not refused.", action: ACT.documents(ar) },
    manager: {
      ifNot: ar ? "وإلا سُجّلت مخالفة على المنشأة وللعامل اللجوء للمحكمة العمالية." : "Otherwise it is a violation, and the worker may go to the labour court.",
      action: ACT.open(ar, ctx.to || "", ar ? "سجّل الإعادة" : "Record the return"),
    },
    due: banned && !returned ? today : (!banned ? end : ""),
  });
}

/** Service certificate (Art. 64/1): free, at the end of service, nothing that harms the worker. */
export function serviceCertificateHint(employee, ctx = {}) {
  if (!employee) return null;
  const c = ctxOf(ctx);
  const { ar, today } = c;
  const end = dateOnly(employee.profile?.contractExit?.effectiveDate || employee.profile?.contractExit?.lastDay);
  return pack(c, {
    law: art("64", ar),
    right: ar
      ? `شهادة خدمة دون مقابل${end ? ` عند انتهاء العلاقة (${hd(end, today, ar)})` : " عند انتهاء العلاقة"}: تاريخ التحاقك وانتهائه ومهنتك وأجرك الأخير، ولا تتضمن ما يسيء إليك.`
      : `A free service certificate${end ? ` at the end (${hd(end, today, ar)})` : ""}: dates, profession and last wage, with nothing that harms you.`,
    rightManager: ar
      ? `أصدر لـ${nameOf(c, employee)} شهادة خدمة دون مقابل${end ? ` عند انتهاء علاقته ${hd(end, today, ar)}` : ""}، وأعد إليه ما أودعه.`
      : `Issue ${nameOf(c, employee)} a free service certificate${end ? ` at ${hd(end, today, ar)}` : ""}, and return what he deposited.`,
    worker: { ifNot: ar ? "إن لم تُصدر: اطلبها من طلباتي، ولا تُرفض." : "If not issued: ask in My requests — it is not refused.", action: { kind: "doc", to: "/app/requests?kind=doc&doc=exp", label: ar ? "اطلب شهادة الخدمة" : "Ask for the certificate" } },
    manager: { ifNot: ar ? "وإلا صار للعامل المطالبة بها أمام المحكمة العمالية." : "Otherwise the worker may claim it before the labour court.", action: ACT.open(ar, ctx.to || "", ar ? "أصدر الشهادة" : "Issue it") },
    due: end,
  });
}

/* ══ voice: abuse complaint and grievance ═════════════════════════════════ */

/** An abuse complaint (model reg. Arts. 54–56): inquiry in 5 working days, confidential, no retaliation. */
export function abuseCaseHint(row, ctx = {}) {
  if (!row) return null;
  const c = ctxOf(ctx);
  const { ar, today } = c;
  const clock = abuseCaseClocks(row, { today, calendar: ctx.calendar, restWeekdays: ctx.restWeekdays })[0] || null;
  const due = clock?.due || (dateOnly(row.filedAt) ? addWorkingDays(row.filedAt, ABUSE_WORKING_DAYS, { calendar: ctx.calendar }) : "");
  const closed = ["decided", "closed"].includes(String(row.status || ""));
  return pack(c, {
    law: model("55", ar),
    right: closed
      ? (ar ? "انتهى التحقيق بتوصية مكتوبة، ولا تُضار من شكواك، ولك اللجوء للجهات الحكومية المختصة (النموذج الموحد م56/7)." : "The inquiry ended with a written recommendation; you are not harmed for complaining and may go to the authorities.")
      : (ar ? `تُحقَّق شكواك بسرية بلجنة ليس فيها أحد الطرفين خلال ${ABUSE_WORKING_DAYS} أيام عمل${due ? ` — حتى ${hd(due, today, ar)}` : ""}، ولا تُضار منها.` : `Your complaint is investigated confidentially by a committee without the parties within ${ABUSE_WORKING_DAYS} working days${due ? ` — by ${hd(due, today, ar)}` : ""}; you are not harmed for it.`),
    rightManager: closed
      ? (ar ? "أبقِ الشكوى سرية، ولا يُفتح على صاحبها ملف متصل بها (النموذج الموحد م56/1)." : "Keep it confidential; open no related file on the complainant.")
      : (ar ? `شكّل لجنة بقرار وأنهِ التحقيق السري خلال ${ABUSE_WORKING_DAYS} أيام عمل من تلقيها${due ? ` — حتى ${hd(due, today, ar)}` : ""}.` : `Form a committee by decision and finish the confidential inquiry within ${ABUSE_WORKING_DAYS} working days${due ? ` — by ${hd(due, today, ar)}` : ""}.`),
    worker: {
      ifNot: ar ? "إن لم يُحقَّق فيها أو ضُررت بسببها: لك إبلاغ وزارة الموارد البشرية مباشرةً، ولا يمنعك الجزاء الداخلي." : "If not investigated, or you are harmed for it: report to the Ministry directly.",
      action: { kind: "href", href: "https://www.hrsd.gov.sa", external: true, label: ar ? "بلّغ الوزارة" : "Report to the Ministry" },
    },
    manager: {
      ifNot: clock?.over
        ? (ar ? "انقضت المهلة — تُسجَّل مخالفة، ولصاحبها اللجوء للوزارة." : "The window passed — a violation; the complainant may go to the Ministry.")
        : (ar ? "وإلا سُجّلت مخالفة على المنشأة ولصاحبها اللجوء للوزارة." : "Otherwise a violation, and the complainant may go to the Ministry."),
      action: ACT.open(ar, "/app/complaints", ar ? "افتح الشكوى" : "Open the case"),
    },
    due: closed ? "" : due,
  });
}

/* ══ safety (Arts. 121–123, 141–142 · Regs Art. 28) ═══════════════════════ */

/** A recorded work injury: first aid now; reported within a week (labour office) or 10 days (GOSI). */
export function injuryHint(incident, ctx = {}) {
  if (!incident) return null;
  const c = ctxOf(ctx);
  const { ar, today } = c;
  const at = dateOnly(incident.at || incident.date || incident.createdAt);
  const office = addDays(at, 7);
  const gosi = addDays(at, 10);
  return pack(c, {
    law: regs("28", ar),
    right: ar
      ? "علاجك على الشركة أو التأمينات، وأجرك أو بدله مكفول حتى الشفاء، وتُبلَّغ إصابتك رسمياً (المادة 133 · 141)."
      : "Treatment is on the company or GOSI, pay runs until recovery, and the injury is reported officially.",
    rightManager: ar
      ? `بلّغ عن الإصابة${at ? ` (${hd(at, today, ar)})` : ""} للتأمينات خلال عشرة أيام${gosi ? ` — حتى ${hd(gosi, today, ar)}` : ""}، أو لمكتب العمل خلال أسبوع${office ? ` — حتى ${hd(office, today, ar)}` : ""} إن لم تكن المنشأة في فرع الأخطار المهنية.`
      : `Report the injury to GOSI within ten days${gosi ? ` — by ${hd(gosi, today, ar)}` : ""}, or the labour office within a week${office ? ` — by ${hd(office, today, ar)}` : ""}.`,
    worker: {
      ifNot: ar ? "إن لم تُبلَّغ أو حُسم أجرك: تظلّم كتابةً خلال 30 يوماً، ولك مراجعة مكتب العمل." : "If not reported or your pay is cut: grieve within 30 days; you may go to the labour office.",
      action: ACT.grievance(ar),
    },
    manager: {
      ifNot: ar ? "وإلا تحمّلت المنشأة التعويض وسُجّلت مخالفة إبلاغ." : "Otherwise the establishment bears the compensation and a reporting violation.",
      action: ACT.open(ar, ctx.to || "", ar ? "افتح البلاغ" : "Open the report"),
    },
    due: office,
  });
}

/** A station's standing safety duties: hygiene, precautions/PPE, informing workers, first-aid cabinet. */
export function stationSafetyHint(station, ctx = {}) {
  const c = ctxOf(ctx);
  const { ar } = c;
  const name = String(station?.name || "").trim();
  return pack(c, {
    law: art("122", ar),
    right: ar
      ? "تُحاط بمخاطر عملك قبل مباشرته، وتُسلَّم وسائل الوقاية الشخصية وتُدرَّب عليها دون مقابل، وفي الموقع خزانة إسعافات أولية (المواد 122–123 · 142)."
      : "You are told the hazards before work, given PPE and training on it free, and the site keeps a first-aid cabinet.",
    rightManager: ar
      ? `في ${name || "الموقع"}: احتياطات الحماية من أخطار العمل والآلات، ووسائل الوقاية الشخصية مجاناً مع التدريب عليها، وإحاطة كل عامل بالمخاطر قبل المباشرة، وخزانة إسعافات (المواد 121–123 · 142).`
      : `At ${name || "the site"}: protection from work and machine hazards, free PPE with training, briefing every worker first, and a first-aid cabinet.`,
    worker: {
      ifNot: ar ? "إن لم تتوفر: لا تُلزم بتعليمات تعرّضك للخطر (المادة 65/1)، وارفع ذلك في صوت الموظف." : "If missing: you may refuse the unsafe work and raise it in Employee voice.",
      action: ACT.voice(ar),
    },
    manager: {
      ifNot: ar ? "وإلا سُجّلت مخالفة سلامة على المنشأة عند التفتيش." : "Otherwise a safety violation is recorded at inspection.",
      action: ACT.open(ar, ctx.to || "/app/safety", ar ? "افتح السلامة" : "Open safety"),
    },
  });
}

/** Builders registered on RIGHT_HINT_BUILDERS.disc (tests check coverage). */
export const DISC_HINT_BUILDERS = {
  disciplineCase: disciplineCaseHint,
  disciplineRule: disciplineRuleHint,
  contract: contractHint,
  fileAlert: fileAlertHint,
  training: trainingHint,
  medical: medicalExamHint,
  heldDocument: heldDocumentHint,
  serviceCertificate: serviceCertificateHint,
  abuseCase: abuseCaseHint,
  injury: injuryHint,
  stationSafety: stationSafetyHint,
};
