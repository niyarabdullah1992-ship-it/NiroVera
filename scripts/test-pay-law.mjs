// Payroll / payslip / end-of-service law — Arts. 2, 84, 86–97, 107, 109, 116, 117, 137 and
// implementing regulations Art. 5(2) / model regulation Arts. 15, 17.
import assert from "node:assert/strict";
import * as fe from "../src/lib/payrollDerivations.js";
import * as be from "../base44/shared/payrollDerivations.ts";
import * as feSusp from "../src/lib/contractSuspension.js";
import * as beSusp from "../base44/shared/contractSuspension.ts";
import * as feOff from "../src/lib/offboardingDerivations.js";
import * as beOff from "../base44/shared/offboardingDerivations.ts";
import { eosWageBase } from "../src/lib/laborProtectionGates.js";
import { citeRule, ruleValue } from "../src/lib/laborRules.js";
import { TERMINATION_REASONS } from "../src/lib/contractLawDerivations.js";
import {
  annualLeaveAdvanceAmount,
  averageActualWage,
  checkAnnualLeaveAdvanceGate,
  checkCourtDebtGate,
  checkDamageLineGate,
  checkMinimumWageGate,
  checkWeeklyCycleGate,
  companyPayday,
  COURT_DEBT_KINDS,
  damageRefundsFor,
  deriveFinalSettlement,
  detentionMonth,
  detentionRefund,
  holidayOvertimeHours,
  isAverageWageBasis,
  outstandingAdvances,
  payPeriodOf,
  pendingAnnualAdvances,
  unpaidLeaveMonth,
  wageOverdue,
  wageSheetCsv,
  weeklyInstalments,
  weeklyPeriods,
} from "../src/lib/payrollLaw.js";

const stamp = (line, lib) => { const s = lib.settlementStamp(line); delete s.settledAt; return s; };

// ── 1. FE ↔ BE parity (Arts. 93 / 107 / 117 / 137) ───────────────────────────────────────────
const samples = [
  { base: 2400, allowances: 600, overtimeHours: 10, deductions: 100 },
  { base: 4000, allowances: 0, isSaudi: true, month: "2026-10", deductions: 1700 },
  { base: 5000, allowances: 1000, sickReduction: 250, injuryUnpaid: 100, overtimeHours: 4, holidayOvertimeHours: 8 },
  { base: 3000, allowances: 500, unpaidLeaveCut: 700, detentionCut: 200, refunds: 50, damageRefunds: 25, deductions: 1600 },
  { base: 3000, allowances: 0, currency: "USD" },
];
for (const line of samples) {
  const tag = JSON.stringify(line);
  assert.equal(be.lineNet(line), fe.lineNet(line), `net ${tag}`);
  assert.equal(be.enrichLine(line).overtimePay, fe.enrichLine(line).overtimePay, `ot ${tag}`);
  assert.equal(be.checkArticle93Gate(line).ok, fe.checkArticle93Gate(line).ok, `93 ${tag}`);
  assert.deepEqual(be.lineIssues(line), fe.lineIssues(line), `issues ${tag}`);
  assert.deepEqual(stamp(line, be), stamp(line, fe), `stamp ${tag}`);
}
assert.deepEqual(be.deriveRunTotals(samples), fe.deriveRunTotals(samples));

// Art. 107 on the backend: actual hourly (base + allowances) + 50% of basic — no longer basic × 1.5.
assert.equal(be.overtimePay(2400, 10, 600), 175);
// Art. 93 on the backend counts the employee GOSI share toward the half-wage cap.
const gosiHeavy = { base: 4000, allowances: 0, isSaudi: true, month: "2026-10", deductions: 1700 };
assert.equal(be.checkArticle93Gate(gosiHeavy).ok, false);
assert.equal(be.checkArticle93Gate(gosiHeavy).gosi, 390);
// Arts. 117 / 137 reductions reach the backend net and its settlement stamp.
const sickLine = { base: 5000, allowances: 0, sickReduction: 250, injuryUnpaid: 100 };
assert.equal(be.lineNet(sickLine), 4650);
assert.equal(be.settlementStamp(sickLine).settledSickCut, 250);
assert.equal(be.settlementStamp(sickLine).settledInjuryCut, 100);

