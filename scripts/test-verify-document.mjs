import assert from "node:assert/strict";
import { buildDummySignatureRequests, dummySigningEmployees } from "../src/lib/multiSignDerivations.js";
import { deriveVerifyResult, preferVerifyAnswer, verifyKindOf } from "../src/lib/verifyDocument.js";

const people = dummySigningEmployees();
const requests = buildDummySignatureRequests({
  companyId: "local-preview-nirovera",
  actor: people[0],
  employees: people,
});
const hash = (n) => `${"ab".repeat(16)}${String(n).padStart(32, "0")}`.slice(0, 64);
const other = "11".repeat(32);

const none = deriveVerifyResult({ registry: [], requests: [], fileHash: other });
assert.equal(none.kind, "none");
assert.equal(none.status, "unknown");
assert.equal(none.registryHash, "");

const bySignerHash = deriveVerifyResult({
  registry: [],
  requests,
  fileHash: hash(1),
});
assert.equal(bySignerHash.kind, "ok");
assert.ok(bySignerHash.signerName);

const renamedCopy = deriveVerifyResult({
  registry: [{ verificationId: "PWC-DONE-004", fileHash: hash(4), signerName: "نيار عبدالله", fileName: "اعتماد إجازة — أحمد السالم.pdf", signedAt: "2026-09-08T10:00:00.000Z" }],
  requests,
  fileHash: other,
  fileName: "اعتماد إجازة — أحمد السالم-signed.pdf",
});
assert.equal(renamedCopy.kind, "modified");
assert.equal(renamedCopy.verificationId, "PWC-DONE-004");

const cooling = deriveVerifyResult({
  registry: [],
  requests,
  fileHash: other,
  verificationId: "PWC-SENT-002",
});
assert.equal(cooling.kind, "cooling");
assert.ok(cooling.coolingUntil);
assert.ok(cooling.signerName);
assert.equal(cooling.verificationId, "PWC-SENT-002");

const modified = deriveVerifyResult({
  registry: [],
  requests,
  fileHash: other,
  verificationId: "PWC-DONE-004",
});
assert.equal(modified.kind, "modified");
assert.equal(modified.registryHash, hash(4));
assert.equal(modified.uploadedHash, other);

const ok = deriveVerifyResult({
  registry: [{ verificationId: "PWC-DONE-004", fileHash: hash(4), signerName: "نيار عبدالله", signedAt: "2026-09-08T10:00:00.000Z" }],
  requests,
  fileHash: hash(4),
  verificationId: "PWC-DONE-004",
});
assert.equal(ok.kind, "ok");
assert.equal(ok.status, "valid");
assert.equal(ok.registryHash, hash(4));

const reuse = deriveVerifyResult({
  registry: [
    { verificationId: "PWC-DONE-004", fileHash: hash(4), signerName: "نيار", fileName: "اعتماد إجازة.pdf", signedAt: "2026-09-08T10:00:00.000Z" },
    { verificationId: "PWC-MIXED-003", fileHash: hash(3), signerName: "نورة", fileName: "شهادة إنجاز.pdf", signedAt: "2026-09-07T10:00:00.000Z" },
  ],
  requests: [],
  fileHash: hash(4),
  verificationId: "PWC-MIXED-003",
});
assert.equal(reuse.kind, "reuse");
assert.equal(reuse.status, "reuse");
assert.equal(reuse.verificationId, "PWC-MIXED-003");

assert.equal(verifyKindOf({ status: "valid" }), "ok");
assert.equal(verifyKindOf({ status: "tampered" }), "modified");
assert.equal(preferVerifyAnswer({ kind: "none" }, { kind: "cooling" }).kind, "cooling");
assert.equal(preferVerifyAnswer({ kind: "ok" }, { kind: "none" }).kind, "ok");

console.log("test-verify-document: ok");
