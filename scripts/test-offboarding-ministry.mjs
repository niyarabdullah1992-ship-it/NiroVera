/** «أنظمة الوزارة — نهاية الخدمة»: rows derived from the exit file through the existing offboarding
 *  derivations — notice 75–77, job search 78, Art. 81, award 84–85, certificate 64, settlement 88,
 *  leave pay 111, Regs 22 bis, model 11 and 57 — and the shared counts the index reads. */
import assert from "node:assert/strict";
import { hasRecordedExit, offboardingMinistryRows, OFFBOARDING_MINISTRY_CARDS } from "../src/lib/offboardingMinistryRows.js";
import { deriveSettlementDeadline } from "../src/lib/offboardingDerivations.js";
import { ministryCounts, ministryCountsAcross } from "../src/lib/ministryCounts.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };
const D = "2026-10-16";

const saudi = (exit = null, extra = {}) => ({
  id: "s1",
  hireDate: "2019-01-01",
  profile: { nationality: "سعودي", nationalId: "1123456789", baseSalary: 9000, allowances: 1000, contractType: "indefinite", ...(exit ? { contractExit: exit } : {}), ...extra },
  leaveRequests: [],
  otherRequests: [],
});
const rowsOf = (employee, extra = {}) => offboardingMinistryRows({ employee, today: D, ar: true, ...extra });
const by = (rows, key) => rows.find((row) => row.key === key);

ok("no exit on file: every row is for reference, the award reads as today's estimate", () => {
  const rows = rowsOf(saudi());
  assert.equal(hasRecordedExit(saudi()), false);
  assert.deepEqual(ministryCounts(rows), { block: 0, alert: 0, met: 0, info: rows.length });
  assert.match(by(rows, "labour-84").pill, /تقدير اليوم/);
  assert.match(by(rows, "labour-75").pill, /60 يوماً عند الإنهاء/);
  assert.deepEqual([...new Set(rows.map((row) => row.source))].sort(), OFFBOARDING_MINISTRY_CARDS().map((card) => card.key).sort());
  assert.equal(rows.filter((row) => row.key.startsWith("model-")).map((row) => row.badge).join(" "), "النموذج الموحد م11 النموذج الموحد م57");
});

ok("Arts. 75–76: a worker's notice served in full is met; a short one owes its wage", () => {
  const full = rowsOf(saudi({ reason: "resignation", party: "worker", noticeGivenDate: "2026-08-01", effectiveDate: "2026-08-31" }));
  assert.equal(by(full, "labour-75").status, "settled");
  assert.match(by(full, "labour-75").pill, /30 من 30/);
  const short = rowsOf(saudi({ reason: "resignation", party: "worker", noticeGivenDate: "2026-10-01", effectiveDate: "2026-10-11" }));
  assert.equal(by(short, "labour-75").status, "alert");
  assert.match(by(short, "labour-75").pill, /نقص 20 يوماً/);
  const pending = rowsOf(saudi({ reason: "closure", party: "employer" }));
  assert.equal(by(pending, "labour-75").status, "waiting");
  assert.equal(by(rowsOf(saudi({ reason: "article_80", effectiveDate: "2026-10-10" })), "labour-75").status, "void");
});

ok("Art. 78: the employer's notice running → a weekly job-search day is open; the worker's notice → n/a", () => {
  const running = rowsOf(saudi({ reason: "closure", party: "employer", noticeGivenDate: "2026-10-01", effectiveDate: "2026-11-30" }));
  assert.equal(by(running, "labour-78").status, "waiting");
  assert.match(by(running, "labour-78").pill, /2026-11-30/);
  assert.match(by(rowsOf(saudi({ reason: "resignation", party: "worker", effectiveDate: "2026-11-30" })), "labour-78").pill, /الإشعار من العامل/);
});

ok("Arts. 84–85 / 81: resignation takes its fraction; Art. 81 keeps the full award", () => {
  const resign = rowsOf(saudi({ reason: "resignation", party: "worker", noticeGivenDate: "2026-09-01", effectiveDate: "2026-10-01" }));
  assert.equal(by(resign, "labour-84").status, "settled");
  assert.match(by(resign, "labour-84").pill, /ثلثا المكافأة/);
  const left81 = rowsOf(saudi({ reason: "article_81", effectiveDate: "2026-10-01" }));
  assert.match(by(left81, "labour-84").pill, /كاملة — المادة 81/);
  assert.equal(by(left81, "labour-81").status, "settled");
  assert.equal(by(resign, "labour-81").status, "void");
});

