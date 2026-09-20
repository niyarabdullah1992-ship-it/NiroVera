import { SIGN_BODY, SIGN_GREEN, SIGN_INK, SIGN_LINE, SIGN_NAVY, SIGN_SURFACE, SIGN_WHITE } from "@/components/files/SigningSectionFrame";

/**
 * Institutional signing language: navy commits, hairline frames, green is status.
 */
export const signPrimaryBtn = {
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 600,
  padding: "8px 13px",
  borderRadius: 10,
  border: "none",
  background: SIGN_NAVY,
  color: "#fff",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  whiteSpace: "nowrap",
};

export const signGhostBtn = {
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 600,
  padding: "8px 13px",
  borderRadius: 10,
  border: `1px solid ${SIGN_LINE}`,
  background: SIGN_WHITE,
  color: SIGN_INK,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  whiteSpace: "nowrap",
};

export const signMono = { fontFamily: "'IBM Plex Mono', monospace" };

export const signKicker = {
  fontSize: 10,
  letterSpacing: "0.14em",
  color: SIGN_BODY,
  fontWeight: 600,
};

export function signTipStrip(tone = "neutral") {
  const warn = tone === "warn";
  const ok = tone === "ok";
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 16px",
    fontSize: 12,
    lineHeight: 1.65,
    borderBottom: `1px solid ${warn ? "#e6d7b0" : ok ? "#cdead8" : SIGN_LINE}`,
    background: warn ? "#faf7f0" : ok ? "#f3fbf6" : SIGN_SURFACE,
    color: warn ? "#8a6516" : ok ? SIGN_GREEN : SIGN_BODY,
  };
}

export const signProofGrid = {
  border: `1px solid ${SIGN_LINE}`,
  background: SIGN_SURFACE,
  padding: "12px 14px",
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: "6px 14px",
  ...signMono,
  fontSize: 12,
  borderRadius: 14,
  boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
};

export function signStateChip(kind = "idle") {
  const map = {
    ok: { bg: "#f3fbf6", fg: SIGN_GREEN, bd: "#cdead8" },
    warn: { bg: "#faf7f0", fg: "#8a6516", bd: "#e6d7b0" },
    bad: { bg: "#fdf2f2", fg: "#8a1c2b", bd: "#f0d0d4" },
    wait: { bg: "#eef6f1", fg: "#1d9a5b", bd: "#cdead8" },
    idle: { bg: SIGN_SURFACE, fg: SIGN_BODY, bd: SIGN_LINE },
  };
  const tone = map[kind] || map.idle;
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 999,
    background: tone.bg,
    color: tone.fg,
    border: `1px solid ${tone.bd}`,
    whiteSpace: "nowrap",
    // The chip sits in grid cells and in centred flex rows alike: without these it
    // stretches to the row height in a grid, and top-aligning it would shift the rows.
    alignSelf: "center",
    height: "fit-content",
  };
}
