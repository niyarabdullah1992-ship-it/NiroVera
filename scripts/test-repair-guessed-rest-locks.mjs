// A leave approved before its roster week was published froze Monday/Tuesday as «company»/«cycle» rest
// and took nothing from the balance. The one-time repair re-reads only those guessed days.
import assert from "node:assert/strict";
import { repairGuessedRestLocks } from "../src/lib/leaveEidOverlap.js";

const make = (published, lockedAt) => ({
  weeklyRestDays: [5, 6],
  schedules: [{ stationId: "s1", shiftTypes: [{ id: "m" }], assignments: {}, publishedWeeks: published }],
  employees: [{
    id: "e1",
    profile: { workStationId: "s1" },
    leaveRequests: [{
      id: "L", type: "annual", status: "approved", startDate: "2026-11-16", endDate: "2026-11-17",
      lockedAt, days: 0, lockedDays: { "2026-11-16": "company", "2026-11-17": "cycle" },
    }],
  }],
});

// week of 15 Nov never published → both days become work days
const a = make({ "2026-11-08": { at: "2026-11-07T10:00:00Z" } }, "2026-11-10T10:00:00Z");
assert.equal(repairGuessedRestLocks(a), 1);
const leaveA = a.employees[0].leaveRequests[0];
assert.deepEqual(leaveA.lockedDays, { "2026-11-16": "charge", "2026-11-17": "charge" });
assert.equal(leaveA.days, 2);
assert.equal(repairGuessedRestLocks(a), 0, "runs once — nothing left to repair");

// week published after the lock → the lock was still a guess
const b = make({ "2026-11-15": { at: "2026-11-12T10:00:00Z" } }, "2026-11-10T10:00:00Z");
assert.equal(repairGuessedRestLocks(b), 1);

// week published before the lock → the rest came from the real roster; untouched
const c = make({ "2026-11-15": { at: "2026-11-09T10:00:00Z" } }, "2026-11-10T10:00:00Z");
assert.equal(repairGuessedRestLocks(c), 0);
assert.equal(c.employees[0].leaveRequests[0].lockedDays["2026-11-16"], "company");

// a company that never publishes has no rule to repair against
assert.equal(repairGuessedRestLocks(make({}, "2026-11-10T10:00:00Z")), 0);

console.log("PASS guessed rest days of an unpublished week are re-read once");
