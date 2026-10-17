/**
 * Local attendance punch when supabaseAttendance / attendance cloud is down.
 * Stores rows on company.personalAttendance — same shape the UI already reads.
 */
import { checkCheckInLeaveGate } from "@/lib/attendanceGate";
import { attendanceOnDate, checkPunchRecordGate, isEarlyCheckoutAt, toCloudAttendanceRow as punchCloudRow } from "@/lib/attendancePunch";
import { updateCompany, getCompanyData, closeAttendanceDay } from "@/lib/store";
import { checkLateCheckInGate, dutyDayOf, getShiftOnDate, getTodaysShift, lateMinutesFromScheduledStart, riyadhMinutesOf } from "@/lib/attendanceDerivations";
import { nursingHourOn } from "@/lib/dutyRequests";
import { checkFlexBreakPunchGate } from "@/lib/shiftDerivations";
import { closeDayBreaks } from "@/lib/actualDuty";
import { hoursPolicyOf } from "@/lib/laborHoursPolicy";
import { stationPrayerTimes } from "@/lib/prayerTimes";
import { isRamadanDay } from "@/lib/laborRules";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}

function nowIso() {
  return new Date().toISOString();
}

function rowDateKey(row) {
  return String(row?.date || row?.dateKey || "").slice(0, 10);
}

function isTodayLocalRow(row) {
  return rowDateKey(row) === todayKey();
}

function rangeRowKey(row) {
  const id = employeeKey(row);
  const date = rowDateKey(row);
  return id && date ? `${id}:${date}` : "";
}

function employeeKey(row) {
  const id = row?.employee_id ?? row?.employeeId;
  return id == null || id === "" ? "" : String(id);
}

function hasCheckIn(row) {
  return !!(row?.check_in_at || row?.checkInAt);
}

function toCloudAttendanceRow(row) {
  if (!row) return null;
  const employeeId = row.employeeId ?? row.employee_id;
  const checkIn = row.checkInAt || row.check_in_at || null;
  return {
    id: row.id,
    employee_id: employeeId,
    employeeId,
    station_id: row.stationId || row.station_id || null,
    date: row.date || row.dateKey,
    check_in_at: checkIn,
    check_out_at: row.checkOutAt || row.check_out_at || null,
    status: row.status || (checkIn ? "present" : null),
    late_minutes: row.lateMinutes || row.late_minutes || 0,
    location_status: row.locationStatus || row.location_status || "disabled",
    distance_meters: row.distanceMeters ?? row.distance_meters ?? null,
    excused: !!row.excused,
    excused_by_name: row.excusedByName || row.excused_by_name || "",
    excused_note: row.excusedNote || row.excused_note || "",
    excused_at: row.excusedAt || row.excused_at || null,
    early_checkout: !!row.earlyCheckout || !!row.early_checkout,
    // Manager decisions travel with the row so «سجل التدقيق» and the queue read them.
    manual_override: !!(row.manualOverride ?? row.manual_override),
    override_by: row.overrideBy || row.override_by || "",
    ...(row.localPreview ? { localPreview: true } : {}),
    ...(Array.isArray(row.breaks) ? { breaks: row.breaks } : {}),
  };
}

export function localAttendanceSettings() {
  return {
    schedule_required: true,
    gps_enabled: false,
    emergency_active: false,
    late_grace_minutes: 0,
    localPreview: true,
  };
}

/** Today's personalAttendance rows, same YYYY-MM-DD key as localCheckIn. */
export function listLocalTodayAttendance(companyId, dataOverride) {
  const storeData = companyId ? getCompanyData(companyId) : null;
  const seen = new Set();
  const rows = [];
  for (const source of [storeData, dataOverride]) {
    for (const row of source?.personalAttendance || []) {
      if (!isTodayLocalRow(row)) continue;
      const id = employeeKey(row);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push(toCloudAttendanceRow(row));
    }
  }
  return rows;
}

/** Cloud first when it has check-in; otherwise local. Deduped by employee id. */
export function mergeAttendanceRows(cloudRows = [], localRows = []) {
  const byId = new Map();
  for (const row of cloudRows || []) {
    const id = employeeKey(row);
    if (!id) continue;
    byId.set(id, row);
  }
  for (const row of localRows || []) {
    const id = employeeKey(row);
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing || (!hasCheckIn(existing) && hasCheckIn(row))) {
      byId.set(id, row);
    }
  }
  return Array.from(byId.values());
}

