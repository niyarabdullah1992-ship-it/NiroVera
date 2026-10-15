import assert from "node:assert/strict";
import {
  MODEL_GROUPS, MODEL_REGULATION, checkPublishRegulationGate, checkRegulationDraft, compareToRegulation,
  parseRegulationStep, planRegulationAck, regulationAckStatus, regulationNextStep, regulationStanding,
} from "../src/lib/workRegulation.js";
import * as js from "../src/lib/disciplineDerivations.js";
import * as ts from "../base44/shared/disciplineDerivations.ts";
import { addDaysExcludingOfficialHolidays, disciplineDeadlines } from "../src/lib/disciplineDeadlines.js";
import { disciplineSheet } from "../src/lib/disciplineDoc.js";
import {
  abuseCaseClocks, abuseRetaliationFlags, addWorkingDays, checkAbuseCommitteeGate, checkAbuseHearingGate,
  checkAbuseOutcomeGate, checkFileAbuseGate, planAbuseCase, planAbuseNotices,
} from "../src/lib/abuseComplaint.js";
import {
  checkHiringAgeGate, checkMedicalExamGate, checkServiceCertificateGate, checkTrainingBondGate, checkTrainingRecordGate,
  deriveTrainingRegister, heldDocumentViolations, medicalExamStatus, payEquityReview, trainingDocumentationDue, trainingRepayment,
} from "../src/lib/employerDuties.js";
import { checkContractAckGate, checkContractRequiredContent, checkContractSaveGate, contractModelFields, contractSheet } from "../src/lib/contractDocument.js";
import { checkProbationGate } from "../src/lib/contractLawDerivations.js";
import { checkProbationGate as checkProbationGateTs } from "../base44/shared/contractLawDerivations.ts";
import { gosiTasks } from "../src/lib/gosiFollowUp.js";
import { deriveInspectionPack } from "../src/lib/inspectionPackDerivations.js";

const T = "2026-10-15";
const byId = (id) => MODEL_REGULATION.clauses.find((c) => c.id === id);

/* 1 — Annex 1 tables, transcribed */
assert.equal(MODEL_REGULATION.clauses.length, 50);
assert.deepEqual(MODEL_GROUPS.map((g) => MODEL_REGULATION.clauses.filter((c) => c.group === g.id).length), [16, 18, 16]);
assert.equal(new Set(MODEL_REGULATION.clauses.map((c) => c.id)).size, 50, "stable unique ids");
assert.deepEqual(byId("absent1").steps, ["50%", "يوم", "يومان", "ثلاثة أيام"]);
assert.deepEqual(byId("early").steps, ["إنذار كتابي", "10%", "25%", "يوم"]);
assert.deepEqual(byId("ppe").steps, ["إنذار كتابي", "يوم", "يومان", "خمسة أيام"]);
for (const id of ["smoke", "custody"]) assert.deepEqual(byId(id).steps, ["يومان", "ثلاثة أيام", "خمسة أيام", "فصل مع المكافأة"]);
assert.deepEqual(byId("late15").steps, ["إنذار كتابي", "5%", "10%", "20%"]);
assert.deepEqual(byId("conduct_14").steps, ["ثلاثة أيام", "خمسة أيام", "فصل مع المكافأة"]);
assert.equal(byId("time_15").steps.length, 1);
for (const c of MODEL_REGULATION.clauses) for (const s of c.steps) assert.ok(parseRegulationStep(s).ok, `${c.id}: ${s}`);

