import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import {
  LEAVE_ROSTER_BLOB,
  checkCheckInLeaveGate,
  isOnApprovedLeave,
  leaveRequestsForEmployeeId,
} from "../../shared/leaveDerivations.ts";
import { validateAttendanceRequest, validationFailed } from "../../shared/proofCycleSchemas.ts";
import { checkAssumedBreakGate, checkFlexBreakPunchGate, resolveFlexDayBreaks } from "../../shared/shiftDerivations.ts";
import { readDayOvertimeCore, weekKeysOf, weekOrdinaryBeforeCore } from "../../shared/autoOvertime.ts";
import { nursingEndExcuse, nursingStartExcuse } from "../../shared/nursingHour.ts";
import { checkEarlyCheckInGate, earlyCheckInMinutesOf } from "../../shared/attendanceDerivations.ts";
import { checkLateCheckInGate, isOvernightShift, lateMinutesFromScheduledStart, overnightCarryOpen, previousDateKey } from "../../shared/attendanceDerivations.ts";

const BREAK_ACTIONS = ["breakStart", "breakEnd", "reviewLateReturn"];
const BREAKS_COLUMN_HINT = "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS breaks jsonb DEFAULT '[]'::jsonb;";

const MANAGER_ROLES = ["director", "ops_manager", "pgm", "station_manager"];
const MANUAL_ATTENDANCE_ROLES = ["owner", "director", "ops_manager", "station_manager"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "").replace(/\/rest\/v\d+$/, "");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const rawBody = await req.json();
    const action = String(rawBody?.action || "");
    let body = rawBody;
    if (action === "checkIn" || action === "checkOut" || BREAK_ACTIONS.includes(action)) {
      const parsed = validateAttendanceRequest(rawBody);
      if (!parsed.success) return validationFailed(parsed.error);
      body = parsed.data;
    }
    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };
    // ---- Server-side authorization ----
    // Roles are never trusted from the request body. The caller must present the
    // session token issued at login; the role is derived from the server's own
    // Employee record. The late-alert sweep runs without a company user session;
    // absence classification is manager-triggered and follows normal authorization.
    const SWEEP_ACTIONS = ["checkLateAlerts"];
    let auth = null;
    const platformUser = await base44.auth.me().catch(() => null);
    if (SWEEP_ACTIONS.includes(action)) {
      if (!platformUser || platformUser.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
      auth = { admin: true, isManager: true, role: "owner", name: platformUser.full_name || platformUser.email || "Administrator", companyId: body.companyId || null, userId: null };
    } else {
      if (platformUser && platformUser.role === "admin") {
        if (!body.companyId) return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
        auth = { admin: true, isManager: true, role: "owner", name: platformUser.full_name || platformUser.email || "Administrator", companyId: body.companyId, userId: body.userId || null };
      } else {
        const { sessionToken, companyId } = body;
        if (sessionToken && companyId) {
          const sessions = await base44.asServiceRole.entities.CompanySession.filter({ token: sessionToken, companyId });
          const s = sessions[0];
          if (s && new Date(s.expiresAt).getTime() > Date.now()) {
            if (s.role === "owner") {
              const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId });
              const account = accounts[0] || null;
              let ownerEmployeeId = s.userId || null;
              if (!ownerEmployeeId && account?.ownerEmail) {
                const employees = await base44.asServiceRole.entities.Employee.filter({ companyId });
                const ownerEmail = account.ownerEmail.trim().toLowerCase();
                ownerEmployeeId = employees.find((employee) => employee.email?.trim().toLowerCase() === ownerEmail)?.employeeId || null;
              }
              auth = { isManager: true, role: "owner", name: account?.name || account?.ownerEmail || "Owner", companyId, userId: ownerEmployeeId };
            } else {
              const emps = await base44.asServiceRole.entities.Employee.filter({ companyId, employeeId: s.userId });
              const emp = emps[0] || null;
              auth = {
                isManager: MANAGER_ROLES.includes(emp?.role), role: emp?.role || "employee", name: emp?.name || "Manager",
                companyId, userId: s.userId, stationId: emp?.stationId || null,
                stationIds: Array.isArray(emp?.stationIds) ? emp.stationIds : [],
                managedStations: Array.isArray(emp?.managedStations) ? emp.managedStations : [],
              };
            }
          }
        }
      }
      if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (!auth.companyId) return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
    }
    const isManager = !!auth?.isManager;
    if (auth && !auth.admin && body.companyId && body.companyId !== auth.companyId) return Response.json({ error: "Forbidden" }, { status: 403 });
    // ---- Multi-tenant boundary ----
    // A requested employeeId must belong to the caller's validated company.
    const canAccessEmployee = (employee) => {
      if (!employee) return false;
      if (auth?.admin || ["owner", "director", "ops_manager"].includes(auth?.role)) return true;
      if (employee.employeeId === auth?.userId) return true;
      if (auth?.role === "pgm") return (auth.managedStations || []).includes(employee.stationId);
      if (auth?.role === "station_manager") return employee.stationId === auth.stationId || (auth.managedStations || []).includes(employee.stationId);
      return false;
    };
    const employeeInCompany = async (employeeId) => {
      if (!auth?.companyId || !employeeId) return false;
      const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId });
      return canAccessEmployee(emps[0]);
    };
    const filterCompanyEmployeeIds = async (ids) => {
      if (!auth?.companyId) return [];
      const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
      const allowed = new Set(emps.filter(canAccessEmployee).map((employee) => employee.employeeId));
      return (ids || []).filter((id) => allowed.has(id));
    };
    const riyadhParts = (date = new Date()) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    const toRiyadhDateKey = (date = new Date()) => {
      const part = riyadhParts(date);
      return `${part.year}-${part.month}-${part.day}`;
    };
    const riyadhMinutes = () => {
      const part = riyadhParts();
      return Number(part.hour) * 60 + Number(part.minute);
    };
    const loadLeaveRoster = async (companyId) => {
      const blobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: LEAVE_ROSTER_BLOB });
      const payload = blobs[0]?.payload;
      return Array.isArray(payload) ? payload : [];
    };
    const punchLeaveRequests = async (companyId, employeeId, entity) => {
      const roster = await loadLeaveRoster(companyId);
      return leaveRequestsForEmployeeId(employeeId, { entity, roster });
    };
    const getScheduledShift = async (companyId, employeeId, dateKey = toRiyadhDateKey()) => {
      const blobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: "schedules" });
      for (const schedule of (blobs[0]?.payload || [])) {
        for (const shift of (schedule.shiftTypes || [])) {
          if ((schedule.assignments?.[dateKey]?.[shift.id] || []).includes(employeeId)) return { ...shift, stationId: schedule.stationId };
        }
      }
      return null;
    };
    const getEmergencyWindow = async (companyId) => {
      const blobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: "attendanceEmergency" });
      const window = blobs[0]?.payload?.[0] || null;
      const now = Date.now();
      return window ? { ...window, active: new Date(window.startAt).getTime() <= now && now <= new Date(window.endAt).getTime() } : null;
    };
    // The company attendance policy blob: the rota is always required; the early check-in window
    // (minutes before the published start) is the owner's setting, read by every checkIn.
    const getAttendancePolicy = async (companyId) => {
      let earlyCheckinMinutes = earlyCheckInMinutesOf(undefined);
      try {
        const blobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: "attendancePolicy" });
        const row = Array.isArray(blobs?.[0]?.payload) ? blobs[0].payload[0] : null;
        if (row && row.earlyCheckinMinutes != null) earlyCheckinMinutes = earlyCheckInMinutesOf(row.earlyCheckinMinutes);
      } catch { /* default window */ }
      return { scheduleRequired: true, earlyCheckinMinutes };
    };
    // The duty day's row: today's, or — after midnight — yesterday's still-open overnight row until
    // today's own duty begins (the shared overnightCarryOpen rule, the punch card's twin).
    const dutyRowOf = async (companyId, employeeId) => {
      const today = toRiyadhDateKey();
      const rowOn = async (day) => {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(companyId)}&employee_id=eq.${encodeURIComponent(employeeId)}&date=eq.${day}`, { headers });
        const rows = res.ok ? await res.json() : [];
        return Array.isArray(rows) ? rows[0] || null : null;
      };
      const todayRow = await rowOn(today);
      if (!todayRow?.check_in_at) {
        const yesterday = previousDateKey(today);
        const yesterdayRow = await rowOn(yesterday);
        if (yesterdayRow?.check_in_at && !yesterdayRow?.check_out_at) {
          const yesterdayShift = await getScheduledShift(companyId, employeeId, yesterday);
          const todayShift = await getScheduledShift(companyId, employeeId, today);
          const earlyWindowMin = (await getAttendancePolicy(companyId)).earlyCheckinMinutes;
          if (overnightCarryOpen({ yesterdayRow, yesterdayShift, todayRow, todayShift, nowMin: riyadhMinutes(), earlyWindowMin })) {
            return { date: yesterday, row: yesterdayRow, shift: yesterdayShift, carried: true };
          }
        }
      }
      return { date: today, row: todayRow, shift: null, carried: false };
    };
    // Strict date formats — values are interpolated into PostgREST query strings,
    // so anything not matching is rejected (blocks query-parameter injection).
    const isDate = (v) => {
      const value = String(v || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00Z`);
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    const isMonth = (v) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || ""));
    const isTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ""));
    const toMinutes = (hhmm) => {
      if (!isTime(hhmm)) return null;
      const parts = hhmm.split(":").map(Number);
      return parts[0] * 60 + parts[1];
    };
    // Haversine distance in meters between two GPS points — used for check-in location verification.
    const distanceMeters = (lat1, lng1, lat2, lng2) => {
      const R = 6371000;
      const toRad = (d) => (d * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    // Server-side workplace coordinates — station GPS/radius is NEVER trusted from
    // the client. ALL of the company's stations (plus saved personal places) are
    // loaded from the server's own records, so an employee working across multiple
    // stations can check in at any of them — the record documents which one.
    const listWorkplaces = async () => {
      const companyId = auth?.companyId;
      if (!companyId) return [];
      const out = [];
      const unrestricted = auth?.admin || ["owner", "director", "ops_manager"].includes(auth?.role);
      const stations = await base44.asServiceRole.entities.Station.filter({ companyId });
      const allowedStationIds = new Set([auth?.stationId, ...(auth?.stationIds || []), ...(auth?.managedStations || [])].filter(Boolean));
      for (const st of stations) {
        if (!unrestricted && !allowedStationIds.has(st.stationId)) continue;
        if (st.lat != null && st.lng != null) {
          out.push({ stationId: st.stationId, lat: Number(st.lat), lng: Number(st.lng), radiusMeters: Number(st.radiusMeters) || 200 });
        }
      }
      const blobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: "personalPlaces" });
      for (const p of (blobs[0]?.payload || [])) {
        if (p.lat != null && p.lng != null) {
          out.push({ stationId: p.id, lat: Number(p.lat), lng: Number(p.lng), radiusMeters: Number(p.radiusMeters) || 200 });
        }
      }
      return out;
    };
    // Match only when the measured distance itself is inside the saved radius.
    // GPS accuracy must never expand a station's permitted attendance zone.
    const matchWorkplace = (workplaces, lat, lng) => {
      let best = null;
      let nearest = null;
      for (const w of workplaces) {
        const d = Math.round(distanceMeters(lat, lng, w.lat, w.lng));
        if (!nearest || d < nearest.dist) nearest = { ...w, dist: d };
        if (d <= w.radiusMeters && (!best || d < best.dist)) best = { ...w, dist: d };
      }
      return { best, nearest, nearestDist: nearest?.dist ?? null };
    };

    if (action === "stationDataSummary" || action === "removeStationData") {
      if (!auth?.admin && !["owner", "director"].includes(auth?.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
      const stationId = String(body.stationId || "");
      const mode = body.mode;
      const targetStationId = String(body.targetStationId || "");
      if (!stationId) return Response.json({ error: "Missing stationId" }, { status: 400 });
      const sourceStations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId, stationId });
      if (!sourceStations.length) return Response.json({ error: "Station not found" }, { status: 404 });
      if (action === "removeStationData") {
        if (!["transfer", "delete"].includes(mode)) return Response.json({ error: "Invalid mode" }, { status: 400 });
        if (mode === "transfer") {
          if (!targetStationId || targetStationId === stationId) return Response.json({ error: "Invalid target station" }, { status: 400 });
          const targetStations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId, stationId: targetStationId });
          if (!targetStations.length) return Response.json({ error: "Target station not found" }, { status: 404 });
        }
      }
      const attendanceUrl = `${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(auth.companyId)}&station_id=eq.${encodeURIComponent(stationId)}`;
      const rowsRes = await fetch(`${attendanceUrl}&select=id`, { headers });
      const rows = await rowsRes.json();
      if (action === "stationDataSummary") return Response.json({ attendance: Array.isArray(rows) ? rows.length : 0 });
      if (mode === "delete") await fetch(attendanceUrl, { method: "DELETE", headers });
      else await fetch(attendanceUrl, { method: "PATCH", headers, body: JSON.stringify({ station_id: targetStationId }) });
      await fetch(`${SUPABASE_URL}/rest/v1/employees_directory?company_id=eq.${encodeURIComponent(auth.companyId)}&station_id=eq.${encodeURIComponent(stationId)}`, { method: "PATCH", headers, body: JSON.stringify({ station_id: mode === "transfer" ? targetStationId : null }) });
      return Response.json({ ok: true, attendance: Array.isArray(rows) ? rows.length : 0 });
    }

    if (action === "getSettings") {
      const { companyId } = body;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance_settings?company_id=eq.${encodeURIComponent(companyId)}`, { headers });
      const rows = await res.json();
      const defaults = { company_id: companyId, work_start_time: "08:00", late_threshold_minutes: 15, gps_enabled: false, gps_required: false };
      const emergency = await getEmergencyWindow(companyId);
      const policy = await getAttendancePolicy(companyId);
      const settings = (!res.ok || !Array.isArray(rows) || rows.length === 0) ? defaults : rows[0];
      return Response.json({ settings: { ...settings, schedule_required: policy.scheduleRequired, early_checkin_minutes: policy.earlyCheckinMinutes, emergency_active: !!emergency?.active, emergency_start_at: emergency?.startAt || null, emergency_end_at: emergency?.endAt || null, emergency_by: emergency?.activatedBy || null } });
    }

    if (action === "setAttendanceEmergency" || action === "clearAttendanceEmergency") {
      if (!auth?.admin && !["owner", "director", "ops_manager", "station_manager"].includes(auth?.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
      const companyId = auth?.companyId;
      if (!companyId) return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
      const blobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: "attendanceEmergency" });
      if (action === "clearAttendanceEmergency") {
        if (blobs[0]) await base44.asServiceRole.entities.CompanyDataBlob.update(blobs[0].id, { payload: [] });
        return Response.json({ ok: true });
      }
      const start = new Date(body.startAt);
      const end = new Date(body.endAt);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) return Response.json({ error: "Invalid emergency time range" }, { status: 400 });
      const window = { startAt: start.toISOString(), endAt: end.toISOString(), activatedBy: auth?.name || auth?.role, activatedAt: new Date().toISOString() };
      if (blobs[0]) await base44.asServiceRole.entities.CompanyDataBlob.update(blobs[0].id, { payload: [window] });
      else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId, category: "attendanceEmergency", payload: [window] });
      return Response.json({ ok: true, emergency: window });
    }

    if (action === "setScheduleRequirement") {
      if (!auth?.admin && !["owner", "director", "ops_manager"].includes(auth?.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
      const companyId = auth?.companyId;
      if (!companyId) return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
      const scheduleRequired = true;
      const blobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: "attendancePolicy" });
      const prior = Array.isArray(blobs?.[0]?.payload) ? (blobs[0].payload[0] || {}) : {};
      const payload = [{ ...prior, scheduleRequired }];
      if (blobs[0]) await base44.asServiceRole.entities.CompanyDataBlob.update(blobs[0].id, { payload });
      else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId, category: "attendancePolicy", payload });
      return Response.json({ ok: true, scheduleRequired });
    }

    if (action === "updateSettings") {
      if (!auth?.admin && !["owner", "director", "ops_manager"].includes(auth?.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { companyId, workStartTime, lateThresholdMinutes, gpsEnabled, gpsRequired, earlyCheckinMinutes } = body;
      if (!companyId) return Response.json({ error: "Missing companyId" }, { status: 400 });
      if (earlyCheckinMinutes != null) {
        const early = Number(earlyCheckinMinutes);
        if (!Number.isFinite(early) || early < 0 || early > 240) return Response.json({ error: "Invalid early check-in window" }, { status: 400 });
        if (companyId !== auth?.companyId && !auth?.admin) return Response.json({ error: "Forbidden" }, { status: 403 });
        const policyBlobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: "attendancePolicy" });
        const prior = Array.isArray(policyBlobs?.[0]?.payload) ? (policyBlobs[0].payload[0] || {}) : {};
        const payload = [{ ...prior, scheduleRequired: true, earlyCheckinMinutes: Math.round(early) }];
        if (policyBlobs[0]) await base44.asServiceRole.entities.CompanyDataBlob.update(policyBlobs[0].id, { payload });
        else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId, category: "attendancePolicy", payload });
      }
      if (workStartTime != null && workStartTime !== "" && !isTime(workStartTime)) return Response.json({ error: "Invalid work start time" }, { status: 400 });
      const threshold = Number(lateThresholdMinutes);
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 240) return Response.json({ error: "Invalid late threshold" }, { status: 400 });
      const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance_settings?company_id=eq.${encodeURIComponent(companyId)}`, { headers });
      const existingRows = await existingRes.json();
      const existing = (Array.isArray(existingRows) && existingRows[0]) || {};
      const patch = {
        company_id: companyId,
        work_start_time: isTime(workStartTime) ? workStartTime : (existing.work_start_time || "08:00"),
        late_threshold_minutes: threshold,
        gps_enabled: !!gpsEnabled,
        gps_required: !!gpsEnabled && !!gpsRequired,
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance_settings`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(patch),
      });
      const updated = await res.json();
      if (!res.ok) {
        return Response.json({ error: updated?.message || "Failed to save settings — run: CREATE TABLE IF NOT EXISTS attendance_settings (company_id text primary key, work_start_time text default '08:00', late_threshold_minutes integer default 15, gps_enabled boolean default false, gps_required boolean default false);" }, { status: 400 });
      }
      const savedPolicy = await getAttendancePolicy(companyId);
      return Response.json({ settings: { ...(Array.isArray(updated) ? updated[0] : updated), early_checkin_minutes: savedPolicy.earlyCheckinMinutes } });
    }

    // One-shot maintenance: turns GPS on for every company that already has a settings row.
    if (action === "enableGpsEverywhere") {
      if (!auth?.admin) return Response.json({ error: "Forbidden" }, { status: 403 });
      const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance_settings?or=(gps_enabled.eq.false,gps_required.eq.false)`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ gps_enabled: true, gps_required: true }),
      });
      const updated = await res.json();
      if (!res.ok) return Response.json({ error: updated?.message || "Failed" }, { status: 400 });
      return Response.json({ ok: true, updated: Array.isArray(updated) ? updated.length : 0 });
    }

    if (action === "syncRoster") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { companyId, employees } = body;
      if (!companyId || !Array.isArray(employees)) return Response.json({ error: "Missing fields" }, { status: 400 });
      const requestedIds = new Set(employees.map((employee) => employee.id).filter(Boolean));
      const companyEmployees = await base44.asServiceRole.entities.Employee.filter({ companyId });
      const validManagerIds = new Set(companyEmployees.map((employee) => employee.employeeId));
      const requestedById = new Map(employees.map((employee) => [employee.id, employee]));
      const companyStations = await base44.asServiceRole.entities.Station.filter({ companyId });
      const defaultStationId = companyStations[0]?.stationId || null;
      const rows = companyEmployees
        .filter((employee) => requestedIds.has(employee.employeeId) && canAccessEmployee(employee))
        .map((employee) => {
          const requested = requestedById.get(employee.employeeId);
          return {
            employee_id: employee.employeeId, company_id: companyId, name: employee.name,
            station_id: employee.stationId || defaultStationId,
            manager_id: validManagerIds.has(requested?.managerId) ? requested.managerId : null,
          };
        });
      if (rows.length === 0) return Response.json({ ok: true });
      const res = await fetch(`${SUPABASE_URL}/rest/v1/employees_directory`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(rows),
      });
      if (!res.ok) {
        const err = await res.json();
        return Response.json({ error: err?.message || "Failed to sync roster — run: CREATE TABLE IF NOT EXISTS employees_directory (employee_id text primary key, company_id text, name text, station_id text, updated_at timestamptz default now()); -- if it already exists: ALTER TABLE employees_directory ADD COLUMN IF NOT EXISTS manager_id text, ADD COLUMN IF NOT EXISTS late_alert_sent_date text;" }, { status: 400 });
      }
      return Response.json({ ok: true });
    }

    // ---- Instant late-check-in alert: only employees assigned to a shift today ----
    // are eligible, preventing owners, off-duty staff, and unscheduled employees from
    // receiving false absence alerts.
    if (action === "checkLateAlerts") {
      const date = toRiyadhDateKey();
      const nowMinutes = riyadhMinutes();
      const dirRes = await fetch(`${SUPABASE_URL}/rest/v1/employees_directory?select=*`, { headers });
      const directory = await dirRes.json();
      if (!dirRes.ok || !Array.isArray(directory) || directory.length === 0) return Response.json({ ok: true, alerted: 0 });

      const attRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?date=eq.${date}&select=employee_id`, { headers });
      const attRows = await attRes.json();
      const checkedIn = new Set((Array.isArray(attRows) ? attRows : []).map((row) => row.employee_id));
      const schedulesCache = {};
      const getSchedules = async (companyId) => {
        if (schedulesCache[companyId]) return schedulesCache[companyId];
        const blobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: "schedules" });
        schedulesCache[companyId] = blobs[0]?.payload || [];
        return schedulesCache[companyId];
      };

      const leaveCache = {};
      const loadCompanyLeave = async (companyId) => {
        if (leaveCache[companyId]) return leaveCache[companyId];
        const [companyEmployees, roster] = await Promise.all([
          base44.asServiceRole.entities.Employee.filter({ companyId }),
          loadLeaveRoster(companyId),
        ]);
        leaveCache[companyId] = { employees: new Map(companyEmployees.map((employee) => [employee.employeeId, employee])), roster };
        return leaveCache[companyId];
      };
      let alerted = 0;
      for (const emp of directory) {
        if (checkedIn.has(emp.employee_id) || emp.late_alert_sent_date === date || !emp.manager_id) continue;
        const companyLeave = await loadCompanyLeave(emp.company_id);
        const mergedLeave = leaveRequestsForEmployeeId(emp.employee_id, {
          entity: companyLeave.employees.get(emp.employee_id),
          roster: companyLeave.roster,
        });
        if (isOnApprovedLeave(mergedLeave, date)) continue;
        const schedules = await getSchedules(emp.company_id);
        const stationSchedule = schedules.find((schedule) => schedule.stationId === emp.station_id);
        const shift = (stationSchedule?.shiftTypes || []).find((item) =>
          (stationSchedule.assignments?.[date]?.[item.id] || []).includes(emp.employee_id)
        );
        if (!shift) continue;
        const lateMinutes = nowMinutes - toMinutes(shift.start);
        if (lateMinutes <= 0) continue;
        await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            user_id: emp.manager_id,
            message: `⏰ ${emp.name || "Employee"} has not checked in — ${lateMinutes} minutes past the allowed time.`,
          }),
        });
        await fetch(`${SUPABASE_URL}/rest/v1/employees_directory?employee_id=eq.${encodeURIComponent(emp.employee_id)}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ late_alert_sent_date: date }),
        });
        alerted++;
      }
      return Response.json({ ok: true, alerted });
    }

    // ---- Check in / out ----
    // Shift start/end times come from the station's existing weekly schedule (Schedules
    // page) — the frontend resolves the employee's shift for today and passes it in.

    if (action === "checkIn") {
      const { companyId, employeeId, employeeName, stationId, lat, lng, accuracy } = body;
      if (!companyId || !employeeId) return Response.json({ error: "Missing fields" }, { status: 400 });
      // Check-in is always personal; management privileges never permit impersonation.
      if (!auth?.admin && employeeId !== auth?.userId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const punchStationId = String(stationId || "").trim();
      const todayKey = toRiyadhDateKey();
      const yesterdayKey = previousDateKey(todayKey);
      const nowRiyadh = riyadhMinutes();
      const policyEarly = (await getAttendancePolicy(companyId)).earlyCheckinMinutes;
      const todayShift = await getScheduledShift(companyId, employeeId, todayKey);
      const yesterdayShift = await getScheduledShift(companyId, employeeId, yesterdayKey);
      const rowOn = async (key) => {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(companyId)}&employee_id=eq.${encodeURIComponent(employeeId)}&date=eq.${key}`, { headers });
        const list = await r.json();
        return Array.isArray(list) && list.length ? list[0] : null;
      };
      // After midnight, last night's overnight shift is still the duty day until it ends (+ grace) or
      // today's own window opens — even with no punch yet: a late check-in is saved on ITS date, on the
      // duty clock (+1440). Same rule as the card (overnightCarryOpen, shared twin).
      const carry = overnightCarryOpen({
        yesterdayRow: await rowOn(yesterdayKey),
        yesterdayShift,
        todayRow: await rowOn(todayKey),
        todayShift,
        nowMin: nowRiyadh,
        earlyWindowMin: policyEarly,
      });
      const date = carry ? yesterdayKey : todayKey;
      let scheduledShift = carry ? yesterdayShift : todayShift;
      if (!scheduledShift?.start) {
        return Response.json({ error: "NOT_SCHEDULED" }, { status: 400 });
      }
      if (punchStationId) scheduledShift = { ...scheduledShift, stationId: punchStationId };
      const empsForLeave = await base44.asServiceRole.entities.Employee.filter({ companyId, employeeId });
      const mergedLeave = await punchLeaveRequests(companyId, employeeId, empsForLeave[0] || null);
      const leaveGate = checkCheckInLeaveGate(mergedLeave, date);
      if (!leaveGate.ok) {
        return Response.json({
          error: leaveGate.error,
          reason: leaveGate.reason,
          reasonEn: leaveGate.reasonEn,
        }, { status: 400 });
      }
      const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(companyId)}&employee_id=eq.${encodeURIComponent(employeeId)}&date=eq.${date}`, { headers });
      const existing = await existingRes.json();
      if (Array.isArray(existing) && existing.length > 0 && existing[0].check_in_at) {
        return Response.json({ error: "ALREADY_CHECKED_IN", attendance: existing[0] }, { status: 400 });
      }
      const setRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance_settings?company_id=eq.${encodeURIComponent(companyId)}`, { headers });
      const setRows = await setRes.json();
      const settings = (Array.isArray(setRows) && setRows[0]) || { late_threshold_minutes: 15, gps_enabled: false, gps_required: false };
      const emergency = await getEmergencyWindow(companyId);
      const hasCoords = lat != null && lng != null;
      const locationRequired = settings.gps_enabled === true && settings.gps_required === true && !emergency?.active;
      if (locationRequired && !hasCoords) return Response.json({ error: "GPS_REQUIRED" }, { status: 400 });
      const scheduledStationId = punchStationId || scheduledShift.stationId || auth?.stationId || stationId;
      let workplace = null;
      let recordedWorkplace = null;
      let nearestDist = null;
      if (locationRequired) {
        const workplaces = (await listWorkplaces()).filter((item) => item.stationId === scheduledStationId);
        if (workplaces.length === 0) return Response.json({ error: "STATION_LOCATION_REQUIRED" }, { status: 400 });
        const match = matchWorkplace(workplaces, lat, lng);
        workplace = match.best;
        recordedWorkplace = match.best || match.nearest;
        nearestDist = match.nearestDist;
        if (!workplace) return Response.json({ error: "OUTSIDE_STATION", distanceMeters: nearestDist }, { status: 400 });
      }
      const inZone = !locationRequired || !!workplace;
      const now = new Date();
      const startMinutes = toMinutes(scheduledShift.start);
      if (startMinutes == null) return Response.json({ error: "NOT_SCHEDULED" }, { status: 400 });
      const nowMinutes = carry ? nowRiyadh + 1440 : nowRiyadh;
      // The same window the punch card shows: before it opens, the check-in is refused and names the hour.
      const earlyGate = carry ? { ok: true } : checkEarlyCheckInGate(scheduledShift, nowMinutes, policyEarly);
      if (!earlyGate.ok) return Response.json({ error: earlyGate.error, reason: earlyGate.reason, reasonEn: earlyGate.reasonEn, opensAt: earlyGate.opensAt }, { status: 400 });
      // After the shift has ended (+ the forgotten hour) a self check-in is closed — a manual entry instead.
      const lateGate = checkLateCheckInGate(scheduledShift, nowMinutes);
      if (!lateGate.ok) return Response.json({ error: lateGate.error, reason: lateGate.reason, reasonEn: lateGate.reasonEn, endsAt: lateGate.endsAt }, { status: 400 });
      // Art. 154: arriving inside her nursing minutes at the start is not lateness (shared twin).
      // Minutes past start beyond the grace rule, less her nursing minutes — the shared reading.
      const lateMinutes = lateMinutesFromScheduledStart(nowMinutes, scheduledShift.start, undefined, nursingStartExcuse(empsForLeave[0] || null, date)).lateMinutes;
      const timelyStatus = lateMinutes > 0 ? "late" : "present";
      // «لا يُحسب غياب بلا سجل»: تعذّر تحديد الموقع (خارج النطاق أو قياس غير حاسم)
      // لا يُنتج غياباً موثّقاً، بل حالة معلّقة تنتظر مراجعة المشرف.
      const inconclusiveAccuracy = Number(accuracy) > 100;
      const status = inZone && !inconclusiveAccuracy ? timelyStatus : "pending_review";
      const distMeters = recordedWorkplace?.dist ?? nearestDist;
      const locationStatus = emergency?.active ? "emergency" : (!locationRequired ? "manual" : (inconclusiveAccuracy ? "inconclusive" : (inZone ? "inside" : "outside")));
      const payload = {
        company_id: companyId,
        employee_id: employeeId,
        employee_name: employeeName || "",
        station_id: recordedWorkplace?.stationId || punchStationId || stationId || null,
        date,
        check_in_at: now.toISOString(),
        status,
        late_minutes: status === "late" ? lateMinutes : 0,
        in_zone: inZone,
        manual_override: !!emergency?.active,
        override_by: emergency?.active ? emergency.activatedBy : null,
        excused: false,
        early_checkout: false,
        check_in_lat: lat ?? null,
        check_in_lng: lng ?? null,
        station_lat: recordedWorkplace?.lat ?? null,
        station_lng: recordedWorkplace?.lng ?? null,
        distance_meters: distMeters,
        location_status: locationStatus,
      };
      let res;
      if (Array.isArray(existing) && existing.length > 0) {
        res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?id=eq.${encodeURIComponent(existing[0].id)}`, {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${SUPABASE_URL}/rest/v1/attendance`, {
          method: "POST",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
      }
      let saved = await res.json();
      if (!res.ok && /in_zone|manual_override|override_by/i.test(saved?.message || "")) {
        const compatiblePayload = { ...payload };
        delete compatiblePayload.in_zone;
        delete compatiblePayload.manual_override;
        delete compatiblePayload.override_by;
        const compatibleUrl = Array.isArray(existing) && existing.length > 0
          ? `${SUPABASE_URL}/rest/v1/attendance?id=eq.${encodeURIComponent(existing[0].id)}`
          : `${SUPABASE_URL}/rest/v1/attendance`;
        res = await fetch(compatibleUrl, { method: Array.isArray(existing) && existing.length > 0 ? "PATCH" : "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(compatiblePayload) });
        saved = await res.json();
      }
      if (!res.ok) {
        console.error("checkIn failed:", saved?.message || saved, "hint: ALTER TABLE attendance ADD COLUMN IF NOT EXISTS in_zone boolean DEFAULT false, ADD COLUMN IF NOT EXISTS manual_override boolean DEFAULT false, ADD COLUMN IF NOT EXISTS override_by text;");
        return Response.json({ error: "CHECK_IN_FAILED" }, { status: 400 });
      }
      await fetch(`${SUPABASE_URL}/rest/v1/employees_directory`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify([{ employee_id: employeeId, company_id: companyId, name: employeeName || "", station_id: stationId || null }]),
      });
      return Response.json({ attendance: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === "checkOut") {
      const { employeeId, shiftEnd, lat, lng, accuracy } = body;
      if (!employeeId) return Response.json({ error: "Missing employeeId" }, { status: 400 });
      // Check-out is always personal; management privileges never permit impersonation.
      if (!auth?.admin && employeeId !== auth?.userId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const emergency = await getEmergencyWindow(auth.companyId);
      const settingsRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance_settings?company_id=eq.${encodeURIComponent(auth.companyId)}`, { headers });
      const settingsRows = await settingsRes.json();
      const settings = (Array.isArray(settingsRows) && settingsRows[0]) || { gps_enabled: false, gps_required: false };
      const hasCoords = lat != null && lng != null;
      const locationRequired = settings.gps_enabled === true && settings.gps_required === true && !emergency?.active;
      if (locationRequired && !hasCoords) return Response.json({ error: "GPS_REQUIRED" }, { status: 400 });
      // The duty day's row — after midnight, yesterday's open overnight row (dutyRowOf).
      const duty = await dutyRowOf(auth.companyId, employeeId);
      const date = duty.date;
      const row = duty.row;
      if (!row || !row.check_in_at) return Response.json({ error: "NOT_CHECKED_IN" }, { status: 400 });
      if (row.check_out_at) return Response.json({ error: "ALREADY_CHECKED_OUT", attendance: row }, { status: 400 });
      let checkoutDistance = null;
      if (locationRequired) {
        const workplaces = await listWorkplaces();
        if (workplaces.length === 0) return Response.json({ error: "STATION_LOCATION_REQUIRED" }, { status: 400 });
        const { best: outWorkplace, nearestDist } = matchWorkplace(workplaces, lat, lng);
        if (!outWorkplace) return Response.json({ error: "OUTSIDE_STATION", distanceMeters: nearestDist }, { status: 400 });
        checkoutDistance = outWorkplace.dist;
      }
      const now = new Date();
      const workHours = Math.round(((now.getTime() - new Date(row.check_in_at).getTime()) / 3600000) * 100) / 100;
      const nowMinutes = riyadhMinutes();
      const scheduledOut = duty.shift || await getScheduledShift(auth.companyId, employeeId, date);
      const shiftEndMinutes = toMinutes(scheduledOut?.end || shiftEnd);
      // Art. 154: leaving inside her nursing minutes at the end is not an early checkout (shared twin).
      const outEmployee = (await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId }))[0] || null;
      // An overnight shift left before midnight (still its start day) is early by definition.
      const earlyCheckout = shiftEndMinutes != null && (isOvernightShift(scheduledOut) && !duty.carried
        ? true
        : nowMinutes < shiftEndMinutes - nursingEndExcuse(outEmployee, date));
      // «راحة مرنة ببصمة»: an open break ends at the checkout; an unpunched one is stored as assumed —
      // where the card placed it (nearest prayer) when that placement passes the gate, else the window's middle.
      const closedBreaks = scheduledOut?.breakMode === "flex"
        ? closeFlexBreaks(scheduledOut, row, now.toISOString(), body.assumedBreak)
        : null;
      const outPatch: Record<string, unknown> = { check_out_at: now.toISOString(), work_hours: workHours, early_checkout: earlyCheckout, check_out_lat: lat ?? null, check_out_lng: lng ?? null };
      if (closedBreaks) outPatch.breaks = closedBreaks;
      let patchRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(outPatch),
      });
      let updated = await patchRes.json();
      if (!patchRes.ok && closedBreaks && /breaks/i.test(updated?.message || "")) {
        console.error("checkOut breaks column missing — hint:", BREAKS_COLUMN_HINT);
        delete outPatch.breaks;
        patchRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(outPatch) });
        updated = await patchRes.json();
      }
      if (!patchRes.ok) {
        console.error("checkOut failed:", updated?.message || updated);
        return Response.json({ error: updated?.message || "Failed to save checkout location" }, { status: 400 });
      }
      // The day closed: its overtime read through the shared twin (Arts 98, 104, 107) with the server's
      // own count of the week. The client records the otDecisions entry (pending the manager's pay /
      // compensatory-leave decision) on this week figure. Best-effort: the checkout is already saved.
      let overtime = null;
      try {
        const keys = weekKeysOf(date);
        const weekRes = keys[0] && keys[0] < date
          ? await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(auth.companyId)}&employee_id=eq.${encodeURIComponent(employeeId)}&date=gte.${keys[0]}&date=lt.${date}`, { headers })
          : null;
        const weekRows = weekRes ? await weekRes.json() : [];
        const blobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category: "schedules" });
        const shiftOn = (key) => {
          for (const schedule of (blobs[0]?.payload || [])) {
            for (const shift of (schedule.shiftTypes || [])) {
              if ((schedule.assignments?.[key]?.[shift.id] || []).includes(employeeId)) return { ...shift, stationId: schedule.stationId };
            }
          }
          return null;
        };
        // The week's worked days (rostered or punched): rest days worked are those past the file's count.
        const rowsList = Array.isArray(weekRows) ? weekRows : [];
        const weekWorked = keys.filter((key) => key === date || !!shiftOn(key) || rowsList.some((r) => String(r?.date || "").slice(0, 10) === key && (r?.check_in_at || r?.checkInAt)));
        const prior = weekOrdinaryBeforeCore({ rows: rowsList, dayKey: date, shiftOn, weekWorkedKeys: weekWorked });
        const { auto } = readDayOvertimeCore({ row: updated[0], dayKey: date, shift: scheduledOut, weekPriorOrdinaryMinutes: prior, weekWorkedKeys: weekWorked });
        overtime = auto ? { ...auto, weekPriorOrdinaryMinutes: prior } : null;
      } catch (otErr) {
        console.error("checkOut overtime reading failed:", otErr?.message || otErr);
      }
      return Response.json({ attendance: updated[0], checkoutDistance, overtime });
    }

    // ---- «راحة مرنة ببصمة»: break punches on the same day record ----
    // The gate is the shared checkFlexBreakPunchGate (the punch card runs the same one). A required
    // location is asked for as on check-in, and recorded; it is not matched to the station radius —
    // a lawful rest may be taken off site (prayer, meal).

    if (action === "breakStart" || action === "breakEnd") {
      const { employeeId, lat, lng, accuracy } = body;
      if (!employeeId) return Response.json({ error: "Missing employeeId" }, { status: 400 });
      if (!auth?.admin && employeeId !== auth?.userId) return Response.json({ error: "Forbidden" }, { status: 403 });
      const emergency = await getEmergencyWindow(auth.companyId);
      const settingsRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance_settings?company_id=eq.${encodeURIComponent(auth.companyId)}`, { headers });
      const settingsRows = await settingsRes.json();
      const settings = (Array.isArray(settingsRows) && settingsRows[0]) || { gps_enabled: false, gps_required: false };
      const locationRequired = settings.gps_enabled === true && settings.gps_required === true && !emergency?.active;
      if (locationRequired && (lat == null || lng == null)) return Response.json({ error: "GPS_REQUIRED" }, { status: 400 });
      // The duty day's row — an overnight break after midnight writes onto yesterday's open row.
      const duty = await dutyRowOf(auth.companyId, employeeId);
      const date = duty.date;
      const row = duty.row;
      const shift = duty.shift || await getScheduledShift(auth.companyId, employeeId, date);
      const nowIso = new Date().toISOString();
      const kind = action === "breakStart" ? "start" : "end";
      const gate = checkFlexBreakPunchGate({ action: kind, shift, breaks: row?.breaks, checkIn: row?.check_in_at, checkOut: row?.check_out_at, now: nowIso, onDate: date });
      if (!gate.ok) return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      const breaks = Array.isArray(row?.breaks) ? row.breaks.map((item: any) => ({ ...item })) : [];
      const where = lat != null && lng != null ? { lat, lng, accuracy: accuracy ?? null } : {};
      if (kind === "start") {
        breaks.push({ start: nowIso, end: null, source: "punch", ...(Object.keys(where).length ? { startAt: where } : {}) });
      } else {
        const open = [...breaks].reverse().find((item: any) => item?.source !== "assumed" && item?.start && !item?.end);
        if (open) {
          open.end = nowIso;
          if (gate.short) open.short = true;
          if (Object.keys(where).length) open.endAt = where;
        }
      }
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ breaks }),
      });
      const updated = await patchRes.json();
      if (!patchRes.ok) {
        console.error(`${action} failed:`, updated?.message || updated, "hint:", BREAKS_COLUMN_HINT);
        return Response.json({ error: "BREAK_SAVE_FAILED" }, { status: 400 });
      }
      return Response.json({ attendance: Array.isArray(updated) ? updated[0] : updated, short: !!gate.short });
    }

    if (action === "reviewLateReturn") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const employeeId = String(body.employeeId || "");
      if (!employeeId || employeeId === auth?.userId) {
        return Response.json({ error: "SELF_DECISION", reason: "لا يقرّر الموظف في راحته — القرار لمديره.", reasonEn: "A worker does not decide on their own break — their manager does." }, { status: 403 });
      }
      if (!(await employeeInCompany(employeeId))) return Response.json({ error: "Forbidden" }, { status: 403 });
      const date = String(body.date);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(auth.companyId)}&employee_id=eq.${encodeURIComponent(employeeId)}&date=eq.${date}`, { headers });
      const rows = await res.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      const breaks = Array.isArray(row?.breaks) ? row.breaks.map((item: any) => ({ ...item })) : [];
      const punched = breaks.filter((item: any) => item?.source !== "assumed" && item?.start);
      if (!row || !punched.length) return Response.json({ error: "NO_BREAK_PUNCH", reason: "لا راحة مثبتة ببصمة لهذا اليوم.", reasonEn: "No punched break on this day." }, { status: 400 });
      punched[punched.length - 1].review = { decision: body.decision, by: auth.name || "Manager", at: new Date().toISOString() };
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ breaks }),
      });
      const updated = await patchRes.json();
      if (!patchRes.ok) return Response.json({ error: "BREAK_SAVE_FAILED" }, { status: 400 });
      return Response.json({ attendance: Array.isArray(updated) ? updated[0] : updated });
    }

    // ---- Authorized manager: record attendance without GPS ----

    if (action === "manualCheckIn") {
      if (!auth?.admin && !MANUAL_ATTENDANCE_ROLES.includes(auth?.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { employeeId } = body;
      if (!employeeId || !(await employeeInCompany(employeeId))) return Response.json({ error: "Forbidden" }, { status: 403 });
      const employees = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId });
      const employee = employees[0];
      if (!employee) return Response.json({ error: "Employee not found" }, { status: 404 });
      const date = toRiyadhDateKey();
      const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(auth.companyId)}&employee_id=eq.${encodeURIComponent(employeeId)}&date=eq.${date}`, { headers });
      const existingRows = await existingRes.json();
      const existing = Array.isArray(existingRows) ? existingRows[0] : null;
      const mergedLeave = await punchLeaveRequests(auth.companyId, employeeId, employee);
      const leaveGate = checkCheckInLeaveGate(mergedLeave, date);
      if (!leaveGate.ok) {
        return Response.json({
          error: leaveGate.error,
          reason: leaveGate.reason,
          reasonEn: leaveGate.reasonEn,
        }, { status: 400 });
      }
      if (existing?.check_in_at) {
        return Response.json({ error: "ALREADY_CHECKED_IN", attendance: existing }, { status: 400 });
      }
      const defaultStations = employee.stationId ? [] : await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId });
      const effectiveStationId = employee.stationId || defaultStations[0]?.stationId || null;
      // The manager records the time the worker actually arrived (a manual punch request carries it);
      // never a time after now. Without one, the click time.
      const inClock = body.time != null && body.time !== "" ? String(body.time) : "";
      if (inClock && !isTime(inClock)) return Response.json({ error: "TIME_REQUIRED", reason: "حدد وقت الحضور.", reasonEn: "Set the check-in time." }, { status: 400 });
      const inAt = inClock ? new Date(`${date}T${inClock}:00+03:00`) : new Date();
      if (inAt.getTime() > Date.now() + 60000) return Response.json({ error: "TIME_IN_FUTURE", reason: "لا يُسجَّل حضور بوقت لم يأتِ بعد.", reasonEn: "A check-in is not recorded at a time that has not come yet." }, { status: 400 });
      const payload = {
        company_id: auth.companyId, employee_id: employeeId, employee_name: employee.name || "",
        station_id: effectiveStationId, date, check_in_at: inAt.toISOString(), check_out_at: null,
        status: "present", late_minutes: 0, excused: false, early_checkout: false,
        in_zone: false, manual_override: true, override_by: auth.role === "owner" && body.managerName ? String(body.managerName).slice(0, 120) : (auth.name || "Manager"), location_status: "manual",
        ...(String(body.reason || "").trim() ? { excused_note: String(body.reason).trim().slice(0, 500) } : {}),
      };
      const url = existing ? `${SUPABASE_URL}/rest/v1/attendance?id=eq.${encodeURIComponent(existing.id)}` : `${SUPABASE_URL}/rest/v1/attendance`;
      const res = await fetch(url, { method: existing ? "PATCH" : "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(payload) });
      let saved = await res.json();
      if (!res.ok && /in_zone|manual_override|override_by/i.test(saved?.message || "")) {
        const compatiblePayload = { ...payload, excused_by_name: payload.override_by };
        delete compatiblePayload.in_zone;
        delete compatiblePayload.manual_override;
        delete compatiblePayload.override_by;
        const retry = await fetch(url, { method: existing ? "PATCH" : "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(compatiblePayload) });
        saved = await retry.json();
        if (retry.ok) return Response.json({ attendance: Array.isArray(saved) ? saved[0] : saved });
      }
      if (!res.ok) {
        console.error("manualCheckIn failed:", saved?.message || saved);
        return Response.json({ error: saved?.message || "Failed to record manual attendance — run: ALTER TABLE attendance ADD COLUMN IF NOT EXISTS in_zone boolean DEFAULT false, ADD COLUMN IF NOT EXISTS manual_override boolean DEFAULT false, ADD COLUMN IF NOT EXISTS override_by text;" }, { status: 400 });
      }
      return Response.json({ attendance: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === "manualCheckOut") {
      if (!auth?.admin && !MANUAL_ATTENDANCE_ROLES.includes(auth?.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
      const employeeId = String(body.employeeId || "");
      const reason = String(body.reason || "").trim();
      if (!employeeId || !reason) return Response.json({ error: "Employee and reason are required" }, { status: 400 });
      if (!(await employeeInCompany(employeeId))) return Response.json({ error: "Forbidden" }, { status: 403 });
      const date = toRiyadhDateKey();
      const currentRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(auth.companyId)}&employee_id=eq.${encodeURIComponent(employeeId)}&date=eq.${date}`, { headers });
      const currentRows = await currentRes.json();
      const current = Array.isArray(currentRows) ? currentRows[0] : null;
      const employeesOut = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId });
      const leaveOut = checkCheckInLeaveGate(await punchLeaveRequests(auth.companyId, employeeId, employeesOut[0] || null), date);
      if (!leaveOut.ok) {
        return Response.json({
          error: leaveOut.error,
          reason: leaveOut.reason,
          reasonEn: leaveOut.reasonEn,
        }, { status: 400 });
      }
      if (!current?.check_in_at) return Response.json({ error: "NOT_CHECKED_IN" }, { status: 400 });
      if (current.check_out_at) return Response.json({ error: "ALREADY_CHECKED_OUT", attendance: current }, { status: 400 });
      // The time the worker left — required: a click time would invent overtime nobody worked.
      const outClock = String(body.time || "");
      if (!isTime(outClock)) return Response.json({ error: "TIME_REQUIRED", reason: "حدد وقت الانصراف.", reasonEn: "Set the checkout time." }, { status: 400 });
      let now = new Date(`${date}T${outClock}:00+03:00`);
      if (now.getTime() <= new Date(current.check_in_at).getTime()) now = new Date(now.getTime() + 86400000); // overnight
      if (now.getTime() > Date.now() + 60000) return Response.json({ error: "TIME_IN_FUTURE", reason: "لا يُسجَّل انصراف بوقت لم يأتِ بعد.", reasonEn: "A checkout is not recorded at a time that has not come yet." }, { status: 400 });
      const workHours = Math.round(((now.getTime() - new Date(current.check_in_at).getTime()) / 3600000) * 100) / 100;
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?id=eq.${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({
          check_out_at: now.toISOString(), location_status: "manual", override_by: auth.name || "Manager",
          manual_override: true, excused_note: reason, work_hours: workHours,
        }),
      });
      const updated = await patchRes.json();
      if (!patchRes.ok) {
        console.error("manualCheckOut failed:", updated?.message || updated);
        return Response.json({ error: updated?.message || "Failed to record manual check-out" }, { status: 400 });
      }
      return Response.json({ attendance: Array.isArray(updated) ? updated[0] : updated });
    }

    // ---- Manager: excuse a late/absent record (keeps the record, removes the penalty) ----

    if (action === "excuseAttendance") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { attendanceId, managerId, managerName, excused, note } = body;
      if (!attendanceId) return Response.json({ error: "Missing attendanceId" }, { status: 400 });
      const currentRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?id=eq.${encodeURIComponent(attendanceId)}`, { headers });
      const currentRows = await currentRes.json();
      const current = Array.isArray(currentRows) && currentRows[0];
      if (!current || !(await employeeInCompany(current.employee_id))) return Response.json({ error: "Forbidden" }, { status: 403 });
      const patch = excused
        ? { excused: true, excused_by: managerId || null, excused_by_name: managerName || "", excused_note: note || "", excused_at: new Date().toISOString() }
        : { excused: false, excused_by: null, excused_by_name: "", excused_note: "", excused_at: null };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?id=eq.${encodeURIComponent(attendanceId)}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });
      const updated = await res.json();
      if (!res.ok) return Response.json({ error: updated?.message || "Failed to update excuse" }, { status: 400 });
      return Response.json({ attendance: Array.isArray(updated) ? updated[0] : updated });
    }

    if (action === "getTodayStatus") {
      const { employeeId } = body;
      if (!employeeId) return Response.json({ error: "Missing employeeId" }, { status: 400 });
      if (!(await employeeInCompany(employeeId))) return Response.json({ error: "Forbidden" }, { status: 403 });
      // The duty day's row: after midnight the open overnight row of yesterday (its date says so).
      const duty = await dutyRowOf(auth.companyId, employeeId);
      return Response.json({ attendance: duty.row || null, dutyDate: duty.date, carried: duty.carried });
    }

    if (action === "listDaily") {
      const { employeeIds, date } = body;
      if (!Array.isArray(employeeIds) || employeeIds.length === 0) return Response.json({ rows: [] });
      const scopedIds = await filterCompanyEmployeeIds(employeeIds);
      if (scopedIds.length === 0) return Response.json({ rows: [] });
      if (date && !isDate(date)) return Response.json({ error: "Invalid date" }, { status: 400 });
      const d = date || toRiyadhDateKey();
      const idsList = scopedIds.map((id) => `"${id}"`).join(",");
      const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(auth.companyId)}&employee_id=in.(${idsList})&date=eq.${d}`, { headers });
      const rows = await res.json();
      if (!res.ok) return Response.json({ rows: [] });
      return Response.json({ rows: rows || [] });
    }

    if (action === "listMonthly") {
      const { employeeId, month } = body;
      if (!employeeId || !month) return Response.json({ error: "Missing fields" }, { status: 400 });
      if (!isMonth(month)) return Response.json({ error: "Invalid month" }, { status: 400 });
      if (!(await employeeInCompany(employeeId))) return Response.json({ error: "Forbidden" }, { status: 403 });
      const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(auth.companyId)}&employee_id=eq.${encodeURIComponent(employeeId)}&date=gte.${month}-01&date=lte.${month}-31&order=date.asc`, { headers });
      const rows = await res.json();
      if (!res.ok) return Response.json({ rows: [] });
      return Response.json({ rows: rows || [] });
    }

    // ---- Flexible date-range report (used by the monthly/3mo/6mo/yearly/custom report filters) ----

    if (action === "listRange") {
      const { employeeId, startDate, endDate } = body;
      if (!employeeId || !startDate || !endDate) return Response.json({ error: "Missing fields" }, { status: 400 });
      if (!isDate(startDate) || !isDate(endDate) || startDate > endDate) return Response.json({ error: "Invalid date range" }, { status: 400 });
      if (!(await employeeInCompany(employeeId))) return Response.json({ error: "Forbidden" }, { status: 403 });
      const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(auth.companyId)}&employee_id=eq.${encodeURIComponent(employeeId)}&date=gte.${startDate}&date=lte.${endDate}&order=date.asc`, { headers });
      const rows = await res.json();
      if (!res.ok) return Response.json({ rows: [] });
      return Response.json({ rows: rows || [] });
    }

    // ---- Manager analytics: attendance rate, late frequency, employee comparison ----

    if (action === "getAnalytics") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { employeeIds: rawIds, month } = body;
      if (!Array.isArray(rawIds) || rawIds.length === 0 || !month) return Response.json({ stats: [] });
      if (!isMonth(month)) return Response.json({ error: "Invalid month" }, { status: 400 });
      const employeeIds = await filterCompanyEmployeeIds(rawIds);
      if (employeeIds.length === 0) return Response.json({ stats: [] });
      const idsList = employeeIds.map((id) => `"${id}"`).join(",");
      const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(auth.companyId)}&employee_id=in.(${idsList})&date=gte.${month}-01&date=lte.${month}-31`, { headers });
      const rows = await res.json();
      if (!res.ok || !Array.isArray(rows)) return Response.json({ stats: [] });
      const byEmployee = {};
      for (const id of employeeIds) byEmployee[id] = { employeeId: id, present: 0, late: 0, excusedLate: 0, absent: 0, offDay: 0, lateMinutesSum: 0 };
      for (const r of rows) {
        const bucket = byEmployee[r.employee_id];
        if (!bucket) continue;
        // pending_review لا يُحسب حضوراً ولا غياباً حتى يراجعه المشرف.
        if (r.status === "pending_review") continue;
        if (r.status === "present") bucket.present++;
        else if (r.status === "late") {
          if (r.excused) bucket.excusedLate++;
          else bucket.late++;
          bucket.lateMinutesSum += Number(r.late_minutes) || 0;
        } else if (r.status === "absent") {
          if (!r.excused) bucket.absent++;
        } else if (r.status === "off_day") bucket.offDay++;
      }
      const stats = Object.values(byEmployee).map((b) => {
        const worked = b.present + b.late + b.excusedLate;
        const counted = worked + b.absent;
        const lateEvents = b.late + b.excusedLate;
        return {
          ...b,
          attendanceRate: counted > 0 ? Math.round((worked / counted) * 1000) / 10 : null,
          avgLateMinutes: lateEvents > 0 ? Math.round((b.lateMinutesSum / lateEvents) * 10) / 10 : 0,
        };
      });
      return Response.json({ stats });
    }

    if (action === "markAbsentees") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const companyId = auth?.companyId;
      if (!companyId) return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
      const date = toRiyadhDateKey();
      const dirRes = await fetch(`${SUPABASE_URL}/rest/v1/employees_directory?company_id=eq.${encodeURIComponent(companyId)}&select=*`, { headers });
      const directory = await dirRes.json();
      if (!dirRes.ok || !Array.isArray(directory) || directory.length === 0) return Response.json({ ok: true, marked: 0, onLeave: 0, notScheduled: 0 });
      const employeeRecords = await base44.asServiceRole.entities.Employee.filter({ companyId });
      const employeeById = new Map(employeeRecords.filter(canAccessEmployee).map((record) => [record.employeeId, record]));
      const leaveRoster = await loadLeaveRoster(companyId);
      const attRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(companyId)}&date=eq.${date}&select=employee_id`, { headers });
      const attRows = await attRes.json();
      const already = new Set((Array.isArray(attRows) ? attRows : []).map((row) => row.employee_id));
      const blobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: "schedules" });
      const schedules = blobs[0]?.payload || [];
      const missing = [];
      let onLeave = 0;
      let notScheduled = 0;
      for (const directoryEmployee of directory) {
        const employee = employeeById.get(directoryEmployee.employee_id);
        if (!employee || already.has(directoryEmployee.employee_id)) continue;
        const hasShift = schedules.some((schedule) => (schedule.shiftTypes || []).some((shift) =>
          (schedule.assignments?.[date]?.[shift.id] || []).includes(directoryEmployee.employee_id)
        ));
        if (!hasShift) { notScheduled++; continue; }
        const mergedLeave = leaveRequestsForEmployeeId(directoryEmployee.employee_id, {
          entity: employee,
          roster: leaveRoster,
        });
        if (isOnApprovedLeave(mergedLeave, date)) { onLeave++; continue; }
        missing.push(directoryEmployee);
      }
      if (missing.length === 0) return Response.json({ ok: true, marked: 0, onLeave, notScheduled });
      const inserts = missing.map((e) => ({
        company_id: e.company_id,
        employee_id: e.employee_id,
        employee_name: e.name,
        station_id: e.station_id,
        date,
        status: "absent",
        late_minutes: 0,
        excused: false,
        early_checkout: false,
        work_hours: 0,
      }));
      const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(inserts),
      });
      if (!res.ok) {
        const err = await res.json();
        return Response.json({ error: err?.message || "Failed to mark absentees" }, { status: 400 });
      }
      return Response.json({ ok: true, marked: missing.length, onLeave, notScheduled });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
/**
 * The break list stored when a flex day closes (twin of actualDuty.closeDayBreaks): an open punched
 * break ends at the checkout; with none punched, an assumed break («مفترضة — لم تُثبت ببصمة») at the
 * card's placement when checkAssumedBreakGate passes it, else where resolveFlexDayBreaks places it.
 */
function closeFlexBreaks(shift: any, row: any, checkOutIso: string, assumedBreak: any) {
  const list = Array.isArray(row?.breaks) ? row.breaks.map((item: any) => ({ ...item })) : [];
  for (const item of list) if (item && item.source !== "assumed" && item.start && !item.end) item.end = checkOutIso;
  const onDate = String(row?.date || "").slice(0, 10);
  const day = resolveFlexDayBreaks({ shift, breaks: list, checkIn: row?.check_in_at, checkOut: checkOutIso, onDate });
  if (!day.flex || !day.assumed || list.some((item: any) => item?.source === "assumed")) return list;
  const card = assumedBreak ? checkAssumedBreakGate({ shift, breaks: list, start: assumedBreak.start, end: assumedBreak.end, onDate, checkOut: checkOutIso }) : null;
  const inMs = new Date(row.check_in_at).getTime();
  const lift = (m: number) => (m + 720 < day.flex.shiftStart ? m + 1440 : m);
  const inParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(row.check_in_at));
  const inM = lift(Number(inParts.find((p) => p.type === "hour")?.value || 0) * 60 + Number(inParts.find((p) => p.type === "minute")?.value || 0));
  const toMin = (hm: string) => lift(Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)));
  const startMin = card?.ok ? toMin(card.start) : day.assumed.startMin;
  // The full minutes, or cut where the checkout fell inside it (as a punched break closes at the checkout).
  const minutes = card?.ok ? card.minutes : day.assumed.endMin - day.assumed.startMin;
  const base = inMs - (inMs % 60000);
  const iso = (m: number) => new Date(base + (m - inM) * 60000).toISOString();
  list.push({ start: iso(startMin), end: iso(startMin + minutes), source: "assumed" });
  return list;
}
