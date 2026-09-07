import React, { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { updateCompany, getCompanyData, getCompanyToken } from "@/lib/store";
import { base44 } from "@/api/base44Client";
import {
  Search, Bell, LogOut, ChevronDown, Settings2, HelpCircle, MessageSquare,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import Logo from "@/components/Logo";
import NotificationPanel from "@/components/notifications/NotificationPanel";
import SyncStatusIndicator from "@/components/SyncStatusIndicator";
import ThemeToggle from "@/components/ThemeToggle";
import { allowedNavFor } from "@/lib/navVisibility";
import BottomTabBar from "@/components/mobile/BottomTabBar";
import BackButton from "@/components/mobile/BackButton";
import ProductFeedbackPrompt from "@/components/ProductFeedbackPrompt";
import { shouldShowNotification } from "@/lib/notificationFilters";
import { isChatNotification } from "@/lib/notificationKind";
import { getChatUnreadTotal, subscribeChatUnread, getChatSeenMap, threadIsUnread, setChatUnreadTotal } from "@/lib/chatUnreadStore";
import { routeForNotification } from "@/lib/notificationRoute";
import GlobalSearch from "@/components/navigation/GlobalSearch";
import {
  buildSuiteNavItems,
  buildSuiteRailGroups,
  matchSuiteNavItem,
  SUITE_GROUP_ORDER,
} from "@/lib/suiteNav";
import StationScopeControl from "@/components/navigation/StationScopeControl";
import SectionReportPicker from "@/components/reports/SectionReportPicker";
import StationQuickSwitch from "@/components/navigation/StationQuickSwitch";
import HeaderDateTime from "@/components/navigation/HeaderDateTime";
import { OPEN_STATION_SWITCH_EVENT } from "@/hooks/useStationSwitcher";
import { setStationScope, getStationScope } from "@/lib/stationScopeStore";
import { visibleStations } from "@/lib/permissions";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import { BORDER, CARD, INK, MUTED, NAVY, NAVY_FILL, SURFACE } from "@/lib/platformStyles";
import { canSeeMinistryAlerts, deriveMinistryAlerts } from "@/lib/ministryAlertDerivations";
import { THEME_CHANGE_EVENT, applyPlatformTheme, applyStoredPlatformTheme, persistPlatformTheme } from "@/lib/platformTheme";

export default function Layout({ children }) {
  const { t, lang, setLang, dir } = useI18n();
  const { currentUser, company, data, logout, isSyncing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef(null);
  const userRef = useRef(null);
  const notificationPollInFlightRef = useRef(false);
  const [chatUnread, setChatUnread] = useState(() => getChatUnreadTotal());
  const [scopeSwitchOpen, setScopeSwitchOpen] = useState(false);
  const [ministryDismissTick, setMinistryDismissTick] = useState(0);

  useEffect(() => subscribeChatUnread(setChatUnread), []);

  useEffect(() => {
    applyStoredPlatformTheme(company?.id);
    const onChange = (event) => {
      if (event?.detail) applyPlatformTheme(event.detail);
    };
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    if (!company?.id) {
      return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    }
    let cancelled = false;
    base44.functions.invoke("settings", { action: "getColorTheme", companyId: company.id })
      .then((res) => {
        const remote = res?.data?.colorTheme ?? res?.colorTheme;
        if (cancelled || !remote) return;
        applyPlatformTheme(persistPlatformTheme(remote, company.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    };
  }, [company?.id]);

  useEffect(() => {
    const onClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Ctrl/Cmd+K searches; the same chord with Shift switches station in place.
  useEffect(() => {
    // Step only through stations this user may see — the same list the palette shows.
    const stepStation = (delta) => {
      const allowed = data && currentUser ? visibleStations(currentUser, data) : [];
      const ring = ["all", ...allowed.map((s) => String(s.id))];
      if (ring.length < 2) return;
      const at = ring.indexOf(getStationScope());
      setStationScope(ring[((at < 0 ? 0 : at) + delta + ring.length) % ring.length]);
    };
    const onKey = (event) => {
      const chord = event.metaKey || event.ctrlKey;
      if (chord && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(false);
        setScopeSwitchOpen(true);
        return;
      }
      if (chord && event.shiftKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        stepStation(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (chord && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };
    const openSwitch = () => setScopeSwitchOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_STATION_SWITCH_EVENT, openSwitch);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_STATION_SWITCH_EVENT, openSwitch);
    };
  }, [data, currentUser]);

  // Real-time notification polling (Supabase → local bell)
  useEffect(() => {
    if (!currentUser || !company) return;
    const poll = async () => {
      if (notificationPollInFlightRef.current || document.visibilityState !== "visible" || navigator.onLine === false) return;
      notificationPollInFlightRef.current = true;
      try {
        const dismissedKey = `powercare_notification_dismissed_${company.id}_${currentUser.id}`;
        const dismissedIds = new Set(JSON.parse(localStorage.getItem(dismissedKey) || "[]"));
        const res = await base44.functions.invoke("supabaseTargets", {
          action: "listNotifications",
          userId: currentUser.id,
          companyId: company.id,
          sessionToken: getCompanyToken(company.id),
        });
        const remote = (res.data?.notifications || []).filter((notification) =>
          !dismissedIds.has(String(notification.id))
          && shouldShowNotification(notification.message, data)
          && !isChatNotification(notification.message)
        );
        const current = getCompanyData(company.id);
        if (!current) return;
        const existing = new Set(
          (current.notifications || []).filter((n) => n.userId === currentUser.id).map((n) => n.text)
        );
        const fresh = remote.filter((rn) => !existing.has(rn.message));
        if (fresh.length === 0) return;
        updateCompany(company.id, (d) => {
          for (const rn of fresh) {
            d.notifications.unshift({
              id: "snf_" + (rn.id || Math.random().toString(36).slice(2)),
              userId: currentUser.id,
              text: rn.message,
              read: false,
              createdAt: rn.created_at || new Date().toISOString(),
            });
          }
        });
        // Fire instant in-site toast alerts for each new notification
        for (const rn of fresh) {
          toast({
            title: t("notifications"),
            description: rn.message,
          });
        }
      } catch {
        // Supabase not configured or unreachable — silent
      } finally {
        notificationPollInFlightRef.current = false;
      }
    };
    poll();
    const interval = setInterval(poll, 12000);
    return () => clearInterval(interval);
  }, [currentUser?.id, company?.id]);

  useEffect(() => {
    if (!currentUser?.id || !company?.id) return undefined;
    if (location.pathname.startsWith("/app/chat")) return undefined;
    let cancelled = false;
    const load = () => {
      const stationIds = visibleStations(currentUser, data).map((station) => station.id).slice(0, 24);
      base44.functions
        .invoke("supabaseTargets", {
          action: "listUnreadInbox",
          companyId: company.id,
          sessionToken: getCompanyToken(company.id),
          stationIds,
        })
        .then((res) => {
          if (cancelled) return;
          const rows = Array.isArray(res?.data?.threads) ? res.data.threads : [];
          const seen = getChatSeenMap(company.id, currentUser.id);
          const count = rows.filter((thread) => threadIsUnread(thread, seen[thread.key], currentUser.id)).length;
          setChatUnreadTotal(count);
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser?.id, company?.id, data?.stations?.length, location.pathname]);

  if (!currentUser || !data) return children;

  // Outstanding daily reports = stations without an approved filing today (Platform nav badge).
  const dailyReportBadge = (() => {
    const d = new Date();
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const stations = data?.stations || [];
    const filed = (data?.reports || []).filter((r) =>
      r && (r.kind === "daily" || r.type === "daily" || !r.kind)
      && (!r.dateKey || r.dateKey === dayKey),
    );
    const byStation = new Map(filed.map((r) => [String(r.stationId), r]));
    const open = stations.filter((st) => {
      const r = byStation.get(String(st.id));
      return !(r && r.approved);
    }).length;
    return open > 0 ? open : undefined;
  })();

  const pendingLeaveBadge = (data?.employees || []).reduce(
    (n, employee) => n + (employee.leaveRequests || []).filter((request) => request.status === "pending").length,
    0,
  );

  // ERP navigation — group rail + section pages (production shell).
  const navItems = buildSuiteNavItems(lang, {
    badgeFor: (app) => {
      if (app.id === "daily-report") return dailyReportBadge;
      if (app.id === "chat") return chatUnread > 0 ? chatUnread : undefined;
      if (app.id === "leave") return pendingLeaveBadge > 0 ? pendingLeaveBadge : undefined;
      return undefined;
    },
  });

  const allowedNav = allowedNavFor(currentUser, data, company);
  const visibleNavItems = navItems.filter((i) => allowedNav.has(i.to));
  const orderedNavItems = [...visibleNavItems].sort(
    (a, b) => SUITE_GROUP_ORDER.indexOf(a.category) - SUITE_GROUP_ORDER.indexOf(b.category),
  );

  const activeNavItem =
    orderedNavItems.find((item) => matchSuiteNavItem(item, location.pathname) === "exact")
    || orderedNavItems.find((item) => matchSuiteNavItem(item, location.pathname));
  const activeCategory = activeNavItem?.category || "daily";
  const sectionPages = orderedNavItems.filter((item) => item.category === activeCategory);
  const railGroups = buildSuiteRailGroups(orderedNavItems, lang);
  const canOpenSettings = allowedNav.has("/app/settings");

  const myStoredNotifs = (data.notifications || []).filter(
    (notification) =>
      notification.userId === currentUser?.id
      && shouldShowNotification(notification.text, data)
      && !isChatNotification(notification.text)
  );
  let dismissedMinistry = new Set();
  try {
    dismissedMinistry = new Set(JSON.parse(localStorage.getItem(`powercare_ministry_dismissed_${company.id}_${currentUser.id}`) || "[]"));
  } catch {
    dismissedMinistry = new Set();
  }
  const ministryNotifs = canSeeMinistryAlerts(currentUser, data)
    ? deriveMinistryAlerts(data || {}).alerts
      .filter((row) => !dismissedMinistry.has(row.id))
      .map((row) => ({
        id: `ministry_${row.id}`,
        userId: currentUser.id,
        text: lang === "ar" ? row.textAr : row.textEn,
        read: false,
        createdAt: new Date().toISOString(),
        to: row.to,
      }))
    : [];
  void ministryDismissTick;
  const myNotifs = [...ministryNotifs, ...myStoredNotifs];
  const unread = myNotifs.filter((n) => !n.read).length;

  const markAllRead = () => {
    updateCompany(company.id, (d) => {
      d.notifications.forEach((n) => {
        if (n.userId === currentUser.id) n.read = true;
      });
    });
  };

  const dismissNotification = (id) => {
    if (String(id).startsWith("ministry_")) {
      const mid = String(id).slice("ministry_".length);
      const key = `powercare_ministry_dismissed_${company.id}_${currentUser.id}`;
      const dismissedIds = new Set(JSON.parse(localStorage.getItem(key) || "[]"));
      dismissedIds.add(mid);
      localStorage.setItem(key, JSON.stringify([...dismissedIds]));
      setMinistryDismissTick((n) => n + 1);
      return;
    }
    if (String(id).startsWith("snf_")) {
      const remoteId = String(id).slice(4);
      const key = `powercare_notification_dismissed_${company.id}_${currentUser.id}`;
      const dismissedIds = new Set(JSON.parse(localStorage.getItem(key) || "[]"));
      dismissedIds.add(remoteId);
      localStorage.setItem(key, JSON.stringify([...dismissedIds]));
      base44.functions.invoke("supabaseTargets", {
        action: "dismissNotification",
        notificationId: remoteId,
        userId: currentUser.id,
        companyId: company.id,
        sessionToken: getCompanyToken(company.id),
      }).catch(() => {});
    }
    updateCompany(company.id, (d) => {
      d.notifications = d.notifications.filter((n) => n.id !== id);
    });
  };

  // Clicking a notification marks it read and jumps to the page it refers to.
  const openNotification = (n) => {
    updateCompany(company.id, (d) => {
      const target = d.notifications.find((x) => x.id === n.id);
      if (target) target.read = true;
    });
    setNotifOpen(false);
    navigate(n.to || routeForNotification(n.text));
  };

  const sidebarSide = dir === "rtl" ? "right-0" : "left-0";
  const glassBg = "var(--nv-glass-bg, var(--nv-card, #fff))";
  const glassLine = "var(--nv-glass-line, var(--nv-line, #E2E8F0))";
  const btnFill = "var(--nv-btn-fill, #14284B)";
  const btnInk = "var(--nv-btn-ink, #fff)";

  const pageMeta = {
    "/app": {
      title: lang === "ar" ? "مركز القيادة" : "Command Center",
      sub: lang === "ar" ? "نظرة واحدة على جاهزية التشغيل الآن" : "One view of operational readiness right now",
    },
    "/app/hr": {
      title: lang === "ar" ? "الموارد البشرية" : "Human Resources",
      sub: lang === "ar"
        ? `${(data.employees || []).length} موظفًا · ${(data.stations || []).length} فروع`
        : `${(data.employees || []).length} employees · ${(data.stations || []).length} stations`,
    },
    "/app/org": {
      title: lang === "ar" ? "الهيكل التنظيمي" : "Org Structure",
      sub: lang === "ar" ? "منه تُشتق الصلاحيات وسلسلة التصعيد" : "Permissions and the escalation chain derive from it",
    },
    "/app/settings": {
      title: lang === "ar" ? "إعدادات الشركة" : "Company Settings",
      sub: lang === "ar" ? "الحساب والنطاق الجغرافي والصلاحيات" : "Account, geofences and permissions",
    },
    "/app/attendance": {
      title: lang === "ar" ? "الحضور والانصراف" : "Attendance",
      sub: lang === "ar" ? "يضع حضر بنفسه — يغذي المهام والرواتب" : "Marks present in person — feeds tasks and payroll",
    },
    "/app/shifts": {
      title: lang === "ar" ? "الورديات" : "Shifts",
      sub: lang === "ar" ? "جدول شهري لكل فرع · الفحص النظامي قبل النشر" : "A monthly schedule per station · statutory checks before publishing",
    },
    "/app/leave": {
      title: lang === "ar" ? "طلبات الإجازة" : "Leave Requests",
      sub: lang === "ar" ? "الرصيد يُخصم عند الاعتماد فقط" : "Balance is deducted only on approval",
    },
    "/app/payroll": {
      title: lang === "ar" ? "الرواتب" : "Payroll",
      sub: lang === "ar"
        ? "دورة نظامية: تجهيز البنود · المادة 90 و92 و93 و107 · الاعتماد · حماية الأجور خلال 30 يوماً من الاستحقاق"
        : "Statutory cycle: prepare lines · Art. 90, 92, 93 & 107 · approve · wage protection within 30 days of entitlement",
    },
    "/app/performance": {
      title: lang === "ar" ? "الأداء" : "Performance",
      sub: lang === "ar" ? "مبني على بيانات فعلية لا تقييم يدوي" : "From actual data, not manual ratings",
    },
    "/app/tasks": {
      title: lang === "ar" ? "المهام والعمليات" : "Operations",
      sub: lang === "ar" ? "جهد وإثبات · مراجعة بسبب · تصعيد عند احتراق المهلة" : "Effort and proof · review with reason · escalate when the quota burns",
    },
    "/app/escalation": {
      title: lang === "ar" ? "نظام التصعيد" : "Escalation",
      sub: lang === "ar" ? "صندوق المراجعة · سلسلة لكل فرع حتى القمة" : "Review inbox · per-station chain to the top",
    },
    "/app/daily-report": {
      title: lang === "ar" ? "التقرير اليومي" : "Daily Report",
      sub: lang === "ar" ? "تقرير واحد لكل فرع، يُعتمد قبل نهاية الوردية" : "One report per station, approved before the shift ends",
    },
    "/app/inventory": {
      title: lang === "ar" ? "المخزون" : "Inventory",
      sub: lang === "ar" ? "شراء · رصيد الفرع · صرف للعمل" : "Purchase · station balance · issue to work",
    },
    "/app/assets": {
      title: lang === "ar" ? "الأصول / العهد" : "Assets / Custody",
      sub: lang === "ar" ? "سجل أصل · حائز واحد · تسليم بتوقيع الطرفين" : "Asset register · one holder · dual-sign handover",
    },
    "/app/expenses": {
      title: lang === "ar" ? "المصروفات" : "Expenses",
      sub: lang === "ar" ? "مطالبات ومصروفات تشغيلية مقابل ميزانية كل فرع" : "Claims and operating spend against each station's budget",
    },
    "/app/safety": {
      title: lang === "ar" ? "السلامة HSE" : "Safety HSE",
      sub: lang === "ar" ? "المخاطر المفتوحة وسجل الحوادث" : "Open hazards and incident log",
    },
    "/app/files": {
      title: lang === "ar" ? "الملفات" : "Files",
      sub: lang === "ar" ? "مستندات مقيّدة بالصلاحية ومربوطة بالفرع" : "Permission-scoped documents linked to their station",
    },
    "/app/signing": {
      title: lang === "ar" ? "التوقيع الرقمي" : "Digital Signing",
      sub: lang === "ar" ? "فردي · جماعي · الصندوق · تحقق" : "Individual · group · inbox · verify",
    },
    "/app/work-proof": {
      title: lang === "ar" ? "إثبات العمل" : "Work Proof",
      sub: lang === "ar" ? "دليل ميداني + إفصاح العميل ورابط تحقق" : "Field evidence + client disclosure and a verify link",
    },
    "/app/help": {
      title: lang === "ar" ? "دليل الاستخدام" : "User guide",
      sub: lang === "ar" ? "مرجع الأقسام من الدخول حتى الأمن" : "Section reference from sign-in through security",
    },
    "/app/complaints": {
      title: lang === "ar" ? "صوت الموظف" : "Employee Voice",
      sub: lang === "ar" ? "اقتراح · شكوى · بلاغ مجهول" : "Suggestion · complaint · anonymous report",
    },
    "/app/discipline": {
      title: lang === "ar" ? "الجزاءات والتحقيق" : "Sanctions and investigation",
      sub: lang === "ar" ? "مسار المواد 66–73 داخل الالتزام" : "Articles 66–73 path inside compliance",
    },
    "/app/assistant": {
      title: lang === "ar" ? "المساعد الذكي" : "AI Assistant",
      sub: lang === "ar" ? "يقرأ بياناتك ويجيب بالمصدر" : "Reads your data, answers with sources",
    },
    "/app/chat": {
      title: lang === "ar" ? "المحادثات التشغيلية" : "Operations Chat",
      sub: lang === "ar" ? "قنوات لكل فرع · الرسائل جزء من سجل التشغيل" : "A channel per station · messages are part of the operations log",
    },
    "/app/manual": {
      title: lang === "ar" ? "دليل الاستخدام" : "User guide",
      sub: lang === "ar" ? "مرجع التشغيل والصلاحيات" : "Operating reference and permissions",
    },
  };
  const resolvePageMeta = () => {
    const path = location.pathname;
    if (pageMeta[path]) return pageMeta[path];
    // An employee file is about a named person — the header must say whose file
    // is open, not fall back to the product name.
    const employeeMatch = path.match(/^\/app\/employees\/([^/]+)/);
    if (employeeMatch) {
      const person = (data?.employees || []).find((e) => e.id === employeeMatch[1]);
      const station = (data?.stations || []).find((s) => s.id === person?.stationId);
      const roleLabel = person ? (t(person.role) || person.role) : "";
      return {
        title: person?.name || (lang === "ar" ? "ملف موظف" : "Employee file"),
        sub: person
          ? [roleLabel, station?.name].filter(Boolean).join(" · ")
            || (lang === "ar" ? "الملف الوظيفي والإسناد" : "Employment file and assignment")
          : (lang === "ar" ? "لا يوجد موظف بهذا المعرّف في هذه الشركة" : "No employee with this id in this company"),
      };
    }
    const hit = Object.keys(pageMeta).find((key) => key !== "/app" && path.startsWith(key));
    return hit
      ? pageMeta[hit]
      : { title: lang === "ar" ? "نيروفيرا" : "NiroVera", sub: lang === "ar" ? "منظومة الموارد البشرية" : "HR operating system" };
  };
  const { title: pageTitle, sub: pageSubtitle } = resolvePageMeta();
  // period footer removed from design shell — user chip only (L93–99)
  const roleInitials = String(currentUser?.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: SURFACE }}>
        <span style={{ color: MUTED, fontSize: 13 }}>{lang === "ar" ? "جاري تجهيز الحساب…" : "Preparing account…"}</span>
      </div>
    );
  }

  return (
    <div className="powercare-shell flex min-h-screen" dir={dir}>
      {/* Desktop group rail — production nirovera.sa/app */}
      <aside
        data-nv="sidebar"
        className={`corporate-sidebar nv-group-rail hidden md:flex sticky top-0 z-40 h-screen pt-safe ${sidebarSide}`}
        style={{
          width: "94px",
          flexShrink: 0,
          flexDirection: "column",
          alignItems: "center",
          paddingBlock: "18px 14px",
          gap: "12px",
          background: glassBg,
          borderInlineEnd: `1px solid ${glassLine}`,
        }}
      >
        <span
          title="NiroVera"
          style={{
            width: 46,
            height: 46,
            borderRadius: 15,
            overflow: "hidden",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: glassBg,
            border: `1px solid ${glassLine}`,
            boxShadow: "0 6px 16px rgba(20,40,75,.08)",
          }}
        >
          <Logo size={26} wordmark={false} />
        </span>

        <nav
          className="no-select no-scrollbar"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            paddingBlock: "10px",
            paddingInline: "8px",
            overflow: "visible",
            width: "100%",
          }}
        >
          {railGroups.map((group) => {
            const active = group.key === activeCategory;
            return (
              <NavLink
                key={group.key}
                to={group.to}
                aria-label={group.label}
                aria-current={active ? "page" : undefined}
                data-nv="navbtn"
                className="group/nav nv-rail-btn"
                style={{
                  position: "relative",
                  display: "flex",
                  textDecoration: "none",
                  outline: "none",
                }}
              >
                <span
                  className="nv-rail-btn-face"
                  style={{
                    position: "relative",
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "visible",
                    color: active ? btnInk : MUTED,
                    background: active ? btnFill : glassBg,
                    border: active ? "1px solid transparent" : `1px solid ${glassLine}`,
                    boxShadow: active
                      ? "0 10px 24px rgba(20, 40, 75, 0.28)"
                      : "0 6px 16px rgba(20, 40, 75, 0.08)",
                    transition: "color .18s, background .18s, box-shadow .18s",
                  }}
                >
                  <group.icon style={{ width: 20, height: 20, color: "inherit" }} strokeWidth={active ? 2 : 1.75} />
                  {group.badge != null && (
                    <span
                      style={{
                        position: "absolute",
                        top: -5,
                        ...(dir === "rtl" ? { left: -4 } : { right: -4 }),
                        zIndex: 2,
                        minWidth: 18,
                        height: 18,
                        padding: "0 5px",
                        borderRadius: 999,
                        background: "var(--tint-amber-bg, #FFFBEB)",
                        color: "var(--tint-amber-fg, #B45309)",
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid var(--nv-card, #fff)",
                        boxShadow: "0 1px 4px rgba(20,40,75,.16)",
                        pointerEvents: "none",
                        direction: "ltr",
                        unicodeBidi: "isolate",
                      }}
                    >
                      {group.badge > 99 ? "99+" : group.badge}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden
                  className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100"
                  style={{
                    position: "absolute",
                    insetInlineStart: "calc(100% + 14px)",
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 60,
                    background: btnFill,
                    color: btnInk,
                    fontSize: "11.5px",
                    fontWeight: 600,
                    padding: "6px 11px",
                    borderRadius: 10,
                    whiteSpace: "nowrap",
                    boxShadow: "0 10px 24px rgba(11,21,40,.28)",
                  }}
                >
                  {group.label}
                  {group.items.length > 1 ? (
                    <span style={{ marginInlineStart: 6, opacity: 0.75, fontWeight: 500 }}>
                      {lang === "ar" ? `${group.items.length} صفحات` : `${group.items.length} pages`}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
            paddingTop: 6,
          }}
        >
          {[
            ...(canOpenSettings
              ? [{ key: "settings", icon: Settings2, label: lang === "ar" ? "الإعدادات" : "Settings", onClick: () => navigate("/app/settings") }]
              : []),
            { key: "help", icon: HelpCircle, label: lang === "ar" ? "دليل الاستخدام" : "User guide", onClick: () => navigate("/app/manual") },
            { key: "logout", icon: LogOut, label: t("logout"), danger: true, onClick: () => { logout(); navigate("/"); } },
          ].map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              aria-label={action.label}
              className="group/nav"
              style={{
                position: "relative",
                display: "flex",
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                fontFamily: "inherit",
                borderRadius: "50%",
              }}
            >
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: action.danger ? "#DC2626" : MUTED,
                  background: glassBg,
                  border: `1px solid ${glassLine}`,
                  boxShadow: "0 6px 16px rgba(20,40,75,.08)",
                }}
              >
                <action.icon style={{ width: 18, height: 18 }} strokeWidth={1.75} />
              </span>
              <span
                aria-hidden
                className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100"
                style={{
                  position: "absolute",
                  insetInlineStart: "calc(100% + 14px)",
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 60,
                  background: action.danger ? "#DC2626" : btnFill,
                  color: "#fff",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "6px 11px",
                  borderRadius: 10,
                  whiteSpace: "nowrap",
                  boxShadow: "0 10px 24px rgba(11,21,40,.28)",
                }}
              >
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header — title row + section pages strip */}
        <header
          data-nv="pad"
          className="powercare-global-header sticky top-0 z-40 overflow-visible pt-safe"
          style={{
            flexShrink: 0,
            background: CARD,
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            flexDirection: "column",
            gap: sectionPages.length > 1 ? 10 : 0,
            padding: sectionPages.length > 1 ? "10px 22px 12px" : "0 22px",
            minHeight: sectionPages.length > 1 ? undefined : 58,
            justifyContent: "center",
            color: INK,
          }}
        >
          <div className="flex min-w-0 items-center gap-2" style={{ minHeight: sectionPages.length > 1 ? 38 : 58, gap: 16 }}>
          <div className="flex min-w-0 items-center gap-2 md:hidden" style={{ flex: 1, minWidth: 0 }}>
            <BackButton />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pageTitle}</div>
              <div style={{ fontSize: "11px", color: MUTED, marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pageSubtitle}</div>
            </div>
          </div>

          <div className="hidden md:block" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pageTitle}</div>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pageSubtitle}</div>
          </div>

            {/* Scope chrome — Platform.dc.html L108–125 metrics, one station picker */}
            <StationScopeControl />

            <div className="hidden md:flex" style={{ alignItems: "center", minWidth: 0, flexShrink: 1 }}>
              <SectionReportPicker lang={lang} compact />
            </div>

            {/* topmeta — search */}
            <div
              data-nv="topmeta"
              className="hidden md:flex"
              style={{ alignItems: "center", gap: "8px", flexShrink: 0 }}
            >
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  height: "34px",
                  padding: "0 12px",
                  borderRadius: "9px",
                  border: `1px solid ${BORDER}`,
                  background: SURFACE,
                  minWidth: "140px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "start",
                }}
              >
                <span style={{ color: MUTED, fontSize: "12px" }}>⌕</span>
                <span style={{ fontSize: "12px", color: MUTED }}>
                  {lang === "ar" ? "ابحث أو اكتب أمرًا" : "Search or type a command"}
                </span>
              </button>
            </div>

            <HeaderDateTime lang={lang} />

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={lang === "ar" ? "البحث العام" : "Global search"}
              className="flex md:hidden"
              style={{
                alignItems: "center",
                justifyContent: "center",
                height: "34px",
                width: "34px",
                borderRadius: "9px",
                border: `1px solid ${BORDER}`,
                background: CARD,
                color: MUTED,
                cursor: "pointer",
                fontFamily: "inherit",
                padding: 0,
              }}
            >
              <Search style={{ width: 16, height: 16 }} />
            </button>

            <SyncStatusIndicator isSyncing={isSyncing} />
            <ThemeToggle />

            <button
              type="button"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              aria-label={t("language")}
              style={{
                flexShrink: 0,
                height: "34px",
                minWidth: "38px",
                padding: "0 11px",
                borderRadius: "9px",
                border: `1px solid ${BORDER}`,
                background: CARD,
                fontSize: "11px",
                fontWeight: 600,
                color: MUTED,
                cursor: "pointer",
                fontFamily: "'IBM Plex Sans',sans-serif",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--nv-accent)";
                e.currentTarget.style.color = "var(--nv-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = BORDER;
                e.currentTarget.style.color = MUTED;
              }}
            >
              {lang === "ar" ? "EN" : "ع"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginInlineStart: "auto" }}>
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  aria-label={t("notifications")}
                  style={{
                    position: "relative",
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: notifOpen ? `1px solid ${NAVY}` : `1px solid ${BORDER}`,
                    background: notifOpen ? NAVY : CARD,
                    color: notifOpen ? "#fff" : MUTED,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <Bell style={{ width: 16, height: 16 }} strokeWidth={1.75} />
                  {unread > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: -4,
                        insetInlineEnd: -4,
                        minWidth: 16,
                        height: 16,
                        padding: "0 4px",
                        borderRadius: 20,
                        background: "#DC2626",
                        color: "#fff",
                        fontSize: 9,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "'IBM Plex Sans',sans-serif",
                        border: "2px solid #fff",
                      }}
                    >
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div
                    style={{
                      position: "absolute",
                      marginTop: 8,
                      [dir === "rtl" ? "left" : "right"]: 0,
                      zIndex: 50,
                    }}
                  >
                    <NotificationPanel
                      items={myNotifs}
                      unread={unread}
                      lang={lang}
                      t={t}
                      onOpen={openNotification}
                      onDismiss={dismissNotification}
                      onMarkAll={markAllRead}
                    />
                  </div>
                )}
              </div>

              <div className="relative" ref={userRef}>
                <button
                  type="button"
                  onClick={() => setUserOpen((o) => !o)}
                  aria-expanded={userOpen}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 36,
                    padding: "0 6px 0 4px",
                    borderRadius: 10,
                    border: userOpen ? "1px solid var(--nv-accent-border)" : `1px solid ${BORDER}`,
                    background: userOpen ? "var(--nv-accent-soft)" : CARD,
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: NAVY_FILL,
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {currentUser.profile?.avatarUrl ? (
                      <img src={currentUser.profile.avatarUrl} alt={currentUser.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      roleInitials
                    )}
                  </span>
                  <ChevronDown className="hidden h-3.5 w-3.5 sm:block" style={{ color: "#A8B4C8" }} strokeWidth={1.75} />
                </button>
                {userOpen && (
                  <div
                    style={{
                      position: "absolute",
                      marginTop: 8,
                      [dir === "rtl" ? "left" : "right"]: 0,
                      width: 260,
                      background: CARD,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 14,
                      boxShadow: "0 14px 32px rgba(20,40,75,.14)",
                      zIndex: 50,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => { navigate(`/app/employees/${currentUser.id}`); setUserOpen(false); }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px",
                        border: "none",
                        borderBottom: `1px solid ${BORDER}`,
                        background: SURFACE,
                        cursor: "pointer",
                        textAlign: "start",
                        fontFamily: "inherit",
                      }}
                    >
                      <span
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 11,
                          background: NAVY_FILL,
                          color: "#fff",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        {currentUser.profile?.avatarUrl ? (
                          <img src={currentUser.profile.avatarUrl} alt={currentUser.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          roleInitials
                        )}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {currentUser.name}
                        </span>
                        <span style={{ display: "block", marginTop: 2, fontSize: 11, fontWeight: 600, color: "var(--nv-accent)" }}>
                          {t("viewProfile")}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { window.dispatchEvent(new Event("powercare:open-feedback")); setUserOpen(false); }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 14px",
                        border: "none",
                        background: CARD,
                        color: INK,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "start",
                      }}
                    >
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          background: "var(--nv-accent-soft)",
                          color: "var(--nv-accent)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <MessageSquare style={{ width: 14, height: 14 }} strokeWidth={1.75} />
                      </span>
                      {lang === "ar" ? "التقييم والاقتراحات" : "Feedback & suggestions"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { logout(); navigate("/"); }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 14px",
                        border: "none",
                        borderTop: `1px solid ${BORDER}`,
                        background: CARD,
                        color: "#DC2626",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "start",
                      }}
                    >
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          background: "#FEF2F2",
                          color: "#DC2626",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <LogOut style={{ width: 14, height: 14 }} strokeWidth={1.75} />
                      </span>
                      {t("logout")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {sectionPages.length > 1 ? (
            <nav
              aria-label={lang === "ar" ? "صفحات القسم" : "Section pages"}
              className="no-scrollbar flex"
              style={{
                alignItems: "center",
                gap: 5,
                overflowX: "auto",
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 999,
                padding: 5,
                boxShadow: "0 4px 14px rgba(20,40,75,.05)",
              }}
            >
              {sectionPages.map((page) => {
                const hit = matchSuiteNavItem(page, location.pathname);
                const active = hit === "exact" || (hit === "prefix" && page === activeNavItem);
                return (
                  <NavLink
                    key={page.to}
                    to={page.to}
                    end={page.end}
                    className="group/tab"
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      height: 34,
                      padding: "0 14px",
                      borderRadius: 999,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: active ? btnInk : MUTED,
                      transition: "color .2s",
                      flexShrink: 0,
                      background: active ? btnFill : "transparent",
                      boxShadow: active ? "0 6px 16px color-mix(in oklab, #14284B 22%, transparent)" : "none",
                    }}
                  >
                    <page.icon style={{ position: "relative", width: 14, height: 14, color: "inherit" }} strokeWidth={active ? 2 : 1.7} />
                    <span style={{ position: "relative" }}>{page.label}</span>
                    {page.badge != null && (
                      <span
                        dir="ltr"
                        style={{
                          position: "relative",
                          minWidth: 16,
                          height: 16,
                          padding: "0 4px",
                          borderRadius: 8,
                          background: active
                            ? "color-mix(in oklab, #fff 24%, transparent)"
                            : "var(--tint-amber-bg, #FFFBEB)",
                          color: active ? "inherit" : "var(--tint-amber-fg, #B45309)",
                          fontSize: 9,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {page.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          ) : null}
        </header>

        <main className="platform-main-scroll flex-1 overflow-y-auto p-5 pb-28 md:px-[22px] md:pb-10 md:pt-5">
          <div className="powercare-interior-page mx-auto w-full max-w-[1600px]">
            <PageErrorBoundary resetKey={location.pathname}>{children}</PageErrorBoundary>
          </div>
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} items={orderedNavItems} data={data} currentUser={currentUser} lang={lang} />
      <StationQuickSwitch open={scopeSwitchOpen} onClose={() => setScopeSwitchOpen(false)} />
      {/* Native-style bottom tab bar (mobile only) */}
      <BottomTabBar />
      <ProductFeedbackPrompt companyId={company.id} role={currentUser.role} />
    </div>
  );
}