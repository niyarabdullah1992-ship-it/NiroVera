// بوابة إبلاغ قرار الجزاء على الخادم: كانت في العميل وحده، ومرحلة "delivery" تصل
// الخادم عبر compliance · disciplineSave لكن مفتاح البوابات لا يملك حالة لها فتُكتب
// بـ{ok:true}. هذا الاختبار يثبت أن التوأم على الخادم يفرضها (المادة 72 · م68).

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "nv-dd-"));
const out = join(dir, "dd.mjs");

let pass = 0;
let fail = 0;
const t = (name, cond) => {
  if (cond) pass += 1;
  else { fail += 1; process.stdout.write(`✗ ${name}\n`); }
};

try {
  execFileSync("npx", [
    "esbuild",
    join(root, "base44/shared/disciplineDerivations.ts"),
    "--bundle", "--format=esm", "--platform=neutral", "--external:npm:*",
    `--outfile=${out}`,
  ], { stdio: ["ignore", "ignore", "pipe"] });

  const { checkDisciplineDeliveryGate } = await import(out);
  const today = "2026-03-10";
  const emp = { profile: { address: "حي الملقا، الرياض", personalEmail: "worker@x.sa" } };

  t("طريقة غير معروفة مرفوضة", checkDisciplineDeliveryGate({ method: "sms", at: today, today }).ok === false);
  t("يداً بيد بتاريخ صحيح مقبول", checkDisciplineDeliveryGate({ method: "hand", at: today, signedAt: "2026-03-09", today }).ok === true);
  t("تاريخ إبلاغ بعد اليوم مرفوض", checkDisciplineDeliveryGate({ method: "hand", at: "2026-03-20", today }).ok === false);
  t("تاريخ إبلاغ يسبق التوقيع مرفوض", checkDisciplineDeliveryGate({ method: "hand", at: "2026-03-01", signedAt: "2026-03-05", today }).ok === false);
  t("بريد مسجّل بلا رقم إرسال مرفوض", checkDisciplineDeliveryGate({ method: "registered_mail", at: today, ref: "", employee: emp, today }).ok === false);
  t("بريد مسجّل بلا عنوان في الملف مرفوض", checkDisciplineDeliveryGate({ method: "registered_mail", at: today, ref: "RR123", employee: { profile: {} }, today }).ok === false);
  t("بريد مسجّل بعنوان ورقم مقبول", checkDisciplineDeliveryGate({ method: "registered_mail", at: today, ref: "RR123", employee: emp, today }).ok === true);
  t("بريد إلكتروني بلا بريد في الملف مرفوض", checkDisciplineDeliveryGate({ method: "email", at: today, employee: { profile: {} }, today }).ok === false);
  t("بريد إلكتروني بعنوان ثابت مقبول", checkDisciplineDeliveryGate({ method: "email", at: today, employee: emp, today }).ok === true);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.stdout.write(`${pass} نجح · ${fail} فشل\n`);
if (fail) process.exit(1);
