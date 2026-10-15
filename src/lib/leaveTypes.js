// Shared leave category config used across leave components.

import { profileGender } from "./employeeProfileFields.js";
import { citeLeaveType, isRamadanHoursSubject, religionOnFile, ruleAt, ruleValue } from "./laborRules.js";
import { chargeableAnnualWorkDays, chargeableSpanExcludingHolidays } from "./leaveEidOverlap.js";
import { officialHolidayKindLabel, officialHolidayLeaveLabel, officialHolidayOn } from "./ummAlQuraCalendar.js";

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
  { key: "iddah", defaultTotal: ruleValue("leave.iddah.days"), article: citeLeaveType("iddah")?.article || null, gender: "female", religionDependent: true, requiresFile: true, ar: "عدّة وفاة الزوج", en: "Iddah" },
  { key: "paternity", defaultTotal: ruleValue("leave.paternity.days"), article: citeLeaveType("paternity")?.article || null, gender: "male", ar: "أبوة", en: "Paternity" },
  { key: "hajj", defaultTotal: ruleValue("leave.hajj.days"), article: citeLeaveType("hajj")?.article || null, religion: "muslim", ar: "حج", en: "Hajj" },
  { key: "eid", defaultTotal: null, article: citeLeaveType("eid")?.article || null, ar: "اليوم الوطني · يوم التأسيس · العيد", en: "National Day · Founding Day · Eid" },
  { key: "work_injury", defaultTotal: null, article: null, requiresFile: true, ar: "إصابة عمل", en: "Work injury" },
  { key: "emergency", defaultTotal: ruleValue("leave.emergency.days"), article: citeLeaveType("emergency")?.article || null, ar: "اضطرارية", en: "Emergency" },
  { key: "comp", defaultTotal: null, article: "107", ar: "تعويضية (بدل إضافي)", en: "Compensatory (for overtime)" },
  { key: "job_search", defaultTotal: null, article: "78", employerNoticeOnly: true, ar: "يوم بحث عن عمل", en: "Job-search day" },
  // Regs Art. 42: paid leave on each kidney-dialysis day, on a report from the treating provider.
  { key: "dialysis", defaultTotal: null, article: null, requiresFile: true, ar: "غسيل كلوي (اللائحة م42)", en: "Kidney dialysis (Regs Art. 42)" },
  // Regs Annex 2 (accommodations), §6 temporary disability / chronic or temporary illness: days absent for
  // physical or occupational therapy, chemotherapy or radiotherapy are paid leave — on the treating report.
  { key: "therapy", defaultTotal: null, article: null, requiresFile: true, disabilityAccommodation: true, ar: "جلسة علاج (اللائحة، الملحق 2)", en: "Therapy session (Regs Annex 2)" },
  { key: "unpaid", defaultTotal: null, article: citeLeaveType("unpaid")?.article || null, ar: "بدون راتب", en: "Unpaid" },
];

