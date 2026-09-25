import React from "react";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import Nv7SectionHead, { nv7Tab } from "@/components/shared/Nv7SectionHead";
import { MUTED, NAVY } from "@/lib/platformStyles";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";

/**
 * Shared /app workspace chrome — v7 deep-green header, tabs on the green.
 */
export default function SuiteWorkspaceFrame({
  ar,
  kicker,
  title,
  hint,
  meta,
  laneBar = null,
  tabs = [],
  tool,
  onTool,
  viewNote,
  legal,
  children,
  maxWidth = 1320,
}) {
  return (
    <PlatformStampShell ar={ar} bare maxWidth={maxWidth}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, color: NAVY, fontSize: 13 }}>
        <Nv7SectionHead
          kicker={kicker}
          title={title}
          hint={hint}
          meta={meta}
          tabs={tabs.length ? (
            <nav
              aria-label={typeof title === "string" ? title : undefined}
              style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}
            >
              {tabs.map((item) => {
                const on = tool === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onTool?.(item.value)}
                    aria-current={on ? "page" : undefined}
                    style={nv7Tab(on)}
                  >
                    {item.label}
                    {item.count > 0 ? (
                      <span dir="ltr" style={{ fontFamily: MONO, fontSize: 10.5, background: on ? "#0B3D27" : "rgba(255,255,255,.24)", color: "#fff", padding: "1px 6px", borderRadius: 3 }}>
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {viewNote ? (
                <span style={{ marginInlineStart: "auto", fontSize: 11, color: "#C5DBCD", lineHeight: 1.7, maxWidth: 380, textAlign: "start" }}>
                  {viewNote}
                </span>
              ) : null}
            </nav>
          ) : null}
        />

        {laneBar}

        {children}

        {legal ? (
          <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{legal}</p>
        ) : null}
      </div>
    </PlatformStampShell>
  );
}
