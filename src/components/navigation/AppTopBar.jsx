import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { faceSectionTarget, useRailSide } from "@/lib/railSide";
import { suiteSectionPagesForSide } from "@/lib/suiteRailFrame";
import { matchSuiteNavItem } from "@/lib/suiteNav";
import { dutyCrumb, dutySectionPages, isDutyPath } from "@/lib/dutyNav";
import { useAuth } from "@/lib/PowerCareAuth";
import { canCreateTasks } from "@/lib/permissions";
import BackButton from "@/components/mobile/BackButton";
import HeaderDateTime from "@/components/navigation/HeaderDateTime";
import ScopeBar, { NotificationBell } from "@/components/navigation/ScopeBar";
import SyncStatusIndicator from "@/components/SyncStatusIndicator";
import ThemeToggle from "@/components/ThemeToggle";
import DutySmartSearch, { dutySearchPages } from "@/components/attendance/DutySmartSearch";
import { BTN_FILL, BTN_INK, MUTED } from "@/lib/platformStyles";

/** Small screens: date, sync and language fold into one «⋯» segment. */
function HeaderOverflow({ ar, lang, isSyncing, langButton }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const name = ar ? "المزيد: التاريخ والمزامنة واللغة" : "More: date, sync and language";
  return (
    <span ref={rootRef} className="nv-hdr-narrow nv-hdr-more">
      <button
        type="button"
        className="nv-hdr-seg nv-hdr-icon"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={name}
        title={name}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal aria-hidden style={{ width: 16, height: 16 }} strokeWidth={1.75} />
      </button>
      {open ? (
        <div className="nv-hdr-pop" role="group" aria-label={name}>
          <div className="nv-hdr-pop-row">
            <span className="nv-hdr-fact-label">{ar ? "اليوم" : "Today"}</span>
            <HeaderDateTime lang={lang} />
          </div>
          <div className="nv-hdr-pop-row">
            <span className="nv-hdr-fact-label">{ar ? "المزامنة" : "Sync"}</span>
            <SyncStatusIndicator isSyncing={isSyncing} />
          </div>
          {langButton ? (
            <div className="nv-hdr-pop-row">
              <span className="nv-hdr-fact-label">{ar ? "اللغة" : "Language"}</span>
              {langButton}
            </div>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}

/**
 * Shared app frame for every /app page: role, breadcrumb, clock, sync,
 * then scope or the employee station, on both rails.
 */
export default function AppTopBar({
  pageTitle,
  isSyncing,
  onSearch: _onSearch,
  hideLang = false,
  sectionPages = [],
  activeNavItem,
  pathname = "",
  notifOpen,
  onToggleNotif,
  onCloseNotif,
  notifItems,
  onOpenNotif,
  onDismissNotif,
  onMarkAllNotifs,
  violationCount = 0,
}) {
  const { t, lang, setLang } = useI18n();
  const railSide = useRailSide();
  const ar = lang !== "en";
  const employee = railSide === "employee";
  const home = ar ? "الرئيسية" : "Home";
  const facePages = (employee
    ? sectionPages.filter((page) => page.appId !== "escalation" && !String(page.to || "").startsWith("/app/escalation"))
    : suiteSectionPagesForSide(sectionPages, railSide)
  ).map((page) => faceSectionTarget(page, employee ? "employee" : railSide));
  const { search } = useLocation();
  const { data: authData, currentUser: authUser } = useAuth() || {};
  // الحضور والدوام: one strip per lane — personal pages for الموظف, team pages for الإدارة.
  const duty = isDutyPath(pathname);
  const dutyBadge = duty ? (sectionPages.find((page) => String(page.to || "").split("?")[0] === "/app/attendance")?.badge ?? null) : null;
  const dutyPages = duty
    ? dutySectionPages({ side: employee ? "employee" : railSide === "manage" ? "manage" : "employee", ar, canPolicy: canCreateTasks(authUser, authData), badge: employee ? null : dutyBadge })
      // Only surfaces this person may open (same allow-list as the suite strip).
      .filter((page) => {
        const base = page.to.split("?")[0];
        return base === "/app/attendance" || sectionPages.some((item) => String(item.to || "").split("?")[0] === base);
      })
    : [];
  const dutyLeaf = duty ? dutyCrumb(dutyPages, pathname, search) : null;
  // The smart search reads both lanes' pages this person may open (the other lane only if he manages).
  const dutyAllowed = (page) => {
    const base = page.to.split("?")[0];
    return base === "/app/attendance" || sectionPages.some((item) => String(item.to || "").split("?")[0] === base);
  };
  const canManageDuty = duty && canCreateTasks(authUser, authData);
  const searchPages = duty
    ? dutySearchPages(
      dutySectionPages({ side: "employee", ar }).filter(dutyAllowed),
      canManageDuty ? dutySectionPages({ side: "manage", ar, canPolicy: canManageDuty }).filter(dutyAllowed) : [],
    )
    : [];
  const crumbTitle = duty ? (ar ? "الحضور والدوام" : "Time & attendance") : pageTitle;

  const title = dutyLeaf ? dutyLeaf.label : crumbTitle;
  const trail = dutyLeaf ? [crumbTitle, dutyLeaf.label] : [crumbTitle];
  const laneName = employee ? (ar ? "الموظف" : "Employee") : (ar ? "الإدارة" : "Manage");
  const langButton = hideLang ? null : (
    <button
      type="button"
      className="nv-hdr-seg nv-hdr-icon nv-hdr-lang nv-frame-iconbtn"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      aria-label={t("language")}
      title={t("language")}
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );

  return (
    <div className="nv-frame" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
      <header className="nv-app-topbar" data-topbar="1" data-lane={employee ? "employee" : "manage"}>
        <div className="nv-topbar-tier nv-hdr-main">
          <div className="nv-hdr-id">
            <span className="md:hidden nv-hdr-back">
              <BackButton />
            </span>
            <span className="nv-hdr-lane" data-lane={employee ? "employee" : "manage"} title={employee ? (ar ? "مساحة الموظف" : "Employee space") : (ar ? "مساحة الإدارة" : "Management space")}>
              {laneName}
            </span>
            <div className="nv-hdr-titles">
              <div className="nv-hdr-title">{title}</div>
              <nav aria-label={ar ? "مسار الصفحة" : "Breadcrumb"} className="nv-hdr-crumb">
                <Link to="/app">{home}</Link>
                {trail.map((part, index) => (
                  <React.Fragment key={`${part}-${index}`}>
                    <span aria-hidden className="nv-hdr-crumb-sep">›</span>
                    <span aria-current={index === trail.length - 1 ? "page" : undefined}>{part}</span>
                  </React.Fragment>
                ))}
              </nav>
            </div>
          </div>

          <div className="nv-hdr-tools-wrap">
          <div className="nv-hdr-tools" role="group" aria-label={ar ? "أدوات الشريط" : "Header tools"}>
            <HeaderDateTime lang={lang} className="nv-hdr-wide" />
            <SyncStatusIndicator isSyncing={isSyncing} className="nv-hdr-wide" />
            <NotificationBell
              notifOpen={notifOpen}
              onToggleNotif={onToggleNotif}
              onCloseNotif={onCloseNotif}
              notifItems={notifItems}
              onOpenNotif={onOpenNotif}
              onDismissNotif={onDismissNotif}
              onMarkAllNotifs={onMarkAllNotifs}
            />
            <ThemeToggle />
            {langButton ? <span className="nv-hdr-wide nv-hdr-contents">{langButton}</span> : null}
            <HeaderOverflow ar={ar} lang={lang} isSyncing={isSyncing} langButton={langButton} />
          </div>
          </div>
        </div>

        <div className="nv-topbar-scope nv-hdr-ctx">
          <ScopeBar violationCount={violationCount} />
        </div>
      </header>

      {duty ? (
        <div className="nv-duty-strip" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
        {dutyPages.length > 1 ? (
        <nav
          aria-label={ar ? "صفحات الحضور والدوام" : "Time and attendance pages"}
          className="no-scrollbar nv-section-pages"
          data-duty-lane={employee ? "employee" : "manage"}
          style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", background: "transparent", padding: 0, flex: "1 1 auto", minWidth: 0 }}
        >
          {dutyPages.map((page) => {
            const active = page.match(pathname, search);
            const Icon = page.icon;
            return (
              <Link
                key={page.key}
                to={page.to}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  height: 32,
                  padding: "0 13px",
                  borderRadius: 6,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? BTN_INK : MUTED,
                  flexShrink: 0,
                  background: active ? BTN_FILL : "var(--nv-card)",
                  border: active ? "1px solid transparent" : "1px solid var(--nv-line, #E4E9E6)",
                }}
              >
                <Icon style={{ width: 14, height: 14, color: "inherit" }} strokeWidth={active ? 2 : 1.7} />
                <span>{page.label}</span>
                {page.badge ? (
                  <span
                    dir="ltr"
                    style={{
                      minWidth: 16,
                      height: 16,
                      padding: "0 4px",
                      borderRadius: 10,
                      background: active ? "rgba(255,255,255,.22)" : BTN_FILL,
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {page.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        ) : <span style={{ flex: "1 1 auto" }} />}
        <DutySmartSearch ar={ar} side={employee ? "employee" : railSide === "manage" ? "manage" : "employee"} pages={searchPages} />
        </div>
      ) : !duty && facePages.length > 1 ? (
        <nav
          aria-label={ar ? "صفحات القسم" : "Section pages"}
          className="no-scrollbar nv-section-pages"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflowX: "auto",
            background: "transparent",
            padding: 0,
          }}
        >
          {facePages.map((page) => {
            const hit = matchSuiteNavItem({ ...page, to: String(page.to || "").split("?")[0] }, pathname);
            const active = hit === "exact" || (hit === "prefix" && page === activeNavItem);
            return (
              <NavLink
                key={page.to}
                to={page.to}
                end={page.end}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  height: 32,
                  padding: "0 13px",
                  borderRadius: 6,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? BTN_INK : MUTED,
                  flexShrink: 0,
                  background: active ? BTN_FILL : "transparent",
                  border: active ? "none" : "1px solid var(--nv-line, #E4E9E6)",
                }}
              >
                <page.icon style={{ width: 14, height: 14, color: "inherit" }} strokeWidth={active ? 2 : 1.7} />
                <span>{page.label}</span>
                {page.badge != null ? (
                  <span
                    dir="ltr"
                    style={{
                      minWidth: 16,
                      height: 16,
                      padding: "0 4px",
                      borderRadius: 10,
                      background: page.appId === "complaints" ? "var(--nv-warn-fill)" : BTN_FILL,
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {page.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
