// حدّ الطبقات الخمس: UI → API → Business → Data → Database.
//
// كل طبقة تتكلم مع التي تحتها فقط. هذا الملف يقيس كل اختراق ويمنع الزيادة:
// لكل قاعدة سقف مسجَّل في BASELINE، فإن زاد العدد فشل الاختبار، وإن نقص طُلب
// إنزال السقف. فالتنظيف يسير في اتجاه واحد ولا يتسرّب شيء جديد بعد اليوم.
//
// الاختراقات ليست رأياً: كل واحدة تتخطى طبقة أو أكثر، وكل عطل أُصلح في هذا
// المشروع هذا الأسبوع كان من تخطٍّ كهذا — بوابة في جهة وغائبة في الأخرى،
// كتابة بلا تحقّق، نداء يفشل بلا خبر لأن لا طبقة تملك الخطأ.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

// .pathname يعيد مساراً مرمَّزاً بالنسبة المئوية، فلا يُقرأ مجلد فيه حروف غير لاتينية.
const root = fileURLToPath(new URL("../", import.meta.url));

/* ------------------------------- الطبقات ------------------------------- */

// الطبقة ١ — الواجهة. مرتبطة بـReact: صفحات ومكوّنات وخطّافات.
const UI = ["src/pages", "src/components", "src/hooks"];

// الطبقة ٢ — الوسيط. المكان الوحيد الذي يعرف شكل الطلب والردّ والخطأ.
const API = ["src/api", "base44/functions"];

// الطبقة ٤ — البيانات: ما يحفظ بيانات الشركة ويقرأها. تفضيلات الواجهة
// (اللغة والمظهر) ليست من هذه الطبقة ولو استعملت localStorage.
const DATA_FILES = new Set([
  "src/lib/store.js",
  "src/lib/companySettings.js",
  "src/lib/companyBootstrap.js",
  "src/lib/platformLoginMail.js",
  "src/lib/stationScopeStore.js",
  "src/lib/disciplineOutbox.js",
  "src/lib/disciplineServer.js",
  "src/lib/moneyNotifications.js",
  "src/lib/emailAlerts.js",
  "src/lib/notificationPrefs.js",
  "src/lib/trackVisit.js",
]);

// تفضيلات الواجهة: localStorage فيها تفضيل مستخدم لا بيانات شركة.
const UI_PREFS = new Set(["src/lib/i18n.jsx", "src/lib/platformTheme.js", "src/lib/suiteApps.js"]);

// تفضيل عرضٍ لمستخدم واحد ليس بيانات شركة ولا يترك هذا المتصفح، فهو من شأن
// الطبقة ١ — وتمريره عبر طبقة البيانات خطأ: يُدخل زرّ المظهر في بيانات الشركة.
// المسموح محصىٌّ بالاسم ومعه سببه، وما خرج عنه اختراق. (الإحصاء بالملف لا
// بالمفتاح، فقاعدة الجلسة والرموز أدناه هي التي تمسك ما يُضاف لاحقاً.)
const UI_LOCAL_PREFS = new Map([
  ["src/components/Layout.jsx", "إخفاء تنبيه الوزارة و«شوهد» لهذا المستخدم"],
  ["src/components/ThemeToggle.jsx", "المظهر"],
  ["src/components/navigation/SuiteRail.jsx", "الشريط مفتوح أو مطويّ"],
  ["src/components/notifications/BranchNoticePanel.jsx", "«تمّ» لهذا المستخدم"],
  ["src/components/onboarding/EmployeeTour.jsx", "الجولة شوهدت"],
  ["src/components/schedules/ShiftWeekBoard.jsx", "تلميح الاستعادة شوهد"],
  ["src/components/shared/RecordSmartArchive.jsx", "كثافة العرض"],
  ["src/hooks/useDraggablePosition.js", "موضع النافذة"],
  ["src/hooks/useTimeFormat.js", "12 أو 24 ساعة"],
  ["src/pages/Assistant.jsx", "جنس الصوت ومحادثة محلية"],
  ["src/pages/FileSigning.jsx", "تلميح شوهد"],
  ["src/pages/Operations.jsx", "كثافة العرض"],
  ["src/pages/Pricing.jsx", "ترحيب شوهد"],
]);

/* ------------------------------- القواعد ------------------------------- */

// سقف كل قاعدة اليوم — قياس لا تخمين. ينزل ولا يصعد. الهدف صفر في كل سطر.
//
// طبقة البيانات ليست ناقصة: src/lib/facts/ قائمة بـ1766 سطراً ودوال قراءة وكتابة
// لثلاثين نطاقاً، ومعها مسارات كتابة مسمّاة بأدوارها في writers.js. العطل أنها
// متبنّاة بـ11 ملف واجهة فقط مقابل 84 تتجاوزها إلى store.js. فالتطبيق هو رفع
// التبنّي لا بناء طبقة جديدة — وCLAUDE.md يقول صراحةً: لا وحدات موازية.
const BASELINE = {
  "UI→Database (base44.entities)": 0,
  "UI→Database (localStorage)": 0,
  "UI→Database (جلسة أو رمز)": 0,
  "UI→API خام (functions.invoke)": 45,
  "UI→Data (يتجاوز facts)": 101,
  "Data→Business (قلب الاتجاه)": 19,
  "Business مكرّر (أزواج توائم)": 47,
};

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(join(root, dir));
  } catch {
    return out;
  }
  for (const name of entries) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.(jsx?|tsx?)$/.test(name)) out.push(rel);
  }
  return out;
}

