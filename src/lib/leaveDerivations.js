/** Client helpers aligned with base44/shared/leaveDerivations.ts */

import { profileGender } from "./employeeProfileFields.js";
import { citeLeaveType, citeRule, isRamadanHoursSubject, ruleAt, ruleValue } from "./laborRules.js";
import { daysUntilLeaveStart } from "./leaveEntitlementCycle.js";
import { officialHolidayKindLabel, officialHolidayList, officialHolidayOn } from "./ummAlQuraCalendar.js";
import { chargeableSpanExcludingHolidays, deriveEidOverlap } from "./leaveEidOverlap.js";
import { annualBalanceSplit, anniversaryYearWindow, getLeaveTotal, leftoverGrantDays, leaveCoverRange, leaveTypeLabel, remainingLeaveDays, usedLeaveDays, serviceYearsFromHire, iddahPaidDays, lastApprovedMaternity } from "./leaveTypes.js";
import { articleOfficialText } from "./laborArticleTexts.js";
import { checkExamStudyConsentGate, EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID, EXAM_LEAVE_TRACK_PAID } from "./otherRequestDerivations.js";
import { otherRequestsForEmployeeId } from "./employeeRequestBags.js";

export const CHAPTER_LEAVE_TYPES = [
  "annual", "grant", "sick", "maternity", "maternity_extend", "maternity_companion", "iddah", "paternity", "marriage", "bereavement", "bereavement_sibling", "hajj", "eid", "exam", "emergency", "unpaid",
];

export const LEAVE_THRESHOLD_DAYS = ruleValue("leave.attachment.thresholdDays");

export const LEAVE_TYPES = [
  { key: "annual", total: ruleValue("leave.annual.days"), article: citeLeaveType("annual")?.article || null, ar: "سنوية", en: "Annual" },
  { key: "grant", total: null, article: null, ar: "رصيد", en: "Granted days" },
  { key: "sick", total: ruleValue("leave.sick.days"), article: citeLeaveType("sick")?.article || null, ar: "مرضية", en: "Sick", requiresFile: true },
  { key: "maternity", total: ruleValue("leave.maternity.days"), article: citeLeaveType("maternity")?.article || null, ar: "أمومة", en: "Maternity", f: true, requiresFile: true },
  { key: "maternity_extend", total: ruleValue("leave.maternity.unpaidExtendDays"), article: citeLeaveType("maternity_extend")?.article || "151", ar: "تمديد وضع بلا أجر", en: "Unpaid maternity extension", f: true },
  { key: "maternity_companion", total: ruleValue("leave.maternity.disabledChildDays"), article: citeLeaveType("maternity_companion")?.article || "151", ar: "مرافقة مولود مريض/معاق", en: "Sick or disabled-child companion", f: true, requiresFile: true },
  { key: "iddah", total: ruleValue("leave.iddah.days"), article: citeLeaveType("iddah")?.article || null, ar: "عدّة وفاة الزوج", en: "Iddah", f: true, requiresFile: true },
  { key: "paternity", total: ruleValue("leave.paternity.days"), article: citeLeaveType("paternity")?.article || null, ar: "أبوة", en: "Paternity", m: true },
  { key: "marriage", total: ruleValue("leave.marriage.days"), article: citeLeaveType("marriage")?.article || null, ar: "زواج", en: "Marriage" },
  { key: "bereavement", total: ruleValue("leave.bereavement.days"), article: citeLeaveType("bereavement")?.article || null, ar: "وفاة زوج/أصل/فرع", en: "Bereavement" },
  { key: "bereavement_sibling", total: ruleValue("leave.bereavement_sibling.days"), article: citeLeaveType("bereavement_sibling")?.article || null, ar: "وفاة أخ/أخت", en: "Sibling bereavement" },
  { key: "hajj", total: ruleValue("leave.hajj.days"), article: citeLeaveType("hajj")?.article || null, ar: "حج", en: "Hajj" },
  { key: "eid", total: null, article: citeLeaveType("eid")?.article || null, ar: "اليوم الوطني · يوم التأسيس · العيد", en: "National Day · Founding Day · Eid" },
  { key: "exam", total: null, article: citeLeaveType("exam")?.article || null, ar: "امتحان", en: "Exam", requiresFile: true },
  { key: "emergency", total: ruleValue("leave.emergency.days"), article: citeLeaveType("emergency")?.article || null, ar: "اضطرارية", en: "Emergency" },
  { key: "unpaid", total: null, article: citeLeaveType("unpaid")?.article || null, ar: "بدون راتب", en: "Unpaid" },
];

