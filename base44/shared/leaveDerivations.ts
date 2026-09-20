/** Leave derivation — statutory types, days, approve gate (>5 days needs attachment).
 *  Design ref: NiroVera Platform.dc.html class Component (leave / canOk / needsDoc).
 *  Totals and articles come from laborRules — cite only when source is labour.
 */

import { articleOfficialText } from "./laborArticleTexts.ts";
import { addLaborDays, citeLeaveType, citeRule, isRamadanHoursSubject, lastRamadanDay, RAMADAN_WINDOWS, ruleAt, ruleValue } from "./laborRules.ts";
import { checkExamStudyConsentGate, EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID, EXAM_LEAVE_TRACK_PAID, type ExamConsentExtras } from "./otherRequestDerivations.ts";

export const LEAVE_THRESHOLD_DAYS = ruleValue("leave.attachment.thresholdDays");

export const CHAPTER_LEAVE_TYPES = [
  "annual", "grant", "sick", "maternity", "maternity_extend", "maternity_companion", "iddah", "paternity", "marriage", "bereavement", "bereavement_sibling", "hajj", "eid", "exam", "emergency", "unpaid",
] as const;

export const LEAVE_TYPES = [
  { key: "annual", total: ruleValue("leave.annual.days"), article: citeLeaveType("annual")?.article ?? null, ar: "سنوية", en: "Annual" },
  { key: "grant", total: null, article: null, ar: "رصيد", en: "Granted days" },
  { key: "sick", total: ruleValue("leave.sick.days"), article: citeLeaveType("sick")?.article ?? null, ar: "مرضية", en: "Sick", requiresFile: true },
  { key: "maternity", total: ruleValue("leave.maternity.days"), article: citeLeaveType("maternity")?.article ?? null, ar: "أمومة", en: "Maternity", f: true, requiresFile: true },
  { key: "maternity_extend", total: ruleValue("leave.maternity.unpaidExtendDays"), article: citeLeaveType("maternity_extend")?.article ?? "151", ar: "تمديد وضع بلا أجر", en: "Unpaid maternity extension", f: true },
  { key: "maternity_companion", total: ruleValue("leave.maternity.disabledChildDays"), article: citeLeaveType("maternity_companion")?.article ?? "151", ar: "مرافقة مولود مريض/معاق", en: "Sick or disabled-child companion", f: true, requiresFile: true },
  { key: "iddah", total: ruleValue("leave.iddah.days"), article: citeLeaveType("iddah")?.article ?? null, ar: "عدّة وفاة الزوج", en: "Iddah", f: true, requiresFile: true },
  { key: "paternity", total: ruleValue("leave.paternity.days"), article: citeLeaveType("paternity")?.article ?? null, ar: "أبوة", en: "Paternity", m: true },
  { key: "marriage", total: ruleValue("leave.marriage.days"), article: citeLeaveType("marriage")?.article ?? null, ar: "زواج", en: "Marriage" },
  { key: "bereavement", total: ruleValue("leave.bereavement.days"), article: citeLeaveType("bereavement")?.article ?? null, ar: "وفاة زوج/أصل/فرع", en: "Bereavement" },
  { key: "bereavement_sibling", total: ruleValue("leave.bereavement_sibling.days"), article: citeLeaveType("bereavement_sibling")?.article ?? null, ar: "وفاة أخ/أخت", en: "Sibling bereavement" },
  { key: "hajj", total: ruleValue("leave.hajj.days"), article: citeLeaveType("hajj")?.article ?? null, ar: "حج", en: "Hajj" },
  { key: "eid", total: null, article: citeLeaveType("eid")?.article ?? null, ar: "عيد / عطلة رسمية", en: "Eid / official holiday" },
  { key: "exam", total: null, article: citeLeaveType("exam")?.article ?? null, ar: "امتحان", en: "Exam", requiresFile: true },
  { key: "emergency", total: ruleValue("leave.emergency.days"), article: citeLeaveType("emergency")?.article ?? null, ar: "اضطرارية", en: "Emergency" },
  { key: "unpaid", total: null, article: citeLeaveType("unpaid")?.article ?? null, ar: "بدون راتب", en: "Unpaid" },
] as const;

export type LeaveRequestLike = {
  id?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  activeStartDate?: string;
  activeEndDate?: string;
  days?: number;
  files?: unknown[] | null;
  reason?: string | null;
  status?: string;
  employeeId?: string;
  eventDate?: string;
  disabledChild?: boolean;
  examRepeat?: boolean;
  examSatFile?: unknown;
  examSatAt?: string;
  examLeaveTrack?: "paid" | "annual_or_unpaid" | "";
  examPayFrom?: "paid" | "annual" | "unpaid" | "";
  iddahPregnant?: boolean;
  companionUnpaidExtend?: boolean;
  createdAt?: string;
  requestedAt?: string;
  recordedBy?: string;
  noOtherEmployerAck?: boolean;
  deferConsentAt?: string;
  decisionSeenAt?: string;
};

export type LeaveApproveExtras = {
  profile?: {
    hireDate?: string;
    gender?: string;
    religion?: string;
    leaveTotals?: Record<string, number>;
    hajjPerformed?: boolean;
    maternityDisabledChild?: boolean;
    annualDeferConsentAt?: string;
    leaveRequests?: LeaveRequestLike[];
    discretionaryGrants?: { days?: number }[];
  };
  requests?: LeaveRequestLike[];
  type?: string;
  eventDate?: string;
  disabledChild?: boolean;
  examRepeat?: boolean;
  iddahPregnant?: boolean;
  companionUnpaidExtend?: boolean;
  submittedAt?: string;
  onDate?: string;
  today?: string;
  actor?: string;
  nextStatus?: string;
  action?: string;
  status?: string;
  recordedBy?: string | boolean;
  employerRecorded?: boolean;
  companyId?: string;
  otherRequests?: ExamConsentExtras["otherRequests"];
  employee?: ExamConsentExtras["employee"];
};

export function addCalendarDays(iso: string | undefined, n: number) {
  const s = String(iso || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(n));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function riyadhDay(onDate?: string | Date) {
  if (typeof onDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(onDate)) return onDate.slice(0, 10);
  const d = onDate instanceof Date ? onDate : new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(d);
}

function daysUntilLeaveStart(startDate?: string, onDate?: string) {
  const start = String(startDate || "").slice(0, 10);
  const day = riyadhDay(onDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return Math.round((new Date(`${start}T00:00:00`).getTime() - new Date(`${day}T00:00:00`).getTime()) / 86400000);
}

function serviceYearsFromHire(hireDate?: string, onDate?: string) {
  const start = String(hireDate || "").slice(0, 10);
  const m = start.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  const day = riyadhDay(onDate);
  const now = day.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    ? new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))
    : new Date();
  const hired = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.max(0, (now.getTime() - hired.getTime()) / 31557600000);
}

