/** MHRSD compliance pack — employee statutory file, Nitaqat, GOSI monthly, WPS/Mudad-ready rows.
 *  Design: README + Platform HR/payroll. Live Ministry APIs are out of scope here.
 */

import { ruleValue } from "./laborRules.ts";

export const COMPLIANCE_DOC_KINDS = [
  "iqama",
  "work_permit",
  "gosi",
  "qiwa_title",
  "national_id",
] as const;

export type ComplianceDocKind = (typeof COMPLIANCE_DOC_KINDS)[number];

export const EXPIRY_WARN_DAYS = ruleValue("compliance.doc.expiryWarnDays");

/** Simplified Nitaqat bands for field ops (derived — not stored as a vanity label). */
export const NITAQAT_BANDS = ["red", "low_green", "mid_green", "high_green", "platinum"] as const;
export type NitaqatBand = (typeof NITAQAT_BANDS)[number];

export const NITAQAT_BAND_LABELS: Record<NitaqatBand, { ar: string; en: string }> = {
  red: { ar: "أحمر", en: "Red" },
  low_green: { ar: "أخضر منخفض", en: "Low green" },
  mid_green: { ar: "أخضر متوسط", en: "Mid green" },
  high_green: { ar: "أخضر مرتفع", en: "High green" },
  platinum: { ar: "بلاتيني", en: "Platinum" },
};

export function nitaqatBandLabel(band: string | null | undefined, ar: boolean) {
  const row = (band && NITAQAT_BAND_LABELS[band as NitaqatBand]) || NITAQAT_BAND_LABELS.red;
  return ar ? row.ar : row.en;
}

/** Illustrative GOSI contribution rates (employee / employer) — derived totals only. */
export const GOSI_EMPLOYEE_RATE = ruleValue("compliance.gosi.employeeRate");
export const GOSI_EMPLOYER_RATE = ruleValue("compliance.gosi.employerRate");

export type ComplianceDoc = {
  kind: ComplianceDocKind | string;
  number?: string | null;
  expiryDate?: string | null; // YYYY-MM-DD local
  labelAr?: string;
  labelEn?: string;
};

export type EmployeeComplianceLike = {
  employeeId: string;
  name?: string;
  saudi?: boolean;
  nationality?: string | null;
  nationalId?: string | null;
  iban?: string | null;
  gosiNumber?: string | null;
  qiwaTitle?: string | null;
  profile?: {
    nationality?: string | null;
    nationalId?: string | null;
    saudi?: boolean;
    idNumber?: string | null;
  } | null;
  docs?: ComplianceDoc[];
};

export type SaudiIdKind = "citizen" | "iqama" | "unknown" | null;
export type SaudiStatusSource = "nationality+id" | "nationality" | "id" | "legacy_flag" | "none";

export type SaudiStatus = {
  saudi: boolean;
  countable: boolean;
  mismatch: boolean;
  unresolved: boolean;
  needsNationality: boolean;
  needsId: boolean;
  source: SaudiStatusSource;
  idKind: SaudiIdKind;
  nationalitySaudi: boolean | null;
  nationality: string;
  nationalId: string;
  error?: string;
  reason?: string;
  reasonEn?: string;
};

