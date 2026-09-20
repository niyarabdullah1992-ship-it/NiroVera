/**
 * One bag per fact for CompanyDataBlob writes.
 * Legacy keys are read-once fallback; persist only the canonical category.
 * Catalog: base44/data/domains.jsonc
 */

export const DO_NOT_WRITE = [
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
] as const;

export const LEGACY_FALLBACK: Record<string, string[]> = {
  tasks: ["operationsTasks"],
  files: ["smartArchive"],
  reports: ["dailyReports"],
  anonymousReports: ["complaintQueue"],
  personalAttendance: ["attendanceLedger"],
  orgTree: ["orgStructure"],
  stationBudgets: ["expenseBudget"],
  companyMeta: ["companySettings"],
};

const CANONICAL_OF: Record<string, string> = {};
for (const [canonical, legacy] of Object.entries(LEGACY_FALLBACK)) {
  for (const key of legacy) CANONICAL_OF[key] = canonical;
}

export function isDoNotWrite(category: string) {
  return (DO_NOT_WRITE as readonly string[]).includes(category);
}

export function assertWritableCategory(category: string) {
  if (isDoNotWrite(category)) {
    throw new Error(`do-not-write: "${category}" is a retired silo — persist "${CANONICAL_OF[category] || "the canonical key"}" only`);
  }
  return category;
}

export function payloadHasRows(payload: unknown): boolean {
  if (payload == null) return false;
  if (Array.isArray(payload)) return payload.length > 0;
  if (typeof payload !== "object") return false;
  const bag = payload as Record<string, unknown>;
  for (const key of ["nodes", "reports", "punches", "treeNodes", "branches", "budgets", "items", "docs"]) {
    if (Array.isArray(bag[key]) && bag[key].length) return true;
  }
  return Object.keys(bag).length > 0;
}

function scopedRows<T>(rows: T[], companyId: string): T[] {
  const cid = String(companyId || "");
  return rows.filter((row) => {
    const rec = row as { companyId?: string };
    return rec && (!rec.companyId || !cid || String(rec.companyId) === cid);
  });
}

export function mergeLegacyOnce(canonicalPayload: unknown, legacyPayload: unknown, companyId: string) {
  if (payloadHasRows(canonicalPayload)) return { payload: canonicalPayload, migrated: false };
  if (!payloadHasRows(legacyPayload)) return { payload: canonicalPayload, migrated: false };
  if (Array.isArray(legacyPayload)) {
    return { payload: scopedRows(legacyPayload, companyId), migrated: true };
  }
  return { payload: legacyPayload, migrated: true };
}

export function asRowArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const bag = payload as Record<string, unknown>;
    if (Array.isArray(bag.nodes)) return bag.nodes;
    if (Array.isArray(bag.reports)) return bag.reports;
    if (Array.isArray(bag.punches)) return bag.punches;
    if (Array.isArray(bag.treeNodes)) return bag.treeNodes;
    if (Array.isArray(bag.budgets)) return bag.budgets;
    if (Array.isArray(bag.items)) return bag.items;
  }
  return [];
}

type BlobClient = {
  asServiceRole: {
    entities: {
      CompanyDataBlob: {
        filter: (q: { companyId: string; category: string }) => Promise<Array<{ id: string; payload?: unknown }>>;
        update: (id: string, patch: { payload: unknown }) => Promise<unknown>;
        create: (row: { companyId: string; category: string; payload: unknown }) => Promise<unknown>;
      };
    };
  };
};

export async function loadBlobRow(base44: BlobClient, companyId: string, category: string) {
  const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category });
  return rows[0] || null;
}

export async function loadCanonicalPayload(base44: BlobClient, companyId: string, canonical: string) {
  const primary = await loadBlobRow(base44, companyId, canonical);
  if (payloadHasRows(primary?.payload)) {
    return { blob: primary, payload: primary?.payload, fromLegacy: false as const, legacyKey: null as string | null };
  }
  for (const key of LEGACY_FALLBACK[canonical] || []) {
    const row = await loadBlobRow(base44, companyId, key);
    if (payloadHasRows(row?.payload)) {
      return { blob: primary, payload: row?.payload, fromLegacy: true as const, legacyKey: key };
    }
  }
  return { blob: primary, payload: primary?.payload ?? null, fromLegacy: false as const, legacyKey: null as string | null };
}

export async function saveCanonicalPayload(base44: BlobClient, companyId: string, canonical: string, payload: unknown) {
  assertWritableCategory(canonical);
  const blob = await loadBlobRow(base44, companyId, canonical);
  if (blob) {
    await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload });
    return blob;
  }
  await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId, category: canonical, payload });
  return null;
}
