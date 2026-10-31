// استدامة الطبقتين ٢ و٣ على الخادم: كل دالة (base44/functions/*/entry.ts) وكل
// توأم منطق (base44/shared/*.ts) يجب أن يتجمّع بلا خطأ.
//
// السبب: jsconfig.json يفحص src فقط، و base44/** لا يُفحَص نوعيًّا إطلاقًا (67+
// ملف TS). هذه هي الثغرة التي مرّ منها إدراجُ TS مشوَّه صامتًا من قبل: npm run
// typecheck مرّ، و esbuild لا يفحص الأنواع. و tsc لا يصلح لـ Deno (fetch، npm:،
// تنميط فضفاض = 115 خطأ ضجيج)، و Deno غير مثبّت.
//
// esbuild يمسك — نظيفًا وبلا ضجيج — صنفَ الخطأ الذي يؤذي فعلاً:
//   - الصياغة المشوَّهة (الإدراج الخاطئ في منتصف ملف)،
//   - التصدير/الاستيراد المفقود (درفت: gmailSend يستورد BRAND_NAME غير مُصدَّر)،
//   - مسار استيراد مكسور.
// فيصير للخادم حارسٌ يعادل typecheck الذي للعميل، تحت npm test.

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));

// ملفات معروفة الكسر، مُستثناة بسببها. السقف ينزل ولا يصعد.
// gmailSend.ts: ميت (لا شيء يستورده) ويستورد BRAND_NAME/BRAND_NAVY… غير موجودة في
// brand.ts ولا في المشروع. تُركت كما هي (لا تُعدَّل وظيفة ميتة)؛ تُحذف أو تُصلَّح
// حين يُقرَّر مصيرها، وعندها يُزال من هنا وينزل العدّ.
const KNOWN_BROKEN = new Set(["base44/shared/gmailSend.ts"]);

function serverFiles() {
  const out = [];
  for (const name of readdirSync(join(root, "base44/shared"))) {
    if (name.endsWith(".ts") && !name.endsWith(".d.ts")) out.push(`base44/shared/${name}`);
  }
  for (const dir of readdirSync(join(root, "base44/functions"))) {
    const entry = `base44/functions/${dir}/entry.ts`;
    try {
      readdirSync(join(root, `base44/functions/${dir}`));
      out.push(entry);
    } catch { /* not a directory */ }
  }
  return out;
}

const files = serverFiles().filter((f) => {
  // أبقِ على الموجود فقط (قد يكون مجلد دالة بلا entry.ts)
  try {
    return spawnSync("test", ["-f", join(root, f)]).status === 0;
  } catch {
    return true;
  }
});

const newlyBroken = [];
const fixedSilently = [];
let checked = 0;

for (const file of files) {
  const r = spawnSync("npx", [
    "esbuild", join(root, file),
    "--bundle", "--format=esm", "--platform=neutral",
    "--external:npm:*", "--external:@base44/sdk", "--external:qrcode",
  ], { encoding: "utf8" });
  checked += 1;
  const ok = r.status === 0;
  if (!ok && !KNOWN_BROKEN.has(file)) {
    const err = (r.stderr || "").split("\n").find((l) => l.includes("ERROR")) || (r.stderr || "").trim().split("\n")[0] || "";
    newlyBroken.push(`  ✗ ${file}\n       ${err.replace(/^.*ERROR\]\s*/, "").slice(0, 140)}`);
  }
  if (ok && KNOWN_BROKEN.has(file)) fixedSilently.push(file);
}

process.stdout.write(
  `بناء الخادم — الدوال والتوائم (${checked} ملفًا · ${KNOWN_BROKEN.size} مستثنى معروف الكسر)\n\n`,
);

if (newlyBroken.length) {
  process.stdout.write(`✗ ${newlyBroken.length} ملف خادم لا يتجمّع — خطأ صياغة أو تصدير مفقود:\n${newlyBroken.join("\n")}\n`);
  process.exit(1);
}
if (fixedSilently.length) {
  process.stdout.write(`↓ صار يتجمّع: ${fixedSilently.join(", ")} — أزله من KNOWN_BROKEN ليثبت.\n`);
  process.exit(1);
}
process.stdout.write("· كل ملفات الخادم تتجمّع نظيفًا.\n");
