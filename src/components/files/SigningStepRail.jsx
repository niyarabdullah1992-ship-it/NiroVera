import React from "react";
import { BORDER, INK, MUTED } from "@/lib/platformStyles";

const mono = { fontFamily: "'IBM Plex Mono', monospace" };

/**
 * Numbered rail shared by the signing section header and the workspace header,
 * so both read as one surface: filled circle for a reached step, hairline between.
 */
export default function SigningStepRail({ steps = [], className }) {
  return (
    <div className={className} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: MUTED, flexWrap: "wrap" }}>
      {steps.map((step, index) => (
        <React.Fragment key={step.number}>
          <span
            role={step.onClick ? "button" : undefined}
            tabIndex={step.onClick ? 0 : undefined}
            onClick={step.onClick}
            onKeyDown={step.onClick ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                step.onClick();
              }
            } : undefined}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: step.current ? INK : MUTED, fontWeight: step.current ? 600 : 400, whiteSpace: "nowrap", cursor: step.onClick ? "pointer" : "default" }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 10,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                ...mono,
                ...(step.done
                  ? { background: "var(--nv-navy, #14284B)", color: "#fff" }
                  : { border: `1px solid ${BORDER}`, color: MUTED }),
              }}
            >
              {step.number}
            </span>
            {step.label}
          </span>
          {index < steps.length - 1 ? <span aria-hidden style={{ width: 28, height: 1, background: BORDER }} /> : null}
        </React.Fragment>
      ))}
    </div>
  );
}
