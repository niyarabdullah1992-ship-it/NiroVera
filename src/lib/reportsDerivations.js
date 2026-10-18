/** Client mirror of base44/shared/reportsDerivations.ts
 *  Keep in sync — Reports library, timesheet (rostered shift + actual duty), payroll-close gates.
 */

import { ruleValue } from "./laborRules.js";
import { deriveActualDuty, punchClockMinutes } from "./actualDuty.js";
import { nursingHourOn } from "./dutyRequests.js";
import { rosterShiftFor } from "./otDecisionPlan.js";
import { laborCalendarOf } from "./ummAlQuraCalendar.js";

export const GRACE_MINUTES = ruleValue("hours.grace.minutes");
export const SHIFT_HOURS = ruleValue("hours.shift.ordinaryHours");
export const SHIFT_MINUTES = SHIFT_HOURS * 60;
export const WEEKLY_HOURS_CAP = ruleValue("hours.week.ordinaryMaxHours");
export const WEEKLY_OT_CAP_HOURS = WEEKLY_HOURS_CAP - 5 * SHIFT_HOURS;
export const DEFAULT_SHIFT_START = "07:00";

export const REPORT_CATALOG = [
  {
    id: "consolidated_daily",
    kickerAr: "تشغيلي",
    kickerEn: "OPERATIONS",
    titleAr: "التقرير اليومي الموحّد",
    titleEn: "Consolidated daily report",
    descAr: "حالة كل فرع، المهام المنجزة، والانحرافات في صفحة واحدة.",
    descEn: "Every station's status, completed tasks, and deviations on one page.",
    format: "PDF",
    needsPeriod: false,
  },
  {
    id: "cost_per_station",
    kickerAr: "مالي",
    kickerEn: "FINANCE",
    titleAr: "تحليل تكلفة التشغيل بالفرع",
    titleEn: "Cost per station analysis",
    descAr: "الرواتب وقيود اليومية منسوبة لكل فرع على حدة.",
    descEn: "Payroll and journal lines attributed per station.",
    format: "XLSX",
    needsPeriod: true,
    roles: ["owner", "director", "ops_manager", "admin", "pgm", "financial_officer"],
  },
  {
    id: "hse_performance",
    kickerAr: "سلامة",
    kickerEn: "SAFETY",
    titleAr: "تقرير الأداء الوقائي HSE",
    titleEn: "HSE performance report",
    descAr: "معدل التكرار، الملاحظات المسجلة، ونسبة الإغلاق في الوقت.",
    descEn: "TRIR, logged observations, and on-time closure rate.",
    format: "PDF",
    needsPeriod: true,
    roles: ["owner", "director", "ops_manager", "admin", "pgm", "station_manager", "safety_officer"],
  },
  {
    id: "attendance_ot",
    kickerAr: "قوى عاملة",
    kickerEn: "WORKFORCE",
    titleAr: "تحليل الحضور والساعات الإضافية",
    titleEn: "Attendance & overtime analysis",
    descAr: "أنماط التأخر، الغياب المتكرر، والفروع المتجاوزة لحد الإضافي.",
    descEn: "Lateness patterns, repeat absence, and stations over the overtime cap.",
    format: "XLSX",
    needsPeriod: true,
    roles: ["owner", "director", "ops_manager", "admin", "pgm", "hr_manager", "hr", "station_manager"],
  },
  {
    id: "board_summary",
    kickerAr: "تنفيذي",
    kickerEn: "EXECUTIVE",
    titleAr: "ملخص مجلس الإدارة الشهري",
    titleEn: "Monthly board summary",
    descAr: "مؤشر الجاهزية، القرارات المتخذة، والمخاطر المفتوحة.",
    descEn: "Readiness index, decisions taken, and open risks.",
    format: "PDF",
    needsPeriod: true,
    roles: ["owner", "director", "ops_manager", "admin", "pgm"],
  },
  {
    id: "audit_trail",
    kickerAr: "امتثال",
    kickerEn: "COMPLIANCE",
    titleAr: "سجل التدقيق الكامل",
    titleEn: "Full audit trail",
    descAr: "كل تغيير على البيانات: من، ومتى، وماذا تغيّر بالضبط.",
    descEn: "Every data change: who, when, and exactly what changed.",
    format: "CSV",
    needsPeriod: false,
    roles: ["owner", "director", "ops_manager", "admin", "pgm", "hr_manager"],
  },
];

