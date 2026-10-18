// «⚖ حقك / التزامك» — attendance, duty and roster builders (area: att).
import assert from "node:assert/strict";
import {
  ABSENCE_LINES,
  ATT_HINT_BUILDERS,
  ATT_HINT_KINDS,
  LATENESS_TABLE,
  absenceStanding,
  attRightHint,
  latenessStep,
  latenessStepLabel,
} from "../src/lib/rightHints.att.js";
import { attHintForCheck, attHintKindForCheck } from "../src/lib/rightHints.att.js";
import { RIGHT_HINT_BUILDERS } from "../src/lib/rightHints.js";

const today = "2026-10-16";
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };
const E = { view: "employee", today, ar: true, employee: { id: "e1", name: "سالم" } };
const M = { ...E, view: "manager" };
const shape = (h, word) => {
  assert.ok(h, "hint");
  assert.equal(h.word, word);
  assert.ok(h.right && h.right.length > 10, "right");
  assert.ok(h.ifNot && h.ifNot.length > 5, "ifNot");
  assert.ok(h.action?.label, "action");
  assert.ok(h.law?.label, "law");
};

ok("registered in RIGHT_HINT_BUILDERS.att", () => {
  assert.equal(RIGHT_HINT_BUILDERS.att, ATT_HINT_BUILDERS);
  for (const k of ["lateness", "absence", "overtime", "holidayWork", "rest", "weeklyRest", "ramadan", "night", "heat", "nursing", "juvenile", "art108", "roster"]) {
    assert.ok(ATT_HINT_KINDS.includes(k), k);
  }
});

ok("lateness table — Annex 1 rows 1–7", () => {
  assert.equal(LATENESS_TABLE.length, 7);
  assert.deepEqual(latenessStep(10, 1, false), { row: 1, step: "warn", isWarning: true, occurrence: 1, plusLateWage: false });
  assert.equal(latenessStep(10, 2, false).step, 5);
  assert.equal(latenessStep(10, 2, true).step, 15);
  assert.equal(latenessStep(20, 1, false).step, 10); // row 3: no warning first
  assert.equal(latenessStep(45, 4, true).step, "2d");
  assert.equal(latenessStep(90, 1).step, "warn");
  assert.equal(latenessStep(90, 1).plusLateWage, true);
  assert.equal(latenessStep(10, 9).occurrence, 4);
  assert.equal(latenessStep(0), null);
  assert.equal(latenessStepLabel("warn"), "إنذار كتابي بلا حسم");
  assert.equal(latenessStepLabel("2d"), "حسم أجر يومين");
});

ok("lateness hint — warning first, deduction only after (Art. 66)", () => {
  const h = attRightHint("lateness", { date: "2026-10-12", minutes: 12, occurrence: 1 }, E);
  shape(h, "حقك");
  assert.equal(h.law.article, "66");
  assert.match(h.right, /12 دقيقة/);
  assert.match(h.right, /إنذار كتابي/);
  assert.match(h.right, /لا حسم قبل الإنذار/);
  assert.equal(h.action.to, "/app/discipline?tab=mine&raise=grievance");
  const m = attRightHint("lateness", { date: "2026-10-12", minutes: 12, occurrence: 2 }, M);
  shape(m, "التزامك");
  assert.match(m.right, /حسم 5%/);
  assert.match(m.right, /المادة 69/);
  assert.equal(m.due, "2026-11-11");
  const ex = attRightHint("lateness", { date: "2026-10-12", minutes: 40, excused: true }, E);
  assert.match(ex.right, /لا جزاء/);
});

ok("absence — Art. 80(7) lines 30/15 with warning at 20/10", () => {
  assert.deepEqual(ABSENCE_LINES, { yearDays: 30, yearWarnDays: 20, streakDays: 15, streakWarnDays: 10 });
  assert.equal(absenceStanding(5, 2), "below");
  assert.equal(absenceStanding(20, 0), "warn");
  assert.equal(absenceStanding(3, 10), "warn");
  assert.equal(absenceStanding(31, 0), "over");
  assert.equal(absenceStanding(0, 16), "over");
  const h = attRightHint("absence", { days: 7, streak: 3 }, E);
  shape(h, "حقك");
  assert.equal(h.law.article, "80");
  assert.match(h.right, /غياب 7 يوماً/);
  assert.match(h.right, /إنذار كتابي عند 20/);
  const m = attRightHint("absence", { days: 21 }, M);
  assert.match(m.right, /وجّه إنذاراً كتابياً الآن/);
  const mw = attRightHint("absence", { days: 21, warned: true }, M);
  assert.doesNotMatch(mw.right, /الآن/);
});

