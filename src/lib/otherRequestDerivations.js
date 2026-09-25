/** Other HR service requests — letters, permission, overtime, advance. Not leave. */

import { getLeaveTotal, grantDaysOf } from "./leaveTypes.js";
import { checkPunchRecordGate, parsePunchClock } from "./attendancePunch.js";
import { checkIssuedLetterFileGate, checkRaiseSignableGate, isLetterSignableType } from "./requestSigning.js";

export const LEAVE_TOPUP_TYPE = "leave_topup";
export const LEAVE_TOPUP_MAX_DAYS = 30;
/** Same cap as requestWorkspace DISCRETIONARY_GRANT_CAP — admin credit + grantDiscretionaryDays. */
export const DISCRETIONARY_GRANT_CAP = 5;

/** Pools إدارة may credit without the employee raising leave. */
export const LEAVE_CREDIT_POOLS = [
  { key: "annual", ar: "رصيد سنوي", en: "Annual balance" },
  { key: "grant", ar: "أيام تقديرية", en: "Discretionary days" },
];
export const STUDY_CONSENT_TYPE = "study_consent";
export const STUDY_CONSENT_LABEL_AR = "موافقة دراسية";
export const STUDY_CONSENT_LABEL_EN = "Study consent";
export const STUDY_CONSENT_SUBTITLE_AR = "الدراسة أثناء الخدمة بموافقة المنشأة";
export const STUDY_CONSENT_SUBTITLE_EN = "Study during service with the establishment's agreement";

export const STUDY_CONSENT_IRREVOCABLE_AR = "الشركة لا ترجع عن الموافقة الدراسية.";
export const STUDY_CONSENT_IRREVOCABLE_EN = "The company does not withdraw study consent.";
export const EXAM_LEAVE_TRACK_PAID = "paid";
export const EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID = "annual_or_unpaid";
export const EXAM_LEAVE_TRACK_PAID_AR = "مسار مدفوع — موافقة دراسية مسجّلة. إجازة الامتحان بأجر لأيام الامتحان الفعلية عن سنة غير معادة — المادة 115.";
export const EXAM_LEAVE_TRACK_PAID_EN = "Paid track — study consent is on file. Exam leave is with pay for actual first-sit exam days — Article 115.";
export const EXAM_LEAVE_TRACK_FALLBACK_AR = "بدون موافقة المنشأة على الدراسة أثناء الخدمة تُحسب أيام الامتحان من الإجازة السنوية أو بدون أجر — المادة 115.";
export const EXAM_LEAVE_TRACK_FALLBACK_EN = "Without the establishment's agreement to study during service, exam days are taken from annual leave or unpaid — Article 115.";
export const STUDY_CONSENT_FILE_REQUIRED_AR = "أرفق ملف القبول أو الجدول أو إثبات الانتساب.";
export const STUDY_CONSENT_FILE_REQUIRED_EN = "Attach the acceptance letter, schedule, or enrolment proof.";
export const STUDY_CONSENT_APPROVAL_FILE_REQUIRED_AR = "ارفع ملف الموافقة.";
export const STUDY_CONSENT_APPROVAL_FILE_REQUIRED_EN = "Upload the consent letter.";

/** Recording the 18632 night-fitness report — not the week-check id `night_medical`. */
export const NIGHT_FITNESS_TYPE = "night_fitness";
export const NIGHT_FITNESS_LABEL_AR = "لياقة ليلية";
export const NIGHT_FITNESS_LABEL_EN = "Night fitness";
export const NIGHT_FITNESS_SUBTITLE_AR = "تقرير اللياقة الطبية للعمل الليلي — القرار 18632";
export const NIGHT_FITNESS_SUBTITLE_EN = "Night-work medical fitness report — decision 18632";
export const NIGHT_FITNESS_FILE_REQUIRED_AR = "أرفق تقرير اللياقة الطبية للعمل الليلي.";
export const NIGHT_FITNESS_FILE_REQUIRED_EN = "Attach the night-work medical fitness report.";
export const NIGHT_FITNESS_RECORD_ONLY_AR = "هذا الطلب يسجّل التقرير في الملف. تقرير «غير لائق» ما زال يمنع نشر إسناد العامل الليلي.";
export const NIGHT_FITNESS_RECORD_ONLY_EN = "This request records the report on the file. An unfit report still blocks publishing a night-worker assignment.";
export const NIGHT_FITNESS_RANGE_AR = "فترة";
export const NIGHT_FITNESS_RANGE_EN = "Period";
export const NIGHT_FITNESS_PERMANENT_AR = "دائم";
export const NIGHT_FITNESS_PERMANENT_EN = "Permanent";
export const NIGHT_FITNESS_FROM_AR = "تاريخ من";
export const NIGHT_FITNESS_FROM_EN = "From";
export const NIGHT_FITNESS_TO_AR = "تاريخ إلى";
export const NIGHT_FITNESS_TO_EN = "To";
export const NIGHT_FITNESS_PERIOD_REQUIRED_AR = "حدد تاريخ البداية وتاريخ النهاية، أو اختر دائماً.";
export const NIGHT_FITNESS_PERIOD_REQUIRED_EN = "Set the start and end dates, or choose permanent.";
export const NIGHT_FITNESS_PERIOD_INVALID_AR = "تاريخ النهاية يسبق تاريخ البداية.";
export const NIGHT_FITNESS_PERIOD_INVALID_EN = "The end date is before the start date.";
export const NIGHT_FITNESS_EMPLOYEE_ONLY_AR = "الإدارة لا ترفع تقرير اللياقة — الموظف يقدّمه من ملفي.";
export const NIGHT_FITNESS_EMPLOYEE_ONLY_EN = "Management does not file the fitness report — the worker submits it from My file.";

