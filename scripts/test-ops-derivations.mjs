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
  opsVisitorStamp,
  isOpsVisitorTask,
  taskAssignScope,
  taskAssignScopeLabel,
  taskAssigneeIds,
  taskAssigneePeople,
  taskPeopleCountLabel,
  taskCreatorName,
  employeeHomeStationId,
  canReassignOpsTask,
  applyOpsReassign,
  checkSetMembersGate,
  applyOpsSetMembers,
  assignmentHistoryNote,
  CERT_FOR,
  CERT_LABELS,
  isAwaitingApproval,
  deriveDailyTaskPace,
  derivePaceBlocker,
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
  applyOpsCommentDelete,
  buildTaskAuditTimeline,
  isOutdoorFieldTask,
  riyadhClock,
  checkTaskHeatBanGate,
  checkTaskModeGate,
  deriveTaskHeatBanNotice,
  normalizeTaskMode,
  taskModeConsequence,
  taskModeLabel,
  taskWaivesSiteAttendance,
} from "../src/lib/opsDerivations.js";
import { HEAT_BAN_STATE_LEVEL, heatBanWindow, isHeatBanDate } from "../src/lib/contractLawDerivations.js";
import { citeRule, explainRule, ruleValue } from "../src/lib/laborRules.js";
import { articleOfficialText } from "../src/lib/laborArticleTexts.js";
import {
  DECISION_3337_TEXT_AR,
  heatBanDecisionDutiesNote,
  heatBanDecisionLabel,
} from "../src/lib/heatBanDecision.js";

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
assert.equal(counts.total, 2);
assert.equal(counts.overdue, 1);
assert.equal(counts.today, 1);
assert.equal(counts.awaiting, 1);
assert.equal(counts.done, 1);
assert.equal(counts.pointsAwarded, 6);
assert.equal(counts.badge, 2);
assert.equal(isOpsTaskArchived({ status: "completed", approvedAt: "2026-08-10" }), true);
assert.equal(isOpsTaskArchived({ status: "active" }), false);

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
assert.equal(lastDay.todayExpected, 30);

const lastDayCaughtUp = deriveDailyTaskPace({
  targetCount: 30,
  completedCount: 27,
  dueAt: "2026-08-25",
  startAt: "2026-08-17",
  today: new Date("2026-08-25T12:00:00"),
});
assert.equal(lastDayCaughtUp.todayExpected, 3);

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

// ── Visitor dispatch: home branch ≠ executing branch, not an HR transfer ────
assert.equal(employeeHomeStationId({ stationId: "dammam" }), "dammam");
assert.equal(opsVisitorStamp({ stationId: "dammam" }, "riyadh").visitor, true);
assert.equal(opsVisitorStamp({ stationId: "dammam" }, "dammam").visitor, false);
assert.equal(opsVisitorStamp({ stationId: "dammam" }, "riyadh").homeStationId, "dammam");
assert.equal(isOpsVisitorTask({ stationId: "riyadh", homeStationId: "dammam", visitor: true }), true);
assert.equal(isOpsVisitorTask({ stationId: "dammam", homeStationId: "dammam" }), false);
const visitorReassign = applyOpsReassign(
  { status: "active", ownerId: "e1", stationId: "riyadh", assignmentHistory: [], comments: [], actionLog: [] },
  { toId: "e2", reason: "send", kind: "delegate", delegatedAt: "2026-09-08", actingUntil: "2026-09-15", homeStationId: "dammam" },
);
assert.equal(visitorReassign.visitor, true);
assert.equal(visitorReassign.homeStationId, "dammam");
assert.equal(visitorReassign.ownerId, "e2");

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

