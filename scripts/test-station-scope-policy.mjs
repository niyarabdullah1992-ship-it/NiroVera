import assert from "node:assert/strict";
import { suiteAppForPath } from "../src/lib/suiteApps.js";
import {
  fallbackStationId,
  headerAllowsAllStations,
  managerScopeSection,
  matchesExactStation,
  pageLocksToOwnWorkplace,
  resolvePageStationScope,
} from "../src/lib/stationScopePolicy.js";
import { requestInboxEmployees, requestNoticeAudience } from "../src/lib/dutyScope.js";

assert.equal(suiteAppForPath("/app")?.id, "command");
assert.equal(suiteAppForPath("/app/attendance")?.group, "duty");
assert.equal(suiteAppForPath("/app/attendance/shifts")?.id, "shifts");
assert.equal(suiteAppForPath("/app/safety")?.group, "compliance");
assert.equal(suiteAppForPath("/app/payroll")?.group, "money");
assert.equal(suiteAppForPath("/app/assets")?.group, "money");
assert.equal(suiteAppForPath("/app/inventory")?.id, "inventory");
assert.equal(suiteAppForPath("/app/requests/manage")?.group, "requests");

assert.equal(headerAllowsAllStations("/app"), true);
assert.equal(headerAllowsAllStations("/app/inventory"), true);
assert.equal(headerAllowsAllStations("/app/inventory/stock"), true);
assert.equal(headerAllowsAllStations("/app/org"), true);
assert.equal(headerAllowsAllStations("/app/attendance"), false);
assert.equal(headerAllowsAllStations("/app/calendar"), false);
assert.equal(headerAllowsAllStations("/app/shifts"), false);
assert.equal(headerAllowsAllStations("/app/safety"), false);
assert.equal(headerAllowsAllStations("/app/payroll"), false);
assert.equal(headerAllowsAllStations("/app/expenses"), false);
assert.equal(headerAllowsAllStations("/app/assets"), false);
assert.equal(headerAllowsAllStations("/app/requests"), false);
assert.equal(headerAllowsAllStations("/app/complaints"), false);
assert.equal(headerAllowsAllStations("/app/discipline"), false);

const hq = { id: "hq", name: "NiroVera", isCompanyRoot: true };
const khf = { id: "khf", name: "الخفجي" };
const stations = [hq, khf];
const owner = { id: "niyar", role: "director", stationId: "hq" };
const clerk = { id: "emp", role: "employee", stationId: "khf" };

assert.equal(fallbackStationId({ employee: owner, stations }), "hq");
assert.equal(fallbackStationId({ employee: clerk, stations }), "khf");

assert.equal(pageLocksToOwnWorkplace({ pathname: "/app/attendance", employee: clerk, data: { ownerId: "niyar" } }), true);
assert.equal(pageLocksToOwnWorkplace({ pathname: "/app/attendance", employee: owner, data: { ownerId: "niyar" } }), false);
assert.equal(pageLocksToOwnWorkplace({ pathname: "/app/inventory", employee: clerk, data: { ownerId: "niyar" } }), false);

assert.equal(resolvePageStationScope({
  pathname: "/app/inventory",
  headerScope: "all",
  employee: owner,
  stations,
}), "all");

assert.equal(resolvePageStationScope({
  pathname: "/app/attendance",
  headerScope: "all",
  employee: owner,
  stations,
}), "hq");

assert.equal(resolvePageStationScope({
  pathname: "/app/payroll",
  headerScope: "all",
  employee: clerk,
  stations,
}), "khf");

assert.equal(resolvePageStationScope({
  pathname: "/app/safety",
  headerScope: "khf",
  employee: owner,
  stations,
}), "khf");

assert.equal(resolvePageStationScope({
  pathname: "/app/assets",
  headerScope: "all",
  employee: owner,
  stations,
}), "all", "money manage face: كل نطاق clears the station filter");

assert.equal(resolvePageStationScope({
  pathname: "/app/assets",
  search: "?view=self",
  headerScope: "all",
  employee: owner,
  stations,
}), "hq", "personal money face stays on one workplace");

assert.equal(managerScopeSection("/app/requests/manage"), "requests");
assert.equal(managerScopeSection("/app/requests"), "");
assert.equal(managerScopeSection("/app/discipline", "?tab=manage"), "discipline");
assert.equal(managerScopeSection("/app/discipline", "?tab=mine"), "");
assert.equal(managerScopeSection("/app/attendance", "?lane=manage"), "attendance");
assert.equal(managerScopeSection("/app/attendance"), "");
assert.equal(managerScopeSection("/app/performance", "?view=self"), "");
assert.equal(managerScopeSection("/app/attendance", "?lane=manage", "employee"), "", "الموظف hides scopes even if the address still says manage");
assert.equal(managerScopeSection("/app/attendance", "", "manage"), "attendance", "الإدارة shows scopes before the address catches up");
assert.equal(managerScopeSection("/app/requests", "", "manage"), "requests");
assert.equal(managerScopeSection("/app/discipline", "?tab=manage", "employee"), "");
assert.equal(resolvePageStationScope({
  pathname: "/app/requests/manage",
  headerScope: "all",
  employee: owner,
  stations,
}), "all");
assert.equal(resolvePageStationScope({
  pathname: "/app/attendance",
  search: "?lane=manage",
  headerScope: "all",
  employee: owner,
  stations,
}), "all");

assert.equal(matchesExactStation("khf", "all"), true);
assert.equal(matchesExactStation("khf", "khf"), true);
assert.equal(matchesExactStation("hq", "khf"), false);
assert.equal(matchesExactStation("", "khf"), false);

const nora = { id: "nora", name: "نورة", role: "employee", stationId: "khf", leaveRequests: [{ id: "lv1", status: "pending" }] };
const rabighClerk = { id: "fahd", name: "فهد", role: "employee", stationId: "rbg", leaveRequests: [{ id: "lv2", status: "pending" }] };
const multiMgr = {
  id: "mgr2",
  role: "station_manager",
  stationId: "khf",
  managedStations: ["rbg"],
};
const decideData = {
  stations: [
    { id: "hq", name: "NiroVera", isCompanyRoot: true },
    { id: "khf", name: "الخفجي", managerId: "mgr2" },
    { id: "rbg", name: "رابغ", managerId: "mgr2" },
  ],
  employees: [multiMgr, nora, rabighClerk],
  orgSeats: [{ id: "seat", employeeId: "mgr2", stationId: "khf", title: "مدير الفرع" }],
};

assert.equal(
  resolvePageStationScope({
    pathname: "/app/requests/manage",
    headerScope: "khf",
    employee: multiMgr,
    stations: decideData.stations,
  }),
  "khf",
  "header on طلباتي still parks on one workplace",
);
assert.ok(requestInboxEmployees(multiMgr, decideData).some((row) => row.id === "nora"));
assert.ok(requestInboxEmployees(multiMgr, decideData).some((row) => row.id === "fahd"), "decide-scope keeps the other branch when the header is on A");
assert.ok(!requestInboxEmployees(nora, decideData).some((row) => row.id === "fahd"), "employee decide-scope cannot list another branch");
assert.ok(requestNoticeAudience(decideData, rabighClerk).some((row) => row.id === "mgr2"));
assert.ok(!requestNoticeAudience(decideData, nora).some((row) => row.id === "fahd"));

console.log("station scope policy ok");
