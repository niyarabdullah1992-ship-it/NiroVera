/**
 * «شجرة الإدارة» action panel: rights (the old tree's roles, or the org-design right), the
 * grouped actions per card with the existing function each runs, named blocks (no right, fixed
 * units, filled seats not frozen, no seat), the hierarchical branch picker per purpose, the
 * branch-removal impact, the closeUnit gate, the freeze patch, and «+» add slots in the layout.
 */
import assert from "node:assert/strict";
import { buildOrgFocusTree } from "../src/lib/orgFocus.js";
import { branchKey, buildBranchTree } from "../src/lib/orgBranches.js";
import { layoutOrgTree } from "../src/lib/orgTreeLayout.js";
import { changeRequestHref, changeSeedFromParams } from "../src/lib/orgChartActions.js";
import {
  PANEL_GROUPS,
  branchPickList,
  branchRemovalImpact,
  closeUnitPlan,
  freezePatch,
  panelActions,
  structureRights,
} from "../src/lib/orgActionPanel.js";

const DAY = "2026-10-16";
const data = {
  ownerId: "o",
  stations: [
    { id: "hq", name: "المقر الرئيسي", isCompanyRoot: true, managerId: "o" },
    { id: "west", name: "المنطقة الغربية", unitKind: "manager", parentStationId: "hq", managerId: "rw" },
    { id: "jed", name: "فرع جدة", parentStationId: "west", managerId: "bj" },
    { id: "port", name: "ميناء جدة", parentStationId: "jed" },
    { id: "rbg", name: "فرع رابغ", parentStationId: "hq" },
    { id: "hr", name: "وحدة الموارد البشرية", code: "HR", parentStationId: "hq", fixedUnit: "hr" },
  ],
  employees: [
    { id: "o", name: "المالك", role: "owner", stationId: "hq" },
    { id: "rw", name: "مدير الغربية", role: "employee", stationId: "west", profile: { directManagerId: "o" } },
    { id: "bj", name: "مدير جدة", role: "employee", stationId: "jed", profile: { directManagerId: "rw" } },
    { id: "j1", name: "فني جدة", role: "employee", stationId: "jed", profile: { directManagerId: "bj" } },
    { id: "ops", name: "مدير عمليات", role: "ops_manager", stationId: "hq" },
    { id: "pg", name: "مدير برامج", role: "pgm", stationId: "hq" },
  ],
  orgSeats: [
    { id: "s_o", title: "الرئيس", stationId: "hq", employeeId: "o" },
    { id: "s_rw", title: "مدير المنطقة", stationId: "west", employeeId: "rw", reportsToEmployeeId: "o" },
    { id: "s_bj", title: "مدير الفرع", stationId: "jed", employeeId: "bj", reportsToEmployeeId: "rw" },
    { id: "s_j1", title: "فني", stationId: "jed", employeeId: "j1", reportsToEmployeeId: "bj" },
    { id: "s_jv", title: "فني صيانة", stationId: "jed", reportsToEmployeeId: "bj" },
  ],
};
const owner = data.employees[0];
const ops = data.employees.find((e) => e.id === "ops");
const pgm = data.employees.find((e) => e.id === "pg");

/* rights: the old tree's set (pgm included) or the org-design right; ops_manager views only */
assert.equal(structureRights(owner, data).canManage, true);
assert.equal(structureRights(pgm, data).canManage, true, "pgm managed the old tree");
assert.equal(structureRights(pgm, data).canEditSeats, false, "but seat design stays with HR");
assert.equal(structureRights(ops, data).canManage, false);
assert.match(structureRights(ops, data).reason.ar, /اطلاع فقط/);

const people = buildOrgFocusTree(data, { viewerId: "o", scope: "all", day: DAY });
const keyOf = (emp) => [...people.nodes.values()].find((n) => n.employeeId === emp).key;
const vacant = [...people.nodes.values()].find((n) => n.seatId === "s_jv");
const ids = (groups) => groups.flatMap((g) => g.items.map((i) => i.id));
const item = (groups, id) => groups.flatMap((g) => g.items).find((i) => i.id === id);

/* a filled person: the five groups, each action names the existing function */
const bj = panelActions({ ...people.nodes.get(keyOf("bj")), kind: "person" }, { data, user: owner });
assert.deepEqual(bj.map((g) => g.id), PANEL_GROUPS.map((g) => g.id), "إضافة · تكليف · نقل · تعديل · إزالة");
assert.deepEqual(ids(bj), ["addSeatUnder", "hireHere", "addUnit", "acting", "deputy", "moveManager", "moveBranch", "changeHolder", "seatEdit", "grade", "vacate", "freeze", "freezeDecision"]);
assert.equal(item(bj, "addSeatUnder").fn, "createVacantSeatsUnderManager");
assert.equal(item(bj, "moveBranch").fn, "transferEmployeeBetweenStations");
assert.equal(item(bj, "vacate").fn, "endSeatTenure");
assert.equal(item(bj, "hireHere").stationId, "jed", "a new person goes to the unit the manager leads");
assert.ok(bj.flatMap((g) => g.items).every((i) => i.fn), "every action names its function");
assert.match(item(bj, "freeze").blocked.ar, /مشغول/, "a filled seat is not frozen");
assert.equal(item(bj, "vacate").destructive, true);

/* an open seat: hire, acting, move by decision, freeze */
const vac = panelActions({ ...vacant, kind: "person" }, { data, user: owner });
assert.deepEqual(ids(vac), ["hire", "hireHere", "acting", "deputy", "moveManager", "moveBranch", "seatEdit", "freeze", "freezeDecision"]);
assert.equal(item(vac, "moveBranch").form, "seatToBranch", "a seat moves to a branch through «التغييرات»");
assert.equal(item(vac, "freeze").blocked, null);

