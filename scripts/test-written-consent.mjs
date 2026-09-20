import assert from "node:assert/strict";
import {
  CONSENT_MINISTRY_HINT_AR,
  CONSENT_TOPICS,
  WRITTEN_CONSENT_TYPE,
  checkAcceptConsentGate,
  checkConfirmConsentPaperGate,
  checkRaiseConsentGate,
  checkRefuseConsentGate,
  consentRowHref,
  consentSealFace,
  consentSignHref,
  consentSignerEmail,
  deskSigningRows,
  isConsentSigningRequest,
  isConsentSignToken,
  consentTopicMeta,
  flattenWrittenConsents,
  isOpenConsent,
  mineWrittenConsents,
  openWrittenConsentCount,
  savedConsentSeals,
} from "../src/lib/writtenConsent.js";
import { OTHER_REQUEST_TYPES, buildRequestRefuseAudit, checkRefuseRequestReasonGate, pendingManagerDecideCount } from "../src/lib/otherRequestDerivations.js";
import { hasWrittenNightConsent } from "../src/lib/decision18632.js";
import { flattenWorkspaceRows, requestNoticeHref } from "../src/lib/requestWorkspace.js";
import { checkDocumentReadGate, nextUnreadPage, normalizeSignMark } from "../src/lib/documentReadGate.js";
import {
  LETTER_SIGNABLE_TYPES,
  SIGNABLE_REQUEST_TYPES,
  checkRaiseSignableGate,
  hasOpenRequestSigning,
  isLetterSignableType,
  isRequestSigningPackage,
  isSignableRequestType,
  requestSignHref,
} from "../src/lib/requestSigning.js";
import { seedPreviewOwnerNightStreak, seedPreviewWrittenConsent } from "../src/lib/previewMigrations.js";
import { applyLapsedNightConsents, nightRotateDue, shouldLapseNightWrittenConsent } from "../src/lib/nightRotateCycle.js";
import { nightDueAdminNotifyKey, planNightDueAdminNotifications, planNightDueNotifications } from "../src/lib/nightDueNotify.js";
import { nightDueAdminAudience } from "../src/lib/dutyScope.js";
import { nightDueAdminEmployees } from "../src/lib/suiteBadges.js";

assert.ok(CONSENT_TOPICS.some((row) => row.id === "night"));
assert.match(consentTopicMeta("night").bodyAr, /حق التراجع/);
assert.doesNotMatch(consentTopicMeta("night").bodyAr, /جدّد كل شهر|إعادة شهرية واجبة/);
assert.equal(consentTopicMeta("night").citeAr, "قرار 18632");
assert.equal(consentTopicMeta("night").decisionId, "18632");
assert.ok(CONSENT_TOPICS.some((row) => row.id === "site"));
assert.ok(CONSENT_TOPICS.some((row) => row.id === "ot"));
assert.equal(consentTopicMeta("ot").citeAr, "المادة 107");
assert.ok(OTHER_REQUEST_TYPES.some((row) => row.key === WRITTEN_CONSENT_TYPE));

