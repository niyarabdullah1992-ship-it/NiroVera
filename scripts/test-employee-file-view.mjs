import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { employeeFileHoursView, employeeFileLaborWeek, employeeFileNightPanel, weekStartDate } from "../src/lib/shiftWeek.js";
import { migratePreviewOwnerMorningRota } from "../src/lib/previewMigrations.js";
import { collectRequestInbox, isCoworkerDutyInboxNotice } from "../src/lib/requestWorkspace.js";
import {
  buildEmployeeFileView,
  countAr,
  employeeCustodyRows,
  employeeFileDraftSeed,
  employeeFileHoursAlerts,
  employeeFileVoice,
  employeeWageSplit,
  hasPendingLeaveDecision,
  hasPendingLeaveFilePointer,
  isViewerOwnFile,
  requestSelfEmployee,
  leaveCatalogFor,
  leaveOnFile,
  moneySar,
  pendingLeavePointerCopy,
  serviceLabel,
  splitEmployeeFileDraft,
} from "../src/lib/employeeFileView.js";

assert.equal(countAr(0, "يوم", "يومان", "أيام", "يوماً", "لا شيء"), "لا شيء");
assert.equal(countAr(1, "يوم", "يومان", "أيام", "يوماً"), "يوم");
assert.equal(countAr(2, "يوم", "يومان", "أيام", "يوماً"), "يومان");
assert.equal(moneySar(13500, true), "13,500 ر.س");

const split = employeeWageSplit({
  baseSalary: 10000,
  housingAllowance: 2000,
  transportAllowance: 1000,
  otherAllowances: 500,
});
assert.equal(split.total, 13500);
assert.equal(split.split, true);
assert.equal(employeeWageSplit({ baseSalary: 8000, allowances: 1500 }).total, 9500);
assert.equal(employeeWageSplit({
  baseSalary: 8000,
  allowances: 1500,
  nightRemedy: { kind: "allowance", amount: 400, allowanceKind: "pay" },
  nightAllowance: 400,
}).total, 9900);
assert.equal(employeeWageSplit({
  baseSalary: 8000,
  allowances: 1500,
}, { profile: { baseSalary: 8000, allowances: 1500, nightRemedy: { kind: "allowance", amount: 400, allowanceKind: "pay" } } }).night, 400);

const service = serviceLabel("2020-01-15", true, "2026-09-12");
assert.match(service, /سنوات|سنة|سنتان/);
assert.match(service, /شهر|شهران|أشهر|شهراً/);

const maleGroups = leaveCatalogFor({ gender: "male" }, true);
assert.equal(maleGroups.length, 3);
assert.ok(maleGroups.some((group) => group.rows.some((row) => row.art === "113" && /أبوة/.test(row.name))));
assert.ok(!maleGroups.some((group) => group.rows.some((row) => row.art === "151" || row.art === "160")));
const femaleGroups = leaveCatalogFor({ gender: "female" }, true);
assert.equal(femaleGroups.length, 4);
assert.ok(femaleGroups.some((group) => group.rows.some((row) => row.art === "151")));
assert.ok(femaleGroups.some((group) => group.rows.some((row) => row.art === "151" && /تمديد|مرافقة/.test(row.name))));
assert.ok(femaleGroups.some((group) => group.rows.some((row) => row.art === "160")));
assert.ok(!femaleGroups.some((group) => group.rows.some((row) => /أبوة/.test(row.name))));
const nonMuslimFemale = leaveCatalogFor({ gender: "female", religion: "non_muslim" }, true);
assert.ok(nonMuslimFemale.some((group) => group.rows.some((row) => row.art === "160" && /15/.test(row.ent))));
assert.ok(!nonMuslimFemale.some((group) => group.rows.some((row) => row.art === "114")));

const custody = employeeCustodyRows([
  { name: "هاتف", code: "A1", holderId: "e1", status: "in_custody", handedAt: "2026-01-20" },
  { name: "حاسب", code: "A2", holderId: "e1", returnedAt: "2025-01-01", status: "available" },
  { name: "أخرى", code: "A3", holderId: "other", status: "in_custody" },
], "e1", true);
assert.equal(custody.length, 2);
assert.equal(custody.filter((row) => row.open).length, 1);

