/**
 * test-nursing-hour.mjs — the nursing hour (Labour Law Art. 154, Regs Art. 31) through the proof chain:
 * lateness excused at the start, early leave excused at the end, a split hour, the minutes credited as
 * actual work, no overtime from nursing, the right's expiry (24 months / «until»), the live alerts and
 * the bell (employee only, once), the law-panel row (her lane, a man's lane, management's count) and
 * the server twins (base44/shared) giving the same figures. Figures from laborRules, never typed.
 * Run: node scripts/test-nursing-hour.mjs
 */
import assert from "node:assert/strict";
import { register } from "node:module";

register(`data:text/javascript,${encodeURIComponent(`
const SRC = ${JSON.stringify(new URL("../src/", import.meta.url).href)};
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) {
    let url = SRC + spec.slice(2);
    if (!/\\.[cm]?jsx?$/.test(url)) url += ".js";
    return next(url, ctx);
  }
  return next(spec, ctx);
}`)}`);

const { ruleValue, citeRule, explainRule } = await import("../src/lib/laborRules.js");
const { nursingHourOn, nursingCreditOf, nursingRightUntil, isExcusedEarlyCheckout, excusedStartMinutes } = await import("../src/lib/dutyRequests.js");
const { deriveActualDuty } = await import("../src/lib/actualDuty.js");
const { dayOvertimeFor, weekOrdinaryBefore } = await import("../src/lib/autoOvertime.js");
const { deriveDayStatus } = await import("../src/lib/attendanceDerivations.js");
const { deriveTimesheetDay } = await import("../src/lib/reportsDerivations.js");
const { myDutyDay, monthTotals } = await import("../src/lib/dutyDay.js");
const { deriveDutyAlerts, planDutyAlertNotices, planNursingExpiryNotices, nursingExpiryAlert, NURSING_EXPIRY_LEAD_DAYS } = await import("../src/lib/dutyAlerts.js");
const { planDutyTick } = await import("../src/lib/dutyTicker.js");
const { buildMinistrySection } = await import("../src/lib/ministrySections.js");
const twinNursing = await import("../base44/shared/nursingHour.ts");
const twinReports = await import("../base44/shared/reportsDerivations.ts");
const twinAtt = await import("../base44/shared/attendanceDerivations.ts");
const twinOt = await import("../base44/shared/autoOvertime.ts");
const twinRules = await import("../base44/shared/laborRules.ts");

const D = "2026-10-15"; // a Thursday, out of Ramadan and the heat season
const MINS = ruleValue("leave.nursing.dailyMinutes", D);
assert.equal(MINS, 60, "the catalog row (Art. 154)");
assert.equal(citeRule("leave.nursing.dailyMinutes", D).article, "154");
assert.equal(explainRule("leave.nursing.regs31.cite", D).value, 24, "Regs Art. 31 — 24 months, in the catalog");
assert.equal(twinRules.ruleValue("leave.nursing.regs31.cite", D), 24, "the server catalog carries Regs Art. 31 too");

const SHIFT = { id: "m", label: "صباحي", start: "07:00", end: "16:00", restMinutes: 60 };
const nurse = (split, extra = {}) => ({
  id: "e_sara",
  name: "سارة",
  stationId: "st",
  profile: { gender: "female", nursingHour: { placement: split.end && !split.start ? "end" : "start", nursingSplit: split, childBirthDate: "2025-06-01", from: "2025-09-01", until: "2027-05-31", ...extra } },
});
const START = nurse({ start: MINS, mid: 0, end: 0 });
const END = nurse({ start: 0, mid: 0, end: MINS });
const SPLIT = nurse({ start: 30, mid: 0, end: 30 });
const MAN = { id: "e_omar", name: "عمر", stationId: "st", profile: { gender: "male" } };