/* 2 — all penalty types read; a copied model passes the draft check */
assert.equal(parseRegulationStep("لفت نظر").kind, "warning");
assert.equal(parseRegulationStep("ثلاثة أيام").days, 3);
assert.deepEqual(parseRegulationStep("إيقاف عن العمل يومين بدون أجر"), { ok: true, kind: "suspend", days: 2 });
assert.equal(parseRegulationStep("تأجيل الترقية").kind, "promotion");
assert.equal(parseRegulationStep("الحرمان من العلاوة").kind, "increment");
const either = parseRegulationStep("تأجيل الترقية أو الحرمان من العلاوة لمرة واحدة");
assert.deepEqual(either.either, ["promotion", "increment"]);
assert.equal(compareToRegulation("increment", 0, either), "same");
assert.equal(parseRegulationStep("فصل مع المكافأة").kind, "dismissal_with_award");
assert.equal(parseRegulationStep("الفصل من العمل طبقاً للمادة (الثمانين) من نظام العمل").kind, "dismiss");
assert.equal(parseRegulationStep("-------").ok, false);
assert.deepEqual(checkRegulationDraft({ approvalNo: "1", approvedAt: "2026-01-01", clauses: MODEL_REGULATION.clauses }), []);
assert.ok(js.DISCIPLINE_PENALTY_KINDS.some((k) => k.id === "dismissal_with_award"));
assert.equal(js.checkListedPenaltyGate({ penaltyKind: "dismissal_with_award" }, T).ok, true);
assert.equal(js.resolvePenaltyKind({ penalty: "فصل مع المكافأة" }), "dismissal_with_award");

/* 6 — Art. 80 */
const emp = { id: "e1", name: "سالم", stationId: "s1" };
assert.equal(js.checkRaiseDisciplineGate({ employee: emp, actor: { id: "m" }, note: "اعتداء", penaltyKind: "dismiss", dismissGround: "ضرب", today: T }).error, "DISCIPLINE_DISMISS_GROUND");
assert.equal(js.checkRaiseDisciplineGate({ employee: emp, actor: { id: "m" }, note: "اعتداء", penaltyKind: "dismiss", dismissGround: "assault", today: T }).ok, true);
const absence = { employeeId: "e1", penaltyKind: "dismiss", dismissGround: "absence", hearingEndedAt: "2026-10-14", art80: { mode: "consecutive", days: 16, warnedAt: "2026-10-10", warnedAtDays: 10 } };
assert.equal(js.checkArt80DismissGate(absence, { today: T }).ok, true);
assert.equal(js.checkArt80DismissGate({ ...absence, art80: { ...absence.art80, warnedAt: "" } }, { today: T }).error, "ART80_ABSENCE_WARNING_REQUIRED");
assert.equal(js.checkArt80DismissGate({ ...absence, art80: { ...absence.art80, warnedAtDays: 8 } }, { today: T }).error, "ART80_ABSENCE_WARNING_EARLY");
assert.equal(js.checkArt80DismissGate({ ...absence, art80: { ...absence.art80, days: 15 } }, { today: T }).error, "ART80_ABSENCE_UNDER_LIMIT");
assert.equal(js.checkArt80DismissGate({ ...absence, art80: { mode: "intermittent", days: 31, warnedAt: "2026-10-01", warnedAtDays: 19 } }, { today: T }).error, "ART80_ABSENCE_WARNING_EARLY");
assert.equal(js.checkArt80DismissGate({ ...absence, hearingEndedAt: "" }, { today: T }).error, "ART80_OBJECTION_REQUIRED");
assert.equal(js.checkArt80DismissGate({ employeeId: "e1", dismissGround: "duties", hearingMinutes: "سُمع" }, { today: T }).error, "ART80_WARNING_REQUIRED");
assert.equal(js.checkAwardDismissGate({}, { today: T }).error, "DISCIPLINE_AWARD_DISMISS_REASON");
assert.equal(js.art80AbsenceFromReading({ consecutive: { value: 12, notice: 10, limit: 15 } }).days, 12);

