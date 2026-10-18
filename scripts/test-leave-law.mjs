// Leave-law gaps (Arts. 75, 79 bis, 82, 109–111, 114, 116, 118, 151; Regs Art. 25, Annex 2; Model regulation Art. 33).
import assert from "node:assert/strict";
import {
  annualAdvanceCap,
  annualBalanceBuckets,
  annualBalanceSplit,
  annualCarryAlerts,
  effectiveServiceYears,
  leaveTypesForProfile,
  statutoryLeaveFloor,
  leaveCiteRuleId,
  therapyLeaveEligibility,
  unpaidSuspensionDays,
  unpaidSuspensionPlan,
  unusedAnnualDaysAtExit,
} from "../src/lib/leaveTypes.js";
import {
  checkAnnualAdvanceGate,
  checkApproveLeaveGate,
  checkJoinAnnualToSickGate,
  checkLeaveBreachGate,
  checkLeaveOverlapGate,
  checkMaternityBirthGate,
  checkSubmitLeaveGate,
  hajjSeasonApprovedCount,
  hajjSeasonSpan,
  CHAPTER_LEAVE_TYPES,
} from "../src/lib/leaveDerivations.js";
import { deriveEos } from "../src/lib/offboardingDerivations.js";
import {
  checkPostponeResignationGate,
  checkWithdrawResignationGate,
  dueResignations,
  EXIT_ROUTE_79BIS,
  EXIT_ROUTE_NOTICE75,
  resignationFacts,
  resignationRouteFor,
  resignationState,
} from "../src/lib/exitRequests.js";
import * as ts from "../base44/shared/leaveDerivations.ts";
import * as tsResign from "../base44/shared/resignationLaw.ts";

const approvedAnnual = (id, startDate, endDate) => ({ id, type: "annual", status: "approved", startDate, endDate });

// ── 1. Arts. 110/111 — FIFO buckets: carried days survive spending in a later year ──
{
  const profile = { hireDate: "2023-01-01" };
  // 2023 year: nothing taken. 2024 year: 21 work days taken (Sun–Thu x ~4 weeks + 1).
  const used2024 = approvedAnnual("a1", "2024-03-03", "2024-04-01"); // 30 calendar days → 22 work days
  const buckets = annualBalanceBuckets(profile, [used2024], "2025-06-01");
  assert.equal(buckets.length, 3);
  assert.deepEqual(buckets.map((b) => b.start), ["2023-01-01", "2024-01-01", "2025-01-01"]);
  // FIFO: the 2024 leave consumed the OLDER 2023 bucket first.
  assert.ok(buckets[0].used > 0 && buckets[0].used <= 21, "oldest year consumed first");
  const totalUsed = buckets.reduce((n, b) => n + b.used, 0);
  const totalLeft = buckets.reduce((n, b) => n + b.left, 0);
  assert.equal(totalUsed + totalLeft, 63, "three years of 21 — nothing lost");
  const split = annualBalanceSplit(profile, [used2024], "2025-06-01");
  assert.equal(split.remaining, 63 - totalUsed);
  assert.equal(split.currentLeft, 21);
  // Old bug: the 2023 days vanished once 2024 leave was spent. Now they are still in the balance.
  assert.equal(split.carryLeft, 42 - totalUsed, "what the 2024 leave did not use of 2023 + 2024 stays carried");
  assert.equal(buckets[0].left, 0);
  assert.equal(buckets[1].left, 42 - totalUsed, "the 2024 bucket keeps its days — the old code lost them");
  assert.equal(buckets[0].status, "overdue");
  assert.equal(buckets[1].status, "carried");
  assert.equal(buckets[1].deadline, "2025-12-31", "Art. 110(2): not beyond the end of the following year");
  // Backend twin agrees.
  assert.equal(ts.annualBalanceSplit(profile, [used2024], "2025-06-01").remaining, split.remaining);
}

