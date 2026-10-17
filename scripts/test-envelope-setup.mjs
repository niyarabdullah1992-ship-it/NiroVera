import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  checkEnvelopeFieldsGate,
  checkEnvelopeSetupGate,
  clampExpiryDays,
  clampReminderDays,
  dueAutoReminders,
  envelopeProgressLine,
  envelopeSigners,
  nextAutoReminderAt,
} from "../src/lib/envelopeSetup.js";
import {
  docTitleOf,
  envelopeDocRefusal,
  envelopeFileName,
  mergeEnvelopeDocuments,
  moveDoc,
  countPdfPages,
} from "../src/lib/envelopeDocuments.js";
import { deleteEnvelopeDraft, listEnvelopeDrafts, saveEnvelopeDraft, DRAFT_DOC_BUDGET } from "../src/lib/envelopeDrafts.js";
import { envelopeMetaOf } from "../src/lib/multiSignDerivations.js";

const NOW = Date.parse("2026-10-17T09:00:00.000Z");
const DAY = 86400000;
const iso = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const me = { key: "me", name: "نيار", email: "owner@x.sa" };
const nora = { key: "r1", name: "نورة", email: "nora@x.sa" };
const ext = { key: "x1", name: "Client", email: "client@acme.com", outside: true };
const doc = { name: "عقد.pdf", size: 1000 };

// ── Setup gate names each gap ─────────────────────────────────────────────────
{
  const empty = checkEnvelopeSetupGate({ ar: true });
  assert.equal(empty.ok, false);
  assert.ok(empty.reason.startsWith("يبقى:"));
  assert.ok(empty.gaps.some((gap) => gap.includes("مستنداً")));
  assert.ok(empty.gaps.some((gap) => gap.includes("أنا أيضاً أوقّع")));

  const self = checkEnvelopeSetupGate({ docs: [doc], meSigns: true, me, sealReady: false });
  assert.equal(self.mode, "self");
  assert.ok(self.gaps.some((gap) => gap.includes("ختمك")), "signing alone needs the seal");
  assert.equal(checkEnvelopeSetupGate({ docs: [doc], meSigns: true, me, sealReady: true }).ok, true);

  const group = checkEnvelopeSetupGate({ docs: [doc], meSigns: true, me, recipients: [nora, ext], subject: "للتوقيع", canGroup: true });
  assert.equal(group.ok, true);
  assert.equal(group.mode, "group");
  assert.deepEqual(group.signers.map((row) => row.email), ["owner@x.sa", "nora@x.sa", "client@acme.com"]);
  assert.equal(group.signers[0].isMe, true);

  const noSubject = checkEnvelopeSetupGate({ docs: [doc], recipients: [nora], subject: " ", canGroup: true });
  assert.ok(noSubject.gaps.some((gap) => gap.includes("موضوع")));
  const noRight = checkEnvelopeSetupGate({ docs: [doc], recipients: [nora], subject: "s", canGroup: false });
  assert.ok(noRight.gaps.some((gap) => gap.includes("صلاحية")));
  const dup = checkEnvelopeSetupGate({ docs: [doc], meSigns: true, me, recipients: [{ ...nora, email: "OWNER@x.sa" }], subject: "s" });
  assert.ok(dup.gaps.some((gap) => gap.includes("مكرر")));
  const bad = checkEnvelopeSetupGate({ docs: [doc], recipients: [{ key: "b", name: "x", email: "nope" }], subject: "s" });
  assert.ok(bad.gaps.some((gap) => gap.includes("بريد صالح")));
  // Only others sign: no seal needed, I am not on the envelope.
  const othersOnly = checkEnvelopeSetupGate({ docs: [doc], recipients: [ext], subject: "s", sealReady: false });
  assert.equal(othersOnly.ok, true);
  assert.equal(othersOnly.signers.length, 1);
  assert.deepEqual(envelopeSigners({ recipients: [nora], meSigns: false, me }).map((row) => row.key), ["r1"]);
}

