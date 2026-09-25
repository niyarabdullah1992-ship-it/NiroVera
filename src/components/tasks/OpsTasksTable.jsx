import React from "react";
import { dayDiffFromToday, deriveDailyTaskPace, isOpsVisitorTask, taskPaceInput, taskDelegationMeta, taskTransferMeta, workKindLabel, taskModeLabel } from "@/lib/opsDerivations";
import OpsAssignmentRefChip from "@/components/tasks/OpsAssignmentRefChip";
import OpsDispatchChip from "@/components/tasks/OpsDispatchChip";
import LaneRecordCard from "@/components/shared/LaneRecordCard";
import { INK, emptyState } from "@/lib/platformStyles";

/** Work-order cards — same chrome as work proof and visitor proof. */

const WEIGHT_LABEL = {
  1: { ar: "روتيني", en: "Routine" },
  2: { ar: "إدخال/متابعة", en: "Data & follow-up" },
  3: { ar: "تشغيلي", en: "Operational" },
  4: { ar: "فني/صيانة", en: "Technical / maintenance" },
  5: { ar: "حرج/عميل", en: "Critical / client" },
};

function taskStateId(task) {
  const s = task?.status;
  if (s === "completed") return "settled";
  if (s === "blocked" || s === "stopped") return "blocked";
  if (s === "awaiting_approval" || s === "pending_review" || s === "active" || s === "in_progress") return "waiting";
  return "void";
}

function statusVisual(task, ar) {
  const s = task.status;
  if (s === "completed") return { tone: "ok", label: ar ? "مكتملة" : "Completed" };
  if (s === "blocked" || s === "stopped") return { tone: "bad", label: ar ? "متوقفة" : "Blocked" };
  if (s === "awaiting_approval") return { tone: "warn", label: ar ? "بانتظار الاعتماد" : "Awaiting approval" };
  if (s === "pending_review") return { tone: "warn", label: ar ? "قيد المراجعة" : "In review" };
  if (s === "active" || s === "in_progress") return { tone: "warn", label: ar ? "قيد التنفيذ" : "In progress" };
  if (s === "pending" || s === "not_started") return { tone: "neutral", label: ar ? "لم تبدأ" : "Not started" };
  return { tone: "neutral", label: ar ? String(s || "—") : String(s || "—") };
}

function dueVisual(task, ar) {
  if (!task.dueAt || task.status === "completed") {
    return {
      tone: undefined,
      text: task.status === "completed" ? (ar ? "مكتملة" : "Completed") : (task.dueAt ? String(task.dueAt).slice(0, 10) : "—"),
    };
  }
  const d = dayDiffFromToday(task.dueAt);
  if (Number.isNaN(d)) return { tone: undefined, text: String(task.dueAt).slice(0, 10) };
  if (d < 0) {
    const n = Math.abs(d);
    return {
      tone: "bad",
      text: ar ? `متأخرة ${n === 1 ? "يوم" : n === 2 ? "يومان" : `${n} أيام`}` : `${n}d overdue`,
    };
  }
  if (d === 0) return { tone: "warn", text: ar ? "اليوم" : "Today" };
  if (d === 1) return { tone: undefined, text: ar ? "غدًا" : "Tomorrow" };
  return { tone: undefined, text: ar ? (d === 2 ? "يومان" : `${d} أيام`) : `${d} days` };
}

function cardTone(task, due) {
  if (task.status === "completed") return "ok";
  if (due?.tone === "bad" || task.status === "blocked" || task.status === "stopped") return "bad";
  if (task.status === "awaiting_approval" || task.status === "pending_review" || task.status === "active" || task.status === "in_progress") {
    return "warn";
  }
  return "neutral";
}

