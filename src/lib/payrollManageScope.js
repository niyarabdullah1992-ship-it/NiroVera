import { getRun, isPayrollEmployee } from "@/lib/payroll";
import { stationIdForTreeEmployee } from "@/lib/orgTree";
import { hrScopeStations } from "@/lib/permissions";
import { facePayrollItem } from "@/lib/payrollWageSync";

export const UNASSIGNED_STATION_ID = "__unassigned__";

/**
 * Whose wage lines a manager sees on the wage run — the scope Payroll.jsx applies, shared with the
 * «الامتثال الوزاري» index so both count the same lines: an HR level reads its stations, a PGM his
 * managed stations, anyone else the company; the owner's line stays out unless payroll includes him.
 */
export function payrollManageScope(data, currentUser, { ar = true } = {}) {
  const includeOwner = data?.settings?.includeOwnerInPayroll === true;
  const payrollScope = currentUser?.hrLevelId
    ? hrScopeStations(currentUser, data)
    : currentUser?.role === "pgm" ? (currentUser.managedStations || []) : null;
  const stationIdOf = (stationId) => stationId || null;
  const employeeStationId = (employee) => stationIdOf(stationIdForTreeEmployee(data, employee.id) || employee.stationId);
  const payrollEmployees = (data?.employees || []).filter((employee) => isPayrollEmployee(employee, includeOwner) && (payrollScope === null || payrollScope.includes(employeeStationId(employee))));
  const ownerIds = new Set(includeOwner ? [] : (data?.employees || []).filter((employee) => employee.role === "owner").map((employee) => employee.id));
  const employeeForItem = (item) => (data?.employees || []).find((employee) => employee.id === item.employeeId) || payrollEmployees.find((employee) => employee.id === item.employeeId) || {
    id: item.employeeId,
    name: item.employeeName || (ar ? "موظف سابق" : "Former employee"),
    position: item.employeePosition || "",
    stationId: stationIdOf(item.employeeStationId),
  };
  const itemStationId = (item) => {
    const employee = (data?.employees || []).find((entry) => entry.id === item.employeeId);
    return employee ? employeeStationId(employee) : stationIdOf(item.employeeStationId);
  };
  const inScope = (item) => !ownerIds.has(item.employeeId) && (payrollEmployees.some((employee) => employee.id === item.employeeId) || (item.employeeName && (payrollScope === null || payrollScope.includes(itemStationId(item)))));
  return { includeOwner, payrollScope, payrollEmployees, ownerIds, employeeForItem, itemStationId, inScope };
}

/** The month's run lines in scope, narrowed to the picked stations (none = all) and faced as the run shows them. */
export function payrollManageLines(data, currentUser, { month, stationIds = [], ar = true } = {}) {
  const scope = payrollManageScope(data, currentUser, { ar });
  const items = (getRun(data, month)?.items || []).filter(scope.inScope);
  const picked = stationIds.length ? items.filter((item) => stationIds.includes(scope.itemStationId(item) || UNASSIGNED_STATION_ID)) : items;
  const lines = picked.map((item) => facePayrollItem(item, (data?.employees || []).find((employee) => employee.id === item.employeeId), { otDecisions: data?.otDecisions, month, company: data }));
  return { lines, employeeForItem: scope.employeeForItem };
}
