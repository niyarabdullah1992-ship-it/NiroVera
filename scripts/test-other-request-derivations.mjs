import assert from "node:assert/strict";
import { getLeaveTotal } from "../src/lib/leaveTypes.js";
import {
  LEAVE_TOPUP_MAX_DAYS,
  LEAVE_TOPUP_TYPE,
  OTHER_REQUEST_TYPES,
  STUDY_CONSENT_IRREVOCABLE_AR,
  STUDY_CONSENT_LABEL_AR,
  STUDY_CONSENT_TYPE,
  STUDY_CONSENT_APPROVAL_FILE_REQUIRED_AR,
  STUDY_CONSENT_FILE_REQUIRED_AR,
  NIGHT_FITNESS_TYPE,
  NIGHT_FITNESS_LABEL_AR,
  NIGHT_FITNESS_EMPLOYEE_ONLY_AR,
  NIGHT_FITNESS_PERIOD_REQUIRED_AR,
  NIGHT_FITNESS_PERIOD_INVALID_AR,
  resolveNightFitnessPeriod,
  stampNightFitnessOnEmployee,
  checkExamStudyConsentGate,
  checkRevokeStudyConsentGate,
  checkSubmitStudyConsentGate,
  hasIrrevocableStudyConsent,
  studyConsentState,
  applyAnnualLeaveTopup,
  archivedOtherCount,
  checkLeaveTopupDaysGate,
  checkApproveOtherRequestGate,
  checkSubmitOtherRequestGate,
  flattenOtherRequests,
  hasPendingLeaveTopup,
  incrementAnnualLeaveTotal,
  isManagerDecideOtherRequest,
  otherRequestTypeLabel,
  pendingLeaveCount,
  pendingManagerDecideCount,
  pendingOtherCount,
  pendingRequestsCount,
  stampLeaveTopupOnEmployee,
} from "../src/lib/otherRequestDerivations.js";
import {
  ARTICLE_106_GROUNDS,
  checkApproveOtAssignmentGate,
  checkArticle106YearCapGate,
  checkEmployeeAcceptOtGate,
  checkManagerRejectOtGate,
  checkOtAnnualCapGate,
  checkCompLeaveYearCapGate,
  checkCompLeaveWindowGate,
  checkRaiseOtAssignmentGate,
  checkRefuseOtAssignmentGate,
  otCreditDays,
  stampOvertimeCreditOnEmployee,
} from "../src/lib/overtimeAssignment.js";

assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === "salary_letter"));
assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === "shift_change"));
assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === "night_consent"));
assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === "manual_punch"));
assert.equal(otherRequestTypeLabel("permission", true), "استئذان");
assert.equal(otherRequestTypeLabel("overtime", false), "Overtime");

const people = [
  {
    id: "a",
    leaveRequests: [{ id: "l1", status: "pending" }, { id: "l2", status: "approved" }],
    otherRequests: [{ id: "o1", status: "pending", type: "salary_letter", createdAt: "2026-09-01" }],
  },
  {
    id: "b",
    leaveRequests: [],
    otherRequests: [
      { id: "o2", status: "approved", type: "advance", createdAt: "2026-09-02" },
      { id: "o3", status: "pending", type: "permission", createdAt: "2026-09-03" },
    ],
  },
];

assert.equal(pendingLeaveCount(people), 1);
assert.equal(pendingOtherCount(people), 2);
assert.equal(archivedOtherCount(people), 1);
assert.equal(pendingRequestsCount(people), 3);
assert.equal(flattenOtherRequests(people)[0].id, "o3");

