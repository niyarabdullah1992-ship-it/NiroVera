import assert from "node:assert/strict";
import { articleOfficialText } from "../src/lib/laborArticleTexts.js";
import { citeLeaveType, isRamadanHoursSubject, ruleValue, explainRule } from "../src/lib/laborRules.js";
import { getLeaveTotal, isNursingSubject, iddahPaidDays, iddahSpanFromEvent, leaveCiteRuleId, leaveTypeLabel, leaveTypesForProfile, maternityFollowOnSpan, statutoryLeaveFloor } from "../src/lib/leaveTypes.js";
import { checkApproveLeaveGate, checkExamSittingSettleGate, checkLeaveGenderGate, checkRejectLeaveGate, checkSubmitLeaveGate, examStatuteOf, leaveNeedsAttachment } from "../src/lib/leaveDerivations.js";
import {
  checkRevokeStudyConsentGate,
  EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID,
  EXAM_LEAVE_TRACK_FALLBACK_AR,
  EXAM_LEAVE_TRACK_PAID,
  EXAM_LEAVE_TRACK_PAID_AR,
  hasIrrevocableStudyConsent,
  STUDY_CONSENT_IRREVOCABLE_AR,
  STUDY_CONSENT_TYPE,
} from "../src/lib/otherRequestDerivations.js";
import { leaveCatalogFor } from "../src/lib/employeeFileView.js";
import { leaveKindsFor } from "../src/lib/requestWorkspace.js";

const SHARED = ["annual", "grant", "sick", "exam", "marriage", "bereavement", "bereavement_sibling", "eid", "emergency", "unpaid"];
const FEMALE_ONLY = ["maternity", "maternity_extend", "maternity_companion", "iddah"];
const MALE_ONLY = ["paternity"];
const MUSLIM_ONLY = ["hajj"];
const HIRE = "2020-01-01";

const muslimFemale = { hireDate: HIRE, gender: "female", religion: "muslim" };
const muslimMale = { hireDate: HIRE, gender: "male", religion: "muslim" };
const emptyReligionFemale = { hireDate: HIRE, gender: "female" };
const emptyReligionMale = { hireDate: HIRE, gender: "male" };
const nonMuslimFemale = { hireDate: HIRE, gender: "female", religion: "non_muslim" };
const nonMuslimMale = { hireDate: HIRE, gender: "male", religion: "non_muslim" };

function keysOf(profile) {
  return leaveTypesForProfile(profile).map((row) => row.key);
}

function has(profile, key) {
  return keysOf(profile).includes(key);
}

const art113 = articleOfficialText("113");
assert.match(art113.ar, /\(?خمسة\)? أيام عند زواجه/);
assert.match(art113.ar, /وفاة زوجه أو أحد أصوله أو فروعه/);
assert.match(art113.ar, /\(?ثلاثة\)? أيام في حالة وفاة الأخ/);
assert.match(art113.ar, /\(?ثلاثة\)? أيام في حالة ولادة مولود له/);
assert.match(art113.ar, /\(?سبعة\)? أيام من تاريخ الولادة/);
assert.match(art113.ar, /إجازات المرأة العاملة/);

const art114 = articleOfficialText("114");
assert.match(art114.ar, /فريضة الحج/);
assert.match(art114.ar, /عشرة أيام/);
assert.match(art114.ar, /خمسة عشر/);
assert.match(art114.ar, /عيد الأضحى/);
assert.match(art114.ar, /سنتين متصلتين/);

const art151 = articleOfficialText("151");
assert.match(art151.ar, /للمرأة العاملة/);
assert.match(art151.ar, /\(?اثني عشر\)?[\u064b]* أسبوعاً/);
assert.match(art151.ar, /الأسابيع الستة التالية للوضع/);

const art160 = articleOfficialText("160");
assert.match(art160.ar, /للمرأة العاملة المسلمة/);
assert.match(art160.ar, /أربعة أشهر وعشرة أيام/);
assert.match(art160.ar, /حاملاً/);
assert.match(art160.ar, /للمرأة العاملة غير المسلمة/);
assert.match(art160.ar, /خمسة عشر يوماً/);

