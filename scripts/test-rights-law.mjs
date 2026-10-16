// «⚖ حقك / التزامك», «حقوقي», «التزاماتي وحقوقي» — pure builders.
import assert from "node:assert/strict";
import { RIGHT_HINT_BUILDERS, hintDate, rightHintFor } from "../src/lib/rightHints.js";
import { buildMyRights, nextPayday, payrollItemsOf } from "../src/lib/myRights.js";
import { buildCompanyObligations, staffAr } from "../src/lib/companyObligations.js";
import { LEAVE_TYPES } from "../src/lib/leaveTypes.js";
import { REQUEST_KINDS, DOC_KINDS } from "../src/lib/requestWorkspace.js";
import { RIGHTS_REQUESTS, grievanceReplyBy, damageObjectionDeadline } from "../src/lib/rightsRequests.js";
import { DUTY_REQUEST_TYPES } from "../src/lib/dutyRequests.js";
import { deriveEos } from "../src/lib/offboardingDerivations.js";
import { ruleValue } from "../src/lib/laborRules.js";

const today = "2026-10-16";
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };

const emp = (over = {}) => ({
  id: "e1",
  name: "سالم",
  profile: { hireDate: "2020-01-15", baseSalary: 6000, allowances: 1500, ...(over.profile || {}) },
  leaveRequests: over.leaveRequests || [],
  otherRequests: over.otherRequests || [],
});
const shape = (h) => {
  assert.ok(h, "hint");
  assert.ok(["حقك", "التزامك"].includes(h.word), `word ${h.word}`);
  assert.ok(h.right && h.right.length > 10, "right sentence");
  assert.ok(h.ifNot && h.ifNot.length > 5, "ifNot sentence");
  assert.ok(h.action?.label, "one action");
  assert.ok(h.law?.label, "statute label");
};

ok("hintDate drops the current year only", () => {
  assert.equal(hintDate("2026-10-30", today), "30 أكتوبر");
  assert.equal(hintDate("2027-01-02", today), "2 يناير 2027");
});

ok("every leave type in طلباتي has a hint in both lanes", () => {
  for (const t of LEAVE_TYPES) {
    const row = { id: `l-${t.key}`, family: "leave", type: t.key, status: "pending", startDate: "2026-11-01", endDate: "2026-11-03", days: 3 };
    const e = emp();
    shape(rightHintFor(row, { view: "employee", today, employee: e }));
    const m = rightHintFor(row, { view: "manager", today, employee: e });
    shape(m);
    assert.equal(m.word, "التزامك");
    assert.equal(m.action.kind, "decide");
  }
});

ok("every other / rights / duty request type has a hint", () => {
  const types = new Set([
    ...REQUEST_KINDS.map((k) => k.type).filter(Boolean),
    ...RIGHTS_REQUESTS.map((k) => k.key),
    ...DUTY_REQUEST_TYPES,
    "night_consent", "advance", "custody", "manual_punch", "checkout_fix", "other_request", "leave_credit",
  ]);
  for (const type of types) {
    const row = { id: `o-${type}`, family: "other", type, status: "pending", date: "2026-10-10", createdAt: "2026-10-10" };
    shape(rightHintFor(row, { view: "employee", today, employee: emp() }));
    shape(rightHintFor(row, { view: "manager", today, employee: emp() }));
  }
  for (const k of DOC_KINDS) shape(rightHintFor({ id: `d-${k.id}`, family: "other", type: k.type, docKind: k.id, status: "pending" }, { today, employee: emp() }));
  const ot = { id: "ot1", family: "other", type: "overtime", assignment: true, hours: 4, date: "2026-10-12", status: "pending_employee" };
  const h = rightHintFor(ot, { today, employee: emp() });
  shape(h);
  assert.equal(h.law.article, "107");
  assert.match(h.right, /ر\.س/);
  assert.ok(Object.keys(RIGHT_HINT_BUILDERS.leave).length >= 15);
});

