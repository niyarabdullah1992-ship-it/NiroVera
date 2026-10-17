import React, { useState } from "react";
import ComposerModalShell from "@/components/shared/ComposerModalShell";
import { AckLine, ConsequenceSlab, FieldBlock, ReasonBox, TaskDialogFooter } from "@/components/tasks/TaskDialogParts";

/**
 * Soft-delete with required reason + acknowledgement — same pattern as
 * transfer/delegation. Logged progress stays on the archived record.
 */
export default function OpsDeleteModal({
  task,
  ar,
  busy,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);

  if (!task) return null;

  const doneN = Math.max(0, Number(task.completedCount) || 0);
  const targetN = Math.max(1, Number(task.targetCount) || 1);
  const missing = [
    !reason.trim() ? (ar ? "سبب الحذف" : "the reason") : "",
    !ack ? (ar ? "الإقرار" : "the acknowledgement") : "",
  ].filter(Boolean);

  return (
    <ComposerModalShell
      ar={ar}
      asForm={false}
      zIndex={120}
      dataNv="delete"
      title={ar ? "حذف المهمة" : "Delete task"}
      hint={ar ? "تخرج المهمة من القائمة الحية." : "The task leaves the live list."}
      onClose={onClose}
      footer={(
        <TaskDialogFooter
          ar={ar}
          onClose={onClose}
          busy={busy}
          missing={missing}
          tone="danger"
          label={ar ? "تأكيد الحذف" : "Confirm delete"}
          onConfirm={() => onConfirm?.({ reason: reason.trim(), ack: true })}
        />
      )}
    >
      {/* What survives the deletion — said once, here. */}
      <ConsequenceSlab dataKey="delete" title={ar ? "تُؤرشف ولا تُمحى" : "Archived, not erased"}>
        {doneN > 0
          ? (ar
            ? <>تبقى في الأرشيف وسجل التدقيق مع السبب والإقرار، ومعها الإنجاز المسجّل <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: "var(--nv-ink)" }}>{doneN}/{targetN}</span> والتعليقات والمرفقات.</>
            : <>It stays in the archive and audit trail with the reason and acknowledgement, with the logged progress {doneN}/{targetN}, comments and attachments.</>)
          : (ar
            ? "تبقى في الأرشيف وسجل التدقيق مع السبب والإقرار."
            : "It stays in the archive and audit trail with the reason and acknowledgement.")}
      </ConsequenceSlab>

      <FieldBlock label={ar ? "سبب الحذف" : "Reason"} dataKey="delete-reason">
        <ReasonBox value={reason} onChange={setReason} placeholder={ar ? "مثال: أُنشئت مكررة بالخطأ" : "e.g. created twice by mistake"} />
      </FieldBlock>

      <AckLine checked={ack} onChange={setAck} tone="danger">
        {ar ? "أقرّ بحذف هذه المهمة." : "I confirm deleting this task."}
      </AckLine>
    </ComposerModalShell>
  );
}
