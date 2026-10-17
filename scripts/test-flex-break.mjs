/**
 * test-flex-break.mjs — «راحة مرنة ببصمة»: a per-shift-type break mode (Arts 101–103).
 * Validation with named reasons; worked minutes from punched, split and assumed breaks; the assumed
 * break at the nearest prayer or the window's middle; the 30-minute minimum; over-long → late return;
 * the live alerts; fixed and continuous unchanged; the server twin agrees with the client.
 * Run: node scripts/test-flex-break.mjs
 */
import assert from "node:assert/strict";
import {
  checkConsecutiveWorkGate,
  checkFlexBreakGate,
  checkFlexBreakPunchGate,
  checkShiftBreakModeGate,
  placeAssumedFlexBreak,
  flexBreakOf,
  resolveFlexDayBreaks,
  shiftBreakMode,
  shiftRestMinutes,
} from "../src/lib/shiftDerivations.js";
import * as twin from "../base44/shared/shiftDerivations.ts";
import { deriveActualDutyCore } from "../base44/shared/reportsDerivations.ts";
import { actualDutyBreaches, closeDayBreaks, deriveActualDuty, resolveDayBreaks } from "../src/lib/actualDuty.js";
import { deriveDutyAlerts, planDutyAlertNotices } from "../src/lib/dutyAlerts.js";
import { actualShiftHours, rosterBreakWindows } from "../src/lib/shiftWeek.js";
import { getTodaysShift } from "../src/lib/attendanceDerivations.js";
import { stationPrayerTimes } from "../src/lib/prayerTimes.js";
import { ruleValue } from "../src/lib/laborRules.js";

const D = "2026-10-17";
const at = (hm) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};
const iso = (hm) => `${D}T${hm}:00+03:00`;
const FLEX = { id: "day", label: "نهاري", start: "07:00", end: "16:00", breakMode: "flex", flexBreak: { minutes: 60, from: "11:00", to: "15:00", split: true } };
const NOSPLIT = { ...FLEX, flexBreak: { ...FLEX.flexBreak, split: false } };
const FIXED = { id: "day", label: "نهاري", start: "07:00", end: "16:00", restMinutes: 60 };
const CONT = { hoursPolicy: { continuousWork103: true } };

/* ── the model: a missing value is fixed; Art. 103 maps to continuous ── */
assert.equal(shiftBreakMode({ start: "07:00", end: "16:00" }), "fixed", "missing → fixed");
assert.equal(shiftBreakMode({ ...FIXED, breakMode: "weird" }), "fixed");
assert.equal(shiftBreakMode(FLEX), "flex");
assert.equal(shiftBreakMode(FLEX, { continuous103: true }), "continuous", "the Art. 103 flag wins");
assert.equal(shiftRestMinutes(FLEX), 60, "flex minutes are the shift's rest");
assert.equal(actualShiftHours(FLEX, D), 8, "9 h presence − 60 min flex break = 8 h (Art. 98)");
assert.deepEqual(rosterBreakWindows(FLEX, D), [], "the roster places no flex break");
console.log("PASS model: fixed default, flex minutes, Art. 103 → continuous");

