/**
 * Org design — dated change requests.
 *   draft → pending → approved → published on the effective date; every step names its gate.
 *   Impact preview: who changes manager, whose approval path moves, budgets, Art. 58 moves.
 *   Circular guard, closing a unit that still has people, moving a filled seat across branches.
 *   Published = sealed decision with an inverse, so orgAsOf() can show any past or planned day.
 *   Server merge: published decisions immutable, the author never approves his own change.
 */
import assert from "node:assert/strict";
import {
  applyOrgChange,
  checkChangeTransitionGate,
  checkOrgChangeGate,
  deriveChangeImpact,
  dueChanges,
  orgAsOf,
  reportingGraph,
  sealOrgDecision,
  undoOrgChange,
  unitSeatTree,
} from "../src/lib/orgDesign.js";
import { mergeOrgDesignWrite } from "../base44/shared/orgDesignDerivations.ts";
import { WRITTEN_CONSENT_TYPE } from "../src/lib/writtenConsent.js";

const TODAY = "2026-10-16";

function fixture() {
  return {
    ownerId: "o",
    hrLevels: [{ id: "hr", active: true, permissions: ["manage_employees"] }],
    stations: [
      { id: "hq", name: "المنشأة", isCompanyRoot: true, managerId: "o" },
      { id: "kh", name: "الخفجي", parentStationId: "hq", managerId: "m", headcountBudget: 3 },
      { id: "ops", name: "التشغيل", parentStationId: "kh" },
      { id: "rb", name: "رابغ", parentStationId: "hq", managerId: "r", headcountBudget: 1 },
    ],
    employees: [
      { id: "o", name: "نيار", role: "director", stationId: "hq" },
      { id: "m", name: "أحمد", stationId: "kh" },
      { id: "w", name: "عمر", stationId: "ops", otherRequests: [] },
      { id: "r", name: "رائد", stationId: "rb" },
      { id: "h", name: "هند", stationId: "hq", hrLevelId: "hr" },
      { id: "h2", name: "هيا", stationId: "hq", hrLevelId: "hr" },
    ],
    orgSeats: [
      { id: "s_m", title: "مشرف", stationId: "kh", employeeId: "m" },
      { id: "s_w", title: "فني", stationId: "ops", employeeId: "w" },
      { id: "s_r", title: "مدير رابغ", stationId: "rb", employeeId: "r" },
      { id: "s_v", title: "فني شاغر", stationId: "ops", employeeId: null },
    ],
    orgDesign: { doa: [{ id: "d1", kind: "leave", unitId: "kh", approverSeatId: "s_m" }], changes: [] },
  };
}
const who = (data, id) => data.employees.find((e) => e.id === id);
const base = { id: "orgchg_0001", title: "إعادة تنظيم", reason: "سبب مكتوب", effectiveDate: TODAY };

/* ── header gates ── */
let data = fixture();
assert.equal(checkOrgChangeGate(data, { ...base, title: "" }).error, "ORG_CHANGE_TITLE");
assert.equal(checkOrgChangeGate(data, { ...base, reason: "" }).error, "ORG_CHANGE_REASON");
assert.equal(checkOrgChangeGate(data, { ...base, effectiveDate: "" }).error, "ORG_CHANGE_DATE");
assert.equal(checkOrgChangeGate(data, { ...base, ops: [] }).error, "ORG_CHANGE_EMPTY");

/* ── circular guard ── */
let gate = checkOrgChangeGate(data, { ...base, ops: [{ type: "reparentUnit", stationId: "kh", toParentId: "ops" }] });
assert.equal(gate.error, "ORG_CYCLE", "a unit cannot hang under its own sub-unit");
assert.equal(checkOrgChangeGate(data, { ...base, ops: [{ type: "setDotted", seatId: "s_m", toSeatId: "s_m" }] }).error, "ORG_DOTTED_SELF");
const dot = fixture();
dot.orgSeats.find((s) => s.id === "s_r").dottedToSeatId = "s_m";
assert.equal(checkOrgChangeGate(dot, { ...base, ops: [{ type: "setDotted", seatId: "s_m", toSeatId: "s_r" }] }).error, "ORG_CYCLE", "dotted loops are cycles too");

