/** Payroll / WPS — server twin of src/lib/payrollDerivations.js. Keep the two in sync:
 *  scripts/test-pay-law.mjs compares them line by line (Arts. 90, 93, 107, 116, 117, 137).
 *  Statutory numbers come from laborRules so the in-force article can be cited.
 */

import { citeRule, ruleAt, ruleValue } from "./laborRules.ts";

export const SHIFT_HOURS_PER_DAY = ruleValue("hours.shift.ordinaryHours");
export const DAYS_PER_MONTH = ruleValue("payroll.month.conventionDays");
export const OT_RATE = ruleValue("hours.ot.premium");
export const OT_ANNUAL_MAX_HOURS = ruleValue("hours.ot.annualMaxHours");
export const WPS_FILE_WINDOW_DAYS = ruleValue("payroll.wps.fileWindowDays");
export const WPS_DEADLINE_DAY = ruleValue("payroll.wps.deadlineDayOfMonth");
/** Article 93 — deductions may not exceed half the contractual monthly wage. */
export const ARTICLE_93_CAP = ruleValue("payroll.deduction.capRatio");
/** @deprecated Use ARTICLE_93_CAP */
export const ARTICLE_90_CAP = ARTICLE_93_CAP;

export type PayrollLineLike = {
  id?: string;
  employeeId?: string;
  employeeName?: string;
  stationId?: string | null;
  base?: number;
  allowances?: number;
  bonus?: number;
  overtimeHours?: number;
  /** Approved overtime so far this calendar year, for the annual ceiling. */
  overtimeHoursYtd?: number;
  overtimePay?: number;
  deductions?: number;
  currency?: string;
  /** Contract wage on Qiwa (base+allowances expected). Null = unknown / unmatched. */
  qiwaWage?: number | null;
  paid?: boolean;
  /** Whether the employee's own GOSI share is withheld. Null/undefined = unknown, withhold nothing. */
  isSaudi?: boolean | null;
  /** Person's first GOSI registration day. Hire date is not this field. */
  gosiRegisteredAt?: string | null;
  /** Payroll month (YYYY-MM) the new-subscriber annuity band is read on. */
  gosiAsOf?: string | null;
  month?: string | null;
  /** Net frozen when the line was settled (paid, or its run approved). Read back verbatim. */
  settledNet?: number | null;
  settledOvertimeHours?: number;
  settledOvertimePay?: number;
  settledGosiEmployee?: number;
  settledAt?: string | null;
  [key: string]: any;
};

export type PayrollRunLike = {
  id?: string;
  month: string; // YYYY-MM
  companyId?: string;
  status?: "draft" | "approved" | "sent";
  approvedAt?: string | null;
  approvedBy?: string | null;
  wpsSentAt?: string | null;
  wpsSentBy?: string | null;
  items?: PayrollLineLike[];
};

