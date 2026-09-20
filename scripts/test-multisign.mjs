import assert from "node:assert/strict";
import {
  applyContinue,
  applyCreate,
  applyDelete,
  applyReject,
  applyRelease,
  applyReopen,
  applyRetract,
  applySubmit,
  canDownloadFinal,
  completionNotice,
  isOpenSigningState,
  buildDummySignatureRequests,
  checkCreateGate,
  MAX_PARALLEL_SIGNERS,
  createGateMessage,
  canRetractSigner,
  canSignerSign,
  ensureSignedAudit,
  signedAuditCount,
  clampRetractDays,
  dummySigningEmployees,
  emailValid,
  expireRetractWindows,
  isRegistrable,
  shouldSkipSilentAfterRetractClose,
  lastSignedHash,
  partyStatusLabel,
  projectRequest,
  publicPartiesOf,
  refusalKindLabel,
  refusalLines,
  REFUSAL_DEADLINE,
  REFUSAL_EXPLICIT,
  DEADLINE_REFUSAL_REASON,
  RETRACT_DAY_OPTIONS,
  retractAlert,
  settleStatus,
  visibleToActor,
} from "../src/lib/multiSignDerivations.js";
import { refusalNote, settledState, stateLabel } from "../src/lib/multiSignDerivations.js";

const employees = dummySigningEmployees();
const owner = employees[0];
const ahmed = employees[1];
const omar = employees[2];
const sara = employees[3];
const noura = employees[4];
const hassan = employees[5];

assert.equal(createGateMessage("SIGNATURE_REUSE", true), "رقم التحقق مرتبط بملف آخر — لا يُعاد استخدامه.");
assert.ok(createGateMessage("Couldn't complete — SIGNERS_INVALID", false).includes("unique"));

assert.equal(employees.length, 6);
assert.ok(employees.every((row) => emailValid(row.email)));
assert.equal(new Set(employees.map((row) => row.email)).size, 6);

assert.equal(checkCreateGate({ fileName: "note.txt", signers: [] }).error, "PDF_REQUIRED");
assert.equal(checkCreateGate({ fileName: "a.pdf", signers: [{ name: "A", email: "a@x.com" }] }).error, "VERIFICATION_REQUIRED");
assert.equal(
  checkCreateGate({
    fileName: "a.pdf",
    verificationId: "PWC-1",
    signers: [{ name: "A", email: "bad" }],
  }).error,
  "SIGNERS_INVALID",
);
assert.equal(
  checkCreateGate({
    fileName: "a.pdf",
    verificationId: "PWC-1",
    signers: [
      { name: "A", email: "a@x.com" },
      { name: "B", email: "a@x.com" },
    ],
  }).error,
  "SIGNERS_INVALID",
);
assert.equal(
  checkCreateGate({
    fileName: "تصريح.pdf",
    verificationId: "PWC-1",
    signers: employees.slice(0, 3).map((row) => ({ name: row.name, email: row.email, employeeId: row.id })),
  }).ok,
  true,
);

const now = "2026-09-09T17:00:00.000Z";
const hash = (n) => `${"cd".repeat(16)}${String(n).padStart(32, "0")}`.slice(0, 64);
const created = applyCreate([], {
  companyId: "local-preview-nirovera",
  fileName: "طلب اختبار إرسال.pdf",
  verificationId: "PWC-SEND-TEST",
  docUrl: "local://doc",
  appUrl: "http://localhost:5173",
  signers: [noura, hassan].map((row) => ({
    name: row.name,
    email: row.email,
    employeeId: row.id,
    role: row.role,
    stationId: row.stationId,
  })),
}, owner, { now, rid: (() => { let n = 0; return () => `id${++n}`; })() });

assert.equal(created.ok, true);
assert.equal(created.request.status, "pending");
assert.equal(created.request.signingMode, "parallel");
assert.equal(canSignerSign(created.request, created.request.signers[0]), true);
assert.equal(canSignerSign(created.request, created.request.signers[1]), true);
assert.equal(Object.keys(created.links).length, 2);
assert.ok(created.links[noura.email].includes("/sign?token="));
assert.equal(created.store.length, 1);

const reuse = applyCreate(created.store, {
  fileName: "طلب اختبار إرسال.pdf",
  verificationId: "PWC-SEND-TEST",
  signers: [{ name: noura.name, email: noura.email }],
}, owner, { now });
assert.equal(reuse.error, "SIGNATURE_REUSE");

const listed = created.store.filter((row) => visibleToActor(row, owner)).map((row) => projectRequest(row, owner));
assert.equal(listed[0].isCreator, true);
assert.equal(listed[0].pendingCount, 2);
assert.equal(listed[0].myStatus, null);

const nouraView = projectRequest(created.request, noura);
assert.equal(nouraView.myStatus, "pending");
assert.ok(nouraView.myToken);

const nouraToken = `${created.request.id}.${created.request.signers[0].token}`;
const hassanToken = `${created.request.id}.${created.request.signers[1].token}`;

const missingReason = applyReject(created.store, nouraToken, { now });
assert.equal(missingReason.error, "REASON_REQUIRED");

