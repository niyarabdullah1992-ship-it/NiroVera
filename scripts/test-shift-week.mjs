import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  checkShiftChangeApplyGate,
  checkWeekPublishGates,
  weekPublishSubmitBlock,
  weekCellAlert,
  weekHeatBanWorkerNotice,
  weekDutyStripAlerts,
  groupDutyStripByPerson,
  dutyStripPeopleSummary,
  weekStationDutyNotes,
  heatBanTodayKey,
  isLiveHeatBanDay,
  isHistoricalHeatBanDay,
  attachNightDueStripCards,
  weekDutyStripEmptyCopy,
  weekHeatBanStripCopy,
  dutyStripBody,
  WEEK_DUTY_STRIP_IDS,
  employeeFileLaborWeek,
  employeeFileNightPanel,
  cycleShiftId,
  ordinaryShiftId,
  ordinaryShiftTypes,
  weekNightDateKeys,
  cardWantsOrdinaryChoice,
  cardAwaitsNightConsent,
  nightConsentWaitCopy,
  employeeNeedsNightRotateChoice,
  MINISTRY_NIGHT_PUBLISH_BLOCK_IDS,
  checkNightRestApplyGate,
  checkWorkplaceStayDutyGate,
  checkFourOnFourDutyPattern,
  isTwelveStayDuty,
  ramadanUsesDailySixCap,
  employeeOnCompressedTwelveWeek,
  adjacentDutyPairs,
  nightRestPairHits,
  employeeShiftOnDay,
  employeeWeekHours,
  leaveOnDayView,
  isNightShift,
  weekValidityNote,
  nightMinutesInWindow,
  performsNightWork,
  checkNightCompensateOrReduceGate,
  checkNightPerformerCompensationGate,
  checkNightReduceHoursGate,
  checkNightAllowanceGate,
  nightAllowanceAmount,
  nightAllowanceKind,
  nightAllowancePayLabel,
  nightCutHoursLabel,
  nightReduceCutHours,
  payableNightAllowance,
  shortenShiftByHours,
  activeNightRemedy,
  hasNightConsent,
  hasNightHoursReduction,
  nightRemedyIsWithdrawable,
  nightStreakWeeks,
  addDays,
  weekDateKeys,
  reducedNightShiftSpec,
  remapEmployeeNightWorkerDays,
  shiftCompactMark,
  shiftHistMark,
  shiftHours,
  actualShiftHours,
  weekKeyFromDate,
  weekRosterEmployees,
  weekStartDate,
  employeeWorkStationId,
  calendarLaneEmployees,
  calendarOverlayEmployees,
  LEAVE_STYLE,
  LEAVE_CITE_STYLE,
  rosterBranchPhrase,
  rosterMineScopeCopy,
  rosterTableHeading,
  rosterTableStation,
} from "../src/lib/shiftWeek.js";
import { checkPublishGates } from "../src/lib/shiftDerivations.js";
import { calendarDateKey, datedDayAssignmentMap } from "../src/lib/attendanceCalendar.js";
import {
  nightMedicalDutyState,
  nightMedicalFileSatisfied,
  nightMedicalReportOf,
  nightMedicalYearSpanDays,
} from "../src/lib/decision18632.js";
import { addLaborDays, isRamadanDay, laborDayKey } from "../src/lib/laborRules.js";
import { heatBanWindow, isHeatBanDate } from "../src/lib/contractLawDerivations.js";
import { riyadhClock } from "../src/lib/opsDerivations.js";
import { heatBanDecisionLabel } from "../src/lib/heatBanDecision.js";
import { approvedLeaveOnDay } from "../src/lib/leaveTypes.js";
import { statutoryChipStyle } from "../src/lib/statutoryItem.js";
import { checkSubmitOtherRequestGate, OTHER_REQUEST_TYPES, pendingManagerDecideCount } from "../src/lib/otherRequestDerivations.js";
import {
  answeredNightRotateThisMonth,
  applyNightWorkerDecision,
  checkDecideNightRemedyGate,
  checkNightAgreeGate,
  checkNightEmployeeActorGate,
  checkNightManagementActorGate,
  checkWithdrawNightConsentGate,
  checkWithdrawNightRemedyGate,
  collectDueNightRotates,
  nightCycleKey,
  nightMonthsFromWeeks,
  nightRotateDue,
  nightRotateRequestDraft,
  nightRotateStage,
  onNightsThisWeek,
  shouldLapseNightRotate,
} from "../src/lib/nightRotateCycle.js";
import { dutyLaneFromSearch, writeDutyLane } from "../src/lib/dutyLane.js";
import { managedDutyEmployees } from "../src/lib/dutyScope.js";

assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === "shift_change"));
assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === "night_consent"));

const night = { id: "night", label: "ليلي", start: "23:00", end: "07:00", restMinutes: 30 };
const morning = { id: "morning", label: "صباحي", start: "07:00", end: "15:00", restMinutes: 30 };
assert.equal(shiftHours(morning), 8);
assert.equal(actualShiftHours(morning, "2026-09-06"), 7.5);
assert.ok(nightMinutesInWindow(night.start, night.end) >= 180);
assert.equal(isNightShift(night), true);
assert.equal(isNightShift(morning), false);
assert.equal(isNightShift({ id: "evening", label: "مسائي", start: "15:00", end: "23:00" }), false);
assert.equal(performsNightWork({ start: "23:00", end: "01:30" }), true, "guide 1 performs");
assert.equal(isNightShift({ start: "23:00", end: "01:30" }), false, "guide 1: 2.5h is not a night worker");
assert.equal(isNightShift({ start: "23:00", end: "02:00" }), true, "guide 2: through 02:00 is a night worker");
assert.equal(performsNightWork({ start: "04:00", end: "06:00" }), true, "guide 4 performs");
assert.equal(isNightShift({ start: "04:00", end: "06:00" }), false, "guide 4: 2h is not a night worker");
assert.equal(isNightShift({ start: "04:00", end: "14:00" }), false, "guide 4 then morning is not a night worker");
assert.equal(isNightShift({ id: "late", start: "18:00", end: "01:00" }), false, "evening crossing midnight is not a night worker");
assert.equal(performsNightWork({ id: "late", start: "18:00", end: "01:00" }), true);
assert.equal(isNightShift({ id: "after", start: "00:15", end: "02:00" }), false, "after-midnight-only short window is not a night worker");
assert.equal(performsNightWork({ id: "after", start: "00:15", end: "02:00" }), true);
assert.equal(isNightShift({ id: "noon", start: "12:00", end: "20:00" }), false);
assert.equal(shiftCompactMark(night, { ar: true }), "ليلي");
assert.equal(shiftCompactMark(morning, { ar: true }), "صباحي");
assert.equal(shiftCompactMark({ id: "evening", label: "مسائي", start: "15:00", end: "23:00" }, { ar: true }), "مسائي");
assert.equal(shiftCompactMark({ id: "night", start: "23:00", end: "07:00" }, { ar: true }), "ليلي");
assert.equal(shiftHistMark(night, { ar: true }), "ل");
assert.equal(shiftHistMark(morning, { ar: true }), "ص");
assert.equal(shiftHistMark({ id: "evening", label: "مسائي", start: "15:00", end: "23:00" }, { ar: true }), "م");
assert.equal(shiftHistMark(null, { ar: true, leave: true }), "إ");
assert.equal(shiftHistMark(null, { ar: true }), "·");
assert.equal(cycleShiftId([morning, night], "morning"), "night");
assert.equal(cycleShiftId([morning, night], "night"), null);
assert.equal(cycleShiftId([morning, night], "morning", null), "night");
assert.equal(cycleShiftId([morning, night], "morning", ""), null);
assert.equal(cycleShiftId([morning, night], "morning", "night"), "night");
assert.equal(cycleShiftId([morning, { id: "evening", start: "15:00", end: "23:00" }, night], "morning"), "evening");
assert.equal(cycleShiftId([morning, night], "morning", null, { ordinaryOnly: true }), null);
assert.equal(ordinaryShiftTypes([morning, night]).map((row) => row.id).join(","), "morning");
assert.equal(ordinaryShiftId([morning, { id: "evening", start: "15:00", end: "23:00" }, night], "morning"), "morning");
assert.equal(ordinaryShiftId([morning, { id: "evening", start: "15:00", end: "23:00" }, night], "evening"), "evening");

const weekStart = weekStartDate("2026-09-06");
assert.equal(weekKeyFromDate(weekStart), "2026-09-06");
const weekClock = weekDateKeys(weekStart)[1];

const omar = { id: "omar", name: "عمر ناصر", stationId: "st", profile: {}, leaveRequests: [] };
const ahmed = { id: "ahmed", name: "أحمد", stationId: "st", profile: {}, leaveRequests: [] };
const schedule = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: {
    0: { morning: ["ahmed"], night: ["omar"] },
    1: { morning: ["ahmed"], night: ["omar"] },
    2: { morning: ["ahmed"], night: ["omar"] },
    3: { morning: ["ahmed"], night: ["omar"] },
    4: { morning: ["ahmed"], night: ["omar"] },
  },
};

const visitor = { id: "visitor", name: "زائر", stationId: "other" };
const fatima = { id: "fatima", name: "فاطمة", stationId: "st" };
const rosterWeek = weekRosterEmployees(
  { ...schedule, assignments: { ...schedule.assignments, "2026-08-01": { morning: ["visitor"] } } },
  [omar, ahmed, visitor, fatima],
  "st",
  ["2026-09-07"],
);
assert.ok(rosterWeek.some((row) => row.id === "omar"));
assert.ok(rosterWeek.some((row) => row.id === "fatima"));
assert.ok(!rosterWeek.some((row) => row.id === "visitor"));
const homeOnlyWeek = weekRosterEmployees(
  { ...schedule, assignments: { "2026-09-07": { morning: ["visitor"] } } },
  [omar, visitor],
  "st",
  ["2026-09-07"],
  { homeOnly: true },
);
assert.ok(!homeOnlyWeek.some((row) => row.id === "visitor"));
assert.ok(homeOnlyWeek.some((row) => row.id === "omar"));
assert.ok(weekNightDateKeys(schedule, "omar", weekStart).length > 0);
const gapSchedule = {
  stationId: "st",
  shiftTypes: [morning, { id: "evening", start: "15:00", end: "23:00", label: "مسائي", restMinutes: 30 }],
  assignments: {
    "2026-09-13": { evening: ["ahmed"] },
    "2026-09-14": { morning: ["ahmed"] },
  },
};
const gapGates = checkWeekPublishGates({
  schedule: gapSchedule,
  employees: [ahmed],
  weekStart: weekStartDate("2026-09-13"),
  ar: true,
});
assert.equal(gapGates.checks.find((row) => row.id === "gap_11")?.ok, false);
assert.equal(gapGates.checks.find((row) => row.id === "gap_11")?.block, false);
assert.ok(!gapGates.blockers.some((row) => row.id === "gap_11"));
assert.equal(weekCellAlert(gapGates, "ahmed", "2026-09-13")?.id, "gap_11");
assert.equal(weekCellAlert(gapGates, "ahmed", "2026-09-13")?.level, "warn");

assert.equal(checkShiftChangeApplyGate({
  schedule,
  employee: { id: "muslim", name: "مسلم", stationId: "st", profile: {} },
  dateKey: "2026-02-20",
  shiftTypeId: "morning",
}).error, "RAMADAN_DAY_CAP", "empty religion is under the Art. 98 day cap");
assert.equal(checkShiftChangeApplyGate({
  schedule,
  employee: { id: "other", name: "غير مسلم", stationId: "st", profile: { religion: "non_muslim" } },
  dateKey: "2026-02-20",
  shiftTypeId: "morning",
}).ok, true, "recorded non-Muslim may keep ordinary hours in Ramadan");
assert.equal(employeeShiftOnDay(schedule, "omar", "2026-09-07")?.id, "night");
assert.equal(datedDayAssignmentMap(schedule.assignments, "2026-08-31"), null, "weekday template is not 18632 lookback");
assert.equal(nightStreakWeeks(schedule, "omar", weekStart), 0, "weekday keys 0–4 are not historical night work");
assert.equal(nightMonthsFromWeeks(1), 0, "fresh weekday preview is not 4.8 months");
assert.notEqual(nightMonthsFromWeeks(1), 4.8);
assert.equal(nightRotateDue({ employee: omar, schedule, weekStart }).months ?? 0, 0);

function datedNightWeeks(employeeId, fromWeek, count) {
  const assignments = {};
  for (let w = 0; w < count; w += 1) {
    const start = addDays(fromWeek, -7 * w);
    for (const key of weekDateKeys(start)) {
      const wd = new Date(`${key}T00:00:00`).getDay();
      if (wd >= 0 && wd <= 4) assignments[key] = { night: [employeeId] };
    }
  }
  return assignments;
}

const longNight = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: datedNightWeeks("omar", weekStart, 14),
};
assert.ok(nightStreakWeeks(longNight, "omar", weekStart) >= 13);

