import { companyRootStation, employeeInStationScope, extraCoverageStationIds, scopedStationIdsForUser, userManagesStation } from "./stationTree.js";
import { isViewerOwnFile, viewerActorIds } from "./employeeFileView.js";

/** Owner and company/branch directors see every workplace. */
export function seesAllDutyStations(user, data) {
  if (!user) return false;
  if (user.role === "owner" || user.isOwner || (data?.ownerId && user.id === data.ownerId)) return true;
  return ["director", "ops_manager"].includes(user.role);
}

/** Stations the person actually administers — not the company-wide owner/director view. */
export function managedDutyStationIds(user, data) {
  if (seesAllDutyStations(user, data)) {
    return (data?.stations || []).map((station) => String(station.id));
  }
  return (scopedStationIdsForUser(user, data) || []).map(String);
}

export function managedDutyStations(user, data) {
  const ids = new Set(managedDutyStationIds(user, data));
  return (data?.stations || []).filter((station) => ids.has(String(station.id)));
}

export function managedDutyEmployees(user, data) {
  if (seesAllDutyStations(user, data)) return Array.isArray(data?.employees) ? data.employees : [];
  const ids = new Set(managedDutyStationIds(user, data));
  if (!ids.size) return [];
  return (data?.employees || []).filter((employee) => employeeInStationScope(employee, ids));
}

function hrManageStationIds(user, data) {
  if (!user?.hrLevelId) return undefined;
  const level = (data?.hrLevels || []).find((row) => row.id === user.hrLevelId && row.active !== false);
  if (!level) return undefined;
  const perms = level.permissions || [];
  if (!perms.includes("manage_leave") && !perms.includes("view_employees") && !perms.includes("manage_employees")) {
    return undefined;
  }
  if (level.stationIds?.length) return level.stationIds.map(String);
  if (level.scope === "station") return user.hrStationId ? [String(user.hrStationId)] : [];
  if (level.scope === "cluster") {
    const cluster = (data?.hrClusters || []).find((row) => row.id === user.hrClusterId);
    return (cluster?.stationIds || []).map(String);
  }
  return null;
}

export function canSeeManagedNightDue(user, data) {
  if (!user) return false;
  if (seesAllDutyStations(user, data)) return true;
  if (["director", "ops_manager", "pgm", "station_manager"].includes(user.role)) return true;
  return hrManageStationIds(user, data) !== undefined;
}

function personExists(data, id) {
  const want = String(id || "").trim();
  if (!want) return false;
  return (data?.employees || []).some((row) => String(row.id) === want);
}

function hasWorkplaceSuperior(person, data) {
  const id = String(person?.id || "").trim();
  if (!id || !data) return false;
  const stations = data.stations || [];
  const seat = (data.orgSeats || []).find((row) => String(row.employeeId) === id);
  const homeId = String(person.stationId || person.profile?.stationId || seat?.stationId || "").trim();
  const managed = stations.filter((station) => String(station.managerId || "") === id);
  const home = stations.find((station) => String(station.id) === homeId);
  const start = managed.find((station) => {
    const parent = String(station.parentStationId || station.parentBranchId || "");
    return !parent || !managed.some((row) => String(row.id) === parent);
  }) || managed[0] || home;
  if (!start) return false;
  const homeManager = String(start.managerId || "").trim();
  if (!managed.length && homeManager && homeManager !== id && personExists(data, homeManager)) return true;
  const byId = new Map(stations.map((station) => [String(station.id), station]));
  let cursor = start;
  const seen = new Set();
  while (cursor) {
    const parentId = String(cursor.parentStationId || cursor.parentBranchId || "").trim();
    if (!parentId || seen.has(parentId)) break;
    seen.add(parentId);
    cursor = byId.get(parentId);
    if (!cursor) break;
    const mid = String(cursor.managerId || "").trim();
    if (mid && mid !== id && personExists(data, mid)) return true;
  }
  return false;
}

/** ملكية المنشأة — مقعد ownerId / دور المالك. */
export function isCompanyOwner(person, data) {
  if (!person) return false;
  if (data?.ownerId) return viewerActorIds(person).includes(String(data.ownerId));
  return !!(person.isOwner || person.role === "owner");
}

let headCacheData = null;
let headCacheValue = null;

