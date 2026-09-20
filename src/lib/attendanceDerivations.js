/** Client mirror of base44/shared/attendanceDerivations.ts
 *  Keep in sync — grace, shift, geofence decision, settlement, stats.
 */

import { addLaborDays, laborDayKey, ruleValue } from "./laborRules.js";
import { extraCoverageStationIds } from "./stationTree.js";
import { toRiyadhDateKey } from "./riyadhDate.js";

const SHIFT_HM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function hmToMinutes(hhmm) {
  if (!SHIFT_HM.test(String(hhmm || ""))) return null;
  const [hours, minutes] = String(hhmm).split(":").map(Number);
  return hours * 60 + minutes;
}

/** Employee self-punch requires today's published rota. Manager manual override is separate. */
export function selfPunchScheduleGate(shift) {
  if (!shift?.start || hmToMinutes(shift.start) == null) {
    return { ok: false, error: "NOT_SCHEDULED" };
  }
  return { ok: true, start: shift.start, end: shift.end || null };
}

/** Late minutes from scheduled start only — never a company default clock. */
export function lateMinutesFromScheduledStart(nowMinutes, scheduledStart, graceMinutes = 0) {
  const startMinutes = hmToMinutes(scheduledStart);
  if (startMinutes == null) return { error: "NOT_SCHEDULED", lateMinutes: 0, status: null };
  const lateMinutes = Math.max(0, Number(nowMinutes) - startMinutes);
  const grace = Math.max(0, Number(graceMinutes) || 0);
  return { lateMinutes, status: lateMinutes > grace ? "late" : "present" };
}

/** Early checkout only when the rota has an end. No invented clock. */
export function earlyCheckoutFromScheduledEnd(nowMinutes, scheduledEnd) {
  const endMinutes = hmToMinutes(scheduledEnd);
  if (endMinutes == null) return { earlyCheckout: false };
  return { earlyCheckout: Number(nowMinutes) < endMinutes };
}

/** Open check-in still running more than an hour after the published shift end. */
export function isForgottenCheckout(shift, attendance, now = Date.now()) {
  const checkIn = attendance?.check_in_at || attendance?.checkInAt;
  const checkOut = attendance?.check_out_at || attendance?.checkOutAt;
  if (!checkIn || checkOut || !shift?.end) return false;
  const endMins = hmToMinutes(shift.end);
  const startMins = hmToMinutes(shift.start);
  if (endMins == null) return false;
  const checkInAt = new Date(checkIn);
  if (Number.isNaN(checkInAt.getTime())) return false;
  const endAt = new Date(checkInAt);
  endAt.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0);
  if (startMins != null && endMins <= startMins) {
    if (endAt.getTime() <= checkInAt.getTime()) endAt.setDate(endAt.getDate() + 1);
  } else if (endAt.getTime() < checkInAt.getTime()) {
    endAt.setDate(endAt.getDate() + 1);
  }
  return now > endAt.getTime() + 60 * 60 * 1000;
}

export function getTodaysShift(data, employee) {
  if (!employee?.id) return null;
  const stationIds = [employee.stationId || data?.stations?.[0]?.id, ...extraCoverageStationIds(employee, data)].filter(Boolean);
  const dateKey = toRiyadhDateKey();
  for (const stationId of stationIds) {
    const schedule = (data?.schedules || []).find((s) => s.stationId === stationId);
    for (const st of schedule?.shiftTypes || []) {
      const ids = schedule.assignments?.[dateKey]?.[st.id] || [];
      if (ids.includes(employee.id)) return { start: st.start, end: st.end, label: st.label, stationId };
    }
  }
  return null;
}

export const GRACE_MINUTES = ruleValue("hours.grace.minutes");
export const SHIFT_HOURS = ruleValue("hours.shift.ordinaryHours");
export const SHIFT_MINUTES = SHIFT_HOURS * 60;
export const SETTLEMENT_WINDOW_DAYS = ruleValue("hours.settlement.windowDays");
export const DEFAULT_SHIFT_START = "07:00";
export const OT_PREMIUM = ruleValue("hours.ot.premium");

export const ATT_STATUS = {
  present: "present",
  late: "late",
  leave: "leave",
  absent: "absent",
  rest: "rest",
};