/* ── flex-break validation with named reasons ── */
const gate = (patch, shift = FLEX) => checkShiftBreakModeGate({ shift: { ...shift, ...patch, flexBreak: { ...shift.flexBreak, ...(patch.flexBreak || {}) } }, onDate: D });
assert.equal(gate({}).ok, true, "60 min in 11:00–15:00 of 07:00–16:00 is lawful");
assert.equal(gate({ flexBreak: { minutes: 20 } }).error, "FLEX_MINUTES_BELOW_MIN");
assert.match(gate({ flexBreak: { minutes: 20 } }).reason, /أقل من 30 دقيقة نظامية \(المادة 101\)/);
assert.equal(gate({ flexBreak: { from: "12:30", to: "15:00" } }).error, "FLEX_WINDOW_TOO_LATE", "opens 5h30 into the shift");
assert.match(gate({ flexBreak: { from: "12:30", to: "15:00" } }).reason, /لا يبقى العمل قبلها 5 ساعات أو أقل/);
assert.equal(gate({ flexBreak: { from: "08:00", to: "10:30" } }).error, "FLEX_WINDOW_TOO_EARLY", "5h30 of work after the window");
assert.equal(gate({ flexBreak: { from: "11:00", to: "11:40" } }).error, "FLEX_WINDOW_TOO_SHORT");
assert.equal(gate({ flexBreak: { from: "05:00", to: "06:00" } }).error, "FLEX_WINDOW_OUTSIDE_SHIFT");
assert.equal(gate({ flexBreak: { from: "", to: "" } }).error, "FLEX_WINDOW_REQUIRED");
assert.equal(gate({ end: "20:00" }).error, "SHIFT_STAY_OVER_CAP", "13 h presence above the 12 h ceiling (Art. 101)");
assert.equal(gate({ flexBreak: { minutes: 45, split: true } }).noteAr, "التقسيم يحتاج 60 دقيقة على الأقل — جزءان كل منهما 30.");
assert.equal(checkShiftBreakModeGate({ shift: { ...FIXED, breakMode: "continuous" }, onDate: D }).error, "BREAK_MODE_NEEDS_103");
assert.equal(checkShiftBreakModeGate({ shift: { ...FIXED, breakMode: "continuous" }, onDate: D, continuous103: true }).ok, true);
assert.equal(checkShiftBreakModeGate({ shift: { ...FIXED, breakMode: "nap" }, onDate: D }).error, "BREAK_MODE_UNKNOWN");
// A 12 h stay with a window only the split can serve: one part leaves > 5 h somewhere, two parts do not.
const LONG = { start: "06:00", end: "18:00", breakMode: "flex", flexBreak: { minutes: 60, from: "10:30", to: "13:00", split: false } };
assert.equal(checkFlexBreakGate({ shift: LONG, onDate: D }).error, "FLEX_NO_LAWFUL_PLACEMENT");
assert.equal(checkFlexBreakGate({ shift: { ...LONG, flexBreak: { ...LONG.flexBreak, to: "17:00", split: true } }, onDate: D }).ok, true);
// The publish gate reads the window, not a centred break.
assert.equal(checkConsecutiveWorkGate({ start: "07:00", end: "16:00", breakMode: "flex", flexBreak: { minutes: 60, from: "12:30", to: "15:00" }, onDate: D }).error, "FLEX_WINDOW_TOO_LATE");
console.log("PASS flex validation: minutes ≥ 30, window not too late / early / short / outside, ≤ 12 h, Art. 103");

/* ── worked minutes: punched, split and assumed breaks (Art. 102) ── */
const duty = (breaks, shift = FLEX, extra = {}) => deriveActualDuty({ checkIn: iso("07:00"), checkOut: iso("16:00"), shift, onDate: D, breaks, ...extra });
const punched = duty([{ start: iso("11:55"), end: iso("12:52"), source: "punch" }]);
assert.equal(punched.restMinutes, 57, "the actual break, not the roster's 60");
assert.equal(punched.workedMinutes, 483);
assert.deepEqual(punched.flags.map((f) => f.error), [], "4h55 then 3h08 — Art. 101 holds");
assert.equal(punched.lateReturnMinutes, 0);
const split = duty([{ start: iso("11:30"), end: iso("12:00") }, { start: iso("13:30"), end: iso("14:00") }]);
assert.equal(split.restMinutes, 60);
assert.equal(split.workedMinutes, 480, "two 30-minute parts");
assert.deepEqual(split.flags, []);
const assumedDay = duty([]);
assert.equal(assumedDay.restMinutes, 60, "no punch: the full minutes are still deducted");
assert.equal(assumedDay.workedMinutes, 480);
assert.equal(assumedDay.breakAssumed, true);
assert.deepEqual(assumedDay.flags, [], "an assumed break is a rest for Art. 101, like a fixed one — no breach");
const fixed = duty(undefined, FIXED);
assert.equal(fixed.workedMinutes, 480, "fixed: the roster's 60 minutes, as before");
assert.deepEqual(fixed.flags, []);
assert.equal(fixed.breakMode, "fixed");
console.log("PASS worked minutes: punched 57 → 483, split 30+30 → 480, assumed 60 → 480; fixed unchanged");

