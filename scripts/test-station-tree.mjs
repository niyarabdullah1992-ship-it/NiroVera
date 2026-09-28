import assert from "node:assert/strict";
import {
  allowedStationParents,
  checkSetStationParentGate,
  descendantStationIds,
  expandStationScope,
  extraCoverageStationIds,
  rootStations,
  scopedStationIdsForUser,
  scopeStationsForDisplay,
  stationSubtreeIds,
  stripDescendantCoverage,
  stationInHeaderScope,
  userCoversStation,
  wouldCreateStationCycle,
  isManagerUnit,
  isWorkplaceStation,
  stationAllowsHire,
  stationAllowsOpsChat,
  workplaceStations,
  normalizeUnitKind,
  headerScopeBranches,
  isNestedWorkplace,
} from "../src/lib/stationTree.js";

const east = { id: "east", name: "الشرقية", parentStationId: null };
const dammam = { id: "dmm", name: "الدمام", parentStationId: "east" };
const port = { id: "port", name: "الميناء", parentStationId: "dmm" };
const west = { id: "west", name: "الغربية", parentStationId: null };
const stations = [east, dammam, port, west];

assert.equal(wouldCreateStationCycle(stations, "east", "port"), true);
assert.equal(wouldCreateStationCycle(stations, "east", "east"), true);
assert.equal(wouldCreateStationCycle(stations, "port", "west"), false);
assert.equal(wouldCreateStationCycle(stations, "west", "east"), false);
assert.equal(checkSetStationParentGate(stations, "east", "port").error, "CYCLE_FORBIDDEN");
assert.equal(checkSetStationParentGate(stations, "port", "").ok, true);
assert.equal(checkSetStationParentGate(
  [{ id: "co", name: "المنشأة", parentStationId: null, isCompanyRoot: true }, ...stations],
  "co",
  "east",
).error, "COMPANY_ROOT");

assert.deepEqual(descendantStationIds(stations, "east").sort(), ["dmm", "port"]);
assert.deepEqual(stationSubtreeIds(stations, "dmm").sort(), ["dmm", "port"]);
assert.deepEqual(expandStationScope(stations, ["east"]).sort(), ["dmm", "east", "port"]);
assert.equal(stationInHeaderScope("east", "east", stations), true);
assert.equal(stationInHeaderScope("dmm", "east", stations), false);
assert.equal(stationInHeaderScope("port", "east", stations), false);
assert.equal(stationInHeaderScope("west", "east", stations), false);
assert.equal(stationInHeaderScope("dmm", "all", stations), true);
assert.equal(stationInHeaderScope("port", "dmm", stations), false);
assert.equal(stationInHeaderScope("east", "dmm", stations), false);
assert.equal(rootStations(stations).map((s) => s.id).sort().join(","), "east,west");
assert.equal(allowedStationParents(stations, "east").some((s) => s.id === "port"), false);
assert.equal(allowedStationParents(stations, "east").some((s) => s.id === "west"), true);

const manager = { id: "m1", stationId: "east", role: "employee" };
const data = { stations, orgSeats: [{ id: "s1", employeeId: "m1", stationId: "east", title: "مدير المنطقة" }] };
assert.deepEqual(scopedStationIdsForUser(manager, data).sort(), ["dmm", "east", "port"]);

const clerk = { id: "c1", stationId: "east", role: "employee" };
assert.deepEqual(scopedStationIdsForUser(clerk, data), ["east"]);

const tech = { id: "t1", stationId: "port", role: "employee" };
assert.deepEqual(scopedStationIdsForUser(tech, data), ["port"]);

const khafji = { id: "khf", name: "فرع الخفجي", parentStationId: "east" };
const dmmBranch = { id: "dmmb", name: "فرع الدمام", parentStationId: "east" };
const jubail = { id: "jub", name: "فرع الجبيل", parentStationId: "east" };
const ahsa = { id: "ahs", name: "فرع الأحساء", parentStationId: "east" };
const westChild = { id: "yan", name: "فرع ينبع", parentStationId: "west" };
const region = {
  stations: [
    { id: "east", name: "المنطقة الشرقية", parentStationId: "co", managerId: "e0" },
    khafji,
    dmmBranch,
    jubail,
    ahsa,
    { id: "west", name: "المنطقة الغربية", parentStationId: "co" },
    westChild,
    { id: "co", name: "المنشأة", parentStationId: null, isCompanyRoot: true },
  ],
  orgSeats: [{ id: "s-east", employeeId: "e0", stationId: "east", title: "مدير المنطقة" }],
};
const eastLead = { id: "e0", stationId: "east", role: "employee", managedStations: [] };
assert.deepEqual(scopedStationIdsForUser(eastLead, region).sort(), ["ahs", "dmmb", "east", "jub", "khf"]);
assert.equal(userCoversStation(eastLead, region, "khf"), true);
assert.equal(userCoversStation(eastLead, region, "yan"), false);

