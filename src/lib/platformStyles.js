/**
 * Shared platform style helpers — literal values only.
 *
 * Chrome rules (no second identity):
 * - /app page → PlatformStampShell (navy 3px rail, 1280)
 * - titled module → IdentityCard
 * - nested box / table → cardShell / tableShell (do not copy the white box inline)
 * - person in a row → EmployeeIdentityRow
 * - green #1E9E63 = status or one primary button, not card skin
 */

export const ACCENT = "var(--nv-accent, #1E9E63)";
/** Navy fill for inverted panels and rails — stays #14284B in dark mode. */
export const NAVY_FILL = "var(--nv-navy, #14284B)";
/** Title/body color. In light mode this is navy; in dark mode it follows --nv-ink. */
export const NAVY = "var(--nv-ink, #14284B)";
export const INK = "var(--nv-ink, #14284B)";
export const MUTED = "var(--nv-muted, #5A6B85)";

export const BRAND = "var(--nv-accent, #1E9E63)";
export const BRAND_SOFT = "var(--nv-accent-soft, color-mix(in oklab, #1E9E63 10%, #fff))";
export const BRAND_DEEP = "var(--nv-accent-deep, color-mix(in oklab, #1E9E63 84%, #000))";
export const BRAND_BORDER = "var(--nv-accent-border, color-mix(in oklab, #1E9E63 28%, #fff))";

export function bar(pct, color = ACCENT) {
  return {
    display: "block",
    width: `${pct}%`,
    height: "100%",
    background: color,
    borderRadius: "4px",
  };
}

export function dot(color) {
  return {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
  };
}

export function pill(bg, fg, bd) {
  return {
    display: "inline-block",
    padding: "3px 9px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 500,
    background: bg,
    color: fg,
    border: `1px solid ${bd}`,
    whiteSpace: "nowrap",
  };
}

export function tag(bg, fg, bd) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    padding: "2px 7px",
    borderRadius: "20px",
    fontSize: "10px",
    fontWeight: 600,
    background: bg,
    color: fg,
    border: `1px solid ${bd}`,
    whiteSpace: "nowrap",
  };
}

export function num(color = INK) {
  return {
    fontFamily: "'IBM Plex Sans',sans-serif",
    fontSize: "20px",
    fontWeight: 600,
    lineHeight: 1,
    color,
  };
}

export const OK = pill("#ECFDF3", "#15803D", "#BBF7D0");
export const WARN = pill("#FFFBEB", "#B45309", "#FDE68A");
export const BAD = pill("#FEF2F2", "#DC2626", "#FECACA");
export const NEUTRAL = pill("#F7F8FA", "#5A6B85", "#E2E8F0");

export const BORDER = "var(--nv-line, #E2E8F0)";
export const SURFACE = "var(--nv-soft, #F7F8FA)";
export const CARD = "var(--nv-card, #FFFFFF)";
export const DANGER = "#DC2626";
/** Active chrome fill — same token Layout uses for section pills. */
export const BTN_FILL = "var(--nv-btn-fill, #14284B)";
export const BTN_INK = "var(--nv-btn-ink, #fff)";
export const PILL_H = 34;

/** Layout sub-header language: muted idle, navy fill when selected. */
export function navPill(active) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: PILL_H,
    padding: "0 14px",
    borderRadius: 999,
    border: "none",
    background: active ? BTN_FILL : "transparent",
    color: active ? BTN_INK : MUTED,
    boxShadow: active ? "0 6px 16px color-mix(in oklab, #14284B 22%, transparent)" : "none",
    fontSize: "12.5px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    lineHeight: 1,
    boxSizing: "border-box",
  };
}

export const pillRail = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  flexWrap: "wrap",
  overflowX: "auto",
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 999,
  padding: 5,
  boxShadow: "0 4px 14px rgba(20,40,75,.05)",
};

export function filterChip(active) {
  return navPill(active);
}

export function pillCount(active) {
  return {
    minWidth: 16,
    height: 16,
    padding: "0 4px",
    borderRadius: 8,
    background: active
      ? "color-mix(in oklab, #fff 24%, transparent)"
      : "var(--tint-amber-bg, #FFFBEB)",
    color: active ? "inherit" : "var(--tint-amber-fg, #B45309)",
    fontSize: 9,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'IBM Plex Sans',sans-serif",
  };
}

export const statusBanner = {
  ok: {
    borderRadius: 16,
    border: "1px solid #BBF7D0",
    background: "#ECFDF3",
    padding: "12px 14px",
    fontSize: 13,
    color: "#15803D",
    lineHeight: 1.7,
  },
  warn: {
    borderRadius: 16,
    border: "1px solid #FDE68A",
    background: "#FFFBEB",
    padding: "12px 14px",
    fontSize: 13,
    color: "#B45309",
    lineHeight: 1.7,
  },
};

