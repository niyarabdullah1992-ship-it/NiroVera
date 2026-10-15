import assert from "node:assert/strict";
import { checkApproveLeaveGate, checkRejectLeaveGate } from "../src/lib/leaveDerivations.js";
import { checkGroundedRefusalGate, refusalGroundsFor, refusalText } from "../src/lib/statutoryRefusal.js";
import { resignationState, checkPostponeResignationGate, checkWithdrawResignationGate, dueResignations } from "../src/lib/exitRequests.js";
import { checkRaiseOtAssignmentGate, checkManagerRejectOtGate } from "../src/lib/overtimeAssignment.js";
import { planLeaveCutForAttendance } from "../src/lib/leaveCut.js";

// Arts. 113/151 — a leave per event, not once per career.
const past = [{ id: "a", type: "paternity", status: "approved", startDate: "2025-03-01", endDate: "2025-03-03", days: 3, eventDate: "2025-03-01" }];
const man = { hireDate: "2020-01-01", gender: "male", leaveRequests: past };
const second = { id: "n", type: "paternity", startDate: "2026-10-10", endDate: "2026-10-12", days: 3, eventDate: "2026-10-09" };
assert.equal(checkApproveLeaveGate(second, false, { profile: man, requests: past, onDate: "2026-10-10" }).ok, true, "second child: paternity again");
const split = [...past, { id: "b", type: "paternity", status: "approved", startDate: "2026-10-10", endDate: "2026-10-11", days: 2, eventDate: "2026-10-09" }];
assert.equal(checkApproveLeaveGate({ id: "c", type: "paternity", startDate: "2026-10-12", endDate: "2026-10-13", days: 2, eventDate: "2026-10-09" }, false, { profile: man, requests: split, onDate: "2026-10-12" }).error, "LEAVE_BALANCE_EXCEEDED", "same birth: no more than 3 days");

// Art. 117 — sick leave is refused only on a ground, after checking.
const sick = { id: "s", type: "sick", status: "pending", startDate: "2026-10-01", endDate: "2026-10-02", days: 2 };
assert.equal(checkRejectLeaveGate(sick, { nextStatus: "rejected", actor: "manager" }).error, "REFUSAL_GROUND_REQUIRED");
assert.equal(checkRejectLeaveGate(sick, { nextStatus: "rejected", actor: "manager", rejectGround: "work_pressure" }).error, "REFUSAL_GROUND_REQUIRED");
assert.equal(checkRejectLeaveGate(sick, { nextStatus: "rejected", actor: "manager", rejectGround: "report_unverifiable" }).error, "REFUSAL_VERIFY_REQUIRED");
assert.equal(checkRejectLeaveGate(sick, { nextStatus: "rejected", actor: "manager", rejectGround: "report_unverifiable", rejectVerified: true }).ok, true);
assert.equal(checkRejectLeaveGate({ ...sick, type: "annual" }, { nextStatus: "rejected", actor: "manager" }).ok, true, "annual timing stays the employer's");
assert.match(refusalText({ ...sick, family: "leave" }, "dates_mismatch", "التقرير ليومين فقط"), /لا تطابق المستند — التقرير ليومين فقط/);
// Art. 154 nursing hour, pregnancy notice, Art. 64 certificate.
assert.equal(checkGroundedRefusalGate({ type: "nursing_hour", family: "other" }, { actor: "manager" }).error, "REFUSAL_GROUND_REQUIRED");
assert.equal(checkGroundedRefusalGate({ type: "pregnancy_notice", family: "other" }, { actor: "manager", ground: "x", verified: true }).error, "NOT_REFUSABLE");
assert.equal(checkGroundedRefusalGate({ type: "document", docKind: "exp", family: "other" }, { actor: "manager" }).error, "NOT_REFUSABLE");
assert.equal(checkGroundedRefusalGate({ type: "document", docKind: "bank", family: "other" }, { actor: "manager" }).ok, true);
assert.equal(refusalGroundsFor({ type: "advance", family: "other" }), null);

// Art. 79 bis — resignation.
const r = { id: "r1", type: "resignation", status: "pending", date: "2026-10-01" };
assert.equal(resignationState(r, "2026-10-05").deemedAcceptedOn, "2026-10-31");
assert.equal(checkWithdrawResignationGate(r, "2026-10-08").ok, true);
assert.equal(checkWithdrawResignationGate(r, "2026-10-09").error, "WITHDRAW_CLOSED");
assert.equal(checkPostponeResignationGate({ row: r, days: 61, reason: "تسليم المشروع الجاري أولاً", today: "2026-10-20" }).error, "POSTPONE_DAYS");
assert.equal(checkPostponeResignationGate({ row: r, days: 45, reason: "قصير", today: "2026-10-20" }).error, "POSTPONE_REASON");
assert.equal(checkPostponeResignationGate({ row: r, days: 45, reason: "تسليم المشروع الجاري أولاً", today: "2026-10-20" }).until, "2026-12-04", "counted from the explanation date");
assert.equal(checkPostponeResignationGate({ row: r, days: 10, reason: "تسليم المشروع الجاري أولاً", today: "2026-10-31" }).error, "POSTPONE_CLOSED");
assert.equal(checkPostponeResignationGate({ row: { ...r, postponedUntil: "2026-11-20" }, days: 10, reason: "تسليم المشروع الجاري أولاً", today: "2026-10-20" }).error, "POSTPONE_CLOSED", "once only");
const due = dueResignations({ employees: [{ id: "e", otherRequests: [r, { ...r, id: "r2", postponedUntil: "2026-12-04" }] }] }, "2026-10-31");
assert.deepEqual(due.map((x) => [x.requestId, x.via]), [["r1", "silence"]]);
assert.equal(dueResignations({ employees: [{ id: "e", otherRequests: [{ ...r, id: "r2", postponedUntil: "2026-12-04" }] }] }, "2026-12-04")[0].via, "postponement");

