import React from "react";
import NvIcon from "@/components/shared/NvIcon";
import { MARK_GLYPHS } from "@/lib/signPdf";

/** Tick / cross for a mark field, drawn from the platform icon family (NvIcon). IBM Plex Arabic has
 *  no tick / cross code points, so the stored value (MARK_GLYPHS) is never shown as raw text. */
export default function SignMarkGlyph({ glyph, size = 14, color = "currentColor" }) {
  const cross = glyph === MARK_GLYPHS[1];
  return <NvIcon name={cross ? "cross" : "check"} size={size} strokeWidth={2.4} inline={false} style={{ color }} />;
}
