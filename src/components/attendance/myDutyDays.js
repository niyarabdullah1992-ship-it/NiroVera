import { excusedStartMinutes } from "@/lib/dutyRequests";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { employeeScheduledOn, hasPublishedScheduleOn } from "@/lib/attendanceCalendar";
import { employeeShiftOnDay, isWeekDayPublished } from "@/lib/shiftWeek";
import { isStatutoryOffDay } from "@/lib/leaveTypes";
import { listLocalRangeAttendance, mergeAttendanceRangeRows } from "@/lib/localAttendanceFallback";
import { isLocalPreviewActive } from "@/lib/localPreview";

/**
 * The viewer's own attendance rows for a date range — the same source كشفي read
 * (server range merged over the local register; local only in preview).
 */
export function useMyAttendanceRange({ employee, company, data, startDate, endDate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!employee?.id || !startDate || !endDate) return undefined;
    let active = true;
    const local = listLocalRangeAttendance(company?.id, startDate, endDate, data);
    if (isLocalPreviewActive() || !company?.id) {
      setRows(local);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    base44.functions
      .invoke("supabaseAttendance", { action: "listRange", employeeId: employee.id, startDate, endDate })
      .then((res) => { if (active) setRows(mergeAttendanceRangeRows(res?.data?.rows || [], local)); })
      .catch(() => { if (active) setRows(local); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employee?.id, company?.id, startDate, endDate, data]);
  const mine = rows.filter((row) => {
    const id = row?.employee_id ?? row?.employeeId;
    return id == null || String(id) === String(employee?.id);
  });
  return { rows: mine, loading };
}

export function rowsByDateKey(rows = []) {
  return Object.fromEntries(rows.map((row) => [String(row.date || row.dateKey || "").slice(0, 10), row]));
}

/**
 * One day of my register — the same derivation كشفي used (no new rule):
 * leave/official holiday outside attendance, open day, manual approval, late from the
 * published shift start, on time, absent on a scheduled past day, not punched yet today.
 * Days after today read as scheduled / rest only.
 * Returns a dutyStatus key in `status`.
 */
export function myDutyDay({ employee, data, row, key, todayKey, calendar, ar = true }) {
  const off = isStatutoryOffDay(employee, key, calendar);
  const scheduled = employeeScheduledOn(data?.schedules, employee?.id, key);
  const published = hasPublishedScheduleOn(data?.schedules, key);
  const schedule = (data?.schedules || []).find((item) => String(item.stationId) === String(employee?.stationId || data?.stations?.[0]?.id)) || null;
  const rosterLive = schedule ? isWeekDayPublished(schedule, key) : published;
  const shift = off ? null : employeeShiftOnDay(schedule, employee?.id, key);
  const inAt = row?.check_in_at || row?.checkInAt || null;
  const outAt = row?.check_out_at || row?.checkOutAt || null;
  const rawLate = Number(row?.late_minutes || row?.lateMinutes || 0);
  // An approved استئذان covering the shift start, or a nursing hour placed at the start (Art. 154), is not lateness.
  const excuse = rawLate > 0 && shift ? excusedStartMinutes(employee, key, shift.start) : { minutes: 0, reason: "" };
  const lateMinutes = Math.max(0, rawLate - excuse.minutes);
  const excusedNote = excuse.minutes && rawLate
    ? (excuse.reason === "nursing"
      ? (ar ? "ساعة الرضاعة أول الدوام — من ساعات العمل الفعلية (المادة 154)." : "Nursing hour at shift start — counted as work (Art. 154).")
      : (ar ? "استئذان معتمد — لا يُحتسب تأخيراً." : "Approved permission — not counted as lateness."))
    : "";
  const manual = !!(row?.manual_override || row?.location_status === "manual" || row?.override_by);
  let status = "rest";
  let note = ar ? "لا وردية منشورة." : "No published shift.";
  if (off && !inAt) {
    status = off.kind === "official" ? "holiday" : "leave";
    note = off.kind === "official"
      ? (ar ? `${off.labelAr} — خارج حساب الحضور (المادة 112)` : `${off.labelEn} — outside attendance (Article 112)`)
      : (ar ? "إجازة معتمدة — خارج حساب الحضور." : "Approved leave — outside attendance.");
  } else if (key > todayKey) {
    status = shift || scheduled ? "upcoming" : (rosterLive || published ? "rest" : "unscheduled");
    note = shift || scheduled ? (ar ? "مجدول — لم يحن بعد." : "Scheduled — not yet.") : note;
  } else if (inAt && !outAt) {
    status = key === todayKey ? "present" : "open";
    note = ar ? "حضور بلا انصراف." : "Checked in with no checkout.";
    if (key === todayKey && (lateMinutes > 0 || (row?.status === "late" && !excuse.minutes))) status = "late";
  } else if (manual && inAt) {
    status = "manual";
    note = ar ? "اعتمده المدير يدوياً." : "Approved manually by a manager.";
  } else if (lateMinutes > 0 || (row?.status === "late" && !excuse.minutes)) {
    status = "late";
    note = ar ? `${lateMinutes} دقيقة بعد بداية الوردية` : `${lateMinutes} minutes after shift start`;
    if (excusedNote) note = `${note} · ${excusedNote}`;
  } else if (inAt) {
    status = "ontime";
    note = excusedNote;
  } else if (!rosterLive && !scheduled) {
    status = "unscheduled";
    note = ar ? "لا وردية منشورة." : "No published shift.";
  } else if (scheduled || (published && key < todayKey)) {
    if (key === todayKey) {
      status = scheduled ? "pending" : "rest";
      note = scheduled ? (ar ? "مجدول اليوم — لم يُسجَّل بعد." : "Scheduled today — not punched yet.") : note;
    } else {
      status = "absent";
      note = scheduled ? (ar ? "مجدول ولم يسجّل." : "Scheduled and did not punch.") : note;
    }
  }
  return { key, status, note, shift, inAt, outAt, lateMinutes, manual, row: row || null, off: off || null };
}

export function isoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Month totals for the three سجلي tiles — counted from the same day records. */
export function monthTotals(days = []) {
  const seen = days.filter((day) => day && day.status !== "upcoming");
  const attended = seen.filter((day) => ["ontime", "late", "manual", "open", "present"].includes(day.status)).length;
  const scheduled = attended + seen.filter((day) => ["absent", "pending"].includes(day.status)).length;
  const lateDays = seen.filter((day) => day.status === "late" || (day.lateMinutes > 0 && day.inAt)).length;
  const lateMinutes = seen.reduce((sum, day) => sum + (day.inAt ? Number(day.lateMinutes) || 0 : 0), 0);
  const absent = seen.filter((day) => day.status === "absent").length;
  const leave = seen.filter((day) => day.status === "leave" || day.status === "holiday").length;
  const manual = seen.filter((day) => day.status === "manual").length;
  return { attended, scheduled, lateDays, lateMinutes, absent, leave, manual };
}
