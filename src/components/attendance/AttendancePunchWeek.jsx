import React, { useEffect, useMemo, useState } from "react";
import { listLocalRangeAttendance, mergeAttendanceRangeRows } from "@/lib/localAttendanceFallback";
import { base44 } from "@/api/base44Client";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import {
  employeeShiftOnDay,
  employeeWeekHours,
  leaveOnDayView,
  weekDateKeys,
  weekDays,
  weekStartDate,
} from "@/lib/shiftWeek";
import { BORDER, CARD, MUTED } from "@/lib/platformStyles";

const DAY_AR = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const DAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DOT = {
  ok: "var(--nv-ok-fill, #3C7D50)",
  late: "var(--nv-warn-fill, #C8A45A)",
  off: "var(--nv-mute-fill, #C5CEC9)",
  future: "transparent",
  today: "transparent",
};

function hmLabel(hours) {
  if (!hours) return "—";
  const whole = Math.floor(hours);
  const mins = Math.round((hours - whole) * 60);
  return `${whole}:${String(mins).padStart(2, "0")}`;
}

/** Seven real days for the signed-in employee — no sample people. */
export default function AttendancePunchWeek({ employee, company, data, lang = "ar" }) {
  const ar = lang === "ar";
  const todayKey = toRiyadhDateKey();
  const weekStart = weekStartDate(new Date());
  const days = weekDays(weekStart);
  const keys = weekDateKeys(weekStart);
  const calendar = laborCalendarOf(data);
  const schedule = (data?.schedules || []).find((row) => String(row.stationId) === String(employee?.stationId || data?.stations?.[0]?.id))
    || (data?.schedules || [])[0]
    || null;
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!employee?.id) return;
    const start = keys[0];
    const end = keys[6];
    const local = listLocalRangeAttendance(company?.id, start, end, data);
    if (isLocalPreviewActive() || !company?.id) {
      setRows(local);
      return;
    }
    base44.functions
      .invoke("supabaseAttendance", { action: "listRange", employeeId: employee.id, startDate: start, endDate: end })
      .then((res) => setRows(mergeAttendanceRangeRows(res?.data?.rows || [], local)))
      .catch(() => setRows(local));
  }, [employee?.id, company?.id, keys[0], keys[6], data]);

  const byDate = useMemo(() => Object.fromEntries(
    rows.map((row) => [String(row.date || row.dateKey || "").slice(0, 10), row]),
  ), [rows]);

  const weekHours = employee?.id ? employeeWeekHours(schedule, employee.id, weekStart, employee, calendar) : 0;
  const cap = 48;
  const cells = days.map((day) => {
    const leave = employee ? leaveOnDayView(employee, day.key, ar, calendar) : null;
    const shift = leave || !employee?.id ? null : employeeShiftOnDay(schedule, employee.id, day.key);
    const row = byDate[day.key];
    const punched = !!(row?.check_in_at || row?.checkInAt);
    const late = row?.status === "late" || Number(row?.late_minutes || row?.lateMinutes || 0) > 0;
    const future = day.key > todayKey;
    let tone = "off";
    if (future && !leave) tone = shift ? "future" : "off";
    else if (leave || !shift) tone = "off";
    else if (day.key === todayKey && !punched) tone = "today";
    else if (late) tone = "late";
    else if (punched) tone = "ok";
    else tone = "off";
    const hours = leave || !shift
      ? "—"
      : (day.key === todayKey && !punched ? "—" : hmLabel(hoursFromShift(shift)));
    const names = ar ? DAY_AR : DAY_EN;
    return {
      key: day.key,
      name: names[day.wd] || names[0],
      hours,
      tone,
      today: day.key === todayKey,
    };
  });

  return (
    <section
      className="nv-att-card"
      dir={ar ? "rtl" : "ltr"}
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontSize: 14, color: "var(--nv-ink)" }}>{ar ? "أسبوعي" : "This week"}</strong>
        <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 12, color: "var(--nv-ok-ink, #2F6B43)" }}>
          {weekHours ? weekHours.toFixed(1) : "0.0"} / {cap} {ar ? "س" : "h"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
        {cells.map((day) => (
          <div
            key={day.key}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              padding: "8px 2px",
              borderRadius: 9,
              background: day.today ? "var(--nv-ok-soft, #E6F2EA)" : "transparent",
              border: day.today ? "1px solid var(--nv-ok-line, #C5CEC9)" : "1px solid var(--nv-line2, #EEF1EF)",
            }}
          >
            <span style={{ fontSize: 10.5, color: MUTED }}>{day.name}</span>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: DOT[day.tone] || DOT.off,
                border: day.tone === "future"
                  ? "1.5px solid var(--nv-mute-fill, #C5CEC9)"
                  : day.tone === "today"
                    ? "2px dashed var(--nv-ok-fill, #3C7D50)"
                    : "none",
                boxSizing: "border-box",
              }}
            />
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 10.5, color: "var(--nv-ink2)" }}>{day.hours}</span>
          </div>
        ))}
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--nv-line2, #EEF1EF)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, Math.round((weekHours / cap) * 100))}%`, background: "var(--nv-ok-fill, #3C7D50)", borderRadius: 999 }} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 10.5, color: MUTED }}>
        <span style={{ color: "var(--nv-ok-ink)" }}>{ar ? "● في الوقت" : "● On time"}</span>
        <span style={{ color: "var(--nv-warn-ink)" }}>{ar ? "● تأخّر" : "● Late"}</span>
        <span>{ar ? "● راحة أو إجازة" : "● Rest or leave"}</span>
        <span style={{ whiteSpace: "nowrap" }}>{ar ? "الحدّ 48 س · المادة 98" : "Cap 48 h · Art. 98"}</span>
      </div>
    </section>
  );
}

function hoursFromShift(shift) {
  if (!shift?.start || !shift?.end) return 0;
  const [ah, am] = String(shift.start).split(":").map(Number);
  const [bh, bm] = String(shift.end).split(":").map(Number);
  let mins = (bh * 60 + (bm || 0)) - (ah * 60 + (am || 0));
  if (mins <= 0) mins += 1440;
  return mins / 60;
}
