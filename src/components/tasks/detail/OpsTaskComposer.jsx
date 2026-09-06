import React, { useState } from "react";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { BORDER, BRAND, CARD, MUTED, field } from "@/lib/platformStyles";

/** Footer composer — update or blocker, optional deadline-extension request. */
export default function OpsTaskComposer({ ar, busy, approved, onAddComment }) {
  const [draft, setDraft] = useState("");
  const [issue, setIssue] = useState(false);
  const [extendTo, setExtendTo] = useState("");
  const ready = !!draft.trim();
  const btn = { height: 38, padding: "0 14px", borderRadius: 9, fontSize: 12, fontFamily: "inherit", cursor: "pointer" };
  return (
    <div style={{ flexShrink: 0, padding: "12px 20px 16px", borderTop: `1px solid ${BORDER}`, background: CARD, display: "flex", flexDirection: "column", gap: 8, overflow: "visible", position: "relative", zIndex: 20 }}>
      {issue && !approved && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, overflow: "visible" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#B45309" }}>{ar ? "طلب تمديد الموعد إلى (اختياري)" : "Request deadline extension to (optional)"}</span>
          <PlatformDateField ar={ar} value={extendTo} onChange={setExtendTo} placement="top" />
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={ar ? "اكتب تحديثًا، أو سجّل عائقًا يمنع الإنجاز…" : "Write an update, or log a blocker…"} style={{ ...field, flex: "1 1 200px" }} />
        <button type="button" onClick={() => setIssue((v) => !v)} style={{ ...btn, ...(issue ? { border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontWeight: 600 } : { border: `1px solid ${BORDER}`, background: CARD, color: MUTED }) }}>
          {ar ? "علّمه عائقًا" : "Flag as blocker"}
        </button>
        <button
          type="button"
          disabled={busy || !ready}
          onClick={async () => { await onAddComment?.(draft.trim(), issue, { requestedDueAt: issue && extendTo ? extendTo : null }); setDraft(""); setIssue(false); setExtendTo(""); }}
          style={{ ...btn, border: "none", fontWeight: 600, background: ready ? BRAND : "#E2E8F0", color: ready ? "#fff" : MUTED, cursor: ready ? (busy ? "wait" : "pointer") : "not-allowed" }}
        >
          {ar ? "أرسل" : "Send"}
        </button>
      </div>
    </div>
  );
}