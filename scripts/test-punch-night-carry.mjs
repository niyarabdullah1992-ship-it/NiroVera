/**
 * test-punch-night-carry.mjs — «بصمتي» on the Riyadh clock around an overnight shift:
 *  1. a night shift not punched by 00:40 is still the duty day (until its end + the late check-in grace):
 *     the check-in is a late one, dated on the shift's own day, with its late minutes; the server twin agrees;
 *  2. after the night checkout the card keeps the closed night (not the next day's «لا وردية»), and a
 *     day with no shift and no punch is a rest day — no broken link in «سلسلة البصمة»;
 *  3. a late return from a flex break surfaces in «تنبيهاتي» as a warn (the queue's reading), not a breach;
 *  4. the gates read the Riyadh clock (dutyClockMinutes), never the device's — even in another time zone;
 *  5. lateness uses the rule's grace: max(0, in − start − grace), as deriveActualDuty does.
 * Run: node scripts/test-punch-night-carry.mjs
 */
process.env.TZ = "Europe/London"; // a device far from Riyadh: every reading below must still be Riyadh's
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register(`data:text/javascript,${encodeURIComponent(`
const SRC = ${JSON.stringify(new URL("../src/", import.meta.url).href)};
const ESBUILD = ${JSON.stringify(new URL("../node_modules/esbuild/lib/main.js", import.meta.url).href)};
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) {
    const { existsSync } = await import("node:fs");
    let url = SRC + spec.slice(2);
    if (!/\\.[cm]?jsx?$/.test(url)) url += existsSync(new URL(url + ".js")) ? ".js" : ".jsx";
    return next(url, ctx);
  }
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url.endsWith(".jsx")) {
    const { readFileSync } = await import("node:fs");
    const { transformSync } = (await import(ESBUILD)).default;
    const source = readFileSync(new URL(url), "utf8");
    const out = transformSync(source, { loader: "jsx", format: "esm", jsx: "automatic" });
    return { format: "module", source: out.code, shortCircuit: true };
  }
  return next(url, ctx);
}`)}`);

const {
  checkEarlyCheckInGate,
  checkLateCheckInGate,
  dutyClockMinutes,
  dutyDayOf,
  lateMinutesFromScheduledStart,
  overnightCarryOpen,
  selfCheckInDay,
  todaysShiftEnded,
} = await import("../src/lib/attendanceDerivations.js");
const twin = await import("../base44/shared/attendanceDerivations.ts");
const { ruleValue } = await import("../src/lib/laborRules.js");
const { lateReturnAlertOf, dutyAlertRailCard } = await import("../src/lib/dutyAlerts.js");
const { isLateReturnOpen } = await import("../src/lib/attendanceQueue.js");

const GRACE = ruleValue("hours.grace.minutes");
const at = (day, hm) => new Date(`${day}T${hm}:00+03:00`);
const NIGHT = { id: "n", start: "23:00", end: "07:00", label: "ليلي" };
const DAY = { id: "d", start: "07:00", end: "16:00", label: "نهاري" };
const FLEX = { id: "f", start: "07:00", end: "16:00", label: "مرن", breakMode: "flex", flexBreak: { minutes: 60, from: "11:00", to: "14:00", minPart: 30 }, restMinutes: 60 };
const emp = { id: "e", name: "عمر", stationId: "st" };
const data = (assign, rows = []) => ({
  stations: [{ id: "st" }],
  employees: [emp],
  schedules: [{ stationId: "st", shiftTypes: [NIGHT, DAY, FLEX], assignments: assign }],
  personalAttendance: rows,
});
const D1 = "2026-10-18";
const D2 = "2026-10-19";

