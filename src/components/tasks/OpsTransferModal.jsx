import React, { useMemo, useState } from "react";
import { taskAssigneeId } from "@/lib/opsDerivations";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { AckLine, ConsequenceSlab, FieldBlock, FrameBlock, ReasonBox, RequestFrameDialog, TaskDialogFooter, TaskPersonPicker } from "@/components/tasks/TaskDialogParts";

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Permanent ownership transfer — irreversible. Shows who / when on the task card.
 */
export default function OpsTransferModal({
  task,
  ar,
  employees = [],
  stations = [],
  busy,
  onClose,
  onConfirm,
}) {
  const currentId = String(taskAssigneeId(task) || "");
  const options = useMemo(
    () => (employees || []).filter((emp) => {
      const id = String(emp.employeeId || emp.id || "");
      return id && id !== currentId;
    }),
    [employees, currentId],
  );
  const [toId, setToId] = useState(options[0] ? String(options[0].employeeId || options[0].id) : "");
  const [transferredAt, setTransferredAt] = useState(todayKey());
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);

  if (!task) return null;

  const when = String(transferredAt || "").slice(0, 10);
  const missing = [
    !toId ? (ar ? "اختيار المسؤول الجديد" : "the new owner") : "",
    !when ? (ar ? "تاريخ النقل" : "the date") : "",
    !reason.trim() ? (ar ? "سبب النقل" : "the reason") : "",
    !ack ? (ar ? "الإقرار" : "the acknowledgement") : "",
  ].filter(Boolean);

  return (
    <RequestFrameDialog
      ar={ar}
      dataNv="transfer"
      title={ar ? "نقل المهمة" : "Transfer task"}
      hint={ar
        ? "نقل نهائي لمسؤولية الإثبات إلى موظف آخر. يظهر تاريخ النقل واسم الناقل على بطاقة المهمة."
        : "Permanent transfer of proof ownership. The date and who moved it show on the task card."}
      onClose={onClose}
    >
      <FrameBlock heading={ar ? "المسؤول الجديد" : "New owner"} dataKey="transfer-to">
        <TaskPersonPicker ar={ar} options={options} value={toId} onChange={setToId} stations={stations} label={ar ? "المسؤول الجديد" : "New owner"} />
        <ConsequenceSlab dataKey="irreversible" title={ar ? "لا تراجع بعده" : "Cannot be undone"}>
          {ar
            ? "لا يُلغى النقل ولا تعود المسؤولية تلقائياً. لإسناد مؤقت ببداية ونهاية استخدم «توكيل»."
            : "The transfer is not cancelled and ownership does not return. For a temporary assignment use Delegate."}
        </ConsequenceSlab>
      </FrameBlock>

      <FrameBlock dataKey="transfer-details">
        <FieldBlock label={ar ? "تاريخ النقل" : "Transfer date"} dataKey="transfer-date">
          <PlatformDateField
            value={transferredAt}
            onChange={(next) => setTransferredAt(String(next || "").slice(0, 10))}
            ar={ar}
            placeholder={ar ? "اختر التاريخ" : "Pick a date"}
          />
        </FieldBlock>
        <FieldBlock label={ar ? "سبب النقل" : "Reason"} dataKey="transfer-reason">
          <ReasonBox value={reason} onChange={setReason} placeholder={ar ? "مثال: انتقل المسؤول الأصلي إلى فرع آخر" : "e.g. the owner moved to another branch"} />
        </FieldBlock>
        <AckLine checked={ack} onChange={setAck}>
          {ar ? "أقرّ أن النقل نهائي ولا يمكن التراجع عنه بعد التأكيد." : "I understand this transfer is final and cannot be undone."}
        </AckLine>
      </FrameBlock>

      <TaskDialogFooter
        ar={ar}
        busy={busy}
        missing={missing}
        tone="danger"
        label={ar ? "تأكيد النقل النهائي" : "Confirm final transfer"}
        readyText={ar ? "جاهز للنقل" : "Ready to transfer"}
        onConfirm={() => onConfirm?.({
          toId,
          reason: reason.trim(),
          delegatedAt: when,
          kind: "transfer",
        })}
      />
    </RequestFrameDialog>
  );
}
