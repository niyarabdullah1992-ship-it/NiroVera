/** Catalog and derived figures for the unified My Requests workspace. */

import { decision18632RightsNote } from "./decision18632.js";
import { articleOfficialText } from "./laborArticleTexts.js";
import { profileGender } from "./employeeProfileFields.js";
import { explainRule, isRamadanHoursSubject, ruleValue } from "./laborRules.js";
import { statutoryArticleLabel, statutoryDecisionLabel } from "./statutoryItem.js";
import {
  annualBalanceSplit,
  getLeaveTotal,
  grantDaysOf,
  leftoverGrantDays,
  leaveTypeLabel,
  leaveTypesForProfile,
  remainingLeaveDays,
  serviceYearsFromHire,
  statutoryLeaveFloor,
  usedLeaveDays,
} from "./leaveTypes.js";
import { officialHolidayList } from "./ummAlQuraCalendar.js";
import { approvedLeaveWithdrawWindow, computeLeaveDays, examSatState, hasExamSatProof, isRealSupportingFile, LEAVE_TYPES } from "./leaveDerivations.js";
import { nightRotateStage } from "./nightRotateCycle.js";
import { LEAVE_TOPUP_TYPE, NIGHT_FITNESS_LABEL_AR, NIGHT_FITNESS_LABEL_EN, NIGHT_FITNESS_PERMANENT_AR, NIGHT_FITNESS_TYPE, buildRequestAudit, buildRequestRefuseAudit, checkAdminLeaveCreditGate, checkRefuseRequestReasonGate, checkSubmitStudyConsentGate, collectRequestAuditLogs, collectRequestRefuseLogs, DISCRETIONARY_GRANT_CAP as OTHER_DISCRETIONARY_GRANT_CAP, hasRequestRefuseAudit, isManagerDecideOtherRequest, LEAVE_CREDIT_POOLS, nightFitnessState, otherRequestTypeLabel, reconstructRequestAudit, requestAuditEventType, requestAuditFileLog, resolveStudyConsentFields, STUDY_CONSENT_FILE_REQUIRED_AR, STUDY_CONSENT_FILE_REQUIRED_EN, STUDY_CONSENT_LABEL_AR, STUDY_CONSENT_LABEL_EN, STUDY_CONSENT_TYPE, studyConsentState } from "./otherRequestDerivations.js";
import { nightMedicalReportOf } from "./decision18632.js";
import {
  assignmentFileName,
  isArticle106Assignment,
  isOvertimeAssignment,
  otAssignmentTitle,
  otCompensationOf,
} from "./overtimeAssignment.js";
import { consentTopicMeta, flattenWrittenConsents, hashConsentFile, readConsentFile } from "./writtenConsent.js";
import { peopleQueryMatches } from "./peopleTreeGraph.js";
import { formatNotificationText, isInventoryDeskNotice, isRequestWorkspaceNotice } from "./notificationKind.js";
import { formatDate } from "./dateFormat.js";
import { leaveApprovalBlessing } from "./leaveEntitlementCycle.js";
import { isViewerOwnFile, viewerEmployeeId } from "./employeeFileView.js";

export const SUPPORTING_FILE_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
export const SUPPORTING_FILE_MAX_BYTES = 10 * 1024 * 1024;

export function isAllowedSupportingFile(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  if (["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"].includes(type)) return true;
  return /\.(pdf|jpe?g|png|webp)$/i.test(String(file.name || ""));
}

export function supportingFileRecord({ name, size, type, url, hash } = {}) {
  const record = {
    name: String(name || "").trim(),
    size: Number(size) || 0,
    type: String(type || ""),
    url: String(url || ""),
  };
  if (hash) record.hash = String(hash);
  return record;
}

export async function readSupportingFile(file) {
  if (!file) return null;
  const [hash, url] = await Promise.all([hashConsentFile(file), readConsentFile(file)]);
  return supportingFileRecord({
    name: file.name,
    size: file.size,
    type: file.type,
    url,
    hash,
  });
}

export const DISCRETIONARY_GRANT_CAP = OTHER_DISCRETIONARY_GRANT_CAP;

export { checkAdminLeaveCreditGate, LEAVE_CREDIT_POOLS };

export const REQUEST_KINDS = [
  { id: "leave", ar: "إجازة", en: "Leave" },
  { id: "study_consent", ar: STUDY_CONSENT_LABEL_AR, en: STUDY_CONSENT_LABEL_EN, type: STUDY_CONSENT_TYPE },
  /** 18632 medical fitness — worker files from ملفي; الإدارة does not raise it. */
  { id: "night_fitness", ar: NIGHT_FITNESS_LABEL_AR, en: NIGHT_FITNESS_LABEL_EN, type: NIGHT_FITNESS_TYPE, employeeOnly: true },
  /** Worker requests from ملفي (Balance card); manager decides — not a manage raise. */
  { id: "leave_topup", ar: "رفع رصيد إجازة", en: "Leave balance top-up", type: LEAVE_TOPUP_TYPE },
  /** Admin credit from إدارة — no employee raise, no self-decide leave. */
  { id: "leave_credit", ar: "إضافة رصيد", en: "Add leave balance", manageOnly: true, manageFiled: true, credit: true },
  { id: "ot_assign", ar: "تكليف إضافي", en: "Overtime assignment", type: "overtime", assignment: true, manageOnly: true, manageFiled: true },
  { id: "manual", ar: "تسجيل حضور يدوي", en: "Manual punch", type: "manual_punch" },
  { id: "outfix", ar: "تصحيح انصراف", en: "Checkout correction", type: "checkout_fix" },
  { id: "doc", ar: "وثيقة أو شهادة", en: "Document or letter" },
  { id: "money", ar: "سلفة أو بدل", en: "Advance or allowance", type: "advance" },
  { id: "custody", ar: "عهدة", en: "Custody", type: "custody" },
  /** Manager may raise from إدارة as an establishment act; worker may also raise from ملفي. */
  { id: "other", ar: "طلب آخر", en: "Other request", type: "other_request", manageFiled: true },
];

/**
 * ملفي: worker self-types (no establishment-only OT assignment / admin credit).
 * إدارة: manager-initiated — تكليف إضافي + إضافة رصيد + طلب آخر.
 * Leave / study / docs / punches / worker top-up stay on ملفي; manager decides (اعتمد/ارفض).
 */
export function composeRequestKinds(lane = "mine") {
  if (lane === "manage") {
    return REQUEST_KINDS.filter((row) => row.id === "ot_assign" || row.id === "leave_credit" || row.id === "other");
  }
  return REQUEST_KINDS.filter((row) => !row.manageOnly);
}

/** True when إدارة may compose this kind as a manager-side raise (not ملفي masquerade). */
export function isManageRaiseKind(kindId) {
  return kindId === "ot_assign" || kindId === "leave_credit" || kindId === "other";
}

/** Checklist rows for the إدارة credit form. */
export function composeAdminLeaveCreditGates(input = {}, lang = "ar") {
  const ar = lang === "ar";
  const gate = checkAdminLeaveCreditGate(input);
  const pool = String(input.pool || "").trim();
  const days = Math.round(Number(input.days) || 0);
  const why = String(input.reason || "").trim();
  const used = grantDaysOf(input.profile);
  return uniqueNamedGates([
    {
      id: "ROLE_REQUIRED",
      ok: input.canCredit !== false,
      text: input.canCredit !== false
        ? (ar ? "تُسجَّل الإضافة باسم من يقرر على الطلبات." : "The credit is recorded in the deciding manager's name.")
        : (ar ? "إضافة الرصيد لمن يقرر على الطلبات فقط." : "Only managers who decide on requests may credit leave balance."),
    },
    {
      id: "POOL_REQUIRED",
      ok: pool === "annual" || pool === "grant",
      text: pool === "annual"
        ? (ar ? "يُزاد الرصيد السنوي (نفس حقل 21/30 يوماً)." : "The annual balance (the same 21/30-day field) increases.")
        : pool === "grant"
          ? (ar ? `أيام تقديرية فوق المستحق — سقف ${DISCRETIONARY_GRANT_CAP} في السنة.` : `Discretionary days above the statutory floor — cap ${DISCRETIONARY_GRANT_CAP} a year.`)
          : (ar ? "اختر الرصيد السنوي أو الأيام التقديرية." : "Pick the annual balance or discretionary days."),
    },
    {
      id: "DAYS_INVALID",
      ok: gate.ok || (gate.error !== "DAYS_INVALID" && days >= 1),
      text: gate.error === "DAYS_INVALID"
        ? (ar ? gate.reason : gate.reasonEn)
        : pool === "annual"
          ? (ar ? `يُضاف ${days || "—"} يوماً إلى الرصيد السنوي.` : `${days || "—"} days will be added to the annual balance.`)
          : (ar ? `تُمنح ${days || "—"} أيام تقديرية.` : `${days || "—"} discretionary days will be granted.`),
    },
    {
      id: "GRANT_CAP",
      ok: pool !== "grant" || gate.ok || gate.error !== "GRANT_CAP",
      text: pool !== "grant"
        ? (ar ? "سقف الأيام التقديرية لا يسري على الرصيد السنوي." : "The discretionary cap does not apply to the annual balance.")
        : gate.error === "GRANT_CAP"
          ? (ar ? gate.reason : gate.reasonEn)
          : (ar ? `الممنوح سابقاً ${used} · المتاح ${Math.max(0, DISCRETIONARY_GRANT_CAP - used)}.` : `Already granted ${used} · ${Math.max(0, DISCRETIONARY_GRANT_CAP - used)} left.`),
    },
    {
      id: "REASON_REQUIRED",
      ok: why.length >= 3,
      text: why.length >= 3
        ? (ar ? "السبب مكتوب — يظهر في سجل التدقيق." : "The reason is written — it appears on the audit trail.")
        : (ar ? "اكتب سبب إضافة الرصيد." : "Write why the balance is being credited."),
    },
    {
      id: "NO_EMPLOYEE_LEAVE",
      ok: true,
      text: ar
        ? "ليست إجازة باسم الموظف — لا موافقة ذاتية ولا خصم من الجدول."
        : "Not leave raised as the employee — no self-approval and no rota deduction.",
    },
  ]);
}

/** Leave, exam leave, and study_consent are decided only in طلباتي. */
export function isWorkspaceDeskDecision(row = {}) {
  if (String(row.family || "") === "leave") return true;
  const type = String(row.type || "");
  if (type === STUDY_CONSENT_TYPE) return true;
  return LEAVE_TYPES.some((item) => item.key === type);
}

/**
 * إدارة when a manager — or the sole head — writes اعتمد/ارفض.
 * ملفي when the worker follows the reply (اسحب / رأيت الاعتماد).
 */
export function requestReplyHref({ manage, mine, selfDecide } = {}) {
  if (selfDecide === true) return "/app/requests/manage";
  if (mine === true) return "/app/requests";
  if (manage === true) return "/app/requests/manage";
  if (manage === false) return "/app/requests";
  if (mine === false) return "/app/requests/manage";
  return "/app/requests";
}

export function requestReplyCopy(ar = true) {
  return ar ? "الرد في طلباتي" : "Reply in My Requests";
}

export function requestDecisionLivesInWorkspace(row) {
  return isWorkspaceDeskDecision(row);
}

