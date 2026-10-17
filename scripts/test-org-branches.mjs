/**
 * «الفروع» view: HQ → region → branch → site derived from the stations (parent field first, a
 * legacy region name next, HQ last), manager on the card (holder or «شاغر»), headcount / seats,
 * flags only for real problems, the «أشخاص الفرع» card holding the manager's people without
 * repeating branch heads, the smart default (HQ and regions open, people folded), the employee's
 * chain-only view, the branch menu, and a clean layout.
 */
import assert from "node:assert/strict";
import {
  branchKey,
  branchPeopleKey,
  buildBranchTree,
  defaultBranchExpanded,
  expandAllBranches,
  orgBranchActions,
} from "../src/lib/orgBranches.js";
import { layoutOrgTree, toggleExpanded } from "../src/lib/orgTreeLayout.js";

const DAY = "2026-10-16";
const data = {
  ownerId: "o",
  stations: [
    { id: "hq", name: "المقر الرئيسي", code: "HQ", isCompanyRoot: true, managerId: "o" },
    { id: "west", name: "المنطقة الغربية", unitKind: "manager", parentStationId: "hq", managerId: "rw" },
    { id: "east", name: "المنطقة الشرقية", unitKind: "manager", parentStationId: "hq" },
    { id: "jed", name: "فرع جدة", city: "جدة", parentStationId: "west", managerId: "bj" },
    { id: "dmm", name: "فرع الدمام", parentStationId: "east", managerId: "bd" },
    { id: "port", name: "ميناء الدمام", parentStationId: "dmm" },
    { id: "kfj", name: "فرع الخفجي", region: "المنطقة الشرقية" },
    { id: "lone", name: "فرع مستقل" },
    { id: "hr", name: "وحدة الموارد البشرية", code: "HR", parentStationId: "hq", fixedUnit: "hr" },
    { id: "old", name: "فرع مغلق", parentStationId: "west", closedAt: "2026-01-01" },
  ],
  employees: [
    { id: "o", name: "المالك", role: "owner", stationId: "hq" },
    { id: "rw", name: "مدير الغربية", role: "employee", stationId: "west", profile: { directManagerId: "o" } },
    { id: "bj", name: "مدير جدة", role: "employee", stationId: "jed", profile: { directManagerId: "rw" } },
    { id: "j1", name: "فني جدة", role: "employee", stationId: "jed", profile: { directManagerId: "bj" } },
    { id: "j2", name: "مشغل جدة", role: "employee", stationId: "jed", profile: { directManagerId: "bj" } },
    { id: "bd", name: "مدير الدمام", role: "employee", stationId: "dmm", profile: { directManagerId: "o" } },
    { id: "d1", name: "فني الدمام", role: "employee", stationId: "dmm", profile: { directManagerId: "bd" } },
    { id: "p1", name: "فني الميناء", role: "employee", stationId: "port", profile: { directManagerId: "bd" } },
    { id: "gone", name: "سابق", role: "employee", stationId: "jed", active: false },
  ],
  orgSeats: [
    { id: "s_o", title: "الرئيس", stationId: "hq", employeeId: "o", code: "HQ-1" },
    { id: "s_rw", title: "مدير المنطقة", stationId: "west", employeeId: "rw", reportsToEmployeeId: "o" },
    { id: "s_bj", title: "مدير الفرع", stationId: "jed", employeeId: "bj", reportsToEmployeeId: "rw" },
    { id: "s_j1", title: "فني", stationId: "jed", employeeId: "j1", reportsToEmployeeId: "bj" },
    { id: "s_j2", title: "مشغل", stationId: "jed", employeeId: "j2", reportsToEmployeeId: "bj" },
    { id: "s_jv", title: "فني صيانة", stationId: "jed", reportsToEmployeeId: "bj", createdAt: "2026-01-01" },
    { id: "s_bd", title: "مدير الفرع", stationId: "dmm", employeeId: "bd", reportsToEmployeeId: "o" },
    { id: "s_d1", title: "فني", stationId: "dmm", employeeId: "d1", reportsToEmployeeId: "bd" },
    { id: "s_p1", title: "فني", stationId: "port", employeeId: "p1", reportsToEmployeeId: "bd" },
  ],
};

