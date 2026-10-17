import React, { useContext } from "react";
import { BORDER, CARD, INK, MUTED, PAPER_SHADOW, RADIUS, SURFACE } from "@/lib/platformStyles";
import { StampNestContext } from "@/components/shared/stampNestContext";
import { StatusFlag } from "@/components/shared/StatusFlag";

/** Outer operational paper — used only when this card IS the page frame, never inside a stamp. */
export const identityFrame = {
  display: "flex",
  flexDirection: "column",
  borderRadius: RADIUS,
  border: `1px solid ${BORDER}`,
  background: CARD,
  overflow: "hidden",
  boxShadow: PAPER_SHADOW,
};

export const identityIconWrap = {
  width: 40,
  height: 40,
  flexShrink: 0,
  borderRadius: 10,
  background: SURFACE,
  color: INK,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function CardHeader({ Icon, kicker, title, subtitle, meta, nested, hasBody, tone, flag, ar }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: nested ? "2px 0 10px" : "14px 16px",
        borderBottom: hasBody ? `1px solid ${BORDER}` : "none",
        background: nested ? "transparent" : CARD,
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {title}
              </div>
              <StatusFlag tone={tone} flag={flag} ar={ar} label={typeof title === "string" ? title : ""} />
            </div>
          ) : <StatusFlag tone={tone} flag={flag} ar={ar} />}
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
  );
}

/** Nested titled box — paper tile only when it is the outer frame, not inside a stamp. */
export function ChromeBox({ children, padded = true, bodyStyle, style }) {
  const nested = useContext(StampNestContext);
  if (nested) {
    return (
      <div style={{ ...(padded ? { padding: "2px 0 8px" } : {}), ...bodyStyle, ...style }}>
        {children}
      </div>
    );
  }
  return (
    <div
      data-nv="identity"
      style={{ ...identityFrame, ...style }}
    >
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
  tone,
  flag,
  ar,
  children,
  dir,
  bodyStyle,
  bodySurface = false,
  className,
}) {
  const nested = useContext(StampNestContext);
  const isAr = ar ?? (dir ? dir === "rtl" : true);
  const hasHeader = Boolean(Icon || kicker || title || subtitle || meta);
  const hasBody = children != null;
  const header = hasHeader ? (
    <CardHeader
      Icon={Icon}
      kicker={kicker}
      title={title}
      subtitle={subtitle}
      meta={meta}
      nested={nested}
      hasBody={hasBody}
      tone={tone}
      flag={flag}
      ar={isAr}
    />
  ) : null;

  if (nested) {
    return (
      <section className={className} dir={dir} style={{ display: "flex", flexDirection: "column" }}>
        {header}
        {hasBody ? (
          <div style={{ padding: hasHeader ? "8px 0 0" : 0, ...bodyStyle }}>{children}</div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      data-nv="identity"
      className={className}
      style={identityFrame}
      dir={dir}
    >
      {header}
      {hasBody ? (
        <div style={{ padding: 16, background: bodySurface ? SURFACE : CARD, ...bodyStyle }}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
