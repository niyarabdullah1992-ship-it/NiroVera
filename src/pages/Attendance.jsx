import React, { useState, useEffect, lazy, Suspense } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { base44 } from "@/api/base44Client";
import { canCreateTasks, isCompanyOwner, hasHRPermission } from "@/lib/permissions";
import { managedDutyEmployees } from "@/lib/dutyScope";
import { Loader2 } from "lucide-react";
import CheckInOutCard from "@/components/attendance/CheckInOutCard";
import AttendancePunchWeek from "@/components/attendance/AttendancePunchWeek";
import { AttendanceProofChain, punchChainFromAttendance } from "@/components/attendance/AttendanceTrustChrome";
import AttendanceSectionFrame from "@/components/attendance/AttendanceSectionFrame";
import { getTodaysShift } from "@/lib/attendance";
import { listLocalTodayAttendance } from "@/lib/localAttendanceFallback";
import { isStatutoryOffDay } from "@/lib/leaveTypes";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import { queryClientInstance } from "@/lib/query-client";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { ACCENT } from "@/lib/platformStyles";
import SectionShell from "@/components/shared/SectionShell";
import DutyLaneBar, { dutyLaneFromSearch, writeDutyLane } from "@/components/shared/DutyLaneBar";
import { pageKicker } from "@/lib/moduleMeta";
import { hydrateEmployeesLeave } from "@/lib/leaveDerivations";
import { calendarOverlayEmployees } from "@/lib/shiftWeek";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { migratePreviewRotaClock, migratePreviewWeekRota, migratePreviewOwnerMorningRota, migratePreviewCompanyHeadWorkplace, seedPreviewOwnerNightStreak, seedPreviewProofCycle } from "@/lib/previewMigrations";
import { openDueAnnualLeaveNotices, openDueNightRotateCycles, updateCompany } from "@/lib/store";
import { useRailSide } from "@/lib/railSide";

