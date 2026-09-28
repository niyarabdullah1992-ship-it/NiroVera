import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Camera,
  ClipboardList,
  Folder,
  Landmark,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MessageCircle,
  MessageSquare,
  Network,
  PenLine,
  Settings2,
  ShieldCheck,
  UserCog,
  UserPlus,
  Wallet,
} from "lucide-react";
import { RAIL_SIDE_COLOR, railBadgeTone, railFooter } from "@/lib/suiteRailFrame";
import { railFaceHref, routeRailSide, useExplicitRailSide, useSetRailSide } from "@/lib/railSide";

const LINE = "var(--nv-line)";
const INK = "var(--nv-ink)";
const MUTED = "var(--nv-ink3)";
const LABEL = "var(--nv-ok-ink)";
const SELECT_BG = "var(--nv-accent-soft)";
const DANGER = "var(--nv-bad-ink)";
const GOLD = RAIL_SIDE_COLOR.employee;
const GREEN = RAIL_SIDE_COLOR.manage;

const ICONS = {
  duty: CalendarClock,
  signing: PenLine,
  performance: BarChart3,
  money: Wallet,
  tasks: ListTodo,
  "work-proof": Camera,
  "visitor-proof": UserPlus,
  requests: ClipboardList,
  discipline: AlertTriangle,
  complaints: MessageCircle,
  compliance: ShieldCheck,
  overview: Activity,
  decide: LayoutDashboard,
  people: Network,
  workforce: UserCog,
  org: Network,
  ministry: Landmark,
  files: Folder,
};

function keyOnSide(side, activeKey) {
  const keys = new Set((side?.groups || []).flatMap((group) => (group.items || []).map((item) => item.key)));
  if (!activeKey) return "";
  if (keys.has(activeKey)) return activeKey;
  const swapped = activeKey.endsWith(":manage")
    ? activeKey.replace(/:manage$/, ":employee")
    : activeKey.endsWith(":employee")
      ? activeKey.replace(/:employee$/, ":manage")
      : "";
  if (swapped && keys.has(swapped)) return swapped;
  const section = String(activeKey).split(":")[0];
  return [...keys].find((key) => key.startsWith(`${section}:`)) || "";
}

function Row({ to, icon: Icon, label, active, badge, badgeKind, glow, title, onClick, danger }) {
  const tone = railBadgeTone(badgeKind);
  const face = {
    fontFamily: "inherit",
    textAlign: "start",
    display: "grid",
    gridTemplateColumns: "15px minmax(0,1fr) auto",
    gap: 10,
    alignItems: "center",
    padding: "0 9px",
    height: 30,
    fontSize: 12,
    border: "none",
    borderRadius: 5,
    background: danger ? "transparent" : (active ? SELECT_BG : "transparent"),
    color: danger ? DANGER : (active ? LABEL : INK),
    boxShadow: "none",
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
    textDecoration: "none",
    position: "relative",
  };

  const inner = (
    <>
      <Icon style={{ width: 15, height: 15, color: "inherit" }} strokeWidth={active ? 2 : 1.7} />
      <span className="nv-rail-name" style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
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
            background: tone.bg,
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
            background: tone.bg,
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
      <Link to={to} title={title || label} aria-label={label} data-rail-label={label} aria-current={active ? "page" : undefined} className="nv-rail-row nv-rail-btn" data-glow={glow || "off"} onClick={onClick} style={face}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" title={title || label} aria-label={label} data-rail-label={label} onClick={onClick} className="nv-rail-row" data-glow={glow || "off"} style={face}>
      {inner}
    </button>
  );
}

