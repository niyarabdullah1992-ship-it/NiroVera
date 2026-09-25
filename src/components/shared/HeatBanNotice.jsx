import React from "react";
import { MUTED, NAVY } from "@/lib/platformStyles";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import LawGateAlertRow from "@/components/shared/LawGateAlertRow";
import {
  DECISION_3337_TEXT_AR,
  DECISION_3337_TEXT_EN,
  heatBanDecisionLabel,
} from "@/lib/heatBanDecision";

/**
 * Sun-ban notice — soft card + status pill (Design System v2).
 * Level comes from the derivation: cite / alert / block.
 */
const LEVEL_PILL = {
  cite: { status: "void", ar: "بلا أثر", en: "No effect" },
  alert: { status: "waiting", ar: "داخل الحظر", en: "Inside the ban" },
  block: { status: "blocked", ar: "مُنع", en: "Blocked" },
};

export default function HeatBanNotice({ notice, ar = true }) {
  if (!notice) return null;
  const level = notice.level || "cite";
  const pill = LEVEL_PILL[level] || LEVEL_PILL.cite;
  return (
    <div
      data-nv-heat-level={notice.level}
      data-nv-heat-state={notice.state || ""}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontSize: 11,
        lineHeight: 1.7,
        color: NAVY,
        background: "var(--nv-card, #fff)",
        border: "1px solid var(--nv-line, #E2E8F0)",
        borderRadius: 10,
        padding: "9px 11px",
      }}
    >
      <LawGateAlertRow
        ar={ar}
        status={pill.status}
        pillLabel={ar ? pill.ar : pill.en}
        summary={
          <span>
            <strong style={{ color: NAVY }}>{ar ? notice.labelAr : notice.labelEn}</strong>
            {" — "}
            <span style={{ color: MUTED }}>{ar ? notice.textAr : notice.textEn}</span>
          </span>
        }
      />
      <LaborArticleCite
        cite={notice.cite}
        ruleId={notice.cite ? undefined : "hours.heat.cite"}
        ar={ar}
        showText
        showOfficial
        tone={level === "block" ? "block" : (level === "alert" ? "warn" : undefined)}
      />
      {level !== "cite" ? (
        <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.7 }}>
          {heatBanDecisionLabel(ar)}: «{ar ? DECISION_3337_TEXT_AR : DECISION_3337_TEXT_EN}»
        </span>
      ) : null}
    </div>
  );
}