/* ── unit rules ── */
assert.equal(checkOrgChangeGate(data, { ...base, ops: [{ type: "closeUnit", stationId: "ops" }] }).error, "ORG_UNIT_HAS_PEOPLE");
assert.equal(checkOrgChangeGate(data, { ...base, ops: [{ type: "closeUnit", stationId: "kh" }] }).error, "ORG_UNIT_HAS_CHILDREN");
assert.equal(checkOrgChangeGate(data, { ...base, ops: [{ type: "closeUnit", stationId: "hq" }] }).error, "ORG_UNIT_FIXED");
assert.equal(checkOrgChangeGate(data, { ...base, ops: [{ type: "createUnit", name: "الخفجي", parentId: "hq" }] }).error, "ORG_UNIT_NAME_TAKEN");
assert.equal(checkOrgChangeGate(data, { ...base, ops: [{ type: "freezeSeat", seatId: "s_w" }] }).error, "ORG_SEAT_FILLED");
// steps run in order: create a unit, then move a vacant seat into it
gate = checkOrgChangeGate(data, { ...base, ops: [
  { type: "createUnit", unitId: "q", name: "الجودة", parentId: "rb", orgLevel: "unit" },
  { type: "moveSeat", seatId: "s_v", toStationId: "q" },
] });
assert.equal(gate.ok, true);

/* ── Art. 58: moving a filled seat across branches ── */
gate = checkOrgChangeGate(data, { ...base, ops: [{ type: "moveSeat", seatId: "s_w", toStationId: "rb" }] });
assert.equal(gate.error, "ORG_ART58_RESIDENCE");
assert.equal(gate.article, "58");
gate = checkOrgChangeGate(data, { ...base, ops: [{ type: "moveSeat", seatId: "s_w", toStationId: "rb", residence: "change" }] });
assert.equal(gate.error, "CONSENT_REQUIRED", "a residence change needs the worker's written consent");
const consented = fixture();
who(consented, "w").otherRequests = [{ id: "c1", type: WRITTEN_CONSENT_TYPE, topic: "site", status: "yes", answeredAt: "2026-10-01" }];
assert.equal(checkOrgChangeGate(consented, { ...base, ops: [{ type: "moveSeat", seatId: "s_w", toStationId: "rb", residence: "change" }] }).ok, true, "a signed consent lets the move through");
who(consented, "w").otherRequests[0].usedAt = "2026-10-05";
assert.equal(checkOrgChangeGate(consented, { ...base, ops: [{ type: "moveSeat", seatId: "s_w", toStationId: "rb", residence: "change" }] }).error, "CONSENT_REQUIRED", "a spent consent does not cover the next move");
gate = checkOrgChangeGate(data, { ...base, ops: [{ type: "moveSeat", seatId: "s_w", toStationId: "rb", residence: "necessity", necessityUntil: "2026-12-31" }] });
assert.equal(gate.error, "NECESSITY_CAP", "incidental necessity is capped at 30 days a year");
assert.equal(checkOrgChangeGate(data, { ...base, ops: [{ type: "moveSeat", seatId: "s_w", toStationId: "rb", residence: "same" }] }).ok, true);

/* ── impact preview ── */
const move = { ...base, ops: [{ type: "moveSeat", seatId: "s_w", toStationId: "rb", residence: "same" }] };
const impact = deriveChangeImpact(data, move, { day: TODAY });
assert.deepEqual(impact.managerChanges.map((c) => [c.employeeId, c.from, c.to]), [["w", "m", "r"]], "عمر: أحمد → رائد");
assert.deepEqual(impact.approvalChanges.map((c) => [c.kind, c.employeeId, c.from, c.to]), [["leave", "w", "m", ""]], "his leave leaves the الخفجي matrix row");
assert.ok(impact.budget.some((b) => b.stationId === "rb" && b.over), "رابغ goes over its budget of 1");
assert.equal(impact.ministry[0].article, "58");
assert.match(impact.ministry[0].ar, /اللائحة م20/, "the contract workplace clause is named");
assert.equal(impact.cycles, 0);

