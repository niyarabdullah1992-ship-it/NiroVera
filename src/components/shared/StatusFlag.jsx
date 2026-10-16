import React from "react";
import { Link } from "react-router-dom";
import { flagKind, flagStyle, kpiActionStyle, kpiActionText, kpiFlagText, meterStyles } from "@/lib/statusFlag";

/**
 * Small status chip — renders only for warn/bad tones (ok/mute stay colourless).
 * Pass `label` (the card label) so a chip that would just repeat it is dropped.
 */
export function StatusFlag({ tone, flag, ar = true, label = "", style }) {
  const kind = flagKind(tone);
  if (!kind) return null;
  const text = kpiFlagText({ tone, flag, label, ar });
  if (!text) return null;
  return (
    <span data-status-flag={kind} style={flagStyle(tone, style)}>
      {text}
    </span>
  );
}

/** A card label with its status chip beside it (chip only when warn/bad and not a repeat of the label). */
export function FlagLabel({ tone, flag, ar = true, children, style, gap = 6 }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap, flexWrap: "wrap", minWidth: 0, ...style }}>
      {children}
      <StatusFlag tone={tone} flag={flag} ar={ar} label={typeof children === "string" ? children : ""} />
    </span>
  );
}

/**
 * Queue / pending-decision tiles are actions, not problems: a small green line
 * («افتح القرار ›»). Renders a Link when `to` is given and the card itself is not
 * already a link (`asText`), else a plain span styled as the action.
 */
export function KpiAction({ to, onClick, ar = true, text = "", textEn = "", asText = false, style }) {
  const label = kpiActionText(ar, text, textEn);
  const s = { ...kpiActionStyle, ...style };
  if (onClick && !asText) {
    return <button type="button" onClick={onClick} data-kpi-action="1" style={{ ...s, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>;
  }
  if (to && !asText) return <Link to={to} data-kpi-action="1" style={s}>{label}</Link>;
  return <span data-kpi-action="1" style={s}>{label}</span>;
}

/** Thin score meter (4px, rounded, hairline track, platform-green fill). */
export function KpiMeter({ value, max = 100, label }) {
  const m = meterStyles(value, max);
  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Number(value) || 0}
      aria-label={label || undefined}
      data-kpi-meter={m.pct}
      style={m.track}
    >
      <span style={m.fill} />
    </span>
  );
}

export default StatusFlag;