/** Inclusive calendar days between YYYY-MM-DD dates (local parts, not UTC ISO). */
export function computeLeaveDays(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate || !endDate) return 0;
  const a = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(endDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  if (b.getTime() < a.getTime()) return 0;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

/** Art. 114: Hajj is 10–15 calendar days including Eid al-Adha — do not strip official holidays. */
export function leaveSpanIncludesOfficialHolidays(type?: string) {
  return String(type || "").trim().toLowerCase() === "hajj";
}

export function profileLeaveGender(profile?: { gender?: string } | null) {
  const raw = String(profile?.gender || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "female" || raw === "f" || raw.includes("أنث") || raw.includes("انث") || raw === "woman") return "female";
  if (raw === "male" || raw === "m" || raw.includes("ذكر") || raw === "man") return "male";
  return "";
}

/** Maternity (151) is female-only; paternity (113) is male-only. Missing gender is a named stop, not a silent allow. */
export function checkLeaveGenderGate(request: LeaveRequestLike | null | undefined, extras: LeaveApproveExtras = {}) {
  const type = String(request?.type || "").trim().toLowerCase();
  const spec = LEAVE_TYPES.find((row) => row.key === type);
  const need = spec && "f" in spec && spec.f ? "female" : spec && "m" in spec && spec.m ? "male" : "";
  if (!need) return { ok: true as const };
  const have = profileLeaveGender(extras.profile);
  const cite = citeLeaveType(type, request?.startDate || extras.onDate);
  if (!have) {
    return {
      ok: false as const,
      error: "LEAVE_GENDER_REQUIRED",
      reason: type === "iddah"
        ? "موقوف — عدّة وفاة الزوج للنساء. حدّد جنس الموظفة على الملف أولاً."
        : need === "female"
        ? "موقوف — إجازة الأمومة للنساء. حدّد جنس الموظفة على الملف أولاً."
        : "موقوف — إجازة الأبوة للرجال. حدّد جنس الموظف على الملف أولاً.",
      reasonEn: type === "iddah"
        ? "Blocked — iddah leave is for women. Set the employee's gender on the file first."
        : need === "female"
        ? "Blocked — maternity leave is for women. Set the employee's gender on the file first."
        : "Blocked — paternity leave is for men. Set the employee's gender on the file first.",
      cite,
    };
  }
  if (have !== need) {
    return {
      ok: false as const,
      error: "LEAVE_GENDER",
      reason: type === "iddah"
        ? "موقوف — عدّة وفاة الزوج للعاملات فقط (المادة 160)."
        : need === "female"
        ? "موقوف — إجازة الأمومة للعاملات فقط (المادة 151)."
        : "موقوف — إجازة المولود للعمال فقط (المادة 113).",
      reasonEn: type === "iddah"
        ? "Blocked — iddah leave is for female workers only (Article 160)."
        : need === "female"
        ? "Blocked — maternity leave is for female workers only (Article 151)."
        : "Blocked — paternity leave is for male workers only (Article 113).",
      cite,
    };
  }
  return { ok: true as const };
}

export function leaveNeedsAttachment(request: LeaveRequestLike) {
  const key = String(request.type || "").trim().toLowerCase();
  if (key === "maternity_extend") return false;
  const days = Number(request.days) || computeLeaveDays(request.startDate, request.endDate);
  const type = LEAVE_TYPES.find((t) => t.key === request.type);
  if (type && "requiresFile" in type && type.requiresFile) return true;
  return days > ruleValue("leave.attachment.thresholdDays");
}

/** A real paper: named file with bytes/url/hash. The old toggle invented `{ name: "supporting-document", attested: true }`. */
export function isRealSupportingFile(file: unknown) {
  if (!file || typeof file !== "object") return false;
  const row = file as { name?: string; url?: string; file_url?: string; size?: number; hash?: string; attested?: boolean };
  const name = String(row.name || "").trim();
  if (!name) return false;
  const url = String(row.url || row.file_url || "").trim();
  const size = Number(row.size) || 0;
  const hash = String(row.hash || "").trim();
  if (row.attested === true && !url && size <= 0 && !hash) return false;
  return true;
}

export const EXAM_NOTICE_KIND = "exam_notice";
export const EXAM_SAT_KIND = "exam_sat";

/** Official Art. 115 wording — attach to exam gates; never paraphrase away the statute. */
export function examStatuteOf(onDate?: string) {
  const official = articleOfficialText("115", onDate);
  return {
    article: "115",
    articleText: official?.ar || "",
    articleTextEn: official?.en || "",
  };
}

function supportingFileKind(file: unknown) {
  if (!file || typeof file !== "object") return "";
  return String((file as { kind?: string }).kind || "").trim().toLowerCase();
}

export function hasLeaveAttachment(request: LeaveRequestLike) {
  const files = Array.isArray(request.files) ? request.files : [];
  return files.some((file) => isRealSupportingFile(file) && supportingFileKind(file) !== EXAM_SAT_KIND);
}

export function examNoticeFilesOf(request: LeaveRequestLike) {
  return (Array.isArray(request.files) ? request.files : []).filter((file) => (
    isRealSupportingFile(file) && supportingFileKind(file) !== EXAM_SAT_KIND
  ));
}

export function examSatFileOf(request: LeaveRequestLike) {
  if (isRealSupportingFile(request.examSatFile)) return request.examSatFile as Record<string, unknown>;
  return (Array.isArray(request.files) ? request.files : []).find((file) => (
    supportingFileKind(file) === EXAM_SAT_KIND && isRealSupportingFile(file)
  )) as Record<string, unknown> | undefined || null;
}

export function hasExamSatProof(request: LeaveRequestLike) {
  return !!examSatFileOf(request);
}

/** Art. 115(4): proof of sitting is a second paper — after the exam days begin, on the same request. */
export function checkAttachExamSatGate(request: LeaveRequestLike, file: unknown, extras: LeaveApproveExtras = {}) {
  const type = String(request?.type || "").trim().toLowerCase();
  const cite = citeRule("leave.exam.cite", extras.onDate || request.startDate);
  if (type !== "exam") {
    return {
      ok: false as const,
      error: "EXAM_SAT_TYPE",
      reason: "موقوف — إثبات أداء الامتحان يُرفع على طلب إجازة الامتحان فقط (المادة 115).",
      reasonEn: "Blocked — proof of sitting is attached on the exam-leave request only (Article 115).",
      cite,
    };
  }
  const status = String(request.status || "pending").toLowerCase();
  if (status === "rejected" || status === "withdrawn") {
    return {
      ok: false as const,
      error: "EXAM_SAT_CLOSED",
      reason: "موقوف — لا يُرفع إثبات الأداء على طلب مرفوض أو مسحوب.",
      reasonEn: "Blocked — sitting proof is not attached on a rejected or withdrawn request.",
      cite,
    };
  }
  if (!isRealSupportingFile(file)) {
    return {
      ok: false as const,
      error: "EXAM_SAT_FILE",
      reason: "موقوف — أرفق ما يدل على أداء الامتحان (المادة 115).",
      reasonEn: "Blocked — attach what shows the exam was sat (Article 115).",
      cite,
    };
  }
  const start = String(request.startDate || "").slice(0, 10);
  const today = String(extras.onDate || extras.submittedAt || riyadhDay()).slice(0, 10);
  if (start && today < start) {
    return {
      ok: false as const,
      error: "EXAM_SAT_BEFORE",
      reason: `موقوف — إثبات الأداء يُرفع بعد بدء أيام الامتحان (${start}).`,
      reasonEn: `Blocked — sitting proof is attached after the exam days begin (${start}).`,
      cite,
    };
  }
  return { ok: true as const, via: "exam_sat" as const, cite };
}

export function examSatState(request: LeaveRequestLike, extras: LeaveApproveExtras = {}) {
  const type = String(request?.type || "").trim().toLowerCase();
  if (type !== "exam") return { outstanding: false, open: false, due: false, attached: false, settled: true, file: null as ReturnType<typeof examSatFileOf> };
  const status = String(request.status || "pending").toLowerCase();
  if (status === "rejected" || status === "withdrawn") {
    return { outstanding: false, open: false, due: false, attached: false, settled: false, file: null as ReturnType<typeof examSatFileOf> };
  }
  const file = examSatFileOf(request);
  if (file) return { outstanding: false, open: false, due: false, attached: true, settled: true, file };
  const start = String(request.startDate || "").slice(0, 10);
  const end = String(request.endDate || start).slice(0, 10);
  const today = String(extras.onDate || extras.today || extras.submittedAt || riyadhDay()).slice(0, 10);
  const open = !!(start && today >= start);
  const due = !!(end && today > end);
  return { outstanding: true, open, due, attached: false, settled: false, file: null as ReturnType<typeof examSatFileOf>, start, end };
}

/** Art. 115(4)+(1): after exam days begin, sitting proof is a second paper on the same request. */
export function checkExamSittingSettleGate(request: LeaveRequestLike, extras: LeaveApproveExtras = {}) {
  const type = String(request?.type || "").trim().toLowerCase();
  const statute = examStatuteOf(extras.onDate || request.startDate);
  const cite = citeRule("leave.exam.cite", extras.onDate || request.startDate);
  if (type !== "exam") return { ok: true as const, settled: true, via: null as string | null };
  const sat = examSatState(request, extras);
  if (sat.attached) return { ok: true as const, settled: true, via: "exam_sat" as const, cite, ...statute };
  if (!sat.open) {
    return {
      ok: true as const,
      settled: false,
      via: "awaiting_exam_days" as const,
      cite,
      ...statute,
      reason: `إثبات أداء الامتحان يُرفع بعد بدء الأيام (${sat.start || "—"}) — المادة 115.`,
      reasonEn: `Sitting proof is attached after the exam days begin (${sat.start || "—"}) — Article 115.`,
    };
  }
  return {
    ok: false as const,
    error: "EXAM_SAT_UNSETTLED",
    settled: false,
    via: sat.due ? "exam_sat_due" as const : "exam_sat_open" as const,
    cite,
    ...statute,
    reason: "غير مستقر — إثبات أداء الامتحان ورقة ثانية بعد بدء الأيام (المادة 115). دونها لا تستقر الإجازة، ويُحرم الأجر إن ثبت عدم الأداء.",
    reasonEn: "Unsettled — sitting proof is a second paper after the exam days begin (Article 115). Without it the leave does not stay settled, and the wage is denied if it is proven the exam was not sat.",
  };
}

/** Art. 115(3): fifteen days' employee notice to the employer. A late timetable paper is a named notice exception — not an institution approval. */
export function checkExamNoticeGate(request: LeaveRequestLike, extras: LeaveApproveExtras = {}) {
  const type = String(request?.type || extras.type || "").trim().toLowerCase();
  if (type !== "exam") return { ok: true as const, via: null as string | null };
  const onDate = extras.onDate || request.startDate;
  const noticeDays = ruleValue("leave.exam.noticeDays", onDate) || 15;
  const start = String(request.startDate || "").slice(0, 10);
  const today = riyadhDay();
  const submitted = String(request.createdAt || request.requestedAt || extras.submittedAt || extras.onDate || today).slice(0, 10);
  const issued = String(request.examNoticeIssuedAt || extras.examNoticeIssuedAt || "").slice(0, 10);
  const cite = citeRule("leave.exam.noticeDays", onDate);
  const statute = examStatuteOf(onDate);
  if (!start) return { ok: true as const, via: null as string | null };
  const earliest = addCalendarDays(submitted, noticeDays);
  if (start >= earliest) return { ok: true as const, via: "notice" as const, cite, noticeDays, ...statute };
  const lateHintAr = "إن وصل جدول المواعيد بعد المهلة فارفع الورقة وسجّل تاريخ صدورها، وقدّم الطلب في يوم الورقة أو اليوم التالي.";
  const lateHintEn = "If the timetable paper arrives after that window, attach it, record its issue date, and apply on that day or the next.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issued)) {
    return {
      ok: false as const,
      error: "EXAM_NOTICE",
      reason: `موقوف — طلب إجازة الامتحان قبل موعدها بـ ${noticeDays} يوماً على الأقل (المادة 115). لا تُمنح الإجازة. ${lateHintAr}`,
      reasonEn: `Blocked — exam leave must be requested at least ${noticeDays} days before it starts (Article 115). Do not grant. ${lateHintEn}`,
      cite,
      noticeDays,
      ...statute,
    };
  }
  if (issued > submitted) {
    return {
      ok: false as const,
      error: "EXAM_NOTICE_DATE",
      reason: "موقوف — تاريخ صدور ورقة المواعيد بعد تاريخ تقديم الطلب (المادة 115).",
      reasonEn: "Blocked — the timetable paper date is after the request date (Article 115).",
      cite,
      noticeDays,
      ...statute,
    };
  }
  if (start >= addCalendarDays(issued, noticeDays)) {
    return {
      ok: false as const,
      error: "EXAM_NOTICE",
      reason: `موقوف — ورقة المواعيد صدرت قبل ${noticeDays} يوماً. مهلة المادة 115 على العامل لا تسقط.`,
      reasonEn: `Blocked — the timetable paper was issued ${noticeDays} days ahead. Article 115's notice stays on the worker.`,
      cite,
      noticeDays,
      ...statute,
    };
  }
  if (submitted > addCalendarDays(issued, 1)) {
    return {
      ok: false as const,
      error: "EXAM_NOTICE_DELAY",
      reason: `موقوف — ورقة المواعيد صدرت في ${issued}، ولم يُقدَّم الطلب في يومها أو اليوم التالي (المادة 115).`,
      reasonEn: `Blocked — the timetable paper was issued on ${issued}, and the request was not sent that day or the next (Article 115).`,
      cite,
      noticeDays,
      ...statute,
    };
  }
  if (!hasLeaveAttachment(request)) {
    return {
      ok: false as const,
      error: "EXAM_NOTICE_PROOF",
      reason: "موقوف — الإشعار المتأخر يحتاج ورقة المواعيد بتاريخ صدورها (المادة 115).",
      reasonEn: "Blocked — a late notice needs the timetable paper with its issue date (Article 115).",
      cite,
      noticeDays,
      ...statute,
    };
  }
  return {
    ok: true as const,
    via: "late_notice" as const,
    examNoticeIssuedAt: issued,
    cite,
    noticeDays,
    ...statute,
    reason: `مهلة المادة 115 بقيت ${noticeDays} يوماً. قُبل الطلب لأن ورقة المواعيد صدرت في ${issued} — أقل من ${noticeDays} يوماً — وقُدّم في يوم الورقة أو اليوم التالي.`,
    reasonEn: `Article 115 still requires ${noticeDays} days. The request was accepted because the timetable paper was issued on ${issued} — under ${noticeDays} days — and it was filed that day or the next.`,
  };
}

