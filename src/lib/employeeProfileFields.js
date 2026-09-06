/**
 * Employee-file fields follow MHRSD / Saudi Labour Law order.
 * Placement (branch / manager) lives in the org tree — never here.
 * Professional-info fields are management / HR only.
 */

export function canEmployeeEditProfileKey() {
  return false;
}

export function canEditProfileKey(_key, { canManage }) {
  return Boolean(canManage);
}

export const ID_TYPE_OPTIONS = [
  { value: "national_id", ar: "هوية وطنية", en: "National ID", aliases: ["هوية وطنية", "national id", "national_id"] },
  { value: "iqama", ar: "إقامة", en: "Iqama", aliases: ["إقامة", "iqama"] },
];

export const CONTRACT_TYPE_OPTIONS = [
  { value: "indefinite", ar: "غير محدد المدة", en: "Indefinite", aliases: ["غير محدد المدة", "indefinite", "open", "open-ended", "unlimited"] },
  { value: "fixed", ar: "محدد المدة", en: "Fixed term", aliases: ["محدد المدة", "fixed", "fixed term", "definite"] },
];

export const WORK_PATTERN_OPTIONS = [
  { value: "ordinary", ar: "دائم / عادي", en: "Permanent / ordinary", aliases: ["ordinary", "permanent", "دائم"] },
  { value: "part_time", ar: "جزئي", en: "Part-time", aliases: ["part_time", "part-time", "جزئي"] },
  { value: "temporary", ar: "مؤقت / عرضي", en: "Temporary / casual", aliases: ["temporary", "casual", "مؤقت"] },
  { value: "seasonal", ar: "موسمي", en: "Seasonal", aliases: ["seasonal", "موسمي"] },
  { value: "flexible", ar: "مرن", en: "Flexible", aliases: ["flexible", "مرن"] },
  { value: "remote", ar: "عن بُعد", en: "Remote", aliases: ["remote", "عن بعد", "عن بُعد"] },
];

export const GENDER_OPTIONS = [
  { value: "male", ar: "ذكر", en: "Male", aliases: ["ذكر", "male"] },
  { value: "female", ar: "أنثى", en: "Female", aliases: ["أنثى", "female"] },
];

export const MARITAL_OPTIONS = [
  { value: "single", ar: "أعزب / عزباء", en: "Single", aliases: ["أعزب", "عزباء", "غير متزوجة", "single"] },
  { value: "married", ar: "متزوج / متزوجة", en: "Married", aliases: ["متزوج", "متزوجة", "married"] },
  { value: "divorced", ar: "مطلق / مطلقة", en: "Divorced", aliases: ["مطلق", "مطلقة", "divorced"] },
  { value: "widowed", ar: "أرمل / أرملة", en: "Widowed", aliases: ["أرمل", "أرملة", "widowed"] },
];

const OPTION_SETS = {
  idType: ID_TYPE_OPTIONS,
  contractType: CONTRACT_TYPE_OPTIONS,
  workPattern: WORK_PATTERN_OPTIONS,
  gender: GENDER_OPTIONS,
  marital: MARITAL_OPTIONS,
};

function normalizeOption(value, options) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "";
  const hit = options.find((o) => o.value === s || o.aliases.some((a) => a.toLowerCase() === s));
  return hit ? hit.value : value;
}

export function optionLabel(options, value, ar) {
  const n = normalizeOption(value, options);
  const hit = options.find((o) => o.value === n);
  if (hit) return ar ? hit.ar : hit.en;
  return value || "";
}

export function isIqamaIdType(idType) {
  return normalizeOption(idType, ID_TYPE_OPTIONS) === "iqama";
}

export function isNationalIdType(idType) {
  return normalizeOption(idType, ID_TYPE_OPTIONS) === "national_id";
}

export function isFixedContractType(contractType) {
  return normalizeOption(contractType, CONTRACT_TYPE_OPTIONS) === "fixed";
}

export function idNumberFieldLabel(idType, ar) {
  if (isIqamaIdType(idType)) return ar ? "رقم الإقامة" : "Iqama number";
  if (isNationalIdType(idType)) return ar ? "رقم الهوية الوطنية" : "National ID number";
  return ar ? "رقم الهوية / الإقامة" : "National ID / Iqama number";
}

