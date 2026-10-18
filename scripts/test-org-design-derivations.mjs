/**
 * Org design — structure derivations: seat state & code, unit levels, span of control & layers,
 * the org health list (vacancy days, acting over limit, succession, unseated/unmanaged people,
 * Qiwa title, Saudi-only seats, headcount budget, one-person units, circular reporting) and the
 * headcount plan with Saudization by unit. Every figure is derived; nothing is stored.
 */
import assert from "node:assert/strict";
import {
  actingReminders,
  checkOrgSettingsGate,
  deriveHeadcountPlan,
  deriveOrgHealth,
  deriveSpanLayers,
  reportingCycles,
  seatCode,
  seatState,
  stationCycles,
  unitLevel,
  ORG_DESIGN_DEFAULTS,
} from "../src/lib/orgDesign.js";

const DAY = "2026-10-16";

export function fixture() {
  return {
    ownerId: "o",
    stations: [
      { id: "hq", name: "المنشأة", isCompanyRoot: true, managerId: "o" },
      { id: "kh", name: "فرع الخفجي", parentStationId: "hq", managerId: "m", headcountBudget: 2, code: "KHF" },
      { id: "ops", name: "قسم التشغيل", parentStationId: "kh", orgLevel: "department", headcountBudget: 4 },
      { id: "rb", name: "فرع رابغ", parentStationId: "hq" },
    ],
    employees: [
      { id: "o", name: "نيار", role: "director", stationId: "hq", profile: { nationality: "سعودي" } },
      { id: "m", name: "أحمد", role: "employee", stationId: "kh", profile: { nationality: "سعودي" } },
      { id: "w1", name: "عمر", role: "employee", stationId: "ops", profile: { nationality: "مصري", qiwaTitle: "فني كهرباء" } },
      { id: "w2", name: "حسن", role: "employee", stationId: "ops", profile: { nationality: "سعودي" } },
      { id: "r1", name: "نورة", role: "employee", stationId: "rb", profile: { nationality: "سعودية" } },
      {
        id: "a1", name: "سارة", role: "employee", stationId: "kh", profile: {},
        actingAssignments: [{ id: "act1", seatId: "s_rb_mgr", stationId: "rb", from: "2026-06-01", until: "2026-10-20" }],
      },
      { id: "gone", name: "سابق", stationId: "kh", active: false },
    ],
    orgSeats: [
      { id: "s_m", title: "مشرف تشغيل", stationId: "kh", employeeId: "m", createdAt: "2026-01-01" },
      { id: "s_w1", title: "فني ميداني", stationId: "ops", employeeId: "w1", saudiOnly: true, createdAt: "2026-01-02" },
      { id: "s_w2", title: "فني ميداني", stationId: "ops", employeeId: "w2", createdAt: "2026-01-03" },
      { id: "s_r1", title: "أخصائية", stationId: "rb", employeeId: "r1", createdAt: "2026-01-04" },
      { id: "s_rb_mgr", title: "مدير فرع رابغ", stationId: "rb", employeeId: null, vacatedAt: "2026-07-01" },
      { id: "s_vac", title: "فني", stationId: "ops", employeeId: null, createdAt: "2026-09-26" },
      { id: "s_frz", title: "مخطط", stationId: "ops", employeeId: null, state: "frozen" },
      { id: "s_pln", title: "مهندس", stationId: "ops", employeeId: null, state: "planned", plannedFrom: "2026-12-01" },
      { id: "s_pln_due", title: "مهندس ب", stationId: "ops", employeeId: null, state: "planned", plannedFrom: "2026-10-01" },
    ],
  };
}

/* seat state & code */
const data = fixture();
const seat = (id) => data.orgSeats.find((s) => s.id === id);
assert.equal(seatState(seat("s_m"), data, DAY), "filled");
assert.equal(seatState(seat("s_vac"), data, DAY), "vacant");
assert.equal(seatState(seat("s_frz"), data, DAY), "frozen");
assert.equal(seatState(seat("s_pln"), data, DAY), "planned", "planned until its start date");
assert.equal(seatState(seat("s_pln_due"), data, DAY), "vacant", "a planned seat whose date came is an open vacancy");
assert.equal(seatCode(seat("s_m"), data), "KHF-001", "unit code + order");
assert.equal(seatCode({ ...seat("s_m"), code: "X-9" }, data), "X-9", "stored code wins");