assert.equal(ruleValue("leave.maternity.days", "2026-09-16"), 84);
assert.equal(ruleValue("leave.paternity.days"), 3);
assert.equal(ruleValue("leave.hajj.days"), 10);
assert.equal(ruleValue("leave.hajj.maxDays"), 15);
assert.equal(ruleValue("leave.iddah.days"), 130);
assert.equal(ruleValue("leave.iddah.nonMuslimDays"), 15);
assert.equal(citeLeaveType("maternity")?.article, "151");
assert.equal(citeLeaveType("iddah")?.article, "160");
assert.equal(citeLeaveType("paternity")?.article, "113");
assert.equal(citeLeaveType("hajj")?.article, "114");
assert.equal(4 * 30 + 10, 130, "Art. 160 Muslim floor uses the 30-day work-month");

assert.equal(isRamadanHoursSubject({ profile: muslimFemale }), true);
assert.equal(isRamadanHoursSubject({ profile: emptyReligionFemale }), true, "empty religion = Muslim (Art. 98 / 160)");
assert.equal(isRamadanHoursSubject({ profile: nonMuslimFemale }), false);

for (const profile of [muslimFemale, emptyReligionFemale, muslimMale, emptyReligionMale, nonMuslimFemale, nonMuslimMale]) {
  for (const key of SHARED) assert.ok(has(profile, key), `${JSON.stringify(profile)} must see ${key}`);
}

for (const profile of [muslimFemale, emptyReligionFemale, nonMuslimFemale]) {
  for (const key of FEMALE_ONLY) assert.ok(has(profile, key), `female must see ${key}`);
  for (const key of MALE_ONLY) assert.ok(!has(profile, key), `female must not see ${key}`);
}

for (const profile of [muslimMale, emptyReligionMale, nonMuslimMale]) {
  for (const key of MALE_ONLY) assert.ok(has(profile, key), `male must see ${key}`);
  for (const key of FEMALE_ONLY) assert.ok(!has(profile, key), `male must not see ${key}`);
}

for (const profile of [muslimFemale, emptyReligionFemale, muslimMale, emptyReligionMale]) {
  assert.ok(has(profile, "hajj"), "Muslim / empty religion sees Hajj (Art. 114 — فريضة الحج)");
}
for (const profile of [nonMuslimFemale, nonMuslimMale]) {
  assert.ok(!has(profile, "hajj"), "recorded non-Muslim does not see Hajj");
}

assert.equal(statutoryLeaveFloor("iddah", muslimFemale), 130);
assert.equal(statutoryLeaveFloor("iddah", emptyReligionFemale), 130);
assert.equal(statutoryLeaveFloor("iddah", nonMuslimFemale), 15);
assert.equal(iddahPaidDays(muslimFemale, "2026-01-01"), 130);
assert.equal(iddahSpanFromEvent("2026-01-01", muslimFemale).end, "2026-05-10");
assert.equal(iddahSpanFromEvent("2026-01-01", nonMuslimFemale).end, "2026-01-15");
assert.equal(getLeaveTotal({ ...nonMuslimFemale, leaveTotals: { iddah: 130 } }, "iddah"), 15, "stored Muslim 130 must not outrank Art. 160(2)");
assert.equal(getLeaveTotal(muslimFemale, "iddah"), 130);
const endedMaternity = [{ type: "maternity", status: "approved", startDate: "2026-01-01", endDate: "2026-03-25", eventDate: "2026-01-20" }];
assert.equal(isNursingSubject({ profile: muslimFemale }, "2026-09-16"), false, "Art. 154 nursing rest only after ended maternity");
assert.equal(isNursingSubject({ profile: muslimFemale, leaveRequests: endedMaternity }, "2026-09-16"), true);
assert.equal(isNursingSubject({ profile: muslimMale, leaveRequests: endedMaternity }, "2026-09-16"), false);

const deathFile = [{ name: "death.pdf", url: "/death.pdf" }];
const medFile = [{ name: "med.pdf", url: "/med.pdf" }];

const iddahMuslimOk = checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-05-10", days: 130, files: deathFile, status: "pending", eventDate: "2026-01-01", noOtherEmployerAck: true },
  { profile: muslimFemale, requests: [] },
);
assert.equal(iddahMuslimOk.ok, true, iddahMuslimOk.reason || "muslim female iddah 130");

