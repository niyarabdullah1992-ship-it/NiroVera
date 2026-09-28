import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CARD, MUTED, NAVY, field, textarea } from "@/lib/platformStyles";
import { taskAssigneeId } from "@/lib/opsDerivations";
import PlatformDateField from "@/components/shared/PlatformDateField";

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
  const canSubmit = !!toId && !!when && reason.trim().length > 0 && ack && !busy;

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
          {ar ? "نقل المهمة" : "Transfer task"}
        </div>
        <p className="mt-1 text-[11px] leading-6" style={{ color: MUTED }}>
          {ar
            ? "نقل نهائي لمسؤولية الإثبات إلى موظف آخر. يظهر تاريخ النقل واسم الناقل على بطاقة المهمة."
            : "Permanent transfer of proof ownership to another employee. The transfer date and who moved it show on the task card."}
        </p>

        <div
          className="mt-3 rounded-xl border px-3 py-2.5 text-[11px] leading-6"
          style={{ borderColor: "var(--nv-line)", background: "var(--nv-bad-soft)", color: "var(--nv-bad-ink)" }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>
            {ar ? "تنبيه — لا يمكن التراجع" : "Warning — irreversible"}
          </strong>
          {ar
            ? "بعد التأكيد لا يمكن إلغاء النقل أو إرجاع المسؤولية تلقائيًا. استخدم التوكيل إن أردت إسنادًا مؤقتًا ببداية ونهاية."
            : "After confirm, the transfer cannot be undone or auto-reversed. Use delegation if you need a temporary start/end assignment."}
        </div>

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: MUTED }}>
            {ar ? "المسؤول الجديد" : "New owner"}
          </span>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            style={field}
          >
            <option value="">{ar ? "اختر موظفًا" : "Select employee"}</option>
            {options.map((emp) => {
              const id = emp.employeeId || emp.id;
              return (
                <option key={id} value={id}>{emp.name}</option>
              );
            })}
          </select>
        </label>

        {options.length === 0 && (
          <div className="mt-2 text-[11px] leading-6" style={{ color: "var(--nv-warn-ink)" }}>
            {ar
              ? "لا موظف آخر ظاهر في نطاق هذا الفرع."
              : "No other visible employee in this station scope."}
          </div>
        )}

        <div className="mt-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: MUTED }}>
            {ar ? "تاريخ النقل" : "Transfer date"}
          </span>
          <PlatformDateField
            value={transferredAt}
            onChange={(next) => setTransferredAt(String(next || "").slice(0, 10))}
            ar={ar}
            placeholder={ar ? "اختر التاريخ" : "Pick a date"}
          />
        </div>

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: MUTED }}>
            {ar ? "سبب النقل" : "Transfer reason"}
          </span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={ar ? "سبب النقل (مطلوب)" : "Transfer reason (required)"}
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
              ? "أقرّ أن النقل نهائي ولا يمكن التراجع عنه بعد التأكيد."
              : "I understand this transfer is final and cannot be undone after confirmation."}
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
            onClick={() => onConfirm?.({
              toId,
              reason: reason.trim(),
              delegatedAt: when,
              kind: "transfer",
            })}
            className="rounded-lg px-3 py-1.5 text-xs text-white disabled:opacity-50"
            style={{ background: "var(--nv-bad-fill)" }}
          >
            {ar ? "تأكيد النقل" : "Confirm transfer"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
