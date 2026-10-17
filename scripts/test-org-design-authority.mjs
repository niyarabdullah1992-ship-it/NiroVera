/**
 * Org design — delegation of authority and who sees what.
 *   DoA: most specific unit wins, limits escalate, the occupant is holder → acting → deputy,
 *        the subject never approves himself, no row = the default chain, voice is refused.
 *   Permissions: owner/HR edit; a manager sees his subtree; an employee sees only «مكاني».
 *   The server twin (base44/shared/orgDesignDerivations.ts) agrees on the same fixture.
 */
import assert from "node:assert/strict";
import {
  canEditOrgDesign,
  checkDoaRowGate,
  checkOrgViewGate,
  deriveMyPlace,
  deriveSubtree,
  doaApproverIds,
  doaSubjectsFor,
  orgViewScope,
  resolveDoa,
  seatOccupant,
} from "../src/lib/orgDesign.js";
import * as server from "../base44/shared/orgDesignDerivations.ts";

const DAY = "2026-10-16";

function fixture() {
  return {
    ownerId: "o",
    hrLevels: [{ id: "hr", active: true, permissions: ["manage_employees"] }, { id: "hrv", active: true, permissions: ["view_employees"] }],
    stations: [
      { id: "hq", name: "المنشأة", isCompanyRoot: true, managerId: "o" },
      { id: "kh", name: "الخفجي", parentStationId: "hq", managerId: "m" },
      { id: "ops", name: "التشغيل", parentStationId: "kh" },
      { id: "rb", name: "رابغ", parentStationId: "hq", managerId: "r" },
    ],
    employees: [
      { id: "o", name: "نيار", role: "director", stationId: "hq" },
      { id: "m", name: "أحمد", role: "employee", stationId: "kh" },
      { id: "d", name: "حسن", role: "employee", stationId: "kh" },
      { id: "w", name: "عمر", role: "employee", stationId: "ops" },
      { id: "r", name: "رائد", role: "employee", stationId: "rb" },
      { id: "x", name: "خالد", role: "employee", stationId: "rb" },
      { id: "h", name: "هند", role: "employee", stationId: "hq", hrLevelId: "hr" },
      { id: "hv", name: "هالة", role: "employee", stationId: "hq", hrLevelId: "hrv" },
    ],
    orgSeats: [
      { id: "s_m", title: "مشرف", stationId: "kh", employeeId: "m", deputySeatId: "s_d" },
      { id: "s_d", title: "نائب", stationId: "kh", employeeId: "d" },
      { id: "s_w", title: "فني", stationId: "ops", employeeId: "w", dottedToSeatId: "s_r" },
      { id: "s_r", title: "مدير رابغ", stationId: "rb", employeeId: "r" },
      { id: "s_h", title: "موارد", stationId: "hq", employeeId: "h" },
      { id: "s_gm", title: "المدير العام", stationId: "hq", employeeId: "o" },
    ],
    orgDesign: {
      doa: [
        { id: "row_kh", kind: "leave", unitId: "kh", approverSeatId: "s_m", limit: 5, escalateToSeatId: "s_gm" },
        { id: "row_all", kind: "leave", unitId: null, approverSeatId: "s_h" },
      ],
    },
  };
}

/* ── resolution ── */
let data = fixture();
let res = resolveDoa(data, { kind: "leave", employeeId: "w", amount: 3, day: DAY });
assert.equal(res.source, "doa");
assert.equal(res.rowId, "row_kh", "the unit row (ancestor of التشغيل) beats the company-wide row");
assert.deepEqual(res.approvers.map((a) => a.employeeId), ["m"]);

res = resolveDoa(data, { kind: "leave", employeeId: "w", amount: 9, day: DAY });
assert.deepEqual(res.approvers.map((a) => a.employeeId), ["o"], "over the 5-day limit → escalation seat");
assert.ok(res.path.some((p) => p.why === "over_limit"));

res = resolveDoa(data, { kind: "leave", employeeId: "m", amount: 2, day: DAY });
assert.deepEqual(res.approvers.map((a) => a.employeeId), ["o"], "the approver's own leave escalates — nobody approves himself");
assert.ok(res.path.some((p) => p.why === "self"));

res = resolveDoa(data, { kind: "leave", employeeId: "x", day: DAY });
assert.equal(res.rowId, "row_all", "outside الخفجي the company-wide row applies");
assert.deepEqual(res.approvers.map((a) => a.employeeId), ["h"]);

assert.equal(resolveDoa(data, { kind: "overtime", employeeId: "w" }).source, "default", "no row for the kind → default chain");
assert.deepEqual(doaApproverIds(data, { id: "w" }, "overtime"), []);

const voice = resolveDoa(data, { kind: "complaint", employeeId: "w" });
assert.equal(voice.source, "refused");
assert.equal(voice.error, "DOA_VOICE_NEVER_MANAGER", "complaints never route to a manager");

/* occupant: holder → acting → deputy */
const vacated = fixture();
vacated.orgSeats.find((s) => s.id === "s_m").employeeId = null;
assert.deepEqual(seatOccupant(vacated, "s_m", DAY), { employeeId: "d", name: "حسن", via: "deputy", seatId: "s_m", title: "مشرف" });
vacated.employees.find((e) => e.id === "x").actingAssignments = [{ seatId: "s_m", stationId: "kh", from: "2026-10-01", until: "2026-11-01" }];
assert.equal(seatOccupant(vacated, "s_m", DAY).via, "acting", "acting cover before the deputy");
assert.equal(seatOccupant(vacated, "s_m", "2026-11-02").via, "deputy", "acting ends on its date by itself");
assert.equal(resolveDoa(vacated, { kind: "leave", employeeId: "w", amount: 1, day: DAY }).approvers[0].employeeId, "x");