/* ── 1. lateness excused at the start ── */
{
  const late = deriveActualDuty({ checkIn: "08:00", checkOut: "16:00", shift: SHIFT, onDate: D, employee: START });
  assert.equal(late.lateMinutes, 0, "arriving 60 min after start inside a start nursing hour is not late");
  const grace = ruleValue("hours.grace.minutes", D) || 0;
  assert.equal(deriveActualDuty({ checkIn: "08:30", checkOut: "16:00", shift: SHIFT, onDate: D, employee: START }).lateMinutes, Math.max(0, 30 - grace), "past the hour the rest is late (after the grace)");
  assert.equal(deriveActualDuty({ checkIn: "08:00", checkOut: "16:00", shift: SHIFT, onDate: D, employee: END }).lateMinutes, 60 - grace, "an end placement does not excuse the start");
  assert.equal(deriveActualDuty({ checkIn: "08:00", checkOut: "16:00", shift: SHIFT, onDate: D, employee: MAN }).lateMinutes, 60 - grace);
  assert.equal(deriveDayStatus({ checkIn: "08:00", checkOut: "16:00", date: D }, { shiftStart: "07:00", shiftMinutes: 480, employee: START }).late, false, "deriveDayStatus — not late");
  assert.equal(deriveTimesheetDay({ date: D, checkIn: "08:00", checkOut: "16:00" }, { shift: SHIFT, employee: START }).late, false, "timesheet — not late");
  assert.deepEqual(excusedStartMinutes(START, D, "07:00"), { minutes: MINS, reason: "nursing" });
  // the calendar / month line (dutyDay → monthTotals): a stored «late 60» row reads on time.
  const data = {
    stations: [{ id: "st" }],
    employees: [START],
    schedules: [{ id: "s", stationId: "st", shiftTypes: [SHIFT], assignments: { [D]: { m: ["e_sara"] } }, publishedDays: [D] }],
  };
  const row = { date: D, check_in_at: `${D}T08:00:00+03:00`, check_out_at: `${D}T16:00:00+03:00`, late_minutes: 60, status: "late" };
  const day = myDutyDay({ employee: START, data, row, key: D, todayKey: "2026-10-16", calendar: null });
  assert.equal(day.status, "ontime", "the duty day is on time");
  assert.equal(day.excuse, "nursing");
  assert.equal(monthTotals([day]).lateMinutes, 0, "the month line counts no lateness");
  console.log("PASS lateness excused inside a start nursing hour (actualDuty · dayStatus · timesheet · dutyDay · month)");
}

/* ── 2. early leave excused at the end ── */
{
  assert.equal(isExcusedEarlyCheckout(END, D, `${D}T15:00:00+03:00`, "16:00"), true, "leaving at 15:00 inside the end hour is not early");
  assert.equal(isExcusedEarlyCheckout(END, D, `${D}T14:50:00+03:00`, "16:00"), false, "before the end hour it is early");
  assert.equal(isExcusedEarlyCheckout(START, D, `${D}T15:00:00+03:00`, "16:00"), false, "a start placement does not excuse the end");
  assert.equal(deriveTimesheetDay({ date: D, checkIn: "07:00", checkOut: "15:00" }, { shift: SHIFT, employee: END }).earlyMinutes, 0, "timesheet — no early minutes");
  assert.equal(deriveTimesheetDay({ date: D, checkIn: "07:00", checkOut: "14:30" }, { shift: SHIFT, employee: END }).earlyMinutes, 30, "only what passes the hour");
  assert.equal(deriveTimesheetDay({ date: D, checkIn: "07:00", checkOut: "15:00" }, { shift: SHIFT, employee: MAN }).earlyMinutes, 60);
  console.log("PASS early leave excused inside an end nursing hour");
}

