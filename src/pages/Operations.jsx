import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { base44 } from "@/api/base44Client";
import { getCompanyToken, syncPointsFromCloud } from "@/lib/store";
import {
  canReassignOpsTask,
  canEndOpsDelegation,
  canReviewOpsTask,
  isAwaitingApproval,
  isEscalated,
  isOverdue,
  deriveBoardDailyPace,
  deriveHorizonGroups,
  taskDelegationMeta,
  taskTransferMeta,
  taskPlanHorizon,
  taskPoints,
  taskRecurrenceFromForm,
  checkTaskRecurrenceGate,
  checkTaskPaceFromForm,
  formPaceMode,
  listMatchingPaceDays,
  isOpsTaskDeleted,
  isOpsTaskArchived,
} from "@/lib/opsDerivations";
import { visibleEmployees, visibleStations } from "@/lib/permissions";
import { employeeInStationScope, expandSelectedStationScope } from "@/lib/stationTree";
import { buildOpsEscalationSteps, currentOpsLevelLabel } from "@/lib/opsEscalation";
import {
  approveLocalTask,
  buildLocalOpsBoard,
  createLocalOpsTask,
  deleteLocalOpsTask,
  addLocalOpsComment,
  deleteLocalOpsComment,
  endLocalOpsDelegation,
  extendLocalOpsDue,
  logLocalCompletion,
  reassignLocalOpsTask,
  redistributeLocalOpsPace,
  rejectLocalTask,
} from "@/lib/localOpsFallback";
import { isLocalPreviewActive } from "@/lib/localPreview";
import OpsNewTaskModal from "@/components/tasks/OpsNewTaskModal";
import OpsReassignModal from "@/components/tasks/OpsReassignModal";
import OpsTransferModal from "@/components/tasks/OpsTransferModal";
import OpsTaskDetail from "@/components/tasks/OpsTaskDetail";
import OpsTasksTable from "@/components/tasks/OpsTasksTable";
import OpsToolbarStrip from "@/components/tasks/OpsToolbarStrip";
import OpsAssignmentRefChip from "@/components/tasks/OpsAssignmentRefChip";
import DailyPaceStrip from "@/components/tasks/DailyPaceStrip";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import {
  INK,
  MUTED,
  BORDER,
  BRAND,
  OK,
  WARN,
  NEUTRAL,
  SURFACE,
  dialogCard,
  dialogOverlay,
  statusBanner,
  tableShell,
  textarea,
  ui,
} from "@/lib/platformStyles";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import useStationScope from "@/hooks/useStationScope";
import { Link } from "react-router-dom";

