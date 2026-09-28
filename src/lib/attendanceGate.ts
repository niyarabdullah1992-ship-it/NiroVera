/**
 * Client-side mirrors of base44/shared/attendanceGate + leave punch gate.
 */
import { isOnApprovedLeave, type EmployeeLeaveProfile } from "@/lib/leaveTypes";
import { officialHolidayLeaveLabel, officialHolidayOn } from "@/lib/ummAlQuraCalendar";
import type { AttendanceRowLike, GateResult } from "@/types/proofCycle";

export function riyadhDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isCheckedInToday(attendance: AttendanceRowLike | null | undefined): boolean {
  return !!attendance && ["present", "late"].includes(String(attendance.status || ""));
}

export function isGeoVerifiedCheckIn(attendance: AttendanceRowLike | null | undefined): boolean {
  if (!isCheckedInToday(attendance)) return false;
  const loc = String(attendance?.location_status || "").toLowerCase();
  if (loc === "outside" || loc === "inconclusive") return false;
  if (attendance?.in_zone === false) return false;
  return true;
}

export function checkCheckInLeaveGate(
  employee: EmployeeLeaveProfile | null | undefined,
  date: Date | string = new Date(),
  calendar?: unknown,
): GateResult {
  const day = typeof date === "string" ? date.slice(0, 10) : riyadhDateKey(date);
  if (isOnApprovedLeave(employee, new Date(`${day}T12:00:00`))) {
    return {
      ok: false,
      error: "ON_APPROVED_LEAVE",
      reason: "لا يمكن تسجيل الحضور — لديك إجازة معتمدة لهذا اليوم.",
      reasonEn: "Check-in blocked — you have approved leave for this day.",
    };
  }
  const holiday = officialHolidayOn(day, calendar as never);
  if (holiday) {
    const arName = officialHolidayLeaveLabel(holiday.id, true, calendar as never);
    const enName = officialHolidayLeaveLabel(holiday.id, false, calendar as never);
    return {
      ok: false,
      error: "OFFICIAL_HOLIDAY",
      reason: `${arName} بأجر كامل — لا تسجيل حضور (المادة 112).`,
      reasonEn: `${enName} is full-pay leave — no punch (Article 112).`,
    };
  }
  return { ok: true };
}

export type FieldGateOptions = {
  gpsRequired?: boolean;
  mode?: string | null;
};

export function checkFieldAttendanceGate(
  attendance: AttendanceRowLike | null | undefined,
  { gpsRequired = false, mode = null }: FieldGateOptions = {},
): GateResult {
  if (mode === "remote") return { ok: true, skipped: "remote" };

  if (!isCheckedInToday(attendance)) {
    return {
      ok: false,
      error: "CHECK_IN_REQUIRED",
      reason: "تسجيل الإنجاز الميداني موقوف حتى بصمة اليوم — سجّل حضورك أولًا.",
      reasonEn: "On-site actions are blocked until today's check-in.",
    };
  }

  if (gpsRequired && !isGeoVerifiedCheckIn(attendance)) {
    return {
      ok: false,
      error: "GEO_CHECK_IN_REQUIRED",
      reason: "الإثبات الميداني يتطلب بصمة داخل نطاق الفرع — سجّل حضورك من موقع العمل.",
      reasonEn: "Field proof requires a geo-verified check-in within the station boundary.",
    };
  }

  return { ok: true, attendance: attendance || null };
}