export function computeLeaveDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const a = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(endDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  if (b.getTime() < a.getTime()) return 0;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

/** Art. 114: Hajj is 10–15 calendar days including Eid al-Adha — do not strip official holidays. */
export function leaveSpanIncludesOfficialHolidays(type) {
  return String(type || "").trim().toLowerCase() === "hajj";
}

export function chargeableLeaveDays(startDate, endDate, type, calendar) {
  const key = String(type || "").trim().toLowerCase();
  if (leaveSpanIncludesOfficialHolidays(key)) return computeLeaveDays(startDate, endDate);
  if (key === "annual" || key === "sick") return chargeableSpanExcludingHolidays(startDate, endDate, calendar);
  return computeLeaveDays(startDate, endDate);
}

export function isOfficialHolidayLeave(type) {
  return String(type || "").trim().toLowerCase() === "eid";
}

function liveLeaveRequests(request, extras = {}) {
  const id = String(request?.id || "").trim();
  return (extras.requests || extras.profile?.leaveRequests || []).filter((row) => {
    if (!row) return false;
    const otherId = String(row.id || "").trim();
    if (id && otherId && otherId === id) return false;
    const status = String(row.status || "pending");
    return status === "pending" || status === "approved";
  });
}

function rangesOverlap(a0, a1, b0, b1) {
  return !!a0 && !!a1 && !!b0 && !!b1 && a0 <= b1 && b0 <= a1;
}

export function checkOfficialHolidayLeaveGate(request, extras = {}) {
  if (!isOfficialHolidayLeave(request?.type)) return { ok: true };
  const start = String(request?.startDate || "").slice(0, 10);
  const end = String(request?.endDate || "").slice(0, 10);
  const calendar = extras.laborCalendar || extras.calendar;
  const startHit = officialHolidayOn(start, calendar);
  const cite = citeRule(
    startHit?.id === "national" ? "leave.nationalDay.days"
      : startHit?.id === "founding" ? "leave.foundingDay.days"
        : "leave.eid.cite",
    start || extras.onDate,
  ) || citeRule("leave.eid.cite", start || extras.onDate);
  const named = (id) => {
    const kind = officialHolidayKindLabel(id, true, calendar);
    return kind === "عطلة رسمية" ? "العطلة الرسمية" : `إجازة ${kind}`;
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
    return {
      ok: false,
      error: "OFFICIAL_HOLIDAY_DATES",
      reason: "موقوف — إجازة العيد لأيامها الثابتة فقط. إجازة اليوم الوطني ويوم التأسيس مقفلتان في الجدول بلا طلب.",
      reasonEn: "Blocked — Eid leave is only for its fixed dates. National Day and Founding Day leave lock on the roster with no request.",
      cite,
    };
  }
  let span = null;
  let cursor = start;
  while (cursor && cursor <= end) {
    const hit = officialHolidayOn(cursor, calendar);
    if (!hit) {
      const list = officialHolidayList(start || extras.onDate, calendar);
      const national = list.find((row) => row.id === "national");
      const founding = list.find((row) => row.id === "founding");
      const moved = !!(national?.ownerRuled || founding?.ownerRuled);
      return {
        ok: false,
        error: "OFFICIAL_HOLIDAY_DATES",
        reason: moved
          ? `موقوف — ${national?.ar || "إجازة اليوم الوطني"} (${national?.from || ""}) و${founding?.ar || "إجازة يوم التأسيس"} (${founding?.from || ""}) مقفلتان في الجدول بلا طلب؛ اطلب العيد على أيامه فقط.`
          : "موقوف — إجازة اليوم الوطني (23 سبتمبر) وإجازة يوم التأسيس (22 فبراير) مقفلتان في الجدول بلا طلب؛ اطلب العيد على أيامه فقط.",
        reasonEn: moved
          ? `Blocked — ${national?.en || "National Day leave"} (${national?.from || ""}) and ${founding?.en || "Founding Day leave"} (${founding?.from || ""}) lock on the roster with no request; request Eid on its dates only.`
          : "Blocked — National Day leave (23 September) and Founding Day leave (22 February) lock on the roster with no request; request Eid on its dates only.",
        cite,
      };
    }
    if (!span) span = hit;
    else if (hit.id !== span.id || hit.from !== span.from) {
      return {
        ok: false,
        error: "OFFICIAL_HOLIDAY_MIX",
        reason: `موقوف — اطلب ${named(span.id)} في طلب مستقل عن ${named(hit.id)}.`,
        reasonEn: "Blocked — request each official holiday in its own request.",
        cite,
      };
    }
    cursor = addCalendarDays(cursor, 1);
  }
  return { ok: true, cite };
}

export function checkOfficialHolidayOverlapGate(request, extras = {}) {
  const type = String(request?.type || "").trim().toLowerCase();
  const start = String(request?.startDate || "").slice(0, 10);
  const end = String(request?.endDate || "").slice(0, 10);
  const cite = citeRule("leave.eid.cite", start || extras.onDate);
  const live = liveLeaveRequests(request, extras);
  const hit = live.find((row) => {
    const otherStart = String(row.startDate || "").slice(0, 10);
    const otherEnd = String(row.endDate || otherStart).slice(0, 10);
    if (!rangesOverlap(start, end, otherStart, otherEnd)) return false;
    if (isOfficialHolidayLeave(type)) return true;
    return isOfficialHolidayLeave(row.type);
  });
  if (!hit) return { ok: true };
  const other = leaveTypeLabel(hit.type, true, undefined, hit.startDate);
  const otherEn = leaveTypeLabel(hit.type, false, undefined, hit.startDate);
  const named = /اليوم الوطني|يوم التأسيس|عيد|عطلة رسمية/.test(String(other || "")) ? "العطلة" : other;
  return {
    ok: false,
    error: "LEAVE_OVERLAP",
    reason: `موقوف — المدة تتقاطع مع طلب ${named} قائم. إجازة اليوم الوطني ويوم التأسيس مقفلتان بلا طلب؛ اطلب العيد بطلب مستقل خارج السنوية.`,
    reasonEn: `Blocked — these dates overlap an existing ${otherEn} request. National Day and Founding Day lock with no request; request Eid separately, outside annual leave.`,
    cite,
  };
}

function riyadhCivilDay(now = new Date()) {
  try {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(now);
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  } catch { /* fall through */ }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function profileLeaveGender(profile) {
  return profileGender(profile);
}

/** Maternity (151) is female-only; paternity (113) is male-only. Missing gender is a named stop, not a silent allow. */
export function checkLeaveGenderGate(request, extras = {}) {
  const type = String(request?.type || "").trim().toLowerCase();
  const spec = LEAVE_TYPES.find((row) => row.key === type);
  const need = spec?.f ? "female" : spec?.m ? "male" : "";
  if (!need) return { ok: true };
  const have = profileLeaveGender(extras.profile);
  const cite = citeLeaveType(type, request?.startDate || extras.onDate);
  if (!have) {
    return {
      ok: false,
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
      ok: false,
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
  return { ok: true };
}

export function leaveNeedsAttachment(request, typeRequiresFile = false) {
  const key = String(request?.type || "").trim().toLowerCase();
  if (key === "maternity_extend") return false;
  const days = Number(request?.days) || computeLeaveDays(request?.startDate, request?.endDate);
  const type = LEAVE_TYPES.find((t) => t.key === request?.type);
  if (typeRequiresFile || type?.requiresFile) return true;
  return days > ruleValue("leave.attachment.thresholdDays");
}

/** A real paper: named file with bytes/url/hash. The old toggle invented `{ name: "supporting-document", attested: true }`. */
export function isRealSupportingFile(file) {
  if (!file || typeof file !== "object") return false;
  const name = String(file.name || "").trim();
  if (!name) return false;
  const url = String(file.url || file.file_url || "").trim();
  const size = Number(file.size) || 0;
  const hash = String(file.hash || "").trim();
  if (file.attested === true && !url && size <= 0 && !hash) return false;
  return true;
}

export const EXAM_NOTICE_KIND = "exam_notice";
export const EXAM_SAT_KIND = "exam_sat";

/** Official Art. 115 wording — attach to exam gates; never paraphrase away the statute. */
export function examStatuteOf(onDate) {
  const official = articleOfficialText("115", onDate);
  return {
    article: "115",
    articleText: official?.ar || "",
    articleTextEn: official?.en || "",
  };
}

function supportingFileKind(file) {
  return String(file?.kind || "").trim().toLowerCase();
}

export function hasLeaveAttachment(request) {
  const files = Array.isArray(request?.files) ? request.files : [];
  return files.some((file) => isRealSupportingFile(file) && supportingFileKind(file) !== EXAM_SAT_KIND);
}

export function examNoticeFilesOf(request) {
  return (Array.isArray(request?.files) ? request.files : []).filter((file) => (
    isRealSupportingFile(file) && supportingFileKind(file) !== EXAM_SAT_KIND
  ));
}

export function examSatFileOf(request) {
  if (isRealSupportingFile(request?.examSatFile)) return request.examSatFile;
  return (Array.isArray(request?.files) ? request.files : []).find((file) => (
    supportingFileKind(file) === EXAM_SAT_KIND && isRealSupportingFile(file)
  )) || null;
}

export function hasExamSatProof(request) {
  return !!examSatFileOf(request);
}

/** Art. 115(4): proof of sitting is a second paper — after the exam days begin, on the same request. */
export function checkAttachExamSatGate(request, file, extras = {}) {
  const type = String(request?.type || extras.type || "").trim().toLowerCase();
  const cite = citeRule("leave.exam.cite", extras.onDate || request?.startDate);
  if (type !== "exam") {
    return {
      ok: false,
      error: "EXAM_SAT_TYPE",
      reason: "موقوف — إثبات أداء الامتحان يُرفع على طلب إجازة الامتحان فقط (المادة 115).",
      reasonEn: "Blocked — proof of sitting is attached on the exam-leave request only (Article 115).",
      cite,
    };
  }
  const status = String(request?.status || "pending").toLowerCase();
  if (status === "rejected" || status === "withdrawn") {
    return {
      ok: false,
      error: "EXAM_SAT_CLOSED",
      reason: "موقوف — لا يُرفع إثبات الأداء على طلب مرفوض أو مسحوب.",
      reasonEn: "Blocked — sitting proof is not attached on a rejected or withdrawn request.",
      cite,
    };
  }
  if (!isRealSupportingFile(file)) {
    return {
      ok: false,
      error: "EXAM_SAT_FILE",
      reason: "موقوف — أرفق ما يدل على أداء الامتحان (المادة 115).",
      reasonEn: "Blocked — attach what shows the exam was sat (Article 115).",
      cite,
    };
  }
  const start = String(request?.startDate || "").slice(0, 10);
  const today = String(extras.onDate || extras.today || riyadhCivilDay()).slice(0, 10);
  if (start && today < start) {
    return {
      ok: false,
      error: "EXAM_SAT_BEFORE",
      reason: `موقوف — إثبات الأداء يُرفع بعد بدء أيام الامتحان (${start}).`,
      reasonEn: `Blocked — sitting proof is attached after the exam days begin (${start}).`,
      cite,
    };
  }
  return { ok: true, via: "exam_sat", cite };
}

export function examSatState(request, extras = {}) {
  const type = String(request?.type || extras.type || "").trim().toLowerCase();
  if (type !== "exam") return { outstanding: false, open: false, due: false, attached: false, settled: true, file: null };
  const status = String(request?.status || extras.status || "pending").toLowerCase();
  if (status === "rejected" || status === "withdrawn") {
    return { outstanding: false, open: false, due: false, attached: false, settled: false, file: null };
  }
  const file = examSatFileOf(request);
  if (file) return { outstanding: false, open: false, due: false, attached: true, settled: true, file };
  const start = String(request?.startDate || "").slice(0, 10);
  const end = String(request?.endDate || start).slice(0, 10);
  const today = String(extras.onDate || extras.today || riyadhCivilDay()).slice(0, 10);
  const open = !!(start && today >= start);
  const due = !!(end && today > end);
  return { outstanding: true, open, due, attached: false, settled: false, file: null, start, end };
}

/** Art. 115(4)+(1): after exam days begin, sitting proof is a second paper on the same request. */
export function checkExamSittingSettleGate(request, extras = {}) {
  const type = String(request?.type || extras.type || "").trim().toLowerCase();
  const statute = examStatuteOf(extras.onDate || request?.startDate);
  const cite = citeRule("leave.exam.cite", extras.onDate || request?.startDate);
  if (type !== "exam") return { ok: true, settled: true, via: null };
  const sat = examSatState(request, extras);
  if (sat.attached) return { ok: true, settled: true, via: "exam_sat", cite, ...statute };
  if (!sat.open) {
    return {
      ok: true,
      settled: false,
      via: "awaiting_exam_days",
      cite,
      ...statute,
      reason: `إثبات أداء الامتحان يُرفع بعد بدء الأيام (${sat.start || "—"}) — المادة 115.`,
      reasonEn: `Sitting proof is attached after the exam days begin (${sat.start || "—"}) — Article 115.`,
    };
  }
  return {
    ok: false,
    error: "EXAM_SAT_UNSETTLED",
    settled: false,
    via: sat.due ? "exam_sat_due" : "exam_sat_open",
    cite,
    ...statute,
    reason: "غير مستقر — إثبات أداء الامتحان ورقة ثانية بعد بدء الأيام (المادة 115). دونها لا تستقر الإجازة، ويُحرم الأجر إن ثبت عدم الأداء.",
    reasonEn: "Unsettled — sitting proof is a second paper after the exam days begin (Article 115). Without it the leave does not stay settled, and the wage is denied if it is proven the exam was not sat.",
  };
}

/** Art. 115(3): fifteen days' employee notice to the employer. A late timetable paper is a named notice exception — not an institution approval. */
export function checkExamNoticeGate(request, extras = {}) {
  const type = String(request?.type || extras.type || "").trim().toLowerCase();
  if (type !== "exam") return { ok: true, via: null };
  const onDate = extras.onDate || request.startDate;
  const noticeDays = ruleValue("leave.exam.noticeDays", onDate) || 15;
  const start = String(request.startDate || "").slice(0, 10);
  const today = riyadhCivilDay();
  const submitted = String(request.createdAt || request.requestedAt || extras.submittedAt || extras.onDate || today).slice(0, 10);
  const issued = String(request.examNoticeIssuedAt || extras.examNoticeIssuedAt || "").slice(0, 10);
  const cite = citeRule("leave.exam.noticeDays", onDate);
  const statute = examStatuteOf(onDate);
  if (!start) return { ok: true, via: null };
  const earliest = addCalendarDays(submitted, noticeDays);
  if (start >= earliest) return { ok: true, via: "notice", cite, noticeDays, ...statute };
  const lateHintAr = "إن وصل جدول المواعيد بعد المهلة فارفع الورقة وسجّل تاريخ صدورها، وقدّم الطلب في يوم الورقة أو اليوم التالي.";
  const lateHintEn = "If the timetable paper arrives after that window, attach it, record its issue date, and apply on that day or the next.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issued)) {
    return {
      ok: false,
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
      ok: false,
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
      ok: false,
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
      ok: false,
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
      ok: false,
      error: "EXAM_NOTICE_PROOF",
      reason: "موقوف — الإشعار المتأخر يحتاج ورقة المواعيد بتاريخ صدورها (المادة 115).",
      reasonEn: "Blocked — a late notice needs the timetable paper with its issue date (Article 115).",
      cite,
      noticeDays,
      ...statute,
    };
  }
  return {
    ok: true,
    via: "late_notice",
    examNoticeIssuedAt: issued,
    cite,
    noticeDays,
    ...statute,
    reason: `مهلة المادة 115 بقيت ${noticeDays} يوماً. قُبل الطلب لأن ورقة المواعيد صدرت في ${issued} — أقل من ${noticeDays} يوماً — وقُدّم في يوم الورقة أو اليوم التالي.`,
    reasonEn: `Article 115 still requires ${noticeDays} days. The request was accepted because the timetable paper was issued on ${issued} — under ${noticeDays} days — and it was filed that day or the next.`,
  };
}

export function addCalendarDays(iso, n) {
  const s = String(iso || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(n));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Art. 115(1)–(2): a qualifying exam leave is a statutory right. Employer refusal of enrolment only changes the pay track. */
export function examLeaveQualifies(request, extras = {}) {
  const type = String(request?.type || extras.type || "").trim().toLowerCase();
  if (type !== "exam") return { ok: false, via: null };
  const dates = checkLeaveDatesGate(request);
  if (!dates.ok) return dates;
  const notice = checkExamNoticeGate(request, extras);
  if (!notice.ok) return notice;
  if (!hasLeaveAttachment(request)) {
    const statute = examStatuteOf(extras.onDate || request?.startDate);
    return {
      ok: false,
      error: "ATTACHMENT_REQUIRED",
      reason: "موقوف — المادة 115 تجيز طلب الوثائق المؤيدة. أرفق جدول المواعيد أو ورقة الأيام.",
      reasonEn: "Blocked — Article 115 lets the employer require supporting documents. Attach the exam timetable or dates paper.",
      cite: citeRule("leave.exam.cite", extras.onDate || request?.startDate),
      ...statute,
    };
  }
  return { ok: true, via: notice.via || "notice", cite: notice.cite, articleText: notice.articleText, articleTextEn: notice.articleTextEn, article: "115" };
}

/** Employer cannot refuse a request that already meets Article 115. */
export function checkRejectLeaveGate(request, extras = {}) {
  const next = String(extras.nextStatus || extras.action || extras.status || "rejected").trim().toLowerCase();
  if (next !== "rejected") return { ok: true };
  const type = String(request?.type || extras.type || "").trim().toLowerCase();
  if (type !== "exam") return { ok: true };
  if (extras.actor === "employee") return { ok: true };
  const qualify = examLeaveQualifies(request, extras);
  if (!qualify.ok) return { ok: true, via: "not_qualified", qualify };
  const statute = examStatuteOf(extras.onDate || request?.startDate);
  const cite = citeRule("leave.exam.cite", extras.onDate || request?.startDate);
  return {
    ok: false,
    error: "EXAM_EMPLOYER_REFUSE",
    reason: "موقوف — صاحب العمل لا يرفض إجازة امتحان استوفت المادة 115. موافقة الانتساب تغيّر مسار الأجر فقط (الفقرة 1 و2)؛ الإجازة حق بأيام الامتحان الفعلية. المنصة تُبقي الحق.",
    reasonEn: "Blocked — the employer cannot refuse an exam leave that meets Article 115. Enrolment consent only changes the pay track (paragraphs 1 and 2); the leave itself is a right for the actual exam days. The platform keeps the entitlement.",
    cite,
    via: qualify.via,
    ...statute,
  };
}

function checkStatutoryLeaveGates(request, extras, days, onDate, cite) {
  const type = String(request?.type || "").trim().toLowerCase();
  const profile = extras.profile || {};
  if (type === "hajj") {
    const hajjCite = citeRule("leave.hajj.days", onDate) || cite;
    if (!isRamadanHoursSubject({ profile })) {
      return {
        ok: false,
        error: "LEAVE_RELIGION",
        reason: "موقوف — إجازة الحج للمسلم المسجّل على الملف (المادة 114).",
        reasonEn: "Blocked — Hajj leave is for a Muslim recorded on the file (Article 114).",
        cite: hajjCite,
      };
    }
    const minDays = ruleValue("leave.hajj.days", onDate);
    const maxDays = ruleValue("leave.hajj.maxDays", onDate);
    const minYears = ruleValue("leave.hajj.minServiceYears", onDate);
    const start = String(request.startDate || "").slice(0, 10);
    const end = String(request.endDate || "").slice(0, 10);
    const span = computeLeaveDays(start, end) || days;
    if (span < minDays) {
      return {
        ok: false,
        error: "HAJJ_UNDER_MIN",
        reason: `موقوف — إجازة الحج لا تقل عن ${minDays} أيام شاملة عيد الأضحى.`,
        reasonEn: `Blocked — Hajj leave may not be less than ${minDays} days including Eid al-Adha.`,
        cite: hajjCite,
      };
    }
    if (span > maxDays) {
      return {
        ok: false,
        error: "HAJJ_OVER_MAX",
        reason: `موقوف — إجازة الحج لا تزيد على ${maxDays} يوماً شاملة عيد الأضحى.`,
        reasonEn: `Blocked — Hajj leave may not exceed ${maxDays} days including Eid al-Adha.`,
        cite: hajjCite,
      };
    }
    const years = serviceYearsFromHire(profile.hireDate, onDate);
    if (years < minYears) {
      return {
        ok: false,
        error: "HAJJ_SERVICE",
        reason: `موقوف — إجازة الحج بعد ${minYears} سنتين متصلتين في الخدمة.`,
        reasonEn: `Blocked — Hajj leave requires ${minYears} consecutive years of service.`,
        cite: hajjCite,
      };
    }
    const prior = (extras.requests || profile.leaveRequests || []).some(
      (r) => r?.type === "hajj" && r?.status === "approved" && r?.id !== request.id,
    );
    if (prior || profile.hajjPerformed) {
      return {
        ok: false,
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
        ok: false,
        error: "PATERNITY_EVENT_DATE_REQUIRED",
        reason: "موقوف — تاريخ الولادة لازم لإجازة المولود خلال سبعة أيام.",
        reasonEn: "Blocked — the birth date is required so paternity leave stays within seven days.",
        cite: pCite,
      };
    }
    const latest = addCalendarDays(event, window - 1);
    if (!start || start < event || start > latest) {
      return {
        ok: false,
        error: "PATERNITY_WINDOW",
        reason: `موقوف — إجازة المولود خلال ${window} أيام من تاريخ الولادة (${event}–${latest}).`,
        reasonEn: `Blocked — paternity leave must start within ${window} days of the birth (${event}–${latest}).`,
        cite: pCite,
      };
    }
    const maxDays = ruleValue("leave.paternity.days", onDate);
    if (days > maxDays) {
      return {
        ok: false,
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
        ok: false,
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
        ok: false,
        error: "EVENT_DATE_REQUIRED",
        reason: "موقوف — تاريخ الواقعة لازم، وتُحتسب الإجازة منه (المادة 113).",
        reasonEn: "Blocked — the event date is required; the leave is counted from that date (Article 113).",
        cite: eCite,
      };
    }
    const latest = addCalendarDays(event, maxDays - 1);
    if (!start || start !== event || (end && end > latest)) {
      return {
        ok: false,
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
        ok: false,
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
        ok: false,
        error: "MATERNITY_PRE_WINDOW",
        reason: `موقوف — لا تبدأ إجازة الوضع قبل أربعة أسابيع من التاريخ المرجح (${earliest}).`,
        reasonEn: `Blocked — maternity leave may not start more than four weeks before the expected date (${earliest}).`,
        cite: citeRule("leave.maternity.preDaysMax", onDate) || mCite,
      };
    }
    if (!start || !end || start > event || end < postEnd) {
      return {
        ok: false,
        error: "MATERNITY_POST_BIRTH",
        reason: `موقوف — إجازة الوضع تغطي الأسابيع الستة التالية للوضع (${event}–${postEnd}).`,
        reasonEn: `Blocked — maternity leave must cover the six weeks after birth (${event}–${postEnd}).`,
        cite: mCite,
      };
    }
    }
  }
  if (type === "exam") return checkExamNoticeGate(request, extras);
  if (type === "iddah") {
    const event = String(request.eventDate || extras.eventDate || "").slice(0, 10);
    const start = String(request.startDate || "").slice(0, 10);
    const end = String(request.endDate || "").slice(0, 10);
    const iCite = citeRule("leave.iddah.cite", onDate) || cite;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event)) {
      return {
        ok: false,
        error: "EVENT_DATE_REQUIRED",
        reason: "موقوف — تاريخ الوفاة لازم لعدّة وفاة الزوج (المادة 160).",
        reasonEn: "Blocked — the date of death is required for iddah leave (Article 160).",
        cite: iCite,
      };
    }
    const paid = iddahPaidDays(extras.profile, event);
    const latestPaid = addCalendarDays(event, paid - 1);
    const pregnant = !!(request.iddahPregnant || extras.iddahPregnant) && isRamadanHoursSubject({ profile: extras.profile });
    if (start !== event) {
      return {
        ok: false,
        error: "EVENT_LEAVE_WINDOW",
        reason: `موقوف — العدة تُحتسب من تاريخ الوفاة (${event}).`,
        reasonEn: `Blocked — iddah is counted from the date of death (${event}).`,
        cite: iCite,
      };
    }
    if (!end || end < latestPaid) {
      return {
        ok: false,
        error: "IDDAH_UNDER_MIN",
        reason: `موقوف — العدة لا تقل عن ${paid} يوماً من تاريخ الوفاة (${event}–${latestPaid}).`,
        reasonEn: `Blocked — iddah may not be less than ${paid} days from the date of death (${event}–${latestPaid}).`,
        cite: iCite,
      };
    }
    if (end > latestPaid && !pregnant) {
      return {
        ok: false,
        error: "IDDAH_OVER_PAID",
        reason: `موقوف — العدة بأجر تنتهي في ${latestPaid}. التمديد بلا أجر للمسلمة الحامل حتى تضع فقط (المادة 160).`,
        reasonEn: `Blocked — paid iddah ends on ${latestPaid}. An unpaid extension is only for a pregnant Muslim widow until birth (Article 160).`,
        cite: iCite,
      };
    }
    if (end > latestPaid && pregnant) {
      return {
        ok: true,
        warning: "IDDAH_UNPAID_TAIL",
        reason: `تنبيه — ما زاد على ${paid} يوماً بلا أجر حتى الوضع، ولا تُكمَّل العدة بعد الولادة (المادة 160).`,
        reasonEn: `Notice — days beyond ${paid} are unpaid until birth, and remaining iddah is not used after birth (Article 160).`,
        cite: iCite,
      };
    }
  }
  if (type === "maternity_extend" || type === "maternity_companion") {
    const start = String(request.startDate || "").slice(0, 10);
    const end = String(request.endDate || "").slice(0, 10);
    const followCite = citeRule(type === "maternity_companion" ? "leave.maternity.disabledChildDays" : "leave.maternity.unpaidExtendDays", onDate) || cite;
    const mat = lastApprovedMaternity(extras.requests || extras.profile?.leaveRequests);
    if (!mat) {
      return {
        ok: false,
        error: "MATERNITY_FOLLOW_REQUIRED",
        reason: "موقوف — التمديد أو المرافقة تبدأ بعد انتهاء إجازة وضع معتمدة (المادة 151).",
        reasonEn: "Blocked — the extension or companion month starts after an approved maternity leave ends (Article 151).",
        cite: followCite,
      };
    }
    const after = addCalendarDays(String(mat.endDate || "").slice(0, 10), 1);
    if (!start || start < after) {
      return {
        ok: false,
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
        ok: false,
        error: "MATERNITY_EXTEND_OVER",
        reason: `موقوف — تمديد الوضع بلا أجر شهر واحد (${paid} يوماً) بعد انتهائها (المادة 151).`,
        reasonEn: `Blocked — the unpaid maternity extension is one month (${paid} days) after it ends (Article 151).`,
        cite: followCite,
      };
    }
    if (type === "maternity_companion" && span > paid && !extendUnpaid) {
      return {
        ok: false,
        error: "COMPANION_OVER_PAID",
        reason: `موقوف — شهر المرافقة بأجر ${paid} يوماً. التمديد بلا أجر شهر إضافي إن لزم (المادة 151 فقرة 2).`,
        reasonEn: `Blocked — the paid companion month is ${paid} days. An extra unpaid month is available if needed (Article 151(2)).`,
        cite: followCite,
      };
    }
    if (type === "maternity_companion" && extendUnpaid && span > paid + unpaidExtra) {
      return {
        ok: false,
        error: "COMPANION_OVER_MAX",
        reason: `موقوف — المرافقة شهر بأجر وشهر بلا أجر فقط (${paid + unpaidExtra} يوماً).`,
        reasonEn: `Blocked — companion leave is one paid month and one unpaid month only (${paid + unpaidExtra} days).`,
        cite: followCite,
      };
    }
    if (type === "maternity_companion" && extendUnpaid && span > paid) {
      return {
        ok: true,
        warning: "COMPANION_UNPAID_TAIL",
        reason: `تنبيه — ما زاد على ${paid} يوماً بلا أجر حتى الشهر الإضافي (المادة 151 فقرة 2).`,
        reasonEn: `Notice — days beyond ${paid} are unpaid up to the extra month (Article 151(2)).`,
        cite: followCite,
      };
    }
  }
  if (type === "unpaid") {
    const cap = ruleValue("leave.unpaid.suspendAfterDays", onDate);
    if (days > cap) {
      return {
        ok: true,
        warning: "CONTRACT_SUSPENDED",
        reason: `تنبيه — الإجازة بلا أجر فيما زاد على ${cap} يوماً توقف العقد ما لم يتفق الطرفان على خلاف ذلك.`,
        reasonEn: `Notice — unpaid leave beyond ${cap} days suspends the contract unless the parties agree otherwise.`,
        cite: citeRule("leave.unpaid.suspendAfterDays", onDate) || cite,
      };
    }
  }
  return { ok: true };
}

/** Any type on the leave raise form — not only statutory chapter types. Other-request kinds stay out. */
export function leaveNeedsArticle118Ack(type) {
  const key = String(type || "").trim().toLowerCase();
  return LEAVE_TYPES.some((row) => row.key === key);
}

export function checkNoOtherEmployerGate(request) {
  const type = String(request?.type || "").trim().toLowerCase();
  if (!leaveNeedsArticle118Ack(type)) return { ok: true };
  if (request?.noOtherEmployerAck === true) return { ok: true };
  return {
    ok: false,
    error: "NO_OTHER_EMPLOYER_ACK",
    reason: "موقوف — يلزم الإقرار بعدم العمل لدى صاحب عمل آخر أثناء الإجازة (المادة 118).",
    reasonEn: "Blocked — acknowledge that you will not work for another employer during this leave (Article 118).",
    cite: citeRule("leave.noOtherEmployer.cite", request?.startDate),
  };
}

/** Art. 109(2): employer-set annual leave needs 30 days' notice. Worker-chosen dates do not. */
export function checkAnnualNoticeGate(request, extras = {}) {
  const type = String(request?.type || "").trim().toLowerCase();
  if (type !== "annual") return { ok: true };
  const recorded = !!(request?.recordedBy || extras.recordedBy || extras.employerRecorded);
  if (!recorded) return { ok: true };
  const start = String(request?.startDate || "").slice(0, 10);
  const needed = ruleValue("leave.annual.noticeDays", start || extras.onDate);
  const until = daysUntilLeaveStart(start, extras.onDate);
  if (until == null) return { ok: true };
  if (until >= needed) return { ok: true };
  return {
    ok: false,
    error: "ANNUAL_NOTICE_DAYS",
    reason: `موقوف — تحديد صاحب العمل لميعاد الإجازة السنوية يلزم إشعاراً قبل ${needed} يوماً على الأقل (المادة 109).`,
    reasonEn: `Blocked — when the employer sets annual-leave dates, the worker must be notified at least ${needed} days ahead (Article 109).`,
    cite: citeRule("leave.annual.noticeDays", start || extras.onDate),
    needed,
    until,
  };
}

export function checkAnnualDeferGate(request, extras = {}) {
  const type = String(request?.type || "").trim().toLowerCase();
  if (type !== "annual") return { ok: true };
  const recorded = !!(request?.recordedBy || extras.recordedBy || extras.employerRecorded);
  if (!recorded) return { ok: true };
  const profile = extras.profile || {};
  const start = String(request?.startDate || "").slice(0, 10);
  const split = annualBalanceSplit(profile, extras.requests || profile.leaveRequests || [], start);
  if (split.carryLeft <= 0) return { ok: true };
  const win = anniversaryYearWindow(profile.hireDate, start);
  if (!win) return { ok: true };
  const yearEnd = addCalendarDays(win.start, -1);
  const cap = ruleValue("leave.annual.deferMaxDays", start);
  const latest = addCalendarDays(yearEnd, cap);
  if (!start || start <= latest) return { ok: true };
  if (request?.deferConsentAt || profile.annualDeferConsentAt) return { ok: true };
  return {
    ok: false,
    error: "ANNUAL_DEFER_CONSENT",
    reason: `موقوف — تأجيل رصيد السنة السابقة بعد ${cap} يوماً من نهايتها يحتاج موافقة العامل كتابة (المادة 110).`,
    reasonEn: `Blocked — postponing last year's leave more than ${cap} days after that year needs the worker's written consent (Article 110).`,
    cite: citeRule("leave.annual.deferMaxDays", start),
  };
}

export function deriveExamLeaveSettlement(request, extras = {}) {
  if (String(request?.type || "").trim().toLowerCase() !== "exam") {
    return { track: "", payFrom: "" };
  }
  const consent = checkExamStudyConsentGate(request, extras);
  const track = consent.examLeaveTrack || EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID;
  if (track === EXAM_LEAVE_TRACK_PAID) {
    return {
      track,
      payFrom: request.examRepeat || extras.examRepeat ? "unpaid" : "paid",
      reason: consent.reason,
      reasonEn: consent.reasonEn,
    };
  }
  const dates = checkLeaveDatesGate(request);
  const days = Number(request?.days) > 0 ? Number(request.days) : (dates.days || 0);
  const remaining = extras.profile
    ? remainingLeaveDays(extras.profile, extras.requests || extras.profile.leaveRequests || [], "annual", request.startDate)
    : null;
  return {
    track: EXAM_LEAVE_TRACK_ANNUAL_OR_UNPAID,
    payFrom: remaining != null && days > 0 && remaining >= days ? "annual" : "unpaid",
    reason: consent.reason,
    reasonEn: consent.reasonEn,
  };
}

/**
 * Leave raise belongs on ملفي — the worker files their own request.
 * A manager/HR actor id that differs from the subject must not invent leave on the file.
 */
export function checkLeaveSelfRaiseGate(request, extras = {}) {
  const actorId = String(request?.requestedById || extras.requestedById || extras.actorId || "").trim();
  const subjectId = String(extras.employee?.id || extras.employeeId || request?.employeeId || "").trim();
  if (!actorId || !subjectId) return { ok: true };
  if (actorId === subjectId) return { ok: true };
  return {
    ok: false,
    error: "LEAVE_EMPLOYEE_ONLY",
    reason: "الإجازة تُرفع من ملفي فقط — الموظف يطلب، والإدارة تعتمد أو ترفض.",
    reasonEn: "Leave is raised from My file only — the worker requests; management approves or refuses.",
  };
}

/** Statutory + balance gates for raising a request — no pending-status requirement. Art. 118 ack is submit-only. */
export function checkSubmitLeaveGate(request, extras = {}) {
  const selfRaise = checkLeaveSelfRaiseGate(request, extras);
  if (!selfRaise.ok) return selfRaise;
  const gate = checkApproveLeaveGate({ ...(request || {}), status: "pending" }, false, extras);
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

export function checkLeaveDatesGate(request) {
  const start = String(request?.startDate || "").slice(0, 10);
  const end = String(request?.endDate || "").slice(0, 10);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(start) && iso.test(end) && end < start) {
    return {
      ok: false,
      error: "LEAVE_DATES_ORDER",
      reason: "موقوف — تاريخ نهاية الإجازة قبل بدايتها.",
      reasonEn: "Blocked — the leave end date is before the start date.",
    };
  }
  const days = computeLeaveDays(start, end);
  if (!iso.test(start) || !iso.test(end) || days <= 0) {
    return {
      ok: false,
      error: "LEAVE_DATES_REQUIRED",
      reason: "موقوف — تواريخ الإجازة غير مكتملة.",
      reasonEn: "Blocked — leave dates are incomplete.",
    };
  }
  return { ok: true, days, start, end };
}

export function checkApproveLeaveGate(request, typeRequiresFile = false, extras = {}) {
  if (typeRequiresFile && typeof typeRequiresFile === "object" && !Array.isArray(typeRequiresFile)) {
    extras = typeRequiresFile;
    typeRequiresFile = false;
  }
  if (!request) {
    return {
      ok: false,
      error: "LEAVE_NOT_FOUND",
      reason: "طلب الإجازة غير موجود في نطاق الشركة.",
      reasonEn: "Leave request was not found in this company.",
    };
  }
  if (request.status && request.status !== "pending") {
    return {
      ok: false,
      error: "LEAVE_NOT_PENDING",
      reason: "لا يمكن اعتماد طلب غير معلّق.",
      reasonEn: "Only pending leave requests can be approved.",
    };
  }
  const dates = checkLeaveDatesGate(request);
  if (!dates.ok) return dates;
  const type = String(request.type || "").trim().toLowerCase();
  const gender = checkLeaveGenderGate(request, extras);
  if (!gender.ok) return gender;
  const calendar = extras.laborCalendar || extras.calendar;
  const overlapFacts = deriveEidOverlap({
    start: dates.start,
    end: dates.end,
    type,
    company: extras.company,
    calendar,
  });
  const rawDays = Number(request.days) > 0 ? Number(request.days) : dates.days;
  const days = (type === "annual" || type === "sick")
    ? chargeableLeaveDays(dates.start, dates.end, type, calendar)
    : rawDays;
  const onDate = request.startDate || extras.onDate;
  const cite = citeLeaveType(type, onDate);
  const statutory = checkStatutoryLeaveGates(request, extras, days, onDate, cite);
  if (!statutory.ok) return statutory;
  const official = checkOfficialHolidayLeaveGate(request, extras);
  if (!official.ok) return official;
  const overlap = checkOfficialHolidayOverlapGate(request, extras);
  if (!overlap.ok) return overlap;
  const defer = checkAnnualDeferGate(request, extras);
  if (!defer.ok) return defer;
  const notice = checkAnnualNoticeGate(request, extras);
  if (!notice.ok) return notice;
  const skipBalance = type === "unpaid" || type === "exam" || type === "hajj" || type === "eid" || type === "iddah" || type === "maternity_extend" || type === "maternity_companion" || request.examRepeat || extras.examRepeat;
  if (type && !skipBalance && extras.profile) {
    const profile = { ...extras.profile };
    if (type === "maternity" && (request.disabledChild || extras.disabledChild)) {
      profile.maternityDisabledChild = true;
    }
    const requests = extras.requests || extras.profile.leaveRequests || [];
    if (type === "grant") {
      const leftover = leftoverGrantDays(profile, requests, onDate);
      if (days > leftover) {
        return {
          ok: false,
          error: "LEAVE_BALANCE_EXCEEDED",
          reason: `موقوف — يتجاوز الطلب الرصيد التقديري (المتبقي ${leftover} يوماً). لا يُسحب من المستحق النظامي.`,
          reasonEn: `Blocked — the request exceeds the discretionary balance (${leftover} days left). It is not taken from the statutory entitlement.`,
          remaining: leftover,
          total: leftover,
          days,
        };
      }
    } else if (type === "annual") {
      const split = annualBalanceSplit(profile, requests, onDate);
      const leftoverGrants = leftoverGrantDays(profile, requests, onDate);
      const remaining = split.remaining + leftoverGrants;
      const total = (split.currentTotal || 0) + split.carryTotal;
      if (days > remaining) {
        return {
          ok: false,
          error: "LEAVE_BALANCE_EXCEEDED",
          reason: `موقوف — يتجاوز الطلب الرصيد النظامي (المتبقي ${remaining} من ${total} يوماً، منها ${split.carryLeft} ترحيل).`,
          reasonEn: `Blocked — the request exceeds the statutory balance (${remaining} of ${total} days left, including ${split.carryLeft} carried).`,
          cite,
          remaining,
          total,
          days,
        };
      }
    } else {
    const total = getLeaveTotal(profile, type, onDate);
    if (total != null) {
      const used = usedLeaveDays(requests, type, onDate, extras.profile?.hireDate);
      const leftover = Math.max(0, total - used);
      const remaining = leftover;
      if (days > remaining) {
        return {
          ok: false,
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
  }
  const hasFile = hasLeaveAttachment(request);
  if (leaveNeedsAttachment(request, typeRequiresFile) && !hasFile) {
    return {
      ok: false,
      error: "ATTACHMENT_REQUIRED",
      reason: `لا يمكن الاعتماد — يلزم مستند لطلب يتجاوز ${ruleValue("leave.attachment.thresholdDays")} أيام (أو لنوع يتطلب مرفقًا).`,
      reasonEn: `Approval blocked — a document is required for a request over ${ruleValue("leave.attachment.thresholdDays")} days (or a type that requires an attachment).`,
      days,
      threshold: ruleValue("leave.attachment.thresholdDays"),
      warning: statutory.warning || null,
      warningReason: statutory.reason,
      warningReasonEn: statutory.reasonEn,
    };
  }
  return {
    ok: true,
    days,
    cite,
    via: statutory.via || null,
    examNoticeIssuedAt: statutory.examNoticeIssuedAt,
    warning: statutory.warning || null,
    reason: statutory.reason,
    reasonEn: statutory.reasonEn,
    overlap: overlapFacts,
  };
}

export function deriveLeaveStats(requests) {
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

/** Article 117 sick-pay bands: 30 full, 60 at three-quarters, 30 unpaid. */
export function deriveSickPayBand(usedDays = 0, onDate) {
  const full = ruleValue("leave.sick.fullPayDays", onDate);
  const half = ruleValue("leave.sick.halfPayDays", onDate);
  const unpaid = ruleValue("leave.sick.unpaidDays", onDate);
  const used = Math.max(0, Number(usedDays) || 0);
  const cite = citeLeaveType("sick");
  if (used < full) return { band: "full", remaining: full - used, cite };
  if (used < full + half) return { band: "three_quarter", remaining: full + half - used, cite };
  if (used < full + half + unpaid) return { band: "unpaid", remaining: full + half + unpaid - used, cite };
  return { band: "exhausted", remaining: 0, cite };
}

function riyadhDayKey(onDate) {
  if (onDate) return String(onDate).slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}

const APPROVED_LEAVE_ALTER = new Set(["rejected", "revise", "withdrawn", "pending"]);

/** True when an approved request covers the day (requested start/end win). */
export function isOnApprovedLeave(requests, dayKey) {
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

export function mergeLeaveRequestLists(...lists) {
  const byKey = new Map();
  for (const list of lists) {
    for (const row of list || []) {
      if (!row || typeof row !== "object") continue;
      const span = leaveCoverRange(row);
      const id = String(row.id || "").trim();
      const key = id || `${String(row.type || "")}:${span.start}:${span.end}:${String(row.status || "")}`;
      const prev = byKey.get(key);
      if (!prev || (row.status === "approved" && prev.status !== "approved")) {
        byKey.set(key, row);
      }
    }
  }
  return [...byKey.values()];
}

export function leaveRosterFromEmployees(employees) {
  return (employees || []).map((employee) => ({
    id: employee.id || employee.employeeId,
    employeeId: employee.id || employee.employeeId,
    stationId: employee.stationId || null,
    leaveRequests: employee.leaveRequests || [],
    otherRequests: employee.otherRequests || [],
  }));
}

export function leaveRequestsForEmployeeId(employeeId, sources = {}) {
  const id = String(employeeId || "");
  const blobEmp = (sources.roster || []).find((row) => String(row?.id || row?.employeeId || "") === id) || null;
  return mergeLeaveRequestLists(sources.entity?.leaveRequests, blobEmp?.leaveRequests);
}

/** Calendar / punch / إدارة see طلباتي + leaveRoster (leave + other bags). */
export function hydrateEmployeesLeave(employees, data) {
  const roster = data?.leaveRoster || [];
  return (employees || []).map((employee) => {
    if (!employee) return employee;
    const merged = leaveRequestsForEmployeeId(employee.id || employee.employeeId, {
      entity: employee,
      roster,
    });
    const mergedOther = otherRequestsForEmployeeId(employee.id || employee.employeeId, {
      entity: employee,
      roster,
    });
    const prev = employee.leaveRequests || [];
    const prevOther = employee.otherRequests || [];
    const leaveSame = merged.length === prev.length && merged.every((row, i) => row === prev[i]);
    const otherSame = mergedOther.length === prevOther.length && mergedOther.every((row, i) => row === prevOther[i]);
    if (leaveSame && otherSame) return employee;
    return { ...employee, leaveRequests: merged, otherRequests: mergedOther };
  });
}

export function mergeEmployeeLists(...lists) {
  const seen = new Set();
  const out = [];
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

/** After approval the requested dates are a fixed right. Only the worker may withdraw, and only before start. */
export function approvedLeaveWithdrawWindow(request, onDate) {
  if (!request || request.status !== "approved") return { open: false, start: "", today: riyadhDayKey(onDate) };
  const start = leaveCoverRange(request).start;
  const today = riyadhDayKey(onDate);
  return { open: !!start && today < start, start, today };
}

export function checkAlterApprovedLeaveGate(request, extras = {}) {
  if (!request || request.status !== "approved") return { ok: true };
  const next = String(extras.nextStatus || extras.action || "").trim().toLowerCase();
  if (!next || next === "approved" || !APPROVED_LEAVE_ALTER.has(next)) return { ok: true };
  const cite = citeLeaveType(request.type || "annual", request.startDate) || citeRule("leave.annual.days", request.startDate);
  const window = approvedLeaveWithdrawWindow(request, extras.onDate);
  const actor = extras.actor === "employee" ? "employee" : "manager";
  if (next === "withdrawn" && actor === "employee") {
    if (!window.start) {
      return {
        ok: false,
        error: "LEAVE_NO_START",
        reason: "موقوف — لا يُسحب طلب بلا تاريخ بدء.",
        reasonEn: "Blocked — a request with no start date cannot be withdrawn.",
        cite,
      };
    }
    if (!window.open) {
      return {
        ok: false,
        error: "LEAVE_ALREADY_STARTED",
        reason: `موقوف — الإجازة المعتمدة حق ثابت وقد حلّ موعد بدئها (${window.start}). لا تُسحب بعد حلول البدء.`,
        reasonEn: `Blocked — approved leave is a fixed right and its start (${window.start}) has arrived. It cannot be withdrawn after that day.`,
        cite,
      };
    }
    if (extras.employeeConsent !== true) {
      return {
        ok: false,
        error: "LEAVE_WITHDRAW_ACK",
        reason: "موقوف — سحب الإجازة المعتمدة يلزم إقرارك الصريح قبل موعد البدء، لإشعار الإدارة وتعديل الجدول.",
        reasonEn: "Blocked — withdrawing approved leave needs your explicit acknowledgement before the start date, so operations can adjust the roster.",
        cite,
      };
    }
    return { ok: true, cite };
  }
  return {
    ok: false,
    error: "LEAVE_APPROVED_LOCKED",
    reason: "موقوف — الإجازة المعتمدة حق ثابت في تاريخها. لا تُلغى ولا يُغيَّر موعدها من الإدارة إلا بموافقة العامل وقبل حلول البدء (المادة 109).",
    reasonEn: "Blocked — approved leave is a fixed right on its dates. Management cannot cancel or move it without the worker's consent before it starts (Article 109).",
    cite,
  };
}

/** Employee-only: mark an approved leave decision as seen so the card can leave ملفي. */
export function checkSeeLeaveDecisionGate({ request, employeeId, actorId } = {}) {
  if (!request || request.status !== "approved") {
    return {
      ok: false,
      error: "LEAVE_NOT_APPROVED",
      reason: "لا قرار اعتماد لتُرى.",
      reasonEn: "There is no approved leave decision to see.",
    };
  }
  if (!actorId || String(actorId) !== String(employeeId)) {
    return {
      ok: false,
      error: "EMPLOYEE_ONLY",
      reason: "رؤية قرار الإجازة من ملفي فقط.",
      reasonEn: "Only the worker sees the leave decision from My file.",
    };
  }
  return { ok: true, already: !!request.decisionSeenAt };
}

export function leaveDecisionNoticeKey(employeeId, requestId) {
  return `leave-decision:${employeeId}:${requestId}`;
}

/** Blocks punch when an approved leave covers the day. */
export function checkCheckInLeaveGate(requests, dayKey) {
  if (isOnApprovedLeave(requests, dayKey)) {
    return {
      ok: false,
      error: "ON_APPROVED_LEAVE",
      reason: "لا يمكن تسجيل الحضور — لديك إجازة معتمدة لهذا اليوم.",
      reasonEn: "Check-in blocked — you have approved leave for this day.",
    };
  }
  return { ok: true };
}
