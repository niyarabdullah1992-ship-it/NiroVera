/**
 * Local operations board when base44.functions.operations is unreachable
 * (local preview / offline). Uses company store tasks + opsDerivations —
 * same weight → points rules as the server path.
 */
import {
  clampEffortWeight,
  deriveHorizonGroups,
  deriveOpsCounts,
  applyOpsReject,
  applyOpsReassign,
  applyOpsEndDelegation,
  applyOpsExtendDue,
  applyOpsRedistributeRemaining,
  applyOpsPaceDayLog,
  deriveDailyTaskPace,
  taskPaceInput,
  derivePaceBlocker,
  applyOpsSoftDelete,
  canUndoOpsAction,
  checkDeleteOpsTaskGate,
  checkReassignGate,
  checkEndDelegationGate,
  nextOpsEscalation,
  planHorizonFromDue,
  runOpsEscalationSweep,
  taskAssigneeId,
  taskPoints,
  checkTaskRecurrenceGate,
} from "@/lib/opsDerivations";
import { getCompanyData, updateCompany } from "@/lib/store";
import { stationInHeaderScope } from "@/lib/stationTree";

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;
}

export function normalizeLocalTask(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;
  const effortWeight = clampEffortWeight(raw.effortWeight ?? raw.weight ?? 3);
  const priority = raw.priority || "medium";
  const targetCount = Math.max(1, Number(raw.targetCount ?? raw.task_target) || 1);
  const completedCount = Math.max(0, Number(raw.completedCount ?? raw.completed_tasks) || 0);
  const dueAt = raw.dueAt || raw.dueDate || null;
  const status = raw.status === "pending" ? "active" : (raw.status || "active");
  return {
    id: raw.id || uid("tk"),
    ref: raw.ref || `LOC-${String(index + 1).padStart(3, "0")}`,
    title: raw.title || "—",
    stationId: raw.stationId || null,
    stationIds: Array.isArray(raw.stationIds)
      ? raw.stationIds.map(String)
      : (raw.stationId ? [String(raw.stationId)] : []),
    ownerId: raw.ownerId || raw.assignedTo || null,
    originalOwnerId: raw.originalOwnerId || raw.ownerId || raw.assignedTo || null,
    assignmentHistory: Array.isArray(raw.assignmentHistory) ? raw.assignmentHistory : [],
    actionLog: Array.isArray(raw.actionLog) ? raw.actionLog : [],
    assignmentKind: raw.assignmentKind || null,
    delegatedAt: raw.delegatedAt || null,
    actingUntil: raw.actingUntil || null,
    delegationActive: raw.delegationActive !== false && !!raw.delegatedAt && !raw.delegationEndedAt,
    delegationEndedAt: raw.delegationEndedAt || null,
    delegationById: raw.delegationById || null,
    delegationByName: raw.delegationByName || null,
    transferredAt: raw.transferredAt || null,
    transferredById: raw.transferredById || null,
    transferredByName: raw.transferredByName || null,
    memberIds: Array.isArray(raw.memberIds) ? raw.memberIds : [],
    assignMode: raw.assignMode || "one",
    priority,
    effortWeight,
    workKind: raw.workKind || "gn",
    mode: raw.mode || "onsite",
    dueAt,
    startAt: raw.startAt || null,
    paceStartAt: raw.paceStartAt || null,
    paceSpreadTarget: raw.paceSpreadTarget != null ? Number(raw.paceSpreadTarget) : null,
    paceDayPlan: raw.paceDayPlan && typeof raw.paceDayPlan === "object" && !Array.isArray(raw.paceDayPlan)
      ? raw.paceDayPlan
      : {},
    paceWeekdays: Array.isArray(raw.paceWeekdays) ? raw.paceWeekdays : [],
    paceDates: Array.isArray(raw.paceDates) ? raw.paceDates : [],
    paceDayLog: raw.paceDayLog && typeof raw.paceDayLog === "object" ? raw.paceDayLog : {},
    paceBlocker: raw.paceBlocker && typeof raw.paceBlocker === "object" ? raw.paceBlocker : null,
    targetCount,
    completedCount,
    status,
    planPinned: !!raw.planPinned,
    planHorizon: raw.planPinned && raw.planHorizon
      ? String(raw.planHorizon)
      : planHorizonFromDue(dueAt),
    steps: raw.steps || "",
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    comments: Array.isArray(raw.comments) ? raw.comments : [],
    proofFiles: Array.isArray(raw.proofFiles) ? raw.proofFiles : [],
    attestation: raw.attestation || "",
    createdBy: raw.createdBy || null,
    createdByName: raw.createdByName || null,
    deletedAt: raw.deletedAt || null,
    deletedBy: raw.deletedBy || null,
    rejectReason: raw.rejectReason || "",
    escalationLevel: Number(raw.escalationLevel) || 0,
    escalatedAt: raw.escalatedAt || null,
    approvedAt: raw.approvedAt || null,
    completedAt: raw.completedAt || null,
    closedAt: raw.closedAt || null,
    updatedAt: raw.updatedAt || null,
    pointsAwarded: Number(raw.pointsAwarded) || 0,
    createdAt: raw.createdAt || new Date().toISOString(),
    seriesId: raw.seriesId || null,
    recurrence: raw.recurrence && typeof raw.recurrence === "object" ? raw.recurrence : null,
  };
}