/* 4 — backend parity on the sign/raise gates */
const priors = [{ id: "p1", employeeId: "e1", penaltyKind: "fine", cutDays: 3, signedAt: "2026-10-02", note: "تأخر" }];
const signCases = [
  { id: "c1", employeeId: "e1", penaltyKind: "fine", cutDays: 3, hearingEndedAt: "2026-10-12", note: "غياب" },
  { id: "c2", employeeId: "e1", penaltyKind: "fine", cutDays: 1, hearingEndedAt: "2026-10-12", note: "تأخر" },
  { id: "c3", employeeId: "e1", penaltyKind: "fine", cutDays: 2, hearingEndedAt: "2026-08-01", note: "سهو" },
  { id: "c4", employeeId: "e1", penaltyKind: "fine", cutDays: 7, hearingEndedAt: "2026-10-12", note: "إهمال" },
  { id: "c5", employeeId: "e1", penaltyKind: "dismiss", dismissGround: "x", hearingEndedAt: "2026-10-12", note: "اعتداء" },
  { id: "c6", employeeId: "e1", penaltyKind: "dismiss", dismissGround: "assault", hearingEndedAt: "2026-10-12", note: "اعتداء" },
  { id: "c7", employeeId: "e1", penaltyKind: "dismissal_with_award", hearingEndedAt: "2026-10-12", note: "تدخين" },
  { id: "c8", employeeId: "e1", penaltyKind: "fine", cutDays: 1, hearingEndedAt: "2026-10-12", note: "أكل", regulationClauseId: "org_10" },
];
const ownAnnounced = { source: "own", clauses: [{ id: "org_10", steps: ["10%"] }], announcedAt: T };
for (const row of signCases) {
  for (const regulation of [null, ownAnnounced]) {
    const a = js.checkSignDisciplineGate(row, { today: T, cases: priors, regulation });
    const b = ts.checkSignDisciplineGate(row, { today: T, cases: priors, regulation });
    assert.equal(a.ok, b.ok, `sign parity ok ${row.id}`);
    assert.equal(a.error, b.error, `sign parity error ${row.id}`);
  }
}
assert.equal(js.checkSignDisciplineGate(signCases[0], { today: T, cases: priors }).error, "DISCIPLINE_MONTH_CAP");
assert.equal(js.checkSignDisciplineGate(signCases[1], { today: T, cases: priors }).error, "DISCIPLINE_DOUBLE_PENALTY");
assert.equal(js.checkSignDisciplineGate(signCases[2], { today: T, cases: [] }).error, "DISCIPLINE_PENALTY_STALE");
assert.equal(js.checkSignDisciplineGate(signCases[7], { today: T, cases: [], regulation: ownAnnounced }).error, "DISCIPLINE_REGULATION_NOT_IN_FORCE");
for (const input of [
  { employee: emp, actor: { id: "m" }, note: "تأخر", penaltyKind: "fine", cutDays: 1, today: T, cases: priors },
  { employee: emp, actor: { id: "m" }, note: "x", penaltyKind: "fine", cutDays: 9, today: T },
  { employee: emp, actor: { id: "m" }, note: "x", penaltyKind: "dismiss", dismissGround: "free", today: T },
  { employee: emp, actor: { id: "m" }, note: "x", penaltyKind: "warning", discoveredAt: "2026-08-01", today: T },
]) {
  const a = js.checkRaiseDisciplineGate(input);
  const b = ts.checkRaiseDisciplineGate(input);
  assert.equal(a.error, b.error, `raise parity ${a.error}`);
}
// 180-day repeat in both.
const old = [{ id: "o", employeeId: "e1", penaltyKind: "warning", signedAt: "2026-01-01" }];
assert.equal(js.checkDisciplineRepeatGate({ id: "n", employeeId: "e1", penaltyKind: "fine", cutDays: 2 }, { cases: old, today: T }).error, ts.checkDisciplineRepeatGate({ id: "n", employeeId: "e1", penaltyKind: "fine", cutDays: 2 }, { cases: old, today: T }).error);

