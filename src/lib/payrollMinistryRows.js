/**
 * «أنظمة الوزارة — ما يخص الأجر» — rows for قسيمتي (self) and the wage run (manage).
 * The judging stays where it lives: payday / overdue from payrollLaw, the Art. 93 cap from
 * payrollDerivations, the leave effects on pay from the leave and payroll derivations. This module
 * only reads their results into the ministry frame. Pure (node-testable).
 *
 * Self view leaves out payday and the deduction cap: «حقوق راتبي» (MyRightsList) already shows them
 * on the same page — one line, one place.
 */
import { explainRule, ruleValue } from "./laborRules.js";
import { checkArticle93Gate, lineIssues, lineOvertimeHours } from "./payrollDerivations.js";
import { isWeeklyRestDay } from "./laborHoursPolicy.js";
import { isOfficialHoliday, laborCalendarOf } from "./ummAlQuraCalendar.js";
import { companyPayday, wageOverdue } from "./payrollLaw.js";
import { stationWithSite } from "./siteRemoteness.js";
import { preventedDaysInMonth } from "./modelRequests.js";
import {
  eidOverlapRegsNote,
  forcedLabourRegsNote,
  missionModelNote,
  overtimeRegsNote,
  preventedWageModelNote,
  relocationModelNote,
  remotePlacesRegsNote,
  sickLeaveRegsNote,
  unpaidLeaveRegsNote,
  wageDefinitionsModelNote,
} from "./implementingRegsNotes.js";

const info = (ar) => (ar ? "للعلم" : "For reference");
const applied = (ar) => (ar ? "يُطبَّق في المسير" : "Applied in the run");

export const PAYROLL_MINISTRY_CARDS = (ar = true) => [
  {
    key: "labour",
    title: ar ? "نظام العمل — الأجر" : "Labour Law — the wage",
    scope: ar ? "موعد الأجر وحمايته (90)، حد الحسم (92–93)، أجر الإضافي (107)، نهاية الخدمة (84–85)." : "Payday and protection (90), the deduction cap (92–93), overtime pay (107), end of service (84–85).",
  },
  {
    key: "regs",
    badge: ar ? "اللائحة" : "Regs",
    title: ar ? "اللائحة التنفيذية — ما يمس الأجر" : "Implementing Regulations — what touches pay",
    scope: ar ? "العيد مع الراحة والإجازات (م24)، وقف العقد (م25)، المرض أثناء السنوية (م26)، سقف الإضافي والإجازة التعويضية (م22)، السخرة والسكن والنقل (م21)، البعيد عن العمران (م30)." : "Eid with rest and leave (24), suspension (25), sickness in annual leave (26), the overtime cap and comp leave (22), forced labour, housing and transport (21), remote places (30).",
  },
  {
    key: "model",
    badge: ar ? "النموذج الموحد" : "Model reg.",
    title: ar ? "النموذج الموحد — الأجر وما يُسترد معه" : "Model regulation — the wage and what is repaid with it",
    scope: ar ? "الأجر الأساسي والفعلي (م1–2)، نفقات النقل مع تغيير السكن (م9، 12)، الانتداب (م24)، أجر من منعته المنشأة (م46)." : "Basic and actual wage (1–2), relocation (9, 12), missions (24), pay when the company prevents work (46).",
  },
];

/**
 * lines — the run lines in view (manage: the scope; self: the person's own line, or none).
 * pay / overdue — companyPayday() / wageOverdue() results, computed by the caller (manage only).
 */
