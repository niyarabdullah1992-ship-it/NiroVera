import assert from "node:assert/strict";
// The company blob's one-time migrations run once per version; the invariants run every read.
import { COMPANY_MIGRATIONS, COMPANY_SCHEMA_VERSION, runCompanyMigrations } from "../src/lib/data/companyMigrations.js";
import { COMPANY_INVARIANTS, COMPANY_DATED_INVARIANTS, runCompanyInvariants } from "../src/lib/data/companyInvariants.js";

// registry shape: strictly increasing versions, unique ids, a reason on every step
const versions = COMPANY_MIGRATIONS.map((m) => m.version);
assert.deepEqual(versions, versions.map((_, i) => i + 1), "versions are 1..n with no gaps");
assert.equal(new Set(COMPANY_MIGRATIONS.map((m) => m.id)).size, COMPANY_MIGRATIONS.length, "ids are unique");
assert.ok(COMPANY_MIGRATIONS.every((m) => m.why && typeof m.run === "function"), "every step names its reason");
assert.equal(COMPANY_SCHEMA_VERSION, versions[versions.length - 1]);

// a legacy blob: every step applies once, the version is stamped, the log names what changed
const legacy = {
  cameras: [{ id: "c1" }],
  jobGrades: [{ id: "grade_tc1", title: "مبتدئ", gradeNumber: "TC1" }, { id: "g_real", title: "مهندس أول", gradeNumber: "A7" }],
  orgSeats: [{ id: "s1", gradeId: "grade_tc1" }],
  employees: [{ id: "e1", profile: { gradeId: "grade_tc1", leaveTotals: { annual: 25 } }, otherRequests: [{ id: "o1", type: "overtime", balanceApplied: true, appliedDays: 2 }] }],
  hoursPolicy: { continuousWork103: true },
  restPlans: { "e1:2026-01-01": { parts: [] } },
};
const at = () => "2026-10-19T00:00:00.000Z";
assert.equal(runCompanyMigrations(legacy, { now: at }), true);
assert.equal(legacy.schemaVersion, COMPANY_SCHEMA_VERSION);
assert.equal("cameras" in legacy, false, "v1 dropped cameras");
assert.deepEqual(legacy.jobGrades.map((g) => g.id), ["g_real"], "v2 purged the preset ladder only");
assert.equal(legacy.orgSeats[0].gradeId, "", "seat unlinked from the purged grade");
assert.equal(legacy.employees[0].profile.gradeId, null, "file unlinked from the purged grade");
assert.equal(legacy.employees[0].profile.leaveTotals.annual, 23, "v3 took the comp credit back out of annual");
assert.equal(legacy.employees[0].otherRequests[0].compMovedOut, true);
assert.equal(legacy.hoursPolicy.continuousWork103, false, "v4 cleared Art. 103");
assert.deepEqual(legacy.restPlans, {}, "v5 dropped rest plans");
assert.deepEqual(legacy.schemaLog.map((row) => row.id), COMPANY_MIGRATIONS.map((m) => m.id), "every step logged with its id");
assert.ok(legacy.schemaLog.every((row) => row.at === at()));

// a current blob: one comparison, nothing touched, nothing persisted
const current = { schemaVersion: COMPANY_SCHEMA_VERSION, employees: [], cameras: "untouched-after-current" };
assert.equal(runCompanyMigrations(current), false, "no work above the current version");
assert.equal(current.cameras, "untouched-after-current", "a step never re-runs on a current blob");

// a partly migrated blob: only the steps above its version run
const partial = { schemaVersion: 3, hoursPolicy: { continuousWork103: true }, cameras: [1], restPlans: { x: 1 } };
assert.equal(runCompanyMigrations(partial, { now: at }), true);
assert.deepEqual(partial.cameras, [1], "v1 is below the stored version and stays untouched");
assert.equal(partial.hoursPolicy.continuousWork103, false);
assert.deepEqual(partial.schemaLog.map((row) => row.v), [4, 5]);

// a failing step keeps the version below it, so the next read retries it, and does not block the read
const broken = { schemaVersion: 4, get restPlans() { throw new Error("boom"); } };
assert.equal(runCompanyMigrations(broken, { now: at }), true);
assert.equal(broken.schemaVersion, 4, "the failing step is not stamped");

// invariants: named, idempotent on an empty company, and the dated ones kept apart
assert.ok(COMPANY_INVARIANTS.length >= 5 && COMPANY_INVARIANTS.every((s) => s.id && typeof s.run === "function"));
assert.ok(COMPANY_DATED_INVARIANTS.some((s) => s.id === "art55-conversions"));
const empty = { employees: [], stations: [], schedules: [], jobGrades: [], orgSeats: [], settings: {} };
runCompanyInvariants(empty);
const snapshot = JSON.stringify(empty);
assert.equal(runCompanyInvariants(empty), false, "a second pass changes nothing");
assert.equal(JSON.stringify(empty), snapshot);
// the long-shift rest invariant opens the hour on a shift past five hours
const sched = { employees: [], stations: [], jobGrades: [], orgSeats: [], settings: {}, schedules: [{ id: "s", shiftTypes: [{ id: "t", start: "08:00", end: "17:00" }] }] };
runCompanyInvariants(sched);
const shift = sched.schedules[0].shiftTypes[0];
assert.ok(Object.keys(shift).length > 3, "a nine-hour shift received its rest patch");

console.log("company migrations OK");
