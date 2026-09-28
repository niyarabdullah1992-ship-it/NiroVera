import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatDate } from "@/lib/dateFormat";
import { computeLeaveDays, hasLeaveAttachment, LEAVE_TYPES } from "@/lib/leaveDerivations";
import EmployeeIdentityRow from "@/components/employees/EmployeeIdentityRow";
import { ChromeBox } from "@/components/shared/IdentityCard";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import { CARD, MUTED, NAVY, OK, WARN, BAD, NEUTRAL, emptyState, statCard, SURFACE } from "@/lib/platformStyles";
import StatutoryItem from "@/components/labor/StatutoryItem";
import { countAr, requestReplyCopy, requestReplyHref } from "@/lib/requestWorkspace";

const COLS = "minmax(170px,1.4fr) 110px 108px minmax(150px,1fr) 90px 130px 116px 150px";

function hasAttachment(request) {
  return hasLeaveAttachment(request)
    || !!request.attachmentUrl
    || !!request.documentUrl;
}

function statusMeta(status, ar) {
  if (status === "approved") return { label: ar ? "معتمد" : "Approved", style: OK };
  if (status === "rejected") return { label: ar ? "مرفوض" : "Rejected", style: BAD };
  return { label: ar ? "بانتظار القرار" : "Pending", style: WARN };
}

/**
 * Leave queue — history and status only.
 * Raise and decide live in طلباتي (`/app/requests`).
 */
