import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calendarCellMatches, dayAttendanceStatus, employeeScheduledOn } from "../src/lib/attendanceCalendar.js";
import {
  approvedLeaveOnDay,
  approvedLeavePeopleOnDay,
  isOnApprovedLeave,
  isSaudiWeekend,
  isStatutoryOffDay,
  LEAVE_TYPES,
  leaveTypeLabel,
  weekendLeavePeople,
} from "../src/lib/leaveTypes.js";
import { hydrateEmployeesLeave } from "../src/lib/leaveDerivations.js";
import { calendarOverlayEmployees, leaveOnDayView, LEAVE_STYLE } from "../src/lib/shiftWeek.js";
import {
  annualEntitlementDue,
  leaveApprovalBlessing,
  leaveApprovalCardNote,
  leaveDecisionNoticeText,
} from "../src/lib/leaveEntitlementCycle.js";

const omar = {
  id: "omar",
  name: "عمر ناصر",
  leaveRequests: [{
    id: "lv_1",
    status: "approved",
    type: "annual",
    startDate: "2026-09-09",
    endDate: "2026-09-11",
  }],
};
const sara = { id: "sara", name: "سارة حسن", leaveRequests: [] };
const schedules = [{
  assignments: { "2026-09-10": { morning: ["omar"] } },
  shiftTypes: [{ id: "morning" }],
}];

assert.equal(isOnApprovedLeave(omar, "2026-09-10"), true);
assert.equal(isOnApprovedLeave(sara, "2026-09-10"), false);
assert.equal(employeeScheduledOn(schedules, "omar", "2026-09-10"), true);
assert.equal(employeeScheduledOn(schedules, "sara", "2026-09-10"), false);
assert.equal(
  isOnApprovedLeave(omar, "2026-09-10") && employeeScheduledOn(schedules, "omar", "2026-09-10"),
  true,
  "approved leave on a published assignment is a clash",
);
assert.equal(
  isOnApprovedLeave(omar, "2026-09-10") && employeeScheduledOn([], "omar", "2026-09-10"),
  false,
  "leave without a published assignment is not a clash",
);

const days = [];
for (let day = 1; day <= 30; day += 1) {
  const key = `2026-09-${String(day).padStart(2, "0")}`;
  if (approvedLeaveOnDay(omar, key)) days.push(key);
}
assert.deepEqual(days, ["2026-09-09", "2026-09-10", "2026-09-11"]);
assert.equal(approvedLeaveOnDay(omar, "2026-09-08"), null);

const future = {
  id: "omar-future",
  leaveRequests: [{
    id: "lv_future",
    status: "approved",
    type: "annual",
    startDate: "2026-09-15",
    endDate: "2026-09-15",
    days: 1,
    activeStartDate: "2026-09-14T17:32:00.000Z",
    activeEndDate: "2026-09-14T17:32:00.000Z",
  }],
};
assert.equal(isOnApprovedLeave(future, "2026-09-15"), true, "future annual leave covers the requested day");
assert.equal(isOnApprovedLeave(future, "2026-09-14"), false, "stale approval-day window must not pull leave forward");
assert.equal(approvedLeaveOnDay(future, "2026-09-15")?.id, "lv_future");
assert.equal(approvedLeaveOnDay(future, "2026-09-14"), null);

const futureSchedules = [{
  assignments: { "2026-09-15": { morning: ["omar-future"] } },
  shiftTypes: [{ id: "morning" }],
}];
assert.equal(dayAttendanceStatus({
  employee: future,
  dateKey: "2026-09-15",
  todayKey: "2026-09-14",
  schedules: futureSchedules,
  onLeave: isOnApprovedLeave(future, "2026-09-15"),
}), "on_leave", "future approved leave is marked on the requested day");
assert.equal(dayAttendanceStatus({
  employee: future,
  dateKey: "2026-09-14",
  todayKey: "2026-09-14",
  schedules: futureSchedules,
  onLeave: isOnApprovedLeave(future, "2026-09-14"),
}), null, "approval day without requested leave is not marked as leave — and today is still open");

