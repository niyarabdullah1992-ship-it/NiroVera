import assert from "node:assert/strict";
// Labour Law Implementing Regulations (decision 115921, 1446H) — the pieces طلباتي applies.
import { checkOtAnnualCapGate } from "../src/lib/overtimeAssignment.js";
import { overtimeYearUsageOutsideAssignments } from "../src/lib/attendanceDerivations.js";
import { sickStatutoryYearWindow } from "../src/lib/leaveTypes.js";
import { planAnnualPauseForSick, checkIddahBirthGate, checkSubmitLeaveGate, leaveNeedsAttachment, checkApproveLeaveGate, LEAVE_TYPES } from "../src/lib/leaveDerivations.js";
import * as be from "../base44/shared/leaveDerivations.ts";
import { checkDutyRequestFields, nursingRightUntil } from "../src/lib/dutyRequests.js";
import { checkGrievanceGate, grievanceState, grievanceFileDeadline, GRIEVANCE_TYPE, RIGHTS_REQUESTS } from "../src/lib/rightsRequests.js";
import * as beRights from "../base44/shared/rightsRequests.ts";
import { refusalGroundsFor } from "../src/lib/statutoryRefusal.js";
import { gosiTasks } from "../src/lib/gosiFollowUp.js";

// Art. 22 — the 720 hours count every overtime hour once: assignments plus other decisions, summed.
{
  const decisions = {
    "e1:2026-02-01": { decision: "pay", overtimeMinutes: 600 * 60 },
    "e1:2026-03-01": { decision: "comp_leave", overtimeMinutes: 60 * 60 },
    "e1:2026-04-01": { decision: "pay", overtimeMinutes: 40 * 60, source: "ot_assignment" },
  };
  const outside = overtimeYearUsageOutsideAssignments(decisions, "e1", "2026-05-01");
  assert.equal(outside.hours, 660, "assignment-stamped decisions are not counted twice; comp-leave hours count");
  const assignments = [{ id: "a1", type: "overtime", assignment: true, status: "approved", compensation: "pay", hours: 40, date: "2026-04-01" }];
  const gate = checkOtAnnualCapGate({ hours: 30, date: "2026-05-01", otherRequests: assignments, overtimeHoursOutsideYtd: outside.hours });
  assert.equal(gate.used, 700, "summed, not the larger of the two");
  assert.equal(gate.error, "OT_ANNUAL_CAP", "700 + 30 is over 720");
}

// Art. 41 — the sick year restarts at the first sick leave after the previous year ends.
{
  const reqs = [
    { type: "sick", status: "approved", startDate: "2025-01-10", endDate: "2025-01-12" },
    { type: "sick", status: "approved", startDate: "2026-03-01", endDate: "2026-03-03" },
  ];
  assert.deepEqual(sickStatutoryYearWindow(reqs, "2026-03-02"), { start: "2026-03-01", end: "2027-02-28" });
  assert.deepEqual(sickStatutoryYearWindow(reqs, "2025-06-01"), { start: "2025-01-10", end: "2026-01-09" });
}

// Art. 41 — sick days inside annual leave pause it; the rest resumes after.
{
  const plan = planAnnualPauseForSick({ type: "annual", startDate: "2026-11-01", endDate: "2026-11-20" }, { type: "sick", startDate: "2026-11-06", endDate: "2026-11-10" });
  assert.deepEqual(plan.keep, { startDate: "2026-11-01", endDate: "2026-11-05", days: 5 });
  assert.deepEqual(plan.resume, { startDate: "2026-11-11", endDate: "2026-11-25", days: 15 });
  assert.deepEqual(be.planAnnualPauseForSick({ type: "annual", startDate: "2026-11-01", endDate: "2026-11-20" }, { type: "sick", startDate: "2026-11-06", endDate: "2026-11-10" }), plan);
  assert.equal(planAnnualPauseForSick({ type: "annual", startDate: "2026-11-01", endDate: "2026-11-20" }, { type: "sick", startDate: "2026-12-01", endDate: "2026-12-02" }), null);
}

// Art. 41 — the company doctor's report counts too.
assert.match(refusalGroundsFor({ type: "sick", family: "leave" }).find((g) => g.key === "not_accredited").ar, /طبيب المنشأة/);

// Art. 31 — nursing: one period at start or end without a nursery; 24 months from birth.
{
  const base = { type: "nursing_hour", reason: "رضاعة", date: "2026-10-14", childBirthDate: "2026-06-01" };
  assert.equal(checkDutyRequestFields({ ...base, nursingSplit: { start: 30, mid: 0, end: 30 } }).error, "NURSING_NO_NURSERY_SPLIT");
  assert.equal(checkDutyRequestFields({ ...base, nurseryOnSite: true, nursingSplit: { start: 20, mid: 20, end: 20 } }).ok, true);
  assert.equal(nursingRightUntil("2026-06-01"), "2028-05-31");
}