/** Art. 115(1)–(2): a qualifying exam leave is a statutory right. Employer refusal of enrolment only changes the pay track. */
export function examLeaveQualifies(request: LeaveRequestLike, extras: LeaveApproveExtras = {}) {
  const type = String(request?.type || "").trim().toLowerCase();
  if (type !== "exam") return { ok: false as const, via: null as string | null };
  const start = String(request.startDate || "").slice(0, 10);
  const end = String(request.endDate || "").slice(0, 10);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const days = computeLeaveDays(start, end);
  if (!iso.test(start) || !iso.test(end) || days <= 0) {
    return {
      ok: false as const,
      error: "LEAVE_DATES_REQUIRED",
      reason: "موقوف — تواريخ الإجازة غير مكتملة.",
      reasonEn: "Blocked — leave dates are incomplete.",
    };
  }
  const notice = checkExamNoticeGate(request, extras);
  if (!notice.ok) return notice;
  if (!hasLeaveAttachment(request)) {
    const statute = examStatuteOf(extras.onDate || request.startDate);
    return {
      ok: false as const,
      error: "ATTACHMENT_REQUIRED",
      reason: "موقوف — المادة 115 تجيز طلب الوثائق المؤيدة. أرفق جدول المواعيد أو ورقة الأيام.",
      reasonEn: "Blocked — Article 115 lets the employer require supporting documents. Attach the exam timetable or dates paper.",
      cite: citeRule("leave.exam.cite", extras.onDate || request.startDate),
      ...statute,
    };
  }
  return { ok: true as const, via: notice.via || "notice", cite: "cite" in notice ? notice.cite : undefined, articleText: "articleText" in notice ? notice.articleText : "", articleTextEn: "articleTextEn" in notice ? notice.articleTextEn : "", article: "115" };
}

/** Employer cannot refuse a request that already meets Article 115. */
export function checkRejectLeaveGate(request: LeaveRequestLike | null | undefined, extras: LeaveApproveExtras = {}) {
  const next = String(extras.nextStatus || extras.action || extras.status || "rejected").trim().toLowerCase();
  if (next !== "rejected") return { ok: true as const };
  const type = String(request?.type || "").trim().toLowerCase();
  if (type !== "exam") return { ok: true as const };
  if (extras.actor === "employee") return { ok: true as const };
  const qualify = examLeaveQualifies(request || {}, extras);
  if (!qualify.ok) return { ok: true as const, via: "not_qualified" as const, qualify };
  const statute = examStatuteOf(extras.onDate || request?.startDate);
  const cite = citeRule("leave.exam.cite", extras.onDate || request?.startDate);
  return {
    ok: false as const,
    error: "EXAM_EMPLOYER_REFUSE",
    reason: "موقوف — صاحب العمل لا يرفض إجازة امتحان استوفت المادة 115. موافقة الانتساب تغيّر مسار الأجر فقط (الفقرة 1 و2)؛ الإجازة حق بأيام الامتحان الفعلية. المنصة تُبقي الحق.",
    reasonEn: "Blocked — the employer cannot refuse an exam leave that meets Article 115. Enrolment consent only changes the pay track (paragraphs 1 and 2); the leave itself is a right for the actual exam days. The platform keeps the entitlement.",
    cite,
    via: "via" in qualify ? qualify.via : "notice",
    ...statute,
  };
}

