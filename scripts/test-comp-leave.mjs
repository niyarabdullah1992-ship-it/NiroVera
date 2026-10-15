import assert from "node:assert/strict";
import { checkTakeCompLeaveGate, compBalance, compPayout, moveCompCreditsOutOfAnnual, planCompLeaveNotices } from "../src/lib/compLeave.js";

const ot = (id, hours, date, extra = {}) => ({ id, type: "overtime", assignment: true, status: "approved", compensation: "credit", hours, date, ...extra });
const emp = {
  id: "e1",
  name: "عمر",
  otherRequests: [
    ot("a", 3, "2026-10-01", { enjoyDate: "2026-11-29" }),
    ot("b", 2, "2026-10-10", { enjoyDate: "2026-12-08" }),
    { id: "p", type: "overtime", assignment: true, status: "approved", compensation: "pay", hours: 5, date: "2026-10-05" },
    { id: "x", type: "overtime", assignment: true, status: "pending_manager", compensation: "credit", hours: 4, date: "2026-10-12" },
  ],
  leaveRequests: [],
};
let b = compBalance(emp, "2026-10-15");
assert.equal(b.earned, 7.5, "4.5 + 3 — pay and unapproved do not count");
assert.equal(b.left, 7.5);
assert.equal(b.nextTakeBy, "2026-11-29");
assert.equal(b.days, 0.94);

// Hours permission (2h) and a pending one hold the balance; draws from the earliest take-by first.
emp.otherRequests.push({ id: "h1", type: "permission", compLeave: true, status: "approved", date: "2026-10-20", time: "08:00", timeTo: "10:00" });
emp.otherRequests.push({ id: "h2", type: "permission", compLeave: true, status: "pending", date: "2026-10-21", time: "13:00", timeTo: "14:30" });
b = compBalance(emp, "2026-10-21");
assert.equal(b.used, 2);
assert.equal(b.held, 1.5);
assert.equal(b.left, 4);
assert.equal(b.grants[0].left, 1, "the first grant is drawn first");
assert.equal(b.grants[1].left, 3);

// Gates.
assert.equal(checkTakeCompLeaveGate({ employee: emp, hours: 4, on: "2026-10-25", today: "2026-10-21" }).ok, true);
assert.match(checkTakeCompLeaveGate({ employee: emp, hours: 5, on: "2026-10-25", today: "2026-10-21" }).reason, /رصيدك التعويضي 4 ساعات.*محجوز منه 1\.5 ساعة/);
assert.equal(checkTakeCompLeaveGate({ employee: emp, days: 1, on: "2026-10-25", today: "2026-10-21" }).ok, false, "a full day is 8 hours");
assert.match(checkTakeCompLeaveGate({ employee: { id: "z" }, hours: 1, on: "2026-10-25" }).reason, /لا رصيد إجازة تعويضية/);
assert.equal(checkTakeCompLeaveGate({ employee: emp, hours: 1.5, on: "2026-10-21", exceptId: "h2" }).ok, true, "its own hold is not counted against it");

// A whole-day comp leave request uses 8 hours.
const rich = { id: "r", otherRequests: [ot("big", 8, "2026-10-01")], leaveRequests: [{ id: "L", type: "comp", status: "approved", startDate: "2026-10-05", endDate: "2026-10-05", days: 1 }] };
assert.equal(compBalance(rich, "2026-10-06").left, 4);

// Exit payout at the actual hourly wage.
assert.deepEqual(compPayout(rich, "2026-10-06", 7200), { hours: 4, amount: 120, hourly: 30 });

// Reminders.
const plans = planCompLeaveNotices({ data: { employees: [emp] }, today: "2026-11-25", audienceOf: () => [{ id: "m" }] });
assert.ok(plans.some((p) => p.key === "comp:e1:a:7" && /باقي 4 أيام/.test(p.text)));
const late = planCompLeaveNotices({ data: { employees: [emp] }, today: "2026-12-01", audienceOf: () => [{ id: "m" }] });
assert.ok(late.some((p) => p.key === "comp:e1:a:over:m" && /لا تسقط/.test(p.text)));

// Migration takes old credits back out of annual leave, once.
const data = { employees: [{ profile: { leaveTotals: { annual: 30.563 } }, otherRequests: [{ type: "overtime", balanceApplied: true, appliedDays: 0.563 }] }] };
assert.equal(moveCompCreditsOutOfAnnual(data), true);
assert.equal(data.employees[0].profile.leaveTotals.annual, 30);
assert.equal(moveCompCreditsOutOfAnnual(data), false);
console.log("comp leave ok");
