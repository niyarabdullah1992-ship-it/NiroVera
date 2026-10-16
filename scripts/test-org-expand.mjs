/**
 * Org chart with many branches open at once: opening a card never closes another, siblings can be
 * open together, the layout reflows so no two cards (or a card and a line) overlap, «توسيع الكل»
 * stays under its card limit, long teams fold into «+n», a stored set reads back safely, and the
 * card action menu routes to the existing panes with named blocking reasons.
 */
import assert from "node:assert/strict";
import { buildOrgFocusTree } from "../src/lib/orgFocus.js";
import {
  TREE_GEOMETRY,
  cardHeight,
  defaultExpanded,
  expandAllKeys,
  gridCols,
  layoutOrgTree,
  readExpanded,
  revealPath,
  toggleExpanded,
} from "../src/lib/orgTreeLayout.js";
import { changeRequestHref, changeSeedFromParams, orgAdminHref, orgCardActions, pendingChangeIndex, planMove } from "../src/lib/orgChartActions.js";

const DAY = "2026-10-16";

/* a top with three branch managers, each leading a team; one team leads further */
const data = {
  ownerId: "o",
  stations: [
    { id: "hq", name: "المقر الرئيسي", code: "HQ", isCompanyRoot: true, managerId: "o" },
    { id: "a", name: "فرع أ", code: "A", parentStationId: "hq", managerId: "ma" },
    { id: "b", name: "فرع ب", code: "B", parentStationId: "hq", managerId: "mb" },
    { id: "c", name: "فرع ج", code: "C", parentStationId: "hq", managerId: "mc" },
    { id: "ax", name: "قسم أ0", code: "AX", parentStationId: "a", managerId: "a0" },
  ],
  employees: [{ id: "o", name: "المالك", role: "owner", stationId: "hq" }],
  orgSeats: [{ id: "s_o", title: "الرئيس", stationId: "hq", employeeId: "o", code: "HQ-1" }],
};
const addPerson = (id, name, station, boss, extra = {}) => {
  data.employees.push({ id, name, role: "employee", stationId: station, profile: { directManagerId: boss } });
  data.orgSeats.push({ id: `s_${id}`, title: "مسمى", stationId: station, employeeId: id, reportsToEmployeeId: boss, ...extra });
};
addPerson("ma", "مدير أ", "a", "o");
addPerson("mb", "مدير ب", "b", "o");
addPerson("mc", "مدير ج", "c", "o");
for (let i = 0; i < 6; i += 1) addPerson(`a${i}`, `فريق أ ${i}`, "a", "ma");
for (let i = 0; i < 5; i += 1) addPerson(`b${i}`, `فريق ب ${i}`, "b", "mb");
for (let i = 0; i < 3; i += 1) addPerson(`c${i}`, `فريق ج ${i}`, "c", "mc");
for (let i = 0; i < 4; i += 1) addPerson(`a0x${i}`, `تحت أ0 ${i}`, "ax", "a0");
data.orgSeats.push({ id: "s_vac", title: "فني شاغر", stationId: "b", reportsToEmployeeId: "mb", code: "B-9" });

const tree = buildOrgFocusTree(data, { viewerId: "o", scope: "all", day: DAY });
const key = (emp) => [...tree.nodes.values()].find((n) => n.employeeId === emp)?.key;
const [O, MA, MB, MC, A0] = ["o", "ma", "mb", "mc", "a0"].map(key);
assert.ok(O && MA && MB && MC && A0, "every seat is on the tree");
assert.equal(tree.nodes.get(O).childKeys.length, 3);

const geo = { cardW: 248, cardH: 92, gap: 12, rowGap: 32, indent: 40, maxCols: 4 };

