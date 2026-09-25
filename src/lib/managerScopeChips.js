/**
 * Manager «نطاقات» row — workplaces this person administers, and the
 * alert count for the open admin section on each one.
 * Zero stays quiet. Names come from the station register, never literals.
 */
import { expandStationScope, extraCoverageStationIds, userManagesStation, workplaceStations } from "./stationTree.js";
import { managedDutyEmployees, requestInboxEmployees, requestInboxMaySee, seesAllDutyStations } from "./dutyScope.js";
import { managerScopeSection, pageLocksToOwnWorkplace } from "./stationScopePolicy.js";
import { managerPendingInbox, requestEmployeeStationId } from "./requestWorkspace.js";
import { pendingManagerDecideCount } from "./otherRequestDerivations.js";
import { nightDueAdminEmployees, nightDueEmployeeCount, pendingPunchQueueCount } from "./suiteBadges.js";
import { faceOf, isDisciplineSettled } from "./disciplineBoard.js";
import { collectVoiceItems, deriveVoiceBoard } from "./voiceBoard.js";
import { deriveWpsStatus } from "./payrollDerivations.js";
import { isEscalated } from "./opsDerivations.js";

const TONE_RANK = { plain: 0, warn: 1, bad: 2 };

function hasHrPerm(user, data, key) {
  if (!user?.hrLevelId) return false;
  const level = (data?.hrLevels || []).find((row) => row.id === user.hrLevelId && row.active !== false);
  return !!(level?.permissions || []).includes(key);
}

/** null = company-wide HR reach. Mirrors permissions.hrScopeStations without the alias import. */
function hrStationScope(user, data) {
  if (!user?.hrLevelId) return [];
  const level = (data?.hrLevels || []).find((row) => row.id === user.hrLevelId);
  if (!level) return [];
  if (level.stationIds?.length) return level.stationIds;
  if (level.scope === "station") return user.hrStationId ? [user.hrStationId] : [];
  if (level.scope === "cluster") {
    const cluster = (data?.hrClusters || []).find((row) => row.id === user.hrClusterId);
    return cluster?.stationIds || [];
  }
  return null;
}

function stronger(a, b) {
  return (TONE_RANK[b] || 0) > (TONE_RANK[a] || 0) ? b : a;
}

/** Workplaces the signed-in person actually administers. Home alone is not enough. */
export function administeredWorkplaceStations(user, data) {
  if (!user || !data) return [];
  const workplaces = workplaceStations(data.stations || []);
  if (seesAllDutyStations(user, data)) return workplaces;
  const hr = hrStationScope(user, data);
  if (hr === null && (
    hasHrPerm(user, data, "manage_leave")
    || hasHrPerm(user, data, "manage_employees")
    || hasHrPerm(user, data, "view_employees")
    || hasHrPerm(user, data, "manage_payroll")
  )) {
    return workplaces;
  }
  const seeds = new Set((Array.isArray(hr) ? hr : []).map((id) => String(id || "").trim()).filter(Boolean));
  const home = String(user.stationId || "").trim();
  if (home && (user.role === "station_manager" || userManagesStation(user, data, home))) seeds.add(home);
  extraCoverageStationIds(user, data).forEach((id) => {
    const sid = String(id || "").trim();
    if (sid) seeds.add(sid);
  });
  if (!seeds.size) return [];
  const expanded = new Set(expandStationScope(data.stations || [], [...seeds]).map(String));
  return workplaces.filter((station) => expanded.has(String(station.id)));
}

function requestPeople(user, data) {
  const inbox = requestInboxEmployees(user, data);
  const due = nightDueAdminEmployees(user, data);
  const seen = new Set();
  const people = [];
  for (const employee of [...inbox, ...due]) {
    if (!employee?.id || seen.has(employee.id)) continue;
    if (!requestInboxMaySee(user, employee, data)) continue;
    seen.add(employee.id);
    people.push(employee);
  }
  return people;
}