ok("annual (Art. 109): advance pay before the start date; manager due = start", () => {
  const row = { id: "a1", family: "leave", type: "annual", status: "pending", startDate: "2026-11-01", days: 5 };
  const e = rightHintFor(row, { view: "employee", today, employee: emp() });
  assert.match(e.right, /قبل 1 نوفمبر/);
  assert.equal(e.law.article, "109");
  assert.equal(e.action.rightsKind, "grievance");
  const m = rightHintFor(row, { view: "manager", today, employee: emp() });
  assert.equal(m.due, "2026-11-01");
  assert.match(m.right, /سالم/);
  assert.match(m.right, /30 يوماً/);
  // A decided request carries no manager deadline.
  assert.equal(rightHintFor({ ...row, status: "approved" }, { view: "manager", today, employee: emp() }).due, "");
});

ok("a refused request opens a grievance window dated from the refusal (Regs Art. 71)", () => {
  const row = { id: "a2", family: "leave", type: "annual", status: "rejected", reviewedAt: "2026-10-10T08:00:00Z", startDate: "2026-11-01" };
  const h = rightHintFor(row, { today, employee: emp() });
  assert.match(h.ifNot, /حتى 9 نوفمبر/);
});

ok("sick (Art. 117): full-pay days left from the year's use", () => {
  const e = emp({ leaveRequests: [{ id: "s0", type: "sick", status: "approved", startDate: "2026-03-01", endDate: "2026-03-10", days: 10 }] });
  const h = rightHintFor({ id: "s1", family: "leave", type: "sick", status: "pending", startDate: "2026-10-20" }, { today, employee: e });
  assert.match(h.right, /بقي لك بأجر كامل 20 يوماً/);
  const m = rightHintFor({ id: "s1", family: "leave", type: "sick", status: "pending", startDate: "2026-10-20" }, { view: "manager", today, employee: e });
  assert.match(m.right, /بأجر كامل/);
});

ok("exam (Art. 115): filed 15 days ahead — the last day is named", () => {
  const h = rightHintFor({ id: "x", family: "leave", type: "exam", status: "pending", startDate: "2026-12-01" }, { today, employee: emp() });
  assert.match(h.right, /حتى 16 نوفمبر/);
  assert.equal(h.law.article, "115");
});

ok("job-search day (Art. 78) names the end of the employer's notice", () => {
  const e = emp({ profile: { contractExit: { party: "employer", effectiveDate: "2026-12-15" } } });
  const h = rightHintFor({ id: "j", family: "leave", type: "job_search", status: "pending", startDate: "2026-10-20" }, { today, employee: e });
  assert.match(h.right, /15 ديسمبر/);
  assert.match(h.right, /دون موافقة/);
});

ok("grievance: reply within 15 days for the worker; manager due = replyBy; court action", () => {
  const row = { id: "g", family: "other", type: "grievance", status: "pending", date: "2026-10-15" };
  const by = grievanceReplyBy("2026-10-15");
  const e = rightHintFor(row, { today, employee: emp() });
  assert.match(e.right, new RegExp(hintDate(by, today)));
  assert.equal(e.action.kind, "href");
  assert.equal(e.law.regs, "71");
  const m = rightHintFor(row, { view: "manager", today, employee: emp() });
  assert.equal(m.due, by);
  assert.match(m.ifNot, /للمحكمة العمالية/);
});

ok("damage objection (Art. 91): court window 15 working days from notice", () => {
  const row = { id: "d", family: "other", type: "damage_objection", status: "pending", notifiedOn: "2026-10-05" };
  const last = damageObjectionDeadline("2026-10-05");
  const e = rightHintFor(row, { today, employee: emp() });
  assert.match(e.ifNot, new RegExp(hintDate(last, today)));
  assert.match(e.right, /5 أيام/);
  assert.equal(rightHintFor(row, { view: "manager", today, employee: emp() }).due, last);
});

