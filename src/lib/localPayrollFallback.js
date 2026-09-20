/**
 * The payroll run actions, run locally when the cloud function is short-circuited.
 *
 * `src/api/base44Client.js` answers `{ ok: true, localPreview: true }` for the payroll
 * function inside the preview workspace. The run board read that as success, so
 * "اعتمد المسير" showed an approval toast while the run never left `draft`: the badge
 * still read «بانتظار الاعتماد» and wage protection never unlocked. A block that looks
 * like a success is worse than a block, so the same rules the cloud handler applies —
 * the payroll right, the approve gate, the WPS gate — are applied here against the
 * store, with the same audit entry and a named Arabic refusal.
 */
import { getCompanyData, updateCompany } from "@/lib/store";
import { logAudit } from "@/lib/auditLog";
import { getRun } from "@/lib/payroll";
import {
  checkApprovePayrollGate,
  checkSendWpsGate,
  deriveRunTotals,
  deriveStationBreakdown,
  deriveWpsStatus,
  enrichLine,
  settlementStamp,
} from "@/lib/payrollDerivations";
import { PAYROLL_DENY, canManagePayroll, payrollActor } from "@/lib/payrollRights";
import { notifyMoneyReviewers } from "@/lib/moneyNotifications";

const RUN_NOT_FOUND = {
  error: "RUN_NOT_FOUND",
  reason: "مسير الرواتب غير موجود لهذا الشهر.",
  reasonEn: "No payroll run exists for this month.",
};

const denied = (deny) => ({ error: deny.error, reason: deny.reason, reasonEn: deny.reasonEn });

/** The same shape the cloud handler returns, so boards reading `run.totals` /
 *  `run.wps` behave identically whichever side answered. */
function enrichRun(run) {
  // Locally the branch lives on `employeeStationId`; the cloud line calls it `stationId`
  // and the station breakdown reads that one. Without the bridge every row lands in
  // "unassigned" and a branch-scoped run reads zero.
  const items = (run.items || []).map((item) => enrichLine({ ...item, stationId: item.stationId || item.employeeStationId || null }));
  return { ...run, items, totals: deriveRunTotals(items), byStation: deriveStationBreakdown(items), wps: deriveWpsStatus({ ...run, items }) };
}

function actorName(companyId) {
  return payrollActor(companyId).user?.name || "unknown";
}

function approve(companyId, month) {
  if (!canManagePayroll(companyId)) return denied(PAYROLL_DENY.MANAGE);
  const run = getRun(getCompanyData(companyId), month);
  if (!run) return RUN_NOT_FOUND;
  const gate = checkApprovePayrollGate(run);
  if (!gate.ok) return { error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, count: gate.count };

  const by = actorName(companyId);
  let approvedRun = null;
  updateCompany(companyId, (d) => {
    const target = (d.payrollRuns || []).find((entry) => entry.month === month);
    if (!target) return;
    // Approval decides the figures. Each line keeps the net it was approved with, so the
    // month cannot drift afterwards even if the derivation behind it changes.
    (target.items || []).forEach((item) => { if (item.settledNet == null) Object.assign(item, settlementStamp(item)); });
    target.status = "approved";
    target.approvedAt = new Date().toISOString();
    target.approvedBy = by;
    approvedRun = target;
  });
  logAudit(companyId, "payroll_run_approved", by, `Approved payroll run ${month}`);
  notifyMoneyReviewers(companyId, {
    ar: `اعتُمد مسير الأجور لشهر ${month} — التالي: ملف حماية الأجور.`,
    en: `The ${month} wage run was approved — next: the wage-protection file.`,
    to: "/app/payroll?tab=run",
    key: `payroll-approved-${month}`,
  });
  // No `run` key on purpose: the board reloads from the store, which also refreshes
  // the page-level meta chip the same way a cold load would.
  return { ok: true, localApplied: !!approvedRun };
}

function sendWps(companyId, month) {
  if (!canManagePayroll(companyId)) return denied(PAYROLL_DENY.MANAGE);
  const run = getRun(getCompanyData(companyId), month);
  if (!run) return RUN_NOT_FOUND;
  const gate = checkSendWpsGate(run);
  if (!gate.ok) {
    return { error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, count: gate.count, matched: gate.matched, total: gate.total };
  }

  const by = actorName(companyId);
  const fileRef = `WPS-${month}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  updateCompany(companyId, (d) => {
    const target = (d.payrollRuns || []).find((entry) => entry.month === month);
    if (!target) return;
    target.status = "sent";
    target.wpsSentAt = new Date().toISOString();
    target.wpsSentBy = by;
    target.wpsFileRef = fileRef;
    target.wpsLate = !!gate.late;
  });
  logAudit(companyId, "payroll_wps_sent", by, `WPS file ${fileRef} built for ${month}${gate.late ? " (late)" : ""}`);
  notifyMoneyReviewers(companyId, {
    ar: `أُنشئ ملف حماية الأجور ${fileRef} لشهر ${month}${gate.late ? " — بعد الموعد النظامي." : "."}`,
    en: `Wage-protection file ${fileRef} was built for ${month}${gate.late ? " — past the statutory deadline." : "."}`,
    to: "/app/payroll?tab=wps",
    key: `payroll-wps-${month}`,
  });
  return { ok: true, localApplied: true, fileRef, late: !!gate.late, deadline: gate.deadline };
}

/** Returns null for actions the caller already handles from the store (ensureRun). */
export function localPayrollAction(payload) {
  const companyId = payload?.companyId;
  const month = String(payload?.month || "");
  if (!companyId || !month) return null;
  if (payload?.action === "approve") return approve(companyId, month);
  if (payload?.action === "sendWps") return sendWps(companyId, month);
  if (payload?.action === "list" || payload?.action === "get") {
    const run = getRun(getCompanyData(companyId), month);
    return { ok: true, month, run: run ? enrichRun(run) : null };
  }
  return null;
}
