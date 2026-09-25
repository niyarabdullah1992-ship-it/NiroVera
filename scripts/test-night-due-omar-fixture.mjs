/**
 * Preview-shaped fixture: عمر ناصر (night 23:00 on الخفجي) is due;
 * نيار عبدالله stays morning on his own ملفي week — never Omar, never Omar’s red 18632.
 */
import assert from "node:assert/strict";
import { nightDueAdminNotifyKey, nightDueNotifyKey, planNightDueAdminNotifications, planNightDueNotifications } from "../src/lib/nightDueNotify.js";
import { nightCycleKey } from "../src/lib/nightRotateCycle.js";
import { nightDueScopeEmployees, requestManageEmployees } from "../src/lib/dutyScope.js";
import {
  collectSuiteBadges,
  nightDueAdminEmployees,
  isNightDueEmployee,
  suiteAppGlow,
} from "../src/lib/suiteBadges.js";
import {
  addDays,
  employeeFileHoursView,
  employeeFileLaborWeek,
  employeeFileNightPanel,
  weekDateKeys,
  weekStartDate,
} from "../src/lib/shiftWeek.js";
import { nightMedicalDutyState, nightMedicalFileSatisfied } from "../src/lib/decision18632.js";
import { laborDayKey } from "../src/lib/laborRules.js";
import { statutoryChipStyle, statutoryGlowState } from "../src/lib/statutoryItem.js";

const WEEK = weekStartDate("2026-09-06");
const PERIOD = nightCycleKey(WEEK);
const NIYAR_ID = "emp_owner_preview";
const OMAR_ID = "emp_field_preview";
const MGR_ID = "emp_manager_preview";
const STATION = "st_north_preview";

const morning = { id: "morning", label: "صباحي", start: "07:00", end: "15:00", restMinutes: 30 };
const evening = { id: "evening", label: "مسائي", start: "15:00", end: "23:00", restMinutes: 30 };
const night = { id: "night", label: "ليلي", start: "23:00", end: "07:00", restMinutes: 30 };

const niyar = {
  id: NIYAR_ID,
  name: "نيار عبدالله",
  email: "preview@nirovera.local",
  role: "director",
  stationId: STATION,
  managedStations: [STATION],
  profile: {},
  leaveRequests: [],
  otherRequests: [],
};
const omar = {
  id: OMAR_ID,
  name: "عمر ناصر",
  email: "omar@nirovera.local",
  role: "employee",
  stationId: STATION,
  profile: {},
  leaveRequests: [],
  otherRequests: [],
};
const stationMgr = {
  id: MGR_ID,
  name: "أحمد السالم",
  email: "ahmed@nirovera.local",
  role: "station_manager",
  stationId: STATION,
  managedStations: [STATION],
  profile: {},
  leaveRequests: [],
  otherRequests: [],
};

function weekdayKeys(start) {
  return weekDateKeys(start).filter((key) => {
    const wd = new Date(`${key}T00:00:00`).getDay();
    return wd >= 0 && wd <= 4;
  });
}

/** Station board like preview: Niyar morning, Omar night — 14 dated night-worker weeks for Omar only. */
function khafjiSchedule() {
  const assignments = {
    0: { morning: [NIYAR_ID], night: [OMAR_ID] },
    1: { morning: [NIYAR_ID], night: [OMAR_ID] },
    2: { morning: [NIYAR_ID], night: [OMAR_ID] },
    3: { morning: [NIYAR_ID], night: [OMAR_ID] },
    4: { morning: [NIYAR_ID], night: [OMAR_ID] },
  };
  for (let w = 0; w < 14; w += 1) {
    const start = addDays(WEEK, -7 * w);
    for (const key of weekdayKeys(start)) {
      const day = { ...(assignments[key] || {}) };
      if (w === 0) day.morning = [NIYAR_ID];
      day.night = [OMAR_ID];
      assignments[key] = day;
    }
  }
  return {
    id: "sch_1",
    stationId: STATION,
    published: true,
    nightCompensation: true,
    shiftTypes: [morning, evening, night],
    assignments,
  };
}

const schedule = khafjiSchedule();
const data = {
  ownerId: NIYAR_ID,
  stations: [{ id: STATION, name: "فرع الخفجي" }],
  employees: [niyar, stationMgr, omar],
  schedules: [schedule],
};