function TaskRow({ task, ar, stationName, ownerName, ownerInitials, onOpen, renderActions, justCreated }) {
  const weight = Number(task.effortWeight) || 3;
  const weightLabel = ar ? WEIGHT_LABEL[weight]?.ar : WEIGHT_LABEL[weight]?.en;
  const status = statusVisual(task, ar);
  const due = dueVisual(task, ar);
  const doneN = Number(task.completedCount) || 0;
  const targetN = Math.max(1, Number(task.targetCount) || 1);
  const pct = Math.min(100, Math.round((doneN / targetN) * 100));
  const pace = deriveDailyTaskPace(taskPaceInput(task));
  const owner = ownerName(task);
  const hasTransfer = !!taskTransferMeta(task);
  const hasDelegation = !!taskDelegationMeta(task);
  const escalated = (Number(task.escalationLevel) || 0) > 0 && task.status !== "completed";
  const paceExtra = pace.active && pace.todayExpected > 0 && task.status !== "completed"
    ? (ar ? `اليوم ${pace.todayExpected}` : `Today ${pace.todayExpected}`)
    : "";

  return (
    <LaneRecordCard
      title={task.title}
      refId={task.ref || "—"}
      meta={[
        workKindLabel(task.workKind, ar ? "ar" : "en"),
        taskModeLabel(task.mode, ar ? "ar" : "en"),
        `×${weight} ${weightLabel || ""}`.trim(),
        escalated ? (ar ? `صُعّد · م${Number(task.escalationLevel) + 1}` : `Escalated · L${Number(task.escalationLevel) + 1}`) : "",
      ]}
      badge={justCreated ? (ar ? "أُنشئت الآن" : "Just created") : ""}
      statusLabel={status.label}
      tone={cardTone(task, due)}
      mark={ownerInitials(owner)}
      facts={[
        { label: ar ? "الفرع" : "Station", value: stationName(task.stationId) },
        { label: ar ? "المسؤول" : "Owner", value: owner },
        { label: ar ? "الاستحقاق" : "Due", value: due.text, tone: due.tone },
      ]}
      progress={{
        label: ar ? "الإنجاز" : "Progress",
        count: `${doneN}/${targetN}`,
        pct,
        extra: paceExtra,
      }}
      chips={(hasTransfer || hasDelegation || isOpsVisitorTask(task)) ? (
        <>
          {hasTransfer ? <OpsAssignmentRefChip task={task} ar={ar} kind="transfer" compact /> : null}
          {hasDelegation ? <OpsAssignmentRefChip task={task} ar={ar} kind="delegation" compact /> : null}
          {isOpsVisitorTask(task) ? <OpsDispatchChip homeName={stationName(task.homeStationId)} ar={ar} /> : null}
        </>
      ) : null}
      onOpen={() => onOpen?.(task)}
      actions={typeof renderActions === "function" ? renderActions(task) : null}
      fresh={justCreated}
      dataState={taskStateId(task)}
    />
  );
}

export function OpsTaskCards({
  tasks = [],
  lang = "ar",
  stationName,
  ownerName,
  ownerInitials,
  onOpen,
  renderActions,
  createdIds,
}) {
  const ar = lang === "ar";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          ar={ar}
          stationName={stationName}
          ownerName={ownerName}
          ownerInitials={ownerInitials}
          onOpen={onOpen}
          renderActions={renderActions}
          justCreated={createdIds?.includes(task.id)}
        />
      ))}
    </div>
  );
}

export default function OpsTasksTable({
  tasks = [],
  lang = "ar",
  loading = false,
  stationName,
  ownerName,
  ownerInitials,
  onOpen,
  serviceDown = false,
  renderActions,
  createdIds,
}) {
  const ar = lang === "ar";

  if (loading) {
    return (
      <div style={{ ...emptyState, lineHeight: 1.9 }}>
        {ar ? "جاري التحميل…" : "Loading…"}
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div style={{ ...emptyState, lineHeight: 1.9 }}>
        <div style={{ fontWeight: 600, color: INK }}>
          {serviceDown
            ? (ar ? "القائمة غير محمَّلة" : "List not loaded")
            : (ar ? "لا مهام مطابقة" : "No matching tasks")}
        </div>
        {serviceDown
          ? (ar
            ? "لم تستجب خدمة العمليات — لا يمكن تأكيد وجود مهام أو عدمها في هذا النطاق."
            : "The operations service did not respond — whether tasks exist in this scope cannot be confirmed.")
          : (ar
            ? "لا مهام تطابق هذا التصفية في النطاق الحالي."
            : "No tasks match this filter in the current scope.")}
      </div>
    );
  }

  return (
    <OpsTaskCards
      tasks={tasks}
      lang={lang}
      stationName={stationName}
      ownerName={ownerName}
      ownerInitials={ownerInitials}
      onOpen={onOpen}
      renderActions={renderActions}
      createdIds={createdIds}
    />
  );
}
