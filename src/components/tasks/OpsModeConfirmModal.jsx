import React, { useState } from "react";
import { createPortal } from "react-dom";
import { BORDER, BRAND, CARD, MUTED, NAVY, textarea } from "@/lib/platformStyles";
import { TASK_MODES, deriveTaskHeatBanNotice, normalizeTaskMode, taskModeConsequence, taskModeLabel } from "@/lib/opsDerivations";
import HeatBanNotice from "@/components/shared/HeatBanNotice";

const chip = (on) => ({
  flex: "1 1 120px",
  padding: "8px 10px",
  borderRadius: 9,
  border: `1px solid ${on ? BRAND : BORDER}`,
  background: on ? "color-mix(in oklab, var(--nv-ok-ink) 10%, #fff)" : CARD,
  color: on ? "var(--nv-ok-ink)" : NAVY,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "center",
});

/** What each nature costs the crew — stated before the switch, not after.
 *  The consequence clause comes from the shared derivation so this dialog, the
 *  create form and the task card name the same hours. */
const ATTEST = {
  onsite: { ar: "أؤكد أن العمل داخل المنشأة", en: "I confirm the work is indoors at the facility" },
  field: { ar: "أؤكد أن العمل في الهواء الطلق", en: "I confirm the work is in the open air" },
  remote: { ar: "أؤكد أن العمل عن بُعد", en: "I confirm the work is remote" },
};

function consequenceLine(mode, ar) {
  const head = ar ? ATTEST[mode]?.ar : ATTEST[mode]?.en;
  const tail = taskModeConsequence(mode, { ar });
  if (!head) return "";
  return tail ? `${head} — ${tail}` : head;
}

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
  const canSubmit = !!mode && mode !== current && reason.trim().length > 0 && ack && !busy;
  const heatNotice = deriveTaskHeatBanNotice({ ...task, mode });

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
          {ar ? "مكان التنفيذ" : "Where the work happens"}
        </div>
        <p className="mt-1 text-[11px] leading-6" style={{ color: MUTED }}>
          {ar
            ? `الحالي: ${taskModeLabel(task.mode, "ar")}. المكان يحدّد بوابة الحضور وحظر العمل تحت أشعة الشمس، فاختره ثم اكتب السبب.`
            : `Current: ${taskModeLabel(task.mode, "en")}. The place decides the attendance gate and the midday sun ban — choose it, then write the reason.`}
        </p>

        <div className="mt-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: MUTED }}>
            {ar ? "المكان" : "Place"}
          </span>
          <div className="flex flex-wrap gap-2">
            {TASK_MODES.map((m) => (
              <button key={m.id} type="button" onClick={() => setMode(m.id)} style={chip(mode === m.id)}>
                {ar ? m.ar : m.en}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: MUTED }}>
            {ar ? "سبب التحويل" : "Reason"}
          </span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={ar ? "سبب التحويل (مطلوب)" : "Switch reason (required)"}
            style={textarea}
          />
        </label>

        {mode && (
          <label className="mt-3 flex items-start gap-2 text-[11px] leading-6" style={{ color: NAVY }}>
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5"
            />
            <span>{consequenceLine(mode, ar)}</span>
          </label>
        )}

        {/* Switching the place is not a completion, so the level follows the task's
            span rather than the clock — red once the span touches the season, and
            the heavier red of a live refusal stays with the log gate. */}
        {heatNotice ? (
          <div className="mt-2">
            <HeatBanNotice notice={heatNotice} ar={ar} />
          </div>
        ) : null}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-xs"
            style={{ color: MUTED, background: CARD, borderColor: BORDER }}
          >
            {ar ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onConfirm?.({ mode, reason: reason.trim() })}
            className="rounded-lg px-3 py-1.5 text-xs text-white disabled:opacity-50"
            style={{ background: mode === "field" ? NAVY : BRAND }}
          >
            {ar ? "تأكيد المكان" : "Confirm place"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
