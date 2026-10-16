/**
 * «جاهزية ملفي» — what the file still misses or is about to lose, and whose move it is.
 * Pure. Each item names an owner:
 *   self — the worker supplies it (a correction request, a signature, an acknowledgement)
 *   hr   — the employer's duty; where the Labour Law states it, the item carries a «حقك / التزامك»
 *          hint in the shared RightHint shape { view, word, right, ifNot, action, law, due }.
 * Platforms (Qiwa, GOSI, CCHI, wage protection) are not articles — they get a plain note, no chip.
 * The viewer flips the words: the worker reads «عليّ / على الموارد البشرية», a manager reads «عليه / عليك».
 */
import { daysUntilExpiry, EXPIRY_WARN_DAYS } from "./complianceDerivations.js";
import { isIqamaIdType, profileFieldValue } from "./employeeProfileFields.js";
import { readSubscriberNumber } from "./facts/index.js";
import { niceFileDate } from "./employeeFileView.js";
import { regulationVersion } from "./workRegulation.js";
import { contractHint } from "./rightHints.disc.js";
import { religionOnFile } from "./laborRules.js";

export const CORRECTION_HREF = "/app/requests?kind=other";
export const REGULATION_HREF = "/app/discipline?tab=schedule";
const MEDICAL_WARN_DAYS = 60;

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

const art = (a, ar) => ({ article: String(a), label: ar ? `المادة ${a}` : `Art. ${a}` });

function hint(manager, ar, { law, right, rightManager, ifNot, ifNotManager, action = null, due = "" }) {
  return {
    view: manager ? "manager" : "employee",
    word: ar ? (manager ? "التزامك" : "حقك") : (manager ? "Your duty" : "Your right"),
    right: manager ? rightManager : right,
    ifNot: manager ? ifNotManager : ifNot,
    action: manager ? null : action,
    law,
    due: manager ? due : "",
  };
}

function expiryState(iso, today, warn = EXPIRY_WARN_DAYS) {
  const d = dateOnly(iso);
  if (!d) return { state: "missing", days: null };
  const days = daysUntilExpiry(d, today);
  if (days == null) return { state: "missing", days: null };
  if (days < 0) return { state: "expired", days };
  if (days <= warn) return { state: "expiring", days };
  return { state: "ok", days };
}

/**
 * @param view "employee" (own file) | "manager" (someone else's file)
 * @param canEditFile the viewer fills the file (HR / account administrator). A manager who only reads
 *        sees HR's items as «على الموارد البشرية» with no «افتح في الملف»; the worker's own items always
 *        point to «طلب تعديل بيان», never to an edit form.
 * @returns {{ items, open, done, total, filled, ownerWord }}
 */
