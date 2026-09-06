// Single source of truth for which sections each role can see —
// used by the sidebar/mobile nav and the dashboards' quick-access shortcuts.

import { SMART_SECTION_ROUTES } from "@/lib/smartPositions";

const BASE = [
  "/app",
  "/app/daily-report",
  "/app/tasks",
  "/app/attendance",
  "/app/shifts",
  "/app/leave",
  "/app/chat",
  "/app/files",
  "/app/inventory",
  "/app/assets",
  "/app/expenses",
  "/app/signing",
  "/app/work-proof",
  "/app/assistant",
  "/app/complaints",
  "/app/performance",
  "/app/manual",
];
const MANAGER_EXTRA = ["/app/safety", "/app/escalation"];
const EXEC_EXTRA = ["/app/hr", "/app/org", "/app/settings", "/app/payroll", "/app/discipline"];

const PLAN_ROUTE_SECTIONS = {
  "/app/assistant": "assistant",
  "/app/daily-report": "reports",
  "/app/tasks": "tasks",
  "/app/escalation": "tasks",
  "/app/inventory": "inventory",
  "/app/assets": "assets",
  "/app/attendance": "attendance",
  "/app/shifts": "attendance",
  "/app/leave": "attendance",
  "/app/hr": "hr",
  "/app/org": "hr",
  "/app/settings": "hr",
  "/app/discipline": "hr",
  "/app/performance": "performance",
  "/app/expenses": "expenses",
  "/app/payroll": "payroll",
  "/app/safety": "safety",
  "/app/complaints": "complaints",
  "/app/files": "files",
  "/app/signing": "signing",
  "/app/chat": "chat",
  "/app/work-proof": "signing",
};

const routeSection = (pathname) => Object.entries(PLAN_ROUTE_SECTIONS).find(([route]) => pathname === route || pathname.startsWith(`${route}/`))?.[1];
export function canUsePlanFeature(company, feature) { return (company?.planConfig?.enabledFeatures || []).includes(feature); }
export function canAccessPlanPath(pathname, company) {
  const section = routeSection(pathname);
  if (!section) return true;
  if (!(company?.planConfig?.enabledSections || []).includes(section)) return false;
  if (section === "assistant" && !canUsePlanFeature(company, "ai")) return false;
  if (section === "signing" && !canUsePlanFeature(company, "signing")) return false;
  return true;
}

export function allowedNavFor(user, data, company) {
  if (!user) return new Set(BASE);
  const allowed = new Set(BASE);
  const role = user.role;
  const hrLevel = user.hrLevelId && Array.isArray(data?.hrLevels) ? data.hrLevels.find((level) => level.id === user.hrLevelId) : null;
  const hrPermissions = new Set(hrLevel?.permissions || []);
  if (["station_manager", "pgm", "ops_manager", "director"].includes(role) || user.id === data?.ownerId) {
    MANAGER_EXTRA.forEach((p) => allowed.add(p));
  }
  if (["employee", "safety_officer"].includes(role)) allowed.add("/app/safety");
  if (["ops_manager", "director"].includes(role)) {
    EXEC_EXTRA.forEach((p) => allowed.add(p));
  }
  if (role === "pgm") allowed.add("/app/payroll");
  if (role === "financial_officer") {
    allowed.add("/app/payroll");
  }
  if (user.hrLevelId) {
    allowed.add("/app/hr");
    allowed.add("/app/org");
    allowed.add("/app/settings");
    allowed.add("/app/discipline");
    if (hrPermissions.has("view_safety")) allowed.add("/app/safety");
    if (hrPermissions.has("manage_payroll")) {
      allowed.add("/app/payroll");
    }
  }
  if (user.id === data?.ownerId) {
    EXEC_EXTRA.forEach((p) => allowed.add(p));
  }

  const smartPosition = (data?.smartPositions || []).find((position) => position.employeeId === user.id);
  const smartPerms = smartPosition?.permissions || {};
  const hasSmartGrants = Object.values(smartPerms).some((access) => access && access !== "hidden");
  if (smartPosition && user.id !== data?.ownerId && hasSmartGrants) {
    Object.entries(SMART_SECTION_ROUTES).forEach(([department, routes]) => {
      const list = Array.isArray(routes) ? routes : routes ? [routes] : [];
      if (!list.length) return;
      if (smartPerms[department]) return;
      if (department === "hr" && smartPerms.hr) return;
      list.forEach((route) => allowed.delete(route));
    });
  }

  [...allowed].forEach((route) => { if (!canAccessPlanPath(route, company)) allowed.delete(route); });
  return allowed;
}

export function canAccessPath(pathname, user, data, company) {
  if (!canAccessPlanPath(pathname, company)) return false;
  const allowed = allowedNavFor(user, data, company);
  const smartRoute = Object.values(SMART_SECTION_ROUTES)
    .flatMap((routes) => (Array.isArray(routes) ? routes : routes ? [routes] : []))
    .find((item) => pathname === item || pathname.startsWith(`${item}/`));
  if (smartRoute && !allowed.has(smartRoute)) return false;
  const gated = ["/app/hr", "/app/org", "/app/settings", "/app/payroll", "/app/safety", "/app/discipline"];
  const hit = gated.find((g) => pathname === g || pathname.startsWith(`${g}/`));
  if (hit) return allowed.has(hit);
  return true;
}
