import React from "react";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { PERF_BODY, PERF_LINE, PERF_MUTED, PERF_NAVY, PERF_SOFT, PERF_WHITE } from "@/components/performance/PerformanceSectionFrame";

export default function PerfRangeBar({ ar, from, to, presets = [], onFrom, onTo, onPreset, note, valid = true }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: ar ? "flex-end" : "flex-start" }}>
      <div style={{ display: "flex", gap: 0, alignItems: "stretch", border: `1px solid ${PERF_LINE}`, background: PERF_WHITE }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 2, padding: "7px 12px", borderInlineEnd: `1px solid ${PERF_SOFT}` }}>
          <span style={{ fontSize: 10, color: PERF_MUTED }}>{ar ? "من" : "From"}</span>
          <PlatformDateField compact ar={ar} value={from} onChange={onFrom} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 2, padding: "7px 12px", borderInlineEnd: `1px solid ${PERF_SOFT}` }}>
          <span style={{ fontSize: 10, color: PERF_MUTED }}>{ar ? "إلى" : "To"}</span>
          <PlatformDateField compact ar={ar} value={to} min={from} onChange={onTo} />
        </label>
        {presets.map((preset) => {
          const on = from === preset.from && to === preset.to;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPreset?.(preset)}
              style={{
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: on ? 700 : 400,
                padding: "0 12px",
                border: "none",
                borderInlineEnd: `1px solid ${PERF_SOFT}`,
                background: on ? PERF_NAVY : PERF_WHITE,
                color: on ? "#fff" : PERF_BODY,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {ar ? preset.labelAr : preset.labelEn}
            </button>
          );
        })}
      </div>
      {note ? (
        <span style={{ fontSize: 11, color: valid ? PERF_BODY : "#8a1c2b", lineHeight: 1.7, textAlign: "start" }}>{note}</span>
      ) : null}
    </div>
  );
}
