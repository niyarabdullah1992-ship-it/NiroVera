import React from "react";
import { flagKind, flagStyle, flagText } from "@/lib/statusFlag";

/** Small status chip — renders only for warn/bad tones (ok/mute stay colourless). */
export function StatusFlag({ tone, flag, ar = true, style }) {
  const kind = flagKind(tone);
  if (!kind) return null;
  return (
    <span data-status-flag={kind} style={flagStyle(tone, style)}>
      {flagText(tone, ar, flag)}
    </span>
  );
}

/** A card label with its status chip beside it (chip only when warn/bad). */
export function FlagLabel({ tone, flag, ar = true, children, style, gap = 6 }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap, flexWrap: "wrap", minWidth: 0, ...style }}>
      {children}
      <StatusFlag tone={tone} flag={flag} ar={ar} />
    </span>
  );
}

export default StatusFlag;
