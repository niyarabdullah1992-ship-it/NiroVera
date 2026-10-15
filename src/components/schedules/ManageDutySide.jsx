import { getTodaysShift, todaysShiftEnded } from "@/lib/attendanceDerivations";
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { managedDutyEmployees } from "@/lib/dutyScope";
import { hydrateEmployeesLeave } from "@/lib/leaveDerivations";
import { listLocalTodayAttendance } from "@/lib/localAttendanceFallback";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { checkWeekPublishGates, formatWeekLabel, rosterTableStation, weekPublishState, weekStartDate } from "@/lib/shiftWeek";
import { calendarDateKey } from "@/lib/attendanceCalendar";
import { chip, mono, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import { ministryBadgeStyle, ministryBadgeText } from "@/components/schedules/MinistrySourceCards";
import { useComplianceSummary } from "@/components/schedules/ScheduleCompliancePanel";
import { complianceHref, openLinkStyle, TEAM_QUEUE_HREF } from "@/components/schedules/dutyLinks";
import { DUTY_REQUEST_META, pendingDutyRequests } from "@/lib/dutyRequests";

/**
 * The side column of every management duty page (حضور الفريق · جدول الدوام · السياسة والمواقع) —
 * the management twin of DutySide: same 340px column, same order on every page:
 *   «يحتاج قرارك» (what waits for you across the section, each row opens where it is handled)
 *   → «أنظمة الوزارة — ملخّص» (18632 · 3337 · نظام العمل counters, each opens the filtered panel)
 *   → page extras.
 */

/** The same rule as the strip badge: a broken link today — outside range, open checkout, early out, manual-punch ask. */
export function attendanceQueueCount(employees = [], rows = [], data = null) {
  const byId = Object.fromEntries((rows || []).map((row) => [String(row.employee_id ?? row.employeeId), row]));
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (employees || []).filter((employee) => {
    const row = byId[String(employee.id)];
    const asked = (employee.otherRequests || []).some((item) => item.type === "manual_punch" && (item.status || "pending") === "pending");
    // An open record counts only once the shift has ended (+1 h); without the roster, keep the old rule.
    const open = row?.check_in_at && !row?.check_out_at && row?.status !== "absent";
    const missing = open && (data ? todaysShiftEnded(getTodaysShift(data, employee), nowMin, 60) : true);
    return row?.location_status === "outside" || missing || !!row?.early_checkout || asked;
  }).length;
}

/** Leave, study consent, shift change, manual punch … — everything pending a manager's reply. */
export function pendingRequestCount(employees = []) {
  return (employees || []).reduce((sum, employee) => (
    sum
    + (employee.leaveRequests || []).filter((row) => (row.status || "pending") === "pending").length
    + (employee.otherRequests || []).filter((row) => (row.status || "pending") === "pending").length
  ), 0);
}

/** The managed people in header scope — the same list حضور الفريق shows. */
export function useManagedDutyPeople() {
  const { data, currentUser } = useAuth();
  const scope = useStationScope();
  return useMemo(() => {
    if (!data || !currentUser) return [];
    const fallback = data?.stations?.[0]?.id || null;
    return (managedDutyEmployees(currentUser, data) || []).filter((employee) => (
      matchesStationScope(employee.stationId || fallback, scope, data?.stations || [])
    ));
  }, [data, currentUser, scope]);
}

/** This week on the branch the manager edits — the same station جدول الدوام opens on. */
export function useManageDutyWeek({ ar = true } = {}) {
  const { data, currentUser } = useAuth();
  const headerScope = useStationScope();
  const weekStart = useMemo(() => weekStartDate(new Date()), []);
  return useMemo(() => {
    const stations = data?.stations || [];
    const table = rosterTableStation({
      lane: "manage",
      employee: currentUser,
      headerScope,
      stations,
      fallbackStationId: currentUser?.managedStations?.[0] || stations[0]?.id || null,
    });
    const stationId = table.stationId;
    const station = stations.find((row) => String(row.id) === String(stationId)) || null;
    const schedule = (data?.schedules || []).find((row) => String(row.stationId) === String(stationId))
      || { stationId, shiftTypes: [], assignments: {} };
    const employees = hydrateEmployeesLeave(data?.employees || [], data);
    const laborCalendar = laborCalendarOf(data);
    const gates = stationId
      ? checkWeekPublishGates({ schedule, employees, weekStart, stationId, station, settings: data?.settings, company: data, ar, laborCalendar })
      : null;
    return {
      stationId,
      station,
      stationName: table.stationName || "",
      schedule,
      employees,
      weekStart,
      laborCalendar,
      gates,
      pub: weekPublishState(schedule, weekStart),
    };
  }, [data, currentUser, headerScope, weekStart, ar]);
}

function OpenMark({ ar }) {
  return <span aria-hidden style={{ ...openLinkStyle(), padding: 0 }}>{ar ? "افتح ›" : "Open ›"}</span>;
}

function DecisionRow({ label, note, count, to, onClick, ar, dataKey }) {
  const tone = count ? "warn" : "ok";
  const inner = (
    <>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)", lineHeight: 1.5 }}>{label}</span>
        {note ? <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.6 }}>{note}</span> : null}
      </span>
      <span style={chip(tone, { flex: "none" })}>
        {count ? <span dir="ltr" style={mono}>{count}</span> : (ar ? "لا شيء" : "None")}
      </span>
      <OpenMark ar={ar} />
    </>
  );
  const rowStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 18px",
    textDecoration: "none",
    color: "inherit",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    background: "transparent",
    border: "none",
    borderBlockEnd: "1px solid var(--nv-line2, #EEF2F7)",
    fontFamily: "inherit",
    textAlign: "start",
    cursor: "pointer",
  };
  if (onClick) {
    return <button type="button" data-decision-row={dataKey} onClick={onClick} style={rowStyle}>{inner}</button>;
  }
  return <Link data-decision-row={dataKey} to={to} style={rowStyle}>{inner}</Link>;
}

