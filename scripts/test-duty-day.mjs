// بصمتي — the duty day and the self-punch gates: overnight carry after midnight, the closed check-in
// after the shift, the self checkout (pending fix / early / forgotten), early-leave minutes, and the
// split-break remainder warning. The server twins answer the same.
process.env.TZ = "Asia/Riyadh";
import assert from "node:assert/strict";
import {
  checkLateCheckInGate,
  checkSelfCheckoutGate,
  dutyDayOf,
  earlyLeaveMinutesOf,
  getTodaysShift,
  isOvernightShift,
  overnightCarryOpen,
  previousDateKey,
} from "../src/lib/attendanceDerivations.js";
import { checkFlexBreakPunchGate } from "../src/lib/shiftDerivations.js";
import * as twin from "../base44/shared/attendanceDerivations.ts";
import * as shiftTwin from "../base44/shared/shiftDerivations.ts";

const at = (day, hm) => new Date(`${day}T${hm}:00+03:00`);
const NIGHT = { id: "n", start: "22:00", end: "06:00", label: "ليلي" };
const DAY = { id: "d", start: "07:00", end: "16:00", label: "نهاري" };
const emp = { id: "e", stationId: "st" };
const data = (assign, rows = []) => ({
  stations: [{ id: "st" }],
  schedules: [{ stationId: "st", shiftTypes: [NIGHT, DAY], assignments: assign }],
  personalAttendance: rows,
});
const openNight = { employeeId: "e", date: "2026-07-01", checkInAt: at("2026-07-01", "21:30").toISOString(), checkOutAt: null };

// ── 1. overnight carry ──
assert.equal(previousDateKey("2026-03-01"), "2026-02-28");
assert.equal(twin.previousDateKey("2026-01-01"), "2025-12-31");
assert.equal(isOvernightShift(NIGHT), true);
assert.equal(isOvernightShift(DAY), false);
{
  const d = data({ "2026-07-01": { n: ["e"] } }, [openNight]);
  const night = dutyDayOf(d, emp, at("2026-07-02", "03:00"));
  assert.equal(night.dateKey, "2026-07-01", "after midnight the open overnight row is still the duty day");
  assert.equal(night.carried, true);
  assert.equal(night.shift.end, "06:00");
  assert.equal(night.shift.dutyDate, "2026-07-01");
  assert.equal(getTodaysShift(d, emp, at("2026-07-02", "06:10"))?.start, "22:00", "a forgotten overnight checkout stays reachable after 06:00");
  assert.equal(dutyDayOf(d, emp, at("2026-07-01", "23:00")).dateKey, "2026-07-01");
}
{
  // Today's own duty takes over once its check-in window opens (07:00 − 60 = 06:00).
  const d = data({ "2026-07-01": { n: ["e"] }, "2026-07-02": { d: ["e"] } }, [openNight]);
  assert.equal(dutyDayOf(d, emp, at("2026-07-02", "05:30")).dateKey, "2026-07-01");
  assert.equal(dutyDayOf(d, emp, at("2026-07-02", "06:10")).dateKey, "2026-07-02");
}
{
  // Closed overnight row, or a day shift left open yesterday: no carry.
  const closed = { ...openNight, checkOutAt: at("2026-07-02", "06:00").toISOString() };
  assert.equal(dutyDayOf(data({ "2026-07-01": { n: ["e"] } }, [closed]), emp, at("2026-07-02", "03:00")).carried, false);
  const dayOpen = { employeeId: "e", date: "2026-07-01", checkInAt: at("2026-07-01", "07:00").toISOString(), checkOutAt: null };
  assert.equal(dutyDayOf(data({ "2026-07-01": { d: ["e"] } }, [dayOpen]), emp, at("2026-07-02", "03:00")).carried, false);
}
{
  // The cloud row (snake_case) carries too, and the server twin decides the same.
  const cloud = { employee_id: "e", date: "2026-07-01", check_in_at: openNight.checkInAt, check_out_at: null };
  assert.equal(dutyDayOf(data({ "2026-07-01": { n: ["e"] } }), emp, at("2026-07-02", "03:00"), [cloud]).carried, true);
  const input = { yesterdayRow: cloud, yesterdayShift: NIGHT, todayRow: null, todayShift: DAY, earlyWindowMin: 60 };
  for (const nowMin of [180, 330, 361, 420]) {
    assert.equal(twin.overnightCarryOpen({ ...input, nowMin }), overnightCarryOpen({ ...input, nowMin }), `twin agrees at ${nowMin}`);
  }
  assert.equal(twin.overnightCarryOpen({ ...input, nowMin: 180 }), true);
  assert.equal(twin.overnightCarryOpen({ ...input, nowMin: 361 }), false);
}

