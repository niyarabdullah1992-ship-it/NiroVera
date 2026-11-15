// Payroll reads annual leave by the days it charges, as «رصيد إجازاتي» does: the approval's lockedDays
// marks each day «charge» / «dutyOnRest» (counted) or a rest day («company», «cycle»). A leave over two
// rest days read «إجازة سنوية · يومان» and «صرف 2 يوماً مقدّماً» in payroll while the balance took 0.
import assert from "node:assert/strict";
import { leaveEffects } from "../src/lib/payrollLeaveEffects.js";
import { pendingAnnualAdvances } from "../src/lib/payrollLaw.js";

const leave = (id, s, e, locked) => ({ id, type: "annual", status: "approved", startDate: s, endDate: e, lockedDays: locked });
const employee = {
  id: "e1",
  leaveRequests: [
    leave("a", "2026-11-16", "2026-11-17", { "2026-11-16": "company", "2026-11-17": "cycle" }),
    leave("b", "2026-11-18", "2026-11-18", { "2026-11-18": "charge" }),
    leave("c", "2026-11-19", "2026-11-19", { "2026-11-19": "charge" }),
  ],
};

const annual = leaveEffects({ employee, month: "2026-11", monthlyWage: 9000 }).rows.find((r) => r.id === "annual");
assert.equal(annual.days, 2, "only the two charged days — the rest-day leave takes nothing");

const advances = pendingAnnualAdvances([employee], "2026-11-15", 14);
assert.deepEqual(advances.map((a) => [a.leave.id, a.days]), [["b", 1], ["c", 1]], "no advance owed on a leave of rest days");

// a leave approved before the lock map existed keeps its calendar span
const legacy = { id: "e2", leaveRequests: [{ type: "annual", status: "approved", startDate: "2026-11-20", endDate: "2026-11-22" }] };
assert.equal(leaveEffects({ employee: legacy, month: "2026-11", monthlyWage: 9000 }).rows.find((r) => r.id === "annual").days, 3);

console.log("PASS payroll counts annual leave by charged days, as the balance does");