/* ── apply / undo / as-of ── */
const live = fixture();
const inverse = applyOrgChange(live, move);
assert.equal(live.orgSeats.find((s) => s.id === "s_w").stationId, "rb");
assert.equal(who(live, "w").stationId, "rb", "the holder's workplace moves with the seat");
assert.equal(reportingGraph(live).managerOf.get("w"), "r");
undoOrgChange(live, inverse);
assert.equal(live.orgSeats.find((s) => s.id === "s_w").stationId, "ops");
assert.equal(who(live, "w").stationId, "ops");

const created = fixture();
const inv2 = applyOrgChange(created, { ...base, id: "orgchg_q", ops: [{ type: "createUnit", unitId: "q", name: "الجودة", parentId: "rb" }] });
assert.ok(created.stations.some((s) => s.id === "q"));
undoOrgChange(created, inv2);
assert.ok(!created.stations.some((s) => s.id === "q"), "undo removes a created unit");

const history = fixture();
const pub = { ...move, id: "orgchg_pub", effectiveDate: "2026-09-01", status: "published" };
pub.inverse = applyOrgChange(history, pub);
history.orgDesign.changes.push(pub);
history.orgDesign.changes.push({ ...base, id: "orgchg_next", effectiveDate: "2026-11-01", status: "approved", ops: [{ type: "createUnit", unitId: "q2", name: "الجودة", parentId: "rb" }] });
const past = orgAsOf(history, "2026-08-15", { today: TODAY });
assert.equal(who(past, "w").stationId, "ops", "before the decision عمر was in التشغيل");
assert.equal(who(orgAsOf(history, TODAY, { today: TODAY }), "w").stationId, "rb");
assert.ok(!orgAsOf(history, TODAY, { today: TODAY }).stations.some((s) => s.id === "q2"));
assert.ok(orgAsOf(history, "2026-11-02", { today: TODAY }).stations.some((s) => s.id === "q2"), "a future day previews the approved plan");
assert.equal(history.orgSeats.find((s) => s.id === "s_w").stationId, "rb", "as-of never mutates the live data");
const tree = unitSeatTree(orgAsOf(history, "2026-08-15", { today: TODAY }), "2026-08-15");
const flat = [];
const walk = (n) => { flat.push(n); n.children.forEach(walk); };
tree.forEach(walk);
assert.ok(flat.find((n) => n.stationId === "ops").seats.some((s) => s.holder === "عمر"));

/* ── workflow & segregation of duties ── */
const flowData = fixture();
const draft = { ...move, status: "draft", createdById: "h" };
assert.equal(checkChangeTransitionGate(draft, "pending", { actor: who(flowData, "w"), data: flowData, today: TODAY }).error, "ORG_EDIT_HR_ONLY");
assert.equal(checkChangeTransitionGate(draft, "approved", { actor: who(flowData, "h2"), data: flowData, today: TODAY }).error, "ORG_CHANGE_FLOW");
assert.equal(checkChangeTransitionGate(draft, "pending", { actor: who(flowData, "h"), data: flowData, today: TODAY }).ok, true);
const pending = { ...draft, status: "pending" };
assert.equal(checkChangeTransitionGate(pending, "approved", { actor: who(flowData, "h"), data: flowData, today: TODAY }).error, "ORG_CHANGE_SELF_APPROVE");
assert.equal(checkChangeTransitionGate(pending, "approved", { actor: who(flowData, "h2"), data: flowData, today: TODAY }).ok, true);
assert.equal(checkChangeTransitionGate({ ...pending, createdById: "o" }, "approved", { actor: who(flowData, "o"), data: flowData, today: TODAY }).ok, true, "the owner may approve his own change");
assert.equal(checkChangeTransitionGate(pending, "rejected", { actor: who(flowData, "h2"), data: flowData, today: TODAY }).error, "ORG_CHANGE_REJECT_REASON");
const future = { ...pending, status: "approved", effectiveDate: "2026-11-01" };
assert.equal(checkChangeTransitionGate(future, "published", { actor: who(flowData, "h2"), data: flowData, today: TODAY }).error, "ORG_CHANGE_NOT_DUE");
assert.equal(checkChangeTransitionGate({ ...future, effectiveDate: TODAY }, "published", { actor: who(flowData, "h2"), data: flowData, today: TODAY }).ok, true);
flowData.orgDesign.changes = [future, { ...future, id: "due", effectiveDate: "2026-10-10" }, { ...pending, id: "p" }];
assert.deepEqual(dueChanges(flowData, TODAY).map((c) => c.id), ["due"], "only approved changes whose date came are due");

