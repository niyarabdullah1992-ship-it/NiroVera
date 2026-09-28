// Payroll data layer — monthly runs built from each employee's salary profile
// (profile.baseSalary / allowances / currency, see SalaryTab). Stored in
// data.payrollRuns and cloud-synced like every other collection.
import { getCompanyData, updateCompany } from "@/lib/store";
import { notifyMoney } from "@/lib/moneyNotifications";
import { checkArticle90Gate, lineNet, settlementStamp, OT_ANNUAL_MAX_HOURS } from "@/lib/payrollDerivations";
import { PAYROLL_DENY, canFeedPayroll, canManagePayroll, payrollActor } from "@/lib/payrollRights";
import { logAudit } from "@/lib/auditLog";
import { derivePayrollWagePatch } from "@/lib/payrollWageSync";
import { assignWageFields } from "@/lib/facts";
import { payableNightAllowance } from "@/lib/shiftWeek";

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getRun(data, month) {
  return (data?.payrollRuns || []).find((r) => r.month === month) || null;
}

/**
 * The single net for the whole surface. The payslip, the Mudad row, the run board, the
 * reports and accounting all read this one function, so the figure the employee reads
 * is the figure the bank receives. See `lineNet` for what it contains and for how a
 * settled line keeps the amount it was settled with.
 */
export const netOf = (item) => lineNet(item);

export const isPayrollEmployee = (employee, includeOwner = false) => includeOwner || employee?.role !== "owner";

function persistContractSplit(employee, persistProfile) {
  if (!employee || !persistProfile) return;
  const profile = employee.profile || (employee.profile = {});
  const next = {};
  if (!(Number(profile.housingAllowance) > 0)) next.housingAllowance = persistProfile.housingAllowance;
  if (!(Number(profile.transportAllowance) > 0)) next.transportAllowance = persistProfile.transportAllowance;
  if (!(Number(profile.otherAllowances) > 0) && Number(persistProfile.otherAllowances) > 0) {
    next.otherAllowances = persistProfile.otherAllowances;
  }
  assignWageFields(profile, next);
}

/** Writes contract split, GOSI, and approved overtime onto an unpaid line. */
export function applyPayrollWagePatch(item, employee, data, month) {
  const patch = derivePayrollWagePatch(item, employee, { otDecisions: data?.otDecisions, month });
  if (!patch) return false;
  const snapshot = (row) => JSON.stringify({
    base: row.base,
    allowances: row.allowances,
    nightAllowance: row.nightAllowance,
    housingAllowance: row.housingAllowance,
    transportAllowance: row.transportAllowance,
    otherAllowances: row.otherAllowances,
    isSaudi: row.isSaudi,
    gosiEmployee: row.gosiEmployee,
    gosiRegisteredAt: row.gosiRegisteredAt,
    gosiAsOf: row.gosiAsOf,
    gosiClass: row.gosiClass,
    gosiBlocked: row.gosiBlocked,
    gosiBlockReason: row.gosiBlockReason,
    overtimeHours: row.overtimeHours,
    overtimeHoursYtd: row.overtimeHoursYtd,
    qiwaWage: row.qiwaWage,
  });
  const before = snapshot(item);
  Object.assign(item, patch.fields);
  if (patch.fields.housingAllowance == null) {
    delete item.housingAllowance;
    delete item.transportAllowance;
    delete item.otherAllowances;
  }
  persistContractSplit(employee, patch.persistProfile);
  return before !== snapshot(item) || Boolean(patch.persistProfile);
}

const itemFromEmployee = (employee, data, month) => {
  const profile = employee.profile || {};
  const currency = String(profile.currency || "SAR").toUpperCase();
  const draft = {
    id: uid("itm"), employeeId: employee.id,
    employeeName: employee.name, employeePosition: employee.position || employee.role || "", employeeStationId: employee.stationId || null,
    isOwner: employee.role === "owner",
    base: 0, allowances: 0,
    bonus: 0, overtimeHours: 0, deductions: 0, currency: /^[A-Z]{3}$/.test(currency) ? currency : "SAR", paid: false,
    isSaudi: null,
    qiwaWage: null,
  };
  const patch = derivePayrollWagePatch(draft, employee, { otDecisions: data?.otDecisions, month });
  if (patch) Object.assign(draft, patch.fields);
  if (patch?.fields?.housingAllowance == null) {
    delete draft.housingAllowance;
    delete draft.transportAllowance;
    delete draft.otherAllowances;
  }
  persistContractSplit(employee, patch?.persistProfile);
  return draft;
};