const tree = buildBranchTree(data, { viewerId: "j1", scope: "all", day: DAY, health: true });
const B = (id) => tree.nodes.get(branchKey(id));

/* the hierarchy is derived: parent field, then a region name, then HQ */
assert.deepEqual(tree.roots, [branchKey("hq")], "one top: HQ");
assert.equal(B("hq").level, "hq");
assert.equal(B("west").level, "region");
assert.equal(B("jed").parentKey, branchKey("west"));
assert.equal(B("port").parentKey, branchKey("dmm"));
assert.equal(B("port").level, "site", "a workplace under a branch is a site");
const up = (node) => tree.nodes.get(node.parentKey);
assert.equal(up(B("kfj")).kind, "city", "the region's branches span two cities → grouped by city");
assert.equal(up(up(B("kfj"))).key, branchKey("east"), "no parent, but a region name → under that region");
assert.equal(up(B("lone")).noCity, true, "no parent, no region, no city → HQ's «بلا مدينة محددة»");
assert.equal(up(up(B("lone"))).key, branchKey("hq"));
assert.equal(B("hr").level, "unit");
assert.ok(!tree.nodes.has(branchKey("old")), "closed branches are not drawn");

/* under HQ: regions and units stand; its own branches sit in city groups */
const hqKids = B("hq").childKeys.map((k) => tree.nodes.get(k));
assert.deepEqual(hqKids.filter((n) => n.kind === "branch").map((n) => n.level).sort(), ["region", "region", "unit"]);
assert.ok(hqKids.some((n) => n.kind === "city" && n.noCity));

/* the card: manager (holder or «شاغر»), city / region, counts, flags only for real problems */
assert.equal(B("jed").managerName, "مدير جدة");
assert.equal(B("jed").title, "فرع · جدة", "the city when stored");
assert.equal(B("kfj").title, "فرع · الخفجي", "else the city read from its name");
assert.equal(B("jed").headcount, 3, "active people only (bj, j1, j2)");
assert.equal(B("jed").seats, 4);
assert.equal(B("jed").vacantSeats, 1);
assert.equal(B("dmm").headcount, 3, "the site's people count in its branch");
assert.equal(B("hq").headcount, 8);
assert.equal(B("east").managerVacant, true);
assert.equal(B("east").flag.kind, "MANAGER_VACANT", "a region without a manager is a real problem");
assert.equal(B("jed").flag.kind, "FINDINGS", "a seat open past the alert is a health finding on its branch");
assert.equal(B("dmm").flag, null, "a staffed branch with nothing wrong carries no chip");

/* «أشخاص الفرع»: the manager's people, never a person who heads a branch on screen */
const jedPeople = tree.nodes.get(branchPeopleKey("jed"));
assert.ok(jedPeople && jedPeople.kind === "people");
const names = jedPeople.childKeys.map((k) => tree.nodes.get(k).name || "شاغر");
assert.ok(names.includes("فني جدة") && names.includes("مشغل جدة"));
assert.ok(!B("west").childKeys.includes(branchPeopleKey("west")) || !tree.nodes.get(branchPeopleKey("west")).childKeys.some((k) => tree.nodes.get(k).employeeId === "bj"),
  "the Jeddah manager is on the Jeddah card, not under the region's people");
const dmmPeople = tree.nodes.get(branchPeopleKey("dmm")).childKeys.map((k) => tree.nodes.get(k).employeeId);
assert.ok(dmmPeople.includes("d1"));
const allPersonKeys = [...tree.nodes.values()].filter((n) => n.kind === "person").map((n) => n.key);
assert.equal(new Set(allPersonKeys).size, allPersonKeys.length, "nobody appears twice");
assert.ok(![...tree.nodes.values()].some((n) => n.kind === "person" && ["rw", "bj", "bd", "o"].includes(n.employeeId)), "branch heads are on their branch cards");

/* the viewer's branch is «أنت هنا» */
assert.equal(tree.viewerKey, branchKey("jed"));
assert.equal(B("jed").isMe, true);

