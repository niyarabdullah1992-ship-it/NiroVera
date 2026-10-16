/**
 * «الامتثال الوزاري» — the management index: one line per section with how many of its ministry rules
 * block, alert, are met, or are for reference. Every count comes from the SAME row builder the
 * section's own «أنظمة الوزارة» panel lists — nothing is judged here, nothing is listed twice:
 *   طلباتي            requestsMinistryRows   · per person in scope
 *   جدول الدوام       useComplianceSummary   · the manager's roster week (counts passed in)
 *   الرواتب           payrollPanelRows        · the month's lines in scope
 *   الجزاءات          disciplineLawRows + disciplineModelRows
 *   صوت الموظف        voiceMinistryRows       · HR receivers only (voicePrivacy) — else restricted
 *   أدائي             perfMinistryRows        · per person, from the closed cycles
 *   ملف الموظف (العقد) contractMinistryRows    · per person
 *   السلامة           safetyMinistryRows      · the stations in scope
 *   نهاية الخدمة      offboardingMinistryRows · per person with an exit on file
 *   السجلات والتدريب  complianceMinistryRows  · the establishment
 * Per-person sections sum blocks / alerts / met person by person; a reference rule counts once
 * (ministryCountsAcross). Pure (node-testable).
 */
import { ministryCounts, ministryCountsAcross, ministryCountsTone } from "./ministryCounts.js";
import { requestsMinistryRows } from "./requestsMinistryRows.js";
import { payrollPanelRows } from "./payrollMinistryRows.js";
import { disciplineLawRows } from "./disciplineBoard.js";
import { disciplineModelRows } from "./disciplineModelRows.js";
import { uniformOf } from "./uniformPolicy.js";
import { voiceMinistryRows } from "./voiceMinistryRows.js";
import { perfMinistryRows, perfReportsFor } from "./perfReport.js";
import { contractMinistryRows } from "./contractMinistryRows.js";
import { safetyMinistryFacts, safetyMinistryRows } from "./safetyMinistryRows.js";
import { hasRecordedExit, offboardingMinistryRows } from "./offboardingMinistryRows.js";
import { complianceMinistryRows } from "./complianceMinistryRows.js";
import { laborCalendarOf } from "./ummAlQuraCalendar.js";

export const MINISTRY_INDEX_KEYS = ["requests", "schedule", "payroll", "discipline", "voice", "performance", "contract", "safety", "offboarding", "records"];

const fileHref = (id, anchor) => `/app/employees/${encodeURIComponent(id)}?tab=contract#${anchor}`;

/** The first person whose rows block, else alert — the file the index line opens on. */
function firstFlagged(people, rowsOf) {
  let alert = null;
  for (const person of people) {
    const counts = ministryCounts(rowsOf(person));
    if (counts.block) return person;
    if (!alert && counts.alert) alert = person;
  }
  return alert;
}

/**
 * data — the company register · employees / stations — already in the viewer's scope (permissions +
 * header branch) · schedule — scheduleMinistryCounts() of the roster week, or null · payroll —
 * { lines, employeeForItem, month } · disciplineCases — the management side's files · voice —
 * voiceMinistryInputs() or null (not an HR receiver).
 */
