import React, { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { visibleStations, visibleEmployees } from "@/lib/permissions";
import { formatDate } from "@/lib/dateFormat";
import { base44 } from "@/api/base44Client";
import { queryClientInstance } from "@/lib/query-client";
import { getRiskWeights } from "@/lib/riskWeights";
import { deriveTeamAttendanceToday } from "@/lib/attendance";
import { isEscalated } from "@/lib/opsDerivations";
import { listLocalTodayAttendance, mergeAttendanceRows } from "@/lib/localAttendanceFallback";
import { isOnLeaveToday, leaveTypeLabel } from "@/lib/leaveTypes";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import DashboardPersonaBar from "@/components/dashboard/DashboardPersonaBar";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";
import HandoffCommandBoard from "@/components/dashboard/HandoffCommandBoard";
import OperationsModuleGrid from "@/components/dashboard/OperationsModuleGrid";
import StationManagerDashboard from "@/components/dashboard/StationManagerDashboard";
import SuiteWelcomeModal from "@/components/suite/SuiteWelcomeModal";
import { hasSeenSuiteWelcome } from "@/lib/suiteApps";
import ErpCommandBanner from "@/components/erp/ErpCommandBanner";
import { erpKicker } from "@/lib/erpModuleMeta";
import { getChatUnreadTotal, subscribeChatUnread } from "@/lib/chatUnreadStore";

function pendingSigningCount(data) {
  return (data?.signatureRequests || []).filter((row) => {
    const status = String(row.status || "").toLowerCase();
    return status === "pending" || status === "awaiting" || status === "in_progress";
  }).length;
}

function pendingExpenseCount(data) {
  return (data?.expenses || data?.expenseClaims || []).filter((row) =>
    ["submitted", "manager_approved", "pending"].includes(row.status),
  ).length;
}

function openHazardCount(data) {
  return (data?.safety || []).reduce(
    (sum, rec) => sum + (rec.hazards || []).filter((hazard) => !hazard.closedAt).length,
    0,
  );
}

function buildModuleMetrics(data, extra = {}) {
  const tasks = data?.tasks || [];
  const reports = data?.reports || [];
  const completed = extra.completedTasks ?? tasks.filter((task) => task.status === "completed").length;
  const taskTotal = extra.tasks ?? tasks.length;
  return {
    stations: data?.stations?.length || 0,
    tasks: taskTotal,
    completedTasks: completed,
    openTasks: extra.openTasks ?? Math.max(0, taskTotal - completed),
    escalated: extra.escalated ?? tasks.filter(isEscalated).length,
    complaints: extra.complaints ?? (data?.anonymousReports || []).filter((row) => row.status === "open").length,
    reports: extra.reports ?? reports.length,
    pendingReports: extra.pendingReports ?? reports.filter((row) => row.status === "pending").length,
    payroll: data?.payroll?.length || 0,
    attendanceRate: extra.attendanceRate ?? 0,
    checkedIn: extra.checkedIn ?? 0,
    absentCount: extra.absentCount ?? 0,
    scheduled: extra.scheduled ?? 0,
    signing: extra.signing ?? pendingSigningCount(data),
    performance: extra.performance ?? (taskTotal ? Math.round((completed / taskTotal) * 100) : 0),
    employees: extra.employees ?? (data?.employees?.length || 0),
    activeMembers: extra.activeMembers ?? 0,
    pendingLeave: extra.pendingLeave ?? 0,
    offboarding: extra.offboarding ?? 0,
    safety: (data?.safety || []).length,
    hazards: extra.hazards ?? openHazardCount(data),
    expenses: extra.pendingExpenses ?? pendingExpenseCount(data),
    inventory: data?.inventory?.length || data?.inventoryItems?.length || 0,
    files: data?.files?.length || 0,
    messages: data?.messages?.length || 0,
  };
}

export default function Dashboard() {
  const { lang } = useI18n();
  const headerScope = useStationScope();
  const { data, currentUser, company, refresh } = useAuth();
  const [stoppageCount, setStoppageCount] = useState(0);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [targetRows, setTargetRows] = useState([]);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(() => getChatUnreadTotal());

  const ar = lang === "ar";

  useEffect(() => subscribeChatUnread(setChatUnread), []);

  useEffect(() => {
    if (!company?.id) return;
    const params = new URLSearchParams(window.location.search);
    const force = params.get("suiteWelcome") === "1";
    if (force || !hasSeenSuiteWelcome(company.id)) {
      setWelcomeOpen(true);
      if (force) {
        params.delete("suiteWelcome");
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
        window.history.replaceState({}, "", next);
      }
    }
  }, [company?.id]);

  const welcome = welcomeOpen ? (
    <SuiteWelcomeModal
      ar={ar}
      companyId={company?.id}
      companyName={company?.name}
      onClose={() => setWelcomeOpen(false)}
    />
  ) : null;

  const loadStoppage = async () => {
    if (!currentUser) return;
    try {
      const res = await base44.functions.invoke("supabaseTargets", {
        action: "listTargets",
        userRole: currentUser.role,
        userId: currentUser.id,
        stationId: currentUser.stationId || null,
        managedStations: currentUser.managedStations || [],
      });
      const list = res?.data?.targets || [];
      setTargetRows(list);
      let count = 0;
      for (const tg of list) {
        for (const c of Array.isArray(tg.comments) ? tg.comments : []) {
          if (c.is_issue) count++;
        }
      }
      setStoppageCount(count);
    } catch {
      setStoppageCount(0);
      setTargetRows([]);
    }
  };

  useEffect(() => {
    loadStoppage();
  }, [currentUser?.id]);

  const loadAttendance = () => {
    if (!currentUser || !data) return;
    const ids = visibleEmployees(currentUser, data).map((e) => e.id);
    const apply = (cloudRows) => {
      setAttendanceRows(mergeAttendanceRows(cloudRows || [], listLocalTodayAttendance(company?.id, data)));
    };
    if (!ids.length) {
      apply([]);
      return;
    }
    base44.functions.invoke("supabaseAttendance", { action: "listDaily", employeeIds: ids })
      .then((res) => apply(res?.data?.rows || []))
      .catch(() => apply([]));
  };

  useEffect(() => {
    loadAttendance();
    const onUpdated = () => loadAttendance();
    window.addEventListener("attendance-updated", onUpdated);
    return () => window.removeEventListener("attendance-updated", onUpdated);
  }, [currentUser?.id, data?.employees?.length, data?.personalAttendance?.length, company?.id]);

  const handleRefresh = async () => {
    await Promise.allSettled([loadStoppage(), queryClientInstance.invalidateQueries()]);
    loadAttendance();
    refresh();
  };

  if (!data || !currentUser) return null;

  const tree = data.stations || [];
  const stations = visibleStations(currentUser, data).filter((s) => matchesStationScope(s.id, headerScope, tree));
  const stationIds = new Set(stations.map((s) => s.id));
  const anonOpenCount = (data.anonymousReports || []).filter((a) => stationIds.has(a.stationId) && a.status === "open").length;
  const isEmployee = currentUser.role === "employee";
  const teamEmployees = visibleEmployees(currentUser, data).filter((employee) =>
    matchesStationScope(employee.stationId, headerScope, tree),
  );
  const mergedAttendanceRows = mergeAttendanceRows(
    attendanceRows,
    listLocalTodayAttendance(company?.id, data),
  );
  const todayAtt = deriveTeamAttendanceToday(teamEmployees, mergedAttendanceRows, data);
  const attendanceRate = todayAtt.rate;
  const checkedInCount = todayAtt.presentLike;
  const absentCount = todayAtt.absent;
  const attendanceExtras = {
    attendanceRate,
    checkedIn: checkedInCount,
    absentCount,
    scheduled: todayAtt.scheduled,
    activeMembers: todayAtt.presentLike,
    employees: teamEmployees.length,
  };

  if (isEmployee) {
    return (
      <>
        {welcome}
        <PullToRefresh onRefresh={handleRefresh}>
          <PlatformStampShell
            ar={lang === "ar"}
            kicker={erpKicker("/app", lang)}
            title={lang === "ar" ? "لوحة العمل" : "Work dashboard"}
            hint={lang === "ar" ? "حضور اليوم، المهام، ودورة الإثبات في مكان واحد." : "Today's attendance, tasks, and the proof cycle in one place."}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ErpCommandBanner ar={lang === "ar"} metrics={buildModuleMetrics(data, attendanceExtras)} />
              <DashboardPersonaBar lang={lang} />
              <EmployeeDashboard user={currentUser} company={company} data={data} />
              <OperationsModuleGrid
                metrics={buildModuleMetrics(data, attendanceExtras)}
                lang={lang}
                user={currentUser}
                data={data}
                company={company}
              />
            </div>
          </PlatformStampShell>
        </PullToRefresh>
      </>
    );
  }

  if (currentUser.role === "station_manager" || currentUser.role === "pgm") {
    return (
      <>
        {welcome}
        <PullToRefresh onRefresh={handleRefresh}>
          <PlatformStampShell
            ar={lang === "ar"}
            kicker={erpKicker("/app", lang)}
            title={lang === "ar" ? "مركز القيادة" : "Command center"}
            hint={lang === "ar" ? "قرارات اليوم على نطاق فرعك." : "Today's decisions for your station scope."}
            maxWidth={1280}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <StationManagerDashboard user={currentUser} data={data} stoppageCount={stoppageCount} chatUnread={chatUnread} />
              <OperationsModuleGrid
                metrics={buildModuleMetrics(data, attendanceExtras)}
                lang={lang}
                user={currentUser}
                data={data}
                company={company}
              />
            </div>
          </PlatformStampShell>
        </PullToRefresh>
      </>
    );
  }

  const sourceTasks = targetRows.length ? targetRows : data.tasks;
  const tasks = sourceTasks.filter((task) => stationIds.has(task.stationId || task.station_id || task.assignment_id));
  const reports = (data.reports || []).filter((r) => stationIds.has(r.stationId));
  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const completed = tasks.filter((tk) => tk.status === "completed").length;

  const activeMembersCount = todayAtt.presentLike;
  const presentIds = new Set(
    mergedAttendanceRows
      .filter((row) => row.check_in_at || row.checkInAt)
      .map((row) => String(row.employee_id ?? row.employeeId)),
  );
  const now = Date.now();
  const delayedTasks = tasks.filter((task) => {
    const deadline = task.dueDate || task.endDate || task.end_date;
    return task.status !== "completed" && deadline && new Date(deadline).getTime() <= now + 3 * 86400000;
  }).length;
  const escalatedTasks = tasks.filter((task) => isEscalated(task)).length;
  const safetyRecs = (data.safety || []).filter((s) => stationIds.has(s.stationId));
  const criticalStations = safetyRecs.filter((s) => s.level === "red").length;
  const openHazards = safetyRecs.reduce((sum, s) => sum + (s.hazards?.length || 0), 0);
  const recentIncidents = safetyRecs.reduce((sum, s) => sum + (s.incidentLog || []).filter((i) => i.at && now - new Date(i.at).getTime() <= 30 * 86400000).length, 0);
  const todayStr = new Date().toDateString();
  const todayIncidents = safetyRecs.reduce((sum, s) => sum + (s.incidentLog || []).filter((i) => i.at && new Date(i.at).toDateString() === todayStr).length, 0);
  const riskWeights = getRiskWeights(data);
  const riskScore = Math.min(100, Math.round(
    (absentCount * riskWeights.absent) + (delayedTasks * riskWeights.delayed) + (stoppageCount * riskWeights.stoppage) +
    (pendingReports * riskWeights.reports) + (criticalStations * riskWeights.critical) +
    (recentIncidents * riskWeights.incidents) + (openHazards * riskWeights.hazards)
  ));

  const pendingLeaveCount = teamEmployees.reduce(
    (sum, employee) => sum + (employee.leaveRequests || []).filter((request) => request.status === "pending").length,
    0,
  );
  const leaveQueue = teamEmployees.flatMap((employee) =>
    (employee.leaveRequests || [])
      .filter((request) => request.status === "pending")
      .map((request) => ({
        id: `${employee.id}-${request.id || request.createdAt || request.startDate}`,
        name: employee.name,
        type: leaveTypeLabel(request.typeAr || request.type, lang === "ar"),
        date: formatDate(request.createdAt || request.startDate || new Date(), lang, { day: "numeric", month: "short" }),
        status: lang === "ar"
          ? (request.awaiting === "finance" ? "بانتظار المالية" : request.awaiting === "hr" ? "بانتظار HR" : "بانتظار المدير")
          : (request.awaiting === "finance" ? "Awaiting finance" : request.awaiting === "hr" ? "Awaiting HR" : "Awaiting manager"),
      })),
  );
  const reportQueue = reports
    .filter((r) => r.status === "pending")
    .slice(0, 4)
    .map((r) => ({
      id: r.id,
      name: teamEmployees.find((e) => e.id === r.employeeId)?.name || r.authorName || (lang === "ar" ? "موظف" : "Staff"),
      type: lang === "ar" ? "تقرير يومي" : "Daily report",
      date: formatDate(r.createdAt || new Date(), lang, { day: "numeric", month: "short" }),
      status: lang === "ar" ? "بانتظار المدير" : "Awaiting manager",
    }));
  const handoffQueue = [...leaveQueue, ...reportQueue].slice(0, 6);
  const handoffAlerts = [
    ...(chatUnread ? [{ level: "info", text: lang === "ar" ? `${chatUnread} محادثة غير مقروءة.` : `${chatUnread} unread conversation(s).`, to: "/app/chat" }] : []),
    ...(escalatedTasks ? [{ level: "info", text: lang === "ar" ? `${escalatedTasks} مهمة في صندوق التصعيد — تحتاج مراجعتك.` : `${escalatedTasks} task(s) in the escalation inbox — need your review.`, to: "/app/escalation" }] : []),
    ...(delayedTasks ? [{ level: "info", text: lang === "ar" ? `${delayedTasks} مهمة تقترب من موعدها أو متأخرة.` : `${delayedTasks} tasks due soon or overdue.`, to: "/app/tasks" }] : []),
    ...(absentCount ? [{ level: "warn", text: lang === "ar" ? `${absentCount} من المجدولين لم يسجّلوا حضورًا بعد.` : `${absentCount} scheduled staff not checked in yet.`, to: "/app/attendance" }] : []),
    ...(pendingReports ? [{ level: "warn", text: lang === "ar" ? `${pendingReports} تقرير يومي بانتظار الاعتماد.` : `${pendingReports} daily reports awaiting approval.`, to: "/app/daily-report" }] : []),
    ...(openHazards ? [{ level: "critical", text: lang === "ar" ? `${openHazards} مخاطر سلامة بانتظار الإغلاق.` : `${openHazards} open safety hazards awaiting closure.`, to: "/app/safety" }] : []),
    ...(pendingLeaveCount ? [{ level: "ok", text: lang === "ar" ? `${pendingLeaveCount} طلب إجازة بانتظار القرار.` : `${pendingLeaveCount} leave requests awaiting a decision.`, to: "/app/leave" }] : []),
  ].filter(Boolean).slice(0, 4);

  const monthHired = teamEmployees.filter((e) => {
    const d = new Date(e.createdAt || e.hiredAt || e.startDate || 0);
    const hiredNow = new Date();
    return d.getMonth() === hiredNow.getMonth() && d.getFullYear() === hiredNow.getFullYear();
  }).length;

  const readinessScore = Math.max(0, Math.min(100, 100 - riskScore));
  const readinessFactors = [
    { label: lang === "ar" ? "حضور اليوم" : "Today's attendance", pct: attendanceRate },
    { label: lang === "ar" ? "مهام" : "Tasks", pct: tasks.length ? Math.round((completed / tasks.length) * 100) : 100 },
    { label: lang === "ar" ? "سلامة" : "Safety", pct: Math.max(0, 100 - openHazards * 12 - criticalStations * 20) },
    { label: lang === "ar" ? "اعتمادات" : "Approvals", pct: Math.max(0, 100 - (pendingLeaveCount + pendingReports) * 8) },
  ];

  return (
    <>
      {welcome}
      <PullToRefresh onRefresh={handleRefresh}>
        <PlatformStampShell
          ar={lang === "ar"}
          kicker={erpKicker("/app", lang)}
          title={lang === "ar" ? "مركز القيادة" : "Command center"}
          hint={lang === "ar" ? "نظرة قرار على الناس والرعاية والعمليات والثقة." : "A decision glance across people, care, operations, and trust."}
          maxWidth={1280}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <HandoffCommandBoard
              lang={lang}
              greetName={(currentUser.name || "").split(/\s+/)[0]}
              readinessScore={readinessScore}
                  factors={readinessFactors}
                  employeesCount={todayAtt.scheduled}
                  employeesDelta={monthHired || null}
                  attendanceRate={attendanceRate}
                  pendingLeave={pendingLeaveCount}
                  pendingReports={pendingReports}
                  leaveQueue={handoffQueue}
                  alerts={handoffAlerts}
                  stations={stations.map((s) => {
                    const crew = teamEmployees.filter((e) => (e.stationId || null) === s.id && presentIds.has(String(e.id))).length;
                    const open = tasks.filter((tk) => (tk.stationId || tk.station_id) === s.id && tk.status !== "completed").length
                      + ((safetyRecs.find((r) => r.stationId === s.id)?.hazards || []).filter((h) => !h.closedAt).length);
                    return {
                      id: s.id,
                      name: s.name,
                      code: s.code || s.shortCode || "",
                      crew,
                      open,
                    };
                  })}
                  openHazards={openHazards}
                  criticalHazards={criticalStations}
                  presentCount={checkedInCount}
                  lateCount={mergedAttendanceRows.filter((row) => row.status === "late").length}
                  leaveCount={teamEmployees.filter((e) => isOnLeaveToday(e)).length}
                  absentCount={absentCount}
                  daysClear={todayIncidents > 0 ? 0 : null}
                />
                <OperationsModuleGrid
                  metrics={buildModuleMetrics(data, {
                    tasks: tasks.length,
                    completedTasks: completed,
                    openTasks: Math.max(0, tasks.length - completed),
                    complaints: anonOpenCount,
                    reports: reports.length,
                    pendingReports,
                    attendanceRate,
                    checkedIn: checkedInCount,
                    absentCount,
                    scheduled: todayAtt.scheduled,
                    signing: pendingSigningCount(data),
                    performance: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
                    employees: teamEmployees.length,
                    activeMembers: activeMembersCount,
                    pendingLeave: pendingLeaveCount,
                    hazards: openHazards,
                    pendingExpenses: pendingExpenseCount(data),
                    escalated: escalatedTasks,
                  })}
                  lang={lang} user={currentUser} data={data} company={company}
                />
          </div>
        </PlatformStampShell>
      </PullToRefresh>
    </>
  );
}
