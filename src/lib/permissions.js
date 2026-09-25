import { expandStationScope, scopedStationIdsForUser, isHrUnit, isWorkplaceStation } from "@/lib/stationTree";

// Role-based permission helpers for PowerCare.
// Roles: director | ops_manager | pgm | station_manager | safety_officer | financial_officer | inventory_keeper | employee
const employeeStationId = (employee, data) => employee?.stationId || data?.stations?.[0]?.id || null;
const stationsInOrder = (stations) => [...(stations || [])];

export const ROLE_RANK = {
  director: 5,
  ops_manager: 4,
  pgm: 3,
  station_manager: 2,
  safety_officer: 1,
  financial_officer: 1,
  inventory_keeper: 1,
  employee: 1,
};

// Can the user see all stations in the company?
export function canSeeAllStations(user) {
  return ["director", "ops_manager"].includes(user?.role);
}

// Stations visible to a user given the company data
export function visibleStations(user, data) {
  const stations = stationsInOrder(data?.stations).filter((station) => isWorkplaceStation(station) && !isHrUnit(station));
  if (!user) return [];
  try {
    if (canSeeAllStations(user) || user?.id === data?.ownerId || user.role === "safety_officer") return stations;
    const scoped = new Set(scopedStationIdsForUser(user, data));
    if (user.role === "pgm" && !(user.managedStations || []).length) return [];
    return stations.filter((station) => scoped.has(String(station.id)));
  } catch (error) {
    console.error("NiroVera visible stations:", error);
    return stations;
  }
}

// Can the user manage stations (add/edit)?
export function canManageStations(user, data) {
  return user?.role === "director" || user?.id === data?.ownerId;
}

// Can the user manage employees (add/remove)?
export function canManageEmployees(user) {
  if (user.role === "director") return true;
  if (user.role === "ops_manager") return true;
  if (user.role === "pgm") return !!user.canManageTeam;
  if (user.role === "station_manager") return true;
  return false;
}

// Can the user approve/reject reports?
export function canApproveReports(user) {
  return ["director", "ops_manager", "station_manager"].includes(user.role);
}

// Can the user reply to anonymous reports?
export function canReplyAnon(user) {
  return ["director", "ops_manager", "pgm", "station_manager"].includes(user.role);
}

// Can the user create tasks / templates / plans?
export function canCreateTasks(user, data) {
  if (!user) return false;
  // The company owner can always create tasks in any station branch, whatever role label they hold.
  if (user.role === "owner" || user.isOwner || (data?.ownerId && user.id === data.ownerId)) return true;
  return ["director", "ops_manager", "pgm", "station_manager"].includes(user.role);
}

export function canCreateSignatureRequests(user, data) {
  if (!user) return false;
  return user.id === data?.ownerId
    || ["director", "ops_manager", "pgm", "station_manager"].includes(user.role)
    || hasHRPermission(user, data, "manage_employees");
}

// Can the user transfer director role / ownership?
export function canTransferOwnership(user) {
  return user.role === "director";
}

// Is this user the actual company owner (not just holding the director role)?
export function isCompanyOwner(user, data) {
  return user?.id === data?.ownerId;
}

// Can the user create/edit HR levels and their permissions? Directors always can;
// the company owner can too, even if their role isn't "director".
export function canManageHRLevels(user, data) {
  return user.role === "director" || user.id === data?.ownerId;
}

// Is this user holding the topmost active HR tier (the highest-ranking HR position)?
export function isTopHRHolder(user, data) {
  const levels = (data?.hrLevels || []).filter((l) => l.active !== false);
  if (levels.length === 0) return false;
  if (!user?.hrLevelId) return false;
  const topOrder = Math.max(...levels.map((l) => l.order || 0));
  return levels.some((l) => l.order === topOrder && l.id === user.hrLevelId);
}

// Only the company owner or whoever holds the topmost HR position may assign a
// single position to more than one station — everyone else picks one station at a time.
export function canAssignMultiStation(user, data) {
  return user?.id === data?.ownerId || isTopHRHolder(user, data);
}

// Is this employee part of the HR hierarchy?
export function isHR(employee) {
  return !!employee.hrLevelId;
}

// Does this employee's HR level grant a specific permission?
export function hasHRPermission(user, data, permKey) {
  if (!user?.hrLevelId) return false;
  const level = (data?.hrLevels || []).find((l) => l.id === user.hrLevelId && l.active !== false);
  return !!level?.permissions?.includes(permKey);
}

// Payroll adjustments are restricted to HR staff with payroll permission and
// company roles ranked above Station Manager (PGM, Operations, Director, Owner).
export function canAdjustPayroll(user, data) {
  if (!user) return false;
  return user.id === data?.ownerId
    || (ROLE_RANK[user.role] || 0) > ROLE_RANK.station_manager
    || hasHRPermission(user, data, "manage_payroll");
}

