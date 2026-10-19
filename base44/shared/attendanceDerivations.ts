/** Attendance derivation — grace, shift, geofence decision, settlement, stats.
 *  Design: NiroVera Platform.dc.html class Component (attendance / GRACE / SHIFT_H / WINDOW).
 *  Status keys are stable IDs — never bind filters to translated labels.
 */

import { addLaborDays, laborDayKey, ruleValue } from "./laborRules.ts";
import { nursingCreditOf, nursingHourOn } from "./nursingHour.ts";

export const GRACE_MINUTES = ruleValue("hours.grace.minutes");
export const SHIFT_HOURS = ruleValue("hours.shift.ordinaryHours");
export const SHIFT_MINUTES = SHIFT_HOURS * 60;
export const SETTLEMENT_WINDOW_DAYS = ruleValue("hours.settlement.windowDays");
export const DEFAULT_SHIFT_START = "07:00";
/** Overtime premium under Labour Law Art. 107 (pay engine applies; here for visibility). */
export const OT_PREMIUM = ruleValue("hours.ot.premium");

/** Stable day-band / roster status IDs. */
export const ATT_STATUS = {
  present: "present",
  late: "late",
  leave: "leave",
  absent: "absent",
  rest: "rest",
} as const;

export type AttStatusId = (typeof ATT_STATUS)[keyof typeof ATT_STATUS];

export const GEO_VERDICT = {
  inside: "inside",
  outside: "outside",
  self_declaration: "self_declaration",
  pending_review: "pending_review",
  accepted_outside: "accepted_outside",
  rejected_outside: "rejected_outside",
} as const;

export type GeoVerdictId = (typeof GEO_VERDICT)[keyof typeof GEO_VERDICT];

export const SETTLEMENT_KINDS = [
  "sick",
  "exam",
  "bereavement",
  "external_duty",
  "force_majeure",
  "statutory_leave",
] as const;

export type SettlementKind = (typeof SETTLEMENT_KINDS)[number];

export type PunchLike = {
  employeeId?: string;
  employeeName?: string;
  stationId?: string | null;
  date?: string; // YYYY-MM-DD local
  checkIn?: string | null; // HH:mm
  checkOut?: string | null;
  onLeave?: boolean;
  restDay?: boolean;
  excusedAbsence?: boolean;
  preventedByEmployer?: boolean;
  geoVerdict?: string | null;
  overtimeApproved?: boolean | null;
  settlement?: {
    kind?: string;
    documentName?: string | null;
    settledAt?: string | null;
    settledBy?: string | null;
    reason?: string | null;
  } | null;
  geoDecision?: {
    decision?: "accept" | "reject";
    reason?: string | null;
    by?: string | null;
    at?: string | null;
  } | null;
};