export const OTHER_REQUEST_TYPES = [
  { key: "salary_letter", ar: "شهادة راتب", en: "Salary letter" },
  { key: "employment_letter", ar: "تعريف وظيفي", en: "Employment letter" },
  { key: "permission", ar: "استئذان", en: "Permission" },
  { key: "overtime", ar: "ساعات إضافية", en: "Overtime" },
  { key: "advance", ar: "سلفة", en: "Salary advance" },
  { key: "shift_change", ar: "تغيير وردية", en: "Shift change" },
  { key: "night_consent", ar: "موافقة عمل ليلي", en: "Night-work consent" },
  { key: "written_consent", ar: "موافقة خطية", en: "Written consent" },
  { key: STUDY_CONSENT_TYPE, ar: STUDY_CONSENT_LABEL_AR, en: STUDY_CONSENT_LABEL_EN },
  { key: NIGHT_FITNESS_TYPE, ar: NIGHT_FITNESS_LABEL_AR, en: NIGHT_FITNESS_LABEL_EN },
  { key: "manual_punch", ar: "تسجيل حضور يدوي", en: "Manual punch" },
  { key: "checkout_fix", ar: "تصحيح انصراف", en: "Checkout correction" },
  { key: "custody", ar: "عهدة", en: "Custody" },
  { key: LEAVE_TOPUP_TYPE, ar: "رفع رصيد إجازة", en: "Leave balance top-up" },
  { key: "document", ar: "مستند / أخرى", en: "Document / other" },
  { key: "other_request", ar: "طلب آخر", en: "Other request" },
];

export function otherRequestTypeMeta(type) {
  return OTHER_REQUEST_TYPES.find((row) => row.key === type) || OTHER_REQUEST_TYPES[OTHER_REQUEST_TYPES.length - 1];
}

export function otherRequestTypeLabel(type, ar = true) {
  const meta = otherRequestTypeMeta(type);
  return ar ? meta.ar : meta.en;
}

const OPEN_OTHER = new Set(["pending", "pending_employee", "pending_manager"]);
const ARCHIVED_OTHER = new Set(["approved", "rejected", "refused_by_employee", "withdrawn", "lapsed"]);

export function otherRequestStatus(request) {
  return request?.status || "pending";
}

function studyConsentRowsOf(source) {
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.otherRequests)) return source.otherRequests;
  return [];
}

function studyConsentCompanyOf(row, source) {
  return String(row?.companyId || source?.companyId || "").trim();
}

function studyConsentInCompany(row, source, companyId) {
  const want = String(companyId || source?.companyId || "").trim();
  const got = studyConsentCompanyOf(row, source);
  if (want && got && want !== got) return false;
  return true;
}

/** Latest study-consent state for this employee in this company — approval is the only unlock. */
export function studyConsentState(source, companyId) {
  const rows = studyConsentRowsOf(source).filter((row) => row?.type === STUDY_CONSENT_TYPE && studyConsentInCompany(row, source, companyId));
  const approved = rows.find((row) => otherRequestStatus(row) === "approved") || null;
  if (approved) {
    return { status: "approved", request: approved };
  }
  const pending = rows.find((row) => {
    const status = otherRequestStatus(row);
    return status === "pending" || status === "pending_manager";
  }) || null;
  if (pending) return { status: "pending", request: pending };
  const rejected = rows.find((row) => otherRequestStatus(row) === "rejected") || null;
  if (rejected) return { status: "rejected", request: rejected };
  return { status: "none", request: null };
}

export function hasIrrevocableStudyConsent(source, companyId) {
  return studyConsentState(source, companyId).status === "approved";
}

function isStoredRequestFile(file) {
  return !!(file && (String(file.url || "").trim() || String(file.name || "").trim()));
}

export function studyConsentEmployeeFileOf(request) {
  if (!request) return null;
  const file = request.file || (Array.isArray(request.files) ? request.files[0] : null) || request.senderFile;
  return isStoredRequestFile(file) ? file : null;
}

export function studyConsentApprovalFileOf(request) {
  if (!request) return null;
  const file = request.issuedFile || request.approvalFile;
  return isStoredRequestFile(file) ? file : null;
}

export function checkExamStudyConsentGate(request, extras = {}) {
  if (String(request?.type || "").trim().toLowerCase() !== "exam") return { ok: true };
  const companyId = extras.companyId || request?.companyId || extras.employee?.companyId;
  const sources = [extras.otherRequests, extras.employee, extras.profile, extras];
  if (sources.some((source) => hasIrrevocableStudyConsent(source, companyId))) {
    return {
      ok: true,
      examLeaveTrack: EXAM_LEAVE_TRACK_PAID,
      reason: EXAM_LEAVE_TRACK_PAID_AR,
      reasonEn: EXAM_LEAVE_TRACK_PAID_EN,
    };
  }
  return {
    ok: true,
    examLeaveTrack: EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID,
    reason: EXAM_LEAVE_TRACK_FALLBACK_AR,
    reasonEn: EXAM_LEAVE_TRACK_FALLBACK_EN,
    notice: true,
    productGate: true,
  };
}

export function checkRevokeStudyConsentGate(request, nextStatus) {
  if (request?.type !== STUDY_CONSENT_TYPE) return { ok: true };
  if (otherRequestStatus(request) !== "approved") return { ok: true };
  if (String(nextStatus || "") === "approved") return { ok: true };
  return {
    ok: false,
    error: "STUDY_CONSENT_IRREVOCABLE",
    reason: STUDY_CONSENT_IRREVOCABLE_AR,
    reasonEn: STUDY_CONSENT_IRREVOCABLE_EN,
    productGate: true,
  };
}

export const REJECT_REASON_REQUIRED_AR = "اكتب سبب الرفض — يُحفظ في سجل التدقيق.";
export const REJECT_REASON_REQUIRED_EN = "Write why it is refused — it is stored on the audit trail.";
export const REQUEST_REFUSE_REASON_MIN = 4;

export function namedRefuseReason(note) {
  return String(note || "").trim();
}

/** Management refuse of an employee request always names why — the reason is the audit row. */
export function checkRefuseRequestReasonGate(note, extras = {}) {
  const reason = namedRefuseReason(note ?? extras.note ?? extras.reason ?? extras.reviewNote);
  if (reason.length >= REQUEST_REFUSE_REASON_MIN) return { ok: true, reason };
  return {
    ok: false,
    error: "REJECT_REASON_REQUIRED",
    reason: extras.messageAr || REJECT_REASON_REQUIRED_AR,
    reasonEn: extras.messageEn || REJECT_REASON_REQUIRED_EN,
  };
}

export function requestRefuseCite(request = {}) {
  const type = String(request?.type || "").trim();
  const article = String(request?.article || "").trim();
  const decisionId = String(request?.decisionId || "").trim();
  if (type === "night_consent" || type === NIGHT_FITNESS_TYPE || decisionId === "18632" || article === "18632") {
    return { article: "", decisionId: "18632" };
  }
  if (type === STUDY_CONSENT_TYPE || type === "exam") {
    return { article: article || "115", decisionId: "" };
  }
  if (article && article !== "18632") return { article, decisionId: "" };
  if (decisionId) return { article: "", decisionId };
  return { article: "", decisionId: "" };
}

