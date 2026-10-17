/**
 * verify-ministry-rules.mjs — exercise the real rule libraries against the official texts:
 *   - Ministerial decision 18632 / 1441 AH (night work) and its attached guide (worked examples)
 *   - Ministerial decision 3337 / 1435 AH (work under the sun)
 *   - Labour Law articles the code cites (98, 101, 102, 104, 106, 107, 109, 112, 113, 151, 162–164 …)
 * Run: node scripts/verify-ministry-rules.mjs   (ESM, relative imports — no alias needed)
 * Prints PASS/FAIL per case and exits non-zero on any failure.
 */

import {
  nightMinutesInWindow,
  performsNightWork,
  isNightWorker,
  classifyNightAssignment,
  isNightWorkerXorExempt,
  pregnancyNightBan,
  checkNightPregnancyBan,
  nightMedicalDutyState,
  checkNightMedicalFitness,
  nightFacilityGaps,
  decision18632RightsNote,
} from "../src/lib/decision18632.js";
import {
  LABOR_RULES,
  ruleValue,
  ruleAt,
  citeRule,
  isRamadanDay,
  isRamadanHoursSubject,
  laborDayKey,
  addLaborDays,
} from "../src/lib/laborRules.js";
import { articleOfficialText } from "../src/lib/laborArticleTexts.js";
import {
  isHeatBanDate,
  shiftOverlapsHeatBan,
  checkHeatBanGate,
  heatBanWindow,
  heatBanClockState,
  isHeatBanMinuteOfDay,
} from "../src/lib/contractLawDerivations.js";
import { DECISION_3337_TEXT_AR, HEAT_BAN_DECISION } from "../src/lib/heatBanDecision.js";
import {
  restGapHours,
  checkNightRestApplyGate,
  nightRestPairHits,
  nightStreakWeeks,
  checkShiftChangeApplyGate,
  checkWeekPublishGates,
  checkNightCompensateOrReduceGate,
  checkNightPerformerCompensationGate,
  checkWorkplaceStayDutyGate,
  actualShiftHours,
  countNightWorkerDaysInYear,
  consecutiveNightWorkerMonths,
  monthsWithNightShareAtLeast,
  weekDateKeys,
  checkJuvenileRosterGate,
  sunExposureMark,
  sunExposureCellState,
  longestWeeklyRestHours,
  postnatalBirthDate,
  isMandatoryPostnatalDay,
} from "../src/lib/shiftWeek.js";
import { buildLawGatesBoard } from "../src/lib/lawGatesBoard.js";
import { nightRotateDue, nightRotateWeeks } from "../src/lib/nightRotateCycle.js";
import {
  ordinaryDayCap,
  ordinaryWeekCap,
  deriveNamedOvertime,
  isJuvenile,
  checkThreeWeekAverageGate,
} from "../src/lib/laborHoursPolicy.js";
import { checkJuvenileHoursGate } from "../src/lib/laborProtectionGates.js";
import { checkConsecutiveWorkGate } from "../src/lib/shiftDerivations.js";

