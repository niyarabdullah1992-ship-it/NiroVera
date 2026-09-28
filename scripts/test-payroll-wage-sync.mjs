import assert from "node:assert/strict";
import { gosiLine, lineComponents } from "../src/lib/payrollDerivations.js";
import { derivePayrollWagePatch, facePayrollItem } from "../src/lib/payrollWageSync.js";

const month = "2026-09";

const saudi = {
  id: "e1",
  nationality: "سعودي",
  profile: {
    nationality: "سعودي",
    nationalId: "1099887766",
    baseSalary: 7600,
    housingAllowance: 1900,
    transportAllowance: 760,
  },
};
const saudiLine = { employeeId: "e1", base: 7600, allowances: 0, paid: false, qiwaWage: null };
const saudiPatch = derivePayrollWagePatch(saudiLine, saudi, {
  month,
  otDecisions: { "e1:2026-09-03": { decision: "approve", overtimeMinutes: 540 } },
});
assert.equal(saudiPatch.split, true);
assert.equal(saudiPatch.fields.housingAllowance, 1900);
assert.equal(saudiPatch.fields.transportAllowance, 760);
assert.equal(saudiPatch.fields.allowances, 2660);
assert.equal(saudiPatch.fields.overtimeHours, 9);
assert.equal(saudiPatch.fields.isSaudi, true);
assert.equal(saudiPatch.fields.gosiEmployee, 1000.35);
assert.equal(lineComponents({ ...saudiLine, ...saudiPatch.fields }).gosiEmployee, 1000.35);
assert.equal(lineComponents({ ...saudiLine, ...saudiPatch.fields }).overtimeHours, 9);

const lumpPerson = {
  id: "e2",
  profile: { nationality: "سعودي", baseSalary: 7600, allowances: 2660 },
};
const lumpPatch = derivePayrollWagePatch(
  { employeeId: "e2", base: 7600, allowances: 2660, paid: false, qiwaWage: 10260 },
  lumpPerson,
  { month, otDecisions: {} },
);
assert.equal(lumpPatch.split, false);
assert.equal(lumpPatch.fields.housingAllowance, undefined);
assert.equal(lumpPatch.fields.allowances, 2660);
assert.equal(lumpPatch.fields.overtimeHours, 0);
assert.equal(lumpPatch.persistProfile, null);
const lumpFaced = facePayrollItem(
  { employeeId: "e2", base: 7600, allowances: 2660, housingAllowance: 1900, paid: false },
  lumpPerson,
  { month, otDecisions: {} },
);
assert.equal(lumpFaced.housingAllowance, undefined);

const mismatch = derivePayrollWagePatch(
  { employeeId: "e3", base: 7600, allowances: 1500, paid: false },
  { id: "e3", profile: { baseSalary: 7600, allowances: 1500, contract: { housingAllowance: 1900, transportAllowance: 760 } } },
  { month, otDecisions: {} },
);
assert.equal(mismatch.split, false);
assert.equal(mismatch.fields.allowances, 1500);
assert.equal(mismatch.persistProfile, null);

const matched = derivePayrollWagePatch(
  { employeeId: "e4", base: 7600, allowances: 2660, paid: false },
  { id: "e4", profile: { baseSalary: 7600, allowances: 2660, nationality: "سعودي", contract: { housing: 1900, transport: 760 } } },
  { month, otDecisions: {} },
);
assert.equal(matched.split, true);
assert.equal(matched.persistProfile.housingAllowance, 1900);
assert.equal(matched.fields.transportAllowance, 760);

const expat = derivePayrollWagePatch(
  { employeeId: "e5", base: 7500, allowances: 1500, paid: false },
  { id: "e5", nationality: "مصري", profile: { nationality: "مصري", nationalId: "2123456789", baseSalary: 7500, allowances: 1500 } },
  { month, otDecisions: { "e5:2026-09-04": { decision: "approve", overtimeMinutes: 120 } } },
);
assert.equal(expat.fields.isSaudi, false);
assert.equal(expat.fields.gosiEmployee, 0);
assert.equal(expat.fields.overtimeHours, 2);

const unknown = derivePayrollWagePatch(
  { employeeId: "e6", base: 8000, allowances: 0, paid: false },
  { id: "e6", profile: { baseSalary: 8000 } },
  { month, otDecisions: {} },
);
assert.equal(unknown.fields.isSaudi, null);
assert.equal(unknown.fields.gosiEmployee, 0);

const byId = derivePayrollWagePatch(
  { employeeId: "e7", base: 4000, allowances: 0, paid: false },
  { id: "e7", nationalId: "1099000111", profile: { baseSalary: 4000, allowances: 0 } },
  { month, otDecisions: {} },
);
assert.equal(byId.fields.isSaudi, true);
assert.equal(byId.fields.gosiEmployee, 390);

assert.equal(derivePayrollWagePatch({ employeeId: "e1", paid: true, base: 1 }, saudi, { month, otDecisions: {} }), null);

const kept = derivePayrollWagePatch(
  { employeeId: "e8", base: 18000, allowances: 3000, paid: false, qiwaWage: 21000 },
  { id: "e8", profile: { nationality: "سعودي" } },
  { month, otDecisions: {} },
);
assert.equal(kept.fields.base, 18000);
assert.equal(kept.fields.allowances, 3000);
assert.equal(kept.fields.gosiEmployee, 2047.5);
assert.equal(kept.fields.overtimeHours, 0);

