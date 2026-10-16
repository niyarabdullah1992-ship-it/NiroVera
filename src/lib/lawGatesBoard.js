/** Derive the three-panel law-gate board (3337 / 18632 / Labour Law) from live week gates.
 *  Pills show derived status only — no invented compliance.
 */

import {
  DECISION_3337_TEXT_AR,
  DECISION_3337_TEXT_EN,
  heatBanDecisionLabel,
} from "./heatBanDecision.js";
import { heatBanWindow } from "./contractLawDerivations.js";
import { hoursPolicyOf } from "./laborHoursPolicy.js";
import { ruleValue } from "./laborRules.js";
import { statusFromWeekCheck } from "./lawGateStatus.js";
import { NIGHT_WORK_RIGHTS } from "./nightWorkRights.js";

function checkById(gates, id) {
  return (gates?.checks || []).find((row) => row?.id === id) || null;
}

function firstNamesFromNote(note, ar) {
  const text = String(note || "");
  if (!text) return "";
  // Prefer the leading names before an em-dash / hyphen used in gate notes.
  const cut = text.split(/\s[—–-]\s/)[0] || text;
  const chunk = cut.replace(/يتجاوزون.*$/u, "").replace(/have no.*$/i, "").trim();
  if (chunk.length > 48) return "";
  if (/^(لا |No |Nobody|Everyone|كل )/i.test(chunk)) return "";
  return chunk;
}

const STATUS_RANK = { blocked: 0, alert: 1, waiting: 1, coming: 2, settled: 3, void: 4 };

/** Worst open check among several gates that share one article row; null when all are met or absent. */
function worstOpenCheck(...checks) {
  const open = checks.filter((check) => check && !check.ok);
  if (!open.length) return null;
  return open.sort((a, b) => (STATUS_RANK[statusFromWeekCheck(a)] ?? 9) - (STATUS_RANK[statusFromWeekCheck(b)] ?? 9))[0];
}

/** A check that ran but found nobody it applies to reads «لا ينطبق», never «استقرّ». */
function notApplicable(check) {
  return !check || check.applicable === false;
}

function voidPill(ar, label) {
  return { status: "void", who: "", detail: "", pillLabel: label || (ar ? "لا ينطبق هذا الأسبوع" : "Not this week") };
}

function pillFromCheck(check, ar, { waitingWord = "waiting" } = {}) {
  if (!check) return { status: "void", who: "", detail: "" };
  if (check.ok) return { status: "settled", who: "", detail: "" };
  const who = firstNamesFromNote(check.note, ar);
  if (check.block) return { status: "blocked", who, detail: "" };
  return { status: waitingWord === "alert" ? "alert" : "waiting", who, detail: "" };
}

/** «أحمد (الأحد، الاثنين)، سالم (الثلاثاء)» — per-person days from the week gate. */
function sunWhoLine(rows, ar) {
  const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (rows || []).map((row) => {
    const labels = (row.days || []).map((key) => (ar ? DAYS_AR : DAYS_EN)[new Date(`${key}T12:00:00`).getDay()]);
    return labels.length ? `${row.name} (${labels.join(ar ? "، " : ", ")})` : row.name;
  }).join(ar ? "، " : ", ");
}

