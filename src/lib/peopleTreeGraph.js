import { companyRootStation, descendantStationIds, isCompanyRootStation, isManagerUnit, stationParentId, stationSubtreeIds } from "./stationTree.js";
import { normalizeArabicQuery } from "./workspaceDerivations.js";

const DEPTH_TONE = [
  "hsl(41 48% 42%)",
  "hsl(258 28% 48%)",
  "hsl(154 55% 32%)",
  "hsl(186 40% 32%)",
  "hsl(219 40% 40%)",
];

function ownerOf(data) {
  return (data?.employees || []).find((item) => item.id === data?.ownerId || item.role === "owner" || item.isOwner) || null;
}

function seatOf(data, employeeId) {
  if (!employeeId) return null;
  return (data?.orgSeats || []).find((seat) => String(seat.employeeId) === String(employeeId)) || null;
}

function activeEmployees(data) {
  return (data?.employees || []).filter((employee) => {
    if (!employee?.id || employee.role === "system") return false;
    if (employee.active === false) return false;
    return employee.profile?.employmentStatus !== "terminated";
  });
}

export function reportsToId(employee, data) {
  if (!employee?.id) return null;
  const seat = seatOf(data, employee.id);
  const raw = String(seat?.reportsToEmployeeId || employee.profile?.directManagerId || "").trim();
  return raw || null;
}

export function wouldCreateReportsCycle(data, employeeId, newManagerId) {
  const id = String(employeeId || "").trim();
  const parent = String(newManagerId || "").trim();
  if (!id || !parent) return false;
  if (parent === id) return true;
  const byId = new Map(activeEmployees(data).map((employee) => [String(employee.id), employee]));
  let cursor = byId.get(parent);
  const seen = new Set();
  while (cursor) {
    if (String(cursor.id) === id) return true;
    if (seen.has(cursor.id)) return true;
    seen.add(cursor.id);
    const next = reportsToId(cursor, data);
    cursor = next ? byId.get(String(next)) : undefined;
  }
  return false;
}

export function checkSetReportsToGate(data, employeeId, newManagerId) {
  const id = String(employeeId || "").trim();
  const parent = String(newManagerId || "").trim() || null;
  if (!id) return { ok: false, error: "EMPLOYEE", reason: "الموظف مطلوب.", reasonEn: "Employee is required." };
  const people = activeEmployees(data);
  if (!people.some((employee) => String(employee.id) === id)) {
    return { ok: false, error: "MISSING", reason: "الموظف غير موجود.", reasonEn: "Employee not found." };
  }
  if (parent && !people.some((employee) => String(employee.id) === parent)) {
    return { ok: false, error: "PARENT", reason: "المدير غير موجود.", reasonEn: "Manager not found." };
  }
  if (wouldCreateReportsCycle(data, id, parent)) {
    return {
      ok: false,
      error: "CYCLE",
      reason: "لا يمكن أن يتبع الموظف نفسه أو أحد مرؤوسيه.",
      reasonEn: "A person cannot report to themselves or to one of their reports.",
    };
  }
  return { ok: true, managerId: parent };
}

export function descendantEmployeeIds(data, employeeId) {
  const id = String(employeeId || "").trim();
  const kids = new Map();
  activeEmployees(data).forEach((employee) => {
    const parent = reportsToId(employee, data);
    if (!parent) return;
    const list = kids.get(parent) || [];
    list.push(String(employee.id));
    kids.set(parent, list);
  });
  const out = [];
  const stack = [...(kids.get(id) || [])];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    out.push(current);
    (kids.get(current) || []).forEach((child) => stack.push(child));
  }
  return out;
}

export function allowedReportsTo(data, employeeId) {
  const blocked = new Set([String(employeeId || ""), ...descendantEmployeeIds(data, employeeId)]);
  return activeEmployees(data).filter((employee) => employee?.id && !blocked.has(String(employee.id)));
}

