/** Reports & analytics — library, schedules, attendance/OT timesheet for payroll close.
 *  Design: NiroVera Platform.dc.html (isReports / reportCards / scheduled / sheetTotals / closeMonth).
 *  Daily station board lives in dailyReport — do not duplicate StationDailyBoard here.
 */

import { citeRule, ruleValue } from "./laborRules.ts";
import { checkConsecutiveWorkGate, minutesBetween, shiftRestMinutes } from "./shiftDerivations.ts";
import { isOfficialHolidayDay } from "./leaveDerivations.ts";
import { actualShiftHours, art108Limits, hoursBasisOf, hoursPolicyOf, isEmployeeOffDay, isTwelveStayDuty, ordinaryDayCap } from "./laborHoursPolicy.ts";

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
  reportId: ReportKind;
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

/** "HH:MM", or an ISO instant on the Riyadh clock → minutes after midnight (twin of actualDuty.js punchClockMinutes). */
export function punchClockMinutes(value: any): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const hm = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const part = (type: string) => Number(parts.find((row) => row.type === type)?.value || 0);
  return part("hour") * 60 + part("minute");
}

const clockOf = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * Server twin of src/lib/actualDuty.js deriveActualDuty for the timesheet: rostered shift, rest deducted
 * (Art. 102), overtime per Art. 107 (holiday / unrostered rest day in full; weekly criterion beyond the
 * roster; else beyond the day cap — juvenile 164 / Art. 108 category / Ramadan / Art. 99 / 8 h), and the
 * flags presence over the stay cap (Art. 101 or the Regs Art. 23 ceiling), work over 10 h (Art. 106 or
 * the category cap), more than five hours without a break (Art. 101 / category). Same rule rows.
 */
export function deriveActualDutyCore(input: {
  checkIn?: any; checkOut?: any; shift?: any; onDate: string; employee?: any; company?: any; laborCalendar?: any; breaks?: any[] | null;
}) {
  const { checkIn, checkOut, shift = null, onDate, employee, company, laborCalendar } = input;
  const inM = punchClockMinutes(checkIn);
  const outRaw = punchClockMinutes(checkOut);
  if (inM == null || outRaw == null) {
    return { ok: false, open: true, reason: "لا انصراف مسجّل بعد — لا تُحسب ساعات.", reasonEn: "No checkout yet — no hours are computed." } as any;
  }
  const outM = outRaw <= inM ? outRaw + 1440 : outRaw;
  const presence = outM - inM;
  const consecMax = ruleValue("hours.rest.maxConsecutiveHours", onDate) || 5;
  const recordedBreaks = Array.isArray(input.breaks) ? input.breaks : null;
  const breakMinutes = recordedBreaks
    ? recordedBreaks.reduce((sum: number, row: any) => sum + (row?.start && row?.end ? minutesBetween(row.start, row.end) : Math.max(0, Number(row?.minutes) || 0)), 0)
    : null;
  const rosterRest = shift ? shiftRestMinutes(shift) : null;
  const statutoryRest = ruleValue("hours.rest.duringShiftMinutes", onDate) || 30;
  const rest = breakMinutes != null ? breakMinutes : (presence > consecMax * 60 ? (rosterRest == null ? statutoryRest : rosterRest) : 0);
  const worked = Math.max(0, presence - Math.min(rest, presence));

  const holiday = isOfficialHolidayDay(onDate, laborCalendar);
  const offDay = !shift && isEmployeeOffDay(onDate, company, employee);
  const rosteredMinutes = shift ? Math.round(actualShiftHours(shift, onDate, employee) * 60) : 0;
  const basis = hoursBasisOf(company, employee).basis;
  const weeklyCriterion = basis === "weekly" || (shift && isTwelveStayDuty(shift, onDate));
  const dayCapMinutes = Math.round((ordinaryDayCap(employee, company, onDate, laborCalendar) || 8) * 60);

  let overtime = 0;
  let kind = "";
  if (holiday) { overtime = worked; kind = "holiday"; }
  else if (offDay) { overtime = worked; kind = "weekly_rest"; }
  else if (weeklyCriterion) { overtime = Math.max(0, worked - rosteredMinutes); kind = overtime ? "beyond_roster" : ""; }
  else if (Number.isFinite(dayCapMinutes)) { overtime = Math.max(0, worked - dayCapMinutes); kind = overtime ? "beyond_day_cap" : ""; }
  const grace = ruleValue("hours.grace.minutes", onDate) || 0;
  const shiftStart = shift?.start ? punchClockMinutes(shift.start) : null;
  const lateMinutes = shiftStart == null ? 0 : Math.max(0, inM - shiftStart - grace);

  const limits = art108Limits(employee, onDate, laborCalendar);
  const policy = hoursPolicyOf(company, employee);
  const stayCap = limits ? limits.workplaceHours : ruleValue("hours.workplace.maxHours", onDate);
  const workCap = limits ? limits.dayHours : ruleValue("hours.ot.exceptionDayHours", onDate);
  const flags: any[] = [];
  if (presence > stayCap * 60) {
    flags.push({
      error: "ACTUAL_PRESENCE_OVER_CAP",
      article: limits ? "اللائحة م23" : "101",
      reason: `بقاء فعلي ${Math.round((presence / 60) * 10) / 10} ساعة في موقع العمل فوق ${stayCap} — ${limits ? "اللائحة م23" : "المادة 101"}.`,
      reasonEn: `Actual presence ${Math.round((presence / 60) * 10) / 10} h at the workplace above ${stayCap} — ${limits ? "Regs Art. 23" : "Art. 101"}.`,
      cite: citeRule("hours.workplace.maxHours", onDate),
    });
  }
  if (worked > workCap * 60) {
    flags.push({
      error: "ACTUAL_WORK_OVER_CAP",
      article: limits ? "اللائحة م23" : "106",
      reason: `عمل فعلي ${Math.round((worked / 60) * 10) / 10} ساعة فوق ${Math.round(workCap * 100) / 100} — ${limits ? "سقف فئة المادة 108 (اللائحة م23)" : "المادة 106"}.`,
      reasonEn: `Actual work ${Math.round((worked / 60) * 10) / 10} h above ${Math.round(workCap * 100) / 100} — ${limits ? "Art. 108 category cap (Regs Art. 23)" : "Art. 106"}.`,
      cite: citeRule("hours.ot.exceptionDayHours", onDate),
    });
  }
  const consec = checkConsecutiveWorkGate({
    start: clockOf(inM),
    end: clockOf(outM),
    breaks: recordedBreaks || undefined,
    restMinutes: recordedBreaks ? breakMinutes : (presence > consecMax * 60 ? (rosterRest == null ? undefined : rosterRest) : 0),
    breakCount: shift?.breakCount,
    onDate,
    continuous103: policy.continuousWork103 === true,
    maxConsecutiveHours: limits?.consecutiveHours || undefined,
    exempt101: !!limits && limits.consecutiveHours == null,
  });
  if (!consec.ok) flags.push({ error: "ACTUAL_NO_BREAK", article: "101", reason: consec.reason, reasonEn: consec.reasonEn, cite: consec.cite });
  return {
    ok: true,
    open: false,
    presenceMinutes: presence,
    restMinutes: Math.min(rest, presence),
    workedMinutes: worked,
    rosteredMinutes,
    ordinaryMinutes: Math.max(0, worked - overtime),
    overtimeMinutes: overtime,
    lateMinutes,
    holiday,
    offDay,
    kind,
    flags,
  };
}