export function requestAuditVerb(raw = "") {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "raise" || value === "raised" || value === "submit" || value === "submitted") return "raise";
  if (value === "approve" || value === "approved" || value === "yes") return "approve";
  if (value === "refuse" || value === "refused" || value === "reject" || value === "rejected" || value === "no") return "refuse";
  if (value === "withdraw" || value === "withdrawn" || value === "cancel" || value === "cancelled") return "withdraw";
  if (value === "agree" || value === "agreed") return "agree";
  if (value === "revise") return "revise";
  return "";
}

export function requestAuditEventType(verb = "") {
  const key = requestAuditVerb(verb);
  if (key === "raise") return "raised";
  if (key === "approve") return "approved";
  if (key === "refuse") return "refused";
  if (key === "withdraw") return "withdrawn";
  if (key === "agree") return "agreed";
  if (key === "revise") return "revise";
  return String(verb || "event").trim() || "event";
}

export function requestAuditAction(request = {}, family = "", verb = "refuse") {
  const type = String(request?.type || "").trim();
  const key = requestAuditVerb(verb) || "refuse";
  if (key === "refuse") {
    if (type === "night_consent") return "night_consent_refused";
    if (type === "written_consent") return "written_consent_refused";
    if (type === STUDY_CONSENT_TYPE) return "study_consent_refused";
    if (type === NIGHT_FITNESS_TYPE) return "night_fitness_refused";
    if (family === "leave" || type === "exam") return "leave_request_rejected";
    return "other_request_rejected";
  }
  if (type === "night_consent") {
    if (key === "agree") return "night_consent_recorded";
    if (key === "withdraw") return "night_consent_withdrawn";
    if (key === "raise") return "night_consent_raised";
    return `night_consent_${key}`;
  }
  if (type === "written_consent") {
    if (key === "agree") return "written_consent_signed";
    if (key === "raise") return "written_consent_raised";
    return `written_consent_${key}`;
  }
  if (type === STUDY_CONSENT_TYPE) return `study_consent_${key === "raise" ? "raised" : key === "approve" ? "approved" : key}`;
  if (type === NIGHT_FITNESS_TYPE) return `night_fitness_${key === "raise" ? "raised" : key === "approve" ? "approved" : key}`;
  if (family === "leave" || type === "exam") {
    if (key === "raise") return "leave_request_raised";
    if (key === "approve") return "leave_request_approved";
    if (key === "withdraw") return "leave_request_withdrawn";
    return `leave_request_${key}`;
  }
  if (key === "raise") return "other_request_raised";
  if (key === "approve") return "other_request_approved";
  if (key === "withdraw") return "other_request_withdrawn";
  return `other_request_${key}`;
}

export function requestRefuseAuditAction(request = {}, family = "") {
  return requestAuditAction(request, family, "refuse");
}

export function appendRequestAudit(request, audit) {
  const trail = Array.isArray(request?.auditTrail) ? request.auditTrail.filter(Boolean) : [];
  if (!audit) return trail;
  const eventType = audit.eventType || requestAuditEventType(audit.verb || audit.action) || "event";
  return [...trail, { ...audit, type: eventType }];
}

export function appendRequestRefuseAudit(request, audit) {
  return appendRequestAudit(request, audit ? { ...audit, eventType: "refused" } : audit);
}

export function hasRequestAudit(request, verb = "") {
  const trail = Array.isArray(request?.auditTrail) ? request.auditTrail : [];
  const want = requestAuditVerb(verb);
  return trail.some((row) => {
    const got = requestAuditVerb(row?.type || row?.verb || row?.action);
    if (want && got !== want) return false;
    return !!(String(row?.performedBy || row?.actorName || "").trim() && (row?.type || row?.action));
  });
}

export function hasRequestRefuseAudit(request) {
  const trail = Array.isArray(request?.auditTrail) ? request.auditTrail : [];
  return trail.some((row) => (
    (row?.type === "refused" || /refus|reject/i.test(String(row?.action || "")))
    && String(row.reason || "").trim()
    && String(row.performedBy || row.actorName || "").trim()
  ));
}

function requestAuditDetails({ who, verb, type, subject, citeBit, reason }) {
  const key = requestAuditVerb(verb) || "refuse";
  const named = String(reason || "").trim();
  if (key === "refuse") return `${who} refused ${type} on ${subject}'s file${citeBit}: ${named}`.slice(0, 1000);
  const verbEn = key === "raise" ? "raised" : key === "approve" ? "approved" : key === "withdraw" ? "withdrew" : key === "agree" ? "agreed" : key === "revise" ? "returned" : key;
  const reasonBit = named ? `: ${named}` : "";
  return `${who} ${verbEn} ${type} on ${subject}'s file${citeBit}${reasonBit}`.slice(0, 1000);
}

/** Durable AuditLog row for any request act — who, whose file, type, reason when refuse, cite. */
export function buildRequestAudit({
  actor,
  employeeId,
  employeeName,
  request,
  family,
  verb,
  reason,
  at,
} = {}) {
  const key = requestAuditVerb(verb) || "refuse";
  const named = key === "refuse" ? namedRefuseReason(reason) : String(reason || "").trim();
  const type = String(request?.type || family || "request").trim();
  const cite = requestRefuseCite({ ...request, type });
  const who = String(actor || "").trim() || "unknown";
  const subject = String(employeeName || employeeId || "").trim() || "employee";
  const citeBit = cite.article ? ` · article ${cite.article}` : cite.decisionId ? ` · decision ${cite.decisionId}` : "";
  const when = at || new Date().toISOString();
  return {
    action: requestAuditAction({ type }, family, key),
    eventType: requestAuditEventType(key),
    verb: key,
    performedBy: who,
    actorName: who,
    reason: named,
    details: requestAuditDetails({ who, verb: key, type, subject, citeBit, reason: named }),
    oldValue: String(employeeId || ""),
    newValue: JSON.stringify({
      type,
      requestId: request?.id || null,
      employeeId: employeeId || null,
      article: cite.article || null,
      decisionId: cite.decisionId || null,
      verb: key,
      at: when,
    }).slice(0, 2000),
    at: when,
    employeeId: String(employeeId || ""),
    type,
    article: cite.article,
    decisionId: cite.decisionId,
    requestId: request?.id || "",
  };
}

export function buildRequestRefuseAudit(args = {}) {
  const row = buildRequestAudit({ ...args, verb: "refuse" });
  return { ...row, action: requestRefuseAuditAction({ type: row.type }, args.family) };
}

