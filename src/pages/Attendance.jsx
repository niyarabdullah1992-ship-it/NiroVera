import React, { useState, useEffect, lazy, Suspense } from "react";
import { checkWorkPostingGate } from "@/lib/laborHoursPolicy.js";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { base44 } from "@/api/base44Client";
import { canCreateTasks, isCompanyOwner, hasHRPermission } from "@/lib/permissions";
import { managedDutyEmployees } from "@/lib/dutyScope";
import { Loader2 } from "lucide-react";
import MyPunchPage from "@/components/attendance/MyPunchPage";
import AttendanceSectionFrame from "@/components/attendance/AttendanceSectionFrame";
import { listLocalTodayAttendance } from "@/lib/localAttendanceFallback";
import { pendingPunchQueueCount } from "@/lib/suiteBadges";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import { queryClientInstance } from "@/lib/query-client";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { ACCENT } from "@/lib/platformStyles";
import SectionShell from "@/components/shared/SectionShell";
import DutyLaneBar, { dutyLaneFromSearch, writeDutyLane } from "@/components/shared/DutyLaneBar";
import { pageKicker } from "@/lib/moduleMeta";
import { hydrateEmployeesLeave } from "@/lib/leaveDerivations";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { migratePreviewRotaClock, migratePreviewWeekRota, migratePreviewOwnerMorningRota, migratePreviewCompanyHeadWorkplace, seedPreviewOwnerNightStreak, seedPreviewProofCycle } from "@/lib/previewMigrations";
import { openDueAnnualLeaveNotices, openDueNightRotateCycles, updateCompany } from "@/lib/store";
import { useRailSide } from "@/lib/railSide";
import { calendarOverlayEmployees } from "@/lib/shiftWeek";
import { DutyHowTo } from "@/components/schedules/ManageDutySide";
import { fileDutyHref } from "@/components/schedules/dutyLinks";

const ShiftsPlatformBoard = lazy(() => import("@/components/schedules/ShiftsPlatformBoard"));
const AttendancePolicyPage = lazy(() => import("@/components/attendance/AttendancePolicyPage"));
const AttendanceMonthCalendar = lazy(() => import("@/components/attendance/AttendanceMonthCalendar"));
const AttendanceDailyDashboard = lazy(() => import("@/components/attendance/AttendanceDailyDashboard"));
const AttendanceMinistryPanel = lazy(() => import("@/components/attendance/AttendanceMinistryPanel"));
function TabLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
      <Loader2 style={{ width: 20, height: 20, color: ACCENT, animation: "spin 1s linear infinite" }} />
    </div>
  );
}

function tabFromRoute(pathname, searchTab) {
  if (pathname.endsWith("/shifts") || searchTab === "schedule") return "schedule";
  if (pathname.endsWith("/calendar") || searchTab === "calendar") return "calendar";
  if (searchTab) return searchTab;
  return null;
}

