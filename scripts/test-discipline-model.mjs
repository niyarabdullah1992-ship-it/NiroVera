import assert from "node:assert/strict";
// Model regulation in الجزاءات: Arts. 47–48 for reference, Art. 53 uniform rules (set, announced,
// acknowledged — and the raise gate), Art. 69 penalties record with Art. 61 and the eraseDays fold.
import * as fe from "../src/lib/uniformPolicy.js";
import * as be from "../base44/shared/uniformPolicy.ts";
import { mergeWorkRegulationWrite, redactRegulationAcks } from "../base44/shared/syncLaw.ts";
import { penaltiesRecordRows, sanctionRecordState } from "../src/lib/penaltiesRecord.js";
import { disciplineModelRows } from "../src/lib/disciplineModelRows.js";
import { ruleValue } from "../src/lib/laborRules.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };

const rules = { rules: "زي العمل الموحد بالموقع: قميص المنشأة وبنطال داكن وحذاء سلامة، والعاملات بعباءة ساترة غير شفافة.", sanctions: "البند 16 من مخالفات السلوك", criteria: { sharia: true, professional: true, modest: true } };
const saved = { ...rules, version: "2026-10-01T08:00:00", savedAt: "2026-10-01T08:00:00" };
const announced = { ...saved, announcedAt: "2026-10-02" };
const acked = { ...announced, acks: { e1: { at: "2026-10-03T08:00:00Z", version: "2026-10-01T08:00:00" } } };

ok("model 53(1): rules, the three criteria and the penalties before saving", () => {
  assert.equal(fe.checkSaveUniformGate({ ...rules, rules: "قصير" }).error, "UNIFORM_RULES_REQUIRED");
  assert.equal(fe.checkSaveUniformGate({ ...rules, criteria: { sharia: true } }).error, "UNIFORM_CRITERIA");
  assert.equal(fe.checkSaveUniformGate({ ...rules, sanctions: "" }).error, "UNIFORM_SANCTIONS_REQUIRED");
  assert.equal(fe.checkSaveUniformGate(rules).ok, true);
});

ok("model 53(1)(e): no uniform penalty before announcement and the worker's acknowledgement", () => {
  const clause = { id: "conduct_16", ar: "عدم التقيد بالزي الرسمي المعتمد بالمنشأة" };
  assert.equal(fe.checkUniformSanctionGate({ uniform: null, employeeId: "e1", clause }).error, "UNIFORM_NOT_PUBLISHED");
  assert.equal(fe.checkUniformSanctionGate({ uniform: saved, employeeId: "e1", clause }).error, "UNIFORM_NOT_PUBLISHED");
  assert.equal(fe.checkUniformSanctionGate({ uniform: announced, employeeId: "e1", clause }).error, "UNIFORM_NOT_ACKNOWLEDGED");
  assert.equal(fe.checkUniformSanctionGate({ uniform: acked, employeeId: "e1", clause }).ok, true);
  const newer = { ...acked, version: "2026-10-09T08:00:00" };
  assert.equal(fe.checkUniformSanctionGate({ uniform: newer, employeeId: "e1", clause }).error, "UNIFORM_NOT_ACKNOWLEDGED", "a new version needs a fresh acknowledgement");
  assert.equal(fe.checkUniformSanctionGate({ uniform: null, employeeId: "e1", clauseId: "time_7" }).ok, true, "other clauses untouched");
  assert.equal(fe.checkUniformSanctionGate({ uniform: null, employeeId: "e1", row: { regulationOffence: "مخالفة الزي الرسمي" } }).error, "UNIFORM_NOT_PUBLISHED");
  assert.equal(be.checkUniformSanctionGate({ uniform: announced, employeeId: "e1", clause }).error, "UNIFORM_NOT_ACKNOWLEDGED");
});

ok("server merge: HR saves and announces; a worker adds only his own acknowledgement; acks survive", () => {
  const afterSave = mergeWorkRegulationWrite({}, { uniform: announced }, { senior: true, actorId: "h1" }).payload;
  assert.equal(afterSave.uniform.announcedAt, "2026-10-02");
  const worker = mergeWorkRegulationWrite(afterSave, { uniform: { ...announced, rules: "تغيير غير مصرح", acks: { e1: { version: "2026-10-01T08:00:00" }, e2: { version: "2026-10-01T08:00:00" } } } }, { senior: false, actorId: "e1", now: "2026-10-03T09:00:00Z" }).payload;
  assert.equal(worker.uniform.rules, announced.rules, "a worker cannot rewrite the rules");
  assert.ok(worker.uniform.acks.e1);
  assert.equal(worker.uniform.acks.e2, undefined, "nobody acknowledges for another");
  const hrAgain = mergeWorkRegulationWrite(worker, { uniform: { ...announced, acks: {} } }, { senior: true, actorId: "h1" }).payload;
  assert.ok(hrAgain.uniform.acks.e1, "a stale HR copy does not drop acknowledgements");
  assert.deepEqual(Object.keys(redactRegulationAcks(hrAgain, "e9").uniform.acks), []);
});

ok("model 69 · 61: the record keeps everything; eraseDays folds only the worker's list, never under 180", () => {
  assert.equal(ruleValue("discipline.record.eraseDays"), 365);
  const s = sanctionRecordState({ signedAt: "2025-09-01" }, { today: "2026-10-16" });
  assert.equal(s.inRecord, true);
  assert.equal(s.countsForRepeat, false);
  assert.equal(s.foldedForWorker, true);
  const recent = sanctionRecordState({ signedAt: "2026-08-01" }, { today: "2026-10-16" });
  assert.equal(recent.countsForRepeat, true);
  assert.equal(recent.repeatUntil, "2027-01-28");
  assert.equal(recent.foldedForWorker, false);
  const rows = penaltiesRecordRows([
    { id: "a", employeeId: "e1", signedAt: "2025-09-01", discoveredAt: "2025-08-20", regulationOffence: "التأخر", penaltyAr: "إنذار كتابي" },
    { id: "b", employeeId: "e1", notifiedAt: "2026-10-01" },
  ], "e1", { today: "2026-10-16" });
  assert.equal(rows.length, 1, "only signed penalties are on the record");
  assert.equal(rows[0].offence, "التأخر");
  assert.equal(rows[0].occurredAt, "2025-08-20");
  assert.match(rows[0].repeat, /لا يُشدَّد به/);
});

ok("الجزاءات ministry panel: 47–48 both sides, 53 manager side with derived status, 69 always", () => {
  const worker = disciplineModelRows({ ar: true });
  assert.deepEqual(worker.map((r) => r.key), ["model-47", "model-48", "model-69"]);
  const emps = [{ id: "e1", name: "أ" }, { id: "e2", name: "ب" }];
  const by = (uniform) => disciplineModelRows({ uniform, employees: emps, manage: true, ar: true }).find((r) => r.key === "model-53");
  assert.equal(by(null).status, "alert");
  assert.equal(by(saved).status, "waiting");
  assert.match(by(acked).pill, /1 لم يُقرّ/);
  assert.equal(by({ ...acked, acks: { ...acked.acks, e2: { version: "2026-10-01T08:00:00" } } }).status, "settled");
});

console.log(`discipline model: ${n} checks passed`);
