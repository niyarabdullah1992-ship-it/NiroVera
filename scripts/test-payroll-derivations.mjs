import assert from "node:assert/strict";
import {
  OT_RATE,
  OT_ANNUAL_MAX_HOURS,
  ARTICLE_90_CAP,
  hourlyFromBase,
  overtimePay,
  lineNet,
  lineIssues,
  contractWage,
  article90MaxDeduction,
  checkArticle90Gate,
  checkArticle92LoanGate,
  qiwaMatches,
  enrichLine,
  deriveRunTotals,
  wpsDeadline,
  isWpsLate,
  checkApprovePayrollGate,
  checkSendWpsGate,
  deriveStationBreakdown,
} from "../src/lib/payrollDerivations.js";

assert.equal(OT_RATE, 1.5);
assert.equal(OT_ANNUAL_MAX_HOURS, 720);
assert.equal(ARTICLE_90_CAP, 0.5);
assert.equal(hourlyFromBase(2400), 10); // 2400 / (30*8)
assert.equal(overtimePay(2400, 10), 150); // 10 * 10 * 1.5
assert.equal(contractWage({ base: 9800, allowances: 2600 }), 12400);
assert.equal(article90MaxDeduction({ base: 9800, allowances: 2600 }), 6200);
assert.equal(checkArticle90Gate({ base: 9800, allowances: 2600, deductions: 6200 }).ok, true);
assert.equal(checkArticle90Gate({ base: 9800, allowances: 2600, deductions: 6201 }).ok, false);
assert.equal(checkArticle92LoanGate({ base: 9800, allowances: 2600 }, 1240).ok, true);
assert.equal(checkArticle92LoanGate({ base: 9800, allowances: 2600 }, 1241).ok, false);
assert.equal(
  checkArticle92LoanGate({
    base: 9800,
    allowances: 2600,
    deductionLines: [{ source: "advance", amount: 800 }],
  }, 500).ok,
  false,
);

const good = {
  id: "1",
  employeeId: "e1",
  base: 9800,
  allowances: 2600,
  bonus: 0,
  overtimeHours: 10,
  deductions: 100,
  currency: "SAR",
  qiwaWage: 12400,
  stationId: "jbl1",
};
const enriched = enrichLine(good);
assert.ok(enriched.overtimePay > 0);
assert.equal(qiwaMatches(good), true);
assert.equal(qiwaMatches({ ...good, qiwaWage: 10000 }), false);
assert.equal(qiwaMatches({ ...good, qiwaWage: null }), false);
assert.ok(lineNet(enriched) > 0);

assert.equal(wpsDeadline("2026-08"), "2026-09-30");
assert.equal(wpsDeadline("2026-12"), "2027-01-30");
assert.equal(isWpsLate("2026-08", new Date(2026, 9, 1)), true);
assert.equal(isWpsLate("2026-08", new Date(2026, 8, 30)), false);

assert.equal(checkApprovePayrollGate(null).error, "RUN_NOT_FOUND");
assert.equal(checkApprovePayrollGate({ month: "2026-08", items: [] }).error, "EMPTY_RUN");
assert.equal(checkApprovePayrollGate({ month: "2026-08", status: "approved", items: [good] }).error, "ALREADY_APPROVED");
assert.equal(
  checkApprovePayrollGate({ month: "2026-08", items: [{ ...good, base: 0 }] }).error,
  "ITEM_ISSUES",
);
assert.equal(checkApprovePayrollGate({ month: "2026-08", status: "draft", items: [good] }).ok, true);
assert.equal(
  checkApprovePayrollGate({
    month: "2026-08",
    status: "draft",
    items: [{ ...good, deductions: 7000 }],
  }).error,
  "ITEM_ISSUES",
);

assert.equal(checkSendWpsGate({ month: "2026-08", status: "draft", items: [good] }).error, "RUN_NOT_APPROVED");
assert.equal(
  checkSendWpsGate({
    month: "2026-08",
    status: "approved",
    items: [{ ...good, qiwaWage: 1 }],
  }).error,
  "QIWA_MISMATCH",
);
assert.equal(
  checkSendWpsGate({ month: "2026-08", status: "approved", items: [good] }, new Date(2026, 7, 20)).ok,
  true,
);

const totals = deriveRunTotals([good, { ...good, id: "2", employeeId: "e2", stationId: "ynb", overtimeHours: 0 }]);
assert.equal(totals.heads, 2);
assert.equal(totals.qiwaMatched, 2);

const by = deriveStationBreakdown([good, { ...good, id: "2", employeeId: "e2", stationId: "ynb" }]);
assert.equal(by.length, 2);

assert.equal(lineIssues({ ...good, overtimeHours: 720 }).includes("OT_ANNUAL_CAP"), false);
assert.equal(lineIssues({ ...good, overtimeHours: 721 }).includes("OT_ANNUAL_CAP"), true);
assert.equal(enrichLine({ ...good, overtimeHours: 721 }).issues.includes("OT_ANNUAL_CAP"), true);

console.log("payroll derivations ok");
