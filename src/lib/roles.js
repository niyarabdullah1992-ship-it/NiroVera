// Company-customizable role labels — the underlying role still drives permissions,
// but the displayed label can be renamed by the director per company.

export const SYSTEM_ROLES = ["director", "ops_manager", "pgm", "station_manager", "safety_officer", "financial_officer", "employee"];

// Some roles use snake_case ids that don't match the camelCase translation dict keys.
const ROLE_T_KEY = { station_manager: "stationManager", ops_manager: "opsManager" };

export function getDefaultRoleLabel(role, t) {
  return t(ROLE_T_KEY[role] || role);
}

export function getRoleLabel(company, role, t) {
  const custom = company?.roleLabels?.[role];
  return (custom && custom.trim()) || getDefaultRoleLabel(role, t);
}