import { deriveTeamAttendanceToday } from "@/lib/attendance";
import { listLocalTodayAttendance, mergeAttendanceRows } from "@/lib/localAttendanceFallback";
import { deriveAttendanceOtAnalysis, deriveAttendanceRowDay, REPORT_CATALOG } from "@/lib/reportsDerivations";
import { allowedNavFor } from "@/lib/navVisibility";
import { buildLocalOpsBoard } from "@/lib/localOpsFallback";
import { netOf } from "@/lib/payroll";
import { stationInHeaderScope } from "@/lib/stationTree";
import { deriveAccountingPeriod } from "@/lib/accountingDerivations";
import { buildDisciplineRegister } from "@/lib/disciplineDerivations";
import { bandOf, derivePerformanceRange, isoDay } from "@/lib/perfRange";

/** One picker row per live section — same columns as that page. */
export const SECTION_REPORTS = [
  { id: "attendance", path: "/app/attendance", format: "xlsx", labelAr: "الحضور والانصراف", labelEn: "Attendance" },
  { id: "shifts", path: "/app/shifts", format: "html", labelAr: "جدول الدوام", labelEn: "Duty roster" },
  { id: "tasks", path: "/app/tasks", format: "pdf", labelAr: "المهام والعمليات", labelEn: "Tasks" },
  { id: "payroll", path: "/app/payroll", format: "xlsx", labelAr: "الرواتب", labelEn: "Payroll" },
  { id: "safety", path: "/app/safety", format: "pdf", labelAr: "السلامة HSE", labelEn: "Safety" },
  { id: "performance", path: "/app/performance", format: "pdf", labelAr: "الأداء", labelEn: "Performance" },
  { id: "discipline", path: "/app/discipline", format: "xlsx", labelAr: "الجزاءات", labelEn: "Sanctions" },
  { id: "leave", path: "/app/requests", format: "xlsx", labelAr: "طلبات الإجازة", labelEn: "Leave" },
];

export function visibleSectionReports(currentUser, data, company) {
  const allowed = allowedNavFor(currentUser, data, company);
  const role = currentUser?.role;
  const owner = currentUser?.id && currentUser.id === data?.ownerId;
  return SECTION_REPORTS.filter((item) => {
    if (!allowed.has(item.path)) return false;
    if (item.roles?.length && !owner && !item.roles.includes(role)) return false;
    return true;
  });
}

function stationName(data, id) {
  return (data?.stations || []).find((s) => s.id === id)?.name || id || "—";
}

function employeeName(data, id) {
  return (data?.employees || []).find((e) => e.id === id)?.name || id || "—";
}

function dayKey(iso) {
  return String(iso || "").slice(0, 10);
}

/** Month `YYYY-MM`, day `YYYY-MM-DD`, or `{ from, to }` inclusive range. */
function inPeriod(iso, period) {
  if (!period) return true;
  const day = dayKey(iso);
  if (!day || day.length < 7) {
    const month = String(iso || "").slice(0, 7);
    if (typeof period === "object") {
      const fromM = String(period.from || "").slice(0, 7);
      const toM = String(period.to || "").slice(0, 7);
      if (fromM && month && month < fromM) return false;
      if (toM && month && month > toM) return false;
      return true;
    }
    return month === String(period).slice(0, 7);
  }
  if (typeof period === "object") {
    if (period.from && day < period.from) return false;
    if (period.to && day > period.to) return false;
    return true;
  }
  const key = String(period);
  if (key.length === 7) return day.startsWith(key);
  if (key.length === 10) return day === key;
  return day.startsWith(key);
}

function resolvePeriodFilter({ period, dateFrom, dateTo }) {
  if (dateFrom || dateTo) return { from: dateFrom || "", to: dateTo || "" };
  if (period && typeof period === "object") return period;
  return period || "";
}

function labelPeriod(filter, period) {
  if (filter && typeof filter === "object") {
    if (filter.from && filter.to) return `${filter.from} — ${filter.to}`;
    return filter.from || filter.to || "";
  }
  return period || filter || "";
}

function scopeStations(data, stationScope) {
  const list = data?.stations || [];
  if (!stationScope || stationScope === "all") return list;
  return list.filter((s) => stationInHeaderScope(s.id, stationScope, list));
}