const eastClerk = { id: "c0", stationId: "east", role: "employee", managedStations: [] };
assert.deepEqual(scopedStationIdsForUser(eastClerk, region), ["east"]);
assert.equal(userCoversStation(eastClerk, region, "khf"), false);

assert.deepEqual(
  stripDescendantCoverage(["khf", "west", "east"], region.stations, "east").sort(),
  ["west"],
);
const dirtyLead = { ...eastLead, managedStations: ["khf", "dmmb", "west"] };
assert.deepEqual(extraCoverageStationIds(dirtyLead, region), ["west"]);
assert.ok(scopedStationIdsForUser(dirtyLead, region).includes("yan"));

const shown = scopeStationsForDisplay(dirtyLead, region);
assert.equal(shown.homeName, "المنطقة الشرقية");
assert.deepEqual(shown.inherited.map((item) => item.name).sort(), ["فرع الأحساء", "فرع الجبيل", "فرع الخفجي", "فرع الدمام"]);
assert.equal(shown.inherited.find((item) => item.id === "khf")?.descendantCount, 0);
assert.equal(shown.extras.length, 1);
assert.equal(shown.extras[0].id, "west");
assert.equal(shown.extras[0].kind, "extra");
assert.equal(shown.extras[0].label, "المنطقة الغربية · 1");
assert.equal(shown.inherited.some((item) => item.id === "khf"), true);

assert.equal(stationInHeaderScope("yan", "west", region.stations), false);
assert.equal(stationInHeaderScope("west", "west", region.stations), true);
assert.equal(stationInHeaderScope("khf", "west", region.stations), false);

const owner = { id: "own", stationId: "co", role: "owner" };
const ownerShown = scopeStationsForDisplay(owner, {
  ...region,
  stations: region.stations.map((station) => (station.id === "co" ? { ...station, managerId: "own" } : station)),
});
assert.equal(ownerShown.homeIsCompanyRoot, true);
assert.deepEqual(ownerShown.inherited, []);

assert.equal(normalizeUnitKind("manager"), "manager");
assert.equal(normalizeUnitKind(""), "branch");
assert.equal(isManagerUnit({ unitKind: "manager" }), true);
assert.equal(isWorkplaceStation({ id: "east", unitKind: "manager" }), false);
assert.equal(isWorkplaceStation({ id: "dmm" }), true);
assert.equal(stationAllowsHire({ unitKind: "manager" }), false);
assert.equal(stationAllowsHire({ id: "dmm" }), true);
assert.equal(stationAllowsOpsChat({ unitKind: "manager" }), false);
assert.equal(stationAllowsOpsChat({ id: "dmm" }), true);
assert.deepEqual(
  workplaceStations([{ id: "east", name: "الشرقية", unitKind: "manager" }, { id: "dmm", name: "الدمام" }]).map((s) => s.id),
  ["dmm"],
);

const companyAsManager = { id: "co", name: "المنشأة", isCompanyRoot: true, unitKind: "manager" };
assert.equal(isManagerUnit(companyAsManager), false);
assert.equal(isWorkplaceStation(companyAsManager), true);
assert.equal(stationAllowsHire(companyAsManager), true);
assert.equal(stationAllowsOpsChat(companyAsManager), true);
assert.equal(isWorkplaceStation({ id: "co", name: "المنشأة", isCompanyRoot: true }), true);
assert.deepEqual(
  workplaceStations([companyAsManager, { id: "dmm", name: "الدمام" }]).map((s) => s.id),
  ["co", "dmm"],
);

const scopeTree = [
  { id: "hq", name: "المقر", isCompanyRoot: true },
  { id: "east", name: "المنطقة الشرقية", unitKind: "manager", parentStationId: "hq" },
  { id: "khf", name: "فرع الخفجي", parentStationId: "east" },
  { id: "dmm", name: "فرع الدمام", parentStationId: "east" },
  { id: "port", name: "ميناء الدمام", parentStationId: "dmm" },
];
assert.equal(isNestedWorkplace(scopeTree[4], scopeTree), true);
assert.deepEqual(headerScopeBranches(scopeTree, scopeTree).map((row) => row.id), ["hq", "khf", "dmm"]);

console.log("station tree ok");
