// PowerCare data layer — localStorage-based, multi-tenant with full company isolation.
// Registry tracks all companies; each company's data lives under its own key.
import { hoursPolicyOf } from "./laborHoursPolicy.js";
import { religionOnFile } from "./laborRules.js";
import { isFixedContractType, profileGender } from "./employeeProfileFields.js";
import { checkJobSearchHoursGate, ART81_CASES, ART81_EXIT_TYPE, DAMAGE_OBJECTION_TYPE, DOCUMENTS_RETURN_TYPE, GRIEVANCE_KINDS, GRIEVANCE_TYPE, LEAVE_CARRY_TYPE, NIGHT_AVOID_TYPE, damageObjectionDeadline, grievanceReplyBy, grievanceState } from "./rightsRequests.js";
import { MISSION_TYPE, MODEL_REQUEST_TYPES, PREVENTED_TYPE, RELOCATION_TYPE, checkModelRequestSubmit } from "./modelRequests.js";
import { daysAr, planLeaveCutForAttendance } from "./leaveCut.js";
import { checkPostponeResignationGate, checkWithdrawResignationGate, dueResignations, EXIT_ROUTE_NOTICE75, resignationFacts, resignationRouteFor, RESIGNATION_TYPE } from "./exitRequests.js";
import { checkGroundedRefusalGate, refusalGroundsFor, refusalWorkerLine } from "./statutoryRefusal.js";
import { isDutyRequestType, nursingHourOn, nursingRightUntil } from "./dutyRequests.js";
import { MANAGER_PERMISSIONS, ASSISTANT_PERMISSIONS, groupLevelsByOrder } from "./hrLevels";
import { base44 } from "@/api/base44Client";
import { sendEmailAlert } from "./emailAlerts";
import { isHrOnlyVoice, voiceHrReceivers } from "./voicePrivacy.js";
import { getUiLang } from "./dateFormat";
import { toRiyadhDateKey } from "./riyadhDate";
import { reconcileStationReferences } from "./stationConsistency";
import { clearStationScope } from "./stationScopeStore";
import { longShiftRestPatch, planDuplicateShiftMerge, shiftWindowKey } from "./shiftDerivations";
import { employeeWageSplit } from "./employeeFileView";
import { applyCopyMonthAssignments, publishedWeekSnapshot, restoreCutNightDays, checkShiftChangeApplyGate, checkWeekPublishGates, clearRosterLeaveGhostAssignments, cloneDayMap, employeeShiftOnDay, isNightWorker, monthDateKeys, nightAllowanceAmount, nightAllowanceKind, nightAllowancePayLabel, nightCutHoursLabel, nightReduceCutHours, payableNightAllowance, planCopyMonthAssignments, repairNightRestAssignments, resolveNightRestAssignTarget, shiftHours, weekDateKeys, weekKeyFromDate, weekStartDate, weekStartsInMonth } from "./shiftWeek";
import {
  applyNightWorkerDecision,
  checkDecideNightRemedyGate,
  checkNightAgreeGate,
  checkNightEmployeeActorGate,
  checkWithdrawNightConsentGate,
  checkWithdrawNightRemedyGate,
  nightScheduleFor,
  collectLapsedNightRotates,
  applyLapsedNightConsents,
  collectDueNightRotates,
  nightCycleKey,
  nightRotateRequestDraft,
  nightRotateStage,
  pendingNightRotate,
} from "./nightRotateCycle";
import { nightLapseAdminNotifyText, nightLapseNotifyText, planNightDueAdminNotifications, planNightDueNotifications } from "./nightDueNotify";
import { planHeatBanNotices } from "./heatBanNotify";
import { planDisciplineDeadlineNotices } from "./disciplineDeadlines";
import { planNecessityNotices } from "./consentEffects";
import { moveCompCreditsOutOfAnnual, planCompLeaveNotices, checkTakeCompLeaveGate, COMP_LEAVE_TYPE } from "./compLeave";
import { hoursAr as otHoursAr, otOffer, sar as otSar } from "./otOffer";
import { regulationDate } from "./workRegulation";
import { checkSelfDecideRequestGate, isCompanyHeadPerson, nightDueAdminAudience, requestNoticeAudience } from "./dutyScope";
import {
  annualEntitlementNoticeText,
  collectDueAnnualLeaveNotices,
  daysUntilLeaveStart,
  leaveDateSpanText,
  leaveDecisionNoticeText,
} from "./leaveEntitlementCycle";
import { calendarDateKey, dayAssignmentMap } from "./attendanceCalendar";
import { applyWorkplaceManagerRule, reportsToId, workplaceReportsToId } from "./peopleTreeGraph";
import { doaApproverIds } from "./orgDesign";
import { isWorkplaceStation } from "./stationTree";
import { appendOrgStructureEvent } from "./orgStructureLog";
import { annualCarryAlerts, anniversaryYearWindow, leaveCoverRange, leaveTypeLabel, remainingLeaveDays, statutoryLeaveFloor, unpaidSuspensionPlan } from "./leaveTypes";
import { EXAM_NOTICE_KIND, EXAM_SAT_KIND, LEAVE_ROSTER_BLOB, voidLegacyHolidayRequestsIn, chargeableLeaveDays, checkAlterApprovedLeaveGate, checkApproveLeaveGate, checkAttachExamSatGate, checkRejectLeaveGate, checkSeeLeaveDecisionGate, checkSubmitLeaveGate, computeLeaveDays, leaveDecisionNoticeKey, leaveRosterFromEmployees, planAnnualPauseForSick, checkIddahBirthGate, checkMaternityBirthGate, checkLeaveBreachGate } from "./leaveDerivations";
import { mergeEmployeeRequestBags, projectDirectoryEmployee, rosterEmployeeById } from "./employeeRequestBags";
import { LEAVE_TOPUP_TYPE, NIGHT_FITNESS_TYPE, STUDY_CONSENT_TYPE, appendRequestAudit, appendRequestRefuseAudit, buildRequestAudit, buildRequestRefuseAudit, checkAdminLeaveCreditGate, checkApproveOtherRequestGate, checkApproveStudyConsentGate, checkLeaveGrantGate, checkRefuseRequestReasonGate, checkRejectNightFitnessGate, checkRejectStudyConsentGate, checkRevokeStudyConsentGate, checkSubmitOtherRequestGate, composeStudyConsentReason, otherRequestTypeLabel, requestAuditFileLog, leaveGrantRecord, requestRefuseFileLog, stampLeaveTopupOnEmployee, stampNightFitnessOnEmployee } from "./otherRequestDerivations";
import {
  attendanceOnDate,
  buildManualAttendanceRow,
  checkManualTimeGate,
  checkPunchRecordGate,
  clockFromPunchReason,
  isEarlyCheckoutAt,
  manualPunchLateness,
  parsePunchClock,
  toCloudAttendanceRow,
} from "./attendancePunch";
import {
  OT_STATUS,
  checkApproveOtAssignmentGate,
  checkEmployeeAcceptOtGate,
  checkManagerRejectOtGate,
  checkRaiseOtAssignmentGate,
  checkRefuseOtAssignmentGate,
  isOvertimeAssignment,
  otCreditDays,
  stampOvertimeCreditOnEmployee,
  stampOvertimePayOnDraft,
} from "./overtimeAssignment";
import { earlyLeaveMinutesOf, getShiftOnDate, overtimeYearUsageOutsideAssignments } from "./attendanceDerivations";
import { employeeRosterOtContext } from "./shiftWeek";
import { damageCaseIdFor } from "./payrollLaw.js";
import { absorbAssignmentIntoActualOt, planOtDecision, restampWeekAfter, stampActualDutyBreaches, stampActualOvertime, stampHolidayWorkOvertime, withdrawHolidayWorkOvertime } from "./otDecisionPlan.js";
import { planDutyAlertNotices } from "./dutyAlerts.js";
import { compLeaveDaysInYear as compLeaveDaysInYearForCap, otHoursInYear as otHoursInYearForCap } from "./overtimeAssignment.js";
import { annualDayBreakdown } from "./leaveEidOverlap.js";
import { employeeFileEditGate } from "./employeeFileRights.js";
import { checkDecideFileCorrectionGate, fileCorrectionCurrent, fileCorrectionField, fileCorrectionPatch, fileCorrectionSummary, FILE_CORRECTION_TYPE } from "./fileCorrection.js";
import { isOfficialHoliday, laborCalendarOf, ramadanWindowForYear, readPlatformOwnerBoard, writePlatformOwnerBoard } from "./ummAlQuraCalendar";

/** Model regulation Art. 71 clocks skip the company's official holidays. */
function officialHolidayTest(data) {
  const cal = laborCalendarOf(data);
  return (iso) => isOfficialHoliday(iso, cal);
}
import { dashboardSubscription, platformOwnerGate, persistHolidayRulings, persistRamadanRuling, persistSubscriptionPlans } from "./ownerBoard";
import { addLaborDays, ruleValue } from "./laborRules";
import { art55FilePatch, laborFilePatch } from "./contractLawDerivations";
import { migratePreviewRotaClock, migratePreviewWeekRota, migratePreviewOwnerMorningRota, migratePreviewCompanyHeadWorkplace, migratePreviewVoiceBranchManager, migratePreviewSigningNotices, migratePreviewEmployeeGenders, migratePreviewOwnerGosiIdentity, migratePreviewGosiEstablishment, migratePreviewFieldTasks, seedPreviewOwnerNightStreak, seedPreviewAttendanceHistory, seedPreviewProofCycle, seedPreviewWrittenConsent, seedPreviewDiscipline, seedPreviewVoice, seedPreviewPerformance, seedPreviewOrgDesign } from "./previewMigrations";
import { readCompanyEstablishment } from "./facts/company.js";
import { canonicalizePlatformFacts } from "./facts/migrate.js";
import { assignEmployeeNumber, ensureEmployeeNumbers } from "./employeeNumber";
import { migratePreviewStationPins } from "./previewStationPins";
import { attachSharedGradesToTitles, ensureProductLadder } from "./jobGradeTitles";
import { assertWritableCategory, isDoNotWrite, isServerActionCategory, normalizeBlobPayload, pushableBlobCategories } from "./canonicalStore";
import { applyEmployerDutyRoster, employerDutyRosterFromEmployees } from "./syncLaw.js";
import { applyPendingStages, readOutbox as readDisciplineOutbox } from "./disciplineOutbox.js";
import { visibleArbitrationOutcomes } from "./arbitrationEngine";
import {
  WRITTEN_CONSENT_TYPE,
  checkAcceptConsentGate,
  checkRaiseConsentGate,
  checkRefuseConsentGate,
  consentPdfName,
  consentSignerEmail,
  consentSignerSpot,
  consentTopicMeta,
  findConsentBySigning,
  isWrittenConsent,
  savedConsentSeals,
} from "./writtenConsent";
import {
  findSignableBySigning,
  hasOpenRequestSigning,
  isLetterSignableType,
  requestSignerSpot,
} from "./requestSigning";
import { defaultConsentMark, normalizeSignMark } from "./documentReadGate";
import { generateVerificationId } from "./verificationBadge";
import { applyCreate } from "./multiSignDerivations";

const REGISTRY_KEY = "powercare_registry";
const COMPANY_PREFIX = "powercare_company_";
const SESSION_KEY = "powercare_session";
// Legacy identifier retained only so older stored records can be migrated safely.
// It no longer creates, protects, sorts, or otherwise privileges any station.
export const HQ_STATION_ID = "hq";
// Kept as literals here (instead of importing from lib/localPreview) because
// localPreview imports this module — importing back would be circular.
const LOCAL_PREVIEW_COMPANY = "local-preview-nirovera";
const LOCAL_PREVIEW_KEY = "powercare_local_preview";

function isLocalPreviewWorkspace(companyId) {
  if (companyId === LOCAL_PREVIEW_COMPANY) return true;
  try {
    return localStorage.getItem(LOCAL_PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

/* ----------------------------- helpers ----------------------------- */
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
// Local cache writes must never throw: a full localStorage quota would otherwise
// bubble a raw exception into React and lose the user's work with no message.
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Quota exceeded — drop the oldest cached company workspaces, then retry once.
    const stale = Object.keys(localStorage).filter((item) => item.startsWith(COMPANY_PREFIX) && item !== key);
    for (const item of stale.slice(0, Math.max(1, stale.length - 1))) localStorage.removeItem(item);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("powercare:storage-full", { detail: error?.name || "QuotaExceededError" }));
      }
    }
  }
  notify();
}
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

/* ----------------------------- cloud auth tokens ----------------------------- */
// Per-company session tokens issued by the backend at login. Every companyDirectory
// call attaches the matching token so the server can authorize company-scoped actions.
const TOKENS_KEY = "powercare_tokens";
export function getCompanyToken(companyId) {
  return read(TOKENS_KEY, {})[companyId] || null;
}
export async function sendPresenceHeartbeat(companyId) {
  if (!companyId) return;
  await invokeDirectory({ action: "presenceHeartbeat", companyId });
}
export async function getOnlineEmployeeIds(companyId) {
  if (!companyId) return [];
  const res = await invokeDirectory({ action: "getOnlineEmployees", companyId });
  return res?.data?.employeeIds || [];
}
function setCompanyToken(companyId, token) {
  if (!companyId || !token) return;
  const map = read(TOKENS_KEY, {});
  map[companyId] = token;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(map));
}
function invokeDirectory(payload) {
  const companyId = payload.companyId || read(SESSION_KEY, null)?.companyId;
  return base44.functions.invoke("companyDirectory", { ...payload, sessionToken: companyId ? getCompanyToken(companyId) : null });
}

function invokeWorkforce(payload) {
  const companyId = payload.companyId || read(SESSION_KEY, null)?.companyId;
  if (!companyId || isLocalPreviewWorkspace(companyId)) return Promise.resolve(null);
  return base44.functions.invoke("workforce", { ...payload, sessionToken: getCompanyToken(companyId) }).catch(() => null);
}

/* ----------------------------- audit trail ----------------------------- */
// Full audit trail: every sensitive mutation below logs who did what. The acting
// user's name is set by the auth provider whenever the session changes.
let auditActor = "system";
export function setAuditActor(name) {
  auditActor = name || "system";
}
function audit(companyId, action, details, extra = {}) {
  const safeDetails = String(details || extra.details || "").slice(0, 1000);
  invokeDirectory({
    action: "logAudit",
    companyId,
    auditAction: action,
    performedBy: extra.performedBy || auditActor,
    details: safeDetails,
    reason: extra.reason || null,
    oldValue: extra.oldValue || null,
    newValue: extra.newValue || null,
  }).catch(() => {});
}
export function logAudit(companyId, action, details, extra = {}) {
  audit(companyId, action, details, extra);
}

function stampRequestAudit(companyId, employee, request, { actor, note, family, verb } = {}) {
  const row = buildRequestAudit({
    actor: actor || auditActor,
    employeeId: employee?.id,
    employeeName: employee?.name,
    request,
    family,
    verb: verb || "refuse",
    reason: note,
  });
  audit(companyId, row.action, row.details, row);
  return { row, log: requestAuditFileLog(row, true) };
}

function stampRefuseAudit(companyId, employee, request, { actor, note, family } = {}) {
  const row = buildRequestRefuseAudit({
    actor: actor || auditActor,
    employeeId: employee?.id,
    employeeName: employee?.name,
    request,
    family,
    reason: note,
  });
  audit(companyId, row.action, row.details, row);
  return { row, log: requestRefuseFileLog(row, true) };
}

function pushEmployeeFileLog(employee, log) {
  if (!employee || !log) return;
  employee.fileLog = [log, ...(employee.fileLog || [])].slice(0, 40);
}
// The lowest-order HR manager assigned to handle this employee's station (falls
// back up through cluster/company tiers if no station-level manager is assigned).
function getStationHRManager(data, employeeId) {
  const emp = data.employees.find((e) => e.id === employeeId);
  if (!emp) return null;
  const positions = data.smartPositions || [];
  const hasHr = (id) => positions.find((item) => item.employeeId === id)?.permissions?.hr === "manage";
  const stations = data.stations || [];
  const byId = new Map(stations.map((station) => [String(station.id || station.stationId), station]));
  let sid = String(emp.stationId || "");
  const seenStations = new Set();
  while (sid && !seenStations.has(sid)) {
    seenStations.add(sid);
    const station = byId.get(sid);
    const managerId = String(station?.managerId || "").trim();
    if (managerId && managerId !== String(employeeId) && hasHr(managerId)) {
      return data.employees.find((employee) => employee.id === managerId) || null;
    }
    sid = String(station?.parentStationId || station?.parentBranchId || "").trim();
  }
  const nodes = data.orgTree || [];
  let node = nodes.find((item) => item.type === "employee" && item.refId === employeeId);
  while (node?.parentId) {
    node = nodes.find((item) => item.id === node.parentId);
    if (node?.type !== "employee") continue;
    const permissions = positions.find((item) => item.employeeId === node.refId)?.permissions || {};
    if (permissions.hr === "manage") return data.employees.find((employee) => employee.id === node.refId) || null;
  }
  const stationFor = (startNode) => {
    let current = startNode;
    while (current) {
      if (current.type === "station") return current.id;
      current = nodes.find((item) => item.id === current.parentId);
    }
    return null;
  };
  const employeeNode = nodes.find((item) => item.type === "employee" && item.refId === employeeId);
  const employeeStationNodeId = stationFor(employeeNode);
  const stationHRNode = nodes.find((item) => item.type === "employee" && item.refId !== employeeId && stationFor(item) === employeeStationNodeId && positions.find((position) => position.employeeId === item.refId)?.permissions?.hr === "manage");
  if (stationHRNode) return data.employees.find((employee) => employee.id === stationHRNode.refId) || null;
  const employeeStationId = emp.stationId || data.stations?.[0]?.id || null;
  const groups = groupLevelsByOrder(data.hrLevels || []);
  for (const group of groups) {
    if (!group.manager) continue;
    const candidate = data.employees.find((e) => {
      if (e.hrLevelId !== group.manager.id) return false;
      if (group.scope === "station") return e.hrStationId === employeeStationId;
      if (group.scope === "cluster") {
        const cluster = (data.hrClusters || []).find((c) => (c.stationIds || []).includes(employeeStationId));
        return cluster ? e.hrClusterId === cluster.id : false;
      }
      return true;
    });
    if (candidate) return candidate;
  }
  const station = (data.stations || []).find((row) => String(row.id || row.stationId) === String(emp.stationId || ""));
  const stationMgr = data.employees.find((row) => row.id === station?.managerId && row.id !== employeeId);
  if (stationMgr) return stationMgr;
  return data.employees.find((row) => row.id === data.directorId && row.id !== employeeId)
    || data.employees.find((row) => (row.role === "director" || row.role === "ops_manager") && row.id !== employeeId)
    || null;
}

function hashId(seed) {
  // simple non-reversible hash for anonymous ids
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return "ANON-" + Math.abs(h).toString(16).toUpperCase().padStart(8, "0");
}
// Rotating anonymous code for an employee — changes automatically every 30 days.
export function getAnonymousCode(employeeId, atDate = new Date()) {
  const period = Math.floor(atDate.getTime() / (86400000 * 30));
  return hashId(`${employeeId}_${period}`);
}

/* ----------------------------- pub/sub ----------------------------- */
const listeners = new Set();
function notify() {
  listeners.forEach((fn) => fn());
}
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ----------------------------- registry ----------------------------- */
export function getRegistry() {
  const registry = read(REGISTRY_KEY, { companies: [] });
  const sanitized = {
    ...registry,
    companies: (registry.companies || []).map(({ ownerPassword: _password, ...company }) => company),
  };
  if (JSON.stringify(registry) !== JSON.stringify(sanitized)) {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(sanitized));
  }
  return sanitized;
}
function saveRegistry(reg) {
  write(REGISTRY_KEY, {
    ...reg,
    companies: (reg.companies || []).map(({ ownerPassword: _password, ...company }) => company),
  });
}
export function listCompanies() {
  return getRegistry().companies;
}
export function createCompany({ name, ownerEmail, ownerPassword, plan = "Starter", allowedEmailDomain = "", subscriptionStart = null, subscriptionEnd = null, orgType = "company" }, { sync = true } = {}) {
  const reg = getRegistry();
  const id = uid("comp");
  const kind = "company";
  const company = { id, name: name.trim(), ownerEmail: ownerEmail.trim().toLowerCase(), ownerPassword, plan, orgType: kind, allowedEmailDomain: allowedEmailDomain.trim(), subscriptionStart, subscriptionEnd, createdAt: new Date().toISOString() };
  reg.companies.push(company);
  saveRegistry(reg);
  // seed empty company workspace
  const data = emptyCompanyData(company);
  data.settings = { ...(data.settings || {}), orgType: kind };
  write(companyKey(id), data);
  if (sync) syncAccountToEntity(company);
  return company;
}

// Persists login credentials/metadata for a company so employees can log in from any
// device/browser, not just the one that created the company.
async function syncAccountToEntity(company, signupVerification = null) {
  try {
    const res = await invokeDirectory({
      action: "syncAccount",
      companyId: company.id,
      name: company.name,
      ownerEmail: company.ownerEmail,
      ownerPassword: company.ownerPassword,
      plan: company.plan,
      orgType: "company",
      allowedEmailDomain: company.allowedEmailDomain || "",
      subscriptionStart: company.subscriptionStart || null,
      subscriptionEnd: company.subscriptionEnd || null,
      signupPendingId: signupVerification?.pendingId || null,
      signupOtpCode: signupVerification?.code || null,
    });
    // Brand-new signups get an owner session token back — keep it for future calls.
    if (res?.data?.token) setCompanyToken(company.id, res.data.token);
    if (res?.data?.error === 'email_exists') return 'email_exists';
    return !!res?.data?.ok;
  } catch (err) {
    const code = err?.response?.data?.error || err?.data?.error || err?.message;
    if (code === 'email_exists') return 'email_exists';
    if (['invalid_code', 'invalid_or_expired', 'signup_otp_required'].includes(code)) return code;
    return false;
  }
}

export async function syncCompanyAccount(company, signupVerification = null) {
  return syncAccountToEntity(company, signupVerification);
}

export async function updateCompanyPlan(companyId, plan, subscriptionStart = null, subscriptionEnd = null) {
  const reg = getRegistry();
  const company = reg.companies.find((item) => item.id === companyId);
  if (!company) return false;
  company.plan = plan;
  company.subscriptionStart = subscriptionStart;
  company.subscriptionEnd = subscriptionEnd;
  saveRegistry(reg);
  const data = getCompanyData(companyId);
  if (data) localStorage.setItem(companyKey(companyId), JSON.stringify({ ...data, plan }));
  notify();
  return syncAccountToEntity(company);
}
// Rebuilds a missing local workspace so cloud hydration can repopulate it.
export function ensureLocalCompany(companyId) {
  if (getCompanyData(companyId)) return;
  const reg = getRegistry();
  let company = reg.companies.find((c) => c.id === companyId);
  if (!company) {
    company = { id: companyId, name: "", ownerEmail: "", plan: "", allowedEmailDomain: "", createdAt: new Date().toISOString() };
    reg.companies.push(company);
    saveRegistry(reg);
  }
  write(companyKey(companyId), emptyCompanyData(company));
}

// Checks whether this company account still exists on the server. Network
// failures return true so a connectivity blip never signs the user out.
export async function companyAccountExists(companyId) {
  // The local preview workspace only exists in this browser; asking the server
  // about it always answers "no" and would sign the preview session out.
  if (isLocalPreviewWorkspace(companyId)) return true;
  try {
    const res = await invokeDirectory({ action: "accountExists", companyId });
    const account = res?.data;
    if (account?.exists !== false) {
      const reg = getRegistry();
      const company = reg.companies.find((item) => item.id === companyId);
      if (company && account) {
        const localData = getCompanyData(companyId);
        if (localData) localStorage.setItem(companyKey(companyId), JSON.stringify({ ...localData, name: account.name || localData.name, plan: account.plan || localData.plan }));
        company.name = account.name || company.name;
        company.plan = account.plan || company.plan;
        company.subscriptionStart = account.subscriptionStart ?? null;
        company.subscriptionEnd = account.subscriptionEnd ?? null;
        saveRegistry(reg);
      }
    }
    return account?.exists !== false;
  } catch {
    return true;
  }
}

export function activateCompanySession(company) {
  const userId = ensureOwnerUser(company.id, company);
  if (!userId) return false;
  setSession({ companyId: company.id, userId });
  return true;
}

export function deleteCompany(id) {
  const reg = getRegistry();
  reg.companies = reg.companies.filter((c) => c.id !== id);
  saveRegistry(reg);
  localStorage.removeItem(companyKey(id));
}
export function getCompanyMeta(id) {
  return getRegistry().companies.find((c) => c.id === id) || null;
}

/** Company accounts are retained — platform never offers owner self-purge. */
export async function purgeCompanyAccount() {
  return false;
}

// Owner/director-controlled restriction: only emails ending in this domain may be added
// as employees for the company (e.g. "@acwa.com"). Empty/null = no restriction.
export function setAllowedEmailDomain(companyId, domain) {
  const reg = getRegistry();
  const c = reg.companies.find((x) => x.id === companyId);
  if (c) {
    c.allowedEmailDomain = (domain || "").trim();
    syncAccountToEntity(c);
  }
  saveRegistry(reg);
}

function companyKey(id) {
  return `${COMPANY_PREFIX}${id}`;
}

function emptyCompanyData(meta) {
  return {
    id: meta.id,
    name: meta.name,
    plan: meta.plan,
    directorId: null,   // user id of Operations Director
    ownerId: null,     // user id owning the company account
    stations: [],
    employees: [],
    tasks: [],
    reports: [],
    anonymousReports: [],
    publicReports: [],
    safety: [],
    files: [],
    plans: [],
    notifications: [],
    templates: [],
    targets: [],
    hrLevels: [],
    jobGrades: [],
    hrClusters: [],
    schedules: [],
    stationChatGroups: [],
    personalPlaces: [],
    personalAttendance: [],
    plannerItems: [],
    journalEntries: [],
    payrollRuns: [],
    smartPositions: [],
    permissionTemplates: [],
    orgSeats: [],
    orgStructureLog: [],
    complaintEscalationChain: [],
    branchEscalationChains: {},
    branchEscalationSla: {},
    workProofs: [],
    visitorProofs: [],
    disciplinaryCases: [],
    orgTree: [],
    arbitrationOutcomes: [],
    settings: { rateLimitDaily: 3, rateLimitWeekly: 10, rateLimitMonthly: 30, orgType: "company" },
  };
}

const COMPANY_ARRAY_KEYS = [
  "stations", "employees", "tasks", "reports", "anonymousReports", "publicReports",
  "safety", "files", "plans", "notifications", "templates", "targets", "hrLevels",
  "jobGrades", "hrClusters", "schedules", "stationChatGroups", "personalPlaces",
  "personalAttendance", "plannerItems", "journalEntries", "payrollRuns",
  "smartPositions", "permissionTemplates", "orgSeats", "orgStructureLog", "complaintEscalationChain", "workProofs", "visitorProofs", "disciplinaryCases",
  "orgTree", "arbitrationOutcomes",
  "signedDocRegistry", "signingFieldTemplates", "signatureRequests", "abuseCases",
];

function normalizeCompanyData(data) {
  if (!data || typeof data !== "object") return data;
  for (const key of COMPANY_ARRAY_KEYS) {
    if (!Array.isArray(data[key])) data[key] = [];
  }
  if (!data.branchEscalationChains || typeof data.branchEscalationChains !== "object") {
    data.branchEscalationChains = {};
  }
  if (!data.branchEscalationSla || typeof data.branchEscalationSla !== "object" || Array.isArray(data.branchEscalationSla)) {
    data.branchEscalationSla = {};
  }
  if (!data.settings || typeof data.settings !== "object") {
    data.settings = { rateLimitDaily: 3, rateLimitWeekly: 10, rateLimitMonthly: 30, orgType: "company" };
  }
  return data;
}

const PRESET_GRADE_TITLES = new Set(["مبتدئ", "متوسط", "أول", "مشرف", "مدير"]);

function purgePresetLadders(data) {
  const removed = new Set();
  const next = (data.jobGrades || []).filter((grade) => {
    const presetCode = PRESET_GRADE_TITLES.has(String(grade?.title || "").trim())
      && /^(TC|EN|HR|HS|FN|BM|LD|GR)\d+$/i.test(String(grade?.gradeNumber || "").trim());
    const legacy = /^grade_tc[1-5]$/i.test(String(grade?.id || ""));
    if (!presetCode && !legacy) return true;
    removed.add(grade.id);
    return false;
  });
  if (!removed.size) return false;
  data.jobGrades = next;
  (data.orgSeats || []).forEach((seat) => {
    if (removed.has(seat.gradeId)) seat.gradeId = "";
  });
  (data.employees || []).forEach((employee) => {
    if (employee?.profile && removed.has(employee.profile.gradeId)) employee.profile.gradeId = null;
  });
  return true;
}

/* ----------------------------- company data ----------------------------- */
/** Shift types past the ordinary day with no break mode chosen get the one-hour flex rest (longShiftRestPatch). */
function openLongShiftRests(data) {
  let changed = false;
  for (const schedule of data?.schedules || []) {
    for (const shift of schedule?.shiftTypes || []) {
      const patch = longShiftRestPatch(shift);
      if (patch) { Object.assign(shift, patch); changed = true; }
    }
  }
  return changed;
}

export function getCompanyData(id) {
  const data = normalizeCompanyData(read(companyKey(id), null));
  if (!data) return data;
  let persist = false;
  if (Object.prototype.hasOwnProperty.call(data, "cameras")) {
    delete data.cameras;
    persist = true;
  }
  if (purgePresetLadders(data)) persist = true;
  if (attachSharedGradesToTitles(data)) persist = true;
  if (ensureProductLadder(data)) persist = true;
  if (ensureEmployeeNumbers(data)) persist = true;
  if (canonicalizePlatformFacts(data)) persist = true;
  // Comp leave is its own balance (regs 22 bis) — undo old credits that went into annual leave.
  if (moveCompCreditsOutOfAnnual(data)) persist = true;
  // Art. 112: official holidays apply from the calendar — old pending «eid» requests need no decision.
  if (voidLegacyHolidayRequestsIn(data)) persist = true;
  // The platform rule: a shift longer than 8 hours opens a one-hour rest the worker places in بصمتي.
  if (openLongShiftRests(data)) persist = true;
  // Local preview used to seed compass names (شمال/شرق) — those were labels only,
  // not a forced region layer. Rewrite once so the org tree shows free branch names.
  if (isLocalPreviewWorkspace(id) && Array.isArray(data.stations)) {
    const renames = {
      "الفرع الشمالية": "فرع الخفجي",
      "الفرع الشرقية": "فرع رابغ",
    };
    let changed = false;
    data.stations = data.stations.map((st) => {
      const next = renames[st.name];
      if (!next) return st;
      changed = true;
      return { ...st, name: next };
    });
    if (changed) {
      data.tasks = (data.tasks || []).map((t) => {
        let title = t.title || "";
        for (const [from, to] of Object.entries(renames)) {
          if (title.includes(from)) title = title.split(from).join(to);
        }
        return title === t.title ? t : { ...t, title };
      });
      persist = true;
    }
    if (migratePreviewRotaClock(data)) persist = true;
    if (migratePreviewWeekRota(data)) persist = true;
    if (migratePreviewCompanyHeadWorkplace(data)) persist = true;
    if (migratePreviewVoiceBranchManager(data)) persist = true;
    if (migratePreviewEmployeeGenders(data)) persist = true;
    if (migratePreviewOwnerGosiIdentity(data)) persist = true;
    if (migratePreviewGosiEstablishment(data)) persist = true;
    if (migratePreviewOwnerMorningRota(data)) persist = true;
    if (seedPreviewOwnerNightStreak(data)) persist = true;
    if (seedPreviewAttendanceHistory(data)) persist = true;
    if (migratePreviewSigningNotices(data)) persist = true;
    if (migratePreviewStationPins(data)) persist = true;
    if (seedPreviewProofCycle(data)) persist = true;
    if (seedPreviewWrittenConsent(data)) persist = true;
    if (applyLapsedNightConsents(data)) persist = true;
    if (seedPreviewDiscipline(data)) persist = true;
    if (seedPreviewVoice(data)) persist = true;
    if (seedPreviewPerformance(data)) persist = true;
    if (migratePreviewFieldTasks(data)) persist = true;
    if (seedPreviewOrgDesign(data)) persist = true;
    // Preview shifts stretched above may now be long — open their one-hour rest in the same load.
    if (openLongShiftRests(data)) persist = true;
  }
  (data.employees || []).forEach((emp) => {
    const { patch } = art55FilePatch(emp);
    if (!Object.keys(patch).length) return;
    emp.profile = { ...(emp.profile || {}), ...patch };
    persist = true;
  });
  if (persist) localStorage.setItem(companyKey(id), JSON.stringify(data));
  return data;
}

// Persists authoritative cloud reads into the local cache without re-uploading
// them or emitting a write event, preventing stale local data from resurfacing.
function mergeLocalDemoRecords(current, incoming, kind, companyId = "") {
  if (!Array.isArray(incoming) || !Array.isArray(current)) return incoming;
  const ids = new Set(incoming.map((item) => item?.id).filter(Boolean));
  const extra = current.filter((item) => {
    if (!item?.id || ids.has(item.id)) return false;
    if (kind === "employees") {
      return Boolean(item.profile?.demo) || String(item.email || "").toLowerCase().endsWith("@demo.nirovera.local");
    }
    return item.demo === true;
  });
  if (kind === "stations") {
    const localById = new Map(current.map((station) => [String(station.id), station]));
    const recentLocal = companyId && (Date.now() - (lastLocalWriteAt[companyId] || 0) < 12000);
    incoming = incoming.map((station) => {
      const local = localById.get(String(station.id));
      if (!local) return station;
      const remoteKind = station.unitKind === "manager" || station.unitKind === "branch" ? station.unitKind : null;
      const localKind = local.unitKind === "manager" || local.unitKind === "branch" ? local.unitKind : null;
      const remoteMgr = station.managerId;
      const localMgr = local.managerId;
      const preferLocalManager = recentLocal
        && String(localMgr || "") !== String(remoteMgr ?? "");
      return {
        ...station,
        parentStationId: station.parentStationId || local.parentStationId || null,
        isCompanyRoot: Boolean(station.isCompanyRoot || local.isCompanyRoot),
        unitKind: remoteKind || localKind || "branch",
        managerId: preferLocalManager
          ? (localMgr ?? null)
          : (remoteMgr !== undefined && remoteMgr !== null && remoteMgr !== ""
            ? remoteMgr
            : (localMgr ?? null)),
        demo: station.demo || local.demo,
      };
    });
  }
  return extra.length ? [...incoming, ...extra] : incoming;
}

export function cacheCloudData(companyId, updates) {
  const current = getCompanyData(companyId);
  if (!current) return null;
  const nextUpdates = { ...updates };
  if (nextUpdates.employees) {
    nextUpdates.employees = mergeEmployeeRequestBags(
      current.employees,
      mergeLocalDemoRecords(current.employees, nextUpdates.employees, "employees", companyId),
    );
  }
  if (nextUpdates.stations) nextUpdates.stations = mergeLocalDemoRecords(current.stations, nextUpdates.stations, "stations", companyId);
  // Sanction stages the server has not confirmed yet stay on top of any newer server copy.
  if (Array.isArray(nextUpdates.disciplinaryCases)) {
    const pending = readDisciplineOutbox(typeof localStorage !== "undefined" ? localStorage : null, companyId);
    if (pending.length) nextUpdates.disciplinaryCases = applyPendingStages(nextUpdates.disciplinaryCases, pending);
  }
  let next = { ...current, ...nextUpdates };
  // Training / medical / held-document registers come back as one row per employee — lay them onto the people.
  if ((nextUpdates.employees || nextUpdates.employerDuties) && Array.isArray(next.employerDuties)) {
    next.employees = applyEmployerDutyRoster(next.employees, next.employerDuties);
  }
  try {
    next = reconcileStationReferences(next);
  } catch (error) {
    console.error("NiroVera station reconcile:", error);
  }
  try {
    localStorage.setItem(companyKey(companyId), JSON.stringify(next));
  } catch (error) {
    console.error("NiroVera cacheCloudData:", error);
  }
  return next;
}
const lastLocalWriteAt = {};
export function getLastLocalWriteAt(companyId) {
  return lastLocalWriteAt[companyId] || 0;
}
const cloudPushTimers = {};
function scheduleCompanyPush(id, data) {
  clearTimeout(cloudPushTimers[id]);
  const snapshot = JSON.parse(JSON.stringify(data));
  cloudPushTimers[id] = setTimeout(() => {
    delete cloudPushTimers[id];
    pushCompanyDataToCloud(id, snapshot);
  }, 300);
}

function persistCompanyData(id, data, sync = "all") {
  try {
    reconcileStationReferences(data);
  } catch (error) {
    console.error("NiroVera station reconcile:", error);
  }
  data.employees = dedupeEmployees(data.employees);
  data.personalAttendance = (data.personalAttendance || []).map((record) => {
    const { dayIndex: _legacyDayIndex, ...clean } = record;
    return { ...clean, dateKey: toRiyadhDateKey(record.dateKey || record.date || record.createdAt) };
  });
  lastLocalWriteAt[id] = Date.now();
  write(companyKey(id), data);
  // Preview has no cloud write ACL — keep the local workspace and skip Base44.
  if (isLocalPreviewWorkspace(id) || sync === "none") return;
  if (typeof sync === "string" && sync !== "all") {
    syncBlobToEntity(id, sync, data[sync]);
    return;
  }
  scheduleCompanyPush(id, data);
}

function saveCompanyData(id, data) {
  persistCompanyData(id, data, "all");
}

