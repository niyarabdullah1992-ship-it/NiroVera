import React from "react";
import { deriveDailyTaskPace, taskPaceInput, taskPoints } from "@/lib/opsDerivations";
import OpsTaskAuditTimeline from "@/components/tasks/OpsTaskAuditTimeline";
import DailyPaceStrip from "@/components/tasks/DailyPaceStrip";
import OpsTaskHeader from "@/components/tasks/detail/OpsTaskHeader";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import OpsTaskApprovalBox from "@/components/tasks/detail/OpsTaskApprovalBox";
import OpsTaskLogBox from "@/components/tasks/detail/OpsTaskLogBox";
import OpsTaskAttachments from "@/components/tasks/detail/OpsTaskAttachments";
import OpsTaskDiscussion from "@/components/tasks/detail/OpsTaskDiscussion";
import OpsTaskComposer from "@/components/tasks/detail/OpsTaskComposer";
import { CARD, MUTED, NAVY, NAVY_FILL } from "@/lib/platformStyles";

/**
 * Task card — header facts → required action → steps → attachments →
 * delegation log → points → discussion → composer.
 */
export default function OpsTaskDetail({
  task,
  ar,
  busy,
  canManage,
  checkedIn,
  attendanceGate,
  escalationSteps = [],
  currentLevelLabel = "",
  t,
  lang,
  onClose,
  onLog,
  onApprove,
  onReject,
  onAddComment,
  onAddAttachment,
  canReassign = false,
  onOpenReassign,
  canTransfer = false,
  onOpenTransfer,
  canEndDelegation = false,
  onEndDelegation,
  onSetMode,
  onExtendDue,
  onDelete,
  currentUserId,
}) {
  if (!task) return null;

  const points = taskPoints(task.priority, task.effortWeight);
  const steps = Array.isArray(task.steps) ? task.steps : String(task.steps || "").split("\n").filter(Boolean);
  const attachments = Array.isArray(task.attachments) ? task.attachments : [];
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const doneN = Number(task.completedCount) || 0;
  const targetN = Math.max(1, Number(task.targetCount) || 1);
  const awaiting = task.status === "awaiting_approval" || (doneN >= targetN && !task.approvedAt && task.status !== "completed");
  const approved = task.status === "completed" || !!task.approvedAt;
  const canDelete = !!currentUserId && (String(task.createdBy || "") === String(currentUserId) || canManage);
  const onsiteBlocked = task.mode !== "remote" && checkedIn === false;
  const pace = deriveDailyTaskPace(taskPaceInput(task));

  const sendComment = (text, isIssue, extra) => {
    const files = Array.isArray(extra) ? extra : [];
    const requestedDueAt = extra && !Array.isArray(extra) ? extra.requestedDueAt : null;
    return onAddComment?.(text, isIssue, files, requestedDueAt);
  };

  const approveExtension = (value) => {
    if (typeof value === "string") {
      return onExtendDue?.({
        dueAt: value,
        reason: ar ? "اعتماد طلب التمديد من المحادثة" : "Approved the discussion extension request",
      });
    }
    return onExtendDue?.(value);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(20,40,75,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}
      dir={ar ? "rtl" : "ltr"}
    >
      <div
        style={{ width: "100%", maxWidth: 640, maxHeight: "calc(100vh - 48px)", background: CARD, borderRadius: 18, boxShadow: "0 24px 60px rgba(20,40,75,.25)", overflow: "visible", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <OpsTaskHeader
          task={task}
          ar={ar}
          busy={busy}
          awaiting={awaiting}
          approved={approved}
          doneN={doneN}
          targetN={targetN}
          canReassign={canReassign}
          canTransfer={canTransfer}
          canEndDelegation={canEndDelegation}
          canManage={canManage}
          canDelete={canDelete}
          onClose={onClose}
          onOpenReassign={onOpenReassign}
          onOpenTransfer={onOpenTransfer}
          onEndDelegation={onEndDelegation}
          onSetMode={onSetMode}
          onDelete={onDelete}
        />

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {pace.active ? <DailyPaceStrip ar={ar} pace={pace} /> : null}

          {awaiting && !approved && (
            <OpsTaskApprovalBox ar={ar} busy={busy} canManage={canManage} points={points} targetN={targetN} currentLevelLabel={currentLevelLabel} escalationSteps={escalationSteps} t={t} lang={lang} onApprove={onApprove} onReject={onReject} />
          )}
          {approved && (
            <OpsTaskSection tone="ok" title={ar ? "اعتُمد الإنجاز" : "Completion approved"}>
              <div style={{ fontSize: 12, color: "#15803D", lineHeight: 1.65 }}>
                {ar ? `مُنحت ${task.pointsAwarded ?? points} نقطة — دخلت في نسبة الأداء وسجل التدقيق.` : `${task.pointsAwarded ?? points} points granted — in the performance score and audit trail.`}
              </div>
            </OpsTaskSection>
          )}
          {!approved && !awaiting && (
            <OpsTaskLogBox ar={ar} busy={busy} doneN={doneN} targetN={targetN} onsiteBlocked={onsiteBlocked} attendanceGate={attendanceGate} onLog={onLog} />
          )}

          <OpsTaskSection title={ar ? "خطوات التنفيذ" : "Execution steps"} count={steps.length || null}>
            {steps.length === 0 ? (
              <div style={{ fontSize: 12, color: MUTED }}>{ar ? "لم تُحدَّد خطوات لهذه المهمة." : "No steps were defined for this task."}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {steps.map((s, i) => (
                  <div key={`${task.id}-step-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span dir="ltr" style={{ width: 20, height: 20, borderRadius: "50%", background: "#F1F5F9", color: MUTED, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "'IBM Plex Sans',sans-serif", marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, color: NAVY, lineHeight: 1.6, textWrap: "pretty" }}>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </OpsTaskSection>

          <OpsTaskAttachments taskId={task.id} attachments={attachments} ar={ar} busy={busy} onAddAttachment={onAddAttachment} />

          <OpsTaskAuditTimeline task={task} ar={ar} />

          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 12, background: NAVY_FILL, color: "#fff", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, color: "#6EE7B7", letterSpacing: "0.1em", fontWeight: 600 }}>{ar ? "قيمة المهمة بالنقاط" : "TASK WORTH"}</div>
              <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 28, fontWeight: 600, lineHeight: 1, marginTop: 6 }}>{points}</div>
            </div>
            <div style={{ flex: "1 1 220px", fontSize: 12, color: "#A8B4C8", lineHeight: 1.65, textWrap: "pretty" }}>
              {ar ? "النقاط = الأولوية × وزن الجهد — تُمنح بعد اعتماد المشرف للإثبات." : "Points = priority × effort — granted after the supervisor approves the proof."}
            </div>
          </div>

          <OpsTaskDiscussion task={task} comments={comments} ar={ar} busy={busy} canManage={canManage} approved={approved} onExtendDue={approveExtension} />
        </div>

        <OpsTaskComposer ar={ar} busy={busy} approved={approved} onAddComment={sendComment} />
      </div>
    </div>
  );
}
