/**
 * متابعة التأمينات — what the establishment owes GOSI and by when (GOSI employer guide).
 *
 * The platform is not connected to GOSI. It does not file anything there; it knows from the file what
 * must be done in «تأميناتي أعمال», counts the deadline, and keeps the proof when HR records that it
 * was done (date + GOSI reference). Pure helpers — the store writes, the payroll GOSI tab reads.
 *
 *   register   a new hire: registered by the last day of the joining month
 *   exclude    a contract that ended: excluded by the last day of the leaving month, with the GOSI reason
 *   injury     a work injury: reported within ten days of it
 *   wage       a change in the contributory wage: reported at once
 *   payment    the month's contributions: paid within the 15 days after the month
 */

export const GOSI_INJURY_REPORT_DAYS = 10;
export const GOSI_PAYMENT_DAYS = 15;

/** GOSI exclusion reasons (employer guide) for each platform termination reason. */
/** Regs Art. 28(1): an establishment outside GOSI's hazards branch tells the labour office within a week. */
export const LABOUR_OFFICE_INJURY_REPORT_DAYS = 7;

export function gosiExclusionReason(exit = {}) {
  const reason = String(exit.reason || "");
  const party = String(exit.party || "");
  if (exit.probation || reason === "probation") return { ar: "فسخ العقد بموجب فترة التجربة أو التدريب", en: "Terminated in probation or training" };
  switch (reason) {
    case "resignation": return { ar: "استقالة", en: "Resignation" };
    case "retirement": return { ar: "بلوغ سن التقاعد", en: "Retirement age" };
    case "closure": return { ar: "إنهاء النشاط", en: "Activity ended" };
    case "article_80": return { ar: "فسخ العقد بموجب المادة 80 من نظام العمل", en: "Terminated under Art. 80" };
    case "death": return exit.source === "work_injury"
      ? { ar: "وفاة بسبب إصابة عمل", en: "Death from a work injury" }
      : { ar: "وفاة طبيعية", en: "Natural death" };
    case "mutual": return { ar: "انتهاء العقد وعدم التجديد باتفاق الطرفين", en: "Contract ended, not renewed by agreement" };
    case "contract_end":
      if (party === "worker") return { ar: "انتهاء العقد وعدم التجديد برغبة المشترك", en: "Contract ended, not renewed at the worker's wish" };
      if (party === "employer") return { ar: "انتهاء العقد وعدم التجديد برغبة صاحب العمل", en: "Contract ended, not renewed at the employer's wish" };
      return { ar: "انتهاء العقد وعدم التجديد باتفاق الطرفين", en: "Contract ended, not renewed by agreement" };
    case "article_77_employer": return { ar: "فصل بموجب المادة 77 من نظام العمل", en: "Dismissal under Art. 77" };
    case "article_77_worker": return { ar: "استقالة بموجب المادة 77 من نظام العمل", en: "Resignation under Art. 77" };
    default: return null; // force majeure, disability, Art. 81 — no matching line in the guide; HR picks it in GOSI
  }
}

