// «⚖ حقك / التزامك» for payroll, قسيمتي and end of service — pure builders in src/lib/rightHints.pay.js.
import assert from "node:assert/strict";
import {
  PAY_HINT_BUILDERS,
  PAY_HINT_KINDS,
  PAY_ROW_KINDS,
  deductionLineHint,
  payHintFor,
  paySar,
  slipRowHint,
} from "../src/lib/rightHints.pay.js";
import { RIGHT_HINT_BUILDERS } from "../src/lib/rightHints.js";
import { ruleValue } from "../src/lib/laborRules.js";
import { overtimePay } from "../src/lib/payrollDerivations.js";
import { damageObjectionDeadline } from "../src/lib/rightsRequests.js";
import { deriveEos, deriveSettlementDeadline } from "../src/lib/offboardingDerivations.js";

const today = "2026-10-16";
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };
const both = (kind, ctx = {}) => ({
  e: payHintFor(kind, { today, ...ctx, view: "employee" }),
  m: payHintFor(kind, { today, name: "سالم", employeeId: "e1", ...ctx, view: "manager" }),
});
const shape = (h, word) => {
  assert.ok(h, "hint");
  assert.equal(h.word, word);
  assert.ok(h.right && h.right.length > 10, `right: ${h.right}`);
  assert.ok(h.ifNot && h.ifNot.length > 5, "ifNot");
  assert.ok(h.action?.label, "one action");
  assert.ok(h.action.to || h.action.href, "action has a route or link");
  assert.ok(h.law?.label, "statute label");
};
const lanes = (kind, ctx) => {
  const { e, m } = both(kind, ctx);
  shape(e, "حقك");
  shape(m, "التزامك");
  return { e, m };
};

ok("registered once in rightHints.js and every builder answers both lanes", () => {
  assert.equal(RIGHT_HINT_BUILDERS.pay, PAY_HINT_BUILDERS);
  const ctx = { amount: 1000, days: 5, hours: 4, base: 6000, allowances: 1500, wage: 7500, total: 900, cap: 3000,
    eos: { years: 3, wage: 7500, gratuity: 11250, fraction: 1 }, settlement: { days: 7, due: "2026-10-23" },
    task: { kind: "register", due: "2026-10-31" }, what: "تسجيل موظف جديد", duty: { cite: "146", ar: "سكن", en: "Housing" } };
  for (const kind of PAY_HINT_KINDS) lanes(kind, ctx);
  assert.ok(PAY_HINT_KINDS.length >= 18);
});

ok("wage: due date, WPS, Art. 94 for delay; payday moved to the previous working day cites model Art. 17", () => {
  const { e, m } = lanes("wage", { amount: 7000, payday: { due: "2026-10-27", scheduled: "2026-10-27", shifted: false } });
  assert.match(e.right, /7,000 ر\.س/);
  assert.match(e.right, /27 أكتوبر/);
  assert.match(e.right, /حماية الأجور/);
  assert.match(e.ifNot, /المادة 94/);
  assert.equal(e.law.article, "90");
  assert.equal(e.action.to, "/app/discipline?tab=mine&raise=grievance");
  assert.equal(m.due, "2026-10-27");
  assert.equal(m.action.to, "/app/payroll?tab=wps");
  const shifted = payHintFor("wage", { today, amount: 7000, payday: { due: "2026-10-29", scheduled: "2026-10-30", shifted: true } });
  assert.match(shifted.law.label, /اللائحة النموذجية م17/);
  const late = payHintFor("wage", { today: "2026-11-02", view: "manager", amount: 7000, payday: { due: "2026-10-29" } });
  assert.match(late.ifNot, /مضى الموعد/);
  const paid = payHintFor("wage", { today, view: "manager", amount: 7000, paid: true, paidAt: "2026-10-27", payday: { due: "2026-10-27" } });
  assert.equal(paid.due, "");
  assert.match(paid.right, /صُرف/);
});

