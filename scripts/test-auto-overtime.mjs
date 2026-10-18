/**
 * test-auto-overtime.mjs — overtime computed and recorded automatically when a day closes
 * (autoOvertime.js → otDecisionPlan.stampActualOvertime): daily over 8 h (Art. 98), weekly over 48 h,
 * Ramadan 6 / 36 (an empty religion field counts), the weekly rest day and an official holiday in full
 * (Arts 104, 107), idempotent re-stamps, planned → actual, the week re-read, the employee's line,
 * the attendance ministry section statuses, and the server twin (base44/shared/autoOvertime.ts).
 * Run: node scripts/test-auto-overtime.mjs
 */
import assert from "node:assert/strict";
import { autoOvertimeLine, dayOvertimeFor, deriveAutoOvertimeCore, weekOrdinaryBefore } from "../src/lib/autoOvertime.js";
import { otDayStatus, restampWeekAfter, stampActualOvertime } from "../src/lib/otDecisionPlan.js";
import { buildMinistrySection, EXCLUDED_CITES } from "../src/lib/ministrySections.js";
import { ruleValue } from "../src/lib/laborRules.js";
import * as twin from "../base44/shared/autoOvertime.ts";

const SHIFT = { id: "morn", label: "صباحي", start: "07:00", end: "16:00", restMinutes: 60 };
const iso = (day, hm) => `${day}T${hm}:00+03:00`;
const company = (assign = {}, employees = [{ id: "e1", name: "عمر", stationId: "st", profile: {} }], shiftTypes = [SHIFT]) => ({
  employees,
  stations: [{ id: "st" }],
  schedules: [{ stationId: "st", shiftTypes, assignments: assign }],
  personalAttendance: [],
  otDecisions: {},
});
const on = (days, shiftId = "morn", who = ["e1"]) => Object.fromEntries(days.map((day) => [day, { [shiftId]: who }]));
const punch = (d, day, inHm, outHm, extra = {}) => {
  const row = { id: `pa_${day}`, employeeId: "e1", date: day, checkInAt: iso(day, inHm), checkOutAt: iso(day, outHm), ...extra };
  d.personalAttendance.push(row);
  return row;
};
const stamp = (d, row, employee = d.employees[0]) => stampActualOvertime(d, employee, row.date, row);
const entry = (d, day) => d.otDecisions[`e1:${day}`];
const dayH = ruleValue("hours.shift.ordinaryHours", "2026-10-11");
const weekH = ruleValue("hours.week.ordinaryMaxHours", "2026-10-11");

/* ── daily over 8 h (Art. 98) ── */
{
  const d = company(on(["2026-10-11"]));
  const row = punch(d, "2026-10-11", "07:00", "17:00"); // 10 h presence − 60 rest = 9 h
  const r = stamp(d, row);
  assert.equal(r.workedMinutes, 540);
  assert.equal(r.overtimeMinutes, 540 - dayH * 60);
  const e = entry(d, "2026-10-11");
  assert.deepEqual([e.decision, e.overtimeMinutes, e.kind, e.source, e.workedProven, e.auto], ["pending", 60, "beyond_day_cap", "actual_punch", true, true]);
  assert.equal(row.overtimeMinutes, 60, "the attendance row carries it too");
  assert.equal(autoOvertimeLine(e, { onDate: "2026-10-11" }).textAr, "إضافي اليوم 1:00 — سُجّل تلقائياً (المادة 107) · بانتظار قرار الأجر/الإجازة");
  const before = JSON.stringify(d.otDecisions);
  stamp(d, row);
  stamp(d, row);
  assert.equal(JSON.stringify(d.otDecisions), before, "idempotent — the same punches, the same entry (and its time)");
  assert.equal(Object.keys(d.otDecisions).length, 1, "no second record");
  const short = punch(company(on(["2026-10-12"])), "2026-10-12", "07:00", "16:00");
  const d2 = company(on(["2026-10-12"]));
  d2.personalAttendance.push(short);
  stamp(d2, short);
  assert.equal(entry(d2, "2026-10-12"), undefined, "8 h exactly — no overtime, no entry");
}
console.log("PASS daily over 8 h → pending entry, idempotent");