function key(v) {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

export function monthEnd(day) {
  const k = key(day);
  if (!k) return "";
  const [y, m] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function addDays(day, n) {
  const k = key(day);
  if (!k) return "";
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function daysLeft(today, due) {
  if (!due) return null;
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${due}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/** The month before `today`'s month, as YYYY-MM, and its payment due day (the 15th after it). */
export function paymentWindow(today) {
  const k = key(today);
  const [y, m] = k.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const month = prev.toISOString().slice(0, 7);
  return { month, due: `${k.slice(0, 7)}-${String(GOSI_PAYMENT_DAYS).padStart(2, "0")}` };
}

function task(base, today) {
  const left = base.done ? null : daysLeft(today, base.due);
  return { ...base, left, overdue: left != null && left < 0, soon: left != null && left >= 0 && left <= 3 };
}

/**
 * Every GOSI action the file implies. `contributory(employee)` returns the current contributory wage
 * (the caller passes the platform's own rule so this file stays free of payroll imports).
 */
export function gosiTasks({ employees = [], company = {}, today, contributory = () => 0, injuryCovered = true } = {}) {
  const out = [];
  for (const emp of employees) {
    const p = emp?.profile || {};
    const acts = p.gosiActions || {};
    const hired = key(p.hireDate || p.joinDate || emp.hireDate);
    const exit = p.contractExit || {};
    const exitDay = key(exit.effectiveDate || exit.lastDay);
    const registered = Boolean(String(p.gosiNumber || "").trim() || key(p.gosiRegisteredAt) || acts.register);
    if (hired && !exitDay) {
      out.push(task({
        id: `register:${emp.id}`, kind: "register", employeeId: emp.id, name: emp.name,
        due: monthEnd(hired), from: hired, done: registered, doneAt: acts.register?.at || key(p.gosiRegisteredAt), ref: acts.register?.ref || "",
      }, today));
    }
    if (exitDay) {
      const reason = gosiExclusionReason(exit);
      out.push(task({
        id: `exclude:${emp.id}`, kind: "exclude", employeeId: emp.id, name: emp.name,
        due: monthEnd(exitDay), from: exitDay, reason, done: Boolean(acts.exclude), doneAt: acts.exclude?.at || "", ref: acts.exclude?.ref || "",
      }, today));
    }
    if (registered && !exitDay) {
      const now = Math.round(Number(contributory(emp)) || 0);
      const last = acts.wage?.wage != null ? Math.round(Number(acts.wage.wage)) : (p.gosiReportedWage != null ? Math.round(Number(p.gosiReportedWage)) : null);
      if (last != null && now && Math.abs(now - last) >= 1) {
        out.push(task({
          id: `wage:${emp.id}`, kind: "wage", employeeId: emp.id, name: emp.name,
          due: today, from: today, wage: now, previous: last, done: false, doneAt: "", ref: "",
        }, today));
      }
    }
    if (injuryCovered === false) {
      // Regs Art. 28: not under GOSI's occupational-hazards branch — report to the labour office within a week of knowing.
      for (const row of emp.leaveRequests || []) {
        if (String(row?.type || "").toLowerCase() !== "work_injury" && row?.originalType !== "work_injury") continue;
        if (!["approved", "pending", "pending_manager", "pending_hr"].includes(row.status || "pending")) continue;
        const injured = key(row.injuryDate || row.eventDate || row.startDate);
        if (!injured) continue;
        if (out.some((t) => t.kind === "injury_office" && t.employeeId === emp.id && t.from === injured)) continue;
        out.push(task({
          id: `injury_office:${emp.id}:${injured}`, kind: "injury_office", employeeId: emp.id, name: emp.name, leaveId: row.id,
          due: addDays(injured, LABOUR_OFFICE_INJURY_REPORT_DAYS), from: injured,
          done: Boolean(row.labourOfficeReportedAt), doneAt: row.labourOfficeReportedAt || "", ref: row.labourOfficeRef || "",
        }, today));
      }
    }
    if (injuryCovered !== false) {
      for (const row of emp.leaveRequests || []) {
        if (String(row?.type || "").toLowerCase() !== "work_injury" && row?.originalType !== "work_injury") continue;
        if (!["approved", "pending", "pending_manager", "pending_hr"].includes(row.status || "pending")) continue;
        const injured = key(row.injuryDate || row.eventDate || row.startDate);
        if (!injured) continue;
        // One report per injury: extensions carry the same injury date.
        if (out.some((t) => t.kind === "injury" && t.employeeId === emp.id && t.from === injured)) continue;
        out.push(task({
          id: `injury:${emp.id}:${injured}`, kind: "injury", employeeId: emp.id, name: emp.name, leaveId: row.id,
          due: addDays(injured, GOSI_INJURY_REPORT_DAYS), from: injured,
          done: Boolean(row.gosiReportedAt), doneAt: row.gosiReportedAt || "", ref: row.gosiRef || "", gosiStatus: row.gosiStatus || "",
        }, today));
      }
    }
  }
  const pay = paymentWindow(today);
  const paid = (company.gosiPayments || {})[pay.month];
  out.push(task({ id: `payment:${pay.month}`, kind: "payment", month: pay.month, due: pay.due, from: `${pay.month}-01`, done: Boolean(paid), doneAt: paid?.at || "", ref: paid?.ref || "" }, today));
  const rank = (t) => (t.done ? 3 : t.overdue ? 0 : t.soon ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b) || String(a.due).localeCompare(String(b.due)));
}

export const GOSI_TASK_LABEL = {
  register: { ar: "تسجيل مشترك", en: "Register" },
  exclude: { ar: "استبعاد مشترك", en: "Exclude" },
  injury: { ar: "إبلاغ إصابة عمل", en: "Report a work injury" },
  injury_office: { ar: "إبلاغ مكتب العمل بإصابة", en: "Report an injury to the labour office" },
  wage: { ar: "تحديث الأجر", en: "Update the wage" },
  payment: { ar: "سداد الاشتراكات", en: "Pay contributions" },
};
