import assert from "node:assert/strict";
import { RAIL_CLUSTERS, buildSuiteRailClusters, railBadgeTone } from "../src/lib/suiteRailFrame.js";
import {
  asSuiteBadge,
  collectSuiteBadges,
  isNightDueEmployee,
  managerDutyAlertGroups,
  nightDueAdminEmployees,
  nightDueEmployeeCount,
  pendingOpsBadgeCount,
  pendingPunchQueueCount,
  pendingRequestsBadgeCount,
  pendingSigningBadgeCount,
  suiteAppBadge,
  suiteAppGlow,
} from "../src/lib/suiteBadges.js";
import { nightDueScopeEmployees, requestManageEmployees } from "../src/lib/dutyScope.js";
import { addDays, weekDateKeys, weekStartDate } from "../src/lib/shiftWeek.js";

assert.deepEqual(RAIL_CLUSTERS.map((row) => row.id), ["today", "people", "care", "setup"]);
assert.equal(RAIL_CLUSTERS.flatMap((row) => row.keys).includes("complaints"), true);
assert.equal(railBadgeTone("warn").bg, "#C9962B");
assert.equal(railBadgeTone("go").bg, "#1D9A5B");

const groups = [
  { key: "daily", label: "Daily" },
  { key: "signing", label: "Signing" },
  { key: "duty", label: "Duty" },
  { key: "requests", label: "Requests" },
  { key: "complaints", label: "Voice" },
  { key: "admin", label: "Admin" },
];
const ar = buildSuiteRailClusters(groups, "ar");
assert.equal(ar[0].label, "اليوم");
assert.deepEqual(ar[0].items.map((item) => item.key), ["daily", "signing", "duty"]);
assert.equal(ar[1].label, "الناس");
assert.equal(ar.at(-1).label, "الإعداد");

const hidden = buildSuiteRailClusters([{ key: "money", label: "Money" }], "en");
assert.equal(hidden.length, 1);
assert.equal(hidden[0].id, "care");
assert.equal(hidden[0].label, "Care");

assert.equal(asSuiteBadge(0), undefined);
assert.equal(asSuiteBadge(2), 2);

const manager = { id: "mgr", role: "station_manager", email: "mgr@nv.test", name: "مدير" };
const worker = { id: "emp1", name: "عامل", stationId: "st1", email: "emp@nv.test", leaveRequests: [{ id: "lv1", status: "pending" }], otherRequests: [{ id: "mp1", type: "manual_punch", status: "pending", date: "2026-09-15" }] };
const data = {
  ownerId: "mgr",
  stations: [{ id: "st1" }],
  employees: [manager, worker],
  tasks: [{ id: "t1", status: "awaiting_approval", stationId: "st1", completedCount: 1, targetCount: 1 }],
  signatureRequests: [{
    id: "sg1",
    fileName: "عقد.pdf",
    creatorId: "other",
    signers: [{ email: "mgr@nv.test", status: "pending", token: "tok1" }],
  }],
  workProofs: [{ id: "wp1", ref: "WP-1", afterStamp: "2026-09-15T08:00:00", raiserId: "emp1" }],
  publicReports: [{ id: "v1", status: "open", message: "صوت يحتاج مراجعة" }],
  disciplinaryCases: [{ id: "d1", employeeId: "emp1", status: "notice" }],
  expenseClaims: [{ id: "ex1", status: "submitted", amount: 120, stationId: "st1" }],
  payrollRuns: [{ month: "2026-09", status: "draft", items: [{ employeeId: "emp1", netSalary: 1 }] }],
  safety: [{ stationId: "st1", hazards: [{ id: "h1" }, { id: "h2", closedAt: "2026-09-01" }] }],
};

assert.equal(pendingRequestsBadgeCount(manager, data, data.employees), 2);
assert.equal(pendingPunchQueueCount([worker], []), 1);
assert.equal(pendingPunchQueueCount([worker], [{ employee_id: "emp1", location_status: "outside" }]), 1);
assert.equal(pendingSigningBadgeCount(data.signatureRequests, manager), 1);
assert.equal(pendingOpsBadgeCount(data.tasks, manager, data), 1);
assert.equal(pendingOpsBadgeCount([{
  id: "t-late",
  status: "active",
  dueAt: "2020-01-01",
  ownerId: "mgr",
  completedCount: 0,
  targetCount: 1,
}], manager, { ...data, ownerId: "mgr", employees: [manager] }, new Date("2026-09-15")), 1);

const empty = collectSuiteBadges({
  user: { id: "emp9", role: "employee" },
  data: { employees: [], tasks: [], signatureRequests: [] },
  employees: [],
  attendanceRows: [],
});
assert.equal(empty.byApp.requests, undefined);
assert.equal(empty.byApp.admin, undefined);
assert.equal(empty.byApp.performance, undefined);
assert.equal(empty.byApp.org, undefined);

