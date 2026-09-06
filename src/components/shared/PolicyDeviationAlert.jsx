import React from "react";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { BAD } from "@/lib/platformStyles";

/** Named ministry-policy block: the article appears when the action would break it. */
export default function PolicyDeviationAlert({ gate, ruleId, leaveType, profile, ar = true }) {
  if (!gate || gate.ok) return null;
  return (
    <div
      role="alert"
      style={{
        ...BAD,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontSize: 12, lineHeight: 1.65 }}>
        {ar ? gate.reason : (gate.reasonEn || gate.reason)}
      </div>
      <LaborArticleCite cite={gate.cite} ruleId={ruleId} leaveType={leaveType} profile={profile} ar={ar} showText />
    </div>
  );
}
