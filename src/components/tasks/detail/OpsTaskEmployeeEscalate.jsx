import React, { useState } from "react";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import { BORDER, CARD, MUTED, NAVY, NAVY_FILL } from "@/lib/platformStyles";
import { OPS_EMPLOYEE_ESCALATE_AFTER } from "@/lib/opsDerivations";

const btn = { padding: "9px 16px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

/** After three written rejects, the assignee may escalate to the next chain level. */
export default function OpsTaskEmployeeEscalate({
  ar,
  busy,
  rejectCount = 0,
  canEscalate = false,
  isAssignee = false,
  onEscalate,
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const n = Math.max(0, Number(rejectCount) || 0);
  if (!isAssignee || (n < 1 && !canEscalate)) return null;

  return (
    <OpsTaskSection tone="warn" title={ar ? "حق التصعيد" : "Right to escalate"}>
      <div style={{ fontSize: 12, color: "var(--nv-warn-ink)", lineHeight: 1.65 }}>
        {canEscalate
          ? (ar
            ? `رُفض إنجازك ${OPS_EMPLOYEE_ESCALATE_AFTER} مرات — يحق لك التصعيد للمستوى التالي. السبب يظهر في مراسلات البطاقة.`
            : `Your work was rejected ${OPS_EMPLOYEE_ESCALATE_AFTER} times — you may escalate to the next level. The reason stays on the card thread.`)
          : (ar
            ? `رُفض الإنجاز ${n} من ${OPS_EMPLOYEE_ESCALATE_AFTER}. بعد ثلاثة رفض يحق للمنفّذ التصعيد، ويظهر السبب في مراسلات البطاقة.`
            : `Rejected ${n} of ${OPS_EMPLOYEE_ESCALATE_AFTER}. After three rejects the executor may escalate, and the reason stays on the card thread.`)}
      </div>
      {canEscalate ? (
        <div style={{ marginTop: 12 }}>
          {!open ? (
            <button type="button" disabled={busy} onClick={() => setOpen(true)} style={{ ...btn, background: NAVY_FILL, color: "#fff", border: "none", opacity: busy ? 0.5 : 1 }}>
              {ar ? "تصعيد للمستوى التالي" : "Escalate to next level"}
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={ar ? "سبب التصعيد (يظهر في مراسلات البطاقة)" : "Escalation reason (shown on the card thread)"}
                style={{ width: "100%", border: "1px solid var(--nv-line)", borderRadius: 9, background: CARD, padding: "9px 12px", fontSize: 12, color: NAVY, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{ar ? "السبب علني على البطاقة — ليُعرف لماذا صُعّدت المهمة." : "The reason is public on the card — so why it was escalated stays visible."}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ ...btn, padding: "7px 13px", fontSize: 11, fontWeight: 400, border: `1px solid ${BORDER}`, background: CARD, color: MUTED }}>{ar ? "إلغاء" : "Cancel"}</button>
                <button
                  type="button"
                  disabled={busy || !reason.trim()}
                  onClick={() => onEscalate?.(reason.trim())}
                  style={{ ...btn, padding: "7px 13px", fontSize: 11, border: "none", background: NAVY_FILL, color: "#fff", opacity: busy || !reason.trim() ? 0.5 : 1 }}
                >
                  {ar ? "تأكيد التصعيد" : "Confirm escalate"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </OpsTaskSection>
  );
}