const live = collectSuiteBadges({
  user: { ...manager, isOwner: true },
  data,
  employees: data.employees,
  attendanceRows: [{ employeeId: "emp1", location_status: "outside" }],
});
assert.equal(live.byApp.requests, 2);
assert.equal(live.byApp.attendance, 1);
assert.equal(live.byApp.signing, 1);
assert.equal(live.byApp.tasks, 1);
assert.equal(live.byApp["work-proof"], 1);
assert.equal(live.byApp.complaints, 1);
assert.equal(live.byApp.discipline, 1);
assert.equal(live.byApp.expenses, 1);
assert.equal(live.byApp.payroll, 1);
assert.equal(live.byApp.safety, 1);
assert.equal(live.byApp.settings, undefined);

assert.equal(suiteAppBadge({ id: "requests" }, live), 2);
assert.equal(suiteAppBadge({ id: "leave" }, live), 2);
assert.equal(suiteAppBadge({ id: "settings" }, live), undefined);

const groupSum = (keys) => keys.reduce((sum, key) => sum + (live.byApp[key] || 0), 0) || undefined;
assert.equal(groupSum(["requests"]), 2);
assert.equal(groupSum(["attendance", "calendar", "shifts"]), 1);
assert.equal(groupSum(["signing"]), 1);
assert.equal(groupSum(["tasks", "work-proof", "command"]), 2);
assert.equal(groupSum(["complaints"]), 1);
assert.equal(groupSum(["discipline"]), 1);
assert.equal(groupSum(["expenses", "payroll"]), 2);
assert.equal(groupSum(["safety"]), 1);
assert.equal(groupSum(["files", "assistant", "settings"]), undefined);
assert.equal(groupSum(["org", "hr"]), undefined);
assert.equal(groupSum(["performance"]), undefined);

const glowWeek = weekStartDate("2026-09-06");
const nightType = { id: "night", label: "ليلي", start: "23:00", end: "07:00", restMinutes: 30 };
const eveningType = { id: "evening", label: "مسائي", start: "15:00", end: "23:00", restMinutes: 30 };
function datedNight(employeeId, weeks) {
  const assignments = {};
  for (let w = 0; w < weeks; w += 1) {
    const start = addDays(glowWeek, -7 * w);
    for (const key of weekDateKeys(start)) {
      const wd = new Date(`${key}T00:00:00`).getDay();
      if (wd >= 0 && wd <= 4) assignments[key] = { night: [employeeId] };
    }
  }
  return assignments;
}
const nightWorker = { id: "night1", name: "ليلي", stationId: "st1", profile: {}, leaveRequests: [], otherRequests: [] };
const eveningWorker = { id: "eve1", name: "حسن", stationId: "st1", profile: {}, leaveRequests: [], otherRequests: [] };
const restWorker = { id: "rest1", name: "راحة", stationId: "st1", profile: {}, leaveRequests: [], otherRequests: [] };
const nightData = {
  ...data,
  employees: [manager, nightWorker, eveningWorker, restWorker],
  schedules: [{
    stationId: "st1",
    shiftTypes: [nightType, eveningType],
    assignments: {
      ...datedNight("night1", 14),
      ...Object.fromEntries(weekDateKeys(glowWeek).filter((key) => {
        const wd = new Date(`${key}T00:00:00`).getDay();
        return wd >= 0 && wd <= 4;
      }).map((key) => [key, { ...(datedNight("night1", 14)[key] || {}), evening: ["eve1"] }])),
    },
  }],
};
assert.equal(nightDueEmployeeCount([eveningWorker, restWorker], nightData, glowWeek), 0, "evening and rest stay off the due count");
assert.equal(nightDueEmployeeCount([nightWorker], nightData, glowWeek), 1, "13 night-worker weeks count as due");
const nightBadges = collectSuiteBadges({
  user: { ...manager, isOwner: true },
  data: nightData,
  employees: nightData.employees,
  attendanceRows: [],
  weekStart: glowWeek,
});
assert.ok((nightBadges.byApp.requests || 0) >= 1, "طلباتي increments when a visible employee is due");
assert.ok((nightBadges.byApp.attendance || 0) >= 1, "الدوام والحضور increments when a visible employee is due");
assert.equal(suiteAppGlow({ id: "requests" }, nightBadges), "due");
assert.equal(suiteAppGlow({ id: "attendance" }, nightBadges), "due");