// Pushes the full company snapshot to the persisted cloud database. Called on every
// local write, and re-called automatically by the retry loop for anything that failed.
function pushCompanyDataToCloud(id, data) {
  if (isLocalPreviewWorkspace(id)) return;
  syncEmployeesToEntity(id, data.employees);
  syncStationsToEntity(id, data.stations);
  // disciplinaryCases go through compliance/disciplineSave only; employerDuties is projected from employees.
  pushableBlobCategories(BLOB_CATEGORIES).forEach((category) => syncBlobToEntity(id, category, data[category]));
  syncBlobToEntity(id, "employerDuties", employerDutyRosterFromEmployees(data.employees));
  syncBlobToEntity(id, LEAVE_ROSTER_BLOB, leaveRosterFromEmployees(data.employees));
  syncBlobToEntity(id, "companyMeta", [{
    id: "meta",
    name: data.name,
    plan: data.plan,
    directorId: data.directorId,
    ownerId: data.ownerId,
    stationChatGroups: data.stationChatGroups,
    crossStationChatEnabled: data.crossStationChatEnabled,
    settings: data.settings,
    // The server publish gate reads Art. 103 / night-facility flags from here.
    hoursPolicy: data.hoursPolicy || undefined,
    employeeNoSeq: data.employeeNoSeq || data.settings?.employeeNoSeq || 0,
    reportBranding: data.reportBranding,
    orgStructureLog: data.orgStructureLog || [],
    ...(readCompanyEstablishment(data) ? { gosiEstablishment: readCompanyEstablishment(data) } : {}),
  }]);
}

/* ----------------------------- sync retry loop ----------------------------- */
const pendingResync = new Set();
const retryAttempts = {};
const retryTimers = {};
const syncHealth = { lastSyncedAt: null };
export function getSyncStatus() {
  return {
    pending: pendingResync.size,
    offline: typeof navigator !== "undefined" && navigator.onLine === false,
    lastSyncedAt: syncHealth.lastSyncedAt,
  };
}
function markSynced(companyId) {
  syncHealth.lastSyncedAt = Date.now();
  pendingResync.delete(companyId);
  retryAttempts[companyId] = 0;
  clearTimeout(retryTimers[companyId]);
  delete retryTimers[companyId];
  notify();
}
function scheduleResync(companyId) {
  pendingResync.add(companyId);
  if (!retryTimers[companyId] && (retryAttempts[companyId] || 0) < 6) {
    const attempt = retryAttempts[companyId] || 0;
    const delay = Math.min(30000, 1000 * (2 ** attempt));
    retryTimers[companyId] = setTimeout(() => {
      delete retryTimers[companyId];
      retryAttempts[companyId] = attempt + 1;
      const data = getCompanyData(companyId);
      if (data) pushCompanyDataToCloud(companyId, data);
    }, delay);
  }
  notify();
}
function flushResync() {
  const ids = [...pendingResync];
  if (!ids.length) return;
  pendingResync.clear();
  ids.forEach((id) => {
    clearTimeout(retryTimers[id]);
    delete retryTimers[id];
    retryAttempts[id] = 0;
    const data = getCompanyData(id);
    if (data) pushCompanyDataToCloud(id, data);
  });
  notify();
}
if (typeof window !== "undefined") {
  // Push pending changes the moment connectivity returns, and before the tab hides —
  // so edits made moments before closing/switching tabs still reach the cloud.
  window.addEventListener("online", flushResync);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushResync();
  });
}

/* ----------------------------- generic collections (real, persisted) -----------------------------
   Tasks, reports, anonymous reports, safety, plans, schedules and HR levels are synced the same
   way as employees/stations: the localStorage blob stays the instant cache, while each full array
   is additionally persisted to the CompanyDataBlob entity so it survives beyond this browser. */
export const BLOB_CATEGORIES = [
  "tasks", "reports", "anonymousReports", "publicReports", "safety", "plans",
  "schedules", "hrLevels", "jobGrades", "hrClusters", "files", "notifications", "templates", "targets",
  "personalPlaces", "personalAttendance", "plannerItems", "journalEntries", "payrollRuns", "smartPositions",
  "complaintEscalationChain", "branchEscalationChains", "branchEscalationSla", "orgTree", "orgSeats", "orgDesign", "workProofs", "visitorProofs", "disciplinaryCases",
  "arbitrationOutcomes",
  "hcmFoundation", "hcmPerformance", "attendancePolicy", "attendanceEmergency", "hseCredits", "abuseCases",
  "workRegulation", "trainingPlan", "employerDuties",
  ];
const lastSyncedBlobJSON = {};
async function syncBlobToEntity(companyId, category, payload) {
  if (isLocalPreviewWorkspace(companyId)) return;
  if (isDoNotWrite(category)) return;
  if (isServerActionCategory(category)) return;
  assertWritableCategory(category);
  const normalized = normalizeBlobPayload(category, payload);
  const key = `${companyId}_${category}`;
  const json = JSON.stringify(normalized);
  if (lastSyncedBlobJSON[key] === json) return;
  lastSyncedBlobJSON[key] = json;
  try {
    await invokeDirectory({ action: "syncBlob", companyId, category, payload: normalized });
    markSynced(companyId);
  } catch (error) {
    const status = error?.response?.status || error?.status;
    // A rejected write (403) is a permission problem, not a network blip: surface it
    // to the user instead of retrying forever — silent failure is worse than failure.
    if (status === 403) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("powercare:sync-rejected", { detail: category }));
      }
      return;
    }
    // failed cloud write — clear the dedupe marker and let the retry loop re-push it
    lastSyncedBlobJSON[key] = undefined;
    scheduleResync(companyId);
  }
}

// Lightweight per-collection version stamps — used by the auth provider's poll to
// download only the collections that actually changed since the last pull (delta sync).
export async function fetchCloudVersions(companyId) {
  try {
    const res = await invokeDirectory({ action: "getVersions", companyId });
    return res?.data?.versions || null;
  } catch {
    return null;
  }
}

// Fetches the authoritative, persisted array for a category from the real database.
export async function hydrateBlobFromEntity(companyId, category) {
  try {
    const res = await invokeDirectory({ action: "getBlob", companyId, category });
    return res?.data?.payload || null;
  } catch {
    return null;
  }
}

// Removes duplicate employee records (e.g. from seeding dummy data more than once) —
// keeps the first record for any repeated email, so names never appear twice in lists.
function dedupeEmployees(employees) {
  const seen = new Set();
  return (employees || []).filter((e) => {
    if (!e.email) return true;
    if (seen.has(e.email)) return false;
    seen.add(e.email);
    return true;
  });
}

/* ----------------------------- employee database (real, persisted) -----------------------------
   The localStorage company blob still caches everything (stations, tasks, HR levels, etc.) for
   instant synchronous reads, but employees are additionally persisted to the real Employee entity
   so the workforce data survives beyond this browser. `employeeId` on each record is the same
   stable id used everywhere else in the app (stations.managerId, tasks.assignedTo, session.userId...). */
const lastSyncedEmployeesJSON = {};
async function syncEmployeesToEntity(companyId, employees) {
  const json = JSON.stringify(employees || []);
  if (lastSyncedEmployeesJSON[companyId] === json) return;
  lastSyncedEmployeesJSON[companyId] = json;
  try {
    const res = await invokeDirectory({ action: "syncEmployees", companyId, employees: employees || [] });
    // The server holds file facts a non-HR session tried to change (EMPLOYEE_FILE_HR_ONLY) and names them.
    if (res?.data?.refused?.length) console.warn("NiroVera employee file:", res.data.error, res.data.refused);
    markSynced(companyId);
  } catch {
    // failed cloud write — clear the dedupe marker and let the retry loop re-push it
    lastSyncedEmployeesJSON[companyId] = undefined;
    scheduleResync(companyId);
  }
}

/* ----------------------------- station database (real, persisted) -----------------------------
   Same pattern as employees: the localStorage company blob still caches stations for instant
   synchronous reads, but stations are additionally persisted to the real Station entity so the
   station list survives beyond this browser. */
const lastSyncedStationsJSON = {};
async function syncStationsToEntity(companyId, stations) {
  const json = JSON.stringify(stations || []);
  if (lastSyncedStationsJSON[companyId] === json) return;
  lastSyncedStationsJSON[companyId] = json;
  try {
    await invokeDirectory({ action: "syncStations", companyId, stations: stations || [] });
    markSynced(companyId);
  } catch {
    // failed cloud write — clear the dedupe marker and let the retry loop re-push it
    lastSyncedStationsJSON[companyId] = undefined;
    scheduleResync(companyId);
  }
}

// Fetches the authoritative, persisted station list for a company from the real database.
export async function hydrateStationsFromEntity(companyId) {
  try {
    const res = await invokeDirectory({ action: "getStations", companyId });
    const records = res?.data?.stations || [];
    return records.map((r) => ({
      id: r.stationId,
      name: r.name,
      location: r.location,
      type: r.type,
      status: r.status,
      managerId: r.managerId,
      parentStationId: r.parentStationId || r.parent_station_id || null,
      isCompanyRoot: Boolean(r.isCompanyRoot),
      // Keep null when the entity never stored unitKind so merge can preserve local manager seats.
      unitKind: r.unitKind === "manager" ? "manager" : r.unitKind === "branch" ? "branch" : null,
      demo: Boolean(r.demo),
      lat: r.lat,
      lng: r.lng,
      radiusMeters: r.radiusMeters,
      createdAt: r.created_date,
    }));
  } catch {
    return null;
  }
}

// Fetches the authoritative, persisted employee list for a company from the real database.
export async function hydrateEmployeesFromEntity(companyId) {
  try {
    const res = await invokeDirectory({ action: "getEmployees", companyId });
    const records = res?.data?.employees || [];
    return records.map((r) => projectDirectoryEmployee(r)).filter(Boolean);
  } catch {
    return null;
  }
}

// Guarantees the company has an owner/director user record — brand-new accounts
// created from the cloud (empty workspace) get one automatically at first login,
// so the app never opens with a null currentUser (which rendered a blank page).
function ensureOwnerUser(companyId, company) {
  let ownerId = null;
  updateCompany(companyId, (d) => {
    let owner = d.employees.find((e) => e.role === "director");
    if (!owner) {
      const emailName = (company?.ownerEmail || "").split("@")[0] || "Owner";
      owner = {
        id: uid("emp"), name: emailName, email: company?.ownerEmail || "",
        role: "director", stationId: null, anonymousId: hashId(uid("a")),
        phone: "", createdAt: new Date().toISOString(),
      };
      d.employees.push(owner);
      if (!d.directorId) d.directorId = owner.id;
      if (!d.ownerId) d.ownerId = owner.id;
    }
    assignEmployeeNumber(d, owner, { hireDate: owner.profile?.hireDate || owner.createdAt || "" });
    ownerId = owner.id;
  });
  return ownerId;
}

// Repairs an owner session saved with no userId (pre-fix logins) so the app
// stops rendering blank — creates the owner user if needed and re-saves the session.
export function repairOwnerSession(companyId) {
  const company = getCompanyMeta(companyId);
  const userId = ensureOwnerUser(companyId, company);
  if (userId) setSession({ companyId, userId });
}

/* ----------------------------- session ----------------------------- */
export function getSession() {
  return read(SESSION_KEY, null);
}
export function setSession(session) {
  const prev = getSession();
  write(SESSION_KEY, session);
  // A new sign-in (or another person) starts on their own branch — a branch picked by hand
  // before belongs to the previous sign-in. A refresh of the same session keeps the choice.
  if (session && (!prev || String(prev.userId) !== String(session.userId) || String(prev.companyId) !== String(session.companyId))) {
    clearStationScope();
  }
}
export function clearSession() {
  const session = getSession();
  if (session?.companyId) invokeDirectory({ action: "revokeSession", companyId: session.companyId }).catch(() => {});
  const tokens = read(TOKENS_KEY, {});
  if (session?.companyId) delete tokens[session.companyId];
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  localStorage.removeItem(SESSION_KEY);
  clearStationScope();
  notify();
}
export async function companyLogin(email, password) {
  // Legacy entry point retained for compatibility, but it no longer permits
  // password-only or offline login. Every login must complete the OTP flow.
  return startLogin(email, password);
}
/* ----------------------------- two-step login (email OTP) -----------------------------
   Step 1: startLogin verifies the password server-side; the server emails a 6-digit code
   and returns a pendingId. Step 2: completeLoginOtp exchanges pendingId + code for the
   real session token. Offline fallback: owner accounts cached on this device log in
   directly (no network = no way to email a code). */
export async function startLogin(email, password, preferKind) {
  try {
    const res = await invokeDirectory({ action: "findAccountByEmail", email, password, preferKind: preferKind || null });
    if (res?.data?.wrongKind) return { wrongKind: true };
    if (res?.data?.token && res.data.kind === "owner") return { company: finishOwnerLogin(res.data) };
    if (res?.data?.otpRequired) return { otpRequired: true, pendingId: res.data.pendingId, accounts: res.data.accounts || [] };
  } catch (error) {
    if (error?.response?.data?.error === "OTP_RATE_LIMIT") throw new Error("انتظر دقيقة قبل طلب رمز جديد · Please wait one minute before requesting another code");
    // network/backend issue — try employee login, then the local fallback below
  }
  // Employee logins are facility staff — never applicable on the Individual tab.
  if (preferKind !== "individual") {
    try {
      const res = await invokeDirectory({ action: "employeeLogin", email, password, preferKind: preferKind || null });
      if (res?.data?.wrongKind) return { wrongKind: true };
      if (res?.data?.otpRequired) return { otpRequired: true, pendingId: res.data.pendingId };
    } catch (error) {
      if (error?.response?.data?.error === "OTP_RATE_LIMIT") throw new Error("انتظر دقيقة قبل طلب رمز جديد · Please wait one minute before requesting another code");
      // ignore — fall through to local fallback
    }
  }
  // No offline password fallback: OTP completion is mandatory for every account.
  return null;
}

export async function requestPasswordReset(email) {
  const res = await invokeDirectory({ action: "requestPasswordReset", email: String(email || "").trim().toLowerCase() });
  return res?.data?.pendingId || null;
}

export async function resetPassword(pendingId, code, newPassword, email) {
  try {
    const res = await invokeDirectory({ action: "resetPassword", pendingId, code, newPassword, email });
    return !!res?.data?.ok;
  } catch {
    return false;
  }
}

export async function requestOwnerPasswordReset(email) {
  const res = await invokeDirectory({ action: "requestOwnerPasswordReset", email: String(email || "").trim().toLowerCase() });
  return res?.data?.pendingId || null;
}

export async function resetOwnerPassword(pendingId, code, newPassword, email) {
  try {
    const res = await invokeDirectory({ action: "resetOwnerPassword", pendingId, code, newPassword, email });
    return !!res?.data?.ok;
  } catch {
    return false;
  }
}

function finishOwnerLogin(result) {
  const remote = result.company;
  const reg = getRegistry();
  setCompanyToken(remote.companyId, result.token);
  const orgType = "company";
  let company = reg.companies.find((c) => c.id === remote.companyId);
  if (!company) {
    company = {
      id: remote.companyId, name: remote.name, ownerEmail: remote.ownerEmail,
      plan: remote.plan, orgType, allowedEmailDomain: remote.allowedEmailDomain || "",
      subscriptionStart: remote.subscriptionStart || null, subscriptionEnd: remote.subscriptionEnd || null,
      createdAt: remote.created_date,
    };
    reg.companies.push(company);
  } else {
    // Refresh stale local meta — a locally-cached plan/name from an old login must
    // never override the server's authoritative account record.
    company.name = remote.name ?? company.name;
    company.plan = remote.plan ?? company.plan;
    company.orgType = orgType;
    company.allowedEmailDomain = remote.allowedEmailDomain ?? company.allowedEmailDomain;
    company.subscriptionStart = remote.subscriptionStart ?? company.subscriptionStart ?? null;
    company.subscriptionEnd = remote.subscriptionEnd ?? company.subscriptionEnd ?? null;
  }
  saveRegistry(reg);
  if (!getCompanyData(company.id)) write(companyKey(company.id), emptyCompanyData(company));
  else cacheCloudData(company.id, { name: remote.name, plan: remote.plan });
  const local = getCompanyData(company.id);
  if (local) {
    local.settings = { ...(local.settings || {}), orgType };
    localStorage.setItem(companyKey(company.id), JSON.stringify(local));
  }
  const ownerId = result.ownerId || getCompanyData(company.id)?.ownerId;
  setSession({ companyId: company.id, userId: ownerId || ensureOwnerUser(company.id, company) });
  clearStationScope(); // every sign-in opens on the person's own branch
  return company;
}

export async function googleCompanyLogin(preferKind, accountKey) {
  try {
    const res = await invokeDirectory({ action: "googleOwnerLogin", preferKind: preferKind || null, accountKey: accountKey || null });
    if (res?.data?.selectionRequired || res?.data?.otpRequired) return res.data;
    return null;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error?.message || "Google login failed");
  }
}

export async function completeLoginOtp(pendingId, code, chooseCompanyId) {
  let result = null;
  try {
    const res = await invokeDirectory({ action: "verifyLoginOtp", pendingId, code, chooseCompanyId: chooseCompanyId || null });
    result = res?.data;
  } catch {
    return null; // wrong/expired code (server returned 401) or network failure
  }
  if (!result?.token) return null;
  if (result.kind === "owner") return finishOwnerLogin(result);
  return finishEmployeeLogin(result);
}

function finishEmployeeLogin(result) {
  const reg = getRegistry();
  const { companyId, employeeId } = result.employee;
  setCompanyToken(companyId, result.token);
  const orgType = "company";
  let company = reg.companies.find((c) => c.id === companyId);
  if (!company) {
    company = {
      id: companyId, name: result.company?.name || "", ownerEmail: result.company?.ownerEmail || "",
      ownerPassword: null, plan: result.company?.plan || "Starter", orgType,
      allowedEmailDomain: result.company?.allowedEmailDomain || "", subscriptionStart: result.company?.subscriptionStart || null,
      subscriptionEnd: result.company?.subscriptionEnd || null, createdAt: new Date().toISOString(),
    };
    reg.companies.push(company);
    saveRegistry(reg);
  } else {
    company.orgType = orgType;
    saveRegistry(reg);
  }
  if (!getCompanyData(companyId)) write(companyKey(companyId), emptyCompanyData(company));
  const local = getCompanyData(companyId);
  if (local) {
    local.settings = { ...(local.settings || {}), orgType };
    localStorage.setItem(companyKey(companyId), JSON.stringify(local));
  }
  setSession({ companyId, userId: employeeId });
  clearStationScope(); // every sign-in opens on the person's own branch
  return company;
}

// Owner changes their own account password — verified server-side against the
// active owner session, stored hashed in the cloud directory.
export async function changeOwnerPassword(companyId, newPassword) {
  const reg = getRegistry();
  const company = reg.companies.find((c) => c.id === companyId);
  if (!company) return false;
  const res = await invokeDirectory({
    action: "syncAccount", companyId,
    name: company.name, ownerEmail: company.ownerEmail,
    ownerPassword: newPassword, plan: company.plan,
    allowedEmailDomain: company.allowedEmailDomain || "",
  });
  if (!res?.data?.ok) return false;
  saveRegistry(reg);
  return true;
}

// Owner/manager sets (or resets) an employee's personal login password — stored only
// as a salted hash in the cloud directory, never in localStorage.
export async function setEmployeePassword(companyId, employeeId, email, password) {
  try {
    const res = await invokeDirectory({ action: "setEmployeePassword", companyId, employeeId, email, password });
    return !!res?.data?.ok;
  } catch {
    return false;
  }
}

/** Employee files are retained — exit via termination / resignation offboarding only. */
export async function deleteEmployeeAccount() {
  return false;
}

export function switchUser(userId) {
  const s = getSession();
  if (!s) return;
  setSession({ ...s, userId });
}

// Assigns one employee as Station Manager for one or more stations at once — promotes
// them to the station_manager role, clears their old single-station manager slot (if any),
// and sets station.managerId on every selected station so the escalation chain (level 0,
// see src/lib/escalation.js) and org chart both recognize them everywhere they manage.
export function setStationManager(companyId, stationId, employeeId) {
  const sid = String(stationId || "").trim();
  const mid = String(employeeId || "").trim() || null;
  if (!companyId || !sid) return { ok: false, error: "MISSING" };
  const current = getCompanyData(companyId);
  if (!current) return { ok: false, error: "MISSING" };
  const stationName = current.stations.find((station) => String(station.id) === sid)?.name || "";
  const managerName = mid
    ? (current.employees.find((employee) => String(employee.id) === mid)?.name || "No manager")
    : "No manager";
  let changed = false;
  updateCompany(companyId, (data) => {
    const station = (data.stations || []).find((item) => String(item.id) === sid);
    if (!station) return;
    if (String(station.managerId || "") === String(mid || "")) return;
    changed = true;
    const previous = (data.employees || []).find((employee) => String(employee.id) === String(station.managerId || ""));
    if (previous) {
      previous.managedStations = (previous.managedStations || []).filter((id) => String(id) !== sid);
      if (!previous.managedStations.length && previous.role === "station_manager") {
        previous.role = "employee";
      }
    }
    station.managerId = mid;
    const next = mid ? (data.employees || []).find((employee) => String(employee.id) === mid) : null;
    appendOrgStructureEvent(data, {
      type: "manager",
      stationId: sid,
      stationName: station.name || stationName,
      from: previous?.id || "",
      fromName: previous?.name || "",
      to: mid || "",
      toName: next?.name || "",
      employeeId: mid || "",
      employeeName: next?.name || managerName,
    });
    if (!next) {
      applyWorkplaceManagerRule(data);
      return;
    }
    // Keep director / ops / pgm — managerId alone makes them مدير الفرع for voice & requests.
    if (!["director", "ops_manager", "pgm", "owner"].includes(next.role)) {
      next.role = "station_manager";
    }
    next.managedStations = [...new Set([...(next.managedStations || []).map(String), sid])];
    if (!next.stationId) next.stationId = sid;
    applyWorkplaceManagerRule(data);
  });
  if (!changed) {
    const station = current.stations.find((item) => String(item.id) === sid);
    if (!station) return { ok: false, error: "MISSING" };
    return { ok: true, changed: false };
  }
  audit(companyId, "station_manager_changed", `${stationName}: ${managerName}.`);
  return { ok: true, changed: true };
}

export function assignStationManager(companyId, employeeId, stationIds) {
  const empName = getCompanyData(companyId)?.employees.find((e) => e.id === employeeId)?.name || "";
  audit(companyId, "station_manager_assigned", `${empName} assigned as station manager of ${(stationIds || []).length} station(s).`);
  updateCompany(companyId, (d) => {
    const emp = d.employees.find((e) => e.id === employeeId);
    if (!emp) return;
    d.stations.forEach((s) => { if (s.managerId === emp.id) s.managerId = null; });
    const ids = Array.isArray(stationIds) ? stationIds.filter(Boolean) : [];
    d.employees.filter((other) => other.id !== emp.id).forEach((other) => {
      other.managedStations = (other.managedStations || []).filter((id) => !ids.includes(id));
      if (other.role === "station_manager" && !other.managedStations.length) { other.role = "employee"; other.stationId = null; }
    });
    if (!["director", "ops_manager", "pgm", "owner"].includes(emp.role)) {
      emp.role = ids.length ? "station_manager" : "employee";
    }
    emp.stationId = ids.length === 1 ? ids[0] : (emp.stationId || null);
    emp.managedStations = ids;
    ids.forEach((sid) => {
      const s = d.stations.find((x) => x.id === sid);
      if (s) s.managerId = emp.id;
    });
    applyWorkplaceManagerRule(d);
  });
}

/* ----------------------------- mutations ----------------------------- */
export function updateCompany(companyId, updater, options = {}) {
  const data = getCompanyData(companyId);
  if (!data) return;
  const scheduleOnly = options.sync === "schedules";
  // Snapshot key collections so every add/remove/status change is audited
  // automatically, no matter which page performed the mutation.
  // A cell toggle only needs the schedule fingerprint — skip the full roster scan.
  const before = scheduleOnly
    ? { schedulesJSON: JSON.stringify(data.schedules || []) }
    : {
      emp: new Map((data.employees || []).map((e) => [e.id, e.name])),
      st: new Map((data.stations || []).map((s) => [s.id, s.name])),
      stLoc: new Map((data.stations || []).map((s) => [s.id, `${s.lat},${s.lng},${s.radiusMeters}`])),
      tasks: new Map((data.tasks || []).map((t) => [t.id, t.status])),
      taskTitles: new Map((data.tasks || []).map((t) => [t.id, t.title])),
      reports: new Map((data.reports || []).map((r) => [r.id, r.title])),
      files: new Map((data.files || []).map((f) => [f.id, f.name])),
      plans: new Map((data.plans || []).map((p) => [p.id, p.title])),
      anrIds: new Set((data.anonymousReports || []).map((r) => r.id)),
      paidPayroll: new Set((data.payrollRuns || []).flatMap((r) => (r.items || []).filter((i) => i?.paid).map((i) => i.id))),
      pubIds: new Set((data.publicReports || []).map((r) => r.id)),
      schedulesJSON: JSON.stringify(data.schedules || []),
      settingsJSON: JSON.stringify(data.settings || {}),
    };
  updater(data);
  persistCompanyData(companyId, data, options.sync || "all");
  if (scheduleOnly) {
    if (JSON.stringify(data.schedules || []) !== before.schedulesJSON) {
      audit(companyId, "schedule_changed", "Work schedule updated.");
    }
    return data;
  }
  logCollectionDiffs(companyId, data, before);
  emailNewEvents(companyId, data, before);
  return data;
}

// Automatic Gmail alerts: emails the assigned employee when a new task is created
// for them, and emails the responsible manager when a new complaint/report is filed.
function emailNewEvents(companyId, data, before) {
  (data.tasks || []).forEach((t) => {
    if (before.tasks.has(t.id) || !t.assignedTo) return;
    const emp = (data.employees || []).find((e) => e.id === t.assignedTo);
    if (emp?.email) {
      const station = (data.stations || []).find((s) => s.id === (t.stationId || data.stations?.[0]?.id));
      const priorityLabels = { high: "عالية · High", medium: "متوسطة · Medium", low: "منخفضة · Low" };
      const deadline = t.dueDate || t.endDate;
      const details = [
        { label: "المهمة · Task", value: t.title },
        ...(station ? [{ label: "الفرع · Station", value: station.name }] : []),
        ...(t.priority ? [{ label: "الأولوية · Priority", value: priorityLabels[t.priority] || t.priority }] : []),
        ...(deadline ? [{ label: "الموعد النهائي · Due date", value: new Date(deadline).toLocaleDateString("en-GB") }] : []),
      ];
      sendEmailAlert(
        companyId, emp.email,
        `مهمة جديدة مسندة إليك — ${t.title}`,
        `مرحبًا ${emp.name}،\n\nتم إسناد مهمة جديدة إليك في منصة PowerCare. تفاصيل المهمة أدناه:\n\nHello ${emp.name}, a new task has been assigned to you on PowerCare. Details below:`,
        details,
        { label: "عرض المهمة · View task", url: `${typeof window !== "undefined" && window.location?.origin ? window.location.origin : "https://nirovera.sa"}/app/tasks` }
      );
    }
  });
  const anonIds = new Set((data.anonymousReports || []).map((r) => r.id));
  const newReports = [
    ...(data.anonymousReports || []).filter((r) => !before.anrIds.has(r.id)),
    ...(data.publicReports || []).filter((r) => !before.pubIds.has(r.id)),
  ];
  newReports.forEach((r) => {
    const station = (data.stations || []).find((s) => s.id === (r.stationId || data.stations?.[0]?.id));
    // Anonymous reports and suggestions reach HR only — the branch manager is never emailed about them.
    const hrOnly = isHrOnlyVoice(anonIds.has(r.id) ? { ...r, bucket: "anon" } : r);
    const manager = hrOnly ? null : (data.employees || []).find((e) => e.id === station?.managerId);
    const hrEmails = hrOnly
      ? voiceHrReceivers(data, { exclude: [r.authorId, r.rateActorId], item: r }).map((e) => e.email).filter(Boolean)
      : [];
    const toEmails = hrOnly
      ? (hrEmails.length ? hrEmails : [getCompanyMeta(companyId)?.ownerEmail].filter(Boolean))
      : [manager?.email || getCompanyMeta(companyId)?.ownerEmail].filter(Boolean);
    for (const toEmail of toEmails) {
      sendEmailAlert(
        companyId, toEmail,
        "PowerCare — شكوى/بلاغ جديد بانتظار المراجعة",
        `تم استلام ${r.type === "suggestion" ? "اقتراح جديد" : "شكوى/بلاغ جديد"}${station ? ` في فرع "${station.name}"` : ""}.\nيرجى الدخول إلى منصة PowerCare لمراجعته والرد عليه.\n\nA new complaint/report was received${station ? ` at station "${station.name}"` : ""} on PowerCare and is awaiting your review.`
      );
    }
  });
}

// Automatic audit entries derived from what actually changed during a mutation —
// covers employees, stations (incl. GPS location), tasks, reports, files, plans,
// schedules and settings, no matter which page performed the mutation.
function logCollectionDiffs(companyId, data, before) {
  const summarizeNames = (names) => {
    const unique = [...new Set(names)];
    const visible = unique.slice(0, 8);
    return `${visible.join(", ")}${unique.length > visible.length ? ` +${unique.length - visible.length} more` : ""}`;
  };
  const diffList = (map, arr, label, nameOf) => {
    const added = arr.filter((x) => !map.has(x.id)).map(nameOf).filter(Boolean);
    const removed = [...map.keys()].filter((id) => !arr.some((x) => x.id === id)).map((id) => map.get(id)).filter(Boolean);
    if (added.length) audit(companyId, `${label}_added`, `Added ${label}(s): ${summarizeNames(added)}`);
    if (removed.length) audit(companyId, `${label}_removed`, `Removed ${label}(s): ${summarizeNames(removed)}`);
  };
  diffList(before.emp, data.employees || [], "employee", (e) => e.name);
  diffList(before.st, data.stations || [], "station", (s) => s.name);
  diffList(before.taskTitles, data.tasks || [], "task", (t) => t.title);
  diffList(before.reports, data.reports || [], "report", (r) => r.title);
  diffList(before.files, data.files || [], "file", (f) => f.name);
  diffList(before.plans, data.plans || [], "plan", (p) => p.title);

  (data.tasks || []).forEach((t) => {
    const prev = before.tasks.get(t.id);
    if (prev && prev !== t.status) {
      audit(companyId, "task_status_changed", `Task "${t.title}": ${prev} → ${t.status}`);
    }
  });
  (data.stations || []).forEach((s) => {
    const prev = before.stLoc.get(s.id);
    if (prev != null && prev !== `${s.lat},${s.lng},${s.radiusMeters}`) {
      audit(companyId, "station_location_changed", `Station "${s.name}" GPS location/radius updated.`);
    }
  });
  if (JSON.stringify(data.schedules || []) !== before.schedulesJSON) audit(companyId, "schedule_changed", "Work schedule updated.");
  if (JSON.stringify(data.settings || {}) !== before.settingsJSON) audit(companyId, "settings_changed", "Company settings updated.");
}

function noticeLang(extras) {
  return extras?.lang === "en" || extras?.lang === "ar" ? extras.lang : getUiLang();
}

/**
 * Art. 107 — a pending overtime / holiday-work decision was opened: the managers are told once per
 * key (employee:day). Stamps run inside a draft, so they queue here and flush after the write.
 */
const otPendingNoticeQueue = [];
function queueOtPendingNotice(employeeId, dayKey, holiday) {
  if (employeeId && dayKey) otPendingNoticeQueue.push({ employeeId, dayKey: String(dayKey).slice(0, 10), holiday: !!holiday });
}
function flushOtPendingNotices(companyId) {
  const list = otPendingNoticeQueue.splice(0, otPendingNoticeQueue.length);
  const data = getCompanyData(companyId);
  for (const row of list) {
    const entry = data?.otDecisions?.[`${row.employeeId}:${row.dayKey}`];
    if (!entry || !isOtDecisionOpenEntry(entry)) continue;
    const emp = (data?.employees || []).find((e) => String(e.id) === String(row.employeeId));
    const hours = Math.round(((Number(entry.overtimeMinutes) || 0) / 60) * 100) / 100;
    const text = row.holiday || entry.holiday
      ? `عمل في العطلة لـ${emp?.name || "موظف"} يوم ${regulationDate(row.dayKey)} (${hours} ساعة) — ينتظر قرارك: أجر الساعة + 50% أو إجازة تعويضية بموافقته (المادة 107/3). من «حضور الفريق».`
      : `ساعات إضافية لـ${emp?.name || "موظف"} يوم ${regulationDate(row.dayKey)} (${hours} ساعة) — تنتظر قرارك: أجر الساعة + 50% أو إجازة تعويضية بموافقته (المادة 107). من «حضور الفريق».`;
    notifyRequestManagers(companyId, row.employeeId, text, { key: `ot_pending:${row.employeeId}:${row.dayKey}`, to: "/app/requests/manage", doa: { kind: "overtime", amount: hours } });
  }
}
function isOtDecisionOpenEntry(entry) {
  return entry?.decision === "pending" || entry?.decision === "pending_worker_cap_consent";
}

function notifyRequestManagers(companyId, employeeId, text, extra) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  if (!emp || !text) return;
  const seen = new Set();
  const list = [...requestNoticeAudience(data, emp)];
  const hr = getStationHRManager(data, employeeId);
  if (hr) list.push(hr);
  // Delegation of authority: the seat the matrix routes this decision to hears of it too.
  // No DoA row for the kind → nothing added; the manager chain above stays the default.
  if (extra?.doa?.kind) {
    for (const id of doaApproverIds(data, emp, extra.doa.kind, extra.doa.amount ?? null)) {
      const person = (data?.employees || []).find((row) => String(row.id) === String(id));
      if (person) list.push(person);
    }
  }
  for (const manager of list) {
    if (!manager?.id || seen.has(String(manager.id)) || String(manager.id) === String(employeeId)) continue;
    seen.add(String(manager.id));
    addNotification(companyId, manager.id, text, extra);
  }
}

function requestManagerNotice(data, employee, kindLabel, lang) {
  const ar = lang === "ar";
  const who = String(employee?.name || "").trim();
  const raw = String(employee?.stationName || (data?.stations || []).find((station) => String(station.id) === String(employee?.stationId || ""))?.name || "").trim();
  const station = raw
    ? (ar && !/^(فرع|دائرة)\s+/i.test(raw) ? `فرع ${raw}` : raw)
    : (ar ? "بلا فرع" : "No branch");
  const regarding = who
    ? (ar ? `بشأن: ${who} · ${station}` : `Re: ${who} · ${station}`)
    : station;
  const label = String(kindLabel || "").trim();
  if (ar) {
    return label
      ? `طلب ${label} ${regarding} بانتظار مراجعتك.`
      : `طلب ${regarding} بانتظار مراجعتك.`;
  }
  return label
    ? `New ${label} request ${regarding} needs your review.`
    : `New request ${regarding} needs your review.`;
}

export function addNotification(companyId, userId, text, extra = {}) {
  updateCompany(companyId, (d) => {
    const key = extra?.key ? String(extra.key) : "";
    if (key && (d.notifications || []).some((row) => row.key === key && row.userId === userId)) return;
    const row = {
      id: uid("ntf"),
      userId,
      text,
      read: false,
      createdAt: new Date().toISOString(),
    };
    if (key) row.key = key;
    if (extra?.leaveDecision && typeof extra.leaveDecision === "object") {
      row.leaveDecision = extra.leaveDecision;
    }
    if (extra?.voiceNotice && typeof extra.voiceNotice === "object") {
      row.voiceNotice = extra.voiceNotice;
    }
    if (extra?.to) row.to = String(extra.to);
    d.notifications.unshift(row);
  });
}

/* ----------------------------- employee profile (SAP-style) ----------------------------- */
// Professional info, certificates and salary live directly on the employee record.
export function updateEmployeeProfile(companyId, employeeId, profile) {
  updateCompany(companyId, (d) => {
    const emp = d.employees.find((e) => e.id === employeeId);
    if (!emp) return;
    const incoming = profile && typeof profile === "object" ? profile : {};
    const merged = { ...(emp.profile || {}), ...incoming };
    if (incoming.contract && typeof incoming.contract === "object") {
      merged.contract = { ...(emp.profile?.contract || {}), ...incoming.contract };
    }
    const { patch } = laborFilePatch({ ...emp, profile: merged });
    emp.profile = { ...merged, ...patch };
    if (patch.contract) {
      emp.profile.contract = { ...(merged.contract || {}), ...patch.contract };
    }
    canonicalizePlatformFacts(d);
  });
}

export function patchEmployeeFile(companyId, employeeId, { profile, phone, name, log, actor } = {}) {
  // Owner rule: the employee file is edited by whoever manages HR (manage_employees, in scope) or the
  // account administrator — never by the employee or his managers. Held here, not only in the screen.
  const live = getCompanyData(companyId);
  const subject = (live?.employees || []).find((e) => e.id === employeeId);
  const fileGate = employeeFileEditGate(actor, subject, live);
  if (!fileGate.ok) return fileGate;
  updateCompany(companyId, (d) => {
    const emp = d.employees.find((e) => e.id === employeeId);
    if (!emp) return;
    if (profile && typeof profile === "object") {
      const incoming = profile;
      const merged = { ...(emp.profile || {}), ...incoming };
      if (incoming.contract && typeof incoming.contract === "object") {
        merged.contract = { ...(emp.profile?.contract || {}), ...incoming.contract };
      }
      const { patch } = laborFilePatch({ ...emp, profile: merged });
      emp.profile = { ...merged, ...patch };
      if (patch.contract) emp.profile.contract = { ...(merged.contract || {}), ...patch.contract };
      canonicalizePlatformFacts(d);
    }
    if (phone != null) emp.phone = phone;
    if (name != null && String(name).trim()) emp.name = String(name).trim();
    if (log) emp.fileLog = [log, ...(emp.fileLog || [])].slice(0, 40);
  });
  return { ok: true };
}

