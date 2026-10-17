/**
 * One source of truth for a person's month: the employee's «شهري» line (myDutyDay → monthTotals),
 * the operational calendar's day records (deriveDayRecord), «حصيلة الشهر» (sum of day records)
 * and «مقارنة الموظفين» (empStats) must give the same absence / lateness / attendance.
 *
 * Fixture is preview-shaped (Oct 2026, فرع الخفجي): the published roster has نيار on night shifts,
 * عمر ناصر is not assigned on 1–15 and is on the 16th (today). seedPreviewAttendanceHistory fills
 * the punches exactly as the preview does. Absence = an assigned published shift, no punch, no
 * approved leave, not a holiday (Art. 80 counting) — a published day you are not on is rest.
 */
import assert from "node:assert/strict";
import { register } from "node:module";

// Lib files import "@/lib/…" (the Vite alias); resolve it to src/ for node.
register(`data:text/javascript,${encodeURIComponent(`
const SRC = ${JSON.stringify(new URL("../src/", import.meta.url).href)};
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) {
    let url = SRC + spec.slice(2);
    if (!/\\.[cm]?jsx?$/.test(url)) url += ".js";
    return next(url, ctx);
  }
  return next(spec, ctx);
}`)}`);

const { isoDay, monthTotals, myDutyDay, rowsByDateKey, dutyPersonState } = await import("../src/lib/dutyDay.js");
const { deriveDayRecord, empStats } = await import("../src/lib/operationalCalendar.js");
const { seedPreviewAttendanceHistory } = await import("../src/lib/previewMigrations.js");

const STATION = "st_north_preview";
const OMAR = "emp_field_preview";
const NIYAR = "emp_owner_preview";
const HASSAN = "emp_hassan_preview";
const SARA = "emp_sara_fixture";
const TODAY = "2026-10-16";

const shiftTypes = [
  { id: "morning", label: "صباحي", start: "07:00", end: "15:00" },
  { id: "evening", label: "مسائي", start: "15:00", end: "23:00" },
  { id: "night", label: "ليلي", start: "23:00", end: "07:00" },
];
const assignments = {};
for (let d = 1; d <= 31; d += 1) {
  const key = isoDay(new Date(2026, 9, d));
  const wd = new Date(2026, 9, d).getDay();
  if (wd === 5 || wd === 6) continue;
  assignments[key] = {
    morning: [HASSAN, SARA],
    evening: d === 16 ? [OMAR] : [],
    night: [NIYAR],
  };
}
const data = {
  stations: [{ id: STATION, name: "فرع الخفجي" }],
  employees: [
    { id: NIYAR, name: "نيار عبدالله", stationId: STATION, leaveRequests: [] },
    { id: OMAR, name: "عمر ناصر", stationId: STATION, leaveRequests: [] },
    { id: HASSAN, name: "حسن العمري", stationId: STATION, leaveRequests: [] },
    // Approved leave 5–6 Oct on assigned shifts: leave, never absence.
    { id: SARA, name: "سارة", stationId: STATION, leaveRequests: [{ id: "lv", status: "approved", type: "annual", startDate: "2026-10-05", endDate: "2026-10-06" }] },
  ],
  schedules: [{ id: "sch_1", stationId: STATION, shiftTypes, assignments, publishedDays: Object.keys(assignments) }],
  personalAttendance: [],
};
seedPreviewAttendanceHistory(data, TODAY);
// حسن never punched in the preview: drop his seeded rows so he is the absent case.
data.personalAttendance = data.personalAttendance.filter((row) => row.employeeId !== HASSAN);
const rows = data.personalAttendance.map((row) => ({ ...row, employee_id: row.employeeId, check_in_at: row.checkInAt, check_out_at: row.checkOutAt, late_minutes: row.lateMinutes }));

const days = Array.from({ length: 31 }, (_, i) => new Date(2026, 9, i + 1));
const recs = days.map((date) => ({
  rec: deriveDayRecord({
    date,
    employees: data.employees,
    rows: rows.filter((row) => row.date === isoDay(date)),
    schedules: data.schedules,
    todayKey: TODAY,
    tasks: [],
    data,
    view: "team",
  }),
})).filter((item) => item.rec);
const table = empStats(recs, data.employees);
const side = recs.reduce((acc, { rec }) => ({ abs: acc.abs + rec.abs, late: acc.late + rec.late, on: acc.on + rec.on }), { abs: 0, late: 0, on: 0 });

const mineOf = (person) => {
  const byDate = rowsByDateKey(rows.filter((row) => row.employeeId === person.id));
  return days.map((date) => {
    const key = isoDay(date);
    return myDutyDay({ employee: person, data, row: byDate[key], key, todayKey: TODAY });
  });
};

let sideAbs = 0;
let sideLate = 0;
let sideOn = 0;
for (const person of data.employees) {
  const mine = mineOf(person);
  const totals = monthTotals(mine.filter((day) => day.key <= TODAY));
  const row = table.find((item) => item.id === person.id);
  assert.equal(row.abs, totals.absent, `${person.name}: comparison table absence = «شهري» absence`);
  assert.equal(row.late, totals.lateDays, `${person.name}: comparison table late days = «شهري» late days`);
  assert.equal(row.on + row.late, totals.attended, `${person.name}: comparison table attended = «شهري» attended`);
  assert.equal(row.leave, totals.leave, `${person.name}: leave agrees`);
  // Day by day: the calendar cell's person state is the «شهري» day's state.
  for (const day of mine) {
    const rec = recs.find((item) => item.rec.dateKey === day.key)?.rec;
    const inCell = rec?.people.find((p) => p.id === person.id)?.state || null;
    assert.equal(inCell, dutyPersonState(day), `${person.name} ${day.key}: cell state = my day state`);
  }
  sideAbs += totals.absent;
  sideLate += totals.lateDays;
  sideOn += totals.attended - totals.lateDays;
}
assert.deepEqual(side, { abs: sideAbs, late: sideLate, on: sideOn }, "«حصيلة الشهر» is the sum of the same person-days");

// عمر ناصر, Oct 2026: not on the roster 1–15 (rest), on it today (pending) — no absence anywhere.
const omar = monthTotals(mineOf(data.employees[1]).filter((day) => day.key <= TODAY));
assert.equal(omar.absent, 0, "a published day without my assignment is rest, not absence");
assert.equal(omar.lateMinutes, 0);
assert.equal(omar.attended, 0);
assert.equal(table.find((item) => item.id === OMAR).abs, 0);
// حسن: assigned every working day 1–15, no punch → absent in every place.
const hassan = monthTotals(mineOf(data.employees[2]).filter((day) => day.key <= TODAY));
assert.equal(hassan.absent, 11);
assert.equal(table.find((item) => item.id === HASSAN).abs, 11);
// سارة: approved leave on two assigned days — leave, not absence.
const sara = monthTotals(mineOf(data.employees[3]).filter((day) => day.key <= TODAY));
assert.equal(sara.absent, 0);
assert.equal(sara.leave, 2);

console.log("duty day agreement («شهري» = calendar cells = حصيلة الشهر = مقارنة الموظفين): PASS");
process.exit(0);