/* unit levels */
const st = (id) => data.stations.find((s) => s.id === id);
assert.equal(unitLevel(st("hq"), data.stations), "company");
assert.equal(unitLevel(st("kh"), data.stations), "branch");
assert.equal(unitLevel(st("ops"), data.stations), "department");
assert.equal(unitLevel({ id: "x", parentStationId: "ops" }, data.stations), "unit");

/* span & layers */
const span = deriveSpanLayers(data, { ...ORG_DESIGN_DEFAULTS, spanMin: 2, spanMax: 3, maxLayers: 2 }, DAY);
const row = (id) => span.rows.find((r) => r.employeeId === id);
assert.ok(row("m"), "the branch manager leads people");
assert.equal(row("m").directPeople, 3, "أحمد: عمر + حسن (department without its own manager) + سارة");
assert.equal(row("m").directOpen, 2, "open seats in قسم التشغيل (vacant + planned-and-due) count against أحمد; frozen/planned do not");
assert.equal(row("m").verdict, "wide", "5 > spanMax 3");
assert.equal(span.layers, 3);
assert.equal(span.tooDeep, true, "3 layers > maxLayers 2");
const narrow = deriveSpanLayers({ ...data, orgSeats: data.orgSeats.filter((s) => s.id !== "s_vac") }, { ...ORG_DESIGN_DEFAULTS, spanMin: 5 }, DAY);
assert.ok(narrow.rows.some((r) => r.verdict === "narrow"), "a manager below spanMin is narrow");

/* headcount & Saudization */
const plan = deriveHeadcountPlan(data, DAY);
const ops = plan.find((r) => r.stationId === "ops");
assert.equal(ops.actual, 2);
assert.equal(ops.budget, 4);
assert.equal(ops.variance, -2);
assert.equal(ops.filled, 2);
assert.equal(ops.vacant, 2, "s_vac + the due planned seat");
assert.equal(ops.frozen, 1);
assert.equal(ops.planned, 1);
assert.equal(ops.saudi, 1);
assert.equal(ops.nonSaudi, 1);
assert.equal(ops.saudiPct, 50);
const kh = plan.find((r) => r.stationId === "kh");
assert.equal(kh.actual, 2, "أحمد + سارة; inactive people are not counted");
assert.equal(kh.unknown, 1, "سارة has no nationality — unknown, not guessed");
assert.equal(plan.find((r) => r.stationId === "rb").budget, null, "no budget → no variance");

/* health list */
const health = deriveOrgHealth(data, { day: DAY, settings: { ...ORG_DESIGN_DEFAULTS, actingMaxDays: 90, actingRemindDays: 7, vacantAlertDays: 60 } });
const kinds = (k) => health.items.filter((i) => i.kind === k);
assert.equal(kinds("VACANT").length, 3, "vacant seats are listed with their days");
const longVacant = kinds("VACANT").find((i) => i.seatId === "s_rb_mgr");
assert.equal(longVacant.days, 107);
assert.equal(longVacant.tone, "warn", "over vacantAlertDays");
assert.match(longVacant.ar, /سارة/, "a vacancy covered by acting names the person");
assert.equal(kinds("VACANT").find((i) => i.seatId === "s_vac").tone, "info");
assert.equal(kinds("ACTING_OVER_LIMIT").length, 1, "137 days > 90");
assert.equal(kinds("ACTING_OVER_LIMIT")[0].employeeId, "a1");
assert.ok(kinds("NO_DEPUTY").some((i) => i.employeeId === "m"), "a manager without a deputy");
assert.ok(kinds("NO_SEAT").some((i) => i.employeeId === "a1"), "سارة has no seat");
assert.ok(!kinds("NO_SEAT").some((i) => i.employeeId === "o"), "the owner is not flagged unseated");
assert.ok(kinds("QIWA_MISMATCH").some((i) => i.seatId === "s_w1"), "Qiwa «فني كهرباء» vs «فني ميداني»");
assert.ok(kinds("SAUDI_ONLY_BREACH").some((i) => i.seatId === "s_w1"), "Saudi-only seat held by a non-Saudi");
assert.equal(kinds("SAUDI_ONLY_BREACH")[0].tone, "bad");
assert.equal(kinds("OVER_BUDGET").length, 0);
assert.ok(kinds("UNDER_BUDGET").some((i) => i.stationId === "ops"));
assert.ok(kinds("SINGLE_PERSON_UNIT").some((i) => i.stationId === "rb"), "رابغ has one person and no sub-units");
assert.ok(!kinds("SINGLE_PERSON_UNIT").some((i) => i.stationId === "kh"), "a unit with sub-units is not a one-person unit");
assert.equal(health.items[0].tone, "bad", "breaches first");

