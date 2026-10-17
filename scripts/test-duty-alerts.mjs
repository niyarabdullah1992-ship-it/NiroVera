/**
 * test-duty-alerts.mjs — the employee's live duty alerts (dutyAlerts.js), the roster's prayer break
 * hint (shiftWeek.prayerBreakHint) and the breach a closed day records (otDecisionPlan).
 * Each alert at its threshold; Art. 103 exemption; 3337 only in season and only on exposed work;
 * Ramadan only for a worker recorded as Muslim; notices once per shift + alert id.
 * Run: node scripts/test-duty-alerts.mjs
 */
import assert from "node:assert/strict";
import { deriveDutyAlerts, dutyShiftKey, minutesAr, planDutyAlertNotices } from "../src/lib/dutyAlerts.js";
import { prayerBreakHint, prayersInShift, rosterBreakWindows } from "../src/lib/shiftWeek.js";
import { stationPrayerTimes } from "../src/lib/prayerTimes.js";
import { stampActualDutyBreaches } from "../src/lib/otDecisionPlan.js";
import { actualDutyBreaches } from "../src/lib/actualDuty.js";
import { ruleValue } from "../src/lib/laborRules.js";

const at = (hm) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};
const SHIFT = { id: "morn", label: "صباحي", start: "07:00", end: "16:00", restMinutes: 30 };
const DAY = "2026-10-17"; // out of heat season, not Ramadan
const SUMMER = "2026-07-01";
const RAMADAN = "2026-03-01";
const MUSLIM = { id: "e1", name: "عمر", profile: { religion: "مسلم" } };
const NON_MUSLIM = { id: "e1", name: "عمر", profile: { religion: "غير مسلم" } };
const NO_RELIGION = { id: "e1", name: "عمر", profile: {} };
const KHAFJI = { id: "st", name: "فرع الخفجي", countryCode: "SA", city: "الخفجي", cityRegion: "eastern" };
const ids = (r) => r.alerts.map((a) => a.id);
const run = (now, extra = {}) => deriveDutyAlerts({ shift: SHIFT, punches: { checkIn: "07:00" }, onDate: DAY, employee: NO_RELIGION, now: at(now), ...extra });

/* the roster's break: centered in the shift, the statutory minimum when none is set */
const [win] = rosterBreakWindows(SHIFT, DAY);
assert.deepEqual([win.start, win.end, win.minutes], ["11:15", "11:45", 30]);
assert.deepEqual(rosterBreakWindows({ start: "07:00", end: "11:00" }, DAY), [], "≤ 5h — no break placed");
assert.equal(rosterBreakWindows({ start: "07:00", end: "16:00", breaks: [{ start: "12:00", end: "12:45" }] }, DAY)[0].start, "12:00", "placed break wins");

/* break_soon / break_now / break_over — at their thresholds */
assert.ok(!ids(run("10:59")).includes("break_soon"), "16 min before — not yet");
const soon = run("11:00");
assert.ok(ids(soon).includes("break_soon"), "15 min before — due");
assert.equal(soon.alerts.find((a) => a.id === "break_soon").textAr, "راحتك بعد 15 دقيقة — \u206611:15–11:45\u2069، لا تُحسب من ساعات العمل.");
assert.equal(soon.alerts.find((a) => a.id === "break_soon").level, "info");
assert.ok(ids(run("11:15")).includes("break_now"));
assert.ok(ids(run("11:45")).includes("break_over"), "break should have ended");
assert.ok(!ids(run("12:00")).includes("break_over"), "the ended line fades after the lead");
assert.equal(minutesAr(10), "10 دقائق");
console.log("PASS break due ≤ 15 min / started / should have ended");