ok("Art. 64: the certificate and the documents gate the close-out", () => {
  const none = rowsOf(saudi({ reason: "contract_end", effectiveDate: "2026-10-10" }));
  assert.equal(by(none, "labour-64").status, "blocked");
  assert.match(by(none, "labour-64").pill, /الشهادة/);
  const docs = rowsOf(saudi({ reason: "contract_end", effectiveDate: "2026-10-10", serviceCertificateIssued: true }));
  assert.match(by(docs, "labour-64").pill, /الوثائق/);
  const done = rowsOf(saudi({ reason: "contract_end", effectiveDate: "2026-10-10", serviceCertificateIssued: true, documentsReturned: true }));
  assert.equal(by(done, "labour-64").status, "settled");
});

ok("Art. 88: one week when the employer ended it, two when the worker did; overdue / paid read from the deadline", () => {
  const employer = rowsOf(saudi({ reason: "closure", party: "employer", effectiveDate: "2026-10-05" }));
  const deadline = deriveSettlementDeadline({ reason: "closure", lastWorkDate: "2026-10-05", today: D });
  assert.equal(deadline.due, "2026-10-12");
  assert.equal(by(employer, "labour-88").status, "violation");
  assert.match(by(employer, "labour-88").pill, /2026-10-12/);
  const worker = rowsOf(saudi({ reason: "resignation", party: "worker", effectiveDate: "2026-10-05" }));
  assert.equal(by(worker, "labour-88").status, "waiting");
  assert.match(by(worker, "labour-88").pill, /حتى 2026-10-19/);
  const paid = rowsOf(saudi({ reason: "closure", party: "employer", effectiveDate: "2026-10-05", settlementPaidAt: "2026-10-09" }));
  assert.equal(by(paid, "labour-88").status, "settled");
  const late = rowsOf(saudi({ reason: "closure", party: "employer", effectiveDate: "2026-10-05", settlementPaidAt: "2026-10-14" }));
  assert.equal(by(late, "labour-88").status, "alert");
  assert.equal(by(rowsOf(saudi({ reason: "closure" })), "labour-88").status, "waiting");
});

ok("Art. 111 and Regs 22 bis: balances open until the settlement is paid", () => {
  const comp = { id: "ot1", type: "overtime", assignment: true, status: "approved", compensation: "credit", hours: 4, date: "2026-09-20", enjoyDate: "2026-11-15" };
  const emp = saudi({ reason: "resignation", party: "worker", effectiveDate: "2026-10-10" });
  emp.otherRequests = [comp];
  const open = rowsOf(emp);
  assert.equal(by(open, "regs-22bis").status, "waiting");
  assert.match(by(open, "regs-22bis").pill, /6 ساعة/);
  assert.equal(by(open, "labour-111").status, "waiting");
  emp.profile.contractExit.settlementPaidAt = "2026-10-12";
  const paid = rowsOf(emp);
  assert.equal(by(paid, "regs-22bis").status, "settled");
  assert.equal(by(paid, "labour-111").status, "settled");
  assert.equal(by(rowsOf(saudi({ reason: "resignation", effectiveDate: "2026-10-10" })), "regs-22bis").pill, "لا رصيد تعويضي");
});

ok("model 57 is for reference with the recorded reason; a completed case counts its certificate met", () => {
  const rows = rowsOf(saudi({ reason: "retirement", effectiveDate: "2026-10-01" }), { caseRow: { status: "completed" } });
  assert.equal(by(rows, "model-57").status, "void");
  assert.match(by(rows, "model-57").sub, /بلوغ سن التقاعد/);
  assert.equal(by(rows, "labour-64").status, "settled");
});

ok("index counts: one person's rows equal the panel's; across people, reference rules count once", () => {
  const a = rowsOf(saudi({ reason: "closure", party: "employer", effectiveDate: "2026-10-05" }));
  const b = rowsOf(saudi({ reason: "resignation", party: "worker", noticeGivenDate: "2026-09-01", effectiveDate: "2026-10-01", serviceCertificateIssued: true, documentsReturned: true }));
  const ca = ministryCounts(a);
  const cb = ministryCounts(b);
  assert.deepEqual(ministryCountsAcross([a]), ca);
  const both = ministryCountsAcross([a, b]);
  assert.equal(both.block, ca.block + cb.block);
  assert.equal(both.alert, ca.alert + cb.alert);
  assert.equal(both.met, ca.met + cb.met);
  const refKeys = new Set([...a, ...b].filter((row) => row.status === "void").map((row) => row.key));
  assert.equal(both.info, refKeys.size);
  assert.equal(ca.block, 2, "the certificate gate and the overdue settlement");
  assert.ok(ca.alert + ca.block + ca.met + ca.info === a.length);
});

console.log(`offboarding ministry: ${n} checks passed`);
