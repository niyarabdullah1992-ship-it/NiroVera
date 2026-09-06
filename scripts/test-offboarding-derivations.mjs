import assert from "node:assert/strict";
import {
  ANNUAL_ENTITLEMENT_DAYS,
  serviceYears,
  isPreStart,
  finalWage,
  eosGratuity,
  eosResignationFraction,
  unusedAnnualDays,
  leaveCashout,
  outstandingCount,
  isOffboardingGateOpen,
  deriveEos,
  enrichOffboardingCase,
  checkMarkReturnedGate,
  checkCompleteOffboardingGate,
  deriveSettlementDeadline,
} from "../src/lib/offboardingDerivations.js";
import { accruedAnnualDaysAtExit, anniversaryYearWindow } from "../src/lib/leaveTypes.js";

assert.equal(ANNUAL_ENTITLEMENT_DAYS, 21);

// Fixed clock: 2026-08-11 — hire 2019-02-03 ≈ 7.51 years
const NOW = new Date(2026, 7, 11).getTime();
const yrs = serviceYears("2019-02-03", NOW);
assert.ok(yrs > 7.4 && yrs < 7.6);
assert.equal(isPreStart("2027-01-01", NOW), true);
assert.equal(isPreStart("2019-02-03", NOW), false);

assert.equal(finalWage(9800, 2600), 12400);
// 7.5y @ 12400 → (5*0.5 + 2.5)*12400 = 5*12400 = 62000
assert.equal(eosGratuity(7.5, 12400), 62000);
assert.equal(eosGratuity(3, 10000), 15000); // 3 * 0.5 * 10000
assert.equal(unusedAnnualDays(12), 9);
assert.equal(leaveCashout(12400, 9), Math.round((12400 / 30) * 9));

const assets = [
  { id: "a1", name: "Radio", serial: "RAD-1", status: "outstanding" },
  { id: "a2", name: "Laptop", serial: "LAP-1", status: "returned", returnedAt: "2026-08-01" },
];
assert.equal(outstandingCount(assets), 1);
assert.equal(isOffboardingGateOpen(assets), false);
assert.equal(isOffboardingGateOpen([{ ...assets[0], status: "returned" }, assets[1]]), true);

const caseRow = {
  employeeId: "e1",
  hireDate: "2019-02-03",
  base: 9800,
  allowances: 2600,
  annualLeaveUsed: 12,
  status: "in_progress",
  safetyCleared: true,
  assets: [
    { id: "a1", name: "Radio", serial: "RAD-2291", status: "outstanding" },
    { id: "a2", name: "Laptop", serial: "LAP-0847", status: "outstanding" },
    { id: "a3", name: "Badge", serial: "BDG-1042", status: "outstanding" },
    { id: "a4", name: "PPE", serial: "PPE-3310", status: "outstanding" },
  ],
};

assert.equal(checkMarkReturnedGate(null, "a1").error, "CASE_NOT_FOUND");
assert.equal(checkMarkReturnedGate(caseRow, "missing").error, "ASSET_NOT_FOUND");
assert.equal(checkMarkReturnedGate(caseRow, "a1").ok, true);
assert.equal(
  checkMarkReturnedGate(
    { ...caseRow, assets: caseRow.assets.map((a) => (a.id === "a1" ? { ...a, status: "returned" } : a)) },
    "a1",
  ).error,
  "ALREADY_RETURNED",
);

assert.equal(checkCompleteOffboardingGate(caseRow).error, "ASSETS_OUTSTANDING");
assert.equal(checkCompleteOffboardingGate({ ...caseRow, assets: [] }).error, "NO_ASSETS");
assert.equal(
  checkCompleteOffboardingGate({
    ...caseRow,
    assets: caseRow.assets.map((a) => ({ ...a, status: "returned", returnedAt: "2026-08-10" })),
    contractExit: { reason: "mutual" },
  }).ok,
  true,
);
assert.equal(
  checkCompleteOffboardingGate({ ...caseRow, status: "completed" }).error,
  "ALREADY_COMPLETED",
);

const blocked = enrichOffboardingCase(caseRow, NOW);
assert.equal(blocked.outstandingCount, 4);
assert.equal(blocked.gateOpen, false);
assert.equal(blocked.steps.find((s) => s.id === "assets").state, "blocked");
assert.equal(blocked.steps.find((s) => s.id === "access").state, "on_completion");

