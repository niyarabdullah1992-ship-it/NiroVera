import React, { useState, useEffect, lazy, Suspense } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { base44 } from "@/api/base44Client";
import { canCreateTasks, isCompanyOwner, hasHRPermission } from "@/lib/permissions";
import { managedDutyEmployees } from "@/lib/dutyScope";
import { Loader2 } from "lucide-react";
import MyPunchPage from "@/components/attendance/MyPunchPage";
import AttendanceSectionFrame from "@/components/attendance/AttendanceSectionFrame";
import { listLocalTodayAttendance } from "@/lib/localAttendanceFallback";
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

const ShiftsPlatformBoard = lazy(() => import("@/components/schedules/ShiftsPlatformBoard"));
const AttendancePolicyPage = lazy(() => import("@/components/attendance/AttendancePolicyPage"));
const AttendanceMonthCalendar = lazy(() => import("@/components/attendance/AttendanceMonthCalendar"));
const MyRecordPage = lazy(() => import("@/components/attendance/MyRecordPage"));
const AttendanceDailyDashboard = lazy(() => import("@/components/attendance/AttendanceDailyDashboard"));
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
    const local = listLocalTodayAttendance(company?.id, data);
    const byId = Object.fromEntries(local.map((row) => [String(row.employee_id ?? row.employeeId), row]));
    setQueueCount(employees.filter((employee) => {
      const row = byId[String(employee.id)];
      const asked = (employee.otherRequests || []).some((item) => item.type === "manual_punch" && (item.status || "pending") === "pending");
      return row?.location_status === "outside" || (row?.check_in_at && !row?.check_out_at && row?.status !== "absent") || !!row?.early_checkout || asked;
    }).length);
  }, [isManager, company?.id, employees, data]);

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

  // الموظف: كشفي + تقويمي merged into «سجلي — الشهر» (?tab=record). The old addresses land there.
  if (location.pathname === "/app/attendance" && searchParams.get("tab") === "calendar") {
    return <Navigate to={searchParams.get("lane") === "manage" ? "/app/shifts?lane=manage" : "/app/calendar"} replace />;
  }
  // The management lane has no operational calendar — it plans on جدول الدوام.
  if ((location.pathname.endsWith("/calendar")) && searchParams.get("lane") === "manage") {
    return <Navigate to="/app/shifts?lane=manage" replace />;
  }
  if (location.pathname === "/app/attendance" && ["mine", "report"].includes(searchParams.get("tab") || "")) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "record");
    return <Navigate to={`/app/attendance?${next.toString()}`} replace />;
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
  // التقويم التشغيلي — employee lane only.
  const focusCalendar = location.pathname.endsWith("/calendar");
  const ar = lang === "ar";
  const canManageDuty = !!(isManager || canManageLeave);
  const canManageHere = focusShifts ? canManageDuty : !!isManager;
  const lane = focusCalendar ? "mine" : dutyLaneFromSearch(searchParams, canManageHere, railSide);
  const defaultHubTab = "punch";
  const mineTabs = [
    { key: "punch", label: ar ? "بصمتي" : "My punch" },
    { key: "record", label: ar ? "سجلي" : "My record" },
  ];
  const manageTabs = isManager
    ? [
        { key: "team", label: ar ? "حضور الفريق" : "Team attendance", count: queueCount },
        { key: "policy", label: ar ? "السياسة والمواقع" : "Policy and sites" },
      ]
    : [];
  const hubTabs = lane === "manage" && isManager ? manageTabs : mineTabs;
  const allowedTabs = new Set([...mineTabs.map((item) => item.key), ...manageTabs.map((item) => item.key), "mine", "report", "roster", "map", "settings", "policy"]);
  const requested = routeTab || tab;
  let activeTab = lane === "manage" && isManager ? "team" : defaultHubTab;
  if (focusShifts && lane === "manage" && isManager) activeTab = "schedule";
  else if (requested && allowedTabs.has(requested)) {
    if (requested === "roster") activeTab = "punch";
    else if (lane === "mine" && ["team", "map", "analytics", "settings", "policy"].includes(requested)) activeTab = "punch";
    else if (lane === "manage" && ["punch", "mine", "record", "roster", "report"].includes(requested)) activeTab = "team";
    else if (requested === "map" || requested === "settings") activeTab = lane === "manage" && isManager ? "policy" : "punch";
    else if (requested === "report" || requested === "mine") activeTab = "record";
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
    const calendarEmployees = hydrateEmployeesLeave(
      calendarOverlayEmployees({
        lane: "mine",
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
          lane="mine"
          title={ar ? "التقويم التشغيلي — الشهر" : "Operations calendar — the month"}
          hint={ar
            ? "جدول فرعك كاملاً يوماً بيوم: من حضر ومن تأخّر ومن غاب. سجلّك الشخصي في «سجلي»."
            : "Your whole branch day by day: on time, late, absent. Your own record is in My record."}
          laneBar={<DutyLaneBar ar={ar} canManage={canManageDuty} lane="mine" onLane={setLane} manageCount={teamEmployees.length} />}
        >
          <Suspense fallback={<TabLoader />}>
            <AttendanceMonthCalendar
              employees={calendarEmployees}
              currentUser={currentUser}
              company={company}
              data={data}
              lane="mine"
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
    : (hubTool === "record"
      ? {
          title: ar ? "سجلي — الشهر" : "My record — the month",
          hint: ar ? "ماذا حدث في دوامي هذا الشهر؟ كل يوم بحالته — الأرقام نفسها التي يقرؤها المسير." : "What happened in my duty this month? Each day with its status — the same figures payroll reads.",
        }
      : {
          title: ar ? "بصمتي — اليوم" : "My punch — today",
          hint: ar ? "ماذا أفعل الآن؟ سجّل حضورك وانصرافك على ورديتك المنشورة." : "What do I do now? Punch in and out on your published shift.",
        });
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
          "«سجلي»: أيام الشهر بحالتها — الأرقام نفسها التي يقرؤها المسير.",
          "«جدولي»: ورديات الأسبوع، ومنه تطلب تغيير وردية. الإجازة من «طلباتي».",
          "«تنبيهاتي» في الجانب: كل تنبيه يفتح اليوم أو الطلب الذي يخصّه.",
        ]
        : [
          "My punch: check in and out with the button when your published shift starts.",
          "My record: each day of the month with its status — the figures payroll reads.",
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
          {activeTab === "team" && isManager && (
            <AttendanceDailyDashboard employees={employees} currentUser={currentUser} company={company} data={data} t={t} onQueueCount={setQueueCount} />
          )}
          {activeTab === "record" && (
            <MyRecordPage me={self} currentUser={currentUser} company={company} data={data} lang={lang} />
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