function parseHm(hm: string | null | undefined) {
  if (!hm) return null;
  const m = String(hm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Local calendar YYYY-MM-DD from date parts — never toISOString(). */
export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(iso: string | null | undefined) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Inclusive local calendar day difference (a → b). */
export function localDayDiff(fromIso: string, toIso: string) {
  const a = parseLocalDate(fromIso);
  const b = parseLocalDate(toIso);
  if (!a || !b) return NaN;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function formatMinutes(total: number) {
  const m = Math.max(0, Math.round(total || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}:${String(r).padStart(2, "0")}`;
}

/**
 * Derive one day under grace + 8 h shift + OT beyond.
 * Status IDs only — UI maps labels separately.
 */
export function deriveDayStatus(
  punch: PunchLike,
  opts: { shiftStart?: string; graceMinutes?: number; shiftMinutes?: number; nursing?: any; employee?: any } = {},
) {
  const grace = opts.graceMinutes ?? GRACE_MINUTES;
  const shiftMin = opts.shiftMinutes ?? SHIFT_MINUTES;
  const shiftStart = parseHm(opts.shiftStart || DEFAULT_SHIFT_START) ?? parseHm(DEFAULT_SHIFT_START)!;
  const shiftEnd = shiftStart + shiftMin;

  if (punch.restDay) {
    return {
      status: ATT_STATUS.rest as AttStatusId,
      checkIn: null as string | null,
      checkOut: null as string | null,
      ordinaryMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
      late: false,
      openCheckout: false,
      excused: false,
    };
  }
  if (punch.onLeave || punch.settlement?.kind === "statutory_leave") {
    return {
      status: ATT_STATUS.leave as AttStatusId,
      checkIn: null as string | null,
      checkOut: null as string | null,
      ordinaryMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
      late: false,
      openCheckout: false,
      excused: true,
    };
  }

  const inM = parseHm(punch.checkIn);
  const outM = parseHm(punch.checkOut);
  if (inM == null) {
    // Model Art. 46: kept from work by the establishment — paid, never an unexcused absence.
    const excused = !!punch.excusedAbsence || !!punch.settlement || !!punch.preventedByEmployer;
    return {
      status: ATT_STATUS.absent as AttStatusId,
      checkIn: null as string | null,
      checkOut: null as string | null,
      ordinaryMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
      late: false,
      openCheckout: false,
      excused,
    };
  }

  // Art. 154: inside her nursing minutes at the start she is not late; the minutes she was away
  // inside them (start / end) are work — ordinary, never overtime (overtime reads the punches alone).
  const nursing = opts.nursing !== undefined ? opts.nursing : (opts.employee ? nursingHourOn(opts.employee, String(punch.date || "").slice(0, 10)) : null);
  const lateMinutes = Math.max(0, inM - shiftStart - grace - (nursing?.startMinutes || 0));
  const late = lateMinutes > 0;
  const openCheckout = outM == null;
  let ordinaryMinutes = 0;
  let overtimeMinutes = 0;
  let nursingCreditMinutes = 0;
  if (outM != null) {
    const worked = Math.max(0, outM - inM);
    nursingCreditMinutes = nursingCreditOf(nursing, { inMinutes: inM, outMinutes: outM, shiftStart, shiftEnd, workedMinutes: worked, rosteredMinutes: shiftMin }).minutes;
    ordinaryMinutes = Math.min(shiftMin, worked + nursingCreditMinutes);
    overtimeMinutes = Math.max(0, worked - shiftMin);
  }

  return {
    status: (late ? ATT_STATUS.late : ATT_STATUS.present) as AttStatusId,
    checkIn: punch.checkIn || null,
    checkOut: punch.checkOut || null,
    ordinaryMinutes,
    overtimeMinutes,
    lateMinutes,
    late,
    openCheckout,
    excused: false,
    nursingCreditMinutes,
    shiftEndMinutes: shiftEnd,
  };
}

/** Effective geo verdict after manager decision; raw coords must already be discarded. */
export function deriveGeoVerdict(punch: PunchLike, geofenceOn: boolean): GeoVerdictId {
  if (!geofenceOn) return GEO_VERDICT.self_declaration;
  const decision = punch.geoDecision?.decision;
  if (decision === "accept") return GEO_VERDICT.accepted_outside;
  if (decision === "reject") return GEO_VERDICT.rejected_outside;
  const raw = String(punch.geoVerdict || "");
  if (raw === GEO_VERDICT.outside || raw === "outside") return GEO_VERDICT.pending_review;
  if (raw === GEO_VERDICT.inside || raw === "inside") return GEO_VERDICT.inside;
  if (raw === GEO_VERDICT.self_declaration) return GEO_VERDICT.self_declaration;
  return GEO_VERDICT.inside;
}

export function checkOutOfGeofenceGate(input: {
  decision?: string | null;
  reason?: string | null;
  geoVerdict?: string | null;
}) {
  const verdict = String(input.geoVerdict || "");
  if (verdict !== GEO_VERDICT.outside && verdict !== "outside" && verdict !== GEO_VERDICT.pending_review) {
    return {
      ok: false as const,
      error: "NOT_OUTSIDE_GEOFENCE",
      reason: "لا قرار مطلوب — التسجيل ليس خارج النطاق.",
      reasonEn: "No decision required — check-in is not outside the geofence.",
    };
  }
  const decision = String(input.decision || "");
  if (decision !== "accept" && decision !== "reject") {
    return {
      ok: false as const,
      error: "DECISION_REQUIRED",
      reason: "يلزم قبول بمبرر مكتوب أو رفض — لا زر صامت.",
      reasonEn: "Accept with a written reason or reject — no silent action.",
    };
  }
  if (decision === "accept" && !String(input.reason || "").trim()) {
    return {
      ok: false as const,
      error: "REASON_REQUIRED",
      reason: "قبول خارج النطاق يتطلب مبررًا مكتوبًا باسم المراجع.",
      reasonEn: "Accepting an out-of-geofence check-in requires a written reason under the reviewer's name.",
    };
  }
  return { ok: true as const, decision: decision as "accept" | "reject" };
}

export function checkSettleAbsenceGate(input: {
  absenceDate?: string | null;
  today?: string | null;
  kind?: string | null;
  documentName?: string | null;
  alreadySettled?: boolean;
}) {
  if (input.alreadySettled) {
    return {
      ok: false as const,
      error: "ALREADY_SETTLED",
      reason: "هذا اليوم مُسوّى مسبقًا — القيد الأصلي يبقى في التدقيق.",
      reasonEn: "This day is already settled — the original entry stays in the audit trail.",
    };
  }
  const absenceDate = String(input.absenceDate || "");
  const today = String(input.today || localDateKey());
  if (!parseLocalDate(absenceDate)) {
    return {
      ok: false as const,
      error: "INVALID_DATE",
      reason: "تاريخ الغياب غير صالح.",
      reasonEn: "Absence date is invalid.",
    };
  }
  const days = localDayDiff(absenceDate, today);
  if (!Number.isFinite(days) || days < 0) {
    return {
      ok: false as const,
      error: "FUTURE_DATE",
      reason: "لا تسوية لتاريخ في المستقبل.",
      reasonEn: "Cannot settle a future date.",
    };
  }
  if (days > SETTLEMENT_WINDOW_DAYS) {
    return {
      ok: false as const,
      error: "SETTLEMENT_WINDOW_CLOSED",
      reason: `مضى أكثر من ${SETTLEMENT_WINDOW_DAYS} يومًا — التسوية هنا مغلقة، ويُقدَّم الطلب للموارد البشرية بقرار مكتوب.`,
      reasonEn: `More than ${SETTLEMENT_WINDOW_DAYS} days have passed — settlement is closed here and the request goes to HR for a written decision.`,
      windowDays: SETTLEMENT_WINDOW_DAYS,
      days,
    };
  }
  const kind = String(input.kind || "");
  if (!(SETTLEMENT_KINDS as readonly string[]).includes(kind)) {
    return {
      ok: false as const,
      error: "KIND_REQUIRED",
      reason: "يلزم نوع تسوية ثابت (مرض · امتحان · واجب خارجي · …).",
      reasonEn: "A stable settlement kind is required (sick · exam · external duty · …).",
    };
  }
  if (!String(input.documentName || "").trim()) {
    return {
      ok: false as const,
      error: "DOCUMENT_REQUIRED",
      reason: "التسوية تتطلب مستندًا مرفقًا — القيد الأصلي لا يُمحى.",
      reasonEn: "Settlement requires an attached document — the original entry is never erased.",
    };
  }
  return { ok: true as const, days, windowDays: SETTLEMENT_WINDOW_DAYS };
}

export function checkOtDecisionGate(input: {
  overtimeMinutes?: number;
  decision?: string | null;
  alreadyDecided?: boolean | null;
  workerConsent?: boolean | null;
  consent?: boolean | null;
  overtimeHoursYtd?: number | null;
  annualCapConsent?: boolean | null;
  creditDaysYtd?: number | null;
  enjoyDate?: string | null;
  windowAgreed?: boolean | null;
  onDate?: string | Date | null;
  workedProven?: boolean | null;
  ordered?: boolean | null;
  reason?: string | null;
}) {
  const ot = Math.max(0, Number(input.overtimeMinutes) || 0);
  if (ot <= 0) {
    return {
      ok: false as const,
      error: "NO_OVERTIME",
      reason: "لا ساعات إضافية للاعتماد في هذا اليوم.",
      reasonEn: "No overtime minutes to decide on this day.",
    };
  }
  if (input.alreadyDecided === true) {
    return {
      ok: false as const,
      error: "ALREADY_DECIDED",
      reason: "قرار الإضافي مُسجَّل — يبقى ظاهرًا في الكشف.",
      reasonEn: "Overtime decision is already recorded — it stays visible on the timesheet.",
    };
  }
  let decision = String(input.decision || "");
  if (decision === "pay") decision = "approve";
  if (decision === "credit") decision = "comp_leave";
  if (!decision) decision = "approve";
  if (decision !== "approve" && decision !== "reject" && decision !== "comp_leave") {
    return {
      ok: false as const,
      error: "DECISION_REQUIRED",
      reason: "يلزم اعتماد الإضافي للصرف، أو رفضه، أو إجازة تعويضية بموافقة العامل — الساعات تبقى مسجّلة.",
      reasonEn: "Approve overtime for pay, reject it, or grant compensatory leave with the worker's consent — hours stay recorded.",
    };
  }
  // Art. 107 — the manager decides the punched hours. Hours the employer ordered (an approved overtime
  // assignment, or a rostered holiday duty) and the punches proved are owed: pay or compensatory leave,
  // never «not worked». Punches past the shift with no order (a late or forgotten checkout) are the
  // manager's call: pay, compensatory leave, or «not worked» with a written reason the worker receives.
  if (decision === "reject" && input.workedProven === true) {
    const ordered = input.ordered !== false;
    if (ordered) {
      return {
        ok: false as const,
        error: "OT_WORKED_NO_REJECT",
        reason: "موقوف — المادة 107: ساعات بتكليف معتمد أو دوام عطلة مجدول، والحضور والانصراف يثبتان أنها عُملت، فأجرها واجب. اختر الصرف بأجر الساعة + 50% أو إجازة تعويضية بموافقة العامل.",
        reasonEn: "Blocked — Article 107: hours under an approved assignment or a rostered holiday duty, proven by the punches, are owed. Choose pay at hourly + 50% or compensatory leave with the worker's consent.",
      };
    }
    if (String(input.reason || "").trim().length < 3) {
      return {
        ok: false as const,
        error: "OT_REJECT_REASON",
        reason: "يبقى: اكتب سبب «لم يُعمل» — يصل للعامل ويُحفظ في سجل التدقيق، وله الاعتراض عليه.",
        reasonEn: "Still needed: write why the hours were not worked — the worker receives it, it is kept in the audit trail, and he may object.",
      };
    }
  }
  const onDate = laborDayKey(input.onDate);
  if (decision === "comp_leave") {
    const consent = input.workerConsent === true || input.consent === true;
    if (!consent) {
      return {
        ok: false as const,
        error: "COMP_LEAVE_CONSENT",
        reason: "موقوف — المادة 107: الإجازة التعويضية بدل أجر الإضافي لا تكون إلا بموافقة العامل المسجّلة. بلا موافقة يبقى الصرف.",
        reasonEn: "Blocked — Article 107: compensatory leave instead of overtime pay needs the worker's recorded consent. Without consent, pay remains the default.",
      };
    }
    const windowDays = ruleValue("hours.ot.compLeave.windowDays", onDate);
    let enjoy = String(input.enjoyDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(enjoy) && /^\d{4}-\d{2}-\d{2}$/.test(onDate)) {
      enjoy = addLaborDays(onDate, windowDays - 1);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(enjoy) && /^\d{4}-\d{2}-\d{2}$/.test(onDate)) {
      const latest = addLaborDays(onDate, windowDays - 1);
      if (enjoy > latest && input.windowAgreed !== true) {
        return {
          ok: false as const,
          error: "COMP_LEAVE_WINDOW",
          reason: `موقوف — اللائحة مادة 22 مكرر: يُحدَّد موعد التمتع بالإجازة التعويضية خلال ${windowDays} يوماً من الإضافي ما لم يُتفق على خلاف ذلك.`,
          reasonEn: `Blocked — implementing regulations Art. 22 bis: the date for taking compensatory leave is set within ${windowDays} days of the overtime unless otherwise agreed.`,
          enjoyDate: enjoy,
          latest,
          windowDays,
        };
      }
    }
    const perHour = ruleValue("hours.ot.compLeave.minHoursPerOtHour", onDate);
    const dayHours = ruleValue("hours.shift.ordinaryHours", onDate);
    const addDays = Math.round((((ot / 60) * perHour) / dayHours) * 1000) / 1000;
    const usedDays = Math.max(0, Number(input.creditDaysYtd) || 0);
    const yearCap = ruleValue("hours.ot.compLeave.maxDaysPerYear", onDate);
    if (usedDays + addDays > yearCap) {
      return {
        ok: false as const,
        error: "COMP_LEAVE_YEAR_CAP",
        reason: `موقوف — اللائحة مادة 22 مكرر: الإجازة التعويضية لا تزيد على ${yearCap} يوماً في السنة. المستخدم ${usedDays} وهذا القرار ${addDays}.`,
        reasonEn: `Blocked — implementing regulations Art. 22 bis: compensatory leave may not exceed ${yearCap} days in the year. Used ${usedDays}; this decision adds ${addDays}.`,
        cap: yearCap,
        used: usedDays,
        add: addDays,
      };
    }
  }
  const ytd = Math.max(0, Number(input.overtimeHoursYtd) || 0);
  const add = ot / 60;
  const cap = ruleValue("hours.ot.annualMaxHours", onDate);
  if (decision !== "reject" && ytd + add > cap && input.annualCapConsent !== true) {
    return {
      ok: false as const,
      error: "OT_ANNUAL_CAP",
      reason: `تنبيه — اللائحة مادة 22: ساعات الإضافي السنوية لا تزيد على ${cap} ساعة إلا بموافقة العامل. المستخدم ${ytd} وهذا القرار ${add}.`,
      reasonEn: `Notice — implementing regulations Art. 22: annual overtime may not exceed ${cap} hours unless the worker consents. Used ${ytd}; this decision adds ${add}.`,
      cap,
      ytd,
      add,
    };
  }
  return { ok: true as const, decision: decision as "approve" | "reject" | "comp_leave", overtimeMinutes: ot, workerConsent: decision === "comp_leave" };
}

export type RosterRow = PunchLike & {
  status: AttStatusId;
  lateMinutes: number;
  ordinaryMinutes: number;
  overtimeMinutes: number;
  geo: GeoVerdictId;
  workedLabel: string;
};

export function buildRosterRow(
  punch: PunchLike,
  opts: { geofenceOn?: boolean; shiftStart?: string; employee?: any; nursing?: any } = {},
): RosterRow {
  const day = deriveDayStatus(punch, { shiftStart: opts.shiftStart, employee: opts.employee, nursing: opts.nursing });
  let status = day.status;
  const geo = deriveGeoVerdict(punch, opts.geofenceOn !== false);
  if (geo === GEO_VERDICT.rejected_outside && status !== ATT_STATUS.leave && status !== ATT_STATUS.rest) {
    status = ATT_STATUS.absent;
  }
  return {
    ...punch,
    status,
    lateMinutes: day.lateMinutes,
    ordinaryMinutes: day.ordinaryMinutes,
    overtimeMinutes: day.overtimeMinutes,
    geo,
    workedLabel: day.openCheckout && day.checkIn
      ? "—"
      : formatMinutes(day.ordinaryMinutes + day.overtimeMinutes),
  };
}

/** Filter chips must use stable status IDs. */
export function filterRosterByStatus(rows: RosterRow[], statusId: string | "all") {
  if (!statusId || statusId === "all") return rows;
  return rows.filter((r) => r.status === statusId);
}

/** Derived attStats strip — never store these as literals. */
export function deriveAttStats(rows: RosterRow[], geofenceOn: boolean) {
  const list = Array.isArray(rows) ? rows : [];
  const scheduled = list.filter((r) => r.status !== ATT_STATUS.rest).length;
  const presentLike = list.filter((r) => r.status === ATT_STATUS.present || r.status === ATT_STATUS.late).length;
  const rate = scheduled > 0 ? Math.round((presentLike / scheduled) * 100) : 0;
  const lateRows = list.filter((r) => r.lateMinutes > 0);
  const avgLate = lateRows.length
    ? Math.round(lateRows.reduce((s, r) => s + r.lateMinutes, 0) / lateRows.length)
    : 0;
  const outside = list.filter(
    (r) =>
      r.geo === GEO_VERDICT.outside ||
      r.geo === GEO_VERDICT.pending_review ||
      r.geo === GEO_VERDICT.accepted_outside,
  ).length;
  const workMinutes = list.reduce((s, r) => s + r.ordinaryMinutes + r.overtimeMinutes, 0);
  const absent = list.filter((r) => r.status === ATT_STATUS.absent && !r.excusedAbsence && !r.settlement && !r.preventedByEmployer).length;

  return {
    rate,
    scheduled,
    presentLike,
    avgLateMinutes: avgLate,
    graceMinutes: GRACE_MINUTES,
    outsideNeedingReview: geofenceOn ? outside : 0,
    geofenceOn,
    workHours: Math.round((workMinutes / 60) * 10) / 10,
    absentUnexcused: absent,
    shiftHours: SHIFT_HOURS,
  };
}

/** Twin of src/lib/attendanceDerivations.js — minutes the check-in opens before a published shift (default 60). */
export const EARLY_CHECKIN_DEFAULT = 60;
export function earlyCheckInMinutesOf(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : EARLY_CHECKIN_DEFAULT;
}

/** Twin of checkEarlyCheckInGate: a check-in before the window opens is refused; the reply says when it opens. */
export function checkEarlyCheckInGate(shift: { start?: string } | null | undefined, nowMin: number | null, windowMin: number = EARLY_CHECKIN_DEFAULT) {
  const m = String(shift?.start || "").match(/^(\d{1,2}):(\d{2})$/);
  const start = m ? Number(m[1]) * 60 + Number(m[2]) : null;
  if (start == null || nowMin == null) return { ok: true } as const;
  const until = start - nowMin;
  if (until <= windowMin) return { ok: true } as const;
  const open = ((start - windowMin) % 1440 + 1440) % 1440;
  const hm = `${String(Math.floor(open / 60)).padStart(2, "0")}:${String(open % 60).padStart(2, "0")}`;
  return {
    ok: false,
    error: "TOO_EARLY",
    opensAt: hm,
    reason: `يُفتح الحضور قبل ورديتك بـ${windowMin} دقيقة — من الساعة ${hm}.`,
    reasonEn: `Check-in opens ${windowMin} minutes before your shift — from ${hm}.`,
  } as const;
}

const hmMinutesOf = (value: unknown): number | null => {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Twin of isOvernightShift: the end falls on the next calendar day (end ≤ start). */
export function isOvernightShift(shift: { start?: string; end?: string } | null | undefined): boolean {
  const start = hmMinutesOf(shift?.start);
  const end = hmMinutesOf(shift?.end);
  return start != null && end != null && end <= start;
}

/** Twin of previousDateKey. */
export function previousDateKey(dateKey: string): string {
  const m = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - 1)).toISOString().slice(0, 10);
}

/** Twin of checkLateCheckInGate's grace: minutes after a shift's end the self check-in still opens. */
export const LATE_CHECKIN_GRACE_MINUTES = 60;

/**
 * Twin of overnightCarryOpen: after midnight yesterday's overnight duty is still the duty day while
 * nothing is checked in today and today's own check-in window has not opened, and either its row is
 * open, or it was not punched at all and its end (+ the late check-in grace) has not passed.
 */
export function overnightCarryOpen(input: {
  yesterdayRow?: { check_in_at?: string | null; check_out_at?: string | null; checkInAt?: string | null; checkOutAt?: string | null } | null;
  yesterdayShift?: { start?: string; end?: string } | null;
  todayRow?: { check_in_at?: string | null; checkInAt?: string | null } | null;
  todayShift?: { start?: string } | null;
  nowMin?: number | null;
  earlyWindowMin?: number;
  lateGraceMin?: number;
}): boolean {
  const { yesterdayRow, yesterdayShift, todayRow = null, todayShift = null, nowMin = null, earlyWindowMin = EARLY_CHECKIN_DEFAULT, lateGraceMin = LATE_CHECKIN_GRACE_MINUTES } = input || {};
  if (!isOvernightShift(yesterdayShift)) return false;
  if (todayRow?.check_in_at || todayRow?.checkInAt) return false;
  if (todayShift?.start && nowMin != null && checkEarlyCheckInGate(todayShift, nowMin, earlyWindowMin).ok) return false;
  const inAt = yesterdayRow?.check_in_at || yesterdayRow?.checkInAt;
  const outAt = yesterdayRow?.check_out_at || yesterdayRow?.checkOutAt;
  if (inAt && !outAt) return true;
  if (inAt || outAt || nowMin == null) return false;
  return nowMin <= (hmMinutesOf(yesterdayShift?.end) ?? 0) + Math.max(0, Number(lateGraceMin) || 0);
}

/**
 * Twin of lateMinutesFromScheduledStart: max(0, in − start − grace − excused) on the duty day's clock
 * (≥ 1440 after the midnight of an overnight shift) — the same reading as deriveActualDuty.
 */
export function lateMinutesFromScheduledStart(nowMinutes: number, scheduledStart: string | null | undefined, graceMinutes: number = ruleValue("hours.grace.minutes"), excusedMinutes = 0) {
  const startMinutes = hmMinutesOf(scheduledStart);
  if (startMinutes == null) return { error: "NOT_SCHEDULED", lateMinutes: 0, status: null } as const;
  const grace = Math.max(0, Number(graceMinutes) || 0);
  const excused = Math.max(0, Number(excusedMinutes) || 0);
  const lateMinutes = Math.max(0, Number(nowMinutes) - startMinutes - grace - excused);
  return { lateMinutes, status: lateMinutes > 0 ? "late" : "present" } as const;
}

/** Twin of checkLateCheckInGate: after the shift has ended (+ grace) a self check-in is closed. */
export function checkLateCheckInGate(shift: { start?: string; end?: string } | null | undefined, nowMin: number | null, graceMin: number = LATE_CHECKIN_GRACE_MINUTES) {
  const start = hmMinutesOf(shift?.start);
  const end = hmMinutesOf(shift?.end);
  if (end == null || nowMin == null) return { ok: true } as const;
  // Overnight: never ended on its start day; on the duty day's clock (≥ 1440) it ends at end + 1440.
  const endAbs = start != null && end <= start ? (nowMin >= 1440 ? end + 1440 : null) : end;
  if (endAbs == null) return { ok: true } as const;
  if (!(nowMin > endAbs + graceMin)) return { ok: true } as const;
  return {
    ok: false,
    error: "SHIFT_ENDED",
    endsAt: shift?.end,
    reason: `انتهت ورديتك ${shift?.end} — لا تُفتح بصمة الحضور بعدها. إن كنت حضرت فاطلب تسجيلاً يدوياً من «نسيت البصمة؟».`,
    reasonEn: `Your shift ended at ${shift?.end} — check-in does not open after it. If you were at work, request a manual entry from «Forgot to punch?».`,
  } as const;
}
