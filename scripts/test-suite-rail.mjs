import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RAIL_SIDE_COLOR, RAIL_SIDES, activeSuiteRailKey, buildSuiteRailClusters, railBadgeTone, railFooter } from "../src/lib/suiteRailFrame.js";
import { railFaceHref, railLaneTabs } from "../src/lib/railSide.js";
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

assert.deepEqual(RAIL_SIDES.map((row) => row.id), ["employee", "manage"]);
assert.deepEqual(RAIL_SIDES.map((row) => row.ar), ["الموظف", "الإدارة"]);
assert.equal(RAIL_SIDES.some((row) => row.ar === "لوحة المالك"), false);
assert.equal(RAIL_SIDES.some((row) => row.ar === "المؤسسة"), false);
assert.equal(RAIL_SIDES.some((row) => row.ar === "ملفي"), false);
assert.equal(RAIL_SIDE_COLOR.employee, "#C8A45A");
assert.equal(RAIL_SIDE_COLOR.manage, "#3C7D50");
const railSrc = readFileSync(new URL("../src/components/navigation/SuiteRail.jsx", import.meta.url), "utf8");
assert.equal(railSrc.includes("أعرض اللوحة"), false, "the admin rail has no person switcher");
assert.equal(railSrc.includes("لوحة المالك"), false);
assert.equal(railFaceHref("/app/attendance", "?lane=manage&tab=team", "employee"), "/app/attendance");
assert.equal(railFaceHref("/app/attendance", "", "manage"), "/app/attendance?lane=manage&tab=team");
assert.equal(railFaceHref("/app/requests/manage", "", "employee"), "/app/requests");
assert.equal(railFaceHref("/app/requests", "", "manage"), "/app/requests/manage");
assert.equal(railFaceHref("/app/discipline", "?tab=manage", "employee"), "/app/discipline?tab=mine");
assert.equal(railFaceHref("/app/complaints", "?tab=mine", "manage"), "/app/complaints?tab=manage");
assert.equal(railFaceHref("/app/performance", "?view=manage", "employee"), "/app/performance?view=self");
assert.equal(railFaceHref("/app/payroll", "?view=manage", "employee"), "/app/payroll?view=self");
assert.deepEqual(railLaneTabs([{ key: "mine" }, { key: "manage" }, { key: "law" }], "employee").map((row) => row.key), ["mine", "law"]);
assert.deepEqual(railLaneTabs([{ key: "mine" }, { key: "manage" }], "manage").map((row) => row.key), ["manage"]);
assert.equal(railBadgeTone("warn").bg, "#C8A45A");
assert.equal(railBadgeTone("go").bg, "#3C7D50");

function railGroup(key, extra = {}) {
  const to = extra.to || (key === "decide" ? "/app" : `/app/${key}`);
  return {
    key,
    label: key,
    to,
    badge: extra.badge,
    badgeKind: extra.badgeKind,
    glow: extra.glow,
    items: extra.items || [{ appId: key === "duty" ? "attendance" : key === "people" ? "org" : key === "workforce" ? "hr" : key === "daily" ? "tasks" : key === "compliance" ? "safety" : key === "admin" ? "files" : key, to }],
  };
}

const catalog = [
  railGroup("decide", { to: "/app" }),
  railGroup("duty", {
    to: "/app/attendance",
    items: [
      { appId: "attendance", to: "/app/attendance" },
      { appId: "shifts", to: "/app/shifts" },
      { appId: "calendar", to: "/app/calendar" },
    ],
  }),
  railGroup("requests", { to: "/app/requests" }),
  railGroup("discipline", { to: "/app/discipline" }),
  railGroup("complaints", { to: "/app/complaints", badge: 3, badgeKind: "warn" }),
  railGroup("people", { to: "/app/org" }),
  railGroup("workforce", { to: "/app/hr" }),
  railGroup("money", {
    to: "/app/payroll",
    badge: 2,
    items: [
      { appId: "payroll", to: "/app/payroll" },
      { appId: "expenses", to: "/app/expenses" },
      { appId: "assets", to: "/app/assets" },
      { appId: "inventory", to: "/app/inventory" },
    ],
  }),
  railGroup("daily", {
    to: "/app/tasks",
    items: [
      { appId: "tasks", to: "/app/tasks" },
      { appId: "work-proof", to: "/app/work-proof" },
      { appId: "visitor-proof", to: "/app/visitor-proof" },
    ],
  }),
  railGroup("signing", { to: "/app/signing" }),
  railGroup("performance", { to: "/app/performance" }),
  railGroup("compliance", { to: "/app/safety" }),
  railGroup("admin", {
    to: "/app/files",
    items: [
      { appId: "files", to: "/app/files" },
      { appId: "assistant", to: "/app/assistant" },
      { appId: "settings", to: "/app/settings" },
    ],
  }),
];

