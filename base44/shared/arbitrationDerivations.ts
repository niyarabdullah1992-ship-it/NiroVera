/** Server mirror of src/lib/arbitrationEngine.js — catalog + sealed verdicts.
 *  labor_rules is LABOR_RULES (read-only). Disputes stay on Employee request lists.
 */

import { LABOR_RULES, citeRule, explainRule, ruleAt, type LaborRule } from "./laborRules.ts";
import { checkApproveLeaveGate, checkSubmitLeaveGate } from "./leaveDerivations.ts";
import { checkArticle92LoanGate, checkArticle93Gate } from "./payrollDerivations.ts";
import { checkContractTermGate } from "./complianceDerivations.ts";
import { checkOtDecisionGate } from "./attendanceDerivations.ts";
import {
  ARBITRATION_DISCLAIMER_AR,
  ARBITRATION_DISCLAIMER_EN,
  attachPlatformJudgment,
  MINISTRY_ROLE,
  PLATFORM_FORUM,
} from "./platformJudgment.ts";

export {
  ARBITRATION_DISCLAIMER_AR,
  ARBITRATION_DISCLAIMER_EN,
  MINISTRY_ROLE,
  PLATFORM_FORUM,
};

export const ARBITRATION_ACTIONS = {
  leave_submit: { family: "leave", entitled: "employee" },
  leave_approve: { family: "leave", entitled: "employee" },
  deduction: { family: "payroll", ruleId: "payroll.deduction.capRatio", entitled: "employee" },
  loan: { family: "payroll", ruleId: "payroll.loan.capRatio", entitled: "employee" },
  contract_end: { family: "contract", ruleId: "contract.fixed.cite", entitled: "none" },
  overtime: { family: "hours", ruleId: "hours.ot.premium", entitled: "employee" },
} as const;

export type ArbitrationKind = keyof typeof ARBITRATION_ACTIONS;
export type ArbitrationStatus = "block" | "warn" | "entitle" | "allow";

function familyOfRule(id: string) {
  return String(id || "").split(".")[0] || "";
}

function instrumentOf(row: { id?: string; source?: string; article?: string | null } | null, onDate?: string) {
  const explained = row?.id ? explainRule(row.id, onDate) : null;
  if (explained?.labelAr) return { ar: explained.labelAr, en: explained.labelEn };
  const id = String(row?.id || "");
  if (id.startsWith("hours.night.")) return { ar: "قرار 18632", en: "Decision 18632" };
  if (id.startsWith("hours.heat.")) return { ar: "قرار 3337", en: "Decision 3337" };
  if (row?.source === "labour" && row?.article) {
    return { ar: `المادة ${row.article}`, en: `Art. ${row.article}` };
  }
  if (row?.source === "ministerial") return { ar: "قرار وزاري", en: "Ministerial decision" };
  return { ar: null as string | null, en: null as string | null };
}