const refused = applyReject(created.store, nouraToken, { reason: "الوصف لا يطابق الموقع", now });
assert.equal(refused.ok, true);
assert.equal(refused.status, "pending");
assert.equal(refused.request.signers.find((row) => row.email === hassan.email).status, "pending");
assert.equal(refused.request.signers.find((row) => row.email === noura.email).status, "rejected");
assert.equal(refused.request.signers.find((row) => row.email === noura.email).rejectionCause, REFUSAL_EXPLICIT);
assert.equal(refusalKindLabel(refused.request.signers.find((row) => row.email === noura.email), true), "رفض");
assert.ok(refused.request.auditTrail.some((event) => event.type === "rejected" && event.reason === "الوصف لا يطابق الموقع" && event.cause === REFUSAL_EXPLICIT));
assert.ok(!refused.request.auditTrail.some((event) => event.type === "skipped" && event.cause === "auto_refused"));
assert.equal(applySubmit(refused.store, hassanToken, { fileHash: hash(12), newDocUrl: "local://after-refuse", retractDays: 0, now }).ok, true);

const signedOnly = applySubmit(created.store, hassanToken, { fileHash: hash(9), newDocUrl: "local://signed", retractDays: 2, now });
assert.equal(signedOnly.ok, true);
assert.equal(signedOnly.status, "pending");
assert.equal(signedOnly.cooling, true);
assert.equal(signedOnly.retractDays, 2);
const signed = applyReject(signedOnly.store, nouraToken, { reason: "الوصف لا يطابق الموقع", now });
assert.equal(signed.ok, true);
assert.equal(signed.status, "pending");
assert.equal(signed.request.signers.find((row) => row.email === hassan.email).status, "signed");
assert.equal(signed.request.signers.find((row) => row.email === noura.email).status, "rejected");
assert.ok(!signed.request.signers.some((row) => row.status === "pending"));
assert.equal(canDownloadFinal(signed.request, Date.parse(now)), false);
assert.equal(signed.request.finalHash, null);
assert.equal(isRegistrable(settleStatus(signed.request.signers)), true);
assert.equal(lastSignedHash(signed.request.signers), hash(9));
assert.ok(refusalLines(signed.request.signers, true).includes("نورة القحطاني"));
assert.ok(signed.request.auditTrail.some((event) => event.type === "retract_window" && event.retractDays === 2));
assert.ok(signed.request.auditTrail.some((event) => event.type === "rejected"));
assert.ok(retractAlert(signed.request, true, Date.parse(now)).includes("حسن"));

const board = settledState(projectRequest(signed.request, owner), Date.parse(now));
assert.equal(board.state, "pending");
assert.equal(board.cooling, true);
assert.equal(stateLabel(board.state, true, true), "مهلة تراجع");
assert.ok(refusalNote(projectRequest(signed.request, owner), true).includes("لم يتوقف"));

assert.equal(settleStatus([{ status: "signed" }, { status: "signed" }]), "completed");
assert.equal(settleStatus([{ status: "rejected" }, { status: "rejected" }]), "rejected");
assert.equal(settleStatus([{ status: "pending" }, { status: "rejected" }]), "pending");

const dummy = buildDummySignatureRequests({
  companyId: "local-preview-nirovera",
  actor: owner,
  employees,
  now,
});
assert.equal(dummy.length, 7);
assert.equal(dummy.map((row) => row.status).sort().join(","), "completed,completed_with_refusal,completed_with_refusal,pending,pending,pending,pending");

const asOwner = dummy.filter((row) => visibleToActor(row, owner)).map((row) => projectRequest(row, owner));
assert.equal(asOwner.length, 7);
assert.equal(settledState(dummy.find((row) => row.id === "sg_await_release")).state, "awaiting_release");
assert.equal(settledState(dummy.find((row) => row.id === "sg_await_all")).state, "awaiting_release");
assert.equal(canDownloadFinal(dummy.find((row) => row.id === "sg_await_release"), Date.parse(now)), false);
assert.equal(canDownloadFinal(dummy.find((row) => row.id === "sg_await_all"), Date.parse(now)), false);
assert.equal(canDownloadFinal(dummy.find((row) => row.id === "sg_done"), Date.parse(now)), true);
assert.equal(canDownloadFinal(dummy.find((row) => row.id === "sg_mixed_close"), Date.parse(now)), true);
assert.ok(completionNotice(dummy.find((row) => row.id === "sg_done"), true).includes("اكتمل التوقيع:"));
assert.ok(completionNotice(dummy.find((row) => row.id === "sg_done"), true).includes("يمكن تنزيل النسخة النهائية"));
assert.ok(completionNotice(dummy.find((row) => row.id === "sg_mixed_close"), true).includes("اكتمل التوقيع مع رفض"));
assert.ok(completionNotice(dummy.find((row) => row.id === "sg_mixed_close"), true).includes("يمكن تنزيل النسخة النهائية"));
assert.ok(completionNotice(dummy.find((row) => row.id === "sg_done"), true).includes("توقيع"));
assert.ok(completionNotice(dummy.find((row) => row.id === "sg_mixed_close"), true).includes("توقيع"));
assert.equal(asOwner.find((row) => row.id === "sg_awaiting_you").myStatus, "pending");
assert.equal(asOwner.find((row) => row.id === "sg_sent_open").isCreator, true);
assert.equal(asOwner.find((row) => row.id === "sg_mixed_close").rejectedCount, 1);
assert.equal(asOwner.find((row) => row.id === "sg_mixed_close").signers.find((row) => row.email === omar.email).rejectionCause, REFUSAL_EXPLICIT);
assert.equal(asOwner.find((row) => row.id === "sg_deadline_close").signers.find((row) => row.status === "rejected").rejectionCause, REFUSAL_DEADLINE);
assert.equal(asOwner.find((row) => row.id === "sg_deadline_close").signers.find((row) => row.status === "rejected").rejectionReason, DEADLINE_REFUSAL_REASON);
assert.equal(asOwner.find((row) => row.id === "sg_done").signedCount, 2);

