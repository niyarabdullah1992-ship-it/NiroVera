import React, { useState } from "react";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import { ACCENT, BRAND, BRAND_DEEP, BRAND_SOFT, CARD, MUTED, NAVY, field } from "@/lib/platformStyles";
import { taskRecurrenceLabel, isOpsVisitorTask, taskCreatorName, taskAssigneePeople, taskPeopleCountLabel, normalizeTaskMode, deriveTaskHeatBanNotice, TASK_MODES } from "@/lib/opsDerivations";
import OpsDispatchChip from "@/components/tasks/OpsDispatchChip";
import HeatBanNotice from "@/components/shared/HeatBanNotice";

const FIELD = { ...field, height: 40 };
const LABEL_SPAN = { fontSize: 12, fontWeight: 600, color: MUTED };

const PRIORITIES = [
  { id: "high", ar: "عالية", en: "High", color: "#DC2626" },
  { id: "medium", ar: "متوسطة", en: "Medium", color: "#F59E0B" },
  { id: "low", ar: "منخفضة", en: "Low", color: MUTED },
];

const WEIGHTS = [
  { w: 1, ar: "روتيني", en: "Routine" },
  { w: 2, ar: "إدخال/متابعة", en: "Data & follow-up" },
  { w: 3, ar: "تشغيلي", en: "Operational" },
  { w: 4, ar: "فني/صيانة", en: "Technical / maintenance" },
  { w: 5, ar: "حرج/عميل", en: "Critical / client" },
];

const actionBtn = (busy, tone) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 36,
  padding: "0 12px",
  margin: 0,
  boxSizing: "border-box",
  borderRadius: 9,
  border: tone === "danger" ? "1px solid #FECACA" : "1px solid var(--nv-line, #E2E8F0)",
  background: tone === "danger" ? "#FEF2F2" : CARD,
  color: tone === "danger" ? "#B91C1C" : NAVY,
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1,
  cursor: busy ? "wait" : "pointer",
  fontFamily: "inherit",
});

function ReadField({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 160px", minWidth: 0 }}>
      <span style={LABEL_SPAN}>{label}</span>
      <div style={{ ...FIELD, display: "flex", alignItems: "center", overflow: "hidden" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{children}</span>
      </div>
    </div>
  );
}

function priorityStyle(active, color) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    flex: 1,
    height: 36,
    borderRadius: 9,
    fontFamily: "inherit",
    fontSize: 12,
    cursor: "default",
    ...(active
      ? { border: `1px solid ${color}`, background: `${color}14`, color, fontWeight: 600 }
      : { border: "1px solid var(--nv-line, #E2E8F0)", background: CARD, color: MUTED }),
  };
}

function weightStyle(active) {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    flex: 1,
    minWidth: 0,
    padding: "7px 4px",
    borderRadius: 9,
    fontFamily: "inherit",
    cursor: "default",
    ...(active
      ? { border: `1px solid ${BRAND}`, background: BRAND_SOFT, color: BRAND_DEEP }
      : { border: "1px solid var(--nv-line, #E2E8F0)", background: CARD, color: MUTED }),
  };
}

function modeStyle(active, clickable) {
  return {
    flex: 1,
    height: 36,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 12px",
    borderRadius: 9,
    fontFamily: "inherit",
    fontSize: 12,
    lineHeight: 1.3,
    textAlign: "center",
    cursor: clickable ? "pointer" : "default",
    ...(active
      ? { border: `1px solid ${BRAND}`, background: BRAND_SOFT, color: BRAND_DEEP, fontWeight: 600 }
      : { border: "1px solid var(--nv-line, #E2E8F0)", background: CARD, color: MUTED }),
  };
}