function scopeEmployees(employees, stationScope, stations) {
  if (!stationScope || stationScope === "all") return employees || [];
  return (employees || []).filter((e) => stationInHeaderScope(e.stationId || e.station_id, stationScope, stations));
}

function clock(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const text = String(iso);
    return text.length >= 16 ? text.slice(11, 16) : text;
  }
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function attendanceStatusLabel(row, ar) {
  const status = row.status || (row.check_in_at || row.checkInAt ? "present" : "absent");
  const map = ar
    ? { present: "حاضر", late: "متأخر", absent: "غائب", leave: "إجازة", rest: "راحة" }
    : { present: "Present", late: "Late", absent: "Absent", leave: "Leave", rest: "Rest" };
  const label = map[status] || status;
  return (row.excused || row.excusedAbsence) ? `${label} (${ar ? "بعذر" : "excused"})` : label;
}

function attendanceOtDays(data, employees, period) {
  const ids = new Set((employees || []).map((e) => String(e.id)));
  return (data?.personalAttendance || [])
    .filter((row) => {
      const id = String(row.employeeId || row.employee_id || "");
      if (ids.size && id && !ids.has(id)) return false;
      return inPeriod(row.date || row.dateKey, period);
    })
    .map((row) => {
      const employeeId = row.employeeId || row.employee_id;
      const checkIn = row.check_in_at || row.checkInAt || null;
      const checkOut = row.check_out_at || row.checkOutAt || null;
      // Same reading as the attendance board: rostered shift + actual duty (rest deducted, Art. 107 overtime, flags).
      const day = deriveAttendanceRowDay(row, data);
      const workHours = day.workedMinutes != null ? Math.round((day.workedMinutes / 60) * 10) / 10 : "";
      return {
        employeeId,
        employeeName: row.employeeName || employeeName(data, employeeId),
        stationId: row.stationId || row.station_id || data?.employees?.find((e) => e.id === employeeId)?.stationId,
        date: day.date,
        checkIn,
        checkOut,
        workHours,
        ordinaryMinutes: day.ordinaryMinutes,
        overtimeMinutes: day.overtimeMinutes,
        lateMinutes: day.lateMinutes,
        status: row.status === "leave" || row.status === "rest" ? row.status : day.status,
        shiftLabel: day.shiftLabel || (day.rostered ? day.shiftStart : ""),
        flags: day.flags || [],
        excusedAbsence: !!(row.excused || row.excusedAbsence),
        manual: row.manual_override || row.location_status === "manual" || row.locationStatus === "manual",
      };
    });
}

export function catalogEntry(reportId) {
  return REPORT_CATALOG.find((r) => r.id === reportId) || null;
}

