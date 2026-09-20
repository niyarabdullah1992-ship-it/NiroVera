/** Compliance & Arbitration Engine — neutral referee over the existing labor catalog.
 *  labor_rules = LABOR_RULES (read-only; never a company-editable table).
 *  disputes_and_requests = leaveRequests + otherRequests already on Employee.
 *  arbitration_outcomes = append-only sealed verdicts.
 *  Does not invent a verse. A named block cannot be overridden.
 */

import { LABOR_RULES, citeRule, explainRule, ruleAt } from "./laborRules.js";
import { checkApproveLeaveGate, checkSubmitLeaveGate } from "./leaveDerivations.js";
import { checkArticle92LoanGate, checkArticle93Gate } from "./payrollDerivations.js";
import { checkDamageDeductionGate } from "./laborProtectionGates.js";
import { checkApproveOtherRequestGate } from "./otherRequestDerivations.js";
import { checkContractTermGate } from "./complianceDerivations.js";
import { checkOtDecisionGate } from "./attendanceDerivations.js";
import {
  checkNightCompensateOrReduceGate,
  checkShiftChangeApplyGate,
  checkWeekPublishGates,
  weekMinistrySurfaceChecks,
  weekStartDate,
} from "./shiftWeek.js";
import {
  ARBITRATION_DISCLAIMER_AR,
  ARBITRATION_DISCLAIMER_EN,
  attachPlatformJudgment,
  MINISTRY_ROLE,
  PLATFORM_FORUM,
} from "./platformJudgment.js";

export {
  ARBITRATION_DISCLAIMER_AR,
  ARBITRATION_DISCLAIMER_EN,
  MINISTRY_ROLE,
  PLATFORM_FORUM,
};

export const ARBITRATION_ACTIONS = {
  leave_submit: { family: "leave", entitled: "employee" },
  leave_approve: { family: "leave", entitled: "employee" },
  other_approve: { family: "request", entitled: "none" },
  deduction: { family: "payroll", ruleId: "payroll.deduction.capRatio", entitled: "employee" },
  loan: { family: "payroll", ruleId: "payroll.loan.capRatio", entitled: "employee" },
  damage: { family: "payroll", ruleId: "payroll.damage.capDays", entitled: "employee" },
  shift_change: { family: "hours", entitled: "none" },
  night_compensate: { family: "hours", ruleId: "hours.night.compensateOrReduce", entitled: "employee" },
  contract_end: { family: "contract", ruleId: "contract.fixed.cite", entitled: "none" },
  overtime: { family: "hours", ruleId: "hours.ot.premium", entitled: "employee" },
};

function familyOfRule(id) {
  return String(id || "").split(".")[0] || "";
}

function instrumentOf(row, onDate) {
  const explained = explainRule(row?.id || row?.ruleId, onDate);
  if (explained?.labelAr) return { ar: explained.labelAr, en: explained.labelEn };
  const id = String(row?.id || "");
  if (id.startsWith("hours.night.")) return { ar: "قرار 18632", en: "Decision 18632" };
  if (id.startsWith("hours.heat.")) return { ar: "قرار 3337", en: "Decision 3337" };
  if (row?.source === "labour" && row?.article) {
    return { ar: `المادة ${row.article}`, en: `Art. ${row.article}` };
  }
  if (row?.source === "ministerial") return { ar: "قرار وزاري", en: "Ministerial decision" };
  return { ar: null, en: null };
}

/** In-force catalog rows — this is labor_rules. Not writable per company. */
export function laborRulesCatalog({ family, source, onDate } = {}) {
  const seen = new Set();
  const out = [];
  for (const row of LABOR_RULES) {
    if (seen.has(row.id)) continue;
    const live = ruleAt(row.id, onDate);
    if (!live) continue;
    seen.add(row.id);
    if (family && familyOfRule(live.id) !== family) continue;
    if (source && live.source !== source) continue;
    const instrument = instrumentOf(live, onDate);
    const cite = citeRule(live.id, onDate);
    out.push({
      ...live,
      instrumentAr: instrument.ar,
      instrumentEn: instrument.en,
      textAr: cite?.textAr || live.hintAr,
      textEn: cite?.textEn || live.hintEn,
    });
  }
  return out;
}

