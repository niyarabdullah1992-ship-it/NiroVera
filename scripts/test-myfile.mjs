import assert from "node:assert/strict";
import { buildServiceStory, classifyFileLogLine } from "../src/lib/serviceStory.js";
import { buildFileReadiness, CORRECTION_HREF, ownerWord } from "../src/lib/fileReadiness.js";
import { buildMyFileCard, fileSealCode, fileSealText, formatSealCode, nameInitials } from "../src/lib/myFileCard.js";

const TODAY = "2026-10-16";

const base = () => ({
  id: "e1",
  name: "سالم أحمد العتيبي",
  employeeNo: "NV-2023-0007",
  profile: {
    hireDate: "2023-03-01",
    position: "فني صيانة",
    contractType: "fixed",
    contract: { type: "fixed", generated: true, workerAck: { at: "2023-03-02T09:00:00Z", hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90" } },
    qiwaTitle: "فني صيانة",
    gosiNumber: "123456789",
    nationality: "سعودي",
    idType: "national_id",
    idExpiry: "2030-01-01",
    iban: "SA0000000000000000000000",
    medicalInsuranceExpiry: "2027-06-01",
    emergencyName: "أحمد",
    emergencyPhone: "0500000000",
    religion: "muslim",
  },
  trainings: [{ id: "t1", course: "السلامة الكهربائية", provider: "معهد الطاقة", from: "2025-05-01", to: "2025-05-03", hours: 24 }],
  stationMoves: [{ at: "2024-07-10", fromName: "الرس 1", toName: "الرس 2", by: "مدير العمليات" }],
  fileLog: [
    { text: "تعديل الأجر الأساسي إلى 6,000", by: "نورة", at: "2026-02-01 10:00" },
    { text: "تعديل بيانات الملف", by: "نورة", at: "2026-02-02 10:00" },
    { text: "إصابة عمل — النتيجة: شفاء", by: "نورة", at: "2026-03-01 10:00" },
    { text: "إجازة سنوية معتمدة", by: "نورة", at: "2026-04-01 10:00" },
    { text: "طلب تبديل وردية", by: "نورة", at: "2026-04-02 10:00" },
  ],
});

/* ── file-log classification ── */
assert.equal(classifyFileLogLine("تعديل الأجر الأساسي"), "wage");
assert.equal(classifyFileLogLine("نقل إلى الفرع الشمالي"), "move");
assert.equal(classifyFileLogLine("إنهاء العقد — وفاة العامل (المادة 79)"), "exit");
assert.equal(classifyFileLogLine("إصابة عمل — أيام التنويم"), "", "injuries stay in طلباتي");
assert.equal(classifyFileLogLine("إجازة سنوية"), "", "leave stays in طلباتي");
assert.equal(classifyFileLogLine("طلب تبديل وردية"), "", "«تبديل» is not «بدل»");
assert.equal(classifyFileLogLine("تعديل بيانات الملف"), "", "generic edits are not story");

/* ── service story ── */
{
  const emp = base();
  const cases = [
    { id: "c1", employeeId: "e1", status: "appeal", signedAt: "2025-09-01", signedBy: "مدير الموارد", penaltyKind: "warning_written", reason: "تأخر متكرر", appealedAt: "2025-09-05", finalHash: "ffeeddccbbaa99887766" },
    { id: "c2", employeeId: "e1", status: "notice", createdAt: "2026-01-01" },
    { id: "c3", employeeId: "other", status: "decision", signedAt: "2025-01-01" },
  ];
  const assets = [{ id: "a1", holderId: "e1", name: "حاسب محمول", serial: "LT-9", handedAt: "2024-01-15", ackAt: "2024-01-15", returnedAt: "2026-06-01" }];
  const regulation = { source: "own", announcedAt: "2025-01-01", version: "v2", acks: { e1: { at: "2025-01-03", version: "v2" } } };
  const story = buildServiceStory({ employee: emp, cases, assets, regulation, roleLabel: "فني صيانة", selfView: true, today: TODAY });

  const all = story.years.flatMap((y) => y.events);
  assert.equal(story.count, all.length);
  // newest first
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].date >= all[i].date, "events are newest first");
  // years newest first, current open, older folded
  assert.deepEqual(story.years.map((y) => y.year), ["2026", "2025", "2024", "2023"]);
  assert.equal(story.years[0].current, true);
  assert.equal(story.years[0].open, true);
  assert.ok(story.years.slice(1).every((y) => !y.open), "older years start folded");

  const by = (id) => all.find((e) => e.id === id);
  assert.match(by("hire").text, /الالتحاق بالعمل على وظيفة «فني صيانة»/);
  assert.equal(by("hire").proof.id, "log");
  assert.equal(by("contract-ack").proof.id, "sealed", "a stored contract hash makes it «مختوم»");
  assert.equal(by("contract-ack").proof.hash, "a1b2c3d4");
  assert.equal(by("contract-ack").actor, "أنت", "the worker's own act reads «أنت» on his own file");
  assert.equal(by("regulation").proof.id, "ack");
  assert.equal(by("training-t1").date, "2025-05-03");
  assert.match(by("training-t1").text, /24 ساعة/);
  assert.equal(by("move-0").proof.id, "log");
  assert.match(by("move-0").text, /من الرس 1 إلى الرس 2/);
  // His own story carries no sanction or grievance — those live in «الجزاءات» only.
  assert.ok(!all.some((e) => e.kind === "sanction"), "no sanction on the worker's own story");
  // The HR / manager view keeps them: only what was signed, with the grievance.
  const hrAll = buildServiceStory({ employee: emp, cases, assets, regulation, roleLabel: "فني صيانة", today: TODAY }).years.flatMap((y) => y.events);
  const hrBy = (id) => hrAll.find((e) => e.id === id);
  assert.equal(hrBy("sanction-c1").proof.id, "sealed");
  assert.equal(hrBy("sanction-c1").actor, "مدير الموارد");
  assert.equal(hrBy("grievance-c1").proof.id, "signed");
  assert.ok(!hrBy("sanction-c2"), "an unsigned case is not on the story");
  assert.ok(!hrAll.some((e) => e.id.endsWith("c3")), "another worker's case is not here");
  assert.equal(by("custody-in-a1").proof.id, "ack");
  assert.equal(by("custody-out-a1").date, "2026-06-01");
  // file log: wage kept, injuries/leave/generic edits dropped
  const logs = all.filter((e) => e.id.startsWith("log-"));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].kind, "wage");
  assert.equal(logs[0].actor, "نورة");
  assert.ok(!all.some((e) => /إصابة|إجازة/.test(e.text)), "no injuries or leave on the story");

  // manager view names the worker, not «أنت»
  const mgr = buildServiceStory({ employee: emp, regulation, today: TODAY });
  assert.equal(mgr.years.flatMap((y) => y.events).find((e) => e.id === "contract-ack").actor, "سالم أحمد العتيبي");

  // a regulation ack for an older version says so
  const old = buildServiceStory({ employee: emp, regulation: { ...regulation, version: "v3" }, today: TODAY });
  assert.match(old.years.flatMap((y) => y.events).find((e) => e.id === "regulation").text, /نسخة سابقة/);
}

