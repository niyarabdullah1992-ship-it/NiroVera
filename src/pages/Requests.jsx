import React, { useEffect } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { canCreateTasks, hasHRPermission, hrScopeStations, visibleEmployees, visibleStations } from "@/lib/permissions";
import { requestInboxEmployees, requestInboxMaySee } from "@/lib/dutyScope";
import { nightDueAdminEmployees } from "@/lib/suiteBadges";
import useStationScope from "@/hooks/useStationScope";
import SuiteWorkspaceFrame from "@/components/shared/SuiteWorkspaceFrame";
import { pageKicker } from "@/lib/moduleMeta";
import RequestsWorkspace from "@/components/requests/RequestsWorkspace";
import { pendingManagerDecideCount, pendingRequestsCount } from "@/lib/otherRequestDerivations";
import {
  openWrittenConsentCount,
} from "@/lib/writtenConsent";
import { annualRemainingWithGrants, flattenWorkspaceRows, isUnseenApprovedLeave, managerPendingInbox, requestEmployeeStationId } from "@/lib/requestWorkspace";
import { requestSelfEmployee } from "@/lib/employeeFileView";
import { hydrateEmployeesLeave } from "@/lib/leaveDerivations";
import { openDueAnnualLeaveNotices, openDueNightRotateCycles } from "@/lib/store";
import { railLaneTabs, useRailSide } from "@/lib/railSide";

function canManageRequests(user, data) {
  if (!user || !data) return false;
  return !!(canCreateTasks(user, data) || hasHRPermission(user, data, "manage_leave"));
}

function requestAdminStations(user, data) {
  if (!canManageRequests(user, data)) return [];
  return visibleStations(user, data);
}

function requestAdminEmployees(user, data) {
  if (!canManageRequests(user, data)) return [];
  const inbox = requestInboxEmployees(user, data);
  if (inbox.length) return inbox;
  const roster = Array.isArray(data?.employees) ? data.employees : [];
  const defaultStationId = data?.stations?.[0]?.id || null;
  if (user?.hrLevelId && hasHRPermission(user, data, "manage_leave")) {
    const scope = hrScopeStations(user, data);
    return roster.filter((employee) => {
      if (!requestInboxMaySee(user, employee, data)) return false;
      return scope === null || scope.includes(employee.stationId || defaultStationId);
    });
  }
  return visibleEmployees(user, data).filter((employee) => requestInboxMaySee(user, employee, data));
}