const blocked = checkSubmitOtherRequestGate({ type: "salary_letter", reason: "" });
assert.equal(blocked.ok, false);
assert.equal(blocked.error, "REASON_REQUIRED");
assert.equal(checkSubmitOtherRequestGate({ type: "salary_letter", reason: "تقديم للبنك" }).error, "FILE_REQUIRED");
assert.equal(checkApproveOtherRequestGate({ type: "salary_letter", status: "pending", reason: "تقديم للبنك" }).error, "FILE_REQUIRED");
assert.equal(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  senderFile: { name: "form.pdf", url: "/form.pdf" },
}).error, "PAPER_REQUIRED");
assert.equal(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  senderFile: { name: "form.pdf", url: "/form.pdf" },
  paper: { name: "form-signed.pdf", url: "/form-signed.pdf" },
}).ok, true);
assert.equal(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  issuedFile: { name: "salary-cert.pdf", url: "/issued/salary-cert.pdf" },
}).ok, true);
assert.equal(checkSubmitOtherRequestGate({
  type: "employment_letter",
  reason: "تعريف للسفارة",
  file: { name: "letter.pdf", url: "/letter.pdf" },
}).error, "PAPER_REQUIRED");
assert.equal(checkSubmitOtherRequestGate({
  type: "employment_letter",
  reason: "تعريف للسفارة",
  file: { name: "letter.pdf", url: "/letter.pdf" },
  paper: { name: "letter-signed.pdf", url: "/letter-signed.pdf" },
}).ok, true);
assert.equal(checkSubmitOtherRequestGate({ type: "permission", reason: "خروج مبكر", date: "2026-09-14" }).ok, true);

const dated = checkSubmitOtherRequestGate({ type: "overtime", reason: "ضغط تشغيل", date: "" });
assert.equal(dated.ok, false);
assert.equal(dated.error, "DATE_REQUIRED");

const ok = checkSubmitOtherRequestGate({ type: "overtime", reason: "ضغط تشغيل", date: "2026-09-11" });
assert.equal(ok.ok, true);

assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === LEAVE_TOPUP_TYPE && row.ar === "رفع رصيد إجازة"));
assert.equal(otherRequestTypeLabel(LEAVE_TOPUP_TYPE, true), "رفع رصيد إجازة");
assert.equal(checkSubmitOtherRequestGate({ type: LEAVE_TOPUP_TYPE, reason: "ظرف عائلي" }).error, "DAYS_INVALID");
assert.equal(checkSubmitOtherRequestGate({ type: LEAVE_TOPUP_TYPE, reason: "ظرف عائلي", days: 0 }).error, "DAYS_INVALID");
assert.equal(checkSubmitOtherRequestGate({ type: LEAVE_TOPUP_TYPE, reason: "ظرف عائلي", days: 1.5 }).error, "DAYS_INVALID");
assert.equal(checkSubmitOtherRequestGate({ type: LEAVE_TOPUP_TYPE, reason: "ظرف عائلي", days: LEAVE_TOPUP_MAX_DAYS + 1 }).error, "DAYS_INVALID");
assert.equal(checkSubmitOtherRequestGate({ type: LEAVE_TOPUP_TYPE, reason: "لا", days: 3 }).error, "REASON_REQUIRED");
assert.equal(checkSubmitOtherRequestGate({ type: LEAVE_TOPUP_TYPE, reason: "ظرف عائلي", days: 3 }).ok, true);
assert.equal(checkLeaveTopupDaysGate({ days: 3 }).days, 3);

const hired = { hireDate: "2024-01-15" };
assert.equal(getLeaveTotal(hired, "annual", "2026-09-13"), 21);
const raised = applyAnnualLeaveTopup(hired, 3, "2026-09-13");
assert.equal(raised.ok, true);
assert.equal(raised.nextTotal, 24);
assert.equal(raised.profile.leaveTotals.annual, 24);
assert.equal(getLeaveTotal(raised.profile, "annual", "2026-09-13"), 24);
const stacked = applyAnnualLeaveTopup({ hireDate: "2024-01-15", leaveTotals: { annual: 25 } }, 3, "2026-09-13");
assert.equal(stacked.nextTotal, 28);

const emp = { profile: { hireDate: "2024-01-15" } };
const topupReq = { type: LEAVE_TOPUP_TYPE, days: 3, status: "pending" };
assert.equal(stampLeaveTopupOnEmployee(emp, topupReq).nextTotal, 24);
assert.equal(emp.profile.leaveTotals.annual, 24);
assert.equal(topupReq.balanceApplied, true);
assert.equal(stampLeaveTopupOnEmployee(emp, topupReq).skipped, true);
assert.equal(emp.profile.leaveTotals.annual, 24);
assert.equal(hasPendingLeaveTopup([{ type: LEAVE_TOPUP_TYPE, status: "pending" }]), true);
assert.equal(hasPendingLeaveTopup([{ type: LEAVE_TOPUP_TYPE, status: "approved" }]), false);