/* ── 1. a night shift not punched after midnight is still the duty day ── */
{
  // Night on D1 only; D2 is a rest day.
  const d = data({ [D1]: { n: ["e"] } });
  const late = dutyDayOf(d, emp, at(D2, "00:40"));
  assert.equal(late.dateKey, D1, "00:40 without a punch: last night's shift is still the duty day");
  assert.equal(late.shift?.start, "23:00");
  assert.equal(late.pending, true);
  // Up to its end + the late check-in grace (the same hour the card's late gate allows), then the day turns.
  assert.equal(dutyDayOf(d, emp, at(D2, "07:59")).dateKey, D1);
  assert.equal(dutyDayOf(d, emp, at(D2, "08:01")).dateKey, D2, "past 07:00 + grace the night is gone");
  assert.equal(dutyDayOf(d, emp, at(D2, "08:01")).shift, null);

  // The check-in lands on the shift's own date, as a late check-in with its minutes.
  const ci = selfCheckInDay(d, emp, at(D2, "00:40"));
  assert.equal(ci.dateKey, D1, "a late check-in is recorded on the shift's own date");
  assert.equal(ci.nowMin, 24 * 60 + 40, "on the duty day's clock");
  assert.equal(checkEarlyCheckInGate(ci.shift, ci.nowMin, 60).ok, true, "not «too early» for last night's shift");
  assert.equal(checkLateCheckInGate(ci.shift, ci.nowMin).ok, true);
  const lateness = lateMinutesFromScheduledStart(ci.nowMin, ci.shift.start, GRACE);
  assert.deepEqual(lateness, { lateMinutes: 100 - GRACE, status: "late" }, "00:40 on 23:00 = 100 min past the start, less the grace");
  // At the end of the grace the self check-in closes (the manual request instead).
  assert.equal(checkLateCheckInGate(NIGHT, dutyClockMinutes(D1, at(D2, "08:05"))).ok, false);
  assert.equal(todaysShiftEnded(NIGHT, dutyClockMinutes(D1, at(D2, "07:30"))), false);
  assert.equal(todaysShiftEnded(NIGHT, 23 * 60 + 30), false, "never ended on its own start day");
  assert.equal(twin.checkLateCheckInGate(NIGHT, dutyClockMinutes(D1, at(D2, "08:05"))).ok, false, "server twin closes it too");
  assert.equal(twin.checkLateCheckInGate(NIGHT, dutyClockMinutes(D1, at(D2, "07:30"))).ok, true);
  assert.deepEqual(twin.lateMinutesFromScheduledStart(ci.nowMin, "23:00", GRACE), lateness, "server twin reads the same lateness");

  // Tonight's own night shift too: at 00:40 it is last night's still (tonight's window opens at 22:00).
  const both = data({ [D1]: { n: ["e"] }, [D2]: { n: ["e"] } });
  assert.equal(dutyDayOf(both, emp, at(D2, "00:40")).dateKey, D1, "not tomorrow night's shift");
  assert.equal(dutyDayOf(both, emp, at(D2, "12:00")).dateKey, D2);
  // A day shift today takes over once its own window opens (07:00 − 60).
  const thenDay = data({ [D1]: { n: ["e"] }, [D2]: { d: ["e"] } });
  assert.equal(dutyDayOf(thenDay, emp, at(D2, "05:30")).dateKey, D1);
  assert.equal(dutyDayOf(thenDay, emp, at(D2, "06:05")).dateKey, D2);

  // Once punched the carried row is open (the existing carry), and a closed row never carries as pending.
  const opened = data({ [D1]: { n: ["e"] } }, [{ employeeId: "e", date: D1, checkInAt: at(D2, "00:40").toISOString(), checkOutAt: null }]);
  assert.equal(dutyDayOf(opened, emp, at(D2, "03:00")).dateKey, D1);
  assert.equal(dutyDayOf(opened, emp, at(D2, "03:00")).pending, false);
  assert.equal(selfCheckInDay(opened, emp, at(D2, "03:00")).dateKey, D2, "an open carried day is awaiting its checkout, not a check-in");

  // The server twin decides the same, row or no row.
  const base = { yesterdayShift: NIGHT, todayShift: null, earlyWindowMin: 60 };
  for (const nowMin of [40, 300, 470, 481, 600]) {
    for (const yesterdayRow of [null, { check_in_at: at(D1, "23:00").toISOString(), check_out_at: null }, { check_in_at: at(D1, "23:00").toISOString(), check_out_at: at(D2, "07:00").toISOString() }]) {
      assert.equal(twin.overnightCarryOpen({ ...base, yesterdayRow, nowMin }), overnightCarryOpen({ ...base, yesterdayRow, nowMin }), `twin agrees at ${nowMin}`);
    }
  }
  assert.equal(twin.overnightCarryOpen({ ...base, yesterdayRow: null, nowMin: 40 }), true);
  assert.equal(twin.overnightCarryOpen({ ...base, yesterdayRow: null, nowMin: 481 }), false);
}

