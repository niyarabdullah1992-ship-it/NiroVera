// بوابتا إغلاق الشكوى على الخادم: كانتا في العميل وحده، وإجراء close في
// base44/functions/complaints/entry.ts يكتب الاعتماد في سجل التدقيق بلا فرضهما —
// فيُغلق الصوت بقرارٍ فارغ، أو يحكم عليه من رفعه بنفسه إن كان معالجًا. هذا
// الاختبار يثبت أن التوأم على الخادم يفرضهما، ويبني الملف نفسه الذي يناديه الخادم.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "nv-cd-"));
const out = join(dir, "cd.mjs");

let pass = 0;
let fail = 0;
const t = (name, cond) => {
  if (cond) pass += 1;
  else {
    fail += 1;
    process.stdout.write(`✗ ${name}\n`);
  }
};

try {
  execFileSync("npx", [
    "esbuild",
    join(root, "base44/shared/complaintDerivations.ts"),
    "--bundle", "--format=esm", "--platform=neutral", "--external:npm:*",
    `--outfile=${out}`,
  ], { stdio: ["ignore", "ignore", "pipe"] });

  const { checkSelfReviewGate, checkAdoptNoteGate } = await import(out);

  // منع مراجعة المرء صوته — صلاحية يجب أن تُفرض في الخادم لا في الواجهة وحدها.
  t("مؤلف يحكم على صوته مرفوض", checkSelfReviewGate({ authorId: "e1" }, "e1").ok === false);
  t("rateActorId يطابق مرفوض", checkSelfReviewGate({ rateActorId: "e2" }, "e2").ok === false);
  t("شخص آخر مسموح", checkSelfReviewGate({ authorId: "e1" }, "e9").ok === true);
  t("بلاغ مجهول مسموح", checkSelfReviewGate({}, "e1").ok === true);

  // اشتراط قرار الاعتماد — لا يُغلق الصوت بقرارٍ فارغ.
  t("قرار فارغ مرفوض", checkAdoptNoteGate("").ok === false);
  t("قرار أقصر من 5 مرفوض", checkAdoptNoteGate("تم").ok === false);
  t("قرار ذو معنى مسموح", checkAdoptNoteGate("يُنقل الموظف ويُعتذر له").ok === true);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.stdout.write(`${pass} نجح · ${fail} فشل\n`);
if (fail) process.exit(1);
