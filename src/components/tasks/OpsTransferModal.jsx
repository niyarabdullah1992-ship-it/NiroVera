import React, { useMemo, useState } from "react";
import { taskAssigneeId } from "@/lib/opsDerivations";
import PlatformDateField from "@/components/shared/PlatformDateField";
import ComposerModalShell from "@/components/shared/ComposerModalShell";
import { AckLine, FieldBlock, ReasonBox, TaskDialogFooter, TaskPersonPicker } from "@/components/tasks/TaskDialogParts";

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
    <ComposerModalShell
      ar={ar}
      asForm={false}
      zIndex={120}
      dataNv="transfer"
      title={ar ? "نقل المهمة" : "Transfer task"}
      hint={ar
        ? "نقل نهائي لمسؤولية الإثبات إلى موظف آخر. يظهر تاريخ النقل واسم الناقل على بطاقة المهمة."
        : "Permanent transfer of proof ownership. The date and who moved it show on the task card."}
      onClose={onClose}
      footer={(
        <TaskDialogFooter
          ar={ar}
          onClose={onClose}
          busy={busy}
          missing={missing}
          tone="danger"
          label={ar ? "تأكيد النقل النهائي" : "Confirm final transfer"}
          onConfirm={() => onConfirm?.({
            toId,
            reason: reason.trim(),
            delegatedAt: when,
            kind: "transfer",
          })}
        />
      )}
    >
      {/* Irreversible — said once, calmly, at the top: a rule line, not an alarm box. */}
      <div
        data-task-irreversible="1"
        style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderInlineStartWidth: 3, borderInlineStartColor: "var(--nv-bad-fill)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 3 }}
      >
        <strong style={{ fontSize: 12.5, color: "var(--nv-bad-ink)" }}>{ar ? "نقل نهائي — لا تراجع بعده" : "Final — cannot be undone"}</strong>
        <span style={{ fontSize: 12, lineHeight: 1.7, color: "var(--nv-ink2, var(--nv-ink))" }}>
          {ar
            ? "لا يُلغى النقل ولا تعود المسؤولية تلقائياً. لإسناد مؤقت ببداية ونهاية استخدم «توكيل»."
            : "The transfer is not cancelled and ownership does not return. For a temporary assignment use Delegate."}
        </span>
      </div>

      <FieldBlock label={ar ? "المسؤول الجديد" : "New owner"} dataKey="transfer-to">
        <TaskPersonPicker ar={ar} options={options} value={toId} onChange={setToId} stations={stations} label={ar ? "المسؤول الجديد" : "New owner"} />
      </FieldBlock>

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

      <AckLine checked={ack} onChange={setAck} tone="danger">
        {ar ? "أقرّ أن النقل نهائي ولا يمكن التراجع عنه بعد التأكيد." : "I understand this transfer is final and cannot be undone."}
      </AckLine>
    </ComposerModalShell>
  );
}
