import React, { useState } from "react";
import { createPortal } from "react-dom";
import { CARD, MUTED, NAVY, textarea } from "@/lib/platformStyles";

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
  const canSubmit = reason.trim().length > 0 && ack && !busy;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      dir={ar ? "rtl" : "ltr"}
    >
      <div
        className="w-full max-w-md rounded-xl p-4 shadow-lg"
        style={{ background: CARD }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold" style={{ color: NAVY }}>
          {ar ? "حذف المهمة" : "Delete task"}
        </div>
        <p className="mt-1 text-[11px] leading-6" style={{ color: MUTED }}>
          {ar
            ? "الحذف يُخرج المهمة من القائمة الحية ويبقيها في الأرشيف وسجل التدقيق مع السبب والإقرار."
            : "Deletion removes the task from the live list and keeps it in the archive and audit trail with the reason and acknowledgement."}
        </p>

        <div
          className="mt-3 rounded-xl border px-3 py-2.5 text-[11px] leading-6"
          style={{ borderColor: "var(--nv-line)", background: "var(--nv-bad-soft)", color: "var(--nv-bad-ink)" }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>
            {ar ? "تنبيه — يبقى في السجل" : "Notice — stays in the record"}
          </strong>
          {doneN > 0
            ? (ar
              ? `سُجّل إنجاز ${doneN}/${targetN}. لا يُمسح العدد ولا التعليقات ولا المرفقات — تظهر في الأرشيف وسجل التدقيق.`
              : `Logged progress is ${doneN}/${targetN}. Count, comments, and attachments are not wiped — they stay in the archive and audit trail.`)
            : (ar
              ? "بعد التأكيد تُؤرشف المهمة. السبب والإقرار يظهران في سجل التدقيق مثل التوكيل والنقل."
              : "After confirm the task is archived. Reason and acknowledgement appear in the audit trail like delegation and transfer.")}
        </div>

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: MUTED }}>
            {ar ? "سبب الحذف" : "Deletion reason"}
          </span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={ar ? "سبب الحذف (مطلوب)" : "Deletion reason (required)"}
            style={textarea}
          />
        </label>

        <label className="mt-3 flex items-start gap-2 text-[11px] leading-6" style={{ color: NAVY }}>
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {ar
              ? "أقرّ أن الحذف يُبقي المهمة في سجل التدقيق، وأن أي إنجاز مسجّل يبقى في السجل."
              : "I acknowledge that deletion keeps the task in the audit trail, and any logged progress stays in the record."}
          </span>
        </label>

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--nv-line)] px-3 py-1.5 text-xs"
            style={{ color: MUTED, background: CARD }}
          >
            {ar ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onConfirm?.({ reason: reason.trim(), ack: true })}
            className="rounded-lg px-3 py-1.5 text-xs text-white disabled:opacity-50"
            style={{ background: "var(--nv-bad-fill)" }}
          >
            {ar ? "تأكيد الحذف" : "Confirm delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
