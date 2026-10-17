import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// طلباتي — granted leave balances (no cap, never annual), the optional resignation reason, and one
// attachment control on every request type. The backend twins run the same rules.
import { GRANTABLE_LEAVE_KEYS, LEAVE_TYPES, grantedDaysOfType, grantedLeaveBalances, getLeaveTotal, remainingLeaveDays } from "../src/lib/leaveTypes.js";
import {
  LEAVE_TOPUP_TYPE,
  OTHER_REQUEST_TYPES,
  checkAdminLeaveCreditGate,
  checkLeaveGrantGate,
  checkRequestFilesGate,
  checkSubmitOtherRequestGate,
  requestAttachmentRule,
  requestReasonRequired,
  stampLeaveTopupOnEmployee,
} from "../src/lib/otherRequestDerivations.js";
import { REQUEST_KINDS, composeAdminLeaveCreditGates } from "../src/lib/requestWorkspace.js";
import { RIGHTS_REQUESTS } from "../src/lib/rightsRequests.js";
import { RESIGNATION_REASON_HINT_AR, RESIGNATION_TYPE } from "../src/lib/exitRequests.js";
import { citeLeaveType } from "../src/lib/laborRules.js";
import * as be from "../base44/shared/otherRequestDerivations.ts";
import * as beLeave from "../base44/shared/leaveDerivations.ts";
import * as beExit from "../base44/shared/resignationLaw.ts";

// 1. Granting annual leave is refused, with the article from the catalog — client and server.
const annualArt = citeLeaveType("annual")?.article;
assert.equal(annualArt, "109");
for (const gate of [checkLeaveGrantGate, be.checkLeaveGrantGate]) {
  const r = gate({ pool: "annual", days: 2 });
  assert.equal(r.ok, false);
  assert.equal(r.error, "ANNUAL_FIXED");
  assert.equal(r.reason, `رصيد السنوية ثابت بالنظام (المادة ${annualArt}) — لا يُرفع.`);
}
assert.equal(checkAdminLeaveCreditGate({ pool: "annual", days: 2, reason: "منحة تشغيل" }).error, "ANNUAL_FIXED");
assert.equal(checkSubmitOtherRequestGate({ type: LEAVE_TOPUP_TYPE, leaveType: "annual", days: 2, reason: "منحة تشغيل" }).error, "ANNUAL_FIXED");
assert.ok(composeAdminLeaveCreditGates({ pool: "annual", days: 2, reason: "منحة تشغيل" }).some((row) => !row.ok && row.text.includes("لا يُرفع")));
assert.equal(stampLeaveTopupOnEmployee({ profile: {} }, { type: LEAVE_TOPUP_TYPE, leaveType: "annual", days: 2 }).ok, false);
assert.ok(!GRANTABLE_LEAVE_KEYS.includes("annual"));
assert.deepEqual(beLeave.GRANTABLE_LEAVE_KEYS, GRANTABLE_LEAVE_KEYS);

// 2. Other types take any whole number of days — no cap; still positive and whole.
for (const gate of [checkLeaveGrantGate, be.checkLeaveGrantGate]) {
  for (const pool of GRANTABLE_LEAVE_KEYS) {
    assert.deepEqual(gate({ pool, days: 1000 }), { ok: true, pool, days: 1000 }, pool);
    assert.equal(gate({ pool, days: 0 }).error, "DAYS_INVALID");
    assert.equal(gate({ pool, days: -3 }).error, "DAYS_INVALID");
    assert.equal(gate({ pool, days: 2.5 }).error, "DAYS_INVALID");
  }
  assert.equal(gate({ pool: "sick", days: 2 }).error, "POOL_REQUIRED");
}
assert.equal(checkAdminLeaveCreditGate({ pool: "grant", days: 365, reason: "منحة تشغيل", profile: { discretionaryGrants: [{ days: 300 }] } }).ok, true);
assert.equal(checkSubmitOtherRequestGate({ type: LEAVE_TOPUP_TYPE, leaveType: "emergency", days: 90, reason: "ظرف عائلي" }).ok, true);

// 3. «متبقٍّ X من Y» — derived from grants and approved leave, one row per granted type.
const profile = {
  hireDate: "2024-01-15",
  discretionaryGrants: [
    { type: "grant", days: 6 },
    { days: 4 }, // an old untyped grant is a «رصيد» grant
    { type: "emergency", days: 3 },
  ],
};
const requests = [
  { id: "g1", type: "grant", status: "approved", startDate: "2026-10-05", endDate: "2026-10-07", days: 3 },
  { id: "e1", type: "emergency", status: "approved", startDate: "2026-09-01", endDate: "2026-09-02", days: 2 },
  { id: "g2", type: "grant", status: "pending", startDate: "2026-11-01", endDate: "2026-11-02", days: 2 },
];
assert.equal(grantedDaysOfType(profile, "grant"), 10);
assert.equal(grantedDaysOfType(profile, "emergency"), 3);
const emergencyFloor = LEAVE_TYPES.find((t) => t.key === "emergency").defaultTotal;
assert.equal(getLeaveTotal(profile, "emergency", "2026-10-17"), emergencyFloor + 3);
assert.equal(getLeaveTotal(profile, "annual", "2026-10-17"), 21, "a grant never touches annual");
const rows = grantedLeaveBalances(profile, requests, "2026-10-17");
assert.deepEqual(rows.map((r) => [r.key, r.remaining, r.total]), [["grant", 7, 10], ["emergency", emergencyFloor + 3 - 2, emergencyFloor + 3]]);
assert.equal(rows[0].ar, "رصيد ممنوح");
assert.equal(rows[0].pct, 70);
assert.equal(remainingLeaveDays(profile, requests, "emergency", "2026-10-17"), emergencyFloor + 1);
assert.deepEqual(grantedLeaveBalances({ hireDate: "2024-01-15" }, []), [], "no grant, no row");
const beRows = beLeave.grantedLeaveBalances(profile, requests, "2026-10-17");
assert.deepEqual(beRows.map((r) => [r.key, r.remaining, r.total, r.pct]), rows.map((r) => [r.key, r.remaining, r.total, r.pct]), "server twin derives the same rows");

