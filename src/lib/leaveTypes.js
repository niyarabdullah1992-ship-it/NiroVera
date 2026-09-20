// Shared leave category config used across leave components.

import { profileGender } from "./employeeProfileFields.js";
import { citeLeaveType, isRamadanHoursSubject, ruleAt, ruleValue } from "./laborRules.js";
import { chargeableSpanExcludingHolidays } from "./leaveEidOverlap.js";

export const LEAVE_TYPES = [
  { key: "annual", defaultTotal: ruleValue("leave.annual.days"), article: citeLeaveType("annual")?.article || null, ar: "سنوية", en: "Annual" },
  { key: "grant", defaultTotal: null, article: null, ar: "رصيد", en: "Granted days" },
  { key: "sick", defaultTotal: ruleValue("leave.sick.days"), article: citeLeaveType("sick")?.article || null, requiresFile: true, ar: "مرضية", en: "Sick" },
  { key: "exam", defaultTotal: null, article: citeLeaveType("exam")?.article || null, requiresFile: true, ar: "امتحان", en: "Exam" },
  { key: "marriage", defaultTotal: ruleValue("leave.marriage.days"), article: citeLeaveType("marriage")?.article || null, ar: "زواج", en: "Marriage" },
  { key: "bereavement", defaultTotal: ruleValue("leave.bereavement.days"), article: citeLeaveType("bereavement")?.article || null, ar: "وفاة زوج/أصل/فرع", en: "Bereavement (spouse/parent/child)" },
  { key: "bereavement_sibling", defaultTotal: ruleValue("leave.bereavement_sibling.days"), article: citeLeaveType("bereavement_sibling")?.article || null, ar: "وفاة أخ/أخت", en: "Bereavement (sibling)" },
  { key: "maternity", defaultTotal: ruleValue("leave.maternity.days"), article: citeLeaveType("maternity")?.article || null, gender: "female", requiresFile: true, ar: "أمومة", en: "Maternity" },
  { key: "maternity_extend", defaultTotal: ruleValue("leave.maternity.unpaidExtendDays"), article: citeLeaveType("maternity_extend")?.article || "151", gender: "female", ar: "تمديد وضع بلا أجر", en: "Unpaid maternity extension" },
  { key: "maternity_companion", defaultTotal: ruleValue("leave.maternity.disabledChildDays"), article: citeLeaveType("maternity_companion")?.article || "151", gender: "female", requiresFile: true, ar: "مرافقة مولود مريض/معاق", en: "Sick or disabled-child companion" },
  { key: "iddah", defaultTotal: ruleValue("leave.iddah.days"), article: citeLeaveType("iddah")?.article || null, gender: "female", requiresFile: true, ar: "عدّة وفاة الزوج", en: "Iddah" },
  { key: "paternity", defaultTotal: ruleValue("leave.paternity.days"), article: citeLeaveType("paternity")?.article || null, gender: "male", ar: "أبوة", en: "Paternity" },
  { key: "hajj", defaultTotal: ruleValue("leave.hajj.days"), article: citeLeaveType("hajj")?.article || null, religion: "muslim", ar: "حج", en: "Hajj" },
  { key: "eid", defaultTotal: null, article: citeLeaveType("eid")?.article || null, ar: "عيد / عطلة رسمية", en: "Eid / official holiday" },
  { key: "emergency", defaultTotal: ruleValue("leave.emergency.days"), article: citeLeaveType("emergency")?.article || null, ar: "اضطرارية", en: "Emergency" },
  { key: "unpaid", defaultTotal: null, article: citeLeaveType("unpaid")?.article || null, ar: "بدون راتب", en: "Unpaid" },
];

