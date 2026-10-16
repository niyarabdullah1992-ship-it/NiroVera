import assert from "node:assert/strict";
// One five-level scale from the task to the annual report (النموذج الموحد م18–20, م71 principle):
// the approval's quality level and its weights, the reason gates, the per-assignee override, legacy
// approvals, the period mean, the objection window and its decider, the attendance → level mapping,
// the report pre-filled from evidence, the overall-vs-elements gap, and the server twins.
import * as fe from "../src/lib/taskQuality.js";
import * as be from "../base44/shared/taskQuality.ts";
import * as pr from "../src/lib/perfReport.js";
import * as prBe from "../base44/shared/perfReport.ts";
import * as hcm from "../src/lib/hcmDerivations.js";
import * as hcmBe from "../base44/shared/hcmDerivations.ts";
import { personFacts } from "../src/lib/perfRange.js";
import { MODEL_ARTICLE_TEXTS, modelArticleText, modelArticlesBody, modelLaw } from "../src/lib/modelArticleTexts.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };

const base = { id: "t1", ref: "OPS-1", priority: "high", effortWeight: 2, assignMode: "one", ownerId: "e1", status: "awaiting_approval", targetCount: 1, completedCount: 1 };

ok("weights: 5→100% 4→90% 3→75% 2→50% 1→25%, integers, never zero", () => {
  assert.deepEqual(fe.TASK_QUALITY_WEIGHTS, { 5: 100, 4: 90, 3: 75, 2: 50, 1: 25 });
  assert.equal(fe.qualityPoints(6, 5), 6);
  assert.equal(fe.qualityPoints(6, 4), 5);
  assert.equal(fe.qualityPoints(6, 3), 5);
  assert.equal(fe.qualityPoints(6, 2), 3);
  assert.equal(fe.qualityPoints(6, 1), 2);
  assert.equal(fe.qualityPoints(1, 1), 1);
  assert.equal(fe.qualityLevel(4).ar, "فوق المتوسط");
  assert.equal(fe.qualityLevel(4).ar, pr.perfLevelByNumber(4).ar);
});

ok("approval gate: level required; reason for 1, 2 and 5 only", () => {
  assert.equal(fe.checkTaskQualityGate({}).error, "QUALITY_LEVEL_REQUIRED");
  assert.equal(fe.checkTaskQualityGate({ level: 7 }).error, "QUALITY_LEVEL_REQUIRED");
  assert.equal(fe.checkTaskQualityGate({ level: 5 }).error, "QUALITY_REASON_REQUIRED");
  assert.equal(fe.checkTaskQualityGate({ level: 2, reason: "قصير" }).error, "QUALITY_REASON_REQUIRED");
  assert.equal(fe.checkTaskQualityGate({ level: 1, reason: "أُعيد العمل مرتين" }).ok, true);
  assert.equal(fe.checkTaskQualityGate({ level: 4 }).ok, true);
  assert.equal(fe.checkTaskQualityGate({ level: "3" }).level, 3);
});

