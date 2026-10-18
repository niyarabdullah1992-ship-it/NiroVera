/**
 * The operational calendar reads, per person per day, the duty breaches (late return from a flex
 * break, early checkout, recorded overtime), punches that wait on a manager and pending طلباتي
 * requests — and counts them into the day record, the comparison table and the week sum.
 * The employee lane reads only the viewer's own flags.
 */
import assert from "node:assert/strict";
import { register } from "node:module";

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

const { personDayFlags, pendingRequestsOn, earlyLeaveMinutes, minutesPhrase } = await import("../src/lib/calendarDayFlags.js");
const { deriveDayRecord, empStats, sumRecs, eventGroups, CMP_KEYS } = await import("../src/lib/operationalCalendar.js");

const ST = "st_a";
const DAY = "2026-10-12"; // Monday
const TODAY = "2026-10-16";
const A = "emp_a";
const B = "emp_b";
const C = "emp_c";
const shiftTypes = [
  { id: "m", label: "صباحي", start: "08:00", end: "16:00", breakMode: "flex", flexBreak: { minutes: 60, from: "11:00", to: "14:00", minPart: 30 }, restMinutes: 60 },
];
const data = {
  stations: [{ id: ST, name: "فرع أ" }],
  employees: [
    { id: A, name: "أحمد", stationId: ST, leaveRequests: [], otherRequests: [] },
    { id: B, name: "بدر", stationId: ST, leaveRequests: [{ id: "lv1", type: "annual", status: "pending", startDate: "2026-10-12", endDate: "2026-10-13" }], otherRequests: [{ id: "mp1", type: "manual_punch", status: "pending", date: DAY }] },
    { id: C, name: "جود", stationId: ST, leaveRequests: [], otherRequests: [] },
  ],
  schedules: [{ id: "s", stationId: ST, shiftTypes, assignments: { [DAY]: { m: [A, B, C] } }, publishedDays: [DAY] }],
  otDecisions: { [`${C}:${DAY}`]: { decision: "pending", overtimeMinutes: 45, source: "actual_punch" } },
};
const at = (hm) => `${DAY}T${hm}:00+03:00`;
const rows = [
  // أحمد: 90-minute break on a 60-minute flex break, early checkout at 15:20.
  { employee_id: A, date: DAY, check_in_at: at("08:00"), check_out_at: at("15:20"), early_checkout: true, breaks: [{ start: at("12:00"), end: at("13:30") }] },
  // بدر: punched outside the range, no checkout on a past day.
  { employee_id: B, date: DAY, check_in_at: at("08:05"), location_status: "outside" },
  // جود: stayed late — 45 minutes recorded overtime, decision open.
  { employee_id: C, date: DAY, check_in_at: at("08:00"), check_out_at: at("16:45"), overtimeMinutes: 45 },
];

// ── the person reading ──
const a = personDayFlags({ employee: data.employees[0], row: rows[0], data, dateKey: DAY, todayKey: TODAY });
assert.equal(a.lateReturn, 30, "90 of 60 minutes → 30 minutes late return");
assert.equal(a.early, 40, "15:20 against 16:00 → 40 minutes early");
assert.deepEqual(a.awaiting, ["late_return"], "an unreviewed late return waits on the manager");

const b = personDayFlags({ employee: data.employees[1], row: rows[1], data, dateKey: DAY, todayKey: TODAY });
assert.deepEqual(b.awaiting.sort(), ["missing", "outside"], "outside + forgotten checkout wait");
assert.equal(b.pending.length, 2, "pending leave covering the day + the manual punch request");
assert.deepEqual(b.pending.map((p) => p.kind).sort(), ["leave", "punch"]);

const c = personDayFlags({ employee: data.employees[2], row: rows[2], data, dateKey: DAY, todayKey: TODAY });
assert.equal(c.overtime, 45);
assert.deepEqual(c.awaiting, ["ot"], "an open overtime decision waits");

// An excused late return is not a breach and does not wait.
const excused = personDayFlags({
  employee: data.employees[0],
  row: { ...rows[0], early_checkout: false, breaks: [{ start: at("12:00"), end: at("13:30"), review: { decision: "excused" } }] },
  data, dateKey: DAY, todayKey: TODAY,
});
assert.equal(excused.lateReturn, 0);
assert.equal(excused.lateReturnExcused, true);
assert.deepEqual(excused.awaiting, []);

// Pending leave reaches the next day too; nothing on a day it does not cover.
assert.equal(pendingRequestsOn(data.employees[1], "2026-10-13").length, 1);
assert.equal(pendingRequestsOn(data.employees[1], "2026-10-14").length, 0);
assert.equal(earlyLeaveMinutes({ end: "16:00" }, at("16:05")), 0, "after the end is not early");
assert.equal(minutesPhrase(75), "ساعة و15 دقيقة");

// ── the day record (management lane) ──
const rec = deriveDayRecord({ date: new Date(2026, 9, 12), employees: data.employees, rows, schedules: data.schedules, todayKey: TODAY, data, view: "team", flagsFor: "all" });
assert.equal(rec.lateReturn, 1);
assert.equal(rec.early, 1);
assert.equal(rec.ot, 1);
assert.equal(rec.otMinutes, 45);
assert.equal(rec.awaiting, 4, "late return + outside + missing + overtime");
assert.equal(rec.pending, 2);

// Day events name the people, each row links to where it is decided.
const groups = eventGroups(rec, true, { id: "mgr" }, { manage: true });
const titles = groups.map((g) => g.title);
assert.ok(titles.includes("مخالفات الدوام والإضافي"));
assert.ok(titles.includes("بصمات بانتظار القرار"));
assert.ok(titles.includes("طلبات معلّقة لهذا اليوم"));
assert.ok(groups.find((g) => g.title === "طلبات معلّقة لهذا اليوم").rows.every((r) => r.to === "/app/requests/manage"));

// ── comparison on the picked day ──
assert.ok(["viol", "ot", "wait"].every((k) => CMP_KEYS.includes(k)));
const table = Object.fromEntries(empStats([{ rec }], data.employees).map((row) => [row.id, row]));
assert.equal(table[A].viol, 2, "late return + early leave");
assert.equal(table[B].wait, 4, "two waiting punches + two pending requests");
assert.equal(table[C].ot, 45);

// ── week sum ──
const week = sumRecs([{ rec }, { rec: null }, { rec }]);
assert.equal(week.lateReturn + week.early, 4);
assert.equal(week.pending, 4);

// ── employee lane: only my own flags ──
const mine = deriveDayRecord({ date: new Date(2026, 9, 12), employees: data.employees, rows, schedules: data.schedules, todayKey: TODAY, data, view: "team", currentUser: { id: A }, flagsFor: "self" });
assert.deepEqual(mine.flagged.map((p) => p.id), [A], "colleagues' requests and decisions stay theirs");
assert.equal(mine.pending, 0);
const mineGroups = eventGroups(mine, true, { id: A }, { manage: false });
assert.ok(mineGroups.flatMap((g) => g.rows).filter((r) => r.to).every((r) => !String(r.to).includes("manage")));

console.log("calendar day flags: ok");
