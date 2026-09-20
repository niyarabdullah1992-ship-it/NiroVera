import React from "react";
import {
  inferStatutoryTone,
  normalizeStatutoryGlow,
  statutoryChipStyle,
  statutoryLabel,
} from "@/lib/statutoryItem";

/**
 * Compact statutory chip — never a full-width bar.
 * Green = غير مستحق (quiet article / in_scope). Red + pulse = استحقاق / due.
 * Cite aliases entitlement. Glow off never strips the tint.
 */
export default function StatutoryItem({
  article,
  source,
  citeKind,
  decisionId,
  ruleId,
  leaveType,
  label,
  ar = true,
  tone,
  entitlement,
  block,
  warn,
  glow = "off",
  surface,
  compact = false,
  as,
  onClick,
  title,
  children,
}) {
  const resolved = inferStatutoryTone({
    ruleId,
    leaveType,
    article,
    decisionId,
    citeKind,
    tone,
    block,
    warn,
    entitlement,
  });
  const glowState = normalizeStatutoryGlow(glow);
  const text = children
    || label
    || statutoryLabel({ article, source, citeKind, decisionId, ruleId, ar });
  if (!text) return null;
  const Tag = as || (onClick ? "button" : "span");
  return (
    <Tag
      type={Tag === "button" ? "button" : undefined}
      onClick={onClick}
      title={title}
      data-glow={glowState}
      data-tone={resolved}
      className="nv-statutory-item"
      style={{
        ...statutoryChipStyle(resolved, { compact, glow: glowState, surface }),
        cursor: onClick || Tag === "button" ? "pointer" : "default",
      }}
    >
      {text}
    </Tag>
  );
}
