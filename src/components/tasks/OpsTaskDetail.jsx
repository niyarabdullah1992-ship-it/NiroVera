import React, { useState } from "react";
import { deriveDailyTaskPace, derivePaceBlocker, taskPaceInput, taskPaceLoggedOnDay, taskPoints, opsRejectionCount, canDeleteOpsTask, isOpsTaskDeleted, canUndoOpsAction, checkTaskHeatBanGate } from "@/lib/opsDerivations";
import ComposerModalShell from "@/components/shared/ComposerModalShell";
import OpsTaskAuditTimeline from "@/components/tasks/OpsTaskAuditTimeline";
import DailyPaceStrip from "@/components/tasks/DailyPaceStrip";
import OpsTaskHeader from "@/components/tasks/detail/OpsTaskHeader";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import OpsTaskApprovalBox from "@/components/tasks/detail/OpsTaskApprovalBox";
import OpsTaskEmployeeEscalate from "@/components/tasks/detail/OpsTaskEmployeeEscalate";
import OpsTaskAttachments from "@/components/tasks/detail/OpsTaskAttachments";
import OpsTaskDiscussion from "@/components/tasks/detail/OpsTaskDiscussion";
import OpsTaskBlockerResolve from "@/components/tasks/detail/OpsTaskBlockerResolve";
import OpsTaskComposer from "@/components/tasks/detail/OpsTaskComposer";
import { DS_RADIUS } from "@/lib/designSystem";
import { NAVY_FILL } from "@/lib/platformStyles";
import SectionBackLink from "@/components/shared/SectionBackLink";

