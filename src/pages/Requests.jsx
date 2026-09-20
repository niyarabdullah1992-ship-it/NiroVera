import React, { useEffect } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { canCreateTasks, hasHRPermission, hrScopeStations, visibleEmployees, visibleStations } from "@/lib/permissions";
import { requestInboxEmployees, requestInboxMaySee } from "@/lib/dutyScope";
import { nightDueAdminEmployees } from "@/lib/suiteBadges";
import useStationScope from "@/hooks/useStationScope";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { pageKicker } from "@/lib/moduleMeta";
import RequestsWorkspace from "@/components/requests/RequestsWorkspace";
import { pendingManagerDecideCount, pendingRequestsCount } from "@/lib/otherRequestDerivations";
import {
  openWrittenConsentCount,
} from "@/lib/writtenConsent";
import { annualRemainingWithGrants, flattenWorkspaceRows, isUnseenApprovedLeave, manageArchiveRows, managerPendingInbox, mineArchiveRows } from "@/lib/requestWorkspace";
import { requestSelfEmployee } from "@/lib/employeeFileView";
import { hydrateEmployeesLeave } from "@/lib/leaveDerivations";
import { openDueAnnualLeaveNotices, openDueNightRotateCycles } from "@/lib/store";
import { setStationScope } from "@/lib/stationScopeStore";

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

  const manageLane = canManage && path.endsWith("/manage");
  const archiveLane = path.endsWith("/archive");
  const initialKind = path.endsWith("/other") ? "other" : "leave";
  const lane = archiveLane ? "archive" : manageLane ? "manage" : "mine";
  const archiveEmployees = canManage
    ? [self, ...adminEmployees.filter((row) => row.id !== self.id)]
    : [self];
  const archiveCount = (canManage
    ? manageArchiveRows(archiveEmployees, lang, { stations: adminStations, stationId: inboxFocusStationId || "all" })
    : mineArchiveRows(archiveEmployees, currentUser, lang)
  ).rows.length;

  const tabs = canManage
    ? [
      { key: "mine", num: "01", ar: "ملفي", en: "My file", count: minePending + mineConsent + mineUnseenLeave, href: "/app/requests" },
      { key: "manage", num: "02", ar: "إدارة", en: "Manage", count: adminPending, href: "/app/requests/manage" },
      { key: "archive", num: "03", ar: "الأرشيف", en: "Archive", count: archiveCount, href: "/app/requests/archive" },
    ]
    : [
      { key: "mine", num: "01", ar: "ملفي", en: "My file", count: minePending + mineConsent + mineUnseenLeave, href: "/app/requests" },
      { key: "archive", num: "02", ar: "الأرشيف", en: "Archive", count: archiveCount, href: "/app/requests/archive" },
    ];

  const viewNote = archiveLane
    ? (ar ? "ما استقرّ من الطلبات والموافقات، مجمّعة يومًا بيوم حسب تاريخ الإغلاق. لا يُحذف منه شيء." : "Settled requests and consents, grouped day by day by close date. Nothing is deleted from here.")
    : manageLane
      ? (ar ? "القرار يُسجَّل باسمك." : "The ruling is recorded in your name.")
      : (ar ? "ترفع طلباتك. الاعتماد والرفض في إدارة." : "You raise your requests. Approve and reject sit in Manage.");
  const pageTitle = manageLane
    ? (ar ? "سجل الطلبات" : "Request register")
    : (ar ? "طلباتي" : "My Requests");
  const pagePurpose = manageLane
    ? (ar ? "استقبل وقرر من ملف الموظف." : "Receive and decide from the employee file.")
    : null;

  const kicker = pageKicker("/app/requests", lang);
  const kickerNum = String(pageKicker("/app/requests", "en")).slice(0, 2) || "03";
  const kickerName = kicker.replace(/^\d+\s*·\s*/, "");

  return (
    <PlatformStampShell ar={ar} bare maxWidth={1320}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--nv-ink, #14213D)", fontSize: 13 }}>
        <section className="nv-doc" style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 11, letterSpacing: ".14em", color: "var(--nv-ink3)", display: "flex", gap: 7, alignItems: "center" }}>
              <span dir="ltr" style={{ fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)" }}>{kickerNum}</span>
              <span>·</span>
              <span>{kickerName}</span>
            </span>
            <span className="nv-h" style={{ fontSize: 24, fontWeight: 700 }}>{pageTitle}</span>
            <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.85 }}>
              {manageLane ? pagePurpose : archiveLane ? (
                <>
                  {ar ? "ما استقرّ من طلب أو موافقة خطية يبقى هنا بمرجعه. قيد النظر في " : "Settled requests and written consents stay here with their reference. Open items sit in "}
                  <Link to="/app/requests" style={{ color: "inherit", fontWeight: 600 }}>{ar ? "ملفي" : "My file"}</Link>
                  {ar ? "، والأثر في " : ", and the effect lands on "}
                  <Link to="/app/calendar?lane=manage" style={{ color: "inherit", fontWeight: 600 }}>{ar ? "التقويم التشغيلي" : "the operational calendar"}</Link>
                  {ar ? " و" : " and "}
                  <Link to="/verify" style={{ color: "inherit", fontWeight: 600 }}>{ar ? "التحقق" : "Verify"}</Link>
                  .
                </>
              ) : (
                <>
                  {ar ? "ترفع طلبك هنا ويستقرّ في " : "You raise the request here and it settles on "}
                  <Link to="/app/employees" style={{ color: "inherit", fontWeight: 600 }}>{ar ? "ملف الموظف" : "the employee file"}</Link>
                  {ar ? ". القرار في " : ". The decision sits in "}
                  {canManage
                    ? <Link to="/app/requests/manage" style={{ color: "inherit", fontWeight: 600 }}>{ar ? "إدارة" : "Manage"}</Link>
                    : (ar ? "يحتاج قرار المسؤول" : "the manager's decision")}
                  {ar ? "، والأثر في " : ", and the effect lands on "}
                  <Link to="/app/shifts" style={{ color: "inherit", fontWeight: 600 }}>{ar ? "جدول الدوام" : "the shift schedule"}</Link>
                  {ar ? " و" : " and "}
                  <Link to="/app/calendar?lane=manage" style={{ color: "inherit", fontWeight: 600 }}>{ar ? "التقويم التشغيلي" : "the operational calendar"}</Link>
                  .
                </>
              )}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {archiveLane ? (
              <div className="nv-req-stat">
                <span style={{ fontSize: 10, color: "var(--nv-ink3)" }}>{ar ? "بنود مستقرّة" : "Settled items"}</span>
                <span dir="ltr" style={{ fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", fontSize: 15, fontWeight: 700, color: "var(--nv-ink)" }}>{archiveCount}</span>
              </div>
            ) : manageLane ? (
              <div className="nv-req-stat">
                <span style={{ fontSize: 10, color: "var(--nv-ink3)" }}>{ar ? "بانتظار قرارك" : "Awaiting your decision"}</span>
                <span dir="ltr" style={{ fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", fontSize: 15, fontWeight: 700, color: adminPending ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)" }}>{adminPending}</span>
              </div>
            ) : (
              <>
                <div className="nv-req-stat">
                  <span style={{ fontSize: 10, color: "var(--nv-ink3)" }}>{ar ? "الرصيد السنوي" : "Annual balance"}</span>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span dir="ltr" style={{ fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", fontSize: 15, fontWeight: 700, color: "var(--nv-ink)" }}>{annual.remaining}</span>
                    <span style={{ fontSize: 11, color: "var(--nv-ink)" }}>{ar ? "يوماً متبقياً" : "days left"}</span>
                  </span>
                </div>
                <div className="nv-req-stat">
                  <span style={{ fontSize: 10, color: "var(--nv-ink3)" }}>{ar ? "بانتظار قرار" : "Awaiting a decision"}</span>
                  <span dir="ltr" style={{ fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", fontSize: 15, fontWeight: 700, color: minePending ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)" }}>{minePending}</span>
                </div>
              </>
            )}
          </div>
        </section>

        <nav className="nv-doc nv-req-tabs" style={{ padding: "9px 14px", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          {tabs.filter((item) => item.key !== "archive").map((item) => {
            const on = lane === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.href)}
                aria-current={on ? "page" : undefined}
                style={{
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: on ? 700 : 400,
                  padding: "9px 16px",
                  border: `1px solid ${on ? "var(--nv-ink)" : "var(--nv-line)"}`,
                  background: on ? "var(--nv-ink)" : "var(--nv-card)",
                  color: on ? "#fff" : "var(--nv-ink2)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                  borderRadius: 10,
                }}
              >
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, opacity: 0.75 }}>{item.num}</span>
                {ar ? item.ar : item.en}
                {item.count ? (
                  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, background: on ? "#1D9A5B" : "#F5F6F8", color: on ? "#fff" : "#4B5567", padding: "1px 7px", borderRadius: 999 }}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
          {canManage ? (adminInbox.groups || []).filter((group) => group.count > 0).map((group) => {
            const on = inboxFocusStationId && String(group.stationId) === String(inboxFocusStationId);
            return (
              <button
                key={group.stationId || group.stationName}
                type="button"
                data-branch-alert="1"
                onClick={() => {
                  setStationScope(on ? "all" : group.stationId);
                  navigate("/app/requests/manage");
                }}
                aria-pressed={on}
                style={{
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: on ? 700 : 600,
                  padding: "8px 12px",
                  border: `1px solid ${on ? "var(--nv-bad-ink)" : "var(--nv-bad-line)"}`,
                  background: on ? "var(--nv-bad-ink)" : "var(--nv-bad-soft)",
                  color: on ? "#fff" : "var(--nv-bad-ink)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  whiteSpace: "nowrap",
                  borderRadius: 10,
                }}
              >
                {group.stationName}
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, background: on ? "rgba(255,255,255,.18)" : "#fff", color: on ? "#fff" : "#8A1C2B", padding: "1px 6px", borderRadius: 999 }}>
                  {group.count}
                </span>
              </button>
            );
          }) : null}
          {tabs.filter((item) => item.key === "archive").map((item) => {
            const on = lane === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.href)}
                aria-current={on ? "page" : undefined}
                style={{
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: on ? 700 : 400,
                  padding: "9px 16px",
                  border: `1px solid ${on ? "var(--nv-ink)" : "var(--nv-line)"}`,
                  background: on ? "var(--nv-ink)" : "var(--nv-card)",
                  color: on ? "#fff" : "var(--nv-ink2)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                  borderRadius: 10,
                }}
              >
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, opacity: 0.75 }}>{item.num}</span>
                {ar ? item.ar : item.en}
                {item.count ? (
                  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, background: on ? "#1D9A5B" : "#F5F6F8", color: on ? "#fff" : "#4B5567", padding: "1px 7px", borderRadius: 999 }}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
          <span style={{ marginInlineStart: "auto", fontSize: 11, color: "#4B5567", lineHeight: 1.7, maxWidth: 380, textAlign: "start" }}>
            {viewNote}
          </span>
        </nav>

        <RequestsWorkspace
          employees={archiveLane ? archiveEmployees : manageLane ? adminEmployees : [self]}
          stations={adminStations}
          lang={lang}
          mode={lane}
          canDecide={manageLane}
          selfOnly={!manageLane && !archiveLane}
          showAdminLink={canManage}
          initialKind={initialKind}
          focusStationId={(manageLane || archiveLane) && canManage ? inboxFocusStationId : ""}
        />
      </div>
    </PlatformStampShell>
  );
}
