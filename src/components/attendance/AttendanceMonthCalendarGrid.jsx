import React from "react";
import { calendarDateKey, summarizeAttendanceDay } from "@/lib/attendanceCalendar";
import { isStatutoryOffDay } from "@/lib/leaveTypes";
import { ACCENT, BORDER, CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";
import { formatUiNumber } from "@/lib/dateFormat";

const STATUS = {
  present: { ar: "حاضر", en: "Present", bg: "var(--nv-accent-soft)", fg: "var(--nv-ok-ink)", bd: "var(--nv-ok-line)", dot: "var(--nv-ok-fill)" },
  late: { ar: "متأخر", en: "Late", bg: "var(--nv-warn-soft)", fg: "var(--nv-warn-ink)", bd: "var(--nv-warn-line)", dot: "var(--nv-warn-fill)" },
  absent: { ar: "غائب", en: "Absent", bg: "var(--nv-bad-soft)", fg: "var(--nv-bad-ink)", bd: "var(--nv-bad-line)", dot: "var(--nv-bad-fill)" },
  on_leave: { ar: "إجازة", en: "Leave", bg: "var(--nv-soft)", fg: "var(--nv-ink)", bd: "var(--nv-line)", dot: "var(--nv-navy)" },
  off_day: { ar: "راحة", en: "Off", bg: "var(--nv-soft)", fg: "var(--nv-muted)", bd: "var(--nv-line)", dot: "var(--nv-muted)" },
};

const chip = (meta) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "1px 6px",
  borderRadius: 999,
  fontSize: 9,
  fontWeight: 600,
  background: meta.bg,
  color: meta.fg,
  border: `1px solid ${meta.bd}`,
  whiteSpace: "nowrap",
  lineHeight: 1.4,
});

export default function AttendanceMonthCalendarGrid({
  days,
  rowsByDate,
  employees,
  schedules,
  currentUser,
  lang,
  teamView,
  proofsByDate = {},
}) {
  const ar = lang === "ar";
  const weekdays = ar
    ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayKey = calendarDateKey(new Date());
  const self = employees.find((employee) => String(employee.id) === String(currentUser?.id)) || currentUser;

  return (
    <div>
      <div style={{ overflow: "hidden", border: `1px solid ${BORDER}`, background: CARD }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid ${BORDER}`, background: SURFACE }}>
          {weekdays.map((day) => (
            <div key={day} style={{ padding: "10px 4px", textAlign: "center", fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: "0.04em" }}>
              {day}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {days.map((date, index) => {
            if (!date) {
              return (
                <div
                  key={`blank-${index}`}
                  style={{ minHeight: 92, borderBottom: `1px solid ${BORDER}`, borderInlineEnd: `1px solid ${BORDER}`, background: SURFACE }}
                />
              );
            }
            const key = calendarDateKey(date);
            const today = key === todayKey;
            const dayRows = rowsByDate[key] || [];
            const counts = summarizeAttendanceDay({
              employees,
              rows: dayRows,
              dateKey: key,
              schedules,
              todayKey,
              leaveOn: (employee, dateKey) => !!isStatutoryOffDay(employee, dateKey),
            });
            const selfRow = dayRows.find((row) => String(row.employee_id ?? row.employeeId) === String(self?.id));
            const selfStatus = summarizeAttendanceDay({
              employees: self ? [self] : [],
              rows: selfRow ? [selfRow] : [],
              dateKey: key,
              schedules,
              todayKey,
              leaveOn: (employee, dateKey) => !!isStatutoryOffDay(employee, dateKey),
            });
            const ownKey = Object.keys(selfStatus).find((status) => selfStatus[status] > 0);
            const dayProofs = proofsByDate[key] || [];
            return (
              <div
                key={key}
                className={`nv-att-month-cell${today ? " is-today" : ""}`}
                style={{
                  minHeight: 104,
                  padding: "10px 8px",
                  borderBottom: `1px solid ${BORDER}`,
                  borderInlineEnd: `1px solid ${BORDER}`,
                  background: CARD,
                }}
              >
                <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
                  <span
                    dir="ltr"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 15,
                      fontWeight: 600,
                      color: today ? ACCENT : NAVY,
                    }}
                  >
                    {formatUiNumber(date.getDate())}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {teamView
                    ? Object.entries(STATUS).map(([status, meta]) => {
                        const count = counts[status] || 0;
                        if (!count) return null;
                        return (
                          <span key={status} style={chip(meta)}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot }} />
                            {count}
                          </span>
                        );
                      })
                    : ownKey && STATUS[ownKey]
                      ? <span style={chip(STATUS[ownKey])}>{ar ? STATUS[ownKey].ar : STATUS[ownKey].en}</span>
                      : null}
                  {dayProofs.map((proof) => (
                    <span
                      key={proof.id || proof.ref}
                      style={chip({
                        bg: proof.kind === "visitor" ? "var(--nv-accent-soft)" : "var(--nv-accent-soft)",
                        fg: proof.kind === "visitor" ? "var(--nv-ok-ink)" : "var(--nv-ink)",
                        bd: proof.kind === "visitor" ? "var(--nv-ok-line)" : "var(--nv-line)",
                        dot: proof.kind === "visitor" ? "var(--nv-ok-fill)" : "var(--nv-navy)",
                      })}
                    >
                      {proof.kind === "visitor" ? (ar ? "زائر" : "Visitor") : (ar ? "إثبات" : "Proof")}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, alignItems: "center" }}>
        {Object.values(STATUS).map((meta) => (
          <span key={meta.en} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.dot }} />
            {ar ? meta.ar : meta.en}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", boxShadow: `inset 0 0 0 2px ${ACCENT}` }} />
          {ar ? "اليوم" : "Today"}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--nv-navy)" }} />
          {ar ? "إثبات عمل" : "Work proof"}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--nv-btn-fill)" }} />
          {ar ? "إثبات زائر" : "Visitor"}
        </span>
      </div>
    </div>
  );
}
