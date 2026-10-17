/**
 * test-duty-ticker.mjs — the one app-level duty ticker (dutyTicker.js + the app profile of
 * planDutyAlertNotices): the break countdown and its end alert, the fixed break's start / end, the
 * 4h30 warning and the 5h rule repeated per five-hour block, the one-tap «بدأت راحتي», Art. 103,
 * and the dedupe per shift + alert id. Figures from laborRules, never typed.
 * Run: node scripts/test-duty-ticker.mjs
 */
import assert from "node:assert/strict";
import { breakClockOf, countdownLabel, dutyContextOf, nextDutyTickAt, planDutyTick } from "../src/lib/dutyTicker.js";
import { citeRule, ruleValue } from "../src/lib/laborRules.js";

const D = "2026-10-17";
const iso = (hm, s = "00") => `${D}T${hm}:${s}+03:00`;
const at = (hm, s = "00") => new Date(iso(hm, s)).getTime();
const USER = { id: "e1", name: "عمر", stationId: "st" };
const MGR = "m1";
const data = (extra = {}) => ({ employees: [USER, { id: MGR, name: "المدير" }], stations: [{ id: "st" }], schedules: [], notifications: [], ...extra });
const FLEX = { id: "day", label: "نهاري", start: "07:00", end: "16:00", stationId: "st", breakMode: "flex", flexBreak: { minutes: 60, from: "11:00", to: "15:00", split: true } };
const FIXED = { id: "morn", label: "صباحي", start: "07:00", end: "16:00", stationId: "st", restMinutes: 30 };
const NOREST = { id: "long", label: "طويل", start: "07:00", end: "19:00", stationId: "st", restMinutes: 0 };
const consec = ruleValue("hours.rest.maxConsecutiveHours", D);
const minRest = ruleValue("hours.rest.duringShiftMinutes", D);
const art = citeRule("hours.rest.maxConsecutiveHours", D).labelAr;

const tick = (shift, attendance, now, existingKeys = [], extra = {}) => planDutyTick({
  data: data(extra.data), user: USER, attendance, now, existingKeys, managerId: MGR, ar: true, shift,
});
const keysOf = (plans) => plans.map((p) => p.key);

/* ── «بدأت راحتي» → a live countdown; at its end «انتهت راحتك — عُد للعمل» once ── */
const flexAtt = { check_in_at: iso("07:00"), breaks: [{ start: iso("11:50", "20"), source: "punch" }] };
const running = tick(FLEX, flexAtt, at("12:30"));
assert.equal(running.clock.kind, "flex");
assert.equal(running.clock.start, "11:50");
assert.equal(running.clock.end, "12:50", "the break's minutes from its start minute");
assert.equal(countdownLabel(running.clock.remainingMs), "20:00");
assert.equal(countdownLabel(breakClockOf(running.ctx, at("12:37", "26")).remainingMs), "12:34", "«باقٍ 12:34»");
assert.ok(!running.plans.some((p) => p.key.includes("break_end")), "no end notice before the end");
const ended = tick(FLEX, flexAtt, at("12:50"));
const endPlan = ended.plans.find((p) => p.key.endsWith(":break_end:11:50"));
assert.ok(endPlan, "the end notice at the break's last minute");
assert.equal(endPlan.text, "انتهت راحتك — عُد للعمل.");
assert.equal(endPlan.userId, "e1");
assert.equal(ended.duty.current.id, "flex_break_ended");
assert.equal(ended.clock.remainingMs, 0);
assert.deepEqual(tick(FLEX, flexAtt, at("12:51"), keysOf(ended.plans)).plans.filter((p) => p.key.includes("break_end")), [], "once — the next minute sends nothing");
assert.deepEqual(tick(FLEX, flexAtt, at("13:05"), keysOf(ended.plans)).plans.filter((p) => p.key.includes("break_end")), [], "running over keeps the same key — not a second notice");
const missed = tick(FLEX, flexAtt, at("13:05"));
assert.ok(missed.plans.some((p) => p.key.endsWith(":break_end:11:50")), "a ticker that missed the minute still sends the end once");
const back = { ...flexAtt, breaks: [{ start: iso("11:50", "20"), end: iso("12:49"), source: "punch" }] };
assert.equal(tick(FLEX, back, at("12:55")).clock, null, "ended by «أنهيت راحتي» — no clock");
assert.equal(nextDutyTickAt(at("12:49", "30"), running.clock), at("12:50"), "the ticker wakes at the break's end");
assert.equal(nextDutyTickAt(at("12:30", "10"), running.clock), at("12:31"), "else the next minute boundary");
console.log("PASS countdown + «انتهت راحتك — عُد للعمل» once at the end");

/* ── a fixed break (no punch): «بدأت راحتك الآن (11:15–11:45)» and «انتهت راحتك», keyed to the roster ── */
const fixedAtt = { check_in_at: iso("07:00") };
const start = tick(FIXED, fixedAtt, at("11:15"));
const startPlan = start.plans.find((p) => p.key.endsWith(":break_now:11:15"));
assert.ok(startPlan);
assert.ok(startPlan.text.startsWith("بدأت راحتك الآن (⁦11:15–11:45⁩)"));
const atFive = tick({ ...FIXED, breaks: [{ start: "12:00", end: "13:00" }] }, fixedAtt, at("12:00"));
assert.ok(!atFive.plans.some((p) => p.key.includes("rest_5h_breach")), "a roster break starting at the 5h mark is the rest — no breach");
assert.ok(atFive.plans.some((p) => p.key.endsWith(":break_now:12:00")));
assert.equal(start.clock.kind, "fixed");
assert.equal(countdownLabel(breakClockOf(start.ctx, at("11:20")).remainingMs), "25:00");
assert.deepEqual(tick(FIXED, fixedAtt, at("11:16"), keysOf(start.plans)).plans.filter((p) => p.key.includes("break_now")), [], "the start once");
const over = tick(FIXED, fixedAtt, at("11:45"));
assert.equal(over.plans.find((p) => p.key.endsWith(":break_over:11:15"))?.text, "انتهت راحتك — عُد للعمل.");
assert.equal(over.clock, null, "the window passed — no pill");
assert.equal(tick(FIXED, { check_in_at: iso("07:00"), check_out_at: iso("10:00") }, at("11:20")).clock, null, "a closed day — no break clock");
assert.equal(tick(FIXED, fixedAtt, at("11:20"), [], { data: { hoursPolicy: { continuousWork103: true } } }).clock, null, "Art. 103 — none");
console.log("PASS fixed break start / end keyed to the roster time");