/* ── signed decision ── */
const a = sealOrgDecision({ ...move, approvedById: "h2" }, { companyId: "c1", by: "هيا", at: "2026-10-16T08:00:00Z" });
const b = sealOrgDecision({ ...move, approvedById: "h2" }, { companyId: "c1", by: "هيا", at: "2026-10-16T09:00:00Z" });
assert.equal(a.hash, b.hash, "the hash covers the decision content, not the clock");
assert.match(a.seal, /^NV-ORG-\d{4}-[0-9A-Z]{4}$/);
assert.notEqual(sealOrgDecision({ ...move, title: "آخر", approvedById: "h2" }, { companyId: "c1" }).hash, a.hash);

/* ── server merge ── */
const prior = { changes: [{ id: "p1", status: "published", title: "قديم" }, { id: "p2", status: "pending", createdById: "h" }], doa: [] };
let merged = mergeOrgDesignWrite(prior, { changes: [{ id: "p1", status: "published", title: "معدل" }, { id: "p2", status: "approved", createdById: "h", approvedById: "h" }], doa: [] }, { userId: "h", owner: false, canEdit: true });
assert.equal(merged.payload.changes.find((c) => c.id === "p1").title, "قديم", "a published decision is immutable");
assert.equal(merged.payload.changes.find((c) => c.id === "p2").status, "pending", "the author cannot approve");
assert.deepEqual(merged.refused.map((r) => r.error).sort(), ["ORG_CHANGE_SELF_APPROVE", "ORG_DECISION_IMMUTABLE"]);
merged = mergeOrgDesignWrite(prior, { changes: [{ id: "p2", status: "approved", createdById: "h", approvedById: "h" }], doa: [] }, { userId: "h2", owner: false, canEdit: true });
assert.equal(merged.payload.changes.find((c) => c.id === "p2").approvedById, "h2", "the approval is stamped with the caller");
assert.ok(merged.payload.changes.some((c) => c.id === "p1"), "a published decision cannot be deleted");
merged = mergeOrgDesignWrite({}, { doa: [{ id: "v", kind: "complaint" }, { id: "l", kind: "leave" }] }, { userId: "h", owner: false, canEdit: true });
assert.deepEqual(merged.payload.doa.map((r) => r.id), ["l"]);
assert.equal(merged.refused[0].error, "DOA_VOICE_NEVER_MANAGER");
assert.equal(mergeOrgDesignWrite(prior, { changes: [] }, { userId: "w", owner: false, canEdit: false }).refused[0].error, "ORG_EDIT_HR_ONLY");
merged = mergeOrgDesignWrite({ changes: [{ id: "p3", status: "pending", createdById: "h" }] }, { changes: [{ id: "p3", status: "published", createdById: "h", approvedById: "h2" }] }, { userId: "h2", owner: false, canEdit: true });
assert.equal(merged.payload.changes[0].status, "published", "approved and published in one sync by the approver");

console.log("org design changes: ok");