let pass = 0;
let fail = 0;
const failures = [];
function check(name, actual, expected, source = "") {
  const ok = Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
    console.log(`PASS  ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`FAIL  ${name}\n      expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}${source ? `\n      source: ${source}` : ""}`);
  }
}
function section(title) {
  console.log(`\n== ${title}`);
}

const D = "2026-09-14"; // an ordinary Monday, outside Ramadan and the heat season
const shift = (start, end, extra = {}) => ({ id: `s_${start}_${end}`.replace(/:/g, ""), label: `${start}-${end}`, start, end, ...extra });

/* ------------------------------------------------------------------ */
section("18632 — أولاً/ثانياً: window 23:00–06:00, performer vs night worker (guide examples p.5–6)");
check("rule hours.night.startHour = 23", ruleValue("hours.night.startHour", D), 23, "18632 p.1 أولاً");
check("rule hours.night.endHour = 6", ruleValue("hours.night.endHour", D), 6, "18632 p.1 أولاً");
check("rule hours.night.workerHours = 3", ruleValue("hours.night.workerHours", D), 3, "18632 p.1 ثانياً");
check("18632 dated from 2020-01-01 (تاسعاً)", ruleAt("hours.night.startHour", "2019-12-31"), null, "18632 p.4 تاسعاً");

// Guide example 1: 17:00 → 01:30 = 2.5 night hours → performs night work, NOT a night worker
check("ex1 17:00–01:30 night minutes = 150", nightMinutesInWindow("17:00", "01:30", D), 150, "guide p.5 مثال 1");
check("ex1 performs night work", performsNightWork(shift("17:00", "01:30"), D), true);
check("ex1 is not a night worker", isNightWorker(shift("17:00", "01:30"), D), false);
// The task's variant 17:00 → 01:00 = 2 h (also performer only)
check("17:00–01:00 night minutes = 120", nightMinutesInWindow("17:00", "01:00", D), 120);
check("17:00–01:00 performer only", classifyNightAssignment(shift("17:00", "01:00"), D).worker, false);
// Guide example 2: 17:30 → 02:30 = 3 h → night worker
// The guide's table prints «3 ساعة» for 23:00→02:30 (it nets a rest break per Arts 101/102); the clock value is 210.
check("ex2 17:30–02:30 night minutes = 210 (clock)", nightMinutesInWindow("17:30", "02:30", D), 210, "guide p.5 مثال 2");
check("ex2 is a night worker", isNightWorker(shift("17:30", "02:30"), D), true);
check("17:00–02:00 (3h) is a night worker", isNightWorker(shift("17:00", "02:00"), D), true);
// Guide example 3: 23:00 → 07:30 = 7 h night + 1.5 ordinary → night worker
check("ex3 23:00–07:30 night minutes = 420", nightMinutesInWindow("23:00", "07:30", D), 420, "guide p.6 مثال 3");
check("ex3 is a night worker", isNightWorker(shift("23:00", "07:30"), D), true);
// Guide example 4: 04:00 → 12:30 = 2 h night + 6.5 ordinary → performer only
check("ex4 04:00–12:30 night minutes = 120", nightMinutesInWindow("04:00", "12:30", D), 120, "guide p.6 مثال 4");
check("ex4 performs night work, not a night worker", classifyNightAssignment(shift("04:00", "12:30"), D).worker, false);
check("ex4 performs", classifyNightAssignment(shift("04:00", "12:30"), D).performs, true);
// 19:00 → 07:00 (12h stay) = 7 h night
check("19:00–07:00 night minutes = 420", nightMinutesInWindow("19:00", "07:00", D), 420);
check("19:00–07:00 is a night worker", isNightWorker(shift("19:00", "07:00"), D), true);
// 15:00 → 23:00 evening = 0 night minutes
check("15:00–23:00 night minutes = 0", nightMinutesInWindow("15:00", "23:00", D), 0);
check("15:00–23:00 does not perform night work", performsNightWork(shift("15:00", "23:00"), D), false);
check("06:00–14:00 night minutes = 0", nightMinutesInWindow("06:00", "14:00", D), 0);
check("22:00–06:00 night minutes = 420 (ends exactly at window end)", nightMinutesInWindow("22:00", "06:00", D), 420);
check("00:00–00:00 is read as a full 24h wrap → 420 night minutes", nightMinutesInWindow("00:00", "00:00", D), 420);

/* ------------------------------------------------------------------ */
section("18632 — ج-ج: 12-hour rest between two work days when one touches the window");
check("rule hours.night.restHours = 12", ruleValue("hours.night.restHours", D), 12, "18632 p.3 متطلبات أخرى ج");
check("gap 23:00–07:00 → next 15:00 = 8h", restGapHours(shift("23:00", "07:00"), shift("15:00", "23:00")), 8);
check("gap 23:00–07:00 → next 19:00 = 12h", restGapHours(shift("23:00", "07:00"), shift("19:00", "03:00")), 12);
check("gap 06:00–14:00 → next 02:00 = 12h", restGapHours(shift("06:00", "14:00"), shift("02:00", "10:00")), 12);

function schedWith(assignments, types) {
  return { stationId: "st1", shiftTypes: types, assignments };
}
const NIGHT = shift("23:00", "07:00", { restMinutes: 60 });
const EVE = shift("15:00", "23:00", { restMinutes: 30 });
const MORN = shift("07:00", "15:00", { restMinutes: 30 });
const EMP = { id: "e1", name: "عامل", stationId: "st1", profile: {}, otherRequests: [] };

{
  // Night Mon (ends Tue 07:00) then evening Tue 15:00 → 8h rest → violation
  const sched = schedWith({ "2026-09-14": { [NIGHT.id]: ["e1"] } }, [NIGHT, EVE, MORN]);
  const gate = checkNightRestApplyGate({ schedule: sched, employee: EMP, dateKey: "2026-09-15", shift: EVE });
  check("rest12: night then 15:00 next day is blocked", gate.error, "NIGHT_REST_REQUIRED");
  const gate2 = checkNightRestApplyGate({ schedule: sched, employee: EMP, dateKey: "2026-09-15", shift: shift("19:00", "03:00") });
  check("rest12: night then 19:00 next day (12h) is allowed", gate2.ok, true);
  // Two ordinary days back to back: evening 15–23 then morning 07–15 (8h gap) — no night minutes → 18632 silent
  const sched2 = schedWith({ "2026-09-14": { [EVE.id]: ["e1"] } }, [NIGHT, EVE, MORN]);
  const gate3 = checkNightRestApplyGate({ schedule: sched2, employee: EMP, dateKey: "2026-09-15", shift: MORN });
  check("rest12: evening→morning (no night window) not a 18632 block", gate3.ok, true);
  // Week scan sees the same pair
  const sched3 = schedWith({ "2026-09-14": { [NIGHT.id]: ["e1"] }, "2026-09-15": { [EVE.id]: ["e1"] } }, [NIGHT, EVE, MORN]);
  check("rest12: week pair hits = 1", nightRestPairHits(sched3, EMP, "2026-09-13").length, 1);
}

/* ------------------------------------------------------------------ */
section("18632 — د: 3-month rotation then ≥1 month ordinary hours, or written consent with withdraw right");
check("rule hours.night.rotateWeeks = 13 (~3 months)", ruleValue("hours.night.rotateWeeks", D), 13, "18632 p.3 د");
check("rule hours.night.rotateOrdinaryWeeks = 4 (~1 month)", ruleValue("hours.night.rotateOrdinaryWeeks", D), 4, "18632 p.3 د");
function nightWeeksSchedule(weeks, { gapWeeksBefore = 0, consent = false } = {}) {
  // `weeks` dated night-worker weeks ending the week before 2026-09-13 (Sun start)
  const assignments = {};
  const start = new Date(2026, 8, 13); // 2026-09-13
  for (let back = 1; back <= weeks; back += 1) {
    const wk = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7 * back);
    for (let d = 0; d < 5; d += 1) {
      const day = new Date(wk.getFullYear(), wk.getMonth(), wk.getDate() + d);
      const key = laborDayKey(day);
      assignments[key] = { [NIGHT.id]: ["e1"] };
    }
  }
  // current week also on nights
  for (const key of weekDateKeys("2026-09-13").slice(0, 5)) assignments[key] = { [NIGHT.id]: ["e1"] };
  void gapWeeksBefore;
  const employee = { ...EMP, profile: consent ? { nightConsentAt: "2026-08-01" } : {}, otherRequests: [] };
  return { sched: schedWith(assignments, [NIGHT, EVE, MORN]), employee };
}
{
  const thirteen = nightWeeksSchedule(12); // 12 past + current = 13
  check("13 dated night weeks → streak 12 before this week", nightStreakWeeks(thirteen.sched, "e1", "2026-09-13"), 12);
  check("13 weeks: rotation not yet due", nightRotateDue({ employee: thirteen.employee, schedule: thirteen.sched, weekStart: "2026-09-13" }).due, false);
  const fourteen = nightWeeksSchedule(13); // 13 past + current = 14
  const due = nightRotateDue({ employee: fourteen.employee, schedule: fourteen.sched, weekStart: "2026-09-13" });
  check("14-week night assignment triggers rotation/consent", due.due, true, "18632 p.3 د");
  check("14 weeks: reason over_three_months", due.reason, "over_three_months");
  const applyGate = checkShiftChangeApplyGate({ schedule: fourteen.sched, employee: fourteen.employee, dateKey: "2026-09-14", shiftTypeId: NIGHT.id });
  check("14 weeks without consent: night assignment blocked (NIGHT_CONSENT_REQUIRED)", applyGate.error, "NIGHT_CONSENT_REQUIRED");
  const consented = nightWeeksSchedule(13, { consent: true });
  check("14 weeks with written consent on file: not due", nightRotateDue({ employee: consented.employee, schedule: consented.sched, weekStart: "2026-09-13" }).reason, "consented");
  const withdrawn = { ...consented.employee, profile: { nightConsentAt: "2026-08-01", nightConsentWithdrawnAt: "2026-09-01" } };
  check("withdrawn consent re-opens the rotation duty (حق التراجع)", nightRotateDue({ employee: withdrawn, schedule: consented.sched, weekStart: "2026-09-13" }).due, true, "18632 p.3 د");
  // one morning week inside the streak does not reset the count; four ordinary weeks do
  const streakSched = nightWeeksSchedule(16).sched;
  for (const key of Object.keys(streakSched.assignments)) {
    if (key >= "2026-08-30" && key <= "2026-09-05") streakSched.assignments[key] = { [MORN.id]: ["e1"] };
  }
  check("one ordinary week does not reset the streak", nightStreakWeeks(streakSched, "e1", "2026-09-13"), 15);
  const resetSched = nightWeeksSchedule(16).sched;
  for (const key of Object.keys(resetSched.assignments)) {
    if (key >= "2026-08-09" && key <= "2026-09-05") resetSched.assignments[key] = { [MORN.id]: ["e1"] };
  }
  check("four ordinary weeks (≥1 month) reset the streak (only the one night week after them counts)", nightStreakWeeks(resetSched, "e1", "2026-09-13"), 1);
}

/* ------------------------------------------------------------------ */
section("18632 — رابعاً: compensation thresholds (full month / 25% for ≥2 months / >45 work days a year) and Ramadan exclusion");
check("rule hours.night.incidentalYearDays = 45 (PDF p.3 رابعاً: «ما يزيد عن ٤٥ يوم عمل في السنة»)", ruleValue("hours.night.incidentalYearDays", D), 45, "18632 p.3 رابعاً");
check("Ramadan night → compensation paragraph does not apply", isNightWorkerXorExempt({ onDate: "2026-03-01", datedYearDays: 200 }).reason, "ramadan_night", "18632 p.3 رابعاً");
check("10 scattered night days, no month, no 25% share → exempt", isNightWorkerXorExempt({ onDate: D, datedYearDays: 200, yearDays: 10, consecutiveMonths: 1, shareMonths: 1 }).exempt, true);
check("46 night days a year → NOT exempt (even without month/share triggers)", isNightWorkerXorExempt({ onDate: D, datedYearDays: 200, yearDays: 46, consecutiveMonths: 1, shareMonths: 1 }).exempt, false, "18632 p.3 رابعاً");
check("45 night days a year → still exempt (يزيد عن 45)", isNightWorkerXorExempt({ onDate: D, datedYearDays: 200, yearDays: 45, consecutiveMonths: 1, shareMonths: 1 }).exempt, true);
check("two months at ≥25% share → NOT exempt even if ≤45 days", isNightWorkerXorExempt({ onDate: D, datedYearDays: 200, yearDays: 20, consecutiveMonths: 1, shareMonths: 2 }).exempt, false, "18632 p.3 رابعاً");
check("full-month night run (≥2 consecutive months) → NOT exempt even if ≤45 days", isNightWorkerXorExempt({ onDate: D, datedYearDays: 200, yearDays: 30, consecutiveMonths: 2, shareMonths: 1 }).exempt, false, "18632 p.3 رابعاً");
check("short draft (no year lookback) is not silently exempt", isNightWorkerXorExempt({ onDate: D, datedYearDays: 10, yearDays: 2 }).reason, "insufficient_lookback");
{
  // A real roster: nights on 5 dated days in a 200-day year → compensate/reduce block must NOT fire (incidental)
  const assignments = {};
  for (let i = 0; i < 300; i += 1) {
    const key = addLaborDays("2026-01-04", i);
    assignments[key] = { [MORN.id]: ["e1"] };
  }
  for (const key of ["2026-09-14", "2026-09-15", "2026-06-10", "2026-04-02", "2026-02-11"]) assignments[key] = { [NIGHT.id]: ["e1"] };
  const sched = schedWith(assignments, [NIGHT, EVE, MORN]);
  check("roster: 5 night days in the year counted", countNightWorkerDaysInYear(sched, "e1", D), 5);
  check("roster: consecutive night months = 1", consecutiveNightWorkerMonths(sched, "e1", D), 1);
  check("roster: 25%-share months = 0", monthsWithNightShareAtLeast(sched, "e1", D), 0);
  const gate = checkNightCompensateOrReduceGate({ shift: NIGHT, onDate: D, employee: EMP, schedule: sched });
  check("incidental night worker: compensate-or-reduce gate passes via exempt", gate.via, "exempt", "18632 p.3 رابعاً");
  const perf = checkNightPerformerCompensationGate({ shift: NIGHT, onDate: D, employee: EMP, schedule: sched });
  check("incidental night performer: compensation gate also passes (رابعاً scopes the whole paragraph)", perf.ok, true, "18632 p.3 رابعاً");
  // Same worker, but 60 night days → block without allowance/reduction
  for (let i = 0; i < 60; i += 1) assignments[addLaborDays("2026-01-04", i)] = { [NIGHT.id]: ["e1"] };
  const gate2 = checkNightCompensateOrReduceGate({ shift: NIGHT, onDate: D, employee: EMP, schedule: sched });
  check("60 night days a year: compensate-or-reduce block fires", gate2.error, "NIGHT_COMPENSATE_OR_REDUCE");
  const withAllowance = { ...EMP, profile: { nightRemedy: { kind: "allowance", amount: 300 } } };
  check("recorded allowance satisfies the gate", checkNightCompensateOrReduceGate({ shift: NIGHT, onDate: D, employee: withAllowance, schedule: sched }).via, "compensate");
  const withReduce = { ...EMP, profile: { nightRemedy: { kind: "reduce", cutHours: 1, fromHours: 8 } } };
  check("recorded reduction satisfies the gate", checkNightCompensateOrReduceGate({ shift: NIGHT, onDate: D, employee: withReduce, schedule: sched }).via, "reduce");
  // Ramadan: paragraph رابعاً does not apply
  const ramadanGate = checkNightCompensateOrReduceGate({ shift: NIGHT, onDate: "2026-03-01", employee: EMP, schedule: sched });
  check("Ramadan night: compensate-or-reduce gate exempt", ramadanGate.exempt?.reason, "ramadan_night", "18632 p.3 رابعاً");
  const ramadanPerf = checkNightPerformerCompensationGate({ shift: NIGHT, onDate: "2026-03-01", employee: EMP, schedule: sched });
  check("Ramadan night: performer compensation gate exempt", ramadanPerf.ok, true, "18632 p.3 رابعاً");
}

/* ------------------------------------------------------------------ */
section("18632 — ج-2: pregnancy night ban ≥24 weeks before delivery; ج-1/ج-3 certificate periods");
check("rule hours.night.pregnancyBanWeeks = 24", ruleValue("hours.night.pregnancyBanWeeks", D), 24, "18632 p.2 ج-2");
check("due in 20 weeks → banned", pregnancyNightBan({ profile: { pregnant: true, expectedBirthDate: addLaborDays(D, 140) } }, D).ban, true);
check("due in 30 weeks → not banned", pregnancyNightBan({ profile: { pregnant: true, expectedBirthDate: addLaborDays(D, 210) } }, D).ban, false);
check("pregnant with no due date → banned (missing date)", pregnancyNightBan({ profile: { pregnant: "نعم" } }, D).missingDate, true);
check("ban blocks a 2h night performer, not only night workers", checkNightPregnancyBan({ employee: { profile: { pregnant: true, expectedBirthDate: addLaborDays(D, 100) } }, shift: shift("17:00", "01:00"), onDate: D }).error, "NIGHT_PREGNANCY_BAN", "18632 p.2 ج-2 (يُحظر عليها العمل الليلي)");
check("ban does not touch an evening 15–23 shift", checkNightPregnancyBan({ employee: { profile: { pregnant: true, expectedBirthDate: addLaborDays(D, 100) } }, shift: EVE, onDate: D }).ok, true);
check("medical certificate period (ج-1/ج-3) extends the ban", checkNightPregnancyBan({ employee: { profile: { nightPregnancyBanUntil: addLaborDays(D, 10) } }, shift: NIGHT, onDate: D }).ban?.extra, true, "18632 p.2 ج-1/ج-3");

/* ------------------------------------------------------------------ */
section("18632 — ثالثاً ب: medical fitness report before assignment / yearly / on health problem");
check("rule hours.night.medicalYearMonths = 12", ruleValue("hours.night.medicalYearMonths", D), 12, "18632 p.2 ب-2 (سنوياً على أقصى تقدير)");
check("unfit report blocks a night worker", checkNightMedicalFitness({ employee: { profile: { nightFitnessStatus: "unfit" } }, shift: NIGHT, onDate: D }).error, "NIGHT_MEDICAL_UNFIT", "18632 p.2 ج");
check("unfit report does not block a 2h performer (ثانياً: report is for the night worker)", checkNightMedicalFitness({ employee: { profile: { nightFitnessStatus: "unfit" } }, shift: shift("17:00", "01:00"), onDate: D }).ok, true);
check("no report on file → unmet, not a block", nightMedicalDutyState({ employee: EMP, shift: NIGHT, onDate: D }).error, "NIGHT_MEDICAL_FILE_MISSING");
check("report issued 13 months ago (issuedAt only) → stale", nightMedicalDutyState({ employee: { profile: { nightMedicalReport: { name: "r.pdf", issuedAt: addLaborDays(D, -400) } } }, shift: NIGHT, onDate: D }).unmet, true, "18632 p.2 ب-2");
check("report issued 2 months ago → satisfied", nightMedicalDutyState({ employee: { profile: { nightMedicalReport: { name: "r.pdf", issuedAt: addLaborDays(D, -60) } } }, shift: NIGHT, onDate: D }).ok, true);

/* ------------------------------------------------------------------ */
section("18632 — ثالثاً أ/د: facility duties (first aid, emergency transfer, night food)");
check("three facility flags required", nightFacilityGaps([{}]).length, 3, "18632 p.1–2 ثالثاً أ، د");
check("all flags set → no gap", nightFacilityGaps([{ nightFirstAidReady: true, nightEmergencyTransferReady: true, nightFoodAccessReady: true }]).length, 0);

/* ------------------------------------------------------------------ */
section("18632 — Ramadan toggle: window unchanged, Art. 98 six-hour cap for Muslims, رابعاً paragraph off");
check("2026-03-01 is a Ramadan day (Umm al-Qura 1447 starts 2026-02-18)", isRamadanDay("2026-03-01"), true);
check("2026-09-14 is not Ramadan", isRamadanDay(D), false);
check("Ramadan: night window still 23:00–06:00 (18632 unchanged)", nightMinutesInWindow("23:00", "07:30", "2026-03-01"), 420);
check("Ramadan: 23:00–07:30 still a night worker", isNightWorker(shift("23:00", "07:30"), "2026-03-01"), true);
check("Art. 98 Ramadan day cap 6h for Muslims", ordinaryDayCap(EMP, null, "2026-03-01"), 6, "Labour Law Art. 98");
check("Art. 98 Ramadan week cap 36h", ordinaryWeekCap(EMP, null, "2026-03-01"), 36, "Labour Law Art. 98");
check("Art. 98 ordinary day cap 8h", ordinaryDayCap(EMP, null, D), 8);
check("Art. 98 ordinary week cap 48h", ordinaryWeekCap(EMP, null, D), 48);
check("recorded non-Muslim keeps 8h in Ramadan", ordinaryDayCap({ profile: { religion: "non_muslim" } }, null, "2026-03-01"), 8, "Art. 98 «للمسلمين»");
check("empty religion is treated as subject", isRamadanHoursSubject({ profile: {} }), true);
{
  const sched = schedWith({ "2026-03-01": {} }, [NIGHT, EVE, MORN]);
  const g = checkShiftChangeApplyGate({ schedule: sched, employee: EMP, dateKey: "2026-03-01", shiftTypeId: MORN.id });
  check("Ramadan: 8h shift (7.5 actual) for a Muslim is blocked RAMADAN_DAY_CAP", g.error, "RAMADAN_DAY_CAP", "Art. 98");
  const six = shift("08:00", "14:30", { restMinutes: 30 });
  const sched6 = schedWith({ "2026-03-01": {} }, [six]);
  check("Ramadan: 6h shift allowed", checkShiftChangeApplyGate({ schedule: sched6, employee: EMP, dateKey: "2026-03-01", shiftTypeId: six.id }).ok, true);
}

/* ------------------------------------------------------------------ */
section("3337 — season 15 June–15 Sept, daily window 12:00–15:00, exposed work only");
check("decision id 3337 on Arts 122/243 amending 1/1559", HEAT_BAN_DECISION.amends.id, "1/1559", "3337 p.1");
check("verbatim text names 25 Gemini / 24 Virgo", /الخامس والعشرين من برج الجوزاء/.test(DECISION_3337_TEXT_AR) && /الرابع والعشرين من برج السنبلة/.test(DECISION_3337_TEXT_AR), true);
check("window 12:00–15:00", `${heatBanWindow(D).startHour}-${heatBanWindow(D).endHour}`, "12-15", "3337 p.1");
check("season from 15 June", `${heatBanWindow(D).fromMonth}-${heatBanWindow(D).fromDay}`, "6-15", "3337 p.1");
check("season to 15 Sept", `${heatBanWindow(D).toMonth}-${heatBanWindow(D).toDay}`, "9-15", "3337 p.1");
check("2026-06-15 in season (first day)", isHeatBanDate("2026-06-15"), true);
check("2026-09-15 in season (last day, «إلى نهاية اليوم»)", isHeatBanDate("2026-09-15"), true);
check("2026-06-14 out of season", isHeatBanDate("2026-06-14"), false);
check("2026-09-16 out of season", isHeatBanDate("2026-09-16"), false);
check("2026-07-20 in season", isHeatBanDate("2026-07-20"), true);
check("12:00 is in the window", isHeatBanMinuteOfDay(12 * 60, "2026-07-20"), true);
check("15:00 is outside the window (half-open)", isHeatBanMinuteOfDay(15 * 60, "2026-07-20"), false);
check("clock state in season 13:00 = in_window", heatBanClockState({ dayKey: "2026-07-20", minutes: 13 * 60 }), "in_window");
check("clock state in season 09:00 = before_window", heatBanClockState({ dayKey: "2026-07-20", minutes: 9 * 60 }), "before_window");
check("clock state off season 13:00 = off_season", heatBanClockState({ dayKey: "2026-10-20", minutes: 13 * 60 }), "off_season");
check("outdoor 08:00–16:00 in season overlaps the ban", shiftOverlapsHeatBan("08:00", "16:00", { outdoor: true, summer: true }), true);
check("outdoor 06:00–12:00 in season does not overlap", shiftOverlapsHeatBan("06:00", "12:00", { outdoor: true, summer: true }), false);
check("outdoor 15:00–23:00 in season does not overlap", shiftOverlapsHeatBan("15:00", "23:00", { outdoor: true, summer: true }), false);
check("outdoor 11:55–12:05 (10 min inside) overlaps", shiftOverlapsHeatBan("11:55", "12:05", { outdoor: true, summer: true }), true);
check("outdoor 14:58–15:03 overlaps (2 min inside)", shiftOverlapsHeatBan("14:58", "15:03", { outdoor: true, summer: true }), true);
check("indoor 08:00–16:00 in season is outside the ban («الأعمال المكشوفة»)", shiftOverlapsHeatBan("08:00", "16:00", { outdoor: false, summer: true }), false, "3337 p.1");
check("outdoor 08:00–16:00 out of season is free", shiftOverlapsHeatBan("08:00", "16:00", { outdoor: true, summer: false }), false);
check("checkHeatBanGate names HEAT_BAN", checkHeatBanGate({ start: "08:00", end: "16:00", outdoor: true, summer: true, onDate: "2026-07-20" }).error, "HEAT_BAN");
{
  // Week publish: in-season week, outdoor shift crossing 12–15 → heat_ban notice (not ok)
  const OUT = { ...shift("08:00", "16:00", { restMinutes: 60, outdoor: true }), id: "out_8_16" };
  const IN = { ...shift("08:00", "16:00", { restMinutes: 60, outdoor: false }), id: "in_8_16" };
  const sched = schedWith({ "2026-07-20": { [OUT.id]: ["e1"] } }, [OUT, IN]);
  const gates = checkWeekPublishGates({ schedule: sched, employees: [EMP], weekStart: "2026-07-19", stationId: "st1", today: "2026-07-19" });
  const heat = gates.checks.find((c) => c.id === "heat_ban");
  check("publish: in-season outdoor shift raises heat_ban", heat?.ok, false);
  const schedIn = schedWith({ "2026-07-20": { [IN.id]: ["e1"] } }, [OUT, IN]);
  const gatesIn = checkWeekPublishGates({ schedule: schedIn, employees: [EMP], weekStart: "2026-07-19", stationId: "st1", today: "2026-07-19" });
  check("publish: in-season indoor shift passes heat_ban", gatesIn.checks.find((c) => c.id === "heat_ban")?.ok, true);
  const gatesOff = checkWeekPublishGates({ schedule: schedWith({ "2026-10-19": { [OUT.id]: ["e1"] } }, [OUT, IN]), employees: [EMP], weekStart: "2026-10-18", stationId: "st1", today: "2026-10-18" });
  check("publish: outdoor shift off season passes heat_ban", gatesOff.checks.find((c) => c.id === "heat_ban")?.ok, true);
}
{
  // Per-person exposed / shaded mark on the roster cell — the same morning shift holds both.
  const MORN = { ...shift("07:00", "15:00", { restMinutes: 60 }), id: "morn" };
  const EVE = { ...shift("15:00", "23:00", { restMinutes: 60 }), id: "eve" };
  const NGT = { ...shift("23:00", "07:00", { restMinutes: 60 }), id: "ngt" };
  const E2 = { ...EMP, id: "e2", name: "مكتبي" };
  const run = (sched, weekStart, today, emps = [EMP]) => checkWeekPublishGates({ schedule: sched, employees: emps, weekStart, stationId: "st1", today });
  const base = { "2026-07-20": { morn: ["e1", "e2"] } };
  const marked = { ...schedWith(base, [MORN, EVE, NGT]), sunExposure: { "2026-07-20": { e1: "field", e2: "office" } } };
  const g1 = run(marked, "2026-07-19", "2026-07-19", [EMP, E2]);
  check("3337 cell: field + morning in season raises heat_ban", g1.checks.find((c) => c.id === "heat_ban")?.ok, false, "3337 p.1");
  check("3337 cell: heat_ban names only the field worker", (g1.sunField || []).map((r) => r.employeeId).join(","), "e1");
  check("3337 cell: heat_ban note names the person", /عامل/.test(g1.checks.find((c) => c.id === "heat_ban")?.note || ""), true);
  check("3337 violation: exposed in window is a violation AND a publish block", [g1.checks.find((c) => c.id === "heat_ban")?.violation, g1.checks.find((c) => c.id === "heat_ban")?.block].join(","), "true,true");
  check("3337 violation: board row reads «مخالفة»", buildLawGatesBoard({ gates: g1, onDate: "2026-07-20", ar: true }).heat.rows.find((r) => r.id === "exposed")?.status, "violation");
  check("3337 cell: office + morning in season passes", (g1.sunField || []).some((r) => r.employeeId === "e2"), false);
  check("3337 cell: all marked → heat_place passes", g1.checks.find((c) => c.id === "heat_place")?.ok, true);
  const g2 = run(schedWith(base, [MORN, EVE, NGT]), "2026-07-19", "2026-07-19", [EMP, E2]);
  check("3337 cell: unset morning in season warns heat_place", g2.checks.find((c) => c.id === "heat_place")?.ok, false);
  check("3337 cell: unset in season needs the mark before publish (block)", g2.checks.find((c) => c.id === "heat_place")?.block, true);
  check("3337 cell: unset warning text asks field/office", /مكشوف\/مظلّل/.test(g2.checks.find((c) => c.id === "heat_place")?.note || ""), true);
  // 18632 requirements (a) and (f) — declared on the roster like the facility flags; an alert, never a block.
  const nightSched = (extra = {}) => ({ ...schedWith({ "2026-09-14": { ngt: ["e1"] } }, [MORN, EVE, NGT]), ...extra });
  const nd = (g) => g.checks.find((c) => c.id === "night_employer_duties");
  const ndOpen = nd(run(nightSched(), "2026-09-13", "2026-09-13"));
  check("18632 (a,f): night work without parity/guide → night_employer_duties warns, no block", `${ndOpen?.ok}/${ndOpen?.block}`, "false/false", "18632 متطلبات أ، و");
  check("18632 (a,f): both declared → passes", nd(run(nightSched({ nightTrainingParity: true, nightGuidePublished: true }), "2026-09-13", "2026-09-13"))?.ok, true);
  check("18632 (a,f): no night work → not applicable", nd(run(schedWith({ "2026-09-14": { morn: ["e1"] } }, [MORN, EVE, NGT]), "2026-09-13", "2026-09-13"))?.applicable, false);
  const evening = schedWith({ "2026-07-20": { eve: ["e1"] }, "2026-07-21": { ngt: ["e1"] } }, [MORN, EVE, NGT]);
  const g3 = run(evening, "2026-07-19", "2026-07-19");
  check("3337 cell: evening 15–23 / night 23–07 never flagged", `${g3.checks.find((c) => c.id === "heat_ban")?.ok}/${g3.checks.find((c) => c.id === "heat_place")?.ok}`, "true/true");
  check("3337 cell: evening cell is never asked", sunExposureCellState(evening, "e1", "2026-07-20").asks, false);
  const fieldOff = { ...schedWith({ "2026-10-19": { morn: ["e1"] } }, [MORN]), sunExposure: { "2026-10-19": { e1: "field" } } };
  const g4 = run(fieldOff, "2026-10-18", "2026-10-18");
  check("3337 cell: out of season nothing (field mark ignored)", `${g4.checks.find((c) => c.id === "heat_ban")?.ok}/${g4.checks.find((c) => c.id === "heat_place")?.ok}`, "true/true");
  // Resolution order: cell → employee default → legacy shift.outdoor → unset
  const LEG = { ...MORN, outdoor: true };
  const chain = { ...schedWith({ "2026-07-20": { morn: ["e1"] } }, [LEG]), sunExposureDefault: { e1: "office" } };
  check("3337 resolve: default beats legacy shift.outdoor", sunExposureMark(chain, "e1", "2026-07-20").mark, "office");
  check("3337 resolve: cell beats default", sunExposureMark({ ...chain, sunExposure: { "2026-07-20": { e1: "field" } } }, "e1", "2026-07-20").mark, "field");
  check("3337 resolve: explicit unset cell stops the fallback", sunExposureMark({ ...chain, sunExposure: { "2026-07-20": { e1: "" } } }, "e1", "2026-07-20").mark, null);
  check("3337 resolve: legacy shift.outdoor still counts", sunExposureMark(schedWith({ "2026-07-20": { morn: ["e1"] } }, [LEG]), "e1", "2026-07-20").mark, "field");
}

/* ------------------------------------------------------------------ */
section("Labour Law hours & rest articles as encoded");
check("Art. 101 workplace stay ≤12h (from M/46 2015)", ruleValue("hours.workplace.maxHours", D), 12, "Art. 101");
check("Art. 101 pre-2015 stay was 11h", ruleValue("hours.workplace.maxHours", "2014-01-01"), 11);
check("Art. 101 max 5 consecutive hours", ruleValue("hours.rest.maxConsecutiveHours", D), 5);
check("Art. 101 rest ≥30 min", ruleValue("hours.rest.duringShiftMinutes", D), 30);
check("Art. 104 weekly rest 24h", ruleValue("hours.rest.weeklyHours", D), 24);
check("Art. 106 exception caps 10h/60h", `${ruleValue("hours.ot.exceptionDayHours", D)}/${ruleValue("hours.ot.exceptionWeekHours", D)}`, "10/60");
check("Art. 107 overtime 1.5×", ruleValue("hours.ot.premium", D), 1.5);
check("Art. 109 annual leave 21 → 30 after five years", `${ruleValue("leave.annual.days", D)}/${ruleValue("leave.annual.afterFiveYearsDays", D)}`, "21/30");
check("Art. 110 employer deferral ≤90 days", ruleValue("leave.annual.deferMaxDays", D), 90);
check("Art. 113 marriage 5 / bereavement 5 / sibling 3 / newborn 3 within 7", [ruleValue("leave.marriage.days", D), ruleValue("leave.bereavement.days", D), ruleValue("leave.bereavement_sibling.days", D), ruleValue("leave.paternity.days", D), ruleValue("leave.paternity.windowDays", D)], [5, 5, 3, 3, 7]);
check("Art. 115 exam notice 15 days", ruleValue("leave.exam.noticeDays", D), 15);
check("Art. 117 sick 30/60/30", [ruleValue("leave.sick.fullPayDays", D), ruleValue("leave.sick.halfPayDays", D), ruleValue("leave.sick.unpaidDays", D)], [30, 60, 30]);
check("Art. 151 maternity 12 weeks (from 2025-02-19) / 10 weeks before", `${ruleValue("leave.maternity.days", D)}/${ruleValue("leave.maternity.days", "2024-06-01")}`, "84/70");
check("Art. 162 min age 15", ruleValue("hours.juvenile.minAgeYears", D), 15);
check("Art. 164 juvenile 6h / Ramadan 4h / 4h stretch / 7h presence", [ruleValue("hours.juvenile.ordinaryHours", D), ruleValue("hours.juvenile.ramadanHours", D), ruleValue("hours.juvenile.maxStretchHours", D), ruleValue("hours.juvenile.maxPresenceHours", D)], [6, 4, 4, 7]);
check("Art. 163 juvenile night ≥12 consecutive hours", ruleValue("hours.juvenile.nightBanHours", D), 12);
check("Art. 149 is repealed (M/5 1442 = 2020-08-26), not an M/44 2025 change", articleOfficialText("149", "2021-01-01")?.ar, "ملغاة.", "labor-law.pdf footnote 53");
check("Art. 105: statute text matches the PDF («إذا اتفق صاحب العمل والعمال ووافقت على ذلك الوزارة»)", /اتفق صاحب العمل والعمال ووافقت على ذلك الوزارة/.test(articleOfficialText("105", D)?.ar || ""), true, "labor-law.pdf p.31");
check("Art. 100: statute text matches the PDF («بموافقة الوزارة … أداء العمل بالتناوب»)", /بموافقة الوزارة/.test(articleOfficialText("100", D)?.ar || "") && /بالتناوب/.test(articleOfficialText("100", D)?.ar || ""), true, "labor-law.pdf p.30");
check("Art. 103: statute text matches the PDF («بطريقة تنظمها إدارة المنشأة أثناء العمل»)", /تنظمها إدارة المنشأة/.test(articleOfficialText("103", D)?.ar || ""), true, "labor-law.pdf p.30");
check("Art. 17: statute text matches the PDF («مواعيد بدء كل نوبة وانتهائها»)", /بدء كل نوبة/.test(articleOfficialText("17", D)?.ar || ""), true, "labor-law.pdf Art. 17");
check("Art. 115: «بعدد أيام الامتحان الفعلية» (no typo)", /تحدد مدتها بعدد أيام/.test(articleOfficialText("115", D)?.ar || ""), true, "labor-law.pdf p.32");
check("Art. 155: «في السنة سواءً أكانت متصلة أم متفرقة»", /في السنة/.test(articleOfficialText("155", D)?.ar || ""), true, "labor-law.pdf p.43");

// Overtime naming (Art. 107): rest-day and holiday hours are all overtime; >8h a day is overtime
{
  const ot = deriveNamedOvertime({
    employee: EMP,
    company: null,
    days: [
      { key: "2026-09-13", hours: 8 },
      { key: "2026-09-14", hours: 10 },
      { key: "2026-09-15", hours: 8 },
      { key: "2026-09-16", hours: 8 },
      { key: "2026-09-17", hours: 8 },
      { key: "2026-09-18", hours: 4 }, // the 6th worked day of a 5-day file (two rest days) → a rest day worked, all OT
    ],
  });
  check("Art. 107: 10h day → 2h OT; 6th day of a 5-day week 4h → 4h OT; total 6", ot.totalHours, 6, "Art. 107(3), Art. 98");
  check("Art. 107: rest-day kind named weekly_rest", ot.rows.find((r) => r.dateKey === "2026-09-18")?.kind, "weekly_rest");
}
// Art. 101/102 actual hours: 12h stay with 60 min rest = 11 actual
check("Art. 102: 23:00–07:00 with 60 min rest = 7 actual hours", actualShiftHours(NIGHT, D, EMP), 7);
check("Art. 101: 13h stay blocked", checkWorkplaceStayDutyGate({ shift: shift("06:00", "19:00", { restMinutes: 60 }), onDate: D }).error, "WORKPLACE_STAY");
check("Art. 101: 8h shift without rest blocked REST_5H_REQUIRED", checkConsecutiveWorkGate({ start: "07:00", end: "15:00", restMinutes: 0, onDate: D }).error, "REST_5H_REQUIRED");
check("Art. 101: 5h shift needs no rest", checkConsecutiveWorkGate({ start: "07:00", end: "12:00", restMinutes: 0, onDate: D }).ok, true);
// Juvenile gates
{
  const kid = { id: "k1", name: "حدث", stationId: "st1", profile: { birthDate: "2010-01-01" }, otherRequests: [] };
  check("16-year-old is a juvenile", isJuvenile(kid, D), true);
  check("Art. 164: juvenile 7h actual blocked", checkJuvenileHoursGate({ employee: kid, onDate: D, hours: 7, presenceHours: 7.5, consecutiveHours: 3.5 }).error, "JUVENILE_DAY_CAP");
  check("Art. 163: juvenile night minutes blocked", checkJuvenileHoursGate({ employee: kid, onDate: D, hours: 5, presenceHours: 5, consecutiveHours: 5, nightHours: 1 }).error, "JUVENILE_NIGHT_BAN");
  check("Art. 164: juvenile on Friday blocked", checkJuvenileHoursGate({ employee: kid, onDate: D, hours: 5, presenceHours: 5, consecutiveHours: 2.5, restDay: true }).error, "JUVENILE_REST_BAN");
  const under = { ...kid, profile: { birthDate: "2013-01-01" } };
  check("Art. 162: under 15 blocked", checkJuvenileRosterGate({ employee: under, shift: MORN, onDate: D }).error, "JUVENILE_UNDER_AGE");
}
// Art. 100 three-week average only when rotating
const ROT100 = { hoursPolicy: { rotatingShifts: true, art100ApprovalNo: "M-100-7", art100ApprovalDate: "2026-01-05" } };
check("Art. 100: 3-week average above 48 blocked when rotating with Ministry approval", checkThreeWeekAverageGate({ weekHours: [54, 50, 46], onDate: D, employee: EMP, company: ROT100 }).error, "ARTICLE_100_AVERAGE");
check("Art. 100: rotating without the approval number/date averages nothing", checkThreeWeekAverageGate({ weekHours: [54, 50, 46], onDate: D, employee: EMP, company: { hoursPolicy: { rotatingShifts: true } } }).approvalMissing, true);
check("Art. 100: 3-week average within 48 passes", checkThreeWeekAverageGate({ weekHours: [54, 46, 44], onDate: D, employee: EMP, company: ROT100 }).ok, true);

/* ------------------------------------------------------------------ */
section("Labour Law — roster checks added from the M/51 text (Arts. 98, 104, 107, 151, 154, 161, 163, 165)");
{
  const W = "2026-09-13"; // Sunday; Friday 2026-09-18 is the default weekly rest
  const S = (id, start, end, rest = 30, extra = {}) => ({ id, label: id, start, end, restMinutes: rest, ...extra });
  const T = {
    eve: S("eve", "15:00", "23:00"),
    morn: S("morn", "07:00", "15:00"),
    early: S("early", "06:00", "14:00"),
    stay: S("stay", "19:00", "07:00", 60),
    day12: S("day12", "07:00", "19:00", 60),
    long: S("long", "07:00", "17:30", 30),
    jEve: S("jEve", "16:00", "22:00", 30),
    jEarly: S("jEarly", "06:00", "12:00", 30),
    jLate: S("jLate", "10:00", "16:00", 30),
  };
  const types = Object.values(T);
  const run = (assign, employees, weekStart = W) => checkWeekPublishGates({
    schedule: schedWith(assign, types), employees, weekStart, stationId: "st1", today: weekStart,
  });
  const gate = (g, id) => g.checks.find((c) => c.id === id);
  const labourRow = (g, article) => buildLawGatesBoard({ gates: g, onDate: W, ar: true }).labour.rows.find((r) => r.article === article);

  // Art. 104(2) — 24 consecutive hours. Fri is free but Thu 19:00→Fri 07:00 then Sat 06:00 leaves 23h.
  const restAssign = (thu) => ({
    "2026-09-12": { eve: ["e1"] },
    "2026-09-13": { eve: ["e1"] }, "2026-09-14": { eve: ["e1"] }, "2026-09-15": { eve: ["e1"] }, "2026-09-16": { eve: ["e1"] },
    "2026-09-17": { [thu]: ["e1"] },
    "2026-09-19": { early: ["e1"] },
    "2026-09-20": { morn: ["e1"] },
  });
  const short = run(restAssign("stay"), [EMP]);
  check("Art. 104(2): longest rest 23h when a night spill-over cuts the rest day", longestWeeklyRestHours(schedWith(restAssign("stay"), types), EMP, W), 23, "labor-law.pdf Art. 104(2) «لا يقل عن أربع وعشرين ساعة متتالية»");
  check("Art. 104(2): weekly_rest (a free day) still passes", gate(short, "weekly_rest")?.ok, true);
  check("Art. 104(2): weekly_rest_24h warns at 23h", gate(short, "weekly_rest_24h")?.ok, false);
  check("Art. 104(2): weekly_rest_24h is a warning, not a publish block", gate(short, "weekly_rest_24h")?.block, false);
  check("Art. 104(2): board row 104 points at weekly_rest_24h", labourRow(short, "104")?.checkId, "weekly_rest_24h");
  const full = run(restAssign("morn"), [EMP]);
  check("Art. 104(2): Thu 15:00 → Sat 06:00 (39h) passes", gate(full, "weekly_rest_24h")?.ok, true);
  check("Art. 104(2): board row 104 settled", labourRow(full, "104")?.status, "settled");

  // Art. 98 — Ramadan 36h a week on the weekly criterion (12h stay is not cut to 6 a day).
  const RW = "2026-03-01";
  check("2026-03-01 is a Ramadan day (week clear of Founding Day 22 Feb)", isRamadanDay("2026-03-01"), true);
  const stay4 = { "2026-03-01": { day12: ["e1"] }, "2026-03-02": { day12: ["e1"] }, "2026-03-03": { day12: ["e1"] }, "2026-03-04": { day12: ["e1"] } };
  const r4 = run(stay4, [EMP], RW);
  check("Art. 98: four 12h-stay Ramadan days (44 actual) — existing daily ramadan gate unchanged", gate(r4, "ramadan")?.ok, true);
  check("Art. 98: four 12h-stay Ramadan days (44 actual) warn ramadan_week_36", gate(r4, "ramadan_week_36")?.ok, false, "labor-law.pdf Art. 98 «أو ست وثلاثين ساعة في الأسبوع»");
  check("Art. 98: board row 98 points at ramadan_week_36", buildLawGatesBoard({ gates: r4, onDate: RW, ar: true }).labour.rows.find((r) => r.article === "98")?.checkId, "ramadan_week_36");
  const stay3 = { "2026-03-01": { day12: ["e1"] }, "2026-03-02": { day12: ["e1"] }, "2026-03-03": { day12: ["e1"] } };
  check("Art. 98: three 12h-stay Ramadan days (33 actual) pass", gate(run(stay3, [EMP], RW), "ramadan_week_36")?.ok, true);
  check("Art. 98: recorded non-Muslim is out of ramadan_week_36", gate(run(stay4, [{ ...EMP, profile: { religion: "non_muslim" } }], RW), "ramadan_week_36")?.ok, true);
  check("Art. 98: outside Ramadan ramadan_week_36 is not applicable", gate(run(stay4, [EMP], W), "ramadan_week_36")?.applicable, false);

  // Art. 107 — hours above the ordinary daily cap are named overtime (+50%).
  const ot = run({ "2026-09-14": { long: ["e1"] }, "2026-09-15": { morn: ["e1"] } }, [EMP]);
  check("Art. 107: 07:00–17:30 (10 actual) names 2h overtime", ot.overtimeNamed?.[0]?.hours, 2, "labor-law.pdf Art. 107(1)");
  check("Art. 107: overtime_107 is a warning", `${gate(ot, "overtime_107")?.ok}/${gate(ot, "overtime_107")?.block}`, "false/false");
  check("Art. 107: board row 107 waiting", labourRow(ot, "107")?.status, "waiting");
  const noOt = run({ "2026-09-14": { morn: ["e1"] } }, [EMP]);
  check("Art. 107: 7.5 actual hours → no overtime", gate(noOt, "overtime_107")?.ok, true);
  check("Art. 107: no overtime → board row 107 void", labourRow(noOt, "107")?.status, "void");
  const compressed = run({ "2026-09-13": { day12: ["e1"] }, "2026-09-14": { day12: ["e1"] }, "2026-09-15": { day12: ["e1"] }, "2026-09-16": { day12: ["e1"] } }, [EMP]);
  check("Art. 107(2): 4×12h-stay week (weekly criterion, 44h) is not daily overtime", gate(compressed, "overtime_107")?.ok, true);
  check("Art. 108: senior-management category is out of overtime_107", gate(run({ "2026-09-14": { long: ["e1"] } }, [{ ...EMP, profile: { hoursCategory108: "management" } }]), "overtime_107")?.ok, true);
  const legacy = run({ "2026-09-14": { long: ["e1"] } }, [{ ...EMP, profile: { hoursExempt108: true } }]);
  check("Art. 108: a bare legacy boolean is not an exemption — ordinary OT applies", gate(legacy, "overtime_107")?.ok, false);
  check("Art. 108: a bare legacy boolean asks for the category (warning)", `${gate(legacy, "art108_category")?.ok}/${gate(legacy, "art108_category")?.block}`, "false/false");

  // Art. 151(1) — six mandatory weeks after birth.
  const mom = { ...EMP, profile: { gender: "female", childBirthDate: "2026-09-01" } };
  check("Art. 151: 2026-09-14 is day 13 after birth → mandatory", isMandatoryPostnatalDay(mom, "2026-09-14"), true, "labor-law.pdf Art. 151(1) «منها وجوبياً الأسابيع الستة التالية للوضع»");
  check("Art. 151: day 42 after birth is free", isMandatoryPostnatalDay(mom, addLaborDays("2026-09-01", 42)), false);
  const post = run({ "2026-09-14": { morn: ["e1"] } }, [mom]);
  check("Art. 151: duty inside the six weeks warns maternity_postnatal", gate(post, "maternity_postnatal")?.ok, false);
  check("Art. 151: board row 151 alert", labourRow(post, "151")?.status, "alert");
  const fromLeave = { ...EMP, profile: { gender: "female" }, leaveRequests: [{ type: "maternity", status: "approved", startDate: "2026-08-20", endDate: "2026-09-10", eventDate: "2026-09-05" }] };
  check("Art. 151: birth read from the approved maternity event date", postnatalBirthDate(fromLeave), "2026-09-05");
  check("Art. 151: duty after early leave end still inside six weeks warns", gate(run({ "2026-09-14": { morn: ["e1"] } }, [fromLeave]), "maternity_postnatal")?.ok, false);
  const later = run({ "2026-09-14": { morn: ["e1"] } }, [{ ...EMP, profile: { gender: "female", childBirthDate: "2026-07-01" } }]);
  check("Art. 151: 75 days after birth passes and is not applicable", `${gate(later, "maternity_postnatal")?.ok}/${gate(later, "maternity_postnatal")?.applicable}`, "true/false");
  check("Art. 151: not applicable → board row 151 void", labourRow(later, "151")?.status, "void");
  check("Art. 151: a male file with a child birth date is out of scope", postnatalBirthDate({ profile: { gender: "male", childBirthDate: "2026-09-01" } }), "");

  // Art. 154 — nursing hour counted as working time (informational, applicability only).
  const nursingMom = { ...EMP, profile: { gender: "female" }, leaveRequests: [{ type: "maternity", status: "approved", startDate: "2026-05-25", endDate: "2026-08-16", eventDate: "2026-06-01" }] };
  const nurse = run({ "2026-09-14": { morn: ["e1"] } }, [nursingMom]);
  check("Art. 154: nursing worker on duty → nursing_hour applies", `${gate(nurse, "nursing_hour")?.ok}/${gate(nurse, "nursing_hour")?.applicable}`, "true/true", "labor-law.pdf Art. 154");
  check("Art. 154: board row 154 settled for a nursing worker", labourRow(nurse, "154")?.status, "settled");
  check("Art. 154: no nursing worker → board row 154 void (not settled)", labourRow(noOt, "154")?.status, "void");

  // Art. 163 — a juvenile's night period of at least twelve consecutive hours off.
  const kid = { id: "k1", name: "حدث", stationId: "st1", profile: { birthDate: "2010-01-01" }, otherRequests: [] };
  const kidShort = run({ "2026-09-13": { jEve: ["k1"] }, "2026-09-14": { jEarly: ["k1"] } }, [kid]);
  check("Art. 163: 22:00 → 06:00 (8h) never touches the 18632 window — juvenile_night passes", gate(kidShort, "juvenile_night")?.ok, true);
  check("Art. 163: …but the 12h night period is short — juvenile_night_gap warns", gate(kidShort, "juvenile_night_gap")?.ok, false, "labor-law.pdf Art. 163 «فترة من الليل لا تقل عن اثنتي عشرة ساعة متتالية»");
  check("Art. 163: board row 163 points at juvenile_night_gap", labourRow(kidShort, "163")?.checkId, "juvenile_night_gap");
  const kidOk = run({ "2026-09-13": { jEve: ["k1"] }, "2026-09-14": { jLate: ["k1"] } }, [kid]);
  check("Art. 163: 22:00 → 10:00 (12h) passes", gate(kidOk, "juvenile_night_gap")?.ok, true);
  check("Art. 163: no juvenile → board rows 163/164 void", `${labourRow(noOt, "163")?.status}/${labourRow(noOt, "164")?.status}`, "void/void");

  // Art. 161 — hazardous work flagged for a juvenile.
  const kidHaz = run({ "2026-09-14": { jLate: ["k1"] } }, [{ ...kid, profile: { ...kid.profile, hazardousHours: true } }]);
  check("Art. 161: juvenile with hazardous work flag warns juvenile_hazard", gate(kidHaz, "juvenile_hazard")?.ok, false, "labor-law.pdf Art. 161");
  check("Art. 161: board row 161 alert", labourRow(kidHaz, "161")?.status, "alert");
  check("Art. 161: juvenile without the flag passes", gate(kidOk, "juvenile_hazard")?.ok, true);
  check("Art. 161: adult with the flag → not applicable, row void", `${gate(run({ "2026-09-14": { morn: ["e1"] } }, [{ ...EMP, profile: { hazardousHours: true } }]), "juvenile_hazard")?.applicable}/${labourRow(noOt, "161")?.status}`, "false/void");

  // Art. 162 / 165 — no fake «استقرّ» without the data.
  check("Art. 162: no birth date on file → board row 162 void (needs the date)", labourRow(noOt, "162")?.status, "void");
  check("Art. 162: a birth date on file → row 162 settled", labourRow(kidOk, "162")?.status, "settled");
  check("Art. 165: juvenile on roster without documents → juvenile_docs warns (not a block)", `${gate(kidOk, "juvenile_docs")?.ok}/${gate(kidOk, "juvenile_docs")?.block}`, "false/false", "labor-law.pdf Art. 165");
  check("Art. 165: board row 165 open with the name", `${labourRow(kidOk, "165")?.status}/${labourRow(kidOk, "165")?.who}`, "waiting/حدث");
  const kidDocs = { ...kid, profile: { ...kid.profile, juvenileIdDoc: true, juvenileFitnessCert: true, juvenileGuardianConsent: true, juvenileOfficeNotifiedAt: "2026-09-01", guardianFullName: "سالم بن محمد العتيبي", juvenileResidence: "الرس — حي الخالدية" } };
  const kidFiled = run({ "2026-09-13": { jEve: ["k1"] }, "2026-09-14": { jLate: ["k1"] } }, [kidDocs]);
  check("Art. 165–166: documents + office notice on file → juvenile_docs passes, row settled", `${gate(kidFiled, "juvenile_docs")?.ok}/${labourRow(kidFiled, "165")?.status}`, "true/settled");
  check("Art. 165: no juvenile → row 165 void", labourRow(noOt, "165")?.status, "void");
  // Art. 104(1) — Friday replaced only after notifying the labour office, with religious duties enabled.
  const fridayRun = (posting) => checkWeekPublishGates({
    schedule: schedWith({ "2026-09-14": { morn: ["e1"] } }, types), employees: [EMP], weekStart: W, stationId: "st1", today: W,
    company: { hoursPolicy: { workPosting: posting } },
  });
  check("Art. 104(1): Friday a rest day → weekly_rest_friday not applicable", gate(fridayRun({ weeklyRestDow: 5, weeklyOffDows: [5, 6] }), "weekly_rest_friday")?.applicable, false, "labor-law.pdf Art. 104(1)");
  check("Art. 104(1): Sun+Mon rest without notice → warns", `${gate(fridayRun({ weeklyRestDow: 0, weeklyOffDows: [0, 1] }), "weekly_rest_friday")?.ok}/${gate(fridayRun({ weeklyRestDow: 0, weeklyOffDows: [0, 1] }), "weekly_rest_friday")?.block}`, "false/false");
  check("Art. 104(1): notice date + religious duties → passes", gate(fridayRun({ weeklyRestDow: 0, weeklyOffDows: [0, 1], fridaySwapNotifiedAt: "2026-09-01", religiousDutiesEnabled: true }), "weekly_rest_friday")?.ok, true);
  check("Art. 104(1): board row 104 points at weekly_rest_friday when open", buildLawGatesBoard({ gates: fridayRun({ weeklyRestDow: 0, weeklyOffDows: [0, 1] }), onDate: W, ar: true }).labour.rows.find((r) => r.article === "104")?.checkId, "weekly_rest_friday");
  check("Labour board: article keys are unique", (() => {
    const list = buildLawGatesBoard({ gates: kidOk, onDate: W, ar: true }).labour.rows.map((r) => r.article);
    return new Set(list).size === list.length;
  })(), true);
  check("Art. 161 cite row is a Labour Law chip", citeRule("hours.juvenile.hazard.cite", W)?.article, "161");
}

/* ------------------------------------------------------------------ */
section("Copy sanity — the rights note quotes the decision's 45-day threshold");
check("rights note (ar) mentions 45 يوم", /45/.test(decision18632RightsNote(true)), true, "18632 p.3 رابعاً");
check("laborRules hint for compensateOrReduce mentions 45 not 5 days", /45/.test(ruleAt("hours.night.compensateOrReduce", D)?.hintAr || ""), true);
check("every hours.night.* rule row is ministerial (no Labour Law chip)", LABOR_RULES.filter((r) => r.id.startsWith("hours.night.")).every((r) => r.source === "ministerial" && r.article === null), true);
check("every hours.heat.* figure row is ministerial", LABOR_RULES.filter((r) => r.id.startsWith("hours.heat.") && r.id !== "hours.heat.cite").every((r) => r.source === "ministerial"), true);
check("citeRule never emits a المادة chip for 18632 figures", citeRule("hours.night.restHours", D), null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log(`FAILED:\n - ${failures.join("\n - ")}`);
  process.exit(1);
}