export function payrollItemIssues(item) {
  if (!Number.isFinite(Number(item?.base)) || (!item?.isOwner && Number(item.base) <= 0) || Number(item.base) < 0) return ["BASE_REQUIRED"];
  const fields = ["allowances", "bonus", "deductions"];
  if (fields.some((field) => !Number.isFinite(Number(item?.[field])) || Number(item[field]) < 0)) return ["INVALID_AMOUNTS"];
  if (!item?.isOwner && netOf(item) <= 0) return ["NET_REQUIRED"];
  if (!checkArticle90Gate(item).ok) return ["ARTICLE_93_EXCEEDED"];
  // Year-to-date when the run carries it: one month can never reach 720 hours, so
  // checking the month alone left the annual ceiling unenforceable.
  if (Number(item.overtimeHoursYtd ?? item.overtimeHours) > OT_ANNUAL_MAX_HOURS) return ["OT_ANNUAL_CAP"];
  if (!/^[A-Z]{3}$/.test(String(item?.currency || ""))) return ["CURRENCY_REQUIRED"];
  return [];
}

// Creates the month's run from current salary profiles if missing, and adds
// items for any employee hired after the run was first generated.
export function ensurePayrollRun(companyId, month) {
  // Opening a run is not posting a deduction: it used to refuse with the derived-line
  // reason, which named the wrong act to whoever was blocked.
  if (!canFeedPayroll(companyId)) return PAYROLL_DENY.RUN_OPEN.error;
  updateCompany(companyId, (d) => {
    d.payrollRuns = d.payrollRuns || [];
    let run = d.payrollRuns.find((r) => r.month === month);
    if (!run) {
      run = { id: uid("run"), month, createdAt: new Date().toISOString(), items: [] };
      d.payrollRuns.push(run);
    }
    const includeOwner = d.settings?.includeOwnerInPayroll === true;
    const ownerIds = new Set((d.employees || []).filter((employee) => employee.role === "owner").map((employee) => employee.id));
    if (!includeOwner) run.items = run.items.filter((item) => !ownerIds.has(item.employeeId));
    const employees = d.employees || [];
    const existing = new Set(run.items.map((item) => item.employeeId));
    employees.filter((employee) => isPayrollEmployee(employee, includeOwner)).forEach((employee) => {
      const hiredMonth = employee.createdAt ? monthKey(new Date(employee.createdAt)) : month;
      if (existing.has(employee.id) || hiredMonth > month) return;
      run.items.push(itemFromEmployee(employee, d, month));
    });
    const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
    run.items.forEach((item) => {
      if (!item.paid && item.settledNet == null) {
        const currency = String(item.currency || "SAR").toUpperCase();
        item.currency = /^[A-Z]{3}$/.test(currency) ? currency : "SAR";
        const employee = employeesById.get(item.employeeId);
        if (employee) item.employeeStationId = employee.stationId || null;
        applyPayrollWagePatch(item, employee, d, month);
      }
      // Outside the paid check on purpose: the contract wage is a reference, not a
      // payable figure. Filling it only for unpaid lines left every settled line an
      // eternal "Qiwa mismatch" that blocked the whole month's wage file.
      if (item.qiwaWage == null) item.qiwaWage = (Number(item.base) || 0) + (Number(item.allowances) || 0);
    });
  });
}