/* inbox: people whose leave resolves to me */
assert.deepEqual(doaSubjectsFor(data, "m", "leave", DAY).map((e) => e.id).sort(), ["d", "w"]);
assert.deepEqual(doaSubjectsFor(data, "m", "overtime", DAY), [], "no overtime row → nothing added to the inbox");

/* row gates */
assert.equal(checkDoaRowGate({ kind: "voice", approverSeatId: "s_m" }, data).error, "DOA_VOICE_NEVER_MANAGER");
assert.equal(checkDoaRowGate({ kind: "leave", approverSeatId: "nope" }, data).error, "DOA_APPROVER_SEAT");
assert.equal(checkDoaRowGate({ kind: "leave", approverSeatId: "s_m", escalateToSeatId: "s_m" }, data).error, "DOA_ESCALATE_SELF");
assert.equal(checkDoaRowGate({ kind: "leave", approverSeatId: "s_m", limit: -1 }, data).error, "DOA_LIMIT");
assert.equal(checkDoaRowGate({ kind: "leave", unitId: "kh", approverSeatId: "s_d", limit: 5 }, data).error, "DOA_DUPLICATE");
assert.equal(checkDoaRowGate({ kind: "payroll", approverSeatId: "s_h", limit: 50000 }, data).ok, true);
const frozen = fixture();
frozen.orgSeats.push({ id: "s_f", title: "x", stationId: "kh", employeeId: null, state: "frozen" });
assert.equal(checkDoaRowGate({ kind: "payroll", approverSeatId: "s_f" }, frozen).error, "DOA_SEAT_FROZEN");

/* ── permissions ── */
const who = (id) => data.employees.find((e) => e.id === id);
assert.equal(canEditOrgDesign(who("o"), data), true, "owner");
assert.equal(canEditOrgDesign(who("h"), data), true, "HR with manage_employees");
assert.equal(canEditOrgDesign(who("hv"), data), false, "HR view-only does not design");
assert.equal(canEditOrgDesign({ id: "ops", role: "ops_manager" }, data), false, "operations reads the structure");
assert.equal(orgViewScope(who("m"), data), "subtree");
assert.equal(orgViewScope(who("w"), data), "self");
assert.equal(checkOrgViewGate(who("m"), data, "w").ok, true, "a manager sees his subtree");
assert.equal(checkOrgViewGate(who("m"), data, "x").error, "ORG_VIEW_OUTSIDE_SUBTREE");
assert.equal(checkOrgViewGate(who("w"), data, "d").error, "ORG_VIEW_SELF_ONLY");
assert.equal(checkOrgViewGate(who("w"), data, "w").ok, true);

/* ── my place ── */
const place = deriveMyPlace(data, "w", DAY);
assert.equal(place.manager.employeeId, "m");
assert.deepEqual(place.path.map((p) => p.stationId), ["hq", "kh", "ops"]);
assert.equal(place.dotted[0].name, "رائد", "dotted line to مدير رابغ");
assert.equal(place.team.length, 0);
assert.ok(!("profile" in place.me) && !("salary" in place.me), "names and titles only");
const mgrPlace = deriveMyPlace(data, "m", DAY);
assert.deepEqual(mgrPlace.team.map((t) => t.employeeId).sort(), ["d", "w"]);
assert.equal(mgrPlace.deputy.name, "حسن");
const tree = deriveSubtree(data, "m", DAY);
assert.deepEqual(tree.children.map((c) => c.employeeId).sort(), ["d", "w"]);

/* ── server twin agrees ── */
const sdata = server.toOrgData({ ...data, employees: data.employees.map((e) => ({ ...e, employeeId: e.id })) });
for (const [kind, employeeId, amount] of [["leave", "w", 3], ["leave", "w", 9], ["leave", "m", 2], ["leave", "x", null], ["overtime", "w", null]]) {
  const c = resolveDoa(data, { kind, employeeId, amount, day: DAY });
  const s = server.resolveDoa(sdata, { kind, employeeId, amount, day: DAY });
  assert.equal(s.source, c.source, `${kind}/${employeeId}`);
  assert.deepEqual(s.approvers, c.approvers.map((a) => a.employeeId), `${kind}/${employeeId}/${amount}`);
}
assert.equal(server.isDoaApprover(sdata, "m", "leave", "w", 3, DAY), true);
assert.equal(server.isDoaApprover(sdata, "m", "leave", "w", 9, DAY), false, "over the limit the server refuses the seat");
assert.equal(server.isDoaApprover(sdata, "x", "leave", "w", 3, DAY), false);
assert.equal(server.resolveDoa(sdata, { kind: "voice", employeeId: "w" }).error, "DOA_VOICE_NEVER_MANAGER");
for (const viewer of ["o", "m", "w", "h"]) {
  assert.equal(server.orgViewScope(who(viewer), sdata), orgViewScope(who(viewer), data), `scope ${viewer}`);
}
assert.equal(server.checkOrgViewGate(who("m"), sdata, "x").error, "ORG_VIEW_OUTSIDE_SUBTREE");
assert.equal(server.checkOrgViewGate(who("w"), sdata, "m").error, "ORG_VIEW_SELF_ONLY");
assert.equal(server.deriveMyPlace(sdata, "w").manager.employeeId, place.manager.employeeId);

console.log("org design authority: ok");
