import assert from "node:assert/strict";
import {
  applyWorkplaceManagerRule,
  buildPeopleTree,
  checkSetReportsToGate,
  descendantEmployeeIds,
  explainWorkplaceManager,
  workplaceManagerCardMark,
  filterPeopleHits,
  flattenPeopleTree,
  peopleQueryMatches,
  pathToPerson,
  seatCompanyHeadOnRoot,
  teamsByManager,
  workplaceReportsToId,
  wouldCreateReportsCycle,
} from "../src/lib/peopleTreeGraph.js";

const data = {
  ownerId: "o1",
  employees: [
    { id: "o1", name: "المالك", role: "owner", stationId: "hq" },
    { id: "m1", name: "سالم", role: "employee", stationId: "khafji", profile: { directManagerId: "o1", position: "مدير الفرع" } },
    { id: "a1", name: "فهد", role: "employee", stationId: "port", profile: { directManagerId: "m1", position: "فني" } },
    { id: "a2", name: "خالد", role: "employee", stationId: "jeddah", profile: { position: "فني" } },
  ],
  orgSeats: [
    { id: "s1", employeeId: "m1", stationId: "khafji", title: "مدير الفرع", reportsToEmployeeId: "o1" },
    { id: "s2", employeeId: "a1", stationId: "port", title: "فني", reportsToEmployeeId: "m1" },
    { id: "s3", employeeId: "a2", stationId: "jeddah", title: "فني" },
  ],
  stations: [
    { id: "hq", name: "الرئاسة", isCompanyRoot: true, managerId: "o1" },
    { id: "khafji", name: "فرع الخفجي", parentStationId: "hq", managerId: "m1" },
    { id: "port", name: "ميناء الدمام", parentStationId: "khafji" },
    { id: "jeddah", name: "فرع جدة", parentStationId: "hq" },
  ],
};

assert.equal(wouldCreateReportsCycle(data, "m1", "a1"), true);
assert.equal(wouldCreateReportsCycle(data, "a1", "a2"), false);
assert.equal(checkSetReportsToGate(data, "m1", "a1").error, "CYCLE");
assert.equal(checkSetReportsToGate(data, "a2", "m1").ok, true);
assert.deepEqual(descendantEmployeeIds(data, "m1").sort(), ["a1"]);
assert.equal(workplaceReportsToId(data.employees.find((item) => item.id === "a1"), data), "m1");
assert.equal(workplaceReportsToId(data.employees.find((item) => item.id === "a2"), data), "o1");
assert.equal(workplaceReportsToId(data.employees.find((item) => item.id === "m1"), data), "o1");

const drifted = JSON.parse(JSON.stringify(data));
drifted.employees.find((item) => item.id === "a1").profile.directManagerId = "o1";
drifted.orgSeats.find((seat) => seat.id === "s2").reportsToEmployeeId = "o1";
assert.equal(workplaceReportsToId(drifted.employees.find((item) => item.id === "a1"), drifted), "m1");

const tree = buildPeopleTree(drifted);
const ownerNode = tree.roots.find((node) => node.id === "o1");
const khalid = ownerNode?.children.find((node) => node.id === "a2");
assert.equal(tree.roots.length, 1);
assert.equal(ownerNode.id, "o1");
assert.equal(khalid?.id, "a2");
assert.equal(khalid?.managerId, "o1");
const salem = ownerNode.children.find((node) => node.id === "m1");
const fahd = salem?.children.find((node) => node.id === "a1");
assert.equal(salem?.job, "مدير الفرع");
assert.equal(fahd?.cross, true);
assert.equal(salem?.treePeople, 2);
assert.equal(salem?.treeBranches, 1);
assert.equal(salem?.scopePeople, 2);
assert.equal(ownerNode.treePeople, 4);
assert.equal(ownerNode.treeBranches, 3);
assert.equal(ownerNode.scopePeople, 4);
assert.equal(tree.total, 4);
assert.deepEqual(pathToPerson(tree.roots, "a1").map((node) => node.id), ["o1", "m1", "a1"]);

