/**
 * Org tree / stations / header scope.
 * Canonical graph: orgTree. orgStructure is legacy read-once.
 * UI station filter: stationScopeStore (powercare_station_scope) — not a tenant blob.
 */

export const ORG_FACTS = Object.freeze([
  {
    id: "org.station",
    domain: "org",
    scope: "station",
    home: "stations[] / Station",
    path: "stations",
    storeKey: "stations",
    writer: "org-admin",
    stored: true,
    isolation: "companyId",
    surfaceAr: "المحطات",
    noteAr: "مكان العمل + GPS للحضور. managerId → Employee.",
  },
  {
    id: "org.tree",
    domain: "org",
    scope: "company",
    home: "orgTree",
    path: "orgTree",
    blobCategory: "orgTree",
    writer: "org-admin",
    stored: true,
    isolation: "companyId",
    legacyKeys: ["orgStructure"],
    surfaceAr: "شجرة الهيكل",
    noteAr: "orgStructure صومعة قديمة — الكتابة على orgTree فقط.",
  },
  {
    id: "org.seats",
    domain: "org",
    scope: "company",
    home: "orgSeats",
    path: "orgSeats",
    blobCategory: "orgSeats",
    writer: "org-admin",
    stored: true,
    isolation: "companyId",
    surfaceAr: "المقاعد",
    noteAr: "مقعد مربوط بموظف واحد. الصلاحيات على smartPositions.",
  },
  {
    id: "org.smartPositions",
    domain: "org",
    scope: "company",
    home: "smartPositions",
    path: "smartPositions",
    blobCategory: "smartPositions",
    writer: "org-admin",
    stored: true,
    isolation: "companyId",
    surfaceAr: "الصلاحيات",
  },
  {
    id: "org.headerScope",
    domain: "org",
    scope: "session",
    home: "localStorage:powercare_station_scope",
    path: "stationScope",
    writer: "attendance-punch",
    stored: true,
    isolation: "session",
    surfaceAr: "شريط النطاق",
    noteAr: "فلتر واجهة فقط. ليس صفاً تابعاً في الـ blob.",
    accessor: "stationScopeStore",
  },
]);

export function readStations(company) {
  return Array.isArray(company?.stations) ? company.stations : [];
}

export function readOrgTree(company) {
  return Array.isArray(company?.orgTree) ? company.orgTree : [];
}

export function readOrgSeats(company) {
  return Array.isArray(company?.orgSeats) ? company.orgSeats : [];
}

/** Prefer orgTree; if empty, surface orgStructure once for migration callers. */
export function resolveOrgGraph(company) {
  const tree = readOrgTree(company);
  if (tree.length) return { nodes: tree, fromLegacy: false };
  const legacy = Array.isArray(company?.orgStructure) ? company.orgStructure : [];
  return { nodes: legacy, fromLegacy: legacy.length > 0 };
}
