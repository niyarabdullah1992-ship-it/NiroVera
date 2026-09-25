import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ARBITRATION_DISCLAIMER_AR,
  attachPlatformJudgment,
  judgmentProtects,
  judgmentProtectsCopy,
  MINISTRY_ROLE,
  PLATFORM_FORUM,
  PLATFORM_JUDGE_TITLE_AR,
  PLATFORM_RAIL_EMPTY_AR,
} from "../src/lib/platformJudgment.js";
import {
  reviewArbitrationCase,
  sealArbitrationVerdict,
} from "../src/lib/arbitrationEngine.js";

assert.equal(PLATFORM_FORUM, "platform");
assert.equal(MINISTRY_ROLE, "monitor");
assert.equal(PLATFORM_JUDGE_TITLE_AR, "حكم المنصة");
assert.match(ARBITRATION_DISCLAIMER_AR, /يحمي العامل والشركة/);
assert.match(ARBITRATION_DISCLAIMER_AR, /الوزارة تراقب/);
assert.doesNotMatch(ARBITRATION_DISCLAIMER_AR, /تحكيم مبدئي/);

const both = judgmentProtects({ gateId: "hours_48" });
assert.deepEqual(both, { employee: true, company: true });
assert.equal(judgmentProtectsCopy(both, true), "يحمي العامل والشركة — حكم المنصة");

const station = judgmentProtects({ gateId: "not_empty" });
assert.deepEqual(station, { employee: false, company: true });
assert.equal(judgmentProtectsCopy(station, true), "يحمي الشركة — حكم المنصة");

const product = judgmentProtects({ source: "product", entitled: "none" });
assert.deepEqual(product, { employee: false, company: true });

const night = attachPlatformJudgment({ gateId: "night_rest" }, { ar: true, gateId: "night_rest" });
assert.equal(night.forum, "platform");
assert.equal(night.ministryRole, "monitor");
assert.equal(night.overrideAllowed, false);
assert.equal(night.protects.employee, true);
assert.equal(night.protects.company, true);

const leave = reviewArbitrationCase({
  kind: "leave_approve",
  request: { type: "annual", startDate: "2026-10-01", endDate: "2026-10-05", days: 5 },
  employee: { profile: { hireDate: "2020-01-01" }, leaveRequests: [] },
});
assert.equal(leave.overrideAllowed, false);
assert.equal(leave.actor, "system");
assert.equal(leave.forum, "platform");
assert.equal(leave.ministryRole, "monitor");
assert.equal(leave.protects.employee, true);
assert.equal(leave.protects.company, true);

const sealed = sealArbitrationVerdict(leave, { companyId: "co1", employeeId: "e1" });
assert.equal(sealed.overrideAllowed, false);
assert.equal(sealed.immutable, true);
assert.equal(sealed.forum, "platform");
assert.equal(sealed.ministryRole, "monitor");
assert.match(sealed.disclaimerAr, /الوزارة تراقب/);

assert.equal(PLATFORM_RAIL_EMPTY_AR.includes("لا حكم مستحق"), true);

const railSrc = readFileSync(new URL("../src/components/employees/ManagerDutyAlertsRail.jsx", import.meta.url), "utf8");
assert.match(railSrc, /PLATFORM_JUDGE_TITLE_AR/);
const reqSrc = readFileSync(new URL("../src/components/requests/RequestsWorkspace.jsx", import.meta.url), "utf8");
assert.match(reqSrc, /حكم المنصة على طلبك/);
assert.doesNotMatch(reqSrc, /أنظمة الوزارة — ما يُطبَّق على طلبك/);

console.log("platform-judgment: PASS");
