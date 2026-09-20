/**
 * Shared multi-party signing rules. The cloud function and the local preview
 * fallback both settle a request the same way: a refusal never stops the file;
 * remaining parties keep signing. Silence does not block the file: the creator
 * can continue without the rest (skipped). A mixed outcome is
 * "completed with refusal" (refused and/or skipped).
 *
 * The file does not close — and the final copy cannot be downloaded — until
 * the creator releases it. Signing is always parallel. List order and
 * currentSignerIndex are placement / progress only.
 */

export const emailValid = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || "").trim());
export const MAX_PARALLEL_SIGNERS = 100;

export function settleStatus(signers) {
  const rows = Array.isArray(signers) ? signers : [];
  if (rows.some((row) => row.status === "pending")) return "pending";
  if (rows.every((row) => row.status === "signed")) return "completed";
  if (rows.some((row) => row.status === "signed")) return "completed_with_refusal";
  return "rejected";
}

export const isRegistrable = (status) => status === "completed" || status === "completed_with_refusal";

export function isOpenSigningState(state) {
  return state === "pending" || state === "awaiting_release";
}

/** Legacy rows closed before the creator-release gate still count as released. */
export function isReleased(request) {
  if (!request || isDeletedRequest(request)) return false;
  if (request.releasedAt) return true;
  const status = request.status;
  return status === "completed" || status === "completed_with_refusal" || status === "rejected";
}

export function canDownloadFinal(request, now = Date.now()) {
  if (!request?.docUrl) return false;
  const { state, cooling } = settledState(request, now);
  return (state === "completed" || state === "completed_with_refusal") && !cooling;
}

export function completionNotice(request, ar) {
  const { state, signed, total } = settledState(request);
  const name = request?.fileName || (ar ? "المستند" : "the document");
  if (state === "completed_with_refusal") {
    return ar
      ? `اكتمل التوقيع مع رفض: ${name} — وقّع ${signed} من ${total}. يمكن تنزيل النسخة النهائية.`
      : `Signing completed with a refusal: ${name} — ${signed} of ${total} signed. The final copy can be downloaded.`;
  }
  if (state === "rejected") {
    return ar
      ? `أُغلق طلب التوقيع دون نسخة نهائية: ${name}.`
      : `The signing request closed without a final copy: ${name}.`;
  }
  return ar
    ? `اكتمل التوقيع: ${name} — يمكن تنزيل النسخة النهائية.`
    : `Signing completed: ${name} — the final copy can be downloaded.`;
}

export function completionNoticeRecipients(request) {
  const ids = new Set();
  if (request?.creatorId) ids.add(String(request.creatorId));
  (request?.signers || []).forEach((row) => {
    if (row.employeeId) ids.add(String(row.employeeId));
  });
  return [...ids];
}

function creatorIsSoleSigner(request, signers) {
  const rows = signers || [];
  if (rows.length !== 1) return false;
  const row = rows[0];
  const creatorId = String(request?.creatorId || "");
  const creatorEmail = String(request?.creatorEmail || "").toLowerCase();
  return (row.employeeId && String(row.employeeId) === creatorId)
    || (row.email && String(row.email).toLowerCase() === creatorEmail);
}

export const RETRACT_DAY_OPTIONS = [0, 1, 2, 3];
export const REFUSAL_EXPLICIT = "explicit";
export const REFUSAL_DEADLINE = "deadline_elapsed";
export const DEADLINE_REFUSAL_REASON = "رفض بانتهاء المدة";
const DAY_MS = 86400000;

export function refusalCauseOf(signer) {
  if (!signer || signer.status !== "rejected") return signer?.rejectionCause || null;
  if (signer.rejectionCause === REFUSAL_DEADLINE || signer.rejectionReason === DEADLINE_REFUSAL_REASON) return REFUSAL_DEADLINE;
  return signer.rejectionCause || REFUSAL_EXPLICIT;
}

export function refusalKindLabel(signerOrCause, ar) {
  const cause = typeof signerOrCause === "string" ? signerOrCause : refusalCauseOf(signerOrCause);
  if (cause === REFUSAL_DEADLINE) return ar ? "رفض بانتهاء المدة" : "Refused — deadline elapsed";
  return ar ? "رفض" : "Refused";
}

/** Public /sign projection — names and status only, never tokens or emails. */
export function publicPartiesOf(signers, token) {
  return (signers || []).map((row) => ({
    name: row.name,
    status: row.status || "pending",
    rejectionCause: row.status === "rejected" ? refusalCauseOf(row) : null,
    you: Boolean(token) && row.token === token,
  }));
}

export function partyStatusLabel(party, ar) {
  if (party?.status === "signed") return ar ? "وقّع" : "Signed";
  if (party?.status === "rejected") return refusalKindLabel(party.rejectionCause || party, ar);
  if (party?.status === "skipped") return ar ? "لم يوقّع" : "Unsigned";
  if (party?.you) return ar ? "أنت · بانتظار" : "You · waiting";
  return ar ? "بانتظار" : "Waiting";
}

export function partiesFromPublicInfo(info) {
  if (Array.isArray(info?.parties) && info.parties.length) return info.parties;
  return String(info?.signerNames || "")
    .split(/,\s*/)
    .filter(Boolean)
    .map((name) => ({
      name,
      status: name === info?.signer?.name ? (info.signer.status || "pending") : "pending",
      rejectionCause: name === info?.signer?.name ? (info.signer.rejectionCause || null) : null,
      you: name === info?.signer?.name,
    }));
}

export function clampRetractDays(value) {
  const days = Math.round(Number(value));
  return RETRACT_DAY_OPTIONS.includes(days) ? days : 1;
}

export function retractDaysLabel(days, ar) {
  const n = clampRetractDays(days);
  if (n === 0) return ar ? "بدون مهلة" : "No window";
  if (ar) return n === 2 ? "يومين" : n === 3 ? "ثلاثة أيام" : "يوم واحد";
  return n === 1 ? "1 day" : `${n} days`;
}

export function retractUntilAt(signedAt, days) {
  const n = clampRetractDays(days);
  if (n === 0) return null;
  const start = Date.parse(signedAt);
  if (!Number.isFinite(start)) return null;
  return new Date(start + n * DAY_MS).toISOString();
}

export function canRetractSigner(signer, now = Date.now()) {
  if (!signer || signer.status !== "signed" || !signer.retractUntil) return false;
  const stamp = typeof now === "number" ? now : Date.parse(now);
  return Date.parse(signer.retractUntil) > stamp;
}

export function openRetractWindows(signers, now = Date.now()) {
  return (signers || []).filter((row) => canRetractSigner(row, now));
}

export function coolingUntilOf(signers, now = Date.now()) {
  const open = openRetractWindows(signers, now)
    .map((row) => Date.parse(row.retractUntil))
    .filter(Number.isFinite);
  if (!open.length) return null;
  return new Date(Math.max(...open)).toISOString();
}

