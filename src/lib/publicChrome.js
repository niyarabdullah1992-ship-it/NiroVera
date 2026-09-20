import { useEffect } from "react";
import { applyStoredPlatformTheme } from "@/lib/platformTheme";
import {
  ACCENT,
  BORDER,
  BRAND_BORDER,
  BRAND_SOFT,
  CARD,
  INK,
  MUTED,
  NAVY,
  NAVY_FILL,
  SURFACE,
} from "@/lib/platformStyles";

export {
  ACCENT,
  BORDER,
  BRAND_BORDER,
  BRAND_SOFT,
  CARD,
  INK,
  MUTED,
  NAVY,
  NAVY_FILL,
  SURFACE,
};

/** Contrast on inverted navy panels — stays light even in dark mode. */
export const ON_NAVY = "#FFFFFF";
export const ON_NAVY_MUTED = "#94A3B8";
export const ON_NAVY_ACCENT = "#6EE7B7";

export function usePublicPlatformTheme() {
  useEffect(() => {
    applyStoredPlatformTheme();
  }, []);
}

export const publicBtnGhost = {
  height: 36,
  padding: "0 14px",
  borderRadius: 0,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: INK,
  fontSize: 13,
  fontWeight: 500,
  display: "flex",
  alignItems: "center",
  textDecoration: "none",
  fontFamily: "inherit",
  cursor: "pointer",
};

export const publicBtnPrimary = {
  ...publicBtnGhost,
  background: NAVY_FILL,
  borderColor: NAVY_FILL,
  color: ON_NAVY,
  fontWeight: 600,
  padding: "0 18px",
};

export const publicCard = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 0,
  boxShadow: "none",
};

/** White tile behind the official N PNG — do not recolor the mark. */
export const publicMarkTile = {
  width: 40,
  height: 40,
  borderRadius: 0,
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#fff",
  border: `1px solid ${BORDER}`,
  flexShrink: 0,
};