const teamTask = {
  ...openTask,
  assignMode: "some",
  memberIds: ["e1", "e2"],
  ownerId: "e1",
  ownerName: "First",
};
const membersPeople = [
  { id: "e1", employeeId: "e1", name: "First" },
  { id: "e2", employeeId: "e2", name: "Second" },
  { id: "e3", employeeId: "e3", name: "Third" },
];
const emptyMembers = checkSetMembersGate({
  task: teamTask,
  user: manager,
  memberIds: [],
  people: membersPeople,
  lang: "ar",
});
assert.equal(emptyMembers.ok, false);
assert.equal(emptyMembers.error, "MEMBERS_REQUIRED");
const outOfScope = checkSetMembersGate({
  task: teamTask,
  user: manager,
  memberIds: ["e1", "ghost"],
  people: membersPeople,
  lang: "ar",
});
assert.equal(outOfScope.ok, false);
assert.equal(outOfScope.error, "ASSIGNEE_OUT_OF_SCOPE");
const reshaped = checkSetMembersGate({
  task: teamTask,
  user: manager,
  memberIds: ["e1", "e3"],
  people: membersPeople,
  lang: "ar",
});
assert.equal(reshaped.ok, true);
assert.equal(reshaped.unchanged, false);
const membersNext = applyOpsSetMembers(teamTask, {
  memberIds: ["e1", "e3"],
  byId: "mgr1",
  byName: "Manager",
  people: membersPeople,
  at: "2026-08-15T09:00:00.000Z",
  lang: "ar",
});
assert.deepEqual(membersNext.memberIds, ["e1", "e3"]);
assert.equal(membersNext.assignMode, "some");
assert.equal(membersNext.ownerId, "e1");
assert.equal(membersNext.assignmentHistory.at(-1).kind, "members");
assert.match(assignmentHistoryNote(membersNext.assignmentHistory.at(-1), "ar"), /تغيّر المسندون/);
assert.match(assignmentHistoryNote(membersNext.assignmentHistory.at(-1), "ar"), /Third/);

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
assert.equal(checkDeleteOpsTaskGate(freshTask, { id: "u1" }).error, "REASON_REQUIRED");
assert.equal(checkDeleteOpsTaskGate(freshTask, { id: "u1" }, { undoCreate: true }).ok, true);
assert.equal(checkDeleteOpsTaskGate({ ...freshTask, completedCount: 1, targetCount: 14 }, { id: "u1" }, { undoCreate: true }).error, "REASON_REQUIRED");
assert.equal(checkDeleteOpsTaskGate({ ...freshTask, completedCount: 1, targetCount: 14 }, { id: "u1" }, { reason: "إلغاء بعد بدء الإنجاز", ack: true }).ok, true);
const oldTask = { ...freshTask, createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString() };
assert.equal(checkDeleteOpsTaskGate(oldTask, { id: "u1" }, { undoCreate: true }).error, "UNDO_WINDOW_CLOSED");
assert.equal(checkDeleteOpsTaskGate(oldTask, { id: "u1" }, { reason: "إلغاء", ack: true }).ok, true);
assert.equal(checkDeleteOpsTaskGate({ ...freshTask, status: "completed", approvedAt: new Date().toISOString() }, { id: "u1" }, { reason: "x", ack: true }).error, "PROOF_CHAIN_LOCKED");
assert.equal(checkDeleteOpsTaskGate({ ...freshTask, status: "awaiting_approval" }, { id: "u1" }, { reason: "x", ack: true }).error, "PROOF_CHAIN_LOCKED");
const deleted = applyOpsSoftDelete(freshTask, { byId: "u1", byName: "نورة", reason: "إلغاء", ack: true });
assert.equal(isOpsTaskDeleted(deleted), true);
assert.equal(isOpsTaskArchived(deleted), true);
assert.equal(deleted.deleteReason, "إلغاء");
assert.equal(deleted.completedCount, 0);
assert.equal(deleted.deletedByName, "نورة");
assert.ok((deleted.actionLog || []).some((e) => e.type === "delete" && e.reason === "إلغاء" && e.byName === "نورة"));
assert.equal(deriveOpsCounts([freshTask, deleted]).total, 1);
const partialDeleted = applyOpsSoftDelete({ ...freshTask, completedCount: 3, targetCount: 14, comments: [{ id: "c1", text: "ثبت" }] }, { byId: "u1", byName: "نورة", reason: "تغيّر الخطة", ack: true });
assert.equal(partialDeleted.completedCount, 3);
assert.equal(partialDeleted.comments.length, 1);
const delTimeline = buildTaskAuditTimeline(partialDeleted, "ar");
assert.ok(delTimeline.some((r) => r.type === "delete" && r.reason === "تغيّر الخطة" && r.by === "نورة"));
assert.ok(delTimeline.some((r) => r.type === "delete" && String(r.text).includes("3/14") && String(r.text).includes("نورة")));
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

