import assert from "node:assert/strict";
import { checkConsentGate, checkNecessityGate, consentEffectLine, consentState, necessityDaysUsed, spendConsent } from "../src/lib/consentEffects.js";

const wc = (id, topic, status, extra = {}) => ({ id, type: "written_consent", topic, status, createdAt: "2026-10-01T09:00:00Z", answeredAt: status === "open" ? "" : "2026-10-02T09:00:00Z", ...extra });
const emp = (rows, extra = {}) => ({ id: "e1", name: "سالم", otherRequests: rows, ...extra });

// States.
assert.equal(consentState(emp([]), "site").state, "none");
assert.equal(consentState(emp([wc("a", "site", "open")]), "site").state, "open");
assert.equal(consentState(emp([wc("a", "site", "yes")]), "site").state, "signed");
assert.equal(consentState(emp([wc("a", "site", "no")]), "site").state, "refused");
assert.equal(consentState(emp([wc("a", "ot", "yes")]), "site").state, "none", "topics do not mix");

// Gates name the reason and the article.
assert.match(checkConsentGate(emp([]), "site").reason, /المادة 58.*طلب موافقة خطية/);
assert.match(checkConsentGate(emp([wc("a", "site", "no")]), "site").reason, /رفض سالم كتابياً.*لا يُتخذ سبباً لجزاء/);
assert.match(checkConsentGate(emp([wc("a", "wage_type", "open")]), "wage_type").reason, /لم يُجَب بعد.*المادة 59/);
assert.equal(checkConsentGate(emp([wc("a", "different_work", "yes")]), "different_work").ok, true);

// Single use: a spent consent no longer opens the next move.
const used = wc("a", "site", "yes");
spendConsent(used, { what: "نقل إلى فرع الرس", by: "مدير" });
assert.equal(consentState(emp([used]), "site").state, "none");
assert.match(consentEffectLine(used), /استُخدمت في: نقل إلى فرع الرس/);
// Overtime consent is standing — the latest answer governs.
const ot1 = wc("o1", "ot", "yes", { usedAt: "2026-10-05" });
assert.equal(consentState(emp([ot1]), "ot").state, "signed", "107 consent is not spent");
const ot2 = wc("o2", "ot", "no", { answeredAt: "2026-10-09T09:00:00Z" });
assert.equal(consentState(emp([ot1, ot2]), "ot").state, "refused", "a later refusal governs");

// Effect lines.
assert.match(consentEffectLine(wc("a", "site", "yes")), /تتيح نقله.*مرة واحدة/);
assert.match(consentEffectLine(wc("a", "site", "no")), /يمنع نقله.*30 يوماً/);
assert.match(consentEffectLine(wc("a", "ot", "no")), /يُصرف له أجر الإضافي/);
assert.match(consentEffectLine(wc("a", "wage_type", "open")), /لا أثر قبل رده/);

// Incidental necessity — 30 days a year per kind.
const e = emp([], { necessityLog: [{ kind: "site", from: "2026-03-01", until: "2026-03-20", endedAt: "2026-03-20T12:00:00Z" }, { kind: "work", from: "2026-04-01", until: "2026-04-25", endedAt: "2026-04-25T12:00:00Z" }] });
assert.equal(necessityDaysUsed(e, "site", "2026"), 20);
assert.equal(checkNecessityGate(e, "site", { from: "2026-10-01", until: "2026-10-10" }).ok, true);
assert.match(checkNecessityGate(e, "site", { from: "2026-10-01", until: "2026-10-11" }).reason, /لا تتجاوز 30 يوماً.*استُخدم 20/);
assert.equal(checkNecessityGate(e, "site", { from: "2027-01-01", until: "2027-01-30" }).ok, true, "a new year starts again");
assert.equal(checkNecessityGate(e, "site", { from: "2026-10-01" }).ok, false, "an end date is required");
assert.equal(checkNecessityGate(e, "work", { from: "2026-10-01", until: "2026-10-05" }).ok, true);
assert.equal(checkNecessityGate(e, "work", { from: "2026-10-01", until: "2026-10-06" }).ok, false);
console.log("consent effects ok");

