// Payroll data layer — monthly runs built from each employee's salary profile
// (profile.baseSalary / allowances / currency, see SalaryTab). Stored in
// data.payrollRuns and cloud-synced like every other collection.
import { updateCompany } from "@/lib/store";
import { checkArticle90Gate, OT_ANNUAL_MAX_HOURS } from "@/lib/payrollDerivations";

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getRun(data, month) {
  return (data?.payrollRuns || []).find((r) => r.month === month) || null;
}

export const netOf = (i) =>
  (Number(i.base) || 0) + (Number(i.allowances) || 0) + (Number(i.bonus) || 0) - (Number(i.deductions) || 0);

export const isPayrollEmployee = (employee, includeOwner = false) => includeOwner || employee?.role !== "owner";

const itemFromEmployee = (employee) => {
  const profile = employee.profile || {};
  const currency = String(profile.currency || "SAR").toUpperCase();
  return {
    id: uid("itm"), employeeId: employee.id,
    employeeName: employee.name, employeePosition: employee.position || employee.role || "", employeeStationId: employee.stationId || null,
    isOwner: employee.role === "owner",
    base: Number(profile.baseSalary) || 0, allowances: Number(profile.allowances) || 0,
    bonus: 0, deductions: 0, currency: /^[A-Z]{3}$/.test(currency) ? currency : "SAR", paid: false,
  };
};

export function payrollItemIssues(item) {
  if (!Number.isFinite(Number(item?.base)) || (!item?.isOwner && Number(item.base) <= 0) || Number(item.base) < 0) return ["BASE_REQUIRED"];
  const fields = ["allowances", "bonus", "deductions"];
  if (fields.some((field) => !Number.isFinite(Number(item?.[field])) || Number(item[field]) < 0)) return ["INVALID_AMOUNTS"];
  if (!item?.isOwner && netOf(item) <= 0) return ["NET_REQUIRED"];
  if (!checkArticle90Gate(item).ok) return ["ARTICLE_93_EXCEEDED"];
  if (Number(item.overtimeHours) > OT_ANNUAL_MAX_HOURS) return ["OT_ANNUAL_CAP"];
  if (!/^[A-Z]{3}$/.test(String(item?.currency || ""))) return ["CURRENCY_REQUIRED"];
  return [];
}

// Creates the month's run from current salary profiles if missing, and adds
// items for any employee hired after the run was first generated.
export function ensurePayrollRun(companyId, month) {
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
      run.items.push(itemFromEmployee(employee));
    });
    const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
    run.items.forEach((item) => {
      if (!item.paid) {
        const currency = String(item.currency || "SAR").toUpperCase();
        item.currency = /^[A-Z]{3}$/.test(currency) ? currency : "SAR";
        const employee = employeesById.get(item.employeeId);
        if (employee) item.employeeStationId = employee.stationId || null;
      }
    });
  });
}

export function syncPayrollFromProfiles(companyId, month) {
  let updatedCount = 0;
  updateCompany(companyId, (d) => {
    const run = (d.payrollRuns || []).find((r) => r.month === month);
    if (!run) return;
    const includeOwner = d.settings?.includeOwnerInPayroll === true;
    const employees = new Map((d.employees || []).filter((employee) => isPayrollEmployee(employee, includeOwner)).map((employee) => [employee.id, employee]));
    run.items.forEach((item) => {
      if (item.paid) return;
      const employee = employees.get(item.employeeId);
      if (!employee) return;
      const profile = employee.profile || {};
      const profileCurrency = String(profile.currency || "SAR").toUpperCase();
      const next = {
        base: Number(profile.baseSalary) || 0,
        allowances: Number(profile.allowances) || 0,
        currency: /^[A-Z]{3}$/.test(profileCurrency) ? profileCurrency : "SAR",
        employeeStationId: employee.stationId || null,
      };
      if (item.base === next.base && item.allowances === next.allowances && item.currency === next.currency && item.employeeStationId === next.employeeStationId) return;
      item.base = next.base;
      item.allowances = next.allowances;
      item.currency = next.currency;
      item.employeeStationId = next.employeeStationId;
      updatedCount += 1;
    });
  });
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
      run.items.push(itemFromEmployee(employee));
      return;
    }
    if (item.paid) return;
    const profileItem = itemFromEmployee(employee);
    item.base = profileItem.base;
    item.allowances = profileItem.allowances;
    item.currency = profileItem.currency;
    item.employeeName = profileItem.employeeName;
    item.employeePosition = profileItem.employeePosition;
    item.employeeStationId = profileItem.employeeStationId;
  });
}

export function setOwnerPayrollEnabled(companyId, enabled) {
  updateCompany(companyId, (d) => {
    d.settings = d.settings || {};
    d.settings.includeOwnerInPayroll = Boolean(enabled);
    if (!enabled) {
      const ownerIds = new Set((d.employees || []).filter((employee) => employee.role === "owner").map((employee) => employee.id));
      (d.payrollRuns || []).forEach((run) => { run.items = (run.items || []).filter((item) => !ownerIds.has(item.employeeId)); });
    }
  });
}

export function updatePayrollItem(companyId, month, itemId, updates) {
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
            employee.profile[field === "base" ? "baseSalary" : "allowances"] = amount;
          }
        }
      }
    }
  });
}

export function setItemPaid(companyId, month, itemId, paid) {
  updateCompany(companyId, (d) => {
    const run = (d.payrollRuns || []).find((r) => r.month === month);
    const item = run?.items.find((i) => i.id === itemId);
    if (!item || (paid && payrollItemIssues(item).length > 0)) return;
    item.paid = paid;
    item.paidAt = paid ? new Date().toISOString() : null;
  });
}