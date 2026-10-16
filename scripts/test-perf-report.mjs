import assert from "node:assert/strict";
// Model regulation Arts. 18–23: five levels, the three elements, the worker's copy of the approved
// report, his grievance within 30 days and HR's written decision; the local hcm path and the server
// twin agree.
import * as fe from "../src/lib/perfReport.js";
import * as be from "../base44/shared/perfReport.ts";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };

ok("model 19: five levels on the derived score", () => {
  assert.equal(fe.PERF_LEVELS.length, 5);
  assert.equal(fe.perfLevelOf(95).key, "excellent");
  assert.equal(fe.perfLevelOf(75).key, "above");
  assert.equal(fe.perfLevelOf(74).key, "average");
  assert.equal(fe.perfLevelOf(44).key, "weak");
  assert.equal(fe.perfLevelOf("x"), null);
});

ok("model 18: competence, conduct and attendance each rated before the report is recorded", () => {
  assert.equal(fe.checkReportElementsGate({ competence: 4, conduct: 3 }).error, "REPORT_ELEMENTS_REQUIRED");
  assert.deepEqual(fe.checkReportElementsGate({ competence: "4", conduct: 3, attendance: 5 }).elements, { competence: 4, conduct: 3, attendance: 5 });
});

const cycles = [
  { id: "c1", period: "2025", from: "2025-01-01", to: "2025-12-31", status: "closed", closedAt: "2026-01-10T09:00:00Z" },
  { id: "c2", period: "2026", from: "2026-01-01", to: "2026-12-31", status: "calibration" },
];
const ratings = [
  { id: "r1", cycleId: "c1", employeeId: "e1", rating: 78, elements: { competence: 4, conduct: 4, attendance: 3 }, ratedByName: "المدير" },
  { id: "r2", cycleId: "c2", employeeId: "e1", rating: 81 },
];

ok("model 20: the copy exists only once the cycle closes (approval)", () => {
  const reports = fe.perfReportsFor({ cycles, ratings, employeeId: "e1" });
  assert.equal(reports.length, 1);
  assert.equal(reports[0].level.key, "above");
  assert.equal(reports[0].approvedAt, "2026-01-10");
  assert.equal(reports[0].grievanceBy, "2026-02-09");
});

ok("model 20 · 71: grieve within 30 days, once, with a reason; HR decides in writing", () => {
  const [report] = fe.perfReportsFor({ cycles, ratings, employeeId: "e1" });
  assert.equal(fe.checkPerfGrievanceGate({ report, reason: "التقييم أغفل المهام المنجزة في الربع الأخير", today: "2026-02-10" }).error, "REPORT_GRIEVANCE_LATE");
  assert.equal(fe.checkPerfGrievanceGate({ report, reason: "قصير", today: "2026-01-20" }).error, "REPORT_GRIEVANCE_REASON");
  const filed = fe.checkPerfGrievanceGate({ report, reason: "التقييم أغفل المهام المنجزة في الربع الأخير", today: "2026-01-20" });
  assert.equal(filed.ok, true);
  assert.equal(filed.replyBy, "2026-02-04");
  assert.equal(fe.checkPerfGrievanceGate({ report: { ...report, grievance: { filedAt: "2026-01-20" } }, reason: "x".repeat(20), today: "2026-01-21" }).error, "REPORT_GRIEVANCE_EXISTS");
  const g = { filedAt: "2026-01-20", replyBy: "2026-02-04" };
  assert.equal(fe.checkDecidePerfGrievanceGate({ grievance: g, decision: "upheld", note: "قُبل بعد مراجعة السجلات", actorId: "e1", employeeId: "e1" }).error, "GRIEVANCE_SELF");
  assert.equal(fe.checkDecidePerfGrievanceGate({ grievance: g, decision: "upheld", note: "قصير", actorId: "h1", employeeId: "e1" }).error, "GRIEVANCE_NOTE_REQUIRED");
  assert.equal(fe.checkDecidePerfGrievanceGate({ grievance: g, decision: "upheld", note: "قُبل بعد مراجعة سجل المهام", actorId: "h1", employeeId: "e1", newRating: 84 }).newRating, 84);
  assert.equal(fe.perfGrievanceState(g, "2026-02-05").stage, "overdue");
});

ok("أدائي ministry rows: report, copy and grievance window, 21–23 for reference", () => {
  const reports = fe.perfReportsFor({ cycles, ratings, employeeId: "e1" });
  const rows = fe.perfMinistryRows({ reports, hireDate: "2024-03-01", today: "2026-01-20", ar: true });
  const by = (k) => rows.find((r) => r.key === k);
  assert.equal(by("model-18").status, "settled");
  assert.equal(by("model-20").status, "waiting");
  assert.match(by("model-20").pill, /2026-02-09/);
  assert.equal(by("model-21").status, "void");
  assert.match(by("model-21").pill, /مؤهل/);
  assert.match(by("model-22").pill, /التقدير يكفي/);
  assert.equal(fe.perfMinistryRows({ reports: [], ar: true }).find((r) => r.key === "model-18").status, "void");
});

ok("server twin parity", () => {
  assert.deepEqual(be.perfReportsFor({ cycles, ratings, employeeId: "e1" }), fe.perfReportsFor({ cycles, ratings, employeeId: "e1" }));
  const [report] = fe.perfReportsFor({ cycles, ratings, employeeId: "e1" });
  for (const today of ["2026-01-20", "2026-03-01"]) {
    assert.deepEqual(be.checkPerfGrievanceGate({ report, reason: "التقييم أغفل المهام المنجزة", today }), fe.checkPerfGrievanceGate({ report, reason: "التقييم أغفل المهام المنجزة", today }));
  }
  assert.deepEqual(be.checkReportElementsGate({ competence: 2 }).error, fe.checkReportElementsGate({ competence: 2 }).error);
  assert.deepEqual(be.perfMinistryRows({ reports: [report], today: "2026-01-20" }), fe.perfMinistryRows({ reports: [report], today: "2026-01-20" }));
});

console.log(`perf report: ${n} checks passed`);