export function laborRulesCatalog({ family, source, onDate }: {
  family?: string;
  source?: string;
  onDate?: string;
} = {}) {
  const seen = new Set<string>();
  const out: Array<LaborRule & { instrumentAr: string | null; instrumentEn: string | null; textAr: string; textEn: string }> = [];
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

function attachCite(gate: Record<string, unknown>, ruleId: string | undefined, onDate?: string) {
  const id = ruleId || (gate.ruleId as string | undefined) || (gate.cite as { id?: string } | undefined)?.id;
  const explained = id ? explainRule(id, onDate) : null;
  const cite = id ? citeRule(id, onDate) : gate.cite;
  const instrument = instrumentOf({
    id,
    source: explained?.source,
    article: explained?.article || (cite as { article?: string } | null)?.article,
  }, onDate);
  return {
    ...gate,
    ruleId: id || null,
    article: explained?.article || (cite as { article?: string } | null)?.article || null,
    instrumentAr: instrument.ar,
    instrumentEn: instrument.en,
    cite: cite || explained || gate.cite || null,
  };
}

export function reviewArbitrationCase(input: {
  kind?: string;
  request?: Record<string, unknown> | null;
  employee?: Record<string, unknown> | null;
  line?: Record<string, unknown>;
  extraAdvance?: number;
  onDate?: string;
  overtimeMinutes?: number;
  decision?: string;
  workerConsent?: boolean;
  alreadyDecided?: boolean;
  overtimeHoursYtd?: number;
  annualCapConsent?: boolean;
} = {}) {
  const kind = String(input.kind || "").trim() as ArbitrationKind;
  const spec = ARBITRATION_ACTIONS[kind];
  if (!spec) {
    return {
      ok: false,
      kind,
      status: "block" as ArbitrationStatus,
      error: "UNKNOWN_ACTION",
      reason: "نوع الإجراء غير معروف للمحرّك.",
      reasonEn: "The engine does not know that action kind.",
      overrideAllowed: false,
      actor: "system" as const,
    };
  }
  const onDate = input.onDate || String(input.request?.startDate || input.request?.date || "");
  let gate: Record<string, unknown>;
  if (kind === "leave_submit") {
    gate = attachCite(checkSubmitLeaveGate(input.request as never, {
      profile: (input.employee as { profile?: never })?.profile,
      requests: (input.employee as { leaveRequests?: never })?.leaveRequests,
    }) as Record<string, unknown>, spec.ruleId, onDate);
  } else if (kind === "leave_approve") {
    gate = attachCite(checkApproveLeaveGate(input.request as never, false, {
      profile: (input.employee as { profile?: never })?.profile,
      requests: (input.employee as { leaveRequests?: never })?.leaveRequests,
    }) as Record<string, unknown>, spec.ruleId, onDate);
  } else if (kind === "deduction") {
    gate = attachCite(checkArticle93Gate((input.line || input.request || {}) as never), spec.ruleId, onDate);
  } else if (kind === "loan") {
    gate = attachCite(checkArticle92LoanGate((input.line || input.request || {}) as never, input.extraAdvance), spec.ruleId, onDate);
  } else if (kind === "contract_end") {
    gate = attachCite(checkContractTermGate({
      employee: input.employee,
      today: onDate || undefined,
    }) as Record<string, unknown>, spec.ruleId, onDate);
  } else {
    gate = attachCite(checkOtDecisionGate({
      overtimeMinutes: input.overtimeMinutes ?? Number(input.request?.overtimeMinutes || 0),
      decision: input.decision ?? String(input.request?.decision || ""),
      workerConsent: input.workerConsent ?? Boolean(input.request?.workerConsent),
      alreadyDecided: input.alreadyDecided,
      overtimeHoursYtd: input.overtimeHoursYtd,
      annualCapConsent: input.annualCapConsent,
      onDate,
    }) as Record<string, unknown>, spec.ruleId, onDate);
  }
  const status: ArbitrationStatus = gate.ok
    ? (gate.warning ? "warn" : (spec.entitled === "employee" ? "entitle" : "allow"))
    : "block";
  return attachPlatformJudgment({
    ok: !!gate.ok,
    kind,
    family: spec.family,
    status,
    error: (gate.error as string) || null,
    ruleId: (gate.ruleId as string) || spec.ruleId || null,
    article: (gate.article as string) || null,
    instrumentAr: (gate.instrumentAr as string) || null,
    instrumentEn: (gate.instrumentEn as string) || null,
    cite: gate.cite || null,
    reason: (gate.reason as string) || (gate.ok
      ? (status === "entitle" ? "مستحق وفق الكتالوج المعتمد." : "الإجراء مطابق للكتالوج.")
      : "موقوف — مخالفة للائحة المعتمدة."),
    reasonEn: (gate.reasonEn as string) || (gate.ok
      ? (status === "entitle" ? "Due under the adopted catalog." : "The act matches the catalog.")
      : "Blocked — it breaches the adopted regulation."),
    warning: gate.warning || null,
    entitledParty: spec.entitled,
    overrideAllowed: false,
    actor: "system" as const,
    observedAt: new Date().toISOString(),
  }, { entitled: spec.entitled });
}

export function sealArbitrationVerdict(review: ReturnType<typeof reviewArbitrationCase> & { observedAt?: string }, extras: {
  companyId?: string;
  requestId?: string;
  employeeId?: string;
  actorRole?: string;
  actorId?: string;
  id?: string;
} = {}) {
  const observedAt = review.observedAt || new Date().toISOString();
  const seed = [
    extras.companyId || "",
    review.kind || "",
    extras.requestId || extras.employeeId || "",
    review.status || "",
    ("ruleId" in review ? review.ruleId : "") || "",
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
    family: "family" in review ? review.family : null,
    status: review.status,
    error: "error" in review ? review.error : null,
    ruleId: "ruleId" in review ? review.ruleId : null,
    article: "article" in review ? review.article : null,
    instrumentAr: "instrumentAr" in review ? review.instrumentAr : null,
    instrumentEn: "instrumentEn" in review ? review.instrumentEn : null,
    reason: "reason" in review ? review.reason : "",
    reasonEn: "reasonEn" in review ? review.reasonEn : "",
    entitledParty: "entitledParty" in review ? review.entitledParty : "none",
    protects: "protects" in review ? review.protects : null,
    judgment: "judgment" in review ? review.judgment : null,
    forum: "forum" in review ? review.forum : PLATFORM_FORUM,
    ministryRole: "ministryRole" in review ? review.ministryRole : MINISTRY_ROLE,
    overrideAllowed: false,
    immutable: true,
    actor: "system" as const,
    decidedByRole: extras.actorRole || "system",
    decidedById: extras.actorId || "",
    observedAt,
    sealedAt: observedAt,
    disclaimerAr: ARBITRATION_DISCLAIMER_AR,
    disclaimerEn: ARBITRATION_DISCLAIMER_EN,
  };
}

export const ARBITRATION_SECTORS = [
  { id: "wages", ar: "أجور", en: "Wages", href: "/app/payroll" },
  { id: "contracts", ar: "عقود", en: "Contracts", href: "/app/hr" },
  { id: "hours", ar: "دوام وإجازات", en: "Hours & leave", href: "/app/shifts" },
  { id: "safety", ar: "سلامة", en: "Safety", href: "/app/safety" },
  { id: "discipline", ar: "جزاءات", en: "Discipline", href: "/app/discipline" },
] as const;

export const COMPLIANCE_PORTS = [
  { id: "qiwa", ar: "قوى", en: "Qiwa", sector: "contracts" },
  { id: "gosi", ar: "التأمينات", en: "GOSI", sector: "wages" },
  { id: "mudad", ar: "مدد / WPS", en: "Mudad / WPS", sector: "wages" },
  { id: "nafath", ar: "نفاذ", en: "Nafath", sector: "contracts" },
] as const;

export function deriveLaborComplianceScore(checks: Array<{ ok?: boolean; skipped?: boolean; sector?: string; kind?: string; id?: string; ruleId?: string; reason?: string; reasonEn?: string }> = []) {
  const list = (checks || []).filter((row) => row && row.skipped !== true);
  const total = list.length;
  const passed = list.filter((row) => row.ok).length;
  const blocked = list.filter((row) => !row.ok).length;
  const score = total ? Math.round((passed / total) * 1000) / 10 : null;
  let band: "empty" | "high" | "mid" | "low" = "empty";
  if (score == null) band = "empty";
  else if (score >= 90) band = "high";
  else if (score >= 70) band = "mid";
  else band = "low";
  return { score, total, passed, blocked, band };
}

export function sectorOfCheck(row: { sector?: string; ruleId?: string; id?: string; kind?: string } = {}) {
  if (row.sector) return row.sector;
  const token = `${row.ruleId || ""} ${row.id || ""} ${row.kind || ""}`.toLowerCase();
  if (token.includes("heat") || token.includes("safety.") || row.kind === "safety") return "safety";
  if (token.includes("discipline") || row.kind === "discipline") return "discipline";
  if (token.includes("payroll.") || token.includes("gosi") || token.includes("wps") || row.kind === "deduction" || row.kind === "loan" || row.kind === "wps") {
    return "wages";
  }
  if (token.includes("contract.") || row.kind === "contract_end") return "contracts";
  return "hours";
}

export function deriveMhrsdSectorBoard(checks: Array<{ ok?: boolean; skipped?: boolean; sector?: string; kind?: string; id?: string; ruleId?: string; reason?: string; reasonEn?: string }> = []) {
  const overall = deriveLaborComplianceScore(checks);
  const sectors = ARBITRATION_SECTORS.map((sector) => {
    const rows = (checks || []).filter((row) => sectorOfCheck(row) === sector.id);
    const derived = deriveLaborComplianceScore(rows);
    const top = rows.find((row) => !row.ok);
    return {
      ...sector,
      ...derived,
      topReason: top?.reason || null,
      topReasonEn: top?.reasonEn || null,
      topRuleId: top?.ruleId || null,
    };
  });
  return { overall, sectors };
}

export function deriveCompliancePorts(live: Record<string, boolean> = {}) {
  return COMPLIANCE_PORTS.map((port) => ({
    ...port,
    live: !!live[port.id],
  }));
}

export function visibleArbitrationOutcomes(
  outcomes: Array<{ employeeId?: string | null }> = [],
  { audience = "manager", employeeId }: { audience?: string; employeeId?: string } = {},
) {
  const list = Array.isArray(outcomes) ? outcomes : [];
  if (audience === "employee") {
    const self = String(employeeId || "");
    return list.filter((row) => String(row.employeeId || "") === self);
  }
  return list;
}