function sideItems(side) {
  return (side?.groups || []).flatMap((group) => group.items || []);
}

const director = { id: "d1", role: "director", name: "نيار الشهري", profile: { position: "مدير الموارد البشرية" } };
const company = { ownerId: "d1", employees: [director], stations: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] };
const managed = buildSuiteRailClusters(catalog, "ar", { user: director, data: company });
const employeeSide = managed.find((row) => row.id === "employee");
const manageSide = managed.find((row) => row.id === "manage");
assert.deepEqual(managed.map((row) => row.id), ["employee", "manage"]);
assert.equal(employeeSide.label, "الموظف");
assert.equal(manageSide.label, "الإدارة");
assert.equal(employeeSide.subtitle, "ما يخصّك: بصمتك ومهامك وطلباتك وتوقيعاتك.");
assert.equal(manageSide.subtitle, "التشغيل والقرار والامتثال لكل الفروع.");
assert.deepEqual(
  employeeSide.groups.map((group) => ({ label: group.label, items: group.items.map((item) => item.label) })),
  [
    { label: "مساحتي", items: ["ملفي", "الهيكل التنظيمي", "بصمتي", "توقيعاتي", "أدائي"] },
    { label: "التشغيل اليومي", items: ["التشغيل اليومي"] },
    { label: "الطلبات والعلاقات", items: ["طلباتي", "الجزاءات", "صوت الموظف"] },
    { label: "سلامتي", items: ["بلاغ سلامة"] },
  ],
);
assert.deepEqual(
  manageSide.groups.map((group) => ({ label: group.label, items: group.items.map((item) => item.label) })),
  [
    { label: "القرار", items: ["نظرة عامة", "لوحة القيادة", "الحضور والدوام"] },
    { label: "الطلبات والعلاقات", items: ["الطلبات", "الجزاءات", "صوت الموظف"] },
    { label: "الناس والامتثال", items: ["المحطات التي أديرها", "القوى العاملة", "الامتثال الوزاري", "المال والأصول"] },
    { label: "التشغيل اليومي", items: ["التشغيل اليومي"] },
    { label: "مشتركة", items: ["التوقيع الرقمي", "الأداء", "السلامة HSE", "الملفات والمساعد"] },
  ],
);
assert.equal(sideItems(employeeSide).find((item) => item.section === "file").to, "/app/employees/d1");
assert.equal(sideItems(manageSide).find((item) => item.section === "overview").to, "/app?face=map");
assert.equal(sideItems(manageSide).find((item) => item.section === "decide").to, "/app");
assert.equal(sideItems(manageSide).find((item) => item.section === "duty").to, "/app/attendance?lane=manage");
assert.equal(sideItems(manageSide).find((item) => item.section === "requests").to, "/app/requests/manage");
assert.equal(sideItems(manageSide).find((item) => item.section === "discipline").to, "/app/discipline?tab=manage");
assert.equal(sideItems(manageSide).find((item) => item.section === "complaints").to, "/app/complaints?tab=manage");
assert.equal(sideItems(manageSide).find((item) => item.section === "people").to, "/app/org?view=admin");
assert.equal(sideItems(manageSide).find((item) => item.section === "money").to, "/app/payroll?view=manage");
assert.equal(sideItems(manageSide).find((item) => item.section === "complaints").badge, 3);
assert.equal(sideItems(manageSide).find((item) => item.section === "complaints").badgeKind, "warn");
assert.equal(sideItems(employeeSide).find((item) => item.section === "duty").label, "بصمتي");
assert.equal(sideItems(employeeSide).find((item) => item.section === "duty").to, "/app/attendance");
assert.equal(sideItems(employeeSide).find((item) => item.section === "requests").label, "طلباتي");
assert.equal(sideItems(employeeSide).find((item) => item.section === "requests").to, "/app/requests");
assert.equal(sideItems(employeeSide).find((item) => item.section === "daily").to, "/app/tasks");
assert.equal(sideItems(manageSide).find((item) => item.section === "daily").to, "/app/tasks?lane=manage");
assert.equal(sideItems(employeeSide).find((item) => item.section === "org").to, "/app/org?view=employee");
assert.equal(sideItems(manageSide).find((item) => item.section === "ministry").to, "/app/hr?tab=compliance");
assert.equal(sideItems(manageSide).find((item) => item.section === "signing").to, "/app/signing?lane=manage");
assert.equal(sideItems(manageSide).find((item) => item.section === "hse").to, "/app/safety?lane=manage");
assert.equal(sideItems(manageSide).find((item) => item.section === "files").to, "/app/files");
assert.equal(sideItems(employeeSide).find((item) => item.section === "performance").label, "أدائي");
assert.equal(sideItems(employeeSide).find((item) => item.section === "performance").to, "/app/performance?view=self");
assert.equal(sideItems(manageSide).find((item) => item.section === "performance").label, "الأداء");
assert.equal(sideItems(manageSide).find((item) => item.section === "performance").to, "/app/performance?view=manage");
assert.equal(sideItems(employeeSide).some((item) => String(item.to).includes("view=manage")), false);
assert.equal(sideItems(manageSide).some((item) => item.label === "أدائي"), false);
assert.equal(sideItems(employeeSide).find((item) => item.section === "complaints").badge, undefined, "manager queue count stays on الإدارة");
assert.equal(sideItems(employeeSide).some((item) => item.section === "decide"), false, "the decision glance stays on الإدارة");
assert.equal(sideItems(employeeSide).some((item) => item.section === "workforce"), false);
assert.equal(sideItems(employeeSide).some((item) => item.section === "people"), false);
assert.equal(sideItems(manageSide).some((item) => item.section === "file"), false, "the employee file stays on الموظف");
assert.equal(sideItems(employeeSide).some((item) => item.section === "tasks"), false);
assert.equal(sideItems(manageSide).some((item) => item.section === "compliance"), false);
const destinations = managed.flatMap((side) => sideItems(side).map((item) => item.to));
assert.equal(new Set(destinations).size, destinations.length, "the same destination is not listed twice");
assert.equal(destinations.includes("/app/settings"), false, "settings stay off the audience rail");
assert.equal(managed.some((side) => side.label === "لوحة المالك"), false);
assert.equal(sideItems(employeeSide).some((item) => item.lane === "manage"), false);
assert.equal(sideItems(manageSide).some((item) => item.lane === "employee"), false);