const blocked = checkWeekPublishGates({
  schedule: longNight,
  employees: [omar, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
assert.equal(blocked.blocked, true);
assert.ok(blocked.checks.find((row) => row.id === "night_rotate" && !row.ok));
assert.equal(blocked.checks.find((row) => row.id === "night_rotate")?.ruleId, "hours.night.rotateWeeks");
assert.equal(blocked.checks.find((row) => row.id === "night_rest")?.ruleId, "hours.night.restHours");
assert.equal(blocked.checks.find((row) => row.id === "hours_48")?.ruleId, "hours.week.ordinaryMaxHours");
assert.equal(blocked.checks.find((row) => row.id === "heat_ban")?.ruleId, "hours.heat.startHour");
assert.equal(blocked.checks.find((row) => row.id === "heat_ban")?.block, false);
for (const id of MINISTRY_NIGHT_PUBLISH_BLOCK_IDS) {
  assert.equal(blocked.checks.find((row) => row.id === id)?.block, true, `${id} stays a Decision 18632 publish block`);
}
assert.equal(blocked.checks.find((row) => row.id === "gap_11")?.block, false, "11h gap stays product policy");

assert.equal(hasNightConsent({ profile: { nightConsentAt: "2026-01-01" } }, weekStart), true, "18632 consent stays on file until withdrawn");
assert.equal(hasNightConsent({ profile: { nightConsentAt: "2026-09-12" } }, weekStart), true);
assert.equal(hasNightConsent({ profile: { nightConsentAt: "2026-01-01", nightConsentWithdrawnAt: "2026-08-01" } }, weekStart), false);
omar.profile.nightConsentAt = "2026-09-12";
const allowed = checkWeekPublishGates({
  schedule: longNight,
  employees: [omar, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
assert.equal(allowed.checks.find((row) => row.id === "night_rotate").ok, true);

const onFile = employeeFileLaborWeek({ employee: omar, schedule, weekStart, ar: true });
assert.ok(onFile.checks.every((row) => row.id !== "morning_cover" && row.id !== "not_empty"));
assert.ok(onFile.checks.some((row) => row.id === "hours_48"));
assert.ok(onFile.checks.some((row) => row.id === "night_rotate"));
const payEq = onFile.checks.find((row) => row.id === "night_pay_equality");
assert.ok(payEq);
assert.doesNotMatch(payEq.note, /18632/, "passing pay-equality note is not a 18632 wall");
const morningColleague = { id: "niyar", name: "نيار عبدالله", stationId: "st", profile: {}, leaveRequests: [] };
const mixedFile = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: {
    1: { morning: ["niyar"], night: ["omar"] },
    2: { morning: ["niyar"], night: ["omar"] },
    3: { morning: ["niyar"], night: ["omar"] },
    4: { morning: ["niyar"], night: ["omar"] },
    5: { morning: ["niyar"], night: ["omar"] },
  },
};
const morningFile = employeeFileLaborWeek({ employee: morningColleague, schedule: mixedFile, weekStart, ar: true });
const morningFileText = morningFile.checks.map((row) => `${row.title} ${row.note}`).join(" ");
assert.doesNotMatch(morningFileText, /عمر/);
assert.doesNotMatch(morningFileText, /تعويض ليلي|23:00|لا عامل ليلي/, "morning self file is not a night essay");
assert.ok(!morningFile.checks.some((row) => String(row.id).startsWith("night_")));
const morningPanel = employeeFileNightPanel({ employee: morningColleague, schedule: mixedFile, weekStart, ar: true });
assert.equal(morningPanel.rows.length, 0);
assert.doesNotMatch(morningPanel.text || "", /عمر/);

const leaveEmp = {
  id: "ahmed",
  name: "أحمد",
  leaveRequests: [{ status: "approved", startDate: "2026-09-07", endDate: "2026-09-09" }],
};
const leaveGate = checkShiftChangeApplyGate({
  schedule,
  employee: leaveEmp,
  dateKey: "2026-09-07",
  shiftTypeId: "morning",
});
assert.equal(leaveGate.ok, false);
assert.equal(leaveGate.error, "ON_LEAVE");

const consentGate = checkShiftChangeApplyGate({
  schedule: longNight,
  employee: { id: "omar", name: "عمر", profile: {} },
  dateKey: "2026-09-07",
  shiftTypeId: "night",
});
assert.equal(consentGate.ok, false);
assert.equal(consentGate.error, "NIGHT_CONSENT_REQUIRED");
assert.match(consentGate.reason, /صباحي أو مسائي/);
assert.match(consentGate.reason, /وافق الموظف/);
assert.equal(employeeNeedsNightRotateChoice({ id: "omar", profile: {} }, longNight, "2026-09-07"), true);
assert.equal(employeeNeedsNightRotateChoice({ id: "omar", profile: { nightConsentAt: "2026-01-01" } }, longNight, "2026-09-07"), false);
assert.equal(employeeNeedsNightRotateChoice({ id: "omar", profile: {} }, schedule, "2026-09-07"), false);
assert.equal(cardWantsOrdinaryChoice({ gateId: "night_rotate" }), true);
assert.equal(cardWantsOrdinaryChoice({ gateId: "night_rest" }), false);
assert.equal(cardWantsOrdinaryChoice({ gateId: "gap_11" }), false);
assert.equal(cardAwaitsNightConsent({ gateId: "night_rotate" }), true);
assert.equal(cardAwaitsNightConsent({ items: [{ gateId: "night_rotate" }] }), true);
assert.equal(cardAwaitsNightConsent({ gateId: "gap_11" }), false);
assert.match(nightConsentWaitCopy(true), /تجاوز ثلاثة أشهر/);
assert.match(nightConsentWaitCopy(true), /لا تُحذف وردية الليل/);
assert.match(nightConsentWaitCopy(true, { audience: "employee" }), /وافق من طلباتي/);
assert.equal(checkShiftChangeApplyGate({
  schedule,
  employee: { id: "omar", name: "عمر", profile: {} },
  dateKey: "2026-09-07",
  shiftTypeId: "night",
}).ok, true, "fresh weekday template is not a 18632 block");

const sara = {
  id: "sara",
  name: "سارة حسن",
  stationId: "st",
  leaveRequests: [{ status: "approved", type: "annual", startDate: "2026-09-07", endDate: "2026-09-08" }],
};
assert.ok(approvedLeaveOnDay(sara, "2026-09-07"));
assert.equal(leaveOnDayView(sara, "2026-09-07", true).type, "سنوية");

const chapterLeaveDays = [
  ["annual", "2026-09-13", "سنوية"],
  ["grant", "2026-09-14", "رصيد"],
  ["sick", "2026-09-15", "مرضية"],
  ["exam", "2026-09-16", "امتحان"],
  ["marriage", "2026-09-17", "زواج"],
  ["bereavement", "2026-09-20", "وفاة زوج/أصل/فرع"],
  ["bereavement_sibling", "2026-09-21", "وفاة أخ/أخت"],
  ["maternity", "2026-09-22", "أمومة"],
  ["iddah", "2026-09-25", "عدّة وفاة الزوج"],
  ["paternity", "2026-09-23", "أبوة"],
  ["hajj", "2026-09-24", "حج"],
  ["emergency", "2026-09-27", "اضطرارية"],
  ["unpaid", "2026-09-28", "بدون راتب"],
];
const chapterPerson = {
  id: "chapter",
  name: "عمر",
  leaveRequests: chapterLeaveDays.map(([type, day]) => ({
    status: "approved",
    type,
    startDate: day,
    endDate: day,
  })),
};
for (const [type, day, label] of chapterLeaveDays) {
  assert.equal(approvedLeaveOnDay(chapterPerson, day)?.type, type, `${type} covers the roster day`);
  assert.equal(leaveOnDayView(chapterPerson, day, true)?.type, label, `${type} leave overlay label`);
}

const clashSchedule = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: {
    1: { morning: ["sara"] },
    2: { morning: ["ahmed"] },
  },
};
const clash = checkWeekPublishGates({
  schedule: clashSchedule,
  employees: [sara, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
assert.ok(clash.leaveDays >= 2);
const clashLeave = clash.checks.find((row) => row.id === "leave_excluded");
assert.equal(clashLeave?.ok, true, "approved leave stays leave");
assert.equal(clashLeave?.block, false);
assert.ok(!clash.blockers.some((row) => row.id === "leave_excluded"));
assert.doesNotMatch(weekPublishSubmitBlock(clash, { ar: true }), /إجازة/);
assert.equal(employeeWeekHours(clashSchedule, "sara", weekStart, sara), 0);

const cleanLeave = {
  stationId: "st",
  shiftTypes: [morning],
  assignments: {
    2: { morning: ["ahmed"] },
  },
};
const okLeave = checkWeekPublishGates({
  schedule: cleanLeave,
  employees: [sara, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
assert.equal(okLeave.checks.find((row) => row.id === "leave_excluded").ok, true);
assert.equal(okLeave.checks.find((row) => row.id === "leave_excluded").block, false);
assert.ok(okLeave.leaveDays >= 2);

const leaveCoverAssign = {};
for (const key of weekDateKeys(weekStart)) {
  const wd = new Date(`${key}T00:00:00`).getDay();
  if (wd >= 0 && wd <= 4) leaveCoverAssign[key] = { morning: ["ahmed", "sara"] };
}
const leavePublishGate = checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes: [morning], assignments: leaveCoverAssign },
  employees: [sara, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
assert.equal(leavePublishGate.checks.find((row) => row.id === "leave_excluded")?.ok, true);
assert.ok(!leavePublishGate.blockers.some((row) => row.id === "leave_excluded"));
assert.doesNotMatch(weekPublishSubmitBlock(leavePublishGate, { ar: true }), /إجازة/);

const monthlyMorning = { id: "morning", label: "صباحي", start: "07:00", end: "15:00", restMinutes: 30 };
const monthlyLeaveAssign = {};
for (let d = 1; d <= 31; d += 1) {
  const dow = new Date(2026, 7, d).getDay();
  if (dow === 5) continue;
  monthlyLeaveAssign[`2026-08-${String(d).padStart(2, "0")}`] = { morning: ["ahmed"] };
}
monthlyLeaveAssign["2026-08-03"] = { morning: ["ahmed", "sara"] };
const monthlyLeaveGate = checkPublishGates({
  year: 2026,
  monthIndex: 7,
  shiftTypes: [monthlyMorning],
  assignments: monthlyLeaveAssign,
  onLeaveIds: ["sara"],
  namesById: { sara: "سارة حسن", ahmed: "أحمد السالم" },
});
const monthlyLeave = monthlyLeaveGate.checks.find((row) => row.id === "leave_excluded");
assert.equal(monthlyLeave?.ok, true, "monthly leftover leave is informational");
assert.equal(monthlyLeave?.block, false);
assert.match(monthlyLeave?.labelAr || "", /سارة حسن/);
assert.match(monthlyLeave?.labelAr || "", /النشر جائز/);
assert.notEqual(monthlyLeaveGate.failed?.id, "leave_excluded");
assert.equal(monthlyLeaveGate.blocked, false, "leftover leave must not fail-block monthly publish");
assert.equal(weekCellAlert(leavePublishGate, "sara", "2026-09-07"), null, "leave cells keep leave look without a publish-edge");
assert.match(weekValidityNote({ validity: "week" }, weekStart, true), /الأسبوع التالي/);

const dated = checkSubmitOtherRequestGate({ type: "shift_change", reason: "ظرف عائلي", date: "" });
assert.equal(dated.error, "DATE_REQUIRED");
const nightText = checkSubmitOtherRequestGate({ type: "night_consent", reason: "نعم" });
assert.equal(nightText.error, "CONSENT_TEXT_REQUIRED");
const okNight = checkSubmitOtherRequestGate({
  type: "night_consent",
  reason: "أوافق على الاستمرار في العمل الليلي",
});
assert.equal(okNight.ok, true);
assert.equal(checkSubmitOtherRequestGate({ type: "night_consent", reason: "نعم", auto: true }).ok, true);

const omarFresh = { id: "omar", name: "عمر ناصر", stationId: "st", profile: {}, leaveRequests: [], otherRequests: [] };
assert.equal(onNightsThisWeek(omarFresh, schedule, weekStart), true);
assert.equal(nightRotateDue({ employee: omarFresh, schedule, weekStart }).due, false);
assert.equal(nightRotateDue({ employee: omarFresh, schedule, weekStart }).reason, "under_limit");
const dueOmar = nightRotateDue({ employee: omarFresh, schedule: longNight, weekStart });
assert.equal(dueOmar.due, true);
assert.ok(dueOmar.weeks > 13);
assert.equal(dueOmar.cycleKey, nightCycleKey(weekStart));
const draft = nightRotateRequestDraft(dueOmar);
assert.equal(draft.type, "night_consent");
assert.equal(draft.auto, true);
assert.equal(draft.actor, "employee");
assert.equal(draft.phase, "employee");
assert.equal(draft.violation, true);
assert.equal(nightRotateStage(draft), "active");
assert.match(draft.reason, /اكتب موافقة خطية|قسم التوقيع|حق التراجع|شهر عادي/);
assert.match(draft.reason, /حق التراجع/);
assert.doesNotMatch(draft.reason, /جدّد كل شهر|إعادة شهرية واجبة/);
assert.equal(draft.senderFile?.url, "/signing-preview-pumps.pdf");
const nightPaper = { name: "night-signed.pdf", url: "/signed.pdf" };
assert.equal(checkNightAgreeGate({ decision: "agree", acknowledged: false, paper: nightPaper }).error, "ACK_REQUIRED");
assert.equal(checkNightAgreeGate({ decision: "agree", acknowledged: true }).error, "PAPER_REQUIRED");
assert.equal(checkNightAgreeGate({ decision: "agree", acknowledged: true, paper: nightPaper }).ok, true);
assert.equal(checkNightAgreeGate({ decision: "reduce", acknowledged: false, paper: nightPaper }).error, "ACK_REQUIRED");
assert.equal(checkNightAgreeGate({ decision: "reduce", acknowledged: true, paper: nightPaper }).ok, true);
assert.equal(checkNightAgreeGate({ decision: "refuse" }).ok, true, "ministry refuse is direct");
assert.equal(nightRotateStage({
  type: "night_consent",
  status: "approved",
  decision: "agree",
}), "agreed_month");
assert.equal(nightRotateStage({
  type: "night_consent",
  status: "approved",
  decision: "reduce",
}), "reduced_hours");
assert.equal(nightRotateStage({
  type: "night_consent",
  status: "approved",
  decision: "agree",
  withdrawnAt: "2026-09-15",
}), "withdrawn");
assert.equal(checkWithdrawNightConsentGate({
  request: { type: "night_consent", status: "approved", decision: "agree" },
  acknowledged: false,
}).error, "ACK_REQUIRED");
assert.equal(checkWithdrawNightConsentGate({
  request: { type: "night_consent", status: "approved", decision: "agree" },
  acknowledged: true,
}).ok, true);
assert.equal(checkWithdrawNightConsentGate({
  request: { type: "night_consent", status: "pending" },
  acknowledged: true,
}).error, "NOT_CONSENTED");
assert.equal(checkNightEmployeeActorGate({ employeeId: "niyar", actorId: "ahmed" }).error, "EMPLOYEE_ONLY");
assert.equal(checkNightEmployeeActorGate({ employeeId: "niyar", actorId: "niyar" }).ok, true);

const reduced = reducedNightShiftSpec("2026-09-06");
assert.equal(reduced.start, "23:00");
assert.equal(reduced.end, "00:00");
assert.equal(isNightShift(reduced, "2026-09-06"), false);
assert.ok(nightMinutesInWindow(reduced.start, reduced.end, "2026-09-06") < 180);

const reduceSchedule = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: { "2026-09-06": { night: ["omar"] }, "2026-09-07": { night: ["omar"] } },
};
const reducedApply = applyNightWorkerDecision(reduceSchedule, "omar", "reduce", weekStart);
assert.equal(reducedApply.moved, 2);
assert.equal(onNightsThisWeek(omarFresh, reduceSchedule, weekStart), false);
assert.equal(employeeShiftOnDay(reduceSchedule, "omar", "2026-09-06")?.label, "ليلي مخفّض");

assert.equal(checkShiftChangeApplyGate({
  schedule: reduceSchedule,
  employee: { ...omarFresh, profile: { nightHoursReducedAt: "2026-09-12T00:00:00.000Z" } },
  dateKey: "2026-09-08",
  shiftTypeId: "night",
}).error, "NIGHT_HOURS_REDUCED");
assert.equal(hasNightHoursReduction({ profile: { nightHoursReducedAt: "2026-09-12T00:00:00.000Z" } }, weekStart), true);

assert.equal(checkNightManagementActorGate({ employeeId: "ahmed", actorId: "mgr" }).ok, true);
assert.equal(checkNightManagementActorGate({ employeeId: "ahmed", actorId: "ahmed" }).error, "MANAGEMENT_ONLY");
assert.equal(checkDecideNightRemedyGate({ kind: "allowance", employeeId: "ahmed", actorId: "mgr" }).error, "ALLOWANCE_KIND_REQUIRED");
assert.equal(checkDecideNightRemedyGate({ kind: "allowance", employeeId: "ahmed", actorId: "mgr", allowanceKind: "pay" }).error, "ALLOWANCE_AMOUNT_REQUIRED");
assert.equal(checkDecideNightRemedyGate({ kind: "allowance", employeeId: "ahmed", actorId: "mgr", allowanceKind: "pay", amount: 400 }).ok, true);
assert.equal(checkDecideNightRemedyGate({ kind: "reduce", employeeId: "ahmed", actorId: "ahmed" }).error, "MANAGEMENT_ONLY");
assert.equal(checkDecideNightRemedyGate({ kind: "reduce", employeeId: "ahmed", actorId: "mgr" }).error, "CUT_HOURS_REQUIRED");
assert.equal(checkDecideNightRemedyGate({ kind: "reduce", employeeId: "ahmed", actorId: "mgr", cutHours: 2 }).ok, true);
assert.equal(checkNightAllowanceGate({}).error, "ALLOWANCE_KIND_REQUIRED");
assert.equal(checkNightAllowanceGate({ allowanceKind: "transport", amount: 250 }).ok, true);
assert.equal(nightAllowanceKind("transport"), "transport");
assert.equal(nightAllowanceAmount(400), 400);
assert.equal(nightAllowancePayLabel(400, "pay", true), "أجر 400 ر.س");
assert.equal(payableNightAllowance({ profile: { nightRemedy: { kind: "allowance", amount: 400, allowanceKind: "pay" } } }), 400);
assert.equal(payableNightAllowance({ profile: { nightAllowance: true } }), 0);
assert.equal(payableNightAllowance({ profile: { nightAllowance: 400 } }), 400);
assert.equal(checkDecideNightRemedyGate({ kind: "gift", employeeId: "ahmed", actorId: "mgr" }).error, "DECISION_REQUIRED");
assert.equal(nightReduceCutHours(2), 2);
assert.equal(nightReduceCutHours(5), 0);
assert.equal(nightCutHoursLabel(2, true), "ساعتان");
assert.equal(checkNightReduceHoursGate({}).error, "CUT_HOURS_REQUIRED");
assert.equal(checkNightReduceHoursGate({ cutHours: 2, shift: night }).ok, true);
assert.equal(shortenShiftByHours(night, 2)?.end, "05:00");
assert.equal(shortenShiftByHours({ start: "19:00", end: "07:00", label: "ليلي" }, 2)?.end, "05:00");

const allowedEmp = { id: "ahmed", name: "أحمد", stationId: "st", profile: { nightRemedy: { kind: "allowance", at: "2026-09-14T00:00:00.000Z" } }, leaveRequests: [] };
assert.equal(activeNightRemedy(allowedEmp)?.kind, "allowance");
assert.equal(nightRemedyIsWithdrawable(allowedEmp), true);
assert.equal(checkNightCompensateOrReduceGate({ shift: night, onDate: "2026-09-14", employee: allowedEmp }).ok, true);
assert.equal(checkNightPerformerCompensationGate({ shift: night, onDate: "2026-09-14", employee: allowedEmp }).ok, true);
assert.equal(checkWithdrawNightRemedyGate({ employee: allowedEmp, actorId: "mgr" }).ok, true);

const withdrawnEmp = { id: "ahmed", name: "أحمد", stationId: "st", profile: { nightRemedy: { kind: "allowance", at: "2026-09-14T00:00:00.000Z", withdrawnAt: "2026-09-15T00:00:00.000Z" } }, leaveRequests: [] };
assert.equal(activeNightRemedy(withdrawnEmp), null);
assert.equal(nightRemedyIsWithdrawable(withdrawnEmp), false);
assert.equal(checkWithdrawNightRemedyGate({ employee: withdrawnEmp, actorId: "mgr" }).error, "NOT_WITHDRAWABLE");
assert.equal(checkNightCompensateOrReduceGate({ shift: night, onDate: "2026-09-14", employee: withdrawnEmp }).error, "NIGHT_COMPENSATE_OR_REDUCE");

const reducedEmp = {
  id: "ahmed",
  name: "أحمد",
  stationId: "st",
  profile: { nightRemedy: { kind: "reduce", at: "2026-09-14T00:00:00.000Z" }, nightHoursReducedAt: "2026-09-14T00:00:00.000Z" },
  leaveRequests: [],
};
assert.equal(hasNightHoursReduction(reducedEmp, "2026-09-14"), true);
assert.equal(checkNightCompensateOrReduceGate({ shift: night, onDate: "2026-09-14", employee: reducedEmp }).via, "reduce");
assert.equal(checkNightPerformerCompensationGate({ shift: night, onDate: "2026-09-14", employee: reducedEmp }).via, "reduce");
assert.equal(checkShiftChangeApplyGate({
  schedule: { stationId: "st", shiftTypes: [morning, night], assignments: {} },
  employee: reducedEmp,
  dateKey: "2026-09-14",
  shiftTypeId: "night",
}).error, "NIGHT_HOURS_REDUCED");

const rotatedEmp = { id: "ahmed", name: "أحمد", stationId: "st", profile: { nightRemedy: { kind: "rotate", at: "2026-09-14T00:00:00.000Z" } }, leaveRequests: [] };
assert.equal(nightRemedyIsWithdrawable(rotatedEmp), false);
assert.equal(checkWithdrawNightRemedyGate({ employee: rotatedEmp, actorId: "mgr" }).error, "NOT_WITHDRAWABLE");

const evening = { id: "evening", label: "مسائي", start: "15:00", end: "23:00", restMinutes: 30 };
const eveningSchedule = {
  stationId: "st",
  shiftTypes: [morning, evening, night],
  assignments: { "2026-09-06": { night: ["omar"] } },
};
assert.equal(remapEmployeeNightWorkerDays(eveningSchedule, "omar", weekStart, "evening").moved, 1);
assert.equal(employeeShiftOnDay(eveningSchedule, "omar", "2026-09-06")?.id, "evening");

const cutTwoSchedule = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: { "2026-09-06": { night: ["omar"] }, "2026-09-07": { night: ["omar"] } },
};
const cutTwo = remapEmployeeNightWorkerDays(cutTwoSchedule, "omar", weekStart, "reduce", { cutHours: 2 });
assert.equal(cutTwo.moved, 2);
assert.equal(cutTwo.cutHours, 2);
assert.equal(employeeShiftOnDay(cutTwoSchedule, "omar", "2026-09-06")?.end, "05:00");
assert.equal(employeeShiftOnDay(cutTwoSchedule, "omar", "2026-09-06")?.label.includes("−2س"), true);

const cutTwoEmp = {
  id: "omar",
  name: "عمر",
  stationId: "st",
  profile: { nightRemedy: { kind: "reduce", at: "2026-09-14T00:00:00.000Z", cutHours: 2, fromHours: 8 }, nightHoursReducedAt: "2026-09-14T00:00:00.000Z" },
  leaveRequests: [],
};
const cutNight = { id: "cut2", label: "ليلي −2س", start: "23:00", end: "05:00", restMinutes: 30, cutHours: 2 };
assert.equal(checkShiftChangeApplyGate({
  schedule: { stationId: "st", shiftTypes: [morning, night, cutNight], assignments: {} },
  employee: cutTwoEmp,
  dateKey: "2026-09-14",
  shiftTypeId: "night",
}).error, "NIGHT_HOURS_REDUCED");
assert.equal(checkShiftChangeApplyGate({
  schedule: { stationId: "st", shiftTypes: [morning, night, cutNight], assignments: {} },
  employee: cutTwoEmp,
  dateKey: "2026-09-14",
  shiftTypeId: "cut2",
}).ok, true, "the chosen shorter night may be assigned");

const rotateSchedule = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: { "2026-09-06": { night: ["omar"] } },
};
assert.equal(remapEmployeeNightWorkerDays(rotateSchedule, "omar", weekStart, "rotate").moved, 1);
assert.equal(employeeShiftOnDay(rotateSchedule, "omar", "2026-09-06")?.id, "morning");

const pendingOmar = {
  ...omarFresh,
  otherRequests: [{ id: "r1", type: "night_consent", status: "pending", cycleKey: dueOmar.cycleKey }],
};
assert.equal(nightRotateDue({ employee: pendingOmar, schedule: longNight, weekStart }).due, false);
assert.equal(nightRotateDue({ employee: pendingOmar, schedule: longNight, weekStart }).reason, "pending");

const answeredOmar = {
  ...omarFresh,
  otherRequests: [{ id: "r1", type: "night_consent", status: "approved", cycleKey: dueOmar.cycleKey, decision: "agree" }],
};
assert.equal(answeredNightRotateThisMonth(answeredOmar, dueOmar.cycleKey), true);
assert.equal(nightRotateDue({ employee: answeredOmar, schedule: longNight, weekStart }).reason, "consented");
const nextMonthStart = weekStartDate("2026-10-04");
const nextMonthNight = { stationId: "st", shiftTypes: [morning, night], assignments: datedNightWeeks("omar", nextMonthStart, 14) };
assert.equal(nightRotateDue({ employee: answeredOmar, schedule: nextMonthNight, weekStart: nextMonthStart }).due, false, "written consent stays on file — no monthly legal re-consent");
assert.equal(nightRotateDue({ employee: answeredOmar, schedule: nextMonthNight, weekStart: nextMonthStart }).reason, "consented");

const morningOmar = { ...omarFresh };
const morningOnly = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: { 0: { morning: ["omar"] }, 1: { morning: ["omar"] } },
};
assert.equal(onNightsThisWeek(morningOmar, morningOnly, weekStart), false);
assert.equal(nightRotateDue({ employee: morningOmar, schedule: morningOnly, weekStart }).reason, "period_changed");
const afterMorning = weekStartDate("2026-11-01");
const morningBreak = {};
for (const key of weekDateKeys(addDays(afterMorning, -14))) morningBreak[key] = { morning: ["omar"] };
const resetNight = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: {
    ...datedNightWeeks("omar", addDays(afterMorning, -21), 12),
    ...morningBreak,
    ...datedNightWeeks("omar", afterMorning, 2),
  },
};
assert.ok(nightStreakWeeks(resetNight, "omar", afterMorning) >= 13, "one morning week does not reset a 3-month night-worker streak");
assert.equal(nightRotateDue({ employee: omarFresh, schedule: resetNight, weekStart: afterMorning }).due, true, "one morning week is not a full ordinary month");
const afterResetDueStart = weekStartDate("2027-02-07");
const afterResetDue = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: {
    ...morningBreak,
    ...datedNightWeeks("omar", afterResetDueStart, 14),
  },
};
assert.equal(nightRotateDue({ employee: omarFresh, schedule: afterResetDue, weekStart: afterResetDueStart }).due, true, "after morning reset, next notice is after another 3 months of night");
assert.equal(shouldLapseNightRotate({
  ...morningOmar,
  otherRequests: [{ id: "r1", type: "night_consent", status: "pending" }],
}, morningOnly, weekStart), true);
assert.equal(shouldLapseNightRotate(pendingOmar, schedule, weekStart), false);

const duePeople = collectDueNightRotates({ employees: [omarFresh, ahmed], schedules: [longNight] }, weekStart);
assert.equal(duePeople.length, 1);
assert.equal(duePeople[0].employee.id, "omar");

assert.equal(pendingManagerDecideCount([{
  leaveRequests: [],
  otherRequests: [{ type: "night_consent", status: "pending" }, { type: "advance", status: "pending" }],
}]), 1);

assert.equal(dutyLaneFromSearch(new URLSearchParams(""), false), "mine");
assert.equal(dutyLaneFromSearch(new URLSearchParams("lane=manage"), false), "mine");
assert.equal(dutyLaneFromSearch(new URLSearchParams("lane=manage"), true), "manage");
assert.equal(dutyLaneFromSearch(new URLSearchParams("tab=team"), true), "manage");
assert.equal(dutyLaneFromSearch(new URLSearchParams("tab=punch"), true), "mine");
assert.equal(writeDutyLane(new URLSearchParams("tab=punch"), "manage").get("lane"), "manage");
assert.equal(writeDutyLane(new URLSearchParams("lane=manage&tab=team"), "mine").get("lane"), null);

const dutyData = {
  ownerId: "niyar",
  stations: [
    { id: "root", name: "الشركة", isCompanyRoot: true, managerId: "niyar" },
    { id: "khafji", name: "الخفجي", parentStationId: "root" },
    { id: "rabigh", name: "رابغ", parentStationId: "root" },
    { id: "jeddah", name: "جدة", parentStationId: "root" },
  ],
  employees: [
    { id: "niyar", name: "نيار", role: "director", stationId: "khafji", managedStations: ["rabigh"] },
    { id: "a", name: "أحمد", stationId: "khafji" },
    { id: "b", name: "بسام", stationId: "rabigh" },
    { id: "c", name: "جاسم", stationId: "jeddah" },
  ],
};
const ownerSeesAll = managedDutyEmployees(dutyData.employees[0], dutyData);
assert.equal(ownerSeesAll.length, 4);
assert.ok(ownerSeesAll.some((row) => row.id === "c"));
const stationMgr = { id: "sm", name: "مدير فرع", role: "station_manager", stationId: "khafji", managedStations: ["khafji"] };
const mgrPeople = managedDutyEmployees(stationMgr, { ...dutyData, employees: [...dutyData.employees, stationMgr] });
assert.ok(mgrPeople.some((row) => row.id === "a"));
assert.equal(mgrPeople.some((row) => row.id === "c"), false);

assert.equal(employeeWorkStationId(dutyData.employees[0]), "khafji");
assert.equal(employeeWorkStationId({ id: "x", name: "بلا فرع" }), null);

const niyar = dutyData.employees[0];
const mineAll = rosterTableStation({
  lane: "mine",
  employee: niyar,
  headerScope: "all",
  stations: dutyData.stations,
  fallbackStationId: "root",
});
assert.equal(mineAll.stationId, "khafji");
assert.equal(mineAll.stationName, "الخفجي");
assert.equal(mineAll.lockedToWork, true);
assert.equal(mineAll.missingWorkStation, false);

const mineOtherHeader = rosterTableStation({
  lane: "mine",
  employee: niyar,
  headerScope: "rabigh",
  stations: dutyData.stations,
  fallbackStationId: "root",
});
assert.equal(mineOtherHeader.stationId, "khafji");
assert.equal(mineOtherHeader.stationName, "الخفجي");

const manageScoped = rosterTableStation({
  lane: "manage",
  employee: niyar,
  headerScope: "rabigh",
  stations: dutyData.stations,
  fallbackStationId: "root",
});
assert.equal(manageScoped.stationId, "rabigh");
assert.equal(manageScoped.lockedToWork, false);

const manageAll = rosterTableStation({
  lane: "manage",
  employee: niyar,
  headerScope: "all",
  stations: dutyData.stations,
  fallbackStationId: "root",
});
assert.equal(manageAll.stationId, "khafji");
assert.equal(manageAll.headerAll, true);

const noWork = rosterTableStation({
  lane: "mine",
  employee: { id: "x", name: "بلا فرع" },
  headerScope: "all",
  stations: dutyData.stations,
  fallbackStationId: "root",
});
assert.equal(noWork.stationId, null);
assert.equal(noWork.missingWorkStation, true);

assert.equal(rosterBranchPhrase("الخفجي", true), "فرع الخفجي");
assert.equal(rosterBranchPhrase("فرع الخفجي", true), "فرع الخفجي");
const calMine = calendarLaneEmployees({
  lane: "mine",
  employee: dutyData.employees[0],
  employees: dutyData.employees,
  managed: [dutyData.employees[2]],
});
assert.ok(calMine.some((row) => row.id === "niyar"));
assert.ok(calMine.some((row) => row.id === "a"));
assert.ok(!calMine.some((row) => row.id === "b"));
const calManage = calendarLaneEmployees({
  lane: "manage",
  employee: dutyData.employees[0],
  employees: dutyData.employees,
  managed: [dutyData.employees[2]],
});
assert.deepEqual(calManage.map((row) => row.id), ["b"]);

assert.equal(LEAVE_STYLE.color, "#4a2c14", "leave chips use dark brown, not green");
assert.equal(LEAVE_STYLE.bg, "#efe0cc");
assert.equal(LEAVE_STYLE.fg, "#3d2410");
assert.ok(!/#15|#137a49|#ECFDF3|#f2faf6/i.test(`${LEAVE_STYLE.color}${LEAVE_STYLE.bg}${LEAVE_STYLE.fg}`));
assert.equal(LEAVE_CITE_STYLE.fg, "#6b4423", "article chip on leave is light brown");
assert.equal(LEAVE_CITE_STYLE.bg, "#f3e6d4");
assert.ok(LEAVE_CITE_STYLE.fg !== LEAVE_STYLE.fg);
assert.ok(!/#15|#1E9E63|#14683F|#ECFDF3|#14213d|#e8eef6/i.test(`${LEAVE_CITE_STYLE.color}${LEAVE_CITE_STYLE.bg}`));
const leaveCiteChip = statutoryChipStyle("entitlement", { compact: true, surface: "leave" });
assert.equal(leaveCiteChip.color, "#6b4423");
assert.equal(leaveCiteChip.background, "#f3e6d4");
assert.ok(!/nv-accent|#1E9E63|#14683F|#14213d/i.test(String(leaveCiteChip.background) + String(leaveCiteChip.color)));
const quietRight = statutoryChipStyle("entitlement", { glow: "off" });
assert.match(String(quietRight.background), /nv-accent|#1E9E63/, "non-leave entitlement chip stays green");

const mineOverlay = calendarOverlayEmployees({
  lane: "mine",
  employee: dutyData.employees[0],
  employees: dutyData.employees,
  managed: [dutyData.employees[2]],
  headerPeople: [dutyData.employees[2]],
});
assert.ok(mineOverlay.some((row) => row.id === "niyar"));
assert.ok(mineOverlay.some((row) => row.id === "a"), "ملفي sees work-station colleagues");
assert.ok(!mineOverlay.some((row) => row.id === "b"), "ملفي does not take header/other-branch people");
const manageOverlay = calendarOverlayEmployees({
  lane: "manage",
  employee: dutyData.employees[0],
  employees: dutyData.employees,
  managed: [dutyData.employees[2]],
  headerPeople: [dutyData.employees[2]],
});
assert.ok(manageOverlay.some((row) => row.id === "b"));

const mineCopy = rosterTableHeading({ lane: "mine", stationName: "الخفجي", canManage: true, ar: true });
assert.equal(mineCopy.gridTitle, "جدول فرع الخفجي");
assert.equal(mineCopy.pageTitle, "جدول فرع الخفجي");
assert.ok(mineCopy.gridLead.includes("فرعك فقط"));
assert.ok(mineCopy.gridLead.includes("إدارة"));
const mineSelfOnly = rosterTableHeading({ lane: "mine", stationName: "الخفجي", ar: true });
assert.ok(mineSelfOnly.gridLead.includes("فرعك فقط"));
assert.ok(!mineSelfOnly.gridLead.includes("إدارة"));
const mineScope = rosterMineScopeCopy({ stationName: "الخفجي", headerOther: true, ar: true });
assert.ok(mineScope.line.includes("فرع الخفجي"));
assert.ok(mineScope.line.includes("جدول الفرع فقط"));
assert.equal(mineScope.action, "الجداول الأخرى من إدارة.");
assert.equal(mineScope.emphasize, true);
const prefixed = rosterTableHeading({ lane: "mine", stationName: "فرع الخفجي", ar: true });
assert.equal(prefixed.gridTitle, "جدول فرع الخفجي");

const manageCopy = rosterTableHeading({ lane: "manage", stationName: "رابغ", ar: true });
assert.equal(manageCopy.gridTitle, "تعيينات فرع رابغ");
assert.equal(manageCopy.pageTitle, "جدول فرع رابغ");

const emptyCopy = rosterTableHeading({ lane: "mine", missingWorkStation: true, ar: true });
assert.equal(emptyCopy.gridTitle, "ملفي");
assert.ok(emptyCopy.emptyReason.includes("لا فرع عمل"));
assert.ok(emptyCopy.emptyReason.includes("لا جدول"));

const nightDuty = { id: "night", label: "ليلي", start: "23:00", end: "07:00", restMinutes: 30 };
const shortNight = { id: "short", label: "ليلي قصير", start: "23:00", end: "06:00", restMinutes: 30 };
const eveningAfter = { id: "late", label: "مسائي", start: "18:00", end: "01:00", restMinutes: 30 };
const nightWeekAssign = {
  "2026-09-06": { morning: ["ahmed"], night: ["omar"] },
  "2026-09-07": { morning: ["ahmed"], night: ["omar"] },
  "2026-09-08": { morning: ["ahmed"] },
  "2026-09-09": { morning: ["ahmed"] },
  "2026-09-10": { morning: ["ahmed"] },
};
const neitherGate = checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes: [morning, nightDuty], assignments: nightWeekAssign },
  employees: [omarFresh, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
assert.equal(neitherGate.checks.find((row) => row.id === "night_compensate")?.ok, false);
assert.equal(neitherGate.checks.find((row) => row.id === "night_compensate")?.error, "NIGHT_COMPENSATE_OR_REDUCE");
assert.equal(neitherGate.checks.find((row) => row.id === "night_compensate")?.ruleId, "hours.night.compensateOrReduce");
assert.match(neitherGate.checks.find((row) => row.id === "night_compensate")?.note || "", /تعويض|بدل|تخفيض/);

const compensatedGate = checkWeekPublishGates({
  schedule: { stationId: "st", nightCompensation: true, shiftTypes: [morning, nightDuty], assignments: nightWeekAssign },
  employees: [omarFresh, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
assert.equal(compensatedGate.checks.find((row) => row.id === "night_compensate")?.ok, true);

const reducedHoursAssign = {
  "2026-09-06": { morning: ["ahmed"], short: ["omar"] },
  "2026-09-07": { morning: ["ahmed"], short: ["omar"] },
  "2026-09-08": { morning: ["ahmed"] },
  "2026-09-09": { morning: ["ahmed"] },
  "2026-09-10": { morning: ["ahmed"] },
};
const reducedHoursGate = checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes: [morning, shortNight], assignments: reducedHoursAssign },
  employees: [omarFresh, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
assert.equal(isNightShift(shortNight), true);
assert.equal(reducedHoursGate.checks.find((row) => row.id === "night_compensate")?.ok, true);

const afterMidnightAssign = {
  "2026-09-06": { morning: ["ahmed"], late: ["omar"] },
  "2026-09-07": { morning: ["ahmed"] },
  "2026-09-08": { morning: ["ahmed"] },
  "2026-09-09": { morning: ["ahmed"] },
  "2026-09-10": { morning: ["ahmed"] },
};
const afterMidnightGate = checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes: [morning, eveningAfter], assignments: afterMidnightAssign },
  employees: [omarFresh, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
assert.equal(isNightShift(eveningAfter), false, "18:00–01:00 is not a night worker");
assert.equal(performsNightWork(eveningAfter), true);
assert.equal(afterMidnightGate.checks.find((row) => row.id === "night_compensate")?.ok, true, "XOR does not apply to a non-worker");
assert.equal(checkNightPerformerCompensationGate({ shift: eveningAfter }).error, "NIGHT_PERFORMER_COMPENSATION");
assert.equal(checkNightPerformerCompensationGate({
  shift: eveningAfter,
  schedule: { nightCompensation: true },
}).via, "compensate");
assert.equal(checkNightCompensateOrReduceGate({ shift: { start: "00:15", end: "08:15" } }).error, "NIGHT_COMPENSATE_OR_REDUCE");
assert.equal(checkNightCompensateOrReduceGate({
  shift: { start: "00:15", end: "08:15" },
  employee: { profile: { nightAllowance: 400 } },
}).via, "compensate");

const ordinaryMonthBreak = {};
for (let w = 1; w <= 4; w += 1) {
  for (const key of weekDateKeys(addDays(afterMorning, -7 * w))) ordinaryMonthBreak[key] = { morning: ["omar"] };
}
const resetAfterOrdinaryMonth = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: {
    ...datedNightWeeks("omar", addDays(afterMorning, -7 * 16), 12),
    ...ordinaryMonthBreak,
    ...datedNightWeeks("omar", afterMorning, 2),
  },
};
assert.ok(nightStreakWeeks(resetAfterOrdinaryMonth, "omar", afterMorning) < 13, "≥1 month ordinary hours resets the 3-month clock");
assert.equal(nightRotateDue({ employee: omarFresh, schedule: resetAfterOrdinaryMonth, weekStart: afterMorning }).reason, "under_limit");

const pregnantEmp = {
  id: "pregnant",
  name: "نورة",
  stationId: "st",
  profile: { expectedBirthDate: "2026-10-01", pregnant: "yes" },
};
assert.equal(checkShiftChangeApplyGate({
  schedule,
  employee: pregnantEmp,
  dateKey: "2026-09-07",
  shiftTypeId: "night",
}).error, "NIGHT_PREGNANCY_BAN");
assert.equal(checkShiftChangeApplyGate({
  schedule,
  employee: {
    ...pregnantEmp,
    profile: { expectedBirthDate: "2026-10-01", pregnant: "yes", nightTransferImpossible: "yes", nightPayPreserved: "yes" },
  },
  dateKey: "2026-09-07",
  shiftTypeId: "night",
}).error, "NIGHT_PREGNANCY_BAN", "full night-worker shift is still banned even if transfer is impossible");
const reducedNightType = { id: "short_night", label: "ليلي مخفّض", start: "23:00", end: "00:00", restMinutes: 30 };
assert.equal(checkShiftChangeApplyGate({
  schedule: { ...schedule, shiftTypes: [morning, night, reducedNightType] },
  employee: {
    ...pregnantEmp,
    profile: { expectedBirthDate: "2026-10-01", pregnant: "yes", nightTransferImpossible: "yes", nightPayPreserved: "yes" },
  },
  dateKey: "2026-09-07",
  shiftTypeId: "short_night",
}).error, "NIGHT_PREGNANCY_BAN", "automatic 24-week pregnancy ban has no night minutes even if transfer is impossible");
assert.equal(checkShiftChangeApplyGate({
  schedule: { ...schedule, shiftTypes: [morning, night, reducedNightType] },
  employee: {
    id: "extra-ban",
    name: "نورة",
    stationId: "st",
    profile: { nightPregnancyBanUntil: "2026-12-01", nightTransferImpossible: "yes", nightPayPreserved: "yes" },
  },
  dateKey: "2026-09-07",
  shiftTypeId: "short_night",
}).ok, true, "extra medical certificate may drop below the night-worker line if transfer is impossible");
assert.equal(checkShiftChangeApplyGate({
  schedule,
  employee: { id: "unfit", name: "خالد", profile: { nightFitnessStatus: "unfit" } },
  dateKey: "2026-09-07",
  shiftTypeId: "night",
}).error, "NIGHT_MEDICAL_UNFIT");

const nightThenMorning = {
  stationId: "st",
  shiftTypes: [morning, night, { id: "evening", start: "15:00", end: "23:00", restMinutes: 30 }],
  assignments: { "2026-09-13": { night: ["ahmed"] } },
};
assert.equal(checkNightRestApplyGate({
  schedule: nightThenMorning,
  employee: ahmed,
  dateKey: "2026-09-14",
  shift: morning,
}).error, "NIGHT_REST_REQUIRED");
assert.equal(checkShiftChangeApplyGate({
  schedule: nightThenMorning,
  employee: ahmed,
  dateKey: "2026-09-14",
  shiftTypeId: "morning",
}).error, "NIGHT_REST_REQUIRED");
assert.equal(checkShiftChangeApplyGate({
  schedule: nightThenMorning,
  employee: ahmed,
  dateKey: "2026-09-14",
  shiftTypeId: null,
}).ok, true, "rest after night is the 18632 remedy");
assert.equal(checkShiftChangeApplyGate({
  schedule: {
    stationId: "st",
    shiftTypes: [morning, { id: "evening", start: "15:00", end: "23:00", restMinutes: 30 }],
    assignments: { "2026-09-13": { evening: ["ahmed"] } },
  },
  employee: ahmed,
  dateKey: "2026-09-14",
  shiftTypeId: "morning",
}).ok, true, "evening then morning is not Decision 18632 night rest");

const fourDutyWeekStart = weekStartDate("2026-09-13");
const fourNights = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: {
    "2026-09-13": { night: ["ahmed"] },
    "2026-09-14": { night: ["ahmed"] },
    "2026-09-15": { night: ["ahmed"] },
    "2026-09-16": { night: ["ahmed"] },
  },
};
assert.equal(adjacentDutyPairs(fourNights, ahmed, fourDutyWeekStart).length, 3, "four consecutive duty days = three gaps");
assert.equal(nightRestPairHits(fourNights, ahmed, fourDutyWeekStart).length, 0, "night then night from 07:00 to 23:00 is 16h");
assert.equal(checkWeekPublishGates({
  schedule: fourNights,
  employees: [ahmed],
  weekStart: fourDutyWeekStart,
  ar: true,
}).checks.find((row) => row.id === "night_rest")?.ok, true);
const wrapNightMorning = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: {
    "2026-09-12": { night: ["ahmed"] },
    "2026-09-13": { morning: ["ahmed"] },
  },
};
assert.equal(nightRestPairHits(wrapNightMorning, ahmed, fourDutyWeekStart).length, 1, "Saturday night then Sunday morning crosses the week");
assert.equal(checkWeekPublishGates({
  schedule: wrapNightMorning,
  employees: [ahmed],
  weekStart: fourDutyWeekStart,
  ar: true,
}).checks.find((row) => row.id === "night_rest")?.ok, false);
assert.equal(weekCellAlert(checkWeekPublishGates({
  schedule: wrapNightMorning,
  employees: [ahmed],
  weekStart: fourDutyWeekStart,
  ar: true,
}), "ahmed", "2026-09-13")?.id, "night_rest");

const twelveStay = { id: "twelve", label: "12 بقاء", start: "07:00", end: "19:00", restMinutes: 120 };
const twelveThin = { id: "twelve", label: "12 بلا راحة كافية", start: "07:00", end: "19:00", restMinutes: 30 };
const twelveOver = { id: "thirteen", start: "07:00", end: "20:00", restMinutes: 180 };
const nightTwelve = { id: "n12", label: "ليلي 12", start: "19:00", end: "07:00", restMinutes: 120 };
assert.equal(shiftHours(twelveStay), 12);
assert.equal(actualShiftHours(twelveStay, "2026-09-13"), 10);
assert.equal(checkWorkplaceStayDutyGate({ shift: twelveStay, onDate: "2026-09-13" }).ok, true);
assert.equal(checkWorkplaceStayDutyGate({ shift: twelveThin, onDate: "2026-09-13" }).ok, false);
assert.ok(["ART_106_DAY", "REST_5H_REQUIRED", "REST_5H_BLOCK_TOO_LONG"].includes(
  checkWorkplaceStayDutyGate({ shift: twelveThin, onDate: "2026-09-13" }).error,
));
assert.equal(checkWorkplaceStayDutyGate({ shift: twelveOver, onDate: "2026-09-13" }).error, "WORKPLACE_STAY");
assert.equal(checkFourOnFourDutyPattern({ shift: twelveStay, onDate: "2026-09-13" }).ok, true);
assert.equal(checkFourOnFourDutyPattern({ shift: twelveStay, onDate: "2026-09-13" }).cycleDays, 8);
assert.equal(checkFourOnFourDutyPattern({ shift: twelveStay, onDate: "2026-09-13" }).weeklyActual, 40);
assert.equal(checkFourOnFourDutyPattern({ shift: twelveThin, onDate: "2026-09-13" }).ok, false);
assert.equal(checkFourOnFourDutyPattern({ shift: nightTwelve, onDate: "2026-09-13" }).ok, true);

const fourTwelveWeek = {
  stationId: "st",
  shiftTypes: [twelveStay],
  assignments: {
    "2026-09-13": { twelve: ["ahmed"] },
    "2026-09-14": { twelve: ["ahmed"] },
    "2026-09-15": { twelve: ["ahmed"] },
    "2026-09-16": { twelve: ["ahmed"] },
  },
};
const fourTwelveGates = checkWeekPublishGates({
  schedule: fourTwelveWeek,
  employees: [ahmed],
  weekStart: fourDutyWeekStart,
  ar: true,
});
assert.equal(fourTwelveGates.checks.find((row) => row.id === "workplace")?.ok, true);
assert.equal(fourTwelveGates.checks.find((row) => row.id === "hours_106")?.ok, true);
assert.equal(fourTwelveGates.checks.find((row) => row.id === "rest_5h")?.ok, true);
assert.equal(fourTwelveGates.checks.find((row) => row.id === "hours_48")?.ok, true);
assert.equal(fourTwelveGates.checks.find((row) => row.id === "weekly_rest")?.ok, true);
assert.equal(employeeWeekHours(fourTwelveWeek, "ahmed", fourDutyWeekStart), 40);
assert.equal(checkShiftChangeApplyGate({
  schedule: fourTwelveWeek,
  employee: ahmed,
  dateKey: "2026-09-13",
  shiftTypeId: "twelve",
}).ok, true, "12h stay with 2h rest may be painted");
assert.equal(checkShiftChangeApplyGate({
  schedule: { ...fourTwelveWeek, shiftTypes: [twelveThin] },
  employee: ahmed,
  dateKey: "2026-09-13",
  shiftTypeId: "twelve",
}).ok, false, "12h stay with 30m rest is not 10h actual");

const fourThinGates = checkWeekPublishGates({
  schedule: { ...fourTwelveWeek, shiftTypes: [twelveThin] },
  employees: [ahmed],
  weekStart: fourDutyWeekStart,
  ar: true,
});
assert.equal(fourThinGates.checks.find((row) => row.id === "hours_106")?.ok, false);

const fourNightTwelve = {
  stationId: "st",
  shiftTypes: [nightTwelve],
  assignments: {
    "2026-09-13": { n12: ["ahmed"] },
    "2026-09-14": { n12: ["ahmed"] },
    "2026-09-15": { n12: ["ahmed"] },
    "2026-09-16": { n12: ["ahmed"] },
  },
};
assert.equal(adjacentDutyPairs(fourNightTwelve, ahmed, fourDutyWeekStart).every((pair) => pair.gap >= 12), true);

assert.equal(isTwelveStayDuty(twelveStay, "2026-02-20"), true);
assert.equal(isTwelveStayDuty(morning, "2026-02-20"), false);
assert.equal(ramadanUsesDailySixCap(morning, "2026-02-20", ahmed), true);
assert.equal(ramadanUsesDailySixCap(twelveStay, "2026-02-20", ahmed), false);
assert.equal(checkShiftChangeApplyGate({
  schedule: { stationId: "st", shiftTypes: [morning, twelveStay] },
  employee: { id: "muslim", name: "مسلم", stationId: "st", profile: {} },
  dateKey: "2026-02-20",
  shiftTypeId: "morning",
}).error, "RAMADAN_DAY_CAP", "5×8 drops to 6 actual hours in Ramadan");
assert.equal(checkShiftChangeApplyGate({
  schedule: { stationId: "st", shiftTypes: [morning, twelveStay] },
  employee: { id: "muslim", name: "مسلم", stationId: "st", profile: {} },
  dateKey: "2026-02-20",
  shiftTypeId: "twelve",
}).ok, true, "4×12 stay stays 12 hours in Ramadan");

const ramadanWeekStart = weekStartDate("2026-02-22");
const ramadanFourTwelve = {
  stationId: "st",
  shiftTypes: [twelveStay],
  assignments: {
    "2026-02-22": { twelve: ["ahmed"] },
    "2026-02-23": { twelve: ["ahmed"] },
    "2026-02-24": { twelve: ["ahmed"] },
    "2026-02-25": { twelve: ["ahmed"] },
  },
};
assert.equal(employeeOnCompressedTwelveWeek(ramadanFourTwelve, ahmed, ramadanWeekStart), true);
assert.equal(checkWeekPublishGates({
  schedule: ramadanFourTwelve,
  employees: [ahmed],
  weekStart: ramadanWeekStart,
  ar: true,
}).checks.find((row) => row.id === "ramadan")?.ok, true, "compressed 12h week is not cut to 6 in Ramadan");
assert.equal(checkWeekPublishGates({
  schedule: {
    stationId: "st",
    shiftTypes: [morning],
    assignments: {
      "2026-02-22": { morning: ["ahmed"] },
      "2026-02-23": { morning: ["ahmed"] },
      "2026-02-24": { morning: ["ahmed"] },
      "2026-02-25": { morning: ["ahmed"] },
      "2026-02-26": { morning: ["ahmed"] },
    },
  },
  employees: [ahmed],
  weekStart: ramadanWeekStart,
  ar: true,
}).checks.find((row) => row.id === "ramadan")?.ok, false, "5×8 in Ramadan still hits the 6h day cap");

const ramadanDay = "2026-03-02";
const ramadanSun = weekStartDate(ramadanDay);
const outsideDay = "2026-09-14";
const outsideSun = weekStartDate(outsideDay);
const muslimEmp = { id: "ahmed", name: "أحمد", stationId: "st", profile: {}, leaveRequests: [] };
const otherEmp = { id: "ahmed", name: "أحمد", stationId: "st", profile: { religion: "non_muslim" }, leaveRequests: [] };
const juvenileEmp = { id: "ahmed", name: "حدث", stationId: "st", profile: { birthDate: "2010-03-02" }, leaveRequests: [] };
const allHourTypes = [morning, twelveStay, twelveThin, twelveOver, nightTwelve];
const applyHours = (shiftTypeId, dateKey, person = muslimEmp) => checkShiftChangeApplyGate({
  schedule: { stationId: "st", shiftTypes: allHourTypes },
  employee: person,
  dateKey,
  shiftTypeId,
});
const weekHours = (assignments, shiftTypes, person, weekStart) => checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes, assignments },
  employees: [person],
  weekStart,
  ar: true,
});
const fourKeys = (startKey, shiftId, personId) => {
  const start = weekStartDate(startKey);
  const assignments = {};
  for (let i = 0; i < 4; i += 1) assignments[calendarDateKey(addDays(start, i))] = { [shiftId]: [personId] };
  return assignments;
};
const fiveMorning = (startKey, personId) => {
  const start = weekStartDate(startKey);
  const assignments = {};
  for (let i = 0; i < 5; i += 1) assignments[calendarDateKey(addDays(start, i))] = { morning: [personId] };
  return assignments;
};

assert.equal(isRamadanDay(ramadanDay), true);
assert.equal(isRamadanDay(outsideDay), false);
assert.equal(isTwelveStayDuty(nightTwelve, ramadanDay), true, "night 19–07 is also 12h stay");
assert.equal(checkFourOnFourDutyPattern({ shift: twelveStay, onDate: ramadanDay }).ramadanKeepsTwelveStay, true);

assert.equal(applyHours("morning", outsideDay).ok, true, "5×8 outside Ramadan may be painted");
assert.equal(applyHours("twelve", outsideDay).ok, true, "4×12 outside Ramadan may be painted");
assert.equal(applyHours("twelve", outsideDay, otherEmp).ok, true);
assert.equal(applyHours("n12", outsideDay).ok, true);
assert.equal(applyHours("thirteen", outsideDay).error, "WORKPLACE_STAY");
assert.equal(applyHours("twelve", "2026-02-22", muslimEmp).error, "OFFICIAL_HOLIDAY", "Founding Day blocks even a 12h stay");

const outsideFour = weekHours(fourKeys(outsideDay, "twelve", "ahmed"), [twelveStay], muslimEmp, outsideSun);
assert.equal(outsideFour.checks.find((row) => row.id === "ramadan")?.ok, true);
assert.equal(outsideFour.checks.find((row) => row.id === "hours_106")?.ok, true);
assert.equal(outsideFour.checks.find((row) => row.id === "workplace")?.ok, true);
assert.equal(outsideFour.checks.find((row) => row.id === "hours_48")?.ok, true);
assert.equal(outsideFour.checks.find((row) => row.id === "weekly_rest")?.ok, true);
assert.equal(outsideFour.checks.find((row) => row.id === "rest_5h")?.ok, true);
assert.equal(employeeWeekHours({ stationId: "st", shiftTypes: [twelveStay], assignments: fourKeys(outsideDay, "twelve", "ahmed") }, "ahmed", outsideSun), 40);

const outsideFive = weekHours(fiveMorning(outsideDay, "ahmed"), [morning], muslimEmp, outsideSun);
assert.equal(outsideFive.checks.find((row) => row.id === "ramadan")?.ok, true, "no Ramadan days — 5×8 is ordinary");
assert.equal(outsideFive.checks.find((row) => row.id === "hours_48")?.ok, true);

assert.equal(applyHours("morning", ramadanDay).error, "RAMADAN_DAY_CAP");
assert.equal(applyHours("morning", ramadanDay, { ...muslimEmp, profile: {} }).error, "RAMADAN_DAY_CAP");
assert.equal(applyHours("morning", ramadanDay, otherEmp).ok, true, "recorded non-Muslim keeps 8h in Ramadan");
assert.equal(applyHours("morning", ramadanDay, juvenileEmp).error, "RAMADAN_DAY_CAP", "juvenile still on the daily Ramadan cap");
assert.equal(applyHours("twelve", ramadanDay).ok, true, "Muslim 12h stay stays 12 in Ramadan");
assert.equal(applyHours("n12", ramadanDay).ok, true, "Muslim night 12h stay stays 12 in Ramadan");
assert.equal(applyHours("twelve", ramadanDay, otherEmp).ok, true);
assert.equal(applyHours("twelve", ramadanDay, juvenileEmp).ok, false, "juvenile 12h stay stays on the daily/juvenile cap");
assert.equal(ramadanUsesDailySixCap(twelveStay, ramadanDay, juvenileEmp), true);
assert.equal(applyHours("twelve", ramadanDay).error == null, true);

const fourEightRamadan = fourKeys(ramadanDay, "morning", "ahmed");
assert.equal(applyHours("morning", calendarDateKey(addDays(ramadanSun, 0))).error, "RAMADAN_DAY_CAP", "four days of 8h is still the daily system");
assert.equal(weekHours(fourEightRamadan, [morning], muslimEmp, ramadanSun).checks.find((row) => row.id === "ramadan")?.ok, false);
assert.equal(weekHours(fiveMorning(ramadanDay, "ahmed"), [morning], muslimEmp, ramadanSun).checks.find((row) => row.id === "ramadan")?.ok, false);
assert.equal(weekHours(fiveMorning(ramadanDay, "ahmed"), [morning], otherEmp, ramadanSun).checks.find((row) => row.id === "ramadan")?.ok, true, "non-Muslim 5×8 week publishes in Ramadan");

const ramadanFour = fourKeys(ramadanDay, "twelve", "ahmed");
assert.equal(employeeOnCompressedTwelveWeek({ stationId: "st", shiftTypes: [twelveStay], assignments: ramadanFour }, muslimEmp, ramadanSun), true);
const ramadanFourGates = weekHours(ramadanFour, [twelveStay], muslimEmp, ramadanSun);
assert.equal(ramadanFourGates.checks.find((row) => row.id === "ramadan")?.ok, true);
assert.equal(ramadanFourGates.checks.find((row) => row.id === "hours_106")?.ok, true);
assert.equal(ramadanFourGates.checks.find((row) => row.id === "workplace")?.ok, true);
assert.equal(ramadanFourGates.checks.find((row) => row.id === "hours_48")?.ok, true);
assert.equal(ramadanFourGates.checks.find((row) => row.id === "weekly_rest")?.ok, true);
assert.equal(weekHours(fourKeys(ramadanDay, "twelve", "ahmed"), [twelveThin], muslimEmp, ramadanSun).checks.find((row) => row.id === "hours_106")?.ok, false);
assert.equal(weekHours(fourKeys(ramadanDay, "twelve", "ahmed"), [twelveThin], muslimEmp, ramadanSun).checks.find((row) => row.id === "ramadan")?.ok, true, "thin rest fails 106, not Ramadan");

const ramadanNightFour = fourKeys(ramadanDay, "n12", "ahmed");
assert.equal(weekHours(ramadanNightFour, [nightTwelve], muslimEmp, ramadanSun).checks.find((row) => row.id === "ramadan")?.ok, true);
assert.equal(weekHours(ramadanNightFour, [nightTwelve], muslimEmp, ramadanSun).checks.find((row) => row.id === "night_rest")?.ok, true);
assert.equal(nightRestPairHits({ stationId: "st", shiftTypes: [nightTwelve], assignments: ramadanNightFour }, muslimEmp, ramadanSun).length, 0);

const mixedAssign = {
  ...fourKeys(ramadanDay, "twelve", "ahmed"),
};
mixedAssign[calendarDateKey(addDays(ramadanSun, 3))] = { morning: ["ahmed"] };
assert.equal(employeeOnCompressedTwelveWeek({ stationId: "st", shiftTypes: [morning, twelveStay], assignments: mixedAssign }, muslimEmp, ramadanSun), false);
assert.equal(weekHours(mixedAssign, [morning, twelveStay], muslimEmp, ramadanSun).checks.find((row) => row.id === "ramadan")?.ok, false, "an 8h day inside a 12h week brings back the daily 6h cap");

const fiveTwelve = fiveMorning(ramadanDay, "ahmed");
for (const key of Object.keys(fiveTwelve)) fiveTwelve[key] = { twelve: ["ahmed"] };
assert.equal(employeeOnCompressedTwelveWeek({ stationId: "st", shiftTypes: [twelveStay], assignments: fiveTwelve }, muslimEmp, ramadanSun), false);
assert.equal(weekHours(fiveTwelve, [twelveStay], muslimEmp, ramadanSun).checks.find((row) => row.id === "hours_48")?.ok, false, "five 12h-stay days exceed 48 actual hours");
assert.equal(applyHours("twelve", "2026-02-22").error, "OFFICIAL_HOLIDAY");

assert.equal(nightRestPairHits(fourNightTwelve, ahmed, fourDutyWeekStart).length, 0, "12 on / 12 off is the 18632 minimum");
assert.equal(checkWeekPublishGates({
  schedule: fourNightTwelve,
  employees: [ahmed],
  weekStart: fourDutyWeekStart,
  ar: true,
}).checks.find((row) => row.id === "night_rest")?.ok, true);

function fourOnFourAssignments(employeeId, shiftId, startKey, days = 28) {
  const assignments = {};
  const start = weekStartDate(startKey);
  for (let i = 0; i < days; i += 1) {
    const key = calendarDateKey(addDays(start, i));
    if (i % 8 < 4) assignments[key] = { [shiftId]: [employeeId] };
  }
  return assignments;
}

const cycleAssign = fourOnFourAssignments("ahmed", "twelve", "2026-09-13", 28);
const cycleSched = { stationId: "st", shiftTypes: [twelveStay], assignments: cycleAssign };
let cycleWorkDays = 0;
for (let week = 0; week < 4; week += 1) {
  const start = addDays(fourDutyWeekStart, week * 7);
  const gates = checkWeekPublishGates({
    schedule: cycleSched,
    employees: [ahmed],
    weekStart: start,
    ar: true,
  });
  const hours = employeeWeekHours(cycleSched, "ahmed", start);
  cycleWorkDays += weekDateKeys(start).filter((key) => cycleAssign[key]).length;
  assert.ok(hours <= 40, `4+4 week ${week} actual ${hours} stays at or under 40`);
  assert.equal(gates.checks.find((row) => row.id === "hours_48")?.ok, true, `4+4 week ${week} hours_48`);
  assert.equal(gates.checks.find((row) => row.id === "hours_106")?.ok, true, `4+4 week ${week} hours_106`);
  assert.equal(gates.checks.find((row) => row.id === "workplace")?.ok, true, `4+4 week ${week} workplace`);
  assert.equal(gates.checks.find((row) => row.id === "rest_5h")?.ok, true, `4+4 week ${week} rest_5h`);
  assert.equal(gates.checks.find((row) => row.id === "weekly_rest")?.ok, true, `4+4 week ${week} weekly_rest`);
}
assert.equal(cycleWorkDays, 16, "four Sunday weeks of 4 on / 4 off = 16 duty days");

const pregAssign = {
  "2026-09-06": { morning: ["ahmed"], night: ["pregnant"] },
  "2026-09-07": { morning: ["ahmed"], night: ["pregnant"] },
  "2026-09-08": { morning: ["ahmed"] },
  "2026-09-09": { morning: ["ahmed"] },
  "2026-09-10": { morning: ["ahmed"] },
};
const pregGate = checkWeekPublishGates({
  schedule: { stationId: "st", nightCompensation: true, nightFirstAidReady: true, nightEmergencyTransferReady: true, nightFoodAccessReady: true, shiftTypes: [morning, nightDuty], assignments: pregAssign },
  employees: [pregnantEmp, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
assert.equal(pregGate.checks.find((row) => row.id === "night_pregnancy")?.ok, false);
assert.equal(pregGate.checks.find((row) => row.id === "night_pregnancy")?.error, "NIGHT_PREGNANCY_BAN");

const platformSrc = readFileSync(new URL("../src/components/schedules/ShiftsPlatformBoard.jsx", import.meta.url), "utf8");
assert.match(platformSrc, /rosterMineScopeCopy/, "ملفي states the work-branch lock in derived copy");
assert.match(platformSrc, /\/app\/shifts\?lane=manage/, "other rosters open إدارة");
assert.doesNotMatch(platformSrc, /تبديل النطاق في الهيدر/, "header-scope essay is not the ملفي lock");

const boardSrc = readFileSync(new URL("../src/components/schedules/ShiftWeekBoard.jsx", import.meta.url), "utf8");
assert.match(boardSrc, /showStatutoryHeaderCite/, "publish checks keep the essay behind the due/failing gate");
assert.match(boardSrc, /showEssay \? \(/, "passing checks still print the article number; essay is gated");
assert.match(boardSrc, /decisionId="18632"/, "night header always prints قرار 18632");
assert.match(boardSrc, /entitlement glow=\{nightGlow\}/, "header 18632 stays a green worker-right chip when not due");
assert.match(boardSrc, /surface="leave"/, "leave-day article chip is light brown, not mint on the cell");
assert.match(boardSrc, /mode === "mine"/, "ملفي roster uses the file-owner rail");
assert.match(boardSrc, /FileHoursAlertsRail/, "ملفي left column is alerts for the signed-in person");
const railSrc = readFileSync(new URL("../src/components/employees/ManagerDutyAlertsRail.jsx", import.meta.url), "utf8");
const fileRailSrc = readFileSync(new URL("../src/components/employees/FileHoursAlertsRail.jsx", import.meta.url), "utf8");
const cardSrc = readFileSync(new URL("../src/components/employees/DutyStripAlertCard.jsx", import.meta.url), "utf8");
assert.match(railSrc, /DutyStripAlertCard/, "إدارة strip uses the shared إنذار card");
assert.match(railSrc, /PLATFORM_JUDGE_TITLE_AR/, "إدارة strip title is حكم المنصة");
assert.match(railSrc, /docFrame\(due \? "blocked" : "settled"\)/, "حكم المنصة due frame is platform red, not gold");
assert.match(railSrc, /--nv-bad-soft/, "حكم المنصة due wash matches attendance broken-row red");
assert.match(railSrc, /groupDutyStripByPerson/, "إدارة strip groups alerts by person");
assert.match(railSrc, /weekStationDutyNotes/, "station publish blocks sit once under the person circulars");
assert.doesNotMatch(railSrc, /to=\{person\.href\}/, "person circular is not a whole-card link");
assert.match(fileRailSrc, /DutyStripAlertCard/, "ملفي strip uses the shared إنذار card");
assert.match(fileRailSrc, /groupDutyStripByPerson/, "ملفي strip groups the same person once");
assert.match(cardSrc, /data-duty-items/, "circular can list several duties under one person");
assert.match(cardSrc, /nv-duty-circular/, "strip card is the shared person register");
assert.doesNotMatch(cardSrc, /docFrame/, "person register is not a nested 14px stamp");
assert.match(cardSrc, /letterSpacing: 0/, "duty Arabic keeps letter-spacing 0 so letters join");
assert.doesNotMatch(cardSrc, /letterSpacing: ["']0\.\d+em["']/, "duty card does not track Arabic copy");
assert.doesNotMatch(cardSrc, /card\.classification/, "administrative kicker is not a second masthead");
assert.doesNotMatch(railSrc, /letterSpacing: ["']0\.\d+em["']/, "حكم المنصة Arabic copy is not tracked");
assert.match(cardSrc, /LaborArticleCite/, "circular reuses statute chrome");
assert.match(cardSrc, /showChip=\{false\}/, "circular does not mint a green قرار pill");
assert.doesNotMatch(cardSrc, /StatutoryItem/, "circular does not use the entitlement chip");
assert.match(cardSrc, /nightConsentWaitCopy/, "night block tells the manager to assign morning or evening until consent");
assert.match(cardSrc, /data-night-consent-wait/, "consent wait copy is marked on the circular");
assert.doesNotMatch(railSrc, /تنبيه بشأن/, "إدارة card does not stack تنبيه بشأن under the section title");
assert.doesNotMatch(fileRailSrc, /تنبيهك/, "ملفي card does not repeat تنبيهك under تنبيهاتي");
assert.match(fileRailSrc, /own \? "employee" : "manager"/, "ملفي uses the employee presenter");
assert.match(boardSrc, /تعويض ليلي لهذا الجدول/, "station compensation stays on roster manage");
assert.match(boardSrc, /mode === "mine" \? \(/, "ملفي does not share the manage night rail");
assert.doesNotMatch(boardSrc, /entitlement=\{nightGlow !== "off"\}/, "header must not strip 18632 color when glow is off");
assert.doesNotMatch(boardSrc, /if \(!showStatutoryHeaderCite/, "passing checks must not hide the cite chip");
assert.doesNotMatch(boardSrc, /القرار 18632: الليل 23:00/, "clock-source paragraph is not a 18632 essay");
assert.match(boardSrc, /outdoor === true \? "outdoor"/, "open-air mark is settable on the week board");
assert.match(boardSrc, /weekPublishSubmitBlock/, "publish control names the first derived blocker");
assert.match(boardSrc, /publishSubmitBlock/, "disabled publish keeps a submitBlock reason beside the button");
assert.match(boardSrc, /weekCellAlert/, "failing week cells carry a derived mark");
assert.match(boardSrc, /weekCellAlertTone/, "cell mark reuses the panel red/gold tokens");
assert.match(boardSrc, /cellAlert\?\.hint/, "sun-ban cell tooltip is the named worker notice");
assert.match(boardSrc, /weekDutyStripAlerts|gates=\{gates\}/, "إدارة strip is fed from the same week gates");
assert.match(boardSrc, /employees=\{roster\}/, "إدارة strip names people from the live roster");
assert.match(boardSrc, /gates=\{gates\}/, "ملفي rail reuses the same week gates");

const heatWeekStart = weekStartDate("2026-07-13");
const heatWin = heatBanWindow("2026-07-13");
const heatMidStart = heatWin.startLabel;
const heatField = { id: "out", start: heatMidStart, end: "16:00", label: "ميداني", outdoor: true, restMinutes: 30 };
const heatUnmarked = { id: "out", start: heatMidStart, end: "16:00", label: "صباحي", restMinutes: 30 };
const heatIndoor = { id: "desk", start: heatMidStart, end: "16:00", label: "مكتبي", outdoor: false, restMinutes: 30 };
const heatMorningOut = { id: "morning", start: "07:00", end: "15:00", label: "صباحي", outdoor: true, restMinutes: 30 };
const heatAssign = { "2026-07-13": { out: ["omar"] } };
const heatFieldGate = checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes: [heatField], assignments: heatAssign },
  employees: [omar],
  weekStart: heatWeekStart,
  stationId: "st",
  ar: true,
  today: "2026-07-13",
});
const heatFieldBan = heatFieldGate.checks.find((row) => row.id === "heat_ban");
assert.equal(heatFieldBan?.ok, false);
assert.equal(heatFieldBan?.block, false, "outdoor in-season overlap is a warning, not a publish block");
assert.ok(heatFieldGate.warnings.some((row) => row.id === "heat_ban"));
assert.ok(!heatFieldGate.blockers.some((row) => row.id === "heat_ban"));
assert.ok(heatFieldBan?.note.includes(omar.name), "sun-ban notice names the worker");
assert.match(heatFieldBan?.note || "", /لا يحق لصاحب العمل أن يجبره/);
assert.ok(heatFieldBan?.note.includes(heatWin.startLabel), "outdoor notice reads heatBanWindow");
assert.ok(heatFieldBan?.note.includes(heatWin.endLabel));
assert.ok(heatFieldBan?.note.includes(heatWin.seasonAr));
assert.ok(heatFieldBan?.note.includes(heatBanDecisionLabel(true)));
assert.doesNotMatch(weekPublishSubmitBlock(heatFieldGate, { ar: true }), /حظر الشمس|يجبره/);

const heatOpenGate = checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes: [heatUnmarked], assignments: heatAssign },
  employees: [omar],
  weekStart: heatWeekStart,
  stationId: "st",
  ar: true,
  today: "2026-07-13",
});
const heatOpenBan = heatOpenGate.checks.find((row) => row.id === "heat_ban");
const heatOpenPlace = heatOpenGate.checks.find((row) => row.id === "heat_place");
assert.equal(heatOpenBan?.ok, true, "unmarked overlap is not treated as proven open-air");
assert.equal(heatOpenPlace?.ok, false);
assert.equal(heatOpenPlace?.block, false, "unmarked place is a named warning, not a silent pass");
assert.ok(heatOpenPlace?.note.includes(heatWin.startLabel));
assert.ok(heatOpenPlace?.note.includes(omar.name));
assert.match(heatOpenPlace?.note || "", /لا يحق لصاحب العمل أن يجبره/);

const heatIndoorGate = checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes: [heatIndoor], assignments: { "2026-07-13": { desk: ["omar"] } } },
  employees: [omar],
  weekStart: heatWeekStart,
  stationId: "st",
  ar: true,
  today: "2026-07-13",
});
assert.equal(heatIndoorGate.checks.find((row) => row.id === "heat_ban")?.ok, true, "indoor midday work is not the sun ban");
assert.equal(heatIndoorGate.checks.find((row) => row.id === "heat_place")?.ok, true);
assert.ok(!heatIndoorGate.warnings.some((row) => row.id === "heat_ban" || row.id === "heat_place"));

const heatFieldCell = weekCellAlert(heatFieldGate, "omar", "2026-07-13");
const heatNotice = weekHeatBanWorkerNotice(omar.name, "2026-07-13", { ar: true });
assert.equal(heatFieldCell?.id, "heat_ban");
assert.equal(heatFieldCell?.level, "warn");
assert.equal(heatFieldCell?.hint, heatNotice);
assert.ok(heatNotice.includes(heatWin.startLabel));
assert.ok(heatNotice.includes(heatBanDecisionLabel(true)));

const heatWeekAssign = {};
for (const key of weekDateKeys(heatWeekStart)) {
  const wd = new Date(`${key}T00:00:00`).getDay();
  if (wd >= 0 && wd <= 4) heatWeekAssign[key] = { morning: ["omar"] };
}
const heatPublishGate = checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes: [heatMorningOut], assignments: heatWeekAssign },
  employees: [omar],
  weekStart: heatWeekStart,
  stationId: "st",
  ar: true,
  today: "2026-07-13",
});
assert.equal(heatPublishGate.checks.find((row) => row.id === "heat_ban")?.ok, false);
assert.equal(heatPublishGate.checks.find((row) => row.id === "heat_ban")?.block, false);
assert.equal(heatPublishGate.blocked, false, "outdoor in-season overlap still allows publish");
assert.equal(weekPublishSubmitBlock(heatPublishGate, { ar: true }), "");

const heatOpenCell = weekCellAlert(heatOpenGate, "omar", "2026-07-13");
assert.equal(heatOpenCell?.id, "heat_place");
assert.equal(heatOpenCell?.level, "warn");
assert.equal(heatOpenCell?.hint, heatNotice);
assert.equal(weekCellAlert(heatIndoorGate, "omar", "2026-07-13"), null);

const offSeasonStart = weekStartDate("2026-09-20");
const offSeasonOutdoor = { id: "out", start: heatMidStart, end: "16:00", label: "ميداني", outdoor: true, restMinutes: 30 };
const offSeasonGate = checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes: [offSeasonOutdoor], assignments: { "2026-09-21": { out: ["omar"] } } },
  employees: [omar],
  weekStart: offSeasonStart,
  stationId: "st",
  ar: true,
});
assert.equal(offSeasonGate.checks.find((row) => row.id === "heat_ban")?.ok, true, "off-season outdoor midday is not a heat alarm");
assert.equal(weekCellAlert(offSeasonGate, "omar", "2026-09-21"), null, "off-season heat stays unmarked on the cell");
assert.equal(offSeasonGate.checks.find((row) => row.id === "heat_ban")?.note, "خارج موسم حظر الشمس.");

