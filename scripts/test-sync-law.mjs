/**
 * Sync law — how law-bound company data reaches Base44 (area: sync).
 *   1. workRegulation: server copy precedence, versions, worker acks (Law Arts. 12–13)
 *   2. employerDuties / trainingPlan: projected roster, merged back, records never dropped
 *   3. disciplinaryCases: excluded from the generic push; stage writes only set their fields
 *   4. abuseCases: filer + named committee + senior HR read; nobody else (model regulation Art. 56(1))
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as ts from "../base44/shared/syncLaw.ts";
import { BLOB_VISIBILITY, OBJECT_BLOB_CATEGORIES, SENSITIVE_EMPLOYEE_FIELDS, filterBlobPayload } from "../base44/shared/blobVisibility.ts";
import * as js from "../src/lib/syncLaw.js";
import { NOT_PUSHED_AS_IS, isObjectBlobCategory, isServerActionCategory, pushableBlobCategories } from "../src/lib/canonicalStore.js";

let n = 0;
const t = (name, fn) => { fn(); n += 1; };
const ctx = (over = {}) => ({ senior: false, userId: "", permissions: new Set(), scope: [], ownReportIds: new Set(), ...over });

/* ----------------------------- 1. work regulation ----------------------------- */
const REG = { approvalNo: "A-1", approvedAt: "2026-01-10", version: "2026-01-10T08:00:00", announcedAt: "2026-01-12", clauses: [{ id: "late15", steps: ["إنذار كتابي"] }], acks: { e1: { at: "x", version: "2026-01-10T08:00:00" } } };

t("server copy wins over the page copy in disciplineSave", () => {
  const page = { ...REG, approvalNo: "FORGED", clauses: [{ id: "x", steps: ["5%"] }] };
  const r = ts.pickDisciplineRegulation(REG, page);
  assert.equal(r.source, "server");
  assert.equal(r.regulation.approvalNo, "A-1");
  assert.equal(r.regulation.source, "own");
  // array-shaped legacy payload is read too
  assert.equal(ts.pickDisciplineRegulation([REG], page).regulation.approvalNo, "A-1");
});

t("page copy only while the server holds none; neither → model", () => {
  assert.equal(ts.pickDisciplineRegulation(null, REG).source, "page");
  assert.equal(ts.pickDisciplineRegulation({}, REG).source, "page");
  assert.equal(ts.pickDisciplineRegulation({ clauses: [] }, { clauses: [] }).regulation, null);
});

t("a worker's push cannot change the regulation, only add their own server-stamped ack", () => {
  const forged = { ...REG, approvalNo: "X", clauses: [], acks: { e1: { at: "y", version: REG.version }, e2: { at: "1999", version: REG.version }, e3: { version: REG.version } } };
  const r = ts.mergeWorkRegulationWrite(REG, forged, { senior: false, actorId: "e2", actorName: "Sara", now: "2026-02-01T00:00:00Z" });
  assert.equal(r.payload.approvalNo, "A-1");
  assert.equal(r.payload.clauses.length, 1);
  assert.deepEqual(Object.keys(r.payload.acks).sort(), ["e1", "e2"]);
  assert.equal(r.payload.acks.e2.at, "2026-02-01T00:00:00Z");
  assert.equal(r.payload.acks.e2.stampedBy, "server");
  assert.equal(r.payload.acks.e1.at, "x"); // never overwritten
  assert.equal(r.changed, true);
});

t("no ack before announcement, nor for another version", () => {
  const draft = { ...REG, announcedAt: "", acks: {} };
  assert.equal(ts.mergeWorkRegulationWrite(draft, { acks: { e2: { version: REG.version } } }, { actorId: "e2" }).changed, false);
  assert.equal(ts.mergeWorkRegulationWrite(REG, { acks: { e2: { version: "old" } } }, { actorId: "e2" }).changed, false);
});