const omarGlow = statutoryGlowState({ kind: "18632", employee: omar, schedule, weekStart: WEEK });
assert.equal(omarGlow, "due", "عمر ناصر — 13 dated night-worker weeks glow due");
assert.equal(isNightDueEmployee(omar, data, WEEK), true);

const omarChip = statutoryChipStyle("entitlement", { glow: omarGlow });
assert.equal(omarChip["--nv-stat-glow"], "transparent", "Omar due cite has no outer glow");
assert.match(String(omarChip.color), /nv-warn|#8A6516/, "Omar due chip is warn — not منع red");
assert.match(String(omarChip.background), /nv-warn|#FDF6E8/);
assert.doesNotMatch(String(omarChip.background), /nv-danger|#DC2626|nv-bad/);

const niyarGlow = statutoryGlowState({ kind: "18632", employee: niyar, schedule, weekStart: WEEK });
assert.equal(niyarGlow, "off", "نيار stays morning — 18632 not due on his file");
assert.equal(isNightDueEmployee(niyar, data, WEEK), false);
const niyarChip = statutoryChipStyle("entitlement", { glow: niyarGlow });
assert.equal(niyarChip["--nv-stat-glow"], "transparent", "Niyar 18632 chip has no glow");
assert.match(String(niyarChip.background), /nv-soft|#F7F8FA/, "Niyar quiet 18632 is soft navy");
assert.doesNotMatch(String(niyarChip.background), /nv-danger|#DC2626|nv-accent|#1E9E63/);

const niyarHours = employeeFileHoursView({
  employee: niyar,
  schedule,
  weekStart: WEEK,
  ar: true,
  coworkers: data.employees,
});
assert.equal(niyarHours.nightRows.length, 0, "Niyar ملفي has no night streak row");
assert.equal(niyarHours.hasCoworkerName, false, "Niyar ملفي copy must not name Omar");
assert.doesNotMatch(niyarHours.text, /عمر ناصر/);
assert.doesNotMatch(niyarHours.text, /18632-due/);
assert.doesNotMatch(niyarHours.text, /تعويض ليلي|23:00|لا عامل ليلي/);
const niyarPanel = employeeFileNightPanel({ employee: niyar, schedule, weekStart: WEEK, ar: true });
assert.ok(!niyarPanel.names.includes("عمر ناصر"));
assert.doesNotMatch(niyarPanel.text || "", /عمر/);
const niyarChecks = employeeFileLaborWeek({ employee: niyar, schedule, weekStart: WEEK, ar: true });
assert.doesNotMatch(niyarChecks.checks.map((row) => row.note).join(" "), /عمر/);

const omarHours = employeeFileHoursView({
  employee: omar,
  schedule,
  weekStart: WEEK,
  ar: true,
  coworkers: data.employees,
});
assert.equal(omarHours.nightRows.length, 1);
assert.deepEqual(omarHours.nightRows.map((row) => row.employee?.id), [OMAR_ID]);
assert.equal(omarHours.hasCoworkerName, false, "Omar file does not print Niyar");
assert.ok(omarHours.nightRows[0].over, "Omar night watch is over the 3-month line");
const omarMed = omarHours.checks.find((row) => row.id === "night_medical");
assert.equal(omarMed?.ok, false, "Omar night worker without a filed report — unmet 18632 medical card");
assert.equal(omarMed?.block, false, "missing file does not newly block publish");
assert.equal(omarMed?.error, "NIGHT_MEDICAL_FILE_MISSING");
assert.equal(nightMedicalFileSatisfied(omar, WEEK), false);
assert.equal(nightMedicalDutyState({ employee: omar, shift: night, onDate: WEEK }).unmet, true);
assert.equal(omar.profile?.nightMedicalReport, undefined, "Omar seed stays without a permanent medical file");
const previewIssued = laborDayKey(WEEK);
const omarTempFile = {
  ...omar,
  profile: {
    nightMedicalReport: {
      url: "/preview-night-fitness.txt",
      name: "معاينة-تقرير-لياقة-ليلية.txt",
      issuedAt: previewIssued,
    },
    nightMedicalIssuedAt: previewIssued,
  },
};
const omarFiledHours = employeeFileHoursView({
  employee: omarTempFile,
  schedule,
  weekStart: WEEK,
  ar: true,
  coworkers: data.employees,
});
assert.equal(omarFiledHours.checks.find((row) => row.id === "night_medical")?.ok, true, "preview attach fulfills the medical card");
assert.equal(nightMedicalFileSatisfied(omarTempFile, WEEK), true);
assert.equal(nightMedicalFileSatisfied(omar, WEEK), false, "Omar seed is left unmet — no permanent file");

const expectedKey = nightDueNotifyKey(OMAR_ID, PERIOD);
assert.equal(expectedKey, `18632-due:${OMAR_ID}:${PERIOD}`);
const firstNotify = planNightDueNotifications({
  employees: [omar, niyar],
  data,
  weekStart: WEEK,
});
assert.equal(firstNotify.length, 1, "one employee notice — Omar only");
assert.equal(firstNotify[0].employeeId, OMAR_ID);
assert.equal(firstNotify[0].key, expectedKey);
const secondNotify = planNightDueNotifications({
  employees: [omar, niyar],
  data,
  weekStart: WEEK,
  existingKeys: firstNotify.map((row) => row.key),
});
assert.equal(secondNotify.length, 0, "same due cycle does not notify again");
assert.equal(planNightDueNotifications({
  employees: [niyar],
  data,
  weekStart: WEEK,
}).length, 0, "Niyar morning week does not notify");

const adminNotify = planNightDueAdminNotifications({
  employees: [omar, niyar],
  data,
  weekStart: WEEK,
});
assert.ok(adminNotify.some((row) => row.managerId === NIYAR_ID && row.employeeId === OMAR_ID), "إدارة نيار is told Omar is due");
assert.ok(adminNotify.some((row) => row.managerId === MGR_ID && row.employeeId === OMAR_ID), "إدارة أحمد is told Omar is due");
assert.ok(!adminNotify.some((row) => row.managerId === OMAR_ID), "Omar does not get an إدارة notice about himself");
assert.ok(!adminNotify.some((row) => row.employeeId === NIYAR_ID), "morning Niyar does not generate an إدارة due notice");
assert.equal(
  adminNotify.find((row) => row.managerId === MGR_ID)?.key,
  nightDueAdminNotifyKey(MGR_ID, OMAR_ID, PERIOD),
);

assert.ok(requestManageEmployees(niyar, data).some((row) => row.id === OMAR_ID), "director إدارة covers Omar");
assert.ok(nightDueScopeEmployees(niyar, data).some((row) => row.id === OMAR_ID));
const adminDue = nightDueAdminEmployees(niyar, data, WEEK);
assert.ok(adminDue.some((row) => row.id === OMAR_ID), "إدارة collector includes due Omar");
assert.ok(!adminDue.some((row) => row.id === NIYAR_ID), "إدارة never lists the viewer's own file");
const mgrDue = nightDueAdminEmployees(stationMgr, data, WEEK);
assert.ok(mgrDue.some((row) => row.id === OMAR_ID), "station manager إدارة includes Omar");

const headerAdmin = requestManageEmployees(niyar, data);
const adminSeen = new Set();
const adminEmployees = [...headerAdmin, ...adminDue].filter((employee) => {
  if (!employee?.id || adminSeen.has(employee.id)) return false;
  adminSeen.add(employee.id);
  return true;
});
assert.ok(adminEmployees.some((row) => row.id === OMAR_ID), "Requests إدارة merge keeps Omar");

const niyarBadges = collectSuiteBadges({
  user: niyar,
  data,
  employees: data.employees,
  attendanceRows: [],
  weekStart: WEEK,
});
assert.ok((niyarBadges.byApp.requests || 0) >= 1, "مدير suite طلباتي includes due Omar");
assert.ok((niyarBadges.byApp.attendance || 0) >= 1, "مدير suite الدوام includes due Omar");
assert.equal(suiteAppGlow({ id: "requests" }, niyarBadges), "due");
assert.equal(suiteAppGlow({ id: "attendance" }, niyarBadges), "due");

console.log(`night-due-omar-fixture: ok — ${omar.name} glow=due key=${expectedKey}; ${niyar.name} ملفي clean`);
