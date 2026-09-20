import React, { useState } from "react";
import { dayDiffFromToday, deriveDailyTaskPace, isOpsVisitorTask, taskPaceInput, taskDelegationMeta, taskTransferMeta, workKindLabel, taskModeLabel } from "@/lib/opsDerivations";
import OpsAssignmentRefChip from "@/components/tasks/OpsAssignmentRefChip";
import OpsDispatchChip from "@/components/tasks/OpsDispatchChip";
import { ACCENT, INK, MUTED, emptyState, tableHeadRow, tableShell } from "@/lib/platformStyles";

/**
 * Ops tasks table — institutional row hierarchy:
 * title → quiet identity meta → assignment refs → columns for station/owner/due/status/progress.
 */

const GRID_COLS = "minmax(280px,2.6fr) 112px 156px 104px 112px 128px";

const WEIGHT_LABEL = {
  1: { ar: "روتيني", en: "Routine" },
  2: { ar: "إدخال/متابعة", en: "Data & follow-up" },
  3: { ar: "تشغيلي", en: "Operational" },
  4: { ar: "فني/صيانة", en: "Technical / maintenance" },
  5: { ar: "حرج/عميل", en: "Critical / client" },
};

const KIND_COLOR = {
  pm: "#1E9E63",
  cm: "#B45309",
  em: "#DC2626",
  pr: INK,
  cp: MUTED,
};

/** Label every work kind from the shared list — an unmapped kind must not read as preventive. */
function kindMeta(workKind, ar) {
  const id = String(workKind || "").trim();
  return {
    label: workKindLabel(id, ar ? "ar" : "en"),
    color: KIND_COLOR[id] || MUTED,
  };
}

function pill(bg, fg, bd) {
  return {
    display: "inline-block",
    padding: "3px 9px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 500,
    background: bg,
    color: fg,
    border: `1px solid ${bd}`,
    whiteSpace: "nowrap",
  };
}

const OK = pill("#ECFDF3", "#15803D", "#BBF7D0");
const WARN = pill("#FFFBEB", "#B45309", "#FDE68A");
const BAD = pill("#FEF2F2", "#DC2626", "#FECACA");
const NEUTRAL = pill("#F7F8FA", "#5A6B85", "#E2E8F0");

function dotStyle(color) {
  return {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
    marginTop: "5px",
  };
}

function barStyle(pct, color) {
  return {
    display: "block",
    width: `${pct}%`,
    height: "100%",
    background: color,
    borderRadius: "4px",
  };
}

function metaSep() {
  return (
    <span aria-hidden style={{ color: "#CBD5E1", fontSize: "10px", userSelect: "none" }}>·</span>
  );
}

