// Arts. 75–77 at the end of service: Art. 77 compensation (who, how much, to which day) and Art. 76
// notice pay — the same cases on the client lib and its server mirror.
import assert from "node:assert/strict";
import * as js from "../src/lib/offboardingDerivations.js";
import * as ts from "../base44/shared/offboardingDerivations.ts";

const ms = (iso) => new Date(`${iso}T12:00:00`).getTime();
const base = {
  hireDate: "2020-10-24",
  base: 7000,
  allowances: 2000, // wage 9,000
  profile: {},
};
const exitOn = (reason, extra = {}) => ({ contractExit: { reason, effectiveDate: "2026-10-24", ...extra } });

for (const [name, lib] of [["client", js], ["server", ts]]) {
  const run = (row, now = ms("2027-03-01")) => lib.deriveArt77Compensation(row, now);

  // 1. Fixed term ended by the employer: wage for the days left, measured to the exit day (not "now").
  {
    const row = { ...base, contractType: "fixed", contractEndDate: "2027-03-31", ...exitOn("employer_termination") };
    const a = run(row);
    assert.equal(a.applies, true, `${name}: employer end applies`);
    assert.equal(a.direction, "to_worker");
    assert.equal(a.endDate, "2026-10-24", `${name}: measured to the exit day`);
    assert.equal(a.remainingDays, 158);
    assert.equal(a.amount, 47400, `${name}: 9000/30 × 158`);
    assert.equal(a.basis, "law");
    assert.equal(run(row, ms("2026-12-01")).amount, 47400, `${name}: same figure whatever day it is opened`);
  }

  // 2. Fixed term with little left: the two-month floor.
  {
    const a = run({ ...base, contractType: "fixed", contractEndDate: "2026-11-13", ...exitOn("employer_termination") });
    assert.equal(a.remainingDays, 20);
    assert.equal(a.amount, 18000, `${name}: floor = 2 months`);
  }

  // 3. Open-ended, ended by the employer: 15 days per year of service (6 years) — 27,000.
  {
    const a = run({ ...base, contractType: "indefinite", ...exitOn("employer_termination") });
    assert.equal(a.term, "indefinite");
    // Service years use the platform's year length (365.25 days), as the award does: ≈ 6 years.
    assert.ok(Math.abs(a.amount - 27000) <= 10, `${name}: 9000/30 × 15 × 6 ≈ 27,000 (got ${a.amount})`);
    // Two years only → the floor.
    const short = run({ ...base, hireDate: "2024-10-24", contractType: "غير محدد المدة", ...exitOn("employer_termination") });
    assert.equal(short.amount, 18000);
  }

  // 4. Reasons Art. 77 does not cover: no figure at all.
  for (const reason of ["mutual", "contract_end", "death", "disability", "retirement", "force_majeure", "article_80", ""]) {
    const a = run({ ...base, contractType: "fixed", contractEndDate: "2027-03-31", ...exitOn(reason) });
    assert.equal(a.applies, false, `${name}: ${reason || "no reason"} → no Art. 77`);
  }

  // 5. Resignation: open-ended on notice is lawful (none); a fixed term left early → the employer may claim.
  {
    assert.equal(run({ ...base, contractType: "indefinite", ...exitOn("resignation") }).applies, false);
    const early = run({ ...base, contractType: "fixed", contractEndDate: "2027-03-31", ...exitOn("resignation") });
    assert.equal(early.applies, true);
    assert.equal(early.direction, "to_employer", `${name}: the worker ended a fixed term early`);
  }

  // 6. Art. 81 (worker leaves for the employer's breach) → owed to the worker.
  assert.equal(run({ ...base, contractType: "indefinite", ...exitOn("article_81") }).direction, "to_worker");

  // 7. A compensation written in the contract replaces the statutory sum.
  {
    const a = run({ ...base, contractType: "fixed", contractEndDate: "2027-03-31", profile: { contract: { terminationCompensation: 30000 } }, ...exitOn("employer_termination") });
    assert.equal(a.basis, "contract");
    assert.equal(a.amount, 30000);
  }

  // 8. Incomplete file: no guess.
  {
    const noType = run({ ...base, ...exitOn("employer_termination") });
    assert.equal(noType.missing, "contract_type", `${name}: unknown type is not treated as open-ended`);
    assert.equal(noType.amount, null);
    const noEnd = run({ ...base, contractType: "fixed", ...exitOn("employer_termination") });
    assert.equal(noEnd.missing, "contract_end");
    assert.equal(noEnd.amount, null);
  }

  // 9. Art. 76 notice pay: employer short 20 days → owed to the worker, in the settlement.
  {
    const p = lib.deriveNoticePay({ contractExit: { reason: "employer_termination", party: "employer", noticeShortfall: 20 } }, 9000);
    assert.equal(p.amount, 6000);
    assert.equal(p.payer, "employer");
    assert.equal(p.inSettlement, true);
    assert.equal(p.cite?.article, "76");
    // Worker short → the employer may claim; never placed in the worker's settlement.
    const w = lib.deriveNoticePay({ contractExit: { reason: "resignation", party: "worker", noticeShortfall: 10 } }, 9000);
    assert.equal(w.amount, 3000);
    assert.equal(w.inSettlement, false);
    // Reasons with no notice at all.
    for (const reason of ["article_80", "article_81", "mutual", "death", "contract_end"]) {
      assert.equal(lib.deriveNoticePay({ contractExit: { reason, party: "employer", noticeShortfall: 30 } }, 9000).amount, 0, `${name}: ${reason} has no notice`);
    }
  }

  // 10. deriveEos carries both, Art. 77 stays out of the total.
  {
    const eos = lib.deriveEos({ ...base, contractType: "indefinite", contractExit: { reason: "employer_termination", party: "employer", effectiveDate: "2026-10-24", noticeShortfall: 15 } });
    assert.ok(Math.abs(eos.unlawful.amount - 27000) <= 10);
    assert.equal(eos.noticePay.amount, 4500);
    assert.equal(eos.total, eos.gratuity + eos.leaveCash, `${name}: neither is inside eos.total`);
  }
}

console.log("art77 + notice: PASS");