// Art. 111 at exit: every untaken year + pro-rata of the last one.
{
  const profile = { hireDate: "2022-01-01" };
  const exitDays = unusedAnnualDaysAtExit(profile, [], "2024-07-01");
  // 2022 + 2023 full (42) + 2024 pro-rata 21 × 183/366.
  assert.equal(Math.round(exitDays * 10) / 10, Math.round((42 + 21 * 183 / 366) * 10) / 10);
  assert.equal(ts.unusedAnnualDaysAtExit(profile, [], "2024-07-01"), exitDays);
  const taken = unusedAnnualDaysAtExit(profile, [approvedAnnual("x", "2024-08-01", "2024-08-30")], "2024-07-01");
  assert.equal(taken, exitDays, "leave after the exit day does not reduce the payout");
  // deriveEos reads the leave record when it covers the service (an annual request on file here).
  // Updated deliberately (review fix 4): an EMPTY leave array no longer counts as a record.
  const now = new Date(2024, 6, 1, 12).getTime();
  const eos = deriveEos({ hireDate: "2022-01-01", base: 3000, allowances: 0, leaveRequests: [approvedAnnual("x", "2024-08-01", "2024-08-30")], profile: { hireDate: "2022-01-01" } }, now);
  assert.equal(eos.unusedAnnualDays, Math.round(exitDays * 10) / 10);
  const legacy = deriveEos({ hireDate: "2022-01-01", base: 3000, allowances: 0, annualLeaveUsed: 0 }, now);
  assert.ok(legacy.unusedAnnualDays < eos.unusedAnnualDays, "without a leave record the old single-year figure stays");
}

// ── 2. Art. 116 + Regs Art. 25 — unpaid beyond 20 days suspends the contract ──
{
  const hire = "2020-01-01";
  const unpaid = [
    { id: "u1", type: "unpaid", status: "approved", startDate: "2024-02-01", endDate: "2024-02-15" }, // 15
    { id: "u2", type: "unpaid", status: "approved", startDate: "2024-03-01", endDate: "2024-03-20" }, // 20 → cumulative 35 → 15 suspended
  ];
  const plan = unpaidSuspensionPlan(unpaid, hire);
  assert.equal(plan.days.length, 15, "cumulative in the work year: 35 − 20");
  assert.equal(plan.byRequest.u2.days, 15);
  assert.equal(plan.byRequest.u2.from, "2024-03-06");
  assert.equal(unpaidSuspensionDays(unpaid, "2024-01-01", "2024-12-31", hire), 15);
  assert.equal(unpaidSuspensionDays([{ ...unpaid[1], agreedOtherwise: true }, unpaid[0]], "2024-01-01", "2024-12-31", hire), 0, "agreed otherwise → no suspension");
  // (a) service time: the 5-year step slides by the suspended days.
  const profile = { hireDate: hire };
  const big = [{ id: "u3", type: "unpaid", status: "approved", startDate: "2022-01-01", endDate: "2022-04-30" }]; // 120 days → 100 suspended
  assert.equal(statutoryLeaveFloor("annual", profile, "2025-02-01", []), 30);
  assert.equal(statutoryLeaveFloor("annual", profile, "2025-02-01", big), 21, "suspended days do not count toward five years");
  assert.ok(effectiveServiceYears(profile, big, "2025-02-01") < 5);
  // Accrual: the year with 100 suspended days earns less.
  const b = annualBalanceBuckets(profile, big, "2022-06-01");
  const y2022 = b.find((row) => row.start === "2022-01-01");
  assert.equal(y2022.entitled, Math.round(21 * (365 - 100) / 365 * 100) / 100);
  // Gate warning names the suspension.
  const gate = checkApproveLeaveGate(
    { id: "new", type: "unpaid", status: "pending", startDate: "2024-03-01", endDate: "2024-03-20", noOtherEmployerAck: true, files: [{ name: "a.pdf", url: "x" }] },
    { profile: { hireDate: hire }, requests: [unpaid[0]] },
  );
  assert.equal(gate.ok, true);
  assert.equal(gate.warning, "CONTRACT_SUSPENDED");
  assert.equal(gate.suspension.days, 15);
  const tsGate = ts.checkApproveLeaveGate(
    { id: "new", type: "unpaid", status: "pending", startDate: "2024-03-01", endDate: "2024-03-20", noOtherEmployerAck: true, files: [{ name: "a.pdf", url: "x" }] },
    { profile: { hireDate: hire }, requests: [unpaid[0]] },
  );
  assert.equal(tsGate.suspension.days, 15);
}

