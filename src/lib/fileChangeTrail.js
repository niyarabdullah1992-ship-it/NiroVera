/**
 * «سجل التعديلات» — the updates made to the employee file itself: what changed, who did it, and when.
 * Only file actions (data edits, contract file, leave terms, seat moves, file opening). What other
 * sections record on the file — request decisions, injuries, training, discipline — stays in those
 * sections and is not listed here. Pure.
 *
 * describeFileChanges() turns a save into named fields (old → new) so the trail says what moved,
 * not only that «the file was edited». Identity and bank numbers show the field, never the value.
 */
import { presentRequestAuditText, requestAuditActorLabel } from "./otherRequestDerivations.js";

const FIELD_LABELS = {
  name: ["الاسم", "Name"],
  phone: ["الجوال", "Phone"],
  idType: ["نوع الهوية", "ID type"],
  nationalId: ["رقم الهوية", "ID number"],
  idExpiry: ["انتهاء الهوية", "ID expiry"],
  birthDate: ["تاريخ الميلاد", "Birth date"],
  position: ["المسمّى الوظيفي", "Job title"],
  hireDate: ["تاريخ التعيين", "Hire date"],
  nationality: ["الجنسية", "Nationality"],
  workPermitNumber: ["رقم رخصة العمل", "Work permit"],
  qiwaTitle: ["المهنة في قوى", "Qiwa occupation"],
  gender: ["الجنس", "Gender"],
  maritalStatus: ["الحالة الاجتماعية", "Marital status"],
  religion: ["الديانة", "Religion"],
  dependents: ["عدد المعالين", "Dependents"],
  medicalInsuranceExpiry: ["انتهاء التأمين الطبي", "Medical insurance expiry"],
  medicalInsuranceNumber: ["رقم التأمين الطبي", "Medical insurance number"],
  emergencyName: ["جهة الطوارئ", "Emergency contact"],
  emergencyPhone: ["جوال الطوارئ", "Emergency phone"],
  qualification: ["المؤهل", "Qualification"],
  iban: ["الآيبان", "IBAN"],
  bankName: ["البنك", "Bank"],
  contractType: ["نوع العقد", "Contract type"],
  wageType: ["نوع الأجر", "Wage type"],
  contractEndDate: ["نهاية العقد", "Contract end"],
  gosiNumber: ["رقم التأمينات", "GOSI number"],
  gosiRegisteredAt: ["التسجيل في التأمينات", "GOSI registration"],
  baseSalary: ["الأجر الأساسي", "Base salary"],
  housingAllowance: ["بدل السكن", "Housing allowance"],
  transportAllowance: ["بدل النقل", "Transport allowance"],
  otherAllowances: ["بدلات أخرى", "Other allowances"],
  allowances: ["البدلات", "Allowances"],
};

const HIDDEN_VALUES = new Set(["nationalId", "iban", "workPermitNumber", "medicalInsuranceNumber", "gosiNumber", "religion"]);

function plain(value) {
  if (value == null) return "";
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

function short(value) {
  const text = plain(value);
  return text.length > 40 ? `${text.slice(0, 38)}…` : text;
}

/** The fields a save changed, named, with old and new values where it is safe to show them. */
export function describeFileChanges(before = {}, draft = {}, ar = true) {
  const out = [];
  Object.keys(draft || {}).forEach((key) => {
    if (plain(draft[key]) === plain(before?.[key])) return;
    const names = FIELD_LABELS[key];
    const label = names ? (ar ? names[0] : names[1]) : key;
    const masked = HIDDEN_VALUES.has(key) || Array.isArray(draft[key]) || typeof draft[key] === "object";
    out.push({
      key,
      label,
      from: masked ? "" : short(before?.[key]),
      to: masked ? "" : short(draft[key]),
    });
  });
  return out;
}

/** One line for the trail: «تعديل بيانات الملف — الجوال، المسمّى الوظيفي». */
export function fileChangeLogText(changes = [], ar = true) {
  if (!changes.length) return ar ? "تعديل بيانات الملف" : "File fields updated";
  const names = changes.map((row) => row.label).slice(0, 6).join(ar ? "، " : ", ");
  const more = changes.length > 6 ? (ar ? ` و${changes.length - 6} غيرها` : ` and ${changes.length - 6} more`) : "";
  return ar ? `تعديل بيانات الملف — ${names}${more}` : `File fields updated — ${names}${more}`;
}

/** «2026-11-16 19:40» (UTC, from toISOString) or a full ISO → a Date-parsable ISO string. */
export function trailIso(at) {
  const raw = String(at || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) return `${raw.replace(" ", "T")}:00Z`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T12:00:00`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function kindOf(row, text, ar) {
  if (row.kind) return row.kind;
  if (/عقد|contract/i.test(text)) return ar ? "العقد" : "Contract";
  if (/أجر|راتب|بدل|salary|wage|allowance/i.test(text)) return ar ? "الأجر" : "Wage";
  if (/إجاز|راحة|leave|rest/i.test(text)) return ar ? "الإجازات" : "Leave";
  if (/منصب|نقل|مدير|seat|move|manager/i.test(text)) return ar ? "المنصب" : "Seat";
  if (/تعديل بيانات|File fields/.test(text)) return ar ? "تعديل البيانات" : "Data edit";
  return ar ? "إجراء على الملف" : "File action";
}

const FILE_UPDATE = /^(تعديل|رفع ملف العقد|تغيير ملف العقد|نقل إلى|File fields|Contract file|Contract leave|Moved to|GOSI registration date)/;

/** A line written by a file update — not by another section that also notes on the file. */
export function isFileUpdateLog(row) {
  if (!row) return false;
  if (Array.isArray(row.changes) || row.kind) return true;
  return FILE_UPDATE.test(String(row.text || "").trim());
}

/** Archive rows (RecordSmartArchive shape): newest first, with who, when and what changed. */
export function fileChangeArchiveItems(employee, ar = true) {
  const rows = (employee?.fileLog || []).filter(isFileUpdateLog);
  const seen = new Set();
  const items = [];
  rows.forEach((row, index) => {
    const text = presentRequestAuditText(row?.text || "", ar);
    if (!text) return;
    const date = trailIso(row.at);
    const key = `${text}|${row.at || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    const rawBy = String(row.by || "").trim();
    const by = requestAuditActorLabel(rawBy)
      || (/^(system|unknown)$/i.test(rawBy) || !rawBy ? (ar ? "النظام" : "Platform") : rawBy);
    const changes = Array.isArray(row.changes) ? row.changes : [];
    const detail = changes.length
      ? changes.map((c) => (c.from || c.to ? `${c.label}: ${c.from || "—"} ← ${c.to || "—"}` : c.label)).join(" · ")
      : "";
    items.push({
      id: `log-${index}-${row.at || ""}`,
      title: text,
      badge: kindOf(row, text, ar),
      date,
      person: by,
      text: detail || (ar ? `بواسطة ${by}` : `By ${by}`),
      search: [text, by, detail].join(" "),
      changes,
      by,
    });
  });
  const hire = employee?.profile?.hireDate || employee?.hireDate || "";
  if (hire) {
    items.push({
      id: "log-opened",
      title: ar ? "إنشاء الملف" : "File opened",
      badge: ar ? "إنشاء" : "Opened",
      date: trailIso(String(hire).slice(0, 10)),
      person: ar ? "الموارد البشرية" : "HR",
      text: ar ? "فُتح ملف الموظف عند التعيين" : "The file was opened at hiring",
      search: "إنشاء الملف",
      changes: [],
      by: ar ? "الموارد البشرية" : "HR",
    });
  }
  return items.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}