const sentOpen = dummy.find((row) => row.id === "sg_sent_open");
assert.ok(retractAlert(sentOpen, true, Date.parse(now)).includes("حسن"));
assert.equal(canRetractSigner(sentOpen.signers.find((row) => row.email === hassan.email), Date.parse(now)), true);

const awaitParties = publicPartiesOf(dummy.find((row) => row.id === "sg_awaiting_you").signers, "tok_await_owner");
assert.equal(awaitParties.find((row) => row.you).name, owner.name);
assert.equal(partyStatusLabel(awaitParties.find((row) => row.you), true), "أنت · بانتظار");
assert.equal(partyStatusLabel(awaitParties.find((row) => row.status === "signed"), true), "وقّع");
assert.equal(partyStatusLabel({ status: "rejected", rejectionCause: REFUSAL_DEADLINE }, true), "رفض بانتهاء المدة");

const asOmar = dummy.filter((row) => visibleToActor(row, omar)).map((row) => projectRequest(row, omar));
assert.equal(asOmar.length, 2);
assert.ok(asOmar.every((row) => row.myStatus === "rejected"));
assert.ok(asOmar.some((row) => row.id === "sg_mixed_close"));
assert.ok(asOmar.some((row) => row.id === "sg_await_release"));

const emptyFields = applySubmit(created.store, hassanToken, {
  fileHash: hash(1),
  textValues: {},
  now,
});
// No text fields on dummy send signers — submit is allowed.
assert.notEqual(emptyFields.error, "FIELDS_REQUIRED");

const withField = applyCreate([], {
  fileName: "حقول.pdf",
  verificationId: "PWC-FIELDS",
  signers: [{
    name: sara.name,
    email: sara.email,
    spots: [
      { id: "sig", type: "signature", page: 1, x: 70, y: 80 },
      { id: "txt-1", type: "text", label: "رقم الهوية", page: 1, x: 20, y: 40 },
    ],
  }],
}, owner, { now, rid: () => "fld1" });
const blocked = applySubmit(withField.store, `${withField.request.id}.${withField.request.signers[0].token}`, {
  fileHash: hash(2),
  textValues: {},
  now,
});
assert.equal(blocked.error, "FIELDS_REQUIRED");
const filled = applySubmit(withField.store, `${withField.request.id}.${withField.request.signers[0].token}`, {
  fileHash: hash(2),
  textValues: { "txt-1": "1002003001" },
  retractDays: 1,
  now,
});
assert.equal(filled.ok, true);
assert.equal(filled.status, "pending");
assert.equal(filled.cooling, true);
assert.equal(filled.finalHash, null);
assert.equal(canDownloadFinal(filled.request, Date.parse(now)), false);

assert.deepEqual(RETRACT_DAY_OPTIONS, [0, 1, 2, 3]);
assert.equal(clampRetractDays(0), 0);
assert.equal(clampRetractDays(9), 1);
assert.equal(clampRetractDays(2), 2);

const noWindow = applyCreate([], {
  companyId: "local-preview-nirovera",
  fileName: "بدون مهلة.pdf",
  verificationId: "PWC-NO-WINDOW",
  signers: [noura, hassan].map((row) => ({
    name: row.name,
    email: row.email,
    employeeId: row.id,
    role: row.role,
    stationId: row.stationId,
  })),
}, owner, { now, rid: (() => { let n = 0; return () => `nw${++n}`; })() });
const nwNoura = `${noWindow.request.id}.${noWindow.request.signers[0].token}`;
const nwHassan = `${noWindow.request.id}.${noWindow.request.signers[1].token}`;
const firstZero = applySubmit(noWindow.store, nwNoura, { fileHash: hash(20), newDocUrl: "local://zero-1", retractDays: 0, now });
assert.equal(firstZero.ok, true);
assert.equal(firstZero.retractDays, 0);
assert.equal(firstZero.retractUntil, null);
assert.equal(firstZero.status, "pending");
assert.equal(firstZero.cooling, false);
assert.equal(firstZero.finalHash, null);
assert.equal(firstZero.request.signers[0].retractUntil, null);
assert.equal(canRetractSigner(firstZero.request.signers[0], Date.parse(now)), false);
assert.equal(shouldSkipSilentAfterRetractClose(firstZero.request.signers, Date.parse(now)), false);
assert.ok(!firstZero.request.auditTrail.some((event) => event.type === "retract_window"));
const stillWaiting = expireRetractWindows(firstZero.store, { now });
assert.equal(stillWaiting.changed, false);
assert.equal(stillWaiting.store[0].signers.find((row) => row.email === hassan.email).status, "pending");
const bothZero = applySubmit(firstZero.store, nwHassan, { fileHash: hash(21), newDocUrl: "local://zero-2", retractDays: 0, now });
assert.equal(bothZero.ok, true);
assert.equal(bothZero.status, "pending");
assert.equal(bothZero.cooling, false);
assert.equal(bothZero.completed, false);
assert.equal(bothZero.finalHash, null);
assert.equal(settledState(bothZero.request).state, "awaiting_release");
assert.equal(canDownloadFinal(bothZero.request, Date.parse(now)), false);
assert.ok(isOpenSigningState("awaiting_release"));
const releasedAll = applyRelease(bothZero.store, bothZero.request.id, owner, { now });
assert.equal(releasedAll.ok, true);
assert.equal(releasedAll.status, "completed");
assert.equal(releasedAll.released, true);
assert.equal(releasedAll.request.finalHash, hash(21));
assert.equal(canDownloadFinal(releasedAll.request, Date.parse(now)), true);
assert.ok(releasedAll.request.auditTrail.some((event) => event.type === "released" && event.actorName === owner.name));
assert.ok(completionNotice(releasedAll.request, true).includes("اكتمل التوقيع"));
assert.ok(!bothZero.request.auditTrail.some((event) => event.type === "retract_window"));

