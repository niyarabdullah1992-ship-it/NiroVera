/**
 * Focused org chart — the neighbourhood around one card (chain, manager, peers, reports),
 * keyboard moves, search, focus resolution, the unseated fallback, and the visibility pruning
 * that keeps an employee's data to their chain, peers and subtree (names/titles only).
 */
import assert from "node:assert/strict";
import {
  buildOrgFocusTree,
  deriveFocusNeighborhood,
  focusMove,
  focusStateLabel,
  foldSearch,
  resolveFocusKey,
  searchFocusTree,
  unseatedPlace,
  visibleKeysFor,
} from "../src/lib/orgFocus.js";

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
    { id: "s_w2", title: "فني ميداني", stationId: "kh", employeeId: "w2", reportsToEmployeeId: "m", code: "KHF-003" },
    { id: "s_w3", title: "فني", stationId: "ops", employeeId: "w3", reportsToEmployeeId: "w1", code: "KHF-004" },
    { id: "s_vac", title: "فني صيانة", stationId: "kh", reportsToEmployeeId: "m", code: "KHF-009" },
    { id: "s_frz", title: "مهندس", stationId: "kh", reportsToEmployeeId: "w1", state: "frozen", code: "KHF-010" },
    { id: "s_rx", title: "محاسب", stationId: "rb", employeeId: "rx", reportsToEmployeeId: "r", code: "RBG-002" },
  ],
};

/* full tree (HR / owner) */
const all = buildOrgFocusTree(data, { viewerId: "o", scope: "all", day: DAY });
assert.equal(all.viewerKey, "s_o");
assert.equal(resolveFocusKey(all, ""), "s_o", "no focus asked → the viewer");
assert.equal(resolveFocusKey(all, "w1"), "s_w1", "employee id resolves to their seat");
assert.equal(resolveFocusKey(all, "seat:s_vac"), "s_vac", "chart node id resolves");
assert.equal(resolveFocusKey(all, "nope"), "s_o", "an unknown focus falls back to the viewer");

const atW1 = deriveFocusNeighborhood(all, "s_w1");
assert.equal(atW1.focus.name, "عمر");
assert.equal(atW1.focus.seatCode, "KHF-002");
assert.equal(atW1.focus.unit, "فرع الخفجي");
assert.deepEqual(atW1.chain.map((c) => c.key), ["s_o", "s_m"], "breadcrumb runs top → manager");
assert.equal(atW1.manager.key, "s_m");
assert.deepEqual(atW1.reports.map((c) => c.key), ["s_w3", "s_frz"], "people first, then open seats");
assert.equal(atW1.reports[1].state, "frozen");
assert.equal(atW1.reports[1].vacant, true);
assert.equal(atW1.reports[1].name, "", "a vacant seat carries no name");
const peerKeys = atW1.peers.map((c) => c.key);
assert.ok(peerKeys.includes("s_w2") && peerKeys.includes("a") && peerKeys.includes("s_vac"));
assert.ok(!peerKeys.includes("s_w1"), "the focus is not its own peer");
assert.equal(atW1.peers[atW1.peers.length - 1].key, "s_vac", "open seats trail the peers");
assert.equal(atW1.focus.reports, 2);
assert.equal(atW1.focus.people, 1);

const acting = deriveFocusNeighborhood(all, "a").focus;
assert.equal(acting.state, "acting");
assert.equal(focusStateLabel("acting"), "مكلَّف");
assert.equal(focusStateLabel("filled"), "", "a filled seat shows no chip");
assert.equal(focusStateLabel("vacant", false), "Vacant");

const top = deriveFocusNeighborhood(all, "s_o");
assert.equal(top.manager, null);
assert.deepEqual(top.chain, []);
assert.deepEqual(top.reports.map((c) => c.key).sort(), ["s_m", "s_r"]);

