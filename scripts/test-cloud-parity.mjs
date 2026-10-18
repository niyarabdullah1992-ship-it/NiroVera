import assert from "node:assert/strict";
// The backend (base44/shared/*.ts) runs the same legal rules as the app for طلباتي.
import * as feRefusal from "../src/lib/statutoryRefusal.js";
import * as beRefusal from "../base44/shared/statutoryRefusal.ts";
import * as feRights from "../src/lib/rightsRequests.js";
import * as beRights from "../base44/shared/rightsRequests.ts";
import * as feExit from "../src/lib/exitRequests.js";
import * as beExit from "../base44/shared/resignationLaw.ts";
import { checkRejectLeaveGate, checkSubmitLeaveGate, checkApproveLeaveGate, leaveNeedsAttachment, leaveNeedsArticle118Ack, LEAVE_TYPES } from "../base44/shared/leaveDerivations.ts";

const cases = [
  [{ type: "sick", family: "leave" }, {}],
  [{ type: "sick", family: "leave" }, { ground: "report_unverifiable", verified: true }],
  [{ type: "document", docKind: "exp", family: "other" }, {}],
  [{ type: "art81_exit", family: "other" }, {}],
  [{ type: "night_avoid", family: "other" }, { ground: "no_need", verified: true }],
  [{ type: "advance", family: "other" }, {}],
];
for (const [row, opts] of cases) {
  assert.deepEqual(beRefusal.checkGroundedRefusalGate(row, { ...opts, actor: "manager" }).error, feRefusal.checkGroundedRefusalGate(row, { ...opts, actor: "manager" }).error, JSON.stringify(row));
}
assert.equal(beRights.damageObjectionDeadline("2026-10-01"), feRights.damageObjectionDeadline("2026-10-01"));
assert.deepEqual(beRights.ART81_CASES.map((c) => c.key), feRights.ART81_CASES.map((c) => c.key));
const onNotice = { profile: { contractExit: { party: "employer", effectiveDate: "2026-11-14" } }, leaveRequests: [] };
assert.equal(beRights.checkJobSearchDayGate({ employee: onNotice, startDate: "2026-10-20", endDate: "2026-10-20", today: "2026-10-15" }).ok, true);
const r = { id: "r", type: "resignation", status: "pending", date: "2026-10-01" };
for (const day of ["2026-10-05", "2026-10-09", "2026-10-31"]) {
  assert.deepEqual(beExit.resignationState(r, day), feExit.resignationState(r, day), day);
}
assert.deepEqual(beExit.checkPostponeResignationGate({ row: r, days: 45, reason: "تسليم المشروع الجاري أولاً", today: "2026-10-20" }), feExit.checkPostponeResignationGate({ row: r, days: 45, reason: "تسليم المشروع الجاري أولاً", today: "2026-10-20" }));

