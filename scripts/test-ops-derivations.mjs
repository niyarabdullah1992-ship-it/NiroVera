import assert from "node:assert/strict";
import {
  taskPoints,
  planHorizonFromDue,
  taskPlanHorizon,
  deriveHorizonGroups,
  deriveOpsCounts,
  clampEffortWeight,
  checkAssignGate,
  checkReassignGate,
  canReassignOpsTask,
  applyOpsReassign,
  assignmentHistoryNote,
  CERT_FOR,
  CERT_LABELS,
  isAwaitingApproval,
  deriveDailyTaskPace,
  deriveBoardDailyPace,
  dailyPaceCopy,
  dailyPaceLabel,
  checkAutoEscalateGate,
  runOpsEscalationSweep,
  applyOpsAutoEscalate,
  riyadhHour,
  expandTaskRecurrence,
  checkTaskRecurrenceGate,
  taskRecurrenceFromForm,
  recurrenceHorizonEnd,
  recurrenceDurationEnd,
  taskWindowFromForm,
  checkTaskWindowFromForm,
  checkTaskPaceFromForm,
  taskWindowSpanEnd,
  applyTaskWindowSpan,
  formPaceMode,
  clipIsoDatesToWindow,
  isOpsTaskDeleted,
  isOpsTaskArchived,
  checkDeleteOpsTaskGate,
  applyOpsSoftDelete,
  buildTaskAuditTimeline,
} from "../src/lib/opsDerivations.js";

// ── Points formula (High 3 · Medium 2 · Low 1) × effort (1–5) ───────────────
assert.equal(taskPoints("high", 4), 12);
assert.equal(taskPoints("medium", 3), 6);
assert.equal(taskPoints("low", 5), 5);
assert.equal(taskPoints("high", 3), 9);
assert.equal(clampEffortWeight(99), 5);
assert.equal(clampEffortWeight(0), 1);
assert.equal(CERT_FOR.pm, "loto");
assert.equal(CERT_FOR.em, "fa");
assert.equal(CERT_FOR.cp, null);

// Points are computed at approval time from the same formula — logging completion
// must never invent a different scale.
const worth = taskPoints("medium", 2);
assert.equal(worth, 4);
assert.ok(worth !== 100 && worth !== 75, "must not use legacy 100/75 priority scale");

// ── Plan horizon from local date parts ───────────────────────────────────────
const today = new Date("2026-08-11T12:00:00");
assert.equal(planHorizonFromDue("2026-08-15", today), "w");
assert.equal(planHorizonFromDue("2026-09-01", today), "m");
assert.equal(planHorizonFromDue("2026-11-01", today), "q");
assert.equal(planHorizonFromDue("2027-01-01", today), "h");
assert.equal(planHorizonFromDue("2027-08-01", today), "y");
assert.equal(planHorizonFromDue(null, today), "w");

// Live remaining days — stored horizon is ignored unless pinned
assert.equal(taskPlanHorizon({ dueAt: "2026-08-15", planHorizon: "q" }, today), "w");
assert.equal(taskPlanHorizon({ dueAt: "2026-09-01", planHorizon: "y" }, today), "m");
assert.equal(taskPlanHorizon({ dueAt: "2026-08-15", planHorizon: "y", planPinned: true }, today), "y");
assert.equal(taskPlanHorizon({ dueAt: null, planHorizon: "q" }, today), "w");

const liveGroups = deriveHorizonGroups([
  { dueAt: "2026-08-15", planHorizon: "q", completedCount: 0, targetCount: 1 },
  { dueAt: "2026-09-01", planHorizon: "y", completedCount: 0, targetCount: 1 },
  { dueAt: "2026-08-14", planHorizon: "y", planPinned: true, completedCount: 0, targetCount: 1 },
], today);
assert.equal(liveGroups.find((g) => g.id === "w").count, 1);
assert.equal(liveGroups.find((g) => g.id === "m").count, 1);
assert.equal(liveGroups.find((g) => g.id === "y").count, 1);
assert.equal(liveGroups.find((g) => g.id === "q").count, 0);