export function requestAuditFileLog(audit, ar = true) {
  const key = requestAuditVerb(audit?.verb || audit?.type || audit?.action);
  const cite = audit?.article
    ? (ar ? ` · المادة ${audit.article}` : ` · Art. ${audit.article}`)
    : audit?.decisionId
      ? (ar ? ` · قرار ${audit.decisionId}` : ` · Decision ${audit.decisionId}`)
      : "";
  const kind = audit?.type || "";
  const reasonBit = audit?.reason ? `: ${audit.reason}` : "";
  const text = ar
    ? (key === "raise" ? `رُفع طلب ${kind}${cite}`
      : key === "approve" ? `اعتُمد طلب ${kind}${cite}`
      : key === "withdraw" ? `سُحب طلب ${kind}${cite}`
      : key === "agree" ? `وُافق على طلب ${kind}${cite}`
      : key === "revise" ? `أُعيد طلب ${kind} للتعديل${cite}${reasonBit}`
      : `رُفض طلب ${kind}${cite}${reasonBit}`)
    : (key === "raise" ? `Request ${kind} raised${cite}`
      : key === "approve" ? `Request ${kind} approved${cite}`
      : key === "withdraw" ? `Request ${kind} withdrawn${cite}`
      : key === "agree" ? `Request ${kind} agreed${cite}`
      : key === "revise" ? `Request ${kind} returned${cite}${reasonBit}`
      : `Request ${kind} refused${cite}${reasonBit}`);
  return {
    text,
    by: audit?.performedBy || audit?.actorName || "",
    at: audit?.at || "",
    dot: key === "approve" || key === "agree" ? "#137A49" : key === "raise" ? "#14213D" : key === "withdraw" || key === "revise" ? "#4B5567" : "#8A1C2B",
    type: key === "refuse" ? "request_refused" : `request_${requestAuditEventType(key)}`,
    reason: audit?.reason || "",
    article: audit?.article || "",
    decisionId: audit?.decisionId || "",
    verb: key,
    action: audit?.action || "",
    requestId: audit?.requestId || "",
  };
}

export function requestRefuseFileLog(audit, ar = true) {
  return requestAuditFileLog({ ...audit, verb: "refuse", type: audit?.type }, ar);
}

export function reconstructRequestAudit(row, employee, family) {
  const trail = Array.isArray(row?.auditTrail) ? row.auditTrail.filter(Boolean) : [];
  if (trail.length) {
    return trail.map((event) => buildRequestAudit({
      actor: event.performedBy || event.actorName || row.reviewedBy,
      employeeId: employee?.id,
      employeeName: employee?.name,
      request: row,
      family,
      verb: event.verb || event.type || event.action,
      reason: event.reason,
      at: event.at,
    }));
  }
  const rows = [];
  if (row?.createdAt) {
    rows.push(buildRequestAudit({
      actor: row.requestedBy || row.recordedBy || employee?.name,
      employeeId: employee?.id,
      employeeName: employee?.name,
      request: row,
      family,
      verb: "raise",
      reason: row.reason || "",
      at: row.createdAt,
    }));
  }
  const status = String(row?.status || "");
  if (status === "approved" || status === "yes") {
    rows.push(buildRequestAudit({
      actor: row.reviewedBy || row.answeredBy || row.acknowledgedBy,
      employeeId: employee?.id,
      employeeName: employee?.name,
      request: row,
      family,
      verb: status === "yes" || row.decision === "agree" ? "agree" : "approve",
      reason: row.reviewNote || row.reply || "",
      at: row.reviewedAt || row.answeredAt || row.approvedAt || row.decidedAt,
    }));
  }
  if (status === "rejected" || status === "no") {
    const reason = namedRefuseReason(row.reviewNote || row.reply || row.rejectReason || row.attestation);
    if (reason) {
      rows.push(buildRequestAudit({
        actor: row.reviewedBy || row.answeredBy || row.acknowledgedBy,
        employeeId: employee?.id,
        employeeName: employee?.name,
        request: row,
        family,
        verb: row.decision === "refuse" || status === "no" ? "refuse" : "refuse",
        reason,
        at: row.reviewedAt || row.answeredAt || row.decidedAt,
      }));
    }
  }
  if (status === "withdrawn") {
    rows.push(buildRequestAudit({
      actor: row.reviewedBy || row.withdrawnBy || employee?.name,
      employeeId: employee?.id,
      employeeName: employee?.name,
      request: row,
      family,
      verb: "withdraw",
      reason: row.reviewNote || row.attestation || "",
      at: row.withdrawnAt || row.reviewedAt,
    }));
  }
  if (status === "revise") {
    rows.push(buildRequestAudit({
      actor: row.reviewedBy,
      employeeId: employee?.id,
      employeeName: employee?.name,
      request: row,
      family,
      verb: "revise",
      reason: row.reviewNote || "",
      at: row.reviewedAt,
    }));
  }
  return rows;
}

export function collectRequestAuditLogs(employee, ar = true) {
  const logs = [];
  for (const row of employee?.leaveRequests || []) {
    for (const audit of reconstructRequestAudit(row, employee, "leave")) {
      logs.push(requestAuditFileLog(audit, ar));
    }
  }
  for (const row of employee?.otherRequests || []) {
    for (const audit of reconstructRequestAudit(row, employee, "other")) {
      logs.push(requestAuditFileLog(audit, ar));
    }
  }
  return logs;
}

export function collectRequestRefuseLogs(employee, ar = true) {
  return collectRequestAuditLogs(employee, ar).filter((row) => row.type === "request_refused" || row.verb === "refuse");
}

export function checkRejectStudyConsentGate(request, note) {
  if (request?.type !== STUDY_CONSENT_TYPE) return { ok: true };
  if (otherRequestStatus(request) === "approved") return checkRevokeStudyConsentGate(request, "rejected");
  return checkRefuseRequestReasonGate(note, {
    messageAr: "اكتب سبب رفض طلب الموافقة الدراسية.",
    messageEn: "Write why the study-consent request is refused.",
  });
}

const STUDY_ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function studyConsentTextOf(raw) {
  if (raw == null || raw === "") return "";
  if (Array.isArray(raw)) return "";
  if (typeof raw === "object") {
    return String(raw.name || raw.title || raw.ar || raw.value || "").trim();
  }
  return String(raw).trim();
}

