/**
 * Unified platform facts registry.
 * Catalog companion: base44/data/domains.jsonc (schema map).
 * This layer answers: one home, one writer, stored vs derived, Arabic meaning.
 */

import { rolesForWriter } from "./writers.js";
import { COMPANY_FACTS } from "./company.js";
import { PEOPLE_FACTS } from "./people.js";
import { ORG_FACTS } from "./org.js";
import { ATTENDANCE_FACTS } from "./attendance.js";
import { PAYROLL_FACTS } from "./payroll.js";
import { MONEY_FACTS } from "./money.js";
import { REQUEST_FACTS } from "./requests.js";
import { DISCIPLINE_FACTS } from "./discipline.js";
import { VOICE_FACTS } from "./voice.js";
import { PERFORMANCE_FACTS } from "./performance.js";
import { SAFETY_FACTS } from "./safety.js";
import { PROOF_FACTS } from "./proof.js";
import { SIGNING_FACTS } from "./signing.js";
import { NOTIFICATION_FACTS } from "./notifications.js";
import { OWNER_FACTS } from "./owner.js";

/** HR wage / GOSI subset — same ids as the first-pass hrFacts catalog. */
export const HR_FACTS = Object.freeze([
  ...COMPANY_FACTS.filter((f) => f.id === "company.establishment"),
  ...PEOPLE_FACTS.filter((f) =>
    [
      "employee.subscriber",
      "employee.gosiRegisteredAt",
      "employee.nationality",
      "employee.baseSalary",
      "employee.housingAllowance",
      "employee.transportAllowance",
      "employee.otherAllowances",
      "statute.employeeRate",
      "statute.employerRate",
      "statute.newAnnuity",
    ].includes(f.id),
  ),
  ...PAYROLL_FACTS.filter((f) =>
    ["payroll.base", "payroll.allowances", "payroll.overtime", "payroll.gosiEmployee", "payroll.net"].includes(f.id),
  ),
]);

export const PLATFORM_FACTS = Object.freeze([
  ...COMPANY_FACTS,
  ...PEOPLE_FACTS,
  ...ORG_FACTS,
  ...ATTENDANCE_FACTS,
  ...PAYROLL_FACTS,
  ...MONEY_FACTS,
  ...REQUEST_FACTS,
  ...DISCIPLINE_FACTS,
  ...VOICE_FACTS,
  ...PERFORMANCE_FACTS,
  ...SAFETY_FACTS,
  ...PROOF_FACTS,
  ...SIGNING_FACTS,
  ...NOTIFICATION_FACTS,
  ...OWNER_FACTS,
]);

export const DOMAIN_MODULES = Object.freeze({
  company: COMPANY_FACTS,
  people: PEOPLE_FACTS,
  org: ORG_FACTS,
  attendance: ATTENDANCE_FACTS,
  payroll: PAYROLL_FACTS,
  expenses: MONEY_FACTS.filter((f) => f.domain === "expenses"),
  assets: MONEY_FACTS.filter((f) => f.domain === "assets"),
  inventory: MONEY_FACTS.filter((f) => f.domain === "inventory"),
  money: MONEY_FACTS,
  requests: REQUEST_FACTS,
  discipline: DISCIPLINE_FACTS,
  voice: VOICE_FACTS,
  performance: PERFORMANCE_FACTS,
  safety: SAFETY_FACTS,
  proof: PROOF_FACTS,
  signing: SIGNING_FACTS,
  notifications: NOTIFICATION_FACTS,
  owner: OWNER_FACTS,
});

const BY_ID = new Map(PLATFORM_FACTS.map((fact) => [fact.id, fact]));

export function factById(id) {
  return BY_ID.get(id) || null;
}

export function factsForDomain(domain) {
  return DOMAIN_MODULES[domain] || PLATFORM_FACTS.filter((f) => f.domain === domain);
}

export function writerRoles(factId) {
  const fact = factById(factId);
  if (!fact) return [];
  return rolesForWriter(fact.writer);
}

export function mayWrite(factId, role) {
  return writerRoles(factId).includes(String(role || ""));
}

export function isDerivedFact(factId) {
  const fact = factById(factId);
  if (!fact) return false;
  return fact.stored === false || fact.writer === "derived-only" || fact.writer === "statute" || fact.writer === "payroll-derivation";
}

export function primaryHome(factId) {
  const fact = factById(factId);
  return fact?.home || fact?.path || null;
}

export function domainTable() {
  return Object.entries(DOMAIN_MODULES).map(([domain, facts]) => ({
    domain,
    count: facts.length,
    primaries: facts
      .filter((f) => !f.legacyKeys?.length && f.writer !== "do-not-write")
      .map((f) => ({
        id: f.id,
        home: f.home || f.path,
        writer: f.writer,
        stored: f.stored !== false,
        noteAr: f.noteAr || f.surfaceAr || "",
      })),
  }));
}
