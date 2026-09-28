/**
 * Company rail is two sides, switched at the top — never one mixed list.
 * الموظف — the personal face: punch, tasks, requests, signatures.
 * The signed-in file opens from the identity bar, not a rail pill.
 * الإدارة — sections this person administers. Omitted entirely when they manage nothing.
 * A destination is listed on one side only. «لوحة المالك» is not a company side.
 */
import { isWorkplaceStation, scopedStationIdsForUser } from "./stationTree.js";

export const RAIL_SIDES = [
  { id: "employee", ar: "الموظف", en: "Employee" },
  { id: "manage", ar: "الإدارة", en: "Manage" },
];

export const RAIL_SIDE_COLOR = {
  employee: "#C8A45A",
  manage: "#3C7D50",
};

const EMPLOYEE_GROUPS = [
  { id: "day", ar: "يومي", en: "Today", sections: ["duty", "daily", "compliance"] },
  { id: "asks", ar: "طلباتي", en: "My requests", sections: ["requests", "signing", "complaints"] },
  { id: "mine", ar: "ملفي", en: "My file", sections: ["payslip", "performance", "discipline", "org"] },
];

const MANAGE_GROUPS = [
  { id: "home", ar: "الرئيسية", en: "Home", sections: ["decide"] },
  { id: "daily", ar: "العمل اليومي", en: "Daily work", sections: ["duty", "daily", "hse"] },
  { id: "staff", ar: "الموظفون", en: "People", sections: ["workforce", "people", "requests", "discipline", "complaints", "performance"] },
  { id: "money", ar: "الامتثال والمال", en: "Compliance and pay", sections: ["ministry", "money", "signing"] },
];

const ROLE_RANK = {
  director: 5,
  ops_manager: 4,
  pgm: 3,
  station_manager: 2,
  safety_officer: 1,
  financial_officer: 1,
  inventory_keeper: 1,
  employee: 1,
};

function hrPerm(user, data, key) {
  if (!user?.hrLevelId) return false;
  const level = (data?.hrLevels || []).find((row) => row.id === user.hrLevelId && row.active !== false);
  return !!(level?.permissions || []).includes(key);
}

function isOwner(user, data) {
  return !!(user && (user.isOwner || user.role === "owner" || (data?.ownerId && user.id === data.ownerId)));
}

function seesAllStations(user, data) {
  if (!user) return false;
  if (isOwner(user, data) || user.role === "director" || user.role === "ops_manager") return true;
  const level = (data?.hrLevels || []).find((row) => row.id === user.hrLevelId && row.active !== false);
  if (!level) return false;
  const perms = level.permissions || [];
  const companyWide = !user.hrStationId && !level.stationId;
  return companyWide && (perms.includes("manage_employees") || perms.includes("view_employees"));
}

/** Same gate as permissions.canCreateTasks / Attendance isManager. */
function canCreateTasks(user, data) {
  if (!user) return false;
  if (user.role === "owner" || user.isOwner || (data?.ownerId && user.id === data.ownerId)) return true;
  return ["director", "ops_manager", "pgm", "station_manager"].includes(user.role);
}

function departmentGrant(user, data, department) {
  const smart = (data?.smartPositions || []).find((row) => String(row.employeeId) === String(user?.id));
  const value = smart?.permissions?.[department];
  if (value === "manage" || value === "view" || value === "hidden") return value;
  return "";
}

/**
 * Who may open the management face of performance (people, branches, scoring rule, archive).
 * An explicit performance grant on the person wins. Otherwise the same people who administer operations.
 */
export function canManagePerformance(user, data) {
  if (!user) return false;
  const grant = departmentGrant(user, data, "performance");
  if (grant === "manage") return true;
  if (grant === "view" || grant === "hidden") return false;
  return canCreateTasks(user, data);
}

/** Same gate as permissions.canAdjustPayroll. */
function canAdjustPayroll(user, data) {
  if (!user) return false;
  return user.id === data?.ownerId
    || (ROLE_RANK[user.role] || 0) > ROLE_RANK.station_manager
    || hrPerm(user, data, "manage_payroll");
}

/** Same split as financeRights.canManageSurface. */
function canManageMoney(surface, user, data) {
  if (!user) return false;
  const role = String(user.role || "");
  const senior = ["owner", "director", "ops_manager", "admin"].includes(role) || !!user.isOwner || (!!data?.ownerId && user.id === data.ownerId);
  const stationManager = !senior && ["station_manager", "pgm"].includes(role);
  const financeOfficer = !senior && role === "financial_officer";
  const stockKeeper = !senior && role === "inventory_keeper";
  if (surface === "payroll") return canAdjustPayroll(user, data);
  if (surface === "inventory") return senior || stationManager || stockKeeper;
  return senior || stationManager || financeOfficer;
}