/* ── the assumed break: nearest prayer inside the window, else the window's middle ── */
const flex = flexBreakOf(FLEX, D);
const dhuhr = placeAssumedFlexBreak({ flex, prayers: { minutes: { fajr: at("04:40"), dhuhr: at("11:52"), asr: at("15:12") } } });
assert.deepEqual([dhuhr.start, dhuhr.end, dhuhr.placedBy, dhuhr.prayerKey], ["11:52", "12:52", "prayer", "dhuhr"]);
const middle = placeAssumedFlexBreak({ flex, prayers: { minutes: { fajr: at("04:40"), asr: at("15:12") } } });
assert.deepEqual([middle.start, middle.end, middle.placedBy], ["12:30", "13:30", "middle"], "no prayer inside → the middle");
const lateAsr = placeAssumedFlexBreak({ flex, prayers: { minutes: { asr: at("14:40") } } });
assert.deepEqual([lateAsr.start, lateAsr.end], ["14:00", "15:00"], "kept inside the window for the full minutes");
const khafji = { id: "st", countryCode: "SA", city: "الخفجي", cityRegion: "eastern" };
const real = stationPrayerTimes(khafji, D);
const realDay = resolveDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("07:00"), now: iso("15:05"), onDate: D, prayers: real });
assert.equal(realDay.assumed.placedBy, "prayer");
assert.equal(realDay.assumed.start, real.times.dhuhr, "Khafji Dhuhr");
const closed = closeDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("07:00"), checkOut: iso("16:00"), onDate: D, prayers: { minutes: { dhuhr: at("11:52") } } });
assert.equal(closed.length, 1);
assert.equal(closed[0].source, "assumed");
assert.equal(new Date(closed[0].start).toISOString(), new Date(iso("11:52")).toISOString(), "stored as an instant on the day record");
const closedOpen = closeDayBreaks({ shift: FLEX, breaks: [{ start: iso("12:00"), end: null, source: "punch" }], checkIn: iso("07:00"), checkOut: iso("12:20"), onDate: D });
assert.equal(closedOpen[0].end, iso("12:20"), "an open break ends at the checkout");
assert.equal(closeDayBreaks({ shift: FIXED, breaks: undefined, checkIn: iso("07:00"), checkOut: iso("16:00"), onDate: D }), undefined, "fixed: nothing written");
// Decided at check-in; it begins when the clock reaches its start (the middle 12:30 is past the 5h
// mark of a 07:00 check-in, so it moves to 12:00 — the latest start that keeps ≤ 5 h before it).
const before = resolveDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("07:00"), now: iso("11:59"), onDate: D });
assert.equal(before.assumed, null, "not yet");
assert.deepEqual([before.planned.start, before.planned.end], ["12:00", "13:00"], "planned at check-in, at the 5h mark");
const begun = resolveDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("07:00"), now: iso("12:00"), onDate: D });
assert.deepEqual([begun.assumed.start, begun.assumed.end, begun.assumedRunning], ["12:00", "13:00", true], "begins at its start");
const doneDay = resolveDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("07:00"), now: iso("14:00"), onDate: D });
assert.deepEqual([doneDay.assumed.start, doneDay.assumedRunning], ["12:00", false], "taken — no longer running");
assert.equal(resolveDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("11:00"), checkOut: iso("14:30"), onDate: D }).assumed.start, "12:30", "a late check-in: the middle, well inside 5 h");
assert.equal(resolveDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("14:20"), checkOut: iso("15:30"), onDate: D }).assumed, null, "arrived after the last start — none");
// Placement: the latest point that still keeps ≤ 5 h of consecutive work — Dhuhr 11:52 after a 06:30 check-in → 11:30.
const earlyIn = resolveDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("06:30"), now: iso("11:30"), onDate: D, prayers: { minutes: { dhuhr: at("11:52") } } });
assert.equal(earlyIn.assumed.start, "11:30", "the notice point is at the 5h mark, not after it");
assert.ok(earlyIn.assumed.startMin - at("06:30") <= ruleValue("hours.rest.maxConsecutiveHours", D) * 60);
assert.equal(resolveDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("07:00"), now: iso("12:00"), onDate: D, prayers: { minutes: { dhuhr: at("11:52") } } }).assumed.start, "11:52", "the prayer when it is inside 5 h");
// «بدأت راحتي» during it replaces it.
const replaced = resolveDayBreaks({ shift: FLEX, breaks: [{ start: iso("12:20"), source: "punch" }], checkIn: iso("07:00"), now: iso("12:30"), onDate: D });
assert.equal(replaced.assumed, null, "the punch replaces the assumed break");
assert.equal(replaced.open.start, "12:20");
// A checkout inside it ends it there (as a punched break closes at the checkout), and the server accepts that cut.
const cut = closeDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("07:00"), checkOut: iso("12:30"), onDate: D });
assert.equal(new Date(cut[0].end).toISOString(), new Date(iso("12:30")).toISOString());
assert.equal(twin.checkAssumedBreakGate({ shift: FLEX, breaks: [], start: "12:00", end: "12:30", onDate: D, checkOut: iso("12:30") }).ok, true);
assert.equal(twin.checkAssumedBreakGate({ shift: FLEX, breaks: [], start: "12:00", end: "12:30", onDate: D, checkOut: iso("16:00") }).error, "ASSUMED_BREAK_MINUTES");
console.log("PASS assumed break: nearest prayer (Dhuhr), else the middle, ≤ 5 h after check-in; begins at its start; a punch replaces it; stored on close");

