/**
 * «أنظمة الوزارة — ما يخص البصمة» — the attendance rows for ministrySections («attendance»).
 * Pure: reads the person's (or the scope's) own data — closed days this week, today's breaches,
 * this year's overtime, the roster's rest days, the hours policy — and gives each rule a status:
 *   settled (مستوفٍ) · alert (تنبيه) · void (للعلم). Articles and figures from laborRules.
 * Night (18632) is for reference on the employee lane and an obligation on management; official
 * holidays are folded into the overtime row (all of it overtime), never a row of their own.
 */
import { citeRule, explainRule, isRamadanDay, isRamadanHoursSubject, ruleValue } from "./laborRules.js";
import { hoursPolicyOf, ordinaryWeekCap } from "./laborHoursPolicy.js";
import { dayOvertimeFor } from "./autoOvertime.js";
import { isHeatBanDate, heatBanWindow } from "./contractLawDerivations.js";
import { HEAT_BAN_DECISION } from "./heatBanDecision.js";
import { isNightWorker } from "./decision18632.js";
import { employeeShiftOnDay, weekDateKeys, weekRestDayCount } from "./shiftWeek.js";
import { laborCalendarOf } from "./ummAlQuraCalendar.js";
import { nursingHourOn } from "./dutyRequests.js";
import { profileGender } from "./employeeProfileFields.js";
import { formatDate } from "./dateFormat.js";

const T = (ar, a, e) => (ar ? a : e);
const hours1 = (minutes) => Math.round((Math.max(0, Number(minutes) || 0) / 60) * 10) / 10;
const fmtH = (h) => (Number.isInteger(h) ? String(h) : h.toFixed(1));

function badgeOf(ruleId, ar, onDate, extra = "") {
  const cite = citeRule(ruleId, onDate);
  const art = cite ? cite.article : "";
  return ar ? `م ${art}${extra}` : `Art. ${art}${extra}`;
}

function scheduleOf(d, employee, dayKey) {
  const own = String(employee?.profile?.workStationId || employee?.stationId || "");
  const list = [...(d?.schedules || [])].sort((a, b) => (String(b.stationId) === own) - (String(a.stationId) === own));
  return list.find((schedule) => weekDateKeys(dayKey).some((key) => employeeShiftOnDay(schedule, employee.id, key))) || null;
}

function closedRows(d, employeeId, keys) {
  return (d?.personalAttendance || []).filter((row) => String(row.employeeId ?? row.employee_id) === String(employeeId)
    && keys.includes(String(row.date || row.dateKey || "").slice(0, 10))
    && (row.checkInAt || row.check_in_at) && (row.checkOutAt || row.check_out_at));
}

/**
 * One person's attendance facts on `today`: worked this week (closed days), the week cap, Art. 101 /
 * 106 breaches this week, rest days on the roster, this year's overtime (decided + open), a pending
 * cap consent, night duty this week, exposed today.
 */
export function attendanceFactsOf(d, employeeGiven, today) {
  const employee = employeeGiven?.id ? employeeGiven : { id: "", ...(employeeGiven || {}) };
  const day = String(today || "").slice(0, 10);
  const calendar = laborCalendarOf(d);
  const keys = weekDateKeys(day).filter((key) => key <= day);
  const rows = employee.id ? closedRows(d, employee.id, keys) : [];
  let workedMinutes = 0;
  const flags = { noBreak: 0, presence: 0, workCap: 0 };
  for (const row of rows) {
    const key = String(row.date || row.dateKey).slice(0, 10);
    const read = dayOvertimeFor(d, employee, key, row);
    if (read?.ok) workedMinutes += read.actual.workedMinutes;
    const codes = new Set([...(Array.isArray(row.actualFlags) ? row.actualFlags : []), ...((read?.actual?.flags || []).map((f) => f.error))]);
    if (codes.has("ACTUAL_NO_BREAK")) flags.noBreak += 1;
    if (codes.has("ACTUAL_PRESENCE_OVER_CAP")) flags.presence += 1;
    if (codes.has("ACTUAL_WORK_OVER_CAP")) flags.workCap += 1;
  }
  const weekCap = ordinaryWeekCap(employee, d, day, calendar);
  const schedule = employee.id ? scheduleOf(d, employee, day) : null;
  const restDays = schedule ? weekRestDayCount(schedule, employee, day, calendar) : null;
  const year = day.slice(0, 4);
  let yearMinutes = 0;
  let openCount = 0;
  let capConsent = 0;
  for (const [key, entry] of Object.entries(d?.otDecisions || {})) {
    if (!employee.id || !key.startsWith(`${employee.id}:${year}`) || !entry || entry.source === "ot_assignment") continue;
    if (entry.decision === "reject") continue;
    const proven = entry.workedProven === true || ["approve", "pay", "comp_leave", "credit"].includes(entry.decision);
    if (!proven) continue;
    yearMinutes += Math.max(0, Number(entry.overtimeMinutes) || 0);
    if (entry.decision === "pending" || entry.decision === "pending_worker_cap_consent") openCount += 1;
    if (entry.decision === "pending_worker_cap_consent") capConsent += 1;
  }
  const night = schedule ? weekDateKeys(day).filter((key) => isNightWorker(employeeShiftOnDay(schedule, employee.id, key), key)).length : 0;
  return {
    workedHours: hours1(workedMinutes),
    weekCapHours: Number.isFinite(weekCap) ? weekCap : null,
    closedDays: rows.length,
    flags,
    restDays,
    yearHours: hours1(yearMinutes),
    openCount,
    capConsent,
    nightDays: night,
    ramadan: isRamadanDay(day, calendar) && isRamadanHoursSubject(employee),
  };
}