/** Heat / Decision 3337 panel model — per person, per day (exposed / shaded on the roster cell). */
export function buildHeatBanGatePanel({ gates, onDate, ar = true } = {}) {
  const win = heatBanWindow(onDate);
  const heat = checkById(gates, "heat_ban");
  const place = checkById(gates, "heat_place");
  const heatDue = heat && !heat.ok;
  const placeDue = place && !place.ok;
  const counts = gates?.sunCounts || { field: 0, office: 0, unset: 0 };

  return {
    id: "3337",
    title: ar ? "حظر العمل المكشوف — القرار الوزاري 3337" : "Open-sun ban — Decision 3337",
    season: {
      rangeAr: `${win.seasonAr} · شامل الطرفين`,
      rangeEn: `${win.seasonEn} · inclusive`,
      zodiacAr: "25 الجوزاء → نهاية 24 السنبلة · القرار 3337",
      zodiacEn: "25 Gemini → end of 24 Virgo · Decision 3337",
      window: `${win.startLabel}–${win.endLabel}`,
      noteAr: "الموسم ثابت في المنصة لا يملكه المدير. التحديد مكشوف/مظلّل من خلية كل موظف في الجدول.",
      noteEn: "The season is fixed in the product. Field / office is marked on each person's roster cell.",
    },
    rows: [
      {
        id: "exposed",
        article: "3337",
        decision: "3337",
        status: heatDue ? "violation" : "void",
        pillLabel: heatDue ? (ar ? "مخالفة" : "Violation") : (ar ? "بلا أثر" : "No effect"),
        title: ar ? "مكشوف" : "Exposed",
        who: heatDue ? sunWhoLine(gates?.sunField, ar) : "",
        summary: ar
          ? `العمل تحت أشعة الشمس مباشرة أو في ساحة غير مغطّاة — يُمنع من ${win.startLabel} إلى ${win.endLabel} خلال الموسم. لا يُجبر العامل على العمل في النافذة.`
          : `Work under direct sun or in an uncovered yard — banned ${win.startLabel}–${win.endLabel} in season. A worker may not be compelled to work in the window.`,
      },
      {
        id: "unmarked",
        article: "3337",
        decision: "3337",
        status: placeDue ? "alert" : "void",
        pillLabel: placeDue ? (ar ? "يحتاج تحديداً" : "Needs a mark") : (ar ? "بلا أثر" : "No effect"),
        title: ar ? "يحتاج تحديد مكشوف/مظلّل" : "Needs a exposed / shaded mark",
        who: placeDue ? sunWhoLine(gates?.sunUnset, ar) : "",
        summary: ar
          ? `خلايا داخل الموسم تلمس النافذة بلا تحديد${counts.unset ? ` (${counts.unset})` : ""} — حدِّدها من خلية الموظف في الجدول.`
          : `In-season cells touching the window with no mark${counts.unset ? ` (${counts.unset})` : ""} — mark them on the person's roster cell.`,
      },
      {
        id: "shaded",
        article: "3337",
        decision: "3337",
        status: "void",
        pillLabel: ar ? "بلا أثر" : "No effect",
        title: ar ? "مظلّل / داخلي" : "Office / indoor",
        summary: ar
          ? "العمل داخل مبنى أو تحت مظلة تحجب الشمس — خارج نطاق القرار."
          : "Indoor work or under a sun-blocking shade — outside the decision's scope.",
      },
    ],
    quoteTitle: heatBanDecisionLabel(ar),
    quoteAr: DECISION_3337_TEXT_AR,
    quoteEn: DECISION_3337_TEXT_EN,
    quoteNoteAr: "النص لا يذكر أي فئة مستثناة، فالمنصة لا تقبل استثناءً. صادر على المادتين 122 و243، معدِّلاً القرار 1/1559.",
    quoteNoteEn: "The text names no exempt category, so the platform accepts none. Issued on Arts. 122 and 243, amending decision 1/1559.",
  };
}

