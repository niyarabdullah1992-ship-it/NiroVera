import assert from "node:assert/strict";
import { allowanceLedger, siteConditions, kindAmount, ALLOWANCE_KINDS, HOSPITAL_FAR_MINUTES } from "../src/lib/allowanceKinds.js";

// GOSI elements per the employer guide: basic + housing + commissions only.
assert.deepEqual(ALLOWANCE_KINDS.filter((k) => k.gosi).map((k) => k.id).sort(), ["commission", "housing"]);

const wage = { base: 6000, split: true, housing: 1500, transport: 500, otherPlain: 0, other: 0, hazard: 300, living: 0, remote: 800, medical: 400, meals: 600, commission: 1000, night: 250, nightKind: "allowance", allowances: 5350, extras: 3100 };
const led = allowanceLedger(wage, true);
assert.deepEqual(led.rows.map((r) => r.id), ["housing", "transport", "hazard", "remote", "medical", "meals", "night", "commission"]);
assert.equal(led.cash, 6000 + 1500 + 500 + 300 + 800 + 400 + 600 + 250 + 1000);
assert.equal(led.contributoryRaw, 6000 + 1500 + 1000, "only basic + housing + commission are contributory");
assert.equal(led.rows.find((r) => r.id === "remote").gosiText, "غير خاضع");
assert.equal(led.rows.find((r) => r.id === "commission").eos, "يدخل ما لم يُستثنَ كتابةً");
// Art. 107 estimate: hourly actual + 50% of hourly basic on 240 hours.
assert.equal(led.otHour, Math.round((led.cash / 240 + (6000 / 240) * 0.5) * 100) / 100);

// A lump is one line, counted whole for GOSI.
const lump = allowanceLedger({ base: 4000, split: false, allowances: 1200, night: 0, extras: 0 }, true);
assert.equal(lump.rows[0].id, "lump");
assert.equal(lump.contributoryRaw, 5200);
assert.equal(kindAmount({ split: false, other: 99 }, "other"), 0);

// Site: hospital 90 min away (> 60) — medical duty switches on; not met without an allowance or a clinic.
const far = siteConditions({ profile: { hospitalMinutes: 90 }, wage: { split: true } });
assert.equal(HOSPITAL_FAR_MINUTES, 60);
assert.equal(far.far, true);
assert.deepEqual(far.duties.map((d) => d.id), ["medical"]);
assert.equal(far.open, 1);
const covered = siteConditions({ profile: { hospitalMinutes: 90 }, wage: { split: true, medical: 400 } });
assert.equal(covered.open, 0);
assert.equal(covered.duties[0].howAr, "بدل بُعد الخدمات الطبية");
// Exactly at the threshold is not "far".
assert.equal(siteConditions({ profile: { hospitalMinutes: 60 } }).far, false);
// Remote site: medical + housing/camps + meals + transport (146, 147, 148); night worker adds the 18632 transfer.
const remote = siteConditions({ station: { remoteSite: true }, profile: { housingMode: "provided" }, wage: { split: true, transport: 300 }, nightWorker: true });
assert.deepEqual(remote.duties.map((d) => d.id), ["medical", "housing147", "meals", "transport148", "nightTransfer"]);
assert.deepEqual(remote.duties.map((d) => d.met), [false, true, false, true, false]);
// Nothing known about the site: no duties and nothing claimed.
const none = siteConditions({});
assert.equal(none.known, false);
assert.equal(none.duties.length, 0);
console.log("allowance kinds ok");
