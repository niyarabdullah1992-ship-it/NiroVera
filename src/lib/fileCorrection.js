/**
 * «طلب تعديل الملف الوظيفي» — the one way an employee asks to change a personal fact on his own file.
 * Pure (no "@/" imports) so scripts can test it.
 *
 * Owner rule: the employee file is written by whoever manages HR (manage_employees, in scope) or the
 * account administrator only. The employee raises this request in طلباتي; HR approves it, and only then
 * is the new value written onto the file (patchEmployeeFile with HR as the actor), logged with HR's name.
 *
 * Only personal facts are requestable. Wage, contract, job title, grade, branch and hire date follow
 * their own HR / contract processes and are never changed through this request.
 */
import { MARITAL_OPTIONS, RELIGION_OPTIONS, optionLabel, profileFieldValue } from "./employeeProfileFields.js";
import { employeeFileEditGate } from "./employeeFileRights.js";

export const FILE_CORRECTION_TYPE = "file_correction";
export const FILE_CORRECTION_LABEL_AR = "طلب تعديل الملف الوظيفي";
export const FILE_CORRECTION_LABEL_EN = "Employment-file change request";
export const FILE_CORRECTION_HREF = "/app/requests?kind=file_correction";
export const FILE_CORRECTION_NOT_HERE_AR = "الأجر والعقد والمسمى والدرجة والفرع وتاريخ التعيين تُعدَّل بإجراءاتها لدى الموارد البشرية — لا من هذا الطلب.";
export const FILE_CORRECTION_NOT_HERE_EN = "Wage, contract, title, grade, branch and hire date follow their own HR processes — not this request.";

/**
 * target: "phone" (employee.phone) or "profile" (employee.profile[key]).
 * input: text | phone | date | iban | nationalId | select.
 * proof: a supporting document is required (official papers / bank letter / certificate).
 */
export const FILE_CORRECTION_FIELDS = [
  { key: "phone", target: "phone", input: "phone", ar: "رقم الجوال", en: "Mobile number" },
  { key: "nationalId", target: "profile", input: "nationalId", proof: true, ar: "رقم الهوية / الإقامة", en: "National ID / Iqama number" },
  { key: "idExpiry", target: "profile", input: "date", proof: true, ar: "انتهاء الهوية / الإقامة", en: "ID / Iqama expiry" },
  { key: "passportNumber", target: "profile", input: "text", proof: true, ar: "رقم الجواز", en: "Passport number" },
  { key: "passportExpiry", target: "profile", input: "date", proof: true, ar: "انتهاء الجواز", en: "Passport expiry" },
  { key: "iban", target: "profile", input: "iban", proof: true, ar: "الحساب البنكي (الآيبان)", en: "Bank account (IBAN)" },
  { key: "emergencyName", target: "profile", input: "text", ar: "جهة اتصال الطوارئ", en: "Emergency contact" },
  { key: "emergencyPhone", target: "profile", input: "phone", ar: "هاتف الطوارئ", en: "Emergency phone" },
  { key: "address", target: "profile", input: "text", ar: "العنوان والمدينة", en: "Address and city" },
  { key: "maritalStatus", target: "profile", input: "select", options: MARITAL_OPTIONS, ar: "الحالة الاجتماعية", en: "Marital status" },
  { key: "religion", target: "profile", input: "select", options: RELIGION_OPTIONS, ar: "الدين", en: "Religion" },
  { key: "qualification", target: "profile", input: "text", proof: true, ar: "المؤهل العلمي", en: "Qualification" },
];

export function fileCorrectionField(key) {
  return FILE_CORRECTION_FIELDS.find((row) => row.key === key) || null;
}

/** The value on the file now, as the employee reads it (option labels, not codes). */
export function fileCorrectionCurrent(employee, key, ar = true) {
  const meta = fileCorrectionField(key);
  if (!meta || !employee) return "";
  const raw = meta.target === "phone"
    ? String(employee.phone || employee.profile?.phone || "").trim()
    : String(profileFieldValue(employee.profile || {}, key, employee) || "").trim();
  if (meta.input === "select") return raw ? optionLabel(meta.options, raw, ar) : "";
  return raw;
}

