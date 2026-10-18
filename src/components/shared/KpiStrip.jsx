import React from "react";
import { INK, MUTED, statCard, num } from "@/lib/platformStyles";
import { StatusFlag } from "@/components/shared/StatusFlag";

/**
 * Paper KPI tiles inside a stamp — no navy rail.
 * @param {{ ar?: boolean, stats: { label: string, value: string | number, hint?: string, suffix?: string, tone?: "ok" | "warn" | "danger" | null, flag?: string }[] }} props
 */
export default function KpiStrip({ stats = [], ar = true }) {
  if (!stats.length) return null;

  // KPI law: the number is always ink; a warn/danger tone shows as a calm chip only when `flag` names the problem.
  const chipTone = (tone) => (tone === "danger" ? "bad" : tone === "warn" ? "warn" : null);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))",
        gap: 12,
        textAlign: "start",
      }}
    >
      {stats.map((item) => (
        <div
          key={item.label}
          className="nv-kpi-tile nv-att-card"
          style={{
            ...statCard,
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11, fontWeight: 500, color: MUTED }}>
            {item.label}
            {item.flag ? <StatusFlag tone={chipTone(item.tone)} flag={item.flag} label={item.label} ar={ar} /> : null}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <div dir="ltr" style={{ ...num(INK), fontSize: 22 }}>
              {item.value}
            </div>
            {item.suffix ? (
              <span style={{ fontSize: 11, color: MUTED }}>{item.suffix}</span>
            ) : null}
          </div>
          {item.hint ? (
            <div style={{ marginTop: 5, fontSize: 10, color: MUTED, lineHeight: 1.45 }}>
              {item.hint}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