const ShiftsPlatformBoard = lazy(() => import("@/components/schedules/ShiftsPlatformBoard"));
const AttendanceMonthCalendar = lazy(() => import("@/components/attendance/AttendanceMonthCalendar"));
const AttendanceLocationsPanel = lazy(() => import("@/components/attendance/AttendanceLocationsPanel"));
const AttendanceSettingsBoard = lazy(() => import("@/components/attendance/AttendanceSettingsBoard"));
const AttendanceMineWeek = lazy(() => import("@/components/attendance/AttendanceMineWeek"));
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
  const [punchAtt, setPunchAtt] = useState(null);
  const [manualAsk, setManualAsk] = useState(0);
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

  if (location.pathname === "/app/attendance" && searchParams.get("tab") === "calendar") {
    return <Navigate to="/app/calendar" replace />;
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
  const focusCalendar = location.pathname.endsWith("/calendar");
  const ar = lang === "ar";
  const canManageDuty = !!(isManager || canManageLeave);
  const canManageHere = focusShifts || focusCalendar ? canManageDuty : !!isManager;
  const lane = dutyLaneFromSearch(searchParams, canManageHere, railSide);
  const defaultHubTab = "punch";
  const mineTabs = [
    { key: "punch", label: ar ? "بصمتي" : "My punch" },
    { key: "mine", label: ar ? "كشفي" : "My register" },
  ];
  const manageTabs = isManager
    ? [
        { key: "team", label: ar ? "يحتاج قرارك" : "Needs your decision", count: queueCount },
        { key: "policy", label: ar ? "السياسة والمواقع" : "Policy and sites" },
      ]
    : [];
  const hubTabs = lane === "manage" && isManager ? manageTabs : mineTabs;
  const allowedTabs = new Set([...mineTabs.map((item) => item.key), ...manageTabs.map((item) => item.key), "report", "roster", "map", "settings", "policy"]);
  const requested = routeTab || tab;
  let activeTab = lane === "manage" && isManager ? "team" : defaultHubTab;
  if (focusShifts && lane === "manage" && isManager) activeTab = "schedule";
  else if (requested && allowedTabs.has(requested)) {
    if (requested === "roster") activeTab = "punch";
    else if (lane === "mine" && ["team", "map", "analytics", "settings", "policy"].includes(requested)) activeTab = requested === "mine" ? "mine" : "punch";
    else if (lane === "manage" && ["punch", "mine", "roster", "report"].includes(requested)) activeTab = "team";
    else if (requested === "map" || requested === "settings") activeTab = lane === "manage" && isManager ? "policy" : "punch";
    else if (requested === "report") activeTab = "mine";
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

  const selectTab = (key) => {
    setTab(key);
    if (location.pathname === "/app/attendance") {
      const next = writeDutyLane(searchParams, ["team", "policy"].includes(key) ? "manage" : "mine");
      if (key === defaultHubTab) next.delete("tab");
      else next.set("tab", key);
      setSearchParams(next, { replace: true });
    }
  };

  const self = roster.find((row) => row.id === currentUser.id) || currentUser;
  const teamEmployees = employees.filter((row) => row.id !== currentUser.id);
  const rotaStationId = headerScope && headerScope !== "all" ? headerScope : defaultStationId;
  const shiftManageCount = rotaStationId
    ? employees.filter((row) => (row.stationId || defaultStationId) === rotaStationId && row.id !== currentUser.id).length
    : teamEmployees.length;
  const headerLeavePeople = headerScope && headerScope !== "all"
    ? (data?.employees || []).filter((row) => matchesStationScope(row.stationId || defaultStationId, headerScope, stationList))
    : [];
  const calendarEmployees = hydrateEmployeesLeave(
    calendarOverlayEmployees({
      lane: lane === "manage" && canManageDuty ? "manage" : "mine",
      employee: self,
      employees: data?.employees || [],
      managed: employees.length ? employees : [],
      headerPeople: headerLeavePeople,
    }),
    data,
  );

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
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        <SectionShell bare ar={ar} maxWidth={1320}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DutyLaneBar ar={ar} canManage={canManageDuty} lane={lane} onLane={setLane} manageCount={teamEmployees.length} />
            <Suspense fallback={<TabLoader />}>
              <AttendanceMonthCalendar
                employees={calendarEmployees}
                currentUser={currentUser}
                company={company}
                data={data}
                kicker={pageKicker("/app/calendar", lang)}
                lane={lane}
                canManage={canManageDuty}
              />
            </Suspense>
          </div>
        </SectionShell>
      </PullToRefresh>
    );
  }

  const hubTool = hubTabs.some((item) => item.key === activeTab) ? activeTab : defaultHubTab;
  const todayShift = getTodaysShift(data, currentUser);
  const chain = punchChainFromAttendance(punchAtt, { scheduled: !!todayShift, onLeave: !!isStatutoryOffDay(currentUser, toRiyadhDateKey(), laborCalendarOf(data)) });

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <AttendanceSectionFrame
      ar={ar}
      kicker={pageKicker("/app/attendance", lang)}
      tabs={hubTabs}
      tool={hubTool}
      onTool={selectTab}
      lane={lane}
      laneBar={<DutyLaneBar ar={ar} canManage={!!isManager} lane={lane} onLane={setLane} manageCount={queueCount} />}
    >
      <Suspense fallback={<TabLoader />}>
          {(activeTab === "roster" || activeTab === "punch") && (
            <div className="nv-att-punch-grid">
              <CheckInOutCard currentUser={currentUser} company={company} t={t} onStatusChange={setPunchAtt} manualAsk={manualAsk} />
              <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                <AttendancePunchWeek employee={currentUser} company={company} data={data} lang={lang} />
                <AttendanceProofChain ar={ar} {...chain} onManual={() => setManualAsk((n) => n + 1)} />
              </div>
            </div>
          )}
          {activeTab === "team" && isManager && (
            <AttendanceDailyDashboard employees={employees} currentUser={currentUser} company={company} data={data} t={t} onQueueCount={setQueueCount} />
          )}
          {activeTab === "mine" && (
            <AttendanceMineWeek employee={currentUser} company={company} data={data} lang={lang} />
          )}
          {activeTab === "policy" && isManager && (
            <div className="nv-att-policy-grid">
              <AttendanceSettingsBoard
                company={company}
                currentUser={currentUser}
                t={t}
                canEditSettings={isCompanyOwner(currentUser, data) || currentUser.role === "director"}
              />
              <AttendanceLocationsPanel t={t} lang={lang} />
            </div>
          )}
        </Suspense>
    </AttendanceSectionFrame>
    </PullToRefresh>
  );
}