function dateOnly(iso?: string) {
  const s = String(iso || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function overlapInclusiveDays(a0: string, a1: string, b0: string, b1: string) {
  if (!a0 || !a1 || !b0 || !b1) return 0;
  const start = a0 > b0 ? a0 : b0;
  const end = a1 < b1 ? a1 : b1;
  if (start > end) return 0;
  return computeLeaveDays(start, end);
}

const ARAFAH_DAYS = ["2025-06-05", "2026-05-26", "2027-05-16", "2028-05-04"];

function officialHolidayOnDay(value: string) {
  const day = dateOnly(value);
  if (!day) return null;
  const year = Number(day.slice(0, 4));
  const win = RAMADAN_WINDOWS.find((row) => Number(String(row.from).slice(0, 4)) === year);
  let eid: { id: string; from: string } | null = null;
  if (win) {
    const last = lastRamadanDay(win);
    const from = addLaborDays(last, 1);
    const days = Number(ruleValue("leave.eid.fitrDays", from) || 4);
    const to = addLaborDays(from, days - 1);
    if (from && from <= day && day <= to) eid = { id: "fitr", from };
  }
  if (!eid) {
    const arafah = ARAFAH_DAYS.find((row) => row.startsWith(String(year)));
    if (arafah) {
      const days = Number(ruleValue("leave.eid.adhaDays", arafah) || 4);
      const to = addLaborDays(arafah, days - 1);
      if (arafah <= day && day <= to) eid = { id: "adha", from: arafah };
    }
  }
  const md = day.slice(5);
  const civic = md === "09-23" ? { id: "national", from: day } : md === "02-22" ? { id: "founding", from: day } : null;
  if (eid && civic) return { ...eid, absorbedCivic: civic.id };
  return eid || civic;
}

function isOfficialHolidayDay(value?: string) {
  return !!officialHolidayOnDay(String(value || ""));
}

function chargeableSpanExcludingHolidays(startDate?: string, endDate?: string) {
  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  if (!start || !end || end < start) return 0;
  let n = 0;
  let cursor: string | null = start;
  while (cursor && cursor <= end) {
    if (!isOfficialHolidayDay(cursor)) n += 1;
    cursor = addLaborDays(cursor, 1);
  }
  return n;
}

function chargeableAnnualDays(startDate?: string, endDate?: string) {
  return chargeableSpanExcludingHolidays(startDate, endDate);
}

export function isOfficialHolidayLeave(type?: string) {
  return String(type || "").trim().toLowerCase() === "eid";
}

function liveLeaveRequests(request: LeaveRequestLike | null | undefined, extras: LeaveApproveExtras) {
  const id = String(request?.id || "").trim();
  return (extras.requests || extras.profile?.leaveRequests || []).filter((row) => {
    if (!row) return false;
    const otherId = String(row.id || "").trim();
    if (id && otherId && otherId === id) return false;
    const status = String(row.status || "pending");
    return status === "pending" || status === "approved";
  });
}

export function checkOfficialHolidayLeaveGate(request: LeaveRequestLike | null | undefined, extras: LeaveApproveExtras = {}) {
  if (!isOfficialHolidayLeave(request?.type)) return { ok: true as const };
  const start = dateOnly(request?.startDate);
  const end = dateOnly(request?.endDate);
  const cite = citeRule("leave.eid.cite", start || extras.onDate);
  if (!start || !end || end < start) {
    return {
      ok: false as const,
      error: "OFFICIAL_HOLIDAY_DATES",
      reason: "موقوف — إجازة العيد أو العطلة الرسمية لأيام العطل فقط.",
      reasonEn: "Blocked — Eid or official-holiday leave is only for official holiday dates.",
      cite,
    };
  }
  let span: { id: string; from: string } | null = null;
  let cursor: string | null = start;
  while (cursor && cursor <= end) {
    const hit = officialHolidayOnDay(cursor);
    if (!hit) {
      return {
        ok: false as const,
        error: "OFFICIAL_HOLIDAY_DATES",
        reason: "موقوف — اطلب العيد أو العطلة الرسمية على أيامها فقط (الفطر أو الأضحى أو الوطني أو التأسيس).",
        reasonEn: "Blocked — request Eid or official-holiday leave only on those holiday dates (Fitr, Adha, National Day, or Founding Day).",
        cite,
      };
    }
    if (!span) span = hit;
    else if (hit.id !== span.id || hit.from !== span.from) {
      return {
        ok: false as const,
        error: "OFFICIAL_HOLIDAY_MIX",
        reason: "موقوف — اطلب كل عطلة رسمية في طلب مستقل.",
        reasonEn: "Blocked — request each official holiday in its own request.",
        cite,
      };
    }
    cursor = addLaborDays(cursor, 1);
  }
  return { ok: true as const, cite };
}

export function checkOfficialHolidayOverlapGate(request: LeaveRequestLike | null | undefined, extras: LeaveApproveExtras = {}) {
  const type = String(request?.type || "").trim().toLowerCase();
  const start = dateOnly(request?.startDate);
  const end = dateOnly(request?.endDate);
  const cite = citeRule("leave.eid.cite", start || extras.onDate);
  const hit = liveLeaveRequests(request, extras).find((row) => {
    const otherStart = dateOnly(row.startDate);
    const otherEnd = dateOnly(row.endDate) || otherStart;
    if (!start || !end || !otherStart || !otherEnd || start > otherEnd || otherStart > end) return false;
    if (isOfficialHolidayLeave(type)) return true;
    return isOfficialHolidayLeave(row.type);
  });
  if (!hit) return { ok: true as const };
  return {
    ok: false as const,
    error: "LEAVE_OVERLAP",
    reason: "موقوف — المدة تتقاطع مع طلب عيد أو إجازة قائم. اطلب العيد بطلب مستقل خارج السنوية.",
    reasonEn: "Blocked — these dates overlap an existing Eid or leave request. Request Eid separately, outside annual leave.",
    cite,
  };
}

function inclusiveDays(a: string, b: string) {
  return computeLeaveDays(a, b);
}

/** Hire-anniversary leave year: from the anniversary on or before onDate through the day before the next. */
export function anniversaryYearWindow(hireDate?: string, onDate?: string) {
  const day = dateOnly(onDate) || riyadhDay();
  const hire = dateOnly(hireDate);
  if (!hire) return null;
  const origin = new Date(Number(hire.slice(0, 4)), Number(hire.slice(5, 7)) - 1, Number(hire.slice(8, 10)));
  const on = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  if (Number.isNaN(origin.getTime()) || Number.isNaN(on.getTime())) return null;
  let start = new Date(origin.getFullYear(), origin.getMonth(), origin.getDate());
  if (start > on) {
    const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    return { start: startIso, end: addCalendarDays(startIso, 364) };
  }
  while (true) {
    const next = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
    if (next > on) break;
    start = next;
  }
  const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const next = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  const nextIso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  return { start: startIso, end: addCalendarDays(nextIso, -1) };
}

/** Article 111: pro-rata of the incomplete leave year at exit only. */
export function accruedAnnualDaysAtExit(hireDate: string | undefined, entitlement: number, exitDate?: string) {
  const floor = Math.max(0, Number(entitlement) || 0);
  const win = anniversaryYearWindow(hireDate, exitDate);
  if (!win) return floor;
  const yearLen = inclusiveDays(win.start, win.end);
  if (yearLen <= 0) return 0;
  const exit = dateOnly(exitDate) || win.start;
  if (exit < win.start) return 0;
  const workedEnd = exit < win.end ? exit : win.end;
  const worked = inclusiveDays(win.start, workedEnd);
  return floor * (worked / yearLen);
}

/** Article 117: the sick year starts on the first sick leave and rolls every 365 days. */
function sickStatutoryYearWindow(requests: LeaveRequestLike[] | undefined, onDate?: string) {
  const day = dateOnly(onDate) || riyadhDay();
  const first = (requests || [])
    .filter((r) => String(r.type || "").toLowerCase() === "sick" && r.status === "approved")
    .map((r) => dateOnly(r.startDate))
    .filter(Boolean)
    .sort()[0];
  if (!first) return { start: day, end: addCalendarDays(day, 364) };
  const origin = new Date(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, Number(first.slice(8, 10)));
  const on = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  let start = new Date(origin.getTime());
  while (true) {
    const next = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
    if (next > on) break;
    start = next;
  }
  const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return { start: startIso, end: addCalendarDays(startIso, 364) };
}

function usedLeaveDays(requests: LeaveRequestLike[] | undefined, key: string, onDate?: string, hireDate?: string) {
  const k = String(key || "").trim().toLowerCase();
  const approved = (requests || []).filter((r) => String(r.type || "").toLowerCase() === k && r.status === "approved");
  if (k === "sick") {
    const win = sickStatutoryYearWindow(requests, onDate);
    return approved.reduce((sum, r) => {
      const start = dateOnly(r.startDate);
      const end = dateOnly(r.endDate) || (start ? addCalendarDays(start, Math.max(1, Number(r.days) || 1) - 1) : "");
      if (!start || !end) return sum;
      const a0 = start > win.start ? start : win.start;
      const a1 = end < win.end ? end : win.end;
      return sum + (a0 <= a1 ? chargeableSpanExcludingHolidays(a0, a1) : 0);
    }, 0);
  }
  if (k === "annual") {
    const win = anniversaryYearWindow(hireDate, onDate);
    const charged = approved.concat((requests || []).filter((row) => String(row.type || "").toLowerCase() === "exam" && row.status === "approved" && row.examPayFrom === "annual"));
    return charged.reduce((sum, r) => {
      const start = dateOnly(r.startDate);
      const end = dateOnly(r.endDate) || (start ? addCalendarDays(start, Math.max(1, Number(r.days) || 1) - 1) : "");
      if (start && end && win) {
        const a0 = start > win.start ? start : win.start;
        const a1 = end < win.end ? end : win.end;
        return sum + (a0 <= a1 ? chargeableAnnualDays(a0, a1) : 0);
      }
      return sum + (Number(r.days) || 0);
    }, 0);
  }
  return approved.reduce((sum, r) => sum + (Number(r.days) || computeLeaveDays(r.startDate, r.endDate) || 0), 0);
}

function statutoryLeaveFloor(key: string, profile: LeaveApproveExtras["profile"], onDate?: string) {
  const k = String(key || "").trim().toLowerCase();
  if (k === "annual") {
    const years = serviceYearsFromHire(profile?.hireDate, onDate);
    return years >= 5
      ? ruleValue("leave.annual.afterFiveYearsDays", onDate)
      : ruleValue("leave.annual.days", onDate);
  }
  if (k === "maternity") {
    let days = ruleValue("leave.maternity.days", onDate);
    if (profile?.maternityDisabledChild) {
      const extra = ruleAt("leave.maternity.disabledChildDays", onDate);
      if (extra) days += extra.value;
    }
    return days;
  }
  const row = LEAVE_TYPES.find((t) => t.key === k);
  return row && "total" in row ? row.total : null;
}

function getLeaveTotal(profile: LeaveApproveExtras["profile"], key: string, onDate?: string) {
  const floor = statutoryLeaveFloor(key, profile, onDate);
  const custom = profile?.leaveTotals?.[key];
  if (floor == null) return custom ?? null;
  if (custom == null) return floor;
  return Math.max(Number(custom) || 0, floor);
}

function unusedFromPreviousYear(profile: LeaveApproveExtras["profile"], requests: LeaveRequestLike[] | undefined, onDate?: string) {
  const hire = dateOnly(profile?.hireDate);
  const current = anniversaryYearWindow(hire, onDate);
  if (!current || !hire || current.start === hire) return 0;
  const prevEnd = addCalendarDays(current.start, -1);
  const prev = anniversaryYearWindow(hire, prevEnd);
  if (!prev) return 0;
  const entitlement = getLeaveTotal(profile, "annual", prev.end) ?? 0;
  const used = usedLeaveDays(requests, "annual", prev.end, hire);
  return Math.max(0, entitlement - used);
}

export function leaveNeedsArticle118Ack(type?: string) {
  const key = String(type || "").trim().toLowerCase();
  return LEAVE_TYPES.some((row) => row.key === key);
}

export function checkNoOtherEmployerGate(request: LeaveRequestLike | null | undefined) {
  const type = String(request?.type || "").trim().toLowerCase();
  if (!leaveNeedsArticle118Ack(type)) return { ok: true as const };
  if (request?.noOtherEmployerAck === true) return { ok: true as const };
  return {
    ok: false as const,
    error: "NO_OTHER_EMPLOYER_ACK",
    reason: "موقوف — يلزم الإقرار بعدم العمل لدى صاحب عمل آخر أثناء الإجازة (المادة 118).",
    reasonEn: "Blocked — acknowledge that you will not work for another employer during this leave (Article 118).",
    cite: citeRule("leave.noOtherEmployer.cite", request?.startDate),
  };
}

/** Art. 109(2): employer-set annual leave needs 30 days' notice. Worker-chosen dates do not. */
export function checkAnnualNoticeGate(request: LeaveRequestLike | null | undefined, extras: LeaveApproveExtras = {}) {
  const type = String(request?.type || "").trim().toLowerCase();
  if (type !== "annual") return { ok: true as const };
  const recorded = !!(request?.recordedBy || extras.recordedBy || extras.employerRecorded);
  if (!recorded) return { ok: true as const };
  const start = String(request?.startDate || "").slice(0, 10);
  const needed = ruleValue("leave.annual.noticeDays", start || extras.onDate);
  const until = daysUntilLeaveStart(start, extras.onDate);
  if (until == null || until >= needed) return { ok: true as const };
  return {
    ok: false as const,
    error: "ANNUAL_NOTICE_DAYS",
    reason: `موقوف — تحديد صاحب العمل لميعاد الإجازة السنوية يلزم إشعاراً قبل ${needed} يوماً على الأقل (المادة 109).`,
    reasonEn: `Blocked — when the employer sets annual-leave dates, the worker must be notified at least ${needed} days ahead (Article 109).`,
    cite: citeRule("leave.annual.noticeDays", start || extras.onDate),
    needed,
    until,
  };
}

export function checkAnnualDeferGate(request: LeaveRequestLike | null | undefined, extras: LeaveApproveExtras = {}) {
  const type = String(request?.type || "").trim().toLowerCase();
  if (type !== "annual") return { ok: true as const };
  const recorded = !!(request?.recordedBy || extras.recordedBy || extras.employerRecorded);
  if (!recorded) return { ok: true as const };
  const profile = extras.profile || {};
  const start = String(request?.startDate || "").slice(0, 10);
  const requests = extras.requests || profile.leaveRequests || [];
  const usedThisYear = usedLeaveDays(requests, "annual", start, profile.hireDate);
  const carryTotal = unusedFromPreviousYear(profile, requests, start);
  const carryLeft = Math.max(0, carryTotal - Math.min(carryTotal, usedThisYear));
  if (carryLeft <= 0) return { ok: true as const };
  const win = anniversaryYearWindow(profile.hireDate, start);
  if (!win) return { ok: true as const };
  const yearEnd = addCalendarDays(win.start, -1);
  const cap = ruleValue("leave.annual.deferMaxDays", start);
  const latest = addCalendarDays(yearEnd, cap);
  if (!start || start <= latest) return { ok: true as const };
  if (request?.deferConsentAt || profile.annualDeferConsentAt) return { ok: true as const };
  return {
    ok: false as const,
    error: "ANNUAL_DEFER_CONSENT",
    reason: `موقوف — تأجيل رصيد السنة السابقة بعد ${cap} يوماً من نهايتها يحتاج موافقة العامل كتابة (المادة 110).`,
    reasonEn: `Blocked — postponing last year's leave more than ${cap} days after that year needs the worker's written consent (Article 110).`,
    cite: citeRule("leave.annual.deferMaxDays", start),
  };
}

export function deriveExamLeaveSettlement(request: LeaveRequestLike | null | undefined, extras: LeaveApproveExtras = {}) {
  if (String(request?.type || "").trim().toLowerCase() !== "exam") {
    return { track: "" as const, payFrom: "" as const };
  }
  const consent = checkExamStudyConsentGate(request, extras);
  const track = ("examLeaveTrack" in consent && consent.examLeaveTrack) || EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID;
  if (track === EXAM_LEAVE_TRACK_PAID) {
    return {
      track,
      payFrom: request?.examRepeat || extras.examRepeat ? "unpaid" as const : "paid" as const,
      reason: "reason" in consent ? consent.reason : undefined,
      reasonEn: "reasonEn" in consent ? consent.reasonEn : undefined,
    };
  }
  const dates = checkLeaveDatesGate(request);
  const days = Number(request?.days) > 0 ? Number(request?.days) : ("days" in dates ? dates.days : 0) || 0;
  const total = getLeaveTotal(extras.profile, "annual", request?.startDate);
  const used = usedLeaveDays(extras.requests || extras.profile?.leaveRequests || [], "annual", request?.startDate, extras.profile?.hireDate);
  const remaining = total == null ? null : Math.max(0, total - used);
  return {
    track: EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID,
    payFrom: remaining != null && days > 0 && remaining >= days ? "annual" as const : "unpaid" as const,
    reason: "reason" in consent ? consent.reason : undefined,
    reasonEn: "reasonEn" in consent ? consent.reasonEn : undefined,
  };
}

export function checkSubmitLeaveGate(request: LeaveRequestLike | null | undefined, extras: LeaveApproveExtras = {}) {
  const gate = checkApproveLeaveGate({ ...(request || {}), status: "pending" }, extras);
  if (!gate.ok) return gate;
  const ack = checkNoOtherEmployerGate(request);
  if (!ack.ok) return ack;
  const settlement = deriveExamLeaveSettlement(request, extras);
  if (!settlement.track) return gate;
  return {
    ...gate,
    examLeaveTrack: settlement.track,
    examPayFrom: settlement.payFrom,
    notice: settlement.reason,
    warning: settlement.track === EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID,
    warningReason: settlement.track === EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID ? settlement.reason : undefined,
    warningReasonEn: settlement.track === EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID ? settlement.reasonEn : undefined,
  };
}

/** Named approve gate — never silent. */
export function checkApproveLeaveGate(
  request: LeaveRequestLike | null | undefined,
  extras: LeaveApproveExtras = {},
) {
  if (!request) {
    return {
      ok: false as const,
      error: "LEAVE_NOT_FOUND",
      reason: "طلب الإجازة غير موجود في نطاق الشركة.",
      reasonEn: "Leave request was not found in this company.",
    };
  }
  if (request.status && request.status !== "pending") {
    return {
      ok: false as const,
      error: "LEAVE_NOT_PENDING",
      reason: "لا يمكن اعتماد طلب غير معلّق.",
      reasonEn: "Only pending leave requests can be approved.",
    };
  }
  const start = String(request.startDate || "").slice(0, 10);
  const end = String(request.endDate || "").slice(0, 10);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(start) && iso.test(end) && end < start) {
    return {
      ok: false as const,
      error: "LEAVE_DATES_ORDER",
      reason: "موقوف — تاريخ نهاية الإجازة قبل بدايتها.",
      reasonEn: "Blocked — the leave end date is before the start date.",
    };
  }
  const computed = computeLeaveDays(start, end);
  if (!iso.test(start) || !iso.test(end) || computed <= 0) {
    return {
      ok: false as const,
      error: "LEAVE_DATES_REQUIRED",
      reason: "موقوف — تواريخ الإجازة غير مكتملة.",
      reasonEn: "Blocked — leave dates are incomplete.",
    };
  }
  const type = String(request.type || "").trim().toLowerCase();
  const gender = checkLeaveGenderGate(request, extras);
  if (!gender.ok) return gender;
  const rawDays = Number(request.days) > 0 ? Number(request.days) : computed;
  const days = (type === "annual" || type === "sick")
    ? chargeableSpanExcludingHolidays(start, end)
    : rawDays;
  const onDate = request.startDate || extras.onDate;
  const cite = citeLeaveType(type, onDate);
  const defer = checkAnnualDeferGate(request, extras);
  if (!defer.ok) return defer;
  const notice = checkAnnualNoticeGate(request, extras);
  if (!notice.ok) return notice;
  const official = checkOfficialHolidayLeaveGate(request, extras);
  if (!official.ok) return official;
  const overlap = checkOfficialHolidayOverlapGate(request, extras);
  if (!overlap.ok) return overlap;
  if (type === "hajj") {
    const hajjCite = citeRule("leave.hajj.days", onDate) || cite;
    if (!isRamadanHoursSubject({ profile: extras.profile })) {
      return {
        ok: false as const,
        error: "LEAVE_RELIGION",
        reason: "موقوف — إجازة الحج للمسلم المسجّل على الملف (المادة 114).",
        reasonEn: "Blocked — Hajj leave is for a Muslim recorded on the file (Article 114).",
        cite: hajjCite,
      };
    }
    const minDays = ruleValue("leave.hajj.days", onDate);
    const maxDays = ruleValue("leave.hajj.maxDays", onDate);
    const minYears = ruleValue("leave.hajj.minServiceYears", onDate);
    const span = computed || days;
    if (span < minDays) {
      return {
        ok: false as const,
        error: "HAJJ_UNDER_MIN",
        reason: `موقوف — إجازة الحج لا تقل عن ${minDays} أيام شاملة عيد الأضحى.`,
        reasonEn: `Blocked — Hajj leave may not be less than ${minDays} days including Eid al-Adha.`,
        cite: hajjCite,
      };
    }
    if (span > maxDays) {
      return {
        ok: false as const,
        error: "HAJJ_OVER_MAX",
        reason: `موقوف — إجازة الحج لا تزيد على ${maxDays} يوماً شاملة عيد الأضحى.`,
        reasonEn: `Blocked — Hajj leave may not exceed ${maxDays} days including Eid al-Adha.`,
        cite: hajjCite,
      };
    }
    const years = serviceYearsFromHire(extras.profile?.hireDate, onDate);
    if (years < minYears) {
      return {
        ok: false as const,
        error: "HAJJ_SERVICE",
        reason: `موقوف — إجازة الحج بعد ${minYears} سنتين متصلتين في الخدمة.`,
        reasonEn: `Blocked — Hajj leave requires ${minYears} consecutive years of service.`,
        cite: hajjCite,
      };
    }
    const prior = (extras.requests || extras.profile?.leaveRequests || []).some(
      (r) => r?.type === "hajj" && r?.status === "approved" && r?.id !== request.id,
    );
    if (prior || extras.profile?.hajjPerformed) {
      return {
        ok: false as const,
        error: "HAJJ_ONCE",
        reason: "موقوف — إجازة الحج مرة واحدة طوال مدة الخدمة إن لم يُؤدَّ من قبل.",
        reasonEn: "Blocked — Hajj leave is once during service if it has not been performed before.",
        cite: hajjCite,
      };
    }
  }
  if (type === "paternity") {
    const event = String(request.eventDate || extras.eventDate || "").slice(0, 10);
    const start = String(request.startDate || "").slice(0, 10);
    const window = ruleValue("leave.paternity.windowDays", onDate);
    const pCite = citeRule("leave.paternity.windowDays", onDate) || cite;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event)) {
      return {
        ok: false as const,
        error: "PATERNITY_EVENT_DATE_REQUIRED",
        reason: "موقوف — تاريخ الولادة لازم لإجازة المولود خلال سبعة أيام.",
        reasonEn: "Blocked — the birth date is required so paternity leave stays within seven days.",
        cite: pCite,
      };
    }
    const latest = addCalendarDays(event, window - 1);
    if (!start || start < event || start > latest) {
      return {
        ok: false as const,
        error: "PATERNITY_WINDOW",
        reason: `موقوف — إجازة المولود خلال ${window} أيام من تاريخ الولادة (${event}–${latest}).`,
        reasonEn: `Blocked — paternity leave must start within ${window} days of the birth (${event}–${latest}).`,
        cite: pCite,
      };
    }
    const maxDays = ruleValue("leave.paternity.days", onDate);
    if (days > maxDays) {
      return {
        ok: false as const,
        error: "PATERNITY_DAYS",
        reason: `موقوف — إجازة المولود ${maxDays} أيام بأجر كامل (المادة 113).`,
        reasonEn: `Blocked — paternity leave is ${maxDays} paid days (Article 113).`,
        cite: citeRule("leave.paternity.days", onDate) || pCite,
      };
    }
  }
  if (type === "marriage" || type === "bereavement" || type === "bereavement_sibling") {
    const event = String(request.eventDate || extras.eventDate || "").slice(0, 10);
    const start = String(request.startDate || "").slice(0, 10);
    const end = String(request.endDate || "").slice(0, 10);
    if (type === "bereavement_sibling" && !ruleAt(`leave.${type}.days`, onDate)) {
      return {
        ok: false as const,
        error: "LEAVE_NOT_IN_FORCE",
        reason: "موقوف — إجازة وفاة الأخ أو الأخت من تعديل 19 فبراير 2025 (المادة 113).",
        reasonEn: "Blocked — sibling bereavement leave is from the 19 February 2025 amendment (Article 113).",
        cite: null,
      };
    }
    const maxDays = ruleValue(`leave.${type}.days`, onDate);
    const eCite = citeRule(`leave.${type}.days`, onDate) || cite;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event)) {
      return {
        ok: false as const,
        error: "EVENT_DATE_REQUIRED",
        reason: "موقوف — تاريخ الواقعة لازم، وتُحتسب الإجازة منه (المادة 113).",
        reasonEn: "Blocked — the event date is required; the leave is counted from that date (Article 113).",
        cite: eCite,
      };
    }
    const latest = addCalendarDays(event, maxDays - 1);
    if (!start || start !== event || (end && end > latest)) {
      return {
        ok: false as const,
        error: "EVENT_LEAVE_WINDOW",
        reason: `موقوف — الإجازة تُحتسب من تاريخ الواقعة (${event}–${latest}).`,
        reasonEn: `Blocked — the leave is counted from the date of the event (${event}–${latest}).`,
        cite: eCite,
      };
    }
  }
  if (type === "maternity") {
    const event = String(request.eventDate || extras.eventDate || "").slice(0, 10);
    const start = String(request.startDate || "").slice(0, 10);
    const end = String(request.endDate || "").slice(0, 10);
    const postInForce = ruleAt("leave.maternity.mandatoryPostDays", onDate);
    if (postInForce) {
    const postDays = ruleValue("leave.maternity.mandatoryPostDays", onDate);
    const mCite = citeRule("leave.maternity.mandatoryPostDays", onDate) || cite;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event)) {
      return {
        ok: false as const,
        error: "MATERNITY_EVENT_DATE_REQUIRED",
        reason: "موقوف — تاريخ الوضع لازم لتغطية الأسابيع الستة الوجوبية بعد الولادة.",
        reasonEn: "Blocked — the birth date is required so the six mandatory post-birth weeks are covered.",
        cite: mCite,
      };
    }
    const postEnd = addCalendarDays(event, postDays - 1);
    const preMax = ruleValue("leave.maternity.preDaysMax", onDate);
    const earliest = addCalendarDays(event, -preMax);
    if (start && start < earliest) {
      return {
        ok: false as const,
        error: "MATERNITY_PRE_WINDOW",
        reason: `موقوف — لا تبدأ إجازة الوضع قبل أربعة أسابيع من التاريخ المرجح (${earliest}).`,
        reasonEn: `Blocked — maternity leave may not start more than four weeks before the expected date (${earliest}).`,
        cite: citeRule("leave.maternity.preDaysMax", onDate) || mCite,
      };
    }
    if (!start || !end || start > event || end < postEnd) {
      return {
        ok: false as const,
        error: "MATERNITY_POST_BIRTH",
        reason: `موقوف — إجازة الوضع تغطي الأسابيع الستة التالية للوضع (${event}–${postEnd}).`,
        reasonEn: `Blocked — maternity leave must cover the six weeks after birth (${event}–${postEnd}).`,
        cite: mCite,
      };
    }
    }
  }
  let examVia: string | null | undefined;
  let examIssuedAt: string | undefined;
  if (type === "exam") {
    const examNotice = checkExamNoticeGate(request, extras);
    if (!examNotice.ok) return examNotice;
    examVia = "via" in examNotice ? examNotice.via : "notice";
    examIssuedAt = "examNoticeIssuedAt" in examNotice ? examNotice.examNoticeIssuedAt : undefined;
  }
  let warning: string | null = null;
  let warningReason: string | undefined;
  let warningReasonEn: string | undefined;
  if (type === "iddah") {
    const event = String(request.eventDate || extras.eventDate || "").slice(0, 10);
    const start = String(request.startDate || "").slice(0, 10);
    const end = String(request.endDate || "").slice(0, 10);
    const iCite = citeRule("leave.iddah.cite", onDate) || cite;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event)) {
      return {
        ok: false as const,
        error: "EVENT_DATE_REQUIRED",
        reason: "موقوف — تاريخ الوفاة لازم لعدّة وفاة الزوج (المادة 160).",
        reasonEn: "Blocked — the date of death is required for iddah leave (Article 160).",
        cite: iCite,
      };
    }
    const paid = isRamadanHoursSubject({ profile: extras.profile })
      ? ruleValue("leave.iddah.days", event)
      : ruleValue("leave.iddah.nonMuslimDays", event);
    const latestPaid = addCalendarDays(event, paid - 1);
    const pregnant = !!(request.iddahPregnant || extras.iddahPregnant) && isRamadanHoursSubject({ profile: extras.profile });
    if (start !== event) {
      return {
        ok: false as const,
        error: "EVENT_LEAVE_WINDOW",
        reason: `موقوف — العدة تُحتسب من تاريخ الوفاة (${event}).`,
        reasonEn: `Blocked — iddah is counted from the date of death (${event}).`,
        cite: iCite,
      };
    }
    if (!end || end < latestPaid) {
      return {
        ok: false as const,
        error: "IDDAH_UNDER_MIN",
        reason: `موقوف — العدة لا تقل عن ${paid} يوماً من تاريخ الوفاة (${event}–${latestPaid}).`,
        reasonEn: `Blocked — iddah may not be less than ${paid} days from the date of death (${event}–${latestPaid}).`,
        cite: iCite,
      };
    }
    if (end > latestPaid && !pregnant) {
      return {
        ok: false as const,
        error: "IDDAH_OVER_PAID",
        reason: `موقوف — العدة بأجر تنتهي في ${latestPaid}. التمديد بلا أجر للمسلمة الحامل حتى تضع فقط (المادة 160).`,
        reasonEn: `Blocked — paid iddah ends on ${latestPaid}. An unpaid extension is only for a pregnant Muslim widow until birth (Article 160).`,
        cite: iCite,
      };
    }
    if (end > latestPaid && pregnant) {
      warning = "IDDAH_UNPAID_TAIL";
      warningReason = `تنبيه — ما زاد على ${paid} يوماً بلا أجر حتى الوضع، ولا تُكمَّل العدة بعد الولادة (المادة 160).`;
      warningReasonEn = `Notice — days beyond ${paid} are unpaid until birth, and remaining iddah is not used after birth (Article 160).`;
    }
  }
  if (type === "maternity_extend" || type === "maternity_companion") {
    const start = String(request.startDate || "").slice(0, 10);
    const end = String(request.endDate || "").slice(0, 10);
    const followCite = citeRule(type === "maternity_companion" ? "leave.maternity.disabledChildDays" : "leave.maternity.unpaidExtendDays", onDate) || cite;
    const pool = extras.requests || extras.profile?.leaveRequests || [];
    const mat = [...pool]
      .filter((row) => String(row?.type || "").toLowerCase() === "maternity" && row?.status === "approved" && String(row.endDate || "").slice(0, 10))
      .sort((a, b) => String(b.endDate).slice(0, 10).localeCompare(String(a.endDate).slice(0, 10)))[0];
    if (!mat) {
      return {
        ok: false as const,
        error: "MATERNITY_FOLLOW_REQUIRED",
        reason: "موقوف — التمديد أو المرافقة تبدأ بعد انتهاء إجازة وضع معتمدة (المادة 151).",
        reasonEn: "Blocked — the extension or companion month starts after an approved maternity leave ends (Article 151).",
        cite: followCite,
      };
    }
    const after = addCalendarDays(String(mat.endDate || "").slice(0, 10), 1);
    if (!start || start < after) {
      return {
        ok: false as const,
        error: "MATERNITY_FOLLOW_WINDOW",
        reason: `موقوف — تبدأ بعد انتهاء الوضع، من ${after}.`,
        reasonEn: `Blocked — it starts after maternity ends, from ${after}.`,
        cite: followCite,
      };
    }
    const paid = type === "maternity_companion"
      ? ruleValue("leave.maternity.disabledChildDays", onDate)
      : ruleValue("leave.maternity.unpaidExtendDays", onDate);
    const unpaidExtra = type === "maternity_companion" ? ruleValue("leave.maternity.unpaidExtendDays", onDate) : 0;
    const extendUnpaid = type === "maternity_companion" && !!(request.companionUnpaidExtend || extras.companionUnpaidExtend);
    const span = computeLeaveDays(start, end) || days;
    if (type === "maternity_extend" && span > paid) {
      return {
        ok: false as const,
        error: "MATERNITY_EXTEND_OVER",
        reason: `موقوف — تمديد الوضع بلا أجر شهر واحد (${paid} يوماً) بعد انتهائها (المادة 151).`,
        reasonEn: `Blocked — the unpaid maternity extension is one month (${paid} days) after it ends (Article 151).`,
        cite: followCite,
      };
    }
    if (type === "maternity_companion" && span > paid && !extendUnpaid) {
      return {
        ok: false as const,
        error: "COMPANION_OVER_PAID",
        reason: `موقوف — شهر المرافقة بأجر ${paid} يوماً. التمديد بلا أجر شهر إضافي إن لزم (المادة 151 فقرة 2).`,
        reasonEn: `Blocked — the paid companion month is ${paid} days. An extra unpaid month is available if needed (Article 151(2)).`,
        cite: followCite,
      };
    }
    if (type === "maternity_companion" && extendUnpaid && span > paid + unpaidExtra) {
      return {
        ok: false as const,
        error: "COMPANION_OVER_MAX",
        reason: `موقوف — المرافقة شهر بأجر وشهر بلا أجر فقط (${paid + unpaidExtra} يوماً).`,
        reasonEn: `Blocked — companion leave is one paid month and one unpaid month only (${paid + unpaidExtra} days).`,
        cite: followCite,
      };
    }
    if (type === "maternity_companion" && extendUnpaid && span > paid) {
      warning = "COMPANION_UNPAID_TAIL";
      warningReason = `تنبيه — ما زاد على ${paid} يوماً بلا أجر حتى الشهر الإضافي (المادة 151 فقرة 2).`;
      warningReasonEn = `Notice — days beyond ${paid} are unpaid up to the extra month (Article 151(2)).`;
    }
  }
  if (type === "unpaid") {
    const cap = ruleValue("leave.unpaid.suspendAfterDays", onDate);
    if (days > cap) {
      warning = "CONTRACT_SUSPENDED";
      warningReason = `تنبيه — الإجازة بلا أجر فيما زاد على ${cap} يوماً توقف العقد ما لم يتفق الطرفان على خلاف ذلك.`;
      warningReasonEn = `Notice — unpaid leave beyond ${cap} days suspends the contract unless the parties agree otherwise.`;
    }
  }
  const skipBalance = type === "unpaid" || type === "exam" || type === "hajj" || type === "eid" || type === "iddah" || type === "maternity_extend" || type === "maternity_companion" || request.examRepeat;
  if (type && !skipBalance && extras.profile) {
    const profile = { ...extras.profile };
    if (type === "maternity" && (request.disabledChild || extras.disabledChild)) {
      profile.maternityDisabledChild = true;
    }
    const requests = extras.requests || extras.profile?.leaveRequests || [];
    if (type === "grant") {
      const granted = (profile.discretionaryGrants || []).reduce((n, grant) => n + Math.max(0, Number(grant.days) || 0), 0);
      const remaining = Math.max(0, granted - usedLeaveDays(requests, "grant", onDate, profile.hireDate));
      if (days > remaining) {
        return {
          ok: false as const,
          error: "LEAVE_BALANCE_EXCEEDED",
          reason: `موقوف — يتجاوز الطلب الرصيد التقديري (المتبقي ${remaining} يوماً). لا يُسحب من المستحق النظامي.`,
          reasonEn: `Blocked — the request exceeds the discretionary balance (${remaining} days left). It is not taken from the statutory entitlement.`,
          cite,
          remaining,
          total: granted,
          days,
        };
      }
    }
    const total = getLeaveTotal(profile, type, onDate);
    if (total != null) {
      const used = usedLeaveDays(extras.requests || extras.profile?.leaveRequests || [], type, onDate, extras.profile?.hireDate);
      const remaining = Math.max(0, total - used);
      if (days > remaining) {
        return {
          ok: false as const,
          error: "LEAVE_BALANCE_EXCEEDED",
          reason: `موقوف — يتجاوز الطلب الرصيد النظامي (المتبقي ${remaining} من ${total} يوماً).`,
          reasonEn: `Blocked — the request exceeds the statutory balance (${remaining} of ${total} days left).`,
          cite,
          remaining,
          total,
          days,
        };
      }
    }
  }
  if (leaveNeedsAttachment(request) && !hasLeaveAttachment(request)) {
    return {
      ok: false as const,
      error: "ATTACHMENT_REQUIRED",
      reason: `لا يمكن الاعتماد — يلزم مستند لطلب يتجاوز ${ruleValue("leave.attachment.thresholdDays")} أيام (أو لنوع يتطلب مرفقًا).`,
      reasonEn: `Approval blocked — a document is required for a request over ${ruleValue("leave.attachment.thresholdDays")} days (or a type that requires an attachment).`,
      days,
      threshold: ruleValue("leave.attachment.thresholdDays"),
      warning,
      warningReason,
      warningReasonEn,
    };
  }
  return { ok: true as const, days, cite, via: examVia || null, examNoticeIssuedAt: examIssuedAt, warning, reason: warningReason, reasonEn: warningReasonEn };
}

