import { addNotification, getCompanyData, settleWrittenConsentFromSigning, updateCompany } from "@/lib/store";
import { isRequestSigningPackage } from "@/lib/requestSigning";
import { isLocalPreviewActive, LOCAL_PREVIEW_COMPANY_ID } from "@/lib/localPreview";
import { registerLocalSignedDoc } from "@/lib/localSignedDocs";
import {
  applyContinue,
  applyCreate,
  completionNotice,
  completionNoticeRecipients,
  applyDelete,
  applyReject,
  applyReopen,
  applyRetract,
  applySelfSign,
  applySubmit,
  buildDummySignatureRequests,
  DUMMY_SIGNING_IDS,
  LOCAL_SIGNING_PREVIEW_DOC,
  dummySigningEmployees,
  resolveSigningDocUrl,
  canRetractSigner,
  canSignerSign,
  ensureSignedAudit,
  expireRetractWindows,
  publicAuditOf,
  isDeletedRequest,
  projectRequest,
  publicPartiesOf,
  settleStatus,
  settledState,
  visibleToActor,
} from "@/lib/multiSignDerivations";

const isLive = (row) => row?.fileName && Array.isArray(row.signers) && row.signers.length;

const rows = (companyId) => {
  const data = getCompanyData(companyId);
  return Array.isArray(data?.signatureRequests) ? data.signatureRequests : [];
};

const write = (companyId, next) => {
  updateCompany(companyId, (data) => {
    data.signatureRequests = next;
  });
};

export function writeSigningCompletionNotices(companyId, request, actor = {}, ar = true) {
  const { state } = settledState(request);
  if (state !== "completed" && state !== "completed_with_refusal") return [];
  const text = completionNotice(request, ar);
  const ids = new Set(completionNoticeRecipients(request));
  if (actor.id) ids.add(String(actor.id));
  if (actor.userId) ids.add(String(actor.userId));
  const have = new Set(
    (getCompanyData(companyId)?.notifications || []).map((row) => `${row.userId}::${row.text}`),
  );
  const written = [];
  ids.forEach((userId) => {
    if (!userId || have.has(`${userId}::${text}`)) return;
    addNotification(companyId, userId, text);
    have.add(`${userId}::${text}`);
    written.push(userId);
  });
  return written;
}

const notifyComplete = (companyId, request, actor, ar) => {
  writeSigningCompletionNotices(companyId, request, actor, ar);
};

const registerSettled = (companyId, requests) => {
  (requests || []).forEach((request) => {
    if (!request?.finalHash || !request.verificationId) return;
    registerLocalSignedDoc(companyId, {
      verificationId: request.verificationId,
      fileHash: request.finalHash,
      signerName: (request.signers || []).filter((row) => row.status === "signed").map((row) => row.name).join(", "),
      signerId: request.creatorId,
      fileName: request.fileName,
    });
  });
};

export function ensureDummySignatureRequests(companyId, actor, employees) {
  const extras = dummySigningEmployees();
  updateCompany(companyId, (data) => {
    const have = new Set((data.employees || []).map((row) => String(row.email || "").toLowerCase()));
    extras.forEach((row) => {
      if (have.has(row.email)) return;
      data.employees = [...(data.employees || []), { ...row, createdAt: new Date().toISOString(), leaveRequests: [], profile: {} }];
    });
  });
  const current = rows(companyId);
  if (current.some(isLive)) {
    // Never rebuild live rows — a refuse, reopen or delete must survive the next list().
    let store = expireRetractWindows(current).store;
    const dummyIds = new Set(DUMMY_SIGNING_IDS);
    const missingPreview = store.some((row) => dummyIds.has(row.id) && !row.docUrl);
    if (missingPreview) {
      store = store.map((row) => (dummyIds.has(row.id) && !row.docUrl ? { ...row, docUrl: LOCAL_SIGNING_PREVIEW_DOC } : row));
      write(companyId, store);
    }
    const onlyDummies = store.length > 0 && store.every((row) => dummyIds.has(row.id));
    if (onlyDummies) {
      const seeded = buildDummySignatureRequests({
        companyId,
        actor,
        employees: employees?.length ? [...employees, ...extras] : extras,
      });
      const extrasToAdd = seeded.filter((row) => !store.some((item) => item.id === row.id));
      if (extrasToAdd.length) {
        store = [...store, ...extrasToAdd];
        write(companyId, store);
      }
    }
    seedCompletionNotices(companyId, actor, store);
    return store;
  }
  const seeded = buildDummySignatureRequests({
    companyId,
    actor,
    employees: employees?.length ? [...employees, ...extras] : extras,
  });
  write(companyId, seeded);
  seedCompletionNotices(companyId, actor, seeded);
  return rows(companyId).some(isLive) ? rows(companyId) : seeded;
}

