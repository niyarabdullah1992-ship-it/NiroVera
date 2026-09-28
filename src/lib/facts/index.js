/**
 * Platform facts layer — one home, one writer, companyId isolation, Arabic meaning.
 *
 * Layout:
 *   writers.js      named writer lanes + roles
 *   company.js      establishment / plan / settings
 *   people.js       employee file, wage, GOSI registration
 *   org.js          stations, orgTree, header scope
 *   attendance.js   punches → overtime → payroll
 *   payroll.js      derived lines (قسيمتي)
 *   money.js        expenses / assets / inventory
 *   requests.js     leave + other (nested on employees)
 *   discipline.js   cases + arbitration
 *   voice.js        anonymous / public complaints
 *   performance.js  scores / targets
 *   safety.js       HSE logs
 *   proof.js        Proof Cycle 2–4, 6
 *   signing.js      Proof Cycle 5
 *   notifications.js
 *   owner.js        /owner off suite rail
 *   migrate.js      named preview migrations
 *   catalog.js      PLATFORM_FACTS + HR_FACTS registry
 *
 * Companion schema map: base44/data/domains.jsonc
 * Backward facade: src/lib/hrFacts.js re-exports people + company wage/GOSI API.
 */

export {
  WRITER_ROLES,
  rolesForWriter,
} from "./writers.js";

export {
  COMPANY_FACTS,
  readCompanyEstablishment,
  writeCompanyEstablishment,
  readCompanyId,
  assertSameCompany,
} from "./company.js";

export {
  PREVIEW_OWNER_EMPLOYEE_ID,
  PREVIEW_ESTABLISHMENT_NUMBER,
  GOSI_NEW_LAW_FROM,
  WAGE_FIELD_KEYS,
  PEOPLE_FACTS,
  gosiRegistrationIso,
  gosiSubscriberClass,
  readSubscriberNumber,
  readGosiRegisteredAt,
  registrationForPayroll,
  readNationality,
  assignNationality,
  readWageFields,
  assignWageFields,
  canonicalizeGosiFacts,
} from "./people.js";

export {
  ORG_FACTS,
  readStations,
  readOrgTree,
  readOrgSeats,
  resolveOrgGraph,
} from "./org.js";

export {
  ATTENDANCE_FACTS,
  readPersonalAttendance,
  readSchedules,
  attendanceForCompany,
} from "./attendance.js";

export {
  PAYROLL_FACTS,
  readPayrollRuns,
  emptyMoneyDisplay,
} from "./payroll.js";

export {
  MONEY_FACTS,
  readExpenseClaims,
  readStationBudgets,
  readAssets,
  readAssetCustody,
  readInventoryItems,
  readStockMovements,
  readMaterialRequests,
  locationBalancesOf,
  totalQtyFromBalances,
  qtyAtLocation,
  syncItemQuantityFromBalances,
  adjustLocationBalance,
  assetsHeldBy,
  expenseClaimsBy,
} from "./money.js";

export {
  REQUEST_FACTS,
  readLeaveRequests,
  readOtherRequests,
  allLeaveRequests,
  allOtherRequests,
} from "./requests.js";

export {
  DISCIPLINE_FACTS,
  readDisciplinaryCases,
  casesForEmployee,
} from "./discipline.js";

export {
  VOICE_FACTS,
  readAnonymousReports,
  readPublicReports,
  readBranchEscalationSla,
  readBranchEscalationChains,
} from "./voice.js";

export {
  PERFORMANCE_FACTS,
  readTargets,
  readHcmPerformance,
  readHcmFoundation,
} from "./performance.js";

export {
  SAFETY_FACTS,
  readSafety,
} from "./safety.js";

export {
  PROOF_FACTS,
  RETIRED_PROOF_ENTITIES,
  readTasks,
  readWorkProofs,
  readVisitorProofs,
  readReports,
  workProofsForStation,
  assertWorkProofBlobHome,
} from "./proof.js";

export {
  SIGNING_FACTS,
  readSignatureRequests,
  readSignedDocRegistry,
  readFiles,
} from "./signing.js";

export {
  NOTIFICATION_FACTS,
  readNotifications,
  notificationsForUser,
} from "./notifications.js";

export { OWNER_FACTS } from "./owner.js";

export {
  PLATFORM_MIGRATION_IDS,
  migrateLegacyBagsOnce,
  stripRetiredDoNotWriteKeys,
  canonicalizePlatformFacts,
  migratePlatformFactHomes,
  platformMigrationReport,
} from "./migrate.js";

export {
  HR_FACTS,
  PLATFORM_FACTS,
  DOMAIN_MODULES,
  factById,
  factsForDomain,
  writerRoles,
  mayWrite,
  isDerivedFact,
  primaryHome,
  domainTable,
} from "./catalog.js";
