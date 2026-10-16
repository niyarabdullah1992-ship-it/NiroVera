/**
 * «التزاماتي وحقوقي» — what the company owes, and may still claim, across the employees in scope,
 * sorted by the nearest legal date. Each line: what, who, until when, consequence, action.
 *
 * Duties:
 *   - requests awaiting a decision whose law sets a date (rightHints `due`: grievance 15-day reply,
 *     resignation 30-day deemed acceptance / Art. 75 notice end, damage-objection window, leave start…)
 *   - Art. 88 settlement (7 days employer-ended, 14 worker-ended) — deriveSettlementDeadline
 *   - payday / WPS (Art. 90 + model regulation Art. 17) — companyPayday / wageOverdue
 *   - GOSI tasks due — gosiTasks
 *   - compensatory leave enjoy-by dates (Art. 107 · regs 22 bis) — compBalance
 *   - grievance rulings on sanctions (Art. 72) — disciplineDeadlines
 * Company rights:
 *   - signing a sanction before Art. 69's 30 days close — disciplineDeadlines
 *   - probation end dates (Arts. 53/54) — deriveProbationProgress
 *   - notice owed by a resigning worker who left short (Arts. 75/76) — resignationFacts
 *   - a damage deduction becomes final if no objection by the Art. 91 date
 *
 * Pure: no store, no React; safe in node tests.
 */
import { flattenWorkspaceRows } from "./requestWorkspace.js";
import { hintDate, isPendingHintStatus, rightHintFor } from "./rightHints.js";
import { deriveSettlementDeadline } from "./offboardingDerivations.js";
import { companyPayday, wageOverdue } from "./payrollLaw.js";
import { gosiTasks } from "./gosiFollowUp.js";
import { compBalance } from "./compLeave.js";
import { hoursAr, sar } from "./otOffer.js";
import { disciplineDeadlines } from "./disciplineDeadlines.js";
import { deriveProbationProgress } from "./contractLawDerivations.js";
import { RESIGNATION_TYPE, resignationFacts } from "./exitRequests.js";
import { payrollItemsOf } from "./myRights.js";

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

function addDays(iso, n) {
  const d = dateOnly(iso);
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + Number(n));
  return dt.toISOString().slice(0, 10);
}

/** «موظف واحد»، «موظفان»، «3 موظفين»، «12 موظفاً». */
export function staffAr(n) {
  const v = Math.max(0, Number(n) || 0);
  if (v === 1) return "موظف واحد";
  if (v === 2) return "موظفان";
  if (v >= 3 && v <= 10) return `${v} موظفين`;
  return `${v} موظفاً`;
}

const art = (article, ar) => ({ article: String(article), label: ar ? `المادة ${article}` : `Art. ${article}` });
const regs = (n, ar) => ({ regs: String(n), label: ar ? `اللائحة م${n}` : `Regs Art. ${n}` });

const GOSI_WHAT = {
  register: { ar: "تسجيل في التأمينات قبل نهاية شهر الالتحاق", en: "GOSI registration by month-end of joining" },
  exclude: { ar: "استبعاد من التأمينات بعد آخر يوم عمل", en: "GOSI exclusion after the last day" },
  wage: { ar: "تحديث الأجر الخاضع في التأمينات", en: "Update the GOSI contributory wage" },
  injury: { ar: "الإبلاغ عن إصابة عمل للتأمينات", en: "Report a work injury to GOSI" },
  injury_office: { ar: "إبلاغ مكتب العمل بإصابة عمل", en: "Report a work injury to the labour office" },
  payment: { ar: "سداد اشتراكات التأمينات", en: "Pay GOSI contributions" },
};

/**
 * ctx: { employees (in scope), data (company), today, lang|ar, isHoliday(iso), isOff(iso), calendar }.
 * Returns { duties: [...], rights: [...] } — each line { id, kind, what, who, due, consequence, law, action }.
 */
