import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATT_STATUS,
  GEO_VERDICT,
  GRACE_MINUTES,
  SETTLEMENT_WINDOW_DAYS,
  SHIFT_HOURS,
  buildRosterRow,
  checkOtDecisionGate,
  checkOutOfGeofenceGate,
  checkSettleAbsenceGate,
  deriveAttStats,
  deriveDayStatus,
  filterRosterByStatus,
  localDateKey,
  localDayDiff,
  earlyCheckoutFromScheduledEnd,
  getTodaysShift,
  isForgottenCheckout,
  lateMinutesFromScheduledStart,
  selfPunchScheduleGate,
} from "../src/lib/attendanceDerivations.js";
import { toRiyadhDateKey } from "../src/lib/riyadhDate.js";
import {
  dayAssignmentMap,
  employeeScheduledOn,
  hasPublishedScheduleOn,
} from "../src/lib/attendanceCalendar.js";
import { migratePreviewStationPins } from "../src/lib/previewStationPins.js";
import { checkPunchRecordGate, parsePunchClock, riyadhClockIso } from "../src/lib/attendancePunch.js";

assert.equal(GRACE_MINUTES, 10);
assert.equal(SHIFT_HOURS, 8);
assert.equal(SETTLEMENT_WINDOW_DAYS, 45);

// Present within grace
const onTime = deriveDayStatus({ checkIn: "07:08", checkOut: "15:10" }, { shiftStart: "07:00" });
assert.equal(onTime.status, ATT_STATUS.present);
assert.equal(onTime.lateMinutes, 0);

// Late after grace
const late = deriveDayStatus({ checkIn: "07:25", checkOut: "15:30" }, { shiftStart: "07:00" });
assert.equal(late.status, ATT_STATUS.late);
assert.equal(late.lateMinutes, 15);

// OT beyond 8h
const ot = deriveDayStatus({ checkIn: "07:00", checkOut: "16:30" }, { shiftStart: "07:00" });
assert.equal(ot.ordinaryMinutes, 480);
assert.equal(ot.overtimeMinutes, 90);

// Absent / leave
assert.equal(deriveDayStatus({}).status, ATT_STATUS.absent);
assert.equal(deriveDayStatus({ onLeave: true }).status, ATT_STATUS.leave);

// Local date parts — not UTC ISO drift
const key = localDateKey(new Date(2026, 7, 12));
assert.equal(key, "2026-08-12");
assert.equal(localDayDiff("2026-08-01", "2026-08-12"), 11);

// Geofence gate names reason
const needReason = checkOutOfGeofenceGate({ geoVerdict: "outside", decision: "accept", reason: "" });
assert.equal(needReason.ok, false);
assert.equal(needReason.error, "REASON_REQUIRED");
assert.match(needReason.reasonEn, /written reason/i);

const acceptOk = checkOutOfGeofenceGate({
  geoVerdict: "outside",
  decision: "accept",
  reason: "Emergency call-out",
});
assert.equal(acceptOk.ok, true);

// Settlement window
const closed = checkSettleAbsenceGate({
  absenceDate: "2026-01-01",
  today: "2026-08-12",
  kind: "sick",
  documentName: "note.pdf",
});
assert.equal(closed.ok, false);
assert.equal(closed.error, "SETTLEMENT_WINDOW_CLOSED");

const settleOk = checkSettleAbsenceGate({
  absenceDate: "2026-08-01",
  today: "2026-08-12",
  kind: "sick",
  documentName: "note.pdf",
});
assert.equal(settleOk.ok, true);

const noDoc = checkSettleAbsenceGate({
  absenceDate: "2026-08-01",
  today: "2026-08-12",
  kind: "sick",
  documentName: "",
});
assert.equal(noDoc.ok, false);
assert.equal(noDoc.error, "DOCUMENT_REQUIRED");

