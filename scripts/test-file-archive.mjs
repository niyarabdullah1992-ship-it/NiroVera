/* global console */
import assert from "node:assert/strict";
import { ARCHIVE_GROUPS, buildFileArchive, filterFileArchive, shortArchiveHash } from "../src/lib/fileArchive.js";
import { buildDummySignatureRequests, dummySigningEmployees } from "../src/lib/multiSignDerivations.js";

const TODAY = "2026-10-16";
const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

assert.deepEqual(ARCHIVE_GROUPS.map((g) => g.ar), ["العقود", "القرارات والجزاءات", "الشهادات والخطابات", "الهوية والوثائق", "العهد والإخلاء", "الإقرارات"]);
assert.equal(shortArchiveHash(HASH), "a1b2c3d4");
assert.equal(shortArchiveHash("NV-1"), "");

// Empty file: one muted line, no groups.
{
  const a = buildFileArchive({ employee: { id: "x", profile: {} }, today: TODAY });
  assert.equal(a.empty, true);
  assert.equal(a.groups.length, 0);
  assert.match(a.emptyLine, /لا وثيقة/);
  assert.equal(buildFileArchive({}).empty, true);
}

const full = () => ({
  id: "e1",
  name: "سالم",
  email: "salem@x.local",
  profile: {
    hireDate: "2023-03-01",
    contract: { generated: true, model: {}, workerAck: { at: "2023-03-02T09:00:00Z", hash: HASH, name: "سالم" }, fileUrl: "/c.pdf", fileName: "عقد.pdf", signedAt: "2023-03-03" },
    salaryCertificateUrl: "/salary.pdf",
    salaryCertificateName: "شهادة راتب.pdf",
    qualificationFiles: [{ name: "بكالوريوس.pdf", url: "/q.pdf", at: "2023-03-05" }],
    nightMedicalReport: { name: "لياقة.pdf", url: "/n.pdf", issuedAt: "2026-01-10" },
    contractExit: { reason: "resignation", party: "worker", resignationSubmittedAt: "2026-09-01", effectiveDate: "2026-10-01" },
  },
  docs: [{ kind: "passport", number: "P1", url: "/p.pdf", uploadedAt: "2024-01-01" }, { kind: "iqama", number: "I1" }],
  certificates: [
    { id: "c1", name: "السلامة", url: "/s.pdf", issueDate: "2025-05-01" },
    { id: "c2", name: "مرفوضة", status: "rejected", url: "/r.pdf" },
    { id: "c3", name: "بلا ملف", status: "pending" },
  ],
  trainings: [{ id: "t1", course: "رافعات", to: "2025-06-01", certificateUrl: "/t.pdf" }, { id: "t2", course: "بلا شهادة" }],
  otherRequests: [
    { id: "r1", type: "document", docKind: "exp", status: "approved", reviewedAt: "2026-10-02", reviewedBy: "هند", verifyId: "NV-EXP-1", issuedFile: { name: "خدمة.pdf", url: "/exp.pdf", hash: HASH } },
    { id: "r2", type: "salary_letter", status: "approved", reviewedAt: "2026-02-01", reviewedBy: "هند", verifyId: "NV-SAL-2" },
    { id: "r3", type: "document", docKind: "contract", status: "approved", reviewedAt: "2024-01-01", verifyId: "NV-CON-3" },
    { id: "r4", type: "salary_letter", status: "pending" },
    { id: "r5", type: "written_consent", status: "yes", titleAr: "نقل", citeAr: "المادة 58", answeredAt: "2025-04-01", seal: { signatureId: "NV-CNS-5" }, paper: { name: "p.pdf", url: "/cns.pdf" } },
    { id: "r6", type: "written_consent", status: "open", titleAr: "مفتوحة" },
    { id: "r7", type: "custody", status: "approved", reviewedAt: "2024-02-01", paper: { name: "عهدة.pdf", url: "/cu.pdf" }, verifyId: "NV-CU-7" },
    { id: "r8", type: "documents_return", status: "approved", reviewedAt: "2026-10-03", reviewedBy: "هند" },
    { id: "r9", type: "overtime", status: "approved" },
  ],
  fileLog: [{ text: "تعديل بيانات الملف", by: "هند", at: "2026-01-01 10:00" }],
  leaveRequests: [{ id: "lv", status: "approved", type: "annual", files: [{ name: "x.pdf", url: "/x.pdf" }] }],
});

