import React from "react";
import { dutyLaneFromSearch, writeDutyLane } from "@/lib/dutyLane";
import { useRailSide } from "@/lib/railSide";

export { dutyLaneFromSearch, writeDutyLane };

function laneBtn(on) {
  return {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: on ? 700 : 400,
    padding: "9px 16px",
    border: `1px solid ${on ? "var(--nv-navy)" : "var(--nv-line)"}`,
    background: on ? "var(--nv-navy)" : "transparent",
    color: on ? "#fff" : "var(--nv-ink2)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    borderRadius: 10,
  };
}

/**
 * Shared mine / manage split for duty surfaces.
 * Hidden when the person has no branches or permission to administer.
 * Active fill stays navy (`--nv-navy`) in both themes so the label stays light-on-dark.
 */
export default function DutyLaneBar({
  ar,
  canManage = false,
  lane = "mine",
  onLane,
  manageCount = 0,
}) {
  const railSide = useRailSide();
  // The rail tabs are the only switch. This bar stays only when no rail side is published yet.
  if (railSide === "employee" || railSide === "manage") return null;
  if (!canManage) return null;
  return (
    <div
      className="nv-doc"
      style={{
        background: "var(--nv-card)",
        border: "1px solid var(--nv-line)",
        padding: "9px 14px",
        display: "flex",
        gap: 5,
        flexWrap: "wrap",
      }}
    >
      <button type="button" onClick={() => onLane?.("mine")} style={laneBtn(lane === "mine")}>
        {ar ? "ملفي" : "My file"}
      </button>
      <button type="button" onClick={() => onLane?.("manage")} style={laneBtn(lane === "manage")}>
        {ar ? "إدارة" : "Manage"}
        {manageCount > 0 ? (
          <span
            dir="ltr"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              background: lane === "manage" ? "var(--nv-ok-fill, #1D9A5B)" : "var(--nv-mute-soft)",
              color: lane === "manage" ? "#fff" : "var(--nv-ink2)",
              padding: "1px 7px",
              borderRadius: 999,
            }}
          >
            {manageCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
