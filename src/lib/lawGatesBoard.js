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

function pillFromCheck(check, ar, { waitingWord = "waiting" } = {}) {
  if (!check) return { status: "void", who: "", detail: "" };
  if (check.ok) return { status: "settled", who: "", detail: "" };
  const who = firstNamesFromNote(check.note, ar);
  if (check.block) return { status: "blocked", who, detail: "" };
  return { status: waitingWord === "alert" ? "alert" : "waiting", who, detail: "" };
}

/** Heat / Decision 3337 panel model. */
export function buildHeatBanGatePanel({ gates, onDate, ar = true } = {}) {
  const win = heatBanWindow(onDate);
  const heat = checkById(gates, "heat_ban");
  const place = checkById(gates, "heat_place");
  const heatDue = heat && !heat.ok;
  const placeDue = place && !place.ok;

  return {
    id: "3337",
    title: ar ? "حظر العمل المكشوف — القرار الوزاري 3337" : "Open-sun ban — Decision 3337",
    season: {
      rangeAr: `${win.seasonAr} · شامل الطرفين`,
      rangeEn: `${win.seasonEn} · inclusive`,
      zodiacAr: "25 الجوزاء → نهاية 24 السنبلة · القرار 3337",
      zodiacEn: "25 Gemini → end of 24 Virgo · Decision 3337",
      window: `${win.startLabel}–${win.endLabel}`,
      noteAr: "الموسم ثابت في المنصة لا يملكه المدير. الفرع يختار فقط تصنيف مواقعه.",
      noteEn: "The season is fixed in the product. The station only classifies its sites.",
    },
    rows: [
      {
        id: "exposed",
        article: "3337",
        decision: "3337",
        status: heatDue ? "waiting" : (placeDue ? "alert" : "void"),
        pillLabel: heatDue
          ? (ar ? "داخل الحظر" : "Inside the ban")
          : (placeDue
            ? (ar ? "يحتاج تصنيفاً" : "Needs classification")
            : (ar ? "بلا أثر" : "No effect")),
        title: ar ? "مكشوف" : "Exposed",
        summary: ar
          ? `العمل تحت أشعة الشمس مباشرة أو في ساحة غير مغطّاة — يُمنع من ${win.startLabel} إلى ${win.endLabel} خلال الموسم. لا يُجبر العامل على العمل في النافذة.`
          : `Work under direct sun or in an uncovered yard — banned ${win.startLabel}–${win.endLabel} in season. A worker may not be compelled to work in the window.`,
      },
      {
        id: "shaded",
        article: "3337",
        decision: "3337",
        status: "void",
        pillLabel: ar ? "بلا أثر" : "No effect",
        title: ar ? "مظلّل / داخلي" : "Shaded / indoor",
        summary: ar
          ? "العمل داخل مبنى أو تحت مظلة تحجب الشمس — خارج نطاق القرار. وسم الميدان مكشوفاً أو داخلياً قبل الفحص."
          : "Indoor work or under a sun-blocking shade — outside the decision's scope. Mark the shift open-air or indoor before the check.",
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
  const facilities = checkById(gates, "night_facilities");
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

  const restPill = pillFromCheck(rest, ar);
  const pregPill = pillFromCheck(preg, ar);
  const rotatePill = pillFromCheck(rotate, ar);
  const compensatePill = pillFromCheck(compensate, ar);
  const performerPill = pillFromCheck(performer, ar);
  const medicalPill = pillFromCheck(medical, ar);
  const facilitiesPill = pillFromCheck(facilities, ar);
  const payPill = pillFromCheck(payEq, ar);

  return {
    id: "18632",
    title: ar ? "بوابات 18632 — الليل" : "Gates 18632 — night",
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
          ? `تعريف العامل الليلي — ${workerHours} ساعات فأكثر بين ${start}:00–${end}:00 · أي دقيقة داخل النافذة = يؤدي عملاً ليلياً`
          : `Night worker — ${workerHours}+ hours between ${start}:00–${end}:00 · any minute in the window performs night work`,
      },
      {
        id: "night_rest",
        article: "18632",
        decision: "18632",
        status: restPill.status,
        who: restPill.who,
        summary: ar
          ? `راحة ${restH} ساعة بين يومي عمل لمن أدّى عملاً ليلياً — ليست حصراً على العامل الليلي`
          : `${restH}-hour rest between work days for anyone who performed night work — not only night workers`,
        checkId: "night_rest",
      },
      {
        id: "night_performer_comp",
        article: "18632",
        decision: "18632",
        status: performer ? performerPill.status : "void",
        who: performerPill.who,
        pillLabel: !performer
          ? (ar ? "بلا أثر" : "No effect")
          : undefined,
        summary: ar
          ? `تعويض من يؤدي عملاً ليلياً — ساعات أو أجر أو مزايا مماثلة (بدل / نقل) داخل ${start}:00–${end}:00`
          : `Compensate anyone who performs night work — hours, pay, or similar benefits (allowance / transport) inside ${start}:00–${end}:00`,
        checkId: "night_performer_comp",
      },
      {
        id: "night_compensate",
        article: "18632",
        decision: "18632",
        status: compensate ? compensatePill.status : (nights > 0 ? "settled" : "void"),
        who: compensatePill.who,
        pillLabel: !compensate && nights === 0
          ? (ar ? "بلا أثر" : "No effect")
          : undefined,
        summary: ar
          ? "العامل الليلي: بدل مناسب أو تخفيض ساعات مع حفظ وزن الساعات العادية والأجر والمزايا — إلا الليلي العرضي"
          : "Night worker: suitable allowance or reduced hours with ordinary-hour weight, pay and benefits preserved — unless incidental",
        checkId: "night_compensate",
      },
      {
        id: "night_rotate",
        article: "18632",
        decision: "18632",
        status: rotatePill.status,
        who: rotatePill.who,
        summary: ar
          ? `تدوير بعد ${rotateMonths} أشهر كعامل ليلي — موافقة خطية محفوظة مع حق التراجع، أو شهر ساعات عادية على الأقل`
          : `Rotate after ${rotateMonths} months as a night worker — written consent on file with withdraw right, or at least one ordinary-hours month`,
        checkId: "night_rotate",
      },
      {
        id: "night_pregnancy",
        article: "18632",
        decision: "18632",
        status: pregPill.status,
        who: pregPill.who,
        summary: ar
          ? `حظر ليلي للحامل قبل الوضع بـ${pregWeeks} أسبوعاً على الأقل — مع عمل مناسب في الساعات المعتادة`
          : `Pregnancy night ban for at least ${pregWeeks} weeks before birth — with suitable ordinary-hours work`,
        checkId: "night_pregnancy",
      },
      {
        id: "night_medical",
        article: "18632",
        decision: "18632",
        status: medical ? medicalPill.status : (nights > 0 ? "settled" : "void"),
        who: medicalPill.who,
        pillLabel: !medical && nights === 0
          ? (ar ? "بلا أثر" : "No effect")
          : undefined,
        summary: ar
          ? "لياقة العامل الليلي — تقرير طبي قبل الإسناد وسنوياً وعند ظهور مشكلة صحية · للملف فقط وبموافقة"
          : "Night-worker fitness — medical report before assignment, yearly, and when health issues appear · on file only with consent",
        checkId: "night_medical",
      },
      {
        id: "night_facilities",
        article: "18632",
        decision: "18632",
        status: facilities ? facilitiesPill.status : "void",
        who: facilitiesPill.who,
        pillLabel: !facilities
          ? (ar ? "بلا أثر" : "No effect")
          : undefined,
        summary: ar
          ? "التزامات المنشأة لليل: إسعافات أولية · نقل طارئ · وصول لطعام — أعلام إعدادات لا وحدة عيادة"
          : "Night workplace duties: first aid · emergency transfer · food access — settings flags, not a clinic module",
        checkId: "night_facilities",
      },
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

/** Fifteen Labour Law checks — corrected article summaries from M/51 PDF. */
export function buildLabourLawGatePanel({ gates, company, onDate, ar = true } = {}) {
  const policy = hoursPolicyOf(company);
  const byId = (id) => checkById(gates, id);

  const hours48 = byId("hours_48");
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
      ...pillFromCheck(hours48, ar),
      status: hours48 ? statusFromWeekCheck(hours48) : "settled",
      who: pillFromCheck(hours48, ar).who,
      checkId: "hours_48",
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
        ? "الجمعة راحة أسبوعية · 24 ساعة متصلة · لا تُعوَّض نقداً"
        : "Friday weekly rest · 24 consecutive hours · not cash-compensated",
      ...pillFromCheck(weekly, ar),
      status: weekly ? statusFromWeekCheck(weekly) : "settled",
      who: pillFromCheck(weekly, ar).who,
      checkId: "weekly_rest",
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
      status: "void",
      pillLabel: ar ? "يُقرَّر في قسم الإضافي" : "Decided on the OT board",
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
        ? "إجازة الوضع 12 أسبوعاً — منها ستة وجوبية بعد الوضع"
        : "Maternity leave 12 weeks — six mandatory after birth",
      status: "void",
      pillLabel: ar ? "بلا أثر" : "No effect",
    },
    {
      article: "161",
      summary: ar
        ? "يحظر تشغيل الأحداث في الأعمال الخطرة أو الصناعات الضارة — بقرار من الوزير"
        : "Juveniles may not work in hazardous or harmful jobs — by Minister decision",
      status: "void",
      pillLabel: ar ? "بلا أثر" : "No effect",
    },
    {
      article: "162",
      summary: ar
        ? "لا تشغيل دون الخامسة عشرة · ويجوز 13–15 في أعمال خفيفة بقرار الوزير"
        : "No employment under 15 · ages 13–15 only in light work by Minister decision",
      ...(() => {
        const src = juvenileAge && !juvenileAge.ok ? juvenileAge : (juvenile && !juvenile.ok && /162|UNDER_AGE|دون/.test(`${juvenile.error || ""}${juvenile.note || ""}`) ? juvenile : null);
        if (src && !src.ok) return pillFromCheck(src, ar);
        // A passing juvenile check means the age floor was examined this week.
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
        if (juvenileNight || juvenile) return { status: "settled", who: "" };
        return { status: "void", who: "", pillLabel: ar ? "بلا أثر" : "No effect" };
      })(),
      checkId: juvenileNight?.id || "juvenile_night",
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
        if (juvenileHours || juvenile) return { status: "settled", who: "" };
        return { status: "void", who: "", pillLabel: ar ? "بلا أثر" : "No effect" };
      })(),
      checkId: juvenileHours?.id || "juvenile_hours",
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