/**
 * The rows for one person (lane «employee») or one file in the management sum (lane «manage»).
 * `company` facts (Art. 103, the season) are read once by the caller.
 */
export function attendanceMinistryRows({ d, employee, today, ar = true, lane = "employee", prayers = null } = {}) {
  const day = String(today || "").slice(0, 10);
  const f = attendanceFactsOf(d, employee, day);
  const policy = hoursPolicyOf(d, employee);
  const continuous = policy.continuousWork103 === true;
  const manage = lane === "manage";
  const consec = ruleValue("hours.rest.maxConsecutiveHours", day);
  const minRest = ruleValue("hours.rest.duringShiftMinutes", day);
  const stay = ruleValue("hours.workplace.maxHours", day);
  const dayH = ruleValue("hours.shift.ordinaryHours", day);
  const weekH = ruleValue("hours.week.ordinaryMaxHours", day);
  const ramDay = ruleValue("hours.ramadan.ordinaryHours", day);
  const ramWeek = ruleValue("hours.ramadan.weekMaxHours", day);
  const workCap = ruleValue("hours.ot.exceptionDayHours", day);
  const annual = ruleValue("hours.ot.annualMaxHours", day);
  const premium = ruleValue("hours.ot.premium", day);
  const rows = [];

  // Art. 98 — the day and the week (Ramadan for a Muslim / an empty religion field).
  const cap = f.weekCapHours;
  rows.push({
    key: "labour-98",
    source: "labour",
    badge: badgeOf("hours.shift.ordinaryHours", ar, day),
    title: T(ar, `${dayH} ساعات يومياً و${weekH} أسبوعياً — رمضان ${ramDay} و${ramWeek}`, `${dayH} h a day and ${weekH} a week — Ramadan ${ramDay} and ${ramWeek}`),
    note: citeRule("hours.week.ordinaryMaxHours", day)?.[ar ? "hintAr" : "hintEn"] || "",
    status: f.closedDays ? "settled" : "void",
    pill: f.closedDays && cap != null
      ? (f.workedHours > cap
        ? T(ar, `هذا الأسبوع ${fmtH(f.workedHours)}/${fmtH(cap)} ساعة — الزائد إضافي مسجّل`, `This week ${fmtH(f.workedHours)}/${fmtH(cap)} h — the excess is recorded overtime`)
        : T(ar, `هذا الأسبوع ${fmtH(f.workedHours)}/${fmtH(cap)} ساعة`, `This week ${fmtH(f.workedHours)}/${fmtH(cap)} h`))
      : T(ar, "لا يوم مغلق هذا الأسبوع", "No closed day this week"),
  });

  // Art. 101 — five consecutive hours, the rest, the twelve-hour presence (none under Art. 103).
  const breached = f.flags.noBreak + f.flags.presence;
  rows.push({
    key: "labour-101",
    source: "labour",
    badge: badgeOf("hours.rest.maxConsecutiveHours", ar, day),
    title: T(ar, `لا أكثر من ${consec} ساعات متواصلة، وراحة ${minRest} دقيقة على الأقل، وبقاء ${stay} ساعة`, `No more than ${consec} h in a row, a rest of at least ${minRest} min, a ${stay}-hour presence`),
    note: citeRule("hours.rest.maxConsecutiveHours", day)?.[ar ? "hintAr" : "hintEn"] || "",
    status: continuous ? "void" : breached ? "alert" : "settled",
    pill: continuous
      ? T(ar, "عمل متواصل (المادة 103)", "Continuous work (Art. 103)")
      : breached
        ? T(ar, `خرق هذا الأسبوع: ${breached} يوم`, `Breached this week: ${breached} day(s)`)
        : T(ar, "تنبّه المنصة عند 4:30 و5:00", "The platform alerts at 4:30 and 5:00"),
  });

  // Art. 102 — the rest is not work time.
  rows.push({
    key: "labour-102",
    source: "labour",
    badge: badgeOf("hours.rest.notWorkingHours.cite", ar, day),
    title: T(ar, "الراحة والصلاة والطعام لا تُحسب من ساعات العمل", "Rest, prayer and meals are not working time"),
    note: citeRule("hours.rest.notWorkingHours.cite", day)?.[ar ? "hintAr" : "hintEn"] || "",
    status: continuous ? "void" : "settled",
    pill: continuous ? T(ar, "تُنظَّم أثناء العمل (المادة 103)", "Organised during work (Art. 103)") : T(ar, "لا تُحسب من ساعات العمل", "Not counted as working time"),
  });

  // Art. 103 — continuous work by the Minister's decision.
  rows.push({
    key: "labour-103",
    source: "labour",
    badge: badgeOf("hours.art103.cite", ar, day),
    title: T(ar, "العمل المتواصل دون فترة راحة — بقرار الوزير", "Continuous work without a break — by the Minister's decision"),
    note: citeRule("hours.art103.cite", day)?.[ar ? "hintAr" : "hintEn"] || "",
    status: continuous ? "settled" : "void",
    pill: continuous ? T(ar, "مفعّل لهذه المنشأة", "On for this establishment") : T(ar, "غير مفعّل", "Not in use"),
  });

  // Art. 104 — the weekly rest on the roster.
  rows.push({
    key: "labour-104",
    source: "labour",
    badge: badgeOf("hours.rest.weeklyHours", ar, day),
    title: T(ar, `راحة أسبوعية ${ruleValue("hours.rest.weeklyHours", day)} ساعة متصلة لا تُستبدل بأجر`, `A ${ruleValue("hours.rest.weeklyHours", day)}-hour weekly rest, never paid instead`),
    note: citeRule("hours.rest.weeklyHours", day)?.[ar ? "hintAr" : "hintEn"] || "",
    status: f.restDays == null ? "void" : f.restDays > 0 ? "settled" : "alert",
    pill: f.restDays == null
      ? T(ar, "لا جدول منشور", "No published roster")
      : f.restDays > 0
        ? T(ar, `راحة هذا الأسبوع: ${f.restDays} يوم`, `Rest this week: ${f.restDays} day(s)`)
        : T(ar, "لا يوم راحة هذا الأسبوع", "No rest day this week"),
  });

  // Art. 106 — ten actual hours a day even in the exceptions.
  rows.push({
    key: "labour-106",
    source: "labour",
    badge: badgeOf("hours.ot.exceptionDayHours", ar, day),
    title: T(ar, `لا تزيد الساعات الفعلية على ${workCap} في اليوم ولو في الاستثناء`, `Actual hours never above ${workCap} a day, even in the exceptions`),
    note: citeRule("hours.ot.exceptionDayHours", day)?.[ar ? "hintAr" : "hintEn"] || "",
    status: f.flags.workCap ? "alert" : f.closedDays ? "settled" : "void",
    pill: f.flags.workCap ? T(ar, `فوق ${workCap} ساعات: ${f.flags.workCap} يوم`, `Above ${workCap} h: ${f.flags.workCap} day(s)`) : undefined,
  });

  // Art. 107 — overtime recorded automatically; pay at hour + 50% or compensatory leave by consent.
  rows.push({
    key: "labour-107",
    source: "labour",
    badge: badgeOf("hours.ot.premium", ar, day),
    title: T(ar, `الإضافي يُسجَّل تلقائياً عند الانصراف — بأجر الساعة + ${Math.round((premium - 1) * 100)}% أو إجازة تعويضية بموافقتك؛ العطلة الرسمية ويوم الراحة كلها إضافي`, `Overtime is recorded at checkout — paid at the hour + ${Math.round((premium - 1) * 100)}% or compensatory leave by consent; an official holiday or rest day is all overtime`),
    note: citeRule("hours.ot.premium", day)?.[ar ? "hintAr" : "hintEn"] || "",
    status: manage && f.openCount ? "waiting" : "settled",
    pill: f.openCount
      ? (manage ? T(ar, `${f.openCount} بانتظار قرارك`, `${f.openCount} awaiting your decision`) : T(ar, `${f.openCount} بانتظار قرار الأجر/الإجازة`, `${f.openCount} awaiting the pay / leave decision`))
      : T(ar, "تطبّقه المنصة", "Enforced"),
  });

  // Art. 108 — categories outside 98 and 101, for reference.
  if (citeRule("hours.art108.cite", day)) {
    rows.push({
      key: "labour-108",
      source: "labour",
      badge: badgeOf("hours.art108.cite", ar, day),
      title: T(ar, "فئات لا تسري عليها المادتان 98 و101 (الإدارة العليا، التجهيزي، المتقطع، الحراسة)", "Categories outside Arts 98 and 101 (top management, preparatory, intermittent, guards)"),
      note: citeRule("hours.art108.cite", day)?.[ar ? "hintAr" : "hintEn"] || "",
      status: "void",
    });
  }

  // Regs Art. 22 — the 720-hour year and the worker's consent past it.
  rows.push({
    key: "regs-22",
    source: "regs",
    badge: ar ? "اللائحة م22" : "Regs Art. 22",
    title: T(ar, `${annual} ساعة إضافي في السنة حداً، وما زاد بموافقة العامل`, `${annual} overtime hours a year at most, more only with the worker's consent`),
    note: T(ar, "اللائحة التنفيذية مادة 22: لا تزيد ساعات العمل الإضافي على 720 ساعة في السنة، ويجوز زيادتها بموافقة العامل.", "Implementing Regulations Art. 22: overtime may not exceed 720 hours a year, more with the worker's consent."),
    status: f.capConsent ? (manage ? "waiting" : "alert") : f.yearHours > annual ? "alert" : "settled",
    pill: f.capConsent
      ? (manage ? T(ar, "بانتظار موافقة العامل", "Awaiting the worker's consent") : T(ar, "بانتظار موافقتك في طلباتي", "Awaiting your consent in My requests"))
      : T(ar, `هذا العام ${fmtH(f.yearHours)}/${annual} ساعة`, `This year ${fmtH(f.yearHours)}/${annual} h`),
  });

  // Decision 18632 — night work: reference for the worker, an obligation for management.
  const nightStart = ruleValue("hours.night.startHour", day);
  const nightEnd = ruleValue("hours.night.endHour", day);
  const nightRest = ruleValue("hours.night.restHours", day);
  rows.push({
    key: "18632-night",
    source: "18632",
    badge: "18632",
    title: manage
      ? T(ar, `العمل الليلي ${nightStart}:00–0${nightEnd}:00 — راحة ${nightRest} ساعة بين يومين، تعويض، وتدوير`, `Night work ${nightStart}:00–0${nightEnd}:00 — ${nightRest} h rest between days, compensation, rotation`)
      : T(ar, `العمل الليلي ${nightStart}:00–0${nightEnd}:00 — لك راحة ${nightRest} ساعة بين يومي عمل`, `Night work ${nightStart}:00–0${nightEnd}:00 — you have ${nightRest} h rest between two work days`),
    note: T(ar, "القرار 18632: عامل ليلي من يعمل ثلاث ساعات فأكثر بين 23:00 و06:00، وله راحة لا تقل عن 12 ساعة بين يومي عمل، ويُعوَّض بساعات أو أجر أو مزايا.", "Decision 18632: a night worker works three hours or more between 23:00 and 06:00, has at least 12 hours' rest between two work days, and is compensated."),
    status: manage && f.nightDays ? "settled" : "void",
    pill: f.nightDays
      ? (manage ? T(ar, "يفحصها الجدول عند النشر", "Checked by the roster on publish") : T(ar, `${f.nightDays} يوم ليلي هذا الأسبوع`, `${f.nightDays} night day(s) this week`))
      : T(ar, "لا عمل ليلي هذا الأسبوع", "No night work this week"),
  });

  // Decision 3337 — the open-sun window, in season.
  const inSeason = isHeatBanDate(day);
  const win = heatBanWindow(day);
  rows.push({
    key: "3337-attendance",
    source: "3337",
    badge: "3337",
    title: T(ar, `لا عمل مكشوف ${win.startLabel}–${win.endLabel} في الموسم`, `No exposed work ${win.startLabel}–${win.endLabel} in season`),
    note: T(ar, `القرار ${HEAT_BAN_DECISION.id}: يُنبَّه الموظف في الميدان المكشوف عند بدء النافذة.`, `Decision ${HEAT_BAN_DECISION.id}: an exposed worker is alerted when the window opens.`),
    status: inSeason ? "settled" : "void",
    pill: inSeason ? T(ar, "يُنبَّه عند بدء الحظر", "Alerted when the ban starts") : T(ar, "خارج الموسم", "Off season"),
  });

  // Art. 154 · Regs Art. 31 — the nursing hour: met while it is active on her file; for reference to
  // other female workers; not shown on a man's panel. The management lane counts them (ministrySections).
  const nursingRow = attendanceNursingRow({ employee, day, ar });
  if (nursingRow) rows.push(nursingRow);

  // Prayer times — the branch's city, Umm al-Qura (reference; the employee lane only).
  if (!manage && prayers?.times) {
    rows.push({
      key: "prayer-times",
      source: "labour",
      badge: ar ? "أم القرى" : "Umm al-Qura",
      title: T(ar, "أوقات الصلاة حسب مدينة فرعك — أم القرى", "Prayer times for your branch's city — Umm al-Qura"),
      note: T(ar, "تُعرض في «مسار اليوم» ويُقترح أقرب صلاة لموعد الراحة — لا تنقل الراحة المنشورة.", "Shown on the day's timeline; the nearest prayer is suggested for the break — a published break never moves."),
      status: "void",
      pill: `${T(ar, "الظهر", "Dhuhr")} ${prayers.times.dhuhr} · ${T(ar, "العصر", "Asr")} ${prayers.times.asr}`,
    });
  }
  return rows;
}

