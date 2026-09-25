import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEmployeeFileView,
  hasPendingLeaveDecision,
  hasPendingLeaveFilePointer,
  isViewerOwnFile,
  leaveOnFile,
  pendingLeavePointerCopy,
  requestSelfEmployee,
} from "../src/lib/employeeFileView.js";
import {
  annualRemainingWithGrants,
  collectRequestArchive,
  collectRequestFiles,
  buildRequestAudit,
  buildRequestRefuseAudit,
  checkRefuseRequestReasonGate,
  collectRequestInbox,
  collectRequestAuditLogs,
  collectRequestRefuseLogs,
  filterRequestArchive,
  manageArchiveRows,
  mineArchiveRows,
  requestArchiveSmartItems,
  hasRequestRefuseAudit,
  derivedAlertCount,
  inboxNoticeShowsBody,
  requestNoticeHref,
  requestDecisionLivesInWorkspace,
  DISCRETIONARY_GRANT_CAP,
  DOC_KINDS,
  flattenWorkspaceRows,
  isEndedInboxRequest,
  isLiveInboxRequest,
  isSettledRequest,
  isUnseenApprovedLeave,
  liveInboxRows,
  managerPendingInbox,
  managerEmployeeRegister,
  managerPersonEmptyReason,
  firstPendingRegisterPerson,
  leftoverGrantDays,
  leaveKindMeta,
  leaveKindsFor,
  officialHolidays,
  REQUEST_KINDS,
  composeRequestKinds,
  isManageRaiseKind,
  checkAdminLeaveCreditGate,
  composeAdminLeaveCreditGates,
  composeStudyConsentRaiseGates,
  uniqueNamedGates,
  isOwnMineLaneRow,
  mineInboxRows,
  lawArticleCards,
  requestStatuteCite,
  supportingFileRecord,
  filterRequestPeople,
  filterPendingRequests,
  isPendingDecideStatus,
  requestPeopleStations,
  requestRegardingLine,
  managerRequestNoticeText,
  otherStationsPendingStrip,
  stationDisplayName,
  requestReplyHref,
  requestReplyCopy,
  isWorkspaceDeskDecision,
  pendingWorkspaceDecideCount,
} from "../src/lib/requestWorkspace.js";
import { checkSelfDecideRequestGate, headSelfDecidesFromMine, isCompanyHeadPerson, requestInboxEmployees, requestMayDecideOnLane, requestNoticeAudience } from "../src/lib/dutyScope.js";
import { pendingRequestsBadgeCount } from "../src/lib/suiteBadges.js";
import {
  checkApproveLeaveGate,
  checkLeaveDatesGate,
  checkNoOtherEmployerGate,
  checkSeeLeaveDecisionGate,
  checkSubmitLeaveGate,
  checkLeaveSelfRaiseGate,
  hasLeaveAttachment,
  isRealSupportingFile,
  leaveNeedsArticle118Ack,
  leaveNeedsAttachment,
  CHAPTER_LEAVE_TYPES,
  LEAVE_TYPES,
} from "../src/lib/leaveDerivations.js";
import {
  checkApproveOtherRequestGate,
  checkRejectStudyConsentGate,
  checkRevokeStudyConsentGate,
  checkSubmitOtherRequestGate,
  checkSubmitStudyConsentGate,
  resolveStudyConsentFields,
  hasIrrevocableStudyConsent,
  LEAVE_TOPUP_TYPE,
  OTHER_REQUEST_TYPES,
  EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID,
  EXAM_LEAVE_TRACK_PAID,
  STUDY_CONSENT_IRREVOCABLE_AR,
  STUDY_CONSENT_LABEL_AR,
  STUDY_CONSENT_TYPE,
  NIGHT_FITNESS_TYPE,
  NIGHT_FITNESS_LABEL_AR,
  appendRequestAudit,
  hasRequestAudit,
} from "../src/lib/otherRequestDerivations.js";
import { consentRowHref, nightWrittenConsentGlow } from "../src/lib/writtenConsent.js";
import { checkRaiseSignableGate, isSignableRequestType } from "../src/lib/requestSigning.js";
import { inferStatutoryTone, statutoryChipStyle } from "../src/lib/statutoryItem.js";
import { hasWrittenNightConsent } from "../src/lib/decision18632.js";
import { nightRotateDue } from "../src/lib/nightRotateCycle.js";
import { seedPreviewOwnerNightStreak } from "../src/lib/previewMigrations.js";
import {
  leaveApprovalBlessing,
  leaveApprovalCardNote,
  leaveDecisionNoticeText,
} from "../src/lib/leaveEntitlementCycle.js";
import { cleanNotificationText, formatNotificationText } from "../src/lib/notificationKind.js";

function canManageRequests(user, data) {
  if (!user || !data) return false;
  if (user.role === "owner" || user.isOwner || (data.ownerId && user.id === data.ownerId)) return true;
  if (["director", "ops_manager", "pgm", "station_manager"].includes(user.role)) return true;
  const level = (data.hrLevels || []).find((row) => row.id === user.hrLevelId && row.active !== false);
  return !!level?.permissions?.includes("manage_leave");
}

assert.equal(canManageRequests({ role: "employee" }, { employees: [] }), false);
assert.equal(canManageRequests({ role: "station_manager" }, { employees: [] }), true);
assert.equal(canManageRequests({ id: "h1", hrLevelId: "hr" }, { hrLevels: [{ id: "hr", permissions: ["manage_leave"] }] }), true);
assert.equal(canManageRequests({ id: "h2", hrLevelId: "hr" }, { hrLevels: [{ id: "hr", permissions: ["view_employees"] }] }), false);

assert.ok(REQUEST_KINDS.some((row) => row.id === "leave"));
assert.ok(REQUEST_KINDS.some((row) => row.id === "study_consent" && row.type === STUDY_CONSENT_TYPE && row.ar === STUDY_CONSENT_LABEL_AR && row.ar === "موافقة دراسية"));
assert.ok(REQUEST_KINDS.some((row) => row.id === "night_fitness" && row.type === NIGHT_FITNESS_TYPE && row.ar === NIGHT_FITNESS_LABEL_AR && row.employeeOnly));
assert.ok(composeRequestKinds("mine").some((row) => row.id === "night_fitness"));
assert.ok(!composeRequestKinds("manage").some((row) => row.id === "night_fitness"), "الإدارة does not compose لياقة ليلية");
assert.ok(composeRequestKinds("mine").some((row) => row.id === "leave"));
assert.ok(!composeRequestKinds("mine").some((row) => row.manageOnly));
assert.ok(composeRequestKinds("manage").every((row) => !row.employeeOnly));
assert.ok(!composeRequestKinds("manage").some((row) => row.id === "leave"), "إدارة must not raise leave as the employee");
assert.ok(!composeRequestKinds("manage").some((row) => row.id === "study_consent"), "إدارة must not raise study consent");
assert.ok(composeRequestKinds("manage").some((row) => row.id === "other"), "إدارة raises طلب آخر as management");
assert.ok(!composeRequestKinds("manage").some((row) => row.id === "doc"));
assert.ok(!composeRequestKinds("manage").some((row) => row.id === "money"));
assert.ok(!composeRequestKinds("manage").some((row) => row.id === "custody"));
assert.ok(!composeRequestKinds("manage").some((row) => row.id === "manual"));
assert.ok(!composeRequestKinds("manage").some((row) => row.id === "leave_topup"), "إدارة must not raise رصيد as worker balance request");
assert.ok(composeRequestKinds("manage").some((row) => row.id === "leave_credit" && row.manageOnly), "إدارة composes إضافة رصيد as admin credit");
assert.ok(!composeRequestKinds("mine").some((row) => row.id === "leave_credit"), "ملفي does not compose admin credit");
assert.ok(composeRequestKinds("manage").some((row) => row.id === "ot_assign"));
assert.ok(!composeRequestKinds("mine").some((row) => row.id === "ot_assign"));
assert.deepEqual(composeRequestKinds("manage").map((row) => row.id).sort(), ["leave_credit", "ot_assign", "other"], "manage raise is OT + credit + other");
assert.equal(isManageRaiseKind("ot_assign"), true);
assert.equal(isManageRaiseKind("leave_credit"), true);
assert.equal(isManageRaiseKind("other"), true);
assert.equal(isManageRaiseKind("leave"), false);
assert.equal(isManageRaiseKind("leave_topup"), false);

/** Manager raises طلب آخر on the employee's file — same audit helpers store uses on raise. */
{
  const subject = { id: "emp-ahmed", name: "أحمد السالم", otherRequests: [] };
  const raised = {
    id: "oreq-mgr-1",
    type: "other_request",
    title: "نقل وردية تجريبي",
    reason: "نقل وردية تجريبي — طلب الإدارة",
    status: "pending",
    requestedBy: "مدير الفرع",
    requestedById: "mgr-1",
    employeeId: subject.id,
    createdAt: "2026-09-21T10:00:00.000Z",
  };
  const raiseAudit = buildRequestAudit({
    actor: "مدير الفرع",
    employeeId: subject.id,
    employeeName: subject.name,
    request: raised,
    family: "other",
    verb: "raise",
    reason: raised.reason,
    at: raised.createdAt,
  });
  raised.auditTrail = appendRequestAudit(raised, raiseAudit);
  subject.otherRequests = [raised];
  assert.equal(subject.otherRequests[0].employeeId, "emp-ahmed", "manager raise lands on the employee file");
  assert.equal(subject.otherRequests[0].requestedById, "mgr-1", "manager is the actor who sent it");
  assert.equal(hasRequestAudit(subject.otherRequests[0], "raise"), true, "raise writes an audit row");
  assert.match(raiseAudit.details, /مدير الفرع.*raised other_request on أحمد السالم's file/);
  assert.equal(raiseAudit.verb, "raise");
  assert.equal(raiseAudit.employeeId, "emp-ahmed");
}

/** Manager must not invent leave on the employee file — LEAVE_EMPLOYEE_ONLY. */
{
  const blocked = checkSubmitLeaveGate(
    {
      type: "annual",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      days: 3,
      reason: "تسجيل من الإدارة",
      requestedById: "mgr-1",
      noOtherEmployerAck: true,
    },
    {
      profile: { hireDate: "2020-01-01", gender: "male" },
      requests: [],
      employee: { id: "emp-ahmed", name: "أحمد السالم" },
      employeeId: "emp-ahmed",
      actorId: "mgr-1",
      requestedById: "mgr-1",
    },
  );
  assert.equal(blocked.ok, false, "manager cannot submit annual leave for the employee");
  assert.equal(blocked.error, "LEAVE_EMPLOYEE_ONLY");
  const selfOk = checkLeaveSelfRaiseGate(
    { type: "annual", requestedById: "emp-ahmed" },
    { employeeId: "emp-ahmed", employee: { id: "emp-ahmed" } },
  );
  assert.equal(selfOk.ok, true, "worker may raise own leave");
  assert.ok(!composeRequestKinds("manage").some((row) => row.id === "night_fitness"));
  assert.ok(REQUEST_KINDS.find((row) => row.id === "night_fitness")?.employeeOnly, "18632 fitness stays employee-only");
}

assert.equal(requestReplyHref({ mine: true }), "/app/requests", "worker follows the reply on ملفي");
assert.equal(requestReplyHref({ manage: true }), "/app/requests/manage", "manager decides on إدارة");
assert.equal(requestReplyHref({ mine: false }), "/app/requests/manage", "not-mine reply opens إدارة");
assert.equal(requestReplyHref({ selfDecide: true }), "/app/requests/manage", "apex reply is on إدارة");
assert.equal(requestReplyCopy(true), "الرد في طلباتي");
assert.equal(isWorkspaceDeskDecision({ family: "leave", type: "exam" }), true);
assert.equal(isWorkspaceDeskDecision({ type: STUDY_CONSENT_TYPE }), true);
assert.equal(isWorkspaceDeskDecision({ type: "advance" }), false);
assert.ok(REQUEST_KINDS.some((row) => row.id === "leave_topup" && row.type === LEAVE_TOPUP_TYPE && row.ar === "رفع رصيد إجازة"));
assert.ok(REQUEST_KINDS.some((row) => row.id === "leave_credit" && row.manageOnly && row.ar === "إضافة رصيد"));
assert.ok(REQUEST_KINDS.some((row) => row.id === "ot_assign" && row.type === "overtime" && row.assignment && row.manageOnly && row.ar === "تكليف إضافي"));
assert.ok(REQUEST_KINDS.some((row) => row.type === "manual_punch"));
assert.ok(REQUEST_KINDS.some((row) => row.id === "other" && row.type === "other_request"));
assert.ok(DOC_KINDS.some((row) => row.id === "salary" && row.salary));
assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === "checkout_fix"));
assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === "custody"));
assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === "other_request"));

const archivePeople = [{
  id: "e1",
  name: "أحمد",
  leaveRequests: [{ id: "l1", type: "annual", status: "approved", startDate: "2026-03-01", endDate: "2026-03-03", reviewedAt: "2026-03-04", reason: "سفر", decisionSeenAt: "2026-03-04" }],
  otherRequests: [
    { id: "d1", type: "salary_letter", status: "approved", verifyId: "PWC-TEST-1", reviewedAt: "2026-04-01", reviewedBy: "HR" },
    { id: "w1", type: "written_consent", status: "yes", titleAr: "ليلي", titleEn: "Night", answeredAt: "2026-04-02", seal: { signatureId: "PWC-SEAL-1" }, paper: { name: "ack.jpg", hash: "AA11", url: "data:text/plain,ok" }, senderFile: { name: "form.pdf", hash: "FF01", url: "/signing-preview-pumps.pdf" } },
  ],
}];
assert.equal(collectRequestArchive(archivePeople).rows.length, 3);
assert.ok(collectRequestArchive(archivePeople).groups.some((group) => group.year === "2026"));
assert.ok(collectRequestFiles(archivePeople).some((row) => row.side === "out" && row.ref === "PWC-TEST-1"));
assert.ok(collectRequestFiles([{
  id: "e-iss",
  otherRequests: [{
    id: "sal1",
    type: "salary_letter",
    status: "approved",
    verifyId: "PWC-ISS-1",
    reviewedBy: "مدير",
    issuedFile: { name: "salary-cert.pdf", url: "/issued/salary-cert.pdf" },
  }],
}]).some((row) => row.id === "sal1-issued" && row.downloadUrl === "/issued/salary-cert.pdf"));
assert.ok(!collectRequestInbox([{
  id: "e1",
  otherRequests: [{
    id: "sal1",
    type: "salary_letter",
    status: "approved",
    verifyId: "PWC-ISS-1",
    reviewedAt: "2026-04-01",
    issuedFile: { name: "salary-cert.pdf", url: "/issued/salary-cert.pdf" },
  }],
}], [], "e1", "ar").some((row) => row.downloadUrl === "/issued/salary-cert.pdf"), "issued letter leaves the live inbox");
assert.ok(collectRequestFiles([{
  id: "e-sign",
  otherRequests: [{
    id: "let1",
    type: "salary_letter",
    status: "pending_manager",
    senderFile: { name: "bank-form.pdf", hash: "CC33", url: "/signing-preview-pumps.pdf" },
    signToken: "sig.let1",
    signMark: { page: 1, x: 70, y: 80 },
  }],
}]).some((row) => row.name === "bank-form.pdf" && !row.signHref));
assert.ok(collectRequestFiles(archivePeople).some((row) => row.side === "in" && row.name === "ack.jpg"));
assert.ok(collectRequestFiles(archivePeople).some((row) => row.side === "out" && row.name === "form.pdf" && row.downloadUrl));
assert.ok(!collectRequestInbox(archivePeople, [], "e1", "ar").some((row) => row.href === "/verify"), "settled letter is archive-only");
assert.ok(collectRequestFiles(archivePeople).every((row) => !row.signHref));
assert.ok(collectRequestInbox(archivePeople, [{ userId: "e1", text: "صدرت شهادة تعريف", createdAt: "2026-04-03" }], "e1", "ar").some((row) => row.href === "/app/requests"));
assert.ok(!collectRequestInbox(archivePeople, [{ userId: "e1", text: "اكتمل التوقيع: محضر معاينة.pdf — يمكن تنزيل النسخة النهائية.", createdAt: "2026-09-10" }], "e1", "ar").some((row) => /اكتمل التوقيع/.test(row.head)));
assert.ok(!collectRequestInbox(archivePeople, [{ userId: "e1", text: "طلب مخزون بانتظار فرع المصدر — قفازات.", createdAt: "2026-09-10" }], "e1", "ar").some((row) => /مخزون/.test(row.head)), "stock requests stay in المخزون");
assert.ok(!collectRequestInbox(archivePeople, [{ userId: "e1", text: "اعتُمد طلب المخزون ونُفّذ النقل — قفازات.", createdAt: "2026-09-10" }], "e1", "ar").some((row) => /مخزون/.test(row.head)));
assert.ok(!collectRequestInbox(archivePeople, [{ userId: "e1", text: "Stock request waiting on the supplying station — gloves.", createdAt: "2026-09-10" }], "e1", "en").some((row) => /Stock request/.test(row.head)));
assert.equal(requestNoticeHref("طلب مخزون بانتظار فرع المصدر — قفازات."), "/app/inventory");
assert.equal(requestReplyHref({ mine: true }), "/app/requests");
assert.equal(requestReplyHref({ selfDecide: true }), "/app/requests/manage");
assert.equal(requestReplyHref({ manage: true }), "/app/requests/manage");
assert.equal(requestReplyHref({ mine: false }), "/app/requests/manage");
assert.equal(requestReplyCopy(true), "الرد في طلباتي");
assert.equal(requestReplyCopy(false), "Reply in My Requests");
assert.equal(isWorkspaceDeskDecision({ family: "leave", type: "exam" }), true);
assert.equal(isWorkspaceDeskDecision({ family: "other", type: STUDY_CONSENT_TYPE }), true);
assert.equal(isWorkspaceDeskDecision({ family: "other", type: "advance" }), false);
assert.equal(requestReplyHref({ manage: true }), "/app/requests/manage");
assert.equal(requestReplyHref({ manage: false }), "/app/requests");
assert.equal(requestReplyHref({ mine: true }), "/app/requests");
assert.equal(requestReplyHref({ mine: false }), "/app/requests/manage");
assert.equal(requestReplyHref({ selfDecide: true }), "/app/requests/manage");
assert.equal(requestReplyCopy(true), "الرد في طلباتي");
assert.equal(requestDecisionLivesInWorkspace({ family: "leave", type: "exam" }), true);
assert.equal(requestDecisionLivesInWorkspace({ type: STUDY_CONSENT_TYPE }), true);
assert.equal(requestDecisionLivesInWorkspace({ type: "salary_letter" }), false);
assert.equal(requestNoticeHref("طلب إجازة بانتظار الاعتماد"), "/app/requests", "nameless own pending stays on ملفي");
assert.equal(requestNoticeHref("موافقة دراسية بانتظار القرار"), "/app/requests", "nameless study pending stays on ملفي");
assert.equal(requestNoticeHref("طلب رفع رصيد إجازة بشأن: نيار عبدالله · فرع الخفجي بانتظار مراجعتك."), "/app/requests/manage");
assert.equal(requestNoticeHref("نيار عبدالله — موافقة ليلية سارية (3 أشهر). تبقى حمراء حتى يختار الموظف."), "/app/requests/manage");
assert.equal(requestNoticeHref("نيار عبدالله مستحق موافقة خطية ليلية (القرار 18632) بعد 3 أشهر. يوافق أو يرفض من طلباتي."), "/app/requests/manage");
assert.equal(requestNoticeHref("نيار عبدالله سحب موافقته الخطية على العمل الليلي (القرار 18632)."), "/app/requests/manage");
assert.equal(requestNoticeHref("إجازة معتمدة في التقويم التشغيلي"), "/app/calendar");
assert.equal(requestNoticeHref("اعتُمدت إجازتك (annual) 2026-09-20 → 2026-09-25."), "/app/requests");
assert.equal(requestNoticeHref("تهانينا — اعتُمدت إجازتك السنوية. بارك الله لك فيها؛ هذا حقك فاستمتع به. 2026-09-20 → 2026-09-25"), "/app/requests");
assert.equal(requestNoticeHref("مبارك الزواج. اعتُمدت إجازة الزواج — ألف مبارك وعقبال الدوام. 2026-09-17 → 2026-09-17"), "/app/requests");
assert.equal(requestNoticeHref("شفاك الله وعافاك. اعتُمدت إجازتك المرضية — ارتَحْ واستعدّ. 2026-09-15 → 2026-09-15"), "/app/requests");
assert.equal(derivedAlertCount(3), 3);
assert.equal(derivedAlertCount(0), 0);
assert.equal(derivedAlertCount(undefined), 0);
assert.equal(derivedAlertCount(-2), 0);
assert.equal(inboxNoticeShowsBody({ head: "طلبك بانتظار القرار", body: "يبقى معلّقاً في طلباتي حتى يبتّ المسؤول." }), true);
assert.equal(inboxNoticeShowsBody({ head: "صدرت وثيقتك", body: "صدرت وثيقتك" }), false);
assert.equal(inboxNoticeShowsBody({ head: "صدرت وثيقتك", body: "" }), false);
assert.equal(checkSeeLeaveDecisionGate({ request: { status: "approved" }, employeeId: "e1", actorId: "e1" }).ok, true);
assert.ok(collectRequestInbox([], [{ userId: "e1", text: "طلب إجازة بانتظار الاعتماد", createdAt: "2026-09-14" }], "e1", "ar").some((row) => row.href === "/app/requests"));
assert.ok(!collectRequestInbox([{
  id: "e1",
  leaveRequests: [{ id: "wd1", type: "annual", status: "withdrawn", startDate: "2026-03-01", endDate: "2026-03-02", reviewedAt: "2026-03-03", reason: "تراجع" }],
}], [], "e1", "ar").some((row) => /سُحب طلبك/.test(row.head)), "withdrawn leave is not a live inbox ghost");
assert.ok(collectRequestArchive([{
  id: "e1",
  leaveRequests: [{ id: "wd1", type: "annual", status: "withdrawn", startDate: "2026-03-01", endDate: "2026-03-02", reviewedAt: "2026-03-03", reason: "تراجع" }],
}]).rows.some((row) => row.status === "withdrawn"));