/* view-only and seat-design limits are named */
const asOps = panelActions({ ...people.nodes.get(keyOf("bj")), kind: "person" }, { data, user: ops });
assert.ok(asOps.flatMap((g) => g.items).every((i) => i.blocked), "ops_manager: everything shown, all blocked");
const asPgm = panelActions({ ...people.nodes.get(keyOf("bj")), kind: "person" }, { data, user: pgm });
assert.equal(item(asPgm, "addSeatUnder").blocked, null, "pgm keeps the old tree's adds");
assert.match(item(asPgm, "seatEdit").blocked.ar, /والموارد البشرية/, "seat design blocked with the existing reason");

/* branches */
const branches = buildBranchTree(data, { scope: "all" });
const B = (id) => branches.nodes.get(branchKey(id));
const jed = panelActions(B("jed"), { data, user: owner });
assert.deepEqual(ids(jed), ["addUnit", "hireHere", "branchManagers", "moveParent", "rename", "location", "unitKind", "closeUnit", "deleteBranch"]);
assert.equal(item(jed, "location").fn, "setStationLocation");
const hq = panelActions(B("hq"), { data, user: owner });
assert.match(item(hq, "moveParent").blocked.ar, /ثابت/, "HQ is fixed");
assert.equal(item(hq, "rename").fn, "renameCompany");
assert.ok(item(panelActions(B("west"), { data, user: owner }), "hireHere").blocked, "a region is not a hire workplace");
assert.ok(item(panelActions(B("hr"), { data, user: owner }), "deleteBranch").blocked, "the HR unit is fixed");

/* the hierarchical picker */
const allRows = branchPickList(data, { purpose: "transfer", current: "jed" });
const transfer = allRows.filter((r) => !r.group);
assert.deepEqual(transfer.map((r) => r.id), ["hq", "west", "jed", "port", "rbg", "hr"], "HQ → region → branch → site, in tree order");
assert.ok(allRows.some((r) => r.group && r.name === "رابغ"), "HQ's branches come under their city heading");
assert.equal(allRows.find((r) => r.id === "rbg").depth, 2, "HQ → رابغ → فرع رابغ");
assert.ok(transfer.find((r) => r.id === "west").blocked, "a region is not a workplace");
assert.ok(transfer.find((r) => r.id === "jed").blocked, "the current branch");
assert.equal(transfer.find((r) => r.id === "rbg").blocked, null);
const parent = branchPickList(data, { purpose: "parent", current: "west", moving: "jed" });
assert.ok(parent.find((r) => r.id === "port").blocked, "not under its own site");
assert.ok(parent.find((r) => r.id === "hr").blocked, "not under the HR unit");
assert.equal(parent.find((r) => r.id === "rbg").blocked, null);

/* removal: the consequence is named, fixed units are blocked */
const impact = branchRemovalImpact(data, "jed");
assert.equal(impact.blocked, null);
assert.equal(impact.targetId, "west");
assert.equal(impact.people, 2);
assert.equal(impact.seats, 3);
assert.equal(impact.children, 1);
assert.ok(branchRemovalImpact(data, "hq").blocked);
const close = closeUnitPlan(data, "jed", { today: DAY });
assert.equal(close.ok, false, "a unit with people or sub-units is not closed");
assert.ok(close.reason.ar, "named by the existing change gate");
assert.equal(closeUnitPlan({ ...data, employees: data.employees.filter((e) => e.stationId !== "rbg") }, "rbg", { today: DAY }).ok, true);
assert.equal(changeRequestHref({ type: "closeUnit", stationId: "rbg" }), "/app/org?view=admin&pane=changes&op=closeUnit&unit=rbg");
assert.deepEqual(changeSeedFromParams(new URLSearchParams("op=closeUnit&unit=rbg")), { type: "closeUnit", stationId: "rbg" });

/* freeze */
assert.deepEqual(freezePatch(data, "s_jv", DAY), { ok: true, patch: { state: "frozen" } });
assert.equal(freezePatch(data, "s_j1", DAY).ok, false);
assert.deepEqual(freezePatch({ ...data, orgSeats: data.orgSeats.map((s) => (s.id === "s_jv" ? { ...s, state: "frozen" } : s)) }, "s_jv", DAY).patch, { state: "" }, "frozen → unfreeze");

/* «+ إضافة بطاقة هنا»: last cell of an opened team, or alone under a focused leaf */
const geo = { cardW: 248, cardH: 100, gap: 12, rowGap: 40, maxCols: 4 };
const bjKey = keyOf("bj");
const withPlus = layoutOrgTree(people, new Set([keyOf("o"), keyOf("rw"), bjKey]), { ...geo, focusKey: bjKey, addSlot: () => true });
const plus = withPlus.cards.find((c) => c.key === `${bjKey}::add`);
assert.ok(plus && plus.add && plus.parentKey === bjKey);
const team = withPlus.cards.filter((c) => c.parentKey === bjKey && !c.add);
assert.ok(team.every((c) => c.y <= plus.y), "after the team");
const j1 = keyOf("j1");
const leaf = layoutOrgTree(people, new Set([keyOf("o"), keyOf("rw"), bjKey]), { ...geo, focusKey: j1, addSlot: () => true });
assert.ok(leaf.cards.some((c) => c.key === `${j1}::add`), "under a focused card with no team");
assert.ok(!layoutOrgTree(people, new Set([bjKey]), { ...geo, focusKey: bjKey }).cards.some((c) => c.add), "none outside the management tree");

console.log("PASS test-org-action-panel");
