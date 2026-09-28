import assert from "node:assert/strict";
import {
  SCOPE,
  BASELINE_MATRIX,
  nextScopeInCycle,
  checkSetPermGate,
  checkCreateBranchGate,
  checkReparentGate,
  checkCreateDelegationGate,
  derivePermissionMatrix,
  deriveEscalationFromBranches,
  deriveAutoBranchEscalationChain,
  branchEscalationCardLine,
  branchEscalationHasChain,
  isDelegationActive,
  deriveDelegationStatus,
  wouldCreateCycle,
} from "../src/lib/orgDerivations.js";

assert.equal(BASELINE_MATRIX.length, 10);
assert.equal(BASELINE_MATRIX[7][1], SCOPE.DELEGATED); // HR × station mgr
assert.equal(BASELINE_MATRIX[9][0], SCOPE.COMPANY); // settings × ops director
assert.equal(BASELINE_MATRIX[9][4], SCOPE.NONE);

assert.equal(nextScopeInCycle(SCOPE.OWN), SCOPE.STATION);
assert.equal(nextScopeInCycle(SCOPE.COMPANY), SCOPE.NONE);
assert.equal(nextScopeInCycle(SCOPE.DELEGATED), SCOPE.DELEGATED);

assert.equal(checkSetPermGate(SCOPE.DELEGATED).error, "DELEGATED_IS_DERIVED");
assert.equal(checkSetPermGate(SCOPE.STATION).ok, true);

assert.equal(checkCreateBranchGate({ name: "", managerId: "e1" }).error, "BRANCH_NAME_REQUIRED");
assert.equal(checkCreateBranchGate({ name: "Khafji", managerId: "" }).error, "BRANCH_MANAGER_REQUIRED");
assert.equal(checkCreateBranchGate({ name: "Khafji", managerId: "e1" }).ok, true);

const nodes = [
  { id: "a", parentId: null },
  { id: "b", parentId: "a" },
  { id: "c", parentId: "b" },
];
assert.equal(wouldCreateCycle(nodes, "a", "c"), true);
assert.equal(wouldCreateCycle(nodes, "c", "a"), false);
assert.equal(checkReparentGate(nodes, "a", "c").error, "CYCLE_FORBIDDEN");
assert.equal(checkReparentGate(nodes, "c", "a").ok, true);

const now = new Date(2026, 7, 11);
assert.equal(isDelegationActive({ id: "d1", fromId: "a", toId: "b", perm: "x", end: "2026-08-18" }, now), true);
assert.equal(isDelegationActive({ id: "d2", fromId: "a", toId: "b", perm: "x", end: "2026-08-09" }, now), false);
assert.equal(deriveDelegationStatus({ id: "d2", fromId: "a", toId: "b", perm: "x", end: "2026-08-09" }, now).status, "expired");
assert.equal(isDelegationActive({ id: "d3", fromId: "a", toId: "b", perm: "x", start: "2026-08-20", end: "2026-09-01" }, now), false);
assert.equal(deriveDelegationStatus({ id: "d3", fromId: "a", toId: "b", perm: "x", start: "2026-08-20", end: "2026-09-01" }, now).status, "scheduled");

assert.equal(checkCreateDelegationGate({ fromId: "a", toId: "a", end: "2026-09-01", perm: "tasks" }).error, "SELF_DELEGATION_FORBIDDEN");
assert.equal(checkCreateDelegationGate({ fromId: "a", toId: "b", end: "2026-09-01", perm: "tasks" }).ok, true);

const matrix = derivePermissionMatrix({});
assert.equal(matrix[7].cells[1].derived, true);
assert.equal(matrix[0].cells[0].scope, SCOPE.COMPANY);

const dirty = derivePermissionMatrix({ "0:4": SCOPE.STATION });
assert.equal(dirty[0].cells[4].overridden, true);
assert.equal(dirty[0].cells[4].scope, SCOPE.STATION);

