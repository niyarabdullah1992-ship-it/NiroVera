import React from "react";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { ACCENT, BORDER, CARD, MUTED, NAVY, NAVY_FILL, SURFACE } from "@/lib/platformStyles";

const HEADING = "var(--font-heading)";
const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";

function tabBtn(on) {
  return {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: on ? 700 : 400,
    padding: "9px 16px",
    border: `1px solid ${on ? NAVY_FILL : BORDER}`,
    background: on ? NAVY_FILL : CARD,
    color: on ? "#fff" : MUTED,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    borderRadius: 10,
  };
}

/**
 * Shared /app workspace chrome — same slabs as Requests / Attendance / Discipline:
 * Naskh title, letter-spaced kicker, optional mine/manage lane, navy-fill tabs.
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
  const parts = String(kicker || "").split("·").map((part) => part.trim()).filter(Boolean);
  const index = parts[0] || "";
  const rest = parts.slice(1).join(" · ");

  return (
    <PlatformStampShell ar={ar} bare maxWidth={maxWidth}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, color: NAVY, fontSize: 13 }}>
        <section
          className="nv-doc"
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            padding: "18px 22px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 11, letterSpacing: ".14em", color: MUTED, display: "flex", gap: 7, alignItems: "center" }}>
              {index ? <span dir="ltr" style={{ fontFamily: MONO }}>{index}</span> : null}
              {rest ? <span>·</span> : null}
              <span>{rest || kicker}</span>
            </span>
            <h1 className="nv-h" style={{ margin: 0, fontFamily: HEADING, fontSize: 24, fontWeight: 700, lineHeight: 1.35 }}>{title}</h1>
            {hint ? (
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.85, maxWidth: 720 }}>{hint}</div>
            ) : null}
          </div>
          {meta ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flexShrink: 0, paddingTop: 4 }}>
              {meta}
            </div>
          ) : null}
        </section>

        {laneBar}

        {tabs.length ? (
          <nav
            className="nv-doc"
            aria-label={typeof title === "string" ? title : undefined}
            style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              padding: "9px 14px",
              display: "flex",
              gap: 5,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {tabs.map((item, indexInRail) => {
              const on = tool === item.value;
              const step = item.step || String(indexInRail + 1).padStart(2, "0");
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onTool?.(item.value)}
                  aria-current={on ? "page" : undefined}
                  style={tabBtn(on)}
                >
                  <span dir="ltr" style={{ fontFamily: MONO, fontSize: 10, opacity: 0.75 }}>{step}</span>
                  {item.label}
                  {item.count > 0 ? (
                    <span
                      dir="ltr"
                      style={{
                        fontFamily: MONO,
                        fontSize: 11,
                        background: on ? ACCENT : SURFACE,
                        color: on ? "#fff" : MUTED,
                        padding: "1px 7px",
                        borderRadius: 999,
                      }}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {viewNote ? (
              <span style={{ marginInlineStart: "auto", fontSize: 11, color: MUTED, lineHeight: 1.7, maxWidth: 380, textAlign: "start" }}>
                {viewNote}
              </span>
            ) : null}
          </nav>
        ) : null}

        {children}

        {legal ? (
          <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{legal}</p>
        ) : null}
      </div>
    </PlatformStampShell>
  );
}