const employee = {
  id: "e1",
  name: "عمر ناصر",
  phone: "0500000001",
  profile: {
    hireDate: "2020-01-15",
    baseSalary: 10000,
    housingAllowance: 2000,
    transportAllowance: 1000,
    otherAllowances: 500,
    contractType: "indefinite",
    qiwaTitle: "مشرف تشغيل",
    gosiNumber: "1XX",
    iban: "SA000",
    nationality: "سعودي",
    idType: "national_id",
    nationalId: "1000000001",
    idExpiry: "2031-05-14",
    medicalInsuranceExpiry: "2026-12-31",
    gender: "male",
    maritalStatus: "married",
    dependents: 2,
    position: "مشرف تشغيل",
    contractPdf: "PWC-FILE",
  },
  leaveRequests: [
    { type: "annual", status: "approved", days: 5, startDate: "2026-06-01", endDate: "2026-06-05", reviewedAt: "2026-05-20T10:00:00" },
  ],
};

const view = buildEmployeeFileView({
  employee,
  stationName: "فرع الخفجي",
  roleLabel: "مشرف تشغيل",
  cases: [],
  assets: [
    { name: "هاتف", code: "A1", holderId: "e1", status: "in_custody", handedAt: "2026-01-20" },
  ],
  ar: true,
  today: "2026-09-12",
});

assert.equal(view.facts.length, 6);
assert.equal(view.facts[0].k, "العقد");
assert.equal(view.facts[1].k, "الأجر الشهري");
assert.equal(view.facts[2].k, "مدة الخدمة");
assert.equal(view.facts[3].k, "رصيد الإجازة السنوية");
assert.equal(view.facts[4].k, "مكافأة نهاية الخدمة");
assert.equal(view.facts[5].k, "العهد بحوزته");
assert.match(view.facts[1].v, /13,500/);
assert.match(view.facts[2].v, /سنوات|سنة|سنتان/);
assert.ok(view.eosNow > 0);
assert.equal(view.compliance.length, 4);
assert.equal(view.idCards.length, 6);
assert.ok(
  view.idCards.some((card) => (card.rows || []).some((row) => row.field === "religion")),
  "identity file always shows religion for Ramadan, Hajj and iddah",
);
assert.ok(
  view.idCards.some((card) => (card.rows || []).some((row) => row.field === "gender")),
  "identity file classifies gender for women's and paternity leave",
);
assert.match(
  view.idCards.flatMap((card) => card.rows || []).find((row) => row.field === "religion")?.v || "",
  /مسلم/,
);
assert.equal(view.platforms.length, 5);
assert.equal(view.leaveGroups.length, 3);
assert.equal(view.filed.length, 1);
assert.equal(view.hasPendingLeave, false);
assert.equal(leaveOnFile(employee.leaveRequests).length, 1);

const withPending = {
  ...employee,
  leaveRequests: [
    ...employee.leaveRequests,
    { id: "lv-pend", type: "unpaid", status: "pending", days: 1, startDate: "2026-09-20", endDate: "2026-09-20" },
  ],
};
const pendingView = buildEmployeeFileView({ employee: withPending, ar: true, today: "2026-09-12" });
assert.equal(hasPendingLeaveDecision(withPending.leaveRequests), true);
assert.equal(leaveOnFile(withPending.leaveRequests).length, 1);
assert.equal(pendingView.filed.length, 1, "file board does not list the pending row");
assert.equal(pendingView.hasPendingLeave, true);
assert.equal(pendingView.pendingPointer, pendingLeavePointerCopy(true));
assert.equal(pendingView.filedEmpty, "لا توجد طلبات إجازة بعد");
assert.ok(pendingView.todos.some((row) => row.text === pendingLeavePointerCopy(true)));

const withTopup = {
  ...employee,
  otherRequests: [{ id: "top-pend", type: "leave_topup", status: "pending", days: 2, reason: "منحة" }],
};
const topupView = buildEmployeeFileView({ employee: withTopup, ar: true, today: "2026-09-12" });
assert.equal(hasPendingLeaveDecision(withTopup.leaveRequests), false);
assert.equal(hasPendingLeaveFilePointer(withTopup), true);
assert.equal(topupView.hasPendingLeave, true);
assert.equal(topupView.pendingPointer, pendingLeavePointerCopy(true));
assert.equal(topupView.filed.length, 1);

assert.equal(view.custody.filter((row) => row.open).length, 1);
assert.ok(!view.facts.some((fact) => /محطة|فرع|المسمى/.test(fact.k)));

