/**
 * Owner rule: «الجزاءات تظهر فقط في قسم الجزاءات للموظف والملف بأكمله لا يستطيع ملئه إلا قسم الموارد البشرية».
 *   A — on his own file the worker sees no sanction (story, archive, file view, readiness).
 *   B — only HR (and the owner / director as account administrator) fills or edits the file; the page
 *       helper and the server gate agree, and the server names its refusal.
 */
import assert from "node:assert/strict";
import {
  canEditEmployeeFile,
  canEditEmployeeFileWage,
  employeeFileEditGate,
  EMPLOYEE_FILE_HR_ONLY,
  EMPLOYEE_FILE_CORRECTION_HREF,
} from "../src/lib/employeeFileRights.js";
import {
  canWriteEmployeeFile,
  employeeFileFactChanges,
  enforceEmployeeFileWrite,
  EMPLOYEE_FILE_HR_ONLY as SERVER_CODE,
} from "../base44/shared/employeeFileGate.ts";
import { buildServiceStory } from "../src/lib/serviceStory.js";
import { buildFileArchive } from "../src/lib/fileArchive.js";
import { buildEmployeeFileView } from "../src/lib/employeeFileView.js";
import { buildFileReadiness, CORRECTION_HREF } from "../src/lib/fileReadiness.js";

const TODAY = "2026-10-16";

/* ── B · who may edit the file ── */
const data = {
  ownerId: "owner",
  hrLevels: [
    { id: "hr_mgr", active: true, role: "manager", scope: "company", permissions: ["view_employees", "manage_employees", "manage_payroll"] },
    { id: "hr_branch", active: true, role: "assistant", scope: "station", permissions: ["manage_employees"] },
    { id: "hr_view", active: true, role: "assistant", scope: "company", permissions: ["view_employees", "manage_leave"] },
    { id: "hr_off", active: false, role: "manager", scope: "company", permissions: ["manage_employees"] },
  ],
};
const worker = { id: "w1", role: "employee", stationId: "s1", profile: { directManagerId: "m1" } };
const people = {
  employee: { id: "w1", role: "employee", stationId: "s1" },
  directManager: { id: "m1", role: "employee", stationId: "s1", canManageTeam: true },
  branchManager: { id: "bm", role: "station_manager", stationId: "s1", managedStations: ["s1"] },
  pgm: { id: "pg", role: "pgm", managedStations: ["s1"] },
  opsManager: { id: "ops", role: "ops_manager" },
  hr: { id: "hr1", role: "employee", hrLevelId: "hr_mgr", stationId: "s9" },
  hrBranchIn: { id: "hr2", role: "employee", hrLevelId: "hr_branch", hrStationId: "s1", stationId: "s1" },
  hrBranchOut: { id: "hr3", role: "employee", hrLevelId: "hr_branch", hrStationId: "s2", stationId: "s2" },
  hrViewOnly: { id: "hr4", role: "employee", hrLevelId: "hr_view" },
  hrInactive: { id: "hr5", role: "employee", hrLevelId: "hr_off" },
  owner: { id: "owner", role: "employee" },
  director: { id: "dir", role: "director" },
};
const can = (who) => canEditEmployeeFile(people[who], worker, data);

assert.equal(can("employee"), false, "the employee reads his own file");
assert.equal(can("directManager"), false, "the direct manager reads");
assert.equal(can("branchManager"), false, "the branch manager reads");
assert.equal(can("pgm"), false);
assert.equal(can("opsManager"), false, "operations reads — HR fills the file");
assert.equal(can("hr"), true, "HR with manage_employees, company-wide");
assert.equal(can("hrBranchIn"), true, "HR inside its station scope");
assert.equal(can("hrBranchOut"), false, "HR outside its scope");
assert.equal(can("hrViewOnly"), false, "an HR level without manage_employees reads");
assert.equal(can("hrInactive"), false, "an inactive HR level grants nothing");
assert.equal(can("owner"), true, "the owner is the account administrator");
assert.equal(can("director"), true, "the director keeps full rights");

// Named reasons.
const selfGate = employeeFileEditGate(people.employee, worker, data);
assert.equal(selfGate.ok, false);
assert.equal(selfGate.error, EMPLOYEE_FILE_HR_ONLY);
assert.match(selfGate.reason, /اطلب تعديل بيان/);
assert.equal(employeeFileEditGate(people.branchManager, worker, data).reason, "ملف الموظف تملؤه الموارد البشرية وحدها.");
assert.match(employeeFileEditGate(people.hrBranchOut, worker, data).reason, /خارج نطاق/);
// HR does not edit its own file; the owner does.
const hrSelf = { ...people.hr, stationId: "s1" };
assert.equal(canEditEmployeeFile(people.hr, hrSelf, data), false);
assert.match(employeeFileEditGate(people.hr, hrSelf, data).reason, /لا تعدّل ملفك بنفسك/);
assert.equal(canEditEmployeeFile(people.owner, { id: "owner", stationId: "s1" }, data), true);
// Wage lines: HR with payroll, or the administrator.
assert.equal(canEditEmployeeFileWage(people.hr, worker, data), true);
assert.equal(canEditEmployeeFileWage(people.hrBranchIn, worker, data), false, "HR without manage_payroll leaves the wage");
assert.equal(canEditEmployeeFileWage(people.director, worker, data), true);
assert.equal(canEditEmployeeFileWage(people.branchManager, worker, data), false);
assert.equal(EMPLOYEE_FILE_CORRECTION_HREF, CORRECTION_HREF, "the correction request is the same path everywhere");