export function reportsWord(n, ar = true) {
  const count = Math.max(0, Number(n) || 0);
  if (!ar) return count === 1 ? "1 direct report" : `${count} direct reports`;
  if (count === 0) return "بلا مرؤوسين";
  if (count === 1) return "مرؤوس واحد";
  if (count === 2) return "مرؤوسان";
  if (count <= 10) return `${count} مرؤوسين`;
  return `${count} مرؤوسًا`;
}

function homeStationId(employee, data) {
  return String(employee?.stationId || employee?.profile?.stationId || seatOf(data, employee.id)?.stationId || "").trim();
}

function stationById(data, id) {
  return (data?.stations || []).find((station) => String(station.id) === String(id || "")) || null;
}

export function stationsManagedBy(data, employeeId) {
  const id = String(employeeId || "");
  if (!id) return [];
  return (data?.stations || []).filter((station) => String(station.managerId || "") === id);
}

function joinNames(names, ar) {
  const list = (names || []).map((name) => String(name || "").trim()).filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return ar ? `${list[0]} و${list[1]}` : `${list[0]} and ${list[1]}`;
  const lead = list.slice(0, -1).join(ar ? "، " : ", ");
  return ar ? `${lead} و${list[list.length - 1]}` : `${lead}, and ${list[list.length - 1]}`;
}

/** Subscriber copy: one person on two branch cards — home punch, parent-place boss. */
export function explainWorkplaceManager(data, employeeId, { ar = true } = {}) {
  const id = String(employeeId || "").trim();
  if (!id) return null;
  const employee = (data?.employees || []).find((item) => String(item.id) === id);
  if (!employee) return null;
  const managed = stationsManagedBy(data, id);
  if (!managed.length) return null;
  const home = stationById(data, homeStationId(employee, data));
  const bossId = workplaceReportsToId(employee, data);
  const boss = bossId
    ? (data?.employees || []).find((item) => String(item.id) === String(bossId))
    : null;
  const coversLabel = joinNames(managed.map((station) => station.name), ar);
  const homeName = home?.name || (ar ? "مقعده" : "their seat");
  const reportsToName = boss?.name || (ar ? "مدير المكان الأعلى" : "the parent-place manager");
  const many = managed.length > 1;
  const homeId = String(home?.id || "");
  const managedIds = managed.map((station) => String(station.id));
  return {
    managedCount: managed.length,
    managedIds,
    homeId,
    coversLabel,
    homeName,
    reportsToName,
    many,
    line: many
      ? (ar
        ? `يمسك ${coversLabel} — شخص واحد لا مقعدان. يحضر من ${homeName}. يتبع ${reportsToName}.`
        : `Holds ${coversLabel} — one person, not two seats. Attends from ${homeName}. Reports to ${reportsToName}.`)
      : (ar
        ? `يحضر من ${homeName}. يتبع ${reportsToName}.`
        : `Attends from ${homeName}. Reports to ${reportsToName}.`),
  };
}

/** On a workplace card: home punch vs extra cover. Admin nodes stay unmarked. */
export function workplaceManagerCardMark(data, employeeId, stationId) {
  const note = explainWorkplaceManager(data, employeeId, { ar: true });
  if (!note?.many) return null;
  const sid = String(stationId || "");
  if (!sid || !note.managedIds.includes(sid)) return null;
  const station = stationById(data, sid);
  if (isManagerUnit(station)) return null;
  return sid === note.homeId ? "home" : "cover";
}

function topManagedStations(data, employeeId) {
  const managed = stationsManagedBy(data, employeeId);
  const ids = new Set(managed.map((station) => String(station.id)));
  const tops = managed.filter((station) => {
    const parent = stationParentId(station);
    return !parent || !ids.has(String(parent));
  });
  return tops.length ? tops : managed;
}

function scopeStationIds(data, employeeId) {
  const tops = topManagedStations(data, employeeId);
  const lead = tops.find((station) => isCompanyRootStation(station)) || tops[0];
  if (lead) return new Set(stationSubtreeIds(data?.stations || [], lead.id));
  const ids = new Set();
  tops.forEach((station) => {
    stationSubtreeIds(data?.stations || [], station.id).forEach((id) => ids.add(id));
  });
  return ids;
}