export function syncPayrollFromProfiles(companyId, month) {
  if (!canManagePayroll(companyId)) return PAYROLL_DENY.MANAGE.error;
  const locked = runLockReason(companyId, month);
  if (locked) return locked;
  let updatedCount = 0;
  const rewritten = [];
  updateCompany(companyId, (d) => {
    const run = (d.payrollRuns || []).find((r) => r.month === month);
    if (!run) return;
    const includeOwner = d.settings?.includeOwnerInPayroll === true;
    const employees = new Map((d.employees || []).filter((employee) => isPayrollEmployee(employee, includeOwner)).map((employee) => [employee.id, employee]));
    run.items.forEach((item) => {
      if (item.paid || item.settledNet != null) return;
      const employee = employees.get(item.employeeId);
      if (!employee) return;
      const profileCurrency = String(employee.profile?.currency || "SAR").toUpperCase();
      const beforeBase = item.base;
      const beforeAllow = item.allowances;
      const changed = applyPayrollWagePatch(item, employee, d, month);
      const nextCurrency = /^[A-Z]{3}$/.test(profileCurrency) ? profileCurrency : "SAR";
      item.currency = nextCurrency;
      item.employeeStationId = employee.stationId || null;
      if (beforeBase !== item.base || beforeAllow !== item.allowances) {
        rewritten.push((item.employeeName || item.employeeId) + ": " + beforeBase + "+" + beforeAllow + " → " + item.base + "+" + item.allowances);
      }
      if (!changed) return;
      updatedCount += 1;
    });
  });
  // A bulk rewrite of wage figures from the profiles is a money change like any other:
  // the count alone does not say whose line moved or from what.
  if (rewritten.length) {
    logAudit(
      companyId,
      "payroll_sync_from_profiles",
      payrollActor(companyId).user?.name || "unknown",
      `Rewrote ${rewritten.length} line(s) from profiles (${month}) — ${rewritten.slice(0, 12).join(" · ")}${rewritten.length > 12 ? " …" : ""}`
    );
  }
  return updatedCount;
}

export function syncEmployeeSalaryToPayroll(companyId, employeeId) {
  updateCompany(companyId, (d) => {
    const employee = (d.employees || []).find((entry) => entry.id === employeeId);
    if (!employee || !isPayrollEmployee(employee, d.settings?.includeOwnerInPayroll === true)) return;
    d.payrollRuns = d.payrollRuns || [];
    const month = monthKey();
    let run = d.payrollRuns.find((entry) => entry.month === month);
    if (!run) {
      run = { id: uid("run"), month, createdAt: new Date().toISOString(), items: [] };
      d.payrollRuns.push(run);
    }
    let item = run.items.find((entry) => entry.employeeId === employeeId);
    if (!item) {
      run.items.push(itemFromEmployee(employee, d, month));
      return;
    }
    if (item.paid || item.settledNet != null) return;
    applyPayrollWagePatch(item, employee, d, month);
    item.employeeName = employee.name;
    item.employeePosition = employee.position || employee.role || "";
    item.employeeStationId = employee.stationId || null;
    const profileCurrency = String(employee.profile?.currency || "SAR").toUpperCase();
    item.currency = /^[A-Z]{3}$/.test(profileCurrency) ? profileCurrency : "SAR";
  });
}

/** The signed-in person's own unpaid line, refreshed from their contract and locked attendance. */
export function refreshOwnPayrollDerivation(companyId, month) {
  const { userId } = payrollActor(companyId);
  if (!companyId || !userId || !month) return false;
  if (String(month) < monthKey()) return false;
  let changed = false;
  updateCompany(companyId, (d) => {
    const run = (d.payrollRuns || []).find((row) => row.month === month);
    if (!run || run.status === "approved" || run.status === "sent") return;
    const item = (run.items || []).find((row) => String(row.employeeId) === String(userId));
    if (!item) return;
    const employee = (d.employees || []).find((row) => row.id === item.employeeId);
    changed = applyPayrollWagePatch(item, employee, d, month);
  });
  return changed;
}

export function setOwnerPayrollEnabled(companyId, enabled) {
  if (!canManagePayroll(companyId)) return PAYROLL_DENY.SETTINGS.error;
  updateCompany(companyId, (d) => {
    d.settings = d.settings || {};
    d.settings.includeOwnerInPayroll = Boolean(enabled);
    if (!enabled) {
      const ownerIds = new Set((d.employees || []).filter((employee) => employee.role === "owner").map((employee) => employee.id));
      (d.payrollRuns || []).forEach((run) => { run.items = (run.items || []).filter((item) => !ownerIds.has(item.employeeId)); });
    }
  });
}

/**
 * A decided month does not move. Two ways a month is decided: the run was approved
 * (the cloud handler refuses line edits past approval, so the local path must too),
 * or the month is closed and now lives in the archive, which the surface calls
 * read-only while the mutators still accepted writes into it.
 * Returns the blocking code so the caller names the right reason.
 */
