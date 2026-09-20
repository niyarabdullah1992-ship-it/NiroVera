/**
 * Fails if a write helper still targets a do-not-write / split silo.
 * Catalog: base44/data/domains.jsonc  (doNotWrite + statusOf)
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function stripJsonc(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const catalog = JSON.parse(stripJsonc(readFileSync(join(ROOT, "base44", "data", "domains.jsonc"), "utf8")));
const { DO_NOT_WRITE, LEGACY_FALLBACK, assertWritableCategory, isDoNotWrite } = await import(
  pathToFileURL(join(ROOT, "src", "lib", "canonicalStore.js")).href
);

const catalogDoNotWrite = new Set(catalog.doNotWrite || []);
assert.ok(catalogDoNotWrite.size, "catalog.doNotWrite must list retired write keys");
assert.deepEqual([...DO_NOT_WRITE].sort(), [...catalogDoNotWrite].sort(), "canonicalStore.DO_NOT_WRITE must match catalog.doNotWrite");

for (const key of DO_NOT_WRITE) {
  assert.equal(isDoNotWrite(key), true, key);
  assert.throws(() => assertWritableCategory(key), /do-not-write/);
}
assert.equal(assertWritableCategory("tasks"), "tasks");
assert.deepEqual(LEGACY_FALLBACK.tasks, ["operationsTasks"]);

const storeSrc = readFileSync(join(ROOT, "src", "lib", "store.js"), "utf8");
assert.match(storeSrc, /assertWritableCategory/, "store.js must guard blob writes");
assert.match(storeSrc, /isDoNotWrite/, "store.js must skip do-not-write categories");

const blobMatch = storeSrc.match(/export const BLOB_CATEGORIES = \[([\s\S]*?)\];/);
assert.ok(blobMatch, "BLOB_CATEGORIES");
const blobKeys = [...blobMatch[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
for (const key of DO_NOT_WRITE) {
  assert.equal(blobKeys.includes(key), false, `BLOB_CATEGORIES must not sync do-not-write "${key}"`);
}
assert.ok(blobKeys.includes("tasks"), "canonical tasks in BLOB_CATEGORIES");
assert.ok(blobKeys.includes("arbitrationOutcomes"), "arbitrationOutcomes must be a real store blob");
assert.ok(blobKeys.includes("stationBudgets"), "stationBudgets must be a real store blob");

const functionsDir = join(ROOT, "base44", "functions");
const writeHits = [];
for (const folder of readdirSync(functionsDir, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  const entry = join(functionsDir, folder.name, "entry.ts");
  if (!existsSync(entry)) continue;
  const src = readFileSync(entry, "utf8");
  for (const key of DO_NOT_WRITE) {
    const writeAssign = new RegExp(`const\\s+[A-Z][A-Z0-9_]*CATEGORY\\s*=\\s*"${key}"`);
    if (writeAssign.test(src) && !new RegExp(`const\\s+[A-Z][A-Z0-9_]*LEGACY[A-Z0-9_]*\\s*=\\s*"${key}"`).test(src)) {
      const line = src.split("\n").find((row) => writeAssign.test(row) && !/LEGACY|do-not-write/.test(row));
      if (line && !/LEGACY/.test(line)) {
        writeHits.push(`${folder.name}: writes ${key} via CATEGORY constant`);
      }
    }
    const createRe = new RegExp(`create\\(\\{[\\s\\S]{0,180}category:\\s*"${key}"`);
    if (createRe.test(src)) writeHits.push(`${folder.name}: CompanyDataBlob.create category "${key}"`);
  }
}

assert.equal(writeHits.length, 0, `do-not-write still targeted:\n  - ${writeHits.join("\n  - ")}`);

const sharedSrc = readFileSync(join(ROOT, "base44", "shared", "canonicalBlob.ts"), "utf8");
for (const key of DO_NOT_WRITE) {
  assert.match(sharedSrc, new RegExp(`"${key}"`), `canonicalBlob.ts must list ${key}`);
}

console.log(`store-canonical: ${DO_NOT_WRITE.length} do-not-write keys blocked, ${blobKeys.length} blob categories`);
