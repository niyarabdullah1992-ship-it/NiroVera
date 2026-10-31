// بوابات في العميل باسمها، لكن قاعدتها مفروضة في الخادم مضمَّنةً لا بالاسم —
// فحص الدرفت يرصد غياب الاسم لا غياب الفرض، فهذه ليست ثقوباً. هذا الاختبار يقفل
// الفرض الخادمي سلوكيًّا: لو أسقطه تعديلٌ لاحق بحجة «غير مستعمل»، يسقط هنا.
//
//   checkLeaveReligionGate  → checkApproveLeaveGate يرفض الحج/العدة بلا ديانة (م114/م160)
//   checkLeaveDatesGate     → checkApproveLeaveGate يرفض نهايةً تسبق البداية
//   checkLeaveTopupDaysGate → checkLeaveGrantGate يرفض أياماً ≤ 0

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "nv-lg-"));

let pass = 0;
let fail = 0;
const t = (name, cond) => {
  if (cond) pass += 1;
  else { fail += 1; process.stdout.write(`✗ ${name}\n`); }
};

const bundle = (src) => {
  const out = join(dir, `${src}.mjs`);
  execFileSync("npx", [
    "esbuild", join(root, `base44/shared/${src}.ts`),
    "--bundle", "--format=esm", "--platform=neutral", "--external:npm:*", `--outfile=${out}`,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  return out;
};

try {
  const { checkApproveLeaveGate } = await import(bundle("leaveDerivations"));
  const { checkLeaveGrantGate } = await import(bundle("otherRequestDerivations"));
  const noRel = { profile: {} };

  t("حج بلا ديانة مرفوض", checkApproveLeaveGate({ type: "hajj", startDate: "2026-05-01", endDate: "2026-05-10", days: 10 }, noRel).error === "LEAVE_RELIGION_REQUIRED");
  t("عدة بلا ديانة مرفوضة", checkApproveLeaveGate({ type: "iddah", startDate: "2026-05-01", endDate: "2026-05-10", days: 10 }, noRel).error === "LEAVE_RELIGION_REQUIRED");
  t("تواريخ مقلوبة مرفوضة", checkApproveLeaveGate({ type: "annual", startDate: "2026-05-10", endDate: "2026-05-01", days: 0 }, { profile: {} }).error === "LEAVE_DATES_ORDER");
  t("إضافة رصيد بصفر يوم مرفوضة", checkLeaveGrantGate({ pool: "grant", days: 0, onDate: "2026-03-10" }).ok === false);
  t("إضافة رصيد بأيام سالبة مرفوضة", checkLeaveGrantGate({ pool: "grant", days: -2, onDate: "2026-03-10" }).ok === false);
  t("إضافة رصيد بثلاثة أيام مقبولة", checkLeaveGrantGate({ pool: "grant", days: 3, onDate: "2026-03-10" }).ok === true);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.stdout.write(`${pass} نجح · ${fail} فشل\n`);
if (fail) process.exit(1);