const reasonTask = {
  id: "t_reason",
  comments: [
    { id: "rej_1", text: "الإثبات ناقص", is_rejection: true, authorId: "u1", at: "2026-09-08T16:00:00.000Z" },
    { id: "esc_1", text: "ثلاثة رفض", is_escalation: true, authorId: "u2", at: "2026-09-08T16:01:00.000Z" },
    { id: "msg_1", text: "مرحبا", authorId: "u1", at: "2026-09-08T16:02:00.000Z" },
  ],
};
assert.equal(applyOpsCommentDelete(reasonTask, "rej_1", { actorId: "u1", now: Date.parse("2026-09-08T16:02:10.000Z") }).error, "PROTECTED");
assert.equal(applyOpsCommentDelete(reasonTask, "esc_1", { actorId: "u2", now: Date.parse("2026-09-08T16:02:10.000Z") }).error, "PROTECTED");
assert.equal(applyOpsCommentDelete(reasonTask, "msg_1", { actorId: "u1", now: Date.parse("2026-09-08T16:02:10.000Z") }).ok, true);

assert.equal(taskAssignScope({ assignMode: "one" }), "person");
assert.equal(taskAssignScope({ assignMode: "all" }), "station");
assert.equal(taskAssignScope({ assignMode: "some", memberIds: ["a"] }), "person");
assert.equal(taskAssignScope({ assignMode: "some", memberIds: ["a", "b"] }), "group");
assert.equal(taskAssignScopeLabel({ assignMode: "all" }, true), "الفرع");
assert.equal(taskAssignScopeLabel({ assignMode: "one" }, true), "شخص");
assert.equal(taskPeopleCountLabel(1, true), "1 شخص");
assert.equal(taskPeopleCountLabel(2, true), "شخصان");
assert.equal(taskPeopleCountLabel(3, true), "3 أشخاص");
assert.deepEqual(taskAssigneeIds({ assignMode: "some", memberIds: ["a", "b"] }), ["a", "b"]);
assert.deepEqual(taskAssigneePeople({ assignMode: "one", ownerId: "u1" }, [{ id: "u1", name: "حسن العمري" }]), [{ id: "u1", name: "حسن العمري" }]);
assert.equal(taskCreatorName({ createdByName: "نورة" }), "نورة");
assert.equal(taskCreatorName({ createdBy: "u1" }, [{ id: "u1", name: "حسن العمري" }]), "حسن العمري");
assert.equal(taskCreatorName({ actionLog: [{ type: "create", byName: "سارة" }] }), "سارة");

// Remainder card: idle 0 is hidden; incomplete log or «بلا إنجاز» opens it.
const remainderDay = new Date("2026-08-17T12:00:00");
const remainderPace = deriveDailyTaskPace({
  targetCount: 30,
  dueAt: "2026-08-25",
  startAt: "2026-08-17",
  today: remainderDay,
});
assert.equal(remainderPace.active, true);
assert.equal(remainderPace.todayExpected, 4);
const idleRemainderTask = { targetCount: 30, completedCount: 0, dueAt: "2026-08-25", startAt: "2026-08-17", paceDayLog: {} };
assert.equal(derivePaceBlocker({ task: idleRemainderTask, pace: remainderPace, today: remainderDay }), null);
const missedRemainder = derivePaceBlocker({
  task: idleRemainderTask,
  pace: remainderPace,
  today: remainderDay,
  missed: true,
});
assert.ok(missedRemainder);
assert.equal(missedRemainder.kind, "missed");
assert.equal(missedRemainder.logged, 0);
const appliedZero = derivePaceBlocker({
  task: idleRemainderTask,
  pace: remainderPace,
  today: remainderDay,
  amountJustLogged: 0,
  applied: true,
});
assert.ok(appliedZero);
assert.equal(appliedZero.kind, "missed");
const shortKey = "2026-08-17";
const partialRemainder = derivePaceBlocker({
  task: { ...idleRemainderTask, paceDayLog: { [shortKey]: 1 } },
  pace: remainderPace,
  today: remainderDay,
});
assert.ok(partialRemainder);
assert.equal(partialRemainder.kind, "partial");
assert.equal(partialRemainder.logged, 1);
const fullRemainder = derivePaceBlocker({
  task: { ...idleRemainderTask, paceDayLog: { [shortKey]: remainderPace.todayExpected } },
  pace: remainderPace,
  today: remainderDay,
});
assert.equal(fullRemainder, null);
const storedOpenToday = derivePaceBlocker({
  task: {
    ...idleRemainderTask,
    paceBlocker: { status: "open", day: shortKey, kind: "missed", expected: remainderPace.todayExpected, logged: 0 },
  },
  pace: remainderPace,
  today: remainderDay,
});
assert.ok(storedOpenToday);
const storedOtherDay = derivePaceBlocker({
  task: {
    ...idleRemainderTask,
    paceBlocker: { status: "open", day: "2026-08-16", kind: "missed" },
  },
  pace: remainderPace,
  today: remainderDay,
});
assert.equal(storedOtherDay, null);

