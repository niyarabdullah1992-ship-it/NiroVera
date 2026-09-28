/**
 * The suite rail is the only switch between الموظف and الإدارة.
 * A pinned side wins over a stale manage query until the address catches up.
 */
import React, { useContext, useEffect, useMemo, useState } from "react";

const RailSideContext = React.createContext({
  route: "",
  explicit: "",
  resolved: "",
  setExplicit() {},
});

export function routeRailSide(sides, activeKey, pathname) {
  const hit = (sides || []).find((side) => (side.groups || []).some((group) => (group.items || []).some((item) => item.key === activeKey)));
  if (hit?.id) return hit.id;
  const path = String(pathname || "");
  if (path === "/app/employees" || path.startsWith("/app/employees/")) return "employee";
  return (sides || [])[0]?.id || "";
}

export function RailSideProvider({ routeSide = "", children }) {
  const [explicit, setExplicitState] = useState("");
  useEffect(() => {
    if (explicit && explicit === routeSide) setExplicitState("");
  }, [explicit, routeSide]);
  const value = useMemo(() => ({
    route: routeSide || "",
    explicit,
    resolved: explicit || routeSide || "",
    setExplicit(side) {
      setExplicitState(side === "employee" || side === "manage" ? side : "");
    },
  }), [routeSide, explicit]);
  return React.createElement(RailSideContext.Provider, { value }, children);
}

export function useExplicitRailSide() {
  return useContext(RailSideContext).explicit;
}

export function useSetRailSide() {
  return useContext(RailSideContext).setExplicit;
}

export function useRailSide() {
  return useContext(RailSideContext).resolved;
}

function paramsOf(search) {
  return new URLSearchParams(String(search || "").replace(/^\?/, ""));
}

function joinPath(path, params) {
  const base = String(path || "").split("?")[0];
  const search = params.toString();
  return search ? `${base}?${search}` : base;
}

function isPath(path, base) {
  return path === base || path.startsWith(`${base}/`);
}

const MONEY = ["/app/payroll", "/app/expenses", "/app/assets", "/app/inventory"];

/** Personal surface for each money module. Payroll opens قسيمتي, not the wage run. */
const EMPLOYEE_MONEY_HREF = {
  payroll: "/app/payroll?view=self&tab=payslip",
  expenses: "/app/expenses?view=self",
  assets: "/app/assets?view=self",
  inventory: "/app/inventory?view=self",
  "/app/payroll": "/app/payroll?view=self&tab=payslip",
  "/app/expenses": "/app/expenses?view=self",
  "/app/assets": "/app/assets?view=self",
  "/app/inventory": "/app/inventory?view=self",
};

export function employeeMoneyHref(idOrPath) {
  const key = String(idOrPath || "").split("?")[0];
  return EMPLOYEE_MONEY_HREF[key] || "";
}

/** Employee-face section chip: own surface, no admin pending count. Manage keeps the board route. */
export function faceSectionTarget(page, railSide) {
  if (railSide !== "employee" || !page) return page;
  const personal = employeeMoneyHref(page.appId || page.to);
  if (!personal) return page;
  return { ...page, to: personal, badge: undefined, glow: undefined };
}

/**
 * Address for the same section on the other rail side.
 * Empty means this page has no twin — the caller leaves the address alone.
 */
export function railFaceHref(pathname, search, targetSide) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  const params = paramsOf(search);
  if (targetSide !== "employee" && targetSide !== "manage") return "";

  const duty = isPath(path, "/app/attendance") || isPath(path, "/app/shifts") || isPath(path, "/app/calendar");
  if (duty) {
    if (targetSide === "employee") {
      params.delete("lane");
      if (["team", "policy", "map", "settings", "schedule", "analytics"].includes(params.get("tab") || "")) params.delete("tab");
      return joinPath(path, params);
    }
    params.set("lane", "manage");
    const tab = params.get("tab");
    if (!tab || ["punch", "mine", "roster", "report"].includes(tab)) {
      if (isPath(path, "/app/shifts")) params.set("tab", "schedule");
      else if (!isPath(path, "/app/calendar")) params.set("tab", "team");
    }
    return joinPath(path, params);
  }

  if (isPath(path, "/app/requests")) {
    return targetSide === "manage" ? "/app/requests/manage" : "/app/requests";
  }
  if (isPath(path, "/app/discipline")) {
    const tab = params.get("tab") || "";
    const shared = tab === "law" || tab === "schedule" || tab === "archive";
    params.set("tab", shared ? tab : (targetSide === "manage" ? "manage" : "mine"));
    return joinPath("/app/discipline", params);
  }
  if (isPath(path, "/app/complaints")) {
    params.set("tab", targetSide === "manage" ? "manage" : "mine");
    return joinPath("/app/complaints", params);
  }
  if (isPath(path, "/app/performance")) {
    params.set("view", targetSide === "manage" ? "manage" : "self");
    return joinPath("/app/performance", params);
  }
  const money = MONEY.find((base) => isPath(path, base));
  if (money) {
    if (targetSide === "employee" && path === money) {
      const personal = employeeMoneyHref(money);
      if (personal) return personal;
    }
    params.set("view", targetSide === "manage" ? "manage" : "self");
    if (path === "/app/payroll" || path.startsWith("/app/payroll/")) {
      if (targetSide === "employee") params.set("tab", "payslip");
      else if (params.get("tab") === "payslip" || params.get("tab") === "slip") params.delete("tab");
    }
    return joinPath(path, params);
  }

  if (targetSide === "employee") {
    if (path === "/app" || isPath(path, "/app/org") || isPath(path, "/app/hr") || isPath(path, "/app/escalation") || isPath(path, "/app/files")) {
      return "/app/attendance";
    }
    return "";
  }
  if (
    isPath(path, "/app/tasks")
    || isPath(path, "/app/work-proof")
    || isPath(path, "/app/visitor-proof")
    || isPath(path, "/app/signing")
    || isPath(path, "/app/safety")
    || isPath(path, "/app/employees")
  ) {
    return "/app";
  }
  return "";
}

/** Drop the inner side button. The rail tab is the switch. */
export function railLaneTabs(tabs, railSide) {
  return (tabs || []).filter((tab) => {
    if (railSide === "employee") return tab.key !== "manage";
    if (railSide === "manage") return tab.key !== "mine";
    return true;
  });
}