assert.equal(ARTICLE_106_GROUNDS.length, 3);
assert.equal(otCreditDays(8, "2026-09-13"), 1.5);

const realFile = { name: "incident.pdf", size: 2400, url: "data:application/pdf,ok", hash: "AA11" };
const fakeAttest = { name: "supporting-document", attested: true };

assert.equal(checkRaiseOtAssignmentGate({ reason: "ضغط", hours: 4, date: "2026-09-13" }).ok, true);
assert.equal(checkRaiseOtAssignmentGate({ reason: "ضغط", hours: 4, date: "2026-09-13", article106: true }).error, "GROUND_REQUIRED");
assert.equal(checkRaiseOtAssignmentGate({
  reason: "خطر حريق", hours: 4, date: "2026-09-13", article106: true, article106Ground: "danger",
}).error, "FILE_REQUIRED");
assert.equal(checkRaiseOtAssignmentGate({
  reason: "خطر حريق", hours: 4, date: "2026-09-13", article106: true, article106Ground: "danger", files: [fakeAttest],
}).error, "FILE_REQUIRED");
assert.equal(checkRaiseOtAssignmentGate({
  reason: "خطر حريق", hours: 4, date: "2026-09-13", article106: true, article106Ground: "danger", files: [realFile],
}).error, "MANAGER_106_ACK_REQUIRED");
assert.equal(checkRaiseOtAssignmentGate({
  reason: "خطر حريق", hours: 4, date: "2026-09-13", article106: true, article106Ground: "danger", files: [realFile], manager106Ack: true,
}).ok, true);

const used106 = Array.from({ length: 30 }, (_, i) => ({
  type: "overtime",
  assignment: true,
  article106: true,
  article106Ground: "pressure_inventory",
  date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
  status: "approved",
}));
assert.equal(checkRaiseOtAssignmentGate({
  reason: "جرد سنوي إضافي",
  hours: 4,
  date: "2026-09-13",
  article106: true,
  article106Ground: "pressure_inventory",
  files: [realFile],
  manager106Ack: true,
  otherRequests: used106,
}).error, "ARTICLE_106_YEAR_CAP");
assert.equal(checkArticle106YearCapGate({
  date: "2026-09-13",
  article106Ground: "pressure_inventory",
  otherRequests: used106,
}).used, 30);

const normalAssign = { type: "overtime", assignment: true, status: "pending_employee", hours: 4, date: "2026-09-13" };
const mandatoryAssign = {
  type: "overtime",
  assignment: true,
  article106: true,
  article106Ground: "danger",
  status: "pending_employee",
  hours: 4,
  date: "2026-09-13",
  files: [realFile],
  manager106Ack: true,
};
assert.equal(checkRefuseOtAssignmentGate(normalAssign).ok, true);
assert.equal(checkRefuseOtAssignmentGate(mandatoryAssign).error, "ARTICLE_106_MANDATORY");
assert.equal(checkEmployeeAcceptOtGate({ compensation: "pay" }).error, "EMPLOYEE_ACK_REQUIRED");
assert.equal(checkEmployeeAcceptOtGate({ compensation: "pay", ack: true }).ok, true);
assert.equal(checkEmployeeAcceptOtGate({ compensation: "credit", ack: true, hours: 8, date: "2026-09-13" }).creditDays, 1.5);
assert.equal(checkOtAnnualCapGate({ hours: 1, date: "2026-09-13", overtimeHoursYtd: 720 }).error, "OT_ANNUAL_CAP");
assert.equal(checkOtAnnualCapGate({ hours: 1, date: "2026-09-13", overtimeHoursYtd: 720, annualCapConsent: true }).ok, true);
assert.equal(checkRaiseOtAssignmentGate({ reason: "ضغط", hours: 8, date: "2026-09-13", overtimeHoursYtd: 720 }).error, "OT_ANNUAL_CAP");
assert.equal(checkRaiseOtAssignmentGate({ reason: "ضغط", hours: 8, date: "2026-09-13", overtimeHoursYtd: 720, annualCapConsent: true }).ok, true);
assert.equal(checkCompLeaveWindowGate({ compensation: "credit", date: "2026-09-13", enjoyDate: "2027-01-01" }).error, "COMP_LEAVE_WINDOW");
assert.equal(checkCompLeaveWindowGate({ compensation: "credit", date: "2026-09-13", enjoyDate: "2027-01-01", windowAgreed: true }).ok, true);
assert.equal(checkCompLeaveYearCapGate({ compensation: "credit", hours: 8, date: "2026-09-13", creditDaysYtd: 30 }).error, "COMP_LEAVE_YEAR_CAP");
assert.equal(checkEmployeeAcceptOtGate({ compensation: "credit", ack: true, hours: 8, date: "2026-09-13", enjoyDate: "2026-09-20" }).enjoyDate, "2026-09-20");
assert.equal(checkApproveOtAssignmentGate(normalAssign).error, "EMPLOYEE_CHOICE_REQUIRED");
assert.equal(checkManagerRejectOtGate(mandatoryAssign, "rejected").error, "ARTICLE_106_MANDATORY");
assert.equal(checkManagerRejectOtGate(mandatoryAssign, "revise").ok, true);
assert.equal(checkManagerRejectOtGate(normalAssign, "rejected").ok, true);