// ── 2. Art. 107 — the run header, the gate and the payslip agree ─────────────────────────────
const otLine = { id: "a", base: 2400, allowances: 600, overtimeHours: 10 };
assert.equal(fe.enrichLine(otLine).overtimePay, 175);
assert.equal(fe.deriveRunTotals([otLine]).overtime, 175);
assert.equal(fe.lineComponents(otLine).overtimePay, 175);
assert.equal(fe.deriveRunTotals([otLine]).total, fe.lineNet(otLine));
// A settled line keeps its stamped overtime.
assert.equal(fe.enrichLine({ ...otLine, settledNet: 3100, settledOvertimePay: 150 }).overtimePay, 150);

// ── 3. Arts. 2 / 84 / 86 — commissions are wage unless excluded by agreement ─────────────────
const commissionCase = { base: 5000, allowances: 1000, profile: { commissionAmount: 800 } };
assert.equal(eosWageBase(commissionCase).wage, 6800);
assert.equal(eosWageBase({ ...commissionCase, profile: { commissionAmount: 800, eosExcludeCommissions: true } }).wage, 6000);
assert.equal(eosWageBase({ ...commissionCase, profile: { commissionAmount: 800, contract: { eosExcludeCommissions: true } } }).wage, 6000);
assert.equal(eosWageBase({ base: 5000, allowances: 1000, commission: 200 }).wage, 6200);
assert.match(citeRule("eos.allElements.cite").hintAr, /ما لم|يجوز الاتفاق على ألّا/);
assert.equal(citeRule("eos.allElements.cite").article, "86");
assert.equal(beOff.eosWageBase(commissionCase).wage, 6800);

// ── 4. Arts. 84 / 87 / 111 — measured to the exit date ───────────────────────────────────────
const exitCase = { hireDate: "2020-01-01", base: 6000, allowances: 0, contractExit: { reason: "contract_end", effectiveDate: "2025-01-01" } };
const atExit = feOff.deriveEos(exitCase);
assert.equal(atExit.endDate, "2025-01-01");
assert.ok(Math.abs(atExit.years - 5) < 0.01);
assert.equal(feOff.eosEndMs({ contractExit: { lastDay: "2024-06-30" } }), new Date(2024, 5, 30).getTime());
assert.equal(beOff.deriveEos(exitCase).endDate, "2025-01-01");
assert.equal(beOff.deriveEos(exitCase).gratuity, atExit.gratuity);
// Art. 87 window measured at the exit date, not today.
const married = { ...exitCase, gender: "female", profile: { gender: "female", marriageDate: "2024-09-01" }, contractExit: { reason: "resignation", effectiveDate: "2025-01-01" } };
assert.equal(feOff.deriveEos(married).art87, true);
// Art. 87 force majeure → full award.
assert.ok(TERMINATION_REASONS.some((r) => r.id === "worker_force_majeure" && r.article === "87"));
const fm = feOff.deriveEos({ ...exitCase, hireDate: "2022-01-01", contractExit: { reason: "worker_force_majeure", effectiveDate: "2025-01-01" } });
assert.equal(fm.art87, true);
assert.equal(fm.fraction, 1);
assert.equal(fm.citeRuleId, "eos.art87.cite");
assert.equal(beOff.deriveEos({ ...exitCase, hireDate: "2022-01-01", contractExit: { reason: "worker_force_majeure", effectiveDate: "2025-01-01" } }).fraction, 1);
const fmResign = feOff.deriveEos({ ...exitCase, hireDate: "2022-01-01", contractExit: { reason: "resignation", forceMajeure: true, effectiveDate: "2025-01-01" } });
assert.equal(fmResign.fraction, 1);
assert.equal(feOff.deriveSettlementDeadline({ reason: "worker_force_majeure", lastWorkDate: "2025-01-01", today: "2025-01-05" }).days, 14);

