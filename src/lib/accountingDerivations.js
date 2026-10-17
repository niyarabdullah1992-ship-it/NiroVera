/**
 * Accounting hub — read-only period aggregations.
 * Posts only approved/sent payroll runs (attendance → payroll → WPS).
 * Not a general ledger.
 */

import { deriveRunTotals, deriveWpsStatus } from "./payrollDerivations.js";

const POSTED_PAYROLL = new Set(["approved", "sent"]);

function monthKeyNow(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function periodMonth(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) return value;
  return monthKeyNow(value instanceof Date ? value : new Date());
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
  payrollRuns = [],
  now = new Date(),
  lang = "ar",
} = {}) {
  const ar = lang === "ar";
  const period = periodMonth(month);
  const payrollRun = postedPayrollRun(payrollRuns, period);
  const draftRun = (payrollRuns || []).find((entry) => entry.month === period) || null;
  const postedTotals = deriveRunTotals(payrollRun?.items || []);
  const wps = deriveWpsStatus(payrollRun || draftRun, now);

  return {
    month: period,
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
  const payrollRows = snap?.payroll?.run
    ? [[snap.month, snap.payroll.status, snap.payroll.heads, snap.payroll.netTotal]]
    : [];
  return {
    payrollRows,
    summaryHeaders: ar ? ["البند", "القيمة"] : ["Item", "Value"],
    summaryRows: [
      [ar ? "مسير منشور" : "Posted payroll", snap?.payroll?.netTotal || 0],
    ],
  };
}