// ── Field gate: a signature per party, a «الختم» field where the stamp is required ──
{
  const signers = [{ name: "نيار" }, { name: "نورة", stamp: true }, { name: "Client" }];
  const none = checkEnvelopeFieldsGate({ signers, fields: [] });
  assert.equal(none.ok, false);
  assert.deepEqual(none.noSign, ["نيار", "نورة", "Client"]);
  assert.deepEqual(none.noSeal, ["نورة"]);
  const sigOnly = checkEnvelopeFieldsGate({ signers, fields: [0, 1, 2].map((signer) => ({ signer, type: "signature", tool: "sig" })) });
  assert.equal(sigOnly.ok, false);
  assert.ok(sigOnly.reason.includes("الختم") && sigOnly.reason.includes("نورة"));
  const full = checkEnvelopeFieldsGate({ signers, fields: [...[0, 1, 2].map((signer) => ({ signer, type: "signature", tool: "sig" })), { signer: 1, type: "signature", tool: "seal" }] });
  assert.equal(full.ok, true);
  // A seal field is also a signature field: it alone satisfies both for a stamped party.
  assert.equal(checkEnvelopeFieldsGate({ signers: [{ name: "a", stamp: true }], fields: [{ signer: 0, type: "signature", tool: "seal" }] }).ok, true);
}

// ── Reminder cadence and expiry clamps (the server stores the same) ───────────
{
  assert.equal(clampReminderDays(0), 0);
  assert.equal(clampReminderDays(-3), 0);
  assert.equal(clampReminderDays(99), 30);
  assert.equal(clampExpiryDays(0), 30);
  assert.equal(clampExpiryDays(500), 90);
  assert.deepEqual(envelopeMetaOf({ subject: "  عقد  ", message: "m", reminderEveryDays: 2, expiryDays: 7 }), { subject: "عقد", message: "m", reminderEveryDays: 2, expiryDays: 7 });
  assert.deepEqual(envelopeMetaOf({}), { subject: "", message: "", reminderEveryDays: 0, expiryDays: 30 });
}

// ── Automatic reminders follow the turn and the cadence ───────────────────────
{
  const base = {
    id: "e1",
    isCreator: true,
    status: "pending",
    createdAt: iso(3),
    expiresAt: new Date(NOW + 20 * DAY).toISOString(),
    reminderEveryDays: 2,
    signingMode: "parallel",
    signers: [
      { name: "نورة", email: "nora@x.sa", status: "pending" },
      { name: "Client", email: "client@acme.com", status: "pending" },
      { name: "سعد", email: "saad@x.sa", status: "signed", signedAt: iso(2) },
    ],
    auditTrail: [{ type: "reminder_sent", targetEmail: "client@acme.com", at: iso(1) }],
  };
  assert.deepEqual(dueAutoReminders(base, NOW).map((row) => row.email), ["nora@x.sa"], "client was reminded a day ago");
  assert.deepEqual(dueAutoReminders({ ...base, reminderEveryDays: 0 }, NOW), [], "by hand only");
  assert.deepEqual(dueAutoReminders({ ...base, isCreator: false }, NOW), [], "only the sender's desk reminds");
  assert.deepEqual(dueAutoReminders({ ...base, status: "deleted", deletedAt: iso(0) }, NOW), [], "a voided envelope owes nothing");
  const seq = { ...base, signingMode: "sequential", auditTrail: [] };
  assert.deepEqual(dueAutoReminders(seq, NOW).map((row) => row.email), ["nora@x.sa"], "sequence reminds the next party only");
  const next = nextAutoReminderAt(base, NOW);
  assert.ok(next && Date.parse(next) <= NOW, "nora is already due");
  assert.equal(nextAutoReminderAt({ ...base, reminderEveryDays: 0 }, NOW), null);

  assert.equal(envelopeProgressLine(base, true, NOW), "1 من 3 وقّعوا · بانتظار نورة، Client");
  assert.equal(envelopeProgressLine(seq, true, NOW), "1 من 3 وقّعوا · بانتظار نورة");
  assert.equal(envelopeProgressLine({ ...base, status: "deleted", deletedAt: iso(0) }, true, NOW), "1 من 3 وقّعوا · أُلغي");
}

