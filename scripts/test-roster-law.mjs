/** Roster / hours law — items from the roster audit (Arts 17, 98, 100, 101, 103–108, 161–166; Regs 22–23; 18632; 3337). */
import assert from "node:assert/strict";
import {
  checkShiftChangeApplyGate,
  checkWeekPublishGates,
  employeeRosterOtContext,
  holidayWorkOn,
  isRosterLeaveDay,
  leaveOnDayView,
  ramadanUsesDailySixCap,
  weekNamedOvertime,
} from "../src/lib/shiftWeek.js";
import {
  art108CategoryOf,
  art108Limits,
  checkThreeWeekAverageGate,
  deriveNamedOvertime,
  hoursBasisOf,
} from "../src/lib/laborHoursPolicy.js";
import { checkConsecutiveWorkGate } from "../src/lib/shiftDerivations.js";
import { checkConsecutiveWorkGate as checkConsecutiveWorkGateTs, checkPublishGates } from "../base44/shared/shiftDerivations.ts";
import { checkOtDayWeekGate, checkRaiseOtAssignmentGate } from "../src/lib/overtimeAssignment.js";
import { checkOtDayWeekGate as checkOtDayWeekGateTs } from "../base44/shared/otLimits.ts";
import { checkPunchRecordGate } from "../src/lib/attendancePunch.js";
import { checkOtDecisionGate } from "../src/lib/attendanceDerivations.js";
import { deriveActualDuty } from "../src/lib/actualDuty.js";
import { planOtDecision, stampActualOvertime, stampHolidayWorkOvertime } from "../src/lib/otDecisionPlan.js";
import { DECISION_18632 } from "../src/lib/decision18632.js";
import { DECISION_18632 as DECISION_18632_TS } from "../base44/shared/decision18632.ts";
import { juvenileDocGaps } from "../src/lib/ministryExtras.js";

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed += 1; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); passed += 1; };
const gate = (g, id) => g.checks.find((row) => row.id === id);

const MORN = { id: "morn", label: "صباحي", start: "07:00", end: "15:00", restMinutes: 30 };
const NGT = { id: "ngt", label: "ليلي", start: "23:00", end: "07:00", restMinutes: 30 };
const LONG = { id: "long", label: "طويل", start: "07:00", end: "19:00", restMinutes: 0 };
const NINE = { id: "nine", label: "تسع", start: "07:00", end: "16:30", restMinutes: 30 };
const SHORT = { id: "short", label: "قصير", start: "07:00", end: "11:00", restMinutes: 0 };
const types = [MORN, NGT, LONG, NINE, SHORT];
const person = (id, name, profile = {}, extra = {}) => ({ id, name, stationId: "st", profile, ...extra });
const week = (schedule, employees, weekStart, extra = {}) => checkWeekPublishGates({ schedule: { stationId: "st", shiftTypes: types, ...schedule }, employees, weekStart, stationId: "st", ar: true, ...extra });