ok("per-assignee override: several assignees only, a real assignee, with its reason; same level dropped", () => {
  const ids = ["e1", "e2", "e3"];
  assert.equal(fe.checkTaskQualityGate({ level: 4, overrides: { e1: { level: 2, reason: "x".repeat(10) } }, assigneeIds: ["e1"] }).error, "QUALITY_OVERRIDE_SINGLE");
  assert.equal(fe.checkTaskQualityGate({ level: 4, overrides: { e9: { level: 2, reason: "x".repeat(10) } }, assigneeIds: ids }).error, "QUALITY_OVERRIDE_NOT_ASSIGNEE");
  assert.equal(fe.checkTaskQualityGate({ level: 4, overrides: { e2: { level: 3 } }, assigneeIds: ids }).error, "QUALITY_OVERRIDE_REASON_REQUIRED");
  const gate = fe.checkTaskQualityGate({ level: 4, overrides: { e2: { level: 3, reason: "غاب عن نصف الوردية" }, e3: { level: 4, reason: "" } }, assigneeIds: ids });
  assert.equal(gate.ok, true);
  assert.deepEqual(Object.keys(gate.overrides), ["e2"]);
  const task = fe.applyTaskQuality({ ...base, assignMode: "some", memberIds: ids }, gate, { basePoints: 6, byId: "m1", byName: "المشرف", at: "2026-10-15T08:00:00Z", recipientIds: ids });
  // Who receives does not change: all three; each gets the task's points at his own level.
  assert.deepEqual(task.quality.recipientIds, ids);
  assert.equal(fe.taskPointsFor(task, "e1"), 5);
  assert.equal(fe.taskPointsFor(task, "e2"), 5);
  assert.equal(fe.taskQualityFor(task, "e2").level, 3);
  assert.equal(fe.taskQualityFor(task, "e2").override, true);
  assert.equal(fe.taskQualityFor(task, "e1").level, 4);
  assert.equal(task.pointsAwarded, 5);
  assert.equal(task.quality.by, "m1");
  assert.equal(task.quality.weight, 90);
});

ok("recipients: owner, named members, or the station crew — the server's rule", () => {
  assert.deepEqual(fe.taskRecipientIds({ assignMode: "one", ownerId: "e1" }), ["e1"]);
  assert.deepEqual(fe.taskRecipientIds({ assignMode: "some", memberIds: ["e1", "e2", "e1"] }), ["e1", "e2"]);
  const crew = [{ employeeId: "a", stationId: "s1" }, { employeeId: "b", stationId: "s2" }];
  assert.deepEqual(fe.taskRecipientIds({ assignMode: "all", stationId: "s1" }, crew), ["a"]);
  assert.deepEqual(fe.taskRecipientIds({ assignMode: "all", stationId: "s1" }, [{ id: "c", stationId: "s1" }], (e) => e.id), ["c"]);
});

ok("legacy approvals: no level, points as granted, out of the mean", () => {
  const legacy = { ...base, status: "completed", approvedAt: "2026-03-01", pointsAwarded: 6 };
  assert.equal(fe.taskQualityFor(legacy, "e1"), null);
  assert.equal(fe.taskPointsFor(legacy, "e1"), 6);
  assert.equal(hcm.provenTaskWeight(legacy, "e1"), 6);
  const rated = fe.applyTaskQuality(base, fe.checkTaskQualityGate({ level: 2, reason: "أُعيد مرتين للإثبات" }), { basePoints: 6, at: "2026-10-01T08:00:00Z", recipientIds: ["e1"] });
  const s = fe.taskQualitySummary([legacy, rated], "e1");
  assert.equal(s.n, 1);
  assert.equal(s.legacy, 1);
  assert.equal(s.avg, 2);
  assert.match(fe.taskQualityLine(s, true), /بلا مستوى 1/);
});

ok("period mean and distribution — hcm facts, perfRange and the server twin agree", () => {
  const mk = (id, level, at) => fe.applyTaskQuality({ ...base, id, status: "completed", approvedAt: at }, fe.checkTaskQualityGate({ level, reason: "سبب واضح للمستوى" }), { basePoints: 6, at, recipientIds: ["e1"] });
  const tasks = [mk("a", 5, "2026-02-01"), mk("b", 4, "2026-02-03"), mk("c", 4, "2026-02-05"), mk("d", 3, "2026-02-09"), mk("e", 1, "2025-01-01")];
  const facts = hcm.deriveEmployeeTaskFacts({ tasks, employeeId: "e1", period: { from: "2026-01-01", to: "2026-12-31" } });
  assert.equal(facts.quality.n, 4);
  assert.equal(facts.quality.avg, 4);
  assert.deepEqual(facts.quality.dist, { 5: 1, 4: 2, 3: 1, 2: 0, 1: 0 });
  assert.equal(facts.points, 6 + 5 + 5 + 5);
  const factsBe = hcmBe.deriveEmployeeTaskFacts({ tasks, employeeId: "e1", period: { from: "2026-01-01", to: "2026-12-31" } });
  assert.deepEqual(factsBe.quality, facts.quality);
  assert.equal(factsBe.points, facts.points);
  const range = personFacts({ id: "e1", stationId: null }, "2026-01-01", "2026-12-31", { tasks });
  assert.equal(range.quality.avg, 4);
  assert.equal(be.taskQualitySummary(tasks, "e1").avg, fe.taskQualitySummary(tasks, "e1").avg);
});