/** Same gate as Requests.jsx canManageRequests. */
function canManageRequests(user, data) {
  return canCreateTasks(user, data) || hrPerm(user, data, "manage_leave");
}

/** Same gate as Discipline.jsx / suiteBadges canManageDiscipline. */
function canManageDiscipline(user, data) {
  return !!(isOwner(user, data) || user?.hrLevelId || ["director", "ops_manager", "station_manager"].includes(user?.role));
}

/** Same gate as Complaints.jsx / suiteBadges canManageVoice. */
function canManageVoice(user, data) {
  return !!(
    isOwner(user, data)
    || ["director", "ops_manager", "pgm", "station_manager"].includes(user?.role)
    || hrPerm(user, data, "view_anonymous_reports")
    || hrPerm(user, data, "manage_anonymous_reports")
  );
}

/** Same write gate as OrgStructure canWrite. */
function canWriteOrg(user, data) {
  return !!(user && (
    user.id === data?.ownerId
    || ["owner", "director", "admin", "pgm", "hr_manager", "ops_manager"].includes(user.role)
  ));
}

/** Same people-management gate as permissions.canManageEmployees, plus the owner. */
function canManageWorkforce(user, data) {
  if (!user) return false;
  if (isOwner(user, data)) return true;
  if (user.role === "director" || user.role === "ops_manager" || user.role === "station_manager") return true;
  if (user.role === "pgm" && user.canManageTeam) return true;
  return hrPerm(user, data, "manage_employees");
}

function appPath(group, appId) {
  const hit = (group?.items || []).find((item) => item.appId === appId);
  if (hit?.to) return String(hit.to).split("?")[0];
  return "";
}

function withQuery(path, query) {
  const base = String(path || "").split("?")[0];
  if (!base) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value != null && value !== "") params.set(key, value);
  }
  const search = params.toString();
  return search ? `${base}?${search}` : base;
}

function dutyManageTo(user, data, group) {
  if (canCreateTasks(user, data)) {
    return withQuery(appPath(group, "attendance") || group.to || "/app/attendance", { lane: "manage" });
  }
  if (hrPerm(user, data, "manage_leave")) {
    const shifts = appPath(group, "shifts") || appPath(group, "calendar");
    return shifts ? withQuery(shifts, { lane: "manage" }) : "";
  }
  return "";
}

function moneyManageTo(user, data, group) {
  for (const id of ["payroll", "expenses", "assets", "inventory"]) {
    const path = appPath(group, id);
    if (path && canManageMoney(id, user, data)) return withQuery(path, { view: "manage" });
  }
  return "";
}

export function railBadgeTone(kind) {
  if (kind === "warn") return { bg: "#C8A45A", label: "warn" };
  return { bg: "#3C7D50", label: "go" };
}

export function railBadgeKind(key) {
  if (key === "complaints") return "warn";
  return "go";
}

function ownedSignal(group, appId, keep) {
  const kind = group?.badgeKind || railBadgeKind(group?.key || appId);
  if (!keep || !group) return { badge: undefined, glow: undefined, badgeKind: kind };
  const item = (group.items || []).find((row) => row.appId === appId);
  const sole = (group.items || []).length <= 1;
  const primary = appId === "attendance" || appId === "payroll" || appId === "complaints" || appId === "tasks" || appId === "requests" || appId === "discipline" || appId === "command";
  return {
    badge: item?.badge ?? ((sole || primary) ? group.badge : undefined),
    glow: item?.glow ?? ((sole || primary) ? group.glow : undefined),
    badgeKind: kind,
  };
}

function faceItem({ section, lane, iconKey, label, to, signal }) {
  return {
    key: `${section}:${lane}`,
    section,
    lane,
    iconKey,
    label,
    to,
    badge: signal?.badge,
    glow: signal?.glow,
    badgeKind: signal?.badgeKind || railBadgeKind(section),
  };
}

function grouped(defs, built, lang) {
  const ar = lang !== "en";
  return defs.map((def) => ({
    id: def.id,
    label: ar ? def.ar : def.en,
    items: def.sections.map((id) => built.get(id)).filter(Boolean),
  })).filter((group) => group.items.length);
}

