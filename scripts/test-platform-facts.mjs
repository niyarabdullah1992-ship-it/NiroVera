/**
 * Platform facts arrangement — one home, one writer, key derivations per domain.
 * Companion: src/lib/facts/  ·  schema map: base44/data/domains.jsonc
 *
 *   node scripts/test-platform-facts.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  PLATFORM_FACTS,
  HR_FACTS,
  DOMAIN_MODULES,
  factById,
  factsForDomain,
  mayWrite,
  writerRoles,
  isDerivedFact,
  primaryHome,
  domainTable,
  readCompanyEstablishment,
  writeCompanyEstablishment,
  PREVIEW_ESTABLISHMENT_NUMBER,
  canonicalizeGosiFacts,
  canonicalizePlatformFacts,
  migratePlatformFactHomes,
  readGosiRegisteredAt,
  gosiSubscriberClass,
  registrationForPayroll,
  readWageFields,
  assignWageFields,
  readStations,
  readOrgTree,
  resolveOrgGraph,
  readPersonalAttendance,
  attendanceForCompany,
  readPayrollRuns,
  emptyMoneyDisplay,
  expenseClaimsBy,
  assetsHeldBy,
  readInventoryItems,
  readStockMovements,
  readMaterialRequests,
  locationBalancesOf,
  totalQtyFromBalances,
  qtyAtLocation,
  syncItemQuantityFromBalances,
  adjustLocationBalance,
  allLeaveRequests,
  allOtherRequests,
  casesForEmployee,
  readAnonymousReports,
  readTasks,
  readWorkProofs,
  readSignatureRequests,
  notificationsForUser,
  readBranchEscalationSla,
  readHcmPerformance,
  readHcmFoundation,
  assertWorkProofBlobHome,
  RETIRED_PROOF_ENTITIES,
  PLATFORM_MIGRATION_IDS,
} from "../src/lib/facts/index.js";
import { derivePayrollWagePatch } from "../src/lib/payrollWageSync.js";
import {
  DO_NOT_WRITE,
  DO_NOT_WRITE_ENTITIES,
  LEGACY_FALLBACK,
  normalizeBlobPayload,
  assertWritableEntity,
} from "../src/lib/canonicalStore.js";
import { qtyAtStation } from "../src/lib/inventoryDerivations.js";

// ── registry shape ──────────────────────────────────────────────
assert.ok(PLATFORM_FACTS.length >= HR_FACTS.length);
assert.ok(HR_FACTS.every((f) => factById(f.id)));
const ids = PLATFORM_FACTS.map((f) => f.id);
assert.equal(new Set(ids).size, ids.length, "duplicate fact ids");

for (const domain of [
  "company", "people", "org", "attendance", "payroll", "expenses", "assets",
  "inventory", "requests", "discipline", "voice", "performance", "safety",
  "proof", "signing", "notifications", "owner",
]) {
  const rows = factsForDomain(domain);
  assert.ok(rows.length > 0, `domain ${domain} empty`);
  for (const fact of rows) {
    assert.ok(fact.home || fact.path, `${fact.id} missing home`);
    assert.ok(fact.writer, `${fact.id} missing writer`);
    assert.ok(fact.noteAr || fact.surfaceAr || fact.scope, `${fact.id} missing Arabic/meaning`);
  }
}

const table = domainTable();
assert.ok(table.length >= 15);

// ── company / GOSI homes ────────────────────────────────────────
assert.equal(factById("company.establishment").home, "company.gosiEstablishment");
assert.equal(factById("employee.subscriber").path, "profile.gosiNumber");
assert.notEqual(factById("company.establishment").path, factById("employee.subscriber").path);
assert.equal(factById("employee.gosiRegisteredAt").distinctFrom, "hireDate");
assert.equal(mayWrite("statute.newAnnuity", "owner"), false);
assert.deepEqual(writerRoles("statute.employeeRate"), []);
assert.equal(isDerivedFact("payroll.net"), true);
assert.equal(isDerivedFact("payroll.gosiEmployee"), true);
assert.equal(primaryHome("attendance.punch"), "personalAttendance");

const coA = { id: "co-a", employees: [] };
const coB = { id: "co-b", employees: [] };
writeCompanyEstablishment(coA, PREVIEW_ESTABLISHMENT_NUMBER);
writeCompanyEstablishment(coB, "500000001");
assert.equal(readCompanyEstablishment(coA), PREVIEW_ESTABLISHMENT_NUMBER);
assert.equal(readCompanyEstablishment(coB), "500000001");

// ── migration: legacy bags + GOSI homes ─────────────────────────
assert.ok(PLATFORM_MIGRATION_IDS.includes("platform.gosiHomes"));
const messy = {
  id: "co-messy",
  settings: { orgType: "company", gosiEstablishment: "" },
  orgStructure: [{ id: "n1", title: "فرع" }],
  orgTree: [],
  operationsTasks: [{ id: "tk_legacy", title: "مهمة قديمة" }],
  tasks: [],
  attendanceLedger: [{ id: "att1", companyId: "co-messy", employeeId: "e1", dateKey: "2026-09-01" }],
  personalAttendance: [],
  complaintQueue: [{ id: "c1", companyId: "co-messy" }],
  anonymousReports: [],
  expenseBudget: [{ id: "b1", stationId: "st1" }],
  stationBudgets: [],
  stockBoard: { items: [] },
  employees: [{
    id: "emp_owner_preview",
    name: "نيار عبدالله",
    hireDate: "2026-01-01",
    profile: {
      gosiNumber: PREVIEW_ESTABLISHMENT_NUMBER,
      nationality: "سعودي",
      baseSalary: 15500,
      hireDate: "2026-01-01",
    },
  }],
};
assert.equal(migratePlatformFactHomes(messy), true);
assert.equal(readCompanyEstablishment(messy), PREVIEW_ESTABLISHMENT_NUMBER);
assert.equal(messy.employees[0].profile.gosiNumber, undefined);
assert.equal(readGosiRegisteredAt(messy.employees[0]), "");
assert.equal(Object.prototype.hasOwnProperty.call(messy.employees[0].profile, "gosiRegisteredAt"), false);
assert.equal(gosiSubscriberClass(""), "unset");
assert.ok(messy.orgTree.length >= 1);
assert.equal(messy.orgStructure, undefined);
assert.ok(messy.tasks.some((t) => t.id === "tk_legacy"));
assert.equal(messy.operationsTasks, undefined);
assert.ok(messy.personalAttendance.some((r) => r.id === "att1"));
assert.equal(messy.attendanceLedger, undefined);
assert.ok(messy.anonymousReports.some((r) => r.id === "c1"));
assert.equal(messy.complaintQueue, undefined);
assert.ok(messy.stationBudgets.some((r) => r.id === "b1"));
assert.equal(messy.expenseBudget, undefined);
assert.equal(messy.stockBoard, undefined);
assert.equal(canonicalizePlatformFacts(messy), false);

// Keep subscriber when it is not the establishment number
const kept = {
  id: "co-kept",
  gosiEstablishment: "500000001",
  employees: [{ id: "emp_owner_preview", profile: { gosiNumber: "1099" } }],
};
assert.equal(canonicalizeGosiFacts(kept), false);
assert.notEqual(
  String(kept.employees[0].profile.gosiNumber),
  readCompanyEstablishment(kept),
);

// Hire date must never fill GOSI registration
const hiredOnly = { hireDate: "2024-07-03", profile: { hireDate: "2024-07-03", nationality: "سعودي" } };
assert.equal(readGosiRegisteredAt(hiredOnly), "");
assert.equal(registrationForPayroll(hiredOnly, { hireDate: "2024-07-03" }), "");

// ── نيار September GOSI on base 15500 with empty registration ───
const owner = {
  id: "emp_owner_preview",
  name: "نيار عبدالله",
  hireDate: "2026-01-01",
  profile: { baseSalary: 15500, nationality: "سعودي", hireDate: "2026-01-01" },
};
const ownerPatch = derivePayrollWagePatch(
  { employeeId: "emp_owner_preview", base: 15500, allowances: 0, paid: false, qiwaWage: 15500 },
  owner,
  { month: "2026-09", otDecisions: {} },
);
assert.equal(readGosiRegisteredAt(owner), "");
assert.equal(ownerPatch.fields.gosiEmployee, 1511.25);
assert.equal(ownerPatch.fields.gosiEmployeeRate, 0.0975);
assert.equal(ownerPatch.fields.gosiClass, "unset");

// ── domain bag readers + isolation ──────────────────────────────
const company = {
  id: "co-x",
  stations: [{ id: "st1", name: "فرع", companyId: "co-x" }],
  orgTree: [{ id: "n1" }],
  personalAttendance: [
    { id: "a1", companyId: "co-x", employeeId: "e1" },
    { id: "a2", companyId: "co-other", employeeId: "e9" },
  ],
  payrollRuns: [{ id: "pr1", month: "2026-09", items: [] }],
  expenseClaims: [
    { id: "ex1", requesterId: "e1", amount: 100 },
    { id: "ex2", requesterId: "e2", amount: 50 },
  ],
  assets: [
    { id: "ast1", holderId: "e1", name: "جهاز" },
    { id: "ast2", holderId: "e2", name: "أخرى" },
  ],
  inventoryItems: [{ id: "sku1", itemCode: "A" }],
  employees: [
    {
      id: "e1",
      leaveRequests: [{ id: "lv1", status: "pending" }],
      otherRequests: [{ id: "ot1", type: "study_consent" }],
    },
  ],
  disciplinaryCases: [{ id: "dc1", employeeId: "e1" }],
  anonymousReports: [{ id: "ar1" }],
  tasks: [{ id: "tk1" }],
  workProofs: [{ id: "wp1", ref: "R1" }],
  signatureRequests: [{ id: "sr1" }],
  notifications: [
    { id: "n1", userId: "e1", text: "تنبيه" },
    { id: "n2", userId: "e2", text: "آخر" },
  ],
};

assert.equal(readStations(company).length, 1);
assert.equal(readOrgTree(company).length, 1);
assert.equal(resolveOrgGraph(company).fromLegacy, false);
assert.equal(attendanceForCompany(readPersonalAttendance(company), "co-x").length, 1);
assert.equal(readPayrollRuns(company).length, 1);
assert.equal(expenseClaimsBy(company, "e1").length, 1);
assert.equal(assetsHeldBy(company, "e1").length, 1);
assert.equal(readInventoryItems(company).length, 1);
assert.equal(allLeaveRequests(company).length, 1);
assert.equal(allOtherRequests(company).length, 1);
assert.equal(casesForEmployee(company, "e1").length, 1);
assert.equal(readAnonymousReports(company).length, 1);
assert.equal(readTasks(company).length, 1);
assert.equal(readWorkProofs(company).length, 1);
assert.equal(readSignatureRequests(company).length, 1);
assert.equal(notificationsForUser(company, "e1").length, 1);
assert.equal(emptyMoneyDisplay(""), "—");
assert.equal(emptyMoneyDisplay(null), "—");

// Proof Cycle homes
assert.equal(factById("attendance.punch").proofCycle, 1);
assert.equal(factById("proof.task").proofCycle, 2);
assert.equal(factById("proof.review").proofCycle, 3);
assert.equal(factById("proof.escalation").proofCycle, 4);
assert.equal(factById("signing.request").proofCycle, 5);
assert.equal(factById("proof.client").proofCycle, 6);

// Owner board off suite — fact declares route /owner
assert.equal(factById("owner.boardRoute").path, "/owner");
assert.equal(mayWrite("owner.boardRoute", "hr"), false);
assert.equal(mayWrite("owner.boardRoute", "owner"), true);

// Legacy map stays aligned with canonicalStore do-not-write
for (const legacy of Object.values(LEGACY_FALLBACK).flat()) {
  assert.ok(DO_NOT_WRITE.includes(legacy), `${legacy} should be do-not-write`);
}
assert.ok(factById("attendance.punch").legacyKeys.includes("attendanceLedger"));
assert.ok(factById("org.tree").legacyKeys.includes("orgStructure"));
assert.ok(factById("voice.anonymous").legacyKeys.includes("complaintQueue"));
assert.ok(factById("expense.budget").legacyKeys.includes("expenseBudget"));
assert.ok(factById("proof.task").legacyKeys.includes("operationsTasks"));
assert.ok(Object.keys(LEGACY_FALLBACK).includes("personalAttendance"));
assert.ok(Object.keys(LEGACY_FALLBACK).includes("orgTree"));

// Wage round-trip still via facts
const profile = { nationality: "سعودي" };
assignWageFields(profile, { baseSalary: 15500, housingAllowance: 0, transportAllowance: 0, otherAllowances: 0 });
assert.equal(readWageFields({ profile }).baseSalary, 15500);

// Domain modules expose expected primary homes
assert.equal(DOMAIN_MODULES.attendance.find((f) => f.id === "attendance.punch").home, "personalAttendance");
assert.equal(DOMAIN_MODULES.signing.find((f) => f.id === "signing.request").home.includes("SignatureRequest"), true);
assert.equal(DOMAIN_MODULES.voice.find((f) => f.id === "voice.anonymous").legacyKeys[0], "complaintQueue");
assert.equal(DOMAIN_MODULES.proof.find((f) => f.id === "proof.task").legacyKeys[0], "operationsTasks");

// hrFacts facade still re-exports
const hr = await import("../src/lib/hrFacts.js");
assert.equal(hr.readCompanyEstablishment(coA), PREVIEW_ESTABLISHMENT_NUMBER);
assert.equal(hr.factById("payroll.net").stored, false);

// ── inventory: one qty home (locationBalances) ──────────────────
assert.equal(factById("inventory.qty").home, "inventoryItems[].locationBalances");
assert.equal(factById("inventory.unitEntity").writer, "do-not-write");
assert.ok(DO_NOT_WRITE_ENTITIES.includes("InventoryUnit"));
const sku = {
  id: "sku1",
  locationBalances: [
    { locationId: "st1", quantity: 3 },
    { locationId: "st2", quantity: 7 },
  ],
  quantity: 999,
};
assert.equal(totalQtyFromBalances(sku), 10);
assert.equal(qtyAtLocation(sku, "st1"), 3);
assert.equal(qtyAtLocation(sku, "st2"), 7);
assert.equal(qtyAtLocation(sku, "missing"), 0);
assert.equal(qtyAtStation(sku, "st1"), 3);
const synced = syncItemQuantityFromBalances(sku);
assert.equal(synced.quantity, 10);
const moved = adjustLocationBalance(sku, "st1", -2);
assert.equal(qtyAtLocation(moved, "st1"), 1);
assert.equal(totalQtyFromBalances(moved), 8);
assert.deepEqual(locationBalancesOf({ currentLocationId: "st9", quantity: 4 }), [{ locationId: "st9", quantity: 4 }]);
assert.equal(readStockMovements({ stockMovements: [{ id: "m1" }] }).length, 1);
assert.equal(readMaterialRequests({ materialRequests: [{ id: "r1" }] }).length, 1);

// Object blob sync must not wipe maps to []
assert.deepEqual(
  normalizeBlobPayload("branchEscalationSla", { st1: [{ hours: 24 }] }),
  { st1: [{ hours: 24 }] },
);
assert.deepEqual(normalizeBlobPayload("branchEscalationSla", null), {});
assert.deepEqual(normalizeBlobPayload("tasks", null), []);
assert.equal(factById("voice.branchEscalationSla").blobCategory, "branchEscalationSla");
assert.equal(factById("perf.hcm").blobCategory, "hcmPerformance");
assert.equal(factById("perf.foundation").blobCategory, "hcmFoundation");
assert.deepEqual(readBranchEscalationSla({ branchEscalationSla: { st1: [1] } }).st1, [1]);
assert.equal(readHcmPerformance({ hcmPerformance: { cycles: [] } })?.cycles.length, 0);
assert.equal(readHcmFoundation({ hcmFoundation: { jobs: [1] } })?.jobs.length, 1);

// ── WorkProof entity retired; live bag is workProofs ────────────
assert.equal(factById("proof.workProof").home, "workProofs");
assert.equal(factById("proof.workProofEntity").writer, "do-not-write");
assert.ok(RETIRED_PROOF_ENTITIES.includes("WorkProof"));
assert.ok(DO_NOT_WRITE_ENTITIES.includes("WorkProof"));
assert.throws(() => assertWorkProofBlobHome("WorkProof"), /do-not-write/);
assert.throws(() => assertWritableEntity("WorkProof"), /do-not-write/);
assert.throws(() => assertWritableEntity("InventoryUnit"), /do-not-write/);
assert.equal(assertWritableEntity("InventoryItem"), "InventoryItem");

// Fail if any runtime writer still targets entities.WorkProof
const ROOT = join(import.meta.dirname, "..");
const WRITE_PATTERNS = [
  /entities\.WorkProof\.(create|update|bulkCreate|bulkUpdate|delete)\b/,
  /entities\.InventoryUnit\.(create|update|bulkCreate|bulkUpdate)\b/,
];
function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walkFiles(abs, out);
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(name)) out.push(abs);
  }
  return out;
}
const scanRoots = [join(ROOT, "src"), join(ROOT, "base44", "functions")];
for (const root of scanRoots) {
  for (const file of walkFiles(root)) {
    const src = readFileSync(file, "utf8");
    for (const pattern of WRITE_PATTERNS) {
      // One-shot InventoryUnit.filter hydrate is allowed; writes are not.
      if (pattern.test(src)) {
        assert.fail(`retired entity write in ${file.replace(ROOT + "\\", "").replace(ROOT + "/", "")}: ${pattern}`);
      }
    }
  }
}

console.log("platform facts ok", {
  facts: PLATFORM_FACTS.length,
  domains: Object.keys(DOMAIN_MODULES).length,
  hrFacts: HR_FACTS.length,
  inventoryQtyHome: factById("inventory.qty").home,
  workProofHome: factById("proof.workProof").home,
});
