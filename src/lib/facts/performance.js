/**
 * Performance / scores / points.
 * Figures come from perfDerivations — not hard-coded on boards.
 */

export const PERFORMANCE_FACTS = Object.freeze([
  {
    id: "perf.points",
    domain: "performance",
    scope: "ledger",
    home: "PointsLedger",
    path: "PointsLedger",
    writer: "perf-score",
    stored: true,
    isolation: "companyId",
    surfaceAr: "أدائي",
    noteAr: "employeeId → Employee.",
  },
  {
    id: "perf.hcm",
    domain: "performance",
    scope: "blob",
    home: "hcmPerformance",
    path: "hcmPerformance",
    blobCategory: "hcmPerformance",
    writer: "perf-score",
    stored: true,
    isolation: "companyId",
    surfaceAr: "الأداء",
    noteAr: "كائن خطط/دورات/تقييمات — مزامَن عبر BLOB_CATEGORIES كحمولة كائن.",
  },
  {
    id: "perf.foundation",
    domain: "performance",
    scope: "blob",
    home: "hcmFoundation",
    path: "hcmFoundation",
    blobCategory: "hcmFoundation",
    writer: "perf-score",
    stored: true,
    isolation: "companyId",
    surfaceAr: "أساس الأداء",
    noteAr: "وحدات/وظائف/مناصب HCM — كائن blob وليس مصفوفة.",
  },
  {
    id: "perf.targets",
    domain: "performance",
    scope: "target",
    home: "targets",
    path: "targets",
    blobCategory: "targets",
    writer: "ops-task",
    stored: true,
    isolation: "companyId",
    surfaceAr: "الأهداف",
  },
]);

export function readTargets(company) {
  return Array.isArray(company?.targets) ? company.targets : [];
}

export function readHcmPerformance(company) {
  const bag = company?.hcmPerformance;
  return bag && typeof bag === "object" && !Array.isArray(bag) ? bag : null;
}

export function readHcmFoundation(company) {
  const bag = company?.hcmFoundation;
  return bag && typeof bag === "object" && !Array.isArray(bag) ? bag : null;
}