/** Article 117 sick-pay bands: 30 full, 60 at three-quarters, 30 unpaid. */
export function deriveSickPayBand(usedDays = 0, onDate?: string) {
  const full = ruleValue("leave.sick.fullPayDays", onDate);
  const half = ruleValue("leave.sick.halfPayDays", onDate);
  const unpaid = ruleValue("leave.sick.unpaidDays", onDate);
  const used = Math.max(0, Number(usedDays) || 0);
  const cite = citeLeaveType("sick");
  if (used < full) return { band: "full" as const, remaining: full - used, cite };
  if (used < full + half) return { band: "three_quarter" as const, remaining: full + half - used, cite };
  if (used < full + half + unpaid) return { band: "unpaid" as const, remaining: full + half + unpaid - used, cite };
  return { band: "exhausted" as const, remaining: 0, cite };
}

/** Derived queue stats — never stored literals. */
export function deriveLeaveStats(requests: LeaveRequestLike[]) {
  const list = Array.isArray(requests) ? requests : [];
  const pending = list.filter((r) => (r.status || "pending") === "pending");
  const approved = list.filter((r) => r.status === "approved");
  const rejected = list.filter((r) => r.status === "rejected");
  const needsDoc = pending.filter((r) => leaveNeedsAttachment(r) && !hasLeaveAttachment(r));
  return {
    total: list.length,
    pending: pending.length,
    approved: approved.length,
    rejected: rejected.length,
    needsDoc: needsDoc.length,
  };
}