function peopleInStationScope(data, scope) {
  const seen = new Set();
  activeEmployees(data).forEach((item) => {
    const home = homeStationId(item, data);
    if (!home || !scope.has(home)) return;
    seen.add(String(item.id));
  });
  return seen.size;
}

function ancestorManagerId(data, station, selfId) {
  const byId = new Map((data?.stations || []).map((item) => [String(item.id), item]));
  let cursor = station;
  const seen = new Set();
  while (cursor) {
    const parentId = stationParentId(cursor);
    if (!parentId || seen.has(parentId)) break;
    seen.add(parentId);
    cursor = byId.get(String(parentId));
    if (!cursor) break;
    const managerId = String(cursor.managerId || "");
    if (managerId && managerId !== String(selfId || "")) return managerId;
  }
  const root = (data?.stations || []).find((item) => isCompanyRootStation(item));
  const rootManagerId = String(root?.managerId || "");
  if (rootManagerId && rootManagerId !== String(selfId || "")) return rootManagerId;
  return null;
}

/** People tree follows the branch tree: the station manager is the branch. */
export function workplaceReportsToId(employee, data) {
  if (!employee?.id) return null;
  const id = String(employee.id);
  const managed = stationsManagedBy(data, id);
  if (managed.length) {
    const managedIds = new Set(managed.map((station) => String(station.id)));
    const top = managed.find((station) => {
      const parent = stationParentId(station);
      return !parent || !managedIds.has(String(parent));
    }) || managed[0];
    return ancestorManagerId(data, top, id);
  }
  const home = stationById(data, homeStationId(employee, data));
  if (home) {
    const managerId = String(home.managerId || "");
    if (managerId && managerId !== id) return managerId;
    return ancestorManagerId(data, home, id);
  }
  const root = (data?.stations || []).find((item) => isCompanyRootStation(item));
  return ancestorManagerId(data, root, id);
}

function writeReportsTo(data, employee, manager) {
  if (!employee) return false;
  const next = manager?.id ? String(manager.id) : null;
  if (next && String(employee.id) === next) return false;
  const current = reportsToId(employee, data);
  if (String(current || "") === String(next || "")) return false;
  if (next && wouldCreateReportsCycle(data, employee.id, next)) return false;
  employee.profile = { ...(employee.profile || {}), directManagerId: next };
  const seat = seatOf(data, employee.id);
  const managerSeat = manager ? seatOf(data, manager.id) : null;
  if (seat) {
    seat.reportsToEmployeeId = next;
    seat.reportsToSeatId = managerSeat?.id || null;
    seat.reportsToName = manager?.name || "";
    seat.approverId = next || seat.approverId || null;
    seat.reportsToMissing = "";
  }
  return true;
}

function stripEmployeeFromForeignRotas(data, employeeId, homeStationId) {
  const id = String(employeeId || "");
  const home = String(homeStationId || "");
  if (!id) return false;
  let changed = false;
  for (const schedule of data.schedules || []) {
    if (home && String(schedule.stationId || "") === home) continue;
    for (const day of Object.values(schedule.assignments || {})) {
      if (!day || typeof day !== "object" || Array.isArray(day)) continue;
      for (const key of Object.keys(day)) {
        const ids = day[key];
        if (!Array.isArray(ids) || !ids.includes(id)) continue;
        day[key] = ids.filter((item) => item !== id);
        changed = true;
      }
    }
  }
  return changed;
}

function seatEmployeeOnStation(data, employee, stationId) {
  const sid = String(stationId || "");
  if (!employee || !sid) return false;
  let changed = false;
  if (String(employee.stationId || "") !== sid) {
    employee.stationId = sid;
    changed = true;
  }
  if (employee.profile && String(employee.profile.stationId || "") && String(employee.profile.stationId) !== sid) {
    employee.profile.stationId = sid;
    changed = true;
  }
  (data.orgSeats || []).forEach((seat) => {
    if (String(seat.employeeId) !== String(employee.id)) return;
    if (String(seat.stationId || "") === sid) return;
    seat.stationId = sid;
    changed = true;
  });
  if (stripEmployeeFromForeignRotas(data, employee.id, sid)) changed = true;
  return changed;
}

