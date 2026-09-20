/**
 * Header «كل الفروع» is allowed on decentralized / cross-branch surfaces.
 * Duty, care, and money (except inventory) must resolve to one workplace.
 */

import { suiteAppForPath } from "./suiteApps.js";
import { companyRootStation, workplaceStations } from "./stationTree.js";

const SINGLE_STATION_GROUPS = new Set([
  "duty",
  "requests",
  "complaints",
  "discipline",
  "compliance",
  "money",
]);

const ALL_STATION_PATHS = new Set(["/app/inventory"]);

const MANAGE_ROLES = new Set([
  "director",
  "ops_manager",
  "pgm",
  "station_manager",
  "safety_officer",
  "financial_officer",
]);

function workStationId(employee) {
  const id = employee?.stationId;
  return id != null && String(id).trim() ? String(id) : null;
}

function pathIs(pathname, base) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  const root = String(base || "").replace(/\/+$/, "") || "/";
  return path === root || path.startsWith(`${root}/`);
}

export function headerAllowsAllStations(pathname) {
  if ([...ALL_STATION_PATHS].some((base) => pathIs(pathname, base))) return true;
  const app = suiteAppForPath(pathname);
  if (!app) return true;
  return !SINGLE_STATION_GROUPS.has(app.group);
}

export function pageLocksToOwnWorkplace({ pathname, employee, data } = {}) {
  if (headerAllowsAllStations(pathname)) return false;
  if (!employee) return false;
  if (employee.id && data?.ownerId && String(employee.id) === String(data.ownerId)) return false;
  if (MANAGE_ROLES.has(employee.role)) return false;
  if (employee.hrLevelId) return false;
  return true;
}

export function fallbackStationId({ employee, stations, visible } = {}) {
  const work = workStationId(employee);
  const list = (visible?.length ? visible : workplaceStations(stations || []))
    .filter((row) => row?.id != null && String(row.id).trim());
  if (work && list.some((row) => String(row.id) === work)) return work;
  if (list[0]?.id) return String(list[0].id);
  const root = companyRootStation(stations);
  return root?.id ? String(root.id) : null;
}

export function resolvePageStationScope({
  pathname,
  headerScope,
  employee,
  stations,
  visible,
  data,
} = {}) {
  const raw = headerScope == null || headerScope === "" || headerScope === "all"
    ? "all"
    : String(headerScope);
  const list = stations || [];
  if (pageLocksToOwnWorkplace({ pathname, employee, data })) {
    return fallbackStationId({ employee, stations: list, visible }) || raw;
  }
  if (headerAllowsAllStations(pathname)) return raw;
  if (raw !== "all" && list.some((row) => String(row.id) === raw)) return raw;
  return fallbackStationId({ employee, stations: list, visible }) || raw;
}

export function matchesExactStation(rowStationId, scopeId) {
  const scope = String(scopeId ?? "").trim();
  if (!scope || scope === "all") return true;
  const row = String(rowStationId ?? "").trim();
  return Boolean(row) && row === scope;
}
