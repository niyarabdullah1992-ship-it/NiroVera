import assert from "node:assert/strict";
import { deriveMinistryAlerts, canSeeMinistryAlerts } from "../src/lib/ministryAlertDerivations.js";

assert.equal(canSeeMinistryAlerts({ role: "employee" }), false);
assert.equal(canSeeMinistryAlerts({ role: "director" }), true);

const empty = deriveMinistryAlerts({ employees: [], safety: [], payrollRuns: [] }, {
  now: new Date("2026-04-10T12:00:00"),
  today: "2026-04-10",
});
assert.equal(empty.alerts.some((a) => a.gate === "HEAT_BAN"), false);

const heat = deriveMinistryAlerts({ employees: [], safety: [], payrollRuns: [] }, {
  now: new Date("2026-07-20T12:00:00"),
  today: "2026-07-20",
});
assert.ok(heat.alerts.some((a) => a.gate === "HEAT_BAN"));

const docs = deriveMinistryAlerts({
  employees: [{
    employeeId: "e1",
    name: "خالد",
    saudi: false,
    docs: [{ kind: "iqama", number: "2", expiryDate: "2026-08-01" }],
  }],
  safety: [],
  payrollRuns: [],
}, { now: new Date("2026-09-06T12:00:00"), today: "2026-09-06" });
const expired = docs.alerts.find((a) => a.gate === "DOC_EXPIRED");
assert.ok(expired);
assert.equal(expired.count, 1);
assert.ok(!Number.isNaN(expired.count));

const hse = deriveMinistryAlerts({
  employees: [],
  safety: [{ stationId: "s1", hazards: [{ id: "h1", closedAt: null, level: "critical" }] }],
  payrollRuns: [],
}, { now: new Date("2026-04-10T12:00:00"), today: "2026-04-10" });
assert.equal(hse.alerts.some((a) => a.gate === "HSE_CRITICAL_OPEN" || a.gate === "HSE_HAZARD_OPEN"), false);
assert.equal(hse.alerts.some((a) => a.id === "hse_critical" || a.id === "hse_open"), false);

const wps = deriveMinistryAlerts({
  employees: [],
  safety: [],
  payrollRuns: [],
}, { now: new Date("2026-10-31T12:00:00"), today: "2026-10-31" });
assert.ok(wps.alerts.some((a) => a.gate === "WPS_FILE_MISSING"));

console.log("ministryAlertDerivations: PASS");