const nightAgreed = {
  id: "nc_live",
  type: "night_consent",
  status: "approved",
  decision: "agree",
  createdAt: "2026-08-01",
};
const nightWithdrawn = {
  id: "nc_wd",
  type: "night_consent",
  status: "withdrawn",
  withdrawnAt: "2026-09-15",
  reviewedAt: "2026-09-15",
  createdAt: "2026-08-01",
};
const nightPeople = [{ id: "e-night", name: "عمر", otherRequests: [nightAgreed, nightWithdrawn], leaveRequests: [] }];
assert.equal(isLiveInboxRequest({ ...nightAgreed, family: "other" }), true, "agreed 18632 stays live so the worker can withdraw");
assert.equal(isEndedInboxRequest({ ...nightWithdrawn, family: "other" }), true, "withdrawn 18632 is ended");
assert.equal(liveInboxRows(nightPeople).map((row) => row.id).join(","), "nc_live");
assert.ok(collectRequestArchive(nightPeople).rows.some((row) => row.id === "other-nc_wd"));
assert.ok(!collectRequestArchive(nightPeople).rows.some((row) => row.id === "other-nc_live"));
assert.ok(!collectRequestInbox(nightPeople, [], "e-night", "ar").some((row) => /سُحب|withdrawn/i.test(row.head)));
assert.ok(collectRequestInbox(nightPeople, [{
  userId: "mgr1",
  text: "عمر سحب موافقته الخطية على العمل الليلي (القرار 18632). يُدوَّر لساعات عادية شهراً على الأقل.",
  createdAt: "2026-09-15",
  read: false,
}], "mgr1", "ar").some((row) => /سحب موافقته الخطية/.test(row.head)));
assert.ok(!collectRequestInbox(nightPeople, [{
  userId: "mgr1",
  text: "عمر سحب موافقته الخطية على العمل الليلي (القرار 18632). يُدوَّر لساعات عادية شهراً على الأقل.",
  createdAt: "2026-09-15",
  read: true,
}], "mgr1", "ar").some((row) => /سحب موافقته الخطية/.test(row.head)), "seen manager notice leaves the unread inbox");

const previewInboxPeople = [
  {
    id: "emp_niyar_preview",
    name: "نيار عبدالله",
    leaveRequests: [],
    otherRequests: [],
  },
  {
    id: "emp_ahmed_preview",
    name: "أحمد السالم",
    leaveRequests: [{ id: "lv_1", status: "pending", type: "annual", createdAt: "2026-09-14" }],
    otherRequests: [{
      id: "or_1",
      status: "pending",
      type: "salary_letter",
      createdAt: "2026-09-14",
      reason: "تقديم للبنك",
    }],
  },
];
const previewInboxNotes = [{ userId: "emp_niyar_preview", text: "طلب إجازة بانتظار الاعتماد", createdAt: "2026-09-14" }];
assert.ok(collectRequestInbox(previewInboxPeople, previewInboxNotes, "emp_niyar_preview", "ar").length > 0, "preview ملفي inbox keeps the pending-leave notice");
assert.ok(collectRequestInbox(previewInboxPeople, [], "emp_ahmed_preview", "ar").length > 0, "preview worker inbox lists pending leave and letter");
assert.ok(collectRequestInbox(previewInboxPeople, [], "emp_ahmed_preview", "ar").some((row) => /بانتظار القرار/.test(row.head) && /إجازة/.test(row.head)));
assert.ok(collectRequestInbox(previewInboxPeople, [], "emp_ahmed_preview", "ar").some((row) => /وثيقتك بانتظار/.test(row.head)));
assert.ok(collectRequestInbox([{
  id: "e-con",
  otherRequests: [{ id: "wc1", type: "written_consent", status: "open", titleAr: "ليلي", titleEn: "Night", createdAt: "2026-09-14" }],
}], [], "e-con", "ar").some((row) => /موافقة خطية بانتظارك/.test(row.head)));
assert.equal(checkLeaveDatesGate({ type: "annual" }).error, "LEAVE_DATES_REQUIRED");
assert.equal(checkApproveLeaveGate({ type: "annual", status: "pending", days: 0 }, false, { profile: { hireDate: "2024-01-15" }, requests: [] }).error, "LEAVE_DATES_REQUIRED");
assert.equal(checkApproveOtherRequestGate({ type: "salary_letter", status: "pending", reason: "تقديم للبنك" }).error, "FILE_REQUIRED");
assert.equal(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  reason: "تقديم للبنك",
  senderFile: { name: "form.pdf", url: "/form.pdf" },
}).error, "PAPER_REQUIRED");
assert.equal(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  reason: "تقديم للبنك",
  senderFile: { name: "form.pdf", url: "/form.pdf" },
  paper: { name: "form-signed.pdf", url: "/form-signed.pdf" },
}).ok, true);
assert.equal(checkApproveOtherRequestGate({
  type: "salary_letter",
  status: "pending",
  issuedFile: { name: "salary-cert.pdf", url: "/issued/salary-cert.pdf" },
}).ok, true, "manager-issued file on salary_letter approve ok");
assert.equal(checkApproveOtherRequestGate({
  type: "employment_letter",
  status: "pending",
  issuedFile: { name: "job-letter.pdf", url: "/issued/job-letter.pdf" },
  reviewNote: "",
}).ok, true, "approve without note ok");
assert.equal(consentRowHref({ id: "wcon_1", signToken: "sig.tok" }), "/app/requests#consent-wcon_1");
assert.doesNotMatch(consentRowHref({ id: "wcon_1", signToken: "sig.tok" }), /signing/);
assert.match(leaveKindsFor({ hireDate: "2024-01-15", gender: "female" }, true, []).find((row) => row.key === "maternity")?.cap || "", /84 يوماً/);
assert.equal(DISCRETIONARY_GRANT_CAP, 5);
assert.equal(checkAdminLeaveCreditGate({ pool: "annual", days: 2, reason: "منحة تشغيل" }).ok, true);
assert.equal(checkAdminLeaveCreditGate({ pool: "grant", days: 2, reason: "منحة تشغيل", profile: {} }).ok, true);
assert.equal(checkAdminLeaveCreditGate({ pool: "grant", days: 2, reason: "منحة تشغيل", canCredit: false }).error, "ROLE_REQUIRED");
assert.equal(checkAdminLeaveCreditGate({ days: 2, reason: "منحة تشغيل" }).error, "POOL_REQUIRED");
assert.equal(checkAdminLeaveCreditGate({ pool: "annual", days: 2, reason: "لا" }).error, "REASON_REQUIRED");
assert.equal(checkAdminLeaveCreditGate({ pool: "grant", days: 6, reason: "منحة تشغيل", profile: {} }).error, "GRANT_CAP");
assert.ok(composeAdminLeaveCreditGates({ pool: "annual", days: 2, reason: "منحة تشغيل" }, "ar").some((row) => row.id === "NO_EMPLOYEE_LEAVE" && row.ok));

const holidays = officialHolidays("2026-09-11");
assert.ok(holidays.find((row) => row.id === "national")?.from === "2026-09-23");
assert.equal(holidays.find((row) => row.id === "national")?.ar, "إجازة اليوم الوطني");
assert.equal(holidays.find((row) => row.id === "founding")?.ar, "إجازة يوم التأسيس");
assert.equal(holidays.find((row) => row.id === "founding")?.from?.slice(5), "02-22");
assert.match(holidays.find((row) => row.id === "national")?.noteAr || "", /23 سبتمبر/);
assert.match(holidays.find((row) => row.id === "founding")?.noteAr || "", /22 فبراير/);
assert.ok(holidays.find((row) => row.id === "fitr")?.days === 4);

const law = lawArticleCards("leave", "109", "ar");
assert.ok(law.some((row) => row.art === "109" && row.live));
assert.ok(law.every((row) => row.text));

const work = lawArticleCards("work", "", "ar");
assert.ok(work.some((row) => row.art === "101" && row.citeKind === "article" && row.text));
assert.ok(work.some((row) => row.art === "102" && row.text));
assert.ok(work.some((row) => row.art === "107" && row.text));
const art58card = work.find((row) => row.art === "58");
assert.equal(art58card?.citeKind, "article");
assert.match(art58card?.text || "", /محل إقامته|موافقة/);
assert.match(art58card?.text || "", /ثلاثين/);
assert.equal(requestStatuteCite({ article: "58" }).article, "58");
assert.equal(requestStatuteCite({ topic: "site" }).article, "58");
assert.equal(requestStatuteCite({ topic: "ot" }).article, "107");
assert.equal(requestStatuteCite({ type: "night_consent" }).decisionId, "18632");
assert.equal(requestStatuteCite({ type: "leave_topup" }).productOnly, true);
assert.equal(requestStatuteCite({ type: "grant" }).productOnly, true);
const nightLaw = work.find((row) => row.art === "18632");
assert.equal(nightLaw?.citeKind, "decision");
assert.ok(nightLaw?.text);
assert.notEqual(nightLaw?.citeKind, "article");
assert.match(nightLaw?.impl || "", /ثلاثة أشهر|قسم التوقيع|زر مباشر|حق التراجع|ثلاث ساعات/);
assert.match(nightLaw?.impl || "", /حق التراجع/);
assert.match(nightLaw?.impl || "", /23:00|تعويض|بدل/);
assert.match(nightLaw?.impl || "", /سحب|البدء من جديد|حرية/);
assert.doesNotMatch(nightLaw?.impl || "", /منتصف الليل/);
assert.doesNotMatch(nightLaw?.impl || "", /جدّد كل شهر|إعادة شهرية واجبة/);

const annual = annualRemainingWithGrants(
  { hireDate: "2024-01-15", discretionaryGrants: [{ days: 3 }] },
  [{ type: "annual", status: "approved", startDate: "2026-03-01", endDate: "2026-03-05", days: 5 }],
  "2026-09-11",
);
assert.equal(annual.statutory, 21);
assert.ok(annual.remaining >= 19);
assert.ok(annual.carryTotal >= 21);
assert.ok(lawArticleCards("leave", "118", "ar").some((row) => row.art === "118" && row.live));
assert.ok(holidays.find((row) => row.id === "adha")?.from);

