/**
 * Branch locations: the Saudi list (13 regions), the picker search, the migration matcher (name /
 * location text → city, display only), the location gate and its server twin, and the «الفروع»
 * grouping — HQ → (country when several) → city → branch; a unit groups by city only when its
 * branches span 2+ cities; «بلا مدينة محددة»; the employee's chain HQ → city → their branch.
 */
import assert from "node:assert/strict";
import * as fe from "../src/lib/geoPlaces.js";
import * as be from "../base44/shared/geoPlaces.ts";
import { branchKey, buildBranchTree, defaultBranchExpanded, expandAllBranches } from "../src/lib/orgBranches.js";
import { layoutOrgTree } from "../src/lib/orgTreeLayout.js";
import { searchFocusTree } from "../src/lib/orgFocus.js";

/* the list */
assert.equal(fe.SA_REGIONS.length, 13, "all 13 administrative regions");
assert.ok(fe.SA_REGIONS.every((r) => r.cities.length >= 4 && r.ar && r.en));
const qassim = fe.SA_REGIONS.find((r) => r.id === "qassim").cities.map((c) => c.ar);
["بريدة", "عنيزة", "الرس"].forEach((city) => assert.ok(qassim.includes(city)));
const riyadh = fe.SA_REGIONS.find((r) => r.id === "riyadh").cities.map((c) => c.ar);
["الرياض", "الخرج", "الدرعية"].forEach((city) => assert.ok(riyadh.includes(city)));
assert.equal(fe.DEFAULT_COUNTRY, "SA");
assert.ok(fe.COUNTRY_CODES.includes("AE") && fe.COUNTRY_CODES.includes("KW"));

/* search: Arabic-tolerant, English too, region names reach their cities */
assert.equal(fe.searchSaCities("جده")[0].ar, "جدة", "ة / ه fold");
assert.equal(fe.searchSaCities("unaiz")[0].ar, "عنيزة", "English");
assert.ok(fe.searchSaCities("القصيم").some((c) => c.ar === "الرس"), "a region name lists its cities");
assert.equal(fe.findSaCity("Ar Rass").regionId, "qassim");

/* the migration matcher: clear whole-word matches only */
const m = (t) => fe.matchCityInText(t)?.ar || "";
assert.equal(m("فرع جدة"), "جدة");
assert.equal(m("فرع الدمام"), "الدمام");
assert.equal(m("ميناء الدمام"), "الدمام");
assert.equal(m("فرع خميس مشيط"), "خميس مشيط", "the longest name wins");
assert.equal(m("فرع الهفوف"), "الأحساء", "a governorate's known alias");
assert.equal(m("Riyadh office"), "الرياض");
assert.equal(m("المنطقة الشرقية"), "", "a region is not a city");
assert.equal(m("المكتب الرئيسي"), "");
assert.equal(m("فرع العليا"), "", "a district is not guessed");

/* stationPlace: stored first; derived from the name is marked derived (and never written) */
const derived = { id: "x", name: "فرع جدة" };
assert.deepEqual([fe.stationPlace(derived).city, fe.stationPlace(derived).derived], ["جدة", true]);
assert.equal(derived.city, undefined, "nothing written");
assert.deepEqual([fe.stationPlace({ name: "فرع جدة", countryCode: "SA", city: "الرياض" }).city, fe.stationPlace({ name: "فرع جدة", countryCode: "SA", city: "الرياض" }).derived], ["الرياض", false], "a saved city wins over the name");
assert.equal(fe.stationPlace({ countryCode: "AE", city: "Dubai" }).city, "Dubai");

/* the gate — and the server twin answers the same */
const gates = [
  {},
  { countryCode: "ZZ", city: "x" },
  { countryCode: "SA" },
  { countryCode: "SA", city: "مدينة لا توجد" },
  { countryCode: "sa", city: "jeddah" },
  { countryCode: "AE", city: "Dubai" },
  { countryCode: "KW", city: "" },
];
for (const g of gates) assert.deepEqual(be.checkStationLocationGate(g), fe.checkStationLocationGate(g), JSON.stringify(g));
assert.equal(fe.checkStationLocationGate({ countryCode: "ZZ" }).error, "GEO_COUNTRY_UNKNOWN");
assert.match(fe.checkStationLocationGate({ countryCode: "ZZ" }).reason, /غير معروفة/);
assert.equal(fe.checkStationLocationGate({ countryCode: "SA" }).error, "GEO_CITY_REQUIRED", "city required for Saudi branches");
assert.deepEqual(fe.checkStationLocationGate({ countryCode: "sa", city: "jeddah" }).place, { countryCode: "SA", city: "جدة", cityRegion: "makkah" });
assert.equal(fe.checkStationLocationGate({ countryCode: "KW", city: "" }).ok, true, "abroad, the city is free text and optional");
assert.deepEqual(be.matchCityInText("فرع الدمام")?.ar, fe.matchCityInText("فرع الدمام")?.ar);
assert.equal(be.SA_REGIONS.length, fe.SA_REGIONS.length);

