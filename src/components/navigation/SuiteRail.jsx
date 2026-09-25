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
  Menu,
  MessageCircle,
  Network,
  PenLine,
  Settings2,
  ShieldCheck,
  User,
  UserCog,
  UserPlus,
  Wallet,
} from "lucide-react";
import { RAIL_SIDE_COLOR, railBadgeTone, railFooter } from "@/lib/suiteRailFrame";
import { railFaceHref, routeRailSide, useExplicitRailSide, useSetRailSide } from "@/lib/railSide";

const LINE = "#E4E9E6";
const INK = "#111418";
const MUTED = "#555C66";
const LABEL = "#2F6B43";
const SELECT_BG = "#E6F2EA";
const DANGER = "#9B2335";
const GOLD = RAIL_SIDE_COLOR.employee;
const GREEN = RAIL_SIDE_COLOR.manage;

const ICONS = {
  file: User,
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
    gridTemplateColumns: "19px minmax(0,1fr) auto",
    gap: 10,
    alignItems: "center",
    padding: "0 11px",
    height: 32,
    border: "none",
    borderRadius: 6,
    background: danger ? "transparent" : (active ? SELECT_BG : "transparent"),
    color: danger ? DANGER : (active ? GREEN : INK),
    boxShadow: active && !danger ? `inset -3px 0 0 ${GREEN}` : "none",
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
    textDecoration: "none",
    position: "relative",
  };

  const inner = (
    <>
      <Icon style={{ width: 19, height: 19, color: "inherit" }} strokeWidth={active ? 2 : 1.7} />
      <span className="nv-rail-name" style={{ fontSize: 12.5, fontWeight: active ? 600 : 500, color: "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
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
  user,
  data,
}) {
  const ar = lang !== "en";
  const navigate = useNavigate();
  const location = useLocation();
  const routeSide = routeRailSide(sides, activeKey, pathname) || sides[0]?.id || "employee";
  const pinned = useExplicitRailSide();
  const setRailSide = useSetRailSide();
  const sideId = pinned && sides.some((side) => side.id === pinned) ? pinned : routeSide;
  const side = sides.find((item) => item.id === sideId) || sides[0] || null;
  const accent = side?.id === "employee" ? GOLD : GREEN;
  const footer = railFooter(user, data, lang, side?.id === "manage" ? "manage" : "employee");
  const showCard = !!(footer.name || footer.line);
  const [open, setOpen] = React.useState(() => {
    try { return window.localStorage.getItem("nv7-nav") !== "closed"; } catch { return true; }
  });
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
        aria-label={ar ? (open ? "طي الشريط" : "فتح الشريط") : (open ? "Collapse navigation" : "Expand navigation")}
        onClick={toggleRail}
        style={{
          width: 30,
          height: 30,
          margin: "0 4px 6px",
          borderRadius: 6,
          border: `1px solid ${LINE}`,
          background: "#fff",
          color: INK,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          alignSelf: open ? "flex-start" : "center",
        }}
      >
        <Menu style={{ width: 16, height: 16 }} strokeWidth={1.8} />
      </button>
      <Link
        to="/app"
        className="nv-rail-brand"
        title="NiroVera"
        style={{
          height: 58,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "2px 8px 14px",
          borderBottom: `1px solid ${LINE}`,
          background: "transparent",
          color: INK,
          textDecoration: "none",
          flexShrink: 0,
          borderRadius: 0,
        }}
      >
        <span style={{ width: 30, height: 30, borderRadius: 6, background: "#3C7D50", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: 12 }}>NV</span>
        <span className="nv-rail-brand-copy" style={{ display: "flex", flexDirection: "column", lineHeight: 1.35, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>{ar ? "نيروفيرا" : "NiroVera"}</span>
          <span style={{ fontSize: 10.5, color: MUTED }}>NiroVera · {ar ? "منظومة الموارد البشرية" : "HR system"}</span>
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
                  background: on ? fill : "#FFFFFF",
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
              <span className="nv-rail-cluster-name" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".04em", color: LABEL, padding: "10px 10px 4px", whiteSpace: "nowrap" }}>
                {group.label}
              </span>
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
        {canOpenSettings ? (
          <Row icon={Settings2} label={ar ? "الإعدادات" : "Settings"} onClick={onSettings} />
        ) : null}
        <Row icon={LogOut} label={ar ? "تسجيل الخروج" : "Sign out"} onClick={onLogout} danger />
        {showCard ? (
          <div
            className="nv-rail-foot-card"
            style={{
              margin: "8px 4px 0",
              padding: "10px",
              borderRadius: 6,
              border: `1px solid ${LINE}`,
              background: "#F7F8FA",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ minWidth: 0, flex: 1 }}>
              {footer.name ? (
                <span className="nv-rail-foot-copy" style={{ display: "block", fontSize: 13, fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {footer.name}
                </span>
              ) : null}
              {footer.line ? (
                <span className="nv-rail-foot-copy" style={{ display: "block", marginTop: 2, fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {footer.line}
                </span>
              ) : null}
            </span>
            {footer.initials ? (
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: accent, color: side?.id === "employee" ? "#14213D" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {footer.initials}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
