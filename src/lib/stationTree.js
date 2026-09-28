/** Recursive workplace tree: the company is the main branch; other branches hang under it. */

export function isCompanyRootStation(station) {
  return Boolean(station?.isCompanyRoot);
}

/** Fixed HR unit: it belongs to no branch and is not a parent of field branches. */
export function isHrUnit(station) {
  if (!station || isCompanyRootStation(station)) return false;
  if (station.fixedUnit === "hr") return true;
  const code = String(station.code || "").trim().toUpperCase();
  if (code === "HR") return true;
  return /وحدة\s*الموارد\s*البشرية|موارد\s*بشر/.test(String(station.name || ""));
}

export function normalizeUnitKind(value) {
  return String(value || "").trim() === "manager" ? "manager" : "branch";
}

/** Company root is always the apex workplace — never a non-hire manager node. */
export function effectiveUnitKind(station) {
  if (isCompanyRootStation(station)) return "branch";
  return normalizeUnitKind(station?.unitKind);
}

/** Region-manager seat: in the tree, not a workplace in header scope. */
export function isManagerUnit(station) {
  return effectiveUnitKind(station) === "manager";
}

export function isWorkplaceStation(station) {
  if (!station) return false;
  return !isManagerUnit(station);
}

/** Manager seats are not workplaces: hire, transfer, and ops chat go to child branches only. */
export function stationAllowsHire(station) {
  return isWorkplaceStation(station);
}

/** Operational chat rooms are workplaces only — a manager node is not a station channel. */
export function stationAllowsOpsChat(station) {
  return isWorkplaceStation(station);
}

export function workplaceStations(stations) {
  return (stations || []).filter((station) => isWorkplaceStation(station));
}

/** A site hanging under another workplace. The header scope is the branch, not the site. */
export function isNestedWorkplace(station, stations) {
  if (!station || isCompanyRootStation(station) || !isWorkplaceStation(station) || isHrUnit(station)) return false;
  const parentId = stationParentId(station);
  if (!parentId) return false;
  const parent = (stations || []).find((item) => String(item.id) === String(parentId));
  if (!parent || isCompanyRootStation(parent) || isManagerUnit(parent) || isHrUnit(parent)) return false;
  return isWorkplaceStation(parent);
}

/** Walk up sites until the branch that owns them. */
export function nearestHeaderBranch(station, stations) {
  if (!station) return null;
  const byId = new Map((stations || []).map((item) => [String(item.id), item]));
  let cursor = station;
  const seen = new Set();
  while (cursor && isNestedWorkplace(cursor, stations)) {
    const id = String(cursor.id);
    if (seen.has(id)) break;
    seen.add(id);
    const parent = byId.get(String(stationParentId(cursor) || ""));
    if (!parent) break;
    cursor = parent;
  }
  return cursor && isWorkplaceStation(cursor) && !isHrUnit(cursor) ? cursor : null;
}

/**
 * Header chips and the scope menu. A site under a branch stays inside that branch
 * when the branch is already in the list.
 */
export function headerScopeBranches(candidates, tree) {
  const stations = tree || candidates || [];
  const list = (candidates || []).filter((station) => isWorkplaceStation(station) && !isHrUnit(station));
  const ids = new Set(list.map((station) => String(station.id)));
  return list.filter((station) => {
    if (!isNestedWorkplace(station, stations)) return true;
    const branch = nearestHeaderBranch(station, stations);
    return !branch || !ids.has(String(branch.id));
  });
}

/** Live workplaces on the escalation board. The fixed HR unit is not a branch card. */
export function escalationLiveStations(stations) {
  return workplaceStations(stations).filter((station) => station && !isHrUnit(station) && station.active !== false);
}

export function companyRootStation(stations) {
  return (stations || []).find((station) => isCompanyRootStation(station)) || null;
}

export function stationParentId(station) {
  const raw = station?.parentStationId ?? station?.parentBranchId ?? "";
  const id = String(raw || "").trim();
  return id || null;
}