assert.ok(WEEK_DUTY_STRIP_IDS.has("heat_place"));
assert.ok(WEEK_DUTY_STRIP_IDS.has("night_compensate"));
assert.ok(!WEEK_DUTY_STRIP_IDS.has("leave_excluded"), "info-leave is not a glowing strip violation");
assert.ok(!WEEK_DUTY_STRIP_IDS.has("morning_cover"), "coverage is not an employee entitlement card");
assert.equal(
  weekDutyStripEmptyCopy(true),
  "لا حكم مستحق. لا مخالفة ساعات أو راحة، ولا واجب حماية غير ملبّى هذا الأسبوع.",
);

const heatPlaceStrip = weekDutyStripAlerts(heatOpenGate, { employees: [omar], ar: true });
const heatBody = weekHeatBanWorkerNotice("", "2026-07-13", { ar: true });
const heatStripCopy = weekHeatBanStripCopy("2026-07-13", { ar: true });
assert.equal(heatPlaceStrip.empty, false, "unmarked in-season morning lights the strip");
assert.equal(heatPlaceStrip.cards.length, 1);
assert.equal(heatPlaceStrip.cards[0].gateId, "heat_place");
assert.equal(heatPlaceStrip.cards[0].level, "warn");
assert.equal(heatPlaceStrip.cards[0].glow, "due");
assert.equal(heatPlaceStrip.cards[0].name, omar.name);
assert.equal(heatPlaceStrip.cards[0].classification, "إنذار حماية");
assert.equal(heatPlaceStrip.cards[0].instrument, "قرار 3337");
assert.equal(heatPlaceStrip.cards[0].subject, `بشأن: ${omar.name}`, "manager circular names the worker once");
assert.equal(heatPlaceStrip.cards[0].byline, `بشأن: ${omar.name}`);
assert.equal(heatPlaceStrip.cards[0].voice, "", "no second headline under حكم المنصة");
assert.equal(heatPlaceStrip.cards[0].headline, heatStripCopy.headline);
assert.equal(heatPlaceStrip.cards[0].body, heatStripCopy.body);
assert.equal(heatPlaceStrip.cards[0].footer, "على المادتين 122 و243");
assert.equal(heatPlaceStrip.cards[0].forum, "platform");
assert.equal(heatPlaceStrip.cards[0].ministryRole, "monitor");
assert.equal(heatPlaceStrip.cards[0].protects.employee, true);
assert.equal(heatPlaceStrip.cards[0].protects.company, true);
assert.equal(heatPlaceStrip.cards[0].judgment, "يحمي العامل والشركة — حكم المنصة");
assert.equal(dutyStripBody(heatNotice, omar.name), heatBody);
assert.ok(heatPlaceStrip.cards[0].body.includes(heatWin.startLabel));
assert.ok(heatPlaceStrip.cards[0].body.includes(heatWin.endLabel));
assert.ok(heatPlaceStrip.cards[0].body.includes(heatWin.seasonAr));
assert.doesNotMatch(heatPlaceStrip.cards[0].body, /3337|قرار وزاري/, "instrument stays in the masthead, not the sentence");
assert.ok(!heatPlaceStrip.anyBlock);