export function runLockReason(companyId, month) {
  const status = getRun(getCompanyData(companyId), month)?.status;
  if (status === "approved" || status === "sent") return PAYROLL_DENY.RUN_LOCKED.error;
  if (String(month || "") < monthKey()) return PAYROLL_DENY.MONTH_CLOSED.error;
  return null;
}

export const runLocked = (companyId, month) => !!runLockReason(companyId, month);

export function updatePayrollItem(companyId, month, itemId, updates) {
  if (!canManagePayroll(companyId)) return PAYROLL_DENY.MANAGE.error;
  const locked = runLockReason(companyId, month);
  if (locked) return locked;
  if (Object.prototype.hasOwnProperty.call(updates || {}, "currency")) {
    const currency = String(updates.currency || "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return false;
    updates = { ...updates, currency };
  }
  updateCompany(companyId, (d) => {
    const run = (d.payrollRuns || []).find((r) => r.month === month);
    const item = run?.items.find((i) => i.id === itemId);
    if (!item || item.paid) return;
    // "deductions" is intentionally excluded: it is computed from documented
    // deduction lines (see lib/payrollDeductions.js), never typed in directly.
    const allowed = ["base", "allowances", "bonus", "currency"];
    for (const [field, value] of Object.entries(updates || {})) {
      if (!allowed.includes(field)) continue;
      if (field === "currency") item.currency = value;
      else if (Number.isFinite(Number(value)) && Number(value) >= 0) {
        const amount = Number(value);
        item[field] = amount;
        if (["base", "allowances"].includes(field)) {
          const employee = (d.employees || []).find((entry) => entry.id === item.employeeId);
          if (employee) {
            employee.profile = employee.profile || {};
            if (field === "base") employee.profile.baseSalary = amount;
            else employee.profile.allowances = Math.max(0, amount - payableNightAllowance(employee));
          }
        }
      }
    }
  });
}

export function setItemPaid(companyId, month, itemId, paid) {
  if (!canManagePayroll(companyId)) return PAYROLL_DENY.MANAGE.error;
  let moved = null;
  let blocked = null;
  updateCompany(companyId, (d) => {
    const run = (d.payrollRuns || []).find((r) => r.month === month);
    const item = run?.items.find((i) => i.id === itemId);
    if (!item) { blocked = "NO_OPEN_ITEM"; return; }
    const issues = paid ? payrollItemIssues(item) : [];
    // Returning the blocking issue by name: a wage mark that refuses in silence
    // reads as a broken button to anyone calling this outside the page.
    if (issues.length) { blocked = issues[0]; return; }
    if (paid) {
      // Freeze what is being paid. From here the line reports this figure verbatim, so a
      // later change to the net formula can never rewrite a wage that already moved.
      Object.assign(item, settlementStamp(item));
    } else {
      for (const field of ["settledNet", "settledOvertimeHours", "settledOvertimePay", "settledGosiEmployee", "settledAt"]) delete item[field];
    }
    item.paid = paid;
    item.paidAt = paid ? new Date().toISOString() : null;
    moved = { employeeId: item.employeeId, id: item.id, name: item.employeeName || item.employeeId, net: netOf(item) };
  });
  if (blocked) return blocked;
  if (!moved) return null;
  // Marking a wage paid and taking that mark back are both money movements, so
  // both belong in the audit trail and both are told to the person they concern.
  logAudit(
    companyId,
    paid ? "payroll_item_paid" : "payroll_item_unpaid",
    payrollActor(companyId).user?.name || "unknown",
    `${paid ? "Marked paid" : "Reverted to unpaid"} ${moved.name} — ${moved.net} (${month})`
  );
  notifyMoney(companyId, moved.employeeId, {
    ar: paid
      ? `أُشر راتبك في مسير ${month} كمدفوع.`
      : `أُلغي تأشير الدفع عن راتبك في مسير ${month} — البند عاد غير مدفوع وقيد المراجعة.`,
    en: paid
      ? `Your wage line for ${month} was marked paid.`
      : `The paid mark on your ${month} wage line was reverted — the line is unpaid and under review.`,
    to: "/app/payroll",
    key: `${paid ? "pay" : "unpay"}-${month}-${moved.id}-${Date.now()}`,
  });
  return null;
}