/* ── 3. split: half at the start, half at the end, as nursingSplit stores it ── */
{
  const n = nursingHourOn(SPLIT, D);
  assert.deepEqual([n.startMinutes, n.midMinutes, n.endMinutes, n.minutes], [30, 0, 30, 60]);
  const day = deriveActualDuty({ checkIn: "07:30", checkOut: "15:30", shift: SHIFT, onDate: D, employee: SPLIT });
  assert.equal(day.lateMinutes, 0, "30 min after start — inside the start half");
  assert.equal(day.nursingCreditMinutes, 60, "both halves credited");
  const grace = ruleValue("hours.grace.minutes", D) || 0;
  assert.equal(deriveActualDuty({ checkIn: "08:00", checkOut: "15:30", shift: SHIFT, onDate: D, employee: SPLIT }).lateMinutes, Math.max(0, 30 - grace), "past the start half is late");
  assert.equal(deriveTimesheetDay({ date: D, checkIn: "07:30", checkOut: "15:20" }, { shift: SHIFT, employee: SPLIT }).earlyMinutes, 10, "past the end half is early");
  // A total over the catalog figure is cut to it (start first, then end, then middle).
  const over = nursingHourOn(nurse({ start: 45, mid: 30, end: 45 }), D);
  assert.equal(over.minutes, MINS);
  assert.deepEqual([over.startMinutes, over.endMinutes, over.midMinutes], [45, 15, 0]);
  console.log("PASS split hour — half at the start, half at the end");
}

/* ── 4. credited minutes: «المنجز», payroll ordinary, no shortfall ── */
{
  const end = deriveActualDuty({ checkIn: "07:00", checkOut: "15:00", shift: SHIFT, onDate: D, employee: END });
  assert.equal(end.presenceWorkedMinutes, 420, "the punches alone: 8h presence − 1h rest");
  assert.equal(end.nursingCreditMinutes, 60);
  assert.equal(end.workedMinutes, 480, "worked = the full roster");
  assert.equal(end.ordinaryMinutes, 480, "ordinary (payroll) = the full roster");
  assert.equal(end.rosteredMinutes, 480);
  // She did not use the hour: nothing to credit.
  assert.equal(deriveActualDuty({ checkIn: "07:00", checkOut: "16:00", shift: SHIFT, onDate: D, employee: END }).nursingCreditMinutes, 0);
  // Middle period (with a nursery): what is still short of the roster, up to its minutes.
  const MID = nurse({ start: 0, mid: 40, end: 0 });
  const mid = deriveActualDuty({ checkIn: "07:00", checkOut: "16:00", shift: SHIFT, onDate: D, employee: MID, breaks: [{ start: "11:00", end: "12:40" }] });
  assert.equal(mid.presenceWorkedMinutes, 440);
  assert.equal(mid.nursingCreditMinutes, 40, "the middle part covers the 40 minutes short");
  assert.equal(deriveDayStatus({ checkIn: "07:00", checkOut: "15:00", date: D }, { shiftStart: "07:00", shiftMinutes: 540, employee: END }).ordinaryMinutes, 540, "deriveDayStatus — ordinary at the roster");
  const sheet = deriveTimesheetDay({ date: D, checkIn: "07:00", checkOut: "15:00" }, { shift: SHIFT, employee: END });
  assert.equal(sheet.ordinaryMinutes, 480);
  assert.equal(sheet.nursingCreditMinutes, 60);
  assert.deepEqual(nursingCreditOf(null, { inMinutes: 420, outMinutes: 900, shiftStart: 420, shiftEnd: 960 }), { minutes: 0, start: 0, mid: 0, end: 0 });
  console.log("PASS nursing minutes credited as actual work — no shortfall");
}

/* ── 5. nursing never creates overtime ── */
{
  const data = { employees: [END], schedules: [{ id: "s", stationId: "st", shiftTypes: [SHIFT], assignments: { [D]: { m: ["e_sara"] } }, publishedDays: [D] }], personalAttendance: [] };
  const row = { employeeId: "e_sara", date: D, checkInAt: `${D}T07:00:00+03:00`, checkOutAt: `${D}T15:00:00+03:00` };
  const read = dayOvertimeFor(data, END, D, row);
  assert.equal(read.ok, true);
  assert.equal(read.overtimeMinutes, 0, "a used nursing hour is not overtime");
  assert.equal(read.ordinaryMinutes, 480, "but it is ordinary work");
  assert.equal(read.nursingCreditMinutes, 60);
  // A long day: the overtime is what the punches pass the cap by — the credit adds none.
  const long = deriveActualDuty({ checkIn: "08:00", checkOut: "17:30", shift: SHIFT, onDate: D, employee: START });
  assert.equal(long.nursingCreditMinutes, 60);
  assert.equal(long.overtimeMinutes, Math.max(0, long.presenceWorkedMinutes - 480), "overtime reads the punches alone");
  assert.equal(long.overtimeMinutes, 30);
  // The week's running ordinary count excludes the credit — the credit never tips the week over its cap.
  const week = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"];
  const wdata = {
    employees: [END],
    schedules: [{ id: "s", stationId: "st", shiftTypes: [SHIFT], assignments: Object.fromEntries([...week, D].map((k) => [k, { m: ["e_sara"] }])), publishedDays: [...week, D] }],
    personalAttendance: week.map((k) => ({ employeeId: "e_sara", date: k, checkInAt: `${k}T07:00:00+03:00`, checkOutAt: `${k}T15:00:00+03:00` })),
  };
  assert.equal(weekOrdinaryBefore(wdata, END, D), 4 * 420, "the running week count is the punches alone");
  console.log("PASS no overtime from nursing (day, long day, week)");
}