// ── Ministerial midday sun ban on a logged field unit ───────────────────────
// Every figure below is derived; nothing about 12:00, 15:00 or the season is typed here.
const heatWin = heatBanWindow("2026-06-20");
assert.equal(heatWin.startHour, ruleValue("hours.heat.startHour"));
assert.equal(heatWin.endHour, ruleValue("hours.heat.endHour"));
assert.equal(heatWin.seasonAr, `من ${ruleValue("hours.heat.fromDay")} يونيو إلى ${ruleValue("hours.heat.toDay")} سبتمبر`);

// The hours themselves carry no المادة chip — they are the decision's figures.
assert.equal(citeRule("hours.heat.startHour"), null);
assert.equal(explainRule("hours.heat.startHour")?.labelAr, "قرار وزاري");

// Decision 3337 was issued on articles 122 and 243 — 122 is the one with a text to read.
const heatCite = citeRule("hours.heat.cite");
assert.ok(heatCite);
assert.equal(heatCite.article, "122");
assert.equal(heatCite.labelAr, "المادة 122");
assert.ok(heatCite.hintAr.includes("3337"));
assert.ok(heatCite.textAr.includes("ولا يجوز لصاحب العمل أن يحمّل العمال"));
assert.equal(heatCite.textAr, articleOfficialText("122").ar);

// The decision's own wording is quoted, never paraphrased into an article.
assert.ok(DECISION_3337_TEXT_AR.includes("لا يجوز تشغيل العامل في الأعمال المكشوفة تحت أشعة الشمس"));
assert.equal(heatBanDecisionLabel(true), "قرار وزاري رقم 3337 وتاريخ 15/7/1435هـ");
assert.ok(heatBanDecisionDutiesNote(true).includes("المادتين 122 و243"));

// The place's consequence is one sentence with the hours in it — no vague «نافذة الحظر».
assert.equal(taskModeConsequence(""), "");
assert.equal(
  taskModeConsequence("field", { ar: true }),
  `التسجيل يتطلب بصمة اليوم، ويُرفض بين ${heatWin.startLabel} و${heatWin.endLabel} ${heatWin.seasonAr} — حظر العمل تحت أشعة الشمس.`,
);
assert.ok(taskModeConsequence("onsite", { ar: true }).includes("لا يسري"));
assert.ok(taskModeConsequence("remote", { ar: true }).includes("لا تُطلب بصمة موقع"));
assert.ok(taskModeConsequence("field", { ar: false }).includes("12:00"));

// Open air is the nature the supervisor stated — never inferred from the work kind.
const fieldTask = { id: "t_heat", mode: "field", workKind: "cm", targetCount: 4, completedCount: 0 };
const deskTask = { ...fieldTask, mode: "onsite", workKind: "of" };
const remoteTask = { ...fieldTask, mode: "remote" };
// The default work kind is عام: guessing from it would call an office task open air.
const generalIndoorTask = { ...fieldTask, mode: "onsite", workKind: "gn" };
const unsetTask = { ...fieldTask, mode: "" };
assert.equal(isOutdoorFieldTask(fieldTask), true);
assert.equal(isOutdoorFieldTask(deskTask), false);
assert.equal(isOutdoorFieldTask(remoteTask), false);
assert.equal(isOutdoorFieldTask(generalIndoorTask), false);
assert.equal(isOutdoorFieldTask(unsetTask), false);