// Hajj two-year condition excludes suspended days.
{
  const profile = { hireDate: "2024-05-01", religion: "muslim", gender: "male" };
  const suspended = [{ id: "s", type: "unpaid", status: "approved", startDate: "2025-01-01", endDate: "2025-03-31" }];
  const hajj = { id: "h", type: "hajj", status: "pending", startDate: "2026-05-22", endDate: "2026-05-31", files: [{ name: "a.pdf", url: "x" }], noOtherEmployerAck: true };
  assert.equal(checkApproveLeaveGate(hajj, { profile, requests: [] }).ok, true);
  assert.equal(checkApproveLeaveGate(hajj, { profile, requests: suspended }).error, "HAJJ_SERVICE");
}

// ── 3. Art. 151(1) — late birth: the missing post-birth weeks are unpaid, never refused ──
{
  const mat = { id: "m", type: "maternity", status: "approved", startDate: "2026-08-04", endDate: "2026-10-26", eventDate: "2026-09-01", expectedBirthDate: "2026-09-01" };
  // Born 30 days late: post-birth six weeks run to 2026-11-11; paid twelve weeks end 2026-10-26.
  const late = checkMaternityBirthGate(mat, "2026-10-01");
  assert.equal(late.ok, true);
  assert.equal(late.startDate, "2026-08-04");
  assert.equal(late.postBirthEnd, "2026-11-11");
  assert.equal(late.endDate, "2026-11-11");
  assert.equal(late.unpaidComplementFrom, "2026-10-27");
  assert.equal(late.unpaidComplementDays, 16);
  assert.equal(late.paidDays, 84);
  // On time: nothing unpaid.
  assert.equal(checkMaternityBirthGate(mat, "2026-09-01").unpaidComplementDays, 0);
  // Early birth before the leave start: the leave starts on the birth.
  const early = checkMaternityBirthGate({ ...mat, startDate: "2026-08-25", endDate: "2026-11-16" }, "2026-08-20");
  assert.equal(early.startDate, "2026-08-20");
  assert.equal(early.unpaidComplementDays, 0);
  assert.equal(checkMaternityBirthGate({ ...mat, status: "pending" }, "2026-09-01").error, "NOT_APPROVED");
  assert.equal(checkMaternityBirthGate({ ...mat, actualBirthDate: "2026-09-01" }, "2026-09-02").error, "BIRTH_ALREADY");
  assert.deepEqual(ts.checkMaternityBirthGate(mat, "2026-10-01"), late);
}

// ── 4. Art. 110(1) carry alerts — flagged, never silently dropped ──
{
  const profile = { hireDate: "2025-01-01" };
  const alerts = annualCarryAlerts(profile, [], "2026-11-15");
  assert.ok(alerts.some((a) => a.kind === "expiring" && a.deadline === "2026-12-31" && /تنتهي في/.test(a.ar)));
  assert.ok(alerts.some((a) => a.kind === "unagreed" && /مؤجلة دون موافقة/.test(a.ar)));
  const agreed = { ...profile, leaveCarryAgreed: [{ days: 21, at: "2025-11-01T00:00:00Z" }] };
  assert.ok(!annualCarryAlerts(agreed, [], "2026-11-15").some((a) => a.kind === "unagreed"), "approved carry covers the days");
  assert.ok(!annualCarryAlerts(profile, [], "2026-06-01").some((a) => a.kind === "expiring"), "no «تنتهي في» before 60 days");
  const overdue = annualCarryAlerts(profile, [], "2027-03-01");
  assert.ok(overdue.some((a) => a.kind === "overdue" && /ما زالت مستحقة/.test(a.ar)), "past the limit: still owed, schedule");
  assert.equal(annualBalanceSplit(profile, [], "2027-03-01").carryLeft, 42, "no silent lapse");
}

