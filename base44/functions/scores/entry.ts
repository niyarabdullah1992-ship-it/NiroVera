import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  checkHazardCloseGate,
  deriveHseRates,
  reportingPointsEligible,
  reportingPointsFor,
  HIERARCHY_OF_CONTROLS,
} from "../../shared/hseDerivations.ts";
import { PERF_WEIGHTS, countPersonalHseDuty, scoreBoard } from "../../shared/perfDerivations.ts";
import { taskPoints } from "../../shared/opsDerivations.ts";

const SAFETY_CATEGORY = "safety";
const TASKS_CATEGORY = "tasks";
const TASKS_LEGACY_CATEGORY = "operationsTasks"; // do-not-write — read fallback only
const HSE_CREDITS_CATEGORY = "hseCredits";

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

    const managerRoles = ["owner", "director", "ops_manager", "station_manager", "pgm", "admin", "safety_officer"];
    const isManager = auth.owner || auth.admin || managerRoles.includes(auth.role);

    const loadBlob = async (category: string) => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category });
      return rows[0] || null;
    };
    const saveBlob = async (category: string, payload: unknown) => {
      if (category === TASKS_LEGACY_CATEGORY) return;
      const blob = await loadBlob(category);
      if (blob) await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload });
      else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId: auth.companyId, category, payload });
    };
    const loadTasks = async () => {
      const blob = await loadBlob(TASKS_CATEGORY);
      let payload = Array.isArray(blob?.payload) ? blob.payload : [];
      if (!payload.length) {
        const legacy = await loadBlob(TASKS_LEGACY_CATEGORY);
        payload = Array.isArray(legacy?.payload) ? legacy.payload : [];
        if (payload.length) await saveBlob(TASKS_CATEGORY, payload);
      }
      return payload;
    };

    const audit = async (actionKey: string, details: string, extra: Record<string, unknown> = {}) => {
      await base44.asServiceRole.entities.AuditLog.create({
        companyId: auth.companyId,
        action: actionKey,
        performedBy: auth.name,
        details,
        reason: extra.reason || null,
        oldValue: extra.oldValue || null,
        newValue: extra.newValue || null,
      });
    };

    const loadSafety = async () => {
      const blob = await loadBlob(SAFETY_CATEGORY);
      const payload = Array.isArray(blob?.payload) ? blob.payload : [];
      return payload.filter((r: { stationId?: string }) => r && r.stationId);
    };

    const loadCredits = async () => {
      const blob = await loadBlob(HSE_CREDITS_CATEGORY);
      const payload = Array.isArray(blob?.payload) ? blob.payload : [];
      return payload.filter((r: { companyId?: string }) => r && r.companyId === auth.companyId);
    };

    if (action === "hseControls") {
      return Response.json({ controls: HIERARCHY_OF_CONTROLS });
    }

    if (action === "hseSummary") {
      const scope = body.stationId ? String(body.stationId) : null;
      const stations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId });
      const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
      const scopedStations = scope ? stations.filter((s: { id?: string }) => String(s.id) === scope) : stations;
      const scopedEmps = scope
        ? emps.filter((e: { stationId?: string }) => String(e.stationId) === scope)
        : emps.filter((e: { companyId?: string }) => e.companyId === auth.companyId);
      const headcount = Math.max(scopedEmps.length, scopedStations.reduce((n: number, s: { crew?: number }) => n + (Number(s.crew) || 0), 0), scopedEmps.length || 1);

      const safety = await loadSafety();
      const scopedSafety = scope ? safety.filter((r: { stationId?: string }) => String(r.stationId) === scope) : safety;

      let lti = 0;
      let restrict = 0;
      let medical = 0;
      let nearMiss = 0;
      let openHazards = 0;
      for (const rec of scopedSafety) {
        lti += Array.isArray(rec.ltiEntries) ? rec.ltiEntries.length : Number(rec.ltiCount) || 0;
        nearMiss += (rec.incidentLog || []).filter((i: { kind?: string }) => String(i.kind || "").includes("near")).length;
        openHazards += (rec.hazards || []).length;
        for (const inc of rec.incidentLog || []) {
          const k = String(inc.cls || inc.kind || "").toLowerCase();
          if (k === "lti" || k === "lost_time") lti += 1;
          if (k === "restrict" || k === "restricted") restrict += 1;
          if (k === "medical") medical += 1;
          if (k === "near_miss" || k === "nearmiss") nearMiss += 1;
        }
      }

      const rates = deriveHseRates(headcount, { lti, restrict, medical, nearMiss, fatal: 0 });
      return Response.json({
        rates,
        openHazards,
        stations: scopedStations.length,
        formulaNote: "exposure = headcount × 2080; TRIR/DART per 200k; LTIFR per 1M",
      });
    }

    if (action === "checkHazardClose") {
      return Response.json(checkHazardCloseGate(body));
    }

    if (action === "closeHazard") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const stationId = String(body.stationId || "").trim();
      const hazardIndex = Number(body.hazardIndex);
      if (!stationId || !Number.isFinite(hazardIndex) || hazardIndex < 0) {
        return Response.json({ error: "Missing stationId or hazardIndex" }, { status: 400 });
      }
      const gate = checkHazardCloseGate({
        controlId: body.controlId,
        likelihood: body.likelihood,
        severity: body.severity,
        inherent: body.inherent,
        beforePhoto: body.beforePhoto,
        afterPhoto: body.afterPhoto,
      });
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, gate }, { status: 422 });
      }

      const safety = await loadSafety();
      const rec = safety.find((r: { stationId?: string }) => r.stationId === stationId);
      if (!rec || hazardIndex >= (rec.hazards || []).length) {
        return Response.json({ error: "HAZARD_NOT_FOUND" }, { status: 404 });
      }
      const raw = rec.hazards[hazardIndex];
      const description = typeof raw === "string" ? raw : raw?.description || raw?.title || String(raw);
      rec.hazards.splice(hazardIndex, 1);
      rec.hazardLog = rec.hazardLog || [];
      const closed = {
        id: uid("haz"),
        description,
        controlId: gate.controlId,
        inherent: gate.inherent,
        residual: gate.residual,
        beforePhoto: body.beforePhoto,
        afterPhoto: body.afterPhoto,
        closedBy: auth.name,
        closedAt: new Date().toISOString(),
        sealId: `NV-HSE-${uid("seal").slice(-8).toUpperCase()}`,
        companyId: auth.companyId,
      };
      rec.hazardLog.unshift(closed);
      rec.approvedBy = null;
      rec.approvedAt = null;
      await saveBlob(SAFETY_CATEGORY, safety);
      await audit("hazard_closed", `Hazard closed at ${stationId}: ${description}`, { newValue: closed });
      return Response.json({ ok: true, closed, gate });
    }

    if (action === "reportHazard") {
      const stationId = String(body.stationId || auth.stationId || "").trim();
      const description = String(body.description || body.title || "").trim();
      const kind = String(body.kind || "hazard");
      if (!stationId || !description) return Response.json({ error: "Missing stationId or description" }, { status: 400 });

      const safety = await loadSafety();
      let rec = safety.find((r: { stationId?: string }) => r.stationId === stationId);
      if (!rec) {
        rec = { id: uid("safe"), stationId, hazards: [], companyId: auth.companyId, createdAt: new Date().toISOString() };
        safety.push(rec);
      }
      const inherent = Number(body.inherent) || (Number(body.likelihood) || 3) * (Number(body.severity) || 3);
      rec.hazards = rec.hazards || [];
      rec.hazards.push({
        description,
        kind,
        likelihood: Number(body.likelihood) || 3,
        severity: Number(body.severity) || 3,
        inherent,
        reportedBy: auth.userId || auth.name,
        reportedAt: new Date().toISOString(),
      });
      if ((rec.level || "green") === "green") rec.level = "amber";
      rec.approvedBy = null;
      rec.approvedAt = null;
      await saveBlob(SAFETY_CATEGORY, safety);

      let awarded = 0;
      if (reportingPointsEligible(kind)) {
        awarded = reportingPointsFor(kind, inherent);
        const credits = await loadCredits();
        credits.push({
          id: uid("rep"),
          companyId: auth.companyId,
          employeeId: auth.userId,
          name: auth.name,
          stationId,
          kind,
          points: awarded,
          description,
          at: new Date().toISOString(),
        });
        await saveBlob(HSE_CREDITS_CATEGORY, credits);
        if (auth.userId && awarded > 0) {
          try {
            await base44.asServiceRole.entities.PointsLedger.create({
              companyId: auth.companyId,
              employeeId: auth.userId,
              points: awarded,
              taskTitle: `HSE report: ${description.slice(0, 80)}`,
              awardedBy: "system:hse_report",
              reason: "verified_hazard_report",
            });
          } catch {
            // PointsLedger schema may vary — credits blob remains source for perf term.
          }
        }
      }
      await audit("hazard_reported", `Hazard reported at ${stationId}: ${description}`, { newValue: { awarded } });
      return Response.json({ ok: true, awarded, awardsPoints: awarded > 0 });
    }

    if (action === "perfWeights") {
      return Response.json({ weights: PERF_WEIGHTS, note: "Attendance weight is 0 — not a score term." });
    }

    if (action === "perfBoard") {
      const scope = body.stationId ? String(body.stationId) : null;
      const emps = (await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId }))
        .filter((e: { companyId?: string; stationId?: string }) => e.companyId === auth.companyId && (!scope || e.stationId === scope));

      const tasks = (await loadTasks())
        .filter((t: { companyId?: string; stationId?: string }) => t && t.companyId === auth.companyId && (!scope || t.stationId === scope));

      const credits = await loadCredits();
      const reportByEmp: Record<string, number> = {};
      for (const c of credits) {
        if (!c.employeeId) continue;
        if (scope && c.stationId && c.stationId !== scope) continue;
        reportByEmp[c.employeeId] = (reportByEmp[c.employeeId] || 0) + (Number(c.points) || 0);
      }

      const safety = await loadSafety();
      const closureByStation: Record<string, number> = {};
      for (const rec of safety) {
        if (scope && rec.stationId !== scope) continue;
        closureByStation[rec.stationId] = (rec.hazardLog || []).length;
      }

      const rows = emps.map((e: any) => {
        const eid = e.employeeId || e.id;
        const mine = tasks.filter((t: any) =>
          t.ownerId === eid ||
          (Array.isArray(t.memberIds) && t.memberIds.includes(eid)) ||
          t.assignMode === "all" && (!t.stationId || t.stationId === e.stationId),
        );
        const approved = mine.filter((t: any) => t.approvedAt || t.status === "completed");
        const pts = approved.reduce((n: number, t: any) => n + (Number(t.pointsAwarded) || taskPoints(t.priority, t.effortWeight)), 0);
        const ontime = approved.length
          ? Math.round((approved.filter((t: any) => {
            if (!t.dueAt || !t.approvedAt) return true;
            return String(t.approvedAt).slice(0, 10) <= String(t.dueAt).slice(0, 10);
          }).length / approved.length) * 100)
          : 0;
        const duty = countPersonalHseDuty(safety, eid, e.name);
        return {
          employeeId: eid,
          name: e.name,
          pts,
          ontimePct: ontime,
          closure: closureByStation[e.stationId] || 0,
          reportPts: reportByEmp[eid] || 0,
          coverPts: Number(e.coverPoints) || 0,
          assignedOpen: duty.assignedOpen,
          assignedClosed: duty.assignedClosed,
          assignedTotal: duty.assignedTotal,
          personalNotes: duty.personalNotes,
        };
      });

      const board = scoreBoard(rows);
      return Response.json({ board, weights: PERF_WEIGHTS });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("scores error:", error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
