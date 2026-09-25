import { updateCompany } from "@/lib/store";
import { sortComplaintChainByTree } from "@/lib/escalation";
import {
  branchEscalationMap,
  deriveAutoBranchEscalationChain,
  deriveBranchEscalationChain,
  escalationStationsForEmployee,
  serializeBranchEscalationMap,
  stripJobTitleFromData,
} from "@/lib/orgDerivations";
import { rankFromScore, scorePermissions } from "@/lib/smartPositions";
import { isManagerUnit, normalizeUnitKind } from "@/lib/stationTree";
import { assignEmployeeNumber } from "@/lib/employeeNumber";

export const orgTreeNodes = (data) => Array.isArray(data?.orgTree) ? data.orgTree : [];
export const nodeAccess = (data, refId) => data?.smartPositions?.find((item) => item.employeeId === refId)?.permissions || {};

function resolvedChainIds(stationId, data) {
  const existing = branchEscalationMap(data)[String(stationId)];
  if (Array.isArray(existing)) return existing.map(String);
  return deriveAutoBranchEscalationChain(stationId, data).map((step) => String(step.employeeId));
}

function placeOnChain(ids, employeeId, level) {
  const next = ids.filter((id) => id !== employeeId);
  const idx = Number(level) > 0 ? Math.min(Math.max(0, Number(level) - 1), next.length) : next.length;
  return [...next.slice(0, idx), employeeId, ...next.slice(idx)];
}

/** Add or remove a person on one branch's escalation ladder. Other branches stay unchanged. */
export function toggleBranchEscalationMember(companyId, stationId, employeeId) {
  if (!companyId || !stationId || !employeeId) return;
  updateCompany(companyId, (data) => {
    const sid = String(stationId);
    const eid = String(employeeId);
    const chains = { ...branchEscalationMap(data) };
    const base = resolvedChainIds(sid, data);
    chains[sid] = base.includes(eid) ? base.filter((id) => id !== eid) : [...base, eid];
    data.branchEscalationChains = serializeBranchEscalationMap(chains);
  });
}

/**
 * Set which branches this person holds, and optionally their rank number on those branches.
 * Example: escalation #2 covering two stations.
 */
export function setEmployeeEscalationCoverage(companyId, employeeId, stationIds, level) {
  if (!companyId || !employeeId) return;
  updateCompany(companyId, (data) => {
    const eid = String(employeeId);
    const wanted = new Set((stationIds || []).map(String).filter(Boolean));
    const previous = new Set(escalationStationsForEmployee(eid, data));
    const touch = new Set([...previous, ...wanted]);
    const chains = { ...branchEscalationMap(data) };
    for (const sid of touch) {
      const base = resolvedChainIds(sid, data);
      chains[sid] = wanted.has(sid) ? placeOnChain(base, eid, level) : base.filter((id) => id !== eid);
    }
    data.branchEscalationChains = serializeBranchEscalationMap(chains);
    if (wanted.size > 0) {
      const position = (data.smartPositions || []).find((item) => item.employeeId === eid);
      if (position) position.permissions = { ...(position.permissions || {}), complaints: "manage" };
    }
  });
}

/** Replace one branch's escalation ladder with an ordered employee list. */
export function setBranchEscalationChain(companyId, stationId, employeeIds) {
  if (!companyId || !stationId) return;
  updateCompany(companyId, (data) => {
    const sid = String(stationId);
    const chains = { ...branchEscalationMap(data) };
    const cleaned = [];
    const seen = new Set();
    for (const raw of employeeIds || []) {
      const eid = String(raw || "").trim();
      if (!eid || seen.has(eid)) continue;
      seen.add(eid);
      cleaned.push(eid);
    }
    chains[sid] = cleaned;
    data.branchEscalationChains = serializeBranchEscalationMap(chains);
    for (const eid of cleaned) {
      const position = (data.smartPositions || []).find((item) => String(item.employeeId) === eid);
      if (position) position.permissions = { ...(position.permissions || {}), complaints: "manage" };
    }
  });
}

