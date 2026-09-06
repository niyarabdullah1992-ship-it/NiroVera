import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  applyOpsReject,
  applyOpsReassign,
  applyOpsEndDelegation,
  applyOpsExtendDue,
  applyOpsRedistributeRemaining,
  applyOpsPaceDayLog,
  deriveDailyTaskPace,
  taskPaceInput,
  derivePaceBlocker,
  canReassignOpsTask,
  canEndOpsDelegation,
  canReviewOpsTask,
  applyOpsSoftDelete,
  checkDeleteOpsTaskGate,
  isOpsTaskDeleted,
  checkAssignGate,
  checkReassignGate,
  checkEndDelegationGate,
  checkRejectReasonGate,
  clampEffortWeight,
  deriveHorizonGroups,
  deriveOpsCounts,
  nextOpsEscalation,
  normalizeWorkKind,
  planHorizonFromDue,
  runOpsEscalationSweep,
  taskAssigneeId,
  taskPoints,
  checkTaskRecurrenceGate,
  type AssignMode,
} from "../../shared/opsDerivations.ts";
import { checkFieldAttendanceGate, riyadhDateKey as gateDateKey } from "../../shared/attendanceGate.ts";
import { validateOpsRequest, validationFailed } from "../../shared/proofCycleSchemas.ts";

const TASKS_CATEGORY = "operationsTasks";
const COMPETENCY_CATEGORY = "competencyCerts";

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function riyadhDateKey(d = new Date()) {
  return gateDateKey(d);
}

async function loadBlobForCompany(base44: ReturnType<typeof createClientFromRequest>, companyId: string, category: string) {
  const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category });
  return rows[0] || null;
}

