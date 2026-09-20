/**
 * HCM register + job-objective board when the `hcm` cloud function is down.
 * Derives scores from company tasks / safety using the same gates as the server.
 */
import { getCompanyData, updateCompany } from "@/lib/store";
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
} from "@/lib/hcmDerivations";
import { countPersonalHseDuty, deriveFairHseRates } from "@/lib/perfDerivations";
import { HCM_DENY, hcmActor, hcmDenied } from "@/lib/hcmRights";

const READ_ACTIONS = new Set(["list", "assignment", "objectiveBoard"]);

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function fail(message, extra = {}) {
  const error = new Error(message);
  error.response = { data: { error: extra.error || message, reason: extra.reason || message, reasonEn: extra.reasonEn || message } };
  throw error;
}

// Who is acting comes from `hcmActor`, which carries the one rule every local
// fallback shares: a session the roster does not recognise falls to least
// privilege. This used to read `!user || …` — an unknown session was handed
// `role: "owner"`, so a caller with a stale or invented userId could rewrite the
// org structure and record hires and terminations, and the segregation-of-duties
// gates (`SELF_ACTION_FORBIDDEN`, `SELF_RATING_FORBIDDEN`) never matched an actor
// id of "owner" either.

const ROLE_JOBS = {
  director: { code: "DIR", title: "مدير", family: "admin" },
  owner: { code: "OWN", title: "المالك", family: "admin" },
  ops_manager: { code: "OPS", title: "مدير التشغيل", family: "operations" },
  pgm: { code: "PGM", title: "مدير برنامج", family: "operations" },
  station_manager: { code: "STM", title: "مدير الفرع", family: "operations" },
  safety_officer: { code: "HSE", title: "مسؤول السلامة", family: "hse" },
  employee: { code: "TEC", title: "فني", family: "operations" },
  inventory_keeper: { code: "INV", title: "أمين المستودع", family: "operations" },
  financial_officer: { code: "FIN", title: "مسؤول مالي", family: "finance" },
  hr_manager: { code: "HR", title: "موارد بشرية", family: "hr" },
};

function emptyFoundation() {
  return { orgUnits: [], jobs: [], positions: [], actions: [] };
}

function emptyPerformance() {
  return { plans: {}, cycles: [], ratings: [] };
}

