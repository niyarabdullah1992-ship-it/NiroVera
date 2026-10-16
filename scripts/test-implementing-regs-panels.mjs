/** «أنظمة الوزارة» panels against the Implementing Regulations (decision 115921) and Annex 1 / 2:
 *  the schedule board, the contract / payroll / compliance / voice rows, and the Regs Art. 1 derivation. */
import assert from "node:assert/strict";
import { buildLawGatesBoard } from "../src/lib/lawGatesBoard.js";
import { deriveRegs1Conversion } from "../src/lib/contractLawDerivations.js";
import { contractMinistryRows } from "../src/lib/contractMinistryRows.js";
import { payrollMinistryRows } from "../src/lib/payrollMinistryRows.js";
import { complianceMinistryRows } from "../src/lib/complianceMinistryRows.js";
import { abuseLawStatus } from "../src/lib/abuseComplaint.js";
import { REGS_DECISION_AR, overtimeRegsNote } from "../src/lib/implementingRegsNotes.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };
const D = "2026-10-15";

ok("schedule board: 113 and 115 left for طلباتي; 107 carries Regs 22 / 22 bis", () => {
  const board = buildLawGatesBoard({ gates: { checks: [] }, onDate: D, ar: true });
  const arts = board.labour.rows.map((row) => row.article);
  assert.equal(arts.includes("113"), false);
  assert.equal(arts.includes("115"), false);
  const ot = board.labour.rows.find((row) => row.article === "107");
  assert.match(ot.regs, /اللائحة م22: لا يزيد الإضافي على 720 ساعة/);
  assert.match(ot.regs, /م22 مكرر/);
  assert.match(ot.regs, /60 يوماً/);
  assert.match(ot.regs, /30 يوماً/);
  assert.match(board.labour.rows.find((row) => row.article === "112").regs, /اللائحة م24/);
  assert.match(board.labour.rows.find((row) => row.article === "163").regs, /اللائحة م34/);
  assert.equal(board.labour.regsSource, REGS_DECISION_AR);
  assert.match(REGS_DECISION_AR, /115921/);
  assert.match(REGS_DECISION_AR, /70273/);
  assert.match(overtimeRegsNote(false), /720 hours/);
});

ok("Regs Art. 1: temporary/casual past 90 days converts; seasonal is outside; no start date waits", () => {
  const emp = (pattern, start, extra = {}) => ({ hireDate: start, profile: { workPattern: pattern, ...extra } });
  assert.equal(deriveRegs1Conversion({ ...emp("ordinary", "2026-01-01"), today: D }).applies, false);
  const seasonal = deriveRegs1Conversion({ ...emp("seasonal", "2026-01-01"), today: D });
  assert.equal(seasonal.applies, false);
  assert.equal(seasonal.seasonal, true);
  assert.equal(deriveRegs1Conversion({ ...emp("temporary", ""), today: D }).needsStart, true);
  const day90 = deriveRegs1Conversion({ ...emp("temporary", "2026-07-18"), today: D });
  assert.equal(day90.days, 90);
  assert.equal(day90.converts, false);
  assert.equal(day90.approaching, true);
  const day91 = deriveRegs1Conversion({ ...emp("temporary", "2026-07-17"), today: D });
  assert.equal(day91.converts, true);
  assert.equal(day91.convertsOn, "2026-10-15");
  assert.match(day91.reason, /اللائحة م1/);
  const early = deriveRegs1Conversion({ ...emp("temporary", "2026-10-01"), today: D });
  assert.equal(early.converts, false);
  assert.equal(early.approaching, false);
  const exited = deriveRegs1Conversion({ ...emp("temporary", "2026-06-01", { contractExit: { effectiveDate: "2026-07-15" } }), today: D });
  assert.equal(exited.converts, false, "counted to the exit date, not today");
});

ok("contract panel: Regs 1 / 12 derived, 13 / 20 / courts for reference", () => {
  const rows = contractMinistryRows({ hireDate: "2026-07-01", profile: { workPattern: "temporary", nationality: "مصري", contractType: "indefinite" } }, { today: D, ar: true });
  const by = (key) => rows.find((row) => row.key === key);
  assert.equal(by("regs-1").status, "alert");
  assert.equal(by("regs-12").status, "alert");
  assert.equal(by("regs-12").pill, "مسجّل غير محدد المدة");
  ["regs-13", "regs-20", "regs-courts"].forEach((key) => assert.equal(by(key).status, "void"));
  assert.equal(by("model-57"), undefined, "model 57 reads in the end-of-service panel");
  const fixed = contractMinistryRows({ profile: { nationality: "مصري", contractType: "fixed" } }, { today: D });
  assert.equal(fixed.find((row) => row.key === "regs-12").status, "settled");
});

ok("payroll panel: self view leaves payday and the cap to «حقوق راتبي»; manage reads them", () => {
  const self = payrollMinistryRows({ lines: [], self: true, ar: true, onDate: D }).map((row) => row.key);
  assert.equal(self.includes("labour-90"), false);
  assert.equal(self.includes("labour-92"), false);
  assert.ok(["labour-107", "regs-24", "regs-25", "regs-26", "labour-84", "model-1"].every((key) => self.includes(key)));
  const manage = payrollMinistryRows({ lines: [], pay: null, overdue: null, ar: true, onDate: D });
  assert.equal(manage.find((row) => row.key === "labour-90").status, "waiting");
  const late = payrollMinistryRows({ lines: [], pay: { due: "2026-10-01" }, overdue: { overdue: true }, ar: true, onDate: D });
  assert.equal(late.find((row) => row.key === "labour-90").status, "alert");
  assert.match(manage.find((row) => row.key === "labour-107").note, /اللائحة م22/);
});

ok("compliance panel: held documents are a violation; Qiwa articles one reference line", () => {
  const data = { employees: [{ id: "e1", name: "سالم", status: "active", profile: { nationality: "مصري", heldDocuments: [{ kind: "passport", heldSince: "2026-09-01" }] } }] };
  const rows = complianceMinistryRows(data, { today: D, ar: true });
  assert.equal(rows.find((row) => row.key === "regs-6").status, "violation");
  assert.equal(rows.find((row) => row.key === "regs-5").status, "alert");
  const clean = complianceMinistryRows({ employees: [] }, { today: D, ar: true });
  assert.equal(clean.find((row) => row.key === "regs-6").status, "settled");
  const qiwa = rows.filter((row) => row.source === "qiwa");
  assert.equal(qiwa.length, 1);
  assert.match(qiwa[0].note, /م7.*م8.*م10.*م14/);
  assert.match(qiwa[0].title, /للعلم — عبر منصة قوى/);
  assert.ok(["regs-4bis", "regs-5", "regs-6", "regs-15", "regs-16"].every((key) => rows.some((row) => row.key === key)));
});

ok("voice panel: model Art. 55(2) counts the inquiry clock from the cases", () => {
  const cases = [
    { id: "a", status: "investigating", filedAt: "2026-10-01" },
    { id: "b", status: "filed", filedAt: "2026-10-14" },
    { id: "c", status: "closed", filedAt: "2026-09-01", confidential: true },
  ];
  const s = abuseLawStatus(cases, { today: D, restWeekdays: [5, 6] });
  assert.equal(s.total, 3);
  assert.equal(s.overdue, 1);
  assert.equal(s.inquiry, 1);
  assert.equal(s.decided, 1);
  assert.equal(s.exposed, 0);
});

console.log(`\n${n} implementing-regs panel checks passed`);