const esc = deriveEscalationFromBranches([
  { id: "jbl1", name: "Jubail 1", managerId: "m1", managerName: "Saud" },
  { id: "x", name: "Empty" },
]);
assert.equal(esc.length, 1);
assert.equal(esc[0].managerId, "m1");

const workplace = {
  ownerId: "o1",
  employees: [
    { id: "o1", name: "المالك", role: "owner" },
    { id: "m1", name: "سالم" },
    { id: "a1", name: "فهد", actingAssignments: [{ stationId: "port", until: "2099-01-01" }] },
    { id: "ghost", name: "شجرة قديمة" },
  ],
  stations: [
    { id: "hq", name: "الرئاسة", isCompanyRoot: true, managerId: "o1" },
    { id: "khafji", name: "الخفجي", parentStationId: "hq", managerId: "m1" },
    { id: "port", name: "الميناء", parentStationId: "khafji" },
  ],
  orgTree: [
    { id: "n1", type: "employee", refId: "ghost", parentId: null, title: "مدير عمليات" },
  ],
};
const portChain = deriveAutoBranchEscalationChain("port", workplace);
assert.equal(portChain[0].employeeId, "a1");
assert.equal(portChain[0].title, "مدير بالوكالة");
assert.equal(portChain[1].employeeId, "m1");
assert.equal(portChain[2].employeeId, "o1");
assert.equal(portChain.some((step) => step.employeeId === "ghost"), false);

const vacantChain = deriveAutoBranchEscalationChain("port", {
  ...workplace,
  employees: workplace.employees.map((item) => ({ ...item, actingAssignments: [] })),
});
assert.equal(vacantChain[0].employeeId, "m1");
assert.equal(vacantChain[1].employeeId, "o1");

const portLine = branchEscalationCardLine("port", workplace);
assert.equal(portLine[0].employeeId, "a1");
assert.equal(portLine[0].vacant, false);
assert.equal(branchEscalationHasChain("port", workplace), true);

const vacantLine = branchEscalationCardLine("port", {
  ...workplace,
  employees: workplace.employees.map((item) => ({ ...item, actingAssignments: [] })),
  stations: [
    ...workplace.stations,
    { id: "st_hr_unit", name: "وحدة الموارد البشرية", fixedUnit: "hr", parentStationId: "hq", managerId: "ghost" },
  ],
});
assert.equal(vacantLine[0].vacant, true);
assert.equal(vacantLine[0].employeeId, "");
assert.equal(vacantLine[0].stationId, "port");
assert.equal(vacantLine[1].employeeId, "m1");
assert.equal(vacantLine.some((step) => step.stationId === "st_hr_unit"), false);
assert.equal(branchEscalationHasChain("port", {
  employees: [],
  stations: [{ id: "port", name: "الميناء" }],
}), false);

const throughHr = branchEscalationCardLine("port", {
  employees: [{ id: "o1", name: "المالك", role: "owner" }],
  ownerId: "o1",
  stations: [
    { id: "hq", name: "الرئاسة", isCompanyRoot: true, managerId: "o1" },
    { id: "st_hr_unit", name: "وحدة الموارد البشرية", fixedUnit: "hr", parentStationId: "hq" },
    { id: "port", name: "الميناء", parentStationId: "st_hr_unit" },
  ],
});
assert.equal(throughHr.some((step) => step.stationId === "st_hr_unit"), false);
assert.equal(throughHr[0].vacant, true);
assert.equal(throughHr.some((step) => step.employeeId === "o1"), true);

const { escalationLiveStations } = await import("../src/lib/stationTree.js");
const live = escalationLiveStations([
  { id: "st_hr_unit", name: "وحدة الموارد البشرية", fixedUnit: "hr" },
  { id: "region", name: "منطقة", unitKind: "manager" },
  { id: "port", name: "الميناء" },
  { id: "closed", name: "مغلق", active: false },
]);
assert.deepEqual(live.map((station) => station.id), ["port"]);

console.log("org derivations ok");
