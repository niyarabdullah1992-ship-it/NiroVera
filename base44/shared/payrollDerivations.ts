/** Payroll / WPS — Article 107 OT, Qiwa match, approve & send gates.
 *  Design: NiroVera Platform.dc.html (payroll / wps / otRule / labels.wpsSub).
 *  Statutory numbers come from laborRules so the in-force article can be cited.
 */

import { citeRule, ruleValue } from "./laborRules.ts";

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
  /** Net frozen when the line was settled (paid, or its run approved). Read back verbatim. */
  settledNet?: number | null;
  settledOvertimeHours?: number;
  settledOvertimePay?: number;
  settledGosiEmployee?: number;
  settledAt?: string | null;
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

export function parseMonth(month: string) {
  const m = String(month || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Hourly wage from monthly base under a 30×8 convention. */
export function hourlyFromBase(base: number) {
  const b = Number(base) || 0;
  if (b <= 0) return 0;
  return b / (DAYS_PER_MONTH * SHIFT_HOURS_PER_DAY);
}

/** Overtime pay at the in-force premium (Article 107). */
export function overtimePay(base: number, overtimeHours: number, onDate?: string | Date | null) {
  const hours = Math.max(0, Number(overtimeHours) || 0);
  return Math.round(hourlyFromBase(base) * ruleValue("hours.ot.premium", onDate) * hours * 100) / 100;
}

/** Pay for the month's approved overtime hours, at the statutory Article 107 premium. */
export function lineOvertimePay(line: PayrollLineLike) {
  if (line?.overtimePay != null) return Number(line.overtimePay) || 0;
  return overtimePay(Number(line?.base) || 0, Number(line?.overtimeHours) || 0);
}

export function lineGross(line: PayrollLineLike) {
  return (Number(line.base) || 0)
    + (Number(line.allowances) || 0)
    + (Number(line.bonus) || 0)
    + lineOvertimePay(line);
}

/**
 * The employee's own GOSI share, withheld from the wage before transfer. A statutory
 * contribution, not an Article 93 deduction: it leaves the transfer but stays outside the
 * half-wage cap. Non-Saudis carry no employee share; an unknown nationality withholds
 * nothing rather than inventing a subtraction from someone's wage.
 */
export function gosiEmployeeWithheld(line: PayrollLineLike) {
  if (line?.isSaudi !== true) return 0;
  return gosiLine(line, { saudi: true }).employeeShare;
}

/**
 * The one net: base + allowances + bonus + approved overtime − documented deductions −
 * the employee's GOSI share. A settled line reports the figure stamped on it when it was
 * paid or its run approved, so a later change to this formula never rewrites money that
 * already moved; lines settled before the stamp existed keep the formula they were
 * settled under (no overtime, no GOSI).
 */
export function lineNet(line: PayrollLineLike) {
  const settled = Number(line?.settledNet);
  if (line?.settledNet != null && Number.isFinite(settled)) return settled;
  if (line?.paid) {
    return (Number(line.base) || 0) + (Number(line.allowances) || 0) + (Number(line.bonus) || 0) - (Number(line.deductions) || 0);
  }
  return lineGross(line) - (Number(line.deductions) || 0) - gosiEmployeeWithheld(line);
}

/** The figures to freeze on a line at the moment it is settled. */
export function settlementStamp(line: PayrollLineLike) {
  return {
    settledNet: lineNet({ ...line, settledNet: null, paid: false }),
    settledOvertimeHours: Math.max(0, Number(line?.overtimeHours) || 0),
    settledOvertimePay: lineOvertimePay(line),
    settledGosiEmployee: gosiEmployeeWithheld(line),
    settledAt: new Date().toISOString(),
  };
}

/** Contractual monthly wage (base + allowances) — Qiwa / Art. 93 denominator. */
export function contractWage(line: PayrollLineLike) {
  return (Number(line.base) || 0) + (Number(line.allowances) || 0);
}

/** Maximum deductible amount under Article 93 (half of contractual wage). */
export function article93MaxDeduction(line: PayrollLineLike, onDate?: string | Date | null) {
  return Math.round(contractWage(line) * ruleValue("payroll.deduction.capRatio", onDate) * 100) / 100;
}
/** @deprecated Use article93MaxDeduction */
export const article90MaxDeduction = article93MaxDeduction;

/** Gate: employer-advance recovery may not exceed 10% of the wage (Article 92). */
export function checkArticle92LoanGate(
  line: PayrollLineLike & { deductionLines?: { source?: string; amount?: number }[] },
  extraAdvance = 0,
  onDate?: string | Date | null,
) {
  const wage = contractWage(line);
  const cite = citeRule("payroll.loan.capRatio", onDate);
  const capRatio = ruleValue("payroll.loan.capRatio", onDate);
  const existing = (line?.deductionLines || [])
    .filter((row) => row?.source === "advance")
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const amount = Number(extraAdvance) || 0;
  const total = existing + amount;
  const max = Math.round(wage * capRatio * 100) / 100;
  if (wage <= 0 || total <= max) return { ok: true as const, wage, total, max, cite };
  return {
    ok: false as const,
    error: "ARTICLE_92_LOAN" as const,
    reason: `حسم السلفة (${total.toLocaleString()} ر.س) يتجاوز 10٪ من الأجر (${max.toLocaleString()} ر.س) — ${cite?.labelAr || "المادة 92"}.`,
    reasonEn: `Advance recovery (${total} SAR) exceeds 10% of the wage (${max} SAR) — Labour Law ${cite?.labelEn || "Art. 92"}.`,
    wage,
    total,
    max,
    cite,
  };
}

/** Gate: block when documented deductions exceed half the contractual wage. */
export function checkArticle93Gate(line: PayrollLineLike, onDate?: string | Date | null) {
  const wage = contractWage(line);
  const deductions = Number(line.deductions) || 0;
  const cite = citeRule("payroll.deduction.capRatio", onDate);
  if (wage <= 0) return { ok: true as const, wage, deductions, max: 0, cite };
  const max = article93MaxDeduction(line, onDate);
  if (deductions <= max) {
    return { ok: true as const, wage, deductions, max, cite };
  }
  return {
    ok: false as const,
    error: "ARTICLE_93_EXCEEDED" as const,
    reason: `مجموع الخصومات (${deductions.toLocaleString()} ر.س) يتجاوز نصف الأجر (${max.toLocaleString()} ر.س) — ${cite?.labelAr || "المادة 93"} من نظام العمل.`,
    reasonEn: `Total deductions (${deductions} SAR) exceed half the contractual wage (${max} SAR) — Labour Law ${cite?.labelEn || "Art. 93"}.`,
    wage,
    deductions,
    max,
    cite,
  };
}
/** @deprecated Use checkArticle93Gate */
export const checkArticle90Gate = checkArticle93Gate;

export function lineIssues(line: PayrollLineLike) {
  const issues: string[] = [];
  if (!Number.isFinite(Number(line?.base)) || Number(line.base) < 0) issues.push("BASE_REQUIRED");
  if (Number(line.base) <= 0) issues.push("BASE_REQUIRED");
  for (const field of ["allowances", "bonus", "deductions", "overtimeHours"] as const) {
    const v = line?.[field];
    if (v != null && (!Number.isFinite(Number(v)) || Number(v) < 0)) issues.push("INVALID_AMOUNTS");
  }
  if (lineNet(line) <= 0) issues.push("NET_REQUIRED");
  if (!checkArticle93Gate(line).ok) issues.push("ARTICLE_93_EXCEEDED");
  // The ceiling is annual, so weigh the year's approved overtime when the line
  // carries it; a single month can never reach 720 hours on its own.
  if (Number(line.overtimeHoursYtd ?? line.overtimeHours) > ruleValue("hours.ot.annualMaxHours")) issues.push("OT_ANNUAL_CAP");
  const currency = String(line?.currency || "SAR").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) issues.push("CURRENCY_REQUIRED");
  return [...new Set(issues)];
}

/** Qiwa match: contract wage equals base+allowances (within 1 SAR). Missing qiwaWage = mismatch. */
export function qiwaMatches(line: PayrollLineLike) {
  if (line.qiwaWage == null || !Number.isFinite(Number(line.qiwaWage))) return false;
  const expected = (Number(line.base) || 0) + (Number(line.allowances) || 0);
  return Math.abs(expected - Number(line.qiwaWage)) < 1;
}

export function enrichLine(line: PayrollLineLike) {
  const otHours = Math.max(0, Number(line.overtimeHours) || 0);
  const otPay = overtimePay(Number(line.base) || 0, otHours);
  const issues = lineIssues({ ...line, overtimePay: otPay });
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
    issues,
  };
}