ok("overtime — Art. 107 pay or comp with consent; worked hours not rejected", () => {
  const h = attRightHint("overtime", { date: "2026-10-10", hours: 2, worked: true, hourWage: 30, basicHourWage: 20 }, E);
  shape(h, "حقك");
  assert.equal(h.law.article, "107");
  assert.match(h.right, /50% من الأساسي/);
  assert.match(h.right, /بموافقتك/);
  assert.match(h.right, /لا تُرفض/);
  assert.match(h.right, /80/); // 2 × (30 + 10)
  const m = attRightHint("overtime", { date: "2026-10-10", hours: 2, worked: true }, M);
  assert.match(m.right, /الرفض غير متاح/);
  assert.equal(m.due, "2026-11-24");
  const p = attRightHint("overtime", { hours: 3, worked: false }, E);
  assert.match(p.right, /مخططة/);
});

ok("overtime — 720 h annual cap needs the worker's consent (Regs Art. 22)", () => {
  const h = attRightHint("overtime", { hours: 10, worked: false, yearHours: 715 }, E);
  assert.equal(h.law.regs, "22");
  assert.match(h.right, /720/);
  assert.match(h.right, /بموافقتك أنت/);
  const c = attRightHint("overtime", { hours: 10, worked: true, yearHours: 715, consented: true }, E);
  assert.equal(c.law.article, "107");
});

ok("holiday work — Art. 107(3)", () => {
  const h = attRightHint("holidayWork", { date: "2026-09-23", holidayName: "اليوم الوطني", hours: 8 }, E);
  shape(h, "حقك");
  assert.match(h.right, /اليوم الوطني/);
  assert.match(h.right, /107\/3/);
});

ok("rest — Art. 101 5 h / 30 min; Art. 104 24 h weekly", () => {
  const h = attRightHint("rest", { date: "2026-10-14", stretchHours: 6 }, E);
  shape(h, "حقك");
  assert.equal(h.law.article, "101");
  assert.match(h.right, /5 ساعات متتالية/);
  assert.match(h.right, /30 دقيقة/);
  const w = attRightHint("weeklyRest", { restDayLabel: "الجمعة", restHours: 20 }, M);
  shape(w, "التزامك");
  assert.equal(w.law.article, "104");
  assert.match(w.right, /24 ساعة/);
});

ok("Ramadan — Art. 98 6 h / 36 h; non-Muslim keeps ordinary hours", () => {
  const h = attRightHint("ramadan", { date: "2026-02-20", dayHours: 8 }, E);
  shape(h, "حقك");
  assert.match(h.right, /6 يومياً أو 36 أسبوعياً/);
  assert.match(h.right, /إضافية/);
  const nm = attRightHint("ramadan", { muslim: false }, E);
  assert.match(nm.right, /للمسلمين/);
});

ok("night — Decision 18632 compensation, 12 h rest, rotation, medical", () => {
  const h = attRightHint("night", { date: "2026-10-12" }, E);
  shape(h, "حقك");
  assert.equal(h.law.decisionId, "18632");
  assert.match(h.right, /بدل/);
  assert.match(attRightHint("night", { restHours: 9 }, E).right, /12 ساعة/);
  assert.match(attRightHint("night", { nightWeeks: 14 }, M).right, /دوّر/);
  const md = attRightHint("night", { medicalDue: true }, E);
  assert.equal(md.action.rightsKind, "night_avoid");
});

ok("heat — Decision 3337 window from rules", () => {
  const h = attRightHint("heat", { date: "2026-07-01", exposed: true }, M);
  shape(h, "التزامك");
  assert.equal(h.law.decisionId, "3337");
  assert.match(h.right, /12:00/);
  assert.match(h.right, /15:00/);
});

