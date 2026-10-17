// Weekly rest is set per worker on the file (HR); the establishment days are only the fallback.
import assert from "node:assert/strict";
import { fileOffDows, isWeeklyOffDay, weeklyOffDows, weeklyRestDayCountOf, weeklyRestDowOf } from "../src/lib/leaveEidOverlap.js";
import { fridaySwapGaps } from "../src/lib/ministryExtras.js";
const company = { hoursPolicy: { workPosting: { weeklyRestDow: 5, weeklyOffDows: [5, 6] } } };
const defaultPerson = { profile: {} };
const own = { profile: { weeklyOffDows: [3] } };
assert.deepEqual(weeklyOffDows(company, defaultPerson), [5, 6]);
assert.deepEqual(fileOffDows(own), [3]);
assert.deepEqual(weeklyOffDows(company, own), [3], "the file wins");
assert.equal(weeklyRestDayCountOf(company, own), 1);
assert.equal(weeklyRestDowOf(company, own), 3);
assert.equal(isWeeklyOffDay("2026-10-14", company, own), true, "Wednesday is his rest");
assert.deepEqual(fridaySwapGaps(company, [defaultPerson]), [], "Friday rest for everyone → no Art. 104(1) paperwork");
assert.equal(fridaySwapGaps(company, [defaultPerson, own]).length, 2, "one file without Friday asks for the labour-office notice and religious duties");
console.log("rest-on-file: PASS");
// Annual leave day by day (Art. 109): weekly rest and holidays are not taken; the count matches the charge.
import { annualDayBreakdown, chargeableAnnualWorkDays } from "../src/lib/leaveEidOverlap.js";
const two = annualDayBreakdown("2026-10-11", "2026-10-20", null, company, { id: "a", profile: {} });
assert.equal(two.calendarDays, 10);
assert.equal(two.counts.law, 1);
assert.equal(two.counts.company, 1);
assert.equal(two.charged, chargeableAnnualWorkDays("2026-10-11", "2026-10-20", null, company, { id: "a", profile: {} }));
const six = annualDayBreakdown("2026-10-11", "2026-10-20", null, company, { id: "b", profile: { weeklyOffDows: [5] } });
assert.equal(six.charged, 9, "a six-day file: only Friday is free");
console.log("annual-breakdown: PASS");
// Decision 18632 (e): family responsibilities are a duty request; approval writes the file flag.
import { DUTY_REQUEST_META, DUTY_REQUEST_TYPES, dutyRequestEffect } from "../src/lib/dutyRequests.js";
import { REQUEST_KINDS } from "../src/lib/requestWorkspace.js";
assert.ok(DUTY_REQUEST_TYPES.includes("family_duties"));
assert.equal(DUTY_REQUEST_META.family_duties.cite, "18632");
assert.match(dutyRequestEffect("family_duties", true), /مراعاة لا مانع/);
assert.ok(REQUEST_KINDS.some((row) => row.id === "family_duties" && row.duty));
console.log("family-duties: PASS");
