/**
 * test-manager-attendance.mjs — the manager lane of الحضور والدوام:
 *  1. a manual-punch request is decided at the asked time (editable) or refused, closing the request;
 *  2. «ثبّت الانصراف» needs the real time (never after now, after the check-in; overnight = next morning);
 *  3. an early punch is not work: worked / overtime start at the published shift (client + server twin),
 *     and the early check-in window is the same gate on both sides;
 *  8. a local checkout before the shift end is flagged early (the server rule), Art. 154 end minutes excused;
 *  + one queue reading (lib/attendanceQueue) for the queue, the badge and multi-face rows.
 * Run: node scripts/test-manager-attendance.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildManualAttendanceRow,
  checkManualTimeGate,
  defaultManualCheckoutClock,
  isEarlyCheckoutAt,
  manualPunchLateness,
} from "../src/lib/attendancePunch.js";
import { deriveActualDuty, earlyPunchStart } from "../src/lib/actualDuty.js";
import { checkEarlyCheckInGate } from "../src/lib/attendanceDerivations.js";
import { deriveActualDutyCore, earlyPunchStart as earlyTwin } from "../base44/shared/reportsDerivations.ts";
import { checkEarlyCheckInGate as earlyGateTwin } from "../base44/shared/attendanceDerivations.ts";
import { dayOvertimeFor } from "../src/lib/autoOvertime.js";
import { queueFacesOf } from "../src/lib/attendanceQueue.js";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const DAY = "2026-07-01";
const iso = (hm, day = DAY) => new Date(`${day}T${hm}:00+03:00`).toISOString();
const SHIFT = { id: "fix", label: "نهاري", start: "07:00", end: "15:00", restMinutes: 60 };

/* ── 1. manual punch request: decided at the asked time, refusal named, request closed ── */
{
  assert.deepEqual(manualPunchLateness({ clock: "07:15", shiftStart: "07:00" }), { status: "late", lateMinutes: 5 }, "15 past start less the 10-minute grace");
  assert.deepEqual(manualPunchLateness({ clock: "07:05", shiftStart: "07:00" }), { status: "present", lateMinutes: 0 }, "inside the grace");
  assert.deepEqual(manualPunchLateness({ clock: "06:55", shiftStart: "07:00" }), { status: "present", lateMinutes: 0 });
  assert.deepEqual(manualPunchLateness({ clock: "07:20", shiftStart: "07:00", nursingStartMinutes: 30 }), { status: "present", lateMinutes: 0 }, "Art. 154 start minutes are not lateness");
  assert.deepEqual(manualPunchLateness({ clock: "00:30", shiftStart: "22:00" }), { status: "late", lateMinutes: 140 }, "after midnight on an evening shift (less the grace)");
  const row = buildManualAttendanceRow({ employee: { id: "e1", name: "سارة" }, date: DAY, time: "07:05", kind: "manual_punch", by: "نيار", reason: "البصمة معطلة", lateness: { status: "late", lateMinutes: 5 } });
  assert.equal(row.checkInAt, iso("07:05"), "stamped at the asked time, not the click time");
  assert.equal(row.status, "late");
  assert.equal(row.lateMinutes, 5);
  assert.equal(row.overrideBy, "نيار");
  assert.equal(row.excusedNote, "البصمة معطلة");
  const store = src("src/lib/store.js");
  assert.match(store, /export function decideManualPunchRequest\(/, "a decision closes the request itself");
  assert.match(store, /setOtherRequestStatus\(companyId, employeeId, requestId, "rejected", by, note/, "refusal goes through the named-reason gate");
  assert.match(store, /اعتُمدت بصمتك اليدوية ليوم/, "the worker is told the approved time");
  const dash = src("src/components/attendance/AttendanceDailyDashboard.jsx");
  assert.match(dash, /decideManualPunchRequest\(company\.id/, "the queue row decides the request");
  assert.match(dash, /data-punch-ask-time/, "the asked time is editable");
  console.log("PASS manual punch request — asked time, refusal with reason, request closed");
}

/* ── 2. «ثبّت الانصراف» needs the real time ── */
{
  const now = new Date(iso("17:30"));
  assert.equal(checkManualTimeGate({ kind: "checkout_fix", date: DAY, time: "", checkInAt: iso("07:12"), now }).error, "TIME_REQUIRED");
  assert.equal(checkManualTimeGate({ kind: "checkout_fix", date: DAY, time: "18:00", checkInAt: iso("07:12"), now }).error, "TIME_IN_FUTURE");
  const ok = checkManualTimeGate({ kind: "checkout_fix", date: DAY, time: "16:00", checkInAt: iso("07:12"), now });
  assert.equal(ok.ok, true);
  assert.equal(ok.at, iso("16:00"));
  const night = checkManualTimeGate({ kind: "checkout_fix", date: "2026-06-30", time: "06:00", checkInAt: iso("22:00", "2026-06-30"), now: new Date(iso("07:00")) });
  assert.equal(night.at, iso("06:00"), "an overnight checkout is the next morning");
  assert.equal(checkManualTimeGate({ kind: "manual_punch", date: DAY, time: "18:00", now }).error, "TIME_IN_FUTURE", "a check-in is never after now");
  assert.equal(defaultManualCheckoutClock(SHIFT, now), "15:00", "the field opens on the shift end once it has passed");
  assert.equal(defaultManualCheckoutClock(SHIFT, new Date(iso("12:10"))), "12:10", "before the end: now");
  const out = buildManualAttendanceRow({ existing: { id: "pa", checkInAt: iso("07:12") }, employee: { id: "e1" }, date: DAY, time: "16:00", kind: "checkout_fix", by: "نيار", reason: "غادر 16:00 ونسي البصمة" });
  assert.equal(out.checkOutAt, iso("16:00"));
  assert.equal(out.checkoutNote, "غادر 16:00 ونسي البصمة", "the reason stays on the record");
  const overnight = buildManualAttendanceRow({ existing: { id: "pa", checkInAt: iso("22:00", "2026-06-30") }, employee: { id: "e1" }, date: "2026-06-30", time: "06:00", kind: "checkout_fix", by: "م", reason: "نسي" });
  assert.equal(overnight.checkOutAt, iso("06:00"), "overnight checkout lands next morning");
  const store = src("src/lib/store.js");
  assert.match(store, /requireTime: true,\n  \}\);\n  if \(!gate\.ok\) return gate;\n  const timeGate = checkManualTimeGate/, "recordManualAttendance requires the time");
  assert.match(store, /ثبّت \$\{by \|\| "مديرك"\} انصرافك ليوم/, "the worker is told");
  const server = src("base44/functions/supabaseAttendance/entry.ts");
  assert.match(server, /حدد وقت الانصراف\./, "the cloud manualCheckOut refuses a missing time");
  console.log("PASS manual checkout — real time required, never in the future, overnight safe, reason kept");
}

/* ── 3. early punch counts from the published start; same window gate on both sides ── */
{
  assert.equal(earlyPunchStart(6 * 60 + 58, SHIFT), 7 * 60);
  assert.equal(earlyPunchStart(7 * 60 + 12, SHIFT), 7 * 60 + 12, "late stays late");
  assert.equal(earlyPunchStart(30, { start: "22:00" }), 30, "after midnight on an evening shift is late, not early");
  assert.equal(earlyPunchStart(23 * 60 + 30, { start: "00:00" }), 24 * 60, "a midnight shift");
  assert.equal(earlyTwin(6 * 60 + 58, SHIFT), 7 * 60, "server twin");
  const shift = { ...SHIFT, end: "16:00" };
  const early = deriveActualDuty({ checkIn: iso("06:58"), checkOut: iso("16:05"), shift, onDate: DAY, employee: { id: "e1" }, company: {} });
  assert.equal(early.workedMinutes, 485, "07:00–16:05 less 60 rest — not from 06:58");
  assert.equal(early.overtimeMinutes, 5, "only the 5 minutes after 16:00 beyond 8 h");
  assert.equal(early.presenceMinutes, 547, "presence (Art. 101 stay cap) stays the real punch");
  const twin = deriveActualDutyCore({ checkIn: iso("06:58"), checkOut: iso("16:05"), shift, onDate: DAY, employee: { id: "e1" }, company: {} });
  assert.equal(twin.workedMinutes, early.workedMinutes, "server twin agrees");
  assert.equal(twin.overtimeMinutes, early.overtimeMinutes);
  const d = { employees: [{ id: "e1", stationId: "st", profile: {} }], stations: [{ id: "st" }], schedules: [{ stationId: "st", shiftTypes: [shift], assignments: { [DAY]: { fix: ["e1"] } } }], personalAttendance: [], otDecisions: {} };
  const ot = dayOvertimeFor(d, d.employees[0], DAY, { checkInAt: iso("06:55"), checkOutAt: iso("16:02") });
  assert.equal(ot.overtimeMinutes, 2, "06:55–16:02 records 2 minutes, not 7");
  for (const gate of [checkEarlyCheckInGate, earlyGateTwin]) {
    assert.equal(gate(SHIFT, 5 * 60 + 30, 60).error, "TOO_EARLY");
    assert.equal(gate(SHIFT, 5 * 60 + 30, 60).opensAt, "06:00");
    assert.equal(gate(SHIFT, 6 * 60, 60).ok, true);
  }
  const server = src("base44/functions/supabaseAttendance/entry.ts");
  assert.match(server, /checkEarlyCheckInGate\(scheduledShift, nowMinutes/, "the cloud checkIn refuses before the window");
  const board = src("src/components/attendance/AttendanceSettingsBoard.jsx");
  assert.doesNotMatch(board, /onChange=\{\(e\) => \{\s*const n = Number\(e\.target\.value\);\s*updateCompany/, "the window select goes through the policy draft and save");
  console.log("PASS early punch — work from the published start (client = server), one TOO_EARLY window");
}

/* ── 8. a local checkout before the end is early ── */
{
  assert.equal(isEarlyCheckoutAt(SHIFT, iso("13:00")), true);
  assert.equal(isEarlyCheckoutAt(SHIFT, iso("15:00")), false);
  assert.equal(isEarlyCheckoutAt(SHIFT, iso("14:40"), 30), false, "Art. 154 end minutes excused");
  assert.equal(isEarlyCheckoutAt({ start: "22:00", end: "06:00" }, iso("05:00")), true, "overnight: before 06:00 next morning");
  assert.equal(isEarlyCheckoutAt({ start: "22:00", end: "06:00" }, iso("06:10")), false);
  assert.match(src("src/lib/localAttendanceFallback.js"), /earlyCheckout: isEarlyCheckoutAt\(shift, checkOutAt/, "localCheckOut sets the flag like the server");
  console.log("PASS early checkout flagged in local mode, nursing end excused, overnight");
}

/* ── one queue reading; a row with two faces is under both ── */
{
  const data = { schedules: [], employees: [] };
  const sara = { id: "s", otherRequests: [{ id: "r1", type: "manual_punch", status: "pending" }] };
  assert.deepEqual(queueFacesOf(sara, null, data), ["manual"]);
  const omar = { id: "o", otherRequests: [] };
  assert.deepEqual(queueFacesOf(omar, { location_status: "outside", early_checkout: true, check_in_at: iso("07:00"), check_out_at: iso("13:00"), date: DAY }, data), ["outside", "early"], "two faces, both listed");
  assert.deepEqual(queueFacesOf(omar, { check_in_at: iso("07:00"), location_status: "inside" }, data), [], "an open record mid-shift is not a decision");
  const badges = src("src/lib/suiteBadges.js");
  assert.match(badges, /attendanceDecisionQueue\(employees, attendanceRows, data\)\.length/, "the badge is the queue's own count");
  console.log("PASS one queue reading — queue, team list and badge agree; multi-face rows");
}

console.log("test-manager-attendance: all passed");

// The employee file is written by HR (or the administrator) only — the store holds the gate, not only the screen.
{
  const { readFileSync } = await import("node:fs");
  const store = readFileSync(new URL("../src/lib/store.js", import.meta.url), "utf8");
  const body = store.slice(store.indexOf("export function patchEmployeeFile("), store.indexOf("export function applyDueLaborRules("));
  if (!/employeeFileEditGate\(actor, subject, live\)/.test(body) || !/if \(!fileGate\.ok\) return fileGate;/.test(body)) throw new Error("patchEmployeeFile must refuse without an HR actor");
  for (const f of ["../src/pages/EmployeeProfile.jsx", "../src/components/employees/HoursOnFile.jsx"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    const calls = src.split("patchEmployeeFile(").length - 1;
    const withActor = (src.match(/patchEmployeeFile\(company\.id, employee\.id, \{\s*actor: currentUser/g) || []).length;
    if (calls !== withActor) throw new Error(`${f}: every patchEmployeeFile call passes the acting user`);
  }
  console.log("PASS employee file — HR-only write held in the store");
}