/* ======================= 1. Server publish gate parity (18632 / juveniles / 3337) ======================= */
{
  const assignments = {
    "2026-07-12": { ngt: ["e1"] },
    "2026-07-13": { morn: ["e1", "e4", "e10"] },
    "2026-07-14": { ngt: ["e2", "e5", "e8"] },
    "2026-07-15": { ngt: ["e3"], morn: ["e6"] },
    "2026-07-16": { morn: ["e7"] },
  };
  // e8: fourteen dated night weeks before — past the 3-month rotation with no consent.
  for (let w = 1; w <= 14; w += 1) {
    const d = new Date(2026, 6, 14 - 7 * w);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    assignments[key] = { ngt: ["e8"] };
  }
  const employees = [
    person("e1", "عمر"),
    person("e2", "سارة", { pregnant: "yes", expectedBirthDate: "2026-10-01", gender: "female" }),
    person("e3", "علي", { nightAvoid: { from: "2026-07-01" } }),
    person("e4", "حدث أ", { birthDate: "2010-03-01" }),
    person("e5", "حدث ب", { birthDate: "2010-03-01" }),
    person("e6", "فهد"),
    person("e7", "بدر"),
    person("e8", "خالد"),
    person("e10", "صغير", { birthDate: "2013-01-01" }),
  ];
  const schedule = {
    stationId: "st",
    shiftTypes: types,
    assignments,
    sunExposure: { "2026-07-15": { e6: "field" } },
    sunExposureDefault: { e1: "office", e4: "office", e10: "office", e2: "office", e3: "office", e5: "office", e8: "office" },
  };
  const client = checkWeekPublishGates({ schedule, employees, weekStart: "2026-07-12", stationId: "st", ar: true, today: "2026-07-12" });
  const server = checkPublishGates({
    year: 2026,
    monthIndex: 6,
    shiftTypes: types,
    assignments,
    employees,
    schedule,
    today: "2026-07-12",
  });
  const ids = ["night_rest", "night_rotate", "night_compensate", "night_performer_comp", "night_pregnancy", "night_medical", "night_facilities", "juvenile_age", "juvenile_night", "juvenile_hours", "heat_ban", "heat_place"];
  for (const id of ids) {
    const c = gate(client, id);
    const s = server.checks.find((row) => row.id === id);
    ok(c && s, `${id} exists on client and server`);
    eq(`${s.ok}/${s.block !== false}`, `${c.ok}/${c.block !== false}`, `parity ${id}: server ${s.ok} vs client ${c.ok}`);
    eq(c.ok, false, `${id} fires in the fixture`);
  }
  eq(server.blocked, true, "server publish blocked");
  const names = (id) => server.checks.find((row) => row.id === id)?.labelAr || "";
  ok(names("night_rest").includes("عمر"), "server names the night-rest worker");
  ok(names("night_pregnancy").includes("سارة"), "server names the pregnant worker");
  ok(names("night_medical").includes("علي"), "server names the nightAvoid worker");
  ok(names("juvenile_hours").includes("حدث أ"), "juvenile hours named");
  ok(names("juvenile_night").includes("حدث ب"), "juvenile night named");
  ok(names("juvenile_age").includes("صغير"), "under-age named");
  ok(names("night_rotate").includes("خالد"), "rotation named");
  ok(names("heat_ban").includes("فهد") && !names("heat_ban").includes("بدر"), "3337 exposed named per person");
  ok(names("heat_place").includes("بدر"), "3337 unmarked named per person");

  // Clean month: every block passes on both sides.
  const cleanSched = { stationId: "st", shiftTypes: types, assignments: { "2026-07-13": { short: ["c1"] } }, nightFirstAidReady: true };
  const cleanEmp = [person("c1", "سليم")];
  const c2 = checkWeekPublishGates({ schedule: cleanSched, employees: cleanEmp, weekStart: "2026-07-12", stationId: "st", ar: true, today: "2026-07-12" });
  const s2 = checkPublishGates({ year: 2026, monthIndex: 6, shiftTypes: types, assignments: cleanSched.assignments, employees: cleanEmp, schedule: cleanSched, today: "2026-07-12" });
  for (const id of ids) {
    eq(`${s2.checks.find((row) => row.id === id)?.ok}`, `${gate(c2, id)?.ok}`, `clean parity ${id}`);
  }
}