const form = { name: "نموذج.pdf", url: "/signing-preview-pumps.pdf" };
const paper = { name: "نموذج-موقع.pdf", url: "/signed.pdf" };
assert.equal(checkRaiseConsentGate({ employeeId: "", body: "نص طويل بما يكفي", deadline: "2026-09-19", file: form, paper }).ok, false);
assert.equal(checkRaiseConsentGate({ employeeId: "e1", body: "قصير", deadline: "2026-09-19", file: form, paper }).ok, false);
assert.equal(checkRaiseConsentGate({ employeeId: "e1", body: "نص الطلب كما سيقرؤه الموظف بالتفصيل", deadline: "2026-09-19" }).error, "FILE_REQUIRED");
assert.equal(checkRaiseConsentGate({ employeeId: "e1", body: "نص الطلب كما سيقرؤه الموظف بالتفصيل", deadline: "2026-09-19", file: form }).ok, true);
assert.equal(checkRaiseConsentGate({ employeeId: "e1", body: "نص الطلب كما سيقرؤه الموظف بالتفصيل", deadline: "2026-09-19", file: form, paper }).ok, true);
assert.equal(checkRaiseConsentGate({ employeeId: "e1", body: "نص الطلب كما سيقرؤه الموظف بالتفصيل", deadline: "2026-09-19", file: { name: "scan.png", url: "/x.png" }, paper: { name: "scan-signed.png", url: "/y.png" } }).ok, true);
assert.equal(consentSignHref("req.tok1"), "/app/requests");
assert.equal(consentSignHref(""), "/app/requests");
assert.equal(consentRowHref({ id: "w1", signRequestId: "sig1", signToken: "tok" }), "/app/requests#consent-w1");
assert.doesNotMatch(consentRowHref({ id: "w1", signToken: "tok" }), /signing/);
assert.equal(checkConfirmConsentPaperGate({ ack: true }).error, "PAPER_REQUIRED");
assert.equal(checkConfirmConsentPaperGate({ ack: true, paper }).ok, true);
assert.equal(isConsentSigningRequest({ kind: "written_consent" }), true);
assert.equal(isConsentSigningRequest({ consentId: "w1" }), true);
assert.equal(isConsentSigningRequest({ kind: "salary_letter", otherRequestId: "o1" }), true);
assert.equal(isConsentSigningRequest({ id: "s1" }), false);
assert.equal(deskSigningRows([{ kind: "written_consent" }, { kind: "salary_letter", otherRequestId: "o1" }, { id: "s1" }]).map((row) => row.id).join(","), "s1");
assert.equal(isConsentSignToken("tok", [{ kind: "written_consent", id: "sig1", signers: [{ token: "tok" }] }]), true);
assert.equal(isConsentSignToken("other", [{ kind: "written_consent", signers: [{ token: "tok" }] }]), false);
assert.equal(isConsentSignToken("sig.let1", [], [{ otherRequests: [{ type: "salary_letter", signToken: "sig.let1" }] }]), true);
assert.equal(requestSignHref("sig.let1"), "/app/requests");
assert.ok(SIGNABLE_REQUEST_TYPES.includes("written_consent"));
assert.ok(LETTER_SIGNABLE_TYPES.every((key) => isLetterSignableType(key) && isSignableRequestType(key)));
assert.equal(isSignableRequestType("leave_topup"), false);
assert.equal(isSignableRequestType("shift_change"), false);
assert.equal(isRequestSigningPackage({ kind: "custody", otherRequestId: "c1" }), true);
assert.equal(hasOpenRequestSigning({ type: "salary_letter", status: "pending_manager", signToken: "sig.a" }), true);
assert.equal(hasOpenRequestSigning({ type: "salary_letter", status: "rejected", signToken: "sig.a" }), false);
assert.equal(checkRaiseSignableGate({ type: "salary_letter", file: form }).error, "PAPER_REQUIRED");
assert.equal(checkRaiseSignableGate({ type: "salary_letter", file: form, paper }).ok, true);
assert.equal(checkRaiseSignableGate({ type: "custody", file: { name: "ack.jpg", url: "/x.jpg", type: "image/jpeg" }, paper: { name: "ack-signed.jpg", url: "/y.jpg", type: "image/jpeg" } }).ok, true);
assert.equal(checkRaiseSignableGate({ type: "advance", file: form }).skipped, true);
assert.equal(consentSignerEmail({ id: "e1", email: "a@b.co" }), "a@b.co");
assert.match(CONSENT_MINISTRY_HINT_AR, /اكتب موافقة خطية/);
assert.match(CONSENT_MINISTRY_HINT_AR, /قسم التوقيع/);
assert.match(CONSENT_MINISTRY_HINT_AR, /ارفع النسخة هنا للاعتماد/);
assert.match(CONSENT_MINISTRY_HINT_AR, /زر مباشر/);
assert.equal(checkAcceptConsentGate({ viaSigning: true }).error, "ACK_REQUIRED");
assert.equal(checkAcceptConsentGate({ viaSigning: true, ack: true }).error, "PAPER_REQUIRED");
assert.equal(checkRefuseConsentGate({ note: "لا", viaSigning: true }).ok, true);