const eos = deriveEos(caseRow, NOW);
const win = anniversaryYearWindow("2019-02-03", "2026-08-11");
assert.equal(win.start, "2026-02-03");
assert.equal(win.end, "2027-02-02");
const accrued = accruedAnnualDaysAtExit("2019-02-03", 30, "2026-08-11");
assert.equal(eos.unusedAnnualDays, Math.round((accrued - 12) * 10) / 10);
assert.equal(eos.wage, 12400);
assert.ok(eos.unusedAnnualDays > 0 && eos.unusedAnnualDays < 18);
assert.ok(eos.total > eos.gratuity);
assert.equal(eos.preStart, false);
assert.equal(eos.citeRuleId, "eos.gratuity.cite");
assert.equal(eos.fraction, 1);
assert.equal(eos.art80, false);
assert.equal(eos.art81, false);
assert.equal(eos.art87, false);
assert.equal(eos.unlawful.includedInTotal, false);
assert.equal(eos.total, eos.gratuity + eos.leaveCash);
assert.ok(eos.unlawful.amount >= eos.wage * 2);
assert.equal(eos.unlawful.cite?.article, "77");

const resigned = deriveEos({ ...caseRow, contractExit: { reason: "resignation" } }, NOW);
assert.equal(resigned.citeRuleId, "eos.resignation.cite");
assert.equal(resigned.fraction, 2 / 3);
assert.equal(resigned.gratuity, Math.round(resigned.article84Full * 2 / 3));

assert.equal(eosResignationFraction(1.5), 0);
assert.equal(eosResignationFraction(3), 1 / 3);
assert.equal(eosResignationFraction(7.5), 2 / 3);
assert.equal(eosResignationFraction(10), 1);

const art81 = deriveEos({ ...caseRow, contractExit: { reason: "article_81" } }, NOW);
assert.equal(art81.art81, true);
assert.equal(art81.art87, false);
assert.equal(art81.gratuity, art81.article84Full);
assert.equal(art81.citeRuleId, "eos.art81.cite");

const art80 = deriveEos({ ...caseRow, contractExit: { reason: "article_80" } }, NOW);
assert.equal(art80.art80, true);
assert.equal(art80.fraction, 0);
assert.equal(art80.gratuity, 0);
assert.ok(art80.leaveCash > 0);
assert.equal(art80.citeRuleId, "eos.art80.cite");
assert.equal(art80.total, art80.leaveCash);

const art87 = deriveEos({
  ...caseRow,
  gender: "female",
  profile: { gender: "female", marriageDate: "2026-04-01" },
  contractExit: { reason: "resignation" },
}, NOW);
assert.equal(art87.art87, true);
assert.equal(art87.art81, false);
assert.equal(art87.fraction, 1);
assert.equal(art87.citeRuleId, "eos.art87.cite");

const forceMajeure = deriveEos({ ...caseRow, contractExit: { reason: "force_majeure" } }, NOW);
assert.equal(forceMajeure.art87, false);
assert.equal(forceMajeure.fraction, 1);
assert.equal(forceMajeure.gratuity, forceMajeure.article84Full);
assert.equal(forceMajeure.citeRuleId, "eos.gratuity.cite");

const pre = deriveEos({ ...caseRow, hireDate: "2027-01-01" }, NOW);
assert.equal(pre.preStart, true);
assert.equal(pre.total, 0);

const open = enrichOffboardingCase({
  ...caseRow,
  assets: caseRow.assets.map((a) => ({ ...a, status: "returned", returnedAt: "2026-08-10" })),
}, NOW);
assert.equal(open.gateOpen, true);
assert.equal(open.steps.find((s) => s.id === "assets").state, "done");

const settleEmployer = deriveSettlementDeadline({ reason: "article_80", lastWorkDate: "2026-08-01", today: "2026-08-11" });
assert.equal(settleEmployer.days, 7);
assert.equal(settleEmployer.due, "2026-08-08");
assert.equal(settleEmployer.late, true);

const settleWorker = deriveSettlementDeadline({ reason: "resignation", lastWorkDate: "2026-08-01", today: "2026-08-11" });
assert.equal(settleWorker.days, 14);
assert.equal(settleWorker.due, "2026-08-15");
assert.equal(settleWorker.late, false);

console.log("offboarding derivations ok");
