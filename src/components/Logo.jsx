import React from "react";
import { POWERCARE_MARK_URL } from "@/lib/brand";

const LOCKUP_RATIO = 4.5;

function NiroVeraMark({ size, className }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        overflow: "hidden",
        background: "var(--nv-card)",
      }}
    >
      <img
        src={POWERCARE_MARK_URL}
        alt=""
        width={size}
        height={size}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "center",
          display: "block",
          margin: "auto",
        }}
      />
    </span>
  );
}

/**
 * @param {object} props
 * @param {number} [props.size]
 * @param {string} [props.className]
 * @param {boolean} [props.wordmark] — false hides the “NiroVera” word (icon only).
 * @param {boolean} [props.iconOnly] — alias of wordmark={false} for compact chrome.
 */
export default function Logo({ size = 48, className = "", wordmark = true, iconOnly = false, onDark = false }) {
  const markOnly = iconOnly || wordmark === false;
  const ink = onDark ? "#FFFFFF" : "var(--nv-ink, #14284B)";
  const accent = "var(--nv-accent, #1E9E63)";
  if (markOnly) {
    return <NiroVeraMark size={size} className={className} />;
  }
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.max(8, Math.round(size * 0.22)),
        height: size,
        width: size * LOCKUP_RATIO,
      }}
    >
      <NiroVeraMark size={size} />
      <span
        aria-hidden
        style={{ width: 1, height: size * 0.56, background: onDark ? "rgba(255,255,255,.28)" : "var(--nv-line, #E2E8F0)", flexShrink: 0 }}
      />
      <span
        style={{
          fontFamily: "'Inter Tight', 'IBM Plex Sans', sans-serif",
          fontSize: size * 0.42,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: ink }}>Niro</span>
        <span style={{ color: accent }}>V</span>
        <span style={{ color: ink }}>era</span>
      </span>
    </span>
  );
}
