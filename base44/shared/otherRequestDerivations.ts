/** Study consent — mirrors src/lib/otherRequestDerivations.js. */

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

export type StudyConsentFile = {
  name?: string;
  url?: string;
  at?: string;
  size?: number;
  type?: string;
  hash?: string;
};

export type StudyConsentLike = {
  type?: string;
  status?: string;
  companyId?: string;
  program?: string;
  programName?: string;
  field?: string;
  institution?: string;
  institutionName?: string;
  school?: string;
  college?: string;
  university?: string;
  startDate?: string;
  date?: string;
  studyStart?: string;
  study?: { program?: string; institution?: string; startDate?: string; date?: string };
  reason?: string;
  approvedAt?: string;
  approvedBy?: string;
  file?: StudyConsentFile;
  files?: StudyConsentFile[];
  senderFile?: StudyConsentFile;
  issuedFile?: StudyConsentFile;
  approvalFile?: StudyConsentFile;
};

export type StudyConsentSource = StudyConsentLike[] | {
  companyId?: string;
  otherRequests?: StudyConsentLike[];
} | null | undefined;

function otherRequestStatus(request: StudyConsentLike | null | undefined) {
  return request?.status || "pending";
}

function studyConsentRowsOf(source: StudyConsentSource): StudyConsentLike[] {
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.otherRequests)) return source.otherRequests;
  return [];
}

function studyConsentCompanyOf(row: StudyConsentLike | null | undefined, source: StudyConsentSource) {
  const fromSource = source && !Array.isArray(source) ? source.companyId : "";
  return String(row?.companyId || fromSource || "").trim();
}

function studyConsentInCompany(row: StudyConsentLike, source: StudyConsentSource, companyId?: string) {
  const fromSource = source && !Array.isArray(source) ? source.companyId : "";
  const want = String(companyId || fromSource || "").trim();
  const got = studyConsentCompanyOf(row, source);
  if (want && got && want !== got) return false;
  return true;
}

export function studyConsentState(source: StudyConsentSource, companyId?: string) {
  const rows = studyConsentRowsOf(source).filter((row) => row?.type === STUDY_CONSENT_TYPE && studyConsentInCompany(row, source, companyId));
  const approved = rows.find((row) => otherRequestStatus(row) === "approved") || null;
  if (approved) return { status: "approved" as const, request: approved };
  const pending = rows.find((row) => {
    const status = otherRequestStatus(row);
    return status === "pending" || status === "pending_manager";
  }) || null;
  if (pending) return { status: "pending" as const, request: pending };
  const rejected = rows.find((row) => otherRequestStatus(row) === "rejected") || null;
  if (rejected) return { status: "rejected" as const, request: rejected };
  return { status: "none" as const, request: null };
}

export function hasIrrevocableStudyConsent(source: StudyConsentSource, companyId?: string) {
  return studyConsentState(source, companyId).status === "approved";
}

function isStoredRequestFile(file?: StudyConsentFile | null) {
  return !!(file && (String(file.url || "").trim() || String(file.name || "").trim()));
}

export function studyConsentEmployeeFileOf(request?: StudyConsentLike | null) {
  if (!request) return null;
  const file = request.file || (Array.isArray(request.files) ? request.files[0] : null) || request.senderFile;
  return isStoredRequestFile(file) ? file || null : null;
}

export function studyConsentApprovalFileOf(request?: StudyConsentLike | null) {
  if (!request) return null;
  const file = request.issuedFile || request.approvalFile;
  return isStoredRequestFile(file) ? file || null : null;
}

export type ExamConsentExtras = {
  companyId?: string;
  otherRequests?: StudyConsentLike[];
  employee?: { companyId?: string; otherRequests?: StudyConsentLike[] };
  profile?: { companyId?: string; otherRequests?: StudyConsentLike[] };
};