// Arts. 59–60 on the employee-file save.
const { checkFileChangeConsentGate } = await import("../src/lib/consentEffects.js");
const plain = emp([]);
assert.equal(checkFileChangeConsentGate({ employee: plain, before: { wageType: "monthly" }, after: { wageType: "monthly" } }).ok, true);
assert.match(checkFileChangeConsentGate({ employee: plain, before: {}, after: { wageType: "hourly" } }).reason, /المادة 59/);
const w = checkFileChangeConsentGate({ employee: emp([wc("w", "wage_type", "yes")]), before: { wageType: "monthly" }, after: { wageType: "daily" } });
assert.equal(w.ok, true);
assert.deepEqual(w.spend, [{ consentId: "w", what: "تحويل الأجر من شهري إلى يومي" }]);
assert.equal(checkFileChangeConsentGate({ employee: plain, before: { wageType: "daily" }, after: { wageType: "monthly" } }).ok, true, "back to monthly needs nothing");
const t = { employee: plain, before: { position: "فني تشغيل" }, after: { position: "محاسب" } };
assert.equal(checkFileChangeConsentGate(t).needsPositionChoice, true);
assert.equal(checkFileChangeConsentGate({ ...t, positionChange: "minor" }).ok, true);
assert.match(checkFileChangeConsentGate({ ...t, positionChange: "essential" }).reason, /المادة 60/);
assert.equal(checkFileChangeConsentGate({ ...t, employee: emp([wc("d", "different_work", "yes")]), positionChange: "essential" }).spend[0].consentId, "d");
const n = checkFileChangeConsentGate({ ...t, positionChange: "necessity", necessityUntil: "2026-10-20", today: "2026-10-15" });
assert.equal(n.ok, true);
assert.equal(n.necessity.kind, "work");
assert.equal(checkFileChangeConsentGate({ ...t, positionChange: "necessity", necessityUntil: "2026-12-30", today: "2026-10-15" }).ok, false, "over 30 days");
assert.equal(checkFileChangeConsentGate({ employee: plain, before: { position: "" }, after: { position: "فني" } }).ok, true, "a first title is not a change");
console.log("file change consent ok");
const { consentChoiceLines } = await import("../src/lib/consentEffects.js");
assert.match(consentChoiceLines("site").yes, /مرة واحدة/);
assert.match(consentChoiceLines("site").no, /لا يُتخذ الرفض سبباً لجزاء/);
assert.match(consentChoiceLines("ot").no, /يُصرف لك أجر الإضافي كاملاً/);
console.log("choice lines ok");

// Temporary assignments — reminders and overdue days.
const { activeNecessities, necessityText, planNecessityNotices, necessityEnd } = await import("../src/lib/consentEffects.js");
const tmp = {
  id: "e9", name: "عمر",
  necessityLog: [
    { id: "n1", kind: "site", from: "2026-10-01", until: "2026-10-17", fromStationName: "فرع الخفجي", toStationName: "فرع رابغ" },
    { id: "n2", kind: "work", from: "2026-09-01", until: "2026-09-10", fromTitle: "فني", toTitle: "محاسب" },
    { id: "n3", kind: "work", from: "2026-08-01", until: "2026-08-05", endedAt: "2026-08-05T10:00:00Z" },
  ],
};
const act = activeNecessities(tmp, "2026-10-15");
assert.equal(act.length, 2, "ended ones drop out");
assert.equal(act[0].row.id, "n2");
assert.equal(act[0].over, true);
assert.equal(act[0].overBy, 35);
assert.equal(act[1].left, 2);
assert.match(necessityText(act[1], "عمر"), /تكليف عمر المؤقت في فرع رابغ ينتهي بعد يومين \(17 أكتوبر 2026\).*أعده إلى فرع الخفجي.*58\/2/);
assert.match(necessityText(act[0], "عمر"), /تجاوز عمر.*بـ35 يوماً \(انتهى 10 سبتمبر 2026\).*أعد مسمّاه «فني»/);
assert.equal(necessityEnd(tmp.necessityLog[1], "2026-10-15"), "2026-10-15", "overdue days run to today");
assert.equal(necessityDaysUsed(tmp, "work", "2026", "2026-10-15"), 45 + 5, "overdue days count toward the 30");
const plansN = planNecessityNotices({ data: { employees: [tmp] }, today: "2026-10-15", audienceOf: () => [{ id: "m" }] });
const kn = plansN.map((p) => p.key);
assert.ok(kn.includes("necessity:e9:n1:3:m"));
assert.ok(kn.includes("necessity:e9:n2:over:m"));
assert.ok(kn.includes("necessity:e9:n2:over:self"));
assert.ok(!kn.includes("necessity:e9:n1:0:self"), "the worker hears on the last day, not before");
assert.equal(planNecessityNotices({ data: { employees: [tmp] }, today: "2026-10-15", audienceOf: () => [{ id: "m" }], existingKeys: kn }).length, 0);
assert.ok(planNecessityNotices({ data: { employees: [tmp] }, today: "2026-10-17", audienceOf: () => [{ id: "m" }], existingKeys: kn }).some((p) => p.key === "necessity:e9:n1:0:self"));
console.log("necessity reminders ok");