export function buildLocalOpsBoard({ tasks, scope = "all", stations = [] } = {}) {
  const raw = Array.isArray(tasks) ? tasks : [];
  let normalized = raw.map((t, i) => normalizeLocalTask(t, i)).filter(Boolean);
  if (scope && scope !== "all") {
    normalized = normalized.filter((t) => !t.stationId || stationInHeaderScope(t.stationId, scope, stations));
  }
  return {
    tasks: normalized,
    counts: deriveOpsCounts(normalized),
    horizons: deriveHorizonGroups(normalized),
    source: "local",
  };
}

export function createLocalOpsTask(companyId, input, { employees = [] } = {}) {
  const recGate = checkTaskRecurrenceGate(input.recurrence, {
    startAt: input.startAt || null,
    dueAt: input.dueAt || null,
  });
  if (!recGate.ok) {
    return { error: recGate.error, reason: recGate.reason, reasonEn: recGate.reasonEn, tasks: [], counts: null };
  }
  const windows = recGate.windows;
  const seriesId = windows.length > 1 ? uid("series") : null;
  const data = updateCompany(companyId, (d) => {
    const list = Array.isArray(d.tasks) ? d.tasks : [];
    const owner = (employees || []).find((e) => {
      const eid = String(e.employeeId || e.id || "");
      return eid && eid === String(input.ownerId || "");
    });
    const createdAt = new Date().toISOString();
    const stationIds = Array.isArray(input.stationIds) && input.stationIds.length
      ? input.stationIds.map(String)
      : (input.stationId ? [String(input.stationId)] : []);
    const created = windows.map((window, index) => normalizeLocalTask({
      id: uid("tk"),
      ref: `LOC-${String(list.length + windows.length - index).padStart(3, "0")}`,
      title: input.title,
      stationId: stationIds[0] || input.stationId || null,
      stationIds,
      ownerId: input.ownerId || null,
      originalOwnerId: input.ownerId || null,
      assignmentHistory: [],
      actionLog: [{
        id: `create_${createdAt}`,
        type: "create",
        at: createdAt,
        byId: input.createdBy || null,
        byName: input.createdByName || owner?.name || "",
      }],
      memberIds: input.memberIds || [],
      assignMode: input.assignMode || "one",
      priority: input.priority || "medium",
      effortWeight: input.effortWeight ?? 3,
      workKind: input.workKind || "gn",
      mode: input.mode || "onsite",
      dueAt: window.dueAt,
      startAt: window.startAt || createdAt,
      targetCount: input.targetCount || 1,
      completedCount: 0,
      status: "active",
      planPinned: !!input.planPinned,
      planHorizon: input.planPinned && input.planHorizon
        ? input.planHorizon
        : planHorizonFromDue(window.dueAt || null),
      steps: input.steps || "",
      attachments: input.attachments || [],
      assignedTo: input.ownerId || null,
      ownerName: owner?.name,
      createdBy: input.createdBy || null,
      createdByName: input.createdByName || null,
      createdAt,
      seriesId,
      paceWeekdays: Array.isArray(input.paceWeekdays) ? input.paceWeekdays : [],
      paceDates: Array.isArray(input.paceDates) ? input.paceDates : [],
      recurrence: windows.length > 1
        ? {
          ...recGate.recurrence,
          seriesId,
          occurrence: index + 1,
          occurrenceCount: windows.length,
        }
        : null,
    }, list.length + index));
    d.tasks = [...created, ...list];
  }, { sync: "tasks" });
  return buildLocalOpsBoard({ tasks: data?.tasks || [], scope: "all" });
}