export const DOC_KINDS = [
  { id: "salary", type: "salary_letter", salary: true, ar: "شهادة تعريف بالراتب", en: "Salary introduction", approverAr: "الموارد البشرية", approverEn: "HR" },
  { id: "job", type: "employment_letter", salary: false, ar: "تعريف بالمهنة", en: "Job introduction", approverAr: "الموارد البشرية", approverEn: "HR" },
  { id: "exp", type: "document", salary: false, ar: "شهادة خبرة أو خدمة", en: "Service certificate", approverAr: "الموارد البشرية", approverEn: "HR" },
  { id: "embassy", type: "document", salary: true, ar: "تعريف للسفارة أو التأشيرة", en: "Embassy or visa letter", approverAr: "الموارد البشرية", approverEn: "HR" },
  { id: "bank", type: "document", salary: true, ar: "مشهد راتب للبنك أو التمويل", en: "Bank or finance letter", approverAr: "الموارد البشرية + المالية", approverEn: "HR + finance" },
  { id: "clear", type: "document", salary: false, ar: "إخلاء طرف / نهاية خدمة", en: "Clearance / end of service", approverAr: "الموارد البشرية + المدير", approverEn: "HR + manager" },
  { id: "other", type: "document", salary: false, custom: true, ar: "وثيقة أخرى", en: "Other document", approverAr: "الموارد البشرية", approverEn: "HR" },
];

export function requestEmployeeStationId(employee) {
  return String(employee?.stationId || employee?.profile?.stationId || "").trim();
}

export function employeeStationName(employee, stations = []) {
  const id = requestEmployeeStationId(employee);
  if (employee?.stationName) return String(employee.stationName);
  return (stations || []).find((station) => String(station.id) === String(id))?.name || "";
}

export function stationDisplayName(name, ar = true) {
  const raw = String(name || "").trim();
  if (!raw) return ar ? "بلا فرع" : "No branch";
  if (ar && !/^(فرع|دائرة)\s+/i.test(raw)) return `فرع ${raw}`;
  return raw;
}

export function employeeBranchLine(stationName, ar = true) {
  const name = String(stationName || "").trim();
  if (!name) return ar ? "بلا فرع" : "No branch";
  const bare = name.replace(/^(فرع|station)\s+/i, "");
  return ar ? `من فرع ${bare}` : `from ${bare}`;
}

/** Card / row / notice identity — الشخص + الفرع. */
export function requestRegardingLine({ name, stationName, lang = "ar" } = {}) {
  const ar = lang === "ar";
  const who = String(name || "").trim();
  const station = stationDisplayName(stationName, ar);
  if (!who) return station;
  return ar ? `بشأن: ${who} · ${station}` : `Re: ${who} · ${station}`;
}

export function managerRequestNoticeText({ kindLabel, employeeName, stationName, lang = "ar" } = {}) {
  const ar = lang === "ar";
  const regarding = requestRegardingLine({ name: employeeName, stationName, lang });
  const label = String(kindLabel || "").trim();
  if (ar) {
    return label
      ? `طلب ${label} ${regarding} بانتظار مراجعتك.`
      : `طلب ${regarding} بانتظار مراجعتك.`;
  }
  return label
    ? `New ${label} request ${regarding} needs your review.`
    : `New request ${regarding} needs your review.`;
}

function pendingStationGroups(rows = [], stations = [], lang = "ar") {
  const ar = lang === "ar";
  const map = new Map();
  for (const row of rows || []) {
    const sid = requestEmployeeStationId(row.employee);
    const name = employeeStationName(row.employee, stations);
    if (!map.has(sid)) {
      map.set(sid, {
        stationId: sid,
        stationName: stationDisplayName(name, ar),
        count: 0,
        rows: [],
      });
    }
    const group = map.get(sid);
    group.rows.push(row);
    group.count += 1;
  }
  return [...map.values()].sort((a, b) => String(a.stationName).localeCompare(String(b.stationName), "ar"));
}

/** Compact «فروع أخرى» when the header is parked on one branch. Never hides the inbox. */
export function otherStationsPendingStrip({ employees = [], stations = [], focusStationId = "", lang = "ar" } = {}) {
  const ar = lang === "ar";
  const inbox = managerPendingInbox(employees, lang, { stations });
  const focus = String(focusStationId || "").trim();
  const parked = Boolean(focus && focus !== "all");
  const others = parked ? inbox.groups.filter((group) => group.stationId !== focus) : [];
  const otherCount = others.reduce((n, group) => n + group.count, 0);
  return {
    visible: parked && otherCount > 0,
    title: ar ? "فروع أخرى" : "Other branches",
    headline: ar
      ? `${countAr(others.length, "فرع واحد", "فرعان", "فروع", "فرعاً")} · ${countAr(otherCount, "طلب بانتظارك", "طلبان بانتظارك", "طلبات بانتظارك", "طلباً بانتظارك")}`
      : `${others.length === 1 ? "1 branch" : `${others.length} branches`} · ${otherCount} awaiting you`,
    stations: others,
    groups: inbox.groups,
    focusStationId: parked ? focus : "",
    totalPending: inbox.count,
  };
}

export function requestEmployeeSearchHay(employee, stations = []) {
  const profile = employee?.profile || {};
  return [
    employee?.name,
    employee?.nameEn,
    employee?.englishName,
    employee?.nickname,
    profile.nameEn,
    profile.englishName,
    profile.nickname,
    employee?.position,
    profile.position,
    profile.qiwaTitle,
    employeeStationName(employee, stations),
  ].filter(Boolean).join(" ");
}

export function requestPeopleStations(employees = [], stations = []) {
  const seen = new Set();
  const rows = [];
  (employees || []).forEach((employee) => {
    const id = String(employee?.stationId || "");
    if (!id || seen.has(id)) return;
    seen.add(id);
    const station = (stations || []).find((row) => String(row.id) === id);
    rows.push({ id, name: station?.name || employee?.stationName || id });
  });
  return rows.sort((a, b) => String(a.name).localeCompare(String(b.name), "ar"));
}

export function filterRequestPeople({ employees = [], stations = [], query = "", stationId = "all" } = {}) {
  const people = Array.isArray(employees) ? employees : [];
  if (!people.length) {
    return {
      ok: false,
      error: "EMPTY_ROSTER",
      reason: "لا موظف في النطاق الحالي.",
      reasonEn: "Nobody is in the current scope.",
      rows: [],
    };
  }

  const sid = String(stationId || "all");
  const atStation = sid === "all"
    ? people
    : people.filter((row) => String(row.stationId || "") === sid);

  if (!atStation.length) {
    const name = (stations || []).find((station) => String(station.id) === sid)?.name || sid;
    return {
      ok: false,
      error: "NO_STATION_PEOPLE",
      reason: `لا موظف في فرع ${name}.`,
      reasonEn: `Nobody sits in ${name}.`,
      rows: [],
    };
  }

  const hits = atStation.filter((row) => peopleQueryMatches(requestEmployeeSearchHay(row, stations), query));
  const rows = hits.map((row) => {
    const stationName = employeeStationName(row, stations);
    return {
      ...row,
      stationName,
      branchLineAr: employeeBranchLine(stationName, true),
      branchLineEn: employeeBranchLine(stationName, false),
    };
  });

  if (!rows.length) {
    const q = String(query || "").trim();
    return {
      ok: false,
      error: "NO_MATCH",
      reason: q ? `لا أحد يطابق «${q}» في النطاق الحالي.` : "لا موظف يطابق التصفية.",
      reasonEn: q ? `Nobody matches “${q}” in the current scope.` : "Nobody matches this filter.",
      rows: [],
    };
  }

  return { ok: true, rows };
}

export function isPendingDecideStatus(status) {
  return ["pending", "pending_employee", "pending_manager"].includes(status || "pending");
}

export function pendingRequestSearchHay(row, stations = []) {
  return [
    row?.title,
    row?.employee?.name,
    row?.employee?.nameEn,
    row?.employee?.englishName,
    row?.reason,
    row?.type,
    employeeStationName(row?.employee, stations),
  ].filter(Boolean).join(" ");
}

export function filterPendingRequests({ rows = [], stations = [], query = "" } = {}) {
  const pending = (rows || []).filter((row) => isPendingDecideStatus(row.status));
  if (!pending.length) {
    return {
      ok: false,
      error: "EMPTY_QUEUE",
      reason: "لا طلب معلّق في النطاق الحالي.",
      reasonEn: "No pending request in the current scope.",
      rows: [],
    };
  }

  const hits = pending.filter((row) => peopleQueryMatches(pendingRequestSearchHay(row, stations), query));
  if (!hits.length) {
    const q = String(query || "").trim();
    return {
      ok: false,
      error: "NO_MATCH",
      reason: q ? `لا طلب معلّق يطابق «${q}».` : "لا طلب معلّق يطابق التصفية.",
      reasonEn: q ? `No pending request matches “${q}”.` : "No pending request matches this filter.",
      rows: [],
    };
  }

  return { ok: true, rows: hits };
}

