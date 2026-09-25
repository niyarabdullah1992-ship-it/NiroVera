import React from "react";
import { docFrame, DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { BORDER, CARD, CONTROL_RADIUS, MUTED, NAVY, ui } from "@/lib/platformStyles";

function addDays(iso, n) {
  const raw = String(iso || "").slice(0, 10);
  const d = new Date(`${raw || new Date().toISOString().slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Manager strip: extend one day or spread the remainder. Sits under pace, above chat. */
export default function OpsTaskBlockerResolve({
  ar,
  busy,
  canManage,
  blocker,
  dueAt,
  onExtend,
  onRedistribute,
}) {
  const open = blocker && blocker.status === "open";
  if (!open) return null;

  const expected = Math.max(0, Number(blocker.expected) || 0);
  const logged = Math.max(0, Number(blocker.logged) || 0);
  const partial = (blocker.kind || (logged > 0 ? "partial" : "missed")) === "partial";
  const reason = String(blocker.reason || "").trim();
  const nextDue = addDays(dueAt, 1);
  const canAct = canManage && !busy;

  return (
    <section
      data-nv-task-blocker
      style={{
        ...docFrame("waiting"),
        padding: 16,
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 650, color: "var(--nv-warn-ink)" }}>
        {partial
          ? (ar ? `أدخلت ${logged} من تارقت اليوم ${expected} — اختر ماذا تفعل بالمتبقي` : `You entered ${logged} of today's target ${expected} — choose what happens to the remainder`)
          : (ar ? `أدخلت 0 من تارقت اليوم ${expected} — اختر ماذا تفعل بالمتبقي` : `You entered 0 of today's target ${expected} — choose what happens to the remainder`)}
      </div>
      <div style={{ fontSize: 12, color: NAVY, lineHeight: 1.55, marginTop: 4 }}>
        {ar
          ? "تمديد يوم للاستحقاق، أو توزيع المتبقي تلقائيًا على بقية الأيام."
          : "Extend the due date by one day, or auto-spread the remainder across remaining days."}
      </div>
      {!canManage ? (
        <div style={{ fontSize: 11, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>
          {ar ? "اختر: تمديد، أو توزيع المتبقي على بقية الأيام." : "Choose: extend, or spread the remainder across remaining days."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            disabled={!canAct || !nextDue}
            onClick={() => onExtend?.({ dueAt: nextDue, reason, ...blocker })}
            style={{
              ...ui.btnMiniBrand,
              height: 36,
              padding: "0 12px",
              borderRadius: CONTROL_RADIUS || DS_CONTROL_RADIUS,
              opacity: canAct && nextDue ? 1 : 0.5,
              cursor: canAct && nextDue ? "pointer" : "not-allowed",
            }}
          >
            {ar ? "تمديد" : "Extend"}
          </button>
          <button
            type="button"
            disabled={!canAct}
            onClick={() => onRedistribute?.({ reason, ...blocker })}
            style={{
              ...ui.btnMini,
              height: "auto",
              minHeight: 36,
              whiteSpace: "normal",
              lineHeight: 1.35,
              padding: "8px 10px",
              background: CARD,
              color: NAVY,
              border: `1px solid ${BORDER}`,
              opacity: canAct ? 1 : 0.5,
              cursor: canAct ? "pointer" : "not-allowed",
            }}
          >
            {ar ? "توزيع المتبقي على بقية الأيام" : "Spread remainder across remaining days"}
          </button>
        </div>
      )}
    </section>
  );
}