t("senior re-save = new version: old one archived, acks reset; empty push never erases", () => {
  const next = { ...REG, approvalNo: "A-2", version: "2026-03-01T00:00:00", announcedAt: "", acks: { e9: {} } };
  const r = ts.mergeWorkRegulationWrite(REG, next, { senior: true });
  assert.equal(r.payload.approvalNo, "A-2");
  assert.deepEqual(r.payload.acks, {});
  assert.equal(r.payload.versions.length, 1);
  assert.equal(r.payload.versions[0].approvalNo, "A-1");
  assert.equal(r.payload.versions[0].acks, 1);
  assert.equal(ts.mergeWorkRegulationWrite(REG, {}, { senior: true }).changed, false);
  // a stale device's older version never rolls back
  const stale = ts.mergeWorkRegulationWrite(r.payload, REG, { senior: true });
  assert.equal(stale.payload.approvalNo, "A-2");
});

t("same version: senior announces but cannot un-announce or forge acks", () => {
  const draft = { ...REG, announcedAt: "", acks: {} };
  const ann = ts.mergeWorkRegulationWrite(draft, { ...draft, announcedAt: "2026-01-15", acks: { e5: { version: REG.version } } }, { senior: true, actorId: "boss" });
  assert.equal(ann.payload.announcedAt, "2026-01-15");
  assert.deepEqual(ann.payload.acks, {});
  const un = ts.mergeWorkRegulationWrite(REG, { ...REG, announcedAt: "" }, { senior: true });
  assert.equal(un.payload.announcedAt, "2026-01-12");
});

t("non-senior readers see the regulation with only their own ack", () => {
  const out = filterBlobPayload("workRegulation", { ...REG, acks: { e1: { at: 1 }, e2: { at: 2 } } }, ctx({ userId: "e2" }));
  assert.deepEqual(Object.keys(out.acks), ["e2"]);
  assert.equal(out.clauses.length, 1);
  assert.equal(Object.keys(filterBlobPayload("workRegulation", REG, ctx({ senior: true })).acks).length, 1);
  assert.equal(BLOB_VISIBILITY.workRegulation, "shared");
  assert.ok(OBJECT_BLOB_CATEGORIES.includes("workRegulation") && isObjectBlobCategory("workRegulation"));
});

t("client and server version entries agree", () => {
  assert.deepEqual(js.regulationVersionEntry(REG), ts.regulationVersionEntry(REG));
});

/* ----------------------------- 2. employer duties ----------------------------- */
const EMPS = [
  { id: "e1", stationId: "s1", trainings: [{ id: "t1", course: "Fire" }], medicalExams: [{ id: "m1", at: "2026-01-01" }], profile: { heldDocuments: [{ id: "h1", kind: "passport" }] } },
  { id: "e2", stationId: "s2" },
];

t("roster projects only employees with records", () => {
  const roster = js.employerDutyRosterFromEmployees(EMPS);
  assert.equal(roster.length, 1);
  assert.equal(roster[0].employeeId, "e1");
  assert.equal(roster[0].heldDocuments[0].id, "h1");
});

t("hydration lays server registers onto employees without dropping local records", () => {
  const server = [{ employeeId: "e1", trainings: [{ id: "t1", course: "Fire", documentedAt: "2026-01-20" }, { id: "t0", course: "First aid" }], medicalExams: [], heldDocuments: [{ id: "h1", kind: "passport", returnedAt: "2026-02-01" }] }];
  const local = [{ ...EMPS[0], trainings: [{ id: "t1", course: "Fire" }, { id: "t2", course: "Local only" }] }, EMPS[1]];
  const out = js.applyEmployerDutyRoster(local, server);
  assert.deepEqual(out[0].trainings.map((r) => r.id).sort(), ["t0", "t1", "t2"]);
  assert.equal(out[0].trainings.find((r) => r.id === "t1").documentedAt, "2026-01-20");
  assert.equal(out[0].medicalExams[0].id, "m1");
  assert.equal(out[0].profile.heldDocuments[0].returnedAt, "2026-02-01");
  assert.equal(out[1], local[1]);
});

