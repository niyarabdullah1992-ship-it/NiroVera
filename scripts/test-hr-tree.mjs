import assert from "node:assert/strict";
import { checkSetStationParentGate } from "../src/lib/stationTree.js";
import { applyWorkplaceManagerRule, buildPeopleTree, workplaceReportsToId } from "../src/lib/peopleTreeGraph.js";
import { linkBranchHr } from "../src/lib/hrTree.js";
import { buildWorkforceSeatChart, flattenSeatChart } from "../src/lib/workforceSeatChart.js";

function company() {
  return {
    ownerId: "ceo",
    employees: [
      { id: "ceo", name: "نورة", role: "director", stationId: "hq", profile: { position: "الرئيس التنفيذي" } },
      { id: "ops", name: "سلطان", role: "employee", stationId: "east", profile: { position: "مدير المنطقة" } },
      { id: "hrd", name: "لمى", role: "employee", stationId: "hq", profile: { position: "مديرة الموارد البشرية" } },
      { id: "reg", name: "هند", role: "employee", stationId: "khafji", profile: { position: "مدير م.ب. الشرقية" } },
      { id: "hire", name: "ريم", role: "employee", stationId: "hq", profile: { position: "أخصائي توظيف" } },
      { id: "law", name: "فهد", role: "employee", stationId: "khafji", profile: { position: "مسؤول الالتزام والعلاقات العمالية" } },
      { id: "pay", name: "سارة", role: "employee", stationId: "jeddah", profile: { position: "مسؤول الرواتب والعقود" } },
      { id: "bm", name: "سالم", role: "employee", stationId: "khafji", profile: { position: "مدير الفرع" } },
      { id: "emp", name: "أحمد", role: "employee", stationId: "khafji", profile: { position: "فني" } },
    ],
    orgSeats: [
      { id: "s-hire", employeeId: "hire", stationId: "hq", title: "أخصائي توظيف", hrPost: "recruitment", hrLeadId: "reg" },
      { id: "s-law", employeeId: "law", stationId: "khafji", title: "مسؤول الالتزام والعلاقات العمالية" },
      { id: "s-pay", employeeId: "pay", stationId: "jeddah", title: "مسؤول الرواتب والعقود" },
    ],
    stations: [
      { id: "hq", name: "المقر الرئيسي", isCompanyRoot: true, managerId: "ceo" },
      { id: "east", name: "المنطقة الشرقية", parentStationId: "hq", managerId: "ops", unitKind: "manager" },
      { id: "khafji", name: "فرع الخفجي", parentStationId: "east", managerId: "bm", unitKind: "branch" },
      { id: "dammam", name: "فرع الدمام", parentStationId: "east", managerId: "bm", unitKind: "branch" },
      { id: "jeddah", name: "فرع جدة", parentStationId: "hq", unitKind: "branch" },
    ],
  };
}

const data = company();
data.stations.find((station) => station.id === "hq").managerId = "ceo";
const hr = data.stations.find((station) => station.name === "وحدة الموارد البشرية");
assert.equal(hr, undefined);
assert.equal(applyWorkplaceManagerRule(data), true);
const unit = data.stations.find((station) => station.fixedUnit === "hr");
assert.ok(unit);
assert.equal(unit.parentStationId, "hq");
assert.equal(unit.name, "وحدة الموارد البشرية");
assert.equal(unit.managerId, "hrd");
assert.equal(data.orgSeats.some((seat) => seat.hrPost === "regional" && seat.hrRegionId === "east"), false);
assert.equal(data.orgSeats.some((seat) => seat.id === "seat_hr_director" && !seat.employeeId), false);
assert.equal(applyWorkplaceManagerRule(data), false);

assert.equal(checkSetStationParentGate(data.stations, unit.id, "east").error, "FIXED_HR");
assert.equal(checkSetStationParentGate(data.stations, "khafji", unit.id).error, "HR_NOT_PARENT");

assert.equal(workplaceReportsToId(data.employees.find((item) => item.id === "hrd"), data), "ceo");
assert.notEqual(workplaceReportsToId(data.employees.find((item) => item.id === "hrd"), data), "ops");

