import React from "react";
import { BORDER, CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";
import { formatUiNumber } from "@/lib/dateFormat";

export default function PublicSignSteps({ ar, current = 1, tip = "", onStep }) {
  const steps = ar
    ? ["مراجعة المستند", "الحقول والتوقيع", "تم"]
    : ["Review document", "Fields & sign", "Done"];
  return (
    <nav
      aria-label={ar ? "خطوات التوقيع" : "Signing steps"}
      dir={ar ? "rtl" : "ltr"}
      style={{
        background: CARD,
        borderBottom: `1px solid ${BORDER}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        flexWrap: "wrap",
        flexShrink: 0,
      }}
    >
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {steps.map((label, index) => {
          const number = index + 1;
          const on = number === current;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => onStep?.(number)}
                style={{
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  border: `1px solid ${on ? "var(--nv-navy, #14284B)" : BORDER}`,
                  background: on ? SURFACE : CARD,
                  color: on ? NAVY : MUTED,
                  fontWeight: on ? 600 : 400,
                  cursor: onStep ? "pointer" : "default",
                }}
              >
                <span
                  dir="ltr"
                  style={{
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 8,
                    background: on ? "var(--nv-navy, #14284B)" : SURFACE,
                    color: on ? "#fff" : MUTED,
                    fontSize: 10,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  {formatUiNumber(number, ar)}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>
      {tip ? <span style={{ marginInlineStart: "auto", fontSize: 12, lineHeight: 1.65, color: MUTED, maxWidth: 520 }}>{tip}</span> : null}
    </nav>
  );
}
