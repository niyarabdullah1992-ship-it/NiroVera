import assert from "node:assert/strict";
import {
  collectDisciplineArchive,
  countAr,
  decorateDisciplineCase,
  deriveDisciplineBoard,
  deriveDisciplineLawBoard,
  effectiveCutDays,
  faceOf,
  isDisciplineSettled,
  isErasedFromEmployeeRecord,
} from "../src/lib/disciplineBoard.js";
import {
  checkAdvanceDisciplineGate,
  checkDisciplineDoubleFileGate,
  checkDisciplineRepeatGate,
  checkDisposeDisciplineFinesGate,
  checkListedPenaltyGate,
  checkRaiseDisciplineGate,
  checkSignDisciplineGate,
  checkWorkplaceDisciplineGate,
  listedPenaltyLabel,
} from "../src/lib/disciplineDerivations.js";
import { countDaysExcludingOfficialHolidays } from "../src/lib/ummAlQuraCalendar.js";
import { buildDisciplineNoticeHtml } from "../src/lib/disciplineDoc.js";

assert.equal(countAr(1, "ملف واحد", "ملفان", "ملفات", "ملفاً"), "ملف واحد");
assert.equal(countAr(2, "ملف واحد", "ملفان", "ملفات", "ملفاً"), "ملفان");
assert.equal(faceOf("notice").id, "notified");
assert.equal(faceOf("hearing").id, "defence");
assert.equal(faceOf("notify").id, "signed");
assert.equal(faceOf("appeal").id, "objected");
assert.equal(faceOf("closed").id, "closed");

const employees = [{ id: "e1", name: "أحمد", stationId: "st", profile: { baseSalary: 4000, allowances: 500 } }];
const stations = [{ id: "st", name: "ميناء الدمام" }];

const empty = deriveDisciplineBoard({ cases: [], employees, stations, ar: true, today: "2026-09-12" });
assert.equal(empty.stats[0].val, "0");
assert.equal(empty.pulseKind, "ok");
assert.equal(empty.stages.length, 5);
assert.equal(empty.gates.length, 5);
assert.equal(empty.pulse, "لا ملف مفتوح");

const open = deriveDisciplineBoard({
  ar: true,
  today: "2026-09-12",
  employees,
  stations,
  cases: [{
    id: "c1",
    employeeId: "e1",
    status: "hearing",
    note: "تأخير متكرر",
    penalty: "حسم يوم",
    cutDays: 1,
    createdAt: "2026-09-01",
    notifiedAt: "2026-09-01",
    hearingEndedAt: "2026-09-03",
    evidence: ["محضر"],
  }],
});
assert.equal(open.openCount, 1);
assert.equal(open.pulseKind, "warn");
assert.equal(open.pulse, "ملف واحد مفتوح");
assert.equal(open.stages.find((row) => row.id === "defence").n, 1);

const appealed = deriveDisciplineBoard({
  ar: true,
  today: "2026-09-12",
  employees,
  stations,
  cases: [{
    id: "c2",
    employeeId: "e1",
    status: "appeal",
    note: "تأخير متكرر",
    penalty: "إنذار",
    createdAt: "2026-09-01",
    signedAt: "2026-09-08",
    appealNote: "أعترض على الغرامة",
  }],
});
assert.equal(appealed.appealCount, 1);
assert.equal(appealed.pulseKind, "bad");
assert.match(appealed.pulse, /اعتراض/);

const card = decorateDisciplineCase({
  id: "c1",
  employeeId: "e1",
  status: "hearing",
  note: "تأخير متكرر",
  penalty: "حسم يوم",
  cutDays: 1,
  createdAt: "2026-09-01",
  notifiedAt: "2026-09-01",
  hearingEndedAt: "2026-09-03",
  evidence: ["محضر"],
}, { employees, stations, ar: true, canManage: true, today: "2026-09-12" });
assert.equal(card.employee.name, "أحمد");
assert.equal(card.station.name, "ميناء الدمام");
assert.equal(card.face.id, "defence");
assert.equal(card.steps.length, 5);
assert.ok(card.actions.some((row) => row.id === "sign"));
assert.match(card.line, /تأخير متكرر/);

const oldNoticeFreshHearing = decorateDisciplineCase({
  id: "c-late-notice",
  employeeId: "e1",
  status: "hearing",
  note: "تأخير",
  penalty: "حسم يوم",
  cutDays: 1,
  createdAt: "2026-08-01",
  notifiedAt: "2026-08-01",
  hearingEndedAt: "2026-09-10",
  evidence: ["محضر"],
}, { employees, stations, ar: true, canManage: true, today: "2026-09-12" });
assert.ok(oldNoticeFreshHearing.actions.some((row) => row.id === "sign"), "Art. 69 signing clock starts at investigation end, not notice");