// التعليقات تُنزع قبل الفحص: ملف يشرح مفتاحاً في تعليق لا يلمسه، وبلا هذا
// النزع يمسك الفحص شرح الكود نفسه ويسمّيه اختراقاً.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const uiFiles = UI.flatMap((dir) => walk(dir));
const libFiles = walk("src/lib");

const found = {};
const detail = {};
const add = (rule, file) => {
  found[rule] = (found[rule] || 0) + 1;
  (detail[rule] ||= []).push(file);
};
for (const rule of Object.keys(BASELINE)) found[rule] = 0;

/* القاعدة ١ — الواجهة لا تلمس قاعدة البيانات. تتخطى ثلاث طبقات دفعة واحدة. */
for (const file of uiFiles) {
  const src = code(readFileSync(join(root, file), "utf8"));
  if (/base44\.entities\./.test(src)) add("UI→Database (base44.entities)", file);
  if (/localStorage\./.test(src) && !UI_LOCAL_PREFS.has(file)) add("UI→Database (localStorage)", file);
  /* الجلسة والرموز لا تُلمس من الواجهة أبداً: clearSession يُبطل الجلسة في الخادم
     ويحذف رمز الشركة من الجهاز، و removeItem بيد الواجهة يفعل الثالث وحده —
     فتبقى الجلسة حيّة والرمز يُلحق تلقائياً بكل نداء محمي بعد «الخروج». */
  if (/powercare_session|powercare_tokens/.test(src)) add("UI→Database (جلسة أو رمز)", file);
  /* القاعدة ٣ — نداء الوسيط يمرّ عبر وحدة مسمّاة في src/api، لا خاماً من الواجهة:
     هناك يسكن شكل الطلب والخطأ، فلا يفشل نداء بلا خبر لأن لا أحد يملك الخطأ. */
  if (/base44\.functions\.invoke/.test(src)) add("UI→API خام (functions.invoke)", file);
  /* القاعدة ٤ — الواجهة لا تنزل إلى طبقة البيانات: تطلب من طبقة العمل. */
  for (const dataFile of DATA_FILES) {
    const mod = dataFile.replace(/^src\/lib\//, "").replace(/\.jsx?$/, "");
    if (new RegExp(`from "(@/lib|\\.\\./lib|\\./)${"/?"}${mod}(\\.jsx?)?"`).test(src)) {
      add("UI→Data (يتجاوز facts)", file);
      break;
    }
  }
}

/* القاعدة ٥ — طبقة البيانات لا تستورد طبقة العمل: الاتجاه من فوق إلى تحت. */
for (const file of DATA_FILES) {
  let src;
  try {
    src = readFileSync(join(root, file), "utf8");
  } catch {
    continue;
  }
  for (const match of src.matchAll(/from "\.\/([a-zA-Z0-9]+)\.js"/g)) {
    const target = `src/lib/${match[1]}.js`;
    if (!DATA_FILES.has(target) && !UI_PREFS.has(target) && libFiles.includes(target)) {
      add("Data→Business (قلب الاتجاه)", `${file} → ${match[1]}.js`);
    }
  }
}

/* القاعدة ٦ — منطق العمل مصدر واحد لا نسختان. كل زوج توأم موضع درفت محتمل. */
for (const name of readdirSync(join(root, "base44/shared"))) {
  if (!name.endsWith(".ts")) continue;
  const twin = `src/lib/${name.replace(/\.ts$/, ".js")}`;
  if (libFiles.includes(twin)) add("Business مكرّر (أزواج توائم)", twin);
}

/* ------------------------------- التقرير ------------------------------- */

const verbose = process.argv.includes("--list");
let over = 0;
let under = 0;
const lines = [];
for (const [rule, cap] of Object.entries(BASELINE)) {
  const now = found[rule];
  const mark = now > cap ? "✗" : now < cap ? "↓" : "·";
  if (now > cap) over += 1;
  if (now < cap) under += 1;
  lines.push(`  ${mark} ${rule.padEnd(34)} ${String(now).padStart(4)} / ${cap}`);
  if (verbose && detail[rule]?.length) {
    for (const file of detail[rule].sort()) lines.push(`        ${relative(".", file)}`);
  }
}

// نسبة التبنّي: كم ملف واجهة يمرّ عبر طبقة البيانات القائمة، وكم يتجاوزها.
const viaFacts = uiFiles.filter((f) => /from "@\/lib\/(facts|hrFacts)/.test(readFileSync(join(root, f), "utf8"))).length;
const bypass = found["UI→Data (يتجاوز facts)"];
const pct = viaFacts + bypass ? Math.round((viaFacts / (viaFacts + bypass)) * 100) : 100;

process.stdout.write(
  `حدّ الطبقات الخمس — UI → API → Business → Data → Database\n\n${lines.join("\n")}\n\n`
  + `  تبنّي طبقة البيانات (src/lib/facts): ${viaFacts} عبرها · ${bypass} تتجاوزها · ${pct}%\n\n`,
);

if (over) {
  process.stdout.write(`✗ ${over} قاعدة تجاوزت سقفها: اختراق جديد للطبقات.\n   للتفصيل: node scripts/test-layers.mjs --list\n`);
  process.exit(1);
}
if (under) {
  process.stdout.write(`↓ ${under} قاعدة نزلت تحت سقفها — أنزل السقف في BASELINE ليثبت التنظيف.\n`);
  process.exit(1);
}
process.stdout.write("· كل قاعدة على سقفها.\n");