export function lastSignedHash(signers) {
  return (signers || [])
    .filter((row) => row.status === "signed" && row.documentHash && row.signedAt)
    .sort((a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime())
    .pop()?.documentHash || null;
}

export function refusalLines(signers, ar) {
  return (signers || [])
    .filter((row) => row.status === "rejected")
    .map((row) => {
      const kind = refusalKindLabel(row, ar);
      const detail = row.rejectionReason && row.rejectionReason !== DEADLINE_REFUSAL_REASON ? row.rejectionReason : "";
      return detail ? `${row.name} — ${kind}: ${detail}` : `${row.name} — ${kind}`;
    })
    .join("\n");
}

export function normalizeSpots(signer) {
  const raw = Array.isArray(signer?.spots) && signer.spots.length
    ? signer.spots
    : signer?.spot
      ? [{ ...signer.spot, type: "signature" }]
      : [{ id: "auto-signature", type: "signature", page: 1, x: 75, y: 88, scale: 100 }];
  return raw.slice(0, 30).map((field, index) => ({
    id: String(field.id || `field-${index}`).slice(0, 80),
    type: field.type === "text" ? "text" : "signature",
    label: String(field.label || "").slice(0, 60),
    required: field.required !== false,
    page: Math.max(1, Number(field.page) || 1),
    x: Math.min(100, Math.max(0, Number(field.x) || 0)),
    y: Math.min(100, Math.max(0, Number(field.y) || 0)),
    scale: Math.min(200, Math.max(50, Number(field.scale) || 100)),
    tool: String(field.tool || "").slice(0, 20),
  }));
}

export function normalizeIncomingSigners(signersIn) {
  const rows = (Array.isArray(signersIn) ? signersIn.slice(0, MAX_PARALLEL_SIGNERS) : [])
    .map((signer) => {
      const spots = normalizeSpots(signer);
      return {
        token: String(signer.token || "").slice(0, 64),
        name: String(signer.name || "").trim().slice(0, 120),
        email: String(signer.email || "").toLowerCase().trim().slice(0, 160),
        status: "pending",
        signedAt: null,
        rejectedAt: null,
        employeeId: String(signer.employeeId || "").slice(0, 64) || null,
        role: String(signer.role || "").slice(0, 80),
        stationId: String(signer.stationId || "").slice(0, 64) || null,
        signatureUrl: String(signer.signatureUrl || "").slice(0, 2000),
        spots,
        spot: spots.find((field) => field.type === "signature") || null,
      };
    })
    .filter((row, index, list) => (
      row.name
      && row.spot
      && emailValid(row.email)
      && list.findIndex((other) => other.email === row.email) === index
    ));
  return rows;
}

export function checkCreateGate(payload) {
  const signersIn = Array.isArray(payload?.signers) ? payload.signers : [];
  const signers = normalizeIncomingSigners(signersIn);
  if (!String(payload?.fileName || "").toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "PDF_REQUIRED", reason: "A PDF document is required" };
  }
  if (!String(payload?.verificationId || "").trim()) {
    return { ok: false, error: "VERIFICATION_REQUIRED", reason: "A verification id is required" };
  }
  if (!signers.length) {
    return {
      ok: false,
      error: signersIn.length ? "SIGNERS_INVALID" : "SIGNERS_REQUIRED",
      reason: "A valid, unique email for every signer is required",
    };
  }
  if (signers.length !== signersIn.length) {
    return { ok: false, error: "SIGNERS_INVALID", reason: "A PDF document and a valid, unique email for every signer are required" };
  }
  return { ok: true, signers };
}

export function createGateMessage(error, ar) {
  const text = String(error || "");
  const copy = {
    PDF_REQUIRED: { ar: "يلزم ملف PDF.", en: "A PDF document is required." },
    VERIFICATION_REQUIRED: { ar: "رقم التحقق مطلوب.", en: "A verification id is required." },
    SIGNERS_REQUIRED: { ar: "أضف موقّعًا واحدًا على الأقل ببريد صالح.", en: "Add at least one signer with a valid email." },
    SIGNERS_INVALID: { ar: "كل موقّع يحتاج اسمًا وبريدًا صالحًا وغير مكرر.", en: "Every signer needs a unique valid name and email." },
    SIGNATURE_REUSE: { ar: "رقم التحقق مرتبط بملف آخر — لا يُعاد استخدامه.", en: "This verification id is already bound to a file." },
    FORBIDDEN: { ar: "هذا الإجراء للمنشئ فقط.", en: "Only the creator can do this." },
    REQUEST_CLOSED: { ar: "الطلب محذوف أو مغلق — لا يُعاد فتحه.", en: "This request is deleted or closed — it cannot be reopened." },
    NOT_REFUSED: { ar: "يُعاد الفتح لمن رُفض فقط.", en: "Reopen is only for a party who refused." },
    REASON_REQUIRED: { ar: "سبب الرفض مطلوب ويُحفظ في سجل التدقيق.", en: "A refusal reason is required and is stored in the audit trail." },
    ALREADY_RELEASED: { ar: "المنشئ مرّر هذا الملف مسبقًا.", en: "The creator has already released this file." },
    COOLING: { ar: "مهلة التراجع ما زالت مفتوحة — التمرير بعد إغلاقها.", en: "A retract window is still open — release after it closes." },
    NOT_READY: { ar: "لا يُمرَّر الملف قبل ردّ الأطراف أو متابعة دون الباقي.", en: "The file cannot be released until parties have answered or the creator continues without the rest." },
  };
  const code = Object.keys(copy).find((key) => text.includes(key));
  const row = code ? copy[code] : null;
  return row ? (ar ? row.ar : row.en) : "";
}

export function isDeletedRequest(request) {
  return Boolean(request) && (request.status === "deleted" || Boolean(request.deletedAt));
}

export function requestAcceptsSignatures(request) {
  if (!request || isDeletedRequest(request)) return false;
  const status = request.status || settleStatus(request.signers);
  const pending = (request.signers || []).filter((row) => row.status === "pending");
  return status === "pending" || (status === "rejected" && pending.length > 0);
}

/** Any pending party may sign now. Index, list order, and signingMode are ignored. */
export function canSignerSign(request, signer) {
  return requestAcceptsSignatures(request) && signer?.status === "pending";
}

export function signedAuditEvent(signer, extras = {}) {
  return {
    type: "signed",
    at: extras.at || signer?.signedAt || new Date().toISOString(),
    actorName: signer?.name || extras.actorName || "",
    actorEmail: signer?.email || extras.actorEmail || "",
    actorId: signer?.employeeId || extras.actorId || null,
    actorRole: signer?.role || extras.actorRole || "signer",
    documentHash: extras.documentHash || signer?.documentHash || null,
    retractDays: extras.retractDays ?? signer?.retractDays ?? null,
    retractUntil: extras.retractUntil || signer?.retractUntil || null,
    location: extras.location || null,
  };
}

function sameSignedParty(event, signer) {
  if (event?.type !== "signed" || !signer) return false;
  const email = String(event.actorEmail || event.targetEmail || "").toLowerCase();
  const signerEmail = String(signer.email || "").toLowerCase();
  if (email && signerEmail && email === signerEmail) return true;
  if (event.actorId && signer.employeeId && String(event.actorId) === String(signer.employeeId)) return true;
  return Boolean(event.actorName && event.actorName === signer.name);
}

/** Display/store guarantee: every signed party has a named audit row. */
export function ensureSignedAudit(trail, signers) {
  const events = Array.isArray(trail) ? trail.filter(Boolean) : [];
  (signers || []).forEach((signer) => {
    if (signer.status !== "signed") return;
    if (events.some((event) => sameSignedParty(event, signer))) return;
    events.push(signedAuditEvent(signer));
  });
  return events;
}