const LAW_ROWS = [
  { art: "109", kind: "leave", ruleId: "leave.annual.days", implAr: "الرصيد يُشتق من تاريخ التعيين. بعد الاعتماد تثبت الإجازة في تاريخها: لا تُلغى ولا يُغيَّر موعدها إلا بسحب العامل قبل حلول البدء. إن حدّد صاحب العمل الميعاد يُوقف التسجيل دون إشعار ثلاثين يوماً.", implEn: "Balance is derived from the hire date. After approval the leave is fixed on its dates: it is not cancelled or moved except by the worker withdrawing before it starts. If the employer sets the date, recording is blocked without thirty days' notice." },
  { art: "110", kind: "leave", ruleId: "leave.annual.carry.cite", implAr: "الرصيد غير المستخدم من سنة الاستحقاق السابقة يظهر بند ترحيل مستقل، ويُستهلك أولاً. تسجيل المدير بعد تسعين يوماً من نهاية تلك السنة يحتاج موافقة كتابية.", implEn: "Unused days from the previous entitlement year appear as a separate carry line and are used first. A manager recording leave more than ninety days after that year needs written consent." },
  { art: "118", kind: "leave", ruleId: "leave.noOtherEmployer.cite", implAr: "إرسال أي طلب إجازة يتطلب إقراراً بعدم العمل لدى صاحب عمل آخر.", implEn: "Sending any leave request requires an acknowledgement of no other employer." },
  { art: "111", kind: "leave", ruleId: "eos.unusedLeave.cite", implAr: "يُحسب في مخالصة نهاية الخدمة من الرصيد المتبقي.", implEn: "Unused days are paid in the end-of-service settlement." },
  { art: "112", kind: "leave", ruleId: "leave.eid.cite", implAr: "أيام العطل تُقفل في جدول الدوام: الوطني والتأسيس من التاريخ المرمّز، والفطر بعد إعلان 29 أو 30، والأضحى من يوم عرفة.", implEn: "Official holidays lock the rota: National and Founding from the encoded dates, Fitr after the 29/30 announcement, Adha from Arafah." },
  { art: "113", kind: "leave", ruleId: "leave.marriage.days", implAr: "الطلب لا يُرسل قبل تاريخ الواقعة والمستند إن لزم.", implEn: "The request is not sent before the event date and any required document." },
  { art: "114", kind: "leave", ruleId: "leave.hajj.days", implAr: "يُوسم الطلب مرة واحدة ويُغلق النوع بعد استخدامه.", implEn: "The type is marked once-in-service and closes after use." },
  { art: "115", kind: "leave", ruleId: "leave.exam.cite", implAr: "التفريق بين امتحان أول ومعاد يغيّر أثر الأجر. المهلة 15 يوماً قبل الموعد إشعار من العامل إلى صاحب العمل. إن وصل جدول المواعيد بعد المهلة: ارفع الورقة وسجّل تاريخ صدورها وقدّم في يومها أو اليوم التالي. إثبات المواعيد مع الطلب؛ إثبات الأداء ورقة ثانية على البطاقة بعد بدء أيام الامتحان. صاحب العمل لا يرفض طلباً استوفى المادة؛ رفض الانتساب يغيّر مسار الأجر فقط.", implEn: "A first sitting versus a repeat changes the wage effect. Notice is 15 days before the date — employee notice to the employer. If the timetable paper arrives late: attach it, record its issue date, and apply that day or the next. The timetable goes with the request; sitting proof is a second paper on the card after the exam days begin. The employer cannot refuse a request that meets the article; refusing enrolment only changes the pay track." },
  { art: "116", kind: "leave", ruleId: "leave.unpaid.cite", implAr: "توقف تراكم الإجازة السنوية وتُنشئ بنداً في المسير.", implEn: "It pauses annual accrual and writes a payroll line." },
  { art: "117", kind: "leave", ruleId: "leave.sick.days", implAr: "شريط مراتب يبيّن أين وصل الموظف — لا صف واحد.", implEn: "A band strip shows where the worker stands — not one row." },
  { art: "151", kind: "leave", ruleId: "leave.maternity.days", implAr: "اثنا عشر أسبوعاً، ستة بعد الوضع وجوبية. تمديد شهر بلا أجر بعد انتهائها. مولود مريض أو ذو إعاقة يحتاج مرافقاً: شهر بأجر ثم شهر بلا أجر. وفاة الزوج للعاملة من المادة 160 لا من 113.", implEn: "Twelve weeks, six after birth mandatory. One unpaid month after it ends. A sick or disabled newborn needing a companion: one paid month then one unpaid. A female worker's husband death is Article 160, not 113." },
  { art: "160", kind: "leave", ruleId: "leave.iddah.cite", implAr: "تبدأ من تاريخ الوفاة. المسلمة 130 يوماً بأجر، وغير المسلمة 15. التمديد بلا أجر للحامل حتى الوضع فقط، ولا تُكمَّل العدة بعد الولادة.", implEn: "It starts on the date of death. A Muslim widow has 130 paid days; a non-Muslim widow has 15. An unpaid extension is only if she is pregnant until birth; remaining iddah is not used after birth." },
  { art: "98", kind: "work", ruleId: "hours.week.ordinaryMaxHours", implAr: "سقف 48 ساعة فحص مانع. في رمضان 6 ساعات يومياً أو 36 على أيام رمضان للمسلم — مانع للنشر. اليوم 30 معلّق حتى إعلان 29 أو 30.", implEn: "A 48-hour cap is a blocking check. In Ramadan, 6 hours a day or 36 across Ramadan days for a Muslim blocks publish. Day 30 waits for the 29/30 announcement." },
  { art: "101", kind: "work", ruleId: "hours.rest.maxConsecutiveHours", implAr: "فحص مانع: لا أكثر من خمس ساعات متواصلة، ولا بقاء في مكان العمل فوق اثنتي عشرة ساعة.", implEn: "A blocking check: no more than five consecutive hours, and no more than twelve hours at the workplace." },
  { art: "102", kind: "work", ruleId: "hours.rest.notWorkingHours.cite", implAr: "فترات الراحة والصلاة والطعام لا تُحتسب ساعات عمل فعلية.", implEn: "Rest, prayer and meal periods are not counted as actual working hours." },
  { art: "104", kind: "work", ruleId: "hours.rest.weeklyHours", implAr: "فحص مانع قبل نشر الجدول.", implEn: "A blocking check before the rota is published." },
  { art: "106", kind: "work", ruleId: "hours.ot.art106.inventoryMaxDays", implAr: "تكليف إجباري في ثلاث حالات فقط. المسؤول يرفق ملف الواقعة ويُقرّ. الموظف لا يرفض. الجرد أو الضغط: سقف 30 يوماً في السنة.", implEn: "Mandatory assignment in three cases only. The manager attaches the incident file and acknowledges. The worker cannot refuse. Inventory or pressure: 30 days a year." },
  { art: "107", kind: "work", ruleId: "hours.ot.premium", implAr: "أجر الإضافي ساعة ونصف من الساعات المعتمدة في الحضور. غير المعتمدة لا تُصرف. الإجازة التعويضية خيار من 19 فبراير 2025.", implEn: "Overtime is time-and-a-half from approved attendance hours. Undecided hours are not paid. Compensatory leave is an option from 19 February 2025." },
  { art: "58", kind: "work", ruleId: "contract.workplace.transfer.cite", implAr: "نقل يقتضي تغيير محل الإقامة يحتاج موافقة العامل كتابةً. للضرورة العارضة حتى ثلاثين يوماً في السنة دون موافقة، مع تحمل صاحب العمل تكاليف الانتقال والإقامة.", implEn: "A move that requires changing residence needs the worker's written consent. For incidental necessity up to thirty days a year the employer may assign without consent and bears travel and lodging." },
  { art: "18632", kind: "work", ruleId: "hours.night.rotateWeeks", source: "ministerial", citeKind: "decision", implAr: "الليل 23:00–06:00. أي عمل داخل النافذة = يؤدي عملاً ليلياً. عامل ليلي = ثلاث ساعات فأكثر. للمنشأة حرية اختيار تقليص الساعات أو بدل أو تغيير العمل الليلي؛ إن اختارت تقليصاً أو بدلاً فلها سحبه والبدء من جديد. البدل مبلغ تختاره المنشأة (أجر أو نقل) ويُصرف مع الراتب. بعد ثلاثة أشهر كعامل ليلي: موافقة خطية محفوظة مع حق التراجع في أي وقت — لا تجديد شهري واجب — أو تدوير لساعات عادية شهراً على الأقل. أسبوع صباحي واحد لا يصفّر العدّ. الموافقة: اكتب → وقّع في قسم التوقيع → ارفع هنا. الرفض زر مباشر. صمت المسؤول لا يُغلق الطلب. من يؤدي عملاً ليلياً يُعوَّض. للعامل الليلي بدل أو تخفيض ساعات مع حفظ الأجر — إلا الليلي العرضي.", implEn: "Night is 23:00–06:00. Any work in that window performs night work. A night worker works three hours or more. The establishment freely chooses reduced hours, an allowance, or a change of night work; if it chose a reduction or an allowance it may withdraw that choice and start over. The allowance is an amount the establishment names (pay or transport) and it pays with salary. After three months as a night worker: written consent on file with the right to withdraw at any time — monthly renewal is not a legal duty — or rotate to ordinary hours for at least one month. One morning week does not reset the clock. Consent: write → sign in Digital signing → upload here. Refuse is one button. Manager silence does not close the request. Anyone who performs night work is compensated. A night worker gets an allowance or reduced hours with pay preserved — except incidental night." },
];

/** Article / ministerial decision on a request card. Never invents a المادة. */
export function requestStatuteCite(row = {}) {
  const topic = row.topic ? consentTopicMeta(row.topic) : null;
  const article = String(row.article || topic?.article || "").trim();
  const fromNight = row.type === "night_consent" || row.type === NIGHT_FITNESS_TYPE || row.decisionId === "18632" || topic?.decisionId === "18632";
  const decisionId = String(row.decisionId || topic?.decisionId || (fromNight || article === "18632" ? "18632" : "")).trim();
  if (decisionId && (!article || article === "18632")) {
    return { article: "", decisionId, productOnly: false };
  }
  if (article) return { article, decisionId: "", productOnly: false };
  return { article: "", decisionId: "", productOnly: true };
}

export function todayRiyadh() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}

/** Same named gate + same message appears once. A later ok:true row replaces a fail with the same id. */
export function uniqueNamedGates(rows = []) {
  const seen = new Set();
  const byId = new Map();
  const out = [];
  for (const row of rows || []) {
    if (!row) continue;
    const id = String(row.id || row.error || "").trim();
    const text = String(row.text || row.reason || "").trim();
    const fingerprint = `${id}::${text}`;
    if (seen.has(fingerprint)) continue;
    if (id && byId.has(id)) {
      const idx = byId.get(id);
      if (row.ok === true && out[idx].ok !== true) {
        seen.delete(`${id}::${String(out[idx].text || "").trim()}`);
        out[idx] = { ...row, id, text: text || row.text };
        seen.add(fingerprint);
      }
      continue;
    }
    seen.add(fingerprint);
    if (id) byId.set(id, out.length);
    out.push({ ...row, id: id || undefined, text: text || row.text });
  }
  return out;
}

const STUDY_FIELD_ERRORS = new Set(["PROGRAM_REQUIRED", "INSTITUTION_REQUIRED", "DATE_REQUIRED", "STUDY_CONSENT_FILE_REQUIRED"]);

/** Raise checklist for موافقة دراسية — one row per gate id. Institution stays; exam leave does not use this list. */
export function composeStudyConsentRaiseGates(input = {}, lang = "ar") {
  const ar = lang === "ar";
  const fields = resolveStudyConsentFields(input);
  const submit = input.submitGate && typeof input.submitGate === "object"
    ? input.submitGate
    : checkSubmitStudyConsentGate(input);
  const file = fields.file;
  const extras = Array.isArray(input.extraGates) ? input.extraGates : [];
  return uniqueNamedGates([
    {
      id: "PROGRAM_REQUIRED",
      ok: fields.program.length >= 2,
      text: fields.program.length >= 2
        ? (ar ? `البرنامج: ${fields.program}` : `Program: ${fields.program}`)
        : (ar ? "اكتب البرنامج أو التخصص." : "Write the program or field of study."),
    },
    {
      id: "INSTITUTION_REQUIRED",
      ok: fields.institution.length >= 2,
      text: fields.institution.length >= 2
        ? (ar ? `المؤسسة: ${fields.institution}` : `Institution: ${fields.institution}`)
        : (ar ? "اكتب اسم المؤسسة التعليمية." : "Write the educational institution."),
    },
    {
      id: "DATE_REQUIRED",
      ok: !!fields.startDate,
      text: fields.startDate
        ? (ar ? `بداية الدراسة: ${formatArDate(fields.startDate, lang)}` : `Study start: ${formatArDate(fields.startDate, lang)}`)
        : (ar ? "حدد تاريخ بداية الدراسة." : "Set the study start date."),
    },
    {
      id: "STUDY_CONSENT_FILE_REQUIRED",
      ok: !!file,
      text: file
        ? (ar ? `مرفق الانتساب: ${file.name}` : `Enrolment file: ${file.name}`)
        : (ar ? STUDY_CONSENT_FILE_REQUIRED_AR : STUDY_CONSENT_FILE_REQUIRED_EN),
    },
    {
      id: "STUDY_CONSENT_UNLOCK",
      ok: submit.ok === true || STUDY_FIELD_ERRORS.has(submit.error),
      text: submit.ok === true
        ? (ar ? "بعد الاعتماد تُفتح إجازة الامتحان، والموافقة نهائية — الشركة لا ترجع عنها." : "After approval, exam-leave submit opens. That approval is final — the company does not withdraw it.")
        : (ar ? submit.reason : submit.reasonEn),
    },
    {
      id: "STUDY_CONSENT_ARTICLE_115",
      ok: true,
      text: ar
        ? "المادة 115 تربط إجازة الامتحان بموافقة صاحب العمل على الانتساب. هذا الطلب يسجّل تلك الموافقة. عدم الرجوع عنها قرار تشغيلي للمنشأة — ليس نصاً إضافياً في المادة."
        : "Article 115 ties exam leave to the employer's agreement to enrolment. This request records that consent. Not withdrawing it is the establishment's recorded gate — not an extra verse in the article.",
    },
    ...extras,
  ]);
}

export function formatArDate(iso, lang = "ar") {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso || "—";
  return formatDate(s, lang, { day: "numeric", month: "long", year: "numeric" }) || iso || "—";
}

export function countAr(n, one, two, few, many) {
  const v = Math.max(0, Number(n) || 0);
  if (v === 1) return one;
  if (v === 2) return two;
  if (v <= 10) return `${v} ${few}`;
  return `${v} ${many}`;
}

export function rangeDates(from, to) {
  const a = String(from || "").slice(0, 10);
  const b = String(to || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b) || b < a) return [];
  const out = [];
  const cur = new Date(`${a}T00:00:00`);
  const end = new Date(`${b}T00:00:00`);
  let guard = 0;
  while (cur <= end && guard++ < 400) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function leaveKindMeta(key, onDate) {
  const found = LEAVE_TYPES.find((row) => row.key === key) || LEAVE_TYPES[0];
  return {
    ...found,
    ar: leaveTypeLabel(found.key, true, undefined, onDate),
    en: leaveTypeLabel(found.key, false, undefined, onDate),
  };
}

