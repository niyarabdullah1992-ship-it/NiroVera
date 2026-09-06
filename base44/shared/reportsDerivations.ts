/** Reports & analytics — library, schedules, attendance/OT timesheet for payroll close.
 *  Design: NiroVera Platform.dc.html (isReports / reportCards / scheduled / sheetTotals / closeMonth).
 *  Daily station board lives in dailyReport — do not duplicate StationDailyBoard here.
 */

import { ruleValue } from "./laborRules.ts";

export const GRACE_MINUTES = ruleValue("hours.grace.minutes");
export const SHIFT_HOURS = ruleValue("hours.shift.ordinaryHours");
export const SHIFT_MINUTES = SHIFT_HOURS * 60;
/** From shift publish checks — weekly ordinary+OT must stay ≤ the in-force weekly cap. */
export const WEEKLY_HOURS_CAP = ruleValue("hours.week.ordinaryMaxHours");
/** Soft per-head weekly OT room under the statutory week (5×ordinary → remainder OT). */
export const WEEKLY_OT_CAP_HOURS = WEEKLY_HOURS_CAP - 5 * SHIFT_HOURS;
export const DEFAULT_SHIFT_START = "07:00";

export type ReportFormat = "PDF" | "XLSX" | "CSV";

export type ReportKind =
  | "consolidated_daily"
  | "cost_per_station"
  | "hse_performance"
  | "attendance_ot"
  | "board_summary"
  | "audit_trail";

export type ReportCatalogEntry = {
  id: ReportKind;
  kickerAr: string;
  kickerEn: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  format: ReportFormat;
  /** Period (YYYY-MM or YYYY-MM-DD) required before generate. */
  needsPeriod: boolean;
  /** Roles that may generate; empty = any authenticated tenant user. */
  roles?: string[];
};

export type ScheduledReportEntry = {
  id: string;
  reportId: ReportKind | "stock_alert";
  titleAr: string;
  titleEn: string;
  recipientsAr: string;
  recipientsEn: string;
  cadenceAr: string;
  cadenceEn: string;
};

export type DayPunchLike = {
  date: string; // YYYY-MM-DD local
  checkIn?: string | null; // HH:mm
  checkOut?: string | null;
  status?: "present" | "late" | "absent" | "leave" | "rest" | string | null;
  onLeave?: boolean;
  restDay?: boolean;
  excusedAbsence?: boolean;
};

export type TimesheetCloseLike = {
  employeeId?: string | null;
  period?: string | null; // YYYY-MM
  closed?: boolean;
  closedAt?: string | null;
  closedBy?: string | null;
  payrollRunId?: string | null;
};

export type OtDayLike = {
  employeeId: string;
  employeeName?: string;
  stationId: string;
  date: string;
  ordinaryMinutes?: number;
  overtimeMinutes?: number;
  lateMinutes?: number;
  status?: string | null;
  excusedAbsence?: boolean;
};

