/**
 * Org chart layout helpers: direct / total / matrix counts; an employee's
 * pruned tree counts only what they may see; zoom steps and stored card options.
 */
import assert from "node:assert/strict";
import { buildOrgFocusTree } from "../src/lib/orgFocus.js";
import {
  TREE_GEOMETRY,
  clampZoom,
  columnsFor,
  countLine,
  defaultExpanded,
  gridWidth,
  layoutOrgTree,
  pathTo,
  readTreeOptions,
  stepZoom,
  treeCounts,
} from "../src/lib/orgTreeLayout.js";

const DAY = "2026-10-16";

const data = {
  ownerId: "o",
  stations: [
    { id: "hq", name: "المقر الرئيسي", code: "HQ", isCompanyRoot: true, managerId: "o" },
    { id: "kh", name: "فرع الخفجي", code: "KHF", parentStationId: "hq", managerId: "m" },
    { id: "rb", name: "فرع رابغ", code: "RBG", parentStationId: "hq", managerId: "r" },
    { id: "ops", name: "قسم التشغيل", code: "OPS", parentStationId: "kh", managerId: "w1" },
  ],
  employees: [
    { id: "o", name: "نيار الرنياوي", role: "owner", stationId: "hq", employeeNo: "NV-1", profile: { position: "الرئيس التنفيذي" } },
    { id: "m", name: "أحمد سالم", role: "employee", stationId: "kh", employeeNo: "NV-2", profile: { directManagerId: "o", hireDate: "2020-01-05" } },
    { id: "r", name: "نورة", role: "employee", stationId: "rb", profile: { directManagerId: "o" } },
    { id: "w1", name: "عمر", role: "employee", stationId: "kh", profile: { directManagerId: "m" } },
    { id: "w2", name: "حسن", role: "employee", stationId: "kh", profile: { directManagerId: "m" } },
    { id: "w3", name: "زياد", role: "employee", stationId: "ops", profile: { directManagerId: "w1" } },
    { id: "rx", name: "خالد", role: "employee", stationId: "rb", profile: { directManagerId: "r" } },
    {
      id: "a", name: "سارة", role: "employee", stationId: "kh", profile: { directManagerId: "m" },
      actingAssignments: [{ stationId: "kh", title: "مشرفة", until: "2099-01-01" }],
    },
    { id: "loose", name: "بلا منصب", role: "employee", stationId: "kh", profile: { chartReleased: true } },
  ],
  orgSeats: [
    { id: "s_o", title: "الرئيس التنفيذي", stationId: "hq", employeeId: "o", code: "HQ-001" },
    { id: "s_m", title: "مدير الفرع", stationId: "kh", employeeId: "m", reportsToEmployeeId: "o", code: "KHF-001" },
    { id: "s_r", title: "مديرة الفرع", stationId: "rb", employeeId: "r", reportsToEmployeeId: "o", code: "RBG-001" },
    { id: "s_w1", title: "مشرف تشغيل", stationId: "kh", employeeId: "w1", reportsToEmployeeId: "m", code: "KHF-002" },
    { id: "s_w2", title: "فني ميداني", stationId: "kh", employeeId: "w2", reportsToEmployeeId: "m", code: "KHF-003", dottedToSeatId: "s_r" },
    { id: "s_w3", title: "فني", stationId: "ops", employeeId: "w3", reportsToEmployeeId: "w1", code: "KHF-004" },
    { id: "s_vac", title: "فني صيانة", stationId: "kh", reportsToEmployeeId: "m", code: "KHF-009" },
    { id: "s_frz", title: "مهندس", stationId: "kh", reportsToEmployeeId: "w1", state: "frozen", code: "KHF-010" },
    { id: "s_rx", title: "محاسب", stationId: "rb", employeeId: "rx", reportsToEmployeeId: "r", code: "RBG-002" },
  ],
};