/** Assignment, work profile, and schedule — same section language as the create card. */
export default function OpsTaskHeader({
  task, ar, busy, approved, awaiting, doneN, targetN,
  canReassign, canTransfer, canEndDelegation, canManage, canDelete,
  onOpenReassign, onOpenTransfer, onEndDelegation, onSetMode, onOpenDelete,
  paceStrip = null,
  employees = [],
}) {
  const recLabel = taskRecurrenceLabel(task.recurrence, ar);
  const pct = Math.min(100, Math.round((doneN / targetN) * 100));
  const pri = String(task.priority || "medium");
  const weight = Number(task.effortWeight) || 1;
  const mode = normalizeTaskMode(task.mode);
  const canSwitchMode = canManage && !approved && !awaiting && !!onSetMode;
  const showDelete = canDelete && !approved && !awaiting;
  const showActions = canReassign || canTransfer || canEndDelegation || canSwitchMode || showDelete;
  const workType = String(task.workTypeText || task.workType || "").trim();
  const assignees = taskAssigneePeople(task, employees);
  const [showPeople, setShowPeople] = useState(false);

  return (
    <>
      <OpsTaskSection title={ar ? "الإسناد" : "Assignment"}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ReadField label={ar ? "الفرع" : "Station"}>{task.stationName || task.stationId || "—"}</ReadField>
          <ReadField label={ar ? "أنشأها" : "Created by"}>
            {task.createdByName || taskCreatorName(task) || "—"}
          </ReadField>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 160px", minWidth: 0 }}>
            <span style={LABEL_SPAN}>{ar ? "عدد الأشخاص" : "People"}</span>
            <button
              type="button"
              onClick={() => assignees.length && setShowPeople((open) => !open)}
              aria-expanded={showPeople}
              style={{
                ...FIELD,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                cursor: assignees.length ? "pointer" : "default",
                fontFamily: "inherit",
                textAlign: "start",
                background: CARD,
              }}
            >
              <span>{taskPeopleCountLabel(assignees.length, ar)}</span>
              {assignees.length ? (
                <span style={{ color: MUTED, fontSize: 11, flexShrink: 0 }} aria-hidden>
                  {showPeople ? "▴" : "▾"}
                </span>
              ) : null}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minWidth: 160 }}>
            <span style={LABEL_SPAN}>{ar ? "المسؤول" : "Owner"}</span>
            <div style={{ ...FIELD, display: "flex", alignItems: "center", overflow: "hidden" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                {task.ownerName || task.assigneeName || "—"}
              </span>
            </div>
          </div>
          {isOpsVisitorTask(task) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minWidth: 160 }}>
              <span style={LABEL_SPAN}>{ar ? "الفرع الأم" : "Home station"}</span>
              <div style={{ ...FIELD, display: "flex", alignItems: "center", overflow: "hidden" }}>
                <OpsDispatchChip homeName={task.homeStationName} ar={ar} />
              </div>
            </div>
          ) : null}
        </div>
        {showPeople && assignees.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {assignees.map((person) => (
              <div
                key={person.id}
                style={{ ...FIELD, display: "flex", alignItems: "center", overflow: "hidden" }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {person.name}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {showActions ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {canReassign && <button type="button" disabled={busy} onClick={() => onOpenReassign?.()} style={actionBtn(busy)}>{ar ? "توكيل" : "Delegate"}</button>}
            {canTransfer && <button type="button" disabled={busy} onClick={() => onOpenTransfer?.()} style={actionBtn(busy)}>{ar ? "نقل" : "Transfer"}</button>}
            {canEndDelegation && <button type="button" disabled={busy} onClick={() => onEndDelegation?.()} style={actionBtn(busy)}>{ar ? "إنهاء التوكيل" : "End delegation"}</button>}
            {showDelete && (
              <button type="button" disabled={busy} onClick={() => onOpenDelete?.()} style={actionBtn(busy, "danger")}>
                {ar ? "حذف" : "Delete"}
              </button>
            )}
          </div>
        ) : null}
      </OpsTaskSection>

      <OpsTaskSection title={ar ? "طبيعة العمل" : "Work profile"}>
        {workType ? (
          <ReadField label={ar ? "نوع العمل" : "Work type"}>{workType}</ReadField>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={LABEL_SPAN}>{ar ? "الأولوية" : "Priority"}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {PRIORITIES.map((p) => (
              <div key={p.id} style={priorityStyle(pri === p.id, p.color)}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                <span>{ar ? p.ar : p.en}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={LABEL_SPAN}>{ar ? "وزن الجهد" : "Effort weight"}</span>
          <div style={{ display: "flex", gap: 6 }}>
            {WEIGHTS.map((w) => (
              <div key={w.w} style={weightStyle(weight === w.w)}>
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 14, fontWeight: 600 }}>×{w.w}</span>
                <span style={{ fontSize: 10, lineHeight: 1.2, textAlign: "center" }}>{ar ? w.ar : w.en}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={LABEL_SPAN}>{ar ? "مكان التنفيذ" : "Where the work happens"}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TASK_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={!canSwitchMode || busy}
                onClick={() => canSwitchMode && onSetMode(m.id)}
                style={modeStyle(mode === m.id, canSwitchMode)}
              >
                {ar ? m.ar : m.en}
              </button>
            ))}
          </div>
          {/* The card describes a task, it does not attempt a completion, so the level
              stays with the task's span — reference off season, red alert in it. The
              refusal in the banned hours is named by the composer's log gate. */}
          <HeatBanNotice notice={deriveTaskHeatBanNotice({ ...task, mode })} ar={ar} />
        </div>
        {recLabel ? (
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{recLabel}</div>
        ) : null}
      </OpsTaskSection>

      <OpsTaskSection
        title={ar ? "الجدول والعدد" : "Schedule & count"}
        hint={ar ? "التقدّم يُشتق من الإنجاز المسجّل مقابل العدد المستهدف." : "Progress is derived from logged completion versus the target count."}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ReadField label={ar ? "البدء" : "Start"}><span dir="ltr">{task.startAt ? String(task.startAt).slice(0, 10) : "—"}</span></ReadField>
          <ReadField label={ar ? "الاستحقاق" : "Due"}><span dir="ltr">{task.dueAt ? String(task.dueAt).slice(0, 10) : "—"}</span></ReadField>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={LABEL_SPAN}>{ar ? "التقدّم" : "Progress"}</span>
          <div style={{ ...FIELD, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, height: 6, borderRadius: 4, background: "#E2E8F0", overflow: "hidden" }}>
              <span style={{ display: "block", width: `${pct}%`, height: "100%", background: ACCENT, borderRadius: 4 }} />
            </span>
            <span dir="ltr" style={{ fontSize: 12, color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif", flexShrink: 0 }}>
              {doneN}/{targetN}
            </span>
          </div>
        </div>
        {paceStrip}
      </OpsTaskSection>
    </>
  );
}