function rosterWindow(shift: any) {
  const start = parseHm(shift?.start);
  const endRaw = parseHm(shift?.end);
  if (start == null || endRaw == null) return null;
  return { start, end: endRaw <= start ? endRaw + 1440 : endRaw };
}

function emptyDay(punch: DayPunchLike, status: string, extra: Record<string, unknown> = {}): any {
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
 * One timesheet day against the ROSTERED shift for that person and day (twin of the client
 * reportsDerivations.js) — never a fixed 07:00 / 8 h. opts.duty (a client deriveActualDuty) wins.
 */
export function deriveTimesheetDay(
  punch: DayPunchLike & { shift?: any; breaks?: any[] },
  opts: { graceMinutes?: number; shift?: any; employee?: any; company?: any; laborCalendar?: any; breaks?: any[]; duty?: any } = {},
): any {
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
  const lateMinutes = win ? Math.max(0, inM - win.start - grace) : 0;
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
  if (openCheckout) return { ...base, ordinaryMinutes: 0, overtimeMinutes: 0, earlyMinutes: 0, flags: [] };
  const duty = opts.duty || deriveActualDutyCore({
    checkIn: punch.checkIn,
    checkOut: punch.checkOut,
    shift,
    onDate: punch.date,
    employee: opts.employee,
    company: opts.company,
    laborCalendar: opts.laborCalendar,
    breaks: punch.breaks ?? opts.breaks,
  });
  const outAbs = (outM as number) <= inM ? (outM as number) + 1440 : (outM as number);
  return {
    ...base,
    ordinaryMinutes: duty.ordinaryMinutes || 0,
    overtimeMinutes: duty.overtimeMinutes || 0,
    earlyMinutes: win ? Math.max(0, win.end - outAbs) : 0,
    presenceMinutes: duty.presenceMinutes || 0,
    restMinutes: duty.restMinutes || 0,
    workedMinutes: duty.workedMinutes || 0,
    rosteredMinutes: duty.rosteredMinutes || 0,
    overtimeKind: duty.kind || "",
    holiday: !!duty.holiday,
    flags: (duty.flags || []).map((flag: any) => ({ error: flag.error, article: flag.article, reason: flag.reason, reasonEn: flag.reasonEn })),
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
  let presenceOverCap = 0;
  let workOverCap = 0;
  let noBreak = 0;
  let unrosteredDays = 0;
  for (const d of list) {
    const codes = (d.flags || []).map((flag: any) => flag.error);
    if (codes.includes("ACTUAL_PRESENCE_OVER_CAP")) presenceOverCap += 1;
    if (codes.includes("ACTUAL_WORK_OVER_CAP")) workOverCap += 1;
    if (codes.includes("ACTUAL_NO_BREAK")) noBreak += 1;
    if (d.checkIn && d.rostered === false) unrosteredDays += 1;
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
    presenceOverCap,
    workOverCap,
    noBreak,
    unrosteredDays,
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