export function leaveKindsFor(profile, ar = true, requests) {
  const leftover = leftoverGrantDays(profile, requests);
  return leaveTypesForProfile(profile || {}).map((row) => {
    const meta = leaveKindMeta(row.key);
    const cite = meta.article ? statutoryArticleLabel(meta.article, ar) : (ar ? "قرار تشغيلي" : "Operational");
    const cap = row.key === "annual"
      ? (ar ? "21 يوماً — 30 بعد 5 سنوات" : "21 days — 30 after 5 years")
        : row.key === "grant"
        ? (leftover
          ? (ar ? `${leftover} أيام تقديرية متبقية` : `${leftover} discretionary days left`)
          : (ar ? "لا رصيد تقديري بعد" : "No discretionary days left"))
      : row.key === "eid"
        ? (ar ? "الوطني 1 · التأسيس 1 مقفلان في الجدول بلا طلب · الفطر 4 · الأضحى 4 بطلب" : "National 1 · Founding 1 locked on the roster · Fitr 4 · Adha 4 by request")
      : row.key === "iddah"
        ? (isRamadanHoursSubject({ profile })
          ? (ar ? "130 يوماً بأجر — تمديد بلا أجر للحامل حتى الوضع" : "130 paid days — unpaid extension if pregnant until birth")
          : (ar ? "15 يوماً بأجر كامل" : "15 days on full pay"))
      : row.key === "bereavement"
        ? (profileGender(profile) === "female"
          ? (ar ? "5 أيام — أصل أو فرع · وفاة الزوج من العدّة" : "5 days — parent or child · husband death is iddah")
          : (ar ? "5 أيام — زوج أو أصل أو فرع" : "5 days — spouse, parent or child"))
      : row.key === "maternity_extend"
        ? (ar ? "شهر بلا أجر بعد انتهاء الوضع" : "One unpaid month after maternity ends")
      : row.key === "maternity_companion"
        ? (ar ? "شهر بأجر بعد الوضع — وتمديد شهر بلا أجر" : "One paid month after maternity — plus an unpaid month")
      : row.key === "sick"
        ? (ar ? "30 كامل · 60 بثلاثة أرباع · 30 بلا أجر" : "30 full · 60 at three-quarters · 30 unpaid")
      : row.key === "exam"
        ? (ar ? "أيام الامتحان الفعلية — لا تُرفض إن استوفت" : "Actual exam days — a qualifying file is not refused")
        : row.defaultTotal
          ? (ar ? countAr(row.defaultTotal, "يوم", "يومان", "أيام", "يوماً") : `${row.defaultTotal} days`)
          : (ar ? "باتفاق الطرفين" : "By agreement");
    return {
      ...row,
      ar: leaveTypeLabel(row.key, true, profile),
      en: leaveTypeLabel(row.key, false, profile),
      article: meta.article,
      cite,
      cap,
      requiresFile: !!row.requiresFile || !!meta.requiresFile,
    };
  });
}

export { grantDaysOf, leftoverGrantDays };

export function annualRemainingWithGrants(profile, requests, onDate) {
  const split = annualBalanceSplit(profile, requests, onDate);
  const total = split.currentTotal ?? 0;
  const used = split.currentUsed + split.carryUsed;
  const leftover = split.currentLeft;
  const leftoverGrants = leftoverGrantDays(profile, requests, onDate);
  return {
    total,
    used,
    leftover,
    leftoverGrants,
    remaining: split.remaining + leftoverGrants,
    statutory: statutoryLeaveFloor("annual", profile, onDate),
    carryTotal: split.carryTotal,
    carryLeft: split.carryLeft,
  };
}

export function officialHolidays(onDate = todayRiyadh(), calendar) {
  return officialHolidayList(onDate, calendar);
}

export function lawArticleCards(filter = "leave", liveArticle = "", lang = "ar") {
  const ar = lang === "ar";
  const names = {
    109: { ar: "الإجازة السنوية", en: "Annual leave" },
    110: { ar: "تأجيل الإجازة وتجزئتها", en: "Postponing and splitting leave" },
    111: { ar: "مقابل الإجازة عند انتهاء الخدمة", en: "Leave pay at end of service" },
    112: { ar: "عطل الأعياد والمناسبات الوطنية", en: "Eids and national occasions" },
    113: { ar: "إجازات المناسبات", en: "Occasion leave" },
    114: { ar: "إجازة الحج", en: "Hajj leave" },
    115: { ar: "إجازة الامتحان", en: "Exam leave" },
    116: { ar: "الإجازة بغير أجر", en: "Unpaid leave" },
    117: { ar: "الإجازة المرضية", en: "Sick leave" },
    118: { ar: "حظر العمل لدى الغير أثناء الإجازة", en: "No other employer during leave" },
    151: { ar: "إجازة الوضع", en: "Maternity leave" },
    98: { ar: "ساعات العمل", en: "Working hours" },
    101: { ar: "فترات الراحة أثناء العمل", en: "Rest during work" },
    102: { ar: "الراحة ليست ساعات عمل", en: "Rest is not working time" },
    104: { ar: "الراحة الأسبوعية", en: "Weekly rest" },
    106: { ar: "العمل الإضافي الإجباري", en: "Mandatory overtime" },
    107: { ar: "أجر العمل الإضافي", en: "Overtime pay" },
    58: { ar: "تغيير مكان العمل", en: "Change of workplace" },
    18632: { ar: "العمل الليلي", en: "Night work" },
  };
  return LAW_ROWS
    .filter((row) => filter === "all" || row.kind === filter)
    .map((row) => {
      const citeKind = row.citeKind || (row.source === "ministerial" ? "decision" : "article");
      const official = citeKind === "article" ? articleOfficialText(row.art) : null;
      const explain = explainRule(row.ruleId);
      const live = String(liveArticle) === String(row.art);
      return {
        art: row.art,
        kind: row.kind,
        citeKind,
        source: row.source || "labour",
        name: ar ? names[row.art]?.ar : names[row.art]?.en,
        text: ar ? (official?.ar || explain?.hintAr || "") : (official?.en || explain?.hintEn || ""),
        hint: ar ? (explain?.hintAr || "") : (explain?.hintEn || ""),
        impl: ar ? row.implAr : row.implEn,
        live,
        entitlement: (row.kind === "leave" && row.art !== "118") || ["98", "101", "102", "104", "107", "118", "18632"].includes(String(row.art)),
        warn: String(row.art) === "106" && live,
      };
    });
}

export function balanceRows(profile, requests, lang = "ar") {
  const ar = lang === "ar";
  const annual = annualRemainingWithGrants(profile, requests);
  const sickUsed = usedLeaveDays(requests, "sick", undefined, profile?.hireDate);
  const full = ruleValue("leave.sick.fullPayDays");
  const mid = ruleValue("leave.sick.halfPayDays");
  const unpaid = ruleValue("leave.sick.unpaidDays");
  const hajjUsed = (requests || []).some((row) => row.type === "hajj" && row.status === "approved") || profile?.hajjPerformed;
  const bar = (left, cap) => {
    const pct = cap ? Math.round((left / cap) * 100) : 0;
    return { pct, color: pct > 50 ? "#1d9a5b" : pct > 0 ? "#c9962b" : "#8a1c2b" };
  };
  const daysLabel = (n) => (ar
    ? countAr(n, "يوم متبقٍ", "يومان متبقيان", "أيام متبقية", "يوماً متبقياً")
    : `${n} left`);
  const sickTier = (nameAr, nameEn, cap, before) => {
    const used = Math.max(0, Math.min(cap, sickUsed - before));
    const left = cap - used;
    const tone = bar(left, cap);
    return {
      name: ar ? nameAr : nameEn,
      article: "117",
      art: statutoryArticleLabel("117", ar),
      val: ar ? `من ${cap} — ${daysLabel(left)}` : `${left} of ${cap}`,
      ...tone,
    };
  };
  const rows = [
    {
      name: ar ? "سنوية — المستحق النظامي" : "Annual — statutory",
      article: "109",
      art: statutoryArticleLabel("109", ar),
      val: ar ? `من ${annual.statutory} — ${daysLabel(annual.leftover)}` : `${annual.leftover} of ${annual.statutory}`,
      ...bar(annual.leftover, annual.statutory || 1),
    },
  ];
  if (annual.carryTotal) {
    rows.push({
      name: ar ? "ترحيل سنوية — السنة السابقة" : "Annual carry — previous year",
      article: "110",
      art: statutoryArticleLabel("110", ar),
      val: ar ? `من ${annual.carryTotal} — ${daysLabel(annual.carryLeft)}` : `${annual.carryLeft} of ${annual.carryTotal}`,
      ...bar(annual.carryLeft, annual.carryTotal || 1),
    });
  }
  if (annual.leftoverGrants || grantDaysOf(profile)) {
    const granted = grantDaysOf(profile);
    rows.push({
      name: ar ? "أيام تقديرية — من المدير" : "Discretionary — from the manager",
      article: "",
      art: ar ? "قرار تشغيلي" : "Operational",
      val: ar ? `من ${granted} — ${daysLabel(annual.leftoverGrants)}` : `${annual.leftoverGrants} of ${granted}`,
      ...bar(annual.leftoverGrants, granted || 1),
    });
  }
  rows.push(
    sickTier("مرضية — المرتبة الأولى بأجر كامل", "Sick — first band, full pay", full, 0),
    sickTier("مرضية — المرتبة الثانية بثلاثة أرباع", "Sick — second band, three-quarters", mid, full),
    sickTier("مرضية — المرتبة الثالثة بغير أجر", "Sick — third band, unpaid", unpaid, full + mid),
    {
      name: ar ? "حج" : "Hajj",
      article: "114",
      art: statutoryArticleLabel("114", ar),
      val: hajjUsed
        ? (ar ? "استُخدمت — مرة واحدة في الخدمة" : "Used — once in service")
        : (ar ? "متاحة — مرة واحدة في الخدمة" : "Available — once in service"),
      pct: hajjUsed ? 0 : 100,
      color: hajjUsed ? "#8a1c2b" : "#1d9a5b",
    },
  );
  return rows;
}

export function pendingWorkspaceDecideCount(employees = []) {
  return flattenWorkspaceRows(employees).filter((row) => (
    isWorkspaceDeskDecision(row) && isPendingDecideStatus(row.status)
  )).length;
}