function bucket(allowed, stationId, count, tone, acc) {
  const n = Math.max(0, Number(count) || 0);
  if (!n) return;
  const sid = String(stationId || "").trim();
  if (sid && !allowed.has(sid)) return;
  acc.total += n;
  acc.tone = stronger(acc.tone, tone || "plain");
  if (!sid) return;
  const row = acc.by[sid] || { count: 0, tone: "plain" };
  row.count += n;
  row.tone = stronger(row.tone, tone || "plain");
  acc.by[sid] = row;
}

function emptyAcc() {
  return { by: {}, total: 0, tone: "plain" };
}

function requestAlerts(user, data, allowed) {
  const acc = emptyAcc();
  const people = requestPeople(user, data);
  const inbox = managerPendingInbox(people, "ar", { stations: data?.stations || [] });
  if (inbox.rows?.length) {
    const perStation = new Map();
    for (const row of inbox.rows) {
      const sid = String(row.stationId || requestEmployeeStationId(row.employee) || "");
      perStation.set(sid, (perStation.get(sid) || 0) + 1);
    }
    for (const [sid, n] of perStation) bucket(allowed, sid, n, "plain", acc);
    return acc;
  }
  for (const person of people) {
    const n = pendingManagerDecideCount([person]);
    bucket(allowed, requestEmployeeStationId(person), n, "plain", acc);
  }
  return acc;
}

function disciplineAlerts(user, data, allowed) {
  const acc = emptyAcc();
  const can = !!(user && (
    data?.ownerId === user.id
    || user.hrLevelId
    || ["director", "ops_manager", "station_manager"].includes(user.role)
  ));
  if (!can) return acc;
  const employees = data?.employees || [];
  for (const item of data?.disciplinaryCases || []) {
    if (isDisciplineSettled(item)) continue;
    const person = employees.find((row) => String(row.id) === String(item.employeeId));
    const sid = item.stationId || person?.stationId || person?.station_id || "";
    const tone = faceOf(item.status).id === "objected" ? "bad" : "warn";
    bucket(allowed, sid, 1, tone, acc);
  }
  return acc;
}

function voiceAlerts(user, data, allowed) {
  const acc = emptyAcc();
  const can = !!(user && (
    data?.ownerId === user.id
    || ["director", "ops_manager", "pgm", "station_manager"].includes(user.role)
    || hasHrPerm(user, data, "view_anonymous_reports")
    || hasHrPerm(user, data, "manage_anonymous_reports")
  ));
  if (!can) return acc;
  const employees = data?.employees || [];
  const items = collectVoiceItems({
    publicReports: data?.publicReports,
    anonymousReports: data?.anonymousReports,
  });
  for (const stationId of allowed) {
    const queue = items.filter((item) => {
      const author = employees.find((row) => String(row.id) === String(item.authorId));
      return String(item.stationId || author?.stationId || "") === String(stationId);
    });
    if (!queue.length) continue;
    const board = deriveVoiceBoard({
      items,
      queueItems: queue,
      employees,
      stations: data?.stations || [],
      canManage: true,
      userId: user.id,
    });
    const tone = board.overdue?.length ? "bad" : "warn";
    bucket(allowed, stationId, board.openCount, tone, acc);
  }
  return acc;
}

function attendanceAlerts(user, data, allowed, attendanceRows) {
  const acc = emptyAcc();
  const people = managedDutyEmployees(user, data);
  for (const stationId of allowed) {
    const at = people.filter((employee) => String(employee.stationId || "") === String(stationId));
    const punch = pendingPunchQueueCount(at, attendanceRows || []);
    const night = nightDueEmployeeCount(at, data);
    bucket(allowed, stationId, punch + night, "plain", acc);
  }
  return acc;
}