/** Inclusive cover range: requested dates win over a stale approval-day window. */
export function leaveCoverRange(request: LeaveRequestLike | null | undefined) {
  const start = String(request?.startDate || "").slice(0, 10);
  const end = String(request?.endDate || "").slice(0, 10);
  if (start && end) return { start, end };
  const activeStart = String(request?.activeStartDate || "").slice(0, 10);
  const activeEnd = String(request?.activeEndDate || "").slice(0, 10);
  if (activeStart && activeEnd) return { start: activeStart, end: activeEnd };
  return { start: "", end: "" };
}

/** True when an approved request covers the day (requested start/end win). */
export function isOnApprovedLeave(requests: LeaveRequestLike[] | null | undefined, dayKey: string) {
  const day = String(dayKey || "").slice(0, 10);
  if (!day) return false;
  return (requests || []).some((request) => {
    if (request.status !== "approved") return false;
    const { start, end } = leaveCoverRange(request);
    return !!start && !!end && start <= day && day <= end;
  });
}

/** طلباتي blob + Employee entity — punch must see the same approved leave. */
export const LEAVE_ROSTER_BLOB = "leaveRoster";

export function mergeLeaveRequestLists(...lists: Array<LeaveRequestLike[] | null | undefined>) {
  const byKey = new Map<string, LeaveRequestLike>();
  for (const list of lists) {
    for (const row of list || []) {
      if (!row || typeof row !== "object") continue;
      const span = leaveCoverRange(row);
      const id = String((row as { id?: string }).id || "").trim();
      const key = id || `${String(row.type || "")}:${span.start}:${span.end}:${String(row.status || "")}`;
      const prev = byKey.get(key);
      if (!prev || (row.status === "approved" && prev.status !== "approved")) {
        byKey.set(key, row);
      }
    }
  }
  return [...byKey.values()];
}