export function leaveTypeLabel(type, ar = true, profile) {
  const key = String(type || "").trim();
  const found = LEAVE_TYPES.find((item) => item.key === key.toLowerCase());
  if (found) {
    if (found.key === "bereavement" && profileGender(profile) === "female") {
      return ar ? "وفاة أصل/فرع" : "Bereavement (parent/child)";
    }
    return ar ? found.ar : found.en;
  }
  if (!key) return ar ? "إجازة" : "Leave";
  if (/[\u0600-\u06FF]/.test(key)) return key;
  return key;
}

/** Local Friday/Saturday — Saudi weekly rest. Parse YYYY-MM-DD as a local date. */
export function isSaudiWeekend(date) {
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    const day = date.getDay();
    return day === 5 || day === 6;
  }
  const key = String(date || "").slice(0, 10);
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const local = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const day = local.getDay();
  return day === 5 || day === 6;
}

/** Roster people with approved leave on this day — no invented absences. */
export function approvedLeavePeopleOnDay(employees, date = new Date()) {
  const out = [];
  for (const employee of employees || []) {
    const request = approvedLeaveOnDay(employee, date);
    if (!request) continue;
    out.push({
      id: employee.id,
      name: employee.name || employee.id,
      request,
    });
  }
  return out;
}

/**
 * Weekend overlay for the operational calendar.
 * Weekday → null (caller uses the full day record).
 * Weekend with no approved leave → [] (cell stays عطلة).
 * Weekend with approved leave → leave-only people (no fake absence).
 */
export function weekendLeavePeople(employees, date) {
  if (!isSaudiWeekend(date)) return null;
  return approvedLeavePeopleOnDay(employees, date);
}

// Requests longer than this many days require a mandatory justification + supporting file.
export const LEAVE_THRESHOLD_DAYS = ruleValue("leave.attachment.thresholdDays");