ok("objection: five working days (Fri/Sat aside), once, with a reason, assignees only", () => {
  const rated = fe.applyTaskQuality(base, fe.checkTaskQualityGate({ level: 2, reason: "أُعيد مرتين للإثبات" }), { basePoints: 6, byId: "m1", byName: "م", at: "2026-10-15T08:00:00Z", recipientIds: ["e1"] });
  // Thursday 15 Oct → Sun 18, Mon 19, Tue 20, Wed 21, Thu 22.
  assert.equal(fe.qualityObjectionBy(rated), "2026-10-22");
  const why = "أنجزت المهمة كاملة بإثبات الصور قبل الموعد";
  assert.equal(fe.checkQualityObjectionGate({ task: rated, employeeId: "e9", reason: why, today: "2026-10-16" }).error, "QUALITY_OBJECTION_NOT_ASSIGNEE");
  assert.equal(fe.checkQualityObjectionGate({ task: rated, employeeId: "e1", reason: "لا", today: "2026-10-16" }).error, "QUALITY_OBJECTION_REASON");
  assert.equal(fe.checkQualityObjectionGate({ task: rated, employeeId: "e1", reason: why, today: "2026-10-23" }).error, "QUALITY_OBJECTION_LATE");
  assert.equal(fe.checkQualityObjectionGate({ task: { ...base, status: "completed" }, employeeId: "e1", reason: why, today: "2026-10-16" }).error, "QUALITY_NOT_SET");
  const g = fe.checkQualityObjectionGate({ task: rated, employeeId: "e1", reason: why, today: "2026-10-22" });
  assert.equal(g.ok, true);
  assert.equal(g.replyBy, "2026-11-06");
  const filed = fe.applyQualityObjection(rated, { employeeId: "e1", employeeName: "عمر", reason: why, at: "2026-10-22T09:00:00Z", replyBy: g.replyBy });
  assert.equal(filed.qualityObjections.length, 1);
  assert.equal(filed.comments.at(-1).kind, "quality_objection");
  assert.equal(fe.checkQualityObjectionGate({ task: filed, employeeId: "e1", reason: why, today: "2026-10-22" }).error, "QUALITY_OBJECTION_EXISTS");
  assert.equal(fe.qualityObjectionState(filed.qualityObjections[0], "2026-11-07").stage, "overdue");
  assert.deepEqual(be.checkQualityObjectionGate({ task: rated, employeeId: "e1", reason: why, today: "2026-10-23" }), fe.checkQualityObjectionGate({ task: rated, employeeId: "e1", reason: why, today: "2026-10-23" }));
});