export function escalationLevelOnStation(employeeId, stationId, data) {
  const idx = deriveBranchEscalationChain(stationId, data)
    .findIndex((step) => String(step.employeeId) === String(employeeId));
  return idx >= 0 ? idx + 1 : 0;
}

export function toggleComplaintEscalationMember(companyId, employeeId) {
  updateCompany(companyId, (data) => {
    const current = data.complaintEscalationChain || [];
    const adding = !current.includes(employeeId);
    const next = adding ? [...current, employeeId] : current.filter((id) => id !== employeeId);
    data.complaintEscalationChain = sortComplaintChainByTree(next, data);
    if (adding) {
      const position = (data.smartPositions || []).find((item) => item.employeeId === employeeId);
      if (position) position.permissions = { ...(position.permissions || {}), complaints: "manage" };
    }
    [...(data.anonymousReports || []), ...(data.publicReports || [])].filter((report) => report.status === "open").forEach((report) => { report.escalationLevel = Math.min(report.escalationLevel || 0, Math.max(0, data.complaintEscalationChain.length - 1)); });
  });
}

const renumber = (nodes, parentId) => nodes.filter((node) => (node.parentId || null) === (parentId || null)).sort((a, b) => a.order - b.order).forEach((node, index) => { node.order = index; });

const treeStationForNode = (nodes, node) => {
  let parent = nodes.find((item) => item.id === node.parentId);
  while (parent && parent.type !== "station") parent = nodes.find((item) => item.id === parent.parentId);
  return parent?.refId || null;
};

export function stationIdForTreeEmployee(data, employeeId) {
  const nodes = data?.orgTree || [];
  const node = nodes.find((item) => item.type === "employee" && item.refId === employeeId);
  return node ? treeStationForNode(nodes, node) : null;
}

export function treeCommunicationTargets(data, employeeId) {
  const nodes = data?.orgTree || [];
  const employees = data?.employees || [];
  const positions = data?.smartPositions || [];
  const targets = [];
  let node = nodes.find((item) => item.type === "employee" && item.refId === employeeId);
  while (node?.parentId) {
    node = nodes.find((item) => item.id === node.parentId);
    if (node?.type !== "employee") continue;
    const permissions = positions.find((item) => item.employeeId === node.refId)?.permissions || {};
    if (permissions.hr === "manage" || permissions.employees === "manage") {
      const person = employees.find((item) => item.id === node.refId);
      if (person) targets.push({ id: person.id, name: person.name, title: node.title || "", kind: "tree" });
    }
  }
  return targets;
}

/** Always-available company channel + optional tree managers. Tree alone must never block send. */
export function adminCommunicationTargets(data, employeeId, { ar = true } = {}) {
  const company = {
    id: "channel:company_hr",
    name: ar ? "موارد بشرية الشركة" : "Company HR",
    title: ar ? "مسار رسمي مضمون" : "Guaranteed official channel",
    kind: "company",
    always: true,
  };
  const tree = treeCommunicationTargets(data, employeeId);
  return [company, ...tree];
}

/** Resolve who should be notified for an admin communication target. */
export function resolveAdminCommunicationRecipients(data, targetId, employeeId) {
  const employees = data?.employees || [];
  const positions = data?.smartPositions || [];
  if (!targetId || String(targetId).startsWith("channel:")) {
    const ids = new Set();
    if (data?.ownerId) ids.add(String(data.ownerId));
    for (const e of employees) {
      if (["director", "ops_manager", "pgm"].includes(e.role)) ids.add(String(e.id));
      const perms = positions.find((p) => p.employeeId === e.id)?.permissions || {};
      if (perms.hr === "manage" || perms.employees === "manage") ids.add(String(e.id));
    }
    const emp = employees.find((e) => e.id === employeeId);
    if (emp?.stationId) {
      for (const e of employees) {
        if (String(e.stationId) !== String(emp.stationId)) continue;
        if (["station_manager"].includes(e.role)) ids.add(String(e.id));
      }
    }
    ids.delete(String(employeeId));
    return [...ids];
  }
  return [String(targetId)];
}

