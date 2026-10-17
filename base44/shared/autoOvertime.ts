/**
 * Server twin of src/lib/autoOvertime.js — overtime a closed day carries (Arts 98, 104, 107):
 * all of a holiday or weekly-rest day; else beyond the day cap plus what this day's ordinary
 * minutes carry the week past its cap (48 h / Ramadan 36 h / Art. 108). Same rule rows.
 * The cloud checkout (supabaseAttendance checkOut) returns this reading with its own count of the
 * week, so the client records the day's otDecisions entry on the server's week figure.
 */
import { deriveActualDutyCore } from "./reportsDerivations.ts";
import { isEmployeeOffDay, ordinaryWeekCap } from "./laborHoursPolicy.ts";

export function deriveAutoOvertimeCore(input: {
  workedMinutes?: number; dayOvertimeMinutes?: number; dayKind?: string; holiday?: boolean; restDay?: boolean;
  weekPriorOrdinaryMinutes?: number; weekCapMinutes?: number;
} = {}) {
  const worked = Math.max(0, Math.round(Number(input.workedMinutes) || 0));
  if (input.holiday) return { overtimeMinutes: worked, ordinaryMinutes: 0, dayMinutes: worked, weekMinutes: 0, kind: worked ? "holiday" : "" };
  if (input.restDay) return { overtimeMinutes: worked, ordinaryMinutes: 0, dayMinutes: worked, weekMinutes: 0, kind: worked ? "weekly_rest" : "" };
  const day = Math.min(worked, Math.max(0, Math.round(Number(input.dayOvertimeMinutes) || 0)));
  const ordinaryToday = worked - day;
  const prior = Math.max(0, Number(input.weekPriorOrdinaryMinutes) || 0);
  const capRaw = input.weekCapMinutes ?? Infinity;
  const cap = Number.isFinite(Number(capRaw)) ? Math.max(0, Number(capRaw)) : Infinity;
  const week = Number.isFinite(cap) ? Math.max(0, Math.min(ordinaryToday, prior + ordinaryToday - cap)) : 0;
  const kind = day > 0 ? (input.dayKind || "beyond_day_cap") : week > 0 ? "beyond_week_cap" : "";
  return { overtimeMinutes: day + week, ordinaryMinutes: ordinaryToday - week, dayMinutes: day, weekMinutes: week, kind };
}

/** Sunday-first week keys holding `dayKey` (twin of shiftWeek.weekDateKeys). */
export function weekKeysOf(dayKey: string): string[] {
  const [y, m, d] = String(dayKey || "").slice(0, 10).split("-").map(Number);
  if (!y) return [];
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() - base.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const t = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  });
}

/** One closed day read through the twin, the week before it given. */
export function readDayOvertimeCore(input: {
  row: any; dayKey: string; shift?: any; employee?: any; company?: any; laborCalendar?: any; weekPriorOrdinaryMinutes?: number;
}) {
  const { row, dayKey, shift = null, employee, company, laborCalendar } = input;
  const duty = deriveActualDutyCore({
    checkIn: row?.checkInAt || row?.check_in_at,
    checkOut: row?.checkOutAt || row?.check_out_at,
    shift,
    onDate: dayKey,
    employee,
    company,
    laborCalendar,
    breaks: row?.breaks,
  });
  if (!duty.ok) return { duty, auto: null };
  const capHours = ordinaryWeekCap(employee, company, dayKey, laborCalendar);
  const auto = deriveAutoOvertimeCore({
    workedMinutes: duty.workedMinutes,
    dayOvertimeMinutes: duty.overtimeMinutes,
    dayKind: duty.kind,
    holiday: duty.holiday,
    restDay: duty.offDay || (!!shift && isEmployeeOffDay(dayKey, company, employee)),
    weekPriorOrdinaryMinutes: input.weekPriorOrdinaryMinutes || 0,
    weekCapMinutes: Number.isFinite(capHours) ? Math.round(capHours * 60) : Infinity,
  });
  return { duty, auto };
}

/** Ordinary minutes this week before `dayKey` from the closed rows given, each read in order. */
export function weekOrdinaryBeforeCore(input: {
  rows: any[]; dayKey: string; shiftOn?: (dayKey: string) => any; employee?: any; company?: any; laborCalendar?: any;
}) {
  let running = 0;
  for (const key of weekKeysOf(input.dayKey)) {
    if (key >= input.dayKey) break;
    const row = (input.rows || []).find((r: any) => String(r?.date || r?.dateKey || "").slice(0, 10) === key && (r.checkInAt || r.check_in_at) && (r.checkOutAt || r.check_out_at));
    if (!row) continue;
    const { auto } = readDayOvertimeCore({ row, dayKey: key, shift: input.shiftOn ? input.shiftOn(key) : null, employee: input.employee, company: input.company, laborCalendar: input.laborCalendar, weekPriorOrdinaryMinutes: running });
    if (auto) running += auto.ordinaryMinutes;
  }
  return running;
}