export default function Attendance() {
  const { t, lang } = useI18n();
  const { data, currentUser, company, refresh } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const railSide = useRailSide();
  const routeTab = tabFromRoute(location.pathname, searchParams.get("tab"));
  const [tab, setTab] = useState(routeTab);
  const [queueCount, setQueueCount] = useState(0);
  const [dashboardCount, setDashboardCount] = useState(null);
  const onDashboardCount = React.useCallback((n) => { setDashboardCount(n); setQueueCount(n); }, []);

  useEffect(() => {
    setTab(routeTab);
  }, [routeTab]);

  const isManager = data && currentUser && canCreateTasks(currentUser);
  const canManageLeave = data && currentUser && (isManager || hasHRPermission(currentUser, data, "manage_leave"));
  const defaultStationId = data?.stations?.[0]?.id || null;
  const headerScope = useStationScope();
  const roster = data?.employees || [];
  const stationList = data?.stations || [];
  const employeesBase = data && currentUser ? managedDutyEmployees(currentUser, data) : [];
  const employees = (employeesBase || []).filter((employee) =>
    matchesStationScope(employee.stationId || defaultStationId, headerScope, stationList),
  );

  const syncRoster = () => {
    if (!isManager || !company || employees.length === 0) return Promise.resolve();
    const director = roster.find((e) => e.role === "director")?.id || null;
    const managerFor = (e) => {
      const station = stationList.find((s) => s.id === (e.stationId || defaultStationId));
      return station?.managerId || director;
    };
    return base44.functions.invoke("supabaseAttendance", {
      action: "syncRoster",
      companyId: company.id,
      employees: employees.map((e) => ({ id: e.id, name: e.name, stationId: e.stationId || defaultStationId, managerId: managerFor(e) })),
    }).catch(() => {});
  };

  useEffect(() => {
    syncRoster();
  }, [isManager, company?.id, employees.length]);

  useEffect(() => {
    if (!isManager) return;
    // The queue's own reading (lib/attendanceQueue) — the dashboard reports the same count once it loads
    // its merged rows; until then this local reading stands, never a second rule.
    if (dashboardCount != null) return;
    setQueueCount(pendingPunchQueueCount(employees, listLocalTodayAttendance(company?.id, data), data));
  }, [isManager, company?.id, employees, data, dashboardCount]);

  useEffect(() => {
    if (!company?.id || !isLocalPreviewActive()) return;
    const hasSeed = (data?.workProofs || []).some((item) => String(item.id || "").startsWith("wp_preview_"));
    const hasVisitor = (data?.visitorProofs || []).some((item) => String(item.id || "").startsWith("vp_preview_"));
    if (hasSeed && hasVisitor) return;
    updateCompany(company.id, (draft) => {
      migratePreviewRotaClock(draft);
      migratePreviewWeekRota(draft);
      migratePreviewCompanyHeadWorkplace(draft);
      migratePreviewOwnerMorningRota(draft);
      seedPreviewOwnerNightStreak(draft);
      seedPreviewProofCycle(draft);
    });
    refresh?.();
  }, [company?.id, data?.workProofs, data?.visitorProofs]);

  useEffect(() => {
    if (!company?.id) return;
    const night = openDueNightRotateCycles(company.id);
    const leave = openDueAnnualLeaveNotices(company.id);
    if (night.opened?.length || night.notified || leave.opened?.length) refresh?.();
  }, [company?.id]);

  // Pull-to-refresh: full state reload — roster sync, tanstack-query caches,
  // and the AuthContext offline/online store sync.
  const handleRefresh = async () => {
    await Promise.allSettled([syncRoster(), queryClientInstance.invalidateQueries()]);
    refresh();
  };

  if (!data || !currentUser) return null;

  // الموظف: «سجلي» (and كشفي / تقويمي before it) folded into التقويم التشغيلي. The old addresses land there.
  if (location.pathname === "/app/attendance" && searchParams.get("tab") === "calendar") {
    return <Navigate to={searchParams.get("lane") === "manage" ? "/app/calendar?lane=manage" : "/app/calendar"} replace />;
  }
  if (location.pathname === "/app/attendance" && ["record", "mine", "report"].includes(searchParams.get("tab") || "")) {
    if (searchParams.get("lane") === "manage") return <Navigate to="/app/attendance?lane=manage" replace />;
    // «مسيرتي» lives on the person's own file duty tab; a day or the month opens the calendar.
    if (searchParams.get("focus") === "career") return <Navigate to={fileDutyHref(currentUser.id, { focus: "career" })} replace />;
    const day = searchParams.get("day");
    return <Navigate to={day ? `/app/calendar?day=${encodeURIComponent(day)}` : "/app/calendar"} replace />;
  }
  if (location.pathname === "/app/attendance" && (searchParams.get("tab") === "settings" || searchParams.get("tab") === "map")) {
    return <Navigate to="/app/attendance?tab=policy" replace />;
  }
  if (location.pathname === "/app/attendance" && searchParams.get("tab") === "analytics") {
    return <Navigate to="/app/attendance" replace />;
  }
  if (location.pathname.endsWith("/leave") || searchParams.get("tab") === "leaves") {
    return <Navigate to="/app/requests/leave" replace />;
  }

  const focusShifts = location.pathname.endsWith("/shifts");
  // التقويم التشغيلي — the employee lane reads the work branch; the management lane follows «نطاقك».
  const focusCalendar = location.pathname.endsWith("/calendar");
  const ar = lang === "ar";
  const canManageDuty = !!(isManager || canManageLeave);
  const canManageHere = focusShifts ? canManageDuty : !!isManager;
  const lane = dutyLaneFromSearch(searchParams, focusCalendar ? canManageDuty : canManageHere, railSide);
  const defaultHubTab = "punch";
  const mineTabs = [
    { key: "punch", label: ar ? "بصمتي" : "My punch" },
  ];
  const manageTabs = isManager
    ? [
        { key: "team", label: ar ? "حضور الفريق" : "Team attendance", count: queueCount },
        { key: "policy", label: ar ? "السياسة والمواقع" : "Policy and sites" },
      ]
    : [];
  const hubTabs = lane === "manage" && isManager ? manageTabs : mineTabs;
  const allowedTabs = new Set([...mineTabs.map((item) => item.key), ...manageTabs.map((item) => item.key), "roster", "map", "settings", "policy"]);
  const requested = routeTab || tab;
  let activeTab = lane === "manage" && isManager ? "team" : defaultHubTab;
  if (focusShifts && lane === "manage" && isManager) activeTab = "schedule";
  else if (requested && allowedTabs.has(requested)) {
    if (requested === "roster") activeTab = "punch";
    else if (lane === "mine" && ["team", "map", "analytics", "settings", "policy"].includes(requested)) activeTab = "punch";
    else if (lane === "manage" && ["punch", "roster"].includes(requested)) activeTab = "team";
    else if (requested === "map" || requested === "settings") activeTab = lane === "manage" && isManager ? "policy" : "punch";
    else activeTab = requested;
  }

  const setLane = (nextLane) => {
    const next = writeDutyLane(searchParams, nextLane);
    if (location.pathname === "/app/attendance") {
      if (nextLane === "manage") next.set("tab", "team");
      else next.delete("tab");
    }
    setSearchParams(next, { replace: true });
    setTab(nextLane === "manage" ? "team" : defaultHubTab);
  };

  const self = hydrateEmployeesLeave([roster.find((row) => row.id === currentUser.id) || currentUser], data)[0] || currentUser;
  const teamEmployees = employees.filter((row) => row.id !== currentUser.id);
  const rotaStationId = headerScope && headerScope !== "all" ? headerScope : defaultStationId;
  const shiftManageCount = rotaStationId
    ? employees.filter((row) => (row.stationId || defaultStationId) === rotaStationId && row.id !== currentUser.id).length
    : teamEmployees.length;
  if (focusShifts) {
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        <SectionShell bare ar={ar} maxWidth={1320}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DutyLaneBar ar={ar} canManage={canManageDuty} lane={lane} onLane={setLane} manageCount={shiftManageCount} />
            <Suspense fallback={<TabLoader />}>
              <ShiftsPlatformBoard lang={lang} kicker={pageKicker("/app/shifts", lang)} lane={lane} employees={employees} canManage={canManageDuty} />
            </Suspense>
          </div>
        </SectionShell>
      </PullToRefresh>
    );
  }

  if (focusCalendar) {
    const calLane = lane === "manage" ? "manage" : "mine";
    const calendarEmployees = hydrateEmployeesLeave(
      calendarOverlayEmployees({
        lane: calLane,
        employee: self,
        employees: data?.employees || [],
        managed: employees.length ? employees : [],
        headerPeople: [],
      }),
      data,
    );
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        <AttendanceSectionFrame
          ar={ar}
          lane={calLane}
          title={calLane === "manage"
            ? (ar ? "التقويم التشغيلي — الإدارة" : "Operations calendar — management")
            : (ar ? "التقويم التشغيلي — الشهر" : "Operations calendar — the month")}
          hint={calLane === "manage"
            ? (ar
              ? "نطاقك يوماً بيوم: من حضر ومن تأخّر ومن غاب، ومخالفات الدوام، والبصمات التي تنتظر قرارك، والطلبات المعلّقة — بدّل الفرع من «نطاقك» أعلى الصفحة."
              : "Your scope day by day: attendance, duty breaches, punches awaiting you and pending requests — switch the branch from «Your scope» at the top.")
            : (ar
              ? "جدول فرعك كاملاً يوماً بيوم: من حضر ومن تأخّر ومن غاب — وسطر «شهري» يعدّ غيابك وتأخيرك بالأرقام التي يقرؤها المسير."
              : "Your whole branch day by day: on time, late, absent — and the My month line counts your absence and lateness with the figures payroll reads.")}
          laneBar={<DutyLaneBar ar={ar} canManage={canManageDuty} lane={calLane} onLane={setLane} manageCount={teamEmployees.length} />}
        >
          <Suspense fallback={<TabLoader />}>
            <AttendanceMonthCalendar
              employees={calendarEmployees}
              currentUser={currentUser}
              me={self}
              company={company}
              data={data}
              lane={calLane}
              canManage={canManageDuty}
              framed
            />
          </Suspense>
        </AttendanceSectionFrame>
      </PullToRefresh>
    );
  }

  const hubTool = hubTabs.some((item) => item.key === activeTab) ? activeTab : defaultHubTab;

  const manageLane = lane === "manage" && isManager;
  const heroCopy = manageLane
    ? (hubTool === "policy"
      ? {
          title: ar ? "السياسة والمواقع" : "Policy and sites",
          hint: ar ? "متى تُقبل البصمة وأين — مصدر الوقت هو جدول الدوام المنشور." : "When and where a punch is accepted — the published roster is the clock.",
        }
      : {
          title: ar ? "حضور الفريق — اليوم" : "Team attendance — today",
          hint: ar ? "مَن حضر ومَن تأخّر، وما ينتظر قرارك اليوم. الجدول يخطّط والحضور يلتقط." : "Who is in, who is late, and what waits for your decision today. The roster plans; attendance captures.",
        })
    : {
        title: ar ? "بصمتي — اليوم" : "My punch — today",
        hint: ar ? "ماذا أفعل الآن؟ سجّل حضورك وانصرافك على ورديتك المنشورة." : "What do I do now? Punch in and out on your published shift.",
      };
  // «كيف أستخدم هذا القسم؟» — only on each lane's first page, four lines at most.
  const howTo = manageLane
    ? (hubTool === "team"
      ? (ar
        ? [
          "ابدأ من «يحتاج قرارك»: كل صف حلقة انكسرت اليوم — اعتمد حضوراً أو ثبّت الانصراف بسبب مكتوب.",
          "«افتح ›» على أي اسم يفتح ملف دوامه، و«في جدول الدوام ›» يفتح صفّه في الأسبوع.",
          "«جدول الدوام» يخطّط الأسبوع وينشره، والبصمة لا تُفتح لأحد قبل النشر.",
          "«أنظمة الوزارة — ملخّص» في الجانب: كل رقم يفتح فحصه المصفّى في جدول الدوام.",
        ]
        : [
          "Start at “Needs your decision”: each row is a link that broke today — approve present or set the checkout with a written reason.",
          "“Open ›” on a name opens their duty file; “On the roster ›” opens their row on the week.",
          "The duty roster plans and publishes the week; nobody can punch before it is published.",
          "The ministry summary on the side: each number opens its filtered check on the roster.",
        ])
      : null)
    : (hubTool === "punch"
      ? (ar
        ? [
          "«بصمتي»: سجّل حضورك وانصرافك من الزر عند بدء ورديتك المنشورة.",
          "«التقويم التشغيلي»: أيام الشهر بحالتها، وسطر «شهري» يعدّ غيابك وتأخيرك — الأرقام نفسها التي يقرؤها المسير.",
          "«جدولي»: ورديات الأسبوع، ومنه تطلب تغيير وردية. الإجازة من «طلباتي».",
          "«تنبيهاتي» في الجانب: كل تنبيه يفتح اليوم أو الطلب الذي يخصّه.",
        ]
        : [
          "My punch: check in and out with the button when your published shift starts.",
          "Operations calendar: each day of the month, and the My month line counts your absence and lateness — the figures payroll reads.",
          "My roster: the week's shifts; ask for a shift change there. Leave is in My Requests.",
          "My alerts on the side: each alert opens the day or request it is about.",
        ])
      : null);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <AttendanceSectionFrame
      ar={ar}
      lane={manageLane ? "manage" : "mine"}
      title={heroCopy.title}
      hint={heroCopy.hint}
      laneBar={<DutyLaneBar ar={ar} canManage={!!isManager} lane={lane} onLane={setLane} manageCount={queueCount} />}
    >
      <Suspense fallback={<TabLoader />}>
          {(activeTab === "roster" || activeTab === "punch") && (
            <MyPunchPage me={self} currentUser={currentUser} company={company} data={data} t={t} lang={lang} />
          )}
          {activeTab === "team" && isManager && !checkWorkPostingGate({ company: data }).ok ? (
            <div data-work-posting-missing="1" role="note" style={{ margin: "0 0 12px", padding: "10px 14px", border: "1px solid var(--nv-warn-line, #E3C27A)", background: "var(--nv-warn-soft, #FBF3E2)", color: "var(--nv-warn-ink, #7A4E0B)", fontSize: 12, lineHeight: 1.75, borderRadius: 10 }}>
              {ar ? checkWorkPostingGate({ company: data }).reason : checkWorkPostingGate({ company: data }).reasonEn}
              {" "}
              <Link to="/app/attendance?lane=manage&tab=policy" style={{ color: "inherit", fontWeight: 600 }}>{ar ? "سجّل الإعلان في «السياسة والمواقع» ›" : "Record it in Policy and sites ›"}</Link>
            </div>
          ) : null}
          {activeTab === "team" && isManager && (
            <AttendanceDailyDashboard employees={employees} currentUser={currentUser} company={company} data={data} t={t} onQueueCount={onDashboardCount} />
          )}
          {/* Art. 107 — overtime decisions moved to إدارة الطلبات (the fixed rule: each item in its own section). */}
          {activeTab === "team" && isManager && (
            <div style={{ marginTop: 14 }}>
              <AttendanceMinistryPanel data={data} people={employees} lane="manage" ar={ar} />
            </div>
          )}
          {activeTab === "policy" && isManager && (
            <AttendancePolicyPage
              company={company}
              currentUser={currentUser}
              t={t}
              lang={lang}
              canEditSettings={isCompanyOwner(currentUser, data) || currentUser.role === "director"}
            />
          )}
          {howTo ? <DutyHowTo ar={ar} lines={howTo} /> : null}
        </Suspense>
    </AttendanceSectionFrame>
    </PullToRefresh>
  );
}
