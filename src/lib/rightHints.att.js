/**
 * «حقك / التزامك» — attendance, duty and roster builders (area: att).
 *
 * Same shape as src/lib/rightHints.js: { view, word, right, ifNot, action, law, due }.
 * Every builder reads THIS item (minutes late, days absent, hours, dates) and answers:
 *   right  — «حقك:» (employee) / «التزامك:» (manager) — one plain sentence with the item's figures;
 *   ifNot  — «إن لم يُطبَّق:» — the worker's ready remedy, or the manager's consequence of delay;
 *   action — the flow it opens (a rights request with its kind, or the decision);
 *   law    — the article / regulation article / ministerial decision whose official text opens.
 *
 * Pure: no store, no React. Legal figures come from laborRules (ruleValue) where a rule row exists;
 * the Annex 1 lateness table and the Art. 80(7) absence lines are quoted below from the texts.
 * Does NOT import rightHints.js (that file registers this one) — tiny helpers are local.
 */
import { ruleValue } from "./laborRules.js";
import { regulationDate } from "./workRegulation.js";
import { GRIEVANCE_TYPE, NIGHT_AVOID_TYPE, rightsRouteFor } from "./rightsRequests.js";
import { heatBanWindow } from "./contractLawDerivations.js";
import { nursingRightUntil } from "./dutyRequests.js";
import { art108CategoryLabel, isJuvenile } from "./laborHoursPolicy.js";
import { hoursAr, sar } from "./otOffer.js";

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
function day(iso, today, ar) {
  const d = dateOnly(iso);
  if (!d) return "";
  const full = regulationDate(d, ar);
  return dateOnly(today).slice(0, 4) === d.slice(0, 4) ? full.replace(/\s\d{4}$/, "") : full;
}
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const rv = (id, onDate, fallback) => {
  try { return ruleValue(id, onDate); } catch { return fallback; }
};

/* ── law references (same shape RightHint/StatuteDialog read) ──────────── */
const art = (article, ar) => ({ article: String(article), label: ar ? `المادة ${article}` : `Art. ${article}` });
const dec = (id, ar) => ({ decisionId: String(id), label: ar ? `القرار ${id}` : `Decision ${id}` });
const regs = (n, ar) => ({ regs: String(n), label: ar ? `اللائحة م${n}` : `Regs Art. ${n}` });

/* ── ready flows ───────────────────────────────────────────────────────── */
const rightsTo = (kind) => rightsRouteFor(kind);
const ACT = {
  grievance: (ar) => ({ kind: "rights", rightsKind: GRIEVANCE_TYPE, to: rightsTo(GRIEVANCE_TYPE), label: ar ? "قدّم تظلماً" : "File a grievance" }),
  nightAvoid: (ar) => ({ kind: "rights", rightsKind: NIGHT_AVOID_TYPE, to: rightsTo(NIGHT_AVOID_TYPE), label: ar ? "اطلب تجنّب العمل الليلي" : "Ask to avoid night work" }),
  decide: (ar, to) => ({ kind: "decide", ...(to ? { to } : {}), label: ar ? "افتح القرار" : "Open the decision" }),
};

const nameOf = (c) => c.emp?.name || (c.ar ? "الموظف" : "the worker");

function pack(c, { right, rightManager, law, worker, manager, due, managerTo }) {
  const isManager = c.view === "manager";
  const workerTail = worker || {
    ifNot: c.ar ? "إن لم يُطبَّق: تظلّم كتابةً خلال 30 يوماً من علمك (النموذج الموحد م71)، ثم المحكمة العمالية." : "If not applied: grieve in writing within 30 days (Model regulation Art. 71), then the labour court.",
    action: ACT.grievance(c.ar),
  };
  const managerTail = {
    ifNot: manager || (c.ar ? "وإلا صار للموظف حق التظلم ثم المحكمة العمالية، ويُسجَّل التأخير في سجل التدقيق." : "Otherwise the worker may grieve, then go to the labour court; the delay is logged."),
    action: ACT.decide(c.ar, managerTo),
  };
  const tail = isManager ? managerTail : workerTail;
  return {
    view: isManager ? "manager" : "employee",
    word: c.ar ? (isManager ? "التزامك" : "حقك") : (isManager ? "Your duty" : "Your right"),
    right: isManager ? (rightManager || right) : right,
    ifNot: tail.ifNot,
    action: tail.action,
    law,
    due: isManager && due ? dateOnly(due) : "",
  };
}

/* ── Annex 1 (model work regulation) — «مخالفات تتعلق بمواعيد العمل» rows 1–7 ──
 * Steps by occurrence (1st…4th) inside the Art. 68 window. Numbers are % of the daily wage;
 * "warn" = written warning, "1d"/"2d"/"3d" = days' wage. Row 7 adds the wage of the late hours.
 */