/** Night / Decision 18632 panel — every 18632 publish gate, bucketed here only. */
export function buildNightGatePanel({ gates, onDate, ar = true } = {}) {
  const rest = checkById(gates, "night_rest");
  const preg = checkById(gates, "night_pregnancy");
  const rotate = checkById(gates, "night_rotate");
  const compensate = checkById(gates, "night_compensate");
  const performer = checkById(gates, "night_performer_comp");
  const medical = checkById(gates, "night_medical");
  const payEq = checkById(gates, "night_pay_equality");
  const consider = checkById(gates, "night_consideration");
  const workerHours = ruleValue("hours.night.workerHours", onDate) || 3;
  const start = String(ruleValue("hours.night.startHour", onDate) ?? 23).padStart(2, "0");
  const end = String(ruleValue("hours.night.endHour", onDate) ?? 6).padStart(2, "0");
  const restH = ruleValue("hours.night.restHours", onDate) || 12;
  const pregWeeks = ruleValue("hours.night.pregnancyBanWeeks", onDate) || 24;
  const rotateMonths = Math.round(((ruleValue("hours.night.rotateWeeks", onDate) || 13) / 4.33) * 10) / 10;
  const nights = Array.isArray(gates?.nightsThisWeek) ? gates.nightsThisWeek.length : 0;
  const performers = Array.isArray(gates?.performersThisWeek) ? gates.performersThisWeek : [];
  const sample = performers[0]?.name || "";
  /* The five employer obligations — one rule row each, derived in shiftWeek (nightObligationRows). */
  const obligationRows = Array.isArray(gates?.nightObligations) ? gates.nightObligations : [];

  const restPill = pillFromCheck(rest, ar);
  const pregPill = pillFromCheck(preg, ar);
  const rotatePill = pillFromCheck(rotate, ar);
  const compensatePill = pillFromCheck(compensate, ar);
  const performerPill = pillFromCheck(performer, ar);
  const medicalPill = pillFromCheck(medical, ar);
  const payPill = pillFromCheck(payEq, ar);

  const pillByGate = {
    night_rest: restPill,
    night_performer_comp: performerPill,
    night_compensate: compensatePill,
    night_rotate: rotatePill,
    night_pregnancy: pregPill,
    night_medical: medicalPill,
  };
  const checkByGate = {
    night_rest: rest,
    night_performer_comp: performer,
    night_compensate: compensate,
    night_rotate: rotate,
    night_pregnancy: preg,
    night_medical: medical,
  };
  const rightRows = NIGHT_WORK_RIGHTS.map((right) => {
    const check = checkByGate[right.gateId];
    const pill = pillByGate[right.gateId] || { status: "void", who: "" };
    const voidWhenIdle = right.gateId === "night_performer_comp" || right.gateId === "night_compensate" || right.gateId === "night_medical";
    const idle = voidWhenIdle && !check && nights === 0 && right.gateId !== "night_performer_comp";
    const performerIdle = right.gateId === "night_performer_comp" && !performer;
    let status = pill.status;
    if (right.gateId === "night_compensate" && !compensate) status = nights > 0 ? "settled" : "void";
    if (right.gateId === "night_medical" && !medical) status = nights > 0 ? "settled" : "void";
    if (performerIdle) status = "void";
    const summaryExtra = right.gateId === "night_rest"
      ? (ar
        ? `راحة ${restH} ساعة بين يومي عمل لمن أدّى عملاً ليلياً — ليست حصراً على العامل الليلي`
        : `${restH}-hour rest between work days for anyone who performed night work — not only night workers`)
      : right.gateId === "night_rotate"
        ? (ar
          ? `تدوير بعد ${rotateMonths} أشهر كعامل ليلي — موافقة خطية محفوظة مع حق التراجع، أو شهر ساعات عادية على الأقل`
          : `Rotate after ${rotateMonths} months as a night worker — written consent on file with withdraw right, or at least one ordinary-hours month`)
        : right.gateId === "night_pregnancy"
          ? (ar
            ? `حظر ليلي للحامل قبل الوضع بـ${pregWeeks} أسبوعاً على الأقل — مع عمل مناسب في الساعات المعتادة`
            : `Pregnancy night ban for at least ${pregWeeks} weeks before birth — with suitable ordinary-hours work`)
          : right.gateId === "night_performer_comp"
            ? (ar
              ? "تعويض ساعات أو أجر أو بدل أو نقل — لكل من يدخل النافذة ولو أقل من ثلاث ساعات"
              : "Compensate in hours, pay, allowance, or transport — anyone in the window, even under three hours")
            : right.gateId === "night_compensate"
              ? (ar
                ? "بدل مناسب أو تخفيض ساعات مع حفظ الأجر — للعامل الليلي إلا العرضي ورمضان"
                : "Suitable allowance or reduced hours with pay preserved — night worker unless incidental or Ramadan")
              : (ar ? `${right.ar} — ${right.hintAr}` : `${right.en} — ${right.hintEn}`);
    return {
      id: right.gateId,
      article: "18632",
      decision: "18632",
      status,
      who: pill.who,
      title: ar ? right.ar : right.en,
      inRequests: right.inRequests,
      performer: right.performer,
      worker: right.worker,
      performerNoteAr: right.performerNoteAr,
      performerNoteEn: right.performerNoteEn,
      pillLabel: (performerIdle || (idle && !check))
        ? (ar ? "بلا أثر" : "No effect")
        : undefined,
      summary: summaryExtra,
      checkId: right.gateId,
    };
  });

  return {
    id: "18632",
    title: ar ? "بوابات 18632 — الليل" : "Gates 18632 — night",
    windowAr: `الليل من الساعة ${Number(start)} إلى الساعة ${Number(end)}. المسائي من 15 إلى 23 خارج الليل.`,
    windowEn: `Night is ${start}:00 to ${end}:00. Evening 15:00–23:00 is outside night.`,
    performerAr: "يؤدي عملاً ليلياً: أي دقيقة داخل النافذة.",
    performerEn: "Performs night work: any minute in the window.",
    workerAr: `عامل ليلي: ${workerHours} ساعات فأكثر داخل النافذة.`,
    workerEn: `Night worker: ${workerHours}+ hours in the window.`,
    rows: [
      {
        id: "night_definition",
        article: "18632",
        decision: "18632",
        status: nights > 0 ? "settled" : "void",
        who: sample,
        detail: nights > 0 ? (ar ? `${nights} ليالٍ` : `${nights} nights`) : "",
        pillLabel: nights > 0
          ? (sample
            ? (ar ? `${sample} · ${nights} ليالٍ` : `${sample} · ${nights} nights`)
            : (ar ? `${nights} ليالٍ` : `${nights} nights`))
          : (ar ? "بلا أثر" : "No effect"),
        summary: ar
          ? `${workerHours} ساعات فأكثر بين ${start}:00 و${end}:00 = عامل ليلي · أي دقيقة = يؤدي عملاً ليلياً`
          : `${workerHours}+ hours between ${start}:00 and ${end}:00 = night worker · any minute performs night work`,
      },
      ...rightRows,
      ...obligationRows,
      {
        id: "night_pay_equality",
        article: "18632",
        decision: "18632",
        status: payEq ? (payEq.ok ? "settled" : "waiting") : "settled",
        who: payPill.who,
        summary: ar
          ? "لا تمييز في الأجر بسبب الليل (أ–ب من القرار) — ملاحظة تشغيلية على الملف، بلا تدقيق مسير"
          : "No pay discrimination because of night work (decision a–b) — operational file note, not a payroll audit",
        checkId: "night_pay_equality",
      },
      {
        id: "night_consideration",
        article: "18632",
        decision: "18632",
        status: "settled",
        who: firstNamesFromNote(consider?.note, ar),
        pillLabel: ar ? "ملاحظة" : "Note",
        summary: ar
          ? "يراعى قدر الإمكان كبار السن وذوو المسؤوليات العائلية عند الإسناد الليلي — ليست مانعاً"
          : "Older workers and those with family responsibilities are considered as far as possible — not a block",
        checkId: "night_consideration",
      },
    ],
  };
}