const home = { id: "st_home", name: "الخفجي" };
const other = { id: "st_other", name: "الدمام" };
const branchMgr = {
  id: "mgr_branch",
  name: "مدير الفروع",
  role: "station_manager",
  stationId: "st_home",
  managedStationIds: ["st_other"],
  leaveRequests: [],
  otherRequests: [],
};
const morningSelf = {
  id: "niyar",
  name: "نيار عبدالله",
  role: "employee",
  stationId: "st_home",
  profile: {},
  leaveRequests: [],
  otherRequests: [],
};
const dueOnOther = {
  id: "omar_due",
  name: "عمر ناصر",
  role: "employee",
  stationId: "st_other",
  profile: {},
  leaveRequests: [],
  otherRequests: [],
};
const scopedData = {
  stations: [home, other],
  employees: [branchMgr, morningSelf, dueOnOther],
  orgSeats: [{ id: "seat_home", employeeId: "mgr_branch", stationId: "st_home", title: "مدير الفرع" }],
  schedules: [{
    stationId: "st_other",
    shiftTypes: [nightType],
    assignments: datedNight("omar_due", 14),
  }, {
    stationId: "st_home",
    shiftTypes: [{ id: "morning", label: "صباحي", start: "07:00", end: "15:00", restMinutes: 30 }],
    assignments: Object.fromEntries(weekDateKeys(glowWeek).filter((key) => {
      const wd = new Date(`${key}T00:00:00`).getDay();
      return wd >= 0 && wd <= 4;
    }).map((key) => [key, { morning: ["niyar"] }])),
  }],
};
assert.ok(requestManageEmployees(branchMgr, scopedData).some((row) => row.id === "omar_due"), "manager إدارة covers a due night worker on another managed station");
assert.ok(nightDueScopeEmployees(branchMgr, scopedData).some((row) => row.id === "omar_due"));
assert.deepEqual(nightDueAdminEmployees(branchMgr, scopedData, glowWeek).map((row) => row.id), ["omar_due"]);
const adminGroups = managerDutyAlertGroups(branchMgr, scopedData, glowWeek, true);
assert.equal(adminGroups.length, 1);
assert.equal(adminGroups[0].stationName, "الدمام");
assert.equal(adminGroups[0].people[0].name, "عمر ناصر");
assert.ok(adminGroups[0].people[0].labels.includes("دوران أو موافقة"));
assert.deepEqual(managerDutyAlertGroups(morningSelf, scopedData, glowWeek), [], "employee إدارة rail stays empty");
const mgrBadges = collectSuiteBadges({
  user: branchMgr,
  data: scopedData,
  employees: [branchMgr, morningSelf],
  attendanceRows: [],
  weekStart: glowWeek,
});
assert.ok((mgrBadges.byApp.requests || 0) >= 1, "طلباتي badge includes due people in managed stations");
assert.ok((mgrBadges.byApp.attendance || 0) >= 1, "الدوام badge includes due people in managed stations");
assert.equal(suiteAppGlow({ id: "requests" }, mgrBadges), "due");
assert.equal(suiteAppGlow({ id: "attendance" }, mgrBadges), "due");

assert.deepEqual(nightDueScopeEmployees(morningSelf, scopedData).map((row) => row.id), ["niyar"], "employee night-due scope is self only");
assert.deepEqual(nightDueAdminEmployees(morningSelf, scopedData, glowWeek), [], "employee has no إدارة due list");
assert.equal(isNightDueEmployee(morningSelf, scopedData, glowWeek), false);
const selfBadges = collectSuiteBadges({
  user: morningSelf,
  data: scopedData,
  employees: scopedData.employees,
  attendanceRows: [],
  weekStart: glowWeek,
});
assert.equal(selfBadges.byApp.requests, undefined, "morning employee does not inherit a coworker night-due pill");
assert.equal(suiteAppGlow({ id: "requests" }, selfBadges), undefined);
assert.equal(suiteAppGlow({ id: "attendance" }, selfBadges), undefined);

const khafjiPending = {
  id: "noura",
  name: "نورة القحطاني",
  stationId: "st_home",
  leaveRequests: [{ id: "lv-home", status: "pending", type: "annual" }],
  otherRequests: [],
};
const rabighPending = {
  id: "fahd_rbg",
  name: "فهد",
  stationId: "st_other",
  leaveRequests: [{ id: "lv-other", status: "pending", type: "annual" }],
  otherRequests: [],
};
const multiBadgeData = {
  ...scopedData,
  employees: [branchMgr, khafjiPending, rabighPending],
};
assert.equal(
  pendingRequestsBadgeCount(branchMgr, multiBadgeData, [branchMgr, khafjiPending]),
  pendingRequestsBadgeCount(branchMgr, multiBadgeData, multiBadgeData.employees),
  "nav badge ignores the header-scoped employee list",
);
assert.equal(pendingRequestsBadgeCount(branchMgr, multiBadgeData, [branchMgr, khafjiPending]), 2);

console.log("suite rail ok");