// ── 5. Art. 116 + Art. 2 — unpaid leave over 20 days a contract year suspends service ────────
const unpaid30 = [{ type: "unpaid", status: "approved", startDate: "2023-03-01", endDate: "2023-03-30" }];
assert.equal(feSusp.suspendedDaysFromUnpaidLeave(unpaid30, "2020-01-01", "2025-01-01"), 10);
assert.equal(beSusp.suspendedDaysFromUnpaidLeave(unpaid30, "2020-01-01", "2025-01-01"), 10);
assert.equal(feSusp.suspendedDaysFromUnpaidLeave([{ ...unpaid30[0], contractNotSuspended: true }], "2020-01-01", "2025-01-01"), 0);
assert.equal(feSusp.suspendedDaysFromUnpaidLeave([{ ...unpaid30[0], status: "pending" }], "2020-01-01", "2025-01-01"), 0);
// Two 15-day leaves in different contract years: each under 20 → nothing suspended.
assert.equal(feSusp.suspendedDaysFromUnpaidLeave([
  { type: "unpaid", status: "approved", startDate: "2021-02-01", endDate: "2021-02-15" },
  { type: "unpaid", status: "approved", startDate: "2022-02-01", endDate: "2022-02-15" },
], "2020-01-01", "2025-01-01"), 0);
const suspended = feOff.deriveEos({ ...exitCase, leaveRequests: unpaid30 });
assert.equal(suspended.suspendedDays, 10);
assert.ok(suspended.years < atExit.years);
assert.ok(Math.abs((atExit.years - suspended.years) * feOff.MS_PER_YEAR - 10 * 86400000) < 1000);

// ── 6. Arts. 116 / 93 — unpaid leave is wage not due, outside the half-wage cap ──────────────
const employeeUnpaid = { leaveRequests: [{ type: "unpaid", status: "approved", startDate: "2026-10-05", endDate: "2026-10-14" }] };
const um = unpaidLeaveMonth({ employee: employeeUnpaid, month: "2026-10", monthlyWage: 3000 });
assert.deepEqual({ days: um.days, cut: um.cut }, { days: 10, cut: 1000 });
const unpaidLine = { base: 3000, allowances: 0, deductions: 1400, unpaidLeaveCut: 1000 };
assert.equal(fe.checkArticle93Gate(unpaidLine).ok, true);
assert.ok(!fe.lineIssues(unpaidLine).includes("ARTICLE_93_EXCEEDED"));
assert.equal(fe.lineNet(unpaidLine), 600);
assert.equal(fe.settlementStamp(unpaidLine).settledUnpaidLeaveCut, 1000);
// A whole month of unpaid leave nets zero lawfully — no NET_REQUIRED.
assert.ok(!fe.lineIssues({ base: 3000, allowances: 0, unpaidLeaveCut: 3000 }).includes("NET_REQUIRED"));

// ── 7. Arts. 91 / 92(5) — damage source ──────────────────────────────────────────────────────
assert.equal(checkDamageLineGate({ amount: 100, monthlyWage: 3000, today: "2026-10-15" }).error, "DAMAGE_NOTICE_REQUIRED");
assert.equal(checkDamageLineGate({ amount: 600, monthlyWage: 3000, noticeOn: "2026-10-01", today: "2026-10-15" }).error, "ARTICLE_91_DAMAGE_CAP");
const dmg = checkDamageLineGate({ amount: 400, monthlyWage: 3000, noticeOn: "2026-10-01", today: "2026-10-15" });
assert.equal(dmg.ok, true);
assert.equal(dmg.objectionLastDay, "2026-10-22");
assert.equal(ruleValue("payroll.damage.objectionWorkingDays"), 15);
const refunds = damageRefundsFor(
  // Updated deliberately (review fix 7): the objection names its damage case — no day+amount guess.
  [{ id: "o1", type: "damage_objection", status: "approved", notifiedOn: "2026-10-01", amount: 400, damageCaseId: "DMG-2026-10-01" }],
  [{ id: "l1", source: "damage", amount: 400, damageNoticeOn: "2026-10-01" }, { id: "l2", source: "advance", amount: 300 }],
);
assert.deepEqual(refunds, [{ lineId: "l1", objectionId: "o1", caseId: "DMG-2026-10-01", amount: 400 }]);
assert.deepEqual(damageRefundsFor([{ id: "o1", type: "damage_objection", status: "pending", notifiedOn: "2026-10-01", amount: 400 }], [{ id: "l1", source: "damage", amount: 400, damageNoticeOn: "2026-10-01" }]), []);
assert.equal(fe.lineNet({ base: 3000, allowances: 0, damageRefunds: 400 }), 3400);

