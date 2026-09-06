/** Leave derivation — statutory types, days, approve gate (>5 days needs attachment).
 *  Design ref: NiroVera Platform.dc.html class Component (leave / canOk / needsDoc).
 *  Totals and articles come from laborRules — cite only when source is labour.
 */

import { citeLeaveType, citeRule, ruleAt, ruleValue } from "./laborRules.ts";

export const LEAVE_THRESHOLD_DAYS = ruleValue("leave.attachment.thresholdDays");

export const LEAVE_TYPES = [
  { key: "annual", total: ruleValue("leave.annual.days"), article: citeLeaveType("annual")?.article ?? null, ar: "سنوية", en: "Annual" },
  { key: "sick", total: ruleValue("leave.sick.days"), article: citeLeaveType("sick")?.article ?? null, ar: "مرضية", en: "Sick", requiresFile: true },
  { key: "maternity", total: ruleValue("leave.maternity.days"), article: citeLeaveType("maternity")?.article ?? null, ar: "وضع", en: "Maternity", f: true, requiresFile: true },
  { key: "paternity", total: ruleValue("leave.paternity.days"), article: citeLeaveType("paternity")?.article ?? null, ar: "مولود", en: "Paternity", m: true },
  { key: "marriage", total: ruleValue("leave.marriage.days"), article: citeLeaveType("marriage")?.article ?? null, ar: "زواج", en: "Marriage" },
  { key: "bereavement", total: ruleValue("leave.bereavement.days"), article: citeLeaveType("bereavement")?.article ?? null, ar: "وفاة زوج/أصل/فرع", en: "Bereavement" },
  { key: "bereavement_sibling", total: ruleValue("leave.bereavement_sibling.days"), article: citeLeaveType("bereavement_sibling")?.article ?? null, ar: "وفاة أخ/أخت", en: "Sibling bereavement" },
  { key: "hajj", total: ruleValue("leave.hajj.days"), article: citeLeaveType("hajj")?.article ?? null, ar: "حج", en: "Hajj" },
  { key: "exam", total: null, article: citeLeaveType("exam")?.article ?? null, ar: "امتحان", en: "Exam", requiresFile: true },
  { key: "emergency", total: ruleValue("leave.emergency.days"), article: citeLeaveType("emergency")?.article ?? null, ar: "اضطرارية", en: "Emergency" },
  { key: "unpaid", total: null, article: citeLeaveType("unpaid")?.article ?? null, ar: "بدون راتب", en: "Unpaid" },
] as const;

export type LeaveRequestLike = {
  id?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  days?: number;
  files?: unknown[] | null;
  reason?: string | null;
  status?: string;
  employeeId?: string;
  eventDate?: string;
  disabledChild?: boolean;
  examRepeat?: boolean;
  createdAt?: string;
  requestedAt?: string;
};

export type LeaveApproveExtras = {
  profile?: {
    hireDate?: string;
    leaveTotals?: Record<string, number>;
    hajjPerformed?: boolean;
    maternityDisabledChild?: boolean;
    leaveRequests?: LeaveRequestLike[];
  };
  requests?: LeaveRequestLike[];
  eventDate?: string;
  disabledChild?: boolean;
  examRepeat?: boolean;
  submittedAt?: string;
  onDate?: string;
};

