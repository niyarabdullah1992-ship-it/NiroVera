import assert from "node:assert/strict";
import { deadlineText, disciplineDeadlines, planDisciplineDeadlineNotices } from "../src/lib/disciplineDeadlines.js";

const cases = [
  { id: "s", employeeId: "e1", status: "hearing", hearingEndedAt: "2026-09-20" },
  { id: "r", employeeId: "e2", status: "appeal", signedAt: "2026-09-01", appealedAt: "2026-09-28" },
  { id: "g", employeeId: "e3", status: "notify", signedAt: "2026-10-01" },
  { id: "n", employeeId: "e1", status: "notice" },
];
const rows = disciplineDeadlines({ cases, today: "2026-10-15" });
const by = Object.fromEntries(rows.map((r) => [r.kind, r]));
assert.equal(by.sign.due, "2026-10-20");
assert.equal(by.sign.left, 5);
assert.equal(by.sign.soon, true);
assert.equal(by.ruling.due, "2026-10-13");
assert.equal(by.ruling.over, true);
assert.ok(by.grievance.left <= 30 && by.grievance.left > 0);
assert.equal(rows.length, 3, "a notice without a hearing has no clock yet");
assert.equal(rows[0].kind, "ruling", "most urgent first");
assert.match(deadlineText(by.sign, "سالم"), /باقي 5 أيام.*المادة 69/);
assert.match(deadlineText(by.ruling, "فهد"), /المحاكم العمالية/);

const data = {
  employees: [{ id: "e1", name: "سالم" }, { id: "e2", name: "فهد" }, { id: "e3", name: "نورة" }, { id: "m", name: "المدير" }],
  disciplinaryCases: cases,
};
const audienceOf = () => [{ id: "m" }];
const plans = planDisciplineDeadlineNotices({ data, today: "2026-10-15", audienceOf });
const keys = plans.map((p) => p.key);
assert.ok(keys.includes("disc-deadline:s:sign:7:m"));
assert.ok(keys.includes("disc-deadline:r:ruling:over:m"));
assert.ok(keys.includes("disc-deadline:r:court:e2"), "the worker hears the courts are open");
assert.ok(!keys.some((k) => k.includes(":g:")), "grievance not yet within 7 days");
assert.ok(plans.every((p) => p.to === "/app/discipline"));
// Idempotent: the same keys do not fire twice.
assert.equal(planDisciplineDeadlineNotices({ data, today: "2026-10-15", audienceOf, existingKeys: keys }).length, 0);
// Two days out → the second reminder.
const later = planDisciplineDeadlineNotices({ data, today: "2026-10-18", audienceOf, existingKeys: keys }).map((p) => p.key);
assert.ok(later.includes("disc-deadline:s:sign:2:m"));
// The worker's grievance window, 7 days before it closes.
const g = planDisciplineDeadlineNotices({ data, today: "2026-10-26", audienceOf, existingKeys: [] }).map((p) => p.key);
assert.ok(g.some((k) => k.startsWith("disc-deadline:g:grievance:7:e3")), g.join(","));
console.log("discipline deadlines ok");