/** Write due Article 55 conversion and statutory leave floors onto one employee file. */
export function applyDueLaborRules(companyId, employeeId) {
  const emp = getCompanyData(companyId)?.employees.find((e) => e.id === employeeId);
  if (!emp) return { ok: false, applied: false };
  const before = laborFilePatch(emp);
  if (!Object.keys(before.patch).length) return { ok: true, applied: false, art55: false, floors: false };
  updateEmployeeProfile(companyId, employeeId, {});
  if (before.art55?.converts) {
    logAudit(companyId, "art55_applied", `Article 55 converted ${emp.name || employeeId} to indefinite (${before.art55.trigger || "continued"}).`);
  }
  return { ok: true, applied: true, art55: Boolean(before.art55?.converts), floors: Boolean(before.floors) };
}

function nightRotateAudienceIds(data, emp) {
  return nightDueAdminAudience(data, emp).map((row) => row.id);
}

/** Open one night-consent request after 3 months as a night worker if no written consent is on file. */
export function openDueNightRotateCycles(companyId, weekStart, employeeId) {
  const data = getCompanyData(companyId);
  if (!data) return { ok: false, opened: [] };
  // Requests the roster is about to close (no night this week) — the worker and his managers are told once.
  const lapsing = collectLapsedNightRotates(data, weekStart)
    .filter((row) => !employeeId || String(row.employee?.id) === String(employeeId));
  updateCompany(companyId, (draft) => {
    applyLapsedNightConsents(draft, weekStart);
  });
  for (const row of lapsing) {
    const reqId = row.request?.id || "";
    addNotification(companyId, row.employee.id, nightLapseNotifyText(true), { key: `18632-lapse:${row.employee.id}:${reqId}`, to: "/app/requests" });
    for (const manager of nightDueAdminAudience(data, row.employee)) {
      addNotification(companyId, manager.id, nightLapseAdminNotifyText(row.employee.name, true), { key: `18632-lapse-admin:${manager.id}:${row.employee.id}:${reqId}`, to: "/app/shifts?lane=manage" });
    }
  }
  const dueList = collectDueNightRotates(getCompanyData(companyId), weekStart)
    .filter((row) => !employeeId || String(row.employee?.id) === String(employeeId));
  const opened = [];
  updateCompany(companyId, (draft) => {
    for (const row of dueList) {
      const emp = draft.employees.find((item) => item.id === row.employee.id);
      if (!emp || pendingNightRotate(emp)) continue;
      emp.otherRequests = emp.otherRequests || [];
      const request = { id: uid("oreq"), ...nightRotateRequestDraft(row.due) };
      const raiseStamp = stampRequestAudit(companyId, emp, request, {
        actor: "system",
        family: "other",
        verb: "raise",
        note: request.reason,
      });
      request.auditTrail = appendRequestAudit(request, raiseStamp.row);
      pushEmployeeFileLog(emp, raiseStamp.log);
      emp.otherRequests.unshift(request);
      opened.push({ employeeId: emp.id, name: emp.name, requestId: request.id, months: row.due.months, weeks: row.due.weeks });
    }
  });
  const fresh = getCompanyData(companyId);
  const existingKeys = [
    ...(fresh?.nightDueNoticeKeys || []),
    ...(fresh?.notifications || []).map((row) => row.key).filter(Boolean),
  ];
  const dueEmployees = employeeId
    ? (fresh?.employees || []).filter((row) => String(row.id) === String(employeeId))
    : (fresh?.employees || []);
  const plans = planNightDueNotifications({
    employees: dueEmployees,
    data: fresh,
    weekStart,
    existingKeys,
  });
  const adminPlans = planNightDueAdminNotifications({
    employees: dueEmployees,
    data: fresh,
    weekStart,
    existingKeys: [...existingKeys, ...plans.map((row) => row.key)],
  });
  const usedKeys = [];
  for (const plan of plans) {
    addNotification(companyId, plan.employeeId, plan.text, { key: plan.key, to: "/app/requests" });
    usedKeys.push(plan.key);
  }
  for (const plan of adminPlans) {
    addNotification(companyId, plan.managerId, plan.text, { key: plan.key, to: `/app/shifts?lane=manage&src=18632&emp=${encodeURIComponent(plan.employeeId)}` });
    usedKeys.push(plan.key);
  }
  if (usedKeys.length) {
    updateCompany(companyId, (draft) => {
      const have = new Set(draft.nightDueNoticeKeys || []);
      for (const key of usedKeys) have.add(key);
      draft.nightDueNoticeKeys = [...have];
    });
  }
  for (const row of opened) {
    const emp = fresh?.employees.find((item) => item.id === row.employeeId);
    if (!emp) continue;
    audit(companyId, "night_rotate_opened", `Night-worker consent opened for ${emp.name} after ${row.months} months (decision 18632).`);
  }
  return { ok: true, opened, notified: plans.length + adminPlans.length };
}

/** 3337 — at 12:00 on a season day: worker + managers when exposed, info line for everyone. Idempotent per day. */
export function openDueHeatBanNotices(companyId, now = new Date()) {
  const data = getCompanyData(companyId);
  if (!data) return { ok: false, notified: 0 };
  const existingKeys = (data.notifications || []).map((row) => row.key).filter(Boolean);
  const plans = planHeatBanNotices({ data, now, existingKeys, laborCalendar: laborCalendarOf(data) });
  for (const plan of plans) addNotification(companyId, plan.userId, plan.text, { key: plan.key, to: "/app/shifts" });
  return { ok: true, notified: plans.length };
}

/** The person a worker reports to — the explicit reporting line, else the branch's manager chain. */
export function directManagerIdOf(data, employee) {
  if (!employee?.id) return null;
  const id = reportsToId(employee, data) || workplaceReportsToId(employee, data);
  return id && String(id) !== String(employee.id) ? String(id) : null;
}

/**
 * Live duty alerts (dutyAlerts.js) → the bell: the worker once per shift per alert, the direct manager
 * once for a real Art. 101 breach. Idempotent per key (shift + alert id). Returns { notified }.
 */
export function openDueDutyAlertNotices(companyId, employeeId, { alerts = [], shiftKey, ar = true } = {}) {
  const data = getCompanyData(companyId);
  const employee = (data?.employees || []).find((row) => String(row.id) === String(employeeId));
  if (!data || !employee || !shiftKey || !alerts.length) return { ok: true, notified: 0 };
  const existingKeys = (data.notifications || []).map((row) => row.key).filter(Boolean);
  const plans = planDutyAlertNotices({ alerts, employee, managerId: directManagerIdOf(data, employee), shiftKey, existingKeys, ar });
  for (const plan of plans) addNotification(companyId, plan.userId, plan.text, { key: plan.key, to: plan.to });
  return { ok: true, notified: plans.length };
}

/** A closed day's proven Art. 101 breaches onto its attendance row (`actualFlags`). Returns the codes added. */
export function recordDutyBreaches(companyId, employeeId, dayKey) {
  const data = getCompanyData(companyId);
  const row = attendanceOnDate(data?.personalAttendance, employeeId, dayKey);
  if (!row || !(row.checkOutAt || row.check_out_at)) return [];
  let added = [];
  updateCompany(companyId, (draft) => {
    const emp = (draft.employees || []).find((item) => String(item.id) === String(employeeId));
    const live = (draft.personalAttendance || []).find((item) => String(item.employeeId ?? item.employee_id) === String(employeeId) && String(item.date || item.dateKey || "").slice(0, 10) === dayKey);
    if (emp && live) added = stampActualDutyBreaches(draft, emp, dayKey, live);
  });
  return added;
}

/**
 * A day closed by its checkout (local, or the cloud row the server returned): its overtime is derived
 * from the actual worked minutes and written to otDecisions automatically — open, pending the
 * manager's pay / compensatory-leave decision (Art. 107), the managers told once («ot_pending:…») —
 * and its Art. 101 breaches land on the row. Later closed days of the week are re-read (week cap).
 * Idempotent: a second call writes nothing new. `row` is the cloud row when the store holds none;
 * `weekPriorOrdinaryMinutes` is the server's own count of the week, when it sent one.
 * Returns { ok, entry, overtimeMinutes }.
 */
export function closeAttendanceDay(companyId, employeeId, dayKey, { row: given = null, weekRows = [], weekPriorOrdinaryMinutes = null } = {}) {
  const day = String(dayKey || "").slice(0, 10);
  let stamped = null;
  updateCompany(companyId, (draft) => {
    const emp = (draft.employees || []).find((item) => String(item.id) === String(employeeId));
    if (!emp) return;
    const live = (draft.personalAttendance || []).find((item) => String(item.employeeId ?? item.employee_id) === String(employeeId) && String(item.date || item.dateKey || "").slice(0, 10) === day);
    const row = live && (live.checkOutAt || live.check_out_at) ? live : (given ? { ...given } : live);
    if (!row || !(row.checkOutAt || row.check_out_at)) return;
    stamped = stampActualOvertime(draft, emp, day, row, { weekRows, weekPriorOrdinaryMinutes });
    if (row === live) stampActualDutyBreaches(draft, emp, day, row);
    // The early leave, in minutes against the published end (her nursing minutes at the end excused,
    // Art. 154) — the duty boards and payroll read it from the row.
    if (row === live) {
      const earlyLeave = earlyLeaveMinutesOf({
        shift: getShiftOnDate(draft, emp, day),
        checkIn: row.checkInAt || row.check_in_at,
        checkOut: row.checkOutAt || row.check_out_at,
        nursingEndMinutes: nursingHourOn(emp, day)?.endMinutes || 0,
      });
      if (earlyLeave > 0) live.earlyLeaveMinutes = earlyLeave;
      else delete live.earlyLeaveMinutes;
    }
    if (stamped?.ok && isOtDecisionOpenEntry(draft.otDecisions?.[`${emp.id}:${day}`])) queueOtPendingNotice(emp.id, day, stamped.holiday);
    restampWeekAfter(draft, emp, day);
  });
  flushOtPendingNotices(companyId);
  const entry = getCompanyData(companyId)?.otDecisions?.[`${employeeId}:${day}`] || null;
  return { ok: !!stamped?.ok, entry, overtimeMinutes: stamped?.ok ? stamped.overtimeMinutes : 0 };
}

/**
 * «عودة متأخرة من الراحة» — the manager's decision on a flex break that ran past its minutes: excused,
 * or noted as late return. Not a legal breach (Art. 101 holds); the decision rides on the punched break
 * (`review`), the same place the cloud `reviewLateReturn` action writes it. Returns { ok } or a named gate.
 */
export function reviewLateReturn(companyId, employeeId, dayKey, { decision, by, byId } = {}) {
  if (decision !== "excused" && decision !== "late") {
    return { ok: false, error: "LATE_RETURN_DECISION", reason: "اختر: يُعذر أو يُسجَّل تأخراً.", reasonEn: "Choose: excused or recorded as late." };
  }
  const data = getCompanyData(companyId);
  const row = attendanceOnDate(data?.personalAttendance, employeeId, dayKey);
  const punched = (row?.breaks || []).filter((item) => item?.source !== "assumed" && item?.start);
  if (!punched.length) return { ok: false, error: "NO_BREAK_PUNCH", reason: "لا راحة مثبتة ببصمة لهذا اليوم.", reasonEn: "No punched break on this day." };
  if (byId && String(byId) === String(employeeId)) {
    return { ok: false, error: "SELF_DECISION", reason: "لا يقرّر الموظف في راحته — القرار لمديره.", reasonEn: "A worker does not decide on their own break — their manager does." };
  }
  updateCompany(companyId, (draft) => {
    const live = (draft.personalAttendance || []).find((item) => String(item.employeeId ?? item.employee_id) === String(employeeId) && String(item.date || item.dateKey || "").slice(0, 10) === dayKey);
    const rows = (live?.breaks || []).filter((item) => item?.source !== "assumed" && item?.start);
    const last = rows[rows.length - 1];
    if (last) last.review = { decision, by: by || "", at: new Date().toISOString() };
  });
  audit(companyId, "late_return_review", `${by || "manager"} marked the break of ${employeeId} on ${dayKey} as ${decision}.`);
  addNotification(companyId, employeeId, decision === "excused"
    ? `عذرك ${by || "مديرك"} في إطالة راحتك يوم ${dayKey} — لا تُسجَّل عودة متأخرة.`
    : `سجّل ${by || "مديرك"} عودتك من الراحة يوم ${dayKey} عودةً متأخرة.`, { to: "/app/attendance" });
  return { ok: true };
}

/** Arts. 69 & 72 — remind managers before the signing/ruling windows close, and the worker of his own. Idempotent per key. */
export function openDueDisciplineDeadlineNotices(companyId, now = new Date()) {
  const data = getCompanyData(companyId);
  if (!data || !(data.disciplinaryCases || []).length) return { ok: true, notified: 0 };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(now);
  const existingKeys = (data.notifications || []).map((row) => row.key).filter(Boolean);
  const plans = planDisciplineDeadlineNotices({
    data,
    today,
    existingKeys,
    audienceOf: (employee) => nightDueAdminAudience(data, employee),
    calendar: laborCalendarOf(data),
  });
  for (const plan of plans) addNotification(companyId, plan.userId, plan.text, { key: plan.key, to: plan.to });
  return { ok: true, notified: plans.length };
}

/** Arts. 58/2 & 60 — remind before a temporary assignment ends, on the day, and once overdue. Idempotent per key. */
export function openDueNecessityNotices(companyId, now = new Date()) {
  const data = getCompanyData(companyId);
  if (!data || !(data.employees || []).some((e) => (e.necessityLog || []).length)) return { ok: true, notified: 0 };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(now);
  const existingKeys = (data.notifications || []).map((row) => row.key).filter(Boolean);
  const plans = planNecessityNotices({ data, today, existingKeys, audienceOf: (employee) => nightDueAdminAudience(data, employee) });
  for (const plan of plans) addNotification(companyId, plan.userId, plan.text, { key: plan.key, to: plan.to });
  return { ok: true, notified: plans.length };
}

/**
 * The religion decides Hajj (Art. 114) and the iddah length (Art. 160). An employee with none on file
 * gets one notice to HR (and to the worker) to complete it. Idempotent per employee.
 */
export function openDueReligionNotices(companyId) {
  const data = getCompanyData(companyId);
  if (!data) return { ok: true, notified: 0 };
  const seen = new Set((data.notifications || []).map((row) => row.key).filter(Boolean));
  let notified = 0;
  for (const emp of data.employees || []) {
    if (!emp?.id || religionOnFile(emp)) continue;
    for (const m of nightDueAdminAudience(data, emp).filter((u) => u?.id && String(u.id) !== String(emp.id))) {
      const key = `religion-missing:${emp.id}:${m.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      addNotification(companyId, m.id, `الديانة غير محددة في ملف ${emp.name || "موظف"} — حدّدها ليظهر له ما يخصه من الإجازات: الحج للمسلم (المادة 114)، ومدة العدة 130 يوماً للمسلمة أو 15 لغيرها (المادة 160).`, { key, to: `/app/employees/${emp.id}?tab=identity` });
      notified += 1;
    }
    const own = `religion-missing:${emp.id}:self`;
    if (!seen.has(own)) {
      seen.add(own);
      addNotification(companyId, emp.id, "ديانتك غير محددة في ملفك — طلبت المنصة من الموارد البشرية تحديدها، وحتى ذلك لا تظهر لك إجازة الحج ولا العدة.", { key: own, to: "/app/requests" });
      notified += 1;
    }
  }
  return { ok: true, notified };
}

/** Model regulation Art. 71 — a grievance not decided in writing within 15 days opens the labour-court window. Idempotent per key. */
export function openDueGrievanceNotices(companyId, now = new Date()) {
  const data = getCompanyData(companyId);
  if (!data) return { ok: true, notified: 0 };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(now);
  const isHoliday = officialHolidayTest(data);
  const seen = new Set((data.notifications || []).map((row) => row.key).filter(Boolean));
  let notified = 0;
  for (const emp of data.employees || []) {
    for (const row of emp.otherRequests || []) {
      if (row?.type !== GRIEVANCE_TYPE || (row.status || "pending") !== "pending") continue;
      const st = grievanceState(row, today, isHoliday);
      if (st?.stage !== "overdue") continue;
      const own = `grievance-overdue:${row.id}:self`;
      if (!seen.has(own)) {
        seen.add(own);
        addNotification(companyId, emp.id, `مضت خمسة عشر يوماً على تظلمك دون بت كتابي — لك الاعتراض أمام المحكمة العمالية حتى ${regulationDate(st.courtBy)} (ثلاثون يوماً عدا العطل الرسمية، النموذج الموحد م71).`, { key: own, to: "/app/requests" });
        notified += 1;
      }
      for (const m of nightDueAdminAudience(data, emp).filter((u) => u?.id && String(u.id) !== String(emp.id))) {
        const key = `grievance-overdue:${row.id}:${m.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        addNotification(companyId, m.id, `تظلم ${emp.name || "موظف"} تجاوز خمسة عشر يوماً دون بت كتابي (كان الموعد ${regulationDate(st.replyBy)}) — صار له الاعتراض أمام المحكمة العمالية (النموذج الموحد م71). بُتّ فيه الآن.`, { key, to: "/app/requests" });
        notified += 1;
      }
    }
  }
  return { ok: true, notified };
}

/** Regs 22 bis — remind the worker before his comp-leave date, and managers once it has passed. Idempotent per key. */
export function openDueCompLeaveNotices(companyId, now = new Date()) {
  const data = getCompanyData(companyId);
  if (!data) return { ok: true, notified: 0 };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(now);
  const existingKeys = (data.notifications || []).map((row) => row.key).filter(Boolean);
  const plans = planCompLeaveNotices({ data, today, existingKeys, audienceOf: (employee) => nightDueAdminAudience(data, employee) });
  for (const plan of plans) addNotification(companyId, plan.userId, plan.text, { key: plan.key, to: plan.to });
  return { ok: true, notified: plans.length };
}

/**
 * The worker is at work on a day his approved leave covers: cut the leave from that day. Days before
 * stay leave; the rest is cancelled and returns to the balance. Managers are told. Art. 151's six
 * mandatory weeks after birth cannot be cut.
 */
export function cutLeaveForAttendance(companyId, employeeId, { day, actorId } = {}) {
  if (actorId && String(actorId) !== String(employeeId)) {
    return { ok: false, error: "SELF_ONLY", reason: "يقطع الإجازة صاحبها فقط حين يحضر.", reasonEn: "Only the worker cuts his own leave when he reports." };
  }
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  const dayKey = String(day || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date())).slice(0, 10);
  const plan = planLeaveCutForAttendance(emp, dayKey, {
    chargeable: (start, end, type) => chargeableLeaveDays(start, end, type, laborCalendarOf(data), data, emp),
  });
  if (!plan.ok) return plan.reason ? plan : { ok: false, error: plan.error, reason: "لا إجازة معتمدة في هذا اليوم.", reasonEn: "No approved leave on this day." };
  updateCompany(companyId, (d) => {
    const e = d.employees.find((row) => row.id === employeeId);
    const r = (e?.leaveRequests || []).find((row) => row.id === plan.leave.id);
    if (!r) return;
    r.cutOn = dayKey;
    r.originalEndDate = r.originalEndDate || plan.end;
    r.auditTrail = [...(r.auditTrail || []), { at: new Date().toISOString(), actor: e?.name || "", verb: "cut", note: `حضر للعمل في ${dayKey} — قُطعت الإجازة من هذا اليوم` }];
    if (plan.whole) {
      r.status = "withdrawn";
      r.withdrawnReason = "attended";
    } else {
      r.endDate = plan.newEnd;
      if (r.activeEndDate) r.activeEndDate = plan.newEnd;
      r.days = plan.keptDays;
    }
  });
  const label = leaveTypeLabel(plan.type, true);
  addNotification(companyId, employeeId, plan.whole
    ? `أُلغيت إجازتك (${label}) لأنك حضرت في يوم بدئها — عادت أيامها إلى رصيدك.`
    : `قُطعت إجازتك (${label}) من ${regulationDate(dayKey)} لأنك حضرت — بقي ${daysAr(plan.keptDays)} إجازة، وعاد ${daysAr(plan.freedDays)} إلى رصيدك.`, { to: "/app/requests" });
  const fresh = getCompanyData(companyId);
  const e2 = fresh?.employees.find((row) => row.id === employeeId);
  for (const m of nightDueAdminAudience(fresh, e2).filter((u) => u?.id && String(u.id) !== String(employeeId))) {
    addNotification(companyId, m.id, `${e2?.name || "موظف"} حضر للعمل في ${regulationDate(dayKey)} أثناء إجازته (${label}) — قُطعت الإجازة من ذلك اليوم وعاد ${daysAr(plan.freedDays)} لرصيده.`, { key: `leavecut:${plan.leave.id}:${dayKey}:${m.id}`, to: "/app/requests/manage" });
  }
  audit(companyId, "leave_cut_attended", `${e2?.name || employeeId} cut leave ${plan.leave.id} from ${dayKey} (attended).`);
  invokeWorkforce({ action: "cutLeave", companyId, employeeId, day: dayKey, keptDays: plan.keptDays });
  return { ok: true, ...plan, leave: undefined };
}

/** Art. 79 bis(1): postpone accepting a resignation — once, before the 30 days end, ≤ 60 days, written reason to the worker. */
export function postponeResignation(companyId, employeeId, requestId, { days, reason, actorId, actorName } = {}) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  const req = (emp?.otherRequests || []).find((row) => row.id === requestId);
  if (!req || req.type !== RESIGNATION_TYPE) return { ok: false, error: "NOT_FOUND", reason: "الطلب غير موجود.", reasonEn: "Request not found." };
  if (actorId && String(actorId) === String(employeeId)) return { ok: false, error: "SELF", reason: "لا تقرر في استقالتك.", reasonEn: "You cannot decide your own resignation." };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const gate = checkPostponeResignationGate({ row: req, days, reason, today });
  if (!gate.ok) return gate;
  updateCompany(companyId, (d) => {
    const e = d.employees.find((row) => row.id === employeeId);
    const r = (e?.otherRequests || []).find((row) => row.id === requestId);
    if (!r) return;
    r.postponedUntil = gate.until;
    r.postponeReason = String(reason).trim();
    r.postponedAt = today;
    r.postponedBy = actorName || "";
    r.auditTrail = [...(r.auditTrail || []), { at: new Date().toISOString(), actor: actorName || "", verb: "postpone", note: `أُجّل القبول ${gate.days} يوماً حتى ${gate.until} — ${String(reason).trim()}` }];
  });
  addNotification(companyId, employeeId, `أُجّل قبول استقالتك ${daysAr(gate.days)} حتى ${regulationDate(gate.until)} — الإيضاح: ${String(reason).trim()}. ينتهي عقدك بقبولها أو بنهاية التأجيل، وعقدك سارٍ حتى ذلك (المادة 79 مكرر).`, { to: "/app/requests" });
  audit(companyId, "resignation_postponed", `Resignation of ${emp?.name || employeeId} postponed to ${gate.until}.`);
  invokeWorkforce({ action: "postponeResignation", companyId, employeeId, requestId, days: gate.days, reason: String(reason).trim() });
  return { ok: true, until: gate.until };
}

/** Art. 79 bis(1)(2): a resignation with no reply for 30 days — or at the end of its postponement — is accepted by law. */
export function settleDueResignations(companyId, now = new Date()) {
  const data = getCompanyData(companyId);
  if (!data) return { ok: true, settled: 0 };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(now);
  const due = dueResignations(data, today);
  if (!due.length) return { ok: true, settled: 0 };
  invokeWorkforce({ action: "settleResignations", companyId });
  updateCompany(companyId, (d) => {
    for (const item of due) {
      const e = d.employees.find((row) => row.id === item.employeeId);
      const r = (e?.otherRequests || []).find((row) => row.id === item.requestId);
      if (!e || !r) continue;
      if (item.via === "notice75") {
        // Art. 75: the notice ran out — the open-ended contract ends; nothing was to be accepted.
        r.status = "approved";
        r.settledAt = today;
        r.reviewedBy = r.reviewedBy || "بحكم النظام";
        r.reviewedAt = r.reviewedAt || new Date().toISOString();
        r.approvedAt = r.approvedAt || r.reviewedAt;
        const ex = e.profile?.contractExit || {};
        e.profile = { ...(e.profile || {}), contractExit: { ...ex, reason: "resignation", route: EXIT_ROUTE_NOTICE75, party: "worker", noticeAt: r.date || "", effectiveDate: item.endsOn, status: "ended", endedAt: item.endsOn } };
        continue;
      }
      r.status = "approved";
      r.deemedAccepted = item.via;
      r.reviewedBy = "بحكم النظام";
      r.reviewedAt = new Date().toISOString();
      r.approvedAt = r.reviewedAt;
      const exit = e.profile?.contractExit || {};
      e.profile = {
        ...(e.profile || {}),
        contractExit: { ...exit, reason: "resignation", party: "worker", resignationSubmittedAt: r.date || "", effectiveDate: item.endsOn, status: "accepted", acceptedAt: item.endsOn, deemed: item.via },
      };
    }
  });
  for (const item of due) {
    const fresh = getCompanyData(companyId);
    const e = fresh?.employees.find((row) => row.id === item.employeeId);
    if (item.via === "notice75") {
      addNotification(companyId, item.employeeId, `انقضت مهلة إشعارك — انتهى عقدك غير محدد المدة في ${regulationDate(item.endsOn)} (المادة 75). مستحقاتك كاملة وفق النظام.`, { key: `resign:${item.requestId}:notice75:${item.employeeId}`, to: "/app/requests" });
      for (const m of nightDueAdminAudience(fresh, e).filter((u) => u?.id && String(u.id) !== String(item.employeeId))) {
        addNotification(companyId, m.id, `انتهى عقد ${e?.name || "موظف"} بانقضاء مهلة إشعاره في ${regulationDate(item.endsOn)} (المادة 75) — ابدأ إجراءات إنهاء الخدمة.`, { key: `resign:${item.requestId}:notice75:${m.id}`, to: `/app/employees/${item.employeeId}` });
      }
      continue;
    }
    addNotification(companyId, item.employeeId, item.via === "postponement"
      ? `انتهت مدة تأجيل استقالتك — قُبلت بحكم النظام، وينتهي عقدك في ${regulationDate(item.endsOn)} (المادة 79 مكرر).`
      : `مضى ثلاثون يوماً على استقالتك دون رد — تُعد مقبولة، وينتهي عقدك في ${regulationDate(item.endsOn)} (المادة 79 مكرر).`, { key: `resign:${item.requestId}:deemed:${item.employeeId}`, to: "/app/requests" });
    for (const m of nightDueAdminAudience(fresh, e).filter((u) => u?.id && String(u.id) !== String(item.employeeId))) {
      addNotification(companyId, m.id, `استقالة ${e?.name || "موظف"} قُبلت بحكم النظام في ${regulationDate(item.endsOn)} (المادة 79 مكرر) — ابدأ إجراءات إنهاء الخدمة.`, { key: `resign:${item.requestId}:deemed:${m.id}`, to: `/app/employees/${item.employeeId}` });
    }
  }
  return { ok: true, settled: due.length };
}

/** Worker agrees or refuses from the file. Written consent stays until withdrawn. */
export function answerNightRotate(companyId, employeeId, requestId, decision, { acknowledged, paper, note, actorId } = {}) {
  const actorGate = checkNightEmployeeActorGate({ employeeId, actorId });
  if (!actorGate.ok) return actorGate;
  const data0 = getCompanyData(companyId);
  const emp0 = data0?.employees.find((row) => row.id === employeeId);
  const req0 = (emp0?.otherRequests || []).find((row) => row.id === requestId);
  const gate = checkNightAgreeGate({
    decision,
    acknowledged,
    paper: paper || req0?.paper,
    note,
  });
  if (!gate.ok) return gate;
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  const req = (emp?.otherRequests || []).find((row) => row.id === requestId);
  if (!emp || !req || req.type !== "night_consent" || (req.status || "pending") !== "pending") {
    return { ok: false, error: "REQUEST_NOT_FOUND", reason: "الطلب غير موجود.", reasonEn: "That request was not found." };
  }
  if (nightRotateStage(req) !== "active") {
    return { ok: false, error: "ALREADY_ANSWERED", reason: "أُجيبت هذه الموافقة.", reasonEn: "This consent was already answered." };
  }
  const now = new Date().toISOString();
  const weekStart = weekStartDate(new Date());
  let applied = { moved: 0 };
  updateCompany(companyId, (draft) => {
    const employee = draft.employees.find((row) => row.id === employeeId);
    const request = (employee?.otherRequests || []).find((row) => row.id === requestId);
    if (!employee || !request) return;
    request.status = decision === "refuse" ? "rejected" : "approved";
    request.decision = decision;
    request.violation = false;
    if (paper?.name || paper?.url) {
      request.paper = {
        name: paper.name || request.paper?.name || "",
        hash: paper.hash || request.paper?.hash || "",
        url: paper.url || request.paper?.url || "",
        size: paper.size || request.paper?.size || 0,
      };
    }
    request.acknowledgedAt = now;
    request.acknowledgedBy = employee.name;
    request.attestation = decision === "agree"
      ? "أقرّ بموافقتي على الاستمرار كعامل ليلي وفق القرار 18632، مع حق التراجع في أي وقت."
      : decision === "reduce"
        ? "أختار تقليص ساعات الليل تحت 3 ساعات في نافذة 23:00–06:00 وفق القرار 18632."
        : "أرفض الاستمرار كعامل ليلي وأطلب التدوير لساعات عادية شهراً على الأقل.";
    request.decidedAt = now;
    request.reviewedBy = employee.name;
    request.reviewedAt = now;
    if (decision === "refuse") {
      const refuseReason = String(note || "").trim() || request.attestation;
      request.reviewNote = refuseReason;
      request.rejectReason = refuseReason;
    }
    employee.profile = employee.profile || {};
    if (decision === "agree") {
      employee.profile.nightConsentAt = now;
      employee.profile.nightConsentWithdrawnAt = undefined;
      employee.profile.nightHoursReducedAt = undefined;
    } else if (decision === "reduce") {
      employee.profile.nightHoursReducedAt = now;
      employee.profile.nightConsentWithdrawnAt = undefined;
      employee.profile.nightAllowance = undefined;
      employee.profile.nightRemedy = { kind: "reduce", at: now, byId: employeeId, source: "employee" };
    } else {
      employee.profile.nightConsentWithdrawnAt = now;
    }
    if (decision === "reduce" || decision === "refuse") {
      const schedule = nightRosterOf(draft, employee, weekStart);
      applied = applyNightWorkerDecision(schedule, employee.id, decision, weekStart, { notBefore: new Date() });
      request.appliedShiftId = applied.shiftId;
      request.appliedDays = applied.moved;
      const key = weekKeyFromDate(weekStart);
      schedule.weekDirty = schedule.weekDirty || {};
      schedule.weekDirty[key] = true;
    }
  });
  const fresh = getCompanyData(companyId);
  const person = fresh?.employees.find((row) => row.id === employeeId);
  const text = decision === "agree"
    ? `${person?.name || ""} وافق على الاستمرار كعامل ليلي. الموافقة محفوظة مع حق التراجع في أي وقت.`
    : decision === "reduce"
      ? `${person?.name || ""} اختار تقليص ساعات الليل — أُخرج من صفة العامل الليلي هذا الأسبوع (${applied.moved || 0} يوماً).`
      : `${person?.name || ""} رفض الاستمرار كعامل ليلي — يُدوَّر لساعات عادية شهراً على الأقل.`;
  for (const id of nightRotateAudienceIds(fresh, person)) {
    if (id === employeeId) continue;
    addNotification(companyId, id, text);
  }
  addNotification(
    companyId,
    employeeId,
    decision === "agree"
      ? "سُجّلت موافقتك الخطية على الاستمرار كعامل ليلي. يحق لك سحبها في أي وقت من طلباتي وفق القرار 18632."
      : decision === "reduce"
        ? "سُجّل اختيارك تقليص الساعات. الجدول يطبّق وردية تحت 3 ساعات في نافذة الليل."
        : "سُجّل رفضك. أُخرجت من صفة العامل الليلي إلى ساعات عادية لمدة شهر على الأقل.",
  );
  const nightVerb = decision === "refuse" ? "refuse" : decision === "agree" ? "agree" : "revise";
  const nightNote = decision === "refuse"
    ? (String(note || "").trim() || "رفض الاستمرار كعامل ليلي وأطلب التدوير لساعات عادية شهراً على الأقل.")
    : (decision === "agree"
      ? "أقرّ بموافقتي على الاستمرار كعامل ليلي وفق القرار 18632، مع حق التراجع في أي وقت."
      : "أختار تقليص ساعات الليل تحت 3 ساعات في نافذة 23:00–06:00 وفق القرار 18632.");
  const stamped = decision === "refuse"
    ? stampRefuseAudit(companyId, person, { ...req, type: "night_consent", id: requestId, decisionId: "18632" }, {
      actor: person?.name || employeeId,
      note: nightNote,
      family: "other",
    })
    : stampRequestAudit(companyId, person, { ...req, type: "night_consent", id: requestId, decisionId: "18632" }, {
      actor: person?.name || employeeId,
      note: nightNote,
      family: "other",
      verb: nightVerb,
    });
  updateCompany(companyId, (draft) => {
    const employee = draft.employees.find((row) => row.id === employeeId);
    const request = (employee?.otherRequests || []).find((row) => row.id === requestId);
    if (request) {
      request.auditTrail = decision === "refuse"
        ? appendRequestRefuseAudit(request, stamped.row)
        : appendRequestAudit(request, stamped.row);
    }
    pushEmployeeFileLog(employee, stamped.log);
  });
  // The worker answered: the «وافق أو ارفض» notice has done its job.
  updateCompany(companyId, (d) => {
    for (const row of d.notifications || []) {
      if (String(row.userId) === String(employeeId) && String(row.key || "").startsWith(`18632-due:${employeeId}:`)) row.read = true;
    }
  });
  return { ok: true, decision, applied };
}

/** Worker withdraws written night consent at any time — 18632 حق التراجع. */
export function withdrawNightRotate(companyId, employeeId, requestId, { acknowledged, actorId } = {}) {
  const actorGate = checkNightEmployeeActorGate({ employeeId, actorId });
  if (!actorGate.ok) return actorGate;
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  const req = (emp?.otherRequests || []).find((row) => row.id === requestId);
  const gate = checkWithdrawNightConsentGate({ request: req, acknowledged });
  if (!gate.ok) return gate;
  const weekStart = weekStartDate(new Date());
  const now = new Date().toISOString();
  let applied = { moved: 0 };
  updateCompany(companyId, (draft) => {
    const employee = draft.employees.find((row) => row.id === employeeId);
    const request = (employee?.otherRequests || []).find((row) => row.id === requestId);
    if (!employee || !request) return;
    request.status = "withdrawn";
    request.withdrawnAt = now;
    request.reviewedBy = employee.name;
    request.reviewedAt = now;
    request.attestation = "أسحب موافقتي الخطية على الاستمرار كعامل ليلي وفق القرار 18632، وأطلب التدوير لساعات عادية شهراً على الأقل.";
    employee.profile = employee.profile || {};
    employee.profile.nightConsentWithdrawnAt = now;
    const schedule = nightRosterOf(draft, employee, weekStart);
    applied = applyNightWorkerDecision(schedule, employee.id, "refuse", weekStart, { notBefore: new Date() });
    request.appliedShiftId = applied.shiftId;
    request.appliedDays = applied.moved;
    const key = weekKeyFromDate(weekStart);
    schedule.weekDirty = schedule.weekDirty || {};
    schedule.weekDirty[key] = true;
  });
  const fresh = getCompanyData(companyId);
  const person = fresh?.employees.find((row) => row.id === employeeId);
  const withdrawKey = `18632-withdrawn:${employeeId}:${requestId}`;
  for (const id of nightRotateAudienceIds(fresh, person)) {
    if (id === employeeId) continue;
    addNotification(
      companyId,
      id,
      `${person?.name || ""} سحب موافقته الخطية على العمل الليلي (القرار 18632). يُدوَّر لساعات عادية شهراً على الأقل.`,
      { key: `${withdrawKey}:${id}` },
    );
  }
  addNotification(
    companyId,
    employeeId,
    "سحبت موافقتك الخطية. أُخرجت من صفة العامل الليلي إلى ساعات عادية لمدة شهر على الأقل.",
  );
  const withdrawStamp = stampRequestAudit(companyId, person, { ...req, type: "night_consent", id: requestId, decisionId: "18632" }, {
    actor: person?.name || employeeId,
    note: "أسحب موافقتي الخطية على الاستمرار كعامل ليلي وفق القرار 18632.",
    family: "other",
    verb: "withdraw",
  });
  updateCompany(companyId, (draft) => {
    const employee = draft.employees.find((row) => row.id === employeeId);
    const request = (employee?.otherRequests || []).find((row) => row.id === requestId);
    if (request) request.auditTrail = appendRequestAudit(request, withdrawStamp.row);
    pushEmployeeFileLog(employee, withdrawStamp.log);
  });
  return { ok: true, decision: "withdraw", applied };
}

function firstNightDutyHours(schedule, employeeId, weekStart) {
  for (const key of weekDateKeys(weekStart)) {
    const shift = employeeShiftOnDay(schedule, employeeId, key);
    if (isNightWorker(shift, key)) return shiftHours(shift);
  }
  return null;
}

