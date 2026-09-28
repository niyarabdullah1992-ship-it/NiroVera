/**
 * Shared platform style helpers — Design System v2.
 * - document cards 14 · controls 10 · chips 999 · status dots stay circular
 * - 1px line + paper shadow; status is a 3px top edge, never a coloured frame
 * - /app page → SectionShell / PlatformStampShell
 * - titled module → IdentityCard
 * - nested box / table → cardShell / tableShell
 * - selected identity and primary actions are #3C7D50 with white text
 * - structure is deep green #0B3D27; warn stays gold, danger stays #9B2335
 */

import { DS_CONTROL_RADIUS, DS_EDGE_PX, DS_PILL_RADIUS, DS_RADIUS, DS_SHADOW } from "./designSystem.js";

/** Document / slab corner. */
export const RADIUS = DS_RADIUS;
export const CONTROL_RADIUS = DS_CONTROL_RADIUS;
export const PILL_RADIUS = DS_PILL_RADIUS;
export const PAPER_SHADOW = DS_SHADOW;

export const ACCENT = "var(--nv-accent, #3C7D50)";
/** Deep-green structure. Selected fills use BTN_FILL. */
export const NAVY_FILL = "var(--nv-navy, #0B3D27)";
/** Title/body color. */
export const NAVY = "var(--nv-ink, #111418)";
export const INK = "var(--nv-ink, #111418)";
export const MUTED = "var(--nv-muted, var(--nv-ink3, #6B7280))";

export const BRAND = "var(--nv-accent, #3C7D50)";
export const BRAND_SOFT = "var(--nv-accent-soft, color-mix(in oklab, #1E9E63 10%, #fff))";
export const BRAND_DEEP = "var(--nv-accent-deep, color-mix(in oklab, #1E9E63 84%, #000))";
export const BRAND_BORDER = "var(--nv-accent-border, color-mix(in oklab, #1E9E63 28%, #fff))";

export function bar(pct, color = ACCENT) {
  return {
    display: "block",
    width: `${pct}%`,
    height: "100%",
    background: color,
    borderRadius: CONTROL_RADIUS,
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
    // A badge is a label, not a bar: as a direct grid/flex child the inline-block is
    // blockified and would fill the whole cell, reading as a progress bar or an input.
    width: "fit-content",
    justifySelf: "start",
    padding: "3px 9px",
    borderRadius: PILL_RADIUS,
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
    width: "fit-content",
    justifySelf: "start",
    alignItems: "center",
    gap: "3px",
    padding: "2px 7px",
    borderRadius: PILL_RADIUS,
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
    fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
    fontSize: "20px",
    fontWeight: 500,
    lineHeight: 1,
    color,
    direction: "ltr",
  };
}

export const OK = pill("var(--nv-ok-soft)", "var(--nv-ok-ink)", "var(--nv-ok-line)");
export const WARN = pill("var(--nv-warn-soft)", "var(--nv-warn-ink)", "var(--nv-warn-line)");
export const BAD = pill("var(--nv-bad-soft)", "var(--nv-bad-ink)", "var(--nv-bad-line)");
export const NEUTRAL = pill("var(--nv-mute-soft)", "var(--nv-mute-ink)", "var(--nv-mute-line)");

export const BORDER = "var(--nv-line, #E4E9E6)";
export const SURFACE = "var(--nv-soft, #F5F7F6)";
export const CARD = "var(--nv-card, #FFFFFF)";
export const PAGE = "var(--nv-page, #F4F7F5)";
export const HOVER = "var(--nv-hover, #F5F7FA)";
/** Recessed stage behind white slabs — the paper table the signing surfaces sit on. */
export const STAGE = "color-mix(in oklab, var(--nv-navy, #0B3D27) 5%, var(--nv-soft, #F5F7F6))";
export const DANGER = "var(--nv-bad-ink, #9B2335)";
export const DANGER_FILL = "var(--nv-bad-fill, #9B2335)";
/** Active chrome fill — same token Layout uses for section pills. */
export const BTN_FILL = "var(--nv-btn-fill, #3C7D50)";
export const BTN_INK = "var(--nv-btn-ink, #fff)";
export const PILL_H = 34;

/** Layout sub-header language: muted idle, action fill when selected. */
export function navPill(active) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: PILL_H,
    padding: "0 14px",
    borderRadius: CONTROL_RADIUS,
    border: active ? `1px solid ${BTN_FILL}` : "1px solid transparent",
    background: active ? BTN_FILL : "transparent",
    color: active ? BTN_INK : MUTED,
    boxShadow: "none",
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
  borderRadius: RADIUS,
  padding: 5,
  boxShadow: "none",
};

export function filterChip(active) {
  return navPill(active);
}

