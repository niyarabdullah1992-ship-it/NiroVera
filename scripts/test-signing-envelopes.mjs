import assert from "node:assert/strict";
import {
  ENVELOPE_PILLS,
  certificateFacts,
  envelopeBucket,
  envelopeMatches,
  envelopePillCounts,
  envelopeRecipients,
  envelopeTrail,
  fieldProgress,
  initialsOf,
  isOverdueEnvelope,
  nextRequiredField,
  orderedFields,
  recipientState,
  remindableSigners,
  senderAnalytics,
  signingTurn,
  timeToSignDays,
} from "../src/lib/signingEnvelopes.js";

const NOW = Date.parse("2026-10-17T09:00:00.000Z");
const iso = (daysAgo) => new Date(NOW - daysAgo * 86400000).toISOString();
const signer = (name, status, extra = {}) => ({ name, email: `${name}@x.sa`, status, ...extra });

// ── Buckets and pills ─────────────────────────────────────────────────────────
const needsMe = { id: "a", status: "pending", myStatus: "pending", createdAt: iso(1), lastActivityAt: iso(1), signers: [signer("me", "pending"), signer("b", "signed", { signedAt: iso(1) })] };
const waiting = { id: "b", status: "pending", myStatus: "signed", isCreator: true, createdAt: iso(5), lastActivityAt: iso(4), signers: [signer("me", "signed", { signedAt: iso(4) }), signer("c", "pending")] };
const done = { id: "c", status: "completed", releasedAt: iso(2), finalHash: "ab".repeat(32), verificationId: "PWC-1", createdAt: iso(6), lastActivityAt: iso(2), signers: [signer("d", "signed", { signedAt: iso(5) }), signer("e", "signed", { signedAt: iso(3) })] };
const refused = { id: "d", status: "rejected", releasedAt: iso(1), createdAt: iso(3), signers: [signer("f", "rejected", { rejectedAt: iso(2) })] };
const voided = { id: "e", status: "deleted", deletedAt: iso(1), createdAt: iso(3), signers: [signer("g", "pending")] };
const awaitingRelease = { id: "f", status: "pending", isCreator: true, createdAt: iso(2), signers: [signer("h", "signed", { signedAt: iso(1) })] };

assert.equal(envelopeBucket(needsMe, NOW), "action");
assert.equal(envelopeBucket(waiting, NOW), "waiting");
assert.equal(envelopeBucket(done, NOW), "done");
assert.equal(envelopeBucket(refused, NOW), "declined");
assert.equal(envelopeBucket(voided, NOW), "declined");
assert.equal(envelopeBucket(awaitingRelease, NOW), "waiting", "answered but not released still waits on the sender");

assert.deepEqual([...ENVELOPE_PILLS], ["all", "action", "waiting", "done", "draft", "declined", "archive"]);
const rows = [needsMe, waiting, done, refused, voided, awaitingRelease];
const counts = envelopePillCounts(rows, NOW);
// The archive rule: a released envelope stays on its face («مكتملة» / «مرفوضة») for 30 days, then «الأرشيف» only;
// a voided one goes to the archive at once.
assert.equal(counts.all, 5, "الكل is everything not archived yet");
assert.equal(counts.action, 1);
assert.equal(counts.waiting, 2);
assert.equal(counts.done, 1);
assert.equal(counts.draft, 0, "no saved drafts exist");
assert.equal(counts.declined, 1, "a fresh refusal stays under «مرفوضة»");
assert.equal(counts.archive, 1, "the voided envelope is archived at once");
assert.equal(envelopeMatches(done, "archive", NOW), false, "a fresh completion is not archived yet");
const oldDone = { ...done, id: "old", releasedAt: iso(31) };
assert.equal(envelopeMatches(oldDone, "archive", NOW), true, "after 30 days it moves to the archive");
assert.equal(envelopeMatches(oldDone, "done", NOW), false, "and leaves «مكتملة»");
assert.deepEqual(envelopePillCounts(null, NOW).all, 0);

// ── Signing order ─────────────────────────────────────────────────────────────
const parallel = { signingMode: "parallel", signers: [signer("a", "signed"), signer("b", "pending"), signer("c", "pending")] };
const sequential = { ...parallel, signingMode: "sequential" };
assert.deepEqual(signingTurn(parallel), [1, 2], "parallel: every pending party may sign");
assert.deepEqual(signingTurn(sequential), [1], "sequential: the first pending party in order");
assert.deepEqual(signingTurn({ signingMode: "sequential", signers: [signer("a", "signed")] }), []);
assert.deepEqual(signingTurn(null), []);
assert.equal(recipientState(sequential, 0), "signed");
assert.equal(recipientState(sequential, 1), "turn");
assert.equal(recipientState(sequential, 2), "queued");
assert.equal(recipientState(parallel, 2), "turn");
assert.equal(recipientState({ signers: [signer("x", "rejected")] }, 0), "declined");
assert.equal(recipientState({ signers: [signer("x", "skipped")] }, 0), "skipped");
const people = envelopeRecipients(sequential);
assert.equal(people.length, 3);
assert.equal(people[2].order, 3);
assert.equal(people[1].state, "turn");
assert.equal(initialsOf("نيار عبدالله"), "نع");
assert.equal(initialsOf(""), "·");