const cases = [
  { id: "d1", employeeId: "e1", status: "closed", penalty: "إنذار", signedAt: "2024-05-01T10:00:00", signedBy: "مدير", finalHash: HASH, appealedAt: "2024-05-03", rulingAt: "2024-05-10", rulingBy: "مدير", rulingLabel: "أُيّد" },
  { id: "d2", employeeId: "e1", status: "hearing", note: "لم يُوقّع" },
  { id: "d3", employeeId: "other", status: "closed", signedAt: "2024-05-01" },
];
const assets = [
  { id: "a1", holderId: "e1", name: "حاسب", serial: "SN1", handedAt: "2023-03-04", ackAt: "2023-03-04", returnedAt: "2026-09-30", receivedBy: "أمين" },
  { id: "a2", holderId: "e1", name: "خوذة", handedAt: "2023-03-04" },
];
const regulation = { version: "v2", acks: { e1: { at: "2023-03-02", version: "v2" } } };
const signatureRequests = [
  { id: "s1", status: "completed", fileName: "محضر.pdf", verificationId: "PWC-1", finalHash: HASH, creatorName: "مدير", signers: [{ employeeId: "e1", status: "signed", signedAt: "2025-01-01" }] },
  { id: "s2", status: "pending", fileName: "مفتوح.pdf", signers: [{ employeeId: "e1", status: "signed" }] },
  { id: "s3", status: "completed", fileName: "رفضه.pdf", signers: [{ email: "SALEM@x.local", status: "rejected" }] },
  { id: "s4", status: "completed", fileName: "طلب.pdf", otherRequestId: "r7", signers: [{ employeeId: "e1", status: "signed" }] },
];
const signedDocuments = [{ id: "sd1", title: "قرار مختوم", sealId: "NV-SIG-1", signedAt: "2025-03-01", employeeId: "e1" }, { id: "sd2", title: "لغيره", sealId: "X" }];

const a = buildFileArchive({ employee: full(), cases, assets, regulation, signatureRequests, signedDocuments, ar: true, today: TODAY, profileHref: "/app/employees/e1" });
const ids = a.groups.flatMap((g) => g.items.map((row) => row.id));
const byId = Object.fromEntries(a.groups.flatMap((g) => g.items).map((row) => [row.id, row]));
const groupOf = (id) => byId[id]?.group;

// Contracts.
assert.equal(groupOf("contract-model"), "contracts");
assert.equal(byId["contract-model"].proof.id, "sealed");
assert.equal(byId["contract-model"].proof.hash, "a1b2c3d4");
assert.equal(byId["contract-model"].print, "contract");
assert.equal(byId["contract-model"].open.to, "/app/employees/e1?tab=contract");
assert.equal(byId["contract-file"].proof.id, "uploaded");
assert.equal(byId["contract-file"].open.href, "/c.pdf");
assert.equal(groupOf("letter-r3"), "contracts", "issued contract copy (Art. 51) files under contracts");

// Decisions: only signed sanctions of this employee, with the grievance ruling.
assert.equal(byId["sanction-d1"].proof.id, "sealed");
assert.equal(byId["sanction-d1"].open.to, "/app/discipline");
assert.equal(groupOf("ruling-d1"), "decisions");
assert.ok(!ids.includes("sanction-d2"));
assert.ok(!ids.includes("sanction-d3"));

// Letters.
assert.equal(groupOf("letter-r1"), "letters");
assert.match(byId["letter-r1"].type, /م 64/);
assert.equal(byId["letter-r1"].proof.ref, "a1b2c3d4");
assert.equal(byId["letter-r1"].verifyHref, "/verify?id=NV-EXP-1");
assert.equal(byId["letter-r1"].downloadUrl, "/exp.pdf");
assert.equal(byId["letter-r2"].proof.ref, "NV-SAL-2");
assert.equal(byId["letter-r2"].open.to, "/app/requests/archive");
assert.ok(!ids.includes("letter-r4"), "pending request is not a document");
assert.ok(ids.includes("salary-certificate"));
assert.ok(ids.includes("cert-c1"));
assert.ok(!ids.includes("cert-c2"), "rejected certificate stays out");
assert.ok(!ids.includes("cert-c3"), "a pending certificate with no file is not a document");
assert.ok(ids.includes("training-t1"));
assert.ok(!ids.includes("training-t2"));

// Identity: copies only.
assert.equal(groupOf("doc-passport"), "identity");
assert.ok(!ids.includes("doc-iqama"), "a number without a copy is not archived");
assert.equal(groupOf("qualification-0"), "identity");
assert.equal(groupOf("night-medical"), "identity");

// Custody and exit.
assert.equal(byId["custody-in-a1"].proof.id, "ack");
assert.equal(byId["custody-out-a1"].proof.id, "signed");
assert.ok(!ids.includes("custody-in-a2"), "handover without a receipt is not a document");
assert.equal(groupOf("custody-req-r7"), "custody");
assert.equal(groupOf("docs-return-r8"), "custody");
assert.equal(byId["exit-notice"].title, "خطاب الاستقالة");