assert.equal(checkAcceptConsentGate({ ack: true, file: { url: "/x.pdf" }, seal: { url: "x" } }).error, "PAPER_REQUIRED");
assert.equal(checkAcceptConsentGate({ ack: false, paper }).error, "ACK_REQUIRED");
assert.equal(checkAcceptConsentGate({ ack: true }).error, "PAPER_REQUIRED");
assert.equal(checkAcceptConsentGate({ ack: true, paper }).ok, true);
assert.equal(checkAcceptConsentGate({ ack: true, readAt: "2026-09-12", file: { url: "/x.pdf" }, seal: { url: "data:image" } }).error, "PAPER_REQUIRED");

assert.equal(checkRefuseConsentGate({ note: "لا" }).ok, true, "ministry refuse is direct");
assert.equal(checkRefuseConsentGate({}).ok, true);

const seals = savedConsentSeals({ signatureUrl: "data:image/png;base64,xx", signatureName: "نيار" });
assert.equal(seals.length, 1);
assert.equal(savedConsentSeals({}).length, 0);

const employees = [{
  id: "e1",
  name: "أحمد",
  leaveRequests: [],
  otherRequests: [
    { id: "w1", type: "written_consent", status: "open", titleAr: "ليلي", createdAt: "2026-09-12" },
    { id: "o1", type: "salary_letter", status: "pending", createdAt: "2026-09-11" },
  ],
}];
assert.equal(openWrittenConsentCount(employees), 1);
assert.equal(flattenWrittenConsents(employees).length, 1);
assert.equal(mineWrittenConsents(employees).length, 1);
assert.ok(isOpenConsent(employees[0].otherRequests[0]));
assert.equal(consentSealFace(employees[0].otherRequests[0], true).label, "مفتوحة في طلباتي");
assert.equal(consentSealFace({ status: "yes", seal: { signatureId: "PWC-1" } }, true).label, "مختوم");
assert.equal(consentSealFace({ status: "yes", seal: { signatureId: "PWC-1" } }, true).ref, "PWC-1");
assert.equal(flattenWorkspaceRows(employees, "ar").every((row) => row.type !== "written_consent"), true);
assert.equal(pendingManagerDecideCount(employees), 1);

assert.equal(checkDocumentReadGate({ required: true, pageCount: 3, seen: new Set([1]) }).error, "READ_INCOMPLETE");
assert.equal(checkDocumentReadGate({ required: true, pageCount: 2, seen: [1, 2] }).ok, true);
assert.equal(checkDocumentReadGate({ required: true, pageCount: 4, seen: [], readAt: "2026-09-12" }).ok, true);
assert.equal(nextUnreadPage(new Set([1]), 3), 2);
assert.equal(nextUnreadPage([1, 2, 3], 3), null);
assert.equal(normalizeSignMark({ x: 72, y: 84 }).page, 1);
assert.equal(normalizeSignMark({ x: "no" }), null);

const preview = {
  employees: [
    { id: "emp_owner_preview", name: "نيار عبدالله", role: "director", stationId: "st", otherRequests: [] },
    { id: "emp_field_preview", name: "عمر ناصر", role: "employee", otherRequests: [] },
  ],
};
seedPreviewWrittenConsent(preview, "2026-09-15");
assert.equal(preview.employees[0].otherRequests.find((row) => row.topic === "night"), undefined, "no 18632 seed without a night week");
const siteSeed = preview.employees[1].otherRequests.find((row) => row.topic === "site");
assert.match(siteSeed.senderFile?.name || "", /موقع[- ]العمل/);

const emptyNight = { id: "e1", otherRequests: [{ id: "w1", type: "written_consent", topic: "night", status: "open" }] };
assert.equal(shouldLapseNightWrittenConsent(emptyNight, { shiftTypes: [], assignments: {} }, "2026-09-13"), true);