export function publicAuditOf(events) {
  return (events || []).map((event) => ({
    type: event.type,
    at: event.at,
    actorName: event.actorName || "",
    actorRole: event.actorRole || "",
    targetName: event.targetName || "",
    documentHash: event.documentHash || null,
    retractDays: event.retractDays ?? null,
    retractUntil: event.retractUntil || null,
    reason: event.reason || "",
    cause: event.cause || null,
  }));
}

export function signedAuditCount(events) {
  return (events || []).filter((event) => event.type === "signed").length;
}

export function settledState(request, now = Date.now()) {
  const rows = request.signers || [];
  const signed = request.signedCount ?? rows.filter((row) => row.status === "signed").length;
  const rejected = request.rejectedCount ?? rows.filter((row) => row.status === "rejected").length;
  const skipped = request.skippedCount ?? rows.filter((row) => row.status === "skipped").length;
  const pending = request.pendingCount ?? rows.filter((row) => row.status === "pending").length;
  const total = request.totalCount ?? rows.length;
  if (isDeletedRequest(request)) {
    return { signed, rejected, skipped, pending, total, state: "deleted", settled: true, cooling: false, coolingUntil: null };
  }
  const coolingUntil = coolingUntilOf(rows, now);
  const cooling = pending === 0 && !!coolingUntil;
  const outcome = pending > 0 || cooling
    ? "pending"
    : signed === total
      ? "completed"
      : signed > 0
        ? "completed_with_refusal"
        : "rejected";
  const released = outcome === "pending" ? false : isReleased(request);
  const state = outcome === "pending"
    ? "pending"
    : released
      ? outcome
      : "awaiting_release";
  return {
    signed,
    rejected,
    skipped,
    pending,
    total,
    state,
    settled: released && outcome !== "pending",
    awaitingRelease: state === "awaiting_release",
    cooling,
    coolingUntil,
  };
}

/** Command Center counts — same gates as SigningHome chips. Never invent figures. */
export function commandSigningSnapshot(requests = [], now = Date.now()) {
  const month = new Date(now).toISOString().slice(0, 7);
  const snap = { total: 0, mine: 0, open: 0, done: 0, archive: 0, cooling: 0, reopen: 0, parallel: 0 };
  for (const row of requests || []) {
    snap.total += 1;
    const { state, cooling } = settledState(row, now);
    if ((row.signers || []).length > 1) snap.parallel += 1;
    if (isOpenSigningState(state)) {
      snap.open += 1;
      if (row.myStatus === "pending") snap.mine += 1;
      if (cooling) snap.cooling += 1;
    } else {
      snap.archive += 1;
      if (String(row.lastActivityAt || row.completedAt || row.updatedAt || "").slice(0, 7) === month) snap.done += 1;
    }
    if (row.isCreator && (row.signers || []).some((signer) => signer.status === "rejected")) snap.reopen += 1;
  }
  return snap;
}

export function stateLabel(state, ar, cooling = false, extras = {}) {
  if (state === "deleted") return ar ? "محذوف" : "Deleted";
  if (cooling) return ar ? "مهلة تراجع" : "Retract window";
  if (state === "awaiting_release") return ar ? "بانتظار تمرير المنشئ" : "Awaiting creator release";
  if (state === "completed") return ar ? "مكتمل" : "Completed";
  if (state === "completed_with_refusal") {
    if (extras.skipped && !extras.rejected) return ar ? "مكتمل دون توقيع الكل" : "Closed without every signature";
    return ar ? "مكتمل مع رفض" : "Completed with refusal";
  }
  if (state === "rejected") return extras.skipped && !extras.rejected
    ? (ar ? "أُغلق دون توقيع" : "Closed unsigned")
    : (ar ? "رفضه الجميع" : "Refused by all");
  return ar ? "جارٍ التوقيع" : "In progress";
}

export function retractAlert(request, ar, now = Date.now()) {
  const open = openRetractWindows(request.signers, now);
  if (!open.length) return "";
  const named = open.map((row) => {
    const until = new Date(row.retractUntil).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    return ar
      ? `${row.name} — ${retractDaysLabel(row.retractDays || 1, true)} حتى ${until}`
      : `${row.name} — ${retractDaysLabel(row.retractDays || 1, false)} until ${until}`;
  }).join(ar ? " · " : " · ");
  return ar
    ? `تنبيه للمرسل: يمكن التراجع عن التوقيع خلال المهلة المحددة — ${named}. بعد انتهائها يُغلق التراجع ويُثبت في السجل.`
    : `Sender alert: a signature can still be retracted within its chosen window — ${named}. After that the retraction closes and the audit trail keeps it.`;
}

export function refusalsOf(request) {
  if (Array.isArray(request.refusals) && request.refusals.length) return request.refusals;
  return (request.signers || [])
    .filter((row) => row.status === "rejected")
    .map((row) => ({
      name: row.name,
      email: row.email,
      at: row.rejectedAt || null,
      reason: row.rejectionReason || request.rejectionReason || null,
      cause: refusalCauseOf(row),
    }));
}

export function skippedOf(request) {
  return (request.signers || [])
    .filter((row) => row.status === "skipped")
    .map((row) => ({ name: row.name, email: row.email, at: row.skippedAt || null, reason: row.skipReason || null, cause: row.skipCause || null }));
}

export function refusalNote(request, ar) {
  const { state, signed, total } = settledState(request);
  const refusals = refusalsOf(request);
  const skipped = skippedOf(request);
  const parts = [];
  if (refusals.length) {
    const named = refusals
      .map((row) => {
        const kind = refusalKindLabel(row.cause || row, ar);
        const detail = row.reason && row.reason !== DEADLINE_REFUSAL_REASON ? row.reason : "";
        return detail ? `${row.name} — ${kind}: ${detail}` : `${row.name} — ${kind}`;
      })
      .join(" · ");
    if (state === "pending" || state === "awaiting_release") {
      parts.push(ar
        ? `رفض ${refusals.length === 1 ? refusals[0].name : `${refusals.length} موقّعين`}: ${named}. المستند لم يتوقف — بقية الموقّعين يواصلون، والتنزيل بعد تمرير المنشئ.`
        : `Refused by ${refusals.length === 1 ? refusals[0].name : `${refusals.length} signers`}: ${named}. The document has not stopped — the remaining signers continue, and download waits for the creator.`);
    } else if (state === "completed_with_refusal") {
      parts.push(ar
        ? `أُغلق بحالة «مكتمل مع رفض» — وقّعه ${signed} من ${total}، وسبب الرفض: ${named}.`
        : `Closed as “completed with refusal” — signed by ${signed} of ${total}. Reason for refusal: ${named}.`);
    } else {
      parts.push(ar ? `رفض جميع الموقّعين: ${named}.` : `Every signer refused: ${named}.`);
    }
  }
  if (skipped.length) {
    const named = skipped.map((row) => row.name).join(ar ? " · " : " · ");
    parts.push(ar
      ? `استمر الملف دون توقيع: ${named}. الإجراء في سجل التدقيق.`
      : `The file continued without signatures from: ${named}. The action is in the audit trail.`);
  }
  return parts.join(" ");
}

