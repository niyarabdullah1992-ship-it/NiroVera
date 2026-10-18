/**
 * Purge of the inventory (المخزون), expenses (المصروفات) and asset-register (الأصول) modules —
 * NiroVera is an HR product. Employee custody (العهدة) stays: a light list on the offboarding
 * case (Art. 65(2)), set off in the final settlement (Art. 91 / 88).
 *
 *   node scripts/test-purge-law.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PURGED_MODULE_KEYS, isRemovedModuleNotice, purgeRemovedModuleKeys } from "../src/lib/purgedModules.js";
import { canonicalizePlatformFacts } from "../src/lib/facts/migrate.js";
import {
  checkAddCustodyGate,
  checkCompleteOffboardingGate,
  checkMarkReturnedGate,
  custodyDebtOf,
  enrichAsset,
  normalizeCustodyItem,
} from "../src/lib/offboardingDerivations.js";
import * as offTs from "../base44/shared/offboardingDerivations.ts";
import { deriveFinalSettlement } from "../src/lib/payrollLaw.js";
import { deriveAccountingPeriod, accountingExportPack } from "../src/lib/accountingDerivations.js";
import { SUITE_APPS, suiteAppForPath } from "../src/lib/suiteApps.js";
import { PLAN_SECTIONS } from "../src/lib/subscriptionPlans.js";
import { employeeMoneyHref } from "../src/lib/railSide.js";

const ROOT = join(import.meta.dirname, "..");
const REMOVED_ROUTES = ["/app/inventory", "/app/assets", "/app/expenses"];

// ── 1. One-time local purge of the removed bags ──────────────────
const blob = {
  id: "co-1",
  employees: [{ id: "e1", name: "سالم" }],
  tasks: [{ id: "t1" }],
  payrollRuns: [{ id: "p1", month: "2026-09" }],
  inventory: [{ id: "inv" }],
  inventoryItems: [{ id: "i1" }],
  stockMovements: [{ id: "m1" }],
  materialRequests: [{ id: "r1" }],
  stockPurchaseOrders: [],
  stockRaisedScopes: {},
  stockBoard: { items: [] },
  expenses: [{ id: "ex" }],
  expenseClaims: [{ id: "c1" }],
  stationBudgets: [{ stationId: "s1", limit: 1 }],
  expenseBudget: [],
  assets: [{ id: "a1" }],
  assetCustody: [{ id: "cu1" }],
  assetMaintenance: [],
  assetTransfers: [{ id: "tr1" }],
  notifications: [
    { id: "n1", text: "طلب مخزون بانتظار فرع المصدر — قفازات." },
    { id: "n2", text: "نقل أصل «مولد» بانتظار موافقتك." },
    { id: "n3", text: "مطالبة مصروف بانتظار المدير المالي." },
    { id: "n4", text: "اعتُمد طلب العهدة — حاسب محمول." },
    { id: "n5", text: "اعتُمدت إجازتك." },
  ],
};
assert.equal(purgeRemovedModuleKeys(blob), true);
for (const key of PURGED_MODULE_KEYS) assert.equal(key in blob, false, `${key} must be purged`);
assert.deepEqual(blob.notifications.map((n) => n.id), ["n4", "n5"], "desk notices of removed modules go; custody and leave stay");
assert.equal(blob.employees.length, 1);
assert.equal(blob.tasks.length, 1);
assert.equal(blob.payrollRuns.length, 1);
assert.equal(purgeRemovedModuleKeys(blob), false, "second run is a no-op");
assert.equal(isRemovedModuleNotice("سُلّمت عهدة: جهاز لاسلكي"), false, "employee custody is not a removed-desk notice");
assert.equal(isRemovedModuleNotice("أجر الشهر الأخير — مصروف في المسير"), false, "payroll wording is not swept");

// The store read path (canonicalizePlatformFacts) runs the purge.
const cached = { id: "co-2", assets: [{ id: "x" }], expenseClaims: [], stationBudgets: [], tasks: [] };
assert.equal(canonicalizePlatformFacts(cached), true);
assert.equal(cached.assets, undefined);
assert.equal(cached.stationBudgets, undefined);

// ── 2. Navigation, plans, rails carry no removed module ──────────
for (const route of REMOVED_ROUTES) {
  assert.equal(suiteAppForPath(route), null, `${route} has no suite app`);
  assert.equal(SUITE_APPS.some((app) => app.path === route), false);
}
for (const id of ["inventory", "assets", "expenses"]) {
  assert.equal(PLAN_SECTIONS.some((row) => row.key === id), false, `plan section ${id} removed`);
  assert.equal(employeeMoneyHref(id), "");
}
assert.ok(SUITE_APPS.some((app) => app.path === "/app/payroll"), "payroll stays");

const smart = readFileSync(join(ROOT, "src", "lib", "smartPositions.js"), "utf8");
const nav = readFileSync(join(ROOT, "src", "lib", "navVisibility.js"), "utf8");
for (const route of REMOVED_ROUTES) {
  assert.equal(smart.includes(`"${route}"`), false, `smartPositions still routes ${route}`);
  assert.equal(nav.includes(`"${route}"`), false, `navVisibility still lists ${route}`);
}

// Old links redirect instead of 404.
const app = readFileSync(join(ROOT, "src", "App.jsx"), "utf8");
for (const route of [...REMOVED_ROUTES, "/app/stations/:stationId/expenses"]) {
  assert.match(app, new RegExp(`path="${route.replace(/[/:]/g, (c) => `\\${c}`)}" element=\\{<Navigate to="/app"`), `${route} redirects to /app`);
}
assert.doesNotMatch(app, /pages\/(Inventory|Assets|Expenses|StationExpenses)/);

// ── 3. Files, functions and entities are gone ─────────────────────
for (const rel of [
  "src/pages/Inventory.jsx", "src/pages/Assets.jsx", "src/pages/Expenses.jsx", "src/pages/StationExpenses.jsx",
  "src/components/inventory", "src/components/assets", "src/components/expenses",
  "base44/functions/assets", "base44/functions/expenses", "base44/functions/inventory", "base44/functions/stock", "base44/functions/budget",
  "base44/entities/Asset.jsonc", "base44/entities/AssetCustody.jsonc", "base44/entities/AssetMaintenance.jsonc",
  "base44/entities/ExpenseClaim.jsonc", "base44/entities/InventoryItem.jsonc", "base44/entities/InventoryUnit.jsonc",
  "base44/entities/StockMovement.jsonc", "base44/entities/MaterialRequest.jsonc",
  "base44/entities/ProcurementRequest.jsonc", "base44/entities/PurchaseOrder.jsonc",
]) {
  assert.equal(existsSync(join(ROOT, rel)), false, `${rel} must be deleted`);
}
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", ".git"].includes(name)) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(js|jsx|ts|mjs)$/.test(name)) out.push(abs);
  }
  return out;
}
const DANGLING = /from\s+["'][^"']*(inventoryApi|expensesApi|assetsApi|inventoryDerivations|expenseDerivations|assetTransfers|localInventoryFallback|localExpensesFallback|localAssetsFallback|inventoryReportThemes|assistantLiveContext|facts\/money|components\/(inventory|assets|expenses)\/)/;
const ENTITY = /entities\.(InventoryItem|InventoryUnit|StockMovement|MaterialRequest|ExpenseClaim|AssetCustody|AssetMaintenance|Asset|ProcurementRequest|PurchaseOrder)\b/;
for (const file of [...walk(join(ROOT, "src")), ...walk(join(ROOT, "base44"))]) {
  const src = readFileSync(file, "utf8");
  assert.doesNotMatch(src, DANGLING, `dangling import in ${file}`);
  assert.doesNotMatch(src, ENTITY, `removed entity used in ${file}`);
}

// ── 4. Accounting is payroll-only ────────────────────────────────
const snap = deriveAccountingPeriod({ month: "2026-09", payrollRuns: [{ month: "2026-09", status: "approved", items: [{ base: 3000, allowances: 0, deductions: 0, overtimeHours: 0 }] }], lang: "ar" });
assert.equal(snap.expenses, undefined);
assert.equal(snap.budget, undefined);
assert.equal(snap.payroll.posted, true);
assert.equal(accountingExportPack(snap).expenseRows, undefined);

// ── 5. Custody stays — light list on the offboarding case (Art. 65(2)) ──
const caseRow = { employeeId: "e1", status: "in_progress", assets: [] };
assert.equal(checkAddCustodyGate(null, { name: "x" }).error, "CASE_NOT_FOUND");
const noName = checkAddCustodyGate(caseRow, { name: "  " }, "2026-10-16");
assert.equal(noName.error, "CUSTODY_NAME_REQUIRED");
assert.match(noName.reason, /المادة 65\(2\)/);
assert.equal(checkAddCustodyGate(caseRow, { name: "حاسب", value: -5 }, "2026-10-16").error, "CUSTODY_VALUE_INVALID");
assert.equal(checkAddCustodyGate(caseRow, { name: "حاسب", value: "abc" }, "2026-10-16").error, "CUSTODY_VALUE_INVALID");
assert.equal(checkAddCustodyGate(caseRow, { name: "حاسب", handedAt: "2026-10-20" }, "2026-10-16").error, "CUSTODY_HANDED_FUTURE");
assert.equal(checkAddCustodyGate({ ...caseRow, status: "completed" }, { name: "حاسب" }, "2026-10-16").error, "ALREADY_COMPLETED");
assert.equal(checkAddCustodyGate(caseRow, { name: "حاسب محمول", serial: "LAP-1", value: 3200, handedAt: "2026-01-05" }, "2026-10-16").ok, true);

const laptop = normalizeCustodyItem({ name: " حاسب محمول ", serial: "LAP-1", value: "3200", handedAt: "2026-01-05T10:00:00Z", evidenceName: "محضر.pdf" }, "cst_1");
assert.deepEqual(
  { id: laptop.id, name: laptop.name, serial: laptop.serial, value: laptop.value, handedAt: laptop.handedAt, evidenceName: laptop.evidenceName, status: laptop.status, returnedAt: laptop.returnedAt },
  { id: "cst_1", name: "حاسب محمول", serial: "LAP-1", value: 3200, handedAt: "2026-01-05", evidenceName: "محضر.pdf", status: "outstanding", returnedAt: null },
);
const radio = normalizeCustodyItem({ name: "جهاز لاسلكي", description: "Motorola", cost: 900 }, "cst_2");
assert.equal(radio.serial, "Motorola", "description stands in for serial");
assert.equal(radio.value, 900, "legacy cost reads as value");
const held = { ...caseRow, assets: [laptop, radio] };
assert.equal(checkAddCustodyGate(held, { name: "حاسب آخر", serial: "lap-1" }, "2026-10-16").error, "CUSTODY_DUPLICATE");

// Set-off reads the value of what is still outstanding.
assert.equal(custodyDebtOf(held.assets), 4100);
const afterReturn = [{ ...laptop, status: "returned", returnedAt: "2026-10-10" }, radio];
assert.equal(custodyDebtOf(afterReturn), 900);
assert.equal(enrichAsset({ id: "z", name: "z", cost: "75" }).value, 75);
assert.equal(checkMarkReturnedGate(held, "cst_1").ok, true);
assert.equal(checkCompleteOffboardingGate(held).error, "ASSETS_OUTSTANDING", "exit stays blocked while custody is out");

const settlement = deriveFinalSettlement({
  employee: { id: "e1", profile: {} },
  eos: { total: 10000, wage: 6000 },
  payrollRuns: [],
  exitDate: "2026-10-12",
  monthlyWage: 6000,
  custodyDebt: custodyDebtOf(held.assets),
  extras: 0,
  deadline: { due: "2026-10-19" },
});
assert.equal(settlement.custodyDebt, 4100);
assert.equal(settlement.custodySetOff, 1000, "Art. 91 cap: five days of a 6,000 wage");
assert.equal(settlement.custodyToCourt, 3100);

// ── 6. Backend twin agrees ───────────────────────────────────────
for (const [input, today] of [
  [{ name: "" }, "2026-10-16"],
  [{ name: "x", value: -1 }, "2026-10-16"],
  [{ name: "x", handedAt: "2027-01-01" }, "2026-10-16"],
  [{ name: "x", serial: "LAP-1" }, "2026-10-16"],
  [{ name: "x", value: 10 }, "2026-10-16"],
]) {
  assert.equal(offTs.checkAddCustodyGate(held, input, today).error, checkAddCustodyGate(held, input, today).error, JSON.stringify(input));
}
assert.deepEqual(offTs.normalizeCustodyItem({ name: "a", cost: 5 }, "i"), normalizeCustodyItem({ name: "a", cost: 5 }, "i"));
assert.equal(offTs.custodyDebtOf(afterReturn), custodyDebtOf(afterReturn));

const entry = readFileSync(join(ROOT, "base44", "functions", "offboarding", "entry.ts"), "utf8");
assert.match(entry, /action === "addCustody"/);
assert.match(entry, /checkAddCustodyGate/);

console.log("purge law ok");