export function pillCount(active) {
  return {
    minWidth: 16,
    height: 16,
    padding: "0 4px",
    borderRadius: PILL_RADIUS,
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

/** Soft fill + status line + 3px top edge — same chrome as EmpAlertsStrip / تنبيهات. */
export const statusBanner = {
  ok: {
    borderRadius: RADIUS,
    border: "1px solid var(--nv-ok-line)",
    borderTop: `${DS_EDGE_PX}px solid var(--nv-ok-fill)`,
    background: "var(--nv-ok-soft)",
    padding: "12px 14px",
    fontSize: 13,
    color: "var(--nv-ok-ink)",
    lineHeight: 1.7,
  },
  warn: {
    borderRadius: RADIUS,
    border: "1px solid var(--nv-warn-line)",
    borderTop: `${DS_EDGE_PX}px solid var(--nv-warn-fill)`,
    background: "var(--nv-warn-soft)",
    padding: "12px 14px",
    fontSize: 13,
    color: "var(--nv-warn-ink)",
    lineHeight: 1.7,
  },
  bad: {
    borderRadius: RADIUS,
    border: "1px solid var(--nv-bad-line)",
    borderTop: `${DS_EDGE_PX}px solid var(--nv-bad-fill)`,
    background: "var(--nv-bad-soft)",
    padding: "12px 14px",
    fontSize: 13,
    color: "var(--nv-bad-ink)",
    lineHeight: 1.7,
  },
};

/** Schedule section: soft fill + 1px line only — no thick top status ribbon. */
export const statusBannerQuiet = {
  ok: {
    borderRadius: RADIUS,
    border: "1px solid var(--nv-ok-line)",
    background: "var(--nv-ok-soft)",
    padding: "12px 14px",
    fontSize: 13,
    color: "var(--nv-ok-ink)",
    lineHeight: 1.7,
  },
  warn: {
    borderRadius: RADIUS,
    border: "1px solid var(--nv-warn-line)",
    background: "var(--nv-warn-soft)",
    padding: "12px 14px",
    fontSize: 13,
    color: "var(--nv-warn-ink)",
    lineHeight: 1.7,
  },
  bad: {
    borderRadius: RADIUS,
    border: "1px solid var(--nv-bad-line)",
    background: "var(--nv-bad-soft)",
    padding: "12px 14px",
    fontSize: 13,
    color: "var(--nv-bad-ink)",
    lineHeight: 1.7,
  },
};

export const field = {
  width: "100%",
  height: "36px",
  borderRadius: CONTROL_RADIUS,
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
  borderRadius: CONTROL_RADIUS,
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
  borderRadius: RADIUS,
  boxShadow: PAPER_SHADOW,
  padding: "18px 20px",
};

export const ui = {
  btnPrimary: {
    padding: "8px 15px",
    borderRadius: CONTROL_RADIUS,
    background: BTN_FILL,
    color: "#fff",
    border: `1px solid ${BTN_FILL}`,
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  btnSecondary: {
    padding: "8px 15px",
    borderRadius: CONTROL_RADIUS,
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
    borderRadius: CONTROL_RADIUS,
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
    borderRadius: CONTROL_RADIUS,
    background: CARD,
    color: DANGER,
    border: "1px solid var(--nv-bad-line)",
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
    borderRadius: CONTROL_RADIUS,
    background: BTN_FILL,
    color: "#fff",
    border: "none",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.01em",
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    boxShadow: "none",
    lineHeight: 1,
    boxSizing: "border-box",
  },
  btnCreateQuiet: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "32px",
    padding: "0 16px",
    borderRadius: CONTROL_RADIUS,
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
    borderRadius: CONTROL_RADIUS,
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
    borderRadius: CONTROL_RADIUS,
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
    borderRadius: CONTROL_RADIUS,
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
    borderRadius: CONTROL_RADIUS,
    border: `1px solid ${BTN_FILL}`,
    background: BTN_FILL,
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
    borderRadius: CONTROL_RADIUS,
    border: "1px solid var(--nv-bad-line)",
    background: "var(--nv-bad-soft)",
    color: "var(--nv-bad-ink)",
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
    borderRadius: CONTROL_RADIUS,
    border: `1px solid ${BTN_FILL}`,
    background: BTN_FILL,
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
    borderRadius: CONTROL_RADIUS,
    background: BTN_FILL,
    color: "#fff",
    border: `1px solid ${BTN_FILL}`,
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};

export const cardShell = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  boxShadow: PAPER_SHADOW,
  padding: "18px 20px",
};

export const tableShell = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  boxShadow: PAPER_SHADOW,
  overflow: "hidden",
};

export const emptyState = {
  background: CARD,
  border: "1px dashed #CBD5E1",
  borderRadius: RADIUS,
  padding: "32px",
  textAlign: "center",
  fontSize: "13px",
  color: MUTED,
};

export const statCard = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  boxShadow: PAPER_SHADOW,
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
      borderRadius: CONTROL_RADIUS,
      width: "26px",
      background: "transparent",
      border: "1px dashed #E2E8F0",
    };
  }
  return {
    height: "22px",
    borderRadius: CONTROL_RADIUS,
    background: color,
    width: `${Math.max(2, pct)}%`,
  };
}
