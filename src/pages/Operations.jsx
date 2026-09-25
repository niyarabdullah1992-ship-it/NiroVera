import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { base44 } from "@/api/base44Client";
import { getCompanyToken, syncPointsFromCloud } from "@/lib/store";
import {
  canReassignOpsTask,
  canEndOpsDelegation,
  canReviewOpsTask,
  canEmployeeEscalateOpsTask,
  isOpsTaskAssignee,
  canSeeOpsTask,
  opsRejectionCount,
  isAwaitingApproval,
  isEscalated,
  isOverdue,
  deriveBoardDailyPace,
  deriveHorizonGroups,
  deriveOpsCounts,
  deriveDailyTaskPace,
  taskPaceInput,
  taskPaceLoggedOnDay,
  taskPlanHorizon,
  taskPoints,
  taskRecurrenceFromForm,
  checkTaskRecurrenceGate,
  checkTaskPaceFromForm,
  formPaceMode,
  listMatchingPaceDays,
  normalizeWeekdays,
  isOpsTaskDeleted,
  isOpsTaskArchived,
  canDeleteOpsTask,
  opsVisitorStamp,
  taskAssignScopeLabel,
  taskCreatorName,
  taskAssigneeIds,
  taskAssigneePeople,
  checkTaskModeGate,
  taskModeLabel,
} from "@/lib/opsDerivations";
import { canCreateTasks, visibleEmployees, visibleStations } from "@/lib/permissions";
import { buildOpsEscalationSteps, currentOpsLevelLabel } from "@/lib/opsEscalation";
import {
  approveLocalTask,
  buildLocalOpsBoard,
  createLocalOpsTask,
  deleteLocalOpsTask,
  addLocalOpsComment,
  addLocalOpsAttachment,
  replaceLocalOpsAttachment,
  updateLocalOpsSteps,
  deleteLocalOpsComment,
  endLocalOpsDelegation,
  extendLocalOpsDue,
  logLocalCompletion,
  setLocalTaskMode,
  reassignLocalOpsTask,
  setLocalOpsMembers,
  redistributeLocalOpsPace,
  rejectLocalTask,
  escalateLocalOpsByEmployee,
} from "@/lib/localOpsFallback";
import { isLocalPreviewActive } from "@/lib/localPreview";
import OpsNewTaskModal from "@/components/tasks/OpsNewTaskModal";
import OpsReassignModal from "@/components/tasks/OpsReassignModal";
import OpsTransferModal from "@/components/tasks/OpsTransferModal";
import OpsDeleteModal from "@/components/tasks/OpsDeleteModal";
import OpsModeConfirmModal from "@/components/tasks/OpsModeConfirmModal";
import OpsTaskDetail from "@/components/tasks/OpsTaskDetail";
import OpsTasksTable, { OpsTaskCards } from "@/components/tasks/OpsTasksTable";
import OpsToolbarStrip, { OpsControlBar } from "@/components/tasks/OpsToolbarStrip";
import DailyPaceStrip from "@/components/tasks/DailyPaceStrip";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { pageKicker } from "@/lib/moduleMeta";
import { useRailSide } from "@/lib/railSide";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import ProofSurfaceNote from "@/components/proof/ProofSurfaceNote";
import OpsLaneTiles from "@/components/tasks/OpsLaneTiles";
import {
  INK,
  MUTED,
  dialogCard,
  dialogOverlay,
  statusBanner,
  textarea,
  ui,
} from "@/lib/platformStyles";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import useStationScope from "@/hooks/useStationScope";
import { Link } from "react-router-dom";

const warnBanner = statusBanner.warn;

/**
 * A named server refusal is final. Retrying it through the local fallback would
 * turn a deliberate block into a local write, so refusals are tagged and the
 * offline path only ever answers transport failures.
 */
function opsRefusal(body) {
  const err = new Error(body?.reason || body?.reasonEn || body?.error || "Refused");
  err.opsRefusal = true;
  return err;
}

const isOpsRefusal = (err) => !!err?.opsRefusal;

/** A refused local board carries no tasks — never let one blank the list. */
const localRefused = (board) => !!board?.error;

const HORIZON_LABEL = {
  y: { ar: "سنوية", en: "Annual" },
  h: { ar: "نصف سنوية", en: "Half-year" },
  q: { ar: "ربعية", en: "Quarterly" },
  m: { ar: "شهرية", en: "Monthly" },
  w: { ar: "أسبوعية", en: "Weekly" },
};

function localTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function asOpsMedia(item) {
  if (!item) return null;
  if (typeof File !== "undefined" && item instanceof File) {
    return { url: URL.createObjectURL(item), name: item.name, type: item.type || "", localOnly: true };
  }
  if (item.url || item.name) {
    return {
      url: item.url || "",
      name: item.name || "file",
      type: item.type || "",
      localOnly: !!item.localOnly || !item.url,
    };
  }
  return null;
}

/**
 * Operations console — counters and gates from
 * base44.functions.invoke("operations", …). No hardcoded KPI literals.
 */
