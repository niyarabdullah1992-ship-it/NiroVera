/**
 * Local attendance punch when supabaseAttendance / attendance cloud is down.
 * Stores rows on company.personalAttendance — same shape the UI already reads.
 */
import { checkCheckInLeaveGate } from "@/lib/attendanceGate";
import { attendanceOnDate, checkPunchRecordGate, toCloudAttendanceRow as punchCloudRow } from "@/lib/attendancePunch";
import { updateCompany, getCompanyData } from "@/lib/store";
import { getTodaysShift, lateMinutesFromScheduledStart } from "@/lib/attendanceDerivations";

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
    early_checkout: !!row.earlyCheckout || !!row.early_checkout,
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

export function getLocalTodayAttendance(companyId, employeeId) {
  const date = todayKey();
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
  const shift = employee ? getTodaysShift(data, employee) : null;
  const now = new Date();
  const late = shift?.start
    ? lateMinutesFromScheduledStart(now.getHours() * 60 + now.getMinutes(), shift.start, 0)
    : { lateMinutes: 0, status: "present" };
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
  const date = todayKey();
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
  updateCompany(companyId, (d) => {
    const list = Array.isArray(d.personalAttendance) ? d.personalAttendance : [];
    const idx = list.findIndex((r) => String(r.employeeId) === String(employeeId) && String(r.date) === date);
    if (idx < 0) return;
    list[idx] = {
      ...list[idx],
      checkOutAt: nowIso(),
      status: list[idx].status || "present",
    };
    d.personalAttendance = list;
  });
  return getLocalTodayAttendance(companyId, employeeId);
}