t("server roster merge: scope-limited writer, records never dropped", () => {
  const prior = [{ employeeId: "e1", stationId: "s1", trainings: [{ id: "t1" }], medicalExams: [{ id: "m1" }], heldDocuments: [] },
    { employeeId: "e2", stationId: "s2", trainings: [{ id: "t9" }], medicalExams: [], heldDocuments: [] }];
  const incoming = [{ employeeId: "e1", stationId: "s1", trainings: [{ id: "t2" }], medicalExams: [], heldDocuments: [] },
    { employeeId: "e2", stationId: "s2", trainings: [], medicalExams: [{ id: "forged" }], heldDocuments: [] }];
  const out = ts.mergeEmployerDutyRoster(prior, incoming, (row) => row.stationId === "s1");
  const e1 = out.find((r) => r.employeeId === "e1");
  const e2 = out.find((r) => r.employeeId === "e2");
  assert.deepEqual(e1.trainings.map((r) => r.id).sort(), ["t1", "t2"]);
  assert.equal(e1.medicalExams.length, 1);
  assert.deepEqual(e2, prior[1]);
});

t("medical exams and trainings are redacted from other employees' records", () => {
  assert.ok(SENSITIVE_EMPLOYEE_FIELDS.includes("medicalExams"));
  assert.ok(SENSITIVE_EMPLOYEE_FIELDS.includes("trainings"));
  assert.equal(BLOB_VISIBILITY.employerDuties, "self");
  const rows = [{ id: "e1", employeeId: "e1" }, { id: "e2", employeeId: "e2" }];
  assert.deepEqual(filterBlobPayload("employerDuties", rows, ctx({ userId: "e2" })).map((r) => r.id), ["e2"]);
});

/* ----------------------------- 3. discipline sync exclusion ----------------------------- */
t("disciplinaryCases are hydrated but never pushed by the generic sync", () => {
  const store = readFileSync(new URL("../src/lib/store.js", import.meta.url), "utf8");
  const blob = store.match(/export const BLOB_CATEGORIES = \[([\s\S]*?)\];/)[1];
  for (const c of ["disciplinaryCases", "workRegulation", "trainingPlan", "employerDuties"]) assert.ok(blob.includes(`"${c}"`), c);
  assert.equal(isServerActionCategory("disciplinaryCases"), true);
  assert.equal(NOT_PUSHED_AS_IS.employerDuties, "derived");
  const pushed = pushableBlobCategories(["tasks", "disciplinaryCases", "workRegulation", "employerDuties"]);
  assert.deepEqual(pushed, ["tasks", "workRegulation"]);
  assert.match(store, /pushableBlobCategories\(BLOB_CATEGORIES\)\.forEach/);
  assert.match(store, /if \(isServerActionCategory\(category\)\) return;/);
  const dir = readFileSync(new URL("../base44/functions/companyDirectory/entry.ts", import.meta.url), "utf8");
  assert.match(dir, /DISCIPLINE_VIA_ACTION/);
});

t("a stage sets only its own fields on top of the server row", () => {
  const existing = { id: "c1", employeeId: "e1", status: "hearing", penaltyKind: "fine", cutDays: 2, messages: [{ id: "m1" }] };
  const appeal = ts.planDisciplineStageWrite("appeal", existing, { ...existing, status: "closed", cutDays: 0, penaltyKind: "warning", appealNote: "ظلمت", appealedAt: "2026-01-01" });
  assert.equal(appeal.ok, true);
  assert.equal(appeal.row.status, "appeal");
  assert.equal(appeal.row.cutDays, 2);
  assert.equal(appeal.row.penaltyKind, "fine");
  assert.equal(appeal.row.appealNote, "ظلمت");
  const msg = ts.planDisciplineStageWrite("message", existing, { messages: [{ id: "m2" }], status: "closed" });
  assert.deepEqual(msg.row.messages.map((m) => m.id), ["m1", "m2"]);
  assert.equal(msg.row.status, "hearing");
  const dropMsg = ts.planDisciplineStageWrite("message", existing, { messages: [] });
  assert.equal(dropMsg.row.messages.length, 1);
  assert.equal(ts.planDisciplineStageWrite("sign", null, { id: "c9" }).error, "DISCIPLINE_CASE_MISSING");
  assert.equal(ts.planDisciplineStageWrite("raise", { ...existing, status: "notify" }, existing).error, "DISCIPLINE_CASE_EXISTS");
  assert.equal(ts.planDisciplineStageWrite("withdraw", existing, {}).error, "DISCIPLINE_NO_APPEAL");
  assert.equal(ts.planDisciplineStageWrite("bogus", existing, {}).error, "STAGE_REQUIRED");
  assert.equal(ts.planDisciplineStageWrite("ruling", { ...existing, status: "appeal" }, { status: "closed", rulingOutcome: "void" }).row.status, "closed");
  assert.deepEqual(ts.DISCIPLINE_WORKER_STAGES, ["appeal", "withdraw", "message"]);
});

