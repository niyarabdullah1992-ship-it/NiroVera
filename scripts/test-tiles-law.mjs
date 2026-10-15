// Calm cards — no coloured top/side edge strip on cards, tiles, panels; status is a text chip (warn/bad only).
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FLAG_DEFAULT_TEXT, flagKind, flagStyle, flagText } from "../src/lib/statusFlag.js";
import { docFrame } from "../src/lib/designSystem.js";
import { statusBanner } from "../src/lib/platformStyles.js";

// 1. Tone → chip kind: only warn/bad families colour; ok/neutral/mute stay colourless.
for (const t of ["warn", "watch", "waiting", "late", "alert", "pending"]) assert.equal(flagKind(t), "warn", t);
for (const t of ["bad", "urgent", "blocked", "danger", "absent", "exposed", "overdue"]) assert.equal(flagKind(t), "bad", t);
for (const t of ["ok", "mute", "neutral", "rest", "leave", "", null, undefined]) assert.equal(flagKind(t), null, String(t));

// 2. Text: caller's specific flag wins; else the defaults.
assert.equal(flagText("warn", true), "يحتاج متابعة");
assert.equal(flagText("bad", true), "يحتاج إجراء");
assert.equal(flagText("warn", false), "Needs attention");
assert.equal(flagText("bad", false), "Action needed");
assert.equal(flagText("warn", true, "تأخير مسجّل"), "تأخير مسجّل");
assert.equal(flagText("ok", true, "anything"), "");
assert.equal(FLAG_DEFAULT_TEXT.bad.en, "Action needed");

// 3. Style: small pill on existing tokens (dark mode flips them); none for ok.
const warnStyle = flagStyle("warn");
assert.equal(warnStyle.background, "var(--nv-warn-soft)");
assert.equal(warnStyle.color, "var(--nv-warn-ink)");
assert.equal(warnStyle.padding, "2px 8px");
assert.ok(warnStyle.fontSize >= 10.5 && warnStyle.fontSize <= 11);
assert.equal(warnStyle.borderRadius, 999);
assert.equal(flagStyle("bad").color, "var(--nv-bad-ink)");
assert.equal(flagStyle("ok"), null);

// 4. Shared chrome carries no coloured top edge.
assert.equal(docFrame("blocked").borderTop, undefined);
for (const k of ["ok", "warn", "bad"]) assert.equal(statusBanner[k].borderTop, undefined, k);

// 5. Source sweep: no 3px top strip on any card under src (calendar/print/landing rules are not cards).
const root = new URL("../src/", import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(jsx?|css)$/.test(name)) files.push(full);
  }
})(root);
const ALLOW = [/printReport\.js$/, /printDocument\.js$/];
const BAR = /borderTop: ?[`"']3px|border-top: ?[2-6]px solid|insetInline: 0, top: 0, height: 3|top: 0, insetInline: 0, height: 3|aria-hidden style=\{\{ ?height: 3, background|borderTop: `\$\{DS_EDGE_PX\}px/;
const hits = [];
for (const file of files) {
  if (ALLOW.some((re) => re.test(file))) continue;
  readFileSync(file, "utf8").split("\n").forEach((line, i) => { if (BAR.test(line)) hits.push(`${file.slice(root.length)}:${i + 1}`); });
}
assert.deepEqual(hits, [], `coloured top strips left: ${hits.join(", ")}`);

// 6. DutyTile: no top span; flag chip by tone; MyRecordPage passes the specific flags.
const tile = readFileSync(join(root, "components/schedules/DutyTiles.jsx"), "utf8");
assert.doesNotMatch(tile, /height: 3/);
assert.match(tile, /<StatusFlag tone=\{tone\} flag=\{flag\} ar=\{ar\} \/>/);
const rec = readFileSync(join(root, "components/attendance/MyRecordPage.jsx"), "utf8");
assert.match(rec, /أقل من المجدول/);
assert.match(rec, /Below schedule/);
assert.match(rec, /تأخير مسجّل/);
assert.match(rec, /Lateness on file/);

// 7. Public verify result keeps its meaning visible without a bar.
const verify = readFileSync(join(root, "components/files/VerifyDocumentCard.jsx"), "utf8");
assert.match(verify, /data-verify-state=\{kind\}/);
assert.doesNotMatch(verify, /borderTop: `3px/);

console.log("tiles-law: ok");