const creditEmp = { profile: { hireDate: "2024-01-15" } };
const creditReq = {
  type: "overtime",
  assignment: true,
  compensation: "credit",
  hours: 8,
  date: "2026-09-13",
  status: "pending_manager",
  employeeAck: true,
};
assert.equal(stampOvertimeCreditOnEmployee(creditEmp, creditReq).nextTotal, 22.5);
assert.equal(creditReq.balanceApplied, true);
assert.equal(stampOvertimeCreditOnEmployee(creditEmp, creditReq).skipped, true);
assert.equal(creditEmp.profile.leaveTotals.annual, 22.5);
assert.equal(incrementAnnualLeaveTotal({ hireDate: "2024-01-15" }, 1.5, "2026-09-13").nextTotal, 22.5);

const waiting = [{ otherRequests: [normalAssign] }];
assert.equal(pendingOtherCount(waiting), 1);
assert.equal(pendingManagerDecideCount(waiting), 0);
assert.equal(isManagerDecideOtherRequest({ ...normalAssign, status: "pending_manager" }), true);
assert.equal(checkApproveOtherRequestGate({ type: "salary_letter", status: "pending", reason: "تقديم للبنك" }).error, "FILE_REQUIRED");
assert.equal(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  senderFile: { name: "form.pdf", url: "/form.pdf" },
}).error, "PAPER_REQUIRED");
assert.match(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  senderFile: { name: "form.pdf", url: "/form.pdf" },
}).reason, /النسخة الموقّعة/);
assert.equal(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  senderFile: { name: "form.pdf", url: "/form.pdf" },
  paper: { name: "form-signed.pdf", url: "/signed.pdf" },
}).ok, true);
assert.equal(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  reason: "تقديم للبنك",
  issuedFile: { name: "salary-cert.pdf", url: "/issued/salary-cert.pdf" },
}).ok, true, "manager-issued file on salary_letter approve ok");
assert.equal(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  issuedFile: { name: "salary-cert.pdf", url: "/issued/salary-cert.pdf" },
  reviewNote: "",
}).ok, true, "approve without note ok");
assert.equal(checkApproveOtherRequestGate({
  type: "permission",
  status: "pending",
  reason: "خروج مبكر",
}).ok, true, "approve other request without note ok");
assert.equal(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  issuedFile: { name: "note.docx", url: "/note.docx" },
}).error, "FILE_KIND");
assert.equal(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  issuedFile: { name: "big.pdf", url: "/big.pdf", size: 11 * 1024 * 1024 },
}).error, "FILE_SIZE");