function stampNightRemedy(profile, kind, { at, byId, cutHours, fromHours, amount, allowanceKind } = {}) {
  const next = profile || {};
  const cut = nightReduceCutHours(cutHours);
  const pay = nightAllowanceAmount(amount);
  const payKind = nightAllowanceKind(allowanceKind);
  next.nightRemedy = {
    kind,
    at,
    byId,
    source: "management",
    ...(kind === "reduce" && cut ? { cutHours: cut, fromHours: fromHours || undefined } : {}),
    ...(kind === "allowance" && pay ? { amount: pay, allowanceKind: payKind || "pay" } : {}),
  };
  if (kind === "allowance") {
    next.nightAllowance = pay || true;
    next.nightHoursReducedAt = undefined;
  } else if (kind === "reduce") {
    next.nightHoursReducedAt = at;
    next.nightHoursCut = cut || undefined;
    next.nightAllowance = undefined;
  } else {
    next.nightHoursReducedAt = undefined;
    next.nightHoursCut = undefined;
    next.nightAllowance = undefined;
  }
  return next;
}

function currentPayrollMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function syncNightAllowanceOnPayrollDraft(draft, employee) {
  if (!employee) return;
  const run = (draft.payrollRuns || []).find((row) => row.month === currentPayrollMonthKey());
  if (!run) return;
  const item = (run.items || []).find((row) => row.employeeId === employee.id);
  if (!item || item.paid) return;
  const wage = employeeWageSplit(employee.profile || {}, employee);
  item.allowances = wage.allowances;
  item.nightAllowance = wage.night;
  if (wage.split) {
    item.housingAllowance = wage.housing;
    item.transportAllowance = wage.transport;
    item.otherAllowances = wage.other;
  }
  if (item.qiwaWage != null) item.qiwaWage = (Number(item.base) || 0) + item.allowances;
}

/** Establishment chooses reduce, allowance, or a change of night work. */
/** The roster that holds a worker's nights inside the draft (own station, else a covered one). */
function nightRosterOf(draft, employee, weekStart) {
  const held = nightScheduleFor(draft, employee, weekStart);
  return (draft.schedules || []).includes(held) ? held : getOrCreateSchedule(draft, employee.stationId);
}

function nightActorIsHead(companyId, actorId) {
  const data = getCompanyData(companyId);
  const actor = (data?.employees || []).find((row) => String(row.id) === String(actorId)) || (actorId ? { id: actorId } : null);
  return !!actor && isCompanyHeadPerson(actor, data);
}

export function decideNightRemedy(companyId, employeeId, kind, { actorId, ordinaryKind, applyRoster = true, cutHours, amount, allowanceKind, weekStart: viewedWeek } = {}) {
  const gate = checkDecideNightRemedyGate({ kind, employeeId, actorId, actorIsHead: nightActorIsHead(companyId, actorId), cutHours, amount, allowanceKind });
  if (!gate.ok) return gate;
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  if (!emp) {
    return { ok: false, error: "EMPLOYEE_REQUIRED", reason: "الموظف غير موجود.", reasonEn: "That employee was not found." };
  }
  const now = new Date().toISOString();
  // The week the manager is looking at — never silently the current week.
  const weekStart = weekStartDate(viewedWeek || new Date());
  let applied = { moved: 0 };
  const cut = nightReduceCutHours(cutHours);
  const pay = nightAllowanceAmount(amount);
  const payKind = nightAllowanceKind(allowanceKind);
  updateCompany(companyId, (draft) => {
    const employee = draft.employees.find((row) => row.id === employeeId);
    if (!employee) return;
    // The roster that holds his nights (own station, else a covered one) — the same one the 18632 row reads.
    const schedule = nightRosterOf(draft, employee, weekStart);
    const fromHours = kind === "reduce" ? firstNightDutyHours(schedule, employee.id, weekStart) : null;
    employee.profile = stampNightRemedy(employee.profile || {}, kind, {
      at: now,
      byId: actorId,
      cutHours: cut,
      fromHours,
      amount: pay,
      allowanceKind: payKind,
    });
    if (kind === "allowance") syncNightAllowanceOnPayrollDraft(draft, employee);
    if (!applyRoster || kind === "allowance") return;
    applied = applyNightWorkerDecision(schedule, employee.id, kind === "reduce" ? "reduce" : "rotate", weekStart, { ordinaryKind, cutHours: cut, notBefore: new Date() });
    // Remember the week the cut was applied to, so «سحب» can put the full night back there.
    if (kind === "reduce" && employee.profile?.nightRemedy) employee.profile.nightRemedy.weekKey = weekKeyFromDate(weekStart);
    const key = weekKeyFromDate(weekStart);
    schedule.weekDirty = schedule.weekDirty || {};
    schedule.weekDirty[key] = true;
  });
  const fresh = getCompanyData(companyId);
  const person = fresh?.employees.find((row) => row.id === employeeId);
  const cutLabel = nightCutHoursLabel(cut, true);
  const payLabel = nightAllowancePayLabel(pay, payKind, true);
  // Said to the worker, in second person, with the week and where to see it.
  const weekIso = weekKeyFromDate(weekStart);
  const text = kind === "allowance"
    ? `سجّلت المنشأة لك ${payLabel} عن العمل الليلي (القرار 18632). يُصرف مع الراتب.`
    : kind === "reduce"
      ? `قُلّصت ساعات لياليك ${cutLabel} في أسبوع ${weekIso} (${applied.moved || 0} يوماً) — القرار 18632. تجدها في جدولي.`
      : `حُوِّلت لياليك إلى ساعات عادية في أسبوع ${weekIso} — القرار 18632. تجدها في جدولي.`;
  addNotification(companyId, employeeId, text, { to: kind === "allowance" ? "/app/payroll?view=self&tab=payslip" : `/app/shifts?week=${weekIso}` });
  audit(companyId, kind === "allowance" ? "night_allowance_recorded" : kind === "reduce" ? "night_hours_reduced" : "night_work_changed", `Night remedy ${kind}${cut ? ` −${cut}h` : pay ? ` ${payKind} ${pay}` : ""} by management for ${person?.name || employeeId}.`);
  return { ok: true, kind, applied, cutHours: cut || null, amount: pay || null, allowanceKind: payKind || null };
}

/** Withdraw a recorded reduction or allowance and start the 18632 choice over. */
export function withdrawNightRemedy(companyId, employeeId, { actorId, weekStart: viewedWeek } = {}) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  const gate = checkWithdrawNightRemedyGate({ employee: emp, employeeId, actorId, actorIsHead: nightActorIsHead(companyId, actorId) });
  if (!gate.ok) return gate;
  const now = new Date().toISOString();
  const previous = emp?.profile?.nightRemedy?.kind;
  updateCompany(companyId, (draft) => {
    const employee = draft.employees.find((row) => row.id === employeeId);
    if (!employee) return;
    employee.profile = employee.profile || {};
    if (employee.profile.nightRemedy) {
      employee.profile.nightRemedy = { ...employee.profile.nightRemedy, withdrawnAt: now, withdrawnById: actorId };
    }
    employee.profile.nightHoursReducedAt = undefined;
    employee.profile.nightHoursCut = undefined;
    employee.profile.nightAllowance = undefined;
    syncNightAllowanceOnPayrollDraft(draft, employee);
    // A withdrawn cut puts the full night back on the roster (the week it was cut, and the viewed week).
    if (previous === "reduce") {
      const held = nightScheduleFor(draft, employee, viewedWeek || new Date());
      const schedule = (draft.schedules || []).includes(held) ? held : getOrCreateSchedule(draft, employee.stationId);
      const weeks = new Set([emp?.profile?.nightRemedy?.weekKey, weekKeyFromDate(weekStartDate(viewedWeek || new Date()))].filter(Boolean));
      for (const key of weeks) {
        const restored = restoreCutNightDays(schedule, employee.id, key);
        if (restored.moved) {
          schedule.weekDirty = schedule.weekDirty || {};
          schedule.weekDirty[key] = true;
        }
      }
    }
  });
  const fresh = getCompanyData(companyId);
  const person = fresh?.employees.find((row) => row.id === employeeId);
  addNotification(
    companyId,
    employeeId,
    previous === "reduce"
      ? "سحبَت المنشأة تقليص ساعات الليل. يُختار من جديد: تقليص أو بدل أو تغيير العمل الليلي."
      : "سحبَت المنشأة البدل الليلي. يُختار من جديد: تقليص أو بدل أو تغيير العمل الليلي.",
  );
  audit(companyId, "night_remedy_withdrawn", `Night remedy ${previous} withdrawn for ${person?.name || employeeId} — start over.`);
  return { ok: true, decision: "withdraw", previous };
}

/** إدارة may ping the worker — never agree, refuse, or close the 18632 file. */
export function remindNightDue(companyId, employeeId, { byId, byName } = {}) {
  if (!byId || String(byId) === String(employeeId)) {
    return {
      ok: false,
      error: "MANAGER_REMIND",
      reason: "التذكير من الإدارة للموظف — دون موافقة أو رفض في النظام.",
      reasonEn: "The reminder is from management to the worker — no agree or refuse in the system.",
    };
  }
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  if (!emp) {
    return { ok: false, error: "EMPLOYEE_NOT_FOUND", reason: "الموظف غير موجود.", reasonEn: "That employee was not found." };
  }
  const pending = pendingNightRotate(emp);
  if (!pending) {
    return {
      ok: false,
      error: "NOT_DUE",
      reason: "لا موافقة ليلية بانتظار الموظف.",
      reasonEn: "No night consent is waiting for the worker.",
    };
  }
  const key = `18632-remind:${byId}:${employeeId}:${pending.cycleKey || nightCycleKey(new Date())}`;
  addNotification(
    companyId,
    employeeId,
    `تذكير من ${byName || "الإدارة"}: موافقة العمل الليلي (18632) بانتظارك في ملفي. الإدارة لا توافق عنك ولا ترفض.`,
    { key },
  );
  return { ok: true, key };
}

/** Manager cannot close an unanswered night notice. Silence leaves it in force. */
export function decideNightRotate(companyId, employeeId, requestId, status, reviewerName, note) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  const req = (emp?.otherRequests || []).find((row) => row.id === requestId);
  if (!emp || !req || req.type !== "night_consent") {
    return { ok: false, error: "REQUEST_NOT_FOUND", reason: "الطلب غير موجود.", reasonEn: "That request was not found." };
  }
  if (nightRotateStage(req) === "active") {
    return {
      ok: false,
      error: "EMPLOYEE_MUST_AGREE",
      reason: "سارية وحمراء حتى يوافق الموظف على نفس الوردية الليلية. سكوت المدير يبقيها.",
      reasonEn: "It stays in force and red until the worker agrees to the same night shift. Manager silence leaves it open.",
    };
  }
  if (String(note || "").trim()) {
    updateCompany(companyId, (draft) => {
      const request = (draft.employees.find((row) => row.id === employeeId)?.otherRequests || []).find((row) => row.id === requestId);
      if (!request) return;
      request.reviewNote = String(note).trim();
      request.reviewedBy = reviewerName;
      request.reviewedAt = new Date().toISOString();
    });
  }
  void status;
  return { ok: true, stayed: true };
}

/** Art. 109 entitlement-year notices — once at year open, once when 30 days remain. */
export function openDueAnnualLeaveNotices(companyId, onDate) {
  const data = getCompanyData(companyId);
  if (!data) return { ok: false, opened: [] };
  const dueList = collectDueAnnualLeaveNotices(data, onDate);
  if (!dueList.length) return { ok: true, opened: [] };
  const opened = [];
  updateCompany(companyId, (draft) => {
    for (const row of dueList) {
      const emp = draft.employees.find((item) => item.id === row.employee.id);
      if (!emp) continue;
      emp.profile = emp.profile || {};
      emp.profile.annualEntitlementNoticeKey = row.due.noticeKey;
      opened.push({ employeeId: emp.id, name: emp.name, kind: row.due.kind, remaining: row.due.remaining });
    }
  });
  for (const row of opened) {
    const due = dueList.find((item) => item.employee.id === row.employeeId)?.due;
    if (!due) continue;
    addNotification(companyId, row.employeeId, annualEntitlementNoticeText(due, "", getUiLang()));
    audit(companyId, "annual_leave_entitlement_notice", `Article 109 ${row.kind} notice for ${row.name} (${row.remaining} days).`);
  }
  return { ok: true, opened };
}

export function saveEmployeeOffboarding(companyId, employeeId, offboarding) {
  updateEmployeeProfile(companyId, employeeId, { offboarding });
}

export async function completeEmployeeOffboarding(companyId, employeeId, offboarding) {
  const res = await invokeDirectory({ action: "disableEmployeeAccess", companyId, employeeId });
  if (!res?.data?.ok) throw new Error("OFFBOARDING_FAILED");
  const next = { ...offboarding, status: "completed", completedAt: new Date().toISOString() };
  updateCompany(companyId, (d) => {
    const emp = d.employees.find((e) => e.id === employeeId);
    if (!emp) return;
    const lastWorkplaceId = emp.stationId || emp.profile?.lastWorkplaceId || null;
    const lastWorkplaceName = (d.stations || []).find((row) => String(row.id) === String(lastWorkplaceId))?.name
      || emp.profile?.lastWorkplaceName
      || "";
    emp.profile = {
      ...(emp.profile || {}),
      employmentStatus: "terminated",
      offboarding: next,
      lastWorkplaceId,
      lastWorkplaceName,
      employmentEndedAt: next.completedAt,
    };
    emp.stationId = null; emp.managedStations = []; emp.actingAssignments = []; emp.hrLevelId = null; emp.hrStationId = null; emp.hrClusterId = null;
    (d.orgSeats || []).forEach((seat) => {
      if (String(seat.employeeId) !== String(employeeId)) return;
      seat.employeeId = null;
      seat.filledAt = null;
      seat.vacatedAt = new Date().toISOString();
      seat.hireOpen = true;
    });
    d.orgTree = (d.orgTree || []).filter((node) => !(node.type === "employee" && String(node.refId) === String(employeeId)));
    d.stations.forEach((station) => { if (station.managerId === employeeId) station.managerId = null; });
    (d.orgSeats || []).forEach((seat) => {
      const title = String(seat.title || "");
      if (!(title.includes("مدير الفرع") || /branch manager/i.test(title))) return;
      const station = (d.stations || []).find((item) => String(item.id) === String(seat.stationId));
      if (station) station.managerId = seat.employeeId || null;
    });
    (d.schedules || []).forEach((schedule) => Object.values(schedule.assignments || {}).forEach((day) => Object.keys(day).forEach((shift) => { day[shift] = (day[shift] || []).filter((id) => id !== employeeId); })));
  });
  return next;
}

// Manual presence status the employee sets for themself (online/away/busy/call).
export function setPresenceStatus(companyId, employeeId, status) {
  updateCompany(companyId, (d) => {
    const emp = d.employees.find((e) => e.id === employeeId);
    if (!emp) return;
    emp.presenceStatus = status;
  });
}

export function addCertificate(companyId, employeeId, cert) {
  updateCompany(companyId, (d) => {
    const emp = d.employees.find((e) => e.id === employeeId);
    if (!emp) return;
    emp.certificates = emp.certificates || [];
    emp.certificates.push({ id: uid("cert"), status: "pending", ...cert, createdAt: new Date().toISOString() });
  });
  // Route the new upload to the assigned HR manager for this employee's station, if any.
  const data = getCompanyData(companyId);
  const hrManager = getStationHRManager(data, employeeId);
  if (hrManager) {
    const emp = data.employees.find((e) => e.id === employeeId);
    addNotification(companyId, hrManager.id, `${emp?.name || ""} uploaded a new certificate for your approval.`);
  }
}

export function removeCertificate(companyId, employeeId, certId) {
  updateCompany(companyId, (d) => {
    const emp = d.employees.find((e) => e.id === employeeId);
    if (!emp) return;
    emp.certificates = (emp.certificates || []).filter((c) => c.id !== certId);
  });
}

// Qualification/certification approval workflow — manager approves or rejects a pending upload.
export function setCertificateStatus(companyId, employeeId, certId, status, reviewerName) {
  const empName = getCompanyData(companyId)?.employees.find((e) => e.id === employeeId)?.name || "";
  audit(companyId, `certificate_${status}`, `Certificate for ${empName} marked "${status}" by ${reviewerName || "manager"}.`);
  updateCompany(companyId, (d) => {
    const emp = d.employees.find((e) => e.id === employeeId);
    if (!emp) return;
    const cert = (emp.certificates || []).find((c) => c.id === certId);
    if (!cert) return;
    cert.status = status;
    cert.reviewedBy = reviewerName;
    cert.reviewedAt = new Date().toISOString();
  });
}

// Manager-adjustable total allowed days per leave category.
export function setLeaveTotal(companyId, employeeId, type, total) {
  updateCompany(companyId, (d) => {
    const emp = d.employees.find((e) => e.id === employeeId);
    if (!emp) return;
    emp.profile = emp.profile || {};
    emp.profile.leaveTotals = emp.profile.leaveTotals || {};
    emp.profile.leaveTotals[type] = (() => {
      const floor = statutoryLeaveFloor(type, emp.profile);
      const next = Math.max(0, Number(total) || 0);
      return floor == null ? next : Math.max(next, floor);
    })();
  });
}

// Per-employee official communication — company HR channel always works; tree is optional.
export function addHRMessage(companyId, employeeId, { from, targetId, targetName, text, files, senderName, channel }) {
  let recipientIds = [];
  updateCompany(companyId, (d) => {
    const emp = d.employees.find((e) => e.id === employeeId);
    if (!emp) return;
    emp.hrMessages = emp.hrMessages || [];
    emp.hrMessages.push({
      id: uid("msg"),
      from,
      targetId,
      targetName,
      channel: channel || (String(targetId || "").startsWith("channel:") ? "company" : "tree"),
      text,
      files: files || [],
      senderName,
      createdAt: new Date().toISOString(),
    });
  });
  // Resolve recipients after write — uses live company snapshot.
  try {
    // Lazy import path via dynamic require avoided; resolve inline to keep store free of cycles.
    const data = getCompanyData(companyId);
    const employees = data?.employees || [];
    const positions = data?.smartPositions || [];
    if (!targetId || String(targetId).startsWith("channel:")) {
      const ids = new Set();
      if (data?.ownerId) ids.add(String(data.ownerId));
      for (const e of employees) {
        if (["director", "ops_manager", "pgm"].includes(e.role)) ids.add(String(e.id));
        const perms = positions.find((p) => p.employeeId === e.id)?.permissions || {};
        if (perms.hr === "manage" || perms.employees === "manage") ids.add(String(e.id));
      }
      const emp = employees.find((e) => e.id === employeeId);
      if (emp?.stationId) {
        for (const e of employees) {
          if (String(e.stationId) === String(emp.stationId) && e.role === "station_manager") ids.add(String(e.id));
        }
      }
      ids.delete(String(employeeId));
      recipientIds = [...ids];
    } else {
      recipientIds = [String(targetId)];
    }
  } catch {
    recipientIds = targetId && !String(targetId).startsWith("channel:") ? [String(targetId)] : [];
  }
  const preview = `${senderName}: ${text || "مرفق تواصل إداري"}`;
  for (const uidTarget of recipientIds) {
    addNotification(companyId, uidTarget, preview);
  }
  // When HR replies on the employee file, notify the employee.
  if (from === "hr") {
    addNotification(companyId, employeeId, preview);
  }
}

export function addDisciplineMessage(companyId, caseId, { from, text, files, senderName }) {
  let employeeId = "";
  updateCompany(companyId, (d) => {
    const row = (d.disciplinaryCases || []).find((c) => c.id === caseId);
    if (!row) return;
    employeeId = row.employeeId;
    row.messages = row.messages || [];
    const attached = Array.isArray(files) ? files : [];
    row.messages.push({
      id: uid("dmsg"),
      from,
      text,
      files: attached,
      senderName,
      createdAt: new Date().toISOString(),
    });
    if (attached.length) {
      row.evidence = [...(row.evidence || []), ...attached];
    }
    if (from === "employee" && String(text || "").trim()) {
      row.appealNote = row.appealNote || String(text).trim();
    }
  });
  const preview = `${senderName}: ${text || "مرفق تحقيق"}`;
  if (from === "hr" && employeeId) {
    addNotification(companyId, employeeId, preview);
  }
  if (from === "employee") {
    const data = getCompanyData(companyId);
    if (data?.ownerId) addNotification(companyId, data.ownerId, preview);
  }
}

// Leave requests: the worker raises on ملفي; an authorized manager/HR decides on إدارة.
export function submitLeaveRequest(companyId, employeeId, { type, startDate, endDate, reason, files, eventDate, examRepeat, examNoticeIssuedAt, iddahPregnant, companionUnpaidExtend, days: requestedDays, status, recordedBy, requestedBy, requestedById, noOtherEmployerAck, deferConsentAt, expectedBirthDate, advanceLeave, joinAnnualToSick }) {
  const live = getCompanyData(companyId);
  const subject = rosterEmployeeById(live?.employees, employeeId);
  if (!subject) return { ok: false, error: "EMPLOYEE_NOT_FOUND", reason: "الموظف غير موجود.", reasonEn: "Employee was not found." };
  const calendarDays = computeLeaveDays(startDate, endDate);
  const chargeable = chargeableLeaveDays(startDate, endDate, type, laborCalendarOf(live), live, subject);
  const explicit = Number(requestedDays);
  const leaveKey = String(type || "").trim().toLowerCase();
  const days = (leaveKey === "annual" || leaveKey === "sick")
    ? chargeable
    : (Number.isFinite(explicit) && explicit >= 1 ? Math.max(1, Math.round(explicit)) : calendarDays);
  if (leaveKey === COMP_LEAVE_TYPE) {
    // Regs 22 bis — drawn from the comp balance (hours), never from annual leave.
    const comp = checkTakeCompLeaveGate({ employee: subject, days, on: startDate });
    if (!comp.ok) return comp;
  }
  const gate = checkSubmitLeaveGate({
    type,
    startDate,
    endDate,
    days,
    reason,
    files,
    eventDate,
    examRepeat,
    examNoticeIssuedAt,
    iddahPregnant,
    companionUnpaidExtend,
    status: "pending",
    recordedBy,
    requestedById,
    employeeId,
    noOtherEmployerAck,
    deferConsentAt,
    advanceLeave: advanceLeave === true || undefined,
    joinAnnualToSick: joinAnnualToSick === true || undefined,
  }, {
    profile: subject.profile,
    requests: subject.leaveRequests,
    otherRequests: subject.otherRequests,
    employee: subject,
    employeeId,
    companyId,
    recordedBy,
    requestedById,
    actorId: requestedById,
    employerRecorded: status === "approved" && !!recordedBy,
    laborCalendar: laborCalendarOf(live),
    company: live,
  });
  if (!gate.ok) return gate;
  // Art. 78: the worker sets the job-search day and tells the employer the day before — no approval.
  if (String(type || "").toLowerCase() === "job_search") status = "approved";
  let createdRequest = null;
  const raiserId = requestedById || (status === "approved" ? "" : employeeId);
  const raiserName = recordedBy || requestedBy || subject.name || auditActor;
  updateCompany(companyId, (d) => {
    const emp = rosterEmployeeById(d.employees, employeeId);
    if (!emp) return;
    emp.leaveRequests = emp.leaveRequests || [];
    const now = new Date().toISOString();
    const approved = status === "approved";
    const span = approved ? leaveCoverRange({ startDate, endDate }) : { start: "", end: "" };
    createdRequest = {
      id: uid("leave"),
      employeeId: emp.id || employeeId,
      type, startDate, endDate, days, reason,
      eventDate: eventDate || undefined,
      examRepeat: examRepeat || undefined,
      examNoticeIssuedAt: examNoticeIssuedAt || undefined,
      examNoticeVia: gate.via || undefined,
      examLeaveTrack: gate.examLeaveTrack || undefined,
      examPayFrom: gate.examPayFrom || undefined,
      iddahPregnant: iddahPregnant || undefined,
      companionUnpaidExtend: companionUnpaidExtend || undefined,
      noOtherEmployerAck: noOtherEmployerAck === true,
      deferConsentAt: deferConsentAt || undefined,
      // Art. 151(1): the expected date (medical certificate) anchors the request; the actual birth is recorded later.
      expectedBirthDate: leaveKey === "maternity" ? (String(expectedBirthDate || eventDate || "").slice(0, 10) || undefined) : undefined,
      advanceLeave: leaveKey === "annual" && advanceLeave === true ? true : undefined,
      joinAnnualToSick: leaveKey === "annual" && joinAnnualToSick === true ? true : undefined,
      joinedSickId: leaveKey === "annual" && joinAnnualToSick === true ? (gate.joinedSickId || undefined) : undefined,
      files: type === "exam"
        ? (files || []).map((file) => (file && typeof file === "object" ? { ...file, kind: file.kind || EXAM_NOTICE_KIND } : file))
        : (files || []),
      status: approved ? "approved" : "pending",
      recordedBy: recordedBy || undefined,
      requestedBy: requestedBy || recordedBy || undefined,
      requestedById: raiserId || undefined,
      reviewedBy: approved ? recordedBy : undefined,
      reviewedAt: approved ? now : undefined,
      approvedAt: approved ? now : undefined,
      activeStartDate: type === "annual" && span.start ? span.start : undefined,
      activeEndDate: type === "annual" && span.end ? span.end : undefined,
      createdAt: now,
      companyId,
    };
    const raiseStamp = stampRequestAudit(companyId, emp, createdRequest, {
      actor: raiserName,
      family: "leave",
      verb: "raise",
      note: reason,
    });
    createdRequest.auditTrail = appendRequestAudit(createdRequest, raiseStamp.row);
    pushEmployeeFileLog(emp, raiseStamp.log);
    if (approved) {
      const approveStamp = stampRequestAudit(companyId, emp, createdRequest, {
        actor: recordedBy || raiserName || auditActor,
        family: "leave",
        verb: "approve",
      });
      createdRequest.auditTrail = appendRequestAudit(createdRequest, approveStamp.row);
      pushEmployeeFileLog(emp, approveStamp.log);
    }
    if (leaveKey === "annual" && /^\d{4}-\d{2}-\d{2}$/.test(String(startDate || "").slice(0, 10)) && /^\d{4}-\d{2}-\d{2}$/.test(String(endDate || "").slice(0, 10))) {
      // His weekly rest inside the leave is fixed when he asks (and kept at approval): the roster can't move
      // a rest day in or out of the balance afterwards. Official holidays stay out (Arts 109, 112).
      const frozen = annualDayBreakdown(String(startDate).slice(0, 10), String(endDate).slice(0, 10), laborCalendarOf(d), d, emp);
      createdRequest.lockedDays = Object.fromEntries(frozen.days.map((day) => [day.key, day.kind]));
      createdRequest.lockedAt = now;
      createdRequest.days = frozen.charged;
    }
    emp.leaveRequests.unshift(createdRequest);
    // Recorded straight as approved: the same file effects as an approval (Arts. 114, 116; Model regulation Art. 33).
    if (approved) applyApprovedLeaveEffectsOnDraft(emp, createdRequest);
  });
  // Route to the assigned HR manager for this employee's station, if any.
  const data = getCompanyData(companyId);
  const filedId = subject.id || employeeId;
  if (createdRequest?.status === "pending") {
    const emp = rosterEmployeeById(data?.employees, filedId) || subject;
    const lang = getUiLang();
    const label = leaveTypeLabel(type, lang === "ar", undefined, startDate || createdRequest?.startDate);
    notifyRequestManagers(
      companyId,
      filedId,
      requestManagerNotice(data, emp, lang === "ar" ? `إجازة ${label}` : `${label} leave`, lang),
      { doa: { kind: "leave", amount: Number(createdRequest?.days) || null } },
    );
  }
  if (createdRequest && String(type || "").toLowerCase() === "job_search") {
    const emp = rosterEmployeeById(data?.employees, filedId) || subject;
    notifyRequestManagers(companyId, filedId, `${emp?.name || "موظف"} أشعر بيوم بحث عن عمل في ${regulationDate(createdRequest.startDate)} بأجره — حق له خلال مهلة إشعارك (المادة 78)، لا يحتاج اعتماداً. عدّل جدول الدوام.`);
  }
  if (createdRequest) {
    invokeWorkforce({ action: "submitLeave", companyId, employeeId: filedId, ...createdRequest });
  }
  return { ok: true, id: createdRequest?.id };
}

export function setLeaveRequestStatus(companyId, employeeId, requestId, status, reviewerName, note, extras = {}) {
  const data = getCompanyData(companyId);
  const selfDecide = checkSelfDecideRequestGate({
    actorId: extras.actorId,
    subjectId: employeeId,
    status,
    ownerId: data?.ownerId,
    actor: (data?.employees || []).find((row) => String(row.id) === String(extras.actorId)) || extras.actor,
    data,
  });
  if (!selfDecide.ok) return selfDecide;
  const emp = data?.employees.find((e) => e.id === employeeId);
  const empName = emp?.name || "";
  const req = (emp?.leaveRequests || []).find((r) => r.id === requestId);
  const prevStatus = req?.status;
  const actor = extras.actorId && String(extras.actorId) === String(employeeId) ? "employee" : "manager";
  if (prevStatus === "approved" && status !== "approved") {
    const lock = checkAlterApprovedLeaveGate(req, {
      nextStatus: status,
      actor,
      employeeConsent: extras.employeeConsent === true,
      onDate: extras.onDate,
    });
    if (!lock.ok) return lock;
  }
  if (status === "rejected") {
    const refuse = checkRejectLeaveGate(req, {
      nextStatus: "rejected",
      actor,
      profile: emp?.profile,
      requests: emp?.leaveRequests,
      otherRequests: emp?.otherRequests,
      companyId,
      onDate: extras.onDate,
      rejectGround: extras.rejectGround,
      rejectVerified: extras.rejectVerified,
    });
    if (!refuse.ok) return refuse;
    if (actor !== "employee") {
      const named = checkRefuseRequestReasonGate(note);
      if (!named.ok) return named;
    }
  }
  if (status === "approved") {
    const typeRequiresFile = ["sick", "exam"].includes(req?.type);
    const issuedAt = String(extras.examNoticeIssuedAt || req?.examNoticeIssuedAt || "").slice(0, 10);
    const approveRow = issuedAt && String(req?.type || "").toLowerCase() === "exam"
      ? { ...req, examNoticeIssuedAt: issuedAt }
      : req;
    const gate = checkApproveLeaveGate({ ...approveRow, agreedOtherwise: extras.agreedOtherwise === true || approveRow?.agreedOtherwise === true || undefined }, typeRequiresFile, {
      profile: emp?.profile,
      requests: emp?.leaveRequests,
      laborCalendar: laborCalendarOf(data),
      company: data,
      examNoticeIssuedAt: issuedAt || undefined,
      onDate: extras.onDate,
      forApproval: true,
      advanceConsent: extras.advanceConsent === true,
    });
    if (!gate.ok) return gate;
  }
  let leaveEffects = null;
  const refuseReason = status === "rejected" ? String(note || "").trim() : "";
  let sickPauses = [];
  const decideVerb = status === "rejected" ? "refuse" : status === "approved" ? "approve" : status === "withdrawn" ? "withdraw" : status === "revise" ? "revise" : "";
  const decideLog = decideVerb
    ? (status === "rejected"
      ? stampRefuseAudit(companyId, emp, req, { actor: reviewerName || auditActor, note: refuseReason || "رفض الطلب", family: "leave" })
      : stampRequestAudit(companyId, emp, req, { actor: reviewerName || auditActor, note: String(note || "").trim(), family: "leave", verb: decideVerb }))
    : null;
  if (!decideVerb) {
    audit(companyId, `leave_request_${status}`, `Leave request for ${empName} marked "${status}" by ${reviewerName || "manager"}.`);
  }
  updateCompany(companyId, (d) => {
    const employee = d.employees.find((e) => e.id === employeeId);
    if (!employee) return;
    const leaveReq = (employee.leaveRequests || []).find((r) => r.id === requestId);
    if (!leaveReq) return;
    leaveReq.status = status;
    leaveReq.reviewedBy = reviewerName;
    leaveReq.reviewedAt = new Date().toISOString();
    if (String(note || "").trim()) leaveReq.reviewNote = String(note).trim();
    if (decideLog?.row) {
      leaveReq.auditTrail = status === "rejected"
        ? appendRequestRefuseAudit(leaveReq, decideLog.row)
        : appendRequestAudit(leaveReq, decideLog.row);
      pushEmployeeFileLog(employee, decideLog.log);
    }
    if (status === "rejected") {
      leaveReq.rejectReason = refuseReason || leaveReq.reviewNote || null;
    }
    if (status === "approved") {
      leaveReq.approvedAt = new Date().toISOString();
      const issuedStamp = String(extras.examNoticeIssuedAt || leaveReq.examNoticeIssuedAt || "").slice(0, 10);
      if (String(leaveReq.type || "").toLowerCase() === "exam" && /^\d{4}-\d{2}-\d{2}$/.test(issuedStamp)) {
        leaveReq.examNoticeIssuedAt = issuedStamp;
      }
      if (leaveReq.type === "annual") {
        const span = leaveCoverRange(leaveReq);
        if (span.start && span.end) {
          leaveReq.activeStartDate = span.start;
          leaveReq.activeEndDate = span.end;
        }
        // The weekly rest inside the leave is fixed at approval: each day's kind (work / statutory rest /
        // company rest / cycle rest / holiday) is frozen on the request, so a later roster change can never
        // move a rest day in or out of the balance (Art. 109; no manipulation after the decision).
        const lockFrom = String(leaveReq.startDate || "").slice(0, 10);
        const lockTo = String(leaveReq.endDate || "").slice(0, 10);
        const alreadyLocked = leaveReq.lockedDays && Object.keys(leaveReq.lockedDays).length;
        if (lockFrom && lockTo && !alreadyLocked) {
          const frozen = annualDayBreakdown(lockFrom, lockTo, laborCalendarOf(d), d, employee);
          leaveReq.lockedDays = Object.fromEntries(frozen.days.map((day) => [day.key, day.kind]));
          leaveReq.lockedAt = leaveReq.approvedAt;
          leaveReq.days = frozen.charged;
        }
      }
      if (String(leaveReq.type || "").toLowerCase() === "sick") {
        sickPauses = pauseAnnualForSickOnDraft(employee, leaveReq);
      }
      leaveEffects = applyApprovedLeaveEffectsOnDraft(employee, leaveReq, extras);
    }
    if (status === "withdrawn" && prevStatus === "approved") undoApprovedLeaveEffectsOnDraft(employee, leaveReq);
  });
  if (leaveEffects?.extendedTo) {
    notifyRequestManagers(companyId, employeeId, `${empName}: العقد محدد المدة مُدّد ${leaveEffects.suspension.days} يوماً حتى ${regulationDate(leaveEffects.extendedTo)} بقدر مدة توقفه في الإجازة بلا أجر (المادة 116، اللائحة م25/2).`);
  }
  for (const p of sickPauses) {
    const lang = noticeLang(extras);
    const text = lang === "ar"
      ? `توقفت إجازتك السنوية بسبب الإجازة المرضية (${p.pausedDays} ${p.pausedDays === 1 ? "يوم" : "أيام"}) وتُستأنف المدة المتبقية من ${regulationDate(p.resume.startDate)} حتى ${regulationDate(p.resume.endDate)} (النموذج الموحد م41).`
      : `Your annual leave is paused for the sick leave (${p.pausedDays} days); the rest resumes ${p.resume.startDate}–${p.resume.endDate} (Model regulation Art. 41).`;
    addNotification(companyId, employeeId, text, { to: "/app/requests" });
    notifyRequestManagers(companyId, employeeId, `${empName}: أُوقفت إجازته السنوية لوقوع إجازة مرضية خلالها، وتُستأنف من ${regulationDate(p.resume.startDate)} حتى ${regulationDate(p.resume.endDate)} — عدّل الجدول (النموذج الموحد م41).`);
  }
  if (status === "approved" || status === "rejected" || status === "revise" || status === "withdrawn") {
    const fresh = getCompanyData(companyId);
    const leave = (fresh?.employees.find((row) => row.id === employeeId)?.leaveRequests || []).find((row) => row.id === requestId);
    const lang = noticeLang(extras);
    const decision = {
      status,
      type: leave?.type,
      startDate: leave?.startDate,
      endDate: leave?.endDate,
      recordedBy: leave?.recordedBy,
      daysUntilStart: daysUntilLeaveStart(leave?.startDate),
      reason: status === "rejected" || status === "revise" ? String(note || "").trim() : "",
      afterLine: status === "rejected" && refusalGroundsFor({ ...leave, family: "leave" })?.length ? refusalWorkerLine({ ...leave, family: "leave" }, lang === "ar") : "",
    };
    addNotification(companyId, employeeId, leaveDecisionNoticeText(decision, lang), {
      to: "/app/requests",
      ...(status === "approved" ? { key: leaveDecisionNoticeKey(employeeId, requestId) } : {}),
      leaveDecision: decision,
    });
    if (status === "withdrawn" && prevStatus === "approved") {
      const hr = getStationHRManager(fresh, employeeId);
      if (hr && String(hr.id) !== String(employeeId)) {
        const span = leaveDateSpanText(leave?.startDate, leave?.endDate, lang);
        addNotification(
          companyId,
          hr.id,
          lang === "ar"
            ? `${empName} سحب إجازة معتمدة (${span}) قبل موعد بدئها — عدّل جدول التشغيل.`
            : `${empName} withdrew approved leave (${span}) before it started — adjust the roster.`,
        );
      }
    }
  }
  if (status === "rejected") {
    invokeWorkforce({ action: "rejectLeave", companyId, employeeId, requestId, reason: refuseReason, note: refuseReason, rejectGround: extras.rejectGround, rejectVerified: extras.rejectVerified === true });
  }
  return { ok: true };
}