ok("decision: the approver's superior or HR, in writing; upheld sets his level and the ledger delta", () => {
  const rated = fe.applyTaskQuality(base, fe.checkTaskQualityGate({ level: 2, reason: "أُعيد مرتين للإثبات" }), { basePoints: 6, byId: "m1", at: "2026-10-15T08:00:00Z", recipientIds: ["e1"] });
  const filed = fe.applyQualityObjection(rated, { employeeId: "e1", reason: "أنجزت المهمة كاملة بإثبات الصور", at: "2026-10-16T09:00:00Z", replyBy: "2026-11-02" });
  const id = filed.qualityObjections[0].id;
  assert.equal(fe.canDecideQualityObjection(filed, { id: "m1", role: "owner" }, {}), false);
  assert.equal(fe.canDecideQualityObjection(filed, { id: "h1", role: "hr_manager" }, {}), true);
  const chain = { employees: [{ id: "m1", role: "station_manager" }, { id: "p1", role: "pgm" }] };
  assert.equal(fe.canDecideQualityObjection(filed, { id: "p1", role: "pgm" }, chain), true);
  assert.equal(fe.canDecideQualityObjection(filed, { id: "x1", role: "employee" }, chain), false);
  const note = "راجعتُ الصور والسجل — الإنجاز مكتمل في موعده";
  assert.equal(fe.checkDecideQualityObjectionGate({ task: filed, objectionId: id, decision: "upheld", note, newLevel: 4, actorId: "m1" }).error, "QUALITY_OBJECTION_APPROVER");
  assert.equal(fe.checkDecideQualityObjectionGate({ task: filed, objectionId: id, decision: "upheld", note, newLevel: 4, actorId: "e1" }).error, "QUALITY_OBJECTION_SELF");
  assert.equal(fe.checkDecideQualityObjectionGate({ task: filed, objectionId: id, decision: "upheld", note: "قصير", newLevel: 4, actorId: "h1" }).error, "QUALITY_DECISION_NOTE");
  assert.equal(fe.checkDecideQualityObjectionGate({ task: filed, objectionId: id, decision: "upheld", note, newLevel: 2, actorId: "h1" }).error, "QUALITY_NEW_LEVEL_REQUIRED");
  const gate = fe.checkDecideQualityObjectionGate({ task: filed, objectionId: id, decision: "upheld", note, newLevel: 4, actorId: "h1" });
  assert.equal(gate.ok, true);
  const out = fe.applyQualityObjectionDecision(filed, { objectionId: id, decision: "upheld", note, newLevel: 4, byId: "h1", byName: "HR", at: "2026-10-20T10:00:00Z" });
  assert.equal(out.delta, 5 - 3);
  assert.equal(fe.taskQualityFor(out.task, "e1").level, 4);
  assert.equal(fe.taskQualityFor(out.task, "e1").source, "objection");
  assert.equal(out.task.qualityObjections[0].decision, "upheld");
  assert.equal(fe.checkDecideQualityObjectionGate({ task: out.task, objectionId: id, decision: "refused", note, actorId: "h1" }).error, "QUALITY_OBJECTION_NOT_OPEN");
  const beOut = be.applyQualityObjectionDecision(filed, { objectionId: id, decision: "upheld", note, newLevel: 4, byId: "h1", byName: "HR", at: "2026-10-20T10:00:00Z" });
  assert.deepEqual(beOut, out);
});

ok("server twin parity on the gates and the apply step", () => {
  for (const input of [{}, { level: 5 }, { level: 5, reason: "أنجز قبل الموعد بإتقان" }, { level: 3, overrides: { e2: { level: 1 } }, assigneeIds: ["e1", "e2"] }]) {
    assert.deepEqual(be.checkTaskQualityGate(input), fe.checkTaskQualityGate(input));
  }
  const gate = fe.checkTaskQualityGate({ level: 3 });
  const opts = { basePoints: 6, byId: "m", at: "2026-10-01T00:00:00Z", recipientIds: ["e1"] };
  assert.deepEqual(be.applyTaskQuality(base, gate, opts), fe.applyTaskQuality(base, gate, opts));
});