// Nature is stated at creation; an unstated one is refused by name, not defaulted.
assert.equal(checkTaskModeGate("field").ok, true);
assert.equal(checkTaskModeGate("field").mode, "field");
assert.equal(checkTaskModeGate("").ok, false);
assert.equal(checkTaskModeGate("").error, "TASK_MODE_REQUIRED");
assert.ok(checkTaskModeGate("").reason.includes("ميداني في الهواء الطلق"));
assert.equal(checkTaskModeGate("outdoors").ok, false);
assert.equal(normalizeTaskMode("FIELD"), "field");
assert.equal(normalizeTaskMode("onsite "), "onsite");
assert.equal(normalizeTaskMode("yard"), "");
assert.equal(taskModeLabel("field", "ar"), "ميداني في الهواء الطلق");
assert.equal(taskModeLabel("", "ar"), "طبيعة غير محدَّدة");

// Only remote waives the site fingerprint — open-air work still punches in.
assert.equal(taskWaivesSiteAttendance(remoteTask), true);
assert.equal(taskWaivesSiteAttendance(fieldTask), false);
assert.equal(taskWaivesSiteAttendance(deskTask), false);

// Riyadh wall clock, never the runner's zone: same instant, two offsets.
assert.equal(riyadhClock(new Date("2026-06-20T13:00:00+03:00")).label, "13:00");
assert.equal(riyadhClock(new Date("2026-06-20T10:00:00Z")).label, "13:00");
assert.equal(riyadhClock(new Date("2026-06-20T13:00:00+03:00")).dayKey, "2026-06-20");

const inSeasonMidday = new Date("2026-06-20T13:00:00+03:00");
const inSeasonMorning = new Date("2026-06-20T09:00:00+03:00");
const offSeasonMidday = new Date("2026-12-20T13:00:00+03:00");
assert.equal(isHeatBanDate("2026-06-20"), true);
assert.equal(isHeatBanDate("2026-12-20"), false);

// 1) Field task · in season · 13:00 Riyadh → refused, by name, in Arabic.
const heatBlocked = checkTaskHeatBanGate(fieldTask, { now: inSeasonMidday, amount: 1 });
assert.equal(heatBlocked.ok, false);
assert.equal(heatBlocked.error, "HEAT_BAN");
assert.equal(heatBlocked.ruleId, "hours.heat.startHour");
assert.equal(heatBlocked.labelAr, "قرار وزاري");
assert.equal(
  heatBlocked.reason,
  "موقوف — حظر العمل تحت أشعة الشمس: لا يُسجَّل إنجاز ميداني بين 12:00 و15:00 بتوقيت الرياض من 15 يونيو إلى 15 سبتمبر. الوقت الآن 13:00، فسجّل الإنجاز بعد 15:00. الساعتان والموسم من قرار وزاري رقم 3337 وتاريخ 15/7/1435هـ، الصادر على المادة 122.",
);
// The refusal hands over the statute it stands on, text and all — not a bare label.
assert.equal(heatBlocked.cite.article, "122");
assert.equal(heatBlocked.cite.textAr, articleOfficialText("122").ar);
assert.ok(heatBlocked.reason.includes(heatBlocked.cite.labelAr));
// The refusal names the reason, the window and when it lifts — never a bare "not allowed".
assert.ok(heatBlocked.reason.includes(heatWin.endLabel));
assert.ok(heatBlocked.reason.includes(heatWin.seasonAr));

// 2) Field task · in season · 09:00 Riyadh → passes.
assert.equal(checkTaskHeatBanGate(fieldTask, { now: inSeasonMorning, amount: 1 }).ok, true);
// 3) Field task · out of season (December) · 13:00 → passes.
assert.equal(checkTaskHeatBanGate(fieldTask, { now: offSeasonMidday, amount: 1 }).ok, true);
// 4) Indoor / remote task · in season · 13:00 → passes untouched.
assert.equal(checkTaskHeatBanGate(deskTask, { now: inSeasonMidday, amount: 1 }).ok, true);
assert.equal(checkTaskHeatBanGate(remoteTask, { now: inSeasonMidday, amount: 1 }).ok, true);
// A عام task indoors is the common case: banning it would idle the offices at noon.
assert.equal(checkTaskHeatBanGate(generalIndoorTask, { now: inSeasonMidday, amount: 1 }).ok, true);
assert.equal(checkTaskHeatBanGate(generalIndoorTask, { now: inSeasonMidday, amount: 1 }).skipped, "not_outdoor");
assert.equal(checkTaskHeatBanGate(unsetTask, { now: inSeasonMidday, amount: 1 }).ok, true);

