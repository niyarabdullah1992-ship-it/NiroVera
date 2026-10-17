import React, { useMemo } from "react";
import MinistrySectionPanel from "@/components/schedules/MinistrySectionPanel";
import { buildMinistrySection } from "@/lib/ministrySections";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { stationPrayerTimes } from "@/lib/prayerTimes";
import { isRamadanDay } from "@/lib/laborRules";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";

/**
 * «أنظمة الوزارة — ما يخص البصمة» (بصمتي) / «— ما يخص الحضور» (إدارة الحضور): the shared frame on
 * the attendance rows (attendanceMinistryRows) — the worker's own week and year, or the scope's sum.
 */
export default function AttendanceMinistryPanel({ data, employee = null, people = [], lane = "employee", ar = true }) {
  const today = toRiyadhDateKey();
  const station = lane === "employee"
    ? (data?.stations || []).find((row) => String(row.id) === String(employee?.stationId)) || null
    : null;
  const prayers = useMemo(() => {
    if (!station) return null;
    try { return stationPrayerTimes(station, today, { ramadan: isRamadanDay(today, laborCalendarOf(data)) }); } catch { return null; }
  }, [station, today, data]);
  const section = useMemo(
    () => buildMinistrySection("attendance", { lane, ar, today, data: data || {}, employee, people, prayers }),
    [lane, ar, today, data, employee, people, prayers],
  );
  return <MinistrySectionPanel section={section} ar={ar} today={today} />;
}
