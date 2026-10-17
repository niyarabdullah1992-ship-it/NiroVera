/** Client mirror of base44/shared/attendanceDerivations.ts
 *  Keep in sync — grace, shift, geofence decision, settlement, stats.
 */

import { addLaborDays, laborDayKey, ruleValue } from "./laborRules.js";
import { extraCoverageStationIds } from "./stationTree.js";
import { toRiyadhDateKey } from "./riyadhDate.js";
import { nursingCreditOf, nursingHourOn } from "./dutyRequests.js";

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

/**
 * The shift the duty day holds. After midnight an OPEN overnight row from yesterday is still the duty
 * day (its checkout, breaks and ticker belong to it) until today's own duty begins — see dutyDayOf.
 */
export function getTodaysShift(data, employee, now = new Date()) {
  return dutyDayOf(data, employee, now).shift;
}

/** An overnight shift ends on the next calendar day (end ≤ start). */
export function isOvernightShift(shift) {
  const start = hmToMinutes(shift?.start);
  const end = hmToMinutes(shift?.end);
  return start != null && end != null && end <= start;
}

/** «YYYY-MM-DD» one calendar day earlier. */
export function previousDateKey(dateKey) {
  const m = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - 1));
  return d.toISOString().slice(0, 10);
}

/** Minutes past midnight on the Riyadh clock. */
export function riyadhMinutesOf(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (type) => Number(parts.find((entry) => entry.type === type)?.value);
  return part("hour") * 60 + part("minute");
}

const rowOpen = (row) => !!(row?.checkInAt || row?.check_in_at) && !(row?.checkOutAt || row?.check_out_at);
const rowCheckedIn = (row) => !!(row?.checkInAt || row?.check_in_at);

/**
 * Pure: is yesterday's overnight duty still the duty day? Yes while its row is open, its shift is
 * overnight, nothing is checked in today, and today's own check-in window has not opened.
 * Twin: base44/shared/attendanceDerivations.ts.
 */
export function overnightCarryOpen({ yesterdayRow, yesterdayShift, todayRow = null, todayShift = null, nowMin = null, earlyWindowMin = 60 } = {}) {
  if (!rowOpen(yesterdayRow) || !isOvernightShift(yesterdayShift)) return false;
  if (rowCheckedIn(todayRow)) return false;
  if (todayShift?.start && nowMin != null && checkEarlyCheckInGate(todayShift, nowMin, earlyWindowMin).ok) return false;
  return true;
}

/** { dateKey, shift, carried } — today, or yesterday while its overnight row is still open. */
export function dutyDayOf(data, employee, now = new Date(), rows = null) {
  const today = toRiyadhDateKey(now);
  const todayShift = getShiftOnDate(data, employee, today);
  if (!employee?.id) return { dateKey: today, shift: null, carried: false };
  const list = Array.isArray(rows) ? rows : (data?.personalAttendance || []);
  const yesterday = previousDateKey(today);
  const mine = (key) => list.find((row) => String(row?.employeeId ?? row?.employee_id) === String(employee.id) && String(row?.date || row?.dateKey || "").slice(0, 10) === key) || null;
  const yesterdayRow = mine(yesterday);
  if (yesterdayRow) {
    const yesterdayShift = getShiftOnDate(data, employee, yesterday);
    if (overnightCarryOpen({ yesterdayRow, yesterdayShift, todayRow: mine(today), todayShift, nowMin: riyadhMinutesOf(now), earlyWindowMin: earlyCheckInMinutes(data) })) {
      return { dateKey: yesterday, shift: yesterdayShift, carried: true };
    }
  }
  return { dateKey: today, shift: todayShift, carried: false };
}