/* rest_5h_soon at 4h30, rest_5h_breach at 5h — Art. 101, figures from laborRules */
const max = ruleValue("hours.rest.maxConsecutiveHours", DAY) * 60;
assert.equal(max, 300);
const early = { punches: { checkIn: "06:00" } }; // early check-in: the 11:15 break sits past the limit
assert.ok(!ids(run("10:29", early)).includes("rest_5h_soon"), "4h29 — quiet");
const warn = run("10:30", early);
assert.ok(ids(warn).includes("rest_5h_soon"), "4h30 since the last rest → warn");
assert.equal(warn.alerts.find((a) => a.id === "rest_5h_soon").breach, false, "a warning is not a breach");
const breach = run("11:00", early);
assert.equal(breach.current.id, "rest_5h_breach", "≥ 5h with no rest → breach, shown first");
assert.equal(breach.current.breach, true);
assert.equal(breach.current.level, "warn");
assert.equal(breach.current.cite.article, "101");
assert.ok(!ids(run("10:30")).includes("rest_5h_soon"), "the roster's break ahead within the limit — no warning");
assert.ok(!ids(run("12:30")).includes("rest_5h_breach"), "after the break the clock restarts");
const recordedNone = run("12:01", { punches: { checkIn: "07:00", breaks: [] } });
assert.ok(ids(recordedNone).includes("rest_5h_breach"), "recorded breaks, none taken → breach after 5h");
const noRest = { start: "07:00", end: "16:00", restMinutes: 0 };
assert.ok(ids(run("12:00", { shift: noRest })).includes("rest_5h_breach"), "a shift with no rest → breach at 5h");
console.log("PASS 4h30 warning / 5h breach (Art. 101)");

/* Art. 103 continuous work and an Art. 108 category outside 101 — exempt from break and 5h alerts */
const cont = run("11:00", { ...early, company: { hoursPolicy: { continuousWork103: true } } });
assert.equal(cont.exempt, "art103");
assert.ok(!ids(cont).some((id) => id.startsWith("break_") || id.startsWith("rest_5h")), "Art. 103: no break / 5h alert");
assert.equal(prayerBreakHint({ shift: SHIFT, onDate: DAY, prayers: stationPrayerTimes(KHAFJI, DAY), company: { hoursPolicy: { continuousWork103: true } } }), null, "Art. 103: no break hint");
console.log("PASS Art. 103 exemption");

/* presence: approaching then over the 12h ceiling (Art. 101) */
const stay = ruleValue("hours.workplace.maxHours", DAY) * 60;
const long = { shift: { id: "long", start: "06:00", end: "18:00", breaks: [{ start: "10:00", end: "10:30" }, { start: "14:00", end: "14:30" }] }, punches: { checkIn: "06:00" } };
assert.ok(!ids(run("17:29", long)).includes("presence_soon"));
assert.ok(ids(run("17:30", long)).includes("presence_soon"), "30 min before the ceiling");
assert.ok(!ids(run("18:00", long)).includes("presence_breach"), "exactly 12h is not over");
const over = run("18:01", long);
assert.equal(over.current.id, "presence_breach");
assert.equal(over.current.at, `${String(Math.floor((360 + stay) / 60)).padStart(2, "0")}:00`);
console.log("PASS 12h presence (Art. 101)");

/* 3337 — the 12:00–15:00 window only in season and only on exposed work */
const sun = (now, extra) => run(now, { shift: SHIFT, onDate: SUMMER, ...extra });
assert.ok(ids(sun("11:30", { exposed: true })).includes("heat_soon"), "30 min before the window");
const heat = sun("12:00", { exposed: true });
assert.ok(ids(heat).includes("heat_now"));
assert.equal(heat.alerts.find((a) => a.id === "heat_now").breach, true);
assert.ok(!ids(sun("12:00", { exposed: false })).some((id) => id.startsWith("heat")), "shaded / unmarked work — none");
assert.ok(!ids(run("12:00", { exposed: true })).some((id) => id.startsWith("heat")), "out of season — none");
assert.ok(!ids(sun("15:00", { exposed: true })).includes("heat_now"), "15:00 is free");
console.log("PASS heat window — in season, exposed only (3337)");

/* Ramadan — recorded Muslim only (Art. 98) */
const ram = (employee, now = "10:00") => run(now, { onDate: RAMADAN, employee, ramadan: true });
assert.ok(ids(ram(MUSLIM)).includes("ramadan_hours"));
assert.ok(!ids(ram(NON_MUSLIM)).some((id) => id.startsWith("ramadan")), "recorded non-Muslim — none");
assert.ok(!ids(ram(NO_RELIGION)).some((id) => id.startsWith("ramadan")), "religion not recorded — none");
assert.ok(ids(ram(MUSLIM, "13:30")).includes("ramadan_over"), "6h worked (+ the break) → over");
assert.ok(!ids(ram(MUSLIM, "13:29")).includes("ramadan_over"));
assert.ok(ids(run("10:00", { onDate: RAMADAN, employee: MUSLIM, ramadan: true, weekWorkedMinutes: 34 * 60 })).includes("ramadan_over"), "36h week");
console.log("PASS Ramadan hours — Muslim recorded only (Art. 98)");

