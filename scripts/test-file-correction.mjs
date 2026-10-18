/**
 * test-file-correction.mjs — «طلب تعديل الملف الوظيفي»: the employee asks in طلباتي, HR (or the account
 * administrator) decides, and only the approval writes the file — in HR's name.
 * Run: node scripts/test-file-correction.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FILE_CORRECTION_FIELDS,
  FILE_CORRECTION_HREF,
  FILE_CORRECTION_TYPE,
  checkDecideFileCorrectionGate,
  checkSubmitFileCorrectionGate,
  fileCorrectionCurrent,
  fileCorrectionPatch,
  fileCorrectionSummary,
  normalizeCorrectionValue,
} from "../src/lib/fileCorrection.js";
import { checkSubmitOtherRequestGate, otherRequestTypeLabel, requestAttachmentRule } from "../src/lib/otherRequestDerivations.js";
import { EMPLOYEE_FILE_CORRECTION_HREF } from "../src/lib/employeeFileRights.js";
import { CORRECTION_HREF } from "../src/lib/fileReadiness.js";
import { composeRequestKinds } from "../src/lib/requestWorkspace.js";

const emp = { id: "e1", name: "عمر", stationId: "st1", phone: "0500000000", profile: { iban: "SA0000000000000000000000", maritalStatus: "single" } };
const pdf = { name: "bank.pdf", type: "application/pdf", size: 1000, url: "data:application/pdf;base64,AA==" };

/* ── the list: personal facts only ── */
const keys = FILE_CORRECTION_FIELDS.map((row) => row.key);
for (const k of ["phone", "nationalId", "idExpiry", "passportNumber", "passportExpiry", "iban", "emergencyName", "emergencyPhone", "address", "maritalStatus", "religion", "qualification"]) assert.ok(keys.includes(k), k);
for (const k of ["baseSalary", "wage", "contractType", "position", "grade", "stationId", "hireDate"]) assert.ok(!keys.includes(k), `${k} is an HR / contract process`);
assert.equal(otherRequestTypeLabel(FILE_CORRECTION_TYPE), "طلب تعديل الملف الوظيفي");
assert.ok(composeRequestKinds("mine").some((row) => row.id === "file_correction"), "the employee raises it");
assert.ok(!composeRequestKinds("manage").some((row) => row.id === "file_correction"), "management does not raise it for the worker");
assert.equal(requestAttachmentRule(FILE_CORRECTION_TYPE).allowed, true);
console.log("PASS personal facts only, raised by the employee");

/* ── submit gate names what is missing ── */
assert.equal(checkSubmitFileCorrectionGate({}).error, "FIELD_REQUIRED");
assert.equal(checkSubmitFileCorrectionGate({ field: "phone", value: "12", reason: "رقم جديد" }).error, "VALUE_INVALID");
assert.equal(checkSubmitFileCorrectionGate({ field: "phone", value: "0500000000", reason: "رقم جديد", employee: emp }).error, "VALUE_UNCHANGED");
assert.equal(checkSubmitFileCorrectionGate({ field: "phone", value: "0551234567", reason: "" }).error, "REASON_REQUIRED");
const phone = checkSubmitFileCorrectionGate({ field: "phone", value: "+966 55 123 4567", reason: "رقم جديد", employee: emp });
assert.deepEqual([phone.ok, phone.value], [true, "0551234567"], "a +966 number is stored as 05…");
assert.equal(checkSubmitFileCorrectionGate({ field: "iban", value: "SA03 8000 0000 6080 1016 7519", reason: "بنك جديد" }).error, "PROOF_REQUIRED", "IBAN needs the bank letter");
assert.equal(checkSubmitFileCorrectionGate({ field: "iban", value: "SA03", reason: "بنك جديد", files: [pdf] }).error, "VALUE_INVALID");
assert.equal(checkSubmitFileCorrectionGate({ field: "iban", value: "sa03 8000 0000 6080 1016 7519", reason: "بنك جديد", files: [pdf] }).value, "SA0380000000608010167519");
assert.equal(checkSubmitFileCorrectionGate({ field: "nationalId", value: "3123456789", reason: "تجديد", files: [pdf] }).error, "VALUE_INVALID", "1 or 2 then nine digits");
assert.equal(checkSubmitFileCorrectionGate({ field: "maritalStatus", value: "married", reason: "تزوّج" }).ok, true);
assert.equal(checkSubmitFileCorrectionGate({ field: "maritalStatus", value: "engaged", reason: "؟" }).error, "VALUE_INVALID");
// The same gate runs from the shared other-request submit path.
assert.equal(checkSubmitOtherRequestGate({ type: FILE_CORRECTION_TYPE, field: "iban", newValue: "SA0380000000608010167519", reason: "بنك جديد" }).error, "PROOF_REQUIRED");
assert.equal(checkSubmitOtherRequestGate({ type: FILE_CORRECTION_TYPE, field: "iban", newValue: "SA0380000000608010167519", reason: "بنك جديد", files: [pdf] }).ok, true);
console.log("PASS submit gate names the missing part");