const heatPlaceMine = weekDutyStripAlerts(heatOpenGate, {
  employees: [omar],
  ar: true,
  audience: "employee",
  employeeId: omar.id,
});
assert.equal(heatPlaceMine.cards[0].voice, "");
assert.equal(heatPlaceMine.cards[0].subject, "", "employee circular has no name");
assert.equal(heatPlaceMine.cards[0].byline, "", "employee card does not restack a name under تنبيهاتي");
assert.equal(heatPlaceMine.cards[0].headline, heatStripCopy.headline);
assert.equal(heatPlaceMine.cards[0].body, heatStripCopy.body);
assert.equal(heatPlaceMine.cards[0].footer, heatStripCopy.footer);
assert.ok(!heatPlaceMine.cards[0].body.includes(omar.name));
assert.ok(!heatPlaceMine.cards[0].headline.includes(omar.name));
assert.ok(!heatPlaceMine.cards[0].instrument.includes(omar.name));

const heatBanStrip = weekDutyStripAlerts(heatFieldGate, { employees: [omar], ar: true });
assert.equal(heatBanStrip.cards[0].gateId, "heat_ban");
assert.equal(heatBanStrip.cards[0].level, "warn");
assert.equal(heatBanStrip.cards[0].name, omar.name);
assert.match(heatBanStrip.cards[0].body, /لا يحق لصاحب العمل أن يجبره/);
assert.equal(heatBanStrip.cards[0].subject, `بشأن: ${omar.name}`);