const iddahEmptyReligion = checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-05-10", days: 130, files: deathFile, status: "pending", eventDate: "2026-01-01", noOtherEmployerAck: true },
  { profile: emptyReligionFemale, requests: [] },
);
assert.equal(iddahEmptyReligion.ok, true, "empty religion uses Muslim 130-day iddah");

const iddahNonMuslimOk = checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-01-15", days: 15, files: deathFile, status: "pending", eventDate: "2026-01-01", noOtherEmployerAck: true },
  { profile: nonMuslimFemale, requests: [] },
);
assert.equal(iddahNonMuslimOk.ok, true);

assert.equal(checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-05-10", days: 130, files: deathFile, status: "pending", eventDate: "2026-01-01", noOtherEmployerAck: true },
  { profile: nonMuslimFemale, requests: [] },
).error, "IDDAH_OVER_PAID", "non-Muslim cannot take the Muslim 130-day paid span");

assert.equal(checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-06-01", days: 152, files: deathFile, status: "pending", eventDate: "2026-01-01", iddahPregnant: true, noOtherEmployerAck: true },
  { profile: muslimFemale, requests: [] },
).warning, "IDDAH_UNPAID_TAIL");

assert.equal(checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-01-20", days: 20, files: deathFile, status: "pending", eventDate: "2026-01-01", iddahPregnant: true, noOtherEmployerAck: true },
  { profile: nonMuslimFemale, requests: [] },
).error, "IDDAH_OVER_PAID", "Art. 160(2) has no unpaid pregnancy tail");

assert.equal(checkLeaveGenderGate({ type: "iddah" }, { profile: muslimMale }).error, "LEAVE_GENDER");
assert.equal(checkLeaveGenderGate({ type: "maternity" }, { profile: muslimMale }).error, "LEAVE_GENDER");
assert.equal(checkLeaveGenderGate({ type: "paternity" }, { profile: muslimFemale }).error, "LEAVE_GENDER");
assert.equal(checkLeaveGenderGate({ type: "maternity" }, { profile: muslimFemale }).ok, true);
assert.equal(checkLeaveGenderGate({ type: "paternity" }, { profile: muslimMale }).ok, true);

const maternityOk = checkApproveLeaveGate(
  { type: "maternity", startDate: "2026-08-20", endDate: "2026-11-11", days: 84, files: medFile, status: "pending", eventDate: "2026-09-01", noOtherEmployerAck: true },
  { profile: muslimFemale, requests: [] },
);
assert.equal(maternityOk.ok, true);
assert.equal(checkApproveLeaveGate(
  { type: "maternity", startDate: "2026-08-20", endDate: "2026-11-11", days: 84, files: medFile, status: "pending", eventDate: "2026-09-01", noOtherEmployerAck: true },
  { profile: muslimMale, requests: [] },
).error, "LEAVE_GENDER");

const paternityOk = checkApproveLeaveGate(
  { type: "paternity", startDate: "2026-09-03", endDate: "2026-09-05", days: 3, files: [], status: "pending", eventDate: "2026-09-01", noOtherEmployerAck: true },
  { profile: muslimMale, requests: [] },
);
assert.equal(paternityOk.ok, true);
assert.equal(checkApproveLeaveGate(
  { type: "paternity", startDate: "2026-09-03", endDate: "2026-09-05", days: 3, files: [], status: "pending", eventDate: "2026-09-01", noOtherEmployerAck: true },
  { profile: muslimFemale, requests: [] },
).error, "LEAVE_GENDER");

const hajjOk = checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-10", days: 10, files: [{ name: "hajj.pdf" }], status: "pending", noOtherEmployerAck: true },
  { profile: muslimMale, requests: [] },
);
assert.equal(hajjOk.ok, true);
assert.equal(checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-10", days: 10, files: [{ name: "hajj.pdf" }], status: "pending", noOtherEmployerAck: true },
  { profile: emptyReligionFemale, requests: [] },
).ok, true, "empty religion may take Hajj");
assert.equal(checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-10", days: 10, files: [{ name: "hajj.pdf" }], status: "pending", noOtherEmployerAck: true },
  { profile: nonMuslimMale, requests: [] },
).error, "LEAVE_RELIGION");
assert.equal(checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-10", days: 10, files: [{ name: "hajj.pdf" }], status: "pending", noOtherEmployerAck: true },
  { profile: nonMuslimFemale, requests: [] },
).error, "LEAVE_RELIGION");