/** Normalised new value, or "" when it does not fit the field. */
export function normalizeCorrectionValue(key, value) {
  const meta = fileCorrectionField(key);
  const s = String(value ?? "").trim();
  if (!meta || !s) return "";
  if (meta.input === "phone") {
    const digits = s.replace(/[\s-]/g, "").replace(/^\+?966/, "0").replace(/^00966/, "0");
    if (/^05\d{8}$/.test(digits)) return digits;
    if (/^0\d{8,9}$/.test(digits)) return digits;
    return "";
  }
  if (meta.input === "iban") {
    const v = s.replace(/\s+/g, "").toUpperCase();
    return /^SA\d{22}$/.test(v) ? v : "";
  }
  if (meta.input === "nationalId") {
    const v = s.replace(/\s+/g, "");
    return /^[12]\d{9}$/.test(v) ? v : "";
  }
  if (meta.input === "date") return /^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10)) ? s.slice(0, 10) : "";
  if (meta.input === "select") return meta.options.some((o) => o.value === s) ? s : "";
  return s.length >= 2 ? s.slice(0, 200) : "";
}

const FORMAT_REASON = {
  phone: ["اكتب رقماً سعودياً صحيحاً — مثل 05XXXXXXXX.", "Write a valid Saudi number — e.g. 05XXXXXXXX."],
  iban: ["الآيبان السعودي: SA ثم 22 رقماً.", "A Saudi IBAN: SA followed by 22 digits."],
  nationalId: ["رقم الهوية أو الإقامة 10 أرقام يبدأ بـ1 أو 2.", "The ID or iqama number is 10 digits starting with 1 or 2."],
  date: ["حدّد التاريخ الجديد.", "Set the new date."],
  select: ["اختر القيمة الجديدة.", "Choose the new value."],
  text: ["اكتب القيمة الجديدة.", "Write the new value."],
};

/** Submit gate — names the first missing part. */
export function checkSubmitFileCorrectionGate({ field, value, reason, files, employee } = {}) {
  const meta = fileCorrectionField(field);
  if (!meta) return { ok: false, error: "FIELD_REQUIRED", reason: "اختر البيان الذي تريد تعديله.", reasonEn: "Choose the fact to change." };
  const next = normalizeCorrectionValue(field, value);
  if (!next) {
    const [ar, en] = FORMAT_REASON[meta.input] || FORMAT_REASON.text;
    return { ok: false, error: "VALUE_INVALID", reason: ar, reasonEn: en };
  }
  if (employee) {
    const current = meta.target === "phone"
      ? String(employee.phone || employee.profile?.phone || "").trim()
      : String(profileFieldValue(employee.profile || {}, field, employee) || "").trim();
    if (current && current.replace(/\s+/g, "").toUpperCase() === next.replace(/\s+/g, "").toUpperCase()) {
      return { ok: false, error: "VALUE_UNCHANGED", reason: "القيمة الجديدة هي نفسها في ملفك.", reasonEn: "The new value is already on your file." };
    }
  }
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (meta.proof && !list.length) {
    return {
      ok: false,
      error: "PROOF_REQUIRED",
      reason: meta.input === "iban"
        ? "أرفق خطاب البنك أو صورة تُظهر الآيبان باسمك — يُصرف عليه الأجر عبر حماية الأجور."
        : meta.key === "qualification"
          ? "أرفق صورة المؤهل — يُعتمد من الوثيقة لا من الكتابة."
          : "أرفق صورة الوثيقة الرسمية — يُعتمد البيان منها لا من الكتابة.",
      reasonEn: meta.input === "iban"
        ? "Attach the bank letter or a page showing the IBAN in your name — wages are paid to it under WPS."
        : "Attach a copy of the official document — the fact is taken from it, not from the text.",
    };
  }
  if (String(reason || "").trim().length < 3) {
    return { ok: false, error: "REASON_REQUIRED", reason: "اكتب سبب التعديل باختصار.", reasonEn: "Write briefly why it changes." };
  }
  return { ok: true, value: next, field: meta.key };
}

/** Only HR (manage_employees, in scope) or the account administrator decides — never the employee or his manager. */
export function checkDecideFileCorrectionGate(actor, employee, data) {
  return employeeFileEditGate(actor, employee, data);
}

/** The patch the approval writes through patchEmployeeFile (with the approver as actor). */
export function fileCorrectionPatch(request) {
  const meta = fileCorrectionField(request?.field);
  const value = normalizeCorrectionValue(request?.field, request?.newValue);
  if (!meta || !value) return null;
  if (meta.target === "phone") return { phone: value };
  return { profile: { [meta.key]: value } };
}

/** «رقم الجوال: 0501234567» — the line on the request card, the file log and the notice. */
export function fileCorrectionSummary(request, ar = true) {
  const meta = fileCorrectionField(request?.field);
  if (!meta) return "";
  const value = meta.input === "select"
    ? optionLabel(meta.options, request?.newValue, ar)
    : String(request?.newValue || "");
  return `${ar ? meta.ar : meta.en}: ${value}`;
}