/** personalAttendance rows whose date falls in [startDate, endDate] inclusive. */
export function listLocalRangeAttendance(companyId, startDate, endDate, dataOverride) {
  const storeData = companyId ? getCompanyData(companyId) : null;
  const seen = new Set();
  const rows = [];
  for (const source of [storeData, dataOverride]) {
    for (const row of source?.personalAttendance || []) {
      const date = rowDateKey(row);
      if (!date || date < startDate || date > endDate) continue;
      const key = rangeRowKey({ ...row, date });
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(toCloudAttendanceRow(row));
    }
  }
  return rows;
}

/** Cloud first when it has check-in; otherwise local. Deduped by employee + date. */
export function mergeAttendanceRangeRows(cloudRows = [], localRows = []) {
  const byKey = new Map();
  for (const row of cloudRows || []) {
    const key = rangeRowKey(row);
    if (!key) continue;
    byKey.set(key, row);
  }
  for (const row of localRows || []) {
    const key = rangeRowKey(row);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing || (!hasCheckIn(existing) && hasCheckIn(row))) {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values());
}

/** The duty day's date — today, or yesterday while its overnight row is still open (dutyDayOf). */
function dutyDateFor(companyId, employeeId) {
  const data = getCompanyData(companyId);
  const employee = (data?.employees || []).find((row) => String(row.id) === String(employeeId));
  return employee ? dutyDayOf(data, employee).dateKey : todayKey();
}

export function getLocalTodayAttendance(companyId, employeeId) {
  const date = dutyDateFor(companyId, employeeId);
  const row = (getCompanyData(companyId)?.personalAttendance || []).find(
    (r) => String(r.employeeId ?? r.employee_id) === String(employeeId) && (String(r.date) === date || String(r.dateKey) === date),
  );
  return toCloudAttendanceRow(row);
}

function throwGate(gate) {
  const err = new Error(gate.reasonEn || gate.error);
  err.code = gate.error;
  err.reason = gate.reason;
  err.reasonEn = gate.reasonEn;
  throw err;
}

export function localCheckIn(companyId, { employeeId, employeeName, stationId }) {
  const date = todayKey();
  const data = getCompanyData(companyId);
  const employee = (data?.employees || []).find((row) => String(row.id) === String(employeeId));
  const leaveGate = checkCheckInLeaveGate(employee, date);
  if (!leaveGate.ok) throwGate(leaveGate);
  const existing = attendanceOnDate(data?.personalAttendance, employeeId, date);
  const already = checkPunchRecordGate({
    type: "manual_punch",
    employee,
    attendance: existing,
    date,
    reason: "self-punch",
    requireTime: false,
  });
  if (!already.ok && already.error === "ALREADY_CHECKED_IN") throwGate(already);
  // Check-in is always today's own shift (never a carried overnight one), and closes after it ends.
  const shift = employee ? getShiftOnDate(data, employee, date) : null;
  const lateGate = checkLateCheckInGate(shift, riyadhMinutesOf(new Date()));
  if (!lateGate.ok) throwGate(lateGate);
  const now = new Date();
  const rawLate = shift?.start
    ? lateMinutesFromScheduledStart(now.getHours() * 60 + now.getMinutes(), shift.start, 0)
    : { lateMinutes: 0, status: "present" };
  // Art. 154: arriving inside her nursing minutes at the start is not lateness.
  const nursingStart = nursingHourOn(employee, date)?.startMinutes || 0;
  const lateLeft = Math.max(0, (rawLate.lateMinutes || 0) - nursingStart);
  const late = rawLate.status === "late" && !lateLeft ? { lateMinutes: 0, status: "present" } : { ...rawLate, lateMinutes: lateLeft };
  let saved = null;
  updateCompany(companyId, (d) => {
    const list = Array.isArray(d.personalAttendance) ? d.personalAttendance : [];
    const idx = list.findIndex((r) => String(r.employeeId) === String(employeeId) && String(r.date) === date);
    if (idx >= 0 && (list[idx].checkInAt || list[idx].check_in_at)) {
      saved = list[idx];
      return;
    }
    const row = {
      id: idx >= 0 ? list[idx].id : `pa_${employeeId}_${date}`,
      employeeId,
      employeeName: employeeName || employee?.name || "",
      stationId: stationId || employee?.stationId || null,
      date,
      checkInAt: nowIso(),
      checkOutAt: null,
      status: late.status || "present",
      lateMinutes: late.lateMinutes || 0,
      locationStatus: "disabled",
      localPreview: true,
    };
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.push(row);
    d.personalAttendance = list;
    saved = row;
  });
  return getLocalTodayAttendance(companyId, employeeId) || punchCloudRow(saved);
}

