import React from "react";
import CollapsibleItemCard, { useCollapsibleItems } from "@/components/shared/CollapsibleItemCard";
import EscalationLadder from "@/components/shared/EscalationLadder";
import { voiceLadderSteps, voiceLadderWindow } from "@/components/complaints/voiceLadder";
import VoiceAuditTrail from "@/components/complaints/VoiceAuditTrail";
import VoiceRelatedLinks from "@/components/complaints/VoiceRelatedLinks";
import { voicePublicId } from "@/lib/voiceBoard";

export function voicePillOf(card, ar) {
  if (card.outcome === "adopt") {
    return { text: ar ? "مُعتمد" : "Adopted", color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)" };
  }
  if (card.outcome === "return") {
    return { text: ar ? "أُعيد بملاحظة" : "Returned", color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" };
  }
  if (card.overdue) {
    return { text: ar ? "صُعّد" : "Escalated", color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)" };
  }
  if (card.level > (Number(card.item?.reviewStartLevel) || 0)) {
    return { text: ar ? "صُعّد" : "Escalated", color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" };
  }
  return { text: ar ? "بانتظار" : "Waiting", color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" };
}

export function voiceBarOf(card) {
  const max = Number(card.ch?.hours) || 48;
  if (card.settled && card.outcome === "adopt") return { width: "100%", background: "#3C7D50" };
  if (card.left == null) return { width: "4%", background: "#C8A45A" };
  const used = Math.max(0, max - card.left);
  const pct = Math.max(4, Math.min(100, Math.round((used / max) * 100)));
  const background = card.overdue || pct > 75 ? "#9B2335" : "#C8A45A";
  return { width: `${pct}%`, background };
}

function pillNode(pill) {
  return <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, flex: "none", color: pill.color, background: pill.background }}>{pill.text}</span>;
}

/**
 * «أصواتي» items — each voice its own folded card under the «أصواتي» header card:
 * dot · title · public id · status; open for the ladder, the reply, the escalation and the trail.
 */
export default function VoiceMineBoard({ cards = [], chain = [], ar, onEscalate, focusId = "" }) {
  const { isOpen, toggle } = useCollapsibleItems(cards.map((card) => card.item.id), focusId);
  if (cards.length === 0) {
    return (
      <div className="nv-cic" style={{ padding: 16, fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8 }}>
        {ar ? "لا شيء بعد. ابدأ بقناة واحدة — والاقتراح باسمك، والشكوى بهويّة ظاهرة، والبلاغ المجهول يُتابَع برقمه لا باسمك." : "Nothing yet. Start with one channel. A suggestion is in your name, a complaint is named, and an anonymous report is followed by its number."}
      </div>
    );
  }
  return (
    <div className="nv-list-stack" data-voice-mine-list="1">
      {cards.map((card) => {
        const pill = voicePillOf(card, ar);
        const id = String(card.item.id);
        return (
          <CollapsibleItemCard
            key={id}
            id={`nv-voice-${id}`}
            open={isOpen(id)}
            onToggle={() => toggle(id)}
            dot={pill.color}
            title={card.title || "—"}
            person={card.channel || null}
            date={voicePublicId(card.item)}
            status={pillNode(pill)}
            ar={ar}
          >
            <EscalationLadder ar={ar} steps={voiceLadderSteps(card, ar)} window={voiceLadderWindow(card, ar)} dataKey="voice-mine" />
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
          </CollapsibleItemCard>
        );
      })}
    </div>
  );
}