/* ── 6. expiry: from ≤ day ≤ until; an open «until» stops at 24 months from birth ── */
{
  assert.equal(nursingHourOn(END, "2027-05-31")?.minutes, MINS, "the last day is covered");
  assert.equal(nursingHourOn(END, "2027-06-01"), null, "the day after — no right");
  assert.equal(nursingHourOn(END, "2025-08-31"), null, "before it starts — no right");
  assert.equal(deriveActualDuty({ checkIn: "08:00", checkOut: "16:00", shift: SHIFT, onDate: "2027-06-01", employee: START }).lateMinutes, 60 - (ruleValue("hours.grace.minutes", D) || 0), "after the right ends, late is late");
  assert.equal(nursingRightUntil("2025-06-01"), "2027-05-31", "Regs Art. 31(1): 24 months from birth");
  const open = nurse({ start: 0, mid: 0, end: MINS }, { until: "" });
  assert.equal(nursingHourOn(open, "2027-05-31")?.until, "2027-05-31", "no «until» → 24 months from birth");
  assert.equal(nursingHourOn(open, "2027-06-01"), null);
  console.log("PASS expiry — until, and 24 months from birth when open");
}

/* ── 7. alerts: «بدأت ساعة رضاعتك (م 154)» and the expiry, employee only, once ── */
{
  const at = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
  const run = (who, now, onDate = D) => deriveDutyAlerts({ shift: SHIFT, punches: { checkIn: "07:00" }, onDate, employee: who, now: at(now) });
  assert.ok(!run(END, "14:59").alerts.some((a) => a.id === "nursing_start"), "a minute before — quiet");
  const started = run(END, "15:00").alerts.find((a) => a.id === "nursing_start");
  assert.ok(started, "at its start");
  assert.equal(started.at, "15:00");
  assert.equal(started.cite.article, "154");
  assert.ok(started.textAr.startsWith("بدأت ساعة رضاعتك (م 154)"));
  assert.ok(run(SPLIT, "15:30").alerts.some((a) => a.id === "nursing_start"), "split: the end half starts");
  assert.equal(run(SPLIT, "15:30").alerts.find((a) => a.id === "nursing_start").meta.start, "15:30");
  assert.ok(!run(START, "15:00").alerts.some((a) => a.id === "nursing_start"), "a start placement has no in-shift start");
  assert.ok(!run(MAN, "15:00").alerts.some((a) => a.id === "nursing_start"));
  const shiftKey = "e_sara:2026-10-15:m";
  const plans = planDutyAlertNotices({ alerts: run(END, "15:00").alerts, employee: END, managerId: "mgr", shiftKey, app: true });
  const plan = plans.find((p) => p.alertId === "nursing_start");
  assert.equal(plan.userId, "e_sara", "the employee is told");
  assert.equal(plan.text, "بدأت ساعة رضاعتك (م 154) — ⁦15:00–16:00⁩");
  assert.ok(!plans.some((p) => p.userId === "mgr"), "the manager is not told");
  assert.deepEqual(planDutyAlertNotices({ alerts: run(END, "15:10").alerts, employee: END, managerId: "mgr", shiftKey, existingKeys: plans.map((p) => p.key), app: true }).filter((p) => p.alertId === "nursing_start"), [], "once per shift");

  // Expiry: 30 days before, then once more on the day; nothing before the window or after it.
  assert.equal(NURSING_EXPIRY_LEAD_DAYS, 30);
  assert.equal(nursingExpiryAlert(END, "2027-04-30"), null, "31 days ahead — quiet");
  const soon = nursingExpiryAlert(END, "2027-05-01");
  assert.equal(soon.meta.stage, "soon");
  assert.equal(soon.textAr, "ينتهي حق ساعة الرضاعة في ⁦2027-05-31⁩");
  assert.equal(nursingExpiryAlert(END, "2027-05-31").meta.stage, "day");
  assert.equal(nursingExpiryAlert(END, "2027-06-01"), null);
  assert.equal(nursingExpiryAlert(MAN, "2027-05-01"), null);
  const first = planNursingExpiryNotices({ employee: END, onDate: "2027-05-01" });
  assert.equal(first.length, 1);
  assert.equal(first[0].userId, "e_sara");
  assert.equal(first[0].key, "nursing-expiry:e_sara:2027-05-31:soon");
  assert.deepEqual(planNursingExpiryNotices({ employee: END, onDate: "2027-05-12", existingKeys: [first[0].key] }), [], "once in the 30-day window");
  const lastDay = planNursingExpiryNotices({ employee: END, onDate: "2027-05-31", existingKeys: [first[0].key] });
  assert.equal(lastDay[0].key, "nursing-expiry:e_sara:2027-05-31:day", "and once on the day");
  // Through the app ticker — on a day without a shift too.
  const tick = planDutyTick({ data: { employees: [END], schedules: [], notifications: [] }, user: END, now: Date.parse("2027-05-01T09:00:00+03:00") });
  assert.ok(tick.plans.some((p) => p.key === "nursing-expiry:e_sara:2027-05-31:soon"), "the ticker sends it, shift or not");
  const again = planDutyTick({ data: { employees: [END], schedules: [], notifications: [{ key: "nursing-expiry:e_sara:2027-05-31:soon" }] }, user: END, now: Date.parse("2027-05-02T09:00:00+03:00") });
  assert.deepEqual(again.plans, [], "deduped on the bell's keys");
  console.log("PASS alerts — start of the hour, expiry 30 days ahead and on the day, employee only, once");
}

