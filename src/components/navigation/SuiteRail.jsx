import React from "react";
import { Link } from "react-router-dom";
import { LogOut, Settings2 } from "lucide-react";
import Logo from "@/components/Logo";
import { railBadgeTone } from "@/lib/suiteRailFrame";
import { BORDER, MUTED, NAVY_FILL } from "@/lib/platformStyles";

const LINE = BORDER;
const BODY = MUTED;
const MARK = "var(--nv-accent, #1E9E63)";
const NAVY = NAVY_FILL;

function Row({ to, icon: Icon, label, active, badge, badgeKind, glow, title, onClick, danger }) {
  const tone = railBadgeTone(badgeKind);
  const face = {
    fontFamily: "inherit",
    textAlign: "start",
    display: "grid",
    gridTemplateColumns: "19px minmax(0,1fr) auto",
    gap: 10,
    alignItems: "center",
    padding: "9px 12px",
    border: "none",
    borderRadius: 10,
    background: danger ? "transparent" : (active ? NAVY : "transparent"),
    color: danger ? "#8a1c2b" : (active ? "#fff" : BODY),
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
    textDecoration: "none",
    position: "relative",
  };

  const inner = (
    <>
      <Icon style={{ width: 19, height: 19, color: "inherit" }} strokeWidth={active ? 2 : 1.7} />
      <span className="nv-rail-name" style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
        {label}
      </span>
      {badge != null ? (
        <span
          dir="ltr"
          className="nv-rail-badge-inline"
          style={{
            minWidth: 16,
            height: 16,
            padding: "0 5px",
            boxSizing: "border-box",
            background: active ? MARK : tone.bg,
            color: "#fff",
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 9,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : <span className="nv-rail-badge-inline" />}
      {badge != null ? (
        <span
          dir="ltr"
          className="nv-rail-badge-float"
          style={{
            display: "none",
            position: "absolute",
            top: 0,
            insetInlineEnd: 0,
            minWidth: 15,
            height: 14,
            padding: "0 4px",
            boxSizing: "border-box",
            background: active ? MARK : tone.bg,
            color: "#fff",
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 9,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} title={title || label} aria-label={label} aria-current={active ? "page" : undefined} className="nv-rail-row nv-rail-btn" data-glow={glow || "off"} style={face}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" title={title || label} aria-label={label} onClick={onClick} className="nv-rail-row" data-glow={glow || "off"} style={face}>
      {inner}
    </button>
  );
}

export default function SuiteRail({
  clusters,
  activeCategory,
  lang = "ar",
  sidebarSide,
  canOpenSettings,
  onSettings,
  onLogout,
}) {
  const ar = lang !== "en";

  return (
    <aside
      data-nv="sidebar"
      className={`corporate-sidebar nv-group-rail nv-suite-rail hidden md:flex z-40 h-full shrink-0 pt-safe ${sidebarSide}`}
    >
      <Link
        to="/app"
        className="nv-rail-brand"
        title="NiroVera"
        style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 12px",
          borderBottom: `1px solid ${LINE}`,
          background: NAVY,
          color: "#fff",
          textDecoration: "none",
          flexShrink: 0,
          borderRadius: 0,
        }}
      >
        <span style={{ width: 26, height: 26, background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Logo size={18} wordmark={false} />
        </span>
        <span className="nv-rail-brand-copy" style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>NiroVera</span>
          <span style={{ fontSize: 10, color: "#C7D2E4" }}>PowerCare</span>
        </span>
      </Link>

      <nav className="no-select no-scrollbar nv-rail-nav" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", width: "100%" }}>
        {clusters.map((cluster) => (
          <div key={cluster.id} className="nv-rail-cluster" style={{ display: "flex", flexDirection: "column", borderBottom: `1px solid ${LINE}`, padding: "7px 0" }}>
            <span className="nv-rail-cluster-name" style={{ fontSize: 11, letterSpacing: ".14em", color: MUTED, padding: "2px 12px 5px" }}>
              {cluster.label}
            </span>
            {cluster.items.map((group) => (
              <Row
                key={group.key}
                to={group.to}
                icon={group.icon}
                label={group.label}
                active={group.key === activeCategory}
                badge={group.badge}
                badgeKind={group.badgeKind}
                glow={group.glow}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="nv-rail-cluster" style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${LINE}`, padding: "7px 0", flexShrink: 0 }}>
        {canOpenSettings ? (
          <Row icon={Settings2} label={ar ? "الإعدادات" : "Settings"} onClick={onSettings} />
        ) : null}
        <Row icon={LogOut} label={ar ? "تسجيل الخروج" : "Sign out"} onClick={onLogout} danger />
      </div>
    </aside>
  );
}