const raiseSelf = checkRaiseDisciplineGate({
  employee: employees[0],
  actor: { id: "e1" },
  note: "تأخير",
  today: "2026-09-12",
});
assert.equal(raiseSelf.error, "DISCIPLINE_SELF_SANCTION");
const raiseNoStation = checkRaiseDisciplineGate({
  employee: { id: "e2", name: "بلا فرع" },
  actor: { id: "e1" },
  note: "تأخير",
  today: "2026-09-12",
});
assert.equal(raiseNoStation.error, "STATION_REQUIRED");
const raiseOk = checkRaiseDisciplineGate({
  employee: employees[0],
  actor: { id: "mgr" },
  note: "تأخير متكرر يوم 1 سبتمبر",
  today: "2026-09-12",
});
assert.equal(raiseOk.ok, true);

assert.equal(listedPenaltyLabel("dismiss", 0, true).includes("فصل"), true);
assert.equal(checkListedPenaltyGate({ penaltyKind: "caution" }, "2026-09-12").error, "DISCIPLINE_PENALTY_NOT_LISTED");
assert.equal(checkListedPenaltyGate({ penaltyKind: "fine", cutDays: 5 }, "2026-09-12").ok, true);
assert.equal(checkListedPenaltyGate({ penaltyKind: "fine", cutDays: 6 }, "2026-09-12").error, "DISCIPLINE_FINE_OVER_CAP");

assert.equal(checkDisciplineDoubleFileGate(
  { id: "n1", employeeId: "e1", note: "تأخير متكرر", status: "notice" },
  { today: "2026-09-12", cases: [{ id: "c0", employeeId: "e1", note: "تأخير متكرر", status: "hearing" }] },
).error, "DISCIPLINE_DOUBLE_PENALTY");
assert.equal(checkDisciplineDoubleFileGate(
  { id: "n1", employeeId: "e1", note: "واقعة أخرى", status: "notice" },
  { today: "2026-09-12", cases: [{ id: "c0", employeeId: "e1", note: "تأخير متكرر", status: "hearing" }] },
).ok, true);

assert.equal(checkRaiseDisciplineGate({
  employee: employees[0],
  actor: { id: "mgr" },
  note: "تأخير قديم",
  discoveredAt: "2026-01-01",
  penaltyKind: "warning",
  today: "2026-09-12",
}).error, "DISCIPLINE_CHARGE_STALE");

assert.equal(checkRaiseDisciplineGate({
  employee: employees[0],
  actor: { id: "mgr" },
  note: "إهمال جسيم",
  penaltyKind: "dismiss",
  today: "2026-09-12",
}).error, "DISCIPLINE_DISMISS_GROUND");
assert.equal(checkRaiseDisciplineGate({
  employee: employees[0],
  actor: { id: "mgr" },
  note: "إهمال جسيم",
  penaltyKind: "dismiss",
  dismissGround: "اعتداء على المسؤول — المادة 80",
  today: "2026-09-12",
}).ok, true);

assert.equal(checkAdvanceDisciplineGate(
  { employeeId: "e1", appealedAt: "2026-08-01" },
  "ruling",
  { today: "2026-09-12" },
).error, "DISCIPLINE_RULING_LATE");
assert.equal(checkAdvanceDisciplineGate(
  { employeeId: "e1", appealedAt: "2026-09-10" },
  "ruling",
  { today: "2026-09-12" },
).ok, true);

assert.equal(checkSignDisciplineGate({
  employeeId: "e1",
  penaltyKind: "fine",
  cutDays: 3,
  hearingEndedAt: "2026-09-10",
}, {
  today: "2026-09-12",
  cases: [{ id: "old", employeeId: "e1", penaltyKind: "fine", cutDays: 3, signedAt: "2026-09-05", status: "notify" }],
}).error, "DISCIPLINE_MONTH_CAP");

assert.equal(checkDisposeDisciplineFinesGate({ authority: "committee", note: "قصير", ledger: [{ kind: "posted", amount: 200 }] }).error, "DISCIPLINE_FINE_DISPOSE_NOTE");
assert.equal(checkDisposeDisciplineFinesGate({
  authority: "ministry",
  note: "موافقة الوزارة رقم 1447/12",
  ledger: [{ kind: "posted", amount: 200 }],
}).ok, true);

const repeat = checkDisciplineRepeatGate(
  { id: "c3", employeeId: "e1", cutDays: 3 },
  {
    today: "2026-09-12",
    cases: [{ id: "c0", employeeId: "e1", cutDays: 1, signedAt: "2025-12-01", status: "closed" }],
  },
);
assert.equal(repeat.error, "DISCIPLINE_REPEAT_COOLOFF");
const repeatSoon = checkDisciplineRepeatGate(
  { id: "c4", employeeId: "e1", cutDays: 3 },
  {
    today: "2026-09-12",
    cases: [{ id: "c0", employeeId: "e1", cutDays: 1, signedAt: "2026-08-01", status: "closed" }],
  },
);
assert.equal(repeatSoon.ok, true);