{
  // uploaded copy without a hash → «موقّع»; future events are not shown; quiet current year keeps newest open
  const emp = { id: "e2", name: "ريم", profile: { hireDate: "2024-02-01", contract: { fileName: "contract.pdf", signedAt: "2024-02-01" }, contractExit: { reason: "resignation", party: "worker", resignationSubmittedAt: "2025-11-01", effectiveDate: "2026-12-01" } } };
  const story = buildServiceStory({ employee: emp, today: "2026-10-16", selfView: false });
  const all = story.years.flatMap((y) => y.events);
  assert.equal(all.find((e) => e.id === "contract-file").proof.id, "signed");
  assert.equal(all.find((e) => e.id === "exit-notice").text, "قدّم الاستقالة");
  assert.ok(!all.find((e) => e.id === "exit-end"), "an end date still ahead is not yet history");
  assert.equal(story.years[0].year, "2025");
  assert.equal(story.years[0].open, true, "when this year is quiet the newest year stays open");
}

{
  const empty = buildServiceStory({ employee: { id: "x", profile: {} }, today: TODAY });
  assert.deepEqual(empty, { years: [], count: 0 });
  assert.deepEqual(buildServiceStory({}), { years: [], count: 0 });
}

/* ── readiness ── */
{
  const full = buildFileReadiness({ employee: base(), roleLabel: "فني صيانة", today: TODAY });
  assert.equal(full.open.length, 0, `complete file: ${full.open.map((r) => r.id).join(",")}`);
  assert.equal(full.filled, full.total);
  assert.ok(full.items.every((r) => !r.hint), "nothing to claim on a complete file");
}