export function mutateLocalOpsTask(companyId, taskId, mutator, { seed } = {}) {
  const data = updateCompany(companyId, (d) => {
    const list = Array.isArray(d.tasks) ? d.tasks : [];
    const idx = list.findIndex((t) => String(t.id) === String(taskId));
    if (idx < 0) {
      if (!seed) return;
      const n = normalizeLocalTask({ ...seed, id: taskId, companyId });
      d.tasks = [mutator(n) || n, ...list];
      return;
    }
    d.tasks = list.map((t) => {
      if (String(t.id) !== String(taskId)) return t;
      const n = normalizeLocalTask(t);
      return mutator(n) || n;
    });
  }, { sync: "tasks" });
  return buildLocalOpsBoard({ tasks: data?.tasks || [], scope: "all" });
}

export function logLocalCompletion(companyId, taskId, { amount = 1, attestation = "", proofFiles = [] } = {}) {
  return mutateLocalOpsTask(companyId, taskId, (t) => {
    const add = Math.max(1, Number(amount) || 1);
    const at = new Date().toISOString();
    const nextCount = Math.min(t.targetCount, t.completedCount + add);
    const awaiting = nextCount >= t.targetCount;
    let next = applyOpsPaceDayLog({
      ...t,
      completedCount: nextCount,
      completed_tasks: nextCount,
      attestation: attestation || t.attestation,
      proofFiles: [...(t.proofFiles || []), ...proofFiles],
      status: awaiting ? "awaiting_approval" : t.status,
      escalationLevel: awaiting ? 0 : t.escalationLevel,
    }, add, at);
    if (!awaiting) {
      const pace = deriveDailyTaskPace(taskPaceInput(next));
      const blocker = derivePaceBlocker({ task: next, pace });
      if (blocker) {
        const logged = Math.max(0, Number(blocker.logged) || 0);
        next = {
          ...next,
          paceBlocker: {
            ...blocker,
            logged,
            gap: Math.max(0, Number(blocker.expected) - logged),
            kind: logged <= 0 ? "missed" : "partial",
            status: "open",
            openedAt: at,
          },
        };
      }
    }
    return next;
  });
}

export function approveLocalTask(companyId, taskId) {
  let awarded = 0;
  const board = mutateLocalOpsTask(companyId, taskId, (t) => {
    awarded = taskPoints(t.priority, t.effortWeight);
    return {
      ...t,
      status: "completed",
      approvedAt: new Date().toISOString(),
      pointsAwarded: awarded,
      completedCount: Math.max(t.completedCount, t.targetCount),
    };
  });
  return { ...board, awarded: { points: awarded } };
}

export function reassignLocalOpsTask(companyId, taskId, {
  toId, reason, kind = "delegate", delegatedAt = "", actingUntil = "", reviewer, data, employees = [], lang = "ar", task,
} = {}) {
  const people = (employees || []).map((e) => ({
    employeeId: e.employeeId || e.id,
    id: e.id || e.employeeId,
    name: e.name,
  }));
  const current = (getCompanyData(companyId)?.tasks || []).find((t) => String(t.id) === String(taskId))
    || (task && String(task.id) === String(taskId) ? task : null);
  const preview = current ? normalizeLocalTask(current) : { status: "active", ownerId: null, assignMode: "one" };
  const gate = checkReassignGate({
    task: preview,
    user: reviewer,
    data,
    toId,
    reason,
    kind,
    delegatedAt,
    actingUntil,
    people,
    lang,
  });
  if (!gate.ok) {
    const err = new Error(gate.reason || gate.error);
    err.code = gate.error;
    throw err;
  }
  return mutateLocalOpsTask(companyId, taskId, (t) => {
    const fromId = taskAssigneeId(t);
    const fromPerson = people.find((p) => String(p.employeeId || p.id) === String(fromId));
    const toPerson = people.find((p) => String(p.employeeId || p.id) === String(toId));
    return applyOpsReassign(t, {
      fromId,
      toId,
      byId: reviewer?.id || reviewer?.employeeId || null,
      reason,
      kind: gate.kind,
      delegatedAt: gate.delegatedAt,
      actingUntil: gate.actingUntil,
      fromName: fromPerson?.name || "",
      toName: toPerson?.name || "",
      byName: reviewer?.name || "",
      lang,
    });
  }, { seed: current });
}

