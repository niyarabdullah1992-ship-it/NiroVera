import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  ATT_STATUS,
  buildRosterRow,
  checkOtDecisionGate,
  checkOutOfGeofenceGate,
  checkSettleAbsenceGate,
  deriveAttStats,
  filterRosterByStatus,
  localDateKey,
  type PunchLike,
} from "../../shared/attendanceDerivations.ts";
import { deriveVerificationMode } from "../../shared/settingsDerivations.ts";

/**
 * do-not-invoke-from-frontend — live punches are `personalAttendance` (supabaseAttendance + store).
 * Leftover callers persist to `personalAttendance` only. `attendanceLedger` is read-once fallback.
 */
const LEDGER_CATEGORY = "personalAttendance";
const LEDGER_LEGACY_CATEGORY = "attendanceLedger"; // do-not-write

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  return id || null;
}

function riyadhDateKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const action = String(body.action || "");
    const companyId = requireCompanyId(body.companyId);
    if (!companyId) {
      return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
    }

    const sessionAuth = await authPowerCareSession(base44, companyId, body.sessionToken);
    if (!sessionAuth) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const auth = {
      companyId,
      userId: sessionAuth.userId || null,
      name: sessionAuth.name || "User",
      role: sessionAuth.role || "employee",
      stationId: sessionAuth.stationId || null,
      owner: !!sessionAuth.owner || sessionAuth.role === "owner" || sessionAuth.admin,
      admin: !!sessionAuth.admin,
    };

    const managerRoles = ["owner", "director", "ops_manager", "station_manager", "pgm", "admin", "hr"];
    const isManager = auth.owner || auth.admin || managerRoles.includes(auth.role);

    const loadBlob = async (category: string) => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category });
      return rows[0] || null;
    };

    const saveBlob = async (category: string, payload: unknown) => {
      if (category === LEDGER_LEGACY_CATEGORY || category === "companySettings") return;
      const blob = await loadBlob(category);
      if (blob) await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload });
      else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId: auth.companyId, category, payload });
    };

    const loadLedger = async () => {
      const blob = await loadBlob(LEDGER_CATEGORY);
      const payload = blob?.payload;
      let punches: PunchLike[] = [];
      let geofenceVerificationRequired = true;
      if (Array.isArray(payload)) {
        punches = payload as PunchLike[];
      } else if (payload && typeof payload === "object") {
        punches = Array.isArray((payload as { punches?: unknown[] }).punches)
          ? (payload as { punches: PunchLike[] }).punches
          : [];
        geofenceVerificationRequired =
          (payload as { geofenceVerificationRequired?: boolean }).geofenceVerificationRequired !== false;
      }
      if (!punches.length) {
        const legacy = await loadBlob(LEDGER_LEGACY_CATEGORY);
        const raw = legacy?.payload && typeof legacy.payload === "object" ? legacy.payload : {};
        punches = Array.isArray((raw as { punches?: unknown[] }).punches)
          ? (raw as { punches: PunchLike[] }).punches
          : (Array.isArray(legacy?.payload) ? legacy.payload as PunchLike[] : []);
        if (typeof (raw as { geofenceVerificationRequired?: boolean }).geofenceVerificationRequired === "boolean") {
          geofenceVerificationRequired = (raw as { geofenceVerificationRequired: boolean }).geofenceVerificationRequired;
        }
      }
      return { punches, geofenceVerificationRequired };
    };

    const saveLedger = async (ledger: { punches: PunchLike[]; geofenceVerificationRequired: boolean }) => {
      await saveBlob(LEDGER_CATEGORY, ledger.punches);
    };

    const audit = async (actionKey: string, details: string, extra: Record<string, unknown> = {}) => {
      await base44.asServiceRole.entities.AuditLog.create({
        companyId: auth.companyId,
        action: actionKey,
        actorName: auth.name,
        actorId: auth.userId || auth.role,
        details,
        createdAt: new Date().toISOString(),
        ...extra,
      });
    };

    const loadSettingsGeo = async () => {
      const blob = await loadBlob("companyMeta");
      const meta = (Array.isArray(blob?.payload) ? blob.payload[0] : blob?.payload || {}) as { geofenceVerificationRequired?: boolean };
      if (typeof meta.geofenceVerificationRequired === "boolean") return meta.geofenceVerificationRequired;
      const legacy = await loadBlob("companySettings");
      const payload = (legacy?.payload || {}) as { geofenceVerificationRequired?: boolean };
      if (typeof payload.geofenceVerificationRequired === "boolean") return payload.geofenceVerificationRequired;
      const ledger = await loadLedger();
      return ledger.geofenceVerificationRequired !== false;
    };

    if (action === "listDay") {
      const date = String(body.date || riyadhDateKey()).slice(0, 10);
      const statusFilter = String(body.status || "all");
      const geofenceOn = await loadSettingsGeo();
      const mode = deriveVerificationMode(geofenceOn);
      const ledger = await loadLedger();

      let punches = ledger.punches.filter((p) => String(p.date || "").slice(0, 10) === date);
      if (punches.length === 0 && Array.isArray(body.punches)) {
        punches = body.punches as PunchLike[];
      }

      // Seed from employees when empty so the board is usable offline/preview.
      if (punches.length === 0) {
        const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
        punches = (emps || [])
          .filter((e: { companyId?: string }) => e.companyId === auth.companyId)
          .slice(0, 80)
          .map((e: { employeeId?: string; id?: string; name?: string; stationId?: string }) => ({
            employeeId: e.employeeId || e.id,
            employeeName: e.name,
            stationId: e.stationId || null,
            date,
            checkIn: null,
            checkOut: null,
          }));
      }

      const rows = punches.map((p) => buildRosterRow({ ...p, date }, { geofenceOn }));
      const filtered = filterRosterByStatus(rows, statusFilter);
      const stats = deriveAttStats(rows, geofenceOn);

      return Response.json({
        date,
        geofenceOn,
        verificationMode: mode.verificationMode,
        checkInIsProof: mode.checkInIsProof,
        wordingAr: mode.wordingAr,
        wordingEn: mode.wordingEn,
        graceMinutes: stats.graceMinutes,
        shiftHours: stats.shiftHours,
        stats,
        statusIds: Object.values(ATT_STATUS),
        rows: filtered,
        totalRows: rows.length,
        empty: filtered.length === 0,
        emptyReasonAr:
          filtered.length === 0
            ? statusFilter === "all"
              ? "لا صفوف حضور لهذا اليوم في نطاق الشركة."
              : "لا نتائج لشريحة الحالة المحددة — جرّب «الكل» أو حالة أخرى."
            : null,
        emptyReasonEn:
          filtered.length === 0
            ? statusFilter === "all"
              ? "No attendance rows for this day in the company scope."
              : "No rows for this status chip — try All or another status."
            : null,
      });
    }

    if (action === "resolveGeofence") {
      if (!isManager) {
        return Response.json({
          error: "FORBIDDEN",
          reason: "قرار خارج النطاق للمشرف فقط.",
          reasonEn: "Out-of-geofence decisions are manager-only.",
        }, { status: 403 });
      }
      const employeeId = String(body.employeeId || "");
      const date = String(body.date || riyadhDateKey()).slice(0, 10);
      const ledger = await loadLedger();
      const idx = ledger.punches.findIndex(
        (p) => p.employeeId === employeeId && String(p.date || "").slice(0, 10) === date,
      );
      const punch = idx >= 0
        ? ledger.punches[idx]
        : {
          employeeId,
          employeeName: body.employeeName || employeeId,
          date,
          checkIn: body.checkIn || null,
          checkOut: body.checkOut || null,
          geoVerdict: body.geoVerdict || "outside",
        };
      const gate = checkOutOfGeofenceGate({
        geoVerdict: punch.geoVerdict || body.geoVerdict || "outside",
        decision: body.decision,
        reason: body.reason,
      });
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      const updated: PunchLike = {
        ...punch,
        geoDecision: {
          decision: gate.decision,
          reason: String(body.reason || "").trim() || null,
          by: auth.name,
          at: `${localDateKey()} ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`,
        },
      };
      if (idx >= 0) ledger.punches[idx] = updated;
      else ledger.punches.push(updated);
      await saveLedger(ledger);
      await audit(
        "attendance.resolveGeofence",
        `${gate.decision} out-of-geofence for ${employeeId} on ${date}`,
        { employeeId, date, decision: gate.decision },
      );
      return Response.json({ ok: true, row: buildRosterRow(updated, { geofenceOn: true }) });
    }

    if (action === "settleAbsence") {
      if (!isManager) {
        return Response.json({
          error: "FORBIDDEN",
          reason: "تسوية الغياب للمشرف/الموارد البشرية فقط.",
          reasonEn: "Absence settlement is manager/HR only.",
        }, { status: 403 });
      }
      const employeeId = String(body.employeeId || "");
      const date = String(body.date || "").slice(0, 10);
      const ledger = await loadLedger();
      const idx = ledger.punches.findIndex(
        (p) => p.employeeId === employeeId && String(p.date || "").slice(0, 10) === date,
      );
      const punch = idx >= 0
        ? ledger.punches[idx]
        : { employeeId, employeeName: body.employeeName || employeeId, date, checkIn: null, checkOut: null };
      const gate = checkSettleAbsenceGate({
        absenceDate: date,
        today: riyadhDateKey(),
        kind: body.kind,
        documentName: body.documentName,
        alreadySettled: !!punch.settlement,
      });
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      const updated: PunchLike = {
        ...punch,
        settlement: {
          kind: String(body.kind),
          documentName: String(body.documentName || "").trim(),
          settledAt: localDateKey(),
          settledBy: auth.name,
          reason: String(body.reason || "").trim() || null,
        },
        excusedAbsence: true,
      };
      if (idx >= 0) ledger.punches[idx] = updated;
      else ledger.punches.push(updated);
      await saveLedger(ledger);
      await audit(
        "attendance.settleAbsence",
        `Settled absence ${employeeId} ${date} as ${body.kind} (original retained)`,
        { employeeId, date, kind: body.kind },
      );
      return Response.json({ ok: true, row: buildRosterRow(updated, { geofenceOn: await loadSettingsGeo() }) });
    }

    if (action === "decideOvertime") {
      if (!isManager) {
        return Response.json({
          error: "FORBIDDEN",
          reason: "اعتماد الإضافي للمشرف فقط.",
          reasonEn: "Overtime decisions are manager-only.",
        }, { status: 403 });
      }
      const employeeId = String(body.employeeId || "");
      const date = String(body.date || riyadhDateKey()).slice(0, 10);
      const ledger = await loadLedger();
      const idx = ledger.punches.findIndex(
        (p) => p.employeeId === employeeId && String(p.date || "").slice(0, 10) === date,
      );
      if (idx < 0) {
        return Response.json({
          error: "ROW_NOT_FOUND",
          reason: "لا صف حضور لهذا الموظف في اليوم.",
          reasonEn: "No attendance row for this employee on that day.",
        }, { status: 404 });
      }
      const punch = ledger.punches[idx];
      const derived = buildRosterRow(punch, { geofenceOn: await loadSettingsGeo() });
      const gate = checkOtDecisionGate({
        overtimeMinutes: derived.overtimeMinutes,
        decision: body.decision,
        alreadyDecided: punch.overtimeApproved,
      });
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      punch.overtimeApproved = gate.decision === "approve";
      ledger.punches[idx] = punch;
      await saveLedger(ledger);
      await audit(
        "attendance.decideOvertime",
        `${gate.decision} OT ${derived.overtimeMinutes}m for ${employeeId} on ${date}`,
        { employeeId, date, decision: gate.decision },
      );
      return Response.json({ ok: true, row: buildRosterRow(punch, { geofenceOn: await loadSettingsGeo() }) });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    console.error("attendance function error", e);
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