ok("resignation (Art. 79 bis): deemed accepted after 30 days; Art. 75 notice route", () => {
  const row = { id: "r", family: "other", type: "resignation", status: "pending", date: "2026-10-01" };
  const e = rightHintFor(row, { today, employee: emp() });
  assert.match(e.right, /31 أكتوبر/);
  assert.match(e.right, /سحبها حتى 8 أكتوبر/);
  const m = rightHintFor(row, { view: "manager", today, employee: emp() });
  assert.equal(m.due, "2026-10-31");
  assert.match(m.ifNot, /بحكم النظام/);
  const n75 = rightHintFor({ ...row, exitRoute: "notice75", lastDay: "2026-10-31" }, { view: "manager", today, employee: emp() });
  assert.equal(n75.law.article, "75");
  assert.equal(n75.due, "2026-10-31");
});

ok("advance (Art. 92): instalment capped at 10% of the wage", () => {
  const h = rightHintFor({ id: "v", family: "other", type: "advance", status: "pending", amount: 3000 }, { today, employee: emp() });
  assert.match(h.right, /750 ر\.س/);
  assert.equal(h.law.article, "92");
});

ok("nursing hour (Art. 154) runs 24 months from the birth", () => {
  const h = rightHintFor({ id: "nh", family: "other", type: "nursing_hour", status: "pending", childBirthDate: "2026-01-10", date: "2026-10-20" }, { today, employee: emp() });
  assert.match(h.right, /9 يناير 2028/);
});

ok("heat report cites decision 3337 with the ban window", () => {
  const h = rightHintFor({ id: "h", family: "other", type: "heat_report", status: "pending", date: "2026-07-01" }, { today, employee: emp() });
  assert.equal(h.law.decisionId, "3337");
  assert.match(h.right, /12:00/);
});

ok("myRights: annual, payday, 50% cap, EOS, sick in order; figures derived", () => {
  const e = emp({ leaveRequests: [{ id: "a", type: "annual", status: "approved", startDate: "2026-02-01", endDate: "2026-02-05", days: 5 }] });
  const lines = buildMyRights({ employee: e, data: { settings: { payrollPayday: 27 } }, today });
  const ids = lines.map((l) => l.id);
  for (const id of ["annual", "payday", "deduction-cap", "eos", "sick"]) assert.ok(ids.includes(id), id);
  const pay = lines.find((l) => l.id === "payday");
  assert.equal(pay.figure, "27 أكتوبر");
  assert.equal(pay.law.article, "90");
  const cap = lines.find((l) => l.id === "deduction-cap");
  assert.equal(cap.figure, "3,750 ر.س");
  assert.equal(cap.law.article, "93");
  const eos = deriveEos({ hireDate: "2020-01-15", profile: e.profile, leaveRequests: e.leaveRequests }, new Date(`${today}T12:00:00`).getTime());
  assert.equal(lines.find((l) => l.id === "eos").figure, `${eos.article84Full.toLocaleString("en-US")} ر.س`);
  assert.equal(lines.find((l) => l.id === "sick").figure, String(ruleValue("leave.sick.fullPayDays")));
  for (const l of lines) assert.ok(l.law?.label, `${l.id} cites`);
});

ok("myRights: payday rolls to next month once passed; none set says so", () => {
  assert.equal(nextPayday({ payrollPayday: 10 }, today).due.slice(0, 7), "2026-11");
  assert.equal(nextPayday({}, today), null);
  const line = buildMyRights({ employee: emp(), data: {}, today }).find((l) => l.id === "payday");
  assert.match(line.text, /لم تحدّد الشركة يوم الدفع/);
});

ok("myRights: open time-limited rights come first (grievance, damage window, job search)", () => {
  const e = emp({
    profile: { contractExit: { party: "employer", effectiveDate: "2026-12-15" } },
    otherRequests: [{ id: "g", type: "grievance", status: "pending", date: "2026-10-15" }],
  });
  const data = { payrollRuns: [{ month: "2026-10", items: [{ employeeId: "e1", deductionLines: [{ id: "dl1", source: "damage", amount: 400, objectionLastDay: "2026-10-26" }] }] }] };
  assert.equal(payrollItemsOf(data).length, 1);
  const lines = buildMyRights({ employee: e, data, today });
  assert.deepEqual(lines.slice(0, 3).map((l) => l.id), ["damage-dl1", "grievance-reply-g", "job-search"]);
  assert.equal(lines[0].action.rightsKind, "damage_objection");
  // Once objected, the window line goes.
  const e2 = { ...e, otherRequests: [...e.otherRequests, { id: "o", type: "damage_objection", deductionLineId: "dl1" }] };
  assert.ok(!buildMyRights({ employee: e2, data, today }).some((l) => l.id === "damage-dl1"));
});