function ensureLedgers(data, companyName) {
  if (!data.hcmFoundation || typeof data.hcmFoundation !== "object") data.hcmFoundation = emptyFoundation();
  if (!data.hcmPerformance || typeof data.hcmPerformance !== "object") data.hcmPerformance = emptyPerformance();
  data.hcmFoundation.orgUnits = Array.isArray(data.hcmFoundation.orgUnits) ? data.hcmFoundation.orgUnits : [];
  data.hcmFoundation.jobs = Array.isArray(data.hcmFoundation.jobs) ? data.hcmFoundation.jobs : [];
  data.hcmFoundation.positions = Array.isArray(data.hcmFoundation.positions) ? data.hcmFoundation.positions : [];
  data.hcmFoundation.actions = Array.isArray(data.hcmFoundation.actions) ? data.hcmFoundation.actions : [];
  data.hcmPerformance.plans = data.hcmPerformance.plans && typeof data.hcmPerformance.plans === "object" ? data.hcmPerformance.plans : {};
  data.hcmPerformance.cycles = Array.isArray(data.hcmPerformance.cycles) ? data.hcmPerformance.cycles : [];
  data.hcmPerformance.ratings = Array.isArray(data.hcmPerformance.ratings) ? data.hcmPerformance.ratings : [];

  const from = todayKey();
  if (!data.hcmFoundation.orgUnits.length) {
    const root = {
      id: "ou_root",
      name: companyName || data.name || "الشركة",
      type: "company",
      parentId: null,
      costCenter: null,
      establishmentNumber: null,
      stationId: null,
      effectiveFrom: from,
      seeded: true,
    };
    const stations = (data.stations || []).map((s, i) => ({
      id: `ou_${s.id || i}`,
      name: s.name || `فرع ${i + 1}`,
      type: "station",
      parentId: root.id,
      costCenter: null,
      establishmentNumber: null,
      stationId: s.id,
      effectiveFrom: from,
      seeded: true,
    }));
    data.hcmFoundation.orgUnits = [root, ...stations];
  }

  if (!data.hcmFoundation.jobs.length) {
    const used = new Set();
    (data.employees || []).forEach((e) => {
      const spec = ROLE_JOBS[e.role] || ROLE_JOBS.employee;
      if (used.has(spec.code)) return;
      used.add(spec.code);
      data.hcmFoundation.jobs.push({
        id: `job_${spec.code.toLowerCase()}`,
        code: spec.code,
        title: spec.title,
        family: spec.family,
        gradeMin: null,
        gradeMax: null,
        effectiveFrom: from,
        seeded: true,
      });
    });
  }

  if (!data.hcmFoundation.positions.length && data.hcmFoundation.jobs.length) {
    (data.employees || []).forEach((e, i) => {
      const spec = ROLE_JOBS[e.role] || ROLE_JOBS.employee;
      const job = data.hcmFoundation.jobs.find((j) => j.code === spec.code);
      const unit = data.hcmFoundation.orgUnits.find((u) => u.stationId === e.stationId)
        || data.hcmFoundation.orgUnits.find((u) => u.type === "company");
      if (!job || !unit) return;
      const position = {
        id: `pos_${e.id}`,
        ref: `POS-${String(1001 + i)}`,
        jobId: job.id,
        orgUnitId: unit.id,
        stationId: e.stationId || null,
        fte: 1,
        effectiveFrom: String(e.createdAt || from).slice(0, 10),
        closedAt: null,
        seeded: true,
      };
      data.hcmFoundation.positions.push(position);
      data.hcmFoundation.actions.push({
        id: `act_hire_${e.id}`,
        employeeId: e.id,
        type: "hire",
        positionId: position.id,
        effectiveDate: position.effectiveFrom,
        reasonCode: "new_position",
        recordedAt: from,
        voidedAt: null,
        seeded: true,
      });
    });
  }

  if (!data.hcmPerformance.cycles.length) {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    data.hcmPerformance.cycles.push({
      id: "cyc_open",
      period,
      from: `${period}-01`,
      to: `${period}-${String(last).padStart(2, "0")}`,
      status: "open",
      openedBy: "local",
      closedAt: null,
      seeded: true,
    });
  }
  return data;
}

function persist(companyId, mutate) {
  updateCompany(companyId, (data) => {
    ensureLedgers(data, data.name);
    mutate(data);
  });
}

function employeesOf(data, scope) {
  return (data.employees || []).filter((e) => !scope || e.stationId === scope);
}

function enrichFoundation(data, employees, onDay) {
  const f = data.hcmFoundation;
  const positions = derivePositionBoard({
    positions: f.positions,
    jobs: f.jobs,
    units: f.orgUnits,
    actions: f.actions,
    employees,
    onDay,
  });
  const rollup = deriveOrgUnitRollup({
    units: f.orgUnits,
    positions: f.positions,
    actions: f.actions,
    employees,
    onDay,
    jobs: f.jobs,
  });
  const assignments = employees.map((e) => deriveEmployeeAssignment({
    employee: e,
    actions: f.actions,
    positions: f.positions,
    jobs: f.jobs,
    units: f.orgUnits,
    onDay,
  }));
  return {
    orgUnits: f.orgUnits,
    jobs: f.jobs,
    positions,
    actions: f.actions,
    rollup,
    assignments,
    stats: {
      units: f.orgUnits.length,
      jobs: f.jobs.length,
      positions: positions.filter((p) => !p.closed).length,
      filled: positions.filter((p) => p.holderId).length,
      vacant: positions.filter((p) => p.vacant).length,
      people: employees.length,
      unassignedPeople: assignments.filter((a) => a.source === "derived").length,
      actions: f.actions.filter((a) => !a.voidedAt).length,
    },
    reference: { actionReasons: ACTION_REASONS, actionLabels: ACTION_LABELS },
    onDay,
  };
}

