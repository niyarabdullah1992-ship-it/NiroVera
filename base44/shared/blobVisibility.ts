// «الدليل قبل الحكم» — الرؤية بالرفض الافتراضي.
// كل فئة بيانات مشتركة يجب أن تُعلن مَن يراها، ويُفلتَر المحتوى خادمياً قبل الإرجاع
// حتى لا ينزّل موظف عادي بيانات زملائه (إشعاراتهم، مذكراتهم، بلاغاتهم).

// self     = سجلات المستدعي فقط
// scope    = فروع المستدعي (أو المسند إليه)
// handlers = سلسلة معالجة البلاغات فقط (senior / manage_complaints)، ويرى المُبلِّغ بلاغاته
// payroll  = senior أو manage_payroll
// senior   = الإدارة العليا فقط
// shared   = بيانات تشغيلية مشتركة (فروع، إعدادات، هيكل) — مرئية للجميع
export const BLOB_VISIBILITY = {
  notifications: "self",
  journalEntries: "self",
  personalAttendance: "self",
  personalPlaces: "self",
  plannerItems: "self",
  anonymousReports: "handlers",
  publicReports: "handlers",
  reports: "scope",
  tasks: "scope",
  targets: "scope",
  plans: "scope",
  schedules: "scope",
  leaveRoster: "scope",
  safety: "scope",
  files: "scope",
  payrollRuns: "payroll",
  stationBudgets: "senior",
  hrLevels: "senior",
  hrClusters: "senior",
  jobGrades: "shared",
  companyMeta: "shared",
  orgTree: "shared",
  smartPositions: "shared",
  templates: "shared",
  complaintEscalationChain: "shared",
  disciplinaryCases: "senior",
  arbitrationOutcomes: "senior",
  attendancePolicy: "shared",
  attendanceEmergency: "shared",
  // Previously undeclared (= hidden). Declared senior so the deny is visible
  // without opening rows to non-senior readers. See base44/data/domains.jsonc.
  workProofs: "senior",
  visitorProofs: "senior",
  assetTransfers: "senior",
  orgSeats: "senior",
  branchEscalationChains: "senior",
};

// الحقول الحساسة في سجل الموظف — لا تُرسل إلا لصاحبها أو لمن يدير الموظفين.
export const SENSITIVE_EMPLOYEE_FIELDS = ["hrMessages", "leaveRequests", "otherRequests", "certificates", "profile", "phone", "email"];
export const REQUEST_EMPLOYEE_FIELDS = ["leaveRequests", "otherRequests"];

export function redactEmployee(record) {
  const safe = { ...record };
  for (const field of SENSITIVE_EMPLOYEE_FIELDS) delete safe[field];
  return safe;
}

/** Station / leave managers see the request inbox without salary or HR notes. */
export function attachEmployeeRequestFields(full, redacted) {
  const next = { ...(redacted || {}) };
  for (const field of REQUEST_EMPLOYEE_FIELDS) {
    if (full && Object.prototype.hasOwnProperty.call(full, field)) next[field] = full[field];
  }
  return next;
}

export function canSeeEmployeeRequests(context) {
  if (!context) return false;
  if (context.senior) return true;
  const perms = context.permissions;
  if (perms?.has?.("manage_employees") || perms?.has?.("manage_leave")) return true;
  return ["pgm", "station_manager"].includes(context.actor?.role);
}

const recordOwner = (item) => item.userId || item.employeeId || item.ownerId || item.createdBy || null;
const recordStation = (item) => item.stationId || item.station_id || null;

// يفلتر سجلات الـ blob وفق قاعدة الرؤية وسياق المستدعي.
export function filterBlobPayload(category, payload, context) {
  const rows = Array.isArray(payload) ? payload : [];
  const rule = BLOB_VISIBILITY[category];
  if (context.senior) return rows;
  if (rule === "shared") return rows;
  if (rule === undefined) return [];               // فئة غير معلنة = لا تُقرأ
  if (rule === "senior") return [];
  if (rule === "payroll") return context.permissions.has("manage_payroll") ? rows : [];
  if (rule === "self") return rows.filter((item) => recordOwner(item) === context.userId);
  if (rule === "handlers") {
    if (context.permissions.has("manage_complaints") || context.isComplaintHandler) return rows;
    return rows.filter((item) => context.ownReportIds.has(item.id));
  }
  // scope: فروع المستدعي، أو ما أُسند إليه شخصياً، أو ما أنشأه
  const stations = context.scope === null ? null : new Set(context.scope || []);
  return rows.filter((item) => {
    if (recordOwner(item) === context.userId) return true;
    if ((item.assignedTo || item.employeeId) === context.userId) return true;
    const station = recordStation(item);
    if (!station) return false;
    return stations === null ? true : stations.has(station);
  });
}

// الفئات التي لا يجوز حذف سجلاتها — الدليل لا يُمحى، يُؤرشَف بسبب.
export const APPEND_ONLY_CATEGORIES = ["anonymousReports", "publicReports", "reports", "safety"];

// يفحص لقطة append-only: الحذف مرفوض تماماً، والأرشفة تتطلب مُؤرشِفاً وسبباً.
// missing        = سجلات اختفت من الوارد → يجب رفض الطلب بـ409
// invalidArchive = سجلات أُرشفت بلا archivedBy أو archivedReason → 400
// archived       = السجلات التي أُرشفت في هذه العملية (للتقييد في AuditLog)
export function inspectAppendOnly(existingRows, incomingRows) {
  const existing = Array.isArray(existingRows) ? existingRows : [];
  const incoming = Array.isArray(incomingRows) ? incomingRows : [];
  const incomingById = new Map(incoming.filter((item) => item.id).map((item) => [item.id, item]));
  const missing = existing.filter((item) => item.id && !incomingById.has(item.id)).map((item) => item.id);
  const invalidArchive = [];
  const archived = [];
  for (const before of existing) {
    const after = before.id ? incomingById.get(before.id) : null;
    if (!after || after.status !== "archived" || before.status === "archived") continue;
    if (!String(after.archivedBy || "").trim() || !String(after.archivedReason || "").trim()) invalidArchive.push(before.id);
    else archived.push(after);
  }
  return { missing, invalidArchive, archived };
}