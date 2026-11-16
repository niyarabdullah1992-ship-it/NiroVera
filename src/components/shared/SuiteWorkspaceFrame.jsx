import React from "react";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import Nv7SectionHead, { nv7Count, nv7Tab } from "@/components/shared/Nv7SectionHead";
import { MUTED, NAVY } from "@/lib/platformStyles";


/**
 * «المزيد ▾» — the tabs a section needs now and then. The active one is always shown inline, so
 * the menu never hides where you are.
 */
function MoreTabs({ ar, items, tool, onTool }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const esc = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  const waiting = items.reduce((sum, item) => sum + (Number(item.count) > 0 ? Number(item.count) : 0), 0);
  return (
    <span ref={ref} className="nv-more-tabs" style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} data-more-tabs="1" onClick={() => setOpen((v) => !v)} style={nv7Tab(false)}>
        {ar ? "المزيد" : "More"}
        {waiting > 0 ? <span dir="ltr" style={nv7Count(false)}>{waiting}</span> : null}
        <span aria-hidden style={{ fontSize: 11, opacity: 0.7 }}>▾</span>
      </button>
      {open ? (
        <span role="menu" className="nv-more-tabs__menu">
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onTool?.(item.value); }}
              aria-current={tool === item.value ? "page" : undefined}
            >
              <span>{item.label}</span>
              {item.count > 0 ? <span dir="ltr" style={nv7Count(false)}>{item.count}</span> : null}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Shared /app workspace chrome — v7 deep-green header, tabs on the green.
 * A tab marked `more: true` folds under «المزيد» unless it is the one open.
 */
export default function SuiteWorkspaceFrame({
  ar,
  kicker,
  title,
  hint,
  meta,
  laneBar = null,
  tabs = [],
  tabTone = "white",
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
              {tabs.filter((item) => !item.more || item.value === tool).map((item) => {
                const on = tool === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onTool?.(item.value)}
                    aria-current={on ? "page" : undefined}
                    style={tabTone === "gold" && on ? { ...nv7Tab(true), background: "#C8A45A", border: "1px solid #C8A45A", color: "#3A2A08" } : nv7Tab(on)}
                  >
                    {item.label}
                    {item.count > 0 ? (
                      <span dir="ltr" style={nv7Count(on)}>
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {tabs.some((item) => item.more && item.value !== tool) ? (
                <MoreTabs ar={ar} items={tabs.filter((item) => item.more && item.value !== tool)} tool={tool} onTool={onTool} />
              ) : null}
              {viewNote ? (
                <span style={{ marginInlineStart: "auto", fontSize: 11, color: MUTED, lineHeight: 1.7, maxWidth: 380, textAlign: "start" }}>
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