export function projectRequest(record, actor = {}) {
  const userId = String(actor.userId || actor.id || "");
  const email = String(actor.email || "").toLowerCase();
  const rows = record.signers || [];
  const mySigner = rows.find((row) => row.email === email);
  const derived = settledState(record);
  const status = isDeletedRequest(record) ? "deleted" : derived.state === "awaiting_release" ? "pending" : derived.state;
  const isCreator = record.creatorId === userId || (!!email && record.creatorEmail === email);
  return {
    id: record.id,
    fileName: record.fileName,
    creatorName: record.creatorName,
    status,
    settled: derived.settled,
    awaitingRelease: derived.awaitingRelease,
    releasedAt: record.releasedAt || null,
    canDownloadFinal: canDownloadFinal(record),
    canRelease: isCreator && derived.awaitingRelease,
    deletedAt: record.deletedAt || null,
    deletionReason: record.deletionReason || null,
    createdAt: record.createdAt || record.created_date,
    lastActivityAt: record.lastActivityAt || record.updated_date || record.createdAt,
    docUrl: record.docUrl,
    stationId: record.stationId || null,
    currentSignerIndex: record.currentSignerIndex || 0,
    rejectionReason: record.rejectionReason || null,
    verificationId: record.verificationId || null,
    finalHash: record.finalHash || null,
    totalCount: rows.length,
    signedCount: rows.filter((row) => row.status === "signed").length,
    rejectedCount: rows.filter((row) => row.status === "rejected").length,
    skippedCount: rows.filter((row) => row.status === "skipped").length,
    pendingCount: rows.filter((row) => row.status === "pending").length,
    refusals: rows
      .filter((row) => row.status === "rejected")
      .map((row) => ({ name: row.name, email: row.email, at: row.rejectedAt || null, reason: row.rejectionReason || null, cause: refusalCauseOf(row) })),
    auditTrail: ensureSignedAudit(record.auditTrail, rows),
    isCreator,
    myStatus: mySigner ? mySigner.status : null,
    myToken: mySigner ? `${record.id}.${mySigner.token}` : null,
    myCanRetract: !isDeletedRequest(record) && canRetractSigner(mySigner),
    myRetractUntil: mySigner?.retractUntil || null,
    signers: rows.map((row) => ({
      name: row.name,
      email: row.email,
      role: row.role || "",
      stationId: row.stationId || null,
      status: row.status,
      signedAt: row.signedAt,
      rejectedAt: row.rejectedAt || null,
      rejectionReason: row.rejectionReason || null,
      rejectionCause: refusalCauseOf(row),
      skippedAt: row.skippedAt || null,
      skipReason: row.skipReason || null,
      skipCause: row.skipCause || null,
      retractDays: row.retractDays ?? null,
      retractUntil: row.retractUntil || null,
      canRetract: !isDeletedRequest(record) && canRetractSigner(row),
      signToken: isCreator && row.token ? `${record.id}.${row.token}` : null,
    })),
    coolingUntil: coolingUntilOf(rows),
    retractAlert: openRetractWindows(rows).map((row) => ({
      name: row.name,
      email: row.email,
      retractDays: row.retractDays ?? null,
      retractUntil: row.retractUntil,
    })),
  };
}

export function visibleToActor(record, actor = {}) {
  const userId = String(actor.userId || actor.id || "");
  const email = String(actor.email || "").toLowerCase();
  if (record.creatorId === userId) return true;
  if (email && record.creatorEmail === email) return true;
  return !!(email && (record.signers || []).some((row) => row.email === email));
}

export function applyCreate(store, payload, actor = {}, { now = new Date().toISOString(), rid } = {}) {
  const gate = checkCreateGate(payload);
  if (!gate.ok) return gate;
  const verificationId = String(payload.verificationId).slice(0, 40);
  if ((store || []).some((row) => row.verificationId === verificationId)) {
    return { ok: false, error: "SIGNATURE_REUSE", reason: "This verification id is already bound to a file" };
  }
  const mint = typeof rid === "function" ? rid : () => `tok_${Math.random().toString(36).slice(2, 12)}`;
  const signers = gate.signers.map((row) => ({ ...row, token: row.token || mint() }));
  const request = {
    id: payload.id || mint(),
    companyId: String(payload.companyId || "").slice(0, 64),
    creatorId: String(actor.userId || actor.id || payload.creatorId || "").slice(0, 64),
    creatorName: String(actor.name || payload.creatorName || "").slice(0, 120),
    creatorEmail: String(actor.email || payload.creatorEmail || "").toLowerCase().slice(0, 160),
    fileName: String(payload.fileName).slice(0, 200),
    docUrl: String(payload.docUrl || "").slice(0, 4000),
    verificationId,
    finalHash: null,
    status: "pending",
    signingMode: "parallel",
    currentSignerIndex: 0,
    stationId: actor.stationId || payload.stationId || null,
    expiresAt: new Date(Date.parse(now) + 30 * 86400000).toISOString(),
    lastActivityAt: now,
    createdAt: now,
    rejectionReason: null,
    signers,
    auditTrail: [{ type: "created", at: now, actorId: actor.userId || actor.id || null, actorName: actor.name || "", actorRole: actor.role || "admin" }],
  };
  const appUrl = String(payload.appUrl || "").replace(/\/+$/, "") || "";
  const links = Object.fromEntries(signers.map((row) => [row.email, `${appUrl}/sign?token=${request.id}.${row.token}`]));
  return { ok: true, request, store: [request, ...(store || [])], links, emailFailed: [] };
}

/** Self-sign: create the request and settle it immediately so verify can find the hash. */
export function applySelfSign(store, payload, actor, opts = {}) {
  const created = applyCreate(store, payload, actor, opts);
  if (!created.ok) return created;
  const signer = created.request.signers[0];
  if (!signer) return { ok: false, error: "SIGNERS_REQUIRED", reason: "A signer is required" };
  return applySubmit(created.store, `${created.request.id}.${signer.token}`, {
    fileHash: payload.fileHash,
    newDocUrl: payload.newDocUrl || payload.docUrl,
    retractDays: 0,
    now: opts.now,
  });
}

function continueWithoutPending(signers, { now, reason, cause, actorName }) {
  const { signers: next, skipped } = skipPendingSigners(signers, { now, reason, cause });
  const events = [
    ...skipped.map((row) => ({
      type: "skipped",
      at: now,
      actorName,
      targetName: row.name,
      targetEmail: row.email,
      reason,
      cause,
    })),
    { type: "continued", at: now, actorName, reason, skippedCount: skipped.length, cause },
  ];
  return { signers: next, skipped, events };
}

export function applyReject(store, token, { reason, now = new Date().toISOString() } = {}) {
  const [id, part] = String(token || "").split(".");
  const request = (store || []).find((row) => row.id === id);
  const signer = request?.signers?.find((row) => row.token === part);
  if (!request || !signer) return { ok: false, error: "NOT_FOUND", reason: "Invalid or expired signing link" };
  if (isDeletedRequest(request)) return { ok: false, error: "REQUEST_CLOSED" };
  if (request.expiresAt && new Date(request.expiresAt).getTime() <= Date.parse(now)) {
    return { ok: false, error: "EXPIRED", reason: "Invalid or expired signing link" };
  }
  const pending = (request.signers || []).filter((row) => row.status === "pending");
  const open = request.status === "pending" || (request.status === "rejected" && pending.length > 0);
  if (!open || signer.status !== "pending") return { ok: false, error: "REQUEST_CLOSED" };
  const note = String(reason || "").trim().slice(0, 1000);
  if (!note) return { ok: false, error: "REASON_REQUIRED", reason: "Rejection reason is required" };
  let signers = request.signers.map((row) => (
    row.token === part ? { ...row, status: "rejected", rejectedAt: now, rejectionReason: note, rejectionCause: REFUSAL_EXPLICIT } : row
  ));
  const events = [{ type: "rejected", at: now, actorName: signer.name, reason: note, cause: REFUSAL_EXPLICIT }];
  const next = holdOpen({ ...request, rejectionReason: note }, signers, now, events);
  return { ok: true, request: next, status: next.status, store: (store || []).map((row) => (row.id === id ? next : row)) };
}

