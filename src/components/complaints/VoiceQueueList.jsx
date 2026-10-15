import React from "react";
import { voiceBarOf, voicePillOf } from "@/components/complaints/VoiceMineBoard";
import { voicePublicId } from "@/lib/voiceBoard";

/** «طابور المراجعة» — the same card as «ما أرسلتُه», one row per voice; picking one opens it in the decision card. */
export default function VoiceQueueList({ cards = [], selectedId, onPick, ar, emptyText }) {
  return (
    <section data-voice-queue="1" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--nv-paper)", minWidth: 0 }}>
      <header style={{ padding: "14px 16px", borderBottom: "1px solid var(--nv-line)", display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{ar ? "طابور المراجعة" : "Review queue"}</strong>
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? "ما ضاق وقته أولاً" : "Tightest window first"}</span>
      </header>
      {cards.length === 0 ? (
        <div style={{ padding: 16, fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8 }}>{emptyText}</div>
      ) : cards.map((card) => {
        const pill = voicePillOf(card, ar);
        const bar = voiceBarOf(card);
        const owner = card.steps?.[card.level]?.name || "—";
        const on = String(card.item.id) === String(selectedId);
        return (
          <button
            key={card.item.id}
            type="button"
            data-voice-pick={card.item.id}
            aria-pressed={on}
            onClick={() => onPick(card.item.id)}
            style={{ fontFamily: "inherit", textAlign: "start", width: "100%", border: "none", borderBottom: "1px solid var(--nv-line)", background: on ? "var(--nv-ok-soft)" : "var(--nv-card)", boxShadow: on ? "inset -3px 0 0 #C8A45A" : "none", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, cursor: "pointer", color: "var(--nv-ink)" }}
          >
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, width: "100%" }}>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 }}>
                <strong style={{ fontSize: 13, lineHeight: 1.5 }}>{card.title || "—"}</strong>
                <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>
                  {card.item.channel === "anonymous" ? null : <><span dir="ltr" style={{ unicodeBidi: "isolate" }}>{voicePublicId(card.item)}</span>{" · "}</>}
                  {card.channel || "—"}
                </span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, flex: "none", color: pill.color, background: pill.background }}>{pill.text}</span>
            </span>
            <span style={{ display: "block", width: "100%", height: 5, borderRadius: 999, background: "var(--nv-line)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", borderRadius: 999, width: bar.width, background: bar.background }} />
            </span>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 8, width: "100%", fontSize: 11.5, color: "var(--nv-muted)" }}>
              <span>{ar ? "لدى:" : "With:"} {owner}</span>
              <span style={{ color: card.slaColor, fontWeight: 600 }}>{card.slaVal}</span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