const zeroThenRefuseCreate = applyCreate([], {
  companyId: "local-preview-nirovera",
  fileName: "بدون مهلة ثم رفض.pdf",
  verificationId: "PWC-ZERO-REFUSE",
  signers: [noura, hassan].map((row) => ({
    name: row.name,
    email: row.email,
    employeeId: row.id,
    role: row.role,
    stationId: row.stationId,
  })),
}, owner, { now, rid: (() => { let n = 0; return () => `zr${++n}`; })() });
const zrHassan = `${zeroThenRefuseCreate.request.id}.${zeroThenRefuseCreate.request.signers[1].token}`;
const zrNoura = `${zeroThenRefuseCreate.request.id}.${zeroThenRefuseCreate.request.signers[0].token}`;
const zeroSigned = applySubmit(zeroThenRefuseCreate.store, zrHassan, { fileHash: hash(31), newDocUrl: "local://zero-ref", retractDays: 0, now });
const zeroRefused = applyReject(zeroSigned.store, zrNoura, { reason: "لا يطابق المعاينة", now });
assert.equal(zeroRefused.ok, true);
assert.equal(zeroRefused.status, "pending");
assert.equal(zeroRefused.request.finalHash, null);
assert.equal(settledState(zeroRefused.request).state, "awaiting_release");
assert.equal(canDownloadFinal(zeroRefused.request, Date.parse(now)), false);
assert.equal(zeroRefused.request.signers.find((row) => row.email === hassan.email).status, "signed");
assert.equal(canRetractSigner(zeroRefused.request.signers.find((row) => row.email === hassan.email), Date.parse(now)), false);
assert.equal(zeroRefused.request.signers.find((row) => row.email === noura.email).status, "rejected");
const releasedMixed = applyRelease(zeroRefused.store, zeroRefused.request.id, owner, { now });
assert.equal(releasedMixed.ok, true);
assert.equal(releasedMixed.status, "completed_with_refusal");
assert.equal(releasedMixed.request.finalHash, hash(31));
assert.equal(canDownloadFinal(releasedMixed.request, Date.parse(now)), true);
assert.ok(completionNotice(releasedMixed.request, true).includes("اكتمل التوقيع مع رفض"));

