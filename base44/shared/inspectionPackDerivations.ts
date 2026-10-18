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
  { id: "training", ar: "سجل تدريب السعوديين (اللائحة م5/5)", en: "Saudi training register (Regs Art. 5(5))", to: "/app/safety", ruleId: null },
  { id: "medical", ar: "سجل الفحص الطبي الدوري (اللائحة م5/6)", en: "Periodic medical-exam register (Regs Art. 5(6))", to: "/app/safety", ruleId: null },
  { id: "held_documents", ar: "وثائق العمال لدى المنشأة (اللائحة م6)", en: "Workers' documents held (Regs Art. 6)", to: "/app/hr", ruleId: null },
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
  const emps = employees as any[];
  const trained = emps.filter((e) => Array.isArray(e?.trainings) && e.trainings.length).length;
  const exposed = emps.filter((e) => e?.profile?.occupationalExposure === true || String(e?.profile?.exposureHazard || "").trim()).length;
  const held = emps.reduce((n, e) => n + (Array.isArray(e?.profile?.heldDocuments) ? e.profile.heldDocuments.filter((d: any) => !d?.returnedAt && ["passport", "iqama", "insurance_card"].includes(d?.kind)).length : 0), 0);
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
          : row.id === "training" ? trained
          : row.id === "medical" ? exposed
          : row.id === "held_documents" ? held
          : employees.length,
      };
    }),
    crew: employees.length,
    openDiscipline: cases.filter((c) => c.status && c.status !== "ruling" && c.status !== "closed").length,
  };
}
