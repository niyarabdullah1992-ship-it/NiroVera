import React from "react";
import VoiceAuditTrail from "@/components/complaints/VoiceAuditTrail";
import VoiceRelatedLinks from "@/components/complaints/VoiceRelatedLinks";
import { voicePublicId } from "@/lib/voiceBoard";

function pillOf(card, ar) {
  if (card.outcome === "adopt") {
    return { text: ar ? "مُعتمد" : "Adopted", color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)" };
  }
  if (card.outcome === "return") {
    return { text: ar ? "أُعيد بملاحظة" : "Returned", color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" };
  }
  if (card.overdue) {
    return { text: ar ? "صُعّد" : "Escalated", color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)" };
  }
  if (card.level > 0) {
    return { text: ar ? "صُعّد" : "Escalated", color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" };
  }
  return { text: ar ? "بانتظار" : "Waiting", color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" };
}

function barOf(card) {
  const max = Number(card.ch?.hours) || 48;
  if (card.settled && card.outcome === "adopt") return { width: "100%", background: "#3C7D50" };
  if (card.left == null) return { width: "4%", background: "#C8A45A" };
  const used = Math.max(0, max - card.left);
  const pct = Math.max(4, Math.min(100, Math.round((used / max) * 100)));
  const background = card.overdue || pct > 75 ? "#9B2335" : "#C8A45A";
  return { width: `${pct}%`, background };
}

export default function VoiceMineBoard({ cards = [], chain = [], ar, onEscalate }) {
  return (
    <section style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--nv-paper)" }}>
      <header style={{ padding: "14px 16px", borderBottom: "1px solid var(--nv-line)" }}>
        <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{ar ? "ما أرسلتُه" : "What I sent"}</strong>
      </header>
      {cards.length === 0 ? (
        <div style={{ padding: "16px", fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8 }}>
          {ar ? "لا شيء بعد. ابدأ بقناة واحدة — والاقتراح باسمك، والشكوى بهويّة ظاهرة، والبلاغ المجهول يُتابَع برقمه لا باسمك." : "Nothing yet. Start with one channel. A suggestion is in your name, a complaint is named, and an anonymous report is followed by its number."}
        </div>
      ) : cards.map((card) => {
        const pill = pillOf(card, ar);
        const bar = barOf(card);
        const owner = card.steps?.[card.level]?.name || "—";
        return (
          <article key={card.item.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 }}>
                <strong style={{ fontSize: 13, color: "var(--nv-ink)", lineHeight: 1.5 }}>{card.title || "—"}</strong>
                <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>
                  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", unicodeBidi: "isolate" }}>{voicePublicId(card.item)}</span>
                  {" · "}
                  {card.channel || "—"}
                </span>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, flex: "none", color: pill.color, background: pill.background }}>{pill.text}</span>
            </div>
            <div style={{ height: 5, borderRadius: 999, background: "var(--nv-line)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 999, width: bar.width, background: bar.background }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5, color: "var(--nv-muted)" }}>
              <span>{ar ? "لدى:" : "With:"} {owner}</span>
              <span>{card.settled ? (ar ? "أُغلق بقرار مكتوب" : "Closed with a written ruling") : (card.left == null ? "—" : card.slaVal)}</span>
            </div>
            <div style={{ display: "flex", gap: 0, flexWrap: "wrap", border: "1px solid var(--nv-line)", borderRadius: 8, overflow: "hidden" }}>
              {(card.steps || []).map((step, index) => {
                const on = index === card.level && !card.settled;
                return (
                  <span key={`${step.name}-${index}`} style={{ flex: "1 1 90px", minWidth: 0, padding: "7px 8px", borderInlineStart: index ? "1px solid var(--nv-line)" : "none", background: on ? "var(--nv-ok-soft)" : "transparent", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: on ? 700 : 500, color: on ? "var(--nv-ink)" : "var(--nv-muted)", lineHeight: 1.4 }}>{step.name || "—"}</span>
                    <span style={{ fontSize: 9, color: "var(--nv-muted)" }}>{step.when || "—"}</span>
                  </span>
                );
              })}
            </div>
            {card.reply ? (
              <span style={{ fontSize: 11, color: card.outcome === "adopt" ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)", background: card.outcome === "adopt" ? "var(--nv-ok-soft)" : "var(--nv-warn-soft)", border: "1px solid var(--nv-line)", borderRadius: 10, padding: "9px 11px", lineHeight: 1.8 }}>{card.reply}</span>
            ) : null}
            {card.canEscalate ? (
              <button type="button" onClick={() => onEscalate(card)} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "8px 12px", border: "1px solid var(--nv-line)", borderRadius: 999, background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer", alignSelf: "flex-start" }}>
                {ar ? `لم أقتنع — ارفعه إلى ${chain[card.level + 1]?.labelAr || "المستوى التالي"}` : `I do not accept this — raise it to ${chain[card.level + 1]?.labelEn || "the next level"}`}
              </button>
            ) : null}
            <VoiceAuditTrail events={card.audit} ar={ar} />
            <VoiceRelatedLinks links={card.related} ar={ar} />
          </article>
        );
      })}
    </section>
  );
}