assert.equal(effectiveCutDays({ cutDays: 2, signedAt: "2026-09-08" }), 2);
assert.equal(effectiveCutDays({ cutDays: 2, signedAt: "2026-09-08", rulingOutcome: "void" }), 0);
assert.equal(effectiveCutDays({ cutDays: 2, signedAt: "2026-09-08", rulingOutcome: "lower" }), 0);
assert.equal(effectiveCutDays({ cutDays: 2, status: "hearing" }), 0);
assert.equal(isDisciplineSettled({ status: "notify", signedAt: "2026-09-08" }), true);
assert.equal(isDisciplineSettled({ status: "appeal" }), false);
assert.equal(isDisciplineSettled({ status: "appeal", rulingLabel: "ثُبِّت الجزاء" }), true);
assert.equal(isErasedFromEmployeeRecord({ signedAt: "2025-08-12" }, "2026-09-12"), true);
assert.equal(isErasedFromEmployeeRecord({ signedAt: "2026-08-12" }, "2026-09-12"), false);

const archive = collectDisciplineArchive({
  ar: true,
  today: "2026-09-12",
  employees,
  stations,
  cases: [
    { id: "a1", employeeId: "e1", status: "notify", note: "تأخير", penalty: "حسم يوم", cutDays: 1, signedAt: "2026-09-08", signedBy: "مدير" },
    { id: "a2", employeeId: "e1", status: "hearing", note: "مفتوح", penalty: "إنذار" },
    { id: "a3", employeeId: "e1", status: "closed", note: "قديم", penalty: "حسم يومين", cutDays: 2, signedAt: "2025-08-12", rulingLabel: "نُفّذ وأُغلق" },
  ],
});
assert.equal(archive.rows.length, 2);
assert.ok(archive.groups.some((group) => group.year === "2026"));
assert.ok(archive.rows.find((row) => row.id === "a3")?.meta.includes("مُحي"));
assert.equal(collectDisciplineArchive({
  ar: true,
  today: "2026-09-12",
  employees,
  stations,
  filter: "cut",
  cases: archive.rows.length ? [
    { id: "a1", employeeId: "e1", status: "notify", note: "تأخير", penalty: "حسم يوم", cutDays: 1, signedAt: "2026-09-08" },
  ] : [],
}).rows[0].kind, "cut");

const voided = deriveDisciplineBoard({
  ar: true,
  today: "2026-09-12",
  employees,
  stations,
  cases: [{
    id: "v1",
    employeeId: "e1",
    status: "ruling",
    note: "تأخير",
    penalty: "تنبيه كتابي",
    cutDays: 0,
    signedAt: "2026-09-08",
    rulingOutcome: "void",
    rulingLabel: "أُلغي الجزاء",
  }],
});
assert.equal(voided.stats.length, 4);
assert.equal(voided.stats[3].val, "0");

const docCard = decorateDisciplineCase({
  id: "c1",
  employeeId: "e1",
  status: "hearing",
  note: "تأخير متكرر",
  penalty: "حسم يوم",
  cutDays: 1,
  createdAt: "2026-09-01",
  notifiedAt: "2026-09-01",
  hearingEndedAt: "2026-09-03",
  evidence: ["محضر"],
}, { employees, stations, ar: true, canManage: true, today: "2026-09-12" });
assert.equal(docCard.canSignDoc, true);
assert.match(docCard.docTitle, /إبلاغ/);
assert.ok(docCard.related.some((row) => row.to === "/app/payroll"));
assert.ok(docCard.related.some((row) => row.to === "/app/attendance"));
assert.ok(docCard.related.some((row) => row.to.includes("/app/employees/")));
const html = buildDisciplineNoticeHtml(docCard, true);
assert.match(html, /إبلاغ كتابي/);
assert.match(html, /أحمد/);
assert.match(html, /المادة 71/);