ok("WPS file window from the rule row (model Art. 15)", () => {
  const { m } = lanes("wps", { heads: 12, deadline: "2026-11-30" });
  assert.match(m.right, new RegExp(`${ruleValue("payroll.wps.fileWindowDays", today)} يوماً`));
  assert.match(m.right, /12 عاملاً/);
  assert.equal(m.law.label, "اللائحة النموذجية م15");
  assert.equal(m.due, "2026-11-30");
});

ok("deductions: half-wage cap (93) when breached, instrument (92) otherwise; loan 10% (92/1)", () => {
  const under = lanes("deduction", { total: 900, cap: 3000 });
  assert.equal(under.e.law.article, "92");
  assert.match(under.e.right, /900 ر\.س/);
  assert.match(under.e.right, /3,000 ر\.س/);
  const over = lanes("deduction", { total: 3500, cap: 3000 });
  assert.equal(over.m.law.article, "93");
  assert.match(over.m.ifNot, /موقوف/);
  assert.equal(over.m.action.to, "/app/payroll?tab=deduct");
  const loan = lanes("loan", { amount: 600, wage: 7500 });
  assert.match(loan.e.right, /10٪/);
  assert.match(loan.e.right, /750 ر\.س/);
  assert.equal(loan.e.law.article, "92");
});

ok("damage: 5 days' wage cap and the 15-working-day objection window from the notice", () => {
  const last = damageObjectionDeadline("2026-10-12");
  const { e, m } = lanes("damage", { amount: 800, wage: 9000, noticeOn: "2026-10-12" });
  assert.match(e.right, /5 أيام/);
  assert.match(e.right, /1,500 ر\.س/); // 9000 / 30 × 5
  assert.match(e.ifNot, /15 يوم عمل/);
  assert.equal(e.action.rightsKind, "damage_objection");
  assert.equal(m.due, last);
  assert.match(m.ifNot, /7 أيام/);
  const closed = payHintFor("damage", { today: "2027-01-01", amount: 800, wage: 9000, noticeOn: "2026-10-12" });
  assert.match(closed.ifNot, /مضت مهلة الاعتراض/);
  assert.equal(closed.action.href, "https://najiz.sa");
  assert.equal(deductionLineHint({ source: "damage", amount: 800, damageNoticeOn: "2026-10-12" }, { today, wage: 9000 }).law.article, "91");
  assert.match(deductionLineHint({ source: "advance", amount: 500 }, { today, wage: 7500 }).right, /السلفة/);
  assert.match(deductionLineHint({ source: "court_debt", amount: 500 }, { today, wage: 8000 }).right, /ربع/);
  assert.equal(deductionLineHint({ source: "manual", amount: 200 }, { today, total: 200, cap: 3000 }).law.article, "92");
});

ok("overtime: actual hourly + 50% of basic (Art. 107) with the rate from payrollDerivations", () => {
  const rate = overtimePay(6000, 1, 1500);
  const { e, m } = lanes("overtime", { hours: 4, base: 6000, allowances: 1500 });
  assert.match(e.right, new RegExp(paySar(rate).replace(/[.]/g, "\\.")));
  assert.match(e.right, new RegExp(paySar(overtimePay(6000, 4, 1500)).replace(/[.]/g, "\\.")));
  assert.match(e.right, /آخر شهر التكليف/);
  assert.equal(m.law.article, "107");
  const comp = payHintFor("overtime", { today, hours: 0, compHours: 3, base: 6000 });
  assert.match(comp.right, /إجازة تعويضية/);
});

