/** Review fixes after the law merge — holiday OT flow, suspension parity, EOS FIFO, comp-leave double pay,
 *  wage not due overlap, damage refunds by case. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  absorbAssignmentIntoActualOt,
  planOtDecision,
  stampActualOvertime,
  stampHolidayWorkOvertime,
  withdrawHolidayWorkOvertime,
} from "../src/lib/otDecisionPlan.js";
import { stampOvertimePayOnDraft } from "../src/lib/overtimeAssignment.js";
import { viewerEmployeeId } from "../src/lib/employeeFileView.js";
import * as feSusp from "../src/lib/contractSuspension.js";
import * as beSusp from "../base44/shared/contractSuspension.ts";
import { unpaidSuspensionPlan } from "../src/lib/leaveTypes.js";
import { unpaidSuspensionPlan as unpaidSuspensionPlanTs } from "../base44/shared/leaveDerivations.ts";
import { annualBalanceBuckets, unusedAnnualDaysAtExit } from "../src/lib/leaveTypes.js";
import { unusedAnnualDaysAtExit as unusedAnnualDaysAtExitTs } from "../base44/shared/leaveDerivations.ts";
import { deriveEos } from "../src/lib/offboardingDerivations.js";
import { deriveEos as deriveEosTs } from "../base44/shared/offboardingDerivations.ts";
import { damageCaseIdFor, damageRefundsFor, detentionMonth, unpaidLeaveMonth } from "../src/lib/payrollLaw.js";
import { sickMonth } from "../src/lib/payrollLeaveEffects.js";
import * as fe from "../src/lib/payrollDerivations.js";
import * as be from "../base44/shared/payrollDerivations.ts";

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed += 1; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); passed += 1; };
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const MORN = { id: "morn", label: "صباحي", start: "07:00", end: "15:00", restMinutes: 30 };
const person = (id, extra = {}) => ({ id, name: id, stationId: "st", profile: {}, ...extra });

/* ── 1. The OT board is mounted where decisions are made, and «mine» filters by the employee id ── */
{
  // The fixed rule: overtime decisions live in طلباتي — إدارة الطلبات for management, not under الحضور.
  ok(/mode="manage"/.test(src("src/pages/Requests.jsx")) && !/<OtDecisionsPanel/.test(src("src/pages/Attendance.jsx")), "manager board mounted in إدارة الطلبات");
  ok(/OtDecisionsPanel/.test(src("src/pages/Requests.jsx")) && /mode="mine"/.test(src("src/pages/Requests.jsx")), "worker board mounted in طلباتي");
  ok(/viewerEmployeeId\(currentUser\)/.test(src("src/components/schedules/OtDecisionBoard.jsx")), "mine mode filters by viewerEmployeeId");
  ok(!/currentUser\.id, dateKey/.test(src("src/components/schedules/OtDecisionBoard.jsx")), "cap consent answers with the employee id, not the user id");
  eq(viewerEmployeeId({ id: "user_1", employeeId: "emp_9" }), "emp_9", "a login whose user id differs resolves to its employee");
  ok(/queueOtPendingNotice/.test(src("src/lib/store.js")) && /ot_pending:\$\{row\.employeeId\}:\$\{row\.dayKey\}/.test(src("src/lib/store.js")), "managers are notified once per pending OT key");
}

