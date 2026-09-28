import assert from "node:assert/strict";
import {
  assignWageFields,
  canonicalizeGosiFacts,
  factById,
  gosiSubscriberClass,
  mayWrite,
  PREVIEW_ESTABLISHMENT_NUMBER,
  readCompanyEstablishment,
  readGosiRegisteredAt,
  readSubscriberNumber,
  readWageFields,
  registrationForPayroll,
  writeCompanyEstablishment,
  writerRoles,
} from "../src/lib/hrFacts.js";
import { ruleValue } from "../src/lib/laborRules.js";
import { derivePayrollWagePatch } from "../src/lib/payrollWageSync.js";

const companyA = { id: "co-a", employees: [] };
const companyB = { id: "co-b", employees: [] };
writeCompanyEstablishment(companyA, PREVIEW_ESTABLISHMENT_NUMBER);
writeCompanyEstablishment(companyB, "500000001");
assert.equal(readCompanyEstablishment(companyA), PREVIEW_ESTABLISHMENT_NUMBER);
assert.equal(readCompanyEstablishment(companyB), "500000001");
assert.equal(companyA.employees.length, 0);
assert.equal(factById("company.establishment").scope, "company");
assert.equal(factById("company.establishment").path, "gosiEstablishment");
assert.equal(factById("employee.subscriber").scope, "employee");
assert.equal(factById("employee.subscriber").path, "profile.gosiNumber");
assert.notEqual(factById("company.establishment").path, factById("employee.subscriber").path);

const messy = {
  settings: { orgType: "company", gosiEstablishment: "" },
  employees: [{
    id: "emp_owner_preview",
    name: "نيار عبدالله",
    hireDate: "2026-01-01",
    profile: {
      gosiNumber: PREVIEW_ESTABLISHMENT_NUMBER,
      nationality: "سعودي",
      baseSalary: 15500,
      hireDate: "2026-01-01",
    },
  }],
};
assert.equal(canonicalizeGosiFacts(messy), true);
assert.equal(readCompanyEstablishment(messy), PREVIEW_ESTABLISHMENT_NUMBER);
assert.equal(messy.settings.gosiEstablishment, undefined);
assert.equal(messy.settings.orgType, "company");
assert.equal(messy.employees[0].profile.gosiNumber, undefined);
assert.equal(readGosiRegisteredAt(messy.employees[0]), "");
assert.equal(Object.prototype.hasOwnProperty.call(messy.employees[0].profile, "gosiRegisteredAt"), false);
assert.equal(gosiSubscriberClass(readGosiRegisteredAt(messy.employees[0])), "unset");
assert.equal(canonicalizeGosiFacts(messy), false);

const kept = {
  id: "co-kept",
  gosiEstablishment: "500000001",
  employees: [{ id: "emp_owner_preview", profile: { gosiNumber: "1099" } }],
};
assert.equal(canonicalizeGosiFacts(kept), false);
assert.equal(readSubscriberNumber(kept.employees[0]), "1099");
assert.equal(readCompanyEstablishment(kept), "500000001");
assert.notEqual(readSubscriberNumber(kept.employees[0]), readCompanyEstablishment(kept));

assert.equal(gosiSubscriberClass("2024-07-02"), "old");
assert.equal(gosiSubscriberClass("2024-07-03"), "new");
assert.equal(gosiSubscriberClass(""), "unset");
assert.equal(gosiSubscriberClass(null), "unset");
assert.notEqual(gosiSubscriberClass(""), "new");
const hiredOnly = { hireDate: "2024-07-03", profile: { hireDate: "2024-07-03", nationality: "سعودي" } };
assert.equal(readGosiRegisteredAt(hiredOnly), "");
assert.equal(registrationForPayroll(hiredOnly, { hireDate: "2024-07-03" }), "");
assert.equal(gosiSubscriberClass(registrationForPayroll(hiredOnly, {})), "unset");
assert.equal(
  registrationForPayroll({ profile: { gosiRegisteredAt: "2024-07-03", hireDate: "2020-01-15" } }, { gosiRegisteredAt: "2020-01-01" }),
  "2024-07-03",
);

const profile = { nationality: "سعودي" };
assignWageFields(profile, {
  baseSalary: 15500,
  housingAllowance: 0,
  transportAllowance: 0,
  otherAllowances: 0,
  allowances: 0,
});
const round = readWageFields({ profile });
assert.equal(round.baseSalary, 15500);
assert.equal(round.housingAllowance, 0);
assert.equal(round.transportAllowance, 0);
assert.equal(round.otherAllowances, 0);
assert.equal(round.allowances, 0);
assert.equal(round.nationality, "سعودي");
assert.equal(round.gosiRegisteredAt, "");
assignWageFields(profile, { housingAllowance: 400, transportAllowance: 150, otherAllowances: 50 });
const again = readWageFields({ profile });
assert.equal(again.baseSalary, 15500);
assert.equal(again.housingAllowance, 400);
assert.equal(again.transportAllowance, 150);
assert.equal(again.otherAllowances, 50);

assert.equal(factById("statute.employeeRate").writer, "statute");
assert.equal(factById("statute.employeeRate").ruleId, "compliance.gosi.employeeRate");
assert.equal(factById("statute.employerRate").ruleId, "compliance.gosi.employerRate");
assert.equal(factById("statute.newAnnuity").writer, "statute");
assert.equal(factById("statute.newAnnuity").ruleId, "compliance.gosi.newAnnuityRate");
assert.deepEqual(writerRoles("statute.employeeRate"), []);
assert.equal(mayWrite("statute.newAnnuity", "owner"), false);
assert.equal(mayWrite("statute.employerRate", "hr"), false);
assert.equal(mayWrite("company.establishment", "owner"), true);
assert.equal(mayWrite("employee.gosiRegisteredAt", "hr"), true);
assert.equal(mayWrite("payroll.gosiEmployee", "owner"), false);
assert.equal(mayWrite("payroll.net", "hr"), false);
assert.equal(factById("payroll.net").stored, false);
assert.equal(factById("employee.gosiRegisteredAt").distinctFrom, "hireDate");
assert.equal(ruleValue(factById("statute.employeeRate").ruleId), 0.0975);
assert.equal(ruleValue(factById("statute.employerRate").ruleId), 0.1175);

const owner = {
  id: "emp_owner_preview",
  name: "نيار عبدالله",
  hireDate: "2026-01-01",
  profile: { baseSalary: 15500, nationality: "سعودي", hireDate: "2026-01-01" },
};
const ownerPatch = derivePayrollWagePatch(
  { employeeId: "emp_owner_preview", base: 15500, allowances: 0, paid: false, qiwaWage: 15500 },
  owner,
  { month: "2026-09", otDecisions: {} },
);
assert.equal(readGosiRegisteredAt(owner), "");
assert.equal(ownerPatch.fields.base, 15500);
assert.equal(ownerPatch.fields.allowances, 0);
assert.equal(ownerPatch.fields.gosiRegisteredAt, "");
assert.equal(ownerPatch.fields.gosiClass, "unset");
assert.equal(ownerPatch.fields.gosiEmployee, 1511.25);
assert.equal(ownerPatch.fields.gosiEmployeeRate, 0.0975);

console.log("hr facts ok");