function findStationNode(nodes, stationNodeIdOrRef) {
  const key = String(stationNodeIdOrRef || "");
  return (nodes || []).find((node) =>
    node.type === "station" && (node.id === key || String(node.refId) === key),
  ) || null;
}

/**
 * Place employee A under person B (reporting line), or under a branch node.
 * Tree parent = manager / responsible person. Cycle-safe.
 */
export function setEmployeeReportsTo(companyId, employeeId, managerNodeId) {
  const result = { ok: false, error: "UNKNOWN", reason: "تعذّر ضبط التبعية.", reasonEn: "Could not set reporting line." };
  updateCompany(companyId, (data) => {
    if (!Array.isArray(data.orgTree)) data.orgTree = [];
    const nodes = data.orgTree;
    const employee = (data.employees || []).find((e) => e.id === employeeId);
    if (!employee) {
      result.error = "EMPLOYEE_NOT_FOUND";
      result.reason = "الموظف غير موجود.";
      result.reasonEn = "Employee not found.";
      return;
    }
    let moving = nodes.find((n) => n.type === "employee" && n.refId === employeeId);
    if (!moving) {
      moving = {
        id: `org_${employeeId}`,
        type: "employee",
        refId: employeeId,
        title: employee.profile?.position || employee.position || "",
        parentId: null,
        order: nodes.filter((n) => !n.parentId).length,
      };
      nodes.push(moving);
    }
    const target = nodes.find((n) => n.id === managerNodeId);
    if (!target) {
      result.error = "TARGET_NOT_FOUND";
      result.reason = "الشخص أو الفرع الهدف غير موجود.";
      result.reasonEn = "Target person or branch not found.";
      return;
    }
    if (target.id === moving.id) {
      result.error = "SELF";
      result.reason = "لا يمكن جعل الشخص تحت نفسه.";
      result.reasonEn = "A person cannot report to themselves.";
      return;
    }
    // Prevent cycles: target must not be under moving.
    let cursor = target;
    while (cursor?.parentId) {
      if (cursor.parentId === moving.id) {
        result.error = "CYCLE";
        result.reason = "هذا يجعل حلقة تبعية — اختر شخصًا أعلى أو فرعًا.";
        result.reasonEn = "That would create a reporting loop — pick a higher person or a branch.";
        return;
      }
      cursor = nodes.find((n) => n.id === cursor.parentId);
    }
    if (moving.parentId === target.id) {
      result.ok = true;
      result.error = "SAME_PARENT";
      result.reason = "التبعية مضبوطة كذلك بالفعل.";
      result.reasonEn = "Already reports to that node.";
      return;
    }
    const oldParent = moving.parentId || null;
    moving.parentId = target.id;
    moving.order = nodes.filter((n) => n.id !== moving.id && n.parentId === target.id).length;
    renumber(nodes, oldParent);
    renumber(nodes, target.id);
    syncEmployeeStationsFromTree(data);
    const managerEmp = target.type === "employee"
      ? (data.employees || []).find((e) => e.id === target.refId)
      : null;
    const station = target.type === "station"
      ? (data.stations || []).find((s) => s.id === target.refId)
      : null;
    result.ok = true;
    result.parentType = target.type;
    result.parentName = managerEmp?.name || station?.name || target.title || null;
  });
  return result;
}

/**
 * Move an employee under a branch (station node). Returns { ok, ... } — never silent.
 */