// ── 8. Art. 88 — final settlement ────────────────────────────────────────────────────────────
const leaver = {
  id: "e1",
  otherRequests: [{ id: "r1", type: "advance", status: "approved", amount: 2000 }, { id: "r2", type: "advance", moneyKind: "allowance", status: "approved", amount: 900 }],
  profile: { contractExit: {} },
};
const runs = [{ month: "2026-09", items: [{ employeeId: "e1", paid: true, deductionLines: [{ source: "advance", amount: 300 }] }] }];
assert.equal(outstandingAdvances(leaver, runs), 1700);
const fs = deriveFinalSettlement({ employee: leaver, eos: { total: 10000, wage: 6000 }, payrollRuns: runs, exitDate: "2026-10-12", monthlyWage: 6000, custodyDebt: 2500, extras: 0, deadline: { due: "2026-10-19" } });
assert.equal(fs.partialDays, 12);
assert.equal(fs.partialWage, 2400);
assert.equal(fs.custodyCap, 1000);
assert.equal(fs.custodySetOff, 1000);
assert.equal(fs.custodyToCourt, 1500);
assert.equal(fs.setOff, 2700);
assert.equal(fs.net, 9700);
assert.equal(fs.open, true);
const paidCase = deriveFinalSettlement({ employee: { ...leaver, profile: { contractExit: { settlementPaidAt: "2026-10-20" } } }, eos: { total: 100 }, exitDate: "2026-10-12", monthlyWage: 3000, deadline: { due: "2026-10-19" } });
assert.equal(paidCase.paidLate, true);
const closed = feOff.deriveSettlementDeadline({ reason: "contract_end", lastWorkDate: "2026-10-12", settlementPaidAt: "2026-10-15", today: "2026-11-30" });
assert.equal(closed.closed, true);
assert.equal(closed.late, false);
assert.equal(beOff.deriveSettlementDeadline({ reason: "contract_end", lastWorkDate: "2026-10-12", settlementPaidAt: "2026-10-15", today: "2026-11-30" }).closed, true);
// Set-off never drives the settlement below zero.
assert.equal(deriveFinalSettlement({ employee: leaver, eos: { total: 500 }, payrollRuns: runs, exitDate: "2026-10-01", monthlyWage: 3000 }).net, 0);

// ── 9. Art. 90(1) — weekly cycle ─────────────────────────────────────────────────────────────
assert.equal(payPeriodOf({ profile: { wageType: "daily" } }), "weekly");
assert.equal(payPeriodOf({ profile: { wageType: "piece" } }), "weekly");
assert.equal(payPeriodOf({ profile: { wageType: "monthly" } }), "monthly");
assert.equal(payPeriodOf({}), "monthly");
const weeks = weeklyPeriods("2026-10");
assert.equal(weeks.length, 5);
assert.equal(weeks[4].start, "2026-10-29");
const wline = { base: 3100, allowances: 0, weeklyPayments: [{ key: "2026-10-W1", amount: 700, paidAt: "2026-10-07T10:00:00Z" }] };
const inst = weeklyInstalments(wline, "2026-10");
assert.equal(Math.round(inst.reduce((s, r) => s + r.amount, 0) * 100) / 100, fe.lineNet(wline));
assert.equal(inst[0].paidAt, "2026-10-07T10:00:00Z");
const wgate = checkWeeklyCycleGate({ employee: { profile: { wageType: "daily" } }, line: wline, month: "2026-10", today: "2026-10-16" });
assert.equal(wgate.ok, false);
assert.equal(wgate.error, "ART90_WEEKLY_LATE");
assert.equal(wgate.late.length, 1);
assert.equal(checkWeeklyCycleGate({ employee: { profile: { wageType: "monthly" } }, line: wline, month: "2026-10", today: "2026-10-30" }).ok, true);
assert.equal(fe.linePaidAhead(wline), 700);
assert.equal(fe.lineTransferDue(wline), 2400);