/* ── no breach: an assumed break is a rest (Art. 101), the employee is only told ── */
assert.deepEqual(actualDutyBreaches({ checkIn: iso("07:00"), checkOut: iso("16:00"), shift: FLEX, onDate: D, breaks: [] }), [], "closed day: no ACTUAL_NO_BREAK");
assert.deepEqual(actualDutyBreaches({ checkIn: iso("07:00"), checkOut: iso("16:00"), shift: FLEX, onDate: D, breaks: [{ start: iso("12:00"), end: iso("13:00"), source: "assumed" }] }), [], "stored assumed: no breach");
assert.deepEqual(deriveDutyAlerts({ shift: FLEX, punches: { checkIn: iso("07:00"), checkOut: iso("16:00"), breaks: [{ start: iso("12:00"), end: iso("13:00"), source: "assumed" }] }, onDate: D, now: at("16:05") }).alerts, [], "nothing recorded on the day");
for (let m = at("07:00"); m <= at("16:00"); m += 5) {
  const day = deriveDutyAlerts({ shift: FLEX, punches: { checkIn: "07:00", breaks: [] }, onDate: D, now: m });
  assert.ok(!day.alerts.some((a) => a.breach), `no breach at ${m}`);
  assert.deepEqual(planDutyAlertNotices({ alerts: day.alerts, employee: { id: "e1", name: "عمر" }, managerId: "m1", shiftKey: "e1:2026-10-17:day", app: true }).filter((p) => p.userId === "m1"), [], "no manager notice");
}
const twinNoBreach = deriveActualDutyCore({ checkIn: iso("07:00"), checkOut: iso("16:00"), shift: FLEX, onDate: D, breaks: [] });
assert.deepEqual(twinNoBreach.flags, [], "server twin: no breach");
console.log("PASS no breach for an assumed break — client, live alerts, server twin; no manager notice");

