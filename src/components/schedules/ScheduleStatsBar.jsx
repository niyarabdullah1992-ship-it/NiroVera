import React from "react";
import { useI18n } from "@/lib/i18n";
import { MUTED, NAVY, num, SURFACE } from "@/lib/platformStyles";

function minutesBetween(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

export default function ScheduleStatsBar({ employees, shiftTypes, assignments, monthDates }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const days = monthDates || [];
  let scheduledMinutes = 0;
  let filledCells = 0;
  let staffable = 0;
  let restAssigned = 0;

  days.forEach((d) => {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const restDay = d.getDay() === 5;
    shiftTypes.forEach((st) => {
      const ids = assignments?.[key]?.[st.id] || [];
      if (restDay) {
        if (ids.length) restAssigned++;
      } else {
        staffable++;
        if (ids.length) filledCells++;
      }
      scheduledMinutes += ids.length * minutesBetween(st.start, st.end);
    });
  });

  const coverage = staffable > 0 ? Math.round((filledCells / staffable) * 100) : 0;
  const openCells = Math.max(0, staffable - filledCells);
  const empCount = employees.length;

  const stats = [
    {
      value: `${empCount}`,
      sub: ar
        ? (empCount === 1 ? "موظف في الجدول" : empCount === 2 ? "موظفان في الجدول" : empCount <= 10 ? "موظفين في الجدول" : "موظفًا في الجدول")
        : `employee${empCount === 1 ? "" : "s"} on the schedule`,
    },
    {
      value: `${Math.round(scheduledMinutes / 60)}h`,
      sub: ar ? "ساعات مجدولة هذا الشهر" : "scheduled hours this month",
    },
    {
      value: `${coverage}%`,
      sub: coverage >= 90 ? (ar ? "تغطية ممتازة" : "Excellent coverage") : (ar ? "نسبة التغطية" : "Coverage rate"),
    },
    {
      value: `${openCells}`,
      sub: ar
        ? (openCells === 1 ? "خلية بلا إسناد" : openCells === 2 ? "خليتان بلا إسناد" : "خلايا بلا إسناد")
        : `cell${openCells === 1 ? "" : "s"} with no assignment`,
    },
  ];

  if (restAssigned) {
    stats.push({
      value: `${restAssigned}`,
      sub: ar ? "إسناد في يوم راحة" : `assignment${restAssigned === 1 ? "" : "s"} on a rest day`,
      warn: true,
    });
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {stats.map((s) => (
        <div
          key={s.sub}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 10px",
            borderRadius: 8,
            border: `1px solid ${s.warn ? "#FDE68A" : "#E2E8F0"}`,
            background: s.warn ? "#FFFBEB" : SURFACE,
          }}
        >
          <span
            dir="ltr"
            style={{
              ...num(s.warn ? "#B45309" : NAVY),
              fontSize: 13,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {s.value}
          </span>
          <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.3 }}>{s.sub}</span>
        </div>
      ))}
    </div>
  );
}