export function endLocalOpsDelegation(companyId, taskId, {
  reason, endedAt = "", reviewer, data, employees = [], lang = "ar", task,
} = {}) {
  const people = (employees || []).map((e) => ({
    employeeId: e.employeeId || e.id,
    id: e.id || e.employeeId,
    name: e.name,
  }));
  const current = (getCompanyData(companyId)?.tasks || []).find((t) => String(t.id) === String(taskId))
    || (task && String(task.id) === String(taskId) ? task : null);
  const preview = current ? normalizeLocalTask(current) : { status: "active", ownerId: null, assignMode: "one" };
  const gate = checkEndDelegationGate({
    task: preview,
    user: reviewer,
    data,
    reason,
    lang,
  });
  if (!gate.ok) {
    const err = new Error(gate.reason || gate.error);
    err.code = gate.error;
    throw err;
  }
  return mutateLocalOpsTask(companyId, taskId, (t) => {
    const fromId = taskAssigneeId(t);
    const fromPerson = people.find((p) => String(p.employeeId || p.id) === String(fromId));
    const toPerson = people.find((p) => String(p.employeeId || p.id) === String(gate.restoreId));
    return applyOpsEndDelegation(t, {
      restoreId: gate.restoreId,
      byId: reviewer?.id || reviewer?.employeeId || null,
      reason,
      endedAt,
      fromName: fromPerson?.name || "",
      toName: toPerson?.name || "",
      byName: reviewer?.name || "",
      lang,
    });
  }, { seed: current });
}

export function extendLocalOpsDue(companyId, taskId, {
  dueAt, reason, reviewer, lang = "ar",
  expected, logged, gap, blockerDay,
} = {}) {
  return mutateLocalOpsTask(companyId, taskId, (t) => applyOpsExtendDue(t, {
    dueAt,
    reason,
    byId: reviewer?.id || reviewer?.employeeId || null,
    byName: reviewer?.name || "",
    lang,
    expected,
    logged,
    gap,
    blockerDay,
  }));
}

export function redistributeLocalOpsPace(companyId, taskId, {
  reason, reviewer, lang = "ar",
  expected, logged, gap, blockerDay,
} = {}) {
  return mutateLocalOpsTask(companyId, taskId, (t) => applyOpsRedistributeRemaining(t, {
    reason,
    byId: reviewer?.id || reviewer?.employeeId || null,
    byName: reviewer?.name || "",
    lang,
    expected,
    logged,
    gap,
    blockerDay,
  }));
}

export function deleteLocalOpsTask(companyId, taskId, { reviewer } = {}) {
  const current = (getCompanyData(companyId)?.tasks || []).find((t) => String(t.id) === String(taskId));
  const task = current ? normalizeLocalTask(current) : null;
  const gate = checkDeleteOpsTaskGate(task, reviewer);
  if (!gate.ok) {
    const err = new Error(gate.reason || gate.error);
    err.code = gate.error;
    err.reason = gate.reason;
    err.reasonEn = gate.reasonEn;
    throw err;
  }
  return mutateLocalOpsTask(companyId, taskId, (t) => applyOpsSoftDelete(t, {
    byId: reviewer?.id || reviewer?.employeeId || null,
    byName: reviewer?.name || "",
  }));
}