/* 5 — decision states penalty, amount, repeat step, delivery */
const own = { source: "own", clauses: [{ id: "late", steps: ["إنذار كتابي", "10%", "يوم"] }] };
assert.equal(regulationNextStep(own, "late", 1).label, "غرامة 10% من أجر يوم");
assert.equal(regulationNextStep(own, "late", 5).label, "غرامة أجر يوم", "last step once used up");
assert.match(js.disciplineRepeatLine({ regulationNext: "غرامة أجر يوم" }), /180 يوماً.*غرامة أجر يوم/);
const sheet = disciplineSheet({ item: { id: "c", note: "تأخر", penaltyKind: "fine", cutDays: 1, signedAt: "2026-10-10", notifyMethod: "email", notifyDeliveredAt: "2026-10-11", notifyRef: "M-1", regulationNext: "غرامة أجر يومين" }, signedAt: "2026-10-10", employee: { name: "سالم" }, wage: 3000, face: {} }, true);
assert.ok(sheet.facts.some((f) => /التكرار/.test(f.label) && /يومين/.test(f.value)));
assert.ok(sheet.blocks.some((b) => b.type === "table" && b.rows.some((r) => /☑/.test(r[0]) && r[2] === "M-1")));
const person = { id: "e1", email: "", profile: {} };
assert.equal(js.checkDisciplineDeliveryGate({ method: "hand", at: "2026-10-11", signedAt: "2026-10-10", today: T }).ok, true);
assert.equal(js.checkDisciplineDeliveryGate({ method: "email", at: "2026-10-11", employee: person, today: T }).error, "DISCIPLINE_DELIVERY_EMAIL");
assert.equal(js.checkDisciplineDeliveryGate({ method: "registered_mail", at: "2026-10-11", ref: "", today: T }).error, "DISCIPLINE_DELIVERY_REF");
assert.equal(js.checkDisciplineDeliveryGate({ method: "fax", at: "2026-10-11", today: T }).error, "DISCIPLINE_DELIVERY_METHOD");

/* 8 — announce, effective next day, acknowledgements */
const reg = { source: "own", approvalNo: "9", approvedAt: "2026-01-01", clauses: [{ id: "a", ar: "تأخر", steps: ["إنذار كتابي"] }], savedAt: "2026-01-02T00:00:00" };
assert.equal(regulationStanding(reg, T).id, "draft");
assert.equal(checkPublishRegulationGate(reg, { today: T }).effectiveFrom, "2026-10-16");
assert.equal(checkPublishRegulationGate(MODEL_REGULATION).error, "REGULATION_NOT_RECORDED");
const announced = { ...reg, announcedAt: T };
assert.equal(regulationStanding(announced, T).id, "announced");
assert.equal(regulationStanding(announced, "2026-10-16").id, "inForce");
const plan = planRegulationAck(announced, { id: "e1", name: "سالم" }, "2026-10-15T10:00:00Z");
const acked = { ...announced, acks: { e1: plan.ack } };
const st = regulationAckStatus(acked, [{ id: "e1" }, { id: "e2", name: "فهد" }]);
assert.equal(st.acked.length, 1);
assert.deepEqual(st.pending.map((p) => p.employee.id), ["e2"]);
assert.equal(regulationAckStatus({ ...acked, savedAt: "2026-11-01T00:00:00" }, [{ id: "e1" }]).pending.length, 1, "a new version needs a new acknowledgement");
assert.equal(planRegulationAck(reg, { id: "e1" }).error, "REGULATION_NOT_ANNOUNCED");
const chips = js.deriveRaiseDisciplineChips({ employee: emp, note: "x", today: T, penaltyKind: "warning", regulation: { ...announced, clauses: [{ id: "a", steps: ["إنذار كتابي"] }] }, clauseId: "a" });
assert.equal(chips.find((c) => c.key === "67").state, "fail", "not in force until the day after announcement");