function sideKeys(sides) {
  return (sides || []).flatMap((side) => (side.groups || []).flatMap((group) => (group.items || []).map((item) => item.key)));
}

/**
 * Which rail row is current. Prefer the lane the URL actually opens.
 */
export function activeSuiteRailKey(sides, category, pathname, search) {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  const keys = sideKeys(sides);
  const has = (key) => keys.includes(key);
  const wantsManage = (
    (category === "requests" && /\/requests\/manage$/.test(path))
    || params.get("lane") === "manage"
    || params.get("view") === "manage"
    || params.get("view") === "admin"
    || params.get("tab") === "manage"
    || (category === "discipline" && ["raise", "calc"].includes(params.get("tab") || ""))
  );

  if (path === "/app/employees" || path.startsWith("/app/employees/")) {
    return has("file:employee") ? "file:employee" : "";
  }
  if (path === "/app") {
    if (params.get("face") === "map" && has("overview:manage")) return "overview:manage";
    if (has("decide:manage")) return "decide:manage";
    return "";
  }
  if (path === "/app/escalation" || path.startsWith("/app/escalation/")) {
    return has("daily:manage") ? "daily:manage" : "";
  }
  if (path.startsWith("/app/work-proof") || path.startsWith("/app/visitor-proof") || path === "/app/tasks" || path.startsWith("/app/tasks/")) {
    const dailyKey = params.get("lane") === "manage" && has("daily:manage") ? "daily:manage" : "daily:employee";
    if (has(dailyKey)) return dailyKey;
  }

  if (path === "/app/performance" || path.startsWith("/app/performance/")) {
    if (params.get("view") === "self" && has("performance:employee")) return "performance:employee";
    if ((params.get("view") === "manage" || !params.get("view")) && has("performance:manage")) return "performance:manage";
    if (has("performance:employee")) return "performance:employee";
  }

  const moneyPath = category === "money" || ["/app/payroll", "/app/expenses", "/app/assets", "/app/inventory"].some((base) => path === base || path.startsWith(`${base}/`));
  if (moneyPath) {
    const slip = params.get("tab") === "slip" || params.get("tab") === "payslip";
    const personal = params.get("view") === "self" || (slip && params.get("view") !== "manage");
    if (personal && has("payslip:employee")) return "payslip:employee";
    if (params.get("view") === "self" && has("money:employee")) return "money:employee";
    if ((params.get("view") === "manage" || !params.get("view")) && has("money:manage")) return "money:manage";
    if (has("money:employee")) return "money:employee";
    if (has("payslip:employee")) return "payslip:employee";
  }
  if (path === "/app/org" || path.startsWith("/app/org/")) {
    if (params.get("view") === "employee" && has("org:employee")) return "org:employee";
    if (has("people:manage")) return "people:manage";
  }
  if ((path === "/app/hr" || path.startsWith("/app/hr/")) && params.get("tab") === "compliance" && has("ministry:manage")) {
    return "ministry:manage";
  }
  if ((path === "/app/files" || path.startsWith("/app/files/") || path === "/app/assistant") && has("files:manage")) {
    return "files:manage";
  }
  if (path.startsWith("/app/safety") && params.get("lane") === "manage" && has("hse:manage")) return "hse:manage";
  if (path.startsWith("/app/signing") && params.get("lane") === "manage" && has("signing:manage")) return "signing:manage";

  const preferred = `${category}:${wantsManage ? "manage" : "employee"}`;
  if (has(preferred)) return preferred;
  return keys.find((key) => key.startsWith(`${category}:`)) || "";
}

/**
 * Split visible suite groups into the الموظف and الإدارة sides.
 * A section this person does not administer never appears under الإدارة.
 * The employee file never appears under الإدارة.
 * The same destination is never listed on both sides.
 * @param {{ key: string, to?: string, items?: { appId?: string, to?: string, badge?: number, glow?: string }[], badge?: number, glow?: string, badgeKind?: string }[]} railGroups
 * @param {string} [lang]
 * @param {{ user?: object, data?: object } | string} [context]
 */