ok("myRights: approved overtime awaiting pay this month (Art. 107)", () => {
  const e = emp({ otherRequests: [{ id: "ot", type: "overtime", assignment: true, status: "approved", compensation: "pay", hours: 4, date: "2026-10-12" }] });
  const line = buildMyRights({ employee: e, data: {}, today }).find((l) => l.id === "ot-pay");
  assert.ok(line);
  assert.match(line.figure, /ر\.س/);
  assert.equal(line.law.article, "107");
});

ok("companyObligations: duties sorted by nearest date, each with consequence and action", () => {
  const e = emp({
    leaveRequests: [{ id: "l1", type: "annual", status: "pending", startDate: "2026-11-01", days: 5, createdAt: "2026-10-10" }],
    otherRequests: [
      { id: "g1", type: "grievance", status: "pending", date: "2026-10-15", createdAt: "2026-10-15" },
      { id: "r1", type: "resignation", status: "pending", date: "2026-10-01", lastDay: "2026-10-20", createdAt: "2026-10-01" },
    ],
  });
  const { duties, rights } = buildCompanyObligations({ employees: [e], data: { settings: { payrollPayday: 27 } }, today });
  const req = duties.filter((d) => d.kind === "request").map((d) => d.id);
  assert.deepEqual(req, ["req-other-g1", "req-other-r1", "req-leave-l1"]);
  const dues = duties.map((d) => d.due);
  assert.deepEqual(dues, [...dues].sort());
  for (const d of duties) { assert.ok(d.consequence); assert.ok(d.action?.to); assert.ok(d.law?.label); }
  assert.equal(duties.find((d) => d.id === "req-other-g1").action.to, "/app/requests/manage?focus=other-g1");
  assert.ok(duties.some((d) => d.kind === "payday" && d.due === "2026-10-27"));
  // Short notice on the resignation is a company right (Art. 76).
  const notice = rights.find((r) => r.kind === "notice");
  assert.equal(notice.law.article, "76");
  assert.match(notice.what, /19 من 30/);
});

ok("companyObligations: Art. 88 settlement, comp leave, probation, damage, sanctions", () => {
  const leaver = { id: "e2", name: "فهد", profile: { hireDate: "2024-01-01", contractExit: { reason: "resignation", effectiveDate: "2026-10-10" } } };
  const comp = { id: "e3", name: "نورة", profile: { hireDate: "2024-01-01" }, otherRequests: [{ id: "c", type: "overtime", assignment: true, status: "approved", compensation: "credit", hours: 4, date: "2026-10-01" }] };
  const prob = { id: "e4", name: "خالد", profile: { hireDate: "2026-09-01", probation: true, probationDays: 90 } };
  const data = {
    payrollRuns: [{ month: "2026-10", items: [{ employeeId: "e4", deductionLines: [{ id: "x", source: "damage", amount: 200, objectionLastDay: "2026-10-28" }] }] }],
    disciplinaryCases: [{ id: "k", employeeId: "e4", status: "objected", appealedAt: "2026-10-10" }],
  };
  const { duties, rights } = buildCompanyObligations({ employees: [leaver, comp, prob], data, today });
  const settle = duties.find((d) => d.kind === "settlement");
  assert.equal(settle.due, "2026-10-24");
  assert.equal(settle.law.article, "88");
  assert.ok(duties.some((d) => d.kind === "comp" && d.who === "نورة"));
  assert.ok(rights.some((r) => r.kind === "probation" && r.law.article === "54"));
  assert.ok(rights.some((r) => r.kind === "damage" && r.due === "2026-10-28"));
  const ruling = duties.find((d) => d.kind === "discipline");
  if (ruling) assert.equal(ruling.law.article, "72");
  assert.equal(staffAr(1), "موظف واحد");
  assert.equal(staffAr(4), "4 موظفين");
});

console.log(`PASS test-rights-law (${n})`);
