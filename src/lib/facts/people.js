/**
 * People / employee file / wage / GOSI registration.
 * Hire date is never read as GOSI registration.
 */

import { readCompanyEstablishment } from "./company.js";

export const PREVIEW_OWNER_EMPLOYEE_ID = "emp_owner_preview";
/** This preview company's establishment subscription. Not a subscriber number. */
export const PREVIEW_ESTABLISHMENT_NUMBER = "634647848";

/** First GOSI registration on or after this day is a new subscriber. */
export const GOSI_NEW_LAW_FROM = "2024-07-03";

export const WAGE_FIELD_KEYS = Object.freeze([
  "baseSalary",
  "housingAllowance",
  "transportAllowance",
  "otherAllowances",
  "allowances",
]);

export const PEOPLE_FACTS = Object.freeze([
  {
    id: "employee.id",
    domain: "people",
    scope: "employee",
    home: "Employee.id / employeeId",
    path: "id",
    writer: "hr-file",
    stored: true,
    isolation: "companyId",
    surfaceAr: "ملف الموظف",
    noteAr: "معرّف الجلسة userId هو employeeId.",
  },
  {
    id: "employee.hireDate",
    domain: "people",
    scope: "employee",
    home: "employee.hireDate | profile.hireDate",
    path: "hireDate",
    writer: "hr-file",
    stored: true,
    isolation: "companyId",
    surfaceAr: "العقد والأجر",
    noteAr: "تاريخ التعيين. ليس تاريخ تسجيل التأمينات.",
    distinctFrom: "employee.gosiRegisteredAt",
  },
  {
    id: "employee.subscriber",
    domain: "people",
    scope: "employee",
    home: "profile.gosiNumber",
    path: "profile.gosiNumber",
    writer: "hr-file",
    stored: true,
    isolation: "companyId",
    surfaceAr: "العقد والأجر",
    noteAr: "رقم المشترك. ليس رقم المنشأة.",
  },
  {
    id: "employee.gosiRegisteredAt",
    domain: "people",
    scope: "employee",
    home: "profile.gosiRegisteredAt",
    path: "profile.gosiRegisteredAt",
    writer: "hr-file",
    stored: true,
    isolation: "companyId",
    surfaceAr: "العقد والأجر",
    distinctFrom: "hireDate",
    noteAr: "تاريخ التسجيل في التأمينات. تاريخ التعيين لا يملأه.",
  },
  {
    id: "employee.nationality",
    domain: "people",
    scope: "employee",
    home: "profile.nationality",
    path: "profile.nationality",
    readFallback: "nationality",
    writer: "hr-file",
    stored: true,
    isolation: "companyId",
  },
  {
    id: "employee.baseSalary",
    domain: "people",
    scope: "employee",
    home: "profile.baseSalary",
    path: "profile.baseSalary",
    writer: "hr-wage",
    stored: true,
    isolation: "companyId",
    surfaceAr: "العقد والأجر",
  },
  {
    id: "employee.housingAllowance",
    domain: "people",
    scope: "employee",
    home: "profile.housingAllowance",
    path: "profile.housingAllowance",
    writer: "hr-wage",
    stored: true,
    isolation: "companyId",
    surfaceAr: "العقد والأجر",
  },
  {
    id: "employee.transportAllowance",
    domain: "people",
    scope: "employee",
    home: "profile.transportAllowance",
    path: "profile.transportAllowance",
    writer: "hr-wage",
    stored: true,
    isolation: "companyId",
    surfaceAr: "العقد والأجر",
  },
  {
    id: "employee.otherAllowances",
    domain: "people",
    scope: "employee",
    home: "profile.otherAllowances",
    path: "profile.otherAllowances",
    writer: "hr-wage",
    stored: true,
    isolation: "companyId",
    surfaceAr: "العقد والأجر",
  },
  {
    id: "employee.stationId",
    domain: "people",
    scope: "employee",
    home: "employee.stationId",
    path: "stationId",
    writer: "hr-file",
    stored: true,
    isolation: "companyId",
    surfaceAr: "التعيين",
    noteAr: "مكان العمل الحالي → Station.id.",
  },
  {
    id: "statute.employeeRate",
    domain: "people",
    scope: "statute",
    home: "laborRules.compliance.gosi.employeeRate",
    ruleId: "compliance.gosi.employeeRate",
    writer: "statute",
    stored: false,
    isolation: null,
    noteAr: "حصة المشترك القديم 9.75٪. تُطبَّق أيضاً إذا خلا تاريخ التسجيل.",
  },
  {
    id: "statute.employerRate",
    domain: "people",
    scope: "statute",
    home: "laborRules.compliance.gosi.employerRate",
    ruleId: "compliance.gosi.employerRate",
    writer: "statute",
    stored: false,
    isolation: null,
    noteAr: "حصة صاحب العمل للمشترك القديم 11.75٪.",
  },
  {
    id: "statute.newAnnuity",
    domain: "people",
    scope: "statute",
    home: "laborRules.compliance.gosi.newAnnuityRate",
    ruleId: "compliance.gosi.newAnnuityRate",
    writer: "statute",
    stored: false,
    isolation: null,
    noteAr: "جدول المعاشات للمشترك الجديد. لا يُحرَّر من لوحة المالك.",
  },
]);

