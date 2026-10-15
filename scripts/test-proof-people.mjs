import assert from "node:assert/strict";
import { addProofPerson, markProofPersonOut, peopleInside, checkExtendVisitGate } from "../src/lib/proofPeople.js";
import { duplicatePersonIdIndex, workProofCrewFields, normalizePerson } from "../src/lib/workProofCrew.js";

const open = { id: "wp1", stationId: "s1", people: [{ name: "سالم", id: "1102233445", nationality: "سعودي", inAt: "2026-10-14T07:20:00" }] };

// add: needs an ID for work, nationality for visitors, no repeats, not on a closed proof
assert.equal(addProofPerson(open, { name: "راجو" }, { kind: "work" }).error, "ID_REQUIRED");
assert.equal(addProofPerson(open, { name: "خالد", id: "1" }, { kind: "visitor" }).error, "NATIONALITY_REQUIRED");
assert.equal(addProofPerson(open, { name: "آخر", id: "1102 233445" }, { kind: "work" }).error, "DUPLICATE_ID");
assert.equal(addProofPerson({ ...open, sealId: "x" }, { name: "a", id: "2" }).error, "PROOF_CLOSED");
assert.equal(addProofPerson({ ...open, status: "left" }, { name: "a", id: "2" }).error, "PROOF_CLOSED");
const added = addProofPerson(open, { name: "راجو", id: "2456677889", briefed: true }, { kind: "work", at: "2026-10-14T09:00:00" });
assert.ok(added.ok);
assert.equal(added.people.length, 2);
assert.equal(added.people[1].inAt, "2026-10-14T09:00:00");
assert.equal(added.people[1].briefed, true);
assert.equal(added.people[0].inAt, "2026-10-14T07:20:00", "existing time in survives normalisation");

// limit
const full = { ...open, people: Array.from({ length: 12 }, (_, i) => ({ name: `w${i}`, id: String(1000 + i) })) };
assert.equal(addProofPerson(full, { name: "x", id: "9" }).error, "LIMIT");

// out: one at a time, allOut when the last leaves
const two = { ...open, people: added.people };
const o1 = markProofPersonOut(two, 0, { at: "2026-10-14T12:00:00" });
assert.ok(o1.ok && !o1.allOut);
assert.equal(peopleInside(o1.people).length, 1);
assert.equal(markProofPersonOut({ ...two, people: o1.people }, 0).error, "ALREADY_OUT");
const o2 = markProofPersonOut({ ...two, people: o1.people }, 1);
assert.ok(o2.allOut);
assert.equal(markProofPersonOut(two, 5).error, "PERSON_NOT_FOUND");

// extend a pass
const vp = { visitFrom: "2026-10-14", visitTo: "2026-10-16" };
assert.equal(checkExtendVisitGate(vp, { to: "2026-10-16", reason: "x", today: "2026-10-14" }).error, "NOT_LATER");
assert.equal(checkExtendVisitGate(vp, { to: "2026-10-13", reason: "x", today: "2026-10-14" }).error, "DATE_PAST");
assert.equal(checkExtendVisitGate(vp, { to: "2026-10-18", reason: " ", today: "2026-10-14" }).error, "REASON_REQUIRED");
assert.equal(checkExtendVisitGate({ ...vp, leftAt: "x" }, { to: "2026-10-18", reason: "r", today: "2026-10-14" }).error, "ALREADY_LEFT");
const ext = checkExtendVisitGate(vp, { to: "2026-10-18", reason: "اكتمال الفحص", today: "2026-10-14" });
assert.ok(ext.ok && ext.to === "2026-10-18" && ext.from === "2026-10-16");

// duplicate IDs refused at raise
assert.equal(duplicatePersonIdIndex([{ id: "1" }, { id: "2" }, { id: " 1" }]), 2);
assert.equal(duplicatePersonIdIndex([{ id: "" }, { id: "" }]), -1);
const dupRaise = workProofCrewFields({ people: [{ name: "a", id: "5" }, { name: "b", id: "5" }] });
assert.equal(dupRaise.ok, false);
assert.equal(normalizePerson({ name: "x", badge: " 17 ", briefed: true }).badge, "17");

console.log("proof people ok");
