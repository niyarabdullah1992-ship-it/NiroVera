// بوابتا اللياقة الليلية (القرار 18632) على الخادم: كانتا في العميل وحده، و
// submitOther/approveOther في workforce يكتب الطلب ويعتمده بلا فرضهما — فيُرفع تقرير
// اللياقة من الإدارة لا من الموظف، أو بلا تقرير طبي، أو بفترة مقلوبة، أو يُعتمد بلا
// تقرير في الملف. الدالتان منقولتان حرفيًا إلى التوأم؛ هذا الاختبار يثبت تطابقهما
// مع العميل سلوكيًّا ويقفل الفرض الخادمي.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "nv-nf-"));

let pass = 0;
let fail = 0;
const t = (name, cond) => {
  if (cond) pass += 1;
  else { fail += 1; process.stdout.write(`✗ ${name}\n`); }
};

try {
  const out = join(dir, "nf.mjs");
  execFileSync("npx", [
    "esbuild", join(root, "base44/shared/otherRequestDerivations.ts"),
    "--bundle", "--format=esm", "--platform=neutral", "--external:npm:*", `--outfile=${out}`,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const { checkSubmitNightFitnessGate, checkApproveNightFitnessGate } = await import(out);

  const emp = { id: "e1" };
  const file = { name: "fit.pdf", hash: "abc", url: "u", kind: "night_fitness" };
  const base = { type: "night_fitness", employee: emp, otherRequests: [] };

  t("الموظف يرفع بتقرير وفترة صحيحة مقبول", checkSubmitNightFitnessGate({ ...base, actorId: "e1", files: [file], from: "2026-03-01", to: "2026-03-30" }).ok === true);
  t("رفع الإدارة ممنوع (الموظف وحده)", checkSubmitNightFitnessGate({ ...base, actorId: "mgr", lane: "manage", files: [file], from: "2026-03-01", to: "2026-03-30" }).error === "NIGHT_FITNESS_EMPLOYEE_ONLY");
  t("بلا تقرير طبي مرفوض", checkSubmitNightFitnessGate({ ...base, actorId: "e1", files: [], from: "2026-03-01", to: "2026-03-30" }).error === "NIGHT_FITNESS_FILE_REQUIRED");
  t("فترة مقلوبة مرفوضة", checkSubmitNightFitnessGate({ ...base, actorId: "e1", files: [file], from: "2026-03-30", to: "2026-03-01" }).error === "NIGHT_FITNESS_PERIOD_INVALID");
  t("دائم بتاريخ بداية مقبول", checkSubmitNightFitnessGate({ ...base, actorId: "e1", files: [file], permanent: true, from: "2026-03-01" }).ok === true);

  t("اعتماد مع تقرير في الملف مقبول", checkApproveNightFitnessGate({ type: "night_fitness", files: [file] }).ok === true);
  t("اعتماد بلا تقرير مرفوض", checkApproveNightFitnessGate({ type: "night_fitness", files: [] }).error === "NIGHT_FITNESS_FILE_REQUIRED");
  t("نوع آخر لا يَعنيه الاعتماد", checkApproveNightFitnessGate({ type: "permission" }).ok === true);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.stdout.write(`${pass} نجح · ${fail} فشل\n`);
if (fail) process.exit(1);
