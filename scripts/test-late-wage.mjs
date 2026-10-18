import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// Lateness: wage for minutes not worked (wage not due), the clause by actual minutes, one fine base.
import { lateMonth } from "../src/lib/payrollLaw.js";
import { lineNet, lineWageNotDue, lineComponents, settlementStamp, SETTLEMENT_FIELDS } from "../src/lib/payrollDerivations.js";
import * as be from "../base44/shared/payrollDerivations.ts";
import { MODEL_REGULATION, lateClauseFor, lateClauseHint } from "../src/lib/workRegulation.js";

// 6,000 actual wage → 200/day → 25/hour → 0.4167/minute.
const att = [
  { employeeId: "e1", date: "2026-10-05", status: "late", lateMinutes: 10 },
  { employeeId: "e1", date: "2026-10-12", status: "late", lateMinutes: 20 },
  { employeeId: "e1", date: "2026-10-13", status: "present", lateMinutes: 0 },
  { employeeId: "e1", date: "2026-10-14", status: "absent", lateMinutes: 30 },
  { employeeId: "e1", date: "2026-10-20", status: "late", lateMinutes: 15 },
  { employeeId: "e2", date: "2026-10-05", status: "late", lateMinutes: 60 },
  { employeeId: "e1", date: "2026-11-01", status: "late", lateMinutes: 60 },
];
const late = lateMonth({ employeeId: "e1", month: "2026-10", attendance: att, monthlyWage: 6000, skipDays: ["2026-10-20"] });
assert.equal(late.minutes, 30, "own month, not absent, not a skipped (already cut) day");
assert.equal(late.days, 2);
assert.equal(late.cut, 12.5, "30 min × 200/8/60");

// It is wage not due: in the net, outside Art. 92 deductions, frozen at settlement.
const line = { base: 4000, allowances: 2000, deductions: 0, lateCut: 12.5, isSaudi: false };
assert.equal(lineWageNotDue(line), 12.5);
assert.equal(lineComponents(line).lateCut, 12.5);
const stamp = settlementStamp(line);
assert.equal(stamp.settledLateCut, 12.5);
assert.ok(SETTLEMENT_FIELDS.includes("settledLateCut"));
assert.equal(lineNet({ ...line, ...stamp, lateCut: 99 }), stamp.settledNet, "a settled line never recomputes");
assert.equal(be.lineWageNotDue(line), lineWageNotDue(line), "server twin");
assert.equal(be.lineNet(line), lineNet(line));

// Clause by actual minutes (model regulation, time 1–7).
assert.equal(lateClauseFor(12), "late15");
assert.equal(lateClauseFor(15), "late15");
assert.equal(lateClauseFor(16), "late30");
assert.equal(lateClauseFor(25, { heldUpOthers: true }), "time_4");
assert.equal(lateClauseFor(45), "time_5");
assert.equal(lateClauseFor(61), "time_7");
assert.equal(lateClauseFor(0), "");
// The punch records 15 after a 10-minute grace → 25 actual → «15–30», not «up to 15».
const hint = lateClauseHint({ regulation: MODEL_REGULATION, attendance: [{ employeeId: "e1", date: "2026-10-12", lateMinutes: 15 }], employeeId: "e1", dateKey: "2026-10-12", graceMinutes: 10, chosenClauseId: "late15" });
assert.equal(hint.actual, 25);
assert.equal(hint.suggestedId, "late30");
assert.equal(hint.mismatch, true);
assert.equal(lateClauseHint({ regulation: MODEL_REGULATION, attendance: [], employeeId: "e1", dateKey: "2026-10-12" }), null);
assert.equal(lateClauseHint({ regulation: MODEL_REGULATION, attendance: [{ employeeId: "e1", date: "2026-10-12", lateMinutes: 15 }], employeeId: "e1", dateKey: "2026-10-12", graceMinutes: 10, chosenClauseId: "late30" }).mismatch, false);

// One fine base: the payroll line uses the actual wage, as the fines register does (Art. 2).
const gen = readFileSync(new URL("../src/lib/deductionGenerators.js", import.meta.url), "utf8");
assert.match(gen, /\(Number\(item\.base\) \|\| 0\) \+ \(Number\(item\.allowances\) \|\| 0\)\) \/ 30/);
console.log("late wage · clause · fine base ok");