const entitled = {
  id: "noura",
  name: "نورة",
  leaveRequests: [],
  profile: { hireDate: "2020-01-15" },
};
assert.equal(annualEntitlementDue(entitled, "2026-09-12").reason, "mid_year");
assert.equal(annualEntitlementDue(entitled, "2026-01-16").kind, "year_start");
assert.equal(annualEntitlementDue(entitled, "2026-12-20").kind, "year_end");
assert.equal(annualEntitlementDue({
  ...entitled,
  profile: { hireDate: "2020-01-15", annualEntitlementNoticeKey: "2026-01-15:year_start" },
}, "2026-01-16").reason, "notified");
assert.match(leaveDecisionNoticeText({ status: "approved", type: "annual", startDate: "2026-10-01", endDate: "2026-10-05" }), /تهانينا|بارك/);
assert.match(leaveDecisionNoticeText({ status: "approved", type: "annual", startDate: "2026-10-01", endDate: "2026-10-05" }), /اعتُمدت/);
assert.ok(!/\d{4}-\d{2}-\d{2}/.test(leaveDecisionNoticeText({ status: "approved", type: "annual", startDate: "2026-10-01", endDate: "2026-10-05" })), "Arabic notice span is not ISO");
assert.match(leaveDecisionNoticeText({ status: "approved", type: "annual", startDate: "2026-10-01", endDate: "2026-10-05" }, "en"), /October/);
assert.ok(!/\d{4}-\d{2}-\d{2}/.test(leaveDecisionNoticeText({ status: "approved", type: "annual", startDate: "2026-10-01", endDate: "2026-10-05" }, "en")), "English notice span is not ISO");
assert.match(leaveDecisionNoticeText({
  status: "approved",
  type: "annual",
  startDate: "2026-09-20",
  endDate: "2026-09-22",
  recordedBy: "مدير",
  daysUntilStart: 8,
}), /30/);
assert.match(leaveDecisionNoticeText({
  status: "approved",
  type: "annual",
  startDate: "2026-09-20",
  endDate: "2026-09-22",
  recordedBy: "مدير",
  daysUntilStart: 8,
}), /تهانينا|بارك/);

assert.equal(isSaudiWeekend("2026-09-11"), true, "11 Sep 2026 is Friday");
assert.equal(isSaudiWeekend("2026-09-12"), true, "12 Sep 2026 is Saturday");
assert.equal(isSaudiWeekend("2026-09-10"), false, "10 Sep 2026 is Thursday");
assert.equal(isSaudiWeekend("2026-09-15"), false, "15 Sep 2026 is Tuesday");
assert.equal(isSaudiWeekend(new Date(2026, 8, 11)), true);
assert.equal(weekendLeavePeople([omar, sara], "2026-09-10"), null, "weekday is not a weekend overlay");
assert.deepEqual(weekendLeavePeople([omar, sara], "2026-09-12"), [], "ordinary Saturday stays empty — عطلة");
const fridayHits = weekendLeavePeople([omar, sara], "2026-09-11");
assert.equal(fridayHits?.length, 1, "Friday with approved leave emits a leave-only overlay");
assert.equal(fridayHits[0].id, "omar");
assert.equal(approvedLeaveOnDay(omar, "2026-09-11")?.id, "lv_1");
assert.equal(dayAttendanceStatus({
  employee: omar,
  dateKey: "2026-09-11",
  todayKey: "2026-09-14",
  schedules,
  onLeave: isOnApprovedLeave(omar, "2026-09-11"),
}), "on_leave", "approved leave covering Friday is on_leave, not a hole");
assert.equal(dayAttendanceStatus({
  employee: omar,
  row: { check_in_at: "2026-09-10T07:05:00", status: "present" },
  dateKey: "2026-09-10",
  todayKey: "2026-09-14",
  schedules,
  onLeave: isOnApprovedLeave(omar, "2026-09-10"),
}), "on_leave", "approved leave wins over a leftover punch on that day");
assert.equal(isOnApprovedLeave(sara, "2026-09-11"), false);
assert.equal(approvedLeavePeopleOnDay([sara], "2026-09-11").length, 0, "no fake weekend absence");