assert.equal(checkSubmitOtherRequestGate({ type: "manual_punch", reason: "تعذّر الموقع", date: "2026-09-15" }).error, "TIME_REQUIRED");
assert.equal(checkSubmitOtherRequestGate({ type: "manual_punch", reason: "تعذّر الموقع", date: "2026-09-15", time: "08:15" }).ok, true);
const onLeave = {
  leaveRequests: [{ type: "annual", status: "approved", startDate: "2026-09-15", endDate: "2026-09-17" }],
};
assert.equal(checkSubmitOtherRequestGate({
  type: "manual_punch",
  reason: "تعذّر الموقع",
  date: "2026-09-15",
  time: "08:15",
  employee: onLeave,
}).error, "ON_APPROVED_LEAVE");
assert.equal(checkSubmitOtherRequestGate({
  type: "manual_punch",
  reason: "تعذّر الموقع",
  date: "2026-09-15",
  time: "08:15",
  employee: { leaveRequests: [] },
  attendance: { check_in_at: "2026-09-15T05:00:00.000Z" },
}).error, "ALREADY_CHECKED_IN");
assert.equal(checkSubmitOtherRequestGate({
  type: "checkout_fix",
  reason: "نسيت الانصراف",
  date: "2026-09-15",
  time: "16:10",
  employee: { leaveRequests: [] },
}).error, "NOT_CHECKED_IN");
assert.equal(checkSubmitOtherRequestGate({
  type: "checkout_fix",
  reason: "نسيت الانصراف",
  date: "2026-09-15",
  time: "16:10",
  employee: { leaveRequests: [] },
  attendance: { check_in_at: "2026-09-15T05:00:00.000Z", check_out_at: "2026-09-15T13:00:00.000Z" },
}).error, "ALREADY_CHECKED_OUT");
assert.equal(checkSubmitOtherRequestGate({
  type: "checkout_fix",
  reason: "نسيت الانصراف",
  date: "2026-09-15",
  time: "16:10",
  employee: { leaveRequests: [] },
  attendance: { check_in_at: "2026-09-15T05:00:00.000Z" },
}).ok, true);

const studyFile = { name: "قبول.pdf", url: "data:application/pdf;base64,AAA", at: "2026-09-17T00:00:00.000Z" };
const approvalFile = { name: "موافقة.pdf", url: "data:application/pdf;base64,BBB", at: "2026-09-17T01:00:00.000Z" };
assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === STUDY_CONSENT_TYPE && row.ar === STUDY_CONSENT_LABEL_AR && row.ar === "موافقة دراسية"));
assert.equal(checkSubmitStudyConsentGate({ program: "إدارة", institution: "" }).error, "INSTITUTION_REQUIRED");
assert.equal(checkSubmitStudyConsentGate({ program: "إدارة", institution: "جامعة الملك سعود" }).error, "DATE_REQUIRED");
assert.equal(checkSubmitStudyConsentGate({
  program: "إدارة أعمال",
  institution: "جامعة الملك سعود",
  startDate: "2026-10-01",
}).error, "STUDY_CONSENT_FILE_REQUIRED");
assert.equal(checkSubmitStudyConsentGate({
  program: "إدارة أعمال",
  institution: "جامعة الملك سعود",
  startDate: "2026-10-01",
  file: studyFile,
}).ok, true);
assert.equal(checkSubmitOtherRequestGate({
  type: STUDY_CONSENT_TYPE,
  program: "إدارة أعمال",
  institution: "جامعة الملك سعود",
  startDate: "2026-10-01",
  file: studyFile,
}).ok, true);
assert.equal(checkSubmitStudyConsentGate({
  program: "إدارة",
  institution: "جامعة الملك سعود",
  startDate: "2026-10-01",
  file: studyFile,
  otherRequests: [{ type: STUDY_CONSENT_TYPE, status: "pending", companyId: "c1" }],
  companyId: "c1",
}).error, "STUDY_CONSENT_PENDING");
assert.equal(checkSubmitStudyConsentGate({
  program: "إدارة",
  institution: "جامعة الملك سعود",
  startDate: "2026-10-01",
  file: studyFile,
  otherRequests: [{ type: STUDY_CONSENT_TYPE, status: "approved", companyId: "c1", approvedAt: "2026-09-10T00:00:00.000Z" }],
  companyId: "c1",
}).error, "STUDY_CONSENT_ALREADY_APPROVED");
assert.equal(checkSubmitStudyConsentGate({
  program: "إدارة",
  institution: "جامعة الملك سعود",
  startDate: "2026-10-01",
  file: studyFile,
  otherRequests: [{ type: STUDY_CONSENT_TYPE, status: "rejected", companyId: "c1" }],
  companyId: "c1",
}).ok, true, "rejected study consent may be raised again");
assert.equal(checkApproveOtherRequestGate({ type: STUDY_CONSENT_TYPE, status: "pending" }).error, "STUDY_CONSENT_APPROVAL_FILE_REQUIRED");
assert.equal(checkApproveOtherRequestGate({ type: STUDY_CONSENT_TYPE, status: "pending" }).reason, STUDY_CONSENT_APPROVAL_FILE_REQUIRED_AR);
assert.equal(checkApproveOtherRequestGate({ type: STUDY_CONSENT_TYPE, status: "pending", issuedFile: approvalFile }).ok, true);
assert.equal(checkSubmitStudyConsentGate({
  program: "إدارة أعمال",
  institution: "جامعة الملك سعود",
  startDate: "2026-10-01",
}).reason, STUDY_CONSENT_FILE_REQUIRED_AR);