/* ======================= 2. Art. 107(3) — holiday work ======================= */
{
  const NATIONAL = "2026-09-23";
  const sched = { stationId: "st", shiftTypes: types, assignments: { [NATIONAL]: { morn: ["h1"] } } };
  const h1 = person("h1", "هشام");
  eq(checkShiftChangeApplyGate({ schedule: sched, employee: h1, dateKey: NATIONAL, shiftTypeId: "morn" }).error, "HOLIDAY_WORK_CONFIRM", "holiday duty needs the named confirmation");
  ok(/عمل في العطلة — ساعاته إضافي \(م107\/3\)/.test(checkShiftChangeApplyGate({ schedule: sched, employee: h1, dateKey: NATIONAL, shiftTypeId: "morn" }).reason), "confirmation copy names Art. 107(3)");
  eq(checkShiftChangeApplyGate({ schedule: sched, employee: h1, dateKey: NATIONAL, shiftTypeId: "morn", holidayWorkConfirmed: true }).ok, true, "confirmed holiday work is allowed");
  eq(checkShiftChangeApplyGate({ schedule: sched, employee: person("j", "حدث", { birthDate: "2010-01-01" }), dateKey: NATIONAL, shiftTypeId: "morn", holidayWorkConfirmed: true }).error, "JUVENILE_REST_BAN", "Art. 164: no juvenile on a holiday");
  eq(checkShiftChangeApplyGate({ schedule: sched, employee: h1, dateKey: NATIONAL, shiftTypeId: null }).ok, true, "rest on a holiday is fine");
  const worked = { ...h1, holidayWork: { [NATIONAL]: { confirmedAt: "2026-09-01" } } };
  eq(isRosterLeaveDay(h1, NATIONAL), true, "unconfirmed holiday stays roster leave");
  eq(isRosterLeaveDay(worked, NATIONAL), false, "confirmed holiday is duty");
  eq(leaveOnDayView(worked, NATIONAL), null, "confirmed holiday is not painted as leave");
  ok(holidayWorkOn(worked, NATIONAL), "holidayWorkOn reads the file");
  const named = weekNamedOvertime(sched, worked, NATIONAL, {}, undefined, true);
  const hol = named.rows.find((row) => row.kind === "holiday");
  eq(hol?.overtimeMinutes, 450, "every holiday hour is overtime (7.5h actual)");
  eq(hol?.holiday, true, "row flagged holiday for payroll");
  const g = week(sched, [worked], NATIONAL, { today: "2026-09-20" });
  eq(`${gate(g, "holiday_work_107")?.ok}/${gate(g, "holiday_work_107")?.block}`, "false/false", "holiday work is named, not blocked");
  eq(gate(g, "official_holiday")?.ok, true, "official_holiday no longer blocks a confirmed duty");
  ok(gate(g, "overtime_107")?.ok === false, "overtime_107 names the holiday hours");
  const draft = { employees: [worked], otDecisions: {} };
  const stamped = stampHolidayWorkOvertime(draft, sched, NATIONAL);
  eq(stamped, [`h1:${NATIONAL}`], "publish stamps the holiday day");
  const entry = draft.otDecisions[`h1:${NATIONAL}`];
  eq(`${entry.holiday}/${entry.decision}/${entry.overtimeMinutes}`, "true/pending/450", "otDecisions entry: holiday, pending pay, minutes");
  draft.otDecisions[`h1:${NATIONAL}`] = { ...entry, decision: "approve" };
  stampHolidayWorkOvertime(draft, sched, NATIONAL);
  eq(draft.otDecisions[`h1:${NATIONAL}`].decision, "approve", "a decided entry is never rewritten");
  const punch = checkPunchRecordGate({ type: "manual_punch", employee: h1, date: NATIONAL, time: "07:00", reason: "عمل العطلة" });
  eq(`${punch.ok}/${punch.overtimeAll}`, "true/true", "a holiday punch is recorded as all-overtime");
  eq(checkPunchRecordGate({ type: "manual_punch", employee: person("j", "حدث", { birthDate: "2010-01-01" }), date: NATIONAL, time: "07:00", reason: "عمل العطلة" }).error, "JUVENILE_REST_BAN", "juvenile punch on a holiday blocked");
  eq(deriveNamedOvertime({ days: [{ key: NATIONAL, hours: 8, holiday: true }], employee: h1 }).rows[0].kind, "holiday", "deriveNamedOvertime holiday branch is reachable");
}