/* ── 8. the law panel «أنظمة الوزارة — ما يخص البصمة» ── */
{
  const mine = buildMinistrySection("attendance", { lane: "employee", today: D, data: {}, employee: END });
  const row = mine.rows.find((r) => r.key === "labour-154");
  assert.equal(row.title, "ساعة رضاعة حتى 31 مايو 2027", "the date reads like the rest of the card, not a raw ISO");
  assert.equal(row.level, "met");
  assert.equal(row.pill, "مستوفٍ");
  assert.deepEqual(row.cites.map((c) => `${c.source}:${c.article}`), ["labour:154", "regs:31"], "Art. 154 with Regs Art. 31");
  assert.ok(row.hintText.includes("اللائحة التنفيذية م31"));
  const other = buildMinistrySection("attendance", { lane: "employee", today: D, data: {}, employee: { id: "e_noor", profile: { gender: "female" } } }).rows.find((r) => r.key === "labour-154");
  assert.equal(other.level, "info", "another female worker — for reference");
  assert.equal(other.pill, "للعلم");
  assert.ok(!buildMinistrySection("attendance", { lane: "employee", today: D, data: {}, employee: MAN }).rows.some((r) => r.key === "labour-154"), "a man's panel stays clear");
  const manage = buildMinistrySection("attendance", { lane: "manage", today: D, data: {}, people: [END, SPLIT, MAN, { id: "e_noor", profile: { gender: "female" } }] }).rows.find((r) => r.key === "labour-154");
  assert.equal(manage.pill, "2 عاملة مرضع في النطاق");
  assert.equal(manage.level, "met");
  const none = buildMinistrySection("attendance", { lane: "manage", today: D, data: {}, people: [MAN, { id: "e_noor", profile: { gender: "female" } }] }).rows.find((r) => r.key === "labour-154");
  assert.equal(none.pill, "0 عاملة مرضع في النطاق");
  assert.equal(none.level, "info");
  assert.ok(!buildMinistrySection("attendance", { lane: "manage", today: D, data: {}, people: [MAN] }).rows.some((r) => r.key === "labour-154"), "an all-male scope has no row");
  assert.ok(!mine.rows.some((r) => (r.cites || []).some((c) => ["regs:9", "regs:11", "regs:16 مكرر", "model:7", "model:13"].includes(`${c.source}:${c.article}`))), "the excluded cites stay out");
  console.log("PASS law panel — Art. 154 · Regs Art. 31 (her lane, others, management count)");
}