/* 3 — workplace abuse cases (model Arts. 54–56) */
const cal = undefined;
assert.equal(addWorkingDays("2026-10-15", 5, { calendar: cal }), "2026-10-22", "Thu + 5 working days skipping Fri/Sat");
const base = { role: "victim", kind: "sexual", incidentAt: "2026-10-15", accusedId: "e2", reporterId: "e1", description: "تحرش لفظي في المستودع", calendar: cal };
assert.equal(checkFileAbuseGate({ ...base, filedAt: "2026-10-22" }).ok, true);
const late = checkFileAbuseGate({ ...base, filedAt: "2026-10-25" });
assert.equal(late.error, "ABUSE_FILING_LATE");
assert.equal(late.route, "government");
assert.equal(checkFileAbuseGate({ ...base, role: "witness", filedAt: "2026-12-01" }).ok, true, "a witness has no five-day limit");
assert.equal(checkFileAbuseGate({ ...base, accusedTop: true, filedAt: T }).route, "government");
assert.equal(checkFileAbuseGate({ ...base, accusedId: "e1", filedAt: T }).error, "ABUSE_SELF");
const row = planAbuseCase({ reporter: { id: "e1", name: "سارة" }, accused: { id: "e2", name: "خالد" }, kind: "sexual", incidentAt: T, description: "x", filedAt: "2026-10-15T08:00:00Z" });
assert.equal(row.userId, "e1");
assert.equal(checkAbuseCommitteeGate(row, { members: [{ id: "e2" }], decisionRef: "1" }).error, "ABUSE_COMMITTEE_PARTY");
assert.equal(checkAbuseCommitteeGate(row, { members: [{ id: "e3" }], decisionRef: "" }).error, "ABUSE_COMMITTEE_DECISION");
assert.equal(checkAbuseHearingGate({ who: "سارة", role: "complainant", statement: "حدث كذا", signedByParty: true, signedByCommittee: false }).error, "ABUSE_HEARING_SIGNED");
const withCommittee = { ...row, committee: { members: [{ id: "e3" }] }, hearings: [{ role: "complainant" }] };
assert.equal(checkAbuseOutcomeGate(withCommittee, { outcome: "proven", recommendation: "ثلاثة أيام" }).error, "ABUSE_PARTIES_UNHEARD");
const heard = { ...withCommittee, hearings: [{ role: "complainant" }, { role: "accused" }] };
assert.equal(checkAbuseOutcomeGate(heard, { outcome: "proven", recommendation: "سلوك 10 — يومان", criminal: true }).error, "ABUSE_CRIMINAL_REFERRAL");
assert.equal(checkAbuseOutcomeGate(heard, { outcome: "malicious", recommendation: "سلوك 14 — ثلاثة أيام" }).ok, true);
const clk = abuseCaseClocks(row, { today: "2026-10-21", calendar: cal })[0];
assert.equal(clk.due, "2026-10-22");
assert.equal(clk.left, 1);
assert.equal(abuseCaseClocks(row, { today: "2026-10-26", calendar: cal })[0].over, true);
const notes = planAbuseNotices({ cases: [row], today: "2026-10-21", calendar: cal, audience: [{ id: "hr" }, { id: "e2" }] });
assert.deepEqual(notes.map((n) => n.userId), ["hr"], "the accused never hears of it");
assert.equal(abuseRetaliationFlags(row, [{ id: "d", employeeId: "e1", createdAt: "2026-10-18" }]).length, 1);

/* 7 — contract from the unified model */
const worker = { id: "e1", name: "سالم", nationality: "سعودي", nationalId: "1010", position: "فني", profile: { baseSalary: 6000, housingAllowance: 1500, address: "الرس", hireDate: "2026-11-01", contractType: "indefinite" } };
const fields = contractModelFields({ employee: worker, company: { name: "شركة نيرو", address: "الرياض" }, station: { name: "محطة الرس" }, today: T });
assert.deepEqual(checkContractRequiredContent(fields), []);
assert.equal(fields.wage.total, 7500);
assert.equal(fields.annualLeave, 21);
const missing = checkContractRequiredContent(contractModelFields({ employee: { ...worker, profile: { ...worker.profile, address: "" } }, company: { name: "x" }, today: T }));
assert.ok(missing.includes("عنوان إقامة العامل") && missing.includes("مكان صاحب العمل (العنوان)") && missing.includes("مكان العمل"));
assert.equal(checkContractSaveGate({ fields, generated: false, hasFile: false }).error, "CONTRACT_DOCUMENT_REQUIRED");
assert.equal(checkContractSaveGate({ fields: { ...fields, type: "fixed", end: "" }, generated: true }).error, "CONTRACT_CONTENT_MISSING");
assert.equal(checkContractSaveGate({ fields, generated: true }).ok, true);
assert.match(contractSheet(fields).blocks.map((b) => b.body || "").join(" "), /نسختين باللغة العربية/);
assert.equal(checkContractAckGate({ contract: { generated: true }, employee: worker, viewerId: "hr", ack: true }).error, "CONTRACT_ACK_SELF");
assert.equal(checkContractAckGate({ contract: { generated: true }, employee: worker, viewerId: "e1", ack: true }).ok, true);

