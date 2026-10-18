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

const MONEY = ["/app/payroll"];

/** Personal surface for each money module. Payroll opens قسيمتي, not the wage run. */
const EMPLOYEE_MONEY_HREF = {
  payroll: "/app/payroll?view=self&tab=payslip",
  "/app/payroll": "/app/payroll?view=self&tab=payslip",
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
    if (!tab || ["punch", "mine", "record", "roster", "report"].includes(tab)) {
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
    if (targetSide === "manage") params.set("lane", "manage");
    else params.delete("lane");
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

  // المهام والإثبات · التوقيع الرقمي · السلامة: the same page, the lane in the address decides the face.
  const laneDriven = isPath(path, "/app/tasks") || isPath(path, "/app/work-proof") || isPath(path, "/app/visitor-proof")
    || isPath(path, "/app/signing") || isPath(path, "/app/safety");
  if (laneDriven) {
    if (targetSide === "manage") {
      params.set("lane", "manage");
    } else {
      params.delete("lane");
      // Management-only tabs have no employee face; the employee page opens on its own default.
      params.delete("tab");
      params.delete("focus");
    }
    return joinPath(path, params);
  }

  if (targetSide === "employee") {
    if (path === "/app" || isPath(path, "/app/org") || isPath(path, "/app/hr") || isPath(path, "/app/escalation") || isPath(path, "/app/files")) {
      return "/app/attendance";
    }
    return "";
  }
  if (isPath(path, "/app/employees")) return "/app/hr";
  return "";
}

/** The other side's twin of a section — where a section has a different name on each side. */
// «الهيكل» (org) opens the full-page chart outside the rail, so it is never a landing for a side switch:
// HR → الموظف lands on the employee's first section, and the employee's الهيكل → الإدارة lands on HR.
const RAIL_TWIN = {
  manage: { compliance: "hse", payslip: "money", org: "hr" },
  employee: { hse: "compliance", money: "payslip" },
};

/**
 * Switching الموظف ↔ الإدارة keeps the person in the same section: السلامة (موظف) → السلامة (إدارة), and so on.
 * The section's own address on the other side keeps its tab where both faces share it; a section that is
 * not administered (or has no twin) opens the other side's first section.
 */
export function railSwitchHref({ pathname, search, targetSide, sides = [], activeKey = "" } = {}) {
  const target = (sides || []).find((side) => side.id === targetSide);
  if (!target) return railFaceHref(pathname, search, targetSide);
  const items = (target.groups || []).flatMap((group) => group.items || []);
  const section = String(activeKey || "").split(":")[0];
  const twinSection = (RAIL_TWIN[targetSide] || {})[section] || section;
  const twin = section ? items.find((item) => item.key === `${twinSection}:${targetSide}`) : null;
  if (!twin) {
    const fallback = railFaceHref(pathname, search, targetSide);
    return fallback && !section ? fallback : (items[0]?.to || fallback || "");
  }
  if (twinSection === section) {
    const same = railFaceHref(pathname, search, targetSide);
    if (same) return same;
  }
  return twin.to || "";
}

/** Drop the inner side button. The rail tab is the switch. */
export function railLaneTabs(tabs, railSide) {
  return (tabs || []).filter((tab) => {
    if (railSide === "employee") return tab.key !== "manage";
    if (railSide === "manage") return tab.key !== "mine";
    return true;
  });
}
