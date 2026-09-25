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
  applyOpsEmployeeEscalate,
  applyOpsReassign,
  applyOpsEndDelegation,
  applyOpsExtendDue,
  applyOpsRedistributeRemaining,
  applyOpsPaceDayLog,
  applyOpsCommentDelete,
  deriveDailyTaskPace,
  taskPaceInput,
  derivePaceBlocker,
  applyOpsSoftDelete,
  canUndoOpsAction,
  checkDeleteOpsTaskGate,
  checkReassignGate,
  checkEndDelegationGate,
  checkSetMembersGate,
  applyOpsSetMembers,
  canEmployeeEscalateOpsTask,
  nextOpsEscalation,
  planHorizonFromDue,
  runOpsEscalationSweep,
  taskAssigneeId,
  taskPoints,
  canReviewOpsTask,
  checkTaskRecurrenceGate,
  checkTaskHeatBanGate,
  checkTaskModeGate,
  deriveTaskHeatBanNotice,
  normalizeTaskMode,
  opsVisitorStamp,
} from "@/lib/opsDerivations";
import { canCreateTasks } from "@/lib/permissions";
import { getCompanyData, updateCompany } from "@/lib/store";
import { stationInHeaderScope } from "@/lib/stationTree";

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;
}

/** Refusal shaped like the cloud function's, so the offline path is never the looser one. */
function refuse(error, reason, reasonEn) {
  return { error, reason, reasonEn, tasks: [], counts: null };
}