/* ----------------------------- 4. abuse cases ----------------------------- */
const CASES = [
  { id: "a1", userId: "rep", reporterId: "rep", accusedId: "acc", committee: { members: [{ id: "m1" }, { id: "m2" }] } },
  { id: "a2", userId: "rep2", reporterId: "rep2", accusedId: "acc", committee: null },
];

t("filer, named committee members and senior HR read a case; nobody else", () => {
  assert.equal(BLOB_VISIBILITY.abuseCases, "abuse");
  const ids = (userId, senior = false) => filterBlobPayload("abuseCases", CASES, ctx({ userId, senior })).map((r) => r.id);
  assert.deepEqual(ids("rep"), ["a1"]);
  assert.deepEqual(ids("m1"), ["a1"]);
  assert.deepEqual(ids("acc"), []);
  assert.deepEqual(ids("other"), []);
  assert.deepEqual(ids("", false), []);
  assert.deepEqual(ids("x", true), ["a1", "a2"]);
  // HR with a level but not senior and not on the committee: still nothing
  assert.deepEqual(filterBlobPayload("abuseCases", CASES, ctx({ userId: "hr1", permissions: new Set(["manage_complaints", "manage_employees"]), scope: null })).map((r) => r.id), []);
  for (const row of CASES) for (const u of ["rep", "m1", "acc", "x"]) assert.equal(js.canReadAbuseCase(row, { userId: u }), ts.canReadAbuseCase(row, { userId: u }));
});

t("committee member writes investigation fields of their case only; filer adds their own new case", () => {
  const incoming = [
    { ...CASES[0], hearings: [{ who: "rep" }], status: "investigating", committee: { members: [{ id: "m1" }, { id: "intruder" }] }, accusedId: "changed" },
    { ...CASES[1], status: "closed" },
    { id: "a3", userId: "m1", reporterId: "m1", committee: { members: [{ id: "m1" }] }, status: "decided" },
  ];
  const out = ts.mergeAbuseCasesWrite(CASES, incoming, "m1");
  const a1 = out.find((r) => r.id === "a1");
  assert.equal(a1.status, "investigating");
  assert.equal(a1.hearings.length, 1);
  assert.equal(a1.accusedId, "acc");
  assert.equal(a1.committee.members.length, 2);
  assert.equal(out.find((r) => r.id === "a2").status, undefined);
  const a3 = out.find((r) => r.id === "a3");
  assert.equal(a3.status, "filed");
  assert.equal(a3.committee, null);
  // nothing deleted by a partial snapshot
  assert.equal(ts.mergeAbuseCasesWrite(CASES, [], "m1").length, 2);
  // someone else's new case is not accepted
  assert.equal(ts.mergeAbuseCasesWrite(CASES, [{ id: "a4", reporterId: "rep" }], "m1").length, 2);
});

t("promoted bags: an empty server answer keeps an unpushed local copy", () => {
  assert.equal(js.keepLocalOverEmptyServer("workRegulation", {}, REG), true);
  assert.equal(js.keepLocalOverEmptyServer("workRegulation", [], REG), true);
  assert.equal(js.keepLocalOverEmptyServer("workRegulation", REG, REG), false);
  assert.equal(js.keepLocalOverEmptyServer("tasks", [], [{ id: 1 }]), false);
});

console.log(`test-sync-law: ${n} checks passed`);