/* ── the punch gate: window, the 30-minute minimum, split, remaining ── */
const pg = (action, now, breaks = [], shift = FLEX) => checkFlexBreakPunchGate({ action, shift, breaks, checkIn: iso("07:00"), now: iso(now), onDate: D });
assert.equal(pg("start", "10:30").error, "BREAK_WINDOW_NOT_OPEN");
assert.equal(pg("start", "10:30").reason, "تبدأ نافذة الراحة 11:00");
assert.equal(pg("start", "15:00").error, "BREAK_WINDOW_CLOSED");
assert.equal(pg("start", "11:20").ok, true);
assert.equal(pg("start", "11:20", [], FIXED).error, "NOT_FLEX_BREAK");
assert.equal(checkFlexBreakPunchGate({ action: "start", shift: FLEX, breaks: [], now: iso("11:20"), onDate: D }).error, "NOT_CHECKED_IN");
const open = [{ start: iso("11:20"), end: null, source: "punch" }];
assert.equal(pg("start", "11:30", open).error, "BREAK_ALREADY_OPEN");
const early = pg("end", "11:40", open);
assert.equal(early.ok, false);
assert.equal(early.error, "BREAK_BELOW_MIN");
assert.equal(early.reason, "أقل راحة نظامية 30 دقيقة (المادة 101)");
assert.equal(early.endsAtMin, at("11:50"));
const allowEarly = { ...FLEX, flexBreak: { ...FLEX.flexBreak, earlyEnd: true } };
const shortOk = pg("end", "11:40", open, allowEarly);
assert.equal(shortOk.ok, true, "the company allows an early end");
assert.equal(shortOk.short, true, "recorded short and flagged");
assert.equal(pg("end", "11:50", open).ok, true, "30 minutes — lawful");
const onePart = [{ start: iso("11:20"), end: iso("11:50"), source: "punch" }];
assert.equal(pg("start", "13:00", onePart).ok, true, "split: a second part");
assert.equal(pg("start", "13:00", onePart, NOSPLIT).error, "BREAK_ALREADY_TAKEN");
assert.equal(pg("start", "13:00", [{ start: iso("11:20"), end: iso("11:55") }]).error, "BREAK_REMAINDER_SHORT", "25 minutes left — under 30");
assert.equal(pg("start", "13:00", [{ start: iso("11:20"), end: iso("12:20") }]).error, "BREAK_DONE");
{
  // An overrun break says how long it really was — not «كاملة (60)».
  const over = pg("start", "13:30", [{ start: iso("11:30"), end: iso("12:45") }]);
  assert.equal(over.error, "BREAK_DONE");
  assert.match(over.reason, /أخذت 75 دقيقة راحة اليوم من 60 — الزيادة 15 دقيقة عودة متأخرة/);
}
const shortDay = duty([{ start: iso("11:20"), end: iso("11:40"), short: true }], allowEarly);
assert.equal(shortDay.shortBreaks, 1);
console.log("PASS punch gate: window reasons, 30-minute minimum (Art. 101), early end recorded short, split remainder");

/* ── over-long breaks become late return (not a legal breach) ── */
const longBreak = duty([{ start: iso("11:30"), end: iso("12:47") }]);
assert.equal(longBreak.lateReturnMinutes, 17);
assert.equal(longBreak.restMinutes, 77, "the actual break is what was not work");
assert.deepEqual(longBreak.flags, [], "late return is not an Art. 101 breach");
const longSplit = duty([{ start: iso("11:30"), end: iso("12:00") }, { start: iso("13:30"), end: iso("14:10") }]);
assert.equal(longSplit.lateReturnMinutes, 10, "split: the parts' sum against the minutes");
console.log("PASS over-long: 77 of 60 → 17 min late return, split 70 of 60 → 10, no breach");

