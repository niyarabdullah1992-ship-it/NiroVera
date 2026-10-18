import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  checkWeekPublishGates,
  employeeShiftOnDay,
  employeeWeekHours,
  employeeWorkStationId,
  leaveOnDayView,
  sunExposureCellState,
  SUN_FIELD,
  SUN_OFFICE,
  weekDays,
  weekdayLabel,
} from "@/lib/shiftWeek";
import { heatBanWindow, isHeatBanDate } from "@/lib/contractLawDerivations";
import { ruleValue } from "@/lib/laborRules";
import { ordinaryDayCap, weekHoursCap } from "@/lib/laborHoursPolicy";
import { statusFromWeekCheck } from "@/lib/lawGateStatus";
import { buildLawGatesBoard } from "@/lib/lawGatesBoard";
import { flattenBoard } from "@/components/schedules/ScheduleCompliancePanel";
import { chipButton, mono, quietAction, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import MinistrySourceCards, {
  Counter,
  MINISTRY_SOURCE_KEYS,
  ministryBadgeStyle,
  ministryBadgeText,
  MinistryRow,
  MinistrySourceTabs,
  RegsSourceLine,
} from "@/components/schedules/MinistrySourceCards";

const RANK = { blocked: 0, violation: 0, alert: 1, waiting: 1, settled: 2, void: 3 };
const OPEN = new Set(["blocked", "violation", "waiting", "alert"]);
/** Article number shown on the badge for the less common Labour Law checks. */
const EXTRA_BADGE = { hours_106: "106", ramadan: "98", eid_rest_compensate: "112", juvenile: "162" };

function Num({ children }) {
  // A mono decimal point sits in a full cell and reads «7 . 5»; tighten it so 7.5 reads as one figure.
  const text = typeof children === "number" || typeof children === "string" ? String(children) : null;
  if (text && /^\d+\.\d+$/.test(text)) {
    const [whole, frac] = text.split(".");
    return <span dir="ltr" style={{ ...mono, unicodeBidi: "isolate", whiteSpace: "nowrap" }}>{whole}<span style={{ margin: "0 -0.28em" }}>.</span>{frac}</span>;
  }
  return <span dir="ltr" style={{ ...mono, unicodeBidi: "isolate" }}>{children}</span>;
}

function checksAr(n) {
  if (n === 1) return "فحص واحد";
  if (n === 2) return "فحصان";
  return <><Num>{n}</Num> {n <= 10 ? "فحوص" : "فحصاً"}</>;
}

function fmtHours(n) {
  return Number.isInteger(n) ? n : Number(Number(n).toFixed(1));
}

function pillFor(status, ar, voidLabel) {
  if (status === "blocked") return ar ? "مانع" : "Block";
  if (status === "violation") return ar ? "مخالفة" : "Violation";
  if (status === "waiting" || status === "alert") return ar ? "تنبيه" : "Alert";
  if (status === "settled") return ar ? "مستوفى" : "Settled";
  return voidLabel || (ar ? "لا ينطبق" : "Not applicable");
}

/** Worst of several week checks — presentation of existing statuses only. */
function worst(...checks) {
  const statuses = checks.filter(Boolean).map(statusFromWeekCheck);
  if (!statuses.length) return "void";
  return statuses.sort((a, b) => (RANK[a] ?? 9) - (RANK[b] ?? 9))[0];
}

function dayList(rows, ar) {
  return rows.map((row) => weekdayLabel(row.day.wd, ar)).join(ar ? "، " : ", ");
}

/**
 * «أنظمة الوزارة — ما يحميك هذا الأسبوع»
 * Read-only, one person. Statuses come from checkWeekPublishGates run on this employee alone,
 * so no other person's name or hours can reach the panel. No rule logic lives here —
 * it only words the existing checks in plain language and buckets them by source.
 * The panel is the overview of every applicable check — مانع / تنبيه / مستوفى — grouped by
 * source (18632 · 3337 · نظام العمل); «تنبيهاتي» keeps the action items.
 */
export default function MinistryPersonalPanel({
  employee,
  schedule,
  weekStart,
  station,
  company,
  laborCalendar,
  ar = true,
  own = true,
  alertsLabel,
  id,
  fileHref = "",
  showAllDefault = true,
}) {
  const [source, setSource] = useState("all");
  /** "all" — every check that applies, satisfied ones included; "open" — only مانع / تنبيه. */
  // Same as the management panel: open items first, satisfied checks folded under «عرض المستوفى».
  const [view, setView] = useState("open");
  void showAllDefault;
  const empId = employee?.id;
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const onDate = days[0]?.key;
  const firstName = String(employee?.name || "").trim().split(/\s+/)[0] || (ar ? "الموظف" : "the employee");

  const gates = useMemo(() => checkWeekPublishGates({
    schedule: schedule || { shiftTypes: [], assignments: {} },
    employees: employee ? [employee] : [],
    weekStart,
    stationId: schedule?.stationId || employeeWorkStationId(employee),
    station,
    settings: company?.settings,
    company,
    ar,
    laborCalendar,
  }), [schedule, employee, weekStart, station, company, ar, laborCalendar]);

  const dayRows = useMemo(() => days.map((day) => {
    const leave = employee ? leaveOnDayView(employee, day.key, ar, laborCalendar) : null;
    const shift = leave || !empId ? null : employeeShiftOnDay(schedule, empId, day.key);
    const sun = shift ? sunExposureCellState(schedule, empId, day.key, { shift }) : null;
    return { day, leave, shift, sun };
  }), [days, employee, empId, schedule, ar, laborCalendar]);

  const model = useMemo(() => {
    const check = (cid) => (gates?.checks || []).find((row) => row?.id === cid) || null;
    const isMe = (row) => String(row?.id) === String(empId);
    const nightWorker = (gates?.nightsThisWeek || []).some(isMe);
    const performs = nightWorker || (gates?.performersThisWeek || []).some(isMe);
    const rotated = (gates?.rotate || []).some((row) => isMe(row.employee));
    const you = own ? (ar ? "ك" : "your") : (ar ? "ه" : "their");
    const rows = [];
    const add = (row) => rows.push({ ...row, key: `${row.source}:${row.id}` });

    /* ---------- 18632 — night ---------- */
    const restH = ruleValue("hours.night.restHours", onDate) || 12;
    const startH = String(ruleValue("hours.night.startHour", onDate) ?? 23).padStart(2, "0");
    const endH = String(ruleValue("hours.night.endHour", onDate) ?? 6).padStart(2, "0");
    const workerHours = ruleValue("hours.night.workerHours", onDate) || 3;
    const rotateMonths = Math.round(((ruleValue("hours.night.rotateWeeks", onDate) || 13) / 4.33) * 10) / 10;
    const nightWin = ar ? <><Num>{`${startH}:00`}</Num> إلى <Num>{`${endH}:00`}</Num></> : <><Num>{`${startH}:00`}</Num>–<Num>{`${endH}:00`}</Num></>;
    if (!performs) {
      add({
        source: "18632",
        id: "none",
        status: "void",
        title: ar ? `لا عمل ليلي في أسبوع${you}` : `No night work in ${you} week`,
        note: ar
          ? <>الليل من {nightWin}. حقوق القرار — الراحة والتعويض والتدوير واللياقة — تسري متى دخلت الوردية هذه النافذة.</>
          : <>Night is {nightWin}. The decision&apos;s rights — rest, compensation, rotation, fitness — apply once a shift enters this window.</>,
      });
    } else {
      const rest = check("night_rest");
      const restStatus = statusFromWeekCheck(rest);
      add({
        source: "18632",
        id: "night_rest",
        status: restStatus,
        title: ar ? <>راحة <Num>{restH}</Num> ساعة بين يومَي الدوام</> : <><Num>{restH}</Num>-hour rest between duty days</>,
        note: OPEN.has(restStatus)
          ? (ar ? `فاصل أقصر من ${restH} ساعة في أسبوع${you} — يُعدَّل قبل النشر.` : `A gap under ${restH} hours this week — fixed before publish.`)
          : (ar ? `كل فاصل بين أيام دوام${you} المتتالية مستوفٍ.` : "Every gap between consecutive duty days is met."),
      });
      if (nightWorker) {
        const rotate = check("night_rotate");
        const rotateStatus = statusFromWeekCheck(rotate);
        add({
          source: "18632",
          id: "night_rotate",
          status: rotateStatus,
          title: ar ? <>التدوير بعد <Num>{rotateMonths}</Num> أشهر أو موافقة خطية</> : <>Rotation after <Num>{rotateMonths}</Num> months or written consent</>,
          note: OPEN.has(rotateStatus)
            ? (ar ? "بلغت مدة العمل الليلي المتصل — موافقة خطية مع حق التراجع، أو شهر بساعات عادية." : "The continuous night period is reached — written consent with withdraw right, or one ordinary-hours month.")
            : rotated
              ? (ar ? "تجاوز المدة بموافقة خطية محفوظة — ولها حق التراجع في أي وقت." : "Past the period with written consent on file — withdrawable at any time.")
              : (ar ? "لم تُبلغ مدة التدوير بعد." : "The rotation period is not reached yet."),
        });
      }
      const compId = nightWorker ? "night_compensate" : "night_performer_comp";
      const comp = check(compId);
      const compStatus = comp ? statusFromWeekCheck(comp) : "settled";
      add({
        source: "18632",
        id: compId,
        status: compStatus,
        title: ar ? "تعويض العمل الليلي" : "Night-work compensation",
        note: OPEN.has(compStatus)
          ? (ar ? "لا تعويض مسجّل بعد — تختاره الإدارة قبل النشر." : "No compensation recorded yet — management picks it before publish.")
          : nightWorker
            ? (ar ? "بدل مناسب أو تخفيض ساعات مع حفظ الأجر — مسجّل." : "A suitable allowance or reduced hours with pay kept — recorded.")
            : (ar ? "تعويض مسجّل (ساعات أو أجر أو بدل أو نقل)." : "Compensation recorded (hours, pay, allowance or transport)."),
      });
      if (nightWorker) {
        const medical = check("night_medical");
        const medStatus = medical ? statusFromWeekCheck(medical) : "settled";
        add({
          source: "18632",
          id: "night_medical",
          status: medStatus,
          title: ar ? "اللياقة الطبية للعمل الليلي" : "Medical fitness for night work",
          note: medStatus === "blocked"
            ? (ar ? "تقرير غير لائق — لا يستمر الإسناد الليلي." : "An unfit report — night assignment may not continue.")
            : OPEN.has(medStatus)
              ? (ar ? "لا تقرير لياقة محفوظ بتاريخ على الملف." : "No dated fitness report on the file.")
              : (ar ? "تقرير لياقة محفوظ على الملف — لا يُعرض للغير دون موافقة." : "A fitness report is on file — not shown to others without consent."),
        });
      }
      const preg = check("night_pregnancy");
      if (preg && !preg.ok) {
        add({ source: "18632", id: "night_pregnancy", status: statusFromWeekCheck(preg), title: preg.title, note: ar ? "إسناد ليلي داخل فترة حظر الحمل — يُستبدل بعمل في الساعات المعتادة." : "Night assignment inside the pregnancy ban — replaced by ordinary-hours work." });
      }
    }

    /* ---------- 3337 — open-sun ban ---------- */
    const win = heatBanWindow(onDate);
    const sunWin = ar ? <><Num>{win.startLabel}</Num> إلى <Num>{win.endLabel}</Num></> : <><Num>{win.startLabel}</Num>–<Num>{win.endLabel}</Num></>;
    const inSeason = days.some((day) => isHeatBanDate(day.key));
    if (!inSeason) {
      add({
        source: "3337",
        id: "season",
        status: "void",
        voidLabel: ar ? "خارج الموسم" : "Off season",
        title: ar ? "خارج موسم حظر العمل المكشوف" : "Outside the open-sun ban season",
        note: ar ? <>الموسم {win.seasonAr}، ويُمنع فيه العمل تحت الشمس من {sunWin}.</> : <>The season runs {win.seasonEn}; work under the sun is banned {sunWin}.</>,
      });
    } else {
      add({
        source: "3337",
        id: "season",
        status: "void",
        voidLabel: ar ? "ساري" : "In force",
        title: ar ? <>موسم الحظر ساري — لا عمل مكشوف من {sunWin}</> : <>Ban season in force — no exposed work {sunWin}</>,
        note: ar ? `${win.seasonAr} · لا يجوز الإجبار على العمل تحت الشمس في النافذة.` : `${win.seasonEn} · nobody may be compelled to work under the sun in the window.`,
      });
      const asked = dayRows.filter((row) => row.sun?.asks && row.sun?.inSeason);
      const field = asked.filter((row) => row.sun.live && row.sun.mark === SUN_FIELD);
      const unset = asked.filter((row) => row.sun.live && !row.sun.mark);
      const office = asked.filter((row) => row.sun.mark === SUN_OFFICE);
      if (field.length) {
        add({
          source: "3337",
          id: "field",
          status: statusFromWeekCheck(check("heat_ban")) === "settled" ? "alert" : statusFromWeekCheck(check("heat_ban")),
          title: ar ? `«مكشوف» يوم ${dayList(field, ar)}` : `Marked exposed on ${dayList(field, ar)}`,
          note: ar ? <>تُنقل الوردية خارج النافذة ({sunWin}) أو تُحدَّد «مظلّل» — {own ? "ولك أن ترفض" : "وله أن يرفض"}.</> : <>The shift moves out of {sunWin} or is marked shaded — refusal is a right.</>,
        });
      }
      if (unset.length) {
        add({
          source: "3337",
          id: "unset",
          status: "alert",
          title: ar ? `لم يُحدَّد مكشوف/مظلّل يوم ${dayList(unset, ar)}` : `Exposed / shaded not set on ${dayList(unset, ar)}`,
          note: ar ? "تحدّده الإدارة من خلية اليوم في الجدول، ويظهر على بطاقة اليوم." : "Management marks it on the day cell; it shows on the day card.",
        });
      }
      if (office.length) {
        add({
          source: "3337",
          id: "office",
          status: "settled",
          title: ar ? `«مظلّل» يوم ${dayList(office, ar)}` : `Shaded on ${dayList(office, ar)}`,
          note: ar ? "عمل داخلي أو تحت مظلة — خارج نطاق الحظر." : "Indoor or covered work — outside the ban.",
        });
      }
      if (!asked.length) {
        add({
          source: "3337",
          id: "clear",
          status: "settled",
          title: ar ? "لا وردية تمسّ نافذة الحظر" : "No shift touches the ban window",
          note: ar ? <>ورديات الأسبوع كلها خارج النافذة من {sunWin}.</> : <>Every shift this week sits outside {sunWin}.</>,
        });
      }
    }

    /* ---------- Labour Law ---------- */
    const capInfo = weekHoursCap(employee, company, days.map((day) => day.key), laborCalendar);
    const cap = Number.isFinite(capInfo.hours) ? capInfo.hours : ruleValue("hours.week.ordinaryMaxHours", onDate);
    const dayCap = ordinaryDayCap(employee, company, onDate, laborCalendar);
    const hours = empId ? employeeWeekHours(schedule, empId, weekStart, employee, laborCalendar) : 0;
    const shifts = dayRows.filter((row) => row.shift);
    const restDays = dayRows.filter((row) => !row.shift && !row.leave);
    const hoursStatus = statusFromWeekCheck(check("hours_48"));
    add({
      source: "labour",
      id: "hours_48",
      badge: "98",
      status: hoursStatus === "void" ? "settled" : hoursStatus,
      title: ar ? <>الساعات <Num>{fmtHours(hours)}</Num> من <Num>{cap}</Num> هذا الأسبوع</> : <><Num>{fmtHours(hours)}</Num> of <Num>{cap}</Num> hours this week</>,
      note: OPEN.has(hoursStatus)
        ? (ar ? "فوق الحد النظامي — الزائد لا يُحفظ، ويُعالج قبل النشر." : "Over the statutory cap — the excess is not kept and is fixed before publish.")
        : (ar ? <>ضمن الحد: <Num>{dayCap}</Num> ساعات يومياً أو <Num>{cap}</Num> أسبوعياً{capInfo.article ? ` (المادة ${capInfo.article})` : ""}.</> : <>Within the cap: <Num>{dayCap}</Num> hours a day or <Num>{cap}</Num> a week{capInfo.article ? ` (Art. ${capInfo.article})` : ""}.</>),
    });
    if (shifts.length) {
      const consec = ruleValue("hours.rest.maxConsecutiveHours", onDate) || 5;
      const restMin = ruleValue("hours.rest.duringShiftMinutes", onDate) || 30;
      const restStatus = worst(check("rest_5h"), check("workplace"));
      add({
        source: "labour",
        id: "rest_5h",
        badge: "101",
        status: restStatus === "void" ? "settled" : restStatus,
        title: ar ? <>راحة <Num>{restMin}</Num> دقيقة كل <Num>{consec}</Num> ساعات</> : <><Num>{restMin}</Num>-minute rest every <Num>{consec}</Num> hours</>,
        note: OPEN.has(restStatus)
          ? (ar ? "وردية تتجاوز الحد بلا راحة أو بقاء فوق 12 ساعة — تُعدَّل." : "A shift runs past the limit without rest, or presence exceeds 12h — it is fixed.")
          : (ar ? "كل وردية فيها راحة مقرّرة، والراحة ليست من ساعات العمل." : "Every shift carries a set rest, and rest is not working time."),
      });
    }
    const weeklyStatus = statusFromWeekCheck(check("weekly_rest"));
    add({
      source: "labour",
      id: "weekly_rest",
      badge: "104",
      status: weeklyStatus === "void" ? "settled" : weeklyStatus,
      title: ar ? "يوم راحة أسبوعي كامل" : "A full weekly rest day",
      note: OPEN.has(weeklyStatus)
        ? (ar ? "لا يوم راحة كاملاً في الأسبوع — يُعدَّل قبل النشر." : "No full rest day this week — fixed before publish.")
        : restDays.length
          ? (ar ? `الراحة: ${dayList(restDays, ar)} — لا تُستبدل بأجر.` : `Rest: ${dayList(restDays, ar)} — never replaced by pay.`)
          : (ar ? "مستوفى — لا تُستبدل الراحة بأجر." : "Met — rest is never replaced by pay."),
    });
    const holidays = dayRows.filter((row) => row.leave?.source === "official_holiday");
    const holidayCheck = check("official_holiday");
    if (holidays.length || (holidayCheck && !holidayCheck.ok)) {
      add({
        source: "labour",
        id: "official_holiday",
        badge: "112",
        status: holidayCheck && !holidayCheck.ok ? statusFromWeekCheck(holidayCheck) : "settled",
        title: holidays.length
          ? (ar ? `إجازة رسمية بأجر كامل: ${[...new Set(holidays.map((row) => row.leave.type))].join("، ")}` : `Paid official holiday: ${[...new Set(holidays.map((row) => row.leave.type))].join(", ")}`)
          : (ar ? "لا وردية في الإجازة الرسمية" : "No shift on an official holiday"),
        note: ar ? "العيد واليوم الوطني ويوم التأسيس مقفلة في الجدول." : "Eid, National Day and Founding Day are locked on the roster.",
      });
    }
    for (const cid of ["hours_106", "ramadan", "eid_rest_compensate", "juvenile"]) {
      const hit = check(cid);
      if (hit && !hit.ok) {
        add({
          source: "labour",
          id: cid,
          badge: EXTRA_BADGE[cid],
          status: statusFromWeekCheck(hit),
          title: hit.title,
          note: alertsLabel
            ? (ar ? `التفاصيل والإجراء في «${alertsLabel}».` : `Details and action in “${alertsLabel}”.`)
            : "",
        });
      }
    }

    /* Every other check the management board runs — the same catalogue, scored for this one person,
       so the employee reads all the ministry rules and whether each one is met for him. */
    const covered = new Set(rows.map((row) => row.id));
    const coveredTitles = new Set(rows.map((row) => (typeof row.title === "string" ? row.title : "")));
    const board = buildLawGatesBoard({ gates, company, onDate, ar });
    // The 18632 employer duties are the branch's, not this person's — kept apart as information.
    const obligations = [];
    for (const item of flattenBoard(board, gates, ar)) {
      if (item.obligationKey) {
        obligations.push({ key: `ob-${item.obligationKey}`, status: item.status === "coming" ? "waiting" : (item.status || "void"), title: item.title, clause: item.clause || "", voidLabel: item.pillLabel });
        continue;
      }
      if ((item.checkId && covered.has(item.checkId)) || coveredTitles.has(item.title)) continue;
      const status = item.status === "coming" ? "waiting" : (item.status || "void");
      add({
        source: item.source,
        id: `board-${item.key}`,
        badge: item.source === "labour" ? item.article : undefined,
        status,
        title: item.title,
        note: item.summary || item.detail || "",
        voidLabel: status === "void" ? (item.pillLabel || (ar ? "لا ينطبق هذا الأسبوع" : "Not this week")) : undefined,
      });
    }

    rows.sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9));
    return { rows, obligations, nightWorker, performs, inSeason, win, hours, cap, restCount: restDays.length };
  }, [gates, empId, own, ar, onDate, days, dayRows, schedule, weekStart, employee, laborCalendar, alertsLabel, company]);

  const countsFor = (src) => {
    const list = model.rows.filter((row) => src === "all" || row.source === src);
    const block = list.filter((row) => row.status === "blocked").length;
    const warn = list.filter((row) => row.status === "waiting" || row.status === "alert").length;
    const settled = list.filter((row) => row.status === "settled").length;
    const violation = list.filter((row) => row.status === "violation").length;
    const info = Math.max(0, list.length - block - warn - settled - violation);
    return { block, warn, settled, violation, info, tone: block || violation ? "bad" : warn ? "warn" : settled ? "ok" : "mute" };
  };

  const sunWin = ar ? <><Num>{model.win.startLabel}</Num> إلى <Num>{model.win.endLabel}</Num></> : <><Num>{model.win.startLabel}</Num>–<Num>{model.win.endLabel}</Num></>;
  const cards = [
    {
      key: "18632",
      title: ar ? "القرار 18632 — العمل الليلي" : "Decision 18632 — night work",
      scope: model.nightWorker
        ? (ar ? "عامل ليلي هذا الأسبوع — الراحة والتعويض والتدوير واللياقة تسري." : "A night worker this week — rest, compensation, rotation and fitness apply.")
        : model.performs
          ? (ar ? "عمل داخل نافذة الليل هذا الأسبوع — الراحة والتعويض يسريان." : "Work inside the night window this week — rest and compensation apply.")
          : (ar ? "لا ليل في هذا الأسبوع — الحقوق جاهزة متى دخلت الوردية الليل." : "No night this week — the rights apply once a shift enters night."),
    },
    {
      key: "3337",
      title: ar ? "القرار 3337 — حظر العمل المكشوف" : "Decision 3337 — open-sun ban",
      scope: model.inSeason
        ? (ar ? <>الموسم ساري — لا عمل تحت الشمس من {sunWin}، ومكشوف/مظلّل على كل يوم.</> : <>In season — no work under the sun {sunWin}; exposed / shaded per day.</>)
        : (ar ? `خارج الموسم — يسري ${model.win.seasonAr}.` : `Off season — runs ${model.win.seasonEn}.`),
    },
    {
      key: "labour",
      title: ar
        ? "نظام العمل — الساعات والراحة"
        : "Labour Law — hours and rest",
      scope: ar
        ? <><Num>{fmtHours(model.hours)}</Num> من <Num>{model.cap}</Num> ساعة · {model.restCount ? <><Num>{model.restCount}</Num> {model.restCount === 1 ? "يوم راحة" : "أيام راحة"}</> : "بلا يوم راحة"} · الراحة أثناء الوردية والعطل الرسمية.</>
        : <><Num>{fmtHours(model.hours)}</Num> of <Num>{model.cap}</Num> hours · <Num>{model.restCount}</Num> rest days · in-shift rest and official holidays.</>,
    },
  ].map((card) => ({ ...card, ...countsFor(card.key) }));

  const total = countsFor("all");
  const isOpen = (row) => OPEN.has(row.status);
  const sourceCounts = { all: model.rows.length };
  MINISTRY_SOURCE_KEYS.forEach((key) => { sourceCounts[key] = model.rows.filter((row) => row.source === key).length; });
  const groups = MINISTRY_SOURCE_KEYS
    .filter((key) => source === "all" || source === key)
    .map((key) => {
      const all = model.rows.filter((row) => row.source === key);
      return { key, card: cards.find((card) => card.key === key), all, rows: view === "open" ? all.filter(isOpen) : all };
    });

  const title = own
    ? (ar ? "أنظمة الوزارة — ما يخص دوامي" : "Ministry rules — my duty")
    : (ar ? `أنظمة الوزارة — ما يخص دوام ${firstName}` : `Ministry rules — ${firstName}'s duty`);
  const note = ar
    ? <>قراءة فقط · {checksAr(model.rows.length)} لهذا الأسبوع، المستوفى منها والمفتوح{alertsLabel ? ` — ما يحتاج إجراءً في «${alertsLabel}»` : ""}.</>
    : <>Read only · <Num>{model.rows.length}</Num> checks this week, settled and open{alertsLabel ? ` — action items sit in “${alertsLabel}”` : ""}.</>;
  const groupTally = (list) => {
    const parts = [];
    const n = (status) => list.filter((row) => (status === "warn" ? OPEN.has(row.status) && row.status !== "blocked" && row.status !== "violation" : row.status === status)).length;
    const block = n("blocked");
    const violation = n("violation");
    const warn = n("warn");
    const settled = n("settled");
    const other = list.length - block - violation - warn - settled;
    if (block + violation + warn) parts.push([block + violation + warn, ar ? "تنبيه" : "alert"]);
    if (settled) parts.push([settled, ar ? "مستوفٍ" : "met"]);
    if (other) parts.push([other, ar ? "للعلم" : "info"]);
    return parts;
  };

  return (
    <section
      id={id}
      data-ministry-personal="1"
      data-audience={own ? "employee" : "manager"}
      style={{ ...slab, display: "flex", flexDirection: "column" }}
    >
      <SectionHead
        title={title}
        note={note}
        trailing={(
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Counter value={total.block + total.violation + total.warn} label={ar ? "تنبيه" : "alert"} tone="warn" />
            <Counter value={total.settled} label={ar ? "مستوفٍ" : "met"} tone="ok" />
            <Counter value={total.info} label={ar ? "للعلم" : "reference"} tone="mute" />
          </div>
        )}
      />
      <div style={{ padding: "14px 18px 12px", display: "flex", flexDirection: "column", gap: 12, borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
        <MinistrySourceCards cards={cards} active={source} onPick={setSource} ar={ar} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
          <MinistrySourceTabs active={source} onPick={setSource} ar={ar} chipButton={chipButton} counts={sourceCounts} />
        </div>
      </div>
      <div data-ministry-personal-rows="1" data-view={view} style={{ display: "flex", flexDirection: "column" }}>
        {view === "open" && !groups.some((group) => group.rows.length) ? (
          <span style={{ padding: "14px 18px", fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.7, borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
            {ar
              ? (source === "all" ? "لا مانع ولا تنبيه عليك هذا الأسبوع. الفحوص المستوفاة في الأسفل." : `لا مانع ولا تنبيه من ${source === "labour" ? "نظام العمل" : source} عليك هذا الأسبوع.`)
              : "Nothing open for you this week. Settled checks are below."}
          </span>
        ) : null}
        {groups.filter((group) => view === "all" || group.rows.length).map((group) => (
          <div key={group.key} data-ministry-group={group.key} style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "9px 18px", background: "var(--nv-soft, #F6F8FA)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
              <span style={ministryBadgeStyle(group.key, ar)}>{ministryBadgeText(group.key, ar)}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.5, flex: "1 1 180px", minWidth: 0 }}>{group.card?.title}</span>
              <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "var(--nv-muted)" }}>
                {groupTally(group.all).map(([value, label]) => (
                  <span key={label} style={{ whiteSpace: "nowrap" }}><Num>{value}</Num> {label}</span>
                ))}
              </span>
            </div>
            {group.rows.length ? group.rows.map((row) => (
              <MinistryRow
                key={row.key}
                rowKey={row.key}
                source={row.source}
                badge={row.badge}
                status={row.status}
                pill={pillFor(row.status, ar, row.voidLabel)}
                title={row.title}
                note={row.note}
                ar={ar}
              />
            )) : (
              <span style={{ padding: "10px 18px", fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.7, borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
                {ar ? "لا شيء يحتاج متابعة في هذا المصدر — بقية فحوصه مستوفاة أو للعلم." : "Nothing open in this source — its other checks are settled or informational."}
              </span>
            )}
          </div>
        ))}
      </div>
      {(source === "all" || source === "18632") && (model.obligations || []).length ? (
        <div data-night-obligations-info="1" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "9px 18px", background: "var(--nv-soft, #F6F8FA)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
            <span style={ministryBadgeStyle("18632", ar)}>{ministryBadgeText("18632", ar)}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.5, flex: "1 1 180px", minWidth: 0 }}>
              {ar ? "التزامات المنشأة للعمل الليلي — للعلم" : "Employer duties for night work — for your information"}
            </span>
            <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "تُثبتها الإدارة" : "Proven by management"}</span>
          </div>
          {model.obligations.map((row) => (
            <MinistryRow
              key={row.key}
              rowKey={row.key}
              source="18632"
              status={row.status === "blocked" ? "alert" : row.status}
              pill={row.status === "blocked" || row.status === "alert"
                ? (ar ? "لم تُثبته المنشأة بعد" : "Not yet proven by the employer")
                : pillFor(row.status, ar, row.voidLabel)}
              title={row.clause ? `${row.title} — ${row.clause}` : row.title}
              ar={ar}
            />
          ))}
        </div>
      ) : null}
      <div style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
        <button
          type="button"
          data-ministry-fold="1"
          aria-expanded={view === "all"}
          onClick={() => setView(view === "all" ? "open" : "all")}
          style={quietAction({ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)" })}
        >
          {view === "all" ? (ar ? "إخفاء المستوفى" : "Hide settled") : (ar ? "عرض المستوفى" : "Show settled")}
          {" "}(<span dir="ltr" style={mono}>{model.rows.filter((row) => !OPEN.has(row.status) && (source === "all" || row.source === source)).length}</span>)
        </button>
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
          {ar ? "كل صف يُفحص على الأسبوع المعروض لك وحدك." : "Every row is checked on the week shown, for you alone."}
        </span>
      </div>
      <div style={{ padding: "10px 18px 12px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7, flex: "1 1 260px" }}>
          {ar
            ? "هذه أداة تشغيل تقرأ الجدول المعروض — لا فتوى قانونية. عند الخلاف يُرجع إلى النص الرسمي وإلى الموارد البشرية."
            : "An operating tool reading the roster shown — not a legal opinion. In a dispute, the official text and HR prevail."}
        </p>
        {fileHref ? (
          <Link to={fileHref} data-my-file-duty-link="panel" style={quietAction({ fontSize: 12, color: "var(--nv-ok-ink)" })}>
            {ar ? "افتح ملفي — الدوام وأنظمة الوزارة" : "Open my file — duty and ministry rules"}
          </Link>
        ) : null}
      </div>
      <RegsSourceLine ar={ar} />
    </section>
  );
}
