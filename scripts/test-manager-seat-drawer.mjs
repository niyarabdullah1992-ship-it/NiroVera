import assert from "node:assert/strict";
import { buildWorkforceSeatChart, flattenSeatChart } from "../src/lib/workforceSeatChart.js";
import { attachSharedGradesToTitles, ensureProductLadder, gradeRank, gradesForTitle, jobTitleKey, ladderBands } from "../src/lib/jobGradeTitles.js";
import {
  HTML_JOB_TITLES,
  createVacantSeatsUnderManagerOn,
  cycleSeatAccessOn,
  endSeatTenureOn,
  jobTitleCatalog,
  seatAccessOf,
  setActualWorkSiteOn,
} from "../src/lib/seatUnderManager.js";

function fixture() {
  return {
    ownerId: "o1",
    employees: [
      { id: "o1", name: "المالك", role: "owner", stationId: "hq", profile: { position: "الرئيس التنفيذي", gradeId: "g7" } },
      { id: "m1", name: "سالم", role: "station_manager", stationId: "khafji", profile: { directManagerId: "o1", position: "مدير الفرع", gradeId: "g5" } },
      { id: "a1", name: "فهد", role: "employee", stationId: "khafji", profile: { directManagerId: "m1", position: "فني تشغيل", gradeId: "g1" } },
    ],
    orgSeats: [
      { id: "s0", employeeId: "o1", stationId: "hq", title: "الرئيس التنفيذي", gradeId: "g7", listId: "ops", reportsToEmployeeId: null },
      { id: "s1", employeeId: "m1", stationId: "khafji", title: "مدير الفرع", gradeId: "g5", listId: "ops", reportsToEmployeeId: "o1" },
      { id: "s2", employeeId: "a1", stationId: "khafji", title: "فني تشغيل", gradeId: "g1", listId: "ops", reportsToEmployeeId: "m1" },
    ],
    stations: [
      { id: "hq", name: "المقر الرئيسي", code: "HQ", isCompanyRoot: true, managerId: "o1" },
      { id: "khafji", name: "فرع الخفجي", code: "KH", parentStationId: "hq", managerId: "m1", unitKind: "branch" },
      { id: "rass", name: "فرع الرس", code: "RS", parentStationId: "hq", managerId: null, unitKind: "branch" },
    ],
    jobGrades: [
      { id: "g1", listId: "ops", jobTitle: "فني تشغيل", titleKey: jobTitleKey("فني تشغيل"), gradeNumber: "1م", title: "تنفيذي", order: 1 },
      { id: "g5", listId: "ops", jobTitle: "مدير الفرع", titleKey: jobTitleKey("مدير الفرع"), gradeNumber: "5م", title: "مدير فرع", order: 5 },
      { id: "g6", listId: "ops", jobTitle: "محاسب", titleKey: jobTitleKey("محاسب"), gradeNumber: "6م", title: "مدير إدارة", order: 6 },
      { id: "gs", listId: "ops", jobTitle: "سائق", titleKey: jobTitleKey("سائق"), gradeNumber: "1م", title: "تنفيذي", order: 1 },
      { id: "g7", listId: "ops", jobTitle: "الرئيس التنفيذي", titleKey: jobTitleKey("الرئيس التنفيذي"), gradeNumber: "7م", title: "قيادي", order: 7 },
    ],
    permissionTemplates: [{ id: "ops", ar: "التشغيل", en: "Ops", permissions: { hr: "view", employees: "view", attendance: "manage" }, positions: [] }],
    smartPositions: [],
    orgStructureLog: [],
  };
}

assert.deepEqual(jobTitleCatalog({ permissionTemplates: [] }), HTML_JOB_TITLES);
assert.deepEqual(jobTitleCatalog({ permissionTemplates: [{ id: "ops", positions: [{ title: "محاسب" }] }] }), ["محاسب"]);

const head = fixture();
const blockedHead = endSeatTenureOn(head, "o1");
assert.equal(blockedHead.ok, false);
assert.equal(blockedHead.error, "COMPANY_HEAD");
assert.match(blockedHead.reason, /رأس المنشأة/);

