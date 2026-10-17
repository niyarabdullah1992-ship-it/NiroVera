import React, { useEffect, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import VoiceRecorder from "@/components/tasks/VoiceRecorder";
import { BORDER, BRAND, CARD, CONTROL_RADIUS, MUTED, field } from "@/lib/platformStyles";
import { mono } from "@/components/schedules/scheduleChrome";

// Platform bar: one framed row (hairline, radius 8) holding the fields; square ghost tools at radius 8,
// one green send. Figures in mono ink — no pill circles, no chat-app chrome.
const round = { ...field, height: 36, borderRadius: CONTROL_RADIUS, padding: "7px 12px", fontSize: 13 };
const iconBtn = {
  width: 36,
  height: 36,
  borderRadius: CONTROL_RADIUS,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--nv-ink2)",
  cursor: "pointer",
  flexShrink: 0,
  padding: 0,
};
const num = { ...mono, color: "var(--nv-ink)", fontWeight: 700 };

/** Task footer in the platform frame. Short daily quota auto-opens a blocker (reason required). */
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
        // One calm line: today's share, what is on record, what remains — figures in mono ink.
        <div data-nv-task-quota style={{ display: "flex", alignItems: "baseline", columnGap: 6, rowGap: 2, flexWrap: "wrap", fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
          <span>{ar ? "حصة اليوم" : "Today's share"} <span dir="ltr" style={num}>{expected}</span></span>
          <span aria-hidden>·</span>
          <span>{ar ? "سُجّل" : "Logged"} <span dir="ltr" style={num}>{loggedToday}</span></span>
          <span aria-hidden>·</span>
          <span>{ar ? "المتبقي" : "Left"} <span dir="ltr" style={num}>{remaining}</span></span>
          {stopRequired ? (
            <span style={{ color: "var(--nv-warn-ink)", marginInlineStart: 6 }}>{ar ? "أقل من الحصة — يُفتح العائق: تمديد أو توزيع تلقائي." : "Below quota — the blocker opens: extend or auto-spread."}</span>
          ) : null}
        </div>
      ) : null}

      {(stopRequired || issue) && !approved && !awaiting ? (
        <input
          value={stopReason}
          onChange={(e) => setStopReason(e.target.value)}
          placeholder={missed
            ? (ar ? "سبب عدم الإنجاز اليوم…" : "Why nothing was finished today…")
            : (ar ? "سبب عدم إكمال الحصة (مثال: أُنجز 1 من 2)…" : "Why the quota was short (e.g. 1 of 2)…")}
          style={{ ...round, borderColor: "var(--nv-warn-line)", background: "var(--nv-warn-soft)", width: "100%" }}
        />
      ) : null}

      <div data-nv-task-bar style={{ display: "flex", alignItems: "flex-end", gap: 4, padding: 4, border: `1px solid ${BORDER}`, borderRadius: CONTROL_RADIUS, background: "var(--nv-card, #fff)" }}>
        {canLog ? (
          <label
            data-nv-task-qty-field
            title={ar ? "المنجز اليوم — اكتب العدد" : "Done today — type the number"}
            style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 4px 0 10px", paddingInlineStart: 10, paddingInlineEnd: 4, borderRadius: CONTROL_RADIUS, background: "var(--nv-soft, #F6F8FA)", border: `1px solid ${BORDER}`, flexShrink: 0, cursor: "text" }}
          >
            <span style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, whiteSpace: "nowrap" }}>{ar ? "المنجز اليوم" : "Done today"}</span>
          <input
            data-nv-task-qty
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={amount}
            placeholder="0"
            aria-label={ar ? "المنجز اليوم" : "Done today"}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, "");
              setAmount(raw);
            }}
            style={{
              ...round,
              ...mono,
              width: 52,
              height: 28,
              textAlign: "center",
              padding: "0 4px",
              flexShrink: 0,
              background: "var(--nv-card, #fff)",
              color: "var(--nv-ink)",
              fontWeight: 700,
              MozAppearance: "textfield",
            }}
          />
          </label>
        ) : null}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={1}
          placeholder={ar ? "رسالة…" : "Message…"}
          style={{ ...round, flex: 1, height: "auto", minHeight: 36, maxHeight: 88, resize: "none", lineHeight: 1.45, border: "none", background: "transparent", boxShadow: "none" }}
        />
        <label style={{ ...iconBtn, cursor: "pointer" }} title={ar ? "أرفق" : "Attach"}>
          <Paperclip size={16} strokeWidth={1.75} />
          <input type="file" style={{ display: "none" }} onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
        </label>
        <VoiceRecorder disabled={busy} compact onRecorded={attachVoice} />
        {!approved && qty < 1 ? (
          <button
            type="button"
            data-nv-task-missed={issue ? "on" : "off"}
            aria-pressed={issue}
            onClick={() => setIssue((v) => !v)}
            title={ar ? "لم يُنجز شيء اليوم — يُطلب السبب" : "Nothing done today — a reason is asked"}
            style={{
              ...iconBtn,
              width: "auto",
              padding: "0 11px",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              border: `1px solid ${issue ? "var(--nv-bad-line)" : BORDER}`,
              background: issue ? "var(--nv-bad-soft)" : "transparent",
              color: issue ? "var(--nv-bad-ink)" : "var(--nv-ink2)",
            }}
          >
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, border: `1.5px solid currentColor`, background: issue ? "currentColor" : "transparent", flexShrink: 0 }} />
            {ar ? "بلا إنجاز" : "Nothing done"}
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
          title={canSubmit ? (ar ? "أرسل" : "Send") : (ar ? "اكتب رسالة أو أرفق إثباتاً" : "Write a message or attach proof")}
          style={{
            ...iconBtn,
            // The platform primary, always green; resting at low strength until there is something to send.
            background: BRAND,
            color: "#fff",
            opacity: canSubmit ? 1 : 0.38,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          <Send size={16} strokeWidth={1.75} />
        </button>
      </div>
      {proofFile ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--nv-ink2)" }}>
          <Paperclip size={13} strokeWidth={1.75} aria-hidden />
          <span dir="auto" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proofFile.name}</span>
          <button type="button" aria-label={ar ? "أزل المرفق" : "Remove attachment"} onClick={() => setProofFile(null)} style={{ border: "none", background: "transparent", color: MUTED, cursor: "pointer", fontFamily: "inherit" }}>{ar ? "أزل" : "Remove"}</button>
        </div>
      ) : null}
      {proofVoice ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <audio src={proofVoice.url || ""} controls style={{ height: 28, maxWidth: 180 }} />
          <button type="button" onClick={() => setProofVoice(null)} style={{ border: "none", background: "transparent", color: MUTED, cursor: "pointer" }}>×</button>
        </div>
      ) : null}
      {logBlocked || (stopRequired && !hasStop) || proofMissing ? (
        <div style={{ fontSize: 11, color: "var(--nv-bad-ink)", lineHeight: 1.45 }}>
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
