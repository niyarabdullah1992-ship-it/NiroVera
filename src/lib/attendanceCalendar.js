function daysBetweenKeys(fromKey, toKey) {
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/** Grid filter for the operational calendar — leave and weekend are not the same query. */
export function calendarCellMatches({
  cell,
  query = "",
  quick = "",
  month,
  todayKey,
  monthNames = [],
}) {
  if (!cell || cell.blank) return false;
  const q = String(query || "").trim();
  if (quick === "broken") return !!(cell.rec && cell.rec.broke);
  if (quick === "abs") return !!(cell.rec && cell.rec.abs > 0);
  if (quick === "late") return !!(cell.rec && cell.rec.late > 0);
  if (quick === "week") {
    const diff = daysBetweenKeys(cell.key, todayKey);
    return diff != null && diff >= 0 && diff < 7;
  }
  if (!q) return true;
  if (/غياب|غاب|absent/.test(q)) return !!(cell.rec && cell.rec.abs > 0);
  if (/تأخير|متأخر|تأخر|late/.test(q)) return !!(cell.rec && cell.rec.late > 0);
  if (/انكسار|كسر|سلسلة|حلقة|break|ring/.test(q)) return !!(cell.rec && cell.rec.broke);
  if (/عطلة|weekend/.test(q)) return !!cell.weekend;
  if (/إجازة|leave/.test(q)) return !!(cell.rec && cell.rec.leave);
  if (/^\d{1,2}$/.test(q)) return cell.d === Number(q);
  const slash = q.match(/^(\d{1,2})\s*[/\-]\s*(\d{1,2})/);
  if (slash) return cell.d === Number(slash[1]);
  const named = monthNames.findIndex((name) => q.includes(name));
  if (named >= 0) return named === month;
  return true;
}

export function calendarDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthGridDays(year, month) {
  const first = new Date(year, month, 1);
  const count = new Date(year, month + 1, 0).getDate();
  return [
    ...Array(first.getDay()).fill(null),
    ...Array.from({ length: count }, (_, index) => new Date(year, month, index + 1)),
  ];
}

export function taskStationId(task, data) {
  const fallback = data?.stations?.[0]?.id || null;
  if (task.assignment_type === "station_team") return task.assignment_id || task.station_id || fallback;
  if (task.assignment_type === "member") {
    return task.station_id || data?.employees?.find((employee) => employee.id === task.employee_id)?.stationId || fallback;
  }
  return task.station_id || fallback;
}

export function tasksDueOn(tasks, key) {
  return tasks.filter((task) => {
    const due = task.end_date || task.endDate || task.due_date;
    return due && String(due).slice(0, 10) === key;
  });
}

export function isIsoDateAssignmentKey(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(key || ""));
}

/** 18632 lookback: ISO date keys only. Weekday keys 0–4 are this week's pattern, not history. */
export function datedDayAssignmentMap(assignments, dateKey) {
  return dayAssignmentMap(assignments, dateKey, { datedOnly: true });
}

export function dayAssignmentMap(assignments, dateKey, { datedOnly = false } = {}) {
  if (!assignments || !dateKey) return null;
  const dated = assignments[dateKey];
  if (dated && typeof dated === "object" && !Array.isArray(dated)) return dated;
  if (datedOnly || !isIsoDateAssignmentKey(dateKey)) return null;
  const parts = String(dateKey).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !n)) return null;
  const weekday = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
  const weekly = assignments[weekday] || assignments[String(weekday)];
  if (weekly && typeof weekly === "object" && !Array.isArray(weekly)) return weekly;
  return null;
}

export function employeeScheduledOn(schedules, employeeId, key) {
  return (schedules || []).some((schedule) => {
    const day = dayAssignmentMap(schedule.assignments, key);
    return (schedule.shiftTypes || []).some((shift) => (day?.[shift.id] || []).includes(employeeId));
  });
}

export function hasPublishedScheduleOn(schedules, key) {
  return (schedules || []).some((schedule) => {
    const day = dayAssignmentMap(schedule.assignments, key);
    return (schedule.shiftTypes || []).some((shift) => (day?.[shift.id] || []).length > 0);
  });
}

export function attendanceRowDateKey(row) {
  return String(row?.date || row?.dateKey || "").slice(0, 10);
}

/**
 * Day status for the attendance month calendar.
 * Future days and today (still open) stay empty — not marked absent.
 */
export function dayAttendanceStatus({ employee, row, dateKey, schedules, todayKey, onLeave }) {
  if (onLeave) return "on_leave";
  if (row?.check_in_at || row?.checkInAt) {
    return row.status === "late" ? "late" : "present";
  }
  const published = hasPublishedScheduleOn(schedules, dateKey);
  const scheduled = employeeScheduledOn(schedules, employee?.id, dateKey);
  if (published && !scheduled) return "off_day";
  if (!todayKey || dateKey >= todayKey) return null;
  return "absent";
}

export function summarizeAttendanceDay({ employees = [], rows = [], dateKey, schedules, todayKey, leaveOn }) {
  const byEmployee = Object.fromEntries(
    (rows || []).map((row) => [String(row.employee_id ?? row.employeeId), row]),
  );
  const counts = { present: 0, late: 0, absent: 0, on_leave: 0, off_day: 0 };
  for (const employee of employees) {
    const status = dayAttendanceStatus({
      employee,
      row: byEmployee[String(employee.id)],
      dateKey,
      schedules,
      todayKey,
      onLeave: typeof leaveOn === "function" ? leaveOn(employee, dateKey) : false,
    });
    if (status && counts[status] != null) counts[status] += 1;
  }
  return counts;
}