const data = fixture();
const tooHigh = createVacantSeatsUnderManagerOn(data, { managerId: "m1", title: "محاسب", gradeId: "g6", qty: 1 });
assert.equal(tooHigh.ok, false);
assert.equal(tooHigh.error, "GRADE_ORDER");
assert.match(tooHigh.reason, /أقل من درجة المدير/);

const wrongLadder = createVacantSeatsUnderManagerOn(data, { managerId: "m1", title: "سائق", gradeId: "g1", qty: 1 });
assert.equal(wrongLadder.ok, false);
assert.equal(wrongLadder.error, "GRADE_TITLE");

const bare = createVacantSeatsUnderManagerOn(data, { managerId: "m1", title: "حارس أمن", gradeId: "gs", qty: 1 });
assert.equal(bare.ok, false);
assert.equal(bare.error, "NO_GRADE");

const managerTitle = createVacantSeatsUnderManagerOn(data, { managerId: "m1", title: "مدير الفرع", gradeId: "gs", qty: 1 });
assert.equal(managerTitle.ok, false);
assert.equal(managerTitle.error, "MANAGER_TAKEN");

const created = createVacantSeatsUnderManagerOn(data, { managerId: "m1", title: "سائق", gradeId: "gs", qty: 2 });
assert.equal(created.ok, true);
assert.equal(created.count, 2);
const vacant = data.orgSeats.filter((seat) => seat.title === "سائق" && !seat.employeeId);
assert.equal(vacant.length, 2);
assert.ok(vacant.every((seat) => seat.reportsToEmployeeId === "m1" && seat.hireOpen === true && seat.gradeId === "gs"));
assert.ok(data.permissionTemplates[0].positions.some((row) => row.title === "سائق"));

const chartBefore = flattenSeatChart(buildWorkforceSeatChart(data, { ar: true }).roots);
assert.ok(chartBefore.some((node) => node.id === "m1"));
assert.equal(chartBefore.filter((node) => node.title === "سائق · تنفيذي" && node.vacant).length, 2);

const ended = endSeatTenureOn(data, "m1");
assert.equal(ended.ok, true);
assert.equal(data.orgSeats.find((seat) => seat.id === "s1").employeeId, null);
assert.equal(data.orgSeats.find((seat) => seat.id === "s1").hireOpen, true);
assert.equal(data.stations.find((station) => station.id === "khafji").managerId, null);
assert.ok(data.employees.find((employee) => employee.id === "m1").profile.unseatedAt);
assert.ok(vacant.every((seat) => seat.reportsToEmployeeId === "o1"));

const chartAfter = flattenSeatChart(buildWorkforceSeatChart(data, { ar: true }).roots);
assert.equal(chartAfter.some((node) => node.id === "m1"), false);
assert.ok(chartAfter.some((node) => node.seatId === "s1" && node.vacant));

const again = endSeatTenureOn(data, "m1");
assert.equal(again.error, "ALREADY_VACANT");

const voice = cycleSeatAccessOn(fixture(), "m1", "complaints", { owner: false });
assert.equal(voice.error, "OWNER_ONLY");

const accessData = fixture();
const cycled = cycleSeatAccessOn(accessData, "m1", "hr", { owner: true });
assert.equal(cycled.ok, true);
assert.equal(cycled.value, "manage");
assert.equal(seatAccessOf(accessData, "m1").hr, "manage");
assert.equal(accessData.orgSeats.find((seat) => seat.id === "s1").permissions.hr, "manage");
assert.equal(accessData.smartPositions.find((row) => row.employeeId === "m1").permissions.hr, "manage");
assert.equal(seatAccessOf(accessData, "m1").attendance, "manage");

const site = setActualWorkSiteOn(accessData, "a1", "rass");
assert.equal(site.ok, true);
assert.equal(accessData.employees.find((employee) => employee.id === "a1").profile.workStationId, "rass");
assert.equal(accessData.employees.find((employee) => employee.id === "a1").stationId, "khafji");
const cleared = setActualWorkSiteOn(accessData, "a1", "");
assert.equal(cleared.ok, true);
assert.equal(accessData.employees.find((employee) => employee.id === "a1").profile.workStationId, undefined);