export function leaveRosterFromEmployees(
  employees: Array<{ id?: string; employeeId?: string; stationId?: string; leaveRequests?: LeaveRequestLike[]; otherRequests?: unknown[] }> | null | undefined,
) {
  return (employees || []).map((employee) => ({
    id: employee.id || employee.employeeId,
    employeeId: employee.id || employee.employeeId,
    stationId: employee.stationId || null,
    leaveRequests: employee.leaveRequests || [],
    otherRequests: employee.otherRequests || [],
  }));
}

export function leaveRequestsForEmployeeId(
  employeeId: string,
  sources: {
    entity?: { leaveRequests?: LeaveRequestLike[]; employeeId?: string; id?: string } | null;
    roster?: Array<{ id?: string; employeeId?: string; leaveRequests?: LeaveRequestLike[] }> | null;
  } = {},
) {
  const id = String(employeeId || "");
  const blobEmp = (sources.roster || []).find((row) => String(row?.id || row?.employeeId || "") === id) || null;
  return mergeLeaveRequestLists(sources.entity?.leaveRequests, blobEmp?.leaveRequests);
}

function mergeOtherRequestLists(...lists: Array<unknown[] | null | undefined>) {
  const byKey = new Map<string, unknown>();
  for (const list of lists) {
    for (const row of list || []) {
      if (!row || typeof row !== "object") continue;
      const rec = row as { id?: string; type?: string; createdAt?: string; status?: string; reviewedAt?: string; updatedAt?: string };
      const id = String(rec.id || "").trim();
      const key = id || `${String(rec.type || "")}:${String(rec.createdAt || "")}:${String(rec.status || "")}`;
      const prev = byKey.get(key) as { reviewedAt?: string; updatedAt?: string; createdAt?: string } | undefined;
      if (!prev) {
        byKey.set(key, row);
        continue;
      }
      const prevAt = Date.parse(String(prev.reviewedAt || prev.updatedAt || prev.createdAt || "")) || 0;
      const nextAt = Date.parse(String(rec.reviewedAt || rec.updatedAt || rec.createdAt || "")) || 0;
      byKey.set(key, nextAt >= prevAt ? row : prev);
    }
  }
  return [...byKey.values()];
}

