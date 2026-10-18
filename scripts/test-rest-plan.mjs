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

// The law, literally: past five hours, the statutory 30 minutes (Art. 101) — two of them when one cannot keep
// every stretch within five hours. Deducted on their own (Art. 102); no plan, no punch.
import { longShiftRestPatch, statutoryRestParts } from "../src/lib/shiftDerivations.js";
const nine = longShiftRestPatch({ start: "07:00", end: "16:00" }, DAY);
assert.equal(nine.breakMode, "flex");
assert.equal(nine.flexBreak.minutes, 30, "9 hours → one statutory rest of 30 minutes");
assert.equal(nine.flexBreak.split, false);
assert.equal(nine.flexBreak.from, "07:00", "the window is the whole duty");
assert.equal(nine.flexBreak.to, "16:00");
assert.equal(longShiftRestPatch({ start: "07:00", end: "15:00" }, DAY).flexBreak.minutes, 30, "8 hours → 30 minutes");
assert.equal(longShiftRestPatch({ start: "08:00", end: "12:00" }, DAY), null, "five hours or less: no rest");
assert.equal(longShiftRestPatch({ start: "07:00", end: "16:00", breakMode: "fixed" }, DAY).breakMode, "flex", "no roster-fixed break any more");
{ const p = longShiftRestPatch({ start: "07:00", end: "16:00" }, DAY); assert.equal(longShiftRestPatch({ start: "07:00", end: "16:00", ...p }, DAY), null, "idempotent"); }
const twelve = longShiftRestPatch({ start: "19:00", end: "07:00" }, DAY);
assert.equal(twelve.flexBreak.minutes, 60, "12 hours → two statutory rests");
assert.equal(twelve.flexBreak.split, true);
assert.deepEqual(statutoryRestParts(720).map((p) => p.from), [220, 470], "evenly spread: 3:40 of work between");
assert.equal(statutoryRestParts(540).length, 1);
console.log("PASS statutory rest — 30 minutes past five hours, two on a 12-hour day");

// A prayer inside the day is left out of the choices (Dhuhr 11:38 → no one-hour block covering it).
const withDhuhr = restPlanChoices({ shift, onDate: DAY, avoid: [{ from: 11 * 60 + 38, to: 11 * 60 + 53 }] });
assert.ok(!withDhuhr.single.includes("11:00"), "11:00–12:00 would cover the Dhuhr prayer");
assert.ok(withDhuhr.single.includes("10:00") && withDhuhr.single.includes("12:00"));
assert.ok(withDhuhr.avoided > 0);
// Avoiding everything falls back to the lawful list.
const all = restPlanChoices({ shift, onDate: DAY, avoid: [{ from: 7 * 60, to: 16 * 60 }] });
assert.ok(all.single.length > 0, "never leaves the worker with nothing to pick");
console.log("PASS rest plan avoids the prayer");

// Open time: any start inside the duty is accepted when Art. 101 holds; outside the duty is named.
const openShift = { ...shift, flexBreak: { ...shift.flexBreak, from: "07:00", to: "16:00" } };
assert.equal(checkRestPlanGate({ shift: openShift, onDate: DAY, parts: [{ start: "11:20", minutes: 60 }] }).ok, true);
assert.equal(checkRestPlanGate({ shift: openShift, onDate: DAY, parts: [{ start: "15:30", minutes: 60 }] }).error, "REST_PLAN_OUTSIDE_WINDOW");
console.log("PASS open rest time inside the duty");

// Company policy: prayer counted as work (default 20 min), off unless the company turns it on.
import { hoursPolicyOf } from "../src/lib/laborHoursPolicy.js";
assert.equal(hoursPolicyOf({}).prayerPaid, false);
assert.equal(hoursPolicyOf({}).prayerMinutes, 20);
assert.equal(hoursPolicyOf({ hoursPolicy: { prayerCountsAsWork: true, prayerMinutes: 15 } }).prayerPaid, true);
assert.equal(hoursPolicyOf({ hoursPolicy: { prayerCountsAsWork: true, prayerMinutes: 15 } }).prayerMinutes, 15);
console.log("PASS prayer policy");

// No punch needed: the break he set is told as it comes — 15 min ahead, then «بدأت راحتك التي حددتها».
import { deriveDutyAlerts } from "../src/lib/dutyAlerts.js";
{
  const flexShift = { id: "m", start: "07:00", end: "16:00", breakMode: "flex", flexBreak: { minutes: 60, from: "07:00", to: "16:00", split: true } };
  const at = (hm) => new Date(`${DAY}T${hm}:00+03:00`);
  const punches = { checkIn: at("07:00").toISOString(), breaks: [], restPlan: [{ start: "11:00", minutes: 60 }] };
  const soon = deriveDutyAlerts({ shift: flexShift, punches, onDate: DAY, now: at("10:50") });
  assert.ok(soon.alerts.some((a) => a.id === "flex_plan_soon" && /بعد/.test(a.textAr)), "told before it starts");
  const started = deriveDutyAlerts({ shift: flexShift, punches, onDate: DAY, now: at("11:05") });
  assert.ok(started.alerts.some((a) => /بدأت راحتك التي حددتها/.test(a.textAr) && /لا تحتاج بصمة/.test(a.textAr)), "told when it starts — no punch");
}
console.log("PASS planned break told without a punch");
