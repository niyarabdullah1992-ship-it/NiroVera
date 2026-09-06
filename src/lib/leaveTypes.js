// Shared leave category config used across leave components.

import { citeLeaveType, ruleAt, ruleValue } from "./laborRules.js";

export const LEAVE_TYPES = [
  { key: "annual", defaultTotal: ruleValue("leave.annual.days"), article: citeLeaveType("annual")?.article || null, ar: "سنوية", en: "Annual" },
  { key: "sick", defaultTotal: ruleValue("leave.sick.days"), article: citeLeaveType("sick")?.article || null, requiresFile: true, ar: "مرضية", en: "Sick" },
  { key: "exam", defaultTotal: null, article: citeLeaveType("exam")?.article || null, requiresFile: true, ar: "امتحان", en: "Exam" },
  { key: "marriage", defaultTotal: ruleValue("leave.marriage.days"), article: citeLeaveType("marriage")?.article || null, ar: "زواج", en: "Marriage" },
  { key: "bereavement", defaultTotal: ruleValue("leave.bereavement.days"), article: citeLeaveType("bereavement")?.article || null, ar: "وفاة زوج/أصل/فرع", en: "Bereavement (spouse/parent/child)" },
  { key: "bereavement_sibling", defaultTotal: ruleValue("leave.bereavement_sibling.days"), article: citeLeaveType("bereavement_sibling")?.article || null, ar: "وفاة أخ/أخت", en: "Bereavement (sibling)" },
  { key: "maternity", defaultTotal: ruleValue("leave.maternity.days"), article: citeLeaveType("maternity")?.article || null, gender: "female", requiresFile: true, ar: "أمومة", en: "Maternity" },
  { key: "paternity", defaultTotal: ruleValue("leave.paternity.days"), article: citeLeaveType("paternity")?.article || null, gender: "male", ar: "أبوة", en: "Paternity" },
  { key: "hajj", defaultTotal: ruleValue("leave.hajj.days"), article: citeLeaveType("hajj")?.article || null, ar: "حج", en: "Hajj" },
  { key: "emergency", defaultTotal: ruleValue("leave.emergency.days"), article: citeLeaveType("emergency")?.article || null, ar: "اضطرارية", en: "Emergency" },
  { key: "unpaid", defaultTotal: null, article: citeLeaveType("unpaid")?.article || null, ar: "بدون راتب", en: "Unpaid" },
];

export function leaveTypeLabel(type, ar = true) {
  const key = String(type || "").trim();
  const found = LEAVE_TYPES.find((item) => item.key === key.toLowerCase());
  if (found) return ar ? found.ar : found.en;
  if (!key) return ar ? "إجازة" : "Leave";
  if (/[\u0600-\u06FF]/.test(key)) return key;
  return key;
}

// Requests longer than this many days require a mandatory justification + supporting file.
export const LEAVE_THRESHOLD_DAYS = ruleValue("leave.attachment.thresholdDays");

export function leaveTypesForProfile(profile) {
  const g = String(profile?.gender || "").toLowerCase();
  const female = g === "female" || g.includes("أنثى");
  const male = g === "male" || g.includes("ذكر");
  return LEAVE_TYPES.filter((ty) => {
    if (ty.gender === "female" && male) return false;
    if (ty.gender === "male" && female) return false;
    return true;
  });
}