const okBanner = statusBanner.ok;
const warnBanner = statusBanner.warn;

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
  const [reassignFor, setReassignFor] = useState(null);
  const [transferFor, setTransferFor] = useState(null);
  const [checkedIn, setCheckedIn] = useState(null);
  const [attendanceGate, setAttendanceGate] = useState(null);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    stationId: "",
    stationIds: [],
    ownerId: "",
    ownersByStation: {},
    memberIds: [],
    assignMode: "one",
    priority: "medium",
    effortWeight: 3,
    workKind: "gn",
    workTypeText: "",
    startAt: "",
    dueAt: "",
    targetCount: "",
    mode: "onsite",
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

  const stations = useMemo(() => {
    const scoped = visibleStations(currentUser, data);
    return scoped.length ? scoped : (data?.stations || []);
  }, [currentUser, data]);
  const selectedStationIds = useMemo(() => {
    if (Array.isArray(form.stationIds) && form.stationIds.length) return form.stationIds.map(String);
    if (form.stationId) return [String(form.stationId)];
    return [];
  }, [form.stationId, form.stationIds]);
  const employees = useMemo(() => {
    const all = data?.employees || [];
    if (!selectedStationIds.length) return all;
    const scope = new Set(
      expandSelectedStationScope(data?.stations || [], selectedStationIds).map(String),
    );
    return all.filter((e) => employeeInStationScope(e, scope));
  }, [data?.employees, data?.stations, selectedStationIds]);

  const openTask = tasks.find((t) => t.id === openTaskId) || null;
  const canReview = (task) => canReviewOpsTask(task, currentUser, data);
  const canReassign = (task) => canReassignOpsTask(task, currentUser, data);
  const canEndDelegation = (task) => canEndOpsDelegation(task, currentUser, data);
  const reassignCandidates = useMemo(() => {
    const visible = visibleEmployees(currentUser, data);
    const stationId = reassignFor?.stationId || transferFor?.stationId || openTask?.stationId;
    if (!stationId) return visible;
    return visible.filter((emp) => (emp.stationId || null) === stationId || (emp.managedStations || []).includes(stationId));
  }, [currentUser, data, reassignFor?.stationId, transferFor?.stationId, openTask?.stationId]);

  const offerCreateUndo = (createdRows = []) => {
    const ids = createdRows.map((t) => t?.id).filter(Boolean);
    if (!ids.length) return;
    toast({
      title: ids.length > 1
        ? (ar ? `أُنشئت ${ids.length} مهام` : `${ids.length} tasks created`)
        : (ar ? "أُنشئت المهمة" : "Task created"),
      description: ar
        ? "يمكنك التراجع والحذف خلال 3 دقائق."
        : "You can undo and delete within 3 minutes.",
      duration: 3 * 60 * 1000,
      action: (
        <ToastAction
          altText={ar ? "تراجع" : "Undo"}
          onClick={() => deleteTasks(ids)}
        >
          {ar ? "تراجع · حذف" : "Undo · delete"}
        </ToastAction>
      ),
    });
  };

  const finishCreateUi = (ref, count = 1, createdRows = []) => {
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
    }));
    setShowCreate(false);
  };

  const createTask = async (e, attachFiles = []) => {
    e.preventDefault();
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
    const stationIds = Array.isArray(form.stationIds) && form.stationIds.length
      ? form.stationIds.map(String)
      : (form.stationId ? [String(form.stationId)] : []);
    const ownersByStation = form.ownersByStation && typeof form.ownersByStation === "object"
      ? Object.fromEntries(
        Object.entries(form.ownersByStation)
          .map(([sid, oid]) => [String(sid), String(oid || "")])
          .filter(([sid, oid]) => sid && oid),
      )
      : {};
    const oneOwnerId = form.assignMode === "one"
      ? (ownersByStation[stationIds[0]] || form.ownerId || null)
      : null;
    const basePayload = {
      title: form.title,
      stationId: stationIds[0] || form.stationId || null,
      stationIds,
      ownerId: oneOwnerId,
      ownersByStation: form.assignMode === "one" ? ownersByStation : undefined,
      memberIds: form.assignMode === "some" ? form.memberIds : [],
      createdBy: currentUser?.id || currentUser?.employeeId || null,
      createdByName: currentUser?.name || "",
      assignMode: form.assignMode,
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
    };

    const buildOnePayloads = (fileAttachments) => {
      if (form.assignMode !== "one" || stationIds.length <= 1) {
        return [{ ...basePayload, attachments: fileAttachments }];
      }
      return stationIds.map((sid) => ({
        ...basePayload,
        stationId: sid,
        stationIds: [sid],
        ownerId: ownersByStation[sid] || null,
        ownersByStation: undefined,
        attachments: fileAttachments,
      }));
    };

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
          board = createLocalOpsTask(company.id, payload, { employees: data?.employees || [] });
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

      // Prefer one server call with ownersByStation when multi-station one-employee.
      const multiOne = form.assignMode === "one" && stationIds.length > 1;
      const res = await ops({
        action: "create",
        ...(multiOne
          ? { ...basePayload, attachments, ownersByStation }
          : { ...payloads[0], attachments }),
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
      if (multiOne && createdRows.length < stationIds.length) {
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
      } else if (createdRows.length) {
        mergeCreated(createdRows);
        finishCreateUi(createdRows[0]?.ref, createdRows.length, createdRows);
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
      if (company?.id && (isLocalPreviewActive() || localMode || Array.isArray(data?.tasks))) {
        try {
          let board = null;
          for (const payload of buildOnePayloads(attachments)) {
            board = createLocalOpsTask(company.id, payload, { employees: data?.employees || [] });
            if (board?.error) throw new Error(board.reason || board.error);
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
    try {
      let proofFiles = [];
      const file = opts.proofFile || null;
      if (file && !localMode && !isLocalPreviewActive()) {
        const up = await base44.integrations.Core.UploadFile({ file });
        proofFiles = [{ url: up.file_url, name: file.name }];
      } else if (file) {
        proofFiles = [{ url: "", name: file.name, localOnly: true }];
      }
      const attestation = opts.attestation != null
        ? opts.attestation
        : (proofFiles.length
          ? ""
          : (ar ? `إفادة إنجاز بواسطة ${currentUser?.name || "المستخدم"}` : `Completion attested by ${currentUser?.name || "user"}`));
      if (!proofFiles.length && !String(attestation || "").trim()) {
        toast({
          title: ar ? "بوابة الإثبات" : "Proof gate",
          description: ar ? "لا نقطة بلا أثر — أرفق صورة أو اكتب إفادة أولًا" : "No point without a trace — attach a photo or write an attestation first",
          variant: "destructive",
        });
        return false;
      }
      const amount = Math.max(1, Number(opts.amount) || 1);
      if (localMode || isLocalPreviewActive()) {
        const board = logLocalCompletion(company.id, task.id, { amount, attestation, proofFiles });
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
      });
      const body = res?.data || res;
      if (body?.error === "CHECK_IN_REQUIRED") {
        toast({ title: ar ? "بوابة الحضور" : "Attendance gate", description: body.reason || body.error, variant: "destructive" });
        return false;
      }
      if (body?.error) throw new Error(body.reason || body.error);
      setCounts(body.counts || null);
      await reload();
      return true;
    } catch (err) {
      if (company?.id && (isLocalPreviewActive() || localMode)) {
        try {
          const attestation = opts.attestation || (ar ? `إفادة إنجاز بواسطة ${currentUser?.name || "المستخدم"}` : `Completion attested by ${currentUser?.name || "user"}`);
          const board = logLocalCompletion(company.id, task.id, {
            amount: Math.max(1, Number(opts.amount) || 1),
            attestation,
            proofFiles: [],
          });
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
      if (body?.error) throw new Error(body.reason || body.error);
      setCounts(body.counts || null);
      await reload();
      toast({ title: ar ? "عائق · مُدّد الموعد" : "Blocker · due extended", description: dueAt });
      return true;
    } catch (err) {
      if (company?.id && (isLocalPreviewActive() || localMode)) {
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
      if (body?.error) throw new Error(body.reason || body.error);
      setCounts(body.counts || null);
      await reload();
      toast({
        title: ar ? "عائق · وُزِّع المتبقي" : "Blocker · remainder redistributed",
        description: ar ? "أُعيد تقسيم المتبقي على الأيام من اليوم." : "Remaining count re-split across days from today.",
      });
      return true;
    } catch (err) {
      if (company?.id && (isLocalPreviewActive() || localMode)) {
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
    const attachments = Array.isArray(files) ? files.filter((f) => f && f.url) : [];
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
      if (body?.error) throw new Error(body.reason || body.error);
      await reload();
    } catch (err) {
      if (company?.id && (isLocalPreviewActive() || localMode || Array.isArray(data?.tasks))) {
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
        const board = deleteLocalOpsComment(company.id, task.id, commentId);
        setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
        setCounts(board.counts);
        await refresh?.();
        return;
      }
      const res = await ops({ action: "deleteComment", taskId: task.id, commentId });
      const body = res?.data || res;
      if (body?.error) throw new Error(body.reason || body.error);
      await reload();
    } catch (err) {
      if (company?.id && (isLocalPreviewActive() || localMode || Array.isArray(data?.tasks))) {
        try {
          const board = deleteLocalOpsComment(company.id, task.id, commentId);
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

  const deleteTasks = async (ids) => {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (!list.length || !company?.id) return;
    setBusy(true);
    try {
      const reviewer = { id: currentUser?.id || currentUser?.employeeId, name: currentUser?.name, role: currentUser?.role };
      if (localMode || isLocalPreviewActive()) {
        let board = null;
        for (const id of list) {
          board = deleteLocalOpsTask(company.id, id, { reviewer });
        }
        if (board) {
          setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
          setCounts(board.counts);
        }
        setOpenTaskId(null);
        toast({ title: ar ? "حُذفت المهمة" : "Task deleted" });
        await refresh?.();
        return;
      }
      for (const id of list) {
        const res = await ops({ action: "delete", taskId: id });
        const body = res?.data || res;
        if (body?.error) throw new Error(body.reason || body.reasonEn || body.error);
      }
      setTasks((prev) => prev.filter((t) => !list.includes(t.id) || isOpsTaskDeleted({ ...t, deletedAt: t.deletedAt || "1" })));
      setOpenTaskId(null);
      toast({ title: ar ? "حُذفت المهمة" : "Task deleted" });
      await reload();
    } catch (err) {
      if (company?.id && (isLocalPreviewActive() || localMode || Array.isArray(data?.tasks))) {
        try {
          const reviewer = { id: currentUser?.id || currentUser?.employeeId, name: currentUser?.name, role: currentUser?.role };
          let board = null;
          for (const id of list) {
            board = deleteLocalOpsTask(company.id, id, { reviewer });
          }
          if (board) {
            setTasks(buildLocalOpsBoard({ tasks: board.tasks, scope, stations: data?.stations || [] }).tasks);
            setCounts(board.counts);
          }
          setOpenTaskId(null);
          toast({ title: ar ? "حُذفت المهمة" : "Task deleted" });
          await refresh?.();
          return;
        } catch (localErr) {
          toast({
            title: ar ? "تعذّر الحذف" : "Could not delete",
            description: localErr.reason || localErr.message,
            variant: "destructive",
          });
          return;
        }
      }
      toast({ title: ar ? "تعذّر الحذف" : "Could not delete", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const addAttachment = async (task, file) => {
    if (!file) return;
    setBusy(true);
    try {
      const up = await base44.integrations.Core.UploadFile({ file });
      const res = await ops({ action: "addAttachment", taskId: task.id, url: up.file_url, name: file.name });
      const body = res?.data || res;
      if (body?.error) throw new Error(body.reason || body.error);
      await reload();
    } catch (err) {
      toast({ title: ar ? "فشل المرفق" : "Attachment failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const setMode = async (task, mode) => {
    setBusy(true);
    try {
      const res = await ops({ action: "setTaskMode", taskId: task.id, mode });
      const body = res?.data || res;
      if (body?.error) throw new Error(body.reason || body.error);
      await reload();
    } catch (err) {
      toast({ title: ar ? "تعذّر تغيير النمط" : "Mode change failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const approve = async (task) => {
    if (!canReview(task)) {
      toast({
        title: ar ? "ليس مستواك" : "Not your level",
        description: ar
          ? "بعد الرفض تنتقل المراجعة للمستوى التالي في سلسلة التصعيد."
          : "After a reject, review moves to the next escalation level.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      if (localMode || isLocalPreviewActive()) {
        const body = approveLocalTask(company.id, task.id);
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
      if (body?.error) throw new Error(body.reason || body.error);
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
      if (company?.id && (isLocalPreviewActive() || localMode)) {
        try {
          const body = approveLocalTask(company.id, task.id);
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

  const toastRejectOutcome = (escalation) => {
    if (escalation?.escalate) {
      toast({
        title: ar ? "رُفض وصُعّد" : "Rejected and escalated",
        description: ar
          ? "الرفض مكتوب في السجل، والمراجعة انتقلت للمستوى التالي في سلسلة التصعيد."
          : "The written reject is on the trail, and review moved to the next escalation level.",
      });
      return;
    }
    toast({
      title: ar ? "أُعيدت للمنفّذ" : "Returned to executor",
      description: ar
        ? "وصلت أعلى سلسلة التصعيد — أُعيدت المهمة للمنفّذ لإثبات أوضح."
        : "Top of the escalation chain — returned to the executor for clearer proof.",
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
        setTasks(buildLocalOpsBoard({ tasks: body.tasks, scope, stations: data?.stations || [] }).tasks);
        setCounts(body.counts);
        toastRejectOutcome(body.escalation);
        setRejectFor(null);
        setRejectReason("");
        await refresh?.();
        return;
      }
      const res = await ops({ action: "reject", taskId: target.id, reason });
      const body = res?.data || res;
      if (body?.error) throw new Error(body.reason || body.error);
      toastRejectOutcome(body.escalation);
      setRejectFor(null);
      setRejectReason("");
      setCounts(body.counts || null);
      await reload();
    } catch (err) {
      if (company?.id && (isLocalPreviewActive() || localMode || Array.isArray(data?.tasks))) {
        try {
          const body = rejectLocalTask(company.id, target.id, reason, { reviewer: currentUser, data });
          setTasks(buildLocalOpsBoard({ tasks: body.tasks, scope, stations: data?.stations || [] }).tasks);
          setCounts(body.counts);
          setLocalMode(true);
          toastRejectOutcome(body.escalation);
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
    const why = String(
      reason
      || (typeof window !== "undefined"
        ? window.prompt(
          ar ? "سبب إنهاء الوكالة (مطلوب):" : "Reason for ending the delegation (required):",
          ar ? "إنهاء الوكالة من الموكِّل" : "Delegator ended the agency",
        )
        : "")
      || "",
    ).trim();
    if (!task || !why) return;
    setBusy(true);
    const preview = isLocalPreviewActive() || localMode;
    try {
      if (preview) {
        applyLocalEndDelegation(task, { reason: why });
        await refresh?.();
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
        const err = new Error(body.reason || body.error);
        err.code = body.error;
        throw err;
      }
      setCounts(body.counts || null);
      toast({ title: ar ? "أُنهيت الوكالة" : "Delegation ended" });
      await reload();
    } catch (err) {
      if (company?.id) {
        try {
          applyLocalEndDelegation(task, { reason: why });
          setLocalMode(true);
          await refresh?.();
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
  const liveTasks = tasks.filter((t) => !isOpsTaskDeleted(t));
  const archivedTasks = tasks.filter((t) => isOpsTaskArchived(t));
  const visible = liveTasks.filter((t) => {
    if (filter === "archive") return false;
    if (filter === "all") return true;
    if (filter === "overdue") return isOverdue(t);
    if (filter === "today") return t.dueAt && String(t.dueAt).slice(0, 10) === todayKey;
    if (filter === "awaiting") return isAwaitingApproval(t);
    if (filter === "escalated") return isEscalated(t);
    if (filter === "done") return t.status === "completed" || !!t.approvedAt;
    return true;
  });
  const boardPace = deriveBoardDailyPace(liveTasks);

  const c = counts;
  const chips = c ? [
    { id: "all", label: ar ? `الكل · ${c.total}` : `All · ${c.total}` },
    { id: "overdue", label: ar ? `متأخرة · ${c.overdue}` : `Overdue · ${c.overdue}` },
    { id: "today", label: ar ? `اليوم · ${c.today}` : `Today · ${c.today}` },
    { id: "awaiting", label: ar ? `بانتظار الاعتماد · ${c.awaiting}` : `Awaiting · ${c.awaiting}` },
    { id: "escalated", label: ar ? `صُعّدت · ${c.escalated || 0}` : `Escalated · ${c.escalated || 0}` },
    { id: "done", label: ar ? `مكتملة · ${c.done}` : `Done · ${c.done}` },
    { id: "archive", label: ar ? `الأرشيف · ${archivedTasks.length}` : `Archive · ${archivedTasks.length}` },
  ] : [];

  const stationName = (id) => stations.find((s) => s.id === id)?.name || "—";
  const ownerName = (task) => {
    const id = task.ownerId || task.employee_id;
    const emp = (data?.employees || []).find((e) => e.id === id || e.employeeId === id);
    return emp?.name || task.ownerName || "—";
  };
  const archiveItems = archivedTasks.map((t) => ({
    id: t.id,
    title: t.title,
    text: [t.ref, stationName(t.stationId), ownerName(t)].filter(Boolean).join(" · "),
    date: t.deletedAt || t.completedAt || t.approvedAt || t.dueAt || t.createdAt,
    badge: t.deletedAt
      ? (ar ? "محذوفة" : "Deleted")
      : (t.status === "completed" || t.approvedAt ? (ar ? "مكتملة" : "Done") : (ar ? "مؤرشفة" : "Archived")),
  }));
  const ownerInitials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

  const KIND_LABEL = {
    pm: { ar: "وقائية", en: "PM" },
    cm: { ar: "تصحيحية", en: "CM" },
    em: { ar: "طارئة", en: "EM" },
    pr: { ar: "مشروع", en: "PR" },
    cp: { ar: "امتثال", en: "CP" },
  };
  const STATUS_LABEL = {
    active: { ar: "نشطة", en: "Active" },
    awaiting_approval: { ar: "بانتظار الاعتماد", en: "Awaiting" },
    completed: { ar: "مكتملة", en: "Done" },
    pending_review: { ar: "مراجعة", en: "Review" },
  };
  const priColor = (p) => (p === "high" || p === "urgent" ? "#DC2626" : p === "low" ? "#94A3B8" : "#F59E0B");
  const statusChip = (status) => {
    if (status === "completed") return OK;
    if (status === "awaiting_approval" || status === "pending_review") return WARN;
    return NEUTRAL;
  };

  const kindStyle = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: "8px",
    fontSize: "11px",
    background: SURFACE,
    color: MUTED,
    border: `1px solid ${BORDER}`,
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
          {task.status !== "completed" && task.mode !== "remote" && (
            <button type="button" disabled={busy} onClick={() => setMode(task, "remote")} style={ui.btnMiniQuiet}>
              {ar ? "عن بُعد" : "Remote"}
            </button>
          )}
          {task.status !== "completed" && task.mode === "remote" && (
            <button type="button" disabled={busy} onClick={() => setMode(task, "onsite")} style={ui.btnMiniQuiet}>
              {ar ? "حضوري" : "On-site"}
            </button>
          )}
          {task.status !== "completed" && !isAwaitingApproval(task) && (
            <button
              type="button"
              disabled={busy || logBlocked}
              onClick={() => logDone(task)}
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
          <span className="max-w-[220px] text-[10px] leading-snug" style={{ color: "#B45309" }}>
            {attendanceGate?.reason || (ar ? "موقوف حتى بصمة اليوم" : "Blocked until today's check-in")}
          </span>
        )}
      </div>
    );
  };

  return (
    <PlatformStampShell
      ar={ar}
      title={ar ? "المهام والعمليات" : "Tasks & operations"}
      hint={
        c
          ? (ar
            ? `${c.active} نشطة · ${c.overdue + c.awaiting} تحتاج متابعة · نقاط معتمدة ${c.pointsAwarded} — الحضور يفتح المهمة، والاعتماد يمنح النقاط.`
            : `${c.active} active · ${c.overdue + c.awaiting} need follow-up · awarded points ${c.pointsAwarded} — attendance opens the task; review awards the points.`)
          : (ar ? "تُحمَّل العدّادات من الخادم…" : "Loading counters from server…")
      }
      maxWidth={1280}
    >
      <div className="space-y-3.5">

      <OpsToolbarStrip
        ar={ar}
        dir={dir}
        viewMode={viewMode === "plan" ? "plan" : "list"}
        onViewModeChange={setViewMode}
        filter={filter}
        onFilterChange={setFilter}
        chips={chips}
        showCreate={showCreate}
        onToggleCreate={() => setShowCreate((v) => !v)}
      />

      {filter !== "archive" && boardPace.active > 0 ? <DailyPaceStrip ar={ar} board={boardPace} /> : null}

      <div style={checkedIn ? okBanner : warnBanner}>
        {checkedIn
          ? (ar ? "حضور اليوم مسجَّل — يمكنك تسجيل إنجاز المهام الحضورية." : "Checked in today — you can log on-site task completion.")
          : (attendanceGate?.reason || (ar
            ? "تسجيل الإنجاز الميداني موقوف حتى بصمة اليوم — سجّل حضورك من شاشة الحضور، أو اطلب تحويل المهمة إلى عن بُعد."
            : "On-site logging is blocked until today's check-in — use Attendance, or ask to switch the task to remote."))}
        {!checkedIn && (
          <Link to="/app/attendance" className="ms-2 underline font-medium">
            {ar ? "الحضور" : "Attendance"}
          </Link>
        )}
      </div>

      {showCreate && (
        <OpsNewTaskModal
          ar={ar}
          dir={dir}
          form={form}
          setForm={setForm}
          stations={stations}
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

      {filter === "archive" ? (
        <RecordSmartArchive
          items={archiveItems}
          lang={lang}
          dir={dir}
          emptyLabel={ar ? "لا مهام مؤرشفة بعد — المكتملة والمحذوفة خلال المهلة تُحفظ هنا." : "No archived tasks yet — completed and window-deleted tasks are filed here."}
        />
      ) : viewMode === "plan" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "11px", color: MUTED, lineHeight: 1.65, textWrap: "pretty" }}>
            {ar
              ? "الخطة تُحسب من الأيام المتبقية حتى الاستحقاق: أقل من أسبوع أسبوعية، أقل من شهر شهرية، وهكذا — والمهمة تنتقل تلقائيًا كلما اقترب الموعد."
              : "The plan is remaining days until due: under a week is weekly, under a month is monthly, and so on — a task moves automatically as the date approaches."}
          </div>
          {planGroups.map((g) => (
            <div key={g.id} style={tableShell}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 18px",
                borderBottom: `1px solid ${BORDER}`,
                flexWrap: "wrap",
              }}
              >
                <div style={{ flex: "1 1 200px", fontSize: "13px", fontWeight: 600, color: INK }}>
                  {ar ? HORIZON_LABEL[g.id]?.ar : HORIZON_LABEL[g.id]?.en}
                </div>
                <div style={{ fontSize: "11px", color: MUTED }}>
                  {ar ? `${g.rows.length} مهام` : `${g.rows.length} tasks`}
                </div>
                <div dir="ltr" style={{ fontSize: "11px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right" }}>
                  {g.unitsDone}/{g.unitsTarget}
                </div>
                <span style={{ width: "96px", height: "5px", borderRadius: "4px", background: SURFACE, overflow: "hidden" }}>
                  <span style={{ display: "block", width: `${g.pct || 0}%`, height: "100%", background: BRAND, borderRadius: "4px" }} />
                </span>
                <span dir="ltr" style={{ fontSize: "11px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif", width: "34px", textAlign: "right" }}>
                  {g.pct || 0}%
                </span>
              </div>
              {g.rows.length === 0 ? (
                <div style={{ padding: "16px 18px", fontSize: "12px", color: MUTED }}>
                  {ar ? "لا مهام في هذا الأفق ضمن التصفية." : "No tasks in this horizon for the current filter."}
                </div>
              ) : (
                g.rows.map((task) => {
                  const owner = ownerName(task);
                  return (
                    <div
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenTaskId(task.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpenTaskId(task.id); }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#F7F8FA"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 18px",
                        borderBottom: "1px solid #F1F5F9",
                        cursor: "pointer",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: priColor(task.priority), flexShrink: 0 }} />
                      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 500, color: INK }}>{task.title}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "11px", color: MUTED, fontFamily: "'IBM Plex Mono',monospace" }} dir="ltr">{task.ref}</span>
                          <span style={kindStyle}>
                            {ar ? KIND_LABEL[task.workKind]?.ar : KIND_LABEL[task.workKind]?.en || task.workKind}
                          </span>
                          <span style={{ fontSize: "11px", color: MUTED }}>{stationName(task.stationId)} · {owner}</span>
                          {taskTransferMeta(task) ? (
                            <OpsAssignmentRefChip task={task} ar={ar} kind="transfer" compact />
                          ) : null}
                          {taskDelegationMeta(task) ? (
                            <OpsAssignmentRefChip task={task} ar={ar} kind="delegation" compact />
                          ) : null}
                        </div>
                      </div>
                      <span style={{ fontSize: "12px", color: MUTED }}>{task.dueAt ? String(task.dueAt).slice(0, 10) : "—"}</span>
                      <span style={statusChip(task.status)}>
                        {ar ? STATUS_LABEL[task.status]?.ar : STATUS_LABEL[task.status]?.en || task.status}
                      </span>
                      <span dir="ltr" style={{ fontSize: "11px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right" }}>
                        {task.completedCount}/{task.targetCount}
                      </span>
                      <div onClick={(e) => e.stopPropagation()}>{renderActions(task)}</div>
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      ) : (
        <OpsTasksTable
          tasks={visible}
          lang={lang}
          loading={loading}
          serviceDown={serviceDown && !localMode}
          stationName={stationName}
          ownerName={ownerName}
          ownerInitials={ownerInitials}
          onOpen={(task) => setOpenTaskId(task.id)}
        />
      )}

      {openTask && (
        <OpsTaskDetail
          task={{ ...openTask, ownerName: ownerName(openTask), stationName: stationName(openTask.stationId) }}
          ar={ar}
          busy={busy}
          canManage={canReview(openTask)}
          canReassign={canReassign(openTask)}
          canEndDelegation={canEndDelegation(openTask)}
          canTransfer={canReassign(openTask)}
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
          onAddComment={(text, isIssue, files, requestedDueAt) => addComment(openTask, text, isIssue, files, requestedDueAt)}
          onDeleteComment={(commentId) => deleteComment(openTask, commentId)}
          onAddAttachment={(file) => addAttachment(openTask, file)}
          onOpenReassign={() => setReassignFor(openTask)}
          onOpenTransfer={() => setTransferFor(openTask)}
          onEndDelegation={() => endDelegation(openTask)}
          onSetMode={(mode) => setMode(openTask, mode)}
          onExtendDue={(opts) => extendDue(openTask, opts)}
          onDelete={() => deleteTasks([openTask.id])}
          currentUserId={currentUser?.id || currentUser?.employeeId}
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

      {rejectFor && (
        <div style={dialogOverlay} onClick={() => setRejectFor(null)}>
          <div style={dialogCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{ar ? "سبب الرفض" : "Rejection reason"}</div>
            <p style={{ margin: "6px 0 0", fontSize: 11, lineHeight: 1.7, color: MUTED }}>
              {ar
                ? "الرفض يُسجَّل ويُصعَّد للمستوى التالي في سلسلة التصعيد. إن وصلت أعلى السلسلة تُعاد للمنفّذ."
                : "Reject is recorded and escalates to the next level. At the top of the chain it returns to the executor."}
            </p>
            <textarea style={{ ...textarea, marginTop: 12 }} rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setRejectFor(null)} style={ui.btnSecondary}>{ar ? "إلغاء" : "Cancel"}</button>
              <button type="button" disabled={busy || !rejectReason.trim()} onClick={() => reject()} style={{ ...ui.btnCreate, opacity: busy || !rejectReason.trim() ? 0.5 : 1 }}>
                {ar ? "رفض وتصعيد" : "Reject & escalate"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PlatformStampShell>
  );
}