export default function Requests() {
  const { lang } = useI18n();
  const { data, currentUser, company, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const railSide = useRailSide();
  const headerScope = useStationScope();
  const ar = lang === "ar";
  useEffect(() => {
    if (!company?.id) return;
    const night = openDueNightRotateCycles(company.id);
    const leave = openDueAnnualLeaveNotices(company.id);
    if (night.opened?.length || night.notified || leave.opened?.length) refresh?.();
  }, [company?.id]);

  if (!data || !currentUser) return null;

  const canManage = canManageRequests(currentUser, data);
  const adminStations = requestAdminStations(currentUser, data);
  const roster = hydrateEmployeesLeave(data?.employees || [], data);
  const hydratedData = { ...data, employees: roster };
  const self = requestSelfEmployee(currentUser, roster);

  const adminBase = requestAdminEmployees(currentUser, hydratedData);
  const dueAcrossManaged = nightDueAdminEmployees(currentUser, hydratedData);
  const adminSeen = new Set();
  const adminEmployees = [...adminBase, ...dueAcrossManaged].filter((employee) => {
    if (!employee?.id || adminSeen.has(employee.id)) return false;
    if (!requestInboxMaySee(currentUser, employee, hydratedData)) return false;
    adminSeen.add(employee.id);
    return true;
  });
  const inboxFocusStationId = headerScope && headerScope !== "all" ? headerScope : "";
  const scopedAdminEmployees = inboxFocusStationId
    ? adminEmployees.filter((employee) => requestEmployeeStationId(employee) === String(inboxFocusStationId))
    : adminEmployees;

  const minePending = pendingRequestsCount([self]);
  const adminInbox = managerPendingInbox(adminEmployees, lang, { stations: adminStations });
  const adminPending = adminInbox.count || pendingManagerDecideCount(adminEmployees);
  const mineConsent = openWrittenConsentCount([self]);
  const mineUnseenLeave = flattenWorkspaceRows([self]).filter(isUnseenApprovedLeave).length;
  const annual = annualRemainingWithGrants(self?.profile, self?.leaveRequests);

  const path = location.pathname;
  if (path === "/app/leave" || path === "/app/attendance/leave") {
    return <Navigate to="/app/requests" replace />;
  }
  if (path.endsWith("/manage") && !canManage) {
    return <Navigate to="/app/requests" replace />;
  }
  // Deep-link: archive lives inside ملفي / إدارة — open ملفي on the archive chip.
  if (path.endsWith("/archive")) {
    return <Navigate to="/app/requests" replace state={{ requestFilter: "archive" }} />;
  }

  const manageLane = railSide === "employee"
    ? false
    : railSide === "manage"
      ? canManage
      : canManage && path.endsWith("/manage");
  const initialKind = path.endsWith("/other") ? "other" : "leave";
  const lane = manageLane ? "manage" : "mine";
  const initialFilter = location.state?.requestFilter === "archive" ? "archive" : undefined;

  const tabs = canManage
    ? [
      { key: "mine", num: "01", ar: "ملفي", en: "My file", count: minePending + mineConsent + mineUnseenLeave, href: "/app/requests" },
      { key: "manage", num: "02", ar: "إدارة", en: "Manage", count: adminPending, href: "/app/requests/manage" },
    ]
    : [
      { key: "mine", num: "01", ar: "ملفي", en: "My file", count: minePending + mineConsent + mineUnseenLeave, href: "/app/requests" },
    ];
  const laneTabs = railLaneTabs(tabs, railSide);

  const viewNote = manageLane
    ? (ar ? "الإجازات والوثائق يرفعها الموظف؛ التكليف والرصيد من الإدارة." : "Leave and documents are raised by the worker; assignment and credit come from Manage.")
    : (ar ? "ترفع طلباتك. الاعتماد والرفض في إدارة." : "You raise your requests. Approve and reject sit in Manage.");
  const pageTitle = manageLane
    ? (ar ? "سجل الطلبات — قرار المسؤول" : "Request register — the manager's decision")
    : (ar ? "طلباتي" : "My Requests");
  const pageLede = manageLane
    ? (ar ? "القرار يُسجَّل باسمك. يُفتح من له طلب فقط؛ الأرشيف داخل الفلتر." : "The ruling is recorded in your name. Only someone with a request opens; the archive sits inside the filter.")
    : null;

  const scopeRows = flattenWorkspaceRows(manageLane ? scopedAdminEmployees : [self], lang);
  const riyadhYear = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric" }).format(new Date());
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const decidedAt = (row) => new Date(row.approvedAt || row.decidedAt || row.reviewedAt || row.createdAt || 0).getTime();
  const approvedThisYear = scopeRows.filter((row) => row.status === "approved" && String(row.approvedAt || row.decidedAt || row.reviewedAt || row.createdAt || "").startsWith(riyadhYear)).length;
  const approvedThisWeek = scopeRows.filter((row) => row.status === "approved" && decidedAt(row) >= weekAgo).length;
  const refusedCount = scopeRows.filter((row) => row.status === "rejected" || row.status === "no" || row.status === "refused_by_employee").length;
  const lateCount = scopeRows.filter((row) => {
    if (row.status !== "pending" || !row.createdAt) return false;
    return Date.now() - new Date(row.createdAt).getTime() >= 48 * 60 * 60 * 1000;
  }).length;
  const pendingShown = manageLane ? adminPending : minePending;
  const linkInk = { color: "#fff", fontWeight: 600 };

  const headStats = manageLane
    ? [
      { label: ar ? "بانتظار قرارك" : "Awaiting you", value: pendingShown, note: ar ? "في فروعك" : "In your branches" },
      { label: ar ? "معتمدة هذا الأسبوع" : "Approved this week", value: approvedThisWeek },
      { label: ar ? "مرفوضة" : "Refused", value: refusedCount, note: ar ? "بسبب مكتوب" : "With a written reason" },
      { label: ar ? "متأخرة 48 س" : "Late 48h", value: lateCount, note: ar ? "تصعد تلقائياً" : "Escalates on its own" },
    ]
    : [
      { label: ar ? "الرصيد السنوي" : "Annual balance", value: annual.remaining, note: ar ? "يوماً" : "days" },
      { label: ar ? "بانتظار قرار" : "Awaiting a decision", value: pendingShown },
      { label: ar ? "معتمدة هذا العام" : "Approved this year", value: approvedThisYear },
    ];

  return (
    <SuiteWorkspaceFrame
      ar={ar}
      kicker={pageKicker("/app/requests", lang)}
      title={pageTitle}
      hint={manageLane ? pageLede : (
        <>
          {ar ? "ترفع طلبك هنا ويستقرّ في " : "You raise the request here and it settles on "}
          <Link to="/app/employees" style={linkInk}>{ar ? "ملف الموظف" : "the employee file"}</Link>
          {ar ? ". القرار في «" : ". The decision sits in «"}
          {canManage && railSide !== "employee"
            ? <Link to="/app/requests/manage" style={linkInk}>{ar ? "إدارة" : "Manage"}</Link>
            : (ar ? "إدارة" : "Manage")}
          {ar ? "»، والأثر في " : "», and the effect lands on "}
          <Link to="/app/shifts" style={linkInk}>{ar ? "جدول الدوام" : "the duty roster"}</Link>
          {ar ? " و" : " and "}
          <Link to={railSide === "manage" ? "/app/calendar?lane=manage" : "/app/calendar"} style={linkInk}>{ar ? "التقويم التشغيلي" : "the operational calendar"}</Link>
          .
        </>
      )}
      viewNote={viewNote}
      tabs={laneTabs.map((item) => ({
        value: item.key,
        label: ar ? item.ar : item.en,
        count: item.count,
      }))}
      tool={lane}
      onTool={(value) => {
        const next = laneTabs.find((item) => item.key === value);
        if (next?.href) navigate(next.href);
      }}
      meta={(
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {headStats.map((item, index) => (
            <React.Fragment key={item.label}>
              {index > 0 ? <span aria-hidden style={{ width: 1, height: 28, background: "rgba(255,255,255,.28)" }} /> : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-start" }}>
                <span style={{ fontSize: 10.5, color: "#A9CDB8" }}>{item.label}</span>
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: "#fff", unicodeBidi: "isolate" }}>{item.value}</span>
                {item.note ? <span style={{ fontSize: 10, color: "#C5DBCD" }}>{item.note}</span> : null}
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    >
      <RequestsWorkspace
        employees={manageLane ? scopedAdminEmployees : [self]}
        stations={adminStations}
        lang={lang}
        mode={lane}
        canDecide={manageLane}
        selfOnly={!manageLane}
        showAdminLink={canManage && railSide !== "employee"}
        initialKind={initialKind}
        initialFilter={initialFilter}
        focusStationId={manageLane && canManage ? inboxFocusStationId : ""}
      />
    </SuiteWorkspaceFrame>
  );
}
