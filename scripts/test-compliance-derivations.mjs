import assert from "node:assert/strict";
import {
  EXPIRY_WARN_DAYS,
  buildWpsFileRows,
  checkComplianceDocGate,
  checkGosiFileGate,
  checkNitaqatHireGate,
  checkSaudiIdentityGate,
  checkWpsFileGate,
  checkContractTermGate,
  deriveGosiMonthly,
  deriveNitaqat,
  deriveSaudiStatus,
} from "../src/lib/complianceDerivations.js";

assert.equal(EXPIRY_WARN_DAYS, 60);

const missing = checkComplianceDocGate({
  employee: { employeeId: "e1", saudi: false, docs: [] },
  today: "2026-08-12",
});
assert.equal(missing.ok, false);
assert.equal(missing.error, "DOC_MISSING");
assert.match(missing.reasonEn, /Iqama|Work permit|GOSI|Qiwa/i);

const expiring = checkComplianceDocGate({
  employee: {
    employeeId: "e2",
    saudi: true,
    nationalId: "1099999999",
    gosiNumber: "G1",
    qiwaTitle: "Operator",
    docs: [{ kind: "national_id", number: "1099999999", expiryDate: "2026-09-01" }],
  },
  today: "2026-08-12",
});
assert.equal(expiring.ok, false);
assert.equal(expiring.error, "DOC_EXPIRING");
assert.ok(expiring.docLabelEn);

const ok = checkComplianceDocGate({
  employee: {
    employeeId: "e3",
    saudi: true,
    nationalId: "1012345678",
    gosiNumber: "G2",
    qiwaTitle: "Tech",
    docs: [{ kind: "national_id", number: "1012345678", expiryDate: "2027-08-01" }],
  },
  today: "2026-08-12",
});
assert.equal(ok.ok, true);

const nitaqat = deriveNitaqat([
  { employeeId: "a", saudi: true },
  { employeeId: "b", saudi: false },
  { employeeId: "c", saudi: false },
  { employeeId: "d", saudi: false },
  { employeeId: "e", saudi: false },
  { employeeId: "f", saudi: false },
  { employeeId: "g", saudi: false },
  { employeeId: "h", saudi: false },
  { employeeId: "i", saudi: false },
  { employeeId: "j", saudi: false },
]);
assert.equal(nitaqat.rate, 10);
assert.equal(nitaqat.band, "low_green");

const hireBlocked = checkNitaqatHireGate({
  nitaqat,
  candidateSaudi: false,
  nitaqatEffectStated: false,
});
assert.equal(hireBlocked.ok, false);
assert.equal(hireBlocked.error, "NITAQAT_EFFECT_REQUIRED");

const gosi = deriveGosiMonthly([
  { employeeId: "e1", base: 4000, allowances: 1000, gosiNumber: "G1" },
]);
assert.ok(gosi.employeeTotal > 0);
assert.ok(gosi.employerTotal > 0);

assert.equal(checkGosiFileGate({ establishmentNumber: "", rows: gosi.rows }).error, "GOSI_ESTABLISHMENT_REQUIRED");
assert.equal(checkGosiFileGate({ establishmentNumber: "500", rows: gosi.rows }).ok, true);

const wpsRows = buildWpsFileRows([
  {
    employeeId: "e1",
    employeeName: "Saud",
    nationalId: "1012345678",
    iban: "SA0380000000608010167519",
    base: 4000,
    allowances: 0,
    qiwaWage: 4000,
    netPay: 3500,
  },
]);
assert.equal(checkWpsFileGate(wpsRows).ok, true);

const badIban = buildWpsFileRows([
  {
    employeeId: "e1",
    nationalId: "1012345678",
    iban: "SA00",
    base: 4000,
    allowances: 0,
    qiwaWage: 4000,
    netPay: 3500,
  },
]);
assert.equal(checkWpsFileGate(badIban).error, "IBAN_INVALID");

const mismatch = buildWpsFileRows([
  {
    employeeId: "e1",
    nationalId: "1012345678",
    iban: "SA0380000000608010167519",
    base: 4000,
    allowances: 0,
    qiwaWage: 3000,
    netPay: 3500,
  },
]);
assert.equal(checkWpsFileGate(mismatch).error, "QIWA_MISMATCH");

const citizen = deriveSaudiStatus({ nationality: "سعودي", nationalId: "1012345678" });
assert.equal(citizen.saudi, true);
assert.equal(citizen.countable, true);
assert.equal(citizen.source, "nationality+id");
assert.equal(checkSaudiIdentityGate(citizen).ok, true);

const expat = deriveSaudiStatus({ nationality: "مصري", nationalId: "2012345678" });
assert.equal(expat.saudi, false);
assert.equal(expat.countable, true);