function objectiveBoard(companyId, payload) {
  const data = getCompanyData(companyId) || { employees: [], stations: [] };
  ensureLedgers(data, payload.companyName || data.name);
  const scope = payload.stationId && payload.stationId !== "all" ? String(payload.stationId) : null;
  const employees = employeesOf(data, scope);
  const tasks = (data.tasks || []).filter((t) => t && (!scope || t.stationId === scope));
  const safety = (data.safety || []).filter((rec) => rec && (!scope || rec.stationId === scope));
  const maxCover = Math.max(1, ...employees.map((e) => Number(e.coverPoints) || 0), 1);
  const f = data.hcmFoundation;
  const perf = data.hcmPerformance;
  const onDay = todayKey();

  const people = employees.map((e) => {
    const duty = countPersonalHseDuty(safety, e.id, e.name);
    const hse = deriveFairHseRates({
      hazardClosed: duty.assignedClosed,
      hazardTotal: duty.assignedTotal,
      assignedOpen: duty.assignedOpen,
      personalNotes: duty.personalNotes,
    });
    return {
      ...e,
      employeeId: e.id,
      hsePct: hse.hsePct,
      coverPct: Math.round(((Number(e.coverPoints) || 0) / maxCover) * 100),
    };
  });

  const assignmentByEmp = new Map();
  people.forEach((person) => {
    assignmentByEmp.set(person.employeeId, deriveEmployeeAssignment({
      employee: person,
      actions: f.actions,
      positions: f.positions,
      jobs: f.jobs,
      units: f.orgUnits,
      onDay,
    }));
  });

  const cycle = perf.cycles.find((c) => c.id === payload.cycleId)
    || perf.cycles.find((c) => c.status !== "closed")
    || null;
  const period = cycle ? { from: cycle.from, to: cycle.to } : null;

  const board = deriveObjectiveBoard({
    employees: people,
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

  return {
    ok: true,
    board: enriched,
    cycle,
    cycles: perf.cycles,
    progress: deriveCycleProgress({ cycle, board: enriched, ratings: perf.ratings }),
    defaultObjectives: DEFAULT_OBJECTIVES,
    plans: perf.plans,
    jobs: f.jobs,
    calibrationBand: CALIBRATION_BAND,
    formula: "objective attainment × objective weight ÷ 100 — task objectives count approved task weight only (priority × effort)",
  };
}

export function localHcmCall(payload = {}) {
  const companyId = payload.companyId;
  if (!companyId) fail("Missing companyId");
  const action = String(payload.action || "");
  const auth = hcmActor(companyId);
  const onDay = String(payload.onDay || "").slice(0, 10) || todayKey();

  // The same three gates the cloud function applies, in the same order and with the
  // same reasons: the objective board is open to any session, the register and other
  // people's assignments are for managers, and every write is for senior roles. A
  // refusal is returned rather than thrown so the screen prints its named reason
  // instead of the generic "service offline" line it shows for a failed call.
  if (READ_ACTIONS.has(action)) {
    if (action === "list" && !auth.manager) return hcmDenied(HCM_DENY.REGISTER);
    if (action === "assignment" && !auth.manager && String(payload.employeeId || "") !== String(auth.userId)) {
      return hcmDenied(HCM_DENY.ASSIGNMENT);
    }
  } else if (!auth.senior) {
    return hcmDenied(HCM_DENY.STRUCTURE);
  }

  if (action === "objectiveBoard") {
    const current = getCompanyData(companyId);
    if (!current?.hcmFoundation?.jobs?.length) {
      persist(companyId, () => {});
    }
    return objectiveBoard(companyId, payload);
  }

  if (action === "list") {
    const current = getCompanyData(companyId);
    if (!current?.hcmFoundation?.jobs?.length) persist(companyId, () => {});
    const data = getCompanyData(companyId);
    ensureLedgers(data, payload.companyName || data?.name);
    return {
      ok: true,
      ...enrichFoundation(data, data.employees || [], onDay),
      changeHistory: [],
      plans: data.hcmPerformance.plans,
      defaultObjectives: DEFAULT_OBJECTIVES,
      cycles: data.hcmPerformance.cycles,
      ratings: data.hcmPerformance.ratings,
      calibrationBand: CALIBRATION_BAND,
    };
  }

  if (action === "assignment") {
    const current = getCompanyData(companyId);
    if (!current?.hcmFoundation?.jobs?.length) persist(companyId, () => {});
    const data = getCompanyData(companyId);
    ensureLedgers(data, data?.name);
    const employee = (data.employees || []).find((e) => e.id === payload.employeeId);
    if (!employee) fail("Employee not found in company", { error: "NOT_FOUND" });
    const assignment = deriveEmployeeAssignment({
      employee,
      actions: data.hcmFoundation.actions,
      positions: data.hcmFoundation.positions,
      jobs: data.hcmFoundation.jobs,
      units: data.hcmFoundation.orgUnits,
      onDay,
    });
    const history = data.hcmFoundation.actions
      .filter((a) => a.employeeId === employee.id && !a.voidedAt)
      .sort((a, b) => String(b.effectiveDate).localeCompare(String(a.effectiveDate)));
    return {
      ok: true,
      assignment,
      history,
      positions: data.hcmFoundation.positions,
      jobs: data.hcmFoundation.jobs,
      orgUnits: data.hcmFoundation.orgUnits,
    };
  }

  if (action === "setGoalPlan") {
    let plans = {};
    persist(companyId, (data) => {
      const gate = checkGoalPlanGate({ jobId: payload.jobId, objectives: payload.objectives, jobs: data.hcmFoundation.jobs });
      if (!gate.ok) fail(gate.reason, gate);
      data.hcmPerformance.plans[gate.jobId] = {
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
      plans = data.hcmPerformance.plans;
    });
    return { ok: true, plans };
  }

  if (action === "createCycle") {
    let cycle = null;
    let cycles = [];
    persist(companyId, (data) => {
      const gate = checkCreateCycleGate({ period: payload.period, from: payload.from, to: payload.to, cycles: data.hcmPerformance.cycles });
      if (!gate.ok) fail(gate.reason, gate);
      cycle = {
        id: uid("cyc"),
        period: gate.period,
        from: gate.from,
        to: gate.to,
        status: "open",
        openedBy: auth.name,
        closedAt: null,
      };
      data.hcmPerformance.cycles = [cycle, ...data.hcmPerformance.cycles];
      cycles = data.hcmPerformance.cycles;
    });
    return { ok: true, cycle, cycles };
  }

  if (action === "advanceCycle") {
    let cycles = [];
    persist(companyId, (data) => {
      const idx = data.hcmPerformance.cycles.findIndex((c) => c.id === String(payload.cycleId || ""));
      if (idx < 0) fail("الدورة غير موجودة.", { error: "CYCLE_NOT_FOUND" });
      const gate = checkCycleTransitionGate(data.hcmPerformance.cycles[idx].status, String(payload.status || ""));
      if (!gate.ok) fail(gate.reason, gate);
      data.hcmPerformance.cycles[idx] = {
        ...data.hcmPerformance.cycles[idx],
        status: gate.status,
        closedAt: gate.status === "closed" ? new Date().toISOString() : data.hcmPerformance.cycles[idx].closedAt,
      };
      cycles = data.hcmPerformance.cycles;
    });
    return { ok: true, cycles };
  }

  if (action === "submitRating") {
    let record = null;
    persist(companyId, (data) => {
      const cycle = data.hcmPerformance.cycles.find((c) => c.id === String(payload.cycleId || "")) || null;
      const gate = checkManagerRatingGate({
        cycle,
        derivedScore: payload.derivedScore,
        rating: payload.rating,
        justification: payload.justification,
        actorId: auth.userId,
        employeeId: payload.employeeId,
      });
      if (!gate.ok) fail(gate.reason, gate);
      record = {
        id: uid("rate"),
        cycleId: cycle.id,
        employeeId: String(payload.employeeId),
        derivedScore: gate.derived,
        rating: gate.rating,
        justification: gate.justification,
        ratedBy: auth.userId,
        ratedByName: auth.name,
        ratedAt: new Date().toISOString(),
      };
      data.hcmPerformance.ratings = [
        record,
        ...data.hcmPerformance.ratings.filter((r) => !(r.cycleId === record.cycleId && r.employeeId === record.employeeId)),
      ];
    });
    return { ok: true, rating: record };
  }

  if (action === "createOrgUnit") {
    persist(companyId, (data) => {
      const gate = checkCreateOrgUnitGate({ ...payload, units: data.hcmFoundation.orgUnits });
      if (!gate.ok) fail(gate.reason, gate);
      data.hcmFoundation.orgUnits.push({
        id: uid("ou"),
        name: gate.name,
        type: gate.type,
        parentId: gate.parentId,
        costCenter: gate.costCenter,
        establishmentNumber: gate.establishmentNumber,
        stationId: payload.stationId ? String(payload.stationId) : null,
        effectiveFrom: gate.effectiveFrom,
        effectiveTo: null,
      });
    });
    return localHcmCall({ ...payload, action: "list" });
  }

  if (action === "createJob") {
    persist(companyId, (data) => {
      const gate = checkCreateJobGate({ ...payload, jobs: data.hcmFoundation.jobs });
      if (!gate.ok) fail(gate.reason, gate);
      data.hcmFoundation.jobs.push({
        id: uid("job"),
        code: gate.code,
        title: gate.title,
        family: gate.family,
        gradeMin: gate.gradeMin,
        gradeMax: gate.gradeMax,
        effectiveFrom: String(payload.effectiveFrom || todayKey()).slice(0, 10),
        effectiveTo: null,
      });
    });
    return localHcmCall({ ...payload, action: "list" });
  }

  if (action === "createPosition") {
    persist(companyId, (data) => {
      const gate = checkCreatePositionGate({
        ...payload,
        jobs: data.hcmFoundation.jobs,
        units: data.hcmFoundation.orgUnits,
        positions: data.hcmFoundation.positions,
      });
      if (!gate.ok) fail(gate.reason, gate);
      const unit = data.hcmFoundation.orgUnits.find((u) => u.id === gate.orgUnitId);
      data.hcmFoundation.positions.push({
        id: uid("pos"),
        ref: `POS-${String(1000 + data.hcmFoundation.positions.length + 1)}`,
        jobId: gate.jobId,
        orgUnitId: gate.orgUnitId,
        stationId: payload.stationId ? String(payload.stationId) : unit?.stationId || null,
        fte: gate.fte,
        reportsToPositionId: gate.reportsToPositionId,
        effectiveFrom: gate.effectiveFrom,
        effectiveTo: null,
        closedAt: null,
      });
    });
    return localHcmCall({ ...payload, action: "list" });
  }

  if (action === "recordAction") {
    persist(companyId, (data) => {
      const employeeIds = (data.employees || []).map((e) => e.id);
      const gate = checkEmploymentActionGate({
        type: payload.type,
        employeeId: payload.employeeId,
        positionId: payload.positionId,
        effectiveDate: payload.effectiveDate,
        reasonCode: payload.reasonCode,
        note: payload.note,
        actorId: auth.userId,
        history: data.hcmFoundation.actions,
        positions: data.hcmFoundation.positions,
        employeeIds,
      });
      if (!gate.ok) fail(gate.reason, gate);
      data.hcmFoundation.actions.push({
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
      });
    });
    return localHcmCall({ ...payload, action: "list" });
  }

  fail(`Unknown action: ${action}`, { error: "UNKNOWN_ACTION" });
  return { ok: false };
}
