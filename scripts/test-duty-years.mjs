/**
 * test-duty-years.mjs — per-year absence / lateness records and the duty smart search parser.
 * Run: node scripts/test-duty-years.mjs
 */
import assert from "node:assert/strict";
import {
  ART80,
  art80Reading,
  calendarYearWindows,
  contractYearAnchor,
  contractYearWindows,
  dutyRecordStart,
  dutyYears,
  eachDayKey,
  tallyDutyDays,
  windowOf,
} from "../src/lib/dutyYears.js";
import { dutyDayMatches, normalizeDutyText, parseDutyQuery, resolveDutyPeriod } from "../src/lib/dutySearch.js";

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    fail += 1;
    console.log(`FAIL  ${name}\n      ${error.message}`);
  }
}

const day = (key, status, extra = {}) => ({ key, status, lateMinutes: 0, inAt: ["ontime", "late", "manual", "open", "present"].includes(status) ? `${key}T05:00:00Z` : null, ...extra });

/* ------------------------------ anchor ------------------------------ */

test("anchor: profile.contract.startDate wins over hireDate", () => {
  const a = contractYearAnchor({ profile: { contract: { startDate: "2023-03-01" }, hireDate: "2020-01-15" } });
  assert.deepEqual(a, { key: "2023-03-01", source: "contract" });
});
test("anchor: profile.hireDate", () => {
  assert.deepEqual(contractYearAnchor({ profile: { hireDate: "2020-01-15" } }), { key: "2020-01-15", source: "hire" });
});
test("anchor: no date → first duty record, said so", () => {
  assert.deepEqual(contractYearAnchor({ profile: {} , createdAt: "2026-10-14T06:00:00Z" }, "2026-07-12"), { key: "2026-07-12", source: "record" });
});
test("anchor: nothing at all → createdAt", () => {
  assert.deepEqual(contractYearAnchor({ createdAt: "2026-10-14T06:00:00Z" }), { key: "2026-10-14", source: "created" });
});

/* ------------------------------ coverage ------------------------------ */

test("record start: dated roster day / published week / punch — weekday pattern keys skipped", () => {
  const schedules = [{
    assignments: { 0: { m: ["a"] }, 1: { m: ["a"] }, "2026-07-14": { m: ["a"] }, "2026-07-01": { m: [] } },
    publishedWeeks: { "2026-07-12": {} },
  }];
  assert.equal(dutyRecordStart({ schedules }), "2026-07-12");
  assert.equal(dutyRecordStart({ schedules, rows: [{ date: "2026-06-30" }] }), "2026-06-30");
  assert.equal(dutyRecordStart({ schedules: [{ assignments: { 0: { m: ["a"] } } }] }), "");
});
test("record start per person: only rosters that carry him / his home branch, and his own punches", () => {
  const schedules = [
    { stationId: "north", assignments: { 0: { m: ["a"] }, "2026-07-14": { m: ["a"] } }, publishedWeeks: { "2026-07-12": {} } },
    { stationId: "east", assignments: { 0: { m: ["s"] }, "2026-10-14": { m: ["s"] } }, publishedWeeks: {} },
  ];
  assert.equal(dutyRecordStart({ schedules, employee: { id: "a", stationId: "north" } }), "2026-07-12");
  assert.equal(dutyRecordStart({ schedules, employee: { id: "s", stationId: "east" } }), "2026-10-14");
  assert.equal(dutyRecordStart({ schedules, rows: [{ employeeId: "a", date: "2026-05-01" }, { employeeId: "s", date: "2026-09-01" }], employee: { id: "s", stationId: "east" } }), "2026-09-01");
});

/* ------------------------------ windows ------------------------------ */

