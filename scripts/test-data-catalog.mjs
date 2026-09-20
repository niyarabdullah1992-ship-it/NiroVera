/**
 * Data-catalog doctor — fails when the live schema drifts from
 * base44/data/domains.jsonc (the only map that is allowed to exist).
 *
 *   node scripts/test-data-catalog.mjs
 *   node scripts/test-data-catalog.mjs --fix   # rewrite SCHEMA.md + DATA.md pointer + entity headers
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = join(ROOT, "base44", "data", "domains.jsonc");
const DATA_MD_PATH = join(ROOT, "base44", "DATA.md");
const SCHEMA_MD_PATH = join(ROOT, "base44", "SCHEMA.md");
const SCHEMA_POINTER_PATH = join(ROOT, "base44", "entities", "_schema.md");
const ENTITIES_DIR = join(ROOT, "base44", "entities");
const FUNCTIONS_DIR = join(ROOT, "base44", "functions");
const STORE_PATH = join(ROOT, "src", "lib", "store.js");
const VISIBILITY_PATH = join(ROOT, "base44", "shared", "blobVisibility.ts");
const FIX = process.argv.includes("--fix");

function stripJsonc(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function readJsonc(path) {
  return JSON.parse(stripJsonc(readFileSync(path, "utf8")));
}

function rel(path) {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function extractQuotedArray(src, name) {
  const re = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  const match = src.match(re);
  if (!match) return null;
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function extractObjectKeys(src, name) {
  const re = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`);
  const match = src.match(re);
  if (!match) return null;
  return [...match[1].matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:/gm)].map((item) => item[1]);
}

function flattenCatalog(catalog) {
  const collections = [];
  for (const domain of catalog.domains || []) {
    for (const item of domain.collections || []) {
      collections.push({ ...item, domainId: domain.id, domainTitleAr: domain.titleAr, domainTitleEn: domain.titleEn });
    }
  }
  return collections;
}

function catalogKeys(collections) {
  const keys = new Set();
  for (const item of collections) {
    keys.add(item.key);
    if (item.storeKey) keys.add(item.storeKey);
    if (item.blobCategory) keys.add(item.blobCategory);
    if (item.entity) keys.add(item.entity);
    for (const alias of item.aliases || []) keys.add(alias);
  }
  return keys;
}

function statusOf(item, catalog) {
  if (item.status) return item.status;
  if (catalog.statusOf?.[item.key]) return catalog.statusOf[item.key];
  if (item.kind === "dead") return "dead";
  if (item.kind === "platform") return "platform";
  if (item.kind === "catalog") return "catalog";
  if (item.splitOf) return "legacy";
  return catalog.defaults?.status || "canonical";
}

function isolationKeyOf(item, catalog) {
  if (item.isolationKey !== undefined) return item.isolationKey;
  if (Object.prototype.hasOwnProperty.call(catalog.isolationOf || {}, item.key)) {
    return catalog.isolationOf[item.key];
  }
  if (item.kind === "platform" || item.kind === "dead" || item.kind === "catalog") return null;
  if (item.kind === "store" && !(item.identity || []).includes("companyId")) return null;
  if ((item.identity || []).includes("companyId")) return "companyId";
  return catalog.defaults?.isolationKey || "companyId";
}

function isolationPropertyName(key) {
  if (!key) return null;
  return String(key).replace(/\s*\(.*\)$/, "");
}

function schemaGroupId(catalog, item) {
  const index = catalog.schemaIndex || {};
  if (index.groupOf?.[item.key]) return index.groupOf[item.key];
  return index.domainGroup?.[item.domainId] || item.domainId;
}

function ownerKeyOf(item, catalog) {
  const isolation = isolationKeyOf(item, catalog);
  const ids = item.identity || [];
  if (item.kind === "platform") return "platform (no tenant)";
  if (item.kind === "nested") return `${item.nestedOn}[].id`;
  if (isolation === null) return "preview cache / none";
  if (ids.includes("companyId") && ids.includes("employeeId")) return "companyId + employeeId";
  if (isolation) return isolation;
  if (ids.includes("companyId")) return "companyId";
  return ids[0] || "—";
}

function relatesOf(item, copy) {
  if (copy?.relates) return copy.relates;
  const parts = [];
  if (item.personRef) parts.push(`${item.personRef} → Employee.employeeId`);
  if ((item.identity || []).includes("stationId")) parts.push("stationId → Station");
  if (item.splitOf) parts.push(`splitOf ${item.splitOf}`);
  if (item.nestedOn) parts.push(`nested on ${item.nestedOn}`);
  return parts.join("; ") || "—";
}

function neverDenormOf(item, catalog, copy) {
  if (copy?.neverDenorm) return copy.neverDenorm;
  if (copy?.neverLeak) return copy.neverLeak;
  if (item.derivation) {
    return `Figures come from ${item.derivation.replace(/^base44\/shared\//, "")} — do not store them as source columns.`;
  }
  return catalog.defaults?.neverLeak || "Do not copy tenant rows across companyId.";
}

function purposeOf(item, domain, copy) {
  if (copy?.purpose) return copy.purpose;
  if (item.notes) return item.notes;
  if (item.kind === "dead") return "Purged. Do not revive.";
  if (item.splitOf) return `Split silo of ${item.splitOf}. Prefer the canonical key.`;
  if (item.kind === "nested") return `Nested on ${item.nestedOn} — not a first-class table.`;
  if (item.kind === "entity") return `${item.entity} tenant row.`;
  if (item.kind === "blob") return `CompanyDataBlob category "${item.blobCategory || item.key}".`;
  if (item.kind === "store") return `Local cache key "${item.storeKey || item.key}".`;
  if (item.kind === "platform") return `Platform row (${item.entity || item.key}). No tenant isolation.`;
  return domain?.intent || "—";
}

function bugLooksOf(item, catalog, copy) {
  if (copy?.bugLooks) return copy.bugLooks;
  const defect = (catalog.defects || []).find((row) => row.id === item.defect);
  if (defect) return defect.summary;
  if (item.kind === "platform") return "Adding companyId here would break catalog/analytics rows.";
  if (item.kind === "nested") return `Orphan ${item.key} on a missing employee — inbox vanishes.`;
  if (item.kind === "dead") return "A write path still naming this key is a leftover door.";
  if (!(item.identity || []).includes("companyId")) return "No companyId — confirm this is platform-wide, not a tenant leak.";
  return "Missing companyId on write = cross-tenant leak.";
}

function generateMermaid(catalog) {
  const lines = ["flowchart LR"];
  const nodeIds = [];
  for (const domain of catalog.domains || []) {
    const id = domain.id.replace(/[^A-Za-z0-9_]/g, "_");
    nodeIds.push(id);
    lines.push(`  ${id}["${domain.titleEn}<br/>${domain.titleAr}"]`);
  }
  const edges = [
    ["company", "people"],
    ["people", "time"],
    ["people", "voice"],
    ["time", "work_proof"],
    ["work_proof", "trust"],
    ["time", "money"],
    ["people", "money"],
    ["company", "platform"],
  ];
  for (const [from, to] of edges) {
    if (nodeIds.includes(from) && nodeIds.includes(to)) lines.push(`  ${from} --> ${to}`);
  }
  return lines.join("\n");
}

function generateSchemaMd(catalog, collections) {
  const index = catalog.schemaIndex || {};
  const groups = index.groups || {};
  const order = index.order || Object.keys(groups);
  const copy = index.copy || {};
  const domainById = new Map((catalog.domains || []).map((domain) => [domain.id, domain]));
  const byGroup = new Map();
  for (const item of collections) {
    const groupId = schemaGroupId(catalog, item);
    if (!byGroup.has(groupId)) byGroup.set(groupId, []);
    byGroup.get(groupId).push(item);
  }

  const lines = [];
  lines.push("# NiroVera / PowerCare — programmer schema entry");
  lines.push("");
  lines.push("**Open this file first.** Machine catalog: [`data/domains.jsonc`](data/domains.jsonc). Doctor: `node scripts/test-data-catalog.mjs`.");
  lines.push("`DATA.md` and `entities/_schema.md` are pointers here — not a second map.");
  lines.push("");
  lines.push("**Proof Cycle (never break):** attendance → task → review → escalation → sign/stamp → client proof.");
  lines.push("Figures are derived. Do not move ministry numbers into stored columns. Do not rename a live key without a preview migration.");
  lines.push("Stored person key is `employeeId` (also `Employee.id` in the local cache). Loop variables named `empId` are not a second identifier.");
  lines.push("");

  lines.push("## How to add an entity");
  lines.push("");
  (catalog.howToAdd || []).forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });
  lines.push("");

  lines.push("## Isolation rule");
  lines.push("");
  const isolation = catalog.isolationRule || {};
  if (isolation.tenant) lines.push(`- **Tenant:** ${isolation.tenant}`);
  if (isolation.person) lines.push(`- **Person:** ${isolation.person}`);
  if (isolation.platform) lines.push(`- **Platform exceptions:** ${isolation.platform}`);
  if (isolation.previewRow) lines.push(`- **Preview-only rows:** ${isolation.previewRow}`);
  if (isolation.nested) lines.push(`- **Nested:** ${isolation.nested}`);
  if (isolation.neverLeak) lines.push(`- **Never leak:** ${isolation.neverLeak}`);
  lines.push("");

  lines.push("## Domain map");
  lines.push("");
  lines.push("Domains first — not forty tables in one hairball.");
  lines.push("");
  lines.push("```mermaid");
  lines.push(generateMermaid(catalog));
  lines.push("```");
  lines.push("");
  for (const domain of catalog.domains || []) {
    const keys = (domain.collections || []).map((item) => `\`${item.key}\``).join(", ");
    lines.push(`- **${domain.titleEn} — ${domain.titleAr}** — ${domain.intent} ${keys}`);
  }
  lines.push("");

  lines.push("## Problems board");
  lines.push("");
  lines.push("The messy left side, labeled. A programmer should see the red flag here without grepping the repo.");
  lines.push("Canonical = write here. `legacy` / `do-not-write` = second silo still in the tree; do not pretend a migration already landed.");
  lines.push("");
  lines.push("| id | severity | canonical | legacy / extra | evidence | what you will see |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const defect of catalog.defects || []) {
    const canonical = defect.canonical ? `\`${defect.canonical}\`` : "—";
    const legacy = (defect.legacy || []).map((key) => `\`${key}\``).join(", ") || "—";
    const evidence = (defect.evidence || []).map((row) => `\`${row}\``).join("<br>") || "—";
    lines.push(`| **${defect.id}** | ${defect.severity} | ${canonical} | ${legacy} | ${evidence} | ${defect.summary} |`);
  }
  lines.push("");

  lines.push("## Domains (one job per collection)");
  lines.push("");
  for (const groupId of order) {
    const group = groups[groupId] || { titleEn: groupId, titleAr: groupId, intent: "" };
    const rows = byGroup.get(groupId) || [];
    if (!rows.length) continue;
    lines.push(`### ${group.titleEn} — ${group.titleAr}`);
    lines.push("");
    lines.push(group.intent || "");
    lines.push("");
    lines.push("| key | status | purpose | isolation | relates | never denorm / leak | how a bug looks |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const item of rows) {
      const itemCopy = copy[item.key] || {};
      const domain = domainById.get(item.domainId);
      const status = statusOf(item, catalog);
      const isolation = isolationKeyOf(item, catalog);
      const isolationLabel = isolation == null ? "none" : isolation;
      lines.push(`| \`${item.key}\` | ${status} | ${purposeOf(item, domain, itemCopy)} | ${isolationLabel} | ${relatesOf(item, itemCopy)} | ${neverDenormOf(item, catalog, itemCopy)} | ${bugLooksOf(item, catalog, itemCopy)} |`);
    }
    lines.push("");
  }
  const leftover = [...byGroup.keys()].filter((id) => !order.includes(id));
  for (const groupId of leftover) {
    lines.push(`### ${groupId}`);
    lines.push("");
    for (const item of byGroup.get(groupId) || []) {
      lines.push(`- \`${item.key}\``);
    }
    lines.push("");
  }

  lines.push("## localStorage (preview cache, not a second database)");
  lines.push("");
  for (const row of catalog.localStorageKeys || []) {
    lines.push(`- \`${row.key}\` — ${row.role}`);
  }
  lines.push("");
  lines.push(`Catalog: ${collections.length} collections across ${catalog.domains.length} domains.`);
  lines.push("");
  return `${lines.join("\n")}`;
}

function generateSchemaPointer() {
  return [
    "# Schema index",
    "",
    "Open [`../SCHEMA.md`](../SCHEMA.md) first — how to add an entity, isolation, domain map, problems board.",
    "",
    "Machine catalog: [`../data/domains.jsonc`](../data/domains.jsonc).",
    "Doctor: `node scripts/test-data-catalog.mjs`.",
    "",
  ].join("\n");
}

function generateDataMd() {
  return [
    "# NiroVera / PowerCare — خريطة البيانات",
    "",
    "هذا الملف مؤشر فقط — ليست خريطة ثانية.",
    "",
    "افتح أولاً: [`SCHEMA.md`](SCHEMA.md).",
    "المصدر الآلي: [`data/domains.jsonc`](data/domains.jsonc).",
    "الطبيب: `node scripts/test-data-catalog.mjs`.",
    "",
  ].join("\n");
}

function headerPurpose(item, catalog, domain) {
  const copy = catalog.schemaIndex?.copy?.[item.key] || {};
  const text = purposeOf(item, domain, copy);
  return String(text).replace(/\s+/g, " ").trim().slice(0, 160);
}

function entityHeader(item, catalog, domain) {
  const isolation = isolationKeyOf(item, catalog);
  const isolationLabel = isolation == null ? "none (platform / preview / dead)" : isolation;
  return [
    `// purpose: ${headerPurpose(item, catalog, domain)}`,
    `// domain: ${item.domainId}`,
    `// isolation: ${isolationLabel}`,
    `// owner: ${item.owner || "—"}`,
    `// status: ${statusOf(item, catalog)}`,
    "",
  ].join("\n");
}

function applyEntityHeader(filePath, item, catalog, domain) {
  const raw = readFileSync(filePath, "utf8");
  const stripped = raw.replace(/^(?:\/\/[^\n]*\n)+/, "");
  const next = `${entityHeader(item, catalog, domain)}${stripped}`;
  if (next !== raw) writeFileSync(filePath, next);
}

const catalog = readJsonc(CATALOG_PATH);
const collections = flattenCatalog(catalog);
const errors = [];

assert.ok(catalog.domains?.length, "catalog must list domains");
assert.ok(collections.length, "catalog must list collections");

const keyOwners = new Map();
for (const item of collections) {
  if (keyOwners.has(item.key)) {
    errors.push(`duplicate catalog key "${item.key}" (${keyOwners.get(item.key)} and ${item.domainId})`);
  } else {
    keyOwners.set(item.key, item.domainId);
  }
}

for (const item of collections) {
  for (const pathKey of ["entityFile", "ownerFile", "derivation"]) {
    if (!item[pathKey]) continue;
    const abs = join(ROOT, item[pathKey]);
    if (!existsSync(abs)) errors.push(`${item.key}: ${pathKey} missing → ${item[pathKey]}`);
  }
  if (item.splitOf && !keyOwners.has(item.splitOf)) {
    errors.push(`${item.key}: splitOf "${item.splitOf}" is not a catalog key`);
  }
  if (item.defect && !(catalog.defects || []).some((row) => row.id === item.defect)) {
    errors.push(`${item.key}: defect "${item.defect}" is not listed in catalog.defects`);
  }
}

for (const [key, groupId] of Object.entries(catalog.schemaIndex?.groupOf || {})) {
  if (!keyOwners.has(key)) errors.push(`schemaIndex.groupOf "${key}" is not a catalog key`);
  if (!(catalog.schemaIndex?.groups || {})[groupId]) errors.push(`schemaIndex.groupOf "${key}" points at unknown group "${groupId}"`);
}
for (const [key] of Object.entries(catalog.schemaIndex?.copy || {})) {
  if (!keyOwners.has(key)) errors.push(`schemaIndex.copy "${key}" is not a catalog key`);
}
for (const key of Object.keys(catalog.isolationOf || {})) {
  if (!keyOwners.has(key)) errors.push(`isolationOf "${key}" is not a catalog key`);
}
for (const key of Object.keys(catalog.statusOf || {})) {
  if (!keyOwners.has(key)) errors.push(`statusOf "${key}" is not a catalog key`);
}

const entityFiles = readdirSync(ENTITIES_DIR).filter((name) => name.endsWith(".jsonc")).sort();
const catalogEntityFiles = new Set(collections.map((item) => item.entityFile).filter(Boolean).map((path) => path.replaceAll("\\", "/")));
for (const name of entityFiles) {
  const path = `base44/entities/${name}`;
  if (!catalogEntityFiles.has(path)) errors.push(`entity file not in catalog: ${path}`);
}
for (const item of collections) {
  if (!item.entityFile) continue;
  if (!existsSync(join(ROOT, item.entityFile))) errors.push(`catalog entity has no file: ${item.entityFile}`);
}

const known = catalogKeys(collections);
const storeSrc = readFileSync(STORE_PATH, "utf8");
const companyKeys = extractQuotedArray(storeSrc, "COMPANY_ARRAY_KEYS");
const blobKeys = extractQuotedArray(storeSrc, "BLOB_CATEGORIES");
assert.ok(companyKeys, "store.js must define COMPANY_ARRAY_KEYS");
assert.ok(blobKeys, "store.js must export BLOB_CATEGORIES");

for (const key of companyKeys) {
  if (!known.has(key)) errors.push(`store COMPANY_ARRAY_KEYS "${key}" is not in the catalog`);
}
for (const key of blobKeys) {
  if (!known.has(key)) errors.push(`store BLOB_CATEGORIES "${key}" is not in the catalog`);
}

const visibilitySrc = readFileSync(VISIBILITY_PATH, "utf8");
const visibilityKeys = extractObjectKeys(visibilitySrc, "BLOB_VISIBILITY") || [];
for (const key of blobKeys) {
  if (!visibilityKeys.includes(key)) {
    errors.push(`BLOB_CATEGORIES "${key}" has no BLOB_VISIBILITY rule (undeclared = hidden)`);
  }
}

const functionCategories = new Set();
for (const folder of readdirSync(FUNCTIONS_DIR, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  const entry = join(FUNCTIONS_DIR, folder.name, "entry.ts");
  if (!existsSync(entry)) continue;
  const src = readFileSync(entry, "utf8");
  for (const match of src.matchAll(/const\s+[A-Z][A-Z0-9_]*CATEGORY\s*=\s*"([^"]+)"/g)) {
    functionCategories.add(match[1]);
  }
}
const leaveSrc = readFileSync(join(ROOT, "base44", "shared", "leaveDerivations.ts"), "utf8");
const leaveBlob = leaveSrc.match(/export const LEAVE_ROSTER_BLOB = "([^"]+)"/);
if (leaveBlob) functionCategories.add(leaveBlob[1]);

for (const key of functionCategories) {
  if (!known.has(key)) errors.push(`function blob category "${key}" is not in the catalog`);
}

const specialSync = new Set(catalog.previewGaps?.specialSync || []);
const declaredGaps = new Set(catalog.previewGaps?.notInStoreBlobCategories || []);
for (const key of declaredGaps) {
  if (!known.has(key)) errors.push(`previewGaps.notInStoreBlobCategories "${key}" is not a catalog key`);
  if (blobKeys.includes(key)) errors.push(`previewGaps "${key}" is in BLOB_CATEGORIES — remove it from the gap list`);
}
for (const key of specialSync) {
  if (!known.has(key)) errors.push(`previewGaps.specialSync "${key}" is not a catalog key`);
}
for (const item of collections) {
  if (item.kind !== "blob") continue;
  const category = item.blobCategory || item.key;
  const inStore = blobKeys.includes(category) || specialSync.has(category);
  if (!inStore && !declaredGaps.has(category)) {
    errors.push(`${item.key}: blob "${category}" is not in BLOB_CATEGORIES and not listed in previewGaps`);
  }
}

for (const defect of catalog.defects || []) {
  for (const key of defect.keys || []) {
    if (!keyOwners.has(key)) errors.push(`defect ${defect.id}: key "${key}" is not a catalog key`);
  }
  for (const row of defect.evidence || []) {
    const file = String(row).replace(/:\d+$/, "");
    if (file.includes(" ") || file.startsWith("base44/data/")) continue;
    if (!existsSync(join(ROOT, file))) errors.push(`defect ${defect.id}: evidence file missing → ${file}`);
  }
}

const headerByEntityFile = new Map();
for (const item of collections) {
  if (!item.entityFile) continue;
  if (!headerByEntityFile.has(item.entityFile) || item.kind === "entity" || item.kind === "platform") {
    headerByEntityFile.set(item.entityFile, item);
  }
}

const domainById = new Map((catalog.domains || []).map((domain) => [domain.id, domain]));

for (const [entityFile, item] of headerByEntityFile) {
  const abs = join(ROOT, entityFile);
  if (!existsSync(abs)) continue;
  const schema = readJsonc(abs);
  const isolation = isolationKeyOf(item, catalog);
  const propName = isolationPropertyName(isolation);
  if (propName) {
    const props = schema.properties || {};
    if (!Object.prototype.hasOwnProperty.call(props, propName)) {
      errors.push(`${entityFile}: listed isolation key "${propName}" is absent from jsonc properties`);
    }
  }
  const raw = readFileSync(abs, "utf8");
  const domainLine = raw.match(/^\/\/ domain:\s*(\S+)/m);
  const ownerLine = raw.match(/^\/\/ owner:\s*(\S+)/m);
  const isolationLine = raw.match(/^\/\/ isolation:\s*(.+)$/m);
  const purposeLine = raw.match(/^\/\/ purpose:\s*(.+)$/m);
  if (FIX) {
    applyEntityHeader(abs, item, catalog, domainById.get(item.domainId));
    continue;
  }
  if (!purposeLine) errors.push(`${entityFile}: missing // purpose:`);
  if (!domainLine || domainLine[1] !== item.domainId) {
    errors.push(`${entityFile}: missing or stale // domain: ${item.domainId}`);
  }
  const expectedIsolation = isolation == null ? "none (platform / preview / dead)" : isolation;
  if (!isolationLine || isolationLine[1].trim() !== expectedIsolation) {
    errors.push(`${entityFile}: missing or stale // isolation: ${expectedIsolation}`);
  }
  if (!ownerLine || ownerLine[1] !== item.owner) {
    errors.push(`${entityFile}: missing or stale // owner: ${item.owner}`);
  }
}

function checkGeneratedDoc(path, expected, label) {
  if (FIX) {
    writeFileSync(path, expected);
    return;
  }
  if (!existsSync(path)) {
    errors.push(`${label} is missing — run with --fix`);
    return;
  }
  const actual = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  if (actual !== expected) errors.push(`${label} is out of date with domains.jsonc — run node scripts/test-data-catalog.mjs --fix`);
}

checkGeneratedDoc(DATA_MD_PATH, generateDataMd(), "base44/DATA.md");
checkGeneratedDoc(SCHEMA_MD_PATH, generateSchemaMd(catalog, collections), "base44/SCHEMA.md");
checkGeneratedDoc(SCHEMA_POINTER_PATH, generateSchemaPointer(), "base44/entities/_schema.md");

if (errors.length) {
  console.error(`data catalog doctor: ${errors.length} problem(s)`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`data catalog doctor: ${collections.length} collections, ${catalog.domains.length} domains, ${entityFiles.length} entities, ${rel(CATALOG_PATH)} ok`);
if (FIX) console.log("wrote base44/SCHEMA.md, base44/DATA.md pointer, entity headers");