export const LATENESS_TABLE = [
  { row: 1, upTo: 15, delays: false, steps: ["warn", 5, 10, 20] },
  { row: 2, upTo: 15, delays: true, steps: ["warn", 15, 25, 50] },
  { row: 3, upTo: 30, delays: false, steps: [10, 15, 25, 50] },
  { row: 4, upTo: 30, delays: true, steps: [25, 50, 75, "1d"] },
  { row: 5, upTo: 60, delays: false, steps: [25, 50, 75, "1d"] },
  { row: 6, upTo: 60, delays: true, steps: [30, 50, "1d", "2d"] },
  { row: 7, upTo: Infinity, delays: null, steps: ["warn", "1d", "2d", "3d"], plusLateWage: true },
];

/** The model-regulation step for one lateness: { row, step, isWarning, occurrence }. */
export function latenessStep(minutes, occurrence = 1, delaysOthers = false) {
  const m = num(minutes);
  if (m <= 0) return null;
  const row = LATENESS_TABLE.find((r) => m <= r.upTo && (r.delays == null || r.delays === !!delaysOthers));
  const occ = Math.min(4, Math.max(1, Math.round(num(occurrence) || 1)));
  const step = row.steps[occ - 1];
  return { row: row.row, step, isWarning: step === "warn", occurrence: occ, plusLateWage: !!row.plusLateWage };
}

export function latenessStepLabel(step, ar = true) {
  if (step === "warn") return ar ? "إنذار كتابي بلا حسم" : "a written warning, no deduction";
  if (typeof step === "number") return ar ? `حسم ${step}% من أجر يوم` : `a ${step}% deduction of a day's wage`;
  const d = Number(String(step).replace("d", ""));
  if (ar) return d === 1 ? "حسم أجر يوم" : d === 2 ? "حسم أجر يومين" : `حسم أجر ${d} أيام`;
  return `${d} day${d > 1 ? "s" : ""}' wage`;
}

const ORD_AR = ["الأولى", "الثانية", "الثالثة", "الرابعة"];
const ORD_EN = ["first", "second", "third", "fourth"];

/* ── Art. 80(7) absence lines ─────────────────────────────────────────── */
export const ABSENCE_LINES = { yearDays: 30, yearWarnDays: 20, streakDays: 15, streakWarnDays: 10 };

/** Where an absence count stands against Art. 80(7). */
export function absenceStanding(days = 0, streak = 0) {
  const d = num(days);
  const s = num(streak);
  const L = ABSENCE_LINES;
  if (d > L.yearDays || s > L.streakDays) return "over";
  if (d >= L.yearWarnDays || s >= L.streakWarnDays) return "warn";
  return "below";
}