export function applySubmit(store, token, { fileHash, newDocUrl, textValues, retractDays, now = new Date().toISOString() } = {}) {
  const [id, part] = String(token || "").split(".");
  const request = (store || []).find((row) => row.id === id);
  const signer = request?.signers?.find((row) => row.token === part);
  if (!request || !signer) return { ok: false, error: "NOT_FOUND", reason: "Invalid or expired signing link" };
  if (isDeletedRequest(request)) return { ok: false, error: "REQUEST_CLOSED" };
  if (request.expiresAt && new Date(request.expiresAt).getTime() <= Date.parse(now)) {
    return { ok: false, error: "EXPIRED", reason: "Invalid or expired signing link" };
  }
  if (!canSignerSign(request, signer)) return { ok: false, error: "ALREADY_SIGNED" };
  const hash = String(fileHash || "").toLowerCase().slice(0, 64);
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, error: "HASH_REQUIRED", reason: "Signed version fingerprint is required" };
  const submitted = textValues && typeof textValues === "object" ? textValues : {};
  const textFields = (signer.spots || []).filter((field) => field.type === "text");
  if (textFields.some((field) => !String(submitted[field.id] || "").trim())) {
    return { ok: false, error: "FIELDS_REQUIRED", reason: "All text fields are required" };
  }
  const days = clampRetractDays(retractDays);
  const retractUntil = retractUntilAt(now, days);
  const signers = request.signers.map((row) => (
    row.token === part
      ? {
        ...row,
        status: "signed",
        signedAt: now,
        documentHash: hash,
        fieldValues: submitted,
        previousDocUrl: request.docUrl || "",
        retractDays: days,
        retractUntil,
        retractClosedAt: null,
      }
      : row
  ));
  const outcome = settleStatus(signers);
  const cooling = !!coolingUntilOf(signers, now);
  const autoRelease = creatorIsSoleSigner(request, signers) && isRegistrable(outcome) && !cooling;
  const events = [
    signedAuditEvent(signer, { at: now, documentHash: hash, retractDays: days, retractUntil }),
  ];
  if (days > 0 && retractUntil) {
    events.push({ type: "retract_window", at: now, actorName: signer.name, retractDays: days, retractUntil, targetName: request.creatorName });
  }
  const patched = {
    ...request,
    signers,
    docUrl: newDocUrl || request.docUrl,
    currentSignerIndex: signers.filter((row) => row.status === "signed").length,
  };
  const next = autoRelease
    ? releaseRequest(patched, signers, now, events, { id: request.creatorId, name: request.creatorName }).request
    : holdOpen(patched, signers, now, events);
  return {
    ok: true,
    request: next,
    status: next.status,
    completed: autoRelease && next.status === "completed",
    cooling,
    retractDays: days,
    retractUntil,
    finalHash: next.finalHash || null,
    notifyCreator: true,
    notifyComplete: autoRelease,
    store: (store || []).map((row) => (row.id === id ? next : row)),
  };
}

export function applyRetract(store, token, { reason = "", now = new Date().toISOString() } = {}) {
  const [id, part] = String(token || "").split(".");
  const request = (store || []).find((row) => row.id === id);
  const signer = request?.signers?.find((row) => row.token === part);
  if (!request || !signer) return { ok: false, error: "NOT_FOUND", reason: "Invalid or expired signing link" };
  if (isDeletedRequest(request)) return { ok: false, error: "REQUEST_CLOSED" };
  if (!canRetractSigner(signer, now)) {
    return { ok: false, error: "RETRACT_CLOSED", reason: "The retraction window has closed" };
  }
  const note = String(reason || "").trim().slice(0, 1000);
  const signers = request.signers.map((row) => (
    row.token === part
      ? {
        ...row,
        status: "pending",
        signedAt: null,
        documentHash: null,
        fieldValues: {},
        retractClosedAt: now,
        retractedAt: now,
      }
      : row
  ));
  const next = {
    ...request,
    signers,
    docUrl: signer.previousDocUrl || request.docUrl,
    status: settleStatus(signers),
    finalHash: null,
    currentSignerIndex: signers.filter((row) => row.status === "signed").length,
    lastActivityAt: now,
    auditTrail: [
      ...(request.auditTrail || []),
      {
        type: "retracted",
        at: now,
        actorName: signer.name,
        retractDays: signer.retractDays,
        retractUntil: signer.retractUntil,
        reason: note,
        targetName: request.creatorName,
      },
    ],
  };
  return {
    ok: true,
    request: next,
    status: next.status,
    notifyCreator: true,
    store: (store || []).map((row) => (row.id === id ? next : row)),
  };
}

function skipPendingSigners(signers, { now, reason, cause }) {
  const skipped = [];
  const next = (signers || []).map((row) => {
    if (row.status !== "pending") return row;
    skipped.push(row);
    return { ...row, status: "skipped", skippedAt: now, skipReason: reason, skipCause: cause };
  });
  return { signers: next, skipped };
}

function refusePendingByDeadline(signers, { now, actorName = "NiroVera" }) {
  const refused = [];
  const next = (signers || []).map((row) => {
    if (row.status !== "pending") return row;
    refused.push(row);
    return {
      ...row,
      status: "rejected",
      rejectedAt: now,
      rejectionReason: DEADLINE_REFUSAL_REASON,
      rejectionCause: REFUSAL_DEADLINE,
    };
  });
  const events = [
    ...refused.map((row) => ({
      type: "rejected",
      at: now,
      actorName,
      targetName: row.name,
      targetEmail: row.email,
      reason: DEADLINE_REFUSAL_REASON,
      cause: REFUSAL_DEADLINE,
    })),
    { type: "deadline_elapsed", at: now, actorName, refusedCount: refused.length, cause: REFUSAL_DEADLINE },
  ];
  return { signers: next, refused, events };
}

/** Pending parties after a 1–3 day retract window closes become «رفض بانتهاء المدة». Option 0 never triggers this. */
export function shouldSkipSilentAfterRetractClose(signers, now = Date.now()) {
  const rows = signers || [];
  if (!rows.some((row) => row.status === "pending")) return false;
  if (rows.some((row) => canRetractSigner(row, now))) return false;
  return rows.some((row) => row.status === "signed" && row.retractUntil);
}

function holdOpen(request, signers, now, extraEvents = []) {
  return {
    ...request,
    signers,
    status: "pending",
    finalHash: null,
    lastActivityAt: now,
    auditTrail: ensureSignedAudit([...(request.auditTrail || []), ...extraEvents], signers),
  };
}

