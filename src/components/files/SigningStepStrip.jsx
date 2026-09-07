import React from "react";
import { Check } from "lucide-react";
import { BRAND, BRAND_SOFT, CARD, MUTED, NAVY } from "@/lib/platformStyles";

/**
 * Calm proof-cycle rail for signing — lights done steps, does not decorate the page.
 */
export default function SigningStepStrip({ ar, steps = [] }) {
  const current = Math.max(0, steps.findIndex((step) => !step.ok));
  return (
    <ol
      className="nv-signing-steps"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        margin: 0,
        padding: "14px 16px",
        listStyle: "none",
        borderRadius: 18,
        border: "1px solid var(--nv-line, #E2E8F0)",
        background: CARD,
        boxShadow: "0 8px 22px rgba(20,40,75,.05)",
      }}
    >
      {steps.map((step, index) => {
        const done = Boolean(step.ok);
        const active = !done && index === current;
        return (
          <React.Fragment key={step.label}>
            <li style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span
                aria-hidden
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  transition: "background .2s ease, color .2s ease, border-color .2s ease, box-shadow .2s ease",
                  ...(done
                    ? { background: BRAND, color: "#fff", border: `1px solid ${BRAND}`, boxShadow: "0 4px 10px color-mix(in oklab, #1E9E63 35%, transparent)" }
                    : active
                      ? { background: BRAND_SOFT, color: BRAND, border: `1px solid ${BRAND}` }
                      : { background: "var(--nv-inset, #F7F8FA)", color: MUTED, border: "1px solid var(--nv-line, #E2E8F0)" }),
                }}
              >
                {done ? <Check size={13} strokeWidth={2.6} /> : index + 1}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: done || active ? 650 : 500,
                  color: done || active ? NAVY : MUTED,
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </span>
            </li>
            {index < steps.length - 1 ? (
              <li
                aria-hidden
                style={{
                  flex: 1,
                  height: 2,
                  margin: "0 12px",
                  minWidth: 12,
                  borderRadius: 99,
                  background: done ? "color-mix(in oklab, #1E9E63 55%, #E2E8F0)" : "var(--nv-line, #E2E8F0)",
                  transition: "background .2s ease",
                }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