export function wouldCreateStationCycle(stations, stationId, newParentId) {
  const id = String(stationId || "").trim();
  const parent = String(newParentId || "").trim();
  if (!id || !parent) return false;
  if (parent === id) return true;
  const byId = new Map((stations || []).map((station) => [String(station.id), station]));
  let cursor = byId.get(parent);
  const seen = new Set();
  while (cursor) {
    if (String(cursor.id) === id) return true;
    if (seen.has(cursor.id)) return true;
    seen.add(cursor.id);
    const next = stationParentId(cursor);
    cursor = next ? byId.get(String(next)) : undefined;
  }
  return false;
}

export function checkSetStationParentGate(stations, stationId, newParentId) {
  const id = String(stationId || "").trim();
  const parent = String(newParentId || "").trim() || null;
  if (!id) {
    return { ok: false, error: "STATION_REQUIRED", reason: "الفرع مطلوب.", reasonEn: "Branch is required." };
  }
  const current = (stations || []).find((station) => String(station.id) === id);
  if (current && isCompanyRootStation(current)) {
    return {
      ok: false,
      error: "COMPANY_ROOT",
      reason: "المنشأة هي الفرع الرئيسي ولا تتبع فرعاً آخر.",
      reasonEn: "The company is the main branch and cannot hang under another branch.",
    };
  }
  if (current && isHrUnit(current)) {
    return {
      ok: false,
      error: "FIXED_HR",
      reason: "وحدة الموارد البشرية ثابتة ولا تُنقل.",
      reasonEn: "The HR unit is fixed and cannot be moved.",
    };
  }
  if (!parent) return { ok: true, parentStationId: null };
  const parentStation = (stations || []).find((station) => String(station.id) === parent);
  if (parentStation && isHrUnit(parentStation)) {
    return {
      ok: false,
      error: "HR_NOT_PARENT",
      reason: "الفروع لا تتبع وحدة الموارد البشرية.",
      reasonEn: "Branches do not report to the HR unit.",
    };
  }
  if (!parentStation) {
    return { ok: false, error: "PARENT_NOT_FOUND", reason: "الفرع الأب غير موجود.", reasonEn: "Parent branch not found." };
  }
  if (wouldCreateStationCycle(stations, id, parent)) {
    return {
      ok: false,
      error: "CYCLE_FORBIDDEN",
      reason: "لا يمكن أن يتبع الفرع نفسه أو أحد أبنائه.",
      reasonEn: "A branch cannot report to itself or to one of its descendants.",
    };
  }
  return { ok: true, parentStationId: parent };
}

export function childStations(stations, parentId) {
  const pid = String(parentId || "").trim();
  return (stations || []).filter((station) => (stationParentId(station) || "") === pid);
}

export function rootStations(stations) {
  const ids = new Set((stations || []).map((station) => String(station.id)));
  return (stations || []).filter((station) => {
    const parent = stationParentId(station);
    return !parent || !ids.has(parent);
  });
}

