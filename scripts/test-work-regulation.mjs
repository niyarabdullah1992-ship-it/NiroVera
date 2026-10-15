import assert from "node:assert/strict";
import {
  MODEL_REGULATION, checkRegulationDraft, compareToRegulation, parseRegulationStep,
  regulationOf, regulationRef, regulationRepeat, regulationStepFor, regulationStepLabel,
} from "../src/lib/workRegulation.js";
import { checkListedPenaltyGate, deriveRaiseDisciplineChips, listedPenaltyLabel } from "../src/lib/disciplineDerivations.js";

// Reading the cells.
assert.deepEqual(parseRegulationStep("إنذار كتابي"), { ok: true, kind: "warning", days: 0 });
assert.deepEqual(parseRegulationStep("10%"), { ok: true, kind: "fine", days: 0.1 });
assert.deepEqual(parseRegulationStep("٢٥٪"), { ok: true, kind: "fine", days: 0.25 });
assert.deepEqual(parseRegulationStep("يوم"), { ok: true, kind: "fine", days: 1 });
assert.deepEqual(parseRegulationStep("يومان"), { ok: true, kind: "fine", days: 2 });
assert.deepEqual(parseRegulationStep("حسم يومين"), { ok: true, kind: "fine", days: 2 });
assert.deepEqual(parseRegulationStep("3 أيام"), { ok: true, kind: "fine", days: 3 });
assert.equal(parseRegulationStep("فصل مع المكافأة").kind, "dismiss");
assert.equal(parseRegulationStep("7 أيام").ok, false, "over the Art. 70 five-day cap");
assert.equal(parseRegulationStep("خصم مزاجي").ok, false);
assert.equal(regulationStepLabel(parseRegulationStep("10%")), "غرامة 10% من أجر يوم");
for (const c of MODEL_REGULATION.clauses) for (const s of c.steps) assert.ok(parseRegulationStep(s).ok, `model cell reads: ${s}`);

// Model until the company records its own.
assert.equal(regulationOf({}).source, "model");
const own = regulationOf({ workRegulation: { approvalNo: "77", approvedAt: "2026-01-10", clauses: [{ id: "late", ar: "التأخر", steps: ["إنذار كتابي", "10%", "يوم", "يومان"] }] } });
assert.equal(own.source, "own");
assert.match(regulationRef(own, own.clauses[0]), /البند 1 من لائحة تنظيم العمل المعتمدة رقم 77 بتاريخ 10 يناير 2026/);
assert.match(regulationRef(MODEL_REGULATION, MODEL_REGULATION.clauses[1]), /البند 2 من النموذج الاسترشادي/);

// Draft checks.
assert.ok(checkRegulationDraft({ approvalNo: "", approvedAt: "", clauses: [] }).length >= 3);
assert.deepEqual(checkRegulationDraft({ approvalNo: "77", approvedAt: "2026-01-10", clauses: own.clauses }), []);
assert.ok(checkRegulationDraft({ approvalNo: "77", approvedAt: "2026-01-10", clauses: [{ id: "x", ar: "غياب", steps: ["9 أيام"] }] }).some((e) => /المادة 70/.test(e)));

// Art. 68 — repeats chain while each is within 180 days; a lapse resets to the first time.
const cases = [
  { id: "a", employeeId: "e1", regulationClauseId: "late", signedAt: "2026-06-01" },
  { id: "b", employeeId: "e1", regulationClauseId: "late", signedAt: "2026-09-01" },
  { id: "v", employeeId: "e1", regulationClauseId: "late", signedAt: "2026-09-20", rulingOutcome: "void" },
  { id: "o", employeeId: "e2", regulationClauseId: "late", signedAt: "2026-09-01" },
];
assert.equal(regulationRepeat({ cases, employeeId: "e1", clauseId: "late", today: "2026-10-15" }).time, 3);
assert.equal(regulationRepeat({ cases, employeeId: "e1", clauseId: "late", today: "2027-04-01" }).time, 1, "over 180 days since the last");
const r = regulationRepeat({ cases: [{ id: "a", employeeId: "e1", regulationClauseId: "late", signedAt: "2026-01-01" }, cases[1]], employeeId: "e1", clauseId: "late", today: "2026-10-15" });
assert.equal(r.time, 2, "the older one is more than 180 days before the next");
const at = regulationStepFor({ regulation: own, clauseId: "late", cases, employeeId: "e1", today: "2026-10-15" });
assert.equal(at.time, 3);
assert.equal(at.step.kind, "fine");
assert.equal(at.step.days, 1);
assert.equal(at.timeLabel, "المرة الثالثة");

// Comparing the chosen penalty to the clause.
assert.equal(compareToRegulation("fine", 1, at.step), "same");
assert.equal(compareToRegulation("fine", 3, at.step), "harsher");
assert.equal(compareToRegulation("warning", 0, at.step), "lighter");
assert.equal(compareToRegulation("suspend", 1, at.step), "harsher");

// A share of a day is a listed fine (Art. 66/2) and reads as such.
assert.equal(listedPenaltyLabel("fine", 0.1, true), "غرامة 10% من أجر يوم");
assert.equal(checkListedPenaltyGate({ penaltyKind: "fine", cutDays: 0.1 }, "2026-10-15").ok, true);
assert.equal(checkListedPenaltyGate({ penaltyKind: "suspend", cutDays: 0.5 }, "2026-10-15").ok, false);

// The Art. 67 chip at raising.
const employee = { id: "e1", name: "سالم", stationId: "s1" };
const chip = (extra) => deriveRaiseDisciplineChips({ employee, note: "تأخر صباح الأحد", today: "2026-10-15", discoveredAt: "2026-10-14", cases, ar: true, ...extra }).find((c) => c.key === "67");
assert.equal(chip({ penaltyKind: "fine", cutDays: 1 }).state, "pass", "no regulation passed in → old behaviour");
assert.equal(chip({ penaltyKind: "fine", cutDays: 1, regulation: own }).state, "fail", "own regulation needs a clause");
assert.equal(chip({ penaltyKind: "fine", cutDays: 1, regulation: MODEL_REGULATION }).state, "warn", "model only warns");
assert.equal(chip({ penaltyKind: "fine", cutDays: 1, regulation: own, clauseId: "late" }).state, "pass");
assert.equal(chip({ penaltyKind: "fine", cutDays: 3, regulation: own, clauseId: "late" }).state, "fail", "harsher than the clause");
assert.equal(chip({ penaltyKind: "warning", cutDays: 0, regulation: own, clauseId: "late" }).state, "warn", "lighter is allowed");
assert.match(chip({ penaltyKind: "fine", cutDays: 1, regulation: own, clauseId: "late" }).text, /المرة الثالثة/);
console.log("work regulation ok");
