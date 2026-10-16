/**
 * Art. 112 — official holidays apply from the platform calendar, never from a request.
 * National Day, Founding Day, Eid al-Fitr and Eid al-Adha lock the roster as full-pay leave for
 * everyone; attendance, duty days and payroll read the same calendar; an «eid» request is refused by
 * name (HOLIDAY_AUTOMATIC) on both twins; legacy requests stay history and are never counted twice.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  approvedLeaveOnDay,
  isOnApprovedLeave,
  isStatutoryOffDay,
  LEAVE_TYPES,
  usedLeaveDays,
} from "../src/lib/leaveTypes.js";
import {
  checkSubmitLeaveGate,
  checkApproveLeaveGate,
  HOLIDAY_AUTOMATIC,
  HOLIDAY_REQUEST_NOT_NEEDED,
  holidayNotNeededLabel,
  isOnApprovedLeave as isOnApprovedLeaveRows,
  voidLegacyHolidayRequest,
  voidLegacyHolidayRequestsIn,
} from "../src/lib/leaveDerivations.js";
import * as ts from "../base44/shared/leaveDerivations.ts";
import { checkHolidayWorkGate, isRosterLeaveDay, leaveOnDayView } from "../src/lib/shiftWeek.js";
import { isAutomaticOfficialHoliday, isRosterLockedCivicHoliday, officialHolidayOn } from "../src/lib/ummAlQuraCalendar.js";
import { myDutyDay } from "../src/lib/dutyDay.js";
import { checkPunchRecordGate } from "../src/lib/attendancePunch.js";
import { holidayOvertimeHours } from "../src/lib/payrollLaw.js";
import { deriveEidOverlap, chargeableAnnualWorkDays } from "../src/lib/leaveEidOverlap.js";
import { leaveKindsFor } from "../src/lib/requestWorkspace.js";

const ADHA = ["2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29"];
const worker = { id: "w1", name: "سالم", stationId: "s1", profile: { hireDate: "2020-01-01", gender: "male", religion: "muslim", birthDate: "1990-01-01" }, leaveRequests: [] };

// 1) Every Art. 112 holiday is automatic — Eid joins National and Founding.
for (const id of ["national", "founding", "fitr", "adha"]) assert.equal(isAutomaticOfficialHoliday(id), true, id);
assert.equal(isRosterLockedCivicHoliday("fitr"), false, "the civic helper still names only the civic days");
assert.equal(LEAVE_TYPES.find((row) => row.key === "eid")?.automatic, true);
assert.ok(!leaveKindsFor(worker.profile, true, []).some((row) => row.key === "eid"), "no official-holiday kind to pick");

// 2) Roster lock from the calendar, with no request at all.
for (const day of ADHA) {
  assert.equal(officialHolidayOn(day, {})?.id, "adha");
  assert.equal(isRosterLeaveDay(worker, day, {}), true, `${day} locks the roster`);
  const view = leaveOnDayView(worker, day, true, {});
  assert.equal(view?.source, "official_holiday");
  assert.equal(view?.type, "إجازة عيد الأضحى");
  assert.equal(view?.articleId, "112");
}
// Fitr 2026 (Ramadan 1447 from 2026-02-18, 30 days until announced) — locked from the calendar.
assert.equal(officialHolidayOn("2026-03-20", {})?.id, "fitr");
assert.equal(isRosterLeaveDay(worker, "2026-03-20", {}), true);
// An owner-board ruling moves Eid for everyone — the roster follows the board, no request.
const ruled = { ownerHolidays: { adha: { overridden: true, from: "2026-05-27", to: "2026-05-30" } } };
assert.equal(officialHolidayOn("2026-05-30", ruled)?.id, "adha");
assert.equal(isRosterLeaveDay(worker, "2026-05-30", ruled), true);
assert.equal(isRosterLeaveDay(worker, "2026-05-26", ruled), false, "the board's dates replace the default span");

// 3) Attendance and duty days: an Eid day is a paid holiday, not an absence and not a request.
const off = isStatutoryOffDay(worker, "2026-05-27", {});
assert.equal(off?.kind, "official");
assert.equal(off?.id, "adha");
const duty = myDutyDay({ employee: worker, data: { schedules: [] }, row: null, key: "2026-05-27", todayKey: "2026-06-10", calendar: {} });
assert.equal(duty.status, "holiday", "Eid reads as a paid holiday outside attendance");
// Working the holiday is recorded, never refused — every hour overtime (Arts. 107(3), 112).
const punch = checkPunchRecordGate({ type: "manual_punch", employee: worker, attendance: null, date: "2026-05-27", time: "08:00", reason: "عمل في العيد", requireTime: true, laborCalendar: {} });
assert.notEqual(punch.error, "ON_APPROVED_LEAVE", "no request blocks the punch — the holiday is recorded as overtime");
const legacyPunch = checkPunchRecordGate({ type: "manual_punch", employee: { ...worker, leaveRequests: [{ type: "eid", status: "approved", startDate: "2026-05-26", endDate: "2026-05-29" }] }, attendance: null, date: "2026-05-27", time: "08:00", reason: "عمل في العيد", requireTime: true, laborCalendar: {} });
assert.notEqual(legacyPunch.error, "ON_APPROVED_LEAVE", "an old Eid approval does not turn the holiday into a request");
const holidayGate = checkHolidayWorkGate({ employee: worker, dateKey: "2026-05-27", laborCalendar: {} });
assert.equal(holidayGate.error, "HOLIDAY_WORK_CONFIRM");
assert.equal(checkHolidayWorkGate({ employee: worker, dateKey: "2026-05-27", laborCalendar: {}, confirmed: true }).overtimeAll, true);

// 4) Payroll: hours worked on an Eid day from the calendar are overtime — no request needed.
const hol = holidayOvertimeHours({
  employeeId: "w1",
  month: "2026-05",
  attendance: [{ employeeId: "w1", date: "2026-05-27", status: "present", check_in_at: "2026-05-27T08:00:00+03:00", check_out_at: "2026-05-27T14:00:00+03:00" }],
  isHoliday: (day) => !!officialHolidayOn(day, {}),
});
assert.ok(hol.hours > 0, "Eid hours are holiday overtime");

// 5) Regs Art. 24 overlap stays: annual over Eid is extended, Eid on weekly rest is compensated.
const overlap = deriveEidOverlap({ start: "2026-05-24", end: "2026-06-02", type: "annual" });
assert.equal(overlap.extendAnnualDays, 4);
assert.equal(overlap.compensateRestDays, 1);
assert.equal(chargeableAnnualWorkDays("2026-05-24", "2026-06-02"), 5);

// 6) New requests are refused by name — client and server twin.
const eidRequest = { type: "eid", startDate: "2026-05-26", endDate: "2026-05-29", days: 4, noOtherEmployerAck: true };
for (const gate of [
  checkSubmitLeaveGate(eidRequest, { profile: worker.profile, requests: [] }),
  checkApproveLeaveGate({ ...eidRequest, status: "pending" }, false, { profile: worker.profile, requests: [] }),
  ts.checkSubmitLeaveGate(eidRequest, { profile: worker.profile, requests: [] }),
  ts.checkApproveLeaveGate({ ...eidRequest, status: "pending" }, { profile: worker.profile, requests: [] }),
]) {
  assert.equal(gate.ok, false);
  assert.equal(gate.error, HOLIDAY_AUTOMATIC);
  assert.match(gate.reason, /تُطبَّق تلقائياً في الجدول بأجر كامل — لا تُطلب \(المادة 112\)/);
}
assert.equal(ts.HOLIDAY_AUTOMATIC, HOLIDAY_AUTOMATIC);
const workforceSrc = readFileSync(new URL("../base44/functions/workforce/entry.ts", import.meta.url), "utf8");
assert.match(workforceSrc, /checkSubmitLeaveGate\(request, extras\)/, "the server raise runs the submit gate (HOLIDAY_AUTOMATIC)");
const dailySrc = readFileSync(new URL("../base44/functions/dailyReport/entry.ts", import.meta.url), "utf8");
assert.match(dailySrc, /!isOfficialHolidayDay\(dateKey\)/, "an official holiday is never an unexcused absence on the server");

// 7) Legacy requests: approved stay history with no double count; pending become «لا حاجة».
const legacyApproved = { id: "old1", type: "eid", status: "approved", startDate: "2026-05-26", endDate: "2026-05-29", days: 4 };
const legacy = { ...worker, leaveRequests: [legacyApproved] };
assert.equal(approvedLeaveOnDay(legacy, "2026-05-27"), null, "the calendar paints the day, not the old request");
assert.equal(isOnApprovedLeave(legacy, "2026-05-27"), false);
assert.equal(isOnApprovedLeaveRows(legacy.leaveRequests, "2026-05-27"), false);
assert.equal(ts.isOnApprovedLeave(legacy.leaveRequests, "2026-05-27"), false);
assert.equal(leaveOnDayView(legacy, "2026-05-27", true, {})?.source, "official_holiday", "one holiday, counted once");
assert.equal(isStatutoryOffDay(legacy, "2026-05-27", {})?.kind, "official");
assert.equal(usedLeaveDays(legacy.leaveRequests, "annual", "2026-06-10", "2020-01-01"), 0, "no balance is touched");
const annualAround = checkApproveLeaveGate(
  { type: "annual", startDate: "2026-05-24", endDate: "2026-06-02", days: 10, status: "pending", noOtherEmployerAck: true },
  false,
  { profile: worker.profile, requests: legacy.leaveRequests },
);
assert.equal(annualAround.ok, true, annualAround.reason);

const pending = { id: "old2", type: "eid", status: "pending", startDate: "2026-05-26", endDate: "2026-05-29", days: 4 };
const voided = voidLegacyHolidayRequest(pending, "2026-10-16T00:00:00.000Z");
assert.equal(voided.status, HOLIDAY_REQUEST_NOT_NEEDED);
assert.equal(voided.voidReason, HOLIDAY_AUTOMATIC);
assert.equal(voidLegacyHolidayRequest(legacyApproved), legacyApproved, "approved history is kept as is");
assert.equal(ts.voidLegacyHolidayRequest(pending).status, "not_needed");
assert.equal(holidayNotNeededLabel(pending, true), "لا حاجة — العيد يُطبَّق تلقائياً");
assert.equal(holidayNotNeededLabel({ ...pending, startDate: "2026-09-23" }, true), "لا حاجة — اليوم الوطني يُطبَّق تلقائياً");
assert.equal(checkApproveLeaveGate(voided, false, {}).error, "LEAVE_NOT_PENDING", "a voided request cannot be approved");
const company = { employees: [{ id: "w1", leaveRequests: [pending, legacyApproved, { id: "a", type: "annual", status: "pending" }] }] };
assert.equal(voidLegacyHolidayRequestsIn(company), true);
assert.deepEqual(company.employees[0].leaveRequests.map((row) => row.status), ["not_needed", "approved", "pending"]);
assert.equal(voidLegacyHolidayRequestsIn(company), false, "idempotent");

console.log("holiday automatic ok");