/* keyboard moves */
assert.equal(focusMove(all, "s_w1", "up"), "s_m");
assert.equal(focusMove(all, "s_o", "up"), "");
assert.equal(focusMove(all, "s_w1", "down"), "s_w3");
assert.equal(focusMove(all, "s_w2", "down"), "");
const row = ["a", "s_w2", "s_w1"].sort((x, y) => all.nodes.get(x).name.localeCompare(all.nodes.get(y).name, "ar"));
const mid = row[1];
assert.equal(focusMove(all, mid, "prev"), row[0]);
assert.equal(focusMove(all, mid, "next"), row[2]);
assert.equal(focusMove(all, row[2], "next"), "s_vac", "the row continues into open seats");
assert.equal(focusMove(all, "s_vac", "next"), "", "no wrap past the end");

/* search: name, title, seat code, unit — Arabic-tolerant */
assert.equal(foldSearch("أحمد"), "احمد");
assert.equal(foldSearch("مُشرفة"), "مشرفه");
assert.equal(searchFocusTree(all, "احمد")[0].key, "s_m", "hamza-free spelling finds أحمد");
assert.equal(searchFocusTree(all, "khf-003")[0].key, "s_w2", "seat code, any case");
assert.ok(searchFocusTree(all, "رابغ").some((c) => c.key === "s_rx"), "unit name");
assert.ok(searchFocusTree(all, "مشرف").some((c) => c.key === "s_w1"), "title");
assert.deepEqual(searchFocusTree(all, "   "), []);

/* an employee's view — pruned in the data */
const mine = buildOrgFocusTree(data, { viewerId: "w1", scope: "mine", day: DAY });
assert.equal(mine.viewerKey, "s_w1");
const keys = [...mine.nodes.keys()].sort();
assert.deepEqual(keys, ["a", "s_frz", "s_m", "s_o", "s_w1", "s_w2", "s_w3"].sort(),
  "chain + self + people peers + own subtree; not the other branch, not the peer open seat");
assert.ok(!mine.nodes.has("s_r") && !mine.nodes.has("s_rx"), "another branch never reaches the page");
const mineMgr = deriveFocusNeighborhood(mine, "s_m");
assert.ok(!mineMgr.peers.some((c) => c.key === "s_r"), "the manager's peers stay hidden");
assert.deepEqual(deriveFocusNeighborhood(mine, "s_o").reports.map((c) => c.key), ["s_m"], "the top shows only the viewer's line");
assert.equal(deriveFocusNeighborhood(mine, "s_w2").reports.length, 0, "a peer's own team stays hidden");
for (const node of mine.nodes.values()) {
  assert.equal(node.empLine, undefined, "no employee number");
  assert.equal(node.hireStamp, undefined, "no hire date");
  assert.equal(node.grade, undefined, "no grade");
}
assert.ok(searchFocusTree(mine, "خالد").length === 0, "search cannot reach outside the view");
assert.equal(resolveFocusKey(mine, "s_rx"), "s_w1", "a URL focus outside the view falls back to self");
assert.equal(visibleKeysFor(mine, "").size, 0);

/* a manager sees their whole subtree */
const lead = buildOrgFocusTree(data, { viewerId: "m", scope: "mine", day: DAY });
assert.ok(lead.nodes.has("s_w3") && lead.nodes.has("s_frz") && lead.nodes.has("s_vac"), "subtree incl. open seats");
assert.ok(!lead.nodes.has("s_rx"));
assert.ok(lead.nodes.has("s_r"), "peers under the same manager");

/* a person without a seat on the chart */
const loose = buildOrgFocusTree(data, { viewerId: "loose", scope: "mine", day: DAY });
assert.equal(loose.viewerKey, "");
assert.equal(loose.nodes.size, 0, "no seat → nothing else is shown");
const place = unseatedPlace(data, "loose");
assert.equal(place.unit, "فرع الخفجي");
assert.equal(place.managerName, "أحمد سالم", "the unit manager stands in for the manager");
assert.equal(unseatedPlace(data, "ghost"), null);

console.log("org-focus: ok");