const windowThenSilent = applyCreate([], {
  companyId: "local-preview-nirovera",
  fileName: "مهلة ثم صامت.pdf",
  verificationId: "PWC-RETRACT-SKIP",
  signers: [noura, hassan].map((row) => ({
    name: row.name,
    email: row.email,
    employeeId: row.id,
    role: row.role,
    stationId: row.stationId,
  })),
}, owner, { now, rid: (() => { let n = 0; return () => `rs${++n}`; })() });
const silentHassanToken = `${windowThenSilent.request.id}.${windowThenSilent.request.signers[1].token}`;
const twoDayCool = applySubmit(windowThenSilent.store, silentHassanToken, { fileHash: hash(22), newDocUrl: "local://cool", retractDays: 2, now });
assert.equal(twoDayCool.ok, true);
assert.equal(twoDayCool.retractDays, 2);
assert.equal(twoDayCool.cooling, true);
assert.equal(twoDayCool.status, "pending");
assert.equal(shouldSkipSilentAfterRetractClose(twoDayCool.request.signers, Date.parse(now)), false);
const afterSilentClose = new Date(Date.parse(now) + 2 * 86400000).toISOString();
const autoContinued = expireRetractWindows(twoDayCool.store, { now: afterSilentClose });
assert.equal(autoContinued.changed, true);
const deadlineNoura = autoContinued.store[0].signers.find((row) => row.email === noura.email);
assert.equal(deadlineNoura.status, "rejected");
assert.equal(deadlineNoura.rejectionCause, REFUSAL_DEADLINE);
assert.equal(deadlineNoura.rejectionReason, DEADLINE_REFUSAL_REASON);
assert.equal(refusalKindLabel(deadlineNoura, true), "رفض بانتهاء المدة");
assert.ok(autoContinued.store[0].auditTrail.some((event) => event.type === "rejected" && event.cause === REFUSAL_DEADLINE && event.targetName === noura.name && event.reason === DEADLINE_REFUSAL_REASON));
assert.ok(autoContinued.store[0].auditTrail.some((event) => event.type === "deadline_elapsed" && event.cause === REFUSAL_DEADLINE));
assert.ok(!autoContinued.store[0].auditTrail.some((event) => event.type === "skipped" && event.cause === "auto_window_closed"));
assert.equal(settleStatus(autoContinued.store[0].signers), "completed_with_refusal");
assert.equal(autoContinued.store[0].finalHash, null);
assert.equal(settledState(autoContinued.store[0], Date.parse(afterSilentClose)).state, "awaiting_release");
assert.equal(canDownloadFinal(autoContinued.store[0], Date.parse(afterSilentClose)), false);
assert.equal(shouldSkipSilentAfterRetractClose(autoContinued.store[0].signers, Date.parse(afterSilentClose)), false);
const releasedDeadline = applyRelease(autoContinued.store, autoContinued.store[0].id, owner, { now: afterSilentClose });
assert.equal(releasedDeadline.ok, true);
assert.equal(releasedDeadline.status, "completed_with_refusal");
assert.equal(releasedDeadline.request.finalHash, hash(22));

const retracted = applyRetract(signed.store, hassanToken, { reason: "تصحيح وصف الموقع", now: new Date(Date.parse(now) + 60_000).toISOString() });
assert.equal(retracted.ok, true);
assert.equal(retracted.status, "pending");
assert.equal(retracted.request.signers.find((row) => row.email === hassan.email).status, "pending");
assert.ok(retracted.request.auditTrail.some((event) => event.type === "retracted" && event.reason === "تصحيح وصف الموقع"));

const signedAgain = applySubmit(retracted.store, hassanToken, {
  fileHash: hash(10),
  newDocUrl: "local://signed-again",
  retractDays: 1,
  now,
});
assert.equal(signedAgain.ok, true);
assert.equal(signedAgain.cooling, true);

const afterClose = new Date(Date.parse(now) + 2 * 86400000).toISOString();
const tooLate = applyRetract(signedAgain.store, hassanToken, { now: afterClose });
assert.equal(tooLate.error, "RETRACT_CLOSED");

const expired = expireRetractWindows(signedAgain.store, { now: afterClose });
assert.equal(expired.changed, true);
assert.equal(expired.store[0].finalHash, null);
assert.ok(expired.store[0].auditTrail.some((event) => event.type === "retract_closed"));
assert.equal(settledState(expired.store[0], Date.parse(afterClose)).state, "awaiting_release");
assert.equal(settledState(expired.store[0], Date.parse(afterClose)).cooling, false);
assert.equal(canDownloadFinal(expired.store[0], Date.parse(afterClose)), false);

const oneSigned = applySubmit(created.store, hassanToken, { fileHash: hash(11), newDocUrl: "local://one", retractDays: 0, now });
const pushed = applyContinue(oneSigned.store, created.request.id, owner, { now, reason: "deadline" });
assert.equal(pushed.ok, true);
assert.equal(pushed.status, "completed_with_refusal");
assert.equal(pushed.request.signers.find((row) => row.email === noura.email).status, "skipped");
assert.ok(pushed.request.auditTrail.some((event) => event.type === "continued"));
assert.ok(pushed.request.auditTrail.some((event) => event.type === "released" && event.actorName === owner.name));
assert.ok(pushed.request.auditTrail.some((event) => event.type === "skipped" && event.targetName === noura.name));
assert.ok(refusalNote(pushed.request, true).includes("استمر الملف"));
assert.equal(canDownloadFinal(pushed.request, Date.parse(now)), true);
const lateSign = applySubmit(pushed.store, nouraToken, { fileHash: hash(12), now });
assert.equal(lateSign.error, "ALREADY_SIGNED");

const due = [{ ...created.request, expiresAt: now }];
const lapsed = expireRetractWindows(due, { now: new Date(Date.parse(now) + 1000).toISOString() });
assert.equal(lapsed.changed, true);
assert.ok(lapsed.store[0].auditTrail.some((event) => event.type === "lapsed"));
assert.ok(lapsed.store[0].signers.every((row) => row.status === "skipped"));
assert.equal(settleStatus(lapsed.store[0].signers), "rejected");

const deleteMissing = applyDelete(created.store, created.request.id, owner, { now });
assert.equal(deleteMissing.error, "REASON_REQUIRED");

const strangerDelete = applyDelete(created.store, created.request.id, omar, { now, reason: "لا" });
assert.equal(strangerDelete.error, "FORBIDDEN");

