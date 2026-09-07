import React, { useContext } from "react";
import { BORDER, CARD, INK, MUTED, NAVY_FILL, SURFACE } from "@/lib/platformStyles";
import { StampNestContext } from "@/components/shared/stampNestContext";

/** Live operational card chrome — navy rail, navy icon tile, paper white. Green is status, not card skin. */
export const identityFrame = {
  display: "flex",
  flexDirection: "column",
  borderRadius: 16,
  border: `1px solid ${BORDER}`,
  background: CARD,
  overflow: "hidden",
  boxShadow: "0 8px 24px rgba(20,40,75,.06)",
};

export const identityIconWrap = {
  width: 40,
  height: 40,
  flexShrink: 0,
  borderRadius: 11,
  background: SURFACE,
  color: INK,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

/** Nested titled box — paper tile inside a stamp; navy rail only when it is the outer frame. */
export function ChromeBox({ children, padded = true, bodyStyle, style }) {
  const nested = useContext(StampNestContext);
  return (
    <div
      data-nv="identity"
      data-nv-nested={nested ? "1" : undefined}
      style={{ ...identityFrame, boxShadow: nested ? "none" : identityFrame.boxShadow, ...style }}
    >
      {nested ? null : <div aria-hidden style={{ height: 3, background: NAVY_FILL }} />}
      <div style={{ ...(padded ? { padding: "18px 20px" } : {}), ...bodyStyle }}>{children}</div>
    </div>
  );
}

export default function IdentityCard({
  icon: Icon,
  kicker,
  title,
  subtitle,
  meta,
  rail = NAVY_FILL,
  children,
  dir,
  bodyStyle,
  bodySurface = false,
  className,
}) {
  const nested = useContext(StampNestContext);
  const hasHeader = Boolean(Icon || kicker || title || subtitle || meta);
  return (
    <section
      data-nv="identity"
      data-nv-nested={nested ? "1" : undefined}
      className={className}
      style={{ ...identityFrame, boxShadow: nested ? "none" : identityFrame.boxShadow }}
      dir={dir}
    >
      {nested ? null : <div aria-hidden style={{ height: 3, background: rail }} />}
      {hasHeader && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "14px 16px",
            borderBottom: children != null ? `1px solid ${BORDER}` : "none",
            background: CARD,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {Icon ? (
              <span style={identityIconWrap}>
                <Icon style={{ width: 18, height: 18 }} strokeWidth={1.75} />
              </span>
            ) : null}
            <div style={{ minWidth: 0 }}>
              {kicker ? (
                <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: "0.04em" }}>{kicker}</div>
              ) : null}
              {title ? (
                <div style={{ fontSize: 14, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {title}
                </div>
              ) : null}
              {subtitle ? (
                <div style={{ fontSize: 11, color: MUTED, marginTop: 3, lineHeight: 1.55 }}>{subtitle}</div>
              ) : null}
            </div>
          </div>
          {meta ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
              {meta}
            </div>
          ) : null}
        </header>
      )}
      {children != null && (
        <div style={{ padding: 16, background: bodySurface ? SURFACE : CARD, ...bodyStyle }}>
          {children}
        </div>
      )}
    </section>
  );
}
