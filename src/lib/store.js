// PowerCare data layer — localStorage-based, multi-tenant with full company isolation.
// Registry tracks all companies; each company's data lives under its own key.
import { MANAGER_PERMISSIONS, ASSISTANT_PERMISSIONS, groupLevelsByOrder } from "./hrLevels";
import { base44 } from "@/api/base44Client";
import { sendEmailAlert } from "./emailAlerts";
import { toRiyadhDateKey } from "./riyadhDate";
import { reconcileStationReferences } from "./stationConsistency";
import { clearStationScope } from "./stationScopeStore";
import { planDuplicateShiftMerge, shiftWindowKey } from "./shiftDerivations";
import { applyWorkplaceManagerRule } from "./peopleTreeGraph";
import { isWorkplaceStation } from "./stationTree";
import { appendOrgStructureEvent } from "./orgStructureLog";
import { statutoryLeaveFloor } from "./leaveTypes";
import { checkApproveLeaveGate } from "./leaveDerivations";
import { art55FilePatch, laborFilePatch } from "./contractLawDerivations";

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

/* ----------------------------- audit trail ----------------------------- */
// Full audit trail: every sensitive mutation below logs who did what. The acting
// user's name is set by the auth provider whenever the session changes.
let auditActor = "system";
export function setAuditActor(name) {
  auditActor = name || "system";
}
function audit(companyId, action, details) {
  const safeDetails = String(details || "").slice(0, 1000);
  invokeDirectory({ action: "logAudit", companyId, auditAction: action, performedBy: auditActor, details: safeDetails }).catch(() => {});
}
export function logAudit(companyId, action, details) {
  audit(companyId, action, details);
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
  return null;
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

// Owner-initiated permanent purge: deletes the company account, all employees,
// stations, credentials, sessions and data blobs from the cloud, then removes
// the local copy and ends the session. Returns true only if the cloud purge succeeded.
export async function purgeCompanyAccount(companyId) {
  const res = await invokeDirectory({ action: "deleteCompanyAccount", companyId, performedBy: auditActor });
  if (!res?.data?.ok) return false;
  deleteCompany(companyId);
  clearSession();
  return true;
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
    workProofs: [],
    disciplinaryCases: [],
    settings: { rateLimitDaily: 3, rateLimitWeekly: 10, rateLimitMonthly: 30, orgType: "company" },
  };
}

const COMPANY_ARRAY_KEYS = [
  "stations", "employees", "tasks", "reports", "anonymousReports", "publicReports",
  "safety", "files", "plans", "notifications", "templates", "targets", "hrLevels",
  "jobGrades", "hrClusters", "schedules", "stationChatGroups", "personalPlaces",
  "personalAttendance", "plannerItems", "journalEntries", "payrollRuns",
  "smartPositions", "permissionTemplates", "orgSeats", "orgStructureLog", "complaintEscalationChain", "workProofs", "disciplinaryCases",
];

