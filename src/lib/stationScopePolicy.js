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

function searchParamsOf(search) {
  const raw = String(search || "");
  return new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
}

function pathIsBase(pathname, base) {
  return pathIs(pathname, base);
}

function sectionFromManagePath(path) {
  if (pathIsBase(path, "/app/attendance") || pathIsBase(path, "/app/shifts") || pathIsBase(path, "/app/calendar")) return "attendance";
  if (pathIsBase(path, "/app/requests")) return "requests";
  if (pathIsBase(path, "/app/discipline")) return "discipline";
  if (pathIsBase(path, "/app/complaints")) return "complaints";
  if (pathIsBase(path, "/app/performance")) return "performance";
  if (pathIsBase(path, "/app/payroll")) return "payroll";
  if (pathIsBase(path, "/app/expenses")) return "expenses";
  if (pathIsBase(path, "/app/assets")) return "assets";
  if (pathIsBase(path, "/app/inventory")) return "inventory";
  if (pathIsBase(path, "/app/safety")) return "safety";
  if (pathIsBase(path, "/app/escalation")) return "escalation";
  if (pathIsBase(path, "/app/files")) return "files";
  if (pathIsBase(path, "/app/org") || pathIsBase(path, "/app/hr")) return "org";
  return "";
}

function sectionFromUrl(path, params) {
  if (/\/requests\/manage$/.test(path)) return "requests";
  if (pathIsBase(path, "/app/discipline") && params.get("tab") === "manage") return "discipline";
  if (pathIsBase(path, "/app/complaints") && params.get("tab") === "manage") return "complaints";
  const duty = pathIsBase(path, "/app/attendance") || pathIsBase(path, "/app/shifts") || pathIsBase(path, "/app/calendar");
  if (duty && params.get("lane") === "manage") return "attendance";
  if (pathIsBase(path, "/app/performance")) {
    return params.get("view") === "self" ? "" : "performance";
  }
  const money = [
    ["/app/payroll", "payroll"],
    ["/app/expenses", "expenses"],
    ["/app/assets", "assets"],
    ["/app/inventory", "inventory"],
  ];
  for (const [base, id] of money) {
    if (pathIsBase(path, base)) return params.get("view") === "self" ? "" : id;
  }
  if (pathIsBase(path, "/app/safety")) return "safety";
  if (pathIsBase(path, "/app/escalation")) return "escalation";
  if (pathIsBase(path, "/app/files")) return "files";
  if (pathIsBase(path, "/app/org") || pathIsBase(path, "/app/hr")) return "org";
  return "";
}

/**
 * Admin face where «كل نطاق» is the section filter.
 * Mine / personal faces return "" so they stay on one workplace.
 * The الموظف rail hides the row even when the address still says manage.
 * The الإدارة rail shows it for the section even before the address catches up.
 */
export function managerScopeSection(pathname, search = "", railSide = "") {
  if (railSide === "employee") return "";
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  const params = searchParamsOf(search);
  const fromUrl = sectionFromUrl(path, params);
  if (railSide === "manage") return fromUrl || sectionFromManagePath(path);
  return fromUrl;
}

export function resolvePageStationScope({
  pathname,
  search = "",
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
  if (raw === "all" && managerScopeSection(pathname, search)) return "all";
  if (raw !== "all" && list.some((row) => String(row.id) === raw)) return raw;
  return fallbackStationId({ employee, stations: list, visible }) || raw;
}

export function matchesExactStation(rowStationId, scopeId) {
  const scope = String(scopeId ?? "").trim();
  if (!scope || scope === "all") return true;
  const row = String(rowStationId ?? "").trim();
  return Boolean(row) && row === scope;
}
