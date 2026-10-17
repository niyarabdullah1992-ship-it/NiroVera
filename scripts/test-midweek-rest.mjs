/**
 * test-midweek-rest.mjs — the weekly rest is whatever the file and roster say, even mid-week (Arts 104, 107, 109):
 * annual leave never charges his rest days or official holidays; work on his usual rest weekday is the rest day worked.
 * Run: node scripts/test-midweek-rest.mjs
 */
import assert from "node:assert/strict";
import { annualDayBreakdown, chargeableAnnualWorkDays, isRestDayWork, rosterRestDows } from "../src/lib/leaveEidOverlap.js";
import { laborCalendarOf } from "../src/lib/ummAlQuraCalendar.js";

const cal = laborCalendarOf({});
const key = (d) => `2026-10-${String(d).padStart(2, "0")}`;
// Rest Tuesday + Wednesday every week; works Sun, Mon, Thu, Fri, Sat.
const worked = [];
for (let d = 4; d <= 31; d += 1) { const dow = new Date(2026, 9, d).getDay(); if (dow !== 2 && dow !== 3) worked.push(key(d)); }
const assign = Object.fromEntries(worked.map((k) => [k, { m: ["e1"] }]));
const company = { schedules: [{ stationId: "st", shiftTypes: [{ id: "m" }], assignments: assign }], personalAttendance: [] };
const emp = { id: "e1", stationId: "st", profile: { weeklyRestDayCount: 2 } };

assert.deepEqual(rosterRestDows(company, emp, key(14)), [2, 3], "his roster keeps Tuesday + Wednesday");
const b = annualDayBreakdown(key(11), key(17), cal, company, emp);
assert.equal(chargeableAnnualWorkDays(key(11), key(17), cal, company, emp), 5, "a week of leave takes his five work days only");
assert.deepEqual(b.days.map((d) => d.kind), ["charge", "charge", "law", "company", "charge", "charge", "charge"], "Tue/Wed are his rest — Fri/Sat are work days");
console.log("PASS mid-week rest is not charged to annual leave");

// He works his Tuesday too: the Tuesday is the rest day worked — not the last day of the week.
const extra = { ...company, schedules: [{ ...company.schedules[0], assignments: { ...assign, [key(13)]: { m: ["e1"] } } }] };
assert.equal(isRestDayWork(key(13), extra, emp), true, "work on his usual rest weekday is rest-day work");
assert.equal(isRestDayWork(key(17), extra, emp), false, "Saturday is an ordinary work day for him");
assert.equal(isRestDayWork(key(16), extra, emp), false, "Friday is an ordinary work day for him");
console.log("PASS mid-week rest day worked is the rest day");

// No roster: the file's count with the establishment's days (Friday statutory) — holidays never charged.
const plain = { schedules: [] };
assert.equal(chargeableAnnualWorkDays("2026-09-20", "2026-09-26", cal, plain, { id: "x", profile: { weeklyRestDayCount: 2 } }), 4, "5-day file: National Day + two rest days not charged");
assert.equal(chargeableAnnualWorkDays("2026-09-20", "2026-09-26", cal, plain, { id: "x", profile: { weeklyRestDayCount: 1 } }), 5, "6-day file: National Day + the statutory day not charged");
console.log("PASS official holidays and rest days stay out of annual leave");