const approvedConsent = { type: STUDY_CONSENT_TYPE, status: "approved", companyId: "c1", approvedAt: "2026-09-10T08:00:00.000Z", approvedBy: "مدير" };
assert.equal(hasIrrevocableStudyConsent({ companyId: "c1", otherRequests: [approvedConsent] }, "c1"), true);
assert.equal(hasIrrevocableStudyConsent({ companyId: "c1", otherRequests: [approvedConsent] }, "c2"), false, "another company must not unlock");
assert.equal(hasIrrevocableStudyConsent({ companyId: "c2", otherRequests: [{ ...approvedConsent, companyId: "c1" }] }, "c2"), false);
assert.equal(studyConsentState({ otherRequests: [{ type: STUDY_CONSENT_TYPE, status: "pending" }] }).status, "pending");
assert.equal(checkRevokeStudyConsentGate(approvedConsent, "withdrawn").error, "STUDY_CONSENT_IRREVOCABLE");
assert.equal(checkRevokeStudyConsentGate(approvedConsent, "rejected").reason, STUDY_CONSENT_IRREVOCABLE_AR);
assert.equal(checkRevokeStudyConsentGate(approvedConsent, "pending").error, "STUDY_CONSENT_IRREVOCABLE");
assert.equal(checkRevokeStudyConsentGate({ type: STUDY_CONSENT_TYPE, status: "pending" }, "rejected").ok, true);
assert.equal(checkExamStudyConsentGate({ type: "annual" }, {}).ok, true);
assert.equal(checkExamStudyConsentGate({ type: "exam" }, { companyId: "c1" }).ok, true);
assert.equal(checkExamStudyConsentGate({ type: "exam" }, { companyId: "c1" }).examLeaveTrack, "annual_or_unpaid");
assert.equal(checkExamStudyConsentGate({ type: "exam" }, {
  companyId: "c1",
  otherRequests: [approvedConsent],
}).examLeaveTrack, "paid");

