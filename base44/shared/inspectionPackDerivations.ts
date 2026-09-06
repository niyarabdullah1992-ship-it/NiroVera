/** Inspection file — seven statutory registers derived from owning modules.
 *  Keep in sync with src/lib/inspectionPackDerivations.js
 */

import { citeRule } from "./laborRules.ts";

export const INSPECTION_REGISTERS = [
  { id: "workers", ar: "سجل العمال والعقود", en: "Workers and contracts", to: "/app/hr", ruleId: "contract.written.cite" },
  { id: "wages", ar: "سجل الأجور", en: "Wage register", to: "/app/payroll", ruleId: "payroll.deduction.capRatio" },
  { id: "attendance", ar: "سجل الحضور والساعات", en: "Attendance and hours", to: "/app/attendance", ruleId: "hours.week.ordinaryMaxHours" },
  { id: "leave", ar: "سجل الإجازات", en: "Leave register", to: "/app/leave", ruleId: "leave.annual.days" },
  { id: "discipline", ar: "سجل الجزاءات", en: "Sanctions register", to: "/app/discipline", ruleId: "discipline.fines.register.cite" },
  { id: "safety", ar: "سجل السلامة والإصابات", en: "Safety and injuries", to: "/app/safety", ruleId: "safety.precautions.cite" },
  { id: "inspection_file", ar: "ملف التفتيش المشتق", en: "Derived inspection pack", to: "/app/settings", ruleId: null },
] as const;

export function deriveInspectionPack(data: {
  employees?: unknown[];
  disciplinaryCases?: Array<{ status?: string }>;
  safety?: unknown[];
  payrollRuns?: unknown[];
  payroll?: unknown[];
} = {}) {
  const employees = data.employees || [];
  const cases = data.disciplinaryCases || [];
  const safety = data.safety || [];
  const payroll = data.payrollRuns || data.payroll || [];
  return {
    generatedAt: new Date().toISOString(),
    registers: INSPECTION_REGISTERS.map((row) => {
      const cite = row.ruleId ? citeRule(row.ruleId) : null;
      return {
        ...row,
        article: cite?.article || null,
        articleLabel: cite?.labelAr || "",
        count: row.id === "workers" ? employees.length
          : row.id === "discipline" ? cases.length
          : row.id === "safety" ? safety.length
          : row.id === "wages" ? (Array.isArray(payroll) ? payroll.length : 0)
          : employees.length,
      };
    }),
    crew: employees.length,
    openDiscipline: cases.filter((c) => c.status && c.status !== "ruling" && c.status !== "closed").length,
  };
}
