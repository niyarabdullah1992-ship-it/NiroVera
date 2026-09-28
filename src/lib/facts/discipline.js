/**
 * Disciplinary cases — trust lane, not voice inbox.
 */

export const DISCIPLINE_FACTS = Object.freeze([
  {
    id: "discipline.case",
    domain: "discipline",
    scope: "case",
    home: "disciplinaryCases",
    path: "disciplinaryCases",
    blobCategory: "disciplinaryCases",
    writer: "discipline-raise",
    stored: true,
    isolation: "companyId",
    surfaceAr: "الانضباط",
    noteAr: "employeeId → Employee. الخصم على المسير مشتق من الحكم — ليس راتباً مخترعاً.",
  },
  {
    id: "discipline.arbitration",
    domain: "discipline",
    scope: "verdict",
    home: "arbitrationOutcomes",
    path: "arbitrationOutcomes",
    blobCategory: "arbitrationOutcomes",
    writer: "derived-only",
    stored: true,
    isolation: "companyId",
    surfaceAr: "التحكيم",
    noteAr: "أحكام أولية قابلة للإلحاق فقط. النظام هو الفاعل.",
  },
  {
    id: "discipline.laborRules",
    domain: "discipline",
    scope: "statute",
    home: "laborRules catalog",
    path: "laborRules",
    writer: "statute",
    stored: false,
    isolation: null,
    surfaceAr: "نظام العمل",
    noteAr: "كتالوج للقراءة فقط — ليس جدولاً قابلاً للتحرير لكل شركة.",
  },
]);

export function readDisciplinaryCases(company) {
  return Array.isArray(company?.disciplinaryCases) ? company.disciplinaryCases : [];
}

export function casesForEmployee(company, employeeId) {
  const id = String(employeeId || "");
  if (!id) return [];
  return readDisciplinaryCases(company).filter((row) => String(row?.employeeId || "") === id);
}
