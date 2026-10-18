import assert from "node:assert/strict";
import { workplaceLawRows, checkWorkplaceLawGate } from "../src/lib/workplaceLaw.js";
import { citeRule } from "../src/lib/laborRules.js";

// Each duty names its Labour Law article from the catalog.
for (const [id, art] of [["safety.fire.cite", "125"], ["safety.substances.cite", "63"], ["health.care.cite", "144"], ["women.seats.cite", "158"]]) {
  assert.equal(citeRule(id)?.article, art, id);
  assert.ok(citeRule(id)?.textAr.length > 40, `${id} carries the official text`);
}
const today = "2026-10-18";
const men = [{ id: "a", profile: { gender: "male", medicalInsuranceExpiry: "2027-01-01" } }];
let rows = workplaceLawRows({ employees: men, today });
assert.equal(rows.find((r) => r.id === "law_158_seats").state, "na", "Art. 158 applies only where women work");
assert.equal(rows.find((r) => r.id === "law_144_health"), undefined, "Art. 144 belongs to HR (medical cover on the file), not to safety");
assert.equal(rows.find((r) => r.id === "law_125_fire").state, "none");

const mixed = [...men, { id: "b", profile: { gender: "female", medicalInsuranceExpiry: "2026-09-01" } }];
rows = workplaceLawRows({ employees: mixed, today, rec: { workplaceLaw: { law_125_fire: { met: true }, law_63_substances: { met: false, note: "لا تعليمات" } } } });
assert.equal(rows.find((r) => r.id === "law_158_seats").state, "none", "a woman on file → seats are required");
assert.equal(rows.find((r) => r.id === "law_125_fire").state, "ok");
assert.equal(rows.find((r) => r.id === "law_63_substances").state, "bad");

assert.equal(checkWorkplaceLawGate({}).error, "WORKPLACE_LAW_STATE");
assert.equal(checkWorkplaceLawGate({ met: false, note: "x" }).error, "WORKPLACE_LAW_NOTE");
assert.equal(checkWorkplaceLawGate({ met: true }).ok, true);
console.log("PASS workplace law — Arts. 63 · 125 · 158 in safety; 144 in HR");
