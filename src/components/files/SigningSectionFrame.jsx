import React from "react";
import Nv7SectionHead from "@/components/shared/Nv7SectionHead";

const NASKH = "'Noto Naskh Arabic', 'Amiri', serif";
const MONO = "'IBM Plex Mono', monospace";

export const SIGN_LINE = "var(--nv-line)";
export const SIGN_SOFT = "var(--nv-line3)";
export const SIGN_NAVY = "var(--nv-btn-fill)";
export const SIGN_INK = "var(--nv-ink)";
export const SIGN_MUTED = "var(--nv-muted)";
export const SIGN_BODY = "var(--nv-ink2)";
export const SIGN_GREEN = "var(--nv-ok-ink)";
export const SIGN_MARK = "var(--nv-ok-fill)";
export const SIGN_SURFACE = "var(--nv-soft)";
export const SIGN_WHITE = "var(--nv-card)";

export function signTab(on) {
  return {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: on ? 700 : 400,
    padding: "9px 16px",
    border: `1px solid ${on ? SIGN_NAVY : SIGN_LINE}`,
    background: on ? SIGN_NAVY : SIGN_WHITE,
    color: on ? "var(--nv-btn-ink)" : SIGN_BODY,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    borderRadius: 10,
  };
}

function KickerLine({ kicker }) {
  const parts = String(kicker || "").split("·").map((part) => part.trim()).filter(Boolean);
  const index = parts[0] || "";
  const rest = parts.slice(1).join(" · ");
  return (
    <span style={{ fontSize: 11, letterSpacing: ".14em", color: SIGN_MUTED, display: "flex", gap: 7, alignItems: "center" }}>
      {index ? <span dir="ltr" style={{ fontFamily: MONO }}>{index}</span> : null}
      {rest ? <span>·</span> : null}
      <span>{rest || kicker}</span>
    </span>
  );
}

/** Institutional signing chrome — paper cards 14, controls 10, navy/green of today. */
export default function SigningSectionFrame({
  ar,
  kicker,
  title,
  hint,
  meta,
  children,
}) {
  return (
    <div
      className="nv-sign-frame"
      dir={ar ? "rtl" : "ltr"}
      style={{
        width: "min(1320px, 100%)",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        color: SIGN_INK,
        fontSize: 13,
        fontFamily: "'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif",
      }}
    >
      <Nv7SectionHead kicker={kicker} title={title} hint={hint} meta={meta} />
      {children}
    </div>
  );
}