/**
 * Effects of an approved leave on the file (draft). Art. 116 + Regs Art. 25: unpaid days beyond twenty in
 * the work year suspend the contract — stored on the request; a fixed-term contract is extended by them
 * unless agreed otherwise. Art. 114: Hajj performed is stamped. Model regulation Art. 33: advance consent kept.
 */
function applyApprovedLeaveEffectsOnDraft(employee, leaveReq, extras = {}) {
  const type = String(leaveReq.type || "").toLowerCase();
  const out = {};
  if (type === "annual" && leaveReq.advanceLeave === true) {
    leaveReq.advanceConsent = true;
    leaveReq.advanceConsentAt = new Date().toISOString();
  }
  if (type === "hajj") {
    employee.profile = { ...(employee.profile || {}), hajjPerformed: true, hajjRequestId: leaveReq.id, hajjSeason: String(leaveReq.startDate || "").slice(0, 4) };
  }
  if (type === "unpaid") {
    if (extras.agreedOtherwise === true) leaveReq.agreedOtherwise = true;
    if (extras.extensionAgreedOtherwise === true) leaveReq.extensionAgreedOtherwise = true;
    const plan = unpaidSuspensionPlan(employee.leaveRequests || [], employee.profile?.hireDate, leaveReq);
    const mine = plan.byRequest[leaveReq.id];
    if (mine && mine.days > 0) {
      leaveReq.suspension = { days: mine.days, from: mine.from, to: mine.to };
      out.suspension = leaveReq.suspension;
      const profile = { ...(employee.profile || {}) };
      profile.unpaidSuspendedDays = (Number(profile.unpaidSuspendedDays) || 0) + mine.days;
      const end = String(profile.contract?.endDate || profile.contractEndDate || "").slice(0, 10);
      const fixed = isFixedContractType(profile.contractType || profile.contract?.type);
      if (fixed && /^\d{4}-\d{2}-\d{2}$/.test(end) && leaveReq.extensionAgreedOtherwise !== true) {
        const next = addLeaveDays(end, mine.days);
        leaveReq.suspension.contractEndBefore = end;
        leaveReq.suspension.contractEndAfter = next;
        profile.contractEndDate = next;
        if (profile.contract && typeof profile.contract === "object") profile.contract = { ...profile.contract, endDate: next };
        out.extendedTo = next;
      }
      employee.profile = profile;
    }
  }
  return out;
}

function undoApprovedLeaveEffectsOnDraft(employee, leaveReq) {
  const type = String(leaveReq?.type || "").toLowerCase();
  if (type === "hajj" && employee.profile?.hajjRequestId === leaveReq.id) {
    const profile = { ...(employee.profile || {}) };
    delete profile.hajjPerformed;
    delete profile.hajjRequestId;
    delete profile.hajjSeason;
    employee.profile = profile;
  }
  if (type === "unpaid" && leaveReq.suspension) {
    const profile = { ...(employee.profile || {}) };
    profile.unpaidSuspendedDays = Math.max(0, (Number(profile.unpaidSuspendedDays) || 0) - (Number(leaveReq.suspension.days) || 0));
    const before = leaveReq.suspension.contractEndBefore;
    if (before && String(profile.contractEndDate || profile.contract?.endDate || "").slice(0, 10) === leaveReq.suspension.contractEndAfter) {
      profile.contractEndDate = before;
      if (profile.contract && typeof profile.contract === "object") profile.contract = { ...profile.contract, endDate: before };
    }
    employee.profile = profile;
    delete leaveReq.suspension;
  }
}

function addLeaveDays(iso, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").slice(0, 10));
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Number(n));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Art. 151(1): the actual birth on an approved maternity leave re-anchors the six mandatory weeks after it.
 * A late birth that leaves fewer than six weeks inside the twelve paid ones adds the complement as unpaid
 * leave — recorded, never blocked by the balance.
 */
export function recordMaternityBirth(companyId, employeeId, requestId, birthDate, extras = {}) {
  const data = getCompanyData(companyId);
  const emp = (data?.employees || []).find((e) => e.id === employeeId);
  const req = (emp?.leaveRequests || []).find((r) => r.id === requestId);
  const gate = checkMaternityBirthGate(req, birthDate);
  if (!gate.ok) return gate;
  updateCompany(companyId, (d) => {
    const e = d.employees.find((row) => row.id === employeeId);
    const r = (e?.leaveRequests || []).find((row) => row.id === requestId);
    if (!r) return;
    r.expectedBirthDate = r.expectedBirthDate || gate.expectedBirthDate || undefined;
    r.actualBirthDate = gate.birthDate;
    r.eventDate = gate.birthDate;
    r.originalStartDate = r.originalStartDate || r.startDate;
    r.originalEndDate = r.originalEndDate || r.endDate;
    r.startDate = gate.startDate;
    r.endDate = gate.endDate;
    r.days = gate.days;
    r.paidDays = gate.paidDays;
    r.unpaidComplementDays = gate.unpaidComplementDays || undefined;
    r.unpaidComplementFrom = gate.unpaidComplementFrom || undefined;
    r.unpaidComplementTo = gate.unpaidComplementTo || undefined;
    if (r.activeStartDate) r.activeStartDate = gate.startDate;
    if (r.activeEndDate) r.activeEndDate = gate.endDate;
    r.auditTrail = [...(r.auditTrail || []), { at: new Date().toISOString(), actor: extras.actor || "", verb: "birth", note: `الوضع ${gate.birthDate}${gate.unpaidComplementDays ? ` — ${gate.unpaidComplementDays} يوماً مكملة بلا أجر` : ""}` }];
  });
  const tail = gate.unpaidComplementDays
    ? ` تأخر الوضع، فتُحتسب ${gate.unpaidComplementDays} يوماً مكملة للأسابيع الستة بلا أجر (${regulationDate(gate.unpaidComplementFrom)} – ${regulationDate(gate.unpaidComplementTo)}).`
    : "";
  addNotification(companyId, employeeId, `سُجّل الوضع في ${regulationDate(gate.birthDate)} — الأسابيع الستة بعده وجوبية حتى ${regulationDate(gate.postBirthEnd)} (المادة 151).${tail}`, { to: "/app/requests" });
  notifyRequestManagers(companyId, employeeId, `${emp?.name || "موظفة"}: سُجّل الوضع في ${regulationDate(gate.birthDate)} وأُعيد ضبط إجازة الوضع حتى ${regulationDate(gate.endDate)} (المادة 151).${gate.unpaidComplementDays ? ` منها ${gate.unpaidComplementDays} يوماً بلا أجر — عدّل الرواتب.` : ""}`);
  audit(companyId, "maternity_birth_recorded", `Maternity ${requestId} for ${emp?.name || employeeId}: birth ${gate.birthDate}, unpaid complement ${gate.unpaidComplementDays}.`);
  invokeWorkforce({ action: "recordBirth", companyId, employeeId, requestId, birthDate: gate.birthDate });
  return { ok: true, ...gate };
}

/** Art. 118: proven work for another employer during the leave — the leave pay is withheld or recovered. */
export function recordLeaveBreach(companyId, employeeId, requestId, { file, reason, actorId, actorName } = {}) {
  const data = getCompanyData(companyId);
  const emp = (data?.employees || []).find((e) => e.id === employeeId);
  const req = (emp?.leaveRequests || []).find((r) => r.id === requestId);
  const gate = checkLeaveBreachGate(req, { file, reason, actorId, subjectId: employeeId });
  if (!gate.ok) return gate;
  const now = new Date().toISOString();
  updateCompany(companyId, (d) => {
    const e = d.employees.find((row) => row.id === employeeId);
    const r = (e?.leaveRequests || []).find((row) => row.id === requestId);
    if (!r) return;
    r.recoverPay = true;
    r.recoverReason = String(reason).trim();
    r.recoverEvidence = file;
    r.recoverAt = now;
    r.recoverBy = actorName || "";
    r.auditTrail = [...(r.auditTrail || []), { at: now, actor: actorName || "", verb: "breach", note: `المادة 118 — ${String(reason).trim()}` }];
  });
  addNotification(companyId, employeeId, `سُجّل أنك عملت لدى صاحب عمل آخر أثناء إجازتك (${leaveTypeLabel(req.type, true)}) — لصاحب العمل حرمانك من أجرها أو استرداده (المادة 118). لك التظلم.`, { to: "/app/requests" });
  audit(companyId, "leave_breach_art118", `Art. 118 breach recorded on ${requestId} for ${emp?.name || employeeId}: ${String(reason).trim()}`);
  invokeWorkforce({ action: "recordLeaveBreach", companyId, employeeId, requestId, file, reason: String(reason).trim() });
  return { ok: true };
}

/** Art. 114: the employer's yearly Hajj quota (empty = no cap). */
export function setHajjAnnualQuota(companyId, quota) {
  const raw = quota === "" || quota == null ? null : Math.floor(Number(quota));
  if (raw != null && !(Number.isFinite(raw) && raw >= 0)) return { ok: false, error: "QUOTA_INVALID", reason: "اكتب عدداً صحيحاً أو اتركه فارغاً.", reasonEn: "Enter a whole number or leave it empty." };
  updateCompany(companyId, (d) => {
    d.leavePolicy = { ...(d.leavePolicy || {}), hajjAnnualQuota: raw };
  });
  audit(companyId, "hajj_quota_set", `Hajj annual quota set to ${raw == null ? "none" : raw} (Art. 114).`);
  return { ok: true, quota: raw };
}

/**
 * Art. 110 carry notices — once per bucket and kind: the worker gets «تنتهي في» 60 days before the
 * deferral limit; the manager gets the «مؤجلة دون موافقة» / overdue line to schedule the days.
 */
export function openDueAnnualCarryNotices(companyId, onDate) {
  const data = getCompanyData(companyId);
  if (!data) return { ok: false, opened: [] };
  const day = String(onDate || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date())).slice(0, 10);
  const due = [];
  for (const emp of data.employees || []) {
    if (!emp?.profile?.hireDate) continue;
    const seen = new Set(emp.profile.annualCarryNoticeKeys || []);
    for (const a of annualCarryAlerts(emp.profile, emp.leaveRequests || [], day, data, emp)) {
      const key = `${a.kind}:${a.start}`;
      if (!seen.has(key)) due.push({ emp, alert: a, key });
    }
  }
  if (!due.length) return { ok: true, opened: [] };
  updateCompany(companyId, (d) => {
    for (const row of due) {
      const e = d.employees.find((item) => item.id === row.emp.id);
      if (!e) continue;
      e.profile = { ...(e.profile || {}), annualCarryNoticeKeys: [...(e.profile?.annualCarryNoticeKeys || []), row.key].slice(-24) };
    }
  });
  for (const row of due) {
    if (row.alert.kind === "expiring") addNotification(companyId, row.emp.id, row.alert.ar, { to: "/app/requests" });
    notifyRequestManagers(companyId, row.emp.id, `${row.emp.name || "موظف"}: ${row.alert.ar}`);
  }
  return { ok: true, opened: due.map((r) => ({ employeeId: r.emp.id, kind: r.alert.kind })) };
}

/** Model regulation Art. 40(5): the birth ends a pregnant widow's iddah; what is left of it is not used after birth. */
export function recordIddahBirth(companyId, employeeId, requestId, birthDate, extras = {}) {
  const data = getCompanyData(companyId);
  const emp = (data?.employees || []).find((e) => e.id === employeeId);
  const req = (emp?.leaveRequests || []).find((r) => r.id === requestId);
  const gate = checkIddahBirthGate(req, birthDate);
  if (!gate.ok) return gate;
  updateCompany(companyId, (d) => {
    const e = d.employees.find((row) => row.id === employeeId);
    const r = (e?.leaveRequests || []).find((row) => row.id === requestId);
    if (!r) return;
    r.iddahBirthDate = gate.birthDate;
    r.iddahEndedAtBirth = true;
    r.originalEndDate = r.originalEndDate || r.endDate;
    r.endDate = gate.endDate;
    r.days = gate.days;
    if (r.activeEndDate) r.activeEndDate = gate.endDate;
  });
  addNotification(companyId, employeeId, `سُجّل الوضع في ${regulationDate(gate.birthDate)} — انتهت العدة به ولا يُستفاد من باقيها بعد الوضع (النموذج الموحد م40/5). تبدأ إجازة الوضع من تاريخ الولادة.`, { to: "/app/requests" });
  notifyRequestManagers(companyId, employeeId, `${emp?.name || "موظفة"}: انتهت العدة بالوضع في ${regulationDate(gate.birthDate)} — اعتمد إجازة الوضع من تاريخ الولادة (المادة 151، النموذج الموحد م40/5).`);
  audit(companyId, "iddah_ended_at_birth", `Iddah for ${emp?.name || employeeId} ended at birth on ${gate.birthDate} by ${extras.actor || ""}.`);
  invokeWorkforce({ action: "recordIddahBirth", companyId, employeeId, requestId, birthDate: gate.birthDate });
  return { ok: true, ...gate };
}

/** Model regulation Art. 41 on the draft: approved annual leave overlapping this approved sick leave is paused and resumes after it. */
function pauseAnnualForSickOnDraft(employee, sickReq) {
  const out = [];
  const rows = employee.leaveRequests || [];
  for (const annual of [...rows]) {
    if (annual.status !== "approved" || String(annual.type || "").toLowerCase() !== "annual") continue;
    const plan = planAnnualPauseForSick(annual, sickReq);
    if (!plan) continue;
    const origDays = Number(annual.days) || computeLeaveDays(annual.startDate, annual.endDate);
    const keepDays = plan.keep ? Math.min(origDays, plan.keep.days) : 0;
    const resumeDays = Math.max(0, origDays - keepDays);
    const stamp = { sickId: sickReq.id, pausedDays: plan.pausedDays, at: new Date().toISOString() };
    if (plan.keep) {
      annual.endDate = plan.keep.endDate;
      annual.activeEndDate = plan.keep.endDate;
      annual.days = keepDays;
      annual.pausedBySick = stamp;
      if (resumeDays > 0) {
        rows.push({
          ...annual,
          id: uid("leave"),
          startDate: plan.resume.startDate,
          endDate: plan.resume.endDate,
          activeStartDate: plan.resume.startDate,
          activeEndDate: plan.resume.endDate,
          days: resumeDays,
          resumedFrom: annual.id,
          pausedBySick: undefined,
          auditTrail: [],
          reason: `استئناف الإجازة السنوية بعد المرضية (النموذج الموحد م41)`,
        });
      }
    } else {
      annual.startDate = plan.resume.startDate;
      annual.endDate = plan.resume.endDate;
      annual.activeStartDate = plan.resume.startDate;
      annual.activeEndDate = plan.resume.endDate;
      annual.pausedBySick = stamp;
    }
    out.push(plan);
  }
  employee.leaveRequests = rows;
  return out;
}

/** Worker opens the approved leave decision — card then leaves ملفي for الأرشيف. Roster/punch still use approved dates. */
export function attachExamSatProof(companyId, employeeId, requestId, file, extras = {}) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((e) => e.id === employeeId);
  const req = (emp?.leaveRequests || []).find((r) => r.id === requestId);
  if (!req) {
    return {
      ok: false,
      error: "LEAVE_NOT_FOUND",
      reason: "طلب الإجازة غير موجود في نطاق الشركة.",
      reasonEn: "Leave request was not found in this company.",
    };
  }
  const stamped = file && typeof file === "object" ? { ...file, kind: EXAM_SAT_KIND } : file;
  const gate = checkAttachExamSatGate(req, stamped, { onDate: extras.onDate, actorId: extras.actorId, subjectId: employeeId });
  if (!gate.ok) return gate;
  const now = new Date().toISOString();
  updateCompany(companyId, (d) => {
    const employee = d.employees.find((e) => e.id === employeeId);
    if (!employee) return;
    const leaveReq = (employee.leaveRequests || []).find((r) => r.id === requestId);
    if (!leaveReq) return;
    leaveReq.examSatFile = stamped;
    leaveReq.examSatAt = now;
    leaveReq.examSatBy = extras.actorName || extras.actorId || undefined;
  });
  const lang = noticeLang(extras);
  const empName = emp?.name || "";
  notifyRequestManagers(
    companyId,
    employeeId,
    lang === "ar"
      ? `${empName} رفع إثبات أداء الامتحان على إجازة المادة 115.`
      : `${empName} attached exam-sitting proof on the Article 115 leave.`,
  );
  invokeWorkforce({ action: "attachExamSat", companyId, employeeId, requestId, examSatFile: stamped, examSatAt: now, examSatBy: extras.actorName || extras.actorId });
  return { ok: true, examSatFile: stamped };
}

export function markLeaveDecisionSeen(companyId, employeeId, requestId, extras = {}) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((e) => e.id === employeeId);
  const req = (emp?.leaveRequests || []).find((r) => r.id === requestId);
  const actorId = extras.actorId || employeeId;
  const gate = checkSeeLeaveDecisionGate({ request: req, employeeId, actorId });
  if (!gate.ok) return gate;
  if (gate.already) return { ok: true, already: true };
  const noticeKey = leaveDecisionNoticeKey(employeeId, requestId);
  updateCompany(companyId, (d) => {
    const employee = d.employees.find((e) => e.id === employeeId);
    const leaveReq = (employee?.leaveRequests || []).find((r) => r.id === requestId);
    if (!leaveReq || leaveReq.status !== "approved") return;
    leaveReq.decisionSeenAt = new Date().toISOString();
    for (const note of d.notifications || []) {
      if (note.userId === employeeId && note.key === noticeKey) note.read = true;
    }
  });
  return { ok: true };
}

function pickRequestSigner(data, employee, { raisedById } = {}) {
  if (!employee) return null;
  if (raisedById && String(raisedById) !== String(employee.id)) return employee;
  const hr = getStationHRManager(data, employee.id);
  if (hr && String(hr.id) !== String(employee.id)) return hr;
  return (data?.employees || []).find((row) => (
    row.id !== employee.id
    && ["director", "ops_manager", "pgm", "station_manager"].includes(row.role)
  )) || null;
}

function attachSigningPackage(companyId, employeeId, requestId, {
  file,
  signMark,
  kind,
  title,
  creator,
  signer,
}) {
  const data = getCompanyData(companyId);
  const created = applyCreate(data?.signatureRequests || [], {
    companyId,
    id: `sig_${requestId}`,
    fileName: consentPdfName(file, title),
    docUrl: file?.url || "",
    verificationId: generateVerificationId(),
    creatorId: creator?.id || "",
    creatorName: creator?.name || "",
    creatorEmail: creator?.email || "",
    signers: [{
      name: signer?.name || "",
      email: consentSignerEmail(signer),
      employeeId: signer?.id || "",
      role: signer?.role || "",
      stationId: signer?.stationId || null,
      spots: [requestSignerSpot(signMark)],
    }],
  }, {
    id: creator?.id || "",
    userId: creator?.id || "",
    name: creator?.name || "",
    email: creator?.email || "",
    role: creator?.role || "",
    stationId: signer?.stationId || null,
  }, { rid: () => `tok_${String(requestId).slice(-8)}_${Math.random().toString(36).slice(2, 8)}` });
  if (!created.ok) return created;
  created.request.otherRequestId = requestId;
  created.request.kind = kind;
  if (kind === WRITTEN_CONSENT_TYPE) created.request.consentId = requestId;
  const packSigner = created.request.signers[0];
  const signToken = `${created.request.id}.${packSigner.token}`;
  updateCompany(companyId, (draft) => {
    draft.signatureRequests = created.store;
    const request = (draft.employees.find((row) => row.id === employeeId)?.otherRequests || []).find((row) => row.id === requestId);
    if (!request) return;
    request.signRequestId = created.request.id;
    request.signToken = signToken;
    request.signerEmployeeId = signer?.id || "";
    request.signMark = normalizeSignMark(signMark) || defaultConsentMark();
  });
  return { ok: true, signToken, signRequestId: created.request.id };
}

function stampRequestFile(file, at) {
  if (!file) return file;
  return {
    name: file.name,
    url: file.url,
    size: file.size,
    type: file.type,
    hash: file.hash,
    at: file.at || at,
  };
}

export function submitOtherRequest(companyId, employeeId, {
  type, reason, date, hours, time, files, shiftTypeId, stationId,
  purpose, party, lang, showSalary, docKind, status, recordedBy, title,
  days, paper, requestedBy, requestedById, program, institution, issuedFile,
  examDate, until, permanent, from, to, timeTo, placement, dueDate, lastDay, amount, moneyKind, nursingSplit, childBirthDate, compLeave,
  notifiedOn, art81Case, ack, remaining, nightAvoidKind, gender, jobSearch, grievanceKind,
  damageCaseId, deductionLineId, details, leaveType,
  field, newValue,
}) {
  // «طلب تعديل الملف الوظيفي»: the employee asks; the value is stored on the request, never on the file
  // until HR approves it (setOtherRequestStatus → patchEmployeeFile with HR as the actor).
  let correction = null;
  if (type === FILE_CORRECTION_TYPE) {
    const subjectEmp = (getCompanyData(companyId)?.employees || []).find((row) => String(row.id) === String(employeeId));
    const g = checkSubmitOtherRequestGate({ type, field, newValue, reason, files, employee: subjectEmp });
    if (!g.ok) return g;
    correction = { field: g.field, newValue: g.value, currentValue: fileCorrectionCurrent(subjectEmp, g.field, true) };
    // The card's title names the fact; the old and new values show once, in the card's comparison.
    title = `تعديل ${fileCorrectionField(g.field)?.ar || ""}`.trim();
  }
  if (type === "permission" && jobSearch === true) {
    // Art. 78: up to eight job-search hours a week during the employer's notice — told, not asked.
    const subjectEmp = (getCompanyData(companyId)?.employees || []).find((row) => row.id === employeeId);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
    const js = checkJobSearchHoursGate({ employee: subjectEmp, date, time, timeTo, today });
    if (!js.ok) return js;
    status = "approved";
    recordedBy = recordedBy || subjectEmp?.name || "";
  }
  if ([DAMAGE_OBJECTION_TYPE, LEAVE_CARRY_TYPE, ART81_EXIT_TYPE, NIGHT_AVOID_TYPE, DOCUMENTS_RETURN_TYPE, GRIEVANCE_TYPE].includes(type)) {
    const subjectEmp = (getCompanyData(companyId)?.employees || []).find((row) => row.id === employeeId);
    const annualLeft = type === LEAVE_CARRY_TYPE && subjectEmp ? remainingLeaveDays(subjectEmp.profile, subjectEmp.leaveRequests, "annual") : remaining;
    const rightsGate = checkSubmitOtherRequestGate({ type, reason, notifiedOn, amount, days, remaining: annualLeft, art81Case, ack, nightAvoidKind, from, until, files, gender: gender || profileGender(subjectEmp?.profile), grievanceKind, today: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date()), isHoliday: officialHolidayTest(getCompanyData(companyId)) });
    if (!rightsGate.ok) return rightsGate;
  }
  if (type === "permission" && compLeave === true) {
    // Hours of comp leave taken as a permission window, from the comp balance (regs 22 bis).
    const live = getCompanyData(companyId);
    const subject = (live?.employees || []).find((row) => String(row.id) === String(employeeId));
    const m = (v) => { const x = String(v || "").match(/^(\d{1,2}):(\d{2})/); return x ? Number(x[1]) * 60 + Number(x[2]) : null; };
    const span = m(time) != null && m(timeTo) != null ? (m(timeTo) - m(time)) / 60 : 0;
    const comp = checkTakeCompLeaveGate({ employee: subject, hours: span, on: date });
    if (!comp.ok) return comp;
  }
  // Model Arts. 9/12 (relocation), 24 (mission) and 46 (prevented day): the gate names its reason; the
  // stored details are the gate's own normalised figures, never the raw form.
  let modelDetails;
  if (MODEL_REQUEST_TYPES.includes(type)) {
    const subjectEmp = (getCompanyData(companyId)?.employees || []).find((row) => String(row.id) === String(employeeId));
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
    const modelGate = checkModelRequestSubmit({ type, details, date, reason }, subjectEmp, { actorId: requestedById, today });
    if (!modelGate.ok) return modelGate;
    if (type === RELOCATION_TYPE) modelDetails = { transferId: modelGate.transferId, basis: modelGate.basis, effectiveDate: modelGate.effectiveDate, lines: modelGate.lines, total: modelGate.total };
    if (type === MISSION_TYPE) {
      modelDetails = {
        destination: String(details?.destination || "").trim(),
        from: modelGate.from, to: modelGate.to, days: modelGate.days,
        dailyRate: Number(details?.dailyRate) || 0,
        transportProvided: details?.transportProvided !== false,
        transportConsent: details?.transportProvided === false ? details?.transportConsent === true : undefined,
        lodgingProvided: details?.lodgingProvided !== false,
        lodgingPerDay: details?.lodgingProvided === false ? Number(details?.lodgingPerDay) || 0 : 0,
        allowance: modelGate.allowance, lodging: modelGate.lodging, transport: modelGate.transport, total: modelGate.total,
      };
    }
    if (type === PREVENTED_TYPE) modelDetails = { date: modelGate.date };
  }
  const file = Array.isArray(files) ? files[0] : files || null;
  if (type === "advance" && !(Number(amount) > 0)) {
    return { ok: false, error: "AMOUNT_REQUIRED", reason: "اكتب المبلغ المطلوب.", reasonEn: "Write the amount requested." };
  }
  // Art. 79 bis(4): no deferred date in a resignation — it is dated the day it is filed, and the
  // contract ends on acceptance, after 30 days without a reply, or at the end of a postponement.
  const resignToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  // Art. 75 vs Art. 79 bis: an open-ended contract ends on the worker's 30-day written notice, no acceptance.
  const resignRoute = type === "resignation" ? resignationRouteFor((getCompanyData(companyId)?.employees || []).find((row) => String(row.id) === String(employeeId))?.profile) : "";
  const resignFacts = resignationFacts({ date: resignToday, route: resignRoute });
  const resignLast = resignRoute === EXIT_ROUTE_NOTICE75 ? resignFacts.noticeEndsOn : resignFacts.deemedAcceptedOn;
  if (type === "resignation") {
    const exitGate = checkSubmitOtherRequestGate({ type, reason, date: resignToday, lastDay: resignLast });
    if (!exitGate.ok) return exitGate;
  }
  if (isDutyRequestType(type) && type !== "shift_change") {
    const dutyGate = checkSubmitOtherRequestGate({ type, reason, date, time, timeTo, placement, until, dueDate, file, files, nursingSplit, childBirthDate, nurseryOnSite: hoursPolicyOf(getCompanyData(companyId)).nurseryOnSite === true });
    if (!dutyGate.ok) return dutyGate;
  }
  const signedPaper = paper || (Array.isArray(files) ? files[1] : null);
  if (type === STUDY_CONSENT_TYPE) {
    const snapshot = getCompanyData(companyId);
    const subject = rosterEmployeeById(snapshot?.employees, employeeId);
    const gate = checkSubmitOtherRequestGate({
      type,
      reason,
      date,
      program,
      institution,
      startDate: date,
      file,
      files,
      issuedFile,
      status,
      companyId,
      employee: subject,
      otherRequests: subject?.otherRequests,
    });
    if (!gate.ok) return gate;
    if (status === "approved") {
      const approveGate = checkApproveStudyConsentGate({ type, issuedFile, status: "pending" });
      if (!approveGate.ok) return approveGate;
    }
    reason = gate.reason || composeStudyConsentReason({ program, institution, startDate: date, reason });
  }
  let fitnessGate = null;
  if (type === NIGHT_FITNESS_TYPE) {
    const snapshot = getCompanyData(companyId);
    const subject = rosterEmployeeById(snapshot?.employees, employeeId);
    fitnessGate = checkSubmitOtherRequestGate({
      type,
      reason,
      date,
      examDate: examDate || from || date,
      from: from || examDate || date,
      to: to || until,
      until: until || to,
      permanent,
      file,
      files,
      status,
      companyId,
      employee: subject,
      employeeId,
      otherRequests: subject?.otherRequests,
      actorId: requestedById,
      requestedById,
      lane: (requestedById && String(requestedById) !== String(employeeId)) || status === "approved" ? "manage" : "mine",
    });
    if (!fitnessGate.ok) return fitnessGate;
    reason = fitnessGate.reason || reason;
  }
  const fitnessFrom = type === NIGHT_FITNESS_TYPE ? (fitnessGate?.from || from || examDate || date || undefined) : undefined;
  const fitnessTo = type === NIGHT_FITNESS_TYPE ? (fitnessGate?.permanent ? "" : (fitnessGate?.to ?? to ?? until)) : undefined;
  const fitnessPermanent = type === NIGHT_FITNESS_TYPE ? !!(fitnessGate?.permanent ?? permanent) : undefined;
  if (type === LEAVE_TOPUP_TYPE || isLetterSignableType(type)) {
    const gate = checkSubmitOtherRequestGate({ type, reason, date, days, file, files, paper: signedPaper, leaveType });
    if (!gate.ok) return gate;
  }
  if (type === "manual_punch" || type === "checkout_fix") {
    const snapshot = getCompanyData(companyId);
    const subject = rosterEmployeeById(snapshot?.employees, employeeId);
    const day = date || toRiyadhDateKey();
    const clock = parsePunchClock(time) || clockFromPunchReason(reason);
    const att = attendanceOnDate(snapshot?.personalAttendance, employeeId, day);
    const punchGate = checkSubmitOtherRequestGate({
      type,
      reason,
      date: day,
      time: clock,
      employee: subject,
      attendance: att,
    });
    if (!punchGate.ok) return punchGate;
  }
  let created = false;
  let createdId = "";
  let applyError = null;
  const raiserId = requestedById || (status === "approved" ? "" : employeeId);
  updateCompany(companyId, (d) => {
    const emp = rosterEmployeeById(d.employees, employeeId);
    if (!emp) return;
    emp.otherRequests = emp.otherRequests || [];
    const now = new Date().toISOString();
    createdId = uid("oreq");
    const request = {
      id: createdId,
      employeeId: emp.id || employeeId,
      type,
      title: String(title || "").trim() || undefined,
      reason: String(reason || "").trim(),
      amount: type === "advance" || type === DAMAGE_OBJECTION_TYPE ? Math.round((Number(amount) || 0) * 100) / 100 : undefined,
      notifiedOn: type === DAMAGE_OBJECTION_TYPE || type === GRIEVANCE_TYPE ? String(notifiedOn || "").slice(0, 10) : undefined,
      grievanceKind: type === GRIEVANCE_TYPE ? grievanceKind : undefined,
      grievanceReplyBy: type === GRIEVANCE_TYPE ? grievanceReplyBy(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date()), officialHolidayTest(d)) : undefined,
      objectionLastDay: type === DAMAGE_OBJECTION_TYPE ? damageObjectionDeadline(notifiedOn) : undefined,
      // Art. 91: the objection names the damage case it contests (instalments share it) — the refund
      // follows that case, never a guess by day and amount.
      damageCaseId: type === DAMAGE_OBJECTION_TYPE ? (String(damageCaseId || "").trim() || (deductionLineId ? undefined : damageCaseIdFor({ damageNoticeOn: notifiedOn })) || undefined) : undefined,
      deductionLineId: type === DAMAGE_OBJECTION_TYPE && deductionLineId ? String(deductionLineId) : undefined,
      art81Case: type === ART81_EXIT_TYPE ? art81Case : undefined,
      nightAvoidKind: type === NIGHT_AVOID_TYPE ? nightAvoidKind : undefined,
      avoidFrom: type === NIGHT_AVOID_TYPE ? String(from || "").slice(0, 10) : undefined,
      avoidUntil: type === NIGHT_AVOID_TYPE ? (String(until || "").slice(0, 10) || undefined) : undefined,
      moneyKind: type === "advance" ? (moneyKind === "allowance" ? "allowance" : "advance") : undefined,
      details: modelDetails,
      date: type === "resignation" ? resignToday : (date || undefined),
      hours: hours || undefined,
      time: time || undefined,
      timeTo: type === "permission" ? (timeTo || undefined) : undefined,
      compLeave: type === "permission" && compLeave === true ? true : undefined,
      jobSearch: type === "permission" && jobSearch === true ? true : undefined,
      placement: type === "nursing_hour" ? (placement || undefined) : undefined,
      nursingSplit: type === "nursing_hour" && nursingSplit ? nursingSplit : undefined,
      childBirthDate: type === "nursing_hour" ? (childBirthDate || undefined) : undefined,
      dueDate: type === "pregnancy_notice" ? (dueDate || undefined) : undefined,
      lastDay: type === "resignation" ? resignLast : undefined,
      exitRoute: type === "resignation" ? resignRoute : undefined,
      days: type === LEAVE_TOPUP_TYPE ? parseLeaveTopupDaysSafe(days) : type === LEAVE_CARRY_TYPE ? Math.floor(Number(days)) : (days || undefined),
      leaveType: type === LEAVE_TOPUP_TYPE ? (String(leaveType || "grant").trim() || "grant") : undefined,
      field: correction ? correction.field : undefined,
      newValue: correction ? correction.newValue : undefined,
      currentValue: correction ? correction.currentValue : undefined,
      shiftTypeId: shiftTypeId || undefined,
      stationId: stationId || emp.stationId || undefined,
      files: files || [],
      purpose: purpose || undefined,
      party: party || undefined,
      lang: lang || undefined,
      showSalary: showSalary === undefined ? undefined : !!showSalary,
      docKind: docKind || undefined,
      status: status === "approved" ? "approved" : "pending",
      recordedBy: recordedBy || undefined,
      requestedBy: requestedBy || recordedBy || undefined,
      requestedById: raiserId || undefined,
      reviewedBy: status === "approved" ? recordedBy : undefined,
      reviewedAt: status === "approved" ? now : undefined,
      createdAt: now,
      companyId,
      program: type === STUDY_CONSENT_TYPE ? String(program || "").trim() || undefined : undefined,
      institution: type === STUDY_CONSENT_TYPE ? String(institution || "").trim() || undefined : undefined,
      startDate: type === STUDY_CONSENT_TYPE ? (date || undefined) : undefined,
      from: type === NIGHT_FITNESS_TYPE ? (fitnessPermanent ? (fitnessFrom || "") : fitnessFrom) : undefined,
      to: type === NIGHT_FITNESS_TYPE ? (fitnessPermanent ? "" : fitnessTo) : undefined,
      examDate: type === NIGHT_FITNESS_TYPE ? fitnessFrom : undefined,
      until: type === NIGHT_FITNESS_TYPE ? (fitnessPermanent ? "" : fitnessTo) : (type === "nursing_hour" ? (until || nursingRightUntil(childBirthDate) || undefined) : undefined),
      permanent: type === NIGHT_FITNESS_TYPE ? fitnessPermanent : undefined,
      approvedAt: (type === STUDY_CONSENT_TYPE || type === NIGHT_FITNESS_TYPE) && status === "approved" ? now : undefined,
      approvedBy: (type === STUDY_CONSENT_TYPE || type === NIGHT_FITNESS_TYPE) && status === "approved" ? recordedBy : undefined,
    };
    if ((type === STUDY_CONSENT_TYPE || type === NIGHT_FITNESS_TYPE) && file) {
      const stamped = stampRequestFile(file, now);
      request.file = stamped;
      request.files = [stamped];
    }
    if (type === STUDY_CONSENT_TYPE && status === "approved" && issuedFile) {
      const stampedIssued = stampRequestFile(issuedFile, now);
      request.issuedFile = stampedIssued;
      request.approvalFile = stampedIssued;
    }
    // Custody is the one letter type raised with a paper to sign; a document request's file is supporting proof.
    if (isLetterSignableType(type) && file && (type === "custody" || signedPaper)) {
      request.senderFile = file;
      if (signedPaper) request.paper = signedPaper;
    }
    if (request.status === "approved" && (request.type === "manual_punch" || request.type === "checkout_fix")) {
      const stamped = stampPunchRequestOnDraft(d, emp, request, recordedBy);
      if (!stamped.ok) {
        applyError = stamped;
        return;
      }
    }
    if (request.status === "approved" && isDutyRequestType(request.type)) {
      applyDutyRequestOnDraft(d, emp, request);
    }
    if (request.status === "approved" && request.type === LEAVE_TOPUP_TYPE) {
      const applied = stampLeaveTopupOnEmployee(emp, request);
      if (!applied.ok) {
        applyError = applied;
        return;
      }
    }
    if (request.status === "approved" && request.type === NIGHT_FITNESS_TYPE) {
      const applied = stampNightFitnessOnEmployee(emp, request, {
        reviewedAt: now,
        from: request.from,
        to: request.to,
        examDate: request.from || request.examDate,
        until: request.to || request.until,
        permanent: request.permanent,
      });
      if (!applied.ok) {
        applyError = applied;
        return;
      }
    }
    const raiseStamp = stampRequestAudit(companyId, emp, request, {
      actor: requestedBy || recordedBy || emp.name || auditActor,
      family: "other",
      verb: "raise",
      note: request.reason,
    });
    request.auditTrail = appendRequestAudit(request, raiseStamp.row);
    pushEmployeeFileLog(emp, raiseStamp.log);
    if (request.status === "approved") {
      const approveStamp = stampRequestAudit(companyId, emp, request, {
        actor: recordedBy || requestedBy || auditActor,
        family: "other",
        verb: "approve",
      });
      request.auditTrail = appendRequestAudit(request, approveStamp.row);
      pushEmployeeFileLog(emp, approveStamp.log);
    }
    emp.otherRequests.unshift(request);
    created = true;
  });
  if (applyError) return applyError;
  if (!created) {
    return { ok: false, error: "EMPLOYEE_NOT_FOUND", reason: "الموظف غير موجود.", reasonEn: "Employee was not found." };
  }
  const data = getCompanyData(companyId);
  const filed = rosterEmployeeById(data?.employees, employeeId);
  const raised = (filed?.otherRequests || []).find((row) => row.id === createdId);
  if (raised && raised.status !== "approved") {
    const emp = filed;
    const lang = getUiLang();
    const label = otherRequestTypeLabel(type, lang === "ar");
    notifyRequestManagers(
      companyId,
      emp?.id || employeeId,
      requestManagerNotice(data, emp, label, lang),
    );
    if (type === "heat_report") {
      notifyRequestManagers(
        companyId,
        emp?.id || employeeId,
        `مخالفة حظر الشمس — ${emp?.name || "موظف"} يبلّغ أنه كُلّف بعمل مكشوف يوم ${raised.date || ""} في ساعات الحظر (القرار 3337). انقله إلى مكان مظلّل وقرّر البلاغ في الطلبات.`,
      );
    }
  }
  if (raised && type === "permission" && jobSearch === true) {
    notifyRequestManagers(companyId, filed?.id || employeeId, `${filed?.name || "موظف"} أشعر بساعات بحث عن عمل يوم ${regulationDate(raised.date)} (${raised.time}–${raised.timeTo}) بأجرها — حق له خلال مهلة إشعارك، ثماني ساعات في الأسبوع (المادة 78)، لا يحتاج اعتماداً.`);
  }
  if (raised && type === GRIEVANCE_TYPE) {
    const kindAr = GRIEVANCE_KINDS.find((k) => k.key === raised.grievanceKind)?.ar || "";
    notifyRequestManagers(companyId, filed?.id || employeeId, `تظلم من ${filed?.name || "موظف"} على ${kindAr} أُبلغ به في ${regulationDate(raised.notifiedOn)} — أبلغه بنتيجة البت كتابةً حتى ${regulationDate(raised.grievanceReplyBy)} (خمسة عشر يوماً عدا العطل الرسمية). لا يُضار العامل من تظلمه (النموذج الموحد م71).`);
  }
  if (raised && type === ART81_EXIT_TYPE) {
    // Art. 81: the worker leaves today, keeping all his rights. The file carries the exit at once.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
    updateCompany(companyId, (d) => {
      const e = d.employees.find((row) => row.id === (filed?.id || employeeId));
      if (!e) return;
      const exit = e.profile?.contractExit || {};
      const row = (e.otherRequests || []).find((r) => r.id === createdId);
      if (row) row.previousContractExit = e.profile?.contractExit ? JSON.parse(JSON.stringify(e.profile.contractExit)) : null;
      e.profile = { ...(e.profile || {}), contractExit: { ...exit, reason: "article_81", party: "worker", art81Case, effectiveDate: today, status: "worker_left", noticeAt: today, art81RequestId: createdId } };
    });
    const caseMeta = ART81_CASES.find((c) => c.key === art81Case);
    notifyRequestManagers(companyId, filed?.id || employeeId, `${filed?.name || "موظف"} ترك العمل دون إشعار وفق المادة 81 — الحالة: ${caseMeta?.ar || ""}. يحتفظ بحقوقه النظامية كلها؛ ابدأ إجراءات إنهاء الخدمة، والخلاف إن وقع أمام المحكمة العمالية.`);
  }
  if (raised) {
    invokeWorkforce({ action: "submitOther", companyId, employeeId: filed?.id || employeeId, request: raised });
  }
  if (isLetterSignableType(type)) {
    audit(companyId, "request_signed_in_requests", `Hand-signed ${type} ${createdId} raised in My Requests for ${employeeId}.`);
  }
  return { ok: true, id: createdId };
}