/* ── weekly over 48 h (Art. 98, weekly criterion) ── */
{
  const LONG = { id: "long", label: "طويل", start: "07:00", end: "17:30", restMinutes: 30 }; // 10 h worked
  const days = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];
  const emp = { id: "e1", name: "عمر", stationId: "st", profile: { hoursBasis: "weekly" } };
  const d = company(on(days, "long"), [emp], [LONG]);
  const rows = days.map((day) => punch(d, day, "07:00", "17:30"));
  rows.forEach((row) => stamp(d, row, emp));
  assert.equal(entry(d, "2026-10-14"), undefined, "40 h by Wednesday — under the cap");
  const thu = entry(d, "2026-10-15");
  assert.equal(thu.overtimeMinutes, 5 * 600 - weekH * 60, "the fifth day carries the week past 48 h");
  assert.equal(thu.kind, "beyond_week_cap");
  assert.equal(thu.weekMinutes, 120);
  assert.equal(weekOrdinaryBefore(d, emp, "2026-10-15"), 2400);
  // An earlier day corrected shorter: the week is re-read, the later day follows.
  d.personalAttendance[0].checkOutAt = iso("2026-10-11", "15:30");
  stamp(d, d.personalAttendance[0], emp);
  assert.deepEqual(restampWeekAfter(d, emp, "2026-10-11"), ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"]);
  assert.equal(entry(d, "2026-10-15"), undefined, "Monday's 2 h less — Thursday's week overtime is taken back");
}
console.log("PASS weekly over 48 h, re-read when an earlier day changes");

/* ── Ramadan 6 h / 36 h — an empty religion field counts; a recorded non-Muslim does not ── */
{
  const R = "2026-03-01";
  const RSHIFT = { id: "ram", label: "رمضان", start: "09:00", end: "15:30", restMinutes: 30 };
  const d = company(on([R], "ram"), [{ id: "e1", name: "عمر", stationId: "st", profile: {} }], [RSHIFT]);
  const row = punch(d, R, "09:00", "16:30"); // 7.5 − 0.5 = 7 h
  stamp(d, row);
  assert.equal(entry(d, R).overtimeMinutes, 420 - ruleValue("hours.ramadan.ordinaryHours", R) * 60, "beyond 6 h in Ramadan");
  const d2 = company(on([R], "ram"), [{ id: "e1", name: "عمر", stationId: "st", profile: { religion: "غير مسلم" } }], [RSHIFT]);
  const row2 = punch(d2, R, "09:00", "16:30");
  stamp(d2, row2);
  assert.equal(entry(d2, R), undefined, "a recorded non-Muslim keeps 8 h");
  const core = deriveAutoOvertimeCore({ workedMinutes: 360, dayOvertimeMinutes: 0, weekPriorOrdinaryMinutes: 33 * 60, weekCapMinutes: ruleValue("hours.ramadan.weekMaxHours", R) * 60 });
  assert.deepEqual([core.weekMinutes, core.kind], [180, "beyond_week_cap"], "the Ramadan week of 36 h");
}
console.log("PASS Ramadan 6 / 36 (empty religion = Muslim)");

/* ── the weekly rest day and an official holiday: all of it (Arts 104, 107) ── */
{
  // The file is the criterion (Arts 104, 107): a five-day file (statutory + company day) works five days;
  // the 6th worked day of the week is a rest day worked — whatever weekday it falls on.
  const WEEK5 = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];
  const FRI = "2026-10-16";
  const d = company(on([...WEEK5, FRI]));
  stamp(d, punch(d, FRI, "07:00", "11:00"));
  assert.deepEqual([entry(d, FRI).overtimeMinutes, entry(d, FRI).kind], [240, "weekly_rest"], "rostered on a rest day — every minute");
  const lone = company(on([FRI]));
  stamp(lone, punch(lone, FRI, "07:00", "11:00"));
  assert.equal(entry(lone, FRI), undefined, "a lone Friday shift is not rest-day work — the week still holds its rest days");
  const six = company(on([...WEEK5, FRI]), [{ id: "e1", name: "عمر", stationId: "st", profile: { weeklyRestDayCount: 1 } }]);
  stamp(six, punch(six, FRI, "07:00", "11:00"));
  assert.equal(entry(six, FRI), undefined, "a six-day file (statutory day only): the 6th day is an ordinary work day");
  const SAT = "2026-10-17";
  const d2 = company(on(WEEK5));
  stamp(d2, punch(d2, SAT, "08:00", "10:00"));
  assert.deepEqual([entry(d2, SAT).overtimeMinutes, entry(d2, SAT).kind], [120, "weekly_rest"], "unrostered 6th day — every minute");
  const pinned = company({}, [{ id: "e1", name: "عمر", stationId: "st", profile: { weeklyOffDows: [5] } }]);
  stamp(pinned, punch(pinned, FRI, "08:00", "10:00"));
  assert.equal(entry(pinned, FRI)?.kind, "weekly_rest", "HR pinned Friday on the file — the weekday decides");
  const HOL = "2026-09-23";
  const d3 = company(on([HOL]));
  stamp(d3, punch(d3, HOL, "07:00", "12:00"));
  assert.deepEqual([entry(d3, HOL).overtimeMinutes, entry(d3, HOL).kind, entry(d3, HOL).holiday], [300, "holiday", true], "National Day — all of it (5 h, no rest due)");
}
console.log("PASS rest day and official holiday — all overtime");

