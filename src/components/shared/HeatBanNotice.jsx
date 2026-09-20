import React from "react";
import { MUTED, NAVY } from "@/lib/platformStyles";
import LaborArticleCite from "@/components/shared/LaborArticleCite";

/**
 * One paint for the sun ban across the platform, chosen by the level the
 * derivation returned — never by the surface. Inside the season the ban is a red
 * alert whatever the hour, because the hands must stop today: `alert` is the
 * quieter red of the season, `block` the heavier one an attempted open-air action
 * meets inside the banned hours, marked further by a thick leading edge. `cite`
 * is the decision read as reference, which is what an off-season open-air place
 * is entitled to and no more — no red outside 15 June – 15 September.
 */
const SKIN = {
  cite: { border: "var(--nv-line, #E2E8F0)", background: "var(--nv-inset, var(--nv-soft, #F7F8FA))", color: NAVY, label: MUTED, edge: 1 },
  alert: { border: "#f0d0d4", background: "#fdf2f2", color: "#8a1c2b", label: "#8a1c2b", edge: 1, chip: "block" },
  block: { border: "#FECACA", background: "#FEF2F2", color: "#B91C1C", label: "#B91C1C", edge: 3, chip: "block" },
};

export default function HeatBanNotice({ notice, ar = true }) {
  if (!notice) return null;
  const skin = SKIN[notice.level] || SKIN.cite;
  return (
    <div
      data-nv-heat-level={notice.level}
      data-nv-heat-state={notice.state || ""}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 11,
        lineHeight: 1.7,
        color: skin.color,
        background: skin.background,
        border: `1px solid ${skin.border}`,
        borderInlineStartWidth: skin.edge,
        borderInlineStartColor: skin.edge > 1 ? skin.label : skin.border,
        borderRadius: 9,
        padding: "7px 9px",
      }}
    >
      <span>
        <strong style={{ color: skin.label }}>{ar ? notice.labelAr : notice.labelEn}</strong>
        {" — "}
        {ar ? notice.textAr : notice.textEn}
      </span>
      <LaborArticleCite
        cite={notice.cite}
        ruleId={notice.cite ? undefined : "hours.heat.cite"}
        ar={ar}
        showText
        showOfficial
        tone={skin.chip}
      />
    </div>
  );
}
