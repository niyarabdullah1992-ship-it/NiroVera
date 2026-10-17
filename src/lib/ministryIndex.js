/**
 * «الامتثال الوزاري» — the management index: one line per section with how many of its ministry rules
 * alert, are met, or are for reference. Every count is the totals of the SAME panel the section shows
 * (lib/ministrySections, management lane) — nothing is judged here, nothing is listed twice.
 * Per-person sections (العقد، نهاية الخدمة) sum alerts / met person by person; a reference rule counts
 * once (ministryCountsAcross). جدول الدوام reads the roster week's counters (scheduleMinistryCounts).
 * Pure (node-testable).
 */
import { ministryCounts, ministryCountsAcross, ministryCountsTone } from "./ministryCounts.js";
import { buildMinistrySection } from "./ministrySections.js";
import { uniformOf } from "./uniformPolicy.js";
import { safetyMinistryFacts } from "./safetyMinistryRows.js";
import { hasRecordedExit } from "./offboardingMinistryRows.js";
import { laborCalendarOf } from "./ummAlQuraCalendar.js";

export const MINISTRY_INDEX_KEYS = ["requests", "schedule", "payroll", "discipline", "voice", "performance", "contract", "safety", "offboarding", "records", "org"];

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

  const panel = (key, inputs) => buildMinistrySection(key, { lane: "manage", ar, today: day, ...inputs });
  const three = (t) => ({ alert: t.alert, met: t.met, info: t.info });
  const contractRows = (person) => panel("contract", { employee: person }).rows;
  const leaving = people.filter((person) => hasRecordedExit(person));
  const exitRows = (person) => panel("offboarding", { employee: person }).rows;
  const across = (sets) => three(ministryCountsAcross(sets));

  const recFor = (sid) => (data?.safety || []).find((rec) => String(rec.stationId) === String(sid)) || null;
  const flaggedContract = firstFlagged(people, contractRows);
  const flaggedExit = firstFlagged(leaving, exitRows) || leaving[0] || null;

  const sections = [
    {
      key: "requests",
      title: L("طلباتي", "My requests"),
      scope: L(`عدد الملفات ${people.length} — ما ينتظر قراراً وما اعتُمد تحت كل قاعدة`, `${people.length} files — awaiting and approved under each rule`),
      counts: three(panel("requests", { people }).totals),
      href: "/app/requests#nv-ministry-requests",
    },
    {
      key: "schedule",
      title: L("جدول الدوام (الإدارة)", "Duty roster (management)"),
      scope: scheduleStation ? L(`أسبوع ${scheduleStation} — 18632 · 3337 · نظام العمل`, `${scheduleStation} this week — 18632 · 3337 · Labour Law`) : L("لا جدول في هذا النطاق", "No roster in this scope"),
      counts: schedule ? { alert: (schedule.block || 0) + (schedule.alert || 0), met: schedule.met || 0, info: schedule.info || 0 } : { alert: 0, met: 0, info: 0 },
      href: "/app/shifts?lane=manage&src=all",
    },
    payroll
      ? {
        key: "payroll",
        title: L("قسيمتي / الرواتب", "Payslip / wages"),
        scope: L(`مسير ${payroll.month || ""} — عدد الأسطر ${(payroll.lines || []).length}`, `The ${payroll.month || ""} run — ${(payroll.lines || []).length} line(s)`),
        counts: three(panel("payroll", { data, month: payroll.month, items: payroll.lines || [], employeeForItem: payroll.employeeForItem }).totals),
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
      counts: three(panel("discipline", { cases: disciplineCases, employees: data?.employees || [], uniform: uniformOf(data) }).totals),
      href: "/app/discipline?tab=law&lane=manage#nv-ministry-discipline",
    },
    voice
      ? {
        key: "voice",
        title: L("صوت الموظف", "Employee voice"),
        scope: L("مهلة القناة، والتحرش والإيذاء", "The channel window, harassment and abuse"),
        counts: three(panel("voice", { breached: voice.breached, abuseCases: voice.abuseCases, calendar: laborCalendarOf(data) }).totals),
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
      scope: L(`عدد الملفات ${people.length} — التقرير السنوي والتظلم والعلاوة`, `${people.length} files — the annual report, grievance, increments`),
      counts: three(panel("performance", { people, perf: data?.hcmPerformance || {} }).totals),
      href: "/app/performance?view=self#nv-ministry-performance",
    },
    {
      key: "contract",
      title: L("ملف الموظف (العقد)", "Employee file (contract)"),
      scope: flaggedContract
        ? L(`عدد الملفات ${people.length} — يفتح على ملف ${flaggedContract.name || "أول ملف"}`, `${people.length} files — opens on ${flaggedContract.name || "the first file"}`)
        : L(`عدد الملفات ${people.length} — نوع العقد والمؤقت وغير السعودي`, `${people.length} files — contract type, temporary, non-Saudi`),
      counts: across(people.map(contractRows)),
      href: flaggedContract ? fileHref(flaggedContract.id, "nv-ministry-contract") : "/app/hr",
    },
    {
      key: "safety",
      title: L("السلامة", "Safety"),
      scope: L(`عدد الفروع ${stations.length} — الأخطار والإسعافات والبعيد عن العمران`, `${stations.length} branch(es) — hazards, first aid, remote sites`),
      counts: three(panel("safety", { facts: safetyMinistryFacts({ stations, recFor, today: day }) }).totals),
      href: "/app/safety?lane=manage#nv-ministry-safety",
    },
    {
      key: "offboarding",
      title: L("نهاية الخدمة", "End of service"),
      scope: leaving.length
        ? L(`حالات الإنهاء المسجّلة ${leaving.length} — يفتح على ملف ${flaggedExit?.name || "أول ملف"}`, `${leaving.length} exit(s) on file — opens on ${flaggedExit?.name || "the first file"}`)
        : L("لا إنهاء خدمة مسجّل في النطاق", "No exit on file in this scope"),
      counts: leaving.length ? across(leaving.map(exitRows)) : three(ministryCounts(exitRows({}))),
      href: flaggedExit ? fileHref(flaggedExit.id, "nv-ministry-offboarding") : "/app/hr",
    },
    {
      key: "records",
      title: L("السجلات والتدريب", "Registers and training"),
      scope: L("السجلات والتدريب وتسجيل التأمينات — في هذه الصفحة", "Registers, training and GOSI registration — on this page"),
      counts: three(panel("records", { data: data || {} }).totals),
      href: "/app/hr?tab=compliance#nv-ministry-compliance",
    },
    {
      key: "org",
      title: L("الهيكل", "Organisation"),
      scope: L("لائحة تنظيم العمل والسلم الوظيفي", "The work regulation and the job ladder"),
      counts: three(panel("org", { data: data || {} }).totals),
      href: "/app/hr?tab=compliance#nv-ministry-compliance",
    },
  ];
  return sections.map((section) => ({ ...section, tone: section.counts ? ministryCountsTone(section.counts) : "mute" }));
}

/** The index head — totals over the sections the viewer may see. */
export function ministryIndexTotals(sections = []) {
  return sections.filter((row) => row.counts).reduce((sum, row) => ({
    alert: sum.alert + row.counts.alert,
    met: sum.met + row.counts.met,
    info: sum.info + row.counts.info,
  }), { alert: 0, met: 0, info: 0 });
}
