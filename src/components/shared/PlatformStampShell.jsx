import React from "react";
import Logo from "@/components/Logo";
import { BORDER, CARD, INK, MUTED, NAVY_FILL, SURFACE, navPill, pageCol, pillCount } from "@/lib/platformStyles";
import { StampNestContext } from "@/components/shared/stampNestContext";

/** Shared NiroVera section chrome — title, then a full-width tab bar, then body. */
export default function PlatformStampShell({
  ar,
  title,
  hint,
  kicker,
  sections = [],
  tool,
  onTool,
  meta,
  metaBar,
  legal,
  children,
  maxWidth = 1280,
  flushBody = false,
  bare = false,
  appearance,
  className,
}) {
  const active = sections.find((section) => section.value === tool) || sections[0];
  const subtitle = (sections.length ? (active?.hint || hint) : hint) || "";
  const signing = appearance === "signing";

  if (bare) {
    return (
      <div style={{ ...pageCol, maxWidth, margin: "0 auto", width: "100%" }} className={["nv-stamp-bare", className].filter(Boolean).join(" ")} dir={ar ? "rtl" : "ltr"}>
        {children}
      </div>
    );
  }

  return (
    <div className={className} style={{ ...pageCol, maxWidth, margin: "0 auto", width: "100%" }} dir={ar ? "rtl" : "ltr"}>
      <section
        data-nv="stamp"
        style={{
          display: "flex",
          flexDirection: "column",
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: signing ? 22 : 16,
          overflow: "hidden",
          boxShadow: signing ? "0 18px 48px rgba(20,40,75,.08)" : "0 8px 24px rgba(20,40,75,.06)",
        }}
      >
        <div aria-hidden style={{ height: 3, background: NAVY_FILL }} />
        <header
          className="nv-stamp-head"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: signing ? "20px 22px 18px" : "14px 18px",
            borderBottom: sections.length ? "none" : `1px solid ${BORDER}`,
            background: signing
              ? "linear-gradient(180deg, color-mix(in oklab, var(--nv-accent, #1E9E63) 8%, var(--nv-card, #fff)) 0%, var(--nv-card, #fff) 100%)"
              : CARD,
          }}
        >
          <span
            aria-hidden
            style={{
              width: signing ? 42 : 36,
              height: signing ? 42 : 36,
              borderRadius: signing ? 12 : 10,
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: 0,
              background: "#fff",
              border: `1px solid ${BORDER}`,
            }}
          >
            <Logo size={signing ? 28 : 24} wordmark={false} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {kicker ? (
              <div style={{ fontSize: 10, letterSpacing: "0.18em", fontWeight: 600, color: MUTED }}>{kicker}</div>
            ) : null}
            <h1 style={{ margin: kicker ? "4px 0 0" : 0, fontSize: signing ? 22 : 18, fontWeight: 650, letterSpacing: signing ? "-0.02em" : undefined, color: INK }}>{title}</h1>
            {subtitle ? (
              <p style={{ margin: "5px 0 0", fontSize: 13, lineHeight: 1.65, color: MUTED, maxWidth: 760 }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {sections.length === 0 && meta ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
              {meta}
            </div>
          ) : null}
        </header>

        {sections.length > 0 ? (
          <nav
            aria-label={title}
            className="nv-stamp-tabs nv-stamp-tabs-bar"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              background: SURFACE,
              padding: signing ? "10px 14px" : "8px 12px",
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            {sections.map(({ value, label, icon: Icon, count, step }) => {
              const selected = tool === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onTool?.(value)}
                  style={{
                    ...navPill(selected),
                    flex: "0 1 auto",
                    minWidth: 0,
                  }}
                >
                  {step ? (
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 99,
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        background: selected ? "color-mix(in oklab, #fff 24%, transparent)" : "transparent",
                        color: selected ? "inherit" : MUTED,
                        border: selected ? "none" : `1px solid ${BORDER}`,
                      }}
                    >
                      {step}
                    </span>
                  ) : Icon ? (
                    <Icon style={{ width: 14, height: 14, color: "inherit", flexShrink: 0 }} />
                  ) : null}
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {label}
                  </span>
                  {count > 0 ? (
                    <span dir="ltr" style={pillCount(selected)}>
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        ) : null}

        {(metaBar || (meta && sections.length > 0)) ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderBottom: `1px solid ${BORDER}`,
              background: CARD,
            }}
          >
            {metaBar || meta}
          </div>
        ) : null}

        <div
          className="nv-stamp-workspace"
          style={{ padding: flushBody ? 0 : 16, background: SURFACE }}
        >
          <StampNestContext.Provider value={true}>{children}</StampNestContext.Provider>
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
            }}
          >
            {legal}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