assert.equal(linkBranchHr(data, "khafji", "bm").error, "BRANCH_MANAGER");
assert.equal(linkBranchHr(data, "khafji", "reg").ok, true);
assert.equal(linkBranchHr(data, "dammam", "reg").ok, true);
assert.equal(linkBranchHr(data, "jeddah", "reg").ok, true);
assert.equal(linkBranchHr(data, "jeddah", "reg").ok, true);
const fourth = company();
fourth.stations.push({ id: "rabigh", name: "فرع رابغ", parentStationId: "hq", unitKind: "branch" });
linkBranchHr(fourth, "khafji", "reg");
fourth.stations.find((station) => station.id === "hq").managerId = "ceo";
assert.equal(linkBranchHr(data, "jeddah", "reg").ok, true);
const extra = { ...data, stations: [...data.stations, { id: "rabigh", name: "فرع رابغ", parentStationId: "hq", unitKind: "branch" }] };
assert.equal(linkBranchHr(extra, "rabigh", "reg").error, "HR_SPAN");

applyWorkplaceManagerRule(data);
assert.equal(workplaceReportsToId(data.employees.find((item) => item.id === "reg"), data), "hrd");
assert.equal(workplaceReportsToId(data.employees.find((item) => item.id === "hire"), data), "reg");
assert.equal(workplaceReportsToId(data.employees.find((item) => item.id === "law"), data), "hrd");
assert.equal(workplaceReportsToId(data.employees.find((item) => item.id === "pay"), data), "hrd");
assert.equal(workplaceReportsToId(data.employees.find((item) => item.id === "emp"), data), "bm");
assert.equal(data.employees.find((item) => item.id === "emp").stationId, "khafji");
assert.equal(data.employees.find((item) => item.id === "reg").stationId, unit.id);

const tree = buildPeopleTree(data);
const flat = [];
const walk = (nodes) => nodes.forEach((node) => {
  flat.push(node);
  walk(node.children || []);
});
walk(tree.roots);
const under = (id) => flat.find((node) => node.id === id)?.managerId;
assert.equal(under("hrd"), "ceo");
assert.equal(under("reg"), "hrd");
assert.equal(under("hire"), "reg");
assert.equal(under("law"), "hrd");
assert.equal(under("pay"), "hrd");
assert.equal(under("emp"), "bm");
assert.notEqual(under("emp"), "hrd");
assert.notEqual(under("emp"), "reg");

const chart = buildWorkforceSeatChart(data, { ar: true });
const seats = flattenSeatChart(chart.roots);
const director = seats.find((node) => node.id === "hrd");
assert.equal(director.kindLock, true);
assert.equal(director.kindTag, "قسم ثابت · HR");
assert.equal(director.kind, "person");
assert.equal(seats.some((node) => node.id === `vacant-station:${unit.id}`), false);
assert.equal(seats.some((node) => node.hrPost === "regional" && !node.employeeId), false);
const regNode = seats.find((node) => node.id === "reg");
assert.match(regNode.coordinate, /يخدم:/);
assert.match(regNode.coordinate, /الخفجي/);
assert.match(regNode.coordinate, / \+ /);
const hrdNode = seats.find((node) => node.id === "hrd");
assert.equal(hrdNode.kind, "person");
assert.equal(hrdNode.kindTag, "قسم ثابت · HR");
assert.equal(hrdNode.kindLock, true);
assert.equal(seats.some((node) => String(node.id) === `vacant-station:${unit.id}`), false);
assert.equal(seats.filter((node) => node.kindTag === "قسم ثابت · HR").length, 1);
const bmNode = seats.find((node) => node.id === "bm");
assert.equal(bmNode.coordinate || "", "");
const parentOf = (id) => seats.find((node) => (node.children || []).some((child) => child.id === id));
assert.equal(parentOf("emp")?.id, "bm");
assert.notEqual(parentOf("emp")?.id, "hrd");
assert.equal(parentOf("law")?.id, "hrd");
assert.equal(parentOf("reg")?.id, "hrd");

console.log("hr tree ok");