export function payrollMinistryRows({ lines = [], self = false, pay = null, overdue = null, ar = true, onDate, siteOf = null, preventedOf = null } = {}) {
  const rows = [];
  const list = (lines || []).filter(Boolean);

  if (!self) {
    rows.push({
      key: "labour-90",
      source: "labour",
      badge: ar ? "م 90" : "Art. 90",
      title: ar ? "الأجر في موعده وحمايته" : "The wage on time, protected",
      note: ar
        ? "يُدفع الأجر في موعده، وإن وافق يوم الدفع راحة أو عطلة رسمية دُفع في يوم العمل السابق (النموذج الموحد م17)."
        : "The wage is paid on its date; a payday on a rest day or holiday moves to the working day before (Model regulation Art. 17).",
      ...(overdue?.overdue
        ? { status: "alert", pill: ar ? "متأخر" : "Overdue" }
        : pay
          ? { status: "settled", pill: ar ? `يُصرف ${pay.due}` : `Paid ${pay.due}` }
          : { status: "waiting", pill: ar ? "يوم الصرف غير محدد" : "Payday not set" }),
    });
    const over = list.filter((line) => !checkArticle93Gate(line).ok).length;
    rows.push({
      key: "labour-92",
      source: "labour",
      badge: ar ? "م 92–93" : "Arts. 92–93",
      title: ar ? "لا حسم إلا في الحالات المحددة، وبما لا يتجاوز نصف الأجر" : "Deductions only in the listed cases, within half the wage",
      note: ar ? "لا يُحسم من الأجر إلا في حالات المادة 92، ولا يتجاوز مجموع الحسم نصف الأجر المستحق (93)." : "Deductions only in the Art. 92 cases, never over half the wage due (93).",
      ...(over
        ? { status: "blocked", pill: ar ? `${over} فوق الحد` : `${over} over the cap` }
        : list.length ? { status: "settled", pill: ar ? "مستوفى" : "Met" } : { status: "void", pill: ar ? "لا مسير" : "No run" }),
    });
  }

  const premium = (() => { try { return ruleValue("hours.ot.premium", onDate); } catch { return 1.5; } })();
  const withOt = list.filter((line) => lineOvertimeHours(line) > 0).length;
  const capHits = list.filter((line) => lineIssues(line).includes("OT_ANNUAL_CAP")).length;
  rows.push({
    key: "labour-107",
    source: "labour",
    badge: ar ? "م 107" : "Art. 107",
    title: ar ? `أجر الإضافي: أجر الساعة × ${premium} من الساعات المعتمدة` : `Overtime pay: hourly wage × ${premium} on approved hours`,
    note: overtimeRegsNote(ar, onDate),
    ...(capHits
      ? { status: "alert", pill: ar ? `${capHits} فوق السقف السنوي` : `${capHits} over the annual cap` }
      : withOt
        ? { status: "settled", pill: ar ? (self ? "في قسيمتك" : `${withOt} بنداً بإضافي`) : (self ? "On your slip" : `${withOt} line(s) with overtime`) }
        : { status: "void", pill: ar ? "لا إضافي هذا الشهر" : "No overtime this month" }),
  });

  rows.push({ key: "regs-24", source: "regs", badge: ar ? "اللائحة م24" : "Regs Art. 24", title: ar ? "العيد مع الراحة الأسبوعية أو السنوية أو المرضية" : "Eid with weekly rest, annual or sick leave", note: eidOverlapRegsNote(ar), status: "settled", pill: applied(ar) });
  rows.push({ key: "regs-25", source: "regs", badge: ar ? "اللائحة م25" : "Regs Art. 25", title: ar ? "الإجازة بلا أجر فوق عشرين يوماً توقف العقد" : "Unpaid leave beyond twenty days suspends the contract", note: unpaidLeaveRegsNote(ar), status: "settled", pill: applied(ar) });
  rows.push({ key: "regs-26", source: "regs", badge: ar ? "اللائحة م26" : "Regs Art. 26", title: ar ? "المرض أثناء الإجازة السنوية" : "Sickness during annual leave", note: sickLeaveRegsNote(ar), status: "settled", pill: applied(ar) });

  // Regs Art. 21 — Art. 61(5–6) housing and transport (or their cash) bind the private and non-profit
  // sectors: read whether the run carries the named allowances; in-kind provision is not visible here.
  const housed = list.filter((line) => Number(line.housingAllowance) > 0).length;
  const carried = list.filter((line) => Number(line.transportAllowance) > 0).length;
  const neither = list.filter((line) => !(Number(line.housingAllowance) > 0) || !(Number(line.transportAllowance) > 0)).length;
  rows.push({
    key: "regs-21",
    source: "regs",
    badge: ar ? "اللائحة م21" : "Regs Art. 21",
    title: ar ? "لا سخرة · السكن والنقل أو بدلهما للقطاع الخاص وغير الربحي (المادة 61/5–6)" : "No forced labour · housing and transport or their cash (Art. 61(5–6))",
    note: forcedLabourRegsNote(ar),
    sub: list.length ? (ar ? `بدل سكن في ${housed} · بدل نقل في ${carried} من ${list.length}` : `Housing allowance on ${housed} · transport on ${carried} of ${list.length}`) : undefined,
    ...(!list.length
      ? { status: "void", pill: info(ar) }
      : neither
        ? { status: "waiting", pill: self ? (ar ? "يُوفَّر عيناً أو بدلاً" : "In kind or cash") : (ar ? `${neither} بلا بدل ظاهر — عيناً أو بدلاً` : `${neither} without a cash line`) }
        : { status: "settled", pill: ar ? "البدلان في المسير" : "Both on the run" }),
  });

  // Regs Art. 30 — remote places, derived from each branch's recorded distance and road (Safety → Inspection).
  if (typeof siteOf === "function") {
    const sites = list.map((line) => siteOf(line)).filter(Boolean);
    const remote = sites.filter((site) => site.remoteness?.remote).length;
    const unknown = sites.filter((site) => !site.remoteness?.known).length;
    rows.push({
      key: "regs-30",
      source: "regs",
      badge: ar ? "اللائحة م30" : "Regs Art. 30",
      title: ar ? "البعيد عن العمران: 50 كم بطريق معبّد أو 25 كم بغيره، أو تجمع بلا مرافق" : "Remote: 50 km paved or 25 km unpaved, or a cluster without services",
      note: remotePlacesRegsNote(ar),
      ...(remote
        ? { status: "waiting", pill: self ? (ar ? "موقعك بعيد — 146 و147" : "Your site is remote") : (ar ? `${remote} في موقع بعيد` : `${remote} at a remote site`) }
        : unknown
          ? { status: "void", pill: ar ? (self ? "المسافة غير مسجّلة" : `${unknown} بلا مسافة مسجّلة`) : "Distance not recorded" }
          : sites.length ? { status: "settled", pill: ar ? "لا موقع بعيد" : "None remote" } : { status: "void", pill: info(ar) }),
    });
  }

  // Model Arts. 9/12 and 24 — approved relocation and mission claims reimbursed with the wage (outside Art. 93).
  const claims = list.filter((line) => Number(line.expenseRefunds) > 0);
  const claimSum = Math.round(claims.reduce((sum, line) => sum + Number(line.expenseRefunds), 0) * 100) / 100;
  rows.push({
    key: "model-12-24",
    source: "model",
    badge: ar ? "النموذج الموحد م9·12·24" : "Model Arts. 9·12·24",
    title: ar ? "نفقات النقل مع تغيير السكن ونفقات الانتداب — تُسترد مع الأجر" : "Relocation and mission expenses — repaid with the wage",
    note: `${relocationModelNote(ar)} ${missionModelNote(ar)}`,
    ...(claims.length
      ? { status: "settled", pill: ar ? `${claimSum.toLocaleString("en-US")} ر.س مستردة${self ? "" : ` · ${claims.length} بنداً`}` : `${claimSum} SAR repaid` }
      : { status: "void", pill: ar ? "لا مطالبة هذا الشهر" : "No claim this month" }),
  });

  // Model Art. 46 — a day the company kept a ready worker from working stays paid.
  const preventedDays = typeof preventedOf === "function" ? list.reduce((sum, line) => sum + (Number(preventedOf(line)) || 0), 0) : 0;
  rows.push({
    key: "model-46",
    source: "model",
    badge: ar ? "النموذج الموحد م46" : "Model Art. 46",
    title: ar ? "منعته المنشأة وهو حاضر مستعد — يُستحق أجره" : "Kept from work by the company while ready — paid",
    note: preventedWageModelNote(ar),
    ...(preventedDays
      ? { status: "settled", pill: ar ? `${preventedDays} يوماً مدفوعاً لا غياب` : `${preventedDays} day(s) paid, not absence` }
      : { status: "void", pill: ar ? "لا يوم مسجّلاً" : "None recorded" }),
  });

  const eos = [explainRule("eos.gratuity.cite", onDate), explainRule("eos.resignation.cite", onDate)]
    .filter(Boolean).map((row) => (ar ? row.hintAr : row.hintEn)).filter(Boolean).join(" ");
  rows.push({ key: "labour-84", source: "labour", badge: ar ? "م 84–85" : "Arts. 84–85", title: ar ? "مكافأة نهاية الخدمة — الأساس" : "End-of-service award — the basics", note: eos, status: "void", pill: info(ar) });
  rows.push({ key: "model-1", source: "model", badge: ar ? "النموذج الموحد م1–2" : "Model Arts. 1–2", title: ar ? "الأجر الأساسي والأجر الفعلي" : "Basic wage and actual wage", note: wageDefinitionsModelNote(ar), status: "void", pill: info(ar) });
  return rows;
}

