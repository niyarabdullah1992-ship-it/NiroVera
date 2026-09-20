import assert from "node:assert/strict";
import {
  MIN_PROOF,
  PERF_DRIVERS,
  bandOf,
  buildPerformanceReportHtml,
  countAr,
  coverPctFor,
  derivePerformanceRange,
  isoDay,
  monthsInRange,
  rangePresets,
  scoreOf,
  teamOf,
} from "../src/lib/perfRange.js";

assert.deepEqual(monthsInRange("2026-07-01", "2026-09-13"), ["2026-07", "2026-08", "2026-09"]);
assert.deepEqual(monthsInRange("2026-09-13", "2026-07-01"), []);
assert.equal(isoDay("2026-09-13"), "2026-09-13");

const presets = rangePresets("2026-09-13");
assert.equal(presets.find((row) => row.id === "q").from, "2026-07-01");
assert.equal(presets.find((row) => row.id === "m").from, "2026-09-01");
assert.equal(presets.find((row) => row.id === "pq").to, "2026-06-30");
assert.equal(presets.find((row) => row.id === "h").from, "2026-04-01");
assert.notEqual(presets.find((row) => row.id === "h").from, presets.find((row) => row.id === "q").from);

assert.equal(scoreOf({ done: 80, time: 80, safe: 100, cover: 80 }), 83);
assert.equal(bandOf(86, true), "جيد جداً");
assert.equal(bandOf(60, false), "Fair");
assert.equal(countAr(2, "شهر واحد", "شهران", "أشهر", "شهراً"), "شهران");
assert.equal(PERF_DRIVERS.reduce((sum, row) => sum + row.w, 0), 100);

assert.equal(teamOf({ jobTitle: "مشرف تشغيل" }), "supervision");
assert.equal(teamOf({ jobTitle: "أخصائية عملاء" }), "customers");
assert.equal(teamOf({ role: "employee", jobTitle: "فنّي ميداني" }), "field");
assert.equal(coverPctFor({ id: "n", coverPoints: 0 }, "2026-07-01", "2026-09-13", {
  employees: [{ id: "n" }],
  schedules: [{ assignments: { "2026-09-01": { morning: ["n"] } }, shiftTypes: [{ id: "morning" }] }],
}), 100);

const stations = [
  { id: "kh", name: "فرع الخفجي" },
  { id: "ju", name: "فرع الجبيل" },
];
const employees = [
  { id: "n", name: "نيار", stationId: "kh", jobTitle: "مشرف تشغيل" },
  { id: "o", name: "عمر", stationId: "kh", jobTitle: "فنّي ميداني" },
  { id: "t", name: "تركي", stationId: "ju", jobTitle: "أخصائي عملاء" },
];
const task = (id, ownerId, stationId, day, status = "completed") => ({
  id,
  ownerId,
  stationId,
  memberIds: [ownerId],
  status,
  approvedAt: status === "completed" ? `${day}T12:00:00` : null,
  dueAt: `${day}T17:00:00`,
  createdAt: `${day}T08:00:00`,
});
const tasks = [
  task("a1", "n", "kh", "2026-07-08"),
  task("a2", "n", "kh", "2026-07-18"),
  task("a3", "n", "kh", "2026-08-08"),
  task("a4", "n", "kh", "2026-08-18"),
  task("a5", "n", "kh", "2026-09-08"),
  { ...task("b1", "o", "kh", "2026-07-10"), dueAt: "2026-07-01T17:00:00" },
  task("b2", "o", "kh", "2026-08-10"),
  task("c1", "t", "ju", "2026-08-12"),
  task("c2", "t", "ju", "2026-09-04", "active"),
];

const view = derivePerformanceRange({
  employees,
  stations,
  data: { employees, stations, tasks, safety: [], schedules: [] },
  from: "2026-07-01",
  to: "2026-09-13",
  ar: true,
});

assert.equal(view.valid, true);
assert.equal(view.ranked[0].id, "n");
assert.equal(view.ranked[0].ok, true);
assert.ok(view.ranked[0].a.proof >= MIN_PROOF);
assert.ok(view.ranked.find((row) => row.id === "n").score > view.ranked.find((row) => row.id === "o").score);
assert.equal(view.ranked.find((row) => row.id === "o").ok, false);
assert.ok(view.eligible.every((row) => row.ok));
assert.equal(view.eligible.length, 1);
assert.equal(view.avg, view.ranked[0].score);
assert.ok(view.branchData.find((row) => row.id === "kh").score >= view.branchData.find((row) => row.id === "ju").score);

const picked = derivePerformanceRange({
  employees,
  stations,
  data: { employees, stations, tasks, safety: [], schedules: [] },
  from: "2026-07-01",
  to: "2026-09-13",
  selB: ["kh", "ju"],
  ar: true,
});
assert.equal(picked.hasGroups, true);
assert.ok(picked.groups.length >= 2);

const html = buildPerformanceReportHtml(view, { companyName: "NiroVera", ar: true });
assert.match(html, /تقرير الأداء/);
assert.match(html, /A4 landscape/);
assert.match(html, /نيار/);
assert.match(html, /احفظه PDF/);

console.log("perf range: PASS");