function seedCompletionNotices(companyId, actor, store) {
  (store || []).forEach((request) => writeSigningCompletionNotices(companyId, request, actor, true));
}

export function listLocalSignatureRequests(companyId, actor, employees) {
  const store = ensureDummySignatureRequests(companyId, actor, employees);
  return store.filter((row) => visibleToActor(row, actor)).map((row) => projectRequest(row, actor));
}

function resolveStore(companyId, token) {
  const ids = [companyId, LOCAL_PREVIEW_COMPANY_ID].filter(Boolean);
  if (token) {
    const id = String(token).split(".")[0];
    for (const cid of ids) {
      const list = rows(cid);
      if (list.some((row) => row.id === id)) return { companyId: cid, store: list };
    }
  }
  const cid = companyId || LOCAL_PREVIEW_COMPANY_ID;
  return { companyId: cid, store: rows(cid) };
}

export function invokeLocalMultiSign(body = {}, { actor, employees } = {}) {
  const action = body.action;
  const resolved = resolveStore(String(body.companyId || actor?.companyId || ""), body.token);
  const companyId = resolved.companyId;
  const rawStore = action === "list" || action === "create"
    ? ensureDummySignatureRequests(companyId, actor, employees)
    : resolved.store;
  const expired = expireRetractWindows(rawStore);
  if (expired.changed) write(companyId, expired.store);
  const store = expired.store;
  registerSettled(companyId, store);

  if (action === "list") {
    return { requests: store.filter((row) => visibleToActor(row, actor)).map((row) => projectRequest(row, actor)) };
  }

  if (action === "create") {
    const result = applyCreate(store, { ...body, companyId }, actor);
    if (!result.ok) return { error: result.error, reason: result.reason };
    write(companyId, result.store);
    return { ok: true, requestId: result.request.id, links: result.links, emailFailed: result.emailFailed, local: true };
  }

  if (action === "selfSign") {
    const result = applySelfSign(store, { ...body, companyId }, actor);
    if (!result.ok) return { error: result.error, reason: result.reason };
    write(companyId, result.store);
    registerSettled(companyId, [result.request]);
    if (result.notifyComplete) notifyComplete(companyId, result.request, actor, body.lang === "ar");
    return {
      ok: true,
      requestId: result.request.id,
      status: result.status,
      completed: result.completed,
      finalHash: result.finalHash,
      local: true,
    };
  }

  if (action === "delete") {
    const result = applyDelete(store, body.requestId, actor, { reason: body.reason });
    if (!result.ok) return { error: result.error, reason: result.reason };
    write(companyId, result.store);
    return { ok: true, status: result.status };
  }

  if (action === "remind") {
    const rec = store.find((row) => row.id === body.requestId);
    if (!rec) return { error: "Not found" };
    if (isDeletedRequest(rec)) return { error: "REQUEST_CLOSED" };
    const signer = (rec.signers || []).find((row) => row.email === String(body.signerEmail || "").toLowerCase() && row.status === "pending");
    if (!signer) return { error: "Pending signer not found" };
    const now = new Date().toISOString();
    const next = {
      ...rec,
      lastActivityAt: now,
      auditTrail: [...(rec.auditTrail || []), { type: "reminder_sent", at: now, actorName: actor?.name, targetName: signer.name, targetEmail: signer.email }],
    };
    write(companyId, store.map((row) => (row.id === rec.id ? next : row)));
    return { ok: true, signerEmail: signer.email, local: true };
  }

  if (action === "getByToken") {
    const list = isLocalPreviewActive() && !store.some(isLive)
      ? ensureDummySignatureRequests(companyId, actor, employees)
      : store;
    const [id, part] = String(body.token || "").split(".");
    const rec = list.find((row) => row.id === id);
    const signer = rec?.signers?.find((row) => row.token === part);
    if (!rec || !signer) return { error: "Invalid or expired signing link" };
    const deleted = isDeletedRequest(rec);
    const pending = (rec.signers || []).filter((row) => row.status === "pending");
    return {
      fileName: rec.fileName,
      creatorName: rec.creatorName,
      docUrl: resolveSigningDocUrl(rec),
      status: deleted ? "deleted" : (rec.status || settleStatus(rec.signers)),
      deletionReason: rec.deletionReason || null,
      expiresAt: rec.expiresAt,
      verificationId: rec.verificationId,
      finalHash: rec.finalHash || null,
      signer: {
        name: signer.name,
        email: signer.email,
        status: signer.status,
        employeeId: signer.employeeId || null,
        role: signer.role || "",
        stationId: signer.stationId || null,
        signatureUrl: signer.signatureUrl || "",
        stampTheme: "heritage",
        stampConfig: signer.stampConfig || null,
        spot: signer.spot || null,
        spots: signer.spots || [],
        retractDays: signer.retractDays ?? null,
        retractUntil: signer.retractUntil || null,
        canRetract: !deleted && canRetractSigner(signer),
        rejectionReason: signer.rejectionReason || null,
        rejectionCause: signer.rejectionCause || null,
      },
      rejectionReason: rec.rejectionReason || signer.rejectionReason || null,
      signedCount: (rec.signers || []).filter((row) => row.status === "signed").length,
      pendingCount: (rec.signers || []).filter((row) => row.status === "pending").length,
      totalCount: (rec.signers || []).length,
      canSign: canSignerSign(rec, signer),
      canRetract: !deleted && canRetractSigner(signer),
      isLast: signer.status === "pending" && pending.length === 1,
      signerNames: (rec.signers || []).map((row) => row.name).join(", "),
      parties: publicPartiesOf(rec.signers, part),
      auditTrail: publicAuditOf(ensureSignedAudit(rec.auditTrail, rec.signers)),
    };
  }

  if (action === "reject") {
    const result = applyReject(store, body.token, { reason: body.reason });
    if (!result.ok) return { error: result.error, reason: result.reason };
    write(companyId, result.store);
    registerSettled(companyId, [result.request]);
    if (isRequestSigningPackage(result.request)) {
      settleWrittenConsentFromSigning(companyId, {
        requestId: result.request.id,
        token: body.token,
        accept: false,
        note: body.reason,
      });
    }
    return { ok: true, reason: body.reason, status: result.status };
  }

  if (action === "submitSignature") {
    const result = applySubmit(store, body.token, {
      fileHash: body.fileHash,
      newDocUrl: body.newDocUrl,
      textValues: body.textValues,
      retractDays: body.retractDays,
    });
    if (!result.ok) return { error: result.error, reason: result.reason };
    write(companyId, result.store);
    registerSettled(companyId, [result.request]);
    if (isRequestSigningPackage(result.request)) {
      settleWrittenConsentFromSigning(companyId, {
        requestId: result.request.id,
        token: body.token,
        accept: true,
        docUrl: body.newDocUrl,
      });
    }
    if (result.notifyComplete) notifyComplete(companyId, result.request, actor, body.lang === "ar");
    return {
      ok: true,
      completed: result.completed,
      status: result.status,
      cooling: result.cooling,
      retractDays: result.retractDays,
      retractUntil: result.retractUntil,
      docUrl: body.newDocUrl,
      finalHash: result.finalHash,
    };
  }

  if (action === "retractSignature") {
    const result = applyRetract(store, body.token, { reason: body.reason });
    if (!result.ok) return { error: result.error, reason: result.reason };
    write(companyId, result.store);
    return { ok: true, status: result.status, retracted: true };
  }

  if (action === "continueWithout" || action === "release") {
    const result = applyContinue(store, body.requestId, actor, { reason: body.reason });
    if (!result.ok) return { error: result.error, reason: result.reason };
    write(companyId, result.store);
    registerSettled(companyId, [result.request]);
    if (result.notifyComplete) notifyComplete(companyId, result.request, actor, body.lang === "ar");
    return { ok: true, status: result.status, continued: true, released: result.released, notifyComplete: result.notifyComplete };
  }

  if (action === "reopen") {
    const result = applyReopen(store, body.requestId, actor, { signerEmail: body.signerEmail });
    if (!result.ok) return { error: result.error, reason: result.reason };
    write(companyId, result.store);
    return { ok: true, status: result.status, reopened: true };
  }

  return { error: "Unknown action" };
}

export function shouldUseLocalMultiSign() {
  return isLocalPreviewActive();
}
