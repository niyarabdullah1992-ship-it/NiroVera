/**
 * One-time migrations of the company blob — legacy shapes rewritten once per version.
 *
 * Every entry has a number, a name and a reason. `runCompanyMigrations` applies the entries above
 * the blob's `schemaVersion` in order, stamps the new version and a compact log, and returns whether
 * anything changed. A blob already at the current version costs one comparison per read — nothing
 * here runs twice. Rules the data must keep satisfying over time are not migrations: they live in
 * companyInvariants.js.
 *
 * Adding a migration: append an entry with the next version. Never renumber or remove entries;
 * a blob stored before a migration must still be able to find it.
 */
import { moveCompCreditsOutOfAnnual } from "../compLeave.js";

const PRESET_GRADE_TITLES = new Set(["مبتدئ", "متوسط", "أول", "مشرف", "مدير"]);

/** The preset grade ladders (TC1…, grade_tc1…) shipped once as samples; the owner's rule removed them. */
export function purgePresetLadders(data) {
  const removed = new Set();
  const next = (data.jobGrades || []).filter((grade) => {
    const presetCode = PRESET_GRADE_TITLES.has(String(grade?.title || "").trim())
      && /^(TC|EN|HR|HS|FN|BM|LD|GR)\d+$/i.test(String(grade?.gradeNumber || "").trim());
    const legacy = /^grade_tc[1-5]$/i.test(String(grade?.id || ""));
    if (!presetCode && !legacy) return true;
    removed.add(grade.id);
    return false;
  });
  if (!removed.size) return false;
  data.jobGrades = next;
  (data.orgSeats || []).forEach((seat) => {
    if (removed.has(seat.gradeId)) seat.gradeId = "";
  });
  (data.employees || []).forEach((employee) => {
    if (employee?.profile && removed.has(employee.profile.gradeId)) employee.profile.gradeId = null;
  });
  return true;
}

/** Art. 103 continuous work was removed from the platform by the owner — a stored flag is cleared once;
 *  the library still reads the flag, nothing can set it. */
export function clearContinuous103(data) {
  let changed = false;
  for (const bag of [data?.hoursPolicy, data?.attendanceSettings?.hoursPolicy]) {
    if (bag && bag.continuousWork103) { bag.continuousWork103 = false; changed = true; }
  }
  return changed;
}

export const COMPANY_MIGRATIONS = Object.freeze([
  {
    version: 1,
    id: "drop-cameras",
    why: "Camera records left the platform; the key is removed from stored companies.",
    run(data) {
      if (!Object.prototype.hasOwnProperty.call(data, "cameras")) return false;
      delete data.cameras;
      return true;
    },
  },
  {
    version: 2,
    id: "purge-preset-ladders",
    why: "Sample grade ladders are not the company's grades; seats and files that pointed at them are unlinked.",
    run: purgePresetLadders,
  },
  {
    version: 3,
    id: "comp-credits-out-of-annual",
    why: "Compensatory leave is its own balance (regs 22 bis) — old credits that went into annual leave are undone.",
    run: moveCompCreditsOutOfAnnual,
  },
  {
    version: 4,
    id: "clear-continuous-103",
    why: "Art. 103 continuous work is not offered; every shift keeps its rest (Art. 101).",
    run: clearContinuous103,
  },
  {
    version: 5,
    id: "drop-rest-plans",
    why: "Rest plans were removed (owner's rule) — a stored plan no longer places anyone's rest.",
    run(data) {
      if (!data.restPlans || !Object.keys(data.restPlans).length) return false;
      data.restPlans = {};
      return true;
    },
  },
]);

export const COMPANY_SCHEMA_VERSION = COMPANY_MIGRATIONS[COMPANY_MIGRATIONS.length - 1].version;

/** Applies the migrations above `data.schemaVersion`; returns true when the blob changed (version stamp included). */
export function runCompanyMigrations(data, { now = () => new Date().toISOString() } = {}) {
  if (!data || typeof data !== "object") return false;
  const from = Number(data.schemaVersion) || 0;
  if (from >= COMPANY_SCHEMA_VERSION) return false;
  const log = Array.isArray(data.schemaLog) ? data.schemaLog.slice(-20) : [];
  for (const step of COMPANY_MIGRATIONS) {
    if (step.version <= from) continue;
    let changed = false;
    try {
      changed = Boolean(step.run(data));
    } catch (error) {
      // a failing step must not block the read — the version stays below it so it is retried next time
      if (typeof console !== "undefined") console.error(`NiroVera migration ${step.id}:`, error);
      data.schemaLog = log;
      return true;
    }
    if (changed) log.push({ v: step.version, id: step.id, at: now() });
    data.schemaVersion = step.version;
  }
  data.schemaLog = log;
  return true;
}