function addDays(iso, n) {
  const raw = String(iso || "").slice(0, 10);
  const d = new Date(`${raw || new Date().toISOString().slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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
  onEmployeeEscalate,
  canEmployeeEscalate = false,
  isAssignee = false,
  onAddComment,
  onDeleteComment,
  onAddAttachment,
  onReplaceAttachment,
  onSaveSteps,
  canReassign = false,
  onOpenReassign,
  canTransfer = false,
  onOpenTransfer,
  canEndDelegation = false,
  onEndDelegation,
  onSetMode,
  canEditAssignees = false,
  stationMembers = [],
  onSetMembers,
  onExtendDue,
  onRedistributePace,
  onOpenDelete,
  onUndoCreate,
  currentUser = null,
  currentUserId,
  employees = [],
}) {
  const [draftQty, setDraftQty] = useState(0);
  const [draftIssue, setDraftIssue] = useState(false);
  const [draftStop, setDraftStop] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftFile, setDraftFile] = useState(null);
  const [draftVoice, setDraftVoice] = useState(null);
  const [composerTick, setComposerTick] = useState(0);
  if (!task) return null;

  const points = taskPoints(task.priority, task.effortWeight);
  const steps = Array.isArray(task.steps) ? task.steps : String(task.steps || "").split("\n").filter(Boolean);
  const attachments = Array.isArray(task.attachments) ? task.attachments : [];
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const doneN = Number(task.completedCount) || 0;
  const targetN = Math.max(1, Number(task.targetCount) || 1);
  const deleted = isOpsTaskDeleted(task);
  const awaiting = !deleted && (task.status === "awaiting_approval" || (doneN >= targetN && !task.approvedAt && task.status !== "completed"));
  const approved = task.status === "completed" || !!task.approvedAt;
  const canDelete = canDeleteOpsTask(task, currentUser || { id: currentUserId });
  const undoCreate = !deleted && canDelete ? canUndoOpsAction(task) : null;
  const canQuickDelete = !!(undoCreate && undoCreate.target === "create" && onUndoCreate);
  // Second line of defence only — the server holds the sun ban; this just names it before the tap.
  const heatGate = checkTaskHeatBanGate(task);
  const logGate = heatGate.ok ? attendanceGate : heatGate;
  const onsiteBlocked = (task.mode !== "remote" && checkedIn === false) || !heatGate.ok;
  const pace = deriveDailyTaskPace(taskPaceInput(task));
  const loggedToday = taskPaceLoggedOnDay(task);
  const expectedToday = pace.active ? Math.max(0, Number(pace.todayExpected) || 0) : 0;
  const entryShort = !deleted && !approved && !awaiting && expectedToday > 0 && (
    draftIssue || (draftQty >= 1 && draftQty < expectedToday)
  );
  const shownLogged = entryShort && draftQty >= 1 ? draftQty : loggedToday;
  const issueNote = String(draftStop || "").trim()
    || String(task.paceBlocker?.reason || "").trim()
    || String((comments.find((c) => c.stopReason)?.stopReason) || "").trim()
    || String((comments.find((c) => c.isIssue)?.text) || "").trim();
  const derivedBlocker = (!deleted && !approved && !awaiting)
    ? derivePaceBlocker({
      task,
      pace,
      amountJustLogged: draftQty >= 1 && draftQty < expectedToday ? draftQty : 0,
      missed: !!draftIssue,
    })
    : null;
  const liveBlocker = derivedBlocker
    ? {
      ...(task.paceBlocker && typeof task.paceBlocker === "object" ? task.paceBlocker : {}),
      ...derivedBlocker,
      status: "open",
      kind: shownLogged <= 0 || draftIssue ? "missed" : derivedBlocker.kind,
      expected: expectedToday || derivedBlocker.expected,
      logged: shownLogged,
      gap: Math.max(0, (expectedToday || derivedBlocker.expected) - shownLogged),
      reason: issueNote || (shownLogged <= 0
        ? (ar ? `لا إنجاز اليوم — 0 من ${expectedToday}` : `Nothing logged today — 0 of ${expectedToday}`)
        : (ar ? `إنجاز جزئي — ${shownLogged} من ${expectedToday}` : `Partial — ${shownLogged} of ${expectedToday}`)),
    }
    : null;

  const sendComposer = (payload) => {
    if (payload?.logCompletion || payload?.stopReason) {
      return onLog?.({
        amount: payload.amount,
        attestation: payload.text,
        proofFile: payload.proofFile,
        proofVoice: payload.proofVoice,
        stopReason: payload.stopReason,
      });
    }
    const extraFiles = [];
    if (payload?.proofFile) extraFiles.push(payload.proofFile);
    if (payload?.proofVoice) extraFiles.push(payload.proofVoice);
    return onAddComment?.(payload?.text, payload?.isIssue, extraFiles);
  };

  const chooseBlocker = async (kind) => {
    const amount = draftIssue ? 0 : Math.max(0, Number(draftQty) || 0);
    const stop = String(draftStop || "").trim()
      || (amount >= 1
        ? (ar ? `إنجاز جزئي — ${amount} من تارقت اليوم ${expectedToday}` : `Partial — ${amount} of daily target ${expectedToday}`)
        : (ar ? `لا إنجاز اليوم — 0 من ${expectedToday}` : `Nothing logged today — 0 of ${expectedToday}`));
    const willLog = !approved && !awaiting && (amount >= 1 || draftIssue);
    if (willLog) {
      const ok = await onLog?.({
        amount,
        attestation: String(draftText || "").trim() || stop,
        proofFile: draftFile,
        proofVoice: draftVoice,
        stopReason: stop,
      });
      if (ok === false) return false;
    }
    const gap = Math.max(0, expectedToday - amount);
    const result = kind === "extend"
      ? await onExtendDue?.({ dueAt: addDays(task.dueAt, 1), reason: stop, expected: expectedToday, logged: amount, gap })
      : await onRedistributePace?.({ reason: stop, expected: expectedToday, logged: amount, gap });
    if (result !== false) {
      setDraftQty(0);
      setDraftIssue(false);
      setDraftStop("");
      setDraftText("");
      setDraftFile(null);
      setDraftVoice(null);
      setComposerTick((n) => n + 1);
    }
    return result;
  };

  const statusHint = deleted
    ? (ar ? `${task.ref} · محذوفة — تبقى في السجل` : `${task.ref} · Deleted — stays in the record`)
    : awaiting
      ? (ar ? `${task.ref} · بانتظار الاعتماد` : `${task.ref} · Awaiting approval`)
      : approved
        ? (ar ? `${task.ref} · مكتملة` : `${task.ref} · Completed`)
        : (ar ? `${task.ref} · تُحدَّث فور تسجيل الإنجاز` : `${task.ref} · Updates when completion is logged`);

  return (
    <ComposerModalShell
      ar={ar}
      title={task.title}
      hint={statusHint}
      onClose={onClose}
      back={<SectionBackLink ar={ar} label={ar ? "المهام" : "Tasks"} onClick={onClose} />}
      asForm={false}
      zIndex={110}
      dataNv="task"
      footer={(
        <>
          <OpsTaskBlockerResolve
            ar={ar}
            busy={busy}
            canManage={canManage && !deleted}
            blocker={deleted ? null : liveBlocker}
            dueAt={task.dueAt}
            onExtend={() => chooseBlocker("extend")}
            onRedistribute={() => chooseBlocker("redistribute")}
          />
          <OpsTaskComposer
            key={composerTick}
            embedded
            ar={ar}
            busy={busy}
            approved={approved || deleted}
            awaiting={awaiting}
            doneN={doneN}
            targetN={targetN}
            todayExpected={pace.active ? pace.todayExpected : 0}
            loggedToday={loggedToday}
            onsiteBlocked={onsiteBlocked}
            attendanceGate={logGate}
            onDraft={({ qty, issue, stopReason, text, proofFile, proofVoice }) => {
              setDraftQty(qty);
              setDraftIssue(!!issue);
              setDraftStop(String(stopReason || ""));
              setDraftText(String(text || ""));
              setDraftFile(proofFile || null);
              setDraftVoice(proofVoice || null);
            }}
            onSend={sendComposer}
          />
        </>
      )}
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
        onOpenReassign={onOpenReassign}
        onOpenTransfer={onOpenTransfer}
        onEndDelegation={onEndDelegation}
        onSetMode={deleted ? undefined : onSetMode}
        canEditAssignees={!deleted && canEditAssignees}
        stationMembers={stationMembers}
        onSetMembers={deleted ? undefined : onSetMembers}
        onOpenDelete={onOpenDelete}
        paceStrip={pace.active ? <DailyPaceStrip ar={ar} pace={pace} /> : null}
        employees={employees}
      />

      {deleted && (
        <OpsTaskSection tone="bad" title={ar ? "محذوفة — تبقى في السجل" : "Deleted — stays in the record"}>
          <div style={{ fontSize: 12, color: "var(--nv-bad-ink)", lineHeight: 1.65 }}>
            {doneN > 0
              ? (ar
                ? `الإنجاز المسجّل ${doneN}/${targetN} يبقى في السجل مع التعليقات والمرفقات.`
                : `Logged progress ${doneN}/${targetN} stays in the record with comments and attachments.`)
              : (ar
                ? "الحذف أرشف المهمة دون مسح سجل التدقيق."
                : "Deletion archived the task without wiping the audit trail.")}
            {task.deletedByName ? (
              <div style={{ marginTop: 6 }}>
                {ar ? "حذفها: " : "Deleted by: "}{task.deletedByName}
                  </div>
                ) : null}
            {task.deleteReason ? (
              <div style={{ marginTop: 6 }}>
                {ar ? "السبب: " : "Reason: "}{task.deleteReason}
                  </div>
                ) : null}
                  </div>
        </OpsTaskSection>
      )}

      {awaiting && !approved && !deleted && (
        <OpsTaskApprovalBox ar={ar} busy={busy} canManage={canManage} points={points} targetN={targetN} currentLevelLabel={currentLevelLabel} escalationSteps={escalationSteps} t={t} lang={lang} onApprove={onApprove} onReject={onReject} />
      )}
      {!approved && !awaiting && !deleted && (
        <OpsTaskEmployeeEscalate
          ar={ar}
          busy={busy}
          rejectCount={opsRejectionCount(task)}
          canEscalate={canEmployeeEscalate}
          isAssignee={isAssignee}
          onEscalate={onEmployeeEscalate}
        />
      )}
          {approved && (
        <OpsTaskSection tone="ok" title={ar ? "اعتُمد الإنجاز" : "Completion approved"}>
          <div style={{ fontSize: 12, color: "var(--nv-ok-ink)", lineHeight: 1.65 }}>
            {ar ? `مُنحت ${task.pointsAwarded ?? points} نقطة — دخلت في نسبة الأداء وسجل التدقيق.` : `${task.pointsAwarded ?? points} points granted — in the performance score and audit trail.`}
            </div>
        </OpsTaskSection>
      )}

      <OpsTaskAttachments
        taskId={task.id}
        attachments={attachments}
        steps={steps}
        stepsUpdatedAt={task.stepsUpdatedAt}
        attachmentsUpdatedAt={task.attachmentsUpdatedAt}
                        ar={ar}
        busy={busy}
        canEdit={!approved && !deleted}
        onAddAttachment={onAddAttachment}
        onReplaceAttachment={onReplaceAttachment}
        onSaveSteps={onSaveSteps}
      />
      <OpsTaskAuditTimeline task={task} ar={ar} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: DS_RADIUS, background: NAVY_FILL, color: "#fff", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.72)", letterSpacing: "0.1em", fontWeight: 600 }}>{ar ? "قيمة المهمة بالنقاط" : "TASK WORTH"}</div>
          <div dir="ltr" style={{ fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", fontSize: 28, fontWeight: 600, lineHeight: 1, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{points}</div>
        </div>
        <div style={{ flex: "1 1 220px", fontSize: 12, color: "rgba(255,255,255,.78)", lineHeight: 1.65, textWrap: "pretty" }}>
          {ar ? "النقاط = الأولوية × وزن الجهد — تُمنح بعد اعتماد المشرف للإثبات." : "Points = priority × effort — granted after the supervisor approves the proof."}
        </div>
      </div>

      <OpsTaskSection
        title={ar ? "المحادثة" : "Discussion"}
        hint={ar ? "اكتب في الشريط أسفل البطاقة. خلال ثلاث دقائق يُحذف الإنشاء من أول رسالة — بلا عدّاد." : "Write in the bar at the bottom. Within three minutes, delete creation from the first message — no countdown."}
      >
        <OpsTaskDiscussion
          task={task}
          comments={comments}
          ar={ar}
          currentUserId={currentUserId}
          employees={employees}
          onDeleteComment={deleted ? undefined : onDeleteComment}
          onUndoCreate={canQuickDelete ? onUndoCreate : undefined}
        />
      </OpsTaskSection>
    </ComposerModalShell>
  );
}