/* ── builders ─────────────────────────────────────────────────────────── */
export const ATT_HINT_BUILDERS = {
  /** item: { date, minutes, occurrence?, delaysOthers?, excused? } */
  lateness(item, c) {
    const { ar, today } = c;
    const m = Math.round(num(item.minutes));
    const st = latenessStep(m, item.occurrence, item.delaysOthers) || latenessStep(1, 1, false);
    const when = day(item.date, today, ar);
    const known = item.occurrence != null;
    const ord = known
      ? (ar ? `المرة ${ORD_AR[st.occurrence - 1]}` : `${ORD_EN[st.occurrence - 1]} time`)
      : (ar ? "إن كانت الأولى خلال 180 يوماً" : "if the first in 180 days");
    const step = latenessStepLabel(st.step, ar);
    const charge = rv("discipline.charge.maxDays", today, 30);
    const late = ar
      ? `تأخر ${m} دقيقة${when ? ` في ${when}` : ""}`
      : `${m} min late${when ? ` on ${when}` : ""}`;
    if (item.excused) {
      return pack(c, {
        law: art("66", ar),
        right: ar ? `${late} بإذن أو عذر مقبول — لا جزاء عليه.` : `${late} with permission or an accepted excuse — no penalty.`,
      });
    }
    const tail = st.plusLateWage ? (ar ? "، إضافةً إلى أجر ساعات التأخر" : ", plus the late hours' wage") : "";
    return pack(c, {
      law: art("66", ar),
      right: ar
        ? `${late} — ${ord}: ${step}${tail} وفق جدول اللائحة (الملحق 1)${st.isWarning ? "؛ لا حسم قبل الإنذار" : ""}، ولا جزاء دون تحقيق كتابي.`
        : `${late} — ${ord}: ${step}${tail} per the regulation table (Annex 1)${st.isWarning ? "; no deduction before a warning" : ""}, and no penalty without a written inquiry.`,
      rightManager: ar
        ? `${nameOf(c)}: ${late} — ${ord}: ${step}${tail}، بعد تحقيق كتابي وسماع أقواله (المادة 71)، وخلال ${charge} يوماً من علمك (المادة 69).`
        : `${nameOf(c)}: ${late} — ${ord}: ${step}${tail}, after a written inquiry (Art. 71), within ${charge} days of learning of it (Art. 69).`,
      worker: {
        ifNot: ar ? "إن حُسم أكثر من الجدول أو قبل الإنذار: تظلّم كتابةً خلال 30 يوماً (النموذج الموحد م71)." : "If deducted beyond the table or before a warning: grieve within 30 days (Model regulation Art. 71).",
        action: ACT.grievance(ar),
      },
      manager: ar ? `بعد ${charge} يوماً لا يجوز توقيع الجزاء (المادة 69).` : `After ${charge} days the penalty may no longer be imposed (Art. 69).`,
      due: item.date ? addDays(item.date, charge) : "",
    });
  },

  /** item: { days, streak?, warned?, yearLabel? } — days absent without a legitimate reason in the contract year. */
  absence(item, c) {
    const { ar } = c;
    const d = Math.round(num(item.days));
    const s = Math.round(num(item.streak));
    const L = ABSENCE_LINES;
    const standing = absenceStanding(d, s);
    const fig = ar
      ? `غياب ${d} يوماً هذه السنة العقدية${s > 1 ? `، أطولها ${s} متتالية` : ""}`
      : `${d} absent day(s) this contract year${s > 1 ? `, longest run ${s}` : ""}`;
    const rule = ar
      ? `لا فصل بالمادة 80 إلا إن زاد على ${L.yearDays} يوماً أو ${L.streakDays} متتالية، وبعد إنذار كتابي عند ${L.yearWarnDays} يوماً (أو ${L.streakWarnDays} متتالية)`
      : `no Art. 80 dismissal unless over ${L.yearDays} days or ${L.streakDays} in a row, after a written warning at ${L.yearWarnDays} (or ${L.streakWarnDays} in a row)`;
    const warnNow = standing !== "below" && !item.warned;
    return pack(c, {
      law: art("80", ar),
      right: ar ? `${fig} — ${rule}.` : `${fig} — ${rule}.`,
      rightManager: ar
        ? (warnNow
          ? `${nameOf(c)}: ${fig} — بلغ حدّ الإنذار؛ وجّه إنذاراً كتابياً الآن، فلا فصل بالمادة 80 (7) دونه.`
          : `${nameOf(c)}: ${fig} — ${rule}.`)
        : (warnNow
          ? `${nameOf(c)}: ${fig} — the warning line is reached; send a written warning now, no Art. 80(7) dismissal without it.`
          : `${nameOf(c)}: ${fig} — ${rule}.`),
      worker: {
        ifNot: ar ? "إن فُصلت دون إنذار أو قبل الحدّ: فصل بلا سبب مشروع — لك التعويض (المادة 77) عبر المحكمة العمالية." : "If dismissed without the warning or below the line: unlawful — compensation (Art. 77) via the labour court.",
        action: ACT.grievance(ar),
      },
      manager: ar ? "الفصل دون الإنذار المسبق يجعله بلا سبب مشروع ويُلزم بالتعويض (المادة 77)." : "Dismissal without the prior warning is unlawful and owes compensation (Art. 77).",
    });
  },

  /** item: { date, hours, worked, yearHours?, hourWage?, basicHourWage?, consented? } */
  overtime(item, c) {
    const { ar, today } = c;
    const h = num(item.hours);
    const cap = rv("hours.ot.annualMaxHours", today, 720);
    const after = num(item.yearHours) + h;
    const overCap = after > cap;
    const pay = num(item.hourWage) && num(item.basicHourWage) ? h * (num(item.hourWage) + 0.5 * num(item.basicHourWage)) : 0;
    const when = day(item.date, today, ar);
    const hh = h ? (ar ? hoursAr(h) : `${h} h`) : (ar ? "ساعاتك الإضافية" : "Your overtime hours");
    const payTxt = pay ? (ar ? ` = ${sar(pay, ar)}` : ` = ${sar(pay, ar)}`) : "";
    const settle = rv("hours.settlement.windowDays", today, 45);
    if (overCap && !item.consented) {
      return pack(c, {
        law: regs("22", ar),
        right: ar
          ? `${hh}${when ? ` في ${when}` : ""} تتجاوز سقف ${cap} ساعة في السنة — لا تُضاف إلا بموافقتك أنت.`
          : `${hh}${when ? ` on ${when}` : ""} pass the ${cap}-hour annual cap — only with your own consent.`,
        rightManager: ar
          ? `${hh} لـ${nameOf(c)} تتجاوز سقف ${cap} ساعة — اطلب موافقته هو قبل الإسناد.`
          : `${hh} for ${nameOf(c)} pass the ${cap}-hour cap — ask the worker himself first.`,
        worker: {
          ifNot: ar ? "إن أُسندت دون موافقتك: لك رفضها والتظلم (النموذج الموحد م71)." : "If assigned without consent: refuse and grieve (Model regulation Art. 71).",
          action: ACT.grievance(ar),
        },
        manager: ar ? "إسنادها دون موافقته مخالفة للائحة م22." : "Assigning them without consent breaches Regs Art. 22.",
      });
    }
    if (!item.worked) {
      return pack(c, {
        law: art("107", ar),
        right: ar
          ? `${hh} مخططة${when ? ` في ${when}` : ""} — تُصرف بعد أن تُعمل ويثبتها الحضور: أجر الساعة + 50% من الأساسي، أو إجازة تعويضية بموافقتك.`
          : `${hh} planned${when ? ` on ${when}` : ""} — payable once worked and punched: hourly wage + 50% of basic, or comp leave with your consent.`,
      });
    }
    return pack(c, {
      law: art("107", ar),
      right: ar
        ? `${hh} عُملت${when ? ` في ${when}` : ""} — أجر الساعة + 50% من الأساسي${payTxt}، أو أيام تعويضية بموافقتك؛ ولا تُرفض ساعات عُملت.`
        : `${hh} worked${when ? ` on ${when}` : ""} — hourly wage + 50% of basic${payTxt}, or comp days with your consent; worked hours are never rejected.`,
      rightManager: ar
        ? `${hh} عملها ${nameOf(c)}${when ? ` في ${when}` : ""} — قرّر الصرف${payTxt} أو التعويض بموافقته؛ الرفض غير متاح.`
        : `${hh} worked by ${nameOf(c)}${when ? ` on ${when}` : ""} — decide pay${payTxt} or comp leave with consent; rejection is not available.`,
      manager: ar ? `وإلا تأخر أجره المستحق، وللعامل المطالبة به أمام المحكمة العمالية.` : "Otherwise his due wage is late and he may claim it at the labour court.",
      due: item.date ? addDays(item.date, settle) : "",
    });
  },

  /** item: { date, holidayName?, hours? } — Art. 107(3). */
  holidayWork(item, c) {
    const { ar, today } = c;
    const when = day(item.date, today, ar);
    const name = item.holidayName || (ar ? "العطلة" : "the holiday");
    const hh = num(item.hours) ? (ar ? hoursAr(num(item.hours)) : `${num(item.hours)} h`) : (ar ? "كل ساعاتك" : "all your hours");
    return pack(c, {
      law: art("107", ar),
      right: ar
        ? `عملك في ${name}${when ? ` (${when})` : ""}: ${hh} إضافية بأجرها (المادة 107/3)، والعطلة نفسها بأجر كامل.`
        : `Working on ${name}${when ? ` (${when})` : ""}: ${hh} are overtime (Art. 107(3)), and the holiday itself is fully paid.`,
      rightManager: ar
        ? `عمل ${nameOf(c)} في ${name}${when ? ` (${when})` : ""}: كل ساعاته إضافية تُصرف أو تُعوَّض بموافقته (المادة 107/3).`
        : `${nameOf(c)} working on ${name}${when ? ` (${when})` : ""}: every hour is overtime, paid or comp-leave with consent (Art. 107(3)).`,
    });
  },

  /** item: { date, stretchHours?, breakMinutes?, presenceHours? } — Arts 101/102. */
  rest(item, c) {
    const { ar, today } = c;
    const max = rv("hours.rest.maxConsecutiveHours", today, 5);
    const brk = rv("hours.rest.duringShiftMinutes", today, 30);
    const stay = rv("hours.workplace.maxHours", today, 12);
    const when = day(item.date, today, ar);
    const stretch = num(item.stretchHours);
    const fact = stretch > max
      ? (ar ? `وردية${when ? ` ${when}` : ""} فيها ${hoursAr(stretch)} متواصلة — ` : `Shift${when ? ` ${when}` : ""} has ${stretch} h in a row — `)
      : "";
    return pack(c, {
      law: art("101", ar),
      right: ar
        ? `${fact}لا تعمل أكثر من ${max} ساعات متتالية دون راحة ${brk} دقيقة على الأقل للصلاة والطعام، لا تُحسب من ساعات العمل، ولا يزيد بقاؤك في مكان العمل على ${stay} ساعة.`
        : `${fact}no more than ${max} h in a row without a ${brk}-min break for prayer and food, not counted as work; presence at work never above ${stay} h.`,
      rightManager: ar
        ? `${fact}أدرج راحة ${brk} دقيقة بعد كل ${max} ساعات متتالية لـ${nameOf(c)}، وبقاء لا يزيد على ${stay} ساعة.`
        : `${fact}schedule a ${brk}-min break after every ${max} h for ${nameOf(c)}, presence ≤ ${stay} h.`,
      manager: ar ? "وإلا خالف الجدول المادة 101 وتوقّف نشره." : "Otherwise the roster breaches Art. 101 and cannot be published.",
    });
  },

  /** item: { weekStart?, restDayLabel?, restHours? } — Art. 104. */
  weeklyRest(item, c) {
    const { ar, today } = c;
    const h = rv("hours.rest.weeklyHours", today, 24);
    const got = num(item.restHours);
    const short = got > 0 && got < h;
    const dayTxt = item.restDayLabel ? (ar ? ` — يوم راحتك ${item.restDayLabel}` : ` — your rest day is ${item.restDayLabel}`) : "";
    return pack(c, {
      law: art("104", ar),
      right: ar
        ? `راحة أسبوعية لا تقل عن ${h} ساعة متصلة بأجر كامل، ولا تُستبدل بمال${dayTxt}${short ? ` (هذا الأسبوع ${hoursAr(got)} فقط)` : ""}.`
        : `A weekly rest of at least ${h} continuous hours, fully paid, never bought out${dayTxt}${short ? ` (only ${got} h this week)` : ""}.`,
      rightManager: ar
        ? `امنح ${nameOf(c)} ${h} ساعة راحة متصلة بأجر كامل هذا الأسبوع${short ? ` — الجدول يعطيه ${hoursAr(got)} فقط` : ""}.`
        : `Give ${nameOf(c)} ${h} continuous paid rest hours this week${short ? ` — the roster gives only ${got} h` : ""}.`,
      manager: ar ? "والعمل في يوم الراحة ساعات إضافية كلها (المادة 107)." : "Work on the rest day is all overtime (Art. 107).",
    });
  },

  /** item: { date?, dayHours?, weekHours?, muslim? } — Art. 98 Ramadan. */
  ramadan(item, c) {
    const { ar, today } = c;
    const onDate = item.date || today;
    const dh = rv("hours.ramadan.ordinaryHours", onDate, 6);
    const wh = rv("hours.ramadan.weekMaxHours", onDate, 36);
    if (item.muslim === false) {
      return pack(c, {
        law: art("98", ar),
        right: ar ? "التخفيض الرمضاني للمسلمين؛ ساعاتك العادية قائمة، وما زاد عليها إضافي بأجره." : "The Ramadan cut is for Muslim workers; your ordinary hours stand, anything above is paid overtime.",
      });
    }
    const over = num(item.dayHours) > dh ? num(item.dayHours) - dh : 0;
    return pack(c, {
      law: art("98", ar),
      right: ar
        ? `في رمضان ساعاتك ${dh} يومياً أو ${wh} أسبوعياً${over ? ` — وردية ${hoursAr(num(item.dayHours))} فيها ${hoursAr(over)} إضافية` : ""}؛ وما زاد إضافي بأجره (المادة 107).`
        : `In Ramadan your hours are ${dh} a day or ${wh} a week${over ? ` — a ${num(item.dayHours)} h shift has ${over} h overtime` : ""}; anything above is paid overtime (Art. 107).`,
      rightManager: ar
        ? `ساعات ${nameOf(c)} في رمضان ${dh} يومياً أو ${wh} أسبوعياً${over ? ` — ${hoursAr(over)} زائدة تُحتسب إضافية` : ""}.`
        : `${nameOf(c)}'s Ramadan hours are ${dh} a day or ${wh} a week${over ? ` — ${over} h above count as overtime` : ""}.`,
    });
  },

  /** item: { date?, restHours?, nightWeeks?, consent?, medicalDue? } — Decision 18632. */
  night(item, c) {
    const { ar, today } = c;
    const start = rv("hours.night.startHour", today, 23);
    const end = rv("hours.night.endHour", today, 6);
    const rest = rv("hours.night.restHours", today, 12);
    const rot = rv("hours.night.rotateWeeks", today, 13);
    const win = `${String(start).padStart(2, "0")}:00–${String(end).padStart(2, "0")}:00`;
    const when = day(item.date, today, ar);
    let right;
    let rightManager;
    let worker;
    const restH = num(item.restHours);
    const weeks = num(item.nightWeeks);
    if ((restH && restH < rest) || item.focus === "rest") {
      right = ar
        ? `${restH ? `بين ورديتيك${when ? ` (${when})` : ""} ${hoursAr(restH)} فقط — ` : ""}لك راحة ${rest} ساعة على الأقل بين يومي دوام إذا دخل أحدهما الليل.`
        : `${restH ? `Only ${restH} h between your shifts${when ? ` (${when})` : ""} — ` : ""}you are owed at least ${rest} h between two duty days when one enters the night.`;
      rightManager = ar
        ? `أعطِ ${nameOf(c)} راحة ${rest} ساعة بعد الوردية الليلية${restH ? ` — المتاح ${hoursAr(restH)}` : ""}.`
        : `Give ${nameOf(c)} ${rest} h rest after the night shift${restH ? ` — only ${restH} h now` : ""}.`;
    } else if ((weeks >= rot && !item.consent) || item.focus === "rotate") {
      const wk = weeks ? (ar ? `${weeks} أسبوعاً ليلياً متصلاً — ` : `${weeks} night weeks in a row — `) : "";
      right = ar ? `${wk}بعد ${rot} أسبوعاً تُدوَّر لساعات عادية شهراً، إلا بموافقتك الخطية ولك التراجع.` : `${wk}after ${rot} weeks you rotate to day hours for a month, unless you consent in writing (revocable).`;
      rightManager = ar ? `دوّر ${nameOf(c)} لساعات عادية شهراً بعد ${rot} أسبوعاً ليلياً، أو احفظ موافقته الخطية.` : `Rotate ${nameOf(c)} to day hours for a month after ${rot} night weeks, or keep his written consent.`;
    } else if (item.medicalDue || item.focus === "medical") {
      right = ar ? "لك طلب تقرير طبي قبل الإسناد الليلي وسنوياً، ونقلك لعمل نهاري إن ثبت عدم لياقتك." : "You may get a medical report before night assignment and yearly, and a day transfer if found unfit.";
      rightManager = ar ? `حان التقرير الطبي السنوي لـ${nameOf(c)} في العمل الليلي.` : `${nameOf(c)}'s yearly night-work medical report is due.`;
      worker = { ifNot: ar ? "إن أثبت تقرير طبي حاجتك لتجنّب الليل: اطلب ذلك كتابةً." : "If a medical report says you should avoid nights: ask in writing.", action: ACT.nightAvoid(ar) };
    } else {
      right = ar
        ? `عملك الليلي (${win})${when ? ` في ${when}` : ""} يُعوَّض ببدل مناسب أو تخفيض ساعات، مع راحة ${rest} ساعة بين الورديتين وتدوير بعد ${rot} أسبوعاً.`
        : `Your night work (${win})${when ? ` on ${when}` : ""} earns an allowance or shorter hours, ${rest} h rest between shifts, rotation after ${rot} weeks.`;
      rightManager = ar
        ? `لـ${nameOf(c)} عن العمل الليلي: بدل أو تخفيض ساعات، وراحة ${rest} ساعة، وتدوير بعد ${rot} أسبوعاً، وتقرير طبي سنوي.`
        : `${nameOf(c)}'s night work: allowance or fewer hours, ${rest} h rest, rotation after ${rot} weeks, a yearly medical report.`;
    }
    return pack(c, { law: dec("18632", ar), right, rightManager, worker });
  },

  /** item: { date?, exposed? } — Decision 3337 (midday open-sun ban). */
  heat(item, c) {
    const { ar, today } = c;
    const w = heatBanWindow(item.date || today);
    const when = day(item.date, today, ar);
    const season = ar ? w.seasonAr : w.seasonEn;
    const exposed = item.exposed === true;
    return pack(c, {
      law: dec("3337", ar),
      right: ar
        ? `${exposed ? `ورديتك${when ? ` ${when}` : ""} في عمل مكشوف — ` : ""}لا تُشغَّل تحت الشمس من ${w.startLabel} إلى ${w.endLabel} ${season}.`
        : `${exposed ? `Your shift${when ? ` ${when}` : ""} is exposed work — ` : ""}no work under the sun ${w.startLabel}–${w.endLabel} ${season}.`,
      rightManager: ar
        ? `${exposed ? `${nameOf(c)} في عمل مكشوف${when ? ` ${when}` : ""} — ` : ""}أوقف العمل المكشوف من ${w.startLabel} إلى ${w.endLabel} ${season} أو انقله لمكان مظلّل.`
        : `${exposed ? `${nameOf(c)} on exposed work${when ? ` ${when}` : ""} — ` : ""}stop open-sun work ${w.startLabel}–${w.endLabel} ${season} or move to shade.`,
      worker: {
        ifNot: ar ? "إن كُلّفت بعمل مكشوف في هذه الساعات: لك أن ترفض وتبلّغ من «طلبات الدوام»." : "If assigned exposed work in these hours: you may refuse and report it from Duty requests.",
        action: { kind: "duty", to: "/app/complaints?channel=heat", label: ar ? "بلّغ عن عمل مكشوف" : "Report exposed work" },
      },
      manager: ar ? "وإلا عُدّ مخالفة للقرار 3337 تُرصد في تفتيش الوزارة." : "Otherwise it breaches Decision 3337 and shows on a ministry inspection.",
    });
  },

  /** item: { birthDate, nurseryOnSite?, date? } — Art. 154 / Regs Art. 31. */
  nursing(item, c) {
    const { ar, today } = c;
    const mins = rv("leave.nursing.dailyMinutes", today, 60);
    const until = nursingRightUntil(item.birthDate);
    const untilTxt = until ? day(until, today, ar) : "";
    const how = item.nurseryOnSite
      ? (ar ? "تقسّمينها فترات" : "split into periods")
      : (ar ? "أول الدوام أو آخره" : "at the start or end of the shift");
    return pack(c, {
      law: art("154", ar),
      right: ar
        ? `لك ${mins} دقيقة رضاعة يومياً${untilTxt ? ` حتى ${untilTxt}` : ""}، ${how} (اللائحة م31)، تُحسب من ساعات العمل ولا تُنقص أجرك.`
        : `You have ${mins} nursing minutes a day${untilTxt ? ` until ${untilTxt}` : ""}, ${how} (Regs Art. 31), counted as work with no wage cut.`,
      rightManager: ar
        ? `ساعة رضاعة ${nameOf(c)}${untilTxt ? ` حتى ${untilTxt}` : ""} من ساعات العمل الفعلية — لا تأخر ولا انصراف مبكر ولا حسم.`
        : `${nameOf(c)}'s nursing hour${untilTxt ? ` until ${untilTxt}` : ""} counts as work — not lateness, not early leave, no deduction.`,
    });
  },

  /** item: { employee?, date? } — Arts 161–166. */
  juvenile(item, c) {
    const { ar, today } = c;
    const onDate = item.date || today;
    const dh = rv("hours.juvenile.ordinaryHours", onDate, 6);
    const rh = rv("hours.juvenile.ramadanHours", onDate, 4);
    const st = rv("hours.juvenile.maxStretchHours", onDate, 4);
    const pr = rv("hours.juvenile.maxPresenceHours", onDate, 7);
    const nb = rv("hours.juvenile.nightBanHours", onDate, 12);
    const who = item.employee || c.emp;
    const flagged = who ? isJuvenile(who, onDate) : true;
    if (!flagged) return null;
    return pack(c, {
      law: art("164", ar),
      right: ar
        ? `أقل من 18: لا تتجاوز ${dh} ساعات يومياً (${rh} في رمضان)، ولا ${st} متواصلة دون راحة، ولا بقاء فوق ${pr}، ولا عمل ليلي (${nb} ساعة) ولا إضافي ولا في الراحة أو الأعياد.`
        : `Under 18: at most ${dh} h a day (${rh} in Ramadan), ${st} h in a row, ${pr} h presence, no night (${nb} h), no overtime, no rest days or Eids.`,
      rightManager: ar
        ? `${nameOf(c)} حدث: ${dh} ساعات يومياً (${rh} في رمضان)، ${st} متواصلة كحد، بقاء ${pr}، ولا ليل ولا إضافي ولا أعمال خطرة (المواد 161–166).`
        : `${nameOf(c)} is a juvenile: ${dh} h a day (${rh} Ramadan), ${st} h stretch, ${pr} h presence, no night, overtime or hazardous work (Arts 161–166).`,
      manager: ar ? "وإلا امتنع نشر الجدول، والمخالفة تعرّض المنشأة للعقوبة." : "Otherwise the roster cannot publish and the company is exposed to penalties.",
    });
  },

  /** item: { category } — Art. 108 categories (Regs Art. 23). */
  art108(item, c) {
    const { ar } = c;
    const label = art108CategoryLabel(item.category, ar);
    if (!label) return null;
    return pack(c, {
      law: art("108", ar),
      right: ar
        ? `فئتك «${label}» — لا تسري عليك المادتان 98 و101 بسقوف اللائحة م23، لكن راحتك الأسبوعية (المادة 104) والإضافي فوق السقف قائمان.`
        : `Your category “${label}” — Arts 98 and 101 give way to Regs Art. 23 ceilings, but weekly rest (Art. 104) and overtime above the ceiling stand.`,
      rightManager: ar
        ? `${nameOf(c)} ضمن «${label}» — سقوف اللائحة م23 بدل 98/101، والراحة الأسبوعية لا تُرفع.`
        : `${nameOf(c)} is “${label}” — Regs Art. 23 ceilings replace 98/101; weekly rest is never lifted.`,
    });
  },

  /** item: { weekStart, publishedAt?, changedAfterPublish? } — Art. 17 posting of hours. */
  roster(item, c) {
    const { ar, today } = c;
    const wk = day(item.weekStart, today, ar);
    const pub = day(item.publishedAt, today, ar);
    const isPub = !!(pub || item.published);
    return pack(c, {
      law: art("17", ar),
      right: ar
        ? `جدول أسبوع ${wk}${pub ? ` منشور منذ ${pub}` : isPub ? " منشور" : " لم يُنشر بعد"} — تُعلن مواعيد العمل والراحة ويوم الراحة والنوبات في مكان ظاهر قبل العمل بها.`
        : `Week of ${wk}${pub ? ` published ${pub}` : isPub ? " published" : " not yet published"} — hours, breaks, the rest day and shifts are posted visibly before they apply.`,
      rightManager: ar
        ? `انشر جدول أسبوع ${wk} قبل بدايته${item.changedAfterPublish ? "، وأعد نشره بعد التعديل" : ""} — إعلان المواعيد والراحة والنوبات واجب.`
        : `Publish the week of ${wk} before it starts${item.changedAfterPublish ? ", and republish after the change" : ""} — posting hours, rest and shifts is required.`,
      manager: ar ? "وإلا خالفت المادة 17، ولم يعرف العامل مواعيده قبل العمل بها." : "Otherwise Art. 17 is breached and the worker learns his hours too late.",
      due: isPub ? "" : item.weekStart,
    });
  },
};

