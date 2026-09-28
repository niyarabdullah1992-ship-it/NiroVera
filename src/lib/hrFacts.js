/**
 * Backward-compatible facade for the first-pass HR wage / GOSI facts.
 * Canonical package: src/lib/facts/ (see facts/index.js).
 *
 * Company establishment (رقم منشأة التأمينات) is company.gosiEstablishment.
 * Employee subscriber number (رقم المشترك) is profile.gosiNumber.
 * profile.gosiRegisteredAt is the person's first GOSI registration.
 * Hire date is a different fact and is never read as that registration.
 */

export {
  PREVIEW_OWNER_EMPLOYEE_ID,
  PREVIEW_ESTABLISHMENT_NUMBER,
  GOSI_NEW_LAW_FROM,
  WAGE_FIELD_KEYS,
  HR_FACTS,
  factById,
  writerRoles,
  mayWrite,
  gosiRegistrationIso,
  gosiSubscriberClass,
  readCompanyEstablishment,
  writeCompanyEstablishment,
  readSubscriberNumber,
  readGosiRegisteredAt,
  registrationForPayroll,
  readNationality,
  assignNationality,
  readWageFields,
  assignWageFields,
  canonicalizeGosiFacts,
} from "./facts/index.js";
