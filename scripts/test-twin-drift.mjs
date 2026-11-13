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
//
// لا ثقب فرضٍ خادمي متبقٍّ. السبعة الباقية بالاسم صُنِّفت كلٌّ بقراءة مساره، وليست
// ثقوب خادم:
//   كتابة لا تمرّ بالخادم (صنف «UI→Data» في test-layers، لا ثقب توأم — تُكتب عبر
//   updateCompany مباشرة فلا خادم يفرضها):
//     checkDisposeDisciplineFinesGate · checkRestPlanGate · checkAdminLeaveCreditGate
//   إرشادية لا مانعة (تعيد confirm أو تمنع على حالة عميل فقط):
//     checkSelfCheckoutGate
//   ليست في مسار النشر على الجهتين (حسابات عرض في shiftWeek.js لا تمنع نشر الجدول):
//     checkWorkPostingGate · checkThreeWeekAverageGate · checkArt105BankGate
// فُرِض في الخادم مضمَّنًا أو موزَّعاً (VERIFIED_INLINE) ومُقفل باختبار مرافق:
//   checkLeaveReligionGate · checkLeaveDatesGate · checkLeaveTopupDaysGate — test-leave-gates-server
//   checkSubmitOtherRequestGate · checkApproveOtherRequestGate (موزَّع عبر checkRightsSubmit
//     وفروع submitOther؛ فجواته ضيقة منخفضة الأثر) — test-other-request-server
// أُغلق ونُقل إلى الخادم هذا الأسبوع: بوابتا الشكوى · إبلاغ الجزاء · بوابتا اللياقة الليلية.

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
  "بوابة في العميل وحده": 7,
  "بوابة في الخادم وحده": 0,
  "ثوابت مختلفة القيمة": 0,
};

// توائم وُحِّدت إلى مصدر واحد: العميل يعيد تصدير توأم الخادم (base44/shared/X.ts)
// بدل مطابقة منطقه، فلا يمكن أن يدرفا. هذا هو علاج الدرفت الجذري لا مجرّد كبحه.
// يرتفع ولا ينزل: نقضُ توحيدٍ — إعادةُ نسخ منطق مشترك إلى العميل — يُسقط البناء.
const UNIFIED_FLOOR = 17;

// بوابات اسمها في العميل وحده لكن قاعدتها مفروضة في الخادم مضمَّنةً أو موزَّعةً لا
// بالاسم: فحص الاسم يرصدها، والفرض الفعلي مُثبت سلوكيًّا في اختبار مرافق. ليست
// ثقوباً، فتُطرح من العدّ — وإسقاط الفرض الخادمي يسقط ذلك الاختبار لا هذا.
const VERIFIED_INLINE = new Set([
  "leaveDerivations :: checkLeaveReligionGate",       // checkApproveLeaveGate يفرض م114/م160 — test-leave-gates-server
  "leaveDerivations :: checkLeaveDatesGate",          // checkApproveLeaveGate يفرض ترتيب التواريخ — test-leave-gates-server
  "otherRequestDerivations :: checkLeaveTopupDaysGate", // checkLeaveGrantGate يفرض الأيام > 0 — test-leave-gates-server
  // المركَّبان مفروضان موزَّعاً: workforce · checkRightsSubmit (الحسم · الترحيل · م81 ·
  // إرجاع الوثائق · تجنّب الليل · التظلّم) + فروع submitOther (الملفات · الرصيد ·
  // الاستقالة بالاشتقاق لا الثقة · الإضافي · البحث · اللياقة). فجواته ضيقة منخفضة
  // الأثر (سبب الأنواع العامة · حقول تصحيح الملف · ack) — موثّقة في test-other-request-server.
  "otherRequestDerivations :: checkSubmitOtherRequestGate",
  "otherRequestDerivations :: checkApproveOtherRequestGate",
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
const unified = [];

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

  // Unified (single source): the client re-exports the shared twin instead of
  // mirroring its logic, so the two cannot drift. Record it and skip the parity
  // checks — regressing it back to a copy trips the UNIFIED_FLOOR ratchet below.
  const base = name.replace(/\.ts$/, "");
  if (new RegExp(`from\\s*["'][^"']*base44/shared/${base}(?![A-Za-z0-9])`).test(strip(client))) {
    unified.push(base);
    continue;
  }

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

process.stdout.write(`درفت التوائم — الطبقة ٣ بنسختين (${pairs} زوجاً · ${unified.length} موحّد بمصدر واحد)\n\n${lines.join("\n")}\n\n`);
if (verbose && detail.length) process.stdout.write(`${detail.sort().join("\n")}\n\n`);
if (verbose && unified.length) process.stdout.write(`موحّدة (مصدر واحد، لا تدرف): ${unified.sort().join("، ")}\n\n`);

if (over) {
  process.stdout.write(`✗ درفت جديد بين العميل والخادم.\n   للتفصيل: node scripts/test-twin-drift.mjs --list\n`);
  process.exit(1);
}
if (under) {
  process.stdout.write("↓ نزل الدرفت — أنزل السقف في BASELINE ليثبت.\n");
  process.exit(1);
}
if (unified.length < UNIFIED_FLOOR) {
  process.stdout.write(`✗ نُقِض توحيد توأم: ${unified.length} موحّد < ${UNIFIED_FLOOR}. منطق مشترك عاد نسختين — أعِد التوحيد أو أنزِل UNIFIED_FLOOR بوعي.\n`);
  process.exit(1);
}
process.stdout.write(`· لا درفت فوق السقف. ${unified.length} توأم موحّد بمصدر واحد.\n`);
