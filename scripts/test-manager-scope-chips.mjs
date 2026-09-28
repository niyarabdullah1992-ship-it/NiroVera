import assert from "node:assert/strict";
import { buildManagerScopeModel, administeredWorkplaceStations } from "../src/lib/managerScopeChips.js";

const stations = [
  { id: "hq", name: "المقر الرئيسي", isCompanyRoot: true },
  { id: "reg", name: "منطقة الشرقية", unitKind: "manager", parentStationId: "hq" },
  { id: "khf", name: "فرع الخفجي", parentStationId: "hq" },
  { id: "dmm", name: "فرع الدمام", parentStationId: "hq" },
  { id: "port", name: "ميناء الدمام", parentStationId: "dmm" },
];
const owner = { id: "own", role: "director", stationId: "hq" };
const clerk = { id: "emp", name: "عمر", role: "employee", stationId: "khf", leaveRequests: [{ id: "lv1", status: "pending" }] };
const other = { id: "e2", name: "سارة", role: "employee", stationId: "dmm" };
const data = {
  ownerId: "own",
  stations,
  employees: [owner, clerk, other],
  disciplinaryCases: [
    { id: "c1", employeeId: "emp", stationId: "khf", status: "notice" },
    { id: "c2", employeeId: "e2", stationId: "dmm", status: "appeal" },
  ],
  expenseClaims: [
    { id: "x1", stationId: "dmm", status: "pending" },
  ],
  publicReports: [
    { id: "v1", stationId: "khf", authorId: "emp", kind: "complaint", message: "تأخر تسليم العهدة", status: "open", createdAt: new Date().toISOString() },
  ],
};

const names = administeredWorkplaceStations(owner, data).map((row) => row.name);
assert.deepEqual(names, ["المقر الرئيسي", "فرع الخفجي", "فرع الدمام"], "director chips are branches; a site under a branch stays inside that branch");
assert.equal(administeredWorkplaceStations(clerk, data).length, 0, "an employee who manages nothing has no chips");

const mine = buildManagerScopeModel({ pathname: "/app/requests", user: owner, data, scope: "all" });
assert.equal(mine.visible, false, "personal requests face hides the row");

const manage = buildManagerScopeModel({ pathname: "/app/requests/manage", user: owner, data, scope: "all" });
assert.equal(manage.visible, true);
assert.equal(manage.selected, "all");
assert.ok((manage.counts.khf?.count || 0) >= 1, "khafji pending leave is on that chip");
assert.equal(manage.counts.dmm?.count || 0, 0, "a branch with no pending request stays quiet");
assert.equal(manage.total, (manage.counts.hq?.count || 0) + (manage.counts.khf?.count || 0) + (manage.counts.dmm?.count || 0));

const focused = buildManagerScopeModel({ pathname: "/app/requests/manage", user: owner, data, scope: "khf" });
assert.equal(focused.selected, "khf");

const discipline = buildManagerScopeModel({ pathname: "/app/discipline", search: "?tab=manage", user: owner, data, scope: "all" });
assert.equal(discipline.visible, true);
assert.equal(discipline.counts.khf?.count, 1);
assert.equal(discipline.counts.khf?.tone, "warn");
assert.equal(discipline.counts.dmm?.count, 1);
assert.equal(discipline.counts.dmm?.tone, "bad", "an open objection is a bad alert");
assert.equal(discipline.total, 2);
assert.equal(discipline.tone, "bad");

const mineDiscipline = buildManagerScopeModel({ pathname: "/app/discipline", search: "?tab=mine", user: owner, data, scope: "all" });
assert.equal(mineDiscipline.visible, false);

const voice = buildManagerScopeModel({ pathname: "/app/complaints", search: "?tab=manage", user: owner, data, scope: "all" });
assert.equal(voice.counts.khf?.count, 1);
assert.equal(voice.counts.khf?.tone, "warn");
assert.equal(voice.counts.dmm?.count || 0, 0);

const money = buildManagerScopeModel({ pathname: "/app/expenses", search: "?view=manage", user: owner, data, scope: "all" });
assert.equal(money.visible, true);
assert.equal(money.counts.dmm?.count, 1);
assert.equal(money.counts.dmm?.tone, "plain");

const selfMoney = buildManagerScopeModel({ pathname: "/app/expenses", search: "?view=self", user: owner, data, scope: "all" });
assert.equal(selfMoney.visible, false);

const mgr = { id: "mgr", role: "station_manager", stationId: "khf" };
const mgrData = {
  ...data,
  employees: [...data.employees, mgr],
  stations: stations.map((row) => (row.id === "khf" ? { ...row, managerId: "mgr" } : row)),
};
const branch = buildManagerScopeModel({ pathname: "/app/requests/manage", user: mgr, data: mgrData, scope: "all" });
assert.deepEqual(branch.stations.map((row) => row.id), ["khf"], "a branch manager only sees the branch they manage");
assert.equal(branch.counts.dmm?.count || 0, 0);

const employeeFace = buildManagerScopeModel({ pathname: "/app/requests/manage", user: clerk, data, scope: "all" });
assert.equal(employeeFace.visible, false, "someone who manages nothing does not get the row");

const pinnedPersonal = buildManagerScopeModel({
  pathname: "/app/attendance",
  search: "?lane=manage",
  user: owner,
  data,
  scope: "all",
  railSide: "employee",
});
assert.equal(pinnedPersonal.visible, false, "نطاقات stays off the employee rail even when the address says manage");

const pinnedManage = buildManagerScopeModel({
  pathname: "/app/attendance",
  search: "",
  user: owner,
  data,
  scope: "all",
  railSide: "manage",
});
assert.equal(pinnedManage.visible, true, "نطاقات stays on the manage rail");
assert.equal(pinnedManage.section, "attendance");

console.log("manager scope chips ok");
