import React, { useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { allowedNavFor } from "@/lib/navVisibility";
import { mobilePathsFor } from "@/lib/quickNavigation";
import { buildMobileTabs } from "@/lib/suiteNav";
import { useRailSide } from "@/lib/railSide";
import { ICONS, keyOnSide } from "@/components/navigation/SuiteRail";
import { POWERCARE_MARK_URL, POWERCARE_MARK_ON_DARK_URL } from "@/lib/brand";

const LEGACY_TABS = buildMobileTabs();
const PRIMARY_COUNT = 4;

const pathOf = (to) => String(to || "").split("?")[0];
const legacyMatch = (tab, pathname) =>
  tab.end ? pathname === tab.to : pathname === tab.to || pathname.startsWith(tab.to + "/");

/**
 * Phone bottom bar. It reads the same rail the desktop sidebar shows: the first
 * four sections of the side in use (الموظف / الإدارة), then «القائمة», which
 * opens the full rail as a drawer — every section, the side switch, the
 * person's file and sign-out. Nothing on desktop is out of reach on a phone.
 */
export default function BottomTabBar({ sides = [], activeKey = "" }) {
  const { t, lang } = useI18n();
  const ar = lang !== "en";
  const { currentUser, data, company } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const resolvedSide = useRailSide();
  const touchStart = useRef(null);

  if (!currentUser) return null;

  const side = sides.find((item) => item.id === resolvedSide) || sides[0] || null;
  const railItems = (side?.groups || []).flatMap((group) => group.items || []).filter((item) => item.to);

  let tabs;
  if (railItems.length) {
    const activeOnSide = keyOnSide(side, activeKey);
    tabs = railItems.slice(0, PRIMARY_COUNT).map((item) => ({
      id: item.key,
      to: item.to,
      label: item.label,
      Icon: ICONS[item.iconKey] || LayoutDashboard,
      active: item.key === activeOnSide,
      badge: item.badge,
    }));
  } else {
    // No rail yet (first paint): fall back to the role's fixed shortcuts.
    const allowed = allowedNavFor(currentUser, data, company);
    tabs = mobilePathsFor(currentUser.role)
      .map((path) => LEGACY_TABS.find((tab) => tab.to === path))
      .filter((tab) => tab && allowed.has(tab.to))
      .slice(0, PRIMARY_COUNT)
      .map((tab) => ({ id: tab.to, to: tab.to, label: t(tab.key) || tab.key, Icon: tab.icon, active: legacyMatch(tab, location.pathname) }));
  }

  const openMenu = () => window.dispatchEvent(new Event("powercare:rail-open"));

  const openTab = (tab) => {
    const here = `${location.pathname}${location.search}`;
    if (tab.active && pathOf(tab.to) === location.pathname) {
      window.dispatchEvent(new CustomEvent("powercare:tab-reset", { detail: pathOf(tab.to) }));
      if (here !== tab.to) navigate(tab.to, { replace: true });
      return;
    }
    navigate(tab.to);
  };

  const swipeTabs = (event) => {
    if (touchStart.current === null || !tabs.length) return;
    const delta = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(delta) < 55) return;
    const activeIndex = tabs.findIndex((tab) => tab.active);
    if (activeIndex < 0) return;
    // RTL: a swipe to the left moves to the next tab.
    const step = (ar ? delta < 0 : delta > 0) ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(tabs.length - 1, activeIndex + step));
    if (nextIndex !== activeIndex) openTab(tabs[nextIndex]);
  };

  return (
    <nav
      aria-label={ar ? "التنقل السريع" : "Quick navigation"}
      onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
      onTouchEnd={swipeTabs}
      className="tech-bottom-nav nv-bottom-bar fixed inset-x-0 bottom-0 z-50 pb-safe no-select md:hidden"
    >
      <div className="nv-bottom-bar__row">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => openTab(tab)}
            aria-current={tab.active ? "page" : undefined}
            className="nv-bottom-bar__tab"
            data-active={tab.active ? "true" : "false"}
          >
            <span className="nv-bottom-bar__icon">
              <tab.Icon className="w-[21px] h-[21px]" strokeWidth={tab.active ? 2.2 : 1.7} />
              {tab.badge ? <span className="nv-bottom-bar__badge">{tab.badge}</span> : null}
            </span>
            <span className="nv-bottom-bar__label">{tab.label}</span>
          </button>
        ))}
        <button type="button" onClick={openMenu} className="nv-bottom-bar__tab nv-bottom-bar__menu" aria-haspopup="dialog">
          <span className="nv-bottom-bar__icon nv-bottom-bar__mark">
            <img className="nv-mark-on-light" src={POWERCARE_MARK_URL} alt="" />
            <img className="nv-mark-on-dark" src={POWERCARE_MARK_ON_DARK_URL} alt="" />
          </span>
          <span className="nv-bottom-bar__label">{ar ? "القائمة" : "Menu"}</span>
        </button>
      </div>
    </nav>
  );
}