const saturdayLeave = {
  id: "layla",
  name: "ليلى",
  leaveRequests: [{
    id: "lv_sat",
    status: "approved",
    type: "annual",
    startDate: "2026-09-12",
    endDate: "2026-09-12",
  }],
};
const satHits = weekendLeavePeople([saturdayLeave, sara], "2026-09-12");
assert.equal(satHits?.length, 1, "Saturday with approved leave emits leave-only people");
assert.equal(satHits[0].id, "layla");
assert.equal(weekendLeavePeople([saturdayLeave], "2026-09-11")?.length, 0, "Friday without that leave stays عطلة");

assert.equal(leaveTypeLabel("maternity", true), "أمومة");
assert.equal(leaveTypeLabel("paternity", true), "أبوة");
assert.equal(leaveTypeLabel("maternity", false), "Maternity");
assert.equal(leaveTypeLabel("paternity", false), "Paternity");

const archivedAnnual = {
  id: "omar-seen",
  name: "عمر ناصر",
  stationId: "st_north",
  leaveRequests: [{
    id: "lv_annual_seen",
    status: "approved",
    type: "annual",
    startDate: "2026-09-16",
    endDate: "2026-09-16",
    decisionSeenAt: "2026-09-15T17:04:00.000Z",
  }],
};
assert.equal(approvedLeaveOnDay(archivedAnnual, "2026-09-16")?.type, "annual", "seen/archived annual leave still covers the day");
assert.equal(dayAttendanceStatus({
  employee: archivedAnnual,
  dateKey: "2026-09-16",
  todayKey: "2026-09-15",
  schedules: [],
  onLeave: isOnApprovedLeave(archivedAnnual, "2026-09-16"),
}), "on_leave", "operational calendar marks Art. 109 annual leave after the card is archived");

const rosterOnly = hydrateEmployeesLeave(
  [{ id: "blob-only", name: "سارة", leaveRequests: [] }],
  {
    leaveRoster: [{
      id: "blob-only",
      leaveRequests: [{
        id: "lv_roster",
        status: "approved",
        type: "annual",
        startDate: "2026-09-16",
        endDate: "2026-09-16",
      }],
    }],
  },
);
assert.equal(approvedLeaveOnDay(rosterOnly[0], "2026-09-16")?.id, "lv_roster", "leaveRoster annual leave overlays the calendar");

const LEAVE_BLESS_TONE = {
  annual: /تهانينا|بارك/,
  grant: /تهانينا|بارك/,
  sick: /شفاك|عافاك/,
  exam: /وُفّقت|بارك/,
  marriage: /مبارك/,
  bereavement: /عظّم/,
  bereavement_sibling: /عظّم/,
  maternity: /مبارك/,
  maternity_extend: /بارك|رعاك/,
  maternity_companion: /بارك|رعاك/,
  paternity: /مبارك/,
  hajj: /تقبّل|حج مبرور/,
  eid: /تقبّل|عطلة رسمية|إجازة العيد/,
  national: /إجازة اليوم الوطني/,
  founding: /إجازة يوم التأسيس/,
  iddah: /عظّم/,
  emergency: /يسّر|بارك/,
  unpaid: /تهانينا|بارك/,
};

const overlayDays = [
  "2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16",
  "2026-09-17", "2026-09-20", "2026-09-21", "2026-09-22",
  "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-27", "2026-09-28", "2026-09-29",
  "2026-09-30", "2026-10-01",
];
assert.equal(LEAVE_TYPES.length, overlayDays.length, "every raise-able leave type has a paint day");