// Acknowledgements.
assert.equal(byId["regulation-ack"].proof.id, "ack");
assert.equal(byId["consent-r5"].proof.id, "sealed");
assert.equal(byId["consent-r5"].verifyHref, "/verify?id=NV-CNS-5");
assert.ok(!ids.includes("consent-r6"), "open consent is still a request");
assert.equal(byId["signing-s1"].verifyHref, "/verify?id=PWC-1");
assert.equal(byId["signing-s1"].title, "محضر");
assert.ok(!ids.includes("signing-s2") && !ids.includes("signing-s3") && !ids.includes("signing-s4"));
assert.equal(byId["sealed-sd1"].verifyHref, "/verify?id=NV-SIG-1");
assert.ok(!ids.includes("sealed-sd2"));

// Never: pay slips, leave, edits, overtime.
assert.ok(!ids.some((id) => /leave|lv|payslip|log|r9/.test(id)), ids.join(","));

// Newest first inside a group, empty groups hidden.
for (const g of a.groups) {
  const dated = g.items.filter((row) => row.date).map((row) => row.date);
  assert.deepEqual(dated, [...dated].sort().reverse(), g.id);
  assert.ok(g.items.length || g.missing.length);
}
assert.deepEqual(byId["letter-r1"].at, "2 أكتوبر 2026");

// Manager view: nothing missing on a full file.
const m = buildFileArchive({ employee: full(), cases, managerView: true, today: TODAY });
assert.ok(m.groups.every((g) => g.missing.length === 0));

// Manager view on a bare, ended file: contract (Art. 51) and service certificate (Art. 64), one line each.
{
  const bare = { id: "e2", name: "عمر", profile: { hireDate: "2020-01-15", contractExit: { effectiveDate: "2026-09-01" } } };
  const mm = buildFileArchive({ employee: bare, managerView: true, today: TODAY, profileHref: "/app/employees/e2" });
  const miss = mm.groups.flatMap((g) => g.missing);
  assert.deepEqual(miss.map((row) => row.id), ["missing-contract", "missing-service-certificate"]);
  assert.equal(miss[0].note, "غير مؤرشف");
  assert.equal(miss[0].hint.word, "التزامك");
  assert.equal(miss[0].hint.law.article, "51");
  assert.equal(miss[1].hint.law.article, "64");
  assert.equal(mm.empty, false);
  // Self view never shows the missing lines.
  const self = buildFileArchive({ employee: bare, managerView: false, today: TODAY });
  assert.equal(self.groups.length, 0);
  assert.equal(self.empty, true);
}

// Filter + search.
{
  const only = filterFileArchive(a, { group: "letters" });
  assert.deepEqual(only.map((g) => g.id), ["letters"]);
  const q = filterFileArchive(a, { query: "رافعات" });
  assert.equal(q.length, 1);
  assert.deepEqual(q[0].items.map((row) => row.id), ["training-t1"]);
  assert.equal(filterFileArchive(a, { query: "لا يوجد شيء كهذا" }).length, 0);
  assert.equal(filterFileArchive(a, { query: "nv-sal" })[0].items[0].id, "letter-r2");
}

// The preview employee: the signed closed sanction, the first-aid certificate; his refusal is not his signature.
{
  const omar = {
    id: "emp_field_preview",
    name: "عمر ناصر",
    email: "omar@nirovera.local",
    profile: { hireDate: "2020-01-15", nationality: "مصري", idType: "iqama", nationalId: "2000000001" },
    certificates: [{ id: "cert_fa_preview", name: "الإسعافات الأولية", code: "fa", expiryDate: "2026-10-01", status: "approved" }],
    docs: [{ kind: "driving_licence", number: "DL-1", expiryDate: "2026-09-30" }],
    otherRequests: [{ id: "wcon_preview_field", type: "written_consent", status: "open" }],
  };
  const pcases = [
    { id: "dsc_preview_field_defence", employeeId: omar.id, status: "hearing" },
    { id: "dsc_preview_closed_year", employeeId: omar.id, status: "closed", penalty: "حسم يومين", cutDays: 2, signedAt: "2025-08-12T10:00:00", signedBy: "نيار عبدالله", rulingAt: "2025-08-12T16:00:00", rulingLabel: "نُفّذ وأُغلق" },
  ];
  const sr = buildDummySignatureRequests({ companyId: "c", actor: { id: "emp_owner_preview" }, employees: dummySigningEmployees() });
  const pa = buildFileArchive({ employee: omar, cases: pcases, signatureRequests: sr, managerView: true, today: TODAY, profileHref: "/app/employees/emp_field_preview" });
  assert.deepEqual(pa.groups.map((g) => g.id), ["contracts", "decisions", "letters"]);
  assert.deepEqual(pa.groups.flatMap((g) => g.items.map((row) => row.id)), ["sanction-dsc_preview_closed_year", "cert-cert_fa_preview"]);
  assert.deepEqual(pa.groups[0].missing.map((row) => row.id), ["missing-contract"]);
}

console.log("test-file-archive: all assertions passed");
