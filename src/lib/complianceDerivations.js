/** Client mirror of base44/shared/complianceDerivations.ts */

import { ruleValue } from "./laborRules.js";

export const COMPLIANCE_DOC_KINDS = ["iqama", "work_permit", "gosi", "qiwa_title", "national_id"];
export const EXPIRY_WARN_DAYS = ruleValue("compliance.doc.expiryWarnDays");
export const GOSI_EMPLOYEE_RATE = ruleValue("compliance.gosi.employeeRate");
export const GOSI_EMPLOYER_RATE = ruleValue("compliance.gosi.employerRate");

export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDay(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function daysUntilExpiry(expiryDate, today = localDateKey()) {
  const a = parseDay(today);
  const b = parseDay(expiryDate || "");
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const DOC_END_KEYS = ["expiryDate", "endDate", "validUntil", "expiresAt", "expiry"];
const DOC_START_KEYS = ["startDate", "issueDate", "issuedAt", "validFrom", "issuedOn"];
const DOC_KIND_ALIASES = {
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
];

const COMPANY_DOC_ARRAYS = [
  "files", "companyDocs", "documents", "licenses", "licences", "visas",
  "signedDocuments", "hireDocuments",
];

const DOC_KIND_LABELS = {
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

function hasArabic(value) {
  return /[\u0600-\u06FF]/.test(String(value || ""));
}

function isoDay(value) {
  const m = String(value || "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function readDocEndDate(obj) {
  if (!obj || typeof obj !== "object") return "";
  for (const key of DOC_END_KEYS) {
    const day = isoDay(obj[key]);
    if (day) return day;
  }
  return "";
}

function readDocStartDate(obj) {
  if (!obj || typeof obj !== "object") return "";
  for (const key of DOC_START_KEYS) {
    const day = isoDay(obj[key]);
    if (day) return day;
  }
  return "";
}

export function normalizeDocKind(kind) {
  const raw = String(kind || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return DOC_KIND_ALIASES[raw] || raw;
}

function pickDocTitle(extra) {
  const name = extra?.name || extra?.title || extra?.label || extra?.fileName || extra?.number || "";
  const ar = extra?.labelAr || extra?.nameAr || extra?.titleAr || extra?.docLabelAr
    || (hasArabic(name) ? name : "");
  const en = extra?.labelEn || extra?.nameEn || extra?.titleEn || extra?.docLabelEn
    || (!hasArabic(name) ? name : "");
  return { ar, en, raw: name };
}

/** Arabic/English label for a document kind — prefer an Arabic title over a raw English dump. */
export function docLabel(kind, extra = {}) {
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

function resolveDocKind(doc, defaultKind) {
  const raw = doc?.kind || doc?.type || doc?.category || doc?.code || defaultKind || "";
  return normalizeDocKind(raw) || defaultKind || "document";
}

function shouldIncludeDatedDoc(doc, { knownCollection } = {}) {
  if (!doc || typeof doc !== "object") return false;
  if (String(doc.type || "").toLowerCase() === "folder") return false;
  const end = readDocEndDate(doc);
  if (!end) return false;
  const start = readDocStartDate(doc);
  const kind = resolveDocKind(doc);
  if (knownCollection || KNOWN_FILE_DOC_KINDS.has(kind)) return true;
  return Boolean(start && end);
}

function validityRowFromDoc(emp, doc, { defaultKind, today } = {}) {
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

export function mergeValidityDocRows(rows) {
  const seen = new Set();
  const out = [];
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
export function collectEmployeeValidityDocs(emp, today = localDateKey()) {
  const out = [];
  if (!emp) return out;

  for (const spec of EMP_DOC_ARRAYS) {
    const list = emp[spec.key];
    if (!Array.isArray(list)) continue;
    for (const doc of list) {
      if (!shouldIncludeDatedDoc(doc, { knownCollection: spec.known })) continue;
      const row = validityRowFromDoc(emp, doc, { defaultKind: spec.defaultKind, today });
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

function collectCompanyValidityDocs(data, today = localDateKey()) {
  const out = [];
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
export function collectRegisterValidityDocs(data, today = localDateKey()) {
  const employees = Array.isArray(data) ? data : (data?.employees || []);
  const company = Array.isArray(data) ? null : data;
  return mergeValidityDocRows([
    ...deriveExpiringDocs(employees, today),
    ...collectCompanyValidityDocs(company, today),
  ]);
}

function digitsId(value) {
  return String(value || "").replace(/\D/g, "");
}

export function nationalityIsSaudi(nationality) {
  const n = String(nationality || "").trim();
  if (!n) return null;
  return /سعود|saudi/i.test(n);
}

export function idKindFromNationalId(nationalId) {
  const id = digitsId(nationalId);
  if (!id) return null;
  if (id.startsWith("1")) return "citizen";
  if (id.startsWith("2")) return "iqama";
  return "unknown";
}

function readIdentity(input) {
  const row = input || {};
  const profile = row.profile && typeof row.profile === "object" ? row.profile : {};
  const nationality = String(row.nationality ?? profile.nationality ?? "").trim();
  const nationalId = String(row.nationalId ?? profile.nationalId ?? row.idNumber ?? profile.idNumber ?? "");
  const legacySaudi = row.saudi ?? profile.saudi;
  return { nationality, nationalId, legacySaudi };
}

/** Nationality is the criterion; national ID (1 = citizen, 2 = iqama) must agree when both exist. */
export function deriveSaudiStatus(input) {
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

export function isSaudiForNitaqat(input) {
  const status = deriveSaudiStatus(input);
  return status.countable && status.saudi;
}

export function checkSaudiIdentityGate(input) {
  const status = deriveSaudiStatus(input);
  if (status.mismatch) {
    return {
      ok: false,
      error: "SAUDI_IDENTITY_MISMATCH",
      reason: status.reason,
      reasonEn: status.reasonEn,
      ...status,
    };
  }
  return { ok: true, ...status };
}

export function checkComplianceDocGate(input) {
  const emp = input.employee;
  if (!emp) {
    return {
      ok: false,
      error: "EMPLOYEE_REQUIRED",
      reason: "يلزم ملف موظف لفحص الامتثال.",
      reasonEn: "An employee file is required for the compliance check.",
    };
  }
  const today = input.today || localDateKey();
  const identity = deriveSaudiStatus(emp);
  if (identity.mismatch) {
    return {
      ok: false,
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
      if (kind === "qiwa_title" && emp.qiwaTitle) continue;
      if (kind === "gosi" && emp.gosiNumber) continue;
      if (kind === "national_id" && emp.nationalId) continue;
      return {
        ok: false,
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
          ok: false,
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
          ok: false,
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
  return { ok: true };
}

function isFixedTerm(type) {
  const s = String(type || "").trim().toLowerCase();
  if (!s) return false;
  if (s === "indefinite" || s === "unlimited" || s === "open" || s === "open-ended" || s === "trial") return false;
  if (/غير\s*محدد/.test(s)) return false;
  return s === "fixed" || s === "definite" || s.includes("fixed") || /محدد/.test(s);
}

function readContractTerm(input) {
  const row = input?.employee || input || {};
  const profile = row.profile && typeof row.profile === "object" ? row.profile : {};
  const contract = row.contract && typeof row.contract === "object" ? row.contract : (profile.contract || {});
  const type = contract.type || row.contractType || profile.contractType || "";
  const endDate = String(contract.endDate || row.contractEndDate || profile.contractEndDate || "").slice(0, 10);
  const startDate = String(contract.startDate || profile.hireDate || row.hireDate || "").slice(0, 10);
  return { type, endDate, startDate };
}

function isExplicitIndefinite(type) {
  const s = String(type || "").trim().toLowerCase();
  if (!s) return false;
  if (s === "trial" || s === "probation") return false;
  if (s === "indefinite" || s === "unlimited" || s === "open" || s === "open-ended") return true;
  return /غير\s*محدد/.test(s);
}

function addCalendarDays(iso, days) {
  const d = parseDay(iso);
  if (!d || !Number.isFinite(Number(days))) return "";
  d.setDate(d.getDate() + Number(days));
  return localDateKey(d);
}

/** Article 55 — confirmed Saudi, expired fixed term, continued without a written future end. */
function saudiArt55ConvertsExpired(input, today, resolvedEnd, type) {
  if (!isFixedTerm(type) || !resolvedEnd || !(String(today) > String(resolvedEnd))) return false;
  const identity = deriveSaudiStatus(input);
  if (identity.saudi !== true) return false;
  const row = input?.employee || input || {};
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

/**
 * Art. 37: Saudi may be indefinite (no end date) or fixed (end required).
 * Non-Saudi must be fixed; omitted duration is deemed one year from the start and renews alike.
 * Expired = hard named block. Within the 60-day window = named warning, not an assignment block.
 */
export function checkContractTermGate(input = {}) {
  const { type, endDate, startDate } = readContractTerm(input);
  const today = input.today || localDateKey();
  const identity = deriveSaudiStatus(input);
  const nonSaudi = identity.nationalitySaudi === false;
  if (nonSaudi && isExplicitIndefinite(type)) {
    return {
      ok: false,
      error: "CONTRACT_NONSAUDI_FIXED_REQUIRED",
      term: "fixed",
      reason: "موقوف — عقد غير السعودي مكتوب ومحدد المدة (المادة 37).",
      reasonEn: "Blocked — a non-Saudi contract must be written and fixed-term (Article 37).",
    };
  }
  const fixed = nonSaudi || isFixedTerm(type);
  if (!fixed) {
    return { ok: true, term: "indefinite", startDate: startDate || null, endDate: null };
  }
  let resolvedEnd = endDate;
  let deemed = false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedEnd)) {
    if (nonSaudi && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      resolvedEnd = addCalendarDays(startDate, ruleValue("contract.nonSaudi.deemedTermDays"));
      deemed = true;
    } else {
      return {
        ok: false,
        error: "CONTRACT_END_REQUIRED",
        term: "fixed",
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
        ok: true,
        warning: "ART55_CONVERTED",
        term: "indefinite",
        art55: true,
        previousEndDate: resolvedEnd,
        days,
        reason: "يُعد العقد غير محدد المدة وفق المادة 55 — يُكتب النوع في الملف.",
        reasonEn: "The contract is deemed indefinite under Article 55 — the file type is rewritten.",
      };
    }
    return {
      ok: false,
      error: "CONTRACT_EXPIRED",
      term: "fixed",
      endDate: resolvedEnd,
      deemed,
      days,
      reason: `موقوف — انتهى العقد محدد المدة في ${resolvedEnd}.`,
      reasonEn: `Blocked — the fixed-term contract ended on ${resolvedEnd}.`,
    };
  }
  if (deemed) {
    return {
      ok: true,
      warning: "CONTRACT_TERM_DEEMED_YEAR",
      term: "fixed",
      endDate: resolvedEnd,
      deemed: true,
      days,
      startDate: startDate || null,
      reason: `المادة 37 — إن لم تُذكر المدة عُدّ العقد سنة حتى ${resolvedEnd}.`,
      reasonEn: `Article 37 — omitted duration is deemed one year, ending ${resolvedEnd}.`,
    };
  }
  if (days != null && days <= EXPIRY_WARN_DAYS) {
    return {
      ok: true,
      warning: "CONTRACT_EXPIRING",
      term: "fixed",
      endDate: resolvedEnd,
      days,
      reason: `تنبيه — العقد محدد المدة ينتهي خلال ${days} يومًا (حد ${EXPIRY_WARN_DAYS}).`,
      reasonEn: `Watch — the fixed-term contract ends in ${days} days (${EXPIRY_WARN_DAYS}-day window).`,
    };
  }
  return { ok: true, term: "fixed", endDate: resolvedEnd, days, startDate: startDate || null };
}

export function deriveExpiringDocs(employees, today = localDateKey()) {
  const out = [];
  for (const emp of employees || []) {
    out.push(...collectEmployeeValidityDocs(emp, today));
  }
  return mergeValidityDocRows(out);
}

export function deriveNitaqat(employees) {
  const list = (employees || []).filter(Boolean);
  const statuses = list.map((e) => deriveSaudiStatus(e));
  const total = list.length;
  const saudi = statuses.filter((s) => s.countable && s.saudi).length;
  const mismatch = statuses.filter((s) => s.mismatch).length;
  const needsNationality = statuses.filter((s) => s.needsNationality).length;
  const unresolved = statuses.filter((s) => s.unresolved).length;
  const rate = total > 0 ? Math.round((saudi / total) * 1000) / 10 : 0;
  let band = "red";
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

export const NITAQAT_BAND_LABELS = {
  red: { ar: "أحمر", en: "Red" },
  low_green: { ar: "أخضر منخفض", en: "Low green" },
  mid_green: { ar: "أخضر متوسط", en: "Mid green" },
  high_green: { ar: "أخضر مرتفع", en: "High green" },
  platinum: { ar: "بلاتيني", en: "Platinum" },
};

export function nitaqatBandLabel(band, ar) {
  const row = NITAQAT_BAND_LABELS[band] || NITAQAT_BAND_LABELS.red;
  return ar ? row.ar : row.en;
}

export function checkNitaqatHireGate(input) {
  const band = input.nitaqat.band;
  if (band === "red" || band === "low_green") {
    if (!input.candidateSaudi && !input.nitaqatEffectStated) {
      const label = nitaqatBandLabel(band, true);
      const labelEn = nitaqatBandLabel(band, false);
      return {
        ok: false,
        error: "NITAQAT_EFFECT_REQUIRED",
        band,
        reason: `نطاق ${label} — يلزم بيان أثر التوظيف على السعودة قبل النشر/التعيين.`,
        reasonEn: `${labelEn} band — state the Saudization effect before posting/hiring.`,
      };
    }
  }
  return { ok: true, band };
}

export function deriveGosiMonthly(lines, establishmentNumber) {
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

export function checkGosiFileGate(input) {
  if (!String(input.establishmentNumber || "").trim()) {
    return {
      ok: false,
      error: "GOSI_ESTABLISHMENT_REQUIRED",
      reason: "يلزم رقم منشأة التأمينات في إعدادات الشركة قبل ملف GOSI الشهري.",
      reasonEn: "A GOSI establishment number is required in company settings before the monthly GOSI file.",
    };
  }
  const missing = (input.rows || []).filter((r) => !String(r.gosiNumber || "").trim());
  if (missing.length) {
    return {
      ok: false,
      error: "GOSI_NUMBER_MISSING",
      reason: `${missing.length} موظف بلا رقم تأمينات — أكمل الملف النظامي.`,
      reasonEn: `${missing.length} employees missing a GOSI number — complete the statutory file.`,
      count: missing.length,
    };
  }
  return { ok: true };
}

export function buildWpsFileRows(lines) {
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
      channel: "mudad",
    };
  });
}

/** Named blockers for one Mudad file row — file-ready, not live send. */
export function wpsRowBlockers(row, ar) {
  const reasons = [];
  if (!/^\d{10}$/.test(row?.nationalId || "")) reasons.push(ar ? "هوية غير مكتملة (10 أرقام)" : "ID incomplete (10 digits)");
  if (!/^SA\d{22}$/.test(row?.iban || "")) reasons.push(ar ? "آيبان غير مكتمل (SA + 22)" : "IBAN incomplete (SA + 22)");
  if (!row?.qiwaMatch) reasons.push(ar ? "أجر قوى غير مطابق" : "Qiwa wage mismatch");
  return reasons;
}

export function checkWpsFileGate(rows) {
  const list = rows || [];
  if (!list.length) {
    return { ok: false, error: "WPS_EMPTY", reason: "لا صفوف لملف WPS.", reasonEn: "No rows for the WPS file." };
  }
  for (const row of list) {
    if (!/^\d{10}$/.test(row.nationalId)) {
      return {
        ok: false,
        error: "NATIONAL_ID_INVALID",
        employeeId: row.employeeId,
        reason: `هوية غير صالحة لـ ${row.employeeName || row.employeeId} — يلزم 10 أرقام.`,
        reasonEn: `Invalid national ID for ${row.employeeName || row.employeeId} — 10 digits required.`,
      };
    }
    if (!/^SA\d{22}$/.test(row.iban)) {
      return {
        ok: false,
        error: "IBAN_INVALID",
        employeeId: row.employeeId,
        reason: `آيبان غير صالح لـ ${row.employeeName || row.employeeId} — صيغة SA + 22 رقمًا.`,
        reasonEn: `Invalid IBAN for ${row.employeeName || row.employeeId} — SA + 22 digits.`,
      };
    }
    if (!row.qiwaMatch) {
      return {
        ok: false,
        error: "QIWA_MISMATCH",
        employeeId: row.employeeId,
        reason: `عدم تطابق أجر قوى لـ ${row.employeeName || row.employeeId} — الملف غير جاهز.`,
        reasonEn: `Qiwa wage mismatch for ${row.employeeName || row.employeeId} — file not ready.`,
      };
    }
  }
  return { ok: true, channel: "mudad", rowCount: list.length };
}
