import React from "react";
import { Link, NavLink } from "react-router-dom";
import { Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { faceSectionTarget, useRailSide } from "@/lib/railSide";
import { matchSuiteNavItem } from "@/lib/suiteNav";
import BackButton from "@/components/mobile/BackButton";
import HeaderDateTime from "@/components/navigation/HeaderDateTime";
import ScopeBar from "@/components/navigation/ScopeBar";
import SyncStatusIndicator from "@/components/SyncStatusIndicator";
import ThemeToggle from "@/components/ThemeToggle";
import { BTN_FILL, BTN_INK, MUTED } from "@/lib/platformStyles";

const MONO = "'IBM Plex Mono', monospace";

function frameButton(extra) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    borderRadius: 9,
    border: "1px solid var(--nv-line, #E4E9E6)",
    background: "var(--nv-card)",
    color: "var(--nv-ink, #111418)",
    cursor: "pointer",
    fontFamily: "inherit",
    flexShrink: 0,
    ...extra,
  };
}

/**
 * Shared app frame for every /app page: role, breadcrumb, clock, sync,
 * then scope or the employee station, on both rails.
 */
export default function AppTopBar({
  pageTitle,
  isSyncing,
  onSearch,
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
    : sectionPages
  ).map((page) => faceSectionTarget(page, employee ? "employee" : railSide));

  return (
    <div className="nv-frame" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
      <div className="nv-app-topbar" data-topbar="1">
        <div
          className="nv-topbar-tier"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "10px 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexWrap: "wrap" }}>
            <span className="md:hidden" style={{ display: "inline-flex" }}>
              <BackButton />
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 22,
                padding: "0 9px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                background: employee ? "#FBF3E1" : "var(--nv-mute-soft, #EEF1EF)",
                color: employee ? "#8A5A12" : "var(--nv-ink, #111418)",
                border: employee ? "1px solid #EBD3A2" : "1px solid var(--nv-box, #D5DCD8)",
                whiteSpace: "nowrap",
              }}
            >
              {employee ? (ar ? "مساحة الموظف" : "Employee space") : (ar ? "الإدارة" : "Manage")}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--nv-ink3, #555C66)", whiteSpace: "nowrap", minWidth: 0 }}>
              <Link to="/app" style={{ color: "inherit", fontWeight: 500, textDecoration: "none" }}>{home}</Link>
              <span style={{ color: "#C4CCC7", margin: "0 4px" }}>›</span>
              <strong style={{ color: "var(--nv-ink, #111418)", fontWeight: 700, fontSize: 14 }}>{pageTitle}</strong>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <HeaderDateTime lang={lang} />
            <SyncStatusIndicator isSyncing={isSyncing} />
            <span aria-hidden style={{ width: 1, height: 20, background: "var(--nv-line, #E4E9E6)", margin: "0 2px", flexShrink: 0 }} />
            <ThemeToggle />
            {hideLang ? null : (
              <button
                type="button"
                className="nv-frame-iconbtn"
                onClick={() => setLang(lang === "ar" ? "en" : "ar")}
                aria-label={t("language")}
                style={frameButton({
                  minWidth: 34,
                  padding: "0 8px",
                  fontFamily: MONO,
                  fontWeight: 700,
                  fontSize: 12,
                })}
              >
                {lang === "ar" ? "EN" : "ع"}
              </button>
            )}
            <button
              type="button"
              className="nv-frame-iconbtn"
              onClick={onSearch}
              aria-label={ar ? "البحث العام" : "Global search"}
              title={ar ? "ابحث · Ctrl+K" : "Search · Ctrl+K"}
              style={frameButton({ width: 34, padding: 0, color: "var(--nv-ink3, #555C66)" })}
            >
              <Search style={{ width: 15, height: 15 }} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div
          className="nv-topbar-scope"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            padding: "8px 14px",
            borderTop: "1px solid var(--nv-line3, #EEF1EF)",
            background: "var(--nv-soft, #FAFBFA)",
            borderRadius: "0 0 12px 12px",
          }}
        >
          <ScopeBar
            notifOpen={notifOpen}
            onToggleNotif={onToggleNotif}
            onCloseNotif={onCloseNotif}
            notifItems={notifItems}
            onOpenNotif={onOpenNotif}
            onDismissNotif={onDismissNotif}
            onMarkAllNotifs={onMarkAllNotifs}
            violationCount={violationCount}
          />
        </div>
      </div>

      {facePages.length > 1 ? (
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