// OT decision — hours remain either way
const otGate = checkOtDecisionGate({ overtimeMinutes: 90, decision: "approve" });
assert.equal(otGate.ok, true);
assert.equal(checkOtDecisionGate({ overtimeMinutes: 0, decision: "approve" }).error, "NO_OVERTIME");
assert.equal(checkOtDecisionGate({ overtimeMinutes: 90, decision: "approve", alreadyDecided: false }).ok, true);
assert.equal(checkOtDecisionGate({ overtimeMinutes: 90, decision: "comp_leave" }).error, "COMP_LEAVE_CONSENT");
assert.equal(checkOtDecisionGate({ overtimeMinutes: 90, decision: "comp_leave", workerConsent: true }).ok, true);
assert.equal(checkOtDecisionGate({ overtimeMinutes: 60, decision: "approve", overtimeHoursYtd: 720 }).error, "OT_ANNUAL_CAP");
assert.equal(checkOtDecisionGate({ overtimeMinutes: 60, decision: "approve", overtimeHoursYtd: 720, annualCapConsent: true }).ok, true);
assert.equal(checkOtDecisionGate({ overtimeMinutes: 90, decision: "comp_leave", workerConsent: true, onDate: "2026-09-13", enjoyDate: "2027-01-01" }).error, "COMP_LEAVE_WINDOW");
assert.equal(checkOtDecisionGate({ overtimeMinutes: 90, decision: "comp_leave", workerConsent: true, onDate: "2026-09-13", enjoyDate: "2027-01-01", windowAgreed: true }).ok, true);
assert.equal(checkOtDecisionGate({ overtimeMinutes: 480, decision: "comp_leave", workerConsent: true, onDate: "2026-09-13", creditDaysYtd: 30 }).error, "COMP_LEAVE_YEAR_CAP");

// Roster + chips filter by stable IDs
const rows = [
  buildRosterRow({ employeeId: "a", checkIn: "07:00", checkOut: "15:00", geoVerdict: "inside" }),
  buildRosterRow({ employeeId: "b", checkIn: "07:40", checkOut: "15:00", geoVerdict: "inside" }),
  buildRosterRow({ employeeId: "c", geoVerdict: "outside" }),
  buildRosterRow({
    employeeId: "d",
    checkIn: "07:00",
    checkOut: "15:00",
    geoVerdict: "outside",
    geoDecision: { decision: "reject", reason: "x" },
  }),
];
assert.equal(rows[0].status, ATT_STATUS.present);
assert.equal(rows[1].status, ATT_STATUS.late);
assert.equal(rows[2].status, ATT_STATUS.absent);
assert.equal(rows[2].geo, GEO_VERDICT.pending_review);
assert.equal(rows[3].status, ATT_STATUS.absent);
assert.equal(rows[3].geo, GEO_VERDICT.rejected_outside);

const lateOnly = filterRosterByStatus(rows, ATT_STATUS.late);
assert.equal(lateOnly.length, 1);
assert.equal(lateOnly[0].employeeId, "b");

const stats = deriveAttStats(rows, true);
assert.equal(stats.graceMinutes, 10);
assert.ok(stats.rate >= 0 && stats.rate <= 100);
assert.ok(stats.outsideNeedingReview >= 1);

console.log("attendanceDerivations E2E rules: PASS");

const noShiftGate = selfPunchScheduleGate(null);
assert.equal(noShiftGate.ok, false);
assert.equal(noShiftGate.error, "NOT_SCHEDULED");
assert.equal(selfPunchScheduleGate({ end: "16:00" }).error, "NOT_SCHEDULED");
assert.equal(selfPunchScheduleGate({ start: "09:00", end: "17:00" }).ok, true);

const noShiftLate = lateMinutesFromScheduledStart(8 * 60, null, 15);
assert.equal(noShiftLate.error, "NOT_SCHEDULED");
assert.equal(noShiftLate.lateMinutes, 0);
assert.equal(noShiftLate.status, null);

const fromRota = lateMinutesFromScheduledStart(7 * 60 + 20, "07:00", 15);
assert.equal(fromRota.lateMinutes, 20);
assert.equal(fromRota.status, "late");

const notLateVsCompanyClock = lateMinutesFromScheduledStart(8 * 60 + 5, "09:00", 15);
assert.equal(notLateVsCompanyClock.lateMinutes, 0);
assert.equal(notLateVsCompanyClock.status, "present");
assert.notEqual(notLateVsCompanyClock.lateMinutes, 5);

assert.equal(earlyCheckoutFromScheduledEnd(14 * 60, null).earlyCheckout, false);
assert.equal(earlyCheckoutFromScheduledEnd(14 * 60, "08:00").earlyCheckout, false);
assert.equal(earlyCheckoutFromScheduledEnd(14 * 60, "16:00").earlyCheckout, true);