export function leaveTypeLabel(type, ar = true, profile, onDate, calendar) {
  const key = String(type || "").trim();
  const found = LEAVE_TYPES.find((item) => item.key === key.toLowerCase());
  if (found) {
    if (found.key === "bereavement" && profileGender(profile) === "female") {
      return ar ? "وفاة أصل/فرع" : "Bereavement (parent/child)";
    }
    if (found.key === "eid" && onDate) {
      const hit = officialHolidayOn(onDate, calendar);
      if (hit?.id === "national" || hit?.id === "founding" || hit?.id === "fitr" || hit?.id === "adha") {
        return officialHolidayKindLabel(hit.id, ar, calendar);
      }
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
    // Religion decides these (Hajj — Art. 114; iddah 130 or 15 days — Art. 160): hidden until it is on the file.
    if ((ty.religion || ty.religionDependent) && !religionOnFile({ profile })) return false;
    // Annex 2 accommodations: hidden only when the file says plainly there is no disability or chronic illness.
    if (ty.disabilityAccommodation && therapyLeaveEligibility(profile) === "no") return false;
    // Art. 78: only while a notice given by the employer runs.
    if (ty.employerNoticeOnly) {
      const exit = profile?.contractExit || {};
      const today = new Date().toISOString().slice(0, 10);
      if (exit.party !== "employer" || !exit.effectiveDate || String(exit.effectiveDate).slice(0, 10) < today) return false;
    }
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

/** Annex 2 eligibility: "yes" (flag on file), "no" (file says none), "unknown" (shown to all with a note). */
export function therapyLeaveEligibility(profile) {
  const p = profile || {};
  const flags = [p.disability, p.hasDisability, p.chronicIllness, p.disabilityStatus];
  if (flags.some((v) => v === true || v === "yes" || v === "true")) return "yes";
  if (flags.some((v) => v === false || v === "no" || v === "none")) return "no";
  return "unknown";
}

/** Art. 116 — the parties agreed this unpaid leave does not suspend the contract. */
export function unpaidAgreedOtherwise(r) {
  return r?.agreedOtherwise === true || r?.contractNotSuspended === true || r?.agreedNotSuspended === true;
}

/**
 * Art. 116 + Regs Art. 25: unpaid leave beyond twenty days suspends the contract and every effect of it,
 * unless the parties agree otherwise. Counted per work (hire-anniversary) year, cumulatively — the Law's
 * definition of continuous service keeps only unpaid absences "not over twenty days, intermittent, within
 * the work year". Returns the suspended day keys and a per-request summary.
 */
export function unpaidSuspensionPlan(requests, hireDate, extraRequest) {
  const cap = ruleValue("leave.unpaid.suspendAfterDays") || 20;
  const rows = (requests || [])
    .filter((r) => r && String(r.type || "").toLowerCase() === "unpaid" && ["approved", "accepted"].includes(String(r.status || "").toLowerCase()))
    .filter((r) => !extraRequest || r.id !== extraRequest.id);
  if (extraRequest) rows.push({ ...extraRequest, status: "approved" });
  rows.sort((a, b) => dateOnly(a.startDate).localeCompare(dateOnly(b.startDate)));
  const hire = dateOnly(hireDate);
  const perYear = new Map();
  const days = [];
  const byRequest = {};
  for (const r of rows) {
    const start = dateOnly(r.startDate);
    const end = dateOnly(r.endDate) || (start && Number(r.days) > 1 ? addCalendarDays(start, Math.round(Number(r.days)) - 1) : start);
    if (!start || end < start) continue;
    let cursor = start;
    let guard = 0;
    while (cursor && cursor <= end && guard < 2000) {
      guard += 1;
      const yearKey = hire ? (anniversaryYearWindow(hire, cursor)?.start || cursor.slice(0, 4)) : cursor.slice(0, 4);
      const n = (perYear.get(yearKey) || 0) + 1;
      perYear.set(yearKey, n);
      // «ما لم يتفق الطرفان على خلاف ذلك» — any of the agreement flags keeps the contract running.
      if (n > cap && !unpaidAgreedOtherwise(r)) {
        days.push(cursor);
        const s = byRequest[r.id || `${start}:${end}`] || { days: 0, from: cursor, to: cursor };
        s.days += 1;
        s.to = cursor;
        byRequest[r.id || `${start}:${end}`] = s;
      }
      cursor = addCalendarDays(cursor, 1);
    }
  }
  days.sort();
  return { cap, days, byRequest };
}

/** Suspended contract days (Art. 116) that fall inside [from, to]. */
export function unpaidSuspensionDays(requests, from, to, hireDate) {
  const a = dateOnly(from) || "0000-01-01";
  const b = dateOnly(to) || "9999-12-31";
  return unpaidSuspensionPlan(requests, hireDate).days.filter((d) => d >= a && d <= b).length;
}

/**
 * Service that counts for the five-year 30-day step (Art. 109), the Hajj two-year condition (Art. 114)
 * and annual-leave accrual: suspended contract days (Art. 116, Regs Art. 25(1)) are taken out.
 */
export function effectiveServiceYears(profile, requests, onDate) {
  const years = serviceYearsFromHire(profile?.hireDate, onDate);
  const list = requests || profile?.leaveRequests;
  const suspended = Array.isArray(list)
    ? unpaidSuspensionDays(list, profile?.hireDate, onDate, profile?.hireDate)
    : Math.max(0, Number(profile?.unpaidSuspendedDays) || 0);
  return Math.max(0, years - suspended / 365.25);
}

/** Ministry floor — the company may give more, never less. */
export function statutoryLeaveFloor(key, profile, onDate, requests) {
  const k = String(key || "").trim().toLowerCase();
  if (k === "annual") {
    const years = effectiveServiceYears(profile, requests, onDate);
    return years >= 5
      ? ruleValue("leave.annual.afterFiveYearsDays", onDate)
      : ruleValue("leave.annual.days", onDate);
  }
  // Art. 151(1): twelve weeks. The sick/disabled-child month (151(2)) is its own leave type, never added here.
  if (k === "maternity") return ruleValue("leave.maternity.days", onDate);
  if (k === "sick") {
    return ruleValue("leave.sick.days", onDate);
  }
  if (k === "iddah") return iddahPaidDays(profile, onDate);
  if (k === "maternity_extend") return ruleValue("leave.maternity.unpaidExtendDays", onDate);
  if (k === "maternity_companion") return ruleValue("leave.maternity.disabledChildDays", onDate);
  return LEAVE_TYPES.find((ty) => ty.key === k)?.defaultTotal ?? null;
}

/** The catalog row that actually fired for this leave type on this file. */
export function leaveCiteRuleId(key, profile, onDate, calendar) {
  const k = String(key || "").trim().toLowerCase();
  if (!k) return "";
  if (k === "annual") {
    return serviceYearsFromHire(profile?.hireDate, onDate) >= 5
      ? "leave.annual.afterFiveYearsDays"
      : "leave.annual.days";
  }
  if (k === "maternity") return "leave.maternity.days";
  if (k === "exam") return "leave.exam.cite";
  if (k === "unpaid") return "leave.unpaid.cite";
  if (k === "eid") {
    const hit = officialHolidayOn(onDate, calendar);
    if (hit?.id === "national") return "leave.nationalDay.days";
    if (hit?.id === "founding") return "leave.foundingDay.days";
    if (hit?.id === "fitr") return "leave.eid.fitrDays";
    if (hit?.id === "adha") return "leave.eid.adhaDays";
    return "leave.eid.cite";
  }
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

export function getLeaveTotal(profile, key, onDate, requests) {
  const floor = statutoryLeaveFloor(key, profile, onDate, requests);
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

/** Art. 109 work days: holidays (regs 24) and weekly rest (Art. 104 + company off) are not charged. */
export function chargeableAnnualDays(startDate, endDate, calendar, company, employee) {
  return chargeableAnnualWorkDays(startDate, endDate, calendar, company, employee);
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

/** Article 117 + Regs Art. 41: the sick year starts on the first sick leave and runs
 *  365 days; the next sick year starts on the first sick leave taken after that
 *  window ends (not on the anniversary of the very first one). */
export function sickStatutoryYearWindow(requests, onDate) {
  const day = dateOnly(onDate) || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const starts = [...new Set((requests || [])
    .filter((r) => String(r.type || "").toLowerCase() === "sick" && r.status === "approved")
    .map((r) => dateOnly(r.startDate))
    .filter((d) => d && d <= day))]
    .sort();
  let win = null;
  for (const s of starts) {
    if (!win || s > win.end) win = { start: s, end: addCalendarDays(s, 364) };
  }
  if (!win || day > win.end) return { start: day, end: addCalendarDays(day, 364) };
  return win;
}

export function examLeaveChargesAnnual(request) {
  return String(request?.type || "").toLowerCase() === "exam"
    && String(request?.status || "") === "approved"
    && request?.examPayFrom === "annual";
}

/**
 * Leaves the law gives again at every occurrence (Arts. 113 and 151): marriage, a death, a birth.
 * Their days are counted per event, never as one balance for the whole service.
 */
export const PER_EVENT_LEAVE_TYPES = ["marriage", "bereavement", "bereavement_sibling", "paternity", "maternity"];

export function usedLeaveDays(requests, key, onDate, hireDate, calendar, company, employee, { eventDate, exceptId } = {}) {
  const k = String(key || "").trim().toLowerCase();
  const approved = (requests || []).filter((r) => String(r.type || "").toLowerCase() === k && r.status === "approved");
  if (PER_EVENT_LEAVE_TYPES.includes(k)) {
    const ev = dateOnly(eventDate);
    if (!ev) return 0;
    return approved
      .filter((r) => r.id !== exceptId && dateOnly(r.eventDate) === ev)
      .reduce((sum, r) => sum + (Number(r.days) || computeDays(r.startDate, r.endDate) || 0), 0);
  }
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
        return sum + (span ? chargeableAnnualDays(span.start, span.end, calendar, company, employee) : 0);
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
export function leftoverGrantDays(profile, requests, onDate, company, employee) {
  const split = annualBalanceSplit(profile, requests, onDate, company, employee);
  const overflow = Math.max(0, (split.currentUsed + split.carryUsed) - (split.currentTotal || 0) - split.carryTotal);
  return Math.max(0, grantDaysOf(profile) - usedLeaveDays(requests, "grant", onDate, profile?.hireDate) - overflow);
}

export function remainingLeaveDays(profile, requests, key = "annual", onDate, company, employee) {
  if (key === "grant") return leftoverGrantDays(profile, requests, onDate, company, employee);
  if (key === "annual") {
    const split = annualBalanceSplit(profile, requests, onDate, company, employee);
    if (split.currentTotal == null && split.carryTotal === 0) return null;
    return split.remaining;
  }
  const total = getLeaveTotal(profile, key, onDate);
  if (total == null) return null;
  return Math.max(0, total - usedLeaveDays(requests, key, onDate, profile?.hireDate));
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Hire-anniversary windows from the first year through the one holding onDate. */
function anniversaryWindowsThrough(hire, day) {
  const cur = anniversaryYearWindow(hire, day);
  if (!cur) return [];
  const out = [];
  let w = anniversaryYearWindow(hire, hire);
  let guard = 0;
  while (w && w.start <= cur.start && guard < 80) {
    out.push(w);
    w = anniversaryYearWindow(hire, addCalendarDays(w.end, 1));
    guard += 1;
  }
  return out.length ? out : [cur];
}

/** Agreed carry (Art. 110(1), «leave_carry» approvals) per bucket index — attributed to the year it was agreed in. */
function agreedCarryByBucket(profile, windows) {
  const out = {};
  for (const row of profile?.leaveCarryAgreed || []) {
    const at = dateOnly(row?.fromYearStart) || dateOnly(row?.at);
    const days = Math.max(0, Number(row?.days) || 0);
    if (!at || !days) continue;
    const idx = windows.findIndex((w) => w.start <= at && at <= w.end);
    if (idx < 0) continue;
    out[idx] = (out[idx] || 0) + days;
  }
  return out;
}

/**
 * A migrated employee's annual-leave opening balance: `profile.leaveOpeningBalance = { asOf, days }` —
 * the unused days on file at `asOf` (every year up to that day, accrual included). Null when absent.
 */
export function leaveOpeningBalanceOf(profile) {
  const row = profile?.leaveOpeningBalance;
  const asOf = dateOnly(row?.asOf);
  const days = Number(row?.days);
  if (!asOf || !Number.isFinite(days) || days < 0) return null;
  return { asOf, days };
}

/**
 * Arts. 109–111: one leave bucket per hire-anniversary year. Days are consumed FIFO — the oldest year
 * first — so days carried from an older year are never lost by spending in a later one. Returns
 * [{ year, start, end, entitled, used, left, status, agreed, unagreed, deadline, warnFrom, warn }].
 *  - entitled: the year's statutory/contract days, pro-rated for suspended contract days (Art. 116,
 *    Regs Art. 25(1)); with opts.until (exit), the current year is pro-rated to that day (Art. 111).
 *  - status: "current"; "carried" (the year after, Art. 110 — deadline = end of that following year);
 *    "overdue" (past the Art. 110 limit — still owed: Art. 109 forbids waiving it, Art. 111 pays it at exit).
 *  - agreed/unagreed: carried days covered / not covered by an approved Art. 110(1) carry.
 */
export function annualBalanceBuckets(profile, requests, onDate, company, employee, opts = {}) {
  const hire = dateOnly(profile?.hireDate);
  if (!hire) return [];
  const day = dateOnly(onDate) || todayRiyadh();
  const until = dateOnly(opts.until);
  const list = Array.isArray(requests) ? requests : [];
  const windows = anniversaryWindowsThrough(hire, until || day);
  if (!windows.length) return [];
  const susp = unpaidSuspensionPlan(list, hire).days;
  const curIdx = windows.length - 1;
  // A migrated file's opening balance replaces every year up to its day; leave taken on or before it
  // is already inside that figure.
  const opening = leaveOpeningBalanceOf(profile);
  const buckets = windows.map((win, i) => {
    const full = getLeaveTotal(profile, "annual", win.end, list) ?? 0;
    const len = inclusiveDays(win.start, win.end) || 365;
    const lastDay = i === curIdx && until ? (until < win.end ? until : win.end) : win.end;
    const counted = until && i === curIdx ? (lastDay < win.start ? 0 : inclusiveDays(win.start, lastDay)) : len;
    const suspended = susp.filter((d) => d >= win.start && d <= lastDay).length;
    let entitled = round2(full * Math.max(0, counted - suspended) / len);
    if (opening && win.end < opening.asOf) entitled = 0;
    else if (opening && win.start <= opening.asOf) {
      // The year holding the opening day: its balance on file, plus accrual after that day only.
      const from = addCalendarDays(opening.asOf, 1);
      const after = lastDay < from ? 0 : inclusiveDays(from, lastDay);
      const suspAfter = susp.filter((d) => d >= from && d <= lastDay).length;
      entitled = round2(opening.days + full * Math.max(0, after - suspAfter) / len);
    }
    return { year: Number(win.start.slice(0, 4)), start: win.start, end: win.end, full, entitled, suspendedDays: suspended, used: 0, usedInCurrent: 0, over: 0, left: entitled };
  });
  const emp = employee || (profile ? { profile } : null);
  const charged = list.filter((r) => (String(r?.type || "").toLowerCase() === "annual" && r.status === "approved") || examLeaveChargesAnnual(r));
  const chunks = [];
  for (const r of charged) {
    let start = dateOnly(r.startDate);
    let end = dateOnly(r.endDate) || (start ? addCalendarDays(start, Math.max(1, Number(r.days) || 1) - 1) : "");
    if (!start || !end) {
      chunks.push({ start: windows[curIdx].start, idx: curIdx, days: Number(r.days) || 0 });
      continue;
    }
    if (until && end > until) end = until;
    if (opening && end <= opening.asOf) continue;
    if (opening && start <= opening.asOf) start = addCalendarDays(opening.asOf, 1);
    windows.forEach((win, idx) => {
      const span = overlapRange(start, end, win.start, win.end);
      if (!span) return;
      chunks.push({ start: span.start, idx, days: chargeableAnnualDays(span.start, span.end, undefined, company, emp) });
    });
  }
  chunks.sort((a, b) => a.start.localeCompare(b.start));
  for (const c of chunks) {
    let need = Math.max(0, Number(c.days) || 0);
    for (let i = 0; i <= c.idx && need > 0; i += 1) {
      const b = buckets[i];
      const take = Math.min(b.left, need);
      if (take <= 0) continue;
      b.left = round2(b.left - take);
      b.used = round2(b.used + take);
      if (c.idx === curIdx) b.usedInCurrent = round2(b.usedInCurrent + take);
      need = round2(need - take);
    }
    if (need > 0) {
      const b = buckets[c.idx];
      b.used = round2(b.used + need);
      b.over = round2(b.over + need);
      if (c.idx === curIdx) b.usedInCurrent = round2(b.usedInCurrent + need);
    }
  }
  const agreed = agreedCarryByBucket(profile, windows);
  const warnDays = 60;
  buckets.forEach((b, i) => {
    if (i === curIdx) {
      b.status = "current";
      b.deadline = "";
    } else {
      b.status = i === curIdx - 1 ? "carried" : "overdue";
      b.deadline = buckets[i + 1].end;
    }
    b.agreed = i === curIdx ? 0 : Math.min(b.left, agreed[i] || 0);
    b.unagreed = i === curIdx ? 0 : round2(Math.max(0, b.left - b.agreed));
    b.warnFrom = b.deadline ? addCalendarDays(b.deadline, -warnDays) : "";
    b.warn = b.status === "carried" && b.left > 0 && !!b.warnFrom && day >= b.warnFrom;
  });
  return buckets;
}

/** Unused days carried into the current year from every older year — Art. 110 carry line. */
export function unusedFromPreviousYear(profile, requests, onDate, company, employee) {
  const buckets = annualBalanceBuckets(profile, requests, onDate, company, employee);
  return round2(buckets.slice(0, -1).reduce((n, b) => n + b.left + (b.usedInCurrent || 0), 0));
}

/** Current-year statutory line plus a separate carry line (all older years); carry is consumed first (FIFO). */
export function annualBalanceSplit(profile, requests, onDate, company, employee) {
  const buckets = annualBalanceBuckets(profile, requests, onDate, company, employee);
  if (!buckets.length) {
    const currentTotal = getLeaveTotal(profile, "annual", onDate, requests);
    const used = usedLeaveDays(requests, "annual", onDate, profile?.hireDate, undefined, company, employee || (profile ? { profile } : null));
    const currentLeft = currentTotal == null ? 0 : Math.max(0, currentTotal - used);
    return { currentTotal, currentUsed: used, currentLeft, carryTotal: 0, carryUsed: 0, carryLeft: 0, remaining: currentLeft, buckets: [] };
  }
  const cur = buckets[buckets.length - 1];
  const older = buckets.slice(0, -1);
  const carryUsed = round2(older.reduce((n, b) => n + (b.usedInCurrent || 0), 0));
  const carryLeft = round2(older.reduce((n, b) => n + b.left, 0));
  const carryTotal = round2(carryUsed + carryLeft);
  return {
    currentTotal: cur.entitled,
    currentUsed: cur.used,
    currentLeft: cur.left,
    carryTotal,
    carryUsed,
    carryLeft,
    remaining: round2(cur.left + carryLeft),
    buckets,
  };
}

/**
 * Art. 111: at exit the worker is paid for the leave days of every year he did not take, plus the
 * pro-rata of the incomplete year. FIFO buckets up to the exit day; days taken after it do not count.
 */
export function unusedAnnualDaysAtExit(profile, requests, exitDate, company, employee) {
  const exit = dateOnly(exitDate) || todayRiyadh();
  const buckets = annualBalanceBuckets(profile, requests, exit, company, employee, { until: exit });
  if (!buckets.length) return 0;
  const entitled = buckets.reduce((n, b) => n + b.entitled, 0);
  const used = buckets.reduce((n, b) => n + b.used, 0);
  return round2(Math.max(0, entitled - used));
}

/**
 * Art. 110 carry alerts. Days are never silently dropped: Art. 109(2) forbids waiving them and Art. 111
 * pays them at exit; the employer must let the worker take them. So:
 *  - "unagreed": carried days with no approved Art. 110(1) carry → «مؤجلة دون موافقة» to the manager.
 *  - "expiring": 60 days before the end of the following year (the Art. 110(2) limit) → «تنتهي في».
 *  - "overdue": past that limit → still owed; the manager must schedule them.
 */
export function annualCarryAlerts(profile, requests, onDate, company, employee) {
  const out = [];
  for (const b of annualBalanceBuckets(profile, requests, onDate, company, employee)) {
    if (b.status === "current" || b.left <= 0) continue;
    const yearAr = `${b.start} → ${b.end}`;
    if (b.status === "overdue") {
      out.push({
        kind: "overdue", start: b.start, days: b.left, deadline: b.deadline,
        ar: `${b.left} يوماً من سنة ${yearAr} تجاوزت مهلة التأجيل (${b.deadline}) — ما زالت مستحقة ولا يجوز النزول عنها (المادة 109)، وتُدفع عند انتهاء الخدمة إن لم تُستعمل (المادة 111). جدولها الآن.`,
        en: `${b.left} days from ${yearAr} passed the deferral limit (${b.deadline}) — still owed and not waivable (Art. 109), paid at exit if unused (Art. 111). Schedule them now.`,
      });
      continue;
    }
    if (b.warn) {
      out.push({
        kind: "expiring", start: b.start, days: b.left, deadline: b.deadline,
        ar: `تنتهي في ${b.deadline} مهلة تأجيل ${b.left} يوماً من سنة ${yearAr} (المادة 110) — اطلبها قبلها. لا تسقط بمرور المهلة، لكن على المنشأة جدولتها.`,
        en: `The deferral of ${b.left} days from ${yearAr} ends on ${b.deadline} (Art. 110) — request them before then. They do not lapse, but must be scheduled.`,
      });
    }
    if (b.unagreed > 0) {
      out.push({
        kind: "unagreed", start: b.start, days: b.unagreed, deadline: b.deadline,
        ar: `${b.unagreed} يوماً من سنة ${yearAr} مؤجلة دون موافقة على الترحيل (المادة 110/1) — جدولها مع العامل قبل ${b.deadline}.`,
        en: `${b.unagreed} days from ${yearAr} are carried without an agreed carry (Art. 110(1)) — schedule them with the worker before ${b.deadline}.`,
      });
    }
  }
  return out;
}

/** Model Regs Art. 33: the part of this year's annual leave earned so far — the cap for an advance. */
export function annualAdvanceCap(profile, requests, onDate, company, employee) {
  const day = dateOnly(onDate) || todayRiyadh();
  const buckets = annualBalanceBuckets(profile, requests, day, company, employee);
  const cur = buckets[buckets.length - 1];
  if (!cur) return { earned: 0, used: 0, cap: 0 };
  const len = inclusiveDays(cur.start, cur.end) || 365;
  const elapsed = day < cur.start ? 0 : inclusiveDays(cur.start, day < cur.end ? day : cur.end);
  const earned = Math.floor(cur.entitled * (elapsed / len) * 10) / 10;
  return { earned, used: cur.used, cap: round2(Math.max(0, earned - cur.used)) };
}

/** Art. 154 + Regs Art. 31(1): after return from maternity, for 24 months from the date of birth. */
function nursingMonthsUntil(birth, months) {
  if (!birth) return "";
  const [y, m, d] = birth.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last) - 1 || 0);
  return target.toISOString().slice(0, 10);
}

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
  // Birth date on the maternity leave; without it, the latest birth the six post-birth weeks allow.
  const birth = dateOnly(last.eventDate) || dateOnly(profile.childBirthDate) || addCalendarDays(dateOnly(last.endDate), -41);
  const until = dateOnly(profile.nursingUntil) || nursingMonthsUntil(birth, 24);
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

/**
 * Approved طلباتي leave, or an Art. 112 official holiday.
 * Holiday lock does not require a request. Empty when neither applies.
 */
export function isStatutoryOffDay(employee, date = new Date(), calendar) {
  if (isOnApprovedLeave(employee, date)) {
    return { kind: "approved", id: "", labelAr: "", labelEn: "" };
  }
  const hit = officialHolidayOn(leaveDayKey(date), calendar);
  if (!hit) return null;
  return {
    kind: "official",
    id: hit.id,
    labelAr: officialHolidayLeaveLabel(hit.id, true, calendar),
    labelEn: officialHolidayLeaveLabel(hit.id, false, calendar),
  };
}