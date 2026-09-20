/** Manager-raised overtime assignment — pay vs annual-leave credit, المادة 106 lock. */

import { isRealSupportingFile } from "./leaveDerivations.js";
import { addLaborDays, citeRule, laborDaysBetween, laborDayKey, ruleValue } from "./laborRules.js";
import { incrementAnnualLeaveTotal } from "./otherRequestDerivations.js";

export const OT_TYPE = "overtime";
export const OT_COMP_PAY = "pay";
export const OT_COMP_CREDIT = "credit";

export const OT_STATUS = {
  pending_employee: "pending_employee",
  pending_manager: "pending_manager",
  approved: "approved",
  rejected: "rejected",
  refused_by_employee: "refused_by_employee",
};

export const ARTICLE_106_GROUNDS = [
  {
    key: "danger",
    ar: "أخطار أو حوادث استثنائية تهدد سلامة المنشأة أو العاملين",
    en: "Dangers or exceptional accidents that threaten the safety of the establishment or its workers",
    article: "106",
    capDays: null,
  },
  {
    key: "damage",
    ar: "أعمال طارئة لمنع تلف المواد أو البضائع",
    en: "Urgent work to prevent damage to materials or goods",
    article: "106",
    capDays: null,
  },
  {
    key: "pressure_inventory",
    ar: "ضغط عمل غير عادي أو جرد سنوي / ميزانيات — تكليف إجباري لا يزيد على 30 يوماً في السنة",
    en: "Unusual work pressure, or annual inventory / budgets — mandatory assignment of no more than 30 days in the year",
    article: "106",
    capDays: 30,
    capRuleId: "hours.ot.art106.inventoryMaxDays",
  },
];

export function article106GroundMeta(key) {
  return ARTICLE_106_GROUNDS.find((row) => row.key === key) || null;
}

export function isOvertimeAssignment(request) {
  return request?.type === OT_TYPE && (request.assignment === true || request.source === "assignment");
}

export function isArticle106Assignment(request) {
  return isOvertimeAssignment(request) && request?.article106 === true && !!article106GroundMeta(request.article106Ground);
}

export function otCompensationOf(request) {
  const raw = request?.compensation || request?.compensationChoice;
  if (raw === OT_COMP_PAY || raw === OT_COMP_CREDIT) return raw;
  return "";
}

export function parseOtHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export function otAssignmentDays(request) {
  const from = laborDayKey(request?.date || request?.dateFrom);
  const toRaw = request?.dateTo || request?.date;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(toRaw || "").slice(0, 10)) ? laborDayKey(toRaw) : from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return 1;
  if (to < from) return 1;
  return Math.max(1, laborDaysBetween(from, to) + 1);
}

/** Compensatory leave days: OT hours × 1.5 leave-hours / ordinary day hours (8). */
export function otCreditDays(hours, onDate) {
  const ot = parseOtHours(hours);
  if (ot == null) return 0;
  const perHour = ruleValue("hours.ot.compLeave.minHoursPerOtHour", onDate);
  const dayHours = ruleValue("hours.shift.ordinaryHours", onDate);
  return Math.round(((ot * perHour) / dayHours) * 1000) / 1000;
}

export function otCreditDaysOf(request) {
  if (request?.creditDays != null && Number.isFinite(Number(request.creditDays))) {
    return Math.round(Number(request.creditDays) * 1000) / 1000;
  }
  return otCreditDays(request?.hours, request?.date);
}

export function article106CapDays(onDate) {
  return ruleValue("hours.ot.art106.inventoryMaxDays", onDate);
}

export function article106YearOf(request) {
  const day = String(request?.date || "").slice(0, 4);
  return /^\d{4}$/.test(day) ? day : "";
}

const COUNTED_106_STATUSES = new Set([
  OT_STATUS.pending_employee,
  OT_STATUS.pending_manager,
  OT_STATUS.approved,
]);

export function countsTowardArticle106Year(request) {
  if (!isArticle106Assignment(request)) return false;
  if (article106GroundMeta(request.article106Ground)?.capDays == null) return false;
  const status = request.status || OT_STATUS.pending_employee;
  return COUNTED_106_STATUSES.has(status);
}

export function article106MandatoryDaysInYear(otherRequests = [], year, exceptId) {
  const y = String(year || "");
  return (otherRequests || []).reduce((sum, row) => {
    if (exceptId && row?.id === exceptId) return sum;
    if (!countsTowardArticle106Year(row)) return sum;
    if (article106YearOf(row) !== y) return sum;
    return sum + otAssignmentDays(row);
  }, 0);
}