assert.equal(leaveNeedsAttachment({ type: "iddah", days: 15 }), true);
assert.equal(leaveNeedsAttachment({ type: "maternity", days: 10 }), true);

const femaleKinds = leaveKindsFor(muslimFemale, true, []);
assert.match(femaleKinds.find((row) => row.key === "iddah")?.cap || "", /130/);
assert.match(leaveKindsFor(nonMuslimFemale, true, []).find((row) => row.key === "iddah")?.cap || "", /15/);
assert.ok(femaleKinds.some((row) => row.key === "maternity"));
assert.ok(femaleKinds.some((row) => row.key === "maternity_extend"));
assert.ok(femaleKinds.some((row) => row.key === "maternity_companion"));
assert.match(femaleKinds.find((row) => row.key === "bereavement")?.ar || "", /أصل/);
assert.doesNotMatch(femaleKinds.find((row) => row.key === "bereavement")?.ar || "", /زوج/);
assert.ok(!femaleKinds.some((row) => row.key === "paternity"));
assert.ok(leaveKindsFor(muslimMale, true, []).some((row) => row.key === "paternity"));
assert.match(leaveKindsFor(muslimMale, true, []).find((row) => row.key === "bereavement")?.ar || "", /زوج/);
assert.ok(!leaveKindsFor(muslimMale, true, []).some((row) => row.key === "iddah" || row.key === "maternity" || row.key === "maternity_extend" || row.key === "maternity_companion"));
assert.equal(leaveTypeLabel("bereavement", true, muslimFemale), "وفاة أصل/فرع");
assert.equal(leaveTypeLabel("bereavement", true, muslimMale), "وفاة زوج/أصل/فرع");

const afterMaternity = [{ type: "maternity", status: "approved", startDate: "2026-08-20", endDate: "2026-11-11", days: 84, eventDate: "2026-09-01" }];
assert.equal(maternityFollowOnSpan(afterMaternity, 30).start, "2026-11-12");
assert.equal(checkApproveLeaveGate(
  { type: "maternity_extend", startDate: "2026-11-12", endDate: "2026-12-11", days: 30, files: [], status: "pending", noOtherEmployerAck: true },
  { profile: muslimFemale, requests: afterMaternity },
).ok, true);
assert.equal(checkApproveLeaveGate(
  { type: "maternity_extend", startDate: "2026-11-12", endDate: "2026-12-11", days: 30, files: [], status: "pending", noOtherEmployerAck: true },
  { profile: muslimFemale, requests: [] },
).error, "MATERNITY_FOLLOW_REQUIRED");
assert.equal(checkApproveLeaveGate(
  { type: "maternity_companion", startDate: "2026-11-12", endDate: "2026-12-11", days: 30, files: medFile, status: "pending", noOtherEmployerAck: true },
  { profile: muslimFemale, requests: afterMaternity },
).ok, true);
assert.equal(checkApproveLeaveGate(
  { type: "maternity_companion", startDate: "2026-11-12", endDate: "2027-01-10", days: 60, files: medFile, status: "pending", companionUnpaidExtend: true, noOtherEmployerAck: true },
  { profile: muslimFemale, requests: afterMaternity },
).warning, "COMPANION_UNPAID_TAIL");
assert.equal(checkLeaveGenderGate({ type: "maternity_companion" }, { profile: muslimMale }).error, "LEAVE_GENDER");

