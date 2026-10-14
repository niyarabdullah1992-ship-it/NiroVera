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
import { weeklyOffLabels, weeklyRestDayCountOf } from "@/lib/leaveEidOverlap.js";
import { updateEmployeeProfile } from "@/lib/store";

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
  const { currentUser, data: authData, company, refresh } = useAuth();
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

      <div style={{ borderTop: "1px solid var(--nv-line2)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink)" }}>
          {ar ? "راحة الأسبوع — لهذا الموظف" : "Weekly rest — this employee"}
        </span>
        <span style={{ fontSize: 11.5, color: SW.muted, lineHeight: 1.75 }}>
          {weeklyOffLabels(company, employee, ar).map((row) => row.title).join(ar ? " · " : " · ")
            || (ar ? "لا يوم راحة مسمّى." : "No named rest day.")}
        </span>
        {canManage ? (
          <label style={{ fontSize: 11.5, color: "var(--nv-ink2)", display: "flex", flexDirection: "column", gap: 4 }}>
            {ar ? "عدد أيام الراحة على الملف" : "Rest days on this file"}
            <select
              value={(() => {
                const n = Number(employee?.profile?.weeklyRestDayCount);
                return n === 1 || n === 2 ? String(n) : "";
              })()}
              onChange={(e) => {
                if (!company?.id || !employee?.id) return;
                const raw = e.target.value;
                updateEmployeeProfile(company.id, employee.id, {
                  weeklyRestDayCount: raw === "1" || raw === "2" ? Number(raw) : "",
                });
                refresh?.();
              }}
              style={{
                fontFamily: "inherit",
                fontSize: 12,
                padding: "8px 10px",
                border: "1px solid var(--nv-line)",
                borderRadius: 10,
                background: "var(--nv-card)",
                color: "var(--nv-ink)",
              }}
            >
              <option value="">
                {ar
                  ? `يتبع المنشأة (${weeklyRestDayCountOf(company) === 1 ? "يوم نظامي واحد" : "يومان"})`
                  : `Follow establishment (${weeklyRestDayCountOf(company) === 1 ? "one statutory day" : "two days"})`}
              </option>
              <option value="2">{ar ? "يومان — نظامي + راحة الشركة (خمسة دوام)" : "Two — statutory + company rest (five-day week)"}</option>
              <option value="1">{ar ? "يوم واحد — راحة المادة 104 فقط (ستة دوام)" : "One — Article 104 rest only (six-day week)"}</option>
            </select>
          </label>
        ) : (
          <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.7 }}>
            {weeklyRestDayCountOf(company, employee) === 1
              ? (ar ? "دوام ستة أيام — يُخصم السبت إن طُلبت سنوية فيه." : "Six-day week — Saturday annual leave is charged.")
              : (ar ? "دوام خمسة أيام — الجمعة والسبت لا يُخصمان من السنوية." : "Five-day week — Friday and Saturday are not charged to annual leave.")}
          </span>
        )}
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
