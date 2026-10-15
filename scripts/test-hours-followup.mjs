/** Hours follow-up — client fallback publish gate == server (18632 / 161–166 / 3337), roster-based
 *  timesheet (actualDuty), planned roster overtime on the OT board, single «المادة 107» chip. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkPublishGates as checkPublishGatesJs } from "../src/lib/shiftDerivations.js";
import { checkPublishGates as checkPublishGatesTs } from "../base44/shared/shiftDerivations.ts";
import { rosterLawChecks as rosterLawChecksJs } from "../src/lib/rosterLawGates.js";
import { rosterLawChecks as rosterLawChecksTs } from "../base44/shared/rosterLawGates.ts";
import { deriveAttendanceRowDay, deriveTimesheetDay, deriveTimesheetTotals } from "../src/lib/reportsDerivations.js";
import { deriveTimesheetDay as deriveTimesheetDayTs, deriveTimesheetTotals as deriveTimesheetTotalsTs } from "../base44/shared/reportsDerivations.ts";
import { deriveActualDuty } from "../src/lib/actualDuty.js";
import { otDayStatus, plannedOtWeeks, PLANNED_OT_LABEL_AR } from "../src/lib/otDecisionPlan.js";

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed += 1; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); passed += 1; };

const MORN = { id: "morn", label: "صباحي", start: "07:00", end: "15:00", restMinutes: 30 };
const NGT = { id: "ngt", label: "ليلي", start: "23:00", end: "07:00", restMinutes: 30 };
const EVE = { id: "eve", label: "مسائي", start: "15:00", end: "23:00", restMinutes: 30 };
const TEN = { id: "ten", label: "عشر", start: "07:00", end: "17:30", restMinutes: 30 };
const SHORT = { id: "short", label: "قصير", start: "07:00", end: "11:00", restMinutes: 0 };
const types = [MORN, NGT, EVE, TEN, SHORT];
const person = (id, name, profile = {}, extra = {}) => ({ id, name, stationId: "st", profile, ...extra });

/* ======================= 1. Client fallback publish gate == server ======================= */
{
  const assignments = {
    "2026-07-12": { ngt: ["e1"] },
    "2026-07-13": { morn: ["e1", "e4", "e10"] },
    "2026-07-14": { ngt: ["e2", "e5", "e8"] },
    "2026-07-15": { ngt: ["e3"], morn: ["e6"] },
    "2026-07-16": { morn: ["e7"] },
  };
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
  const input = { year: 2026, monthIndex: 6, shiftTypes: types, assignments, employees, schedule, today: "2026-07-12" };
  const client = checkPublishGatesJs(input);
  const server = checkPublishGatesTs(input);
  const strip = (g) => g.checks.map((row) => ({ id: row.id, ok: row.ok, block: row.block !== false, article: row.article || null, labelAr: row.labelAr, labelEn: row.labelEn }));
  eq(strip(client), strip(server), "client fallback checkPublishGates == server for the fixture (every row, labels included)");
  eq(client.blocked, server.blocked, "blocked parity");
  eq(client.failed?.id, server.failed?.id, "first failing check parity");
  const lawIds = ["night_rest", "night_rotate", "night_compensate", "night_performer_comp", "night_pregnancy", "night_medical", "night_facilities", "juvenile_age", "juvenile_night", "juvenile_hours", "heat_ban", "heat_place"];
  for (const id of lawIds) {
    const row = client.checks.find((c) => c.id === id);
    ok(row && row.ok === false, `client fallback now blocks ${id}`);
  }
  ok(client.checks.find((c) => c.id === "heat_ban").labelAr.includes("فهد"), "3337 names the exposed worker on the client");
  ok(client.checks.find((c) => c.id === "juvenile_night").labelAr.includes("حدث ب"), "Art. 163 names the juvenile on the client");
  // The twin itself: same output for the same month.
  const twinIn = { year: 2026, monthIndex: 6, schedule, employees, today: "2026-07-12" };
  eq(JSON.parse(JSON.stringify(rosterLawChecksJs(twinIn))), JSON.parse(JSON.stringify(rosterLawChecksTs(twinIn))), "rosterLawGates.js == rosterLawGates.ts");

  // Clean month passes the same way on both.
  const cleanSched = { stationId: "st", shiftTypes: types, assignments: { "2026-07-13": { short: ["c1"] } }, nightFirstAidReady: true, sunExposureDefault: { c1: "office" } };
  const cleanIn = { year: 2026, monthIndex: 6, shiftTypes: types, assignments: cleanSched.assignments, employees: [person("c1", "سليم")], schedule: cleanSched, today: "2026-07-12" };
  eq(strip(checkPublishGatesJs(cleanIn)), strip(checkPublishGatesTs(cleanIn)), "clean month parity");
  // Art. 103 continuous work on the company policy reaches the client rest_5h check like the server.
  const longType = [{ id: "l", label: "طويلة", start: "07:00", end: "15:00", restMinutes: 0 }];
  const cont = { year: 2026, monthIndex: 9, shiftTypes: longType, assignments: { "2026-10-12": { l: ["c1"] } }, employees: [person("c1", "سليم")], company: { hoursPolicy: { continuousWork103: true } } };
  eq(checkPublishGatesJs(cont).checks.find((c) => c.id === "rest_5h").ok, checkPublishGatesTs(cont).checks.find((c) => c.id === "rest_5h").ok, "Art. 103 parity on rest_5h");
  // Without a schedule the old fallback shape stays (no per-person rows).
  ok(!checkPublishGatesJs({ ...input, schedule: undefined }).checks.some((c) => c.id === "juvenile_age"), "no schedule → no per-person rows (legacy callers)");
}

