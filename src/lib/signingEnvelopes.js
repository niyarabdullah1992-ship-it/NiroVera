/**
 * «التوقيع الرقمي» / «توقيعاتي» — the envelope desk, derived only from the stored request.
 * Pure: no React, no store. The signing rules themselves stay in multiSignDerivations; this
 * file reads them into what the desk shows — the pill a row sits under, each recipient's dot,
 * whose turn it is, the next field the signer must fill, the trail, the sender's quiet rows and
 * the completion certificate.
 */
import { canDownloadFinal, isArchivedSigningEnvelope, settledState } from "./multiSignDerivations.js";

const DAY = 86400000;

/** The list pills, in order. «مسودات» stays: nothing is saved as a draft yet, so it counts 0. */
export const ENVELOPE_PILLS = Object.freeze(["all", "action", "waiting", "done", "draft", "declined", "archive"]);

/** Where a row sits on the desk: needs you · waits on others · done · refused or voided. */
export function envelopeBucket(request, now = Date.now()) {
  const { state, cooling } = settledState(request, now);
  if (state === "deleted" || state === "rejected") return "declined";
  if (state === "completed" || state === "completed_with_refusal") return "done";
  if (state === "pending" && request.myStatus === "pending" && !cooling) return "action";
  return "waiting";
}

/** True when the row belongs under the pill. «الكل» is the open desk; the archive is what closed. */
export function envelopeMatches(request, pill, now = Date.now()) {
  if (pill === "draft") return false;
  if (pill === "archive") return isArchivedSigningEnvelope(request, now);
  if (pill === "all") return !isArchivedSigningEnvelope(request, now);
  return envelopeBucket(request, now) === pill;
}

export function envelopePillCounts(requests = [], now = Date.now()) {
  const counts = Object.fromEntries(ENVELOPE_PILLS.map((id) => [id, 0]));
  for (const row of requests || []) {
    for (const id of ENVELOPE_PILLS) if (envelopeMatches(row, id, now)) counts[id] += 1;
  }
  return counts;
}

/**
 * Whose turn it is. Parallel: every pending party. Sequential: the first pending party in the
 * stored order — the order is shown, the server still lets any pending party sign.
 */
export function signingTurn(request) {
  const signers = Array.isArray(request?.signers) ? request.signers : [];
  const pending = signers.map((row, index) => (row?.status === "pending" ? index : -1)).filter((index) => index >= 0);
  if (!pending.length) return [];
  return request?.signingMode === "sequential" ? [pending[0]] : pending;
}

/** One recipient's dot: signed · declined · skipped · turn (may sign now) · queued (later in order). */
export function recipientState(request, index) {
  const signer = (request?.signers || [])[index];
  if (!signer) return "pending";
  if (signer.status === "signed") return "signed";
  if (signer.status === "rejected") return "declined";
  if (signer.status === "skipped") return "skipped";
  if (signer.status !== "pending") return "pending";
  return signingTurn(request).includes(index) ? "turn" : "queued";
}

export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  if (parts.length === 1) return Array.from(parts[0])[0];
  return `${Array.from(parts[0])[0]}${Array.from(parts[1])[0]}`;
}

export function envelopeRecipients(request) {
  return (request?.signers || []).map((signer, index) => ({
    index,
    order: index + 1,
    name: signer.name || signer.email || "—",
    email: signer.email || "",
    initials: initialsOf(signer.name || signer.email),
    state: recipientState(request, index),
    at: signer.signedAt || signer.rejectedAt || signer.skippedAt || null,
    reason: signer.rejectionReason || signer.skipReason || "",
    signer,
  }));
}

/** Reading order on the document: page, then top to bottom, then start to end. */
function readingOrder(left, right) {
  return (Number(left.page) || 1) - (Number(right.page) || 1)
    || (Number(left.y) || 0) - (Number(right.y) || 0)
    || (Number(left.x) || 0) - (Number(right.x) || 0);
}

export function orderedFields(fields = []) {
  return [...(fields || [])].filter(Boolean).sort(readingOrder);
}

/**
 * The next required field still empty, after `afterId` in reading order, wrapping to the top.
 * `isFilled(field)` says whether a field already carries a value. Null when nothing is left.
 */
export function nextRequiredField(fields = [], isFilled = () => false, afterId = null) {
  const list = orderedFields(fields).filter((field) => field.required !== false);
  const open = list.filter((field) => !isFilled(field));
  if (!open.length) return null;
  if (!afterId) return open[0];
  const at = list.findIndex((field) => field.id === afterId);
  if (at < 0) return open[0];
  for (let step = 1; step <= list.length; step += 1) {
    const field = list[(at + step) % list.length];
    if (!isFilled(field)) return field;
  }
  return null;
}