export const GEO_VERDICT = {
  inside: "inside",
  outside: "outside",
  self_declaration: "self_declaration",
  pending_review: "pending_review",
  accepted_outside: "accepted_outside",
  rejected_outside: "rejected_outside",
};

export const SETTLEMENT_KINDS = [
  "sick",
  "exam",
  "bereavement",
  "external_duty",
  "force_majeure",
  "statutory_leave",
];

function parseHm(hm) {
  if (!hm) return null;
  const m = String(hm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function localDayDiff(fromIso, toIso) {
  const a = parseLocalDate(fromIso);
  const b = parseLocalDate(toIso);
  if (!a || !b) return NaN;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function formatMinutes(total) {
  const m = Math.max(0, Math.round(total || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}:${String(r).padStart(2, "0")}`;
}

export function deriveDayStatus(punch, opts = {}) {
  const grace = opts.graceMinutes ?? GRACE_MINUTES;
  const shiftMin = opts.shiftMinutes ?? SHIFT_MINUTES;
  const shiftStart = parseHm(opts.shiftStart || DEFAULT_SHIFT_START) ?? parseHm(DEFAULT_SHIFT_START);
  const shiftEnd = shiftStart + shiftMin;

  if (punch.restDay) {
    return {
      status: ATT_STATUS.rest,
      checkIn: null,
      checkOut: null,
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
      status: ATT_STATUS.leave,
      checkIn: null,
      checkOut: null,
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
    const excused = !!punch.excusedAbsence || !!punch.settlement;
    return {
      status: ATT_STATUS.absent,
      checkIn: null,
      checkOut: null,
      ordinaryMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
      late: false,
      openCheckout: false,
      excused,
    };
  }

  const lateMinutes = Math.max(0, inM - shiftStart - grace);
  const late = lateMinutes > 0;
  const openCheckout = outM == null;
  let ordinaryMinutes = 0;
  let overtimeMinutes = 0;
  if (outM != null) {
    const worked = Math.max(0, outM - inM);
    ordinaryMinutes = Math.min(shiftMin, worked);
    overtimeMinutes = Math.max(0, worked - shiftMin);
  }

  return {
    status: late ? ATT_STATUS.late : ATT_STATUS.present,
    checkIn: punch.checkIn || null,
    checkOut: punch.checkOut || null,
    ordinaryMinutes,
    overtimeMinutes,
    lateMinutes,
    late,
    openCheckout,
    excused: false,
    shiftEndMinutes: shiftEnd,
  };
}

export function deriveGeoVerdict(punch, geofenceOn) {
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

export function checkOutOfGeofenceGate(input) {
  const verdict = String(input.geoVerdict || "");
  if (verdict !== GEO_VERDICT.outside && verdict !== "outside" && verdict !== GEO_VERDICT.pending_review) {
    return {
      ok: false,
      error: "NOT_OUTSIDE_GEOFENCE",
      reason: "لا قرار مطلوب — التسجيل ليس خارج النطاق.",
      reasonEn: "No decision required — check-in is not outside the geofence.",
    };
  }
  const decision = String(input.decision || "");
  if (decision !== "accept" && decision !== "reject") {
    return {
      ok: false,
      error: "DECISION_REQUIRED",
      reason: "يلزم قبول بمبرر مكتوب أو رفض — لا زر صامت.",
      reasonEn: "Accept with a written reason or reject — no silent action.",
    };
  }
  if (decision === "accept" && !String(input.reason || "").trim()) {
    return {
      ok: false,
      error: "REASON_REQUIRED",
      reason: "قبول خارج النطاق يتطلب مبررًا مكتوبًا باسم المراجع.",
      reasonEn: "Accepting an out-of-geofence check-in requires a written reason under the reviewer's name.",
    };
  }
  return { ok: true, decision };
}

export function checkSettleAbsenceGate(input) {
  if (input.alreadySettled) {
    return {
      ok: false,
      error: "ALREADY_SETTLED",
      reason: "هذا اليوم مُسوّى مسبقًا — القيد الأصلي يبقى في التدقيق.",
      reasonEn: "This day is already settled — the original entry stays in the audit trail.",
    };
  }
  const absenceDate = String(input.absenceDate || "");
  const today = String(input.today || localDateKey());
  if (!parseLocalDate(absenceDate)) {
    return {
      ok: false,
      error: "INVALID_DATE",
      reason: "تاريخ الغياب غير صالح.",
      reasonEn: "Absence date is invalid.",
    };
  }
  const days = localDayDiff(absenceDate, today);
  if (!Number.isFinite(days) || days < 0) {
    return {
      ok: false,
      error: "FUTURE_DATE",
      reason: "لا تسوية لتاريخ في المستقبل.",
      reasonEn: "Cannot settle a future date.",
    };
  }
  if (days > SETTLEMENT_WINDOW_DAYS) {
    return {
      ok: false,
      error: "SETTLEMENT_WINDOW_CLOSED",
      reason: `مضى أكثر من ${SETTLEMENT_WINDOW_DAYS} يومًا — التسوية هنا مغلقة، ويُقدَّم الطلب للموارد البشرية بقرار مكتوب.`,
      reasonEn: `More than ${SETTLEMENT_WINDOW_DAYS} days have passed — settlement is closed here and the request goes to HR for a written decision.`,
      windowDays: SETTLEMENT_WINDOW_DAYS,
      days,
    };
  }
  const kind = String(input.kind || "");
  if (!SETTLEMENT_KINDS.includes(kind)) {
    return {
      ok: false,
      error: "KIND_REQUIRED",
      reason: "يلزم نوع تسوية ثابت (مرض · امتحان · واجب خارجي · …).",
      reasonEn: "A stable settlement kind is required (sick · exam · external duty · …).",
    };
  }
  if (!String(input.documentName || "").trim()) {
    return {
      ok: false,
      error: "DOCUMENT_REQUIRED",
      reason: "التسوية تتطلب مستندًا مرفقًا — القيد الأصلي لا يُمحى.",
      reasonEn: "Settlement requires an attached document — the original entry is never erased.",
    };
  }
  return { ok: true, days, windowDays: SETTLEMENT_WINDOW_DAYS };
}

export function checkOtDecisionGate(input) {
  const ot = Math.max(0, Number(input.overtimeMinutes) || 0);
  if (ot <= 0) {
    return {
      ok: false,
      error: "NO_OVERTIME",
      reason: "لا ساعات إضافية للاعتماد في هذا اليوم.",
      reasonEn: "No overtime minutes to decide on this day.",
    };
  }
  if (input.alreadyDecided === true) {
    return {
      ok: false,
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
      ok: false,
      error: "DECISION_REQUIRED",
      reason: "يلزم اعتماد الإضافي للصرف، أو رفضه، أو إجازة تعويضية بموافقة العامل — الساعات تبقى مسجّلة.",
      reasonEn: "Approve overtime for pay, reject it, or grant compensatory leave with the worker's consent — hours stay recorded.",
    };
  }
  const onDate = laborDayKey(input.onDate);
  if (decision === "comp_leave") {
    const consent = input.workerConsent === true || input.consent === true;
    if (!consent) {
      return {
        ok: false,
        error: "COMP_LEAVE_CONSENT",
        reason: "موقوف — المادة 107: الإجازة التعويضية بدل أجر الإضافي لا تكون إلا بموافقة العامل المسجّلة. بلا موافقة يبقى الصرف.",
        reasonEn: "Blocked — Article 107: compensatory leave instead of overtime pay needs the worker's recorded consent. Without consent, pay remains the default.",
      };
    }
    const windowDays = ruleValue("hours.ot.compLeave.windowDays", onDate || undefined);
    let enjoy = String(input.enjoyDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(enjoy) && /^\d{4}-\d{2}-\d{2}$/.test(onDate)) {
      enjoy = addLaborDays(onDate, windowDays - 1);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(enjoy) && /^\d{4}-\d{2}-\d{2}$/.test(onDate)) {
      const latest = addLaborDays(onDate, windowDays - 1);
      if (enjoy > latest && input.windowAgreed !== true) {
        return {
          ok: false,
          error: "COMP_LEAVE_WINDOW",
          reason: `موقوف — اللائحة مادة 22 مكرر: يُحدَّد موعد التمتع بالإجازة التعويضية خلال ${windowDays} يوماً من الإضافي ما لم يُتفق على خلاف ذلك.`,
          reasonEn: `Blocked — implementing regulations Art. 22 bis: the date for taking compensatory leave is set within ${windowDays} days of the overtime unless otherwise agreed.`,
          enjoyDate: enjoy,
          latest,
          windowDays,
        };
      }
    }
    const perHour = ruleValue("hours.ot.compLeave.minHoursPerOtHour", onDate || undefined);
    const dayHours = ruleValue("hours.shift.ordinaryHours", onDate || undefined);
    const addDays = Math.round((((ot / 60) * perHour) / dayHours) * 1000) / 1000;
    const usedDays = Math.max(0, Number(input.creditDaysYtd) || 0);
    const yearCap = ruleValue("hours.ot.compLeave.maxDaysPerYear", onDate || undefined);
    if (usedDays + addDays > yearCap) {
      return {
        ok: false,
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
  const cap = ruleValue("hours.ot.annualMaxHours", onDate || undefined);
  if (decision !== "reject" && ytd + add > cap && input.annualCapConsent !== true) {
    return {
      ok: false,
      error: "OT_ANNUAL_CAP",
      reason: `تنبيه — اللائحة مادة 22: ساعات الإضافي السنوية لا تزيد على ${cap} ساعة إلا بموافقة العامل. المستخدم ${ytd} وهذا القرار ${add}.`,
      reasonEn: `Notice — implementing regulations Art. 22: annual overtime may not exceed ${cap} hours unless the worker consents. Used ${ytd}; this decision adds ${add}.`,
      cap,
      ytd,
      add,
    };
  }
  return { ok: true, decision, overtimeMinutes: ot, workerConsent: decision === "comp_leave" };
}

export function approvedCompLeaveDaysForYear(otDecisions, employeeId, yearOrMonth) {
  const year = String(yearOrMonth || "").slice(0, 4);
  const prefix = `${employeeId}:`;
  const perHour = ruleValue("hours.ot.compLeave.minHoursPerOtHour");
  const dayHours = ruleValue("hours.shift.ordinaryHours");
  let days = 0;
  for (const [key, row] of Object.entries(otDecisions || {})) {
    if (!key.startsWith(prefix)) continue;
    const day = key.slice(prefix.length);
    if (!String(day).startsWith(year)) continue;
    if (row?.decision !== "comp_leave" && row?.decision !== "credit") continue;
    const hours = Math.max(0, Number(row.overtimeMinutes) || 0) / 60;
    days += (hours * perHour) / dayHours;
  }
  return Math.round(days * 1000) / 1000;
}

export function approvedOvertimeHoursForMonth(otDecisions, employeeId, month) {
  const prefix = `${employeeId}:`;
  let minutes = 0;
  for (const [key, row] of Object.entries(otDecisions || {})) {
    if (!key.startsWith(prefix)) continue;
    const day = key.slice(prefix.length);
    if (!String(day).startsWith(String(month))) continue;
    if (row?.decision !== "approve" && row?.decision !== "pay") continue;
    minutes += Math.max(0, Number(row.overtimeMinutes) || 0);
  }
  return Math.round((minutes / 60) * 10) / 10;
}

/** The 720-hour ceiling in the implementing regulations is an annual one, so the
 *  payroll gate has to weigh the year's approved overtime, not one month of it. */
export function approvedOvertimeHoursForYear(otDecisions, employeeId, yearOrMonth) {
  return approvedOvertimeHoursForMonth(otDecisions, employeeId, String(yearOrMonth || "").slice(0, 4));
}

export function buildRosterRow(punch, opts = {}) {
  const day = deriveDayStatus(punch, { shiftStart: opts.shiftStart });
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

export function filterRosterByStatus(rows, statusId) {
  if (!statusId || statusId === "all") return rows;
  return rows.filter((r) => r.status === statusId);
}

export function deriveAttStats(rows, geofenceOn) {
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
  const absent = list.filter((r) => r.status === ATT_STATUS.absent && !r.excusedAbsence && !r.settlement).length;

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