/* ======================= 2. Timesheet = rostered shift + actualDuty ======================= */
{
  const emp = person("w1", "ماجد");
  // Evening shift 15:00–23:00: arriving 15:05 is on time (the old 07:00 assumption called it 8 h late).
  const eve = deriveTimesheetDay({ date: "2026-10-12", checkIn: "15:05", checkOut: "23:30" }, { shift: EVE, employee: emp, company: {} });
  eq(eve.late, false, "on time against the rostered 15:00 start");
  eq(eve.lateMinutes, 0, "no late minutes");
  eq(eve.restMinutes, 30, "rostered rest deducted (Art. 102)");
  eq(eve.workedMinutes, 475, "worked = presence 505 − rest 30");
  eq(eve.overtimeMinutes, 0, "no overtime under the 8 h day cap");
  eq(eve.rostered, true, "rostered day");
  const duty = deriveActualDuty({ checkIn: "15:05", checkOut: "23:30", shift: EVE, onDate: "2026-10-12", employee: emp, company: {} });
  eq([eve.ordinaryMinutes, eve.overtimeMinutes], [duty.ordinaryMinutes, duty.overtimeMinutes], "timesheet == attendance board's deriveActualDuty");
  const lateEve = deriveTimesheetDay({ date: "2026-10-12", checkIn: "15:30", checkOut: "23:00" }, { shift: EVE, employee: emp, company: {} });
  ok(lateEve.late && lateEve.lateMinutes > 0 && lateEve.lateMinutes <= 30, "late is read against the rostered start");
  // Overnight shift: early departure measured to 07:00 next morning.
  const night = deriveTimesheetDay({ date: "2026-10-12", checkIn: "23:00", checkOut: "06:00" }, { shift: NGT, employee: emp, company: {} });
  eq(night.earlyMinutes, 60, "overnight early departure");
  // Long presence: flags carried from actualDuty.
  const long = deriveTimesheetDay({ date: "2026-10-12", checkIn: "06:00", checkOut: "19:30" }, { shift: MORN, employee: emp, company: {} });
  const codes = long.flags.map((f) => f.error);
  ok(codes.includes("ACTUAL_PRESENCE_OVER_CAP"), "presence > 12 h flagged (Art. 101)");
  ok(codes.includes("ACTUAL_NO_BREAK"), "> 5 h without a break flagged (Art. 101)");
  ok(long.flags.every((f) => f.reason && f.reasonEn && f.article), "flags name their article in both languages");
  ok(long.overtimeMinutes > 0, "overtime beyond the day cap");
  // Unrostered weekly rest day (Friday): all of it is overtime (Art. 107(3)).
  const fri = deriveTimesheetDay({ date: "2026-10-16", checkIn: "08:00", checkOut: "12:00" }, { shift: null, employee: emp, company: {} });
  eq(fri.overtimeMinutes, 240, "weekly rest day → every hour overtime");
  eq(fri.overtimeKind, "weekly_rest", "named as weekly-rest overtime");
  eq(fri.rostered, false, "unrostered");
  // Server twin gives the same figures on plain days.
  const pick = (d) => [d.status, d.lateMinutes, d.ordinaryMinutes, d.overtimeMinutes, d.earlyMinutes, d.workedMinutes, d.restMinutes, (d.flags || []).map((f) => f.error).join(",")];
  const cases = [
    [{ date: "2026-10-12", checkIn: "15:05", checkOut: "23:30" }, EVE],
    [{ date: "2026-10-12", checkIn: "15:30", checkOut: "23:00" }, EVE],
    [{ date: "2026-10-12", checkIn: "23:00", checkOut: "06:00" }, NGT],
    [{ date: "2026-10-12", checkIn: "06:00", checkOut: "19:30" }, MORN],
    [{ date: "2026-10-16", checkIn: "08:00", checkOut: "12:00" }, null],
    [{ date: "2026-10-13", checkIn: "07:00", checkOut: null }, MORN],
    [{ date: "2026-10-14" }, MORN],
  ];
  for (const [p, shift] of cases) {
    eq(pick(deriveTimesheetDayTs(p, { shift, employee: emp, company: {} })), pick(deriveTimesheetDay(p, { shift, employee: emp, company: {} })), `server timesheet == client for ${p.date} ${p.checkIn || "-"}`);
  }
  const tsDays = cases.map(([p, shift]) => deriveTimesheetDayTs(p, { shift, employee: emp, company: {} }));
  const jsDays = cases.map(([p, shift]) => deriveTimesheetDay(p, { shift, employee: emp, company: {} }));
  const totals = deriveTimesheetTotals(jsDays);
  const { ordinaryLabel: _a, overtimeLabel: _b, ...jsT } = totals;
  const { ordinaryLabel: _c, overtimeLabel: _d, ...tsT } = deriveTimesheetTotalsTs(tsDays);
  eq(jsT, tsT, "totals parity");
  eq(totals.presenceOverCap, 1, "totals count presence-over-cap days");
  eq(totals.openCheckouts, 1, "open checkout counted");
  // A stored attendance row reads the roster exactly like stampActualOvertime.
  const data = {
    employees: [emp],
    schedules: [{ stationId: "st", shiftTypes: types, assignments: { "2026-10-12": { eve: ["w1"] } } }],
  };
  const row = deriveAttendanceRowDay({ employeeId: "w1", date: "2026-10-12", check_in_at: "15:05", check_out_at: "23:30" }, data);
  eq(row.shiftId, "eve", "attendance row resolves the rostered evening shift");
  eq([row.late, row.overtimeMinutes, row.workedMinutes], [false, 0, 475], "attendance row figures from the roster");
}

