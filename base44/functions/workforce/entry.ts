import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import { checkPublishGates } from "../../shared/shiftDerivations.ts";
import {
  checkAlterApprovedLeaveGate,
  checkApproveLeaveGate,
  checkAttachExamSatGate,
  checkRejectLeaveGate,
  checkSubmitLeaveGate,
  computeLeaveDays,
  EXAM_NOTICE_KIND,
  EXAM_SAT_KIND,
  deriveLeaveStats,
  isOnApprovedLeave,
  leaveCoverRange,
  LEAVE_TYPES,
  addCalendarDays,
} from "../../shared/leaveDerivations.ts";
import {
  STUDY_CONSENT_TYPE,
  appendRequestAudit,
  appendRequestRefuseAudit,
  buildRequestAudit,
  buildRequestRefuseAudit,
  checkRefuseRequestReasonGate,
  checkRejectNightFitnessGate,
  checkRejectStudyConsentGate,
  requestAuditFileLog,
  requestRefuseFileLog,
} from "../../shared/otherRequestDerivations.ts";

const SCHEDULES_CATEGORY = "schedules";
const PUBLISHED_ROTAS_CATEGORY = "publishedRotas";

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

    const managerRoles = ["owner", "director", "ops_manager", "station_manager", "pgm", "admin", "hr"];
    const isManager = auth.owner || auth.admin || managerRoles.includes(auth.role);

    const loadBlob = async (category: string) => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category });
      return rows[0] || null;
    };

    const saveBlob = async (category: string, payload: unknown) => {
      const blob = await loadBlob(category);
      if (blob) await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload });
      else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId: auth.companyId, category, payload });
    };

    const loadSchedules = async () => {
      const blob = await loadBlob(SCHEDULES_CATEGORY);
      const payload = Array.isArray(blob?.payload) ? blob.payload : [];
      return payload.filter((s: { stationId?: string }) => s && s.stationId);
    };

    const loadEmployees = async () => {
      const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
      return (emps || []).filter((e: { companyId?: string }) => e.companyId === auth.companyId);
    };

    const findEmployee = async (employeeId: string) => {
      const emps = await loadEmployees();
      return emps.find((e: { employeeId?: string; id?: string }) => e.employeeId === employeeId || e.id === employeeId) || null;
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

    const monthOnLeaveIds = (emps: any[], year: number, monthIndex: number) => {
      const days = new Date(year, monthIndex + 1, 0).getDate();
      const ids = new Set<string>();
      for (const emp of emps) {
        const eid = emp.employeeId || emp.id;
        const requests = emp.leaveRequests || [];
        for (let d = 1; d <= days; d++) {
          const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          if (isOnApprovedLeave(requests, key)) {
            ids.add(eid);
            break;
          }
        }
      }
      return ids;
    };

    const buildPublishResult = async (stationId: string, year: number, monthIndex: number) => {
      const schedules = await loadSchedules();
      const schedule = schedules.find((s: { stationId?: string }) => s.stationId === stationId);
      if (!schedule) {
        return { error: "SCHEDULE_NOT_FOUND", reason: "لا يوجد جدول لهذا الفرع." };
      }
      const emps = await loadEmployees();
      const stationCrew = emps.filter((e: { stationId?: string | null }) => (e.stationId || null) === stationId || !stationId);
      const namesById: Record<string, string> = {};
      for (const e of emps) {
        namesById[e.employeeId || e.id] = e.name || e.employeeId || e.id;
      }
      const onLeaveIds = monthOnLeaveIds(emps, year, monthIndex);
      const gate = checkPublishGates({
        year,
        monthIndex,
        shiftTypes: schedule.shiftTypes || [],
        assignments: schedule.assignments || {},
        onLeaveIds,
        namesById,
        employees: emps,
      });
      return { schedule, gate, crewSize: stationCrew.length, onLeaveCount: onLeaveIds.size };
    };

    if (action === "leaveTypes") {
      return Response.json({ types: LEAVE_TYPES });
    }

    if (action === "listLeave" || action === "leaveStats") {
      const emps = await loadEmployees();
      const scope = body.stationId || null;
      const rows = emps.flatMap((e: any) =>
        (e.leaveRequests || [])
          .filter(() => !scope || e.stationId === scope)
          .map((r: any) => ({
            ...r,
            employeeId: e.employeeId || e.id,
            employeeName: e.name,
            stationId: e.stationId || null,
            companyId: auth.companyId,
            days: r.days || computeLeaveDays(r.startDate, r.endDate),
          })),
      );
      rows.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      if (action === "leaveStats") return Response.json({ stats: deriveLeaveStats(rows) });
      return Response.json({ requests: rows, stats: deriveLeaveStats(rows) });
    }

    if (action === "checkLeaveGate") {
      const employeeId = String(body.employeeId || "").trim();
      const requestId = String(body.requestId || "").trim();
      if (!employeeId || !requestId) return Response.json({ error: "Missing employeeId or requestId" }, { status: 400 });
      const emp = await findEmployee(employeeId);
      if (!emp) return Response.json({ error: "Employee not found in company" }, { status: 404 });
      const req = (emp.leaveRequests || []).find((r: any) => r.id === requestId);
      return Response.json(checkApproveLeaveGate(req, { profile: emp.profile, requests: emp.leaveRequests }));
    }

    if (action === "submitLeave") {
      const employeeId = String(body.employeeId || auth.userId || "").trim();
      if (!employeeId) return Response.json({ error: "Missing employeeId" }, { status: 400 });
      if (!isManager && auth.userId && auth.userId !== employeeId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const emp = await findEmployee(employeeId);
      if (!emp) return Response.json({ error: "Employee not found in company" }, { status: 404 });
      const type = String(body.type || "annual");
      const startDate = String(body.startDate || "").slice(0, 10);
      let endDate = String(body.endDate || "").slice(0, 10);
      const requested = Number(body.days);
      if (type === "annual" && Number.isFinite(requested) && requested >= 1 && startDate) {
        const computedEnd = addCalendarDays(startDate, Math.max(1, Math.round(requested)) - 1);
        if (computedEnd) endDate = computedEnd;
      }
      const days = Number.isFinite(requested) && requested >= 1
        ? Math.max(1, Math.round(requested))
        : computeLeaveDays(startDate, endDate);
      if (!startDate || !endDate || days < 1) {
        return Response.json({ error: "Invalid dates" }, { status: 400 });
      }
      const request = {
        id: String(body.id || "").trim() || uid("leave"),
        type,
        startDate,
        endDate,
        days,
        reason: String(body.reason || "").trim(),
        files: Array.isArray(body.files)
          ? (type === "exam"
            ? body.files.map((file: { kind?: string }) => (file && typeof file === "object" ? { ...file, kind: file.kind || EXAM_NOTICE_KIND } : file))
            : body.files)
          : [],
        status: String(body.status || "pending"),
        createdAt: body.createdAt || new Date().toISOString(),
        companyId: auth.companyId,
        eventDate: String(body.eventDate || "").slice(0, 10) || undefined,
        examRepeat: body.examRepeat ? true : undefined,
        examNoticeIssuedAt: String(body.examNoticeIssuedAt || "").slice(0, 10) || undefined,
        noOtherEmployerAck: body.noOtherEmployerAck === true,
        recordedBy: body.recordedBy ? String(body.recordedBy) : undefined,
        deferConsentAt: body.deferConsentAt ? String(body.deferConsentAt) : undefined,
      };
      const extras = {
        profile: emp.profile,
        requests: emp.leaveRequests,
        otherRequests: emp.otherRequests,
        employee: emp,
        companyId: auth.companyId,
        recordedBy: request.recordedBy,
        employerRecorded: !!request.recordedBy,
      };
      const gate = checkSubmitLeaveGate(request, extras);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, gate }, { status: 422 });
      }
      if (type === "exam") {
        request.examLeaveTrack = gate.examLeaveTrack;
        request.examPayFrom = gate.examPayFrom;
        request.examNoticeVia = gate.via || undefined;
      }
      const raiseRow = buildRequestAudit({
        actor: auth.name,
        employeeId,
        employeeName: emp.name,
        request,
        family: "leave",
        verb: "raise",
        reason: request.reason,
        at: request.createdAt,
      });
      request.auditTrail = appendRequestAudit(request, raiseRow);
      const leaveRequests = [request, ...(emp.leaveRequests || [])];
      const fileLog = [requestAuditFileLog(raiseRow, true), ...(Array.isArray(emp.fileLog) ? emp.fileLog : [])].slice(0, 40);
      await base44.asServiceRole.entities.Employee.update(emp.id, { leaveRequests, fileLog });
      await audit(raiseRow.action, raiseRow.details, { reason: raiseRow.reason, oldValue: raiseRow.oldValue, newValue: raiseRow.newValue });
      return Response.json({ request, canApproveLater: true, gate, audit: raiseRow });
    }

    if (action === "submitOther") {
      const employeeId = String(body.employeeId || auth.userId || "").trim();
      if (!employeeId) return Response.json({ error: "Missing employeeId" }, { status: 400 });
      if (!isManager && auth.userId && auth.userId !== employeeId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const incoming = body.request && typeof body.request === "object" ? body.request : null;
      if (!incoming) return Response.json({ error: "Missing request" }, { status: 400 });
      const emp = await findEmployee(employeeId);
      if (!emp) return Response.json({ error: "Employee not found in company" }, { status: 404 });
      const request = {
        ...incoming,
        id: String(incoming.id || "").trim() || uid("oreq"),
        companyId: auth.companyId,
        status: String(incoming.status || "pending"),
        createdAt: incoming.createdAt || new Date().toISOString(),
      };
      const prior = Array.isArray(emp.otherRequests) ? emp.otherRequests : [];
      const raiseRow = buildRequestAudit({
        actor: auth.name,
        employeeId,
        employeeName: emp.name,
        request,
        family: "other",
        verb: "raise",
        reason: String(request.reason || ""),
        at: request.createdAt,
      });
      request.auditTrail = appendRequestAudit(request, raiseRow);
      const otherRequests = [request, ...prior.filter((row: { id?: string }) => row?.id !== request.id)];
      const fileLog = [requestAuditFileLog(raiseRow, true), ...(Array.isArray(emp.fileLog) ? emp.fileLog : [])].slice(0, 40);
      await base44.asServiceRole.entities.Employee.update(emp.id, { otherRequests, fileLog });
      await audit(raiseRow.action, raiseRow.details, { reason: raiseRow.reason, oldValue: raiseRow.oldValue, newValue: raiseRow.newValue });
      return Response.json({ request, ok: true, audit: raiseRow });
    }

    if (action === "approveLeave" || action === "rejectLeave") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const employeeId = String(body.employeeId || "").trim();
      const requestId = String(body.requestId || "").trim();
      if (!employeeId || !requestId) return Response.json({ error: "Missing employeeId or requestId" }, { status: 400 });
      const emp = await findEmployee(employeeId);
      if (!emp) return Response.json({ error: "Employee not found in company" }, { status: 404 });
      const leaveRequests = Array.isArray(emp.leaveRequests) ? [...emp.leaveRequests] : [];
      const idx = leaveRequests.findIndex((r: any) => r.id === requestId);
      if (idx < 0) return Response.json({ error: "LEAVE_NOT_FOUND" }, { status: 404 });
      const req = { ...leaveRequests[idx] };

      const extras = { profile: emp.profile, requests: emp.leaveRequests };
      if (action === "approveLeave") {
        const gate = checkApproveLeaveGate(req, extras);
        if (!gate.ok) {
          return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, gate }, { status: 422 });
        }
        const approvalDate = new Date();
        req.status = "approved";
        req.reviewedBy = auth.name;
        req.reviewedAt = approvalDate.toISOString();
        req.approvedAt = approvalDate.toISOString();
        if (req.type === "annual") {
          const span = leaveCoverRange(req);
          if (span.start && span.end) {
            req.activeStartDate = span.start;
            req.activeEndDate = span.end;
          }
        }
        const row = buildRequestAudit({
          actor: auth.name,
          employeeId,
          employeeName: emp.name,
          request: req,
          family: "leave",
          verb: "approve",
          at: req.reviewedAt,
        });
        req.auditTrail = appendRequestAudit(req, row);
        leaveRequests[idx] = req;
        const fileLog = [requestAuditFileLog(row, true), ...(Array.isArray(emp.fileLog) ? emp.fileLog : [])].slice(0, 40);
        await base44.asServiceRole.entities.Employee.update(emp.id, { leaveRequests, fileLog });
        await audit(row.action, row.details, { reason: row.reason, oldValue: row.oldValue, newValue: row.newValue });
        return Response.json({ request: req, ok: true, audit: row });
      }

      const lock = checkAlterApprovedLeaveGate(req, { nextStatus: "rejected", actor: "manager" });
      if (!lock.ok) {
        return Response.json({ error: lock.error, reason: lock.reason, reasonEn: lock.reasonEn, gate: lock }, { status: 422 });
      }
      const refuse = checkRejectLeaveGate(req, { nextStatus: "rejected", actor: "manager", ...extras });
      if (!refuse.ok) {
        return Response.json({ error: refuse.error, reason: refuse.reason, reasonEn: refuse.reasonEn, gate: refuse }, { status: 422 });
      }
      const named = checkRefuseRequestReasonGate(body.reason || body.note);
      if (!named.ok) {
        return Response.json({ error: named.error, reason: named.reason, reasonEn: named.reasonEn, gate: named }, { status: 422 });
      }
      const reason = named.reason;
      req.status = "rejected";
      req.reviewedBy = auth.name;
      req.reviewedAt = new Date().toISOString();
      req.reviewNote = reason;
      req.rejectReason = reason;
      const row = buildRequestRefuseAudit({
        actor: auth.name,
        employeeId,
        employeeName: emp.name,
        request: req,
        family: "leave",
        reason,
        at: req.reviewedAt,
      });
      req.auditTrail = appendRequestRefuseAudit(req, row);
      leaveRequests[idx] = req;
      const fileLog = [requestRefuseFileLog(row, true), ...(Array.isArray(emp.fileLog) ? emp.fileLog : [])].slice(0, 40);
      await base44.asServiceRole.entities.Employee.update(emp.id, { leaveRequests, fileLog });
      await audit(row.action, row.details, { reason: row.reason, oldValue: row.oldValue, newValue: row.newValue });
      return Response.json({ request: req, ok: true, audit: row });
    }

    if (action === "rejectOther" || action === "approveOther") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const employeeId = String(body.employeeId || "").trim();
      const requestId = String(body.requestId || "").trim();
      if (!employeeId || !requestId) return Response.json({ error: "Missing employeeId or requestId" }, { status: 400 });
      const emp = await findEmployee(employeeId);
      if (!emp) return Response.json({ error: "Employee not found in company" }, { status: 404 });
      const otherRequests = Array.isArray(emp.otherRequests) ? [...emp.otherRequests] : [];
      const idx = otherRequests.findIndex((r: { id?: string }) => r.id === requestId);
      if (idx < 0) return Response.json({ error: "REQUEST_NOT_FOUND" }, { status: 404 });
      const pending = { ...otherRequests[idx] };
      if (pending.type === "night_consent") {
        return Response.json({
          error: "EMPLOYEE_MUST_AGREE",
          reason: "سارية وحمراء حتى يوافق الموظف على نفس الوردية الليلية. سكوت المدير يبقيها.",
          reasonEn: "It stays in force and red until the worker agrees to the same night shift. Manager silence leaves it open.",
        }, { status: 422 });
      }
      if (action === "approveOther") {
        pending.status = "approved";
        pending.reviewedBy = auth.name;
        pending.reviewedAt = new Date().toISOString();
        const row = buildRequestAudit({
          actor: auth.name,
          employeeId,
          employeeName: emp.name,
          request: pending,
          family: "other",
          verb: "approve",
          at: pending.reviewedAt,
        });
        pending.auditTrail = appendRequestAudit(pending, row);
        otherRequests[idx] = pending;
        const fileLog = [requestAuditFileLog(row, true), ...(Array.isArray(emp.fileLog) ? emp.fileLog : [])].slice(0, 40);
        await base44.asServiceRole.entities.Employee.update(emp.id, { otherRequests, fileLog });
        await audit(row.action, row.details, { reason: row.reason, oldValue: row.oldValue, newValue: row.newValue });
        return Response.json({ request: pending, ok: true, audit: row });
      }
      const rejectGate = pending.type === STUDY_CONSENT_TYPE
        ? checkRejectStudyConsentGate(pending, body.reason || body.note)
        : pending.type === "night_fitness"
          ? checkRejectNightFitnessGate(pending, body.reason || body.note)
          : checkRefuseRequestReasonGate(body.reason || body.note);
      if (!rejectGate.ok) {
        return Response.json({ error: rejectGate.error, reason: rejectGate.reason, reasonEn: rejectGate.reasonEn, gate: rejectGate }, { status: 422 });
      }
      const reason = rejectGate.reason || String(body.reason || body.note || "").trim();
      pending.status = "rejected";
      pending.reviewedBy = auth.name;
      pending.reviewedAt = new Date().toISOString();
      pending.reviewNote = reason;
      pending.rejectReason = reason;
      const row = buildRequestRefuseAudit({
        actor: auth.name,
        employeeId,
        employeeName: emp.name,
        request: pending,
        family: "other",
        reason,
        at: pending.reviewedAt,
      });
      pending.auditTrail = appendRequestRefuseAudit(pending, row);
      otherRequests[idx] = pending;
      const fileLog = [requestRefuseFileLog(row, true), ...(Array.isArray(emp.fileLog) ? emp.fileLog : [])].slice(0, 40);
      await base44.asServiceRole.entities.Employee.update(emp.id, { otherRequests, fileLog });
      await audit(row.action, row.details, { reason: row.reason, oldValue: row.oldValue, newValue: row.newValue });
      return Response.json({ request: pending, ok: true, audit: row });
    }

    if (action === "attachExamSat") {
      const employeeId = String(body.employeeId || auth.userId || "").trim();
      const requestId = String(body.requestId || "").trim();
      if (!employeeId || !requestId) return Response.json({ error: "Missing employeeId or requestId" }, { status: 400 });
      if (!isManager && auth.userId && auth.userId !== employeeId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const emp = await findEmployee(employeeId);
      if (!emp) return Response.json({ error: "Employee not found in company" }, { status: 404 });
      const leaveRequests = Array.isArray(emp.leaveRequests) ? [...emp.leaveRequests] : [];
      const idx = leaveRequests.findIndex((r: any) => r.id === requestId);
      if (idx < 0) return Response.json({ error: "LEAVE_NOT_FOUND" }, { status: 404 });
      const incoming = body.examSatFile && typeof body.examSatFile === "object" ? body.examSatFile : null;
      const stamped = incoming ? { ...incoming, kind: EXAM_SAT_KIND } : incoming;
      const gate = checkAttachExamSatGate(leaveRequests[idx], stamped);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, gate }, { status: 422 });
      }
      const req = {
        ...leaveRequests[idx],
        examSatFile: stamped,
        examSatAt: body.examSatAt || new Date().toISOString(),
        examSatBy: body.examSatBy || auth.name || auth.userId,
      };
      leaveRequests[idx] = req;
      await base44.asServiceRole.entities.Employee.update(emp.id, { leaveRequests });
      await audit("exam_sat_attached", `Exam sitting proof attached for ${emp.name}`);
      return Response.json({ request: req, ok: true, gate });
    }

    if (action === "getSchedule") {
      const stationId = String(body.stationId || "").trim();
      if (!stationId) return Response.json({ error: "Missing stationId" }, { status: 400 });
      const schedules = await loadSchedules();
      const schedule = schedules.find((s: { stationId?: string }) => s.stationId === stationId) || null;
      return Response.json({ schedule });
    }

    if (action === "checkPublish" || action === "publish") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const stationId = String(body.stationId || "").trim();
      if (!stationId) return Response.json({ error: "Missing stationId" }, { status: 400 });
      const year = Number(body.year);
      const monthIndex = body.monthIndex != null ? Number(body.monthIndex) : Number(body.month);
      if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
        return Response.json({ error: "Invalid year/monthIndex" }, { status: 400 });
      }

      const built = await buildPublishResult(stationId, year, monthIndex);
      if (built.error) return Response.json(built, { status: 404 });

      if (action === "checkPublish") {
        return Response.json({
          checks: built.gate.checks,
          blocked: built.gate.blocked,
          failed: built.gate.failed,
          openCells: built.gate.openCells,
          weeklyMaxHours: built.gate.weeklyMaxHours,
          coveragePct: built.gate.coveragePct,
          onLeaveCount: built.onLeaveCount,
        });
      }

      if (built.gate.blocked) {
        const failed = built.gate.failed;
        return Response.json({
          error: "PUBLISH_BLOCKED",
          reason: failed?.labelAr || "لا يمكن النشر",
          reasonEn: failed?.labelEn || "Cannot publish",
          failed,
          checks: built.gate.checks,
        }, { status: 422 });
      }

      const publishedBlob = await loadBlob(PUBLISHED_ROTAS_CATEGORY);
      const published = Array.isArray(publishedBlob?.payload) ? [...publishedBlob.payload] : [];
      const key = `${stationId}:${year}-${String(monthIndex + 1).padStart(2, "0")}`;
      const entry = {
        key,
        companyId: auth.companyId,
        stationId,
        year,
        monthIndex,
        publishedAt: new Date().toISOString(),
        publishedBy: auth.name,
        openCells: built.gate.openCells,
        weeklyMaxHours: built.gate.weeklyMaxHours,
        coveragePct: built.gate.coveragePct,
      };
      const idx = published.findIndex((p: { key?: string }) => p.key === key);
      if (idx >= 0) published[idx] = entry;
      else published.push(entry);
      await saveBlob(PUBLISHED_ROTAS_CATEGORY, published);
      await audit("rota_published", `Published rota ${key}`, { newValue: entry });
      return Response.json({ ok: true, published: entry, checks: built.gate.checks });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("workforce error:", error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
