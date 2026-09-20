import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { employeeScheduledOn, hasPublishedScheduleOn } from "@/lib/attendanceCalendar";
import { formatTime, useTimeFormat } from "@/hooks/useTimeFormat";
import { isOnApprovedLeave } from "@/lib/leaveTypes";
import { listLocalRangeAttendance, mergeAttendanceRangeRows } from "@/lib/localAttendanceFallback";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { toWesternDigits } from "@/lib/dateFormat";
import { BORDER, CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";
import AppliedLawList from "@/components/shared/AppliedLawList";

const DAY_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATE = {
  present: { ar: "حضر في الوقت", en: "On time", color: "#137a49" },
  late: { ar: "متأخر", en: "Late", color: "#8a6516" },
  leave: { ar: "إجازة", en: "Leave", color: "#1D4ED8" },
  absent: { ar: "غائب", en: "Absent", color: "#8a1c2b" },
  rest: { ar: "راحة", en: "Off", color: "#5A6B85" },
  open: { ar: "مفتوح", en: "Open", color: "#8a6516" },
  pending: { ar: "لم يُسجَّل", en: "Not punched", color: "#8a6516" },
  manual: { ar: "اعتُمد يدوياً", en: "Manual", color: NAVY },
};

function lastDays(count, endKey) {
  const [y, m, d] = String(endKey).split("-").map(Number);
  const end = new Date(y, m - 1, d);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end.getFullYear(), end.getMonth(), end.getDate() - index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date, key };
  });
}

export default function AttendanceMineWeek({ employee, company, data, lang = "ar" }) {
  const ar = lang === "ar";
  const { format } = useTimeFormat();
  const [rows, setRows] = useState([]);
  const todayKey = toRiyadhDateKey();
  const days = useMemo(() => lastDays(7, todayKey), [todayKey]);
  const startDate = days[days.length - 1].key;
  const endDate = days[0].key;

  useEffect(() => {
    if (!employee?.id) return;
    const local = listLocalRangeAttendance(company?.id, startDate, endDate, data);
    if (isLocalPreviewActive() || !company?.id) {
      setRows(local);
      return;
    }
    base44.functions
      .invoke("supabaseAttendance", { action: "listRange", employeeId: employee.id, startDate, endDate })
      .then((res) => setRows(mergeAttendanceRangeRows(res?.data?.rows || [], local)))
      .catch(() => setRows(local));
  }, [employee?.id, company?.id, startDate, endDate, data]);

  const byDate = Object.fromEntries(
    rows.map((row) => [String(row.date || row.dateKey || "").slice(0, 10), row]),
  );

  const table = days.map(({ date, key }) => {
    const row = byDate[key];
    const onLeave = isOnApprovedLeave(employee, key);
    const scheduled = employeeScheduledOn(data?.schedules, employee.id, key);
    const published = hasPublishedScheduleOn(data?.schedules, key);
    const inAt = row?.check_in_at || row?.checkInAt;
    const outAt = row?.check_out_at || row?.checkOutAt;
    const lateMinutes = Number(row?.late_minutes || row?.lateMinutes || 0);
    const manual = !!(row?.manual_override || row?.location_status === "manual" || row?.override_by);
    let kind = "rest";
    let note = ar ? "لا وردية منشورة." : "No published shift.";
    if (onLeave) {
      kind = "leave";
      note = ar ? "إجازة معتمدة — خارج حساب الحضور" : "Approved leave — outside attendance.";
    } else if (inAt && !outAt) {
      kind = "open";
      note = ar ? "حضور بلا انصراف." : "Checked in with no checkout.";
    } else if (manual && inAt) {
      kind = "manual";
      note = ar ? "اعتمده المدير يدوياً." : "Approved manually by a manager.";
    } else if (row?.status === "late" || lateMinutes > 0) {
      kind = "late";
      note = ar
        ? `${lateMinutes} دقيقة بعد بداية الوردية`
        : `${lateMinutes} minutes after shift start`;
    } else if (inAt) {
      kind = "present";
      note = "";
    } else if (scheduled || (published && key < todayKey)) {
      kind = key === todayKey ? "rest" : "absent";
      note = scheduled
        ? (key === todayKey ? (ar ? "مجدول اليوم — لم يُسجَّل بعد." : "Scheduled today — not punched yet.") : (ar ? "مجدول ولم يسجّل." : "Scheduled and did not punch."))
        : note;
      if (key === todayKey && scheduled) kind = "pending";
    } else if (!published) {
      kind = "rest";
    }
    const state = STATE[kind] || STATE.rest;
    const dayNames = ar ? DAY_AR : DAY_EN;
    return {
      key,
      day: `${dayNames[date.getDay()]} ${date.getDate()}`,
      in: inAt ? toWesternDigits(formatTime(inAt, format, "en-GB")) : "—",
      out: outAt ? toWesternDigits(formatTime(outAt, format, "en-GB")) : "—",
      state: ar ? state.ar : state.en,
      color: state.color,
      note,
    };
  });

  const lateCount = table.filter((row) => row.state === (ar ? "متأخر" : "Late")).length;
  const manualCount = table.filter((row) => row.state === (ar ? "اعتُمد يدوياً" : "Manual")).length;

  return (
    <section className="nv-att-card" style={{ background: CARD, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }} dir={ar ? "rtl" : "ltr"}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "كشفي" : "My register"}</span>
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
            {ar ? "آخر سبعة أيام مسجّلة — التأخير يُقاس من بداية الوردية المنشورة." : "Last seven recorded days — lateness is measured from the published shift start."}
          </span>
        </div>
        <Link to="/app/calendar" style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 600, color: "#137a49", textDecoration: "none", whiteSpace: "nowrap" }}>
          {ar ? "الشهر كامل في التقويم ←" : "Full month on the calendar →"}
        </Link>
      </div>
      <div className="nv-att-mine-grid" style={{ padding: "10px 20px", fontSize: 11, color: MUTED, background: SURFACE, borderBottom: `1px solid ${BORDER}` }}>
        <span>{ar ? "اليوم" : "Day"}</span>
        <span>{ar ? "حضور" : "In"}</span>
        <span>{ar ? "انصراف" : "Out"}</span>
        <span>{ar ? "الحالة" : "Status"}</span>
        <span>{ar ? "ملاحظة" : "Note"}</span>
      </div>
      {table.map((row) => (
        <div key={row.key} className="nv-att-mine-grid" style={{ padding: "11px 20px", alignItems: "center", borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: NAVY, whiteSpace: "nowrap" }}>{row.day}</span>
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: NAVY }}>{row.in}</span>
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: NAVY }}>{row.out}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: row.color, whiteSpace: "nowrap" }}>{row.state}</span>
          <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7, minWidth: 0 }}>{row.note}</span>
        </div>
      ))}
      <div style={{ padding: "13px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
          {ar
            ? `في هذه الأيام: ${lateCount} تأخير · ${manualCount} اعتماد يدوي. الأرقام من السجل نفسه الذي يقرأه المسير.`
            : `In these days: ${lateCount} late · ${manualCount} manual approvals. The same register payroll reads.`}
        </span>
        <AppliedLawList
          ruleIds={["hours.week.ordinaryMaxHours", "hours.rest.weeklyHours"]}
          ar={ar}
        />
      </div>
    </section>
  );
}