/* ── 2. after the night checkout: the closed night, then a calm rest day ── */
{
  const closed = { employeeId: "e", date: D1, checkInAt: at(D1, "23:00").toISOString(), checkOutAt: at(D2, "07:05").toISOString() };
  const d = data({ [D1]: { n: ["e"] } }, [closed]);
  const card = dutyDayOf(d, emp, at(D2, "07:06"), null, { includeClosed: true });
  assert.equal(card.dateKey, D1, "07:06: the card shows the closed night, not the next day's «لا وردية»");
  assert.equal(card.closed, true);
  assert.equal(card.shift?.end, "07:00");
  assert.equal(dutyDayOf(d, emp, at(D2, "07:06")).dateKey, D2, "the other readers (queue, ticker) keep today's day");
  assert.equal(dutyDayOf(d, emp, at(D2, "08:10"), null, { includeClosed: true }).dateKey, D2, "after the grace, today");

  const { buildAttendanceRings, brokeAtLabel, punchChainFromAttendance } = await import("../src/components/attendance/AttendanceTrustChrome.jsx");
  const rest = buildAttendanceRings({ ar: true, ...punchChainFromAttendance(null, { scheduled: false, onLeave: false }) });
  assert.ok(rest.every((ring) => ring.state === "rest"), "a day with no shift and no punch is a rest day");
  assert.ok(!rest.some((ring) => ring.state === "bad"), "no link is broken on a rest day");
  assert.equal(brokeAtLabel(true, rest), "");
  // The closed night: every link met.
  const met = buildAttendanceRings({ ar: true, ...punchChainFromAttendance({ check_in_at: closed.checkInAt, check_out_at: closed.checkOutAt, location_status: "inside" }, { scheduled: true }) });
  assert.ok(met.every((ring) => ring.state === "ok"));
  // A scheduled day not punched yet is waiting, not broken.
  const waiting = buildAttendanceRings({ ar: true, ...punchChainFromAttendance(null, { scheduled: true }) });
  assert.ok(!waiting.some((ring) => ring.state === "bad"));
}

/* ── 3. late return from a flex break → «تنبيهاتي» (warn, not a breach) ── */
{
  const d = data({ [D1]: { f: ["e"] } });
  const iso = (hm) => at(D1, hm).toISOString();
  const row = { employee_id: "e", date: D1, check_in_at: iso("07:00"), check_out_at: null, breaks: [{ start: iso("11:00"), end: iso("12:20"), source: "punch" }] };
  const now = at(D1, "12:30");
  assert.equal(isLateReturnOpen(emp, row, d, now), true, "the queue reads a late return");
  const alertRow = lateReturnAlertOf({ employee: emp, row, data: d, now });
  assert.ok(alertRow, "the same reading surfaces for the employee");
  assert.equal(alertRow.id, "flex_late_return");
  assert.equal(alertRow.level, "warn");
  assert.equal(alertRow.breach, false, "a late return, not a legal breach");
  assert.equal(alertRow.meta.overMinutes, 20);
  assert.equal(alertRow.meta.allowedMinutes, 60);
  assert.equal(alertRow.meta.takenMinutes, 80);
  assert.match(alertRow.textAr, /متأخراً 20 دقيقة/);
  assert.match(alertRow.textAr, /80 دقيقة من 60 دقيقة/);
  const rail = dutyAlertRailCard(alertRow, { employee: emp, ar: true });
  assert.equal(rail.level, "warn");
  assert.equal(rail.audience, "employee");
  assert.equal(rail.onDate, D1, "«افتح اليوم» opens the day it is about");
  assert.match(rail.body, /ليست مخالفة نظامية/);
  // Reviewed by the manager → no longer due; within its minutes → none.
  const reviewed = { ...row, breaks: [{ ...row.breaks[0], review: { decision: "accept" } }] };
  assert.equal(lateReturnAlertOf({ employee: emp, row: reviewed, data: d, now }), null);
  const onTime = { ...row, breaks: [{ start: iso("11:00"), end: iso("11:55"), source: "punch" }] };
  assert.equal(lateReturnAlertOf({ employee: emp, row: onTime, data: d, now }), null);
  assert.equal(lateReturnAlertOf({ employee: emp, row: null, data: d, now }), null);
}