export const REPORT_CATALOG: ReportCatalogEntry[] = [
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
    descAr: "الرواتب والمخزون والصيانة منسوبة لكل فرع على حدة.",
    descEn: "Payroll, inventory and maintenance attributed per station.",
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

export const SCHEDULED_REPORTS: ScheduledReportEntry[] = [
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
  {
    id: "sched_stock",
    reportId: "stock_alert",
    titleAr: "تنبيه المخزون تحت الحد",
    titleEn: "Below-threshold stock alert",
    recipientsAr: "مدير المشتريات",
    recipientsEn: "Procurement Manager",
    cadenceAr: "عند تجاوز الحد",
    cadenceEn: "On threshold breach",
  },
];

export function parseHm(hm: string | null | undefined): number | null {
  const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatMinutes(mins: number): string {
  const n = Math.max(0, Math.round(Number(mins) || 0));
  if (n <= 0) return "—";
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function parsePeriod(period: string | null | undefined): { year: number; month: number } | null {
  const m = String(period || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function catalogById(id: string | null | undefined): ReportCatalogEntry | null {
  return REPORT_CATALOG.find((r) => r.id === id) || null;
}

export function actorMayGenerate(
  actor: { role?: string | null; owner?: boolean; admin?: boolean } | null | undefined,
  entry: ReportCatalogEntry,
): boolean {
  if (!actor) return false;
  if (actor.owner || actor.admin) return true;
  const roles = entry.roles;
  if (!roles || roles.length === 0) return true;
  return roles.includes(String(actor.role || "").toLowerCase());
}

/** Derive one timesheet day under grace + 8 h shift + OT beyond (payroll closes against this). */
export function deriveTimesheetDay(
  punch: DayPunchLike,
  opts: { shiftStart?: string; graceMinutes?: number; shiftMinutes?: number } = {},
) {
  const grace = opts.graceMinutes ?? GRACE_MINUTES;
  const shiftMin = opts.shiftMinutes ?? SHIFT_MINUTES;
  const shiftStart = parseHm(opts.shiftStart || DEFAULT_SHIFT_START) ?? parseHm(DEFAULT_SHIFT_START)!;
  const shiftEnd = shiftStart + shiftMin;

  if (punch.restDay || punch.status === "rest") {
    return {
      date: punch.date,
      status: "rest" as const,
      checkIn: null as string | null,
      checkOut: null as string | null,
      ordinaryMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      openCheckout: false,
      late: false,
    };
  }
  if (punch.onLeave || punch.status === "leave") {
    return {
      date: punch.date,
      status: "leave" as const,
      checkIn: null as string | null,
      checkOut: null as string | null,
      ordinaryMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      openCheckout: false,
      late: false,
    };
  }

  const inM = parseHm(punch.checkIn);
  const outM = parseHm(punch.checkOut);
  if (inM == null) {
    return {
      date: punch.date,
      status: "absent" as const,
      checkIn: null as string | null,
      checkOut: null as string | null,
      ordinaryMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      openCheckout: false,
      late: false,
      excused: !!punch.excusedAbsence,
    };
  }

  const lateMinutes = Math.max(0, inM - shiftStart - grace);
  const late = lateMinutes > 0 || (inM - shiftStart > grace);
  const openCheckout = outM == null;
  let ordinaryMinutes = 0;
  let overtimeMinutes = 0;
  let earlyMinutes = 0;
  if (outM != null) {
    const worked = Math.max(0, outM - inM);
    ordinaryMinutes = Math.min(shiftMin, worked);
    overtimeMinutes = Math.max(0, worked - shiftMin);
    earlyMinutes = Math.max(0, shiftEnd - outM);
  }

  return {
    date: punch.date,
    status: (late ? "late" : "present") as "late" | "present",
    checkIn: punch.checkIn || null,
    checkOut: punch.checkOut || null,
    ordinaryMinutes,
    overtimeMinutes,
    lateMinutes: late ? Math.max(lateMinutes, inM - shiftStart - grace) : 0,
    earlyMinutes,
    openCheckout,
    late,
  };
}

export function deriveTimesheetTotals(
  days: Array<ReturnType<typeof deriveTimesheetDay>>,
) {
  const list = Array.isArray(days) ? days : [];
  let ordinaryMinutes = 0;
  let overtimeMinutes = 0;
  let absenceDays = 0;
  let leaveDays = 0;
  let lateCount = 0;
  let openCheckouts = 0;
  let earlyDepartures = 0;
  for (const d of list) {
    ordinaryMinutes += d.ordinaryMinutes || 0;
    overtimeMinutes += d.overtimeMinutes || 0;
    if (d.status === "absent" && !(d as { excused?: boolean }).excused) absenceDays += 1;
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
    graceMinutes: GRACE_MINUTES,
    shiftHours: SHIFT_HOURS,
    /** Copy from design: document payroll closes against. */
    closesPayroll: true,
  };
}

export function deriveAttendanceOtAnalysis(days: OtDayLike[] = []) {
  const list = Array.isArray(days) ? days : [];
  const byEmpAbs = new Map<string, { employeeId: string; employeeName?: string; absences: number }>();
  const byStationOt = new Map<string, { stationId: string; overtimeMinutes: number; heads: Set<string> }>();
  const byEmpWeek = new Map<string, number>(); // employeeId|week → total minutes
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
      heads: new Set<string>(),
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

/** ISO-like week key from local YYYY-MM-DD (Mon-based). */
export function isoWeekKey(dateStr: string): string {
  const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "unknown";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day + 3);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week =
    1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function deriveReportCards(
  lastRuns: Record<string, string | null | undefined> = {},
  nowMs = Date.now(),
) {
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

export function formatRunRelative(iso: string, nowMs: number, lang: "ar" | "en") {
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

type GateFail = {
  ok: false;
  error: string;
  reason: string;
  reasonEn: string;
};

export function checkGenerateReportGate(input: {
  reportId?: string | null;
  period?: string | null;
  actor?: { role?: string | null; owner?: boolean; admin?: boolean } | null;
  scopeEmpty?: boolean;
}): GateFail | { ok: true; entry: ReportCatalogEntry; period: string | null } {
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
  let period: string | null = input.period ? String(input.period).trim() : null;
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

export function checkCloseTimesheetGate(input: {
  sheet?: TimesheetCloseLike | null;
  employeeId?: string | null;
  period?: string | null;
  openCheckouts?: number;
}): GateFail | { ok: true; employeeId: string; period: string } {
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

export function checkReopenTimesheetGate(input: {
  sheet?: TimesheetCloseLike | null;
  reason?: string | null;
}): GateFail | { ok: true; reason: string } {
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

export function sheetKey(employeeId: string, period: string) {
  return `${employeeId}::${period}`;
}