export function buildSuiteRailClusters(railGroups, lang = "ar", context = {}) {
  const ctx = typeof context === "string" ? { user: context ? { role: context } : null, data: {} } : (context || {});
  const user = ctx.user || null;
  const data = ctx.data || {};
  const ar = lang !== "en";
  const byKey = new Map((railGroups || []).filter((group) => group?.key).map((group) => [group.key, group]));
  const employee = new Map();
  const manage = new Map();

  employee.set("org", faceItem({
    section: "org",
    lane: "employee",
    iconKey: "org",
    label: ar ? "الهيكل" : "Org chart",
    to: "/app/org?view=employee",
    signal: ownedSignal(null, "org", false),
  }));

  const duty = byKey.get("duty");
  if (duty) {
    const manageTo = dutyManageTo(user, data, duty);
    const mineTo = appPath(duty, "attendance") || String(duty.to || "/app/attendance").split("?")[0];
    if (manageTo) {
      manage.set("duty", faceItem({
        section: "duty",
        lane: "manage",
        iconKey: "duty",
        label: ar ? "الحضور والدوام" : "Time & Attendance",
        to: manageTo,
        signal: ownedSignal(duty, "attendance", true),
      }));
    }
    if (mineTo && mineTo !== manageTo) {
      employee.set("duty", faceItem({
        section: "duty",
        lane: "employee",
        iconKey: "duty",
        label: ar ? "بصمتي" : "My punch",
        to: mineTo,
        signal: ownedSignal(duty, "attendance", !manageTo),
      }));
    }
  }

  const signing = byKey.get("signing");
  const signingTo = signing ? (appPath(signing, "signing") || String(signing.to || "").split("?")[0]) : "";
  if (signingTo) {
    employee.set("signing", faceItem({
      section: "signing",
      lane: "employee",
      iconKey: "signing",
      label: ar ? "توقيعاتي" : "My signing",
      to: signingTo,
      signal: ownedSignal(signing, "signing", true),
    }));
    if (canCreateTasks(user, data)) {
      manage.set("signing", faceItem({
        section: "signing",
        lane: "manage",
        iconKey: "signing",
        label: ar ? "التوقيع الرقمي" : "Digital signing",
        to: withQuery(signingTo, { lane: "manage" }),
        signal: ownedSignal(signing, "signing", false),
      }));
    }
  }

  const performance = byKey.get("performance");
  const performanceTo = performance ? (appPath(performance, "performance") || String(performance.to || "").split("?")[0]) : "";
  if (performanceTo) {
    const manageTo = canManagePerformance(user, data) ? withQuery(performanceTo, { view: "manage" }) : "";
    const mineTo = withQuery(performanceTo, { view: "self" });
    if (manageTo) {
      manage.set("performance", faceItem({
        section: "performance",
        lane: "manage",
        iconKey: "performance",
        label: ar ? "الأداء" : "Performance",
        to: manageTo,
        signal: ownedSignal(performance, "performance", true),
      }));
    }
    if (mineTo && mineTo !== manageTo) {
      employee.set("performance", faceItem({
        section: "performance",
        lane: "employee",
        iconKey: "performance",
        label: ar ? "أدائي" : "My performance",
        to: mineTo,
        signal: ownedSignal(performance, "performance", !manageTo),
      }));
    }
  }

  const daily = byKey.get("daily");
  if (daily) {
    const tasksTo = appPath(daily, "tasks") || (String(daily.to || "").split("?")[0] === "/app/tasks" ? "/app/tasks" : "");
    if (tasksTo) {
      employee.set("daily", faceItem({
        section: "daily",
        lane: "employee",
        iconKey: "tasks",
        label: ar ? "مهامي" : "My tasks",
        to: tasksTo,
        signal: ownedSignal(daily, "tasks", true),
      }));
      if (canCreateTasks(user, data)) {
        manage.set("daily", faceItem({
          section: "daily",
          lane: "manage",
          iconKey: "tasks",
        label: ar ? "المهام والإثبات" : "Tasks and proof",
        to: withQuery(tasksTo, { lane: "manage" }),
          signal: ownedSignal(daily, "tasks", false),
        }));
      }
    }
  }

  const requests = byKey.get("requests");
  if (requests) {
    const manageTo = canManageRequests(user, data) ? "/app/requests/manage" : "";
    const mineTo = "/app/requests";
    if (manageTo) {
      manage.set("requests", faceItem({
        section: "requests",
        lane: "manage",
        iconKey: "requests",
        label: ar ? "الطلبات" : "Requests",
        to: manageTo,
        signal: ownedSignal(requests, "requests", true),
      }));
    }
    if (mineTo !== manageTo) {
      employee.set("requests", faceItem({
        section: "requests",
        lane: "employee",
        iconKey: "requests",
        label: ar ? "طلباتي" : "My requests",
        to: mineTo,
        signal: ownedSignal(requests, "requests", !manageTo),
      }));
    }
  }

  const discipline = byKey.get("discipline");
  if (discipline) {
    const base = appPath(discipline, "discipline") || String(discipline.to || "/app/discipline").split("?")[0];
    const manageTo = canManageDiscipline(user, data) ? withQuery(base, { tab: "manage" }) : "";
    const mineTo = withQuery(base, { tab: "mine" });
    if (manageTo) {
      manage.set("discipline", faceItem({
        section: "discipline",
        lane: "manage",
        iconKey: "discipline",
        label: ar ? "الجزاءات" : "Sanctions",
        to: manageTo,
        signal: ownedSignal(discipline, "discipline", true),
      }));
    }
    if (mineTo && mineTo !== manageTo) {
      employee.set("discipline", faceItem({
        section: "discipline",
        lane: "employee",
        iconKey: "discipline",
        label: ar ? "الجزاءات" : "Sanctions",
        to: mineTo,
        signal: ownedSignal(discipline, "discipline", !manageTo),
      }));
    }
  }

  const complaints = byKey.get("complaints");
  if (complaints) {
    const base = appPath(complaints, "complaints") || String(complaints.to || "/app/complaints").split("?")[0];
    const manageTo = canManageVoice(user, data) ? withQuery(base, { tab: "manage" }) : "";
    const mineTo = withQuery(base, { tab: "mine" });
    if (manageTo) {
      manage.set("complaints", faceItem({
        section: "complaints",
        lane: "manage",
        iconKey: "complaints",
        label: ar ? "صوت الموظف" : "Employee voice",
        to: manageTo,
        signal: ownedSignal(complaints, "complaints", true),
      }));
    }
    if (mineTo && mineTo !== manageTo) {
      employee.set("complaints", faceItem({
        section: "complaints",
        lane: "employee",
        iconKey: "complaints",
        label: ar ? "صوت الموظف" : "Employee voice",
        to: mineTo,
        signal: ownedSignal(complaints, "complaints", !manageTo),
      }));
    }
  }

  const safety = byKey.get("compliance");
  const safetyTo = safety ? (appPath(safety, "safety") || String(safety.to || "").split("?")[0]) : "";
  if (safetyTo) {
    employee.set("compliance", faceItem({
      section: "compliance",
      lane: "employee",
      iconKey: "compliance",
      label: ar ? "بلاغ سلامة" : "Safety report",
      to: safetyTo,
      signal: ownedSignal(safety, "safety", true),
    }));
    if (canCreateTasks(user, data)) {
      manage.set("hse", faceItem({
        section: "hse",
        lane: "manage",
        iconKey: "compliance",
        label: ar ? "السلامة" : "Safety",
        to: withQuery(safetyTo, { lane: "manage" }),
        signal: ownedSignal(safety, "safety", false),
      }));
    }
  }

  const decide = byKey.get("decide");
  if (decide && user?.role && user.role !== "employee") {
    manage.set("decide", faceItem({
      section: "decide",
      lane: "manage",
      iconKey: "decide",
      label: ar ? "لوحة القيادة" : "Dashboard",
      to: "/app",
      signal: ownedSignal(decide, "command", true),
    }));
  }

  const people = byKey.get("people");
  if (people && canWriteOrg(user, data)) {
    const base = appPath(people, "org") || String(people.to || "/app/org").split("?")[0];
    manage.set("people", faceItem({
      section: "people",
      lane: "manage",
      iconKey: "people",
      label: ar ? "المحطات التي أديرها" : "Stations I manage",
      to: withQuery(base, { view: "admin" }),
      signal: ownedSignal(people, "org", true),
    }));
  }

  const workforce = byKey.get("workforce");
  if (workforce && canManageWorkforce(user, data)) {
    const to = appPath(workforce, "hr") || String(workforce.to || "/app/hr").split("?")[0];
    if (to) {
      manage.set("workforce", faceItem({
        section: "workforce",
        lane: "manage",
        iconKey: "workforce",
        label: ar ? "الهيكل والفروع" : "Org and branches",
        to,
        signal: ownedSignal(workforce, "hr", true),
      }));
      manage.set("ministry", faceItem({
        section: "ministry",
        lane: "manage",
        iconKey: "ministry",
        label: ar ? "الامتثال الوزاري" : "Ministry compliance",
        to: withQuery(to, { tab: "compliance" }),
        signal: ownedSignal(workforce, "hr", false),
      }));
    }
  }

  const money = byKey.get("money");
  if (money) {
    const payrollPath = appPath(money, "payroll") || String(money.to || "/app/payroll").split("?")[0];
    if (payrollPath) {
      employee.set("payslip", faceItem({
        section: "payslip",
        lane: "employee",
        iconKey: "money",
        label: ar ? "قسيمتي" : "My payslip",
        to: withQuery(payrollPath, { view: "self", tab: "payslip" }),
        signal: ownedSignal(money, "payroll", false),
      }));
    }
    const manageTo = moneyManageTo(user, data, money);
    if (manageTo) {
      manage.set("money", faceItem({
        section: "money",
        lane: "manage",
        iconKey: "money",
        label: ar ? "المال والرواتب" : "Pay and money",
        to: manageTo,
        signal: ownedSignal(money, "payroll", true),
      }));
    }
  }

  const sides = [];
  const employeeGroups = grouped(EMPLOYEE_GROUPS, employee, lang);
  const manageGroups = grouped(MANAGE_GROUPS, manage, lang);
  if (employeeGroups.length) {
    sides.push({
      id: "employee",
      label: ar ? "الموظف" : "Employee",
      subtitle: ar ? "ما يخصّك: بصمتك ومهامك وطلباتك وتوقيعاتك." : "Yours: your punch, tasks, requests, and signatures.",
      groups: employeeGroups,
    });
  }
  if (manageGroups.length) {
    sides.push({
      id: "manage",
      label: ar ? "الإدارة" : "Manage",
      subtitle: ar ? "التشغيل والقرار والامتثال لكل الفروع." : "Operations, decisions, and compliance for every branch.",
      groups: manageGroups,
    });
  }
  return sides;
}