const fitnessFile = { name: "لياقة.pdf", url: "data:application/pdf;base64,CCC", at: "2026-09-19T00:00:00.000Z" };
assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === NIGHT_FITNESS_TYPE && row.ar === NIGHT_FITNESS_LABEL_AR));
assert.equal(checkSubmitOtherRequestGate({ type: NIGHT_FITNESS_TYPE, from: "2026-09-01" }).error, "NIGHT_FITNESS_FILE_REQUIRED");
assert.equal(checkSubmitOtherRequestGate({
  type: NIGHT_FITNESS_TYPE,
  file: fitnessFile,
  from: "2026-09-01",
}).error, "NIGHT_FITNESS_PERIOD_REQUIRED");
assert.equal(checkSubmitOtherRequestGate({
  type: NIGHT_FITNESS_TYPE,
  file: fitnessFile,
  from: "2026-09-01",
}).reason, NIGHT_FITNESS_PERIOD_REQUIRED_AR);
assert.equal(checkSubmitOtherRequestGate({
  type: NIGHT_FITNESS_TYPE,
  file: fitnessFile,
  from: "2026-10-01",
  to: "2026-09-01",
}).error, "NIGHT_FITNESS_PERIOD_INVALID");
assert.equal(checkSubmitOtherRequestGate({
  type: NIGHT_FITNESS_TYPE,
  file: fitnessFile,
  from: "2026-10-01",
  to: "2026-09-01",
}).reason, NIGHT_FITNESS_PERIOD_INVALID_AR);
assert.equal(checkSubmitOtherRequestGate({
  type: NIGHT_FITNESS_TYPE,
  file: fitnessFile,
  from: "2026-09-01",
  to: "2027-08-31",
}).ok, true);
const permanentGate = checkSubmitOtherRequestGate({
  type: NIGHT_FITNESS_TYPE,
  file: fitnessFile,
  permanent: true,
});
assert.equal(permanentGate.ok, true);
assert.equal(permanentGate.permanent, true);
assert.equal(permanentGate.to, "");
assert.equal(checkSubmitOtherRequestGate({
  type: NIGHT_FITNESS_TYPE,
  file: fitnessFile,
  from: "2026-09-01",
  to: "2027-08-31",
  lane: "manage",
}).error, "NIGHT_FITNESS_EMPLOYEE_ONLY");
assert.equal(checkSubmitOtherRequestGate({
  type: NIGHT_FITNESS_TYPE,
  file: fitnessFile,
  from: "2026-09-01",
  to: "2027-08-31",
  lane: "manage",
}).reason, NIGHT_FITNESS_EMPLOYEE_ONLY_AR);
assert.equal(checkSubmitOtherRequestGate({
  type: NIGHT_FITNESS_TYPE,
  file: fitnessFile,
  permanent: true,
  status: "approved",
}).error, "NIGHT_FITNESS_EMPLOYEE_ONLY");
assert.equal(checkSubmitOtherRequestGate({
  type: NIGHT_FITNESS_TYPE,
  file: fitnessFile,
  from: "2026-09-01",
  to: "2027-08-31",
  actorId: "mgr",
  employee: { id: "worker" },
}).error, "NIGHT_FITNESS_EMPLOYEE_ONLY");
assert.equal(checkSubmitOtherRequestGate({
  type: NIGHT_FITNESS_TYPE,
  file: fitnessFile,
  from: "2026-09-01",
  to: "2027-08-31",
  actorId: "worker",
  employee: { id: "worker" },
  lane: "mine",
}).ok, true);
assert.equal(resolveNightFitnessPeriod({ from: "2026-09-01", to: "2027-08-31" }).until, "2027-08-31");
assert.equal(resolveNightFitnessPeriod({ permanent: true }).until, "");

const periodEmp = { profile: {} };
const periodReq = {
  type: NIGHT_FITNESS_TYPE,
  file: fitnessFile,
  from: "2026-09-01",
  to: "2027-08-31",
  permanent: false,
};
assert.equal(stampNightFitnessOnEmployee(periodEmp, periodReq).ok, true);
assert.equal(periodEmp.profile.nightMedicalReport.from, "2026-09-01");
assert.equal(periodEmp.profile.nightMedicalReport.to, "2027-08-31");
assert.equal(periodEmp.profile.nightMedicalReport.issuedAt, "2026-09-01");
assert.equal(periodEmp.profile.nightMedicalReport.until, "2027-08-31");
assert.equal(periodEmp.profile.nightMedicalReport.permanent, false);

const permEmp = { profile: {} };
const permReq = { type: NIGHT_FITNESS_TYPE, file: fitnessFile, permanent: true, from: "2026-09-01" };
assert.equal(stampNightFitnessOnEmployee(permEmp, permReq).ok, true);
assert.equal(permEmp.profile.nightMedicalReport.permanent, true);
assert.equal(permEmp.profile.nightMedicalReport.to, "");
assert.equal(permEmp.profile.nightMedicalReport.until, "");
assert.equal(permEmp.profile.nightMedicalPermanent, true);

const decidePeople = [
  {
    id: "worker",
    leaveRequests: [{ id: "lv1", status: "pending", type: "annual" }],
    otherRequests: [
      { id: "nf1", type: NIGHT_FITNESS_TYPE, status: "pending" },
      { id: "sc1", type: STUDY_CONSENT_TYPE, status: "pending" },
      { id: "mp1", type: "manual_punch", status: "pending" },
    ],
  },
];
assert.equal(isManagerDecideOtherRequest(decidePeople[0].otherRequests[0]), true);
assert.equal(isManagerDecideOtherRequest(decidePeople[0].otherRequests[1]), true);
assert.equal(isManagerDecideOtherRequest(decidePeople[0].otherRequests[2]), true);
assert.equal(pendingManagerDecideCount(decidePeople), 4, "leave + study + night fitness + punch reach الإدارة");

console.log("other-request derivations ok");
