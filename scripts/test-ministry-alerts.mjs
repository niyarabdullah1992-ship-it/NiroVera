import assert from "node:assert/strict";
import { deriveMinistryAlerts, canSeeMinistryAlerts } from "../src/lib/ministryAlertDerivations.js";
import { collectEmployeeValidityDocs, collectRegisterValidityDocs } from "../src/lib/complianceDerivations.js";

assert.equal(canSeeMinistryAlerts({ role: "employee" }), false);
assert.equal(canSeeMinistryAlerts({ role: "director" }), true);

const empty = deriveMinistryAlerts({ employees: [], safety: [], payrollRuns: [] }, {
  now: new Date("2026-04-10T12:00:00"),
  today: "2026-04-10",
});
assert.equal(empty.alerts.some((a) => a.gate === "HEAT_BAN"), false);

const heat = deriveMinistryAlerts({ employees: [], safety: [], payrollRuns: [] }, {
  now: new Date("2026-07-20T12:00:00"),
  today: "2026-07-20",
});
assert.ok(heat.alerts.some((a) => a.gate === "HEAT_BAN"));

const docs = deriveMinistryAlerts({
  employees: [{
    employeeId: "e1",
    name: "خالد",
    saudi: false,
    docs: [{ kind: "iqama", number: "2", expiryDate: "2026-08-01" }],
  }],
  safety: [],
  payrollRuns: [],
}, { now: new Date("2026-09-06T12:00:00"), today: "2026-09-06" });
const expired = docs.alerts.find((a) => a.gate === "DOC_EXPIRED");
assert.ok(expired);
assert.equal(expired.count, 1);
assert.ok(!Number.isNaN(expired.count));

const hse = deriveMinistryAlerts({
  employees: [],
  safety: [{ stationId: "s1", hazards: [{ id: "h1", closedAt: null, level: "critical" }] }],
  payrollRuns: [],
}, { now: new Date("2026-04-10T12:00:00"), today: "2026-04-10" });
assert.equal(hse.alerts.some((a) => a.gate === "HSE_CRITICAL_OPEN" || a.gate === "HSE_HAZARD_OPEN"), false);
assert.equal(hse.alerts.some((a) => a.id === "hse_critical" || a.id === "hse_open"), false);

const wps = deriveMinistryAlerts({
  employees: [],
  safety: [],
  payrollRuns: [],
}, { now: new Date("2026-10-31T12:00:00"), today: "2026-10-31" });
assert.ok(wps.alerts.some((a) => a.gate === "WPS_FILE_MISSING"));

const identity = deriveMinistryAlerts({
  employees: [{
    employeeId: "e-id",
    name: "نورة",
    nationality: "سعودي",
    nationalId: "2000000001",
  }],
  safety: [],
  payrollRuns: [],
}, { now: new Date("2026-04-10T12:00:00"), today: "2026-04-10" });
assert.ok(identity.alerts.some((a) => a.gate === "SAUDI_IDENTITY_MISMATCH"));

const contract = deriveMinistryAlerts({
  employees: [{
    employeeId: "e-c",
    name: "ثابت",
    nationality: "مصري",
    nationalId: "2000000002",
    profile: { contractType: "fixed", contractEndDate: "2026-03-01", hireDate: "2024-01-01" },
  }],
  safety: [],
  payrollRuns: [],
}, { now: new Date("2026-04-10T12:00:00"), today: "2026-04-10" });
assert.ok(contract.alerts.some((a) => a.gate === "CONTRACT_EXPIRED"));

const certPack = deriveMinistryAlerts({
  employees: [{
    employeeId: "e-cert",
    name: "عمر",
    certificates: [{ name: "الإسعافات الأولية", code: "fa", expiryDate: "2026-10-01", status: "approved" }],
  }],
  safety: [],
  payrollRuns: [],
}, { now: new Date("2026-09-06T12:00:00"), today: "2026-09-06" });
const certAlert = certPack.alerts.find((a) => a.gate === "DOC_EXPIRING");
assert.ok(certAlert, "certificate within warn window must raise DOC_EXPIRING");
assert.equal(certAlert.count, 1);
const certRows = collectEmployeeValidityDocs({
  employeeId: "e-cert",
  name: "عمر",
  certificates: [{ name: "الإسعافات الأولية", code: "fa", expiryDate: "2026-10-01" }],
}, "2026-09-06");
assert.equal(certRows.length, 1);
assert.ok(["certificate", "fa"].includes(certRows[0].kind));
assert.match(certRows[0].docLabelAr, /إسعاف|شهادة/);