const COUNTED_OT_STATUSES = new Set([
  OT_STATUS.pending_employee,
  OT_STATUS.pending_manager,
  OT_STATUS.approved,
]);

export function otYearOf(request) {
  const day = String(request?.date || "").slice(0, 4);
  return /^\d{4}$/.test(day) ? day : "";
}

export function countsTowardOtAnnualHours(request) {
  if (!isOvertimeAssignment(request)) return false;
  return COUNTED_OT_STATUSES.has(request.status || OT_STATUS.pending_employee);
}

export function countsTowardCompLeaveYear(request) {
  if (!countsTowardOtAnnualHours(request)) return false;
  return otCompensationOf(request) === OT_COMP_CREDIT;
}

export function otHoursInYear(otherRequests = [], year, exceptId) {
  const y = String(year || "");
  return (otherRequests || []).reduce((sum, row) => {
    if (exceptId && row?.id === exceptId) return sum;
    if (!countsTowardOtAnnualHours(row)) return sum;
    if (otYearOf(row) !== y) return sum;
    return sum + (parseOtHours(row.hours) || 0);
  }, 0);
}

export function compLeaveDaysInYear(otherRequests = [], year, exceptId) {
  const y = String(year || "");
  return Math.round((otherRequests || []).reduce((sum, row) => {
    if (exceptId && row?.id === exceptId) return sum;
    if (!countsTowardCompLeaveYear(row)) return sum;
    if (otYearOf(row) !== y) return sum;
    return sum + otCreditDaysOf(row);
  }, 0) * 1000) / 1000;
}