/* smart default: HQ and regions open (every branch on screen), people folded */
const open = defaultBranchExpanded(tree);
assert.ok(open.has(branchKey("hq")) && open.has(branchKey("west")) && open.has(branchKey("east")));
assert.ok(![...open].some((k) => k.startsWith("bp:")), "people stay folded");
const geo = { cardW: 248, cardH: 112, gap: 12, rowGap: 32, indent: 40, maxCols: 4 };
const layout = layoutOrgTree(tree, open, geo);
const shown = new Set(layout.cards.map((c) => c.key));
["hq", "west", "east", "jed", "dmm", "kfj", "lone", "hr"].forEach((id) => assert.ok(shown.has(branchKey(id)), `${id} is on screen`));
assert.ok(!layout.cards.some((c) => tree.nodes.get(c.key)?.kind === "person"), "no person card until a branch's people are opened");
for (let i = 0; i < layout.cards.length; i += 1) {
  for (let j = i + 1; j < layout.cards.length; j += 1) {
    const a = layout.cards[i];
    const b = layout.cards[j];
    assert.ok(a.x + geo.cardW <= b.x || b.x + geo.cardW <= a.x || a.y + geo.cardH <= b.y || b.y + geo.cardH <= a.y, `${a.key} overlaps ${b.key}`);
  }
}

/* opening a branch's people keeps every other branch open */
let more = toggleExpanded(open, branchKey("jed"));
more = toggleExpanded(more, branchPeopleKey("jed"));
more = toggleExpanded(more, branchKey("dmm"));
const l2 = layoutOrgTree(tree, more, geo);
assert.ok(l2.cards.some((c) => tree.nodes.get(c.key)?.employeeId === "j1"), "Jeddah's people are on screen");
assert.ok(l2.cards.some((c) => c.key === branchKey("port")), "Dammam's site too");
assert.ok(l2.cards.some((c) => c.key === branchKey("lone")), "and the other branches stay");

/* «توسيع الكل»: every branch, people folded */
const all = expandAllBranches(tree);
assert.ok(all.has(branchKey("dmm")) && !all.has(branchKey("jed")), "only branches with sub-branches");

/* employees: their chain only, no counts, no flags */
const mine = buildBranchTree(data, { viewerId: "j1", scope: "mine", day: DAY, health: true });
const mineBranches = [...mine.nodes.values()].filter((n) => n.kind === "branch").map((n) => n.stationId).sort();
assert.deepEqual(mineBranches, ["hq", "jed", "west"], "HQ → region → their branch");
assert.ok([...mine.nodes.values()].every((n) => n.kind !== "branch" || (!n.counted && !n.flag)), "no headcounts or flags");
assert.ok(mine.nodes.has(branchPeopleKey("jed")), "their own branch's people (pruned)");
assert.ok(!mine.nodes.has(branchPeopleKey("west")), "no other team's people");
const site = buildBranchTree(data, { viewerId: "p1", scope: "mine", day: DAY });
assert.equal(site.viewerKey, branchKey("dmm"), "a site worker's branch is the branch that owns the site");

/* the branch menu: existing actions only, with the named block */
const owner = data.employees[0];
const ids = orgBranchActions(B("jed"), { canWrite: true, data, user: owner }).map((a) => a.id);
assert.deepEqual(ids, ["branch", "people", "moveUnder", "addSeat", "health", "authority"]);
assert.ok(!orgBranchActions(B("hq"), { canWrite: true, data, user: owner }).some((a) => a.id === "moveUnder"), "HQ never moves");
const east = orgBranchActions(B("east"), { canWrite: true, data, user: owner });
const hire = east.find((a) => a.id === "hireManager");
assert.ok(hire && hire.blocked && /ليس مكان توظيف/.test(hire.blocked.ar), "a region is not a hire workplace — said so");
assert.deepEqual(orgBranchActions(B("jed"), { canWrite: false, data }), [], "employees: read-only");

/* no stations: an empty tree, not a crash */
assert.equal(buildBranchTree({ stations: [] }).nodes.size, 0);

console.log("PASS test-org-branches");
