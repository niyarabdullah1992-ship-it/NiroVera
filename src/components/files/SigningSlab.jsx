import React from "react";
import { SIGN_INK, SIGN_LINE, SIGN_MUTED, SIGN_WHITE } from "@/components/files/SigningSectionFrame";
import { PAPER_SHADOW, RADIUS } from "@/lib/platformStyles";

const mono = { fontFamily: "'IBM Plex Mono', monospace" };

/**
 * A white panel in the signing workspace grammar — 14px paper card, 1px line,
 * numbered head, technical metadata in mono. Used across the signing section so
 * the entry page and the workspace read as the same surface.
 */
export default function SigningSlab({ title, meta, extra, footer, pad = 14, children, style }) {
  return (
    <section
      className="nv-signing-card"
      style={{
        background: SIGN_WHITE,
        border: `1px solid ${SIGN_LINE}`,
        borderRadius: RADIUS,
        boxShadow: PAPER_SHADOW,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        ...style,
      }}
    >
      {(title || extra) ? (
        <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${SIGN_LINE}`, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: SIGN_INK, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </span>
          {meta ? (
            <span dir="ltr" style={{ ...mono, fontSize: 11, color: SIGN_MUTED, marginInlineStart: "auto", flex: "none" }}>{meta}</span>
          ) : null}
          {extra ? <span style={{ marginInlineStart: meta ? 8 : "auto", flex: "none" }}>{extra}</span> : null}
        </header>
      ) : null}

      <div style={{ padding: pad, minWidth: 0, flex: 1 }}>{children}</div>

      {footer ? (
        <footer style={{ padding: "10px 14px", borderTop: `1px solid ${SIGN_LINE}`, fontSize: 11, lineHeight: 1.7, color: SIGN_MUTED }}>
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