export function ministryIndexSections({
  data = {},
  employees = [],
  stations = [],
  schedule = null,
  scheduleStation = "",
  payroll = null,
  disciplineCases = [],
  voice = null,
  today,
  ar = true,
} = {}) {
  const day = today || new Date().toISOString().slice(0, 10);
  const L = (a, e) => (ar ? a : e);
  const people = (employees || []).filter(Boolean);

  const requestRows = (person) => requestsMinistryRows({ subject: person, lang: ar ? "ar" : "en", ar, today: day });
  const contractRows = (person) => contractMinistryRows(person, { today: day, ar });
  const perf = data?.hcmPerformance || {};
  const perfRows = (person) => perfMinistryRows({
    reports: perfReportsFor({ cycles: perf.cycles || [], ratings: perf.ratings || [], employeeId: person.id }),
    hireDate: person.hireDate || person.profile?.hireDate,
    lastIncrementAt: person.profile?.lastIncrementAt,
    today: day,
    ar,
  });
  const leaving = people.filter((person) => hasRecordedExit(person));
  const exitRows = (person) => offboardingMinistryRows({ employee: person, today: day, ar });

  const recFor = (sid) => (data?.safety || []).find((rec) => String(rec.stationId) === String(sid)) || null;
  const flaggedContract = firstFlagged(people, contractRows);
  const flaggedExit = firstFlagged(leaving, exitRows) || leaving[0] || null;

  const sections = [
    {
      key: "requests",
      title: L("طلباتي", "My requests"),
      scope: L(`عدد الملفات ${people.length} — ما ينتظر قراراً وما اعتُمد تحت كل قاعدة`, `${people.length} files — awaiting and approved under each rule`),
      counts: ministryCountsAcross(people.map(requestRows)),
      href: "/app/requests#nv-ministry-requests",
    },
    {
      key: "schedule",
      title: L("جدول الدوام (الإدارة)", "Duty roster (management)"),
      scope: scheduleStation ? L(`أسبوع ${scheduleStation} — 18632 · 3337 · نظام العمل`, `${scheduleStation} this week — 18632 · 3337 · Labour Law`) : L("لا جدول في هذا النطاق", "No roster in this scope"),
      counts: schedule || { block: 0, alert: 0, met: 0, info: 0 },
      href: "/app/shifts?lane=manage&src=all",
    },
    payroll
      ? {
        key: "payroll",
        title: L("قسيمتي / الرواتب", "Payslip / wages"),
        scope: L(`مسير ${payroll.month || ""} — عدد الأسطر ${(payroll.lines || []).length}`, `The ${payroll.month || ""} run — ${(payroll.lines || []).length} line(s)`),
        counts: ministryCounts(payrollPanelRows({ data, month: payroll.month, items: payroll.lines || [], employeeForItem: payroll.employeeForItem, today: day, ar })),
        href: "/app/payroll?view=manage&tab=run#nv-ministry-payroll",
      }
      : {
        key: "payroll",
        title: L("قسيمتي / الرواتب", "Payslip / wages"),
        scope: L("لمن يدير الرواتب — لا تظهر أعداده هنا", "For payroll managers — counts not shown here"),
        counts: null,
        restricted: true,
        href: "/app/payroll",
      },
    {
      key: "discipline",
      title: L("الجزاءات", "Sanctions"),
      scope: L(`ملفات الجزاء في النطاق ${disciplineCases.length} — نظام العمل والنموذج الموحد`, `${disciplineCases.length} sanction file(s) in scope — Labour Law and the model regulation`),
      counts: ministryCounts([
        ...disciplineLawRows({ cases: disciplineCases, employees: data?.employees || [], ar, today: day }),
        ...disciplineModelRows({ uniform: uniformOf(data), employees: data?.employees || [], manage: true, ar }),
      ]),
      href: "/app/discipline?tab=law&lane=manage#nv-ministry-discipline",
    },
    voice
      ? {
        key: "voice",
        title: L("صوت الموظف", "Employee voice"),
        scope: L("مهلة القناة، والتحرش والإيذاء (النموذج الموحد م54–56)", "The channel window, harassment and abuse (model Arts. 54–56)"),
        counts: ministryCounts(voiceMinistryRows({ breached: voice.breached, abuseCases: voice.abuseCases, calendar: laborCalendarOf(data), today: day, ar })),
        href: "/app/complaints?tab=manage#nv-ministry-voice",
      }
      : {
        key: "voice",
        title: L("صوت الموظف", "Employee voice"),
        scope: L("للموارد البشرية فقط — لا تظهر أعداده للمدير", "HR only — its counts are not shown to a line manager"),
        counts: null,
        restricted: true,
        href: "/app/complaints?tab=manage",
      },
    {
      key: "performance",
      title: L("أدائي", "My performance"),
      scope: L(`عدد الملفات ${people.length} — التقرير السنوي والتظلم (النموذج الموحد م18–23)`, `${people.length} files — the annual report and grievance (model Arts. 18–23)`),
      counts: ministryCountsAcross(people.map(perfRows)),
      href: "/app/performance?view=self#nv-ministry-performance",
    },
    {
      key: "contract",
      title: L("ملف الموظف (العقد)", "Employee file (contract)"),
      scope: flaggedContract
        ? L(`عدد الملفات ${people.length} — يفتح على ملف ${flaggedContract.name || "أول ملف"}`, `${people.length} files — opens on ${flaggedContract.name || "the first file"}`)
        : L(`عدد الملفات ${people.length} — نوع العقد والمؤقت وغير السعودي`, `${people.length} files — contract type, temporary, non-Saudi`),
      counts: ministryCountsAcross(people.map(contractRows)),
      href: flaggedContract ? fileHref(flaggedContract.id, "nv-ministry-contract") : "/app/hr",
    },
    {
      key: "safety",
      title: L("السلامة", "Safety"),
      scope: L(`عدد الفروع ${stations.length} — الأخطار والإسعافات والبعيد عن العمران`, `${stations.length} branch(es) — hazards, first aid, remote sites`),
      counts: ministryCounts(safetyMinistryRows(safetyMinistryFacts({ stations, recFor, today: day }), { ar, onDate: day })),
      href: "/app/safety?lane=manage#nv-ministry-safety",
    },
    {
      key: "offboarding",
      title: L("نهاية الخدمة", "End of service"),
      scope: leaving.length
        ? L(`حالات الإنهاء المسجّلة ${leaving.length} — يفتح على ملف ${flaggedExit?.name || "أول ملف"}`, `${leaving.length} exit(s) on file — opens on ${flaggedExit?.name || "the first file"}`)
        : L("لا إنهاء خدمة مسجّل في النطاق", "No exit on file in this scope"),
      counts: leaving.length ? ministryCountsAcross(leaving.map(exitRows)) : ministryCounts(offboardingMinistryRows({ employee: {}, today: day, ar })),
      href: flaggedExit ? fileHref(flaggedExit.id, "nv-ministry-offboarding") : "/app/hr",
    },
    {
      key: "records",
      title: L("السجلات والتدريب", "Registers and training"),
      scope: L("اللائحة م4 مكرر، 5، 6، 15–16 — في هذه الصفحة", "Regs Arts. 4 bis, 5, 6, 15–16 — on this page"),
      counts: ministryCounts(complianceMinistryRows(data || {}, { today: day, ar })),
      href: "/app/hr?tab=compliance#nv-ministry-compliance",
    },
  ];
  return sections.map((section) => ({ ...section, tone: section.counts ? ministryCountsTone(section.counts) : "mute" }));
}

/** The index head — totals over the sections the viewer may see. */
export function ministryIndexTotals(sections = []) {
  return sections.filter((row) => row.counts).reduce((sum, row) => ({
    block: sum.block + row.counts.block,
    alert: sum.alert + row.counts.alert,
    met: sum.met + row.counts.met,
    info: sum.info + row.counts.info,
  }), { block: 0, alert: 0, met: 0, info: 0 });
}