const conflict = deriveSaudiStatus({ nationality: "سعودي", nationalId: "2012345678" });
assert.equal(conflict.mismatch, true);
assert.equal(conflict.saudi, false);
assert.equal(conflict.countable, false);
assert.equal(checkSaudiIdentityGate(conflict).error, "SAUDI_IDENTITY_MISMATCH");

const conflictGate = checkComplianceDocGate({
  employee: { employeeId: "e4", nationality: "سعودي", nationalId: "2012345678", docs: [] },
});
assert.equal(conflictGate.error, "SAUDI_IDENTITY_MISMATCH");

const natOnly = deriveSaudiStatus({ nationality: "Saudi" });
assert.equal(natOnly.saudi, true);
assert.equal(natOnly.needsId, true);
assert.equal(natOnly.source, "nationality");

const idOnly = deriveSaudiStatus({ nationalId: "1012345678" });
assert.equal(idOnly.saudi, true);
assert.equal(idOnly.needsNationality, true);
assert.equal(idOnly.source, "id");

const nitaqatFromPair = deriveNitaqat([
  { employeeId: "s1", nationality: "سعودي", nationalId: "1012345678" },
  { employeeId: "x1", nationality: "هندي", nationalId: "2012345678" },
  { employeeId: "bad", nationality: "سعودي", nationalId: "2012345678" },
]);
assert.equal(nitaqatFromPair.saudi, 1);
assert.equal(nitaqatFromPair.mismatch, 1);
assert.equal(nitaqatFromPair.total, 3);

const openEnded = checkContractTermGate({ contractType: "indefinite", today: "2026-08-12" });
assert.equal(openEnded.ok, true);
assert.equal(openEnded.term, "indefinite");

const aliasOpen = checkContractTermGate({ contractType: "unlimited", today: "2026-08-12" });
assert.equal(aliasOpen.ok, true);
assert.equal(aliasOpen.term, "indefinite");

const trialOverlay = checkContractTermGate({ contractType: "trial", today: "2026-08-12" });
assert.equal(trialOverlay.ok, true);
assert.equal(trialOverlay.term, "indefinite");

const fixedNoEnd = checkContractTermGate({ contractType: "fixed", today: "2026-08-12" });
assert.equal(fixedNoEnd.ok, false);
assert.equal(fixedNoEnd.error, "CONTRACT_END_REQUIRED");

const expired = checkContractTermGate({
  contractType: "fixed",
  contractEndDate: "2026-01-01",
  today: "2026-08-12",
});
assert.equal(expired.ok, false);
assert.equal(expired.error, "CONTRACT_EXPIRED");

const art55gate = checkContractTermGate({
  nationality: "سعودي",
  contractType: "fixed",
  contractEndDate: "2026-01-01",
  hireDate: "2025-01-01",
  today: "2026-08-12",
});
assert.equal(art55gate.ok, true);
assert.equal(art55gate.term, "indefinite");
assert.equal(art55gate.warning, "ART55_CONVERTED");

const art55midRenewal = checkContractTermGate({
  nationality: "سعودي",
  contractType: "fixed",
  contractEndDate: "2026-01-01",
  hireDate: "2024-06-01",
  today: "2026-08-12",
  profile: { contractType: "fixed", contractRenewalCount: 1, hireDate: "2024-06-01", nationality: "سعودي" },
});
assert.equal(art55midRenewal.ok, false);
assert.equal(art55midRenewal.error, "CONTRACT_EXPIRED");

const watch = checkContractTermGate({
  employee: { profile: { contractType: "fixed", contract: { endDate: "2026-09-01" } } },
  today: "2026-08-12",
});
assert.equal(watch.ok, true);
assert.equal(watch.warning, "CONTRACT_EXPIRING");

const far = checkContractTermGate({
  contractType: "fixed",
  contractEndDate: "2027-08-01",
  today: "2026-08-12",
});
assert.equal(far.ok, true);
assert.equal(far.warning, undefined);

const nonSaudiIndefinite = checkContractTermGate({
  nationality: "Egyptian",
  contractType: "indefinite",
  hireDate: "2026-01-01",
  today: "2026-08-12",
});
assert.equal(nonSaudiIndefinite.ok, false);
assert.equal(nonSaudiIndefinite.error, "CONTRACT_NONSAUDI_FIXED_REQUIRED");

const deemedYear = checkContractTermGate({
  nationality: "Indian",
  contractType: "fixed",
  hireDate: "2026-01-01",
  today: "2026-08-12",
});
assert.equal(deemedYear.ok, true);
assert.equal(deemedYear.warning, "CONTRACT_TERM_DEEMED_YEAR");
assert.equal(deemedYear.endDate, "2027-01-01");
assert.equal(deemedYear.deemed, true);

console.log("complianceDerivations E2E rules: PASS");
