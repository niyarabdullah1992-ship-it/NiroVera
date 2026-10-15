import assert from "node:assert/strict";
import {
  GRACE_MINUTES,
  SHIFT_HOURS,
  WEEKLY_HOURS_CAP,
  WEEKLY_OT_CAP_HOURS,
  REPORT_CATALOG,
  SCHEDULED_REPORTS,
  parseHm,
  formatMinutes,
  parsePeriod,
  catalogById,
  actorMayGenerate,
  deriveTimesheetDay,
  deriveTimesheetTotals,
  deriveAttendanceOtAnalysis,
  deriveReportCards,
  checkGenerateReportGate,
  checkCloseTimesheetGate,
  checkReopenTimesheetGate,
  sheetKey,
} from "../src/lib/reportsDerivations.js";

assert.equal(GRACE_MINUTES, 10);
assert.equal(SHIFT_HOURS, 8);
assert.equal(WEEKLY_HOURS_CAP, 48);
assert.equal(WEEKLY_OT_CAP_HOURS, 8);
assert.equal(REPORT_CATALOG.length, 6);
assert.equal(SCHEDULED_REPORTS.length, 3);
assert.equal(parseHm("07:00"), 420);
assert.equal(parseHm("bad"), null);
assert.equal(formatMinutes(90), "1:30");
assert.equal(formatMinutes(0), "—");
assert.deepEqual(parsePeriod("2026-08"), { year: 2026, month: 8 });
assert.equal(parsePeriod("2026-13"), null);
assert.equal(catalogById("attendance_ot")?.format, "XLSX");
assert.equal(catalogById("nope"), null);

assert.equal(actorMayGenerate({ role: "employee" }, catalogById("consolidated_daily")), true);
assert.equal(actorMayGenerate({ role: "employee" }, catalogById("board_summary")), false);
assert.equal(actorMayGenerate({ role: "director" }, catalogById("board_summary")), true);
assert.equal(actorMayGenerate({ role: "employee", owner: true }, catalogById("audit_trail")), true);

// The timesheet reads the ROSTERED shift (no fixed 07:00 / 8 h) and deducts rest (Art. 102) — the
// same reading as the attendance board (actualDuty.js). 2026-08-02 is a Sunday working day.
const MORNING = { id: "m", start: "07:00", end: "15:00", restMinutes: 30 };
const present = deriveTimesheetDay({
  date: "2026-08-02",
  checkIn: "07:05",
  checkOut: "16:10",
}, { shift: MORNING });
assert.equal(present.status, "present");
assert.equal(present.ordinaryMinutes, 480);
assert.equal(present.overtimeMinutes, 35); // 07:05→16:10 = 545 − 30 rest = 515 − 480
assert.equal(present.late, false);

const late = deriveTimesheetDay({
  date: "2026-08-03",
  checkIn: "07:22",
  checkOut: "15:00",
}, { shift: MORNING });
assert.equal(late.status, "late");
assert.ok(late.lateMinutes > 0);
assert.equal(late.overtimeMinutes, 0);

const open = deriveTimesheetDay({
  date: "2026-08-04",
  checkIn: "07:00",
  checkOut: null,
}, { shift: MORNING });
assert.equal(open.openCheckout, true);
assert.equal(open.ordinaryMinutes, 0);

const leave = deriveTimesheetDay({ date: "2026-08-04", onLeave: true });
assert.equal(leave.status, "leave");

const rest = deriveTimesheetDay({ date: "2026-08-05", restDay: true });
assert.equal(rest.status, "rest");

const absent = deriveTimesheetDay({ date: "2026-08-06" });
assert.equal(absent.status, "absent");

const totals = deriveTimesheetTotals([present, late, open, leave, rest, absent]);
assert.equal(totals.lateCount, 1);
assert.equal(totals.openCheckouts, 1);
assert.equal(totals.leaveDays, 1);
assert.equal(totals.absenceDays, 1);
assert.equal(totals.closesPayroll, true);
assert.ok(totals.ordinaryMinutes > 0);