// ── 4. late check-in gate ──
{
  const shut = checkLateCheckInGate(DAY, 17 * 60 + 30);
  assert.equal(shut.ok, false);
  assert.equal(shut.error, "SHIFT_ENDED");
  assert.match(shut.reason, /انتهت ورديتك 16:00/);
  assert.match(shut.reason, /نسيت البصمة؟/);
  assert.equal(checkLateCheckInGate(DAY, 16 * 60 + 30).ok, true, "inside the forgotten hour it still opens");
  assert.equal(checkLateCheckInGate(DAY, 9 * 60).ok, true);
  assert.equal(checkLateCheckInGate(NIGHT, 23 * 60).ok, true, "an overnight shift never ends on its start day");
  for (const nowMin of [540, 1000, 1050, 1200]) {
    assert.equal(twin.checkLateCheckInGate(DAY, nowMin).ok, checkLateCheckInGate(DAY, nowMin).ok, `late twin at ${nowMin}`);
  }
}

// ── 5. early leave ──
{
  const inAt = at("2026-07-01", "07:00").toISOString();
  assert.equal(earlyLeaveMinutesOf({ shift: DAY, checkIn: inAt, checkOut: at("2026-07-01", "13:00").toISOString() }), 180);
  assert.equal(earlyLeaveMinutesOf({ shift: DAY, checkIn: inAt, checkOut: at("2026-07-01", "16:05").toISOString() }), 0);
  assert.equal(earlyLeaveMinutesOf({ shift: DAY, checkIn: inAt, checkOut: at("2026-07-01", "15:00").toISOString(), nursingEndMinutes: 60 }), 0, "her nursing hour at the end is not early leave (Art. 154)");
  assert.equal(earlyLeaveMinutesOf({ shift: NIGHT, checkIn: openNight.checkInAt, checkOut: at("2026-07-02", "05:00").toISOString() }), 60, "overnight: measured to tomorrow's end");
  assert.equal(earlyLeaveMinutesOf({ shift: NIGHT, checkIn: openNight.checkInAt, checkOut: at("2026-07-01", "23:30").toISOString() }), 390);
}

// ── 3. self checkout ──
{
  const attendance = { check_in_at: at("2026-07-01", "07:00").toISOString() };
  const pending = checkSelfCheckoutGate({ shift: DAY, attendance, now: at("2026-07-01", "17:35"), pendingFix: { time: "16:00" } });
  assert.equal(pending.ok, false);
  assert.equal(pending.error, "CHECKOUT_FIX_PENDING");
  assert.match(pending.reason, /16:00/);
  const early = checkSelfCheckoutGate({ shift: DAY, attendance, now: at("2026-07-01", "13:00") });
  assert.deepEqual(early, { ok: true, confirm: { kind: "early", minutes: 180 } });
  const forgotten = checkSelfCheckoutGate({ shift: DAY, attendance, now: at("2026-07-01", "17:30") });
  assert.deepEqual(forgotten, { ok: true, confirm: { kind: "forgotten", minutes: 90 } }, "past the forgotten hour the checkout asks once and names the minutes");
  assert.deepEqual(checkSelfCheckoutGate({ shift: DAY, attendance, now: at("2026-07-01", "16:20") }), { ok: true, confirm: null });
}

// ── 11. split flex break: the remainder warning ──
{
  const FLEX = { id: "f", start: "07:00", end: "16:00", breakMode: "flex", flexBreak: { minutes: 60, from: "11:00", to: "15:00", split: true } };
  const iso = (hm) => at("2026-07-01", hm).toISOString();
  const input = { action: "end", shift: FLEX, breaks: [{ start: iso("11:00"), end: null, source: "punch" }], checkIn: iso("07:00"), now: iso("11:45"), onDate: "2026-07-01" };
  const g = checkFlexBreakPunchGate(input);
  assert.equal(g.ok, true);
  assert.equal(g.leftover, 15);
  assert.match(g.warn, /سيبقى 15 دقيقة لا تكفي جزءاً/);
  assert.equal(shiftTwin.checkFlexBreakPunchGate(input).leftover, 15, "server twin warns the same");
  assert.equal(checkFlexBreakPunchGate({ ...input, now: iso("11:30") }).warn, undefined, "a lawful 30-minute remainder needs no warning");
}

console.log("PASS duty day: overnight carry, late check-in gate, self checkout gate, early leave, split remainder");
