import assert from "node:assert/strict";
import { railFaceHref, railSwitchHref } from "../src/lib/railSide.js";

// The same section on the other side — never the home page.
assert.equal(railFaceHref("/app/safety", "", "manage"), "/app/safety?lane=manage");
assert.equal(railFaceHref("/app/safety", "?lane=manage&tab=inspect", "employee"), "/app/safety");
assert.equal(railFaceHref("/app/tasks", "", "manage"), "/app/tasks?lane=manage");
assert.equal(railFaceHref("/app/work-proof", "?lane=manage", "employee"), "/app/work-proof");
assert.equal(railFaceHref("/app/signing", "", "manage"), "/app/signing?lane=manage");

const side = (id, keys) => ({ id, groups: [{ items: keys.map(([key, to]) => ({ key, to })) }] });
const sides = [
  side("employee", [["duty:employee", "/app/attendance"], ["compliance:employee", "/app/safety"], ["payslip:employee", "/app/payroll?view=self&tab=payslip"], ["org:employee", "/app/org?view=employee"]]),
  side("manage", [["duty:manage", "/app/attendance?lane=manage"], ["hse:manage", "/app/safety?lane=manage"], ["money:manage", "/app/payroll?view=manage"], ["hr:manage", "/app/hr"]]),
];
// السلامة (موظف) → السلامة (إدارة): different section names on each side, one twin.
assert.equal(railSwitchHref({ pathname: "/app/safety", search: "", targetSide: "manage", sides, activeKey: "compliance:employee" }), "/app/safety?lane=manage");
assert.equal(railSwitchHref({ pathname: "/app/safety", search: "?lane=manage&tab=inspect", targetSide: "employee", sides, activeKey: "hse:manage" }), "/app/safety");
// قسيمتي ↔ الرواتب · الهيكل ↔ الموارد البشرية
assert.equal(railSwitchHref({ pathname: "/app/payroll", search: "?view=self&tab=payslip", targetSide: "manage", sides, activeKey: "payslip:employee" }), "/app/payroll?view=manage");
assert.equal(railSwitchHref({ pathname: "/app/hr", search: "", targetSide: "employee", sides, activeKey: "hr:manage" }), "/app/org?view=employee");
// A section this person does not administer opens the other side's first section.
const noHse = [sides[0], side("manage", [["duty:manage", "/app/attendance?lane=manage"]])];
assert.equal(railSwitchHref({ pathname: "/app/safety", search: "", targetSide: "manage", sides: noHse, activeKey: "compliance:employee" }), "/app/attendance?lane=manage");
console.log("PASS rail switch keeps the section");
