import React, { useState } from "react";
import { TASK_MODES, deriveTaskHeatBanNotice, normalizeTaskMode, taskModeConsequence, taskModeLabel } from "@/lib/opsDerivations";
import HeatBanNotice from "@/components/shared/HeatBanNotice";
import ComposerModalShell from "@/components/shared/ComposerModalShell";
import SubTypeOption, { SubTypeGrid } from "@/components/requests/SubTypeOption";
import { AckLine, FieldBlock, ReasonBox, TaskDialogFooter } from "@/components/tasks/TaskDialogParts";

/** The attestation follows the chosen place; its consequence is already on the option itself. */
const ATTEST = {
  onsite: { ar: "أؤكد أن العمل داخل المنشأة.", en: "I confirm the work is indoors at the facility." },
  field: { ar: "أؤكد أن العمل في الهواء الطلق.", en: "I confirm the work is in the open air." },
  remote: { ar: "أؤكد أن العمل عن بُعد.", en: "I confirm the work is remote." },
};

/**
 * Set where a task is carried out: indoors at the facility, in the open air, or
 * remote. The place decides the attendance gate and the sun ban, so it is
 * chosen explicitly and the reason is kept on the task's trail.
 */
export default function OpsModeConfirmModal({ task, ar, busy, initialMode, onClose, onConfirm }) {
  const [mode, setMode] = useState(normalizeTaskMode(initialMode) || normalizeTaskMode(task?.mode));
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);

  if (!task) return null;

  const current = normalizeTaskMode(task.mode);
  const heatNotice = deriveTaskHeatBanNotice({ ...task, mode });
  const missing = [
    !mode || mode === current ? (ar ? "مكان غير الحالي" : "a place other than the current one") : "",
    !reason.trim() ? (ar ? "سبب التحويل" : "the reason") : "",
    !ack ? (ar ? "التأكيد" : "the confirmation") : "",
  ].filter(Boolean);

  return (
    <ComposerModalShell
      ar={ar}
      asForm={false}
      zIndex={120}
      dataNv="mode"
      title={ar ? "مكان التنفيذ" : "Where the work happens"}
      hint={ar
        ? `الحالي: ${taskModeLabel(task.mode, "ar")}. المكان يحدّد بوابة الحضور وحظر العمل تحت أشعة الشمس.`
        : `Current: ${taskModeLabel(task.mode, "en")}. The place decides the attendance gate and the midday sun ban.`}
      onClose={onClose}
      footer={(
        <TaskDialogFooter
          ar={ar}
          onClose={onClose}
          busy={busy}
          missing={missing}
          label={ar ? "تأكيد المكان" : "Confirm place"}
          onConfirm={() => onConfirm?.({ mode, reason: reason.trim() })}
        />
      )}
    >
      <FieldBlock label={ar ? "المكان" : "Place"} dataKey="mode-place">
        <SubTypeGrid label={ar ? "مكان التنفيذ" : "Place"} wide>
          {TASK_MODES.map((m) => (
            <SubTypeOption
              key={m.id}
              dataKey={m.id}
              on={mode === m.id}
              onClick={() => { setMode(m.id); setAck(false); }}
              title={ar ? m.ar : m.en}
              sub={taskModeConsequence(m.id, { ar })}
              badge={current === m.id ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--nv-muted)", border: "1px solid var(--nv-line)", borderRadius: 999, padding: "0 7px", lineHeight: "18px" }}>
                  {ar ? "الحالي" : "Current"}
                </span>
              ) : null}
            />
          ))}
        </SubTypeGrid>
      </FieldBlock>

      {/* Switching the place is not a completion, so the level follows the task's
          span rather than the clock — red once the span touches the season, and
          the heavier red of a live refusal stays with the log gate. */}
      {heatNotice ? <HeatBanNotice notice={heatNotice} ar={ar} /> : null}

      <FieldBlock label={ar ? "سبب التحويل" : "Reason"} dataKey="mode-reason">
        <ReasonBox value={reason} onChange={setReason} placeholder={ar ? "مثال: نُقل العمل إلى المستودع المغطّى" : "e.g. the work moved to the covered warehouse"} />
      </FieldBlock>

      {mode && mode !== current ? (
        <AckLine checked={ack} onChange={setAck}>
          {ar ? ATTEST[mode]?.ar : ATTEST[mode]?.en}
        </AckLine>
      ) : null}
    </ComposerModalShell>
  );
}