export function buildLibraryReport({
  reportId,
  period,
  dateFrom,
  dateTo,
  data,
  companyId,
  employees = [],
  stationScope = "all",
  lang = "ar",
  auditLogs = [],
}) {
  const ar = lang === "ar";
  const section = SECTION_REPORTS.find((item) => item.id === reportId);
  const entry = catalogEntry(reportId) || (section
    ? { id: section.id, titleAr: section.labelAr, titleEn: section.labelEn, format: section.format === "pdf" ? "PDF" : "XLSX" }
    : null);
  if (!entry) return null;
  const title = ar ? (entry.titleAr || section?.labelAr) : (entry.titleEn || section?.labelEn);
  const stations = scopeStations(data, stationScope);
  const team = scopeEmployees(employees.length ? employees : data?.employees, stationScope, data?.stations);
  const periodFilter = resolvePeriodFilter({ period, dateFrom, dateTo });
  const periodLabel = labelPeriod(periodFilter, period);
  period = periodFilter;

  if (reportId === "consolidated_daily") {
    const todayRows = mergeAttendanceRows([], listLocalTodayAttendance(companyId, data));
    const att = deriveTeamAttendanceToday(team, todayRows, data);
    const tasks = (data?.tasks || []).filter((t) => {
      const sid = t.stationId || t.station_id || t.assignment_id;
      return !stationScope || stationScope === "all" || stationInHeaderScope(sid, stationScope, data?.stations);
    });
    const open = tasks.filter((t) => t.status !== "completed" && t.status !== "approved");
    const done = tasks.filter((t) => t.status === "completed" || t.status === "approved");
    const headers = ar
      ? ["الفرع", "الموظفون", "مهام مفتوحة", "مهام منجزة"]
      : ["Station", "People", "Open tasks", "Done"];
    const rows = stations.map((s) => {
      const people = team.filter((e) => (e.stationId || e.station_id) === s.id).length;
      const stTasks = tasks.filter((t) => (t.stationId || t.station_id || t.assignment_id) === s.id);
      return [
        s.name,
        people,
        stTasks.filter((t) => t.status !== "completed" && t.status !== "approved").length,
        stTasks.filter((t) => t.status === "completed" || t.status === "approved").length,
      ];
    });
    return {
      entry,
      title,
      periodLabel,
      headers,
      rows,
      stats: [
        { value: att.presentLike ?? att.present ?? 0, label: ar ? "حاضر اليوم" : "Present today" },
        { value: att.absent ?? 0, label: ar ? "غائب" : "Absent" },
        { value: open.length, label: ar ? "مهام مفتوحة" : "Open tasks" },
        { value: done.length, label: ar ? "مهام منجزة" : "Completed" },
      ],
    };
  }

  if (reportId === "attendance_ot") {
    const days = attendanceOtDays(data, team, period);
    const analysis = deriveAttendanceOtAnalysis(days);
    const headers = ar
      ? ["الموظف", "الفرع", "التاريخ", "الوردية", "الحالة", "عادي (د)", "إضافي (د)", "تأخير (د)", "تنبيهات"]
      : ["Employee", "Station", "Date", "Shift", "Status", "Ordinary (m)", "OT (m)", "Late (m)", "Flags"];
    const rows = days.map((d) => [
      d.employeeName,
      stationName(data, d.stationId),
      d.date,
      d.shiftLabel || (ar ? "خارج الجدول" : "Unrostered"),
      attendanceStatusLabel(d, ar),
      d.ordinaryMinutes,
      d.overtimeMinutes,
      d.lateMinutes,
      (d.flags || []).map((flag) => (ar ? flag.reason : flag.reasonEn)).join(" · "),
    ]);
    return {
      entry,
      title,
      periodLabel,
      headers,
      rows,
      stats: [
        { value: analysis.lateEvents, label: ar ? "أحداث تأخير" : "Late events" },
        { value: analysis.avgLateMinutes, label: ar ? "متوسط التأخير (د)" : "Avg late (m)" },
        { value: analysis.repeatAbsence.length, label: ar ? "غياب متكرر" : "Repeat absence" },
        { value: analysis.stationsOverCap.length, label: ar ? "فروع فوق الحد" : "Stations over cap" },
      ],
    };
  }

  if (reportId === "cost_per_station") {
    const headers = ar
      ? ["الفرع", "بنود المسير", "صافي الرواتب", "قيود اليومية"]
      : ["Station", "Payroll lines", "Net payroll", "Journal lines"];
    const rows = stations.map((s) => {
      const people = new Set(team.filter((e) => (e.stationId || e.station_id) === s.id).map((e) => e.id));
      const items = (data?.payrollRuns || [])
        .filter((run) => inPeriod(run.period || run.month || run.createdAt, period))
        .flatMap((run) => run.items || [])
        .filter((item) => people.has(item.employeeId || item.employee_id));
      const net = items.reduce((sum, item) => sum + (Number(item.net || item.netPay || item.amount) || 0), 0);
      const journals = (data?.journalEntries || []).filter((j) => (j.stationId || j.station_id) === s.id && inPeriod(j.date || j.createdAt, period));
      return [s.name, items.length, net, journals.length];
    });
    return { entry, title, periodLabel, headers, rows, stats: [{ value: rows.length, label: ar ? "فروع" : "Stations" }] };
  }

  if (reportId === "hse_performance") {
    const recs = (data?.safety || []).filter((r) => !stationScope || stationScope === "all" || stationInHeaderScope(r.stationId, stationScope, data?.stations));
    const hazards = recs.flatMap((r) => (r.hazards || []).map((h) => ({ ...h, stationId: r.stationId })));
    const open = hazards.filter((h) => !h.closedAt);
    const closed = hazards.filter((h) => h.closedAt);
    const headers = ar
      ? ["الفرع", "الملاحظة", "الحالة", "تاريخ الإغلاق"]
      : ["Station", "Observation", "Status", "Closed at"];
    const rows = hazards.map((h) => [
      stationName(data, h.stationId),
      h.title || h.note || h.description || "—",
      h.closedAt ? (ar ? "مغلق" : "Closed") : (ar ? "مفتوح" : "Open"),
      h.closedAt ? String(h.closedAt).slice(0, 10) : "—",
    ]);
    return {
      entry,
      title,
      periodLabel,
      headers,
      rows,
      stats: [
        { value: hazards.length, label: ar ? "ملاحظات" : "Observations" },
        { value: open.length, label: ar ? "مفتوحة" : "Open" },
        { value: closed.length, label: ar ? "مغلقة" : "Closed" },
      ],
    };
  }

  if (reportId === "board_summary") {
    const todayRows = mergeAttendanceRows([], listLocalTodayAttendance(companyId, data));
    const att = deriveTeamAttendanceToday(team, todayRows, data);
    const openTasks = (data?.tasks || []).filter((t) => t.status !== "completed" && t.status !== "approved").length;
    const openHazards = (data?.safety || []).reduce((n, r) => n + (r.hazards || []).filter((h) => !h.closedAt).length, 0);
    const pendingLeave = team.reduce((n, e) => n + ((e.leaveRequests || e.leaves || []).filter((l) => l.status === "pending").length), 0);
    const headers = ar ? ["البند", "القيمة"] : ["Item", "Value"];
    const rows = [
      [ar ? "حاضر اليوم" : "Present today", att.presentLike ?? att.present ?? 0],
      [ar ? "غائب" : "Absent", att.absent ?? 0],
      [ar ? "مهام مفتوحة" : "Open tasks", openTasks],
      [ar ? "مخاطر مفتوحة" : "Open hazards", openHazards],
      [ar ? "إجازات معلّقة" : "Pending leave", pendingLeave],
      [ar ? "الفروع" : "Stations", stations.length],
    ];
    return {
      entry,
      title,
      periodLabel,
      headers,
      rows,
      stats: [
        { value: att.presentLike ?? att.present ?? 0, label: ar ? "حاضر" : "Present" },
        { value: openTasks, label: ar ? "مهام مفتوحة" : "Open tasks" },
        { value: openHazards, label: ar ? "مخاطر" : "Hazards" },
      ],
    };
  }

  if (reportId === "shifts") {
    const settings = data?.attendanceSettings || {};
    const gps = settings.gps_enabled === true;
    const scheduleRequired = settings.schedule_required !== false;
    const weekdayNames = ar
      ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
      : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const rosters = (data?.schedules || []).filter((row) => {
      if (!row) return false;
      if (!stationScope || stationScope === "all") return stations.some((s) => s.id === row.stationId) || !row.stationId;
      return stationInHeaderScope(row.stationId, stationScope, data?.stations);
    });
    const clockRows = [
      [ar ? "مصدر الساعة" : "Clock source", ar ? "الجدول المنشور — لا ساعة شركة افتراضية" : "Published rota — no company default hour"],
      [ar ? "شرط الوردية" : "Shift required", scheduleRequired ? (ar ? "إلزامي — غير المدرج لا يبصم" : "Required — unscheduled staff cannot punch") : (ar ? "اختياري" : "Optional")],
      [ar ? "التأخير" : "Lateness", ar ? "من أول دقيقة بعد بداية الوردية المنشورة — لا حدّ سماح" : "From the first minute after the published start — no grace"],
      [ar ? "شرط الموقع" : "Location", gps ? (ar ? "داخل نطاق الفرع" : "Inside station range") : (ar ? "غير مطلوب" : "Not required")],
      [ar ? "جداول منشورة" : "Published rotas", String(rosters.filter((row) => row.published).length)],
      [ar ? "جداول مسودة" : "Draft rotas", String(rosters.filter((row) => !row.published).length)],
    ];
    const typeRows = rosters.flatMap((sch) => (sch.shiftTypes || []).map((st) => [
      stationName(data, sch.stationId),
      sch.published ? (ar ? "منشور" : "Published") : (ar ? "مسودة" : "Draft"),
      st.label || st.id,
      st.start || "—",
      st.end || "—",
    ]));
    const assignRows = [];
    for (const sch of rosters) {
      const types = Object.fromEntries((sch.shiftTypes || []).map((st) => [st.id, st]));
      for (const [key, cells] of Object.entries(sch.assignments || {})) {
        const dated = /^\d{4}-\d{2}-\d{2}$/.test(key);
        if (dated && !inPeriod(key, period)) continue;
        const dayLabel = dated ? key : (weekdayNames[Number(key)] || key);
        for (const [shiftId, ids] of Object.entries(cells || {})) {
          const st = types[shiftId] || {};
          for (const empId of ids || []) {
            assignRows.push([
              dayLabel,
              stationName(data, sch.stationId),
              st.label || shiftId,
              `${st.start || "—"}–${st.end || "—"}`,
              employeeName(data, empId),
              sch.published ? (ar ? "منشور" : "Published") : (ar ? "مسودة" : "Draft"),
            ]);
          }
        }
      }
    }
    const sections = [
      { heading: ar ? "مصدر الوقت" : "Clock source", headers: ar ? ["القاعدة", "القيمة"] : ["Rule", "Value"], rows: clockRows },
      {
        heading: ar ? "أنواع الورديات" : "Shift types",
        headers: ar ? ["الفرع", "الحالة", "الوردية", "من", "إلى"] : ["Station", "State", "Shift", "Start", "End"],
        rows: typeRows.length ? typeRows : [[ar ? "لا أنواع ورديات في النطاق" : "No shift types in scope", "—", "—", "—", "—"]],
      },
      {
        heading: ar ? "التعيينات" : "Assignments",
        headers: ar ? ["اليوم", "الفرع", "الوردية", "الوقت", "الموظف", "النشر"] : ["Day", "Station", "Shift", "Hours", "Employee", "Publish"],
        rows: assignRows.length ? assignRows : [[ar ? "لا تعيينات في هذه الفترة" : "No assignments in this period", "—", "—", "—", "—", "—"]],
      },
    ];
    return {
      entry,
      title,
      periodLabel,
      headers: sections[2].headers,
      rows: assignRows,
      stats: [
        { value: rosters.filter((row) => row.published).length, label: ar ? "جداول منشورة" : "Published" },
        { value: typeRows.length, label: ar ? "أنواع ورديات" : "Shift types" },
        { value: assignRows.length, label: ar ? "تعيينات" : "Assignments" },
      ],
      sections,
    };
  }

  if (reportId === "attendance") {
    const days = attendanceOtDays(data, team, period);
    const headers = ar
      ? ["الموظف", "الفرع", "التاريخ", "الحالة", "دخول", "خروج", "ساعات العمل", "تأخير (د)"]
      : ["Employee", "Station", "Date", "Status", "Check-in", "Check-out", "Work hours", "Late (m)"];
    const rows = days.map((d) => [
      d.employeeName,
      stationName(data, d.stationId),
      d.date,
      attendanceStatusLabel(d, ar),
      clock(d.checkIn),
      clock(d.checkOut),
      d.workHours === "" || d.workHours == null ? "—" : d.workHours,
      d.status === "late" ? d.lateMinutes : "—",
    ]);
    return { entry, title, periodLabel, headers, rows, stats: [{ value: days.length, label: ar ? "سجلات حضور" : "Attendance rows" }] };
  }

  if (reportId === "tasks") {
    const board = buildLocalOpsBoard({ tasks: data?.tasks || [], scope: stationScope, stations: data?.stations || [] });
    const tasks = (board.tasks || []).filter((t) => {
      const stamp = t.createdAt || t.dueAt || t.approvedAt || t.completedAt || t.updatedAt;
      return !stamp || inPeriod(stamp, period);
    });
    const statusAr = { active: "نشطة", completed: "منجزة", approved: "معتمدة", rejected: "مرفوضة", awaiting_review: "بانتظار المراجعة" };
    const headers = ar
      ? ["المرجع", "المهمة", "الحالة", "المسؤول", "الفرع", "الأولوية", "الاستحقاق", "الجهد", "المنجز / المطلوب"]
      : ["Ref", "Task", "Status", "Owner", "Station", "Priority", "Due", "Effort", "Done / target"];
    const rows = tasks.map((t) => [
      t.ref || "—",
      t.title || "—",
      ar ? (statusAr[t.status] || t.status || "—") : (t.status || "—"),
      employeeName(data, t.ownerId || t.assignedTo),
      stationName(data, t.stationId),
      t.priority || "—",
      t.dueAt ? String(t.dueAt).slice(0, 10) : "—",
      t.effortWeight ?? "—",
      `${t.completedCount || 0} / ${t.targetCount || 1}`,
    ]);
    return { entry, title, periodLabel, headers, rows, stats: [{ value: board.counts?.active ?? tasks.filter((t) => t.status !== "completed" && t.status !== "approved").length, label: ar ? "مفتوحة" : "Open" }] };
  }

  if (reportId === "payroll") {
    const items = (data?.payrollRuns || [])
      .filter((run) => inPeriod(run.period || run.month || run.createdAt, period))
      .flatMap((run) => (run.items || []).map((item) => ({ ...item, period: run.period || run.month })));
    const scoped = items.filter((item) => {
      if (!stationScope || stationScope === "all") return true;
      const sid = item.employeeStationId || team.find((e) => e.id === (item.employeeId || item.employee_id))?.stationId;
      return stationInHeaderScope(sid, stationScope, data?.stations);
    });
    const headers = ar
      ? ["الموظف", "الفرع", "الشهر", "الأساسي", "البدلات", "الخصم", "الصافي", "مدفوع"]
      : ["Employee", "Station", "Month", "Base", "Allowances", "Deductions", "Net", "Paid"];
    const rows = scoped.map((item) => [
      item.employeeName || employeeName(data, item.employeeId || item.employee_id),
      stationName(data, item.employeeStationId),
      item.period || periodLabel,
      item.base ?? 0,
      item.allowances ?? 0,
      item.deductions ?? 0,
      netOf(item),
      item.paid ? (ar ? "مدفوع" : "Paid") : (ar ? "غير مدفوع" : "Unpaid"),
    ]);
    return { entry, title, periodLabel, headers, rows, stats: [{ value: scoped.length, label: ar ? "بنود المسير" : "Payroll lines" }] };
  }

  if (reportId === "accounting") {
    const month = typeof period === "string" && /^\d{4}-\d{2}$/.test(period)
      ? period
      : String(period?.from || period || "").slice(0, 7);
    const snap = deriveAccountingPeriod({
      month: month || undefined,
      payrollRuns: data?.payrollRuns || [],
      lang: ar ? "ar" : "en",
    });
    const headers = ar ? ["البند", "القيمة"] : ["Item", "Value"];
    const rows = [
      [ar ? "الشهر" : "Month", snap.month],
      [ar ? "صافي رواتب معتمد" : "Approved payroll net", snap.payroll.posted ? snap.payroll.netTotal : 0],
      [ar ? "حالة المسير" : "Payroll status", snap.payroll.status],
    ];
    return {
      entry,
      title,
      periodLabel: snap.month,
      headers,
      rows,
      stats: [
        { value: snap.payroll.posted ? snap.payroll.netTotal : 0, label: ar ? "صافي رواتب" : "Payroll net" },
      ],
    };
  }

  if (reportId === "safety") {
    const recs = (data?.safety || []).filter((r) => !stationScope || stationScope === "all" || stationInHeaderScope(r.stationId, stationScope, data?.stations));
    const hazards = recs.flatMap((r) => (Array.isArray(r.hazards) ? r.hazards : [r]).map((h) => ({ ...h, stationId: h.stationId || r.stationId })));
    const headers = ar
      ? ["الفرع", "الملاحظة", "الخطورة", "الحالة", "تاريخ الإغلاق"]
      : ["Station", "Observation", "Severity", "Status", "Closed at"];
    const rows = hazards.filter((h) => inPeriod(h.createdAt || h.closedAt || h.date, period) || !h.createdAt).map((h) => [
      stationName(data, h.stationId),
      h.title || h.note || h.description || "—",
      h.severity || h.level || "—",
      h.closedAt ? (ar ? "مغلق" : "Closed") : (ar ? "مفتوح" : "Open"),
      h.closedAt ? String(h.closedAt).slice(0, 10) : "—",
    ]);
    return { entry, title, periodLabel, headers, rows, stats: [{ value: rows.length, label: ar ? "ملاحظات سلامة" : "Safety notes" }] };
  }

  if (reportId === "discipline") {
    const teamIds = new Set(team.map((row) => String(row.id)));
    const cases = (data?.disciplinaryCases || []).filter((item) => {
      if (teamIds.size && !teamIds.has(String(item.employeeId))) return false;
      return inPeriod(item.decidedAt || item.updatedAt || item.createdAt, period) || !item.createdAt;
    });
    const register = buildDisciplineRegister({
      cases,
      employees: team,
      stations: data?.stations || [],
      ar,
    });
    return {
      entry,
      title,
      periodLabel,
      headers: register.headers,
      rows: register.rows,
      stats: register.stats,
    };
  }

  if (reportId === "performance") {
    const today = isoDay();
    const from = (periodFilter && typeof periodFilter === "object" && periodFilter.from) || String(period || "").slice(0, 10) || `${today.slice(0, 7)}-01`;
    const to = (periodFilter && typeof periodFilter === "object" && periodFilter.to) || (String(period || "").length === 10 ? String(period) : today);
    const view = derivePerformanceRange({ employees: team, stations, data, from, to, ar });
    const headers = ar
      ? ["#", "الموظف", "الفرع", "الإنجاز", "الموعد", "السلامة", "التغطية", "الدرجة", "التقييم", "الإثبات"]
      : ["#", "Employee", "Branch", "Done", "On time", "Safety", "Coverage", "Score", "Band", "Proof"];
    const rows = view.ranked.map((row, index) => [
      index + 1,
      row.name,
      row.branch,
      `${row.a.done}%`,
      `${row.a.time}%`,
      `${row.a.safe}%`,
      `${row.a.cover}%`,
      row.score,
      bandOf(row.score, ar),
      row.ok ? (ar ? "مكتمل" : "Enough") : `${row.a.proof}/${view.minProof}`,
    ]);
    return {
      entry,
      title,
      periodLabel: `${view.fmtFrom} → ${view.fmtTo}`,
      headers,
      rows,
      stats: [
        { value: view.eligible.length ? view.avg : "—", label: ar ? "متوسط الدرجة" : "Average" },
        { value: view.top ? `${view.top.name} ${view.top.score}` : "—", label: ar ? "الأعلى" : "Highest" },
        { value: view.rowsAll.length - view.eligible.length, label: ar ? "بلا إثبات كافٍ" : "Short of proof" },
      ],
    };
  }

  if (reportId === "leave") {
    const companyLeaves = (data?.leaveRequests || []).map((l) => [
      employeeName(data, l.employeeId || l.employee_id),
      l.type || l.leaveType || "—",
      l.status || "—",
      String(l.startDate || l.from || "").slice(0, 10),
      String(l.endDate || l.to || "").slice(0, 10),
    ]);
    const rows = [
      ...team.flatMap((e) => (e.leaveRequests || e.leaves || []).map((l) => [
        e.name,
        l.type || l.leaveType || "—",
        l.status || "—",
        String(l.startDate || l.from || "").slice(0, 10),
        String(l.endDate || l.to || "").slice(0, 10),
      ])),
      ...companyLeaves,
    ];
    const headers = ar ? ["الموظف", "النوع", "الحالة", "من", "إلى"] : ["Employee", "Type", "Status", "From", "To"];
    return { entry, title, periodLabel, headers, rows, stats: [{ value: rows.filter((r) => r[2] === "pending").length, label: ar ? "معلّق" : "Pending" }] };
  }

  if (reportId === "audit_trail") {
    const headers = ar ? ["الوقت", "الإجراء", "بواسطة", "التفاصيل"] : ["Time", "Action", "By", "Details"];
    const rows = (auditLogs || []).map((log) => [
      log.createdAt || log.at || log.time || "—",
      log.action || log.auditAction || "—",
      log.performedBy || log.by || "—",
      log.details || log.detail || "",
    ]);
    return { entry, title, periodLabel, headers, rows, stats: [{ value: rows.length, label: ar ? "سجلات" : "Entries" }] };
  }

  return { entry, title, periodLabel, headers: [ar ? "البند" : "Item"], rows: [], stats: [] };
}