const deleted = applyDelete(created.store, created.request.id, owner, { now, reason: "أُرسل بالخطأ" });
assert.equal(deleted.ok, true);
assert.equal(deleted.status, "deleted");
assert.equal(deleted.request.status, "deleted");
assert.equal(deleted.request.deletedAt, now);
assert.equal(deleted.request.deletionReason, "أُرسل بالخطأ");
assert.equal(deleted.store.length, created.store.length);
assert.ok(deleted.request.auditTrail.some((event) => (
  event.type === "deleted"
  && event.reason === "أُرسل بالخطأ"
  && event.actorName === owner.name
  && event.actorId === owner.id
)));
assert.equal(settledState(deleted.request).state, "deleted");
assert.equal(settledState(deleted.request).settled, true);
assert.equal(stateLabel("deleted", true), "محذوف");
assert.equal(projectRequest(deleted.request, owner).status, "deleted");

const signAfterDelete = applySubmit(deleted.store, nouraToken, { fileHash: hash(99), now });
assert.equal(signAfterDelete.error, "REQUEST_CLOSED");
const rejectAfterDelete = applyReject(deleted.store, nouraToken, { reason: "متأخر", now });
assert.equal(rejectAfterDelete.error, "REQUEST_CLOSED");
const continueAfterDelete = applyContinue(deleted.store, created.request.id, owner, { now, reason: "deadline" });
assert.equal(continueAfterDelete.error, "REQUEST_CLOSED");
const reopenAfterDelete = applyReopen(deleted.store, created.request.id, owner, { signerEmail: noura.email, now });
assert.equal(reopenAfterDelete.error, "REQUEST_CLOSED");
assert.equal(createGateMessage("REQUEST_CLOSED", true), "الطلب محذوف أو مغلق — لا يُعاد فتحه.");
const retractAfterDelete = applyRetract(deleted.store, hassanToken, { now });
assert.equal(retractAfterDelete.error, "REQUEST_CLOSED");

const expireDeleted = expireRetractWindows(deleted.store, { now: afterClose });
assert.equal(expireDeleted.changed, false);
assert.equal(expireDeleted.store[0].status, "deleted");
assert.ok(expireDeleted.store[0].auditTrail.some((event) => event.type === "deleted"));

const strangerReopen = applyReopen(autoContinued.store, autoContinued.store[0].id, omar, { signerEmail: noura.email, now: afterSilentClose });
assert.equal(strangerReopen.error, "FORBIDDEN");
assert.equal(createGateMessage("FORBIDDEN", true), "هذا الإجراء للمنشئ فقط.");

const skipReopen = applyReopen(pushed.store, created.request.id, owner, { signerEmail: noura.email, now });
assert.equal(skipReopen.error, "NOT_REFUSED");
assert.equal(createGateMessage("NOT_REFUSED", true), "يُعاد الفتح لمن رُفض فقط.");

const reopenedDeadline = applyReopen(autoContinued.store, autoContinued.store[0].id, owner, { signerEmail: noura.email, now: afterSilentClose });
assert.equal(reopenedDeadline.ok, true);
assert.equal(reopenedDeadline.status, "pending");
const reopenedNoura = reopenedDeadline.request.signers.find((row) => row.email === noura.email);
assert.equal(reopenedNoura.status, "pending");
assert.equal(reopenedNoura.rejectionReason, null);
assert.equal(reopenedNoura.rejectionCause, null);
assert.equal(reopenedNoura.token, autoContinued.store[0].signers.find((row) => row.email === noura.email).token);
assert.ok(reopenedDeadline.request.auditTrail.some((event) => event.type === "rejected" && event.cause === REFUSAL_DEADLINE));
assert.ok(reopenedDeadline.request.auditTrail.some((event) => (
  event.type === "reopened"
  && event.actorName === owner.name
  && event.actorId === owner.id
  && event.targetName === noura.name
  && event.targetEmail === noura.email
  && event.priorCause === REFUSAL_DEADLINE
  && event.at === afterSilentClose
)));
const afterReopenToken = `${reopenedDeadline.request.id}.${reopenedNoura.token}`;
const signedAfterReopen = applySubmit(reopenedDeadline.store, afterReopenToken, { fileHash: hash(40), newDocUrl: "local://reopened", retractDays: 0, now: afterSilentClose });
assert.equal(signedAfterReopen.ok, true);
assert.equal(signedAfterReopen.request.signers.find((row) => row.email === noura.email).status, "signed");

const reopenedExplicit = applyReopen(signed.store, signed.request.id, owner, { signerEmail: noura.email, now });
assert.equal(reopenedExplicit.ok, true);
assert.equal(reopenedExplicit.request.signers.find((row) => row.email === noura.email).status, "pending");
assert.ok(reopenedExplicit.request.auditTrail.some((event) => event.type === "rejected" && event.cause === REFUSAL_EXPLICIT && event.reason === "الوصف لا يطابق الموقع"));
assert.ok(reopenedExplicit.request.auditTrail.some((event) => event.type === "reopened" && event.targetEmail === noura.email && event.priorCause === REFUSAL_EXPLICIT));