export function descendantStationIds(stations, stationId) {
  const id = String(stationId || "").trim();
  if (!id) return [];
  const kids = new Map();
  (stations || []).forEach((station) => {
    const parent = stationParentId(station);
    if (!parent) return;
    const list = kids.get(parent) || [];
    list.push(String(station.id));
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

export function stationSubtreeIds(stations, stationId) {
  const id = String(stationId || "").trim();
  if (!id) return [];
  return [id, ...descendantStationIds(stations, id)];
}

export function expandStationScope(stations, ids) {
  const set = new Set();
  (ids || []).forEach((id) => {
    stationSubtreeIds(stations, id).forEach((item) => set.add(item));
  });
  return [...set];
}

/** Some records expose `id`, others `stationId` — treat both as the same station. */
export function stationRecordIds(station) {
  const ids = [];
  const a = String(station?.id || "").trim();
  const b = String(station?.stationId || "").trim();
  if (a) ids.push(a);
  if (b && b !== a) ids.push(b);
  return ids;
}

export function stationPrimaryId(station) {
  return stationRecordIds(station)[0] || "";
}

/** Expand selected stations: alias ids + full subtree under each seed. */
export function expandSelectedStationScope(stations, selectedIds) {
  const selected = new Set((selectedIds || []).map((id) => String(id || "").trim()).filter(Boolean));
  const seeds = new Set(selected);
  for (const station of stations || []) {
    const ids = stationRecordIds(station);
    if (ids.some((id) => selected.has(id))) ids.forEach((id) => seeds.add(id));
  }
  return expandStationScope(stations, [...seeds]);
}

export function employeeLinkedStationIds(employee) {
  const out = new Set();
  const home = String(employee?.stationId || employee?.station_id || "").trim();
  if (home) out.add(home);
  const rawManaged = employee?.managedStations ?? employee?.managedStationIds;
  const managed = Array.isArray(rawManaged)
    ? rawManaged
    : String(rawManaged || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean);
  managed.forEach((id) => {
    const sid = String(id || "").trim();
    if (sid) out.add(sid);
  });
  return out;
}

export function employeeInStationScope(employee, scopeIds) {
  const scope = scopeIds instanceof Set
    ? scopeIds
    : new Set((scopeIds || []).map((id) => String(id || "").trim()).filter(Boolean));
  for (const id of employeeLinkedStationIds(employee)) {
    if (scope.has(id)) return true;
  }
  return false;
}

/** Map an employee to one of the explicitly selected stations (for multi-station grouping). */
export function resolveEmployeeSelectedStation(employee, selectedIds, stations) {
  const selected = (selectedIds || []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!selected.length) return "";
  const links = employeeLinkedStationIds(employee);
  for (const sid of selected) {
    if (links.has(sid)) return sid;
  }
  for (const sid of selected) {
    const under = new Set(expandSelectedStationScope(stations, [sid]).map(String));
    for (const link of links) {
      if (under.has(link)) return sid;
    }
  }
  return "";
}

export function allowedStationParents(stations, stationId) {
  const blocked = new Set([String(stationId || ""), ...descendantStationIds(stations, stationId)]);
  return (stations || []).filter((station) => station?.id && !blocked.has(String(station.id)) && !isHrUnit(station));
}

export function userManagesStation(user, data, stationId) {
  if (!user || !stationId) return false;
  const actorIds = new Set([
    String(user.id || "").trim(),
    String(user.employeeId || "").trim(),
  ].filter(Boolean));
  if (!actorIds.size) return false;
  const station = (data?.stations || []).find((item) => String(item.id) === String(stationId));
  if (station && actorIds.has(String(station.managerId || ""))) return true;
  return (data?.orgSeats || []).some((seat) =>
    actorIds.has(String(seat.employeeId || ""))
    && String(seat.stationId) === String(stationId)
    && isTreeManagerTitle(seat.title)
  );
}

export function hangOrphanStationsUnderCompany(stations) {
  const list = stations || [];
  const flagged = list.filter((station) => isCompanyRootStation(station));
  const root = flagged[0] || null;
  if (!root) return list;
  flagged.slice(1).forEach((station) => {
    station.isCompanyRoot = false;
  });
  root.isCompanyRoot = true;
  root.parentStationId = null;
  const ids = new Set(list.map((station) => String(station.id)));
  list.forEach((station) => {
    if (String(station.id) === String(root.id)) return;
    const parent = stationParentId(station);
    if (!parent || parent === String(station.id) || !ids.has(parent)) {
      station.parentStationId = root.id;
    }
  });
  return list;
}

export function isTreeManagerTitle(title) {
  const text = String(title || "");
  return text.includes("مدير الفرع")
    || text.includes("مدير المنطقة")
    || text.includes("مدير القطاع")
    || text.includes("مدير الموقع")
    || /branch manager|area manager|region manager|site manager/i.test(text);
}

/** Extra coverage cannot repeat the home branch or anything already under it. */
export function stripDescendantCoverage(managedStations, stations, homeId) {
  const home = String(homeId || "").trim();
  const blocked = new Set(home ? stationSubtreeIds(stations, home) : []);
  const list = Array.isArray(managedStations)
    ? managedStations
    : String(managedStations || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean);
  return [...new Set(list.map((id) => String(id || "").trim()).filter(Boolean))]
    .filter((id) => !blocked.has(id));
}

export function extraCoverageStationIds(user, data) {
  return stripDescendantCoverage(
    user?.managedStations ?? user?.managedStationIds,
    data?.stations || [],
    user?.stationId,
  );
}

export function applyExtraCoverageStrip(data) {
  (data?.employees || []).forEach((employee) => {
    if (!employee || typeof employee !== "object") return;
    employee.managedStations = stripDescendantCoverage(
      employee.managedStations,
      data?.stations || [],
      employee.stationId,
    );
  });
  return data;
}

function scopePill(station, stations, kind) {
  if (!station?.id) return null;
  const descendantCount = descendantStationIds(stations, station.id).length;
  const name = String(station.name || "").trim();
  return {
    id: String(station.id),
    name,
    kind,
    descendantCount,
    label: descendantCount > 0 && name ? `${name} · ${descendantCount}` : name,
  };
}

/** Pills for the org strip: direct children by name, then lateral extras. */
export function scopeStationsForDisplay(user, data) {
  const stations = data?.stations || [];
  const byId = new Map(stations.map((station) => [String(station.id), station]));
  const homeId = String(user?.stationId || "").trim();
  const home = homeId ? byId.get(homeId) : null;
  const homeIsCompanyRoot = Boolean(home && isCompanyRootStation(home));
  const managesHome = Boolean(homeId && (userManagesStation(user, data, homeId) || user?.role === "station_manager"));
  const inherited = [];
  if (managesHome && home && !homeIsCompanyRoot) {
    childStations(stations, homeId).forEach((child) => {
      const pill = scopePill(child, stations, "inherited");
      if (pill) inherited.push(pill);
    });
  }
  const extras = extraCoverageStationIds(user, data).map((id) => scopePill(byId.get(id) || { id, name: id }, stations, "extra")).filter(Boolean);
  return {
    homeId,
    homeName: home?.name || "",
    homeIsCompanyRoot,
    managesHome,
    inherited,
    extras,
    ids: scopedStationIdsForUser(user, data),
  };
}

export function userCoversStation(user, data, stationId) {
  if (!stationId) return true;
  return scopedStationIdsForUser(user, data).some((id) => String(id) === String(stationId));
}

/** Header scope: a workplace includes its child workplaces. A manager/region seat stays exact. */
export function stationInHeaderScope(rowStationId, scopeId, stations) {
  const scope = String(scopeId || "").trim();
  if (!scope || scope === "all") return true;
  const row = String(rowStationId ?? "").trim();
  if (!row) return false;
  if (row === scope) return true;
  const list = Array.isArray(stations) ? stations : [];
  if (!list.length) return false;
  const node = list.find((item) => String(item.id) === scope);
  if (effectiveUnitKind(node) === "manager") return false;
  return stationSubtreeIds(list, scope).includes(row);
}

/** Home stays the nearest node; managers and extra coverage inherit every descendant. */
export function scopedStationIdsForUser(user, data) {
  const stations = data?.stations || [];
  if (!user) return [];
  const home = String(user.stationId || "").trim();
  const extras = extraCoverageStationIds(user, data);
  if (user.role === "pgm") return expandStationScope(stations, extras);
  const seeds = new Set(extras);
  if (home && (userManagesStation(user, data, home) || user.role === "station_manager")) {
    seeds.add(home);
    return expandStationScope(stations, [...seeds]);
  }
  if (seeds.size) {
    const expanded = expandStationScope(stations, [...seeds]);
    if (home && !expanded.includes(home)) expanded.push(home);
    return expanded;
  }
  return home ? [home] : [];
}