const teams = teamsByManager(tree);
assert.equal(teams.length, 2);
assert.equal(teams[0].id, "o1");
assert.deepEqual(teams[0].items.map((node) => node.id).sort(), ["a2", "m1"]);
assert.deepEqual(teams.find((team) => team.id === "m1")?.items.map((node) => node.id), ["a1"]);

const workplace = {
  ownerId: "o1",
  employees: [
    { id: "o1", name: "المالك", role: "owner", stationId: "co", profile: {} },
    { id: "m1", name: "سالم", role: "employee", stationId: "khafji", profile: {} },
    { id: "a1", name: "فهد", role: "employee", stationId: "khafji", profile: {} },
    { id: "m2", name: "بندر", role: "employee", stationId: "dammam", profile: {} },
  ],
  orgSeats: [
    { id: "s1", employeeId: "m1", stationId: "khafji", title: "مدير الفرع" },
    { id: "s2", employeeId: "a1", stationId: "khafji", title: "فني" },
    { id: "s3", employeeId: "m2", stationId: "dammam", title: "مدير الفرع" },
  ],
  stations: [
    { id: "co", name: "المنشأة", isCompanyRoot: true, managerId: "o1" },
    { id: "east", name: "الشرقية", parentStationId: "co", managerId: "m1" },
    { id: "khafji", name: "فرع الخفجي", parentStationId: "east", managerId: "m1" },
    { id: "dammam", name: "فرع الدمام", parentStationId: "east", managerId: "m2" },
  ],
};
assert.equal(applyWorkplaceManagerRule(workplace), true);
assert.equal(workplace.employees.find((item) => item.id === "a1").profile.directManagerId, "m1");
assert.equal(workplace.employees.find((item) => item.id === "m2").profile.directManagerId, "m1");
assert.equal(workplace.employees.find((item) => item.id === "m1").profile.directManagerId, "o1");
assert.equal(applyWorkplaceManagerRule(workplace), false);

const eastScope = {
  ownerId: "o1",
  employees: [
    { id: "o1", name: "المالك", role: "owner", stationId: "co" },
    { id: "e0", name: "سلطان", role: "employee", stationId: "east" },
    { id: "k0", name: "سالم", role: "employee", stationId: "khafji" },
    { id: "k1", name: "فهد", role: "employee", stationId: "khafji" },
    { id: "w0", name: "تركي", role: "employee", stationId: "west", profile: { directManagerId: "e0" } },
    { id: "w1", name: "ماجد", role: "employee", stationId: "jeddah" },
  ],
  orgSeats: [
    { id: "s0", employeeId: "e0", stationId: "east", title: "مدير المنطقة" },
    { id: "s1", employeeId: "k0", stationId: "khafji", title: "مدير الفرع" },
    { id: "s2", employeeId: "k1", stationId: "khafji", title: "فني" },
    { id: "s3", employeeId: "w0", stationId: "east", title: "فني", reportsToEmployeeId: "e0" },
    { id: "s4", employeeId: "w1", stationId: "jeddah", title: "مدير الفرع" },
  ],
  stations: [
    { id: "co", name: "المنشأة", isCompanyRoot: true, managerId: "o1" },
    { id: "east", name: "المنطقة الشرقية", parentStationId: "co", managerId: "e0" },
    { id: "khafji", name: "فرع الخفجي", parentStationId: "east", managerId: "k0" },
    { id: "dammam", name: "فرع الدمام", parentStationId: "east" },
    { id: "office", name: "المكتب", parentStationId: "dammam" },
    { id: "port", name: "الميناء", parentStationId: "dammam" },
    { id: "west", name: "المنطقة الغربية", parentStationId: "co", managerId: "w0" },
    { id: "jeddah", name: "فرع جدة", parentStationId: "west", managerId: "w1" },
  ],
};
const eastTree = buildPeopleTree(eastScope);
const sultan = flattenPeopleTree(eastTree.roots).find((node) => node.id === "e0");
assert.equal(sultan?.treeBranches, 4);
assert.equal(sultan?.scopePeople, 3);
assert.equal(sultan?.scopePeople < eastScope.employees.length, true);

