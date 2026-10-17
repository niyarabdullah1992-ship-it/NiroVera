import React, { useMemo, useState } from "react";
import { taskAssigneeId } from "@/lib/opsDerivations";
import PlatformDateField from "@/components/shared/PlatformDateField";
import ComposerModalShell from "@/components/shared/ComposerModalShell";
import { AckLine, FieldBlock, ReasonBox, TaskDialogFooter, TaskPersonPicker, dateKeyText } from "@/components/tasks/TaskDialogParts";

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

/** Inclusive days between two yyyy-mm-dd keys (the delegation covers both ends). */
function spanDays(start, end) {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start || "");
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(end || "");
  if (!a || !b) return 0;
  const ms = new Date(Number(b[1]), Number(b[2]) - 1, Number(b[3])) - new Date(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  return Math.round(ms / 86400000) + 1;
}

const daysAr = (n) => (n === 1 ? "يوم واحد" : n === 2 ? "يومان" : n >= 3 && n <= 10 ? `${n} أيام` : `${n} يوماً`);

/**
 * Manager-only توكيل — start/end dates + reason; ends only via الموكِّل later.
 */
export default function OpsReassignModal({
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
  const [delegatedAt, setDelegatedAt] = useState(todayKey());
  const [actingUntil, setActingUntil] = useState(addDaysKey(todayKey(), 7));
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);

  if (!task) return null;

  const start = String(delegatedAt || "").slice(0, 10);
  const end = String(actingUntil || "").slice(0, 10);
  const rangeOk = !!start && !!end && end >= start;
  const days = rangeOk ? spanDays(start, end) : 0;
  const endText = dateKeyText(end, ar);
  const missing = [
    !toId ? (ar ? "اختيار الموكَّل إليه" : "the delegate") : "",
    !rangeOk ? (ar ? "مدة صحيحة" : "a valid period") : "",
    !reason.trim() ? (ar ? "سبب التوكيل" : "the reason") : "",
    !ack ? (ar ? "الإقرار" : "the acknowledgement") : "",
  ].filter(Boolean);

  return (
    <ComposerModalShell
      ar={ar}
      asForm={false}
      zIndex={120}
      dataNv="delegate"
      title={ar ? "توكيل المهمة" : "Delegate task"}
      hint={ar
        ? "إسناد مؤقت ببداية ونهاية. يبقى المرجع على بطاقة المهمة، ويحق للموكِّل إنهاء الوكالة قبل نهايتها."
        : "A temporary assignment with a start and an end. The reference stays on the task card; the delegator may end it early."}
      onClose={onClose}
      footer={(
        <TaskDialogFooter
          ar={ar}
          onClose={onClose}
          busy={busy}
          missing={missing}
          label={ar ? "توكيل" : "Delegate"}
          onConfirm={() => onConfirm?.({
            toId,
            reason: reason.trim(),
            delegatedAt: start,
            actingUntil: end,
            kind: "delegate",
          })}
        />
      )}
    >
      <FieldBlock label={ar ? "الموكَّل إليه" : "Delegate to"} dataKey="delegate-to">
        <TaskPersonPicker ar={ar} options={options} value={toId} onChange={setToId} stations={stations} label={ar ? "الموكَّل إليه" : "Delegate to"} />
      </FieldBlock>

      <FieldBlock
        label={ar ? "مدة التوكيل" : "Delegation period"}
        dataKey="delegate-period"
        hint={rangeOk
          ? (ar
            ? `${daysAr(days)} · تنتهي بنهاية ${endText}`
            : `${days} day${days === 1 ? "" : "s"} · ends at the close of ${endText}`)
          : null}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "من" : "From"}</span>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "حتى" : "Until"}</span>
            <PlatformDateField
              value={actingUntil}
              min={start || undefined}
              onChange={(next) => setActingUntil(String(next || "").slice(0, 10))}
              ar={ar}
              placeholder={ar ? "تاريخ النهاية" : "End date"}
            />
          </div>
        </div>
        {start && end && end < start ? (
          <span style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--nv-warn-ink)" }}>
            {ar ? "النهاية يجب أن تكون في يوم البداية أو بعده." : "End must be on or after the start date."}
          </span>
        ) : null}
      </FieldBlock>

      <FieldBlock label={ar ? "سبب التوكيل" : "Reason"} dataKey="delegate-reason">
        <ReasonBox value={reason} onChange={setReason} placeholder={ar ? "مثال: إجازة المسؤول الأصلي أو ضغط العمل في موقعه" : "e.g. the owner is on leave"} />
      </FieldBlock>

      <AckLine checked={ack} onChange={setAck}>
        {ar
          ? `أقرّ أن التوكيل ينتهي بنهاية ${endText}، ويحق للموكِّل إنهاؤه قبل ذلك.`
          : `I acknowledge the delegation ends at the close of ${endText}, and the delegator may end it earlier.`}
      </AckLine>
    </ComposerModalShell>
  );
}