// Stations an HR member can act on: [] none, [stationId, ...] scoped, or null for company-wide reach.
export function hrScopeStations(user, data) {
  if (!user?.hrLevelId) return [];
  const level = (data?.hrLevels || []).find((l) => l.id === user.hrLevelId);
  if (!level) return [];
  if (level.stationIds && level.stationIds.length > 0) return level.stationIds; // explicit station restriction, any scope
  if (level.scope === "station") return user.hrStationId ? [user.hrStationId] : [];
  if (level.scope === "cluster") {
    const cluster = (data?.hrClusters || []).find((c) => c.id === user.hrClusterId);
    return cluster ? cluster.stationIds || [] : [];
  }
  return null; // company-wide (tiers 3-5)
}

// The HR level object (tier/role/scope/permissions) assigned to this user, if any.
export function getHRLevel(user, data) {
  if (!user?.hrLevelId) return null;
  return (data?.hrLevels || []).find((l) => l.id === user.hrLevelId && l.active !== false) || null;
}

export function isHRManager(user, data) {
  return getHRLevel(user, data)?.role === "manager";
}

function hasTreeEmployeeAccess(user, employee, data, allowedAccess, departments = ["employees"]) {
  if (!user?.id || !employee?.id) return false;
  const permissions = (data?.smartPositions || []).find((item) => item.employeeId === user.id)?.permissions || {};
  if (!departments.some((department) => allowedAccess.includes(permissions[department]))) return false;
  const nodes = data?.orgTree || [];
  const managerNode = nodes.find((node) => node.type === "employee" && node.refId === user.id);
  let targetNode = nodes.find((node) => node.type === "employee" && node.refId === employee.id);
  const stationFor = (startNode) => {
    let node = startNode;
    while (node) {
      if (node.type === "station") return node.id;
      node = nodes.find((item) => item.id === node.parentId);
    }
    return null;
  };
  if (departments.includes("hr") && stationFor(managerNode) && stationFor(managerNode) === stationFor(targetNode)) return true;
  while (targetNode?.parentId) {
    if (targetNode.parentId === managerNode?.id) return true;
    targetNode = nodes.find((node) => node.id === targetNode.parentId);
  }
  return false;
}

export function canManageEmployeeHR(user, employee, data) {
  return !!user && (user.id === data?.ownerId || user.role === "director" || hasTreeEmployeeAccess(user, employee, data, ["manage"], ["hr"]));
}

export function canManageEmployeeContract(user, employee, data) {
  return canManageEmployeeHR(user, employee, data);
}

export function canManageEmployeeCommunication(user, employee, data) {
  return canManageEmployeeHR(user, employee, data);
}

export function isHRAssistant(user, data) {
  return getHRLevel(user, data)?.role === "assistant";
}

// Can the user manage a specific station's work schedule? Director always can;
// a station manager can for their own station; HR members need the explicit
// "manage_schedules" permission and to be in scope for that station.
export function canManageSchedule(user, data, stationId) {
  if (!user) return false;
  if (user.role === "owner" || user.isOwner || (data?.ownerId && user.id === data.ownerId)) return true;
  if (user.role === "director") return true;
  if (user.role === "station_manager" && employeeStationId(user, data) === stationId) return true;
  if (hasHRPermission(user, data, "manage_schedules")) {
    const scope = hrScopeStations(user, data);
    return scope === null || scope.includes(stationId);
  }
  return false;
}

// Privacy rule for full employee profiles (personal data, certificates, salary, leave):
// everyone sees their own profile; managers see profiles inside their station scope;
// HR members see profiles inside their HR scope. Regular employees can't open
// each other's profiles.
export function canViewEmployeeProfile(viewer, employee, data) {
  if (!viewer || !employee) return false;
  if (viewer.id === employee.id) return true;
  if (["director", "ops_manager"].includes(viewer.role) || viewer.id === data?.ownerId) return true;
  if (viewer.role === "pgm") {
    const scoped = new Set(expandStationScope(data?.stations || [], viewer.managedStations || []));
    return scoped.has(String(employeeStationId(employee, data) || ""));
  }
  if (viewer.role === "station_manager") {
    const scoped = new Set(scopedStationIdsForUser(viewer, data));
    return scoped.has(String(employeeStationId(employee, data) || ""));
  }
  if (hasTreeEmployeeAccess(viewer, employee, data, ["view", "manage"], ["hr"])) return true;
  if (viewer.hrLevelId) {
    const scope = hrScopeStations(viewer, data);
    return scope === null || scope.includes(employeeStationId(employee, data));
  }
  return false;
}

// Employees visible to a user (for management views)
export function visibleEmployees(user, data) {
  const employees = Array.isArray(data?.employees) ? data.employees : [];
  if (!user) return [];
  if (canSeeAllStations(user) || user?.id === data?.ownerId) return employees;
  if (user?.role === "station_manager") {
    const stationIds = new Set(scopedStationIdsForUser(user, data));
    return employees.filter((employee) => stationIds.has(String(employeeStationId(employee, data) || "")));
  }
  if (hasHRPermission(user, data, "view_employees") || hasHRPermission(user, data, "manage_employees")) {
    const scope = hrScopeStations(user, data);
    return scope === null ? employees : employees.filter((employee) => scope.includes(employeeStationId(employee, data)));
  }
  const stationIds = new Set(visibleStations(user, data).map((station) => station.id));
  return employees.filter((employee) => stationIds.has(employeeStationId(employee, data)));
}