/**
 * رأس المنشأة sits on the company root — not a child branch they happen to have been seeded on.
 * The org card already shows NiroVera; the file and roster must match that workplace.
 */
export function seatCompanyHeadOnRoot(data) {
  if (!data) return false;
  const root = companyRootStation(data.stations);
  if (!root?.id) return false;
  const people = Array.isArray(data.employees) ? data.employees : [];
  const owner = people.find((item) => item.id === data.ownerId || item.role === "owner" || item.isOwner) || null;
  if (owner && !root.managerId) root.managerId = owner.id;
  const headId = String(root.managerId || owner?.id || "");
  const head = people.find((item) => String(item.id) === headId);
  if (!head) return false;
  return seatEmployeeOnStation(data, head, root.id);
}

/** Branch manager is the branch. People at that workplace report to them; child-branch managers report to the parent manager. */
export function applyWorkplaceManagerRule(data) {
  if (!data) return false;
  let changed = seatCompanyHeadOnRoot(data);
  const stations = data.stations || [];
  const people = activeEmployees(data);
  const byId = new Map(people.map((employee) => [String(employee.id), employee]));
  stations.forEach((station) => {
    const manager = byId.get(String(station.managerId || ""));
    if (!manager) return;
    const sid = String(station.id);
    people.forEach((employee) => {
      if (String(employee.id) === String(manager.id)) return;
      if (homeStationId(employee, data) !== sid) return;
      if (writeReportsTo(data, employee, manager)) changed = true;
    });
    stations.forEach((child) => {
      if (String(stationParentId(child) || "") !== sid) return;
      const childManager = byId.get(String(child.managerId || ""));
      if (childManager && writeReportsTo(data, childManager, manager)) changed = true;
    });
  });
  stations.forEach((station) => {
    if (isCompanyRootStation(station)) return;
    const manager = byId.get(String(station.managerId || ""));
    if (!manager) return;
    const parent = stations.find((item) => String(item.id) === String(stationParentId(station) || ""));
    const parentManager = parent ? byId.get(String(parent.managerId || "")) : null;
    if (parentManager && writeReportsTo(data, manager, parentManager)) changed = true;
  });
  return changed;
}

