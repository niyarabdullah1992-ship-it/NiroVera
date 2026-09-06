import React from "react";
import OpsTaskDeleteWindow from "@/components/tasks/OpsTaskDeleteWindow";
import { ACCENT, BORDER, CARD, MUTED, NAVY, OK, SURFACE, WARN } from "@/lib/platformStyles";
import { taskRecurrenceLabel } from "@/lib/opsDerivations";

const tag = { display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 8, fontSize: 11, background: SURFACE, color: MUTED, border: `1px solid ${BORDER}` };
const neutral = { ...tag, borderRadius: 20, padding: "3px 9px", fontWeight: 500, whiteSpace: "nowrap" };
const actionBtn = (busy) => ({ padding: "5px 11px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 11, fontWeight: 600, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" });

function Fact({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 12, color: NAVY, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</div>
    </div>
  );
}

/** Title, tags, facts grid and the management actions row. */
export default function OpsTaskHeader({
  task, ar, busy, awaiting, approved, doneN, targetN,
  canReassign, canTransfer, canEndDelegation, canManage, canDelete,
  onClose, onOpenReassign, onOpenTransfer, onEndDelegation, onSetMode, onDelete,
}) {
  const recLabel = taskRecurrenceLabel(task.recurrence, ar);
  const statusLabel = awaiting ? (ar ? "بانتظار الاعتماد" : "Awaiting approval") : approved ? (ar ? "مكتملة" : "Completed") : (ar ? "نشطة" : "Active");
  const pct = Math.min(100, Math.round((doneN / targetN) * 100));
  const showActions = canReassign || canTransfer || canEndDelegation || (canManage && !approved && onSetMode) || (canDelete && !approved);
  return (
    <div style={{ flexShrink: 0, padding: "16px 20px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: NAVY, textWrap: "pretty" }}>{task.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7, flexWrap: "wrap" }}>
            <span dir="ltr" style={{ fontSize: 11, color: MUTED, fontFamily: "'IBM Plex Mono',monospace" }}>{task.ref}</span>
            <span style={tag}>×{task.effortWeight || 1} {ar ? "وزن" : "weight"}</span>
            <span style={tag}>{task.mode === "remote" ? (ar ? "عن بُعد" : "Remote") : (ar ? "ميداني" : "On-site")}</span>
            {recLabel ? <span style={tag}>{recLabel}</span> : null}
            <span style={awaiting ? WARN : approved ? OK : neutral}>{statusLabel}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: MUTED, fontSize: 14, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>×</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, padding: "10px 12px", borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}` }}>
        <Fact label={ar ? "الفرع" : "Branch"}>{task.stationName || task.stationId || "—"}</Fact>
        <Fact label={ar ? "المسؤول" : "Owner"}>{task.ownerName || task.assigneeName || "—"}</Fact>
        <Fact label={ar ? "البدء" : "Start"}><span dir="ltr">{task.startAt ? String(task.startAt).slice(0, 10) : "—"}</span></Fact>
        <Fact label={ar ? "الاستحقاق" : "Due"}><span dir="ltr">{task.dueAt ? String(task.dueAt).slice(0, 10) : "—"}</span></Fact>
        <Fact label={ar ? "التقدّم" : "Progress"}>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ flex: 1, height: 5, borderRadius: 4, background: "#E2E8F0", overflow: "hidden" }}>
              <span style={{ display: "block", width: `${pct}%`, height: "100%", background: ACCENT, borderRadius: 4 }} />
            </span>
            <span dir="ltr" style={{ fontSize: 11, color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>{doneN}/{targetN}</span>
          </span>
        </Fact>
      </div>

      {showActions && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {canReassign && <button type="button" disabled={busy} onClick={() => onOpenReassign?.()} style={actionBtn(busy)}>{ar ? "توكيل" : "Delegate"}</button>}
          {canTransfer && <button type="button" disabled={busy} onClick={() => onOpenTransfer?.()} style={actionBtn(busy)}>{ar ? "نقل" : "Transfer"}</button>}
          {canEndDelegation && <button type="button" disabled={busy} onClick={() => onEndDelegation?.()} style={actionBtn(busy)}>{ar ? "إنهاء التوكيل" : "End delegation"}</button>}
          {canManage && !approved && onSetMode && (
            <button type="button" disabled={busy} onClick={() => onSetMode(task.mode === "remote" ? "onsite" : "remote")} style={actionBtn(busy)}>
              {task.mode === "remote" ? (ar ? "حوّل إلى حضوري" : "Switch to on-site") : (ar ? "حوّل إلى عن بُعد" : "Switch to remote")}
            </button>
          )}
          <OpsTaskDeleteWindow createdAt={task.createdAt} allowed={canDelete && !approved} busy={busy} ar={ar} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}