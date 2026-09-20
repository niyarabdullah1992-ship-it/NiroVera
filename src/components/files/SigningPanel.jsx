import React from "react";
import { ChromeBox } from "@/components/shared/IdentityCard";
import { NAVY } from "@/lib/platformStyles";

/** Signing workspace slot — nested stamp content, no second identity paper. */
export default function SigningPanel({ title, extra, children, sticky, pad = true, dir }) {
  return (
    <div className="nv-signing-slot" style={{ position: sticky ? "sticky" : undefined, top: sticky ? 12 : undefined, minWidth: 0 }} dir={dir}>
      <ChromeBox padded={pad}>
        {(title || extra) ? (
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            {title ? <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 10 }}>{title}</div> : null}
            {extra}
          </div>
        ) : null}
        {children}
      </ChromeBox>
    </div>
  );
}
