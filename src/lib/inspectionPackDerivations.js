/** Inspection file — the statutory registers (Regs Art. 5) derived from owning modules. */

import { citeRule } from "./laborRules.js";
import { statutoryArticleLabel } from "./statutoryItem.js";
import { readDisciplinaryCases, readPayrollRuns, readSafety } from "./facts/index.js";
import { deriveHeldDocumentViolations, deriveMedicalRegister, deriveTrainingRegister } from "./employerDuties.js";

export const INSPECTION_REGISTERS = [
  { id: "workers", ar: "سجل العمال والعقود", en: "Workers and contracts", to: "/app/hr", ruleId: "contract.written.cite" },
  { id: "wages", ar: "سجل الأجور", en: "Wage register", to: "/app/payroll", ruleId: "payroll.deduction.capRatio" },
  { id: "attendance", ar: "سجل الحضور والساعات", en: "Attendance and hours", to: "/app/attendance", ruleId: "hours.week.ordinaryMaxHours" },
  { id: "leave", ar: "سجل الإجازات", en: "Leave register", to: "/app/requests/leave", ruleId: "leave.annual.days" },
  { id: "discipline", ar: "سجل الجزاءات", en: "Sanctions register", to: "/app/discipline", ruleId: "discipline.fines.register.cite" },
  { id: "safety", ar: "سجل السلامة والإصابات", en: "Safety and injuries", to: "/app/safety", ruleId: "safety.precautions.cite" },
  { id: "training", ar: "سجل تدريب السعوديين (اللائحة م5/5)", en: "Saudi training register (Regs Art. 5(5))", to: "/app/safety", ruleId: "training.policy.cite" },
  { id: "medical", ar: "سجل الفحص الطبي الدوري (اللائحة م5/6)", en: "Periodic medical-exam register (Regs Art. 5(6))", to: "/app/safety", ruleId: "safety.medicalExam.years" },
  { id: "held_documents", ar: "وثائق العمال لدى المنشأة (اللائحة م6)", en: "Workers' documents held (Regs Art. 6)", to: "/app/hr", ruleId: "contract.returnDocuments.cite" },
  { id: "inspection_file", ar: "ملف التفتيش المشتق", en: "Derived inspection pack", to: "/app/settings", ruleId: null },
];

export function deriveInspectionPack(data = {}) {
  const employees = data.employees || [];
  const cases = readDisciplinaryCases(data);
  const safety = readSafety(data);
  const payroll = readPayrollRuns(data);
  const training = deriveTrainingRegister({ employees });
  const medical = deriveMedicalRegister({ employees });
  const held = deriveHeldDocumentViolations(employees);
  return {
    generatedAt: new Date().toISOString(),
    registers: INSPECTION_REGISTERS.map((row) => {
      const cite = row.ruleId ? citeRule(row.ruleId) : null;
      return {
        ...row,
        article: cite?.article || null,
        articleLabel: cite?.article ? statutoryArticleLabel(cite.article, true) : "",
        articleLabelEn: cite?.article ? statutoryArticleLabel(cite.article, false) : "",
        count: row.id === "workers" ? employees.length
          : row.id === "discipline" ? cases.length
          : row.id === "safety" ? safety.length
          : row.id === "wages" ? (Array.isArray(payroll) ? payroll.length : 0)
          : row.id === "training" ? training.trained
          : row.id === "medical" ? medical.exposed
          : row.id === "held_documents" ? held.length
          : employees.length,
        ...(row.id === "training" ? { issues: training.undocumented.length } : {}),
        ...(row.id === "medical" ? { issues: medical.overdue } : {}),
        ...(row.id === "held_documents" ? { issues: held.length, violation: held.length > 0 } : {}),
      };
    }),
    crew: employees.length,
    trainingRegister: training,
    medicalRegister: medical,
    heldDocuments: held,
    openDiscipline: cases.filter((c) => c.status && c.status !== "ruling" && c.status !== "closed").length,
  };
}
