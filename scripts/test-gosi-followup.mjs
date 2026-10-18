import assert from "node:assert/strict";
import { gosiTasks, gosiExclusionReason, monthEnd, paymentWindow } from "../src/lib/gosiFollowUp.js";

const today = "2026-10-14";
assert.equal(monthEnd("2026-02-10"), "2026-02-28");
assert.deepEqual(paymentWindow(today), { month: "2026-09", due: "2026-10-15" });
assert.equal(gosiExclusionReason({ reason: "resignation" }).ar, "استقالة");
assert.equal(gosiExclusionReason({ reason: "death", source: "work_injury" }).ar, "وفاة بسبب إصابة عمل");
assert.equal(gosiExclusionReason({ reason: "contract_end", party: "employer" }).ar, "انتهاء العقد وعدم التجديد برغبة صاحب العمل");
assert.equal(gosiExclusionReason({ reason: "force_majeure" }), null);

const employees = [
  { id: "a", name: "جديد", profile: { hireDate: "2026-10-03" } },
  { id: "b", name: "مسجّل", profile: { hireDate: "2024-01-01", gosiNumber: "123", gosiActions: { wage: { wage: 9000 } } } },
  { id: "c", name: "خارج", profile: { hireDate: "2023-01-01", gosiNumber: "9", contractExit: { reason: "resignation", effectiveDate: "2026-09-20" } } },
  { id: "d", name: "مصاب", profile: { hireDate: "2022-01-01", gosiNumber: "7" }, leaveRequests: [
    { id: "l1", type: "work_injury", status: "approved", startDate: "2026-10-01", injuryDate: "2026-10-01" },
    { id: "l2", type: "work_injury", status: "approved", startDate: "2026-10-10", injuryDate: "2026-10-01" },
  ] },
];
const tasks = gosiTasks({ employees, company: {}, today, contributory: (e) => (e.id === "b" ? 9500 : 0) });
const by = (id) => tasks.find((t) => t.id === id);
assert.equal(by("register:a").due, "2026-10-31");
assert.equal(by("register:a").done, false);
assert.equal(by("register:b").done, true);
assert.equal(by("exclude:c").due, "2026-09-30");
assert.equal(by("exclude:c").overdue, true, "exclusion past the end of the leaving month is late");
assert.equal(by("exclude:c").reason.ar, "استقالة");
assert.equal(by("wage:b").wage, 9500);
assert.equal(tasks.filter((t) => t.kind === "injury").length, 1, "one report per injury, extensions included");
assert.equal(by("injury:d:2026-10-01").due, "2026-10-11");
assert.equal(by("injury:d:2026-10-01").overdue, true);
assert.equal(by("payment:2026-09").due, "2026-10-15");
assert.equal(tasks[0].overdue, true, "late items first");
const none = gosiTasks({ employees, company: {}, today, injuryCovered: false });
assert.equal(none.filter((t) => t.kind === "injury").length, 0, "an establishment outside GOSI hazards reports nothing");
const paid = gosiTasks({ employees: [], company: { gosiPayments: { "2026-09": { at: "2026-10-05", ref: "R1" } } }, today });
assert.equal(paid[0].done, true);
console.log("gosi follow-up OK");