export function undoLocalOpsAction(companyId, taskId, { reviewer } = {}) {
  const current = (getCompanyData(companyId)?.tasks || []).find((t) => String(t.id) === String(taskId));
  const gate = canUndoOpsAction(current ? normalizeLocalTask(current) : null);
  if (!gate) {
    const err = new Error("UNDO_WINDOW_CLOSED");
    err.code = "UNDO_WINDOW_CLOSED";
    throw err;
  }
  if (gate.target === "create") {
    return mutateLocalOpsTask(companyId, taskId, (t) => applyOpsSoftDelete(t, {
      byId: reviewer?.id || reviewer?.employeeId || null,
      byName: reviewer?.name || "",
    }));
  }
  // Mark last action as undone in the cumulative log (keeps proof trail).
  return mutateLocalOpsTask(companyId, taskId, (t) => {
    const log = Array.isArray(t.actionLog) ? t.actionLog : [];
    const last = log[log.length - 1];
    const at = new Date().toISOString();
    return {
      ...t,
      actionLog: [
        ...log,
        {
          id: `undo_${at}`,
          type: "undo",
          at,
          byId: reviewer?.id || reviewer?.employeeId || null,
          byName: reviewer?.name || "",
          undoneType: last?.type || gate.target,
        },
      ],
    };
  });
}

export function addLocalOpsComment(companyId, taskId, { text, isIssue = false, files = [], authorId = null, authorName = "", requestedDueAt = null } = {}) {
  const trimmed = String(text || "").trim();
  const attachments = Array.isArray(files) ? files.filter((f) => f && f.url) : [];
  if (!trimmed && !attachments.length) throw new Error("EMPTY_COMMENT");
  const at = new Date().toISOString();
  const due = requestedDueAt ? String(requestedDueAt).slice(0, 10) : null;
  return mutateLocalOpsTask(companyId, taskId, (t) => ({
    ...t,
    comments: [
      ...(t.comments || []),
      {
        id: uid("cm"),
        text: trimmed,
        isIssue: !!isIssue,
        files: attachments,
        authorId,
        authorName,
        requestedDueAt: due,
        at,
        createdAt: at,
      },
    ],
  }));
}

export function deleteLocalOpsComment(companyId, taskId, commentId) {
  const id = String(commentId || "").trim();
  if (!id) throw new Error("COMMENT_REQUIRED");
  return mutateLocalOpsTask(companyId, taskId, (t) => {
    const comments = Array.isArray(t.comments) ? t.comments : [];
    const found = comments.find((c) => String(c.id) === id);
    if (found?.is_auto) {
      const err = new Error("PROTECTED");
      err.code = "PROTECTED";
      throw err;
    }
    return {
      ...t,
      comments: comments.filter((c) => String(c.id) !== id),
    };
  });
}

export function addLocalOpsAttachment(companyId, taskId, { url, name = "file" } = {}) {
  if (!url) throw new Error("Missing attachment url");
  return mutateLocalOpsTask(companyId, taskId, (t) => ({
    ...t,
    attachments: [
      ...(t.attachments || []),
      { id: uid("att"), url, name, createdAt: new Date().toISOString() },
    ],
  }));
}

export function rejectLocalTask(companyId, taskId, reason, { reviewer, data } = {}) {
  let escalation = { escalate: false, atTop: true, nextLevel: 0 };
  const board = mutateLocalOpsTask(companyId, taskId, (t) => {
    const next = nextOpsEscalation(t, data, reviewer?.id || reviewer?.employeeId);
    escalation = next;
    return applyOpsReject(t, {
      reason,
      escalate: next.escalate,
      nextLevel: next.nextLevel,
      reviewerId: reviewer?.id || reviewer?.employeeId || null,
      reviewerName: reviewer?.name || "",
    });
  });
  return { ...board, escalation };
}

export function runLocalEscalationSweep(companyId, data, { force = false } = {}) {
  const raw = getCompanyData(companyId)?.tasks || [];
  const normalized = raw.map((t, i) => normalizeLocalTask(t, i)).filter(Boolean);
  const sweep = runOpsEscalationSweep(normalized, data, new Date(), { force });
  if (!sweep.escalated) {
    return { ...buildLocalOpsBoard({ tasks: normalized }), escalated: 0, details: [] };
  }
  updateCompany(companyId, (d) => {
    d.tasks = sweep.tasks;
  }, { sync: "tasks" });
  return {
    ...buildLocalOpsBoard({ tasks: sweep.tasks }),
    escalated: sweep.escalated,
    details: sweep.details,
  };
}