/* ── planned → actual: a roster entry stays «planned» until worked, then converts ── */
{
  const HOL = "2026-09-23";
  const d = company(on([HOL]));
  d.otDecisions[`e1:${HOL}`] = { decision: "pending", holiday: true, kind: "holiday", source: "holiday_work", overtimeMinutes: 480, plannedMinutes: 480 };
  assert.equal(otDayStatus(entry(d, HOL), HOL, "2026-09-20").planned, true, "planned from the roster");
  stamp(d, punch(d, HOL, "07:00", "14:00"));
  const e = entry(d, HOL);
  assert.deepEqual([e.source, e.workedProven, e.overtimeMinutes, e.plannedMinutes], ["actual_punch", true, 360, 480], "converted to actual; the plan kept for reference");
  assert.equal(otDayStatus(e, HOL, "2026-09-20").planned, false);
  assert.equal(otDayStatus(e, HOL, "2026-09-20").payable, true);
  const decided = company(on(["2026-10-11"]));
  decided.otDecisions["e1:2026-10-11"] = { decision: "approve", overtimeMinutes: 60, source: "actual_punch", workedProven: true };
  stamp(decided, punch(decided, "2026-10-11", "07:00", "17:00"));
  assert.equal(decided.otDecisions["e1:2026-10-11"].decision, "approve", "a decided entry is never rewritten");
}
console.log("PASS planned → actual, decided entries kept");

/* ── «أنظمة الوزارة — ما يخص البصمة»: statuses from the person's own data ── */
{
  const T = "2026-10-15";
  const days = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];
  const d = company(on(days));
  days.forEach((day) => stamp(d, punch(d, day, "07:00", "17:00")));
  const sec = buildMinistrySection("attendance", { lane: "employee", ar: true, today: T, data: d, employee: d.employees[0] });
  const row = (key) => sec.rows.find((r) => r.key === key);
  assert.equal(sec.title, "أنظمة الوزارة — ما يخص البصمة");
  assert.deepEqual([row("labour-98").level, row("labour-98").pill], ["met", "هذا الأسبوع 45/48 ساعة"]);
  assert.equal(row("labour-101").level, "met");
  assert.equal(row("labour-104").level, "met");
  assert.equal(row("labour-107").pill, "5 بانتظار قرار الأجر/الإجازة");
  assert.equal(row("regs-22").pill, "هذا العام 5/720 ساعة");
  assert.equal(row("18632-night").level, "info", "night: for reference on the employee lane");
  assert.ok(sec.cards.map((c) => c.key).join() === "labour,regs,18632,3337", "one card per instrument");
  assert.ok(!sec.rows.some((r) => (r.cites || []).some((c) => EXCLUDED_CITES.includes(`${c.source}:${c.article}`))), "excluded cites stay out");
  assert.equal(new Set(sec.rows.map((r) => r.key)).size, sec.rows.length, "no duplicated rows");
  // A proven breach → تنبيه.
  d.personalAttendance[1].actualFlags = ["ACTUAL_NO_BREAK"];
  const breached = buildMinistrySection("attendance", { lane: "employee", ar: true, today: T, data: d, employee: d.employees[0] });
  assert.deepEqual([breached.rows.find((r) => r.key === "labour-101").level, breached.rows.find((r) => r.key === "labour-101").pill], ["alert", "خرق هذا الأسبوع: 1 يوم"]);
  // Pending cap consent → تنبيه for the worker.
  d.otDecisions["e1:2026-10-11"].decision = "pending_worker_cap_consent";
  assert.equal(buildMinistrySection("attendance", { lane: "employee", ar: true, today: T, data: d, employee: d.employees[0] }).rows.find((r) => r.key === "regs-22").level, "alert");
  // Management: the scope's sum.
  const mg = buildMinistrySection("attendance", { lane: "manage", ar: true, today: T, data: d, people: d.employees });
  assert.equal(mg.title, "أنظمة الوزارة — ما يخص الحضور");
  assert.deepEqual([mg.rows.find((r) => r.key === "labour-107").level, mg.rows.find((r) => r.key === "labour-107").pill], ["alert", "1 ملفاً"], "open decisions wait for the manager");
  assert.ok(!mg.rows.some((r) => r.key === "prayer-times"), "prayer times: the employee lane only");
  // Art. 103 — continuous work: the 101 rule reads for reference.
  const c = { ...d, hoursPolicy: { continuousWork103: true } };
  const cont = buildMinistrySection("attendance", { lane: "employee", ar: true, today: T, data: c, employee: d.employees[0] });
  assert.deepEqual([cont.rows.find((r) => r.key === "labour-101").level, cont.rows.find((r) => r.key === "labour-103").level], ["info", "met"]);
}
console.log("PASS attendance ministry section — مستوفٍ / تنبيه / للعلم from the person's data");

