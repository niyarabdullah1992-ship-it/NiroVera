// «⚖ حقك / التزامك» — discipline, employee file, voice and safety builders (src/lib/rightHints.disc.js).
import assert from "node:assert/strict";
import { RIGHT_HINT_BUILDERS } from "../src/lib/rightHints.js";
import {
  DISC_HINT_BUILDERS,
  abuseCaseHint,
  contractHint,
  disciplineCaseHint,
  disciplineCourtBy,
  disciplineGrievanceBy,
  disciplineRuleHint,
  disciplineRulingBy,
  fileAlertHint,
  heldDocumentHint,
  injuryHint,
  lawOfRule,
  medicalExamHint,
  serviceCertificateHint,
  stationSafetyHint,
  trainingHint,
} from "../src/lib/rightHints.disc.js";

const today = "2026-10-16";
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };
const shape = (h, word) => {
  assert.ok(h, "hint");
  assert.equal(h.word, word);
  assert.ok(h.right && h.right.length > 10, `right sentence: ${h.right}`);
  assert.ok(h.ifNot && h.ifNot.length > 5, "ifNot sentence");
  assert.ok(h.law?.label, "statute label");
};
const both = (fn) => [fn("employee"), fn("manager")];
const emp = { id: "e1", name: "سالم", profile: { hireDate: "2024-01-10", baseSalary: 6000, allowances: 1500 } };
const noHoliday = () => false;
const fridays = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 5; // a test calendar: every Friday is a holiday

ok("registered once on RIGHT_HINT_BUILDERS.disc", () => {
  assert.equal(RIGHT_HINT_BUILDERS.disc, DISC_HINT_BUILDERS);
  for (const fn of Object.values(DISC_HINT_BUILDERS)) assert.equal(typeof fn, "function");
});

ok("employee view says حقك, manager view says التزامك", () => {
  const item = { id: "c1", employeeId: "e1", status: "notice", penaltyKind: "warning", discoveredAt: "2026-10-10" };
  const [e, m] = both((view) => disciplineCaseHint(item, { view, today, employee: emp }));
  shape(e, "حقك");
  shape(m, "التزامك");
  assert.equal(e.view, "employee");
  assert.equal(m.view, "manager");
});

ok("notice stage — Art. 71 hearing; manager clock is 30 days from discovery (Art. 69)", () => {
  const item = { status: "notice", penaltyKind: "fine", cutDays: 2, discoveredAt: "2026-10-10" };
  const m = disciplineCaseHint(item, { view: "manager", today, employee: emp });
  assert.equal(m.law.article, "71");
  assert.equal(m.due, "2026-11-09");
  assert.match(m.right, /سالم/);
  assert.match(m.right, /9 نوفمبر/);
  assert.match(m.ifNot, /المادة 69/);
  const e = disciplineCaseHint(item, { view: "employee", today });
  assert.equal(e.action.rightsKind, "grievance");
  assert.equal(e.action.to, "/app/discipline?tab=mine&raise=grievance", "the grievance is raised from «الجزاءات»");
  assert.equal(e.due, "", "due is only for the manager");
});

ok("hearing stage — Art. 69: sign within 30 days of the investigation; fines carry the 5-day cap (Art. 70)", () => {
  const item = { status: "hearing", penaltyKind: "fine", cutDays: 3, hearingEndedAt: "2026-10-01" };
  const m = disciplineCaseHint(item, { view: "manager", today, employee: emp });
  assert.equal(m.law.article, "69");
  assert.equal(m.due, "2026-10-31");
  assert.match(m.right, /5 أيام في الشهر/);
  const w = disciplineCaseHint({ ...item, penaltyKind: "warning", cutDays: 0 }, { view: "manager", today });
  assert.doesNotMatch(w.right, /5 أيام في الشهر/);
});

ok("signed — Art. 72: grievance 30 days, official holidays not counted, from delivery", () => {
  const item = { status: "notify", penaltyKind: "warning", signedAt: "2026-10-01", notifyDeliveredAt: "2026-10-04", notifyMethod: "hand" };
  assert.equal(disciplineGrievanceBy(item, noHoliday), "2026-11-03");
  const withFridays = disciplineGrievanceBy(item, fridays);
  assert.ok(withFridays > "2026-11-03", "holidays push the last day");
  const e = disciplineCaseHint(item, { view: "employee", today, isHoliday: noHoliday });
  assert.equal(e.law.article, "72");
  assert.match(e.right, /3 نوفمبر/);
  assert.equal(e.action.kind, "object");
  const m = disciplineCaseHint(item, { view: "manager", today, isHoliday: noHoliday, employee: emp });
  assert.equal(m.due, "2026-11-03");
  assert.match(m.right, /مفتوحة/);
  const undelivered = disciplineCaseHint({ ...item, notifyDeliveredAt: "", notifyMethod: "" }, { view: "manager", today, employee: emp });
  assert.match(undelivered.right, /بكتاب مسجّل/);
  assert.match(undelivered.ifNot, /تبدأ من إبلاغه/);
});

