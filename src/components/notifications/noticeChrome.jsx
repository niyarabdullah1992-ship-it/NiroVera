import React from "react";

/**
 * The notification panels in the طلباتي frame: one dark-green head band, white cards with a
 * hairline and radius 10, a tinted icon tile per kind, pills to filter. Shared by «إشعاراتي»
 * (the person's own notices) and «إشعارات نطاقي» (every branch the viewer administers).
 */

// The same dark-green band as every section head (AttendanceSectionFrame, طلباتي).
export const NOTICE_BAND = "#0B3D27";
const NOTICE_BAND_FILL = "linear-gradient(135deg,#0B3D27 0%,#0F5535 100%)";

export const NOTICE_TONE = {
  bad: { soft: "var(--nv-bad-soft)", ink: "var(--nv-bad-ink)", line: "var(--nv-bad-line)" },
  warn: { soft: "var(--nv-warn-soft)", ink: "var(--nv-warn-ink)", line: "var(--nv-warn-line)" },
  ok: { soft: "var(--nv-ok-soft)", ink: "var(--nv-ok-ink)", line: "var(--nv-ok-line)" },
  navy: { soft: "var(--nv-mute-soft, #EEF2EF)", ink: "var(--nv-ink)", line: "var(--nv-line)" },
};

export function noticeTone(tone) {
  return NOTICE_TONE[tone] || NOTICE_TONE.navy;
}

/** Outer shell of a panel. */
export function NoticeShell({ ar, label, children }) {
  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      role="dialog"
      aria-label={label}
      style={{
        width: "100%",
        maxHeight: "min(78vh, 660px)",
        display: "flex",
        flexDirection: "column",
        background: "var(--nv-page, #F4F7F5)",
        border: "1px solid var(--nv-line)",
        borderRadius: 14,
        boxShadow: "0 18px 44px rgba(12,20,16,.18)",
        overflow: "hidden",
        color: "var(--nv-ink)",
      }}
    >
      {children}
    </div>
  );
}

/** The dark-green head band: title, a quiet sub line, and actions on the end side. */
export function NoticeHead({ title, sub, trailing, children }) {
  return (
    <header style={{ background: NOTICE_BAND_FILL, color: "#fff", padding: "14px 16px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <strong style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35 }}>{title}</strong>
          {sub ? <span style={{ fontSize: 11, color: "rgba(255,255,255,.72)", lineHeight: 1.6 }}>{sub}</span> : null}
        </div>
        {trailing ? <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{trailing}</div> : null}
      </div>
      {children}
    </header>
  );
}

/** A pill on the green band (segment switch). */
export function bandPill(on) {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 28,
    padding: "0 12px",
    borderRadius: 999,
    border: on ? "none" : "1px solid rgba(255,255,255,.28)",
    background: on ? "#fff" : "transparent",
    color: on ? NOTICE_BAND : "#fff",
    fontSize: 12,
    fontWeight: on ? 700 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export function BandCount({ n, on }) {
  if (n == null) return null;
  return (
    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, borderRadius: 999, padding: "0 6px", minWidth: 18, textAlign: "center", background: on ? "var(--nv-ok-soft)" : "rgba(255,255,255,.18)", color: on ? "var(--nv-ok-ink)" : "#fff", unicodeBidi: "isolate" }}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Ghost button on the green band («تحديد الكل كمقروء»). */
export function bandAction() {
  return {
    fontFamily: "inherit",
    height: 28,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.35)",
    background: "transparent",
    color: "#fff",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

/** The kind tile at the start of a row — icon on its tone's soft fill. */
export function KindTile({ Icon, tone, letter }) {
  const t = noticeTone(tone);
  return (
    <span aria-hidden style={{ width: 32, height: 32, flex: "none", borderRadius: 9, background: t.soft, color: t.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
      {Icon ? <Icon style={{ width: 15, height: 15 }} strokeWidth={2} /> : letter}
    </span>
  );
}

/** Small pill inside a row (kind, branch, «تصعيد»). */
export function rowChip(tone = "navy") {
  const t = noticeTone(tone);
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 20,
    padding: "0 8px",
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 600,
    background: t.soft,
    color: t.ink,
    whiteSpace: "nowrap",
  };
}

/** A day heading inside the list («اليوم» · «أمس» · «أقدم»). */
export function DayHeading({ children }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-muted)", padding: "10px 4px 2px" }}>{children}</span>;
}

/** Quiet footer line under a list. */
export function NoticeFoot({ children }) {
  return (
    <div style={{ padding: "9px 16px", borderTop: "1px solid var(--nv-line)", background: "var(--nv-card)", fontSize: 10.5, color: "var(--nv-muted)", lineHeight: 1.75 }}>
      {children}
    </div>
  );
}
