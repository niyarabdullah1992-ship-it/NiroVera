import assert from "node:assert/strict";
// Updated: these derivations live in the backend shared module (base44/shared/*.ts, run via Node type stripping); there is no src/lib copy.
import {
  sealGroups,
  sealIdFor,
  fingerprintFor,
  deriveSeal,
  chainHeadIndex,
  isChainComplete,
  checkRaiseGate,
  checkSignGate,
  checkSignIntentGate,
  checkVerifySealGate,
  checkSendSignedGate,
} from "../base44/shared/signingDerivations.ts";

assert.equal(sealGroups("seed", 2).split("-").length, 2);
assert.equal(sealIdFor({ docKey: "d1", contentHash: "h" }, { sid: "na" }, null), "");
const id = sealIdFor({ docKey: "d1", contentHash: "h" }, { sid: "na" }, "2026-08-11T10:00:00Z");
assert.ok(id.startsWith("NV-SIG-"));
const fp = fingerprintFor({ docKey: "d1", contentHash: "h" }, { sid: "na" }, "2026-08-11T10:00:00Z");
assert.equal(fp.split("-").length, 4);

// Altering contentHash changes the seal.
const id2 = sealIdFor({ docKey: "d1", contentHash: "HACKED" }, { sid: "na" }, "2026-08-11T10:00:00Z");
assert.notEqual(id, id2);

const pending = deriveSeal({ docKey: "d1" }, { sid: "na", name: "N", signedAt: null });
assert.equal(pending.id, "PENDING");
assert.equal(pending.pending, true);

assert.equal(checkRaiseGate({}).error, "SOURCE_REQUIRED");
assert.equal(checkRaiseGate({ source: "workproof" }).error, "SOURCE_REF_REQUIRED");
assert.equal(
  checkRaiseGate({
    source: "workproof",
    sourceRef: "OPS-1",
    title: "Cert",
    signers: [{ sid: "a", name: "A" }],
  }).ok,
  true,
);

const doc = {
  docKey: "workproof:OPS-1",
  title: "Cert",
  source: "workproof",
  contentHash: "OPS-1",
  signers: [
    { sid: "me", name: "Niyar", userId: "u1", signedAt: null },
    { sid: "u2", name: "Fahad", userId: "u2", signedAt: null },
  ],
};

assert.equal(chainHeadIndex(doc.signers), 0);
assert.equal(checkSignGate(doc, { userId: "u2" }).error, "NOT_YOUR_TURN");
assert.equal(checkSignGate(doc, { userId: "u1" }).ok, true);
assert.equal(checkSignIntentGate(false).error, "INTENT_REQUIRED");
assert.equal(checkSignIntentGate(true).ok, true);

const signedAt = "2026-08-11T10:00:00Z";
const sealId = sealIdFor(doc, doc.signers[0], signedAt);
const fingerprint = fingerprintFor(doc, doc.signers[0], signedAt);
doc.signers[0] = { ...doc.signers[0], signedAt, sealId, fingerprint };
assert.equal(chainHeadIndex(doc.signers), 1);
assert.equal(checkVerifySealGate(doc, "me").ok, true);

doc.signers[0] = { ...doc.signers[0], contentHash: "x" }; // no — mutate sealId
doc.signers[0].sealId = "NV-SIG-DEAD-BEEF";
assert.equal(checkVerifySealGate(doc, "me").error, "SEAL_MISMATCH");

// restore valid seal for send tests
doc.signers[0].sealId = sealId;
assert.equal(checkSendSignedGate(doc).error, "CHAIN_INCOMPLETE");

doc.signers[1] = {
  ...doc.signers[1],
  signedAt,
  sealId: sealIdFor(doc, doc.signers[1], signedAt),
  fingerprint: fingerprintFor(doc, doc.signers[1], signedAt),
};
assert.equal(isChainComplete(doc.signers), true);
assert.equal(checkSendSignedGate(doc).ok, true);
assert.equal(checkSignGate(doc, { userId: "u1" }).error, "CHAIN_COMPLETE");

console.log("signing derivations ok");
