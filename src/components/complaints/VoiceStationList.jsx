import React from "react";
import { MUTED, NAVY, NEUTRAL, tableShell, CARD } from "@/lib/platformStyles";

const rowBtn = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  minHeight: 44,
  padding: "0 14px",
  border: "none",
  borderBottom: "1px solid var(--nv-line)",
  background: CARD,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "start",
};

/** Compact station rows — replaces the old stretched branch cards. */
export default function VoiceStationList({ stations = [], onPick, emptyLabel }) {
  if (!stations.length) {
    return (
      <div style={{ ...tableShell, padding: "16px 14px", fontSize: 13, color: MUTED, textAlign: "center" }}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div style={tableShell}>
      {stations.map((g, i) => (
        <button
          key={g.key}
          type="button"
          onClick={() => onPick?.(g.key)}
          style={{ ...rowBtn, borderBottom: i === stations.length - 1 ? "none" : rowBtn.borderBottom }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {g.name}
          </span>
          <span style={NEUTRAL}>{Number(g.count) || 0}</span>
        </button>
      ))}
    </div>
  );
}