// ── Derived counters (never stored literals) ─────────────────────────────────
const counts = deriveOpsCounts([
  { status: "active", dueAt: "2026-08-01", completedCount: 0, targetCount: 1 },
  { status: "awaiting_approval", dueAt: "2026-08-11", completedCount: 1, targetCount: 1 },
  { status: "completed", approvedAt: "2026-08-10", dueAt: "2026-08-10", completedCount: 1, targetCount: 1, pointsAwarded: 6 },
], today);
assert.equal(counts.total, 3);
assert.equal(counts.overdue, 1);
assert.equal(counts.today, 1);
assert.equal(counts.awaiting, 1);
assert.equal(counts.done, 1);
assert.equal(counts.pointsAwarded, 6);
assert.equal(counts.badge, 2);

assert.equal(isAwaitingApproval({ status: "active", completedCount: 2, targetCount: 2 }), true);
assert.equal(isAwaitingApproval({ status: "completed", completedCount: 2, targetCount: 2, approvedAt: "2026-08-10" }), false);

// ── Daily pace: 30 tasks by the 25th from the 17th → 9 days, 4 today ────────
const paceDay = new Date("2026-08-17T12:00:00");
const pace = deriveDailyTaskPace({
  targetCount: 30,
  dueAt: "2026-08-25",
  startAt: "2026-08-17",
  today: paceDay,
});
assert.equal(pace.active, true);
assert.equal(pace.days, 9);
assert.equal(pace.even, 3);
assert.equal(pace.extra, 3);
assert.equal(pace.todayExpected, 4);

const lastDay = deriveDailyTaskPace({
  targetCount: 30,
  dueAt: "2026-08-25",
  startAt: "2026-08-17",
  today: new Date("2026-08-25T12:00:00"),
});
assert.equal(lastDay.todayExpected, 3);

const sameDay = deriveDailyTaskPace({
  targetCount: 30,
  dueAt: "2026-08-17",
  startAt: "2026-08-17",
  today: paceDay,
});
assert.equal(sameDay.days, 1);
assert.equal(sameDay.todayExpected, 30);

assert.equal(deriveDailyTaskPace({ targetCount: 1, dueAt: "2026-08-25", today: paceDay }).active, true);
assert.equal(deriveDailyTaskPace({
  targetCount: 30,
  completedCount: 30,
  dueAt: "2026-08-25",
  startAt: "2026-08-17",
  today: paceDay,
}).todayExpected, 0);

const board = deriveBoardDailyPace([
  { targetCount: 30, completedCount: 0, dueAt: "2026-08-25", createdAt: "2026-08-17", status: "active" },
  { targetCount: 1, dueAt: "2026-08-25", status: "active" },
], paceDay);
assert.equal(board.active, 2);
assert.equal(board.todayExpected, 4);
assert.ok(dailyPaceLabel(pace, true).includes("4"));

// ── Certification gate — names the missing certificate in all assign modes ───
const people = [
  { employeeId: "e1", name: "Lapsed", certificates: [{ code: "loto", expiryDate: "2020-01-01", status: "expired" }] },
  { employeeId: "e2", name: "Valid", certificates: [{ code: "loto", expiryDate: "2027-01-01", status: "approved" }] },
  { employeeId: "e3", name: "NoFa", certificates: [{ code: "loto", expiryDate: "2027-01-01", status: "approved" }] },
];

const oneInCompany = checkAssignGate({
  workKind: "pm",
  assignMode: "one",
  ownerId: "e1",
  people,
  lang: "en",
  today,
});
assert.equal(oneInCompany.ok, true);
assert.equal(oneInCompany.required, "loto");
assert.equal(oneInCompany.certLabel, CERT_LABELS.loto.en);

const oneOk = checkAssignGate({
  workKind: "pm",
  assignMode: "one",
  ownerId: "e2",
  people,
  lang: "en",
  today,
});
assert.equal(oneOk.ok, true);

const ghost = checkAssignGate({
  workKind: "pm",
  assignMode: "one",
  ownerId: "ghost",
  people,
  lang: "en",
  today,
});
assert.equal(ghost.ok, false);