{
  const emp = base();
  Object.assign(emp.profile, {
    contract: {}, qiwaTitle: "", gosiNumber: "", iban: "", idType: "iqama", idExpiry: "2026-10-30", passportExpiry: "2026-09-01",
    medicalInsuranceExpiry: "", emergencyPhone: "", religion: "", position: "",
  });
  const regulation = { source: "own", announcedAt: "2025-01-01", version: "v2", acks: {} };
  const self = buildFileReadiness({ employee: emp, regulation, roleLabel: "", today: TODAY, view: "employee" });
  const get = (r, id) => r.items.find((x) => x.id === id);
  const ids = self.open.map((r) => r.id).sort();
  assert.deepEqual(ids, ["contract", "emergency", "gosi", "iban", "id", "job", "medical", "passport", "qiwa", "regulation", "religion"].sort());
  assert.equal(self.total, 11);
  assert.equal(self.filled, 0);

  // owners and words on the worker's own file
  assert.equal(get(self, "iban").owner, "self");
  assert.equal(get(self, "iban").ownerLabel, "عليّ");
  assert.equal(get(self, "iban").action ?? null, null, "no repeated correction link per row — the file header holds the one link");
  assert.equal(get(self, "qiwa").ownerLabel, "على الموارد البشرية");
  assert.equal(get(self, "qiwa").hint, null, "Qiwa is a platform — no article chip");
  assert.equal(get(self, "gosi").hint, null);
  assert.equal(get(self, "medical").hint, null);
  // iqama ending → employer's cost, Art. 40
  assert.equal(get(self, "id").state, "expiring");
  assert.equal(get(self, "id").owner, "hr");
  assert.equal(get(self, "id").hint.law.article, "40");
  assert.equal(get(self, "id").hint.word, "حقك");
  assert.equal(get(self, "passport").owner, "self");
  assert.equal(get(self, "passport").state, "expired");
  // contract: Art. 51 hint with the request-a-copy flow
  assert.equal(get(self, "contract").hint.law.article, "51");
  assert.match(get(self, "contract").hint.action.to, /doc=contract/);
  assert.equal(get(self, "job").hint.law.article, "64");
  assert.match(get(self, "religion").note, /المادة 114/);
  assert.equal(get(self, "regulation").action.to, "/app/discipline?tab=schedule");

  // manager: owners reversed, «التزامك», no employee flows
  const mgr = buildFileReadiness({ employee: emp, regulation, today: TODAY, view: "manager" });
  assert.equal(get(mgr, "iban").ownerLabel, "عليه");
  assert.equal(get(mgr, "iban").action, null);
  assert.equal(get(mgr, "qiwa").ownerLabel, "عليك");
  assert.equal(get(mgr, "qiwa").action.tab, "compliance");
  assert.equal(get(mgr, "id").hint.word, "التزامك");
  assert.equal(get(mgr, "id").hint.action, null);
  assert.equal(get(mgr, "id").hint.due, "2026-10-30");
  assert.match(get(mgr, "id").hint.right, /سالم أحمد العتيبي/);
  assert.equal(get(mgr, "contract").hint.view, "manager");
}

{
  // a generated contract waiting for the signature is the worker's move
  const emp = base();
  emp.profile.contract = { generated: true };
  const r = buildFileReadiness({ employee: emp, roleLabel: "فني", today: TODAY });
  const c = r.items.find((x) => x.id === "contract");
  assert.equal(c.owner, "self");
  assert.equal(c.action.tab, "contract");
  assert.equal(c.hint, null);
  // expired national ID is the worker's, with no Art. 40 chip
  emp.profile.idExpiry = "2026-01-01";
  const r2 = buildFileReadiness({ employee: emp, roleLabel: "فني", today: TODAY });
  const id = r2.items.find((x) => x.id === "id");
  assert.equal(id.state, "expired");
  assert.equal(id.owner, "self");
  assert.equal(id.hint, null);
  // no own regulation announced → no acknowledgement item
  assert.ok(!r2.items.some((x) => x.id === "regulation"));
}

assert.equal(ownerWord("self", false), "عليّ");
assert.equal(ownerWord("hr", true), "عليك");

/* ── card and seal ── */
{
  assert.equal(nameInitials("سالم أحمد العتيبي"), "س‌ا");
  assert.equal(nameInitials("ريم"), "ر");
  assert.equal(nameInitials(""), "—");
  const card = buildMyFileCard({ employee: base(), roleLabel: "فني صيانة", stationName: "الرس 1", today: TODAY });
  assert.equal(card.job, "فني صيانة");
  assert.equal(card.branch, "الرس 1");
  assert.deepEqual(card.rows.map((r) => r.id), ["no", "hire", "service", "contract", "qiwa", "gosi", "nationality"]);
  assert.equal(card.rows.find((r) => r.id === "no").v, "NV-2023-0007");
  assert.equal(card.rows.find((r) => r.id === "no").mono, true);
  assert.match(card.rows.find((r) => r.id === "service").v, /3 سنوات/);
  assert.ok(card.rows.every((r) => !r.gap), "complete card has no gaps");
  assert.ok(!card.rows.some((r) => /أجر|راتب|رصيد|wage/.test(r.k)), "no pay or balance on the card");
  const gaps = buildMyFileCard({ employee: { id: "z", name: "ز", profile: { qiwaRegistered: false } }, today: TODAY });
  assert.equal(gaps.rows.find((r) => r.id === "qiwa").v, "غير مسجَّل");
  assert.ok(gaps.rows.find((r) => r.id === "gosi").gap);

  // the seal is derived: same facts → same code; a changed fact → a new code
  const a = fileSealText(base(), { roleLabel: "فني صيانة", stationName: "الرس 1" });
  const b = fileSealText(base(), { roleLabel: "فني صيانة", stationName: "الرس 1" });
  assert.equal(a, b);
  const moved = fileSealText(base(), { roleLabel: "فني صيانة", stationName: "الرس 2" });
  assert.notEqual(a, moved);
  const codeA = await fileSealCode(a);
  assert.match(codeA, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal(await fileSealCode(b), codeA);
  assert.notEqual(await fileSealCode(moved), codeA);
  assert.equal(formatSealCode("abc"), "");
  assert.equal(formatSealCode("0123456789abcdef"), "0123-4567-89AB");
}

console.log("PASS test-myfile");