export function flattenDisputeRequests(employees = []) {
  const out = [];
  for (const employee of employees || []) {
    for (const request of employee.leaveRequests || []) {
      out.push({
        id: request.id,
        family: "leave",
        kind: "leave_approve",
        type: request.type,
        status: request.status || "pending",
        employeeId: employee.id || employee.employeeId,
        employeeName: employee.name,
        titleAr: `إجازة ${request.type || ""}`,
        titleEn: `${request.type || ""} leave`,
        request,
        employee,
      });
    }
    for (const request of employee.otherRequests || []) {
      out.push({
        id: request.id,
        family: "other",
        kind: request.type === "night_compensate" ? "night_compensate" : "other_approve",
        type: request.type,
        status: request.status || "pending",
        employeeId: employee.id || employee.employeeId,
        employeeName: employee.name,
        titleAr: request.titleAr || request.type,
        titleEn: request.title || request.type,
        request,
        employee,
      });
    }
  }
  return out.sort((a, b) => String(b.request?.createdAt || b.request?.submittedAt || "").localeCompare(String(a.request?.createdAt || a.request?.submittedAt || "")));
}

function attachCite(gate, ruleId, onDate) {
  const id = ruleId || gate?.ruleId || gate?.cite?.id;
  const explained = id ? explainRule(id, onDate) : null;
  const cite = id ? citeRule(id, onDate) : (gate?.cite || null);
  const instrument = instrumentOf({ id, source: explained?.source, article: explained?.article || cite?.article }, onDate);
  return {
    ...gate,
    ruleId: id || null,
    article: explained?.article || cite?.article || null,
    instrumentAr: instrument.ar,
    instrumentEn: instrument.en,
    cite: cite || explained || gate?.cite || null,
  };
}

function runActionGate(kind, input = {}) {
  const onDate = input.onDate || input.request?.startDate || input.request?.date;
  const employee = input.employee;
  const request = input.request;
  const spec = ARBITRATION_ACTIONS[kind] || {};

  if (kind === "leave_submit") {
    return attachCite(checkSubmitLeaveGate(request, {
      profile: employee?.profile,
      requests: employee?.leaveRequests,
      laborCalendar: input.laborCalendar,
    }), spec.ruleId, onDate);
  }
  if (kind === "leave_approve") {
    return attachCite(checkApproveLeaveGate(request, false, {
      profile: employee?.profile,
      requests: employee?.leaveRequests,
      laborCalendar: input.laborCalendar,
    }), spec.ruleId, onDate);
  }
  if (kind === "other_approve") {
    return attachCite(checkApproveOtherRequestGate(request), spec.ruleId, onDate);
  }
  if (kind === "deduction") {
    return attachCite(checkArticle93Gate(input.line || request || {}), spec.ruleId, onDate);
  }
  if (kind === "loan") {
    return attachCite(checkArticle92LoanGate(input.line || request || {}, input.extraAdvance), spec.ruleId, onDate);
  }
  if (kind === "damage") {
    return attachCite(checkDamageDeductionGate({
      amount: input.amount ?? request?.amount,
      monthlyWage: input.monthlyWage ?? request?.monthlyWage,
      monthUsed: input.monthUsed ?? request?.monthUsed,
    }), spec.ruleId, onDate);
  }
  if (kind === "shift_change") {
    return attachCite(checkShiftChangeApplyGate({
      schedule: input.schedule,
      employee,
      dateKey: input.dateKey || request?.date,
      shiftTypeId: input.shiftTypeId || request?.shiftTypeId,
      employees: input.employees,
      laborCalendar: input.laborCalendar,
      company: input.company,
    }), spec.ruleId, onDate);
  }
  if (kind === "night_compensate") {
    return attachCite(checkNightCompensateOrReduceGate({
      shift: input.shift || request?.shift,
      onDate,
      employee,
      schedule: input.schedule,
      company: input.company,
      laborCalendar: input.laborCalendar,
    }), spec.ruleId || "hours.night.compensateOrReduce", onDate);
  }
  if (kind === "contract_end") {
    return attachCite(checkContractTermGate({
      employee,
      today: onDate,
    }), spec.ruleId, onDate);
  }
  if (kind === "overtime") {
    return attachCite(checkOtDecisionGate({
      overtimeMinutes: input.overtimeMinutes ?? request?.overtimeMinutes,
      decision: input.decision ?? request?.decision,
      workerConsent: input.workerConsent ?? request?.workerConsent,
      alreadyDecided: input.alreadyDecided,
      overtimeHoursYtd: input.overtimeHoursYtd,
      annualCapConsent: input.annualCapConsent,
      onDate,
    }), spec.ruleId, onDate);
  }
  return {
    ok: false,
    error: "UNKNOWN_ACTION",
    reason: "نوع الإجراء غير معروف للمحرّك.",
    reasonEn: "The engine does not know that action kind.",
  };
}