/**
 * Statutory employee-file groups — MHRSD inspection order:
 * identity → GOSI/CCHI → Qiwa employment → contact → WPS IBAN.
 * Contract PDF, wage amounts, leave, and certificates live in later tabs.
 */
export const PROFILE_GROUPS = [
  {
    id: "identity",
    ar: "الهوية والجنسية",
    en: "Identity and nationality",
    noteAr: "الجنسية هي المعيار، ورقم الهوية يؤكدها: ١ مواطن، ٢ إقامة. إن اختلفا يُوقف العدّ في نطاقات.",
    noteEn: "Nationality is the criterion; the ID number must agree (1 = citizen, 2 = iqama). A mismatch is not counted in Nitaqat.",
    fields: [
      { key: "nationality", ar: "الجنسية", en: "Nationality" },
      { key: "idType", ar: "نوع الهوية", en: "ID type", options: "idType" },
      { key: "nationalId", ar: "رقم الهوية / الإقامة", en: "National ID / Iqama number", dir: "ltr", labelKey: "idNumber" },
      { key: "idExpiry", ar: "انتهاء الهوية / الإقامة", en: "ID / Iqama expiry", type: "date", expiry: true },
      { key: "birthDate", ar: "تاريخ الميلاد", en: "Birth date", type: "date" },
      { key: "gender", ar: "الجنس", en: "Gender", options: "gender" },
      { key: "maritalStatus", ar: "الحالة الاجتماعية", en: "Marital status", options: "marital" },
      { key: "passportNumber", ar: "رقم الجواز", en: "Passport number", dir: "ltr", forIqama: true },
      { key: "passportExpiry", ar: "انتهاء الجواز", en: "Passport expiry", type: "date", expiry: true, forIqama: true },
    ],
  },
  {
    id: "socialInsurance",
    ar: "التأمينات والضمان الصحي",
    en: "GOSI and medical cover",
    noteAr: "التسجيل في التأمينات إلزامي، والتأمين الطبي وفق مجلس الضمان الصحي.",
    noteEn: "GOSI registration is mandatory; medical insurance follows CCHI rules.",
    ruleId: "compliance.gosi.employeeRate",
    fields: [
      { key: "gosiNumber", ar: "رقم التأمينات الاجتماعية (GOSI)", en: "GOSI number", dir: "ltr", ruleId: "compliance.gosi.employeeRate" },
      { key: "medicalInsuranceNumber", ar: "رقم التأمين الطبي", en: "Medical insurance number", dir: "ltr" },
      { key: "medicalInsuranceExpiry", ar: "انتهاء التأمين الطبي", en: "Medical insurance expiry", type: "date", expiry: true },
      { key: "medicalExam", ar: "الفحص الطبي", en: "Medical exam", optional: true },
    ],
  },
  {
    id: "employment",
    ar: "التوظيف ومنصة قوى",
    en: "Employment and Qiwa",
    noteAr: "المسمى في قوى يطابق المسمى الوظيفي. رخصة العمل لغير السعوديين.",
    noteEn: "The Qiwa job title must match the position. Work permits apply to non-Saudis.",
    showStation: true,
    fields: [
      { key: "position", ar: "المسمى الوظيفي", en: "Position" },
      { key: "qiwaTitle", ar: "المسمى في منصة قوى", en: "Qiwa job title" },
      { key: "department", ar: "الإدارة", en: "Department" },
      { key: "hireDate", ar: "تاريخ التعيين", en: "Hire date", type: "date" },
      { key: "contractType", ar: "نوع العقد", en: "Contract type", options: "contractType", optionRuleIds: { indefinite: "contract.indefinite.cite", unlimited: "contract.indefinite.cite", fixed: "contract.fixed.cite" } },
      { key: "workPattern", ar: "نموذج العقد", en: "Contract template", options: "workPattern", optionRuleIds: { flexible: "contract.pattern.flexible.cite", remote: "contract.pattern.remote.cite", temporary: "contract.fixed.cite", seasonal: "contract.fixed.cite" } },
      { key: "contractRenewalCount", ar: "عدد تجديدات العقد", en: "Contract renewal count", type: "number", ruleId: "contract.fixed.continuation.cite", optional: true },
      { key: "workPermitNumber", ar: "رقم رخصة العمل", en: "Work permit number", dir: "ltr", forIqama: true },
      { key: "workPermitExpiry", ar: "انتهاء رخصة العمل", en: "Work permit expiry", type: "date", expiry: true, forIqama: true },
    ],
  },
  {
    id: "contact",
    ar: "المؤهل وبيانات الاتصال",
    en: "Qualification and contact",
    fields: [
      { key: "qualification", ar: "المؤهل العلمي", en: "Qualification" },
      { key: "emergencyName", ar: "جهة اتصال الطوارئ", en: "Emergency contact" },
      { key: "emergencyPhone", ar: "هاتف الطوارئ", en: "Emergency phone", dir: "ltr" },
      { key: "address", ar: "العنوان", en: "Address", optional: true },
      { key: "notes", ar: "ملاحظات", en: "Notes", area: true, optional: true },
    ],
  },
  {
    id: "wps",
    ar: "حماية الأجور — الحساب البنكي",
    en: "Wage protection — bank account",
    noteAr: "الآيبان السعودي (SA + 22 رقمًا) مطلوب لملف حماية الأجور عبر مدد خلال 30 يوماً من الاستحقاق.",
    noteEn: "A Saudi IBAN (SA + 22 digits) is required for the Mudad wage-protection file within 30 days of entitlement.",
    ruleId: "payroll.wps.deadlineDayOfMonth",
    fields: [
      { key: "iban", ar: "الحساب البنكي (IBAN)", en: "Bank account (IBAN)", dir: "ltr", ruleId: "payroll.wps.deadlineDayOfMonth" },
    ],
  },
];