const femaleCatalog = leaveCatalogFor(muslimFemale, true);
assert.ok(femaleCatalog.some((group) => group.rows.some((row) => row.art === "151" && /تمديد/.test(row.name))));
assert.ok(femaleCatalog.some((group) => group.rows.some((row) => row.art === "151" && /مرافقة/.test(row.name))));
assert.ok(femaleCatalog.some((group) => group.rows.some((row) => row.art === "113" && /أصل/.test(row.name) && !/زوج أو/.test(row.name))));
assert.ok(femaleCatalog.some((group) => group.rows.some((row) => row.art === "160" && /4 أشهر/.test(row.ent))));
assert.ok(!femaleCatalog.some((group) => group.rows.some((row) => /أبوة/.test(row.name))));
const nonMuslimCatalog = leaveCatalogFor(nonMuslimFemale, true);
assert.ok(nonMuslimCatalog.some((group) => group.rows.some((row) => row.art === "160" && /15/.test(row.ent))));
assert.ok(!nonMuslimCatalog.some((group) => group.rows.some((row) => row.art === "114")));
const maleCatalog = leaveCatalogFor(muslimMale, true);
assert.ok(maleCatalog.some((group) => group.rows.some((row) => /أبوة/.test(row.name))));
assert.ok(!maleCatalog.some((group) => group.rows.some((row) => row.art === "151" || row.art === "160")));
assert.ok(maleCatalog.some((group) => group.rows.some((row) => row.art === "114")));
assert.ok(maleCatalog.some((group) => group.rows.some((row) => row.art === "115" && /15/.test(row.cond) && /إثبات أداء/.test(row.cond) && /لا يرفض/.test(row.cond))));

const examPaper = [{ name: "exam.pdf", url: "/exam.pdf" }];
const examAsk = {
  type: "exam",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  days: 3,
  files: examPaper,
  status: "pending",
  createdAt: "2026-09-01",
  noOtherEmployerAck: true,
};
const examExtrasNone = { profile: muslimMale, requests: [], otherRequests: [], companyId: "c1" };
const examNone = checkSubmitLeaveGate(examAsk, examExtrasNone);
assert.equal(examNone.ok, true, "exam leave may be sent without study consent");
assert.equal(examNone.examLeaveTrack, EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID);
assert.equal(examNone.notice, EXAM_LEAVE_TRACK_FALLBACK_AR);
assert.match(examNone.notice, /من الإجازة السنوية أو بدون أجر/);
const firstExamPaidChipNoConsent = checkSubmitLeaveGate({ ...examAsk, examRepeat: false }, examExtrasNone);
assert.equal(firstExamPaidChipNoConsent.ok, true, "first sitting may still be raised without study consent");
assert.equal(firstExamPaidChipNoConsent.examLeaveTrack, EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID, "first-exam + paid chip + no consent stays on 115/2");
assert.notEqual(firstExamPaidChipNoConsent.examPayFrom, "paid", "first-exam without approved study_consent is not the paid track");
assert.ok(["annual", "unpaid"].includes(firstExamPaidChipNoConsent.examPayFrom), "without consent pay is annual or unpaid");
assert.equal(firstExamPaidChipNoConsent.warning, true, "missing study consent is a gold warning, not a submit block");
assert.equal(checkSubmitLeaveGate({ ...examAsk, examRepeat: false }, {
  ...examExtrasNone,
  profile: { ...muslimMale, leaveTotals: { annual: 21 } },
}).examPayFrom, "annual", "first-exam without consent draws from annual when the balance covers the days");

assert.equal(checkSubmitLeaveGate(examAsk, {
  ...examExtrasNone,
  otherRequests: [{ type: STUDY_CONSENT_TYPE, status: "pending", companyId: "c1" }],
}).examLeaveTrack, EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID, "pending consent stays on the 115/2 track");

assert.equal(checkSubmitLeaveGate(examAsk, {
  ...examExtrasNone,
  otherRequests: [{ type: STUDY_CONSENT_TYPE, status: "rejected", companyId: "c1" }],
}).ok, true, "rejected consent still allows exam submit on the fallback track");