/* ── 4h30 warn, then the 5h rule (Art. 101) — repeated after each five-hour block without rest ── */
const longAtt = { check_in_at: iso("07:00"), breaks: [] };
const warn = tick(NOREST, longAtt, at("11:30"));
assert.ok(warn.plans.some((p) => p.key.includes(":rest_5h_soon:07:00")), "4h30 → the existing warn is sent");
const b1 = tick(NOREST, longAtt, at("12:00"));
const p1 = b1.plans.find((p) => p.userId === "e1" && p.key.includes(":rest_5h_breach:"));
assert.equal(p1.key, "duty-alert:e1:2026-10-17:long:rest_5h_breach:07:00:1");
assert.equal(p1.text, `أكملت ${consec} ساعات متواصلة — راحتك النظامية الآن (${art}): ${minRest} دقيقة على الأقل لا تُحسب من ساعات العمل.`);
assert.equal(p1.to, "/app/attendance", "a fixed shift: no break button to tap");
assert.ok(b1.plans.some((p) => p.userId === MGR), "the direct manager on the real breach");
const seen = [...keysOf(warn.plans), ...keysOf(b1.plans)];
assert.deepEqual(tick(NOREST, longAtt, at("13:00"), seen).plans, [], "the same block is not sent again");
const b2 = tick(NOREST, longAtt, at("17:00"), seen);
const p2 = b2.plans.find((p) => p.userId === "e1");
assert.equal(p2?.key, "duty-alert:e1:2026-10-17:long:rest_5h_breach:07:00:2", "the next five-hour block repeats");
assert.ok(p2.text.startsWith(`أكملت ${consec * 2} ساعات متواصلة`));
assert.ok(!b2.plans.some((p) => p.userId === MGR), "the manager once per shift");
// After a lawful rest the count restarts: a new stretch, a new key.
const rested = { check_in_at: iso("07:00"), breaks: [{ start: iso("12:00"), end: iso("12:30") }] };
assert.deepEqual(tick(NOREST, rested, at("13:00"), seen).plans, [], "rested — quiet");
assert.ok(tick(NOREST, rested, at("17:30"), seen).plans.some((p) => p.key.endsWith(":rest_5h_breach:12:30:1")), "five hours after the rest — a new series");
console.log("PASS 4h30 warn and the 5h rule per block (Art. 101)");

/* ── flex with minutes left: the 5h message carries the one-tap «بدأت راحتي» ── */
const flexNone = { check_in_at: iso("07:00"), breaks: [] };
const fx = tick(FLEX, flexNone, at("12:00"));
const fxPlan = fx.plans.find((p) => p.userId === "e1" && p.key.includes("rest_5h_breach"));
assert.equal(fxPlan.to, "/app/attendance?focus=break");
assert.equal(fxPlan.action, "break_start");
const fxClosed = tick(FLEX, flexNone, at("15:30"));
const late = fxClosed.plans.find((p) => p.userId === "e1" && p.key.includes("rest_5h_breach"));
assert.equal(late?.to, "/app/attendance", "the window closed — no tap offered");
const cont = tick(FLEX, flexNone, at("12:00"), [], { data: { hoursPolicy: { continuousWork103: true } } });
assert.ok(!cont.plans.some((p) => /rest_5h|break_/.test(p.key)), "Art. 103 disables all of it");
console.log("PASS flex: the 5h message links to «بدأت راحتي» (focus=break); Art. 103 silent");

/* ── the ticker: idempotent per shift + alert id, a new shift sends again ── */
const first = tick(FIXED, fixedAtt, at("11:00"));
assert.ok(first.plans.some((p) => p.key.endsWith(":break_soon")));
const keys = keysOf(first.plans);
assert.equal(new Set(keys).size, keys.length, "no key twice in one tick");
assert.deepEqual(tick(FIXED, fixedAtt, at("11:00"), keys).plans, [], "two ticks in one minute (or two tabs) — nothing twice");
const fromBell = planDutyTick({ data: data({ notifications: first.plans.map((p) => ({ key: p.key, userId: p.userId })) }), user: USER, attendance: fixedAtt, now: at("11:01"), managerId: MGR, shift: FIXED });
assert.deepEqual(fromBell.plans, [], "the bell's own keys are the dedupe");
const ctxNext = dutyContextOf({ data: data(), user: USER, attendance: { check_in_at: "2026-10-18T07:00:00+03:00" }, now: new Date("2026-10-18T11:00:00+03:00"), shift: FIXED });
assert.notEqual(ctxNext.shiftKey, first.ctx.shiftKey, "a new shift — a new key space");
assert.equal(tick(FIXED, {}, at("11:00")).plans.length, 0, "before check-in — nothing");
console.log("PASS ticker dedupe per shift + alert id");

console.log("ALL PASS test-duty-ticker");