/** No two cards overlap; every line stays clear of every card it does not touch. */
function assertClean(layout, label) {
  const { cards, lines } = layout;
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const a = cards[i];
      const b = cards[j];
      const apart = a.x + geo.cardW <= b.x || b.x + geo.cardW <= a.x || a.y + geo.cardH <= b.y || b.y + geo.cardH <= a.y;
      assert.ok(apart, `${label}: ${a.key} overlaps ${b.key}`);
    }
  }
  lines.forEach((line) => {
    cards.forEach((c) => {
      const x0 = Math.min(line.x, line.x + line.w);
      const x1 = Math.max(line.x, line.x + line.w);
      const y0 = Math.min(line.y, line.y + line.h);
      const y1 = Math.max(line.y, line.y + line.h);
      // strictly inside a card (touching its edge is how a line joins it)
      const inside = x1 > c.x + 1 && x0 < c.x + geo.cardW - 1 && y1 > c.y + 1 && y0 < c.y + geo.cardH - 1;
      assert.ok(!inside, `${label}: line ${line.id} crosses card ${c.key}`);
    });
  });
  assert.ok(layout.width >= Math.max(...cards.map((c) => c.x + geo.cardW)) - 0.5, `${label}: width holds every card`);
  assert.ok(layout.height >= Math.max(...cards.map((c) => c.y + geo.cardH)) - 0.5, `${label}: height holds every card`);
}

/* default: the chain to the viewer is open (owner = the top → its reports show) */
const start = defaultExpanded(tree, O);
assert.deepEqual([...start], [O]);
let layout = layoutOrgTree(tree, start, geo);
assert.equal(layout.cards.length, 4, "the top and its three managers");
assertClean(layout, "default");

/* open two sibling branches: both stay open */
let open = toggleExpanded(start, MA);
open = toggleExpanded(open, MB);
assert.ok(open.has(MA) && open.has(MB) && open.has(O), "opening B kept A open");
layout = layoutOrgTree(tree, open, geo);
const shown = new Set(layout.cards.map((c) => c.key));
assert.ok(tree.nodes.get(MA).childKeys.every((k) => shown.has(k)), "A's team is on screen");
assert.ok(tree.nodes.get(MB).childKeys.every((k) => shown.has(k)), "B's team is on screen");
assert.equal(layout.cards.length, 1 + 3 + 6 + 6, "top, managers, A's 6, B's 5 + open seat");
assertClean(layout, "two siblings");

/* SAP: a team that is not on the focus path is ONE grid block of ≈√n columns under one drop */
const at = layout.index;
tree.nodes.get(MA).childKeys.forEach((k) => {
  assert.ok(at.get(k).y > at.get(MA).y, "a report is below its manager");
  assert.equal(at.get(k).parentKey, MA);
  assert.equal(at.get(k).inGrid, true, "packed in the block");
});
const rowsOf = (parent) => {
  const ys = new Map();
  layout.cards.filter((c) => c.parentKey === parent).forEach((c) => ys.set(c.y, (ys.get(c.y) || 0) + 1));
  return [...ys.values()];
};
assert.equal(gridCols(6), 3);
assert.equal(gridCols(1), 1);
assert.equal(gridCols(30), 4, "clamped to four");
assert.equal(gridCols(3), 2);
assert.deepEqual(rowsOf(MA), [3, 3], "six reports → a 3 × 2 block");
assert.equal(layout.lines.filter((l) => l.id.startsWith(`${MA}:drop`)).length, 1, "one drop into the block, no line per card");
/* the root sits centred over its groups */
const drops = layout.lines.filter((l) => l.id.startsWith(`${O}:drop`)).map((l) => l.x);
assert.ok(Math.abs(at.get(O).x + geo.cardW / 2 - (Math.min(...drops) + Math.max(...drops)) / 2) < 0.5, "root centred over its children");

/* open a third level too; then close A — B and the deeper key stay remembered */
open = toggleExpanded(open, A0);
layout = layoutOrgTree(tree, open, geo);
assertClean(layout, "three levels");
assert.ok(layout.cards.some((c) => c.parentKey === A0));
const closedA = toggleExpanded(open, MA);
assert.ok(closedA.has(MB) && closedA.has(A0), "closing A keeps B open (and A0 for when A reopens)");
const lc = layoutOrgTree(tree, closedA, geo);
assert.ok(!lc.cards.some((c) => c.parentKey === MA || c.parentKey === A0), "A's team folds with A");
assert.ok(lc.cards.some((c) => c.parentKey === MB), "B's team still shows");
assertClean(lc, "A closed");

