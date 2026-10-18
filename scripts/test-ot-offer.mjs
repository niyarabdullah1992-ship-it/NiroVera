import assert from "node:assert/strict";
import { hoursAr, otOffer, otOfferLines } from "../src/lib/otOffer.js";

const emp = { id: "e1", profile: { baseSalary: 6000, allowances: 1500 }, otherRequests: [] };
const o = otOffer({ employee: emp, hours: 2, date: "2026-10-15" });
assert.equal(o.known, true);
assert.equal(o.pay.hourlyActual, 31.25, "7,500 ÷ 240");
assert.equal(o.pay.premiumPart, 12.5, "50% of 6,000 ÷ 240");
assert.equal(o.pay.perHour, 43.75);
assert.equal(o.pay.total, 87.5);
assert.equal(o.pay.basicOnly, 75, "what a basic-only ×1.5 would wrongly give");
assert.equal(o.leave.hours, 3, "1.5 per overtime hour");
assert.equal(o.leave.days, 0.375);
assert.equal(o.leave.worth, 93.75, "3 paid hours at 31.25");
assert.ok(o.leave.takeBy > "2026-10-15");
const L = otOfferLines(o);
assert.match(L.payTitle, /87\.50 ر\.س/);
assert.match(L.payHow, /31\.25 ر\.س.*7,500 ر\.س.*12\.50 ر\.س = 43\.75 ر\.س.*لساعتين: 62\.50 ر\.س \+ 25 ر\.س = 87\.50 ر\.س.*المادة 107/);
assert.match(L.leaveTitle, /3 ساعات/);
assert.match(L.leaveHow, /ساعتان × 1\.5 = 3 ساعات.*0\.375.*تُصرف لك أجرتها/);
assert.match(L.yearLine, /2 من 720 ساعة.*0\.375 من 30 يوماً/);
assert.match(L.compare, /الاختيار لك وحدك/);

// No wage on file — no invented number.
const blank = otOffer({ employee: { id: "x", profile: {} }, hours: 3, date: "2026-10-15" });
assert.equal(blank.known, false);
assert.match(otOfferLines(blank).payTitle, /يُحسب في المسير/);

// Year counters include accepted assignments and flag the caps.
const busy = { ...emp, otherRequests: [{ id: "a", type: "overtime", assignment: true, status: "approved", hours: 719, date: "2026-03-01", compensation: "pay", employeeAck: true }] };
const ob = otOffer({ employee: busy, hours: 2, date: "2026-10-15" });
assert.equal(ob.year.hoursYtd > 0, true);
assert.equal(hoursAr(1), "ساعة واحدة");
assert.equal(hoursAr(4.5), "4.5 ساعة");
console.log("ot offer ok");
assert.equal(ob.year.hoursYtd, 719);
assert.equal(ob.year.overCap, true);
assert.match(otOfferLines(ob).yearLine, /721 من 720 ساعة — يتجاوز السقف ويحتاج إقرارك/);
console.log("ot caps ok");
const { stampOvertimePayOnDraft } = await import("../src/lib/overtimeAssignment.js");
const draft = { otDecisions: {} };
const a1 = { id: "r1", type: "overtime", assignment: true, compensation: "pay", hours: 2, date: "2026-10-15" };
const a2 = { id: "r2", type: "overtime", assignment: true, compensation: "pay", hours: 3, date: "2026-10-15" };
stampOvertimePayOnDraft(draft, "e1", a1, "m");
stampOvertimePayOnDraft(draft, "e1", a2, "m");
assert.equal(draft.otDecisions["e1:2026-10-15"].overtimeMinutes, 300, "same-day assignments add up");
const { otAssignmentLine } = await import("../src/lib/otOffer.js");
assert.match(otAssignmentLine({ hours: 3, date: "2026-10-15" }, emp), /3 ساعات · بانتظار اختيار الموظف/);
assert.match(otAssignmentLine({ hours: 2, date: "2026-10-15", compensation: "pay" }, emp), /ساعتان · اختار: أجر إضافي 87\.50 ر\.س/);
assert.match(otAssignmentLine({ hours: 2, date: "2026-10-15", compensation: "credit", enjoyDate: "2026-12-14" }, emp), /اختار: إجازة تعويضية 3 ساعات يتمتع بها حتى 14 ديسمبر 2026/);
console.log("assignment line ok");
const { otMonthBreakdown } = await import("../src/lib/otOffer.js");
const worker = { id: "e1", profile: { baseSalary: 9000 }, otherRequests: [
  { id: "a1", type: "overtime", assignment: true, status: "approved", compensation: "pay", hours: 3, date: "2026-10-15", recordedBy: "نيار" },
  { id: "a2", type: "overtime", assignment: true, status: "approved", compensation: "credit", hours: 6, date: "2026-10-18", compHours: 9 },
  { id: "a3", type: "overtime", assignment: true, status: "approved", compensation: "pay", hours: 2, date: "2026-09-02" },
] };
// Run: 5 hours (3 from the assignment + 2 from attendance), paid 281.25 at 9,000 basic.
const bd = otMonthBreakdown({ employee: worker, month: "2026-10", totalHours: 5, totalPay: 281.25, base: 9000, allowances: 0 });
assert.equal(bd.rows.length, 3);
assert.match(bd.rows[0].label, /تكليف 15 أكتوبر 2026 · 3 ساعات/);
assert.equal(bd.rows[0].amount, 168.75);
assert.match(bd.rows[1].label, /أجر إضافي من الحضور — ساعتان/);
assert.equal(bd.rows[1].amount, 112.5);
assert.equal(bd.rows[0].amount + bd.rows[1].amount, 281.25, "parts add up to the run");
assert.equal(bd.rows[2].info, true);
assert.match(bd.rows[2].label, /6 ساعات إضافية حُوّلت إلى إجازة تعويضية/);
assert.equal(bd.rows[2].valueText, "9 ساعات إجازة");
// Run not synced yet (0 hours): no invented split.
const none = otMonthBreakdown({ employee: worker, month: "2026-10", totalHours: 0, totalPay: 0, base: 9000 });
assert.equal(none.rows[0].id, "ot");
assert.match(none.rows[0].label, /أجر إضافي — 0 ساعة/);
console.log("month breakdown ok");