export function parseMonth(month) {
  const m = String(month || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function hourlyFromBase(base) {
  const b = Number(base) || 0;
  if (b <= 0) return 0;
  return b / (DAYS_PER_MONTH * SHIFT_HOURS_PER_DAY);
}

/**
 * Art. 107: an overtime hour is paid at the hourly wage (the actual wage — Art. 2) plus 50% of the
 * basic hourly wage. With no allowances this is the familiar time-and-a-half of basic.
 */
export function overtimePay(base, overtimeHours, allowances = 0) {
  const hours = Math.max(0, Number(overtimeHours) || 0);
  const premium = Number(ruleValue("hours.ot.premium")) - 1;
  const hourly = hourlyFromBase((Number(base) || 0) + Math.max(0, Number(allowances) || 0));
  return Math.round((hourly + hourlyFromBase(base) * premium) * hours * 100) / 100;
}

/**
 * Art. 107(3): hours worked on official holidays and Eids are overtime hours, priced by the same
 * Art. 107 formula. They reach the line either inside the approved overtime decisions (flagged
 * `holiday: true`, already in `overtimeHours`) or as `holidayOvertimeHours` read from approved
 * attendance on an official holiday that no decision covers — never both.
 */
export function lineOvertimeHours(line) {
  return Math.max(0, Number(line?.overtimeHours) || 0) + Math.max(0, Number(line?.holidayOvertimeHours) || 0);
}

/** Pay for the month's approved overtime hours, at the statutory Article 107 premium. */
export function lineOvertimePay(line) {
  if (line?.overtimePay != null) return Number(line.overtimePay) || 0;
  return overtimePay(Number(line?.base) || 0, lineOvertimeHours(line), Number(line?.allowances) || 0);
}

/**
 * Refunds owed back on this line: an Art. 97 acquittal (`refunds`), accepted Art. 91 objections
 * (`damageRefunds`), and approved expense claims — relocation (model Arts. 9/12) and mission (model
 * Art. 24) — paid back with the wage (`expenseRefunds`). None of them is wage; none counts in Art. 93.
 */
export function lineRefunds(line) {
  return Math.max(0, Number(line?.refunds) || 0) + Math.max(0, Number(line?.damageRefunds) || 0) + Math.max(0, Number(line?.expenseRefunds) || 0);
}

export function lineGross(line) {
  return (Number(line.base) || 0) + (Number(line.allowances) || 0) + (Number(line.bonus) || 0) + lineOvertimePay(line) + lineRefunds(line);
}

/**
 * The employee's own GOSI share, withheld from the wage before transfer.
 *
 * It is a contribution Art. 92/2 allows to be deducted without the worker's consent. It stays
 * outside the documented deduction lines, but it does count toward the Art. 93 half-wage cap,
 * which applies "in all cases". Non-Saudis carry no employee share (occupational hazard is on the
 * employer alone), and a line whose nationality is not yet known withholds nothing —
 * an unknown never invents a subtraction from someone's wage.
 */
export function gosiEmployeeWithheld(line) {
  if (line?.isSaudi !== true) return 0;
  const quote = gosiLine(line, {
    saudi: true,
    onDate: line?.gosiAsOf || line?.month,
    registeredAt: line?.gosiRegisteredAt,
  });
  if (quote.blocked) return 0;
  return quote.employeeShare;
}

/**
 * The one net for this line — what the employee is owed and what the bank transfer
 * carries: base + allowances + bonus + approved overtime − documented deductions −
 * the employee's GOSI share.
 *
 * A settled line does not recompute. When a line is paid — or the run it belongs to is
 * approved — the figure is stamped on it and read back verbatim, so a later change to
 * this formula can never rewrite money that already moved. Lines settled before the
 * stamp existed keep the formula they were settled under (no overtime, no GOSI).
 */
export function lineNet(line) {
  const settled = Number(line?.settledNet);
  if (line?.settledNet != null && Number.isFinite(settled)) return settled;
  if (line?.paid) return (Number(line.base) || 0) + (Number(line.allowances) || 0) + (Number(line.bonus) || 0) - (Number(line.deductions) || 0);
  // Never negative: a month fully not due nets to zero, not to a debt on the worker.
  return Math.max(0, lineGross(line) - (Number(line.deductions) || 0) - gosiEmployeeWithheld(line) - lineWageNotDue(line));
}

/**
 * Wage the law says is not due for the month — not an Art. 92 deduction, so outside the
 * Art. 93 half-wage cap: sick bands (117), work injury (137/139), unpaid leave (116) and the
 * unpaid half while detained in a work-related case (97).
 */
export function lineWageNotDue(line) {
  const sum = lineInjuryCut(line) + lineSickCut(line) + lineUnpaidLeaveCut(line) + lineDetentionCut(line);
  // Days are counted once across reasons upstream (payrollWageSync); whatever the inputs, the wage not
  // due can never exceed the month's contractual wage.
  const wage = Math.max(0, (Number(line?.base) || 0) + (Number(line?.allowances) || 0));
  return wage > 0 ? Math.min(sum, wage) : sum;
}

/** Art. 116: approved unpaid-leave days are wage not due — they reduce the gross, they are not deducted. */
export function lineUnpaidLeaveCut(line) {
  if (line?.settledNet != null) return Number(line.settledUnpaidLeaveCut) || 0;
  return Math.max(0, Number(line?.unpaidLeaveCut) || 0);
}

/** Art. 97: half the wage while detained in a work-related case (up to 180 days), nothing beyond. */
export function lineDetentionCut(line) {
  if (line?.settledNet != null) return Number(line.settledDetentionCut) || 0;
  return Math.max(0, Number(line?.detentionCut) || 0);
}

/** Art. 117 sick bands — a quarter off after the first 30 days, nothing after 90. Set by law, not an Art. 92 deduction. */
export function lineSickCut(line) {
  if (line?.settledNet != null) return Number(line.settledSickCut) || 0;
  return Math.max(0, Number(line?.sickReduction) || 0) + Math.max(0, Number(line?.sickUnpaid) || 0);
}

/** Art. 137 reduction and Art. 139 unpaid injury days — set by the law, not an Art. 92 deduction. */
export function lineInjuryCut(line) {
  if (line?.settledNet != null) return Number(line.settledInjuryCut) || 0;
  return Math.max(0, Number(line?.injuryReduction) || 0) + Math.max(0, Number(line?.injuryUnpaid) || 0) + Math.max(0, Number(line?.injuryWageStop) || 0);
}

/**
 * The parts a payslip shows, read off the line and honouring its settlement stamp, so the
 * on-screen slip, the printed slip and the Mudad row describe the same money instead of
 * each recomputing it.
 */
export function lineComponents(line) {
  const settled = line?.settledNet != null;
  return {
    settled,
    base: Number(line?.base) || 0,
    allowances: Number(line?.allowances) || 0,
    bonus: Number(line?.bonus) || 0,
    overtimeHours: settled ? Number(line.settledOvertimeHours) || 0 : lineOvertimeHours(line),
    holidayOvertimeHours: Math.max(0, Number(line?.holidayOvertimeHours) || 0),
    overtimePay: settled ? Number(line.settledOvertimePay) || 0 : lineOvertimePay(line),
    refunds: lineRefunds(line),
    deductions: Number(line?.deductions) || 0,
    gosiEmployee: settled ? Number(line.settledGosiEmployee) || 0 : gosiEmployeeWithheld(line),
    injuryCut: lineInjuryCut(line),
    sickCut: lineSickCut(line),
    unpaidLeaveCut: lineUnpaidLeaveCut(line),
    detentionCut: lineDetentionCut(line),
    // Art. 109 / Art. 90: what already left ahead of the month-end transfer (annual leave paid in
    // advance, weekly instalments). Part of the same net — the transfer carries only the rest.
    paidAhead: linePaidAhead(line),
    net: lineNet(line),
  };
}

/** Amounts paid out ahead of the month-end transfer: Art. 109 leave advances and Art. 90 weekly instalments. */
export function linePaidAhead(line) {
  const sum = (rows) => (Array.isArray(rows) ? rows : []).reduce((s, r) => s + (r?.paidAt ? Math.max(0, Number(r.amount) || 0) : 0), 0);
  return Math.round((sum(line?.leaveAdvances) + sum(line?.weeklyPayments)) * 100) / 100;
}

/** What the month-end transfer still carries once advances and weekly instalments went out. */
export function lineTransferDue(line) {
  return Math.max(0, Math.round((lineNet(line) - linePaidAhead(line)) * 100) / 100);
}

/** The figures to freeze on a line at the moment it is settled. */
export function settlementStamp(line) {
  const open = { ...line, settledNet: null };
  return {
    settledNet: lineNet({ ...line, settledNet: null, paid: false }),
    settledOvertimeHours: lineOvertimeHours(line),
    settledOvertimePay: lineOvertimePay(line),
    settledGosiEmployee: gosiEmployeeWithheld(line),
    settledInjuryCut: lineInjuryCut(open),
    settledSickCut: lineSickCut(open),
    settledUnpaidLeaveCut: lineUnpaidLeaveCut(open),
    settledDetentionCut: lineDetentionCut(open),
    settledAt: new Date().toISOString(),
  };
}

/** Every settlement field — cleared together when a paid mark is taken back. */
export const SETTLEMENT_FIELDS = [
  "settledNet", "settledOvertimeHours", "settledOvertimePay", "settledGosiEmployee",
  "settledInjuryCut", "settledSickCut", "settledUnpaidLeaveCut", "settledDetentionCut", "settledAt",
];

/**
 * The wage the statutory ratios are measured against: base + allowances.
 *
 * Deliberately without overtime or bonus. Article 93 caps deductions at half "الأجر
 * المستحق" — the contractual wage — so a month with heavy overtime must not widen how
 * much may be deducted from the worker, and the Qiwa contract comparison is a contract
 * figure, not a payment figure.
 */
export function contractWage(line) {
  return (Number(line.base) || 0) + (Number(line.allowances) || 0);
}

/** The employee's GOSI share as it stands on the line (the stamped one once settled). */
function lineGosiShare(line) {
  return line?.settledNet != null ? Number(line.settledGosiEmployee) || 0 : gosiEmployeeWithheld(line);
}

/**
 * Room left for documented deductions under Art. 93: half the wage, less the GOSI share that
 * Art. 92/2 counts among the deductions.
 */
export function article93MaxDeduction(line) {
  const half = contractWage(line) * ruleValue("payroll.deduction.capRatio");
  return Math.max(0, Math.round((half - lineGosiShare(line)) * 100) / 100);
}
/** @deprecated Use article93MaxDeduction */
export const article90MaxDeduction = article93MaxDeduction;

export function checkArticle92LoanGate(line, extraAdvance = 0) {
  const wage = contractWage(line);
  const cite = citeRule("payroll.loan.capRatio");
  const capRatio = ruleValue("payroll.loan.capRatio");
  const existing = (line?.deductionLines || [])
    .filter((row) => row?.source === "advance")
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const amount = Number(extraAdvance) || 0;
  const total = existing + amount;
  const max = Math.round(wage * capRatio * 100) / 100;
  if (wage <= 0 || total <= max) return { ok: true, wage, total, max, cite };
  return {
    ok: false,
    error: "ARTICLE_92_LOAN",
    reason: `حسم السلفة (${total.toLocaleString()} ر.س) يتجاوز 10٪ من الأجر (${max.toLocaleString()} ر.س) — ${cite?.labelAr || "المادة 92"}.`,
    reasonEn: `Advance recovery (${total} SAR) exceeds 10% of the wage (${max} SAR) — Labour Law ${cite?.labelEn || "Art. 92"}.`,
    wage,
    total,
    max,
    cite,
  };
}

export function checkArticle93Gate(line) {
  const wage = contractWage(line);
  // Art. 92/2 lists social-insurance contributions among the deductions, and Art. 93 caps
  // what is deducted "في جميع الأحوال" — so the employee's GOSI share counts toward the half.
  const gosi = lineGosiShare(line);
  const deductions = (Number(line.deductions) || 0) + gosi;
  const cite = citeRule("payroll.deduction.capRatio");
  if (wage <= 0) return { ok: true, wage, deductions, max: 0, cite };
  const half = Math.round(wage * ruleValue("payroll.deduction.capRatio") * 100) / 100;
  // `max` is the room left for documented deductions once the GOSI share is counted.
  const max = article93MaxDeduction(line);
  if (deductions <= half + 0.001) return { ok: true, wage, deductions, max, half, gosi, cite };
  return {
    ok: false,
    error: "ARTICLE_93_EXCEEDED",
    reason: `مجموع الخصومات مع حصة التأمينات (${deductions.toLocaleString()} ر.س) يتجاوز نصف الأجر (${half.toLocaleString()} ر.س) — ${cite?.labelAr || "المادة 93"} من نظام العمل.`,
    reasonEn: `Total deductions with the GOSI share (${deductions} SAR) exceed half the contractual wage (${half} SAR) — Labour Law ${cite?.labelEn || "Art. 93"}.`,
    half,
    gosi,
    wage,
    deductions,
    max,
    cite,
  };
}
/** @deprecated Use checkArticle93Gate */
export const checkArticle90Gate = checkArticle93Gate;

export function lineIssues(line) {
  const issues = [];
  if (!Number.isFinite(Number(line?.base)) || Number(line.base) < 0 || Number(line.base) <= 0) issues.push("BASE_REQUIRED");
  for (const field of ["allowances", "bonus", "deductions", "overtimeHours"]) {
    const v = line?.[field];
    if (v != null && (!Number.isFinite(Number(v)) || Number(v) < 0)) issues.push("INVALID_AMOUNTS");
  }
  // A month the law leaves wholly unpaid (Arts. 97/116/117/139) may net zero; anything else may not.
  if (lineNet(line) <= 0 && !(lineWageNotDue(line) > 0)) issues.push("NET_REQUIRED");
  if (!checkArticle93Gate(line).ok) issues.push("ARTICLE_93_EXCEEDED");
  // The ceiling is annual, so weigh the year's approved overtime when the line
  // carries it; a single month can never reach 720 hours on its own.
  if (Number(line.overtimeHoursYtd ?? line.overtimeHours) > ruleValue("hours.ot.annualMaxHours")) issues.push("OT_ANNUAL_CAP");
  const currency = String(line?.currency || "SAR").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) issues.push("CURRENCY_REQUIRED");
  // Art. 90: the wage and every sum due are paid in the official currency of the Kingdom.
  else if (currency !== WAGE_CURRENCY) issues.push("CURRENCY_NOT_SAR");
  return [...new Set(issues)];
}

export function qiwaMatches(line) {
  if (line.qiwaWage == null || !Number.isFinite(Number(line.qiwaWage))) return false;
  const expected = (Number(line.base) || 0) + (Number(line.allowances) || 0);
  return Math.abs(expected - Number(line.qiwaWage)) < 1;
}

/** Art. 90 — the Kingdom's official currency. */
export const WAGE_CURRENCY = "SAR";

/**
 * One line with its derived figures. Overtime is priced by Art. 107 on the actual wage
 * (base + allowances) plus half the basic hourly — the same formula the payslip shows — so the
 * run header, the approval gate and the slip never disagree. A settled line keeps its stamp.
 */
export function enrichLine(line) {
  const settled = line?.settledNet != null;
  const otHours = Math.max(0, Number(line.overtimeHours) || 0);
  const otPay = settled
    ? Number(line.settledOvertimePay) || 0
    : overtimePay(Number(line.base) || 0, lineOvertimeHours(line), Number(line.allowances) || 0);
  return {
    ...line,
    overtimeHours: otHours,
    overtimePay: otPay,
    gosiEmployee: gosiEmployeeWithheld(line),
    gross: lineGross({ ...line, overtimePay: otPay }),
    net: lineNet({ ...line, overtimePay: otPay }),
    qiwaMatched: qiwaMatches(line),
    contractWage: contractWage(line),
    article93Max: article93MaxDeduction(line),
    article90Max: article93MaxDeduction(line),
    issues: lineIssues({ ...line, overtimePay: otPay }),
  };
}

export function deriveStationBreakdown(items = []) {
  const by = new Map();
  for (const raw of items) {
    const line = enrichLine(raw);
    const sid = line.stationId || "__unassigned__";
    const row = by.get(sid) || { stationId: sid, heads: 0, base: 0, allowances: 0, overtime: 0, deductions: 0, gosiEmployee: 0, total: 0 };
    row.heads += 1;
    row.base += Number(line.base) || 0;
    row.allowances += Number(line.allowances) || 0;
    row.overtime += line.overtimePay;
    row.deductions += Number(line.deductions) || 0;
    row.gosiEmployee += Number(line.gosiEmployee) || 0;
    row.total += line.net;
    by.set(sid, row);
  }
  return [...by.values()].map((r) => ({ ...r, baseAndAllowances: r.base + r.allowances }));
}

export function deriveRunTotals(items = []) {
  const enriched = items.map(enrichLine);
  return {
    // Wage not due by law (sick, injury, unpaid leave, detention) and refunds, named apart so the
    // header still closes: wage + overtime + refunds − deductions − GOSI − not due = total.
    wageNotDue: enriched.reduce((s, i) => s + lineWageNotDue(i), 0),
    refunds: enriched.reduce((s, i) => s + lineRefunds(i), 0),
    heads: enriched.length,
    baseAndAllowances: enriched.reduce((s, i) => s + (Number(i.base) || 0) + (Number(i.allowances) || 0), 0),
    overtime: enriched.reduce((s, i) => s + i.overtimePay, 0),
    deductions: enriched.reduce((s, i) => s + (Number(i.deductions) || 0), 0),
    // Named on its own so the header arithmetic closes: wage + overtime − deductions −
    // this is the total that leaves for the bank.
    gosiEmployee: enriched.reduce((s, i) => s + (Number(i.gosiEmployee) || 0), 0),
    total: enriched.reduce((s, i) => s + i.net, 0),
    qiwaMatched: enriched.filter((i) => i.qiwaMatched).length,
    qiwaTotal: enriched.length,
    issueCount: enriched.filter((i) => i.issues.length > 0).length,
    otRule: "ARTICLE_107_150",
    deductionCapRule: "ARTICLE_93_50",
  };
}

export function wpsDeadline(month) {
  const p = parseMonth(month);
  if (!p) return null;
  const last = new Date(p.year, p.month, 0);
  last.setDate(last.getDate() + WPS_FILE_WINDOW_DAYS);
  return isoLocal(last);
}

export function isWpsLate(month, now = new Date()) {
  const due = wpsDeadline(month);
  if (!due) return false;
  const [y, mo, d] = due.split("-").map(Number);
  const deadline = new Date(y, mo - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today.getTime() > deadline.getTime();
}

export function checkApprovePayrollGate(run) {
  if (!run) return { ok: false, error: "RUN_NOT_FOUND", reason: "مسير الرواتب غير موجود.", reasonEn: "Payroll run not found." };
  if (run.status === "approved" || run.status === "sent") {
    return { ok: false, error: "ALREADY_APPROVED", reason: "المسير معتمد بالفعل.", reasonEn: "This run is already approved." };
  }
  const items = run.items || [];
  if (!items.length) {
    return { ok: false, error: "EMPTY_RUN", reason: "لا اعتماد لمسير بلا بنود.", reasonEn: "Cannot approve an empty payroll run." };
  }
  const bad = items.map(enrichLine).filter((i) => i.issues.length > 0);
  if (bad.length) {
    return {
      ok: false,
      error: "ITEM_ISSUES",
      reason: `${bad.length} بندًا فيه خلل يمنع الاعتماد.`,
      reasonEn: `${bad.length} line(s) have issues that block approval.`,
      count: bad.length,
    };
  }
  return { ok: true };
}

export function checkSendWpsGate(run, now = new Date()) {
  if (!run) return { ok: false, error: "RUN_NOT_FOUND", reason: "مسير الرواتب غير موجود.", reasonEn: "Payroll run not found." };
  if (run.status === "sent" || run.wpsSentAt) {
    return { ok: false, error: "ALREADY_SENT", reason: "ملف حماية الأجور بُني بالفعل.", reasonEn: "The WPS file has already been built." };
  }
  if (run.status !== "approved") {
    return { ok: false, error: "RUN_NOT_APPROVED", reason: "لا بناء لملف WPS قبل اعتماد المسير.", reasonEn: "Cannot build the WPS file before the run is approved." };
  }
  const items = (run.items || []).map(enrichLine);
  const mismatches = items.filter((i) => !i.qiwaMatched);
  if (mismatches.length) {
    return {
      ok: false,
      error: "QIWA_MISMATCH",
      reason: `مبالغ ${mismatches.length} موظفًا لا تطابق عقود قوى — يُمنع بناء الملف.`,
      reasonEn: `${mismatches.length} employee amount(s) do not match Qiwa contracts — file build blocked.`,
      count: mismatches.length,
      matched: items.length - mismatches.length,
      total: items.length,
    };
  }
  return { ok: true, late: isWpsLate(run.month, now), deadline: wpsDeadline(run.month) };
}

/**
 * Monthly wage-protection procedure used by the payroll workspace.
 * prepare → review (Art. 92 / 93 / 107) → approve → Mudad/WPS (30 days from month-end).
 */
export function payrollCycleState({ hasRun, heads = 0, issueCount = 0, status = "", wpsLate = false } = {}) {
  const prepared = Boolean(hasRun && heads > 0);
  const reviewed = prepared && issueCount === 0;
  const approved = status === "approved" || status === "sent";
  const sent = status === "sent";
  const steps = [
    { key: "prepare", tab: "run", done: prepared },
    { key: "review", tab: "lines", done: reviewed },
    { key: "approve", tab: "run", done: approved },
    { key: "protect", tab: "wps", done: sent, warn: Boolean(wpsLate) && !sent },
  ];
  const current = steps.find((step) => !step.done) || steps[3];
  return { steps, currentKey: current.key, prepared, reviewed, approved, sent };
}

export function deriveWpsStatus(run, now = new Date()) {
  if (!run) return { status: "missing", late: false, deadline: null, matchLabel: "0/0" };
  const totals = deriveRunTotals(run.items || []);
  const late = isWpsLate(run.month, now);
  const sent = run.status === "sent" || !!run.wpsSentAt;
  return {
    status: sent ? "sent" : run.status === "approved" ? "ready" : "awaiting_approval",
    late,
    deadline: wpsDeadline(run.month),
    matched: totals.qiwaMatched,
    total: totals.qiwaTotal,
    matchLabel: `${totals.qiwaMatched}/${totals.qiwaTotal}`,
  };
}

export const GOSI_WAGE_CEILING = ruleValue("compliance.gosi.wageCeiling");
export const GOSI_EMPLOYEE_RATE = ruleValue("compliance.gosi.employeeRate");
export const GOSI_EMPLOYER_RATE = ruleValue("compliance.gosi.employerRate");
export const GOSI_EXPAT_EMPLOYER_RATE = ruleValue("compliance.gosi.expatEmployerRate");
/** First GOSI registration on or after this day, with no earlier contribution period, is a new subscriber.
 *  Fact paths and writers live in src/lib/hrFacts.js. Hire date is not this date.
 */
export const GOSI_NEW_LAW_FROM = "2024-07-03";
export const GOSI_NEW_RATE_UNCONFIRMED_AR = "نسبة المشترك الجديد غير مثبتة";
export const GOSI_NEW_RATE_UNCONFIRMED_EN = "The new-subscriber rate is not confirmed";

/** ISO day only. Hire date and the establishment number are never a registration date. */
export function gosiRegistrationIso(value: unknown) {
  const text = String(value ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

/** old | new | unset. An empty date is unset, and unset is not new. */
export function gosiSubscriberClass(registeredAt: unknown) {
  const iso = gosiRegistrationIso(registeredAt);
  if (!iso) return "unset" as const;
  return iso < GOSI_NEW_LAW_FROM ? "old" as const : "new" as const;
}


function gosiAsOfDay(onDate) {
  const text = String(onDate ?? "").trim();
  const month = text.match(/^(\d{4})-(\d{2})$/);
  if (month) {
    const last = new Date(Number(month[1]), Number(month[2]), 0);
    return isoLocal(last);
  }
  const day = gosiRegistrationIso(text);
  if (day) return day;
  return isoLocal(new Date());
}

function bpsOf(rate) {
  return Math.round(Number(rate) * 10000);
}

function halalaFromBps(wage, bps) {
  return Math.round((Number(wage) || 0) * bps / 100) / 100;
}

export function formatGosiPercent(rate, ar = true) {
  if (rate == null || !Number.isFinite(Number(rate))) return "";
  const pct = Math.round(Number(rate) * 10000) / 100;
  const text = Number.isInteger(pct) ? String(pct) : String(pct);
  return ar ? `${text}٪` : `${text}%`;
}

/**
 * Rates applied on a day. Old subscribers, and Saudis with an empty registration
 * date, stay on 9.75% / 11.75%. New subscribers use the annuity band in force
 * on that day plus SANED and hazards. A missing band withholds nothing.
 */
export function gosiAppliedRates({ subscriberClass = "unset", onDate, saudi = true } = {}) {
  if (saudi === false) {
    const employerRate = Number(ruleValue("compliance.gosi.expatEmployerRate")) || 0;
    return {
      subscriberClass: "expat",
      employeeRate: 0,
      employerRate,
      employeeBps: 0,
      employerBps: bpsOf(employerRate),
      blocked: false,
      reason: "",
      reasonEn: "",
    };
  }
  const klass = subscriberClass === "old" || subscriberClass === "new" ? subscriberClass : "unset";
  if (klass !== "new") {
    const employeeRate = Number(ruleValue("compliance.gosi.employeeRate")) || 0;
    const employerRate = Number(ruleValue("compliance.gosi.employerRate")) || 0;
    return {
      subscriberClass: klass,
      employeeRate,
      employerRate,
      employeeBps: bpsOf(employeeRate),
      employerBps: bpsOf(employerRate),
      blocked: false,
      reason: "",
      reasonEn: "",
    };
  }
  const day = gosiAsOfDay(onDate);
  const annuity = ruleAt("compliance.gosi.newAnnuityRate", day);
  if (!annuity || typeof annuity.value !== "number") {
    return {
      subscriberClass: "new",
      employeeRate: null,
      employerRate: null,
      employeeBps: null,
      employerBps: null,
      blocked: true,
      reason: GOSI_NEW_RATE_UNCONFIRMED_AR,
      reasonEn: GOSI_NEW_RATE_UNCONFIRMED_EN,
      onDate: day,
    };
  }
  const saned = bpsOf(ruleValue("compliance.gosi.sanedRate"));
  const hazard = bpsOf(ruleValue("compliance.gosi.expatEmployerRate"));
  const annuityBps = bpsOf(annuity.value);
  const employeeBps = annuityBps + saned;
  const employerBps = annuityBps + saned + hazard;
  return {
    subscriberClass: "new",
    employeeRate: employeeBps / 10000,
    employerRate: employerBps / 10000,
    employeeBps,
    employerBps,
    annuityRate: annuity.value,
    blocked: false,
    reason: "",
    reasonEn: "",
    onDate: day,
  };
}

/**
 * The GOSI contributory wage (GOSI employer guide): basic wage + housing allowance + commissions
 * and sales percentages — not transport, other allowances, night pay, overtime or bonus.
 * Capped at 45,000; floored at 1,500 in the annuity branch (Saudi) and 400 in the hazards branch
 * for those outside it (non-Saudi). A line whose allowances were never split keeps the lump
 * (housing cannot be told apart) and says so through `lump: true`.
 */
export function gosiContributoryWage(line = {}, { saudi = true } = {}) {
  const base = Number(line.base) || 0;
  const hasSplit = line.housingAllowance != null && line.housingAllowance !== "";
  const commission = Math.max(0, Number(line.commissionAmount) || 0);
  const raw = hasSplit ? base + (Number(line.housingAllowance) || 0) + commission : contractWage(line);
  if (raw <= 0) return { wage: 0, lump: !hasSplit, floored: false };
  const cap = Number(GOSI_WAGE_CEILING) || 45000;
  const floor = saudi !== false
    ? Number(ruleValue("compliance.gosi.wageFloorAnnuity")) || 1500
    : Number(ruleValue("compliance.gosi.wageFloorHazard")) || 400;
  const wage = Math.min(cap, Math.max(floor, raw));
  return { wage, lump: !hasSplit, floored: raw < floor };
}

/**
 * Contributory wage = base + housing + commissions (gosiContributoryWage), capped and floored.
 * Overtime and bonus stay outside. Saudi shares follow the subscriber class.
 * The class is the person's first GOSI registration date, never the hire date.
 */
export function gosiLine(line, { saudi, onDate, registeredAt } = {}) {
  const sa = saudi !== false;
  const contrib = gosiContributoryWage(line, { saudi: sa });
  const wage = contrib.wage;
  const registered = gosiRegistrationIso(registeredAt ?? line?.gosiRegisteredAt);
  const subscriberClass = sa ? gosiSubscriberClass(registered) : "expat";
  const rates = gosiAppliedRates({
    subscriberClass,
    onDate: onDate || line?.gosiAsOf || line?.month,
    saudi: sa,
  });
  const empty = {
    base: Math.round(wage),
    lump: contrib.lump,
    floored: contrib.floored,
    saudi: sa,
    subscriberClass: sa ? subscriberClass : "expat",
    registeredAt: registered,
    employeeRate: rates.employeeRate,
    employerRate: rates.employerRate,
    blocked: rates.blocked,
    reason: rates.reason,
    reasonEn: rates.reasonEn,
  };
  if (!sa) {
    const employerShare = halalaFromBps(wage, rates.employerBps);
    return { ...empty, employeeShare: 0, employerShare, total: employerShare };
  }
  if (rates.blocked) {
    return { ...empty, employeeShare: 0, employerShare: 0, total: 0 };
  }
  const employeeShare = halalaFromBps(wage, rates.employeeBps);
  const employerShare = halalaFromBps(wage, rates.employerBps);
  return {
    ...empty,
    employeeShare,
    employerShare,
    total: Math.round((employeeShare + employerShare) * 100) / 100,
  };
}

/**
 * Art. 107(3): hours worked on an official holiday are overtime hours — the hourly actual wage
 * plus 50% of the basic hourly wage. No separate holiday multiplier exists in the Law.
 */
export function holidayPay(base, holidayHours, allowances = 0) {
  return overtimePay(base, holidayHours, allowances);
}

/** Eid hours are holiday hours (Art. 107(3)) — the same formula; there is no ×2 in the Law. */
export function eidPay(base, eidHours, allowances = 0) {
  return overtimePay(base, eidHours, allowances);
}