const allTypesPerson = {
  id: "all-types",
  name: "عمر ناصر",
  leaveRequests: LEAVE_TYPES.map((row, index) => ({
    id: `lv_${row.key}`,
    status: "approved",
    type: row.key,
    startDate: overlayDays[index],
    endDate: overlayDays[index],
    decisionSeenAt: "2026-09-12T10:00:00.000Z",
  })),
};

for (const [index, row] of LEAVE_TYPES.entries()) {
  const day = overlayDays[index];
  const notice = leaveDecisionNoticeText({ status: "approved", type: row.key, startDate: day, endDate: day });
  const card = leaveApprovalCardNote({ type: row.key, startDate: day, endDate: day });
  const tone = LEAVE_BLESS_TONE[row.key];
  assert.ok(tone, `blessing tone for ${row.key}`);
  assert.match(leaveApprovalBlessing(row.key), tone, `${row.key} blessing tone`);
  assert.match(notice, tone, `${row.key} notice tone`);
  assert.match(card, tone, `${row.key} card tone`);
  assert.match(card, /التقويم التشغيلي|جدول الدوام/);
  if (row.key === "sick" || row.key === "bereavement" || row.key === "bereavement_sibling" || row.key === "iddah") {
    assert.ok(!/تهانينا|مبارك/.test(leaveApprovalBlessing(row.key)), `${row.key} stays compassionate`);
    assert.ok(!/العدّة|العدة/.test(leaveApprovalBlessing(row.key)), `${row.key} does not call Art. 113 عدة`);
  } else {
    assert.ok(/تهانينا|مبارك|بارك|وُفّقت|تقبّل|يسّر|رعاك/.test(leaveApprovalBlessing(row.key)), `${row.key} congratulates or blesses`);
  }
  assert.equal(approvedLeaveOnDay(allTypesPerson, day)?.type, row.key, `${row.key} paints the calendar day`);
  assert.equal(leaveOnDayView(allTypesPerson, day, true)?.type, leaveTypeLabel(row.key, true), `${row.key} paints the roster`);
  assert.equal(dayAttendanceStatus({
    employee: allTypesPerson,
    dateKey: day,
    todayKey: "2026-09-12",
    schedules: [],
    onLeave: isOnApprovedLeave(allTypesPerson, day),
  }), "on_leave", `${row.key} is on_leave after archive`);
}

const rosterMarriage = hydrateEmployeesLeave(
  [{ id: "blob-marriage", name: "أحمد", leaveRequests: [] }],
  {
    leaveRoster: [{
      id: "blob-marriage",
      leaveRequests: [{
        id: "lv_mar",
        status: "approved",
        type: "marriage",
        startDate: "2026-09-17",
        endDate: "2026-09-17",
      }],
    }],
  },
);
assert.equal(approvedLeaveOnDay(rosterMarriage[0], "2026-09-17")?.type, "marriage");
assert.equal(leaveOnDayView(rosterMarriage[0], "2026-09-17", true)?.type, "زواج");

