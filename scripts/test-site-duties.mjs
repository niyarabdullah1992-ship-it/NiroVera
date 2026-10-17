import assert from "node:assert/strict";
// Regs Art. 29 (first-aid cabinet) and Art. 30 (remote places) — derived from what the station records.
import { FIRST_AID_ITEMS, checkFirstAidRecordGate, deriveFirstAidCabinet, firstAidSummary } from "../src/lib/firstAidCabinet.js";
import { checkSiteRecordGate, deriveRemoteness, stationWithSite } from "../src/lib/siteRemoteness.js";
import { siteConditions } from "../src/lib/allowanceKinds.js";
import { forcedLabourRegsNote, remotePlacesRegsNote } from "../src/lib/implementingRegsNotes.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };

ok("regs 30: 50 km paved / 25 km unpaved, or a cluster without services", () => {
  assert.equal(deriveRemoteness({ distanceKm: 50, roadType: "paved" }).remote, false);
  assert.equal(deriveRemoteness({ distanceKm: 51, roadType: "paved" }).remote, true);
  assert.equal(deriveRemoteness({ distanceKm: 26, roadType: "unpaved" }).remote, true);
  assert.equal(deriveRemoteness({ distanceKm: 25, roadType: "unpaved" }).remote, false);
  assert.equal(deriveRemoteness({ noServices: true }).basis, "services");
  assert.equal(deriveRemoteness({ distanceKm: 70 }).known, false, "a distance without a road type is not judged");
  assert.equal(deriveRemoteness({}, "yes").basis, "declared");
  assert.equal(checkSiteRecordGate({ distanceKm: 40 }).error, "SITE_ROAD_REQUIRED");
  assert.equal(checkSiteRecordGate({}).error, "SITE_DISTANCE_REQUIRED");
  assert.equal(checkSiteRecordGate({ distanceKm: "62.44", roadType: "paved" }).site.distanceKm, 62.4);
});

ok("regs 30: the derived flag switches on the 146/147 duties", () => {
  const data = { stations: [{ id: "s1", name: "الموقع" }], safety: [{ stationId: "s1", site: { distanceKm: 80, roadType: "paved" } }] };
  const station = stationWithSite(data, "s1");
  assert.equal(station.remoteSite, true);
  const site = siteConditions({ profile: {}, station, wage: {} });
  assert.equal(site.remote, true);
  assert.ok(site.duties.some((d) => d.id === "housing147"));
  assert.ok(site.duties.some((d) => d.id === "medical"));
  assert.match(remotePlacesRegsNote(true), /50 كم بطريق معبّد أو 25 كم بغير معبّد/);
  assert.match(forcedLabourRegsNote(true), /القطاع الخاص والقطاع غير الربحي/);
});

const full = Object.fromEntries(FIRST_AID_ITEMS.map((item) => [item.key, item.min]));
const allOk = { usable: true, sanitary: true, crescent: true, posted: true };

ok("regs 29: the table is the article's 23 items with their minimums", () => {
  assert.equal(FIRST_AID_ITEMS.length, 23);
  assert.equal(FIRST_AID_ITEMS.find((i) => i.key === "medical_wipes").min, 100);
  assert.equal(FIRST_AID_ITEMS.find((i) => i.key === "scissors").min, 2);
});

ok("regs 29: none → short → met → stale", () => {
  assert.equal(deriveFirstAidCabinet(null).state, "none");
  const short = deriveFirstAidCabinet({ counts: { ...full, burn_gauze: 49 }, conditions: allOk, location: "المستودع", keeper: "فهد", checkedAt: "2026-10-10" }, { today: "2026-10-16" });
  assert.equal(short.state, "short");
  assert.deepEqual(short.short.map((i) => i.key), ["burn_gauze"]);
  const unposted = deriveFirstAidCabinet({ counts: full, conditions: allOk, location: "", keeper: "فهد", checkedAt: "2026-10-10" }, { today: "2026-10-16" });
  assert.equal(unposted.state, "short", "no posted place → condition missing");
  const met = deriveFirstAidCabinet({ counts: full, conditions: allOk, location: "المستودع", keeper: "فهد", checkedAt: "2026-10-10" }, { today: "2026-10-16" });
  assert.equal(met.state, "met");
  assert.equal(deriveFirstAidCabinet({ counts: full, conditions: allOk, location: "المستودع", keeper: "فهد", checkedAt: "2026-08-01" }, { today: "2026-10-16" }).state, "stale");
  assert.equal(checkFirstAidRecordGate({ counts: { ...full, forceps: "" }, location: "المستودع", keeper: "فهد" }).error, "FIRST_AID_UNCOUNTED");
  assert.equal(checkFirstAidRecordGate({ counts: full, location: "", keeper: "فهد" }).error, "FIRST_AID_POSTING");
  const sum = firstAidSummary([{ id: "a" }, { id: "b" }], (id) => (id === "a" ? { firstAidCabinet: { counts: full, conditions: allOk, location: "س", keeper: "فهد", checkedAt: "2026-10-10" } } : null), { today: "2026-10-16" });
  assert.equal(sum.met, 1);
  assert.equal(sum.none, 1);
});

console.log(`site duties: ${n} checks passed`);