export default function AttendanceLeaveRequests({
  employees,
  stations,
  t,
  lang,
  view = "queue",
  canDecide = true,
}) {
  const ar = lang === "ar";
  const replyHref = requestReplyHref({ manage: canDecide });

  const stationName = (id) => stations.find((station) => station.id === id)?.name || t("hq");

  const requests = useMemo(
    () => employees
      .flatMap((employee) => (employee.leaveRequests || []).map((request) => ({ ...request, employee })))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [employees],
  );

  const pending = requests.filter((r) => (r.status || "pending") === "pending");
  const approved = requests.filter((r) => r.status === "approved");
  const rejected = requests.filter((r) => r.status === "rejected");
  const pendingDays = pending.reduce(
    (n, r) => n + (Number(r.days) || computeLeaveDays(r.startDate, r.endDate) || 0),
    0,
  );

  if (view === "archive") {
    const archiveItems = [...approved, ...rejected].map((request) => {
      const typeMeta = (LEAVE_TYPES || []).find((x) => x.key === request.type);
      const days = Number(request.days) || computeLeaveDays(request.startDate, request.endDate);
      const st = statusMeta(request.status, ar);
      return {
        id: `${request.employee.id}-${request.id}`,
        date: request.decidedAt || request.updatedAt || request.endDate || request.createdAt,
        title: request.employee?.name || "",
        text: [
          ar ? (typeMeta?.ar || t(request.type)) : (typeMeta?.en || t(request.type)),
          `${formatDate(request.startDate, lang)} → ${formatDate(request.endDate, lang)}`,
          ar ? `${days} أيام` : `${days} days`,
          stationName(request.employee?.stationId),
        ].filter(Boolean).join(" · "),
        badge: st.label,
      };
    });
    return (
      <RecordSmartArchive
        items={archiveItems}
        lang={lang === "ar" ? "ar" : "en"}
        dir={ar ? "rtl" : "ltr"}
        emptyLabel={ar ? "لا طلبات إجازة مؤرشفة في هذا النطاق." : "No archived leave requests in this scope."}
      />
    );
  }

  const lvStats = [
    {
      value: String(pending.length),
      label: ar ? "بانتظار الرد في طلباتي" : "awaiting a reply in My Requests",
      warn: pending.length > 0,
    },
    {
      value: String(approved.length),
      label: ar ? "اعتُمدت" : "approved",
    },
    {
      value: String(rejected.length),
      label: ar ? "رُفضت بسبب مقيَّد" : "rejected with a recorded reason",
    },
    {
      value: String(pendingDays),
      label: ar ? "يوم إجازة بانتظار الاعتماد" : "leave days awaiting approval",
    },
  ];

  const headCell = {
    display: "grid",
    gridTemplateColumns: COLS,
    gap: "10px",
    padding: "10px 18px",
    background: SURFACE,
    borderBottom: "1px solid var(--nv-line)",
    fontSize: "10px",
    letterSpacing: "0.06em",
    color: MUTED,
    fontWeight: 600,
  };

  const rowCell = {
    display: "grid",
    gridTemplateColumns: COLS,
    gap: "10px",
    padding: "12px 18px",
    borderBottom: "1px solid var(--nv-line)",
    alignItems: "center",
  };

  const replyLink = {
    padding: "5px 13px",
    borderRadius: 10,
    border: "1px solid var(--nv-line)",
    background: CARD,
    color: NAVY,
    fontSize: "11px",
    fontWeight: 600,
    textDecoration: "none",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} dir={ar ? "rtl" : "ltr"}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(166px,1fr))", gap: "12px" }}>
        {lvStats.map((s) => (
          <div
            key={s.label}
            style={statCard}
          >
            <div
              dir="ltr"
              style={{
                fontFamily: "'IBM Plex Sans',sans-serif",
                fontSize: "24px",
                fontWeight: 600,
                lineHeight: 1,
                textAlign: "right",
                color: s.warn ? "var(--nv-warn-ink)" : NAVY,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "7px", lineHeight: 1.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <ChromeBox padded={false}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
                {ar ? "طلبات بانتظار القرار" : "Requests awaiting decision"}
              </div>
              <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px" }}>
                {ar
                  ? "الحالة هنا للعرض. الاعتماد والرفض من طلباتي — المادة 115 تُفحص هناك."
                  : "Status here is for viewing. Approve and reject live in My Requests — Article 115 is checked there."}
              </div>
            </div>
            <Link
              to="/app/requests/leave"
              style={{
                padding: "8px 15px",
                borderRadius: 10,
                border: "none",
                background: "var(--nv-btn-fill)",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 600,
                textDecoration: "none",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {ar ? "قدّم من طلباتي" : "Raise from My Requests"}
            </Link>
          </div>
        </div>

        {pending.length === 0 ? (
          <div style={{ ...emptyState, border: "none", borderRadius: 0 }}>
            {approved.length + rejected.length > 0
              ? (ar ? "لا طلبات بانتظار القرار — المكتملة في الأرشيف." : "Nothing awaiting a decision — decided requests are in the archive.")
              : t("noLeaveRequests")}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: "940px" }}>
              <div style={headCell}>
                <div>{ar ? "الموظف" : "EMPLOYEE"}</div>
                <div>{ar ? "الفرع" : "STATION"}</div>
                <div>{ar ? "نوع الإجازة" : "LEAVE TYPE"}</div>
                <div>{ar ? "الفترة" : "PERIOD"}</div>
                <div>{ar ? "الأيام" : "DAYS"}</div>
                <div>{ar ? "الرصيد بعد الاعتماد" : "BALANCE AFTER"}</div>
                <div>{ar ? "الحالة" : "STATUS"}</div>
                <div />
              </div>
              {pending.map((request) => {
                const typeMeta = (LEAVE_TYPES || []).find((x) => x.key === request.type);
                const days = Number(request.days) || computeLeaveDays(request.startDate, request.endDate);
                const attached = hasAttachment(request);
                const st = statusMeta(request.status || "pending", ar);
                const bal = request.balanceAfter
                  || request.balanceLabel
                  || (typeMeta?.requiresFile
                    ? (ar ? "بتقرير طبي" : "With medical report")
                    : "—");
                const balDir = /^[\d\s→—\-]+$/.test(String(bal)) ? "ltr" : "auto";
                const fileName = (request.files || []).find((file) => file?.name)?.name;
                const fileStyle = attached ? OK : (days > 5 ? BAD : NEUTRAL);
                const fileText = attached
                  ? (fileName || (ar ? "مرفق طبي/مستند" : "Document attached"))
                  : (ar ? "بلا مرفق" : "No attachment");

                return (
                  <div
                    key={`${request.employee.id}-${request.id}`}
                    style={rowCell}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--nv-soft)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <EmployeeIdentityRow
                        employee={request.employee}
                        employeeId={request.employee.id}
                        name={request.employee.name}
                        showId={false}
                        compact
                      />
                      <div style={{ marginTop: "4px" }}>
                        <span style={fileStyle}>{fileText}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", color: MUTED }}>{stationName(request.employee.stationId)}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: "12px", color: MUTED }}>
                        {ar ? (typeMeta?.ar || t(request.type)) : (typeMeta?.en || t(request.type))}
                      </span>
                      {typeMeta?.article ? <StatutoryItem article={typeMeta.article} ar={ar} entitlement /> : null}
                    </div>
                    <div dir="ltr" style={{ fontSize: "12px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right" }}>
                      {formatDate(request.startDate, lang)} → {formatDate(request.endDate, lang)}
                    </div>
                    <div style={{ fontSize: "12px", color: MUTED }}>
                      {ar ? countAr(days, "يوم واحد", "يومان", "أيام", "يوماً") : `${days} days`}
                    </div>
                    <div dir={balDir} style={{ fontSize: "12px", color: NAVY, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right" }}>
                      {bal}
                    </div>
                    <div>
                      <span style={st.style}>{st.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: "7px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <Link to={replyHref} style={replyLink}>
                        {requestReplyCopy(ar)}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ChromeBox>
    </div>
  );
}
