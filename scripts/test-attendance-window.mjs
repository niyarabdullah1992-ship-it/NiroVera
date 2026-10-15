import assert from "node:assert/strict";
import { todaysShiftEnded, checkEarlyCheckInGate, earlyCheckInMinutes } from "../src/lib/attendanceDerivations.js";
import { seedPreviewAttendanceHistory } from "../src/lib/previewMigrations.js";

const night = { start: "23:00", end: "07:00" };
const morning = { start: "07:00", end: "15:00" };
const at = (h, m = 0) => h * 60 + m;
assert.equal(todaysShiftEnded(night, at(21, 40)), false, "a night shift starting tonight is not over at 21:40");
assert.equal(todaysShiftEnded(night, at(8, 30)), false, "nor after its own morning end on the start day");
assert.equal(todaysShiftEnded(morning, at(15, 30)), false, "inside the one-hour grace");
assert.equal(todaysShiftEnded(morning, at(16, 1)), true);
assert.equal(checkEarlyCheckInGate(night, at(21, 40), 60).ok, false, "80 minutes early is refused");
assert.equal(checkEarlyCheckInGate(night, at(21, 40), 60).opensAt, "22:00");
assert.equal(checkEarlyCheckInGate(night, at(22, 5), 60).ok, true);
assert.equal(checkEarlyCheckInGate(morning, at(7, 20), 60).ok, true, "late is not early");
assert.equal(earlyCheckInMinutes({}), 60);
assert.equal(earlyCheckInMinutes({ attendanceSettings: { early_checkin_minutes: 30 } }), 30);

const data = {
  employees: [{ id: "e1", leaveRequests: [{ status: "approved", startDate: "2026-10-06", endDate: "2026-10-06" }] }],
  schedules: [{ stationId: "s1", shiftTypes: [{ id: "n", start: "23:00", end: "07:00" }], assignments: {
    "2026-10-05": { n: ["e1"] }, "2026-10-06": { n: ["e1"] }, "2026-10-14": { n: ["e1"] }, 0: { n: ["e1"] },
  } }],
};
assert.equal(seedPreviewAttendanceHistory(data, "2026-10-14"), true);
assert.equal(data.personalAttendance.length, 1, "past workday only — not leave, not today, not weekday templates");
const row = data.personalAttendance[0];
assert.equal(row.date, "2026-10-05");
assert.ok(row.checkOutAt.startsWith("2026-10-06"), "overnight check-out lands the next morning");
assert.equal(seedPreviewAttendanceHistory(data, "2026-10-14"), false, "runs once");
console.log("attendance window OK");

// Art. 154 — «a period or periods» totalling at most an hour.
{
  const { checkDutyRequestFields, nursingHourOn, excusedStartMinutes, nursingSplitLabel } = await import("../src/lib/dutyRequests.js");
  const base = { type: "nursing_hour", reason: "رضاعة", date: "2026-10-14", childBirthDate: "2026-06-01" };
  assert.equal(checkDutyRequestFields({ ...base, nursingSplit: { start: 30, mid: 0, end: 30 } }).ok, true, "split start + end");
  assert.equal(checkDutyRequestFields({ ...base, nursingSplit: { start: 45, mid: 0, end: 30 } }).error, "NURSING_OVER_HOUR");
  assert.equal(checkDutyRequestFields({ ...base, nursingSplit: { start: 0, mid: 0, end: 0 } }).error, "PLACEMENT_REQUIRED");
  assert.equal(checkDutyRequestFields({ ...base, childBirthDate: "", nursingSplit: { start: 60 } }).error, "BIRTH_REQUIRED");
  assert.equal(checkDutyRequestFields({ type: "nursing_hour", reason: "x", date: "2026-10-14", placement: "start" }).ok, true, "an old request with a placement still passes");
  const emp = { otherRequests: [{ type: "nursing_hour", status: "approved", date: "2026-10-01", nursingSplit: { start: 30, mid: 0, end: 30 } }] };
  const on = nursingHourOn(emp, "2026-10-14");
  assert.equal(on.startMinutes, 30); assert.equal(on.endMinutes, 30); assert.equal(on.minutes, 60);
  assert.equal(excusedStartMinutes(emp, "2026-10-14", "07:00").minutes, 30, "only the start part excuses lateness");
  assert.equal(nursingSplitLabel({ start: 30, mid: 0, end: 30 }), "30 د أول الدوام + 30 د آخر الدوام");
  console.log("nursing split OK");
}
{
  const { isExcusedEarlyCheckout } = await import("../src/lib/dutyRequests.js");
  const emp = { otherRequests: [{ type: "nursing_hour", status: "approved", date: "2026-10-01", nursingSplit: { start: 30, mid: 0, end: 30 } }] };
  assert.equal(isExcusedEarlyCheckout(emp, "2026-10-14", "2026-10-14T14:35:00+03:00", "15:00"), true, "25 min early inside her 30 nursing minutes");
  assert.equal(isExcusedEarlyCheckout(emp, "2026-10-14", "2026-10-14T14:10:00+03:00", "15:00"), false, "50 min early is beyond them");
  console.log("nursing end OK");
}