/* ── the server twin agrees ── */
{
  const grid = [];
  for (const worked of [0, 300, 480, 540, 600]) for (const day of [0, 60]) for (const prior of [0, 2400, 2800, 2880]) for (const flags of [{}, { holiday: true }, { restDay: true }]) {
    grid.push({ workedMinutes: worked, dayOvertimeMinutes: day, weekPriorOrdinaryMinutes: prior, weekCapMinutes: 2880, ...flags });
  }
  for (const input of grid) assert.deepEqual(twin.deriveAutoOvertimeCore(input), deriveAutoOvertimeCore(input), JSON.stringify(input));
  const days = ["2026-10-11", "2026-10-12", "2026-10-13"];
  const d = company(on(days));
  days.forEach((day) => punch(d, day, "07:00", "17:00"));
  const shiftOn = (key) => (days.includes(key) ? SHIFT : null);
  assert.equal(twin.weekOrdinaryBeforeCore({ rows: d.personalAttendance, dayKey: "2026-10-13", shiftOn, company: d, employee: d.employees[0] }), weekOrdinaryBefore(d, d.employees[0], "2026-10-13"));
  const client = dayOvertimeFor(d, d.employees[0], "2026-10-13", d.personalAttendance[2]);
  const server = twin.readDayOvertimeCore({ row: d.personalAttendance[2], dayKey: "2026-10-13", shift: SHIFT, company: d, employee: d.employees[0], weekPriorOrdinaryMinutes: weekOrdinaryBefore(d, d.employees[0], "2026-10-13") }).auto;
  assert.deepEqual([server.overtimeMinutes, server.kind, server.weekMinutes], [client.overtimeMinutes, client.kind, client.weekMinutes]);
  const fri = company(on(["2026-10-16"]));
  const fr = punch(fri, "2026-10-16", "07:00", "11:00");
  assert.equal(twin.readDayOvertimeCore({ row: fr, dayKey: "2026-10-16", shift: SHIFT, company: fri }).auto.kind, dayOvertimeFor(fri, fri.employees[0], "2026-10-16", fr).kind, "rest day on both");
  assert.equal(twin.weekKeysOf("2026-10-15")[0], "2026-10-11", "Sunday-first week on both");
  // The rest-day count reads the week's worked days on the server too (weekWorkedKeys from its rows + roster).
  const wk = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"];
  assert.equal(twin.readDayOvertimeCore({ row: fr, dayKey: "2026-10-16", shift: SHIFT, weekWorkedKeys: wk }).auto.kind, "weekly_rest", "server: 6th worked day of a five-day week");
  assert.notEqual(twin.readDayOvertimeCore({ row: fr, dayKey: "2026-10-16", shift: SHIFT, weekWorkedKeys: ["2026-10-16"] }).auto.kind, "weekly_rest", "server: a lone Friday is not rest-day work");
}
console.log("PASS server twin parity");
console.log("ALL PASS test-auto-overtime");