export const SCHEDULED_REPORTS = [
  {
    id: "sched_daily",
    reportId: "consolidated_daily",
    titleAr: "التقرير اليومي الموحّد",
    titleEn: "Consolidated daily report",
    recipientsAr: "مدير العمليات · مدراء الفروع",
    recipientsEn: "Ops Director · station managers",
    cadenceAr: "يوميًا 6:00 ص",
    cadenceEn: "Daily 06:00",
  },
  {
    id: "sched_board",
    reportId: "board_summary",
    titleAr: "ملخص مجلس الإدارة الشهري",
    titleEn: "Monthly board summary",
    recipientsAr: "الرئيس التنفيذي · المدير المالي",
    recipientsEn: "CEO · CFO",
    cadenceAr: "أول كل شهر",
    cadenceEn: "1st of month",
  },
];

export function parseHm(hm) {
  const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatMinutes(mins) {
  const n = Math.max(0, Math.round(Number(mins) || 0));
  if (n <= 0) return "—";
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function parsePeriod(period) {
  const m = String(period || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function catalogById(id) {
  return REPORT_CATALOG.find((r) => r.id === id) || null;
}

export function actorMayGenerate(actor, entry) {
  if (!actor) return false;
  if (actor.owner || actor.admin) return true;
  const roles = entry.roles;
  if (!roles || roles.length === 0) return true;
  return roles.includes(String(actor.role || "").toLowerCase());
}

/** Rostered shift window → absolute minutes (an overnight end runs past midnight). */
function rosterWindow(shift) {
  const start = parseHm(shift?.start);
  const endRaw = parseHm(shift?.end);
  if (start == null || endRaw == null) return null;
  return { start, end: endRaw <= start ? endRaw + 1440 : endRaw };
}

function emptyDay(punch, status, extra = {}) {
  return {
    date: punch.date,
    status,
    checkIn: null,
    checkOut: null,
    ordinaryMinutes: 0,
    overtimeMinutes: 0,
    lateMinutes: 0,
    earlyMinutes: 0,
    openCheckout: false,
    late: false,
    ...extra,
  };
}

/**
 * One timesheet day read the way the attendance board reads it (actualDuty.js): against the ROSTERED
 * shift for that person and day — never a fixed 07:00 / 8 h. Rest is deducted (Art. 102), overtime is
 * what passes the day's ordinary cap or the roster on the weekly criterion, all of it on a holiday or
 * an unrostered rest day (Art. 107), and the day carries the board's flags: presence over 12 h
 * (Art. 101), work over 10 h (Art. 106), more than five hours without a break (Art. 101).
 * opts: { shift, employee, company, laborCalendar, breaks, duty } — `duty` is a precomputed deriveActualDuty.
 */
export function deriveTimesheetDay(punch, opts = {}) {
  const grace = opts.graceMinutes ?? GRACE_MINUTES;
  const shift = opts.shift !== undefined ? opts.shift : (punch.shift || null);

  if (punch.restDay || punch.status === "rest") return emptyDay(punch, "rest");
  if (punch.onLeave || punch.status === "leave") return emptyDay(punch, "leave");

  const inM = punchClockMinutes(punch.checkIn);
  const outM = punchClockMinutes(punch.checkOut);
  const roster = {
    rostered: !!shift,
    shiftId: shift?.id || null,
    shiftLabel: shift?.label || null,
    shiftStart: shift?.start || null,
    shiftEnd: shift?.end || null,
  };
  if (inM == null) return emptyDay(punch, "absent", { excused: !!punch.excusedAbsence, ...roster });

  const win = rosterWindow(shift);
  // Art. 154: her nursing minutes at the start are not lateness, at the end not an early checkout.
  const nursingDay = win ? nursingHourOn(opts.employee, punch.date) : null;
  const lateMinutes = win ? Math.max(0, inM - win.start - grace - (nursingDay?.startMinutes || 0)) : 0;
  const late = lateMinutes > 0;
  const openCheckout = outM == null;
  const base = {
    date: punch.date,
    status: late ? "late" : "present",
    checkIn: punch.checkIn || null,
    checkOut: punch.checkOut || null,
    lateMinutes,
    late,
    openCheckout,
    ...roster,
  };
  if (openCheckout) {
    return { ...base, ordinaryMinutes: 0, overtimeMinutes: 0, earlyMinutes: 0, flags: [] };
  }
  const duty = opts.duty || deriveActualDuty({
    checkIn: punch.checkIn,
    checkOut: punch.checkOut,
    shift,
    onDate: punch.date,
    employee: opts.employee,
    company: opts.company,
    laborCalendar: opts.laborCalendar,
    breaks: punch.breaks ?? opts.breaks,
  });
  const outAbs = outM <= inM ? outM + 1440 : outM;
  const earlyMinutes = win ? Math.max(0, win.end - outAbs - (nursingDay?.endMinutes || 0)) : 0;
  return {
    ...base,
    ordinaryMinutes: duty.ordinaryMinutes || 0,
    overtimeMinutes: duty.overtimeMinutes || 0,
    earlyMinutes,
    presenceMinutes: duty.presenceMinutes || 0,
    restMinutes: duty.restMinutes || 0,
    workedMinutes: duty.workedMinutes || 0,
    nursingCreditMinutes: duty.nursingCreditMinutes || 0,
    rosteredMinutes: duty.rosteredMinutes || 0,
    overtimeKind: duty.kind || "",
    holiday: !!duty.holiday,
    flags: (duty.flags || []).map((flag) => ({ error: flag.error, article: flag.article, reason: flag.reason, reasonEn: flag.reasonEn })),
  };
}

/**
 * A stored attendance row (personalAttendance) → its timesheet day, read exactly as the attendance
 * board's stampActualOvertime reads it: the rostered shift on any station's roster (rosterShiftFor),
 * the company bag `data` as the hours policy, and the owner labour calendar.
 */
export function deriveAttendanceRowDay(row, data, opts = {}) {
  const employeeId = String(row?.employeeId || row?.employee_id || "");
  const employee = (data?.employees || []).find((e) => String(e?.id) === employeeId) || { id: employeeId };
  const date = String(row?.date || row?.dateKey || "").slice(0, 10);
  const checkIn = row?.check_in_at || row?.checkInAt || row?.checkIn || null;
  const checkOut = row?.check_out_at || row?.checkOutAt || row?.checkOut || null;
  const status = row?.status === "leave" || row?.status === "rest" ? row.status : null;
  const shift = rosterShiftFor(data, employee, date);
  return deriveTimesheetDay(
    { date, checkIn, checkOut, status, onLeave: row?.onLeave, restDay: row?.restDay, excusedAbsence: !!(row?.excused || row?.excusedAbsence), breaks: row?.breaks },
    { ...opts, shift, employee, company: data, laborCalendar: laborCalendarOf(data) },
  );
}

export function deriveTimesheetTotals(days) {
  const list = Array.isArray(days) ? days : [];
  let ordinaryMinutes = 0;
  let overtimeMinutes = 0;
  let absenceDays = 0;
  let leaveDays = 0;
  let lateCount = 0;
  let openCheckouts = 0;
  let earlyDepartures = 0;
  let presenceOverCap = 0;
  let workOverCap = 0;
  let noBreak = 0;
  let unrosteredDays = 0;
  for (const d of list) {
    const codes = (d.flags || []).map((flag) => flag.error);
    if (codes.includes("ACTUAL_PRESENCE_OVER_CAP")) presenceOverCap += 1;
    if (codes.includes("ACTUAL_WORK_OVER_CAP")) workOverCap += 1;
    if (codes.includes("ACTUAL_NO_BREAK")) noBreak += 1;
    if (d.checkIn && d.rostered === false) unrosteredDays += 1;
    ordinaryMinutes += d.ordinaryMinutes || 0;
    overtimeMinutes += d.overtimeMinutes || 0;
    if (d.status === "absent" && !d.excused) absenceDays += 1;
    if (d.status === "leave") leaveDays += 1;
    if (d.late) lateCount += 1;
    if (d.openCheckout) openCheckouts += 1;
    if ((d.earlyMinutes || 0) > 0) earlyDepartures += 1;
  }
  return {
    ordinaryMinutes,
    overtimeMinutes,
    ordinaryLabel: formatMinutes(ordinaryMinutes),
    overtimeLabel: formatMinutes(overtimeMinutes),
    absenceDays,
    leaveDays,
    lateCount,
    openCheckouts,
    earlyDepartures,
    presenceOverCap,
    workOverCap,
    noBreak,
    unrosteredDays,
    graceMinutes: GRACE_MINUTES,
    shiftHours: SHIFT_HOURS,
    closesPayroll: true,
  };
}

export function isoWeekKey(dateStr) {
  const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "unknown";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week =
    1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function deriveAttendanceOtAnalysis(days = []) {
  const list = Array.isArray(days) ? days : [];
  const byEmpAbs = new Map();
  const byStationOt = new Map();
  const byEmpWeek = new Map();
  let lateEvents = 0;
  let lateMinutesSum = 0;

  for (const d of list) {
    if ((d.lateMinutes || 0) > 0 || d.status === "late") {
      lateEvents += 1;
      lateMinutesSum += Math.max(0, Number(d.lateMinutes) || 0);
    }
    if (d.status === "absent" && !d.excusedAbsence) {
      const row = byEmpAbs.get(d.employeeId) || {
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        absences: 0,
      };
      row.absences += 1;
      byEmpAbs.set(d.employeeId, row);
    }
    const st = byStationOt.get(d.stationId) || {
      stationId: d.stationId,
      overtimeMinutes: 0,
      heads: new Set(),
    };
    st.overtimeMinutes += Math.max(0, Number(d.overtimeMinutes) || 0);
    st.heads.add(d.employeeId);
    byStationOt.set(d.stationId, st);

    const week = isoWeekKey(d.date);
    const wkKey = `${d.employeeId}|${week}`;
    const worked = Math.max(0, Number(d.ordinaryMinutes) || 0) + Math.max(0, Number(d.overtimeMinutes) || 0);
    byEmpWeek.set(wkKey, (byEmpWeek.get(wkKey) || 0) + worked);
  }

  const repeatAbsence = [...byEmpAbs.values()]
    .filter((e) => e.absences >= 2)
    .sort((a, b) => b.absences - a.absences);

  const stationCapMinutes = WEEKLY_OT_CAP_HOURS * 60;
  const stationsOverCap = [...byStationOt.values()]
    .map((s) => {
      const heads = Math.max(1, s.heads.size);
      const cap = stationCapMinutes * heads;
      return {
        stationId: s.stationId,
        overtimeMinutes: s.overtimeMinutes,
        overtimeHours: Math.round((s.overtimeMinutes / 60) * 10) / 10,
        heads,
        capMinutes: cap,
        overCap: s.overtimeMinutes > cap,
      };
    })
    .filter((s) => s.overCap);

  const individualBreaches = [...byEmpWeek.entries()]
    .filter(([, mins]) => mins > WEEKLY_HOURS_CAP * 60)
    .map(([key, mins]) => {
      const [employeeId, week] = key.split("|");
      return {
        employeeId,
        week,
        workedMinutes: mins,
        capMinutes: WEEKLY_HOURS_CAP * 60,
      };
    });

  return {
    lateEvents,
    avgLateMinutes: lateEvents ? Math.round(lateMinutesSum / lateEvents) : 0,
    repeatAbsence,
    stationsOverCap,
    individualBreaches,
    weeklyHoursCap: WEEKLY_HOURS_CAP,
    weeklyOtCapHours: WEEKLY_OT_CAP_HOURS,
    totalOvertimeMinutes: list.reduce((n, d) => n + Math.max(0, Number(d.overtimeMinutes) || 0), 0),
  };
}

export function formatRunRelative(iso, nowMs, lang) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diffH = Math.floor((nowMs - t) / 3600_000);
  if (diffH < 0) return iso.slice(0, 16).replace("T", " ");
  if (diffH < 18) {
    const hm = new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return lang === "ar" ? `اليوم ${hm}` : `today ${hm}`;
  }
  if (diffH < 42) return lang === "ar" ? "أمس" : "yesterday";
  return new Date(t).toLocaleDateString("en-CA");
}

export function deriveReportCards(lastRuns = {}, nowMs = Date.now()) {
  return REPORT_CATALOG.map((r) => {
    const last = lastRuns[r.id] || null;
    return {
      ...r,
      lastRunAt: last,
      lastRunLabelAr: last ? `آخر تشغيل: ${formatRunRelative(last, nowMs, "ar")}` : "لم يُشغَّل بعد",
      lastRunLabelEn: last ? `Last run: ${formatRunRelative(last, nowMs, "en")}` : "Not run yet",
    };
  });
}

export function checkGenerateReportGate(input) {
  const entry = catalogById(input.reportId);
  if (!entry) {
    return {
      ok: false,
      error: "UNKNOWN_REPORT",
      reason: "نوع التقرير غير معروف.",
      reasonEn: "Unknown report type.",
    };
  }
  if (!actorMayGenerate(input.actor, entry)) {
    return {
      ok: false,
      error: "FORBIDDEN",
      reason: "لا صلاحية لتوليد هذا التقرير.",
      reasonEn: "You are not allowed to generate this report.",
    };
  }
  if (input.scopeEmpty) {
    return {
      ok: false,
      error: "EMPTY_SCOPE",
      reason: "لا بيانات في النطاق المحدد — لا يُصدَّر تقرير فارغ كأنه حقيقة.",
      reasonEn: "No data in the selected scope — an empty report is not emitted as fact.",
    };
  }
  let period = input.period ? String(input.period).trim() : null;
  if (entry.needsPeriod) {
    if (!period || !parsePeriod(period)) {
      return {
        ok: false,
        error: "PERIOD_REQUIRED",
        reason: "يلزم تحديد فترة (YYYY-MM) قبل التوليد.",
        reasonEn: "A period (YYYY-MM) is required before generating.",
      };
    }
  } else {
    period = period && parsePeriod(period) ? period : null;
  }
  return { ok: true, entry, period };
}

export function checkCloseTimesheetGate(input) {
  const employeeId = String(input.employeeId || input.sheet?.employeeId || "").trim();
  if (!employeeId) {
    return {
      ok: false,
      error: "EMPLOYEE_REQUIRED",
      reason: "اختر موظفًا قبل إقفال الكشف.",
      reasonEn: "Pick an employee before closing the timesheet.",
    };
  }
  const period = String(input.period || input.sheet?.period || "").trim();
  if (!parsePeriod(period)) {
    return {
      ok: false,
      error: "PERIOD_REQUIRED",
      reason: "فترة الكشف غير صالحة (YYYY-MM).",
      reasonEn: "Timesheet period is invalid (YYYY-MM).",
    };
  }
  if (input.sheet?.closed) {
    return {
      ok: false,
      error: "ALREADY_CLOSED",
      reason: "الكشف مقفل — لا تعديل إلا بفتح مسبَّب يُقيَّد في سجل التدقيق.",
      reasonEn: "Month already closed — no edit except a justified reopen written to the audit trail.",
    };
  }
  const open = Math.max(0, Number(input.openCheckouts) || 0);
  if (open > 0) {
    return {
      ok: false,
      error: "OPEN_CHECKOUTS",
      reason: `${open} يومًا بلا انصراف — أغلِقها أو سوِّها قبل الإقفال لمسير الرواتب.`,
      reasonEn: `${open} day(s) without check-out — settle them before closing to payroll.`,
    };
  }
  return { ok: true, employeeId, period };
}

export function checkReopenTimesheetGate(input) {
  if (!input.sheet?.closed) {
    return {
      ok: false,
      error: "NOT_CLOSED",
      reason: "الكشف غير مقفل.",
      reasonEn: "Timesheet is not closed.",
    };
  }
  const reason = String(input.reason || "").trim();
  if (reason.length < 3) {
    return {
      ok: false,
      error: "REASON_REQUIRED",
      reason: "فتح الكشف بعد الإقفال يلزم سببًا مكتوبًا يُقيَّد في التدقيق.",
      reasonEn: "Reopening a closed timesheet requires a written reason on the audit trail.",
    };
  }
  return { ok: true, reason };
}

export function sheetKey(employeeId, period) {
  return `${employeeId}::${period}`;
}
