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
  layoutOrgTree,
  readExpanded,
  revealPath,
  toggleExpanded,
} from "../src/lib/orgTreeLayout.js";
import { changeSeedFromParams, orgAdminHref, orgCardActions } from "../src/lib/orgChartActions.js";

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

/* children sit under their parent, indented, in rows of at most maxCols */
const at = layout.index;
tree.nodes.get(MA).childKeys.forEach((k) => {
  assert.ok(at.get(k).y > at.get(MA).y, "a report is below its manager");
  assert.ok(at.get(k).x >= at.get(MA).x + geo.indent, "and indented past the trunk");
  assert.equal(at.get(k).parentKey, MA);
});
const rowsOf = (parent) => {
  const ys = new Map();
  layout.cards.filter((c) => c.parentKey === parent).forEach((c) => ys.set(c.y, (ys.get(c.y) || 0) + 1));
  return [...ys.values()];
};
assert.ok(rowsOf(MA).every((n) => n <= geo.maxCols), "rows hold at most four cards");
assert.deepEqual(rowsOf(MA), [4, 2], "six reports → a row of four and a row of two");

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
const trunks = layout.lines.filter((l) => l.id.endsWith(":trunk"));
assert.equal(trunks.length, [...open].filter((k) => tree.nodes.get(k).childKeys.length).length);
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
assert.equal(cardHeight({}), 92);
assert.equal(cardHeight({ unit: true, seatCode: true }, true), 70 + 36);

/* RTL/LTR share one geometry: x is from the inline start; one column on a phone */
const phone = layoutOrgTree(tree, open, { ...geo, maxCols: 1, indent: 28 });
assert.ok(phone.cards.filter((c) => c.parentKey === MA).every((c, _, list) => c.x === list[0].x), "one column");
assert.ok(phone.width <= 28 * 3 + TREE_GEOMETRY.cardW, "narrow enough for a phone at three levels");

/* card actions: HR gets the admin set, routed to the existing panes; others get none */
const owner = data.employees[0];
const card = { ...tree.nodes.get(MA) };
const ids = orgCardActions(card, { data, user: owner, canWrite: true }).map((a) => a.id);
assert.deepEqual(ids, ["file", "seat", "move", "dotted", "branch", "authority", "health"]);
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

console.log("PASS test-org-expand");