/** item: { date?, dayHours?, weekHours?, basis? } — Art. 98 ordinary hours; above them is overtime. */
ATT_HINT_BUILDERS.hours = function hours(item, c) {
  const { ar, today } = c;
  const onDate = item.date || today;
  const dh = rv("hours.shift.ordinaryHours", onDate, 8);
  const wh = rv("hours.week.ordinaryMaxHours", onDate, 48);
  const week = num(item.weekHours);
  const over = week > wh ? Math.round((week - wh) * 100) / 100 : 0;
  const fig = week ? (ar ? `أسبوعك ${hoursAr(week)}` : `Your week is ${week} h`) : "";
  return pack(c, {
    law: art("98", ar),
    right: ar
      ? `${fig ? `${fig} — ` : ""}ساعاتك العادية ${dh} يومياً أو ${wh} أسبوعياً${over ? `، والزائد ${hoursAr(over)} إضافية بأجرها` : "، وما زاد إضافي بأجره"} (المادة 107).`
      : `${fig ? `${fig} — ` : ""}ordinary hours are ${dh} a day or ${wh} a week${over ? `; the extra ${over} h are paid overtime` : "; anything above is paid overtime"} (Art. 107).`,
    rightManager: ar
      ? `${fig ? `${nameOf(c)}: ${hoursAr(week)} — ` : ""}الحد العادي ${dh} يومياً أو ${wh} أسبوعياً${over ? `؛ ${hoursAr(over)} تُقرَّر إضافياً` : ""}.`
      : `${fig ? `${nameOf(c)}: ${week} h — ` : ""}the ordinary line is ${dh} a day or ${wh} a week${over ? `; ${over} h go to an overtime decision` : ""}.`,
  });
};