/* ======================= 3. Art. 108 + Regs Art. 23 categories ======================= */
{
  eq(art108Limits(person("g", "حارس", { hoursCategory108: "guard" }), "2026-10-12").dayHours, 12, "guard 12h");
  eq(art108Limits(person("g", "حارس", { hoursCategory108: "guard" }), "2026-03-01").dayHours, 10, "guard 10h in Ramadan 1447");
  eq(art108Limits(person("i", "متقطع", { hoursCategory108: "intermittent" }), "2026-10-12").dayHours, 10, "intermittent 10h");
  eq(art108Limits(person("i", "متقطع", { hoursCategory108: "intermittent" }), "2026-10-12").workplaceHours, 14, "intermittent: 10 continuous rest hours in 24");
  eq(art108Limits(person("c", "نظافة", { hoursCategory108: "cleaner" }), "2026-10-12").consecutiveHours, 6, "cleaner 6 consecutive");
  eq(art108Limits(person("p", "تجهيز", { hoursCategory108: "preparatory" }), "2026-10-12").dayHours, 8.5, "preparatory 15 + 15 min");
  eq(art108CategoryOf(person("l", "قديم", { hoursExempt108: true })), { category: "", legacy: true }, "legacy boolean asks for a category");
  const sched = { assignments: { "2026-10-12": { long: ["a"] } } };
  const guard = week(sched, [person("a", "حارس", { hoursCategory108: "guard" })], "2026-10-11");
  eq(`${gate(guard, "hours_106")?.ok}/${gate(guard, "workplace")?.ok}/${gate(guard, "rest_5h")?.ok}`, "true/true/true", "guard 12h shift passes his own ceilings");
  const plain = week(sched, [person("a", "عادي")], "2026-10-11");
  eq(`${gate(plain, "hours_106")?.ok}/${gate(plain, "rest_5h")?.ok}`, "false/false", "the same 12h shift fails for an ordinary worker");
  const cleaner = week({ assignments: { "2026-10-12": { cl: ["a"] } }, shiftTypes: [{ id: "cl", start: "07:00", end: "14:00", restMinutes: 0 }] }, [person("a", "نظافة", { hoursCategory108: "cleaner" })], "2026-10-11");
  eq(gate(cleaner, "rest_5h")?.ok, false, "cleaner: 7 consecutive hours > 6");
  const legacy = week(sched, [person("a", "قديم", { hoursExempt108: true })], "2026-10-11");
  eq(`${gate(legacy, "art108_category")?.ok}/${gate(legacy, "art108_category")?.block}`, "false/false", "legacy flag warns");
}