export default function SuiteRail({
  sides = [],
  activeKey = "",
  pathname = "",
  lang = "ar",
  sidebarSide,
  canOpenSettings,
  onSettings,
  onLogout,
  onFeedback,
  user,
  data,
  companyName = "",
  logoUrl = "",
}) {
  const ar = lang !== "en";
  const navigate = useNavigate();
  const location = useLocation();
  const routeSide = routeRailSide(sides, activeKey, pathname) || sides[0]?.id || "employee";
  const pinned = useExplicitRailSide();
  const setRailSide = useSetRailSide();
  const sideId = pinned && sides.some((side) => side.id === pinned) ? pinned : routeSide;
  const side = sides.find((item) => item.id === sideId) || sides[0] || null;
  const footer = railFooter(user, data, lang, side?.id === "manage" ? "manage" : "employee");
  const showCard = !!(footer.name || footer.line);
  const [open, setOpen] = React.useState(() => {
    try { return window.localStorage.getItem("nv7-nav") !== "closed"; } catch { return true; }
  });
  const [menuOpen, setMenuOpen] = React.useState(false);
  const toggleRail = () => {
    setOpen((current) => {
      const next = !current;
      try { window.localStorage.setItem("nv7-nav", next ? "open" : "closed"); } catch { /* keep the click */ }
      return next;
    });
  };

  return (
    <aside
      data-nv="sidebar"
      data-rail-side={side?.id || ""}
      data-collapsed={open ? "false" : "true"}
      className={`corporate-sidebar nv-group-rail nv-suite-rail hidden md:flex z-40 h-full shrink-0 pt-safe ${sidebarSide}`}
    >
      <button
        type="button"
        className="nv-rail-fold"
        aria-expanded={open}
        aria-label={ar ? (open ? "طيّ القائمة" : "فتح القائمة") : (open ? "Collapse navigation" : "Expand navigation")}
        onClick={toggleRail}
        style={{
          flex: "none",
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 26,
          padding: "0 9px",
          marginBottom: 4,
          borderRadius: 5,
          border: `1px solid ${LINE}`,
          background: "transparent",
          color: MUTED,
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "start",
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1, width: 17, textAlign: "center" }}>{open ? "»" : "☰"}</span>
        <span className="nv-rail-fold-label">{ar ? (open ? "طيّ القائمة" : "فتح القائمة") : (open ? "Collapse" : "Expand")}</span>
      </button>
      <Link
        to="/app"
        className="nv-rail-brand"
        title="NiroVera"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 6px 10px",
          borderBottom: `1px solid ${LINE}`,
          background: "transparent",
          color: INK,
          textDecoration: "none",
          flexShrink: 0,
          borderRadius: 0,
          marginBottom: 8,
        }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: "contain", flexShrink: 0, border: `1px solid ${LINE}`, background: "var(--nv-card)" }} />
        ) : (
          <span style={{ width: 30, height: 30, borderRadius: 6, background: "#3C7D50", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: 13 }}>NV</span>
        )}
        <span className="nv-rail-brand-copy" style={{ display: "flex", flexDirection: "column", lineHeight: 1.35, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: INK, letterSpacing: "-.01em" }}>{ar ? "نيروفيرا" : "NiroVera"}</span>
          <span style={{ fontSize: 10, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{companyName || (ar ? "منظومة الموارد البشرية" : "HR system")}</span>
        </span>
      </Link>

      {sides.length ? (
        <div
          role="tablist"
          aria-label={ar ? "جهة السكة" : "Rail side"}
          className="nv-rail-tabs"
          style={{ display: "grid", gridTemplateColumns: sides.length > 1 ? "1fr 1fr" : "1fr", gap: 6, padding: "10px 4px 0", flexShrink: 0 }}
        >
          {sides.map((item) => {
            const on = item.id === side?.id;
            const fill = item.id === "employee" ? GOLD : GREEN;
            const ink = item.id === "employee" ? "#111418" : "#fff";
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={on}
                className="nv-rail-tab"
                onClick={() => {
                  if (item.id === sideId) return;
                  setRailSide(item.id);
                  const next = railFaceHref(location.pathname, location.search, item.id);
                  const here = `${location.pathname}${location.search}`;
                  if (next && next !== here) navigate(next);
                }}
                style={{
                  height: 26,
                  borderRadius: 5,
                  border: on ? "none" : `1px solid ${LINE}`,
                  background: on ? fill : "var(--nv-card)",
                  color: on ? ink : INK,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span className="nv-rail-tab-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {side?.subtitle ? (
        <p className="nv-rail-subtitle" style={{ margin: 0, padding: "8px 8px 0", fontSize: 11, lineHeight: 1.45, color: MUTED, flexShrink: 0 }}>
          {side.subtitle}
        </p>
      ) : null}

      <nav className="no-select no-scrollbar nv-rail-nav" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", width: "100%" }}>
        {(side?.groups || []).map((group) => (
          <div key={group.id} className="nv-rail-cluster" style={{ display: "flex", flexDirection: "column", borderBottom: `1px solid ${LINE}`, padding: "7px 0" }}>
            {group.label ? (
              group.id === "mine" && footer.to ? (
                <Link
                  to={footer.to}
                  className="nv-rail-cluster-name"
                  title={ar ? "افتح ملفي" : "Open my file"}
                  aria-current={location.pathname === footer.to ? "page" : undefined}
                  onClick={() => { setMenuOpen(false); setRailSide("employee"); }}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: ".04em",
                    color: location.pathname === footer.to ? "#3C7D50" : LABEL,
                    padding: "10px 10px 4px",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                  }}
                >
                  {group.label}
                </Link>
              ) : (
                <span className="nv-rail-cluster-name" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".04em", color: LABEL, padding: "10px 10px 4px", whiteSpace: "nowrap" }}>
                  {group.label}
                </span>
              )
            ) : null}
            {group.items.map((item) => (
              <Row
                key={item.key}
                to={item.to}
                icon={ICONS[item.iconKey] || LayoutDashboard}
                label={item.label}
                active={item.key === keyOnSide(side, activeKey)}
                onClick={() => { if (side?.id) setRailSide(side.id); }}
                badge={item.badge}
                badgeKind={item.badgeKind}
                glow={item.glow}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="nv-rail-cluster" style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${LINE}`, padding: "7px 0", flexShrink: 0 }}>
        {canOpenSettings && side?.id !== "employee" ? (
          <Row icon={Settings2} label={ar ? "الإعدادات" : "Settings"} onClick={onSettings} />
        ) : null}
        <Row icon={LogOut} label={ar ? "تسجيل الخروج" : "Sign out"} onClick={onLogout} danger />
        {showCard ? (
          <div
            className="nv-rail-foot-card"
            data-rail-footer="file"
            data-active={footer.to && location.pathname === footer.to ? "true" : "false"}
            style={{
              margin: "8px 4px 0",
              padding: "10px 8px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              position: "relative",
            }}
          >
            <Link
              to={footer.to || "/app/employees"}
              aria-label={footer.name || (ar ? "الملف" : "File")}
              title={ar ? "افتح ملفي" : "Open my file"}
              aria-current={footer.to && location.pathname === footer.to ? "page" : undefined}
              onClick={() => { setMenuOpen(false); setRailSide("employee"); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
                flex: 1,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {footer.initials ? (
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: side?.id === "employee" ? "#C8A45A" : "#3C7D50",
                  color: side?.id === "employee" ? "#111418" : "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10.5,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
                >
                  {footer.initials}
                </span>
              ) : null}
              <span className="nv-rail-foot-copy" style={{ minWidth: 0, flex: 1, lineHeight: 1.4 }}>
                {footer.name ? (
                  <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {footer.name}
                  </span>
                ) : null}
                {footer.line ? (
                  <span className="nv-rail-foot-line" style={{ display: "block", fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {footer.line}
                  </span>
                ) : null}
              </span>
            </Link>
            {open ? (
              <button
                type="button"
                className="nv-rail-foot-copy"
                aria-expanded={menuOpen}
                aria-label={ar ? "حسابي" : "My account"}
                onClick={() => setMenuOpen((value) => !value)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#3C7D50",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                  fontFamily: "inherit",
                }}
              >
                ‹
              </button>
            ) : null}
            {menuOpen ? (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  insetInlineStart: 0,
                  width: 220,
                  background: "var(--nv-card)",
                  border: `1px solid ${LINE}`,
                  borderRadius: 8,
                  zIndex: 30,
                  overflow: "hidden",
                  boxShadow: "0 18px 44px rgba(12,20,16,.18)",
                }}
              >
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onFeedback?.(); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    border: "none",
                    background: "transparent",
                    color: INK,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "start",
                  }}
                >
                  <MessageSquare style={{ width: 14, height: 14, color: "#3C7D50" }} strokeWidth={1.75} />
                  {ar ? "التقييم والاقتراحات" : "Feedback"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