/** Calendar / punch / إدارة see طلباتي + leaveRoster (leave + other bags). */
export function hydrateEmployeesLeave<T extends { id?: string; employeeId?: string; leaveRequests?: LeaveRequestLike[]; otherRequests?: unknown[] }>(
  employees: T[] | null | undefined,
  data?: { leaveRoster?: Array<{ id?: string; employeeId?: string; leaveRequests?: LeaveRequestLike[]; otherRequests?: unknown[] }> } | null,
) {
  const roster = data?.leaveRoster || [];
  return (employees || []).map((employee) => {
    if (!employee) return employee;
    const merged = leaveRequestsForEmployeeId(String(employee.id || employee.employeeId || ""), {
      entity: employee,
      roster,
    });
    const blobEmp = roster.find((row) => String(row?.id || row?.employeeId || "") === String(employee.id || employee.employeeId || "")) || null;
    const incomingOther = Array.isArray(employee.otherRequests) ? employee.otherRequests : undefined;
    const blobOther = Array.isArray(blobEmp?.otherRequests) ? blobEmp.otherRequests : undefined;
    const mergedOther = incomingOther === undefined
      ? (blobOther || employee.otherRequests || [])
      : mergeOtherRequestLists(blobOther, incomingOther);
    const prev = employee.leaveRequests || [];
    const prevOther = employee.otherRequests || [];
    const leaveSame = merged.length === prev.length && merged.every((row, i) => row === prev[i]);
    const otherSame = mergedOther.length === prevOther.length && mergedOther.every((row, i) => row === prevOther[i]);
    if (leaveSame && otherSame) return employee;
    return { ...employee, leaveRequests: merged, otherRequests: mergedOther };
  });
}

export function mergeEmployeeLists<T extends { id?: string; employeeId?: string }>(...lists: Array<T[] | null | undefined>) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const list of lists) {
    for (const row of list || []) {
      const id = String(row?.id || row?.employeeId || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
  }
  return out;
}

function riyadhDayKey(onDate?: string) {
  if (onDate) return String(onDate).slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}

const APPROVED_LEAVE_ALTER = new Set(["rejected", "revise", "withdrawn", "pending"]);

/** After approval the requested dates are a fixed right. Only the worker may withdraw, and only before start. */
export function approvedLeaveWithdrawWindow(request: LeaveRequestLike | null | undefined, onDate?: string) {
  if (!request || request.status !== "approved") return { open: false, start: "", today: riyadhDayKey(onDate) };
  const start = leaveCoverRange(request).start;
  const today = riyadhDayKey(onDate);
  return { open: !!start && today < start, start, today };
}

export function checkAlterApprovedLeaveGate(
  request: LeaveRequestLike | null | undefined,
  extras: { nextStatus?: string; action?: string; actor?: string; employeeConsent?: boolean; onDate?: string } = {},
) {
  if (!request || request.status !== "approved") return { ok: true as const };
  const next = String(extras.nextStatus || extras.action || "").trim().toLowerCase();
  if (!next || next === "approved" || !APPROVED_LEAVE_ALTER.has(next)) return { ok: true as const };
  const cite = citeLeaveType(request.type || "annual", request.startDate) || citeRule("leave.annual.days", request.startDate);
  const window = approvedLeaveWithdrawWindow(request, extras.onDate);
  const actor = extras.actor === "employee" ? "employee" : "manager";
  if (next === "withdrawn" && actor === "employee") {
    if (!window.start) {
      return {
        ok: false as const,
        error: "LEAVE_NO_START",
        reason: "موقوف — لا يُسحب طلب بلا تاريخ بدء.",
        reasonEn: "Blocked — a request with no start date cannot be withdrawn.",
        cite,
      };
    }
    if (!window.open) {
      return {
        ok: false as const,
        error: "LEAVE_ALREADY_STARTED",
        reason: `موقوف — الإجازة المعتمدة حق ثابت وقد حلّ موعد بدئها (${window.start}). لا تُسحب بعد حلول البدء.`,
        reasonEn: `Blocked — approved leave is a fixed right and its start (${window.start}) has arrived. It cannot be withdrawn after that day.`,
        cite,
      };
    }
    if (extras.employeeConsent !== true) {
      return {
        ok: false as const,
        error: "LEAVE_WITHDRAW_ACK",
        reason: "موقوف — سحب الإجازة المعتمدة يلزم إقرارك الصريح قبل موعد البدء، لإشعار الإدارة وتعديل الجدول.",
        reasonEn: "Blocked — withdrawing approved leave needs your explicit acknowledgement before the start date, so operations can adjust the roster.",
        cite,
      };
    }
    return { ok: true as const, cite };
  }
  return {
    ok: false as const,
    error: "LEAVE_APPROVED_LOCKED",
    reason: "موقوف — الإجازة المعتمدة حق ثابت في تاريخها. لا تُلغى ولا يُغيَّر موعدها من الإدارة إلا بموافقة العامل وقبل حلول البدء (المادة 109).",
    reasonEn: "Blocked — approved leave is a fixed right on its dates. Management cannot cancel or move it without the worker's consent before it starts (Article 109).",
    cite,
  };
}

/** Employee-only: mark an approved leave decision as seen so the card can leave ملفي. */
export function checkSeeLeaveDecisionGate(
  extras: { request?: LeaveRequestLike | null; employeeId?: string; actorId?: string } = {},
) {
  const request = extras.request;
  if (!request || request.status !== "approved") {
    return {
      ok: false as const,
      error: "LEAVE_NOT_APPROVED",
      reason: "لا قرار اعتماد لتُرى.",
      reasonEn: "There is no approved leave decision to see.",
    };
  }
  if (!extras.actorId || String(extras.actorId) !== String(extras.employeeId || "")) {
    return {
      ok: false as const,
      error: "EMPLOYEE_ONLY",
      reason: "رؤية قرار الإجازة من ملفي فقط.",
      reasonEn: "Only the worker sees the leave decision from My file.",
    };
  }
  return { ok: true as const, already: !!(request as { decisionSeenAt?: string }).decisionSeenAt };
}

export function leaveDecisionNoticeKey(employeeId: string, requestId: string) {
  return `leave-decision:${employeeId}:${requestId}`;
}

/** Blocks punch when an approved leave covers the day. */
export function checkCheckInLeaveGate(
  requests: LeaveRequestLike[] | null | undefined,
  dayKey: string,
) {
  if (isOnApprovedLeave(requests, dayKey)) {
    return {
      ok: false as const,
      error: "ON_APPROVED_LEAVE",
      reason: "لا يمكن تسجيل الحضور — لديك إجازة معتمدة لهذا اليوم.",
      reasonEn: "Check-in blocked — you have approved leave for this day.",
    };
  }
  return { ok: true as const };
}
