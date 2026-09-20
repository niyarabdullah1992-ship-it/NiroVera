import React, { useState } from "react";
import EscalationSteps from "@/components/escalation/EscalationSteps";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import { BORDER, CARD, MUTED, NAVY, NAVY_FILL } from "@/lib/platformStyles";

const btn = { padding: "9px 16px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

/** Awaiting-approval block: explanation, escalation ladder, approve / reject with reason. */
export default function OpsTaskApprovalBox({ ar, busy, canManage, points, targetN, currentLevelLabel, escalationSteps, t, lang, onApprove, onReject }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <OpsTaskSection tone="warn" title={canManage ? (ar ? "بانتظار اعتمادك" : "Awaiting your approval") : (ar ? "بانتظار اعتماد المستوى الحالي" : "Awaiting the current level")}>
      <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.65, textWrap: "pretty" }}>
        {ar
          ? `اكتمل العدد ${targetN}/${targetN} وأُرفق الإثبات. الاعتماد يمنح ${points} نقطة ويُقفل أمر العمل. الرفض يُعيد المهمة للمنفّذ، وسببه يظهر في مراسلات البطاقة. بعد ثلاثة رفض يحق للمنفّذ التصعيد.`
          : `${targetN}/${targetN} logged with proof. Approval grants ${points} points and closes the work order. A reject returns the task to the executor, and the reason stays on the card thread. After three rejects the executor may escalate.`}
        {currentLevelLabel ? (ar ? ` المستوى الحالي: ${currentLevelLabel}.` : ` Current level: ${currentLevelLabel}.`) : ""}
      </div>
      {Array.isArray(escalationSteps) && escalationSteps.length > 0 && t && (
        <div style={{ marginTop: 10 }}><EscalationSteps steps={escalationSteps} t={t} lang={lang || (ar ? "ar" : "en")} /></div>
      )}
      {canManage ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" disabled={busy} onClick={() => onApprove?.()} style={{ ...btn, background: "#1E9E63", color: "#fff", border: "none", opacity: busy ? 0.5 : 1 }}>{ar ? "اعتمد الإنجاز" : "Approve completion"}</button>
          <button type="button" disabled={busy} onClick={() => setOpen(true)} style={{ ...btn, background: CARD, color: "#B45309", border: "1px solid #FDE68A" }}>{ar ? "رفض — يُعاد للمنفّذ" : "Reject — return"}</button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "#B45309", marginTop: 8 }}>{ar ? "لا تُمنح النقاط قبل الاعتماد." : "Points are not granted before approval."}</div>
      )}
      {open && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={ar ? "سبب الرفض (يظهر في مراسلات البطاقة)" : "Rejection reason (shown on the card thread)"} style={{ width: "100%", border: "1px solid #FECACA", borderRadius: 9, background: CARD, padding: "9px 12px", fontSize: 12, color: NAVY, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
          <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{ar ? "السبب علني على البطاقة — ليُعرف لماذا رُفض الإنجاز." : "The reason is public on the card — so why it was rejected stays visible."}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setOpen(false)} style={{ ...btn, padding: "7px 13px", fontSize: 11, fontWeight: 400, border: `1px solid ${BORDER}`, background: CARD, color: MUTED }}>{ar ? "إلغاء" : "Cancel"}</button>
            <button type="button" disabled={busy || !reason.trim()} onClick={() => onReject?.(reason.trim())} style={{ ...btn, padding: "7px 13px", fontSize: 11, border: "none", background: NAVY_FILL, color: "#fff", opacity: busy || !reason.trim() ? 0.5 : 1 }}>{ar ? "تأكيد الرفض" : "Confirm reject"}</button>
          </div>
        </div>
      )}
    </OpsTaskSection>
  );
}