function SourceRow({ card, ar, to, onClick, active }) {
  const inner = (
    <>
      <span style={ministryBadgeStyle(card.key, ar, { flex: "none" })}>{ministryBadgeText(card.key, ar)}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)", lineHeight: 1.45 }}>{card.short}</span>
        <span style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "var(--nv-muted)" }}>
          {[["block", ar ? "مانع" : "block", "bad"], ["warn", ar ? "تنبيه" : "alert", "warn"], ["settled", ar ? "مستوفى" : "met", "ok"]].map(([key, word, tone]) => (
            <span key={key} style={{ display: "inline-flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
              <strong dir="ltr" style={{ ...mono, fontSize: 12.5, color: card[key] ? `var(--nv-${tone}-ink)` : "var(--nv-ink3, var(--nv-muted))" }}>{card[key]}</strong>
              {word}
            </span>
          ))}
        </span>
      </span>
      <OpenMark ar={ar} />
    </>
  );
  const rowStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 18px",
    textDecoration: "none",
    color: "inherit",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    background: active ? "var(--nv-soft, #F7F8FA)" : "transparent",
    border: "none",
    borderBlockEnd: "1px solid var(--nv-line2, #EEF2F7)",
    borderInlineStart: `3px solid var(--nv-${card.tone}-fill)`,
    fontFamily: "inherit",
    textAlign: "start",
    cursor: "pointer",
  };
  if (onClick) {
    return <button type="button" data-source-row={card.key} aria-pressed={!!active} onClick={onClick} style={rowStyle}>{inner}</button>;
  }
  return <Link data-source-row={card.key} to={to} style={rowStyle}>{inner}</Link>;
}

/**
 * Presentational side column. Pass the counts you already have; the links are the same everywhere.
 * onQueue / onCompliance / onSource: in-page handlers (the page you are on) instead of navigating.
 */
