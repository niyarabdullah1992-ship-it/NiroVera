import React from "react";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import LawGateStatusPill from "@/components/shared/LawGateStatusPill";
import { statusBanner, statusBannerQuiet } from "@/lib/platformStyles";

/** Named ministry-policy block: quiet LawGates row — pill, reason, article cite. */
export default function PolicyDeviationAlert({ gate, ruleId, leaveType, profile, ar = true, quietEdge = false }) {
  if (!gate || gate.ok) return null;
  const skin = quietEdge ? statusBannerQuiet.bad : statusBanner.bad;
  return (
    <div
      role="alert"
      style={{
        ...skin,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        dir={ar ? "rtl" : "ltr"}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10,
          width: "100%",
        }}
      >
        <LawGateStatusPill status="blocked" ar={ar} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.65, color: "var(--nv-ink2, #334155)" }}>
          {ar ? gate.reason : (gate.reasonEn || gate.reason)}
        </div>
      </div>
      <LaborArticleCite cite={gate.cite} ruleId={ruleId} leaveType={leaveType} profile={profile} ar={ar} showText tone="block" />
    </div>
  );
}