function normalizeCompanyData(data) {
  if (!data || typeof data !== "object") return data;
  for (const key of COMPANY_ARRAY_KEYS) {
    if (!Array.isArray(data[key])) data[key] = [];
  }
  if (!data.branchEscalationChains || typeof data.branchEscalationChains !== "object") {
    data.branchEscalationChains = {};
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
export function getCompanyData(id) {
  const data = normalizeCompanyData(read(companyKey(id), null));
  if (!data) return data;
  let persist = false;
  if (Object.prototype.hasOwnProperty.call(data, "cameras")) {
    delete data.cameras;
    persist = true;
  }
  if (purgePresetLadders(data)) persist = true;
  // Local preview used to seed compass names (شمال/شرق) — those were labels only,
  // not a forced region layer. Rewrite once so the org tree shows free branch names.
  if (id === LOCAL_PREVIEW_COMPANY && Array.isArray(data.stations)) {
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
  if (nextUpdates.employees) nextUpdates.employees = mergeLocalDemoRecords(current.employees, nextUpdates.employees, "employees", companyId);
  if (nextUpdates.stations) nextUpdates.stations = mergeLocalDemoRecords(current.stations, nextUpdates.stations, "stations", companyId);
  let next = { ...current, ...nextUpdates };
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
    syncBlobToEntity(id, sync, data[sync] || []);
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
  BLOB_CATEGORIES.forEach((category) => syncBlobToEntity(id, category, data[category]));
  syncBlobToEntity(id, "companyMeta", [{
    id: "meta",
    name: data.name,
    plan: data.plan,
    directorId: data.directorId,
    ownerId: data.ownerId,
    stationChatGroups: data.stationChatGroups,
    crossStationChatEnabled: data.crossStationChatEnabled,
    settings: data.settings,
    reportBranding: data.reportBranding,
    orgStructureLog: data.orgStructureLog || [],
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
  "complaintEscalationChain", "branchEscalationChains", "orgTree", "orgSeats", "workProofs", "disciplinaryCases",
  ];
const lastSyncedBlobJSON = {};
async function syncBlobToEntity(companyId, category, payload) {
  if (isLocalPreviewWorkspace(companyId)) return;
  const key = `${companyId}_${category}`;
  const json = JSON.stringify(payload || []);
  if (lastSyncedBlobJSON[key] === json) return;
  lastSyncedBlobJSON[key] = json;
  try {
    await invokeDirectory({ action: "syncBlob", companyId, category, payload: payload || [] });
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
    await invokeDirectory({ action: "syncEmployees", companyId, employees: employees || [] });
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
    return records.map((r) => ({
      id: r.employeeId,
      name: r.name,
      email: r.email,
      role: r.role,
      stationId: r.stationId,
      phone: r.phone,
      position: r.position,
      anonymousId: r.anonymousId,
      points: r.points,
      hrLevelId: r.hrLevelId,
      hrStationId: r.hrStationId,
      hrClusterId: r.hrClusterId,
      canManageTeam: r.canManageTeam,
      managedStations: r.managedStations,
      profile: r.profile,
      certificates: r.certificates,
      leaveRequests: r.leaveRequests,
      hrMessages: r.hrMessages,
      createdAt: r.created_date,
    }));
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
  write(SESSION_KEY, session);
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

export async function deleteEmployeeAccount(companyId, employeeId) {
  const res = await invokeDirectory({ action: "deleteEmployeeAccount", companyId, employeeId });
  if (!res?.data?.ok) return false;
  updateCompany(companyId, (data) => {
    (data.orgSeats || []).forEach((seat) => {
      if (String(seat.employeeId) !== String(employeeId)) return;
      seat.employeeId = null;
      seat.filledAt = null;
      seat.vacatedAt = new Date().toISOString();
      seat.hireOpen = true;
    });
    (data.stations || []).forEach((station) => {
      if (String(station.managerId) === String(employeeId)) station.managerId = null;
    });
    data.smartPositions = (data.smartPositions || []).filter((item) => String(item.employeeId) !== String(employeeId));
    data.orgTree = (data.orgTree || []).filter((node) => String(node.refId) !== String(employeeId) && String(node.id) !== `org_${employeeId}`);
    data.employees = data.employees.filter((employee) => employee.id !== employeeId);
  });
  return true;
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
    next.role = "station_manager";
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
    emp.role = ids.length ? "station_manager" : "employee";
    emp.stationId = ids.length === 1 ? ids[0] : null;
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
  // Snapshot key collections so every add/remove/status change is audited
  // automatically, no matter which page performed the mutation.
  const before = {
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
  const newReports = [
    ...(data.anonymousReports || []).filter((r) => !before.anrIds.has(r.id)),
    ...(data.publicReports || []).filter((r) => !before.pubIds.has(r.id)),
  ];
  newReports.forEach((r) => {
    const station = (data.stations || []).find((s) => s.id === (r.stationId || data.stations?.[0]?.id));
    const manager = (data.employees || []).find((e) => e.id === station?.managerId);
    const toEmail = manager?.email || getCompanyMeta(companyId)?.ownerEmail;
    if (toEmail) {
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

export function addNotification(companyId, userId, text) {
  updateCompany(companyId, (d) => {
    d.notifications.unshift({ id: uid("ntf"), userId, text, read: false, createdAt: new Date().toISOString() });
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
  });
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
    emp.profile = { ...(emp.profile || {}), employmentStatus: "terminated", offboarding: next };
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

// Leave requests: employee submits, an authorized manager/HR approves or rejects.
export function submitLeaveRequest(companyId, employeeId, { type, startDate, endDate, reason, files, eventDate, examRepeat, days: requestedDays }) {
  updateCompany(companyId, (d) => {
    const emp = d.employees.find((e) => e.id === employeeId);
    if (!emp) return;
    emp.leaveRequests = emp.leaveRequests || [];
    const calendarDays = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
    const explicit = Number(requestedDays);
    const days = Number.isFinite(explicit) && explicit >= 1 ? Math.max(1, Math.round(explicit)) : calendarDays;
    emp.leaveRequests.unshift({
      id: uid("leave"),
      type, startDate, endDate, days, reason,
      eventDate: eventDate || undefined,
      examRepeat: examRepeat || undefined,
      files: files || [],
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  });
  // Route to the assigned HR manager for this employee's station, if any.
  const data = getCompanyData(companyId);
  const hrManager = getStationHRManager(data, employeeId);
  if (hrManager) {
    const emp = data.employees.find((e) => e.id === employeeId);
    addNotification(companyId, hrManager.id, `New ${type} leave request from ${emp?.name || ""} needs your review.`);
  }
}

export function setLeaveRequestStatus(companyId, employeeId, requestId, status, reviewerName) {
  const data = getCompanyData(companyId);
  const emp = data?.employees.find((e) => e.id === employeeId);
  const empName = emp?.name || "";
  const req = (emp?.leaveRequests || []).find((r) => r.id === requestId);
  if (status === "approved") {
    const typeRequiresFile = ["sick", "exam"].includes(req?.type);
    const gate = checkApproveLeaveGate(req, typeRequiresFile, {
      profile: emp?.profile,
      requests: emp?.leaveRequests,
    });
    if (!gate.ok) return gate;
  }
  audit(companyId, `leave_request_${status}`, `Leave request for ${empName} marked "${status}" by ${reviewerName || "manager"}.`);
  updateCompany(companyId, (d) => {
    const employee = d.employees.find((e) => e.id === employeeId);
    if (!employee) return;
    const leaveReq = (employee.leaveRequests || []).find((r) => r.id === requestId);
    if (!leaveReq) return;
    leaveReq.status = status;
    leaveReq.reviewedBy = reviewerName;
    leaveReq.reviewedAt = new Date().toISOString();
    if (status === "approved") {
      const approvalDate = new Date();
      leaveReq.approvedAt = approvalDate.toISOString();
      // Annual leave: the active vacation period always starts on the approval date,
      // using the number of days originally requested.
      if (leaveReq.type === "annual") {
        const activeEnd = new Date(approvalDate);
        activeEnd.setDate(activeEnd.getDate() + ((leaveReq.days || 1) - 1));
        leaveReq.activeStartDate = approvalDate.toISOString();
        leaveReq.activeEndDate = activeEnd.toISOString();
      }
    }
  });
  return { ok: true };
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

/* ----------------------------- anonymous rate limit ----------------------------- */
export function getAnonUsage(companyId, employeeId, legacyAnonymousId) {
  const data = getCompanyData(companyId);
  const now = Date.now();
  const mine = (r) => (r.authorId ? r.authorId === employeeId : r.anonymousId === legacyAnonymousId);
  const day = data.anonymousReports.filter((r) => mine(r) && now - new Date(r.createdAt).getTime() < 86400000).length;
  const week = data.anonymousReports.filter((r) => mine(r) && now - new Date(r.createdAt).getTime() < 86400000 * 7).length;
  const month = data.anonymousReports.filter((r) => mine(r) && now - new Date(r.createdAt).getTime() < 86400000 * 30).length;
  return {
    day, week, month,
    dayLimit: data.settings.rateLimitDaily,
    weekLimit: data.settings.rateLimitWeekly,
    monthLimit: data.settings.rateLimitMonthly ?? 30,
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
    entry.shiftTypes.push({ id: uid("sft"), label: shiftType.label, start: shiftType.start, end: shiftType.end });
  });
}

export function updateShiftType(companyId, stationId, shiftTypeId, updates) {
  updateCompany(companyId, (d) => {
    const entry = getOrCreateSchedule(d, stationId);
    const st = entry.shiftTypes.find((s) => s.id === shiftTypeId);
    if (!st) return;
    Object.assign(st, updates);
    applyShiftMerge(entry, planDuplicateShiftMerge(entry.shiftTypes));
  });
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