// Wage lines and the Labour Law: Art. 2 (actual wage), 61 (housing), 86 (commission), 107 (overtime), 148 (transport).
import assert from "node:assert/strict";
import { allowanceLawRows, employeeWageSplit, inKindOf, wageExtras } from "../src/lib/employeeFileView.js";
import { hourlyFromBase, overtimePay } from "../src/lib/payrollDerivations.js";
import { derivePayrollWagePatch } from "../src/lib/payrollWageSync.js";

// Art. 107 — hourly (actual) wage + 50% of the basic hourly wage.
assert.equal(overtimePay(6000, 10), Math.round(hourlyFromBase(6000) * 1.5 * 10 * 100) / 100, "no allowances → time-and-a-half of basic");
assert.equal(overtimePay(6000, 10, 2000), Math.round((8000 / 240 + (6000 / 240) * 0.5) * 10 * 100) / 100, "allowances enter the hourly wage, the 50% stays on basic");

// Art. 2 named lines are always added.
const profile = { baseSalary: 6000, housingAllowance: 1500, transportAllowance: 500, otherAllowances: 0, hazardAllowance: 300, livingAllowance: 200, commissionAmount: 1000 };
assert.deepEqual(wageExtras(profile), { hazard: 300, living: 200, commission: 1000, remote: 0, medical: 0, meals: 0, sum: 1500 });
// Site allowances (remote area, distance from care, meals) are named lines too.
{
  const site = { ...profile, remoteAreaAllowance: 900, medicalDistanceAllowance: 400, mealAllowance: 450 };
  assert.deepEqual(wageExtras(site), { hazard: 300, living: 200, commission: 1000, remote: 900, medical: 400, meals: 450, sum: 3250 });
  const w = employeeWageSplit(site, { profile: site });
  assert.equal(w.total, 6000 + 1500 + 500 + 3250);
  assert.equal(w.remote, 900);
}
const split = employeeWageSplit(profile, { profile });
assert.equal(split.total, 6000 + 1500 + 500 + 1500);
assert.equal(split.otherPlain, 0);
const lump = employeeWageSplit({ baseSalary: 5000, allowances: 1000, hazardAllowance: 250 }, { profile: { baseSalary: 5000, allowances: 1000, hazardAllowance: 250 } });
assert.equal(lump.total, 6250, "a lump plus a named Art. 2 line");

// Art. 2/5 — in-kind valued at most two months of basic a year unless the contract says more.
assert.equal(inKindOf({ baseSalary: 6000, inKindMonthly: 5000 }).monthly, 1000);
assert.equal(inKindOf({ baseSalary: 6000, inKindMonthly: 5000, inKindByContract: true }).monthly, 5000);
assert.equal(inKindOf({ housingMode: "provided" }).housingProvided, true);
assert.equal(inKindOf({ transportMode: "regular" }).transportRegular, true);

// The allowance card names every line; commission notes Art. 86; in-kind is not cash.
const law = allowanceLawRows(split, true, inKindOf({ ...profile, inKindMonthly: 400 }));
assert.ok(law.rows.some((row) => row.key === "hazard" && row.amount === 300));
assert.ok(law.rows.some((row) => row.key === "living" && row.amount === 200));
assert.ok(law.rows.some((row) => row.key === "commission" && /86/.test(row.cite)));
assert.ok(law.rows.some((row) => row.key === "inkind" && row.cash === false));
assert.equal(law.cash, 9500);
assert.equal(law.total, 9900);

// Payroll carries the named lines and adds them on a lump file.
const patch = derivePayrollWagePatch({ employeeId: "e1", base: 0, allowances: 0 }, { id: "e1", profile: { baseSalary: 5000, allowances: 1000, hazardAllowance: 250 } }, {});
assert.equal(patch.fields.allowances, 1250);
assert.equal(patch.fields.hazardAllowance, 250);

console.log("wage-law: PASS");

// GOSI contributory wage (employer guide): basic + housing + commissions, cap 45,000, floors 1,500 / 400.
{
  const { gosiContributoryWage } = await import("../src/lib/payrollDerivations.js");
  const assert2 = (await import("node:assert/strict")).default;
  assert2.equal(gosiContributoryWage({ base: 7600, housingAllowance: 1900, transportAllowance: 760, allowances: 2660 }).wage, 9500, "transport stays out");
  assert2.equal(gosiContributoryWage({ base: 7600, housingAllowance: 1900, commissionAmount: 500 }).wage, 10000, "commission counts");
  assert2.equal(gosiContributoryWage({ base: 50000, housingAllowance: 5000 }).wage, 45000, "ceiling");
  assert2.equal(gosiContributoryWage({ base: 1000, housingAllowance: 0 }).wage, 1500, "annuity floor");
  assert2.equal(gosiContributoryWage({ base: 300, housingAllowance: 0 }, { saudi: false }).wage, 400, "hazard floor");
  assert2.equal(gosiContributoryWage({ base: 7600, allowances: 2660 }).lump, true, "no split keeps the lump");
  console.log("gosi contributory OK");
}