const kinds = leaveKindsFor({ hireDate: "2024-01-15", discretionaryGrants: [{ days: 2 }], gender: "male" }, true, []);
assert.equal(kinds.find((row) => row.key === "annual")?.article, "109");
assert.match(kinds.find((row) => row.key === "annual")?.cite || "", /المادة 109/);
assert.equal(kinds.find((row) => row.key === "sick")?.article, "117");
assert.match(kinds.find((row) => row.key === "sick")?.cite || "", /المادة 117/);
assert.equal(kinds.find((row) => row.key === "eid")?.article, "112");
assert.match(kinds.find((row) => row.key === "eid")?.cap || "", /مقفلان في الجدول/);
assert.match(kinds.find((row) => row.key === "eid")?.cap || "", /بطلب/);
assert.equal(leaveKindMeta("eid", "2026-09-23").ar, "اليوم الوطني");
assert.equal(leaveKindMeta("eid", "2026-02-22").ar, "يوم التأسيس");
assert.equal(flattenWorkspaceRows([{
  id: "e1",
  name: "ن",
  leaveRequests: [{ type: "eid", status: "pending", startDate: "2026-09-23", endDate: "2026-09-23", days: 1 }],
}], "ar")[0]?.title, "إجازة اليوم الوطني");
assert.equal(flattenWorkspaceRows([{
  id: "e1",
  name: "ن",
  leaveRequests: [{ type: "eid", status: "pending", startDate: "2026-02-22", endDate: "2026-02-22", days: 1 }],
}], "ar")[0]?.title, "إجازة يوم التأسيس");
assert.ok(!kinds.some((row) => row.key === "iddah" || row.key === "maternity"));
assert.ok(kinds.some((row) => row.key === "hajj"));
assert.ok(!leaveKindsFor({ hireDate: "2024-01-15" }, true, []).some((row) => ["maternity", "iddah", "paternity"].includes(row.key)));
for (const row of kinds) {
  const tone = inferStatutoryTone({ article: row.article, entitlement: !!row.article });
  assert.equal(tone, "entitlement", `${row.key} ${row.cite || row.article} is quiet cite when not due`);
  const chip = statutoryChipStyle(tone, { glow: "off" });
  assert.match(String(chip.background), /nv-soft|#F7F8FA/, `${row.key} stays soft navy when not due`);
  assert.doesNotMatch(String(chip.background), /nv-accent|#1E9E63|nv-danger/);
}
const cap98 = statutoryChipStyle(inferStatutoryTone({ article: "98" }), { glow: "off" });
assert.equal(inferStatutoryTone({ article: "98" }), "entitlement");
assert.match(String(cap98.background), /nv-soft|#F7F8FA/, "Art. 98 is soft navy when not due");
assert.doesNotMatch(String(cap98.background), /transparent|nv-accent|#1E9E63/);
const cap101 = statutoryChipStyle(inferStatutoryTone({ article: "101" }), { glow: "off" });
assert.equal(inferStatutoryTone({ article: "101" }), "entitlement");
assert.match(String(cap101.background), /nv-soft|#F7F8FA/, "Art. 101 is soft navy when not due");
const duty118 = statutoryChipStyle(inferStatutoryTone({ article: "118" }), { glow: "off" });
assert.equal(inferStatutoryTone({ article: "118" }), "entitlement");
assert.match(String(duty118.background), /nv-soft|#F7F8FA/, "Art. 118 is soft navy when not due");
const opsChip = statutoryChipStyle(inferStatutoryTone({}), { glow: "off" });
assert.equal(inferStatutoryTone({}), "entitlement");
assert.match(String(opsChip.background), /nv-soft|#F7F8FA/, "قرار تشغيلي / unlabeled cite is soft navy");
const idle106 = lawArticleCards("work", "", "ar").find((row) => row.art === "106");
assert.equal(idle106?.warn, false, "idle 106 cite is not an employer-power warning");
assert.equal(inferStatutoryTone({ article: "106", warn: idle106?.warn }), "entitlement");
const live106 = lawArticleCards("work", "106", "ar").find((row) => row.art === "106");
assert.equal(live106?.warn, true, "106 stays amber only while the assignment is firing");
assert.equal(inferStatutoryTone({ article: "106", warn: live106?.warn }), "warn");
const nightQuiet = statutoryChipStyle(inferStatutoryTone({ decisionId: "18632", entitlement: true }), { glow: "off" });
assert.match(String(nightQuiet.background), /nv-soft|#F7F8FA/, "18632 is soft navy when not due");
assert.ok(kinds.some((row) => row.key === "grant" && row.ar === "رصيد"));
assert.ok(kinds.find((row) => row.key === "grant")?.cap.includes("2"));
assert.equal(kinds.find((row) => row.key === "paternity")?.ar, "أبوة");
assert.equal(leaveKindMeta("paternity").ar, "أبوة");
assert.equal(leaveKindMeta("maternity").ar, "أمومة");
assert.equal(leaveKindMeta("paternity").en, "Paternity");
assert.ok(!kinds.some((row) => row.ar === "مولود" || row.ar === "وضع"));
const femaleKinds = leaveKindsFor({ hireDate: "2024-01-15", gender: "female" }, true, []);
assert.equal(femaleKinds.find((row) => row.key === "maternity")?.ar, "أمومة");
assert.equal(femaleKinds.find((row) => row.key === "iddah")?.article, "160");
assert.match(femaleKinds.find((row) => row.key === "iddah")?.cap || "", /130/);
assert.match(leaveKindsFor({ hireDate: "2024-01-15", gender: "female", religion: "non_muslim" }, true, []).find((row) => row.key === "iddah")?.cap || "", /15/);
assert.ok(!leaveKindsFor({ hireDate: "2024-01-15", gender: "female", religion: "non_muslim" }, true, []).some((row) => row.key === "hajj"));
assert.ok(femaleKinds.some((row) => row.key === "hajj"));
assert.ok(lawArticleCards("leave", "160", "ar").some((row) => row.art === "160" && row.live));
assert.ok(!femaleKinds.some((row) => row.ar === "وضع" || row.key === "paternity"));
assert.equal(LEAVE_TYPES.find((row) => row.key === "maternity")?.ar, "أمومة");
assert.equal(LEAVE_TYPES.find((row) => row.key === "paternity")?.ar, "أبوة");
assert.equal(leftoverGrantDays({ discretionaryGrants: [{ days: 3 }] }, [{ type: "grant", status: "approved", days: 1 }]), 2);

const grantGate = checkSubmitLeaveGate(
  { type: "grant", startDate: "2026-09-12", endDate: "2026-09-14", days: 3, reason: "منحة", noOtherEmployerAck: true },
  { profile: { hireDate: "2024-01-15", discretionaryGrants: [{ days: 2 }] }, requests: [] },
);
assert.equal(grantGate.ok, false);
const grantNoAck = checkSubmitLeaveGate(
  { type: "grant", startDate: "2026-09-12", endDate: "2026-09-12", days: 1, reason: "منحة" },
  { profile: { hireDate: "2024-01-15", discretionaryGrants: [{ days: 2 }] }, requests: [] },
);
assert.equal(grantNoAck.error, "NO_OTHER_EMPLOYER_ACK");
const grantOk = checkSubmitLeaveGate(
  { type: "grant", startDate: "2026-09-12", endDate: "2026-09-12", days: 1, reason: "منحة", noOtherEmployerAck: true },
  { profile: { hireDate: "2024-01-15", discretionaryGrants: [{ days: 2 }] }, requests: [] },
);
assert.equal(grantOk.ok, true);

for (const row of LEAVE_TYPES) {
  assert.equal(leaveNeedsArticle118Ack(row.key), true, row.key);
  assert.equal(checkNoOtherEmployerGate({ type: row.key }).error, "NO_OTHER_EMPLOYER_ACK", row.key);
  assert.equal(checkNoOtherEmployerGate({ type: row.key, noOtherEmployerAck: true }).ok, true, row.key);
  assert.ok(CHAPTER_LEAVE_TYPES.includes(row.key), `${row.key} is a chapter leave type`);
  const notice = leaveDecisionNoticeText({ status: "approved", type: row.key, startDate: "2026-09-20", endDate: "2026-09-20" });
  const card = leaveApprovalCardNote({ type: row.key, startDate: "2026-09-20", endDate: "2026-09-20" });
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(notice), `${row.key} notice has no ISO date`);
  assert.ok(notice.includes(leaveApprovalBlessing(row.key)), `${row.key} notice keeps blessing`);
  assert.match(card, /التقويم التشغيلي|جدول الدوام/);
  if (row.key === "sick" || row.key === "bereavement" || row.key === "bereavement_sibling" || row.key === "iddah") {
    assert.ok(!/تهانينا|مبارك/.test(notice), `${row.key} notice is compassionate`);
  } else {
    assert.ok(/تهانينا|مبارك|بارك|وُفّقت|تقبّل|يسّر|رعاك/.test(notice), `${row.key} notice blesses`);
  }
  const inbox = collectRequestInbox([{
    id: "e-bless",
    leaveRequests: [{
      id: `lv_${row.key}`,
      type: row.key,
      status: "approved",
      startDate: "2026-09-20",
      endDate: "2026-09-20",
      reviewedAt: "2026-09-14",
    }],
  }], [], "e-bless", "ar");
  assert.ok(inbox.some((item) => item.body.includes(leaveApprovalBlessing(row.key))), `${row.key} inbox body blesses`);
}
const arNotice = leaveDecisionNoticeText({ status: "approved", type: "annual", startDate: "2026-09-29", endDate: "2026-10-02" }, "ar");
assert.match(arNotice, /سبتمبر/);
assert.match(arNotice, /أكتوبر/);
assert.ok(!/\d{4}-\d{2}-\d{2}/.test(arNotice), "Arabic notice has no ISO span");
const enNotice = leaveDecisionNoticeText({ status: "approved", type: "annual", startDate: "2026-09-29", endDate: "2026-10-02" }, "en");
assert.match(enNotice, /September/);
assert.match(enNotice, /October/);
assert.match(enNotice, /Congratulations|approved/i);
assert.ok(!/\d{4}-\d{2}-\d{2}/.test(enNotice), "English notice has no ISO span");
assert.match(cleanNotificationText("تهانينا 2026-09-29 → 2026-10-02", "ar"), /سبتمبر/);
assert.match(cleanNotificationText("Congratulations 2026-09-29 → 2026-10-02", "en"), /September/);
assert.ok(!/\d{4}-\d{2}-\d{2}/.test(cleanNotificationText("تهانينا 2026-09-29 → 2026-10-02", "ar")));
assert.equal(cleanNotificationText("اعتُمدت إجازتك (annual) 2026-09-16 → 2026-09-16.", "ar").includes("2026-09-16"), false);
assert.match(cleanNotificationText("اعتُمدت إجازتك (annual) 2026-09-16 → 2026-09-16.", "ar"), /سنوية/);
assert.ok(!/→/.test(cleanNotificationText("2026-09-16 → 2026-09-16", "ar")), "same-day span collapses");
const liveEn = formatNotificationText({
  text: "ISO leftover 2026-09-29",
  leaveDecision: { status: "approved", type: "marriage", startDate: "2026-09-17", endDate: "2026-09-17" },
}, "en");
assert.match(liveEn, /marriage|Marriage|Congratulations/i);
assert.ok(!/\d{4}-\d{2}-\d{2}/.test(liveEn), "payload notice follows current language");
assert.equal(leaveNeedsArticle118Ack("advance"), false);
assert.equal(leaveNeedsArticle118Ack("written_consent"), false);
assert.equal(leaveNeedsArticle118Ack(LEAVE_TOPUP_TYPE), false);
assert.equal(checkNoOtherEmployerGate({ type: "advance" }).ok, true);
assert.equal(checkNoOtherEmployerGate({ type: "salary_letter" }).ok, true);
assert.equal(checkNoOtherEmployerGate({ type: LEAVE_TOPUP_TYPE }).ok, true);
assert.equal(checkSubmitOtherRequestGate({ type: "advance", reason: "سلفة عارضة" }).ok, true);
assert.equal(checkSubmitOtherRequestGate({ type: LEAVE_TOPUP_TYPE, reason: "زيادة أيام", days: 2 }).ok, true);
assert.equal(checkSubmitOtherRequestGate({ type: LEAVE_TOPUP_TYPE, reason: "زيادة أيام" }).error, "DAYS_INVALID");
assert.equal(checkSubmitOtherRequestGate({ type: "shift_change", reason: "تبديل وردية", date: "2026-09-14" }).ok, true);
assert.equal(isSignableRequestType("salary_letter"), true);
assert.equal(isSignableRequestType("leave_topup"), false);
assert.equal(isSignableRequestType("shift_change"), false);
assert.equal(checkSubmitOtherRequestGate({ type: "salary_letter", reason: "تقديم للبنك" }).error, "FILE_REQUIRED");
assert.equal(checkSubmitOtherRequestGate({ type: "salary_letter", reason: "تقديم للبنك", file: { name: "form.pdf", url: "/form.pdf" } }).error, "PAPER_REQUIRED");
assert.equal(checkSubmitOtherRequestGate({ type: "salary_letter", reason: "تقديم للبنك", file: { name: "form.pdf", url: "/form.pdf" }, paper: { name: "form-signed.pdf", url: "/form-signed.pdf" } }).ok, true);
assert.equal(checkRaiseSignableGate({ type: "leave_topup" }).skipped, true);

const maternityNoAck = checkSubmitLeaveGate(
  { type: "maternity", startDate: "2026-08-20", endDate: "2026-11-11", days: 84, files: [{ name: "med.pdf" }], status: "pending", eventDate: "2026-09-01" },
  { profile: { gender: "female", hireDate: "2024-01-15" }, requests: [] },
);
assert.equal(maternityNoAck.error, "NO_OTHER_EMPLOYER_ACK");
const maternityAck = checkSubmitLeaveGate(
  { type: "maternity", startDate: "2026-08-20", endDate: "2026-11-11", days: 84, files: [{ name: "med.pdf" }], status: "pending", eventDate: "2026-09-01", noOtherEmployerAck: true },
  { profile: { gender: "female", hireDate: "2024-01-15" }, requests: [] },
);
assert.equal(maternityAck.ok, true);
assert.equal(checkSubmitLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-05-10", days: 130, files: [{ name: "death.pdf" }], status: "pending", eventDate: "2026-01-01" },
  { profile: { gender: "female", hireDate: "2024-01-15" }, requests: [] },
).error, "NO_OTHER_EMPLOYER_ACK");
assert.equal(checkSubmitLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-05-10", days: 130, files: [{ name: "death.pdf" }], status: "pending", eventDate: "2026-01-01", noOtherEmployerAck: true },
  { profile: { gender: "female", hireDate: "2024-01-15" }, requests: [] },
).ok, true);

assert.equal(leaveNeedsAttachment({ type: "sick", days: 1 }), true);
assert.equal(leaveNeedsAttachment({ type: "exam", days: 1 }), true);

const examSubmit = {
  type: "exam",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  days: 3,
  files: [{ name: "exam.pdf", url: "/exam.pdf" }],
  createdAt: "2026-09-01",
  noOtherEmployerAck: true,
};
assert.equal(checkSubmitLeaveGate(examSubmit, { otherRequests: [], companyId: "c1" }).ok, true);
assert.equal(checkSubmitLeaveGate(examSubmit, { otherRequests: [], companyId: "c1" }).examLeaveTrack, EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID);
assert.notEqual(checkSubmitLeaveGate({ ...examSubmit, examRepeat: false }, { otherRequests: [], companyId: "c1" }).examPayFrom, "paid", "first-exam + paid chip without consent is not the paid track");
assert.notEqual(checkSubmitLeaveGate({ ...examSubmit, examRepeat: false }, { otherRequests: [], companyId: "c1" }).examPayFrom, "paid", "first-exam + paid chip + no consent is not stored as paid");
assert.equal(checkSubmitLeaveGate(examSubmit, {
  otherRequests: [{ type: STUDY_CONSENT_TYPE, status: "pending", companyId: "c1" }],
  companyId: "c1",
}).examLeaveTrack, EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID);
assert.equal(checkSubmitLeaveGate(examSubmit, {
  otherRequests: [{ type: STUDY_CONSENT_TYPE, status: "rejected", companyId: "c1" }],
  companyId: "c1",
}).ok, true);
const studyApproved = { type: STUDY_CONSENT_TYPE, status: "approved", companyId: "c1", approvedAt: "2026-09-08T00:00:00.000Z", approvedBy: "مدير" };
assert.equal(hasIrrevocableStudyConsent({ otherRequests: [studyApproved], companyId: "c1" }, "c1"), true);
assert.equal(checkSubmitLeaveGate(examSubmit, { otherRequests: [studyApproved], companyId: "c1" }).examLeaveTrack, EXAM_LEAVE_TRACK_PAID);
assert.equal(checkApproveOtherRequestGate({ type: STUDY_CONSENT_TYPE, status: "pending" }).error, "STUDY_CONSENT_APPROVAL_FILE_REQUIRED");
assert.equal(checkApproveOtherRequestGate({ type: STUDY_CONSENT_TYPE, status: "pending", issuedFile: { name: "موافقة.pdf", url: "data:x" } }).ok, true);
assert.equal(checkRevokeStudyConsentGate(studyApproved, "withdrawn").error, "STUDY_CONSENT_IRREVOCABLE");

const filledStudyFile = { name: "PHYS1100_Lec1_Exercises_Solutions.pdf", url: "data:application/pdf,x" };
const filledStudy = {
  program: "طاقة",
  institution: "كليات عنيزة",
  startDate: "2026-09-20",
  file: filledStudyFile,
  education: [{}, { institution: "" }, { startDate: "" }],
  otherRequests: [{ type: "advance" }, { type: "salary_letter", date: "" }],
};
assert.equal(checkSubmitStudyConsentGate(filledStudy).ok, true, "filled study_consent name+startDate must pass");
assert.equal(checkSubmitStudyConsentGate(filledStudy).error, undefined);
assert.equal(resolveStudyConsentFields({
  program: "طاقة",
  institutionName: "كليات عنيزة",
  date: "2026-09-20",
  education: [{ institution: "" }, { startDate: "" }],
}).institution, "كليات عنيزة");
assert.equal(resolveStudyConsentFields({
  program: "طاقة",
  institutionName: "كليات عنيزة",
  date: "2026-09-20",
}).startDate, "2026-09-20");
assert.equal(checkSubmitStudyConsentGate({
  program: "طاقة",
  institutionName: "كليات عنيزة",
  date: "2026-09-20",
  file: filledStudyFile,
}).ok, true, "filled institutionName+date aliases must not fail those gates");
const filledStudyGates = composeStudyConsentRaiseGates(filledStudy, "ar");
assert.equal(filledStudyGates.filter((row) => row.id === "INSTITUTION_REQUIRED").length, 1);
assert.equal(filledStudyGates.filter((row) => row.id === "DATE_REQUIRED").length, 1);
assert.equal(filledStudyGates.filter((row) => String(row.text || "").includes("اكتب اسم المؤسسة")).length, 0);
assert.equal(filledStudyGates.filter((row) => String(row.text || "").includes("حدد تاريخ بداية")).length, 0);
assert.equal(filledStudyGates.find((row) => row.id === "INSTITUTION_REQUIRED")?.ok, true);
assert.equal(filledStudyGates.find((row) => row.id === "DATE_REQUIRED")?.ok, true);
const repeatedStudyBlockers = uniqueNamedGates([
  { id: "INSTITUTION_REQUIRED", ok: false, text: "اكتب اسم المؤسسة التعليمية." },
  { id: "INSTITUTION_REQUIRED", ok: false, text: "اكتب اسم المؤسسة التعليمية." },
  { id: "INSTITUTION_REQUIRED", ok: false, text: "اكتب اسم المؤسسة التعليمية." },
  { id: "INSTITUTION_REQUIRED", ok: false, text: "اكتب اسم المؤسسة التعليمية." },
  { id: "DATE_REQUIRED", ok: false, text: "حدد تاريخ بداية الدراسة." },
  { id: "DATE_REQUIRED", ok: false, text: "حدد تاريخ بداية الدراسة." },
  { id: "DATE_REQUIRED", ok: false, text: "حدد تاريخ بداية الدراسة." },
  { id: "DATE_REQUIRED", ok: false, text: "حدد تاريخ بداية الدراسة." },
  { id: "DATE_REQUIRED", ok: false, text: "حدد تاريخ بداية الدراسة." },
  { id: "DATE_REQUIRED", ok: false, text: "حدد تاريخ بداية الدراسة." },
  { id: "DATE_REQUIRED", ok: false, text: "حدد تاريخ بداية الدراسة." },
  { id: "DATE_REQUIRED", ok: false, text: "حدد تاريخ بداية الدراسة." },
  { id: "DATE_REQUIRED", ok: false, text: "حدد تاريخ بداية الدراسة." },
  { id: "DATE_REQUIRED", ok: false, text: "حدد تاريخ بداية الدراسة." },
  { id: "INSTITUTION_REQUIRED", ok: true, text: "المؤسسة: كليات عنيزة" },
  { id: "DATE_REQUIRED", ok: true, text: "بداية الدراسة: 20 سبتمبر 2026" },
]);
assert.equal(repeatedStudyBlockers.filter((row) => row.id === "INSTITUTION_REQUIRED").length, 1, "same institution blocker once");
assert.equal(repeatedStudyBlockers.filter((row) => row.id === "DATE_REQUIRED").length, 1, "same date blocker once");
assert.equal(repeatedStudyBlockers.find((row) => row.id === "INSTITUTION_REQUIRED")?.ok, true);
assert.equal(repeatedStudyBlockers.find((row) => row.id === "DATE_REQUIRED")?.ok, true);
assert.equal(repeatedStudyBlockers.filter((row) => String(row.text || "").includes("اكتب اسم المؤسسة")).length, 0);
assert.equal(repeatedStudyBlockers.filter((row) => String(row.text || "").includes("حدد تاريخ بداية")).length, 0);
const examLeaveNoInstitution = checkSubmitLeaveGate(examSubmit, { otherRequests: [], companyId: "c1" });
assert.equal(examLeaveNoInstitution.ok, true);
assert.ok(!String(examLeaveNoInstitution.reason || "").includes("مؤسسة"), "exam leave is not an enrolment-institution decision");
assert.ok(!String(examLeaveNoInstitution.reasonEn || "").toLowerCase().includes("institution"));
assert.equal(checkRevokeStudyConsentGate(studyApproved, "rejected").reason, STUDY_CONSENT_IRREVOCABLE_AR);
assert.ok(isLiveInboxRequest({ type: STUDY_CONSENT_TYPE, status: "approved", family: "other" }));
assert.equal(isEndedInboxRequest({ type: STUDY_CONSENT_TYPE, status: "approved", family: "other" }), false);
assert.equal(checkSubmitLeaveGate({
  type: "annual",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  days: 3,
  noOtherEmployerAck: true,
}, { profile: { hireDate: "2020-01-01", leaveTotals: { annual: 21 } }, requests: [] }).ok, true);
assert.equal(leaveNeedsAttachment({ type: "iddah", days: 15 }), true);
assert.equal(leaveNeedsAttachment({ type: "maternity", days: 10 }), true);
assert.equal(leaveNeedsAttachment({ type: "annual", days: 1 }), false);
assert.equal(leaveNeedsAttachment({ type: "annual", days: 6 }), true);
assert.equal(leaveNeedsAttachment({ type: "paternity", days: 3 }), false);

const fakePaper = { name: "supporting-document", attested: true };
assert.equal(isRealSupportingFile(fakePaper), false);
assert.equal(hasLeaveAttachment({ files: [fakePaper] }), false);
assert.equal(hasLeaveAttachment({ files: [{ name: "med.pdf" }] }), true);

const realPaper = supportingFileRecord({
  name: "sick-note.pdf",
  size: 2048,
  type: "application/pdf",
  url: "data:application/pdf;base64,AAA",
  hash: "AB12CD34",
});
assert.equal(realPaper.name, "sick-note.pdf");
assert.equal(realPaper.attested, undefined);
assert.ok(!("attested" in realPaper));
assert.equal(isRealSupportingFile(realPaper), true);
assert.equal(hasLeaveAttachment({ files: [realPaper] }), true);

const profile = { hireDate: "2024-01-15" };
const sickBare = checkSubmitLeaveGate(
  { type: "sick", startDate: "2026-09-14", endDate: "2026-09-14", days: 1, reason: "حمى", noOtherEmployerAck: true },
  { profile, requests: [] },
);
assert.equal(sickBare.ok, false);
assert.equal(sickBare.error, "ATTACHMENT_REQUIRED");

const sickFake = checkSubmitLeaveGate(
  { type: "sick", startDate: "2026-09-14", endDate: "2026-09-14", days: 1, reason: "حمى", files: [fakePaper], noOtherEmployerAck: true },
  { profile, requests: [] },
);
assert.equal(sickFake.ok, false);
assert.equal(sickFake.error, "ATTACHMENT_REQUIRED");

const sickReal = checkSubmitLeaveGate(
  { type: "sick", startDate: "2026-09-14", endDate: "2026-09-14", days: 1, reason: "حمى", files: [realPaper], noOtherEmployerAck: true },
  { profile, requests: [] },
);
assert.equal(sickReal.ok, true);

const approveFake = checkApproveLeaveGate(
  { type: "sick", startDate: "2026-09-14", endDate: "2026-09-14", days: 1, files: [fakePaper], status: "pending" },
  true,
  { profile, requests: [] },
);
assert.equal(approveFake.ok, false);
assert.equal(approveFake.error, "ATTACHMENT_REQUIRED");

const paperPeople = [{
  id: "e2",
  name: "سارة",
  leaveRequests: [{ id: "s1", type: "sick", status: "pending", files: [realPaper] }],
}];
assert.ok(collectRequestFiles(paperPeople).some((row) => row.name === "sick-note.pdf" && row.downloadUrl === realPaper.url));
assert.ok(!collectRequestFiles([{
  id: "e3",
  leaveRequests: [{ id: "s2", type: "sick", files: [fakePaper] }],
}]).some((row) => row.name === "supporting-document"));

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(here, "..", rel), "utf8");
const workspaceSrc = src("src/components/requests/RequestsWorkspace.jsx");
const citeSrc = src("src/components/shared/LaborArticleCite.jsx");
assert.match(citeSrc, /chip \|\| badge/, "quiet LaborArticleCite still prints قرار / المادة");
const storeSrc = src("src/lib/store.js");
const pickerSrc = src("src/components/requests/RequestEmployeePicker.jsx");
const consentSrc = src("src/components/requests/WrittenConsentRaise.jsx");
const consentRowSrc = src("src/components/requests/ConsentSignRow.jsx");
const consentInboxSrc = src("src/components/requests/WrittenConsentInbox.jsx");
const signBlockSrc = src("src/components/requests/RequestSelfSignBlock.jsx");
const requestsPageSrc = src("src/pages/Requests.jsx");
const dashSrc = src("src/components/dashboard/StationManagerDashboard.jsx");
const handoffSrc = src("src/components/dashboard/HandoffCommandBoard.jsx");
const leaveTabSrc = src("src/components/employees/LeaveTab.jsx");
const leaveItemSrc = src("src/components/employees/LeaveRequestItem.jsx");
const fileBoardSrc = src("src/components/employees/EmployeeFileLeaveBoard.jsx");
const attendanceSrc = src("src/components/attendance/AttendanceLeaveRequests.jsx");
const dailyDashSrc = src("src/components/attendance/AttendanceDailyDashboard.jsx");
const otherBoardSrc = src("src/components/requests/OtherRequestsBoard.jsx");
const assistantSrc = src("src/lib/assistantActions.js");

const emptySelf = {
  id: "e-mine",
  name: "عمر ناصر",
  profile: { hireDate: "2024-01-15" },
  leaveRequests: [],
  otherRequests: [],
};
assert.equal(flattenWorkspaceRows([emptySelf]).length, 0, "طلباتي empty before submit");
assert.equal(buildEmployeeFileView({ employee: emptySelf, ar: true }).noFiled, true, "file filed board empty before submit");
assert.equal(leaveOnFile(emptySelf.leaveRequests).length, 0, "file empty copy is no filed/approved leave — not طلباتي pending");
assert.equal(hasPendingLeaveDecision(emptySelf.leaveRequests), false);

const unpaidGate = checkSubmitLeaveGate(
  { type: "unpaid", startDate: "2026-09-20", endDate: "2026-09-20", days: 1, reason: "ظرف", noOtherEmployerAck: true },
  { profile: emptySelf.profile, requests: [] },
);
assert.equal(unpaidGate.ok, true);

const pendingLeave = {
  id: "leave_test",
  type: "unpaid",
  startDate: "2026-10-20",
  endDate: "2026-10-20",
  days: 1,
  reason: "ظرف",
  noOtherEmployerAck: true,
  files: [],
  status: "pending",
  createdAt: "2026-09-13T10:00:00.000Z",
};
const afterSubmit = { ...emptySelf, leaveRequests: [pendingLeave] };
const mineRows = flattenWorkspaceRows([afterSubmit]);
assert.equal(mineRows.length, 1, "طلباتي lists the same leaveRequests[] row immediately");
assert.equal(mineRows[0].family, "leave");
assert.equal(mineRows[0].status, "pending");
assert.equal(mineRows[0].id, "leave_test");

const pendingFile = buildEmployeeFileView({ employee: afterSubmit, ar: true });
assert.equal(pendingFile.noFiled, true, "file 'مثبتة' board waits for approval");
assert.equal(pendingFile.filed.length, 0, "file does not list the pending row");
assert.equal(leaveOnFile(afterSubmit.leaveRequests).length, 0, "LeaveTab filed list excludes pending");
assert.equal(hasPendingLeaveDecision(afterSubmit.leaveRequests), true);
assert.equal(pendingWorkspaceDecideCount([afterSubmit]), 1);
assert.equal(pendingFile.hasPendingLeave, true);
assert.equal(pendingFile.pendingPointer, pendingLeavePointerCopy(true));
assert.match(pendingFile.pendingPointer, /طلب بانتظار القرار — الرد في طلباتي/);
assert.equal(pendingFile.filedEmpty, "لا توجد طلبات إجازة بعد");
assert.ok(pendingFile.todos.some((row) => row.text === pendingLeavePointerCopy(true)), "file todo is the one-line pointer, not a pending inbox");
assert.equal(collectRequestArchive([afterSubmit]).rows.length, 0, "archive waits until settled");

const approvedLeave = { ...pendingLeave, status: "approved", reviewedAt: "2026-09-13T12:00:00.000Z" };
const afterApprove = { ...emptySelf, leaveRequests: [approvedLeave] };
const approvedFile = buildEmployeeFileView({ employee: afterApprove, ar: true });
assert.equal(approvedFile.noFiled, false);
assert.equal(approvedFile.filed.length, 1);
assert.equal(leaveOnFile(afterApprove.leaveRequests).length, 1, "approved appears on the file");
assert.equal(approvedFile.hasPendingLeave, false);
assert.equal(flattenWorkspaceRows([afterApprove]).length, 1, "طلباتي still lists approved leave");
assert.equal(isUnseenApprovedLeave(flattenWorkspaceRows([afterApprove])[0]), true, "approval alone is unseen until the worker opens it");
assert.equal(isLiveInboxRequest(flattenWorkspaceRows([afterApprove])[0]), true, "unseen approved leave stays live on ملفي — Art. 109 right is not hidden");
assert.equal(isLiveInboxRequest(flattenWorkspaceRows([afterApprove])[0], { lane: "manage" }), false, "إدارة does not keep unseen approved leave as a decide item");

const workerInbox = {
  id: "worker",
  leaveRequests: [{ id: "lv-pending", type: "annual", status: "pending" }],
  otherRequests: [
    { id: "nf-pending", type: NIGHT_FITNESS_TYPE, status: "pending", from: "2026-09-01", to: "2027-08-31" },
    { id: "sc-pending", type: STUDY_CONSENT_TYPE, status: "pending" },
    { id: "mp-pending", type: "manual_punch", status: "pending" },
    { id: "nf-ok", type: NIGHT_FITNESS_TYPE, status: "approved", permanent: true },
  ],
};
const managerSelf = { id: "boss", leaveRequests: [], otherRequests: [] };
const manageLive = liveInboxRows([workerInbox], "ar", { lane: "manage" });
assert.ok(manageLive.some((row) => row.id === "lv-pending"), "pending leave reaches إدارة");
assert.ok(manageLive.some((row) => row.id === "nf-pending"), "pending night fitness reaches إدارة");
assert.ok(manageLive.some((row) => row.id === "sc-pending"), "pending study consent reaches إدارة");
assert.ok(manageLive.some((row) => row.id === "mp-pending"), "pending punch reaches إدارة");
assert.ok(!manageLive.some((row) => row.id === "nf-ok"), "approved night fitness is not a manage decide item");
assert.equal(isOwnMineLaneRow(flattenWorkspaceRows([workerInbox])[0], "worker"), true);
assert.equal(isOwnMineLaneRow(flattenWorkspaceRows([workerInbox])[0], "boss"), false);
assert.equal(liveInboxRows([workerInbox], "ar", { lane: "mine" }).filter((row) => isOwnMineLaneRow(row, "boss")).length, 0, "manager cannot list another worker's ملفي rows");
assert.ok(!liveInboxRows([managerSelf], "ar", { lane: "mine" }).some((row) => row.employee?.id === "worker"));

const ahmedInbox = managerPendingInbox([previewInboxPeople[1]], "ar");
assert.ok(ahmedInbox.count >= 2, "أحمد leave + letter reach بانتظار قرار");
assert.ok(ahmedInbox.named.some((row) => row.id === "leave" && row.count === 1));
assert.ok(ahmedInbox.named.some((row) => row.id === "other" && row.count === 1));
assert.match(ahmedInbox.emptyReason, /لياقة ليلية/);
assert.match(ahmedInbox.emptyReason, /موافقة دراسية/);
assert.equal(managerPendingInbox([], "ar").count, 0);

const registerPeople = [{
  id: "emp_ahmed_preview",
  name: "أحمد السالم",
  stationId: "st1",
  profile: { hireDate: "2024-01-15" },
  leaveRequests: [{ id: "lv_1", status: "pending", type: "annual", createdAt: "2026-09-14" }],
  otherRequests: [
    { id: "or_1", status: "pending", type: "salary_letter", createdAt: "2026-09-14", reason: "تقديم للبنك" },
    { id: "nf-reg", type: NIGHT_FITNESS_TYPE, status: "pending", from: "2026-09-01", to: "2027-08-31", permanent: false },
    { id: "sc-reg", type: STUDY_CONSENT_TYPE, status: "approved", companyId: "c1", approvedAt: "2026-09-10T00:00:00.000Z" },
  ],
}, {
  id: "emp_quiet",
  name: "سارة حسن",
  stationId: "st1",
  profile: { hireDate: "2024-01-15" },
  leaveRequests: [],
  otherRequests: [{ id: "nf-ok", type: NIGHT_FITNESS_TYPE, status: "approved", permanent: true }],
}];
const register = managerEmployeeRegister(registerPeople, "ar", { stations: [{ id: "st1", name: "فرع الخفجي" }] });
assert.equal(register.rows[0].name, "أحمد السالم", "pending people sort first");
assert.ok(register.rows[0].pendingCount >= 3, "leave + letter + night fitness count on سجل");
assert.ok(register.rows[0].pendingNamed.some((row) => row.id === NIGHT_FITNESS_TYPE));
assert.ok(register.rows[0].pendingNamed.some((row) => row.id === "leave"));
assert.match(register.rows[0].studyLabel, /موافقة دراسية مسجّلة/);
assert.match(register.rows[0].nightLabel, /لياقة ليلية معلّقة/);
assert.match(register.rows[0].balance, /متبق/);
assert.match(register.rows[0].statusLine, /رصيد/);
assert.match(register.rows[0].statusLine, /دراسة مسجّلة/);
assert.match(register.rows[0].statusLine, /لياقة معلّقة/);
assert.equal(managerPersonEmptyReason("ar"), "لا طلب معلّق لهذا الملف.");
assert.ok(register.rows[0].history.some((row) => row.type === NIGHT_FITNESS_TYPE));
assert.equal(register.rows.length, 1, "inbox lists only people with a pending request");
assert.equal(register.groups.length, 1);
assert.match(register.groups[0].alert, /شخص واحد/);
assert.equal(register.people[1].name, "سارة حسن");
assert.equal(register.people[1].pendingCount, 0);
assert.match(register.people[1].nightLabel, /دائم/);
assert.equal(managerPendingInbox([registerPeople[0]], "ar").named.some((row) => row.id === NIGHT_FITNESS_TYPE), true);
assert.equal(liveInboxRows(registerPeople, "ar", { lane: "mine" }).filter((row) => isOwnMineLaneRow(row, "emp_quiet")).every((row) => row.employee?.id === "emp_quiet"), true);

assert.equal(isEndedInboxRequest(flattenWorkspaceRows([afterApprove])[0]), false, "mere approval is not ended");
assert.equal(collectRequestArchive([afterApprove]).rows.length, 0, "unseen approved leave is not archived yet");

const afterSeen = { ...emptySelf, leaveRequests: [{ ...approvedLeave, decisionSeenAt: "2026-09-13T13:00:00.000Z" }] };
assert.equal(isLiveInboxRequest(flattenWorkspaceRows([afterSeen])[0]), false, "after the worker sees the decision the card leaves ملفي");
assert.equal(isEndedInboxRequest(flattenWorkspaceRows([afterSeen])[0]), true, "seen approved leave is ended for the inbox");
assert.equal(collectRequestArchive([afterSeen]).rows.length, 1, "seen approved leave sits in الأرشيف");
assert.equal(collectRequestArchive([afterSeen]).rows[0].withdrawOpen, true, "archive still knows the Art. 109 withdraw window");

const examSeenNoSat = {
  ...emptySelf,
  leaveRequests: [{
    id: "exam_sat",
    type: "exam",
    family: "leave",
    status: "approved",
    startDate: "2026-09-10",
    endDate: "2026-09-12",
    days: 3,
    files: [{ name: "times.pdf", url: "/times.pdf", kind: "exam_notice" }],
    decisionSeenAt: "2026-09-13T13:00:00.000Z",
  }],
};
assert.equal(isEndedInboxRequest(flattenWorkspaceRows([examSeenNoSat])[0]), false, "exam leave stays live until sitting proof is attached");
assert.equal(isLiveInboxRequest(flattenWorkspaceRows([examSeenNoSat])[0]), true, "ملفي keeps the exam card for the second paper");
assert.equal(isLiveInboxRequest(flattenWorkspaceRows([examSeenNoSat])[0], { lane: "manage" }), true, "إدارة sees due sitting proof after the exam days");
const examSeenWithSat = {
  ...emptySelf,
  leaveRequests: [{ ...examSeenNoSat.leaveRequests[0], examSatFile: { name: "sit.pdf", url: "/sit.pdf", kind: "exam_sat" } }],
};
assert.equal(isEndedInboxRequest(flattenWorkspaceRows([examSeenWithSat])[0]), true, "sitting proof plus seen decision ends the exam card");
assert.equal(collectRequestFiles([examSeenWithSat], "ar").some((row) => row.kindAr === "إثبات أداء الامتحان"), true);

const startedUnseen = { ...approvedLeave, startDate: "2026-09-01", endDate: "2026-09-05" };
const afterStarted = { ...emptySelf, leaveRequests: [startedUnseen] };
assert.equal(isLiveInboxRequest(flattenWorkspaceRows([afterStarted])[0]), true, "started approved leave stays live until the worker sees it");
assert.equal(isEndedInboxRequest(flattenWorkspaceRows([afterStarted])[0]), false, "do not treat start-date as ended if unseen");
assert.equal(collectRequestArchive([afterStarted]).rows.length, 0);

const mixed = { ...emptySelf, leaveRequests: [pendingLeave, approvedLeave] };
const mixedFile = buildEmployeeFileView({ employee: mixed, ar: true });
assert.equal(flattenWorkspaceRows([mixed]).filter((row) => row.status === "pending").length, 1, "طلباتي flatten still has pending");
assert.equal(mixedFile.filed.length, 1, "file lists approved only");
assert.equal(leaveOnFile(mixed.leaveRequests).every((row) => row.status === "approved"), true);
assert.equal(mixedFile.hasPendingLeave, true, "file shows the one-line pointer while pending exists");

const pendingTopup = {
  ...emptySelf,
  otherRequests: [{
    id: "top_1",
    type: LEAVE_TOPUP_TYPE,
    days: 3,
    reason: "منحة إدارية",
    status: "pending",
    createdAt: "2026-09-13T10:00:00.000Z",
  }],
};
const topupRows = flattenWorkspaceRows([pendingTopup]);
assert.equal(topupRows.length, 1);
assert.equal(topupRows[0].family, "other");
assert.equal(topupRows[0].type, LEAVE_TOPUP_TYPE);
assert.match(topupRows[0].title, /رفع رصيد إجازة/);
assert.equal(hasPendingLeaveDecision(pendingTopup.leaveRequests), false);
assert.equal(hasPendingLeaveFilePointer(pendingTopup), true);
const topupFile = buildEmployeeFileView({ employee: pendingTopup, ar: true });
assert.equal(topupFile.hasPendingLeave, true);
assert.equal(topupFile.pendingPointer, pendingLeavePointerCopy(true));
assert.equal(topupFile.filed.length, 0);

const otAssignPeople = [{
  id: "e2",
  name: "سالم",
  leaveRequests: [],
  otherRequests: [{
    id: "ot1",
    type: "overtime",
    assignment: true,
    article106: true,
    article106Ground: "danger",
    hours: 4,
    date: "2026-09-13",
    status: "pending_employee",
    files: [{ name: "incident.pdf", size: 1200, url: "data:application/pdf,ok", hash: "BB22" }],
    reason: "حريق",
    createdAt: "2026-09-13T10:00:00.000Z",
  }],
}];
const otRows = flattenWorkspaceRows(otAssignPeople);
assert.equal(otRows.length, 1);
assert.match(otRows[0].title, /تكليف إضافي إجباري/);
assert.equal(otRows[0].article, "106");
assert.equal(otRows[0].fileName, "incident.pdf");
assert.equal(isSettledRequest(otRows[0]), false);

const searchPeople = [
  { id: "k1", name: "خالد القحطاني", nameEn: "Khalid Al-Qahtani", stationId: "riyadh" },
  { id: "a1", name: "أحمد السلمي", stationId: "jeddah", profile: { nickname: "ابو فهد" } },
  { id: "f1", name: "فهد الشمري", stationId: "riyadh" },
];
const searchStations = [
  { id: "riyadh", name: "فرع الرياض" },
  { id: "jeddah", name: "فرع جدة" },
];
const allHits = filterRequestPeople({ employees: searchPeople, stations: searchStations });
assert.equal(allHits.ok, true);
assert.equal(allHits.rows.length, 3);
assert.equal(allHits.rows[0].branchLineAr, "من فرع الرياض");
const byName = filterRequestPeople({ employees: searchPeople, stations: searchStations, query: "خالد" });
assert.deepEqual(byName.rows.map((row) => row.id), ["k1"]);
const hamza = filterRequestPeople({ employees: searchPeople, stations: searchStations, query: "احمد" });
assert.deepEqual(hamza.rows.map((row) => row.id), ["a1"]);
const english = filterRequestPeople({ employees: searchPeople, stations: searchStations, query: "khalid" });
assert.deepEqual(english.rows.map((row) => row.id), ["k1"]);
const nick = filterRequestPeople({ employees: searchPeople, stations: searchStations, query: "ابو فهد" });
assert.deepEqual(nick.rows.map((row) => row.id), ["a1"]);
const byBranch = filterRequestPeople({ employees: searchPeople, stations: searchStations, query: "جدة" });
assert.deepEqual(byBranch.rows.map((row) => row.id), ["a1"]);
const scoped = filterRequestPeople({ employees: searchPeople, stations: searchStations, stationId: "riyadh", query: "فهد" });
assert.deepEqual(scoped.rows.map((row) => row.id), ["f1"]);
const noMatch = filterRequestPeople({ employees: searchPeople, stations: searchStations, query: "نورة" });
assert.equal(noMatch.ok, false);
assert.equal(noMatch.error, "NO_MATCH");
assert.match(noMatch.reason, /نورة/);
const emptyRoster = filterRequestPeople({ employees: [], stations: searchStations });
assert.equal(emptyRoster.error, "EMPTY_ROSTER");
const emptyBranch = filterRequestPeople({ employees: searchPeople, stations: searchStations, stationId: "missing" });
assert.equal(emptyBranch.error, "NO_STATION_PEOPLE");
assert.deepEqual(requestPeopleStations(searchPeople, searchStations).map((row) => row.id).sort(), ["jeddah", "riyadh"]);

const pendingQueue = flattenWorkspaceRows([
  { id: "k1", name: "خالد القحطاني", leaveRequests: [{ id: "pl1", type: "annual", status: "pending", startDate: "2026-09-20", endDate: "2026-09-22", reason: "سفر", createdAt: "2026-09-13T10:00:00.000Z" }] },
  { id: "a1", name: "أحمد السلمي", leaveRequests: [{ id: "ok1", type: "annual", status: "approved", startDate: "2026-08-01", endDate: "2026-08-02", createdAt: "2026-08-01T10:00:00.000Z" }] },
]);
assert.equal(isPendingDecideStatus("pending"), true);
assert.equal(isPendingDecideStatus("approved"), false);
const pendingAll = filterPendingRequests({ rows: pendingQueue, stations: searchStations });
assert.equal(pendingAll.ok, true);
assert.deepEqual(pendingAll.rows.map((row) => row.id), ["pl1"]);
const pendingByName = filterPendingRequests({ rows: pendingQueue, stations: searchStations, query: "خالد" });
assert.deepEqual(pendingByName.rows.map((row) => row.id), ["pl1"]);
const pendingNoHit = filterPendingRequests({ rows: pendingQueue, stations: searchStations, query: "نورة" });
assert.equal(pendingNoHit.ok, false);
assert.equal(pendingNoHit.error, "NO_MATCH");
assert.equal(filterPendingRequests({ rows: flattenWorkspaceRows([{ id: "x", leaveRequests: [] }]) }).error, "EMPTY_QUEUE");

assert.match(workspaceSrc, /<RequestInboxSlab/, "إشعاراتي stays on ملفي");
assert.match(workspaceSrc, /mode !== "manage"/, "إدارة hides إشعاراتي and leftover slabs");
assert.match(workspaceSrc, /StatutoryItem article=\{row\.article\}/, "leave kinds keep المادة chips");
assert.match(workspaceSrc, /isRosterLockedCivicHoliday/, "civic holidays are not raised from the official-holiday strip");
assert.match(workspaceSrc, /مقفلة بلا طلب/, "National Day and Founding Day read as roster-locked");
assert.match(workspaceSrc, /مقفلان في الجدول بلا طلب/, "طلباتي stipulates National and Founding lock on the roster with no request");
assert.doesNotMatch(workspaceSrc, /اضغط لطلبها/, "civic holidays are not «tap to request»");
assert.match(workspaceSrc, /اضغط لطلب العيد/, "Eid remains requestable from the strip");
assert.match(workspaceSrc, /decisionId="18632"/, "night consent keeps قرار 18632");
assert.match(consentInboxSrc, /nightWrittenConsentGlow/, "open night consent paints the inbox 18632 due glow");
assert.equal(nightWrittenConsentGlow([{
  otherRequests: [{ type: "written_consent", topic: "night", status: "open" }],
}]), "due");
assert.equal(nightWrittenConsentGlow([{
  otherRequests: [{ type: "written_consent", topic: "night", status: "yes" }],
}]), "off");
assert.equal(statutoryChipStyle("entitlement", { glow: "due" })["--nv-stat-glow"], "transparent");
assert.match(String(statutoryChipStyle("entitlement", { glow: "due" }).background), /nv-warn/);
assert.doesNotMatch(String(statutoryChipStyle("entitlement", { glow: "due" }).background), /nv-danger|#DC2626/);
assert.match(workspaceSrc, /PendingRequestFinder/, "إدارة typeahead finds a pending request");
assert.match(workspaceSrc, /ManagerEmployeeRegister/, "إدارة shows a due-inbox column");
assert.match(src("src/components/requests/ManagerEmployeeRegister.jsx"), /بانتظار القرار/, "register heading is the due inbox");
assert.match(workspaceSrc, /القرار/, "decision pane heading");
assert.match(workspaceSrc, /managerPersonEmptyReason/, "selected-file empty copy");
assert.match(workspaceSrc, /openRegister\(row\.employee\.id\)/, "finder still opens that سجل");
assert.match(workspaceSrc, /تكليف أو رصيد أو طلب من الإدارة|من الإدارة — تكليف أو رصيد/, "manage raise is labeled as management act");
assert.match(workspaceSrc, /showRaiseForm/, "raise form is gated off the manage inbox");
assert.doesNotMatch(workspaceSrc, /بنفس أنواع ملفي/, "manage must not claim the same kinds as ملفي");
assert.doesNotMatch(workspaceSrc, /يُحفظ في ملفه باسمك/, "manage must not imply the request is saved as the employee");
assert.match(requestsPageSrc, /سجل الطلبات/, "إدارة masthead is سجل الطلبات");
assert.match(requestsPageSrc, /يُفتح من له طلب فقط/, "إدارة lede opens only people with a request");
assert.match(requestsPageSrc, /ترفع طلباتك/, "ملفي copy raises");
assert.match(requestsPageSrc, /mineUnseenLeave/, "ملفي tab counts unseen approved leave");
assert.match(workspaceSrc, /RequestEmployeePicker/, "file-record still uses the employee typeahead");
assert.doesNotMatch(workspaceSrc, /<select value=\{employeeId\}/, "employee field is no longer a rigid select");
assert.match(workspaceSrc, /رصيده السنوي/, "ملفي still shows annual remaining on self raise");
assert.match(workspaceSrc, /mode === "manage" \? \([\s\S]*?الفاعل هو المدير/, "manage raise hides remaining-balance hero");
assert.match(src("src/components/requests/ManagerEmployeeRegister.jsx"), /تكليف أو رصيد أو طلب من الإدارة/, "register opens management act, not ملفي masquerade");
assert.match(pickerSrc, /role="combobox"/, "picker is a typeahead, not a native select");
assert.match(pickerSrc, /اكتب الاسم أو الفرع/, "picker accepts a typed name or branch");
assert.match(pickerSrc, /branchLineAr/, "rows show the branch line");
assert.match(consentSrc, /RequestEmployeePicker/, "written consent uses the same picker");
assert.match(consentSrc, /إرسال طلب موافقة/, "consent is send-to-employee, not leave raise");
assert.match(consentSrc, /CONSENT_MINISTRY_HINT_AR/, "consent raise uses the shared ministry hint");
assert.doesNotMatch(consentSrc, /بلا قسم التوقيع|خارج النظام|لا قسم التوقيع/, "consent raise must not deny Digital signing");
assert.match(consentInboxSrc, /CONSENT_MINISTRY_HINT_AR/, "consent inbox uses the shared ministry hint");
assert.doesNotMatch(consentInboxSrc, /بلا قسم التوقيع|تُوقَّع يدوياً|لا قسم التوقيع/, "consent inbox must not deny Digital signing");
assert.doesNotMatch(requestsPageSrc, /بلا قسم التوقيع|not Digital signing/, "إدارة must not deny Digital signing");
assert.match(dashSrc, /طلب إجازة بانتظار القرار/);
assert.match(dashSrc, /\/app\/requests\/manage/, "pending leave alert opens request admin");
assert.doesNotMatch(dashSrc, /\/app\/requests\/leave/, "pending leave alert must not open the raise lane");
assert.match(handoffSrc, /\/app\/requests\/manage/, "review queue and decision KPI open request admin");
assert.doesNotMatch(handoffSrc, /\/app\/requests\/leave/, "review queue must not open the raise lane");
assert.match(consentRowSrc, /consentRowHref/, "consent inbox row has a real action href");
assert.doesNotMatch(consentRowSrc, /CONSENT_MINISTRY_HINT_AR/, "consent row does not reprint the ministry hint");
assert.match(consentRowSrc, /قسم التوقيع/, "copy names Digital signing without linking it");
assert.match(consentRowSrc, /اعتماد/, "continue path ends with approve after upload");
assert.match(consentRowSrc, /أرفض مباشرة/, "refuse is one direct action");
assert.doesNotMatch(consentRowSrc, /href = ""/, "consent row must not keep a dead empty href");
assert.doesNotMatch(consentRowSrc, /go = \(\) => \{\}/, "consent row must not keep a no-op click");
assert.match(consentRowSrc, /ConsentFileLink/, "consent row downloads the source file");
assert.doesNotMatch(consentRowSrc, /\/app\/signing/, "consent row must not send the worker to the signing pad");
assert.match(workspaceSrc, /مسحوب/, "withdrawn label remains for archive-facing copy");
assert.match(workspaceSrc, /liveInboxRows/, "ملفي and إدارة list only live rows");
assert.match(workspaceSrc, /رأيت الاعتماد/, "worker acks approval then the card archives");
assert.match(workspaceSrc, /isUnseenApprovedLeave/, "unseen approved leave glows green on ملفي");
assert.doesNotMatch(workspaceSrc, /الاعتماد يعيد الأسبوع مسودة/, "approval must not claim it rewrites the published week as a draft");
assert.doesNotMatch(workspaceSrc, /Approval returns the week to draft/, "approval must not claim it auto-rewrites the roster");
assert.match(workspaceSrc, /إجازة على وردية منشورة — يحتاج بديلاً/, "clash copy keeps the published assignment and asks for a substitute");
assert.match(workspaceSrc, /submitLeaveRequest/, "leave raise stays in RequestsWorkspace");
assert.match(workspaceSrc, /requestedBy:\s*currentUser\?\.name/, "raiser name is stamped on leave raise");
assert.match(workspaceSrc, /requestedById:\s*currentUser\?\.id/, "raiser id is stamped on leave raise");
assert.match(workspaceSrc, /isManageRaiseKind\(kind\)/, "manage send path rejects non-manager kinds");
assert.match(workspaceSrc, /LEAVE_EMPLOYEE_ONLY|checkLeaveSelfRaiseGate|employeeId: subject\.id/, "leave submit carries subject id for self-raise gate");
assert.match(storeSrc, /requestedById/, "store persists who raised leave on whose file");
assert.match(storeSrc, /raiserName/, "leave raise audit uses the raiser, not only recordedBy");
assert.match(storeSrc, /actorId:\s*requestedById/, "store leave gate receives the actor id");
assert.match(workspaceSrc, /حكم المنصة على طلبك/, "request law slab is platform judgment, not ministry-as-operator");
assert.match(workspaceSrc, /a\.live \? "var\(--nv-ok-soft\)" : CARD/, "live law row wash follows --nv-ok-soft in dark mode");
assert.match(workspaceSrc, /color: "var\(--nv-ink2\)"/, "law article body uses --nv-ink2 so it flips with theme");
assert.doesNotMatch(workspaceSrc, /background: a\.live \? "#f7faf8"/, "live law row must not hard-code a light wash");
assert.doesNotMatch(workspaceSrc, /color: "#3c4657", lineHeight: 1\.95/, "law article body must not hard-code dark ink");
assert.doesNotMatch(workspaceSrc, /أنظمة الوزارة — ما يُطبَّق على طلبك/);
assert.match(workspaceSrc, /approvedLeaveWithdrawWindow/, "approved leave can be withdrawn only before it starts");
assert.match(workspaceSrc, /LEAVE_APPROVED_LOCKED|حق ثابت/, "approved leave stays locked against a unilateral cancel");
assert.match(workspaceSrc, /leaveNeedsArticle118Ack/, "workspace leave raise keeps Article 118");
assert.match(workspaceSrc, /leave_topup/, "workspace can raise a leave-balance top-up");
assert.match(workspaceSrc, /leave_credit/, "إدارة composes admin leave credit");
assert.match(workspaceSrc, /creditEmployeeLeaveBalance/, "admin credit uses the store helper");
assert.match(workspaceSrc, /composeAdminLeaveCreditGates/, "admin credit uses named gates");
assert.match(workspaceSrc, /إضافة رصيد/, "manage chip names إضافة رصيد");
assert.match(workspaceSrc, /الموظف يطلب زيادة/, "one Balance card covers worker request and manager add");
assert.doesNotMatch(workspaceSrc, /أيام تُضاف للسنوي — ليست أخذ إجازة/, "duplicate raise-balance card is gone");
assert.match(workspaceSrc, /row\.id !== "leave_topup"/, "top-up is never a kind chip — Balance card on ملفي only");
assert.doesNotMatch(workspaceSrc, /row\.id !== "leave_topup" \|\| mode === "manage"/, "top-up is not re-opened as a manage chip");
assert.match(storeSrc, /creditEmployeeLeaveBalance/, "store exports admin leave credit");
assert.match(storeSrc, /leave_balance_credit|discretionary_leave_grant/, "admin credit writes an audit event");
assert.match(workspaceSrc, /لك حرية إرفاق ملف/, "every leave type offers optional unsigned attach");
assert.match(workspaceSrc, /طلب زيادة الرصيد|زيادة رصيد الموظف/, "workspace names the single balance slot");
assert.match(workspaceSrc, /PlatformDateField/, "طلباتي date fields are not a bare US-locale input");
assert.match(workspaceSrc, /CONSENT_MINISTRY_HINT_AR/, "night consent on طلباتي uses the shared ministry hint");
assert.match(workspaceSrc, /أوافق/, "night agree is the worker's choice on طلباتي");
assert.match(workspaceSrc, /أرفض/, "night refuse is the worker's choice on طلباتي");
assert.match(workspaceSrc, /اسحب الموافقة/, "after agree the worker may withdraw under 18632");
assert.match(workspaceSrc, /withdrawNightRotate/, "withdraw is a named store action");
assert.match(workspaceSrc, /ownNightAct/, "agree/refuse/withdraw stay on ملفي only");
assert.match(workspaceSrc, /remindNightDue/, "إدارة may only remind");
assert.match(workspaceSrc, /ذكّر الموظف/, "إدارة reminder is a ping, not a decision");
assert.match(workspaceSrc, /actorId: currentUser.id/, "night actions bind the signed-in worker");
const raiseSrc = readFileSync(new URL("../src/components/requests/WrittenConsentRaise.jsx", import.meta.url), "utf8");
assert.match(raiseSrc, /row.id !== "night"/, "إدارة cannot raise 18632");
assert.doesNotMatch(raiseSrc, /useState\("night"\)/, "raise default is not night");
assert.match(workspaceSrc, /RequestSelfSignBlock/, "signable requests attach then raise a hand-signed copy in My Requests");
assert.match(workspaceSrc, /!isSignableKind && \(/, "optional unsigned attach is hidden on letter and custody raise");
assert.doesNotMatch(signBlockSrc, /1 — أرفق الملف|ملف ثم توقيع في قسم التوقيع ثم رفع/, "self-sign block does not restack the ministry path as heading plus numbered step");
assert.match(signBlockSrc, /showSourceInput/, "only one native file control is visible at a time");
assert.match(workspaceSrc, /ارفع النسخة الموقّعة يدوياً/, "raise happens in My Requests after the hand-signed copy is uploaded");
const decisionSrc = readFileSync(new URL("../src/components/requests/RequestDecisionComposer.jsx", import.meta.url), "utf8");
assert.match(workspaceSrc, /RequestDecisionComposer/, "إدارة decision cell is the calm composer");
assert.match(decisionSrc, /يُحفظ في سجل التدقيق/, "refuse writes a named reason on the audit trail");
assert.match(decisionSrc, /<textarea/, "refusal reason is a textarea, required only to refuse or return");
assert.match(decisionSrc, /أرفق النسخة المختومة/, "issued copy uses an Arabic attachment control");
assert.match(decisionSrc, /nv-req-file-native/, "the native file input stays off-screen");
assert.doesNotMatch(decisionSrc, /Choose File/, "the decision cell does not show the English file chrome");
assert.match(decisionSrc, /اعتمد وأصدر الملف/, "primary outcome issues the file");
assert.match(decisionSrc, /أعده للتعديل/, "secondary outcome returns the request");
assert.match(workspaceSrc, /issuedFile/, "decide counts a manager-issued file on letter approve");
assert.match(workspaceSrc, /isLetterSignableType/, "letter approve still offers the stamped copy");
assert.match(workspaceSrc, /status === "revise" && !noteVal\.trim/, "return-for-change still needs the note");
assert.match(storeSrc, /checkRefuseRequestReasonGate/, "leave and other refuse require a named reason");
assert.match(storeSrc, /stampRefuseAudit/, "refuse stamps AuditLog on the decide path");
assert.match(storeSrc, /pushEmployeeFileLog/, "refuse writes the employee-file trail");
assert.match(workspaceSrc, /checkRefuseRequestReasonGate/, "إدارة refuse waits on the named reason");
assert.match(workspaceSrc, /STUDY_CONSENT_IRREVOCABLE_AR/, "approved study consent shows the irrevocable gate");
assert.match(workspaceSrc, /composeStudyConsentRaiseGates/, "study-consent raise uses the named consent checklist");
assert.match(workspaceSrc, /uniqueNamedGates/, "raise blockers collapse by gate id + message");
assert.match(workspaceSrc, /اطلب موافقة دراسية للمسار المدفوع/, "exam leave offers the paid-track consent request");
assert.match(workspaceSrc, /ارفع ملف الموافقة/, "manager approve requires the consent letter");
assert.doesNotMatch(workspaceSrc, /إكمال الدراسة \/ الدراسة على رأس العمل/, "the long slash label is gone from the pill");
assert.match(workspaceSrc, /LaborArticleCite article="115"/, "study-consent form keeps Article 115 readable");
assert.match(workspaceSrc, /examNoticeIssuedAt/, "exam leave records a late notice paper date");
assert.match(workspaceSrc, /تاريخ صدور ورقة المواعيد/, "late notice date stays on the exam form as employee notice");
assert.doesNotMatch(workspaceSrc, /تاريخ صدور جدول الجهة/, "institution timetable date is gone from the exam form");
assert.doesNotMatch(workspaceSrc, /لم توافق الجهة التعليمية/, "exam form has no institution non-approval");
assert.doesNotMatch(workspaceSrc, /examInstitutionRefused/, "exam raise does not record institution non-approval");
assert.doesNotMatch(workspaceSrc, /checkExamInstitutionAgreementGate/, "institution-agreement gate is gone");
assert.doesNotMatch(workspaceSrc, /جهة تعليمية/, "exam form does not model an educational-institution counterparty");
assert.match(workspaceSrc, /checkRejectLeaveGate/, "exam decide uses the employer-cannot-refuse gate");
assert.match(workspaceSrc, /checkExamSittingSettleGate/, "sitting proof stay-settled gate is on the exam card");
assert.match(workspaceSrc, /ورقة ثانية/, "sitting proof is a second paper under 115");
assert.doesNotMatch(storeSrc, /examInstitutionRefused/, "store does not persist institution refusal");
assert.match(storeSrc, /examNoticeIssuedAt/, "store persists a late notice paper date");
assert.doesNotMatch(leaveItemSrc, /onDecide|setLeaveRequestStatus|اعتمد|ارفض/, "employee-file leave card must not decide");
assert.match(leaveItemSrc, /requestReplyCopy/, "employee-file leave card points the reply to طلباتي");
assert.doesNotMatch(attendanceSrc, /setLeaveRequestStatus|approveLeave|rejectLeave/, "attendance must not stamp leave");
assert.doesNotMatch(attendanceSrc, /اعتمد|ارفض/, "attendance leave board must not offer approve/reject");
assert.match(attendanceSrc, /requestReplyCopy/, "attendance leave board points the reply to طلباتي");
assert.doesNotMatch(dailyDashSrc, /approveLeave|setLeaveRequestStatus|setOtherRequestStatus/, "attendance decision queue must not stamp leave or study_consent");
assert.match(dailyDashSrc, /requestReplyCopy/, "attendance decision queue points leave/study_consent to طلباتي");
assert.doesNotMatch(otherBoardSrc, /setOtherRequestStatus/, "stray other-request board must not stamp");
assert.match(otherBoardSrc, /requestReplyCopy/, "stray other-request board points the reply to طلباتي");
assert.match(storeSrc, /checkRejectLeaveGate/, "store blocks employer refuse of a qualifying exam leave");
assert.match(workspaceSrc, /attachExamSatProof/, "sitting proof is attached on the existing exam card");
assert.match(workspaceSrc, /إثبات أداء الامتحان/, "the second paper is named sitting proof");
assert.match(storeSrc, /attachExamSatProof/, "store persists sitting proof on the leave request");
assert.match(workspaceSrc, /isNightFitness && mode !== "manage"/, "إدارة does not compose the fitness upload");
assert.match(workspaceSrc, /NIGHT_FITNESS_RANGE_AR/, "night fitness offers فترة");
assert.match(workspaceSrc, /NIGHT_FITNESS_PERMANENT_AR/, "night fitness offers دائم");
assert.match(workspaceSrc, /NIGHT_FITNESS_FROM_AR/, "night fitness period starts with تاريخ من");
assert.match(workspaceSrc, /NIGHT_FITNESS_TO_AR/, "night fitness period ends with تاريخ إلى");
assert.doesNotMatch(workspaceSrc, /تاريخ الفحص — اختياري/, "single optional exam date is gone");
assert.match(workspaceSrc, /composeRequestKinds/, "ملفي and إدارة compose chips are lane-split");
assert.match(storeSrc, /issuedFile/, "store persists a manager-issued file on approve");
assert.match(storeSrc, /صدرت وثيقتك/, "store notifies the employee when a letter is issued");
assert.doesNotMatch(workspaceSrc, /\/app\/signing/, "My Requests must not link to Digital signing");
assert.doesNotMatch(workspaceSrc, /Secure Sign/, "My Requests must not route through the signing desk");
assert.match(workspaceSrc, /submitOtAssignment/, "workspace raises overtime assignments");
assert.match(workspaceSrc, /المادة 106/, "workspace cites Article 106");
assert.match(workspaceSrc, /MANAGER_106_ACK|أقرّ بأن واقعة استثنائية/, "workspace keeps the manager 106 acknowledgement");
assert.match(workspaceSrc, /أقرّ باختياري لتعويض/, "workspace has one employee compensation ack");
assert.doesNotMatch(workspaceSrc, /attested:\s*true/, "106 file is not a fake attested flag");
assert.match(workspaceSrc, /لا يُطلب توقيع رقمي لهذا المرفق/, "sick/exam supporting paper stays unsigned");
assert.match(workspaceSrc, /بلا توقيع/, "leave_topup and 106 stay optional-attach without signature");
assert.doesNotMatch(leaveTabSrc, /submitLeaveRequest/, "employee file must not raise leave");
assert.doesNotMatch(leaveTabSrc, /leave_topup|setTopupDays|طلب رفع رصيد/, "employee file must not raise a balance top-up");
assert.doesNotMatch(leaveTabSrc, /VoiceRecorder/, "leave raise must not mix voice composer");
assert.match(leaveTabSrc, /\/app\/requests\/leave/, "file points raise to طلباتي");
assert.match(leaveTabSrc, /leaveOnFile/, "file tab lists filed leave only");
assert.match(leaveTabSrc, /pendingLeavePointerCopy|طلب بانتظار القرار/, "file tab pending is one pointer line");
assert.doesNotMatch(leaveTabSrc, /setLeaveRequestStatus|onDecide|approveLeave/, "file tab must not decide leave");
assert.match(fileBoardSrc, /طلب بانتظار القرار — الرد في طلباتي/, "file board pending is the one-line pointer");
assert.match(fileBoardSrc, /لا توجد طلبات إجازة بعد/, "file empty copy is no filed leave");
assert.doesNotMatch(attendanceSrc, /submitLeaveRequest/, "attendance must not raise leave");
assert.match(attendanceSrc, /\/app\/requests\/leave/, "attendance points raise to طلباتي");
assert.match(fileBoardSrc, /\/app\/requests\/leave/, "file board points raise to طلباتي");
assert.doesNotMatch(assistantSrc, /submitLeaveRequest/, "assistant must not raise leave");
assert.doesNotMatch(assistantSrc, /setLeaveRequestStatus/, "assistant must not stamp leave");
assert.match(assistantSrc, /\/app\/requests\/leave/, "assistant opens طلباتي leave lane");
assert.match(assistantSrc, /requestReplyHref/, "assistant opens طلباتي for the leave reply");

assert.equal(stationDisplayName("الخفجي", true), "فرع الخفجي");
assert.equal(stationDisplayName("فرع الخفجي", true), "فرع الخفجي");
assert.equal(requestRegardingLine({ name: "نورة القحطاني", stationName: "الخفجي", lang: "ar" }), "بشأن: نورة القحطاني · فرع الخفجي");
assert.match(managerRequestNoticeText({
  kindLabel: "إجازة سنوية",
  employeeName: "نورة القحطاني",
  stationName: "الخفجي",
  lang: "ar",
}), /طلب إجازة سنوية بشأن: نورة القحطاني · فرع الخفجي بانتظار مراجعتك/);

const noraKhafji = {
  id: "nora",
  name: "نورة القحطاني",
  stationId: "khf",
  profile: { hireDate: "2024-01-15" },
  leaveRequests: [{ id: "lv-n", type: "annual", status: "pending", createdAt: "2026-09-18" }],
  otherRequests: [],
};
const fahdRabigh = {
  id: "fahd",
  name: "فهد العتيبي",
  stationId: "rbg",
  profile: { hireDate: "2024-01-15" },
  leaveRequests: [{ id: "lv-f", type: "sick", status: "pending", createdAt: "2026-09-18" }],
  otherRequests: [
    { id: "nf-f", type: NIGHT_FITNESS_TYPE, status: "pending", from: "2026-09-01", to: "2027-08-31" },
    { id: "adv-f", type: "advance", status: "pending" },
  ],
};
const twoStationMgr = {
  id: "mgr2",
  name: "مدير الفروع",
  role: "station_manager",
  stationId: "khf",
  managedStations: ["rbg"],
  leaveRequests: [],
  otherRequests: [],
};
const otherCompanyWorker = {
  id: "x-co",
  name: "من شركة أخرى",
  stationId: "khf",
  companyId: "other",
  leaveRequests: [{ id: "lv-x", type: "annual", status: "pending" }],
  otherRequests: [],
};
const twoStations = [
  { id: "khf", name: "الخفجي", managerId: "mgr2" },
  { id: "rbg", name: "رابغ", managerId: "mgr2" },
];
const twoStationData = {
  ownerId: "owner-x",
  stations: twoStations,
  employees: [twoStationMgr, noraKhafji, fahdRabigh],
  orgSeats: [{ id: "seat-khf", employeeId: "mgr2", stationId: "khf", title: "مدير الفرع" }],
};
const bothPending = managerPendingInbox([noraKhafji, fahdRabigh], "ar", { stations: twoStations });
assert.equal(bothPending.count, 4, "manager with two stations sees every pending");
assert.ok(bothPending.rows.some((row) => row.employee?.id === "nora"));
assert.ok(bothPending.rows.some((row) => row.employee?.id === "fahd"));
assert.ok(bothPending.named.some((row) => row.id === NIGHT_FITNESS_TYPE), "night fitness is employee-originated in إدارة");
assert.ok(bothPending.rows.some((row) => row.type === NIGHT_FITNESS_TYPE));
assert.equal(bothPending.groups.length, 2);
assert.ok(bothPending.rows.every((row) => /بشأن:/.test(row.regardingLine)));
assert.match(bothPending.rows.find((row) => row.employee?.id === "nora").regardingLine, /نورة القحطاني · فرع الخفجي/);

const parkedOnKhafji = otherStationsPendingStrip({
  employees: [noraKhafji, fahdRabigh],
  stations: twoStations,
  focusStationId: "khf",
  lang: "ar",
});
assert.equal(parkedOnKhafji.visible, true, "header parked on A still names B");
assert.equal(parkedOnKhafji.title, "فروع أخرى");
assert.match(parkedOnKhafji.headline, /فرع واحد · 3 طلبات بانتظارك/);
assert.equal(parkedOnKhafji.stations.length, 1);
assert.equal(parkedOnKhafji.stations[0].stationId, "rbg");
assert.equal(parkedOnKhafji.stations[0].count, 3);
assert.equal(parkedOnKhafji.totalPending, 4, "strip does not hide A's pending from the inbox total");

const parkedOnAll = otherStationsPendingStrip({
  employees: [noraKhafji, fahdRabigh],
  stations: twoStations,
  focusStationId: "all",
  lang: "ar",
});
assert.equal(parkedOnAll.visible, false);

const registerTwo = managerEmployeeRegister([noraKhafji, fahdRabigh], "ar", {
  stations: twoStations,
  focusStationId: "khf",
});
assert.equal(registerTwo.groups.length, 2);
assert.equal(registerTwo.strip.visible, true);
assert.equal(registerTwo.strip.stations[0].stationId, "rbg");
assert.match(registerTwo.rows.find((row) => row.id === "nora").regardingLine, /بشأن: نورة القحطاني · فرع الخفجي/);
assert.equal(registerTwo.groups[0].stationId, "khf", "focused branch sits first");
assert.match(registerTwo.rail.standing, /واقف على/);
assert.match(registerTwo.rail.others, /فروع أخرى/);
assert.match(registerTwo.rail.note, /من له طلب فقط/);
assert.ok(registerTwo.groups.every((group) => group.rows.every((row) => row.pendingCount > 0)));
assert.match(registerTwo.groups[0].alert, /معلّق/);
assert.equal(registerTwo.rail.focusStationId, "khf");

assert.ok(requestInboxEmployees(twoStationMgr, twoStationData).some((row) => row.id === "nora"));
assert.ok(requestInboxEmployees(twoStationMgr, twoStationData).some((row) => row.id === "fahd"));
assert.ok(!requestInboxEmployees(twoStationMgr, twoStationData).some((row) => row.id === "x-co"), "another company is not on this company roster");
assert.equal(
  liveInboxRows([noraKhafji, fahdRabigh], "ar", { lane: "mine" }).filter((row) => isOwnMineLaneRow(row, "nora")).every((row) => row.employee?.id === "nora"),
  true,
);
assert.equal(
  liveInboxRows([noraKhafji], "ar", { lane: "mine" }).some((row) => row.employee?.id === "fahd"),
  false,
  "employee cannot see others",
);
assert.ok(requestNoticeAudience(twoStationData, noraKhafji).some((row) => row.id === "mgr2"));
assert.ok(requestNoticeAudience(twoStationData, fahdRabigh).some((row) => row.id === "mgr2"));
assert.ok(!requestNoticeAudience(twoStationData, noraKhafji).some((row) => row.id === "fahd"));

const headerScopedPeople = [twoStationMgr, noraKhafji];
assert.equal(
  pendingRequestsBadgeCount(twoStationMgr, twoStationData, headerScopedPeople),
  pendingRequestsBadgeCount(twoStationMgr, twoStationData, twoStationData.employees),
  "طلباتي badge sums every managed station, not the header workplace",
);
assert.ok(pendingRequestsBadgeCount(twoStationMgr, twoStationData, headerScopedPeople) >= 4);
assert.equal(pendingRequestsBadgeCount(noraKhafji, { ...twoStationData, employees: [noraKhafji] }, [noraKhafji]), 1, "employee badge is own pending only");

assert.doesNotMatch(requestsPageSrc, /headerAdmin = adminBase\.filter/, "إدارة must not silently filter the inbox to the header station");
assert.match(requestsPageSrc, /focusStationId/, "header station focuses the register group");
assert.match(requestsPageSrc, /requestInboxEmployees/, "إدارة roster is decide-scope");
assert.match(requestsPageSrc, /requestInboxMaySee/, "إدارة inbox uses requestInboxMaySee");
assert.match(workspaceSrc, /requestMayDecideOnLane/, "اعتمد/ارفض follow the lane helper");
assert.doesNotMatch(workspaceSrc, /\(canDecide && !ownPending\) \|\| headOwnDecide/, "ملفي no longer ORs manage-decide onto the worker's own card");
assert.doesNotMatch(requestsPageSrc, /headSelfDecidesFromMine/, "ملفي never offers self-decide");
assert.match(requestsPageSrc, /الاعتماد والرفض في إدارة/, "ملفي copy sends the reply to إدارة");
assert.match(src("src/lib/requestWorkspace.js"), /فروع أخرى/, "register keeps the other-branches standing line");
assert.match(src("src/lib/requestWorkspace.js"), /واقف على/, "rail names standing from header scope");
assert.doesNotMatch(src("src/lib/requestWorkspace.js"), /اختر الفرع هنا ثم اعتمد/, "register does not ask to pick a branch");
assert.match(src("src/components/requests/ManagerEmployeeRegister.jsx"), /onFocusStation/, "branch heading sets النطاق");
assert.doesNotMatch(src("src/components/requests/ManagerEmployeeRegister.jsx"), /كل الفروع/, "كل الفروع is not a register control");
assert.match(src("src/components/requests/ManagerEmployeeRegister.jsx"), /row\.name/, "people rows are the name under the branch heading");
assert.match(src("src/components/requests/ManagerEmployeeRegister.jsx"), /data-branch-alert/, "branch heading is the alert");
assert.match(src("src/components/requests/ManagerEmployeeRegister.jsx"), /بانتظار القرار/);
assert.doesNotMatch(src("src/lib/requestWorkspace.js"), /السجل كل من تديرهم/);
assert.match(workspaceSrc, /requestRegardingLine/, "decision cards name بشأن");
assert.match(storeSrc, /بشأن:/, "in-app notice title includes the branch");
assert.match(storeSrc, /notifyRequestManagers/, "existing addNotification path carries the branch");
assert.match(storeSrc, /requestNoticeAudience/, "notices go to managers who cover the workplace");

const apex = { id: "owner-x", name: "رأس المنشأة", role: "director", stationId: null, leaveRequests: [{ id: "lv-apex", type: "annual", status: "pending" }] };
const hrCompany = { id: "hr-co", name: "موارد الشركة", hrLevelId: "hr-all", role: "employee" };
const apexData = {
  ownerId: "owner-x",
  stations: [{ id: "root", name: "الرئيسي", managerId: "owner-x" }],
  hrLevels: [{ id: "hr-all", active: true, scope: "company", permissions: ["manage_leave"] }],
  employees: [apex, hrCompany],
};
assert.equal(isCompanyHeadPerson(apex, apexData), true);
assert.equal(checkSelfDecideRequestGate({ actorId: "owner-x", subjectId: "owner-x", status: "approved", ownerId: "owner-x" }).ok, true, "رأس الشركة decides their own file");
const seatedHead = { id: "dir-1", name: "سالم", role: "director" };
const seatedHeadData = {
  stations: [{ id: "root", name: "الرئيسي", isCompanyRoot: true, managerId: "dir-1" }],
  hrLevels: apexData.hrLevels,
  employees: [seatedHead, hrCompany],
};
assert.equal(isCompanyHeadPerson(seatedHead, seatedHeadData), true, "a director on the company root is رأس الشركة when no owner sits above");
assert.equal(checkSelfDecideRequestGate({ actorId: "dir-1", subjectId: "dir-1", status: "approved", actor: seatedHead, data: seatedHeadData }).ok, true);
assert.equal(requestNoticeAudience(seatedHeadData, seatedHead).length, 0, "the head who is also مدير طلباتي on رأس المنشأة has no other notice audience");
assert.ok(!requestInboxEmployees(hrCompany, seatedHeadData).some((row) => row.id === "dir-1"), "HR does not take رأس الشركة");
assert.equal(isCompanyHeadPerson(twoStationMgr, twoStationData), false, "a station manager is not رأس الشركة");
assert.equal(checkSelfDecideRequestGate({ actorId: "hr-co", subjectId: "owner-x", status: "approved" }).ok, true);
assert.equal(checkSelfDecideRequestGate({ actorId: "owner-x", subjectId: "owner-x", status: "withdrawn", ownerId: "owner-x" }).ok, true);
assert.equal(checkSelfDecideRequestGate({ actorId: "nora", subjectId: "nora", status: "approved" }).error, "SELF_DECIDE_FORBIDDEN");
assert.equal(requestNoticeAudience(apexData, apex).length, 0, "no separate branch manager — the head decides from إدارة");
assert.ok(requestInboxEmployees(apex, apexData).some((row) => row.id === "owner-x"), "sole head sees own pending on إدارة");
assert.ok(!requestInboxEmployees(hrCompany, apexData).some((row) => row.id === "owner-x"), "HR does not take the owner's file");
const headOnKhafji = { ...apex, stationId: "khf", leaveRequests: [{ id: "lv-head", type: "annual", status: "pending" }] };
const twoCase = { ...twoStationData, employees: [headOnKhafji, twoStationMgr, noraKhafji] };
assert.ok(requestNoticeAudience(twoCase, headOnKhafji).some((row) => row.id === "mgr2"), "حالة 1: مدير طلباتي على الفرع يقرر طلب رأس الشركة");
assert.equal(checkSelfDecideRequestGate({ actorId: "owner-x", subjectId: "owner-x", status: "approved", actor: headOnKhafji, data: twoCase }).ok, true, "حالة 2: رأس الشركة يجوز أن يعتمد طلبه — الرد يبقى في إدارة");
assert.ok(requestInboxEmployees(twoStationMgr, twoCase).some((row) => row.id === "owner-x"), "branch إدارة opens رأس الشركة on that workplace");
assert.ok(!requestInboxEmployees(hrCompany, twoCase).some((row) => row.id === "owner-x"), "HR is not مدير طلباتي on the branch");
const niyarOnBranch = { id: "niyar-d", name: "نيار عبدالله", role: "director", stationId: "khf", leaveRequests: [{ id: "lv-n", type: "annual", status: "pending" }] };
const ownerSeat = { id: "owner-x", name: "المالك", role: "owner", stationId: null };
const branchDecide = { ownerId: "owner-x", stations: twoStations, employees: [ownerSeat, niyarOnBranch, twoStationMgr] };
assert.ok(requestNoticeAudience(branchDecide, niyarOnBranch).some((row) => row.id === "mgr2"), "مدير طلباتي على الفرع decides a director on that branch");
assert.ok(!requestNoticeAudience(branchDecide, niyarOnBranch).some((row) => row.id === "owner-x"), "the owner is not the branch request manager");
assert.ok(requestInboxEmployees(twoStationMgr, branchDecide).some((row) => row.id === "niyar-d"), "branch إدارة opens the director on that workplace");
const rootHq = { id: "hq", name: "رأس المنشأة", isCompanyRoot: true, managerId: "niyar-d" };
const niyarOnRoot = { ...niyarOnBranch, stationId: "hq" };
const ownerManages = { ownerId: "owner-x", stations: [rootHq, ...twoStations], employees: [ownerSeat, niyarOnRoot, twoStationMgr] };
assert.ok(requestNoticeAudience(ownerManages, niyarOnRoot).some((row) => row.id === "owner-x"), "رأس الشركة decides the manager seated on رأس المنشأة");
assert.ok(!requestNoticeAudience(ownerManages, niyarOnRoot).some((row) => row.id === "mgr2"), "a child-branch manager does not take رأس المنشأة");
assert.ok(requestInboxEmployees(ownerSeat, ownerManages).some((row) => row.id === "niyar-d"), "owner إدارة opens the root manager");
assert.ok(!requestInboxEmployees(twoStationMgr, ownerManages).some((row) => row.id === "niyar-d"), "فرع الخفجي does not take the apex manager");

const noraStudy = {
  ...noraKhafji,
  otherRequests: [{ id: "sc-n", type: STUDY_CONSENT_TYPE, status: "pending", program: "هندسة الطاقة المتجددة" }],
};
const studyData = { ...twoStationData, employees: [twoStationMgr, noraStudy, fahdRabigh] };
assert.equal(requestMayDecideOnLane({ actor: noraStudy, subject: noraStudy, lane: "mine", data: studyData }), false, "non-head on ملفي has no decide");
assert.equal(requestMayDecideOnLane({ actor: twoStationMgr, subject: noraStudy, lane: "manage", data: studyData }), true, "manager on إدارة has decide");
assert.equal(requestMayDecideOnLane({ actor: twoStationMgr, subject: twoStationMgr, lane: "mine", data: twoStationData }), false, "branch manager does not self-decide on ملفي");
assert.equal(requestMayDecideOnLane({ actor: twoStationMgr, subject: noraStudy, lane: "mine", data: studyData }), false, "manager does not decide others from ملفي");
assert.equal(headSelfDecidesFromMine(apex, apexData), false, "ملفي never carries اعتمد/ارفض");
assert.equal(requestMayDecideOnLane({ actor: apex, subject: apex, lane: "mine", data: apexData }), false, "sole head has no decide on ملفي");
assert.equal(requestMayDecideOnLane({ actor: apex, subject: apex, lane: "manage", data: apexData }), true, "sole head decides own file from إدارة");
assert.equal(requestMayDecideOnLane({ actor: seatedHead, subject: seatedHead, lane: "mine", data: seatedHeadData }), false, "head who is also مدير طلباتي still has no ملفي decide");
assert.equal(requestMayDecideOnLane({ actor: seatedHead, subject: seatedHead, lane: "manage", data: seatedHeadData }), true, "head who is also مدير طلباتي decides from إدارة");
assert.equal(headSelfDecidesFromMine(headOnKhafji, twoCase), false, "head with a branch manager does not self-decide on ملفي");
assert.equal(requestMayDecideOnLane({ actor: headOnKhafji, subject: headOnKhafji, lane: "mine", data: twoCase }), false, "screenshot bug: study/leave reply is not on ملفي when إدارة has a manager");
assert.equal(requestMayDecideOnLane({ actor: twoStationMgr, subject: headOnKhafji, lane: "manage", data: twoCase }), true, "branch إدارة decides the head's file on that workplace");
assert.equal(requestMayDecideOnLane({ actor: niyarOnBranch, subject: niyarOnBranch, lane: "mine", data: branchDecide }), false, "director on the branch has no ملفي decide");
assert.equal(requestMayDecideOnLane({ actor: twoStationMgr, subject: niyarOnBranch, lane: "manage", data: branchDecide }), true);
assert.equal(requestMayDecideOnLane({ actor: twoStationMgr, subject: niyarOnRoot, lane: "manage", data: ownerManages }), false, "station managers must not decide the apex file");
assert.equal(requestMayDecideOnLane({ actor: ownerSeat, subject: niyarOnRoot, lane: "manage", data: ownerManages }), true, "رأس الشركة decides the root manager from إدارة");

function afterRaisePerson(person, request) {
  const leave = request.family === "leave" || LEAVE_TYPES.some((row) => row.key === request.type);
  return {
    ...person,
    leaveRequests: leave ? [request, ...(person.leaveRequests || [])] : (person.leaveRequests || []),
    otherRequests: leave ? (person.otherRequests || []) : [request, ...(person.otherRequests || [])],
  };
}

const niyarHead = {
  id: "emp_owner_preview",
  employeeId: "emp_owner_preview",
  name: "نيار عبدالله",
  role: "director",
  stationId: "khf",
  leaveRequests: [],
  otherRequests: [],
};
const afterStudyRaise = afterRaisePerson(niyarHead, {
  id: "sc-raised",
  type: STUDY_CONSENT_TYPE,
  status: "pending",
  program: "هندسة الطاقة المتجددة",
  requestedById: "emp_owner_preview",
});
const afterLeaveRaise = afterRaisePerson(niyarHead, {
  id: "lv-raised",
  type: "annual",
  family: "leave",
  status: "pending",
  startDate: "2026-09-21",
  endDate: "2026-09-22",
});
const afterTopupRaise = afterRaisePerson(niyarHead, {
  id: "tu-raised",
  type: LEAVE_TOPUP_TYPE,
  status: "pending",
  days: 2,
  requestedById: "emp_owner_preview",
  employeeId: "emp_owner_preview",
});
assert.ok(mineInboxRows([afterStudyRaise], "emp_owner_preview").some((row) => row.id === "sc-raised"), "after raise, own pending study consent appears on ملفي for the company head");
assert.ok(mineInboxRows([afterLeaveRaise], "emp_owner_preview").some((row) => row.id === "lv-raised"), "after raise, own pending leave appears on ملفي for the company head");
assert.ok(mineInboxRows([afterTopupRaise], "emp_owner_preview").some((row) => row.id === "tu-raised"), "after raise, own pending leave top-up appears on ملفي for the company head");
assert.equal(mineInboxRows([afterStudyRaise], "").length, 0, "empty viewer does not guess ownership or dump ملفي");
assert.ok(
  mineInboxRows([afterStudyRaise], { id: "session-user", employeeId: "emp_owner_preview" }).some((row) => row.id === "sc-raised"),
  "after raise, own pending appears on ملفي when session id ≠ employee.id",
);
assert.ok(mineInboxRows([afterStudyRaise], "emp_owner_preview").every((row) => isOwnMineLaneRow(row, "emp_owner_preview")));
assert.equal(mineInboxRows([afterStudyRaise], "boss").some((row) => row.id === "sc-raised"), false, "another viewer does not list the raiser's ملفي row");
const sessionViewer = { id: "user_niyar", employeeId: "emp_owner_preview" };
assert.ok(
  mineInboxRows([afterStudyRaise], sessionViewer).some((row) => row.id === "sc-raised"),
  "after raise, ملفي still lists own pending when session id ≠ employee.id",
);
assert.ok(isOwnMineLaneRow(flattenWorkspaceRows([afterLeaveRaise])[0], sessionViewer), "ملفي identity uses employeeId, not only currentUser.id");
assert.ok(
  collectRequestInbox([afterStudyRaise], [], "user_niyar", "ar", { ownOnly: true, viewer: sessionViewer }).some((row) => /طلبك بانتظار القرار/.test(row.head)),
  "إشعاراتي keeps the raiser's own pending when session id ≠ employee.id",
);
const niyarHeadData = {
  ownerId: "emp_owner_preview",
  stations: twoStations,
  employees: [niyarHead, twoStationMgr, noraKhafji],
};
const niyarRaised = {
  ...afterLeaveRaise,
  otherRequests: [
    ...(afterStudyRaise.otherRequests || []),
    ...(afterTopupRaise.otherRequests || []),
  ],
};
const niyarRaisedData = { ...niyarHeadData, employees: [niyarRaised, twoStationMgr, noraKhafji] };
assert.ok(mineInboxRows([niyarRaised], "emp_owner_preview").some((row) => row.id === "lv-raised"), "Niyar/head raise leave stays on ملفي");
assert.ok(mineInboxRows([niyarRaised], "emp_owner_preview").some((row) => row.id === "sc-raised"), "Niyar/head raise study consent stays on ملفي");
assert.ok(mineInboxRows([niyarRaised], "emp_owner_preview").some((row) => row.id === "tu-raised"), "Niyar/head raise top-up stays on ملفي");
assert.equal(requestMayDecideOnLane({ actor: niyarHead, subject: niyarRaised, lane: "mine", data: niyarRaisedData }), false, "Niyar has no اعتمد/ارفض on ملفي");
assert.ok(requestInboxEmployees(niyarHead, niyarRaisedData).some((row) => row.id === "emp_owner_preview"), "head sees own pending on إدارة");
assert.equal(requestMayDecideOnLane({ actor: niyarHead, subject: niyarRaised, lane: "manage", data: niyarRaisedData }), true, "highest authority replies to own file from إدارة");
assert.ok(requestInboxEmployees(twoStationMgr, niyarRaisedData).some((row) => row.id === "emp_owner_preview"), "Niyar's leave appears in branch إدارة");
assert.ok(managerPendingInbox([niyarRaised], "ar").rows.some((row) => row.id === "lv-raised"), "manager إدارة lists Niyar's pending leave");
assert.ok(managerPendingInbox([niyarRaised], "ar").rows.some((row) => row.id === "sc-raised"), "manager إدارة lists Niyar's pending study consent");
assert.ok(managerPendingInbox([niyarRaised], "ar").rows.some((row) => row.id === "tu-raised"), "manager إدارة lists Niyar's pending leave top-up");
assert.equal(requestMayDecideOnLane({ actor: twoStationMgr, subject: niyarRaised, lane: "manage", data: niyarRaisedData }), true, "branch مدير طلباتي decides Niyar's file on إدارة");
assert.ok(requestInboxEmployees(twoStationMgr, niyarHeadData).some((row) => row.id === "nora"), "manager إدارة inbox still gets others' items");
assert.ok(managerPendingInbox([noraKhafji], "ar").rows.some((row) => row.employee?.id === "nora"), "manager إدارة inbox still lists others' pending");
assert.match(workspaceSrc, /mineInboxRows\(employees, currentUser \|\| self/, "ملفي passes the viewer object so employeeId matches");
assert.match(requestsPageSrc, /requestSelfEmployee/, "ملفي self is the roster file, not a strict id === currentUser.id");
assert.match(workspaceSrc, /mineInboxRows/, "ملفي lists through mineInboxRows so a missing viewer id cannot hide own pending");

const liveKhafji = { id: "st_north_preview", name: "فرع الخفجي", managerId: "emp_manager_preview" };
const liveRabigh = { id: "st_east_preview", name: "فرع رابغ" };
const liveNiyar = {
  id: "emp_owner_preview",
  employeeId: "emp_owner_preview",
  name: "نيار عبدالله",
  role: "director",
  stationId: "st_north_preview",
  managedStations: ["st_north_preview", "st_east_preview"],
  leaveRequests: [{ id: "lv-niyar-live", type: "annual", status: "pending", startDate: "2026-09-20", endDate: "2026-09-20", createdAt: "2026-09-20T10:00:00.000Z" }],
  otherRequests: [
    { id: "sc-niyar-live", type: STUDY_CONSENT_TYPE, status: "pending", program: "كهرباء", createdAt: "2026-09-20T09:00:00.000Z" },
    { id: "tu-niyar-live", type: LEAVE_TOPUP_TYPE, status: "pending", days: 2, createdAt: "2026-09-20T08:00:00.000Z" },
  ],
};
const liveAhmed = {
  id: "emp_manager_preview",
  employeeId: "emp_manager_preview",
  name: "أحمد السالم",
  role: "station_manager",
  stationId: "st_north_preview",
  managedStations: ["st_north_preview"],
  leaveRequests: [{ id: "lv-ahmed-live", type: "annual", status: "pending", createdAt: "2026-09-14T10:00:00.000Z" }],
  otherRequests: [{ id: "or-ahmed-live", type: "salary_letter", status: "pending", reason: "تقديم للبنك", createdAt: "2026-09-14T10:00:00.000Z" }],
};
const liveOmar = {
  id: "emp_field_preview",
  name: "عمر ناصر",
  role: "employee",
  stationId: "st_north_preview",
  leaveRequests: [],
  otherRequests: [],
};
const livePreviewData = {
  ownerId: "emp_owner_preview",
  stations: [liveKhafji, liveRabigh],
  employees: [liveNiyar, liveAhmed, liveOmar],
};
const liveRoster = [liveNiyar, liveAhmed, liveOmar];
assert.equal(requestSelfEmployee(liveNiyar, liveRoster)?.id, "emp_owner_preview");
assert.equal(isViewerOwnFile(liveAhmed, liveNiyar), false, "Niyar's viewer must not own أحمد's file");
assert.equal(requestSelfEmployee({ id: "user_niyar", employeeId: "emp_owner_preview" }, [liveAhmed, liveNiyar, liveOmar])?.id, "emp_owner_preview");
const ordinaryMine = mineInboxRows([noraKhafji, twoStationMgr], noraKhafji, "ar");
assert.ok(ordinaryMine.every((row) => row.employee?.id === "nora"), "ordinary ملفي is own rows only");
assert.equal(requestMayDecideOnLane({ actor: noraKhafji, subject: noraKhafji, lane: "mine", data: twoStationData }), false, "ordinary ملفي has اسحب only");
assert.equal(requestMayDecideOnLane({ actor: twoStationMgr, subject: noraKhafji, lane: "manage", data: twoStationData }), true, "ordinary replies live on إدارة");
const niyarMine = mineInboxRows(liveRoster, liveNiyar, "ar");
assert.ok(niyarMine.some((row) => row.id === "lv-niyar-live"), "Niyar ملفي keeps his pending leave");
assert.ok(niyarMine.some((row) => row.id === "sc-niyar-live"), "Niyar ملفي keeps his pending study consent");
assert.ok(niyarMine.some((row) => row.id === "tu-niyar-live"), "Niyar ملفي keeps his pending top-up");
assert.equal(niyarMine.some((row) => row.id === "lv-ahmed-live" || row.employee?.id === "emp_manager_preview"), false, "Niyar ملفي never lists أحمد's requests");
assert.equal(niyarMine.every((row) => row.employee?.id === "emp_owner_preview"), true, "Niyar ملفي is Niyar rows only");
assert.equal(mineInboxRows(liveRoster, "", "ar").length, 0, "empty viewer does not dump the company inbox onto ملفي");
assert.equal(mineInboxRows(liveRoster, null, "ar").length, 0, "missing viewer does not dump the company inbox onto ملفي");
assert.equal(isOwnMineLaneRow(flattenWorkspaceRows([liveAhmed])[0], liveNiyar), false, "أحمد's card is not a Niyar ملفي row");
assert.equal(isOwnMineLaneRow(flattenWorkspaceRows([liveNiyar])[0], liveAhmed), false, "Niyar's card is not an أحمد ملفي row");
assert.ok(requestInboxEmployees(liveAhmed, livePreviewData).some((row) => row.id === "emp_owner_preview"), "أحمد إدارة includes Niyar on فرع الخفجي");
assert.ok(requestInboxEmployees(liveAhmed, livePreviewData).some((row) => row.id === "emp_field_preview"), "أحمد إدارة still includes عمر");
const ahmedSession = { id: "user_ahmed", employeeId: "emp_manager_preview", role: "station_manager", stationId: "st_north_preview" };
assert.ok(requestInboxEmployees(ahmedSession, livePreviewData).some((row) => row.id === "emp_owner_preview"), "أحمد إدارة still includes Niyar when session id ≠ employee.id");
const ahmedDecideInbox = managerPendingInbox([liveNiyar], "ar");
assert.ok(ahmedDecideInbox.rows.some((row) => row.id === "lv-niyar-live"), "أحمد إدارة lists Niyar pending leave");
assert.ok(ahmedDecideInbox.rows.some((row) => row.id === "sc-niyar-live"), "أحمد إدارة lists Niyar pending study consent");
assert.ok(ahmedDecideInbox.rows.some((row) => row.id === "tu-niyar-live"), "أحمد إدارة lists Niyar pending top-up");
assert.equal(requestMayDecideOnLane({ actor: liveAhmed, subject: liveNiyar, lane: "manage", data: livePreviewData }), true, "أحمد decides Niyar's file from إدارة");
assert.equal(requestMayDecideOnLane({ actor: liveNiyar, subject: liveNiyar, lane: "mine", data: livePreviewData }), false, "Niyar has no اعتمد/ارفض on ملفي");
const niyarManage = requestInboxEmployees(liveNiyar, livePreviewData);
assert.ok(niyarManage.some((row) => row.id === "emp_owner_preview"), "head sees own pending on إدارة");
assert.ok(niyarManage.some((row) => row.id === "emp_manager_preview"), "Niyar إدارة lists أحمد separately from ملفي");
assert.ok(niyarManage.some((row) => row.id === "emp_field_preview"), "Niyar إدارة lists عمر separately from ملفي");
assert.equal(requestMayDecideOnLane({ actor: liveNiyar, subject: liveNiyar, lane: "manage", data: livePreviewData }), true, "Niyar replies to own file from إدارة as highest authority");
assert.equal(
  collectRequestInbox(liveRoster, [], "emp_owner_preview", "ar", { ownOnly: true, viewer: liveNiyar }).some((row) => /أحمد|بشأن: أحمد/.test(row.head)),
  false,
  "Niyar إشعاراتي own-only does not reprint أحمد's pending",
);

assert.doesNotMatch(requestsPageSrc, /data-branch-alert/, "branch alerts are not peer top tabs");
assert.doesNotMatch(requestsPageSrc, /key:\s*["']archive["']/, "الأرشيف is not a peer top-level tab");
assert.match(requestsPageSrc, /requestFilter:\s*["']archive["']/, "deep-link /archive opens the nested archive chip");
assert.match(workspaceSrc, /\["archive",\s*ar \? "الأرشيف"/, "الأرشيف is the filter chip after يحتاج تعديلاً");
assert.match(workspaceSrc, /stFilter === "archive"/, "ملفي/إدارة swap the inbox for the nested archive board");
assert.match(workspaceSrc, /RequestArchiveBoard/, "archive board nests inside the lane workspace");
assert.match(workspaceSrc, /scope=\{mode === "manage" \? "manage" : "mine"\}/, "ملفي archive is self-scoped and إدارة archive is station-scoped");
assert.match(workspaceSrc, /manageArchiveRows\(employees, lang, \{ stations, stationId: focusStationId/, "إدارة archive count stays station-scoped");
assert.match(workspaceSrc, /mineArchiveRows\(employees, currentUser \|\| self, lang\)/, "ملفي archive count stays self-only");
assert.match(src("src/pages/Requests.jsx"), /focusStationId=\{manageLane && canManage \? inboxFocusStationId/, "إدارة archive keeps branch scope");
assert.doesNotMatch(workspaceSrc, /nv-req-branch-alerts/, "إدارة does not repeat the header النطاق as a branch chip row");
assert.match(workspaceSrc, /setStationScope/, "the employee register can still move النطاق");
assert.equal(firstPendingRegisterPerson([twoStationMgr, noraKhafji, fahdRabigh], "ar", "khf")?.id, "nora", "فرع الخفجي opens the first pending person there");
assert.equal(firstPendingRegisterPerson([twoStationMgr, noraKhafji, fahdRabigh], "ar", "rbg")?.id, "fahd", "فرع رابغ opens the first pending person there");
assert.equal(firstPendingRegisterPerson([twoStationMgr], "ar", "khf")?.id, "mgr2", "a branch with no pending still opens someone seated there");
assert.match(workspaceSrc, /firstPendingRegisterPerson\(employees, lang, focusStationId\)/, "changing النطاق reselects the first pending person on that branch");
assert.doesNotMatch(workspaceSrc, /is-mine-stack/, "ملفي keeps the two-column raise and inbox");
assert.doesNotMatch(workspaceSrc, /defaultOpen/, "طلب جديد stays open beside the inbox");
assert.match(workspaceSrc, /nv-req-lower/, "إشعاراتي والرصيد والعطل في صفوف ثنائية تحت الصندوق");
assert.doesNotMatch(requestsPageSrc, /adminPending \+ dueAcrossManaged/, "إدارة tab counts pending requests only");
assert.match(requestsPageSrc, /count: adminPending,/);
assert.doesNotMatch(workspaceSrc, /stations\.length === 1 \? "فرع"/, "footer does not print leftover branch totals");

assert.equal(checkRefuseRequestReasonGate("").error, "REJECT_REASON_REQUIRED");
assert.equal(checkRefuseRequestReasonGate("لا").error, "REJECT_REASON_REQUIRED");
assert.equal(checkRefuseRequestReasonGate("تعارض تشغيلي في نفس الأسبوع").ok, true);
assert.equal(checkRejectStudyConsentGate({ type: STUDY_CONSENT_TYPE, status: "pending" }, "").error, "REJECT_REASON_REQUIRED");
assert.equal(checkRejectStudyConsentGate({ type: STUDY_CONSENT_TYPE, status: "pending" }, "لا يثبت الانتساب الدراسي").ok, true);

const nightRefuseAudit = buildRequestRefuseAudit({
  actor: "أحمد السالم",
  employeeId: "emp_owner_preview",
  employeeName: "نيار عبدالله",
  request: { id: "nc1", type: "night_consent", decisionId: "18632" },
  family: "other",
  reason: "أرفض الاستمرار كعامل ليلي هذا الشهر",
  at: "2026-09-20T08:00:00.000Z",
});
assert.equal(nightRefuseAudit.action, "night_consent_refused");
assert.equal(nightRefuseAudit.performedBy, "أحمد السالم");
assert.equal(nightRefuseAudit.employeeId, "emp_owner_preview");
assert.equal(nightRefuseAudit.decisionId, "18632");
assert.match(nightRefuseAudit.reason, /أرفض الاستمرار/);
assert.match(nightRefuseAudit.details, /نيار عبدالله/);
assert.match(nightRefuseAudit.details, /18632/);

const leaveRefuseAudit = buildRequestRefuseAudit({
  actor: "أحمد السالم",
  employeeId: "e-leave",
  employeeName: "عمر ناصر",
  request: { id: "lv1", type: "annual" },
  family: "leave",
  reason: "تعارض تشغيلي في نفس الأسبوع",
});
assert.equal(leaveRefuseAudit.action, "leave_request_rejected");
assert.equal(leaveRefuseAudit.performedBy, "أحمد السالم");
assert.match(leaveRefuseAudit.reason, /تعارض/);

const studyRefuseAudit = buildRequestRefuseAudit({
  actor: "أحمد السالم",
  employeeId: "e-study",
  employeeName: "عمر ناصر",
  request: { id: "sc1", type: STUDY_CONSENT_TYPE },
  family: "other",
  reason: "لا يثبت الانتساب الدراسي",
});
assert.equal(studyRefuseAudit.action, "study_consent_refused");
assert.equal(studyRefuseAudit.article, "115");

const refusePerson = {
  id: "e-file",
  name: "عمر ناصر",
  leaveRequests: [{
    id: "lv-ref",
    type: "annual",
    status: "rejected",
    reviewNote: "تعارض تشغيلي في نفس الأسبوع",
    reviewedBy: "أحمد السالم",
    reviewedAt: "2026-09-20T08:00:00.000Z",
  }],
  otherRequests: [{
    id: "nc-ref",
    type: "night_consent",
    status: "rejected",
    decision: "refuse",
    reviewNote: "أرفض الاستمرار كعامل ليلي هذا الشهر",
    reviewedBy: "عمر ناصر",
    reviewedAt: "2026-09-20T08:00:00.000Z",
  }],
};
const refuseLogs = collectRequestRefuseLogs(refusePerson, true);
assert.ok(refuseLogs.some((row) => row.decisionId === "18632" && /أرفض/.test(row.reason) && row.by === "عمر ناصر"));
assert.ok(refuseLogs.some((row) => /تعارض/.test(row.reason) && row.by === "أحمد السالم"));
const fileView = buildEmployeeFileView({ employee: refusePerson, currentUser: { id: "e-file" }, ar: true });
assert.ok((fileView.auditTop || []).some((row) => /رُفض/.test(row.text) && /تعارض|أرفض/.test(row.text)), "employee file shows the refuse audit");
assert.ok(collectRequestArchive([refusePerson]).rows.some((row) => row.status === "rejected" && /تعارض|أرفض/.test(row.meta || "")));

const refuseStreak = {
  ownerId: "emp_owner_preview",
  employees: [{
    id: "emp_owner_preview",
    name: "نيار عبدالله",
    role: "director",
    stationId: "hq",
    profile: {},
    otherRequests: [],
    leaveRequests: [{
      id: "lv-refused",
      type: "annual",
      status: "rejected",
      reviewNote: "تعارض تشغيلي في نفس الأسبوع",
      reviewedBy: "أحمد السالم",
      reviewedAt: "2026-09-20T08:00:00.000Z",
    }],
  }, {
    id: "emp_manager_preview",
    name: "أحمد السالم",
    role: "station_manager",
    stationId: "st_north_preview",
    managedStations: ["st_north_preview"],
    profile: {},
    otherRequests: [],
  }],
  stations: [
    { id: "hq", name: "NiroVera", isCompanyRoot: true, managerId: "emp_owner_preview" },
    { id: "st_north_preview", name: "فرع الخفجي", parentStationId: "hq", managerId: "emp_manager_preview" },
  ],
  schedules: [],
};
assert.equal(seedPreviewOwnerNightStreak(refuseStreak, "2026-09-15"), true);
const refuseSched = refuseStreak.schedules.find((row) => row.stationId === "hq");
const dueBefore = nightRotateDue({ employee: refuseStreak.employees[0], schedule: refuseSched, weekStart: "2026-09-13" });
assert.equal(dueBefore.due, true, "18632 is due before a refuse");
assert.equal(hasWrittenNightConsent(refuseStreak.employees[0]), false);
const afterLeaveRefuse = refuseStreak.employees[0];
assert.equal(hasWrittenNightConsent(afterLeaveRefuse), false, "leave refuse does not grant night consent");
assert.equal(nightRotateDue({ employee: afterLeaveRefuse, schedule: refuseSched, weekStart: "2026-09-13" }).due, true, "18632 stays due after a leave refuse");
const afterNightRefuse = {
  ...afterLeaveRefuse,
  profile: { ...(afterLeaveRefuse.profile || {}) },
  otherRequests: [{
    id: "nc-refused",
    type: "night_consent",
    status: "rejected",
    cycleKey: dueBefore.cycleKey,
    reviewNote: "لا يُعتمد الملف — السبب مكتوب في سجل التدقيق",
    reviewedBy: "أحمد السالم",
    reviewedAt: "2026-09-20T08:00:00.000Z",
    auditTrail: [buildRequestRefuseAudit({
      actor: "أحمد السالم",
      employeeId: afterLeaveRefuse.id,
      employeeName: afterLeaveRefuse.name,
      request: { id: "nc-refused", type: "night_consent", decisionId: "18632" },
      family: "other",
      reason: "لا يُعتمد الملف — السبب مكتوب في سجل التدقيق",
      at: "2026-09-20T08:00:00.000Z",
    })],
  }],
};
assert.equal(hasWrittenNightConsent(afterNightRefuse), false, "night_consent refuse does not grant written consent");
assert.equal(hasRequestRefuseAudit(afterNightRefuse.otherRequests[0]), true, "night_consent refuse keeps actor + reason on the request trail");
assert.equal(nightRotateDue({ employee: afterNightRefuse, schedule: refuseSched, weekStart: "2026-09-13" }).due, true, "18632 stays due after a refuse that is not the worker's agree/refuse/reduce");
const afterEmployeeNightRefuse = {
  ...afterLeaveRefuse,
  profile: { nightConsentWithdrawnAt: "2026-09-20T08:00:00.000Z" },
  otherRequests: [{
    id: "nc-emp-refused",
    type: "night_consent",
    status: "rejected",
    decision: "refuse",
    cycleKey: dueBefore.cycleKey,
    reviewNote: "أرفض الاستمرار كعامل ليلي وأطلب التدوير لساعات عادية شهراً على الأقل.",
    reviewedBy: afterLeaveRefuse.name,
  }],
};
assert.equal(hasWrittenNightConsent(afterEmployeeNightRefuse), false, "employee night refuse does not write consent");
assert.equal(nightRotateDue({ employee: afterEmployeeNightRefuse, schedule: refuseSched, weekStart: "2026-09-13" }).due, true, "if still on nights after refuse, 18632 stays due — refuse does not grant consent");

const workforceSrc = src("base44/functions/workforce/entry.ts");
assert.match(workforceSrc, /rejectOther/, "workforce twin refuses other requests");
assert.match(workforceSrc, /buildRequestRefuseAudit/, "workforce refuse stamps the same AuditLog row");
assert.match(workforceSrc, /appendRequestRefuseAudit/, "workforce stamps request.auditTrail");
assert.match(storeSrc, /appendRequestRefuseAudit/, "store stamps request.auditTrail");
assert.match(workspaceSrc, /سجل التدقيق/, "طلباتي card names the refuse audit");
assert.match(storeSrc, /action: "rejectLeave"/, "store leave refuse keeps the workforce twin");
assert.match(storeSrc, /action: "rejectOther"/, "store other refuse keeps the workforce twin");
assert.match(src("base44/functions/companyDirectory/entry.ts"), /reason: body\.reason/, "companyDirectory persists the refuse reason");

const raiseAudit = buildRequestAudit({
  actor: "عمر ناصر",
  employeeId: "e-raise",
  employeeName: "عمر ناصر",
  request: { id: "lv-raise", type: "annual" },
  family: "leave",
  verb: "raise",
  at: "2026-09-20T07:00:00.000Z",
});
assert.equal(raiseAudit.action, "leave_request_raised");
assert.equal(raiseAudit.eventType, "raised");
assert.equal(raiseAudit.performedBy, "عمر ناصر");
assert.match(raiseAudit.details, /raised annual/);

const approveAudit = buildRequestAudit({
  actor: "أحمد السالم",
  employeeId: "e-raise",
  employeeName: "عمر ناصر",
  request: { id: "lv-raise", type: "annual" },
  family: "leave",
  verb: "approve",
  at: "2026-09-20T08:00:00.000Z",
});
assert.equal(approveAudit.action, "leave_request_approved");
assert.equal(approveAudit.eventType, "approved");
assert.match(approveAudit.details, /approved annual on عمر ناصر/);

const studyApproveAudit = buildRequestAudit({
  actor: "أحمد السالم",
  employeeId: "e-study",
  employeeName: "عمر ناصر",
  request: { id: "sc1", type: STUDY_CONSENT_TYPE },
  family: "other",
  verb: "approve",
});
assert.equal(studyApproveAudit.action, "study_consent_approved");
assert.equal(studyApproveAudit.article, "115");

const nightAgreeAudit = buildRequestAudit({
  actor: "عمر ناصر",
  employeeId: "e-night",
  employeeName: "عمر ناصر",
  request: { id: "nc1", type: "night_consent", decisionId: "18632" },
  family: "other",
  verb: "agree",
});
assert.equal(nightAgreeAudit.action, "night_consent_recorded");
assert.equal(nightAgreeAudit.decisionId, "18632");

const trailPerson = {
  id: "e-trail",
  name: "نورة القحطاني",
  stationId: "khf",
  leaveRequests: [{
    id: "lv-ok",
    type: "annual",
    status: "approved",
    createdAt: "2026-09-18T08:00:00.000Z",
    reviewedAt: "2026-09-19T08:00:00.000Z",
    reviewedBy: "أحمد السالم",
    decisionSeenAt: "2026-09-19T09:00:00.000Z",
    reviewNote: "",
    auditTrail: [
      { ...raiseAudit, type: "raised" },
      { ...approveAudit, type: "approved" },
    ],
  }, {
    id: "lv-no",
    type: "sick",
    status: "rejected",
    createdAt: "2026-09-17T08:00:00.000Z",
    reviewedAt: "2026-09-17T10:00:00.000Z",
    reviewedBy: "أحمد السالم",
    reviewNote: "تعارض تشغيلي في نفس الأسبوع",
    auditTrail: [
      { type: "raised", action: "leave_request_raised", performedBy: "نورة القحطاني", at: "2026-09-17T08:00:00.000Z" },
      { type: "refused", action: "leave_request_rejected", performedBy: "أحمد السالم", reason: "تعارض تشغيلي في نفس الأسبوع", at: "2026-09-17T10:00:00.000Z" },
    ],
  }, {
    id: "lv-live",
    type: "annual",
    status: "pending",
    createdAt: "2026-09-20T08:00:00.000Z",
  }],
  otherRequests: [{
    id: "sc-ok",
    type: STUDY_CONSENT_TYPE,
    status: "approved",
    createdAt: "2026-09-16T08:00:00.000Z",
    reviewedAt: "2026-09-16T12:00:00.000Z",
    reviewedBy: "أحمد السالم",
    program: "إدارة أعمال",
  }],
};
const coworker = {
  id: "e-fahd",
  name: "فهد العتيبي",
  stationId: "rbg",
  leaveRequests: [{
    id: "lv-f",
    type: "annual",
    status: "rejected",
    createdAt: "2026-09-15T08:00:00.000Z",
    reviewedAt: "2026-09-15T10:00:00.000Z",
    reviewedBy: "أحمد السالم",
    reviewNote: "لا يغطي الرصيد",
    decisionSeenAt: "2026-09-15T11:00:00.000Z",
  }],
  otherRequests: [],
};
const trailLogs = collectRequestAuditLogs(trailPerson, true);
assert.ok(trailLogs.some((row) => row.verb === "raise" && /رُفع/.test(row.text)));
assert.ok(trailLogs.some((row) => row.verb === "approve" && /اعتُمد/.test(row.text)));
assert.ok(trailLogs.some((row) => row.verb === "refuse" && /رُفض/.test(row.text) && /تعارض/.test(row.reason)));
assert.ok(hasRequestRefuseAudit(trailPerson.leaveRequests[1]));

const packedArchive = collectRequestArchive([trailPerson, coworker]);
assert.ok(packedArchive.rows.every((row) => row.status !== "pending"), "archive lists only settled");
assert.ok(!packedArchive.rows.some((row) => row.requestId === "lv-live"), "pending stays out of archive");
assert.ok(packedArchive.rows.some((row) => row.requestId === "lv-ok" && row.status === "approved"));
assert.ok(packedArchive.rows.some((row) => row.requestId === "lv-no" && row.status === "rejected"));

const archiveByName = filterRequestArchive({ rows: packedArchive.rows, query: "نورة", lang: "ar" });
assert.equal(archiveByName.ok, true);
assert.ok(archiveByName.rows.every((row) => row.employeeId === "e-trail"), "search by employee name");
assert.ok(!archiveByName.rows.some((row) => row.employeeId === "e-fahd"));

const archiveByType = filterRequestArchive({ rows: packedArchive.rows, query: "مرضية", lang: "ar" });
assert.equal(archiveByType.ok, true);
assert.ok(archiveByType.rows.every((row) => row.type === "sick"), "search by request type");

const archiveByStatus = filterRequestArchive({ rows: packedArchive.rows, query: "مرفوض", lang: "ar" });
assert.equal(archiveByStatus.ok, true);
assert.ok(archiveByStatus.rows.every((row) => row.status === "rejected"), "search by status");

const byStatusChip = filterRequestArchive({ rows: packedArchive.rows, status: "approved", lang: "ar" });
assert.ok(byStatusChip.ok && byStatusChip.rows.every((row) => row.statusKey === "approved"));

const noHit = filterRequestArchive({ rows: packedArchive.rows, query: "لا يوجد هذا الاسم", lang: "ar" });
assert.equal(noHit.ok, false);
assert.equal(noHit.error, "NO_MATCH");
assert.equal(noHit.rows.length, 0);

const mineOnly = mineArchiveRows([trailPerson, coworker], { id: "e-trail" }, "ar");
assert.equal(mineOnly.ok, true);
assert.ok(mineOnly.rows.every((row) => row.employeeId === "e-trail"), "employee archive is scoped to self");
assert.ok(!mineOnly.rows.some((row) => row.employeeId === "e-fahd"));

const archiveByReviewer = filterRequestArchive({ rows: packedArchive.rows, query: "أحمد السالم", lang: "ar" });
assert.equal(archiveByReviewer.ok, true);
assert.ok(archiveByReviewer.rows.every((row) => /أحمد السالم/.test(row.reviewedBy || "")), "search by reviewer");

const archiveByReason = filterRequestArchive({ rows: packedArchive.rows, query: "تعارض تشغيلي", lang: "ar" });
assert.equal(archiveByReason.ok, true);
assert.ok(archiveByReason.rows.every((row) => row.requestId === "lv-no"), "search by refusal reason");

const archiveByDate = filterRequestArchive({ rows: packedArchive.rows, query: "2026-09-19", lang: "ar" });
assert.equal(archiveByDate.ok, true);
assert.ok(archiveByDate.rows.some((row) => row.requestId === "lv-ok"), "search by close date");

const manageKhf = manageArchiveRows([trailPerson, coworker], "ar", {
  stations: [{ id: "khf", name: "الخفجي" }, { id: "rbg", name: "رابغ" }],
  stationId: "khf",
});
assert.equal(manageKhf.ok, true);
assert.ok(manageKhf.rows.every((row) => row.stationId === "khf"), "إدارة archive is station-scoped");
assert.ok(!manageKhf.rows.some((row) => row.employeeId === "e-fahd"));

const manageAll = manageArchiveRows([trailPerson, coworker], "ar");
assert.ok(manageAll.rows.some((row) => row.employeeId === "e-fahd"), "إدارة without a station sees the managed roster");

const smart = requestArchiveSmartItems(mineOnly.rows, { lang: "ar", hideEmployeeName: true });
assert.ok(smart.length && smart.every((item) => item.date && item.search && item.row), "smart items match المهام / إثبات العمل shape");
assert.ok(smart.every((item) => !String(item.text || "").includes("فهد")), "ملفي smart items stay self-only");

const fileTrail = buildEmployeeFileView({ employee: trailPerson, currentUser: { id: "e-trail" }, ar: true });
assert.ok((fileTrail.auditTop || []).some((row) => /رُفع|اعتُمد|رُفض/.test(row.text)), "employee file shows raise/approve/refuse");

assert.match(storeSrc, /stampRequestAudit/, "store stamps every request verb");
assert.match(storeSrc, /appendRequestAudit/, "store appends raise/approve/withdraw on the same trail");
assert.match(storeSrc, /verb: "raise"/, "store stamps a raise");
assert.match(storeSrc, /verb: "approve"/, "store stamps an approve");
assert.match(storeSrc, /verb: "agree"/, "store stamps night agree");
assert.match(workforceSrc, /buildRequestAudit/, "workforce raise/approve use the same audit row");
assert.match(workforceSrc, /verb: "raise"/, "workforce stamps a raise");
assert.match(workforceSrc, /verb: "approve"/, "workforce stamps an approve");
assert.match(workspaceSrc, /requestAuditTrailRows/, "طلباتي shows the full audit trail");
assert.match(src("src/components/requests/RequestArchiveBoard.jsx"), /RecordSmartArchive/, "طلباتي archive reuses the المهام / إثبات العمل board");
assert.match(src("src/components/requests/RequestArchiveBoard.jsx"), /filterRequestArchive/, "archive board runs the search engine");
assert.match(src("src/components/requests/RequestArchiveBoard.jsx"), /requestArchiveSmartItems/, "archive maps rows to the shared item shape");
assert.match(src("src/components/requests/RequestArchiveBoard.jsx"), /renderOpen/, "open row shows the audit trail");
assert.match(src("src/components/shared/RecordSmartArchive.jsx"), /peopleQueryMatches/, "shared archive search is the people engine");
assert.match(src("src/components/requests/RequestsWorkspace.jsx"), /mineArchiveRows/, "ملفي archive count is self-only");
assert.match(src("src/components/requests/RequestsWorkspace.jsx"), /manageArchiveRows/, "إدارة archive count is station-scoped");

console.log("request workspace ok");