export function defaultCompLeaveEnjoyDate(onDate) {
  const day = laborDayKey(onDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  return addLaborDays(day, ruleValue("hours.ot.compLeave.windowDays", day) - 1);
}

export function checkOtAnnualCapGate(input = {}) {
  const onDate = input.date || input.onDate;
  const hours = parseOtHours(input.hours) ?? (Math.max(0, Number(input.overtimeMinutes) || 0) / 60);
  if (!hours) return { ok: true, used: 0, add: 0, cap: ruleValue("hours.ot.annualMaxHours", onDate) };
  const year = otYearOf(input) || String(onDate || "").slice(0, 4);
  const fromRequests = otHoursInYear(input.otherRequests, year, input.exceptId);
  const used = Math.max(0, Number(input.overtimeHoursYtd) || 0, fromRequests);
  const cap = ruleValue("hours.ot.annualMaxHours", onDate);
  const next = used + hours;
  if (next > cap && input.annualCapConsent !== true) {
    return {
      ok: false,
      error: "OT_ANNUAL_CAP",
      reason: `موقوف — اللائحة مادة 22: ساعات الإضافي لا تزيد على ${cap} ساعة في السنة إلا بموافقة العامل. المستخدم ${used} والطلب ${hours}.`,
      reasonEn: `Blocked — implementing regulations Art. 22: overtime may not exceed ${cap} hours in the year unless the worker consents. Used ${used}; this request adds ${hours}.`,
      used,
      add: hours,
      next,
      cap,
    };
  }
  return { ok: true, used, add: hours, next, cap };
}

export function checkCompLeaveWindowGate(input = {}) {
  if ((otCompensationOf(input) || input.compensation) !== OT_COMP_CREDIT && input.decision !== "comp_leave") {
    return { ok: true };
  }
  const onDate = laborDayKey(input.date || input.onDate);
  const windowDays = ruleValue("hours.ot.compLeave.windowDays", onDate);
  let enjoy = String(input.enjoyDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(enjoy) && /^\d{4}-\d{2}-\d{2}$/.test(onDate)) {
    enjoy = defaultCompLeaveEnjoyDate(onDate);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(onDate) || !/^\d{4}-\d{2}-\d{2}$/.test(enjoy)) {
    return { ok: true, enjoyDate: enjoy || "", windowDays };
  }
  const latest = defaultCompLeaveEnjoyDate(onDate);
  if (enjoy > latest && input.windowAgreed !== true) {
    return {
      ok: false,
      error: "COMP_LEAVE_WINDOW",
      reason: `موقوف — اللائحة مادة 22 مكرر: يُحدَّد موعد التمتع بالإجازة التعويضية خلال ${windowDays} يوماً من الإضافي ما لم يُتفق على خلاف ذلك.`,
      reasonEn: `Blocked — implementing regulations Art. 22 bis: the date for taking compensatory leave is set within ${windowDays} days of the overtime unless otherwise agreed.`,
      enjoyDate: enjoy,
      latest,
      windowDays,
    };
  }
  return { ok: true, enjoyDate: enjoy, latest, windowDays };
}

export function checkCompLeaveYearCapGate(input = {}) {
  if ((otCompensationOf(input) || input.compensation) !== OT_COMP_CREDIT && input.decision !== "comp_leave") {
    return { ok: true };
  }
  const onDate = input.date || input.onDate;
  const cap = ruleValue("hours.ot.compLeave.maxDaysPerYear", onDate);
  const year = otYearOf(input) || String(onDate || "").slice(0, 4);
  const fromRequests = compLeaveDaysInYear(input.otherRequests, year, input.exceptId);
  const used = Math.max(0, Number(input.creditDaysYtd) || 0, fromRequests);
  const add = otCreditDays(input.hours ?? ((Number(input.overtimeMinutes) || 0) / 60), onDate);
  const next = used + add;
  if (next > cap) {
    return {
      ok: false,
      error: "COMP_LEAVE_YEAR_CAP",
      reason: `موقوف — اللائحة مادة 22 مكرر: الإجازة التعويضية لا تزيد على ${cap} يوماً في السنة. المستخدم ${used} والطلب ${add}.`,
      reasonEn: `Blocked — implementing regulations Art. 22 bis: compensatory leave may not exceed ${cap} days in the year. Used ${used}; this request adds ${add}.`,
      used,
      add,
      next,
      cap,
    };
  }
  return { ok: true, used, add, next, cap };
}

export function checkArticle106YearCapGate(input) {
  const ground = article106GroundMeta(input?.article106Ground);
  if (!ground || ground.capDays == null) return { ok: true, used: 0, next: 0, cap: 0 };
  const onDate = input?.date;
  const cap = article106CapDays(onDate);
  const year = article106YearOf(input) || String(onDate || "").slice(0, 4);
  const used = article106MandatoryDaysInYear(input?.otherRequests, year, input?.exceptId);
  const add = otAssignmentDays(input);
  const next = used + add;
  if (next > cap) {
    const cite = citeRule("hours.ot.art106.inventoryMaxDays", onDate);
    return {
      ok: false,
      error: "ARTICLE_106_YEAR_CAP",
      reason: `موقوف — المادة 106: التكليف الإجباري للجرد أو ضغط العمل لا يزيد على ${cap} يوماً في السنة. المستخدم ${used} والطلب ${add}.`,
      reasonEn: `Blocked — Article 106: mandatory inventory or pressure assignments may not exceed ${cap} days in the year. Used ${used}; this request adds ${add}.`,
      used,
      add,
      next,
      cap,
      cite,
    };
  }
  return { ok: true, used, add, next, cap };
}

function checkOtHoursGate(input) {
  const hours = parseOtHours(input?.hours);
  if (hours == null) {
    return {
      ok: false,
      error: "HOURS_REQUIRED",
      reason: "حدد ساعات التكليف الإضافي.",
      reasonEn: "Set the overtime assignment hours.",
    };
  }
  return { ok: true, hours };
}

function checkOtDateGate(input) {
  const date = String(input?.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "DATE_REQUIRED", reason: "حدد تاريخ التكليف.", reasonEn: "Set the assignment date." };
  }
  const dateTo = String(input?.dateTo || "").slice(0, 10);
  if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return { ok: false, error: "DATE_REQUIRED", reason: "حدد نهاية نافذة التكليف.", reasonEn: "Set the assignment window end." };
  }
  if (dateTo && dateTo < date) {
    return {
      ok: false,
      error: "DATE_REQUIRED",
      reason: "نهاية النافذة لا تكون قبل تاريخ التكليف.",
      reasonEn: "The window cannot end before the assignment date.",
    };
  }
  return { ok: true, date, dateTo: dateTo && dateTo >= date ? dateTo : undefined };
}

function firstRealFile(files) {
  const list = Array.isArray(files) ? files : (files ? [files] : []);
  return list.find(isRealSupportingFile) || null;
}