export function buildFileReadiness({ employee, regulation = null, roleLabel = "", view = "employee", canEditFile = true, ar = true, today } = {}) {
  if (!employee) return { items: [], open: [], done: [], total: 0, filled: 0 };
  const manager = view === "manager";
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const p = employee.profile || {};
  const c = p.contract || {};
  const name = String(employee.name || "").trim() || (ar ? "الموظف" : "the employee");
  const items = [];
  const add = (row) => items.push({ state: row.ok ? "ok" : "missing", hint: null, action: null, tab: "", note: "", ...row });

  // 1 — contract copy (Arts. 51–52).
  const awaitingSign = Boolean(c.generated && !c.workerAck);
  const written = Boolean(c.fileUrl || c.fileName || p.contractPdf || p.contractFileName || p.contractUrl || (c.generated && c.workerAck));
  add({
    id: "contract",
    label: ar ? "نسخة عقد العمل" : "Contract copy",
    ok: written,
    owner: awaitingSign ? "self" : "hr",
    tab: "contract",
    note: written
      ? (ar ? "مكتوبة وفي الملف" : "Written and on the file")
      : awaitingSign
        ? (ar ? (manager ? "العقد جاهز وينتظر توقيعه" : "العقد جاهز وينتظر توقيعك") : "The contract awaits the worker's signature")
        : (ar ? "لا نسخة مكتوبة في الملف" : "No written copy on the file"),
    action: awaitingSign && !manager ? { tab: "contract", label: ar ? "اقرأ العقد ووقّعه" : "Read and sign" } : null,
    hint: !written && !awaitingSign ? contractHint(employee, { view: manager ? "manager" : "employee", ar, today: day }) : null,
  });

  // 2 — Qiwa (a platform: no article chip).
  const qiwaOk = p.qiwaRegistered !== false && Boolean(String(p.qiwaTitle || p.qiwaStatus || "").trim());
  add({
    id: "qiwa",
    label: ar ? "التسجيل في منصة قوى" : "Qiwa registration",
    ok: qiwaOk,
    owner: "hr",
    tab: "compliance",
    note: qiwaOk ? (ar ? "مسجَّل" : "Registered") : (ar ? "يُوثَّق العقد في قوى من المنشأة" : "The employer documents the contract on Qiwa"),
  });

  // 3 — GOSI number (a platform).
  const gosi = readSubscriberNumber(employee);
  add({
    id: "gosi",
    label: ar ? "رقم الاشتراك في التأمينات" : "GOSI subscriber number",
    ok: Boolean(gosi),
    owner: "hr",
    tab: "compliance",
    note: gosi ? (ar ? "في الملف" : "On file") : (ar ? "يُسجَّل في التأمينات من المنشأة" : "The employer registers it with GOSI"),
  });

  // 4 — IBAN (wage protection — a platform; the worker gives the account).
  const iban = String(profileFieldValue(p, "iban", employee) || "").trim();
  add({
    id: "iban",
    label: ar ? "الحساب البنكي (الآيبان)" : "Bank account (IBAN)",
    ok: Boolean(iban),
    owner: "self",
    tab: "identity",
    note: iban ? (ar ? "في الملف" : "On file") : (ar ? "يُصرف الأجر بالتحويل عبر حماية الأجور" : "The wage is paid by transfer through wage protection"),
  });

  // 5 — ID / iqama expiry. Iqama renewal is the employer's cost (Art. 40(1)); a national ID is the worker's.
  const idType = profileFieldValue(p, "idType", employee);
  const iqama = isIqamaIdType(idType);
  const idExp = expiryState(profileFieldValue(p, "idExpiry", employee), day);
  const idLabel = iqama ? (ar ? "صلاحية الإقامة" : "Iqama validity") : (ar ? "صلاحية الهوية" : "ID validity");
  const idOwner = idExp.state === "missing" ? "self" : (iqama ? "hr" : "self");
  add({
    id: "id",
    label: idLabel,
    ok: idExp.state === "ok",
    state: idExp.state,
    owner: idOwner,
    tab: "identity",
    note: idExp.state === "missing"
      ? (ar ? "لا تاريخ انتهاء في الملف" : "No end date on the file")
      : idExp.state === "expired"
        ? (ar ? `انتهت ${niceFileDate(p.idExpiry || p.iqamaExpiry, ar)}` : `Ended ${niceFileDate(p.idExpiry || p.iqamaExpiry, ar)}`)
        : (ar ? `تنتهي ${niceFileDate(p.idExpiry || p.iqamaExpiry, ar)}` : `Ends ${niceFileDate(p.idExpiry || p.iqamaExpiry, ar)}`),
    hint: iqama && (idExp.state === "expired" || idExp.state === "expiring")
      ? hint(manager, ar, {
        law: art("40", ar),
        right: ar ? "تجديد الإقامة ورخصة العمل على صاحب العمل ورسومهما عليه، وما يترتب على التأخير." : "The employer renews and pays for the iqama and work permit, and bears any delay.",
        rightManager: ar ? `جدّد إقامة ${name} ورخصة عمله على نفقة المنشأة قبل انتهائها.` : `Renew ${name}'s iqama and work permit at the company's cost before they end.`,
        ifNot: ar ? "إن لم تُجدَّد: اطلب ذلك كتابةً من طلباتي، وغرامة التأخير لا تُحمَّل عليك." : "If not renewed: ask in writing in My requests; late fines are not yours to pay.",
        ifNotManager: ar ? "وإلا تحمّلت المنشأة غرامات التأخير ولا تُحسم من أجره." : "Otherwise the company bears the late fines; they are not cut from the wage.",
        action: { kind: "open", to: CORRECTION_HREF, label: ar ? "اطلب التجديد" : "Ask for renewal" },
        due: dateOnly(p.idExpiry || p.iqamaExpiry),
      })
      : null,
  });

  // 5b — passport, for an iqama holder whose passport is on file and ending (the worker's own document).
  if (iqama && dateOnly(p.passportExpiry)) {
    const pass = expiryState(p.passportExpiry, day);
    if (pass.state !== "ok") {
      add({
        id: "passport",
        label: ar ? "صلاحية الجواز" : "Passport validity",
        ok: false,
        state: pass.state,
        owner: "self",
        tab: "identity",
        note: ar ? `${pass.state === "expired" ? "انتهى" : "ينتهي"} ${niceFileDate(p.passportExpiry, ar)}` : `${pass.state === "expired" ? "Ended" : "Ends"} ${niceFileDate(p.passportExpiry, ar)}`,
      });
    }
  }

  // 6 — medical cover (CCHI — a platform).
  const med = expiryState(profileFieldValue(p, "medicalInsuranceExpiry", employee), day, MEDICAL_WARN_DAYS);
  add({
    id: "medical",
    label: ar ? "التأمين الطبي" : "Medical insurance",
    ok: med.state === "ok",
    state: med.state,
    owner: "hr",
    tab: "compliance",
    note: med.state === "missing"
      ? (ar ? "لا تاريخ تغطية في الملف" : "No cover date on the file")
      : (ar ? `${med.state === "expired" ? "انتهت التغطية" : "تنتهي التغطية"} ${niceFileDate(p.medicalInsuranceExpiry, ar)}` : `Cover ${med.state === "expired" ? "ended" : "ends"} ${niceFileDate(p.medicalInsuranceExpiry, ar)}`),
  });

  // 7 — emergency contact.
  const emergency = Boolean(String(p.emergencyName || "").trim() && String(p.emergencyPhone || "").trim());
  add({
    id: "emergency",
    label: ar ? "جهة الاتصال في الطوارئ" : "Emergency contact",
    ok: emergency,
    owner: "self",
    tab: "identity",
    note: emergency ? (ar ? "في الملف" : "On file") : (ar ? "الاسم والجوال" : "Name and mobile"),
  });

  // 8 — religion: Hajj (Art. 114) and the iddah length (Art. 160) wait for it.
  const religion = religionOnFile(employee);
  add({
    id: "religion",
    label: ar ? "الديانة" : "Religion",
    ok: Boolean(religion),
    owner: "self",
    tab: "identity",
    note: religion ? (ar ? "في الملف" : "On file") : (ar ? "تنتظرها إجازة الحج (المادة 114) ومدة العدة (المادة 160)" : "Hajj leave (Art. 114) and the iddah length (Art. 160) wait for it"),
  });

  // 9 — job title: the profession on the service certificate (Art. 64(1)).
  const job = String(roleLabel || p.position || employee.position || "").trim();
  add({
    id: "job",
    label: ar ? "المسمى الوظيفي" : "Job title",
    ok: Boolean(job),
    owner: "hr",
    tab: "identity",
    note: job ? job : (ar ? "لا مسمى في الملف" : "No title on the file"),
    hint: job ? null : hint(manager, ar, {
      law: art("64", ar),
      right: ar ? "مهنتك تُكتب في شهادة الخدمة مع تاريخ التحاقك وأجرك الأخير." : "Your profession is written on the service certificate with your dates and last wage.",
      rightManager: ar ? `سجّل مهنة ${name} في ملفه — شهادة الخدمة لا تصدر بدونها.` : `Record ${name}'s profession — the service certificate cannot be issued without it.`,
      ifNot: ar ? "إن بقي فارغاً: اطلب تصحيحه من طلباتي." : "If it stays empty: ask for a correction in My requests.",
      ifNotManager: ar ? "وإلا تعذّر إصدار شهادة الخدمة عند طلبها." : "Otherwise the certificate cannot be issued when asked.",
      action: { kind: "open", to: CORRECTION_HREF, label: ar ? "اطلب تعديل بيان" : "Ask for a correction" },
    }),
  });

  // 10 — work regulation acknowledgement, once the company's own regulation is announced.
  if (regulation?.source === "own" && dateOnly(regulation.announcedAt)) {
    const version = regulationVersion(regulation);
    const row = regulation.acks?.[employee.id];
    const acked = Boolean(row && (!version || String(row.version || "") === version));
    add({
      id: "regulation",
      label: ar ? "الإقرار بلائحة تنظيم العمل" : "Work regulation acknowledgement",
      ok: acked,
      owner: "self",
      note: acked ? (ar ? `أُقرّ بها ${niceFileDate(row.at, ar)}` : `Acknowledged ${niceFileDate(row.at, ar)}`) : (ar ? "أُعلنت اللائحة ولم يُسجَّل الإقرار بنسختها الحالية" : "Announced; no acknowledgement of the current version"),
      action: !acked && !manager ? { to: REGULATION_HREF, label: ar ? "اقرأ اللائحة وأقرّ" : "Read and acknowledge" } : null,
    });
  }

  // Owner words and the employee-side correction path.
  for (const item of items) {
    item.ownerLabel = manager && !canEditFile && item.owner === "hr" ? ownerWord("hr", false, ar) : ownerWord(item.owner, manager, ar);
    if (!item.ok && item.owner === "self" && !manager && !item.action) {
      item.action = { to: CORRECTION_HREF, label: ar ? "اطلب تعديل بيان" : "Ask for a correction" };
    }
    if (!item.ok && item.owner === "hr" && manager && canEditFile && item.tab) {
      item.action = { tab: item.tab, label: ar ? "افتح في الملف" : "Open on the file" };
    }
  }
  const open = items.filter((r) => !r.ok);
  const done = items.filter((r) => r.ok);
  return { items, open, done, total: items.length, filled: done.length };
}

export function ownerWord(owner, manager, ar = true) {
  if (owner === "self") return ar ? (manager ? "عليه" : "عليّ") : (manager ? "On them" : "On me");
  return ar ? (manager ? "عليك" : "على الموارد البشرية") : (manager ? "On you" : "On HR");
}
