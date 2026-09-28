/**
 * Safety / HSE logs.
 */

export const SAFETY_FACTS = Object.freeze([
  {
    id: "safety.log",
    domain: "safety",
    scope: "safetyRow",
    home: "safety",
    path: "safety",
    blobCategory: "safety",
    writer: "safety-log",
    stored: true,
    isolation: "companyId",
    surfaceAr: "السلامة",
    noteAr: "stationId → Station. الأرقام من hseDerivations.",
  },
  {
    id: "safety.hseCredits",
    domain: "safety",
    scope: "credit",
    home: "hseCredits",
    path: "hseCredits",
    blobCategory: "hseCredits",
    writer: "safety-log",
    stored: true,
    isolation: "companyId",
    surfaceAr: "رصيد السلامة",
  },
]);

export function readSafety(company) {
  return Array.isArray(company?.safety) ? company.safety : [];
}