function findLocalTask(companyId, taskId) {
  const list = getCompanyData(companyId)?.tasks || [];
  const raw = list.find((t) => String(t?.id) === String(taskId));
  return raw ? normalizeLocalTask(raw) : null;
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
    homeStationId: raw.homeStationId || null,
    visitor: raw.visitor === true,
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
    mode: normalizeTaskMode(raw.mode),
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
    stepsUpdatedAt: raw.stepsUpdatedAt || null,
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments.map((a, i) => ({
          ...a,
          id: a.id || `att_${i}`,
          createdAt: a.createdAt || a.at || null,
          updatedAt: a.updatedAt || null,
        }))
      : [],
    attachmentsUpdatedAt: raw.attachmentsUpdatedAt || null,
    comments: Array.isArray(raw.comments) ? raw.comments : [],
    proofFiles: Array.isArray(raw.proofFiles) ? raw.proofFiles : [],
    attestation: raw.attestation || "",
    createdBy: raw.createdBy || null,
    createdByName: raw.createdByName || null,
    deletedAt: raw.deletedAt || null,
    deletedBy: raw.deletedBy || null,
    deletedByName: raw.deletedByName || "",
    deleteReason: raw.deleteReason || "",
    deleteAck: !!raw.deleteAck,
    rejectReason: raw.rejectReason || "",
    rejectCount: Math.max(0, Math.round(Number(raw.rejectCount) || 0)),
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

export function createLocalOpsTask(companyId, input, { employees = [], actor = null, data: rights = null } = {}) {
  if (!canCreateTasks(actor, rights || { employees })) {
    return refuse("FORBIDDEN", "إنشاء المهام مقصور على المشرفين.", "Only managers can create tasks");
  }
  const modeGate = checkTaskModeGate(input.mode);
  if (!modeGate.ok) {
    return refuse(modeGate.error, modeGate.reason, modeGate.reasonEn);
  }
  const recGate = checkTaskRecurrenceGate(input.recurrence, {
    startAt: input.startAt || null,
    dueAt: input.dueAt || null,
  });
  if (!recGate.ok) {
    return { error: recGate.error, reason: recGate.reason, reasonEn: recGate.reasonEn, tasks: [], counts: null };
  }
  const windows = recGate.windows;
  const seriesId = windows.length > 1 ? uid("series") : null;
  let heatNotice = null;
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
    const executeId = stationIds[0] || input.stationId || null;
    const visit = opsVisitorStamp(owner || { homeStationId: input.homeStationId }, executeId);
    const assignMode = input.assignMode || "one";
    let memberIds = Array.isArray(input.memberIds) ? input.memberIds.map(String).filter(Boolean) : [];
    if (assignMode === "all" && !memberIds.length) {
      const wanted = new Set(stationIds);
      memberIds = (employees || [])
        .filter((e) => wanted.has(String(e.stationId || e.station_id || "")))
        .map((e) => String(e.employeeId || e.id || ""))
        .filter(Boolean);
    }
    const created = windows.map((window, index) => normalizeLocalTask({
      id: uid("tk"),
      ref: `LOC-${String(list.length + windows.length - index).padStart(3, "0")}`,
      title: input.title,
      stationId: executeId,
      stationIds,
      ownerId: input.ownerId || null,
      originalOwnerId: input.ownerId || null,
      homeStationId: visit.homeStationId,
      visitor: visit.visitor,
      assignmentHistory: [],
      actionLog: [{
        id: `create_${createdAt}`,
        type: "create",
        at: createdAt,
        byId: input.createdBy || null,
        byName: input.createdByName || owner?.name || "",
      }],
      memberIds,
      assignMode,
      priority: input.priority || "medium",
      effortWeight: input.effortWeight ?? 3,
      workKind: input.workKind || "gn",
      mode: modeGate.mode,
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
      attachments: (Array.isArray(input.attachments) ? input.attachments : []).map((a) => ({
        ...a,
        id: a.id || uid("att"),
        createdAt: a.createdAt || createdAt,
      })),
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
    heatNotice = created.map((t) => deriveTaskHeatBanNotice(t)).find(Boolean) || null;
  }, { sync: "tasks" });
  return { ...buildLocalOpsBoard({ tasks: data?.tasks || [], scope: "all" }), heatNotice };
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

export function setLocalTaskMode(companyId, taskId, mode, { reason = "", reviewer, seed } = {}) {
  const modeGate = checkTaskModeGate(mode);
  if (!modeGate.ok) return refuse(modeGate.error, modeGate.reason, modeGate.reasonEn);
  const next = modeGate.mode;
  return mutateLocalOpsTask(companyId, taskId, (t) => {
    const from = normalizeTaskMode(t.mode);
    if (from === next && !String(reason || "").trim()) return t;
    const at = new Date().toISOString();
    return {
      ...t,
      mode: next,
      actionLog: [
        ...(Array.isArray(t.actionLog) ? t.actionLog : []),
        {
          id: `mode_${at}`,
          type: "mode",
          at,
          byId: reviewer?.id || reviewer?.employeeId || null,
          byName: reviewer?.name || "",
          from,
          to: next,
          reason: String(reason || "").trim(),
        },
      ],
    };
  }, { seed });
}

export function logLocalCompletion(companyId, taskId, {
  amount = 1, attestation = "", proofFiles = [], authorId = null, authorName = "", stopReason = "", now = new Date(),
} = {}) {
  const asked = Math.max(0, Math.round(Number(amount) || 0));
  const note = String(attestation || "").trim();
  const stop = String(stopReason || "").trim();
  const media = Array.isArray(proofFiles) ? proofFiles.filter((f) => f && (f.url || f.localOnly || f.name)) : [];
  // Same sun-ban refusal the cloud returns, word for word — the fallback is never the wider path.
  const heatGate = checkTaskHeatBanGate(findLocalTask(companyId, taskId), { now, amount: asked });
  if (!heatGate.ok) return refuse(heatGate.error, heatGate.reason, heatGate.reasonEn);
  // Same two gates the cloud enforces — the offline path must not bank an unproven unit.
  if (asked < 1 && !stop) {
    return refuse("STOP_REASON_REQUIRED", "اكتب سبب عدم إكمال حصة اليوم.", "Write why today's quota was not finished.");
  }
  if (asked >= 1 && !media.length && !note) {
    return refuse("PROOF_REQUIRED", "لا نقطة بلا أثر — أرفق صورة أو اكتب إفادة أولًا", "No point without a trace — attach a file or write an attestation first");
  }
  return mutateLocalOpsTask(companyId, taskId, (t) => {
    const add = Math.max(0, Math.round(Number(amount) || 0));
    const at = new Date().toISOString();
    const stop = String(stopReason || "").trim();
    const media = Array.isArray(proofFiles) ? proofFiles.filter((f) => f && (f.url || f.localOnly || f.name)) : [];
    const note = String(attestation || "").trim() || (add > 0 ? `إنجاز ×${add}` : stop);
    const nextCount = add > 0 ? Math.min(t.targetCount, t.completedCount + add) : t.completedCount;
    const awaiting = nextCount >= t.targetCount;
    const comment = {
      id: uid("cm"),
      text: note,
      kind: add > 0 ? "log" : "stop",
      amount: add,
        isIssue: !!stop,
      stopReason: stop,
      files: media,
      authorId,
      authorName,
      at,
      createdAt: at,
    };
    let next = {
      ...t,
      completedCount: nextCount,
      completed_tasks: nextCount,
      attestation: attestation || t.attestation,
      proofFiles: add > 0 ? [...(t.proofFiles || []), ...media] : (t.proofFiles || []),
      status: awaiting ? "awaiting_approval" : t.status,
      escalationLevel: awaiting ? 0 : t.escalationLevel,
      comments: [...(t.comments || []), comment],
      actionLog: [
        ...(Array.isArray(t.actionLog) ? t.actionLog : []),
        { id: uid("act"), type: add > 0 ? "log" : "stop", at, amount: add, reason: stop, byId: authorId, byName: authorName },
      ],
    };
    if (add > 0) next = applyOpsPaceDayLog(next, add, at);
    if (!awaiting) {
      const pace = deriveDailyTaskPace(taskPaceInput(next));
      const blocker = derivePaceBlocker({ task: next, pace, amountJustLogged: add, applied: true });
      if (blocker) {
        const logged = Math.max(0, Number(blocker.logged) || 0);
        next = {
          ...next,
          paceBlocker: {
            ...blocker,
            logged,
            gap: Math.max(0, Number(blocker.expected) - logged),
            kind: logged <= 0 ? "missed" : "partial",
            reason: stop,
            status: "open",
            openedAt: at,
          },
        };
      } else if (next.paceBlocker?.status === "open") {
        next = {
          ...next,
          paceBlocker: { ...next.paceBlocker, status: "resolved", reason: stop || next.paceBlocker.reason, resolvedAt: at },
        };
      }
    }
    return next;
  });
}

export function approveLocalTask(companyId, taskId, { reviewer = null, data = null } = {}) {
  const current = findLocalTask(companyId, taskId);
  if (current && !canReviewOpsTask(current, reviewer, data)) {
    return refuse(
      "NOT_CURRENT_REVIEWER",
      "هذا المستوى لمن يليك في سلسلة التصعيد — لا يمكنك اعتماده بعد الرفض.",
      "This level belongs to the next handler in the chain — you cannot approve it.",
    );
  }
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
    stationId: e.stationId || e.station_id || e.homeStationId || null,
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
      homeStationId: toPerson?.stationId || null,
      toStationId: toPerson?.stationId || null,
      lang,
    });
  }, { seed: current });
}

