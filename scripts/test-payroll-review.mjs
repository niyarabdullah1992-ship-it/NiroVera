import assert from "node:assert/strict";
import { monthVariance, allowanceMatrix, wpsPrecheck, employerCost, payrollStages, previousMonth } from "../src/lib/payrollReview.js";
import { sickMonth, leaveEffects } from "../src/lib/payrollLeaveEffects.js";
import { lineNet, lineSickCut, settlementStamp } from "../src/lib/payrollDerivations.js";

assert.equal(previousMonth("2026-01"), "2025-12");
assert.equal(previousMonth("2026-10"), "2026-09");

// Variance: a 15% rise is flagged with its reason; new and left people are named.
const base = (id, b, extra = {}) => ({ employeeId: id, employeeName: id, base: b, allowances: 0, bonus: 0, deductions: 0, currency: "SAR", ...extra });
const prev = [base("a", 5000), base("b", 6000), base("gone", 4000)];
const now = [base("a", 5000, { allowances: 900, remoteAreaAllowance: 900 }), base("b", 6000), base("new", 3000)];
const v = monthVariance(now, prev, { ar: true });
const a = v.rows.find((r) => r.employeeId === "a");
assert.equal(a.flag, "big");
assert.equal(a.delta, 900);
assert.deepEqual(a.reasons, ["+900 بدل منطقة نائية"]);
assert.equal(v.rows.find((r) => r.employeeId === "b").flag, "");
assert.equal(v.rows.find((r) => r.employeeId === "new").flag, "new");
assert.equal(v.rows.find((r) => r.employeeId === "gone").flag, "left");
assert.equal(v.flagged, 3);
// A deduction reads as a minus on the net.
const d = monthVariance([base("a", 5000, { deductions: 600 })], [base("a", 5000)], { ar: true });
assert.deepEqual(d.rows[0].reasons, ["−600 خصومات بسند"]);

// Matrix: kinds nobody gets are dropped; the lump that no kind explains is "other".
const m = allowanceMatrix([
  { stationId: "s1", allowances: 2000, housingAllowance: 1500, transportAllowance: 500 },
  { stationId: "s1", allowances: 1300, remoteAreaAllowance: 900, mealAllowance: 400 },
  { stationId: "s2", allowances: 700 },
]);
assert.deepEqual(m.kinds.map((k) => k.id), ["housing", "transport", "remote", "meals"]);
assert.equal(m.rows.find((r) => r.stationId === "s2").other, 700);
assert.equal(m.totals.remote, 900);

// WPS precheck: bad IBAN and missing bank name block; a Saudi under 4,000 is a note.
const pre = wpsPrecheck(
  [{ employeeId: "x", base: 3000, allowances: 500, qiwaWage: 3500, isSaudi: true }],
  () => ({ name: "س", profile: { nationalId: "1012345678", iban: "SA12", bankName: "" } }),
  { ar: true, month: "2026-10", now: new Date(2026, 9, 15) },
);
assert.deepEqual(pre.rows[0].blockers, ["آيبان غير مكتمل", "اسم البنك فارغ"]);
assert.equal(pre.rows[0].notes.length, 1);
assert.equal(pre.blocked, 1);
assert.equal(typeof pre.daysLeft, "number");

// Employer cost: gross + employer GOSI + EOS accrual (half a month a year under five years).
const cost = employerCost({ base: 6000, allowances: 2000, housingAllowance: 1500, isSaudi: true, gosiEmployerRate: 0.1175 }, { serviceYears: 2 });
assert.equal(cost.gosiEmployer, Math.round(7500 * 0.1175 * 100) / 100);
assert.equal(cost.eosAccrual, Math.round(8000 * 0.5 / 12 * 100) / 100);
assert.equal(employerCost({ base: 6000, allowances: 0 }, { serviceYears: 6 }).eosAccrual, 500);

// Stages: approval waits while a blocking stage has work; the review is a note, not a block.
const st = payrollStages({ run: { status: "draft" }, items: [1], issueCount: 2, variance: { flagged: 1 }, wps: { blocked: 0, daysLeft: 20 } }, true);
assert.equal(st.stages.find((s) => s.id === "lines").state, "todo");
assert.equal(st.stages.find((s) => s.id === "review").state, "note");
assert.equal(st.stages.find((s) => s.id === "approve").state, "wait");
assert.equal(st.currentId, "lines");
const ready = payrollStages({ run: { status: "draft" }, items: [1], wps: { blocked: 0, daysLeft: 20 } }, true);
assert.equal(ready.stages.find((s) => s.id === "approve").state, "todo");
assert.equal(payrollStages({ run: { status: "sent" }, items: [1] }).stages.find((s) => s.id === "wps").state, "done");

// Art. 117 bands: 30 full, then 60 at three-quarters, then 30 unpaid — counted from the first sick leave.
const emp = { leaveRequests: [
  { type: "sick", status: "approved", startDate: "2026-07-01", endDate: "2026-08-29" }, // 60 days
  { type: "sick", status: "approved", startDate: "2026-09-25", endDate: "2026-10-14" }, // 6 in Sep + 14 in Oct
] };
const oct = sickMonth({ employee: emp, month: "2026-10", monthlyWage: 9000 });
assert.equal(oct.days, 14);
assert.equal(oct.fullDays, 0);
assert.equal(oct.quarterDays, 14, "days 67–80 of the year are at three-quarters");
assert.equal(oct.reduction, Math.round(14 * 300 * 0.25 * 100) / 100);
assert.equal(oct.unpaid, 0);
const july = sickMonth({ employee: emp, month: "2026-07", monthlyWage: 9000 });
assert.equal(july.fullDays, 30);
assert.equal(july.quarterDays, 1);
const none = sickMonth({ employee: { leaveRequests: [] }, month: "2026-10", monthlyWage: 9000 });
assert.equal(none.days, 0);
const fx = leaveEffects({ employee: emp, month: "2026-10", monthlyWage: 9000, ar: true });
assert.equal(fx.rows[0].id, "sick");
assert.equal(fx.rows[0].amount, -oct.reduction);

// The net carries the sick cut, and a settled line keeps it.
const line = { base: 9000, allowances: 0, bonus: 0, deductions: 0, currency: "SAR", sickReduction: 1050, sickUnpaid: 0 };
assert.equal(lineSickCut(line), 1050);
assert.equal(lineNet(line), 9000 - 1050);
const stamp = settlementStamp(line);
assert.equal(stamp.settledSickCut, 1050);
assert.equal(lineNet({ ...line, ...stamp, sickReduction: 0 }), 9000 - 1050);
console.log("payroll review ok");
{
  // Art. 92: a manual deduction (a private right) needs the worker's written consent.
  const src = (await import("node:fs")).readFileSync(new URL("../src/lib/payrollDeductions.js", import.meta.url), "utf8");
  assert.match(src, /line\.source === "manual" && line\.consent !== true\) return "CONSENT_REQUIRED"/);
  // Art. 93 text follows the amended Law: the Labour Court, not the old commission.
  const texts = (await import("node:fs")).readFileSync(new URL("../src/lib/laborArticleTexts.js", import.meta.url), "utf8");
  assert.match(texts, /ما لم يثبت لدى المحكمة العمالية إمكان الزيادة/);
  console.log("art 92/93 ok");
}
