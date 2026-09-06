import React from "react";
import IdentityCard from "@/components/shared/IdentityCard";
import { BORDER, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

export default function HelpSection({ icon: Icon, title, steps, dir }) {
  return (
    <IdentityCard icon={Icon} title={title} dir={dir} bodySurface>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((step, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 13, color: MUTED, lineHeight: 1.65 }}>
            <span style={{
              width: 22,
              height: 22,
              borderRadius: 8,
              background: SURFACE,
              color: NAVY,
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 1,
              border: `1px solid ${BORDER}`,
            }}
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </IdentityCard>
  );
}