// ── Next required field ───────────────────────────────────────────────────────
const fields = [
  { id: "sig2", page: 2, x: 70, y: 80 },
  { id: "date1", page: 1, x: 20, y: 90 },
  { id: "name1", page: 1, x: 20, y: 40 },
  { id: "opt", page: 1, x: 50, y: 60, required: false },
  { id: "init1", page: 1, x: 80, y: 40 },
];
assert.deepEqual(orderedFields(fields).map((f) => f.id), ["name1", "init1", "opt", "date1", "sig2"]);
const none = () => false;
assert.equal(nextRequiredField(fields, none)?.id, "name1", "starts at the top of page 1");
assert.equal(nextRequiredField(fields, none, "init1")?.id, "date1", "skips the optional field");
assert.equal(nextRequiredField(fields, none, "sig2")?.id, "name1", "wraps to the top");
const filled = new Set(["name1", "init1"]);
assert.equal(nextRequiredField(fields, (f) => filled.has(f.id))?.id, "date1");
assert.equal(nextRequiredField(fields, (f) => filled.has(f.id), "date1")?.id, "sig2");
assert.equal(nextRequiredField(fields, () => true), null, "nothing left");
assert.equal(nextRequiredField([], none), null);
assert.equal(nextRequiredField(fields, none, "missing")?.id, "name1");
const progress = fieldProgress(fields, (f) => filled.has(f.id));
assert.deepEqual(progress, { done: 2, total: 5, required: 2 });

// ── Trail, overdue, analytics ─────────────────────────────────────────────────
const trailed = {
  auditTrail: [
    { type: "signed", at: iso(1), actorName: "b", location: { available: true, lat: 24.7, lng: 46.6 } },
    { type: "created", at: iso(3), actorName: "a" },
    { type: "reminder_sent", at: iso(2), actorName: "a", targetName: "c" },
  ],
};
const trail = envelopeTrail(trailed);
assert.deepEqual(trail.map((e) => e.type), ["created", "reminder_sent", "signed"], "oldest first");
assert.equal(trail[1].target, "c");
assert.deepEqual(trail[2].location, { lat: 24.7, lng: 46.6 });
assert.equal(isOverdueEnvelope(waiting, NOW), true, "four quiet days");
assert.equal(isOverdueEnvelope(needsMe, NOW), false);
assert.equal(isOverdueEnvelope(done, NOW), false, "closed is never overdue");
assert.equal(isOverdueEnvelope({ ...needsMe, expiresAt: new Date(NOW + 3600000).toISOString() }, NOW), true, "expires within a day");
assert.equal(timeToSignDays(done), 3);
assert.equal(timeToSignDays(waiting), null, "not every party answered");
const stats = senderAnalytics(rows, NOW);
assert.equal(stats.overdue.length, 1);
assert.equal(stats.overdue[0].id, "b");
assert.equal(stats.refused, 1);
assert.equal(stats.doneMonth, 1);
assert.ok(stats.avgDays > 0);
assert.equal(senderAnalytics([], NOW).avgDays, null, "no figure without a measured envelope");
assert.equal(remindableSigners(waiting, NOW).length, 1, "the sender reminds the pending party");
assert.equal(remindableSigners(needsMe, NOW).length, 0, "only the sender reminds");

// ── Certificate ───────────────────────────────────────────────────────────────
const cert = certificateFacts({ ...done, auditTrail: [{ type: "signed", at: iso(5), actorName: "d", location: { available: true, lat: 26.1, lng: 43.6 } }, { type: "released", at: iso(2), actorName: "d" }] }, NOW);
assert.equal(cert.ready, true);
assert.equal(cert.hash.length, 64);
assert.equal(cert.verificationId, "PWC-1");
assert.equal(cert.signers.length, 2);
assert.deepEqual(cert.signers[0].location, { lat: 26.1, lng: 43.6 });
assert.equal(cert.signers[1].location, null, "no location invented");
assert.equal(cert.completedAt, iso(2));
assert.equal(certificateFacts(needsMe, NOW).ready, false, "no fingerprint before completion");

console.log("signing envelopes: buckets, pills, order, next field, trail, overdue, analytics, certificate ok");
