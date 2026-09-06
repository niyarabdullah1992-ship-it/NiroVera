/** Attendance derivation — grace, shift, geofence decision, settlement, stats.
 *  Design: NiroVera Platform.dc.html class Component (attendance / GRACE / SHIFT_H / WINDOW).
 *  Status keys are stable IDs — never bind filters to translated labels.
 */

import { ruleValue } from "./laborRules.ts";

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
  opts: { shiftStart?: string; graceMinutes?: number; shiftMinutes?: number } = {},
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
    const excused = !!punch.excusedAbsence || !!punch.settlement;
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
    status: (late ? ATT_STATUS.late : ATT_STATUS.present) as AttStatusId,
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
  if (input.alreadyDecided === true || input.alreadyDecided === false) {
    return {
      ok: false as const,
      error: "ALREADY_DECIDED",
      reason: "قرار الإضافي مُسجَّل — يبقى ظاهرًا في الكشف.",
      reasonEn: "Overtime decision is already recorded — it stays visible on the timesheet.",
    };
  }
  const decision = String(input.decision || "");
  if (decision !== "approve" && decision !== "reject") {
    return {
      ok: false as const,
      error: "DECISION_REQUIRED",
      reason: "يلزم اعتماد أو رفض الإضافي للصرف — الساعات تبقى مسجّلة في الحالين.",
      reasonEn: "Approve or reject overtime for pay — hours stay recorded either way.",
    };
  }
  return { ok: true as const, decision: decision as "approve" | "reject", overtimeMinutes: ot };
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
  opts: { geofenceOn?: boolean; shiftStart?: string } = {},
): RosterRow {
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