export default function Operations() {
  const { lang, dir, t } = useI18n();
  const ar = lang === "ar";
  const { currentUser, company, data, refresh } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serviceDown, setServiceDown] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [filter, setFilter] = useState("all");
  const headerScope = useStationScope();
  const scope = headerScope || "all";
  const [viewMode, setViewMode] = useState("list");
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [endDelegationFor, setEndDelegationFor] = useState(null);
  const [endDelegationReason, setEndDelegationReason] = useState("");
  const [reassignFor, setReassignFor] = useState(null);
  const [transferFor, setTransferFor] = useState(null);
  const [deleteFor, setDeleteFor] = useState(null);
  const [modeFor, setModeFor] = useState(null);
  const [checkedIn, setCheckedIn] = useState(null);
  const [attendanceGate, setAttendanceGate] = useState(null);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [createdIds, setCreatedIds] = useState([]);
  const [form, setForm] = useState({
    title: "",
    stationId: "",
    stationIds: [],
    ownerId: "",
    ownersByStation: {},
    memberIds: [],
    assignMode: "some",
    dispatchStationId: "",
    priority: "medium",
    effortWeight: 3,
    workKind: "gn",
    workTypeText: "",
    startAt: "",
    dueAt: "",
    targetCount: "",
    mode: "",
    steps: "",
    planPinned: false,
    planHorizon: "w",
    recurrenceKind: "daily",
    recurrenceWeekday: 3,
    recurrenceWeekdays: [3],
    recurrenceTimes: "",
    recurrenceDayMode: "weekday",
    recurrenceMonthDays: [],
    recurrencePickedDays: [],
    recurrenceHorizon: "m",
    recurrenceMonths: "",
    paceMode: "all",
    paceWeekdays: [],
    paceDates: [],
    paceMonthDays: [],
  });

  const ops = useCallback((payload) => base44.functions.invoke("operations", {
    ...payload,
    companyId: company?.id,
    sessionToken: company?.id ? getCompanyToken(company.id) : null,
    lang: ar ? "ar" : "en",
    scope: scope === "all" ? null : scope,
  }), [company?.id, ar, scope]);

  const applyLocalBoard = useCallback((scopeOverride) => {
    const board = buildLocalOpsBoard({
      tasks: data?.tasks || [],
      scope: scopeOverride ?? scope,
      stations: data?.stations || [],
    });
    setTasks(board.tasks);
    setCounts(board.counts);
    setLocalMode(true);
    setServiceDown(false);
    // Local preview has no live attendance service — do not block the board behind a dead gate.
    if (isLocalPreviewActive()) {
      setCheckedIn(true);
      setAttendanceGate(null);
    }
    return board;
  }, [data?.tasks, scope]);

  const reload = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    const hasLocalTasks = Array.isArray(data?.tasks) && data.tasks.length > 0;
    // Once we fall back to local ops (or preview), never let a remote list wipe
    // freshly created tasks that only exist in the company blob yet.
    const preferLocal = isLocalPreviewActive() || localMode;
    try {
      if (preferLocal && hasLocalTasks) {
        applyLocalBoard();
        return;
      }
      const [listRes, attRes] = await Promise.all([
        ops({ action: "list" }),
        ops({ action: "attendanceStatus", employeeId: currentUser?.id || currentUser?.employeeId }),
      ]);
      const body = listRes?.data || listRes;
      const remoteTasks = Array.isArray(body?.tasks) ? body.tasks : [];
      if (!remoteTasks.length && hasLocalTasks) {
        applyLocalBoard();
        return;
      }
      setTasks(remoteTasks);
      setCounts(body?.counts || null);
      const attBody = attRes?.data || attRes || {};
      setCheckedIn(!!attBody.checkedIn);
      setAttendanceGate(attBody.gate || null);
      setServiceDown(false);
      setLocalMode(false);
    } catch {
      if (hasLocalTasks || preferLocal) {
        applyLocalBoard();
      } else {
        setServiceDown(true);
        setLocalMode(false);
        setTasks([]);
        setCounts(null);
      }
    } finally {
      setLoading(false);
    }
  }, [ops, company?.id, ar, currentUser?.id, currentUser?.employeeId, data?.tasks, applyLocalBoard, localMode]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!showCreate) return;
    if (!scope || scope === "all") return;
    setForm((f) => {
      if ((Array.isArray(f.stationIds) && f.stationIds.length) || f.stationId) return f;
      return { ...f, stationId: scope, stationIds: [scope] };
    });
  }, [showCreate, scope]);


  const stations = useMemo(() => {
    const scoped = visibleStations(currentUser, data);
    return scoped.length ? scoped : (data?.stations || []);
  }, [currentUser, data]);
  const createStations = stations;
  const employees = useMemo(
    () => visibleEmployees(currentUser, data),
    [currentUser, data],
  );

  const openTask = tasks.find((t) => t.id === openTaskId) || null;
  const canReview = (task) => canReviewOpsTask(task, currentUser, data);
  const canReassign = (task) => canReassignOpsTask(task, currentUser, data);
  const canEndDelegation = (task) => canEndOpsDelegation(task, currentUser, data);
  useEffect(() => {
    if (!openTask) return;
  }, [openTask?.id, openTask?.mode, openTask?.status, checkedIn, localMode]);
  const reassignCandidates = useMemo(
    () => visibleEmployees(currentUser, data),
    [currentUser, data],
  );

  // The "just created" marker is a pointer, not a state. It lives exactly as long
  // as the undo window, so the row and the toast never disagree.
  useEffect(() => {
    if (!createdIds.length) return undefined;
    const timer = setTimeout(() => setCreatedIds([]), 3 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [createdIds]);

  const offerCreateUndo = (createdRows = []) => {
    const ids = createdRows.map((t) => t?.id).filter(Boolean);
    if (!ids.length) return;
    const ref = createdRows[0]?.ref || "";
    toast({
      title: ids.length > 1
        ? (ar ? `أُنشئت ${ids.length} مهام` : `${ids.length} tasks created`)
        : (ar ? `أُنشئت المهمة${ref ? ` · ${ref}` : ""}` : `Task created${ref ? ` · ${ref}` : ""}`),
      description: ar
        ? "ظهرت في القائمة معلَّمة بخط أخضر. يمكنك التراجع والحذف خلال 3 دقائق."
        : "It is in the list with a green marker. You can undo and delete within 3 minutes.",
      duration: 3 * 60 * 1000,
      action: (
        <span style={{ display: "inline-flex", gap: 6 }}>
          {ids.length === 1 ? (
            <ToastAction
              altText={ar ? "افتح المهمة" : "Open the task"}
              onClick={() => setOpenTaskId(ids[0])}
            >
              {ar ? "افتح" : "Open"}
            </ToastAction>
          ) : null}
          <ToastAction
            altText={ar ? "تراجع" : "Undo"}
            onClick={() => deleteTasks(ids, {
              undoCreate: true,
              reason: ar ? "تراجع عن الإنشاء خلال المهلة" : "Undid creation within the window",
              ack: true,
            })}
          >
            {ar ? "تراجع · حذف" : "Undo · delete"}
          </ToastAction>
        </span>
      ),
    });
  };

  /** Creation notice, not a gate: it says only what logCompletion actually refuses.
   *  A `cite`-level notice is reference for a span the ban never reaches, so it
   *  stays on the card and does not interrupt with a toast. */
  const announceHeatNotice = (notice) => {
    if (!notice || notice.level === "cite") return;
    toast({
      title: `${ar ? "حظر العمل تحت أشعة الشمس" : "Midday sun ban"} · ${ar ? notice.labelAr : notice.labelEn}`,
      description: ar ? notice.textAr : notice.textEn,
    });
  };

  const finishCreateUi = (ref, count = 1, createdRows = []) => {
    // The create form closes and nothing else opens on top of it. Opening the new
    // task's detail here looked identical to the form that was just submitted, so
    // people read it as "nothing happened" and submitted again.
    setShowCreate(false);
    setViewMode("list");
    setFilter("all");
    setCreatedIds(createdRows.map((row) => row?.id).filter(Boolean));
    if (createdRows.length) offerCreateUndo(createdRows);
    else {
      toast({
        title: count > 1
          ? (ar ? `أُنشئت ${count} مهام` : `${count} tasks created`)
          : (ar ? "أُنشئت المهمة" : "Task created"),
        description: ref,
      });
    }
    setForm((f) => ({
      ...f,
      title: "",
      workTypeText: "",
      workKind: f.workKind || "gn",
      memberIds: [],
      assignMode: "some",
      dispatchStationId: "",
      steps: "",
      ownerId: "",
      ownersByStation: {},
      stationId: "",
      stationIds: [],
      startAt: "",
      dueAt: "",
      targetCount: "",
      planPinned: false,
      planHorizon: "w",
      recurrenceKind: "daily",
      recurrenceWeekday: 3,
      recurrenceWeekdays: [3],
      recurrenceTimes: "",
      recurrenceDayMode: "weekday",
      recurrenceMonthDays: [],
      recurrencePickedDays: [],
      recurrenceHorizon: "m",
      recurrenceMonths: "",
      paceMode: "all",
      paceWeekdays: [],
      paceDates: [],
      paceMonthDays: [],
    }));
  };

  const createTask = async (e, attachFiles = []) => {
    e.preventDefault();
    if (!isOpsManager) {
      toast({
        title: ar ? "رُفض الإنشاء" : "Create blocked",
        description: ar ? "إنشاء المهام مقصور على المشرفين." : "Only managers can create tasks",
        variant: "destructive",
      });
      return;
    }
    const count = Math.round(Number(form.targetCount));
    if (!Number.isFinite(count) || count < 1) {
      toast({
        title: ar ? "اكتب العدد المستهدف" : "Enter the target count",
        variant: "destructive",
      });
      return;
    }
    const scheduleForm = { ...form, recurrenceKind: "daily" };
    const paceGate = checkTaskPaceFromForm(scheduleForm);
    if (!paceGate.ok) {
      toast({
        title: ar ? paceGate.reason : paceGate.reasonEn,
        variant: "destructive",
      });
      return;
    }
    const startAt = paceGate.startAt;
    const dueAt = paceGate.dueAt;
    const recurrence = taskRecurrenceFromForm(scheduleForm);
    const recGate = checkTaskRecurrenceGate(recurrence, { startAt, dueAt });
    if (!recGate.ok) {
      toast({
        title: ar ? recGate.reason : recGate.reasonEn,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    const homeStationIds = Array.isArray(form.stationIds) && form.stationIds.length
      ? form.stationIds.map(String)
      : (form.stationId ? [String(form.stationId)] : []);
    const dispatchId = String(form.dispatchStationId || "").trim();
    const stationIds = dispatchId && !homeStationIds.includes(dispatchId)
      ? [dispatchId]
      : homeStationIds;
    const assignMode = form.assignMode === "all" ? "all" : "some";
    const crewMemberIds = (data?.employees || [])
      .filter((emp) => homeStationIds.some((sid) => {
        const home = String(emp?.stationId || emp?.station_id || emp?.homeStationId || "");
        if (home === sid) return true;
        const managed = Array.isArray(emp?.managedStations)
          ? emp.managedStations
          : String(emp?.managedStations || "").split(/[،,]/);
        return managed.map(String).map((id) => id.trim()).includes(sid);
      }))
      .map((emp) => String(emp.employeeId || emp.id || ""))
      .filter(Boolean);
    const memberIds = assignMode === "some"
      ? (form.memberIds || []).map(String).filter(Boolean)
      : assignMode === "all"
        ? ((form.memberIds || []).map(String).filter(Boolean).length
          ? (form.memberIds || []).map(String).filter(Boolean)
          : crewMemberIds)
        : [];
    const primaryOwnerId = assignMode === "some" ? (memberIds[0] || null) : null;
    const visitOf = (ownerId, executeId) => {
      const emp = (data?.employees || []).find((e) => {
        const eid = String(e.employeeId || e.id || "");
        return eid && eid === String(ownerId || "");
      });
      return opsVisitorStamp(emp || { homeStationId: homeStationIds[0], stationId: homeStationIds[0] }, executeId);
    };
    const oneVisit = visitOf(primaryOwnerId, stationIds[0] || form.stationId || null);
    const basePayload = {
      title: form.title,
      stationId: stationIds[0] || form.stationId || null,
      stationIds,
      ownerId: primaryOwnerId,
      ownersByStation: undefined,
      memberIds,
      homeStationId: oneVisit.homeStationId,
      visitor: oneVisit.visitor,
      createdBy: currentUser?.id || currentUser?.employeeId || null,
      createdByName: currentUser?.name || "",
      assignMode,
      priority: form.priority,
      effortWeight: form.effortWeight,
      workKind: form.workKind,
      startAt: startAt || null,
      dueAt: dueAt || null,
      targetCount: count,
      mode: form.mode,
      steps: form.steps,
      planPinned: form.planPinned === true,
      planHorizon: form.planHorizon || null,
      attachments: [],
      recurrence: recurrence.kind === "once" ? undefined : recurrence,
      paceDates: formPaceMode(form) === "dates"
        ? listMatchingPaceDays({ startAt, dueAt, dates: form.paceDates })
        : undefined,
      paceWeekdays: formPaceMode(form) === "weekdays"
        ? normalizeWeekdays(form.paceWeekdays)
        : undefined,
    };

    const buildOnePayloads = (fileAttachments) => [{ ...basePayload, attachments: fileAttachments }];

    const applyCreatedLocally = (board, count = 1) => {
      setLocalMode(true);
      const scoped = buildLocalOpsBoard({
        tasks: board.tasks,
        scope,
        stations: data?.stations || [],
      });
      setTasks(scoped.tasks);
      setCounts(scoped.counts);
      const created = (board.tasks || []).filter((t) => !isOpsTaskDeleted(t)).slice(0, count);
      finishCreateUi(board.tasks?.[0]?.ref, count, created);
      announceHeatNotice(board.heatNotice);
    };

    let attachments = [];
    try {
      const items = attachFiles || [];
      if (!localMode && !isLocalPreviewActive()) {
        for (const item of items) {
          if (item?.url) {
            attachments.push({
              url: item.url,
              name: item.name || "voice",
              type: item.type || undefined,
            });
            continue;
          }
          if (!(item instanceof File) && !item?.name) continue;
          const up = await base44.integrations.Core.UploadFile({ file: item });
          attachments.push({
            url: up.file_url,
            name: item.name,
            type: item.type || undefined,
          });
        }
      } else {
        attachments = items.map((f) => ({
          url: f?.url || "",
          name: f?.name || "attachment",
          type: f?.type || undefined,
          localOnly: !f?.url,
        }));
      }

      const payloads = buildOnePayloads(attachments);

      if (localMode || isLocalPreviewActive()) {
        let board = null;
        for (const payload of payloads) {
          board = createLocalOpsTask(company.id, payload, { employees: data?.employees || [], actor: currentUser, data });
          if (board?.error) {
            toast({
              title: ar ? board.reason : (board.reasonEn || board.reason),
              variant: "destructive",
            });
            return;
          }
        }
        if (!board) throw new Error(ar ? "تعذّر حفظ المهمة محليًا" : "Could not save task locally");
        applyCreatedLocally(board, recGate.windows.length * payloads.length);
        return;
      }

      const res = await ops({
        action: "create",
        ...payloads[0],
        attachments,
      });
      const body = res?.data ?? res ?? {};
      if (body.error === "ASSIGN_GATE") {
        toast({ title: ar ? "بوابة الإسناد" : "Assignment gate", description: body.reason || body.error, variant: "destructive" });
        return;
      }
      if (body.error) {
        toast({ title: ar ? "رُفض الإنشاء" : "Create blocked", description: body.reason || body.error, variant: "destructive" });
        return;
      }

      const mergeCreated = (rows) => {
        const incoming = (Array.isArray(rows) ? rows : []).filter((t) => t && t.id);
        if (!incoming.length) return;
        setTasks((prev) => {
          const ids = new Set(incoming.map((t) => t.id));
          return [...incoming, ...(prev || []).filter((t) => !ids.has(t.id))];
        });
      };

      // Older servers may ignore ownersByStation — fan out client-side if only one task returned.
      let createdRows = Array.isArray(body.tasks) && body.tasks.length
        ? body.tasks
        : (body.task ? [body.task] : []);
      if (payloads.length > 1 && createdRows.length < stationIds.length) {
        let lastRef = createdRows[0]?.ref;
        for (let i = 1; i < payloads.length; i += 1) {
          const extra = await ops({ action: "create", ...payloads[i] });
          const extraBody = extra?.data ?? extra ?? {};
          if (extraBody.error) {
            toast({
              title: ar ? "أُنشئ جزء من المهام فقط" : "Only some tasks were created",
              description: extraBody.reason || extraBody.error,
              variant: "destructive",
            });
            break;
          }
          const extraRows = Array.isArray(extraBody.tasks) && extraBody.tasks.length
            ? extraBody.tasks
            : (extraBody.task ? [extraBody.task] : []);
          createdRows = [...createdRows, ...extraRows];
          lastRef = extraRows[0]?.ref || lastRef;
        }
        mergeCreated(createdRows);
        finishCreateUi(lastRef, createdRows.length, createdRows);
        announceHeatNotice(body.heatNotice);
      } else if (createdRows.length) {
        mergeCreated(createdRows);
        finishCreateUi(createdRows[0]?.ref, createdRows.length, createdRows);
        announceHeatNotice(body.heatNotice);
      } else {
        toast({
          title: ar ? "تعذّر إنشاء المهمة" : "Could not create task",
          description: ar ? "الخادم لم يُرجع المهمة المنشأة" : "Server did not return the created task",
          variant: "destructive",
        });
        return;
      }
      setCounts(body.counts || null);
      await reload();
    } catch (err) {
      if (company?.id && !isOpsRefusal(err) && (isLocalPreviewActive() || localMode || Array.isArray(data?.tasks))) {
        try {
          let board = null;
          let refusal = null;
          for (const payload of buildOnePayloads(attachments)) {
            board = createLocalOpsTask(company.id, payload, { employees: data?.employees || [], actor: currentUser, data });
            if (board?.error) { refusal = board; break; }
          }
          if (refusal) {
            toast({
              title: ar ? "رُفض الإنشاء" : "Create blocked",
              description: ar ? refusal.reason : (refusal.reasonEn || refusal.reason),
              variant: "destructive",
            });
            return;
          }
          if (!board) throw new Error("local create empty");
          applyCreatedLocally(board, recGate.windows.length * buildOnePayloads(attachments).length);
          return;
        } catch {
          /* fall through */
        }
      }
      toast({
        title: ar ? "تعذّر إنشاء المهمة" : "Could not create task",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const logDone = async (task, opts = {}) => {
    setBusy(true);
    const attestation = String(opts.attestation || "").trim();
    const authorId = currentUser?.id || currentUser?.employeeId || null;
    const authorName = currentUser?.name || "";
    let proofFiles = [];
    try {
      const file = opts.proofFile || null;
      if (file instanceof File && !localMode && !isLocalPreviewActive()) {
        try {
          const up = await base44.integrations.Core.UploadFile({ file });
          proofFiles = [{ url: up.file_url, name: file.name, type: file.type || "" }];
        } catch {
          proofFiles = [asOpsMedia(file)].filter(Boolean);
        }
      } else if (file) {
        proofFiles = [asOpsMedia(file)].filter(Boolean);
      }
      const voice = opts.proofVoice;
      if (voice instanceof File && !localMode && !isLocalPreviewActive()) {
        try {
          const up = await base44.integrations.Core.UploadFile({ file: voice });
          proofFiles = [...proofFiles, { url: up.file_url, name: voice.name, type: voice.type || "audio" }];
        } catch {
          const media = asOpsMedia(voice);
          if (media) proofFiles = [...proofFiles, media];
        }
      } else if (voice) {
        const media = asOpsMedia(voice);
        if (media) proofFiles = [...proofFiles, media];
      }
      const stopReason = String(opts.stopReason || "").trim();
      const amount = Math.max(0, Math.round(Number(opts.amount) || 0));
      const paceNow = deriveDailyTaskPace(taskPaceInput(task));
      const loggedToday = taskPaceLoggedOnDay(task);
      const expected = Math.max(0, Number(paceNow.todayExpected) || 0);
      const afterToday = loggedToday + amount;
      const stopRequired = paceNow.active && expected > 0 && (amount < 1 || amount < expected);
      if (stopRequired && !stopReason) {
        toast({
          title: ar ? "سبب التوقف مطلوب" : "Stop reason required",
          description: afterToday <= 0
            ? (ar ? "إذا توقف العمل اليوم فاكتب السبب قبل التسجيل." : "If work stopped today, write the reason before logging.")
            : (ar ? `أُنجز ${afterToday} من ${expected} — اكتب سبب عدم إكمال حصة اليوم.` : `Logged ${afterToday} of ${expected} — write why today's quota was not finished.`),
          variant: "destructive",
        });
        return false;
      }
      if (amount < 1) {
        if (!stopReason) {
          toast({
            title: ar ? "سبب التوقف مطلوب" : "Stop reason required",
            description: ar ? "التوقف عن العمل اليوم يحتاج سببًا مكتوبًا." : "Stopping work today needs a written reason.",
            variant: "destructive",
          });
          return false;
        }
        const board = logLocalCompletion(company.id, task.id, {
          amount: 0, attestation, proofFiles, authorId, authorName, stopReason,
        });
        if (localRefused(board)) {
          toast({ title: ar ? "رُفض التسجيل" : "Log blocked", description: ar ? board.reason : (board.reasonEn || board.reason), variant: "destructive" });
          return false;
        }
        setLocalMode(true);
        setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
        setCounts(board.counts);
        await refresh?.();
        return true;
      }
      if (!proofFiles.length && !String(attestation || "").trim()) {
        toast({
          title: ar ? "بوابة الإثبات" : "Proof gate",
          description: ar ? "لا نقطة بلا أثر — أرفق صورة أو اكتب إفادة أولًا" : "No point without a trace — attach a photo or write an attestation first",
          variant: "destructive",
        });
        return false;
      }
      if (localMode || isLocalPreviewActive()) {
        const board = logLocalCompletion(company.id, task.id, { amount, attestation, proofFiles, authorId, authorName, stopReason });
        if (localRefused(board)) {
          toast({ title: ar ? "رُفض التسجيل" : "Log blocked", description: ar ? board.reason : (board.reasonEn || board.reason), variant: "destructive" });
          return false;
        }
        setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
        setCounts(board.counts);
        await refresh?.();
        return true;
      }
      const res = await ops({
        action: "logCompletion",
        taskId: task.id,
        amount,
        proofFiles,
        attestation,
        stopReason,
      });
      const body = res?.data || res;
      if (body?.error === "CHECK_IN_REQUIRED") {
        toast({ title: ar ? "بوابة الحضور" : "Attendance gate", description: body.reason || body.error, variant: "destructive" });
        return false;
      }
      if (body?.error === "HEAT_BAN") {
        toast({
          title: `${ar ? "حظر العمل تحت أشعة الشمس" : "Midday sun ban"} · ${ar ? (body.labelAr || "قرار وزاري") : (body.labelEn || "Ministerial decision")}`,
          description: body.reason || body.reasonEn || body.error,
          variant: "destructive",
        });
        return false;
      }
      if (body?.error) throw opsRefusal(body);
      setCounts(body.counts || null);
      await reload();
      return true;
    } catch (err) {
      if (company?.id && !isOpsRefusal(err) && (isLocalPreviewActive() || localMode || Array.isArray(data?.tasks))) {
        try {
          const stop = String(opts.stopReason || "").trim();
          if (!attestation && !opts.proofFile && !opts.proofVoice && !stop) throw err;
          const board = logLocalCompletion(company.id, task.id, {
            amount: Math.max(0, Math.round(Number(opts.amount) || 0)),
            attestation,
            proofFiles,
            authorId,
            authorName,
            stopReason: stop,
          });
          if (localRefused(board)) throw err;
          setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
          setCounts(board.counts);
          await refresh?.();
          return true;
        } catch {
          /* fall through */
        }
      }
      const dataErr = err?.response?.data || err?.data || {};
      toast({
        title: dataErr.error === "CHECK_IN_REQUIRED" ? (ar ? "بوابة الحضور" : "Attendance gate") : (ar ? "فشل التسجيل" : "Log failed"),
        description: dataErr.reason || dataErr.error || err.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const extendDue = async (task, opts = {}) => {
    if (!canReview(task) && !canReassign(task)) {
      toast({
        title: ar ? "صلاحية المدير" : "Manager right",
        description: ar ? "تمديد الأيام أو التوزيع من صلاحية المدير." : "Extending days or redistributing is a manager action.",
        variant: "destructive",
      });
      return false;
    }
    const dueAt = String(opts.dueAt || "").trim().slice(0, 10);
    const reason = String(opts.reason || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) {
      toast({
        title: ar ? "موعد مطلوب" : "Due required",
        description: ar ? "اختر موعد استحقاق جديد." : "Pick a new due date.",
        variant: "destructive",
      });
      return false;
    }
    if (!reason) {
      toast({
        title: ar ? "سبب العائق مطلوب" : "Blocker reason required",
        description: ar ? "اكتب سبب عدم إنجاز حصة اليوم قبل التمديد." : "Write why today's quota was not met before extending.",
        variant: "destructive",
      });
      return false;
    }
    setBusy(true);
    try {
      const blockerOpts = {
        expected: opts.expected,
        logged: opts.logged,
        gap: opts.gap,
        blockerDay: opts.day || opts.blockerDay,
      };
      if (localMode || isLocalPreviewActive()) {
        const board = extendLocalOpsDue(company.id, task.id, {
          dueAt,
          reason,
          reviewer: currentUser,
          lang: ar ? "ar" : "en",
          ...blockerOpts,
        });
        setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
        setCounts(board.counts);
        await refresh?.();
        toast({ title: ar ? "عائق · مُدّد الموعد" : "Blocker · due extended", description: dueAt });
        return true;
      }
      const res = await ops({
        action: "extendDue",
        taskId: task.id,
        dueAt,
        reason,
        lang: ar ? "ar" : "en",
        ...blockerOpts,
      });
      const body = res?.data || res;
      if (body?.error) throw opsRefusal(body);
      setCounts(body.counts || null);
      await reload();
      toast({ title: ar ? "عائق · مُدّد الموعد" : "Blocker · due extended", description: dueAt });
      return true;
    } catch (err) {
      if (company?.id && !isOpsRefusal(err) && (isLocalPreviewActive() || localMode)) {
        try {
          const board = extendLocalOpsDue(company.id, task.id, {
            dueAt,
            reason,
            reviewer: currentUser,
            lang: ar ? "ar" : "en",
            expected: opts.expected,
            logged: opts.logged,
            gap: opts.gap,
            blockerDay: opts.day || opts.blockerDay,
          });
          setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
          setCounts(board.counts);
          await refresh?.();
          toast({ title: ar ? "عائق · مُدّد الموعد" : "Blocker · due extended", description: dueAt });
          return true;
        } catch {
          /* fall through */
        }
      }
      toast({
        title: ar ? "فشل التمديد" : "Extend failed",
        description: err.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const redistributePace = async (task, opts = {}) => {
    if (!canReview(task) && !canReassign(task)) {
      toast({
        title: ar ? "صلاحية المدير" : "Manager right",
        description: ar ? "توزيع المتبقي على الأيام من صلاحية المدير." : "Redistributing remaining days is a manager action.",
        variant: "destructive",
      });
      return false;
    }
    const reason = String(opts.reason || "").trim();
    if (!reason) {
      toast({
        title: ar ? "سبب العائق مطلوب" : "Blocker reason required",
        description: ar ? "اكتب سبب عدم إنجاز حصة اليوم قبل التوزيع." : "Write why today's quota was not met before redistributing.",
        variant: "destructive",
      });
      return false;
    }
    setBusy(true);
    try {
      const blockerOpts = {
        expected: opts.expected,
        logged: opts.logged,
        gap: opts.gap,
        blockerDay: opts.day || opts.blockerDay,
      };
      if (localMode || isLocalPreviewActive()) {
        const board = redistributeLocalOpsPace(company.id, task.id, {
          reason,
          reviewer: currentUser,
          lang: ar ? "ar" : "en",
          ...blockerOpts,
        });
        setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
        setCounts(board.counts);
        await refresh?.();
        toast({
          title: ar ? "عائق · وُزِّع المتبقي" : "Blocker · remainder redistributed",
          description: ar ? "أُعيد تقسيم المتبقي على الأيام من اليوم." : "Remaining count re-split across days from today.",
        });
        return true;
      }
      const res = await ops({
        action: "redistributePace",
        taskId: task.id,
        reason,
        lang: ar ? "ar" : "en",
        ...blockerOpts,
      });
      const body = res?.data || res;
      if (body?.error) throw opsRefusal(body);
      setCounts(body.counts || null);
      await reload();
      toast({
        title: ar ? "عائق · وُزِّع المتبقي" : "Blocker · remainder redistributed",
        description: ar ? "أُعيد تقسيم المتبقي على الأيام من اليوم." : "Remaining count re-split across days from today.",
      });
      return true;
    } catch (err) {
      if (company?.id && !isOpsRefusal(err) && (isLocalPreviewActive() || localMode)) {
        try {
          const board = redistributeLocalOpsPace(company.id, task.id, {
            reason,
            reviewer: currentUser,
            lang: ar ? "ar" : "en",
            expected: opts.expected,
            logged: opts.logged,
            gap: opts.gap,
            blockerDay: opts.day || opts.blockerDay,
          });
          setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
          setCounts(board.counts);
          await refresh?.();
          toast({
            title: ar ? "عائق · وُزِّع المتبقي" : "Blocker · remainder redistributed",
            description: ar ? "أُعيد تقسيم المتبقي على الأيام من اليوم." : "Remaining count re-split across days from today.",
          });
          return true;
        } catch {
          /* fall through */
        }
      }
      toast({
        title: ar ? "فشل التوزيع" : "Redistribute failed",
        description: err.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addComment = async (task, text, isIssue, files = [], requestedDueAt = null) => {
    const trimmed = String(text || "").trim();
    const extra = files && !Array.isArray(files) ? files : null;
    const attachments = (Array.isArray(files) ? files : []).map(asOpsMedia).filter(Boolean);
    const dueRequest = requestedDueAt || extra?.requestedDueAt || null;
    if (!trimmed && !attachments.length) return;
    setBusy(true);
    try {
      if (localMode || isLocalPreviewActive()) {
        const board = addLocalOpsComment(company.id, task.id, {
          text: trimmed,
          isIssue,
          files: attachments,
          authorId: currentUser?.id || currentUser?.employeeId || null,
          authorName: currentUser?.name || "",
          requestedDueAt: dueRequest,
        });
        setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
        setCounts(board.counts);
        await refresh?.();
        return;
      }
      const res = await ops({ action: "addComment", taskId: task.id, text: trimmed, isIssue, files: attachments, requestedDueAt: dueRequest });
      const body = res?.data || res;
      if (body?.error) throw opsRefusal(body);
      await reload();
    } catch (err) {
      if (company?.id && !isOpsRefusal(err) && (isLocalPreviewActive() || localMode || Array.isArray(data?.tasks))) {
        try {
          const board = addLocalOpsComment(company.id, task.id, {
            text: trimmed,
            isIssue,
            files: attachments,
            authorId: currentUser?.id || currentUser?.employeeId || null,
            authorName: currentUser?.name || "",
            requestedDueAt: dueRequest,
          });
          setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
          setCounts(board.counts);
          await refresh?.();
          return;
        } catch {
          /* fall through */
        }
      }
      toast({ title: ar ? "فشل الإرسال" : "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const deleteComment = async (task, commentId) => {
    if (!commentId) return;
    setBusy(true);
    try {
      if (localMode || isLocalPreviewActive()) {
        const board = deleteLocalOpsComment(company.id, task.id, commentId, {
          actorId: currentUser?.id || currentUser?.employeeId,
          actorIds: [currentUser?.id, currentUser?.employeeId].filter(Boolean),
        });
        setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
        setCounts(board.counts);
        await refresh?.();
        return;
      }
      const res = await ops({ action: "deleteComment", taskId: task.id, commentId });
      const body = res?.data || res;
      if (body?.error) throw opsRefusal(body);
      await reload();
    } catch (err) {
      if (company?.id && !isOpsRefusal(err) && (isLocalPreviewActive() || localMode || Array.isArray(data?.tasks))) {
        try {
          const board = deleteLocalOpsComment(company.id, task.id, commentId, {
          actorId: currentUser?.id || currentUser?.employeeId,
          actorIds: [currentUser?.id, currentUser?.employeeId].filter(Boolean),
        });
          setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
          setCounts(board.counts);
          await refresh?.();
          return;
        } catch {
          /* fall through */
        }
      }
      toast({ title: ar ? "تعذّر الحذف" : "Could not delete", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const deleteTasks = async (ids, { reason = "", ack = false, undoCreate = false } = {}) => {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (!list.length || !company?.id) return false;
    setBusy(true);
    const why = String(reason || "").trim();
    const reviewer = {
      id: currentUser?.id || currentUser?.employeeId,
      employeeId: currentUser?.employeeId || currentUser?.id,
      name: currentUser?.name || currentUser?.full_name || currentUser?.fullName || "",
      role: currentUser?.role,
      isOwner: currentUser?.isOwner,
      admin: currentUser?.admin,
    };
    const loggedAny = list.some((id) => (Number((tasks.find((t) => t.id === id) || {}).completedCount) || 0) > 0);
    const applyLocal = () => {
      let board = null;
      for (const id of list) {
        board = deleteLocalOpsTask(company.id, id, {
          reviewer,
          reason: why,
          ack,
          undoCreate,
        });
      }
      if (board) {
        setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
        setCounts(board.counts);
      }
      return board;
    };
    try {
      if (localMode || isLocalPreviewActive()) {
        applyLocal();
        setOpenTaskId(null);
        setDeleteFor(null);
        toast({
          title: ar ? "حُذفت المهمة" : "Task deleted",
          description: loggedAny
            ? (ar ? "الإنجاز المسجّل يبقى في الأرشيف وسجل التدقيق." : "Logged progress stays in the archive and audit trail.")
            : (ar ? "بقيت في الأرشيف مع السبب." : "Kept in the archive with the reason."),
        });
        await refresh?.();
        return true;
      }
      for (const id of list) {
        const res = await ops({
          action: "delete",
          taskId: id,
          reason: why,
          ack,
          undoCreate,
        });
        const body = res?.data || res;
        if (body?.error) throw opsRefusal(body);
        if (body?.task) {
          setTasks((prev) => prev.map((t) => (t.id === id ? body.task : t)));
        }
      }
      setOpenTaskId(null);
      setDeleteFor(null);
      toast({
        title: ar ? "حُذفت المهمة" : "Task deleted",
        description: loggedAny
          ? (ar ? "الإنجاز المسجّل يبقى في الأرشيف وسجل التدقيق." : "Logged progress stays in the archive and audit trail.")
          : (ar ? "بقيت في الأرشيف مع السبب." : "Kept in the archive with the reason."),
      });
      await reload();
      return true;
    } catch (err) {
      if (company?.id && !isOpsRefusal(err) && (isLocalPreviewActive() || localMode || Array.isArray(data?.tasks))) {
        try {
          applyLocal();
          setOpenTaskId(null);
          setDeleteFor(null);
          toast({
            title: ar ? "حُذفت المهمة" : "Task deleted",
            description: loggedAny
              ? (ar ? "الإنجاز المسجّل يبقى في الأرشيف وسجل التدقيق." : "Logged progress stays in the archive and audit trail.")
              : (ar ? "بقيت في الأرشيف مع السبب." : "Kept in the archive with the reason."),
          });
          await refresh?.();
          return true;
        } catch (localErr) {
          toast({
            title: ar ? "تعذّر الحذف" : "Could not delete",
            description: localErr.reason || localErr.message,
            variant: "destructive",
          });
          return false;
        }
      }
      toast({ title: ar ? "تعذّر الحذف" : "Could not delete", description: err.message, variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addAttachment = async (task, file, replaceId = null) => {
    if (!file) return;
    setBusy(true);
    const reviewer = { id: currentUser?.id || currentUser?.employeeId, name: currentUser?.name || "" };
    const applyLocal = (url, name, type) => {
      const board = replaceId
        ? replaceLocalOpsAttachment(company.id, task.id, replaceId, { url, name, type, localOnly: !url }, { reviewer, seed: task })
        : addLocalOpsAttachment(company.id, task.id, { url, name, type }, { reviewer, seed: task });
      setLocalMode(true);
      setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
      setCounts(board.counts);
    };
    try {
      let url = "";
      let name = file.name || "file";
      let type = file.type || "";
      if (file instanceof File && !localMode && !isLocalPreviewActive()) {
        try {
          const up = await base44.integrations.Core.UploadFile({ file });
          url = up.file_url;
        } catch {
          url = URL.createObjectURL(file);
        }
      } else {
        const media = asOpsMedia(file);
        url = media?.url || "";
        name = media?.name || name;
        type = media?.type || type;
      }
      if (!localMode && !isLocalPreviewActive() && /^https?:/i.test(url) && !replaceId) {
        const res = await ops({ action: "addAttachment", taskId: task.id, url, name });
        const body = res?.data || res;
        if (body?.error) throw opsRefusal(body);
        await reload();
        return;
      }
      applyLocal(url, name, type);
    } catch (err) {
      try {
        const media = asOpsMedia(file);
        applyLocal(media?.url || "", media?.name || file.name, media?.type || file.type);
      } catch {
        toast({ title: ar ? "فشل المرفق" : "Attachment failed", description: err.message, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  const saveSteps = async (task, text) => {
    setBusy(true);
    try {
      const board = updateLocalOpsSteps(company.id, task.id, text, {
        reviewer: { id: currentUser?.id || currentUser?.employeeId, name: currentUser?.name || "" },
        seed: task,
      });
      setLocalMode(true);
      setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
      setCounts(board.counts);
    } catch (err) {
      toast({ title: ar ? "تعذّر حفظ الخطوات" : "Could not save steps", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const setMode = async (task, mode, { reason } = {}) => {
    const modeGate = checkTaskModeGate(mode, ar ? "ar" : "en");
    if (!modeGate.ok) {
      toast({
        title: ar ? "مكان التنفيذ" : "Where the work happens",
        description: ar ? modeGate.reason : modeGate.reasonEn,
        variant: "destructive",
      });
      return false;
    }
    const next = modeGate.mode;
    setBusy(true);
    const applyLocal = () => {
      const board = setLocalTaskMode(company.id, task.id, next, {
        reason,
        reviewer: currentUser,
        seed: task,
      });
      if (localRefused(board)) throw opsRefusal(board);
      setLocalMode(true);
      setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
      setCounts(board.counts);
      const applied = (board.tasks || []).find((t) => String(t.id) === String(task.id));
      return applied?.mode || next;
    };
    const modeToast = (value) => toast({
      title: `${ar ? "مكان التنفيذ" : "Where the work happens"}: ${taskModeLabel(value, ar ? "ar" : "en")}`,
      description: value === "field"
        ? (ar ? "يخضع لحظر العمل تحت أشعة الشمس عند تسجيل الإنجاز." : "Logging a completion falls under the midday sun ban.")
        : undefined,
    });
    try {
      if (localMode || isLocalPreviewActive()) {
        modeToast(applyLocal());
        return true;
      }
      const res = await ops({ action: "setTaskMode", taskId: task.id, mode: next, reason: String(reason || "").trim() });
      const body = res?.data || res;
      if (body?.error) throw opsRefusal(body);
      await reload();
      modeToast(next);
      return true;
    } catch (err) {
      let failure = err;
      if (company?.id && !isOpsRefusal(err)) {
        try {
          modeToast(applyLocal());
          return true;
        } catch (localErr) {
          if (isOpsRefusal(localErr)) failure = localErr;
        }
      }
      toast({ title: ar ? "تعذّر تغيير المكان" : "Place change failed", description: failure.message, variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const approve = async (task) => {
    if (!canReview(task)) {
      toast({
        title: ar ? "ليس مستواك" : "Not your level",
        description: ar
          ? "الاعتماد لهذا المستوى في سلسلة التصعيد — ليس من صلاحيتك الآن."
          : "Approval belongs to the current chain level — not yours right now.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      if (localMode || isLocalPreviewActive()) {
        const body = approveLocalTask(company.id, task.id, { reviewer: currentUser, data });
        if (localRefused(body)) {
          toast({ title: ar ? "رُفض الاعتماد" : "Approve blocked", description: ar ? body.reason : (body.reasonEn || body.reason), variant: "destructive" });
          return;
        }
        setTasks(buildLocalOpsBoard({ tasks: body.tasks, scope, stations: data?.stations || [] }).tasks);
        setCounts(body.counts);
        await refresh?.();
        toast({
          title: ar ? "اعتُمد الإنجاز" : "Approved",
          description: ar
            ? `مُنحت ${body?.awarded?.points ?? taskPoints(task.priority, task.effortWeight)} نقطة — تظهر في الأداء`
            : `Granted ${body?.awarded?.points ?? taskPoints(task.priority, task.effortWeight)} points — visible in Performance`,
        });
        return;
      }
      const res = await ops({ action: "approve", taskId: task.id });
      const body = res?.data || res;
      if (body?.error) throw opsRefusal(body);
      if (company?.id) await syncPointsFromCloud(company.id);
      await refresh?.();
      toast({
        title: ar ? "اعتُمد الإنجاز" : "Approved",
        description: ar
          ? `مُنحت ${body?.awarded?.points ?? taskPoints(task.priority, task.effortWeight)} نقطة — تظهر في الأداء`
          : `Granted ${body?.awarded?.points ?? taskPoints(task.priority, task.effortWeight)} points — visible in Performance`,
      });
      setCounts(body.counts || null);
      await reload();
    } catch (err) {
      if (company?.id && !isOpsRefusal(err) && (isLocalPreviewActive() || localMode)) {
        try {
          const body = approveLocalTask(company.id, task.id, { reviewer: currentUser, data });
          if (localRefused(body)) throw err;
          setTasks(buildLocalOpsBoard({ tasks: body.tasks, scope, stations: data?.stations || [] }).tasks);
          setCounts(body.counts);
          await refresh?.();
          toast({
            title: ar ? "اعتُمد الإنجاز" : "Approved",
            description: ar
              ? `مُنحت ${body?.awarded?.points ?? taskPoints(task.priority, task.effortWeight)} نقطة — تظهر في الأداء`
              : `Granted ${body?.awarded?.points ?? taskPoints(task.priority, task.effortWeight)} points — visible in Performance`,
          });
          return;
        } catch {
          /* fall through */
        }
      }
      toast({ title: ar ? "فشل الاعتماد" : "Approve failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toastRejectOutcome = (taskAfter) => {
    const n = opsRejectionCount(taskAfter || {});
    toast({
      title: ar ? "أُعيدت للمنفّذ" : "Returned to executor",
      description: n >= 3
        ? (ar ? "هذا الرفض الثالث — يحق للمنفّذ التصعيد للمستوى التالي." : "Third reject — the executor may now escalate to the next level.")
        : (ar ? `رُفض الإنجاز (${n}/3). بعد ثلاثة رفض يحق للمنفّذ التصعيد.` : `Rejected (${n}/3). After three rejects the executor may escalate.`),
    });
  };

  const reject = async (taskOverride, reasonOverride) => {
    const target = taskOverride || rejectFor;
    const reason = String(reasonOverride ?? rejectReason).trim();
    if (!target || !reason) return;
    setBusy(true);
    try {
      if (localMode || isLocalPreviewActive()) {
        const body = rejectLocalTask(company.id, target.id, reason, { reviewer: currentUser, data });
        if (localRefused(body)) {
          toast({ title: ar ? "رُفض الإجراء" : "Reject blocked", description: ar ? body.reason : (body.reasonEn || body.reason), variant: "destructive" });
          return;
        }
        setTasks(buildLocalOpsBoard({ tasks: body.tasks, scope, stations: data?.stations || [] }).tasks);
        setCounts(body.counts);
        toastRejectOutcome((body.tasks || []).find((t) => t.id === target.id) || body.task);
        setRejectFor(null);
        setRejectReason("");
        await refresh?.();
        return;
      }
      const res = await ops({ action: "reject", taskId: target.id, reason });
      const body = res?.data || res;
      if (body?.error) throw opsRefusal(body);
      toastRejectOutcome(body.task);
      setRejectFor(null);
      setRejectReason("");
      setCounts(body.counts || null);
      await reload();
    } catch (err) {
      if (company?.id && !isOpsRefusal(err) && (isLocalPreviewActive() || localMode || Array.isArray(data?.tasks))) {
        try {
          const body = rejectLocalTask(company.id, target.id, reason, { reviewer: currentUser, data });
          if (localRefused(body)) throw err;
          setTasks(buildLocalOpsBoard({ tasks: body.tasks, scope, stations: data?.stations || [] }).tasks);
          setCounts(body.counts);
          setLocalMode(true);
          toastRejectOutcome((body.tasks || []).find((t) => t.id === target.id) || body.task);
          setRejectFor(null);
          setRejectReason("");
          await refresh?.();
          return;
        } catch {
          /* fall through */
        }
      }
      toast({ title: ar ? "فشل الرفض" : "Reject failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const employeeEscalate = async (task, reason) => {
    const why = String(reason || "").trim();
    if (!task || !why) return;
    setBusy(true);
    try {
      if (localMode || isLocalPreviewActive()) {
        const body = escalateLocalOpsByEmployee(company.id, task.id, why, { actor: currentUser, data });
        setTasks(buildLocalOpsBoard({ tasks: body.tasks, scope, stations: data?.stations || [] }).tasks);
        setCounts(body.counts);
        toast({
          title: ar ? "صُعّد الطلب" : "Escalated",
          description: ar ? "انتقلت المراجعة للمستوى التالي بعد ثلاثة رفض." : "Review moved to the next level after three rejects.",
        });
        await refresh?.();
        return;
      }
      const res = await ops({ action: "employeeEscalate", taskId: task.id, reason: why, lang: ar ? "ar" : "en" });
      const body = res?.data || res;
      if (body?.error) throw opsRefusal(body);
      setCounts(body.counts || null);
      toast({
        title: ar ? "صُعّد الطلب" : "Escalated",
        description: ar ? "انتقلت المراجعة للمستوى التالي بعد ثلاثة رفض." : "Review moved to the next level after three rejects.",
      });
      await reload();
    } catch (err) {
      if (company?.id && !isOpsRefusal(err) && (isLocalPreviewActive() || localMode || Array.isArray(data?.tasks))) {
        try {
          const body = escalateLocalOpsByEmployee(company.id, task.id, why, { actor: currentUser, data });
          setTasks(buildLocalOpsBoard({ tasks: body.tasks, scope, stations: data?.stations || [] }).tasks);
          setCounts(body.counts);
          setLocalMode(true);
          toast({
            title: ar ? "صُعّد الطلب" : "Escalated",
            description: ar ? "انتقلت المراجعة للمستوى التالي بعد ثلاثة رفض." : "Review moved to the next level after three rejects.",
          });
          await refresh?.();
          return;
        } catch {
          /* fall through */
        }
      }
      toast({ title: ar ? "تعذّر التصعيد" : "Escalation failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const applyLocalReassign = (task, { toId, reason, delegatedAt, actingUntil, kind = "delegate" }) => {
    const board = reassignLocalOpsTask(company.id, task.id, {
      toId,
      reason,
      kind,
      delegatedAt,
      actingUntil,
      reviewer: currentUser,
      data,
      employees: reassignCandidates,
      lang: ar ? "ar" : "en",
      task,
    });
    setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
    setCounts(board.counts);
    setReassignFor(null);
    setTransferFor(null);
    return board;
  };

  const reassign = async (task, { toId, reason, delegatedAt, actingUntil, kind = "delegate" }) => {
    if (!task || !toId || !String(reason || "").trim() || !String(delegatedAt || "").slice(0, 10)) return;
    if (kind !== "transfer" && !String(actingUntil || "").slice(0, 10)) return;
    setBusy(true);
    const preview = isLocalPreviewActive() || localMode;
    const successTitle = kind === "transfer"
      ? (ar ? "نُقلت المهمة" : "Task transferred")
      : (ar ? "وُكِّلت المهمة" : "Task delegated");
    try {
      if (preview) {
        applyLocalReassign(task, { toId, reason, delegatedAt, actingUntil, kind });
        await refresh?.();
        toast({ title: successTitle });
        return;
      }
      const res = await ops({
        action: "reassign",
        taskId: task.id,
        toId,
        reason,
        kind,
        delegatedAt: String(delegatedAt).slice(0, 10),
        ...(kind === "transfer" ? {} : { actingUntil: String(actingUntil).slice(0, 10) }),
      });
      const body = res?.data || res;
      if (body?.error) {
        const err = new Error(body.reason || body.error);
        err.status = res?.status || 400;
        err.code = body.error;
        throw err;
      }
      setCounts(body.counts || null);
      setReassignFor(null);
      setTransferFor(null);
      toast({ title: successTitle });
      await reload();
    } catch (err) {
      const code = err?.code || err?.response?.data?.error || "";
      const assignBlocked = code === "ASSIGN_GATE";
      if (company?.id && !assignBlocked) {
        try {
          applyLocalReassign(task, { toId, reason, delegatedAt, actingUntil, kind });
          setLocalMode(true);
          await refresh?.();
          toast({ title: successTitle });
          return;
        } catch (localErr) {
          toast({
            title: kind === "transfer"
              ? (ar ? "تعذّر النقل" : "Transfer failed")
              : (ar ? "تعذّر التوكيل" : "Delegation failed"),
            description: localErr.message,
            variant: "destructive",
          });
          return;
        }
      }
      toast({
        title: kind === "transfer"
          ? (ar ? "تعذّر النقل" : "Transfer failed")
          : (ar ? "تعذّر التوكيل" : "Delegation failed"),
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const stationCrewFor = (task) => {
    const sid = String(task?.stationId || "").trim();
    const homeIdOf = (emp) => String(emp?.stationId || emp?.station_id || emp?.homeStationId || "");
    const isLinkedTo = (emp, want) => {
      if (!want) return true;
      if (homeIdOf(emp) === want) return true;
      const managed = Array.isArray(emp?.managedStations)
        ? emp.managedStations
        : String(emp?.managedStations || "").split(/[،,]/);
      return managed.map(String).map((id) => id.trim()).filter(Boolean).includes(want);
    };
    return (data?.employees || [])
      .filter((emp) => isLinkedTo(emp, sid))
      .map((emp) => ({
        id: String(emp.employeeId || emp.id || ""),
        name: emp.name || "",
      }))
      .filter((m) => m.id);
  };

  const setMembers = async (task, memberIds) => {
    if (!task || !canReassign(task)) {
      toast({
        title: ar ? "غير مسموح" : "Not allowed",
        description: ar
          ? "تغيير المسندين للمدير فقط، وعلى مهمة مفتوحة."
          : "Only a manager can change assignees on an open task.",
        variant: "destructive",
      });
      return false;
    }
    const nextIds = [...new Set((memberIds || []).map(String).filter(Boolean))];
    const prev = taskAssigneeIds(task);
    if (prev.length === nextIds.length && prev.every((id) => nextIds.includes(id))) return true;
    setBusy(true);
    const crew = stationCrewFor(task);
    const applyLocal = () => {
      const board = setLocalOpsMembers(company.id, task.id, {
        memberIds: nextIds,
        reviewer: currentUser,
        data,
        employees: crew.length ? crew : (data?.employees || []),
        lang: ar ? "ar" : "en",
        task,
      });
      setLocalMode(true);
      setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
      setCounts(board.counts);
      return board;
    };
    try {
      if (localMode || isLocalPreviewActive()) {
        applyLocal();
        toast({ title: ar ? "تحدّث المسندون" : "Assignees updated" });
        return true;
      }
      const res = await ops({
        action: "setMembers",
        taskId: task.id,
        memberIds: nextIds,
        lang: ar ? "ar" : "en",
      });
      const body = res?.data || res;
      if (body?.error) {
        const err = new Error(body.reason || body.error);
        err.code = body.error;
        throw err;
      }
      setCounts(body.counts || null);
      toast({ title: ar ? "تحدّث المسندون" : "Assignees updated" });
      await reload();
      return true;
    } catch (err) {
      const code = err?.code || err?.response?.data?.error || "";
      const assignBlocked = code === "ASSIGN_GATE" || code === "REASSIGN_FORBIDDEN" || code === "MEMBERS_REQUIRED" || code === "ASSIGNEE_OUT_OF_SCOPE";
      if (company?.id && !assignBlocked) {
        try {
          applyLocal();
          toast({ title: ar ? "تحدّث المسندون" : "Assignees updated" });
          return true;
        } catch (localErr) {
          toast({
            title: ar ? "تعذّر تحديث المسندين" : "Could not update assignees",
            description: localErr.message,
            variant: "destructive",
          });
          return false;
        }
      }
      toast({
        title: ar ? "تعذّر تحديث المسندين" : "Could not update assignees",
        description: err.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const applyLocalEndDelegation = (task, { reason }) => {
    const board = endLocalOpsDelegation(company.id, task.id, {
      reason,
      reviewer: currentUser,
      data,
      employees: data?.employees || [],
      lang: ar ? "ar" : "en",
      task,
    });
    setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
    setCounts(board.counts);
    return board;
  };

  const endDelegation = async (task, { reason } = {}) => {
    const why = String(reason || "").trim();
    // An audit-bearing reason is captured on the surface, never in a browser prompt.
    if (task && !why) {
      setEndDelegationFor(task);
      setEndDelegationReason("");
      return;
    }
    if (!task || !why) return;
    setBusy(true);
    const preview = isLocalPreviewActive() || localMode;
    try {
      if (preview) {
        applyLocalEndDelegation(task, { reason: why });
        await refresh?.();
        setEndDelegationFor(null);
        setEndDelegationReason("");
        toast({ title: ar ? "أُنهيت الوكالة" : "Delegation ended" });
        return;
      }
      const res = await ops({
        action: "endDelegation",
        taskId: task.id,
        reason: why,
      });
      const body = res?.data || res;
      if (body?.error) {
        const err = opsRefusal(body);
        err.code = body.error;
        throw err;
      }
      setCounts(body.counts || null);
      setEndDelegationFor(null);
      setEndDelegationReason("");
      toast({ title: ar ? "أُنهيت الوكالة" : "Delegation ended" });
      await reload();
    } catch (err) {
      if (company?.id && !isOpsRefusal(err) && (preview || Array.isArray(data?.tasks))) {
        try {
          applyLocalEndDelegation(task, { reason: why });
          setLocalMode(true);
          await refresh?.();
          setEndDelegationFor(null);
          setEndDelegationReason("");
          toast({ title: ar ? "أُنهيت الوكالة" : "Delegation ended" });
          return;
        } catch (localErr) {
          toast({
            title: ar ? "تعذّر إنهاء الوكالة" : "Could not end delegation",
            description: localErr.message,
            variant: "destructive",
          });
          return;
        }
      }
      toast({
        title: ar ? "تعذّر إنهاء الوكالة" : "Could not end delegation",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const todayKey = localTodayKey();
  const isOpsManager = canCreateTasks(currentUser, data);
  const liveTasks = tasks.filter((t) => !isOpsTaskArchived(t) && canSeeOpsTask(t, currentUser, { isManager: isOpsManager }));
  const archivedTasks = tasks.filter((t) => isOpsTaskArchived(t) && canSeeOpsTask(t, currentUser, { isManager: isOpsManager }));
  const boardFilter = filter === "done" ? "archive" : filter;
  const visible = liveTasks.filter((t) => {
    if (boardFilter === "archive") return false;
    if (boardFilter === "all") return true;
    if (boardFilter === "overdue") return isOverdue(t);
    if (boardFilter === "today") return t.dueAt && String(t.dueAt).slice(0, 10) === todayKey;
    if (boardFilter === "awaiting") return isAwaitingApproval(t);
    if (boardFilter === "escalated") return isEscalated(t);
    return true;
  });
  const boardPace = deriveBoardDailyPace(liveTasks);

  // Chips must count what this viewer can actually open — company-wide totals
  // would promise an employee rows they are not allowed to see.
  const c = isOpsManager ? counts : deriveOpsCounts(liveTasks);
  const chips = c ? [
    { id: "all", label: ar ? `الكل · ${c.total}` : `All · ${c.total}` },
    { id: "overdue", label: ar ? `متأخرة · ${c.overdue}` : `Overdue · ${c.overdue}` },
    { id: "today", label: ar ? `اليوم · ${c.today}` : `Today · ${c.today}` },
    { id: "awaiting", label: ar ? `بانتظار الاعتماد · ${c.awaiting}` : `Awaiting · ${c.awaiting}` },
    { id: "escalated", label: ar ? `صُعّدت · ${c.escalated || 0}` : `Escalated · ${c.escalated || 0}` },
    { id: "archive", label: ar ? `الأرشيف · ${archivedTasks.length}` : `Archive · ${archivedTasks.length}` },
  ] : [];

  const stationName = (id) => stations.find((s) => s.id === id)?.name || "—";
  const ownerName = (task) => {
    const people = data?.employees || [];
    const match = (id) => {
      const want = String(id || "").trim();
      if (!want) return "";
      const emp = people.find((e) => String(e.id || "") === want || String(e.employeeId || "") === want);
      return String(emp?.name || "").trim();
    };
    const named = match(task.ownerId || task.employee_id) || String(task.ownerName || task.assigneeName || "").trim();
    if (named && !/^فريق/.test(named) && !/^Team\b/i.test(named) && !/^Station team/i.test(named)) return named;
    const members = Array.isArray(task.memberIds) ? task.memberIds.map(String).filter(Boolean) : [];
    for (const id of members) {
      const name = match(id);
      if (name) return name;
    }
    return named || "—";
  };
  const homeStationOf = (task) => {
    if (task?.homeStationId) return String(task.homeStationId);
    const id = String(task?.ownerId || task?.employee_id || "");
    if (!id) return "";
    const emp = (data?.employees || []).find((e) => String(e.id || "") === id || String(e.employeeId || "") === id);
    return String(emp?.stationId || emp?.station_id || "");
  };
  const ownerInitials = (name) => String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
  const creatorName = (task) => taskCreatorName(task, data?.employees || []);
  const archiveItems = archivedTasks.map((t) => {
    const doneN = Math.max(0, Number(t.completedCount) || 0);
    const targetN = Math.max(1, Number(t.targetCount) || 1);
    return {
      id: t.id,
      title: t.title,
      text: [
        t.ref,
        stationName(t.stationId),
        taskAssignScopeLabel(t, ar),
        ownerName(t),
        creatorName(t) ? (ar ? `أنشأها ${creatorName(t)}` : `Created by ${creatorName(t)}`) : "",
        t.deletedAt && t.deletedByName ? (ar ? `حذفها ${t.deletedByName}` : `Deleted by ${t.deletedByName}`) : "",
        t.deletedAt && doneN > 0 ? `${doneN}/${targetN}` : "",
        t.deleteReason || "",
      ].filter(Boolean).join(" · "),
      date: t.deletedAt || t.completedAt || t.approvedAt || t.dueAt || t.createdAt,
      badge: t.deletedAt
        ? (ar ? "محذوفة" : "Deleted")
        : (t.status === "completed" || t.approvedAt ? (ar ? "مكتملة" : "Done") : (ar ? "مؤرشفة" : "Archived")),
    };
  });
  const STATUS_LABEL = {
    active: { ar: "نشطة", en: "Active" },
    awaiting_approval: { ar: "بانتظار الاعتماد", en: "Awaiting" },
    completed: { ar: "مكتملة", en: "Done" },
    pending_review: { ar: "مراجعة", en: "Review" },
  };
  const planGroups = deriveHorizonGroups(visible).map((h) => ({
    ...h,
    rows: visible.filter((t) => taskPlanHorizon(t) === h.id),
  }));

  const renderActions = (task) => {
    const logBlocked = task.mode !== "remote" && checkedIn === false;
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setOpenTaskId(task.id)} style={ui.btnMiniSoft}>
            {ar ? "بطاقة" : "Card"}
          </button>
          {task.status !== "completed" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setModeFor({ task, mode: task.mode || "" })}
              style={ui.btnMiniQuiet}
              title={taskModeLabel(task.mode, ar ? "ar" : "en")}
            >
              {taskModeLabel(task.mode, ar ? "ar" : "en")}
            </button>
          )}
          {task.status !== "completed" && !isAwaitingApproval(task) && (
            <button
              type="button"
              disabled={busy || logBlocked}
              onClick={() => setOpenTaskId(task.id)}
              style={{ ...ui.btnMini, opacity: busy || logBlocked ? 0.5 : 1, cursor: busy || logBlocked ? "not-allowed" : "pointer" }}
            >
              {ar ? "سجّل" : "Log"}
            </button>
          )}
          {canReassign(task) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setReassignFor(task)}
              style={ui.btnMini}
            >
              {ar ? "توكيل" : "Delegate"}
            </button>
          )}
          {canReassign(task) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setTransferFor(task)}
              style={ui.btnMiniDanger}
            >
              {ar ? "نقل" : "Transfer"}
            </button>
          )}
          {canDeleteOpsTask(task, currentUser) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeleteFor(task)}
              style={ui.btnMiniDanger}
            >
              {ar ? "حذف" : "Delete"}
            </button>
          )}
          {isAwaitingApproval(task) && canReview(task) && (
            <>
              <button type="button" disabled={busy} onClick={() => approve(task)} style={ui.btnMiniBrand}>
                {ar ? "اعتمد" : "Approve"}
              </button>
              <button type="button" disabled={busy} onClick={() => { setRejectFor(task); setRejectReason(""); }} style={ui.btnMiniDanger}>
                {ar ? "رفض" : "Reject"}
              </button>
            </>
          )}
        </div>
        {logBlocked && task.status !== "completed" && !isAwaitingApproval(task) && (
          <span className="max-w-[220px] text-[10px] leading-snug" style={{ color: "var(--nv-warn-ink)" }}>
            {attendanceGate?.reason || (ar ? "موقوف حتى بصمة اليوم" : "Blocked until today's check-in")}
          </span>
        )}
      </div>
    );
  };

  const kickerNum = String(pageKicker("/app/tasks", "en")).slice(0, 2) || "01";
  const employeeFace = useRailSide() === "employee";
  return (
    <PlatformStampShell
      ar={ar}
      maxWidth={1280}
      kicker={`${kickerNum} · ${ar ? "التشغيل اليومي" : "Daily operations"}`}
      title={employeeFace ? (ar ? "مهامي" : "My tasks") : (ar ? "المهام والعمليات" : "Tasks & operations")}
      hint={ar
        ? "أمر عمل لموظف الشركة. الحضور يفتح التسجيل، والاعتماد يمنح النقاط."
        : "A work order for a company employee. Attendance opens logging; approval awards the points."}
      sections={[
        { value: "list", label: ar ? "قائمة" : "List" },
        { value: "plan", label: ar ? "الخطة" : "Plan" },
      ]}
      tool={viewMode === "plan" ? "plan" : "list"}
      onTool={setViewMode}
    >
      <OpsLaneTiles ar={ar} current="tasks" />
      <ProofSurfaceNote ar={ar} current="tasks" />
      <div className="space-y-3.5">

      <OpsControlBar>
        <OpsToolbarStrip
          ar={ar}
          dir={dir}
          filter={boardFilter}
          onFilterChange={setFilter}
          chips={chips}
          showCreate={showCreate}
          onToggleCreate={() => setShowCreate((v) => !v)}
          canCreate={isOpsManager}
        />
        {boardFilter !== "archive" && boardPace.active > 0 ? <DailyPaceStrip ar={ar} board={boardPace} embedded /> : null}
      </OpsControlBar>

      {!checkedIn && (
      <div style={warnBanner}>
        {attendanceGate?.reason || (ar
            ? "تسجيل الإنجاز الميداني موقوف حتى بصمة اليوم — سجّل حضورك من شاشة الحضور، أو اطلب تحويل المهمة إلى عن بُعد."
            : "On-site logging is blocked until today's check-in — use Attendance, or ask to switch the task to remote.")}
          <Link to="/app/attendance" className="ms-2 underline font-medium">
            {ar ? "الحضور" : "Attendance"}
          </Link>
      </div>
      )}

      {showCreate && isOpsManager && (
        <OpsNewTaskModal
          ar={ar}
          dir={dir}
          form={form}
          setForm={setForm}
          stations={createStations}
          stationTree={data?.stations || []}
          employees={employees}
          busy={busy}
          onClose={() => setShowCreate(false)}
          onSubmit={createTask}
        />
      )}

      {serviceDown && !localMode && (
        <div style={warnBanner}>
          <span className="font-semibold">{ar ? "لوحة المهام غير متصلة · " : "Task board offline · "}</span>
          {ar
            ? "لم تستجب خدمة العمليات، فلا تُعرض المهام ولا تُقبل الإفادات أو الاعتمادات. القائمة الفارغة أدناه ليست انعدام عمل مسند."
            : "The operations service did not respond, so no tasks are shown and no attestation or approval is accepted. The empty list below does not mean no work is assigned."}
        </div>
      )}

      {boardFilter === "archive" ? (
        <RecordSmartArchive
          items={archiveItems}
          lang={lang}
          dir={dir}
          emptyLabel={ar ? "لا مهام مؤرشفة بعد — المكتملة تُنقل إلى هنا تلقائياً بعد الاعتماد." : "No archived tasks yet — completed tasks move here automatically after approval."}
          onOpen={(item) => setOpenTaskId(item.id)}
        />
      ) : viewMode === "plan" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {planGroups.map((g) => (
            <section key={g.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                padding: "2px 2px 0",
              }}
              >
                <div style={{ flex: "1 1 200px", fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 700, color: "#111418" }}>
                  {ar ? HORIZON_LABEL[g.id]?.ar : HORIZON_LABEL[g.id]?.en}
                </div>
                <div style={{ fontSize: 12, color: "#555C66", fontWeight: 600 }}>
                  {ar ? `${g.rows.length} مهام` : `${g.rows.length} tasks`}
                </div>
                <div dir="ltr" style={{ fontSize: 12, color: "#111418", fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums" }}>
                  {g.unitsDone}/{g.unitsTarget}
                </div>
                <span style={{ width: 96, height: 6, borderRadius: 999, background: "#E6F2EA", overflow: "hidden" }}>
                  <span style={{ display: "block", width: `${g.pct || 0}%`, height: "100%", background: "#3C7D50", borderRadius: 999 }} />
                </span>
                <span dir="ltr" style={{ fontSize: 11, color: "#555C66", fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums" }}>
                  {g.pct || 0}%
                </span>
              </div>
              {g.rows.length === 0 ? (
                <div style={{ padding: "14px 16px", fontSize: 12, color: MUTED, background: "#fff", border: "1px dashed #E4E9E6", borderRadius: 12 }}>
                  {ar ? "لا مهام في هذا الأفق ضمن التصفية." : "No tasks in this horizon for the current filter."}
                </div>
              ) : (
                <OpsTaskCards
                  tasks={g.rows.map((task) => ({
                    ...task,
                    homeStationId: task.homeStationId || homeStationOf(task),
                  }))}
                  lang={lang}
                  stationName={stationName}
                  ownerName={ownerName}
                  ownerInitials={ownerInitials}
                  onOpen={(task) => setOpenTaskId(task.id)}
                  createdIds={createdIds}
                  renderActions={renderActions}
                />
              )}
            </section>
          ))}
        </div>
      ) : (
        <OpsTasksTable
          tasks={visible.map((task) => ({
            ...task,
            homeStationId: task.homeStationId || homeStationOf(task),
          }))}
          lang={lang}
          loading={loading}
          serviceDown={serviceDown && !localMode}
          stationName={stationName}
          ownerName={ownerName}
          ownerInitials={ownerInitials}
          onOpen={(task) => setOpenTaskId(task.id)}
          createdIds={createdIds}
          renderActions={renderActions}
        />
      )}

      {openTask && (
        <OpsTaskDetail
          task={{
            ...openTask,
            ownerName: ownerName(openTask),
            createdByName: creatorName(openTask),
            assignScopeLabel: taskAssignScopeLabel(openTask, ar),
            stationName: stationName(openTask.stationId),
            homeStationId: homeStationOf(openTask) || openTask.homeStationId,
            homeStationName: stationName(homeStationOf(openTask)),
          }}
          ar={ar}
          busy={busy}
          canManage={canReview(openTask)}
          canReassign={!isOpsTaskDeleted(openTask) && canReassign(openTask)}
          canEndDelegation={!isOpsTaskDeleted(openTask) && canEndDelegation(openTask)}
          canTransfer={!isOpsTaskDeleted(openTask) && canReassign(openTask)}
          checkedIn={checkedIn}
          attendanceGate={attendanceGate}
          escalationSteps={buildOpsEscalationSteps(openTask, data, t, lang)}
          currentLevelLabel={currentOpsLevelLabel(openTask, data, t, lang)}
          t={t}
          lang={lang}
          onClose={() => setOpenTaskId(null)}
          onLog={(opts) => logDone(openTask, opts)}
          onApprove={() => approve(openTask)}
          onReject={(reason) => reject(openTask, reason)}
          onEmployeeEscalate={(reason) => employeeEscalate(openTask, reason)}
          canEmployeeEscalate={canEmployeeEscalateOpsTask(openTask, currentUser, data)}
          isAssignee={isOpsTaskAssignee(openTask, currentUser)}
          onAddComment={(text, isIssue, files, requestedDueAt) => addComment(openTask, text, isIssue, files, requestedDueAt)}
          onDeleteComment={(commentId) => deleteComment(openTask, commentId)}
          onAddAttachment={(file) => addAttachment(openTask, file)}
          onReplaceAttachment={(id, file) => addAttachment(openTask, file, id)}
          onSaveSteps={(text) => saveSteps(openTask, text)}
          onOpenReassign={() => { const t = openTask; setOpenTaskId(null); setReassignFor(t); }}
          onOpenTransfer={() => { const t = openTask; setOpenTaskId(null); setTransferFor(t); }}
          onEndDelegation={() => { const t = openTask; setOpenTaskId(null); endDelegation(t); }}
          onSetMode={(mode) => { const t = openTask; setOpenTaskId(null); setModeFor({ task: t, mode }); }}
          canEditAssignees={!isOpsTaskDeleted(openTask) && canReassign(openTask)}
          stationMembers={(() => {
            const crew = stationCrewFor(openTask);
            const seen = new Set(crew.map((m) => m.id));
            for (const person of taskAssigneePeople(openTask, data?.employees || [])) {
              const id = String(person.id || "");
              if (!id || seen.has(id)) continue;
              seen.add(id);
              crew.push({ id, name: person.name || id });
            }
            return crew;
          })()}
          onSetMembers={(ids) => setMembers(openTask, ids)}
          onExtendDue={(opts) => extendDue(openTask, opts)}
          onRedistributePace={(opts) => redistributePace(openTask, opts)}
          onOpenDelete={() => { const t = openTask; setOpenTaskId(null); setDeleteFor(t); }}
          onUndoCreate={() => deleteTasks([openTask.id], {
            undoCreate: true,
            reason: ar ? "تراجع عن الإنشاء خلال المهلة" : "Undid creation within the window",
            ack: true,
          })}
          currentUser={currentUser}
          currentUserId={currentUser?.id || currentUser?.employeeId}
          employees={data?.employees || []}
        />
      )}

      {reassignFor && (
        <OpsReassignModal
          task={reassignFor}
          ar={ar}
          employees={reassignCandidates}
          busy={busy}
          onClose={() => setReassignFor(null)}
          onConfirm={(payload) => reassign(reassignFor, payload)}
        />
      )}

      {transferFor && (
        <OpsTransferModal
          task={transferFor}
          ar={ar}
          employees={reassignCandidates}
          busy={busy}
          onClose={() => setTransferFor(null)}
          onConfirm={(payload) => reassign(transferFor, payload)}
        />
      )}

      {deleteFor && (
        <OpsDeleteModal
          task={deleteFor}
          ar={ar}
          busy={busy}
          onClose={() => setDeleteFor(null)}
          onConfirm={({ reason, ack }) => deleteTasks([deleteFor.id], { reason, ack })}
        />
      )}

      {modeFor?.task && (
        <OpsModeConfirmModal
          task={modeFor.task}
          ar={ar}
          busy={busy}
          initialMode={modeFor.mode}
          onClose={() => setModeFor(null)}
          onConfirm={async ({ mode, reason }) => {
            const ok = await setMode(modeFor.task, mode, { reason });
            if (ok) setModeFor(null);
          }}
        />
      )}

      {endDelegationFor && (
        <div style={dialogOverlay} onClick={() => setEndDelegationFor(null)}>
          <div style={dialogCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{ar ? "سبب إنهاء الوكالة" : "Reason for ending the delegation"}</div>
            <p style={{ margin: "6px 0 0", fontSize: 11, lineHeight: 1.7, color: MUTED }}>
              {ar
                ? "إنهاء الوكالة يُعيد المهمة إلى مالكها الأصلي، ويُسجَّل السبب في سجل الإسناد لمن يفتح المهمة."
                : "Ending the delegation returns the task to its original owner, and the reason is recorded in the assignment log."}
            </p>
            <textarea style={{ ...textarea, marginTop: 12 }} rows={3} value={endDelegationReason} onChange={(e) => setEndDelegationReason(e.target.value)} />
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setEndDelegationFor(null)} style={ui.btnSecondary}>{ar ? "إلغاء" : "Cancel"}</button>
              <button
                type="button"
                disabled={busy || !endDelegationReason.trim()}
                onClick={() => endDelegation(endDelegationFor, { reason: endDelegationReason })}
                style={{ ...ui.btnCreate, opacity: busy || !endDelegationReason.trim() ? 0.5 : 1 }}
              >
                {ar ? "تأكيد إنهاء الوكالة" : "Confirm end delegation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectFor && (
        <div style={dialogOverlay} onClick={() => setRejectFor(null)}>
          <div style={dialogCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{ar ? "سبب الرفض" : "Rejection reason"}</div>
            <p style={{ margin: "6px 0 0", fontSize: 11, lineHeight: 1.7, color: MUTED }}>
              {ar
                ? "الرفض يُسجَّل في مراسلات البطاقة ويُعاد للمنفّذ لإثبات أوضح. السبب علني لمن يفتح المهمة. بعد ثلاثة رفض يحق للمنفّذ التصعيد للمستوى التالي."
                : "Reject is recorded on the card thread and returned to the executor. The reason is public to anyone who opens the task. After three rejects the executor may escalate to the next level."}
            </p>
            <textarea style={{ ...textarea, marginTop: 12 }} rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setRejectFor(null)} style={ui.btnSecondary}>{ar ? "إلغاء" : "Cancel"}</button>
              <button type="button" disabled={busy || !rejectReason.trim()} onClick={() => reject()} style={{ ...ui.btnCreate, opacity: busy || !rejectReason.trim() ? 0.5 : 1 }}>
                {ar ? "تأكيد الرفض" : "Confirm reject"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PlatformStampShell>
  );
}