// Season edges and the half-open window, both derived from the rule rows.
const lastBanDay = `2026-${String(ruleValue("hours.heat.toMonth")).padStart(2, "0")}-${String(ruleValue("hours.heat.toDay")).padStart(2, "0")}`;
assert.equal(checkTaskHeatBanGate(fieldTask, { now: new Date(`${lastBanDay}T13:00:00+03:00`), amount: 1 }).ok, false);
assert.equal(checkTaskHeatBanGate(fieldTask, { now: new Date(`2026-06-20T${heatWin.endLabel}:00+03:00`), amount: 1 }).ok, true);
assert.equal(checkTaskHeatBanGate(fieldTask, { now: new Date(`2026-06-20T${heatWin.startLabel}:00+03:00`), amount: 1 }).ok, false);

// Reporting a stopped day is not a realized unit — blocking it would buy silence.
assert.equal(checkTaskHeatBanGate(fieldTask, { now: inSeasonMidday, amount: 0 }).ok, true);
assert.equal(checkTaskHeatBanGate(fieldTask, { now: inSeasonMidday, amount: 0 }).skipped, "no_unit");

// Creation is a notice, not a gate: a window spanning the season still passes.
// The severity ladder rides on the notice, so the create form and the task card
// read red for any span the season reaches, and only the log gate's own refusal
// carries the heavier level above it.
assert.deepEqual(HEAT_BAN_STATE_LEVEL, {
  off_season: "cite",
  before_window: "alert",
  in_window: "block",
  after_window: "alert",
});
assert.notEqual(HEAT_BAN_STATE_LEVEL.before_window, HEAT_BAN_STATE_LEVEL.off_season);
assert.notEqual(HEAT_BAN_STATE_LEVEL.in_window, HEAT_BAN_STATE_LEVEL.before_window);
const spanNotice = deriveTaskHeatBanNotice({ ...fieldTask, startAt: "2026-06-10", dueAt: "2026-06-30" });
assert.ok(spanNotice);
assert.equal(spanNotice.id, "heat_ban");
assert.equal(spanNotice.level, HEAT_BAN_STATE_LEVEL.before_window);
assert.equal(spanNotice.inSeason, true);
assert.equal(spanNotice.labelAr, "قرار وزاري");
assert.equal(spanNotice.cite.article, "122");
assert.ok(spanNotice.textAr.includes(heatWin.seasonAr));
assert.ok(spanNotice.textAr.includes("3337"));
// A span the season reaches is an alert, not reference — the ban bites on those days.
assert.notEqual(spanNotice.level, HEAT_BAN_STATE_LEVEL.off_season);

// State 1 — a span the season never reaches keeps the decision readable, in a
// cite level: no red is owed for a December task, whatever hour it is opened at.
const offSeasonSpan = deriveTaskHeatBanNotice({ ...fieldTask, startAt: "2026-12-01", dueAt: "2026-12-20" });
assert.ok(offSeasonSpan);
assert.equal(offSeasonSpan.id, "heat_ban_off_season");
assert.equal(offSeasonSpan.level, HEAT_BAN_STATE_LEVEL.off_season);
assert.equal(offSeasonSpan.inSeason, false);
assert.equal(offSeasonSpan.cite.article, "122");
assert.ok(offSeasonSpan.textAr.includes(heatWin.seasonAr));
assert.ok(offSeasonSpan.textAr.includes(heatWin.startLabel));
assert.ok(offSeasonSpan.textAr.includes(heatWin.endLabel));
// The creation notice never carries the block level — that stays with the log gate.
assert.notEqual(offSeasonSpan.level, HEAT_BAN_STATE_LEVEL.in_window);
assert.notEqual(spanNotice.level, HEAT_BAN_STATE_LEVEL.in_window);
assert.equal(heatBlocked.ok, false);

// Indoors never reaches the ladder, so nothing to paint at all.
assert.equal(deriveTaskHeatBanNotice({ ...deskTask, startAt: "2026-06-10", dueAt: "2026-06-30" }), null);
assert.equal(deriveTaskHeatBanNotice({ ...generalIndoorTask, startAt: "2026-06-10", dueAt: "2026-06-30" }), null);

console.log("opsDerivations E2E rules: PASS");