ok("attendance → level: the worse of absence and lateness decides; no schedule, no level", () => {
  assert.deepEqual(pr.ATTENDANCE_LEVEL_MAP.map((r) => r.level), [5, 4, 3, 2, 1]);
  assert.equal(pr.attendanceLevelOf({ scheduled: 0 }), null);
  assert.equal(pr.attendanceLevelOf({ scheduled: 200, attended: 200, absent: 0, lateDays: 4 }).level, 5);
  assert.equal(pr.attendanceLevelOf({ scheduled: 200, attended: 198, absent: 2, lateDays: 0 }).level, 4);
  assert.equal(pr.attendanceLevelOf({ scheduled: 200, attended: 200, absent: 0, lateDays: 18 }).level, 3);
  assert.equal(pr.attendanceLevelOf({ scheduled: 200, attended: 190, absent: 10, lateDays: 0 }).level, 2);
  assert.equal(pr.attendanceLevelOf({ scheduled: 100, attended: 90, absent: 10, lateDays: 30 }).level, 1);
  const a = pr.attendanceLevelOf({ scheduled: 230, attended: 228, absent: 2, lateDays: 5 });
  assert.equal(a.absentPct, 0.9);
  assert.equal(a.latePct, 2.2);
  assert.equal(a.level, 4);
  assert.deepEqual(prBe.attendanceLevelOf({ scheduled: 230, attended: 228, absent: 2, lateDays: 5 }), a);
});

ok("report pre-fill: competence from task levels, attendance from duty, conduct for the manager", () => {
  const p = pr.reportPrefill({ quality: { n: 34, avg: 4.2, legacy: 2 }, attendance: { scheduled: 230, attended: 228, absent: 2, lateDays: 5 }, conduct: { sanctions: 1, complaints: 0 } });
  assert.equal(p.competence.level, 4);
  assert.equal(p.competence.basis.n, 34);
  assert.equal(p.attendance.level, 4);
  assert.equal(p.conduct.level, null);
  assert.equal(p.conduct.basis.sanctions, 1);
  const none = pr.reportPrefill({});
  assert.equal(none.competence.level, null);
  assert.equal(none.attendance.level, null);
  const report = { evidence: p, elements: { competence: 4, attendance: 3, conduct: 4 }, elementReasons: { attendance: { from: 4, to: 3, reason: "تأخر متكرر في الربع الأخير" } } };
  assert.equal(pr.reportElementSource(report, "competence", true), "من 34 مهمة معتمدة بمتوسط 4.2");
  assert.match(pr.reportElementSource(report, "attendance", true), /من 230 يوم دوام مجدول: حضر 228، غياب 2، تأخر 5 · عدّله المدير من «فوق المتوسط» إلى «متوسط»/);
  assert.match(pr.reportElementSource(report, "conduct", true), /جزاءات موقّعة 1، شكاوى ثبتت 0/);
  assert.match(pr.reportElementSource({ elements: { competence: 3 } }, "competence", true), /قبل ربط العناصر بالأدلة/);
});

ok("evidence gate: a change needs its reason; overall two levels from the elements needs a justification", () => {
  const prefill = pr.reportPrefill({ quality: { n: 10, avg: 4.4 }, attendance: { scheduled: 100, attended: 100, absent: 0, lateDays: 1 } });
  const elements = { competence: 4, attendance: 5, conduct: 4 };
  assert.equal(pr.checkReportEvidenceGate({ elements, prefill, rating: 80 }).ok, true);
  assert.equal(pr.checkReportEvidenceGate({ elements: { ...elements, competence: 3 }, prefill, rating: 70 }).error, "REPORT_ELEMENT_REASON_REQUIRED");
  const changed = pr.checkReportEvidenceGate({ elements: { ...elements, competence: 3 }, prefill, reasons: { competence: "أخطاء متكررة في التقارير" }, rating: 70 });
  assert.equal(changed.ok, true);
  assert.deepEqual(changed.elementReasons.competence, { from: 4, to: 3, reason: "أخطاء متكررة في التقارير" });
  // Elements mean 4.3 vs overall «دون المتوسط» (2): a gap of 2.3.
  assert.equal(pr.checkReportEvidenceGate({ elements, prefill, rating: 50 }).error, "REPORT_OVERALL_GAP_REASON");
  const gap = pr.checkReportEvidenceGate({ elements, prefill, rating: 50, reasons: { overall: "تراجع حاد في الربع الأخير لم تعكسه العناصر" } });
  assert.equal(gap.ok, true);
  assert.equal(gap.elementReasons.overall.elementAvg, 4.3);
  assert.equal(pr.checkReportEvidenceGate({ elements: { competence: 4 }, prefill, rating: 80 }).error, "REPORT_ELEMENTS_REQUIRED");
  // Conduct has no derived level: any manager level stands without a reason.
  assert.equal(pr.checkReportEvidenceGate({ elements: { ...elements, conduct: 1 }, prefill, rating: 75 }).ok, true);
  assert.deepEqual(prBe.checkReportEvidenceGate({ elements, prefill, rating: 50 }), pr.checkReportEvidenceGate({ elements, prefill, rating: 50 }));
});