/** Review one request / company act. Named gate result + citation. */
export function reviewArbitrationCase(input = {}) {
  const kind = String(input.kind || "").trim();
  const spec = ARBITRATION_ACTIONS[kind];
  if (!spec) {
    return {
      ok: false,
      kind,
      status: "block",
      error: "UNKNOWN_ACTION",
      reason: "نوع الإجراء غير معروف للمحرّك.",
      reasonEn: "The engine does not know that action kind.",
      overrideAllowed: false,
      actor: "system",
    };
  }
  const gate = runActionGate(kind, input);
  const status = !gate.ok ? "block" : (gate.warning ? "warn" : (spec.entitled === "employee" ? "entitle" : "allow"));
  return attachPlatformJudgment({
    ok: !!gate.ok,
    kind,
    family: spec.family,
    status,
    error: gate.error || null,
    ruleId: gate.ruleId || spec.ruleId || null,
    article: gate.article || null,
    instrumentAr: gate.instrumentAr || null,
    instrumentEn: gate.instrumentEn || null,
    cite: gate.cite || null,
    reason: gate.reason || (gate.ok
      ? (status === "entitle" ? "مستحق وفق الكتالوج المعتمد." : "الإجراء مطابق للكتالوج.")
      : "موقوف — مخالفة للائحة المعتمدة."),
    reasonEn: gate.reasonEn || (gate.ok
      ? (status === "entitle" ? "Due under the adopted catalog." : "The act matches the catalog.")
      : "Blocked — it breaches the adopted regulation."),
    warning: gate.warning || null,
    entitledParty: spec.entitled,
    overrideAllowed: false,
    actor: "system",
    observedAt: new Date().toISOString(),
  }, { entitled: spec.entitled });
}

export function sealArbitrationVerdict(review, extras = {}) {
  const observedAt = review?.observedAt || new Date().toISOString();
  const seed = [
    extras.companyId || "",
    review?.kind || "",
    extras.requestId || extras.employeeId || "",
    review?.status || "",
    review?.ruleId || "",
    observedAt,
  ].join(":");
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  const id = extras.id || `arb_${Math.abs(hash).toString(36)}_${observedAt.slice(0, 19).replace(/[-:T]/g, "")}`;
  return {
    id,
    companyId: extras.companyId || "",
    requestId: extras.requestId || null,
    employeeId: extras.employeeId || null,
    kind: review.kind,
    family: review.family,
    status: review.status,
    error: review.error,
    ruleId: review.ruleId,
    article: review.article,
    instrumentAr: review.instrumentAr,
    instrumentEn: review.instrumentEn,
    reason: review.reason,
    reasonEn: review.reasonEn,
    entitledParty: review.entitledParty,
    protects: review.protects || null,
    judgment: review.judgment || null,
    forum: review.forum || PLATFORM_FORUM,
    ministryRole: review.ministryRole || MINISTRY_ROLE,
    overrideAllowed: false,
    immutable: true,
    actor: "system",
    decidedByRole: extras.actorRole || "system",
    decidedById: extras.actorId || "",
    observedAt,
    sealedAt: observedAt,
    disclaimerAr: ARBITRATION_DISCLAIMER_AR,
    disclaimerEn: ARBITRATION_DISCLAIMER_EN,
  };
}