for (const days of [1, 3]) {
  const windowed = applyCreate([], {
    companyId: "local-preview-nirovera",
    fileName: `مهلة ${days}.pdf`,
    verificationId: `PWC-DAYS-${days}`,
    signers: [noura, hassan].map((row) => ({
      name: row.name,
      email: row.email,
      employeeId: row.id,
      role: row.role,
      stationId: row.stationId,
    })),
  }, owner, { now, rid: (() => { let n = 0; return () => `d${days}${++n}`; })() });
  const token = `${windowed.request.id}.${windowed.request.signers[1].token}`;
  const signedWindow = applySubmit(windowed.store, token, { fileHash: hash(50 + days), newDocUrl: `local://d${days}`, retractDays: days, now });
  assert.equal(shouldSkipSilentAfterRetractClose(signedWindow.request.signers, Date.parse(now)), false);
  const later = new Date(Date.parse(now) + days * 86400000).toISOString();
  const closed = expireRetractWindows(signedWindow.store, { now: later });
  const silent = closed.store[0].signers.find((row) => row.email === noura.email);
  assert.equal(silent.status, "rejected");
  assert.equal(silent.rejectionCause, REFUSAL_DEADLINE);
  assert.equal(silent.rejectionReason, DEADLINE_REFUSAL_REASON);
}

const parallel = applyCreate([], {
  companyId: "local-preview-nirovera",
  fileName: "توقيع بلا ترتيب.pdf",
  verificationId: "PWC-PARALLEL-ORDER",
  signers: [noura, sara, hassan].map((row) => ({
    name: row.name,
    email: row.email,
    employeeId: row.id,
    role: row.role,
    stationId: row.stationId,
  })),
}, owner, { now, rid: (() => { let n = 0; return () => `par${++n}`; })() });
assert.equal(parallel.ok, true);
assert.ok(parallel.request.signers.every((row) => canSignerSign(parallel.request, row)));
const thirdToken = `${parallel.request.id}.${parallel.request.signers[2].token}`;
const firstToken = `${parallel.request.id}.${parallel.request.signers[0].token}`;
const secondToken = `${parallel.request.id}.${parallel.request.signers[1].token}`;
const thirdFirst = applySubmit(parallel.store, thirdToken, { fileHash: hash(71), newDocUrl: "local://p1", retractDays: 0, now });
assert.equal(thirdFirst.ok, true);
assert.equal(thirdFirst.status, "pending");
assert.equal(canSignerSign(thirdFirst.request, thirdFirst.request.signers[0]), true);
assert.equal(canSignerSign(thirdFirst.request, thirdFirst.request.signers[1]), true);
assert.equal(canSignerSign(thirdFirst.request, thirdFirst.request.signers[2]), false);
const thenFirst = applySubmit(thirdFirst.store, firstToken, { fileHash: hash(72), newDocUrl: "local://p2", retractDays: 0, now });
assert.equal(thenFirst.ok, true);
assert.equal(thenFirst.status, "pending");
const thenSecond = applySubmit(thenFirst.store, secondToken, { fileHash: hash(73), newDocUrl: "local://p3", retractDays: 0, now });
assert.equal(thenSecond.ok, true);
assert.equal(thenSecond.status, "pending");
assert.equal(settledState(thenSecond.request).state, "awaiting_release");
assert.equal(canDownloadFinal(thenSecond.request, Date.parse(now)), false);
const releasedParallel = applyRelease(thenSecond.store, thenSecond.request.id, owner, { now });
assert.equal(releasedParallel.status, "completed");
assert.equal(canDownloadFinal(releasedParallel.request, Date.parse(now)), true);
assert.equal(signedAuditCount(thenSecond.request.auditTrail), 3);
assert.ok(thenSecond.request.auditTrail.filter((event) => event.type === "signed").every((event) => event.actorEmail && event.documentHash));
assert.ok([noura.name, sara.name, hassan.name].every((name) => thenSecond.request.auditTrail.some((event) => event.type === "signed" && event.actorName === name)));

const missingTrail = {
  signers: [
    { name: noura.name, email: noura.email, employeeId: noura.id, status: "signed", signedAt: now, documentHash: hash(80) },
    { name: sara.name, email: sara.email, employeeId: sara.id, status: "signed", signedAt: now, documentHash: hash(81) },
    { name: hassan.name, email: hassan.email, status: "pending" },
  ],
  auditTrail: [{ type: "created", at: now, actorName: owner.name }],
};
const restoredTrail = ensureSignedAudit(missingTrail.auditTrail, missingTrail.signers);
assert.equal(signedAuditCount(restoredTrail), 2);
assert.ok(restoredTrail.some((event) => event.type === "signed" && event.actorEmail === noura.email));
assert.ok(restoredTrail.some((event) => event.type === "signed" && event.actorEmail === sara.email));
assert.equal(projectRequest({ ...missingTrail, creatorId: owner.id, status: "pending" }, owner).auditTrail.filter((event) => event.type === "signed").length, 2);