const profilePack = deriveMinistryAlerts({
  employees: [{
    employeeId: "e-prof",
    name: "ليان",
    profile: {
      passportExpiry: "2026-10-10",
      medicalInsuranceExpiry: "2026-09-20",
    },
  }],
  safety: [],
  payrollRuns: [],
}, { now: new Date("2026-09-06T12:00:00"), today: "2026-09-06" });
const profileExpiring = profilePack.alerts.find((a) => a.gate === "DOC_EXPIRING");
assert.ok(profileExpiring);
assert.equal(profileExpiring.count, 2);
const profileRows = collectRegisterValidityDocs({
  employees: [{
    employeeId: "e-prof",
    profile: { passportExpiry: "2026-10-10", medicalInsuranceExpiry: "2026-09-20" },
  }],
}, "2026-09-06");
assert.ok(profileRows.some((r) => r.kind === "passport"));
assert.ok(profileRows.some((r) => r.kind === "medical"));

const customPack = deriveMinistryAlerts({
  employees: [{
    employeeId: "e-dl",
    name: "سامي",
    docs: [
      { kind: "driving_licence", number: "DL-1", expiryDate: "2026-09-30" },
      { kind: "municipal", title: "رخصة البلدية", expiryDate: "2026-10-05" },
    ],
  }],
  safety: [],
  payrollRuns: [],
}, { now: new Date("2026-09-06T12:00:00"), today: "2026-09-06" });
const customExpiring = customPack.alerts.find((a) => a.gate === "DOC_EXPIRING");
assert.ok(customExpiring);
assert.equal(customExpiring.count, 2);
const customRows = collectEmployeeValidityDocs({
  employeeId: "e-dl",
  docs: [
    { kind: "driving_licence", expiryDate: "2026-09-30" },
    { kind: "municipal", title: "رخصة البلدية", expiryDate: "2026-10-05" },
  ],
}, "2026-09-06");
assert.ok(customRows.some((r) => r.kind === "driving_licence" && r.docLabelAr === "رخصة القيادة"));
assert.ok(customRows.some((r) => r.docLabelAr === "رخصة البلدية"));

const datesOnly = deriveMinistryAlerts({
  employees: [{
    employeeId: "e-dates",
    name: "بلا وثائق",
    profile: { birthDate: "1990-05-01", hireDate: "2020-01-15" },
    leaveRequests: [{ startDate: "2026-09-01", endDate: "2026-09-10", type: "annual" }],
  }],
  safety: [],
  payrollRuns: [],
}, { now: new Date("2026-09-06T12:00:00"), today: "2026-09-06" });
assert.equal(datesOnly.alerts.some((a) => a.gate === "DOC_EXPIRED" || a.gate === "DOC_EXPIRING"), false);
assert.equal(collectEmployeeValidityDocs({
  employeeId: "e-dates",
  profile: { birthDate: "1990-05-01", hireDate: "2020-01-15" },
}, "2026-09-06").length, 0);

const mixed = deriveMinistryAlerts({
  employees: [{
    employeeId: "e-mix",
    name: "خالد",
    profile: {
      passportExpiry: "2026-08-01",
      idExpiry: "2026-10-20",
      idType: "iqama",
    },
  }],
  safety: [],
  payrollRuns: [],
}, { now: new Date("2026-09-06T12:00:00"), today: "2026-09-06" });
const mixedExpired = mixed.alerts.find((a) => a.gate === "DOC_EXPIRED");
const mixedExpiring = mixed.alerts.find((a) => a.gate === "DOC_EXPIRING");
assert.ok(mixedExpired, "expired passport must still raise DOC_EXPIRED");
assert.ok(mixedExpiring, "expiring iqama must raise DOC_EXPIRING even when another doc is expired");
assert.equal(mixedExpired.count, 1);
assert.equal(mixedExpiring.count, 1);
assert.equal(mixedExpired.id, "doc_expired");
assert.equal(mixedExpiring.id, "doc_expiring");

const companyDoc = collectRegisterValidityDocs({
  employees: [],
  files: [{
    type: "file",
    name: "رخصة البلدية",
    validFrom: "2025-01-01",
    validUntil: "2026-09-15",
  }],
  safety: [{ permits: [{ validFrom: "2026-01-01", validUntil: "2026-09-10", type: "excavation" }] }],
}, "2026-09-06");
assert.equal(companyDoc.length, 1);
assert.equal(companyDoc[0].docLabelAr, "رخصة البلدية");

console.log("ministryAlertDerivations: PASS");
