import React from "react";

const NASKH = "'Noto Naskh Arabic', 'Amiri', serif";
const MONO = "'IBM Plex Mono', monospace";

export const SIGN_LINE = "#dfe3ea";
export const SIGN_SOFT = "#eef0f4";
export const SIGN_NAVY = "#14213d";
export const SIGN_INK = "#14213d";
export const SIGN_MUTED = "#6b7280";
export const SIGN_BODY = "#4b5567";
export const SIGN_GREEN = "#137a49";
export const SIGN_MARK = "#1d9a5b";
export const SIGN_SURFACE = "#fafbfc";
export const SIGN_WHITE = "#fff";

export function signTab(on) {
  return {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: on ? 700 : 400,
    padding: "9px 16px",
    border: `1px solid ${on ? SIGN_NAVY : SIGN_LINE}`,
    background: on ? SIGN_NAVY : SIGN_WHITE,
    color: on ? "#fff" : SIGN_BODY,
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
      <section
        style={{
          background: SIGN_WHITE,
          border: `1px solid ${SIGN_LINE}`,
          borderRadius: 14,
          boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
          padding: "18px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 18,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          <KickerLine kicker={kicker} />
          <h1 style={{ margin: 0, fontFamily: NASKH, fontSize: 24, fontWeight: 600, color: SIGN_INK, lineHeight: 1.35 }}>
            {title}
          </h1>
          {hint ? (
            <p style={{ margin: 0, fontSize: 12, color: SIGN_BODY, lineHeight: 1.85, maxWidth: 820 }}>{hint}</p>
          ) : null}
        </div>
        {meta ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: SIGN_GREEN, lineHeight: 1.7, whiteSpace: "nowrap" }}>{meta}</span>
        ) : null}
      </section>
      {children}
    </div>
  );
}
