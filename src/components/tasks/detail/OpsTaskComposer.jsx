import React, { useEffect, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import VoiceRecorder from "@/components/tasks/VoiceRecorder";
import { BORDER, BRAND, CARD, MUTED, SURFACE, field } from "@/lib/platformStyles";

const round = { ...field, height: 40, borderRadius: 20, padding: "8px 14px" };
const iconBtn = {
  width: 40,
  height: 40,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${BORDER}`,
  background: SURFACE,
  color: MUTED,
  cursor: "pointer",
  flexShrink: 0,
  padding: 0,
};

/** WhatsApp-style footer: compact bar. Short daily quota auto-opens a blocker (reason required). */
export default function OpsTaskComposer({
  ar,
  busy,
  approved,
  embedded = false,
  awaiting = false,
  doneN = 0,
  targetN = 1,
  todayExpected = 0,
  loggedToday = 0,
  onsiteBlocked = false,
  attendanceGate,
  onDraft,
  onSend,
}) {
  const remaining = Math.max(0, targetN - doneN);
  const [draft, setDraft] = useState("");
  const [issue, setIssue] = useState(false);
  const [amount, setAmount] = useState("");
  const [stopReason, setStopReason] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofVoice, setProofVoice] = useState(null);
  const canLog = !approved && !awaiting && !issue;
  const parsedAmount = amount === "" ? NaN : Number(amount);
  const qty = Number.isFinite(parsedAmount) ? Math.max(0, Math.min(remaining, Math.floor(parsedAmount))) : 0;
  const afterToday = Math.max(0, Number(loggedToday) || 0) + (canLog ? qty : 0);
  const expected = Math.max(0, Number(todayExpected) || 0);
  const loggingQty = canLog && qty >= 1;
  const stopRequired = (!approved && !awaiting) && (
    issue
    || (loggingQty && expected > 0 && qty < expected)
  );
  const missed = issue || (loggingQty && expected > 0 && afterToday <= 0);
  const hasProof = !!proofFile || !!proofVoice || !!draft.trim();
  const hasStop = stopReason.trim().length > 0;
  const logBlocked = canLog && onsiteBlocked && qty > 0;
  const ready = stopRequired && !hasStop
    ? false
    : (loggingQty
      ? hasProof
      : (hasProof || hasStop || !!draft.trim()));
  const canSubmit = ready && !busy && !logBlocked;
  // Attestation gate must name itself — a disabled Send with no reason reads as a malfunction.
  const proofMissing = loggingQty && !hasProof && !(stopRequired && !hasStop);
  const remainingToday = Math.max(0, expected - Math.max(0, Number(loggedToday) || 0));
  const pendingShort = loggingQty && expected > 0 && qty < expected;
  const blockReason = logBlocked
    ? (attendanceGate?.reason || (ar ? "تسجيل الإنجاز الميداني موقوف حتى بصمة اليوم." : "On-site logging is blocked until today's check-in."))
    : "";

  useEffect(() => {
    onDraft?.({ qty, issue, stopReason, pendingShort, stopRequired, text: draft, proofFile, proofVoice });
  }, [qty, loggedToday, expected, afterToday, remainingToday, stopRequired, pendingShort, loggingQty, issue, canLog, stopReason, draft, proofFile, proofVoice, amount, remaining]);

  const reset = () => {
    setDraft("");
    setIssue(false);
    setStopReason("");
    setAmount("");
    setProofFile(null);
    setProofVoice(null);
  };

  const attachVoice = (v) => {
    if (v instanceof File) setProofVoice({ url: URL.createObjectURL(v), name: v.name, type: v.type, localOnly: true });
    else setProofVoice(v);
  };

  return (
    <div data-nv-task-composer style={{ flexShrink: 0, padding: embedded ? 0 : "8px 12px 10px", borderTop: embedded ? "none" : `1px solid ${BORDER}`, background: CARD, display: "flex", flexDirection: "column", gap: 8 }}>
      {canLog && expected > 0 ? (
        <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.45 }}>
          {ar
            ? `حصة اليوم ${expected} · سُجّل ${loggedToday} · المتبقي ${remaining}${stopRequired ? " — الرقم أقل من الحصة؛ يُفتح العائق: تمديد أو توزيع تلقائي." : ""}`
            : `Today ${expected} · logged ${loggedToday} · left ${remaining}${stopRequired ? " — below quota; blocker opens: extend or auto-spread." : ""}`}
        </div>
      ) : null}

      {(stopRequired || issue) && !approved && !awaiting ? (
        <input
          value={stopReason}
          onChange={(e) => setStopReason(e.target.value)}
          placeholder={missed
            ? (ar ? "سبب عدم الإنجاز اليوم…" : "Why nothing was finished today…")
            : (ar ? "سبب عدم إكمال الحصة (مثال: أُنجز 1 من 2)…" : "Why the quota was short (e.g. 1 of 2)…")}
          style={{ ...round, borderColor: "#FDE68A", background: "#FFFBEB", width: "100%" }}
        />
      ) : null}

      <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
        {canLog ? (
          <input
            data-nv-task-qty
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={amount}
            placeholder={ar ? "أي رقم" : "Any"}
            title={ar ? "المنجز اليوم — اكتب أي رقم" : "Done today — type any number"}
            aria-label={ar ? "المنجز اليوم" : "Done today"}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, "");
              setAmount(raw);
            }}
            style={{
              ...round,
              width: 72,
              height: 40,
              textAlign: "center",
              padding: "0 8px",
              flexShrink: 0,
              borderRadius: 12,
              MozAppearance: "textfield",
            }}
          />
        ) : null}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={1}
          placeholder={ar ? "رسالة…" : "Message…"}
          style={{ ...round, flex: 1, height: "auto", minHeight: 40, maxHeight: 88, resize: "none", lineHeight: 1.45 }}
        />
        <label style={{ ...iconBtn, cursor: "pointer" }} title={ar ? "أرفق" : "Attach"}>
          <Paperclip size={16} strokeWidth={1.75} />
          <input type="file" style={{ display: "none" }} onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
        </label>
        <VoiceRecorder disabled={busy} compact onRecorded={attachVoice} />
        {!approved && qty < 1 ? (
          <button
            type="button"
            onClick={() => setIssue((v) => !v)}
            title={ar ? "بلا إنجاز اليوم" : "Nothing done today"}
            style={{
              ...iconBtn,
              width: "auto",
              padding: "0 10px",
              fontSize: 11,
              fontWeight: 650,
              fontFamily: "inherit",
              ...(issue ? { border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626" } : {}),
            }}
          >
            {ar ? "بلا إنجاز" : "Missed"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={!canSubmit}
          aria-label={ar ? "أرسل" : "Send"}
          onClick={async () => {
            const ok = await onSend?.({
              text: draft.trim(),
              isIssue: issue || stopRequired,
              amount: canLog ? qty : 0,
              proofFile,
              proofVoice,
              stopReason: stopReason.trim(),
              logCompletion: loggingQty && !onsiteBlocked,
            });
            if (ok !== false) reset();
          }}
          style={{
            ...iconBtn,
            border: "none",
            background: canSubmit ? BRAND : "#E2E8F0",
            color: canSubmit ? "#fff" : MUTED,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          <Send size={16} strokeWidth={1.75} />
        </button>
      </div>
      {proofFile ? <div style={{ fontSize: 11, color: MUTED }}>{proofFile.name}</div> : null}
      {proofVoice ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <audio src={proofVoice.url || ""} controls style={{ height: 28, maxWidth: 180 }} />
          <button type="button" onClick={() => setProofVoice(null)} style={{ border: "none", background: "transparent", color: MUTED, cursor: "pointer" }}>×</button>
        </div>
      ) : null}
      {logBlocked || (stopRequired && !hasStop) || proofMissing ? (
        <div style={{ fontSize: 11, color: "#B91C1C", lineHeight: 1.45 }}>
          {logBlocked
            ? blockReason
            : (stopRequired && !hasStop)
              ? (ar ? "اكتب سبب عدم إكمال حصة اليوم." : "Write why today's quota was not finished.")
              : (ar
                ? "لا يُسجَّل الإنجاز بلا إثبات — أضف إقرارًا كتابيًا أو مرفقًا أو تسجيلًا صوتيًا."
                : "Completion needs proof — add a written attestation, a file, or a voice note.")}
        </div>
      ) : null}
    </div>
  );
}