function releaseRequest(request, signers, now, extraEvents = [], actor = {}) {
  const outcome = settleStatus(signers);
  const cooling = !!coolingUntilOf(signers, now);
  if (outcome === "pending" || cooling) {
    return { request: holdOpen(request, signers, now, extraEvents), released: false };
  }
  const actorName = String(actor.name || request.creatorName || "").slice(0, 120);
  const actorId = actor.userId || actor.id || null;
  const events = [
    ...extraEvents,
    { type: "released", at: now, actorId, actorName, actorRole: "creator" },
  ];
  const next = {
    ...request,
    signers,
    status: outcome,
    releasedAt: now,
    releasedByName: actorName,
    finalHash: isRegistrable(outcome) ? (request.finalHash || lastSignedHash(signers)) : null,
    lastActivityAt: now,
    auditTrail: ensureSignedAudit([...(request.auditTrail || []), ...events], signers),
  };
  return { request: next, released: true };
}

export function applyContinue(store, requestId, actor = {}, { now = new Date().toISOString(), reason = "" } = {}) {
  const request = (store || []).find((row) => row.id === requestId);
  if (!request) return { ok: false, error: "NOT_FOUND", reason: "Request not found" };
  if (isDeletedRequest(request)) return { ok: false, error: "REQUEST_CLOSED" };
  const userId = String(actor.userId || actor.id || "");
  const email = String(actor.email || "").toLowerCase();
  if (request.creatorId !== userId && (!email || request.creatorEmail !== email)) {
    return { ok: false, error: "FORBIDDEN", reason: "Only the creator can continue the file" };
  }
  if (isReleased(request) && request.status !== "pending") {
    return { ok: false, error: "ALREADY_RELEASED", reason: "The creator has already released this file" };
  }
  const pending = (request.signers || []).filter((row) => row.status === "pending");
  const note = String(reason || "").trim().slice(0, 1000) || (pending.length ? "file_continued" : "file_released");
  let signers = request.signers || [];
  let events = [];
  if (pending.length) {
    const skipped = continueWithoutPending(signers, {
      now,
      reason: note,
      cause: "continued",
      actorName: actor.name || request.creatorName,
    });
    signers = skipped.signers;
    events = skipped.events;
  }
  const cooling = !!coolingUntilOf(signers, now);
  if (cooling) {
    const next = holdOpen(request, signers, now, events);
    return {
      ok: true,
      request: next,
      status: next.status,
      released: false,
      store: (store || []).map((row) => (row.id === requestId ? next : row)),
    };
  }
  if ((signers || []).some((row) => row.status === "pending")) {
    return { ok: false, error: "NOT_READY", reason: "Unsigned parties remain" };
  }
  const { request: next, released } = releaseRequest(request, signers, now, events, actor);
  return {
    ok: true,
    request: next,
    status: next.status,
    released,
    notifyComplete: released,
    store: (store || []).map((row) => (row.id === requestId ? next : row)),
  };
}

export function applyRelease(store, requestId, actor = {}, opts = {}) {
  return applyContinue(store, requestId, actor, opts);
}

export function applyReopen(store, requestId, actor = {}, { signerEmail, now = new Date().toISOString() } = {}) {
  const request = (store || []).find((row) => row.id === requestId);
  if (!request) return { ok: false, error: "NOT_FOUND", reason: "Request not found" };
  if (isDeletedRequest(request)) return { ok: false, error: "REQUEST_CLOSED", reason: "Deleted requests cannot be reopened" };
  const userId = String(actor.userId || actor.id || "");
  const email = String(actor.email || "").toLowerCase();
  if (request.creatorId !== userId && (!email || request.creatorEmail !== email)) {
    return { ok: false, error: "FORBIDDEN", reason: "Only the creator can reopen a refused party" };
  }
  const target = String(signerEmail || "").toLowerCase().trim();
  const signer = (request.signers || []).find((row) => row.email === target);
  if (!signer) return { ok: false, error: "NOT_FOUND", reason: "That party is not on this request" };
  if (signer.status !== "rejected") return { ok: false, error: "NOT_REFUSED", reason: "Reopen is only for a party who refused" };
  const signers = request.signers.map((row) => (
    row.email === target
      ? {
        ...row,
        status: "pending",
        rejectedAt: null,
        rejectionReason: null,
        rejectionCause: null,
        skippedAt: null,
        skipReason: null,
        skipCause: null,
      }
      : row
  ));
  const next = {
    ...request,
    signers,
    status: "pending",
    releasedAt: null,
    releasedByName: null,
    finalHash: null,
    rejectionReason: signers.some((row) => row.status === "rejected")
      ? (signers.find((row) => row.status === "rejected")?.rejectionReason || request.rejectionReason)
      : null,
    lastActivityAt: now,
    auditTrail: [
      ...(request.auditTrail || []),
      {
        type: "reopened",
        at: now,
        actorId: actor.userId || actor.id || null,
        actorName: actor.name || request.creatorName,
        targetName: signer.name,
        targetEmail: signer.email,
        priorCause: refusalCauseOf(signer),
      },
    ],
  };
  return { ok: true, request: next, status: next.status, store: (store || []).map((row) => (row.id === requestId ? next : row)) };
}

export function applyDelete(store, requestId, actor = {}, { now = new Date().toISOString(), reason = "" } = {}) {
  const request = (store || []).find((row) => row.id === requestId);
  if (!request) return { ok: false, error: "NOT_FOUND", reason: "Request not found" };
  const userId = String(actor.userId || actor.id || "");
  const email = String(actor.email || "").toLowerCase();
  if (request.creatorId !== userId && (!email || request.creatorEmail !== email)) {
    return { ok: false, error: "FORBIDDEN", reason: "Only the creator can delete this request" };
  }
  if (isDeletedRequest(request)) return { ok: false, error: "REQUEST_CLOSED" };
  const note = String(reason || "").trim().slice(0, 1000);
  if (!note) return { ok: false, error: "REASON_REQUIRED", reason: "Deletion reason is required" };
  const actorName = String(actor.name || request.creatorName || "").slice(0, 120);
  const actorId = actor.userId || actor.id || null;
  const next = {
    ...request,
    status: "deleted",
    deletedAt: now,
    deletionReason: note,
    lastActivityAt: now,
    auditTrail: [
      ...(request.auditTrail || []),
      { type: "deleted", at: now, actorId, actorName, reason: note },
    ],
  };
  return { ok: true, request: next, status: "deleted", store: (store || []).map((row) => (row.id === requestId ? next : row)) };
}

export function expireRetractWindows(store, { now = new Date().toISOString() } = {}) {
  let changed = false;
  const nextStore = (store || []).map((request) => {
    if (isDeletedRequest(request)) return request;
    const signers = request.signers || [];
    const closed = [];
    let nextSigners = signers.map((row) => {
      if (row.status !== "signed" || !row.retractUntil || row.retractClosedAt) return row;
      if (Date.parse(row.retractUntil) > Date.parse(now)) return row;
      closed.push(row);
      return { ...row, retractClosedAt: now };
    });
    const events = closed.map((row) => ({
      type: "retract_closed",
      at: now,
      actorName: row.name,
      retractDays: row.retractDays,
      retractUntil: row.retractUntil,
    }));
    const expired = request.expiresAt && Date.parse(request.expiresAt) <= Date.parse(now);
    const pendingLeft = nextSigners.some((row) => row.status === "pending");
    const autoDeadline = shouldSkipSilentAfterRetractClose(nextSigners, now);
    if (autoDeadline) {
      const lapsed = refusePendingByDeadline(nextSigners, { now });
      nextSigners = lapsed.signers;
      events.push(...lapsed.events);
    } else if (expired && pendingLeft) {
      const lapsed = skipPendingSigners(nextSigners, { now, reason: "link_expired", cause: "expired" });
      nextSigners = lapsed.signers;
      events.push(...lapsed.skipped.map((row) => ({
        type: "skipped",
        at: now,
        actorName: row.name,
        targetName: row.name,
        reason: "link_expired",
        cause: "expired",
      })));
      events.push({ type: "lapsed", at: now, actorName: "NiroVera", skippedCount: lapsed.skipped.length, reason: "link_expired", cause: "expired" });
    }
    if (!closed.length && !autoDeadline && !(expired && pendingLeft)) return request;
    changed = true;
    return holdOpen(request, nextSigners, now, events);
  });
  return { store: nextStore, changed };
}