async function loadEscalationDataForCompany(base44: ReturnType<typeof createClientFromRequest>, companyId: string) {
  const [emps, stations, hrBlob, clusterBlob, treeBlob, metaBlob, branchBlob] = await Promise.all([
    base44.asServiceRole.entities.Employee.filter({ companyId }),
    base44.asServiceRole.entities.Station.filter({ companyId }),
    loadBlobForCompany(base44, companyId, "hrLevels"),
    loadBlobForCompany(base44, companyId, "hrClusters"),
    loadBlobForCompany(base44, companyId, "orgTree"),
    loadBlobForCompany(base44, companyId, "companyMeta"),
    loadBlobForCompany(base44, companyId, "branchEscalationChains"),
  ]);
  const hrPayload = hrBlob?.payload;
  const clusterPayload = clusterBlob?.payload;
  const treePayload = treeBlob?.payload;
  const metaPayload = metaBlob?.payload;
  const branchPayload = branchBlob?.payload;
  const meta = Array.isArray(metaPayload) ? (metaPayload[0] || {}) : (metaPayload || {});
  const branchRaw = branchPayload || meta.branchEscalationChains || {};
  const branchEscalationChains = Array.isArray(branchRaw)
    ? Object.fromEntries(
      branchRaw.map((row: { stationId?: string; id?: string; employeeIds?: string[]; ids?: string[] }) => [
        String(row?.stationId || row?.id || ""),
        row?.employeeIds || row?.ids || [],
      ]).filter(([sid]) => sid),
    )
    : branchRaw;
  return {
    employees: (Array.isArray(emps) ? emps : []).map((e: { employeeId?: string; id?: string; role?: string; stationId?: string | null; managedStations?: string[]; hrLevelId?: string | null; hrStationId?: string | null; hrClusterId?: string | null; isOwner?: boolean; name?: string }) => ({
      id: e.employeeId || e.id,
      employeeId: e.employeeId || e.id,
      role: e.role,
      stationId: e.stationId || null,
      managedStations: e.managedStations || [],
      hrLevelId: e.hrLevelId || null,
      hrStationId: e.hrStationId || null,
      hrClusterId: e.hrClusterId || null,
      isOwner: !!e.isOwner || e.role === "owner",
      name: e.name,
    })),
    stations: (Array.isArray(stations) ? stations : []).map((s: { stationId?: string; id?: string; managerId?: string | null; parentStationId?: string | null; parentBranchId?: string | null }) => ({
      id: s.stationId || s.id,
      stationId: s.stationId || s.id,
      managerId: s.managerId || null,
      parentStationId: s.parentStationId || s.parentBranchId || null,
      parentBranchId: s.parentBranchId || s.parentStationId || null,
    })),
    orgTree: Array.isArray(treePayload) ? treePayload : (treePayload?.nodes || []),
    ownerId: meta.ownerId || null,
    directorId: meta.directorId || null,
    hrLevels: Array.isArray(hrPayload) ? hrPayload : (hrPayload?.levels || []),
    hrClusters: Array.isArray(clusterPayload) ? clusterPayload : (clusterPayload?.clusters || []),
    branchEscalationChains,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const rawBody = await req.json();
    const action = String(rawBody?.action || "");

    /** Scheduled workflow — sweep every company (no user session). */
    if (action === "runEscalationSweep" && !rawBody?.companyId) {
      const workflowUser = await base44.auth.me().catch(() => null);
      if (!workflowUser || workflowUser.role !== "admin") {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const accounts = await base44.asServiceRole.entities.CompanyAccount.list();
      let escalated = 0;
      const byCompany: Record<string, number> = {};
      for (const account of accounts || []) {
        const cid = String(account.companyId || "").trim();
        if (!cid) continue;
        const blob = await base44.asServiceRole.entities.CompanyDataBlob.filter({
          companyId: cid,
          category: TASKS_CATEGORY,
        });
        const tasks = Array.isArray(blob[0]?.payload) ? blob[0].payload : [];
        const escData = await loadEscalationDataForCompany(base44, cid);
        const sweep = runOpsEscalationSweep(tasks, escData, new Date(), { force: false });
        if (sweep.escalated > 0 && blob[0]) {
          await base44.asServiceRole.entities.CompanyDataBlob.update(blob[0].id, { payload: sweep.tasks });
          escalated += sweep.escalated;
          byCompany[cid] = sweep.escalated;
        }
      }
      return Response.json({ ok: true, escalated, byCompany });
    }

    const parsed = validateOpsRequest(rawBody);
    if (!parsed.success) return validationFailed(parsed.error);
    const body = parsed.data;
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
      managedStations: Array.isArray(sessionAuth.managedStations) ? sessionAuth.managedStations : [],
      owner: !!sessionAuth.owner || sessionAuth.role === "owner" || sessionAuth.admin,
      admin: !!sessionAuth.admin,
    };

    const managerRoles = ["owner", "director", "ops_manager", "station_manager", "pgm", "admin"];
    const isManager = auth.owner || auth.admin || managerRoles.includes(auth.role);

    const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "").replace(/\/rest\/v\d+$/, "");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_KEY") || "";
    const sbHeaders = SUPABASE_URL && SERVICE_KEY
      ? { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }
      : null;

    const loadTodayAttendance = async (employeeId: string) => {
      if (!sbHeaders || !employeeId) return null;
      const date = riyadhDateKey();
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/attendance?company_id=eq.${encodeURIComponent(auth.companyId)}&employee_id=eq.${encodeURIComponent(employeeId)}&date=eq.${date}`,
        { headers: sbHeaders },
      );
      const rows = await res.json().catch(() => []);
      return Array.isArray(rows) && rows[0] ? rows[0] : null;
    };

    /** On-site completion requires today's check-in (present/late). Remote skips. Named reason — never silent. */
    const assertAttendanceGate = async (task: { mode?: string }) => {
      if (task.mode === "remote") return { ok: true as const, skipped: "remote" as const };
      const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId: auth.companyId });
      const plan = String(accounts[0]?.plan || "").toLowerCase();
      const attendance = auth.admin || !auth.userId ? null : await loadTodayAttendance(auth.userId);
      const gate = checkFieldAttendanceGate(attendance, auth, {
        mode: task.mode,
        requireAttendanceService: !sbHeaders,
        plan,
      });
      if (!gate.ok) {
        return {
          ok: false as const,
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          attendance: ("attendance" in gate ? gate.attendance : null) || null,
        };
      }
      return { ok: true as const, attendance: ("attendance" in gate ? gate.attendance : null) || null };
    };

    const loadBlob = async (category: string) => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category });
      return rows[0] || null;
    };
    const saveTasks = async (tasks: unknown[]) => {
      const blob = await loadBlob(TASKS_CATEGORY);
      if (blob) {
        await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload: tasks });
      } else {
        await base44.asServiceRole.entities.CompanyDataBlob.create({
          companyId: auth.companyId,
          category: TASKS_CATEGORY,
          payload: tasks,
        });
      }
    };
    const listTasksRaw = async () => {
      const blob = await loadBlob(TASKS_CATEGORY);
      const payload = Array.isArray(blob?.payload) ? blob.payload : [];
      // Blob is already tenant-scoped. Keep rows for this company; allow legacy
      // rows that were stored without companyId so managers can still delegate.
      return payload.filter((t) => t && (!t.companyId || t.companyId === auth.companyId));
    };

    const scopeFilter = (tasks: any[], scope: string | null | undefined) => {
      if (!scope || scope === "all") return tasks;
      const id = String(scope);
      return tasks.filter((t) => !t.stationId || String(t.stationId) === id);
    };

    const loadPeople = async (stationId?: string | null) => {
      const emps = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
      const compBlob = await loadBlob(COMPETENCY_CATEGORY);
      const extra = Array.isArray(compBlob?.payload) ? compBlob.payload : [];
      const byEmp: Record<string, unknown[]> = {};
      for (const row of extra) {
        if (!row || row.companyId !== auth.companyId || !row.employeeId) continue;
        (byEmp[row.employeeId] ||= []).push(row);
      }
      return emps
        .filter((e) => {
          if (!stationId) return true;
          return String(e.stationId || "") === String(stationId);
        })
        .map((e) => ({
          employeeId: e.employeeId,
          id: e.employeeId,
          name: e.name,
          stationId: e.stationId || null,
          certificates: [...(Array.isArray(e.certificates) ? e.certificates : []), ...(byEmp[e.employeeId] || [])],
        }));
    };

    const loadEscalationData = async () => loadEscalationDataForCompany(base44, auth.companyId);

    const reviewerUser = {
      id: auth.userId,
      employeeId: auth.userId,
      role: auth.role,
      stationId: auth.stationId,
      managedStations: auth.managedStations || [],
      isOwner: auth.owner,
      admin: auth.admin,
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

    const awardPoints = async (task: any, awardedBy: string) => {
      const points = taskPoints(task.priority, task.effortWeight);
      const recipients: string[] = [];
      if (task.assignMode === "one" && task.ownerId) recipients.push(task.ownerId);
      else if (task.assignMode === "some") recipients.push(...(task.memberIds || []));
      else {
        const crew = await loadPeople(task.stationId);
        recipients.push(...crew.map((p) => p.employeeId));
      }
      const unique = [...new Set(recipients.filter(Boolean))];
      for (const employeeId of unique) {
        await base44.asServiceRole.entities.PointsLedger.create({
          companyId: auth.companyId,
          employeeId,
          points,
          targetId: task.id,
          taskTitle: task.title,
          priority: task.priority,
          effortWeight: task.effortWeight,
          stationId: task.stationId || null,
          awardedBy,
          awardedAt: new Date().toISOString(),
          reason: `اعتماد إنجاز — ${task.ref}`,
          evidenceUrls: (task.proofFiles || []).map((f: any) => f.url).filter(Boolean),
        });
        const records = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId });
        if (records[0]) {
          await base44.asServiceRole.entities.Employee.update(records[0].id, {
            points: (Number(records[0].points) || 0) + points,
          });
        }
      }
      return { points, recipientIds: unique };
    };

    // ── seed competency lapse for testing (manager only) ─────────────────────
    if (action === "setCompetency") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { employeeId, code, expiryDate, status } = body;
      if (!employeeId || !code) return Response.json({ error: "employeeId and code required" }, { status: 400 });
      const people = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId });
      if (!people[0]) return Response.json({ error: "Employee not found in company" }, { status: 404 });
      const blob = await loadBlob(COMPETENCY_CATEGORY);
      const payload = Array.isArray(blob?.payload) ? [...blob.payload] : [];
      const entry = {
        companyId: auth.companyId,
        employeeId,
        code: String(code),
        expiryDate: expiryDate || "2020-01-01",
        status: status || "expired",
        name: String(code),
      };
      const idx = payload.findIndex((r) => r.employeeId === employeeId && r.code === entry.code);
      if (idx >= 0) payload[idx] = entry;
      else payload.push(entry);
      if (blob) await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload });
      else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId: auth.companyId, category: COMPETENCY_CATEGORY, payload });
      return Response.json({ ok: true, entry });
    }

    if (action === "list" || action === "counts") {
      const scope = body.scope || body.stationId || null;
      const tasks = scopeFilter(await listTasksRaw(), scope);
      const counts = deriveOpsCounts(tasks);
      const horizons = deriveHorizonGroups(tasks);
      if (action === "counts") return Response.json({ counts, horizons });
      return Response.json({ tasks, counts, horizons });
    }

    if (action === "get") {
      const tasks = await listTasksRaw();
      const task = tasks.find((t) => t.id === body.taskId);
      if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
      return Response.json({ task, pointsWorth: taskPoints(task.priority, task.effortWeight) });
    }

    if (action === "ledger") {
      const employeeId = body.employeeId || (isManager ? null : auth.userId);
      const filter: Record<string, string> = { companyId: auth.companyId };
      if (employeeId) {
        if (!isManager && employeeId !== auth.userId) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        filter.employeeId = String(employeeId);
      } else if (!isManager) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const entries = await base44.asServiceRole.entities.PointsLedger.filter(filter, "-awardedAt", 200);
      // Strict: drop rows without matching companyId (no permissive fallback).
      const scoped = (entries || []).filter((e) => e && e.companyId === auth.companyId);
      const total = scoped.reduce((sum, e) => sum + (Number(e.points) || 0), 0);
      return Response.json({ entries: scoped, total });
    }

    if (action === "create") {
      if (!isManager) return Response.json({ error: "Forbidden: only managers can create tasks" }, { status: 403 });
      const title = String(body.title || "").trim();
      const priority = ["high", "medium", "low"].includes(body.priority) ? body.priority : "medium";
      const workKind = normalizeWorkKind(body.workKind, "gn");
      const assignMode = (["one", "some", "all"].includes(body.assignMode) ? body.assignMode : "one") as AssignMode;
      const stationId = body.stationId || (Array.isArray(body.stationIds) && body.stationIds[0]) || null;
      const stationIds = Array.isArray(body.stationIds) && body.stationIds.length
        ? body.stationIds.map(String)
        : (stationId ? [String(stationId)] : []);
      const ownerId = body.ownerId || null;
      const memberIds = Array.isArray(body.memberIds) ? body.memberIds.map(String) : [];
      const effortWeight = clampEffortWeight(body.effortWeight);
      const targetCount = Math.max(1, Number(body.targetCount) || 1);
      const dueAt = body.dueAt ? String(body.dueAt).slice(0, 10) : null;
      const startAt = body.startAt ? String(body.startAt).slice(0, 10) : null;
      const recGate = checkTaskRecurrenceGate(body.recurrence, { startAt, dueAt });
      if (!recGate.ok) {
        return Response.json({ error: recGate.error, reason: recGate.reason }, { status: 400 });
      }
      const windows = recGate.windows;
      const seriesId = windows.length > 1 ? crypto.randomUUID() : null;
      const planPinned = body.planPinned === true;
      const mode = body.mode === "remote" ? "remote" : "onsite";
      const steps = String(body.steps || "").split("\n").map((s: string) => s.trim()).filter(Boolean);

      if (!title) return Response.json({ error: "Title required" }, { status: 400 });

      const ownersByStationRaw = body.ownersByStation && typeof body.ownersByStation === "object" && !Array.isArray(body.ownersByStation)
        ? body.ownersByStation as Record<string, string>
        : null;
      const ownersByStation: Record<string, string> = {};
      if (ownersByStationRaw) {
        for (const [sid, oid] of Object.entries(ownersByStationRaw)) {
          const s = String(sid || "").trim();
          const o = String(oid || "").trim();
          if (s && o) ownersByStation[s] = o;
        }
      }

      const fanOutOne = assignMode === "one"
        && stationIds.length > 1
        && Object.keys(ownersByStation).length > 0;

      if (assignMode === "one" && !fanOutOne && !ownerId) {
        return Response.json({ error: "Owner required" }, { status: 400 });
      }
      if (fanOutOne) {
        const missing = stationIds.filter((sid) => !ownersByStation[sid]);
        if (missing.length) {
          return Response.json({ error: "Owner required for each selected station" }, { status: 400 });
        }
      }
      if (assignMode === "some" && !memberIds.length) return Response.json({ error: "Select at least one member" }, { status: 400 });
      if (assignMode === "all" && !stationId) return Response.json({ error: "Station required for whole-crew assignment" }, { status: 400 });

      const allCompanyPeople = await loadPeople(null);
      const companyIds = new Set(
        allCompanyPeople.flatMap((p) => [p.employeeId, p.id].filter(Boolean).map(String)),
      );
      if (assignMode === "one" && !fanOutOne && ownerId && !companyIds.has(String(ownerId))) {
        return Response.json({ error: "Owner is not an employee of this company" }, { status: 400 });
      }
      if (fanOutOne) {
        const bad = stationIds.find((sid) => !companyIds.has(String(ownersByStation[sid])));
        if (bad) return Response.json({ error: "Owner is not an employee of this company" }, { status: 400 });
      }
      if (assignMode === "some" && memberIds.some((id) => !companyIds.has(String(id)))) {
        return Response.json({ error: "A selected member is not an employee of this company" }, { status: 400 });
      }

      const makeTask = (opts: {
        stationId: string | null;
        stationIds: string[];
        ownerId: string | null;
        seq: number;
        startAt: string | null;
        dueAt: string | null;
        occurrence?: number;
        occurrenceCount?: number;
      }) => {
        const createdAt = new Date().toISOString();
        const windowDue = opts.dueAt;
        const windowStart = opts.startAt || createdAt.slice(0, 10);
        return {
          id: crypto.randomUUID(),
          companyId: auth.companyId,
          ref: `OPS-${opts.seq}`,
          title,
          stationId: opts.stationId,
          stationIds: opts.stationIds,
          priority,
          effortWeight,
          dueAt: windowDue,
          startAt: windowStart,
          planHorizon: planPinned && body.planHorizon
            ? String(body.planHorizon)
            : planHorizonFromDue(windowDue),
          planPinned,
          workKind,
          mode,
          assignMode,
          ownerId: assignMode === "one" ? opts.ownerId : null,
          originalOwnerId: assignMode === "one" ? opts.ownerId : null,
          assignmentHistory: [],
          memberIds: assignMode === "some" ? memberIds : [],
          targetCount,
          completedCount: 0,
          status: "active",
          steps,
          attachments: Array.isArray(body.attachments)
            ? body.attachments.filter((f: any) => f && f.url).map((f: any) => ({
              url: f.url,
              name: f.name || "file",
              addedBy: auth.name,
              addedAt: createdAt,
            }))
            : [],
          comments: [],
          proofFiles: [],
          attestation: "",
          escalationLevel: 0,
          pointsAwarded: null,
          approvedAt: null,
          approvedBy: null,
          createdAt,
          createdBy: auth.userId,
          seriesId,
          paceWeekdays: Array.isArray(body.paceWeekdays) ? body.paceWeekdays : [],
          paceDates: Array.isArray(body.paceDates) ? body.paceDates : [],
          recurrence: windows.length > 1
            ? {
              ...recGate.recurrence,
              seriesId,
              occurrence: opts.occurrence || 1,
              occurrenceCount: opts.occurrenceCount || windows.length,
            }
            : null,
        };
      };

      const stampWindows = (base: { stationId: string | null; stationIds: string[]; ownerId: string | null }, seqStart: number) => {
        return windows.map((window, index) => makeTask({
          ...base,
          seq: seqStart + index,
          startAt: window.startAt,
          dueAt: window.dueAt,
          occurrence: index + 1,
          occurrenceCount: windows.length,
        }));
      };

      if (fanOutOne) {
        const existing = await listTasksRaw();
        const created: any[] = [];
        let seq = 4800 + existing.length + 1;
        for (const sid of stationIds) {
          const oid = ownersByStation[sid];
          const gate = checkAssignGate({
            workKind,
            assignMode,
            ownerId: oid,
            memberIds: [],
            stationId: sid,
            people: allCompanyPeople,
            lang: body.lang === "en" ? "en" : "ar",
          });
          if (!gate.ok) {
            return Response.json({
              error: "ASSIGN_GATE",
              reason: gate.reason,
              cert: gate.required,
              blocked: gate.blocked.map((p) => p.employeeId),
              stationId: sid,
            }, { status: 403 });
          }
          created.push(...stampWindows({ stationId: sid, stationIds: [sid], ownerId: oid }, seq));
          seq += windows.length;
        }
        await saveTasks([...created, ...existing]);
        await audit("ops_task_create", `Created ${created.length} tasks: ${title}`, {
          newValue: created.map((t) => t.ref).join(", "),
        });
        const tasks = scopeFilter(await listTasksRaw(), body.scope || null);
        return Response.json({ task: created[0], tasks: created, counts: deriveOpsCounts(tasks) });
      }

      const stationPeople = await loadPeople(stationId);
      const gatePeople = assignMode === "all" ? stationPeople : allCompanyPeople;
      const gate = checkAssignGate({
        workKind,
        assignMode,
        ownerId,
        memberIds,
        stationId,
        people: gatePeople,
        lang: body.lang === "en" ? "en" : "ar",
      });
      if (!gate.ok) {
        return Response.json({ error: "ASSIGN_GATE", reason: gate.reason, cert: gate.required, blocked: gate.blocked.map((p) => p.employeeId) }, { status: 403 });
      }

      const existing = await listTasksRaw();
      const seq = 4800 + existing.length + 1;
      const created = stampWindows({
        stationId,
        stationIds,
        ownerId: assignMode === "one" ? ownerId : null,
      }, seq);
      await saveTasks([...created, ...existing]);
      await audit("ops_task_create", `Created ${created.length} task(s): ${title}`, {
        newValue: created.map((t) => t.ref).join(", "),
      });
      const tasks = scopeFilter(await listTasksRaw(), body.scope || null);
      return Response.json({ task: created[0], tasks: created, counts: deriveOpsCounts(tasks) });
    }

    if (action === "logCompletion") {
      const taskId = body.taskId;
      const amount = Math.max(1, Number(body.amount) || 1);
      const attestation = String(body.attestation || "").trim();
      const proofFiles = Array.isArray(body.proofFiles)
        ? body.proofFiles.filter((f: any) => f && f.url).map((f: any) => ({ url: f.url, name: f.name || "file" }))
        : [];
      const tasks = await listTasksRaw();
      const idx = tasks.findIndex((t) => t.id === taskId);
      if (idx < 0) return Response.json({ error: "Task not found" }, { status: 404 });
      const task = { ...tasks[idx] };
      if (task.status === "completed") return Response.json({ error: "Already completed" }, { status: 400 });

      const gate = await assertAttendanceGate(task);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, attendance: gate.attendance || null }, { status: 403 });
      }

      if (!proofFiles.length && !attestation) {
        return Response.json({ error: "PROOF_REQUIRED", reason: "لا نقطة بلا أثر — أرفق صورة أو اكتب إفادة أولًا" }, { status: 400 });
      }
      const next = Math.min(task.targetCount, (Number(task.completedCount) || 0) + amount);
      const at = new Date().toISOString();
      let updated = applyOpsPaceDayLog({
        ...task,
        completedCount: next,
        proofFiles: [...(task.proofFiles || []), ...proofFiles],
        attestation: attestation || task.attestation,
        status: next >= task.targetCount ? "awaiting_approval" : "active",
        escalationLevel: next >= task.targetCount ? 0 : task.escalationLevel,
      }, amount, at);
      if (next < Number(updated.targetCount || task.targetCount || 1)) {
        const pace = deriveDailyTaskPace(taskPaceInput(updated));
        const blocker = derivePaceBlocker({ task: updated, pace });
        if (blocker) {
          const logged = Math.max(0, Number(blocker.logged) || 0);
          updated = {
            ...updated,
            paceBlocker: {
              ...blocker,
              logged,
              gap: Math.max(0, Number(blocker.expected) - logged),
              kind: logged <= 0 ? "missed" : "partial",
              status: "open",
              openedAt: at,
            },
          };
        }
      }
      tasks[idx] = updated;
      await saveTasks(tasks);
      await audit("ops_task_log", `Logged ${next}/${task.targetCount} on ${task.ref}`);
      return Response.json({ task: updated, counts: deriveOpsCounts(scopeFilter(tasks, body.scope || null)) });
    }

    if (action === "approve") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const tasks = await listTasksRaw();
      const idx = tasks.findIndex((t) => t.id === body.taskId);
      if (idx < 0) return Response.json({ error: "Task not found" }, { status: 404 });
      const task = { ...tasks[idx] };
      const escData = await loadEscalationData();
      if (!canReviewOpsTask(task, reviewerUser, escData)) {
        return Response.json({
          error: "NOT_CURRENT_REVIEWER",
          reason: "هذا المستوى لمن يليك في سلسلة التصعيد — لا يمكنك اعتماده بعد الرفض.",
        }, { status: 403 });
      }
      if (task.status !== "awaiting_approval" && (Number(task.completedCount) || 0) < (Number(task.targetCount) || 1)) {
        return Response.json({ error: "Not ready for approval" }, { status: 400 });
      }
      if (task.approvedAt) return Response.json({ error: "Already approved" }, { status: 400 });
      const awarded = await awardPoints(task, auth.userId || "manager");
      task.status = "completed";
      task.approvedAt = new Date().toISOString();
      task.approvedBy = auth.userId;
      task.pointsAwarded = awarded.points;
      tasks[idx] = task;
      await saveTasks(tasks);
      await audit("ops_task_approve", `Approved ${task.ref} — granted ${awarded.points} points`, { newValue: String(awarded.points) });
      return Response.json({ task, awarded, counts: deriveOpsCounts(scopeFilter(tasks, body.scope || null)) });
    }

    if (action === "reject") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const reasonGate = checkRejectReasonGate(body.reason, body.lang === "en" ? "en" : "ar");
      if (!reasonGate.ok) {
        return Response.json({ error: reasonGate.error, reason: reasonGate.reason }, { status: 400 });
      }
      const reason = String(body.reason || "").trim();
      const tasks = await listTasksRaw();
      const idx = tasks.findIndex((t) => t.id === body.taskId);
      if (idx < 0) return Response.json({ error: "Task not found" }, { status: 404 });
      const current = { ...tasks[idx] };
      const escData = await loadEscalationData();
      if (!canReviewOpsTask(current, reviewerUser, escData)) {
        return Response.json({
          error: "NOT_CURRENT_REVIEWER",
          reason: "هذا المستوى لمن يليك في سلسلة التصعيد — لا يمكنك رفضه بعد تصعيده.",
        }, { status: 403 });
      }
      const next = nextOpsEscalation(current, escData, auth.userId);
      const task = applyOpsReject(current, {
        reason,
        escalate: next.escalate,
        nextLevel: next.nextLevel,
        reviewerId: auth.userId,
        reviewerName: auth.name,
      });
      tasks[idx] = task;
      await saveTasks(tasks);
      await audit(
        next.escalate ? "ops_task_escalate" : "ops_task_reject",
        next.escalate
          ? `Rejected ${task.ref} — escalated to L${next.nextLevel}`
          : `Rejected ${task.ref} — top of chain, returned to executor`,
        { reason, newValue: next.escalate ? String(next.nextLevel) : "returned" },
      );
      return Response.json({
        task,
        escalation: next,
        counts: deriveOpsCounts(scopeFilter(tasks, body.scope || null)),
      });
    }

    if (action === "attendanceStatus") {
      const employeeId = String(body.employeeId || auth.userId || "");
      if (!employeeId) return Response.json({ error: "Missing employeeId" }, { status: 400 });
      if (!isManager && employeeId !== auth.userId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const attendance = await loadTodayAttendance(employeeId);
      const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId: auth.companyId });
      const plan = String(accounts[0]?.plan || "").toLowerCase();
      const gate = checkFieldAttendanceGate(attendance, auth, {
        requireAttendanceService: !sbHeaders,
        plan,
      });
      return Response.json({
        date: riyadhDateKey(),
        attendance,
        checkedIn: gate.ok,
        gate,
      });
    }

    if (action === "setTaskMode") {
      if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
      const mode = body.mode === "remote" ? "remote" : "onsite";
      const tasks = await listTasksRaw();
      const idx = tasks.findIndex((t) => t.id === body.taskId);
      if (idx < 0) return Response.json({ error: "Task not found" }, { status: 404 });
      const task = { ...tasks[idx], mode };
      tasks[idx] = task;
      await saveTasks(tasks);
      await audit("ops_task_mode", `Set ${task.ref} mode to ${mode}`);
      return Response.json({ task, counts: deriveOpsCounts(scopeFilter(tasks, body.scope || null)) });
    }

    if (action === "checkGate") {
      const workKind = normalizeWorkKind(body.workKind || "gn");
      const assignMode = (body.assignMode || "one") as AssignMode;
      const stationId = body.stationId || null;
      const people = await loadPeople(assignMode === "all" ? stationId : null);
      const gate = checkAssignGate({
        workKind,
        assignMode,
        ownerId: body.ownerId,
        memberIds: body.memberIds || [],
        stationId,
        people: assignMode === "one" ? await loadPeople(null) : people,
        lang: body.lang === "en" ? "en" : "ar",
      });
      return Response.json({ gate });
    }

    if (action === "addComment") {
      const text = String(body.text || "").trim();
      const files = Array.isArray(body.files)
        ? body.files.filter((f: any) => f && f.url).map((f: any) => ({
          url: String(f.url),
          name: String(f.name || "file"),
          type: String(f.type || ""),
        }))
        : [];
      if (!text && !files.length) return Response.json({ error: "EMPTY_COMMENT", reason: "اكتب رسالة أو أرفق ملفًا." }, { status: 400 });
      const tasks = await listTasksRaw();
      const idx = tasks.findIndex((t) => t.id === body.taskId);
      if (idx < 0) return Response.json({ error: "Task not found" }, { status: 404 });
      const task = { ...tasks[idx] };
      const requestedDueAt = body.requestedDueAt ? String(body.requestedDueAt).slice(0, 10) : null;
      const entry = {
        id: crypto.randomUUID(),
        authorId: auth.userId,
        authorName: auth.name,
        text,
        isIssue: body.isIssue === true || body.issue === true,
        files,
        requestedDueAt,
        at: new Date().toISOString(),
      };
      task.comments = [...(Array.isArray(task.comments) ? task.comments : []), entry];
      tasks[idx] = task;
      await saveTasks(tasks);
      await audit(
        entry.isIssue ? "ops_task_blocker" : "ops_task_comment",
        `${entry.isIssue ? "Blocker" : "Comment"} on ${task.ref} by ${auth.name}`,
        { newValue: entry.id },
      );
      return Response.json({ task, comment: entry });
    }

    if (action === "deleteComment") {
      const commentId = String(body.commentId || "").trim();
      if (!commentId) return Response.json({ error: "COMMENT_REQUIRED", reason: "معرّف الرسالة مطلوب." }, { status: 400 });
      const tasks = await listTasksRaw();
      const idx = tasks.findIndex((t) => t.id === body.taskId);
      if (idx < 0) return Response.json({ error: "Task not found" }, { status: 404 });
      const task = { ...tasks[idx] };
      const comments = Array.isArray(task.comments) ? task.comments : [];
      const found = comments.find((c: any) => String(c?.id) === commentId);
      if (!found) return Response.json({ error: "COMMENT_NOT_FOUND", reason: "الرسالة غير موجودة." }, { status: 404 });
      if (found.is_auto) {
        return Response.json({ error: "PROTECTED", reason: "لا يُحذف سجل النظام." }, { status: 403 });
      }
      task.comments = comments.filter((c: any) => String(c?.id) !== commentId);
      tasks[idx] = task;
      await saveTasks(tasks);
      await audit("ops_task_comment_deleted", `Comment removed on ${task.ref} by ${auth.name}`, { oldValue: commentId });
      return Response.json({ task, ok: true });
    }

    if (action === "delete") {
      const tasks = await listTasksRaw();
      const idx = tasks.findIndex((t) => t.id === body.taskId);
      if (idx < 0) return Response.json({ error: "Task not found" }, { status: 404 });
      const current = tasks[idx];
      const gate = checkDeleteOpsTaskGate(current, {
        id: auth.userId,
        employeeId: auth.userId,
        name: auth.name,
        role: auth.role,
      });
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: body.lang === "en" ? (gate.reasonEn || gate.reason) : gate.reason,
          reasonEn: gate.reasonEn,
        }, { status: 403 });
      }
      const next = applyOpsSoftDelete(current, { byId: auth.userId, byName: auth.name });
      tasks[idx] = next;
      await saveTasks(tasks);
      await audit("ops_task_undo_create", `Deleted ${current.ref} within the 3-minute window`, { oldValue: current.id });
      const live = tasks.filter((t) => !isOpsTaskDeleted(t));
      return Response.json({ ok: true, task: next, counts: deriveOpsCounts(live) });
    }

    if (action === "reassign") {
      if (!isManager) return Response.json({ error: "Forbidden: only managers can delegate tasks" }, { status: 403 });
      const toId = String(body.toId || body.ownerId || "").trim();
      const reason = String(body.reason || "").trim();
      const tasks = await listTasksRaw();
      const idx = tasks.findIndex((t) => t.id === body.taskId);
      if (idx < 0) return Response.json({ error: "Task not found" }, { status: 404 });
      const current = { ...tasks[idx] };
      const escData = await loadEscalationData();
      const emp = (escData.employees || []).find((e) =>
        String(e.id || "") === String(auth.userId || "")
        || String(e.employeeId || "") === String(auth.userId || "")
      );
      const reviewer = {
        ...reviewerUser,
        role: auth.role || emp?.role,
        stationId: emp?.stationId ?? reviewerUser.stationId,
        managedStations: (emp?.managedStations?.length ? emp.managedStations : reviewerUser.managedStations) || [],
      };
      if (!canReassignOpsTask(current, reviewer, escData)) {
        return Response.json({
          error: "REASSIGN_FORBIDDEN",
          reason: body.lang === "en"
            ? "Only a manager can delegate, and a completed or approved task cannot be reassigned."
            : "التوكيل للمدير فقط — وبعد الإنجاز أو الاعتماد لا يُعاد إسناد المهمة.",
        }, { status: 403 });
      }

      const stationPeople = await loadPeople(current.stationId || null);
      const companyPeople = current.stationId ? stationPeople : await loadPeople(null);
      const kind = body.kind === "transfer"
        ? "transfer"
        : (body.kind === "acting" ? "acting" : "delegate");
      const delegatedAt = String(body.delegatedAt || "").trim().slice(0, 10);
      const actingUntil = String(body.actingUntil || "").trim();
      const gate = checkReassignGate({
        task: current,
        user: reviewer,
        data: escData,
        toId,
        reason,
        kind,
        delegatedAt,
        actingUntil,
        people: companyPeople,
        lang: body.lang === "en" ? "en" : "ar",
      });
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason }, { status: 400 });
      }

      const assignGate = checkAssignGate({
        workKind: current.workKind || "gn",
        assignMode: "one",
        ownerId: toId,
        memberIds: [],
        stationId: current.stationId || null,
        people: current.stationId ? stationPeople : await loadPeople(null),
        lang: body.lang === "en" ? "en" : "ar",
      });
      if (!assignGate.ok) {
        return Response.json({ error: "ASSIGN_GATE", reason: assignGate.reason, cert: assignGate.required }, { status: 403 });
      }

      const fromId = taskAssigneeId(current);
      const fromPerson = (escData.employees || []).find((e) => String(e.id || e.employeeId) === String(fromId));
      const toPerson = (escData.employees || []).find((e) => String(e.id || e.employeeId) === String(toId));
      const task = applyOpsReassign(current, {
        fromId,
        toId,
        byId: auth.userId,
        reason,
        kind: gate.kind,
        delegatedAt: gate.delegatedAt,
        actingUntil: gate.actingUntil,
        fromName: fromPerson?.name || "",
        toName: toPerson?.name || "",
        byName: auth.name,
        lang: body.lang === "en" ? "en" : "ar",
      });
      tasks[idx] = task;
      await saveTasks(tasks);
      await audit(
        gate.kind === "transfer" ? "ops_task_transfer" : "ops_task_reassign",
        `${gate.kind === "transfer" ? "Transferred" : "Delegated"} ${task.ref} from ${fromId || "—"} to ${toId}`,
        { reason, oldValue: fromId || null, newValue: toId, delegatedAt: gate.delegatedAt || null, actingUntil: gate.actingUntil || null },
      );
      return Response.json({ task, counts: deriveOpsCounts(scopeFilter(tasks, body.scope || null)) });
    }

    if (action === "endDelegation") {
      const reason = String(body.reason || "").trim();
      const endedAt = String(body.endedAt || "").trim().slice(0, 10);
      const tasks = await listTasksRaw();
      const idx = tasks.findIndex((t) => t.id === body.taskId);
      if (idx < 0) return Response.json({ error: "Task not found" }, { status: 404 });
      const current = { ...tasks[idx] };
      const escData = await loadEscalationData();
      const emp = (escData.employees || []).find((e) =>
        String(e.id || "") === String(auth.userId || "")
        || String(e.employeeId || "") === String(auth.userId || "")
      );
      const reviewer = {
        ...reviewerUser,
        role: auth.role || emp?.role,
        stationId: emp?.stationId ?? reviewerUser.stationId,
        managedStations: (emp?.managedStations?.length ? emp.managedStations : reviewerUser.managedStations) || [],
      };
      if (!canEndOpsDelegation(current, reviewer, escData)) {
        return Response.json({
          error: "END_DELEGATION_FORBIDDEN",
          reason: body.lang === "en"
            ? "Only the delegator or a manager can end an active delegation."
            : "إنهاء الوكالة للموكِّل أو المدير فقط، وعلى وكالة نشطة.",
        }, { status: 403 });
      }
      const gate = checkEndDelegationGate({
        task: current,
        user: reviewer,
        data: escData,
        reason,
        lang: body.lang === "en" ? "en" : "ar",
      });
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason }, { status: 400 });
      }
      const restorePerson = (escData.employees || []).find((e) =>
        String(e.id || e.employeeId) === String(gate.restoreId)
      );
      const currentPerson = (escData.employees || []).find((e) =>
        String(e.id || e.employeeId) === String(taskAssigneeId(current) || "")
      );
      const task = applyOpsEndDelegation(current, {
        restoreId: gate.restoreId,
        byId: auth.userId,
        reason,
        endedAt: endedAt || undefined,
        fromName: currentPerson?.name || "",
        toName: restorePerson?.name || "",
        byName: auth.name,
        lang: body.lang === "en" ? "en" : "ar",
      });
      tasks[idx] = task;
      await saveTasks(tasks);
      await audit("ops_task_end_delegation", `Ended delegation on ${task.ref}`, {
        reason,
        oldValue: taskAssigneeId(current),
        newValue: gate.restoreId,
        endedAt: task.delegationEndedAt || null,
      });
      return Response.json({ task, counts: deriveOpsCounts(scopeFilter(tasks, body.scope || null)) });
    }

    if (action === "extendDue") {
      const nextDue = String(body.dueAt || "").trim().slice(0, 10);
      const reason = String(body.reason || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDue)) {
        return Response.json({
          error: "DUE_REQUIRED",
          reason: body.lang === "en" ? "Pick a new due date." : "اختر موعد استحقاق جديد.",
        }, { status: 400 });
      }
      if (!reason) {
        return Response.json({
          error: "REASON_REQUIRED",
          reason: body.lang === "en" ? "Write why the due date is extended." : "اكتب سبب تمديد الموعد.",
        }, { status: 400 });
      }
      const tasks = await listTasksRaw();
      const idx = tasks.findIndex((t) => t.id === body.taskId);
      if (idx < 0) return Response.json({ error: "Task not found" }, { status: 404 });
      const current = { ...tasks[idx] };
      const task = applyOpsExtendDue(current, {
        dueAt: nextDue,
        reason,
        byId: auth.userId,
        byName: auth.name,
        lang: body.lang === "en" ? "en" : "ar",
        expected: body.expected,
        logged: body.logged,
        gap: body.gap,
        blockerDay: body.blockerDay || body.day,
      });
      tasks[idx] = task;
      await saveTasks(tasks);
      await audit("ops_task_extend_due", `Extended due on ${task.ref}`, {
        reason,
        oldValue: current.dueAt || null,
        newValue: nextDue,
      });
      return Response.json({ task, counts: deriveOpsCounts(scopeFilter(tasks, body.scope || null)) });
    }

    if (action === "redistributePace") {
      const reason = String(body.reason || "").trim();
      if (!reason) {
        return Response.json({
          error: "REASON_REQUIRED",
          reason: body.lang === "en"
            ? "Write why today's quota was not met."
            : "اكتب سبب عدم إنجاز حصة اليوم.",
        }, { status: 400 });
      }
      const tasks = await listTasksRaw();
      const idx = tasks.findIndex((t) => t.id === body.taskId);
      if (idx < 0) return Response.json({ error: "Task not found" }, { status: 404 });
      const current = { ...tasks[idx] };
      const task = applyOpsRedistributeRemaining(current, {
        reason,
        byId: auth.userId,
        byName: auth.name,
        lang: body.lang === "en" ? "en" : "ar",
        expected: body.expected,
        logged: body.logged,
        gap: body.gap,
        blockerDay: body.blockerDay || body.day,
      });
      tasks[idx] = task;
      await saveTasks(tasks);
      await audit("ops_task_redistribute_pace", `Redistributed pace on ${task.ref}`, {
        reason: reason || null,
        newValue: String(task.paceSpreadTarget ?? ""),
      });
      return Response.json({ task, counts: deriveOpsCounts(scopeFilter(tasks, body.scope || null)) });
    }

    if (action === "addAttachment") {
      const url = String(body.url || "").trim();
      if (!url) return Response.json({ error: "FILE_REQUIRED", reason: "أرفق ملفًا أولًا." }, { status: 400 });
      const tasks = await listTasksRaw();
      const idx = tasks.findIndex((t) => t.id === body.taskId);
      if (idx < 0) return Response.json({ error: "Task not found" }, { status: 404 });
      const task = { ...tasks[idx] };
      const entry = {
        url,
        name: String(body.name || "file"),
        addedBy: auth.name,
        addedAt: new Date().toISOString(),
      };
      task.attachments = [...(Array.isArray(task.attachments) ? task.attachments : []), entry];
      tasks[idx] = task;
      await saveTasks(tasks);
      await audit("ops_task_attach", `Attachment on ${task.ref} by ${auth.name}: ${entry.name}`);
      return Response.json({ task, attachment: entry });
    }

    if (action === "runEscalationSweep") {
      if (!isManager && !auth.owner) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const escData = await loadEscalationData();
      const tasks = await listTasksRaw();
      const force = !!body.force;
      const sweep = runOpsEscalationSweep(tasks, escData, new Date(), { force });
      if (sweep.escalated > 0) {
        await saveTasks(sweep.tasks);
        await audit(
          "ops_escalation_sweep",
          `Auto-escalated ${sweep.escalated} task(s)`,
          { newValue: String(sweep.escalated) },
        );
      }
      return Response.json({
        escalated: sweep.escalated,
        details: sweep.details,
        counts: deriveOpsCounts(scopeFilter(sweep.tasks, body.scope || null)),
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("operations error:", error);
    return Response.json({ error: error?.message || "Server error" }, { status: 500 });
  }
});