export function localCheckOut(companyId, { employeeId }) {
  const date = dutyDateFor(companyId, employeeId);
  const data = getCompanyData(companyId);
  const employee = (data?.employees || []).find((row) => String(row.id) === String(employeeId));
  const existing = attendanceOnDate(data?.personalAttendance, employeeId, date);
  const gate = checkPunchRecordGate({
    type: "checkout_fix",
    employee,
    attendance: existing,
    date,
    reason: "self-checkout",
    requireTime: false,
  });
  if (!gate.ok) throwGate(gate);
  const shift = employee ? getTodaysShift(data, employee) : null;
  const checkOutAt = nowIso();
  updateCompany(companyId, (d) => {
    const list = Array.isArray(d.personalAttendance) ? d.personalAttendance : [];
    const idx = list.findIndex((r) => String(r.employeeId) === String(employeeId) && String(r.date) === date);
    if (idx < 0) return;
    const checkInAt = list[idx].checkInAt || list[idx].check_in_at;
    // «راحة مرنة ببصمة»: an open break ends at the checkout; an unpunched one is written as assumed.
    const breaks = shift?.breakMode === "flex"
      ? closeDayBreaks({ shift, breaks: list[idx].breaks, checkIn: checkInAt, checkOut: checkOutAt, onDate: date, prayers: dayPrayers(d, shift, date), company: d, employee })
      : list[idx].breaks;
    list[idx] = {
      ...list[idx],
      checkOutAt,
      status: list[idx].status || "present",
      earlyCheckout: isEarlyCheckoutAt(shift, checkOutAt, nursingHourOn(employee, date)?.endMinutes || 0),
      ...(Array.isArray(breaks) ? { breaks } : {}),
    };
    d.personalAttendance = list;
  });
  // The day closed: its overtime is recorded automatically (Arts 98, 104, 107) and the Art. 101
  // breaches it proves go onto the row, where the duty boards read them.
  try { closeAttendanceDay(companyId, employeeId, date); } catch { /* best-effort; the day is saved */ }
  return getLocalTodayAttendance(companyId, employeeId);
}

/** The branch's prayer times on the duty day — where an unpunched flex break is assumed. */
function dayPrayers(data, shift, date) {
  const station = (data?.stations || []).find((row) => String(row.id) === String(shift?.stationId));
  if (!station) return null;
  try {
    return stationPrayerTimes(station, date, { ramadan: isRamadanDay(date, laborCalendarOf(data)) });
  } catch {
    return null;
  }
}

/**
 * «بدأت راحتي» / «أنهيت راحتي» on a flex shift — the local twin of the cloud `breakStart` / `breakEnd`
 * actions, gated by the same checkFlexBreakPunchGate. Appends { start, source: "punch" } or closes the
 * open one with { end } (a short break, when the shift allows ending early, carries `short: true`).
 */
export function localBreakPunch(companyId, { employeeId, action }) {
  const date = dutyDateFor(companyId, employeeId);
  const data = getCompanyData(companyId);
  const employee = (data?.employees || []).find((row) => String(row.id) === String(employeeId));
  const existing = attendanceOnDate(data?.personalAttendance, employeeId, date);
  const shift = employee ? getTodaysShift(data, employee) : null;
  const now = nowIso();
  const gate = checkFlexBreakPunchGate({
    action,
    shift,
    breaks: existing?.breaks,
    checkIn: existing?.checkInAt || existing?.check_in_at,
    checkOut: existing?.checkOutAt || existing?.check_out_at,
    now,
    onDate: date,
    continuous103: hoursPolicyOf(data, employee).continuousWork103 === true,
  });
  if (!gate.ok) throwGate(gate);
  updateCompany(companyId, (d) => {
    const list = Array.isArray(d.personalAttendance) ? d.personalAttendance : [];
    const idx = list.findIndex((r) => String(r.employeeId ?? r.employee_id) === String(employeeId) && String(r.date || r.dateKey) === date);
    if (idx < 0) return;
    const breaks = Array.isArray(list[idx].breaks) ? list[idx].breaks.map((row) => ({ ...row })) : [];
    if (action === "start") {
      breaks.push({ start: now, end: null, source: "punch" });
    } else {
      const open = [...breaks].reverse().find((row) => row.source !== "assumed" && row.start && !row.end);
      if (open) {
        open.end = now;
        if (gate.short) open.short = true;
      }
    }
    list[idx] = { ...list[idx], breaks };
    d.personalAttendance = list;
  });
  return getLocalTodayAttendance(companyId, employeeId);
}