const all = buildOrgFocusTree(data, { viewerId: "w1", scope: "all", day: DAY });
const counts = treeCounts(all);

/* counts: filled people only; open seats counted apart */
assert.deepEqual(
  { direct: counts.get("s_o").direct, total: counts.get("s_o").total },
  { direct: 2, total: 7 },
  "the top: 2 direct (m, r); everyone filled under it",
);
assert.equal(counts.get("s_m").direct, 3, "w1, w2, a — the open seat is not a person");
assert.equal(counts.get("s_m").open, 1);
assert.equal(counts.get("s_m").total, 4, "w1, w2, a, and w3 under w1");
assert.equal(counts.get("s_w1").direct, 1);
assert.equal(counts.get("s_w1").open, 1, "the frozen seat is an open seat, not a person");
assert.equal(counts.get("s_w3").total, 0);
assert.equal(counts.get("s_r").matrix, 1, "w2's dotted line lands on r");
assert.equal(counts.get("s_m").matrix, 0);

/* the chain to w1 (the multi-branch layout itself is covered by test-org-expand) */
assert.deepEqual(pathTo(all, "s_w1"), ["s_o", "s_m", "s_w1"], "top → card");

/* an employee's tree — counts only what they may see */
const mine = buildOrgFocusTree(data, { viewerId: "w1", scope: "mine", day: DAY });
const mc = treeCounts(mine);
assert.equal(mc.get("s_o").direct, 1, "the other branch is not even counted");
assert.ok(!mc.has("s_r"));
assert.deepEqual(pathTo(mine, mine.viewerKey), ["s_o", "s_m", "s_w1"]);
assert.deepEqual(mine.nodes.get("s_o").childKeys, ["s_m"], "the manager's peers stay hidden");
assert.ok(!mine.nodes.get("s_m").childKeys.some((k) => mine.nodes.get(k).vacant), "peer open seats are not in an employee's view");
assert.equal(mc.get("s_r"), undefined);
for (const node of mine.nodes.values()) assert.ok(node.dottedToKey === "" || mine.nodes.has(node.dottedToKey), "no dotted line into a hidden branch");

/* geometry & formatting */
assert.equal(columnsFor(0), 1);
assert.equal(columnsFor(3), 3);
assert.equal(columnsFor(44), 4);
assert.equal(columnsFor(44, 2), 2);
assert.equal(gridWidth(4), 4 * TREE_GEOMETRY.cardW + 3 * TREE_GEOMETRY.gap);
assert.equal(countLine({ direct: 44, total: 5597 }, false), "44 / 5597");
assert.equal(countLine({ direct: 0, total: 0 }, true), "");
assert.equal(countLine({ direct: 4, total: 5 }, true), "4 / 5");

/* zoom & options */
assert.equal(stepZoom(1, 1), 1.1);
assert.equal(stepZoom(1, -1), 0.9);
assert.equal(stepZoom(1.5, 1), 1.5);
assert.equal(stepZoom(0.4, -1), 0.4);
assert.equal(clampZoom(9), 1.5);
assert.equal(clampZoom("x"), 1);
assert.deepEqual(readTreeOptions("{bad"), { seatCode: false, counts: true, unit: false, density: "comfortable", autoFit: true });
assert.deepEqual(readTreeOptions({ seatCode: true, density: "compact", counts: "yes", autoFit: false }), { seatCode: true, counts: true, unit: false, density: "compact", autoFit: false });