const employee = { id: "e1", role: "employee", name: "عمر ناصر العتيبي", stationId: "khafji", profile: { position: "فني صيانة" } };
const employeeRail = buildSuiteRailClusters(catalog, "ar", { user: employee, data: { ownerId: "other", employees: [employee], stations: [{ id: "khafji", name: "الخفجي" }] } });
assert.deepEqual(employeeRail.map((row) => row.id), ["employee"], "no الإدارة tab when the viewer manages nothing");
assert.equal(employeeRail[0].label, "الموظف");
assert.equal(sideItems(employeeRail[0]).some((item) => item.section === "decide"), false);
assert.equal(sideItems(employeeRail[0]).some((item) => item.lane === "manage"), false);
assert.equal(sideItems(employeeRail[0]).find((item) => item.section === "file").to, "/app/employees/e1");
assert.equal(sideItems(employeeRail[0]).find((item) => item.section === "performance").to, "/app/performance?view=self");
assert.equal(sideItems(employeeRail[0]).some((item) => item.section === "performance" && item.lane === "manage"), false);
const employeeCard = railFooter(employee, { employees: [employee], stations: [{ id: "khafji", name: "الخفجي" }] }, "ar", "employee");
assert.equal(employeeCard.name, "عمر ناصر العتيبي");
assert.equal(employeeCard.line, "فني صيانة · فرع الخفجي");
assert.equal(employeeCard.initials, "ع.ن");
const managerCard = railFooter(director, company, "ar", "manage");
assert.equal(managerCard.name, "نيار الشهري");
assert.equal(managerCard.line, "مدير الموارد البشرية · 4 فروع");

const stationManager = { id: "s1", role: "station_manager", stationId: "st1" };
const partial = buildSuiteRailClusters(
  catalog.filter((group) => ["decide", "duty", "requests", "money", "daily"].includes(group.key)),
  "ar",
  { user: stationManager, data: { ownerId: "other" } },
);
const partialManage = sideItems(partial.find((side) => side.id === "manage")).map((item) => item.section);
assert.ok(partialManage.includes("overview"));
assert.ok(partialManage.includes("decide"));
assert.ok(partialManage.includes("duty"));
assert.ok(partialManage.includes("requests"));
assert.ok(partialManage.includes("money"));
assert.equal(partialManage.includes("tasks"), false);
assert.equal(partialManage.includes("workforce"), false);
assert.equal(partialManage.includes("people"), false);
assert.match(sideItems(partial.find((side) => side.id === "manage")).find((item) => item.section === "money").to, /^\/app\/expenses\?view=manage$/);