/* ── 2. A roster plan is not proof; punches replace it ── */
{
  const NATIONAL = "2026-09-23";
  const sched = { stationId: "st", shiftTypes: [MORN], assignments: { [NATIONAL]: { morn: ["h1"] } } };
  const worked = person("h1", { holidayWork: { [NATIONAL]: { confirmedAt: "2026-09-01" } } });
  const draft = { employees: [worked], schedules: [sched], otDecisions: {}, personalAttendance: [] };
  stampHolidayWorkOvertime(draft, sched, NATIONAL);
  const key = `h1:${NATIONAL}`;
  eq(`${draft.otDecisions[key].plannedMinutes}/${draft.otDecisions[key].workedProven}`, "450/undefined", "publish stamps the plan, not proof");
  eq(planOtDecision(draft, "h1", NATIONAL, { decision: "approve", overtimeMinutes: 450, today: "2026-09-20" }).error, "OT_NOT_WORKED_YET", "a planned holiday day is not paid before it is worked");
  const closed = planOtDecision(draft, "h1", NATIONAL, { decision: "reject", overtimeMinutes: 450, today: "2026-09-25" });
  eq(`${closed.ok}/${closed.entry.decision}/${closed.entry.notWorked}`, "true/reject/true", "a planned-only day that passed unworked can be closed");

  // Punches: 07:00–12:00 on the holiday → actual minutes replace the plan.
  const row = { employeeId: "h1", date: NATIONAL, checkInAt: "07:00", checkOutAt: "12:00" };
  const actual = stampActualOvertime(draft, worked, NATIONAL, row);
  const e = draft.otDecisions[key];
  ok(actual.overtimeMinutes > 0 && actual.overtimeMinutes < 450, "actual holiday minutes below the plan");
  eq(`${e.overtimeMinutes}/${e.plannedMinutes}/${e.workedProven}/${e.source}`, `${actual.overtimeMinutes}/450/true/actual_punch`, "actual replaces the plan, plan kept apart");
  stampHolidayWorkOvertime(draft, sched, NATIONAL);
  eq(draft.otDecisions[key].overtimeMinutes, actual.overtimeMinutes, "re-publish never raises actual minutes back to the plan");
  const pay = planOtDecision(draft, "h1", NATIONAL, { decision: "approve", overtimeMinutes: 450, today: "2026-09-25" });
  eq(pay.entry.overtimeMinutes, actual.overtimeMinutes, "the decision pays the punched minutes, not the plan");
  eq(planOtDecision(draft, "h1", NATIONAL, { decision: "reject", today: "2026-09-25" }).error, "OT_WORKED_NO_REJECT", "proven holiday work cannot be rejected");

  // A day closed as «not worked» reopens when punches prove it.
  const d2 = { employees: [worked], schedules: [sched], otDecisions: { [key]: { decision: "reject", holiday: true, notWorked: true, overtimeMinutes: 450 } } };
  stampActualOvertime(d2, worked, NATIONAL, { employeeId: "h1", date: NATIONAL, checkInAt: "07:00", checkOutAt: "12:00" });
  eq(`${d2.otDecisions[key].decision}/${d2.otDecisions[key].workedProven}`, "pending/true", "closed-unworked reopens on punches");

  // Withdrawn from the roster: the open plan entry goes; a proven one stays.
  const d3 = { employees: [worked], otDecisions: {} };
  stampHolidayWorkOvertime(d3, sched, NATIONAL);
  eq(withdrawHolidayWorkOvertime(d3, "h1", NATIONAL), true, "withdrawn holiday work deletes the open stamped entry");
  eq(d3.otDecisions[key], undefined, "entry gone");
  eq(withdrawHolidayWorkOvertime(draft, "h1", NATIONAL), false, "a punch-proven entry is never deleted by a roster edit");
  ok(/withdrawHolidayWorkOvertime\(d, emp\.id, placeKey\)/.test(src("src/lib/store.js")), "store calls the withdraw when the duty is cleared");
}

/* ── 3. Suspension: one source of truth, agreedOtherwise honoured ── */
{
  const rows = [
    { id: "u1", type: "unpaid", status: "approved", startDate: "2021-02-01", endDate: "2021-03-02" },
    { id: "u2", type: "unpaid", status: "approved", startDate: "2021-06-01", endDate: "2021-06-15", agreedOtherwise: true },
    { id: "u3", type: "unpaid", status: "accepted", startDate: "2023-01-10", endDate: "2023-02-28" },
    { id: "u4", type: "unpaid", status: "approved", startDate: "2024-03-01", endDate: "2024-03-30", contractNotSuspended: true },
    { id: "u5", type: "unpaid", status: "pending", startDate: "2025-01-01", endDate: "2025-03-01" },
  ];
  const hire = "2020-01-01";
  const planDays = unpaidSuspensionPlan(rows, hire).days.filter((d) => d <= "2025-12-31").length;
  eq(feSusp.suspendedDaysFromUnpaidLeave(rows, hire, "2025-12-31"), planDays, "contractSuspension == leave branch plan");
  eq(beSusp.suspendedDaysFromUnpaidLeave(rows, hire, "2025-12-31"), planDays, "backend twin agrees");
  eq(unpaidSuspensionPlanTs(rows, hire).days, unpaidSuspensionPlan(rows, hire).days, "plan twins agree");
  eq(feSusp.suspendedDaysFromUnpaidLeave([{ ...rows[0], agreedOtherwise: true }], hire, "2025-12-31"), 0, "agreedOtherwise suspends nothing");
  eq(feSusp.suspendedDaysFromUnpaidLeave([rows[0]], hire, "2025-12-31"), 10, "30 days → 10 beyond 20");
  eq(unpaidSuspensionPlan([{ ...rows[0], contractNotSuspended: true }], hire).days.length, 0, "leave branch reads the same agreement flags");
}

