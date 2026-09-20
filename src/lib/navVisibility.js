// Single source of truth for which sections each role can see —
// used by the sidebar/mobile nav and the dashboards' quick-access shortcuts.

import { SMART_SECTION_ROUTES } from "@/lib/smartPositions";

const BASE = [
  "/app",
  "/app/tasks",
  "/app/attendance",
  "/app/calendar",
  "/app/shifts",
  "/app/leave",
  "/app/requests",
  "/app/files",
  "/app/inventory",
  "/app/assets",
  "/app/expenses",
  // The wage surface is split: management resolves into the run, everyone else
  // lands on their own payslip and deductions. Closing the route to employees
  // would close their own wage to them, so the page derives the view and every
  // payroll mutator carries its own guard (lib/payrollRights.js).
  "/app/payroll",
  "/app/signing",
  "/app/work-proof",
  "/app/visitor-proof",
  "/app/assistant",
  "/app/complaints",
  "/app/discipline",
  "/app/performance",
];
const MANAGER_EXTRA = ["/app/safety", "/app/escalation"];
const EXEC_EXTRA = ["/app/hr", "/app/org", "/app/settings"];

const PLAN_ROUTE_SECTIONS = {
  "/app/assistant": "assistant",
  "/app/tasks": "tasks",
  "/app/escalation": "tasks",
  "/app/inventory": "inventory",
  "/app/assets": "assets",
  "/app/attendance": "attendance",
  "/app/calendar": "attendance",
  "/app/shifts": "attendance",
  "/app/leave": "attendance",
  "/app/requests": "attendance",
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
  // Work and visitor proof close the field's own cycle — they are not part of the
  // document-signing section, so the signing plan feature must not gate them.
  "/app/work-proof": "tasks",
  "/app/visitor-proof": "tasks",
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
  if (user.hrLevelId) {
    allowed.add("/app/hr");
    allowed.add("/app/org");
    allowed.add("/app/settings");
    allowed.add("/app/discipline");
    if (hrPermissions.has("view_safety")) allowed.add("/app/safety");
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
  const gated = ["/app/hr", "/app/org", "/app/settings", "/app/safety", "/app/discipline"];
  const hit = gated.find((g) => pathname === g || pathname.startsWith(`${g}/`));
  if (hit) return allowed.has(hit);
  return true;
}