const someOk = checkAssignGate({
  workKind: "pm",
  assignMode: "some",
  memberIds: ["e1", "e2"],
  people,
  lang: "ar",
  today,
});
assert.equal(someOk.ok, true);

const allOk = checkAssignGate({
  workKind: "pm",
  assignMode: "all",
  stationId: "st1",
  people: [people[0], people[1]],
  lang: "en",
  today,
});
assert.equal(allOk.ok, true);

const emGate = checkAssignGate({
  workKind: "em",
  assignMode: "one",
  ownerId: "e3",
  people,
  lang: "en",
  today,
});
assert.equal(emGate.ok, true);
assert.equal(emGate.required, "fa");

const cpOk = checkAssignGate({
  workKind: "cp",
  assignMode: "one",
  ownerId: "e1",
  people,
  lang: "en",
  today,
});
assert.equal(cpOk.ok, true);
assert.equal(cpOk.required, null);

// ── Manager-only توكيل keeps the original assignee on the trail ─────────────
const manager = { id: "mgr1", role: "ops_manager" };
const employee = { id: "e1", role: "employee" };
const openTask = { status: "active", ownerId: "e1", assignMode: "one", completedCount: 0, targetCount: 1 };
const doneTask = { status: "completed", ownerId: "e1", assignMode: "one", approvedAt: "2026-08-10" };
const awaitingTask = { status: "awaiting_approval", ownerId: "e1", assignMode: "one", completedCount: 1, targetCount: 1 };
assert.equal(canReassignOpsTask(openTask, manager, {}), true);
assert.equal(canReassignOpsTask(openTask, employee, {}), false);
assert.equal(canReassignOpsTask(doneTask, manager, {}), false);
assert.equal(canReassignOpsTask(awaitingTask, manager, {}), false);

const eastManager = { id: "e0", role: "station_manager", stationId: "east", managedStations: [] };
const childTask = { ...openTask, stationId: "khf" };
const eastTree = {
  stations: [
    { id: "east", parentStationId: "co", managerId: "e0" },
    { id: "khf", parentStationId: "east" },
    { id: "co", isCompanyRoot: true },
  ],
};
assert.equal(canReassignOpsTask(childTask, eastManager, eastTree), true);
assert.equal(canReassignOpsTask({ ...openTask, stationId: "west" }, eastManager, eastTree), false);

const reassignPeople = [{ employeeId: "e1", name: "First" }, { employeeId: "e2", name: "Second" }];
const missingReason = checkReassignGate({
  task: openTask,
  user: manager,
  toId: "e2",
  reason: "",
  people: reassignPeople,
  lang: "ar",
});
assert.equal(missingReason.ok, false);
assert.equal(missingReason.error, "REASON_REQUIRED");

const samePerson = checkReassignGate({
  task: openTask,
  user: manager,
  toId: "e1",
  reason: "لم يُنجز",
  delegatedAt: "2026-09-06",
  actingUntil: "2026-12-01",
  people: reassignPeople,
  lang: "ar",
});
assert.equal(samePerson.ok, false);
assert.equal(samePerson.error, "SELF_REASSIGN_FORBIDDEN");

const okReassign = checkReassignGate({
  task: openTask,
  user: manager,
  toId: "e2",
  reason: "لم يُنجز في الوقت",
  delegatedAt: "2026-09-06",
  actingUntil: "2026-12-01",
  people: reassignPeople,
  lang: "ar",
});
assert.equal(okReassign.ok, true);

const next = applyOpsReassign(openTask, {
  fromId: "e1",
  toId: "e2",
  byId: "mgr1",
  reason: "لم يُنجز في الوقت",
  fromName: "First",
  toName: "Second",
  byName: "Manager",
  at: "2026-08-15T08:00:00.000Z",
  lang: "ar",
});
assert.equal(next.ownerId, "e2");
assert.equal(next.originalOwnerId, "e1");
assert.equal(next.assignmentHistory.length, 1);
assert.equal(next.assignmentHistory[0].fromId, "e1");
assert.equal(next.assignmentHistory[0].toId, "e2");
assert.equal(next.assignmentHistory[0].byId, "mgr1");
assert.match(assignmentHistoryNote(next.assignmentHistory[0], "ar"), /وُكِّل من First إلى Second/);
assert.match(assignmentHistoryNote(next.assignmentHistory[0], "ar"), /لم يُنجز في الوقت/);

