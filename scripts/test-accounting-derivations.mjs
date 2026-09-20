import assert from "node:assert/strict";
import {
  periodMonth,
  postedExpenseClaims,
  postedExpenseTotal,
  postedPayrollRun,
  deriveAccountingPeriod,
  accountingExportPack,
  toCsv,
} from "../src/lib/accountingDerivations.js";

assert.equal(periodMonth("2026-08"), "2026-08");
assert.match(periodMonth(new Date("2026-08-15T12:00:00Z")), /^\d{4}-\d{2}$/);

const claims = [
  { id: "1", title: "Fuel", amount: 100, status: "approved", approvedAt: "2026-08-10T10:00:00Z", stationId: "s1" },
  { id: "2", title: "Parts", amount: 50, status: "paid", paidAt: "2026-08-12T10:00:00Z", stationId: "s1" },
  { id: "3", title: "Pending", amount: 999, status: "pending", submittedAt: "2026-08-11T10:00:00Z", stationId: "s1" },
  { id: "4", title: "Old", amount: 40, status: "approved", approvedAt: "2026-07-01T10:00:00Z", stationId: "s1" },
];

assert.equal(postedExpenseClaims(claims, "2026-08").length, 2);
assert.equal(postedExpenseTotal(claims, "2026-08"), 150);
assert.equal(postedExpenseClaims([
  { id: "cfo", title: "CFO", amount: 80, status: "cfo_approved", approvedAt: "2026-08-20T10:00:00Z" },
  { id: "fin", title: "Fin", amount: 20, status: "finance_approved", approvedAt: "2026-08-21T10:00:00Z" },
], "2026-08").length, 2);

const draftRun = { month: "2026-08", status: "draft", items: [{ base: 1000, allowances: 0, deductions: 0, overtimeHours: 0 }] };
const approvedRun = { month: "2026-08", status: "approved", items: [{ base: 2000, allowances: 100, deductions: 50, overtimeHours: 0 }] };

assert.equal(postedPayrollRun([draftRun], "2026-08"), null);
assert.ok(postedPayrollRun([approvedRun], "2026-08"));

const snapDraft = deriveAccountingPeriod({
  month: "2026-08",
  claims,
  budgets: [{ stationId: "s1", limit: 1000 }],
  payrollRuns: [draftRun],
  lang: "en",
});
assert.equal(snapDraft.expenses.total, 150);
assert.equal(snapDraft.payroll.posted, false);
assert.equal(snapDraft.payroll.netTotal, 0);
assert.equal(snapDraft.budget.remaining, 810);

const snapPosted = deriveAccountingPeriod({
  month: "2026-08",
  claims,
  budgets: [{ stationId: "s1", limit: 1000 }],
  payrollRuns: [approvedRun],
  lang: "ar",
});
assert.equal(snapPosted.payroll.posted, true);
assert.ok(snapPosted.payroll.netTotal > 0);

const pack = accountingExportPack(snapPosted, "ar");
assert.equal(pack.expenseRows.length, 2);
assert.equal(pack.payrollRows.length, 1);
assert.ok(toCsv(pack.summaryHeaders, pack.summaryRows).includes("مصروف منشور"));

console.log("accounting derivations ok");