/** Fallback for a cited rule with no dedicated builder: item { article|regs|decisionId, text, textEn }. */
ATT_HINT_BUILDERS.rule = function rule(item, c) {
  const { ar } = c;
  const law = item.decisionId ? dec(item.decisionId, ar) : item.regs ? regs(item.regs, ar) : item.article ? art(item.article, ar) : null;
  const text = ar ? item.text : (item.textEn || item.text);
  if (!law || !text) return null;
  return pack(c, { law, right: text });
};

/** Kinds the attendance / roster surfaces ask for. */
export const ATT_HINT_KINDS = Object.keys(ATT_HINT_BUILDERS);

/**
 * One hint for one attendance/duty/roster item.
 * ctx: { view: "employee"|"manager", today, ar|lang, employee }.
 */
export function attRightHint(kind, item = {}, ctx = {}) {
  const fn = ATT_HINT_BUILDERS[kind];
  if (!fn) return null;
  const ar = ctx.ar ?? (ctx.lang ? ctx.lang === "ar" : true);
  const today = dateOnly(ctx.today) || new Date().toISOString().slice(0, 10);
  const c = { ...ctx, ar, today, view: ctx.view === "manager" ? "manager" : "employee", emp: ctx.employee || item.employee || null };
  return fn(item || {}, c) || null;
}