const shared = {
  employees: [
    { id: "e1", name: "أ", profile: { position: "مشغل محطة", gradeId: "op1" } },
    { id: "e2", name: "ب", profile: { position: "في صيانة", gradeId: "op1" } },
  ],
  orgSeats: [
    { id: "s1", title: "مشغل محطة", gradeId: "op1", employeeId: "e1", listId: "ops" },
    { id: "s2", title: "في صيانة", gradeId: "op1", employeeId: "e2", listId: "ops" },
  ],
  permissionTemplates: [{
    id: "ops",
    positions: [
      { id: "p1", title: "مشغل محطة" },
      { id: "p2", title: "في صيانة" },
      { id: "p3", title: "منسق عمليات" },
    ],
  }],
  jobGrades: [
    { id: "op1", listId: "ops", gradeNumber: "OP1", title: "متوسط", order: 1, minSalary: null, maxSalary: null },
    { id: "ld2", listId: "ops", gradeNumber: "LD2", title: "درجة جديدة 4", order: 4, minSalary: null, maxSalary: null },
  ],
};
assert.equal(attachSharedGradesToTitles(shared), true);
assert.equal(shared.employees.length, 2);
assert.equal(shared.orgSeats[0].employeeId, "e1");
assert.equal(shared.orgSeats[1].employeeId, "e2");
const stationOp = gradesForTitle(shared, "مشغل محطة");
const serviceOp = gradesForTitle(shared, "في صيانة");
const coord = gradesForTitle(shared, "منسق عمليات");
assert.equal(stationOp.length, 1);
assert.equal(serviceOp.length, 1);
assert.equal(coord.length, 1);
assert.equal(stationOp[0].gradeNumber, "OP1");
assert.equal(serviceOp[0].gradeNumber, "OP1");
assert.notEqual(stationOp[0].id, serviceOp[0].id);
assert.equal(stationOp[0].minSalary ?? null, null);
assert.equal(serviceOp[0].maxSalary ?? null, null);
assert.equal(shared.orgSeats[0].gradeId, stationOp[0].id);
assert.equal(shared.orgSeats[1].gradeId, serviceOp[0].id);
assert.equal(shared.employees[0].profile.gradeId, stationOp[0].id);
assert.equal(shared.employees[1].profile.gradeId, serviceOp[0].id);
assert.equal(gradesForTitle(shared, "مشغل محطة").some((grade) => grade.gradeNumber === "LD2"), false);
assert.equal(attachSharedGradesToTitles(shared), false);

const bands = ladderBands(shared);
assert.ok(bands.length >= 1);
assert.equal(bands.some((band) => band.gradeNumber === "OP1"), true);
assert.ok(bands.every((band) => band.head.minSalary == null && band.head.maxSalary == null));
assert.equal(ladderBands({ jobGrades: [] }).length, 0);

const productOrder = fixture();
productOrder.jobGrades.push(
  { id: "m4", listId: "ops", jobTitle: "فني تشغيل", titleKey: jobTitleKey("فني تشغيل"), gradeNumber: "م4", title: "إشرافي – رئيس قسم", order: 4 },
  { id: "m5tech", listId: "ops", jobTitle: "فني تشغيل", titleKey: jobTitleKey("فني تشغيل"), gradeNumber: "م5", title: "إداري – مدير فرع", order: 5 },
);
assert.equal(gradeRank(productOrder.jobGrades.find((grade) => grade.id === "m4")), 4);
assert.equal(gradeRank({ gradeNumber: "م1" }), 1);
assert.equal(gradeRank({ gradeNumber: "م7" }), 7);
const belowManager = createVacantSeatsUnderManagerOn(productOrder, { managerId: "m1", title: "فني تشغيل", gradeId: "m4", qty: 1 });
assert.equal(belowManager.ok, true);
const levelWithManager = createVacantSeatsUnderManagerOn(productOrder, { managerId: "m1", title: "فني تشغيل", gradeId: "m5tech", qty: 1 });
assert.equal(levelWithManager.error, "GRADE_ORDER");