// ── 10. Art. 90 + model regulation Art. 17 — payday on a rest day moves back ─────────────────
const friday = (d) => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))).getDay() === 5;
const pd = companyPayday({ payrollPayday: 27 }, "2026-11", friday); // 27 Nov 2026 is a Friday
assert.equal(pd.scheduled, "2026-11-27");
assert.equal(pd.due, "2026-11-26");
assert.equal(pd.shifted, true);
assert.equal(companyPayday({ payrollPayday: 31 }, "2026-02").scheduled, "2026-02-28");
assert.equal(companyPayday({}, "2026-11"), null);
const ov = wageOverdue({ settings: { payrollPayday: 27 }, month: "2026-11", items: [{ base: 3000, allowances: 0 }], today: "2026-11-27", isOff: friday, employeeOf: () => ({}) });
assert.equal(ov.overdue, true);
assert.equal(ov.error, "WAGE_OVERDUE");
assert.equal(wageOverdue({ settings: { payrollPayday: 27 }, month: "2026-11", items: [{ base: 3000, paid: true }], today: "2026-11-30", isOff: friday }).overdue, false);

// ── 11. Art. 109 — annual leave paid in advance ──────────────────────────────────────────────
const annual = { id: "lv1", type: "annual", status: "approved", startDate: "2026-10-20", endDate: "2026-10-29" };
assert.equal(checkAnnualLeaveAdvanceGate({ leave: annual, today: "2026-10-16" }).error, "ART109_ADVANCE_UNPAID");
assert.equal(checkAnnualLeaveAdvanceGate({ leave: annual, today: "2026-10-01" }).ok, true);
assert.equal(checkAnnualLeaveAdvanceGate({ leave: { ...annual, advancePaidAt: "2026-10-15" }, today: "2026-10-21" }).ok, true);
assert.equal(checkAnnualLeaveAdvanceGate({ leave: annual, today: "2026-10-21" }).started, true);
assert.equal(annualLeaveAdvanceAmount({ days: 10, monthlyWage: 6000 }), 2000);
assert.equal(pendingAnnualAdvances([{ id: "e", leaveRequests: [annual] }], "2026-10-16").length, 1);
assert.equal(fe.linePaidAhead({ leaveAdvances: [{ amount: 2000, paidAt: "x" }] }), 2000);

// ── 12. Art. 107(3) — holiday / Eid hours are overtime, no ×2 ────────────────────────────────
assert.equal(fe.eidPay(2400, 8, 600), fe.overtimePay(2400, 8, 600));
assert.equal(fe.holidayPay(2400, 8, 600), 140);
assert.equal(fe.lineOvertimePay({ base: 2400, allowances: 600, overtimeHours: 2, holidayOvertimeHours: 8 }), fe.overtimePay(2400, 10, 600));
const isHoliday = (d) => d === "2026-09-23";
const hol = holidayOvertimeHours({
  employeeId: "e1",
  month: "2026-09",
  attendance: [
    { employeeId: "e1", date: "2026-09-23", checkInAt: "2026-09-23T08:00:00Z", checkOutAt: "2026-09-23T16:00:00Z" },
    { employeeId: "e1", date: "2026-09-24", checkInAt: "2026-09-24T08:00:00Z", checkOutAt: "2026-09-24T16:00:00Z" },
  ],
  otDecisions: { "e1:2026-09-23": { decision: "approve", overtimeMinutes: 60 } },
  isHoliday,
});
assert.equal(hol.hours, 7); // 8 worked − 1 already approved as overtime
const flagged = holidayOvertimeHours({
  employeeId: "e1",
  month: "2026-09",
  attendance: [{ employeeId: "e1", date: "2026-09-23", checkInAt: "2026-09-23T08:00:00Z", checkOutAt: "2026-09-23T16:00:00Z" }],
  otDecisions: { "e1:2026-09-23": { decision: "approve", overtimeMinutes: 480, holiday: true } },
  isHoliday,
});
assert.equal(flagged.hours, 0);
assert.equal(flagged.fromDecisions, 8);

// ── 13. Art. 92(3,4,6) — savings fund, housing scheme, court debt ────────────────────────────
assert.equal(citeRule("payroll.savingsFund.cite").article, "92");
assert.equal(citeRule("payroll.housingScheme.cite").article, "92");
assert.equal(ruleValue("payroll.courtDebt.capRatio"), 0.25);
assert.deepEqual(COURT_DEBT_KINDS.map((k) => k.key), ["maintenance", "food", "clothing", "housing", "other"]);
assert.equal(checkCourtDebtGate({ amount: 800, monthlyWage: 3000, kind: "maintenance" }).error, "COURT_DEBT_CAP");
assert.equal(checkCourtDebtGate({ amount: 800, monthlyWage: 3000, kind: "maintenance", rulingAllowsMore: true }).ok, true);
assert.equal(checkCourtDebtGate({ amount: 500, monthlyWage: 3000, kind: "other", pending: [{ kind: "maintenance", amount: 1000 }] }).error, "COURT_DEBT_ORDER");
assert.equal(checkCourtDebtGate({ amount: 750, monthlyWage: 3000, kind: "food" }).ok, true);

