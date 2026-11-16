// Early leave is wage not due (the model regulation's «حسم أجر مدة ترك العمل»), read the same way as lateness:
// from the row's earlyLeaveMinutes, less an approved «استئذان», skipped on a manager-approved day, capped at
// one ordinary day. A manager-approved day («excused») also stops the lateness cut it promised to stop.
import assert from "node:assert/strict";
import { earlyLeaveMonth, lateMonth } from "../src/lib/payrollLaw.js";

const WAGE = 10800; // daily 360 · hourly 45 · per minute 0.75 (30 × 8)
const emp = { id: "e1", otherRequests: [] };
const row = (date, extra) => ({ employeeId: "e1", date, ...extra });

// 1. plain early leave: 60 min → 45
assert.deepEqual(
  earlyLeaveMonth({ employee: emp, month: "2026-11", attendance: [row("2026-11-03", { earlyLeaveMinutes: 60 })], monthlyWage: WAGE }),
  { minutes: 60, days: 1, cut: 45, perMinute: 0.75 },
);

// 2. left before the shift began (510 past the end) → capped at one ordinary day (480 min = 360)
assert.equal(earlyLeaveMonth({ employee: emp, month: "2026-11", attendance: [row("2026-11-04", { earlyLeaveMinutes: 510 })], monthlyWage: WAGE }).cut, 360);

// 3. an approved permission covers its minutes; a pending one does not
const withPermission = {
  id: "e1",
  otherRequests: [
    { type: "permission", status: "approved", date: "2026-11-05", time: "13:00", timeTo: "14:00" },
    { type: "permission", status: "pending", date: "2026-11-06", time: "13:00", timeTo: "14:00" },
  ],
};
const p = earlyLeaveMonth({
  employee: withPermission,
  month: "2026-11",
  attendance: [row("2026-11-05", { earlyLeaveMinutes: 90 }), row("2026-11-06", { earlyLeaveMinutes: 60 })],
  monthlyWage: WAGE,
});
assert.equal(p.minutes, 30 + 60, "approved 60 min off the 90; the pending one cuts in full");

// 4. a manager-approved day cuts nothing — early leave or lateness
assert.equal(earlyLeaveMonth({ employee: emp, month: "2026-11", attendance: [row("2026-11-07", { earlyLeaveMinutes: 60, excused: true })], monthlyWage: WAGE }).cut, 0);
assert.equal(lateMonth({ employeeId: "e1", month: "2026-11", attendance: [row("2026-11-07", { lateMinutes: 20, excused: true })], monthlyWage: WAGE }).cut, 0, "«اعتماد الحضور» stops the lateness cut it promised");
assert.equal(lateMonth({ employeeId: "e1", month: "2026-11", attendance: [row("2026-11-08", { lateMinutes: 20 })], monthlyWage: WAGE }).cut, 15);

// 5. other months and absent days are not read
assert.equal(earlyLeaveMonth({ employee: emp, month: "2026-11", attendance: [row("2026-10-30", { earlyLeaveMinutes: 60 }), row("2026-11-09", { earlyLeaveMinutes: 60, status: "absent" })], monthlyWage: WAGE }).minutes, 0);

console.log("PASS early leave is wage not due (cap · permission · manager approval) · approved day stops the lateness cut");
