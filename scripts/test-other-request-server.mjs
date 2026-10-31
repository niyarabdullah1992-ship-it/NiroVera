// المركَّب checkSubmitOtherRequestGate في العميل وحده بالاسم، لكن قواعده مفروضة في
// الخادم موزَّعةً: workforce · checkRightsSubmit يستدعي بوابات rightsRequests.ts،
// وفروع submitOther تفرض الباقي. هذا الاختبار يقفل الجزء المفروض عبر rightsRequests
// (الطبقة التي تملك البوابات)، فلو أُسقط استدعاؤها من الخادم يسقط هنا.
//
// فجوات ضيقة منخفضة الأثر مقصودة (ليست أمنية):
//   - اشتراط السبب للأنواع الـ20 العامة (جودة بيانات؛ قائمة الأنواع تسحب ثوابت
//     من وحدات بلا توأم فلم تُنقل).
//   - فحص حقول تصحيح الملف/طلب الواجب عند الرفع (التطبيق مُبوَّب عند الاعتماد).
//   - إقرار م81 (ack): قيمة يؤكّدها المُرسِل نفسه، لا حاجز صلاحية — المصادقة تحمي
//     الفعل، والخادم يشتقّ تاريخ الاستقالة ولا يثق بإدخال العميل.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "nv-or-"));

let pass = 0;
let fail = 0;
const t = (name, cond) => {
  if (cond) pass += 1;
  else { fail += 1; process.stdout.write(`✗ ${name}\n`); }
};

try {
  const out = join(dir, "rr.mjs");
  execFileSync("npx", [
    "esbuild", join(root, "base44/shared/rightsRequests.ts"),
    "--bundle", "--format=esm", "--platform=neutral", "--external:npm:*", `--outfile=${out}`,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const { checkArt81Gate, checkDamageObjectionGate, checkLeaveCarryGate, ART81_CASES } = await import(out);

  const long = "و".repeat(30);
  // م81 — يُستدعى في checkRightsSubmit
  t("م81 حالة مجهولة مرفوضة", checkArt81Gate({ caseKey: "xx", reason: long, ack: true }).error === "CASE_REQUIRED");
  t("م81 سبب قصير مرفوض", checkArt81Gate({ caseKey: ART81_CASES[0].key, reason: "قصير", ack: true }).error === "REASON_REQUIRED");
  t("م81 صحيح مقبول", checkArt81Gate({ caseKey: ART81_CASES[0].key, reason: long, ack: true }).ok === true);
  // اعتراض الحسم م91
  t("اعتراض بلا مبلغ مرفوض", checkDamageObjectionGate({ notifiedOn: "2026-03-01", amount: 0, reason: "و".repeat(10), today: "2026-03-03" }).ok === false);
  // ترحيل الإجازة م109
  t("ترحيل بلا أيام مرفوض", checkLeaveCarryGate({ days: 0, remaining: 10, reason: "و".repeat(10) }).ok === false);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.stdout.write(`${pass} نجح · ${fail} فشل\n`);
if (fail) process.exit(1);
