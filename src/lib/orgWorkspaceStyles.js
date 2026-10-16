import { CONTROL_RADIUS, PAPER_SHADOW, RADIUS, ui } from "@/lib/platformStyles";

/** The branches-tree panel: a slab on the page, a full card-coloured sheet in full screen. */
export const orgPanelShell = (fullscreen = false) => (fullscreen
  ? {
      position: "fixed",
      inset: 0,
      zIndex: 400,
      width: "100vw",
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: "var(--nv-card)",
      overflow: "hidden",
    }
  : {
      width: "100%",
      background: "var(--nv-card)",
      border: "1px solid var(--nv-line)",
      borderRadius: RADIUS,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: PAPER_SHADOW,
    });

/** Secondary control — same geometry as the platform ghost button. */
export const orgBtnGhost = {
  fontFamily: "inherit",
  cursor: "pointer",
  height: 32,
  padding: "0 12px",
  borderRadius: CONTROL_RADIUS,
  border: "1px solid var(--nv-line)",
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  fontSize: 12,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
};

/** Primary control — platform ui.btnCreate; a held action dims and says why in its title. */
export const orgBtnPrimary = (disabled = false) => ({
  ...ui.btnCreate,
  ...(disabled ? { opacity: 0.5, cursor: "not-allowed" } : null),
});
