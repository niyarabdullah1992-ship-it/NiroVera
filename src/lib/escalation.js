// Shared escalation-chain helpers, used by both anonymous and public complaints.
// Each branch has its own ladder from the org tree (branch manager → parents → apex).
// Falls back to company HR tiers when the tree has no path for that branch.
import { groupLevelsByOrder, levelName } from "./hrLevels";
import { deriveBranchEscalationChain } from "./orgDerivations";
import { userCoversStation } from "./stationTree";

const escalationGroups = (data) => groupLevelsByOrder(data?.hrLevels || []).filter((group) => group.manager?.active !== false);

export function sortComplaintChainByTree(ids, data) {
  const nodes = data?.orgTree || [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const employeeNode = new Map(nodes.filter((node) => node.type === "employee").map((node) => [node.refId, node]));
  const depth = (employeeId) => {
    let node = employeeNode.get(employeeId);
    let value = 0;
    const visited = new Set();
    while (node?.parentId && !visited.has(node.id)) { visited.add(node.id); node = byId.get(node.parentId); value += 1; }
    return value;
  };
  return [...ids].sort((a, b) => depth(b) - depth(a) || ids.indexOf(a) - ids.indexOf(b));
}

const manualChain = (data) => sortComplaintChainByTree(data?.complaintEscalationChain || [], data).map((id) => {
  const node = data.orgTree?.find((item) => item.type === "employee" && item.refId === id);
  const access = data.smartPositions?.find((item) => item.employeeId === id);
  return node && access?.permissions?.complaints === "manage" ? data.employees?.find((employee) => employee.id === id) : null;
}).filter(Boolean);

export const escalationStageCount = (data, stationId) => {
  const branch = deriveBranchEscalationChain(stationId, data);
  if (branch.length) return branch.length;
  return escalationGroups(data).length + 1;
};
export const complaintEscalationStageCount = (data, stationId) => manualChain(data).length || escalationStageCount(data, stationId);
export const usesManualComplaintEscalation = (data) => manualChain(data).length > 0;
export const isManualComplaintHandler = (employee, data) => manualChain(data).some((handler) => handler.id === employee?.id);

export function handlersForLevel(levelIdx, r, data) {
  const branch = deriveBranchEscalationChain(r?.stationId, data);
  if (branch.length) {
    const step = branch[levelIdx];
    if (!step) return [];
    return (data.employees || []).filter((e) => String(e.id) === String(step.employeeId));
  }
  if (levelIdx === 0) return data.employees.filter((e) => e.role === "station_manager" && userCoversStation(e, data, r.stationId));
  const group = escalationGroups(data)[levelIdx - 1];
  if (!group?.manager) return [];
  return data.employees.filter((e) => {
    if (e.hrLevelId !== group.manager.id) return false;
    if (group.manager.stationIds?.length && !group.manager.stationIds.includes(r.stationId)) return false;
    if (group.scope === "station") return e.hrStationId === r.stationId;
    if (group.scope === "cluster") {
      const cluster = (data.hrClusters || []).find((c) => (c.stationIds || []).includes(r.stationId));
      return cluster ? e.hrClusterId === cluster.id : false;
    }
    return true;
  });
}

export function complaintHandlersForLevel(levelIdx, r, data) {
  // A branch ladder set in the org (or derived from it) names the same people as المهام.
  if (deriveBranchEscalationChain(r?.stationId, data).length) return handlersForLevel(levelIdx, r, data);
  const manual = manualChain(data);
  return manual.length ? (manual[levelIdx] ? [manual[levelIdx]] : []) : handlersForLevel(levelIdx, r, data);
}

export function levelLabel(levelIdx, data, t, lang, stationId) {
  const branch = deriveBranchEscalationChain(stationId, data);
  if (branch[levelIdx]) {
    const step = branch[levelIdx];
    return step.title ? `${step.name} — ${step.title}` : step.name;
  }
  if (levelIdx === 0) return t("stationManager");
  const group = escalationGroups(data)[levelIdx - 1];
  return group ? levelName(group.manager || group.assistant, lang) : "";
}

export function complaintLevelLabel(levelIdx, data, t, lang) {
  const manual = manualChain(data);
  if (!manual.length) return levelLabel(levelIdx, data, t, lang);
  const employee = manual[levelIdx];
  const node = data.orgTree?.find((item) => item.type === "employee" && item.refId === employee?.id);
  return employee ? `${employee.name}${node?.title ? ` — ${node.title}` : ""}` : "";
}

export const hasHandlerAtLevel = (levelIdx, r, data) => handlersForLevel(levelIdx, r, data).length > 0;
export const complaintHasHandlerAtLevel = (levelIdx, r, data) => complaintHandlersForLevel(levelIdx, r, data).length > 0;

export function buildEscalationSteps(currentLevel, r, data, t, lang, stageCount) {
  const branch = deriveBranchEscalationChain(r?.stationId, data);
  const count = branch.length || stageCount;
  return Array.from({ length: count }).map((_, idx) => ({
    idx,
    label: branch[idx]
      ? (branch[idx].title ? `${branch[idx].name} — ${branch[idx].title}` : branch[idx].name)
      : levelLabel(idx, data, t, lang, r?.stationId),
    hasHandler: branch[idx] ? true : hasHandlerAtLevel(idx, r, data),
    state: idx < currentLevel ? "done" : idx === currentLevel ? "current" : "pending",
  }));
}

export function buildComplaintEscalationSteps(currentLevel, r, data, t, lang, stageCount) {
  return Array.from({ length: stageCount }).map((_, idx) => ({ idx, label: complaintLevelLabel(idx, data, t, lang), hasHandler: complaintHasHandlerAtLevel(idx, r, data), state: idx < currentLevel ? "done" : idx === currentLevel ? "current" : "pending" }));
}