export function checkExamStudyConsentGate(request: { type?: string; companyId?: string } | null | undefined, extras: ExamConsentExtras = {}) {
  if (String(request?.type || "").trim().toLowerCase() !== "exam") return { ok: true as const };
  const companyId = extras.companyId || request?.companyId || extras.employee?.companyId;
  const sources: StudyConsentSource[] = [extras.otherRequests, extras.employee, extras.profile];
  if (sources.some((source) => hasIrrevocableStudyConsent(source, companyId))) {
    return {
      ok: true as const,
      examLeaveTrack: EXAM_LEAVE_TRACK_PAID,
      reason: EXAM_LEAVE_TRACK_PAID_AR,
      reasonEn: EXAM_LEAVE_TRACK_PAID_EN,
    };
  }
  return {
    ok: true as const,
    examLeaveTrack: EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID,
    reason: EXAM_LEAVE_TRACK_FALLBACK_AR,
    reasonEn: EXAM_LEAVE_TRACK_FALLBACK_EN,
    notice: true,
    productGate: true,
  };
}

export function checkRevokeStudyConsentGate(request: StudyConsentLike | null | undefined, nextStatus?: string) {
  if (request?.type !== STUDY_CONSENT_TYPE) return { ok: true as const };
  if (otherRequestStatus(request) !== "approved") return { ok: true as const };
  if (String(nextStatus || "") === "approved") return { ok: true as const };
  return {
    ok: false as const,
    error: "STUDY_CONSENT_IRREVOCABLE",
    reason: STUDY_CONSENT_IRREVOCABLE_AR,
    reasonEn: STUDY_CONSENT_IRREVOCABLE_EN,
    productGate: true,
  };
}

const STUDY_ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function studyConsentTextOf(raw: unknown) {
  if (raw == null || raw === "") return "";
  if (Array.isArray(raw)) return "";
  if (typeof raw === "object") {
    const row = raw as { name?: string; title?: string; ar?: string; value?: string };
    return String(row.name || row.title || row.ar || row.value || "").trim();
  }
  return String(raw).trim();
}