/* the connector lines: one trunk per open card, a bus per row, a tick per child */
const stems = layout.lines.filter((l) => l.id.endsWith(":stem"));
assert.equal(stems.length, layout.cards.filter((c) => c.expanded).length, "one stem under every opened card");
assert.equal(new Set(layout.lines.map((l) => l.id)).size, layout.lines.length, "line ids are unique (they animate by id)");

/* «توسيع الكل» opens everything that fits; a small limit stops at a whole level */
const all = expandAllKeys(tree, 600);
assert.equal(all.capped, false);
const full = layoutOrgTree(tree, all.expanded, geo);
assert.equal(full.cards.length, tree.nodes.size, "every card is on screen");
assertClean(full, "expand all");
const capped = expandAllKeys(tree, 10);
assert.equal(capped.capped, true);
assert.ok(layoutOrgTree(tree, capped.expanded, geo).cards.length <= 10, "the cap holds");

/* search: reveal the path to a deep card without closing anything */
const deep = tree.nodes.get(A0).childKeys[0];
const revealed = revealPath(new Set([MB]), tree, deep);
assert.ok(revealed.has(MB) && revealed.has(O) && revealed.has(MA) && revealed.has(A0));
assert.ok(layoutOrgTree(tree, revealed, geo).index.has(deep), "the found card is on screen");

/* long teams fold into «+n», and open in full on request */
const folded = layoutOrgTree(tree, new Set([O, MA]), { ...geo, childLimit: 4 });
const more = folded.cards.find((c) => c.key === `${MA}::more`);
assert.ok(more && more.more === 2, "+2 more");
assertClean(folded, "folded");
const unfolded = layoutOrgTree(tree, new Set([O, MA]), { ...geo, childLimit: 4, showAll: new Set([MA]) });
assert.ok(unfolded.cards.some((c) => c.key === `${MA}::less`), "a fold card closes the long team again");
assert.equal(unfolded.cards.filter((c) => c.parentKey === MA && !c.less).length, 6);

/* the stored set reads back safely */
assert.equal(readExpanded("{bad", tree), null);
assert.deepEqual([...readExpanded(JSON.stringify([MA, "gone", 4, A0]), tree)], [MA, A0]);
assert.equal(cardHeight({}), 100);
assert.equal(cardHeight({ unit: true, seatCode: true }, true), 74 + 36);

/* the focus path: a vertical chain of single cards, the focus's own team as a 4-column block */
const chain = layoutOrgTree(tree, new Set([deep]), { ...geo, focusKey: deep });
const chainKeys = [O, MA, A0, deep];
assert.deepEqual(chain.cards.map((c) => c.key).sort(), [...chainKeys].sort(), "only the chain when nothing else is open");
const mid = (k) => chain.index.get(k).x + geo.cardW / 2;
assert.ok(chainKeys.every((k) => Math.abs(mid(k) - mid(O)) < 0.5), "a straight vertical stack");
assert.ok(!chain.lines.some((l) => l.id.endsWith(":bus")), "no bus on a straight chain");
const focusTeam = layoutOrgTree(tree, new Set([O, A0]), { ...geo, focusKey: A0 });
assertClean(focusTeam, "focus team");
const a0 = tree.nodes.get(A0).childKeys;
assert.deepEqual([...new Set(a0.map((k) => focusTeam.index.get(k).y))].length, 1, "four reports of the focus → one row of four");
assert.ok(focusTeam.index.get(MA).inGrid !== true && focusTeam.index.get(MB).inGrid === true, "the path card stands out of its peers' block");
assert.ok(!focusTeam.cards.some((c) => c.parentKey === MA && c.key !== A0), "a chain card not opened shows only the path");

/* RTL/LTR share one geometry: x is from the inline start; one column, stacked groups on a phone */
const phone = layoutOrgTree(tree, open, { ...geo, maxCols: 1, indent: 28, stack: true });
assertClean(phone, "phone");
assert.ok(phone.cards.filter((c) => c.parentKey === MA).every((c, _, list) => c.x === list[0].x), "one column");
assert.ok(phone.width <= 28 * 3 + TREE_GEOMETRY.cardW, "narrow enough for a phone at three levels");