export function dummySigningEmployees() {
  return [
    { id: "emp_owner_preview", name: "نيار عبدالله", email: "preview@nirovera.local", role: "director", stationId: "st_north_preview" },
    { id: "emp_manager_preview", name: "أحمد السالم", email: "ahmed@nirovera.local", role: "station_manager", stationId: "st_north_preview" },
    { id: "emp_field_preview", name: "عمر ناصر", email: "omar@nirovera.local", role: "employee", stationId: "st_north_preview" },
    { id: "emp_hse_preview", name: "سارة حسن", email: "sara@nirovera.local", role: "safety_officer", stationId: "st_east_preview" },
    { id: "emp_noura_preview", name: "نورة القحطاني", email: "noura@nirovera.local", role: "employee", stationId: "st_east_preview" },
    { id: "emp_hassan_preview", name: "حسن العمري", email: "hassan@nirovera.local", role: "employee", stationId: "st_north_preview" },
  ];
}

function signerFrom(employee, patch = {}) {
  const spots = normalizeSpots(patch);
  return {
    token: patch.token || `tok_${employee.id}`,
    name: employee.name,
    email: employee.email,
    status: patch.status || "pending",
    signedAt: patch.signedAt || null,
    rejectedAt: patch.rejectedAt || null,
    rejectionReason: patch.rejectionReason || null,
    rejectionCause: patch.rejectionCause || null,
    retractDays: patch.retractDays ?? null,
    retractUntil: patch.retractUntil || null,
    employeeId: employee.id,
    role: employee.role,
    stationId: employee.stationId,
    spots,
    spot: spots.find((field) => field.type === "signature") || null,
    documentHash: patch.documentHash || null,
  };
}

export const DUMMY_SIGNING_IDS = Object.freeze(["sg_awaiting_you", "sg_sent_open", "sg_await_release", "sg_await_all", "sg_mixed_close", "sg_deadline_close", "sg_done"]);
/** Local preview file so recipient review never falls back to grey placeholder lines. */
export const LOCAL_SIGNING_PREVIEW_DOC = "/signing-preview-pumps.pdf";

export function resolveSigningDocUrl(record) {
  if (record?.docUrl) return record.docUrl;
  return DUMMY_SIGNING_IDS.includes(record?.id) ? LOCAL_SIGNING_PREVIEW_DOC : "";
}