test("contract years run anniversary to the day before the next", () => {
  const w = contractYearWindows("2024-03-10", "2026-10-14");
  assert.equal(w.length, 3);
  assert.deepEqual([w[0].start, w[0].end], ["2024-03-10", "2025-03-09"]);
  assert.deepEqual([w[2].start, w[2].end], ["2026-03-10", "2027-03-09"]);
  assert.equal(windowOf(w, "2026-03-09").index, 1);
  assert.equal(windowOf(w, "2026-03-10").index, 2);
});
test("contract year from 29 Feb clamps to 28 Feb in common years", () => {
  const w = contractYearWindows("2024-02-29", "2026-03-01");
  assert.deepEqual(w.map((x) => x.start), ["2024-02-29", "2025-02-28", "2026-02-28"]);
  assert.equal(w[0].end, "2025-02-27");
});
test("calendar years run 1 Jan – 31 Dec from the anchor's year", () => {
  const w = calendarYearWindows("2024-03-10", "2026-10-14");
  assert.deepEqual(w.map((x) => x.year), [2024, 2025, 2026]);
  assert.equal(w[1].start, "2025-01-01");
});

/* ------------------------------ tallies ------------------------------ */

test("tally: absent / late / leave / holiday counted from the shared statuses", () => {
  const t = tallyDutyDays([
    day("2026-09-01", "ontime"),
    day("2026-09-02", "late", { lateMinutes: 12 }),
    day("2026-09-03", "absent"),
    day("2026-09-04", "rest"),
    day("2026-09-05", "leave"),
    day("2026-09-06", "holiday"),
    day("2026-09-07", "manual"),
    day("2026-09-08", "upcoming"),
  ]);
  assert.equal(t.attended, 3);
  assert.equal(t.absent, 1);
  assert.equal(t.lateDays, 1);
  assert.equal(t.lateMinutes, 12);
  assert.equal(t.leave, 1);
  assert.equal(t.holiday, 1);
  assert.equal(t.scheduled, 4);
});
test("consecutive streak: rest days between absences neither count nor break; a punch breaks", () => {
  const t = tallyDutyDays([
    day("2026-09-01", "absent"),
    day("2026-09-02", "absent"),
    day("2026-09-03", "rest"),
    day("2026-09-04", "rest"),
    day("2026-09-05", "absent"),
    day("2026-09-06", "ontime"),
    day("2026-09-07", "absent"),
  ]);
  assert.equal(t.absent, 4);
  assert.equal(t.maxStreak, 3);
  assert.equal(t.streakFrom, "2026-09-01");
  assert.equal(t.streakTo, "2026-09-05");
  assert.equal(t.currentStreak, 1);
});
test("consecutive streak: approved leave ends the run", () => {
  const t = tallyDutyDays([day("2026-09-01", "absent"), day("2026-09-02", "leave"), day("2026-09-03", "absent")]);
  assert.equal(t.maxStreak, 1);
});

/* ------------------------------ years ------------------------------ */

function buildDays(from, to, pick) {
  return eachDayKey(from, to).map((key) => day(key, pick(key)));
}

test("contract-year reset: absences before the anniversary do not carry into the new year", () => {
  // anchor 2025-03-10; absent 2026-03-01 … 2026-03-09 (old year) and 2026-03-10 … 2026-03-12 (new year)
  const days = buildDays("2025-03-10", "2026-03-20", (key) => (key >= "2026-03-01" && key <= "2026-03-12" ? "absent" : "ontime"));
  const years = dutyYears({ days, anchorKey: "2025-03-10", todayKey: "2026-03-20", coverageStart: "2025-03-10" });
  assert.equal(years.length, 2);
  assert.equal(years[0].start, "2026-03-10");
  assert.equal(years[0].current, true);
  assert.equal(years[0].tally.absent, 3);
  assert.equal(years[0].tally.maxStreak, 3);
  assert.equal(years[1].tally.absent, 9);
  assert.equal(years[1].tally.maxStreak, 9);
});
test("calendar-year toggle: the same days split on 1 January instead", () => {
  const days = buildDays("2025-12-20", "2026-01-10", (key) => (key >= "2025-12-28" && key <= "2026-01-03" ? "absent" : "ontime"));
  const contract = dutyYears({ days, anchorKey: "2025-06-01", todayKey: "2026-01-10", coverageStart: "2025-12-20" });
  const calendar = dutyYears({ days, anchorKey: "2025-06-01", todayKey: "2026-01-10", mode: "calendar", coverageStart: "2025-12-20" });
  assert.equal(contract.length, 1);
  assert.equal(contract[0].tally.absent, 7);
  assert.equal(calendar.length, 2);
  assert.deepEqual(calendar.map((y) => y.year), [2026, 2025]);
  assert.deepEqual(calendar.map((y) => y.tally.absent), [3, 4]);
  assert.equal(calendar[0].art80, null);
  assert.ok(contract[0].art80);
});
test("coverage: years before the first record are listed but read nothing", () => {
  const days = buildDays("2026-07-12", "2026-10-14", () => "absent");
  const years = dutyYears({ days: [...buildDays("2020-01-15", "2026-07-11", () => "absent"), ...days], anchorKey: "2020-01-15", todayKey: "2026-10-14", coverageStart: "2026-07-12" });
  assert.equal(years.length, 7);
  assert.equal(years[0].covered, true);
  assert.equal(years[0].partial, true);
  assert.equal(years[0].from, "2026-07-12");
  assert.equal(years[3].covered, false);
  assert.equal(years[3].tally.absent, 0);
});
test("Article 80 reading: thresholds from the text (30 / 20 notice, 15 / 10 notice)", () => {
  assert.equal(ART80.intermittentLimit, 30);
  assert.equal(ART80.consecutiveLimit, 15);
  assert.equal(art80Reading({ absent: 7, maxStreak: 2 }).intermittent.level, "some");
  assert.equal(art80Reading({ absent: 20, maxStreak: 10 }).intermittent.level, "notice");
  assert.equal(art80Reading({ absent: 20, maxStreak: 10 }).consecutive.level, "notice");
  assert.equal(art80Reading({ absent: 30, maxStreak: 15 }).intermittent.level, "notice");
  assert.equal(art80Reading({ absent: 31, maxStreak: 16 }).consecutive.level, "over");
  assert.equal(art80Reading({ absent: 0, maxStreak: 0 }).intermittent.level, "none");
});