ok("ministry rows: elements from evidence, task levels, the objection policy", () => {
  const prefill = pr.reportPrefill({ quality: { n: 34, avg: 4.2 }, attendance: { scheduled: 230, attended: 228, absent: 2, lateDays: 5 } });
  const reports = [{ period: "2025", approvedAt: "2026-01-10", grievanceBy: "2026-02-09", level: pr.perfLevelByNumber(4), elements: { competence: 4, attendance: 3, conduct: 4 }, evidence: prefill, elementReasons: { attendance: { from: 4, to: 3, reason: "تأخر متكرر" } } }];
  const rows = pr.perfMinistryRows({ reports, today: "2026-01-20", quality: { n: 12, avg: 3.8 }, objections: [{ decision: null }] });
  const by = (k) => rows.find((r) => r.key === k);
  assert.equal(by("model-18-evidence").status, "settled");
  assert.match(by("model-18-evidence").pill, /عنصراً واحداً/);
  assert.match(by("model-18-evidence").sub, /من 34 مهمة معتمدة/);
  assert.match(by("model-19-tasks").pill, /متوسط 3.8 من 12/);
  assert.equal(by("model-71-task").status, "waiting");
  assert.match(by("model-71-task").badge, /سياسة المنصة/);
  const legacy = pr.perfMinistryRows({ reports: [{ ...reports[0], evidence: null }], today: "2026-01-20" });
  assert.match(legacy.find((r) => r.key === "model-18-evidence").pill, /قبل ربط العناصر/);
  assert.deepEqual(prBe.perfMinistryRows({ reports, today: "2026-01-20", quality: { n: 12, avg: 3.8 } }), pr.perfMinistryRows({ reports, today: "2026-01-20", quality: { n: 12, avg: 3.8 } }));
});

ok("Annex 1 texts: Arts. 18–23 and 71 registered as «model:N», quoted with their source", () => {
  assert.deepEqual(MODEL_ARTICLE_TEXTS.map((r) => r.article), ["18", "19", "20", "21", "22", "23", "71"]);
  assert.match(modelArticleText("model:19").ar, /مقياس من خمسة مستويات/);
  assert.match(modelArticleText("18").ar, /المقدرة على العمل، ودرجة إتقانه \(الكفاءة\)/);
  assert.match(modelArticleText("20").ar, /ويُخطر العامل بصورة من التقرير فور اعتماده/);
  assert.match(modelArticleText("71").ar, /خلال ثلاثين يوماً - عدا أيام العطل الرسمية -/);
  assert.match(modelArticleText("21").ar, /مستوى متوسط على الأقل/);
  assert.match(modelArticleText("22").ar, /مستوى فوق المتوسط على الأقل في آخر تقرير دوري/);
  assert.equal(modelArticleText("model:99"), null);
  assert.match(modelArticlesBody(["18", "19"]), /^النموذج الموحد م18 — تقارير الأداء\n/);
  assert.deepEqual(modelLaw(["18", "19"]), { label: "النموذج الموحد م18 · م19", model: ["18", "19"] });
  // No mangled PDF ligatures survive (لا written as ال…).
  for (const row of MODEL_ARTICLE_TEXTS) assert.doesNotMatch(row.ar, /الئحة|عالو|زمالئ|إلدارة|األ/);
});