const approvedStudy = { type: STUDY_CONSENT_TYPE, status: "approved", companyId: "c1", approvedAt: "2026-09-08T00:00:00.000Z", approvedBy: "مدير" };
const examPaid = checkSubmitLeaveGate(examAsk, { ...examExtrasNone, otherRequests: [approvedStudy] });
assert.equal(examPaid.ok, true);
assert.equal(examPaid.examLeaveTrack, EXAM_LEAVE_TRACK_PAID);
assert.equal(examPaid.examPayFrom, "paid");
assert.equal(examPaid.notice, EXAM_LEAVE_TRACK_PAID_AR);
assert.equal(checkSubmitLeaveGate({ ...examAsk, examRepeat: true }, { ...examExtrasNone, otherRequests: [approvedStudy] }).examPayFrom, "unpaid", "repeat exam stays unpaid even with study consent");
const examShortNotice = checkSubmitLeaveGate({
  ...examAsk,
  startDate: "2026-09-10",
  endDate: "2026-09-12",
}, { ...examExtrasNone, otherRequests: [approvedStudy] });
assert.equal(examShortNotice.error, "EXAM_NOTICE");
assert.match(examShortNotice.reason, /15/);
assert.match(examShortNotice.reason, /المادة 115/);
assert.match(examShortNotice.reason, /يوم الورقة أو اليوم التالي/);
assert.match(examShortNotice.articleText, /على العامل أن يتقدم بطلب الإجازة قبل موعدها بخمسة عشر يوماً/);
assert.equal(examShortNotice.articleText, articleOfficialText("115")?.ar);
assert.equal(examShortNotice.articleText, examStatuteOf().articleText);

const examStaleInstitutionFlag = checkSubmitLeaveGate({
  ...examAsk,
  examInstitutionRefused: true,
}, { ...examExtrasNone, otherRequests: [approvedStudy] });
assert.equal(examStaleInstitutionFlag.ok, true, "institution refusal is not a counterparty gate");
assert.notEqual(examStaleInstitutionFlag.error, "EXAM_INSTITUTION_REFUSED");
assert.equal(examStaleInstitutionFlag.examLeaveTrack, EXAM_LEAVE_TRACK_PAID);
const examLate = checkSubmitLeaveGate({
  ...examAsk,
  startDate: "2026-09-10",
  endDate: "2026-09-12",
  createdAt: "2026-09-06",
  examNoticeIssuedAt: "2026-09-06",
}, { ...examExtrasNone, otherRequests: [approvedStudy] });
assert.equal(examLate.ok, true);
assert.equal(examLate.via, "late_notice");
assert.equal(examLate.examLeaveTrack, EXAM_LEAVE_TRACK_PAID);

assert.equal(checkSubmitLeaveGate({
  ...examAsk,
  startDate: "2026-09-10",
  endDate: "2026-09-12",
  createdAt: "2026-09-08",
  examNoticeIssuedAt: "2026-09-06",
}, examExtrasNone).error, "EXAM_NOTICE_DELAY");

assert.equal(hasIrrevocableStudyConsent({ companyId: "c1", otherRequests: [approvedStudy] }, "c2"), false);
assert.equal(checkSubmitLeaveGate(examAsk, {
  profile: muslimMale,
  requests: [],
  otherRequests: [approvedStudy],
  companyId: "c2",
}).examLeaveTrack, EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID, "another company's approval must not open the paid track");

assert.equal(checkRevokeStudyConsentGate(approvedStudy, "withdrawn").error, "STUDY_CONSENT_IRREVOCABLE");
assert.equal(checkRevokeStudyConsentGate(approvedStudy, "rejected").reason, STUDY_CONSENT_IRREVOCABLE_AR);

const examRefuse = checkRejectLeaveGate(examAsk, { ...examExtrasNone, otherRequests: [approvedStudy], nextStatus: "rejected", actor: "manager" });
assert.equal(examRefuse.error, "EXAM_EMPLOYER_REFUSE", "employer cannot refuse a qualifying 115 file");
assert.match(examRefuse.reason, /صاحب العمل لا يرفض/);
assert.equal(examRefuse.articleText, articleOfficialText("115")?.ar);
assert.equal(checkRejectLeaveGate(examAsk, { ...examExtrasNone, nextStatus: "revise" }).ok, true, "revise is not a refusal of the right");
assert.equal(checkRejectLeaveGate({
  ...examAsk,
  startDate: "2026-09-10",
  endDate: "2026-09-12",
}, examExtrasNone).ok, true, "short notice may be refused — it does not meet 115");

const examSitDue = checkExamSittingSettleGate({
  type: "exam",
  startDate: "2026-09-10",
  endDate: "2026-09-12",
  status: "approved",
  files: examPaper,
}, { onDate: "2026-09-13" });
assert.equal(examSitDue.error, "EXAM_SAT_UNSETTLED");
assert.equal(examSitDue.settled, false);
assert.match(examSitDue.reason, /ورقة ثانية/);
assert.equal(examSitDue.articleText, articleOfficialText("115")?.ar);
assert.equal(checkExamSittingSettleGate({
  type: "exam",
  startDate: "2026-09-10",
  endDate: "2026-09-12",
  status: "approved",
  examSatFile: { name: "sit.pdf", url: "/sit.pdf" },
}, { onDate: "2026-09-13" }).settled, true);