/* grouping */
const base = (stations, employees = []) => ({
  ownerId: "o",
  stations: [{ id: "hq", name: "المقر الرئيسي", isCompanyRoot: true, managerId: "o" }, ...stations],
  employees: [{ id: "o", name: "المالك", role: "owner", stationId: "hq" }, ...employees],
  orgSeats: [{ id: "s_o", title: "الرئيس", stationId: "hq", employeeId: "o" }],
});
const data = base([
  { id: "olaya", name: "فرع العليا", parentStationId: "hq", countryCode: "SA", city: "الرياض", cityRegion: "riyadh" },
  { id: "malaz", name: "فرع الملز", parentStationId: "hq", countryCode: "SA", city: "الرياض", cityRegion: "riyadh" },
  { id: "jed", name: "فرع جدة", parentStationId: "hq" },
  { id: "loose", name: "فرع الشمال", parentStationId: "hq" },
  { id: "east", name: "المنطقة الشرقية", unitKind: "manager", parentStationId: "hq" },
  { id: "dmm", name: "فرع الدمام", parentStationId: "east" },
  { id: "khb", name: "فرع الخبر", parentStationId: "east" },
  { id: "west", name: "المنطقة الغربية", unitKind: "manager", parentStationId: "hq" },
  { id: "rbg", name: "فرع رابغ", parentStationId: "west" },
  { id: "rbg2", name: "فرع رابغ الصناعي", parentStationId: "west" },
], [
  { id: "a", name: "أ", role: "employee", stationId: "olaya" },
  { id: "b", name: "ب", role: "employee", stationId: "olaya" },
  { id: "c", name: "ج", role: "employee", stationId: "malaz" },
  { id: "e", name: "هـ", role: "employee", stationId: "rbg2", profile: { directManagerId: "o" } },
]);
const tree = buildBranchTree(data, { viewerId: "o", scope: "all", health: true });
const N = (k) => tree.nodes.get(k);
const B = (id) => N(branchKey(id));
const up = (node) => N(node.parentKey);

const riy = up(B("olaya"));
assert.equal(riy.kind, "city");
assert.equal(riy.name, "الرياض");
assert.equal(riy.title, "منطقة الرياض", "the region in muted text");
assert.equal(up(B("malaz")).key, riy.key, "الرياض → فرع العليا، فرع الملز");
assert.equal(riy.branchCount, 2);
assert.equal(riy.headcount, 3, "«فروع n · موظفون n»");
assert.equal(up(riy).key, branchKey("hq"), "HQ → city (one country: no country layer)");
assert.equal(up(B("jed")).name, "جدة", "a city derived from the name groups too (display only)");
assert.equal(B("jed").cityDerived, true);
assert.equal(up(B("loose")).noCity, true, "«بلا مدينة محددة»");
assert.equal(B("loose").needsCity, true, "owner / HR get «حدّد المدينة»");
assert.equal(B("olaya").needsCity, false);

/* a unit groups by city only with 2+ cities; region managers and the parent field stand */
assert.equal(up(B("east")).key, branchKey("hq"), "the region stays a unit under HQ");
assert.equal(up(B("dmm")).kind, "city", "الدمام and الخبر → grouped under the region");
assert.equal(up(up(B("dmm"))).key, branchKey("east"));
assert.notEqual(up(B("dmm")).key, up(B("khb")).key);
assert.equal(up(B("rbg")).key, branchKey("west"), "one city under the region → no city layer");
assert.equal(up(B("rbg2")).key, branchKey("west"));

/* several countries: HQ → country → city → branch */
const multi = buildBranchTree(base([
  { id: "ruh", name: "فرع الرياض", parentStationId: "hq", countryCode: "SA", city: "الرياض" },
  { id: "dxb", name: "Dubai branch", parentStationId: "hq", countryCode: "AE", city: "Dubai" },
]), { viewerId: "o", scope: "all" });
const ruh = multi.nodes.get(branchKey("ruh"));
const city = multi.nodes.get(ruh.parentKey);
const country = multi.nodes.get(city.parentKey);
assert.equal(country.kind, "country");
assert.equal(country.name, "السعودية");
assert.equal(country.parentKey, branchKey("hq"));
const dubai = multi.nodes.get(multi.nodes.get(branchKey("dxb")).parentKey);
assert.equal(dubai.name, "Dubai");
assert.equal(multi.nodes.get(dubai.parentKey).name, "الإمارات");

/* default: every group open so every branch shows; expand-all includes groups; no overlap */
const open = defaultBranchExpanded(tree);
assert.ok(open.has(riy.key) && open.has(up(B("loose")).key) && open.has(branchKey("east")));
const geo = { cardW: 248, cardH: 120, gap: 12, rowGap: 40, maxCols: 4 };
const layout = layoutOrgTree(tree, open, { ...geo, focusKey: branchKey("hq") });
["olaya", "malaz", "jed", "loose", "dmm", "khb", "rbg", "rbg2"].forEach((id) => assert.ok(layout.index.has(branchKey(id)), `${id} on screen`));
for (let i = 0; i < layout.cards.length; i += 1) {
  for (let j = i + 1; j < layout.cards.length; j += 1) {
    const a = layout.cards[i];
    const b = layout.cards[j];
    assert.ok(a.x + geo.cardW <= b.x || b.x + geo.cardW <= a.x || a.y + geo.cardH <= b.y || b.y + geo.cardH <= a.y, `${a.key} overlaps ${b.key}`);
  }
}
assert.ok(expandAllBranches(tree).has(riy.key));

/* search finds a city */
assert.equal(searchFocusTree(tree, "الرياض", 3)[0].key, riy.key);

/* the employee: HQ → city → their branch, nothing else */
const mine = buildBranchTree(data, { viewerId: "a", scope: "mine" });
const me = mine.nodes.get(mine.viewerKey);
assert.equal(me.stationId, "olaya");
assert.equal(mine.nodes.get(me.parentKey).name, "الرياض");
assert.equal(mine.nodes.get(mine.nodes.get(me.parentKey).parentKey).stationId, "hq");
assert.ok(![...mine.nodes.values()].some((n) => n.stationId === "malaz"), "no other branch");
assert.ok(![...mine.nodes.values()].some((n) => n.kind === "city" && n.counted), "no counts for employees");

console.log("PASS test-org-geo");
