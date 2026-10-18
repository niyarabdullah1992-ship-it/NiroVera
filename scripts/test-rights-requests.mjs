import assert from "node:assert/strict";
import { checkDamageObjectionGate, damageObjectionDeadline, workingDaysBetween, checkLeaveCarryGate, checkArt81Gate, checkJobSearchDayGate, employerNoticeOf } from "../src/lib/rightsRequests.js";
import { checkGroundedRefusalGate } from "../src/lib/statutoryRefusal.js";
import { leaveNeedsAttachment } from "../src/lib/leaveDerivations.js";
import { checkSubmitOtherRequestGate } from "../src/lib/otherRequestDerivations.js";

// Art. 91 — 15 working days (Fri/Sat off) from being told.
assert.equal(damageObjectionDeadline("2026-10-01"), "2026-10-22"); // Thu 1 Oct → Sun–Thu ×3 weeks
assert.equal(workingDaysBetween("2026-10-01", "2026-10-22"), 15);
assert.equal(checkDamageObjectionGate({ notifiedOn: "2026-10-01", amount: 300, reason: "التلف بسبب عطل في الآلة لا بخطئي", today: "2026-10-22" }).ok, true);
assert.equal(checkDamageObjectionGate({ notifiedOn: "2026-10-01", amount: 300, reason: "التلف بسبب عطل في الآلة لا بخطئي", today: "2026-10-25" }).error, "OBJECTION_LATE");
assert.equal(checkSubmitOtherRequestGate({ type: "damage_objection", notifiedOn: "2026-10-01", amount: 0, reason: "التلف بسبب عطل في الآلة لا بخطئي", today: "2026-10-05" }).error, "AMOUNT_REQUIRED");

// Art. 110(1)
assert.equal(checkLeaveCarryGate({ days: 5, remaining: 3, reason: "سفر" }).error, "DAYS_OVER");
assert.equal(checkLeaveCarryGate({ days: 3, remaining: 3, reason: "سفر" }).ok, true);

// Art. 81 — a case, a description, an acknowledgement; never refused by management.
assert.equal(checkArt81Gate({ caseKey: "x", reason: "a".repeat(30), ack: true }).error, "CASE_REQUIRED");
assert.equal(checkArt81Gate({ caseKey: "obligations", reason: "لم يُصرف أجري منذ ثلاثة أشهر رغم المطالبة", ack: false }).error, "ACK_REQUIRED");
assert.equal(checkArt81Gate({ caseKey: "obligations", reason: "لم يُصرف أجري منذ ثلاثة أشهر رغم المطالبة", ack: true }).ok, true);
assert.equal(checkGroundedRefusalGate({ type: "art81_exit", family: "other" }, { actor: "manager" }).error, "NOT_REFUSABLE");
assert.equal(checkGroundedRefusalGate({ type: "document", docKind: "contract", family: "other" }, { actor: "manager" }).error, "NOT_REFUSABLE");

// Art. 78 — only during the employer's notice, one day a week, told the day before.
const noNotice = { profile: {} };
assert.equal(checkJobSearchDayGate({ employee: noNotice, startDate: "2026-10-20", endDate: "2026-10-20", today: "2026-10-15" }).error, "NO_EMPLOYER_NOTICE");
const onNotice = { profile: { contractExit: { party: "employer", effectiveDate: "2026-11-14" } }, leaveRequests: [] };
assert.ok(employerNoticeOf(onNotice, "2026-10-15"));
assert.equal(checkJobSearchDayGate({ employee: onNotice, startDate: "2026-10-15", endDate: "2026-10-15", today: "2026-10-15" }).error, "NOTICE_DAY_BEFORE");
assert.equal(checkJobSearchDayGate({ employee: onNotice, startDate: "2026-10-20", endDate: "2026-10-21", today: "2026-10-15" }).error, "ONE_DAY");
assert.equal(checkJobSearchDayGate({ employee: onNotice, startDate: "2026-10-20", endDate: "2026-10-20", today: "2026-10-15" }).ok, true);
const used = { ...onNotice, leaveRequests: [{ id: "j", type: "job_search", status: "approved", startDate: "2026-10-19", endDate: "2026-10-19" }] };
assert.equal(checkJobSearchDayGate({ employee: used, startDate: "2026-10-21", endDate: "2026-10-21", today: "2026-10-15" }).error, "WEEK_USED");
assert.equal(checkJobSearchDayGate({ employee: used, startDate: "2026-10-26", endDate: "2026-10-26", today: "2026-10-15" }).ok, true);

// No proof asked for annual or comp leave, however long (Arts. 109, 107).
assert.equal(leaveNeedsAttachment({ type: "annual", days: 12 }), false);
assert.equal(leaveNeedsAttachment({ type: "comp", days: 6 }), false);
assert.equal(leaveNeedsAttachment({ type: "sick", days: 1 }, true), true);
console.log("rights requests ok");

// Decision 18632 (ثالثاً ج) — off night work on a medical certificate.
const { checkNightAvoidGate, nightAvoidOn, checkDocumentsReturnGate } = await import("../src/lib/rightsRequests.js");
const { checkNightMedicalFitness } = await import("../src/lib/decision18632.js");
const cert = { name: "cert.pdf", url: "data:application/pdf,ok", hash: "C1" };
assert.equal(checkNightAvoidGate({ kind: "health", from: "2026-10-20" }).error, "FILE_REQUIRED");
assert.equal(checkNightAvoidGate({ kind: "mother", from: "2026-10-20", file: cert, gender: "male" }).error, "KIND_GENDER");
assert.equal(checkNightAvoidGate({ kind: "health", from: "2026-10-20", until: "2026-10-01", file: cert }).error, "UNTIL_ORDER");
assert.equal(checkNightAvoidGate({ kind: "health", from: "2026-10-20", file: cert }).ok, true);
const prof = { nightAvoid: { kind: "health", from: "2026-10-20", until: "2026-12-31" } };
assert.ok(nightAvoidOn(prof, "2026-11-01"));
assert.equal(nightAvoidOn(prof, "2027-01-02"), null);
const nightShift = { start: "22:00", end: "06:00" };
const blocked = checkNightMedicalFitness({ employee: { profile: prof }, shift: nightShift, onDate: "2026-11-01" });
assert.equal(blocked.error, "NIGHT_AVOID_MEDICAL", "the roster refuses a night shift while the certificate runs");
assert.equal(checkNightMedicalFitness({ employee: { profile: prof }, shift: nightShift, onDate: "2027-01-05" }).ok, true);
assert.equal(checkGroundedRefusalGate({ type: "night_avoid", family: "other" }, { actor: "manager" }).error, "REFUSAL_GROUND_REQUIRED");
// Art. 64(2)
assert.equal(checkDocumentsReturnGate({ reason: "" }).error, "LIST_REQUIRED");
assert.equal(checkGroundedRefusalGate({ type: "documents_return", family: "other" }, { actor: "manager" }).error, "NOT_REFUSABLE");
console.log("night avoid + documents ok");