const law = deriveDisciplineLawBoard({
  ar: true,
  today: "2026-09-12",
  employees,
  cases: [
    { id: "c1", employeeId: "e1", status: "hearing", note: "تأخير", penalty: "حسم يوم", cutDays: 1, notifiedAt: "2026-08-01", hearingEndedAt: "2026-08-02" },
    { id: "c2", employeeId: "e1", status: "appeal", note: "تأخير", penalty: "إنذار", signedAt: "2026-09-08", appealNote: "أعترض" },
    { id: "c3", employeeId: "e1", status: "closed", note: "قديم", penalty: "حسم يوم", cutDays: 1, signedAt: "2025-08-12" },
  ],
});
assert.ok(law.rows.length >= 8);
assert.equal(law.rows.find((row) => row.id === "discipline.charge.maxDays")?.art, "69");
assert.ok((law.rows.find((row) => row.id === "discipline.charge.maxDays")?.blocked || 0) >= 1);
assert.ok((law.rows.find((row) => row.id === "discipline.appeal.internalDays")?.live || 0) >= 1);
assert.ok((law.rows.find((row) => row.id === "discipline.record.eraseDays")?.live || 0) >= 1);
assert.ok(!law.rows.some((row) => row.art === "78"));
assert.equal(law.rows.find((row) => row.id === "discipline.workplace.cite")?.art, "70");
const scoped = deriveDisciplineLawBoard({ ar: true, today: "2026-09-12", filter: "scope", cases: [] });
assert.ok(scoped.rows.every((row) => row.kind === "scope"));
assert.equal(archive.rows.find((row) => row.id === "a3")?.href, "/app/employees/e1?tab=growth");

const smart = disciplineArchiveSmartItems(archive.rows, { ar: true });
assert.equal(smart.length, archive.rows.length);
assert.equal(smart[0].id, archive.rows[0].id);
assert.ok(smart[0].title);
assert.ok(smart[0].date);
assert.ok(smart[0].search.includes(archive.rows[0].title.split(" — ")[0]));

const mineOnly = collectDisciplineArchive({
  ar: true,
  today: "2026-09-12",
  employees,
  stations,
  selfOnly: true,
  userId: "e1",
  cases: [
    { id: "a1", employeeId: "e1", status: "notify", note: "تأخير", penalty: "حسم يوم", cutDays: 1, signedAt: "2026-09-08" },
    { id: "b1", employeeId: "e2", status: "notify", note: "آخر", penalty: "إنذار", signedAt: "2026-09-08" },
  ],
});
assert.equal(mineOnly.rows.length, 1);
assert.equal(mineOnly.rows[0].id, "a1");
assert.match(mineOnly.note, /في ملفك/);

const manageScope = collectDisciplineArchive({
  ar: true,
  today: "2026-09-12",
  employees,
  stations,
  selfOnly: false,
  cases: [
    { id: "a1", employeeId: "e1", status: "notify", note: "تأخير", penalty: "حسم يوم", cutDays: 1, signedAt: "2026-09-08" },
    { id: "open", employeeId: "e1", status: "hearing", note: "مفتوح", penalty: "إنذار" },
  ],
});
assert.equal(manageScope.rows.length, 1, "manage archive is settled-only");
assert.ok(!manageScope.rows.some((row) => row.id === "open"));

assert.equal(checkWorkplaceDisciplineGate({ offSite: true }, { today: "2026-09-12" }).error, "DISCIPLINE_OFFSITE_UNRELATED");
assert.equal(checkWorkplaceDisciplineGate({ offSite: true, workConnected: "إساءة لمدير الفرع خارج المحطة" }, { today: "2026-09-12" }).ok, true);
assert.equal(checkRaiseDisciplineGate({
  employee: employees[0],
  actor: { id: "mgr" },
  note: "مشادة خارج المحطة",
  today: "2026-09-12",
  offSite: true,
}).error, "DISCIPLINE_OFFSITE_UNRELATED");
assert.equal(checkRaiseDisciplineGate({
  employee: employees[0],
  actor: { id: "mgr" },
  note: "مشادة خارج المحطة",
  today: "2026-09-12",
  offSite: true,
  workConnected: "متصلة بالمدير المسؤول",
}).ok, true);

assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", penaltyKind: "warning" }, "hearing").error, "DISCIPLINE_HEARING_MINUTES");
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", penaltyKind: "warning", hearingMinutes: "سُمع شفاهة" }, "hearing").ok, true);
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", penaltyKind: "warning", hearingMinutes: "سُمع شفاهة" }, "hearing").oral, true);
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", penaltyKind: "suspend", cutDays: 2 }, "hearing").error, "DISCIPLINE_EVIDENCE_REQUIRED");
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", penaltyKind: "suspend", cutDays: 2, hearingMinutes: "دفاعه مكتوب" }, "hearing").ok, true);

assert.ok(countDaysExcludingOfficialHolidays("2026-09-15", "2026-10-16") < 32);
assert.equal(checkAdvanceDisciplineGate(
  { employeeId: "e1", signedAt: "2026-09-15", messages: [{ from: "employee", text: "أتظلم" }] },
  "appeal",
  { today: "2026-10-16" },
).ok, true, "Art. 72 excludes National Day 23 Sep from the 30-day clock");
assert.equal(checkAdvanceDisciplineGate(
  { employeeId: "e1", signedAt: "2026-09-15", messages: [{ from: "employee", text: "أتظلم" }] },
  "appeal",
  { today: "2026-10-17" },
).error, "DISCIPLINE_APPEAL_LATE");

console.log("discipline board ok");