/** رأس الشركة: أعلى منصب. المالك إن وُجد، وإلا من يجلس على جذر المنشأة بلا رئيس فوقه. */
export function companyHeadPerson(data) {
  if (data && data === headCacheData) return headCacheValue;
  const people = data?.employees || [];
  let head = null;
  if (data?.ownerId) {
    const owner = { id: data.ownerId };
    head = people.find((row) => isViewerOwnFile(row, owner) || String(row.id) === String(data.ownerId)) || null;
  }
  if (!head) head = people.find((row) => row.isOwner || row.role === "owner") || null;
  if (!head) {
    const root = companyRootStation(data?.stations);
    if (root?.managerId) {
      head = people.find((row) => String(row.id) === String(root.managerId)) || null;
    }
  }
  if (!head) {
    head = people.find((row) => {
      if (row.role !== "director") return false;
      const seat = (data?.orgSeats || []).find((item) => String(item.employeeId) === String(row.id));
      const reported = String(seat?.reportsToEmployeeId || row.profile?.directManagerId || "").trim();
      if (reported && reported !== String(row.id) && personExists(data, reported)) return false;
      return !hasWorkplaceSuperior(row, data);
    }) || null;
  }
  headCacheData = data || null;
  headCacheValue = head;
  return head;
}

export function isCompanyHeadPerson(person, data) {
  if (!person) return false;
  const head = companyHeadPerson(data);
  if (head) return isViewerOwnFile(head, person) || String(head.id) === String(person.id);
  return isCompanyOwner(person, data);
}

/** مدير الفرع المعيَّن على رأس المنشأة — لا مدير فرع الخفجي أو رابغ. */
export function isCompanyRootManager(person, data) {
  if (!person?.id || !data) return false;
  const root = companyRootStation(data.stations);
  return !!(root?.managerId && String(root.managerId) === String(person.id));
}

/** مدير طلباتي على الفرع — من وُضع managerId على محطة العمل. */
export function isBranchRequestManager(person, data, stationId) {
  if (!person || !data) return false;
  const sid = String(stationId || "").trim();
  if (!sid) return false;
  return userManagesStation(person, data, sid);
}

function requestWorkplaceId(person, data) {
  const sid = String(person?.stationId || person?.profile?.stationId || "").trim();
  if (sid) return sid;
  if (isCompanyRootManager(person, data)) {
    return String(companyRootStation(data?.stations)?.id || "");
  }
  return "";
}

/** من يدير إدارة طلباتي لفرع هذا الموظف. */
export function branchRequestManagers(data, employee) {
  const sid = requestWorkplaceId(employee, data);
  if (!sid || !employee?.id) return [];
  return (data?.employees || []).filter((user) => (
    String(user.id) !== String(employee.id) && isBranchRequestManager(user, data, sid)
  ));
}

/** مقعد رأس المنشأة تحت أعلى سلطة — الرأس يقرر طلبه. مدير طلباتي على فرع عادي يقرر أهله. */
export function ownerManagesPerson(person, data) {
  return headManagesPerson(person, data);
}

export function headManagesPerson(person, data) {
  if (!person?.id || !data || isCompanyHeadPerson(person, data)) return false;
  return isCompanyRootManager(person, data);
}

/**
 * Who 18632 due alerts cover.
 * Employee: self only. Manager / HR: every person in managed / HR stations — not viewer-only.
 */
export function nightDueScopeEmployees(user, data) {
  const roster = Array.isArray(data?.employees) ? data.employees : [];
  const self = roster.find((row) => row.id === user?.id) || (user?.id ? user : null);
  if (!canSeeManagedNightDue(user, data)) return self ? [self] : [];
  if (seesAllDutyStations(user, data)) return roster;
  const hrIds = hrManageStationIds(user, data);
  if (hrIds === null) return roster;
  const ids = new Set(managedDutyStationIds(user, data));
  if (Array.isArray(hrIds)) hrIds.forEach((id) => ids.add(String(id)));
  if (!ids.size) return self ? [self] : [];
  return roster.filter((employee) => employeeInStationScope(employee, ids));
}

/** إدارة inbox people — managed / HR scope minus the viewer. */
export function requestManageEmployees(user, data) {
  return nightDueScopeEmployees(user, data).filter((row) => !isViewerOwnFile(row, user));
}

/**
 * إدارة: مدير طلباتي على الفرع يرى أهل فرعه — بما فيهم رأس الشركة إن جلس على ذلك الفرع.
 * أعلى سلطة (مالك / رأس الهيكل) يرى طلبه نفسه في الإدارة. إن ملك إدارة رأس المنشأة فذلك مكتبه.
 * الموارد ومدير فرع آخر لا يأخذون ملف الرأس.
 */
