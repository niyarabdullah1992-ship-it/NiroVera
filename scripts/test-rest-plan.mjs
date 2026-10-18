import assert from "node:assert/strict";
import { checkRestPlanGate, restPlanChoices, resolveFlexDayBreaks } from "../src/lib/shiftDerivations.js";

const DAY = "2026-10-18";
const shift = { start: "07:00", end: "16:00", breakMode: "flex", flexBreak: { minutes: 60, from: "07:30", to: "15:30", split: true } };

// One block: only times that keep ≤ 5 h of work on each side (Art. 101).
const c = restPlanChoices({ shift, onDate: DAY });
assert.equal(c.single[0], "10:00");
assert.equal(c.single.at(-1), "12:00");
const early = checkRestPlanGate({ shift, onDate: DAY, parts: [{ start: "09:00", minutes: 60 }] });
assert.equal(early.error, "REST_PLAN_CONSECUTIVE", "an early single block leaves 6 h after it");
// Split: rest early and again later.
assert.ok(c.pairs.find((p) => p.first === "09:00")?.seconds.includes("13:00"));
assert.equal(checkRestPlanGate({ shift, onDate: DAY, parts: [{ start: "09:00", minutes: 30 }, { start: "13:00", minutes: 30 }] }).ok, true);
assert.equal(checkRestPlanGate({ shift, onDate: DAY, parts: [{ start: "09:00", minutes: 30 }, { start: "09:15", minutes: 30 }] }).error, "REST_PLAN_OVERLAP");
assert.equal(checkRestPlanGate({ shift, onDate: DAY, parts: [{ start: "10:00", minutes: 45 }] }).error, "REST_PLAN_TOTAL");
assert.equal(checkRestPlanGate({ shift: { ...shift, breakMode: "fixed" }, onDate: DAY, parts: [{ start: "10:00", minutes: 60 }] }).error, "NOT_FLEX_BREAK");

// Forgotten punch: the break is assumed at HIS plan, not the platform's guess.
const day = resolveFlexDayBreaks({ shift, breaks: [], checkIn: "07:00", checkOut: "16:00", onDate: DAY, plan: [{ start: "11:30", minutes: 60 }] });
assert.equal(day.assumed?.start, "11:30");
assert.equal(day.assumed?.end, "12:30");
console.log("PASS rest plan — the worker places his own break, within Art. 101");

// The platform rule: more than 8 hours opens a one-hour flex rest; 8 hours or less, or a chosen mode, stays.
import { longShiftRestPatch } from "../src/lib/shiftDerivations.js";
const nine = longShiftRestPatch({ start: "07:00", end: "16:00" }, DAY);
assert.equal(nine.breakMode, "flex");
assert.equal(nine.flexBreak.minutes, 60);
assert.equal(nine.flexBreak.split, true);
assert.equal(nine.flexBreak.from, "07:30");
assert.equal(nine.flexBreak.to, "15:30");
assert.equal(longShiftRestPatch({ start: "07:00", end: "15:00" }, DAY), null, "8 hours: no change");
assert.equal(longShiftRestPatch({ start: "07:00", end: "16:00", breakMode: "fixed" }, DAY), null, "a fixed break chosen by the manager stays");
assert.equal(longShiftRestPatch({ start: "19:00", end: "07:00" }, DAY).breakMode, "flex", "a 12-hour night opens it too");
console.log("PASS long shift opens a one-hour flex rest");

// A prayer inside the day is left out of the choices (Dhuhr 11:38 → no one-hour block covering it).
const withDhuhr = restPlanChoices({ shift, onDate: DAY, avoid: [{ from: 11 * 60 + 38, to: 11 * 60 + 53 }] });
assert.ok(!withDhuhr.single.includes("11:00"), "11:00–12:00 would cover the Dhuhr prayer");
assert.ok(withDhuhr.single.includes("10:00") && withDhuhr.single.includes("12:00"));
assert.ok(withDhuhr.avoided > 0);
// Avoiding everything falls back to the lawful list.
const all = restPlanChoices({ shift, onDate: DAY, avoid: [{ from: 7 * 60, to: 16 * 60 }] });
assert.ok(all.single.length > 0, "never leaves the worker with nothing to pick");
console.log("PASS rest plan avoids the prayer");
