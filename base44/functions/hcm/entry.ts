import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  ACTION_LABELS,
  ACTION_REASONS,
  CALIBRATION_BAND,
  DEFAULT_OBJECTIVES,
  checkCreateCycleGate,
  checkCreateJobGate,
  checkCreateOrgUnitGate,
  checkCreatePositionGate,
  checkCycleTransitionGate,
  checkEmploymentActionGate,
  checkGoalPlanGate,
  checkManagerRatingGate,
  deriveCycleProgress,
  deriveEmployeeAssignment,
  deriveObjectiveBoard,
  deriveOrgUnitRollup,
  derivePositionBoard,
  todayKey,
  type ActionLike,
  type JobLike,
  type ObjectiveLike,
  type OrgUnitLike,
  type PositionLike,
} from "../../shared/hcmDerivations.ts";
import { countPersonalHseDuty, deriveFairHseRates } from "../../shared/perfDerivations.ts";

const FOUNDATION_CATEGORY = "hcmFoundation";
const PERFORMANCE_CATEGORY = "hcmPerformance";
const TASKS_CATEGORY = "tasks";
const TASKS_LEGACY_CATEGORY = "operationsTasks"; // do-not-write — read fallback only
const SAFETY_CATEGORY = "safety";
const HSE_CREDITS_CATEGORY = "hseCredits";

type Foundation = {
  orgUnits: OrgUnitLike[];
  jobs: JobLike[];
  positions: PositionLike[];
  actions: ActionLike[];
};

type PerformanceConfig = {
  plans: Record<string, { jobId: string; objectives: ObjectiveLike[]; updatedBy?: string | null; updatedAt?: string | null }>;
  cycles: Array<{ id: string; period: string; from: string; to: string; status: string; openedBy?: string | null; closedAt?: string | null }>;
  ratings: Array<{
    id: string;
    cycleId: string;
    employeeId: string;
    derivedScore: number;
    rating: number;
    justification: string | null;
    ratedBy: string | null;
    ratedByName: string | null;
    ratedAt: string;
  }>;
};

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  return id || null;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyFoundation(): Foundation {
  return { orgUnits: [], jobs: [], positions: [], actions: [] };
}