export function deriveLaborComplianceScore(checks = []) {
  const list = (checks || []).filter((row) => row && row.skipped !== true);
  const total = list.length;
  const passed = list.filter((row) => row.ok).length;
  const blocked = list.filter((row) => !row.ok).length;
  const score = total ? Math.round((passed / total) * 1000) / 10 : null;
  let band = "empty";
  if (score == null) band = "empty";
  else if (score >= 90) band = "high";
  else if (score >= 70) band = "mid";
  else band = "low";
  return { score, total, passed, blocked, band };
}

/** Live named-gate battery — the compliance score, never a stored vanity number. */
export function collectCompanyArbitrationChecks({
  employees = [],
  schedules = [],
  company,
  payrollLines = [],
  weekStart,
  laborCalendar,
} = {}) {
  const checks = [];
  const start = weekStartDate(weekStart || new Date());
  for (const employee of employees || []) {
    const contract = checkContractTermGate({ employee });
    checks.push({
      id: `contract:${employee.id || employee.employeeId}`,
      ok: !!contract.ok,
      kind: "contract_end",
      employeeId: employee.id || employee.employeeId,
      name: employee.name,
      error: contract.error || null,
      reason: contract.reason || contract.warning || null,
      reasonEn: contract.reasonEn || null,
      ruleId: "contract.fixed.cite",
    });
  }
  for (const line of payrollLines || []) {
    const gate = checkArticle93Gate(line);
    checks.push({
      id: `deduction:${line.employeeId || line.id || checks.length}`,
      ok: !!gate.ok,
      kind: "deduction",
      employeeId: line.employeeId,
      name: line.employeeName,
      error: gate.error || null,
      reason: gate.reason,
      reasonEn: gate.reasonEn,
      ruleId: "payroll.deduction.capRatio",
    });
  }
  for (const schedule of schedules || []) {
    const gate = checkWeekPublishGates({
      schedule,
      employees,
      weekStart: start,
      stationId: schedule.stationId,
      company,
      laborCalendar,
      ar: true,
    });
    for (const row of weekMinistrySurfaceChecks(gate.checks || [])) {
      checks.push({
        id: `hours:${schedule.stationId || "st"}:${row.id}`,
        ok: !!row.ok,
        kind: "hours_publish",
        error: row.error || null,
        reason: row.reason || row.note,
        reasonEn: row.reasonEn,
        ruleId: row.ruleId || null,
      });
    }
  }
  return checks;
}

export function visibleArbitrationOutcomes(outcomes = [], { audience = "manager", employeeId } = {}) {
  const list = Array.isArray(outcomes) ? outcomes : [];
  if (audience === "employee") {
    const self = String(employeeId || "");
    return list.filter((row) => String(row.employeeId || "") === self);
  }
  return list;
}

export function arbitrationStatusLabel(status, ar = true) {
  if (status === "block") return ar ? "موقوف — لا تجاوز" : "Blocked — no override";
  if (status === "warn") return ar ? "تنبيه باسم المادة" : "Named warning";
  if (status === "entitle") return ar ? "مستحق للعامل" : "Due to the worker";
  if (status === "allow") return ar ? "مطابق للكتالوج" : "Matches the catalog";
  return ar ? status : status;
}