assert.equal(checkSubmitLeaveGate({
  type: "annual",
  startDate: "2026-10-01",
  endDate: "2026-10-05",
  days: 5,
  noOtherEmployerAck: true,
}, { profile: { ...muslimMale, leaveTotals: { annual: 21 } }, requests: [] }).ok, true, "annual leave stays independent of study consent");
assert.equal(checkSubmitLeaveGate({
  type: "sick",
  startDate: "2026-09-20",
  endDate: "2026-09-21",
  days: 2,
  files: medFile,
  noOtherEmployerAck: true,
}, { profile: muslimMale, requests: [] }).ok, true, "sick leave stays independent of study consent");

assert.equal(leaveTypeLabel("eid", true, undefined, "2026-09-23"), "اليوم الوطني");
assert.equal(leaveTypeLabel("eid", false, undefined, "2026-09-23"), "National Day");
assert.equal(leaveTypeLabel("eid", true, undefined, "2026-02-22"), "يوم التأسيس");
assert.equal(leaveTypeLabel("eid", false, undefined, "2026-02-22"), "Founding Day");
assert.equal(leaveCiteRuleId("eid", {}, "2026-09-23"), "leave.nationalDay.days");
assert.equal(leaveCiteRuleId("eid", {}, "2026-02-22"), "leave.foundingDay.days");
assert.match(explainRule("leave.nationalDay.days")?.hintAr || "", /إجازة اليوم الوطني/);
assert.match(explainRule("leave.nationalDay.days")?.hintAr || "", /23 سبتمبر/);
assert.match(explainRule("leave.foundingDay.days")?.hintAr || "", /إجازة يوم التأسيس/);
assert.match(explainRule("leave.foundingDay.days")?.hintAr || "", /22 فبراير/);
assert.equal(leaveCiteRuleId("eid", {}, "2026-09-06"), "leave.eid.cite");

const catalog = leaveCatalogFor(muslimMale, true);
const catalogNames = catalog.flatMap((group) => group.rows.map((row) => row.name));
const catalogEnt = catalog.flatMap((group) => group.rows.map((row) => row.ent));
assert.ok(catalogNames.includes("إجازة اليوم الوطني"), catalogNames.join(" | "));
assert.ok(catalogNames.includes("إجازة يوم التأسيس"), catalogNames.join(" | "));
assert.ok(catalogEnt.some((ent) => String(ent).includes("23 سبتمبر")), catalogEnt.join(" | "));
assert.ok(catalogEnt.some((ent) => String(ent).includes("22 فبراير")), catalogEnt.join(" | "));
assert.ok(!catalogNames.includes("أعياد وعطل رسمية"));

const kinds = leaveKindsFor(muslimMale, true, []);
const nationalKind = kinds.find((row) => row.key === "eid");
assert.equal(nationalKind?.ar, "اليوم الوطني · يوم التأسيس · العيد");
assert.match(nationalKind?.cap || "", /الوطني 1/);
assert.match(nationalKind?.cap || "", /التأسيس 1/);
assert.match(nationalKind?.cap || "", /مقفلان في الجدول/);
assert.match(nationalKind?.cap || "", /بطلب/);

const catalogConds = catalog.flatMap((group) => group.rows.map((row) => row.cond));
assert.ok(catalogConds.some((c) => /إجازة اليوم الوطني/.test(String(c)) && /بلا طلب/.test(String(c))), catalogConds.join(" | "));
assert.ok(catalogConds.some((c) => /إجازة يوم التأسيس/.test(String(c)) && /بلا طلب/.test(String(c))), catalogConds.join(" | "));

console.log("ministry leave matrix ok");
console.log("muslim female:", keysOf(muslimFemale).join(", "));
console.log("muslim male:", keysOf(muslimMale).join(", "));
console.log("non-Muslim female:", keysOf(nonMuslimFemale).join(", "));
console.log("non-Muslim male:", keysOf(nonMuslimMale).join(", "));