export function serviceYearsFromHire(hireDate, onDate) {
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

/** Ministry floor — the company may give more, never less. */
export function statutoryLeaveFloor(key, profile, onDate) {
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
  if (k === "sick") {
    return ruleValue("leave.sick.days", onDate);
  }
  return LEAVE_TYPES.find((ty) => ty.key === k)?.defaultTotal ?? null;
}

/** The catalog row that actually fired for this leave type on this file. */
export function leaveCiteRuleId(key, profile, onDate) {
  const k = String(key || "").trim().toLowerCase();
  if (!k) return "";
  if (k === "annual") {
    return serviceYearsFromHire(profile?.hireDate, onDate) >= 5
      ? "leave.annual.afterFiveYearsDays"
      : "leave.annual.days";
  }
  if (k === "maternity") {
    return profile?.maternityDisabledChild
      ? "leave.maternity.disabledChildDays"
      : "leave.maternity.days";
  }
  if (k === "exam") return "leave.exam.cite";
  if (k === "unpaid") return "leave.unpaid.cite";
  if (k === "paternity") return "leave.paternity.days";
  return `leave.${k}.days`;
}

export function getLeaveTotal(profile, key, onDate) {
  const floor = statutoryLeaveFloor(key, profile, onDate);
  const custom = profile?.leaveTotals?.[key];
  if (floor == null) return custom ?? null;
  if (custom == null) return floor;
  return Math.max(Number(custom) || 0, floor);
}

function dateOnly(iso) {
  const s = String(iso || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function parseLocalDay(iso) {
  const s = dateOnly(iso);
  if (!s) return null;
  return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
}

function overlapInclusiveDays(a0, a1, b0, b1) {
  if (!a0 || !a1 || !b0 || !b1) return 0;
  const start = a0 > b0 ? a0 : b0;
  const end = a1 < b1 ? a1 : b1;
  if (start > end) return 0;
  return computeDays(start, end);
}

/** Inclusive local days between YYYY-MM-DD dates. */
function inclusiveDays(a, b) {
  const d0 = parseLocalDay(a);
  const d1 = parseLocalDay(b);
  if (!d0 || !d1) return 0;
  return Math.max(0, Math.round((d1.getTime() - d0.getTime()) / 86400000) + 1);
}

function todayRiyadh() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}

/** Hire-anniversary leave year: from the anniversary on or before onDate through the day before the next. */
export function anniversaryYearWindow(hireDate, onDate) {
  const day = dateOnly(onDate) || todayRiyadh();
  const hire = dateOnly(hireDate);
  if (!hire) return null;
  const origin = parseLocalDay(hire);
  const on = parseLocalDay(day);
  if (!origin || !on) return null;
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
export function accruedAnnualDaysAtExit(hireDate, entitlement, exitDate) {
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
export function sickStatutoryYearWindow(requests, onDate) {
  const day = dateOnly(onDate) || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const first = (requests || [])
    .filter((r) => String(r.type || "").toLowerCase() === "sick" && r.status === "approved")
    .map((r) => dateOnly(r.startDate))
    .filter(Boolean)
    .sort()[0];
  if (!first) return { start: day, end: addCalendarDays(day, 364) };
  const origin = parseLocalDay(first);
  const on = parseLocalDay(day) || origin;
  let start = new Date(origin.getTime());
  while (true) {
    const next = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
    if (next > on) break;
    start = next;
  }
  const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return { start: startIso, end: addCalendarDays(startIso, 364) };
}

export function usedLeaveDays(requests, key, onDate, hireDate) {
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
  return approved.reduce((sum, r) => sum + (Number(r.days) || computeDays(r.startDate, r.endDate) || 0), 0);
}

export function computeDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  return Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
}

export function addCalendarDays(iso, n) {
  const s = String(iso || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(n));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Inclusive end date for a start day plus a requested day count (1 day = same date). */
export function endDateFromLeaveDays(startDate, days) {
  const n = Math.max(1, Math.round(Number(days) || 0));
  return addCalendarDays(startDate, n - 1);
}

export function remainingLeaveDays(profile, requests, key = "annual", onDate) {
  const total = getLeaveTotal(profile, key, onDate);
  if (total == null) return null;
  return Math.max(0, total - usedLeaveDays(requests, key, onDate, profile?.hireDate));
}

// True when an approved request covers the supplied day. Annual leave uses its
// approval-activated window when available; every comparison is date-only and inclusive.
export function isOnApprovedLeave(employee, date = new Date()) {
  const day = typeof date === "string"
    ? date.slice(0, 10)
    : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(date);
  return (employee?.leaveRequests || []).some((request) => {
    if (request.status !== "approved") return false;
    const useActiveWindow = request.type === "annual" && request.activeStartDate && request.activeEndDate;
    const start = (useActiveWindow ? request.activeStartDate : request.startDate)?.slice(0, 10);
    const end = (useActiveWindow ? request.activeEndDate : request.endDate)?.slice(0, 10);
    return !!start && !!end && start <= day && day <= end;
  });
}

export function isOnLeaveToday(employee) {
  return isOnApprovedLeave(employee, new Date());
}