const streak = {
  ownerId: "emp_owner_preview",
  employees: [{
    id: "emp_owner_preview",
    name: "نيار عبدالله",
    role: "director",
    stationId: "hq",
    profile: {},
    otherRequests: [{ id: "wcon_preview_owner", type: "written_consent", topic: "night", status: "open" }],
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
assert.equal(seedPreviewOwnerNightStreak(streak, "2026-09-15"), true);
assert.equal(seedPreviewOwnerNightStreak(streak, "2026-09-15"), false);
const ownerSched = streak.schedules.find((row) => row.stationId === "hq");
assert.ok(ownerSched);
const due = nightRotateDue({ employee: streak.employees[0], schedule: ownerSched, weekStart: "2026-09-13" });
assert.equal(due.due, true, "three months of dated night weeks opens 18632");
const plans = planNightDueNotifications({
  employees: streak.employees,
  data: streak,
  weekStart: "2026-09-13",
});
assert.equal(plans.length, 1);
assert.equal(plans[0].employeeId, "emp_owner_preview");
assert.match(plans[0].text, /18632/);
const adminPlans = planNightDueAdminNotifications({
  employees: streak.employees,
  data: streak,
  weekStart: "2026-09-13",
});
assert.ok(nightDueAdminAudience(streak, streak.employees[0]).some((row) => row.id === "emp_manager_preview"), "إدارة audience includes أحمد");
assert.equal(adminPlans.length, 1, "one إدارة notice — أحمد about نيار");
assert.equal(adminPlans[0].managerId, "emp_manager_preview");
assert.equal(adminPlans[0].employeeId, "emp_owner_preview");
assert.match(adminPlans[0].text, /نيار عبدالله مستحق موافقة خطية ليلية/);
assert.match(plans[0].text, /وافق أو ارفض/);
assert.match(plans[0].text, /حق سحبها في أي وقت/);
assert.equal(adminPlans[0].key, nightDueAdminNotifyKey("emp_manager_preview", "emp_owner_preview", adminPlans[0].cycleKey));
assert.equal(planNightDueAdminNotifications({
  employees: streak.employees,
  data: streak,
  weekStart: "2026-09-13",
  existingKeys: adminPlans.map((row) => row.key),
}).length, 0, "same due cycle does not notify الإدارة again");
assert.equal(requestNoticeHref(adminPlans[0].text), "/app/requests/manage");
assert.ok(nightDueAdminEmployees(streak.employees[1], streak, "2026-09-13").some((row) => row.id === "emp_owner_preview"), "إدارة أحمد lists due نيار");
assert.ok(!nightDueAdminEmployees(streak.employees[0], streak, "2026-09-13").some((row) => row.id === "emp_owner_preview"), "إدارة نيار does not act on his own file");
assert.equal(streak.employees[0].otherRequests.some((row) => row.id === "wcon_preview_owner"), false);

const nightPerson = { id: "emp_owner_preview", stationId: "hq", otherRequests: [{ id: "w1", type: "written_consent", topic: "night", status: "open" }] };
assert.equal(shouldLapseNightWrittenConsent(nightPerson, ownerSched, "2026-09-13"), false);
const stale = {
  employees: [{ id: "e1", stationId: "st", otherRequests: [{ id: "w1", type: "written_consent", topic: "night", citeAr: "قرار 18632", status: "open" }] }],
  schedules: [{ stationId: "st", shiftTypes: [], assignments: {} }],
};
assert.equal(applyLapsedNightConsents(stale, "2026-09-13"), true);
assert.equal(stale.employees[0].otherRequests[0].status, "lapsed");

assert.equal(checkRefuseRequestReasonGate("").error, "REJECT_REASON_REQUIRED");
const nightRefuse = buildRequestRefuseAudit({
  actor: "نيار عبدالله",
  employeeId: "emp_owner_preview",
  employeeName: "نيار عبدالله",
  request: { id: "nc1", type: "night_consent" },
  reason: "أرفض الاستمرار كعامل ليلي هذا الشهر",
});
assert.equal(nightRefuse.action, "night_consent_refused");
assert.equal(nightRefuse.performedBy, "نيار عبدالله");
assert.equal(nightRefuse.decisionId, "18632");
assert.match(nightRefuse.reason, /أرفض/);
const refusedDueEmp = {
  ...streak.employees[0],
  profile: { ...(streak.employees[0].profile || {}) },
  otherRequests: [{
    id: "nc-refused",
    type: "night_consent",
    status: "rejected",
    decision: "refuse",
    cycleKey: due.cycleKey,
    reviewNote: "أرفض الاستمرار كعامل ليلي هذا الشهر",
    reviewedBy: "نيار عبدالله",
  }],
};
assert.equal(hasWrittenNightConsent(refusedDueEmp), false, "refuse does not grant 18632 consent");
assert.equal(nightRotateDue({ employee: refusedDueEmp, schedule: ownerSched, weekStart: "2026-09-13" }).due, true, "rotate stays due after night_consent refuse");

console.log("written consent ok");