/* ── live alerts ── */
const ids = (r) => r.alerts.map((a) => a.id);
const live = (now, breaks = [], extra = {}) => deriveDutyAlerts({ shift: FLEX, punches: { checkIn: "07:00", breaks }, onDate: D, now: at(now), ...extra });
assert.ok(!ids(live("11:29")).includes("rest_5h_soon"));
assert.ok(ids(live("11:30")).includes("rest_5h_soon"), "4h30 with no punched break — the window ahead does not hide it");
assert.equal(live("12:00").current.id, "flex_break_assumed_start", "none punched: the assumed break begins at the 5h mark");
assert.ok(!ids(live("12:00")).includes("rest_5h_breach"), "an assumed break is a rest — no breach");
assert.equal(live("12:00").current.textAr, "بدأت راحتك الآن (\u206612:00–13:00\u2069) — لم تبصم لها، فتُحتسب تلقائياً.");
assert.ok(ids(live("13:00")).includes("flex_break_ended"), "«انتهت راحتك» at its end");
assert.ok(!ids(live("17:00", [{ start: "11:00", end: "11:30" }], { shift: { ...FLEX, end: "18:00" } })).includes("flex_break_assumed_start"), "a punched part — nothing assumed");
assert.ok(!ids(live("12:00", [{ start: "11:50" }])).includes("rest_5h_breach"), "an open break holds the count");
assert.ok(!ids(live("13:00", [{ start: "11:30", end: "12:00" }])).some((id) => id.startsWith("rest_5h")), "a punched 30-minute rest resets the count");
assert.ok(ids(live("12:20", [{ start: "11:50" }])).includes("flex_break_running"));
const over = live("13:00", [{ start: "11:50" }]);
assert.ok(ids(over).includes("flex_break_over"));
assert.match(over.alerts.find((a) => a.id === "flex_break_over").textAr, /^راحتك تجاوزت مدتها/);
assert.equal(over.alerts.find((a) => a.id === "flex_break_over").breach, false, "late return is not a breach");
assert.ok(!ids(live("14:45")).includes("flex_window_closing"), "the break was assumed at 12:00 — no closing warning");
// A check-in too late for any assumed start: the window-closing warning still speaks.
const lateIn = (now) => deriveDutyAlerts({ shift: FLEX, punches: { checkIn: "14:10", breaks: [] }, onDate: D, now: at(now) });
const closing = lateIn("14:45");
assert.ok(ids(closing).includes("flex_window_closing"));
assert.match(closing.alerts.find((a) => a.id === "flex_window_closing").textAr, /^نافذة الراحة تنتهي بعد 15 دقيقة/);
assert.ok(!ids(lateIn("14:44")).includes("flex_window_closing"), "16 min before — not yet");
assert.ok(!ids(live("14:45", [{ start: "11:30", end: "12:30" }])).includes("flex_window_closing"), "a break was taken");
assert.ok(ids(live("15:05")).includes("flex_break_assumed"));
assert.ok(ids(live("12:30", [{ start: "11:30", end: "12:00" }])).includes("flex_remaining"));
assert.equal(live("12:30", [{ start: "11:30", end: "12:00" }]).alerts.find((a) => a.id === "flex_remaining").textAr, "باقٍ 30 دقيقة من راحتك — حتى 15:00.");
assert.ok(!ids(live("11:10")).some((id) => id.startsWith("break_")), "no fixed-break alerts on a flex shift");
const notices = planDutyAlertNotices({ alerts: closing.alerts, employee: { id: "e1", name: "عمر" }, shiftKey: "e1:2026-10-17:day" });
assert.ok(notices.some((row) => row.key.endsWith(":flex_window_closing")), "the worker is told once");
console.log("PASS alerts: 4h30 / 5h on the punches, over-long, window closing in 15 min, assumed, remaining");

/* ── continuous (Art. 103) unchanged; fixed unchanged ── */
const cont = deriveDutyAlerts({ shift: FLEX, punches: { checkIn: "07:00", breaks: [] }, onDate: D, now: at("13:00"), company: CONT });
assert.equal(cont.exempt, "art103");
assert.ok(!ids(cont).some((id) => id.startsWith("rest_5h") || id.startsWith("flex_")), "no stop, no 5h alerts, no break punches");
assert.equal(resolveDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("07:00"), now: iso("15:05"), onDate: D, company: CONT }).mode, "continuous");
assert.equal(checkFlexBreakPunchGate({ action: "start", shift: FLEX, breaks: [], checkIn: iso("07:00"), now: iso("11:30"), onDate: D, continuous103: true }).error, "NOT_FLEX_BREAK");
const contDuty = duty(undefined, FLEX, { company: CONT });
assert.deepEqual(contDuty.flags, [], "Art. 103: no five-hour breach");
assert.equal(contDuty.breakMode, "continuous");
const fixedAlerts = deriveDutyAlerts({ shift: FIXED, punches: { checkIn: "07:00" }, onDate: D, now: at("10:45") });
assert.ok(ids(fixedAlerts).includes("break_soon"), "fixed keeps the roster's break alerts");
assert.deepEqual(actualDutyBreaches({ checkIn: iso("07:00"), checkOut: iso("16:00"), shift: FIXED, onDate: D }), []);
console.log("PASS continuous (Art. 103) and fixed unchanged");

/* ── the attendance day carries the mode ── */
const data = {
  stations: [{ id: "st" }],
  schedules: [{ stationId: "st", shiftTypes: [FLEX], assignments: { [new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date())]: { day: ["e1"] } } }],
};
const today = getTodaysShift(data, { id: "e1", stationId: "st" });
assert.equal(today.breakMode, "flex");
assert.equal(today.flexBreak.minutes, 60);
const plain = getTodaysShift({ ...data, schedules: [{ ...data.schedules[0], shiftTypes: [{ ...FIXED }] }] }, { id: "e1", stationId: "st" });
assert.deepEqual(Object.keys(plain).sort(), ["dutyDate", "end", "label", "start", "stationId"], "fixed shifts keep their shape (the duty date travels with every shift)");
console.log("PASS today's shift carries breakMode / flexBreak");

