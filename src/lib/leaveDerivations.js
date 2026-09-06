/** Client helpers aligned with base44/shared/leaveDerivations.ts */

import { citeLeaveType, citeRule, ruleAt, ruleValue } from "./laborRules.js";
import { getLeaveTotal, usedLeaveDays, serviceYearsFromHire } from "./leaveTypes.js";

export const LEAVE_THRESHOLD_DAYS = ruleValue("leave.attachment.thresholdDays");

export const LEAVE_TYPES = [
  { key: "annual", total: ruleValue("leave.annual.days"), article: citeLeaveType("annual")?.article || null, ar: "سنوية", en: "Annual" },
  { key: "sick", total: ruleValue("leave.sick.days"), article: citeLeaveType("sick")?.article || null, ar: "مرضية", en: "Sick", requiresFile: true },
  { key: "maternity", total: ruleValue("leave.maternity.days"), article: citeLeaveType("maternity")?.article || null, ar: "وضع", en: "Maternity", f: true, requiresFile: true },
  { key: "paternity", total: ruleValue("leave.paternity.days"), article: citeLeaveType("paternity")?.article || null, ar: "مولود", en: "Paternity", m: true },
  { key: "marriage", total: ruleValue("leave.marriage.days"), article: citeLeaveType("marriage")?.article || null, ar: "زواج", en: "Marriage" },
  { key: "bereavement", total: ruleValue("leave.bereavement.days"), article: citeLeaveType("bereavement")?.article || null, ar: "وفاة زوج/أصل/فرع", en: "Bereavement" },
  { key: "bereavement_sibling", total: ruleValue("leave.bereavement_sibling.days"), article: citeLeaveType("bereavement_sibling")?.article || null, ar: "وفاة أخ/أخت", en: "Sibling bereavement" },
  { key: "hajj", total: ruleValue("leave.hajj.days"), article: citeLeaveType("hajj")?.article || null, ar: "حج", en: "Hajj" },
  { key: "exam", total: null, article: citeLeaveType("exam")?.article || null, ar: "امتحان", en: "Exam", requiresFile: true },
  { key: "emergency", total: ruleValue("leave.emergency.days"), article: citeLeaveType("emergency")?.article || null, ar: "اضطرارية", en: "Emergency" },
  { key: "unpaid", total: null, article: citeLeaveType("unpaid")?.article || null, ar: "بدون راتب", en: "Unpaid" },
];

export function computeLeaveDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const a = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(endDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

export function leaveNeedsAttachment(request, typeRequiresFile = false) {
  const days = Number(request?.days) || computeLeaveDays(request?.startDate, request?.endDate);
  const type = LEAVE_TYPES.find((t) => t.key === request?.type);
  if (typeRequiresFile || type?.requiresFile) return true;
  return days > ruleValue("leave.attachment.thresholdDays");
}

export function addCalendarDays(iso, n) {
  const s = String(iso || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(n));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function checkStatutoryLeaveGates(request, extras, days, onDate, cite) {
  const type = String(request?.type || "").trim().toLowerCase();
  const profile = extras.profile || {};
  if (type === "hajj") {
    const hajjCite = citeRule("leave.hajj.days", onDate) || cite;
    const minDays = ruleValue("leave.hajj.days", onDate);
    const maxDays = ruleValue("leave.hajj.maxDays", onDate);
    const minYears = ruleValue("leave.hajj.minServiceYears", onDate);
    if (days < minDays) {
      return {
        ok: false,
        error: "HAJJ_UNDER_MIN",
        reason: `موقوف — إجازة الحج لا تقل عن ${minDays} أيام شاملة عيد الأضحى.`,
        reasonEn: `Blocked — Hajj leave may not be less than ${minDays} days including Eid al-Adha.`,
        cite: hajjCite,
      };
    }
    if (days > maxDays) {
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
  if (type === "exam") {
    const noticeDays = ruleValue("leave.exam.noticeDays", onDate);
    const start = String(request.startDate || "").slice(0, 10);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const submitted = String(request.createdAt || request.requestedAt || extras.submittedAt || extras.onDate || today).slice(0, 10);
    const eCite = citeRule("leave.exam.noticeDays", onDate) || cite;
    const earliest = addCalendarDays(submitted, noticeDays);
    if (start && start < earliest) {
      return {
        ok: false,
        error: "EXAM_NOTICE",
        reason: `موقوف — طلب إجازة الامتحان قبل موعدها بـ ${noticeDays} يوماً على الأقل.`,
        reasonEn: `Blocked — exam leave must be requested at least ${noticeDays} days before it starts.`,
        cite: eCite,
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
  const type = String(request.type || "").trim().toLowerCase();
  const days = Number(request.days) || computeLeaveDays(request.startDate, request.endDate);
  const onDate = request.startDate || extras.onDate;
  const cite = citeLeaveType(type, onDate);
  const statutory = checkStatutoryLeaveGates(request, extras, days, onDate, cite);
  if (!statutory.ok) return statutory;
  const skipBalance = type === "unpaid" || type === "exam" || type === "hajj" || request.examRepeat || extras.examRepeat;
  if (type && !skipBalance && extras.profile) {
    const profile = { ...extras.profile };
    if (type === "maternity" && (request.disabledChild || extras.disabledChild)) {
      profile.maternityDisabledChild = true;
    }
    const total = getLeaveTotal(profile, type, onDate);
    if (total != null) {
      const used = usedLeaveDays(extras.requests || extras.profile.leaveRequests || [], type, onDate, extras.profile?.hireDate);
      const remaining = Math.max(0, total - used);
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
  const hasFile = Array.isArray(request.files) && request.files.length > 0;
  if (leaveNeedsAttachment(request, typeRequiresFile) && !hasFile) {
    return {
      ok: false,
      error: "ATTACHMENT_REQUIRED",
      reason: `لا يمكن الاعتماد — يلزم مستند لطلب يتجاوز ${ruleValue("leave.attachment.thresholdDays")} أيام (أو لنوع يتطلب مرفقًا).`,
      reasonEn: `Approval blocked — a document is required for a request over ${ruleValue("leave.attachment.thresholdDays")} days (or a type that requires an attachment).`,
      days,
      threshold: ruleValue("leave.attachment.thresholdDays"),
    };
  }
  return { ok: true, days, cite, warning: statutory.warning || null, reason: statutory.reason, reasonEn: statutory.reasonEn };
}

export function deriveLeaveStats(requests) {
  const list = Array.isArray(requests) ? requests : [];
  const pending = list.filter((r) => (r.status || "pending") === "pending");
  const approved = list.filter((r) => r.status === "approved");
  const rejected = list.filter((r) => r.status === "rejected");
  const needsDoc = pending.filter((r) => leaveNeedsAttachment(r) && !(Array.isArray(r.files) && r.files.length));
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