const owner = {
  id: "emp_owner_preview",
  profile: { baseSalary: 15500, nationality: "سعودي" },
};
const ownerLine = { employeeId: "emp_owner_preview", base: 15500, allowances: 0, paid: false, qiwaWage: 15500 };
const ownerPatch = derivePayrollWagePatch(ownerLine, owner, { month, otDecisions: {} });
assert.equal(ownerPatch.fields.base, 15500);
assert.equal(ownerPatch.fields.housingAllowance, 0);
assert.equal(ownerPatch.fields.transportAllowance, 0);
assert.equal(ownerPatch.fields.otherAllowances, 0);
assert.equal(ownerPatch.fields.overtimeHours, 0);
assert.equal(ownerPatch.fields.isSaudi, true);
assert.equal(ownerPatch.fields.gosiEmployee, 1511.25);
const withSubscriberNumber = derivePayrollWagePatch(ownerLine, {
  ...owner,
  profile: { ...owner.profile, gosiNumber: "634647848" },
}, { month, otDecisions: {} });
assert.equal(withSubscriberNumber.fields.gosiEmployee, 1511.25);
const ownerFaced = facePayrollItem(ownerLine, owner, { month, otDecisions: {} });
assert.equal(ownerFaced.housingAllowance, 0);
assert.equal(ownerFaced.gosiEmployee, 1511.25);
assert.equal(ownerFaced.gosiClass, "unset");
assert.equal(ownerFaced.gosiRegisteredAt, "");
const hiredAtThisCompany = derivePayrollWagePatch(ownerLine, {
  ...owner,
  hireDate: "2026-01-01",
  profile: { ...owner.profile, hireDate: "2026-01-01" },
}, { month, otDecisions: {} });
assert.equal(hiredAtThisCompany.fields.gosiEmployee, 1511.25);
assert.equal(hiredAtThisCompany.fields.gosiClass, "unset");

const emptyDate = derivePayrollWagePatch(
  { employeeId: "e-empty", base: 10000, allowances: 0, paid: false },
  { id: "e-empty", profile: { nationality: "سعودي", baseSalary: 10000, allowances: 0 } },
  { month, otDecisions: {} },
);
assert.equal(emptyDate.fields.isSaudi, true);
assert.equal(emptyDate.fields.gosiClass, "unset");
assert.equal(emptyDate.fields.gosiEmployee, 975);
assert.equal(emptyDate.fields.gosiEmployeeRate, 0.0975);

const oldSubscriber = derivePayrollWagePatch(
  { employeeId: "e-old", base: 10000, allowances: 0, paid: false },
  { id: "e-old", profile: { nationality: "سعودي", baseSalary: 10000, gosiRegisteredAt: "2024-07-02", hireDate: "2026-02-01" } },
  { month, otDecisions: {} },
);
assert.equal(oldSubscriber.fields.gosiClass, "old");
assert.equal(oldSubscriber.fields.gosiEmployee, 975);
assert.equal(oldSubscriber.fields.gosiEmployerRate, 0.1175);

const newSubscriber = derivePayrollWagePatch(
  { employeeId: "e-new", base: 10000, allowances: 0, paid: false },
  { id: "e-new", profile: { nationality: "سعودي", baseSalary: 10000, gosiRegisteredAt: "2024-07-03", hireDate: "2024-07-03" } },
  { month, otDecisions: {} },
);
assert.equal(newSubscriber.fields.gosiClass, "new");
assert.equal(newSubscriber.fields.gosiBlocked, false);
assert.equal(newSubscriber.fields.gosiEmployee, 1075);
assert.equal(newSubscriber.fields.gosiEmployeeRate, 0.1075);
assert.equal(newSubscriber.fields.gosiEmployerRate, 0.1275);
const newQuote = gosiLine({ base: 10000, allowances: 2000, bonus: 4000 }, {
  saudi: true,
  registeredAt: "2025-08-01",
  onDate: "2026-09",
});
assert.equal(newQuote.base, 12000);
assert.equal(newQuote.employeeShare, 1290);
assert.equal(newQuote.employerShare, 1530);
assert.equal(gosiLine({ base: 3333, allowances: 0 }, { saudi: true, onDate: "2026-09-28" }).employeeShare, 324.97);

const blockedNew = gosiLine({ base: 10000, allowances: 0 }, {
  saudi: true,
  registeredAt: "2024-07-03",
  onDate: "2024-06-15",
});
assert.equal(blockedNew.blocked, true);
assert.equal(blockedNew.reason, "نسبة المشترك الجديد غير مثبتة");
assert.equal(blockedNew.employeeShare, 0);
assert.equal(blockedNew.employerShare, 0);
const ownerParts = lineComponents({ ...ownerLine, ...ownerPatch.fields });
assert.equal(ownerParts.overtimePay, 0);
assert.equal(ownerParts.base + ownerParts.allowances + ownerParts.bonus + ownerParts.overtimePay, 15500);
assert.equal(ownerParts.net, 13988.75);

console.log("payroll wage sync ok");