// ── Auto escalation sweep ───────────────────────────────────────────────────
const escData = {
  stations: [{ id: "s1", managerId: "mgr1", parentStationId: null }],
  employees: [
    { id: "mgr1", employeeId: "mgr1", role: "station_manager", name: "Manager", stationId: "s1" },
    { id: "dir1", employeeId: "dir1", role: "director", name: "Director", isOwner: true },
  ],
};
const pacedTask = {
  id: "t1",
  ref: "T-1",
  stationId: "s1",
  status: "active",
  targetCount: 10,
  completedCount: 0,
  dueAt: "2026-08-20",
  createdAt: "2026-08-11T00:00:00",
  escalationLevel: 0,
};
const evening = new Date("2026-08-15T19:00:00+03:00");
const gate = checkAutoEscalateGate(pacedTask, escData, evening, { force: true });
assert.equal(gate.ok, true);
assert.equal(gate.nextLevel, 1);
const swept = runOpsEscalationSweep([pacedTask], escData, evening, { force: true });
assert.equal(swept.escalated, 1);
assert.equal(swept.tasks[0].escalationLevel, 1);
assert.equal(swept.tasks[0].autoEscalated, true);

// ── Recurring task expansion (weekday / N× month) ───────────────────────────
assert.equal(recurrenceHorizonEnd("2026-09-06", "m"), "2026-09-30");
const wednesdays = expandTaskRecurrence(
  { kind: "weekly", weekday: 3, horizon: "m" },
  { startAt: "2026-09-01" },
);
assert.deepEqual(wednesdays.map((w) => w.startAt), ["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30"]);
assert.equal(wednesdays.every((w) => w.startAt === w.dueAt), true);

const threeTuesdays = expandTaskRecurrence(
  { kind: "monthly_weekday", weekday: 2, timesPerMonth: 3, horizon: "m" },
  { startAt: "2026-09-01" },
);
assert.deepEqual(threeTuesdays.map((w) => w.startAt), ["2026-09-01", "2026-09-08", "2026-09-15"]);

const yearThree = expandTaskRecurrence(
  { kind: "monthly_weekday", weekday: 2, timesPerMonth: 3, horizon: "y" },
  { startAt: "2026-09-01" },
);
assert.equal(yearThree.length, 36);

const monthDates = expandTaskRecurrence(
  { kind: "monthly_dates", monthDays: [5, 15, 25], horizon: "m" },
  { startAt: "2026-09-06" },
);
assert.deepEqual(monthDates.map((w) => w.startAt), ["2026-09-15", "2026-09-25"]);

const missingDay = checkTaskRecurrenceGate({ kind: "weekly", horizon: "m" }, { startAt: "2026-09-01" });
assert.equal(missingDay.ok, false);
assert.equal(missingDay.error, "RECURRENCE_WEEKDAY_REQUIRED");

const fromForm = taskRecurrenceFromForm({
  recurrenceKind: "monthly",
  recurrenceDayMode: "weekday",
  recurrenceWeekday: 3,
  recurrenceTimes: 3,
  recurrenceHorizon: "y",
});
assert.equal(fromForm.kind, "monthly_weekday");
assert.equal(fromForm.timesPerMonth, 3);
assert.equal(fromForm.weekday, 3);

const asRange = taskRecurrenceFromForm({ recurrenceKind: "range" });
assert.equal(asRange.kind, "once");
assert.equal(taskRecurrenceFromForm({ recurrenceKind: "daily" }).kind, "once");

