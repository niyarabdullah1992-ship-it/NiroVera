import React from "react";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import EscalationLadder, { splitLabel } from "@/components/shared/EscalationLadder";

export default function VoiceChainBoard({ chain = [], note, ar }) {
  return (
    <OpsTaskSection
      title={ar ? "سلسلة المراجعة والتصعيد" : "Review and escalation chain"}
      hint={note || undefined}
    >
      {chain.length === 0 ? (
        <span style={{ fontSize: 12, color: "var(--nv-muted)", padding: "8px 0" }}>—</span>
      ) : (
        <EscalationLadder
          ar={ar}
          dataKey="voice-overview"
          steps={chain.map((step, i) => {
            const { name, role } = splitLabel(step.name);
            const vacant = /^مقعد شاغر|^Vacant seat/.test(String(step.name || ""));
            return {
              name,
              role,
              state: vacant ? "vacant" : i === 0 ? "next" : "later",
              note: vacant ? undefined : i === 0 ? (ar ? "يصله صوتك أولاً" : "Gets your voice first") : (ar ? "عند تجاوز المهلة" : "When the window passes"),
            };
          })}
        />
      )}
    </OpsTaskSection>
  );
}