function metaText(children, opts = {}) {
  return (
    <span
      dir={opts.ltr ? "ltr" : undefined}
      style={{
        fontSize: "11px",
        color: opts.strong ? INK : MUTED,
        fontWeight: opts.strong ? 600 : 500,
        fontFamily: opts.mono ? "'IBM Plex Mono',monospace" : "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function priColor(priority, status) {
  if (status === "completed") return ACCENT;
  if (priority === "high" || priority === "urgent") return "#DC2626";
  if (priority === "low") return "#94A3B8";
  if (priority === "medium") return "#F59E0B";
  return "#94A3B8";
}

function statusVisual(task, ar) {
  const s = task.status;
  if (s === "completed") {
    return { style: OK, label: ar ? "مكتملة" : "Completed" };
  }
  if (s === "blocked" || s === "stopped") {
    return { style: BAD, label: ar ? "متوقفة" : "Blocked" };
  }
  if (s === "awaiting_approval") {
    return { style: WARN, label: ar ? "بانتظار الاعتماد" : "Awaiting approval" };
  }
  if (s === "pending_review") {
    return { style: WARN, label: ar ? "قيد المراجعة" : "In review" };
  }
  if (s === "active" || s === "in_progress") {
    return { style: WARN, label: ar ? "قيد التنفيذ" : "In progress" };
  }
  if (s === "pending" || s === "not_started") {
    return { style: NEUTRAL, label: ar ? "لم تبدأ" : "Not started" };
  }
  return { style: NEUTRAL, label: ar ? String(s || "—") : String(s || "—") };
}

function dueVisual(task, ar) {
  const baseOk = { fontSize: "12px", color: MUTED };
  const baseLate = { fontSize: "12px", color: "#DC2626", fontWeight: 500 };
  const baseToday = { fontSize: "12px", color: "#B45309", fontWeight: 500 };
  if (!task.dueAt || task.status === "completed") {
    return {
      style: baseOk,
      text: task.status === "completed" ? (ar ? "مكتملة" : "Completed") : (task.dueAt ? String(task.dueAt).slice(0, 10) : "—"),
    };
  }
  const d = dayDiffFromToday(task.dueAt);
  if (Number.isNaN(d)) {
    return { style: baseOk, text: String(task.dueAt).slice(0, 10) };
  }
  if (d < 0) {
    const n = Math.abs(d);
    return {
      style: baseLate,
      text: ar ? `متأخرة ${n === 1 ? "يوم" : n === 2 ? "يومان" : `${n} أيام`}` : `${n}d overdue`,
    };
  }
  if (d === 0) return { style: baseToday, text: ar ? "اليوم" : "Today" };
  if (d === 1) return { style: baseOk, text: ar ? "غدًا" : "Tomorrow" };
  return {
    style: baseOk,
    text: ar ? (d === 2 ? "يومان" : `${d} أيام`) : `${d} days`,
  };
}

function progVisual(task) {
  const target = Math.max(1, Number(task.targetCount) || 1);
  const done = Number(task.completedCount) || 0;
  const pct = Math.min(100, Math.round((done / target) * 100));
  const overdue = task.dueAt && dayDiffFromToday(task.dueAt) < 0 && task.status !== "completed";
  let color = ACCENT;
  let width = Math.max(2, pct);
  if (pct === 0 && task.status !== "completed") {
    color = "#CBD5E1";
    width = 2;
  } else if (task.status === "completed" || pct >= 100) {
    color = ACCENT;
    width = 100;
  } else if (overdue || task.status === "blocked") {
    color = "#DC2626";
  } else if (pct >= 50) {
    color = "#F59E0B";
  } else {
    color = ACCENT;
  }
  return { pct, bar: barStyle(width, color), label: `${pct}%` };
}

function TaskRow({ task, ar, stationName, ownerName, ownerInitials, onOpen, renderActions, justCreated }) {
  const [hover, setHover] = useState(false);
  const kind = kindMeta(task.workKind, ar);
  const weight = Number(task.effortWeight) || 3;
  const weightLabel = ar ? WEIGHT_LABEL[weight]?.ar : WEIGHT_LABEL[weight]?.en;
  const status = statusVisual(task, ar);
  const due = dueVisual(task, ar);
  const prog = progVisual(task);
  const doneN = Number(task.completedCount) || 0;
  const targetN = Math.max(1, Number(task.targetCount) || 1);
  const count = `${doneN}/${targetN}`;
  const pace = deriveDailyTaskPace(taskPaceInput(task));
  const owner = ownerName(task);
  const hasTransfer = !!taskTransferMeta(task);
  const hasDelegation = !!taskDelegationMeta(task);
  const escalated = (Number(task.escalationLevel) || 0) > 0 && task.status !== "completed";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: GRID_COLS,
        gap: "12px",
        padding: "14px 18px",
        borderBottom: "1px solid #F1F5F9",
        alignItems: "start",
        cursor: "pointer",
        // A row that was just created keeps a tint until the next reload, so the
        // create confirmation lands somewhere the eye can find.
        background: hover ? "#F7F8FA" : justCreated ? "#F0FAF5" : "transparent",
        boxShadow: justCreated ? `inset ${ar ? "-3px" : "3px"} 0 0 #1E9E63` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", minWidth: 0 }}>
        <span style={dotStyle(priColor(task.priority, task.status))} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "13px",
              fontWeight: 600,
              color: INK,
              letterSpacing: "-0.01em",
              minWidth: 0,
            }}
          >
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {task.title}
            </span>
            {justCreated ? (
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#1E9E63",
                  background: "#E7F7EF",
                  border: "1px solid #BBE8D2",
                  borderRadius: 999,
                  padding: "1px 7px",
                }}
              >
                {ar ? "أُنشئت الآن" : "Just created"}
              </span>
            ) : null}
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "5px",
            flexWrap: "wrap",
            minWidth: 0,
          }}
          >
            {metaText(task.ref || "—", { mono: true, ltr: true })}
            {metaSep()}
            {metaText(kind.label, { strong: true })}
            {metaSep()}
            {metaText(taskModeLabel(task.mode, ar ? "ar" : "en"))}
            {metaSep()}
            {metaText(`×${weight} ${weightLabel || ""}`)}
            {escalated ? (
              <>
                {metaSep()}
                {metaText(
                  ar ? `صُعّد · م${Number(task.escalationLevel) + 1}` : `Escalated · L${Number(task.escalationLevel) + 1}`,
                  { strong: true },
                )}
              </>
            ) : null}
          </div>

          {(hasTransfer || hasDelegation) ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "7px",
              flexWrap: "wrap",
            }}
            >
              {hasTransfer ? (
                <OpsAssignmentRefChip task={task} ar={ar} kind="transfer" compact />
              ) : null}
              {hasDelegation ? (
                <OpsAssignmentRefChip task={task} ar={ar} kind="delegation" compact />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          fontSize: "12px",
          color: MUTED,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingTop: "2px",
        }}
      >
        {stationName(task.stationId)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, paddingTop: "1px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
          <span
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: "#F1F5F9",
              border: "1px solid #E2E8F0",
              fontSize: "9px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: MUTED,
              flexShrink: 0,
              fontFamily: "'IBM Plex Sans',sans-serif",
            }}
          >
            {ownerInitials(owner)}
          </span>
          <span
            style={{
              fontSize: "12px",
              color: MUTED,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {owner}
          </span>
        </div>
        {isOpsVisitorTask(task) ? (
          <OpsDispatchChip homeName={stationName(task.homeStationId)} ar={ar} />
        ) : null}
      </div>

      <div style={{ ...due.style, paddingTop: "2px" }}>{due.text}</div>

      <div style={{ paddingTop: "1px" }}>
        <span style={status.style}>{status.label}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
          <span
            dir="ltr"
            style={{
              fontSize: "12px",
              fontWeight: 650,
              color: INK,
              fontFamily: "'IBM Plex Sans',sans-serif",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {count}
          </span>
          <span
            dir="ltr"
            style={{
              fontSize: "10px",
              color: MUTED,
              fontFamily: "'IBM Plex Sans',sans-serif",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {prog.label}
          </span>
        </div>
        <span style={{ display: "block", height: "4px", borderRadius: "4px", background: "#F1F5F9", overflow: "hidden" }}>
          <span style={prog.bar} />
        </span>
        {pace.active && pace.todayExpected > 0 && task.status !== "completed" ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: "5px" }}>
            <span style={{ fontSize: "10px", color: MUTED, fontWeight: 600 }}>
              {ar ? "اليوم" : "Today"}
            </span>
            <span
              dir="ltr"
              style={{
                fontSize: "11px",
                fontWeight: 650,
                color: pace.overdue ? "#B45309" : INK,
                fontFamily: "'IBM Plex Sans',sans-serif",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {pace.todayExpected}
            </span>
          </div>
        ) : null}
      </div>
      {typeof renderActions === "function" ? (
        <div style={{ gridColumn: "1 / -1" }} onClick={(e) => e.stopPropagation()}>
          {renderActions(task)}
        </div>
      ) : null}
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
  const listStyle = tableShell;

  if (loading) {
    return (
      <div style={listStyle}>
        <div style={{ padding: "24px 18px", fontSize: "13px", color: MUTED }}>
          {ar ? "جاري التحميل…" : "Loading…"}
        </div>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div
        style={{
          ...emptyState,
          lineHeight: 1.9,
        }}
      >
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
    <div style={listStyle}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: "900px" }}>
          <div
            style={{
              ...tableHeadRow,
              gridTemplateColumns: GRID_COLS,
              gap: "12px",
            }}
          >
            <div>{ar ? "المهمة" : "TASK"}</div>
            <div>{ar ? "الفرع" : "STATION"}</div>
            <div>{ar ? "المسؤول" : "OWNER"}</div>
            <div>{ar ? "الاستحقاق" : "DUE"}</div>
            <div>{ar ? "الحالة" : "STATUS"}</div>
            <div style={{ textAlign: "end" }}>{ar ? "الإنجاز" : "PROGRESS"}</div>
          </div>

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
      </div>
    </div>
  );
}