function emptyPerformance(): PerformanceConfig {
  return { plans: {}, cycles: [], ratings: [] };
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

    const seniorRoles = ["owner", "director", "ops_manager", "pgm", "admin", "hr_manager"];
    const managerRoles = [...seniorRoles, "station_manager", "supervisor"];
    const isSenior = auth.owner || auth.admin || seniorRoles.includes(auth.role);
    const isManager = isSenior || managerRoles.includes(auth.role);

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

    const loadEmployees = async () => {
      const rows = await base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId });
      return (rows || []).filter((e: { companyId?: string }) => e.companyId === auth.companyId);
    };

    const loadFoundation = async (): Promise<Foundation> => {
      const blob = await loadBlob(FOUNDATION_CATEGORY);
      const raw = blob?.payload && typeof blob.payload === "object" ? blob.payload : {};
      const base = emptyFoundation();
      base.orgUnits = (Array.isArray(raw.orgUnits) ? raw.orgUnits : []).filter((u: OrgUnitLike & { companyId?: string }) => u && u.id && (!u.companyId || u.companyId === auth.companyId));
      base.jobs = (Array.isArray(raw.jobs) ? raw.jobs : []).filter((j: JobLike & { companyId?: string }) => j && j.id && (!j.companyId || j.companyId === auth.companyId));
      base.positions = (Array.isArray(raw.positions) ? raw.positions : []).filter((p: PositionLike & { companyId?: string }) => p && p.id && (!p.companyId || p.companyId === auth.companyId));
      base.actions = (Array.isArray(raw.actions) ? raw.actions : []).filter((a: ActionLike & { companyId?: string }) => a && a.id && (!a.companyId || a.companyId === auth.companyId));
      return base;
    };

    const loadPerformance = async (): Promise<PerformanceConfig> => {
      const blob = await loadBlob(PERFORMANCE_CATEGORY);
      const raw = blob?.payload && typeof blob.payload === "object" ? blob.payload : {};
      const base = emptyPerformance();
      if (raw.plans && typeof raw.plans === "object") {
        for (const [jobId, plan] of Object.entries(raw.plans as Record<string, { objectives?: ObjectiveLike[] }>)) {
          if (plan && Array.isArray(plan.objectives)) base.plans[jobId] = { jobId, ...plan } as PerformanceConfig["plans"][string];
        }
      }
      base.cycles = Array.isArray(raw.cycles) ? raw.cycles : [];
      base.ratings = Array.isArray(raw.ratings) ? raw.ratings : [];
      return base;
    };

    /** Existing tenants have stations but no units — seed a readable skeleton once. */
    const seedUnitsFromStations = async (data: Foundation) => {
      if (data.orgUnits.length) return data;
      const stations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId });
      const effectiveFrom = todayKey();
      const root: OrgUnitLike & { companyId: string; seeded: boolean } = {
        companyId: auth.companyId,
        id: "ou_root",
        name: body.companyName ? String(body.companyName) : "الشركة",
        type: "company",
        parentId: null,
        costCenter: null,
        establishmentNumber: null,
        stationId: null,
        effectiveFrom,
        seeded: true,
      };
      const stationUnits = (stations || []).map((s: { stationId?: string; id?: string; name?: string }, i: number) => ({
        companyId: auth.companyId,
        id: `ou_${s.stationId || s.id || i}`,
        name: s.name || `Station ${i + 1}`,
        type: "station",
        parentId: root.id,
        costCenter: null,
        establishmentNumber: null,
        stationId: s.stationId || s.id || null,
        effectiveFrom,
        seeded: true,
      }));
      data.orgUnits = [root, ...stationUnits];
      return data;
    };

    const enrichFoundation = (data: Foundation, employees: Array<Record<string, unknown>>, onDay: string) => {
      const positions = derivePositionBoard({
        positions: data.positions,
        jobs: data.jobs,
        units: data.orgUnits,
        actions: data.actions,
        employees: employees as never,
        onDay,
      });
      const rollup = deriveOrgUnitRollup({
        units: data.orgUnits,
        positions: data.positions,
        actions: data.actions,
        employees: employees as never,
        onDay,
      });
      const assignments = employees.map((e) =>
        deriveEmployeeAssignment({
          employee: e as never,
          actions: data.actions,
          positions: data.positions,
          jobs: data.jobs,
          units: data.orgUnits,
          onDay,
        }),
      );
      const unassigned = assignments.filter((a) => a.source === "derived").length;
      return {
        orgUnits: data.orgUnits,
        jobs: data.jobs,
        positions,
        actions: data.actions,
        rollup,
        assignments,
        stats: {
          units: data.orgUnits.length,
          jobs: data.jobs.length,
          positions: positions.filter((p) => !p.closed).length,
          filled: positions.filter((p) => p.holderId).length,
          vacant: positions.filter((p) => p.vacant).length,
          people: employees.length,
          unassignedPeople: unassigned,
          actions: data.actions.filter((a) => !a.voidedAt).length,
        },
        reference: { actionReasons: ACTION_REASONS, actionLabels: ACTION_LABELS },
        onDay,
      };
    };

    const onDay = String(body.onDay || "").slice(0, 10) || todayKey();

    /* ─────────────────────────────── reads ─────────────────────────────── */

    if (action === "list") {
      if (!isManager) {
        return Response.json({
          error: "HCM_REGISTER_DENIED",
          reason: "سجل الإجراءات الوظيفية للمسؤولين — افتح ملفك الشخصي لعرض إسنادك.",
          reasonEn: "The employment register is for managers — open your own file to see your assignment.",
        }, { status: 403 });
      }
      let data = await seedUnitsFromStations(await loadFoundation());
      const employees = await loadEmployees();
      if (!(await loadBlob(FOUNDATION_CATEGORY)) && data.orgUnits.length) {
        await saveBlob(FOUNDATION_CATEGORY, data);
      }
      const perf = await loadPerformance();

      // Data change history: the same rows the audit writer above appends, replayed for review.
      let changeHistory: Array<Record<string, unknown>> = [];
      try {
        const rows = await base44.asServiceRole.entities.AuditLog.filter({ companyId: auth.companyId });
        changeHistory = (rows || [])
          .filter((r: { companyId?: string; action?: string }) => r.companyId === auth.companyId && String(r.action || "").startsWith("hcm."))
          .sort((a: { created_date?: string }, b: { created_date?: string }) => String(b.created_date || "").localeCompare(String(a.created_date || "")))
          .slice(0, 40)
          .map((r: Record<string, unknown>) => ({
            id: r.id,
            action: r.action,
            performedBy: r.performedBy,
            details: r.details,
            reason: r.reason,
            at: r.created_date,
          }));
      } catch {
        changeHistory = [];
      }

      return Response.json({
        ok: true,
        ...enrichFoundation(data, employees, onDay),
        changeHistory,
        plans: perf.plans,
        defaultObjectives: DEFAULT_OBJECTIVES,
        cycles: perf.cycles,
        ratings: perf.ratings,
        calibrationBand: CALIBRATION_BAND,
      });
    }

    if (action === "assignment") {
      const employeeId = String(body.employeeId || auth.userId || "");
      if (!employeeId) return Response.json({ error: "Missing employeeId" }, { status: 400 });
      if (!isManager && employeeId !== auth.userId) {
        // A bare "Forbidden" reads as a fault on an Arabic screen; the refusal says
        // who this register belongs to, in the same words the local fallback uses.
        return Response.json({
          error: "HCM_ASSIGNMENT_DENIED",
          reason: "إسناد موظف آخر للمسؤولين — افتح ملفك الشخصي لعرض إسنادك أنت.",
          reasonEn: "Another person's assignment is for managers — open your own file to see yours.",
        }, { status: 403 });
      }
      const data = await loadFoundation();
      const employees = await loadEmployees();
      const employee = employees.find((e: { employeeId?: string }) => e.employeeId === employeeId);
      if (!employee) return Response.json({ error: "Employee not found in company" }, { status: 404 });
      const assignment = deriveEmployeeAssignment({
        employee: employee as never,
        actions: data.actions,
        positions: data.positions,
        jobs: data.jobs,
        units: data.orgUnits,
        onDay,
      });
      const history = data.actions
        .filter((a) => a.employeeId === employeeId && !a.voidedAt)
        .sort((a, b) => String(b.effectiveDate).localeCompare(String(a.effectiveDate)));
      return Response.json({ ok: true, assignment, history, positions: data.positions, jobs: data.jobs, orgUnits: data.orgUnits });
    }

    if (action === "objectiveBoard") {
      const scope = body.stationId && body.stationId !== "all" ? String(body.stationId) : null;
      const data = await loadFoundation();
      const perf = await loadPerformance();
      const employees = (await loadEmployees()).filter((e: { stationId?: string }) => !scope || e.stationId === scope);

      const tasks = (await loadTasks())
        .filter((t: { companyId?: string; stationId?: string }) => t && t.companyId === auth.companyId && (!scope || t.stationId === scope));

      const safetyBlob = await loadBlob(SAFETY_CATEGORY);
      const safety = (Array.isArray(safetyBlob?.payload) ? safetyBlob.payload : []).filter((r: { stationId?: string }) => r && r.stationId && (!scope || r.stationId === scope));

      const creditsBlob = await loadBlob(HSE_CREDITS_CATEGORY);
      const credits = (Array.isArray(creditsBlob?.payload) ? creditsBlob.payload : [])
        .filter((c: { companyId?: string; stationId?: string }) => c && c.companyId === auth.companyId && (!scope || !c.stationId || c.stationId === scope));
      const reportByEmp: Record<string, number> = {};
      for (const c of credits) {
        if (!c.employeeId) continue;
        reportByEmp[c.employeeId] = (reportByEmp[c.employeeId] || 0) + (Number(c.points) || 0);
      }

      const maxReport = Math.max(0, ...Object.values(reportByEmp), 0);
      const maxCover = Math.max(1, ...employees.map((e: { coverPoints?: number }) => Number(e.coverPoints) || 0), 1);

      const cycle = perf.cycles.find((c) => c.id === body.cycleId)
        || perf.cycles.find((c) => c.status !== "closed")
        || null;
      const period = cycle ? { from: cycle.from, to: cycle.to } : null;

      const people = employees.map((e: Record<string, unknown>) => {
        const eid = String(e.employeeId || e.id || "");
        const duty = countPersonalHseDuty(safety as Array<Record<string, unknown>>, eid, String(e.name || ""));
        const hse = deriveFairHseRates({
          hazardClosed: duty.assignedClosed,
          hazardTotal: duty.assignedTotal,
          reportPts: reportByEmp[eid] || 0,
          maxReportPts: maxReport,
          assignedOpen: duty.assignedOpen,
          personalNotes: duty.personalNotes,
        });
        return {
          ...e,
          employeeId: eid,
          hsePct: hse.hsePct,
          coverPct: Math.round(((Number(e.coverPoints) || 0) / maxCover) * 100),
        };
      });

      const assignmentByEmp = new Map<string, ReturnType<typeof deriveEmployeeAssignment>>();
      for (const person of people) {
        assignmentByEmp.set(
          String(person.employeeId),
          deriveEmployeeAssignment({
            employee: person as never,
            actions: data.actions,
            positions: data.positions,
            jobs: data.jobs,
            units: data.orgUnits,
            onDay,
          }),
        );
      }

      const board = deriveObjectiveBoard({
        employees: people as never,
        tasks,
        period,
        planFor: (employee) => {
          const assignment = assignmentByEmp.get(String(employee.employeeId || employee.id || ""));
          const jobId = assignment?.jobId || null;
          const plan = jobId ? perf.plans[jobId] : null;
          return {
            jobId,
            objectives: plan?.objectives?.length ? plan.objectives : DEFAULT_OBJECTIVES,
            custom: !!plan?.objectives?.length,
          };
        },
      });

      const enriched = board.map((row) => {
        const assignment = assignmentByEmp.get(row.employeeId);
        const rating = perf.ratings.find((r) => r.employeeId === row.employeeId && (!cycle || r.cycleId === cycle.id)) || null;
        return {
          ...row,
          jobTitle: assignment?.jobTitle || null,
          jobCode: assignment?.jobCode || null,
          positionRef: assignment?.positionRef || null,
          orgUnitName: assignment?.orgUnitName || null,
          assignmentSource: assignment?.source || "derived",
          rating: rating ? rating.rating : null,
          ratingJustification: rating ? rating.justification : null,
        };
      });

      // Peers set the benchmark for everyone, but only managers read the whole board.
      const visible = isManager ? enriched : enriched.filter((r) => r.employeeId === auth.userId);

      return Response.json({
        ok: true,
        board: visible,
        cycle,
        cycles: perf.cycles,
        progress: deriveCycleProgress({ cycle, board: visible, ratings: perf.ratings }),
        defaultObjectives: DEFAULT_OBJECTIVES,
        plans: perf.plans,
        jobs: data.jobs,
        calibrationBand: CALIBRATION_BAND,
        formula: "objective attainment × objective weight ÷ 100 — task objectives count approved task weight only (priority × effort)",
      });
    }

    /* ───────────────────────────── mutations ───────────────────────────── */

    if (!isSenior) {
      return Response.json({
        error: "HCM_STRUCTURE_DENIED",
        reason: "تغيير الهيكل الوظيفي أو خطط الأهداف يحتاج صلاحية إدارية.",
        reasonEn: "Changing the job structure or goal plans requires a senior role.",
      }, { status: 403 });
    }

    if (action === "createOrgUnit") {
      const data = await seedUnitsFromStations(await loadFoundation());
      const gate = checkCreateOrgUnitGate({ ...body, units: data.orgUnits });
      if (!gate.ok) return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 422 });
      const unit = {
        companyId: auth.companyId,
        id: uid("ou"),
        name: gate.name,
        type: gate.type,
        parentId: gate.parentId,
        costCenter: gate.costCenter,
        establishmentNumber: gate.establishmentNumber,
        stationId: body.stationId ? String(body.stationId) : null,
        effectiveFrom: gate.effectiveFrom,
        effectiveTo: null,
      };
      data.orgUnits = [...data.orgUnits, unit];
      await saveBlob(FOUNDATION_CATEGORY, data);
      await audit("hcm.createOrgUnit", `Org unit created: ${unit.name} (${unit.type})`, { newValue: unit.id });
      const employees = await loadEmployees();
      return Response.json({ ok: true, unit, ...enrichFoundation(data, employees, onDay) });
    }

    if (action === "createJob") {
      const data = await loadFoundation();
      const gate = checkCreateJobGate({ ...body, jobs: data.jobs });
      if (!gate.ok) return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 422 });
      const job = {
        companyId: auth.companyId,
        id: uid("job"),
        code: gate.code,
        title: gate.title,
        family: gate.family,
        gradeMin: gate.gradeMin,
        gradeMax: gate.gradeMax,
        effectiveFrom: String(body.effectiveFrom || todayKey()).slice(0, 10),
        effectiveTo: null,
      };
      data.jobs = [...data.jobs, job];
      await saveBlob(FOUNDATION_CATEGORY, data);
      await audit("hcm.createJob", `Job created: ${job.code} — ${job.title}`, { newValue: job.id });
      const employees = await loadEmployees();
      return Response.json({ ok: true, job, ...enrichFoundation(data, employees, onDay) });
    }

    if (action === "createPosition") {
      const data = await seedUnitsFromStations(await loadFoundation());
      const gate = checkCreatePositionGate({ ...body, jobs: data.jobs, units: data.orgUnits, positions: data.positions });
      if (!gate.ok) return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 422 });
      const job = data.jobs.find((j) => j.id === gate.jobId)!;
      const unit = data.orgUnits.find((u) => u.id === gate.orgUnitId)!;
      const seq = data.positions.length + 1;
      const position = {
        companyId: auth.companyId,
        id: uid("pos"),
        ref: `POS-${String(1000 + seq)}`,
        jobId: gate.jobId,
        orgUnitId: gate.orgUnitId,
        stationId: body.stationId ? String(body.stationId) : unit.stationId || null,
        fte: gate.fte,
        scheduleId: body.scheduleId ? String(body.scheduleId) : null,
        reportsToPositionId: gate.reportsToPositionId,
        effectiveFrom: gate.effectiveFrom,
        effectiveTo: null,
        closedAt: null,
      };
      data.positions = [...data.positions, position];
      await saveBlob(FOUNDATION_CATEGORY, data);
      await audit("hcm.createPosition", `Position created: ${position.ref} — ${job.title} @ ${unit.name}`, { newValue: position.id });
      const employees = await loadEmployees();
      return Response.json({ ok: true, position, ...enrichFoundation(data, employees, onDay) });
    }

    if (action === "closePosition") {
      const data = await loadFoundation();
      const idx = data.positions.findIndex((p) => p.id === String(body.positionId || ""));
      if (idx < 0) return Response.json({ error: "POSITION_NOT_FOUND", reason: "المنصب غير موجود." }, { status: 404 });
      const employees = await loadEmployees();
      const board = derivePositionBoard({
        positions: data.positions,
        jobs: data.jobs,
        units: data.orgUnits,
        actions: data.actions,
        employees: employees as never,
        onDay,
      });
      const row = board.find((p) => p.id === data.positions[idx].id);
      if (row?.holderId) {
        return Response.json({
          error: "POSITION_OCCUPIED",
          reason: "لا يُغلق منصب يشغله موظف — انقله أو أنهِ خدمته أولًا.",
          reasonEn: "A filled position cannot be closed — transfer or terminate its holder first.",
        }, { status: 422 });
      }
      data.positions[idx] = { ...data.positions[idx], closedAt: new Date().toISOString(), effectiveTo: onDay };
      await saveBlob(FOUNDATION_CATEGORY, data);
      await audit("hcm.closePosition", `Position closed: ${data.positions[idx].ref || data.positions[idx].id}`);
      return Response.json({ ok: true, ...enrichFoundation(data, employees, onDay) });
    }

    if (action === "recordAction") {
      const data = await loadFoundation();
      const employees = await loadEmployees();
      const employeeIds = employees.map((e: { employeeId?: string }) => String(e.employeeId || ""));
      if (!employeeIds.includes(String(body.employeeId || ""))) {
        return Response.json({
          error: "ACTION_EMPLOYEE_NOT_IN_COMPANY",
          reason: "الموظف ليس ضمن هذه الشركة.",
          reasonEn: "That employee does not belong to this company.",
        }, { status: 422 });
      }
      const gate = checkEmploymentActionGate({
        type: body.type,
        employeeId: body.employeeId,
        positionId: body.positionId,
        effectiveDate: body.effectiveDate,
        reasonCode: body.reasonCode,
        note: body.note,
        actorId: auth.userId,
        history: data.actions,
        positions: data.positions,
        employeeIds,
      });
      if (!gate.ok) return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 422 });
      const record: ActionLike & { companyId: string } = {
        companyId: auth.companyId,
        id: uid("act"),
        employeeId: gate.employeeId,
        type: gate.type,
        positionId: gate.positionId,
        effectiveDate: gate.effectiveDate,
        reasonCode: gate.reasonCode,
        note: gate.note,
        recordedBy: auth.userId,
        recordedByName: auth.name,
        recordedAt: new Date().toISOString(),
        voidedAt: null,
      };
      data.actions = [...data.actions, record];
      await saveBlob(FOUNDATION_CATEGORY, data);
      const label = ACTION_LABELS[gate.type]?.en || gate.type;
      await audit(
        `hcm.action.${gate.type}`,
        `${label} — employee ${gate.employeeId} effective ${gate.effectiveDate} (${gate.reasonCode})`,
        { reason: gate.reasonCode, newValue: record.id },
      );
      return Response.json({ ok: true, record, ...enrichFoundation(data, employees, onDay) });
    }

    if (action === "voidAction") {
      const reason = String(body.reason || "").trim();
      if (reason.length < 10) {
        return Response.json({
          error: "VOID_REASON_REQUIRED",
          reason: "إلغاء إجراء مسجَّل يحتاج سببًا مكتوبًا — السجل لا يُمحى، يُبطَل بأثر مُوثَّق.",
          reasonEn: "Voiding a recorded action needs a written reason — the register is never erased, only annulled with a trace.",
        }, { status: 422 });
      }
      const data = await loadFoundation();
      const idx = data.actions.findIndex((a) => a.id === String(body.actionId || ""));
      if (idx < 0) return Response.json({ error: "ACTION_NOT_FOUND", reason: "الإجراء غير موجود." }, { status: 404 });
      data.actions[idx] = { ...data.actions[idx], voidedAt: new Date().toISOString(), note: `${data.actions[idx].note || ""} | void: ${reason}`.trim() };
      await saveBlob(FOUNDATION_CATEGORY, data);
      await audit("hcm.voidAction", `Employment action voided: ${data.actions[idx].id}`, { reason });
      const employees = await loadEmployees();
      return Response.json({ ok: true, ...enrichFoundation(data, employees, onDay) });
    }

    if (action === "setGoalPlan") {
      const data = await loadFoundation();
      const perf = await loadPerformance();
      const gate = checkGoalPlanGate({ jobId: body.jobId, objectives: body.objectives, jobs: data.jobs });
      if (!gate.ok) return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 422 });
      perf.plans[gate.jobId] = {
        jobId: gate.jobId,
        objectives: gate.objectives.map((o, i) => ({
          id: String(o.id || `obj_${i + 1}`),
          title: String(o.title).trim(),
          titleEn: o.titleEn ? String(o.titleEn) : null,
          source: o.source,
          weight: Number(o.weight),
          workKinds: Array.isArray(o.workKinds) ? o.workKinds.map(String) : [],
          targetPoints: o.targetPoints == null || o.targetPoints === "" ? null : Number(o.targetPoints),
        })),
        updatedBy: auth.name,
        updatedAt: new Date().toISOString(),
      };
      await saveBlob(PERFORMANCE_CATEGORY, perf);
      const job = data.jobs.find((j) => j.id === gate.jobId);
      await audit("hcm.setGoalPlan", `Goal plan saved for ${job?.code || gate.jobId} — ${gate.objectives.length} objectives totalling 100%`, {
        newValue: gate.jobId,
      });
      return Response.json({ ok: true, plans: perf.plans });
    }

    if (action === "createCycle") {
      const perf = await loadPerformance();
      const gate = checkCreateCycleGate({ period: body.period, from: body.from, to: body.to, cycles: perf.cycles });
      if (!gate.ok) return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 422 });
      const cycle = {
        id: uid("cyc"),
        period: gate.period,
        from: gate.from,
        to: gate.to,
        status: "open",
        openedBy: auth.name,
        closedAt: null,
      };
      perf.cycles = [cycle, ...perf.cycles];
      await saveBlob(PERFORMANCE_CATEGORY, perf);
      await audit("hcm.createCycle", `Review cycle ${cycle.period} opened (${cycle.from} → ${cycle.to})`, { newValue: cycle.id });
      return Response.json({ ok: true, cycle, cycles: perf.cycles });
    }

    if (action === "advanceCycle") {
      const perf = await loadPerformance();
      const idx = perf.cycles.findIndex((c) => c.id === String(body.cycleId || ""));
      if (idx < 0) return Response.json({ error: "CYCLE_NOT_FOUND", reason: "الدورة غير موجودة." }, { status: 404 });
      const gate = checkCycleTransitionGate(perf.cycles[idx].status, String(body.status || ""));
      if (!gate.ok) return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 422 });
      perf.cycles[idx] = {
        ...perf.cycles[idx],
        status: gate.status,
        closedAt: gate.status === "closed" ? new Date().toISOString() : perf.cycles[idx].closedAt,
      };
      await saveBlob(PERFORMANCE_CATEGORY, perf);
      await audit("hcm.advanceCycle", `Review cycle ${perf.cycles[idx].period} → ${gate.status}`, {
        oldValue: String(body.status),
        newValue: gate.status,
      });
      return Response.json({ ok: true, cycles: perf.cycles });
    }

    if (action === "submitRating") {
      const perf = await loadPerformance();
      const cycle = perf.cycles.find((c) => c.id === String(body.cycleId || "")) || null;
      const gate = checkManagerRatingGate({
        cycle,
        derivedScore: body.derivedScore,
        rating: body.rating,
        justification: body.justification,
        actorId: auth.userId,
        employeeId: body.employeeId,
      });
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, band: gate.band || null }, { status: 422 });
      }
      const record = {
        id: uid("rate"),
        cycleId: cycle!.id,
        employeeId: String(body.employeeId),
        derivedScore: gate.derived,
        rating: gate.rating,
        justification: gate.justification,
        ratedBy: auth.userId,
        ratedByName: auth.name,
        ratedAt: new Date().toISOString(),
      };
      perf.ratings = [record, ...perf.ratings.filter((r) => !(r.cycleId === record.cycleId && r.employeeId === record.employeeId))];
      await saveBlob(PERFORMANCE_CATEGORY, perf);
      await audit(
        "hcm.submitRating",
        `Rating ${record.rating} (derived ${record.derivedScore}) for ${record.employeeId} in ${cycle!.period}`,
        { reason: record.justification, oldValue: String(record.derivedScore), newValue: String(record.rating) },
      );
      return Response.json({ ok: true, rating: record, ratings: perf.ratings });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("hcm error:", error);
    return Response.json({ error: String((error as Error)?.message || error) }, { status: 500 });
  }
});
