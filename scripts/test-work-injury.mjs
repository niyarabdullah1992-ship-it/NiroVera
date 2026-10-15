// Labour Law Arts. 132–139 — who pays, 60 days full then 75%, the one-year mark, Art. 139.
import assert from "node:assert/strict";
import { disabilityOutcome, gosiAllowance, gosiHazardCoverage, injuryMonth, injuryStatus } from "../src/lib/workInjury.js";
import { lineNet } from "../src/lib/payrollDerivations.js";
import { derivePayrollWagePatch } from "../src/lib/payrollWageSync.js";

const notCovered = { hoursPolicy: { gosiOccupationalHazards: "no" } };
const covered = { hoursPolicy: { gosiOccupationalHazards: "yes" } };
assert.equal(gosiHazardCoverage({}), null);
assert.equal(gosiHazardCoverage(notCovered), false);
assert.equal(gosiHazardCoverage(covered), true);

// Injury on 1 Jan, treatment to 31 Mar → January and February full (59 days), March: day 60 full, then 75%.
const person = { id: "e1", profile: { baseSalary: 9000 }, leaveRequests: [{ id: "L1", type: "work_injury", status: "approved", startDate: "2026-01-01", endDate: "2026-03-31", eventDate: "2026-01-01" }] };
const jan = injuryMonth({ employee: person, company: notCovered, month: "2026-01", monthlyWage: 9000 });
assert.equal(jan.fullDays, 31); assert.equal(jan.reducedDays, 0); assert.equal(jan.reduction, 0);
const mar = injuryMonth({ employee: person, company: notCovered, month: "2026-03", monthlyWage: 9000 });
assert.equal(mar.fullDays, 1, "1 Mar is day 60");
assert.equal(mar.reducedDays, 30);
assert.equal(mar.reduction, Math.round(9000 / 30 * 0.25 * 30 * 100) / 100);
// Covered by GOSI: the employer line is not reduced — GOSI compensates.
assert.equal(injuryMonth({ employee: person, company: covered, month: "2026-03", monthlyWage: 9000 }).reduction, 0);

// An extension with the same injury date keeps counting from the first treatment day.
const ext = { ...person, leaveRequests: [...person.leaveRequests, { id: "L2", type: "work_injury", status: "approved", startDate: "2026-04-01", endDate: "2026-04-30", eventDate: "2026-01-01" }] };
assert.equal(injuryMonth({ employee: ext, company: notCovered, month: "2026-04", monthlyWage: 9000 }).reducedDays, 30);

// Art. 139 — days without compensation.
const lost = { ...person, leaveRequests: [{ ...person.leaveRequests[0], art139: "refusedTreatment" }] };
const lostJan = injuryMonth({ employee: lost, company: notCovered, month: "2026-01", monthlyWage: 9000 });
assert.equal(lostJan.excludedDays, 31);
assert.equal(lostJan.unpaid, 9000 / 30 * 31);

// Status: one-year mark and Art. 138 (three years' wage, at least 54,000).
const st = injuryStatus({ employee: person, company: notCovered, today: "2026-03-15", monthlyWage: 1000 });
assert.equal(st.phase, "reduced");
assert.equal(st.yearMark, "2027-01-01");
assert.equal(st.total138, 54000);

// Payroll: the reduction reaches the net, as its own line.
const patch = derivePayrollWagePatch({ employeeId: "e1", base: 0, allowances: 0 }, person, { month: "2026-03", company: notCovered });
assert.equal(patch.fields.injuryReducedDays, 30);
const net = lineNet({ base: 9000, allowances: 0, bonus: 0, deductions: 0, injuryReduction: patch.fields.injuryReduction, injuryUnpaid: 0 });
assert.equal(net, 9000 - patch.fields.injuryReduction);
// GOSI: 100% daily, 75% in hospital; never with the wage when the company stops it.
assert.equal(gosiAllowance({ dailyWage: 300, days: 10, hospitalDays: 4 }), 300 * 6 + 225 * 4);
const stop = { hoursPolicy: { gosiOccupationalHazards: "yes", gosiInjuryWageMode: "stop" } };
const jStop = injuryMonth({ employee: person, company: stop, month: "2026-01", monthlyWage: 9000 });
assert.equal(jStop.wageStop, 9000 / 30 * 31);
assert.equal(injuryMonth({ employee: person, company: covered, month: "2026-01", monthlyWage: 9000 }).wageStop, 0, "default: the wage continues");

// Permanent outcomes.
assert.equal(disabilityOutcome({ covered: false, kind: "total", monthlyWage: 2000 }).lump, 72000);
assert.equal(disabilityOutcome({ covered: false, kind: "partial", percent: 30, monthlyWage: 1000 }).lump, 16200, "30% of 54,000");
assert.equal(disabilityOutcome({ covered: true, saudi: true, kind: "total", avgWage3: 8000 }).monthly, 8000);
assert.equal(disabilityOutcome({ covered: true, saudi: true, kind: "partial", percent: 60, avgWage3: 8000 }).monthly, 4800);
assert.equal(disabilityOutcome({ covered: true, saudi: true, kind: "total", avgWage3: 10000, needsCare: true }).care, 3500, "care capped at 3,500");
assert.equal(disabilityOutcome({ covered: true, saudi: false, kind: "total", avgWage3: 5000 }).lump, 330000);
assert.equal(disabilityOutcome({ covered: true, saudi: false, kind: "partial", percent: 50, avgWage3: 2000 }).lump, 60000);
assert.equal(disabilityOutcome({ covered: true, saudi: true, kind: "partial", percent: 30, avgWage3: 8000 }).belowThreshold, true);
assert.equal(disabilityOutcome({ covered: false, kind: "death", monthlyWage: 3000 }).endsContract, true);
console.log("work-injury: PASS");