// ── 14. Art. 96 — average wage for piece / commission workers ────────────────────────────────
assert.equal(isAverageWageBasis({ profile: { wageType: "piece" } }), true);
assert.equal(isAverageWageBasis({ profile: { baseSalary: 0, commissionAmount: 3000 } }), true);
assert.equal(isAverageWageBasis({ profile: { wageType: "monthly", baseSalary: 5000 } }), false);
const pieceRuns = [
  { month: "2025-11", items: [{ employeeId: "p", base: 3000, allowances: 0, settledNet: 3000 }] },
  { month: "2026-03", items: [{ employeeId: "p", base: 5000, allowances: 0, paid: true }] },
  { month: "2026-10", items: [{ employeeId: "p", base: 9999, allowances: 0 }] }, // open line — not settled
  { month: "2024-01", items: [{ employeeId: "p", base: 1, allowances: 0, paid: true }] }, // older than a year
];
const avg = averageActualWage(pieceRuns, "p", "2026-10");
assert.equal(avg.average, 4000);
assert.equal(avg.months, 2);
const avgEos = feOff.deriveEos({ ...exitCase, base: 9000, averageWage: 4000, averageWageBasis: true });
assert.equal(avgEos.wage, 4000);
assert.equal(avgEos.averageBasis, true);

// ── 15. Arts. 90 / 97 / 89 ───────────────────────────────────────────────────────────────────
assert.ok(fe.lineIssues({ base: 3000, allowances: 0, currency: "USD" }).includes("CURRENCY_NOT_SAR"));
assert.ok(!fe.lineIssues({ base: 3000, allowances: 0, currency: "SAR" }).includes("CURRENCY_NOT_SAR"));
assert.ok(be.lineIssues({ base: 3000, allowances: 0, currency: "EUR" }).includes("CURRENCY_NOT_SAR"));
// Detention from 2026-01-01: October is past day 180 for part of... days 274+ → all unpaid.
const det = { from: "2026-09-01" };
const sep = detentionMonth({ detention: det, month: "2026-09", monthlyWage: 3000 });
assert.deepEqual({ ...sep, dayKeys: undefined }, { days: 30, halfDays: 30, unpaidDays: 0, cut: 1500, dayKeys: undefined });
const longDet = detentionMonth({ detention: { from: "2026-01-01", to: "2026-07-31" }, month: "2026-06", monthlyWage: 3000 });
assert.equal(longDet.halfDays + longDet.unpaidDays, 30);
assert.ok(longDet.unpaidDays > 0); // day 181 onward is unpaid
assert.equal(detentionRefund({ detention: { from: "2026-09-01", to: "2026-09-30", acquittedAt: "2026-10-05" }, monthlyWage: 3000 }), 1500);
assert.equal(detentionRefund({ detention: { from: "2026-09-01", to: "2026-09-30" }, monthlyWage: 3000 }), 0);
assert.equal(fe.lineNet({ base: 3000, allowances: 0, detentionCut: 1500 }), 1500);
assert.equal(checkMinimumWageGate({ line: { base: 3500, allowances: 0 }, minimum: 4000 }).error, "BELOW_MINIMUM_WAGE");
assert.equal(checkMinimumWageGate({ line: { base: 3500, allowances: 0 } }).ok, true);
assert.equal(citeRule("payroll.minimumWage.cite").article, "89");

// ── Combined wage sheet (implementing regulations Art. 5(2)) ─────────────────────────────────
const csv = wageSheetCsv([{ employeeId: "e1", employeeName: "سعد", base: 2400, allowances: 600, overtimeHours: 10, deductions: 100, unpaidLeaveCut: 200 }], { month: "2026-10", ar: true });
const [head, row] = csv.replace(/^﻿/, "").split("\r\n");
assert.equal(head.split(",").length, row.split(",").length);
assert.match(row, /^2026-10,e1,سعد,2400,600,0,10,0,175,0,100,0,200,2875/);

console.log("pay law ok");
