/**
 * Offline checks for email alert copy + signing-mail contract.
 * Does not call Gmail — local preview and CI have no connector session.
 *
 * Usage: node scripts/test-email-alerts.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyCreate,
  emailValid,
  dummySigningEmployees,
} from "../src/lib/multiSignDerivations.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

// --- Task / complaint alert payload shape (store → gmailNotify) ---
function taskAlertPayload({ emp, task, station, origin = "https://nirovera.sa" }) {
  const priorityLabels = { high: "عالية · High", medium: "متوسطة · Medium", low: "منخفضة · Low" };
  const deadline = task.dueDate || task.endDate;
  const details = [
    { label: "المهمة · Task", value: task.title },
    ...(station ? [{ label: "الفرع · Station", value: station.name }] : []),
    ...(task.priority ? [{ label: "الأولوية · Priority", value: priorityLabels[task.priority] || task.priority }] : []),
    ...(deadline ? [{ label: "الموعد النهائي · Due date", value: new Date(deadline).toLocaleDateString("en-GB") }] : []),
  ];
  return {
    to: emp.email,
    subject: `مهمة جديدة مسندة إليك — ${task.title}`,
    text: `مرحبًا ${emp.name}،\n\nتم إسناد مهمة جديدة إليك في منصة PowerCare.`,
    details,
    cta: { label: "عرض المهمة · View task", url: `${origin}/app/tasks` },
  };
}

function complaintAlertPayload({ managerEmail, station }) {
  return {
    to: managerEmail,
    subject: "PowerCare — شكوى/بلاغ جديد بانتظار المراجعة",
    text: `تم استلام شكوى/بلاغ جديد${station ? ` في فرع "${station.name}"` : ""}.`,
  };
}

const emp = { id: "e1", name: "عمر", email: "omar@example.com" };
const task = { id: "t1", title: "فحص المضخة", assignedTo: "e1", stationId: "s1", priority: "high", dueDate: "2026-10-15" };
const station = { id: "s1", name: "فرع الخفجي", managerId: "m1" };

const taskMail = taskAlertPayload({ emp, task, station });
assert.equal(taskMail.to, "omar@example.com");
assert.match(taskMail.subject, /فحص المضخة/);
assert.equal(taskMail.details.length, 4);
assert.equal(taskMail.details[0].value, "فحص المضخة");
assert.equal(taskMail.cta.url, "https://nirovera.sa/app/tasks");
assert.ok(emailValid(taskMail.to));

const complaintMail = complaintAlertPayload({ managerEmail: "mgr@example.com", station });
assert.match(complaintMail.subject, /شكوى/);
assert.match(complaintMail.text, /الخفجي/);

assert.equal(emailValid("bad"), false);
assert.equal(emailValid("a@b.co"), true);

// --- Signing: create always yields per-signer links; local path marks emailFailed empty ---
const people = dummySigningEmployees().slice(0, 2);
const created = applyCreate(
  [],
  {
    companyId: "co_test",
    fileName: "عقد.pdf",
    verificationId: "PWC-EMAIL-TEST",
    fileHash: "a".repeat(64),
    docUrl: "https://example.com/doc.pdf",
    signers: people.map((row) => ({ name: row.name, email: row.email, employeeId: row.id })),
    appUrl: "https://nirovera.sa",
  },
  { id: "owner1", name: "مالك", email: "owner@example.com", role: "owner" },
);
assert.equal(created.ok, true, created.reason || created.error || "create failed");
assert.ok(created.links[people[0].email].includes("/sign?token="));
assert.ok(created.links[people[1].email].includes("/sign?token="));
assert.deepEqual(created.emailFailed, []);

// --- Cloud mailers: branded HTML + Gmail-first then Core.SendEmail fallback ---
const multiSign = read("base44/functions/multiSign/entry.ts");
assert.match(multiSign, /function signatureRequestEmail/);
assert.match(multiSign, /طلب توقيع مستند/);
assert.match(multiSign, /مراجعة المستند والتوقيع/);
assert.match(multiSign, /async function sendMail/);
assert.match(multiSign, /connectors\.getConnection\('gmail'\)/);
assert.match(multiSign, /integrations\.Core\.SendEmail/);
assert.match(multiSign, /تذكير بالتوقيع/);

const gmailNotify = read("base44/functions/gmailNotify/entry.ts");
assert.match(gmailNotify, /function emailHtml/);
assert.match(gmailNotify, /Recipient must be a company employee/);
assert.match(gmailNotify, /connectors\.getConnection\('gmail'\)/);
assert.match(gmailNotify, /isTrustedAppOrigin/);

const localFallback = read("src/lib/localMultiSignFallback.js");
assert.match(localFallback, /local: true/);
assert.match(localFallback, /action === "remind"/);

const finishDialog = read("src/components/files/SigningFinishDialog.jsx");
assert.match(finishDialog, /المعاينة المحلية لا ترسل بريدًا/);

const emailAlerts = read("src/lib/emailAlerts.js");
assert.match(emailAlerts, /gmailNotify/);

console.log("email alerts + signing mail contract ok");
console.log("NOTE: live Gmail delivery needs company session + connected Gmail; local preview does not send.");