/** The rostered shift a person holds on `day` (their own station's schedule first). */
function rosteredShiftOn(data, employee, day) {
  const own = String(employee?.stationId || "");
  const list = [...(data?.schedules || [])].sort((a, b) => (String(b.stationId) === own) - (String(a.stationId) === own));
  for (const schedule of list) {
    const shift = employeeShiftOnDay(schedule, employee?.id, day);
    if (shift) return shift;
  }
  return null;
}

/** Lateness of a manual check-in measured from the rostered start (Art. 154 start minutes excused). */
function manualLatenessFor(data, employee, day, clock) {
  const shift = rosteredShiftOn(data, employee, day);
  if (!shift?.start || !clock) return null;
  const nursing = nursingStartMinutesOf(employee, day);
  return manualPunchLateness({ clock, shiftStart: shift.start, nursingStartMinutes: nursing });
}

function nursingStartMinutesOf(employee, day) {
  try { return nursingHourOn(employee, day)?.startMinutes || 0; } catch { return 0; }
}

function stampPunchRequestOnDraft(draft, employee, request, reviewerName) {
  const day = request.date || toRiyadhDateKey();
  const clock = parsePunchClock(request.time) || clockFromPunchReason(request.reason);
  const existing = attendanceOnDate(draft.personalAttendance, employee.id, day);
  const gate = checkPunchRecordGate({
    type: request.type,
    employee,
    attendance: existing,
    date: day,
    time: clock,
    reason: request.reason,
    requireTime: true,
  });
  if (!gate.ok) return gate;
  const row = buildManualAttendanceRow({
    existing,
    employee,
    date: day,
    time: clock,
    kind: request.type === "checkout_fix" ? "checkout_fix" : "manual_punch",
    by: reviewerName || request.recordedBy || "",
    reason: request.reason,
    stationId: request.stationId || employee.stationId,
    lateness: request.type === "checkout_fix" ? null : manualLatenessFor(draft, employee, day, clock),
  });
  const list = Array.isArray(draft.personalAttendance) ? draft.personalAttendance : [];
  const idx = list.findIndex((item) => item.id === row.id || (String(item.employeeId) === String(employee.id) && String(item.date) === day));
  if (idx >= 0) list[idx] = { ...list[idx], ...row };
  else list.push(row);
  draft.personalAttendance = list;
  const stamped = stampActualOvertime(draft, employee, day, idx >= 0 ? list[idx] : row);
  stampActualDutyBreaches(draft, employee, day, idx >= 0 ? list[idx] : row);
  restampWeekAfter(draft, employee, day);
  if (stamped?.ok && isOtDecisionOpenEntry(draft.otDecisions?.[`${employee.id}:${day}`])) queueOtPendingNotice(employee.id, day, stamped.holiday);
  request.time = clock;
  request.attendanceId = row.id;
  return { ok: true, row };
}

export function recordManualAttendance(companyId, { employeeId, kind, date, time, reason, by, stationId }) {
  const type = kind === "out" || kind === "checkout_fix" ? "checkout_fix" : "manual_punch";
  const day = date || toRiyadhDateKey();
  const data = getCompanyData(companyId);
  const employee = data?.employees.find((row) => String(row.id) === String(employeeId));
  if (!employee) {
    return { ok: false, error: "EMPLOYEE_NOT_FOUND", reason: "الموظف غير موجود.", reasonEn: "That employee was not found." };
  }
  const clock = parsePunchClock(time);
  const existing = attendanceOnDate(data?.personalAttendance, employeeId, day);
  const gate = checkPunchRecordGate({
    type,
    employee,
    attendance: existing,
    date: day,
    time: clock,
    reason,
    // The manager writes the real time — a click time would invent hours (and overtime) nobody worked.
    requireTime: true,
  });
  if (!gate.ok) return gate;
  const timeGate = checkManualTimeGate({ kind: type, date: day, time: clock, checkInAt: existing?.checkInAt || existing?.check_in_at });
  if (!timeGate.ok) return timeGate;
  let saved = null;
  updateCompany(companyId, (draft) => {
    const emp = draft.employees.find((row) => String(row.id) === String(employeeId));
    const current = attendanceOnDate(draft.personalAttendance, employeeId, day);
    const row = buildManualAttendanceRow({
      existing: current,
      employee: emp || employee,
      date: day,
      time: clock || undefined,
      kind: type,
      by,
      reason,
      stationId: stationId || emp?.stationId,
      lateness: type === "checkout_fix" ? null : manualLatenessFor(draft, emp || employee, day, clock),
    });
    if (type === "checkout_fix") {
      // Leaving before the shift end stays visible as an early checkout, as on a real punch.
      const shift = rosteredShiftOn(draft, emp || employee, day);
      row.earlyCheckout = isEarlyCheckoutAt(shift, row.checkOutAt, nursingHourOn(emp || employee, day)?.endMinutes || 0);
    }
    const list = Array.isArray(draft.personalAttendance) ? draft.personalAttendance : [];
    const idx = list.findIndex((item) => item.id === row.id || (String(item.employeeId) === String(employeeId) && String(item.date) === day));
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.push(row);
    draft.personalAttendance = list;
    saved = idx >= 0 ? list[idx] : row;
    const stamped = stampActualOvertime(draft, emp || employee, day, saved);
    stampActualDutyBreaches(draft, emp || employee, day, saved);
    restampWeekAfter(draft, emp || employee, day);
    if (stamped?.ok && isOtDecisionOpenEntry(draft.otDecisions?.[`${employeeId}:${day}`])) queueOtPendingNotice(employeeId, day, stamped.holiday);
  });
  flushOtPendingNotices(companyId);
  audit(companyId, type === "checkout_fix" ? "manual_checkout" : "manual_checkin", `${by || "manager"} recorded ${type} for ${employee.name} on ${day} at ${clock}.`);
  const why = String(reason || "").trim();
  addNotification(companyId, employee.id, type === "checkout_fix"
    ? `ثبّت ${by || "مديرك"} انصرافك ليوم ${day} الساعة ${clock}${why ? ` — ${why}` : ""}. السجل في بصمتي.`
    : `اعتمد ${by || "مديرك"} حضورك ليوم ${day} الساعة ${clock}${why ? ` — ${why}` : ""}. السجل في بصمتي.`, { to: "/app/attendance" });
  return { ok: true, attendance: toCloudAttendanceRow(saved) };
}

/**
 * The manager's decision on a «طلب بصمة يدوية» (manual_punch / checkout_fix): approve at the requested
 * time (the manager may correct it — the change is written on the request) or refuse with a written reason.
 * Either closes the request (status, reviewer, audit), notifies the worker, and leaves the queue.
 */
export function decideManualPunchRequest(companyId, employeeId, requestId, { decision, time, note, by, byId } = {}) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => String(row.id) === String(employeeId));
  const req = (emp?.otherRequests || []).find((row) => row.id === requestId);
  if (!req || (req.type !== "manual_punch" && req.type !== "checkout_fix")) {
    return { ok: false, error: "REQUEST_NOT_FOUND", reason: "الطلب غير موجود.", reasonEn: "That request was not found." };
  }
  if ((req.status || "pending") !== "pending") {
    return { ok: false, error: "ALREADY_DECIDED", reason: "قُرّر هذا الطلب من قبل.", reasonEn: "This request was already decided." };
  }
  if (decision === "rejected") {
    return setOtherRequestStatus(companyId, employeeId, requestId, "rejected", by, note, { actorId: byId });
  }
  if (decision !== "approved") {
    return { ok: false, error: "DECISION_REQUIRED", reason: "اختر: اعتماد أو رفض.", reasonEn: "Choose: approve or refuse." };
  }
  const asked = parsePunchClock(req.time) || clockFromPunchReason(req.reason);
  const clock = parsePunchClock(time) || asked;
  const day = req.date || toRiyadhDateKey();
  const att = attendanceOnDate(data?.personalAttendance, employeeId, day);
  const timeGate = checkManualTimeGate({ kind: req.type, date: day, time: clock, checkInAt: att?.checkInAt || att?.check_in_at });
  if (!timeGate.ok) return timeGate;
  if (clock !== asked) {
    updateCompany(companyId, (d) => {
      const e = d.employees.find((row) => String(row.id) === String(employeeId));
      const r = (e?.otherRequests || []).find((row) => row.id === requestId);
      if (!r) return;
      r.requestedTime = asked || "";
      r.time = clock;
    });
  }
  const changed = clock !== asked ? `عُدّل الوقت من ${asked || "—"} إلى ${clock}` : "";
  return setOtherRequestStatus(companyId, employeeId, requestId, "approved", by, [changed, String(note || "").trim()].filter(Boolean).join(" — "), { actorId: byId });
}

/**
 * Art. 17 — the owner records that the work-hours table, rest periods, weekly rest day and shift times
 * are posted at the workplace (date + who). Withdrawing clears it. The posting warning reads this.
 */
export function recordWorkPosting(companyId, { posted = true, date, by } = {}) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? String(date) : toRiyadhDateKey();
  updateCompany(companyId, (d) => {
    const write = (bag) => {
      const prior = bag.workPosting || {};
      bag.workPosting = posted
        ? { ...prior, posted: true, postedAt: day, postedBy: by || "" }
        : { ...prior, posted: false, postedAt: "", postedBy: "" };
    };
    d.hoursPolicy = d.hoursPolicy || {};
    write(d.hoursPolicy);
    // A copy kept under attendanceSettings would shadow the main one — keep both in step.
    if (d.attendanceSettings?.hoursPolicy?.workPosting) write(d.attendanceSettings.hoursPolicy);
  });
  audit(companyId, "work_posting", posted ? `${by || "owner"} recorded the Art. 17 posting on ${day}.` : `${by || "owner"} withdrew the Art. 17 posting.`);
  return { ok: true, postedAt: posted ? day : "" };
}

/**
 * «اعتمد حضوراً» on a late / out-of-range row, recorded locally (the twin of the cloud excuseAttendance):
 * the record stays, the penalty goes, the decision carries the manager's name and time.
 */
export function excuseAttendanceLocal(companyId, employeeId, dayKey, { excused = true, by, byId, note } = {}) {
  if (byId && String(byId) === String(employeeId)) {
    return { ok: false, error: "SELF_DECISION", reason: "لا يعتمد الموظف حضوره بنفسه — القرار لمديره.", reasonEn: "A worker does not approve their own attendance." };
  }
  const data = getCompanyData(companyId);
  const row = attendanceOnDate(data?.personalAttendance, employeeId, dayKey);
  if (!row) return { ok: false, error: "NO_ATTENDANCE", reason: "لا سجل حضور لهذا اليوم.", reasonEn: "No attendance record for this day." };
  let saved = null;
  updateCompany(companyId, (d) => {
    const live = (d.personalAttendance || []).find((item) => String(item.employeeId ?? item.employee_id) === String(employeeId) && String(item.date || item.dateKey || "").slice(0, 10) === dayKey);
    if (!live) return;
    live.excused = !!excused;
    live.excusedByName = excused ? (by || "") : "";
    live.excusedAt = excused ? new Date().toISOString() : null;
    if (excused && String(note || "").trim()) live.excusedNote = String(note).trim();
    saved = live;
  });
  audit(companyId, "attendance_excused", `${by || "manager"} ${excused ? "approved" : "un-approved"} the attendance of ${employeeId} on ${dayKey}.`);
  if (excused) addNotification(companyId, employeeId, `اعتمد ${by || "مديرك"} حضورك ليوم ${dayKey} — لا يُحتسب عليك التأخير.`, { to: "/app/attendance" });
  return { ok: true, attendance: toCloudAttendanceRow(saved) };
}

function parseLeaveTopupDaysSafe(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}

export function submitOtAssignment(companyId, employeeId, input = {}) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  if (!emp) {
    return { ok: false, error: "EMPLOYEE_NOT_FOUND", reason: "الموظف غير موجود.", reasonEn: "Employee was not found." };
  }
  const rosterOt = employeeRosterOtContext(data?.schedules, emp, input.date, laborCalendarOf(data));
  const gate = checkRaiseOtAssignmentGate({
    ...input,
    ordinaryHours: input.ordinaryHours ?? rosterOt.ordinaryHours,
    presenceHours: input.presenceHours ?? rosterOt.presenceHours,
    rosterWeekHours: input.rosterWeekHours ?? rosterOt.rosterWeekHours,
    employee: emp,
    otherRequests: emp.otherRequests,
  });
  if (!gate.ok) return gate;
  let createdId = "";
  updateCompany(companyId, (d) => {
    const employee = d.employees.find((row) => row.id === employeeId);
    if (!employee) return;
    employee.otherRequests = employee.otherRequests || [];
    createdId = uid("oreq");
    const now = new Date().toISOString();
    const files = Array.isArray(input.files) ? input.files.filter(Boolean) : (input.file ? [input.file] : []);
    employee.otherRequests.unshift({
      id: createdId,
      type: "overtime",
      assignment: true,
      source: "assignment",
      reason: gate.reason,
      date: gate.date,
      dateTo: gate.dateTo,
      hours: gate.hours,
      creditDays: gate.creditDays,
      article106: gate.article106,
      article106Ground: gate.article106Ground,
      manager106Ack: gate.article106 ? true : undefined,
      // Regs Art. 22: over the annual cap the worker's own acceptance carries the consent.
      annualCapConsentRequested: gate.capConsentRequested ? true : undefined,
      files,
      stationId: input.stationId || employee.stationId || undefined,
      status: OT_STATUS.pending_employee,
      recordedBy: input.by || input.recordedBy || undefined,
      createdAt: now,
    });
  });
  if (!createdId) {
    return { ok: false, error: "EMPLOYEE_NOT_FOUND", reason: "الموظف غير موجود.", reasonEn: "Employee was not found." };
  }
  {
    // Tell the worker what is on offer in his own numbers (Art. 107 · regs 22 bis).
    const offer = otOffer({ employee: emp, hours: gate.hours, date: gate.date });
    addNotification(companyId, employeeId, `كُلّفت بعمل إضافي مدته ${otHoursAr(offer.hours)} يوم ${regulationDate(gate.date)}${input.by ? ` من ${input.by}` : ""}. اختر تعويضك من طلباتي: أجر إضافي ${offer.known ? otSar(offer.pay.total) : "يُحسب في المسير"}، أو إجازة تعويضية ${otHoursAr(offer.leave.hours)}.`, { to: "/app/requests" });
  }
  audit(companyId, "ot_assignment_raised", `Overtime assignment raised for ${emp.name} by ${input.by || ""}.`);
  return { ok: true, id: createdId, status: OT_STATUS.pending_employee, creditDays: gate.creditDays };
}

export function answerOtAssignment(companyId, employeeId, requestId, { accept, compensation, ack, note, enjoyDate, windowAgreed, annualCapConsent } = {}) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  const req = (emp?.otherRequests || []).find((row) => row.id === requestId);
  if (!emp || !isOvertimeAssignment(req) || req.status !== OT_STATUS.pending_employee) {
    return {
      ok: false,
      error: "REQUEST_NOT_FOUND",
      reason: "تكليف الإضافي غير موجود أو ليس بانتظارك.",
      reasonEn: "That overtime assignment was not found or is not awaiting you.",
    };
  }
  if (!accept) {
    const refuse = checkRefuseOtAssignmentGate(req);
    if (!refuse.ok) return refuse;
    updateCompany(companyId, (d) => {
      const employee = d.employees.find((row) => row.id === employeeId);
      const request = (employee?.otherRequests || []).find((row) => row.id === requestId);
      if (!request) return;
      request.status = OT_STATUS.refused_by_employee;
      request.employeeAck = false;
      request.reply = String(note || "").trim();
      request.answeredAt = new Date().toISOString();
      request.answeredBy = employee.name;
    });
    const managerId = data.employees.find((row) => row.name === req.recordedBy)?.id;
    if (managerId) addNotification(companyId, managerId, `${emp.name} رفض تكليف الساعات الإضافية.`);
    addNotification(companyId, employeeId, "سُجّل رفضك لتكليف الساعات الإضافية.");
    audit(companyId, "ot_assignment_refused", `${emp.name} refused an overtime assignment.`);
    return { ok: true, status: OT_STATUS.refused_by_employee };
  }
  const acceptGate = checkEmployeeAcceptOtGate({
    ...req,
    compensation,
    ack,
    hours: req.hours,
    date: req.date,
    enjoyDate,
    windowAgreed,
    annualCapConsent,
    otherRequests: emp.otherRequests,
    exceptId: requestId,
    overtimeHoursOutsideYtd: overtimeYearUsageOutsideAssignments(data?.otDecisions, employeeId, req.date).hours,
    creditDaysOutsideYtd: overtimeYearUsageOutsideAssignments(data?.otDecisions, employeeId, req.date).creditDays,
  });
  if (!acceptGate.ok) return acceptGate;
  updateCompany(companyId, (d) => {
    const employee = d.employees.find((row) => row.id === employeeId);
    const request = (employee?.otherRequests || []).find((row) => row.id === requestId);
    if (!request) return;
    request.status = OT_STATUS.pending_manager;
    request.compensation = acceptGate.compensation;
    request.compensationChoice = acceptGate.compensation;
    request.employeeAck = true;
    request.creditDays = otCreditDays(request.hours, request.date);
    request.enjoyDate = acceptGate.enjoyDate || undefined;
    request.windowAgreed = windowAgreed === true ? true : undefined;
    request.annualCapConsent = annualCapConsent === true ? true : undefined;
    request.answeredAt = new Date().toISOString();
    request.answeredBy = employee.name;
  });
  const managerId = data.employees.find((row) => row.name === req.recordedBy)?.id;
  if (managerId) {
    addNotification(
      companyId,
      managerId,
      (() => {
        const offer = otOffer({ employee: emp, hours: req.hours, date: req.date, exceptId: requestId });
        return acceptGate.compensation === "credit"
          ? `${emp.name} اختار إجازة تعويضية ${otHoursAr(offer.leave.hours)} بدل الأجر الإضافي — بانتظار اعتمادك.`
          : `${emp.name} اختار أجر الساعات الإضافية${offer.known ? ` (${otSar(offer.pay.total)})` : ""} — بانتظار اعتمادك.`;
      })(),
      { to: "/app/requests/manage" },
    );
  }
  audit(companyId, "ot_assignment_accepted", `${emp.name} chose ${acceptGate.compensation} for overtime.`);
  return { ok: true, status: OT_STATUS.pending_manager, compensation: acceptGate.compensation };
}

function consentVerifyRef() {
  try {
    return generateVerificationId();
  } catch {
    return `PWC-${Date.now().toString(36).toUpperCase()}`;
  }
}

export function requestWrittenConsent(companyId, employeeId, {
  topic = "night",
  body,
  deadline,
  file,
  paper,
  requestedBy,
  requestedById,
}) {
  const topicMeta = consentTopicMeta(topic);
  if (topicMeta.id === "night" || topic === "night" || topic === "night_consent") {
    return {
      ok: false,
      error: "NIGHT_AUTO",
      reason: "موافقة 18632 تُفتح تلقائياً للموظف بعد ثلاثة أشهر. الإدارة تُبلَّغ فقط ولا ترفعها ولا تقرر فيها.",
      reasonEn: "Decision 18632 opens automatically for the worker after three months. Management is notified only and neither raises nor decides it.",
    };
  }
  const gate = checkRaiseConsentGate({ employeeId, body, deadline, file, paper });
  if (!gate.ok) return gate;
  let createdId = "";
  updateCompany(companyId, (draft) => {
    const emp = draft.employees.find((row) => row.id === employeeId);
    if (!emp) return;
    emp.otherRequests = emp.otherRequests || [];
    const now = new Date().toISOString();
    createdId = uid("wcon");
    emp.otherRequests.unshift({
      id: createdId,
      type: WRITTEN_CONSENT_TYPE,
      topic: topicMeta.id,
      titleAr: topicMeta.ar,
      titleEn: topicMeta.en,
      citeAr: topicMeta.citeAr,
      citeEn: topicMeta.citeEn,
      article: topicMeta.article || "",
      decisionId: topicMeta.decisionId || "",
      reason: String(body || "").trim(),
      deadline,
      senderFile: file || null,
      paper: paper || null,
      status: "open",
      answeredAt: "",
      requestedBy: requestedBy || "",
      requestedById: requestedById || "",
      createdAt: now,
    });
  });
  if (!createdId) {
    return { ok: false, error: "EMPLOYEE_NOT_FOUND", reason: "الموظف غير موجود.", reasonEn: "That employee was not found." };
  }
  addNotification(companyId, employeeId, `موافقة خطية في طلباتي: اكتب موافقة خطية، وقّع الملف في قسم التوقيع، ثم ارفع النسخة لاعتمادها — أو ارفض مباشرة.`);
  audit(companyId, "written_consent_raised", `Written consent ${topicMeta.id} opened in My Requests for ${employeeId} by ${requestedBy || ""}.`);
  return { ok: true, id: createdId };
}

export function markWrittenConsentRead(companyId, employeeId, requestId) {
  let found = false;
  updateCompany(companyId, (draft) => {
    const emp = draft.employees.find((row) => row.id === employeeId);
    const req = (emp?.otherRequests || []).find((row) => row.id === requestId && row.type === WRITTEN_CONSENT_TYPE);
    if (!req || req.status !== "open") return;
    found = true;
    if (!req.readAt) req.readAt = new Date().toISOString();
  });
  if (!found) {
    return { ok: false, error: "REQUEST_NOT_FOUND", reason: "طلب الموافقة غير موجود.", reasonEn: "That consent request was not found." };
  }
  return { ok: true };
}

export function applyWrittenConsentSeal(companyId, employeeId, requestId, seal) {
  if (!seal?.url) {
    return { ok: false, error: "SEAL_REQUIRED", reason: "اختر توقيعاً محفوظاً.", reasonEn: "Pick a saved seal." };
  }
  const ref = seal.signatureId || consentVerifyRef();
  let found = false;
  updateCompany(companyId, (draft) => {
    const emp = draft.employees.find((row) => row.id === employeeId);
    const req = (emp?.otherRequests || []).find((row) => row.id === requestId && row.type === WRITTEN_CONSENT_TYPE);
    if (!req || req.status !== "open") return;
    found = true;
    req.seal = {
      id: seal.id || "signature",
      label: seal.labelAr || seal.labelEn || "",
      url: seal.url,
      signatureId: ref,
    };
  });
  if (!found) {
    return { ok: false, error: "REQUEST_NOT_FOUND", reason: "طلب الموافقة غير موجود.", reasonEn: "That consent request was not found." };
  }
  return { ok: true, signatureId: ref };
}

export function clearWrittenConsentSeal(companyId, employeeId, requestId) {
  updateCompany(companyId, (draft) => {
    const emp = draft.employees.find((row) => row.id === employeeId);
    const req = (emp?.otherRequests || []).find((row) => row.id === requestId && row.type === WRITTEN_CONSENT_TYPE);
    if (req && req.status === "open") req.seal = null;
  });
  return { ok: true };
}

export function attachWrittenConsentPaper(companyId, employeeId, requestId, file) {
  if (!file?.name) {
    return { ok: false, error: "PAPER_REQUIRED", reason: "ارفع النسخة الموقّعة.", reasonEn: "Upload the signed copy." };
  }
  let found = false;
  updateCompany(companyId, (draft) => {
    const emp = draft.employees.find((row) => row.id === employeeId);
    const req = (emp?.otherRequests || []).find((row) => row.id === requestId);
    const openWritten = req?.type === WRITTEN_CONSENT_TYPE && req.status === "open";
    const openNight = req?.type === "night_consent" && (req.status || "pending") === "pending";
    if (!req || (!openWritten && !openNight)) return;
    found = true;
    req.paper = {
      name: file.name,
      hash: file.hash || "",
      url: file.url || "",
      size: file.size || 0,
    };
  });
  if (!found) {
    return { ok: false, error: "REQUEST_NOT_FOUND", reason: "طلب الموافقة غير موجود.", reasonEn: "That consent request was not found." };
  }
  return { ok: true };
}

export function settleSignableOtherRequest(companyId, employeeId, requestId, { accept, note, docUrl, verificationId } = {}) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  const req = (emp?.otherRequests || []).find((row) => row.id === requestId);
  if (!emp || !req || !isLetterSignableType(req.type) || !isOpenSignableStatus(req.status)) {
    return {
      ok: false,
      error: "REQUEST_NOT_FOUND",
      reason: "الطلب غير موجود أو ليس بانتظار التوقيع.",
      reasonEn: "That request was not found or is not awaiting a signature.",
    };
  }
  if (!accept) {
    const gate = checkRefuseConsentGate({ note, viaSigning: true });
    if (!gate.ok) return gate;
  }
  const now = new Date().toISOString();
  const verifyId = verificationId || req.verifyId || consentVerifyRef();
  updateCompany(companyId, (draft) => {
    const employee = draft.employees.find((row) => row.id === employeeId);
    const request = (employee?.otherRequests || []).find((row) => row.id === requestId);
    if (!request) return;
    request.status = accept ? "approved" : "rejected";
    request.answeredAt = now;
    request.reviewedAt = now;
    request.reviewedBy = emp.name;
    request.reply = String(note || "").trim();
    if (String(note || "").trim()) request.reviewNote = String(note).trim();
    if (docUrl) request.signedDocUrl = docUrl;
    if (accept) {
      request.verifyId = verifyId;
      request.issued = isLetterSignableType(request.type) && request.type !== "custody";
      request.signedAt = now;
    }
  });
  const managerId = req.requestedById && req.requestedById !== employeeId ? req.requestedById : null;
  if (managerId) {
    addNotification(
      companyId,
      managerId,
      accept
        ? `${emp.name} وقّع طلب ${req.type}.`
        : `${emp.name} رفض طلب ${req.type}${note ? `: ${note}` : "."}`,
    );
  }
  if (req.signerEmployeeId && req.signerEmployeeId !== employeeId) {
    addNotification(
      companyId,
      employeeId,
      accept
        ? `وُقّع طلبك (${req.type}) وبقي في ملفك.`
        : `رُفض طلبك (${req.type}) وبقي في ملفك.`,
    );
  }
  audit(
    companyId,
    accept ? "request_signed" : "request_sign_refused",
    `Signable ${req.type} ${accept ? "signed" : "refused"} (${verifyId}).`,
  );
  return { ok: true, status: accept ? "approved" : "rejected", signatureId: verifyId };
}

function isOpenSignableStatus(status) {
  return ["pending", "pending_employee", "pending_manager", "open"].includes(status || "pending");
}

export function settleWrittenConsentFromSigning(companyId, { requestId, token, accept, note, docUrl }) {
  const data = getCompanyData(companyId);
  const found = findSignableBySigning(data?.employees || [], { requestId, token })
    || findConsentBySigning(data?.employees || [], { requestId, token });
  if (!found) return { ok: true, skipped: true };
  if (isWrittenConsent(found.request)) {
    return answerWrittenConsent(companyId, found.employee.id, found.request.id, {
      accept,
      ack: !!accept,
      note: note || "",
      readAt: found.request.readAt || new Date().toISOString(),
      seal: savedConsentSeals(found.employee.profile)[0] || { url: "signed" },
      viaSigning: true,
    });
  }
  return settleSignableOtherRequest(companyId, found.employee.id, found.request.id, {
    accept,
    note,
    docUrl,
  });
}

export function answerWrittenConsent(companyId, employeeId, requestId, { accept, ack, note, paper, seal, readAt, viaSigning }) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((row) => row.id === employeeId);
  const req = (emp?.otherRequests || []).find((row) => row.id === requestId && row.type === WRITTEN_CONSENT_TYPE);
  if (!emp || !req || req.status !== "open") {
    return { ok: false, error: "REQUEST_NOT_FOUND", reason: "طلب الموافقة غير موجود.", reasonEn: "That consent request was not found." };
  }
  const autoSeal = seal || req.seal || savedConsentSeals(emp.profile)[0] || null;
  if (accept) {
    const gate = checkAcceptConsentGate({
      ack,
      readAt: readAt || req.readAt,
      file: req.senderFile,
      seal: autoSeal,
      paper: paper || req.paper,
      viaSigning,
    });
    if (!gate.ok) return gate;
  } else {
    const gate = checkRefuseConsentGate({ note, viaSigning });
    if (!gate.ok) return gate;
  }
  const now = new Date().toISOString();
  const usedSeal = accept ? autoSeal : (seal || req.seal);
  const verifyId = usedSeal?.signatureId || consentVerifyRef();
  updateCompany(companyId, (draft) => {
    const employee = draft.employees.find((row) => row.id === employeeId);
    const request = (employee?.otherRequests || []).find((row) => row.id === requestId);
    if (!request) return;
    request.status = accept ? "yes" : "no";
    request.ack = !!ack;
    request.readAt = readAt || request.readAt || (accept ? now : request.readAt);
    request.reply = String(note || "").trim();
    request.answeredAt = now;
    request.answeredBy = employee.name;
    if (paper?.name) request.paper = paper;
    if (usedSeal?.url) {
      request.seal = { ...usedSeal, signatureId: verifyId };
    }
    if (accept && request.topic === "night") {
      employee.profile = employee.profile || {};
      employee.profile.nightConsentAt = now;
    }
  });
  const managerId = req.requestedById;
  if (managerId) {
    addNotification(
      companyId,
      managerId,
      accept
        ? `${emp.name} وقّع الموافقة الخطية: ${req.titleAr || ""}.`
        : `${emp.name} رفض الموافقة الخطية: ${req.titleAr || ""}.`,
    );
  }
  addNotification(
    companyId,
    employeeId,
    accept
      ? "سُجّلت موافقتك الخطية ووصلت إلى المسؤول في طلباتي."
      : "سُجّل رفضك الخطي ووصل إلى المسؤول — والرفض لا يُتخذ سبباً لجزاء.",
  );
  const consentStamp = accept
    ? stampRequestAudit(companyId, emp, req, { actor: emp.name, note: String(note || "").trim(), family: "other", verb: "agree" })
    : stampRefuseAudit(companyId, emp, req, { actor: emp.name, note: String(note || "").trim() || "رفض الموافقة الخطية.", family: "other" });
  updateCompany(companyId, (draft) => {
    const employee = draft.employees.find((row) => row.id === employeeId);
    const request = (employee?.otherRequests || []).find((row) => row.id === requestId);
    if (request) {
      request.auditTrail = accept
        ? appendRequestAudit(request, consentStamp.row)
        : appendRequestRefuseAudit(request, consentStamp.row);
    }
    pushEmployeeFileLog(employee, consentStamp.log);
  });
  return { ok: true, status: accept ? "yes" : "no", signatureId: verifyId };
}