// ── 5. Art. 75 vs Art. 79 bis — open-ended contract ends on notice ──
{
  assert.equal(resignationRouteFor({ contractType: "indefinite" }), EXIT_ROUTE_NOTICE75);
  assert.equal(resignationRouteFor({ contractType: "غير محدد المدة" }), EXIT_ROUTE_NOTICE75);
  assert.equal(resignationRouteFor({ contractType: "fixed" }), EXIT_ROUTE_79BIS);
  assert.equal(resignationRouteFor({}), EXIT_ROUTE_79BIS);
  const f = resignationFacts({ date: "2026-10-01", route: EXIT_ROUTE_NOTICE75 });
  assert.equal(f.noticeEndsOn, "2026-10-31");
  assert.equal(f.deemedAcceptedOn, "");
  const row = { type: "resignation", exitRoute: EXIT_ROUTE_NOTICE75, date: "2026-10-01", lastDay: "2026-10-31", status: "pending" };
  const st = resignationState(row, "2026-10-10");
  assert.equal(st.stage, "notice");
  assert.equal(st.canPostpone, false);
  assert.equal(checkPostponeResignationGate({ row, days: 10, reason: "حاجة العمل الملحة", today: "2026-10-10" }).error, "NOTICE75_NO_POSTPONE");
  assert.equal(checkWithdrawResignationGate(row, "2026-10-02").error, "NOTICE75_WITHDRAW");
  assert.equal(resignationState(row, "2026-10-31").stage, "due");
  const due = dueResignations({ employees: [{ id: "e", otherRequests: [{ ...row, id: "r" }] }] }, "2026-10-31");
  assert.deepEqual(due, [{ employeeId: "e", requestId: "r", endsOn: "2026-10-31", via: "notice75" }]);
  const acknowledged = dueResignations({ employees: [{ id: "e", otherRequests: [{ ...row, id: "r", status: "approved" }] }] }, "2026-10-31");
  assert.equal(acknowledged.length, 1, "acknowledged notice still ends the contract at its end");
  // Fixed-term keeps Art. 79 bis.
  const fixed = { type: "resignation", date: "2026-10-01", status: "pending" };
  assert.equal(resignationState(fixed, "2026-10-10").canPostpone, true);
  assert.equal(tsResign.resignationRouteFor({ contractType: "indefinite" }), EXIT_ROUTE_NOTICE75);
  assert.equal(tsResign.resignationState(row, "2026-10-10").stage, "notice");
}

// ── 6. Overlap — two leaves may not cover the same day ──
{
  const live = [{ id: "a", type: "annual", status: "approved", startDate: "2026-11-01", endDate: "2026-11-10" }];
  assert.equal(checkLeaveOverlapGate({ id: "b", type: "emergency", startDate: "2026-11-05", endDate: "2026-11-06" }, { requests: live }).error, "LEAVE_OVERLAP");
  assert.equal(checkLeaveOverlapGate({ id: "b", type: "sick", startDate: "2026-11-05", endDate: "2026-11-06" }, { requests: live }).ok, true, "sick inside annual is the Model regulation Art. 41 pause");
  assert.equal(checkLeaveOverlapGate({ id: "b", type: "annual", startDate: "2026-11-11", endDate: "2026-11-12" }, { requests: live }).ok, true);
  assert.equal(checkLeaveOverlapGate({ id: "b", type: "maternity", startDate: "2026-11-05", endDate: "2026-12-30" }, { requests: [{ ...live[0], type: "iddah" }] }).ok, true, "iddah ↔ maternity (Model regulation Art. 40(5))");
  assert.equal(checkLeaveOverlapGate({ id: "b", type: "emergency", startDate: "2026-11-05", endDate: "2026-11-06" }, { requests: [{ ...live[0], status: "rejected" }] }).ok, true);
  assert.equal(checkLeaveOverlapGate({ id: "b", type: "emergency", startDate: "2026-11-05", endDate: "2026-11-06" }, { requests: [{ ...live[0], status: "pending" }] }).error, "LEAVE_OVERLAP");
  const submit = checkSubmitLeaveGate(
    { type: "marriage", startDate: "2026-11-05", endDate: "2026-11-09", eventDate: "2026-11-05", noOtherEmployerAck: true, days: 5 },
    { profile: { hireDate: "2020-01-01" }, requests: live },
  );
  assert.equal(submit.error, "LEAVE_OVERLAP");
  assert.equal(ts.checkLeaveOverlapGate({ id: "b", type: "emergency", startDate: "2026-11-05", endDate: "2026-11-06" }, { requests: live }).error, "LEAVE_OVERLAP");
}

