import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  SW,
  employeeWeekHours,
  employeeWorkStationId,
  findStationById,
  stationDisplayName,
  weekStartDate,
} from "@/lib/shiftWeek";
import { useAuth } from "@/lib/PowerCareAuth";
import { isViewerOwnFile } from "@/lib/employeeFileView";
import NightMedicalFileField from "@/components/employees/NightMedicalFileField";
import { nightMedicalReportOf } from "@/lib/decision18632";
import { canCreateTasks, hasHRPermission } from "@/lib/permissions";

const paper = {
  background: "var(--nv-card)",
  border: "1px solid var(--nv-line)",
  borderRadius: 14,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxShadow: "var(--nv-paper)",
  padding: "16px 18px",
  gap: 10,
};

/**
 * File surface: no week-gate board (الجدول owns hours / night / heat publish checks).
 * Only file-held night fitness notice + pointer to the schedule.
 */
export default function HoursOnFile({ employee, data, lang = "ar" }) {
  const ar = lang === "ar";
  const { currentUser, data: authData } = useAuth();
  const isSelf = isViewerOwnFile(employee, currentUser);
  const canManage = !!(currentUser && (
    canCreateTasks(currentUser)
    || hasHRPermission(currentUser, authData || data, "manage_leave")
  ));
  const stationId = employeeWorkStationId(employee);
  const stationName = stationDisplayName(findStationById(data?.stations || [], stationId));
  const schedule = useMemo(
    () => (data?.schedules || []).find((row) => String(row.stationId) === String(stationId)) || { shiftTypes: [], assignments: {} },
    [data?.schedules, stationId],
  );
  const weekStart = useMemo(() => weekStartDate(new Date()), []);
  const hours = employee?.id ? employeeWeekHours(schedule, employee.id, weekStart, employee) : 0;
  const medical = nightMedicalReportOf(employee);
  const shiftsHref = isSelf ? "/app/shifts?lane=mine" : "/app/shifts?lane=manage";

  return (
    <section dir={ar ? "rtl" : "ltr"} className="nv-paper" style={paper}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--nv-ink)" }}>
          {ar ? "الساعات من الجدول" : "Hours from the schedule"}
        </span>
        <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.75 }}>
          {ar
            ? "فحوصات الأسبوع والليل والحرارة أساسها الجدول والدوام — لا تُكرَّر هنا. الملف يحتفظ بما يُسجَّل عليه فقط."
            : "Week, night, and heat checks live on Schedule & attendance — not repeated here. The file keeps only what is written on it."}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.6 }}>
          {stationName
            ? (ar ? `${stationName} · ${hours} ساعة هذا الأسبوع` : `${stationName} · ${hours} h this week`)
            : (ar ? "لا فرع عمل على هذا الملف بعد." : "No work branch on this file yet.")}
        </span>
        <Link
          to={shiftsHref}
          style={{
            marginInlineStart: "auto",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--nv-accent, #1E9E63)",
            textDecoration: "none",
          }}
        >
          {ar ? "افتح الجدول ←" : "Open schedule →"}
        </Link>
      </div>

      {!medical?.url ? (
        <div style={{ borderTop: "1px solid var(--nv-line2)", paddingTop: 10 }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--nv-ink)", marginBottom: 4 }}>
            {ar ? "لياقة ليلية على الملف — القرار 18632" : "Night fitness on file — Decision 18632"}
          </span>
          <NightMedicalFileField
            employee={employee}
            canRead={isSelf || canManage}
            ar={ar}
            compact
            unmet
            requestsHref={isSelf ? "/app/requests" : "/app/requests/manage"}
          />
        </div>
      ) : null}
    </section>
  );
}