/* ── 4. EOS: FIFO only when the leave record covers service ── */
{
  const now = new Date(2024, 6, 1, 12).getTime();
  const base = { hireDate: "2020-01-01", base: 3000, allowances: 0, annualLeaveUsed: 10, profile: { hireDate: "2020-01-01" } };
  const legacy = deriveEos({ ...base }, now);
  const migrated = deriveEos({ ...base, leaveRequests: [] }, now);
  eq(migrated.unusedAnnualDays, legacy.unusedAnnualDays, "an empty leave array is not a record — old path (accrued − annualLeaveUsed)");
  eq(deriveEosTs({ ...base, leaveRequests: [] }, now).unusedAnnualDays, legacy.unusedAnnualDays, "backend twin agrees");
  const opening = { ...base, leaveRequests: [], profile: { hireDate: "2020-01-01", leaveOpeningBalance: { asOf: "2023-12-31", days: 12 } } };
  const withOpening = deriveEos(opening, now);
  const exit = "2024-07-01";
  const expected = Math.round(unusedAnnualDaysAtExit(opening.profile, [], exit) * 10) / 10;
  eq(withOpening.unusedAnnualDays, expected, "opening balance → FIFO from that day");
  ok(withOpening.unusedAnnualDays > 12 && withOpening.unusedAnnualDays < 12 + 21, "12 on file + 2024 accrual only");
  eq(unusedAnnualDaysAtExitTs(opening.profile, [], exit), unusedAnnualDaysAtExit(opening.profile, [], exit), "buckets twin agrees with the opening balance");
  const buckets = annualBalanceBuckets(opening.profile, [{ type: "annual", status: "approved", startDate: "2022-05-01", endDate: "2022-05-10" }], exit, undefined, undefined, { until: exit });
  eq(buckets.filter((b) => b.end < "2023-12-31").reduce((n, b) => n + b.entitled + b.used, 0), 0, "years before the opening day are inside its figure; old leave is not charged again");
}

/* ── 5. Comp-leave / pay assignment never compensated twice ── */
{
  const shift = { start: "07:00", end: "15:30", restMinutes: 30 };
  const sched = { stationId: "st", shiftTypes: [{ id: "s", ...shift }], assignments: { "2026-10-12": { s: ["a"] } } };
  const credit = { id: "r1", type: "overtime", assignment: true, status: "approved", compensation: "credit", hours: 2, date: "2026-10-12" };
  // Credit approved first, then checkout with 150 actual minutes → only 30 open.
  const d1 = { employees: [person("a", { otherRequests: [credit] })], schedules: [sched], otDecisions: {} };
  stampActualOvertime(d1, d1.employees[0], "2026-10-12", { employeeId: "a", date: "2026-10-12", checkInAt: "07:00", checkOutAt: "18:00" });
  eq(`${d1.otDecisions["a:2026-10-12"].overtimeMinutes}/${d1.otDecisions["a:2026-10-12"].assignmentMinutes}`, "30/120", "credit hours are not reopened at checkout");
  // Checkout first, then the credit assignment is approved → absorbed.
  const d2 = { employees: [person("a")], schedules: [sched], otDecisions: {} };
  stampActualOvertime(d2, d2.employees[0], "2026-10-12", { employeeId: "a", date: "2026-10-12", checkInAt: "07:00", checkOutAt: "18:00" });
  eq(absorbAssignmentIntoActualOt(d2, "a", credit), 30, "late-approved credit leaves 30 minutes open");
  const d2b = { employees: [person("a")], schedules: [sched], otDecisions: {} };
  stampActualOvertime(d2b, d2b.employees[0], "2026-10-12", { employeeId: "a", date: "2026-10-12", checkInAt: "07:00", checkOutAt: "17:00" });
  eq(absorbAssignmentIntoActualOt(d2b, "a", credit), 0, "fully covered → entry removed");
  eq(d2b.otDecisions["a:2026-10-12"], undefined, "no pending pay for hours taken as leave");
  // Pay assignment approved first, then punches equal to it → nothing new; beyond it → one pending total.
  const payReq = { id: "r2", type: "overtime", assignment: true, status: "approved", compensation: "pay", hours: 2, date: "2026-10-12" };
  const d3 = { employees: [person("a", { otherRequests: [payReq] })], schedules: [sched], otDecisions: {} };
  stampOvertimePayOnDraft(d3, "a", { ...payReq }, "m");
  stampActualOvertime(d3, d3.employees[0], "2026-10-12", { employeeId: "a", date: "2026-10-12", checkInAt: "07:00", checkOutAt: "17:00" });
  eq(`${d3.otDecisions["a:2026-10-12"].decision}/${d3.otDecisions["a:2026-10-12"].overtimeMinutes}`, "approve/120", "paid assignment hours are not reopened");
  stampActualOvertime(d3, d3.employees[0], "2026-10-12", { employeeId: "a", date: "2026-10-12", checkInAt: "07:00", checkOutAt: "18:00" });
  eq(`${d3.otDecisions["a:2026-10-12"].decision}/${d3.otDecisions["a:2026-10-12"].overtimeMinutes}/${d3.otDecisions["a:2026-10-12"].assignmentMinutes}`, "pending/150/120", "punches beyond the paid assignment: one decision for the total, none twice");
}

