import React from "react";
import { Clock3 } from "lucide-react";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { ACCENT, BORDER, MUTED, SURFACE } from "@/lib/platformStyles";

const segment = (active, compact) => ({
  height: compact ? "20px" : "26px",
  minWidth: compact ? "24px" : "34px",
  padding: compact ? "0 5px" : "0 9px",
  border: "none",
  borderRadius: compact ? "5px" : "7px",
  background: active ? ACCENT : "transparent",
  color: active ? "#fff" : MUTED,
  fontSize: compact ? "10.5px" : "11px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "'IBM Plex Mono', monospace",
});

export default function TimeFormatToggle({ lang, compact = false }) {
  const { format, setFormat } = useTimeFormat();
  const ar = lang === "ar";

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      role="group"
      aria-label={ar ? "نظام الساعة" : "Time format"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? "2px" : "6px",
        flexShrink: 0,
        height: compact ? "auto" : "34px",
        padding: compact ? 0 : "0 5px",
        borderRadius: compact ? 0 : "9px",
        border: compact ? "none" : `1px solid ${BORDER}`,
        background: compact ? "transparent" : SURFACE,
      }}
    >
      {compact ? null : <Clock3 style={{ width: 13, height: 13, color: MUTED, marginInlineStart: "5px" }} />}
      {compact ? null : <span style={{ fontSize: "11px", color: MUTED }}>{ar ? "نظام الساعة" : "Time format"}</span>}
      {["12", "24"].map((value) => (
        <button
          key={value}
          type="button"
          dir="ltr"
          onClick={() => setFormat(value)}
          aria-pressed={format === value}
          aria-label={ar ? `نظام ${value} ساعة` : `${value}-hour clock`}
          className={compact ? "nv-hdr-mini" : undefined}
          style={segment(format === value, compact)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