export function addCalendarDays(iso: string | undefined, n: number) {
  const s = String(iso || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(n));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function serviceYearsFromHire(hireDate?: string, onDate?: string) {
  const start = String(hireDate || "").slice(0, 10);
  const m = start.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  const day = String(onDate || new Date().toISOString()).slice(0, 10);
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
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

export function leaveNeedsAttachment(request: LeaveRequestLike) {
  const days = Number(request.days) || computeLeaveDays(request.startDate, request.endDate);
  const type = LEAVE_TYPES.find((t) => t.key === request.type);
  if (type && "requiresFile" in type && type.requiresFile) return true;
  return days > ruleValue("leave.attachment.thresholdDays");
}

export function hasLeaveAttachment(request: LeaveRequestLike) {
  return Array.isArray(request.files) && request.files.length > 0;
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

function inclusiveDays(a: string, b: string) {
  return computeLeaveDays(a, b);
}

/** Hire-anniversary leave year: from the anniversary on or before onDate through the day before the next. */
export function anniversaryYearWindow(hireDate?: string, onDate?: string) {
  const day = dateOnly(onDate) || new Date().toISOString().slice(0, 10);
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
  const day = dateOnly(onDate) || new Date().toISOString().slice(0, 10);
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
      return sum + overlapInclusiveDays(start, end, win.start, win.end);
    }, 0);
  }
  if (k === "annual") {
    const win = anniversaryYearWindow(hireDate, onDate);
    return approved.reduce((sum, r) => {
      const start = dateOnly(r.startDate);
      const end = dateOnly(r.endDate) || (start ? addCalendarDays(start, Math.max(1, Number(r.days) || 1) - 1) : "");
      if (start && end && win) {
        return sum + overlapInclusiveDays(start, end, win.start, win.end);
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
  const type = String(request.type || "").trim().toLowerCase();
  const days = Number(request.days) || computeLeaveDays(request.startDate, request.endDate);
  const onDate = request.startDate || extras.onDate;
  const cite = citeLeaveType(type, onDate);
  if (type === "hajj") {
    const hajjCite = citeRule("leave.hajj.days", onDate) || cite;
    const minDays = ruleValue("leave.hajj.days", onDate);
    const maxDays = ruleValue("leave.hajj.maxDays", onDate);
    const minYears = ruleValue("leave.hajj.minServiceYears", onDate);
    if (days < minDays) {
      return {
        ok: false as const,
        error: "HAJJ_UNDER_MIN",
        reason: `موقوف — إجازة الحج لا تقل عن ${minDays} أيام شاملة عيد الأضحى.`,
        reasonEn: `Blocked — Hajj leave may not be less than ${minDays} days including Eid al-Adha.`,
        cite: hajjCite,
      };
    }
    if (days > maxDays) {
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
        ok: false as const,
        error: "EXAM_NOTICE",
        reason: `موقوف — طلب إجازة الامتحان قبل موعدها بـ ${noticeDays} يوماً على الأقل.`,
        reasonEn: `Blocked — exam leave must be requested at least ${noticeDays} days before it starts.`,
        cite: eCite,
      };
    }
  }
  let warning: string | null = null;
  let warningReason: string | undefined;
  let warningReasonEn: string | undefined;
  if (type === "unpaid") {
    const cap = ruleValue("leave.unpaid.suspendAfterDays", onDate);
    if (days > cap) {
      warning = "CONTRACT_SUSPENDED";
      warningReason = `تنبيه — الإجازة بلا أجر فيما زاد على ${cap} يوماً توقف العقد ما لم يتفق الطرفان على خلاف ذلك.`;
      warningReasonEn = `Notice — unpaid leave beyond ${cap} days suspends the contract unless the parties agree otherwise.`;
    }
  }
  const skipBalance = type === "unpaid" || type === "exam" || type === "hajj" || request.examRepeat;
  if (type && !skipBalance && extras.profile) {
    const profile = { ...extras.profile };
    if (type === "maternity" && (request.disabledChild || extras.disabledChild)) {
      profile.maternityDisabledChild = true;
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
    };
  }
  return { ok: true as const, days, cite, warning, reason: warningReason, reasonEn: warningReasonEn };
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

/** True when an approved request covers the day (annual uses active window when set). */
export function isOnApprovedLeave(requests: LeaveRequestLike[] | null | undefined, dayKey: string) {
  const day = String(dayKey || "").slice(0, 10);
  if (!day) return false;
  return (requests || []).some((request) => {
    if (request.status !== "approved") return false;
    const useActive =
      request.type === "annual" &&
      (request as { activeStartDate?: string }).activeStartDate &&
      (request as { activeEndDate?: string }).activeEndDate;
    const start = String(
      useActive
        ? (request as { activeStartDate?: string }).activeStartDate
        : request.startDate || "",
    ).slice(0, 10);
    const end = String(
      useActive
        ? (request as { activeEndDate?: string }).activeEndDate
        : request.endDate || "",
    ).slice(0, 10);
    return !!start && !!end && start <= day && day <= end;
  });
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