/* ------------------------------ search ------------------------------ */

const people = [{ id: "a", name: "أحمد السالم" }, { id: "n", name: "نيار عبدالله" }, { id: "o", name: "عمر ناصر" }];
const today = "2026-10-14";

test("normalize: hamza forms, ta marbuta, alef maqsura, tashkeel, Arabic-Indic digits", () => {
  assert.equal(normalizeDutyText("إجازةٌ أيلول ١٠/٩"), "اجازه ايلول 10/9");
  assert.equal(normalizeDutyText("مُتأخّر"), "متاخر");
});
test("«غياب أحمد سبتمبر» → أحمد · absent · September 2026", () => {
  const q = parseDutyQuery("غياب أحمد سبتمبر", { people });
  assert.deepEqual(q.statuses, ["absent"]);
  assert.deepEqual(q.people.map((p) => p.id), ["a"]);
  const p = resolveDutyPeriod(q.period, { todayKey: today });
  assert.deepEqual([p.from, p.to], ["2026-09-01", "2026-09-30"]);
});
test("«تأخير هذا الأسبوع» → late · Sunday–Saturday", () => {
  const q = parseDutyQuery("تأخير هذا الأسبوع", { people });
  assert.deepEqual(q.statuses, ["late"]);
  const p = resolveDutyPeriod(q.period, { todayKey: today });
  assert.deepEqual([p.from, p.to], ["2026-10-11", "2026-10-17"]);
});
test("«نيار 2026» → نيار · calendar year 2026", () => {
  const q = parseDutyQuery("نيار 2026", { people });
  assert.deepEqual(q.people.map((p) => p.id), ["n"]);
  const p = resolveDutyPeriod(q.period, { todayKey: today });
  assert.deepEqual([p.from, p.to], ["2026-01-01", "2026-12-31"]);
});
test("page names: «جدولي» and «حضور الفريق» (not the status حضور)", () => {
  assert.deepEqual(parseDutyQuery("جدولي").pages, ["shifts"]);
  const q = parseDutyQuery("حضور الفريق");
  assert.deepEqual(q.pages, ["team"]);
  assert.deepEqual(q.statuses, []);
});
test("dates: «10/9» = 10 September (d/m) · «أمس» · Levantine «أيلول» · «الشهر الماضي»", () => {
  const p = resolveDutyPeriod(parseDutyQuery("١٠/٩").period, { todayKey: today });
  assert.equal(p.from, "2026-09-10");
  assert.equal(resolveDutyPeriod(parseDutyQuery("أمس").period, { todayKey: today }).from, "2026-10-13");
  assert.equal(resolveDutyPeriod(parseDutyQuery("غياب أيلول").period, { todayKey: today }).from, "2026-09-01");
  assert.equal(resolveDutyPeriod(parseDutyQuery("الشهر الماضي").period, { todayKey: today }).from, "2026-09-01");
});
test("a month later than this one means last year's", () => {
  assert.equal(resolveDutyPeriod(parseDutyQuery("ديسمبر").period, { todayKey: today }).from, "2025-12-01");
});
test("«السنة العقدية» resolves on the person's anchor; «السابقة» the one before", () => {
  const q = parseDutyQuery("غياب السنة العقدية");
  assert.deepEqual(q.statuses, ["absent"]);
  const p = resolveDutyPeriod(q.period, { todayKey: today, anchorKey: "2020-01-15" });
  assert.deepEqual([p.from, p.to], ["2026-01-15", "2027-01-14"]);
  const prev = resolveDutyPeriod(parseDutyQuery("السنة العقدية السابقة").period, { todayKey: today, anchorKey: "2020-01-15" });
  assert.deepEqual([prev.from, prev.to], ["2025-01-15", "2026-01-14"]);
});
test("prefixed status words: «والتأخير» «الغياب»", () => {
  assert.deepEqual(parseDutyQuery("الغياب والتأخير").statuses, ["absent", "late"]);
});
test("day matching: late includes punched days with minutes; night / exposed read flags", () => {
  assert.ok(dutyDayMatches({ status: "ontime", lateMinutes: 5, inAt: "x" }, ["late"]));
  assert.ok(!dutyDayMatches({ status: "absent" }, ["late"]));
  assert.ok(dutyDayMatches({ status: "ontime", night: true }, ["night"]));
  assert.ok(dutyDayMatches({ status: "manual" }, ["attended"]));
});

