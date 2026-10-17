import EscalationLadder from "@/components/shared/EscalationLadder";
import { voiceLadderSteps, voiceLadderWindow } from "@/components/complaints/voiceLadder";
import React from "react";
import VoiceAuditTrail from "@/components/complaints/VoiceAuditTrail";
import VoiceRelatedLinks from "@/components/complaints/VoiceRelatedLinks";
import { voicePublicId } from "@/lib/voiceBoard";

function stepHead(n, label) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#0B3D27", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, flex: "none" }}>{n}</span>
      <strong style={{ fontSize: 14, color: "var(--nv-ink)" }}>{label}</strong>
      <span style={{ flex: 1, height: 1, background: "var(--nv-line)" }} />
    </div>
  );
}

const btn = (kind, off) => ({
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: 700,
  minHeight: 42,
  padding: "8px 12px",
  width: "100%",
  textAlign: "center",
  lineHeight: 1.4,
  borderRadius: 10,
  cursor: off ? "default" : "pointer",
  border: `1px solid ${kind === "go" && !off ? "#0B3D27" : "var(--nv-line)"}`,
  background: kind === "go" && !off ? "#0B3D27" : "var(--nv-card)",
  color: off ? "var(--nv-muted)" : kind === "go" ? "#fff" : "var(--nv-ink)",
});

/**
 * «بطاقة القرار» — the manager's side of the employee's «بطاقة صوت الموظف»: the same green head and
 * numbered steps. 1 the voice · 2 the chain and the window · 3 the written ruling.
 */
export default function VoiceDecisionCard({ card, ar, note, onNote, noteReady, ownVoice, onAdopt, onReturn, onEscalate, embedded = false }) {
  if (!card) {
    return (
      <article style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, padding: 24, fontSize: 12.5, color: "var(--nv-muted)", boxShadow: "var(--nv-paper)" }}>
        {ar ? "لا صوت بانتظار قرارك في هذا الترشيح." : "No voice awaits your ruling in this filter."}
      </article>
    );
  }
  const anon = card.item.channel === "anonymous";
  // embedded: inside a folded list card — the card's own row already names the voice, so no green head or frame.
  return (
    <article data-voice-decision={card.item.id} style={embedded ? { minWidth: 0 } : { background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--nv-paper)", minWidth: 0 }}>
      {embedded ? null : <header style={{ background: "linear-gradient(135deg, #0B3D27, #0F5535)", color: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span aria-hidden style={{ width: 44, height: 44, borderRadius: 10, background: "#C8A45A", color: "#0B3D27", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3 8-8" />
            <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: 17 }}>{ar ? `بطاقة القرار — ${card.channel}` : `Ruling card — ${card.channel}`}</strong>
          <span style={{ fontSize: 12, color: "#C5DBCD" }}>{card.title}</span>
        </div>
        <span dir="ltr" style={{ fontWeight: 600, fontSize: 12, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 6, padding: "3px 10px" }}>{voicePublicId(card.item)}</span>
      </header>}
      <div style={{ padding: embedded ? 0 : "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        {stepHead("1", ar ? "الصوت — ما رُفع ومن رفعه" : "The voice — what was raised and by whom")}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8 }}>{card.meta}</span>
          {card.body ? <p style={{ margin: 0, fontSize: 13, color: "var(--nv-ink)", lineHeight: 1.9, background: "var(--nv-soft, #F6F8F7)", border: "1px solid var(--nv-line)", borderRadius: 10, padding: "10px 12px" }}>{card.body}</p> : null}
          {anon ? (
            <span style={{ fontSize: 11.5, color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", border: "1px solid var(--nv-line)", borderRadius: 10, padding: "9px 11px", lineHeight: 1.9 }}>
              {ar
                ? `بلاغ مجهول: لا تُطلب هويّة مُبلِّغه ولا يُراسَل شخصياً. يُعالَج بوقائعه، ويُنشر قراره بالرقم ${card.item.anonymousId || "—"}.`
                : `Anonymous: the reporter is not named or written to. It is handled on its facts, and the ruling is published under ${card.item.anonymousId || "—"}.`}
            </span>
          ) : null}
        </div>

        {stepHead("2", ar ? "السلسلة والمهلة" : "Chain and window")}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <EscalationLadder ar={ar} steps={voiceLadderSteps(card, ar)} window={voiceLadderWindow(card, ar)} dataKey="voice-decision" />
        </div>

        {stepHead("3", ar ? "القرار — مكتوب قبل الإغلاق" : "The ruling — written before closing")}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            value={note}
            onChange={(event) => onNote(event.target.value)}
            rows={3}
            placeholder={anon
              ? (ar ? "حيثيات القرار — تُنشر بالرقم لا بمخاطبة شخصية" : "Ruling reasons — published by number, not as a personal letter")
              : (ar ? "القرار وما سيُنفَّذ — يصل صاحب الصوت، وهو إلزامي للاعتماد والإعادة" : "The ruling and what will be done — the author sees it; required to adopt or return")}
            style={{ fontFamily: "inherit", fontSize: 13, padding: "10px 12px", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-card)", color: "var(--nv-ink)", outline: "none", resize: "vertical", minHeight: 84 }}
          />
          <div data-voice-actions="1" className="nv-voice-actions" style={{ display: "grid", gap: 8 }}>
            <button type="button" onClick={onAdopt} style={btn("go", !noteReady || ownVoice)}>
              {ownVoice ? (ar ? "صوتك — صعّده للمستوى التالي" : "Your voice — escalate it") : noteReady ? (ar ? "اعتماد بقرار مكتوب" : "Adopt with a written ruling") : (ar ? "الاعتماد يحتاج قراراً مكتوباً" : "Adopting needs a written ruling")}
            </button>
            <button type="button" onClick={onReturn} style={btn("plain", !noteReady || ownVoice)}>
              {noteReady ? (ar ? "أَعِد بملاحظة" : "Return with a note") : (ar ? "الإعادة تحتاج ملاحظة" : "A return needs a note")}
            </button>
            <button type="button" onClick={onEscalate} style={btn("plain", card.atTop)}>
              {card.atTop ? (ar ? "بلغ آخر السلسلة" : "End of the chain") : (ar ? "صعّد للمستوى التالي" : "Escalate to the next level")}
            </button>
          </div>
          <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.8 }}>
            {ar ? "كل إجراء يُقيَّد في مسار القرار بوقته. صاحب الصوت المسمّى يرى من قرّر؛ والبلاغ المجهول يُعرض مساره بلا اسم المراجع." : "Every action is written on the decision path. The named author sees who ruled; an anonymous path hides the reviewer's name."}
          </span>
          <VoiceAuditTrail events={card.audit} ar={ar} />
          <VoiceRelatedLinks links={card.related} ar={ar} />
        </div>
      </div>
    </article>
  );
}