/** The published shift an employee holds on a given date (own station first, then coverage). */
export function getShiftOnDate(data, employee, dateKey) {
  if (!employee?.id) return null;
  const stationIds = [employee.stationId || data?.stations?.[0]?.id, ...extraCoverageStationIds(employee, data)].filter(Boolean);
  for (const stationId of stationIds) {
    const schedule = (data?.schedules || []).find((s) => s.stationId === stationId);
    for (const st of schedule?.shiftTypes || []) {
      const ids = schedule.assignments?.[dateKey]?.[st.id] || [];
      if (ids.includes(employee.id)) {
        return {
          start: st.start,
          end: st.end,
          label: st.label,
          stationId,
          dutyDate: dateKey,
          // The break mode travels with the shift so every reader deducts the same rest.
          ...(st.breakMode === "flex" ? { id: st.id, breakMode: "flex", flexBreak: st.flexBreak || {}, restMinutes: st.restMinutes } : {}),
        };
      }
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
    // Model Art. 46: kept from work by the establishment — paid, never an unexcused absence.
    const excused = !!punch.excusedAbsence || !!punch.settlement || !!punch.preventedByEmployer;
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
    status: late ? ATT_STATUS.late : ATT_STATUS.present,
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

/** An otDecisions entry still waiting on a decision — written by publish (holiday work) or by punches. */
export function isOtDecisionOpen(entry) {
  if (!entry) return true;
  return entry.decision === "pending" || entry.decision === "pending_worker_cap_consent";
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
  // Art. 107: hours the punches (or a confirmed holiday duty) prove were worked are owed —
  // the manager chooses pay or compensatory leave, never «unpaid».
  if (decision === "reject" && input.workedProven === true) {
    return {
      ok: false,
      error: "OT_WORKED_NO_REJECT",
      reason: "موقوف — المادة 107: الحضور والانصراف يثبتان أن الساعات عُملت فعلاً، وأجرها واجب. اختر الصرف بأجر الساعة + 50% أو إجازة تعويضية بموافقة العامل.",
      reasonEn: "Blocked — Article 107: the punches prove these hours were worked and their pay is owed. Choose pay at hourly + 50% or compensatory leave with the worker's consent.",
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

/** Regs Art. 22: the 720-hour ceiling and the 30 comp-leave days are counted once
 *  per hour worked. Decisions stamped from an overtime assignment are already
 *  counted from the assignment itself, so they are skipped here and the two
 *  sources are summed, not maxed. Comp-leave decisions count toward the hours too. */
export function overtimeYearUsageOutsideAssignments(otDecisions, employeeId, yearOrMonth) {
  const year = String(yearOrMonth || "").slice(0, 4);
  const prefix = `${employeeId}:`;
  const perHour = ruleValue("hours.ot.compLeave.minHoursPerOtHour");
  const dayHours = ruleValue("hours.shift.ordinaryHours");
  let minutes = 0;
  let days = 0;
  for (const [key, row] of Object.entries(otDecisions || {})) {
    if (!key.startsWith(prefix)) continue;
    if (!String(key.slice(prefix.length)).startsWith(year)) continue;
    if (row?.source === "ot_assignment") continue;
    const d = row?.decision;
    if (!["approve", "pay", "comp_leave", "credit"].includes(d)) continue;
    const m = Math.max(0, Number(row.overtimeMinutes) || 0);
    minutes += m;
    if (d === "comp_leave" || d === "credit") days += ((m / 60) * perHour) / dayHours;
  }
  return { hours: Math.round((minutes / 60) * 10) / 10, creditDays: Math.round(days * 1000) / 1000 };
}

export function buildRosterRow(punch, opts = {}) {
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


/** Minutes the check-in opens before a published shift (company policy, default 60). */
export const EARLY_CHECKIN_DEFAULT = 60;
export function earlyCheckInMinutes(company) {
  const n = Number(company?.attendanceSettings?.early_checkin_minutes);
  return Number.isFinite(n) && n >= 0 ? n : EARLY_CHECKIN_DEFAULT;
}

/** A check-in before the window opens is refused; the reply says when it opens. */
export function checkEarlyCheckInGate(shift, nowMin, windowMin = EARLY_CHECKIN_DEFAULT) {
  const start = hmToMinutes(shift?.start);
  if (start == null || nowMin == null) return { ok: true };
  const until = start - nowMin;
  if (until <= windowMin) return { ok: true };
  const open = ((start - windowMin) % 1440 + 1440) % 1440;
  const hm = `${String(Math.floor(open / 60)).padStart(2, "0")}:${String(open % 60).padStart(2, "0")}`;
  return {
    ok: false,
    error: "TOO_EARLY",
    opensAt: hm,
    reason: `يُفتح الحضور قبل ورديتك بـ${windowMin} دقيقة — من الساعة ${hm}.`,
    reasonEn: `Check-in opens ${windowMin} minutes before your shift — from ${hm}.`,
  };
}

/**
 * Has today's shift (start date = today) ended, plus a grace? An overnight shift (end ≤ start) ends
 * tomorrow, so on its own start day it has never ended.
 */
export function todaysShiftEnded(shift, nowMin, graceMin = 60) {
  const start = hmToMinutes(shift?.start);
  const end = hmToMinutes(shift?.end);
  if (end == null || nowMin == null) return false;
  if (start != null && end <= start) return false;
  return nowMin > end + graceMin;
}

/** Minutes after a shift's end the self check-in still opens — the same hour the forgotten checkout waits. */
export const LATE_CHECKIN_GRACE_MINUTES = 60;

/**
 * After the shift has ended (+ grace) a self check-in is closed: arriving then is not a duty day,
 * it is a manual entry the manager decides («نسيت البصمة؟ اطلب تسجيل يدوي»). Twin in shared.
 */
export function checkLateCheckInGate(shift, nowMin, graceMin = LATE_CHECKIN_GRACE_MINUTES) {
  if (!todaysShiftEnded(shift, nowMin, graceMin)) return { ok: true };
  return {
    ok: false,
    error: "SHIFT_ENDED",
    endsAt: shift.end,
    reason: `انتهت ورديتك ${shift.end} — لا تُفتح بصمة الحضور بعدها. إن كنت حضرت فاطلب تسجيلاً يدوياً من «نسيت البصمة؟».`,
    reasonEn: `Your shift ended at ${shift.end} — check-in does not open after it. If you were at work, request a manual entry from «Forgot to punch?».`,
  };
}

/** Minutes the checkout falls before the shift end (overnight-aware), less her nursing minutes at the end (Art. 154). */
export function earlyLeaveMinutesOf({ shift, checkIn, checkOut, nursingEndMinutes = 0 } = {}) {
  const start = hmToMinutes(shift?.start);
  const end = hmToMinutes(shift?.end);
  const inMin = checkIn ? riyadhMinutesOf(checkIn) : null;
  const outMin = checkOut ? riyadhMinutesOf(checkOut) : null;
  if (start == null || end == null || inMin == null || outMin == null) return 0;
  const inDate = toRiyadhDateKey(checkIn);
  const outDate = toRiyadhDateKey(checkOut);
  const dayOff = inDate === outDate ? 0 : 1440;
  // On the check-in's clock: the shift end is today, or tomorrow when it is overnight.
  const endAbs = end <= start ? end + 1440 : end;
  const outAbs = outMin + dayOff;
  return Math.max(0, endAbs - outAbs - Math.max(0, Number(nursingEndMinutes) || 0));
}

/**
 * Pure: the self «انصرف» — closed while a «تثبيت الانصراف» request is pending (the manager's decision
 * is the truth); otherwise a checkout that is early, or late past the forgotten hour, asks for one
 * confirmation that names its minutes. { ok, confirm: null | { kind, minutes } } or a named refusal.
 */
export function checkSelfCheckoutGate({ shift, attendance, now = Date.now(), pendingFix = null, nursingEndMinutes = 0 } = {}) {
  if (pendingFix) {
    return {
      ok: false,
      error: "CHECKOUT_FIX_PENDING",
      reason: `طلب تثبيت الانصراف${pendingFix.time ? ` (${pendingFix.time})` : ""} بانتظار مديرك — يُثبت انصرافك من قراره، لا ببصمة ثانية.`,
      reasonEn: `Your checkout-fix request${pendingFix.time ? ` (${pendingFix.time})` : ""} is with your manager — the checkout is set by that decision, not a second punch.`,
    };
  }
  const checkIn = attendance?.check_in_at || attendance?.checkInAt;
  if (!checkIn || !shift?.end) return { ok: true, confirm: null };
  const nowIso = new Date(now).toISOString();
  const early = earlyLeaveMinutesOf({ shift, checkIn, checkOut: nowIso, nursingEndMinutes });
  if (early > 0) return { ok: true, confirm: { kind: "early", minutes: early } };
  if (isForgottenCheckout(shift, attendance, new Date(now).getTime())) {
    const start = hmToMinutes(shift.start);
    const end = hmToMinutes(shift.end);
    const nowMin = riyadhMinutesOf(nowIso) + (toRiyadhDateKey(checkIn) === toRiyadhDateKey(nowIso) ? 0 : 1440);
    const endAbs = end <= start ? end + 1440 : end;
    return { ok: true, confirm: { kind: "forgotten", minutes: Math.max(0, nowMin - endAbs) } };
  }
  return { ok: true, confirm: null };
}
