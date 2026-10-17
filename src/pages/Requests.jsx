import React, { useEffect } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ABUSE_COMPLAINT_KIND, DAMAGE_OBJECTION_TYPE, GRIEVANCE_TYPE, rightsRouteFor } from "@/lib/rightsRequests";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { canCreateTasks, hasHRPermission, hrScopeStations, visibleEmployees, visibleStations } from "@/lib/permissions";
import { requestInboxEmployees, requestInboxMaySee } from "@/lib/dutyScope";
import { nightDueAdminEmployees } from "@/lib/suiteBadges";
import useStationScope from "@/hooks/useStationScope";
import SuiteWorkspaceFrame from "@/components/shared/SuiteWorkspaceFrame";
import { pageKicker } from "@/lib/moduleMeta";
import RequestsWorkspace from "@/components/requests/RequestsWorkspace";
import OtDecisionsPanel from "@/components/schedules/OtDecisionsPanel";
import { pendingManagerDecideCount, pendingRequestsCount } from "@/lib/otherRequestDerivations";
import {
  openWrittenConsentCount,
} from "@/lib/writtenConsent";
import { annualRemainingWithGrants, flattenWorkspaceRows, isUnseenApprovedLeave, managerPendingInbox, requestEmployeeStationId } from "@/lib/requestWorkspace";
import { requestSelfEmployee } from "@/lib/employeeFileView";
import { hydrateEmployeesLeave } from "@/lib/leaveDerivations";
import { openDueAnnualCarryNotices, openDueAnnualLeaveNotices, openDueNightRotateCycles } from "@/lib/store";
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
    // Art. 110: carried days near or past the deferral limit — the worker and manager are told once.
    const carry = openDueAnnualCarryNotices(company.id);
    if (night.opened?.length || night.notified || leave.opened?.length || carry.opened?.length) refresh?.();
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
  const askedKind = new URLSearchParams(location.search || "").get("kind") || "";
  // Old links: the grievance and damage objection moved to «الجزاءات», the abuse complaint to «صوت الموظف».
  const askedRight = new URLSearchParams(location.search || "").get("right") || "";
  if (askedKind === "rights" && [GRIEVANCE_TYPE, DAMAGE_OBJECTION_TYPE, ABUSE_COMPLAINT_KIND].includes(askedRight)) {
    return <Navigate to={rightsRouteFor(askedRight)} replace />;
  }
  const initialKind = path.endsWith("/other")
    ? "other"
    : (["permission", "shift_change", "nursing_hour", "pregnancy_notice", "heat_report", "family_duties", "manual", "outfix", "resignation", "rights"].includes(askedKind)
      ? askedKind
      : (manageLane ? "leave_credit" : "leave"));
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

  const linkInk = { color: "#fff", fontWeight: 600 };


  return (
    <SuiteWorkspaceFrame
      ar={ar}
      kicker={pageKicker("/app/requests", lang)}
      title={pageTitle}
      hint={manageLane ? pageLede : (
        <>
          {ar ? "ترفع طلبك هنا ويقرّره مديرك، ويظهر أثره في " : "Raise your request here; your manager decides, and the effect shows on "}
          <Link to="/app/shifts" style={linkInk}>{ar ? "جدول الدوام" : "the duty roster"}</Link>
          {ar ? " و" : " and "}
          <Link to="/app/calendar" style={linkInk}>{ar ? "سجل الحضور" : "the attendance record"}</Link>
          .
        </>
      )}
      tabs={[].concat(laneTabs.length > 1 ? laneTabs : []).map((item) => ({
        value: item.key,
        label: ar ? item.ar : item.en,
        count: item.count,
      }))}
      tool={lane}
      onTool={(value) => {
        const next = laneTabs.find((item) => item.key === value);
        if (next?.href) navigate(next.href);
      }}
      // No figures in the hero: pending/approved/refused already head the queue inside the section.
    >
      {/* Art. 107 / Regs Art. 22 — my overtime awaiting a decision, and the cap-consent request I answer. */}
      {!manageLane && self?.id ? (
        <OtDecisionsPanel data={data} companyId={company?.id} currentUser={currentUser} employees={[self]} mode="mine" ar={ar} onSaved={refresh} />
      ) : null}
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
        initialRightsKind={new URLSearchParams(location.search || "").get("right") || ""}
        initialDocKind={new URLSearchParams(location.search || "").get("doc") || ""}
      />
    </SuiteWorkspaceFrame>
  );
}
