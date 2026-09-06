/** Shared chrome for /app/chat — same identity frame as the rest of the app. */
import { identityFrame } from "@/components/shared/IdentityCard";
import { ACCENT, BORDER, CARD, MUTED, NAVY, NAVY_FILL, SURFACE, field, filterChip, ui, NEUTRAL } from "@/lib/platformStyles";

export { ACCENT, BORDER, CARD, MUTED, NAVY, NAVY_FILL, SURFACE, field, filterChip, ui, NEUTRAL };

export const pane = {
  ...identityFrame,
  display: "flex",
  flexDirection: "column",
};

export const paneHeader = {
  padding: "12px 14px",
  borderBottom: `1px solid ${BORDER}`,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

export const channelBtn = (active) => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "10px 12px",
  border: "none",
  borderRadius: 10,
  background: active ? "color-mix(in oklab, #14284B 6%, #F7F8FA)" : "transparent",
  boxShadow: "none",
  color: active ? NAVY : MUTED,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: active ? 600 : 500,
  textAlign: "start",
});

export const tabBtn = (on) => ({
  ...filterChip(on),
  height: 28,
  padding: "0 11px",
  fontSize: 11,
});

export const composerInput = {
  ...field,
  flex: 1,
  height: 40,
  borderRadius: 999,
  background: SURFACE,
};

export const iconTile = {
  width: 40,
  height: 40,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background: SURFACE,
  color: NAVY,
  border: `1px solid ${BORDER}`,
  fontSize: 13,
  fontWeight: 600,
};