/* ======================= 4–7. Arts 100, 105, 103, 17 on the publish gate ======================= */
{
  const nineWeek = {};
  for (const d of ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-17"]) nineWeek[d] = { nine: ["a"] };
  const prior = { "2026-10-04": { short: ["a"] }, "2026-09-27": { short: ["a"] } };
  const emp = [person("a", "أحمد")];
  const plain = week({ assignments: { ...nineWeek, ...prior } }, emp, "2026-10-11");
  eq(gate(plain, "hours_48")?.ok, false, "54h week fails Art. 98 per week");
  const rot = { hoursPolicy: { rotatingShifts: true, art100ApprovalNo: "100-77", art100ApprovalDate: "2026-01-10" } };
  const avg = week({ assignments: { ...nineWeek, ...prior } }, emp, "2026-10-11", { company: rot });
  eq(gate(avg, "hours_48")?.ok, true, "Art. 100: (54 + 4 + 4) / 3 within 48 with the Ministry approval");
  const noApproval = week({ assignments: { ...nineWeek, ...prior } }, emp, "2026-10-11", { company: { hoursPolicy: { rotatingShifts: true } } });
  eq(`${gate(noApproval, "hours_48")?.ok}/${gate(noApproval, "art100_approval")?.ok}`, "false/false", "rotation without approval stays per week + warns");
  eq(checkThreeWeekAverageGate({ weekHours: [60, 60, 50], onDate: "2026-10-11", company: rot }).error, "ARTICLE_100_AVERAGE", "average above 48 blocked");

  const seven = {};
  for (let i = 11; i <= 17; i += 1) seven[`2026-10-${i}`] = { short: ["a"] };
  eq(gate(week({ assignments: seven }, emp, "2026-10-11"), "weekly_rest")?.ok, false, "seven days without rest blocks (Art. 104)");
  const bank = { hoursPolicy: { remoteRestBank105: true, art105WorkerConsent: true, art105MinistryConsent: true } };
  eq(gate(week({ assignments: seven }, emp, "2026-10-11", { company: bank }), "weekly_rest")?.ok, true, "Art. 105 banked rest with consents passes");
  eq(gate(week({ assignments: seven }, emp, "2026-10-11", { company: { hoursPolicy: { remoteRestBank105: true } } }), "weekly_rest")?.ok, false, "Art. 105 without consents still blocks");

  const noBreak = { assignments: { "2026-10-12": { nb: ["a"] } }, shiftTypes: [{ id: "nb", start: "07:00", end: "15:00", restMinutes: 0 }] };
  eq(gate(week(noBreak, emp, "2026-10-11"), "rest_5h")?.ok, false, "8h without break fails Art. 101");
  eq(gate(week(noBreak, emp, "2026-10-11", { company: { hoursPolicy: { continuousWork103: true } } }), "rest_5h")?.ok, true, "Art. 103 continuous work: rest organised during work");
  ok(/المادة 103/.test(gate(week({ assignments: { "2026-10-12": { short: ["a"] } } }, emp, "2026-10-11", { company: { hoursPolicy: { continuousWork103: true } } }), "rest_5h")?.note), "Art. 103 shown on the gate");

  const posting = week({ assignments: { "2026-10-12": { short: ["a"] } } }, emp, "2026-10-11");
  eq(`${gate(posting, "work_posting")?.ok}/${gate(posting, "work_posting")?.error}`, "true/null", "Art. 17 is shown for information only — no warning");
  eq(gate(week({ assignments: { "2026-10-12": { short: ["a"] } } }, emp, "2026-10-11", { company: { hoursPolicy: { workPosting: { posted: true, postedAt: "2026-01-01" } } } }), "work_posting")?.ok, true, "posted table passes");
}

/* ======================= 8–9. Art. 98 basis and per-person off days ======================= */
{
  eq(hoursBasisOf({ hoursPolicy: { hoursBasis: "weekly" } }, person("a", "أ")).basis, "weekly", "company basis");
  eq(hoursBasisOf({ hoursPolicy: { hoursBasis: "weekly" }, stations: [{ id: "st", hoursBasis: "daily" }] }, person("a", "أ")).source, "station", "site basis beats company");
  eq(hoursBasisOf({ hoursPolicy: { hoursBasis: "weekly" } }, person("a", "أ", { hoursBasis: "daily" })).basis, "daily", "file basis beats site");
  const days = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"].map((key) => ({ key, hours: 9, restDay: false }));
  eq(deriveNamedOvertime({ days, employee: person("a", "أ"), company: { hoursPolicy: { hoursBasis: "daily" } } }).totalHours, 5, "daily basis: 1h a day over 8");
  eq(deriveNamedOvertime({ days, employee: person("a", "أ"), company: { hoursPolicy: { hoursBasis: "weekly" } } }).totalHours, 0, "weekly basis: 45h within 48 is no overtime (Art. 107(2))");
  eq(ramadanUsesDailySixCap(LONG, "2026-03-01", person("a", "أ"), { hoursPolicy: { hoursBasis: "weekly" } }), false, "weekly basis: Ramadan reads 36 a week");
  eq(ramadanUsesDailySixCap(MORN, "2026-03-01", person("a", "أ"), { hoursPolicy: { hoursBasis: "daily" } }), true, "daily basis: Ramadan reads 6 a day");

  // 2026-10-16 is Friday, 2026-10-17 Saturday. This worker's own rest is Saturday only.
  const satRest = person("a", "أ", { weeklyOffDows: [6] });
  const sched = { stationId: "st", shiftTypes: types, assignments: { "2026-10-16": { short: ["a"] }, "2026-10-17": { short: ["a"] } } };
  const named = weekNamedOvertime(sched, satRest, "2026-10-11", {}, undefined, true);
  eq(named.rows.filter((row) => row.kind === "weekly_rest").map((row) => row.dateKey), ["2026-10-17"], "OT reads the person's own off day, not the company Friday");
  const g = week(sched, [satRest], "2026-10-11");
  eq(g.overtimeNamed?.[0]?.hours, named.totalHours, "publish gate and OT board agree");
}

/* ======================= 10. Actual punches ======================= */
{
  const shift = { start: "07:00", end: "15:30", restMinutes: 30 };
  const a = deriveActualDuty({ checkIn: "07:00", checkOut: "20:00", shift, onDate: "2026-10-12", employee: person("a", "أ") });
  eq(`${a.workedMinutes}/${a.overtimeMinutes}`, "750/270", "13h presence − 30 rest = 12.5h worked, 4.5h past the 8h day");
  ok(a.flags.some((f) => f.error === "ACTUAL_PRESENCE_OVER_CAP"), "presence > 12h flagged (Art. 101)");
  ok(a.flags.some((f) => f.error === "ACTUAL_WORK_OVER_CAP"), "work > 10h flagged (Art. 106)");
  const nb = deriveActualDuty({ checkIn: "07:00", checkOut: "13:00", shift, onDate: "2026-10-12", employee: person("a", "أ"), breaks: [] });
  ok(nb.flags.some((f) => f.error === "ACTUAL_NO_BREAK"), "six hours with no recorded break flagged");
  const late = deriveActualDuty({ checkIn: "09:00", checkOut: "17:30", shift: { start: "09:00", end: "17:30", restMinutes: 30 }, onDate: "2026-10-12", employee: person("a", "أ") });
  eq(`${late.lateMinutes}/${late.overtimeMinutes}`, "0/0", "read against the rostered 09:00 start, not 07:00");
  eq(checkOtDecisionGate({ overtimeMinutes: 60, decision: "reject", workedProven: true, onDate: "2026-10-12" }).error, "OT_WORKED_NO_REJECT", "worked overtime cannot be rejected");
  eq(checkOtDecisionGate({ overtimeMinutes: 60, decision: "approve", workedProven: true, onDate: "2026-10-12" }).ok, true, "pay remains open");
  const draft = { employees: [person("a", "أ")], schedules: [{ stationId: "st", shiftTypes: [{ id: "s", ...shift }], assignments: { "2026-10-12": { s: ["a"] } } }], otDecisions: {} };
  const row = { employeeId: "a", date: "2026-10-12", checkInAt: "07:00", checkOutAt: "18:00" };
  stampActualOvertime(draft, draft.employees[0], "2026-10-12", row);
  const e = draft.otDecisions["a:2026-10-12"];
  eq(`${e.decision}/${e.overtimeMinutes}/${e.workedProven}/${e.source}`, "pending/150/true/actual_punch", "actual OT fed to otDecisions for the manager");
  eq(planOtDecision(draft, "a", "2026-10-12", { decision: "reject", overtimeMinutes: 150 }).error, "OT_WORKED_NO_REJECT", "manager plan refuses rejection of proven hours");
  eq(planOtDecision(draft, "a", "2026-10-12", { decision: "approve", overtimeMinutes: 60 }).entry.overtimeMinutes, 150, "the proven minutes win over a smaller figure");
}

/* ======================= 11. Overtime assignment against the roster ======================= */
{
  for (const [fn, label] of [[checkOtDayWeekGate, "client"], [checkOtDayWeekGateTs, "server"]]) {
    eq(fn({ hours: 2, date: "2026-10-12", presenceHours: 11 }).error, "OT_WORKPLACE_STAY", `${label}: 11h stay + 2h passes the 12h presence cap for any assignment`);
    eq(fn({ hours: 2, date: "2026-10-12", presenceHours: 8.5 }).ok, true, `${label}: 8.5 + 2 within 12`);
    eq(fn({ hours: 2, date: "2026-10-12", article106: true, ordinaryHours: 9, presenceHours: 9.5 }).error, "ART106_DAY_CAP", `${label}: 9 actual + 2 > 10 (Art. 106)`);
    eq(fn({ hours: 6, date: "2026-10-12", dateTo: "2026-10-14", article106: true, ordinaryHours: 7, presenceHours: 7.5, rosterWeekHours: 56 }).error, "ART106_WEEK_CAP", `${label}: rostered 56 + 6 > 60`);
  }
  const ctx = employeeRosterOtContext([{ stationId: "st", shiftTypes: types, assignments: { "2026-10-12": { long: ["a"] }, "2026-10-13": { morn: ["a"] } } }], person("a", "أ"), "2026-10-12");
  eq(`${ctx.presenceHours}/${ctx.ordinaryHours}/${ctx.rosterWeekHours}`, "12/12/19.5", "roster context: stay, actual, week");
}

/* ======================= 13. Low items ======================= */
{
  eq(DECISION_18632.hijriFrom, "1441-05-06", "18632 from 6 Jumada I 1441 = 2020-01-01");
  eq(DECISION_18632_TS.hijriFrom, "1441-05-06", "backend twin");
  const twoBreaks = { start: "07:00", end: "19:00", breaks: [{ start: "11:00", end: "11:30" }, { start: "15:30", end: "16:00" }], onDate: "2026-10-12" };
  eq(checkConsecutiveWorkGate(twoBreaks).ok, true, "12h with two placed breaks: 4 / 4 / 3 hours");
  eq(checkConsecutiveWorkGateTs(twoBreaks).ok, true, "backend twin agrees");
  eq(checkConsecutiveWorkGate({ start: "07:00", end: "19:00", restMinutes: 60, onDate: "2026-10-12" }).ok, false, "one 60-min break leaves 5.5h blocks");
  eq(checkConsecutiveWorkGate({ start: "07:00", end: "19:00", restMinutes: 60, breakCount: 2, onDate: "2026-10-12" }).ok, true, "two 30-min breaks split 11h into three");
  eq(checkConsecutiveWorkGate({ start: "07:00", end: "19:00", breaks: [{ start: "12:00", end: "12:15" }], onDate: "2026-10-12" }).error, "REST_5H_REQUIRED", "a 15-min break is not a rest «in one go»");
  const gaps = juvenileDocGaps(person("j", "حدث", { guardianFullName: "محمد" })).map((g) => g.key);
  ok(gaps.includes("guardianFullName") && gaps.includes("juvenileResidence"), "Art. 166 register: guardian full name + residence required");
  eq(juvenileDocGaps(person("j", "حدث", { juvenileIdDoc: true, juvenileFitnessCert: true, juvenileGuardianConsent: true, juvenileOfficeNotifiedAt: "2026-09-01", guardianFullName: "محمد بن سالم", juvenileResidence: "الرس" })).length, 0, "complete register");
  // Regs Art. 22 — the worker's consent, not the manager's.
  const raise = checkRaiseOtAssignmentGate({ reason: "ضغط", hours: 8, date: "2026-10-12", overtimeHoursYtd: 720, annualCapConsent: true });
  eq(`${raise.ok}/${raise.capConsentRequested}`, "true/true", "the manager raise records «consent requested»");
  const live = { employees: [person("a", "أ")], otDecisions: { "a:2026-01-05": { decision: "approve", overtimeMinutes: 720 * 60 } } };
  const plan = planOtDecision(live, "a", "2026-10-12", { decision: "approve", overtimeMinutes: 60, annualCapConsent: true });
  eq(`${plan.ok}/${plan.entry.decision}`, "true/pending_worker_cap_consent", "a manager decision past 720h waits for the worker");
  live.otDecisions["a:2026-10-12"] = { ...plan.entry, workerCapConsentAt: "2026-10-13T08:00:00Z" };
  eq(planOtDecision(live, "a", "2026-10-12", { decision: "approve", overtimeMinutes: 60 }).entry.decision, "approve", "after the worker accepts, the decision goes through");
}

console.log(`test-roster-law: ${passed} assertions passed`);