/**
 * The panel's rows from the page's own inputs — payday and overdue from payrollLaw exactly as
 * «مواعيد الأجر وحمايته» reads them (manage only), the site and prevented days per line. Shared by
 * PayrollMinistryPanel and the «الامتثال الوزاري» index.
 */
export function payrollPanelRows({ data, month, items = [], employeeForItem = null, self = false, today, ar = true } = {}) {
  const calendar = laborCalendarOf(data);
  const isOff = (day) => isWeeklyRestDay(day, data) || isOfficialHoliday(day, calendar);
  const pay = self ? null : companyPayday(data?.settings, month, isOff);
  const overdue = self ? null : wageOverdue({ settings: data?.settings, month, items, today, isOff, employeeOf: employeeForItem });
  const personOf = (line) => (typeof employeeForItem === "function" ? employeeForItem(line) : null)
    || (data?.employees || []).find((row) => String(row.id) === String(line?.employeeId)) || null;
  const siteOf = (line) => {
    const person = personOf(line);
    return person ? stationWithSite(data, person.stationId) : null;
  };
  const preventedOf = (line) => preventedDaysInMonth(personOf(line), month).size;
  return payrollMinistryRows({ lines: items, self, pay, overdue, ar, onDate: today, siteOf, preventedOf });
}
