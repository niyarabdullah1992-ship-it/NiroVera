import assert from "node:assert/strict";
import {
  mergeRequestBag,
  mergeRequestLists,
  mergeEmployeeRequestBags,
  otherRequestsForEmployeeId,
  projectDirectoryEmployee,
  rosterEmployeeById,
} from "../src/lib/employeeRequestBags.js";
import { hydrateEmployeesLeave, leaveRosterFromEmployees } from "../src/lib/leaveDerivations.js";
import { NIGHT_FITNESS_TYPE, STUDY_CONSENT_TYPE } from "../src/lib/otherRequestDerivations.js";

const pendingLeave = { id: "lv1", type: "annual", status: "pending", createdAt: "2026-09-14T10:00:00.000Z" };
const pendingLetter = { id: "or1", type: "salary_letter", status: "pending", createdAt: "2026-09-14T10:00:00.000Z" };
const pendingNight = { id: "nf1", type: NIGHT_FITNESS_TYPE, status: "pending", from: "2026-09-01", to: "2027-08-31" };
const pendingStudy = { id: "sc1", type: STUDY_CONSENT_TYPE, status: "pending", companyId: "c1" };

assert.deepEqual(mergeRequestBag(undefined, [pendingLetter]).map((row) => row.id), ["or1"], "redacted pull keeps the local bag");
assert.ok(mergeRequestBag([], [pendingLetter]).some((row) => row.id === "or1"), "empty cloud array must not wipe a local pending row");
assert.equal(mergeRequestLists([pendingLetter], [{ ...pendingLetter, status: "approved", reviewedAt: "2026-09-15T10:00:00.000Z" }])[0].status, "approved");

const projected = projectDirectoryEmployee({
  employeeId: "emp_ahmed",
  name: "أحمد",
  leaveRequests: [pendingLeave],
  otherRequests: [pendingLetter, pendingNight, pendingStudy],
});
assert.equal(projected.id, "emp_ahmed");
assert.equal(projected.leaveRequests.length, 1);
assert.equal(projected.otherRequests.length, 3);

const merged = mergeEmployeeRequestBags(
  [{ id: "emp_ahmed", leaveRequests: [pendingLeave], otherRequests: [pendingLetter, pendingNight] }],
  [{ id: "emp_ahmed", name: "أحمد", leaveRequests: [], otherRequests: [] }],
);
assert.ok(merged[0].leaveRequests.some((row) => row.id === "lv1"));
assert.ok(merged[0].otherRequests.some((row) => row.id === "or1"));
assert.ok(merged[0].otherRequests.some((row) => row.id === "nf1"));

const aliased = mergeEmployeeRequestBags(
  [{ id: "emp_owner_preview", employeeId: "user_niyar", otherRequests: [pendingStudy] }],
  [{ id: "emp_owner_preview", employeeId: "user_niyar", otherRequests: [] }],
);
assert.ok(aliased[0].otherRequests.some((row) => row.id === "sc1"), "hydrate by employeeId keeps the raiser's pending bag");
assert.equal(rosterEmployeeById([{ id: "emp_owner_preview", employeeId: "user_niyar" }], "user_niyar")?.id, "emp_owner_preview");

const collided = mergeEmployeeRequestBags(
  [{ id: "emp_manager_preview", name: "أحمد السالم", leaveRequests: [pendingLeave], otherRequests: [pendingLetter] }],
  [{ id: "emp_owner_preview", employeeId: "emp_manager_preview", name: "نيار عبدالله", leaveRequests: [], otherRequests: [] }],
);
assert.equal(collided[0].leaveRequests.some((row) => row.id === "lv1"), false, "أحمد's leave bag must not attach to Niyar via a colliding employeeId");
assert.equal(collided[0].otherRequests.some((row) => row.id === "or1"), false, "أحمد's other bag must not attach to Niyar via a colliding employeeId");

const roster = leaveRosterFromEmployees([{
  id: "emp_ahmed",
  stationId: "st1",
  leaveRequests: [pendingLeave],
  otherRequests: [pendingNight, pendingStudy],
}]);
assert.ok(roster[0].otherRequests.some((row) => row.type === NIGHT_FITNESS_TYPE));
const hydrated = hydrateEmployeesLeave(
  [{ id: "emp_ahmed", leaveRequests: [], otherRequests: [] }],
  { leaveRoster: roster },
);
assert.ok(hydrated[0].leaveRequests.some((row) => row.id === "lv1"), "leaveRoster restores pending leave for إدارة");
assert.ok(hydrated[0].otherRequests.some((row) => row.id === "nf1"), "leaveRoster restores night fitness");
assert.ok(hydrated[0].otherRequests.some((row) => row.id === "sc1"), "leaveRoster restores study consent");
assert.deepEqual(
  otherRequestsForEmployeeId("emp_ahmed", { entity: { otherRequests: [] }, roster }).map((row) => row.id).sort(),
  ["nf1", "sc1"],
);

console.log("employee request bags ok");