const indoorStrip = weekDutyStripAlerts(heatIndoorGate, { employees: [omar], ar: true });
assert.equal(indoorStrip.empty, true, "indoor midday is not a red strip card");

const offSeasonStrip = weekDutyStripAlerts(offSeasonGate, { employees: [omar], ar: true });
assert.equal(offSeasonStrip.empty, true, "off-season heat stays off the strip");
assert.ok(!offSeasonStrip.cards.some((row) => row.gateId === "heat_ban" || row.gateId === "heat_place"));

const afterSeasonClock = new Date("2026-09-19T12:00:00+03:00");
const inSeasonClock = new Date("2026-07-01T12:00:00+03:00");
const afterSeasonKey = riyadhClock(afterSeasonClock).dayKey;
const inSeasonKey = riyadhClock(inSeasonClock).dayKey;
const afterWin = heatBanWindow(afterSeasonKey);
const inWin = heatBanWindow(inSeasonKey);
const seasonEndKey = `${afterSeasonKey.slice(0, 4)}-${String(afterWin.toMonth).padStart(2, "0")}-${String(afterWin.toDay).padStart(2, "0")}`;
assert.ok(afterSeasonKey > seasonEndKey, "Sep 19 clock is after heatBanWindow season end");
assert.equal(isHeatBanDate(afterSeasonKey), false);
assert.equal(isHeatBanDate(inSeasonKey), true);
assert.equal(isLiveHeatBanDay(inSeasonKey, inSeasonClock), true);
assert.equal(isLiveHeatBanDay(inSeasonKey, afterSeasonClock), false);
assert.equal(heatBanTodayKey(afterSeasonClock), afterSeasonKey);
assert.equal(heatBanTodayKey(afterSeasonKey), afterSeasonKey);