const leaveClerk = { id: "h1", role: "employee", hrLevelId: "lv1" };
const leaveRail = buildSuiteRailClusters(catalog, "ar", {
  user: leaveClerk,
  data: { ownerId: "other", hrLevels: [{ id: "lv1", active: true, permissions: ["manage_leave"] }] },
});
const leaveManage = sideItems(leaveRail.find((side) => side.id === "manage")).map((item) => item.section);
assert.deepEqual(leaveManage, ["duty", "requests", "discipline"], "manage_leave opens attendance and requests; an HR level also opens discipline");
assert.equal(sideItems(leaveRail.find((side) => side.id === "manage")).find((item) => item.section === "duty").to, "/app/shifts?lane=manage");
assert.equal(sideItems(leaveRail.find((side) => side.id === "employee")).some((item) => item.section === "decide"), false);
assert.equal(sideItems(leaveRail.find((side) => side.id === "manage")).some((item) => item.section === "decide"), false);

const reader = buildSuiteRailClusters(
  [railGroup("people", { to: "/app/org" }), railGroup("workforce", { to: "/app/hr" })],
  "en",
  { user: { id: "hr1", role: "employee", hrLevelId: "view1" }, data: { ownerId: "other", hrLevels: [{ id: "view1", active: true, permissions: ["view_employees"] }] } },
);
assert.deepEqual(reader.map((row) => row.id), ["employee"]);
assert.deepEqual(sideItems(reader[0]).map((item) => item.to), ["/app/employees/hr1", "/app/org?view=employee"]);
assert.equal(sideItems(reader[0]).some((item) => item.section === "people" || item.section === "workforce"), false);

const grantedPerf = buildSuiteRailClusters(
  [railGroup("performance", { to: "/app/performance" })],
  "ar",
  { user: { id: "g1", role: "employee" }, data: { ownerId: "other", smartPositions: [{ employeeId: "g1", permissions: { performance: "manage" } }] } },
);
assert.equal(sideItems(grantedPerf.find((side) => side.id === "manage")).find((item) => item.section === "performance").to, "/app/performance?view=manage");
assert.equal(sideItems(grantedPerf.find((side) => side.id === "employee")).find((item) => item.section === "performance").to, "/app/performance?view=self");
const viewedPerf = buildSuiteRailClusters(
  [railGroup("performance", { to: "/app/performance" })],
  "ar",
  { user: { id: "d1", role: "director" }, data: { ownerId: "other", smartPositions: [{ employeeId: "d1", permissions: { performance: "view" } }] } },
);
assert.equal(viewedPerf.some((side) => side.id === "manage"), false);
assert.equal(sideItems(viewedPerf[0]).find((item) => item.section === "performance").to, "/app/performance?view=self");

assert.equal(activeSuiteRailKey(managed, "people", "/app/org", ""), "people:manage");
assert.equal(activeSuiteRailKey(managed, "people", "/app/org", "?view=employee"), "org:employee");
assert.equal(activeSuiteRailKey(managed, "performance", "/app/performance", "?view=self"), "performance:employee");
assert.equal(activeSuiteRailKey(managed, "performance", "/app/performance", "?view=manage"), "performance:manage");
assert.equal(activeSuiteRailKey(managed, "performance", "/app/performance", ""), "performance:manage");
assert.equal(activeSuiteRailKey(employeeRail, "performance", "/app/performance", ""), "performance:employee");
assert.equal(activeSuiteRailKey(employeeRail, "performance", "/app/performance", "?view=manage"), "performance:employee");
assert.equal(activeSuiteRailKey(managed, "money", "/app/payroll", ""), "money:manage");
assert.equal(activeSuiteRailKey(managed, "money", "/app/payroll", "?view=self"), "money:manage");
assert.equal(activeSuiteRailKey(employeeRail, "money", "/app/payroll", ""), "");
assert.equal(activeSuiteRailKey(managed, "duty", "/app/attendance", ""), "duty:employee");
assert.equal(activeSuiteRailKey(managed, "duty", "/app/attendance", "?lane=manage"), "duty:manage");
assert.equal(activeSuiteRailKey(managed, "requests", "/app/requests/manage", ""), "requests:manage");
assert.equal(activeSuiteRailKey(employeeRail, "decide", "/app", ""), "");
assert.equal(activeSuiteRailKey(managed, "decide", "/app", ""), "decide:manage");
assert.equal(activeSuiteRailKey(managed, "decide", "/app", "?face=map"), "overview:manage");
assert.equal(activeSuiteRailKey(managed, "daily", "/app/work-proof", ""), "daily:employee");
assert.equal(activeSuiteRailKey(managed, "file", "/app/employees/d1", ""), "file:employee");

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
