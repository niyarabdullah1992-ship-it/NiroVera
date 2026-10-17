import assert from "node:assert/strict";
// Model regulation Arts. 9/12 (relocation), 24 (mission) and 46 (prevented day): gates, the pay feed, and
// the server twin giving the same answers.
import * as fe from "../src/lib/modelRequests.js";
import * as be from "../base44/shared/modelRequests.ts";
import { lineRefunds } from "../src/lib/payrollDerivations.js";
import { lineRefunds as beLineRefunds } from "../base44/shared/payrollDerivations.ts";
import { derivePayrollMonthAttendance } from "../src/lib/payrollMonthAttendance.js";
import { derivePayrollWagePatch } from "../src/lib/payrollWageSync.js";
import { payrollMinistryRows } from "../src/lib/payrollMinistryRows.js";
import { buildLawGatesBoard } from "../src/lib/lawGatesBoard.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };

const moved = { id: "t1", residence: "change", reasonCode: "operational_need", effectiveDate: "2026-09-01", fromStationName: "الرس", toStationName: "بريدة" };
const worker = { id: "e1", name: "سالم", stationTransfers: [moved], otherRequests: [] };

ok("model 12: no residence-changing transfer → named block", () => {
  const g = fe.checkRelocationClaimGate({ employee: { id: "e1", stationTransfers: [{ id: "s", residence: "same" }] }, items: { self: 300 } });
  assert.equal(g.error, "RELOCATION_NO_TRANSFER");
  assert.match(g.reason, /النموذج الموحد م12/);
});

ok("model 12: a move at the worker's own wish owes nothing", () => {
  const g = fe.checkRelocationClaimGate({ employee: { id: "e1", stationTransfers: [{ ...moved, reasonCode: "employee_request" }] }, items: { self: 300 } });
  assert.equal(g.error, "RELOCATION_WORKER_WISH");
});

ok("model 12: items sum; the stay is only for a necessity posting (9/2)", () => {
  const g = fe.checkRelocationClaimGate({ employee: worker, items: { self: 300, family: 450.5, belongings: "" } });
  assert.equal(g.ok, true);
  assert.equal(g.total, 750.5);
  assert.equal(g.basis, "model12");
  assert.equal(fe.checkRelocationClaimGate({ employee: worker, items: { stay: 200 } }).error, "RELOCATION_STAY_NOT_OWED");
  const posted = { ...worker, stationTransfers: [{ ...moved, residence: "necessity" }] };
  assert.equal(fe.checkRelocationClaimGate({ employee: posted, items: { stay: 200 } }).basis, "model9_2");
  assert.equal(fe.checkRelocationClaimGate({ employee: worker, items: {} }).error, "RELOCATION_AMOUNT_REQUIRED");
});

ok("model 12: claimed once per transfer", () => {
  const e = { ...worker, otherRequests: [{ id: "r0", type: fe.RELOCATION_TYPE, status: "pending", details: { transferId: "t1" } }] };
  assert.equal(fe.checkRelocationClaimGate({ employee: e, items: { self: 100 } }).error, "RELOCATION_ALREADY_CLAIMED");
  // The server re-checks a synced row with its own id excluded.
  assert.equal(fe.checkModelRequestSubmit({ id: "r0", type: fe.RELOCATION_TYPE, details: { transferId: "t1", lines: [{ key: "self", amount: 100 }] } }, e).ok, true);
});

ok("model 24: the decision carries transport, lodging and the daily allowance", () => {
  const base = { employee: worker, actorId: "m1", destination: "جدة", from: "2026-10-04", to: "2026-10-06", dailyRate: 250 };
  assert.equal(fe.checkMissionGate({ ...base, actorId: "e1" }).error, "MISSION_SELF");
  assert.equal(fe.checkMissionGate({ ...base, dailyRate: "" }).error, "MISSION_RATE_REQUIRED");
  assert.equal(fe.checkMissionGate({ ...base, transportProvided: false, transportCost: 400 }).error, "MISSION_TRANSPORT_CONSENT");
  assert.equal(fe.checkMissionGate({ ...base, lodgingProvided: false }).error, "MISSION_LODGING_COST");
  const g = fe.checkMissionGate({ ...base, transportProvided: false, transportCost: 400, transportConsent: true, lodgingProvided: false, lodgingPerDay: 300 });
  assert.equal(g.days, 3);
  assert.equal(g.allowance, 750);
  assert.equal(g.lodging, 900);
  assert.equal(g.total, 2050);
  const busy = { ...worker, otherRequests: [{ id: "m0", type: fe.MISSION_TYPE, status: "approved", details: { from: "2026-10-05", to: "2026-10-09" } }] };
  assert.equal(fe.checkMissionGate({ ...base, employee: busy }).error, "MISSION_OVERLAP");
});

