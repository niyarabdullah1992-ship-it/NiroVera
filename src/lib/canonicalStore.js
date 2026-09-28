/**
 * One bag per fact. Writes may only target the canonical key.
 * Legacy keys are read-once fallback so preview/cloud rows are not lost,
 * then persist only to canonical. Do not dual-write.
 *
 * Catalog: base44/data/domains.jsonc
 */
export const DO_NOT_WRITE = Object.freeze([
  "operationsTasks",
  "smartArchive",
  "reportAnalytics",
  "dailyReports",
  "complaintQueue",
  "attendanceLedger",
  "orgStructure",
  "expenseBudget",
  "stockBoard",
  "signingChain",
  "companySettings",
]);

/** Typed Base44 entities that must never receive create/update/bulk writes. */
export const DO_NOT_WRITE_ENTITIES = Object.freeze([
  "WorkProof",
  "InventoryUnit",
]);

/** CompanyDataBlob categories that store an object map, not a row array. */
export const OBJECT_BLOB_CATEGORIES = Object.freeze([
  "branchEscalationChains",
  "branchEscalationSla",
  "hcmFoundation",
  "hcmPerformance",
]);

export const LEGACY_FALLBACK = Object.freeze({
  tasks: ["operationsTasks"],
  files: ["smartArchive"],
  reports: ["dailyReports"],
  anonymousReports: ["complaintQueue"],
  personalAttendance: ["attendanceLedger"],
  orgTree: ["orgStructure"],
  stationBudgets: ["expenseBudget"],
  companyMeta: ["companySettings"],
});

export const CANONICAL_OF = Object.freeze(
  Object.fromEntries(
    Object.entries(LEGACY_FALLBACK).flatMap(([canonical, legacy]) =>
      legacy.map((key) => [key, canonical]),
    ),
  ),
);

export function isDoNotWrite(category) {
  return DO_NOT_WRITE.includes(String(category || ""));
}

export function isDoNotWriteEntity(entity) {
  return DO_NOT_WRITE_ENTITIES.includes(String(entity || ""));
}

export function isObjectBlobCategory(category) {
  return OBJECT_BLOB_CATEGORIES.includes(String(category || ""));
}

export function assertWritableCategory(category) {
  const key = String(category || "");
  if (isDoNotWrite(key)) {
    throw new Error(`do-not-write: "${key}" is a retired silo — persist "${CANONICAL_OF[key] || "the canonical key"}" only`);
  }
  return key;
}

export function assertWritableEntity(entity) {
  const key = String(entity || "");
  if (isDoNotWriteEntity(key)) {
    const home = key === "WorkProof" ? "workProofs" : key === "InventoryUnit" ? "inventoryItems[].locationBalances" : "the canonical home";
    throw new Error(`do-not-write: entity "${key}" is retired — persist "${home}" only`);
  }
  return key;
}

/** Normalize blob payload for sync: arrays stay arrays; declared object maps stay objects. */
export function normalizeBlobPayload(category, payload) {
  if (isObjectBlobCategory(category)) {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) return payload;
    return {};
  }
  return Array.isArray(payload) ? payload : [];
}

function scopedRows(rows, companyId) {
  if (!Array.isArray(rows)) return [];
  const cid = String(companyId || "");
  return rows.filter((row) => row && (!row.companyId || !cid || String(row.companyId) === cid));
}

export function payloadHasRows(payload) {
  if (payload == null) return false;
  if (Array.isArray(payload)) return payload.length > 0;
  if (typeof payload !== "object") return false;
  const bag = payload;
  for (const key of ["nodes", "reports", "punches", "treeNodes", "branches", "budgets", "items", "docs"]) {
    if (Array.isArray(bag[key]) && bag[key].length) return true;
  }
  return Object.keys(bag).length > 0;
}

/**
 * If canonical already has rows, keep them. If it is empty and legacy has
 * company-scoped rows, return those once so the caller can persist canonical.
 */
export function mergeLegacyOnce(canonicalPayload, legacyPayload, companyId) {
  if (payloadHasRows(canonicalPayload)) {
    return { payload: canonicalPayload, migrated: false };
  }
  if (!payloadHasRows(legacyPayload)) {
    return { payload: canonicalPayload == null ? (Array.isArray(legacyPayload) ? [] : canonicalPayload) : canonicalPayload, migrated: false };
  }
  if (Array.isArray(legacyPayload)) {
    return { payload: scopedRows(legacyPayload, companyId), migrated: true };
  }
  return { payload: legacyPayload, migrated: true };
}

export function asRowArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.nodes)) return payload.nodes;
    if (Array.isArray(payload.reports)) return payload.reports;
    if (Array.isArray(payload.punches)) return payload.punches;
    if (Array.isArray(payload.treeNodes)) return payload.treeNodes;
    if (Array.isArray(payload.budgets)) return payload.budgets;
    if (Array.isArray(payload.items)) return payload.items;
  }
  return [];
}