ok("objected — ruling in 15 days, then the labour court within 30 days excl. holidays", () => {
  const item = { status: "appeal", penaltyKind: "fine", cutDays: 1, signedAt: "2026-10-01", appealedAt: "2026-10-05" };
  assert.equal(disciplineRulingBy(item, noHoliday), "2026-10-20");
  assert.equal(disciplineCourtBy(item, noHoliday), "2026-11-19");
  assert.equal(disciplineCourtBy({ ...item, rulingAt: "2026-10-10" }, noHoliday), "2026-11-09", "an earlier refusal starts the court window");
  const e = disciplineCaseHint(item, { view: "employee", today, isHoliday: noHoliday });
  assert.match(e.right, /20 أكتوبر/);
  assert.match(e.ifNot, /19 نوفمبر/);
  assert.equal(e.action.kind, "href");
  const m = disciplineCaseHint(item, { view: "manager", today, isHoliday: noHoliday, employee: emp });
  assert.equal(m.due, "2026-10-20");
});

ok("closed — Art. 68: no aggravation 180 days after notice", () => {
  const item = { status: "closed", penaltyKind: "warning", signedAt: "2026-04-01", notifyDeliveredAt: "2026-04-02" };
  const e = disciplineCaseHint(item, { view: "employee", today });
  assert.equal(e.law.article, "68");
  assert.match(e.right, /180 يوماً/);
  assert.match(e.right, /29 سبتمبر/);
});

ok("Art. 80 dismissal — ground named, hearing, written warning for duties/absence, Art. 77 consequence", () => {
  const item = { status: "notice", penaltyKind: "dismiss", dismissGround: "absence" };
  const [e, m] = both((view) => disciplineCaseHint(item, { view, today, employee: emp }));
  assert.equal(e.law.article, "80");
  assert.match(e.right, /إنذارك كتابةً/);
  assert.match(m.right, /إنذاره كتابةً/);
  assert.match(m.ifNot, /المادة 77/);
  const loss = disciplineCaseHint({ ...item, dismissGround: "loss" }, { view: "manager", today });
  assert.match(loss.right, /24 ساعة/);
  const signed = disciplineCaseHint({ ...item, status: "notify", signedAt: "2026-10-01" }, { view: "employee", today });
  assert.equal(signed.law.article, "72", "after signing the grievance clock leads");
});

ok("rights list rows — one hint per rule with its article", () => {
  const h = disciplineRuleHint("discipline.fine.maxDays", "لا حسم فوق خمسة أيام في الشهر.", { view: "employee", today });
  shape(h, "حقك");
  assert.equal(h.law.article, "70");
  assert.equal(disciplineRuleHint("discipline.decision.days", "إن رُفض تظلّمي…", { today }).action.kind, "href");
});

ok("contract — Arts. 51/53: two copies, probation 180 days in all, the end date", () => {
  const e2 = { ...emp, profile: { ...emp.profile, contractType: "fixed", contractEndDate: "2027-01-09", probation: true } };
  const e = contractHint(e2, { view: "employee", today, probation: { remaining: 40 } });
  shape(e, "حقك");
  assert.equal(e.law.article, "53");
  assert.match(e.right, /نسختين/);
  assert.match(e.right, /180 يوماً/);
  assert.match(e.right, /بقي 40 يوماً/);
  assert.match(e.right, /9 يناير 2027/);
  const m = contractHint({ ...emp, profile: { ...emp.profile, contractType: "indefinite" } }, { view: "manager", today, to: "/app/employees/e1?tab=docs" });
  assert.equal(m.law.article, "51");
  assert.equal(m.action.to, "/app/employees/e1?tab=docs");
});

ok("file alerts — the rule row's article and the alert's own value", () => {
  const h = fileAlertHint({ ruleId: "contract.fixed.continuation.cite", value: "يُعد غير محدد المدة" }, emp, { view: "manager", today });
  shape(h, "التزامك");
  assert.equal(h.law.article, "55");
  assert.match(h.right, /في ملف سالم/);
  assert.equal(lawOfRule("contract.pattern.flexible.cite", true, today).label, "اللائحة م27");
  assert.equal(lawOfRule("contract.probation.warnDays", true, today).product, true);
  const eos = fileAlertHint({ ruleId: "eos.gratuity.cite", value: "" }, emp, { view: "employee", today });
  assert.equal(eos.law.article, "84");
  assert.match(eos.ifNot, /المادة 88/);
});

