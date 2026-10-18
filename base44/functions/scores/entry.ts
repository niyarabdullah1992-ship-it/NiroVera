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
import {
  checkDrillGate,
  checkInspectionGate,
  checkInvestigationGate,
  checkPermitActionGate,
  checkPermitIssueGate,
  checkPermitRequestGate,
  checkRiskAssessmentGate,
  inspectionFindings,
  inspectionItems,
  inspectionScore,
  permitCode,
  riyadhLocalMs,
} from "../../shared/safetyOps.ts";
import { taskPointsFor, taskQualitySummary } from "../../shared/taskQuality.ts";

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

    // ── Safety operations (shared/safetyOps.ts twins src/lib/safetyOps.js): the gate runs here too ──
    const safetyRec = (safety: any[], stationId: string) => {
      let rec = safety.find((r: { stationId?: string }) => r.stationId === stationId);
      if (!rec) {
        rec = { id: uid("safe"), stationId, hazards: [], permits: [], incidentLog: [], companyId: auth.companyId, createdAt: new Date().toISOString() };
        safety.push(rec);
      }
      return rec;
    };
    const gateReply = (gate: any) => Response.json({ error: gate.error || "GATE", reason: gate.reason, reasonEn: gate.reasonEn, field: gate.field }, { status: 422 });

    if (action === "permitRequest") {
      const draft = { ...body.draft, stationId: String(body.draft?.stationId || auth.stationId || "") };
      const gate = checkPermitRequestGate(draft);
      if (!gate.ok) return gateReply(gate);
      const safety = await loadSafety();
      const rec = safetyRec(safety, draft.stationId);
      const now = new Date().toISOString();
      const permit = { id: permitCode(new Date()), type: draft.type, description: String(draft.description).trim().slice(0, 400), stationId: draft.stationId, holderId: String(auth.userId || ""), holderName: auth.name, team: String(draft.team || "").slice(0, 160), startAt: draft.startAt, endAt: draft.endAt, validUntil: new Date(riyadhLocalMs(draft.endAt)).toISOString(), outdoor: Boolean(draft.outdoor), controls: [], status: "requested", requestedAt: now, trail: [{ type: "request", at: now, by: auth.name }] };
      rec.permits = [permit, ...(rec.permits || [])];
      await saveBlob(SAFETY_CATEGORY, safety);
      await audit("safety_permit_requested", `Permit ${permit.id} requested at ${draft.stationId}`);
      return Response.json({ ok: true, permit });
    }

    if (action === "permitIssue") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const draft = { ...body.draft, issuerId: auth.userId };
      const gate = checkPermitIssueGate(draft);
      if (!gate.ok) return gateReply(gate);
      const safety = await loadSafety();
      const rec = safetyRec(safety, String(draft.stationId));
      const now = new Date().toISOString();
      const requested = draft.requestId ? (rec.permits || []).find((p: any) => p.id === draft.requestId && p.status === "requested") : null;
      const permit = { ...(requested || {}), id: requested?.id || permitCode(new Date()), type: draft.type, description: String(draft.description).trim().slice(0, 400), stationId: draft.stationId, holderId: String(draft.holderId), team: String(draft.team || "").slice(0, 160), startAt: draft.startAt, endAt: draft.endAt, validUntil: new Date(riyadhLocalMs(draft.endAt)).toISOString(), outdoor: Boolean(draft.outdoor), controls: [...new Set(draft.controls || [])], status: "open", issuedBy: auth.name, issuedById: String(auth.userId || ""), issuedAt: now, trail: [...(requested?.trail || []), { type: "issue", at: now, by: auth.name }] };
      rec.permits = [permit, ...(rec.permits || []).filter((p: any) => p.id !== permit.id)];
      await saveBlob(SAFETY_CATEGORY, safety);
      await audit("safety_permit_issued", `Permit ${permit.id} issued at ${draft.stationId}`);
      return Response.json({ ok: true, permit });
    }

    if (action === "permitAct") {
      const stationId = String(body.stationId || "");
      const permitAction = String(body.permitAction || "");
      const safety = await loadSafety();
      const rec = safety.find((r: { stationId?: string }) => r.stationId === stationId);
      const index = (rec?.permits || []).findIndex((p: any) => p.id === body.permitId);
      if (!rec || index < 0) return Response.json({ error: "PERMIT_NOT_FOUND" }, { status: 404 });
      // The holder's own moves (sign, finish) need no manager role; everything else does.
      if (!["acknowledge", "requestClose"].includes(permitAction) && !isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const gate = checkPermitActionGate(rec.permits[index], permitAction, { note: body.note, areaSafe: Boolean(body.areaSafe), actorId: auth.userId || "" });
      if (!gate.ok) return gateReply(gate);
      const now = new Date().toISOString();
      const text = String(body.note || "").trim().slice(0, 400);
      const next = { ...rec.permits[index], trail: [...(rec.permits[index].trail || []), { type: permitAction, at: now, by: auth.name, note: text }] };
      if (permitAction === "suspend") Object.assign(next, { status: "suspended", suspendedAt: now, suspendReason: text });
      if (permitAction === "resume") Object.assign(next, { status: "open", resumedAt: now });
      if (permitAction === "close") Object.assign(next, { status: "closed", closedAt: now, closedBy: auth.name, signedBy: auth.name, signedAt: now, closeNote: text, areaSafe: true });
      if (permitAction === "cancel") Object.assign(next, { status: "cancelled", cancelledAt: now, cancelReason: text });
      if (permitAction === "decline") Object.assign(next, { status: "declined", declinedAt: now, declinedBy: auth.name, declineReason: text });
      if (permitAction === "acknowledge") Object.assign(next, { acknowledgedAt: now, acknowledgedBy: auth.name });
      if (permitAction === "requestClose") Object.assign(next, { closeRequestedAt: now, closeNoteHolder: text });
      rec.permits[index] = next;
      await saveBlob(SAFETY_CATEGORY, safety);
      await audit(`safety_permit_${permitAction}`, `Permit ${next.id} — ${permitAction}`);
      return Response.json({ ok: true, permit: next });
    }

    if (action === "inspectionRound") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const stationId = String(body.stationId || "");
      const results = body.results || {};
      const items = inspectionItems();
      const gate = checkInspectionGate({ stationId, results }, items);
      if (!gate.ok) return gateReply(gate);
      const safety = await loadSafety();
      const rec = safetyRec(safety, stationId);
      const now = new Date().toISOString();
      const score = inspectionScore(results, items);
      const findings = inspectionFindings(results, items);
      const round = { id: uid("insp"), at: now, by: auth.name, byId: auth.userId, score: score.pct, yes: score.yes, no: score.no, na: score.na, findings: findings.map((f: any) => f.id), results };
      rec.checklistResults = { ...(rec.checklistResults || {}), ...results };
      rec.lastInspection = now;
      rec.inspections = [round, ...(rec.inspections || [])].slice(0, 36);
      rec.incidentLog = rec.incidentLog || [];
      for (const f of findings) {
        rec.incidentLog.unshift({ id: uid("inc"), description: `${f.ar}: ${f.comment}`, at: now, by: auth.name, reporterId: auth.userId, status: "open", step: 0, source: { kind: "inspection", roundId: round.id, itemId: f.id }, card: { what: `${f.ar}: ${f.comment}`, kind: 0, likelihood: 3, severity: f.group === "nfpa" || f.id.startsWith("law_125") ? 4 : 3, score: f.group === "nfpa" || f.id.startsWith("law_125") ? 12 : 9, levelKey: f.group === "nfpa" || f.id.startsWith("law_125") ? "high" : "medium" } });
      }
      rec.approvedBy = null;
      rec.approvedAt = null;
      await saveBlob(SAFETY_CATEGORY, safety);
      await audit("safety_inspection_round", `Round at ${stationId}: ${score.pct}% · ${findings.length} findings`);
      return Response.json({ ok: true, round, findings: findings.length });
    }

    if (action === "incidentInvestigation") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const stationId = String(body.stationId || "");
      const safety = await loadSafety();
      const rec = safety.find((r: { stationId?: string }) => r.stationId === stationId);
      const index = (rec?.incidentLog || []).findIndex((i: any) => i.id === body.incidentId);
      if (!rec || index < 0) return Response.json({ error: "INCIDENT_NOT_FOUND" }, { status: 404 });
      const draft = body.draft || {};
      const gate = checkInvestigationGate(rec.incidentLog[index], draft);
      if (!gate.ok) return gateReply(gate);
      const now = new Date().toISOString();
      const lostDays = draft.lostDays === "" || draft.lostDays == null ? 0 : Number(draft.lostDays);
      const prev = rec.incidentLog[index].investigation || {};
      const investigation = { rootCause: draft.rootCause, capa: String(draft.capa).trim().slice(0, 600), capaOwner: String(draft.capaOwner).trim().slice(0, 120), capaDue: draft.capaDue, lostDays, gosiReportedAt: draft.gosiReportedAt || "", capaDoneAt: draft.capaDone ? (prev.capaDoneAt || now) : "", by: auth.name, at: now };
      rec.incidentLog[index] = { ...rec.incidentLog[index], investigation };
      const day = String(rec.incidentLog[index].at || now).slice(0, 10);
      rec.ltiEntries = (rec.ltiEntries || []).filter((e: any) => e.incidentId !== body.incidentId);
      if (lostDays > 0) rec.ltiEntries.push({ date: day, incidentId: body.incidentId, lostDays, description: rec.incidentLog[index].description || "" });
      await saveBlob(SAFETY_CATEGORY, safety);
      await audit("safety_investigation", `Investigation on ${body.incidentId}: ${investigation.rootCause}`);
      return Response.json({ ok: true, item: rec.incidentLog[index] });
    }

    if (action === "riskAssessment") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const draft = body.draft || {};
      const gate = checkRiskAssessmentGate(draft);
      if (!gate.ok) return gateReply(gate);
      const safety = await loadSafety();
      const rec = safetyRec(safety, String(draft.stationId));
      const now = new Date().toISOString();
      const items = Array.isArray(rec.riskItems) ? rec.riskItems : [];
      const prev = draft.id ? items.find((r: any) => r.id === draft.id) : null;
      const row = { id: prev?.id || uid("risk"), activity: String(draft.activity).trim().slice(0, 160), hazard: String(draft.hazard).trim().slice(0, 400), likelihood: Number(draft.likelihood), severity: Number(draft.severity), controlId: draft.controlId, control: String(draft.control).trim().slice(0, 400), residualLikelihood: Number(draft.residualLikelihood), residualSeverity: Number(draft.residualSeverity), owner: String(draft.owner).trim().slice(0, 120), createdAt: prev?.createdAt || now, reviewedAt: now, reviewedBy: auth.name };
      rec.riskItems = prev ? items.map((r: any) => (r.id === row.id ? row : r)) : [row, ...items];
      await saveBlob(SAFETY_CATEGORY, safety);
      await audit("safety_risk_assessed", `Risk «${row.activity}» at ${draft.stationId}`);
      return Response.json({ ok: true, item: row });
    }

    if (action === "safetyDrill") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const draft = body.draft || {};
      const gate = checkDrillGate(draft);
      if (!gate.ok) return gateReply(gate);
      const safety = await loadSafety();
      const rec = safetyRec(safety, String(draft.stationId));
      const now = new Date().toISOString();
      const drill = { id: uid("drill"), type: draft.type, date: draft.date, participants: Number(draft.participants), evacuationMinutes: draft.type === "evacuation" ? Number(draft.evacuationMinutes) : undefined, outcome: draft.outcome, findings: String(draft.findings || "").trim().slice(0, 400), by: auth.name, byId: auth.userId, at: now };
      rec.drills = [drill, ...(rec.drills || [])].slice(0, 60);
      if (drill.outcome === "gaps") {
        rec.incidentLog = rec.incidentLog || [];
        rec.incidentLog.unshift({ id: uid("inc"), description: `ثغرات تمرين الطوارئ: ${drill.findings}`, at: now, by: auth.name, reporterId: auth.userId, status: "open", step: 0, source: { kind: "drill", drillId: drill.id }, card: { what: `ثغرات تمرين الطوارئ: ${drill.findings}`, kind: 0, likelihood: 3, severity: 4, score: 12, levelKey: "high" } });
      }
      await saveBlob(SAFETY_CATEGORY, safety);
      await audit("safety_drill", `Drill ${drill.type} at ${draft.stationId} on ${drill.date}`);
      return Response.json({ ok: true, drill });
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
        // Each person's own quality-level points (legacy approvals keep their grant).
        const pts = approved.reduce((n: number, t: any) => n + taskPointsFor(t, eid), 0);
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
          // Model Art. 19 — the same five-level scale, averaged over approved tasks that carry a level.
          quality: taskQualitySummary(approved, eid),
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

      const qualityById = new Map(rows.map((r: any) => [String(r.employeeId), r.quality]));
      const board = scoreBoard(rows).map((r: any) => ({ ...r, quality: qualityById.get(String(r.employeeId)) || null }));
      return Response.json({ board, weights: PERF_WEIGHTS });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("scores error:", error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