/** ISO day only. Anything else, including a hire date passed by mistake, is empty. */
export function gosiRegistrationIso(value) {
  const text = String(value ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

/** old | new | unset. An empty date is unset, and unset is not new. */
export function gosiSubscriberClass(registeredAt) {
  const iso = gosiRegistrationIso(registeredAt);
  if (!iso) return "unset";
  return iso < GOSI_NEW_LAW_FROM ? "old" : "new";
}

export function readSubscriberNumber(employee) {
  return String(employee?.profile?.gosiNumber ?? "").trim();
}

/** Person's first GOSI registration. Hire date, start date, and createdAt are not this field. */
export function readGosiRegisteredAt(employee) {
  return gosiRegistrationIso(employee?.profile?.gosiRegisteredAt);
}

/**
 * Registration used when quoting a line.
 * The employee file wins. A stored line copy is only a fallback snapshot.
 * Hire date is never consulted.
 */
export function registrationForPayroll(employee, line) {
  const fromPerson = readGosiRegisteredAt(employee);
  if (fromPerson) return fromPerson;
  return gosiRegistrationIso(line?.gosiRegisteredAt);
}

export function readNationality(employee) {
  return String(employee?.profile?.nationality || employee?.nationality || "").trim();
}

export function assignNationality(employee, value) {
  if (!employee || typeof employee !== "object") return employee;
  const profile = employee.profile && typeof employee.profile === "object" ? employee.profile : (employee.profile = {});
  profile.nationality = String(value ?? "").trim();
  return employee;
}

export function readWageFields(employee) {
  const profile = employee?.profile || {};
  return {
    nationality: readNationality(employee),
    baseSalary: profile.baseSalary ?? "",
    housingAllowance: profile.housingAllowance ?? "",
    transportAllowance: profile.transportAllowance ?? "",
    otherAllowances: profile.otherAllowances ?? "",
    allowances: profile.allowances ?? "",
    gosiNumber: readSubscriberNumber(employee),
    gosiRegisteredAt: readGosiRegisteredAt(employee),
  };
}

export function assignWageFields(profile, fields = {}) {
  if (!profile || typeof profile !== "object") return profile;
  for (const key of WAGE_FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
    const raw = fields[key];
    if (raw === "" || raw == null) {
      profile[key] = "";
      continue;
    }
    const amount = Number(raw);
    profile[key] = Number.isFinite(amount) ? amount : raw;
  }
  return profile;
}

function normalizeStoredRegistration(profile) {
  if (!profile || !Object.prototype.hasOwnProperty.call(profile, "gosiRegisteredAt")) return false;
  const iso = gosiRegistrationIso(profile.gosiRegisteredAt);
  if (profile.gosiRegisteredAt === iso) return false;
  profile.gosiRegisteredAt = iso;
  return true;
}

/**
 * One company field for the establishment number.
 * Lifts a nested settings copy, and takes 634647848 off the preview owner
 * when a trial stored the establishment on profile.gosiNumber.
 * Does not invent gosiRegisteredAt.
 */
export function canonicalizeGosiFacts(company) {
  if (!company || typeof company !== "object") return false;
  let changed = false;
  if (company.settings && Object.prototype.hasOwnProperty.call(company.settings, "gosiEstablishment")) {
    const nested = String(company.settings.gosiEstablishment || "").trim();
    if (!String(company.gosiEstablishment || "").trim() && nested) company.gosiEstablishment = nested;
    delete company.settings.gosiEstablishment;
    changed = true;
  }
  const owner = (company.employees || []).find((row) => row?.id === PREVIEW_OWNER_EMPLOYEE_ID);
  const ownerNumber = String(owner?.profile?.gosiNumber ?? "").trim();
  if (owner?.profile && ownerNumber === PREVIEW_ESTABLISHMENT_NUMBER) {
    delete owner.profile.gosiNumber;
    if (!String(company.gosiEstablishment || "").trim()) company.gosiEstablishment = PREVIEW_ESTABLISHMENT_NUMBER;
    changed = true;
  }
  const establishment = readCompanyEstablishment(company);
  for (const employee of company.employees || []) {
    const profile = employee?.profile;
    if (!profile) continue;
    if (normalizeStoredRegistration(profile)) changed = true;
    const subscriber = String(profile.gosiNumber ?? "").trim();
    if (establishment && subscriber && subscriber === establishment) {
      delete profile.gosiNumber;
      changed = true;
    }
  }
  return changed;
}
