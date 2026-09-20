/** Month attendance that feeds payroll — read from the operational calendar, never edited here. */

import { approvedOvertimeHoursForMonth } from "./attendanceDerivations.js";
import { DAYS_PER_MONTH } from "./payrollDerivations.js";
import { computeLeaveDays } from "./leaveDerivations.js";

function rowDate(row) {
  return String(row?.date || row?.attendanceDate || row?.day || "").slice(0, 10);
}

function rowEmployeeId(row) {
  return String(row?.employeeId || row?.employee_id || "");
}

function hasCheckIn(row) {
  return !!(row?.checkInAt || row?.check_in_at || row?.checkIn || row?.inAt);
}

function monthBounds(month) {
  const m = String(month || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const last = new Date(Number(m[1]), Number(m[2]), 0).getDate();
  return { start: `${m[1]}-${m[2]}-01`, end: `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}` };
}

function overlapsMonth(start, end, month) {
  const bounds = monthBounds(month);
  if (!bounds) return false;
  const a = String(start || "").slice(0, 10);
  const b = String(end || a).slice(0, 10);
  return a && b && a <= bounds.end && b >= bounds.start;
}

function daysInMonth(start, end, month) {
  const bounds = monthBounds(month);
  if (!bounds) return 0;
  const a = String(start || "").slice(0, 10);
  const b = String(end || a).slice(0, 10);
  const from = a < bounds.start ? bounds.start : a;
  const to = b > bounds.end ? bounds.end : b;
  return from <= to ? computeLeaveDays(from, to) : 0;
}

export function derivePayrollMonthAttendance(employeeId, month, data = {}) {
  const id = String(employeeId || "");
  const prefix = `${month}-`;
  const rows = (data.personalAttendance || []).filter((row) =>
    rowEmployeeId(row) === id && rowDate(row).startsWith(prefix),
  );
  let present = 0;
  let late = 0;
  let absent = 0;
  for (const row of rows) {
    const status = String(row.status || "").toLowerCase();
    if (status === "absent") {
      absent += 1;
      continue;
    }
    if (status === "late" || Number(row.lateMinutes) > 0) late += 1;
    if (hasCheckIn(row) || status === "present" || status === "late") present += 1;
  }

  const employee = (data.employees || []).find((entry) => String(entry.id) === id);
  let unpaidLeave = 0;
  for (const req of employee?.leaveRequests || []) {
    if (String(req.type || "").toLowerCase() !== "unpaid") continue;
    if (!["approved", "accepted"].includes(String(req.status || "").toLowerCase())) continue;
    if (!overlapsMonth(req.startDate, req.endDate, month)) continue;
    unpaidLeave += daysInMonth(req.startDate, req.endDate, month) || Number(req.days) || 0;
  }

  const otHours = approvedOvertimeHoursForMonth(data.otDecisions, id, month);
  const holidayHours = Number(data.holidayHoursByEmployee?.[id]) || 0;
  const eidHours = Number(data.eidHoursByEmployee?.[id]) || 0;
  const recorded = present + absent + unpaidLeave;
  const shift = recorded > 0 ? Math.max(recorded, DAYS_PER_MONTH) : DAYS_PER_MONTH;
  return {
    present,
    late,
    absent,
    unpaidLeave,
    otHours,
    holidayHours,
    eidHours,
    shift,
    recordedDays: rows.length,
    attGap: recorded > 0 && present + absent + unpaidLeave < shift,
    source: rows.length ? "calendar" : "empty",
  };
}