// ── 7. Regs Annex 2 — therapy leave ──
{
  assert.ok(CHAPTER_LEAVE_TYPES.includes("therapy"));
  assert.equal(therapyLeaveEligibility({}), "unknown");
  assert.equal(therapyLeaveEligibility({ disability: true }), "yes");
  assert.equal(therapyLeaveEligibility({ disability: false }), "no");
  assert.ok(leaveTypesForProfile({ gender: "male" }).some((t) => t.key === "therapy"), "no flag on file → shown with a note");
  assert.ok(!leaveTypesForProfile({ gender: "male", disability: false }).some((t) => t.key === "therapy"));
  const noFile = checkApproveLeaveGate({ type: "therapy", status: "pending", startDate: "2026-11-02", endDate: "2026-11-02", files: [] }, { profile: { hireDate: "2020-01-01" }, requests: [] });
  assert.equal(noFile.error, "ATTACHMENT_REQUIRED", "the medical report is required");
  assert.equal(checkApproveLeaveGate({ type: "therapy", status: "pending", startDate: "2026-11-02", endDate: "2026-11-03", files: [{ name: "r.pdf", url: "x" }] }, { profile: { hireDate: "2020-01-01" }, requests: [] }).ok, true);
  assert.ok(ts.CHAPTER_LEAVE_TYPES.includes("therapy"));
}

// ── 8. Art. 114 — Hajj includes Eid al-Adha; employer quota per season ──
{
  const span = hajjSeasonSpan("2026-05-20");
  assert.deepEqual([span.from, span.to], ["2026-05-26", "2026-05-29"]);
  const profile = { hireDate: "2020-01-01", religion: "muslim", gender: "male" };
  const base = { id: "h1", type: "hajj", status: "pending", files: [{ name: "a.pdf", url: "x" }], noOtherEmployerAck: true };
  assert.equal(checkApproveLeaveGate({ ...base, startDate: "2026-06-01", endDate: "2026-06-10" }, { profile, requests: [] }).error, "HAJJ_EID_ADHA");
  assert.equal(checkApproveLeaveGate({ ...base, startDate: "2026-05-27", endDate: "2026-06-05" }, { profile, requests: [] }).error, "HAJJ_EID_ADHA", "must hold every Eid day");
  assert.equal(checkApproveLeaveGate({ ...base, startDate: "2026-05-22", endDate: "2026-05-31" }, { profile, requests: [] }).ok, true);
  const others = [{ id: "o", leaveRequests: [{ id: "x", type: "hajj", status: "approved", startDate: "2026-05-20", endDate: "2026-05-30" }] }];
  assert.equal(hajjSeasonApprovedCount(others, "2026-05-26"), 1);
  const company = { leavePolicy: { hajjAnnualQuota: 1 }, employees: others };
  assert.equal(checkApproveLeaveGate({ ...base, startDate: "2026-05-22", endDate: "2026-05-31" }, { profile, requests: [], company }).error, "HAJJ_QUOTA");
  assert.equal(checkApproveLeaveGate({ ...base, startDate: "2026-05-22", endDate: "2026-05-31" }, { profile, requests: [], company: { ...company, leavePolicy: { hajjAnnualQuota: 2 } } }).ok, true);
  assert.equal(checkApproveLeaveGate({ ...base, startDate: "2026-05-22", endDate: "2026-05-31" }, { profile: { ...profile, hajjPerformed: true }, requests: [] }).error, "HAJJ_ONCE");
  assert.equal(ts.checkApproveLeaveGate({ ...base, startDate: "2026-06-01", endDate: "2026-06-10" }, { profile, requests: [] }).error, "HAJJ_EID_ADHA");
}

