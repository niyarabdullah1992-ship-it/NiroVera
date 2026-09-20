import { BORDER, CARD, MUTED, NAVY, NAVY_FILL, SURFACE } from "@/lib/platformStyles";

export const ORG_GREEN = "hsl(154 79% 27%)";
export const ORG_AMBER = "hsl(41 62% 38%)";

export const orgPanelShell = (fullscreen = false) => (fullscreen
  ? {
      position: "fixed",
      inset: 0,
      zIndex: 400,
      width: "100vw",
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: CARD,
      overflow: "hidden",
    }
  : {
      width: "100%",
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 14,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
    });

export const orgInput = {
  height: 34,
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  padding: "0 11px",
  fontSize: 12,
  fontFamily: "inherit",
  background: CARD,
  color: NAVY,
  minWidth: 0,
};

export const orgSelect = {
  ...orgInput,
  padding: "0 9px",
};

export const orgBtnGhost = {
  all: "unset",
  cursor: "pointer",
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: NAVY,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "inherit",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

export const orgBtnPrimary = (disabled = false) => ({
  ...orgBtnGhost,
  background: disabled ? SURFACE : NAVY_FILL,
  border: `1px solid ${disabled ? BORDER : NAVY_FILL}`,
  color: disabled ? MUTED : "#fff",
  cursor: disabled ? "not-allowed" : "pointer",
});

/** Physical center — RTL overflow must not park the tree on the left in fullscreen. */
export function orgTreeStageStyle(offset, zoom) {
  return {
    position: "absolute",
    left: "50%",
    top: 20,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "max-content",
    transform: `translateX(-50%) translate3d(${offset.x || 0}px, ${offset.y || 0}px, 0) scale(${zoom || 1})`,
    transformOrigin: "top center",
  };
}

export const orgBtnDanger = {
  ...orgBtnGhost,
  color: "hsl(0 65% 42%)",
  border: "1px solid hsl(0 55% 82%)",
};

export const orgInspectorLabel = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: MUTED,
  textTransform: "uppercase",
};

export const orgFieldLabel = orgInspectorLabel;
