import assert from "node:assert/strict";
import { buildDisciplineRegister } from "../src/lib/disciplineDerivations.js";

const register = buildDisciplineRegister({
  ar: true,
  employees: [{ id: "e1", name: "أحمد", stationId: "st", profile: { baseSalary: 4000, allowances: 500 } }],
  stations: [{ id: "st", name: "ميناء الدمام" }],
  cases: [{
    id: "c1",
    employeeId: "e1",
    status: "decision",
    note: "تأخير متكرر",
    fineAmount: 200,
    createdAt: "2026-09-01",
  }],
});

assert.deepEqual(register.headers.slice(0, 5), ["الموظف", "الأجر", "مقدار الغرامة", "السبب", "التاريخ"]);
assert.equal(register.rows[0][0], "أحمد");
assert.equal(register.rows[0][1], 4500);
assert.equal(register.rows[0][2], 200);
assert.equal(register.rows[0][3], "تأخير متكرر");
assert.equal(register.stats[0].value, 1);
assert.equal(register.employeeIds[0], "e1");
assert.equal(register.caseIds[0], "c1");
console.log("discipline register ok");