export function buildCompanyObligations(ctx = {}) {
  const ar = ctx.ar ?? (ctx.lang ? ctx.lang === "ar" : true);
  const today = dateOnly(ctx.today) || new Date().toISOString().slice(0, 10);
  const employees = ctx.employees || [];
  const data = ctx.data || {};
  const d = (iso) => hintDate(iso, today, ar);
  const duties = [];
  const rights = [];
  const byId = new Map(employees.map((e) => [String(e.id), e]));

  // ── requests awaiting a decision with a legal date ─────────────────────
  for (const row of flattenWorkspaceRows(employees, ar ? "ar" : "en")) {
    if (!isPendingHintStatus(row.status)) continue;
    const hint = rightHintFor(row, { view: "manager", today, ar, isHoliday: ctx.isHoliday, data });
    if (!hint?.due) continue;
    duties.push({
      id: `req-${row.family}-${row.id}`,
      kind: "request",
      what: row.title,
      who: row.employee?.name || "",
      due: hint.due,
      consequence: hint.ifNot,
      law: hint.law,
      action: { label: ar ? "افتح القرار" : "Open the decision", to: `/app/requests/manage?focus=${encodeURIComponent(`${row.family}-${row.id}`)}` },
    });
    // Company right: notice the resigning worker owes when he leaves short of it (Arts. 75/76).
    if (row.type === RESIGNATION_TYPE && row.lastDay) {
      const f = resignationFacts({ date: row.date, lastDay: row.lastDay, route: row.exitRoute });
      if (f.noticeShort) {
        rights.push({
          id: `notice-${row.id}`,
          kind: "notice",
          what: ar ? `مهلة إشعار ناقصة (${f.noticeDays} من ${f.noticeNeed} يوماً) — لك أجر المدة الباقية` : `Short notice (${f.noticeDays} of ${f.noticeNeed} days) — the rest is owed to you`,
          who: row.employee?.name || "",
          due: f.noticeEndsOn,
          consequence: ar ? "من لم يراعِ المهلة يدفع أجرها للطرف الآخر." : "The party who skips the notice pays its wage.",
          law: art("76", ar),
          action: { label: ar ? "افتح الاستقالة" : "Open the resignation", to: `/app/requests/manage?focus=${encodeURIComponent(`other-${row.id}`)}` },
        });
      }
    }
  }

  // ── Art. 88 settlements ────────────────────────────────────────────────
  for (const emp of employees) {
    const exit = emp?.profile?.contractExit;
    if (!dateOnly(exit?.effectiveDate)) continue;
    const s = deriveSettlementDeadline({ contractExit: exit, today });
    if (!s?.due || s.closed) continue;
    duties.push({
      id: `settle-${emp.id}`,
      kind: "settlement",
      what: ar ? `تصفية مستحقات نهاية الخدمة خلال ${s.days === 14 ? "أسبوعين" : "أسبوع"}` : `Final settlement within ${s.days} days`,
      who: emp.name || "",
      due: s.due,
      consequence: ar ? "وإلا صار للعامل أن يطالب بها أمام المحكمة العمالية." : "Otherwise the worker may claim it in the labour court.",
      law: art("88", ar),
      action: { label: ar ? "افتح الملف" : "Open the file", to: `/app/employees/${encodeURIComponent(emp.id)}` },
    });
  }

  // ── payday / WPS ───────────────────────────────────────────────────────
  const month = today.slice(0, 7);
  const pay = companyPayday(data.settings, month, ctx.isOff);
  if (pay) {
    const items = payrollItemsOf(data).filter((i) => String(i.month || "") === month && byId.has(String(i.employeeId)));
    const od = wageOverdue({ settings: data.settings, month, items, today, isOff: ctx.isOff, employeeOf: (i) => byId.get(String(i.employeeId)) });
    const unpaid = od.unpaid || items.filter((i) => !i.paid).length;
    if (unpaid > 0 || today <= pay.due) {
      duties.push({
        id: `payday-${month}`,
        kind: "payday",
        what: ar ? "صرف رواتب الشهر وملف حماية الأجور" : "Pay the month's wages and the WPS file",
        who: ar ? (unpaid ? `${staffAr(unpaid)} لم يُصرف لهم` : staffAr(employees.length)) : (unpaid ? `${unpaid} unpaid` : `${employees.length} staff`),
        due: pay.due,
        consequence: ar ? "وإلا تأخر الأجر — وتعرّض المنشأة لغرامة المادة 94." : "Otherwise wages are late — the Art. 94 fine applies.",
        law: art("90", ar),
        action: { label: ar ? "افتح المسير" : "Open payroll", to: "/app/payroll" },
      });
    }
  }

  // ── GOSI ───────────────────────────────────────────────────────────────
  for (const t of gosiTasks({ employees, company: data, today })) {
    if (t.done || !t.due) continue;
    const what = GOSI_WHAT[t.kind] || { ar: "إجراء في التأمينات", en: "A GOSI action" };
    duties.push({
      id: `gosi-${t.id}`,
      kind: "gosi",
      what: ar ? what.ar : what.en,
      who: t.name || "",
      due: t.due,
      consequence: ar ? "وإلا تأخر الإجراء وتُحتسب غرامة التأخير في التأمينات." : "Otherwise the action is late and GOSI's late fine applies.",
      law: { product: true, label: ar ? "نظام التأمينات" : "GOSI law" },
      action: { label: ar ? "افتح التأمينات" : "Open GOSI", to: "/app/payroll" },
    });
  }

  // ── compensatory leave enjoy-by dates ──────────────────────────────────
  for (const emp of employees) {
    const bal = compBalance(emp, today);
    if (!(bal.left > 0) || !bal.nextTakeBy) continue;
    duties.push({
      id: `comp-${emp.id}`,
      kind: "comp",
      what: ar ? `إجازة تعويضية لم تُؤخذ (${hoursAr(bal.nextLeft || bal.left)})` : `Comp leave not taken (${bal.nextLeft || bal.left} h)`,
      who: emp.name || "",
      due: bal.nextTakeBy,
      consequence: ar ? "مكّنه منها قبل الموعد أو اتفق كتابةً على غيره — ولا تسقط، وتُصرف أجرتها إن ترك العمل." : "Let him take it or agree a new date in writing; it never lapses and is paid out at exit.",
      law: regs("22 مكرر", ar),
      action: { label: ar ? "افتح الطلبات" : "Open requests", to: "/app/requests/manage" },
    });
  }

  // ── sanctions: ruling on a grievance (duty), signing window (right) ────
  const cases = (data.disciplinaryCases || []).filter((c) => byId.has(String(c.employeeId)));
  for (const row of disciplineDeadlines({ cases, today, calendar: ctx.calendar })) {
    if (!row.due) continue;
    const who = byId.get(String(row.employeeId))?.name || "";
    const line = {
      id: `disc-${row.kind}-${row.caseId}`,
      who,
      due: row.due,
      law: art(row.article, ar),
      action: { label: ar ? "افتح الجزاء" : "Open the case", to: "/app/discipline" },
    };
    if (row.kind === "ruling") {
      duties.push({ ...line, kind: "discipline", what: ar ? "البتّ كتابةً في تظلّم من جزاء" : "Rule in writing on a sanction grievance", consequence: ar ? "وإلا صار له الاعتراض أمام المحاكم العمالية." : "Otherwise the labour courts are open to him." });
    } else if (row.kind === "sign" && !row.over) {
      rights.push({ ...line, kind: "discipline", what: ar ? "لك توقيع الجزاء بعد التحقيق" : "You may sign the sanction after the inquiry", consequence: ar ? "بعدها لا يُوقَّع الجزاء." : "After that the sanction cannot be signed." });
    }
  }

  // ── probation end dates ────────────────────────────────────────────────
  for (const emp of employees) {
    const pr = deriveProbationProgress({ employee: emp, today });
    if (!pr?.active || !(pr.remaining > 0)) continue;
    rights.push({
      id: `probation-${emp.id}`,
      kind: "probation",
      what: ar ? `فترة التجربة — باقي ${pr.remaining} يوماً؛ إنهاء العقد خلالها بلا تعويض ولا مكافأة` : `Probation — ${pr.remaining} days left; you may end the contract within it`,
      who: emp.name || "",
      due: addDays(today, pr.remaining),
      consequence: ar ? "بعدها يصير الإنهاء وفق المادتين 74 و75 لا التجربة." : "After that ending follows Arts. 74–75, not probation.",
      law: art("54", ar),
      action: { label: ar ? "افتح الملف" : "Open the file", to: `/app/employees/${encodeURIComponent(emp.id)}` },
    });
  }

  // ── damage deductions: final unless objected by the Art. 91 date ───────
  for (const item of payrollItemsOf(data)) {
    const emp = byId.get(String(item.employeeId));
    if (!emp) continue;
    for (const line of item.deductionLines || []) {
      const last = dateOnly(line?.objectionLastDay);
      if (line?.source !== "damage" || !last || last < today) continue;
      rights.push({
        id: `damage-${line.id}`,
        kind: "damage",
        what: ar ? `حسم إتلاف ${sar(Number(line.amount) || 0, ar)} — يصير نهائياً إن لم يُعترض عليه` : `Damage deduction ${sar(Number(line.amount) || 0, ar)} — final unless contested`,
        who: emp.name || "",
        due: last,
        consequence: ar ? "حتى أجر خمسة أيام في الشهر، مستقل عن الجزاءات." : "Up to five days' pay a month, apart from penalties.",
        law: art("91", ar),
        action: { label: ar ? "افتح المسير" : "Open payroll", to: "/app/payroll" },
      });
    }
  }

  const order = (a, b) => String(a.due || "9999").localeCompare(String(b.due || "9999"));
  const label = (row) => ({ ...row, dueLabel: d(row.due), late: !!row.due && row.due < today });
  return { duties: duties.sort(order).map(label), rights: rights.sort(order).map(label) };
}