/* ── B · the server gate ── */
assert.equal(SERVER_CODE, EMPLOYEE_FILE_HR_ONLY);
const writers = {
  employee: { employeeId: "w1", role: "employee", permissions: new Set(), scope: [] },
  directManager: { employeeId: "m1", role: "employee", permissions: new Set(), scope: [] },
  branchManager: { employeeId: "bm", role: "station_manager", permissions: new Set(), scope: ["s1"] },
  hr: { employeeId: "hr1", role: "employee", permissions: new Set(["manage_employees"]), scope: null },
  hrOut: { employeeId: "hr3", role: "employee", permissions: new Set(["manage_employees"]), scope: ["s2"] },
  owner: { admin: true },
  director: { employeeId: "dir", role: "director", permissions: new Set(), scope: null },
};
const target = { employeeId: "w1", stationId: "s1" };
assert.equal(canWriteEmployeeFile(writers.employee, target), false);
assert.equal(canWriteEmployeeFile(writers.directManager, target), false);
assert.equal(canWriteEmployeeFile(writers.branchManager, target), false);
assert.equal(canWriteEmployeeFile(writers.hr, target), true);
assert.equal(canWriteEmployeeFile(writers.hrOut, target), false);
assert.equal(canWriteEmployeeFile(writers.owner, target), true);
assert.equal(canWriteEmployeeFile(writers.director, target), true);
assert.equal(canWriteEmployeeFile({ ...writers.hr, employeeId: "w1" }, target), false, "HR does not write its own file");

const stored = {
  employeeId: "w1",
  stationId: "s1",
  name: "سالم",
  phone: "0500000000",
  certificates: [],
  profile: { iban: "SA01", baseSalary: 5000, contractType: "fixed", contractEndDate: "2026-12-31", contract: { type: "fixed", endDate: "2026-12-31" }, nightConsentAt: "" },
  otherRequests: [],
};
// The worker's own push: a typed IBAN and wage, plus his request and contract signature.
const pushed = {
  ...stored,
  name: "سالم المعدّل",
  profile: { ...stored.profile, iban: "SA99", baseSalary: 9000, nightConsentAt: "2026-10-16", contract: { ...stored.profile.contract, workerAck: { at: "2026-10-16T08:00:00Z" } } },
  otherRequests: [{ id: "r1", type: "data_correction" }],
};
assert.deepEqual(employeeFileFactChanges(stored, pushed).sort(), ["name", "profile.baseSalary", "profile.iban"]);
const held = enforceEmployeeFileWrite(writers.employee, stored, pushed);
assert.equal(held.refused.error, SERVER_CODE);
assert.match(held.refused.reason, /اطلب تعديل بيان/);
assert.deepEqual(held.refused.fields.sort(), ["name", "profile.baseSalary", "profile.iban"]);
assert.equal(held.record.name, "سالم");
assert.equal(held.record.profile.iban, "SA01");
assert.equal(held.record.profile.baseSalary, 5000);
assert.equal(held.record.profile.nightConsentAt, "2026-10-16", "his own consent passes");
assert.equal(held.record.profile.contract.workerAck.at, "2026-10-16T08:00:00Z", "his contract signature passes");
assert.deepEqual(held.record.otherRequests, [{ id: "r1", type: "data_correction" }], "his request passes");
// A branch manager is held the same way, with the third-person reason.
const mgr = enforceEmployeeFileWrite(writers.branchManager, stored, { ...stored, phone: "0599999999" });
assert.equal(mgr.refused.reason, "ملف الموظف تملؤه الموارد البشرية وحدها.");
assert.equal(mgr.record.phone, "0500000000");
// HR and the administrator write.
assert.equal(enforceEmployeeFileWrite(writers.hr, stored, pushed).refused, null);
assert.equal(enforceEmployeeFileWrite(writers.hr, stored, pushed).record.profile.iban, "SA99");
assert.equal(enforceEmployeeFileWrite(writers.owner, stored, pushed).refused, null);
// Law-derived rewrites pass for anyone: Art. 55 conversion and the unpaid-leave extension.
const art55 = { ...stored, profile: { ...stored.profile, contractType: "indefinite", contractEndDate: "", art55AppliedAt: TODAY, contract: { type: "indefinite", endDate: "" } } };
assert.deepEqual(employeeFileFactChanges(stored, art55), []);
const extended = { ...stored, profile: { ...stored.profile, unpaidSuspendedDays: 10, contractEndDate: "2027-01-10", contract: { type: "fixed", endDate: "2027-01-10" } } };
assert.deepEqual(employeeFileFactChanges(stored, extended), []);
// …but a typed shortening is a file fact.
assert.deepEqual(employeeFileFactChanges(stored, { ...stored, profile: { ...stored.profile, contractEndDate: "2026-11-01" } }), ["profile.contractEndDate"]);
// Nothing changed → nothing held, and a new row is not this gate's business.
assert.equal(enforceEmployeeFileWrite(writers.employee, stored, stored).refused, null);
assert.equal(enforceEmployeeFileWrite(writers.employee, null, pushed).refused, null);