export function assignEmployeeToOrgStation(companyId, employeeId, stationNodeId) {
  const result = { ok: false, error: "UNKNOWN", reason: "تعذّر النقل.", reasonEn: "Transfer failed." };
  updateCompany(companyId, (data) => {
    if (!Array.isArray(data.orgTree)) data.orgTree = [];
    const nodes = data.orgTree;
    let station = findStationNode(nodes, stationNodeId);
    const employee = (data.employees || []).find((item) => item.id === employeeId);
    if (!employee) {
      result.error = "EMPLOYEE_NOT_FOUND";
      result.reason = "الموظف غير موجود.";
      result.reasonEn = "Employee not found.";
      return;
    }
    if (!station) {
      const st = (data.stations || []).find((s) =>
        String(s.id) === String(stationNodeId) || String(s.stationId) === String(stationNodeId),
      );
      if (!st) {
        result.error = "STATION_NOT_FOUND";
        result.reason = "الفرع غير موجود في الشجرة.";
        result.reasonEn = "Branch not found in the tree.";
        return;
      }
      station = {
        id: `org_station_${st.id}`,
        type: "station",
        refId: st.id,
        title: st.name || "",
        parentId: null,
        order: nodes.filter((n) => !n.parentId).length,
      };
      nodes.push(station);
    }
    const entity = (data.stations || []).find((item) => String(item.id) === String(station.refId));
    const alreadyHome = String(employee.stationId) === String(station.refId);
    if (isManagerUnit(entity) && !alreadyHome) {
      result.error = "ADMIN_NO_HIRE";
      result.reason = "المدير ليس مكان توظيف. حوّله إلى فرع ثم وظّف عليه.";
      result.reasonEn = "A manager is not a hire workplace. Convert it to a branch, then hire there.";
      return;
    }
    assignInside(data, employee, station, result);
  });
  return result;
}

function assignInside(data, employee, station, result) {
  const nodes = data.orgTree || [];
  let node = nodes.find((item) => item.type === "employee" && item.refId === employee.id);
  const oldParent = node?.parentId || null;
  if (!node) {
    const position = (data.smartPositions || []).find((item) => item.employeeId === employee.id);
    node = {
      id: `org_${employee.id}`,
      type: "employee",
      refId: employee.id,
      title: position?.title || employee.profile?.position || employee.position || "",
      parentId: station.id,
      order: 0,
    };
    nodes.push(node);
  }
  if (node.parentId === station.id) {
    result.ok = true;
    result.error = "SAME_STATION";
    result.reason = "الموظف على هذا الفرع بالفعل.";
    result.reasonEn = "Employee is already on this branch.";
    result.stationId = station.refId;
    result.stationName = (data.stations || []).find((s) => s.id === station.refId)?.name || null;
    return;
  }
  node.parentId = station.id;
  node.order = nodes.filter((item) => item.id !== node.id && item.parentId === station.id).length;
  renumber(nodes, oldParent);
  renumber(nodes, station.id);
  employee.stationId = station.refId;
  syncEmployeeStationsFromTree(data);
  result.ok = true;
  result.stationId = station.refId;
  result.stationName = (data.stations || []).find((s) => s.id === station.refId)?.name || null;
  result.employeeId = employee.id;
}

export function unassignEmployeeFromOrgTree(companyId, nodeId) {
  updateCompany(companyId, (data) => {
    const nodes = data.orgTree || [];
    const node = nodes.find((item) => item.id === nodeId && item.type === "employee");
    if (!node || nodes.some((item) => item.parentId === node.id)) return;
    const employee = (data.employees || []).find((item) => item.id === node.refId);
    const oldParent = node.parentId || null;
    node.parentId = null;
    node.order = nodes.filter((item) => item.id !== node.id && !item.parentId).length;
    if (employee) employee.stationId = null;
    renumber(nodes, oldParent);
    renumber(nodes, null);
  });
}