/** Is the Art. 154 nursing hour active on this file today? */
export function nursingActiveOn(employee, today) {
  return !!nursingHourOn(employee, String(today || "").slice(0, 10));
}

/**
 * The Art. 154 row (with Regs Art. 31): «ساعة رضاعة حتى …» met when active; for reference to a female
 * worker without one; null for anyone else, so a man's panel stays clear.
 */
export function attendanceNursingRow({ employee, day, ar = true } = {}) {
  const nursing = nursingHourOn(employee, day);
  const female = profileGender(employee?.profile) === "female";
  if (!nursing && !female) return null;
  const mins = ruleValue("leave.nursing.dailyMinutes", day);
  const months = ruleValue("leave.nursing.regs31.cite", day);
  const art = citeRule("leave.nursing.dailyMinutes", day)?.article || "";
  const lawNote = citeRule("leave.nursing.dailyMinutes", day)?.[ar ? "hintAr" : "hintEn"] || "";
  const regsNote = explainRule("leave.nursing.regs31.cite", day)?.[ar ? "hintAr" : "hintEn"] || "";
  return {
    key: "labour-154",
    source: "labour",
    badge: ar ? `م ${art} · اللائحة م31` : `Art. ${art} · Regs Art. 31`,
    title: nursing
      ? (nursing.until
        ? T(ar, `ساعة رضاعة حتى ${formatDate(nursing.until, "ar", { day: "numeric", month: "long", year: "numeric" })}`, `Nursing hour until ${formatDate(nursing.until, "en", { day: "numeric", month: "long", year: "numeric" })}`)
        : T(ar, "ساعة رضاعة على ملفك", "Nursing hour on your file"))
      : T(ar, `ساعة رضاعة ${mins} دقيقة يومياً بعد إجازة الوضع، ${months} شهراً من الوضع`, `A ${mins}-minute nursing hour a day after maternity leave, for ${months} months from birth`),
    note: [lawNote, regsNote].filter(Boolean).join(" "),
    status: nursing ? "settled" : "void",
    nursingActive: !!nursing,
  };
}