const analysis = deriveAttendanceOtAnalysis([
  { employeeId: "a", stationId: "jbl2", date: "2026-08-03", ordinaryMinutes: 480, overtimeMinutes: 120, lateMinutes: 20, status: "late" },
  { employeeId: "a", stationId: "jbl2", date: "2026-08-04", ordinaryMinutes: 480, overtimeMinutes: 100, status: "present" },
  { employeeId: "a", stationId: "jbl2", date: "2026-08-05", ordinaryMinutes: 480, overtimeMinutes: 90, status: "present" },
  { employeeId: "a", stationId: "jbl2", date: "2026-08-06", ordinaryMinutes: 480, overtimeMinutes: 80, status: "present" },
  { employeeId: "a", stationId: "jbl2", date: "2026-08-07", ordinaryMinutes: 480, overtimeMinutes: 100, status: "present" },
  { employeeId: "b", stationId: "jbl1", date: "2026-08-03", ordinaryMinutes: 480, overtimeMinutes: 0, status: "present" },
  { employeeId: "b", stationId: "jbl1", date: "2026-08-10", status: "absent" },
  { employeeId: "b", stationId: "jbl1", date: "2026-08-11", status: "absent" },
]);
assert.equal(analysis.lateEvents, 1);
assert.equal(analysis.repeatAbsence.length, 1);
assert.equal(analysis.repeatAbsence[0].employeeId, "b");
assert.ok(analysis.stationsOverCap.some((s) => s.stationId === "jbl2"));
assert.ok(analysis.individualBreaches.some((b) => b.employeeId === "a"));

const cards = deriveReportCards({ consolidated_daily: new Date(Date.now() - 3600_000).toISOString() });
assert.equal(cards.length, 6);
assert.ok(cards[0].lastRunLabelEn.includes("today") || cards[0].lastRunAt);

assert.equal(checkGenerateReportGate({ reportId: "nope" }).error, "UNKNOWN_REPORT");
assert.equal(
  checkGenerateReportGate({ reportId: "board_summary", actor: { role: "employee" } }).error,
  "FORBIDDEN",
);
assert.equal(
  checkGenerateReportGate({ reportId: "attendance_ot", actor: { role: "hr" } }).error,
  "PERIOD_REQUIRED",
);
assert.equal(
  checkGenerateReportGate({
    reportId: "attendance_ot",
    actor: { role: "hr" },
    period: "2026-08",
    scopeEmpty: true,
  }).error,
  "EMPTY_SCOPE",
);
assert.equal(
  checkGenerateReportGate({
    reportId: "attendance_ot",
    actor: { role: "hr" },
    period: "2026-08",
  }).ok,
  true,
);
assert.equal(
  checkGenerateReportGate({
    reportId: "audit_trail",
    actor: { role: "admin" },
  }).ok,
  true,
);

assert.equal(checkCloseTimesheetGate({}).error, "EMPLOYEE_REQUIRED");
assert.equal(checkCloseTimesheetGate({ employeeId: "e1", period: "bad" }).error, "PERIOD_REQUIRED");
assert.equal(
  checkCloseTimesheetGate({
    employeeId: "e1",
    period: "2026-08",
    sheet: { closed: true },
  }).error,
  "ALREADY_CLOSED",
);
assert.equal(
  checkCloseTimesheetGate({
    employeeId: "e1",
    period: "2026-08",
    openCheckouts: 2,
  }).error,
  "OPEN_CHECKOUTS",
);
assert.equal(
  checkCloseTimesheetGate({
    employeeId: "e1",
    period: "2026-08",
    openCheckouts: 0,
  }).ok,
  true,
);

assert.equal(checkReopenTimesheetGate({ sheet: { closed: false } }).error, "NOT_CLOSED");
assert.equal(
  checkReopenTimesheetGate({ sheet: { closed: true }, reason: "" }).error,
  "REASON_REQUIRED",
);
assert.equal(
  checkReopenTimesheetGate({ sheet: { closed: true }, reason: "تصحيح انصراف" }).ok,
  true,
);

assert.equal(sheetKey("e1", "2026-08"), "e1::2026-08");

console.log("reports derivations: ok");