const seed = employeeFileDraftSeed(employee);
assert.equal(seed.name, "عمر ناصر");
const parted = splitEmployeeFileDraft({ ...seed, baseSalary: "11000", name: "عمر ن." });
assert.equal(parted.profile.baseSalary, 11000);
assert.equal(parted.name, "عمر ن.");

const hoursSrc = readFileSync(new URL("../src/components/employees/HoursOnFile.jsx", import.meta.url), "utf8");
const railSrc = readFileSync(new URL("../src/components/employees/FileHoursAlertsRail.jsx", import.meta.url), "utf8");
const cardSrc = readFileSync(new URL("../src/components/employees/DutyStripAlertCard.jsx", import.meta.url), "utf8");
assert.match(hoursSrc, /rosterMineScopeCopy/, "file hours states the work-branch lock");
assert.match(hoursSrc, /\/app\/shifts\?lane=manage/, "other rosters from the file open إدارة");
assert.match(hoursSrc, /employeeFileHoursView/, "file hours board uses the open-file hours view");
assert.match(hoursSrc, /FileHoursAlertsRail/, "left rail is the shared file-owner alerts slot");
assert.match(hoursSrc, /nv-ops-cal-board/, "alerts sit beside the file week, not on roster names");
assert.match(railSrc, /employeeFileHoursAlerts/, "left rail is derived file alerts, not a night essay");
assert.match(cardSrc, /nv-duty-circular/, "due rows stay the shared person register");
assert.doesNotMatch(cardSrc, /docFrame/, "file duty row is not a nested 14px stamp");
assert.match(cardSrc, /letterSpacing: 0/, "file duty Arabic keeps letter-spacing 0");
assert.match(railSrc, /docFrame\(due \? "blocked" : "settled"\)/, "تنبيهاتي due frame is the platform red wash");
assert.match(railSrc, /--nv-bad-soft/, "due تنبيهاتي wash matches attendance broken-row red");
assert.match(cardSrc, /showChip=\{false\}/, "circular instrument is not a green pill");
assert.match(railSrc, /voice\.warnings/, "left rail title is تنبيهاتي or تنبيهاته");
assert.match(railSrc, /emptyAlert/, "empty left rail is a short empty line");
assert.match(railSrc, /chip\.decisionId/, "due/in-scope 18632 stays a short chip");
assert.match(railSrc, /DutyStripAlertCard/, "due rows use the shared إنذار card");
assert.doesNotMatch(railSrc, /تنبيهك/, "own-file rail does not stack تنبيهك under تنبيهاتي");
assert.match(hoursSrc, /LaborArticleCite/, "file hour checks keep the article number");
assert.match(hoursSrc, /showEssay \? \(/, "essay stays quiet unless due or failing");
assert.doesNotMatch(hoursSrc, /if \(!showStatutoryHeaderCite/, "quiet glow must not hide المادة / قرار chips");
assert.doesNotMatch(`${hoursSrc}\n${railSrc}`, /العمل الليلي/, "left rail is not a night-law heading");
assert.doesNotMatch(`${hoursSrc}\n${railSrc}`, /23:00/, "night window definition is not in the hours header");
assert.doesNotMatch(`${hoursSrc}\n${railSrc}`, /مصدر الوقت|مصدر الساعة/, "clock source is not in the hours header");
assert.doesNotMatch(`${hoursSrc}\n${railSrc}`, /تعويض ليلي/, "compensation copy is not in the hours header");
assert.doesNotMatch(`${hoursSrc}\n${railSrc}`, /لا عامل ليلي/, "empty night-watch copy is not a fake alert");
assert.doesNotMatch(`${hoursSrc}\n${railSrc}`, /CONSENT_MINISTRY_HINT/, "ministry essay is not on the hours rail");
assert.doesNotMatch(hoursSrc, /nightSubject/, "left rail does not print a night subject name");
assert.doesNotMatch(hoursSrc, /weekRosterEmployees/, "file week is not the station roster");
assert.doesNotMatch(hoursSrc, /buildNightWatch/, "file must not call the station night watch");
assert.doesNotMatch(hoursSrc, /row\.employee\.name/, "file night strip does not print a coworker name");
assert.doesNotMatch(hoursSrc, /nv-roster-name/, "red pulse is the left strip, not the roster name");

const fileWeek = weekStartDate("2026-09-06");
const morning = { id: "morning", label: "صباحي", start: "07:00", end: "15:00", restMinutes: 30 };
const night = { id: "night", label: "ليلي", start: "23:00", end: "07:00", restMinutes: 30 };
const niyar = { id: "niyar", name: "نيار عبدالله", stationId: "st", profile: {}, leaveRequests: [], otherRequests: [] };
const omarOnFile = { id: "omar", name: "عمر ناصر", stationId: "st", profile: {}, leaveRequests: [], otherRequests: [] };
const mixedStation = {
  stationId: "st",
  shiftTypes: [morning, night],
  assignments: {
    "2026-09-06": { morning: ["niyar"], night: ["omar"] },
    "2026-09-07": { morning: ["niyar"], night: ["omar"] },
    "2026-09-08": { morning: ["niyar"], night: ["omar"] },
    "2026-09-09": { morning: ["niyar"], night: ["omar"] },
    "2026-09-10": { morning: ["niyar"], night: ["omar"] },
  },
};
const niyarPanel = employeeFileNightPanel({ employee: niyar, schedule: mixedStation, weekStart: fileWeek, ar: true });
assert.equal(niyarPanel.rows.length, 0, "morning-only file stays quiet");
assert.ok(!niyarPanel.names.includes("عمر ناصر"));
assert.doesNotMatch(niyarPanel.text || "", /عمر/);
const niyarHours = employeeFileHoursView({
  employee: niyar,
  schedule: mixedStation,
  weekStart: fileWeek,
  ar: true,
  coworkers: [niyar, omarOnFile],
});
assert.equal(niyarHours.nightRows.length, 0, "morning file has no named night streak");
assert.equal(niyarHours.hasCoworkerName, false, "morning file copy must not name the night coworker");
assert.doesNotMatch(niyarHours.text, /عمر ناصر/);
assert.doesNotMatch(niyarHours.text, /تعويض ليلي|23:00–06:00|23:00-06:00|لا عامل ليلي/);
const niyarChecks = employeeFileLaborWeek({ employee: niyar, schedule: mixedStation, weekStart: fileWeek, ar: true });
const niyarCheckText = niyarChecks.checks.map((row) => `${row.title} ${row.note}`).join("\n");
assert.doesNotMatch(niyarCheckText, /عمر/);
assert.doesNotMatch(niyarCheckText, /تعويض ليلي|23:00|لا عامل ليلي/, "morning file checks are not a night-law essay");
assert.ok(!niyarChecks.checks.some((row) => row.id === "night_compensate" || row.id === "night_rotate"));
const omarPanel = employeeFileNightPanel({ employee: omarOnFile, schedule: mixedStation, weekStart: fileWeek, ar: true });
assert.deepEqual(omarPanel.names, ["عمر ناصر"]);
assert.match(omarPanel.text, /0 شهر متواصل/);
const omarHours = employeeFileHoursView({
  employee: omarOnFile,
  schedule: mixedStation,
  weekStart: fileWeek,
  ar: true,
  coworkers: [niyar, omarOnFile],
});
assert.equal(omarHours.nightRows.length, 1);
assert.equal(omarHours.hasCoworkerName, false, "Omar's file does not print Niyar");
assert.equal(omarHours.checks.find((row) => row.id === "night_medical")?.ok, false, "Omar night week without a file is unmet 18632 medical");
assert.equal(omarHours.checks.find((row) => row.id === "night_medical")?.block, false);
assert.ok(!niyarHours.checks.some((row) => row.id === "night_medical"));
assert.ok(!niyarChecks.checks.some((row) => row.id === "night_medical"), "morning file hides the night-worker medical card");
assert.match(hoursSrc, /NightMedicalFileField/, "file hours unmet medical is a طلباتي notice");
assert.doesNotMatch(hoursSrc, /uploadFileOrLocal|type=["']file["']/, "file hours medical check does not embed upload");
assert.doesNotMatch(railSrc, /NightMedicalFileField|uploadFileOrLocal|type=["']file["']/, "night strip does not embed upload");
assert.match(readFileSync(new URL("../src/components/employees/ProfessionalInfoTab.jsx", import.meta.url), "utf8"), /NightMedicalFileField/);
assert.match(readFileSync(new URL("../src/components/employees/NightMedicalFileField.jsx", import.meta.url), "utf8"), /افتح التقرير الطبي/);
assert.match(readFileSync(new URL("../src/components/employees/NightMedicalFileField.jsx", import.meta.url), "utf8"), /افتح لياقة ليلية في طلباتي/);

const niyarViewer = { id: "niyar", employeeId: "niyar" };
assert.equal(isViewerOwnFile(niyar, niyarViewer), true);
assert.equal(isViewerOwnFile(omarOnFile, niyarViewer), false);
const sessionAlias = { id: "user_niyar", employeeId: "niyar" };
assert.equal(isViewerOwnFile(niyar, sessionAlias), true, "session id may differ from employee.id");
assert.equal(requestSelfEmployee(sessionAlias, [omarOnFile, niyar])?.id, niyar.id);
const ahmedCoworker = { id: "emp_manager_preview", employeeId: "emp_manager_preview", name: "أحمد السالم" };
const niyarHeadFile = { id: "emp_owner_preview", employeeId: "emp_owner_preview", name: "نيار عبدالله" };
assert.equal(isViewerOwnFile(ahmedCoworker, niyarHeadFile), false, "isViewerOwnFile must not match a coworker");
assert.equal(isViewerOwnFile(niyarHeadFile, { id: "user_niyar", employeeId: "emp_owner_preview" }), true);
assert.equal(requestSelfEmployee(niyarHeadFile, [ahmedCoworker, niyarHeadFile])?.id, "emp_owner_preview");
assert.equal(requestSelfEmployee({ id: "", employeeId: "" }, [ahmedCoworker, niyarHeadFile])?.id, undefined);
const ownVoice = employeeFileVoice({ employee: niyar, currentUser: niyarViewer, ar: true });
assert.equal(ownVoice.own, true);
assert.match(ownVoice.title, /ملفي/);
assert.match(ownVoice.warnings, /تنبيهاتي/);
assert.equal(ownVoice.alerts, "تنبيهاتي");
assert.equal(ownVoice.emptyAlert, "لا تنبيه مستحق");
assert.equal(ownVoice.nightSubject, "ملفي");
assert.doesNotMatch(`${ownVoice.title} ${ownVoice.warnings} ${ownVoice.alerts} ${ownVoice.nightSubject}`, /عمر/);
assert.doesNotMatch(niyarHours.text, /عمر ناصر/);
const otherVoice = employeeFileVoice({ employee: omarOnFile, currentUser: niyarViewer, ar: true });
assert.equal(otherVoice.own, false);
assert.match(otherVoice.title, /عمر ناصر/);
assert.doesNotMatch(otherVoice.title, /ملفي/);
assert.match(otherVoice.warnings, /تنبيهاته/);
assert.equal(otherVoice.alerts, "تنبيهاته");
assert.equal(otherVoice.nightSubject, "عمر ناصر");

const heroSrc = readFileSync(new URL("../src/components/employees/ProfileHero.jsx", import.meta.url), "utf8");
assert.match(heroSrc, /employeeFileVoice/, "hero kicker uses viewer voice");
assert.match(heroSrc, /FileSelfBadge/, "own file shows ملفي badge");
const profileSrc = readFileSync(new URL("../src/pages/EmployeeProfile.jsx", import.meta.url), "utf8");
assert.match(profileSrc, /voice\.title/, "page header is ملفي or ملف {name}");
assert.match(profileSrc, /voice\.warnings/, "page kicker is تنبيهاتي or تنبيهاته");
assert.match(railSrc, /employeeFileVoice/, "hours rail uses viewer voice");
assert.match(railSrc, /voice\.warnings/, "hours left rail is تنبيهاتي or تنبيهاته");
const niyarAlerts = employeeFileHoursAlerts({
  employee: niyar,
  schedule: { ...mixedStation, nightCompensation: true },
  weekStart: fileWeek,
  ar: true,
});
assert.equal(niyarAlerts.empty, true, "morning file left rail has no owed chip");
assert.equal(niyarAlerts.text, "");
assert.doesNotMatch(niyarAlerts.text, /عمر|تعويض ليلي|23:00|18632|لا عامل ليلي/);
const omarAlerts = employeeFileHoursAlerts({
  employee: omarOnFile,
  schedule: mixedStation,
  weekStart: fileWeek,
  ar: true,
});
assert.equal(omarAlerts.empty, false);
assert.ok(omarAlerts.chips.some((row) => row.id === "18632" && !row.due), "Omar in-scope night is a green chip");
assert.equal(omarAlerts.chips.find((row) => row.id === "18632")?.glow, "in_scope");
assert.doesNotMatch(omarAlerts.text, /نيار|تعويض ليلي/);
const alertsSrc = readFileSync(new URL("../src/components/employees/EmpAlertsStrip.jsx", import.meta.url), "utf8");
assert.match(alertsSrc, /voice\.warnings/, "alerts strip is تنبيهاتي on own file");
assert.doesNotMatch(alertsSrc, /showText/, "ملفي alerts strip stays chips, not night-law essays");
const inboxSrc = readFileSync(new URL("../src/components/requests/RequestInboxSlab.jsx", import.meta.url), "utf8");
assert.match(inboxSrc, /إشعاراتي/, "ملفي inbox title stays إشعاراتي");
assert.match(inboxSrc, /ownOnly/, "ملفي inbox is own pending and own due");
assert.equal(isCoworkerDutyInboxNotice("عمر ناصر — موافقة ليلية سارية (3 أشهر). تبقى حمراء حتى يختار الموظف."), true);
assert.equal(isCoworkerDutyInboxNotice("عمر ناصر مستحق موافقة خطية ليلية (القرار 18632) بعد 3 أشهر."), true);
assert.equal(isCoworkerDutyInboxNotice("سارية في طلباتي بعد 3 أشهر كعامل ليلي (القرار 18632)."), false);
assert.equal(isCoworkerDutyInboxNotice("مستحق في طلباتي بعد 3 أشهر كعامل ليلي (القرار 18632). وافق أو ارفض."), false);
const ownInbox = collectRequestInbox(
  [niyar, omarOnFile],
  [
    { userId: "niyar", text: "عمر ناصر — موافقة ليلية سارية (3 أشهر).", createdAt: "2026-09-14" },
    { userId: "niyar", text: "سارية في طلباتي بعد 3 أشهر كعامل ليلي (القرار 18632).", createdAt: "2026-09-14" },
  ],
  "niyar",
  "ar",
  { ownOnly: true },
);
assert.ok(!ownInbox.some((row) => /عمر/.test(`${row.head} ${row.body}`)), "ملفي inbox drops Omar's due");
assert.ok(ownInbox.some((row) => /18632/.test(`${row.head} ${row.body}`)), "ملفي inbox keeps own 18632 due");

const dirtyPreview = {
  ownerId: "emp_owner_preview",
  employees: [
    { id: "emp_owner_preview", name: "نيار عبدالله", role: "director", stationId: "st" },
    { id: "emp_field_preview", name: "عمر ناصر", role: "employee", stationId: "st" },
  ],
  schedules: [{
    stationId: "st",
    shiftTypes: [morning, { id: "evening", label: "مسائي", start: "15:00", end: "23:00", restMinutes: 30 }, night],
    assignments: {
      "2026-09-16": { morning: [], night: ["emp_field_preview", "emp_owner_preview"] },
      "2026-09-17": { morning: [], evening: ["emp_owner_preview"], night: ["emp_field_preview"] },
    },
  }],
};
assert.equal(migratePreviewOwnerMorningRota(dirtyPreview), true);
assert.deepEqual(dirtyPreview.schedules[0].assignments["2026-09-16"].morning, ["emp_owner_preview"]);
assert.deepEqual(dirtyPreview.schedules[0].assignments["2026-09-16"].night, ["emp_field_preview"]);
assert.ok(!dirtyPreview.schedules[0].assignments["2026-09-17"].evening.includes("emp_owner_preview"));
assert.ok(dirtyPreview.schedules[0].assignments["2026-09-17"].morning.includes("emp_owner_preview"));
assert.equal(migratePreviewOwnerMorningRota(dirtyPreview), false, "owner morning pin is idempotent");
const pinnedNiyar = employeeFileHoursAlerts({
  employee: { id: "emp_owner_preview", name: "نيار عبدالله", stationId: "st", profile: {}, leaveRequests: [], otherRequests: [] },
  schedule: dirtyPreview.schedules[0],
  weekStart: fileWeek,
  ar: true,
});
assert.equal(pinnedNiyar.empty, true);
assert.doesNotMatch(pinnedNiyar.text, /تعويض ليلي|23:00|18632|لا عامل ليلي/);

console.log("employee-file-view: ok");