/* 9 — training */
const trec = { employeeId: "e1", course: "إسعافات أولية", kind: "safety", from: "2026-09-01", to: "2026-09-10", hours: 30, provider: "الهلال الأحمر", cost: 2000 };
assert.equal(checkTrainingRecordGate(trec).ok, true);
assert.equal(checkTrainingRecordGate({ ...trec, provider: "" }).error, "TRAINING_PROVIDER");
assert.equal(checkTrainingBondGate({ record: trec, bondDays: 11 }).error, "TRAINING_BOND_OVER");
assert.equal(checkTrainingBondGate({ record: trec, bondDays: 10 }).ok, true);
assert.equal(checkTrainingBondGate({ record: trec, bondDays: 8, contractType: "fixed", contractEndDate: "2026-09-15" }).max, 5);
assert.equal(trainingRepayment(trec, { case: "quit_training", date: "2026-09-05" }).due, 2000);
assert.equal(trainingRepayment(trec, { case: "art80", art80Para: 6, date: "2026-09-05" }).due, 0, "Art. 80(6) probation is excluded");
assert.equal(trainingRepayment({ ...trec, bond: { days: 10 } }, { case: "refused_bond", date: "2026-09-15" }).due, 1000, "share of the remaining bond");
assert.equal(trainingDocumentationDue(trec, T).over, true);
const regT = deriveTrainingRegister({ employees: [{ id: "e1", name: "سالم", nationality: "سعودي", trainings: [trec] }, { id: "e2", nationality: "سعودي" }], today: T });
assert.equal(regT.trained, 1);
assert.equal(regT.saudiShare, 0.5);
assert.equal(regT.safetyShare, 0.5);

/* 10 — medical exams */
const exposed = { id: "e1", name: "سالم", profile: { occupationalExposure: true, hireDate: "2025-01-01" }, medicalExams: [{ at: "2025-09-01", result: "سليم" }] };
assert.equal(medicalExamStatus(exposed, T).over, true);
assert.equal(medicalExamStatus({ ...exposed, medicalExams: [{ at: "2025-11-01", result: "سليم" }] }, T).soon, true);
assert.equal(medicalExamStatus({ id: "x", profile: {} }, T).required, false);
assert.equal(checkMedicalExamGate({ at: "2026-01-01", doctor: "د. علي" }).error, "MEDICAL_EXAM_RESULT");

/* 11 — documents held */
assert.equal(heldDocumentViolations({ id: "e9", nationality: "هندي", profile: { heldDocuments: [{ kind: "passport", heldSince: "2026-01-01" }] } }).length, 1);
assert.equal(heldDocumentViolations({ id: "e9", nationality: "هندي", profile: { heldDocuments: [{ kind: "passport", heldSince: "2026-01-01", returnedAt: "2026-02-01" }] } }).length, 0);
assert.equal(heldDocumentViolations({ id: "e8", nationality: "سعودي", profile: { heldDocuments: [{ kind: "passport", heldSince: "2026-01-01" }] } }).length, 0);
const pack = deriveInspectionPack({ employees: [exposed, { id: "e9", nationality: "هندي", profile: { heldDocuments: [{ kind: "iqama", heldSince: "2026-01-01" }] } }], disciplinaryCases: [], safety: [], payrollRuns: [] });
assert.equal(pack.registers.find((r) => r.id === "held_documents").violation, true);
assert.equal(pack.registers.find((r) => r.id === "medical").article, "143");
assert.ok(pack.registers.find((r) => r.id === "training"));

/* 12 — pay equity */
const staff = [
  { id: "a", position: "فني", profile: { gender: "male", baseSalary: 8000 } },
  { id: "b", position: "فني", profile: { gender: "female", baseSalary: 6000 } },
  { id: "c", position: "مدير", profile: { gender: "female", baseSalary: 9000 } },
];
const eq = payEquityReview({ employees: staff, today: T });
assert.equal(eq.items.length, 1);
assert.equal(eq.items[0].dimension, "gender");
assert.match(eq.items[0].reason, /المادة 61\/4/);
assert.equal(payEquityReview({ employees: staff, threshold: 0.3 }).items.length, 0);