export function positionManagerInOrgTree(companyId, employeeId, stationIds) {
  updateCompany(companyId, (data) => {
    const nodes = data.orgTree || [];
    const manager = nodes.find((node) => node.type === "employee" && node.refId === employeeId);
    const selectedIds = new Set((stationIds || []).filter(Boolean));
    const stations = nodes.filter((node) => node.type === "station" && selectedIds.has(node.refId));
    if (!manager || !stations.length) return;
    const oldParent = manager.parentId || null;
    const affected = new Set([oldParent, manager.id]);
    const isBelowManager = (node) => {
      let cursor = node;
      while (cursor?.parentId) {
        if (cursor.parentId === manager.id) return true;
        cursor = nodes.find((item) => item.id === cursor.parentId);
      }
      return false;
    };
    nodes.filter((node) => node.type === "station" && isBelowManager(node)).forEach((node) => {
      affected.add(node.parentId || null);
      node.parentId = oldParent;
    });
    if (stations.length === 1) {
      const station = stations[0];
      affected.add(station.id);
      manager.parentId = station.id;
      manager.order = nodes.filter((node) => node.parentId === station.id && node.id !== manager.id).length;
    } else {
      const parents = stations.map((station) => station.parentId || null);
      const commonParent = parents.every((parent) => parent === parents[0]) && !stations.some((station) => station.id === parents[0]) ? parents[0] : null;
      manager.parentId = commonParent;
      manager.order = nodes.filter((node) => (node.parentId || null) === commonParent && node.id !== manager.id).length;
      affected.add(commonParent);
      stations.forEach((station, index) => {
        affected.add(station.parentId || null);
        station.parentId = manager.id;
        station.order = index;
      });
    }
    affected.add(manager.parentId || null);
    affected.forEach((parentId) => renumber(nodes, parentId));
    syncEmployeeStationsFromTree(data);
  });
}

const syncEmployeeStationsFromTree = (data) => {
  const nodes = data.orgTree || [];
  nodes.filter((node) => node.type === "employee").forEach((node) => {
    const stationId = treeStationForNode(nodes, node);
    if (!stationId) return;
    const employee = (data.employees || []).find((item) => item.id === node.refId || item.employeeId === node.refId);
    if (employee) employee.stationId = stationId;
  });
};

export function initializeOrgTree(companyId, data) {
  const existing = Array.isArray(data?.orgTree)
    ? data.orgTree
    : (data.smartPositions || []).map((position, order) => ({ id: `org_${position.employeeId}`, type: "employee", refId: position.employeeId, title: position.title || "", parentId: null, order }));
  const stationIds = new Set(existing.filter((node) => node.type === "station").map((node) => node.refId));
  const missingStations = (data.stations || []).filter((station) => !stationIds.has(station.id));
  const stationMismatch = existing.filter((node) => node.type === "employee").some((node) => {
    const stationId = treeStationForNode(existing, node);
    const employee = (data.employees || []).find((item) => item.id === node.refId);
    return stationId && employee?.stationId && String(employee.stationId) !== String(stationId);
  });

  // Only add missing station nodes — never rewrite the tree after a transfer.
  if (missingStations.length) {
    updateCompany(companyId, (draft) => {
      const base = Array.isArray(draft.orgTree) ? draft.orgTree : existing;
      draft.orgTree = [
        ...base,
        ...missingStations.map((station, index) => ({
          id: `org_station_${station.id}`,
          type: "station",
          refId: station.id,
          title: station.name || station.location || "",
          parentId: null,
          order: base.length + index,
        })),
      ];
    });
    return;
  }

  // Tree wins: repair employee.stationId from hierarchy without moving nodes.
  if (stationMismatch) {
    updateCompany(companyId, (draft) => {
      syncEmployeeStationsFromTree(draft);
    });
  }
}

export function removeCompanyJobTitle(companyId, titleKey) {
  let cleared = 0;
  updateCompany(companyId, (data) => {
    cleared = stripJobTitleFromData(data, titleKey);
  });
  return cleared;
}