/** «2 من 5 حقول»: every field counts; `required` is what still blocks finishing. */
export function fieldProgress(fields = [], isFilled = () => false) {
  const list = (fields || []).filter(Boolean);
  const done = list.filter((field) => isFilled(field)).length;
  const required = list.filter((field) => field.required !== false && !isFilled(field)).length;
  return { done, total: list.length, required };
}

export function lastActivityAt(request) {
  return request?.lastActivityAt || request?.releasedAt || request?.createdAt || null;
}

/** The audit trail, oldest first; each event keeps its stored time. */
export function envelopeTrail(request) {
  const events = Array.isArray(request?.auditTrail) ? request.auditTrail.filter(Boolean) : [];
  return events
    .map((event, index) => ({
      key: `${event.type}-${event.at || ""}-${index}`,
      type: event.type || "",
      at: event.at || null,
      who: event.actorName || event.targetName || "",
      target: event.type === "reminder_sent" || event.type === "skipped" ? (event.targetName || "") : "",
      reason: event.reason || "",
      location: event.location?.available ? { lat: event.location.lat, lng: event.location.lng } : null,
      index,
    }))
    .sort((left, right) => (Date.parse(left.at || "") || 0) - (Date.parse(right.at || "") || 0) || left.index - right.index);
}

/** An open envelope is overdue after `days` without activity, or when its link expires within a day. */
export function isOverdueEnvelope(request, now = Date.now(), days = 3) {
  const { state } = settledState(request, now);
  if (state !== "pending") return false;
  const last = Date.parse(lastActivityAt(request) || "");
  if (last && now - last >= days * DAY) return true;
  const expires = Date.parse(request?.expiresAt || "");
  return Boolean(expires && expires - now <= DAY && expires > now);
}

/** Days from sending to the last party's answer, for envelopes every party answered. */
export function timeToSignDays(request) {
  const start = Date.parse(request?.createdAt || "");
  if (!start) return null;
  const answers = (request?.signers || [])
    .map((signer) => Date.parse(signer.signedAt || signer.rejectedAt || ""))
    .filter(Boolean);
  if (!answers.length || answers.length < (request?.signers || []).length) return null;
  const end = Math.max(...answers);
  return end >= start ? (end - start) / DAY : null;
}

/** The sender's quiet rows: average time to sign, overdue envelopes, done this month, refused. */
export function senderAnalytics(requests = [], now = Date.now(), days = 3) {
  const month = new Date(now).toISOString().slice(0, 7);
  const durations = [];
  const overdue = [];
  let doneMonth = 0;
  let refused = 0;
  let open = 0;
  for (const row of requests || []) {
    const { state } = settledState(row, now);
    if (state === "pending") open += 1;
    if (state === "rejected") refused += 1;
    if (state === "completed" || state === "completed_with_refusal") {
      if (String(row.releasedAt || lastActivityAt(row) || "").slice(0, 7) === month) doneMonth += 1;
    }
    const spent = timeToSignDays(row);
    if (spent !== null) durations.push(spent);
    if (isOverdueEnvelope(row, now, days)) overdue.push(row);
  }
  const avgDays = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;
  return { avgDays, measured: durations.length, overdue, doneMonth, refused, open };
}

/** Pending parties an envelope can still remind (the sender's «ذكّر»). */
export function remindableSigners(request, now = Date.now()) {
  if (!request?.isCreator) return [];
  if (settledState(request, now).state !== "pending") return [];
  return (request.signers || []).filter((signer) => signer.status === "pending" && signer.email);
}

/**
 * The completion certificate: what the registry can prove about the closed file. `ready` once
 * the fingerprint is fixed — before that the certificate says it registers on completion.
 */
export function certificateFacts(request, now = Date.now()) {
  const derived = settledState(request, now);
  const trail = envelopeTrail(request);
  const signedEvents = trail.filter((event) => event.type === "signed");
  const signers = (request?.signers || []).map((signer) => {
    const event = signedEvents.find((row) => row.who && row.who === signer.name);
    return {
      name: signer.name || "",
      email: signer.email || "",
      status: signer.status,
      at: signer.signedAt || signer.rejectedAt || signer.skippedAt || null,
      location: event?.location || (signer.location?.available ? { lat: signer.location.lat, lng: signer.location.lng } : null),
    };
  });
  const released = trail.filter((event) => event.type === "released" || event.type === "continued").pop();
  return {
    ready: Boolean(request?.finalHash),
    hash: request?.finalHash || "",
    verificationId: request?.verificationId || "",
    createdAt: request?.createdAt || null,
    completedAt: request?.releasedAt || released?.at || (derived.settled ? lastActivityAt(request) : null),
    state: derived.state,
    downloadable: canDownloadFinal(request, now),
    signers,
  };
}
