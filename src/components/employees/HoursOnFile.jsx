import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  SW,
  REST_STYLE,
  employeeFileHoursView,
  employeeShiftOnDay,
  employeeWeekHours,
  employeeWorkStationId,
  findStationById,
  formatWeekLabel,
  leaveOnDayView,
  shiftTypeStyle,
  rosterBranchPhrase,
  rosterMineScopeCopy,
  stationDisplayName,
  weekDays,
  weekStartDate,
  weekdayLabel,
} from "@/lib/shiftWeek";
import { useAuth } from "@/lib/PowerCareAuth";
import { canCreateTasks, hasHRPermission } from "@/lib/permissions";
import { isViewerOwnFile } from "@/lib/employeeFileView";
import FileHoursAlertsRail from "@/components/employees/FileHoursAlertsRail";
import NightMedicalFileField from "@/components/employees/NightMedicalFileField";
import { FileSelfBadge } from "@/components/employees/ProfileHero";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import StatutoryItem from "@/components/labor/StatutoryItem";
import { showStatutoryHeaderCite, statutoryGlowState } from "@/lib/statutoryItem";

const NASKH = "'Noto Naskh Arabic', 'Amiri', serif";

/**
 * This file's week and labour checks — never another night worker on the station.
 */
export default function HoursOnFile({ employee, data, lang = "ar" }) {
  const ar = lang === "ar";
  const { currentUser, data: authData } = useAuth();
  const [weekStart, setWeekStart] = useState(() => weekStartDate(new Date()));
  const isSelf = isViewerOwnFile(employee, currentUser);
  const canManageOtherRosters = !!(currentUser && (
    canCreateTasks(currentUser)
    || hasHRPermission(currentUser, authData || data, "manage_leave")
  ));
  const stationId = employeeWorkStationId(employee);
  const stationName = stationDisplayName(findStationById(data?.stations || [], stationId));
  const mineScope = rosterMineScopeCopy({ stationName, ar });
  const schedule = useMemo(
    () => (data?.schedules || []).find((row) => String(row.stationId) === String(stationId)) || { shiftTypes: [], assignments: {} },
    [data?.schedules, stationId],
  );
  const pack = useMemo(
    () => employeeFileHoursView({
      employee,
      schedule,
      weekStart,
      ar,
      coworkers: data?.employees || [],
      station: findStationById(data?.stations || [], stationId),
      settings: data?.settings,
      company: data,
      laborCalendar: data?.laborCalendar,
    }),
    [employee, schedule, weekStart, ar, data, stationId],
  );
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const roster = useMemo(
    () => (employee?.id ? [employee] : []),
    [employee],
  );
  const types = schedule?.shiftTypes || [];
  const thisWeek = formatWeekLabel(weekStart, ar);
  const blockers = pack.blockers.length;
  const branch = rosterBranchPhrase(stationName, ar);
  const boardTitle = branch
    ? (ar ? `جدول ${branch}` : `${stationName} roster`)
    : (ar ? "جدول الفرع" : "Branch roster");
  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: 16, color: SW.ink, fontSize: 13, fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <section className="nv-paper" style={{ background: "#fff", border: `1px solid ${SW.line}`, padding: "16px 18px", display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontFamily: NASKH, fontSize: 18, fontWeight: 600 }}>{boardTitle}</span>
          <span style={{ fontSize: 12, color: SW.mid, lineHeight: 1.8 }}>
            {stationId
              ? (
                <>
                  {mineScope.line}
                  {" "}
                  {ar
                    ? "فحوصات الساعات أدناه لهذا الملف فقط."
                    : "Hour checks below are for this file only."}
                  {canManageOtherRosters ? (
                    <>
                      {" "}
                      <Link to="/app/shifts?lane=manage" style={{ color: "inherit", fontWeight: 700 }}>
                        {mineScope.action}
                      </Link>
                    </>
                  ) : null}
                </>
              )
              : (ar
                ? "لا فرع عمل مسجّل على هذا الملف — لا جدول يُعرض حتى يُربط الملف بفرع."
                : "No work branch is on this file — no roster until the file is linked to a station.")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", border: `1px solid ${SW.line}`, borderRadius: 10, overflow: "hidden" }}>
          <button type="button" onClick={() => setWeekStart(weekStartDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7)))} style={{ fontFamily: "inherit", padding: "9px 12px", border: "none", background: "#fff", color: SW.mid, cursor: "pointer" }}>{ar ? "›" : "‹"}</button>
          <span style={{ padding: "7px 14px", borderInline: `1px solid ${SW.line}`, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{thisWeek}</span>
          <button type="button" onClick={() => setWeekStart(weekStartDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7)))} style={{ fontFamily: "inherit", padding: "9px 12px", border: "none", background: "#fff", color: SW.mid, cursor: "pointer" }}>{ar ? "‹" : "›"}</button>
        </div>
      </section>

      <div className="nv-ops-cal-board">
      <section className="nv-paper" style={{ background: "#fff", border: `1px solid ${SW.line}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${SW.soft}`, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{boardTitle}</span>
          <span style={{ fontSize: 11, color: SW.muted }}>
            {ar
              ? `${pack.hours} ساعة لهذا الملف هذا الأسبوع`
              : `${pack.hours} h for this file this week`}
          </span>
        </div>
        {!stationId ? (
          <div style={{ padding: "16px 18px", fontSize: 13, color: SW.mid, lineHeight: 1.8 }}>
            {ar ? "اربط الملف بفرع عمل حتى يظهر جدول الفرع." : "Link the file to a work branch to show the roster."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(96px,1.1fr) repeat(7,minmax(72px,1fr))", gap: 1, background: SW.soft, borderBottom: `1px solid ${SW.line}`, minWidth: 640 }}>
              <span style={{ background: SW.wash, padding: "9px 10px", fontSize: 11, color: SW.muted }}>{ar ? "الموظف" : "Employee"}</span>
              {days.map((day) => (
                <span key={day.key} style={{ background: SW.wash, padding: "9px 4px", textAlign: "center", display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: day.weekend ? SW.muted : SW.mid }}>{weekdayLabel(day.wd, ar)}</span>
                  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: SW.muted }}>{day.day}</span>
                </span>
              ))}
            </div>
            {roster.length === 0 && (
              <div style={{ padding: "16px 18px", fontSize: 13, color: SW.mid, lineHeight: 1.8 }}>
                {stationName
                  ? (ar ? `لا موظفون على جدول فرع ${stationName} هذا الأسبوع.` : `Nobody is on the ${stationName} roster this week.`)
                  : (ar ? "لا موظفون على هذا الجدول." : "Nobody is on this roster.")}
              </div>
            )}
            {roster.map((row) => {
              const mine = row.id === employee?.id;
              const hours = employeeWeekHours(schedule, row.id, weekStart, row);
              return (
                <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(96px,1.1fr) repeat(7,minmax(72px,1fr))", gap: 1, background: SW.soft, borderBottom: `1px solid ${SW.row}`, minWidth: 640 }}>
                  <span style={{ background: mine ? SW.greenBg : SW.card, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 1, minWidth: 0, borderInlineStart: mine ? `3px solid ${SW.green}` : "3px solid transparent" }}>
                    <span
                      style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {row.name}{mine && isSelf ? <>{" "}<FileSelfBadge ar={ar} kind="file" /></> : null}
                    </span>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: SW.muted }}>{hours} {ar ? "س" : "h"}</span>
                  </span>
                  {days.map((day) => {
                    const leave = leaveOnDayView(row, day.key, ar);
                    const shift = leave ? null : employeeShiftOnDay(schedule, row.id, day.key);
                    const style = leave ? leave.style : (shift ? shiftTypeStyle(shift, types.findIndex((item) => item.id === shift.id)) : REST_STYLE);
                    return (
                      <div
                        key={`${row.id}-${day.key}`}
                        title={`${row.name} — ${day.key} — ${leave ? leave.type : (shift ? `${shift.label} ${shift.start}` : (ar ? "راحة" : "Rest"))}`}
                        style={{
                          background: style.bg,
                          color: style.fg,
                          padding: "7px 2px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 1,
                          minHeight: 44,
                          justifyContent: "center",
                          outline: mine ? `1px solid ${SW.greenBd}` : "none",
                          outlineOffset: -1,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{leave ? leave.type : (shift ? shift.label : (ar ? "راحة" : "Rest"))}</span>
                        {leave?.articleId ? (
                          <StatutoryItem article={leave.articleId} ar={ar} entitlement compact surface="leave" />
                        ) : (
                          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, opacity: 0.85 }}>
                            {shift ? shift.start : ""}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
        {types.length > 0 && (
          <div style={{ padding: "10px 16px", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            {types.map((shift, index) => {
              const style = shiftTypeStyle(shift, index);
              return (
                <span key={shift.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: SW.mid }}>
                  <span style={{ width: 11, height: 11, background: style.bg, border: `1px solid ${style.color}` }} />
                  {shift.label}
                </span>
              );
            })}
          </div>
        )}
      </section>

        <FileHoursAlertsRail
          employee={employee}
          schedule={schedule}
          weekStart={weekStart}
          currentUser={currentUser}
          lang={lang}
          laborCalendar={data?.laborCalendar}
        />
      </div>

      <section className="nv-paper" style={{ background: "#fff", border: `1px solid ${SW.line}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${SW.soft}`, display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "فحوصات هذا الملف" : "Checks on this file"}</span>
            <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.7 }}>
              {ar
                ? `${pack.hours} ساعة هذا الأسبوع · تغطية الصباح وامتلاء الجدول يبقيان في جدول الدوام.`
                : `${pack.hours} hours this week · morning coverage and an empty roster stay on the duty board.`}
            </span>
          </div>
          <span style={{
            marginInlineStart: "auto",
            fontSize: 11,
            fontWeight: 600,
            color: blockers ? SW.abs : pack.warnings.length ? SW.gold : SW.green,
            background: blockers ? SW.absBg : pack.warnings.length ? SW.goldBg : SW.greenBg,
            border: `1px solid ${blockers ? SW.absBd : pack.warnings.length ? SW.goldBd : SW.greenBd}`,
            padding: "6px 11px",
            borderRadius: 999,
          }}>
            {blockers
              ? (ar ? `${blockers} مانع على الملف` : `${blockers} blockers on the file`)
              : pack.warnings.length
                ? (ar ? `${pack.warnings.length} تنبيه على الملف` : `${pack.warnings.length} alerts on the file`)
                : pack.published
                  ? (ar ? "الفحوصات مستوفاة" : "Checks clear")
                  : (ar ? "مسودة — لم يُنشر الأسبوع" : "Draft — week not published")}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))" }}>
          {pack.checks.map((check) => (
            <div key={check.id} style={{ padding: "13px 18px", borderInlineStart: `1px solid ${SW.hair}`, borderBottom: `1px solid ${SW.hair}`, display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 10, alignItems: "start" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: check.ok ? SW.greenDot : check.block ? SW.abs : SW.goldDot, marginTop: 6 }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, minWidth: 0, width: "100%" }}>
                {(() => {
                  const glow = check.ruleId ? statutoryGlowState({
                    kind: check.ruleId,
                    employee,
                    schedule,
                    weekStart,
                    laborCalendar: data?.laborCalendar,
                    failing: !check.ok,
                  }) : "off";
                  const showEssay = !!(check.ruleId && showStatutoryHeaderCite(glow, { ok: check.ok, failing: !check.ok }));
                  return (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: check.ok ? SW.ink : check.block ? SW.abs : SW.gold, lineHeight: 1.5 }}>{check.title}</span>
                        {check.ruleId ? (
                          <LaborArticleCite
                            ruleId={check.ruleId}
                            ar={ar}
                            tone={check.block && !check.ok ? "block" : (!check.ok ? "warn" : undefined)}
                            glow={glow}
                          />
                        ) : null}
                      </div>
                      {showEssay ? (
                        <LaborArticleCite
                          ruleId={check.ruleId}
                          ar={ar}
                          showText
                          showChip={false}
                          tone={check.block && !check.ok ? "block" : (!check.ok ? "warn" : undefined)}
                          glow={glow}
                        />
                      ) : null}
                    </>
                  );
                })()}
                <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.8 }}>{check.note}</span>
                {check.id === "night_medical" && !check.ok ? (
                  <NightMedicalFileField
                    employee={employee}
                    canRead={isSelf || canManageOtherRosters}
                    ar={ar}
                    compact
                    unmet
                    requestsHref={isSelf ? "/app/requests" : "/app/requests/manage"}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