/* 13 — injury on a safety card opens the GOSI task, deduped with the injury leave */
const company = { safety: [{ stationId: "s1", incidentLog: [
  { id: "i1", at: "2026-10-10T08:00:00Z", reporterId: "e1", card: { injured: true, injuredSelf: true, reporterId: "e1" } },
  { id: "i2", at: "2026-10-12T08:00:00Z", reporterId: "e1", card: { injured: true, injuredSelf: false, injuredName: "فهد" } },
] }] };
const people = [
  { id: "e1", name: "سالم", profile: {}, leaveRequests: [{ id: "l1", type: "work_injury", status: "approved", injuryDate: "2026-10-10" }] },
  { id: "e2", name: "فهد", profile: {} },
];
const gt = gosiTasks({ employees: people, company, today: T });
assert.equal(gt.filter((t) => t.kind === "injury").length, 2);
assert.equal(gt.find((t) => t.employeeId === "e2" && t.kind === "injury").due, "2026-10-22");
assert.equal(gosiTasks({ employees: people, company, today: T, injuryCovered: false }).find((t) => t.employeeId === "e2").kind, "injury_office");
assert.equal(gosiTasks({ employees: people, company, today: T, injuryCovered: false }).find((t) => t.employeeId === "e2").due, "2026-10-19");

/* 14 — second probation in writing; contiguous split stated at signing */
const second = { probation: true, probationDays: 90, probationPriorAtEmployer: true, probationOtherProfession: true };
assert.equal(checkProbationGate(second).error, "PROBATION_SECOND_WRITTEN");
assert.equal(checkProbationGate({ ...second, probationSecondWritten: true, probationSecondFile: { name: "a.pdf" } }).ok, true);
const split = { probation: true, probationDays: 90, probationSegments: [{ from: "2026-01-01", to: "2026-02-14" }, { from: "2026-02-16", to: "2026-03-31" }], probationSegmentsAtSigning: true };
assert.equal(checkProbationGate(split).error, "PROBATION_SPLIT_GAP");
assert.equal(checkProbationGate({ ...split, probationSegments: [{ from: "2026-01-01", to: "2026-02-14" }, { from: "2026-02-15", to: "2026-03-31" }] }).ok, true);
assert.equal(checkProbationGate({ ...split, probationSegmentsAtSigning: false }).error, "PROBATION_SPLIT_UNSTATED");
assert.equal(checkProbationGateTs(split).error, "PROBATION_SPLIT_GAP", "backend twin");

/* 15 — ruling excludes official holidays; juvenile; service certificate */
// Appeal two days before Founding Day (22 Feb): 15 days excluding it end one day later.
assert.equal(addDaysExcludingOfficialHolidays("2027-02-20", 15), "2027-03-08");
assert.equal(js.checkAdvanceDisciplineGate({ employeeId: "e1", appealedAt: "2027-02-20" }, "ruling", { today: "2027-03-08" }).ok, true);
assert.equal(js.checkAdvanceDisciplineGate({ employeeId: "e1", appealedAt: "2027-02-20" }, "ruling", { today: "2027-03-09" }).error, "DISCIPLINE_RULING_LATE");
assert.equal(ts.checkAdvanceDisciplineGate({ employeeId: "e1", appealedAt: "2027-02-20" }, "ruling", { today: "2027-03-08" }).ok, true);
const rule = disciplineDeadlines({ cases: [{ id: "x", employeeId: "e1", status: "appeal", appealedAt: "2027-02-20" }], today: "2027-03-01" }).find((r) => r.kind === "ruling");
assert.equal(rule.due, "2027-03-08");
assert.equal(checkHiringAgeGate({ birthDate: "2012-01-01", hireDate: T }).error, "HIRE_UNDER_MIN_AGE");
assert.equal(checkHiringAgeGate({ birthDate: "2010-01-01", hireDate: T }).juvenile, true);
assert.equal(checkHiringAgeGate({ birthDate: "", hireDate: T }).ok, true);
assert.equal(checkServiceCertificateGate({ profile: { hireDate: "2020-01-01", baseSalary: 5000 }, position: "فني" }).ok, true, "still in service");
assert.equal(checkServiceCertificateGate({ profile: { hireDate: "2020-01-01", contractExit: {} }, position: "" }).error, "SERVICE_CERT_FIELDS");

console.log("disc law ok");