export default function ManageDutySide({
  ar = true,
  queueCount = 0,
  blockers = 0,
  requests = 0,
  dutyRequests = 0,
  sourceCards = [],
  activeSource = "",
  stationName = "",
  weekStart,
  onQueue,
  onCompliance,
  onSource,
  hideQueue = false,
  children,
}) {
  void activeSource; void onSource; void SourceRow;
  const total = (queueCount && !hideQueue ? 1 : 0) + (blockers ? 1 : 0) + (requests ? 1 : 0) + (dutyRequests ? 1 : 0);
  const weekLine = [stationName, weekStart ? formatWeekLabel(weekStart, ar) : ""].filter(Boolean).join(" · ");
  return (
    <>
      <section data-manage-decisions="1" style={{ ...slab, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <SectionHead
          title={ar ? "يحتاج قرارك" : "Needs your decision"}
          note={ar ? "ما ينتظرك في القسم كله — كل صف يفتح مكان معالجته." : "What waits for you across the section — each row opens where it is handled."}
          trailing={<span style={chip(total ? "warn" : "ok")}>{total ? (ar ? "بانتظارك" : "Waiting") : (ar ? "لا شيء معلّق" : "All clear")}</span>}
        />
        {hideQueue ? null : <DecisionRow
          dataKey="queue"
          ar={ar}
          label={ar ? "بصمات اليوم بلا حكم" : "Today's punches without a verdict"}
          note={ar ? "خارج النطاق · بلا انصراف · طلب بصمة يدوية" : "Outside range · no checkout · manual-punch ask"}
          count={queueCount}
          to={TEAM_QUEUE_HREF}
          onClick={onQueue}
        />}
        {/* The ministry rules live in full under the roster (جدول الدوام); here only the count and the way there. */}
        {(() => {
          const sum = (key) => sourceCards.reduce((n, card) => n + (Number(card[key]) || 0), 0);
          const block = Math.max(blockers, sum("block"));
          const warn = sum("warn");
          const parts = [
            block ? (ar ? `${block} مانع` : `${block} block`) : "",
            warn ? (ar ? `${warn} تنبيه` : `${warn} alert`) : "",
          ].filter(Boolean).join(" · ");
          return (
            <DecisionRow
              dataKey="blockers"
              ar={ar}
              label={ar ? "أنظمة الوزارة — موانع وتنبيهات الجدول" : "Ministry rules — roster blocks and alerts"}
              note={[parts || (ar ? "لا مانع ولا تنبيه" : "No block or alert"), weekLine].filter(Boolean).join(" · ")}
              count={block + warn}
              to={complianceHref("all")}
              onClick={onCompliance}
            />
          );
        })()}
        <DecisionRow
          dataKey="duty-requests"
          ar={ar}
          label={ar ? "طلبات الدوام بانتظار ردّك" : "Duty requests awaiting you"}
          note={ar ? "استئذان · تغيير وردية · رضاعة · حمل · بلاغ عمل مكشوف" : "Permission · shift change · nursing · pregnancy · exposed-work report"}
          count={dutyRequests}
          to="/app/requests/manage"
        />
        <DecisionRow
          dataKey="requests"
          ar={ar}
          label={ar ? "طلبات أخرى بانتظار ردّك" : "Other requests awaiting your reply"}
          note={ar ? "إجازة · دراسة · بصمة يدوية · وثائق" : "Leave · study · manual punch · letters"}
          count={requests}
          to="/app/requests/manage"
        />
      </section>


      {children}
    </>
  );
}

/**
 * For حضور الفريق and السياسة والمواقع: compute this week's roster check and the section counts,
 * then render the same side column جدول الدوام shows.
 */
export function ManageDutySideAuto({ ar = true, queueCount, onQueue, hideQueue = false, children }) {
  const { data, company } = useAuth();
  const week = useManageDutyWeek({ ar });
  const people = useManagedDutyPeople();
  const summary = useComplianceSummary({
    gates: week.gates,
    company: data,
    onDate: week.weekStart ? calendarDateKey(week.weekStart) : undefined,
    weekStart: week.weekStart,
    employees: week.employees,
    ar,
  });
  const localQueue = useMemo(
    () => attendanceQueueCount(people, listLocalTodayAttendance(company?.id, data), data),
    [people, company?.id, data],
  );
  return (
    <ManageDutySide
      ar={ar}
      queueCount={typeof queueCount === "number" ? queueCount : localQueue}
      blockers={(week.gates?.blockers || []).length}
      requests={Math.max(0, pendingRequestCount(people) - pendingDutyRequests(people).length)}
      dutyRequests={pendingDutyRequests(people).length}
      sourceCards={week.gates ? summary.sourceCards : []}
      stationName={week.stationName}
      weekStart={week.weekStart}
      onQueue={onQueue}
      hideQueue={hideQueue}
    >
      {children}
    </ManageDutySide>
  );
}

/**
 * «كيف أستخدم هذا القسم؟» — one small fold at the bottom of each lane's first page. Three or four lines, no more.
 */
export function DutyHowTo({ ar = true, lines = [] }) {
  if (!lines.length) return null;
  return (
    <details data-duty-howto="1" className="nv-sched-fold" style={{ ...slab, padding: 0, overflow: "hidden" }}>
      <summary style={{ listStyle: "none", cursor: "pointer", padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, userSelect: "none" }}>
        <span className="nv-sched-fold-chevron" aria-hidden style={{ fontSize: 11, color: "var(--nv-muted)" }}>▸</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "كيف أستخدم هذا القسم؟" : "How do I use this section?"}</span>
      </summary>
      <ol style={{ margin: 0, padding: "0 18px 14px", paddingInlineStart: 36, display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, lineHeight: 1.8, color: "var(--nv-ink2)", textAlign: "start" }}>
        {lines.slice(0, 4).map((line, index) => <li key={index}>{line}</li>)}
      </ol>
    </details>
  );
}

/** جدول الدوام side card — pending duty requests of the people on this roster; each row opens the decision. */
export function PendingDutyRequestsCard({ ar = true, people = [] }) {
  const rows = pendingDutyRequests(people).slice(0, 8);
  if (!rows.length) return null;
  return (
    <section data-roster-duty-requests="1" style={{ ...slab, display: "flex", flexDirection: "column", overflow: "hidden", borderTop: "3px solid var(--nv-warn-fill)" }}>
      <SectionHead
        title={ar ? "طلبات الدوام المعلّقة" : "Pending duty requests"}
        note={ar ? "تمسّ هذا الجدول — قرّرها قبل النشر" : "They touch this roster — decide before publishing"}
        trailing={<span style={chip("warn")}><span dir="ltr" style={mono}>{rows.length}</span></span>}
      />
      {rows.map((row) => {
        const meta = DUTY_REQUEST_META[row.type] || {};
        return (
          <Link key={row.id} to="/app/requests/manage" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 18px", borderBlockEnd: "1px solid var(--nv-line2, #EEF2F7)", textDecoration: "none", color: "inherit" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)" }}>{row.employee?.name || "—"}</span>
              <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{[ar ? meta.ar : meta.en, row.date || row.dueDate || ""].filter(Boolean).join(" · ")}</span>
            </span>
            <OpenMark ar={ar} />
          </Link>
        );
      })}
    </section>
  );
}
