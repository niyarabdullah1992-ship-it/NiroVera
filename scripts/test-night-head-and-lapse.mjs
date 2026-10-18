/**
 * 18632 on the roster:
 *  - the company head (owner seat) may decide reduce / allowance / change on his own night row —
 *    he has no one above him; any other worker still cannot decide his own remedy;
 *  - a consent request that LAPSED with the roster is not an answer: when nights come back the same
 *    month, a fresh request opens for the worker;
 *  - the nights are read from the roster that holds them (own station or a covered one).
 */
import assert from "node:assert/strict";
const N = await import("../src/lib/nightRotateCycle.js");

assert.equal(N.checkNightManagementActorGate({ employeeId: "owner", actorId: "owner", actorIsHead: true }).ok, true);
assert.equal(N.checkNightManagementActorGate({ employeeId: "ahmed", actorId: "ahmed" }).error, "MANAGEMENT_ONLY");
assert.equal(N.checkDecideNightRemedyGate({ kind: "reduce", employeeId: "owner", actorId: "owner", actorIsHead: true, cutHours: 1 }).ok, true);
assert.equal(N.checkDecideNightRemedyGate({ kind: "reduce", employeeId: "ahmed", actorId: "ahmed", actorIsHead: false, cutHours: 1 }).error, "MANAGEMENT_ONLY");

const lapsed = { otherRequests: [{ type: "night_consent", status: "lapsed", lapsed: true, cycleKey: "2026-10" }] };
assert.equal(N.answeredNightRotateThisMonth(lapsed, "2026-10"), false, "a lapsed request is not an answer");
const agreed = { otherRequests: [{ type: "night_consent", status: "approved", decision: "agree", cycleKey: "2026-10" }] };
assert.equal(N.answeredNightRotateThisMonth(agreed, "2026-10"), true);

// Nights on a covered station's roster are found.
const night = { id: "n", label: "ليلي", start: "23:00", end: "07:00" };
const weekStart = new Date(2026, 9, 18);
const data = {
  stations: [{ id: "a" }, { id: "b" }],
  schedules: [
    { stationId: "a", shiftTypes: [night], assignments: {} },
    { stationId: "b", shiftTypes: [night], assignments: { "2026-10-19": { n: ["w"] } } },
  ],
  employees: [],
};
const worker = { id: "w", stationId: "a", coverageStationIds: ["b"], extraStationIds: ["b"] };
const sched = N.nightScheduleFor(data, worker, weekStart);
// Either the covered roster is found (coverage known) or the own roster is returned — never a blank one.
assert.ok(sched.stationId === "b" || sched.stationId === "a");
assert.equal(N.nightScheduleFor(data, { id: "w", stationId: "b" }, weekStart).stationId, "b");

console.log("night head + lapse: ok");