const overlapWeekStart = weekStartDate(afterSeasonKey);
const overlapKeys = weekDateKeys(overlapWeekStart);
const leftoverHeatKeys = overlapKeys.filter((key) => isHeatBanDate(key));
assert.ok(leftoverHeatKeys.length > 0, "current week still overlaps the season window");
assert.ok(leftoverHeatKeys.every((key) => key < afterSeasonKey), "overlap days are already past on this clock");
assert.ok(leftoverHeatKeys.every((key) => !isLiveHeatBanDay(key, afterSeasonClock)));
assert.ok(leftoverHeatKeys.every((key) => !isHistoricalHeatBanDay(key, afterSeasonClock, overlapKeys[6])));

const overlapAssign = {};
for (const key of leftoverHeatKeys) overlapAssign[key] = { out: ["omar"] };
const overlapGate = checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes: [heatField], assignments: overlapAssign },
  employees: [omar],
  weekStart: overlapWeekStart,
  stationId: "st",
  ar: true,
  today: afterSeasonClock,
});
assert.equal(overlapGate.checks.find((row) => row.id === "heat_ban")?.ok, true, "week overlap after season end is not a live heat_ban");
assert.equal(overlapGate.checks.find((row) => row.id === "heat_place")?.ok, true, "week overlap after season end is not a live heat_place");
assert.ok(!overlapGate.warnings.some((row) => row.id === "heat_ban" || row.id === "heat_place"));
for (const key of leftoverHeatKeys) {
  assert.equal(weekCellAlert(overlapGate, "omar", key), null, "leftover in-season days of the current week stay unmarked");
}
const overlapStrip = weekDutyStripAlerts(overlapGate, { employees: [omar], ar: true });
assert.ok(!overlapStrip.cards.some((row) => row.gateId === "heat_ban" || row.gateId === "heat_place"));
assert.equal(overlapStrip.empty, true);