export function requestInboxMaySee(viewer, person, data) {
  if (!person?.id || !viewer) return false;
  if (!viewerActorIds(viewer).length) return false;
  const own = isViewerOwnFile(person, viewer);
  if (own) return isCompanyHeadPerson(viewer, data);
  if (isCompanyHeadPerson(person, data)) {
    return isBranchRequestManager(viewer, data, requestWorkplaceId(person, data));
  }
  if (headManagesPerson(person, data)) return isCompanyHeadPerson(viewer, data);
  return true;
}

function inboxPeople(list, viewer, data) {
  return (list || []).filter((person) => requestInboxMaySee(viewer, person, data));
}

/** People whose pending requests a manager may decide — workplace / HR scope, not 18632-due only. */
export function requestDecideEmployees(user, data) {
  if (!user || !data) return [];
  const roster = Array.isArray(data.employees) ? data.employees : [];
  const managed = managedDutyEmployees(user, data);
  if (managed.length) return inboxPeople(managed, user, data);
  const hrIds = hrManageStationIds(user, data);
  if (hrIds === null) return inboxPeople(roster, user, data);
  if (Array.isArray(hrIds) && hrIds.length) {
    const ids = new Set(hrIds.map(String));
    return inboxPeople(roster.filter((row) => ids.has(String(row.stationId || ""))), user, data);
  }
  return [];
}

/** إدارة inbox roster — every station the actor may decide, never the header workplace alone. */
export function requestInboxEmployees(user, data) {
  const decided = requestDecideEmployees(user, data);
  const base = decided.length ? decided : inboxPeople(requestManageEmployees(user, data), user, data);
  const extra = [];
  if (isCompanyHeadPerson(user, data)) {
    extra.push(...(data?.employees || []).filter((person) => headManagesPerson(person, data)));
  }
  const head = companyHeadPerson(data);
  if (head && requestInboxMaySee(user, head, data)) extra.push(head);
  if (!extra.length) return base;
  const seen = new Set(base.map((row) => String(row.id)));
  return extra.reduce((list, person) => {
    if (seen.has(String(person.id))) return list;
    seen.add(String(person.id));
    return [...list, person];
  }, base);
}

function coversEmployeeStation(user, data, employee) {
  const sid = requestWorkplaceId(employee, data);
  if (!sid) return false;
  if (userManagesStation(user, data, sid)) return true;
  if (extraCoverageStationIds(user, data).some((id) => String(id) === sid)) return true;
  if (seesAllDutyStations(user, data)) return false;
  const hrIds = hrManageStationIds(user, data);
  if (hrIds === null) return true;
  if (Array.isArray(hrIds) && hrIds.some((id) => String(id) === sid)) return true;
  return false;
}

/**
 * In-app request notices — مدير طلباتي على الفرع.
 * رأس الشركة لا يُشعر نفسه: إن وُجد مدير طلباتي على الفرع يذهب الإشعار إليه، والرد في إدارة.
 */
export function requestNoticeAudience(data, employee) {
  if (!employee?.id || !data) return [];
  if (isCompanyHeadPerson(employee, data)) return branchRequestManagers(data, employee);
  if (headManagesPerson(employee, data)) {
    return (data.employees || []).filter((user) => isCompanyHeadPerson(user, data) && String(user.id) !== String(employee.id));
  }
  return (data.employees || []).filter((user) => {
    if (!user?.id || String(user.id) === String(employee.id)) return false;
    if (seesAllDutyStations(user, data) && !coversEmployeeStation(user, data, employee)) return false;
    return coversEmployeeStation(user, data, employee);
  });
}

/**
 * People a manager's إدارة 18632 watch covers.
 * Workplace / HR scope, plus the company head when they are on the roster —
 * رأس المنشأة's due is not hidden because they sit on the root instead of a child branch.
 */
export function nightDueAdminCoveredEmployees(user, data) {
  if (!canSeeManagedNightDue(user, data)) return [];
  const scoped = nightDueScopeEmployees(user, data);
  const seen = new Set(scoped.map((row) => String(row.id)));
  const extra = (data?.employees || []).filter((person) => {
    if (!isCompanyHeadPerson(person, data)) return false;
    if (seen.has(String(person.id))) return false;
    seen.add(String(person.id));
    return true;
  });
  return extra.length ? [...scoped, ...extra] : scoped;
}