/* ======================= 3. Planned roster overtime on the OT board ======================= */
{
  const today = "2026-10-16"; // week of 2026-10-11 (current) and 2026-10-18 (next)
  const emp = person("p1", "ناصر");
  const other = person("p2", "حمد");
  const assignments = {
    "2026-10-12": { ten: ["p1"] },
    "2026-10-13": { ten: ["p1"], morn: ["p2"] },
    "2026-10-19": { ten: ["p1"] },
  };
  const schedule = {
    stationId: "st",
    shiftTypes: types,
    assignments,
    publishedWeeks: { "2026-10-11": { at: "2026-10-09" }, "2026-10-18": { at: "2026-10-15" } },
  };
  const d = { employees: [emp, other], schedules: [schedule], otDecisions: {} };
  const planned = plannedOtWeeks(d, [emp, other], { today });
  const weeks = planned.filter((g) => g.employeeId === "p1").map((g) => g.weekKey).sort();
  eq(weeks, ["2026-10-11", "2026-10-18"], "current and next week planned overtime shows before any punch");
  ok(!planned.some((g) => g.employeeId === "p2"), "an 8 h day has no planned overtime");
  ok(planned.find((g) => g.weekKey === "2026-10-11").rows.every((r) => r.overtimeMinutes > 0), "planned rows carry the named minutes");
  // A draft (unpublished) week does not show.
  const draft = { ...schedule, publishedWeeks: { "2026-10-11": { at: "2026-10-09" } } };
  ok(!plannedOtWeeks({ ...d, schedules: [draft] }, [emp], { today }).some((g) => g.weekKey === "2026-10-18"), "draft week → not shown");
  // Once punches prove a day, it leaves the plan and becomes a decidable entry.
  const proven = { ...d, otDecisions: { "p1:2026-10-12": { decision: "pending", workedProven: true, overtimeMinutes: 120, source: "actual_punch" } } };
  const after = plannedOtWeeks(proven, [emp], { today }).find((g) => g.weekKey === "2026-10-11");
  ok(!after.rows.some((r) => r.dateKey === "2026-10-12"), "proven day leaves the plan");
  // Day status mirrors planOtDecision.
  eq(otDayStatus(null, "2026-10-19", today), { planned: true, payable: false, closable: false, decided: false }, "roster plan only → planned, not payable");
  eq(otDayStatus({ decision: "pending", holiday: true }, "2026-10-19", today).payable, false, "future planned holiday → not payable (OT_NOT_WORKED_YET)");
  eq(otDayStatus({ decision: "pending", holiday: true }, "2026-10-19", today).closable, true, "planned holiday → closable as not worked");
  eq(otDayStatus({ decision: "pending", workedProven: true }, "2026-10-12", today), { planned: false, payable: true, closable: false, decided: false }, "proven → payable");
  eq(otDayStatus({ decision: "approve" }, "2026-10-12", today).decided, true, "decided stays decided");
  eq(PLANNED_OT_LABEL_AR, "مخطط — لم يُعمل بعد", "planned label");
  const board = readFileSync(new URL("../src/components/schedules/OtDecisionBoard.jsx", import.meta.url), "utf8");
  ok(board.includes("PLANNED_OT_LABEL_AR") && board.includes("item.status.payable"), "board labels planned rows and hides pay until worked");
  const panel = readFileSync(new URL("../src/components/schedules/OtDecisionsPanel.jsx", import.meta.url), "utf8");
  ok(panel.includes("plannedOtWeeks("), "panel adds planned weeks for manage and mine modes");
}

/* ======================= 4. One «المادة 107» chip in the OT board header ======================= */
{
  const board = readFileSync(new URL("../src/components/schedules/OtDecisionBoard.jsx", import.meta.url), "utf8");
  // LawGateAlertRow article="107" is the chip; a bare chip-only cite of hours.ot.premium would repeat it.
  const bareChip = board.match(/<LaborArticleCite ruleId="hours\.ot\.premium" ar=\{ar\} \/>/g) || [];
  eq(bareChip.length, 0, "no second «المادة 107» chip next to the alert row");
  eq((board.match(/article="107"/g) || []).length, 2, "one 107 chip per header (empty + live)");
}

console.log(`test-hours-followup: ${passed} assertions passed`);
