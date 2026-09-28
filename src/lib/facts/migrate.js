/**
 * Named preview-store migrations for platform facts.
 * Moves fields that landed in the wrong home. Leaves empty fields empty.
 * Does not invent gosiRegisteredAt.
 */

import { LEGACY_FALLBACK, mergeLegacyOnce, payloadHasRows, DO_NOT_WRITE } from "../canonicalStore.js";
import { canonicalizeGosiFacts } from "./people.js";
import { readCompanyEstablishment } from "./company.js";

export const PLATFORM_MIGRATION_IDS = Object.freeze([
  "platform.legacyBagsOnce",
  "platform.gosiHomes",
  "platform.stripDoNotWriteArrays",
]);

/**
 * Lift legacy silo bags onto canonical keys once (in-memory company blob).
 * When canonical is already populated, drop the empty-or-superseded legacy key.
 * Never invent rows. Never invent gosiRegisteredAt.
 */
export function migrateLegacyBagsOnce(data) {
  if (!data || typeof data !== "object") return false;
  let changed = false;
  for (const [canonical, legacyKeys] of Object.entries(LEGACY_FALLBACK)) {
    const companyId = String(data.id || data.companyId || "");
    let payload = data[canonical];
    for (const legacy of legacyKeys) {
      if (!Object.prototype.hasOwnProperty.call(data, legacy)) continue;
      const result = mergeLegacyOnce(payload, data[legacy], companyId);
      if (result.migrated) {
        data[canonical] = result.payload;
        payload = result.payload;
        delete data[legacy];
        changed = true;
        continue;
      }
      // Canonical already has authority (or both empty): retire the silo key.
      if (payloadHasRows(payload) || !payloadHasRows(data[legacy])) {
        delete data[legacy];
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * Drop retired do-not-write array keys that still linger on old preview blobs
 * after a one-shot legacy merge (stockBoard / signingChain have no LEGACY_FALLBACK
 * merge target in the local bag — they are simply removed if empty of authority).
 */
export function stripRetiredDoNotWriteKeys(data) {
  if (!data || typeof data !== "object") return false;
  let changed = false;
  for (const key of DO_NOT_WRITE) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    // Keys with a LEGACY_FALLBACK merge are handled by migrateLegacyBagsOnce.
    const hasCanonicalHome = Object.values(LEGACY_FALLBACK).some((list) => list.includes(key));
    if (hasCanonicalHome) continue;
    delete data[key];
    changed = true;
  }
  return changed;
}

/**
 * Full platform canonicalize for a company preview blob.
 * - Legacy bags → canonical
 * - GOSI establishment / subscriber homes
 * - Strip orphan do-not-write keys without a merge target
 */
export function canonicalizePlatformFacts(data) {
  if (!data || typeof data !== "object") return false;
  let changed = false;
  if (migrateLegacyBagsOnce(data)) changed = true;
  if (canonicalizeGosiFacts(data)) changed = true;
  if (stripRetiredDoNotWriteKeys(data)) changed = true;
  return changed;
}

/** Migration name used by previewMigrations + store hydrate. */
export function migratePlatformFactHomes(data) {
  return canonicalizePlatformFacts(data);
}

export function platformMigrationReport(data) {
  return {
    establishment: readCompanyEstablishment(data),
    hasOrgStructure: Object.prototype.hasOwnProperty.call(data || {}, "orgStructure"),
    hasAttendanceLedger: Object.prototype.hasOwnProperty.call(data || {}, "attendanceLedger"),
    hasComplaintQueue: Object.prototype.hasOwnProperty.call(data || {}, "complaintQueue"),
    hasExpenseBudget: Object.prototype.hasOwnProperty.call(data || {}, "expenseBudget"),
    tasks: Array.isArray(data?.tasks) ? data.tasks.length : 0,
    personalAttendance: Array.isArray(data?.personalAttendance) ? data.personalAttendance.length : 0,
    anonymousReports: Array.isArray(data?.anonymousReports) ? data.anonymousReports.length : 0,
  };
}