function studyConsentDayOf(raw: unknown) {
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

function firstStudyConsentText(...values: unknown[]) {
  for (const raw of values) {
    const text = studyConsentTextOf(raw);
    if (text.length >= 2 && text !== "[object Object]") return text;
  }
  return "";
}

function firstStudyConsentDay(...values: unknown[]) {
  for (const raw of values) {
    const day = studyConsentDayOf(raw);
    if (day) return day;
  }
  return "";
}

/** Own request fields only — first filled alias. Never walks empty siblings or otherRequests. */
export function resolveStudyConsentFields(input: StudyConsentLike & {
  programName?: string;
  field?: string;
  institutionName?: string;
  school?: string;
  college?: string;
  university?: string;
  studyStart?: string;
  study?: { program?: string; institution?: string; startDate?: string; date?: string };
} = {}) {
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

export function composeStudyConsentReason(input: {
  program?: string;
  programName?: string;
  field?: string;
  institution?: string;
  institutionName?: string;
  school?: string;
  college?: string;
  university?: string;
  startDate?: string;
  date?: string;
  studyStart?: string;
  study?: { program?: string; institution?: string; startDate?: string; date?: string };
  reason?: string;
  note?: string;
  file?: StudyConsentFile;
  files?: StudyConsentFile[];
  senderFile?: StudyConsentFile;
} = {}) {
  const fields = resolveStudyConsentFields(input);
  const program = fields.program;
  const institution = fields.institution;
  const start = fields.startDate;
  const note = String(input.reason || input.note || "").trim();
  return [program && `البرنامج: ${program}`, institution && `المؤسسة: ${institution}`, start && `البداية: ${start}`, note].filter(Boolean).join(" — ");
}

export function checkSubmitStudyConsentGate(input: {
  program?: string;
  programName?: string;
  field?: string;
  institution?: string;
  institutionName?: string;
  school?: string;
  college?: string;
  university?: string;
  startDate?: string;
  date?: string;
  studyStart?: string;
  study?: { program?: string; institution?: string; startDate?: string; date?: string };
  reason?: string;
  note?: string;
  companyId?: string;
  status?: string;
  directApprove?: boolean;
  file?: StudyConsentFile;
  files?: StudyConsentFile[];
  senderFile?: StudyConsentFile;
  issuedFile?: StudyConsentFile;
  approvalFile?: StudyConsentFile;
  otherRequests?: StudyConsentLike[];
  employee?: { companyId?: string; otherRequests?: StudyConsentLike[] };
} = {}) {
  const { program, institution, startDate } = resolveStudyConsentFields(input);
  if (program.length < 2) {
    return {
      ok: false as const,
      error: "PROGRAM_REQUIRED",
      reason: "اكتب البرنامج أو التخصص.",
      reasonEn: "Write the program or field of study.",
    };
  }
  if (institution.length < 2) {
    return {
      ok: false as const,
      error: "INSTITUTION_REQUIRED",
      reason: "اكتب اسم المؤسسة التعليمية.",
      reasonEn: "Write the educational institution.",
    };
  }
  if (!STUDY_ISO_DAY.test(startDate)) {
    return {
      ok: false as const,
      error: "DATE_REQUIRED",
      reason: "حدد تاريخ بداية الدراسة.",
      reasonEn: "Set the study start date.",
    };
  }
  const employeeFile = studyConsentEmployeeFileOf(input);
  if (!employeeFile) {
    return {
      ok: false as const,
      error: "STUDY_CONSENT_FILE_REQUIRED",
      reason: STUDY_CONSENT_FILE_REQUIRED_AR,
      reasonEn: STUDY_CONSENT_FILE_REQUIRED_EN,
    };
  }
  if (input.status === "approved" || input.directApprove) {
    const issued = studyConsentApprovalFileOf(input);
    if (!issued) {
      return {
        ok: false as const,
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
      ok: false as const,
      error: "STUDY_CONSENT_ALREADY_APPROVED",
      reason: "الموافقة الدراسية مسجّلة ونهائية — لا يُعاد طلبها.",
      reasonEn: "Study consent is already recorded and final — it is not requested again.",
      productGate: true,
    };
  }
  if (state.status === "pending") {
    return {
      ok: false as const,
      error: "STUDY_CONSENT_PENDING",
      reason: "يوجد طلب موافقة دراسية معلّق بانتظار قرار المنشأة.",
      reasonEn: "A study-consent request is already pending the establishment's decision.",
    };
  }
  return {
    ok: true as const,
    program,
    institution,
    startDate,
    file: employeeFile,
    issuedFile: studyConsentApprovalFileOf(input) || undefined,
    reason: composeStudyConsentReason({ ...input, program, institution, startDate }),
  };
}

export function checkApproveStudyConsentGate(request?: StudyConsentLike | null) {
  if (request?.type !== STUDY_CONSENT_TYPE) return { ok: true as const };
  if (studyConsentApprovalFileOf(request)) return { ok: true as const };
  return {
    ok: false as const,
    error: "STUDY_CONSENT_APPROVAL_FILE_REQUIRED",
    reason: STUDY_CONSENT_APPROVAL_FILE_REQUIRED_AR,
    reasonEn: STUDY_CONSENT_APPROVAL_FILE_REQUIRED_EN,
    productGate: true,
  };
}

export const REJECT_REASON_REQUIRED_AR = "اكتب سبب الرفض — يُحفظ في سجل التدقيق.";
export const REJECT_REASON_REQUIRED_EN = "Write why it is refused — it is stored on the audit trail.";
export const REQUEST_REFUSE_REASON_MIN = 4;
const NIGHT_FITNESS_TYPE = "night_fitness";

export function namedRefuseReason(note?: string | null) {
  return String(note || "").trim();
}

export function checkRefuseRequestReasonGate(note?: string | null, extras: {
  note?: string;
  reason?: string;
  reviewNote?: string;
  messageAr?: string;
  messageEn?: string;
} = {}) {
  const reason = namedRefuseReason(note ?? extras.note ?? extras.reason ?? extras.reviewNote);
  if (reason.length >= REQUEST_REFUSE_REASON_MIN) return { ok: true as const, reason };
  return {
    ok: false as const,
    error: "REJECT_REASON_REQUIRED",
    reason: extras.messageAr || REJECT_REASON_REQUIRED_AR,
    reasonEn: extras.messageEn || REJECT_REASON_REQUIRED_EN,
  };
}

export function requestRefuseCite(request: { type?: string; article?: string; decisionId?: string } = {}) {
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

export function requestAuditAction(request: { type?: string } = {}, family = "", verb = "refuse") {
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

export function requestRefuseAuditAction(request: { type?: string } = {}, family = "") {
  return requestAuditAction(request, family, "refuse");
}

export function appendRequestAudit(request: { auditTrail?: unknown[] } | null | undefined, audit?: Record<string, unknown> | null) {
  const trail = Array.isArray(request?.auditTrail) ? request.auditTrail.filter(Boolean) : [];
  if (!audit) return trail;
  const eventType = String(audit.eventType || requestAuditEventType(String(audit.verb || audit.action || "")) || "event");
  return [...trail, { ...audit, type: eventType }];
}

export function appendRequestRefuseAudit(request: { auditTrail?: unknown[] } | null | undefined, audit?: Record<string, unknown> | null) {
  return appendRequestAudit(request, audit ? { ...audit, eventType: "refused" } : audit);
}

export function hasRequestAudit(request: { auditTrail?: Array<{ type?: string; action?: string; verb?: string; performedBy?: string; actorName?: string }> } | null | undefined, verb = "") {
  const trail = Array.isArray(request?.auditTrail) ? request.auditTrail : [];
  const want = requestAuditVerb(verb);
  return trail.some((row) => {
    const got = requestAuditVerb(row?.type || row?.verb || row?.action);
    if (want && got !== want) return false;
    return !!(String(row?.performedBy || row?.actorName || "").trim() && (row?.type || row?.action));
  });
}

export function hasRequestRefuseAudit(request: { auditTrail?: Array<{ type?: string; action?: string; reason?: string; performedBy?: string; actorName?: string }> } | null | undefined) {
  const trail = Array.isArray(request?.auditTrail) ? request.auditTrail : [];
  return trail.some((row) => (
    (row?.type === "refused" || /refus|reject/i.test(String(row?.action || "")))
    && String(row.reason || "").trim()
    && String(row.performedBy || row.actorName || "").trim()
  ));
}

function requestAuditDetails({ who, verb, type, subject, citeBit, reason }: {
  who: string;
  verb: string;
  type: string;
  subject: string;
  citeBit: string;
  reason: string;
}) {
  const key = requestAuditVerb(verb) || "refuse";
  const named = String(reason || "").trim();
  if (key === "refuse") return `${who} refused ${type} on ${subject}'s file${citeBit}: ${named}`.slice(0, 1000);
  const verbEn = key === "raise" ? "raised" : key === "approve" ? "approved" : key === "withdraw" ? "withdrew" : key === "agree" ? "agreed" : key === "revise" ? "returned" : key;
  const reasonBit = named ? `: ${named}` : "";
  return `${who} ${verbEn} ${type} on ${subject}'s file${citeBit}${reasonBit}`.slice(0, 1000);
}

export function buildRequestAudit({
  actor,
  employeeId,
  employeeName,
  request,
  family,
  verb,
  reason,
  at,
}: {
  actor?: string;
  employeeId?: string;
  employeeName?: string;
  request?: { id?: string; type?: string; article?: string; decisionId?: string };
  family?: string;
  verb?: string;
  reason?: string;
  at?: string;
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

export function buildRequestRefuseAudit(args: {
  actor?: string;
  employeeId?: string;
  employeeName?: string;
  request?: { id?: string; type?: string; article?: string; decisionId?: string };
  family?: string;
  reason?: string;
  at?: string;
} = {}) {
  const row = buildRequestAudit({ ...args, verb: "refuse" });
  return { ...row, action: requestRefuseAuditAction({ type: row.type }, args.family) };
}

export function requestAuditFileLog(audit: {
  article?: string;
  decisionId?: string;
  type?: string;
  reason?: string;
  performedBy?: string;
  actorName?: string;
  at?: string;
  verb?: string;
  action?: string;
  requestId?: string;
} | null | undefined, ar = true) {
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

export function requestRefuseFileLog(audit: {
  article?: string;
  decisionId?: string;
  type?: string;
  reason?: string;
  performedBy?: string;
  at?: string;
} | null | undefined, ar = true) {
  return requestAuditFileLog({ ...audit, verb: "refuse", type: audit?.type }, ar);
}

export function reconstructRequestAudit(row: {
  auditTrail?: Array<Record<string, unknown>>;
  createdAt?: string;
  requestedBy?: string;
  recordedBy?: string;
  status?: string;
  reviewedBy?: string;
  answeredBy?: string;
  acknowledgedBy?: string;
  reviewNote?: string;
  reply?: string;
  rejectReason?: string;
  attestation?: string;
  reviewedAt?: string;
  answeredAt?: string;
  approvedAt?: string;
  decidedAt?: string;
  withdrawnAt?: string;
  withdrawnBy?: string;
  decision?: string;
  reason?: string;
  id?: string;
  type?: string;
  article?: string;
  decisionId?: string;
} | null | undefined, employee: { id?: string; name?: string } | null | undefined, family: string) {
  const trail = Array.isArray(row?.auditTrail) ? row.auditTrail.filter(Boolean) : [];
  if (trail.length) {
    return trail.map((event) => buildRequestAudit({
      actor: String(event.performedBy || event.actorName || row?.reviewedBy || ""),
      employeeId: employee?.id,
      employeeName: employee?.name,
      request: row || undefined,
      family,
      verb: String(event.verb || event.type || event.action || ""),
      reason: String(event.reason || ""),
      at: String(event.at || ""),
    }));
  }
  const rows: ReturnType<typeof buildRequestAudit>[] = [];
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
      actor: row?.reviewedBy || row?.answeredBy || row?.acknowledgedBy,
      employeeId: employee?.id,
      employeeName: employee?.name,
      request: row || undefined,
      family,
      verb: status === "yes" || row?.decision === "agree" ? "agree" : "approve",
      reason: row?.reviewNote || row?.reply || "",
      at: row?.reviewedAt || row?.answeredAt || row?.approvedAt || row?.decidedAt,
    }));
  }
  if (status === "rejected" || status === "no") {
    const reason = namedRefuseReason(row?.reviewNote || row?.reply || row?.rejectReason || row?.attestation);
    if (reason) {
      rows.push(buildRequestAudit({
        actor: row?.reviewedBy || row?.answeredBy || row?.acknowledgedBy,
        employeeId: employee?.id,
        employeeName: employee?.name,
        request: row || undefined,
        family,
        verb: "refuse",
        reason,
        at: row?.reviewedAt || row?.answeredAt || row?.decidedAt,
      }));
    }
  }
  if (status === "withdrawn") {
    rows.push(buildRequestAudit({
      actor: row?.reviewedBy || row?.withdrawnBy || employee?.name,
      employeeId: employee?.id,
      employeeName: employee?.name,
      request: row || undefined,
      family,
      verb: "withdraw",
      reason: row?.reviewNote || row?.attestation || "",
      at: row?.withdrawnAt || row?.reviewedAt,
    }));
  }
  if (status === "revise") {
    rows.push(buildRequestAudit({
      actor: row?.reviewedBy,
      employeeId: employee?.id,
      employeeName: employee?.name,
      request: row || undefined,
      family,
      verb: "revise",
      reason: row?.reviewNote || "",
      at: row?.reviewedAt,
    }));
  }
  return rows;
}

export function collectRequestAuditLogs(employee: {
  id?: string;
  name?: string;
  leaveRequests?: Array<Record<string, unknown>>;
  otherRequests?: Array<Record<string, unknown>>;
} | null | undefined, ar = true) {
  const logs: ReturnType<typeof requestAuditFileLog>[] = [];
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

export function collectRequestRefuseLogs(employee: {
  id?: string;
  name?: string;
  leaveRequests?: Array<Record<string, unknown>>;
  otherRequests?: Array<Record<string, unknown>>;
} | null | undefined, ar = true) {
  return collectRequestAuditLogs(employee, ar).filter((row) => row.type === "request_refused" || row.verb === "refuse");
}

export function checkRejectStudyConsentGate(request: StudyConsentLike | null | undefined, note?: string) {
  if (request?.type !== STUDY_CONSENT_TYPE) return { ok: true as const };
  if (otherRequestStatus(request) === "approved") return checkRevokeStudyConsentGate(request, "rejected");
  return checkRefuseRequestReasonGate(note, {
    messageAr: "اكتب سبب رفض طلب الموافقة الدراسية.",
    messageEn: "Write why the study-consent request is refused.",
  });
}

export function checkRejectNightFitnessGate(request: { type?: string } | null | undefined, note?: string) {
  if (request?.type !== NIGHT_FITNESS_TYPE) return { ok: true as const };
  return checkRefuseRequestReasonGate(note, {
    messageAr: "اكتب سبب رفض طلب اللياقة الليلية.",
    messageEn: "Write why the night-fitness request is refused.",
  });
}