assert.equal(LEAVE_STYLE.color, "var(--nv-warn-fill)");
assert.equal(leaveOnDayView(allTypesPerson, overlayDays[0], true)?.style.color, "var(--nv-warn-fill)");
assert.ok(!/#15803D|#137a49|#ECFDF3/i.test(`${LEAVE_STYLE.color}${LEAVE_STYLE.bg}`));

const hqHead = { id: "niyar", name: "نيار", stationId: "hq" };
const hqPeer = {
  id: "noura",
  name: "نورة",
  stationId: "hq",
  leaveRequests: [{ status: "approved", type: "annual", startDate: "2026-09-18", endDate: "2026-09-18" }],
};
const khafjiOmar = {
  id: "omar-khf",
  name: "عمر ناصر",
  stationId: "khafji",
  leaveRequests: [{ status: "approved", type: "sick", startDate: "2026-09-14", endDate: "2026-09-14" }],
};
const niyarMine = calendarOverlayEmployees({
  lane: "mine",
  employee: hqHead,
  employees: [hqHead, hqPeer, khafjiOmar],
  headerPeople: [khafjiOmar],
});
assert.ok(niyarMine.some((row) => row.id === "noura"), "ملفي يرى إجازة زميل فرع المقر");
assert.ok(!niyarMine.some((row) => row.id === "omar-khf"), "ملفي لا يرى إجازة الخفجي");
assert.equal(leaveOnDayView(hqPeer, "2026-09-18", true)?.type, "سنوية");

assert.equal(dayAttendanceStatus({
  employee: sara,
  dateKey: "2026-09-16",
  todayKey: "2026-09-16",
  schedules: [],
}), null, "today without a punch is still open — not absent");
assert.equal(dayAttendanceStatus({
  employee: sara,
  dateKey: "2026-09-15",
  todayKey: "2026-09-16",
  schedules: [],
}), "absent", "a closed past day without a punch is absent");
assert.equal(dayAttendanceStatus({
  employee: omar,
  dateKey: "2026-09-16",
  todayKey: "2026-09-16",
  schedules: [],
  onLeave: true,
}), "on_leave", "approved leave still marks today");

const leaveCell = { blank: false, d: 18, key: "2026-09-18", weekend: true, rec: { leave: 1, abs: 0, late: 0, broke: null } };
const weekendCell = { blank: false, d: 19, key: "2026-09-19", weekend: true, rec: null };
const absentCell = { blank: false, d: 15, key: "2026-09-15", weekend: false, rec: { leave: 0, abs: 1, late: 0, broke: null } };
assert.equal(calendarCellMatches({ cell: leaveCell, query: "إجازة" }), true);
assert.equal(calendarCellMatches({ cell: weekendCell, query: "إجازة" }), false, "weekend off is not leave");
assert.equal(calendarCellMatches({ cell: weekendCell, query: "عطلة" }), true);
assert.equal(calendarCellMatches({ cell: leaveCell, query: "عطلة" }), true);
assert.equal(calendarCellMatches({ cell: absentCell, query: "غياب" }), true);
assert.equal(calendarCellMatches({ cell: leaveCell, query: "غياب" }), false);
assert.equal(calendarCellMatches({ cell: { ...absentCell, key: "2026-09-10" }, quick: "week", todayKey: "2026-09-16" }), true);
assert.equal(calendarCellMatches({ cell: { ...absentCell, key: "2026-09-08" }, quick: "week", todayKey: "2026-09-16" }), false, "eighth day is outside last week");

const calPage = readFileSync(new URL("../src/components/attendance/AttendanceMonthCalendar.jsx", import.meta.url), "utf8");
const calLib = readFileSync(new URL("../src/lib/operationalCalendar.js", import.meta.url), "utf8");
assert.match(calPage, /dayHeadPhrase\(selRec\.head/);
assert.doesNotMatch(calPage, /موظف مجدول/);
assert.match(calLib, /من ظهرت لهم حالة/);
assert.match(calLib, /with a recorded status/);

const nationalOff = isStatutoryOffDay({ id: "e", name: "نورة" }, "2026-09-23");
assert.equal(nationalOff?.kind, "official");
assert.match(nationalOff.labelAr, /وطني/);
assert.equal(isStatutoryOffDay({ id: "e" }, "2026-09-26"), null);
assert.equal(dayAttendanceStatus({
  employee: { id: "e" },
  row: null,
  dateKey: "2026-09-23",
  schedules: [{ shiftTypes: [{ id: "m" }], assignments: { "2026-09-23": { m: ["e"] } } }],
  todayKey: "2026-09-26",
  onLeave: !!isStatutoryOffDay({ id: "e" }, "2026-09-23"),
}), "on_leave", "National Day is leave, not absence, even with a leftover assignment");
assert.match(calLib, /off\?\.kind !== \"official\"/, "official holiday does not ask for a substitute");

console.log("calendar leave overlay ok");
