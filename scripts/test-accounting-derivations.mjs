import assert from "node:assert/strict";
import {
  periodMonth,
  postedPayrollRun,
  deriveAccountingPeriod,
  accountingExportPack,
  toCsv,
} from "../src/lib/accountingDerivations.js";

assert.equal(periodMonth("2026-08"), "2026-08");
assert.match(periodMonth(new Date("2026-08-15T12:00:00Z")), /^\d{4}-\d{2}$/);

const draftRun = { month: "2026-08", status: "draft", items: [{ base: 1000, allowances: 0, deductions: 0, overtimeHours: 0 }] };
const approvedRun = { month: "2026-08", status: "approved", items: [{ base: 2000, allowances: 100, deductions: 50, overtimeHours: 0 }] };

assert.equal(postedPayrollRun([draftRun], "2026-08"), null);
assert.ok(postedPayrollRun([approvedRun], "2026-08"));

const snapDraft = deriveAccountingPeriod({
  month: "2026-08",
  payrollRuns: [draftRun],
  lang: "en",
});
assert.equal(snapDraft.expenses, undefined, "expenses module removed — accounting is payroll-only");
assert.equal(snapDraft.payroll.posted, false);
assert.equal(snapDraft.payroll.netTotal, 0);

const snapPosted = deriveAccountingPeriod({
  month: "2026-08",
  payrollRuns: [approvedRun],
  lang: "ar",
});
assert.equal(snapPosted.payroll.posted, true);
assert.ok(snapPosted.payroll.netTotal > 0);

const pack = accountingExportPack(snapPosted, "ar");
assert.equal(pack.expenseRows, undefined);
assert.equal(pack.payrollRows.length, 1);
assert.ok(toCsv(pack.summaryHeaders, pack.summaryRows).includes("مسير منشور"));

console.log("accounting derivations ok");