const julyMidAssign = { [inSeasonKey]: { out: ["omar"] } };
const julyMidGate = checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes: [heatField], assignments: julyMidAssign },
  employees: [omar],
  weekStart: weekStartDate(inSeasonKey),
  stationId: "st",
  ar: true,
  today: inSeasonClock,
});
assert.equal(julyMidGate.checks.find((row) => row.id === "heat_ban")?.ok, false, "in-season midday outdoor still warns");
assert.equal(julyMidGate.checks.find((row) => row.id === "heat_ban")?.block, false);
assert.ok(julyMidGate.warnings.some((row) => row.id === "heat_ban"));
assert.equal(weekCellAlert(julyMidGate, "omar", inSeasonKey)?.id, "heat_ban");
const julyMidStrip = weekDutyStripAlerts(julyMidGate, { employees: [omar], ar: true });
assert.equal(julyMidStrip.cards[0]?.gateId, "heat_ban");
assert.ok(julyMidStrip.cards[0]?.body.includes(inWin.startLabel));
assert.ok(julyMidStrip.cards[0]?.body.includes(inWin.seasonAr));

const pastJulyOnSep19 = checkWeekPublishGates({
  schedule: { stationId: "st", shiftTypes: [heatField], assignments: heatAssign },
  employees: [omar],
  weekStart: heatWeekStart,
  stationId: "st",
  ar: true,
  today: afterSeasonClock,
});
assert.equal(pastJulyOnSep19.checks.find((row) => row.id === "heat_ban")?.ok, true, "past July week is not a live sun-ban due");
assert.equal(weekCellAlert(pastJulyOnSep19, "omar", "2026-07-13")?.id, "heat_ban", "historical July cell may still carry a mark");
assert.ok(!weekDutyStripAlerts(pastJulyOnSep19, { employees: [omar], ar: true }).cards.some((row) => row.gateId === "heat_ban"));

const leaveStrip = weekDutyStripAlerts(leavePublishGate, { employees: [omar], ar: true });
assert.ok(!leaveStrip.cards.some((row) => row.gateId === "leave_excluded"), "approved leave is not a red glow");

