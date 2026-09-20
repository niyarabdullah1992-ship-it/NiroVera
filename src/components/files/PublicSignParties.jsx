import React from "react";
import { signKicker } from "@/components/files/signingUi";
import { BORDER, MUTED, NAVY } from "@/lib/platformStyles";
import { partiesFromPublicInfo, partyStatusLabel } from "@/lib/multiSignDerivations";
import { formatUiNumber } from "@/lib/dateFormat";

function toneOf(party) {
  if (party.status === "signed" || (party.you && party.status === "pending")) return "var(--nv-accent, #1E9E63)";
  if (party.status === "rejected") return "#DC2626";
  if (party.status === "skipped") return "#B45309";
  return BORDER;
}

export default function PublicSignParties({ ar, info, compact = false }) {
  const parties = partiesFromPublicInfo(info);
  if (!parties.length) return null;
  if (compact) {
    const signed = parties.filter((row) => row.status === "signed").length;
    return (
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: MUTED }}>
        {ar
          ? `توقيع متوازٍ · وقّع ${formatUiNumber(signed, true)} من ${formatUiNumber(parties.length, true)} · بانتظار ختمك`
          : `Parallel · ${signed} of ${parties.length} signed · awaiting your seal`}
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={signKicker}>{ar ? "الأطراف" : "Parties"}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {parties.map((party, index) => (
          <div
            key={`${party.name}-${index}`}
            style={{
              display: "grid",
              gridTemplateColumns: "8px minmax(0, 1fr) auto",
              gap: 10,
              alignItems: "center",
              fontSize: 13,
              color: NAVY,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: toneOf(party), flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: party.you ? 650 : 500 }}>
              {party.name}
            </span>
            <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>{partyStatusLabel(party, ar)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