/* ── the server twin agrees ── */
for (const patch of [{}, { flexBreak: { minutes: 20 } }, { flexBreak: { from: "12:30", to: "15:00" } }, { flexBreak: { from: "08:00", to: "10:30" } }, { end: "20:00" }]) {
  const shift = { ...FLEX, ...patch, flexBreak: { ...FLEX.flexBreak, ...(patch.flexBreak || {}) } };
  const a = checkShiftBreakModeGate({ shift, onDate: D });
  const b = twin.checkShiftBreakModeGate({ shift, onDate: D });
  assert.equal(b.ok, a.ok);
  assert.equal(b.error, a.error);
  assert.equal(b.reason, a.reason);
}
for (const [action, now, breaks] of [["start", "10:30", []], ["start", "11:20", []], ["end", "11:40", open], ["end", "11:55", open], ["start", "13:00", onePart]]) {
  const input = { action, shift: FLEX, breaks, checkIn: iso("07:00"), now: iso(now), onDate: D };
  assert.deepEqual([twin.checkFlexBreakPunchGate(input).ok, twin.checkFlexBreakPunchGate(input).error], [checkFlexBreakPunchGate(input).ok, checkFlexBreakPunchGate(input).error]);
}
const twinDay = twin.resolveFlexDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("07:00"), checkOut: iso("16:00"), onDate: D });
const clientDay = resolveFlexDayBreaks({ shift: FLEX, breaks: [], checkIn: iso("07:00"), checkOut: iso("16:00"), onDate: D });
assert.deepEqual(twinDay.forDuty, clientDay.forDuty);
assert.deepEqual(twinDay.forConsec, clientDay.forConsec, "the assumed break is a rest on both sides");
for (const [inAt, now, out] of [["07:00", "12:00", null], ["06:30", "11:40", null], ["07:00", "12:30", "12:30"], ["11:00", "14:30", "14:30"]]) {
  const input = { shift: FLEX, breaks: [], checkIn: iso(inAt), checkOut: out ? iso(out) : null, now: iso(now), onDate: D };
  const a = resolveFlexDayBreaks(input);
  const b = twin.resolveFlexDayBreaks(input);
  assert.deepEqual([b.planned?.start, b.assumed?.start, b.assumed?.end, b.assumedRunning], [a.planned?.start, a.assumed?.start, a.assumed?.end, a.assumedRunning]);
}
for (const breaks of [[{ start: iso("11:55"), end: iso("12:52") }], [{ start: iso("11:30"), end: iso("12:00") }, { start: iso("13:30"), end: iso("14:00") }], [], [{ start: iso("11:30"), end: iso("12:47") }]]) {
  const input = { checkIn: iso("07:00"), checkOut: iso("16:00"), shift: FLEX, onDate: D, breaks };
  const server = deriveActualDutyCore(input);
  const client = deriveActualDuty(input);
  assert.equal(server.workedMinutes, client.workedMinutes);
  assert.equal(server.restMinutes, client.restMinutes);
  assert.deepEqual(server.flags.map((f) => f.error), client.flags.map((f) => f.error));
  assert.equal(server.lateReturnMinutes, client.lateReturnMinutes);
}
assert.equal(twin.checkAssumedBreakGate({ shift: FLEX, breaks: [], start: "11:52", end: "12:52", onDate: D }).ok, true);
assert.equal(twin.checkAssumedBreakGate({ shift: FLEX, breaks: [], start: "10:30", end: "11:30", onDate: D }).error, "ASSUMED_BREAK_OUTSIDE");
assert.equal(twin.checkAssumedBreakGate({ shift: FLEX, breaks: [], start: "12:00", end: "12:30", onDate: D }).error, "ASSUMED_BREAK_MINUTES");
assert.equal(twin.checkAssumedBreakGate({ shift: FLEX, breaks: [{ start: iso("12:00"), end: iso("13:00") }], start: "12:00", end: "13:00", onDate: D }).error, "BREAK_PUNCHED");
console.log("PASS server twin: validation, punch gate, assumed placement and worked minutes match the client");
