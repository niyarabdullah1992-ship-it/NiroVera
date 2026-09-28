/**
 * Payroll lines — amounts are derived from the employee wage file + attendance.
 * Empty face money stays «—». Do not invent sample package salaries.
 */

export const PAYROLL_FACTS = Object.freeze([
  {
    id: "payroll.run",
    domain: "payroll",
    scope: "payrollRun",
    home: "payrollRuns",
    path: "payrollRuns",
    blobCategory: "payrollRuns",
    writer: "payroll-run",
    stored: true,
    isolation: "companyId",
    surfaceAr: "مسير الرواتب",
    noteAr: "لقطة الدورة. المبالغ تُشتق عند التشغيل.",
  },
  {
    id: "payroll.base",
    domain: "payroll",
    scope: "payrollLine",
    home: "payrollRuns[].items[].base",
    path: "base",
    writer: "payroll-derivation",
    stored: true,
    isolation: "companyId",
    source: "employee.baseSalary",
    surfaceAr: "قسيمتي",
  },
  {
    id: "payroll.allowances",
    domain: "payroll",
    scope: "payrollLine",
    home: "payrollRuns[].items[].allowances",
    path: "allowances",
    writer: "payroll-derivation",
    stored: true,
    isolation: "companyId",
    source: "employee.housingAllowance+transportAllowance+otherAllowances",
    surfaceAr: "قسيمتي",
  },
  {
    id: "payroll.overtime",
    domain: "payroll",
    scope: "payrollLine",
    home: "payrollRuns[].items[].overtimeHours",
    path: "overtimeHours",
    writer: "payroll-derivation",
    stored: true,
    isolation: "companyId",
    source: "approved-attendance",
    surfaceAr: "قسيمتي",
  },
  {
    id: "payroll.gosiEmployee",
    domain: "payroll",
    scope: "payrollLine",
    home: "payrollRuns[].items[].gosiEmployee",
    path: "gosiEmployee",
    writer: "payroll-derivation",
    stored: true,
    isolation: "companyId",
    source: "statute.employeeRate",
    surfaceAr: "قسيمتي",
    noteAr: "فارغ التسجيل + سعودي → 9.75٪. لا جدول أسعار قابل للتحرير في لوحة المالك.",
  },
  {
    id: "payroll.net",
    domain: "payroll",
    scope: "payrollLine",
    home: "derived:lineNet",
    path: "net",
    writer: "derived-only",
    stored: false,
    isolation: "companyId",
    source: "lineNet",
    surfaceAr: "قسيمتي",
  },
  {
    id: "payroll.journal",
    domain: "payroll",
    scope: "journal",
    home: "journalEntries",
    path: "journalEntries",
    blobCategory: "journalEntries",
    writer: "derived-only",
    stored: true,
    isolation: "companyId",
    surfaceAr: "مذكراتي",
    noteAr: "مذكرات الموظف — ليست قيداً محاسبياً لصافي الراتب.",
  },
]);

export function readPayrollRuns(company) {
  return Array.isArray(company?.payrollRuns) ? company.payrollRuns : [];
}

export function emptyMoneyDisplay(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return value;
}