ok("model 46: a manager names the company-side cause; once a day", () => {
  assert.equal(fe.checkEmployerPreventedGate({ employee: worker, actorId: "e1", date: "2026-10-05", reason: "تعطل الموقع كاملاً", today: "2026-10-16" }).error, "PREVENTED_SELF");
  assert.equal(fe.checkEmployerPreventedGate({ employee: worker, actorId: "m1", date: "2026-10-20", reason: "تعطل الموقع كاملاً", today: "2026-10-16" }).error, "PREVENTED_FUTURE");
  assert.equal(fe.checkEmployerPreventedGate({ employee: worker, actorId: "m1", date: "2026-10-05", reason: "عطل", today: "2026-10-16" }).error, "PREVENTED_REASON_REQUIRED");
  assert.equal(fe.checkEmployerPreventedGate({ employee: worker, actorId: "m1", date: "2026-10-05", reason: "تعطل الموقع كاملاً", today: "2026-10-16" }).ok, true);
});

const paid = {
  ...worker,
  profile: { baseSalary: 6000 },
  otherRequests: [
    { id: "r1", type: fe.RELOCATION_TYPE, status: "approved", approvedAt: "2026-10-03T08:00:00Z", details: { total: 750.5 } },
    { id: "m1", type: fe.MISSION_TYPE, status: "approved", details: { from: "2026-09-29", to: "2026-10-02", total: 1000 } },
    { id: "m2", type: fe.MISSION_TYPE, status: "pending", details: { from: "2026-10-10", to: "2026-10-11", total: 500 } },
    { id: "p1", type: fe.PREVENTED_TYPE, status: "approved", date: "2026-10-05", reason: "تعطل الموقع" },
  ],
};

ok("pay feed: approved claims repay in their month; pending ones wait", () => {
  const oct = fe.expenseRefundsForMonth(paid, "2026-10");
  assert.equal(oct.amount, 1750.5);
  assert.deepEqual(oct.refs.map((r) => r.id).sort(), ["m1", "r1"]);
  assert.equal(fe.expenseRefundsForMonth(paid, "2026-09").amount, 0);
  const patch = derivePayrollWagePatch({ employeeId: "e1", base: 6000 }, paid, { month: "2026-10" });
  assert.equal(patch.fields.expenseRefunds, 1750.5);
  assert.equal(lineRefunds({ refunds: 10, expenseRefunds: 1750.5 }), 1760.5);
  assert.equal(beLineRefunds({ refunds: 10, expenseRefunds: 1750.5 }), 1760.5);
});

ok("model 46: the prevented day is paid, not absence", () => {
  const data = {
    employees: [paid],
    personalAttendance: [
      { employeeId: "e1", date: "2026-10-05", status: "absent" },
      { employeeId: "e1", date: "2026-10-06", status: "absent" },
      { employeeId: "e1", date: "2026-10-07", status: "present", checkInAt: "2026-10-07T05:00:00Z" },
    ],
  };
  const att = derivePayrollMonthAttendance("e1", "2026-10", data);
  assert.equal(att.absent, 1);
  assert.equal(att.prevented, 1);
  assert.equal(fe.preventedDaysInMonth(paid, "2026-10").size, 1);
});

ok("pay panel: model rows read the run; schedule board counts the month", () => {
  const rows = payrollMinistryRows({ lines: [{ employeeId: "e1", expenseRefunds: 1750.5, housingAllowance: 1500, transportAllowance: 500 }], ar: true, preventedOf: () => 1, siteOf: () => ({ remoteness: { known: true, remote: true } }) });
  const by = (k) => rows.find((r) => r.key === k);
  assert.equal(by("model-12-24").status, "settled");
  assert.match(by("model-12-24").pill, /1,750.5/);
  assert.equal(by("model-46").status, "settled");
  assert.equal(by("regs-21").status, "settled");
  assert.equal(by("regs-30").status, "waiting");
  const board = buildLawGatesBoard({ gates: { checks: [] }, company: { employees: [paid] }, onDate: "2026-10-15", ar: true });
  const m46 = board.labour.rows.find((r) => r.article === "النموذج الموحد م46");
  assert.equal(m46.status, "settled");
});

ok("server twin answers the same", () => {
  const cases = [
    [{ type: fe.RELOCATION_TYPE, details: { items: { self: 300 } } }, worker, {}],
    [{ type: fe.RELOCATION_TYPE, details: { items: { stay: 300 } } }, worker, {}],
    [{ type: fe.MISSION_TYPE, details: { destination: "جدة", from: "2026-10-04", to: "2026-10-06", dailyRate: 250 } }, worker, { actorId: "m1" }],
    [{ type: fe.MISSION_TYPE, details: { destination: "جدة", from: "2026-10-04", to: "2026-10-06", dailyRate: 250, transportProvided: false, transport: 300 } }, worker, { actorId: "m1" }],
    [{ type: fe.PREVENTED_TYPE, date: "2026-10-05", reason: "انقطاع الكهرباء عن الموقع" }, worker, { actorId: "m1", today: "2026-10-16" }],
    [{ type: fe.PREVENTED_TYPE, date: "2026-10-05", reason: "x" }, worker, { actorId: "m1", today: "2026-10-16" }],
  ];
  for (const [req, emp, opts] of cases) {
    assert.deepEqual(be.checkModelRequestSubmit(req, emp, opts), fe.checkModelRequestSubmit(req, emp, opts), JSON.stringify(req));
  }
  assert.deepEqual(be.expenseRefundsForMonth(paid, "2026-10"), fe.expenseRefundsForMonth(paid, "2026-10"));
});

console.log(`model requests: ${n} checks passed`);
