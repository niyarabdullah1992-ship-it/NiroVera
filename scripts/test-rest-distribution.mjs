import assert from "node:assert/strict";
import { distributeShiftRests, rosterBreakWindows } from "../src/lib/shiftWeek.js";

const DAY = "2026-10-18";
const blocks = (shift) => {
  const w = rosterBreakWindows(shift, DAY);
  const [h, m] = shift.start.split(":").map(Number);
  const start = h * 60 + m;
  let [eh, em] = shift.end.split(":").map(Number);
  let end = eh * 60 + em; if (end <= start) end += 1440;
  const out = []; let from = start;
  for (const row of w) { out.push(row.startMin - from); from = row.endMin; }
  out.push(end - from);
  return { w, out };
};
// 8 h and 9 h: one period, centred, as before.
assert.equal(rosterBreakWindows({ start: "07:00", end: "15:00", restMinutes: 30 }, DAY).length, 1);
assert.equal(rosterBreakWindows({ start: "07:00", end: "16:00", restMinutes: 60 }, DAY).length, 1);
// 12 h: one centred period would leave 5:45 of work on each side — the platform lays out two, each ≥ 30 min.
for (const shift of [{ start: "07:00", end: "19:00", restMinutes: 30 }, { start: "19:00", end: "07:00", restMinutes: 60 }]) {
  const { w, out } = blocks(shift);
  assert.equal(w.length, 2, `${shift.start}-${shift.end} takes two rests`);
  assert.ok(w.every((row) => row.minutes >= 30), "each rest is at least half an hour «في المرة الواحدة»");
  assert.ok(out.every((mins) => mins <= 300), `no stretch over 5 h: ${out.join(",")}`);
}
// Every shift up to 12 h keeps Art. 101 once laid out.
for (let span = 6 * 60; span <= 12 * 60; span += 30) {
  for (const rest of [30, 45, 60, 90]) {
    const parts = distributeShiftRests({ span, rest, minRest: 30, consecMax: 300 });
    let from = 0; const stretches = [];
    for (const p of parts) { stretches.push(p.from - from); from = p.from + p.minutes; }
    stretches.push(span - from);
    assert.ok(stretches.every((m) => m <= 300), `span ${span} rest ${rest}: ${stretches.join(",")}`);
    assert.ok(parts.every((p) => p.minutes >= 30));
  }
}
console.log("PASS rests laid out per Art. 101");
