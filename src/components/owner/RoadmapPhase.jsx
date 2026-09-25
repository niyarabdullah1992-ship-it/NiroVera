import React from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { ownerPaper } from "@/components/owner/ownerUi";

function toneState(tone) {
  if (tone === "completed") return "ok";
  if (tone === "current") return "warn";
  return "mute";
}

export default function RoadmapPhase({ data }) {
  return (
    <article style={{ ...ownerPaper(toneState(data.tone)), padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--nv-muted)" }}>{data.phase}</p>
          <h3 className="nv-h" style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: "var(--nv-ink)" }}>{data.title}</h3>
        </div>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid var(--nv-line)",
          background: "var(--nv-soft)",
          color: "var(--nv-ink2)",
        }}>
          <Clock3 className="h-3.5 w-3.5" />
          {data.period}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.items.map((item) => (
          <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, lineHeight: 1.65, color: "var(--nv-ink2)" }}>
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--nv-accent)" }} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