/** Labour Law article rows — corrected article summaries from M/51 PDF; void when nobody this week is in scope. */
export function buildLabourLawGatePanel({ gates, company, onDate, ar = true } = {}) {
  const policy = hoursPolicyOf(company);
  const byId = (id) => checkById(gates, id);

  const hours48 = byId("hours_48");
  const ramadan = byId("ramadan");
  const ramadanWeek = byId("ramadan_week_36");
  const weekly24 = byId("weekly_rest_24h");
  const weeklyFriday = byId("weekly_rest_friday");
  const juvenileDocs = byId("juvenile_docs");
  const overtime = byId("overtime_107");
  const postnatal = byId("maternity_postnatal");
  const nursing = byId("nursing_hour");
  const juvenileGap = byId("juvenile_night_gap");
  const juvenileHazard = byId("juvenile_hazard");
  const rest5 = byId("rest_5h");
  const workplace = byId("workplace");
  const weekly = byId("weekly_rest");
  const hours106 = byId("hours_106");
  const holiday = byId("official_holiday") || byId("eid_rest_compensate");
  const juvenile = byId("juvenile") || byId("juvenile_hours");
  const juvenileAge = byId("juvenile_age") || juvenile;
  const juvenileNight = byId("juvenile_night");
  const juvenileHours = byId("juvenile_hours") || juvenile;

  const rows = [
    {
      article: "98",
      summary: ar
        ? "8 ساعات يومياً أو 48 أسبوعياً · رمضان 6 / 36 — السقف حكمي: الزائد لا يُحفظ في الجدول"
        : "8h/day or 48h/week · Ramadan 6/36 — the cap is mandatory; excess is not kept on the roster",
      ...(() => {
        const open = worstOpenCheck(hours48, ramadan, ramadanWeek);
        if (open) return { ...pillFromCheck(open, ar), status: statusFromWeekCheck(open) };
        return { ...pillFromCheck(hours48, ar), status: hours48 ? statusFromWeekCheck(hours48) : "settled" };
      })(),
      checkId: worstOpenCheck(hours48, ramadan, ramadanWeek)?.id || "hours_48",
    },
    {
      article: "99",
      summary: ar
        ? "رفع إلى 9 ساعات أو تخفيض إلى 7 لفئات أو أعمال يحددها الوزير"
        : "Raise to 9h or reduce to 7h for categories or work the Minister specifies",
      status: policy.extendedNine || policy.hazardousHours ? "waiting" : "void",
      who: "",
      detail: "",
      pillLabel: policy.extendedNine || policy.hazardousHours
        ? (ar ? "مفعّل في إعداد الساعات" : "On in hours settings")
        : (ar ? "بلا أثر" : "No effect"),
    },
    {
      article: "100",
      summary: ar
        ? "التناوب بمتوسط ثلاثة أسابيع لا يتجاوز 8 / 48"
        : "Rotation averaged over three weeks must not exceed 8/48",
      status: policy.rotatingShifts ? "settled" : "void",
      pillLabel: policy.rotatingShifts ? (ar ? "استقرّ" : "Settled") : (ar ? "بلا أثر" : "No effect"),
    },
    {
      article: "101",
      summary: ar
        ? "لا خمس ساعات متصلة بلا راحة ≥ نصف ساعة · ولا بقاء فوق 12 ساعة"
        : "No five consecutive hours without ≥½h rest · presence max 12h",
      ...(() => {
        const bad = (rest5 && !rest5.ok) || (workplace && !workplace.ok);
        if (bad) {
          const src = rest5 && !rest5.ok ? rest5 : workplace;
          const p = pillFromCheck(src, ar, { waitingWord: "alert" });
          return { status: src.block ? "blocked" : "alert", who: p.who };
        }
        return { status: "settled", who: "" };
      })(),
      checkId: rest5 && !rest5.ok ? "rest_5h" : "workplace",
    },
    {
      article: "102",
      summary: ar
        ? "فترات الراحة خارج ساعات العمل الفعلية ولا إلزام بالبقاء"
        : "Rest periods are outside actual hours; no duty to remain at the workplace",
      status: "settled",
      pillLabel: ar ? "استقرّ" : "Settled",
    },
    {
      article: "103",
      summary: ar
        ? "استمرار العمل دون توقف لأسباب فنية أو طبيعة الإنتاج — بقرار الوزير · راحات بديلة تُحسب من ساعات العمل"
        : "Uninterrupted work for technical or production reasons — by Minister decision · alternative rests count as hours",
      status: policy.continuousWork103 ? "waiting" : "void",
      pillLabel: policy.continuousWork103
        ? (ar ? "مفعّل في إعداد الساعات" : "On in hours settings")
        : (ar ? "بلا أثر" : "No effect"),
    },
    {
      article: "104",
      summary: ar
        ? "يوم راحة أسبوعي · 24 ساعة متصلة · لا تُعوَّض نقداً · استبدال الجمعة بعد إبلاغ مكتب العمل مع تمكين أداء الواجبات الدينية"
        : "Weekly rest day · 24 consecutive hours · not cash-compensated · replacing Friday after notifying the labour office, with religious duties enabled",
      ...(() => {
        const open = worstOpenCheck(weekly, weekly24, weeklyFriday);
        if (open) return { ...pillFromCheck(open, ar), status: statusFromWeekCheck(open) };
        return { ...pillFromCheck(weekly, ar), status: weekly ? statusFromWeekCheck(weekly) : "settled" };
      })(),
      checkId: worstOpenCheck(weekly, weekly24, weeklyFriday)?.id || "weekly_rest",
    },
    {
      article: "105",
      summary: ar
        ? "تجميع الراحات حتى ثمانية أسابيع بموافقة العامل والوزارة في الأماكن النائية"
        : "Bank weekly rests up to eight weeks with worker and Ministry consent at remote sites",
      status: policy.remoteRestBank105 ? "waiting" : "void",
      pillLabel: policy.remoteRestBank105
        ? (ar ? "مفعّل" : "Enabled")
        : (ar ? "بلا أثر" : "No effect"),
    },
    {
      article: "106",
      summary: ar
        ? "حالات عدم التقيد — الجرد والمواسم والحادث الخطر · 30 يوماً سنوياً · سقف 10 / 60"
        : "Non-observance cases — inventory, seasons, dangerous accident · 30 days/year · cap 10/60",
      ...(() => {
        if (hours106 && !hours106.ok) return pillFromCheck(hours106, ar);
        return { status: "void", who: "", detail: "", pillLabel: ar ? "بلا أثر" : "No effect" };
      })(),
      checkId: "hours_106",
    },
    {
      article: "107",
      summary: ar
        ? "ساعات إضافية بأجر الساعة + 50% · ويجوز إجازة تعويضية بموافقة العامل (من 2025)"
        : "Overtime at hourly wage + 50% · compensatory leave with consent (from 2025)",
      ...(() => {
        if (overtime && !overtime.ok) return { ...pillFromCheck(overtime, ar), pillLabel: ar ? "إضافي مسمّى" : "Named overtime" };
        return voidPill(ar, overtime ? undefined : (ar ? "يُقرَّر في قسم الإضافي" : "Decided on the OT board"));
      })(),
      checkId: "overtime_107",
    },
    {
      article: "108",
      summary: ar
        ? "لا تسري 98 و101 على مناصب الإدارة العالية، والتجهيزي/التكميلي، والعمل المتقطع، والحراسة والنظافة (عدا الأمن المدني) — بحدود اللائحة"
        : "Arts 98 and 101 do not apply to senior management, prep/finishing, intermittent work, and guards/cleaning (except civil security) — within the Regulations",
      status: policy.hoursExempt108 ? "waiting" : "void",
      pillLabel: policy.hoursExempt108
        ? (ar ? "استثناء مسجّل" : "Exemption on file")
        : (ar ? "بلا أثر" : "No effect"),
    },
    {
      article: "112",
      summary: ar
        ? "إجازة بأجر كامل — إجازة عيد الفطر · إجازة عيد الأضحى · إجازة اليوم الوطني 23 سبتمبر · إجازة يوم التأسيس 22 فبراير"
        : "Full-pay leave — Eid al-Fitr leave · Eid al-Adha leave · National Day leave 23 Sep · Founding Day leave 22 Feb",
      ...(() => {
        if (!holiday) return { status: "void", who: "", pillLabel: ar ? "بلا أثر" : "No effect" };
        if (!holiday.ok) {
          const p = pillFromCheck(holiday, ar);
          return { status: "coming", who: p.who, pillLabel: ar ? "قادمة" : "Upcoming" };
        }
        // Leftover duty under locked holiday leave — publish still allowed, status must not read «استقرّ».
        if (holiday.ghostClash || (Array.isArray(gates?.holidayGhostClash) && gates.holidayGhostClash.length)) {
          const p = pillFromCheck({ ...holiday, ok: false, block: false }, ar);
          return { status: "waiting", who: p.who, pillLabel: ar ? "بقايا تعيين" : "Leftover duty" };
        }
        return { status: "settled", who: "" };
      })(),
      checkId: holiday?.id,
    },
    {
      article: "113",
      summary: ar
        ? "إجازة زواج أو وفاة الزوج/الأصول/الفروع خمسة أيام · وفاة الأخ/الأخت ثلاثة · ولادة مولود ثلاثة خلال سبعة أيام من الواقعة"
        : "Marriage or death of spouse/ascendants/descendants: five days · sibling death: three · childbirth: three within seven days of the event",
      status: "void",
      pillLabel: ar ? "بلا أثر" : "No effect",
    },
    {
      article: "115",
      summary: ar
        ? "إجازة امتحان بأيامه الفعلية · إشعار 15 يوماً · الوثائق المؤيدة"
        : "Exam leave for actual exam days · 15 days' notice · supporting documents",
      status: "void",
      pillLabel: ar ? "بلا أثر" : "No effect",
    },
    {
      article: "149",
      summary: ar
        ? "المادة 149 ملغاة في النسخة السارية (م/44) — لا يُستشهد بها لتشغيل النساء"
        : "Article 149 is repealed in the in-force text (M/44) — not a cite for women's employment",
      status: "void",
      pillLabel: ar ? "ملغاة" : "Repealed",
    },
    {
      article: "151",
      summary: ar
        ? "إجازة الوضع 12 أسبوعاً — منها ستة وجوبية بعد الوضع: لا دوام فيها"
        : "Maternity leave 12 weeks — six mandatory after birth: no duty in them",
      ...(() => {
        if (postnatal && !postnatal.ok) return pillFromCheck(postnatal, ar, { waitingWord: "alert" });
        if (notApplicable(postnatal)) return voidPill(ar);
        return { status: "settled", who: "" };
      })(),
      checkId: "maternity_postnatal",
    },
    {
      article: "154",
      summary: ar
        ? "فترة إرضاع لا تزيد على ساعة يومياً فوق راحات العمال — من ساعات العمل الفعلية وبلا تخفيض أجر"
        : "Nursing time of up to one hour a day on top of general rests — actual working time, no wage cut",
      ...(() => {
        if (notApplicable(nursing)) return voidPill(ar);
        return { status: "settled", who: firstNamesFromNote(nursing.note, ar) };
      })(),
      checkId: "nursing_hour",
    },
    {
      article: "161",
      summary: ar
        ? "يحظر تشغيل الأحداث في الأعمال الخطرة أو الصناعات الضارة — بقرار من الوزير"
        : "Juveniles may not work in hazardous or harmful jobs — by Minister decision",
      ...(() => {
        if (juvenileHazard && !juvenileHazard.ok) return pillFromCheck(juvenileHazard, ar, { waitingWord: "alert" });
        if (notApplicable(juvenileHazard)) return voidPill(ar);
        return { status: "settled", who: "" };
      })(),
      checkId: "juvenile_hazard",
    },
    {
      article: "162",
      summary: ar
        ? "لا تشغيل دون الخامسة عشرة · ويجوز 13–15 في أعمال خفيفة بقرار الوزير"
        : "No employment under 15 · ages 13–15 only in light work by Minister decision",
      ...(() => {
        const src = juvenileAge && !juvenileAge.ok ? juvenileAge : (juvenile && !juvenile.ok && /162|UNDER_AGE|دون/.test(`${juvenile.error || ""}${juvenile.note || ""}`) ? juvenile : null);
        if (src && !src.ok) return pillFromCheck(src, ar);
        // The age floor is only examined when a birth date is on file.
        if (juvenileAge && juvenileAge.applicable === false) {
          return voidPill(ar, ar ? "يحتاج تاريخ الميلاد" : "Needs a birth date");
        }
        if (juvenileAge || juvenile) return { status: "settled", who: "" };
        return { status: "void", who: "", pillLabel: ar ? "بلا أثر" : "No effect" };
      })(),
      checkId: juvenileAge?.id || juvenile?.id,
    },
    {
      article: "163",
      summary: ar
        ? "يحظر تشغيل الحدث أثناء فترة ليل لا تقل عن اثنتي عشرة ساعة متتالية إلا بقرار الوزير"
        : "A juvenile may not work during a night period of less than twelve consecutive hours except by Minister decision",
      ...(() => {
        if (juvenileNight && !juvenileNight.ok) return pillFromCheck(juvenileNight, ar);
        if (juvenile && !juvenile.ok && /163|NIGHT/.test(`${juvenile.error || ""}${juvenile.note || ""}`)) {
          return pillFromCheck(juvenile, ar);
        }
        if (juvenileGap && !juvenileGap.ok) return pillFromCheck(juvenileGap, ar, { waitingWord: "alert" });
        if (juvenileNight?.applicable === false) return voidPill(ar);
        if (juvenileNight || juvenile) return { status: "settled", who: "" };
        return { status: "void", who: "", pillLabel: ar ? "بلا أثر" : "No effect" };
      })(),
      checkId: juvenileNight && !juvenileNight.ok ? juvenileNight.id : (juvenileGap && !juvenileGap.ok ? juvenileGap.id : (juvenileNight?.id || "juvenile_night")),
    },
    {
      article: "164",
      summary: ar
        ? "تشغيل الحدث لا يزيد على 6 ساعات · رمضان 4 · لا أكثر من 4 متصلة · لا راحة/أعياد/سنوية · بلا استثناءات 106"
        : "Juvenile work max 6h · Ramadan 4 · no more than 4 consecutive · no rest/Eid/annual · no Art. 106 exceptions",
      ...(() => {
        if (juvenileHours && !juvenileHours.ok) return pillFromCheck(juvenileHours, ar);
        if (juvenile && !juvenile.ok && /164|DAY_CAP|STRETCH|PRESENCE|REST_BAN|NO_106/.test(`${juvenile.error || ""}${juvenile.note || ""}`)) {
          return pillFromCheck(juvenile, ar);
        }
        if (juvenileHours?.applicable === false) return voidPill(ar);
        if (juvenileHours || juvenile) return { status: "settled", who: "" };
        return { status: "void", who: "", pillLabel: ar ? "بلا أثر" : "No effect" };
      })(),
      checkId: juvenileHours?.id || "juvenile_hours",
    },
    {
      article: "165",
      summary: ar
        ? "قبل تشغيل الحدث: الهوية أو شهادة الميلاد، وشهادة لياقة صحية مصدّقة، وموافقة ولي الأمر في ملفه · والمادة 166: إبلاغ مكتب العمل خلال الأسبوع الأول"
        : "Before employing a juvenile: ID or birth certificate, a certified fitness certificate, and guardian consent on file · Art. 166: notify the labour office in the first week",
      ...(() => {
        if (!juvenileDocs || notApplicable(juvenileDocs)) return voidPill(ar);
        if (!juvenileDocs.ok) {
          const who = String(juvenileDocs.note || "").split(" — ")[0].split(" · ").map((part) => part.split(":")[0].trim()).filter(Boolean).join(ar ? "، " : ", ");
          return { ...pillFromCheck(juvenileDocs, ar), who, status: statusFromWeekCheck(juvenileDocs) };
        }
        return { status: "settled", who: "" };
      })(),
      checkId: "juvenile_docs",
    },
  ];

  const count = rows.length;
  return {
    id: "labour",
    title: ar ? `بوابات نظام العمل — ${count} فحصاً` : `Labour Law gates — ${count} checks`,
    footer: ar
      ? "نظام العمل الصادر بالمرسوم الملكي م/51. كل صف يُفحص على الأسبوع المعروض ويكتب أثره في سجل الموظف. ما يخص الليل أو حظر الشمس يبقى في لوحه."
      : "Labour Law issued by Royal Decree M/51. Each row is checked on the week shown and recorded on the employee file. Night and sun-ban duties stay on their own panels.",
    rows,
  };
}

export function buildLawGatesBoard(input = {}) {
  return {
    heat: buildHeatBanGatePanel(input),
    night: buildNightGatePanel(input),
    labour: buildLabourLawGatePanel(input),
  };
}