function digitsId(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

export function nationalityIsSaudi(nationality: string | null | undefined): boolean | null {
  const n = String(nationality || "").trim();
  if (!n) return null;
  return /سعود|saudi/i.test(n);
}

export function idKindFromNationalId(nationalId: string | null | undefined): SaudiIdKind {
  const id = digitsId(nationalId);
  if (!id) return null;
  if (id.startsWith("1")) return "citizen";
  if (id.startsWith("2")) return "iqama";
  return "unknown";
}

function readIdentity(input: EmployeeComplianceLike | Record<string, unknown> | null | undefined) {
  const row = (input || {}) as EmployeeComplianceLike & Record<string, unknown>;
  const profile = row.profile && typeof row.profile === "object" ? row.profile : {};
  const nationality = String(row.nationality ?? profile.nationality ?? "").trim();
  const nationalId = String(
    row.nationalId ?? profile.nationalId ?? row.idNumber ?? profile.idNumber ?? "",
  );
  const legacySaudi = row.saudi ?? profile.saudi;
  return { nationality, nationalId, legacySaudi };
}

/** Nationality is the criterion; national ID (1 = citizen, 2 = iqama) must agree when both exist. */
export function deriveSaudiStatus(
  input: EmployeeComplianceLike | Record<string, unknown> | null | undefined,
): SaudiStatus {
  const { nationality, nationalId, legacySaudi } = readIdentity(input);
  const nationalitySaudi = nationalityIsSaudi(nationality);
  const idKind = idKindFromNationalId(nationalId);
  const hasNat = nationalitySaudi !== null;
  const hasId = idKind === "citizen" || idKind === "iqama";
  const base = {
    nationality,
    nationalId: digitsId(nationalId),
    idKind,
    nationalitySaudi,
  };

  if (hasNat && hasId) {
    const fromNat = nationalitySaudi === true;
    const fromId = idKind === "citizen";
    if (fromNat !== fromId) {
      return {
        ...base,
        saudi: false,
        countable: false,
        mismatch: true,
        unresolved: false,
        needsNationality: false,
        needsId: false,
        source: "nationality+id",
        error: "SAUDI_IDENTITY_MISMATCH",
        reason: "موقوف — الجنسية لا تطابق رقم الهوية (١ مواطن / ٢ إقامة).",
        reasonEn: "Blocked — nationality does not match the ID number (1 = citizen / 2 = iqama).",
      };
    }
    return {
      ...base,
      saudi: fromNat,
      countable: true,
      mismatch: false,
      unresolved: false,
      needsNationality: false,
      needsId: false,
      source: "nationality+id",
    };
  }

  if (hasNat) {
    return {
      ...base,
      saudi: nationalitySaudi === true,
      countable: true,
      mismatch: false,
      unresolved: false,
      needsNationality: false,
      needsId: true,
      source: "nationality",
    };
  }

  if (hasId) {
    return {
      ...base,
      saudi: idKind === "citizen",
      countable: true,
      mismatch: false,
      unresolved: false,
      needsNationality: true,
      needsId: false,
      source: "id",
    };
  }

  if (typeof legacySaudi === "boolean") {
    return {
      ...base,
      saudi: legacySaudi,
      countable: true,
      mismatch: false,
      unresolved: false,
      needsNationality: true,
      needsId: true,
      source: "legacy_flag",
    };
  }

  return {
    ...base,
    saudi: false,
    countable: false,
    mismatch: false,
    unresolved: true,
    needsNationality: true,
    needsId: true,
    source: "none",
  };
}

export function isSaudiForNitaqat(
  input: EmployeeComplianceLike | Record<string, unknown> | null | undefined,
) {
  const status = deriveSaudiStatus(input);
  return status.countable && status.saudi;
}

export function checkSaudiIdentityGate(
  input: EmployeeComplianceLike | Record<string, unknown> | null | undefined,
) {
  const status = deriveSaudiStatus(input);
  if (status.mismatch) {
    return {
      ok: false as const,
      error: "SAUDI_IDENTITY_MISMATCH" as const,
      reason: status.reason,
      reasonEn: status.reasonEn,
      ...status,
    };
  }
  return { ok: true as const, ...status };
}

function parseDay(iso: string | null | undefined) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysUntilExpiry(expiryDate: string | null | undefined, today = localDateKey()) {
  const a = parseDay(today);
  const b = parseDay(expiryDate || "");
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const DOC_END_KEYS = ["expiryDate", "endDate", "validUntil", "expiresAt", "expiry"] as const;
const DOC_START_KEYS = ["startDate", "issueDate", "issuedAt", "validFrom", "issuedOn"] as const;
const DOC_KIND_ALIASES: Record<string, string> = {
  medical_insurance: "medical",
  medical: "medical",
  cchi: "medical",
  driving_license: "driving_licence",
  driving_licence: "driving_licence",
  driving: "driving_licence",
  licence: "license",
  license: "license",
  cert: "certificate",
  certification: "certificate",
  certificates: "certificate",
};

const KNOWN_FILE_DOC_KINDS = new Set([
  "iqama", "work_permit", "gosi", "qiwa_title", "national_id",
  "passport", "medical", "certificate", "driving_licence", "license", "visa",
]);

const PROFILE_EXPIRY_FIELDS = [
  { keys: ["idExpiry", "iqamaExpiry"], kind: "iqama" },
  { keys: ["workPermitExpiry"], kind: "work_permit" },
  { keys: ["passportExpiry"], kind: "passport" },
  { keys: ["medicalInsuranceExpiry"], kind: "medical" },
];

const EMP_DOC_ARRAYS = [
  { key: "docs", known: true },
  { key: "certificates", known: true, defaultKind: "certificate" },
  { key: "licenses", known: true, defaultKind: "license" },
  { key: "licences", known: true, defaultKind: "license" },
  { key: "visas", known: true, defaultKind: "visa" },
  { key: "files", known: false },
  { key: "documents", known: false },
  { key: "hireDocs", known: false },
  { key: "hireDocuments", known: false },
  { key: "vaultDocs", known: false },
  { key: "signedDocs", known: false },
] as const;

const COMPANY_DOC_ARRAYS = [
  "files", "companyDocs", "documents", "licenses", "licences", "visas",
  "signedDocuments", "hireDocuments",
] as const;

const DOC_KIND_LABELS: Record<string, { ar: string; en: string }> = {
  iqama: { ar: "الإقامة", en: "Iqama" },
  work_permit: { ar: "رخصة العمل", en: "Work permit" },
  gosi: { ar: "رقم التأمينات GOSI", en: "GOSI number" },
  qiwa_title: { ar: "المسمى في قوى", en: "Qiwa job title" },
  national_id: { ar: "الهوية الوطنية", en: "National ID" },
  passport: { ar: "الجواز", en: "Passport" },
  medical: { ar: "التأمين الطبي", en: "Medical insurance" },
  certificate: { ar: "شهادة", en: "Certificate" },
  driving_licence: { ar: "رخصة القيادة", en: "Driving licence" },
  license: { ar: "رخصة", en: "Licence" },
  visa: { ar: "تأشيرة", en: "Visa" },
  fa: { ar: "الإسعافات الأولية", en: "First aid" },
  loto: { ar: "العزل والوسم LOTO", en: "Lock-out / tag-out" },
  wah: { ar: "العمل على ارتفاع", en: "Work at height" },
  cs: { ar: "الأماكن المحصورة", en: "Confined space" },
};

export type ValidityDocRow = {
  employeeId: string;
  name?: string;
  kind: string;
  docLabelAr: string;
  docLabelEn: string;
  expiryDate: string;
  days: number;
};

function hasArabic(value: unknown) {
  return /[\u0600-\u06FF]/.test(String(value || ""));
}

function isoDay(value: unknown) {
  const m = String(value || "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function readDocEndDate(obj: any) {
  if (!obj || typeof obj !== "object") return "";
  for (const key of DOC_END_KEYS) {
    const day = isoDay(obj[key]);
    if (day) return day;
  }
  return "";
}

function readDocStartDate(obj: any) {
  if (!obj || typeof obj !== "object") return "";
  for (const key of DOC_START_KEYS) {
    const day = isoDay(obj[key]);
    if (day) return day;
  }
  return "";
}

export function normalizeDocKind(kind: unknown) {
  const raw = String(kind || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return DOC_KIND_ALIASES[raw] || raw;
}

function pickDocTitle(extra: any) {
  const name = extra?.name || extra?.title || extra?.label || extra?.fileName || extra?.number || "";
  const ar = extra?.labelAr || extra?.nameAr || extra?.titleAr || extra?.docLabelAr
    || (hasArabic(name) ? name : "");
  const en = extra?.labelEn || extra?.nameEn || extra?.titleEn || extra?.docLabelEn
    || (!hasArabic(name) ? name : "");
  return { ar, en, raw: name };
}

/** Arabic/English label for a document kind — prefer an Arabic title over a raw English dump. */
export function docLabel(kind: string, extra: Record<string, unknown> = {}) {
  const title = pickDocTitle(extra);
  const mapped = DOC_KIND_LABELS[normalizeDocKind(kind)] || DOC_KIND_LABELS[String(kind || "").toLowerCase()];
  if (title.ar || title.en) {
    return {
      ar: title.ar || mapped?.ar || title.en,
      en: title.en || mapped?.en || title.ar,
    };
  }
  if (mapped) return mapped;
  const raw = String(kind || "").trim();
  if (hasArabic(raw)) return { ar: raw, en: raw };
  return { ar: "وثيقة", en: raw || "Document" };
}

function resolveDocKind(doc: any, defaultKind?: string) {
  const raw = doc?.kind || doc?.type || doc?.category || doc?.code || defaultKind || "";
  return normalizeDocKind(raw) || defaultKind || "document";
}

function shouldIncludeDatedDoc(doc: any, { knownCollection }: { knownCollection?: boolean } = {}) {
  if (!doc || typeof doc !== "object") return false;
  if (String(doc.type || "").toLowerCase() === "folder") return false;
  const end = readDocEndDate(doc);
  if (!end) return false;
  const start = readDocStartDate(doc);
  const kind = resolveDocKind(doc);
  if (knownCollection || KNOWN_FILE_DOC_KINDS.has(kind)) return true;
  return Boolean(start && end);
}

function validityRowFromDoc(emp: any, doc: any, { defaultKind, today }: { defaultKind?: string; today?: string } = {}): ValidityDocRow | null {
  const expiryDate = readDocEndDate(doc);
  const days = daysUntilExpiry(expiryDate, today);
  if (days == null || days > EXPIRY_WARN_DAYS) return null;
  const kind = resolveDocKind(doc, defaultKind);
  const label = docLabel(kind, doc);
  return {
    employeeId: emp?.employeeId || emp?.id || "",
    name: emp?.name,
    kind,
    docLabelAr: label.ar,
    docLabelEn: label.en,
    expiryDate,
    days,
  };
}

export function mergeValidityDocRows(rows: Array<ValidityDocRow | null | undefined>) {
  const seen = new Set<string>();
  const out: ValidityDocRow[] = [];
  for (const row of rows || []) {
    if (!row) continue;
    const key = `${row.employeeId || ""}:${row.kind}:${row.docLabelAr || ""}:${row.expiryDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.sort((a, b) => a.days - b.days);
}

/** One employee — every dated file-doc in the warn window. Shared by ministry alerts and EmpAlertsStrip. */
export function collectEmployeeValidityDocs(emp: any, today = localDateKey()): ValidityDocRow[] {
  const out: ValidityDocRow[] = [];
  if (!emp) return out;

  for (const spec of EMP_DOC_ARRAYS) {
    const list = emp[spec.key];
    if (!Array.isArray(list)) continue;
    for (const doc of list) {
      if (!shouldIncludeDatedDoc(doc, { knownCollection: spec.known })) continue;
      const row = validityRowFromDoc(emp, doc, { defaultKind: (spec as { defaultKind?: string }).defaultKind, today });
      if (row) out.push(row);
    }
  }

  const profile = emp.profile && typeof emp.profile === "object" ? emp.profile : {};
  const idType = normalizeDocKind(profile.idType || emp.idType);
  for (const field of PROFILE_EXPIRY_FIELDS) {
    const iso = field.keys.map((k) => profile[k] ?? emp[k]).find(Boolean);
    if (!iso) continue;
    let kind = field.kind;
    if (field.keys.includes("idExpiry")) {
      if (idType === "national_id") kind = "national_id";
      else if (idType === "iqama") kind = "iqama";
    }
    const expiryDate = isoDay(iso);
    const days = daysUntilExpiry(expiryDate, today);
    if (!expiryDate || days == null || days > EXPIRY_WARN_DAYS) continue;
    const label = docLabel(kind);
    out.push({
      employeeId: emp.employeeId || emp.id || "",
      name: emp.name,
      kind,
      docLabelAr: label.ar,
      docLabelEn: label.en,
      expiryDate,
      days,
    });
  }

  return mergeValidityDocRows(out);
}

function collectCompanyValidityDocs(data: any, today = localDateKey()): ValidityDocRow[] {
  const out: ValidityDocRow[] = [];
  if (!data || typeof data !== "object") return out;
  const companyName = data.name || data.companyName || "";
  for (const key of COMPANY_DOC_ARRAYS) {
    const list = data[key];
    if (!Array.isArray(list)) continue;
    for (const doc of list) {
      if (!shouldIncludeDatedDoc(doc, { knownCollection: false })) continue;
      const expiryDate = readDocEndDate(doc);
      const days = daysUntilExpiry(expiryDate, today);
      if (days == null || days > EXPIRY_WARN_DAYS) continue;
      const kind = resolveDocKind(doc, "document");
      const label = docLabel(kind, doc);
      out.push({
        employeeId: doc.employeeId || doc.ownerId || "",
        name: doc.employeeName || doc.ownerName || companyName,
        kind,
        docLabelAr: label.ar,
        docLabelEn: label.en,
        expiryDate,
        days,
      });
    }
  }
  return out;
}

/** Live register — employees plus company dated docs (not HSE permits, leave, or contracts). */
export function collectRegisterValidityDocs(data: any, today = localDateKey()): ValidityDocRow[] {
  const employees = Array.isArray(data) ? data : (data?.employees || []);
  const company = Array.isArray(data) ? null : data;
  return mergeValidityDocRows([
    ...deriveExpiringDocs(employees, today),
    ...collectCompanyValidityDocs(company, today),
  ]);
}

/** Gate: block assignment / hire start when a required doc expires within 60 days or is missing. */
export function checkComplianceDocGate(input: {
  employee?: EmployeeComplianceLike | null;
  requiredKinds?: string[];
  today?: string;
}) {
  const emp = input.employee;
  if (!emp) {
    return {
      ok: false as const,
      error: "EMPLOYEE_REQUIRED",
      reason: "يلزم ملف موظف لفحص الامتثال.",
      reasonEn: "An employee file is required for the compliance check.",
    };
  }
  const today = input.today || localDateKey();
  const identity = deriveSaudiStatus(emp);
  if (identity.mismatch) {
    return {
      ok: false as const,
      error: "SAUDI_IDENTITY_MISMATCH",
      reason: identity.reason,
      reasonEn: identity.reasonEn,
    };
  }
  const saudi = identity.countable ? identity.saudi : !!emp.saudi;
  const required = input.requiredKinds || (saudi
    ? ["national_id", "gosi", "qiwa_title"]
    : ["iqama", "work_permit", "gosi", "qiwa_title"]);
  const docs = Array.isArray(emp.docs) ? emp.docs : [];

  for (const kind of required) {
    if (kind === "iqama" && saudi) continue;
    const doc = docs.find((d) => d.kind === kind);
    const label = docLabel(kind);
    if (!doc || (!doc.number && !doc.expiryDate && kind !== "qiwa_title")) {
      // Allow qiwa_title from emp.qiwaTitle
      if (kind === "qiwa_title" && emp.qiwaTitle) continue;
      if (kind === "gosi" && emp.gosiNumber) continue;
      if (kind === "national_id" && emp.nationalId) continue;
      return {
        ok: false as const,
        error: "DOC_MISSING",
        missingKind: kind,
        docLabelAr: label.ar,
        docLabelEn: label.en,
        reason: `موقوف — الوثيقة الناقصة: ${label.ar}.`,
        reasonEn: `Blocked — missing document: ${label.en}.`,
      };
    }
    if (doc.expiryDate) {
      const days = daysUntilExpiry(doc.expiryDate, today);
      if (days != null && days < 0) {
        return {
          ok: false as const,
          error: "DOC_EXPIRED",
          missingKind: kind,
          docLabelAr: label.ar,
          docLabelEn: label.en,
          days,
          reason: `موقوف — انتهت ${label.ar}.`,
          reasonEn: `Blocked — ${label.en} has expired.`,
        };
      }
      if (days != null && days <= EXPIRY_WARN_DAYS) {
        return {
          ok: false as const,
          error: "DOC_EXPIRING",
          missingKind: kind,
          docLabelAr: label.ar,
          docLabelEn: label.en,
          days,
          reason: `موقوف — ${label.ar} تنتهي خلال ${days} يومًا (حد ${EXPIRY_WARN_DAYS}).`,
          reasonEn: `Blocked — ${label.en} expires in ${days} days (${EXPIRY_WARN_DAYS}-day gate).`,
        };
      }
    }
  }
  return { ok: true as const };
}

function isFixedTerm(type: string | null | undefined) {
  const s = String(type || "").trim().toLowerCase();
  if (!s) return false;
  if (s === "indefinite" || s === "unlimited" || s === "open" || s === "open-ended" || s === "trial") return false;
  if (/غير\s*محدد/.test(s)) return false;
  return s === "fixed" || s === "definite" || s.includes("fixed") || /محدد/.test(s);
}

function readContractTerm(input: { employee?: EmployeeComplianceLike | Record<string, unknown> | null } | EmployeeComplianceLike | Record<string, unknown> | null | undefined) {
  const row = ((input as { employee?: unknown })?.employee || input || {}) as Record<string, unknown> & {
    profile?: { contractType?: string; contractEndDate?: string; hireDate?: string; contract?: { type?: string; endDate?: string; startDate?: string } };
    contract?: { type?: string; endDate?: string; startDate?: string };
    contractType?: string;
    contractEndDate?: string;
    hireDate?: string;
  };
  const profile = row.profile && typeof row.profile === "object" ? row.profile : {};
  const contract = (row.contract && typeof row.contract === "object" ? row.contract : profile.contract) || {};
  const type = String(contract.type || row.contractType || profile.contractType || "");
  const endDate = String(contract.endDate || row.contractEndDate || profile.contractEndDate || "").slice(0, 10);
  const startDate = String(contract.startDate || profile.hireDate || row.hireDate || "").slice(0, 10);
  return { type, endDate, startDate };
}

function isExplicitIndefinite(type: string | null | undefined) {
  const s = String(type || "").trim().toLowerCase();
  if (!s) return false;
  if (s === "trial" || s === "probation") return false;
  if (s === "indefinite" || s === "unlimited" || s === "open" || s === "open-ended") return true;
  return /غير\s*محدد/.test(s);
}

function addCalendarDays(iso: string, days: number) {
  const d = parseDay(iso);
  if (!d || !Number.isFinite(days)) return "";
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function saudiArt55ConvertsExpired(
  input: { employee?: EmployeeComplianceLike | Record<string, unknown> | null; today?: string } | Record<string, unknown>,
  today: string,
  resolvedEnd: string,
  type: string,
) {
  if (!isFixedTerm(type) || !resolvedEnd || !(today > resolvedEnd)) return false;
  const identity = deriveSaudiStatus(input as Record<string, unknown>);
  if (identity.saudi !== true) return false;
  const row = ((input as { employee?: Record<string, unknown> }).employee || input || {}) as Record<string, unknown> & {
    profile?: { contractRenewalCount?: number; hireDate?: string; workPattern?: string; contract?: { renewalCount?: number; startDate?: string; workPattern?: string } };
    renewalCount?: number;
    hireDate?: string;
    workPattern?: string;
  };
  const profile = row.profile && typeof row.profile === "object" ? row.profile : {};
  const pattern = String(profile.workPattern || profile.contract?.workPattern || row.workPattern || "").toLowerCase();
  if (pattern === "temporary" || pattern === "seasonal") return false;
  const renewals = Math.max(0, Number(profile.contractRenewalCount ?? profile.contract?.renewalCount ?? row.renewalCount ?? 0) || 0);
  const start = String(profile.contract?.startDate || profile.hireDate || row.hireDate || "").slice(0, 10);
  const hired = parseDay(start);
  const now = parseDay(today);
  const years = hired && now && now >= hired ? (now.getTime() - hired.getTime()) / 31557600000 : 0;
  const maxRenewals = ruleValue("contract.fixed.maxConsecutiveRenewals", today);
  const maxYears = ruleValue("contract.fixed.maxYearsBeforeIndefinite", today);
  return renewals === 0 || renewals >= maxRenewals || years >= maxYears;
}

export function checkContractTermGate(
  input: { employee?: EmployeeComplianceLike | Record<string, unknown> | null; today?: string } | Record<string, unknown> = {},
) {
  const { type, endDate, startDate } = readContractTerm(input);
  const today = (input as { today?: string }).today || localDateKey();
  const identity = deriveSaudiStatus(input as Record<string, unknown>);
  const nonSaudi = identity.nationalitySaudi === false;
  if (nonSaudi && isExplicitIndefinite(type)) {
    return {
      ok: false as const,
      error: "CONTRACT_NONSAUDI_FIXED_REQUIRED" as const,
      term: "fixed" as const,
      reason: "موقوف — عقد غير السعودي مكتوب ومحدد المدة (المادة 37).",
      reasonEn: "Blocked — a non-Saudi contract must be written and fixed-term (Article 37).",
    };
  }
  const fixed = nonSaudi || isFixedTerm(type);
  if (!fixed) {
    return { ok: true as const, term: "indefinite" as const, startDate: startDate || null, endDate: null };
  }
  let resolvedEnd = endDate;
  let deemed = false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedEnd)) {
    if (nonSaudi && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      resolvedEnd = addCalendarDays(startDate, ruleValue("contract.nonSaudi.deemedTermDays"));
      deemed = true;
    } else {
      return {
        ok: false as const,
        error: "CONTRACT_END_REQUIRED" as const,
        term: "fixed" as const,
        reason: nonSaudi
          ? "موقوف — العقد محدد المدة يحتاج تاريخ نهاية (المادة 37)."
          : "موقوف — العقد محدد المدة يحتاج تاريخ نهاية (المادة 55).",
        reasonEn: nonSaudi
          ? "Blocked — a fixed-term contract needs an end date (Article 37)."
          : "Blocked — a fixed-term contract needs an end date (Article 55).",
      };
    }
  }
  const days = daysUntilExpiry(resolvedEnd, today);
  if (days != null && days < 0) {
    if (saudiArt55ConvertsExpired(input, today, resolvedEnd, type)) {
      return {
        ok: true as const,
        warning: "ART55_CONVERTED" as const,
        term: "indefinite" as const,
        art55: true as const,
        previousEndDate: resolvedEnd,
        days,
        reason: "يُعد العقد غير محدد المدة وفق المادة 55 — يُكتب النوع في الملف.",
        reasonEn: "The contract is deemed indefinite under Article 55 — the file type is rewritten.",
      };
    }
    return {
      ok: false as const,
      error: "CONTRACT_EXPIRED" as const,
      term: "fixed" as const,
      endDate: resolvedEnd,
      deemed,
      days,
      reason: `موقوف — انتهى العقد محدد المدة في ${resolvedEnd}.`,
      reasonEn: `Blocked — the fixed-term contract ended on ${resolvedEnd}.`,
    };
  }
  if (deemed) {
    return {
      ok: true as const,
      warning: "CONTRACT_TERM_DEEMED_YEAR" as const,
      term: "fixed" as const,
      endDate: resolvedEnd,
      deemed: true as const,
      days,
      startDate: startDate || null,
      reason: `المادة 37 — إن لم تُذكر المدة عُدّ العقد سنة حتى ${resolvedEnd}.`,
      reasonEn: `Article 37 — omitted duration is deemed one year, ending ${resolvedEnd}.`,
    };
  }
  if (days != null && days <= EXPIRY_WARN_DAYS) {
    return {
      ok: true as const,
      warning: "CONTRACT_EXPIRING" as const,
      term: "fixed" as const,
      endDate: resolvedEnd,
      days,
      reason: `تنبيه — العقد محدد المدة ينتهي خلال ${days} يومًا (حد ${EXPIRY_WARN_DAYS}).`,
      reasonEn: `Watch — the fixed-term contract ends in ${days} days (${EXPIRY_WARN_DAYS}-day window).`,
    };
  }
  return { ok: true as const, term: "fixed" as const, endDate: resolvedEnd, days, startDate: startDate || null };
}

export function deriveExpiringDocs(employees: Array<EmployeeComplianceLike | Record<string, unknown>>, today = localDateKey()) {
  const out: ValidityDocRow[] = [];
  for (const emp of employees || []) {
    out.push(...collectEmployeeValidityDocs(emp, today));
  }
  return mergeValidityDocRows(out);
}

/** Nitaqat saudization % from nationality + national ID (mismatch is not counted as Saudi). */
export function deriveNitaqat(employees: EmployeeComplianceLike[]) {
  const list = (employees || []).filter(Boolean);
  const statuses = list.map((e) => deriveSaudiStatus(e));
  const total = list.length;
  const saudi = statuses.filter((s) => s.countable && s.saudi).length;
  const mismatch = statuses.filter((s) => s.mismatch).length;
  const needsNationality = statuses.filter((s) => s.needsNationality).length;
  const unresolved = statuses.filter((s) => s.unresolved).length;
  const rate = total > 0 ? Math.round((saudi / total) * 1000) / 10 : 0;
  let band: NitaqatBand = "red";
  if (rate >= 40) band = "platinum";
  else if (rate >= 30) band = "high_green";
  else if (rate >= 20) band = "mid_green";
  else if (rate >= 10) band = "low_green";
  return {
    total,
    saudi,
    nonSaudi: total - saudi,
    mismatch,
    needsNationality,
    unresolved,
    rate,
    band,
    bandId: band,
  };
}

/** Hiring gate when vacancy would worsen a red/low band without stated Nitaqat effect. */
export function checkNitaqatHireGate(input: {
  nitaqat: ReturnType<typeof deriveNitaqat>;
  candidateSaudi?: boolean;
  nitaqatEffectStated?: boolean;
}) {
  const band = input.nitaqat.band;
  if (band === "red" || band === "low_green") {
    if (!input.candidateSaudi && !input.nitaqatEffectStated) {
      return {
        ok: false as const,
        error: "NITAQAT_EFFECT_REQUIRED",
        band,
        reason: `نطاق ${nitaqatBandLabel(band, true)} — يلزم بيان أثر التوظيف على السعودة قبل النشر/التعيين.`,
        reasonEn: `${nitaqatBandLabel(band, false)} band — state the Saudization effect before posting/hiring.`,
      };
    }
  }
  return { ok: true as const, band };
}

export type PayrollLineForGosi = {
  employeeId: string;
  employeeName?: string;
  base?: number;
  allowances?: number;
  gosiNumber?: string | null;
};

export function deriveGosiMonthly(lines: PayrollLineForGosi[], establishmentNumber?: string | null) {
  const rows = (lines || []).map((line) => {
    const wage = Math.max(0, Number(line.base || 0) + Number(line.allowances || 0));
    const employeeShare = Math.round(wage * GOSI_EMPLOYEE_RATE * 100) / 100;
    const employerShare = Math.round(wage * GOSI_EMPLOYER_RATE * 100) / 100;
    return {
      employeeId: line.employeeId,
      employeeName: line.employeeName,
      gosiNumber: line.gosiNumber || null,
      contributoryWage: wage,
      employeeShare,
      employerShare,
      total: Math.round((employeeShare + employerShare) * 100) / 100,
    };
  });
  const employeeTotal = rows.reduce((s, r) => s + r.employeeShare, 0);
  const employerTotal = rows.reduce((s, r) => s + r.employerShare, 0);
  return {
    establishmentNumber: establishmentNumber || null,
    employeeRate: GOSI_EMPLOYEE_RATE,
    employerRate: GOSI_EMPLOYER_RATE,
    rows,
    employeeTotal: Math.round(employeeTotal * 100) / 100,
    employerTotal: Math.round(employerTotal * 100) / 100,
    grandTotal: Math.round((employeeTotal + employerTotal) * 100) / 100,
    simulatedSend: true,
  };
}

export function checkGosiFileGate(input: {
  establishmentNumber?: string | null;
  rows?: Array<{ gosiNumber?: string | null }>;
}) {
  if (!String(input.establishmentNumber || "").trim()) {
    return {
      ok: false as const,
      error: "GOSI_ESTABLISHMENT_REQUIRED",
      reason: "يلزم رقم منشأة التأمينات في إعدادات الشركة قبل ملف GOSI الشهري.",
      reasonEn: "A GOSI establishment number is required in company settings before the monthly GOSI file.",
    };
  }
  const missing = (input.rows || []).filter((r) => !String(r.gosiNumber || "").trim());
  if (missing.length) {
    return {
      ok: false as const,
      error: "GOSI_NUMBER_MISSING",
      reason: `${missing.length} موظف بلا رقم تأمينات — أكمل الملف النظامي.`,
      reasonEn: `${missing.length} employees missing a GOSI number — complete the statutory file.`,
      count: missing.length,
    };
  }
  return { ok: true as const };
}

/** WPS / Mudad-ready row — national ID + IBAN + net. */
export type WpsReadyLine = {
  employeeId: string;
  employeeName?: string;
  nationalId?: string | null;
  iban?: string | null;
  netPay?: number;
  qiwaWage?: number | null;
  base?: number;
  allowances?: number;
};

export function buildWpsFileRows(lines: WpsReadyLine[]) {
  return (lines || []).map((line) => {
    const expected = Math.max(0, Number(line.base || 0) + Number(line.allowances || 0));
    const qiwaOk =
      line.qiwaWage != null && Number.isFinite(Number(line.qiwaWage))
        ? Math.abs(expected - Number(line.qiwaWage)) < 1
        : false;
    return {
      employeeId: line.employeeId,
      employeeName: line.employeeName || "",
      nationalId: String(line.nationalId || "").trim(),
      iban: String(line.iban || "").trim().replace(/\s+/g, "").toUpperCase(),
      netPay: Math.round(Number(line.netPay || 0) * 100) / 100,
      qiwaMatch: qiwaOk,
      channel: "mudad" as const,
    };
  });
}

export function checkWpsFileGate(rows: ReturnType<typeof buildWpsFileRows>) {
  const list = rows || [];
  if (!list.length) {
    return {
      ok: false as const,
      error: "WPS_EMPTY",
      reason: "لا صفوف لملف WPS.",
      reasonEn: "No rows for the WPS file.",
    };
  }
  for (const row of list) {
    if (!/^\d{10}$/.test(row.nationalId)) {
      return {
        ok: false as const,
        error: "NATIONAL_ID_INVALID",
        employeeId: row.employeeId,
        reason: `هوية غير صالحة لـ ${row.employeeName || row.employeeId} — يلزم 10 أرقام.`,
        reasonEn: `Invalid national ID for ${row.employeeName || row.employeeId} — 10 digits required.`,
      };
    }
    if (!/^SA\d{22}$/.test(row.iban)) {
      return {
        ok: false as const,
        error: "IBAN_INVALID",
        employeeId: row.employeeId,
        reason: `آيبان غير صالح لـ ${row.employeeName || row.employeeId} — صيغة SA + 22 رقمًا.`,
        reasonEn: `Invalid IBAN for ${row.employeeName || row.employeeId} — SA + 22 digits.`,
      };
    }
    if (!row.qiwaMatch) {
      return {
        ok: false as const,
        error: "QIWA_MISMATCH",
        employeeId: row.employeeId,
        reason: `عدم تطابق أجر قوى لـ ${row.employeeName || row.employeeId} — لا إرسال WPS/مدى.`,
        reasonEn: `Qiwa wage mismatch for ${row.employeeName || row.employeeId} — cannot send WPS/Mudad.`,
      };
    }
  }
  return { ok: true as const, channel: "mudad" as const, rowCount: list.length };
}