function expenseOpen(claim, user, data) {
  const status = claim?.status || "pending";
  const senior = seesAllDutyStations(user, data) || user?.id === data?.ownerId;
  if (status === "pending" || status === "submitted") {
    return senior || ["pgm", "station_manager"].includes(user?.role);
  }
  if (status === "manager_approved") return user?.role === "financial_officer" || senior;
  return false;
}

function moneyAlerts(section, user, data, allowed) {
  const acc = emptyAcc();
  if (section === "expenses") {
    const claims = data?.expenseClaims || data?.expenses || [];
    for (const claim of claims) {
      if (!expenseOpen(claim, user, data)) continue;
      bucket(allowed, claim.stationId, 1, "plain", acc);
    }
    return acc;
  }
  if (section === "payroll") {
    const can = !!(user && (
      user.id === data?.ownerId
      || user.isOwner
      || user.role === "owner"
      || ["director", "ops_manager", "pgm"].includes(user.role)
      || hasHrPerm(user, data, "manage_payroll")
    ));
    if (!can) return acc;
    for (const run of data?.payrollRuns || []) {
      if (!(run.items || []).length) continue;
      if (deriveWpsStatus(run).status !== "awaiting_approval") continue;
      for (const item of run.items) {
        bucket(allowed, item.employeeStationId || item.stationId, 1, "plain", acc);
      }
    }
    return acc;
  }
  if (section === "assets") {
    for (const row of data?.assetTransfers || []) {
      if (row.status !== "pending") continue;
      bucket(allowed, row.fromStationId || row.stationId, 1, "plain", acc);
    }
    return acc;
  }
  if (section === "inventory") {
    for (const row of data?.materialRequests || []) {
      if (row.status !== "pending") continue;
      bucket(allowed, row.sourceStationId || row.stationId, 1, "plain", acc);
    }
    return acc;
  }
  return acc;
}

function safetyAlerts(data, allowed) {
  const acc = emptyAcc();
  for (const rec of data?.safety || []) {
    const open = (rec.hazards || []).filter((hazard) => !hazard?.closedAt).length;
    bucket(allowed, rec.stationId, open, "warn", acc);
  }
  return acc;
}

function escalationAlerts(data, allowed) {
  const acc = emptyAcc();
  for (const task of data?.tasks || []) {
    if (!isEscalated(task)) continue;
    bucket(allowed, task.stationId, 1, "warn", acc);
  }
  return acc;
}

function alertsFor(section, user, data, allowed, attendanceRows) {
  if (section === "requests") return requestAlerts(user, data, allowed);
  if (section === "discipline") return disciplineAlerts(user, data, allowed);
  if (section === "complaints") return voiceAlerts(user, data, allowed);
  if (section === "attendance") return attendanceAlerts(user, data, allowed, attendanceRows);
  if (section === "payroll" || section === "expenses" || section === "assets" || section === "inventory") {
    return moneyAlerts(section, user, data, allowed);
  }
  if (section === "safety") return safetyAlerts(data, allowed);
  if (section === "escalation") return escalationAlerts(data, allowed);
  return emptyAcc();
}

export function buildManagerScopeModel({
  pathname,
  search = "",
  user,
  data,
  scope = "all",
  attendanceRows = [],
  railSide = "",
} = {}) {
  const section = managerScopeSection(pathname, search, railSide);
  const locked = pageLocksToOwnWorkplace({ pathname, employee: user, data });
  const stations = (!section || locked) ? [] : administeredWorkplaceStations(user, data);
  const visible = Boolean(section) && !locked && stations.length > 0;
  const allowed = new Set(stations.map((station) => String(station.id)));
  const alerts = visible ? alertsFor(section, user, data, allowed, attendanceRows) : emptyAcc();
  const selected = String(scope || "all");
  return {
    visible,
    section,
    selected: selected !== "all" && allowed.has(selected) ? selected : "all",
    stations: stations.map((station) => ({
      id: String(station.id),
      name: String(station.name || station.nameAr || station.id),
    })),
    counts: alerts.by,
    total: alerts.total,
    tone: alerts.total > 0 ? alerts.tone : "plain",
  };
}