/** Five dummy requests covering send / pending / explicit refuse / deadline refuse / archive. */
export function buildDummySignatureRequests({ companyId, actor, employees, now = new Date().toISOString() } = {}) {
  const people = employees?.length ? employees : dummySigningEmployees();
  const byId = Object.fromEntries(people.map((row) => [row.id, row]));
  const owner = byId[actor?.id] || people[0];
  const ahmed = byId.emp_manager_preview || people[1];
  const omar = byId.emp_field_preview || people[2];
  const sara = byId.emp_hse_preview || people[3];
  const noura = byId.emp_noura_preview || people[4];
  const hassan = byId.emp_hassan_preview || people[5];
  const hour = 3600000;
  const t = (offset) => new Date(Date.parse(now) + offset).toISOString();
  const hash = (n) => `${"ab".repeat(16)}${String(n).padStart(32, "0")}`.slice(0, 64);

  return [
    {
      id: "sg_awaiting_you",
      companyId,
      creatorId: ahmed.id,
      creatorName: ahmed.name,
      creatorEmail: ahmed.email,
      fileName: "محضر تسليم مضخات الخط الثالث.pdf",
      docUrl: LOCAL_SIGNING_PREVIEW_DOC,
      verificationId: "PWC-AWAIT-001",
      status: "pending",
      createdAt: t(-2 * hour),
      lastActivityAt: t(-hour),
      expiresAt: t(30 * 24 * hour),
      stationId: ahmed.stationId,
      signers: [
        signerFrom(owner, { token: "tok_await_owner" }),
        signerFrom(ahmed, { token: "tok_await_ahmed", status: "signed", signedAt: t(-hour), documentHash: hash(1) }),
      ],
      auditTrail: [
        { type: "created", at: t(-2 * hour), actorName: ahmed.name },
        { type: "signed", at: t(-hour), actorName: ahmed.name },
      ],
    },
    {
      id: "sg_sent_open",
      companyId,
      creatorId: owner.id,
      creatorName: owner.name,
      creatorEmail: owner.email,
      fileName: "تصريح عمل ساخن — فرع الخفجي.pdf",
      docUrl: LOCAL_SIGNING_PREVIEW_DOC,
      verificationId: "PWC-SENT-002",
      status: "pending",
      createdAt: t(-5 * hour),
      lastActivityAt: t(-hour),
      expiresAt: t(30 * 24 * hour),
      stationId: owner.stationId,
      signers: [
        signerFrom(owner, { token: "tok_sent_owner", status: "signed", signedAt: t(-5 * hour), documentHash: hash(2) }),
        signerFrom(hassan || omar, {
          token: "tok_sent_hassan",
          status: "signed",
          signedAt: t(-hour),
          documentHash: hash(2),
          retractDays: 2,
          retractUntil: t(47 * hour),
        }),
        signerFrom(noura || sara, { token: "tok_sent_noura" }),
      ],
      auditTrail: [
        { type: "created", at: t(-5 * hour), actorName: owner.name },
        { type: "signed", at: t(-5 * hour), actorName: owner.name },
        { type: "signed", at: t(-hour), actorName: (hassan || omar).name, retractDays: 2, retractUntil: t(47 * hour) },
        { type: "retract_window", at: t(-hour), actorName: (hassan || omar).name, retractDays: 2, retractUntil: t(47 * hour), targetName: owner.name },
      ],
    },
    {
      id: "sg_await_release",
      companyId,
      creatorId: owner.id,
      creatorName: owner.name,
      creatorEmail: owner.email,
      fileName: "اعتماد توريد — مجموعة موقّعين.pdf",
      docUrl: LOCAL_SIGNING_PREVIEW_DOC,
      verificationId: "PWC-AWAIT-REL-006",
      status: "pending",
      createdAt: t(-20 * hour),
      lastActivityAt: t(-2 * hour),
      expiresAt: t(20 * 24 * hour),
      stationId: owner.stationId,
      rejectionReason: "البيانات الميدانية لا تطابق المعاينة",
      signers: [
        signerFrom(ahmed, { token: "tok_rel_ahmed", status: "signed", signedAt: t(-8 * hour), documentHash: hash(6) }),
        signerFrom(sara, { token: "tok_rel_sara", status: "signed", signedAt: t(-6 * hour), documentHash: hash(6) }),
        signerFrom(noura || hassan, { token: "tok_rel_noura", status: "signed", signedAt: t(-4 * hour), documentHash: hash(6) }),
        signerFrom(omar, {
          token: "tok_rel_omar",
          status: "rejected",
          rejectedAt: t(-2 * hour),
          rejectionReason: "البيانات الميدانية لا تطابق المعاينة",
          rejectionCause: REFUSAL_EXPLICIT,
        }),
      ],
      auditTrail: [
        { type: "created", at: t(-20 * hour), actorName: owner.name },
        { type: "signed", at: t(-8 * hour), actorName: ahmed.name },
        { type: "signed", at: t(-6 * hour), actorName: sara.name },
        { type: "signed", at: t(-4 * hour), actorName: (noura || hassan).name },
        { type: "rejected", at: t(-2 * hour), actorName: omar.name, reason: "البيانات الميدانية لا تطابق المعاينة", cause: REFUSAL_EXPLICIT },
      ],
    },
    {
      id: "sg_await_all",
      companyId,
      creatorId: owner.id,
      creatorName: owner.name,
      creatorEmail: owner.email,
      fileName: "محضر معاينة — اكتملت التواقيع.pdf",
      docUrl: LOCAL_SIGNING_PREVIEW_DOC,
      verificationId: "PWC-AWAIT-ALL-007",
      status: "pending",
      createdAt: t(-18 * hour),
      lastActivityAt: t(-3 * hour),
      expiresAt: t(20 * 24 * hour),
      stationId: owner.stationId,
      signers: [
        signerFrom(ahmed, { token: "tok_all_ahmed", status: "signed", signedAt: t(-12 * hour), documentHash: hash(7) }),
        signerFrom(sara, { token: "tok_all_sara", status: "signed", signedAt: t(-8 * hour), documentHash: hash(7) }),
        signerFrom(noura || hassan, { token: "tok_all_noura", status: "signed", signedAt: t(-5 * hour), documentHash: hash(7) }),
        signerFrom(hassan || omar, { token: "tok_all_hassan", status: "signed", signedAt: t(-3 * hour), documentHash: hash(7) }),
      ],
      auditTrail: [
        { type: "created", at: t(-18 * hour), actorName: owner.name },
        { type: "signed", at: t(-12 * hour), actorName: ahmed.name },
        { type: "signed", at: t(-8 * hour), actorName: sara.name },
        { type: "signed", at: t(-5 * hour), actorName: (noura || hassan).name },
        { type: "signed", at: t(-3 * hour), actorName: (hassan || omar).name },
      ],
    },
    {
      id: "sg_mixed_close",
      companyId,
      creatorId: owner.id,
      creatorName: owner.name,
      creatorEmail: owner.email,
      fileName: "شهادة إنجاز — جولة السلامة.pdf",
      docUrl: LOCAL_SIGNING_PREVIEW_DOC,
      verificationId: "PWC-MIXED-003",
      status: "completed_with_refusal",
      releasedAt: t(-10 * hour),
      releasedByName: owner.name,
      createdAt: t(-48 * hour),
      lastActivityAt: t(-10 * hour),
      expiresAt: t(20 * 24 * hour),
      stationId: owner.stationId,
      finalHash: hash(3),
      rejectionReason: "البيانات الميدانية لا تطابق المعاينة",
      signers: [
        signerFrom(owner, { token: "tok_mix_owner", status: "signed", signedAt: t(-47 * hour), documentHash: hash(3) }),
        signerFrom(sara, { token: "tok_mix_sara", status: "signed", signedAt: t(-20 * hour), documentHash: hash(3) }),
        signerFrom(omar, {
          token: "tok_mix_omar",
          status: "rejected",
          rejectedAt: t(-10 * hour),
          rejectionReason: "البيانات الميدانية لا تطابق المعاينة",
          rejectionCause: REFUSAL_EXPLICIT,
        }),
      ],
      auditTrail: [
        { type: "created", at: t(-48 * hour), actorName: owner.name },
        { type: "signed", at: t(-47 * hour), actorName: owner.name },
        { type: "signed", at: t(-20 * hour), actorName: sara.name },
        { type: "rejected", at: t(-10 * hour), actorName: omar.name, reason: "البيانات الميدانية لا تطابق المعاينة", cause: REFUSAL_EXPLICIT },
      ],
    },
    {
      id: "sg_deadline_close",
      companyId,
      creatorId: owner.id,
      creatorName: owner.name,
      creatorEmail: owner.email,
      fileName: "إذن دخول — مهلة منتهية.pdf",
      docUrl: LOCAL_SIGNING_PREVIEW_DOC,
      verificationId: "PWC-DEADLINE-005",
      status: "completed_with_refusal",
      releasedAt: t(-8 * hour),
      releasedByName: owner.name,
      createdAt: t(-80 * hour),
      lastActivityAt: t(-8 * hour),
      expiresAt: t(20 * 24 * hour),
      stationId: owner.stationId,
      finalHash: hash(5),
      rejectionReason: DEADLINE_REFUSAL_REASON,
      signers: [
        signerFrom(owner, { token: "tok_dl_owner", status: "signed", signedAt: t(-78 * hour), documentHash: hash(5) }),
        signerFrom(noura || sara, {
          token: "tok_dl_noura",
          status: "rejected",
          rejectedAt: t(-8 * hour),
          rejectionReason: DEADLINE_REFUSAL_REASON,
          rejectionCause: REFUSAL_DEADLINE,
        }),
      ],
      auditTrail: [
        { type: "created", at: t(-80 * hour), actorName: owner.name },
        { type: "signed", at: t(-78 * hour), actorName: owner.name },
        { type: "rejected", at: t(-8 * hour), actorName: "NiroVera", targetName: (noura || sara).name, reason: DEADLINE_REFUSAL_REASON, cause: REFUSAL_DEADLINE },
        { type: "deadline_elapsed", at: t(-8 * hour), actorName: "NiroVera", refusedCount: 1, cause: REFUSAL_DEADLINE },
      ],
    },
    {
      id: "sg_done",
      companyId,
      creatorId: owner.id,
      creatorName: owner.name,
      creatorEmail: owner.email,
      fileName: "اعتماد إجازة — أحمد السالم.pdf",
      docUrl: LOCAL_SIGNING_PREVIEW_DOC,
      verificationId: "PWC-DONE-004",
      status: "completed",
      releasedAt: t(-26 * hour),
      releasedByName: owner.name,
      createdAt: t(-72 * hour),
      lastActivityAt: t(-26 * hour),
      expiresAt: t(10 * 24 * hour),
      stationId: owner.stationId,
      finalHash: hash(4),
      signers: [
        signerFrom(owner, { token: "tok_done_owner", status: "signed", signedAt: t(-70 * hour), documentHash: hash(4) }),
        signerFrom(ahmed, { token: "tok_done_ahmed", status: "signed", signedAt: t(-26 * hour), documentHash: hash(4) }),
      ],
      auditTrail: [
        { type: "created", at: t(-72 * hour), actorName: owner.name },
        { type: "signed", at: t(-70 * hour), actorName: owner.name },
        { type: "signed", at: t(-26 * hour), actorName: ahmed.name },
      ],
    },
  ];
}