export function checkArticle106RaiseGate(input) {
  if (!input?.article106) return { ok: true };
  const ground = article106GroundMeta(input.article106Ground);
  if (!ground) {
    return {
      ok: false,
      error: "GROUND_REQUIRED",
      reason: "المادة 106: اختر أحد الأسباب الثلاثة للتكليف الإجباري.",
      reasonEn: "Article 106: pick one of the three grounds for a mandatory assignment.",
    };
  }
  const file = firstRealFile(input.files) || (isRealSupportingFile(input.file) ? input.file : null);
  if (!file) {
    return {
      ok: false,
      error: "FILE_REQUIRED",
      reason: "المادة 106: أرفق ملف الواقعة — ورقة حقيقية، بلا توقيع مزيف.",
      reasonEn: "Article 106: attach the incident file — a real paper, no fake signature.",
    };
  }
  if (input.manager106Ack !== true) {
    return {
      ok: false,
      error: "MANAGER_106_ACK_REQUIRED",
      reason: "المادة 106: أقرّ بأن واقعة استثنائية قائمة وفق السبب المختار.",
      reasonEn: "Article 106: acknowledge that an exceptional situation exists under the chosen ground.",
    };
  }
  const cap = checkArticle106YearCapGate(input);
  if (!cap.ok) return cap;
  return { ok: true, ground, file, cap };
}

export function checkRaiseOtAssignmentGate(input) {
  const reason = String(input?.reason || "").trim();
  if (reason.length < 3) {
    return { ok: false, error: "REASON_REQUIRED", reason: "اكتب سبب التكليف.", reasonEn: "Write why this assignment is needed." };
  }
  const hoursGate = checkOtHoursGate(input);
  if (!hoursGate.ok) return hoursGate;
  const dateGate = checkOtDateGate(input);
  if (!dateGate.ok) return dateGate;
  const art106 = checkArticle106RaiseGate(input);
  if (!art106.ok) return art106;
  const cap = checkOtAnnualCapGate({ ...input, hours: hoursGate.hours, date: dateGate.date });
  if (!cap.ok) return cap;
  return {
    ok: true,
    hours: hoursGate.hours,
    date: dateGate.date,
    dateTo: dateGate.dateTo,
    reason,
    article106: !!input?.article106,
    article106Ground: input?.article106 ? input.article106Ground : undefined,
    creditDays: otCreditDays(hoursGate.hours, dateGate.date),
    assignmentDays: otAssignmentDays({ date: dateGate.date, dateTo: dateGate.dateTo }),
    file: art106.file || null,
    otCap: cap,
  };
}

export function checkRefuseOtAssignmentGate(request) {
  if (isArticle106Assignment(request)) {
    const ground = article106GroundMeta(request.article106Ground);
    return {
      ok: false,
      error: "ARTICLE_106_MANDATORY",
      reason: `موقوف — المادة 106: التكليف إجباري (${ground?.ar || "حالة استثنائية"}) ولا يُرفض.`,
      reasonEn: `Blocked — Article 106: the assignment is mandatory (${ground?.en || "an exceptional case"}) and cannot be refused.`,
      cite: citeRule("hours.ot.art106.inventoryMaxDays", request?.date) || citeRule("hours.ot.exceptionDayHours", request?.date),
    };
  }
  return { ok: true };
}

export function checkEmployeeAcceptOtGate(input) {
  const compensation = otCompensationOf(input) || input?.compensation;
  if (compensation !== OT_COMP_PAY && compensation !== OT_COMP_CREDIT) {
    return {
      ok: false,
      error: "COMPENSATION_REQUIRED",
      reason: "اختر أجر إضافي أو رصيد إجازة.",
      reasonEn: "Choose overtime pay or leave-balance credit.",
    };
  }
  if (input?.ack !== true) {
    return {
      ok: false,
      error: "EMPLOYEE_ACK_REQUIRED",
      reason: "أقرّ باختيارك لتعويض الساعات الإضافية.",
      reasonEn: "Acknowledge your overtime compensation choice.",
    };
  }
  const cap = checkOtAnnualCapGate(input);
  if (!cap.ok) return cap;
  const window = checkCompLeaveWindowGate({ ...input, compensation });
  if (!window.ok) return window;
  const year = checkCompLeaveYearCapGate({ ...input, compensation });
  if (!year.ok) return year;
  return {
    ok: true,
    compensation,
    creditDays: otCreditDaysOf({ ...input, compensation }),
    enjoyDate: window.enjoyDate,
    otCap: cap,
  };
}

export function checkManagerRejectOtGate(request, status) {
  const next = String(status || "");
  if (next === "rejected" && isArticle106Assignment(request)) {
    return {
      ok: false,
      error: "ARTICLE_106_MANDATORY",
      reason: "موقوف — المادة 106: العمل الإضافي الإجباري لا يُلغى من هنا. يجوز رد اختيار التعويض فقط.",
      reasonEn: "Blocked — Article 106: mandatory overtime work is not cancelled here. You may only return the compensation choice.",
    };
  }
  return { ok: true };
}

