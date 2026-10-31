// الطبقة ٣ — منطق العمل: درفت التوائم.
//
// نفس القواعد مكتوبة مرتين: src/lib/X.js للعميل و base44/shared/X.ts للخادم.
// 47 زوجاً. ما دام المنطق نسختين سيدرفان، وكل عطل أُصلح في هذا المشروع هذا
// الأسبوع كان من هنا: بوابة PACE_KIND_REQUIRED في العميل وغائبة عن الخادم ·
// صفّ «إصابة عمل» غائب عن الخادم وحده فتُحفظ الإصابة بلا تقرير طبي ولا إقرار
// المادة 118 · PACE_DATES_MAX = 800 في العميل و366 في الخادم فيقصّ الخادم سنةً
// من التواريخ بلا خطأ · 13 مادة نظام نصّها في العميل والخادم يستشهد بها فارغةً.
//
// لا أحد كان يرى الفرق حتى يسقط. هذا الفحص يراه: يقارن سطح التصدير والثوابت
// المشتركة في كل زوج، ويمنع زيادة الدرفت. السقف ينزل ولا يصعد.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));

// سقف الدرفت اليوم. الهدف صفر: مصدر واحد يقرأه الجانبان.
//
// لا يُقاس فرق التصديرات كله: الخادم لا يحتاج كل مساعِد عرض، والعميل لا يحتاج
// داخليات الخادم، فأكثر الفرق ليس عطلاً. المقاس هو البوابات المسمّاة — check*Gate،
// وهي مواضع فرض القواعد في هذا المشروع — والثوابت المشتركة. بوابة في العميل
// وليست في الخادم تعني أن الخادم يقبل ما تمنعه الواجهة، والعكس يعني أن الواجهة
// تسمح بما يرفضه الخادم فيظهر الرفض للمستخدم بلا سبب مفهوم.
const BASELINE = {
  "بوابة في العميل وحده": 11,
  "بوابة في الخادم وحده": 0,
  "ثوابت مختلفة القيمة": 0,
};

// بوابات اسمها في العميل وحده لكن قاعدتها مفروضة في الخادم مضمَّنةً لا بالاسم:
// فحص الاسم يرصدها، والفرض الفعلي مُثبت سلوكيًّا في scripts/test-leave-gates-server.mjs.
// ليست ثقوباً، فتُطرح من العدّ — وإسقاط الفرض الخادمي يسقط ذلك الاختبار لا هذا.
const VERIFIED_INLINE = new Set([
  "leaveDerivations :: checkLeaveReligionGate",       // checkApproveLeaveGate يفرض م114/م160
  "leaveDerivations :: checkLeaveDatesGate",          // checkApproveLeaveGate يفرض ترتيب التواريخ
  "otherRequestDerivations :: checkLeaveTopupDaysGate", // checkLeaveGrantGate يفرض الأيام > 0
]);

// التعليقات والنصوص تُنزع: اسم دالة في شرح الكود ليس تصديراً.
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// البوابات المسمّاة: check*Gate — موضع فرض القاعدة في هذا المشروع، وترجع
// { ok:false, error, reason, reasonEn } حين تمنع.
function gatesOf(src) {
  const names = new Set();
  for (const m of strip(src).matchAll(/export\s+(?:async\s+)?function\s+(check[A-Za-z0-9_]*Gate)/g)) names.add(m[1]);
  return names;
}

// ثابت عددي أو نصي مُصدَّر بالاسم نفسه على الجهتين: قيمته يجب أن تتفق.
function constsOf(src) {
  const out = new Map();
  for (const m of strip(src).matchAll(/export\s+const\s+([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?=\s*(-?\d+(?:\.\d+)?|"[^"]*"|'[^']*'|true|false)\s*;/g)) {
    out.set(m[1], m[2].replace(/^['"]|['"]$/g, ""));
  }
  return out;
}

const found = { "بوابة في العميل وحده": 0, "بوابة في الخادم وحده": 0, "ثوابت مختلفة القيمة": 0 };
const detail = [];

let pairs = 0;
for (const name of readdirSync(join(root, "base44/shared")).sort()) {
  if (!name.endsWith(".ts") || name.endsWith(".d.ts")) continue;
  const clientPath = `src/lib/${name.replace(/\.ts$/, ".js")}`;
  let client;
  try {
    client = readFileSync(join(root, clientPath), "utf8");
  } catch {
    continue; // لا توأم: ملف خادم خالص
  }
  pairs += 1;
  const server = readFileSync(join(root, `base44/shared/${name}`), "utf8");

  const cg = gatesOf(client);
  const sg = gatesOf(server);
  for (const gate of cg) {
    if (!sg.has(gate)) {
      const key = `${name.replace(/\.ts$/, "")} :: ${gate}`;
      if (VERIFIED_INLINE.has(key)) continue; // القاعدة مفروضة في الخادم مضمَّنةً — ليست ثقباً
      found["بوابة في العميل وحده"] += 1;
      detail.push(`  ${key} — الخادم يقبل ما تمنعه الواجهة`);
    }
  }
  for (const gate of sg) {
    if (!cg.has(gate)) {
      found["بوابة في الخادم وحده"] += 1;
      detail.push(`  ${name.replace(/\.ts$/, "")} :: ${gate} — الواجهة تسمح بما يرفضه الخادم`);
    }
  }
  const cc = constsOf(client);
  const sc = constsOf(server);
  for (const [key, value] of cc) {
    if (sc.has(key) && sc.get(key) !== value) {
      found["ثوابت مختلفة القيمة"] += 1;
      detail.push(`  ${name}: ${key} = ${value} في العميل و ${sc.get(key)} في الخادم`);
    }
  }
}

const verbose = process.argv.includes("--list");
let over = 0;
let under = 0;
const lines = [];
for (const [rule, cap] of Object.entries(BASELINE)) {
  const now = found[rule];
  if (now > cap) over += 1;
  if (now < cap) under += 1;
  lines.push(`  ${now > cap ? "✗" : now < cap ? "↓" : "·"} ${rule.padEnd(26)} ${String(now).padStart(4)} / ${cap}`);
}

process.stdout.write(`درفت التوائم — الطبقة ٣ بنسختين (${pairs} زوجاً)\n\n${lines.join("\n")}\n\n`);
if (verbose && detail.length) process.stdout.write(`${detail.sort().join("\n")}\n\n`);

if (over) {
  process.stdout.write(`✗ درفت جديد بين العميل والخادم.\n   للتفصيل: node scripts/test-twin-drift.mjs --list\n`);
  process.exit(1);
}
if (under) {
  process.stdout.write("↓ نزل الدرفت — أنزل السقف في BASELINE ليثبت.\n");
  process.exit(1);
}
process.stdout.write("· لا درفت فوق السقف.\n");
