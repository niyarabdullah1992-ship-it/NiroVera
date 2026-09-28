import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CARD, MUTED, NAVY, NAVY_FILL, field, textarea } from "@/lib/platformStyles";
import { taskAssigneeId } from "@/lib/opsDerivations";
import PlatformDateField from "@/components/shared/PlatformDateField";

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDaysKey(base, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(base || ""));
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Manager-only توكيل — start/end dates + reason; ends only via الموكِّل later.
 */
export default function OpsReassignModal({
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
  const [delegatedAt, setDelegatedAt] = useState(todayKey());
  const [actingUntil, setActingUntil] = useState(addDaysKey(todayKey(), 7));
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);

  if (!task) return null;

  const start = String(delegatedAt || "").slice(0, 10);
  const end = String(actingUntil || "").slice(0, 10);
  const rangeOk = !!start && !!end && end >= start;
  const canSubmit = !!toId && rangeOk && reason.trim().length > 0 && ack && !busy;

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
          {ar ? "توكيل المهمة" : "Delegate task"}
        </div>
        <p className="mt-1 text-[11px] leading-6" style={{ color: MUTED }}>
          {ar
            ? "حدّد بداية ونهاية التوكيل. يبقى المرجع على بطاقة المهمة، ويحق للموكِّل إنهاء الوكالة قبل نهايتها."
            : "Set start and end of the delegation. The reference stays on the task card, and the delegator may end it early."}
        </p>

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: MUTED }}>
            {ar ? "الموكَّل إليه" : "Delegate to"}
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

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold" style={{ color: MUTED }}>
              {ar ? "بداية التوكيل" : "Delegation starts"}
            </span>
            <PlatformDateField
              value={delegatedAt}
              onChange={(next) => {
                const s = String(next || "").slice(0, 10);
                setDelegatedAt(s);
                if (end && s && end < s) setActingUntil(s);
              }}
              ar={ar}
              placeholder={ar ? "تاريخ البداية" : "Start date"}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold" style={{ color: MUTED }}>
              {ar ? "نهاية التوكيل" : "Delegation ends"}
            </span>
            <PlatformDateField
              value={actingUntil}
              onChange={(next) => setActingUntil(String(next || "").slice(0, 10))}
              ar={ar}
              placeholder={ar ? "تاريخ النهاية" : "End date"}
            />
          </div>
        </div>
        {start && end && end < start && (
          <div className="mt-2 text-[11px] leading-6" style={{ color: "var(--nv-warn-ink)" }}>
            {ar ? "النهاية يجب أن تكون في يوم البداية أو بعده." : "End must be on or after the start date."}
          </div>
        )}

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: MUTED }}>
            {ar ? "لماذا لم تُنجز / سبب التوكيل" : "Why it was not done / reason"}
          </span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={ar ? "سبب التوكيل (مطلوب)" : "Delegation reason (required)"}
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
              ? `أقرّ أن التوكيل ينتهي بنهاية يوم ${end || "—"}، ويحق للموكِّل إنهاؤه قبل ذلك.`
              : `I acknowledge the delegation ends at the close of ${end || "—"}, and the delegator may end it earlier.`}
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
            onClick={() => {
              onConfirm?.({
              toId,
              reason: reason.trim(),
              delegatedAt: start,
              actingUntil: end,
              kind: "delegate",
            });
            }}
            className="rounded-lg px-3 py-1.5 text-xs text-white disabled:opacity-50"
            style={{ background: NAVY_FILL }}
          >
            {ar ? "توكيل" : "Delegate"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
