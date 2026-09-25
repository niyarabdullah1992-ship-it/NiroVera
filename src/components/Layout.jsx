import React, { useState, useRef, useEffect, useMemo } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { updateCompany, getCompanyData, getCompanyToken } from "@/lib/store";
import { base44 } from "@/api/base44Client";
import {
  Search, ChevronDown, MessageSquare,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import SyncStatusIndicator from "@/components/SyncStatusIndicator";
import ThemeToggle from "@/components/ThemeToggle";
import { allowedNavFor } from "@/lib/navVisibility";
import { collectSuiteBadges, suiteAppBadge, suiteAppGlow } from "@/lib/suiteBadges";
import { listLocalTodayAttendance } from "@/lib/localAttendanceFallback";
import { hydrateEmployeesLeave } from "@/lib/leaveDerivations";
import BottomTabBar from "@/components/mobile/BottomTabBar";
import BackButton from "@/components/mobile/BackButton";
import ProductFeedbackPrompt from "@/components/ProductFeedbackPrompt";
import { shouldShowNotification } from "@/lib/notificationFilters";
import { isChatNotification } from "@/lib/notificationKind";
import { NOTIFICATION_PREFS_EVENT, notificationKindAllowed } from "@/lib/notificationPrefs";
import { routeForNotification } from "@/lib/notificationRoute";
import GlobalSearch from "@/components/navigation/GlobalSearch";
import {
  buildSuiteNavItems,
  buildSuiteRailGroups,
  buildSuiteRailClusters,
  activeSuiteRailKey,
  matchSuiteNavItem,
  SUITE_GROUP_ORDER,
} from "@/lib/suiteNav";
import { canManagePerformance } from "@/lib/suiteRailFrame";
import SuiteRail from "@/components/navigation/SuiteRail";
import { RailSideProvider, routeRailSide } from "@/lib/railSide";
import ScopeBar from "@/components/navigation/ScopeBar";
import SectionReportPicker from "@/components/reports/SectionReportPicker";
import HeaderDateTime from "@/components/navigation/HeaderDateTime";
import { openStationSwitcher } from "@/hooks/useStationSwitcher";
import { setStationScope, getStationScope } from "@/lib/stationScopeStore";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { visibleStations } from "@/lib/permissions";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import { BORDER, BTN_FILL, BTN_INK, CARD, INK, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";
import { canSeeMinistryAlerts, deriveMinistryAlerts } from "@/lib/ministryAlertDerivations";
import { THEME_CHANGE_EVENT, applyPlatformTheme, applyStoredPlatformTheme, persistPlatformTheme } from "@/lib/platformTheme";
import PlatformBoot from "@/components/shared/PlatformBoot";

export default function Layout({ children }) {
  const { t, lang, setLang, dir } = useI18n();
  const { currentUser, company, data, logout, isSyncing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const userRef = useRef(null);
  const notificationPollInFlightRef = useRef(false);
  const [ministryDismissTick, setMinistryDismissTick] = useState(0);
  const [notifPrefTick, setNotifPrefTick] = useState(0);
  const stationScope = useStationScope();

  useEffect(() => {
    const refresh = () => setNotifPrefTick((n) => n + 1);
    window.addEventListener(NOTIFICATION_PREFS_EVENT, refresh);
    return () => window.removeEventListener(NOTIFICATION_PREFS_EVENT, refresh);
  }, []);

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
        openStationSwitcher();
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
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
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
          && notificationKindAllowed(notification.message, company.id, currentUser.id)
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

  const scopedEmployees = useMemo(
    () => {
      if (!data) return [];
      return hydrateEmployeesLeave(data.employees || [], data).filter((employee) =>
        matchesStationScope(employee.stationId, stationScope, data.stations),
      );
    },
    [data, stationScope],
  );
  const suiteBadges = useMemo(
    () => {
      if (!data || !currentUser) return { byApp: {}, glowByApp: {} };
      return collectSuiteBadges({
        data,
        user: currentUser,
        employees: scopedEmployees,
        attendanceRows: listLocalTodayAttendance(company?.id, data),
        inScope: (stationId) => matchesStationScope(stationId, stationScope, data.stations),
      });
    },
    [data, currentUser, scopedEmployees, company?.id, stationScope],
  );

  if (!currentUser || !data) return children;

  // Suite navigation — group rail + section pages.
  const navItems = buildSuiteNavItems(lang, {
    badgeFor: (app) => suiteAppBadge(app, suiteBadges),
    glowFor: (app) => suiteAppGlow(app, suiteBadges),
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
  const sectionPages = location.pathname.startsWith("/app/settings")
    ? []
    : orderedNavItems.filter((item) => item.category === activeCategory && item.to !== "/app/settings");
  const railGroups = buildSuiteRailGroups(orderedNavItems, lang, currentUser.role);
  const railClusters = buildSuiteRailClusters(railGroups, lang, { user: currentUser, data });
  const activeRailKey = activeSuiteRailKey(railClusters, activeCategory, location.pathname, location.search);
  const canOpenSettings = allowedNav.has("/app/settings");

  const myStoredNotifs = (data.notifications || []).filter(
    (notification) =>
      notification.userId === currentUser?.id
      && shouldShowNotification(notification.text, data)
      && notificationKindAllowed(notification.text, company?.id, currentUser?.id)
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
  void notifPrefTick;
  const myNotifs = [...ministryNotifs, ...myStoredNotifs];

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
    if (n.stationId) setStationScope(n.stationId);
    navigate(n.to || routeForNotification(n.text));
  };

  const sidebarSide = dir === "rtl" ? "right-0" : "left-0";

  const pageMeta = {
    "/app": {
      title: lang === "ar" ? "لوحة القيادة" : "Dashboard",
      sub: lang === "ar" ? "نظرة قرار: حضور يغذّي المسير · مهمة تحتاج إثباتاً" : "A decision glance: attendance feeds payroll · a task needs proof",
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
      title: lang === "ar" ? "الحضور — سؤالان: مَن / أين" : "Attendance — two questions: who / where",
      sub: lang === "ar" ? "يضع حضر بنفسه — يغذي المهام والرواتب · الورديات والتقويم في نفس القسم" : "Marks present in person — feeds tasks and payroll · shifts and calendar live in the same section",
    },
    "/app/calendar": {
      title: lang === "ar" ? "التقويم التشغيلي" : "Operational calendar",
      sub: lang === "ar" ? "كل يوم يحمل توزيعه: حضر، تأخّر، غاب — واليوم الذي انكسرت فيه حلقة يُعلَّم بحدّ ذهبي." : "Each day carries its split: on time, late, absent — a broken ring is marked in gold.",
    },
    "/app/attendance/calendar": {
      title: lang === "ar" ? "التقويم التشغيلي" : "Operational calendar",
      sub: lang === "ar" ? "كل يوم يحمل توزيعه: حضر، تأخّر، غاب — واليوم الذي انكسرت فيه حلقة يُعلَّم بحدّ ذهبي." : "Each day carries its split: on time, late, absent — a broken ring is marked in gold.",
    },
    "/app/shifts": {
      title: lang === "ar" ? "جدول الدوام" : "Duty roster",
      sub: lang === "ar" ? "الوردية المنشورة هي مصدر الوقت: منها يُعرف من يجب أن يحضر، ومتى يُعدّ متأخراً." : "The published shift is the clock: who must attend, and when lateness starts.",
    },
    "/app/attendance/shifts": {
      title: lang === "ar" ? "جدول الدوام" : "Duty roster",
      sub: lang === "ar" ? "الوردية المنشورة هي مصدر الوقت: منها يُعرف من يجب أن يحضر، ومتى يُعدّ متأخراً." : "The published shift is the clock: who must attend, and when lateness starts.",
    },
    "/app/requests": {
      title: lang === "ar" ? "طلباتي" : "My Requests",
      sub: lang === "ar" ? "ترفع طلبك هنا — القرار في إدارة، والأثر في الدوام والتقويم" : "You raise the request here — the decision sits in Manage, and the effect lands on the rota and calendar",
    },
    "/app/requests/leave": {
      title: lang === "ar" ? "طلباتي" : "My Requests",
      sub: lang === "ar" ? "ترفع طلبك هنا — القرار مسمّى والأثر يصل للدوام والتقويم" : "You raise the request here — the decision is named, and the effect reaches the rota and calendar",
    },
    "/app/requests/other": {
      title: lang === "ar" ? "طلباتي" : "My Requests",
      sub: lang === "ar" ? "ترفع طلبك هنا — القرار مسمّى والأثر يصل للدوام والتقويم" : "You raise the request here — the decision is named, and the effect reaches the rota and calendar",
    },
    "/app/requests/manage": {
      title: lang === "ar" ? "إدارة" : "Manage",
      sub: lang === "ar" ? "تستقبل وتقرر — القرار يُسجَّل باسمك" : "You receive and decide — the ruling is recorded in your name",
    },
    "/app/requests/archive": {
      title: lang === "ar" ? "طلباتي" : "My Requests",
      sub: lang === "ar" ? "الأرشيف داخل ملفي بعد يحتاج تعديلاً" : "Archive sits inside My file after Needs a change",
    },
    "/app/leave": {
      title: lang === "ar" ? "طلباتي" : "My Requests",
      sub: lang === "ar" ? "إجازة وطلبات أخرى في صندوق واحد" : "Leave and other requests in one inbox",
    },
    "/app/attendance/leave": {
      title: lang === "ar" ? "طلباتي" : "My Requests",
      sub: lang === "ar" ? "إجازة وطلبات أخرى في صندوق واحد" : "Leave and other requests in one inbox",
    },
    "/app/payroll": {
      title: lang === "ar" ? "الرواتب" : "Payroll",
      sub: lang === "ar"
        ? "دورة نظامية: تجهيز البنود · المادة 90 و92 و93 و107 · الاعتماد · حماية الأجور خلال 30 يوماً من الاستحقاق"
        : "Statutory cycle: prepare lines · Art. 90, 92, 93 & 107 · approve · wage protection within 30 days of entitlement",
    },
    "/app/performance": (() => {
      const requested = new URLSearchParams(location.search).get("view");
      const manage = requested !== "self" && (requested === "manage" || !requested) && canManagePerformance(currentUser, data);
      return manage
        ? {
          title: lang === "ar" ? "الأداء" : "Performance",
          sub: lang === "ar" ? "مقارنة الموظفين والفروع على درجة مشتقّة من الإثبات المعتمد" : "People and branches compared on a score derived from approved proof",
        }
        : {
          title: lang === "ar" ? "أدائي" : "My performance",
          sub: lang === "ar" ? "درجتك من إثباتك المعتمد بين تاريخين" : "Your score from your approved proof between two dates",
        };
    })(),
    "/app/tasks": {
      title: lang === "ar" ? "المهام والعمليات" : "Operations",
      sub: lang === "ar" ? "جهد وإثبات · مراجعة بسبب · تصعيد عند احتراق المهلة" : "Effort and proof · review with reason · escalate when the quota burns",
    },
    "/app/escalation": {
      title: lang === "ar" ? "نظام التصعيد" : "Escalation",
      sub: lang === "ar" ? "صندوق المراجعة · سلسلة لكل فرع حتى القمة" : "Review inbox · per-station chain to the top",
    },
    "/app/inventory": {
      title: lang === "ar" ? "المخزون" : "Inventory",
      sub: lang === "ar" ? "لا مركزي: كل فرع يشتري رصيده · يرى غيره ويطلب · صرف للعمل بمرجع" : "Decentralised: each station buys its stock · sees others and requests · issue to work with a ref",
    },
    "/app/assets": {
      title: lang === "ar" ? "الأصول / العهد" : "Assets / Custody",
      sub: lang === "ar" ? "سجل أصل · حائز واحد · نقل بين الفروع بطلب وموافقة · تسليم بتوقيع الطرفين" : "Asset register · one holder · inter-station transfer by request · dual-sign handover",
    },
    "/app/expenses": {
      title: lang === "ar" ? "المصروفات" : "Expenses",
      sub: lang === "ar" ? "الوعاء التشغيلي وحده — اعتماد متدرّج بالمبلغ · الإيصال بوابة · لا مخزون ولا أصل" : "Operating vessel only — amount-derived approval · receipt gates · not stock, not an asset",
    },
    "/app/safety": {
      title: lang === "ar" ? "السلامة HSE" : "Safety HSE",
      sub: lang === "ar" ? "المخاطر المفتوحة وسجل الحوادث" : "Open hazards and incident log",
    },
    "/app/files": {
      title: lang === "ar" ? "الملفات" : "Files",
      sub: lang === "ar" ? "أرشيف المستندات — قسم مستقل عن التوقيع والحضور" : "Document archive — its own section, apart from signing and attendance",
    },
    "/app/signing": {
      title: lang === "ar" ? "التوقيع الرقمي" : "Digital Signing",
      sub: lang === "ar" ? "توقيع · الحالة · أرشيف وتحقق" : "Sign · status · archive and verify",
    },
    "/app/work-proof": {
      title: lang === "ar" ? "إثبات العمل" : "Work Proof",
      sub: lang === "ar" ? "جهة خارج الشركة · المنشئ · هويات العمال والسيارات" : "Outside company · raiser · worker IDs and vehicles",
    },
    "/app/visitor-proof": {
      title: lang === "ar" ? "إثبات زائر" : "Visitor Proof",
      sub: lang === "ar" ? "هوية الزوّار والسيارات على فرع التنفيذ" : "Visitor identity and vehicles at the executing station",
    },
    "/app/complaints": {
      title: lang === "ar" ? "صوت الموظف" : "Employee Voice",
      sub: lang === "ar" ? "اقتراح · شكوى · بلاغ مجهول" : "Suggestion · complaint · anonymous report",
    },
    "/app/discipline": {
      title: lang === "ar" ? "الجزاءات والتحقيق" : "Sanctions and investigation",
      sub: lang === "ar" ? "مسار المواد 66–73 — واقعة ثم إشعار ومحضر وقرار وتظلم" : "Articles 66–73 — incident, notice, hearing, decision, appeal",
    },
    "/app/assistant": {
      title: lang === "ar" ? "المساعد الذكي" : "AI Assistant",
      sub: lang === "ar" ? "يقرأ بياناتك ويجيب بالمصدر" : "Reads your data, answers with sources",
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
    const hit = Object.keys(pageMeta)
      .filter((key) => key !== "/app" && (path === key || path.startsWith(`${key}/`)))
      .sort((a, b) => b.length - a.length)[0];
    return hit
      ? pageMeta[hit]
      : { title: lang === "ar" ? "نيروفيرا" : "NiroVera", sub: lang === "ar" ? "منظومة الموارد البشرية" : "HR operating system" };
  };
  const { title: pageTitle } = resolvePageMeta();
  // period footer removed from design shell — user chip only (L93–99)
  const roleInitials = String(currentUser?.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

  if (!currentUser) {
    return <PlatformBoot variant="shell" />;
  }

  const routeSide = routeRailSide(railClusters, activeRailKey, location.pathname);

  return (
    <RailSideProvider routeSide={routeSide}>
    <div className="powercare-shell flex h-dvh max-h-dvh min-h-0 overflow-hidden" dir={dir}>
      <SuiteRail
        sides={railClusters}
        activeKey={activeRailKey}
        pathname={location.pathname}
        lang={lang}
        sidebarSide={sidebarSide}
        canOpenSettings={canOpenSettings}
        onSettings={() => navigate("/app/settings")}
        onLogout={() => { logout(); navigate("/"); }}
        user={currentUser}
        data={data}
      />


      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header — title row + section pages strip */}
        <header
          data-nv="pad"
          aria-label={pageTitle}
          className="powercare-global-header z-40 overflow-visible pt-safe"
          style={{
            flexShrink: 0,
            background: CARD,
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            flexDirection: "column",
            gap: 0,
            padding: 0,
            color: INK,
          }}
        >
          <div className="nv-topbar-row flex min-w-0 items-center" style={{ height: 52, padding: "0 16px", gap: 10, boxSizing: "border-box" }}>
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <BackButton />
          </div>
          <div style={{ flex: 1, minWidth: 0 }} />

            <ScopeBar
              notifOpen={notifOpen}
              onToggleNotif={() => setNotifOpen((open) => !open)}
              onCloseNotif={() => setNotifOpen(false)}
              notifItems={myNotifs}
              onOpenNotif={openNotification}
              onDismissNotif={dismissNotification}
              onMarkAllNotifs={markAllRead}
            />

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
                  borderRadius: 10,
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
                borderRadius: 0,
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

            {location.pathname.startsWith("/app/signing") ? null : (
            <button
              type="button"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              aria-label={t("language")}
              style={{
                flexShrink: 0,
                height: 34,
                minHeight: 34,
                minWidth: "38px",
                padding: "0 11px",
                borderRadius: 10,
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
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginInlineStart: "auto" }}>
              <div className="relative" ref={userRef}>
                <button
                  type="button"
                  onClick={() => setUserOpen((o) => !o)}
                  aria-expanded={userOpen}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 34,
                    minHeight: 34,
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
                      borderRadius: 10,
                      background: BTN_FILL,
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
                      borderRadius: 10,
                      boxShadow: "none",
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
                          borderRadius: 10,
                          background: BTN_FILL,
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
                          borderRadius: 10,
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
                gap: 0,
                overflowX: "auto",
                background: CARD,
                borderTop: `1px solid ${BORDER}`,
                padding: "0 8px",
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
                      borderInlineEnd: "2px solid transparent",
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
                          borderRadius: 10,
                          background: page.appId === "complaints" ? "#C9962B" : BTN_FILL,
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
                    )}
                  </NavLink>
                );
              })}
            </nav>
          ) : null}
        </header>

        <main className="nv-bg platform-main-scroll min-h-0 flex-1 overflow-y-auto p-5 pb-28 md:px-[22px] md:pb-10 md:pt-5">
          <div className="powercare-interior-page mx-auto w-full max-w-[1600px]">
            <PageErrorBoundary resetKey={location.pathname}>{children}</PageErrorBoundary>
          </div>
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} items={orderedNavItems} data={data} currentUser={currentUser} lang={lang} />
      {/* Native-style bottom tab bar (mobile only) */}
      <BottomTabBar />
      <ProductFeedbackPrompt companyId={company.id} role={currentUser.role} />
    </div>
    </RailSideProvider>
  );
}