const nightOkSchedule = {
  stationId: "st",
  nightCompensation: true,
  nightFirstAidReady: true,
  nightEmergencyTransferReady: true,
  nightFoodAccessReady: true,
  shiftTypes: [
    { ...morning, outdoor: false },
    nightDuty,
  ],
  assignments: nightWeekAssign,
};
const fitnessDay = laborDayKey(weekStart);
const omarNightFile = {
  nightMedicalReport: {
    url: "/preview-night-fitness.txt",
    name: "معاينة-تقرير-لياقة-ليلية.txt",
    issuedAt: fitnessDay,
  },
  nightMedicalIssuedAt: fitnessDay,
};
const omarFit = { ...omarFresh, profile: { ...omarFresh.profile, ...omarNightFile } };
assert.equal(nightMedicalFileSatisfied(omarFresh, fitnessDay), false);
assert.equal(nightMedicalFileSatisfied(omarFit, fitnessDay), true);
assert.equal(nightMedicalReportOf(omarFit)?.name, "معاينة-تقرير-لياقة-ليلية.txt");
assert.equal(nightMedicalDutyState({
  employee: omarFresh,
  shift: nightDuty,
  onDate: "2026-09-07",
}).error, "NIGHT_MEDICAL_FILE_MISSING");
assert.equal(nightMedicalDutyState({
  employee: omarFresh,
  shift: nightDuty,
  onDate: "2026-09-07",
}).block, false);
assert.equal(nightMedicalDutyState({
  employee: omarFit,
  shift: nightDuty,
  onDate: "2026-09-07",
}).ok, true);
assert.equal(nightMedicalDutyState({
  employee: { ...omarFresh, profile: { nightFitnessStatus: "unfit" } },
  shift: nightDuty,
  onDate: "2026-09-07",
}).error, "NIGHT_MEDICAL_UNFIT");
const staleIssued = addLaborDays(fitnessDay, -(nightMedicalYearSpanDays(fitnessDay) + 1));
assert.equal(nightMedicalFileSatisfied({
  profile: {
    nightMedicalReport: { url: "/preview-night-fitness-stale.txt", name: "معاينة-تقرير-لياقة-منتهٍ.txt", issuedAt: staleIssued },
    nightMedicalIssuedAt: staleIssued,
  },
}, fitnessDay), false, "yearly medical review uses hours.night.medicalYearMonths — not a 3-month expiry");
assert.equal(nightMedicalFileSatisfied({
  profile: {
    nightMedicalReport: { url: "/perm.txt", name: "دائم.txt", from: staleIssued, to: "", permanent: true, issuedAt: staleIssued },
    nightMedicalIssuedAt: staleIssued,
    nightMedicalPermanent: true,
  },
}, fitnessDay), true, "دائم is not expired after a year");
assert.equal(nightMedicalDutyState({
  employee: {
    profile: {
      nightMedicalReport: { url: "/perm.txt", name: "دائم.txt", from: staleIssued, to: "", permanent: true, issuedAt: staleIssued },
      nightMedicalIssuedAt: staleIssued,
      nightMedicalPermanent: true,
    },
  },
  shift: nightDuty,
  onDate: fitnessDay,
}).ok, true);
assert.equal(nightMedicalDutyState({
  employee: {
    profile: {
      nightMedicalReport: { url: "/perm.txt", name: "دائم.txt", from: staleIssued, to: "", permanent: true, issuedAt: staleIssued },
      nightMedicalIssuedAt: staleIssued,
      nightMedicalPermanent: true,
    },
  },
  shift: nightDuty,
  onDate: fitnessDay,
}).unmet, false);
assert.equal(nightMedicalDutyState({
  employee: {
    profile: {
      nightMedicalReport: { url: "/perm.txt", name: "دائم.txt", from: staleIssued, to: "", permanent: true, issuedAt: staleIssued },
      nightMedicalIssuedAt: staleIssued,
      nightMedicalPermanent: true,
    },
  },
  shift: nightDuty,
  onDate: fitnessDay,
}).reviewDue, true, "دائم yearly review is info, not unmet");
assert.equal(nightMedicalFileSatisfied({
  profile: {
    nightMedicalReport: { url: "/win.txt", name: "فترة.txt", from: fitnessDay, to: addLaborDays(fitnessDay, 30), permanent: false },
  },
}, fitnessDay), true);
assert.equal(nightMedicalFileSatisfied({
  profile: {
    nightMedicalReport: { url: "/ended.txt", name: "منتهية.txt", from: addLaborDays(fitnessDay, -40), to: addLaborDays(fitnessDay, -1), permanent: false },
  },
}, fitnessDay), false, "فترة ended is unmet");
assert.equal(nightMedicalDutyState({
  employee: {
    profile: {
      nightMedicalReport: { url: "/ended.txt", name: "منتهية.txt", from: addLaborDays(fitnessDay, -40), to: addLaborDays(fitnessDay, -1) },
    },
  },
  shift: nightDuty,
  onDate: fitnessDay,
}).block, false, "ended period does not lock publish");

const missingMedGate = checkWeekPublishGates({
  schedule: nightOkSchedule,
  employees: [omarFresh, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
const missingMed = missingMedGate.checks.find((row) => row.id === "night_medical");
assert.equal(missingMed?.ok, false);
assert.equal(missingMed?.block, false, "missing file warns — does not newly block publish");
assert.equal(missingMed?.error, "NIGHT_MEDICAL_FILE_MISSING");
assert.ok(missingMedGate.warnings.some((row) => row.id === "night_medical"));
assert.ok(!missingMedGate.blockers.some((row) => row.id === "night_medical"));
assert.equal(weekPublishSubmitBlock(missingMedGate, { ar: true }).includes("لياقة"), false);
const missingMedStrip = weekDutyStripAlerts(missingMedGate, { employees: [omarFresh, ahmed], ar: true });
assert.ok(!missingMedStrip.cards.some((row) => row.gateId === "night_medical"), "fitness is a ملفي request, not a roster circular");

const nightOkGate = checkWeekPublishGates({
  schedule: nightOkSchedule,
  employees: [omarFit, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
const nightOkStrip = weekDutyStripAlerts(nightOkGate, { employees: [omarFit, ahmed], ar: true });
assert.equal(nightOkGate.checks.find((row) => row.id === "night_compensate")?.ok, true);
assert.equal(nightOkGate.checks.find((row) => row.id === "night_performer_comp")?.ok, true);
assert.equal(nightOkGate.checks.find((row) => row.id === "night_medical")?.ok, true);
assert.ok(!nightOkStrip.cards.some((row) => row.name === omarFit.name), "satisfied 18632 does not glow");
assert.ok(!nightOkStrip.cards.some((row) => String(row.gateId || "").startsWith("night_")));

const unfitMedGate = checkWeekPublishGates({
  schedule: nightOkSchedule,
  employees: [{ ...omarFresh, profile: { nightFitnessStatus: "unfit" } }, ahmed],
  weekStart,
  stationId: "st",
  ar: true,
  today: weekClock,
});
assert.equal(unfitMedGate.checks.find((row) => row.id === "night_medical")?.ok, false);
assert.equal(unfitMedGate.checks.find((row) => row.id === "night_medical")?.block, true);
assert.equal(unfitMedGate.checks.find((row) => row.id === "night_medical")?.error, "NIGHT_MEDICAL_UNFIT");
assert.ok(unfitMedGate.blockers.some((row) => row.id === "night_medical"));

const fileSrc = readFileSync(new URL("../src/components/employees/NightMedicalFileField.jsx", import.meta.url), "utf8");
const hoursSrc = readFileSync(new URL("../src/components/employees/HoursOnFile.jsx", import.meta.url), "utf8");
assert.doesNotMatch(fileSrc, /uploadFileOrLocal|type=["']file["']|PlatformDateField|setNightMedicalFitnessReport/, "medical notice is not an uploader");
assert.match(fileSrc, /افتح التقرير الطبي/, "employee can open the filed report");
assert.match(fileSrc, /افتح لياقة ليلية في طلباتي/, "unmet medical points at لياقة ليلية in طلباتي");
assert.match(readFileSync(new URL("../src/components/employees/ProfessionalInfoTab.jsx", import.meta.url), "utf8"), /NightMedicalFileField/);
assert.match(hoursSrc, /NightMedicalFileField/, "file hours unmet medical is a طلباتي notice");
assert.doesNotMatch(hoursSrc, /uploadFileOrLocal|type=["']file["']/, "file hours check does not embed upload");
assert.match(boardSrc, /NightMedicalFileField/, "week board unmet medical is a طلباتي notice");
assert.doesNotMatch(boardSrc, /uploadFileOrLocal/, "week board medical check does not embed upload");
assert.doesNotMatch(railSrc, /NightMedicalFileField|uploadFileOrLocal|type=["']file["']/, "manager duty rail does not embed upload");
assert.doesNotMatch(fileRailSrc, /NightMedicalFileField|uploadFileOrLocal|type=["']file["']/, "file hours rail does not embed upload");
assert.doesNotMatch(`${hoursSrc}\n${fileSrc}\n${railSrc}\n${fileRailSrc}\n${cardSrc}`, /type=["']file["']/, "duty strip has no file input");
const missingMedMine = weekDutyStripAlerts(missingMedGate, {
  employees: [omarFresh, ahmed],
  ar: true,
  audience: "employee",
  employeeId: omarFresh.id,
});
assert.ok(!missingMedMine.cards.some((row) => row.gateId === "night_medical"), "employee strip has no fitness circular");

const unmetNightStrip = weekDutyStripAlerts(neitherGate, { employees: [omarFresh, ahmed], ar: true });
assert.ok(unmetNightStrip.cards.some((row) => row.gateId === "night_compensate" && row.name === omarFresh.name && row.level === "block"));
assert.ok(unmetNightStrip.anyBlock);

const blockStrip = weekDutyStripAlerts(blocked, { employees: [omar, ahmed], ar: true });
assert.ok(blockStrip.anyBlock);
assert.ok(blockStrip.cards.some((row) => row.gateId === "night_rotate" && row.level === "block" && row.glow === "block"));
assert.ok(blockStrip.cards.every((row) => row.gateId !== "leave_excluded"));

const consentOnly = attachNightDueStripCards(nightOkStrip, [{
  stationId: "st",
  stationName: "فرع",
  people: [{ id: omarFresh.id, name: omarFresh.name, href: "/app/employees/omar", labels: ["موافقة خطية مفتوحة"] }],
}], { ar: true });
assert.equal(consentOnly.empty, true, "open written consent is not a red strip card");

const pendingNight = attachNightDueStripCards(nightOkStrip, [{
  stationId: "st",
  stationName: "فرع",
  people: [{ id: omarFresh.id, name: omarFresh.name, href: "/app/employees/omar", labels: ["اختيار في طلباتي"] }],
}], { ar: true });
assert.equal(pendingNight.empty, false);
assert.equal(pendingNight.cards[0].gateId, "night_rotate");
assert.equal(pendingNight.cards[0].level, "warn");
assert.equal(pendingNight.cards[0].voice, "");
assert.equal(pendingNight.cards[0].subject, `بشأن: ${omarFresh.name}`);
assert.equal(pendingNight.cards[0].classification, "إنذار حماية");
assert.equal(pendingNight.cards[0].instrument, "قرار 18632");
assert.match(pendingNight.cards[0].headline, /تدوير العامل الليلي/);
assert.equal(pendingNight.cards[0].requestsHref, "/app/requests/manage");

const mixedMine = weekDutyStripAlerts(neitherGate, {
  employees: [omarFresh, ahmed],
  ar: true,
  audience: "employee",
  employeeId: ahmed.id,
});
assert.ok(mixedMine.cards.every((row) => String(row.employeeId) === String(ahmed.id)), "employee strip is self only");
assert.ok(mixedMine.cards.every((row) => !row.subject && !row.byline), "employee cards have no name subject");
assert.ok(!mixedMine.cards.some((row) => `${row.headline} ${row.body} ${row.subject} ${row.footer}`.includes(omarFresh.name)), "employee card never names a coworker");
const mixedMgr = weekDutyStripAlerts(neitherGate, { employees: [omarFresh, ahmed], ar: true, audience: "manager" });
assert.ok(mixedMgr.cards.some((row) => row.subject === `بشأن: ${ahmed.name}`));
assert.ok(mixedMgr.cards.some((row) => row.subject === `بشأن: ${omarFresh.name}`));
assert.ok(mixedMgr.people?.length >= 1, "week strip pack already groups by person");
assert.ok(
  mixedMgr.people.every((person) => person.itemCount >= 1 && person.items.length === person.itemCount),
  "each person circular holds that person's duties",
);
assert.deepEqual(
  weekStationDutyNotes({
    checks: [
      { id: "morning_cover", ok: false, block: true, title: "تغطية الوردية الصباحية" },
      { id: "hours_48", ok: false, block: true, title: "أعلى حمل أسبوعي 48 ساعة" },
      { id: "night_medical", ok: false, title: "تقرير طبي" },
    ],
  }),
  [{ id: "morning_cover", title: "تغطية الوردية الصباحية", note: "", level: "block" }],
);

const ahmedHours = groupDutyStripByPerson({
  cards: [
    { id: "hours_48:ahmed", gateId: "hours_48", employeeId: "ahmed", name: "أحمد السالم", headline: "أعلى حمل أسبوعي 48 ساعة", level: "block", instrument: "", classification: "تنبيه إداري" },
    { id: "gap_11:ahmed", gateId: "gap_11", employeeId: "ahmed", name: "أحمد السالم", headline: "فاصل تشغيلي 11 ساعة", level: "warn", instrument: "", classification: "تنبيه إداري" },
    { id: "night_rest:ahmed", gateId: "night_rest", employeeId: "ahmed", name: "أحمد السالم", headline: "راحة 12 ساعة بعد عمل ليلي", level: "warn", decisionId: "18632", instrument: "قرار 18632", classification: "إنذار حماية" },
    { id: "weekly_rest:ahmed", gateId: "weekly_rest", employeeId: "ahmed", name: "أحمد السالم", headline: "راحة أسبوعية 24 ساعة متصلة", level: "warn", instrument: "", classification: "تنبيه إداري" },
    { id: "hours_48:nasser", gateId: "hours_48", employeeId: "nasser", name: "ناصر عمر", headline: "أعلى حمل أسبوعي 48 ساعة", level: "warn", instrument: "", classification: "تنبيه إداري" },
  ],
}, { ar: true, audience: "manager" });
assert.equal(ahmedHours.people.length, 2, "one circular per person, not per gate");
assert.equal(ahmedHours.people[0].name, "أحمد السالم");
assert.equal(ahmedHours.people[0].itemCount, 4);
assert.equal(ahmedHours.people[0].level, "block");
assert.equal(ahmedHours.people[0].subject, "بشأن: أحمد السالم");
assert.equal(ahmedHours.people[0].classification, "إنذار حماية");
assert.equal(ahmedHours.people[0].instrument, "قرار 18632");
assert.equal(ahmedHours.people[0].items[0].gateId, "hours_48");
assert.equal(ahmedHours.people[1].name, "ناصر عمر");
assert.equal(ahmedHours.people[1].itemCount, 1);
assert.equal(ahmedHours.people[0].lede, "4 تنبيهات على جدوله");
assert.equal(ahmedHours.people[0].judgment, "يحمي العامل والشركة — حكم المنصة");
assert.equal(ahmedHours.people[0].protects.employee, true);
assert.equal(ahmedHours.people[0].protects.company, true);
assert.equal(dutyStripPeopleSummary(ahmedHours, true), "5 تنبيهات · شخصان");
const ahmedMine = groupDutyStripByPerson({
  cards: ahmedHours.cards.filter((row) => row.employeeId === "ahmed"),
}, { ar: true, audience: "employee" });
assert.equal(ahmedMine.people.length, 1);
assert.equal(ahmedMine.people[0].subject, "", "employee group does not name the self as بشأن");
assert.equal(ahmedMine.people[0].lede, "4 تنبيهات على جدولك");
assert.equal(dutyStripPeopleSummary(ahmedMine, true), "4 تنبيهات · شخص واحد");

const twoBlock = { blockers: [{ title: "راحة أسبوعية متصلة" }, { title: "أعلى حمل أسبوعي" }] };
assert.equal(
  weekPublishSubmitBlock(twoBlock, { ar: true }),
  "راحة أسبوعية متصلة — وأعلى حمل أسبوعي.",
);
const threeBlock = { blockers: [...twoBlock.blockers, { title: "تغطية الوردية الصباحية" }] };
assert.equal(
  weekPublishSubmitBlock(threeBlock, { ar: true }),
  "راحة أسبوعية متصلة — و2 موانع أخرى.",
);

console.log("shift-week derivations ok");