const over = fixture();
over.stations.find((s) => s.id === "kh").headcountBudget = 1;
assert.ok(deriveOrgHealth(over, { day: DAY }).items.some((i) => i.kind === "OVER_BUDGET" && i.stationId === "kh"));

/* acting reminders */
const ending = fixture();
ending.employees.find((e) => e.id === "a1").actingAssignments[0].from = "2026-09-01";
const reminders = actingReminders(ending, DAY);
assert.equal(reminders.length, 1);
assert.equal(reminders[0].kind, "ACTING_ENDING", "ends 2026-10-20 — inside the 7-day reminder");
assert.match(reminders[0].key, /2026-10$/, "one notice per month per assignment");
const lapsed = fixture();
lapsed.employees.find((e) => e.id === "a1").actingAssignments[0].until = "2026-10-10";
assert.equal(actingReminders(lapsed, DAY).length, 0, "an acting role past its end has ended automatically");

/* circular reporting guard */
const loop = fixture();
loop.employees.find((e) => e.id === "w1").profile.directManagerId = "w2";
loop.employees.find((e) => e.id === "w2").profile.directManagerId = "w1";
loop.orgSeats.find((s) => s.id === "s_w1").reportsToEmployeeId = "w2";
loop.orgSeats.find((s) => s.id === "s_w2").reportsToEmployeeId = "w1";
assert.equal(reportingCycles(loop).length, 1);
assert.ok(deriveOrgHealth(loop, { day: DAY }).items.some((i) => i.kind === "REPORTING_CYCLE" && i.tone === "bad"));
assert.equal(reportingCycles(data).length, 0);
assert.equal(stationCycles([{ id: "a", parentStationId: "b" }, { id: "b", parentStationId: "a" }]).length, 1);

/* thresholds are company settings with named gates */
assert.equal(checkOrgSettingsGate({ spanMin: 9, spanMax: 8 }).error, "ORG_SPAN_ORDER");
assert.equal(checkOrgSettingsGate({ maxLayers: 1 }).error, "ORG_SETTING_RANGE");
assert.equal(checkOrgSettingsGate({ actingRemindDays: 40, actingMaxDays: 30 }).error, "ORG_ACTING_ORDER");
assert.equal(checkOrgSettingsGate({ spanMax: 12 }).settings.spanMax, 12);

console.log("org design derivations: ok");

/* seat register (the «المناصب» table) */
{
  const { deriveSeatRegister } = await import("../src/lib/orgDesign.js");
  const reg = deriveSeatRegister(fixture(), DAY);
  const r = (id) => reg.find((x) => x.seatId === id);
  assert.equal(reg.length, 9);
  assert.equal(r("s_w1").holderName, "عمر");
  assert.equal(r("s_w1").nationality, "non_saudi");
  assert.equal(r("s_w1").qiwaMismatch, true);
  assert.equal(r("s_w1").reportsToName, "أحمد");
  assert.equal(r("s_rb_mgr").state, "vacant");
  assert.equal(r("s_rb_mgr").actingName, "سارة");
  assert.equal(r("s_rb_mgr").daysVacant, 107);
  assert.equal(r("s_rb_mgr").reportsToName, "نيار", "رابغ has no manager → the company head");
  assert.equal(r("s_frz").state, "frozen");
  assert.equal(r("s_frz").daysVacant, 0, "a frozen seat is not counted as waiting");
  console.log("seat register: ok");
}
