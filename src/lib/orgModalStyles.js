/**
 * Shared chrome for org-tree create/edit sheets — platform tokens only.
 */
import { ACCENT, MUTED, NAVY, SURFACE, field, labelMuted, dialogOverlay, dialogCard, ui, CARD } from "@/lib/platformStyles";

export { ACCENT, CARD, MUTED, NAVY, SURFACE, field, labelMuted, dialogOverlay, dialogCard, ui };

export const sheetForm = {
  ...dialogCard,
  maxWidth: "560px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  padding: "20px 22px",
};

export const inputField = {
  ...field,
};

export const selectField = {
  ...field,
  appearance: "auto",
};

export const labelText = {
  ...labelMuted,
  fontWeight: 600,
  marginBottom: "7px",
};

export const hintText = {
  margin: "6px 0 0",
  fontSize: "11px",
  lineHeight: 1.65,
  color: MUTED,
};

export function segmentBtn(active) {
  return {
    borderRadius: 10,
    border: "none",
    background: active ? CARD : "transparent",
    boxShadow: "none",
    padding: "11px 12px",
    fontSize: "13px",
    fontWeight: 600,
    color: active ? NAVY : MUTED,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

export const softPanel = {
  borderRadius: 14,
  border: "1px solid #E2E8F0",
  background: SURFACE,
  padding: "12px 14px",
};

export const closeBtn = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid #E2E8F0",
  background: CARD,
  color: MUTED,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontFamily: "inherit",
};

export const mapBtn = {
  ...ui.btnSecondary,
  width: "100%",
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontWeight: 600,
};

export const saveBtn = {
  ...ui.btnBlock,
  marginTop: 0,
  height: 42,
  opacity: 1,
};

export const titleStyle = {
  margin: 0,
  fontSize: 15,
  fontWeight: 600,
  color: NAVY,
  letterSpacing: "-0.01em",
};

export const subtitleStyle = {
  margin: "6px 0 0",
  fontSize: 12,
  lineHeight: 1.65,
  color: MUTED,
};