export function flattenWorkspaceRows(employees = [], lang = "ar") {
  const ar = lang === "ar";
  const leave = (employees || []).flatMap((employee) => (employee.leaveRequests || []).map((request) => ({
    ...request,
    employee,
    family: "leave",
    title: ar
      ? `إجازة ${leaveKindMeta(request.type, request.startDate)?.ar || ""}`
      : `${leaveKindMeta(request.type, request.startDate)?.en || ""} leave`,
    article: leaveKindMeta(request.type)?.article || "",
  })));
  const other = (employees || []).flatMap((employee) => (employee.otherRequests || []).filter((request) => request.type !== "written_consent").map((request) => ({
    ...request,
    employee,
    family: "other",
    title: request.type === STUDY_CONSENT_TYPE
      ? (ar
        ? `${STUDY_CONSENT_LABEL_AR}${request.program ? ` · ${request.program}` : ""}`
        : `${STUDY_CONSENT_LABEL_EN}${request.program ? ` · ${request.program}` : ""}`)
      : request.type === NIGHT_FITNESS_TYPE
      ? (ar ? NIGHT_FITNESS_LABEL_AR : NIGHT_FITNESS_LABEL_EN)
      : request.type === LEAVE_TOPUP_TYPE
      ? (ar
        ? `رفع رصيد إجازة${request.days ? ` · ${countAr(request.days, "يوم", "يومان", "أيام", "يوماً")}` : ""}`
        : `Leave balance top-up${request.days ? ` · ${request.days} days` : ""}`)
      : isOvertimeAssignment(request)
        ? otAssignmentTitle(request, ar)
      : (request.title || request.otherTitle
      || (request.docKind
        ? (DOC_KINDS.find((row) => row.id === request.docKind)?.[ar ? "ar" : "en"] || otherRequestTypeLabel(request.type, ar))
        : otherRequestTypeLabel(request.type, ar))),
    article: request.type === STUDY_CONSENT_TYPE ? "115" : (isArticle106Assignment(request) ? "106" : (isOvertimeAssignment(request) ? "107" : "")),
    rightsNote: request.type === "night_consent" || request.type === NIGHT_FITNESS_TYPE ? decision18632RightsNote(ar) : "",
    cite: (request.type === "night_consent" || request.type === NIGHT_FITNESS_TYPE)
      ? statutoryDecisionLabel("18632", ar)
      : isArticle106Assignment(request)
        ? statutoryArticleLabel("106", ar)
        : (otCompensationOf(request) === "credit"
          ? (ar ? "رصيد إجازة" : "Leave credit")
          : (otCompensationOf(request) === "pay" ? (ar ? "أجر إضافي" : "OT pay") : "")),
    fileName: assignmentFileName(request) || request.senderFile?.name || request.file?.name || request.files?.[0]?.name || "",
  })));
  return [...leave, ...other].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function yearsOfService(profile, onDate) {
  return serviceYearsFromHire(profile?.hireDate, onDate);
}

export function remainingAnnualLabel(profile, requests, lang = "ar") {
  const ar = lang === "ar";
  const { remaining, leftoverGrants, statutory } = annualRemainingWithGrants(profile, requests);
  const base = ar
    ? countAr(remaining, "يوم متبقٍ", "يومان متبقيان", "أيام متبقية", "يوماً متبقياً")
    : `${remaining} days left`;
  return leftoverGrants
    ? (ar ? `${base} (نظامي ${statutory} + تقديري ${leftoverGrants})` : `${base} (statutory ${statutory} + discretionary ${leftoverGrants})`)
    : base;
}

export { remainingLeaveDays, computeLeaveDays };

const SETTLED = new Set(["approved", "rejected", "withdrawn", "yes", "no", "refused_by_employee", "lapsed"]);
const ENDED_NIGHT = new Set(["withdrawn", "refused", "lapsed", "reduced_hours"]);

export function isSettledRequest(row) {
  return SETTLED.has(row?.status);
}

export function isLeaveInboxRow(row) {
  return !!(row && (row.family === "leave" || LEAVE_TYPES.some((item) => item.key === row.type)));
}

export function hasSeenLeaveDecision(row) {
  return !!(row && row.decisionSeenAt);
}

/** Approved leave the worker has not opened yet — green on ملفي, not ended. */
export function isUnseenApprovedLeave(row) {
  return isLeaveInboxRow(row) && (row.status || "") === "approved" && !hasSeenLeaveDecision(row);
}

/** Closed for the live inbox — withdrawn / refused / lapsed / seen leave decision. Night agree-month stays live so the worker can withdraw. Approval alone does not end upcoming leave (Art. 109). */
export function isEndedInboxRequest(row) {
  if (!row) return false;
  if (row.type === "night_consent") {
    return ENDED_NIGHT.has(nightRotateStage(row));
  }
  const status = row.status || "pending";
  if (status === "lapsed" || status === "withdrawn" || status === "rejected" || status === "refused_by_employee" || status === "yes" || status === "no") {
    return true;
  }
  if (status !== "approved") return false;
  if (row.type === STUDY_CONSENT_TYPE || row.type === NIGHT_FITNESS_TYPE) return false;
  if (isLeaveInboxRow(row)) {
    if (String(row.type || "").toLowerCase() === "exam" && !hasExamSatProof(row)) return false;
    return hasSeenLeaveDecision(row);
  }
  return true;
}

/** Still needs a worker or manager act — ملفي / إدارة. extras.lane === "manage" is only items awaiting that manager's decision. */
export function isLiveInboxRequest(row, extras = {}) {
  if (!row || isEndedInboxRequest(row)) return false;
  if (extras.lane === "manage") {
    if (isLeaveInboxRow(row)) {
      if ((row.status || "pending") === "pending" || row.status === "revise") return true;
      return String(row.type || "").toLowerCase() === "exam" && (row.status || "") === "approved" && examSatState(row).due;
    }
    return isManagerDecideOtherRequest(row) || row.status === "revise";
  }
  if (isPendingDecideStatus(row.status) || row.status === "revise") return true;
  if (row.type === "night_consent") {
    const stage = nightRotateStage(row);
    return stage === "active" || stage === "agreed_month";
  }
  if ((row.type === STUDY_CONSENT_TYPE || row.type === NIGHT_FITNESS_TYPE) && (row.status || "") === "approved") return true;
  if (isUnseenApprovedLeave(row)) return true;
  if (isLeaveInboxRow(row) && String(row.type || "").toLowerCase() === "exam" && !hasExamSatProof(row)) return true;
  return false;
}

/** Subject of a flattened طلباتي row — employee.id, cloud employeeId, or request.employeeId. */
export function requestRowSubjectId(row) {
  return String(row?.employee?.id || row?.employee?.employeeId || row?.employeeId || "").trim();
}

function asViewer(viewer) {
  if (!viewer) return null;
  if (typeof viewer === "object") return viewer;
  return { id: viewer };
}

/** ملفي lists the signed-in worker's rows only. Empty viewer never claims a coworker's card. */
export function isOwnMineLaneRow(row, viewer) {
  if (!row) return false;
  const person = asViewer(viewer);
  if (!person) return false;
  const viewerId = viewerEmployeeId(person);
  const sessionId = String(person.id || "").trim();
  if (!viewerId && !sessionId) return false;
  if (row.employee) return isViewerOwnFile(row.employee, person);
  const subjectId = requestRowSubjectId(row);
  if (!subjectId) return false;
  if (subjectId === viewerId || (sessionId && subjectId === sessionId)) return true;
  const raisedBy = String(row.requestedById || "").trim();
  return !!(raisedBy && (raisedBy === viewerId || raisedBy === sessionId) && (subjectId === viewerId || subjectId === sessionId));
}

/** ملفي inbox after raise — own pending stays on the raiser's file. Empty viewer does not dump the company. */
export function mineInboxRows(employees = [], viewer, lang = "ar") {
  const rows = liveInboxRows(employees, lang, { lane: "mine" });
  const person = asViewer(viewer);
  if (!person || (!viewerEmployeeId(person) && !String(person.id || "").trim())) return [];
  return rows.filter((row) => isOwnMineLaneRow(row, person));
}

export function liveInboxRows(employees = [], lang = "ar", extras = {}) {
  return flattenWorkspaceRows(employees, lang).filter((row) => isLiveInboxRequest(row, extras));
}

const MANAGE_PENDING_KINDS = [
  { id: "leave", ar: "إجازة", en: "leave", match: (row) => row.family === "leave" },
  { id: STUDY_CONSENT_TYPE, ar: STUDY_CONSENT_LABEL_AR, en: STUDY_CONSENT_LABEL_EN, match: (row) => row.type === STUDY_CONSENT_TYPE },
  { id: NIGHT_FITNESS_TYPE, ar: NIGHT_FITNESS_LABEL_AR, en: NIGHT_FITNESS_LABEL_EN, match: (row) => row.type === NIGHT_FITNESS_TYPE },
  { id: "permission", ar: "استئذان", en: "excuse", match: (row) => row.type === "permission" },
  { id: "advance", ar: "سلفة", en: "advance", match: (row) => row.type === "advance" },
  { id: "custody", ar: "عهدة", en: "custody", match: (row) => row.type === "custody" },
  { id: "other", ar: "طلب آخر", en: "other", match: (row) => row.family === "other" && ![STUDY_CONSENT_TYPE, NIGHT_FITNESS_TYPE, "permission", "advance", "custody", "night_consent", "written_consent"].includes(row.type) },
];

/** إدارة decide queue — pending leave / study / night fitness / excuses / advances / custody / other. */
export function managerPendingInbox(employees = [], lang = "ar", extras = {}) {
  const ar = lang === "ar";
  const stations = extras.stations || [];
  const rows = liveInboxRows(employees, lang, { lane: "manage" }).filter((row) => isPendingDecideStatus(row.status));
  const named = MANAGE_PENDING_KINDS.map((kind) => ({
    id: kind.id,
    label: ar ? kind.ar : kind.en,
    count: derivedAlertCount(rows.filter(kind.match).length),
  })).filter((row) => row.count > 0);
  const annotated = rows.map((row) => ({
    ...row,
    stationId: requestEmployeeStationId(row.employee),
    stationName: stationDisplayName(employeeStationName(row.employee, stations), ar),
    regardingLine: requestRegardingLine({
      name: row.employee?.name,
      stationName: employeeStationName(row.employee, stations),
      lang,
    }),
  }));
  annotated.sort((a, b) => String(a.stationName).localeCompare(String(b.stationName), "ar")
    || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return {
    rows: annotated,
    groups: pendingStationGroups(annotated, stations, lang),
    count: derivedAlertCount(annotated.length),
    named,
    emptyReason: ar
      ? "لا طلب معلّق بانتظار قرار الإدارة — إجازة، موافقة دراسية، لياقة ليلية، استئذان، سلفة، عهدة، أو طلب آخر."
      : "No pending request awaiting management — leave, study consent, night fitness, excuse, advance, custody, or other.",
  };
}

/** إدارة — open the first pending person on the focused branch, else the first person there. */
export function firstPendingRegisterPerson(employees = [], lang = "ar", focusStationId = "") {
  const list = employees || [];
  if (!list.length) return null;
  const focus = String(focusStationId || "");
  const onFocus = focus && focus !== "all"
    ? list.filter((emp) => requestEmployeeStationId(emp) === focus)
    : list;
  const pool = onFocus.length ? onFocus : list;
  const pending = pool.filter((emp) => managerPendingInbox([emp], lang).count);
  return pending[0] || pool[0] || null;
}

function studyConsentRegisterLabel(state, ar) {
  if (state?.status === "approved") return ar ? "موافقة دراسية مسجّلة" : "Study consent on file";
  if (state?.status === "pending") return ar ? "موافقة دراسية معلّقة" : "Study consent pending";
  if (state?.status === "rejected") return ar ? "موافقة دراسية مرفوضة" : "Study consent refused";
  return ar ? "بلا موافقة دراسية" : "No study consent";
}

function compactStudyLabel(state, ar) {
  if (state?.status === "approved") return ar ? "دراسة مسجّلة" : "Study on file";
  if (state?.status === "pending") return ar ? "دراسة معلّقة" : "Study pending";
  if (state?.status === "rejected") return ar ? "دراسة مرفوضة" : "Study refused";
  return ar ? "بلا دراسة" : "No study";
}

function nightFitnessRegisterLabel(employee, ar) {
  const report = nightMedicalReportOf(employee);
  const state = nightFitnessState(employee);
  if (state.status === "pending") return ar ? "لياقة ليلية معلّقة" : "Night fitness pending";
  const filed = report || (state.status === "approved" ? state.request : null);
  if (filed) {
    if (filed.permanent) return ar ? `لياقة ليلية — ${NIGHT_FITNESS_PERMANENT_AR}` : "Night fitness — permanent";
    const until = filed.until || filed.to || "";
    return ar
      ? `لياقة ليلية${until ? ` حتى ${formatArDate(until, "ar")}` : " مسجّلة"}`
      : `Night fitness${until ? ` until ${formatArDate(until, "en")}` : " on file"}`;
  }
  if (state.status === "rejected") return ar ? "لياقة ليلية مرفوضة" : "Night fitness refused";
  return ar ? "بلا تقرير لياقة ليلية" : "No night-fitness report";
}

function compactNightLabel(employee, ar) {
  const report = nightMedicalReportOf(employee);
  const state = nightFitnessState(employee);
  if (state.status === "pending") return ar ? "لياقة معلّقة" : "Fitness pending";
  const filed = report || (state.status === "approved" ? state.request : null);
  if (filed?.permanent) return ar ? "لياقة دائم" : "Fitness permanent";
  if (filed) return ar ? "لياقة مسجّلة" : "Fitness on file";
  if (state.status === "rejected") return ar ? "لياقة مرفوضة" : "Fitness refused";
  return ar ? "بلا لياقة" : "No fitness";
}

function compactBalanceLabel(profile, requests, ar) {
  const { remaining } = annualRemainingWithGrants(profile, requests);
  return ar ? `رصيد ${remaining}` : `Balance ${remaining}`;
}

/** إدارة — empty decision pane for the selected file. */
export function managerPersonEmptyReason(lang = "ar") {
  return lang === "ar" ? "لا طلب معلّق لهذا الملف." : "No pending request on this file.";
}

/** إدارة سجل الموظف — person, pending count, derived balance, study + night-fitness facts. */
export function managerEmployeeRegister(employees = [], lang = "ar", extras = {}) {
  const ar = lang === "ar";
  const stations = extras.stations || [];
  const rows = (employees || []).map((employee) => {
    const pending = managerPendingInbox([employee], lang, { stations });
    const history = flattenWorkspaceRows([employee], lang).slice(0, 6);
    const study = studyConsentState(employee, extras.companyId);
    const stationName = employeeStationName(employee, stations);
    return {
      id: employee.id,
      name: employee.name || "",
      stationId: requestEmployeeStationId(employee),
      stationName: stationDisplayName(stationName, ar),
      branchLine: employeeBranchLine(stationName, ar),
      regardingLine: requestRegardingLine({ name: employee.name, stationName, lang }),
      pendingCount: pending.count,
      pendingNamed: pending.named,
      balance: remainingAnnualLabel(employee.profile, employee.leaveRequests, lang),
      statusLine: [compactBalanceLabel(employee.profile, employee.leaveRequests, ar), compactStudyLabel(study, ar), compactNightLabel(employee, ar)].join(" · "),
      studyConsent: study.status,
      studyLabel: studyConsentRegisterLabel(study, ar),
      nightFitness: nightFitnessState(employee).status,
      nightLabel: nightFitnessRegisterLabel(employee, ar),
      history,
      employee,
    };
  }).sort((a, b) => String(a.stationName).localeCompare(String(b.stationName), "ar")
    || (b.pendingCount - a.pendingCount)
    || String(a.name).localeCompare(String(b.name), "ar"));
  const dueRows = rows.filter((row) => row.pendingCount > 0);
  const groupMap = new Map();
  for (const row of dueRows) {
    const sid = row.stationId || "";
    if (!groupMap.has(sid)) {
      groupMap.set(sid, {
        stationId: sid,
        stationName: row.stationName,
        pendingCount: 0,
        rows: [],
      });
    }
    const group = groupMap.get(sid);
    group.rows.push(row);
    group.pendingCount += row.pendingCount;
  }
  const groups = [...groupMap.values()].map((group) => ({
    ...group,
    peopleCount: group.rows.length,
    alert: ar
      ? `${countAr(group.rows.length, "شخص واحد", "شخصان", "أشخاص", "شخصاً")} · ${countAr(group.pendingCount, "طلب معلّق", "طلبان معلّقان", "طلبات معلّقة", "طلباً معلّقاً")}`
      : `${group.rows.length === 1 ? "1 person" : `${group.rows.length} people`} · ${group.pendingCount} pending`,
    rows: [...group.rows].sort((a, b) => (b.pendingCount - a.pendingCount)
      || String(a.name).localeCompare(String(b.name), "ar")),
  }));
  const focus = String(extras.focusStationId || "").trim();
  const parked = Boolean(focus && focus !== "all");
  groups.sort((a, b) => {
    const aFocus = parked && a.stationId === focus ? 0 : 1;
    const bFocus = parked && b.stationId === focus ? 0 : 1;
    if (aFocus !== bFocus) return aFocus - bFocus;
    if ((b.pendingCount || 0) !== (a.pendingCount || 0)) return (b.pendingCount || 0) - (a.pendingCount || 0);
    return String(a.stationName).localeCompare(String(b.stationName), "ar");
  });
  const strip = otherStationsPendingStrip({
    employees,
    stations,
    focusStationId: extras.focusStationId,
    lang,
  });
  const standingName = parked
    ? (groups.find((group) => group.stationId === focus)?.stationName
      || stationDisplayName((stations || []).find((row) => String(row.id) === focus)?.name, ar))
    : "";
  return {
    people: rows,
    rows: dueRows,
    groups,
    count: derivedAlertCount(dueRows.length),
    pendingPeople: derivedAlertCount(dueRows.length),
    empty: dueRows.length === 0,
    strip,
    rail: {
      standing: parked
        ? (ar ? `واقف على ${standingName}` : `Standing at ${standingName}`)
        : (ar ? "واقف على الفروع التي تديرها" : "Standing across the branches you manage"),
      note: ar
        ? "تنبيه لكل فرع فيه معلّق. يُفتح من له طلب فقط — لا دفتر كل الموظفين."
        : "An alert per branch that is due. Only people with a request open — not the whole roster.",
      others: strip.visible ? `${strip.title} · ${strip.headline}` : "",
      focusStationId: parked ? focus : "",
    },
  };
}

function stampYear(iso) {
  const s = String(iso || "").slice(0, 4);
  return /^\d{4}$/.test(s) ? s : "";
}

export function collectRequestFiles(employees = [], lang = "ar") {
  const ar = lang === "ar";
  const out = [];
  for (const employee of employees || []) {
    for (const request of employee.leaveRequests || []) {
      for (const file of request.files || []) {
        if (!isRealSupportingFile(file)) continue;
        const sat = String(file.kind || "") === "exam_sat";
        out.push({
          id: `${request.id}-${file.name}`,
          side: "in",
          name: file.name,
          kindAr: sat ? "إثبات أداء الامتحان" : "مستند أرفقته",
          kindEn: sat ? "Exam sitting proof" : "You attached",
          meta: ar
            ? `مع طلب: إجازة ${leaveKindMeta(request.type)?.ar || ""}`
            : `With leave: ${leaveKindMeta(request.type)?.en || ""}`,
          refTag: ar ? "بصمة الملف" : "File fingerprint",
          ref: file.hash || "—",
          href: "/verify",
          downloadUrl: file.url || file.file_url || "",
        });
      }
      if (isRealSupportingFile(request.examSatFile)) {
        const sat = request.examSatFile;
        out.push({
          id: `${request.id}-exam-sat`,
          side: "in",
          name: sat.name,
          kindAr: "إثبات أداء الامتحان",
          kindEn: "Exam sitting proof",
          meta: ar
            ? `مع طلب: إجازة ${leaveKindMeta(request.type)?.ar || ""} — المادة 115`
            : `With leave: ${leaveKindMeta(request.type)?.en || ""} — Art. 115`,
          refTag: ar ? "بصمة الملف" : "File fingerprint",
          ref: sat.hash || "—",
          href: "/verify",
          downloadUrl: sat.url || sat.file_url || "",
        });
      }
    }
    for (const request of employee.otherRequests || []) {
      if (request.type === "written_consent") {
        if (request.senderFile?.name) {
          out.push({
            id: `${request.id}-sender`,
            side: "out",
            name: request.senderFile.name,
            kindAr: "نموذج من الإدارة",
            kindEn: "Form from management",
            meta: ar ? (request.titleAr || "موافقة خطية") : (request.titleEn || "Written consent"),
            refTag: ar ? "بصمة الملف" : "File fingerprint",
            ref: request.senderFile.hash || "—",
            href: "/verify",
            downloadUrl: request.senderFile.url || "",
          });
        }
        if (request.paper?.name) {
          out.push({
            id: `${request.id}-paper`,
            side: "in",
            name: request.paper.name,
            kindAr: "النسخة الموقّعة",
            kindEn: "Signed copy",
            meta: ar ? (request.titleAr || "موافقة خطية") : (request.titleEn || "Written consent"),
            refTag: ar ? "بصمة الملف" : "File fingerprint",
            ref: request.paper.hash || "—",
            href: "/verify",
            downloadUrl: request.paper.url || "",
          });
        }
        if (request.seal?.signatureId || request.seal?.url) {
          out.push({
            id: `${request.id}-seal`,
            side: "out",
            name: request.seal.label || (ar ? "ختم الموافقة الخطية" : "Written-consent seal"),
            kindAr: "ختم موافقة خطية",
            kindEn: "Consent seal",
            meta: ar ? "خُتم في طلباتي" : "Sealed in My Requests",
            refTag: ar ? "رقم التحقق" : "Verify id",
            ref: request.seal.signatureId || "—",
            href: "/verify",
          });
        }
        continue;
      }
      if (request.type === STUDY_CONSENT_TYPE) {
        const raised = request.file || request.files?.[0] || request.senderFile;
        if (raised?.name) {
          out.push({
            id: `${request.id}-study-in`,
            side: "in",
            name: raised.name,
            kindAr: "مستند أرفقته",
            kindEn: "You attached",
            meta: ar ? `مع طلب: ${STUDY_CONSENT_LABEL_AR}` : `With: ${STUDY_CONSENT_LABEL_EN}`,
            refTag: ar ? "بصمة الملف" : "File fingerprint",
            ref: raised.hash || "—",
            href: "/verify",
            downloadUrl: raised.url || "",
          });
        }
        const issued = request.issuedFile || request.approvalFile;
        if (request.status === "approved" && issued?.name) {
          out.push({
            id: `${request.id}-study-out`,
            side: "out",
            name: issued.name,
            kindAr: "ملف الموافقة الدراسية",
            kindEn: "Study-consent letter",
            meta: ar ? `أصدرتها ${request.reviewedBy || request.approvedBy || "المنشأة"}` : `Issued by ${request.reviewedBy || request.approvedBy || "the establishment"}`,
            refTag: ar ? "تاريخ الإصدار" : "Issued at",
            ref: issued.at || request.approvedAt || "—",
            href: "/verify",
            downloadUrl: issued.url || "",
          });
        }
        continue;
      }
      if (request.type === NIGHT_FITNESS_TYPE) {
        const raised = request.file || request.files?.[0] || request.senderFile;
        if (raised?.name) {
          out.push({
            id: `${request.id}-fitness-in`,
            side: "in",
            name: raised.name,
            kindAr: "مستند أرفقته",
            kindEn: "You attached",
            meta: ar ? `مع طلب: ${NIGHT_FITNESS_LABEL_AR}` : `With: ${NIGHT_FITNESS_LABEL_EN}`,
            refTag: ar ? "بصمة الملف" : "File fingerprint",
            ref: raised.hash || "—",
            href: "/verify",
            downloadUrl: raised.url || "",
          });
        }
        const recorded = request.status === "approved"
          ? (employee.profile?.nightMedicalReport || raised)
          : null;
        if (recorded && (recorded.name || recorded.url)) {
          out.push({
            id: `${request.id}-fitness-file`,
            side: "out",
            name: recorded.name || raised?.name || (ar ? "تقرير اللياقة المسجّل" : "Recorded fitness report"),
            kindAr: "تقرير اللياقة المسجّل",
            kindEn: "Recorded fitness report",
            meta: ar ? `في ملف العامل · ${recorded.issuedAt || request.examDate || request.approvedAt || ""}` : `On the worker file · ${recorded.issuedAt || request.examDate || request.approvedAt || ""}`,
            refTag: ar ? "تاريخ الإصدار" : "Issued at",
            ref: recorded.issuedAt || recorded.at || request.approvedAt || "—",
            href: "/verify",
            downloadUrl: recorded.url || raised?.url || "",
          });
        }
        continue;
      }
      if (request.senderFile?.name) {
        out.push({
          id: `${request.id}-sender`,
          side: "out",
          name: request.senderFile.name,
          kindAr: "ملف للتوقيع",
          kindEn: "File to sign",
          meta: ar ? (request.title || otherRequestTypeLabel(request.type, true)) : (request.title || otherRequestTypeLabel(request.type, false)),
          refTag: ar ? "بصمة الملف" : "File fingerprint",
          ref: request.senderFile.hash || "—",
          href: "/verify",
          downloadUrl: request.senderFile.url || "",
        });
      }
      for (const file of request.files || []) {
        if (!file?.name) continue;
        if (request.senderFile?.name && file.name === request.senderFile.name) continue;
        out.push({
          id: `${request.id}-${file.name}`,
          side: "in",
          name: file.name,
          kindAr: "مستند أرفقته",
          kindEn: "You attached",
          meta: ar ? `مع طلب: ${request.title || otherRequestTypeLabel(request.type, true)}` : `With: ${request.title || otherRequestTypeLabel(request.type, false)}`,
          refTag: ar ? "بصمة الملف" : "File fingerprint",
          ref: file.hash || "—",
          href: "/verify",
        });
      }
      if (request.status === "approved" && ["salary_letter", "employment_letter", "document"].includes(request.type)) {
        const issuedFile = request.issuedFile || request.senderFile;
        const title = issuedFile?.name || request.title || (request.docKind
          ? (DOC_KINDS.find((row) => row.id === request.docKind)?.[ar ? "ar" : "en"] || otherRequestTypeLabel(request.type, ar))
          : otherRequestTypeLabel(request.type, ar));
        out.push({
          id: `${request.id}-issued`,
          side: "out",
          name: title,
          kindAr: "وثيقة صدرت لك",
          kindEn: "Issued to you",
          meta: ar ? `أصدرتها ${request.reviewedBy || "الموارد البشرية"}` : `Issued by ${request.reviewedBy || "HR"}`,
          refTag: ar ? "رقم التحقق" : "Verify id",
          ref: request.verifyId || "—",
          href: "/verify",
          downloadUrl: issuedFile?.url || "",
        });
      }
    }
  }
  return out;
}

export function requestArchiveStatusLabel(status, ar = true) {
  if (status === "approved" || status === "yes") return ar ? "معتمد" : "Approved";
  if (status === "rejected" || status === "no" || status === "refused_by_employee") return ar ? "مرفوض" : "Rejected";
  if (status === "withdrawn") return ar ? "مسحوب" : "Withdrawn";
  if (status === "revise") return ar ? "أُعيد للتعديل" : "Returned";
  return ar ? "مستقرّ" : "Settled";
}

export function requestArchiveStatusKey(status) {
  if (status === "approved" || status === "yes") return "approved";
  if (status === "rejected" || status === "no" || status === "refused_by_employee") return "rejected";
  if (status === "withdrawn") return "withdrawn";
  return String(status || "");
}

export function requestArchiveStateId(status) {
  const key = requestArchiveStatusKey(status);
  if (key === "approved") return "settled";
  if (key === "rejected") return "blocked";
  if (key === "withdrawn") return "void";
  if (status === "revise") return "waiting";
  return "void";
}

export function requestAuditTrailRows(request, ar = true) {
  const source = request?.source || request;
  const trail = Array.isArray(source?.auditTrail) ? source.auditTrail.filter(Boolean) : [];
  const employee = request?.employee || source?.employee || { id: request?.employeeId, name: request?.employeeName };
  const family = request?.family || source?.family || (request?.kind === "leave" ? "leave" : "other");
  const events = trail.length
    ? trail
    : reconstructRequestAudit(source, employee, family);
  return events.map((event) => ({
    ...requestAuditFileLog({
      ...event,
      type: event.requestType || event.requestKind || source?.type || request?.type || event.type,
      verb: event.verb || event.type || event.action,
      performedBy: event.performedBy || event.actorName,
      reason: event.reason,
      article: event.article,
      decisionId: event.decisionId,
      at: event.at,
      action: event.action,
      requestId: event.requestId || source?.id || request?.requestId,
    }, ar),
    eventType: requestAuditEventType(event.verb || event.type || event.action),
  }));
}

function archiveDay(iso) {
  return String(iso || "").slice(0, 10);
}

function groupArchiveRows(rows = [], lang = "ar") {
  const ar = lang === "ar";
  const groups = [];
  for (const row of rows) {
    const year = row.year || stampYear(row.at) || (ar ? "بلا سنة" : "No year");
    let group = groups.find((item) => item.year === year);
    if (!group) {
      group = { year, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

export function collectRequestArchive(employees = [], lang = "ar") {
  const ar = lang === "ar";
  const rows = [];
  for (const row of flattenWorkspaceRows(employees, lang)) {
    if (isLiveInboxRequest(row) || !isEndedInboxRequest(row)) continue;
    const at = row.reviewedAt || row.answeredAt || row.withdrawnAt || row.createdAt;
    const cite = requestStatuteCite(row);
    const reason = row.status === "rejected"
      ? (row.reviewNote || row.rejectReason || row.reason)
      : (row.reason || row.purpose || row.reviewNote || row.attestation || "");
    const stationId = requestEmployeeStationId(row.employee);
    rows.push({
      id: `${row.family}-${row.id}`,
      kind: row.family === "leave" ? "leave" : "doc",
      title: row.title,
      meta: [row.employee?.name, reason].filter(Boolean).join(" · "),
      status: row.status,
      statusKey: requestArchiveStatusKey(row.status),
      statusLabel: requestArchiveStatusLabel(row.status, ar),
      at,
      year: stampYear(at),
      refTag: row.verifyId ? (ar ? "رقم التحقق" : "Verify id") : (row.files?.[0]?.hash ? (ar ? "بصمة المرفق" : "Attachment hash") : ""),
      ref: row.verifyId || row.files?.[0]?.hash || "—",
      employeeId: row.employee?.id || row.employeeId || "",
      employeeName: row.employee?.name || "",
      employee: row.employee,
      requestedById: row.requestedById || "",
      reviewedBy: row.reviewedBy || row.answeredBy || row.acknowledgedBy || "",
      reason: reason || "",
      auditTrail: Array.isArray(row.auditTrail) ? row.auditTrail : [],
      stationId,
      requestId: row.id,
      family: row.family,
      type: row.type,
      startDate: row.startDate || "",
      article: cite.article,
      decisionId: cite.decisionId,
      productOnly: cite.productOnly,
      withdrawOpen: isLeaveInboxRow(row) && row.status === "approved" && approvedLeaveWithdrawWindow(row).open,
      source: row,
    });
  }
  for (const row of flattenWrittenConsents(employees)) {
    if (row.status === "open") continue;
    const at = row.answeredAt || row.createdAt;
    const cite = requestStatuteCite(row);
    rows.push({
      id: `consent-${row.id}`,
      kind: "consent",
      title: ar ? row.titleAr : row.titleEn,
      meta: [row.employee?.name, row.requestedBy, row.reply].filter(Boolean).join(" · "),
      status: row.status,
      statusKey: requestArchiveStatusKey(row.status),
      statusLabel: requestArchiveStatusLabel(row.status, ar),
      at,
      year: stampYear(at),
      refTag: row.seal?.signatureId ? (ar ? "رقم التحقق" : "Verify id") : "",
      ref: row.seal?.signatureId || "—",
      employeeId: row.employee?.id || row.employeeId || "",
      employeeName: row.employee?.name || "",
      employee: row.employee,
      requestedById: row.requestedById || "",
      reviewedBy: row.answeredBy || row.requestedBy || "",
      reason: row.reply || "",
      auditTrail: Array.isArray(row.auditTrail) ? row.auditTrail : [],
      stationId: requestEmployeeStationId(row.employee),
      requestId: row.id,
      family: "other",
      type: row.type || "written_consent",
      article: cite.article,
      decisionId: cite.decisionId,
      productOnly: cite.productOnly,
      source: row,
    });
  }
  rows.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  return { rows, groups: groupArchiveRows(rows, lang) };
}

export function requestArchiveSearchHay(row, stations = []) {
  const trail = Array.isArray(row?.auditTrail) ? row.auditTrail : [];
  const trailText = trail.map((event) => [event.performedBy, event.actorName, event.reason, event.action, event.details, event.article, event.decisionId].filter(Boolean).join(" ")).join(" ");
  const day = archiveDay(row?.at);
  const leave = row?.kind === "leave" || row?.family === "leave";
  return [
    row?.title,
    row?.employeeName,
    row?.employee?.name,
    row?.type,
    row?.family,
    row?.kind,
    leave ? leaveTypeLabel(row?.type, true, undefined, row?.startDate || row?.from) : otherRequestTypeLabel(row?.type, true),
    leave ? leaveTypeLabel(row?.type, false, undefined, row?.startDate || row?.from) : otherRequestTypeLabel(row?.type, false),
    row?.status,
    row?.statusKey,
    row?.statusLabel,
    row?.status === "approved" || row?.status === "yes" ? "معتمد اعتُمد approved" : "",
    row?.status === "rejected" || row?.status === "no" ? "مرفوض رُفض rejected" : "",
    row?.status === "withdrawn" ? "مسحوب سُحب withdrawn" : "",
    row?.reviewedBy,
    row?.reason,
    row?.meta,
    row?.article,
    row?.decisionId,
    row?.article ? `المادة ${row.article}` : "",
    row?.decisionId ? `قرار ${row.decisionId}` : "",
    row?.at,
    day,
    day ? formatArDate(day, "ar") : "",
    day ? formatArDate(day, "en") : "",
    employeeStationName(row?.employee, stations),
    trailText,
  ].filter(Boolean).join(" ");
}

/** Same item shape المهام / إثبات العمل pass to RecordSmartArchive. */
export function requestArchiveSmartItems(rows = [], extras = {}) {
  const lang = extras.lang === "en" ? "en" : "ar";
  const stations = extras.stations || [];
  const hideName = !!extras.hideEmployeeName;
  return (rows || []).map((row) => ({
    id: row.id,
    title: row.title,
    text: [
      hideName ? "" : row.employeeName,
      row.reviewedBy,
      row.reason,
      employeeStationName(row.employee, stations),
      formatArDate(archiveDay(row.at), lang),
    ].filter(Boolean).join(" · "),
    date: row.at || row.source?.createdAt || row.createdAt,
    badge: row.statusLabel,
    stateId: requestArchiveStateId(row.status),
    search: requestArchiveSearchHay(row, stations),
    row,
  }));
}

/** Settled archive only — pending never enters. Named empty/blocked, no fake hits. */
export function filterRequestArchive({
  rows = [],
  stations = [],
  query = "",
  status = "all",
  stationId = "all",
  from = "",
  to = "",
  viewer = null,
  lane = "",
  lang = "ar",
} = {}) {
  const ar = lang === "ar";
  let pool = Array.isArray(rows) ? rows.filter((row) => !isPendingDecideStatus(row.status) && row.status !== "open") : [];
  if (lane === "mine" && viewer) {
    pool = pool.filter((row) => isOwnMineLaneRow({
      ...row,
      employee: row.employee || { id: row.employeeId },
      employeeId: row.employeeId,
      requestedById: row.requestedById,
    }, viewer));
  }
  const sid = String(stationId || "all");
  if (sid && sid !== "all") {
    pool = pool.filter((row) => String(row.stationId || requestEmployeeStationId(row.employee)) === sid);
  }
  if (status === "approved") pool = pool.filter((row) => requestArchiveStatusKey(row.status) === "approved");
  if (status === "rejected") pool = pool.filter((row) => requestArchiveStatusKey(row.status) === "rejected");
  if (status === "withdrawn") pool = pool.filter((row) => requestArchiveStatusKey(row.status) === "withdrawn");
  const fromDay = archiveDay(from);
  const toDay = archiveDay(to);
  if (fromDay) pool = pool.filter((row) => archiveDay(row.at) && archiveDay(row.at) >= fromDay);
  if (toDay) pool = pool.filter((row) => archiveDay(row.at) && archiveDay(row.at) <= toDay);

  const q = String(query || "").trim();
  if (!pool.length && !q) {
    return {
      ok: false,
      error: sid && sid !== "all" ? "NO_STATION_ARCHIVE" : "EMPTY_ARCHIVE",
      reason: sid && sid !== "all"
        ? (ar ? "لا بند مستقرّ في هذا الفرع." : "No settled item on this branch.")
        : (ar ? "لا بنود مستقرّة بعد. ما يُعتمد أو يُرفض أو يُسحب ينتقل إلى الأرشيف." : "Nothing has settled yet. Approved, refused, or withdrawn moves here."),
      reasonEn: sid && sid !== "all" ? "No settled item on this branch." : "Nothing has settled yet. Approved, refused, or withdrawn moves here.",
      rows: [],
      groups: [],
    };
  }
  const hits = pool.filter((row) => peopleQueryMatches(requestArchiveSearchHay(row, stations), q));
  if (!hits.length) {
    return {
      ok: false,
      error: "NO_MATCH",
      reason: q
        ? (ar ? `لا بند مؤرشف يطابق «${q}».` : `No archived item matches “${q}”.`)
        : (ar ? "لا بند مؤرشف يطابق التصفية." : "No archived item matches this filter."),
      reasonEn: q ? `No archived item matches “${q}”.` : "No archived item matches this filter.",
      rows: [],
      groups: [],
    };
  }
  return { ok: true, rows: hits, groups: groupArchiveRows(hits, lang) };
}

export function mineArchiveRows(employees = [], viewer, lang = "ar") {
  const packed = collectRequestArchive(employees, lang);
  return filterRequestArchive({ rows: packed.rows, viewer, lane: "mine", lang });
}

export function manageArchiveRows(employees = [], lang = "ar", extras = {}) {
  const packed = collectRequestArchive(employees, lang);
  return filterRequestArchive({
    rows: packed.rows,
    stations: extras.stations || [],
    query: extras.query || "",
    status: extras.status || "all",
    stationId: extras.stationId || extras.focusStationId || "all",
    from: extras.from || "",
    to: extras.to || "",
    lang,
  });
}

export function requestNoticeHref(text) {
  const value = String(text || "");
  if (isInventoryDeskNotice(value)) return "/app/inventory";
  if (/طلبك|إجازتك|وثيقتك|اعتُمدت إجازتك|سُحبت إجازتك|رُفض طلبك|مستحق في طلباتي|سارية في طلباتي/i.test(value)) {
    return "/app/requests";
  }
  if (/بانتظار مراجعتك|needs your review/i.test(value)) return "/app/requests/manage";
  if (/بشأن:/.test(value) && /بانتظار|pending|awaiting|معلّق/i.test(value)) return "/app/requests/manage";
  if (/—\s*موافقة ليلية سارية|مستحق موافقة خطية ليلية|سحب موافقته الخطية/.test(value)) return "/app/requests/manage";
  const pendingLeave = /بانتظار|معلّق|pending|يحتاج تعديلاً|awaiting/i.test(value)
    && /إجازة|leave/i.test(value);
  if (/تقويم|calendar/i.test(value) && !pendingLeave) return "/app/calendar";
  return "/app/requests";
}

/** Manager / coworker duty — not the viewer's own pending or own 18632 due. */
export function isCoworkerDutyInboxNotice(text) {
  const value = String(text || "");
  if (requestNoticeHref(value) === "/app/requests/manage") return true;
  if (/—\s*موافقة ليلية سارية|مستحق موافقة خطية ليلية|سحب موافقته الخطية/.test(value)) return true;
  return false;
}

/** Pending / notice totals on badges — never a hard-coded figure. */
export function derivedAlertCount(n) {
  return Math.max(0, Number(n) || 0);
}

/** Do not reprint a notice body that already is the head (or its prefix). */
export function inboxNoticeShowsBody(row) {
  const head = String(row?.head || "").trim();
  const body = String(row?.body || "").trim();
  if (!body) return false;
  if (!head) return true;
  if (body === head) return false;
  if (body.startsWith(head)) return false;
  return true;
}

export function collectRequestInbox(employees = [], notifications = [], userId, lang = "ar", options = {}) {
  const ownOnly = !!options.ownOnly;
  const viewer = options.viewer || userId;
  const ar = lang === "ar";
  const items = [];
  for (const row of flattenWorkspaceRows(employees, lang)) {
    const mine = isOwnMineLaneRow(row, viewer);
    if (ownOnly && !mine) continue;
    if (!isLiveInboxRequest(row, { lane: ownOnly || mine ? "mine" : "manage" })) continue;
    const pending = isPendingDecideStatus(row.status);
    if (pending) {
      const isDoc = ["salary_letter", "employment_letter", "document"].includes(row.type);
      const mine = isOwnMineLaneRow(row, viewer);
      const who = row.employee?.name || "";
      items.push({
        id: `row-${row.id}`,
        at: row.createdAt || row.reviewedAt,
        color: "#8a6516",
        head: mine
          ? (ar
            ? (isDoc ? `وثيقتك بانتظار القرار: ${row.title}` : `طلبك بانتظار القرار: ${row.title}`)
            : (isDoc ? `Your letter is awaiting a decision: ${row.title}` : `Awaiting a decision: ${row.title}`))
          : (ar
            ? `${requestRegardingLine({ name: who, stationName: employeeStationName(row.employee, options.stations), lang })} — ${row.title} بانتظار القرار`
            : `${requestRegardingLine({ name: who, stationName: employeeStationName(row.employee, options.stations), lang })} — ${row.title} awaiting a decision`),
        body: mine
          ? (ar
            ? (isDoc ? "الاعتماد يصدر النسخة إلى ملفات طلباتي." : "يبقى معلّقاً في طلباتي حتى يبتّ المسؤول.")
            : (isDoc ? "Approval issues the copy into My Requests files." : "It stays open in My Requests until a manager decides."))
          : (ar ? "يظهر في إدارة حتى تبتّ." : "It sits in Manage until you decide."),
        href: mine ? "/app/requests" : "/app/requests/manage",
        linkLabel: mine ? (ar ? "افتح طلباتي" : "Open My Requests") : (ar ? "افتح الإدارة" : "Open Manage"),
      });
      continue;
    }
    const isDoc = ["salary_letter", "employment_letter", "document"].includes(row.type);
    const ok = row.status === "approved";
    const withdrawn = row.status === "withdrawn";
    items.push({
      id: `row-${row.id}`,
      at: row.reviewedAt || row.createdAt,
      color: ok ? "#137a49" : row.status === "revise" ? "#8a6516" : withdrawn ? "#4b5567" : "#8a1c2b",
      head: ok
        ? (isDoc ? (ar ? `صدرت وثيقتك: ${row.title}` : `Your letter was issued: ${row.title}`) : (ar ? `اعتُمد طلبك: ${row.title}` : `Approved: ${row.title}`))
        : row.status === "revise"
          ? (ar ? `طلبك يحتاج تعديلاً: ${row.title}` : `Needs a change: ${row.title}`)
          : withdrawn
            ? (ar ? `سُحب طلبك: ${row.title}` : `Withdrawn: ${row.title}`)
          : (ar ? `رُفض طلبك: ${row.title}` : `Rejected: ${row.title}`),
      body: ok
        ? (isDoc
          ? (ar ? `برقم تحقق ${row.verifyId || "—"}. النسخة في ملفات طلباتي.` : `Verify ${row.verifyId || "—"}. The copy sits in My Requests files.`)
          : row.family === "leave"
            ? `${leaveApprovalBlessing(row.type, lang)} ${ar ? "تظهر أيامها في التقويم التشغيلي وجدول الدوام." : "The days appear on the operational calendar and the week roster."}`
            : (ar ? "أُثبت في ملفك، ويظهر يومه في جدول الدوام والتقويم التشغيلي." : "It is on your file, and the day appears on the roster and calendar."))
        : row.status === "rejected"
          ? (row.reviewNote || row.rejectReason
            ? (ar
              ? `رفض ${row.reviewedBy || "الإدارة"}: ${row.reviewNote || row.rejectReason}`
              : `${row.reviewedBy || "Management"} refused: ${row.reviewNote || row.rejectReason}`)
            : (ar ? "لا أثر على رصيدك ولا على الجدول." : "No effect on your balance or the roster."))
        : (row.reviewNote || (ar ? "لا أثر على رصيدك ولا على الجدول." : "No effect on your balance or the roster.")),
      href: ok ? (isDoc ? (row.verifyId ? "/verify" : "/app/requests") : "/app/calendar") : "/app/requests",
      linkLabel: ok ? (isDoc ? (ar ? "تحقّق من الوثيقة" : "Verify the letter") : (ar ? "اعرض اليوم في التقويم" : "See the day on the calendar")) : "",
      downloadUrl: ok && isDoc ? (row.issuedFile?.url || row.senderFile?.url || "") : "",
    });
  }
  for (const row of flattenWrittenConsents(employees)) {
    if (!isOwnMineLaneRow({ ...row, employee: row.employee || { id: row.employeeId } }, viewer) && (ownOnly || String(row.requestedById || "") !== String(userId || viewerEmployeeId(asViewer(viewer)) || ""))) continue;
    if (row.status === "open") {
      const mine = isOwnMineLaneRow({ ...row, employee: row.employee || { id: row.employeeId } }, viewer);
      items.push({
        id: `consent-open-${row.id}`,
        at: row.createdAt,
        color: "#8a6516",
        head: ar
          ? (mine ? `موافقة خطية بانتظارك: ${row.titleAr || ""}` : `موافقة خطية معلّقة: ${row.titleAr || ""}`)
          : (mine ? `Written consent waiting for you: ${row.titleEn || ""}` : `Open written consent: ${row.titleEn || ""}`),
        body: mine
          ? (ar ? "اكتب الموافقة، وقّع الملف، ثم ارفع النسخة من طلباتي." : "Write the consent, sign the file, then upload the copy from My Requests.")
          : (ar ? `${row.employee?.name || ""} لم يرد بعد.` : `${row.employee?.name || ""} has not replied yet.`),
        href: "/app/requests",
        linkLabel: ar ? "افتح طلباتي" : "Open My Requests",
      });
      continue;
    }
  }
  for (const note of notifications || []) {
    if (note.read) continue;
    if (note.userId && note.userId !== userId) continue;
    const stored = String(note.text || "");
    if (!isRequestWorkspaceNotice(stored) && !note.leaveDecision) continue;
    if (ownOnly && isCoworkerDutyInboxNotice(stored)) continue;
    const text = formatNotificationText(note, lang);
    items.push({
      id: note.id || `ntf-${note.createdAt}`,
      at: note.createdAt,
      color: "#14213d",
      head: text.slice(0, 72),
      body: text,
      href: requestNoticeHref(stored || text),
      linkLabel: ar ? "افتح الموضع" : "Open the place",
    });
  }
  const seen = new Set();
  return items
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    .filter((row) => {
      const key = `${row.head}|${row.at}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

export { buildRequestAudit, buildRequestRefuseAudit, checkRefuseRequestReasonGate, collectRequestAuditLogs, collectRequestRefuseLogs, hasRequestRefuseAudit, requestAuditFileLog };
