import assert from "node:assert/strict";
import {
  assignEmployeeNumber,
  ensureEmployeeNumbers,
  readEmployeeNo,
} from "../src/lib/employeeNumber.js";

const year = new Date().getFullYear();

const alpha = { employees: [], settings: {} };
const first = { id: "a", profile: { hireDate: "2021-04-01" } };
alpha.employees.push(first);
assert.equal(assignEmployeeNumber(alpha, first, { hireDate: "2021-04-01" }).employeeNo, "NV-2021-0001");

const second = { id: "b", profile: { hireDate: `${year}-01-15` } };
alpha.employees.push(second);
assert.equal(assignEmployeeNumber(alpha, second).employeeNo, `NV-${year}-0002`);
assert.equal(assignEmployeeNumber(alpha, second).employeeNo, `NV-${year}-0002`);
assert.equal(alpha.employeeNoSeq, 2);

const beta = { employees: [], settings: {} };
const other = { id: "c", createdAt: "2024-06-01" };
beta.employees.push(other);
assert.equal(assignEmployeeNumber(beta, other).employeeNo, "NV-2024-0001");
assert.notEqual(readEmployeeNo(first), readEmployeeNo(other));

const kept = assignEmployeeNumber(alpha, first, { imported: "NV-1999-0099" });
assert.equal(kept.employeeNo, "NV-2021-0001");
assert.equal(kept.issued, false);

alpha.employees.pop();
const reused = { id: "d", profile: { hireDate: "2026-02-02" } };
alpha.employees.push(reused);
assert.equal(assignEmployeeNumber(alpha, reused).employeeNo, `NV-2026-0003`);

const imported = { employees: [{ id: "old", employeeNo: "KH-77" }], settings: {} };
const clash = assignEmployeeNumber(imported, { id: "new" }, { imported: "KH-77" });
assert.equal(clash.ok, false);
assert.equal(clash.error, "EMPLOYEE_NO_TAKEN");
const accepted = { id: "new" };
imported.employees.push(accepted);
assert.equal(assignEmployeeNumber(imported, accepted, { imported: "OLD-SYS-4", hireDate: "2018-03-03" }).employeeNo, "OLD-SYS-4");

const backlog = {
  employees: [
    { id: "late", profile: { hireDate: "2022-01-01" } },
    { id: "early", profile: { hireDate: "2019-05-05" } },
    { id: "has", employeeNo: "NV-HQ-19-0001", profile: { hireDate: "2019-01-01" } },
  ],
  settings: {},
};
assert.equal(ensureEmployeeNumbers(backlog), true);
assert.equal(readEmployeeNo(backlog.employees[1]), "NV-2019-0001");
assert.equal(readEmployeeNo(backlog.employees[0]), "NV-2022-0002");
assert.equal(readEmployeeNo(backlog.employees[2]), "NV-HQ-19-0001");
assert.equal(ensureEmployeeNumbers(backlog), false);

console.log("employee numbers ok");