/* ── A · no sanction on the worker's own file ── */
const emp = { id: "e1", name: "سالم", stationId: "s1", profile: { hireDate: "2023-03-01", position: "فني" }, fileLog: [
  { text: "تعديل الأجر الأساسي", by: "نورة", at: "2025-02-01" },
  { text: "جزاء إنذار كتابي — حسم من الأجر", by: "نورة", at: "2025-09-01" },
] };
const cases = [
  { id: "c1", employeeId: "e1", status: "appeal", signedAt: "2025-09-01", signedBy: "مدير الموارد", penaltyKind: "warning_written", reason: "تأخر", appealedAt: "2025-09-05", rulingAt: "2025-09-20", rulingLabel: "أُيّد", finalHash: "ffeeddccbbaa9988" },
];
const selfStory = buildServiceStory({ employee: emp, cases, selfView: true, today: TODAY }).years.flatMap((y) => y.events);
assert.ok(!selfStory.some((e) => e.kind === "sanction"), "no sanction / grievance on «قصة خدمتي»");
assert.ok(!selfStory.some((e) => /جزاء|تظلّم/.test(e.text)), "no sanction file-log line either");
assert.ok(selfStory.some((e) => e.id === "hire"), "the rest of the story stays");
const hrStory = buildServiceStory({ employee: emp, cases, selfView: false, today: TODAY }).years.flatMap((y) => y.events);
assert.ok(hrStory.some((e) => e.id === "sanction-c1") && hrStory.some((e) => e.id === "grievance-c1"), "HR / manager keeps them");
assert.ok(buildServiceStory({ employee: emp, cases, selfView: true, includeSanctions: true, today: TODAY }).years.flatMap((y) => y.events).some((e) => e.id === "sanction-c1"), "the option is explicit");

const selfArchive = buildFileArchive({ employee: emp, cases, selfView: true, today: TODAY });
assert.ok(!selfArchive.groups.some((g) => g.id === "decisions"), "no sanction decision on «أرشيف ملفي»");
assert.ok(!selfArchive.groups.flatMap((g) => g.items).some((row) => /^sanction-|^ruling-/.test(row.id)));
const hrArchive = buildFileArchive({ employee: emp, cases, managerView: true, today: TODAY });
assert.deepEqual(hrArchive.groups.find((g) => g.id === "decisions").items.map((row) => row.id), ["ruling-c1", "sanction-c1"]);

const signedCase = [{ id: "c9", employeeId: "e1", status: "decision", signedAt: "2026-09-01", penaltyKind: "warning_written", reason: "تأخر" }];
const selfView = buildEmployeeFileView({ employee: emp, cases: signedCase, isSelf: true, today: TODAY });
assert.deepEqual(selfView.penalties, [], "no penalty rows on his own file");
assert.ok(!selfView.todos.some((row) => /جزاء/.test(row.text)), "no sanction to-do on his own file");
assert.equal(selfView.openCases, 0);
const hrView = buildEmployeeFileView({ employee: emp, cases: signedCase, isSelf: false, canEditFile: true, today: TODAY });
assert.equal(hrView.penalties.length, 1);
assert.ok(hrView.todos.some((row) => /جزاء/.test(row.text)));

/* ── B · readiness: the worker asks, a reading manager does not «open the file» ── */
const bare = { id: "e3", name: "ريم", profile: {} };
const mine = buildFileReadiness({ employee: bare, view: "employee", today: TODAY });
for (const item of mine.open.filter((row) => row.owner === "self" && row.id !== "regulation")) {
  assert.ok(!item.action?.tab || item.id === "contract", `«عليّ» item ${item.id} never opens an edit form`);
  if (item.action?.to) assert.ok(item.action.to === CORRECTION_HREF || item.action.to.startsWith("/app/"), item.id);
}
assert.equal(mine.open.find((row) => row.id === "iban").action.to, CORRECTION_HREF);
const reading = buildFileReadiness({ employee: bare, view: "manager", canEditFile: false, today: TODAY });
assert.ok(reading.open.filter((row) => row.owner === "hr").every((row) => !row.action && row.ownerLabel === "على الموارد البشرية"), "a reading manager gets no edit action");
const editing = buildFileReadiness({ employee: bare, view: "manager", canEditFile: true, today: TODAY });
assert.ok(editing.open.some((row) => row.owner === "hr" && row.action?.label === "افتح في الملف"));

console.log("PASS test-employee-file-rights");
