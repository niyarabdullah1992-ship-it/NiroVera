import assert from "node:assert/strict";
import {
  DEMO_BRANCH_MANAGERS,
  demoOrgBranchPlan,
  demoOrgHireRows,
  DEMO_ORG_MANAGER_EMAIL,
} from "../src/lib/demoOrgTreeData.js";
import { hangOrphanStationsUnderCompany } from "../src/lib/stationTree.js";

const plan = demoOrgBranchPlan();
assert.equal(plan.length, 7);
assert.equal(plan.find((item) => item.name === "فرع جدة")?.parent, "المنطقة الغربية");
assert.equal(plan.find((item) => item.name === "ميناء الدمام")?.parent, "فرع الدمام");
assert.equal(plan.filter((item) => !item.parent).length, 2);

const rows = demoOrgHireRows();
assert.equal(rows.length, 94, "91 field staff + 3 branch HR officers");
assert.equal(rows.filter((row) => row.branch === "فرع جدة").length, 19);
assert.equal(rows.filter((row) => row.branch === "فرع الخفجي").length, 23);
assert.equal(rows.filter((row) => row.branch === "المكتب الرئيسي").length, 25);
assert.equal(rows.filter((row) => row.branch === "ميناء الدمام").length, 19);
assert.equal(rows.filter((row) => row.onCompanyRoot).length, 4);
assert.equal(rows.find((row) => row.email === DEMO_ORG_MANAGER_EMAIL)?.title, "مدير الفرع");
assert.equal(new Set(rows.map((row) => row.email)).size, rows.length);
assert.equal(new Set(rows.map((row) => row.nationalId)).size, rows.length);
DEMO_BRANCH_MANAGERS.forEach(({ branch }) => {
  assert.ok(rows.some((row) => row.branch === branch && String(row.title || "").includes("مدير")), branch);
});

const company = { id: "co", name: "المنشأة", isCompanyRoot: true, parentStationId: null };
const rabigh = { id: "rb", name: "فرع رابغ", parentStationId: null };
const east = { id: "east", name: "الشرقية", parentStationId: null, isCompanyRoot: true };
hangOrphanStationsUnderCompany([company, rabigh, east]);
assert.equal(company.isCompanyRoot, true);
assert.equal(east.isCompanyRoot, false);
assert.equal(rabigh.parentStationId, "co");
assert.equal(east.parentStationId, "co");
assert.equal(company.parentStationId, null);

console.log("demo org tree ok");
