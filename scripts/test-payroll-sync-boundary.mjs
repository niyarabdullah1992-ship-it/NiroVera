// حارس مزامنة مسير الرواتب: الرواتب مال، والاعتماد وإرسال WPS حصريًّا عبر مسار
// الرواتب المبوَّب (checkApprovePayrollGate · checkSendWpsGate) بعد فحص شروطه — لا
// عبر المزامنة العامة. كانت payrollRuns — خلافًا للجزاءات — تُقبل خامًا في syncBlob،
// فأمكن دفعُ مسيرٍ مُعتمَد/مُرسَل أو تزويرُ طابعه متجاوزًا البوابتين. هذا الاختبار
// يقفل الحارس: المسوّدات حرّة، وكلّ عبور لحدّ القفل يُرفض بـPAYROLL_VIA_ACTION.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "nv-pay-"));

let pass = 0;
let fail = 0;
const t = (name, cond) => {
  if (cond) pass += 1;
  else { fail += 1; process.stdout.write(`✗ ${name}\n`); }
};

try {
  const out = join(dir, "pay.mjs");
  execFileSync("npx", [
    "esbuild", join(root, "base44/shared/payrollDerivations.ts"),
    "--bundle", "--format=esm", "--platform=neutral", "--external:npm:*", `--outfile=${out}`,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const { payrollSyncBoundary } = await import(out);

  const draft = { month: "2026-03", status: "draft", items: [{ id: "a", net: 1000 }] };
  const approved = { month: "2026-03", status: "approved", approvedAt: "2026-03-25T00:00:00Z", approvedBy: "نيار" };
  const sent = { month: "2026-03", status: "sent", approvedAt: "2026-03-25T00:00:00Z", approvedBy: "نيار", wpsSentAt: "2026-03-26T00:00:00Z", wpsSentBy: "نيار", wpsFileRef: "WPS-1" };

  // تخطّي البوابة
  t("مسودّة→معتمَد عبر المزامنة مرفوض", payrollSyncBoundary([draft], [approved]).error === "PAYROLL_VIA_ACTION");
  t("اعتماد من عدم مرفوض", payrollSyncBoundary([], [approved]).ok === false);
  t("إرسال WPS عبر المزامنة مرفوض", payrollSyncBoundary([approved], [sent]).ok === false);
  // تزوير الطابع
  t("تغيير approvedBy عبر المزامنة مرفوض", payrollSyncBoundary([approved], [{ ...approved, approvedBy: "مزوِّر" }]).ok === false);
  // حذف/تنزيل مسير مقفول
  t("حذف مسير معتمَد مرفوض", payrollSyncBoundary([approved], []).ok === false);
  t("تنزيل معتمَد→مسودّة مرفوض", payrollSyncBoundary([approved], [draft]).ok === false);
  // المسموح
  t("تحرير مسودّة مسموح", payrollSyncBoundary([draft], [{ ...draft, items: [{ id: "a", net: 1200 }] }]).ok === true);
  t("إعادة مزامنة معتمَد كما هو مسموح", payrollSyncBoundary([approved], [approved]).ok === true);
  t("مسودّة جديدة بجانب معتمَد مسموح", payrollSyncBoundary([approved], [approved, { month: "2026-04", status: "draft" }]).ok === true);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.stdout.write(`${pass} نجح · ${fail} فشل\n`);
if (fail) process.exit(1);
