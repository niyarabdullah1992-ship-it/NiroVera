// A leave approved before its week is published charges its work days. The roster began on Saturday the 14th
// (week of the 8th published with that one day) and the week of the 15th was not drawn yet: Monday 16 and
// Tuesday 17 were read as rest cells («company» / «cycle»), so a two-day leave took nothing from the balance.
import assert from "node:assert/strict";
import { annualDayBreakdown, rosterRestDows } from "../src/lib/leaveEidOverlap.js";
import { laborCalendarOf } from "../src/lib/ummAlQuraCalendar.js";

const cal = laborCalendarOf({});
const emp = { id: "r1", stationId: "st", profile: { weeklyRestDayCount: 2 } };
const company = {
  schedules: [{
    stationId: "st",
    shiftTypes: [{ id: "m" }],
    assignments: { "2026-11-14": { m: ["r1"] } },
    publishedWeeks: { "2026-11-08": { at: "2026-11-14T03:19:48Z" } },
  }],
};

assert.equal(rosterRestDows(company, emp, "2026-11-16"), null, "one drawn day is not a rest pattern");
const b = annualDayBreakdown("2026-11-16", "2026-11-17", cal, company, emp);
assert.deepEqual(b.days.map((d) => d.kind), ["charge", "charge"], "Monday and Tuesday are work days");
assert.equal(b.charged, 2);

// once the week is published with him resting Mon/Tue, those cells are rest — the roster decides
const drawn = {
  schedules: [{
    ...company.schedules[0],
    assignments: Object.fromEntries(["2026-11-15", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"].map((k) => [k, { m: ["r1"] }])),
    publishedWeeks: { ...company.schedules[0].publishedWeeks, "2026-11-15": { at: "2026-11-14T03:27Z" } },
  }],
};
assert.equal(annualDayBreakdown("2026-11-16", "2026-11-17", cal, drawn, emp).charged, 0, "his published rest days are not charged");

console.log("PASS a leave before its week is published charges its work days");
