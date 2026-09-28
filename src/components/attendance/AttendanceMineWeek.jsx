import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { employeeScheduledOn, hasPublishedScheduleOn } from "@/lib/attendanceCalendar";
import { employeeShiftOnDay, isWeekDayPublished } from "@/lib/shiftWeek";
import { formatTime, useTimeFormat } from "@/hooks/useTimeFormat";
import { isStatutoryOffDay } from "@/lib/leaveTypes";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { listLocalRangeAttendance, mergeAttendanceRangeRows } from "@/lib/localAttendanceFallback";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { toWesternDigits } from "@/lib/dateFormat";
import { BORDER, CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

const DAY_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATE = {
  present: { ar: "حضرت في الوقت", en: "On time", tone: "ok" },
  late: { ar: "حضرت — متأخر", en: "Late", tone: "warn" },
  leave: { ar: "إجازة معتمدة", en: "Approved leave", tone: "idle" },
  absent: { ar: "غائب", en: "Absent", tone: "bad" },
  rest: { ar: "راحة", en: "Off", tone: "idle" },
  unscheduled: { ar: "بلا جدول", en: "No roster", tone: "idle" },
  open: { ar: "حضور بلا انصراف", en: "Open", tone: "warn" },
  pending: { ar: "لم يُسجَّل", en: "Not punched", tone: "warn" },
  manual: { ar: "اعتُمد يدوياً", en: "Manual", tone: "ok" },
};

const PILL = {
  ok: { background: "var(--nv-ok-soft)", color: "var(--nv-ok-ink)", border: "1px solid var(--nv-ok-line)" },
  warn: { background: "var(--nv-warn-soft)", color: "var(--nv-warn-ink)", border: "1px solid var(--nv-warn-line)" },
  bad: { background: "var(--nv-bad-soft)", color: "var(--nv-bad-ink)", border: "1px solid var(--nv-bad-line)" },
  idle: { background: "var(--nv-soft)", color: "var(--nv-ink2)", border: "1px solid var(--nv-line)" },
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

  const calendar = laborCalendarOf(data);
  const table = days.map(({ date, key }) => {
    const row = byDate[key];
    const off = isStatutoryOffDay(employee, key, calendar);
    const scheduled = employeeScheduledOn(data?.schedules, employee.id, key);
    const published = hasPublishedScheduleOn(data?.schedules, key);
    const schedule = (data?.schedules || []).find((row) => String(row.stationId) === String(employee?.stationId || data?.stations?.[0]?.id)) || null;
    const rosterLive = schedule ? isWeekDayPublished(schedule, key) : published;
    const shift = off ? null : employeeShiftOnDay(schedule, employee.id, key);
    const inAt = row?.check_in_at || row?.checkInAt;
    const outAt = row?.check_out_at || row?.checkOutAt;
    const lateMinutes = Number(row?.late_minutes || row?.lateMinutes || 0);
    const manual = !!(row?.manual_override || row?.location_status === "manual" || row?.override_by);
    let kind = "rest";
    let note = ar ? "لا وردية منشورة." : "No published shift.";
    if (off && !inAt) {
      kind = "leave";
      note = off.kind === "official"
        ? (ar ? `${off.labelAr} — خارج حساب الحضور (المادة 112)` : `${off.labelEn} — outside attendance (Article 112)`)
        : (ar ? "إجازة معتمدة — خارج حساب الحضور" : "Approved leave — outside attendance.");
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
    } else if (!rosterLive && !scheduled) {
      kind = "unscheduled";
      note = ar ? "لا وردية منشورة." : "No published shift.";
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
      day: dayNames[date.getDay()],
      shift: shift?.label || "—",
      in: inAt ? toWesternDigits(formatTime(inAt, format, "en-GB")) : "—",
      out: outAt ? toWesternDigits(formatTime(outAt, format, "en-GB")) : "—",
      state: ar ? state.ar : state.en,
      tone: state.tone,
      note,
    };
  });

  const lateCount = table.filter((row) => row.tone === "warn" && /تأخ|Late/.test(row.state)).length;
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
        <Link to="/app/calendar" style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 600, color: "var(--nv-ok-ink)", textDecoration: "none", whiteSpace: "nowrap" }}>
          {ar ? "الشهر كامل في التقويم ←" : "Full month on the calendar →"}
        </Link>
      </div>
      <div className="nv-att-mine-grid" style={{ padding: "10px 20px", fontSize: 11, color: MUTED, background: SURFACE, borderBottom: `1px solid ${BORDER}` }}>
        <span>{ar ? "اليوم" : "Day"}</span>
        <span>{ar ? "الوردية" : "Shift"}</span>
        <span>{ar ? "حضور" : "In"}</span>
        <span>{ar ? "انصراف" : "Out"}</span>
        <span>{ar ? "الحالة" : "Status"}</span>
      </div>
      {table.map((row) => (
        <div key={row.key} className="nv-att-mine-grid" style={{ padding: "11px 20px", alignItems: "center", borderBottom: `1px solid ${BORDER}` }} title={row.note || undefined}>
          <span style={{ fontSize: 12, fontWeight: 600, color: NAVY, whiteSpace: "nowrap" }}>{row.day}</span>
          <span style={{ fontSize: 12, color: NAVY }}>{row.shift}</span>
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: NAVY }}>{row.in}</span>
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: NAVY }}>{row.out}</span>
          <span style={{ ...PILL[row.tone] || PILL.idle, display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", width: "fit-content" }}>{row.state}</span>
        </div>
      ))}
      <div style={{ padding: "13px 20px" }}>
        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
          {ar
            ? `في هذه الأيام: ${lateCount} تأخير · ${manualCount} اعتماد يدوي. الأرقام من السجل نفسه الذي يقرأه المسير.`
            : `In these days: ${lateCount} late · ${manualCount} manual approvals. The same register payroll reads.`}
        </span>
      </div>
    </section>
  );
}