export function setOtherRequestStatus(companyId, employeeId, requestId, status, reviewerName, note, extras = {}) {
  const data = getCompanyData(companyId);
  const selfDecide = checkSelfDecideRequestGate({
    actorId: extras.actorId,
    subjectId: employeeId,
    status,
    ownerId: data?.ownerId,
    actor: (data?.employees || []).find((row) => String(row.id) === String(extras.actorId)) || extras.actor,
    data,
  });
  if (!selfDecide.ok) return selfDecide;
  const emp = data?.employees.find((e) => e.id === employeeId);
  const empName = emp?.name || "";
  const pending = (emp?.otherRequests || []).find((row) => row.id === requestId);
  if (pending?.type === FILE_CORRECTION_TYPE && status !== "withdrawn") {
    // Only HR (manage_employees, in scope) or the account administrator decides — the file is theirs to write.
    const actorUser = extras.actor || (data?.employees || []).find((row) => String(row.id) === String(extras.actorId)) || null;
    const fileGate = checkDecideFileCorrectionGate(actorUser, emp, data);
    if (!fileGate.ok) return fileGate;
    if (status === "approved" && !fileCorrectionPatch(pending)) {
      return { ok: false, error: "VALUE_INVALID", reason: "القيمة المطلوبة لا تصلح للبيان — اطلب من الموظف تعديل طلبه.", reasonEn: "The requested value does not fit the field — ask the worker to revise." };
    }
  }
  const revokeGate = checkRevokeStudyConsentGate(pending, status);
  if (!revokeGate.ok) return revokeGate;
  if (status === "rejected" && pending?.type === STUDY_CONSENT_TYPE) {
    const rejectGate = checkRejectStudyConsentGate(pending, note);
    if (!rejectGate.ok) return rejectGate;
  }
  if (status === "rejected" && pending?.type === NIGHT_FITNESS_TYPE) {
    const rejectGate = checkRejectNightFitnessGate(pending, note);
    if (!rejectGate.ok) return rejectGate;
  }
  if (pending?.type === RESIGNATION_TYPE) {
    const actorIsSelfR = extras.actorId && String(extras.actorId) === String(employeeId);
    if (status === "rejected" || status === "revise") {
      return {
        ok: false,
        error: "RESIGNATION_NOT_REFUSABLE",
        reason: "موقوف — المادة 79 مكرر: الاستقالة لا تُرفض ولا تُعاد. لك قبولها، أو تأجيل قبولها حتى 60 يوماً بإيضاح مسبب مكتوب قبل مضي 30 يوماً؛ وإلا تُعد مقبولة.",
        reasonEn: "Blocked — Article 79 bis: a resignation is not refused or returned. Accept it, or postpone acceptance up to 60 days with a written reason before 30 days pass; otherwise it is deemed accepted.",
      };
    }
    if (status === "withdrawn" && (actorIsSelfR || !extras.actorId)) {
      const w = checkWithdrawResignationGate(pending, new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date()));
      if (!w.ok) return w;
    }
  }
  if (status === "rejected") {
    const actorIsSelf = extras.actorId && String(extras.actorId) === String(employeeId);
    const grounded = checkGroundedRefusalGate({ ...pending, family: "other" }, { ground: extras.rejectGround, verified: extras.rejectVerified, actor: actorIsSelf ? "employee" : "manager" });
    if (!grounded.ok) return grounded;
  }
  if (status === "rejected" && pending?.type !== STUDY_CONSENT_TYPE && pending?.type !== NIGHT_FITNESS_TYPE && pending?.type !== "night_consent") {
    const named = checkRefuseRequestReasonGate(note);
    if (!named.ok) return named;
  }
  if (pending?.type === WRITTEN_CONSENT_TYPE) {
    return {
      ok: false,
      error: "WRITTEN_CONSENT_FLOW",
      reason: "الموافقة الخطية يختمها الموظف من طلباتي، ثم تظهر لك هنا.",
      reasonEn: "The worker seals written consent from My Requests, then it appears here.",
    };
  }
  if (hasOpenRequestSigning(pending) && status !== "withdrawn") {
    return {
      ok: false,
      error: "SIGN_FLOW",
      reason: "هذا الطلب يُوقَّع أو يُرفض من رابط التوقيع — موضع الختم حُدِّد عند الرفع.",
      reasonEn: "This request is signed or refused from the signing link — placement was set when it was raised.",
    };
  }
  if (pending?.type === "night_consent") {
    if (status === "revise" || status === "withdrawn") {
      return {
        ok: false,
        error: "NIGHT_FLOW",
        reason: "موافقة العمل الليلي تُقرّ من الملف ثم يعتمدها مدير القسم.",
        reasonEn: "Night-work consent is acknowledged on the file, then the department manager decides.",
      };
    }
    return decideNightRotate(companyId, employeeId, requestId, status, reviewerName, note);
  }
  if (isOvertimeAssignment(pending)) {
    if (status === "approved") {
      const gate = checkApproveOtAssignmentGate(pending);
      if (!gate.ok) return gate;
    } else if (status === "rejected" || status === "revise") {
      const rejectGate = checkManagerRejectOtGate(pending, status);
      if (!rejectGate.ok) return rejectGate;
    }
  }
  if (status === "approved") {
    const letterGate = checkApproveOtherRequestGate({
      ...pending,
      issuedFile: extras.issuedFile || pending?.issuedFile,
    });
    if (!letterGate.ok) return letterGate;
  }
  if (status === "approved" && pending?.type === LEAVE_TOPUP_TYPE && !pending.balanceApplied) {
    const grantGate = checkLeaveGrantGate({ pool: pending.leaveType || "grant", days: pending.days });
    if (!grantGate.ok) return grantGate;
  }
  if (status === "approved" && pending?.type === NIGHT_FITNESS_TYPE) {
    const probe = stampNightFitnessOnEmployee(
      { profile: { ...(emp?.profile || {}) } },
      { ...pending, fitnessApplied: false },
      {
        reviewedAt: new Date().toISOString(),
        from: pending.from,
        to: pending.to,
        issuedAt: pending.from || pending.examDate || toRiyadhDateKey(),
        until: pending.to || pending.until,
        permanent: pending.permanent,
      },
    );
    if (!probe.ok) return probe;
  }
  if (status === "approved" && (pending?.type === "manual_punch" || pending?.type === "checkout_fix")) {
    const day = pending.date || toRiyadhDateKey();
    const clock = parsePunchClock(pending.time) || clockFromPunchReason(pending.reason);
    const att = attendanceOnDate(data?.personalAttendance, employeeId, day);
    const punchGate = checkPunchRecordGate({
      type: pending.type,
      employee: emp,
      attendance: att,
      date: day,
      time: clock,
      reason: pending.reason,
      requireTime: true,
    });
    if (!punchGate.ok) return punchGate;
  }
  if (status === "approved" && pending?.type === "shift_change") {
    const stationId = pending.stationId || emp?.stationId;
    const schedule = (data?.schedules || []).find((row) => row.stationId === stationId);
    const gate = checkShiftChangeApplyGate({
      schedule,
      employee: emp,
      dateKey: pending.date,
      shiftTypeId: pending.shiftTypeId || null,
      laborCalendar: laborCalendarOf(data),
    });
    if (!gate.ok) return gate;
  }
  const refuseReason = status === "rejected" ? String(note || "").trim() : "";
  const decideVerb = status === "rejected" ? "refuse" : status === "approved" ? "approve" : status === "withdrawn" ? "withdraw" : status === "revise" ? "revise" : "";
  const decideLog = decideVerb
    ? (status === "rejected"
      ? stampRefuseAudit(companyId, emp, pending, { actor: reviewerName || auditActor, note: refuseReason, family: "other" })
      : stampRequestAudit(companyId, emp, pending, { actor: reviewerName || auditActor, note: String(note || "").trim(), family: "other", verb: decideVerb }))
    : null;
  if (!decideVerb) {
    audit(companyId, `other_request_${status}`, `Service request for ${empName} marked "${status}" by ${reviewerName || "manager"}.`);
  }
  updateCompany(companyId, (d) => {
    const employee = d.employees.find((e) => e.id === employeeId);
    if (!employee) return;
    const req = (employee.otherRequests || []).find((r) => r.id === requestId);
    if (!req) return;
    req.status = status;
    req.reviewedBy = reviewerName;
    req.reviewedAt = new Date().toISOString();
    if (String(note || "").trim()) req.reviewNote = String(note).trim();
    if (decideLog?.row) {
      req.auditTrail = status === "rejected"
        ? appendRequestRefuseAudit(req, decideLog.row)
        : appendRequestAudit(req, decideLog.row);
      // An approved file change writes its own line («اعتُمد طلب تعديل: …») with the value — not a second one.
      if (!(req.type === FILE_CORRECTION_TYPE && status === "approved")) pushEmployeeFileLog(employee, decideLog.log);
    }
    if (status === "rejected") {
      req.rejectReason = refuseReason || req.reviewNote || null;
      return;
    }
    if (status !== "approved") return;
    if (extras.issuedFile && (extras.issuedFile.name || extras.issuedFile.url)) {
      const stampedIssued = stampRequestFile(extras.issuedFile, req.reviewedAt);
      req.issuedFile = stampedIssued;
      if (req.type === STUDY_CONSENT_TYPE) {
        req.approvalFile = stampedIssued;
      } else {
        req.senderFile = stampedIssued;
      }
    }
    if (["salary_letter", "employment_letter", "document"].includes(req.type) && !req.verifyId) {
      req.verifyId = consentVerifyRef();
      req.issued = true;
    }
    if (req.type === "night_consent") {
      employee.profile = {
        ...(employee.profile || {}),
        nightConsentAt: new Date().toISOString(),
        nightConsentWithdrawnAt: undefined,
      };
    }
    if (req.type === STUDY_CONSENT_TYPE) {
      req.companyId = req.companyId || companyId;
      req.approvedAt = req.reviewedAt;
      req.approvedBy = reviewerName;
    }
    if (req.type === NIGHT_FITNESS_TYPE) {
      req.companyId = req.companyId || companyId;
      req.approvedAt = req.reviewedAt;
      req.approvedBy = reviewerName;
      const applied = stampNightFitnessOnEmployee(employee, req, {
        reviewedAt: req.reviewedAt,
        from: req.from,
        to: req.to,
        issuedAt: req.from || req.examDate || toRiyadhDateKey(req.reviewedAt),
        until: req.to || req.until,
        permanent: req.permanent,
      });
      if (!applied.ok) return;
    }
    if (req.type === LEAVE_TOPUP_TYPE) {
      stampLeaveTopupOnEmployee(employee, req);
    }
    if (isOvertimeAssignment(req)) {
      if (status === "revise") {
        req.status = OT_STATUS.pending_employee;
        req.compensation = undefined;
        req.compensationChoice = undefined;
        req.employeeAck = false;
        return;
      }
      if (status === "approved") {
        stampOvertimeCreditOnEmployee(employee, req);
        stampOvertimePayOnDraft(d, employee.id, req, reviewerName);
        // Regs Art. 22 bis: hours this leave already compensates leave an open punch decision.
        absorbAssignmentIntoActualOt(d, employee.id, req);
      }
    }
    if (req.type === "manual_punch" || req.type === "checkout_fix") {
      stampPunchRequestOnDraft(d, employee, req, reviewerName);
    }
    if (req.type === "shift_change" && req.date) {
      const stationId = req.stationId || employee.stationId;
      if (stationId) applyEmployeeDayShift(getOrCreateSchedule(d, stationId), req.date, employee.id, req.shiftTypeId || null);
    }
    if (status === "approved") applyDutyRequestOnDraft(d, employee, req);
    if (status === "withdrawn" && req.type === ART81_EXIT_TYPE && employee.profile?.contractExit?.art81RequestId === req.id) {
      // Withdrawn by mistake: the file goes back to how it was before the notice.
      const prev = req.previousContractExit;
      const profile = { ...(employee.profile || {}) };
      if (prev) profile.contractExit = prev; else delete profile.contractExit;
      employee.profile = profile;
    }
    if (status === "approved" && req.type === LEAVE_CARRY_TYPE) {
      // Art. 110(1): the employer agreed — the days may be taken in the next year.
      const now = new Date().toISOString();
      employee.profile = {
        ...(employee.profile || {}),
        leaveCarryAgreed: [...(employee.profile?.leaveCarryAgreed || []), { requestId: req.id, days: Number(req.days) || 0, at: now, fromYearStart: anniversaryYearWindow(employee.profile?.hireDate, String(req.createdAt || now).slice(0, 10))?.start || undefined }],
      };
    }
    if (status === "approved" && req.type === NIGHT_AVOID_TYPE) {
      // Decision 18632 (ثالثاً ج): off night work for the certificate's period; the roster blocks night assignment.
      employee.profile = { ...(employee.profile || {}), nightAvoid: { kind: req.nightAvoidKind, from: req.avoidFrom, until: req.avoidUntil || "", requestId: req.id } };
    }
    if (status === "approved" && req.type === DOCUMENTS_RETURN_TYPE) {
      req.documentsReturnedAt = new Date().toISOString();
    }
    if (status === "approved" && req.type === DAMAGE_OBJECTION_TYPE) {
      req.objectionAccepted = true;
    }
    if (status === "approved" && req.type === "resignation" && req.exitRoute === EXIT_ROUTE_NOTICE75) {
      // Art. 75 — the notice is acknowledged; the open-ended contract ends when the notice runs out.
      const exit = employee.profile?.contractExit || {};
      employee.profile = {
        ...(employee.profile || {}),
        contractExit: { ...exit, reason: "resignation", route: EXIT_ROUTE_NOTICE75, party: "worker", noticeAt: req.date || "", resignationSubmittedAt: req.date || "", effectiveDate: req.lastDay || "", status: "notice" },
      };
    } else if (status === "approved" && req.type === "resignation") {
      // Art. 79 bis — accepted: the file's contract-exit record carries the resignation.
      const exit = employee.profile?.contractExit || {};
      employee.profile = {
        ...(employee.profile || {}),
        contractExit: {
          ...exit,
          reason: "resignation",
          party: "worker",
          resignationSubmittedAt: req.date || exit.resignationSubmittedAt || "",
          // Art. 79 bis(2): the contract ends from the date the employer accepts.
          effectiveDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date()),
          status: "accepted",
          acceptedAt: new Date().toISOString().slice(0, 10),
        },
      };
    }
  });
  if (status === "approved" && pending?.type === FILE_CORRECTION_TYPE) {
    const actorUser = extras.actor || (data?.employees || []).find((row) => String(row.id) === String(extras.actorId)) || null;
    const summary = fileCorrectionSummary(pending, true);
    const written = patchEmployeeFile(companyId, employeeId, {
      actor: actorUser,
      ...fileCorrectionPatch(pending),
      log: {
        text: `اعتُمد طلب تعديل: ${summary}`,
        by: reviewerName || actorUser?.name || "",
        at: new Date().toISOString().slice(0, 16).replace("T", " "),
        dot: "#3C7D50",
      },
    });
    if (written && written.ok === false) return written;
    addNotification(companyId, employeeId, `اعتُمد طلب تعديل ملفك الوظيفي — ${summary}.`, { to: "/app/requests" });
  }
  if (status === "approved" && ["salary_letter", "employment_letter", "document"].includes(pending?.type)) {
    const title = pending.title || otherRequestTypeLabel(pending.type, true);
    addNotification(companyId, employeeId, `صدرت وثيقتك: ${title}. النسخة في ملفات طلباتي.`);
  }
  if (isOvertimeAssignment(pending) && (status === "approved" || status === "rejected")) {
    const offer = otOffer({ employee: emp, hours: pending.hours, date: pending.date, exceptId: pending.id });
    const comp = pending.compensation || pending.compensationChoice;
    addNotification(companyId, employeeId, status === "approved"
      ? (comp === "credit"
        ? `اعتُمد تكليفك الإضافي: أُضيفت إجازة تعويضية ${otHoursAr(offer.leave.hours)} إلى رصيدك${pending.enjoyDate ? ` — تمتع بها حتى ${regulationDate(pending.enjoyDate)}` : ""}.`
        : `اعتُمد تكليفك الإضافي: ${offer.known ? otSar(offer.pay.total) : "أجر الساعات"} يُضاف إلى مسير الشهر.`)
      : "رُدّ تكليف الساعات الإضافية — السبب في طلباتي.", { to: "/app/requests" });
  }
  flushOtPendingNotices(companyId);
  if (pending?.type === DAMAGE_OBJECTION_TYPE && (status === "approved" || status === "rejected")) {
    addNotification(companyId, employeeId, status === "approved"
      ? `قُبل اعتراضك على خصم الإتلاف (${pending.amount} ر.س) — يُرد إليك ما اقتُطع في المسير.`
      : `لم يُقبل اعتراضك على خصم الإتلاف — لك التظلم أمام المحكمة العمالية خلال خمسة عشر يوم عمل من إبلاغك (حتى ${regulationDate(pending.objectionLastDay)})، وإن حكمت لك يُرد المبلغ خلال سبعة أيام (المادة 91).`, { to: "/app/discipline?tab=mine" });
  }
  if (pending?.type === GRIEVANCE_TYPE && (status === "approved" || status === "rejected")) {
    const fresh = (getCompanyData(companyId)?.employees || []).find((row) => row.id === employeeId);
    const row = (fresh?.otherRequests || []).find((r) => r.id === requestId) || pending;
    const st = grievanceState(row, undefined, officialHolidayTest(getCompanyData(companyId)));
    addNotification(companyId, employeeId, status === "approved"
      ? "قُبل تظلمك — النتيجة مكتوبة في طلباتي (النموذج الموحد م71)."
      : `رُفض تظلمك${String(note || "").trim() ? ` — ${String(note).trim()}` : ""}. لك الاعتراض أمام المحكمة العمالية خلال ثلاثين يوماً عدا العطل الرسمية (حتى ${regulationDate(st?.courtBy)}) (النموذج الموحد م71).`, { to: "/app/requests" });
  }
  if (pending?.type === NIGHT_AVOID_TYPE && status === "approved") {
    addNotification(companyId, employeeId, `اعتُمدت شهادتك بتجنب العمل الليلي${pending.avoidUntil ? ` حتى ${regulationDate(pending.avoidUntil)}` : ""} — لا تُسند للعمل الليلي، وتُنقل إلى عمل مماثل في الساعات المعتادة؛ وإن تعذر تُقلَّص ساعاتك إلى ست مع حفظ أجرك ومزاياك (القرار 18632).`, { to: "/app/requests" });
    notifyRequestManagers(companyId, employeeId, `اعتُمد تجنب ${emp?.name || "موظف"} للعمل الليلي — انقله إلى وظيفة مماثلة في الساعات المعتادة، وإن تعذر فقلّص ساعاته إلى ست شاملة مع حفظ الأجر والإعانات والمزايا (القرار 18632 ثالثاً ج). الجدول يمنع إسناده ليلاً.`);
  }
  if (pending?.type === DOCUMENTS_RETURN_TYPE && status === "approved") {
    addNotification(companyId, employeeId, "سُلّمت إليك وثائقك المودعة (المادة 64).", { to: "/app/requests" });
  }
  if (pending?.type === LEAVE_CARRY_TYPE && status === "approved") {
    addNotification(companyId, employeeId, `وافقت الإدارة على تأجيل ${daysAr(pending.days)} من إجازتك السنوية إلى السنة التالية (المادة 110).`, { to: "/app/requests" });
  }
  if (status === "approved" && pending?.type === STUDY_CONSENT_TYPE) {
    addNotification(companyId, employeeId, "اعتُمدت موافقتك الدراسية. ملف الموافقة في طلباتي.");
  }
  if (status === "approved" && pending?.type === NIGHT_FITNESS_TYPE) {
    addNotification(companyId, employeeId, "اعتُمد تقرير لياقتك الليلية. الملف المسجّل في طلباتي.");
  }
  if (status === "approved" && (pending?.type === "manual_punch" || pending?.type === "checkout_fix")) {
    const fresh = (getCompanyData(companyId)?.employees || []).find((row) => row.id === employeeId);
    const row = (fresh?.otherRequests || []).find((r) => r.id === requestId) || pending;
    const clock = parsePunchClock(row.time) || clockFromPunchReason(row.reason);
    addNotification(companyId, employeeId, pending.type === "checkout_fix"
      ? `اعتُمد تصحيح انصرافك ليوم ${row.date || ""} الساعة ${clock || "—"}${row.requestedTime && row.requestedTime !== clock ? ` (طلبت ${row.requestedTime})` : ""}.`
      : `اعتُمدت بصمتك اليدوية ليوم ${row.date || ""} الساعة ${clock || "—"}${row.requestedTime && row.requestedTime !== clock ? ` (طلبت ${row.requestedTime})` : ""}.`, { to: "/app/attendance" });
  }
  if (status === "approved" && isDutyRequestType(pending?.type)) {
    const copy = {
      permission: "اعتُمد استئذانك — لا يُحتسب تأخيراً ولا خروجاً مبكراً في التقويم التشغيلي.",
      shift_change: "اعتُمد تغيير ورديتك — الجدول محدَّث.",
      nursing_hour: "اعتُمدت ساعة الرضاعة (المادة 154) — تُحسب من ساعات العمل الفعلية.",
      pregnancy_notice: "سُجّل إبلاغ الحمل — لا عمل ليلي قبل الوضع بـ24 أسبوعاً (القرار 18632).",
      family_duties: "اعتُمد إبلاغك بالمسؤوليات العائلية — يُراعى عند إسنادك للعمل الليلي (القرار 18632).",
      heat_report: "استُلم بلاغك عن العمل المكشوف — سُجّل يومك «مظلّل» في الجدول (القرار 3337).",
    }[pending.type];
    if (copy) addNotification(companyId, employeeId, copy);
  }
  if ((status === "rejected" || status === "revise") && pending && !isOvertimeAssignment(pending) && pending.type !== WRITTEN_CONSENT_TYPE && !(status === "rejected" && (pending.type === DAMAGE_OBJECTION_TYPE || pending.type === GRIEVANCE_TYPE))) {
    const title = pending.title || otherRequestTypeLabel(pending.type, true);
    const why = String(note || "").trim();
    addNotification(companyId, employeeId, status === "rejected"
      ? `رُفض طلبك: ${title}${why ? ` — السبب: ${why}` : ""}.${refusalGroundsFor({ ...pending, family: "other" })?.length ? ` ${refusalWorkerLine({ ...pending, family: "other" }, true)}` : ""}`
      : `طلبك يحتاج تعديلاً: ${title}${why ? ` — ${why}` : ""}.`, { to: "/app/requests" });
  }
  if (status === "rejected") {
    invokeWorkforce({ action: "rejectOther", companyId, employeeId, requestId, reason: refuseReason, note: refuseReason, rejectGround: extras.rejectGround, rejectVerified: extras.rejectVerified === true });
  }
  if (status === "approved" && pending && [RESIGNATION_TYPE, NIGHT_AVOID_TYPE, LEAVE_CARRY_TYPE, DAMAGE_OBJECTION_TYPE, DOCUMENTS_RETURN_TYPE, ART81_EXIT_TYPE].includes(pending.type)) {
    // These approvals carry effects the backend applies too (contract exit, night block, carry record).
    invokeWorkforce({ action: "approveOther", companyId, employeeId, requestId });
  }
  if (status === "withdrawn" && pending && [RESIGNATION_TYPE, ART81_EXIT_TYPE].includes(pending.type)) {
    invokeWorkforce({ action: "withdrawOther", companyId, employeeId, requestId });
  }
  return { ok: true };
}

/** Approval effects of «طلبات الدوام» on the company draft (dutyRequests.js). */
function applyDutyRequestOnDraft(d, employee, req) {
  if (!employee || !req) return;
  if (req.type === "pregnancy_notice" && req.dueDate) {
    employee.profile = { ...(employee.profile || {}), pregnant: true, expectedBirthDate: String(req.dueDate).slice(0, 10) };
  }
  if (req.type === "nursing_hour") {
    employee.profile = {
      ...(employee.profile || {}),
      nursingHour: { placement: req.placement === "end" ? "end" : "start", nursingSplit: req.nursingSplit || undefined, childBirthDate: req.childBirthDate || undefined, from: req.date || "", until: req.until || "" },
    };
  }
  if (req.type === "family_duties") {
    employee.profile = {
      ...(employee.profile || {}),
      familyResponsibilities: true,
      familyResponsibilitiesSince: String(req.date || "").slice(0, 10),
      familyResponsibilitiesRequestId: req.id || "",
    };
  }
  if (req.type === "heat_report" && req.date) {
    const stationId = req.stationId || employee.stationId;
    if (stationId) {
      const schedule = getOrCreateSchedule(d, stationId);
      schedule.sunExposure = schedule.sunExposure || {};
      schedule.sunExposure[req.date] = { ...(schedule.sunExposure[req.date] || {}), [employee.id]: "office" };
    }
  }
}

/**
 * Art. 139 — a written management finding that the injury was self-inflicted, from deliberate
 * misconduct, or that treatment was refused without a lawful reason. The leave's days then carry
 * no Art. 137 compensation. Clearing it (ground "") restores the compensation.
 */
export function setWorkInjuryArt139(companyId, employeeId, requestId, { ground = "", reason = "", by = "" } = {}) {
  const why = String(reason || "").trim();
  if (ground && !why) return { ok: false, error: "REASON_REQUIRED", reason: "اكتب سبب سقوط الحق (المادة 139).", reasonEn: "Write why the right falls (Art. 139)." };
  let hit = false;
  updateCompany(companyId, (d) => {
    const emp = (d.employees || []).find((e) => e.id === employeeId);
    const row = (emp?.leaveRequests || []).find((r) => r.id === requestId);
    if (!emp || !row || String(row.type || "").toLowerCase() !== "work_injury") return;
    hit = true;
    row.art139 = ground || "";
    row.art139Reason = ground ? why : "";
    row.art139By = ground ? by : "";
    row.art139At = ground ? new Date().toISOString() : "";
    emp.fileLog = [{
      text: ground ? `إصابة عمل — سقوط الحق (المادة 139): ${why}` : "إصابة عمل — أُلغي سقوط الحق (المادة 139)",
      by,
      at: new Date().toISOString().slice(0, 16).replace("T", " "),
      dot: ground ? "#8A1C2B" : "#3C7D50",
    }, ...(emp.fileLog || [])].slice(0, 40);
  });
  if (hit && ground) {
    addNotification(companyId, employeeId, `قررت الإدارة سقوط حقك في معونة إصابة العمل (المادة 139): ${why}. لك الاعتراض أمام الجهة المختصة.`);
  }
  return hit ? { ok: true } : { ok: false, error: "NOT_FOUND" };
}

/** GOSI: days the injured worker was in hospital at GOSI's expense (the allowance is 75% on them). */
export function setWorkInjuryHospitalDays(companyId, employeeId, requestId, days, by = "") {
  const n = Math.max(0, Math.round(Number(days) || 0));
  let hit = false;
  updateCompany(companyId, (d) => {
    const emp = (d.employees || []).find((e) => e.id === employeeId);
    const row = (emp?.leaveRequests || []).find((r) => r.id === requestId);
    if (!row || String(row.type || "").toLowerCase() !== "work_injury") return;
    hit = true;
    row.hospitalDays = n;
    emp.fileLog = [{ text: `إصابة عمل — أيام التنويم على نفقة التأمينات: ${n}`, by, at: new Date().toISOString().slice(0, 16).replace("T", " "), dot: "#3C7D50" }, ...(emp.fileLog || [])].slice(0, 40);
  });
  return hit ? { ok: true } : { ok: false, error: "NOT_FOUND" };
}

/**
 * The permanent outcome of an injury, from the medical committee: total, partial (with its rate) or death.
 * Optionally ends the contract (Art. 79: the worker's death or inability to work on a medical certificate).
 */
export function setWorkInjuryOutcome(companyId, employeeId, requestId, { kind = "", percent = 0, needsCare = false, figure = null, endContract = false, by = "" } = {}) {
  let hit = false;
  const today = new Date().toISOString().slice(0, 10);
  updateCompany(companyId, (d) => {
    const emp = (d.employees || []).find((e) => e.id === employeeId);
    const row = (emp?.leaveRequests || []).find((r) => r.id === requestId);
    if (!emp || !row || String(row.type || "").toLowerCase() !== "work_injury") return;
    hit = true;
    row.outcome = kind ? { kind, percent: Number(percent) || 0, needsCare: !!needsCare, figure, at: today, by } : null;
    const label = { total: "عجز دائم كلي", partial: `عجز دائم جزئي ${Number(percent) || 0}٪`, death: "وفاة" }[kind] || "أُلغيت النتيجة";
    emp.fileLog = [{ text: `إصابة عمل — النتيجة: ${label}`, by, at: new Date().toISOString().slice(0, 16).replace("T", " "), dot: kind ? "#8A1C2B" : "#3C7D50" }, ...(emp.fileLog || [])].slice(0, 40);
    if (endContract && (kind === "total" || kind === "death")) {
      emp.profile = {
        ...(emp.profile || {}),
        contractExit: { ...(emp.profile?.contractExit || {}), reason: kind === "death" ? "death" : "disability", article: "79", effectiveDate: today, recordedBy: by, source: "work_injury", requestId },
      };
      emp.fileLog = [{ text: `إنهاء العقد — ${kind === "death" ? "وفاة العامل" : "عجز عن أداء العمل بشهادة طبية"} (المادة 79)`, by, at: new Date().toISOString().slice(0, 16).replace("T", " "), dot: "#8A1C2B" }, ...(emp.fileLog || [])].slice(0, 40);
    }
  });
  return hit ? { ok: true } : { ok: false, error: "NOT_FOUND" };
}

/**
 * متابعة التأمينات — record that a GOSI action was done in «تأميناتي أعمال» (the platform is not
 * connected to GOSI; this keeps the date and the GOSI reference as proof).
 */
export function recordGosiAction(companyId, { kind, employeeId, injuryDate = "", month = "", at = "", ref = "", by = "", wage = null, incidentId = "" } = {}) {
  const day = String(at || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const reference = String(ref || "").trim();
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  let hit = false;
  updateCompany(companyId, (d) => {
    if (kind === "payment") {
      if (!month) return;
      d.gosiPayments = { ...(d.gosiPayments || {}), [month]: { at: day, ref: reference, by } };
      hit = true;
      return;
    }
    // An injury from a safety card (Art. 141): the proof sits on the card as well as any injury leave.
    if (incidentId && (kind === "injury" || kind === "injury_office")) {
      for (const rec of d.safety || []) {
        const item = (rec.incidentLog || []).find((row) => row.id === incidentId);
        if (!item) continue;
        if (kind === "injury") { item.gosiReportedAt = day; item.gosiRef = reference; } else { item.labourOfficeReportedAt = day; item.labourOfficeRef = reference; }
        hit = true;
      }
    }
    const emp = (d.employees || []).find((e) => e.id === employeeId);
    if (!emp) return;
    hit = true;
    const acts = { ...(emp.profile?.gosiActions || {}) };
    const label = { register: "سُجّل في التأمينات", exclude: "استُبعد من التأمينات", wage: "حُدّث أجره في التأمينات", injury: "أُبلغت التأمينات بإصابة العمل", injury_office: "أُبلغ مكتب العمل بإصابة العمل (اللائحة م28)" }[kind] || "إجراء تأمينات";
    if (kind === "injury_office") {
      for (const row of emp.leaveRequests || []) {
        if (String(row.type || "").toLowerCase() !== "work_injury") continue;
        const injured = String(row.injuryDate || row.eventDate || row.startDate || "").slice(0, 10);
        if (injured !== injuryDate) continue;
        row.labourOfficeReportedAt = day;
        row.labourOfficeRef = reference;
      }
    } else if (kind === "injury") {
      for (const row of emp.leaveRequests || []) {
        if (String(row.type || "").toLowerCase() !== "work_injury") continue;
        const injured = String(row.injuryDate || row.eventDate || row.startDate || "").slice(0, 10);
        if (injured !== injuryDate) continue;
        row.gosiReportedAt = day;
        row.gosiRef = reference;
        row.gosiStatus = row.gosiStatus || "pending";
      }
    } else {
      acts[kind] = { at: day, ref: reference, by };
      // Registration and a wage update set the wage GOSI now holds — the next change is measured from it.
      if ((kind === "register" || kind === "wage") && wage != null) acts.wage = { wage: Number(wage) || 0, at: day, ref: reference, by };
      emp.profile = { ...(emp.profile || {}), gosiActions: acts };
    }
    emp.fileLog = [{ text: `${label}${reference ? ` — مرجع ${reference}` : ""} · ${day}`, by, at: stamp, dot: "#3C7D50" }, ...(emp.fileLog || [])].slice(0, 40);
  });
  return hit ? { ok: true } : { ok: false, error: "NOT_FOUND" };
}

/**
 * GOSI's answer on a reported injury. «rejected» means it is not a work injury: its days become
 * ordinary sick leave under Art. 117 (30 full, 60 at three-quarters, 30 unpaid), counted in the sick balance.
 */
export function setInjuryGosiStatus(companyId, employeeId, injuryDate, status, { by = "", note = "" } = {}) {
  if (!["pending", "approved", "rejected"].includes(status)) return { ok: false, error: "STATUS" };
  let n = 0;
  updateCompany(companyId, (d) => {
    const emp = (d.employees || []).find((e) => e.id === employeeId);
    if (!emp) return;
    for (const row of emp.leaveRequests || []) {
      const type = String(row.type || "").toLowerCase();
      const injured = String(row.injuryDate || row.eventDate || row.startDate || "").slice(0, 10);
      const fromInjury = type === "work_injury" || row.originalType === "work_injury";
      if (!fromInjury || injured !== injuryDate) continue;
      n += 1;
      row.gosiStatus = status;
      row.gosiDecidedAt = new Date().toISOString().slice(0, 10);
      if (status === "rejected" && type === "work_injury") {
        row.originalType = "work_injury";
        row.type = "sick";
        row.injuryDate = injured;
        row.conversionNote = note || "رفضت التأمينات إصابة العمل — حُوِّلت إلى إجازة مرضية (المادة 117).";
      }
      if (status !== "rejected" && row.originalType === "work_injury" && type === "sick") {
        row.type = "work_injury";
        delete row.conversionNote;
      }
    }
    if (n) {
      const label = status === "rejected" ? "رفضت التأمينات إصابة العمل — حُوِّلت أيامها إلى إجازة مرضية (المادة 117)" : status === "approved" ? "اعتمدت التأمينات إصابة العمل" : "إصابة العمل بانتظار قرار التأمينات";
      emp.fileLog = [{ text: `${label} · ${injuryDate}`, by, at: new Date().toISOString().slice(0, 16).replace("T", " "), dot: status === "rejected" ? "#8A1C2B" : "#3C7D50" }, ...(emp.fileLog || [])].slice(0, 40);
    }
  });
  return n ? { ok: true, rows: n } : { ok: false, error: "NOT_FOUND" };
}

/** A recorded grant on one leave balance — any whole number of days, no cap; never annual (Art. 109). */
export function grantDiscretionaryDays(companyId, employeeId, { days, reason, by, pool = "grant" }) {
  const why = String(reason || "").trim();
  if (!why) {
    return { ok: false, error: "REASON_REQUIRED", reason: "اكتب سبب المنح.", reasonEn: "Write why the days are granted." };
  }
  const gate = checkLeaveGrantGate({ pool, days });
  if (!gate.ok) return gate;
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((e) => e.id === employeeId);
  if (!emp) {
    return { ok: false, error: "EMPLOYEE_REQUIRED", reason: "الموظف غير موجود.", reasonEn: "Employee was not found." };
  }
  updateCompany(companyId, (d) => {
    const employee = d.employees.find((e) => e.id === employeeId);
    if (!employee) return;
    employee.profile = employee.profile || {};
    employee.profile.discretionaryGrants = [
      leaveGrantRecord({ pool: gate.pool, days: gate.days, reason: why, by }),
      ...(employee.profile.discretionaryGrants || []),
    ];
  });
  audit(companyId, "discretionary_leave_grant", `${gate.days} ${gate.pool} days for ${emp.name}${why ? ` — ${why}` : ""}`);
  return { ok: true, days: gate.days, pool: gate.pool };
}

/**
 * إدارة → إضافة رصيد: a recorded grant on a grantable balance, without the employee raising leave.
 * Annual is refused by the gate — its entitlement is fixed by the Labour Law.
 */
export function creditEmployeeLeaveBalance(companyId, employeeId, { pool, days, reason, by, canCredit = true } = {}) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((e) => e.id === employeeId);
  if (!emp) {
    return { ok: false, error: "EMPLOYEE_REQUIRED", reason: "الموظف غير موجود.", reasonEn: "Employee was not found." };
  }
  const gate = checkAdminLeaveCreditGate({ pool, days, reason, profile: emp.profile, canCredit });
  if (!gate.ok) return gate;
  const actor = String(by || "").trim();
  const granted = grantDiscretionaryDays(companyId, employeeId, { days: gate.days, reason: gate.reason, by: actor, pool: gate.pool });
  if (!granted.ok) return granted;
  const label = leaveTypeLabel(gate.pool === "grant" ? "grant" : gate.pool, true);
  addNotification(companyId, employeeId, `أُضيف ${granted.days} ${granted.days > 10 || granted.days < 3 ? "يوماً" : "أيام"} إلى رصيدك (${gate.pool === "grant" ? "رصيد ممنوح" : label})${gate.reason ? ` — ${gate.reason}` : ""}.`, { to: "/app/requests" });
  audit(companyId, "leave_balance_credit", `${granted.days} ${gate.pool} days for ${emp.name} by ${actor}${gate.reason ? ` — ${gate.reason}` : ""}`);
  return { ok: true, pool: gate.pool, days: granted.days };
}

export function addPoints(companyId, employeeId, points, reason) {
  const empName = getCompanyData(companyId)?.employees.find((e) => e.id === employeeId)?.name || "";
  audit(companyId, "points_adjusted", `${Number(points) >= 0 ? "+" : ""}${points} points for ${empName}${reason ? ` — ${reason}` : ""}`);
  updateCompany(companyId, (d) => {
    const emp = d.employees.find((e) => e.id === employeeId);
    if (!emp) return;
    emp.points = (emp.points || 0) + Number(points);
    d.notifications.unshift({
      id: uid("ntf"),
      userId: employeeId,
      text: `🏆 +${points} ${reason || ""}`.trim(),
      read: false,
      createdAt: new Date().toISOString(),
    });
  });
}

// Points are awarded server-side (task approval writes a PointsLedger entry and updates
// the Employee record). The local cache is what the UI reads, so it must be refreshed
// from the server after an award — otherwise the local copy keeps the old total and
// even pushes it back, erasing the award.
export async function syncPointsFromCloud(companyId) {
  const remote = await hydrateEmployeesFromEntity(companyId);
  if (!remote) return false;
  const points = new Map(remote.map((employee) => [employee.id, Number(employee.points) || 0]));
  updateCompany(companyId, (d) => {
    d.employees.forEach((employee) => {
      if (points.has(employee.id)) employee.points = points.get(employee.id);
    });
  });
  return true;
}

export function listArbitrationOutcomes(companyId, opts = {}) {
  const data = getCompanyData(companyId) || {};
  return visibleArbitrationOutcomes(data.arbitrationOutcomes || [], opts);
}

/* ----------------------------- anonymous rate limit ----------------------------- */
export function getAnonUsage(companyId, employeeId, legacyAnonymousId) {
  const data = getCompanyData(companyId) || {};
  const now = Date.now();
  const rows = data.anonymousReports || [];
  const mine = (r) => (
    (r.rateActorId && r.rateActorId === employeeId)
    || (r.authorId && r.authorId === employeeId)
    || (!r.rateActorId && !r.authorId && r.anonymousId === legacyAnonymousId)
  );
  const day = rows.filter((r) => mine(r) && now - new Date(r.createdAt).getTime() < 86400000).length;
  const week = rows.filter((r) => mine(r) && now - new Date(r.createdAt).getTime() < 86400000 * 7).length;
  const month = rows.filter((r) => mine(r) && now - new Date(r.createdAt).getTime() < 86400000 * 30).length;
  return {
    day, week, month,
    dayLimit: data.settings?.rateLimitDaily,
    weekLimit: data.settings?.rateLimitWeekly,
    monthLimit: data.settings?.rateLimitMonthly ?? 30,
  };
}

// Director-only: configure how many anonymous complaints an employee may file per day/week/month.
export function setAnonRateLimits(companyId, { daily, weekly, monthly } = {}) {
  audit(companyId, "anon_rate_limits_changed", `Anonymous report limits changed (daily: ${daily}, weekly: ${weekly}, monthly: ${monthly}).`);
  updateCompany(companyId, (d) => {
    d.settings = d.settings || {};
    if (daily != null) d.settings.rateLimitDaily = Number(daily);
    if (weekly != null) d.settings.rateLimitWeekly = Number(weekly);
    if (monthly != null) d.settings.rateLimitMonthly = Number(monthly);
  });
}

/* ----------------------------- station work schedules (shift-type grid) -----------------------------
   Each station has a fixed set of shift types (e.g. Morning/Evening/Night) with editable
   names & time ranges, shared across every day of the week. `assignments[weekday][shiftTypeId]`
   holds the list of employeeIds working that shift on that day. weekday: 0 = Sunday ... 6 = Saturday */