export const field = {
  width: "100%",
  height: "36px",
  borderRadius: "9px",
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: INK,
  padding: "0 12px",
  fontSize: "13px",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export const textarea = {
  width: "100%",
  borderRadius: "9px",
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: INK,
  padding: "10px 12px",
  fontSize: "13px",
  fontFamily: "inherit",
  boxSizing: "border-box",
  resize: "vertical",
};

export const labelMuted = {
  display: "block",
  fontSize: "11px",
  color: MUTED,
  marginBottom: "6px",
};

export const dialogOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  background: "rgba(20,40,75,.38)",
};

export const dialogCard = {
  width: "100%",
  maxWidth: "520px",
  maxHeight: "88vh",
  overflow: "auto",
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: "16px",
  boxShadow: "0 24px 60px rgba(20,40,75,.22)",
  padding: "18px 20px",
};

export const ui = {
  btnPrimary: {
    padding: "8px 15px",
    borderRadius: "9px",
    background: BRAND,
    color: "#fff",
    border: `1px solid ${BRAND}`,
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  btnSecondary: {
    padding: "8px 15px",
    borderRadius: "9px",
    background: CARD,
    color: INK,
    border: `1px solid ${BORDER}`,
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  btnGhost: {
    padding: "6px 12px",
    borderRadius: "9px",
    background: CARD,
    color: MUTED,
    border: `1px solid ${BORDER}`,
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  btnDanger: {
    padding: "8px 15px",
    borderRadius: "9px",
    background: CARD,
    color: DANGER,
    border: "1px solid #FECACA",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  btnCreate: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "32px",
    padding: "0 16px",
    borderRadius: "999px",
    background: NAVY_FILL,
    color: "#fff",
    border: "none",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.01em",
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 8px color-mix(in oklab, #14284B 18%, transparent)",
    lineHeight: 1,
    boxSizing: "border-box",
  },
  btnCreateQuiet: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "32px",
    padding: "0 16px",
    borderRadius: "999px",
    background: CARD,
    color: MUTED,
    border: `1px solid ${BORDER}`,
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.01em",
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    boxShadow: "none",
    lineHeight: 1,
    boxSizing: "border-box",
  },
  btnMini: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    padding: "0 10px",
    borderRadius: 9,
    border: `1px solid ${BORDER}`,
    background: CARD,
    color: INK,
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    lineHeight: 1,
    boxSizing: "border-box",
  },
  btnMiniQuiet: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    padding: "0 10px",
    borderRadius: 9,
    border: `1px solid ${BORDER}`,
    background: CARD,
    color: MUTED,
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    lineHeight: 1,
    boxSizing: "border-box",
  },
  btnMiniSoft: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    padding: "0 10px",
    borderRadius: 9,
    border: `1px solid ${BRAND_BORDER}`,
    background: BRAND_SOFT,
    color: BRAND_DEEP,
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    lineHeight: 1,
    boxSizing: "border-box",
  },
  btnMiniBrand: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    padding: "0 10px",
    borderRadius: 9,
    border: `1px solid ${BRAND}`,
    background: BRAND,
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    lineHeight: 1,
    boxSizing: "border-box",
  },
  btnMiniDanger: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    padding: "0 10px",
    borderRadius: 9,
    border: "1px solid #FECACA",
    background: "#FEF2F2",
    color: "#B91C1C",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    lineHeight: 1,
    boxSizing: "border-box",
  },
  btnRow: {
    padding: "6px 14px",
    borderRadius: "9px",
    border: `1px solid ${BRAND}`,
    background: BRAND,
    color: "#fff",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  btnBlock: {
    width: "100%",
    marginTop: "18px",
    padding: "10px",
    borderRadius: "9px",
    background: BRAND,
    color: "#fff",
    border: "none",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};

export const cardShell = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: "16px",
  padding: "18px 20px",
};

export const tableShell = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: "16px",
  overflow: "hidden",
};

export const emptyState = {
  background: CARD,
  border: "1px dashed #CBD5E1",
  borderRadius: "16px",
  padding: "32px",
  textAlign: "center",
  fontSize: "13px",
  color: MUTED,
};

export const statCard = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: "16px",
  padding: "15px 16px",
};

export const PAGE_WIDTH = 1280;

export const pageCol = {
  maxWidth: PAGE_WIDTH,
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

export const tableHeadRow = {
  display: "grid",
  padding: "11px 18px",
  background: SURFACE,
  borderBottom: `1px solid ${BORDER}`,
  fontSize: "10px",
  letterSpacing: "0.06em",
  color: MUTED,
  fontWeight: 600,
};

export const pyramidRow = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "5px 0",
};

export const pyramidLabel = {
  flex: "0 0 168px",
  fontSize: "11px",
  color: MUTED,
};

export function pyramidBar(pct, color, empty = false) {
  if (empty || pct <= 0) {
    return {
      height: "22px",
      borderRadius: "5px",
      width: "26px",
      background: "transparent",
      border: "1px dashed #E2E8F0",
    };
  }
  return {
    height: "22px",
    borderRadius: "5px",
    background: color,
    width: `${Math.max(2, pct)}%`,
  };
}