function resolvePerson(person, data) {
  if (!person) return null;
  const row = (data?.employees || []).find((item) => item?.id && item.id === person.id);
  if (!row) return person;
  return {
    ...person,
    ...row,
    profile: { ...(person.profile || {}), ...(row.profile || {}) },
  };
}

function personTitle(person, data) {
  const id = String(person?.id || "");
  const seat = (data?.orgSeats || []).find((item) => String(item.employeeId || "") === id && String(item.title || "").trim());
  return String(seat?.title || person?.profile?.position || person?.position || person?.jobTitle || person?.title || "").trim();
}

function stationName(person, data) {
  const id = String(person?.stationId || "");
  if (!id) return "";
  return String((data?.stations || []).find((item) => String(item.id) === id)?.name || "").trim();
}

function stationPhrase(name, ar) {
  const label = String(name || "").trim();
  if (!label) return "";
  if (!ar || label.startsWith("فرع")) return label;
  return `فرع ${label}`;
}

function workplaceCount(person, data) {
  const stations = (data?.stations || []).filter((item) => isWorkplaceStation(item));
  if (seesAllStations(person, data)) return stations.length;
  const ids = new Set(scopedStationIdsForUser(person, data).map(String));
  const scoped = stations.filter((item) => ids.has(String(item.id)));
  if (scoped.length) return scoped.length;
  return person?.stationId ? stations.filter((item) => String(item.id) === String(person.stationId)).length : 0;
}

