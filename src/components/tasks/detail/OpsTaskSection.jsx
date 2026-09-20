import React from "react";
import { MUTED } from "@/lib/platformStyles";

/** Uniform section card — same inset block as «مهمة جديدة». */
export default function OpsTaskSection({ title, hint, count, aside, tone, children }) {
  const tones = {
    warn: { border: "#FDE68A", background: "#FFFBEB", title: "#B45309" },
    ok: { border: "#BBF7D0", background: "#ECFDF3", title: "#15803D" },
    bad: { border: "#FECACA", background: "#FEF2F2", title: "#B91C1C" },
  };
  const c = tones[tone] || {
    border: "var(--nv-line, #E2E8F0)",
    background: "var(--nv-inset, var(--nv-soft, #F7F8FA))",
    title: MUTED,
  };
  return (
    <section
      data-nv-task-section
      style={{
        borderRadius: 16,
        border: `1px solid ${c.border}`,
        background: c.background,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        flexShrink: 0,
      }}
    >
      {(title || hint || count != null || aside) && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title ? (
              <div style={{ fontSize: 12, fontWeight: 650, color: c.title, letterSpacing: "0.01em" }}>{title}</div>
            ) : null}
            {hint ? (
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, marginTop: 4 }}>{hint}</div>
            ) : null}
          </div>
          {count != null && (
            <span dir="ltr" style={{ fontSize: 11, color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>{count}</span>
          )}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