export function saveOrgNode(companyId, node, permissions = {}, templateId = "") {
  updateCompany(companyId, (data) => {
    data.orgTree = data.orgTree || [];
    const index = data.orgTree.findIndex((item) => item.id === node.id);
    const current = data.orgTree[index];
    const requestedParent = data.orgTree.find((item) => item.id === node.parentId);
    let cursor = requestedParent;
    while (current && cursor?.parentId) {
      if (cursor.parentId === current.id) {
        const previousParent = requestedParent.parentId || null;
        requestedParent.parentId = current.parentId || null;
        requestedParent.order = current.order;
        renumber(data.orgTree, previousParent);
        break;
      }
      cursor = data.orgTree.find((item) => item.id === cursor.parentId);
    }
    if (index >= 0) data.orgTree[index] = node; else data.orgTree.push(node);
    renumber(data.orgTree, node.parentId);
    if (node.type === "employee") {
      data.smartPositions = data.smartPositions || [];
      const savedIndex = data.smartPositions.findIndex((item) => item.employeeId === node.refId);
      const score = scorePermissions(permissions);
      const record = { employeeId: node.refId, title: node.title, titleManual: true, permissions, templateId, score, rank: rankFromScore(score), updatedAt: new Date().toISOString() };
      if (savedIndex >= 0) data.smartPositions[savedIndex] = { ...data.smartPositions[savedIndex], ...record }; else data.smartPositions.push(record);
      // Keep employee file in sync — title in tree = position on the profile.
      const emp = (data.employees || []).find((e) => e.id === node.refId);
      if (emp) {
        emp.profile = { ...(emp.profile || {}), position: node.title || "" };
        emp.position = node.title || "";
      }
    }
    syncEmployeeStationsFromTree(data);
  });
}

export function createOrgRecord(companyId, record, permissions = {}) {
  let createdStationId = null;
  updateCompany(companyId, (data) => {
    if (record.type !== "station" && record.stationId) {
      const home = (data.stations || []).find((item) => String(item.id) === String(record.stationId));
      if (isManagerUnit(home)) return;
    }
    data.orgTree = data.orgTree || [];
    const parentId = record.parentId || null;
    const order = data.orgTree.filter((node) => (node.parentId || null) === parentId).length;
    if (record.type === "station") {
      const id = `st_${Math.random().toString(36).slice(2, 9)}`;
      createdStationId = id;
      const name = String(record.name || "").trim();
      const location = String(record.location || "").trim();
      const stationType = String(record.stationType || "").trim();
      data.stations.push({
        id,
        name,
        location: location || name,
        type: stationType || "branch",
        unitKind: normalizeUnitKind(record.unitKind),
        status: "active",
        managerId: record.managerId || null,
        parentStationId: record.parentStationId || null,
        isCompanyRoot: Boolean(record.isCompanyRoot),
        lat: record.lat ?? null,
        lng: record.lng ?? null,
        radiusMeters: record.radiusMeters ?? 200,
        createdAt: new Date().toISOString(),
      });
      const parentStation = record.parentStationId
        ? data.orgTree.find((item) => item.type === "station" && String(item.refId) === String(record.parentStationId))
        : null;
      const treeParent = parentStation?.id || parentId;
      const treeOrder = data.orgTree.filter((node) => (node.parentId || null) === (treeParent || null)).length;
      data.orgTree.push({ id: `org_station_${id}`, type: "station", refId: id, title: name, parentId: treeParent, order: treeOrder });
      return;
    }
    const id = `emp_${Math.random().toString(36).slice(2, 9)}`;
    const jobTitle = String(record.title || "").trim();
    data.employees.push({
      id,
      name: record.name.trim(),
      email: record.email,
      role: "employee",
      stationId: record.stationId || null,
      phone: "",
      anonymousId: `ANON-${Math.floor(Math.random() * 1e8).toString(16).toUpperCase().padStart(8, "0")}`,
      managedStations: [],
      position: jobTitle,
      profile: jobTitle ? { position: jobTitle } : {},
      createdAt: new Date().toISOString(),
    });
    assignEmployeeNumber(data, data.employees[data.employees.length - 1], {});
    data.orgTree.push({ id: `org_${id}`, type: "employee", refId: id, title: jobTitle, parentId, order });
    const score = scorePermissions(permissions);
    data.smartPositions = data.smartPositions || [];
    data.smartPositions.push({
      employeeId: id,
      title: jobTitle,
      titleManual: true,
      permissions,
      templateId: record.templateId || "",
      score,
      rank: rankFromScore(score),
      updatedAt: new Date().toISOString(),
    });
    syncEmployeeStationsFromTree(data);
  });
  return createdStationId;
}