function branchCountLabel(count, ar) {
  const n = Math.max(0, Number(count) || 0);
  if (!ar) return n === 1 ? "1 branch" : `${n} branches`;
  if (n === 0) return "لا فروع";
  if (n === 1) return "فرع واحد";
  if (n === 2) return "فرعان";
  if (n <= 10) return `${n} فروع`;
  return `${n} فرعاً`;
}

function shown(value) {
  const text = String(value || "").trim();
  return text || "—";
}

export function personInitials(name) {
  const parts = String(name || "").split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || "";
  if (first && second) return `${first}.${second}`;
  return first || "";
}

/** Footer card for the open side. Names come from the person record only. */
export function railFooter(person, data, lang = "ar", mode = "employee") {
  const row = resolvePerson(person, data);
  const name = String(row?.name || "").trim();
  const title = personTitle(row, data);
  const ar = lang !== "en";
  const branch = mode === "manage"
    ? branchCountLabel(workplaceCount(row, data), ar)
    : stationPhrase(stationName(row, data), ar);
  const id = String(row?.id || "").trim();
  return {
    name,
    title,
    line: `${shown(title)} · ${shown(branch)}`,
    initials: personInitials(name),
    to: id ? `/app/employees/${encodeURIComponent(id)}` : "",
  };
}
