/**
 * Roster QA fixes:
 *  - «سحب» of a «−Nس» cut puts the full night back (restoreCutNightDays);
 *  - an employee reads the published copy of a week the manager has edited since (publishedViewSchedule);
 *  - a week without a snapshot reads live.
 */
import assert from "node:assert/strict";
const W = await import("../src/lib/shiftWeek.js");

const night = { id: "night", label: "ليلي", start: "23:00", end: "07:00" };
const morning = { id: "morning", label: "صباحي", start: "07:00", end: "15:00" };
const weekStart = new Date(2026, 9, 18);
const schedule = { stationId: "s", shiftTypes: [night, morning], assignments: { "2026-10-18": { night: ["w"] }, "2026-10-19": { night: ["w"] } } };

const cut = W.remapEmployeeNightWorkerDays(schedule, "w", weekStart, "reduce", { cutHours: 2 });
assert.equal(cut.moved, 2);
assert.ok(W.employeeShiftOnDay(schedule, "w", "2026-10-18").cutHours, "cut applied");
const back = W.restoreCutNightDays(schedule, "w", W.weekKeyFromDate(weekStart));
assert.equal(back.moved, 2);
assert.equal(W.employeeShiftOnDay(schedule, "w", "2026-10-18").id, "night", "full night restored");
assert.equal(W.employeeShiftOnDay(schedule, "w", "2026-10-19").id, "night");

// Publish snapshot, then a manager edit that is not published yet.
const key = W.weekKeyFromDate(weekStart);
schedule.publishedWeeks = { [key]: { at: "x", ...W.publishedWeekSnapshot(schedule, weekStart) } };
schedule.assignments["2026-10-18"] = { morning: ["w"] };
schedule.weekDirty = { [key]: true };
const view = W.publishedViewSchedule(schedule, weekStart);
assert.equal(W.employeeShiftOnDay(view, "w", "2026-10-18").id, "night", "employee still sees the published night");
assert.equal(W.employeeShiftOnDay(schedule, "w", "2026-10-18").id, "morning", "the manager's live roster keeps the edit");
delete schedule.weekDirty[key];
assert.equal(W.publishedViewSchedule(schedule, weekStart), schedule, "a clean published week reads live");

console.log("roster QA fixes: ok");