const NOTICE_SECTIONS = [
  { id: "requests", ar: "طلبات بانتظار قرارك", en: "Requests awaiting you", kindAr: "الطلبات", kindEn: "Requests", route: "/app/requests/manage" },
  { id: "discipline", ar: "جزاءات مفتوحة", en: "Open discipline cases", kindAr: "الجزاءات", kindEn: "Discipline", route: "/app/discipline?tab=manage" },
  { id: "complaints", ar: "صوت بانتظار الرد", en: "Voice awaiting a reply", kindAr: "صوت الموظف", kindEn: "Voice", route: "/app/complaints?tab=manage" },
  { id: "attendance", ar: "حضور ينتظر المراجعة", en: "Attendance awaiting review", kindAr: "الحضور والدوام", kindEn: "Attendance", route: "/app/attendance?lane=manage" },
  { id: "safety", ar: "مخاطر سلامة مفتوحة", en: "Open safety hazards", kindAr: "السلامة", kindEn: "Safety", route: "/app/safety?lane=manage" },
  { id: "escalation", ar: "مهام تصاعدت", en: "Escalated tasks", kindAr: "التشغيل اليومي", kindEn: "Operations", route: "/app/tasks?lane=manage" },
  { id: "expenses", ar: "مصروفات بانتظار قرار", en: "Expenses awaiting you", kindAr: "المال والأصول", kindEn: "Money", route: "/app/expenses?view=manage" },
  { id: "payroll", ar: "مسير بانتظار الاعتماد", en: "Payroll awaiting approval", kindAr: "المال والأصول", kindEn: "Money", route: "/app/payroll?view=manage" },
  { id: "assets", ar: "نقل أصل بانتظارك", en: "Asset transfer awaiting you", kindAr: "المال والأصول", kindEn: "Money", route: "/app/assets?view=manage" },
  { id: "inventory", ar: "طلب مخزون بانتظارك", en: "Stock request awaiting you", kindAr: "المخزون", kindEn: "Inventory", route: "/app/inventory?view=manage" },
];

function noticeBand(section, tone) {
  if (tone === "bad" || section === "safety" || section === "escalation") return "urgent";
  if (tone === "warn" || section === "requests" || section === "attendance" || section === "discipline" || section === "complaints" || section === "expenses" || section === "payroll" || section === "assets" || section === "inventory") {
    return "decision";
  }
  return "info";
}

/**
 * One row per branch and topic, across every workplace the viewer administers.
 * Opening a row is what selects that branch. Counts stay derived.
 */
export function buildBranchNotices({ user, data, attendanceRows = [] } = {}) {
  const stations = administeredWorkplaceStations(user, data);
  const allowed = new Set(stations.map((station) => String(station.id)));
  const nameOf = new Map(stations.map((station) => [String(station.id), String(station.name || station.nameAr || "—")]));
  const items = [];
  for (const section of NOTICE_SECTIONS) {
    const alerts = alertsFor(section.id, user, data, allowed, attendanceRows);
    for (const [sid, row] of Object.entries(alerts.by || {})) {
      const count = Math.max(0, Number(row?.count) || 0);
      if (!count || !nameOf.has(sid)) continue;
      items.push({
        id: `${section.id}:${sid}`,
        stationId: sid,
        branch: nameOf.get(sid),
        titleAr: section.ar,
        titleEn: section.en,
        kindAr: section.kindAr,
        kindEn: section.kindEn,
        route: section.route,
        count,
        band: noticeBand(section.id, row.tone),
      });
    }
  }
  const rank = { urgent: 0, decision: 1, info: 2 };
  items.sort((a, b) => (rank[a.band] - rank[b.band]) || (b.count - a.count) || a.branch.localeCompare(b.branch, "ar"));
  return items;
}