export function deriveStationBreakdown(items: PayrollLineLike[] = []) {
  const by = new Map<string, {
    stationId: string;
    heads: number;
    base: number;
    allowances: number;
    overtime: number;
    deductions: number;
    total: number;
  }>();
  for (const raw of items) {
    const line = enrichLine(raw);
    const sid = line.stationId || "__unassigned__";
    const row = by.get(sid) || {
      stationId: sid,
      heads: 0,
      base: 0,
      allowances: 0,
      overtime: 0,
      deductions: 0,
      gosiEmployee: 0,
      total: 0,
    };
    row.heads += 1;
    row.base += Number(line.base) || 0;
    row.allowances += Number(line.allowances) || 0;
    row.overtime += line.overtimePay;
    row.deductions += Number(line.deductions) || 0;
    row.gosiEmployee += Number(line.gosiEmployee) || 0;
    row.total += line.net;
    by.set(sid, row);
  }
  return [...by.values()].map((r) => ({
    ...r,
    baseAndAllowances: r.base + r.allowances,
  }));
}

export function deriveRunTotals(items: PayrollLineLike[] = []) {
  const enriched = items.map(enrichLine);
  const baseAndAllowances = enriched.reduce((s, i) => s + (Number(i.base) || 0) + (Number(i.allowances) || 0), 0);
  const overtime = enriched.reduce((s, i) => s + i.overtimePay, 0);
  const deductions = enriched.reduce((s, i) => s + (Number(i.deductions) || 0), 0);
  // Named on its own so the header arithmetic closes: wage + overtime − deductions −
  // this is the total that leaves for the bank.
  const gosiEmployee = enriched.reduce((s, i) => s + (Number(i.gosiEmployee) || 0), 0);
  const total = enriched.reduce((s, i) => s + i.net, 0);
  const qiwaMatched = enriched.filter((i) => i.qiwaMatched).length;
  const issueCount = enriched.filter((i) => i.issues.length > 0).length;
  return {
    heads: enriched.length,
    baseAndAllowances,
    overtime,
    deductions,
    gosiEmployee,
    total,
    qiwaMatched,
    qiwaTotal: enriched.length,
    issueCount,
    otRule: "ARTICLE_107_150",
    deductionCapRule: "ARTICLE_93_50",
  };
}