const letterSpot = { id: "consent-sign", type: "signature", page: 1, x: 72, y: 84, scale: 100 };
const letterPack = applyCreate([], {
  companyId: "local-preview-nirovera",
  fileName: "شهادة-راتب.pdf",
  verificationId: "PWC-LETTER-SIGN",
  docUrl: "/signing-preview-pumps.pdf",
  signers: [{
    name: ahmed.name,
    email: ahmed.email,
    employeeId: ahmed.id,
    spots: [letterSpot],
  }],
}, owner, { now, rid: (() => { let n = 0; return () => `let${++n}`; })() });
assert.equal(letterPack.ok, true);
letterPack.request.kind = "salary_letter";
letterPack.request.otherRequestId = "oreq_letter";
assert.equal(letterPack.request.signers[0].spots[0].x, 72);
assert.equal(applyReject(letterPack.store, `${letterPack.request.id}.${letterPack.request.signers[0].token}`, { now }).error, "REASON_REQUIRED");
const letterRefused = applyReject(letterPack.store, `${letterPack.request.id}.${letterPack.request.signers[0].token}`, { reason: "الجهة لا تطابق الخطاب", now });
assert.equal(letterRefused.ok, true);
assert.equal(letterRefused.request.signers[0].status, "rejected");
assert.equal(letterRefused.request.signers[0].rejectionReason, "الجهة لا تطابق الخطاب");
const letterSigned = applySubmit(letterPack.store, `${letterPack.request.id}.${letterPack.request.signers[0].token}`, { fileHash: hash(90), newDocUrl: "local://letter-signed", retractDays: 0, now });
assert.equal(letterSigned.ok, true);
assert.equal(letterSigned.request.signers[0].status, "signed");

assert.equal(MAX_PARALLEL_SIGNERS, 100);
const stations = ["st_hq", "st_khafji", "st_dammam", "st_jeddah"];
const crowdParty = [];
for (let i = 0; i < 40; i += 1) {
  crowdParty.push({
    name: `موظف فرع ${i + 1}`,
    email: `branch${i + 1}@nirovera.local`,
    employeeId: `emp_b_${i + 1}`,
    role: i % 8 === 0 ? "station_manager" : "employee",
    stationId: stations[i % stations.length],
    spots: [{ id: `sig-b-${i}`, type: "signature", page: 1, x: 20 + (i % 8) * 8, y: 82, scale: 100 }],
  });
}
for (let i = 0; i < 15; i += 1) {
  crowdParty.push({
    name: `طرف خارجي ${i + 1}`,
    email: `guest${i + 1}@example.com`,
    employeeId: null,
    role: "",
    stationId: null,
    spots: [{ id: `sig-x-${i}`, type: "signature", page: 1, x: 72, y: 84, scale: 100 }],
  });
}
assert.equal(crowdParty.length, 55);
assert.equal(checkCreateGate({
  fileName: "تصريح-خمسون.pdf",
  verificationId: "PWC-CROWD-55",
  signers: crowdParty,
}).ok, true);

const crowd = applyCreate([], {
  companyId: "local-preview-nirovera",
  fileName: "تصريح-خمسون.pdf",
  verificationId: "PWC-CROWD-55",
  docUrl: "local://crowd",
  appUrl: "http://localhost:5173",
  signers: crowdParty,
}, owner, { now, rid: (() => { let n = 0; return () => `crowd${++n}`; })() });
assert.equal(crowd.ok, true);
assert.equal(crowd.request.signers.length, 55);
assert.equal(Object.keys(crowd.links).length, 55);
assert.equal(new Set(crowd.request.signers.filter((row) => row.employeeId).map((row) => row.stationId)).size, 4);
assert.equal(crowd.request.signers.filter((row) => !row.employeeId).length, 15);
assert.ok(crowd.request.signers.every((row) => canSignerSign(crowd.request, row)));
assert.ok(Object.values(crowd.links).every((url) => url.includes("/sign?token=")));

let crowdStore = crowd.store;
const crowdTokens = crowd.request.signers.map((row) => `${crowd.request.id}.${row.token}`);
for (let i = crowdTokens.length - 1; i >= 0; i -= 1) {
  const next = applySubmit(crowdStore, crowdTokens[i], {
    fileHash: hash(200 + i),
    newDocUrl: `local://crowd-${i}`,
    retractDays: 0,
    now,
  });
  assert.equal(next.ok, true, `crowd sign ${i}`);
  crowdStore = next.store;
}
const crowdDone = crowdStore.find((row) => row.verificationId === "PWC-CROWD-55");
assert.ok(crowdDone.signers.every((row) => row.status === "signed"));
assert.equal(signedAuditCount(crowdDone.auditTrail, crowdDone.signers), 55);
assert.equal(visibleToActor(crowdDone, { email: "guest1@example.com" }), true);
assert.equal(visibleToActor(crowdDone, { email: "branch12@nirovera.local" }), true);
assert.equal(visibleToActor(crowdDone, { email: "stranger@outside.test" }), false);
assert.equal(projectRequest(crowdDone, { email: "guest15@example.com" }).myStatus, "signed");

const overflow = Array.from({ length: MAX_PARALLEL_SIGNERS + 1 }, (_, i) => ({
  name: `زائد ${i + 1}`,
  email: `overflow${i + 1}@x.com`,
  spots: [{ id: "sig", type: "signature", page: 1, x: 50, y: 80, scale: 100 }],
}));
assert.equal(checkCreateGate({
  fileName: "a.pdf",
  verificationId: "PWC-CROWD-101",
  signers: overflow,
}).error, "SIGNERS_INVALID");

console.log("multisign dummy employees, send, status, refuse, deadline, reopen, retract, continue, delete, crowd-55 ok");