// Art. 40(5) — the birth ends a pregnant widow's iddah.
{
  const iddah = { id: "i1", type: "iddah", status: "approved", startDate: "2026-09-01", endDate: "2027-01-08", eventDate: "2026-09-01" };
  const g = checkIddahBirthGate(iddah, "2026-10-20");
  assert.equal(g.ok, true);
  assert.equal(g.endDate, "2026-10-19");
  assert.equal(checkIddahBirthGate(iddah, "2026-08-01").error, "BIRTH_BEFORE_IDDAH");
  assert.deepEqual(be.checkIddahBirthGate(iddah, "2026-10-20"), g);
  const muslimWidow = { gender: "female", religion: "مسلم", hireDate: "2020-01-01" };
  const filedAfterBirth = { id: "i2", type: "iddah", attachment: { name: "death.pdf", url: "data:x", hash: "h", size: 3 }, files: [{ name: "death.pdf", url: "data:x", hash: "h", size: 3 }], startDate: "2026-09-01", endDate: "2026-10-19", eventDate: "2026-09-01", iddahBirthDate: "2026-10-20", days: 49 };
  assert.equal(checkApproveLeaveGate(filedAfterBirth, false, { profile: muslimWidow, requests: [], onDate: "2026-10-21" }).error, undefined, "ending at birth is not under the minimum");
  assert.equal(checkApproveLeaveGate({ ...filedAfterBirth, endDate: "2026-11-01" }, false, { profile: muslimWidow, requests: [], onDate: "2026-10-21" }).error, "IDDAH_AFTER_BIRTH");
}

// Art. 42 — dialysis: paid, per session day, with the provider's report.
{
  assert.ok(LEAVE_TYPES.some((t) => t.key === "dialysis") && be.LEAVE_TYPES.some((t) => t.key === "dialysis"));
  assert.equal(leaveNeedsAttachment({ type: "dialysis", days: 1 }), true);
  const g = checkSubmitLeaveGate({ type: "dialysis", startDate: "2026-10-20", endDate: "2026-10-21", days: 2 }, { profile: { hireDate: "2020-01-01" }, requests: [] });
  assert.equal(g.error, "DIALYSIS_ONE_DAY");
  assert.ok(refusalGroundsFor({ type: "dialysis", family: "leave" }).length >= 2);
}

// Art. 71 — grievance: 30 days to file (holidays aside), 15 to answer, then 30 for the court.
{
  assert.ok(RIGHTS_REQUESTS.some((r) => r.key === GRIEVANCE_TYPE));
  const holidays = new Set(["2026-09-23"]);
  const isHoliday = (iso) => holidays.has(iso);
  assert.equal(grievanceFileDeadline("2026-09-01", isHoliday), "2026-10-02", "a holiday does not count");
  assert.equal(grievanceFileDeadline("2026-09-01"), "2026-10-01");
  assert.equal(checkGrievanceGate({ notifiedOn: "2026-09-01", grievanceKind: "penalty", reason: "خصم يومين دون تحقيق معي", today: "2026-10-02", isHoliday }).ok, true);
  assert.equal(checkGrievanceGate({ notifiedOn: "2026-09-01", grievanceKind: "penalty", reason: "خصم يومين دون تحقيق معي", today: "2026-10-03", isHoliday }).error, "GRIEVANCE_LATE");
  assert.equal(checkGrievanceGate({ notifiedOn: "2026-10-01", reason: "خصم يومين دون تحقيق معي", today: "2026-10-03" }).error, "GRIEVANCE_KIND_REQUIRED");
  const row = { type: GRIEVANCE_TYPE, status: "pending", date: "2026-10-01", grievanceReplyBy: "2026-10-16" };
  assert.equal(grievanceState(row, "2026-10-10").stage, "pending");
  assert.deepEqual(grievanceState(row, "2026-10-17"), { stage: "overdue", replyBy: "2026-10-16", courtBy: "2026-11-15" });
  assert.equal(grievanceState({ ...row, status: "rejected", reviewedAt: "2026-10-05T09:00:00Z" }, "2026-10-06").courtBy, "2026-11-04");
  assert.deepEqual(beRights.grievanceState(row, "2026-10-17"), grievanceState(row, "2026-10-17"));
}

// Art. 28 — outside GOSI's hazards branch the labour office is told within a week.
{
  const employees = [{ id: "w1", name: "عامل", profile: {}, leaveRequests: [{ id: "l", type: "work_injury", status: "approved", startDate: "2026-10-10", endDate: "2026-10-12", injuryDate: "2026-10-10" }] }];
  const off = gosiTasks({ employees, company: {}, today: "2026-10-12", injuryCovered: false }).filter((t) => t.kind.startsWith("injury"));
  assert.deepEqual(off.map((t) => [t.kind, t.due]), [["injury_office", "2026-10-17"]]);
  const on = gosiTasks({ employees, company: {}, today: "2026-10-12", injuryCovered: true }).filter((t) => t.kind.startsWith("injury"));
  assert.deepEqual(on.map((t) => t.kind), ["injury"]);
}

console.log("implementing regulations ok");