export function checkApproveOtAssignmentGate(request) {
  if (!isOvertimeAssignment(request)) return { ok: true };
  const status = request?.status || "";
  if (status === OT_STATUS.pending_employee || !otCompensationOf(request)) {
    return {
      ok: false,
      error: "EMPLOYEE_CHOICE_REQUIRED",
      reason: "بانتظار اختيار الموظف لأجر إضافي أو رصيد، مع إقراره.",
      reasonEn: "The worker must first choose overtime pay or leave credit and acknowledge it.",
    };
  }
  if (request.employeeAck !== true) {
    return {
      ok: false,
      error: "EMPLOYEE_ACK_REQUIRED",
      reason: "لا اعتماد قبل إقرار الموظف باختيار التعويض.",
      reasonEn: "Approval waits until the worker acknowledges the compensation choice.",
    };
  }
  if (status !== OT_STATUS.pending_manager && status !== "pending") {
    return {
      ok: false,
      error: "NOT_AWAITING_MANAGER",
      reason: "هذا التكليف ليس بانتظار قرار المسؤول.",
      reasonEn: "This assignment is not awaiting the manager's decision.",
    };
  }
  const cap = checkOtAnnualCapGate(request);
  if (!cap.ok) return cap;
  const window = checkCompLeaveWindowGate(request);
  if (!window.ok) return window;
  const year = checkCompLeaveYearCapGate(request);
  if (!year.ok) return year;
  return {
    ok: true,
    compensation: otCompensationOf(request),
    creditDays: otCreditDaysOf(request),
    enjoyDate: window.enjoyDate,
    otCap: cap,
  };
}

export function stampOvertimeCreditOnEmployee(employee, request) {
  if (!employee || !isOvertimeAssignment(request)) return { ok: true, skipped: true };
  if (otCompensationOf(request) !== OT_COMP_CREDIT) return { ok: true, skipped: true };
  if (request.balanceApplied) return { ok: true, skipped: true };
  const days = otCreditDaysOf(request);
  const applied = incrementAnnualLeaveTotal(employee.profile, days, request.date);
  if (!applied.ok) return applied;
  employee.profile = applied.profile;
  request.balanceApplied = true;
  request.appliedDays = applied.days;
  request.annualTotalAfter = applied.nextTotal;
  request.creditDays = days;
  return { ok: true, days: applied.days, nextTotal: applied.nextTotal };
}

export function stampOvertimePayOnDraft(draft, employeeId, request, by) {
  if (!draft || !isOvertimeAssignment(request)) return { ok: true, skipped: true };
  if (otCompensationOf(request) !== OT_COMP_PAY) return { ok: true, skipped: true };
  if (request.payrollMarked) return { ok: true, skipped: true };
  const hours = parseOtHours(request.hours) || 0;
  const day = String(request.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || hours <= 0) {
    return { ok: false, error: "DATE_REQUIRED", reason: "حدد يوم الإضافي.", reasonEn: "Set the overtime day." };
  }
  draft.otDecisions = draft.otDecisions || {};
  const key = `${employeeId}:${day}`;
  const existing = draft.otDecisions[key];
  if (!existing || existing.source === "ot_assignment") {
    draft.otDecisions[key] = {
      decision: "approve",
      overtimeMinutes: Math.round(hours * 60),
      at: new Date().toISOString(),
      by: by || request.reviewedBy || "",
      source: "ot_assignment",
      requestId: request.id,
    };
  }
  request.payrollMarked = true;
  request.payrollHours = hours;
  return { ok: true, hours };
}

export function isApprovedPayOtAssignment(request) {
  return isOvertimeAssignment(request)
    && request?.status === OT_STATUS.approved
    && otCompensationOf(request) === OT_COMP_PAY;
}

export function assignmentFileName(request) {
  const file = firstRealFile(request?.files) || (isRealSupportingFile(request?.file) ? request.file : null);
  return file?.name || "";
}

export function otAssignmentTitle(request, ar = true) {
  const hours = parseOtHours(request?.hours);
  const hoursBit = hours != null ? (ar ? ` · ${hours} ساعة` : ` · ${hours} h`) : "";
  if (isArticle106Assignment(request)) {
    return ar ? `تكليف إضافي إجباري${hoursBit}` : `Mandatory overtime${hoursBit}`;
  }
  return ar ? `تكليف ساعات إضافية${hoursBit}` : `Overtime assignment${hoursBit}`;
}