function studyConsentDayOf(raw) {
  if (raw == null || raw === "") return "";
  if (Array.isArray(raw)) return "";
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const day = String(raw).trim().slice(0, 10);
  return STUDY_ISO_DAY.test(day) ? day : "";
}

function firstStudyConsentText(...values) {
  for (const raw of values) {
    const text = studyConsentTextOf(raw);
    if (text.length >= 2 && text !== "[object Object]") return text;
  }
  return "";
}

function firstStudyConsentDay(...values) {
  for (const raw of values) {
    const day = studyConsentDayOf(raw);
    if (day) return day;
  }
  return "";
}

/** Own request fields only — first filled alias. Never walks empty siblings or otherRequests. */
export function resolveStudyConsentFields(input = {}) {
  const own = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const nested = own.study && typeof own.study === "object" && !Array.isArray(own.study) ? own.study : {};
  const program = firstStudyConsentText(own.program, own.programName, own.field, nested.program);
  const institution = firstStudyConsentText(
    own.institution,
    own.institutionName,
    own.school,
    own.college,
    own.university,
    nested.institution,
  );
  const startDate = firstStudyConsentDay(own.startDate, own.date, own.studyStart, nested.startDate, nested.date);
  return {
    program,
    institution,
    startDate,
    file: studyConsentEmployeeFileOf(own),
  };
}

export function composeStudyConsentReason(input = {}) {
  const fields = resolveStudyConsentFields(input);
  const program = fields.program;
  const institution = fields.institution;
  const start = fields.startDate;
  const note = String(input.reason || input.note || "").trim();
  return [program && `البرنامج: ${program}`, institution && `المؤسسة: ${institution}`, start && `البداية: ${start}`, note].filter(Boolean).join(" — ");
}

export function checkSubmitStudyConsentGate(input = {}) {
  const { program, institution, startDate } = resolveStudyConsentFields(input);
  if (program.length < 2) {
    return {
      ok: false,
      error: "PROGRAM_REQUIRED",
      reason: "اكتب البرنامج أو التخصص.",
      reasonEn: "Write the program or field of study.",
    };
  }
  if (institution.length < 2) {
    return {
      ok: false,
      error: "INSTITUTION_REQUIRED",
      reason: "اكتب اسم المؤسسة التعليمية.",
      reasonEn: "Write the educational institution.",
    };
  }
  if (!STUDY_ISO_DAY.test(startDate)) {
    return {
      ok: false,
      error: "DATE_REQUIRED",
      reason: "حدد تاريخ بداية الدراسة.",
      reasonEn: "Set the study start date.",
    };
  }
  const employeeFile = studyConsentEmployeeFileOf(input);
  if (!employeeFile) {
    return {
      ok: false,
      error: "STUDY_CONSENT_FILE_REQUIRED",
      reason: STUDY_CONSENT_FILE_REQUIRED_AR,
      reasonEn: STUDY_CONSENT_FILE_REQUIRED_EN,
    };
  }
  if (input.status === "approved" || input.directApprove) {
    const issued = studyConsentApprovalFileOf(input);
    if (!issued) {
      return {
        ok: false,
        error: "STUDY_CONSENT_APPROVAL_FILE_REQUIRED",
        reason: STUDY_CONSENT_APPROVAL_FILE_REQUIRED_AR,
        reasonEn: STUDY_CONSENT_APPROVAL_FILE_REQUIRED_EN,
        productGate: true,
      };
    }
  }
  const companyId = input.companyId || input.employee?.companyId;
  const state = studyConsentState(input.otherRequests || input.employee, companyId);
  if (state.status === "approved") {
    return {
      ok: false,
      error: "STUDY_CONSENT_ALREADY_APPROVED",
      reason: "الموافقة الدراسية مسجّلة ونهائية — لا يُعاد طلبها.",
      reasonEn: "Study consent is already recorded and final — it is not requested again.",
      productGate: true,
    };
  }
  if (state.status === "pending") {
    return {
      ok: false,
      error: "STUDY_CONSENT_PENDING",
      reason: "يوجد طلب موافقة دراسية معلّق بانتظار قرار المنشأة.",
      reasonEn: "A study-consent request is already pending the establishment's decision.",
    };
  }
  return {
    ok: true,
    program,
    institution,
    startDate,
    file: employeeFile,
    issuedFile: studyConsentApprovalFileOf(input) || undefined,
    reason: composeStudyConsentReason({ ...input, program, institution, startDate }),
  };
}

export function checkApproveStudyConsentGate(request) {
  if (request?.type !== STUDY_CONSENT_TYPE) return { ok: true };
  if (studyConsentApprovalFileOf(request)) return { ok: true };
  return {
    ok: false,
    error: "STUDY_CONSENT_APPROVAL_FILE_REQUIRED",
    reason: STUDY_CONSENT_APPROVAL_FILE_REQUIRED_AR,
    reasonEn: STUDY_CONSENT_APPROVAL_FILE_REQUIRED_EN,
    productGate: true,
  };
}

