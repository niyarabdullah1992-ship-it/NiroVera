import React, { useState } from "react";
import VoiceRecorder from "@/components/tasks/VoiceRecorder";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import { BORDER, BRAND, CARD, MUTED, NAVY, SURFACE, field } from "@/lib/platformStyles";

const dashed = { display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 13px", borderRadius: 9, border: "1px dashed #CBD5E1", background: CARD, fontSize: 12, color: MUTED, cursor: "pointer" };

/** Log-completion block: quantity, evidence (file / voice / attestation), submit. */
export default function OpsTaskLogBox({ ar, busy, doneN, targetN, onsiteBlocked, attendanceGate, onLog }) {
  const [amount, setAmount] = useState(1);
  const [attest, setAttest] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofVoice, setProofVoice] = useState(null);
  const hasProof = !!proofFile || !!proofVoice || attest.trim().length > 0;
  const canLog = hasProof && !onsiteBlocked;
  const blockReason = !hasProof
    ? (ar ? "لا نقطة بلا أثر — أرفق صورة أو ملاحظة صوتية أو اكتب إفادة أولًا." : "No point without a trace — attach a photo, a voice note or write an attestation first.")
    : onsiteBlocked ? (attendanceGate?.reason || (ar ? "تسجيل الإنجاز الميداني موقوف حتى بصمة اليوم." : "On-site logging is blocked until today's check-in.")) : "";

  return (
    <OpsTaskSection title={ar ? "تسجيل الإنجاز" : "Log completion"}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11, color: MUTED }}>{ar ? "العدد المنجز" : "Quantity"}</span>
          <input type="number" min={1} max={Math.max(1, targetN - doneN)} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 1)} style={{ ...field, width: 88 }} />
        </label>
        <label style={dashed}>
          <span>{proofFile ? proofFile.name : (ar ? "أرفق صورة/ملف" : "Attach photo/file")}</span>
          <input type="file" style={{ display: "none" }} onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
        </label>
        <VoiceRecorder disabled={busy} onRecorded={setProofVoice} />
      </div>
      {proofVoice && (
        <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <audio src={proofVoice.url} controls style={{ height: 28 }} />
          <button type="button" onClick={() => setProofVoice(null)} style={{ border: "none", background: "transparent", color: MUTED, cursor: "pointer" }}>×</button>
        </div>
      )}
      <textarea value={attest} onChange={(e) => setAttest(e.target.value)} rows={2} placeholder={ar ? "إفادة غير مصوَّرة: من يشهد، وماذا أُنجز بالضبط…" : "Non-photographed evidence: who attests, and exactly what was done…"} style={{ width: "100%", marginTop: 10, border: `1px solid ${BORDER}`, borderRadius: 9, background: SURFACE, padding: "9px 12px", fontSize: 12, color: NAVY, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={busy || !canLog}
          onClick={async () => {
            await onLog?.({ amount, proofFile, proofVoice, attestation: attest.trim() }); setProofVoice(null); setProofFile(null); setAttest("");
          }}
          style={{ padding: "9px 16px", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 600, fontFamily: "inherit", background: canLog ? BRAND : "#E2E8F0", color: canLog ? "#fff" : MUTED, cursor: canLog ? (busy ? "wait" : "pointer") : "not-allowed", opacity: busy ? 0.6 : 1 }}
        >
          {ar ? "سجّل الإنجاز" : "Log completion"}
        </button>
        {!canLog && <span style={{ fontSize: 11, color: "#B91C1C", lineHeight: 1.6 }}>{blockReason}</span>}
      </div>
    </OpsTaskSection>
  );
}