test("range: «غياب من 1 إلى 15 سبتمبر»", () => {
  const q = parseDutyQuery("غياب من 1 إلى 15 سبتمبر");
  const p = resolveDutyPeriod(q.period, { todayKey: "2026-10-14" });
  assert.deepEqual([q.statuses, p.from, p.to], [["absent"], "2026-09-01", "2026-09-15"]);
});
test("range: «بين 1/9 و 20/9» with a name", () => {
  const q = parseDutyQuery("تأخير أحمد بين 1/9 و 20/9", { people: [{ id: "a", name: "أحمد السالم" }] });
  const p = resolveDutyPeriod(q.period, { todayKey: "2026-10-14" });
  assert.deepEqual([q.people.map((x) => x.id), p.from, p.to], [["a"], "2026-09-01", "2026-09-20"]);
});
test("range of months «من يوليو إلى سبتمبر»", () => {
  const p = resolveDutyPeriod(parseDutyQuery("من يوليو إلى سبتمبر").period, { todayKey: "2026-10-14" });
  assert.deepEqual([p.from, p.to], ["2026-07-01", "2026-09-30"]);
});
test("hijri month «رمضان 1447» (Umm al-Qura)", () => {
  const p = resolveDutyPeriod(parseDutyQuery("غياب رمضان 1447").period, { todayKey: "2026-10-14" });
  assert.deepEqual([p.from, p.to], ["2026-02-18", "2026-03-19"]);
});
test("hijri day «15 شعبان 1448» and «5/3/1448»", () => {
  assert.equal(resolveDutyPeriod(parseDutyQuery("15 شعبان 1448").period, { todayKey: "2026-10-14" }).from, "2027-01-23");
  assert.equal(resolveDutyPeriod(parseDutyQuery("5/3/1448").period, { todayKey: "2026-10-14" }).from, "2026-08-18");
});
test("hijri month without a year → latest one not in the future", () => {
  const p = resolveDutyPeriod(parseDutyQuery("شوال").period, { todayKey: "2026-10-14" });
  assert.equal(p.from, "2026-03-20");
});
test("hijri range «من 1 رمضان إلى 10 رمضان 1447»", () => {
  const p = resolveDutyPeriod(parseDutyQuery("تأخير من 1 رمضان إلى 10 رمضان 1447").period, { todayKey: "2026-10-14" });
  assert.deepEqual([p.from, p.to], ["2026-02-18", "2026-02-27"]);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