function isoRequestDay(raw) {
  const day = String(raw || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

export function nightFitnessEmployeeFileOf(request) {
  if (!request) return null;
  const file = request.file || (Array.isArray(request.files) ? request.files[0] : null) || request.senderFile;
  return isStoredRequestFile(file) ? file : null;
}

export function nightFitnessIssuedAtOf(request, extras = {}) {
  const file = nightFitnessEmployeeFileOf(request);
  for (const raw of [
    request?.from,
    extras.from,
    request?.examDate,
    request?.issuedAt,
    request?.date,
    extras.issuedAt,
    extras.examDate,
    extras.reviewedAt,
    file?.from,
    file?.issuedAt,
    file?.issued,
    file?.date,
    file?.at,
  ]) {
    const day = isoRequestDay(raw);
    if (day) return day;
  }
  return "";
}

export function isNightFitnessPermanent(input = {}) {
  return input?.permanent === true || input?.permanent === "true" || input?.until === "permanent" || input?.to === "permanent";
}

/** فترة: from + to required. دائم: no end date. Never invents a yearly expiry. */
export function resolveNightFitnessPeriod(input = {}) {
  const permanent = isNightFitnessPermanent(input);
  const from = isoRequestDay(input.from || input.examDate || input.issuedAt || input.date || input.startDate);
  const to = isoRequestDay(input.to || input.until || input.endDate);
  if (permanent) {
    return {
      ok: true,
      permanent: true,
      from: from || undefined,
      to: "",
      examDate: from || undefined,
      until: "",
    };
  }
  if (!from || !to) {
    return {
      ok: false,
      error: "NIGHT_FITNESS_PERIOD_REQUIRED",
      reason: NIGHT_FITNESS_PERIOD_REQUIRED_AR,
      reasonEn: NIGHT_FITNESS_PERIOD_REQUIRED_EN,
    };
  }
  if (from > to) {
    return {
      ok: false,
      error: "NIGHT_FITNESS_PERIOD_INVALID",
      reason: NIGHT_FITNESS_PERIOD_INVALID_AR,
      reasonEn: NIGHT_FITNESS_PERIOD_INVALID_EN,
    };
  }
  return {
    ok: true,
    permanent: false,
    from,
    to,
    examDate: from,
    until: to,
  };
}

export function nightFitnessState(source, companyId) {
  const rows = studyConsentRowsOf(source).filter((row) => row?.type === NIGHT_FITNESS_TYPE && studyConsentInCompany(row, source, companyId));
  const pending = rows.find((row) => {
    const status = otherRequestStatus(row);
    return status === "pending" || status === "pending_manager";
  }) || null;
  if (pending) return { status: "pending", request: pending };
  const approved = rows.find((row) => otherRequestStatus(row) === "approved") || null;
  if (approved) return { status: "approved", request: approved };
  const rejected = rows.find((row) => otherRequestStatus(row) === "rejected") || null;
  if (rejected) return { status: "rejected", request: rejected };
  return { status: "none", request: null };
}

export function composeNightFitnessReason(input = {}) {
  const period = input.ok === true && input.permanent != null ? input : resolveNightFitnessPeriod(input);
  const from = period.from || period.examDate || isoRequestDay(input.from || input.examDate || input.date);
  const to = period.to || period.until || isoRequestDay(input.to || input.until);
  const note = String(input.reason || input.note || "").trim();
  const span = period.permanent
    ? NIGHT_FITNESS_PERMANENT_AR
    : (from && to ? `${from} → ${to}` : from);
  return [NIGHT_FITNESS_SUBTITLE_AR, span, note].filter(Boolean).join(" — ");
}

function isNightFitnessManagerRaise(input = {}) {
  if (input.lane === "manage" || input.manageFiled === true) return true;
  if (String(input.status || "") === "approved") return true;
  const actorId = String(input.actorId || input.requestedById || input.recordedById || "").trim();
  const subjectId = String(input.employee?.id || input.employeeId || "").trim();
  return !!(actorId && subjectId && actorId !== subjectId);
}

export function checkSubmitNightFitnessGate(input = {}) {
  if (isNightFitnessManagerRaise(input)) {
    return {
      ok: false,
      error: "NIGHT_FITNESS_EMPLOYEE_ONLY",
      reason: NIGHT_FITNESS_EMPLOYEE_ONLY_AR,
      reasonEn: NIGHT_FITNESS_EMPLOYEE_ONLY_EN,
    };
  }
  const employeeFile = nightFitnessEmployeeFileOf(input);
  if (!employeeFile) {
    return {
      ok: false,
      error: "NIGHT_FITNESS_FILE_REQUIRED",
      reason: NIGHT_FITNESS_FILE_REQUIRED_AR,
      reasonEn: NIGHT_FITNESS_FILE_REQUIRED_EN,
    };
  }
  const companyId = input.companyId || input.employee?.companyId;
  const state = nightFitnessState(input.otherRequests || input.employee, companyId);
  if (state.status === "pending") {
    return {
      ok: false,
      error: "NIGHT_FITNESS_PENDING",
      reason: "يوجد طلب لياقة ليلية معلّق بانتظار قرار المنشأة.",
      reasonEn: "A night-fitness request is already pending the establishment's decision.",
    };
  }
  const period = resolveNightFitnessPeriod(input);
  if (!period.ok) return period;
  return {
    ok: true,
    file: employeeFile,
    from: period.from || "",
    to: period.permanent ? "" : (period.to || ""),
    examDate: period.examDate,
    until: period.permanent ? "" : (period.until || period.to || ""),
    permanent: period.permanent,
    reason: composeNightFitnessReason({ ...input, ...period }),
  };
}

export function checkApproveNightFitnessGate(request) {
  if (request?.type !== NIGHT_FITNESS_TYPE) return { ok: true };
  if (nightFitnessEmployeeFileOf(request)) return { ok: true };
  return {
    ok: false,
    error: "NIGHT_FITNESS_FILE_REQUIRED",
    reason: NIGHT_FITNESS_FILE_REQUIRED_AR,
    reasonEn: NIGHT_FITNESS_FILE_REQUIRED_EN,
  };
}

export function checkRejectNightFitnessGate(request, note) {
  if (request?.type !== NIGHT_FITNESS_TYPE) return { ok: true };
  return checkRefuseRequestReasonGate(note, {
    messageAr: "اكتب سبب رفض طلب اللياقة الليلية.",
    messageEn: "Write why the night-fitness request is refused.",
  });
}

/** Writes the same profile.nightMedicalReport + nightMedicalIssuedAt the 18632 card already reads. */
export function stampNightFitnessOnEmployee(employee, request, extras = {}) {
  if (!employee || request?.type !== NIGHT_FITNESS_TYPE) return { ok: true, skipped: true };
  if (request.fitnessApplied) return { ok: true, skipped: true };
  const file = nightFitnessEmployeeFileOf(request);
  if (!file) {
    return {
      ok: false,
      error: "NIGHT_FITNESS_FILE_REQUIRED",
      reason: NIGHT_FITNESS_FILE_REQUIRED_AR,
      reasonEn: NIGHT_FITNESS_FILE_REQUIRED_EN,
    };
  }
  const period = resolveNightFitnessPeriod({
    ...request,
    from: extras.from || request.from,
    to: extras.to || request.to,
    examDate: extras.examDate || extras.issuedAt || request.examDate,
    until: extras.until || request.until,
    permanent: extras.permanent ?? request.permanent,
  });
  if (!period.ok) return period;
  const from = period.from || period.examDate || nightFitnessIssuedAtOf(request, extras) || isoRequestDay(extras.reviewedAt);
  if (!period.permanent && !from) {
    return {
      ok: false,
      error: "NIGHT_FITNESS_PERIOD_REQUIRED",
      reason: NIGHT_FITNESS_PERIOD_REQUIRED_AR,
      reasonEn: NIGHT_FITNESS_PERIOD_REQUIRED_EN,
    };
  }
  const permanent = period.permanent;
  const to = permanent ? "" : (period.to || period.until || "");
  const issued = from || isoRequestDay(extras.reviewedAt) || "";
  const at = file.at || extras.reviewedAt || new Date().toISOString();
  employee.profile = {
    ...(employee.profile || {}),
    nightMedicalReport: {
      url: String(file.url || ""),
      name: String(file.name || ""),
      type: String(file.type || "file"),
      from: issued || "",
      to,
      permanent,
      issuedAt: issued,
      until: to,
      at,
    },
    nightMedicalIssuedAt: issued,
    nightMedicalPermanent: permanent || undefined,
  };
  request.fitnessApplied = true;
  request.from = issued || request.from || "";
  request.to = to;
  request.examDate = request.examDate || issued;
  request.until = to;
  request.permanent = permanent;
  return { ok: true, from: issued, to, issuedAt: issued, until: to, permanent, file: employee.profile.nightMedicalReport };
}

function isOtAssignmentRow(request) {
  return request?.type === "overtime" && (request.assignment === true || request.source === "assignment");
}

export function isPendingOtherRequest(request) {
  return OPEN_OTHER.has(otherRequestStatus(request));
}

export function isArchivedOtherRequest(request) {
  return ARCHIVED_OTHER.has(otherRequestStatus(request));
}

export function isManagerDecideOtherRequest(request) {
  if (!isPendingOtherRequest(request)) return false;
  if (request?.type === "night_consent" || request?.type === "written_consent") return false;
  if (isOtAssignmentRow(request)) return otherRequestStatus(request) === "pending_manager";
  return otherRequestStatus(request) === "pending" || otherRequestStatus(request) === "pending_manager";
}

export function flattenOtherRequests(employees = []) {
  return (employees || [])
    .flatMap((employee) => (employee.otherRequests || []).map((request) => ({ ...request, employee })))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function pendingOtherCount(employees = []) {
  return flattenOtherRequests(employees).filter(isPendingOtherRequest).length;
}

export function archivedOtherCount(employees = []) {
  return flattenOtherRequests(employees).filter(isArchivedOtherRequest).length;
}

export function pendingLeaveCount(employees = []) {
  return (employees || []).reduce(
    (n, employee) => n + (employee.leaveRequests || []).filter((request) => (request.status || "pending") === "pending").length,
    0,
  );
}

export function pendingRequestsCount(employees = []) {
  return pendingLeaveCount(employees) + pendingOtherCount(employees);
}

export function parseLeaveTopupDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const days = Math.round(n);
  if (days < 1 || Math.abs(n - days) > 1e-9) return null;
  return days;
}

export function checkLeaveTopupDaysGate(input) {
  const days = parseLeaveTopupDays(input?.days);
  if (days == null) {
    return {
      ok: false,
      error: "DAYS_INVALID",
      reason: "حدد عدد الأيام الإضافية — رقماً صحيحاً أكبر من صفر.",
      reasonEn: "Set the extra days — a whole number greater than zero.",
    };
  }
  if (days > LEAVE_TOPUP_MAX_DAYS) {
    return {
      ok: false,
      error: "DAYS_INVALID",
      reason: `لا يُطلب أكثر من ${LEAVE_TOPUP_MAX_DAYS} يوماً في الطلب الواحد.`,
      reasonEn: `A single request may not ask for more than ${LEAVE_TOPUP_MAX_DAYS} days.`,
    };
  }
  return { ok: true, days };
}

/**
 * Named gate for إدارة → إضافة رصيد.
 * Credits annual (leaveTotals) or discretionary (grant) without the employee raising leave.
 */
export function checkAdminLeaveCreditGate(input = {}) {
  if (input.canCredit === false) {
    return {
      ok: false,
      error: "ROLE_REQUIRED",
      reason: "إضافة الرصيد لمن يقرر على الطلبات فقط.",
      reasonEn: "Only managers who decide on requests may credit leave balance.",
    };
  }
  const pool = String(input.pool || "").trim();
  if (pool !== "annual" && pool !== "grant") {
    return {
      ok: false,
      error: "POOL_REQUIRED",
      reason: "اختر الرصيد السنوي أو الأيام التقديرية.",
      reasonEn: "Pick the annual balance or discretionary days.",
    };
  }
  const why = String(input.reason || "").trim();
  if (why.length < 3) {
    return {
      ok: false,
      error: "REASON_REQUIRED",
      reason: "اكتب سبب إضافة الرصيد.",
      reasonEn: "Write why the balance is being credited.",
    };
  }
  if (pool === "annual") {
    const daysGate = checkLeaveTopupDaysGate({ days: input.days });
    if (!daysGate.ok) return daysGate;
    return { ok: true, pool, days: daysGate.days, reason: why };
  }
  const n = Math.round(Number(input.days) || 0);
  if (!Number.isFinite(n) || n < 1) {
    return {
      ok: false,
      error: "DAYS_INVALID",
      reason: "حدد عدد الأيام — رقماً صحيحاً أكبر من صفر.",
      reasonEn: "Set the days — a whole number greater than zero.",
    };
  }
  if (n > 30) {
    return {
      ok: false,
      error: "DAYS_INVALID",
      reason: "لا تُضاف أكثر من 30 يوماً في المنحة الواحدة.",
      reasonEn: "A single grant may not add more than 30 days.",
    };
  }
  const used = grantDaysOf(input.profile);
  if (used + n > DISCRETIONARY_GRANT_CAP) {
    return {
      ok: false,
      error: "GRANT_CAP",
      reason: `يتجاوز سقف ${DISCRETIONARY_GRANT_CAP} أيام تقديرية في السنة — المتاح ${Math.max(0, DISCRETIONARY_GRANT_CAP - used)}.`,
      reasonEn: `Exceeds the ${DISCRETIONARY_GRANT_CAP}-day discretionary cap — ${Math.max(0, DISCRETIONARY_GRANT_CAP - used)} left.`,
      leftover: Math.max(0, DISCRETIONARY_GRANT_CAP - used),
    };
  }
  return { ok: true, pool, days: n, reason: why, leftover: Math.max(0, DISCRETIONARY_GRANT_CAP - used) };
}

/** Extra annual days after approve — same catalog field as the 21/30 statutory floor. */
export function incrementAnnualLeaveTotal(profile, extraDays, onDate) {
  const add = Number(extraDays);
  if (!Number.isFinite(add) || add <= 0) {
    return {
      ok: false,
      error: "DAYS_INVALID",
      reason: "حدد الأيام الإضافية — رقماً أكبر من صفر.",
      reasonEn: "Set the extra days — a number greater than zero.",
    };
  }
  const current = getLeaveTotal(profile, "annual", onDate);
  const nextTotal = Math.round(((current == null ? 0 : current) + add) * 1000) / 1000;
  return {
    ok: true,
    days: add,
    nextTotal,
    profile: {
      ...(profile || {}),
      leaveTotals: {
        ...(profile?.leaveTotals || {}),
        annual: nextTotal,
      },
    },
  };
}

export function nextAnnualLeaveTotal(profile, extraDays, onDate) {
  const add = parseLeaveTopupDays(extraDays) || 0;
  return incrementAnnualLeaveTotal(profile, add, onDate).nextTotal ?? add;
}

export function applyAnnualLeaveTopup(profile, extraDays, onDate) {
  const gate = checkLeaveTopupDaysGate({ days: extraDays });
  if (!gate.ok) return gate;
  return incrementAnnualLeaveTotal(profile, gate.days, onDate);
}

export function stampLeaveTopupOnEmployee(employee, request) {
  if (!employee || request?.type !== LEAVE_TOPUP_TYPE) return { ok: true, skipped: true };
  if (request.balanceApplied) return { ok: true, skipped: true };
  const applied = applyAnnualLeaveTopup(employee.profile, request.days);
  if (!applied.ok) return applied;
  employee.profile = applied.profile;
  request.balanceApplied = true;
  request.appliedDays = applied.days;
  request.annualTotalAfter = applied.nextTotal;
  return { ok: true, days: applied.days, nextTotal: applied.nextTotal };
}

export function hasPendingLeaveTopup(otherRequests = []) {
  return (otherRequests || []).some((row) => row?.type === LEAVE_TOPUP_TYPE && otherRequestStatus(row) === "pending");
}

export function checkSubmitOtherRequestGate(input) {
  const type = OTHER_REQUEST_TYPES.some((row) => row.key === input?.type) ? input.type : "";
  if (!type) {
    return { ok: false, error: "TYPE_REQUIRED", reason: "اختر نوع الطلب.", reasonEn: "Choose a request type." };
  }
  if (type === STUDY_CONSENT_TYPE) {
    return checkSubmitStudyConsentGate(input);
  }
  if (type === NIGHT_FITNESS_TYPE) {
    return checkSubmitNightFitnessGate(input);
  }
  const reason = String(input?.reason || "").trim();
  if (reason.length < 3) {
    return { ok: false, error: "REASON_REQUIRED", reason: "اكتب سبب الطلب.", reasonEn: "Write why this request is needed." };
  }
  if (type === LEAVE_TOPUP_TYPE) {
    const daysGate = checkLeaveTopupDaysGate(input);
    if (!daysGate.ok) return daysGate;
    return { ok: true, days: daysGate.days };
  }
  if ((type === "overtime" || type === "permission" || type === "shift_change" || type === "manual_punch" || type === "checkout_fix") && !String(input?.date || "").trim()) {
    return { ok: false, error: "DATE_REQUIRED", reason: "حدد تاريخ الطلب.", reasonEn: "Set the request date." };
  }
  if (type === "manual_punch" || type === "checkout_fix") {
    if (!parsePunchClock(input?.time)) {
      return {
        ok: false,
        error: "TIME_REQUIRED",
        reason: type === "checkout_fix" ? "حدد وقت الانصراف." : "حدد وقت الحضور.",
        reasonEn: type === "checkout_fix" ? "Set the checkout time." : "Set the check-in time.",
      };
    }
    if (input?.employee || input?.attendance) {
      const punch = checkPunchRecordGate({
        type,
        employee: input.employee,
        attendance: input.attendance,
        date: input.date,
        time: input.time,
        reason,
        requireTime: true,
      });
      if (!punch.ok) return punch;
    }
  }
  if (type === "night_consent" && !input?.auto && reason.length < 8) {
    return {
      ok: false,
      error: "CONSENT_TEXT_REQUIRED",
      reason: "اكتب نص الموافقة الخطية على الاستمرار في العمل الليلي.",
      reasonEn: "Write the consent to remain on night work.",
    };
  }
  if (isLetterSignableType(type)) {
    const signGate = checkRaiseSignableGate({
      type,
      file: input?.file || input?.files?.[0],
      paper: input?.paper || input?.files?.[1],
    });
    if (!signGate.ok) return signGate;
  }
  return { ok: true };
}

/** Decide/issue gate — letters: manager-issued file, or the raise paper. Note is never required. */
export function checkApproveOtherRequestGate(request) {
  if (!request) {
    return {
      ok: false,
      error: "REQUEST_NOT_FOUND",
      reason: "الطلب غير موجود.",
      reasonEn: "That request was not found.",
    };
  }
  const status = otherRequestStatus(request);
  if (!OPEN_OTHER.has(status) && status !== "pending") {
    return {
      ok: false,
      error: "NOT_PENDING",
      reason: "لا يمكن اعتماد طلب غير معلّق.",
      reasonEn: "Only a pending request can be approved.",
    };
  }
  if (isLetterSignableType(request.type)) {
    const issued = request.issuedFile;
    if (issued?.name || issued?.url) {
      return checkIssuedLetterFileGate(issued);
    }
    const raiseGate = checkRaiseSignableGate({
      type: request.type,
      file: request.file || request.files?.[0] || request.senderFile,
      paper: request.paper || request.files?.[1],
    });
    if (raiseGate.ok) return raiseGate;
    return {
      ok: false,
      error: raiseGate.error || "ISSUED_OR_PAPER_REQUIRED",
      reason: raiseGate.reason || "أرفق ملف الإصدار، أو اعتمد النسخة الموقّعة المرفوعة مع الطلب.",
      reasonEn: raiseGate.reasonEn || "Attach the issued file, or approve the signed copy already raised.",
    };
  }
  if (request.type === STUDY_CONSENT_TYPE) {
    return checkApproveStudyConsentGate(request);
  }
  if (request.type === NIGHT_FITNESS_TYPE) {
    return checkApproveNightFitnessGate(request);
  }
  if (request.type === LEAVE_TOPUP_TYPE) {
    return checkLeaveTopupDaysGate(request);
  }
  return { ok: true };
}

/** Unanswered night consent stays with the worker — manager silence does not make it their decision. */
export function pendingManagerDecideCount(employees = []) {
  return pendingLeaveCount(employees) + flattenOtherRequests(employees).filter(isManagerDecideOtherRequest).length;
}