/** Which builder answers a roster/publish check (ids from shiftDerivations / rosterLawGates). */
export function attHintKindForCheck(check = {}) {
  const id = String(check.id || "");
  const a = String(check.article || "");
  if (id.startsWith("night_")) {
    const focus = id === "night_rest" ? "rest" : id === "night_rotate" ? "rotate" : id.startsWith("night_medical") ? "medical" : "";
    return { kind: "night", item: { focus } };
  }
  if (id.startsWith("heat_") || a === "3337") return { kind: "heat", item: {} };
  if (id.startsWith("juvenile_") || ["161", "162", "163", "164", "165", "166"].includes(a)) return { kind: "juvenile", item: {} };
  if (id === "hours_ramadan") return { kind: "ramadan", item: {} };
  if (id === "rest_5h" || id === "workplace_hours" || a === "101") return { kind: "rest", item: {} };
  if (id === "weekly_rest" || a === "104") return { kind: "weeklyRest", item: {} };
  if (id === "hours_48" || a === "98") return { kind: "hours", item: {} };
  if (a === "112") return { kind: "holidayWork", item: {} };
  if (a) return { kind: "rule", item: { article: a, text: check.noteAr || check.labelAr, textEn: check.noteEn || check.labelEn } };
  return null;
}

/** One hint for one roster/publish check row — null when the check names no rule. */
export function attHintForCheck(check, ctx = {}) {
  const m = attHintKindForCheck(check);
  return m ? attRightHint(m.kind, m.item, ctx) : null;
}