export function buildPeopleTree(data) {
  const owner = ownerOf(data);
  const ownerId = owner?.id ? String(owner.id) : "";
  const people = activeEmployees(data);
  const byId = new Map(people.map((employee) => [String(employee.id), employee]));

  const managerOf = (employee) => {
    const raw = workplaceReportsToId(employee, data);
    if (!raw || raw === String(employee.id) || !byId.has(raw)) return null;
    return raw;
  };

  const nodes = people.map((employee) => {
    const seat = seatOf(data, employee.id);
    const homeId = homeStationId(employee, data);
    const home = (data?.stations || []).find((station) => String(station.id) === String(homeId));
    const tops = topManagedStations(data, employee.id);
    const lead = tops.find((station) => isCompanyRootStation(station)) || tops[0] || home;
    const scope = lead
      ? new Set(stationSubtreeIds(data?.stations || [], lead.id))
      : scopeStationIds(data, employee.id);
    const managerId = managerOf(employee);
    const manager = managerId ? byId.get(managerId) : null;
    const managerHomeId = manager ? (seatOf(data, manager.id)?.stationId || manager.stationId || "") : "";
    const treeBranches = lead
      ? descendantStationIds(data?.stations || [], lead.id).length
      : 0;
    const scopePeople = peopleInStationScope(data, scope);
    return {
      id: String(employee.id),
      name: employee.name || "",
      job: seat?.title || employee.profile?.position || employee.position || "",
      branch: lead?.name || home?.name || "",
      stationId: lead?.id || home?.id || "",
      avatar: employee.profile?.avatarUrl || employee.avatarUrl || "",
      isOwner: String(employee.id) === ownerId || employee.role === "owner",
      isBranchHead: tops.length > 0,
      managerId,
      managerName: manager?.name || "",
      cross: Boolean(managerHomeId && homeId && String(managerHomeId) !== String(homeId)),
      treeBranches,
      scopePeople,
      children: [],
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const roots = [];
  nodes.forEach((node) => {
    const parent = node.managerId ? nodeById.get(node.managerId) : null;
    if (parent && parent !== node) parent.children.push(node);
    else if (ownerId && node.id !== ownerId && nodeById.get(ownerId)) {
      nodeById.get(ownerId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  if (!roots.length && nodes.length) roots.push(nodes[0]);

  const seen = new Set();
  const rollup = (node, depth = 0) => {
    if (!node || seen.has(node) || depth > 40) return 1;
    seen.add(node);
    node.depth = depth;
    node.tone = DEPTH_TONE[Math.min(depth, DEPTH_TONE.length - 1)];
    let total = 1;
    (node.children || []).forEach((child) => {
      total += rollup(child, depth + 1);
    });
    node.childCount = (node.children || []).length;
    node.treePeople = total;
    return total;
  };
  roots.forEach((node) => rollup(node, 0));
  return { roots, ownerId, total: people.length };
}

export function flattenPeopleTree(nodes, acc = [], seen = new Set()) {
  (nodes || []).forEach((node) => {
    if (!node?.id || seen.has(node.id)) return;
    seen.add(node.id);
    acc.push(node);
    flattenPeopleTree(node.children || [], acc, seen);
  });
  return acc;
}

export function pathToPerson(roots, personId) {
  const id = String(personId || "");
  const walk = (nodes, trail) => {
    for (const node of nodes || []) {
      const next = [...trail, node];
      if (String(node.id) === id) return next;
      const hit = walk(node.children || [], next);
      if (hit) return hit;
    }
    return null;
  };
  return walk(roots, []);
}

/** Flat teams: each manager once, with direct reports only — not a nested branch pyramid. */
export function teamsByManager(tree) {
  const people = flattenPeopleTree(tree?.roots);
  const byId = new Map(people.map((person) => [person.id, person]));
  const buckets = new Map();
  const ensure = (id, manager) => {
    const key = String(id || "_none");
    if (!buckets.has(key)) buckets.set(key, { id: key, manager: manager || null, items: [] });
    return buckets.get(key);
  };
  people.forEach((person) => {
    const mid = person.managerId || (person.isOwner ? "" : tree?.ownerId) || "";
    if (!mid || mid === person.id) {
      ensure(person.id, person);
      return;
    }
    ensure(mid, byId.get(mid) || { id: mid, name: "", job: "", branch: "" }).items.push(person);
  });
  return [...buckets.values()]
    .filter((team) => team.items.length)
    .sort((a, b) => {
      if (a.manager?.isOwner) return -1;
      if (b.manager?.isOwner) return 1;
      const byCount = (b.items.length || 0) - (a.items.length || 0);
      if (byCount) return byCount;
      return String(a.manager?.name || "").localeCompare(String(b.manager?.name || ""), "ar");
    });
}

/** Same haystack the people-tree search already uses: name + job + branch (+ English / nickname if present). */
export function peopleSearchHay(person) {
  return [
    person?.name,
    person?.nameEn,
    person?.englishName,
    person?.nickname,
    person?.job,
    person?.branch,
    person?.stationName,
  ].filter(Boolean).join(" ");
}

export function peopleQueryMatches(hay, query) {
  const q = normalizeArabicQuery(query);
  if (!q) return true;
  return normalizeArabicQuery(hay).includes(q);
}

export function filterPeopleHits(people, query, limit = 8) {
  const q = String(query || "").trim();
  if (!q) return [];
  return (people || []).filter((person) => peopleQueryMatches(peopleSearchHay(person), q)).slice(0, limit);
}