export function profileFieldValue(profile = {}, key, employee) {
  if (key === "position") return profile.position || employee?.position || "";
  if (key === "contractType") return profile.contractType || profile.contract?.type || "";
  if (key === "idExpiry") return profile.idExpiry || profile.iqamaExpiry || "";
  return profile[key] || "";
}

export function profileFieldOptions(field) {
  return OPTION_SETS[field?.options] || null;
}

export function profileFieldRuleId(field, value) {
  const map = field?.optionRuleIds;
  const selected = String(value || "").trim();
  if (map && selected && map[selected]) return map[selected];
  return field?.ruleId || null;
}

export function profileFieldLabel(field, idType, ar) {
  if (field?.labelKey === "idNumber") return idNumberFieldLabel(idType, ar);
  return ar ? field.ar : field.en;
}

export function displayProfileField(field, raw, ar) {
  const opts = profileFieldOptions(field);
  if (opts) return optionLabel(opts, raw, ar) || "";
  return raw || "";
}

export function canonicalFieldValue(field, raw) {
  const opts = profileFieldOptions(field);
  if (!opts) return raw || "";
  return normalizeOption(raw, opts) || "";
}

export function isProfileFieldRequired(field, profile, form) {
  const idType = form?.idType ?? profile?.idType;
  if (field.forIqama) return isIqamaIdType(idType);
  return !field.optional;
}

export function isProfileFieldVisible(field, { profile, form, editing }) {
  const idType = form?.idType ?? profile?.idType;
  const raw = editing ? form?.[field.key] : profileFieldValue(profile, field.key);
  if (field.forIqama) {
    if (isIqamaIdType(idType)) return true;
    return !!String(raw || "").trim();
  }
  if (!field.optional) return true;
  if (editing) return true;
  return !!String(raw || "").trim();
}

export function requiredProfileFields(profile = {}) {
  return PROFILE_GROUPS.flatMap((g) => g.fields).filter((f) => isProfileFieldRequired(f, profile, profile));
}

export function profileCompletionStats(employee) {
  const profile = employee?.profile || {};
  const fields = requiredProfileFields(profile);
  const missing = fields.filter((f) => !String(profileFieldValue(profile, f.key, employee)).trim());
  const filled = fields.length - missing.length;
  const pct = fields.length ? Math.round((filled / fields.length) * 100) : 100;
  return { fields, missing, filled, pct, done: pct === 100 };
}