function defaultShiftTypes() {
  return [{ id: uid("sft"), label: "صباحي", start: "07:00", end: "15:00" }];
}

function getOrCreateSchedule(d, stationId) {
  d.schedules = d.schedules || [];
  let entry = d.schedules.find((s) => s.stationId === stationId);
  if (!entry) {
    entry = { id: uid("sch"), stationId, shiftTypes: defaultShiftTypes(), assignments: {} };
    d.schedules.push(entry);
  }
  if (!entry.shiftTypes || entry.shiftTypes.length === 0) entry.shiftTypes = defaultShiftTypes();
  entry.assignments = entry.assignments || {};
  return entry;
}

function applyShiftMerge(entry, { dropIds, keepByDrop }) {
  if (!dropIds.length) return 0;
  for (const dayObj of Object.values(entry.assignments || {})) {
    for (const dropId of dropIds) {
      const keepId = keepByDrop[dropId];
      const extraIds = dayObj[dropId] || [];
      if (extraIds.length && keepId) {
        dayObj[keepId] = [...new Set([...(dayObj[keepId] || []), ...extraIds])];
      }
      delete dayObj[dropId];
    }
  }
  entry.shiftTypes = entry.shiftTypes.filter((shift) => !dropIds.includes(shift.id));
  return dropIds.length;
}

export function mergeDuplicateShiftTypes(companyId, stationId) {
  const current = getCompanyData(companyId);
  const existing = (current?.schedules || []).find((row) => row.stationId === stationId);
  const plan = planDuplicateShiftMerge(existing?.shiftTypes || []);
  if (!plan.dropIds.length) return 0;
  let removed = 0;
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    removed = applyShiftMerge(entry, planDuplicateShiftMerge(entry.shiftTypes));
  });
  return removed;
}

export function addShiftType(companyId, stationId, shiftType) {
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    const window = shiftWindowKey(shiftType.start, shiftType.end);
    if (entry.shiftTypes.some((shift) => shiftWindowKey(shift.start, shift.end) === window)) return;
    entry.shiftTypes.push({
      id: uid("sft"),
      label: shiftType.label,
      start: shiftType.start,
      end: shiftType.end,
      restMinutes: shiftType.restMinutes ?? ruleValue("hours.rest.duringShiftMinutes"),
      ...(shiftType.outdoor === true ? { outdoor: true } : shiftType.outdoor === false ? { outdoor: false } : {}),
    });
    // More than 8 hours → a one-hour rest the worker places himself in بصمتي.
    const added = entry.shiftTypes[entry.shiftTypes.length - 1];
    const patch = longShiftRestPatch(added);
    if (patch) Object.assign(added, patch);
  });
}

export function setScheduleNightCompensation(companyId, stationId, on) {
  let workers = [];
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    const was = !!entry.nightCompensation;
    entry.nightCompensation = !!on;
    markWeekDirty(entry, new Date());
    // Who works nights on this roster this week hears that the branch's night compensation changed.
    if (was !== !!on) {
      const start = weekStartDate(new Date());
      workers = (d.employees || []).filter((employee) => weekDateKeys(start).some((key) => isNightWorker(employeeShiftOnDay(entry, employee.id, key), key)));
    }
  });
  for (const employee of workers) {
    addNotification(
      companyId,
      employee.id,
      on
        ? "سُجّل تعويض العمل الليلي على جدول فرعك — القرار 18632."
        : "أُلغي تعويض العمل الليلي المسجّل على جدول فرعك — القرار 18632.",
      { to: "/app/shifts" },
    );
  }
}

export function setNightFacilityFlag(companyId, { stationId, key, on, scope = "schedule" } = {}) {
  const allowed = {
    nightFirstAidReady: true,
    nightEmergencyTransferReady: true,
    nightFoodAccessReady: true,
    nightTrainingParity: true,
    nightGuidePublished: true,
  };
  if (!allowed[key]) return;
  updateCompany(companyId, (d) => {
    if (scope === "company") {
      d.nightFacilities = { ...(d.nightFacilities || {}), [key]: !!on };
      return;
    }
    const entry = getOrCreateSchedule(d, stationId);
    entry[key] = !!on;
    if (!on && entry.nightDutyProof?.[key]) {
      const { [key]: _drop, ...rest } = entry.nightDutyProof;
      entry.nightDutyProof = rest;
    }
    markWeekDirty(entry, new Date());
  });
}

/**
 * 18632 employer obligation — proven, not ticked. Sets the same flag the publish gate reads
 * (station roster by default, company.nightFacilities with scope "company") and keeps the proof
 * beside it in `nightDutyProof[key]` with who/when. The procedures guide (و) is also published
 * to the company files so workers can open it.
 */
export function proveNightObligation(companyId, { stationId, key, proof = {}, by, byName, scope = "schedule", at } = {}) {
  const allowed = new Set(["nightFirstAidReady", "nightEmergencyTransferReady", "nightFoodAccessReady", "nightTrainingParity", "nightGuidePublished"]);
  if (!allowed.has(key)) return;
  const stamp = at || new Date().toISOString();
  updateCompany(companyId, (d) => {
    const record = { ...proof, by: by || null, byName: byName || "", at: stamp };
    if (key === "nightGuidePublished" && proof?.file?.url) {
      d.files = d.files || [];
      const fileId = uid("file");
      d.files.push({ id: fileId, type: "file", name: proof.file.name || "دليل إجراءات العمل الليلي", parentId: null, url: proof.file.url, mimeType: proof.file.mimeType || "", uploadedBy: by || null, stationId: stationId || null, createdAt: stamp, nightGuide: true });
      record.companyFileId = fileId;
    }
    const target = scope === "company"
      ? (d.nightFacilities = { ...(d.nightFacilities || {}) })
      : getOrCreateSchedule(d, stationId);
    target[key] = true;
    target.nightDutyProof = { ...(target.nightDutyProof || {}), [key]: record };
  });
}

/**
 * The worker's own rest plan for one day on a flex shift (he chooses where his break sits).
 * parts: [{ start: "HH:MM", minutes }] already checked by checkRestPlanGate; null clears it.
 */
export function setRestPlan(companyId, employeeId, dayKey, parts) {
  const key = `${employeeId}:${String(dayKey || "").slice(0, 10)}`;
  updateCompany(companyId, (d) => {
    d.restPlans = { ...(d.restPlans || {}) };
    if (!parts || !parts.length) delete d.restPlans[key];
    else d.restPlans[key] = { parts: parts.map((row) => ({ start: row.start, minutes: Number(row.minutes) || 0 })), at: new Date().toISOString() };
  });
}

/** 18632 night-fitness report on the employee file — url/name/at + from/to/permanent. */
export function setNightMedicalFitnessReport(companyId, employeeId, report) {
  const from = String(report?.from || report?.issuedAt || report?.issued || "").trim().slice(0, 10);
  const hasFile = !!(report && (String(report.url || "").trim() || String(report.name || "").trim()));
  if (!hasFile) {
    updateEmployeeProfile(companyId, employeeId, { nightMedicalReport: null, nightMedicalIssuedAt: "" });
    return;
  }
  const permanent = report?.permanent === true;
  const explicitTo = String(report?.to || report?.until || "").trim().slice(0, 10);
  const months = Number(ruleValue("hours.night.medicalYearMonths", from || undefined)) || 12;
  const span = Math.max(1, Math.round(months * 365.25 / 12));
  const to = permanent
    ? ""
    : (explicitTo || (from && !report?.from && !report?.to ? addLaborDays(from, span) : ""));
  updateEmployeeProfile(companyId, employeeId, {
    nightMedicalReport: {
      url: String(report.url || ""),
      name: String(report.name || ""),
      type: String(report.type || "file"),
      from,
      to,
      permanent,
      issuedAt: from,
      at: report.at || new Date().toISOString(),
      until: to,
    },
    nightMedicalIssuedAt: from,
    nightMedicalPermanent: permanent || undefined,
  });
  // The worker hears that his night fitness is on file (and until when) — he no longer has to ask.
  addNotification(
    companyId,
    employeeId,
    permanent
      ? "حُفظ تقرير لياقتك للعمل الليلي في ملفك (دائم) — القرار 18632."
      : `حُفظ تقرير لياقتك للعمل الليلي في ملفك${to ? ` — ساري حتى ${to}` : ""} (القرار 18632).`,
    { key: `18632-fitness:${employeeId}:${from || "x"}:${to || "p"}`, to: "/app/shifts" },
  );
}

export function updateShiftType(companyId, stationId, shiftTypeId, updates) {
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    const st = entry.shiftTypes.find((s) => s.id === shiftTypeId);
    if (!st) return;
    Object.assign(st, updates);
    // A shift stretched past 8 hours opens the one-hour flex rest (unless the manager chose a break mode).
    if ((updates?.start || updates?.end) && !updates?.breakMode) {
      const patch = longShiftRestPatch(st);
      if (patch) Object.assign(st, patch);
    }
    applyShiftMerge(entry, planDuplicateShiftMerge(entry.shiftTypes));
    markWeekDirty(entry, new Date());
  });
}

/**
 * Decision 3337 — field / office mark on roster cells (one person, one or more days).
 * mark: "field" | "office" | "" (explicitly unset). The last choice is remembered as the
 * person's default so future in-season cells pre-fill; choosing unset clears that memory.
 * A classification, not a roster change — the week's publish state is left alone.
 */
export function setSunExposure(companyId, stationId, { employeeId, dateKeys = [], mark = "" } = {}) {
  const id = String(employeeId ?? "");
  const keys = (Array.isArray(dateKeys) ? dateKeys : [dateKeys]).map((key) => String(key || "").slice(0, 10)).filter(Boolean);
  if (!id || !keys.length) return;
  const value = mark === "field" || mark === "office" ? mark : "";
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    entry.sunExposure = entry.sunExposure && typeof entry.sunExposure === "object" ? entry.sunExposure : {};
    for (const key of keys) {
      entry.sunExposure[key] = { ...(entry.sunExposure[key] || {}), [id]: value };
    }
    // A day pick never rewrites the person's standing mark — that is set in «إعدادات الجدول».
  }, { sync: "schedules" });
}

/** Per-employee standing mark (مكشوف / مظلّل) — usable any time, also before the season starts. */
export function setSunExposureDefault(companyId, stationId, { employeeId, mark = "" } = {}) {
  const id = String(employeeId ?? "");
  if (!id) return;
  const value = mark === "field" || mark === "office" ? mark : "";
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    entry.sunExposureDefault = entry.sunExposureDefault && typeof entry.sunExposureDefault === "object" ? entry.sunExposureDefault : {};
    if (value) entry.sunExposureDefault[id] = value;
    else delete entry.sunExposureDefault[id];
  }, { sync: "schedules" });
}

export function removeShiftType(companyId, stationId, shiftTypeId) {
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    entry.shiftTypes = entry.shiftTypes.filter((s) => s.id !== shiftTypeId);
    Object.values(entry.assignments).forEach((dayObj) => { delete dayObj[shiftTypeId]; });
  });
}

export function assignEmployeeToShift(companyId, stationId, weekday, shiftTypeId, employeeId) {
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    entry.assignments[weekday] = entry.assignments[weekday] || {};
    entry.assignments[weekday][shiftTypeId] = entry.assignments[weekday][shiftTypeId] || [];
    if (!entry.assignments[weekday][shiftTypeId].includes(employeeId)) {
      entry.assignments[weekday][shiftTypeId].push(employeeId);
    }
  });
}

export function unassignEmployeeFromShift(companyId, stationId, weekday, shiftTypeId, employeeId) {
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    if (!entry.assignments[weekday]?.[shiftTypeId]) return;
    entry.assignments[weekday][shiftTypeId] = entry.assignments[weekday][shiftTypeId].filter((id) => id !== employeeId);
  });
}

function markWeekDirty(entry, dateKey) {
  const key = weekKeyFromDate(dateKey);
  entry.weekDirty = entry.weekDirty || {};
  entry.weekDirty[key] = true;
}

function applyEmployeeDayShift(entry, dateKey, employeeId, shiftTypeId) {
  const current = dayAssignmentMap(entry.assignments, dateKey) || {};
  const day = cloneDayMap(current);
  for (const shift of entry.shiftTypes || []) {
    day[shift.id] = (day[shift.id] || []).filter((id) => id !== employeeId);
  }
  if (shiftTypeId && (entry.shiftTypes || []).some((shift) => shift.id === shiftTypeId)) {
    day[shiftTypeId] = [...(day[shiftTypeId] || []), employeeId];
  }
  entry.assignments = entry.assignments || {};
  entry.assignments[dateKey] = day;
  markWeekDirty(entry, dateKey);
}

export function setEmployeeDayShift(companyId, stationId, dateKey, employeeId, shiftTypeId, {
  weekStart,
  ordinaryOnly = false,
  holidayWorkConfirmed = false,
  by = "",
} = {}) {
  const data = getCompanyData(companyId);
  const employee = data?.employees?.find((row) => row.id === employeeId);
  const schedule = (data?.schedules || []).find((row) => row.stationId === stationId) || getOrCreateSchedule({ schedules: data?.schedules || [], ...data }, stationId);
  const laborCalendar = laborCalendarOf(data);
  // Decision 18632: auto-jump to first legal period, or refuse with named gate — never silent illegal duty.
  const resolved = resolveNightRestAssignTarget({
    schedule,
    employee,
    dateKey,
    shiftTypeId,
    laborCalendar,
    weekStart: weekStart || weekStartDate(dateKey),
    ordinaryOnly,
    holidayWorkConfirmed,
  });
  if (!resolved.ok) return resolved;
  const placeKey = resolved.dateKey;
  const placeId = resolved.shiftTypeId;
  const clearedSource = !!(resolved.jumped && placeKey !== dateKey);
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    const emp = (d.employees || []).find((row) => row.id === employeeId);
    const calendar = laborCalendarOf(d);
    // Art. 107(3): the confirmed «عمل في العطلة» lives on the file; clearing the duty withdraws it.
    if (emp && isOfficialHoliday(placeKey, calendar)) {
      emp.holidayWork = emp.holidayWork || {};
      if (placeId && (holidayWorkConfirmed || emp.holidayWork[placeKey])) {
        emp.holidayWork[placeKey] = { ...(emp.holidayWork[placeKey] || {}), confirmedAt: emp.holidayWork[placeKey]?.confirmedAt || new Date().toISOString(), by: emp.holidayWork[placeKey]?.by || by || "", stationId, withdrawnAt: undefined };
      } else if (!placeId && emp.holidayWork[placeKey]) {
        delete emp.holidayWork[placeKey];
      }
      // Withdrawn from the roster: the open entry the publish stamped from the plan goes too.
      if (!placeId) withdrawHolidayWorkOvertime(d, emp.id, placeKey);
    }
    // Stamp leave days as rest so weekday templates cannot leave a ghost night on Art. 112 days.
    clearRosterLeaveGhostAssignments(entry, emp ? [emp] : [], weekDateKeys(weekStartDate(dateKey)), calendar);
    applyEmployeeDayShift(entry, placeKey, employeeId, placeId);
    if (clearedSource) applyEmployeeDayShift(entry, dateKey, employeeId, null);
  }, { sync: "schedules" });
  return {
    ok: true,
    jumped: !!resolved.jumped,
    dateKey: placeKey,
    shiftTypeId: placeId,
    clearedSource,
    reason: resolved.reason,
    reasonEn: resolved.reasonEn,
  };
}

/** Reuse a month's dated roster into another month — manager can edit cells after. */
export function copyScheduleMonth(companyId, stationId, {
  sourceYear,
  sourceMonthIndex,
  targetYear,
  targetMonthIndex,
  ar = true,
} = {}) {
  const live = getCompanyData(companyId);
  if (!live) {
    return {
      ok: false,
      error: "NO_COMPANY",
      reason: ar ? "لا شركة." : "No company.",
      reasonEn: "No company.",
    };
  }
  const schedule = (live.schedules || []).find((row) => row.stationId === stationId);
  const laborCalendar = laborCalendarOf(live);
  const plan = planCopyMonthAssignments({
    assignments: schedule?.assignments || {},
    sourceYear,
    sourceMonthIndex,
    targetYear,
    targetMonthIndex,
    laborCalendar,
    ar,
  });
  if (!plan.ok) return plan;
  let nightRestRepair = { repaired: 0, cleared: 0 };
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    applyCopyMonthAssignments(entry, plan);
    const calendar = laborCalendarOf(d);
    const keys = monthDateKeys(targetYear, targetMonthIndex);
    clearRosterLeaveGhostAssignments(entry, d.employees || [], keys, calendar);
    // Copy must not leave illegal 18632 rest pairs — jump or clear before publish sees them.
    nightRestRepair = repairNightRestAssignments(entry, {
      employees: d.employees || [],
      dateKeys: keys,
      laborCalendar: calendar,
    });
    for (const start of weekStartsInMonth(targetYear, targetMonthIndex)) {
      markWeekDirty(entry, calendarDateKey(start));
    }
  }, { sync: "schedules" });
  return { ok: true, ...plan, nightRestRepair };
}

export function setWeekValidity(companyId, stationId, validity, validUntil) {
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    entry.validity = validity || "week";
    entry.validUntil = validity === "until" ? validUntil || "" : "";
    const key = weekKeyFromDate(new Date());
    entry.weekDirty = entry.weekDirty || {};
    entry.weekDirty[key] = true;
  });
}

export function publishWeek(companyId, stationId, weekStartKey, { by } = {}) {
  const live = getCompanyData(companyId);
  if (!live) return { ok: false, error: "NO_COMPANY", reason: "لا شركة.", reasonEn: "No company." };
  const schedule = (live.schedules || []).find((row) => row.stationId === stationId);
  if (!schedule) return { ok: false, error: "NO_SCHEDULE", reason: "لا جدول لهذا الفرع.", reasonEn: "No roster for this station." };
  const gates = checkWeekPublishGates({
    schedule,
    employees: live.employees || [],
    weekStart: weekStartKey || new Date(),
    stationId,
    station: (live.stations || []).find((row) => String(row.id) === String(stationId)),
    settings: live.settings,
    company: live,
    ar: true,
    laborCalendar: laborCalendarOf(live),
  });
  if (gates.blocked) {
    const first = gates.blockers[0];
    return {
      ok: false,
      error: "PUBLISH_BLOCKED",
      reason: first?.note || "لا يُنشر جدول يخالف مانعاً نظامياً.",
      reasonEn: first?.note || "A blocking labour check stops publish.",
      blockers: gates.blockers.map((row) => row.id),
    };
  }
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    const weekKey = weekKeyFromDate(weekStartKey || new Date());
    const validity = entry.validity || "week";
    const validUntil = validity === "until" ? (entry.validUntil || "") : "";
    clearRosterLeaveGhostAssignments(
      entry,
      d.employees || [],
      weekDateKeys(weekStartKey || new Date()),
      laborCalendarOf(d),
    );
    entry.publishedWeeks = entry.publishedWeeks || {};
    entry.publishedWeeks[weekKey] = {
      at: new Date().toISOString(),
      by: by || "",
      validity,
      validUntil,
      // What employees see until the next publish (publishedViewSchedule).
      ...publishedWeekSnapshot(entry, weekStartKey || new Date()),
    };
    entry.weekDirty = entry.weekDirty || {};
    delete entry.weekDirty[weekKey];
    for (const key of stampHolidayWorkOvertime(d, entry, weekStartKey || new Date())) {
      const cut = key.lastIndexOf(":");
      queueOtPendingNotice(key.slice(0, cut), key.slice(cut + 1), true);
    }
  });
  flushOtPendingNotices(companyId);
  return { ok: true };
}

export function announceRamadanStart(companyId, year, shift, { by } = {}) {
  const n = Number(shift);
  if (n !== -1 && n !== 0 && n !== 1) {
    return {
      ok: false,
      error: "RAMADAN_START",
      reason: "بداية رمضان تُعلن بعد الرؤية: يوماً قبل أم القرى، أو كما هي، أو يوماً بعد.",
      reasonEn: "Ramadan start is announced after the sighting: one day before Umm al-Qura, as predicted, or one day after.",
    };
  }
  const y = Number(year);
  const win = ramadanWindowForYear(y);
  if (!win) {
    return { ok: false, error: "RAMADAN_WINDOW", reason: "لا نافذة مرمّزة لهذه السنة.", reasonEn: "No encoded Ramadan window for that year." };
  }
  updateCompany(companyId, (d) => {
    d.laborCalendar = d.laborCalendar || {};
    d.laborCalendar[String(y)] = {
      ...(d.laborCalendar[String(y)] || {}),
      ramadanStartShift: n,
      ramadanFrom: addLaborDays(win.from, n),
      startAnnouncedAt: new Date().toISOString(),
      startAnnouncedBy: by || "",
    };
  });
  return { ok: true, year: y, ramadanStartShift: n, ramadanFrom: addLaborDays(win.from, n) };
}

export function announceRamadanLength(companyId, year, length, { by } = {}) {
  const n = Number(length);
  if (n !== 29 && n !== 30) {
    return {
      ok: false,
      error: "RAMADAN_LENGTH",
      reason: "إعلان رمضان يكون 29 أو 30 يوماً بعد ثبوت الرؤية — لا يُخمَّن اليوم الأخير.",
      reasonEn: "Ramadan is announced as 29 or 30 days after the sighting — the last day is never guessed.",
    };
  }
  const y = Number(year);
  if (!Number.isFinite(y) || y < 2000) {
    return { ok: false, error: "YEAR_REQUIRED", reason: "حدد سنة الإعلان.", reasonEn: "Set the announcement year." };
  }
  updateCompany(companyId, (d) => {
    d.laborCalendar = d.laborCalendar || {};
    d.laborCalendar[String(y)] = {
      ...(d.laborCalendar[String(y)] || {}),
      ramadanLength: n,
      announcedAt: new Date().toISOString(),
      announcedBy: by || "",
    };
  });
  return { ok: true, year: y, ramadanLength: n };
}

function ownerBoardDenied(companyId, actor) {
  const live = companyId ? getCompanyData(companyId) : null;
  if (companyId && !live) return { ok: false, error: "NO_COMPANY", reason: "لا شركة.", reasonEn: "No company." };
  const gate = platformOwnerGate(actor);
  if (!gate.ok) return gate;
  return { ok: true, live };
}

function ownerPlatformDenied(actor) {
  const gate = platformOwnerGate(actor);
  if (!gate.ok) return gate;
  return { ok: true };
}

export function saveOwnerSubscriptions(companyId, draft, { actor } = {}) {
  const access = ownerBoardDenied(companyId, actor);
  if (!access.ok) return access;
  const checked = persistSubscriptionPlans(draft);
  if (!checked.ok) return checked;
  updateCompany(companyId, (d) => {
    d.settings = { ...(d.settings || {}) };
    d.settings.ownerBoard = {
      ...(d.settings.ownerBoard || {}),
      plans: checked.plans,
      plansSavedAt: new Date().toISOString(),
      plansSavedBy: actor?.id || "",
    };
  });
  const live = getCompanyData(companyId);
  return { ok: true, plans: checked.plans, dashboard: dashboardSubscription({ plan: access.live?.plan || live?.plan }, live) };
}

export function saveOwnerHolidays(companyId, draft, { actor } = {}) {
  const access = ownerPlatformDenied(actor);
  if (!access.ok) return access;
  const checked = persistHolidayRulings(draft);
  if (!checked.ok) return checked;
  const prev = readPlatformOwnerBoard() || {};
  writePlatformOwnerBoard({
    ...prev,
    holidays: checked.holidays,
    holidaysSavedAt: new Date().toISOString(),
    holidaysSavedBy: actor?.id || actor?.email || "",
  });
  // Twin into the selected company when present — laborCalendarOf still prefers platform.
  if (companyId && getCompanyData(companyId)) {
    updateCompany(companyId, (d) => {
      d.settings = { ...(d.settings || {}) };
      d.settings.ownerBoard = {
        ...(d.settings.ownerBoard || {}),
        holidays: checked.holidays,
        holidaysSavedAt: new Date().toISOString(),
        holidaysSavedBy: actor?.id || "",
      };
      d.laborCalendar = { ...(d.laborCalendar || {}), ownerHolidays: checked.holidays };
    });
  }
  return { ok: true, holidays: checked.holidays };
}

export function saveOwnerRamadan(companyId, draft, { actor } = {}) {
  const access = ownerPlatformDenied(actor);
  if (!access.ok) return access;
  const platform = readPlatformOwnerBoard() || {};
  const calendar = laborCalendarOf({ laborCalendar: {}, settings: { ownerBoard: { holidays: platform.holidays } } });
  if (platform.ramadan) {
    for (const [year, row] of Object.entries(platform.ramadan)) {
      if (row && typeof row === "object") calendar[year] = { ...(calendar[year] || {}), ...row };
    }
  }
  const checked = persistRamadanRuling(draft, calendar);
  if (!checked.ok) return checked;
  const yearKey = String(checked.year);
  const yearBag = {
    ...(platform.ramadan?.[yearKey] || {}),
    ownerRamadanFrom: checked.from,
    ownerRamadanAt: new Date().toISOString(),
    ownerRamadanBy: actor?.id || actor?.email || "",
  };
  if (checked.to) {
    yearBag.ownerRamadanTo = checked.to;
    yearBag.ramadanLength = checked.length;
  } else {
    delete yearBag.ownerRamadanTo;
    delete yearBag.ramadanLength;
  }
  writePlatformOwnerBoard({
    ...platform,
    ramadan: {
      ...(platform.ramadan || {}),
      [yearKey]: yearBag,
    },
    ramadanSavedAt: new Date().toISOString(),
    ramadanSavedBy: actor?.id || actor?.email || "",
  });
  if (companyId && getCompanyData(companyId)) {
    updateCompany(companyId, (d) => {
      d.laborCalendar = d.laborCalendar || {};
      const prev = { ...(d.laborCalendar[yearKey] || {}) };
      prev.ownerRamadanFrom = checked.from;
      prev.ownerRamadanAt = new Date().toISOString();
      prev.ownerRamadanBy = actor?.id || "";
      if (checked.to) {
        prev.ownerRamadanTo = checked.to;
        prev.ramadanLength = checked.length;
      } else {
        delete prev.ownerRamadanTo;
        delete prev.ramadanLength;
      }
      d.laborCalendar[yearKey] = prev;
    });
  }
  return { ok: true, year: checked.year, from: checked.from, to: checked.to, length: checked.length };
}

export function setOtDecision(companyId, employeeId, dateKey, {
  decision,
  overtimeMinutes,
  by,
  workerConsent,
  enjoyDate,
  windowAgreed,
} = {}) {
  const live = getCompanyData(companyId);
  const employee = (live?.employees || []).find((row) => row.id === employeeId);
  const day = String(dateKey || "").slice(0, 10);
  const plan = planOtDecision(live, employeeId, day, {
    decision,
    overtimeMinutes,
    by,
    workerConsent,
    enjoyDate,
    windowAgreed,
    extraHoursYtd: otHoursInYearForCap(employee?.otherRequests, day.slice(0, 4)),
    extraCreditDaysYtd: compLeaveDaysInYearForCap(employee?.otherRequests, day.slice(0, 4)),
  });
  if (!plan.ok) return plan;
  updateCompany(companyId, (d) => {
    d.otDecisions = d.otDecisions || {};
    d.otDecisions[plan.key] = { ...(d.otDecisions[plan.key] || {}), ...plan.entry };
  });
  if (plan.capConsentRequested) {
    addNotification(companyId, employeeId, `طلب موافقتك على تجاوز سقف الإضافي السنوي ${plan.cap} ساعة (اللائحة م22) — ${day}.`, { kind: "ot_cap_consent", dateKey: day, to: "/app/requests" });
  }
  return plan.result;
}

/** Regs Art. 22 — the worker answers the request to pass the annual overtime cap. */
export function answerOtCapConsent(companyId, employeeId, dateKey, { accept, by } = {}) {
  const live = getCompanyData(companyId);
  const day = String(dateKey || "").slice(0, 10);
  const key = `${employeeId}:${day}`;
  const entry = live?.otDecisions?.[key];
  if (!entry || entry.decision !== "pending_worker_cap_consent") {
    return { ok: false, error: "NO_CAP_CONSENT_REQUEST", reason: "لا طلب موافقة على تجاوز السقف لهذا اليوم.", reasonEn: "No cap-consent request for this day." };
  }
  if (accept !== true) {
    updateCompany(companyId, (d) => {
      const row = d.otDecisions?.[key];
      if (!row) return;
      row.capConsentDeclinedAt = new Date().toISOString();
      row.decision = "pending";
    });
    return { ok: true, declined: true };
  }
  updateCompany(companyId, (d) => {
    const row = d.otDecisions?.[key];
    if (!row) return;
    row.workerCapConsentAt = new Date().toISOString();
    row.workerCapConsentBy = by || employeeId;
    row.decision = "pending";
  });
  const requested = entry.requestedDecision || "approve";
  return setOtDecision(companyId, employeeId, day, {
    decision: requested,
    overtimeMinutes: entry.overtimeMinutes,
    by: entry.capConsentRequestedBy || by,
    workerConsent: entry.workerConsent === true,
    enjoyDate: entry.enjoyDate,
    windowAgreed: entry.windowAgreed === true,
  });
}

/** Art. 107(3) — confirm «عمل في العطلة» for one person on one holiday, then roster the shift. */
export function confirmHolidayWork(companyId, stationId, dateKey, employeeId, shiftTypeId, { by, weekStart } = {}) {
  if (!shiftTypeId) {
    return { ok: false, error: "SHIFT_REQUIRED", reason: "اختر الوردية للعمل في العطلة.", reasonEn: "Choose the shift for the holiday work." };
  }
  return setEmployeeDayShift(companyId, stationId, dateKey, employeeId, shiftTypeId, { weekStart, holidayWorkConfirmed: true, by });
}

export function setNightConsent(companyId, employeeId, consented) {
  updateCompany(companyId, (d) => {
    const employee = d.employees.find((row) => row.id === employeeId);
    if (!employee) return;
    employee.profile = employee.profile || {};
    if (consented) {
      employee.profile.nightConsentAt = new Date().toISOString();
      employee.profile.nightConsentWithdrawnAt = undefined;
    } else {
      employee.profile.nightConsentWithdrawnAt = new Date().toISOString();
    }
  });
  audit(companyId, consented ? "night_consent_recorded" : "night_consent_withdrawn", `Night-work consent ${consented ? "recorded" : "withdrawn"} for employee ${employeeId}.`);
}

/* ----------------------------- company files (nested folders + documents) -----------------------------
   A flat node list: every node is either a folder or a file, with parentId pointing at the
   containing folder (null = root). Folders can nest inside folders without limit. */
export function addFileFolder(companyId, { name, parentId, stationId }) {
  updateCompany(companyId, (d) => {
    d.files = d.files || [];
    d.files.push({ id: uid("fold"), type: "folder", name, parentId: parentId || null, stationId: stationId || null, createdAt: new Date().toISOString() });
  });
}

export function addCompanyFile(companyId, { name, parentId, url, size, mimeType, uploadedBy, stationId }) {
  updateCompany(companyId, (d) => {
    d.files = d.files || [];
    d.files.push({ id: uid("file"), type: "file", name, parentId: parentId || null, url, size, mimeType, uploadedBy, stationId: stationId || null, createdAt: new Date().toISOString() });
  });
}

// Renames a file or folder node.
export function renameFileNode(companyId, nodeId, name) {
  updateCompany(companyId, (d) => {
    d.files = d.files || [];
    const node = d.files.find((f) => f.id === nodeId);
    if (node && name && name.trim()) node.name = name.trim();
  });
}

// Deletes a node and (for folders) everything nested inside it, at any depth.
export function deleteFileNode(companyId, nodeId) {
  updateCompany(companyId, (d) => {
    d.files = d.files || [];
    const toRemove = new Set([nodeId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of d.files) {
        if (f.parentId && toRemove.has(f.parentId) && !toRemove.has(f.id)) { toRemove.add(f.id); grew = true; }
      }
    }
    d.files = d.files.filter((f) => !toRemove.has(f.id));
  });
}

/* ----------------------------- station chat groups (flexible cross-station chat) -----------------------------
   Lets an owner link two or more workplace branches into their own shared chat room. */
export function addStationChatGroup(companyId, { name, stationIds }) {
  updateCompany(companyId, (d) => {
    const ids = (stationIds || []).filter((id) => {
      if (!id || id === "hq") return false;
      const station = (d.stations || []).find((item) => String(item.id) === String(id));
      return Boolean(station && isWorkplaceStation(station));
    });
    if (ids.length < 2) return;
    d.stationChatGroups = d.stationChatGroups || [];
    d.stationChatGroups.push({ id: uid("chgrp"), name, stationIds: ids });
  });
}

export function removeStationChatGroup(companyId, groupId) {
  updateCompany(companyId, (d) => {
    d.stationChatGroups = (d.stationChatGroups || []).filter((g) => g.id !== groupId);
  });
}

/* ----------------------------- flexible HR hierarchy editor ----------------------------- */
// Any company can add, rename, reorder, or remove HR positions — the hierarchy is
// no longer fixed. Each level keeps its own `order` (escalation rank) and `scope`.
// stationIds (only meaningful when scope === "station"): leave empty/null so the position
// applies to every station, or pick one or more so the position — and any later suspend/
// remove/edit on it — only shows in the org chart of those chosen stations.
export function addHRTier(companyId, { scope, managerName, includeAssistant, assistantName, managerPermissions, assistantPermissions, stationIds }) {
  audit(companyId, "hr_tier_added", `HR position "${managerName}" (${scope} scope) added to the hierarchy.`);
  updateCompany(companyId, (d) => {
    d.hrLevels = d.hrLevels || [];
    const order = Math.max(0, ...d.hrLevels.map((l) => l.order || 0)) + 1;
    const sIds = Array.isArray(stationIds) && stationIds.length > 0 ? stationIds : null;
    d.hrLevels.push({ id: uid("hrlvl"), order, role: "manager", scope, stationIds: sIds, name: managerName, permissions: managerPermissions || MANAGER_PERMISSIONS, maxCount: null });
    if (includeAssistant) {
      d.hrLevels.push({ id: uid("hrlvl"), order, role: "assistant", scope, stationIds: sIds, name: assistantName || managerName, permissions: assistantPermissions || ASSISTANT_PERMISSIONS, maxCount: null });
    }
  });
}

export function renameHRLevel(companyId, levelId, name) {
  updateCompany(companyId, (d) => {
    const level = (d.hrLevels || []).find((l) => l.id === levelId);
    if (level) level.name = name;
  });
}

// Lets a company freely customize exactly which permissions any HR level (manager
// or assistant) holds — no fixed permission set per role.
export function setHRLevelPermissions(companyId, levelId, permissions) {
  updateCompany(companyId, (d) => {
    const level = (d.hrLevels || []).find((l) => l.id === levelId);
    if (level) level.permissions = permissions;
  });
}

// Updates which stations a station-scoped tier applies to (empty/null = all stations).
export function setHRTierStations(companyId, order, stationIds) {
  updateCompany(companyId, (d) => {
    const levels = (d.hrLevels || []).filter((l) => l.order === order);
    if (!levels.length) return;
    const sIds = Array.isArray(stationIds) && stationIds.length > 0 ? stationIds : null;
    levels.forEach((l) => { l.stationIds = sIds; });
  });
}

// Removes an entire position tier (manager + assistant sharing that order) and
// unassigns any employees who held those positions. Any anonymous report currently
// awaiting a reply from the removed tier is automatically redirected to whoever is
// above it in the chain (escalationLevel numbering naturally shifts up).
export function removeHRTier(companyId, order) {
  const tierName = (getCompanyData(companyId)?.hrLevels || []).find((l) => l.order === order && l.role === "manager")?.name || `tier ${order}`;
  audit(companyId, "hr_tier_removed", `HR position "${tierName}" removed from the hierarchy.`);
  updateCompany(companyId, (d) => {
    const orders = Array.from(new Set((d.hrLevels || []).map((l) => l.order))).sort((a, b) => a - b);
    const removedPosition = orders.indexOf(order) + 1; // escalationLevel: 0 = station manager, 1..N = tiers in order
    const removedIds = (d.hrLevels || []).filter((l) => l.order === order).map((l) => l.id);
    d.hrLevels = (d.hrLevels || []).filter((l) => l.order !== order);
    d.employees.forEach((e) => {
      if (removedIds.includes(e.hrLevelId)) { e.hrLevelId = null; e.hrStationId = null; e.hrClusterId = null; }
    });
    if (removedPosition > 0) {
      (d.anonymousReports || []).forEach((r) => {
        if ((r.escalationLevel || 0) > removedPosition) r.escalationLevel -= 1;
        // reports exactly at the removed level stay at the same number, which now
        // naturally maps to the next-higher tier that shifted into that slot.
      });
    }
  });
}

// Suspends (or reactivates) a whole tier without deleting it — assigned employees and
// history stay intact, but the tier is hidden from org charts/assignment until re-enabled.
export function toggleHRTierActive(companyId, order) {
  updateCompany(companyId, (d) => {
    const levels = (d.hrLevels || []).filter((l) => l.order === order);
    if (!levels.length) return;
    const nextActive = levels.some((l) => l.active === false);
    levels.forEach((l) => { l.active = nextActive; });
  });
}

// Swaps a tier's order with the adjacent one — direction 1 = increase authority, -1 = decrease.
export function moveHRTier(companyId, order, direction) {
  updateCompany(companyId, (d) => {
    const orders = Array.from(new Set((d.hrLevels || []).map((l) => l.order))).sort((a, b) => a - b);
    const idx = orders.indexOf(order);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= orders.length) return;
    const swapOrder = orders[swapIdx];
    (d.hrLevels || []).forEach((l) => {
      if (l.order === order) l.order = swapOrder;
      else if (l.order === swapOrder) l.order = order;
    });
  });
}