/** Statutory WPS deadline: last day of the payroll month plus `WPS_FILE_WINDOW_DAYS`. */
export function wpsDeadline(month: string) {
  const p = parseMonth(month);
  if (!p) return null;
  const last = new Date(p.year, p.month, 0);
  last.setDate(last.getDate() + WPS_FILE_WINDOW_DAYS);
  return isoLocal(last);
}

export function isWpsLate(month: string, now: Date = new Date()) {
  const due = wpsDeadline(month);
  if (!due) return false;
  const [y, mo, d] = due.split("-").map(Number);
  const deadline = new Date(y, mo - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today.getTime() > deadline.getTime();
}

export function checkApprovePayrollGate(run: PayrollRunLike | null | undefined) {
  if (!run) {
    return {
      ok: false as const,
      error: "RUN_NOT_FOUND",
      reason: "مسير الرواتب غير موجود.",
      reasonEn: "Payroll run not found.",
    };
  }
  if (run.status === "approved" || run.status === "sent") {
    return {
      ok: false as const,
      error: "ALREADY_APPROVED",
      reason: "المسير معتمد بالفعل.",
      reasonEn: "This run is already approved.",
    };
  }
  const items = run.items || [];
  if (!items.length) {
    return {
      ok: false as const,
      error: "EMPTY_RUN",
      reason: "لا اعتماد لمسير بلا بنود.",
      reasonEn: "Cannot approve an empty payroll run.",
    };
  }
  const bad = items.map(enrichLine).filter((i) => i.issues.length > 0);
  if (bad.length) {
    return {
      ok: false as const,
      error: "ITEM_ISSUES",
      reason: `${bad.length} بندًا فيه خلل يمنع الاعتماد.`,
      reasonEn: `${bad.length} line(s) have issues that block approval.`,
      count: bad.length,
    };
  }
  return { ok: true as const };
}

export function checkSendWpsGate(run: PayrollRunLike | null | undefined, now: Date = new Date()) {
  if (!run) {
    return {
      ok: false as const,
      error: "RUN_NOT_FOUND",
      reason: "مسير الرواتب غير موجود.",
      reasonEn: "Payroll run not found.",
    };
  }
  if (run.status === "sent" || run.wpsSentAt) {
    return {
      ok: false as const,
      error: "ALREADY_SENT",
      reason: "ملف حماية الأجور مُرسل بالفعل.",
      reasonEn: "The WPS file has already been sent.",
    };
  }
  if (run.status !== "approved") {
    return {
      ok: false as const,
      error: "RUN_NOT_APPROVED",
      reason: "لا إرسال لملف WPS قبل اعتماد المسير.",
      reasonEn: "Cannot send the WPS file before the run is approved.",
    };
  }
  const items = (run.items || []).map(enrichLine);
  const mismatches = items.filter((i) => !i.qiwaMatched);
  if (mismatches.length) {
    return {
      ok: false as const,
      error: "QIWA_MISMATCH",
      reason: `مبالغ ${mismatches.length} موظفًا لا تطابق عقود قوى — يُمنع الإرسال.`,
      reasonEn: `${mismatches.length} employee amount(s) do not match Qiwa contracts — send blocked.`,
      count: mismatches.length,
      matched: items.length - mismatches.length,
      total: items.length,
    };
  }
  return {
    ok: true as const,
    late: isWpsLate(run.month, now),
    deadline: wpsDeadline(run.month),
  };
}

export function deriveWpsStatus(run: PayrollRunLike | null | undefined, now: Date = new Date()) {
  if (!run) {
    return { status: "missing" as const, late: false, deadline: null as string | null, matchLabel: "0/0" };
  }
  const totals = deriveRunTotals(run.items || []);
  const late = isWpsLate(run.month, now);
  const sent = run.status === "sent" || !!run.wpsSentAt;
  return {
    status: sent ? "sent" as const : run.status === "approved" ? "ready" as const : "awaiting_approval" as const,
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

/** Contributory wage = base + allowances, capped. Saudi: employee + employer shares. Expat: employer occupational hazard only. */
export function gosiLine(line: PayrollLineLike, { saudi }: { saudi?: boolean } = {}) {
  const wage = Math.min(contractWage(line), Number(GOSI_WAGE_CEILING) || 45000);
  const sa = saudi !== false;
  const employeeShare = sa ? Math.round(wage * (Number(GOSI_EMPLOYEE_RATE) || 0) * 100) / 100 : 0;
  const employerShare = Math.round(wage * (sa ? (Number(GOSI_EMPLOYER_RATE) || 0) : (Number(GOSI_EXPAT_EMPLOYER_RATE) || 0)) * 100) / 100;
  return {
    base: Math.round(wage),
    saudi: sa,
    employeeShare,
    employerShare,
    total: Math.round((employeeShare + employerShare) * 100) / 100,
  };
}

export function holidayPay(base: number, holidayHours: number) {
  const hours = Math.max(0, Number(holidayHours) || 0);
  return Math.round(hourlyFromBase(base) * ruleValue("hours.ot.premium") * hours * 100) / 100;
}

export function eidPay(base: number, eidHours: number) {
  const hours = Math.max(0, Number(eidHours) || 0);
  return Math.round(hourlyFromBase(base) * 2 * hours * 100) / 100;
}