const { annualReportPrefill, conductInfo, periodDutyTotals } = await import("../src/lib/perfEvidence.js");
const { monthTotals, myDutyDay } = await import("../src/lib/dutyDay.js");

ok("annual pre-fill from the shared duty-day derivation, task levels and conduct records", () => {
  const ST = "st1";
  const shiftTypes = [{ id: "morning", label: "صباحي", start: "07:00", end: "15:00" }];
  const assignments = {};
  const keys = [];
  for (let d = 1; d <= 15; d += 1) {
    const key = `2026-09-${String(d).padStart(2, "0")}`;
    const wd = new Date(`${key}T12:00:00Z`).getUTCDay();
    if (wd === 5 || wd === 6) continue;
    assignments[key] = { morning: ["e1"] };
    keys.push(key);
  }
  const employee = { id: "e1", name: "عمر", stationId: ST, leaveRequests: [] };
  const rated = (id, level, at) => fe.applyTaskQuality({ ...base, id, status: "completed", approvedAt: at }, fe.checkTaskQualityGate({ level, reason: "سبب واضح للمستوى" }), { basePoints: 6, at, recipientIds: ["e1"] });
  const data = {
    stations: [{ id: ST, name: "فرع" }],
    employees: [employee],
    schedules: [{ id: "sch", stationId: ST, shiftTypes, assignments, publishedDays: keys }],
    tasks: [rated("a", 5, "2026-09-03"), rated("b", 4, "2026-09-08"), { ...base, id: "c", status: "completed", approvedAt: "2026-09-09", pointsAwarded: 6 }],
    disciplinaryCases: [{ employeeId: "e1", signedAt: "2026-09-10", status: "closed" }, { employeeId: "e1", signedAt: "2025-01-01" }],
    abuseCases: [{ accusedId: "e1", outcome: { id: "proven", at: "2026-09-11" } }, { accusedId: "e1", outcome: { id: "not_proven", at: "2026-09-11" } }],
  };
  // Punch every scheduled day but two (absent) and arrive late on one.
  const rows = keys.filter((k, i) => i !== 2 && i !== 5).map((k, i) => ({
    employee_id: "e1", date: k, check_in_at: `${k}T07:0${i === 0 ? 9 : 0}:00`, check_out_at: `${k}T15:00:00`, late_minutes: i === 0 ? 9 : 0,
  }));
  const totals = periodDutyTotals({ employee, data, rows, from: "2026-09-01", to: "2026-09-15", todayKey: "2026-10-16" });
  const byDate = Object.fromEntries(rows.map((r) => [r.date, r]));
  const all = Array.from({ length: 15 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
  const direct = monthTotals(all.map((key) => myDutyDay({ employee, data, row: byDate[key], key, todayKey: "2026-10-16" })));
  assert.deepEqual(totals, direct, "the report reads the same duty days as «شهري»");
  assert.equal(totals.scheduled, keys.length);
  assert.equal(totals.absent, 2);
  assert.equal(totals.lateDays, 1);
  assert.deepEqual(conductInfo({ employeeId: "e1", data, from: "2026-09-01", to: "2026-09-30" }), { sanctions: 1, complaints: 1 });
  const prefill = annualReportPrefill({ employee, data, rows, from: "2026-09-01", to: "2026-09-15", todayKey: "2026-10-16" });
  assert.equal(prefill.competence.basis.n, 2);
  assert.equal(prefill.competence.basis.avg, 4.5);
  assert.equal(prefill.competence.basis.legacy, 1);
  assert.equal(prefill.competence.level, 5);
  // 2 absences of 11 scheduled = 18.2% → beyond «دون المتوسط» (6%) → ضعيف.
  assert.equal(prefill.attendance.basis.absentPct, 18.2);
  assert.equal(prefill.attendance.level, 1);
  assert.equal(prefill.conduct.level, null);
  assert.deepEqual(prefill.conduct.basis, { sanctions: 1, complaints: 1 });
});

console.log(`task quality: ${n} checks passed`);