export function leaveTypesForProfile(profile) {
  const g = profileGender(profile);
  const muslim = isRamadanHoursSubject({ profile });
  return LEAVE_TYPES.filter((ty) => {
    if (ty.gender && ty.gender !== g) return false;
    if (ty.religion === "muslim" && !muslim) return false;
    if (ty.religion === "non_muslim" && muslim) return false;
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
  if (k === "iddah") return iddahPaidDays(profile, onDate);
  if (k === "maternity_extend") return ruleValue("leave.maternity.unpaidExtendDays", onDate);
  if (k === "maternity_companion") return ruleValue("leave.maternity.disabledChildDays", onDate);
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
  if (k === "eid") return "leave.eid.cite";
  if (k === "iddah") return iddahCiteRuleId(profile, onDate);
  if (k === "maternity_extend") return "leave.maternity.unpaidExtendDays";
  if (k === "maternity_companion") return "leave.maternity.disabledChildDays";
  if (k === "paternity") return "leave.paternity.days";
  return `leave.${k}.days`;
}

export function iddahCiteRuleId(profile, onDate) {
  return isRamadanHoursSubject({ profile }) ? "leave.iddah.days" : "leave.iddah.nonMuslimDays";
}

export function iddahPaidDays(profile, onDate) {
  return isRamadanHoursSubject({ profile })
    ? ruleValue("leave.iddah.days", onDate)
    : ruleValue("leave.iddah.nonMuslimDays", onDate);
}

export function iddahSpanFromEvent(eventDate, profile, onDate) {
  const start = dateOnly(eventDate);
  const days = iddahPaidDays(profile, start || onDate);
  if (!start || !days) return { start: "", end: "", days: 0 };
  return { start, end: addCalendarDays(start, days - 1), days };
}

export function lastApprovedMaternity(requests) {
  const ended = (requests || []).filter((row) => (
    String(row?.type || "").toLowerCase() === "maternity"
    && row?.status === "approved"
    && dateOnly(row.endDate)
  ));
  if (!ended.length) return null;
  return [...ended].sort((a, b) => dateOnly(b.endDate).localeCompare(dateOnly(a.endDate)))[0];
}

/** Art. 151: unpaid extension and companion month begin after maternity ends. */
export function maternityFollowOnSpan(requests, days) {
  const mat = lastApprovedMaternity(requests);
  const n = Math.max(1, Number(days) || 0);
  if (!mat || !n) return { start: "", end: "", days: 0, after: "", maternityEnd: "" };
  const maternityEnd = dateOnly(mat.endDate);
  const start = addCalendarDays(maternityEnd, 1);
  return { start, end: addCalendarDays(start, n - 1), days: n, after: start, maternityEnd };
}

export function getLeaveTotal(profile, key, onDate) {
  const floor = statutoryLeaveFloor(key, profile, onDate);
  const k = String(key || "").trim().toLowerCase();
  // Art. 160 is an event span, not a stored balance. A leftover 130 from a
  // previous Muslim floor must not outrank the 15-day non-Muslim entitlement.
  if (k === "iddah" || k === "maternity_extend" || k === "maternity_companion") return floor;
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

function overlapRange(a0, a1, b0, b1) {
  if (!a0 || !a1 || !b0 || !b1) return null;
  const start = a0 > b0 ? a0 : b0;
  const end = a1 < b1 ? a1 : b1;
  if (start > end) return null;
  return { start, end };
}

/** Art. 24(2): official holidays inside annual leave extend it — they are not charged. */
export function chargeableAnnualDays(startDate, endDate, calendar) {
  return chargeableSpanExcludingHolidays(startDate, endDate, calendar);
}

/** Art. 24(2): Eid (and other official holidays) inside sick leave pay full wage, not the sick band. */
export function chargeableSickDays(startDate, endDate, calendar) {
  return chargeableSpanExcludingHolidays(startDate, endDate, calendar);
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

export function examLeaveChargesAnnual(request) {
  return String(request?.type || "").toLowerCase() === "exam"
    && String(request?.status || "") === "approved"
    && request?.examPayFrom === "annual";
}

export function usedLeaveDays(requests, key, onDate, hireDate, calendar) {
  const k = String(key || "").trim().toLowerCase();
  const approved = (requests || []).filter((r) => String(r.type || "").toLowerCase() === k && r.status === "approved");
  if (k === "sick") {
    const win = sickStatutoryYearWindow(requests, onDate);
    return approved.reduce((sum, r) => {
      const start = dateOnly(r.startDate);
      const end = dateOnly(r.endDate) || (start ? addCalendarDays(start, Math.max(1, Number(r.days) || 1) - 1) : "");
      const span = overlapRange(start, end, win.start, win.end);
      return sum + (span ? chargeableSickDays(span.start, span.end, calendar) : 0);
    }, 0);
  }
  if (k === "annual") {
    const win = anniversaryYearWindow(hireDate, onDate);
    const charged = approved.concat((requests || []).filter(examLeaveChargesAnnual));
    return charged.reduce((sum, r) => {
      const start = dateOnly(r.startDate);
      const end = dateOnly(r.endDate) || (start ? addCalendarDays(start, Math.max(1, Number(r.days) || 1) - 1) : "");
      if (start && end && win) {
        const span = overlapRange(start, end, win.start, win.end);
        return sum + (span ? chargeableAnnualDays(span.start, span.end, calendar) : 0);
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

export function grantDaysOf(profile) {
  return (profile?.discretionaryGrants || []).reduce((n, grant) => n + Math.max(0, Number(grant.days) || 0), 0);
}

/** Discretionary days still available — grant leave and annual overflow share this pool. */
export function leftoverGrantDays(profile, requests, onDate) {
  const split = annualBalanceSplit(profile, requests, onDate);
  const overflow = Math.max(0, (split.currentUsed + split.carryUsed) - (split.currentTotal || 0) - split.carryTotal);
  return Math.max(0, grantDaysOf(profile) - usedLeaveDays(requests, "grant", onDate, profile?.hireDate) - overflow);
}

export function remainingLeaveDays(profile, requests, key = "annual", onDate) {
  if (key === "grant") return leftoverGrantDays(profile, requests, onDate);
  if (key === "annual") {
    const split = annualBalanceSplit(profile, requests, onDate);
    if (split.currentTotal == null && split.carryTotal === 0) return null;
    return split.remaining;
  }
  const total = getLeaveTotal(profile, key, onDate);
  if (total == null) return null;
  return Math.max(0, total - usedLeaveDays(requests, key, onDate, profile?.hireDate));
}

/** Unused days of the previous hire-anniversary year — Art. 110 carry line. */
export function unusedFromPreviousYear(profile, requests, onDate) {
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

/** Current-year statutory line plus a separate carry line; carry is consumed first. */
export function annualBalanceSplit(profile, requests, onDate) {
  const currentTotal = getLeaveTotal(profile, "annual", onDate);
  const usedThisYear = usedLeaveDays(requests, "annual", onDate, profile?.hireDate);
  const carryTotal = unusedFromPreviousYear(profile, requests, onDate);
  const carryUsed = Math.min(carryTotal, usedThisYear);
  const currentUsed = Math.max(0, usedThisYear - carryTotal);
  const currentLeft = currentTotal == null ? 0 : Math.max(0, currentTotal - currentUsed);
  const carryLeft = Math.max(0, carryTotal - carryUsed);
  return {
    currentTotal,
    currentUsed,
    currentLeft,
    carryTotal,
    carryUsed,
    carryLeft,
    remaining: currentLeft + carryLeft,
  };
}

/** Art. 154: after return from maternity, until nursingUntil or two years from birth/return. */
export function isNursingSubject(employee, onDate) {
  const profile = employee?.profile || {};
  const gender = String(profile.gender || "").toLowerCase();
  if (gender !== "female" && !gender.includes("أنث")) return false;
  const day = dateOnly(onDate) || todayRiyadh();
  const ended = (employee?.leaveRequests || []).filter((r) => (
    String(r.type || "").toLowerCase() === "maternity"
    && r.status === "approved"
    && dateOnly(r.endDate)
    && dateOnly(r.endDate) < day
  ));
  if (!ended.length) return false;
  const last = [...ended].sort((a, b) => dateOnly(b.endDate).localeCompare(dateOnly(a.endDate)))[0];
  const until = dateOnly(profile.nursingUntil) || addCalendarDays(dateOnly(last.eventDate || last.endDate), 730);
  return !!until && day <= until;
}

function leaveDayKey(date = new Date()) {
  return typeof date === "string"
    ? date.slice(0, 10)
    : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(date);
}

/** Inclusive cover range: requested dates win over a stale approval-day window. */
export function leaveCoverRange(request) {
  const start = String(request?.startDate || "").slice(0, 10);
  const end = String(request?.endDate || "").slice(0, 10);
  if (start && end) return { start, end };
  const activeStart = String(request?.activeStartDate || "").slice(0, 10);
  const activeEnd = String(request?.activeEndDate || "").slice(0, 10);
  if (activeStart && activeEnd) return { start: activeStart, end: activeEnd };
  return { start: "", end: "" };
}

function leaveRequestCoversDay(request, day) {
  if (!request || request.status !== "approved") return false;
  const { start, end } = leaveCoverRange(request);
  return !!start && !!end && start <= day && day <= end;
}

/** The approved طلباتي / file request covering this day, if any. */
export function approvedLeaveOnDay(employee, date = new Date()) {
  const day = leaveDayKey(date);
  return (employee?.leaveRequests || []).find((request) => leaveRequestCoversDay(request, day)) || null;
}

// True when an approved request covers the supplied day. Requested start/end
// win; a leftover approval-day window is ignored when dates exist.
export function isOnApprovedLeave(employee, date = new Date()) {
  return !!approvedLeaveOnDay(employee, date);
}

export function isOnLeaveToday(employee) {
  return isOnApprovedLeave(employee, new Date());
}