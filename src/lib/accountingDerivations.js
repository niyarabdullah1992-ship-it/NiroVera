/**
 * Accounting hub — read-only period aggregations.
 * Posts only approved/paid expense claims and approved/sent payroll runs.
 * Not a general ledger.
 */

import { deriveCompanyBudget, toBudgetStatus } from "./expenseDerivations.js";
import { deriveRunTotals, deriveWpsStatus } from "./payrollDerivations.js";

const POSTED_EXPENSE = new Set(["approved", "paid"]);
const POSTED_PAYROLL = new Set(["approved", "sent"]);

function monthKeyNow(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function periodMonth(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) return value;
  return monthKeyNow(value instanceof Date ? value : new Date());
}

function claimInPeriod(claim, month) {
  const stamp = String(claim?.paidAt || claim?.approvedAt || claim?.submittedAt || claim?.createdAt || "").slice(0, 7);
  return stamp === month;
}

export function postedExpenseClaims(claims = [], month) {
  return (claims || []).filter((claim) => {
    const status = toBudgetStatus(claim?.status);
    return POSTED_EXPENSE.has(status) && claimInPeriod(claim, month);
  });
}

export function postedExpenseTotal(claims = [], month) {
  return postedExpenseClaims(claims, month).reduce((sum, claim) => sum + (Number(claim.amount) || 0), 0);
}

export function postedPayrollRun(runs = [], month) {
  const run = (runs || []).find((entry) => entry.month === month) || null;
  if (!run || !POSTED_PAYROLL.has(run.status)) return null;
  return run;
}

function wpsLabel(wps, ar) {
  if (!wps || wps.status === "missing") return ar ? "لا مسير" : "No run";
  if (wps.status === "sent") return ar ? "أُرسل" : "Sent";
  if (wps.status === "ready") return ar ? (wps.late ? "جاهز (متأخر)" : "جاهز") : (wps.late ? "Ready (late)" : "Ready");
  return ar ? "بانتظار الاعتماد" : "Awaiting approval";
}

export function deriveAccountingPeriod({
  month,
  claims = [],
  budgets = [],
  payrollRuns = [],
  now = new Date(),
  lang = "ar",
} = {}) {
  const ar = lang === "ar";
  const period = periodMonth(month);
  const postedClaims = postedExpenseClaims(claims, period);
  const expenseTotal = postedExpenseTotal(claims, period);
  const budget = deriveCompanyBudget(budgets, claims);
  const payrollRun = postedPayrollRun(payrollRuns, period);
  const draftRun = (payrollRuns || []).find((entry) => entry.month === period) || null;
  const postedTotals = deriveRunTotals(payrollRun?.items || []);
  const wps = deriveWpsStatus(payrollRun || draftRun, now);

  return {
    month: period,
    expenses: {
      count: postedClaims.length,
      total: expenseTotal,
      paidCount: postedClaims.filter((c) => c.status === "paid").length,
      approvedCount: postedClaims.filter((c) => c.status === "approved").length,
      claims: postedClaims,
    },
    budget: {
      spent: budget.spent,
      limit: budget.limit,
      remaining: Math.max(0, (Number(budget.limit) || 0) - (Number(budget.spent) || 0)),
      pct: budget.pct,
      nearLimitCount: budget.nearLimitCount,
    },
    payroll: {
      run: payrollRun,
      draft: !payrollRun ? draftRun : null,
      status: payrollRun?.status || draftRun?.status || "none",
      heads: payrollRun ? (postedTotals.heads || 0) : 0,
      netTotal: payrollRun ? (postedTotals.total || 0) : 0,
      issueCount: payrollRun ? (postedTotals.issueCount || 0) : 0,
      wps: { ...wps, label: wpsLabel(wps, ar) },
      posted: Boolean(payrollRun),
    },
  };
}

export function toCsv(headers = [], rows = []) {
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
}

export function accountingExportPack(snap, lang = "ar") {
  const ar = lang === "ar";
  const expenseRows = (snap?.expenses?.claims || []).map((claim) => [
    claim.id,
    claim.title || "",
    claim.amount,
    toBudgetStatus(claim.status),
    claim.stationId || "",
  ]);
  const payrollRows = snap?.payroll?.run
    ? [[snap.month, snap.payroll.status, snap.payroll.heads, snap.payroll.netTotal]]
    : [];
  return {
    expenseRows,
    payrollRows,
    summaryHeaders: ar ? ["البند", "القيمة"] : ["Item", "Value"],
    summaryRows: [
      [ar ? "مصروف منشور" : "Posted expense", snap?.expenses?.total || 0],
      [ar ? "مسير منشور" : "Posted payroll", snap?.payroll?.netTotal || 0],
    ],
  };
}