/* ~600 seats: one pass, and the view stays small */
const big = { stations: [{ id: "hq", name: "HQ", isCompanyRoot: true, managerId: "e0" }], employees: [], orgSeats: [] };
for (let i = 0; i < 600; i += 1) {
  const boss = i === 0 ? "" : `e${Math.floor((i - 1) / 6)}`;
  big.employees.push({ id: `e${i}`, name: `موظف ${i}`, role: i ? "employee" : "owner", stationId: "hq", profile: boss ? { directManagerId: boss } : {} });
  big.orgSeats.push({ id: `t${i}`, title: "مسمى", stationId: "hq", employeeId: `e${i}`, ...(boss ? { reportsToEmployeeId: boss } : {}) });
}
big.ownerId = "e0";
const bt = buildOrgFocusTree(big, { viewerId: "e599", scope: "all", day: DAY });
const t0 = Date.now();
const bc = treeCounts(bt);
const bv = layoutOrgTree(bt, defaultExpanded(bt, bt.viewerKey), { childLimit: 24 });
assert.ok(Date.now() - t0 < 200, "counts + layout in well under a frame budget");
assert.equal(bc.get(bt.roots[0]).total, 599);
assert.ok(bv.cards.length < 60, `rendered ${bv.cards.length} cards, not 600`);

console.log("PASS test-org-tree-layout");

/* SAP movement: the start is a chain, not a crowd; the auto-fit zoom keeps the chart on screen */
{
  const { fitZoom } = await import("../src/lib/orgTreeLayout.js");
  const viewer = bt.viewerKey;
  const start = defaultExpanded(bt, viewer);
  assert.ok(!start.has(bt.nodes.get(viewer).parentKey), "the manager is not opened by default — peers stay folded");
  const chain = layoutOrgTree(bt, start, { childLimit: 24, focusKey: viewer });
  const depthOfViewer = chain.index.get(viewer).depth;
  for (let d = 0; d < depthOfViewer; d += 1) {
    assert.equal(chain.cards.filter((c) => c.depth === d).length, 1, `one card per level above the focus (level ${d})`);
  }
  assert.equal(fitZoom({ width: 2000, height: 600, availW: 1000, availH: 800 }), 0.55, "never below the floor");
  assert.equal(fitZoom({ width: 1200, height: 600, availW: 1000, availH: 800 }), 1000 / 1200);
  assert.equal(fitZoom({ width: 500, height: 300, availW: 1000, availH: 800 }), 1, "never above 1");
}

/* loose roots (seats with no manager) fold into one card beside the tree, and open on demand */
{
  const { ORPHAN_KEY } = await import("../src/lib/orgTreeLayout.js");
  const data = {
    stations: [{ id: "hq", name: "HQ", isCompanyRoot: true, managerId: "e0" }],
    employees: [{ id: "e0", name: "Owner", stationId: "hq", status: "active" }, { id: "e1", name: "A", stationId: "hq", status: "active", managerId: "e0" }],
    orgSeats: [
      { id: "s0", title: "CEO", stationId: "hq", holderId: "e0" },
      { id: "s1", title: "Mgr", stationId: "hq", holderId: "e1", reportsToSeatId: "s0" },
      { id: "v1", title: "Vacant 1", stationId: "hq" },
      { id: "v2", title: "Vacant 2", stationId: "hq" },
      { id: "v3", title: "Vacant 3", stationId: "hq" },
    ],
    ownerId: "e0",
  };
  const t = buildOrgFocusTree(data, { viewerId: "e0", scope: "all", day: DAY });
  if (t.roots.length > 1) {
    const l1 = layoutOrgTree(t, defaultExpanded(t, t.viewerKey), { focusKey: t.viewerKey });
    const fold = l1.cards.find((c) => c.key === `${ORPHAN_KEY}::more`);
    assert.ok(fold && fold.more === t.roots.length - 1, "the loose seats are one fold card");
    assert.ok(!l1.cards.some((c) => c.key.startsWith("v") && c.loose), "folded seats are not laid out");
    const l2 = layoutOrgTree(t, defaultExpanded(t, t.viewerKey), { focusKey: t.viewerKey, showAll: new Set([ORPHAN_KEY]) });
    assert.ok(l2.cards.some((c) => c.loose && c.key !== `${ORPHAN_KEY}::less`), "opened: the loose seats appear");
    assert.ok(l2.width > l1.width, "and the chart grows only then");
  }
}