/* ── 4. the gates read the Riyadh clock, not the device's (this process runs on London time) ── */
{
  assert.equal(dutyClockMinutes(D1, at(D1, "21:59")), 21 * 60 + 59);
  assert.equal(dutyClockMinutes(D1, at(D2, "00:40")), 24 * 60 + 40);
  assert.notEqual(at(D1, "21:59").getHours() * 60 + at(D1, "21:59").getMinutes(), 21 * 60 + 59, "the device clock differs here");
  // 22:00 opens the 23:00 shift (60-min window) — on Riyadh's 21:59 it is still closed.
  assert.equal(checkEarlyCheckInGate(NIGHT, dutyClockMinutes(D1, at(D1, "21:59")), 60).ok, false);
  assert.equal(checkEarlyCheckInGate(NIGHT, dutyClockMinutes(D1, at(D1, "22:01")), 60).ok, true);
  // A late check-in after midnight, checked out at 07:05: not early, and not forgotten at 07:30 —
  // read on the shift's Riyadh clock (this process runs on London time).
  const { earlyLeaveMinutesOf, isForgottenCheckout, checkSelfCheckoutGate } = await import("../src/lib/attendanceDerivations.js");
  const lateIn = at(D2, "00:40").toISOString();
  assert.equal(earlyLeaveMinutesOf({ shift: NIGHT, checkIn: lateIn, checkOut: at(D2, "07:05").toISOString() }), 0, "not «انصراف مبكر 1435 د»");
  assert.equal(earlyLeaveMinutesOf({ shift: NIGHT, checkIn: lateIn, checkOut: at(D2, "06:00").toISOString() }), 60);
  assert.equal(earlyLeaveMinutesOf({ shift: NIGHT, checkIn: at(D1, "22:55").toISOString(), checkOut: at(D2, "06:30").toISOString() }), 30);
  assert.equal(isForgottenCheckout(NIGHT, { check_in_at: lateIn }, at(D2, "07:30").getTime()), false);
  assert.equal(isForgottenCheckout(NIGHT, { check_in_at: lateIn }, at(D2, "08:05").getTime()), true);
  assert.equal(isForgottenCheckout(DAY, { check_in_at: at(D1, "07:00").toISOString() }, at(D1, "16:30").getTime()), false);
  assert.equal(isForgottenCheckout(DAY, { check_in_at: at(D1, "07:00").toISOString() }, at(D1, "17:01").getTime()), true);
  assert.deepEqual(checkSelfCheckoutGate({ shift: NIGHT, attendance: { check_in_at: lateIn }, now: at(D2, "07:05") }), { ok: true, confirm: null });
  assert.deepEqual(checkSelfCheckoutGate({ shift: NIGHT, attendance: { check_in_at: lateIn }, now: at(D2, "08:30") }), { ok: true, confirm: { kind: "forgotten", minutes: 90 } });
  const card = readFileSync(new URL("../src/components/attendance/CheckInOutCard.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(card, /getHours\(\)/, "the punch card never reads the device's hours");
  const local = readFileSync(new URL("../src/lib/localAttendanceFallback.js", import.meta.url), "utf8");
  assert.doesNotMatch(local, /getHours\(\)/, "the local check-in never reads the device's hours");
  assert.match(local, /selfCheckInDay\(data, employee/, "the local check-in lands on the duty day");
  const queue = readFileSync(new URL("../src/lib/attendanceQueue.js", import.meta.url), "utf8");
  assert.doesNotMatch(queue, /getHours\(\)/);
}

/* ── 5. lateness grace: the rule's, the same as deriveActualDuty ── */
{
  const { deriveActualDuty } = await import("../src/lib/actualDuty.js");
  const at0702 = lateMinutesFromScheduledStart(7 * 60 + 2, "07:00", GRACE);
  assert.deepEqual(at0702, { lateMinutes: 0, status: "present" }, "07:02 is inside the grace — not «متأخر 2 دقيقة»");
  const at0725 = lateMinutesFromScheduledStart(7 * 60 + 25, "07:00");
  assert.equal(at0725.lateMinutes, 25 - GRACE, "the default grace is the rule's");
  for (const hm of ["07:02", "07:10", "07:11", "07:25", "08:00"]) {
    const [h, m] = hm.split(":").map(Number);
    const punch = lateMinutesFromScheduledStart(h * 60 + m, "07:00", GRACE).lateMinutes;
    const report = deriveActualDuty({ checkIn: hm, checkOut: "16:00", shift: DAY, onDate: D1, employee: emp, company: {} }).lateMinutes;
    assert.equal(punch, report, `punch and report agree at ${hm}`);
  }
  // Art. 154 nursing minutes at the start are not lateness.
  assert.equal(lateMinutesFromScheduledStart(7 * 60 + 40, "07:00", GRACE, 30).lateMinutes, 0);
  const local = readFileSync(new URL("../src/lib/localAttendanceFallback.js", import.meta.url), "utf8");
  assert.match(local, /ruleValue\("hours\.grace\.minutes", date\)/, "the local check-in reads the rule's grace");
  assert.doesNotMatch(local, /late_grace_minutes: 0/);
}

console.log("PASS punch night carry: late night check-in, closed night & rest chain, late return alert, Riyadh clock, grace");