// Art. 106 — 10 h a day / 60 a week even in its cases; Art. 164 juveniles; Art. 107 worked hours.
const file = { name: "a.pdf", size: 2400, url: "data:application/pdf,ok", hash: "AA11" };
const base = { reason: "حريق", date: "2026-10-20", article106: true, article106Ground: "danger", manager106Ack: true, files: [file], otherRequests: [] };
assert.equal(checkRaiseOtAssignmentGate({ ...base, hours: 3 }).error, "ART106_DAY_CAP");
assert.equal(checkRaiseOtAssignmentGate({ ...base, hours: 2 }).ok, true);
assert.equal(checkRaiseOtAssignmentGate({ ...base, hours: 2, otherRequests: [
  { id: "x", type: "overtime", assignment: true, article106: true, status: "approved", hours: 6, date: "2026-10-18", dateTo: "2026-10-20" },
  { id: "y", type: "overtime", assignment: true, article106: true, status: "approved", hours: 6, date: "2026-10-21", dateTo: "2026-10-23" },
] }).error, "ART106_WEEK_CAP");
assert.equal(checkRaiseOtAssignmentGate({ ...base, hours: 2, article106Ground: "pressure", otherRequests: [] }).ok, true, "unusual pressure: no 30-day cap");
assert.equal(checkRaiseOtAssignmentGate({ reason: "عمل", date: "2026-10-20", hours: 1, employee: { birthDate: "2010-01-01", profile: { birthDate: "2010-01-01" } }, otherRequests: [] }).error, "JUVENILE_NO_OT");
assert.equal(checkManagerRejectOtGate({ type: "overtime", assignment: true, employeeAck: true, date: "2026-10-01" }, "rejected", "2026-10-15").error, "OT_ALREADY_WORKED");
assert.equal(checkManagerRejectOtGate({ type: "overtime", assignment: true, employeeAck: true, date: "2026-10-20" }, "rejected", "2026-10-15").ok, true);

// At work on a leave day: cut from that day; never in Art. 151's six weeks.
const worker = { leaveRequests: [{ id: "L", type: "annual", status: "approved", startDate: "2026-10-12", endDate: "2026-10-20", days: 9 }] };
const cut = planLeaveCutForAttendance(worker, "2026-10-15");
assert.deepEqual([cut.ok, cut.newEnd, cut.keptDays, cut.freedDays], [true, "2026-10-14", 3, 6]);
assert.equal(planLeaveCutForAttendance(worker, "2026-10-12").whole, true);
const mother = { leaveRequests: [{ id: "M", type: "maternity", status: "approved", startDate: "2026-10-01", endDate: "2026-12-23", days: 84, eventDate: "2026-10-05" }] };
assert.equal(planLeaveCutForAttendance(mother, "2026-10-20").error, "MATERNITY_MANDATORY");
assert.equal(planLeaveCutForAttendance(mother, "2026-11-20").ok, true);
console.log("statutory requests ok");
// Review fixes: chargeable days on a cut; "revise" resignations still run their 30 days; carry with no balance figure.
{
  const { planLeaveCutForAttendance } = await import("../src/lib/leaveCut.js");
  const w = { leaveRequests: [{ id: "L", type: "annual", status: "approved", startDate: "2026-10-12", endDate: "2026-10-20", days: 7 }] };
  const plan = planLeaveCutForAttendance(w, "2026-10-15", { chargeable: (a, b) => (a === "2026-10-12" ? 3 : 4) });
  assert.deepEqual([plan.keptDays, plan.freedDays], [3, 4]);
  const { dueResignations } = await import("../src/lib/exitRequests.js");
  assert.equal(dueResignations({ employees: [{ id: "e", otherRequests: [{ id: "rv", type: "resignation", status: "revise", date: "2026-09-01" }] }] }, "2026-10-15").length, 1);
  const { checkLeaveCarryGate } = await import("../src/lib/rightsRequests.js");
  assert.equal(checkLeaveCarryGate({ days: 2, remaining: null, reason: "سفر" }).ok, true);
  console.log("review fixes ok");
}