/* card actions: HR gets the admin set, routed to the existing panes; others get none */
const owner = data.employees[0];
const card = { ...tree.nodes.get(MA) };
const ids = orgCardActions(card, { data, user: owner, canWrite: true }).map((a) => a.id);
assert.deepEqual(ids, ["file", "seat", "moveUnder", "move", "dotted", "branch", "addSeat", "authority", "health"]);
const vac = [...tree.nodes.values()].find((n) => n.vacant);
const vacIds = orgCardActions(vac, { data, user: owner, canWrite: true }).map((a) => a.id);
assert.ok(vacIds.includes("hire") && vacIds.includes("acting") && vacIds.includes("freeze") && !vacIds.includes("file"));
assert.deepEqual(orgCardActions(card, { data, user: data.employees[1], canWrite: false }), [], "employees: read-only");
const ops = orgCardActions(card, { data, user: { id: "x", role: "ops_manager" }, canWrite: true });
const move = ops.find((a) => a.id === "move");
assert.ok(move.blocked && move.blocked.ar, "a gate names why a seat change is blocked");
assert.equal(ops.find((a) => a.id === "seat").blocked, null, "looking at the seat card is never blocked");
assert.equal(orgAdminHref("move", card), `/app/org?view=admin&pane=changes&op=moveSeat&seat=${card.seatId}`);
assert.equal(orgAdminHref("acting", vac), `/app/org?view=admin&pane=seats&seat=${vac.seatId}`);
assert.equal(orgAdminHref("file", card), "", "the chart opens the file itself");
assert.deepEqual(changeSeedFromParams(new URLSearchParams("op=freezeSeat&seat=s_vac")), { type: "freezeSeat", seatId: "s_vac", frozen: true });
assert.equal(changeSeedFromParams(new URLSearchParams("op=dropTables&seat=s_vac")), null, "only known change types");

/* «تغيير»: moving a card under another only plans the existing change step, through the gate */
const card2 = (k) => ({ ...tree.nodes.get(k), kind: "person" });
const isUnder = (a, b) => { let c = tree.nodes.get(a)?.parentKey; while (c) { if (c === b) return true; c = tree.nodes.get(c)?.parentKey; } return false; };
const a1 = [...tree.nodes.values()].find((n) => n.employeeId === "a1").key;
const plan = planMove(card2(a1), card2(MB), { data, user: owner, isUnder, today: DAY });
assert.equal(plan.ok, true, plan.reason?.ar);
assert.deepEqual(plan.op, { type: "moveSeat", seatId: "s_a1", toStationId: "b" }, "under B = into the unit B leads");
assert.ok(plan.art58, "a filled seat's move goes through the Art. 58 question in the request");
assert.ok(plan.managerChanges.some((m) => m.employeeId === "a1"), "the sheet says who changes manager");
assert.equal(changeRequestHref(plan.op), "/app/org?view=admin&pane=changes&op=moveSeat&seat=s_a1&to=b");
assert.deepEqual(changeSeedFromParams(new URLSearchParams("op=moveSeat&seat=s_a1&to=b")), { type: "moveSeat", seatId: "s_a1", toStationId: "b" });
assert.deepEqual(changeSeedFromParams(new URLSearchParams("op=reparentUnit&unit=ax&to=b")), { type: "reparentUnit", stationId: "ax", toParentId: "b" });
assert.equal(planMove(card2(MA), card2(A0), { data, user: owner, isUnder, today: DAY }).ok, false, "never under one's own report");
assert.match(planMove(card2(MA), card2(A0), { data, user: owner, isUnder, today: DAY }).reason.ar, /حلقة/);
const same = planMove(card2(a1), card2(MA), { data, user: owner, isUnder, today: DAY });
assert.equal(same.ok, false, "already there");
assert.ok(same.reason.ar, "named by the existing gate");
assert.equal(planMove(card2(a1), card2(MB), { data, user: { id: "x", role: "ops_manager" }, isUnder, today: DAY }).ok, false, "no seat-edit right → blocked with the reason");

/* pending changes mark their cards */
const withChange = { ...data, orgDesign: { changes: [{ id: "c1", status: "pending", ops: [{ type: "moveSeat", seatId: "s_a1", toStationId: "b" }] }] } };
assert.ok(pendingChangeIndex(withChange).seats.has("s_a1"));
assert.equal(pendingChangeIndex(data).seats.size, 0);

console.log("PASS test-org-expand");
