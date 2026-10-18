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
