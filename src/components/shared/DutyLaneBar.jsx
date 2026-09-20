import React from "react";
import { dutyLaneFromSearch, writeDutyLane } from "@/lib/dutyLane";

export { dutyLaneFromSearch, writeDutyLane };

const LINE = "#dfe3ea";
const INK = "#14213d";
const MID = "#4b5567";

function laneBtn(on) {
  return {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: on ? 700 : 400,
    padding: "9px 16px",
    border: `1px solid ${on ? INK : LINE}`,
    background: on ? INK : "#fff",
    color: on ? "#fff" : MID,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
  };
}

/**
 * Shared mine / manage split for duty surfaces.
 * Hidden when the person has no branches or permission to administer.
 */
export default function DutyLaneBar({
  ar,
  canManage = false,
  lane = "mine",
  onLane,
  manageCount = 0,
}) {
  if (!canManage) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, padding: "9px 14px", display: "flex", gap: 5, flexWrap: "wrap" }}>
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
              background: lane === "manage" ? "#1d9a5b" : "#f5f6f8",
              color: lane === "manage" ? "#fff" : MID,
              padding: "1px 7px",
            }}
          >
            {manageCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}

