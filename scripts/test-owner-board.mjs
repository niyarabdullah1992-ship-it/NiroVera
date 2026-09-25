import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ordinaryDayCap } from "../src/lib/laborHoursPolicy.js";
import { isRamadanDay, ruleValue } from "../src/lib/laborRules.js";
import {
  canEditOwnerBoard,
  canOpenOwnerBoard,
  companySubscriptionRow,
  dashboardSubscription,
  OWNER_BOARD_SECTIONS,
  ownerBoardGate,
  ownerBoardSections,
  persistHolidayRulings,
  persistRamadanRuling,
  persistSubscriptionPlans,
  ramadanHoursRuling,
  resolveOwnerBoardActor,
  subscriptionStatus,
} from "../src/lib/ownerBoard.js";
import {
  checkWeekPublishGates,
  leaveOnDayView,
  ramadanUsesDailySixCap,
  weekStartDate,
} from "../src/lib/shiftWeek.js";
import { leaveCatalogFor } from "../src/lib/employeeFileView.js";
import { leaveTypeLabel } from "../src/lib/leaveTypes.js";
import {
  laborCalendarOf,
  officialHolidayList,
  officialHolidayOn,
  setPlatformOwnerBoardForTest,
} from "../src/lib/ummAlQuraCalendar.js";

setPlatformOwnerBoardForTest(null);

const head = { ownerId: "own", employees: [{ id: "own", role: "director", name: "رأس المنشأة" }, { id: "sm", role: "station_manager", name: "مدير فرع" }] };
assert.equal(canEditOwnerBoard({ id: "own", role: "director" }, head), true);
assert.equal(canEditOwnerBoard({ id: "sm", role: "station_manager" }, head), false);
assert.equal(canOpenOwnerBoard({ role: "admin", platformOwner: true }), true);
assert.equal(canOpenOwnerBoard({ id: "own", role: "director" }), false);
assert.equal(canOpenOwnerBoard({ id: "sm", role: "station_manager" }), false);
assert.equal(canOpenOwnerBoard({ role: "owner" }), false);
assert.equal(canOpenOwnerBoard({ localPreviewOwner: true }), true);
assert.equal(canOpenOwnerBoard({ id: "emp_owner_preview", role: "director" }), true);
assert.equal(canOpenOwnerBoard({ email: "preview@nirovera.local" }), true);
assert.equal(ownerBoardGate({ id: "sm", role: "station_manager" }).error, "OWNER_BOARD");
assert.equal(ownerBoardGate({ id: "own", role: "director" }).error, "OWNER_BOARD");
assert.equal(resolveOwnerBoardActor(null, { localPreview: true }), null);
assert.equal(resolveOwnerBoardActor(null, { localPreview: true, sessionUserId: "emp_owner_preview" })?.platformOwner, true);
assert.equal(resolveOwnerBoardActor({ role: "director" }, { localPreview: false }), null);
assert.equal(ownerBoardGate(resolveOwnerBoardActor(null, { localPreview: true, sessionUserId: "emp_owner_preview" })).ok, true);

const savedPlans = persistSubscriptionPlans([
  { slug: "enterprise", nameAr: "القيادة", nameEn: "Command", monthlyPrice: 310, yearlyPrice: 3100 },
]);
assert.equal(savedPlans.ok, true);
const data = { settings: { ownerBoard: { plans: savedPlans.plans } } };
// Derivation for gates/billing on /owner — company Dashboard no longer renders this chip.
const view = dashboardSubscription({ plan: "enterprise" }, data);
assert.equal(view.ok, true);
assert.equal(view.nameAr, "القيادة");
assert.equal(view.nameEn, "Command");
assert.equal(view.monthlyPrice, 310);
const untouched = dashboardSubscription({ plan: "Starter" }, data);
assert.equal(untouched.nameAr, "البداية");
assert.equal(untouched.monthlyPrice, 49);
const before = dashboardSubscription({ plan: "enterprise" }, {});
assert.equal(before.nameAr, "المؤسسات");
assert.equal(before.monthlyPrice, 249);
const otherCompany = dashboardSubscription({ plan: "enterprise" }, { settings: {} });
assert.equal(otherCompany.nameAr, "المؤسسات");
assert.equal(otherCompany.monthlyPrice, 249);
const listed = companySubscriptionRow(
  { id: "c1", name: "الأولى", plan: "enterprise", subscriptionEnd: "2026-12-31", subscriptionExempt: false },
  data,
  "2026-09-21",
);
assert.equal(listed.view.nameAr, "القيادة");
assert.equal(listed.view.monthlyPrice, 310);
assert.equal(listed.status.id, "active");
assert.equal(subscriptionStatus({ frozen: true }, "2026-09-21").id, "frozen");
assert.equal(subscriptionStatus({ subscriptionEnd: "2026-01-01" }, "2026-09-21").id, "ended");
assert.equal(persistSubscriptionPlans([{ slug: "starter", nameAr: "", nameEn: "Starter", monthlyPrice: 10, yearlyPrice: 100 }]).error, "PLAN_NAME");
assert.equal(persistSubscriptionPlans([{ slug: "starter", nameAr: "البداية", nameEn: "Starter", monthlyPrice: -1, yearlyPrice: 100 }]).error, "PLAN_PRICE");

