import React from "react";
import { ACCENT, DANGER, INK, MUTED, statCard, num } from "@/lib/platformStyles";

/**
 * Paper KPI tiles inside a stamp — no navy rail.
 * @param {{ stats: { label: string, value: string | number, hint?: string, suffix?: string, tone?: "ok" | "warn" | "danger" | null }[] }} props
 */
export default function KpiStrip({ stats = [], rail = false }) {
  if (!stats.length) return null;

  const valueColor = (tone) => {
    if (tone === "danger") return DANGER;
    if (tone === "warn") return "#B45309";
    if (tone === "ok") return ACCENT;
    return INK;
  };
  const railColor = (tone) => {
    if (tone === "danger") return "#8a1c2b";
    if (tone === "warn") return "#c9962b";
    if (tone === "ok") return "var(--nv-accent, #1E9E63)";
    return "var(--nv-navy, #14284B)";
  };

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
            borderTop: rail ? `3px solid ${railColor(item.tone)}` : undefined,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 500, color: MUTED }}>
            {item.label}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <div dir="ltr" style={{ ...num(valueColor(item.tone)), fontSize: 22 }}>
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
