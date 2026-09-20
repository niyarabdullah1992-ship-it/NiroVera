import React from "react";

/** Tick / cross as strokes. IBM Plex Arabic has no U+2713 / U+2717, so a raw ✗
 *  in the toolbar or on the page is often an empty box. */
export default function SignMarkGlyph({ glyph, size = 14, color = "currentColor" }) {
  const cross = glyph === "✗";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ display: "block" }}>
      {cross ? (
        <path d="M4 4 L12 12 M12 4 L4 12" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      ) : (
        <path d="M3.1 8.2 L6.4 11.3 L12.9 4.2" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