ok("sick bands 30/60/30 (117), unpaid leave wage-not-due with the 20-day suspension (116)", () => {
  const sick = lanes("sick", { days: 10, amount: 500, band: "quarter" });
  assert.match(sick.e.right, /30 يوماً بأجر كامل، ثم 60 بثلاثة أرباعه، ثم 30 بلا أجر/);
  assert.match(sick.e.right, /10 أيام بثلاثة أرباع الأجر/);
  const unpaid = lanes("unpaidLeave", { days: 25, amount: 5000 });
  assert.match(unpaid.e.right, /غير مستحق لا خصماً/);
  assert.match(unpaid.e.right, /5 أيام فوق 20/);
  assert.match(unpaid.m.right, /لا بنداً في خصومات المادة 92/);
  assert.equal(unpaid.e.law.article, "116");
});

ok("work injury 137 (60 full, then 75%), 139 exclusions on written decision, GOSI-covered daily allowance", () => {
  const full = lanes("injury", { days: 20, mode: "full" });
  assert.match(full.e.right, /أول 60 يوماً ثم 75٪/);
  assert.equal(full.e.law.article, "137");
  const ex = lanes("injury", { days: 5, amount: 900, mode: "excluded" });
  assert.equal(ex.e.law.article, "139");
  assert.match(ex.e.right, /قرار مكتوب/);
  const gosi = lanes("injury", { days: 5, mode: "gosi" });
  assert.equal(gosi.e.law.product, true);
  assert.match(gosi.e.right, /لا يُجمع البدل مع الأجر/);
});

ok("detention: 50% up to 180 days, refund on acquittal (97)", () => {
  const { e } = lanes("detention", { days: 12, amount: 2400 });
  assert.match(e.right, /50٪/);
  assert.match(e.right, /180 يوماً/);
  assert.match(e.right, /2,400 ر\.س/);
  assert.equal(e.law.article, "97");
});

ok("EOS: Art. 84 formula; Art. 85 resignation thirds; Art. 87 full; Art. 80 none", () => {
  const ms = Date.UTC(2026, 9, 16, 12);
  const base = { hireDate: "2019-10-16", base: 6000, allowances: 2000, profile: {} };
  const plain = deriveEos({ ...base }, ms);
  const h84 = lanes("eos", { eos: plain });
  assert.equal(h84.e.law.article, "84");
  assert.match(h84.e.right, new RegExp(paySar(plain.gratuity).replace(/[.]/g, "\\.")));
  assert.match(h84.m.ifNot, /أسبوع.*أسبوعين.*المادة 88/);
  const resign = deriveEos({ ...base, contractExit: { reason: "resignation", effectiveDate: "2026-10-16" } }, ms);
  assert.ok(resign.fraction > 0.5 && resign.fraction < 1, `two-thirds expected, got ${resign.fraction}`);
  const h85 = lanes("eos", { eos: resign });
  assert.equal(h85.e.law.article, "85");
  assert.match(h85.e.right, /ثلثا المكافأة/);
  const third = payHintFor("eos", { today, eos: { years: 3, wage: 8000, gratuity: 4000, fraction: 1 / 3 } });
  assert.match(third.right, /ثلث المكافأة/);
  const h87 = payHintFor("eos", { today, eos: { years: 3, gratuity: 12000, art87: true, fraction: 1 } });
  assert.equal(h87.law.article, "87");
  assert.match(h87.right, new RegExp(`${ruleValue("eos.art87.marriageMonths", today)} أشهر من الزواج`));
  const h80 = payHintFor("eos", { today, eos: { art80: true, gratuity: 0, fraction: 0 } });
  assert.equal(h80.law.article, "80");
});