// ── Documents: refusal, order, name, merge ────────────────────────────────────
{
  assert.equal(envelopeDocRefusal({ name: "a.pdf", type: "application/pdf", size: 10 }, []), null);
  assert.ok(envelopeDocRefusal({ name: "a.docx", size: 10 }, []).includes("PDF"));
  assert.ok(envelopeDocRefusal({ name: "a.pdf", size: 26 * 1024 * 1024 }, []).includes("25"));
  assert.ok(envelopeDocRefusal({ name: "a.pdf", size: 1 }, Array.from({ length: 10 }, () => ({ size: 1 }))).includes("10"));
  assert.deepEqual(moveDoc(["a", "b", "c"], 2, -1), ["a", "c", "b"]);
  assert.deepEqual(moveDoc(["a", "b"], 0, -1), ["a", "b"]);
  assert.equal(docTitleOf("عقد-الخدمة.pdf"), "عقد الخدمة");
  assert.equal(envelopeFileName([{ name: "scan.png" }]), "scan.pdf");
  assert.equal(envelopeFileName([{ name: "a.pdf" }, { name: "b.pdf" }], "للتوقيع: عقد/2"), "للتوقيع  عقد 2.pdf");

  const make = async (pages) => {
    const pdf = await PDFDocument.create();
    for (let i = 0; i < pages; i += 1) pdf.addPage([300, 400]);
    return { name: `p${pages}.pdf`, type: "application/pdf", bytes: await pdf.save() };
  };
  const one = await make(2);
  const two = await make(3);
  assert.equal(await countPdfPages(two), 3);
  const merged = await mergeEnvelopeDocuments([two, one]);
  assert.deepEqual(merged.pageCounts, [3, 2]);
  assert.equal(merged.pages, 5);
  assert.equal((await PDFDocument.load(merged.bytes)).getPageCount(), 5);
  assert.equal(await countPdfPages({ name: "x.pdf", bytes: new Uint8Array([1, 2, 3]) }), 0, "unreadable PDF counts zero");
}

// ── Drafts live with the sender on this device ────────────────────────────────
{
  const mem = new Map();
  const store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  assert.deepEqual(listEnvelopeDrafts("c1", "u1", store), []);
  const saved = saveEnvelopeDraft("c1", "u1", { subject: "عقد", docs: [{ name: "a.pdf", size: 10, dataUrl: "data:application/pdf;base64,AA==" }], recipients: [nora] }, store);
  assert.equal(saved.ok, true);
  assert.equal(saved.keptDocs, true);
  assert.ok(saved.draft.id.startsWith("draft_"));
  const big = saveEnvelopeDraft("c1", "u1", { subject: "كبير", docs: [{ name: "b.pdf", size: DRAFT_DOC_BUDGET + 1, dataUrl: "data:," }] }, store);
  assert.equal(big.keptDocs, false);
  assert.equal(big.draft.docsMissing, true);
  assert.equal(listEnvelopeDrafts("c1", "u1", store).length, 2);
  assert.equal(listEnvelopeDrafts("c1", "u2", store).length, 0, "another person sees none");
  saveEnvelopeDraft("c1", "u1", { ...saved.draft, subject: "عقد 2" }, store);
  assert.equal(listEnvelopeDrafts("c1", "u1", store).length, 2, "same id replaces");
  assert.equal(deleteEnvelopeDraft("c1", "u1", saved.draft.id, store), true);
  assert.deepEqual(listEnvelopeDrafts("c1", "u1", store).map((row) => row.subject), ["كبير"]);
}

console.log("envelope setup: PASS");

// A browser File carries a bytes() METHOD (Blob.prototype.bytes, Chrome 132+ / Safari / Firefox / Node 22):
// the reader must take the file's contents, never that function — this made every PDF «unreadable».
{
  const { countPdfPages: count } = await import("../src/lib/envelopeDocuments.js");
  const { PDFDocument } = await import("pdf-lib");
  const d = await PDFDocument.create(); d.addPage(); d.addPage();
  const pdfBytes = await d.save();
  const file = new File([pdfBytes], "quiz-key.pdf", { type: "application/pdf" });
  const withMethod = typeof file.bytes === "function" ? file : Object.assign(file, { bytes: () => Promise.resolve(pdfBytes) });
  const n = await count(withMethod);
  if (n !== 2) throw new Error(`a File with a bytes() method reads its 2 pages, got ${n}`);
  console.log("PASS a browser File (with Blob.bytes) is read by its contents");
}