// An approved top-up becomes a typed grant the card reads back.
const emp = { profile: { hireDate: "2024-01-15" } };
stampLeaveTopupOnEmployee(emp, { id: "t", type: LEAVE_TOPUP_TYPE, leaveType: "emergency", days: 40, reason: "منحة" });
assert.equal(grantedLeaveBalances(emp.profile, [])[0].total, emergencyFloor + 40);

// 4. Every request type in طلباتي allows an attachment; the required ones stay required.
const types = new Set([
  ...OTHER_REQUEST_TYPES.map((r) => r.key),
  ...REQUEST_KINDS.map((r) => r.type || r.id),
  ...RIGHTS_REQUESTS.map((r) => r.key),
  ...LEAVE_TYPES.map((r) => r.key),
]);
assert.ok(types.size > 30);
for (const type of types) {
  assert.equal(requestAttachmentRule(type).allowed, true, type);
  assert.equal(be.requestAttachmentRule(type).allowed, true, type);
  assert.equal(be.requestAttachmentRule(type).required, requestAttachmentRule(type).required, type);
}
for (const required of ["night_avoid", "night_fitness", "study_consent", "pregnancy_notice"]) assert.equal(requestAttachmentRule(required).required, true, required);
for (const optional of [RESIGNATION_TYPE, "advance", "other", "permission", LEAVE_TOPUP_TYPE, "leave_carry", "documents_return"]) assert.equal(requestAttachmentRule(optional).required, false, optional);
const pdf = { name: "استقالة.pdf", type: "application/pdf", size: 120000, url: "data:application/pdf;base64,AA==" };
for (const gate of [checkRequestFilesGate, be.checkRequestFilesGate]) {
  assert.equal(gate([pdf]).ok, true);
  assert.equal(gate(undefined).ok, true);
  assert.equal(gate([{ ...pdf, size: 26 * 1024 * 1024 }]).error, "FILE_TOO_LARGE");
  assert.equal(gate([{ name: "x.exe", type: "application/x-msdownload" }]).error, "FILE_TYPE");
  assert.equal(gate("x").error, "FILES_INVALID");
}
// The attachment passes the submit gate for a plain request.
assert.equal(checkSubmitOtherRequestGate({ type: "advance", reason: "طلب سلفة", files: [pdf] }).ok, true);
assert.equal(checkSubmitOtherRequestGate({ type: "advance", reason: "طلب سلفة", files: [{ ...pdf, size: 30 * 1024 * 1024 }] }).error, "FILE_TOO_LARGE");

// 5. A resignation needs no reason (Arts. 75 / 79 bis); the hint is shared with the server twin.
assert.equal(requestReasonRequired(RESIGNATION_TYPE), false);
assert.equal(be.requestReasonRequired(RESIGNATION_TYPE), false);
assert.equal(requestReasonRequired("other"), true);
assert.equal(RESIGNATION_REASON_HINT_AR, "اختياري — لا يُشترط ذكر سبب للاستقالة");
assert.equal(beExit.RESIGNATION_REASON_HINT_AR, RESIGNATION_REASON_HINT_AR);
assert.equal(checkSubmitOtherRequestGate({ type: RESIGNATION_TYPE, reason: "", date: "2026-10-17", lastDay: "2026-11-16" }).ok, true);
assert.equal(checkSubmitOtherRequestGate({ type: RESIGNATION_TYPE, reason: "", date: "2026-10-17", lastDay: "2026-11-16", files: [pdf] }).ok, true);

// UI wiring: one dropzone in every raise form, sub-pickers subordinate, no pill frame left.
const ws = readFileSync(new URL("../src/components/requests/RequestsWorkspace.jsx", import.meta.url), "utf8");
const rights = readFileSync(new URL("../src/components/requests/RightsRequestRaise.jsx", import.meta.url), "utf8");
assert.match(ws, /data-resignation-reason/);
assert.match(ws, /RESIGNATION_REASON_HINT_AR/);
assert.match(ws, /grantedLeaveBalances\(/);
assert.doesNotMatch(ws, /className="nv-chip" onClick=\{\(\) => \{ setKind\("leave"\)/, "the pill leave-type frame is gone");
assert.doesNotMatch(ws, /DISCRETIONARY_GRANT_CAP|LEAVE_TOPUP_MAX_DAYS/, "no numeric cap on grants");
assert.match(ws, /files: isCustody \? files : \(supportingFile \? \[supportingFile\] : undefined\)/, "every request passes its attachment on submit");
assert.match(rights, /<AttachDropzone/);
assert.doesNotMatch(rights, /kind !== LEAVE_CARRY_TYPE && kind !== DOCUMENTS_RETURN_TYPE \?/, "every rights kind takes an attachment");
const entry = readFileSync(new URL("../base44/functions/workforce/entry.ts", import.meta.url), "utf8");
assert.match(entry, /checkRequestFilesGate\(request\.files\)/);
assert.match(entry, /checkLeaveGrantGate\(\{ pool: request\.leaveType/);

console.log("request grants + attachments ok");