/* ── 6. Wage not due: each day once, capped at the wage ── */
{
  const employee = {
    leaveRequests: [
      { type: "unpaid", status: "approved", startDate: "2026-10-01", endDate: "2026-10-20" },
      { type: "sick", status: "approved", startDate: "2026-06-01", endDate: "2026-10-31" },
    ],
    profile: { workDetention: { from: "2026-10-10" } },
  };
  const unpaid = unpaidLeaveMonth({ employee, month: "2026-10", monthlyWage: 3000 });
  const det = detentionMonth({ detention: employee.profile.workDetention, month: "2026-10", monthlyWage: 3000, skipDays: unpaid.dayKeys });
  eq(det.days, 11, "detention skips the unpaid-leave days (21–31 Oct)");
  const sick = sickMonth({ employee, month: "2026-10", monthlyWage: 3000, skipDays: [...unpaid.dayKeys, ...det.dayKeys] });
  eq(sick.days, 0, "sick days under unpaid leave / detention are not charged again");
  ok(src("src/lib/payrollWageSync.js").includes("skipDays: unpaidPart?.dayKeys"), "payroll applies the order unpaid > detention > injury > sick");
  for (const [lib, label] of [[fe, "client"], [be, "server"]]) {
    const line = { base: 3000, allowances: 0, unpaidLeaveCut: 2000, detentionCut: 1500, sickUnpaid: 1000 };
    eq(lib.lineWageNotDue(line), 3000, `${label}: wage not due capped at the month's wage`);
    eq(lib.lineNet({ ...line, deductions: 200 }), 0, `${label}: net never negative`);
  }
}

/* ── 7. Damage refunds follow the case ── */
{
  const caseId = damageCaseIdFor({ damageNoticeOn: "2026-08-03" });
  eq(caseId, "DMG-2026-08-03", "a damage line gets its case id at creation");
  const lines = [
    { id: "l1", source: "damage", amount: 400, damageNoticeOn: "2026-08-03", damageCaseId: caseId, createdAt: "2026-08-10" },
    { id: "l2", source: "damage", amount: 400, damageNoticeOn: "2026-08-03", damageCaseId: caseId, createdAt: "2026-09-10" },
    { id: "l3", source: "damage", amount: 400, damageNoticeOn: "2026-08-03", damageCaseId: "DMG-other", createdAt: "2026-09-10" },
  ];
  const obj = { id: "o1", type: "damage_objection", status: "approved", notifiedOn: "2026-08-03", amount: 600, damageCaseId: caseId };
  eq(damageRefundsFor([obj], lines), [
    { lineId: "l1", objectionId: "o1", caseId, amount: 400 },
    { lineId: "l2", objectionId: "o1", caseId, amount: 200 },
  ], "instalments summed up to the accepted amount; other cases untouched");
  eq(damageRefundsFor([{ ...obj, damageCaseId: undefined }], lines), [], "an objection naming no case refunds nothing (no day+amount guess)");
  eq(damageRefundsFor([obj, { ...obj, id: "o2" }], lines).filter((r) => r.lineId === "l1").length, 1, "each line refunded once");
  eq(damageRefundsFor([{ ...obj, damageCaseId: undefined, deductionLineId: "l2", amount: 800 }], lines).map((r) => r.lineId), ["l1", "l2"], "a line id resolves to its whole case");
  const refunded = lines.map((l) => (l.id === "l1" ? { ...l, refundedAt: "x", refundedAmount: 400, refundObjectionId: "o1" } : l));
  eq(damageRefundsFor([obj], refunded), [{ lineId: "l2", objectionId: "o1", caseId, amount: 200 }], "already-refunded amounts count against the cap");
  ok(/damageCaseId: damageCaseIdFor\(line\)/.test(src("src/lib/payrollDeductions.js")), "addDeductionLine stamps the case id");
  ok(/damageCaseIdFor\(\{ damageNoticeOn: notifiedOn \}\)/.test(src("src/lib/store.js")), "the objection is linked to its case when raised");
}

/* ── Removed dead code ── */
ok(!/generateAbsenceDeduction/.test(src("src/lib/deductionGenerators.js")), "generateAbsenceDeduction removed (no references)");

console.log(`test-review-fixes: ${passed} assertions passed`);