const emptyLadder = { jobGrades: [], employees: [], orgSeats: [] };
assert.equal(ensureProductLadder(emptyLadder), true);
const emptyBands = ladderBands(emptyLadder);
assert.deepEqual(emptyBands.map((band) => band.gradeNumber), ["م1", "م2", "م3", "م4", "م5", "م6", "م7"]);
assert.deepEqual(emptyBands.map((band) => band.level), [
  "تنفيذي – تشغيل",
  "تنفيذي – تخصّصي",
  "إشرافي – مشرف",
  "إشرافي – رئيس قسم",
  "إداري – مدير فرع",
  "إداري – مدير إدارة",
  "قيادي",
]);
assert.deepEqual(emptyBands.map((band) => band.head.minSalary), [4000, 6000, 8500, 11000, 15000, 21000, 32000]);
assert.deepEqual(emptyBands.map((band) => band.head.maxSalary), [6500, 9500, 13000, 17000, 24000, 34000, 60000]);
assert.deepEqual(emptyBands.map((band) => band.head.annualLeaveDays), [21, 21, 21, 25, 30, 30, 30]);
assert.equal(ensureProductLadder(emptyLadder), false);
assert.equal(emptyLadder.employees.length, 0);

const opLadder = {
  employees: [{ id: "e1", name: "أ", profile: { position: "فني كهرباء", gradeId: "r1" } }],
  orgSeats: [{ id: "s1", title: "فني كهرباء", gradeId: "r1", employeeId: "e1" }],
  jobGrades: [
    { id: "r1", gradeNumber: "OP1", title: "متدرّب", jobTitle: "فني كهرباء", titleKey: jobTitleKey("فني كهرباء"), order: 1, minSalary: null, maxSalary: null },
    { id: "r2", gradeNumber: "OP2", title: "خبير", jobTitle: "فني كهرباء", titleKey: jobTitleKey("فني كهرباء"), order: 2, minSalary: null, maxSalary: null },
  ],
};
assert.equal(ensureProductLadder(opLadder), true);
assert.equal(opLadder.employees.length, 1);
assert.equal(opLadder.employees[0].name, "أ");
assert.equal(opLadder.orgSeats.length, 1);
assert.equal(opLadder.orgSeats[0].gradeId, "r1");
assert.equal(opLadder.jobGrades.find((grade) => grade.id === "r1").gradeNumber, "م1");
assert.equal(opLadder.jobGrades.find((grade) => grade.id === "r1").title, "متدرّب");
const opBands = ladderBands(opLadder);
assert.deepEqual(opBands.map((band) => band.gradeNumber), ["م1", "م2", "م3", "م4", "م5", "م6", "م7"]);
assert.equal(opBands[0].head.minSalary, 4000);
assert.equal(opBands[0].head.annualLeaveDays, 21);
assert.equal(opBands[0].ranks[0].label, "فني كهرباء · متدرّب");
assert.equal(opBands[1].ranks[0].label, "فني كهرباء · خبير");
assert.equal(opBands[6].ranks.length, 0);
assert.equal(ensureProductLadder(opLadder), false);

const kept = { jobGrades: [{ id: "tc", gradeNumber: "TC1", title: "فني", order: 1, minSalary: 1000, maxSalary: 2000, annualLeaveDays: 21 }] };
assert.equal(ensureProductLadder(kept), false);
assert.equal(kept.jobGrades.length, 1);
assert.equal(kept.jobGrades[0].minSalary, 1000);

const trap = {
  jobGrades: [{ id: "grade_ladder_m1", ladderBand: true, listId: "ops", gradeNumber: "م1", title: "تنفيذي – تشغيل", order: 1, minSalary: 4000, maxSalary: 6500, annualLeaveDays: 21 }],
  permissionTemplates: [{ id: "ops", positions: [{ title: "سائق" }] }],
  orgSeats: [],
  employees: [],
};
assert.equal(attachSharedGradesToTitles(trap), false);
assert.equal(trap.jobGrades[0].jobTitle || "", "");
assert.equal(trap.jobGrades.length, 1);

console.log("manager seat drawer ok");
