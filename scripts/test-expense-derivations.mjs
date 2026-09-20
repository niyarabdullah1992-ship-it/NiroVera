import assert from "node:assert/strict";
import {
  WATCH_PCT,
  NEAR_LIMIT_PCT,
  PAYOUT_SLA_HOURS,
  deriveBudgetTag,
  enrichBudget,
  deriveCompanyBudget,
  isDelayedPayout,
  checkSubmitClaimGate,
  checkApproveClaimGate,
  checkRejectClaimGate,
  checkMarkPaidGate,
  checkOperatingClaimSurfaceGate,
  approvalStepsForAmount,
  claimNeedsCfo,
  toBudgetStatus,
  annotateLegacyStockSurface,
} from "../src/lib/expenseDerivations.js";

assert.equal(WATCH_PCT, 85);
assert.equal(NEAR_LIMIT_PCT, 95);
assert.equal(PAYOUT_SLA_HOURS, 48);

assert.equal(deriveBudgetTag(64), "on_track");
assert.equal(deriveBudgetTag(88), "watch");
assert.equal(deriveBudgetTag(97), "near_limit");
assert.equal(deriveBudgetTag(100), "over");

const budgets = [
  { stationId: "jbl1", limit: 1000 },
  { stationId: "jbl2", limit: 1000 },
];
const claims = [
  { title: "A", stationId: "jbl1", amount: 640, status: "paid", receiptUrl: "r" },
  { title: "B", stationId: "jbl2", amount: 970, status: "approved", receiptUrl: "r", approvedAt: new Date(Date.now() - 60 * 3600_000).toISOString() },
];

assert.equal(enrichBudget(budgets[0], claims).pct, 64);
assert.equal(enrichBudget(budgets[0], claims).tag, "on_track");
assert.equal(enrichBudget(budgets[1], claims).pct, 97);
assert.equal(enrichBudget(budgets[1], claims).tag, "near_limit");

const company = deriveCompanyBudget(budgets, claims);
assert.equal(company.spent, 1610);
assert.equal(company.nearLimitCount, 1);

assert.equal(isDelayedPayout(claims[1]), true);
assert.equal(isDelayedPayout({ ...claims[1], approvedAt: new Date().toISOString() }), false);

assert.equal(checkSubmitClaimGate({ title: "x", stationId: "jbl1", amount: 10 }).error, "RECEIPT_REQUIRED");
assert.equal(checkSubmitClaimGate({ title: "x", stationId: "jbl1", amount: 10, receiptUrl: "r" }).ok, true);
assert.equal(checkOperatingClaimSurfaceGate("قفازات عازلة").error, "STOCK_SURFACE");
assert.equal(checkOperatingClaimSurfaceGate("قطع غيار مضخة").error, "STOCK_SURFACE");
assert.equal(checkOperatingClaimSurfaceGate("قاطع تيار").error, "STOCK_SURFACE");
assert.equal(checkOperatingClaimSurfaceGate("سفر عمل إلى الرياض").ok, true);
assert.equal(checkSubmitClaimGate({ title: "فلتر هواء مولّد", stationId: "jbl1", amount: 10, receiptUrl: "r" }).error, "STOCK_SURFACE");
assert.deepEqual(approvalStepsForAmount(400), ["mgr"]);
assert.deepEqual(approvalStepsForAmount(2000), ["mgr", "fin"]);
assert.deepEqual(approvalStepsForAmount(8000), ["mgr", "fin", "cfo"]);
assert.equal(claimNeedsCfo(400), false);
assert.equal(claimNeedsCfo(8000), true);
assert.equal(toBudgetStatus("cfo_pending"), "pending");
assert.equal(toBudgetStatus("cfo_approved"), "approved");
assert.equal(toBudgetStatus("finance_approved"), "approved");
assert.equal(annotateLegacyStockSurface({ description: "قطع غيار مضخة" }).legacyStockSurface, true);
assert.equal(annotateLegacyStockSurface({ description: "سفر عمل" }).legacyStockSurface, undefined);

const pending = { id: "1", title: "C", stationId: "jbl2", amount: 50, status: "pending", receiptUrl: "r" };
assert.equal(checkApproveClaimGate(pending, budgets[1], claims).error, "BUDGET_EXCEEDED");

const small = { id: "2", title: "D", stationId: "jbl1", amount: 10, status: "pending", receiptUrl: "r" };
assert.equal(checkApproveClaimGate(small, budgets[0], claims).ok, true);

assert.equal(checkApproveClaimGate({ ...small, receiptUrl: null }, budgets[0], claims).error, "RECEIPT_REQUIRED");
assert.equal(checkApproveClaimGate({ ...small, status: "approved" }, budgets[0], claims).error, "ALREADY_DECIDED");
assert.equal(checkRejectClaimGate({ ...small, status: "approved" }).error, "ALREADY_DECIDED");
assert.equal(checkMarkPaidGate(small).error, "NOT_APPROVED");
assert.equal(checkMarkPaidGate({ ...small, status: "approved" }).ok, true);

console.log("expense derivations ok");
