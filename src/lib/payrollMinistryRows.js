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
import {
  eidOverlapRegsNote,
  overtimeRegsNote,
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
    title: ar ? "اللائحة التنفيذية — أثر الإجازات والإضافي على الأجر" : "Implementing Regulations — leave and overtime on pay",
    scope: ar ? "العيد مع الراحة والإجازات (م24)، وقف العقد (م25)، المرض أثناء السنوية (م26)، سقف الإضافي والإجازة التعويضية (م22)." : "Eid with rest and leave (24), suspension (25), sickness in annual leave (26), the overtime cap and comp leave (22).",
  },
  {
    key: "model",
    badge: ar ? "النموذج الموحد" : "Model reg.",
    title: ar ? "النموذج الموحد — تعريف الأجر" : "Model regulation — what the wage is",
    scope: ar ? "الأجر الأساسي والفعلي (م1)، والتقويم (م2)." : "Basic and actual wage (Art. 1), the calendar (2).",
  },
];

/**
 * lines — the run lines in view (manage: the scope; self: the person's own line, or none).
 * pay / overdue — companyPayday() / wageOverdue() results, computed by the caller (manage only).
 */
export function payrollMinistryRows({ lines = [], self = false, pay = null, overdue = null, ar = true, onDate } = {}) {
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
      note: ar ? `${list.length} بنداً في النطاق · ${over} يتجاوز الحد.` : `${list.length} line(s) in scope · ${over} over the cap.`,
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

  const eos = [explainRule("eos.gratuity.cite", onDate), explainRule("eos.resignation.cite", onDate)]
    .filter(Boolean).map((row) => (ar ? row.hintAr : row.hintEn)).filter(Boolean).join(" ");
  rows.push({ key: "labour-84", source: "labour", badge: ar ? "م 84–85" : "Arts. 84–85", title: ar ? "مكافأة نهاية الخدمة — الأساس" : "End-of-service award — the basics", note: eos, status: "void", pill: info(ar) });
  rows.push({ key: "model-1", source: "model", badge: ar ? "النموذج الموحد م1–2" : "Model Arts. 1–2", title: ar ? "الأجر الأساسي والأجر الفعلي" : "Basic wage and actual wage", note: wageDefinitionsModelNote(ar), status: "void", pill: info(ar) });
  return rows;
}
