import React from "react";
import { voiceBarOf, voicePillOf } from "@/components/complaints/VoiceMineBoard";
import { voicePublicId } from "@/lib/voiceBoard";
import CollapsibleItemCard, { useCollapsibleItems } from "@/components/shared/CollapsibleItemCard";

/**
 * «قائمة الأصوات» items — the same folded card as «أصواتي», one per voice, tightest window first.
 * The row names the voice, who holds it and the time left; opening it shows the window bar and
 * the written ruling (renderBody) in place — no separate picker.
 */
export default function VoiceQueueList({ cards = [], focusId = "", ar, emptyText, renderBody }) {
  const { isOpen, toggle } = useCollapsibleItems(cards.map((card) => card.item.id), focusId);
  if (cards.length === 0) {
    return <div className="nv-cic" data-voice-queue-empty="1" style={{ padding: 16, fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8 }}>{emptyText}</div>;
  }
  return (
    <div className="nv-list-stack" data-voice-queue-list="1">
      {cards.map((card) => {
        const pill = voicePillOf(card, ar);
        const bar = voiceBarOf(card);
        const owner = card.steps?.[card.level]?.name || "—";
        const id = String(card.item.id);
        return (
          <CollapsibleItemCard
            key={id}
            id={`nv-voice-${id}`}
            data-voice-pick={id}
            open={isOpen(id)}
            onToggle={() => toggle(id)}
            dot={bar.background}
            title={card.title || "—"}
            person={`${card.channel || "—"}${card.item.channel === "anonymous" ? "" : ` · ${voicePublicId(card.item)}`} · ${ar ? "لدى" : "with"} ${owner}`}
            date={card.slaVal}
            status={<span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, flex: "none", color: pill.color, background: pill.background }}>{pill.text}</span>}
            ar={ar}
          >
            <span style={{ display: "block", width: "100%", height: 5, borderRadius: 999, background: "var(--nv-line)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", borderRadius: 999, width: bar.width, background: bar.background }} />
            </span>
            {renderBody ? renderBody(card) : null}
          </CollapsibleItemCard>
        );
      })}
    </div>
  );
}