const holidays = persistHolidayRulings([
  { id: "national", nameAr: "إجازة الوطن", nameEn: "Homeland leave", month: 9, day: 24 },
  { id: "founding", nameAr: "إجازة يوم التأسيس", nameEn: "Founding Day leave", month: 2, day: 22 },
]);
assert.equal(holidays.ok, true);
const calendar = { ownerHolidays: holidays.holidays };
const list = officialHolidayList("2026-01-01", calendar);
const national = list.find((row) => row.id === "national");
assert.equal(national.from, "2026-09-24");
assert.equal(national.ar, "إجازة الوطن");
assert.equal(officialHolidayOn("2026-09-23", calendar), null);
assert.equal(officialHolidayOn("2026-09-24", calendar)?.id, "national");
assert.equal(officialHolidayOn("2026-02-22", calendar)?.id, "founding");
assert.equal(officialHolidayOn("2025-06-05", calendar)?.id, "adha");
assert.equal(list.find((row) => row.id === "fitr")?.ar, "إجازة عيد الفطر");
assert.equal(leaveTypeLabel("eid", true, undefined, "2026-09-24", calendar), "الوطن");
const catalog = leaveCatalogFor({}, true, calendar, "2026-01-01");
const names = catalog.flatMap((group) => group.rows.map((row) => row.name));
assert.ok(names.includes("إجازة الوطن"), names.join(" | "));
assert.equal(persistHolidayRulings([{ id: "national", nameAr: "إجازة", nameEn: "Leave", month: 2, day: 31 }]).error, "HOLIDAY_DATE");
const ministry = officialHolidayList("2026-01-01");
assert.match(ministry.find((row) => row.id === "national")?.noteAr || "", /23 سبتمبر/);
assert.equal(officialHolidayOn("2026-09-23")?.id, "national");

const missing = persistRamadanRuling({ year: 2026, from: "", to: "" });
assert.equal(missing.error, "RAMADAN_DATE");
const badSpan = persistRamadanRuling({ year: 2026, from: "2026-03-01", to: "2026-03-10" });
assert.equal(badSpan.error, "RAMADAN_LENGTH");
const ruled = persistRamadanRuling({ year: 2026, from: "2026-03-01", to: "2026-03-29" });
assert.equal(ruled.ok, true);
assert.equal(ruled.length, 29);
const ramadanCal = { 2026: { ownerRamadanFrom: ruled.from, ownerRamadanTo: ruled.to } };
assert.equal(isRamadanDay("2026-02-18", ramadanCal), false);
assert.equal(isRamadanDay("2026-03-01", ramadanCal), true);
assert.equal(isRamadanDay("2026-03-29", ramadanCal), true);
assert.equal(isRamadanDay("2026-03-30", ramadanCal), false);
const employee = { id: "e" };
assert.equal(ordinaryDayCap(employee, {}, "2026-03-01", ramadanCal), ruleValue("hours.ramadan.ordinaryHours", "2026-03-01"));
assert.equal(ordinaryDayCap(employee, {}, "2026-03-01", ramadanCal), 6);
assert.equal(ordinaryDayCap(employee, {}, "2026-02-18", ramadanCal), 8);
assert.equal(ramadanHoursRuling(ramadanCal, "2026-03-01", employee).dailyCap, 6);
assert.equal(ramadanHoursRuling(ramadanCal, "2026-03-01", employee).stayCap, 12);
assert.equal(ramadanUsesDailySixCap({ start: "07:00", end: "19:00" }, "2026-03-01", employee), false);
assert.equal(ramadanUsesDailySixCap({ start: "08:00", end: "16:00" }, "2026-03-01", employee), true);
assert.equal(isRamadanDay("2026-02-17", { 2026: { ramadanStartShift: 0 } }), false);