const weeklyRange = expandTaskRecurrence(
  { kind: "weekly", weekday: 3, horizon: "y" },
  { startAt: "2026-09-01", dueAt: "2026-09-16" },
);
assert.deepEqual(weeklyRange.map((w) => w.startAt), ["2026-09-02", "2026-09-09", "2026-09-16"]);

const yearlyWeeks = taskRecurrenceFromForm({
  recurrenceKind: "yearly",
  recurrenceYearSpread: "weeks",
  recurrenceWeekday: 3,
});
assert.equal(yearlyWeeks.kind, "once");

const yearlyMonths = taskRecurrenceFromForm({
  recurrenceKind: "yearly",
  recurrenceYearSpread: "months",
  recurrenceDayMode: "weekday",
  recurrenceWeekday: 2,
  recurrenceTimes: 3,
});
assert.equal(yearlyMonths.kind, "monthly_weekday");
assert.equal(yearlyMonths.horizon, "y");
assert.equal(yearlyMonths.timesPerMonth, 3);

const fiveTuesdays = expandTaskRecurrence(
  { kind: "monthly_weekday", weekday: 2, timesPerMonth: 5, horizon: "m" },
  { startAt: "2026-09-01" },
);
assert.deepEqual(fiveTuesdays.map((w) => w.startAt), ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"]);

const eightTuesdays = expandTaskRecurrence(
  { kind: "monthly_weekday", weekday: 2, timesPerMonth: 8, horizon: "m" },
  { startAt: "2026-09-01" },
);
assert.equal(eightTuesdays.length, 5);

const missingTimes = checkTaskRecurrenceGate(
  { kind: "monthly_weekday", weekday: 3, horizon: "m" },
  { startAt: "2026-09-01" },
);
assert.equal(missingTimes.ok, false);
assert.equal(missingTimes.error, "RECURRENCE_TIMES_REQUIRED");

const sixDates = taskRecurrenceFromForm({
  recurrenceKind: "monthly",
  recurrenceDayMode: "dates",
  recurrenceTimes: 6,
  recurrenceMonthDays: ["1", "5", "10", "15", "20", "25"],
  recurrenceHorizon: "m",
});
assert.equal(sixDates.kind, "monthly_dates");
assert.deepEqual(sixDates.monthDays, [1, 5, 10, 15, 20, 25]);

assert.equal(recurrenceDurationEnd("2026-09-06", 3, 0), "2026-12-06");
assert.equal(recurrenceDurationEnd("2026-09-06", 1, 0), "2026-10-06");
assert.equal(recurrenceDurationEnd("2026-09-06", 0, 0), "");

const dailyWin = taskWindowFromForm({
  recurrenceKind: "daily",
  startAt: "2026-09-01",
  dueAt: "2026-09-10",
});
assert.deepEqual(dailyWin, { startAt: "2026-09-01", dueAt: "2026-09-10" });

const weeklyRangeMissing = checkTaskWindowFromForm({
  recurrenceKind: "weekly",
  startAt: "2026-09-06",
  dueAt: "",
});
assert.equal(weeklyRangeMissing.ok, false);
assert.equal(weeklyRangeMissing.error, "RECURRENCE_RANGE_REQUIRED");

const weeklyWin = taskWindowFromForm({
  recurrenceKind: "weekly",
  startAt: "2026-09-06",
  dueAt: "2026-11-06",
});
assert.equal(weeklyWin.dueAt, "2026-11-06");
const weeklyDur = expandTaskRecurrence(
  { kind: "weekly", weekday: 3 },
  weeklyWin,
);
assert.deepEqual(weeklyDur.map((w) => w.startAt), [
  "2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30",
  "2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28",
  "2026-11-04",
]);

const weeklyGroup = expandTaskRecurrence(
  { kind: "weekly", weekdays: [0, 3] },
  { startAt: "2026-09-06", dueAt: "2026-09-20" },
);
assert.deepEqual(weeklyGroup.map((w) => w.startAt), [
  "2026-09-06", "2026-09-09", "2026-09-13", "2026-09-16", "2026-09-20",
]);

const pickedDays = expandTaskRecurrence(
  { kind: "selected_dates", dates: ["2026-09-08", "2026-09-10", "2026-09-22"] },
  { startAt: "2026-09-06", dueAt: "2026-09-16" },
);
assert.deepEqual(pickedDays.map((w) => w.startAt), ["2026-09-08", "2026-09-10"]);

const fromWeeklyGroup = taskRecurrenceFromForm({
  recurrenceKind: "weekly",
  recurrenceWeekdays: [0, 2, 4],
});
assert.equal(fromWeeklyGroup.kind, "once");

const fromPicked = taskRecurrenceFromForm({
  recurrenceKind: "weekly",
  recurrenceDayMode: "dates",
  recurrencePickedDays: ["2026-09-08", "2026-09-10"],
});
assert.equal(fromPicked.kind, "once");

const weeklyDaysMissing = checkTaskWindowFromForm({
  recurrenceKind: "weekly",
  startAt: "2026-09-06",
  dueAt: "2026-09-20",
  recurrenceWeekdays: [],
});
assert.equal(weeklyDaysMissing.ok, false);
assert.equal(weeklyDaysMissing.error, "RECURRENCE_WEEKDAY_REQUIRED");

const notYetPace = deriveDailyTaskPace({
  targetCount: 50,
  dueAt: "2026-09-10",
  startAt: "2026-09-07",
  today: new Date("2026-09-06T12:00:00"),
});
assert.equal(notYetPace.notYet, true);
assert.equal(notYetPace.todayExpected, 0);
assert.equal(notYetPace.plannedShare, 13);
assert.equal(notYetPace.days, 4);
const notYetCopy = dailyPaceCopy(notYetPace, true);
assert.equal(notYetCopy.kicker, "لم يحن يومه");
assert.equal(notYetCopy.metrics[0].value, "13");
assert.equal(notYetCopy.metrics[0].label, "حصة اليوم");

const futureWeekdays = deriveDailyTaskPace({
  targetCount: 30,
  startAt: "2026-09-07",
  dueAt: "2026-09-11",
  weekdays: [0, 2, 4, 6],
  today: new Date("2026-09-06T12:00:00"),
});
assert.equal(futureWeekdays.notYet, true);
assert.equal(futureWeekdays.days, 2);
assert.equal(futureWeekdays.todayExpected, 0);
assert.equal(futureWeekdays.plannedShare, 15);
const futureCopy = dailyPaceCopy(futureWeekdays, true);
assert.equal(futureCopy.kicker, "لم يحن يومه");
assert.equal(futureCopy.metrics[0].value, "15");

const weeklyOnDay = deriveDailyTaskPace({
  targetCount: 10,
  startAt: "2026-09-06",
  dueAt: "2026-09-20",
  weekdays: [0, 3],
  today: new Date("2026-09-06T12:00:00"),
});
assert.equal(weeklyOnDay.days, 5);
assert.equal(weeklyOnDay.todayExpected, 2);
assert.equal(weeklyOnDay.notYet, false);

const weeklyOffDay = deriveDailyTaskPace({
  targetCount: 10,
  startAt: "2026-09-06",
  dueAt: "2026-09-20",
  weekdays: [0, 3],
  today: new Date("2026-09-07T12:00:00"),
});
assert.equal(weeklyOffDay.offDay, true);
assert.equal(weeklyOffDay.todayExpected, 0);

assert.equal(taskWindowSpanEnd("2026-09-06", "w"), "2026-09-12");
assert.equal(taskWindowSpanEnd("2026-09-06", "m"), "2026-10-05");
assert.equal(taskWindowSpanEnd("2026-09-06", "y"), "2027-09-05");
assert.deepEqual(applyTaskWindowSpan({ startAt: "2026-09-06" }, "w"), {
  startAt: "2026-09-06",
  dueAt: "2026-09-12",
});
assert.equal(formPaceMode({}), "all");
assert.deepEqual(
  clipIsoDatesToWindow(["2026-09-08", "2026-09-22"], "2026-09-06", "2026-09-20"),
  ["2026-09-08"],
);

const paceWeekMissing = checkTaskPaceFromForm({
  startAt: "2026-09-06",
  dueAt: "2026-09-20",
  paceMode: "weekdays",
  paceWeekdays: [],
});
assert.equal(paceWeekMissing.ok, false);
assert.equal(paceWeekMissing.error, "PACE_WEEKDAY_REQUIRED");

const paceDatesMissing = checkTaskPaceFromForm({
  startAt: "2026-09-06",
  dueAt: "2026-09-20",
  paceMode: "dates",
  paceDates: ["2026-08-01"],
});
assert.equal(paceDatesMissing.ok, false);
assert.equal(paceDatesMissing.error, "PACE_DAY_REQUIRED");

const paceDatesOk = checkTaskPaceFromForm({
  startAt: "2026-09-06",
  dueAt: "2026-09-20",
  paceMode: "dates",
  paceDates: ["2026-09-08"],
});
assert.equal(paceDatesOk.ok, true);

const pickedPace = deriveDailyTaskPace({
  targetCount: 9,
  startAt: "2026-09-06",
  dueAt: "2026-09-20",
  paceDates: ["2026-09-08", "2026-09-10", "2026-09-16"],
  today: new Date("2026-09-08T12:00:00"),
});
assert.equal(pickedPace.days, 3);
assert.equal(pickedPace.todayExpected, 3);

const pickedOff = deriveDailyTaskPace({
  targetCount: 9,
  startAt: "2026-09-06",
  dueAt: "2026-09-20",
  paceDates: ["2026-09-08", "2026-09-10", "2026-09-16"],
  today: new Date("2026-09-09T12:00:00"),
});
assert.equal(pickedOff.offDay, true);
assert.equal(pickedOff.todayExpected, 0);

const monthlyWin = taskWindowFromForm({
  recurrenceKind: "monthly",
  startAt: "2026-09-01",
  recurrenceMonths: 3,
});
assert.equal(monthlyWin.dueAt, "2026-12-01");
const monthlyDur = expandTaskRecurrence(
  { kind: "monthly_weekday", weekday: 2, timesPerMonth: 2, horizon: "m" },
  monthlyWin,
);
assert.deepEqual(monthlyDur.map((w) => w.startAt), [
  "2026-09-01", "2026-09-08",
  "2026-10-06", "2026-10-13",
  "2026-11-03", "2026-11-10",
  "2026-12-01",
]);

const yearAsMonths = taskWindowFromForm({
  recurrenceKind: "monthly",
  startAt: "2026-09-06",
  recurrenceMonths: 12,
});
assert.equal(yearAsMonths.dueAt, "2027-09-06");

const freshTask = {
  id: "tk_1",
  createdAt: new Date().toISOString(),
  createdBy: "u1",
  createdByName: "نورة",
  completedCount: 0,
  status: "active",
};
assert.equal(checkDeleteOpsTaskGate(freshTask, { id: "u1" }).ok, true);
assert.equal(checkDeleteOpsTaskGate({ ...freshTask, completedCount: 1 }, { id: "u1" }).ok, false);
const oldTask = { ...freshTask, createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString() };
assert.equal(checkDeleteOpsTaskGate(oldTask, { id: "u1" }).error, "UNDO_WINDOW_CLOSED");
const deleted = applyOpsSoftDelete(freshTask, { byId: "u1", byName: "نورة" });
assert.equal(isOpsTaskDeleted(deleted), true);
assert.equal(isOpsTaskArchived(deleted), true);
assert.equal(deriveOpsCounts([freshTask, deleted]).total, 1);
const timeline = buildTaskAuditTimeline({
  ...freshTask,
  assignmentHistory: [{
    kind: "delegate",
    fromName: "نورة",
    toName: "سارة",
    delegatedAt: "2026-09-06T09:00",
    actingUntil: "2026-09-10T17:00",
    reason: "إجازة",
    at: "2026-09-06T09:00:00",
  }],
}, "ar");
assert.ok(timeline.some((r) => r.type === "create"));
assert.ok(timeline.some((r) => r.type === "delegate"));

console.log("opsDerivations E2E rules: PASS");