const forgottenAt = new Date("2026-09-11T08:00:00").getTime();
assert.equal(isForgottenCheckout({ start: "07:00", end: "15:00" }, { check_in_at: "2026-09-11T07:05:00", check_out_at: null }, forgottenAt), false);
assert.equal(isForgottenCheckout({ start: "07:00", end: "15:00" }, { check_in_at: "2026-09-11T07:05:00", check_out_at: null }, new Date("2026-09-11T16:05:00").getTime()), true);
assert.equal(isForgottenCheckout({ start: "07:00", end: "15:00" }, { check_in_at: "2026-09-11T07:05:00", check_out_at: "2026-09-11T15:02:00" }, new Date("2026-09-11T17:00:00").getTime()), false);

const dateKey = toRiyadhDateKey();
const employee = { id: "e1", stationId: "st1" };
const scheduled = getTodaysShift({
  stations: [{ id: "st1" }],
  schedules: [{
    stationId: "st1",
    shiftTypes: [{ id: "morning", start: "07:00", end: "15:00", label: "صباحي" }],
    assignments: { [dateKey]: { morning: ["e1"] } },
  }],
}, employee);
assert.equal(scheduled.start, "07:00");
assert.equal(scheduled.end, "15:00");
assert.equal(getTodaysShift({ stations: [{ id: "st1" }], schedules: [] }, employee), null);

console.log("attendance rota punch rules: PASS");

const weekly = { 4: { morning: ["e1", "e2"] } };
assert.deepEqual(dayAssignmentMap(weekly, "2026-09-10")?.morning, ["e1", "e2"]);
assert.equal(hasPublishedScheduleOn([{ shiftTypes: [{ id: "morning" }], assignments: weekly }], "2026-09-03"), true);
assert.equal(employeeScheduledOn([{ shiftTypes: [{ id: "morning" }], assignments: weekly }], "e1", "2026-09-03"), true);
assert.equal(employeeScheduledOn([{ shiftTypes: [{ id: "morning" }], assignments: weekly }], "e9", "2026-09-03"), false);
assert.equal(hasPublishedScheduleOn([{ shiftTypes: [{ id: "morning" }], assignments: weekly }], "2026-09-11"), false);
console.log("weekday rota calendar lookup: PASS");

const pinDraft = { stations: [{ name: "فرع الخفجي", lat: null, lng: null }] };
assert.equal(migratePreviewStationPins(pinDraft), true);
assert.equal(pinDraft.stations[0].lat, 28.4391);
assert.equal(migratePreviewStationPins(pinDraft), false);
console.log("preview station pins: PASS");

assert.equal(parsePunchClock("8:05"), "08:05");
assert.equal(parsePunchClock("25:00"), "");
assert.match(riyadhClockIso("2026-09-15", "08:15"), /2026-09-15T05:15:00.000Z/);
assert.equal(checkPunchRecordGate({
  type: "manual_punch",
  employee: { leaveRequests: [{ type: "annual", status: "approved", startDate: "2026-09-15", endDate: "2026-09-16" }] },
  date: "2026-09-15",
  time: "08:00",
  reason: "يدوي",
  requireTime: true,
}).error, "ON_APPROVED_LEAVE");
const checkoutLeave = checkPunchRecordGate({
  type: "checkout_fix",
  employee: { leaveRequests: [{ type: "annual", status: "approved", startDate: "2026-09-15", endDate: "2026-09-16" }] },
  date: "2026-09-15",
  time: "16:00",
  reason: "تصحيح",
  requireTime: true,
});
assert.equal(checkoutLeave.error, "ON_APPROVED_LEAVE");
assert.match(checkoutLeave.reason, /تصحيح الانصراف/);
assert.equal(checkPunchRecordGate({
  type: "manual_punch",
  employee: { profile: { birthDate: "2010-01-01" } },
  date: "2026-09-11",
  time: "08:00",
  reason: "يدوي",
  requireTime: true,
}).error, "JUVENILE_REST_BAN");
console.log("manual punch gates: PASS");

const attHere = dirname(fileURLToPath(import.meta.url));
const dailyDashSrc = readFileSync(join(attHere, "../src/components/attendance/AttendanceDailyDashboard.jsx"), "utf8");
const leaveQueueSrc = readFileSync(join(attHere, "../src/components/attendance/AttendanceLeaveRequests.jsx"), "utf8");
assert.doesNotMatch(dailyDashSrc, /approveLeave|setLeaveRequestStatus|setOtherRequestStatus/);
assert.match(dailyDashSrc, /الرد في طلباتي|requestReplyCopy/);
assert.doesNotMatch(leaveQueueSrc, /setLeaveRequestStatus|approveLeave|rejectLeave/);
assert.match(leaveQueueSrc, /الرد في طلباتي|requestReplyCopy/);
console.log("attendance leave reply stays in طلباتي: PASS");