/* ── 9. server twin parity ── */
{
  const people = [START, END, SPLIT, MAN, nurse({ start: 45, mid: 30, end: 45 }), nurse({ start: 0, mid: 40, end: 0 }), nurse({ start: 0, mid: 0, end: MINS }, { until: "" })];
  for (const who of people) {
    for (const day of [D, "2027-05-31", "2027-06-01", "2025-08-31"]) {
      assert.deepEqual(twinNursing.nursingHourOn(who, day), nursingHourOn(who, day), `nursingHourOn twin ${who.id} ${day}`);
    }
  }
  const cases = [["07:00", "15:00"], ["08:00", "16:00"], ["07:30", "15:30"], ["08:00", "17:30"], ["07:45", "15:20"], ["07:00", "16:00"]];
  for (const who of people) {
    for (const [checkIn, checkOut] of cases) {
      const a = deriveActualDuty({ checkIn, checkOut, shift: SHIFT, onDate: D, employee: who });
      const b = twinReports.deriveActualDutyCore({ checkIn, checkOut, shift: SHIFT, onDate: D, employee: who });
      for (const k of ["lateMinutes", "workedMinutes", "presenceWorkedMinutes", "nursingCreditMinutes", "ordinaryMinutes", "overtimeMinutes"]) {
        assert.equal(b[k], a[k], `deriveActualDuty twin ${k} ${who.id} ${checkIn}–${checkOut}`);
      }
      const ta = deriveTimesheetDay({ date: D, checkIn, checkOut }, { shift: SHIFT, employee: who });
      const tb = twinReports.deriveTimesheetDay({ date: D, checkIn, checkOut }, { shift: SHIFT, employee: who });
      for (const k of ["lateMinutes", "earlyMinutes", "ordinaryMinutes", "overtimeMinutes", "nursingCreditMinutes"]) {
        assert.equal(tb[k], ta[k], `timesheet twin ${k} ${who.id} ${checkIn}–${checkOut}`);
      }
      const sa = deriveDayStatus({ checkIn, checkOut, date: D }, { shiftStart: "07:00", shiftMinutes: 540, employee: who });
      const sb = twinAtt.deriveDayStatus({ checkIn, checkOut, date: D }, { shiftStart: "07:00", shiftMinutes: 540, employee: who });
      assert.deepEqual(sb, sa, `deriveDayStatus twin ${who.id} ${checkIn}–${checkOut}`);
    }
  }
  // Server overtime on a closed day: the same as the client — nursing adds none.
  const row = { checkInAt: `${D}T07:00:00+03:00`, checkOutAt: `${D}T15:00:00+03:00` };
  const srv = twinOt.readDayOvertimeCore({ row, dayKey: D, shift: SHIFT, employee: END, company: {} });
  assert.equal(srv.auto.overtimeMinutes, 0);
  assert.equal(srv.auto.ordinaryMinutes, 420, "the core reads the punches; the client adds the credit to ordinary");
  // The excuses the cloud check-in / checkout read.
  assert.equal(twinNursing.nursingStartExcuse(START, D), MINS);
  assert.equal(twinNursing.nursingEndExcuse(END, D), MINS);
  assert.equal(twinNursing.nursingStartExcuse(MAN, D), 0);
  console.log("PASS server twins agree (nursingHourOn · deriveActualDutyCore · timesheet · deriveDayStatus · overtime)");
}

console.log("test-nursing-hour: all passed");
