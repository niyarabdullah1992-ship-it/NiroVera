/**
 * Rules the company blob must satisfy on every read — not migrations, because new records keep
 * arriving that need the same treatment (a hire without a number, a shift stretched past five hours,
 * a fixed-term contract that converted today under Art. 55).
 *
 * Each invariant is cheap and idempotent. `runCompanyInvariants` applies them in order and returns
 * whether anything changed. Order matters where noted.
 */
import { attachSharedGradesToTitles, ensureProductLadder } from "../jobGradeTitles.js";
import { ensureEmployeeNumbers } from "../employeeNumber.js";
import { canonicalizePlatformFacts } from "../facts/migrate.js";
import { voidLegacyHolidayRequestsIn } from "../leaveDerivations.js";
import { longShiftRestPatch } from "../shiftDerivations.js";
import { art55FilePatch } from "../contractLawDerivations.js";

/** Every shift type past five hours carries the rest the worker places himself (longShiftRestPatch) — no roster break settings. */
export function openLongShiftRests(data) {
  let changed = false;
  for (const schedule of data?.schedules || []) {
    for (const shift of schedule?.shiftTypes || []) {
      const patch = longShiftRestPatch(shift);
      if (patch) { Object.assign(shift, patch); changed = true; }
    }
  }
  return changed;
}

/** Art. 55: a fixed-term contract renewed past its limit is indefinite — the file says so from the day it converts. */
export function applyArt55Conversions(data) {
  let changed = false;
  (data?.employees || []).forEach((emp) => {
    const { patch } = art55FilePatch(emp);
    if (!Object.keys(patch).length) return;
    emp.profile = { ...(emp.profile || {}), ...patch };
    changed = true;
  });
  return changed;
}

export const COMPANY_INVARIANTS = Object.freeze([
  { id: "shared-grades-on-titles", run: attachSharedGradesToTitles },
  { id: "product-ladder", run: ensureProductLadder },
  { id: "employee-numbers", run: ensureEmployeeNumbers },
  { id: "platform-facts-canonical", run: canonicalizePlatformFacts },
  // Art. 112: official holidays apply from the calendar — a pending «eid» request needs no decision.
  { id: "void-holiday-requests", run: voidLegacyHolidayRequestsIn },
  { id: "long-shift-rests", run: openLongShiftRests },
]);

/** Invariants that read the clock run last, after any preview seeding of files. */
export const COMPANY_DATED_INVARIANTS = Object.freeze([
  { id: "art55-conversions", run: applyArt55Conversions },
]);

export function runCompanyInvariants(data, list = COMPANY_INVARIANTS) {
  if (!data || typeof data !== "object") return false;
  let changed = false;
  for (const step of list) {
    if (step.run(data)) changed = true;
  }
  return changed;
}