// ── 9. Model regulation Art. 33 — advance proportional to time worked, with consent ──
{
  const profile = { hireDate: "2026-01-01" };
  const cap = annualAdvanceCap(profile, [], "2026-04-01");
  assert.equal(cap.earned, Math.floor(21 * (91 / 365) * 10) / 10); // 1 Jan – 1 Apr inclusive
  const req = { id: "adv", type: "annual", status: "pending", advanceLeave: true, startDate: "2026-04-01", endDate: "2026-04-01" };
  assert.equal(checkAnnualAdvanceGate(req, { profile, requests: [] }, 10).error, "ANNUAL_ADVANCE_CAP");
  assert.equal(checkAnnualAdvanceGate(req, { profile, requests: [] }, 3).ok, true);
  assert.equal(checkAnnualAdvanceGate(req, { profile, requests: [], forApproval: true }, 3).error, "ANNUAL_ADVANCE_CONSENT");
  assert.equal(checkAnnualAdvanceGate(req, { profile, requests: [], forApproval: true, advanceConsent: true }, 3).ok, true);
  assert.equal(checkAnnualAdvanceGate({ ...req, advanceLeave: false }, { profile, requests: [] }, 10).ok, true, "no flag → Art. 109 scheduling");
  assert.equal(ts.checkAnnualAdvanceGate(req, { profile, requests: [] }, 10).error, "ANNUAL_ADVANCE_CAP");
}

// ── 10. Art. 82 + Model regulation Art. 41 — join annual to sick ──
{
  const sick = { id: "s1", type: "sick", status: "approved", startDate: "2026-11-01", endDate: "2026-11-05" };
  assert.equal(checkJoinAnnualToSickGate({ type: "annual", joinAnnualToSick: true, startDate: "2026-11-06" }, { requests: [sick] }).joinedSickId, "s1");
  assert.equal(checkJoinAnnualToSickGate({ type: "annual", joinAnnualToSick: true, startDate: "2026-11-08" }, { requests: [sick] }).error, "JOIN_SICK_NOT_ADJACENT");
  assert.equal(checkJoinAnnualToSickGate({ type: "annual", startDate: "2026-11-08" }, { requests: [sick] }).ok, true);
  assert.equal(ts.checkJoinAnnualToSickGate({ type: "annual", joinAnnualToSick: true, startDate: "2026-11-06" }, { requests: [sick] }).joinedSickId, "s1");
}

// ── 11. Arts. 118 — proven breach marks the leave pay recoverable ──
{
  const leave = { id: "l", type: "annual", status: "approved" };
  assert.equal(checkLeaveBreachGate(leave, { reason: "عمل لدى شركة أخرى من 3 إلى 7", actorId: "m", subjectId: "e" }).error, "BREACH_EVIDENCE");
  assert.equal(checkLeaveBreachGate(leave, { file: { name: "p.pdf", url: "x" }, reason: "قصير", actorId: "m", subjectId: "e" }).error, "BREACH_REASON");
  assert.equal(checkLeaveBreachGate(leave, { file: { name: "p.pdf", url: "x" }, reason: "عمل لدى شركة أخرى من 3 إلى 7", actorId: "e", subjectId: "e" }).error, "SELF");
  assert.equal(checkLeaveBreachGate(leave, { file: { name: "p.pdf", url: "x" }, reason: "عمل لدى شركة أخرى من 3 إلى 7", actorId: "m", subjectId: "e" }).ok, true);
  assert.equal(checkLeaveBreachGate({ ...leave, recoverPay: true }, { file: { name: "p.pdf", url: "x" }, reason: "عمل لدى شركة أخرى من 3 إلى 7" }).error, "BREACH_ALREADY");
  assert.equal(ts.checkLeaveBreachGate(leave, { file: { name: "p.pdf", url: "x" }, reason: "عمل لدى شركة أخرى من 3 إلى 7", actorId: "m", subjectId: "e" }).ok, true);
}

// ── 12. Art. 151 — the companion month is never folded into the maternity floor ──
{
  assert.equal(statutoryLeaveFloor("maternity", { maternityDisabledChild: true }, "2026-09-06"), 84);
  assert.equal(leaveCiteRuleId("maternity", { maternityDisabledChild: true }, "2026-09-06"), "leave.maternity.days");
}

console.log("leave law: PASS");