// Backend leave rules: grounds, per-event, job-search, no proof for annual.
assert.equal(checkRejectLeaveGate({ type: "sick" }, { nextStatus: "rejected", actor: "manager" }).error, "REFUSAL_GROUND_REQUIRED");
assert.equal(checkRejectLeaveGate({ type: "annual" }, { nextStatus: "rejected", actor: "manager" }).ok, true);
const past = [{ id: "a", type: "paternity", status: "approved", startDate: "2025-03-01", endDate: "2025-03-03", days: 3, eventDate: "2025-03-01" }];
const man = { hireDate: "2020-01-01", gender: "male", leaveRequests: past };
assert.equal(checkApproveLeaveGate({ id: "n", type: "paternity", startDate: "2026-10-10", endDate: "2026-10-12", days: 3, eventDate: "2026-10-09" }, { profile: man, requests: past, onDate: "2026-10-10" }).ok, true, "second child on the backend too");
assert.equal(leaveNeedsAttachment({ type: "annual", days: 9 }), false);
assert.equal(leaveNeedsArticle118Ack("job_search"), false);
assert.ok(LEAVE_TYPES.some((t) => t.key === "job_search") && LEAVE_TYPES.some((t) => t.key === "comp"));
assert.equal(checkSubmitLeaveGate({ type: "job_search", startDate: "2026-10-20", endDate: "2026-10-20", days: 1 }, { employee: { profile: {} }, profile: {}, requests: [], today: "2026-10-15" }).error, "NO_EMPLOYER_NOTICE");
console.log("cloud parity ok");
{
  const fe = await import("../src/lib/compLeave.js");
  const be = await import("../base44/shared/compLeaveBalance.ts");
  const worker = {
    otherRequests: [{ id: "ot6", type: "overtime", assignment: true, status: "approved", compensation: "credit", hours: 6, date: "2026-10-15", compHours: 9 }],
    leaveRequests: [{ id: "c1", type: "comp", status: "approved", startDate: "2026-10-20", endDate: "2026-10-20", days: 1 }],
  };
  for (const ask of [{ days: 1 }, { hours: 1 }, { hours: 2 }]) {
    const a = fe.checkTakeCompLeaveGate({ employee: worker, on: "2026-10-25", today: "2026-10-25", ...ask });
    const b = be.checkTakeCompLeaveGate({ employee: worker, on: "2026-10-25", ...ask });
    assert.equal(b.ok, a.ok, JSON.stringify(ask));
    assert.equal(b.error, a.error, JSON.stringify(ask));
  }
  console.log("comp balance parity ok");
}
{
  const fe = await import("../src/lib/overtimeAssignment.js");
  const be = await import("../base44/shared/otLimits.ts");
  const kid = { profile: { birthDate: "2010-01-01" } };
  const cases = [
    { date: "2026-10-20", hours: 3, article106: true },
    { date: "2026-10-20", hours: 2, article106: true },
    { date: "2026-10-20", hours: 1, employee: kid },
    { date: "2026-10-20", hours: 2, article106: true, otherRequests: [{ id: "x", type: "overtime", assignment: true, article106: true, status: "approved", hours: 6, date: "2026-10-19", dateTo: "2026-10-21" }, { id: "y", type: "overtime", assignment: true, article106: true, status: "approved", hours: 6, date: "2026-10-22", dateTo: "2026-10-24" }] },
  ];
  for (const c of cases) assert.equal(be.checkOtDayWeekGate(c).error, fe.checkOtDayWeekGate(c).error, JSON.stringify(c).slice(0, 80));
  const feR = await import("../src/lib/rightsRequests.js");
  const beR = await import("../base44/shared/rightsRequests.ts");
  const w = { profile: { contractExit: { party: "employer", effectiveDate: "2026-11-14" } }, leaveRequests: [], otherRequests: [{ id: "p1", type: "permission", jobSearch: true, status: "approved", date: "2026-10-19", time: "08:00", timeTo: "13:00" }] };
  for (const c of [{ time: "08:00", timeTo: "11:00" }, { time: "08:00", timeTo: "12:00" }]) {
    const args = { employee: w, date: "2026-10-21", today: "2026-10-15", ...c };
    assert.equal(beR.checkJobSearchHoursGate(args).error, feR.checkJobSearchHoursGate(args).error);
  }
  assert.equal(feR.checkJobSearchHoursGate({ employee: w, date: "2026-10-21", today: "2026-10-15", time: "08:00", timeTo: "12:00" }).error, "WEEK_HOURS_OVER", "5 h used + 4 h > 8 h (Art. 78)");
  assert.equal(feR.checkJobSearchHoursGate({ employee: w, date: "2026-10-21", today: "2026-10-15", time: "08:00", timeTo: "11:00" }).ok, true);
  assert.equal(feR.checkJobSearchDayGate({ employee: w, startDate: "2026-10-21", endDate: "2026-10-21", today: "2026-10-15" }).error, "WEEK_HOURS_USED", "a day or the hours, not both");
  console.log("ot limits + job-search hours parity ok");
}