/* the next prayer in the shift — info */
const prayers = stationPrayerTimes(KHAFJI, DAY);
const points = prayersInShift(SHIFT, prayers);
assert.deepEqual(points.map((p) => p.key), ["dhuhr", "asr"], "07:00–16:00 holds Dhuhr and Asr");
const pr = run("09:00", { prayers });
const next = pr.alerts.find((a) => a.id === "prayer_next");
assert.equal(next.level, "info");
assert.equal(next.at, prayers.times.dhuhr);
assert.equal(run("09:00").alerts.find((a) => a.id === "prayer_next"), undefined, "no prayer times → none");
console.log("PASS next prayer (info)");

/* before check-in nothing; a closed day returns what it proves, marked recorded */
assert.deepEqual(deriveDutyAlerts({ shift: SHIFT, punches: {}, onDate: DAY, now: at("09:00") }).alerts, []);
const closed = deriveDutyAlerts({ shift: SHIFT, punches: { checkIn: "06:00", checkOut: "16:00" }, onDate: DAY, now: at("16:30") });
assert.deepEqual(closed.alerts.map((a) => [a.id, a.recorded]), [["rest_5h_breach", true]], "early in, break at 11:15 → 5h15 proven");
assert.deepEqual(actualDutyBreaches({ checkIn: "07:00", checkOut: "16:00", shift: SHIFT, onDate: DAY }), [], "on time — the roster's break keeps it lawful");
console.log("PASS open / closed day");

/* notices: once per shift + alert id; the manager only on a real breach */
const key = dutyShiftKey("e1", DAY, SHIFT);
assert.equal(key, "e1:2026-10-17:morn");
const plans = planDutyAlertNotices({ alerts: breach.alerts, employee: MUSLIM, managerId: "m1", shiftKey: key });
assert.deepEqual(plans.map((p) => [p.userId, p.key]), [
  ["e1", "duty-alert:e1:2026-10-17:morn:rest_5h_breach"],
  ["m1", "duty-alert-mgr:m1:e1:2026-10-17:morn:rest_5h_breach"],
  ["e1", "duty-alert:e1:2026-10-17:morn:break_soon"],
]);
assert.equal(plans[0].text, "تجاوزت 5 ساعات بلا راحة — لك راحة الآن (المادة 101).");
assert.ok(plans[2].text.startsWith("راحتك بعد 15 دقيقة"));
assert.deepEqual(planDutyAlertNotices({ alerts: breach.alerts, employee: MUSLIM, managerId: "m1", shiftKey: key, existingKeys: plans.map((p) => p.key) }), [], "dedupe — a second minute sends nothing");
const nextShift = planDutyAlertNotices({ alerts: breach.alerts, employee: MUSLIM, managerId: "m1", shiftKey: dutyShiftKey("e1", "2026-10-18", SHIFT), existingKeys: plans.map((p) => p.key) });
assert.equal(nextShift.length, 3, "a new shift notifies again");
const heatPlans = planDutyAlertNotices({ alerts: heat.alerts, employee: MUSLIM, managerId: "m1", shiftKey: key });
assert.deepEqual(heatPlans.map((p) => p.userId), ["e1"], "heat window: the worker only");
assert.ok(heatPlans[0].text.startsWith("نافذة حظر العمل المكشوف بدأت"));
assert.deepEqual(planDutyAlertNotices({ alerts: heat.alerts, employee: MUSLIM, shiftKey: key, existingKeys: ["3337-worker:e1:2026-10-17"] }), [], "the 3337 worker notice already sent today — not twice");
assert.deepEqual(planDutyAlertNotices({ alerts: warn.alerts, employee: MUSLIM, managerId: "m1", shiftKey: key }), [], "a warning before the limit is not pushed");
assert.equal(planDutyAlertNotices({ alerts: over.alerts, employee: MUSLIM, managerId: "m1", shiftKey: key }).filter((p) => p.userId === "m1").length, 1, "12h breach → the manager once");
assert.deepEqual(planDutyAlertNotices({ alerts: breach.alerts, employee: MUSLIM, managerId: "e1", shiftKey: key }).map((p) => p.userId), ["e1", "e1"], "never the worker as his own manager");
assert.deepEqual(planDutyAlertNotices({ alerts: closed.alerts, employee: MUSLIM, managerId: "m1", shiftKey: key }), [], "recorded (after the fact) rows are not pushed live");
console.log("PASS notices — once per shift + alert id, manager on a real breach");

