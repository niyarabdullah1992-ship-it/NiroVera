// يشغّل كل scripts/test-*.mjs ويطبع ما فشل. لم يكن في المشروع أمر يشغّلها،
// فبقي 157 اختبارًا لا يُشغَّل، ومرّت انحدارات كان أيٌّ منها سيمسكها.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = fileURLToPath(new URL(".", import.meta.url));
const only = process.argv[2] || "";
const files = readdirSync(dir)
  .filter((n) => /^test-.*\.mjs$/.test(n))
  .filter((n) => !only || n.includes(only))
  .sort();

const failed = [];
for (const name of files) {
  const r = spawnSync(process.execPath, [join(dir, name)], { encoding: "utf8" });
  if (r.status !== 0) {
    failed.push(name);
    process.stdout.write(`✗ ${name}\n`);
  }
}
process.stdout.write(`\n${files.length - failed.length} نجح · ${failed.length} فشل من ${files.length}\n`);
if (failed.length) {
  process.stdout.write(`\nللتفصيل: node scripts/${failed[0]}\n`);
  process.exit(1);
}