ok("nursing — Art. 154 / Regs 31, until date from birth", () => {
  const h = attRightHint("nursing", { birthDate: "2026-01-10", nurseryOnSite: false }, E);
  shape(h, "حقك");
  assert.equal(h.law.article, "154");
  assert.match(h.right, /60 دقيقة/);
  assert.match(h.right, /أول الدوام أو آخره/);
  assert.match(h.right, /2028/);
  assert.match(attRightHint("nursing", { birthDate: "2026-01-10", nurseryOnSite: true }, E).right, /فترات/);
});

ok("juvenile — Arts 161–166; null for an adult", () => {
  const kid = { name: "فهد", profile: { birthDate: "2010-05-01" } };
  const h = attRightHint("juvenile", { employee: kid }, { ...M, employee: kid });
  shape(h, "التزامك");
  assert.equal(h.law.article, "164");
  assert.match(h.right, /6 ساعات/);
  assert.match(h.right, /4 في رمضان/);
  assert.equal(attRightHint("juvenile", { employee: { profile: { birthDate: "1990-01-01" } } }, E), null);
});

ok("Art. 108 categories keep weekly rest", () => {
  const h = attRightHint("art108", { category: "guard" }, E);
  shape(h, "حقك");
  assert.equal(h.law.article, "108");
  assert.match(h.right, /المادة 104/);
  assert.equal(attRightHint("art108", { category: "" }, E), null);
});

ok("published roster — Art. 17 posting; due = week start when unpublished", () => {
  const m = attRightHint("roster", { weekStart: "2026-10-18" }, M);
  shape(m, "التزامك");
  assert.equal(m.law.article, "17");
  assert.equal(m.due, "2026-10-18");
  const e = attRightHint("roster", { weekStart: "2026-10-18", publishedAt: "2026-10-15" }, E);
  assert.match(e.right, /منشور منذ/);
  assert.equal(e.due, "");
});

ok("English copy + unknown kind", () => {
  const h = attRightHint("lateness", { minutes: 20 }, { ...E, ar: false });
  assert.equal(h.word, "Your right");
  assert.equal(h.law.label, "Art. 66");
  assert.equal(attRightHint("nope", {}, E), null);
});

ok("hours — Art. 98 8/48, extra is overtime", () => {
  const h = attRightHint("hours", { weekHours: 52 }, E);
  shape(h, "حقك");
  assert.equal(h.law.article, "98");
  assert.match(h.right, /48 أسبوعياً/);
  assert.match(h.right, /إضافية/);
});

ok("roster checks map to one hint each", () => {
  assert.equal(attHintKindForCheck({ id: "rest_5h", article: "101" }).kind, "rest");
  assert.equal(attHintKindForCheck({ id: "weekly_rest", article: "104" }).kind, "weeklyRest");
  assert.equal(attHintKindForCheck({ id: "hours_ramadan", article: "98" }).kind, "ramadan");
  assert.equal(attHintKindForCheck({ id: "hours_48", article: "98" }).kind, "hours");
  assert.deepEqual(attHintKindForCheck({ id: "night_rest" }), { kind: "night", item: { focus: "rest" } });
  assert.equal(attHintKindForCheck({ id: "juvenile_hours", article: "164" }).kind, "juvenile");
  assert.equal(attHintKindForCheck({ id: "heat_ban" }).kind, "heat");
  assert.equal(attHintKindForCheck({ id: "hours_106", article: "106", labelAr: "لا تتجاوز 10 ساعات يومياً" }).kind, "rule");
  assert.equal(attHintKindForCheck({ id: "double_shift" }), null);
  const r = attHintForCheck({ id: "night_rest" }, M);
  shape(r, "التزامك");
  assert.match(r.right, /12 ساعة/);
  const g = attHintForCheck({ id: "hours_106", article: "106", labelAr: "لا تتجاوز 10 ساعات يومياً" }, M);
  assert.equal(g.law.article, "106");
});

console.log(`\n${n} att rights checks passed`);