ok("training — documented within 30 days of the end (Regs 16); cost on the worker only in Art. 48 cases", () => {
  const r = { id: "t1", course: "السلامة الكهربائية", from: "2026-10-01", to: "2026-10-05", hours: 16, provider: "معهد", cost: 900 };
  const m = trainingHint(r, { view: "manager", today, employee: emp });
  assert.equal(m.due, "2026-11-04");
  assert.match(m.right, /4 نوفمبر/);
  const e = trainingHint({ ...r, bond: { days: 180 } }, { view: "employee", today });
  assert.equal(e.law.article, "48");
  assert.match(e.right, /180 يوماً/);
  const done = trainingHint({ ...r, documentedAt: "2026-10-06" }, { view: "manager", today });
  assert.equal(done.due, "");
});

ok("medical exam — Art. 143 yearly for the exposed; none when not exposed", () => {
  const exposed = { ...emp, profile: { ...emp.profile, exposureHazard: "ضوضاء" }, medicalExams: [{ at: "2025-09-01", fit: true }] };
  const m = medicalExamHint(exposed, { view: "manager", today });
  assert.equal(m.law.article, "143");
  assert.equal(m.due, "2026-09-01");
  assert.match(m.right, /متأخر/);
  assert.match(medicalExamHint(exposed, { view: "employee", today }).right, /«ضوضاء»/);
  assert.equal(medicalExamHint(emp, { today }), null);
});

ok("held documents — Regs Art. 6 for passport/iqama, Art. 64 for deposits", () => {
  const p = heldDocumentHint({ id: "d1", kind: "passport", heldSince: "2026-01-01" }, emp, { view: "employee", today });
  assert.equal(p.law.label, "اللائحة م6");
  assert.equal(p.action.rightsKind, "documents_return");
  const m = heldDocumentHint({ id: "d1", kind: "passport", heldSince: "2026-01-01" }, emp, { view: "manager", today });
  assert.match(m.right, /أعدها إليه الآن/);
  assert.equal(m.due, today);
  const cert = heldDocumentHint({ id: "d2", kind: "certificate", heldSince: "2026-01-01" }, emp, { view: "employee", today });
  assert.equal(cert.law.article, "64");
});

ok("service certificate — Art. 64, free, dated from the exit", () => {
  const out = { ...emp, profile: { ...emp.profile, contractExit: { effectiveDate: "2026-12-31" } } };
  const e = serviceCertificateHint(out, { view: "employee", today });
  shape(e, "حقك");
  assert.equal(e.law.article, "64");
  assert.match(e.right, /31 ديسمبر/);
  assert.equal(serviceCertificateHint(out, { view: "manager", today }).due, "2026-12-31");
});

ok("abuse complaint — model reg. 55: confidential inquiry in 5 working days", () => {
  const row = { id: "a1", status: "filed", filedAt: "2026-10-11", reporterId: "e1" };
  const m = abuseCaseHint(row, { view: "manager", today });
  assert.equal(m.law.label, "النموذج الموحد م55");
  assert.ok(m.due > "2026-10-11");
  assert.match(m.right, /5 أيام عمل/);
  const e = abuseCaseHint(row, { view: "employee", today });
  assert.match(e.right, /بسرية/);
  assert.match(e.right, /لا تُضار/);
  assert.equal(abuseCaseHint({ ...row, status: "closed" }, { view: "manager", today }).due, "");
});

ok("work injury — Regs Art. 28: labour office within a week, GOSI within ten days", () => {
  const m = injuryHint({ id: "i1", at: "2026-10-12T09:00:00" }, { view: "manager", today });
  assert.equal(m.law.label, "اللائحة م28");
  assert.equal(m.due, "2026-10-19");
  assert.match(m.right, /22 أكتوبر/);
  assert.match(injuryHint({ at: "2026-10-12" }, { view: "employee", today }).right, /المادة 133/);
});

ok("station safety — Arts. 121–123 and 142 in one hint", () => {
  const [e, m] = both((view) => stationSafetyHint({ name: "محطة الرس" }, { view, today }));
  shape(e, "حقك");
  shape(m, "التزامك");
  assert.equal(m.law.article, "122");
  assert.match(m.right, /محطة الرس/);
  assert.match(e.ifNot, /65/);
});

console.log(`\n${n} checks passed — rightHints.disc`);
