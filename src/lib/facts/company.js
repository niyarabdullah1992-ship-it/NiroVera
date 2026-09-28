/**
 * Company / compliance / establishment facts.
 * Tenant envelope lives on CompanyAccount + companyMeta; isolation is companyId.
 */

export const COMPANY_FACTS = Object.freeze([
  {
    id: "company.id",
    domain: "company",
    scope: "company",
    home: "CompanyAccount.companyId",
    path: "id",
    writer: "owner-board",
    stored: true,
    isolation: "companyId",
    surfaceAr: "حساب الشركة",
    noteAr: "مفتاح العزل لكل صف تابع. لا يُنسخ عبر شركات.",
  },
  {
    id: "company.name",
    domain: "company",
    scope: "company",
    home: "companyMeta / store.name",
    path: "name",
    writer: "owner-or-hr",
    stored: true,
    isolation: "companyId",
    surfaceAr: "إعدادات الشركة",
  },
  {
    id: "company.plan",
    domain: "company",
    scope: "company",
    home: "CompanyAccount.plan",
    path: "plan",
    writer: "owner-board",
    stored: true,
    isolation: "companyId",
    surfaceAr: "لوحة المالك",
    noteAr: "الاشتراك والمنصة — ليس مسار الجناح.",
  },
  {
    id: "company.establishment",
    domain: "company",
    scope: "company",
    home: "company.gosiEstablishment",
    path: "gosiEstablishment",
    writer: "owner-or-hr",
    stored: true,
    isolation: "companyId",
    surfaceAr: "امتثال الوزارة",
    noteAr: "رقم منشأة التأمينات. ليس رقم المشترك.",
  },
  {
    id: "company.settings",
    domain: "company",
    scope: "company",
    home: "companyMeta.settings",
    path: "settings",
    writer: "owner-or-hr",
    stored: true,
    isolation: "companyId",
    splitOf: null,
    legacyKeys: ["companySettings"],
    surfaceAr: "إعدادات الشركة",
    noteAr: "companySettings صومعة قديمة — قراءة مرة ثم الكتابة على companyMeta فقط.",
  },
  {
    id: "company.directorId",
    domain: "company",
    scope: "company",
    home: "store.directorId",
    path: "directorId",
    writer: "owner-or-hr",
    stored: true,
    isolation: "companyId",
    surfaceAr: "الهيكل",
    noteAr: "مدير العمليات. يشير إلى Employee.id.",
  },
  {
    id: "company.ownerId",
    domain: "company",
    scope: "company",
    home: "store.ownerId",
    path: "ownerId",
    writer: "owner-board",
    stored: true,
    isolation: "companyId",
    surfaceAr: "لوحة المالك",
  },
]);

export function readCompanyEstablishment(company) {
  const root = String(company?.gosiEstablishment ?? "").trim();
  if (root) return root;
  return String(company?.settings?.gosiEstablishment ?? "").trim();
}

export function writeCompanyEstablishment(company, number) {
  if (!company || typeof company !== "object") return false;
  const next = String(number ?? "").trim();
  if (!next) return false;
  company.gosiEstablishment = next;
  if (company.settings && Object.prototype.hasOwnProperty.call(company.settings, "gosiEstablishment")) {
    delete company.settings.gosiEstablishment;
  }
  return true;
}

export function readCompanyId(company) {
  return String(company?.id || company?.companyId || "").trim();
}

export function assertSameCompany(row, companyId) {
  const cid = String(companyId || "").trim();
  if (!cid || !row) return true;
  const rowCid = String(row.companyId || "").trim();
  return !rowCid || rowCid === cid;
}