export const SELF_DECIDE_FORBIDDEN_AR = "صاحب الطلب لا يعتمد طلبه. رأس الشركة أعلى منصب وهو من يوافق على طلبه.";
export const SELF_DECIDE_FORBIDDEN_EN = "The requester cannot decide their own request. The company head is the highest seat and approves their own file.";

/** Nobody except رأس الشركة approves their own request. Withdraw is not a decision. */
export function checkSelfDecideRequestGate({ actorId, subjectId, status, ownerId, actor, data } = {}) {
  if (status === "withdrawn") return { ok: true };
  const who = String(actorId || "").trim();
  const subject = String(subjectId || "").trim();
  if (!who || !subject || who !== subject) return { ok: true };
  const person = actor || { id: who, role: actor?.role, isOwner: actor?.isOwner };
  const org = data || { ownerId, employees: person.id ? [person] : [] };
  if (isCompanyHeadPerson(person, org)) {
    return { ok: true, via: "head" };
  }
  return {
    ok: false,
    error: "SELF_DECIDE_FORBIDDEN",
    reason: SELF_DECIDE_FORBIDDEN_AR,
    reasonEn: SELF_DECIDE_FORBIDDEN_EN,
  };
}

/** الرد في الإدارة — ملفي لا يعتمد ولا يرفض، حتى لرأس الشركة. */
export function headSelfDecidesFromMine() {
  return false;
}

/**
 * اعتمد/ارفض: إدارة فقط — مدير طلباتي على الفرع، أو أعلى سلطة على ملفه إن ملك الإدارة.
 * ملفي: رفع وانتظار وسحب. لا قرار من هناك.
 */
export function requestMayDecideOnLane({ actor, subject, lane, data } = {}) {
  if (!actor?.id || !subject?.id || !data) return false;
  const laneId = String(lane || "mine");
  if (laneId === "mine") return false;
  if (laneId === "manage") return requestInboxMaySee(actor, subject, data);
  return false;
}

export function ownPendingAwaitingNote(data, employee, lang = "ar") {
  const ar = lang === "ar";
  if (isCompanyHeadPerson(employee, data)) {
    const branch = branchRequestManagers(data, employee);
    const names = branch.map((row) => row.name).filter(Boolean).slice(0, 2).join(ar ? " أو " : " or ");
    if (names) {
      return ar
        ? `ينتظر قرار مدير طلباتي على الفرع (${names}) من إدارة.`
        : `Awaiting the branch request manager (${names}) in Manage.`;
    }
    return ar
      ? "رأس الشركة يقرر من إدارة — أعلى سلطة في المنشأة."
      : "The company head decides from Manage — the highest authority in the establishment.";
  }
  const others = requestNoticeAudience(data, employee);
  if (headManagesPerson(employee, data)) {
    const head = others[0];
    return ar
      ? `ينتظر قرار رأس الشركة${head?.name ? ` (${head.name})` : ""} — مدير رأس المنشأة فقط.`
      : `Awaiting the company head${head?.name ? ` (${head.name})` : ""} — only the manager seated on the establishment apex.`;
  }
  if (!others.length) {
    return ar
      ? "لا يوجد من يقرر هذا الطلب."
      : "Nobody can decide this request.";
  }
  const names = others.map((row) => row.name).filter(Boolean).slice(0, 2).join(ar ? " أو " : " or ");
  return ar ? `ينتظر قرار ${names}.` : `Awaiting ${names}.`;
}

function employeeInNightDueScope(user, data, employee) {
  if (!employee?.id) return false;
  if (!canSeeManagedNightDue(user, data)) return String(employee.id) === String(user?.id);
  if (seesAllDutyStations(user, data)) return true;
  const hrIds = hrManageStationIds(user, data);
  if (hrIds === null) return true;
  const ids = new Set(managedDutyStationIds(user, data));
  if (Array.isArray(hrIds)) hrIds.forEach((id) => ids.add(String(id)));
  if (!ids.size) return String(employee.id) === String(user?.id);
  return employeeInStationScope(employee, ids);
}

/** Managers who must be told this person is 18632-due — never the worker themselves. */
export function nightDueAdminAudience(data, employee) {
  if (!employee?.id) return [];
  const want = String(employee.id);
  const head = isCompanyHeadPerson(employee, data);
  return (data?.employees || []).filter((user) => {
    if (!user?.id || String(user.id) === want) return false;
    if (!canSeeManagedNightDue(user, data)) return false;
    if (head) return true;
    return employeeInNightDueScope(user, data, employee);
  });
}
