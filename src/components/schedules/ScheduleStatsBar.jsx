import React from "react";
import { useI18n } from "@/lib/i18n";
import FigureRow from "@/components/shared/FigureRow";

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

  const figures = [
    { key: "people", label: ar ? "في الجدول" : "On the schedule", value: empCount, suffix: ar ? "موظف" : "people" },
    { key: "hours", label: ar ? "ساعات مجدولة هذا الشهر" : "Scheduled hours this month", value: Math.round(scheduledMinutes / 60), suffix: ar ? "ساعة" : "h" },
    { key: "coverage", label: ar ? "التغطية" : "Coverage", value: `${coverage}%` },
    {
      key: "open",
      label: ar ? "خلايا بلا إسناد" : "Unassigned cells",
      value: openCells,
      ...(openCells ? { tone: "warn", flag: ar ? "نقص" : "Gap" } : {}),
    },
  ];
  if (restAssigned) {
    figures.push({ key: "rest", label: ar ? "إسناد في يوم راحة" : "On a rest day", value: restAssigned, tone: "bad", flag: ar ? "راحة أسبوعية" : "Weekly rest" });
  }

  return <FigureRow ar={ar} figures={figures} className="nv-schedule-stats" />;
}