/* ── who decides: HR in scope or the administrator — never the employee or his manager ── */
const data = {
  ownerId: "owner",
  hrLevels: [{ id: "hr1", permissions: ["manage_employees"], stationIds: ["st1"] }, { id: "hr2", permissions: ["manage_employees"], stationIds: ["st9"] }],
};
assert.equal(checkDecideFileCorrectionGate({ id: "owner", role: "owner" }, emp, data).ok, true, "account administrator");
assert.equal(checkDecideFileCorrectionGate({ id: "h", hrLevelId: "hr1" }, emp, data).ok, true, "HR in scope");
assert.equal(checkDecideFileCorrectionGate({ id: "h2", hrLevelId: "hr2" }, emp, data).ok, false, "HR out of scope");
assert.equal(checkDecideFileCorrectionGate({ id: "m", role: "station_manager" }, emp, data).ok, false, "the branch manager reads only");
assert.equal(checkDecideFileCorrectionGate({ id: "e1" }, emp, data).ok, false, "never his own");
assert.equal(checkDecideFileCorrectionGate(null, emp, data).ok, false, "no actor — refused");
console.log("PASS decided by HR or the administrator only");

/* ── the approval writes exactly the field ── */
assert.deepEqual(fileCorrectionPatch({ field: "phone", newValue: "0551234567" }), { phone: "0551234567" });
assert.deepEqual(fileCorrectionPatch({ field: "iban", newValue: "SA0380000000608010167519" }), { profile: { iban: "SA0380000000608010167519" } });
assert.equal(fileCorrectionPatch({ field: "iban", newValue: "bad" }), null, "a value that no longer fits is never written");
assert.equal(fileCorrectionSummary({ field: "maritalStatus", newValue: "married" }), "الحالة الاجتماعية: متزوج / متزوجة");
assert.equal(fileCorrectionCurrent(emp, "maritalStatus"), "أعزب / عزباء");
assert.equal(fileCorrectionCurrent(emp, "phone"), "0500000000");
assert.equal(normalizeCorrectionValue("idExpiry", "2027-03-01"), "2027-03-01");
console.log("PASS approval patch writes the field only");

/* ── one path everywhere, and the store holds the gate ── */
assert.equal(EMPLOYEE_FILE_CORRECTION_HREF, FILE_CORRECTION_HREF);
assert.equal(CORRECTION_HREF, FILE_CORRECTION_HREF);
const reqPage = readFileSync(new URL("../src/pages/Requests.jsx", import.meta.url), "utf8");
assert.match(reqPage, /"file_correction"\]\.includes\(askedKind\)/, "?kind=file_correction preselects the form");
const store = readFileSync(new URL("../src/lib/store.js", import.meta.url), "utf8");
const decide = store.slice(store.indexOf("export function setOtherRequestStatus("), store.indexOf("function applyDutyRequestOnDraft("));
assert.match(decide, /checkDecideFileCorrectionGate\(actorUser, emp, data\)/, "the store refuses a non-HR decision");
assert.match(decide, /patchEmployeeFile\(companyId, employeeId, \{\s*actor: actorUser,\s*\.\.\.fileCorrectionPatch\(pending\)/, "approval writes through the HR-only file write");
assert.match(decide, /اعتُمد طلب تعديل: \$\{summary\}/, "the file log names the change");
const decision = readFileSync(new URL("../src/lib/otherRequestDecision.js", import.meta.url), "utf8");
assert.match(decision, /actorId: actor\?\.id,\s*actor,/, "the deciding user reaches the store");
console.log("PASS one correction path; the store holds the HR-only gate");
console.log("ALL PASS test-file-correction");