// Platform holiday ruling feeds laborCalendarOf for every company.
setPlatformOwnerBoardForTest({
  holidays: {
    national: { overridden: true, nameAr: "إجازة الوطن", nameEn: "Homeland leave", month: 9, day: 24 },
    founding: { overridden: true, nameAr: "إجازة يوم التأسيس", nameEn: "Founding Day leave", month: 2, day: 22 },
  },
});
const platformCal = laborCalendarOf({ settings: {} });
assert.equal(officialHolidayOn("2026-09-23", platformCal), null);
assert.equal(officialHolidayOn("2026-09-24", platformCal)?.id, "national");
assert.equal(leaveOnDayView({ id: "e", leaveRequests: [] }, "2026-09-24", true, platformCal)?.type, "إجازة الوطن");
assert.equal(leaveOnDayView({ id: "e", leaveRequests: [] }, "2026-02-22", true, platformCal)?.type, "إجازة يوم التأسيس");
const rosterHoliday = checkWeekPublishGates({
  schedule: {
    stationId: "st",
    shiftTypes: [{ id: "night", label: "ليلي", start: "23:00", end: "07:00", restMinutes: 30 }],
    assignments: { "2026-09-24": { night: ["e1"] } },
  },
  employees: [{ id: "e1", name: "نيار", stationId: "st", profile: {}, leaveRequests: [] }],
  weekStart: weekStartDate("2026-09-24"),
  stationId: "st",
  laborCalendar: platformCal,
  ar: true,
});
assert.equal(rosterHoliday.checks.find((c) => c.id === "official_holiday")?.ok, true);
setPlatformOwnerBoardForTest(null);
assert.equal(leaveOnDayView({ id: "e", leaveRequests: [] }, "2026-09-23", true)?.type, "إجازة اليوم الوطني");

const rulingsSrc = readFileSync(new URL("../src/components/owner/OwnerCompanyRulings.jsx", import.meta.url), "utf8");
const ownerUiSrc = readFileSync(new URL("../src/components/owner/ownerUi.jsx", import.meta.url), "utf8");
const boardSrc = readFileSync(new URL("../src/pages/CompanyOwnerBoard.jsx", import.meta.url), "utf8");
const appSrc = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(ownerUiSrc, /ownerGateBanner/, "owner gate uses shared alert banner");
assert.match(ownerUiSrc, /statusBanner\.warn/, "owner warn matches /app تنبيهات soft fill");
assert.doesNotMatch(rulingsSrc, /GateLine/, "rulings no longer use plain warn text");
assert.match(rulingsSrc, /ownerGateBanner/, "rulings gates use alert banner");
assert.match(boardSrc, /ownerBoardSections/, "board reads the complete section inventory");
assert.match(boardSrc, /NewsBroadcast/, "news broadcast lives on the owner board");
assert.match(boardSrc, /tab === "news"/, "news is its own owner tab");
assert.match(appSrc, /path="\/owner"/, "/owner route");
assert.match(appSrc, /path="\/owner-panel"[^>]*Navigate to="\/owner"/s, "/owner-panel redirects to /owner");
assert.match(appSrc, /path="\/app\/owner"[^>]*Navigate to="\/owner"/s, "/app/owner redirects to /owner");

const expectedTabs = [
  "glance", "companies", "rulings", "holidays", "ramadan",
  "subscribers", "invoices", "plans", "report", "feedback", "audit", "roadmap", "news",
];
assert.deepEqual(OWNER_BOARD_SECTIONS.map((row) => row.value), expectedTabs);
assert.equal(ownerBoardSections(true).length, expectedTabs.length);
assert.equal(ownerBoardSections(true)[0].label, "نظرة");
assert.equal(ownerBoardSections(false).find((row) => row.value === "news")?.label, "News");
for (const value of expectedTabs) {
  assert.match(boardSrc, new RegExp(`tab === "${value}"`), `board renders tab ${value}`);
}

console.log("owner board rulings ok");