ok("final settlement within 7 / 14 days (88); leave cash (111); custody set-off capped (91); unlawful (77)", () => {
  const byEmployer = deriveSettlementDeadline({ reason: "article_77", lastWorkDate: "2026-10-10", today });
  const s7 = lanes("settlement", { settlement: byEmployer, total: 20000 });
  assert.match(s7.e.right, /خلال أسبوع/);
  assert.equal(s7.m.due, byEmployer.due);
  assert.equal(s7.e.action.href, "https://najiz.sa");
  const byWorker = deriveSettlementDeadline({ reason: "resignation", lastWorkDate: "2026-10-10", today });
  assert.match(payHintFor("settlement", { today, settlement: byWorker }).right, /أسبوعين/);
  const leave = lanes("leaveCash", { days: 12.5, amount: 3125 });
  assert.equal(leave.e.law.article, "111");
  assert.match(leave.e.right, /12\.5 يوماً/);
  const custody = lanes("custody", { debt: 3000, setOff: 1000, toCourt: 2000, wage: 6000 });
  assert.match(custody.m.right, /1,000 ر\.س/);
  assert.match(custody.m.right, /الباقي 2,000 ر\.س/);
  assert.equal(custody.e.law.article, "91");
  assert.equal(lanes("unlawful", { amount: 15000 }).e.law.article, "77");
});

ok("GOSI: worker share is a statutory deduction (92/2); registration and remittance are the employer's", () => {
  const { e, m } = lanes("gosi", { amount: 585 });
  assert.equal(e.law.article, "92");
  assert.match(e.right, /حصة صاحب العمل عليه/);
  assert.equal(m.law.product, true);
  assert.equal(m.action.to, "/app/payroll?tab=gosi");
  const task = payHintFor("gosiTask", { today, view: "manager", task: { kind: "injury_office", due: "2026-10-20" }, what: "إصابة" });
  assert.equal(task.law.regs, "28");
  assert.equal(task.due, "2026-10-20");
});

ok("slip rows: one hint where the law protects the line, none on plain allowance rows", () => {
  const item = { unpaidLeaveDays: 3, sickQuarterDays: 4, sickUnpaidDays: 2, injuryReducedDays: 6, injuryDays: 6, detentionDays: 5, paid: false };
  const ctx = { today, view: "employee", item, net: 6400, base: 6000, allowances: 1500, cap: 3000, payday: { due: "2026-10-27" } };
  assert.equal(slipRowHint({ id: "base", amount: 6000 }, ctx).law.article, "90");
  assert.match(slipRowHint({ id: "base", amount: 6000 }, ctx).right, /6,400 ر\.س/);
  assert.equal(slipRowHint({ id: "housing", amount: 1500 }, ctx), null);
  assert.equal(slipRowHint({ id: "ot-a1", amount: 200, hours: 4 }, ctx).law.article, "107");
  assert.match(slipRowHint({ id: "ot-comp", hours: 3, info: true }, ctx).right, /إجازة تعويضية/);
  assert.equal(slipRowHint({ id: "unpaidLeave", amount: 600 }, ctx).law.article, "116");
  assert.match(slipRowHint({ id: "unpaidLeave", amount: 600 }, ctx).right, /^3 أيام/);
  assert.match(slipRowHint({ id: "sick117u", amount: 400 }, ctx).right, /يومين بلا أجر/);
  assert.equal(slipRowHint({ id: "injury137", amount: 300 }, ctx).law.article, "137");
  assert.equal(slipRowHint({ id: "injury139", amount: 300 }, ctx).law.article, "139");
  assert.equal(slipRowHint({ id: "detention", amount: 1000 }, ctx).law.article, "97");
  assert.equal(slipRowHint({ id: "refunds", amount: 500 }, ctx).law.article, "91");
  assert.equal(slipRowHint({ id: "deduct", amount: 900 }, ctx).law.article, "92");
  assert.equal(slipRowHint({ id: "gosi", amount: 585 }, ctx).law.article, "92");
  for (const id of PAY_ROW_KINDS) assert.ok(payHintFor(id, { ...ctx, ...item, days: 2 }), id);
});

ok("English lane reads in English", () => {
  const h = payHintFor("wage", { today, lang: "en", amount: 7000, payday: { due: "2026-10-27" } });
  assert.equal(h.word, "Your right");
  assert.match(h.right, /SAR 7,000/);
  assert.equal(h.law.label, "Art. 90");
});

console.log(`rights-pay: ${n} checks ok`);