/* the roster's prayer hint — non-binding, Art. 101 kept */
const EARLY = { id: "e", start: "07:30", end: "16:30", restMinutes: 30 }; // break 11:45–12:15, Dhuhr just before
const hint = prayerBreakHint({ shift: EARLY, onDate: DAY, prayers });
assert.equal(hint.prayerKey, "dhuhr");
assert.equal(hint.textAr, `أقرب صلاة: الظهر ${prayers.times.dhuhr} — يمكن أن تكون الراحة حولها.`);
assert.equal(hint.binding, false);
assert.equal(hint.suggested.start, prayers.times.dhuhr, "suggested from the adhan, for the break's length");
const covering = prayerBreakHint({ shift: SHIFT, onDate: DAY, prayers });
assert.equal(covering.inside, true, "the 11:15–11:45 break already holds Dhuhr");
assert.equal(covering.textAr, `أقرب صلاة: الظهر ${prayers.times.dhuhr} — الراحة \u206611:15–11:45\u2069 تشملها.`);
assert.ok(prayerBreakHint({ shift: EARLY, onDate: DAY, prayers, published: true }).textAr.endsWith("لا تُنقل الراحة المنشورة تلقائياً."), "published: says the break does not move");
assert.equal(prayerBreakHint({ shift: { start: "07:00", end: "11:00" }, onDate: DAY, prayers }), null, "no break placed — no hint");
const tight = { id: "t", start: "06:00", end: "17:30", restMinutes: 30 }; // a break at Dhuhr leaves > 5h after it
assert.equal(prayerBreakHint({ shift: tight, onDate: DAY, prayers: { ...prayers, minutes: { ...prayers.minutes, dhuhr: at("09:00"), asr: at("09:30") }, times: { ...prayers.times, dhuhr: "09:00", asr: "09:30" } } }), null, "a break at the prayer that breaks Art. 101 is not offered");
assert.equal(prayerBreakHint({ shift: { id: "x", start: "06:00", end: "15:00", restMinutes: 30 }, onDate: DAY, prayers }), null, "06:00–15:00: a break at Dhuhr leaves 5h31 before it — not offered");
console.log("PASS prayer break hint (non-binding, Art. 101)");

/* recording: a proven breach lands on the attendance row's actualFlags */
const d = {
  employees: [{ id: "e1", stationId: "st" }],
  schedules: [{ stationId: "st", shiftTypes: [SHIFT], assignments: { [DAY]: { morn: ["e1"] } } }],
  personalAttendance: [],
};
const row = { employeeId: "e1", date: DAY, checkInAt: "06:00", checkOutAt: "16:00" };
assert.deepEqual(stampActualDutyBreaches(d, d.employees[0], DAY, row), ["ACTUAL_NO_BREAK"]);
assert.deepEqual(row.actualFlags, ["ACTUAL_NO_BREAK"]);
assert.deepEqual(stampActualDutyBreaches(d, d.employees[0], DAY, row), [], "idempotent");
const okRow = { employeeId: "e1", date: DAY, checkInAt: "07:00", checkOutAt: "16:00" };
assert.deepEqual(stampActualDutyBreaches(d, d.employees[0], DAY, okRow), []);
assert.deepEqual(okRow.actualFlags, []);
assert.deepEqual(stampActualDutyBreaches(d, d.employees[0], DAY, { employeeId: "e1", date: DAY, checkInAt: "06:00" }), [], "open day — nothing");
console.log("PASS breach recorded on the attendance row");
console.log("ALL PASS test-duty-alerts");
