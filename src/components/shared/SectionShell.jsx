import React from "react";
import { BORDER, CARD, MUTED, RADIUS, STAGE, SURFACE } from "@/lib/platformStyles";
import { StampNestContext } from "@/components/shared/stampNestContext";

const mono = { fontFamily: "'IBM Plex Mono', monospace" };

function sectionTab(on) {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 34,
    minWidth: 96,
    padding: "0 13px",
    borderRadius: 7,
    fontSize: 12,
    cursor: "pointer",
    border: on ? "none" : "1px solid rgba(255,255,255,.35)",
    background: on ? "#FFFFFF" : "transparent",
    color: on ? "#0B3D27" : "#FFFFFF",
    fontWeight: on ? 700 : 500,
    boxShadow: on ? "0 1px 2px rgba(12,20,16,.12)" : "none",
  };
}

/**
 * Shared /app section chrome — the live signing frame:
 * white header, Arabic-start title, optional pill rail, quiet STAGE well.
 */
export default function SectionShell({
  ar,
  lead,
  kicker,
  title,
  hint,
  meta,
  metaBar,
  legal,
  sections = [],
  tool,
  onTool,
  children,
  maxWidth = 1280,
  flushBody = false,
  bare = false,
  className,
  nest = true,
}) {
  const active = sections.find((section) => section.value === tool) || sections[0];
  const subtitle = (sections.length ? (active?.hint || hint) : hint) || "";
  const metaInBar = Boolean(metaBar);
  const headerMeta = meta;
  const body = nest
    ? <StampNestContext.Provider value={true}>{children}</StampNestContext.Provider>
    : children;

  if (bare) {
    return (
      <div className={className} dir={ar ? "rtl" : "ltr"} style={{ width: "100%", maxWidth, margin: "0 auto" }}>
        {body}
      </div>
    );
  }

  return (
    <div className={className} dir={ar ? "rtl" : "ltr"} style={{ width: "100%", maxWidth, margin: "0 auto" }}>
      <section
        data-nv="stamp"
        style={{
          display: "flex",
          flexDirection: "column",
          border: `1px solid ${BORDER}`,
          borderRadius: RADIUS,
          overflow: "hidden",
          background: STAGE,
          boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
        }}
      >
        <header
          className="nv-stamp-head"
          style={{
            background: "linear-gradient(135deg,#0B3D27 0%,#0F5535 100%)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "14px 18px",
            flexShrink: 0,
            textAlign: "start",
            boxShadow: "0 6px 18px rgba(6,61,38,.16)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0, flex: 1 }}>
            {lead ? <div style={{ flexShrink: 0, paddingTop: 2 }}>{lead}</div> : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
              {kicker ? (
                <span data-nv="kicker" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#A9CDB8", fontWeight: 600, fontSize: 10.5 }}>
                  <span aria-hidden style={{ width: 12, height: 2, background: "#C8A45A", display: "inline-block" }} />
                  {kicker}
                </span>
              ) : null}
              <h1 className="nv-h" style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: 0, color: "#FFFFFF" }}>{title}</h1>
              {subtitle ? (
                <p style={{ margin: "3px 0 0", fontSize: 12, lineHeight: 1.7, color: "#C5DBCD", maxWidth: 680 }}>{subtitle}</p>
              ) : null}
            </div>
          </div>
          {(kicker || (headerMeta != null && headerMeta !== false)) ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                flexShrink: 0,
                paddingTop: 4,
                color: "#C5DBCD",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {headerMeta != null && headerMeta !== false ? (
                typeof headerMeta === "string" || typeof headerMeta === "number" ? (
                  <span>{headerMeta}</span>
                ) : (
                  headerMeta
                )
              ) : null}
            </div>
          ) : null}

        {sections.length ? (
          <nav
            aria-label={title}
            className="nv-stamp-tabs nv-signing-section-tabs"
            style={{
              background: "transparent",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              flexShrink: 0,
            }}
          >
            {sections.map(({ value, label, icon: Icon, count, step }) => {
              const on = tool === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onTool?.(value)}
                  aria-current={on ? "page" : undefined}
                  style={sectionTab(on)}
                >
                  {step ? (
                    <span
                      dir="ltr"
                      style={{
                        ...mono,
                        width: 18,
                        height: 18,
                        borderRadius: 10,
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        background: on ? "#fff" : "rgba(255,255,255,.2)",
                        color: on ? "#0B3D27" : "#FFFFFF",
                      }}
                    >
                      {step}
                    </span>
                  ) : Icon ? (
                    <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                  ) : null}
                  {label}
                  {count > 0 ? (
                    <span dir="ltr" style={{ ...mono, fontSize: 10, padding: "1px 5px", borderRadius: 3, background: on ? "#0B3D27" : "rgba(255,255,255,.24)", color: "#fff" }}>
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        ) : null}
        </header>

        {metaInBar ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderBottom: `1px solid ${BORDER}`,
              background: CARD,
              textAlign: "start",
            }}
          >
            {metaBar || meta}
          </div>
        ) : null}

        <div className="nv-stamp-workspace" style={{ padding: flushBody ? 0 : 16, minWidth: 0, overflow: flushBody ? "hidden" : undefined }}>
          {body}
        </div>

        {legal ? (
          <footer
            style={{
              padding: "10px 16px 12px",
              borderTop: `1px solid ${BORDER}`,
              fontSize: 11,
              lineHeight: 1.65,
              color: MUTED,
              background: CARD,
              textAlign: "start",
            }}
          >
            {legal}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