const twins = {
  ownerId: "o1",
  employees: [
    { id: "o1", name: "نورة", role: "owner", stationId: "hq" },
    { id: "m1", name: "سالم", role: "employee", stationId: "north" },
  ],
  orgSeats: [
    { id: "s0", employeeId: "o1", stationId: "hq", title: "المالك" },
    { id: "s1", employeeId: "m1", stationId: "north", title: "مدير فرع" },
  ],
  stations: [
    { id: "hq", name: "المنشأة", isCompanyRoot: true, managerId: "o1" },
    { id: "north", name: "الشمال", parentStationId: "hq", managerId: "m1" },
    { id: "east", name: "الشرق", parentStationId: "hq", managerId: "m1" },
  ],
};
assert.equal(workplaceReportsToId(twins.employees[1], twins), "o1");
const note = explainWorkplaceManager(twins, "m1", { ar: true });
assert.equal(note.many, true);
assert.equal(note.homeName, "الشمال");
assert.equal(note.reportsToName, "نورة");
assert.match(note.line, /الشمال والشرق/);
assert.match(note.line, /يحضر من الشمال/);
assert.match(note.line, /يتبع نورة/);
const en = explainWorkplaceManager(twins, "m1", { ar: false });
assert.match(en.line, /Attends from الشمال/);
assert.match(en.line, /Reports to نورة/);
assert.equal(note.homeId, "north");
assert.deepEqual(note.managedIds.sort(), ["east", "north"]);
assert.equal(workplaceManagerCardMark(twins, "m1", "north"), "home");
assert.equal(workplaceManagerCardMark(twins, "m1", "east"), "cover");
assert.equal(workplaceManagerCardMark(twins, "m1", "hq"), null);
assert.equal(explainWorkplaceManager(twins, "missing"), null);

const misplacedHead = {
  ownerId: "niyar",
  employees: [
    { id: "niyar", name: "نيار عبدالله", role: "director", stationId: "khafji" },
    { id: "salem", name: "سالم العتيبي", role: "employee", stationId: "khafji" },
  ],
  orgSeats: [
    { id: "seat_n", employeeId: "niyar", stationId: "khafji", title: "رأس المنشأة" },
  ],
  stations: [
    { id: "hq", name: "NiroVera Preview", isCompanyRoot: true, managerId: "niyar" },
    { id: "khafji", name: "فرع الخفجي", parentStationId: "hq", managerId: "salem" },
  ],
  schedules: [
    {
      stationId: "khafji",
      assignments: { "2026-09-13": { morning: ["niyar", "salem"] } },
    },
  ],
};
assert.equal(seatCompanyHeadOnRoot(misplacedHead), true);
assert.equal(misplacedHead.employees[0].stationId, "hq");
assert.equal(misplacedHead.orgSeats[0].stationId, "hq");
assert.deepEqual(misplacedHead.schedules[0].assignments["2026-09-13"].morning, ["salem"]);
applyWorkplaceManagerRule(misplacedHead);
assert.equal(misplacedHead.employees[0].stationId, "hq");
assert.equal(seatCompanyHeadOnRoot(misplacedHead), false);

assert.equal(peopleQueryMatches("خالد القحطاني فرع جدة", "خالد"), true);
assert.equal(peopleQueryMatches("أحمد السلمي", "احمد"), true);
assert.equal(peopleQueryMatches("خالد القحطاني فرع جدة", "جدة"), true);
assert.equal(peopleQueryMatches("خالد القحطاني فرع جدة", "نورة"), false);
const treeHits = filterPeopleHits(flattenPeopleTree(tree.roots), "خالد");
assert.equal(treeHits.length, 1);
assert.equal(treeHits[0].id, "a2");
assert.equal(filterPeopleHits(flattenPeopleTree(tree.roots), "").length, 0);

console.log("people tree ok");