export function saveOrgStationName(companyId, stationId, name) {
  updateCompany(companyId, (data) => {
    const station = (data.stations || []).find((item) => (item.id === stationId || item.stationId === stationId));
    if (station && name) {
      station.name = name;
      const node = (data.orgTree || []).find((item) => item.type === "station" && String(item.refId) === String(station.id || station.stationId));
      if (node) node.title = name;
    }
  });
}

export function saveOrgStationLocation(companyId, stationId, location) {
  updateCompany(companyId, (data) => {
    const station = (data.stations || []).find((item) => item.id === stationId);
    if (station) Object.assign(station, location);
  });
}

export function saveOrgNodeVisualPosition(companyId, nodeId, position) {
  updateCompany(companyId, (data) => {
    data.orgVisualPositions = { ...(data.orgVisualPositions || {}), [nodeId]: position };
  });
}

export function moveOrgNode(companyId, nodeId, targetId, mode) {
  updateCompany(companyId, (data) => {
    const nodes = data.orgTree || [];
    const moving = nodes.find((node) => node.id === nodeId);
    const target = nodes.find((node) => node.id === targetId);
    if (!moving || !target || moving.id === target.id) return;
    const oldParent = moving.parentId || null;
    let cursor = target;
    let targetIsDescendant = false;
    while (cursor?.parentId) {
      if (cursor.parentId === moving.id) { targetIsDescendant = true; break; }
      cursor = nodes.find((node) => node.id === cursor.parentId);
    }
    if (targetIsDescendant) {
      if (mode !== "below" && mode !== "inside") return;
      const targetOldParent = target.parentId || null;
      target.parentId = oldParent;
      target.order = moving.order;
      renumber(nodes, targetOldParent);
      renumber(nodes, oldParent);
    }
    if (mode === "above") {
      const targetParent = target.parentId || null;
      moving.parentId = targetParent;
      moving.order = target.order;
      target.parentId = moving.id;
      target.order = nodes.filter((node) => node.id !== target.id && node.parentId === moving.id).length;
      renumber(nodes, oldParent);
      renumber(nodes, targetParent);
      renumber(nodes, moving.id);
      syncEmployeeStationsFromTree(data);
      return;
    }
    const newParent = mode === "below" || mode === "inside" ? target.id : target.parentId || null;
    moving.parentId = newParent;
    const siblings = nodes.filter((node) => node.id !== moving.id && (node.parentId || null) === newParent).sort((a, b) => a.order - b.order);
    const targetIndex = siblings.findIndex((node) => node.id === target.id);
    moving.order = mode === "below" || mode === "inside" ? siblings.length : Math.max(0, targetIndex + (mode === "right" ? 1 : 0));
    siblings.splice(moving.order, 0, moving);
    siblings.forEach((node, index) => { node.order = index; });
    renumber(nodes, oldParent);
    syncEmployeeStationsFromTree(data);
  });
}

export function deleteOrgNode(companyId, nodeId) {
  updateCompany(companyId, (data) => {
    const nodes = data.orgTree || [];
    const removed = nodes.find((node) => node.id === nodeId);
    if (!removed) return;
    nodes.filter((node) => node.parentId === nodeId).forEach((node) => { node.parentId = removed.parentId || null; });
    data.orgTree = nodes.filter((node) => node.id !== nodeId);
    renumber(data.orgTree, removed.parentId);
    syncEmployeeStationsFromTree(data);
    if (removed.type === "employee") data.complaintEscalationChain = (data.complaintEscalationChain || []).filter((id) => id !== removed.refId);
  });
}