export function setLocalOpsMembers(companyId, taskId, {
  memberIds = [], reviewer, data, employees = [], lang = "ar", task, reason = "",
} = {}) {
  const people = (employees || []).map((e) => ({
    employeeId: e.employeeId || e.id,
    id: e.id || e.employeeId,
    name: e.name,
    stationId: e.stationId || e.station_id || e.homeStationId || null,
  }));
  const current = (getCompanyData(companyId)?.tasks || []).find((t) => String(t.id) === String(taskId))
    || (task && String(task.id) === String(taskId) ? task : null);
  const preview = current ? normalizeLocalTask(current) : { status: "active", ownerId: null, assignMode: "one", memberIds: [] };
  const gate = checkSetMembersGate({
    task: preview,
    user: reviewer,
    data,
    memberIds,
    people,
    lang,
  });
  if (!gate.ok) {
    const err = new Error(gate.reason || gate.error);
    err.code = gate.error;
    throw err;
  }
  if (gate.unchanged) {
    return buildLocalOpsBoard({
      tasks: getCompanyData(companyId)?.tasks || [],
      scope: "all",
    });
  }
  return mutateLocalOpsTask(companyId, taskId, (t) => applyOpsSetMembers(t, {
    memberIds: gate.memberIds,
    byId: reviewer?.id || reviewer?.employeeId || null,
    byName: reviewer?.name || "",
    reason,
    people,
    lang,
  }), { seed: current });
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

export function deleteLocalOpsTask(companyId, taskId, { reviewer, reason = "", ack = false, undoCreate = false } = {}) {
  const current = (getCompanyData(companyId)?.tasks || []).find((t) => String(t.id) === String(taskId));
  const task = current ? normalizeLocalTask(current) : null;
  const gate = checkDeleteOpsTaskGate(task, reviewer, { reason, ack, undoCreate });
  if (!gate.ok) {
    const err = new Error(gate.reason || gate.error);
    err.code = gate.error;
    err.reason = gate.reason;
    err.reasonEn = gate.reasonEn;
    throw err;
  }
  const why = undoCreate
    ? (String(reason || "").trim() || "تراجع عن الإنشاء خلال المهلة")
    : String(reason || "").trim();
  return mutateLocalOpsTask(companyId, taskId, (t) => applyOpsSoftDelete(t, {
    byId: reviewer?.id || reviewer?.employeeId || null,
    byName: reviewer?.name || "",
    reason: why,
    ack: undoCreate ? true : ack,
    undoCreate,
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
      reason: "تراجع عن الإنشاء خلال المهلة",
      ack: true,
      undoCreate: true,
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

export function addLocalOpsComment(companyId, taskId, {
  text, isIssue = false, files = [], authorId = null, authorName = "", requestedDueAt = null, kind = "comment", amount = 0,
} = {}) {
  const trimmed = String(text || "").trim();
  const attachments = Array.isArray(files)
    ? files.filter((f) => f && (f.url || f.localOnly || f.name)).map((f) => ({
        url: f.url || "",
        name: f.name || "file",
        type: f.type || "",
        localOnly: !!f.localOnly || !f.url,
      }))
    : [];
  if (!trimmed && !attachments.length) throw new Error("EMPTY_COMMENT");
  const at = new Date().toISOString();
  const due = requestedDueAt ? String(requestedDueAt).slice(0, 10) : null;
  const commentKind = isIssue ? "blocker" : (kind || "comment");
  return mutateLocalOpsTask(companyId, taskId, (t) => {
    const nextComments = [
      ...(t.comments || []),
      {
        id: uid("cm"),
        text: trimmed,
        kind: commentKind,
        amount: Math.max(0, Number(amount) || 0),
        isIssue: !!isIssue,
        files: attachments,
        authorId,
        authorName,
        requestedDueAt: due,
        at,
        createdAt: at,
      },
    ];
    let next = {
      ...t,
      comments: nextComments,
      actionLog: [
        ...(Array.isArray(t.actionLog) ? t.actionLog : []),
        { id: uid("act"), type: commentKind, at, byId: authorId, byName: authorName },
      ],
    };
    if (isIssue) {
      const pace = deriveDailyTaskPace(taskPaceInput(next));
      const blocker = derivePaceBlocker({ task: next, pace, missed: true });
      if (blocker) {
        next = {
          ...next,
          paceBlocker: {
            ...blocker,
            reason: trimmed,
            status: "open",
            openedAt: at,
          },
        };
      }
    }
    return next;
  });
}

export function deleteLocalOpsComment(companyId, taskId, commentId, { actorId, actorIds } = {}) {
  const id = String(commentId || "").trim();
  if (!id) throw new Error("COMMENT_REQUIRED");
  return mutateLocalOpsTask(companyId, taskId, (t) => {
    const result = applyOpsCommentDelete(t, id, { actorId, actorIds });
    if (!result.ok) {
      const err = new Error(result.reason || result.error);
      err.code = result.error;
      throw err;
    }
    return result.task;
  });
}

export function addLocalOpsAttachment(companyId, taskId, { url, name = "file", type = "" } = {}, { reviewer, seed } = {}) {
  if (!url && !name) throw new Error("Missing attachment url");
  const at = new Date().toISOString();
  return mutateLocalOpsTask(companyId, taskId, (t) => ({
    ...t,
    attachments: [
      ...(t.attachments || []),
      { id: uid("att"), url: url || "", name, type, localOnly: !url, createdAt: at, updatedAt: at },
    ],
    attachmentsUpdatedAt: at,
    updatedAt: at,
    actionLog: [
      ...(Array.isArray(t.actionLog) ? t.actionLog : []),
      { id: uid("act"), type: "attachment", at, byId: reviewer?.id || reviewer?.employeeId || null, byName: reviewer?.name || "" },
    ],
  }), { seed });
}

export function replaceLocalOpsAttachment(companyId, taskId, attachmentId, { url, name, type } = {}, { reviewer, seed } = {}) {
  const id = String(attachmentId || "").trim();
  if (!id) throw new Error("ATTACHMENT_REQUIRED");
  const at = new Date().toISOString();
  return mutateLocalOpsTask(companyId, taskId, (t) => ({
    ...t,
    attachments: (t.attachments || []).map((a, i) => (
      String(a.id) === id || String(i) === id
        ? {
            ...a,
            url: url != null ? url : a.url,
            name: name || a.name,
            type: type || a.type,
            localOnly: url ? false : (a.localOnly || !url),
            updatedAt: at,
          }
        : a
    )),
    attachmentsUpdatedAt: at,
    updatedAt: at,
    actionLog: [
      ...(Array.isArray(t.actionLog) ? t.actionLog : []),
      { id: uid("act"), type: "attachment", at, byId: reviewer?.id || reviewer?.employeeId || null, byName: reviewer?.name || "" },
    ],
  }), { seed });
}

export function updateLocalOpsSteps(companyId, taskId, steps, { reviewer, seed } = {}) {
  const text = Array.isArray(steps) ? steps.map((s) => String(s || "").trim()).filter(Boolean).join("\n") : String(steps || "");
  const at = new Date().toISOString();
  return mutateLocalOpsTask(companyId, taskId, (t) => ({
    ...t,
    steps: text,
    stepsUpdatedAt: at,
    updatedAt: at,
    actionLog: [
      ...(Array.isArray(t.actionLog) ? t.actionLog : []),
      { id: uid("act"), type: "steps", at, byId: reviewer?.id || reviewer?.employeeId || null, byName: reviewer?.name || "" },
    ],
  }), { seed });
}

export function rejectLocalTask(companyId, taskId, reason, { reviewer, data } = {}) {
  const why = String(reason || "").trim();
  if (!why) {
    return refuse("REASON_REQUIRED", "اكتب سبب الرفض — لا رفض بلا سبب مكتوب.", "Write why it is rejected");
  }
  const current = findLocalTask(companyId, taskId);
  if (current && !canReviewOpsTask(current, reviewer, data)) {
    return refuse(
      "NOT_CURRENT_REVIEWER",
      "هذا المستوى لمن يليك في سلسلة التصعيد — لا يمكنك رفضه بعد تصعيده.",
      "This level belongs to the next handler in the chain — you cannot reject it.",
    );
  }
  const board = mutateLocalOpsTask(companyId, taskId, (t) => applyOpsReject(t, {
    reason,
    escalate: false,
    reviewerId: reviewer?.id || reviewer?.employeeId || null,
    reviewerName: reviewer?.name || "",
  }));
  return { ...board, escalation: { escalate: false, atTop: true, nextLevel: 0 } };
}

export function escalateLocalOpsByEmployee(companyId, taskId, reason, { actor, data } = {}) {
  let escalation = { escalate: false, atTop: true, nextLevel: 0 };
  const board = mutateLocalOpsTask(companyId, taskId, (t) => {
    if (!canEmployeeEscalateOpsTask(t, actor, data)) {
      throw new Error("EMPLOYEE_ESCALATE_DENIED");
    }
    const next = nextOpsEscalation(t, data);
    escalation = next;
    if (!next.escalate) throw new Error("EMPLOYEE_ESCALATE_DENIED");
    return applyOpsEmployeeEscalate(t, {
      reason,
      nextLevel: next.nextLevel,
      actorId: actor?.id || actor?.employeeId || null,
      actorName: actor?.name || "",
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
