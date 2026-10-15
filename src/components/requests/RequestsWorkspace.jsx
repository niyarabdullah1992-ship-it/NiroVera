import React, { useEffect, useMemo, useRef, useState } from "react";
import { hoursPolicyOf } from "@/lib/laborHoursPolicy";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import { setStationScope } from "@/lib/stationScopeStore";
import { postponeResignation, recordIddahBirth, recordMaternityBirth, recordLeaveBreach, setHajjAnnualQuota, answerNightRotate, answerOtAssignment, attachExamSatProof, attachWrittenConsentPaper, creditEmployeeLeaveBalance, grantDiscretionaryDays, markLeaveDecisionSeen, openDueNightRotateCycles, remindNightDue, setLeaveRequestStatus, setOtherRequestStatus, submitLeaveRequest, submitOtherRequest, submitOtAssignment, withdrawNightRotate } from "@/lib/store";
import { approvedLeaveWithdrawWindow, chargeableLeaveDays, checkApproveLeaveGate, checkExamSittingSettleGate, checkLeaveGenderGate, checkRejectLeaveGate, checkSubmitLeaveGate, examNoticeFilesOf, examSatFileOf, examSatState, hasLeaveAttachment, isRealSupportingFile, leaveNeedsAttachment, leaveNeedsArticle118Ack, leaveSpanIncludesOfficialHolidays, hajjAnnualQuotaOf, sickLeaveEndingBefore } from "@/lib/leaveDerivations";
import { usedLeaveDays } from "@/lib/leaveTypes";
import { weeklyOffDaysInRange, weeklyOffLabels } from "@/lib/leaveEidOverlap.js";
import {
  checkApproveOtherRequestGate,
  checkApproveStudyConsentGate,
  checkExamStudyConsentGate,
  checkLeaveTopupDaysGate,
  checkRefuseRequestReasonGate,
  checkRejectNightFitnessGate,
  checkRejectStudyConsentGate,
  checkRevokeStudyConsentGate,
  checkSubmitOtherRequestGate,
  hasIrrevocableStudyConsent,
  LEAVE_TOPUP_MAX_DAYS,
  LEAVE_TOPUP_TYPE,
  NIGHT_FITNESS_FILE_REQUIRED_AR,
  NIGHT_FITNESS_FILE_REQUIRED_EN,
  NIGHT_FITNESS_FROM_AR,
  NIGHT_FITNESS_FROM_EN,
  NIGHT_FITNESS_LABEL_AR,
  NIGHT_FITNESS_LABEL_EN,
  NIGHT_FITNESS_PERMANENT_AR,
  NIGHT_FITNESS_PERMANENT_EN,
  NIGHT_FITNESS_RANGE_AR,
  NIGHT_FITNESS_RANGE_EN,
  NIGHT_FITNESS_RECORD_ONLY_AR,
  NIGHT_FITNESS_RECORD_ONLY_EN,
  NIGHT_FITNESS_SUBTITLE_AR,
  NIGHT_FITNESS_SUBTITLE_EN,
  NIGHT_FITNESS_TO_AR,
  NIGHT_FITNESS_TO_EN,
  NIGHT_FITNESS_TYPE,
  STUDY_CONSENT_IRREVOCABLE_AR,
  STUDY_CONSENT_IRREVOCABLE_EN,
  STUDY_CONSENT_LABEL_AR,
  STUDY_CONSENT_LABEL_EN,
  STUDY_CONSENT_SUBTITLE_AR,
  STUDY_CONSENT_SUBTITLE_EN,
  STUDY_CONSENT_TYPE,
  nightFitnessEmployeeFileOf,
  studyConsentApprovalFileOf,
  studyConsentEmployeeFileOf,
  studyConsentState,
} from "@/lib/otherRequestDerivations";
import { nightMedicalReportOf } from "@/lib/decision18632";
import { nightWorkRequestRights, nightWorkRightById } from "@/lib/nightWorkRights";
import NightWorkRightsTable, { NightWorkDefinition } from "@/components/shared/NightWorkRightsTable";
import LawGateAlertRow from "@/components/shared/LawGateAlertRow";
import LawGateStatusPill, { LawGateArticleBadge } from "@/components/shared/LawGateStatusPill";
import { ruleValue } from "@/lib/laborRules";
import {
  ARTICLE_106_GROUNDS,
  checkEmployeeAcceptOtGate,
  checkRaiseOtAssignmentGate,
  checkRefuseOtAssignmentGate,
  isArticle106Assignment,
  isOvertimeAssignment,
  otCreditDays,
} from "@/lib/overtimeAssignment";
import { nightRotateStage } from "@/lib/nightRotateCycle";
import { ownPendingAwaitingNote, requestMayDecideOnLane } from "@/lib/dutyScope";
import { requestSelfEmployee, viewerEmployeeId } from "@/lib/employeeFileView";
import { CONSENT_MINISTRY_HINT_AR, CONSENT_MINISTRY_HINT_EN, hashConsentFile, nightWrittenConsentGlow, readConsentFile } from "@/lib/writtenConsent";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import { refreshUnpaidLeaveWage } from "@/lib/deductionGenerators";
import { employeeRosterOtContext, employeeShiftOnDay, isWeekDayPublished, weekStartDate } from "@/lib/shiftWeek";
import { maxStatutoryGlow, statutoryGlowState } from "@/lib/statutoryItem";
import { toast } from "@/components/ui/use-toast";
import {
  annualRemainingWithGrants,
  balanceRows,
  countAr,
  DISCRETIONARY_GRANT_CAP,
  DOC_KINDS,
  formatArDate,
  grantDaysOf,
  lawArticleCards,
  leaveKindMeta,
  leaveKindsFor,
  officialHolidays,
  rangeDates,
  remainingAnnualLabel,
  requestStatuteCite,
  REQUEST_KINDS,
  composeRequestKinds,
  isManageRaiseKind,
  composeAdminLeaveCreditGates,
  composeStudyConsentRaiseGates,
  uniqueNamedGates,
  todayRiyadh,
  flattenWorkspaceRows,
  liveInboxRows,
  managerPendingInbox,
  managerEmployeeRegister,
  managerPersonEmptyReason,
  firstPendingRegisterPerson,
  mineInboxRows,
  mineArchiveRows,
  manageArchiveRows,
  isOwnMineLaneRow,
  requestRegardingLine,
  employeeStationName,
  isAllowedSupportingFile,
  isPendingDecideStatus,
  isUnseenApprovedLeave,
  readSupportingFile,
  requestAuditTrailRows,
  LEAVE_CREDIT_POOLS,
  SUPPORTING_FILE_ACCEPT,
  SUPPORTING_FILE_MAX_BYTES,
} from "@/lib/requestWorkspace";
import { isRosterLockedCivicHoliday, laborCalendarOf, officialHolidayKindLabel, officialHolidayLeaveLabel } from "@/lib/ummAlQuraCalendar";
import { annualAdvanceCap, annualCarryAlerts, iddahSpanFromEvent, maternityFollowOnSpan, therapyLeaveEligibility, unpaidSuspensionPlan } from "@/lib/leaveTypes";
import { isRamadanHoursSubject, religionOnFile } from "@/lib/laborRules";
import { profileGender } from "@/lib/employeeProfileFields";
import { DUTY_REQUEST_META, DUTY_REQUEST_TYPES, checkDutyRequestFields, nursingRightUntil, dutyRequestDetail, dutyRequestEffect, dutyRequestRosterFacts, isDutyRequestType } from "@/lib/dutyRequests";
import { performsNightWork, pregnancyNightBan } from "@/lib/decision18632";
import { checkResignationFields, checkPostponeResignationGate, EXIT_ROUTE_NOTICE75, resignationDetail, resignationFacts, resignationRouteFor, resignationState, RESIGNATION_TYPE } from "@/lib/exitRequests";
import { sunExposureMark } from "@/lib/shiftWeek";
import { fileDutyHref, rosterPersonHref } from "@/components/schedules/dutyLinks";
import { leaveApprovalCardNote } from "@/lib/leaveEntitlementCycle";
import { BORDER, CARD, CONTROL_RADIUS, MUTED, NAVY, PAPER_SHADOW, PILL_RADIUS, RADIUS, SURFACE } from "@/lib/platformStyles";
import { REQUESTS_LAW_FOOT_AR, REQUESTS_LAW_FOOT_EN, REQUESTS_LAW_LEDE_AR, REQUESTS_LAW_LEDE_EN } from "@/lib/platformJudgment";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import StatutoryItem from "@/components/labor/StatutoryItem";
import WrittenConsentInbox from "@/components/requests/WrittenConsentInbox";
import WrittenConsentRaise from "@/components/requests/WrittenConsentRaise";
import RightsRequestRaise from "@/components/requests/RightsRequestRaise";
import { employerNoticeOf, jobSearchHoursInWeek } from "@/lib/rightsRequests";
import { otAssignmentLine, otOffer, otOfferLines, sar as sarText, hoursAr } from "@/lib/otOffer";
import { compBalance, compDays } from "@/lib/compLeave";
import RequestArchiveBoard from "@/components/requests/RequestArchiveBoard";
import WorkInjuryPanel from "@/components/requests/WorkInjuryPanel";
import AnnualLeaveBreakdown from "@/components/requests/AnnualLeaveBreakdown";
import RequestsMinistryPanel from "@/components/requests/RequestsMinistryPanel";
import RequestFilesBoard from "@/components/requests/RequestFilesBoard";
import RequestInboxSlab from "@/components/requests/RequestInboxSlab";
import { checkRaiseSignableGate, isLetterSignableType } from "@/lib/requestSigning";
import RequestDecisionComposer from "@/components/requests/RequestDecisionComposer";
import { regulationDate } from "@/lib/workRegulation";
import { checkGroundedRefusalGate, refusalGroundsFor, refusalText, SERVICE_CERT_AR, SERVICE_CERT_EN } from "@/lib/statutoryRefusal";
import { attendanceOnDate, checkPunchRecordGate, parsePunchClock } from "@/lib/attendancePunch";
import PendingRequestFinder from "@/components/requests/PendingRequestFinder";
import ManagerEmployeeRegister from "@/components/requests/ManagerEmployeeRegister";
import RequestEmployeePicker from "@/components/requests/RequestEmployeePicker";
import RequestSelfSignBlock from "@/components/requests/RequestSelfSignBlock";
import PlatformDateField from "@/components/shared/PlatformDateField";
import AttachFileButton from "@/components/shared/AttachFileButton";
import { employeeWageSplit } from "@/lib/employeeFileView";
import { gosiHazardCoverage, gosiInjuryWageMode, injuryStatus } from "@/lib/workInjury";

const NAVY_FILL = "var(--nv-navy)";
const OK = "var(--nv-ok-ink)";
const WARN = "var(--nv-warn-ink)";
const BAD = "var(--nv-bad-ink)";

/** إدارة tiles — what management may file for a worker, each with its basis. */
const MANAGE_KIND_HINTS = {
  leave: { ar: "تسجيل إجازة نيابة عن الموظف", en: "Record leave for a worker", hintAr: "اضطرارية أو إصابة عمل — بمستند مؤيد", hintEn: "Emergency or work injury — with the supporting paper" },
  leave_credit: { ar: "زيادة رصيد إجازة", en: "Add leave balance", hintAr: "رصيد سنوي (م 109) أو أيام تقديرية", hintEn: "Annual (Art. 109) or discretionary days" },
  ot_assign: { ar: "تكليف بعمل إضافي", en: "Overtime assignment", hintAr: "م 107 · والإجباري م 106", hintEn: "Art. 107 · mandatory Art. 106" },
  permission: { ar: "تسجيل استئذان", en: "Record a permission", hintAr: "يُقيَّد معتمداً — لا يُحتسب تأخيراً", hintEn: "Recorded approved — not lateness" },
  nursing_hour: { ar: "تسجيل ساعة الرضاعة", en: "Record a nursing hour", hintAr: "م 154 · للعاملة المرضع", hintEn: "Art. 154 · nursing worker" },
  pregnancy_notice: { ar: "تسجيل إبلاغ حمل", en: "Record a pregnancy notice", hintAr: "قرار 18632 · من تقرير ورقي", hintEn: "Decision 18632 · from a paper report" },
  other: { ar: "طلب آخر", en: "Other request", hintAr: "يُوصف في السبب", hintEn: "Described in the reason" },
};

const MINE_TILES = [
  { id: "leave", ar: "إجازة", en: "Leave", hintAr: "م 109 · السنوية والمرضية ورفع الرصيد", hintEn: "Art. 109 · annual, sick, and a balance top-up", letter: "إ" },
  { id: "study_consent", ar: "موافقة دراسية", en: "Study consent", hintAr: "م 115 · للامتحان أو الانتظام", hintEn: "Art. 115 · an exam or enrolment", letter: "د" },
  { id: "night_fitness", ar: "طلبات العمل الليلي", en: "Night-work requests", hintAr: "قرار 18632 · اللياقة · التعويض · المسؤوليات العائلية", hintEn: "Decision 18632 · fitness · compensation · family duties", letter: "ل" },
  { id: "duty", ar: "طلبات الدوام", en: "Duty requests", hintAr: "استئذان · تغيير وردية · رضاعة · حمل · حظر الشمس", hintEn: "Permission · shift change · nursing · pregnancy · sun ban", letter: "ج" },
  { id: "manual", ar: "تسجيل حضور يدوي", en: "Manual punch", hintAr: "سلسلة الإثبات · حلقة بصمة مكسورة", hintEn: "Proof chain · a broken punch", letter: "ح" },
  { id: "outfix", ar: "تصحيح انصراف", en: "Checkout correction", hintAr: "سلسلة الإثبات · سجل لم يُغلق", hintEn: "Proof chain · a checkout left open", letter: "ص" },
  { id: "doc", ar: "وثيقة أو شهادة", en: "Document or letter", hintAr: "تعريف · شهادة خدمة م 64 · نسخة العقد م 51", hintEn: "Letter · service certificate (64) · contract copy (51)", letter: "و" },
  { id: "money", ar: "سلفة أو بدل", en: "Advance or allowance", hintAr: "م 92 · القسط لا يزيد على 10% من الأجر", hintEn: "Art. 92 · an instalment stays within 10% of the wage", letter: "ف" },
  { id: "custody", ar: "عهدة", en: "Custody", hintAr: "تسليم أو إرجاع", hintEn: "Hand over or return", letter: "ع" },
  { id: "resignation", ar: "تقديم استقالة", en: "Resignation", hintAr: "م 79 مكرر · لا تُرفض", hintEn: "Art. 79 bis · not refused", letter: "س" },
  { id: "rights", ar: "حقوق نظامية أخرى", en: "Other legal rights", hintAr: "م 64 · 81 · 91 · 110 · قرار 18632 — الوثائق، ترك العمل، خصم الإتلاف، تأجيل الإجازة، تجنب الليل", hintEn: "Arts. 64 · 81 · 91 · 110 · decision 18632", letter: "ح" },
  { id: "other", ar: "طلب آخر", en: "Other request", hintAr: "يُوصف في السبب", hintEn: "Described in the reason", letter: "آ" },
];

function mineStatusBucket(row) {
  const st = row?.status || "pending";
  if (st === "rejected" || st === "refused_by_employee" || st === "no") return "rejected";
  if (st === "approved") return "approved";
  return "pending";
}

/** Same rows the «بانتظار» list shows. A lapsed night consent stays in الكل والأرشيف. */
function isMinePendingListRow(row, viewer) {
  const st = row?.status || "pending";
  if (mineStatusBucket(row) !== "pending" && !isUnseenApprovedLeave(row)) return false;
  if (isPendingDecideStatus(st)) return true;
  if (isUnseenApprovedLeave(row)) return true;
  if ((row?.type === STUDY_CONSENT_TYPE || row?.type === NIGHT_FITNESS_TYPE) && st === "approved") return true;
  return row?.type === "night_consent"
    && nightRotateStage(row) === "agreed_month"
    && isOwnMineLaneRow(row, viewer);
}

function requestPathIndex(status) {
  const st = String(status || "pending");
  if (st === "withdrawn") return { at: 0, done: 0, rejected: false };
  if (st === "approved" || st === "yes" || st === "rejected" || st === "no" || st === "refused_by_employee") {
    return { at: 2, done: 3, rejected: st === "rejected" || st === "no" || st === "refused_by_employee" };
  }
  return { at: 1, done: 1, rejected: false };
}

/** Manager-facing panel on a «طلبات الدوام» card: what approval does, what the roster already says, where to look. */
function DutyRequestDecisionPanel({ row, data, ar }) {
  const employee = row.employee || {};
  const schedule = (data?.schedules || []).find((item) => String(item.stationId) === String(employee.stationId)) || null;
  const nightDays = [];
  let sunMark = "";
  if (row.type === "pregnancy_notice" && row.dueDate && schedule) {
    const probe = { profile: { ...(employee.profile || {}), pregnant: true, expectedBirthDate: row.dueDate } };
    const start = new Date();
    for (let i = 0; i < 200 && nightDays.length < 6; i += 1) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      if (key > row.dueDate) break;
      const shift = employeeShiftOnDay(schedule, employee.id, key);
      if (shift && performsNightWork(shift, key) && pregnancyNightBan(probe, key).ban) nightDays.push(key);
    }
  }
  if (row.type === "heat_report" && row.date && schedule) {
    sunMark = sunExposureMark(schedule, employee.id, row.date, employeeShiftOnDay(schedule, employee.id, row.date))?.mark || "";
  }
  const facts = dutyRequestRosterFacts({ row, schedule, ar, nightDays, sunMark });
  const toneColor = { ok: OK, warn: WARN, bad: BAD };
  const week = row.date || row.dueDate || "";
  return (
    <div data-duty-decision={row.type} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-soft, #F7F9F8)", fontSize: 11.5, lineHeight: 1.75 }}>
      <span style={{ color: "var(--nv-ink2)" }}>{dutyRequestEffect(row.type, ar)}</span>
      {facts.map((fact) => (
        <span key={fact.text} style={{ color: toneColor[fact.tone] || MUTED, fontWeight: 600 }}>{fact.text}</span>
      ))}
      {employee.id ? (
        <span style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link to={rosterPersonHref(employee.id, week)} style={{ color: OK, fontWeight: 700, textDecoration: "none" }}>{ar ? "افتح الأسبوع في جدول الدوام ›" : "Open the week on the roster ›"}</Link>
          <Link to={fileDutyHref(employee.id, { day: row.date || "" })} style={{ color: OK, fontWeight: 700, textDecoration: "none" }}>{ar ? "ملف الدوام ›" : "Duty file ›"}</Link>
        </span>
      ) : null}
    </div>
  );
}

/** إدارة: raising for a worker is the exception — folded under the decision list. ملفي: the form stays open. */
function RaiseFold({ manage, ar, children }) {
  if (!manage) return <div className="nv-req-raise" style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>;
  return (
    <section className="nv-req-raise nv-req-manage-raise" data-manage-raise="1" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 2px" }}>
        <span aria-hidden style={{ width: 14, height: 2, background: "#C8A45A", borderRadius: 2 }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{ar ? "طلبات من الإدارة" : "Requests from management"}</strong>
          <span style={{ fontSize: 11.5, color: MUTED }}>{ar ? "ما ترفعه الإدارة باسم الموظف — يُقيَّد باسمك في ملفه وسجل التدقيق." : "What management files for a worker — recorded in your name on the file and the audit trail."}</span>
        </span>
      </div>
      {children}
    </section>
  );
}

/** The number both sides see for a request — never the internal key. */
function requestPublicRef(row) {
  const year = String(row?.createdAt || row?.startDate || row?.date || "").slice(0, 4) || String(new Date().getFullYear());
  const tail = String(row?.id || "").replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase() || "000000";
  return `NV-${year}-${tail}`;
}

function requestDecisionEffect(row, ar) {
  if (row?.type === RESIGNATION_TYPE) return ar ? "مقبولة بعد 30 يوماً دون رد · م 79 مكرر" : "Accepted after 30 days without a reply · Art. 79 bis";
  if (isDutyRequestType(row?.type)) {
    return {
      permission: ar ? "لا يُحتسب تأخيراً" : "Not counted as lateness",
      shift_change: ar ? "يتغيّر الجدول" : "The roster changes",
      nursing_hour: ar ? "ساعة عمل فعلية · م 154" : "Counted as work · Art. 154",
      pregnancy_notice: ar ? "لا ليل قبل الوضع · 18632" : "No night before birth · 18632",
      heat_report: ar ? "نقل إلى مظلّل · 3337" : "Moved to shade · 3337",
      family_duties: ar ? "يُراعى ليلاً · 18632" : "Considered at night · 18632",
    }[row.type];
  }
  const title = `${row?.title || ""} ${row?.type || ""}`;
  if (/سلفة|بدل|advance|allowance/.test(title) || row?.type === "advance" || row?.type === "loan") {
    return ar ? "صرف أو رفض بسبب · القسط ≤ 10% · م 92" : "Pay or refuse with a reason · instalment ≤ 10% · Art. 92";
  }
  if (row?.type === "art81_exit") return ar ? "ينتهي العقد بالبلاغ · م 81" : "Contract ends on notice · Art. 81";
  if (row?.type === "damage_objection") return ar ? "قبول يرد المبلغ · وإلا المحكمة العمالية · م 91" : "Accept refunds · else labour court · Art. 91";
  if (row?.type === "grievance") {
    const by = row.grievanceReplyBy ? regulationDate(row.grievanceReplyBy) : "";
    return ar ? `بُتّ كتابةً${by ? ` حتى ${by}` : " خلال 15 يوماً"} · اللائحة م71` : `Decide in writing${row.grievanceReplyBy ? ` by ${row.grievanceReplyBy}` : " within 15 days"} · Regs Art. 71`;
  }
  if (row?.type === "night_avoid") return ar ? "عمل نهاري مماثل أو 6 ساعات بالأجر نفسه · 18632" : "Similar day work or 6 h, same pay · 18632";
  if (row?.type === "documents_return") return ar ? "تُعاد ولا تُرفض · م 64" : "Returned, not refused · Art. 64";
  if (row?.type === "leave_carry") return ar ? "بموافقة صاحب العمل · م 110" : "With the employer's agreement · Art. 110";
  if (row?.docKind === "contract") return ar ? "نسخة لك لا تُرفض · م 51" : "Your copy, not refused · Art. 51";
  if (row?.family === "doc" || /وثيقة|شهادة|تعريف/.test(title)) return ar ? "يصدر في ملفك" : "Issued on your file";
  if (row?.type === "manual_punch" || row?.type === "checkout_fix" || /حضور|انصراف|بصمة/.test(title)) {
    return ar ? "قبل إقفال المسير" : "Before payroll closes";
  }
  if (row?.type === "sick" || /مرضية/.test(title)) return ar ? "بالتقرير · م 117" : "With the report · Art. 117";
  if (row?.family === "leave" || /إجازة/.test(title)) return ar ? "يُحسم من الرصيد" : "Taken from the balance";
  return ar ? "بقرار مكتوب" : "A written decision";
}

function RequestDecisionPath({ status, ar, managerLine, effect, row }) {
  // An overtime assignment runs the other way: management assigns, the worker chooses, management approves.
  const assigned = row && isOvertimeAssignment(row);
  const comp = row?.compensation || row?.compensationChoice;
  const steps = assigned
    ? (ar
      ? [["كُلّفت", row.recordedBy || "المسؤول"], ["اخترت التعويض", comp === "credit" ? "إجازة تعويضية" : comp === "pay" ? "أجر إضافي" : "بانتظارك"], ["الاعتماد", status === "approved" ? "اعتُمد" : status === "rejected" ? "رُدّ" : "بانتظار المسؤول"]]
      : [["Assigned", row.recordedBy || "Manager"], ["Your choice", comp || "Waiting on you"], ["Approval", status]])
    : (ar
      ? [["رُفع", "أنت"], ["مديرك المباشر", managerLine || "خلال 48 س"], ["القرار", effect || ""]]
      : [["Raised", "You"], ["Your manager", managerLine || "Within 48h"], ["Decision", effect || ""]]);
  const path = assigned
    ? (status === "pending_employee" ? { done: 1, at: 1 }
      : status === "pending_manager" ? { done: 2, at: 2 }
        : status === "approved" ? { done: 3, at: 3 }
          : { done: 2, at: 2, rejected: true })
    : requestPathIndex(status);
  return (
    <div className="nv-req-path" aria-label={ar ? "مسار الطلب" : "Request path"}>
      {steps.map(([label, sub], index) => {
        const done = index < path.done;
        const current = index === path.at && path.done < 3;
        const bad = path.rejected && index === steps.length - 1;
        const last = index === steps.length - 1;
        return (
          <span key={label} className="nv-req-path-step">
            {last ? null : <span className={`nv-req-path-seg${index < path.at ? " is-done" : ""}`} aria-hidden />}
            <span className={`nv-req-path-dot${done ? " is-done" : ""}${current ? " is-now" : ""}${bad ? " is-bad" : ""}`} />
            <span>{label}</span>
            {sub ? <span className="nv-req-path-sub">{sub}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

function chip(on) {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: 28,
    padding: "0 11px",
    border: `1px solid ${on ? NAVY_FILL : BORDER}`,
    background: on ? NAVY_FILL : CARD,
    color: on ? "#fff" : "var(--nv-ink2)",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: PILL_RADIUS,
  };
}

function headChip(on, mine) {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 30,
    padding: "0 12px",
    borderRadius: 999,
    border: mine ? (on ? "none" : "1px solid #D5DCD8") : (on ? "none" : "1px solid rgba(255,255,255,.4)"),
    background: mine ? (on ? "#3C7D50" : "var(--nv-card, #fff)") : (on ? "#FFFFFF" : "transparent"),
    color: mine ? (on ? "#fff" : "var(--nv-ink2, #3A4048)") : (on ? "#0B3D27" : "#FFFFFF"),
    fontSize: 12,
    fontWeight: on ? 700 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function pickBox(on) {
  return {
    fontFamily: "inherit",
    textAlign: "start",
    fontSize: 12,
    padding: "9px 11px",
    border: `1px solid ${on ? NAVY_FILL : "var(--nv-page, var(--nv-line3))"}`,
    background: on ? "var(--nv-hover)" : CARD,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    borderRadius: CONTROL_RADIUS,
  };
}

function leaveTypeChip(on) {
  return {
    fontFamily: "inherit",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 3,
    padding: "9px 11px",
    borderRadius: 9,
    cursor: "pointer",
    textAlign: "start",
    background: on ? "#E6F2EA" : CARD,
    border: on ? "1.5px solid #3C7D50" : "1px solid #E4E9E6",
    color: on ? "#0B3D27" : "var(--nv-ink, #111418)",
  };
}

function leadingLetter(label) {
  return Array.from(String(label || "").trim())[0] || "";
}

/**
 * Leave the management may record on a worker's behalf: the two a worker may be unable to file, and
 * annual leave — Art. 109(2) lets the employer set its dates, with at least 30 days' notice.
 */
const MANAGE_LEAVE_KEYS = ["annual", "emergency", "work_injury"];

function KindFrameCard({ on, letter, title, hint, onClick }) {
  return (
    <button type="button" className="nv-req-kind-card" onClick={onClick} aria-pressed={!!on}>
      <span className="nv-req-kind-mark">{letter}</span>
      <span className="nv-req-kind-copy">
        <span className="nv-req-kind-title">{title}</span>
        <span className="nv-req-kind-hint">{hint}</span>
      </span>
    </button>
  );
}

function fieldStyle() {
  return {
    fontFamily: "inherit",
    fontSize: 12,
    height: 34,
    padding: "0 10px",
    border: `1px solid ${BORDER}`,
    background: CARD,
    color: NAVY,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    minWidth: 0,
    borderRadius: CONTROL_RADIUS,
  };
}

const slab = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  boxShadow: PAPER_SHADOW,
  overflow: "hidden",
};

function stateSkin(status) {
  if (status === "approved") return { color: OK, bg: "var(--nv-ok-soft)", border: "var(--nv-ok-line)", edge: "var(--nv-ok-fill)" };
  if (status === "rejected" || status === "withdrawn" || status === "violation" || status === "refused_by_employee") return { color: BAD, bg: "var(--nv-bad-soft)", border: "var(--nv-bad-line)", edge: "var(--nv-bad-fill)" };
  if (status === "revise") return { color: WARN, bg: "var(--nv-warn-soft)", border: "var(--nv-warn-line)", edge: "var(--nv-warn-fill)" };
  return { color: WARN, bg: "var(--nv-warn-soft)", border: "var(--nv-warn-line)", edge: "var(--nv-warn-fill)" };
}

export default function RequestsWorkspace({
  employees,
  stations,
  lang = "ar",
  mode = "mine",
  canDecide = false,
  selfOnly = true,
  showAdminLink = false,
  initialKind = "leave",
  initialFilter = "",
  focusStationId = "",
}) {
  const ar = lang === "ar";
  const { company, currentUser, refresh, data } = useAuth();
  const self = requestSelfEmployee(currentUser, employees) || currentUser;
  const today = todayRiyadh();

  useEffect(() => {
    if (!company?.id) return;
    const result = openDueNightRotateCycles(company.id);
    if (result.opened?.length || result.notified) refresh?.();
  }, [company?.id]);

  const [kind, setKind] = useState(initialKind);
  // «طلب موافقة خطية» is a tile beside the others, not a second form with its own picker.
  const [consentPicked, setConsentPicked] = useState(false);
  const [refTab, setRefTab] = useState("law");
  // A deep link (?kind=permission …) while already on طلباتي switches the form too.
  useEffect(() => {
    if (initialKind) setKind(initialKind);
    if (initialKind && initialKind !== "leave") {
      setFrom((prev) => prev || today);
      setTo((prev) => prev || today);
    }
  }, [initialKind]);
  const [leave, setLeave] = useState("annual");
  const [doc2, setDoc2] = useState("salary");
  const [from, setFrom] = useState(() => (initialKind === "leave" ? "" : today));
  const [to, setTo] = useState(() => (initialKind === "leave" ? "" : today));
  const [note, setNote] = useState("");
  const [moneyKind, setMoneyKind] = useState("advance");
  const [moneyAmount, setMoneyAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [party, setParty] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherTitle, setOtherTitle] = useState("");
  const [docLang, setDocLang] = useState("ar");
  const [showSalary, setShowSalary] = useState(true);
  const [supportingFile, setSupportingFile] = useState(null);
  const [signedPaper, setSignedPaper] = useState(null);
  const [fileError, setFileError] = useState("");
  const [paperError, setPaperError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [paperBusy, setPaperBusy] = useState(false);
  const fileInputRef = useRef(null);
  const [examRepeat, setExamRepeat] = useState(false);
  const [examNoticeIssuedAt, setExamNoticeIssuedAt] = useState("");
  const [iddahPregnant, setIddahPregnant] = useState(false);
  const [companionUnpaidExtend, setCompanionUnpaidExtend] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [employeeId, setEmployeeId] = useState(() => employees[0]?.id || self?.id || "");
  const [stFilter, setStFilter] = useState(() => initialFilter || (selfOnly ? "all" : "pending"));
  const [fileRecordOpen, setFileRecordOpen] = useState(false);
  const [registerId, setRegisterId] = useState(() => employees[0]?.id || "");
  const [focusKey, setFocusKey] = useState("");
  const [lawFilter, setLawFilter] = useState("leave");
  const [lawOpen, setLawOpen] = useState(false);
  const [grantDays, setGrantDays] = useState(2);
  const [grantReason, setGrantReason] = useState("");
  const [draftNotes, setDraftNotes] = useState({});
  const [draftGround, setDraftGround] = useState({});
  const [resignPostpone, setResignPostpone] = useState({});
  const [draftVerified, setDraftVerified] = useState({});
  const [draftIssued, setDraftIssued] = useState({});
  const [draftExamNotice, setDraftExamNotice] = useState({});
  const [issuedBusy, setIssuedBusy] = useState({});
  const [issuedError, setIssuedError] = useState({});
  const [examSatBusy, setExamSatBusy] = useState({});
  const [iddahBirth, setIddahBirth] = useState({});
  const [maternityBirth, setMaternityBirth] = useState({});
  const [breachDraft, setBreachDraft] = useState({});
  const [leaveDecideFlags, setLeaveDecideFlags] = useState({});
  const [advanceLeave, setAdvanceLeave] = useState(false);
  const [joinAnnualToSick, setJoinAnnualToSick] = useState(false);
  const [examSatError, setExamSatError] = useState({});
  const [nightAck, setNightAck] = useState({});
  const [busy, setBusy] = useState(false);
  const [employerAck, setEmployerAck] = useState(false);
  const [deferConsent, setDeferConsent] = useState(false);
  const [topupDays, setTopupDays] = useState(1);
  const [creditPool, setCreditPool] = useState("annual");
  const [creditDays, setCreditDays] = useState(1);
  const [otHours, setOtHours] = useState("2");
  const [otTo, setOtTo] = useState("");
  const [ot106, setOt106] = useState(false);
  const [otGround, setOtGround] = useState("");
  const [ot106Ack, setOt106Ack] = useState(false);
  const [otChoice, setOtChoice] = useState({});
  const [otAck, setOtAck] = useState({});
  const [otEnjoy, setOtEnjoy] = useState({});
  const [otWindowAgreed, setOtWindowAgreed] = useState({});
  const [otCapChoice, setOtCapChoice] = useState({});
  const [withdrawAck, setWithdrawAck] = useState({});
  const [punchTime, setPunchTime] = useState("");
  const [permFrom, setPermFrom] = useState("");
  const [permComp, setPermComp] = useState(false);
  const [permJob, setPermJob] = useState(false);
  const [permTo, setPermTo] = useState("");
  const [shiftPick, setShiftPick] = useState("");
  const [nursingPlacement, setNursingPlacement] = useState("start");
  const [nursingSplit, setNursingSplit] = useState({ start: 60, mid: 0, end: 0 });
  const [childBirthDate, setChildBirthDate] = useState("");
  const [nursingUntil, setNursingUntil] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [studyProgram, setStudyProgram] = useState("");
  const [studyInstitution, setStudyInstitution] = useState("");
  const [studyStart, setStudyStart] = useState("");
  const [studyApprovalFile, setStudyApprovalFile] = useState(null);
  const [nightRight, setNightRight] = useState("performer_comp");
  const [fitnessPermanent, setFitnessPermanent] = useState(false);
  const [fitnessFrom, setFitnessFrom] = useState("");
  const [fitnessTo, setFitnessTo] = useState("");

  useEffect(() => {
    if (!employees.length) return;
    if (!employees.some((row) => row.id === employeeId)) setEmployeeId(employees[0].id);
  }, [employees, employeeId]);

  function firstPendingPerson(list = employees) {
    return firstPendingRegisterPerson(list, lang, focusStationId);
  }

  useEffect(() => {
    if (!employees.length) return;
    const firstPending = firstPendingRegisterPerson(employees, lang, focusStationId);
    if (firstPending?.id) setRegisterId(firstPending.id);
  }, [focusStationId]);

  useEffect(() => {
    if (!employees.length) return;
    if (registerId && employees.some((row) => row.id === registerId)) return;
    const firstPending = firstPendingPerson();
    setRegisterId(firstPending?.id || employees[0].id);
  }, [employees, registerId, lang]);

  useEffect(() => {
    setStFilter(initialFilter || (mode === "manage" ? "pending" : "all"));
    setFileRecordOpen(false);
    setFocusKey("");
    const firstPending = firstPendingPerson();
    setRegisterId(firstPending?.id || employees[0]?.id || "");
  }, [mode, initialFilter]);

  const raiseLane = mode === "manage" ? "manage" : "mine";
  const allowedKinds = composeRequestKinds(raiseLane);
  if (!allowedKinds.some((row) => row.id === kind)) {
    setKind(allowedKinds[0]?.id || "leave");
  }

  useEffect(() => {
    if (!focusKey) return;
    document.getElementById(`nv-req-${focusKey}`)?.scrollIntoView({ block: "nearest" });
  }, [focusKey]);

  const subject = employees.find((row) => row.id === employeeId) || self;
  const leaveMeta = leaveKindMeta(leave, from || today);
  const docMeta = DOC_KINDS.find((row) => row.id === doc2) || DOC_KINDS[0];
  const isLeave = kind === "leave";
  const isDoc = kind === "doc";
  const isOther = kind === "other";
  const isTopup = kind === "leave_topup";
  const isLeaveCredit = kind === "leave_credit";
  const isOtAssign = kind === "ot_assign";
  const isCustody = kind === "custody";
  const isMoney = kind === "money";
  const isStudyConsent = kind === "study_consent";
  const isNightFitness = kind === "night_fitness";
  const nightRightMeta = isNightFitness ? nightWorkRightById(nightRight) : null;
  const isNightFitnessRaise = isNightFitness && nightRight === "medical";
  const isPunchKind = kind === "manual" || kind === "outfix";
  const isDutyKind = DUTY_REQUEST_TYPES.includes(kind);
  const isResignation = kind === RESIGNATION_TYPE;
  const manageLeave = mode === "manage" && kind === "leave";
  const dutyMeta = isDutyKind ? DUTY_REQUEST_META[kind] : null;
  const isSignableKind = isDoc || isCustody;
  const needsDates = !isDoc && !isTopup && !isLeaveCredit && !isOtAssign && !isStudyConsent && !isNightFitness && !isResignation;
  const studyState = studyConsentState(subject, company?.id);
  const studyUnlocked = hasIrrevocableStudyConsent(subject, company?.id);
  const studySubmitGate = checkSubmitOtherRequestGate({
    type: STUDY_CONSENT_TYPE,
    program: studyProgram,
    institution: studyInstitution,
    startDate: studyStart,
    reason: note,
    file: supportingFile,
    files: supportingFile ? [supportingFile] : [],
    companyId: company?.id,
    employee: subject,
    otherRequests: subject?.otherRequests,
  });
  const studyDirectGate = checkApproveStudyConsentGate({
    type: STUDY_CONSENT_TYPE,
    issuedFile: studyApprovalFile,
  });
  const fitnessSubmitGate = checkSubmitOtherRequestGate({
    type: NIGHT_FITNESS_TYPE,
    from: fitnessFrom,
    to: fitnessTo,
    examDate: fitnessFrom,
    date: fitnessFrom,
    until: fitnessTo,
    permanent: fitnessPermanent,
    reason: note,
    file: supportingFile,
    files: supportingFile ? [supportingFile] : [],
    companyId: company?.id,
    employee: subject,
    employeeId: subject?.id,
    otherRequests: subject?.otherRequests,
    actorId: currentUser?.id,
    requestedById: currentUser?.id,
    lane: mode === "manage" ? "manage" : "mine",
  });
  const examConsentGate = checkExamStudyConsentGate(
    { type: "exam", companyId: company?.id },
    { otherRequests: subject?.otherRequests, employee: subject, companyId: company?.id },
  );
  // Arts 101/106: read the assignment against the rostered shift and week, not a fixed 8h / 48h.
  const otRoster = employeeRosterOtContext(data?.schedules, subject, from, laborCalendarOf(data));
  const otRaiseGate = checkRaiseOtAssignmentGate({
    reason: note,
    hours: otHours,
    date: from,
    dateTo: otTo,
    article106: ot106,
    article106Ground: otGround,
    manager106Ack: ot106Ack,
    ordinaryHours: otRoster.ordinaryHours,
    presenceHours: otRoster.presenceHours,
    rosterWeekHours: otRoster.rosterWeekHours,
    files: supportingFile ? [supportingFile] : [],
    employee: subject,
    otherRequests: subject?.otherRequests,
  });
  const topupDaysGate = checkLeaveTopupDaysGate({ days: topupDays });
  const topupDaysOk = topupDaysGate.ok;
  const leaveKinds = leaveKindsFor(subject?.profile, ar, subject?.leaveRequests, subject);
  useEffect(() => {
    if (kind !== "leave") return;
    // الإدارة records leave for a worker only when the worker cannot file it: emergency or work injury.
    if (mode === "manage" && !MANAGE_LEAVE_KEYS.includes(leave)) { setLeave("emergency"); return; }
    if (leave && !leaveKinds.some((row) => row.key === leave)) setLeave("annual");
  }, [employeeId, kind, leave, leaveKinds, mode]);
  const holidays = officialHolidays(today, laborCalendarOf(data));
  const needs118 = isLeave && leaveNeedsArticle118Ack(leave);
  const dates = rangeDates(from, to);
  const holidayHit = dates.filter((day) => holidays.some((h) => h.from && day >= h.from && day <= h.to));
  const restHit = isLeave && leave === "annual" && from && to ? weeklyOffDaysInRange(from, to, company, subject) : [];
  const counted = isLeave && (leave === "annual" || leave === "sick")
    ? (dates.length ? chargeableLeaveDays(from, to, leave, laborCalendarOf(data), company, subject) : 0)
    : dates.length;
  const annual = annualRemainingWithGrants(subject?.profile, subject?.leaveRequests, undefined, company, subject);
  const isGrant = isLeave && leave === "grant";
  const overGrant = isGrant && counted > annual.leftoverGrants;
  const overBalance = (isLeave && leave === "annual" && counted > annual.remaining) || overGrant;
  const needsDoc = isLeave && (manageLeave || leaveNeedsAttachment({ type: leave, startDate: from, endDate: to, days: counted }, !!leaveMeta.requiresFile));
  const files = [supportingFile, signedPaper].filter(Boolean);
  const hasDoc = hasLeaveAttachment({ files: supportingFile ? [supportingFile] : [] });

  const schedule = (data?.schedules || []).find((row) => row.stationId === (subject?.stationId || currentUser?.stationId));
  const laborCalendar = laborCalendarOf(data);
  const glowWeekStart = useMemo(() => weekStartDate(new Date()), []);
  const glowPerson = subject || self;
  const lawGlow = (kind) => {
    const roster = statutoryGlowState({
      kind,
      employee: glowPerson,
      schedule,
      weekStart: glowWeekStart,
      laborCalendar,
    });
    if (kind === "18632" || kind === "hours.night.rotateWeeks") {
      return maxStatutoryGlow(roster, nightWrittenConsentGlow([glowPerson]));
    }
    return roster;
  };
  const requestGlow = (row) => {
    const rowSchedule = (data?.schedules || []).find((item) => String(item.stationId) === String(row.employee?.stationId)) || schedule;
    if (row.type === "night_consent" && nightRotateStage(row) === "active") return "due";
    if (row.type === "night_consent" || row.article === "18632") {
      return statutoryGlowState({
        kind: "18632",
        employee: row.employee || glowPerson,
        schedule: rowSchedule,
        weekStart: glowWeekStart,
        laborCalendar,
      });
    }
    if (row.article === "104") {
      return statutoryGlowState({
        kind: "hours.rest.weeklyHours",
        employee: row.employee || glowPerson,
        schedule: rowSchedule,
        weekStart: glowWeekStart,
        laborCalendar,
      });
    }
    if (isUnseenApprovedLeave(row)) return "in_scope";
    return "off";
  };
  // Only leave takes a worker off a published shift — a permission, punch fix or duty request happens on it.
  const clash = needsDates && isLeave
    ? dates.filter((day) => isWeekDayPublished(schedule, day) && employeeShiftOnDay(schedule, subject?.id, day))
    : [];

  const _kindTitle = isLeave
    ? (ar ? `إجازة ${leaveMeta.ar}` : `${leaveMeta.en} leave`)
    : isDoc
      ? (docMeta.custom ? (otherName.trim() || (ar ? docMeta.ar : docMeta.en)) : (ar ? docMeta.ar : docMeta.en))
      : isStudyConsent
        ? (ar ? STUDY_CONSENT_LABEL_AR : STUDY_CONSENT_LABEL_EN)
      : isNightFitness
        ? (ar
          ? (isNightFitnessRaise
            ? `تقرير لياقة طبية · ${fitnessPermanent ? "مفتوحة" : "بين تاريخين"}`
            : (nightRightMeta?.ar || "طلبات العمل الليلي"))
          : (isNightFitnessRaise
            ? `Night fitness · ${fitnessPermanent ? "open" : "between dates"}`
            : (nightRightMeta?.en || "Night-work requests")))
      : isOther
        ? (otherTitle.trim() || (ar ? "طلب آخر" : "Other request"))
        : (ar ? REQUEST_KINDS.find((row) => row.id === kind)?.ar : REQUEST_KINDS.find((row) => row.id === kind)?.en);

  const otherType = isDoc ? docMeta.type : (REQUEST_KINDS.find((row) => row.id === kind)?.type || "document");
  const otherReason = isDoc
    ? [purpose.trim(), party.trim(), note.trim(), otherName.trim()].filter(Boolean).join(" · ")
    : note.trim();

  const kindChips = allowedKinds.filter((row) => row.id !== "leave_topup" && (!row.gender || profileGender(subject?.profile) === row.gender));
  // Family responsibilities (18632 e) sit with the night-work requests, not the duty ones.
  const NIGHT_SIDE_KINDS = ["family_duties"];
  const isNightSideKind = NIGHT_SIDE_KINDS.includes(kind);
  const dutyKindsHere = allowedKinds.filter((row) => row.duty && !NIGHT_SIDE_KINDS.includes(row.id) && (!row.gender || profileGender(subject?.profile) === row.gender));
  const subjectSchedule = (data?.schedules || []).find((row) => String(row.stationId) === String(subject?.stationId)) || null;
  const mineTiles = MINE_TILES.filter((tile) => {
    if (tile.id === "leave") return allowedKinds.some((row) => row.id === "leave");
    if (tile.id === "duty") return dutyKindsHere.length > 0;
    return allowedKinds.some((row) => row.id === tile.id);
  });
  const tileOn = (tile) => (tile.id === "leave" ? (isLeave || isTopup) : tile.id === "duty" ? (isDutyKind && !isNightSideKind) : tile.id === "night_fitness" ? (kind === "night_fitness" || isNightSideKind) : kind === tile.id);
  const pickTile = (tile) => {
    if (tile.id === "leave") {
      setKind("leave");
      if (!leave || leave === "grant") setLeave("annual");
      return;
    }
    if (tile.id === "duty") {
      setKind(dutyKindsHere[0]?.id || "permission");
      return;
    }
    setKind(tile.id);
    if (tile.id === "night_fitness") setNightRight("performer_comp");
  };
  const dutySubGrid = isDutyKind && !isNightSideKind && dutyKindsHere.length ? (
    <div data-duty-requests="1" style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: "1px solid #EEF1EF" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13 }}>{ar ? "نوع طلب الدوام" : "Duty request type"}</strong>
        <span style={{ fontSize: 11, color: MUTED }}>{ar ? "كل طلب يظهر أثره في الحضور والدوام" : "Each one shows up in Time & attendance"}</span>
      </div>
      <div className="nv-req-kind-grid">
        {dutyKindsHere.map((row) => {
          const meta = DUTY_REQUEST_META[row.id] || {};
          return (
            <KindFrameCard
              key={row.id}
              on={kind === row.id}
              letter={leadingLetter(ar ? meta.ar : meta.en)}
              title={ar ? meta.ar : meta.en}
              hint={ar ? meta.hintAr : meta.hintEn}
              onClick={() => setKind(row.id)}
            />
          );
        })}
      </div>
    </div>
  ) : null;
  const pickLeaveType = (row) => {
    setKind("leave");
    setLeave(row.key);
    clearSupportingFile();
    if (row.key === "iddah" && eventDate) {
      const span = iddahSpanFromEvent(eventDate, subject?.profile);
      if (span.start) {
        setFrom(span.start);
        setTo(span.end);
      }
    }
    if (row.key === "maternity_extend" || row.key === "maternity_companion") {
      const span = maternityFollowOnSpan(subject?.leaveRequests, row.defaultTotal || 30);
      if (span.start) {
        setFrom(span.start);
        setTo(span.end);
      }
      setCompanionUnpaidExtend(false);
    }
  };
  // Regs 22 bis — comp leave (whole days, or hours as a permission) is drawn from its own balance in hours.
  const compGateRow = (() => {
    const takingDays = isLeave && leave === "comp";
    const takingHours = kind === "permission" && permComp;
    if (!takingDays && !takingHours) return null;
    const bal = compBalance(subject);
    const mins = (v) => { const m = String(v || "").match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const want = takingDays
      ? Math.round(counted * 8 * 100) / 100
      : (mins(permFrom) != null && mins(permTo) != null && mins(permTo) > mins(permFrom) ? Math.round(((mins(permTo) - mins(permFrom)) / 60) * 100) / 100 : 0);
    if (!(want > 0)) return { ok: false, text: ar ? (takingDays ? "حدّد أيام الإجازة التعويضية." : "حدّد ساعة البداية والنهاية.") : "Set the time." };
    return want <= bal.left + 0.001
      ? { ok: true, text: ar ? `يُخصم من رصيدك التعويضي ${hoursAr(want)} من ${hoursAr(bal.left)} — لا يمسّ السنوية.` : `${want} h of ${bal.left} h comp balance — annual untouched.` }
      : { ok: false, text: ar ? `المطلوب ${hoursAr(want)} ورصيدك التعويضي ${hoursAr(bal.left)}${takingDays ? " — اليوم الكامل 8 ساعات؛ خذ الأقل ساعاتٍ من «استئذان»" : ""}.` : `You asked ${want} h; ${bal.left} h left.` };
  })();
  let gateDefs = isOtAssign
    ? [
      { ok: Number(otHours) > 0, text: Number(otHours) > 0
        ? (() => {
          // What the worker will be offered, so the cost is known before sending (Art. 107 · regs 22 bis).
          const offer = otOffer({ employee: subject, hours: otHours, date: from });
          return ar
            ? `${hoursAr(offer.hours)} إضافية — إن اختار الأجر: ${offer.known ? sarText(offer.pay.total) : "يُحسب في المسير"} (${offer.known ? `${sarText(offer.pay.perHour)} للساعة` : "المادة 107"})، وإن اختار الإجازة: ${hoursAr(offer.leave.hours)} (${offer.leave.days} يوم). الاختيار للموظف.`
            : `${offer.hours} overtime hours — if pay: ${offer.known ? sarText(offer.pay.total, false) : "computed in payroll"}; if leave: ${offer.leave.hours} h (${offer.leave.days} day). The worker chooses.`;
        })()
        : (ar ? "حدد ساعات التكليف." : "Set the assignment hours.") },
      { ok: !!from, text: from ? (ar ? `اليوم: ${formatArDate(from, lang)}` : `Day: ${formatArDate(from, lang)}`) : (ar ? "حدد تاريخ التكليف." : "Set the assignment date.") },
      { ok: note.trim().length >= 3, text: note.trim().length >= 3
        ? (ar ? "سبب التكليف مكتوب." : "The assignment reason is written.")
        : (ar ? "اكتب سبب التكليف." : "Write why this assignment is needed.") },
      { ok: !ot106 || !!otGround, text: !ot106
        ? (ar ? "تكليف اختياري — الموظف يقدر يرفض." : "Ordinary assignment — the worker may refuse.")
        : (otGround ? (ar ? `المادة 106: ${ARTICLE_106_GROUNDS.find((g) => g.key === otGround)?.ar || ""}` : `Article 106: ${ARTICLE_106_GROUNDS.find((g) => g.key === otGround)?.en || ""}`) : (ar ? "المادة 106: اختر إحدى حالاتها." : "Article 106: pick one of its cases.")) },
      { ok: !ot106 || !!supportingFile, text: !ot106
        ? (ar ? "لا ملف إلا إذا وُسم التكليف بالمادة 106." : "No file unless this is marked Article 106.")
        : (supportingFile ? (ar ? `ملف الواقعة: ${supportingFile.name}` : `Incident file: ${supportingFile.name}`) : (ar ? "أرفق ملف الواقعة — ورقة حقيقية بلا توقيع." : "Attach the incident file — a real paper, no signature.")) },
      { ok: !ot106 || ot106Ack, text: !ot106
        ? (ar ? "إقرار 106 للمسؤول فقط عند التكليف الإجباري." : "The manager's Article 106 acknowledgement is only for mandatory work.")
        : (ot106Ack ? (ar ? "أُقرّ بأن واقعة استثنائية قائمة وفق المادة 106." : "Acknowledged: an exceptional Article 106 situation exists.") : (ar ? "أقرّ بأن واقعة استثنائية قائمة وفق السبب المختار (المادة 106)." : "Acknowledge that an exceptional situation exists under the chosen ground (Article 106).")) },
      { ok: !ot106 || otRaiseGate.ok || otRaiseGate.error !== "ARTICLE_106_YEAR_CAP", text: otRaiseGate.error === "ARTICLE_106_YEAR_CAP"
        ? (ar ? otRaiseGate.reason : otRaiseGate.reasonEn)
        : (ot106 && otGround === "pressure_inventory"
          ? (ar ? "سقف المادة 106(1) للجرد والميزانية والمواسم: 30 يوماً في السنة." : "Article 106(1) inventory/budget/season cap: 30 days in the year.")
          : (ar ? "لا سقف سنوي لهذا السبب." : "This ground has no annual day cap.")) },
      { ok: !["ART106_DAY_CAP", "ART106_WEEK_CAP", "JUVENILE_NO_OT", "OT_WORKPLACE_STAY"].includes(otRaiseGate.error), text: ["ART106_DAY_CAP", "ART106_WEEK_CAP", "JUVENILE_NO_OT", "OT_WORKPLACE_STAY"].includes(otRaiseGate.error)
        ? (ar ? otRaiseGate.reason : otRaiseGate.reasonEn)
        : (ot106
          ? (ar ? "حد المادة 106: عمل فعلي لا يزيد على 10 ساعات في اليوم و60 في الأسبوع." : "Article 106 limit: actual work within 10 hours a day and 60 a week.")
          : (ar ? "ليس حدثاً — لا مانع من المادة 164." : "Not a juvenile — Article 164 does not block.")) },
      { ok: true, text: otRaiseGate.capConsentRequested
        ? (ar ? "يتجاوز سقف 720 ساعة في السنة — يُطلب من العامل نفسه الموافقة عند قبوله التكليف (اللائحة 22)، ولا يوافق عنه المسؤول." : "Passes the 720-hour annual cap — the worker himself is asked to consent when accepting (regs Art. 22); the manager cannot consent for him.")
        : (ar ? "سقف الإضافي السنوي 720 ساعة — اللائحة 22. الزيادة بموافقة العامل." : "Annual overtime cap is 720 hours — regs Art. 22. Excess needs the worker's consent.") },
    ]
    : isLeaveCredit
    ? composeAdminLeaveCreditGates({
      pool: creditPool,
      days: creditDays,
      reason: note,
      profile: subject?.profile,
      canCredit: canDecide,
    }, lang)
    : isNightFitness && !isNightFitnessRaise
    ? [
      { ok: true, text: ar ? (nightRightMeta?.whereAr || "حق من القرار 18632 — ليس طلباً يُرفع من هنا.") : (nightRightMeta?.whereEn || "A decision 18632 right — not raised from here.") },
    ]
    : isNightFitness
    ? [
      { ok: !!supportingFile, text: supportingFile
        ? (ar ? `تقرير اللياقة: ${supportingFile.name}` : `Fitness report: ${supportingFile.name}`)
        : (ar ? NIGHT_FITNESS_FILE_REQUIRED_AR : NIGHT_FITNESS_FILE_REQUIRED_EN) },
      { ok: fitnessPermanent || (!!fitnessFrom && !!fitnessTo), text: fitnessPermanent
        ? (ar ? "دائم — يبقى سارياً حتى يُستبدل أو يُوسم غير لائق." : "Permanent — stays valid until replaced or marked unfit.")
        : (fitnessFrom && fitnessTo
          ? (ar ? `فترة: ${formatArDate(fitnessFrom, lang)} → ${formatArDate(fitnessTo, lang)}` : `Period: ${formatArDate(fitnessFrom, lang)} → ${formatArDate(fitnessTo, lang)}`)
          : (ar ? "حدد تاريخ من وتاريخ إلى، أو اختر دائماً." : "Set from and to, or choose permanent.")) },
      { ok: fitnessSubmitGate.ok || fitnessSubmitGate.error === "NIGHT_FITNESS_FILE_REQUIRED", text: fitnessSubmitGate.ok
        ? (ar ? "بعد الاعتماد يُكتب التقرير في ملف اللياقة الطبية (من / إلى أو دائم)." : "After approval the report is written to the night-fitness file (from / to or permanent).")
        : (ar ? fitnessSubmitGate.reason : fitnessSubmitGate.reasonEn) },
      { ok: true, text: ar ? NIGHT_FITNESS_RECORD_ONLY_AR : NIGHT_FITNESS_RECORD_ONLY_EN },
    ]
    : isStudyConsent
    ? composeStudyConsentRaiseGates({
      program: studyProgram,
      institution: studyInstitution,
      startDate: studyStart,
      reason: note,
      file: supportingFile,
      files: supportingFile ? [supportingFile] : [],
      companyId: company?.id,
      employee: subject,
      otherRequests: subject?.otherRequests,
      submitGate: studySubmitGate,
    }, lang)
    : isTopup
    ? [
      { ok: topupDaysOk, text: topupDaysOk
        ? (ar ? `يُطلب إضافة ${topupDays} يوماً إلى الرصيد السنوي (21 أو 30 بحسب سنوات الخدمة).` : `${topupDays} extra days will be added to the annual balance (21 or 30 by years of service).`)
        : (ar ? topupDaysGate.reason : topupDaysGate.reasonEn) },
      { ok: note.trim().length >= 3, text: note.trim().length >= 3
        ? (ar ? "السبب مكتوب — يظهر في طابور القرار." : "The reason is written — it appears in the decision queue.")
        : (ar ? "اكتب سبب طلب رفع الرصيد." : "Write why the balance should be raised.") },
      { ok: true, text: supportingFile
        ? (ar ? `مرفق اختياري: ${supportingFile.name} — بلا توقيع.` : `Optional file: ${supportingFile.name} — no signature.`)
        : (ar ? "المرفق اختياري — لا توقيع ولا إقرار 118، فهذا ليس أخذ إجازة." : "A file is optional — no signature and no Article 118, because this is not taking leave.") },
    ]
    : isDoc
    ? [
      { ok: !docMeta.custom || !!otherName.trim(), text: docMeta.custom ? (otherName.trim() ? (ar ? `الوثيقة المطلوبة: ${otherName.trim()}` : "اكتب اسم الوثيقة.") : (ar ? "اكتب اسم الوثيقة: «أخرى» بلا اسم لا يمكن إصدارها." : "Name the document.")) : (ar ? "النوع محدّد مسبقاً — لا يحتاج اسماً." : "The type is already named.") },
      { ok: !!purpose.trim(), text: purpose.trim() ? (ar ? `الغرض: ${purpose.trim()}` : `Purpose: ${purpose.trim()}`) : (ar ? "اكتب الغرض: الوثيقة تُصاغ عليه." : "Write the purpose — the letter is drafted from it.") },
      { ok: !!party.trim(), text: party.trim() ? (ar ? `موجّهة إلى: ${party.trim()}` : `Addressed to: ${party.trim()}`) : (ar ? "اكتب الجهة الموجّه إليها." : "Name the addressee.") },
      { ok: true, text: ar ? "لا ترفع شيئاً — الشركة تُصدر الوثيقة وتُسلّمها لك على هذه البطاقة." : "Nothing to upload — the company issues the letter and delivers it on this card." },
      { ok: true, text: docMeta.salary ? (showSalary ? (ar ? "الراتب يظهر في الوثيقة." : "Salary appears on the letter.") : (ar ? "الراتب مخفي — المسمى ومدة الخدمة فقط." : "Salary hidden — title and service only.")) : (ar ? "هذا النوع لا يذكر الراتب أصلاً." : "This type never states salary.") },
      { ok: true, text: ar ? `بعد الرفع: القرار في طلباتي من ${docMeta.approverAr} — بلا توقيع رقمي.` : `After raise: the decision stays in My Requests with ${docMeta.approverEn} — no digital signature.` },
    ]
    : [
      { ok: isPunchKind ? /^\d{4}-\d{2}-\d{2}$/.test(String(from || "").slice(0, 10)) : (counted > 0 || !isLeave), text: isLeave
        ? (counted > 0
          ? `${ar ? countAr(counted, "يوم واحد محسوب", "يومان محسوبان", "أيام محسوبة", "يوماً محسوباً") : `${counted} counted days`} — ${formatArDate(from, lang)} → ${formatArDate(to, lang)}${leave === "eid" || leave === "iddah" ? (ar ? " · بأجر كامل ولا تُخصم من السنوية" : " · full pay, not taken from annual") : leaveSpanIncludesOfficialHolidays(leave) && holidayHit.length ? (ar ? " · العيد داخل المدة (المادة 114)" : " · Eid is inside the span (Art. 114)") : ""}`
          : (ar ? "حدّد تاريخين صحيحين." : "Set a valid date range."))
        : (from ? (ar ? `اليوم: ${formatArDate(from, lang)}` : `Day: ${formatArDate(from, lang)}`) : (ar ? "حدد التاريخ." : "Set the date.")) },
      { ok: !needsDoc || hasDoc, text: !needsDoc
        ? (hasDoc
          ? (ar ? `مرفق اختياري: ${supportingFile.name} — بلا توقيع.` : `Optional file: ${supportingFile.name} — no signature.`)
          : (ar ? "المرفق اختياري على هذا النوع — بلا توقيع." : "A file is optional on this type — no signature."))
        : (hasDoc ? (ar ? `المستند المؤيد مرفق: ${supportingFile.name}${leaveMeta.article ? ` — المادة ${leaveMeta.article}` : ""}.` : `Supporting document attached: ${supportingFile.name}${leaveMeta.article ? ` — Art. ${leaveMeta.article}` : ""}.`) : (ar ? `أرفق المستند المؤيد قبل الإرسال.` : "Attach the supporting document before sending.")) },
      compGateRow || { ok: !overBalance, text: !isLeave
        ? (ar ? "لا رصيد يُخصم لهذا النوع." : "No annual balance is deducted for this type.")
        : isGrant
          ? (overGrant
            ? (ar ? `الطلب ${counted} يوماً والمتبقي من الرصيد التقديري ${annual.leftoverGrants} — لا يُسحب من المستحق النظامي.` : `The request is ${counted} days; ${annual.leftoverGrants} discretionary days remain — not taken from the statutory entitlement.`)
            : (ar ? `يُخصم من الأيام التقديرية: ${counted} من ${annual.leftoverGrants}. لا يمسّ المستحق النظامي.` : `${counted} of ${annual.leftoverGrants} discretionary days. The statutory entitlement is untouched.`))
          : leave !== "annual"
            ? (ar ? "لا رصيد يُخصم لهذا النوع." : "No annual balance is deducted for this type.")
            : (overBalance ? (ar ? `الطلب ${counted} يوماً والمتبقي ${annual.remaining}.` : `The request is ${counted} days; ${annual.remaining} remain.`) : (ar ? `يُخصم من الرصيد السنوي: ${counted} من ${annual.remaining}.` : `${counted} of ${annual.remaining} annual days.`)) },
      ...(isLeave ? [{ ok: clash.length === 0, warn: true, text: clash.length ? (ar ? `يتقاطع مع ${clash.length} وردية منشورة — إجازة على وردية منشورة — يحتاج بديلاً. التعيين يبقى حتى يُسند بديل ويُعاد النشر.` : `Clashes with ${clash.length} published shifts — leave on a published shift — needs a substitute. The assignment stays until a substitute is assigned and the week is republished.`) : (ar ? "لا تقاطع مع ورديات منشورة." : "No clash with a published shift.") }] : []),
      ...(isMoney ? [{ ok: Number(moneyAmount) > 0, text: Number(moneyAmount) > 0
        ? (ar ? `${moneyKind === "advance" ? "سلفة" : "بدل"} بمبلغ ${Number(moneyAmount).toLocaleString("en-US")} ر.س.` : `${moneyKind} of SAR ${moneyAmount}.`)
        : (ar ? "اكتب المبلغ المطلوب." : "Write the amount.") }] : []),
      { ok: !isOther || otherTitle.trim().length > 2, text: !isOther ? (ar ? "نوع الطلب محدّد من القائمة." : "The type is already named.") : (otherTitle.trim().length > 2 ? (ar ? `عنوان طلبك: ${otherTitle.trim()}` : `Title: ${otherTitle.trim()}`) : (ar ? "اكتب عنوان طلبك قبل الإرسال." : "Write the title of your request before sending.")) },
      (isLeave && leave === "annual")
        // Annual leave is a right (Art. 109) — the employer sets its timing (Art. 110); no reason is owed.
        ? { ok: true, text: note.trim() ? (ar ? "ملاحظتك تظهر لمديرك." : "Your note shows to your manager.") : (ar ? "الإجازة السنوية حق لا يحتاج سبباً — مديرك يقرّر توقيتها فقط (المادة 110)." : "Annual leave is a right and needs no reason — your manager sets only its timing (Art. 110).") }
        : { ok: !!note.trim(), text: note.trim() ? (ar ? "السبب مكتوب — يظهر في طابور القرار." : "The reason is written — it appears in the decision queue.") : (ar ? "اكتب السبب: كل طلب يحمل سببه في سجل التدقيق." : "Write the reason — every request carries it in the audit trail.") },
      ...(isPunchKind ? (() => {
        const punch = checkPunchRecordGate({
          type: otherType,
          employee: subject,
          attendance: attendanceOnDate(data?.personalAttendance, subject?.id, from),
          date: from,
          time: punchTime,
          reason: otherReason || note,
          requireTime: true,
        });
        const rows = [
          { ok: !!parsePunchClock(punchTime), text: parsePunchClock(punchTime) ? (ar ? `الوقت: ${parsePunchClock(punchTime)}` : `Time: ${parsePunchClock(punchTime)}`) : (kind === "outfix" ? (ar ? "حدد وقت الانصراف." : "Set the checkout time.") : (ar ? "حدد وقت الحضور." : "Set the check-in time.")) },
        ];
        if (!["DATE_REQUIRED", "TIME_REQUIRED", "REASON_REQUIRED"].includes(punch.error)) {
          rows.push({
            ok: punch.ok,
            text: punch.ok
              ? (ar ? "السجل يقبل هذا الوقت." : "The register accepts this time.")
              : (ar ? punch.reason : punch.reasonEn),
          });
        }
        return rows;
      })() : []),
      ...(isResignation && resignationRouteFor(subject?.profile) === EXIT_ROUTE_NOTICE75 ? (() => {
        const facts = resignationFacts({ date: today, route: EXIT_ROUTE_NOTICE75 });
        return [{
          ok: true,
          warn: false,
          text: ar
            ? `إشعار كتابي بإنهاء العقد غير محدد المدة — ينتهي العقد في ${regulationDate(facts.noticeEndsOn)} دون قبول (المادة 75).`
            : `Written notice ending the open-ended contract — it ends on ${facts.noticeEndsOn}, no acceptance needed (Art. 75).`,
        }];
      })() : isResignation ? (() => {
        const facts = resignationFacts({ date: today });
        return [{
          ok: true,
          warn: false,
          text: ar
            ? `تُؤرَّخ بيوم تقديمها ${regulationDate(today)} — لا يصح تحديد تاريخ مؤجل لها (المادة 79 مكرر).`
            : `Dated the day you file it (${today}) — a deferred date is not allowed (Art. 79 bis).`,
        }, {
          ok: true,
          warn: false,
          text: ar
            ? `تُعد مقبولة في ${regulationDate(facts.deemedAcceptedOn)} إن لم يُرد عليها، ولك سحبها حتى ${regulationDate(facts.withdrawUntil)}.`
            : `Deemed accepted on ${facts.deemedAcceptedOn} without a reply; you may withdraw until ${facts.withdrawUntil}.`,
        }];
      })() : []),
      ...(isDutyKind ? (() => {
        const duty = checkDutyRequestFields({
          type: kind, date: from, time: permFrom, timeTo: permTo, placement: nursingPlacement,
          until: nursingUntil, dueDate, file: supportingFile,
          nursingSplit: kind === "nursing_hour" ? nursingSplit : undefined,
          childBirthDate: kind === "nursing_hour" ? childBirthDate : undefined,
          nurseryOnSite: hoursPolicyOf(data).nurseryOnSite === true,
        });
        return [{
          ok: duty.ok,
          text: duty.ok
            ? (ar ? `${dutyMeta?.ar || ""}: البيانات مكتملة — يظهر أثره في الحضور والدوام بعد الاعتماد.` : `${dutyMeta?.en || ""}: complete — it shows in Time & attendance once approved.`)
            : (ar ? duty.reason : duty.reasonEn),
        }];
      })() : []),
      ...(isCustody ? [
        { ok: !!supportingFile, text: supportingFile ? (ar ? `ملف العهدة محمّل: ${supportingFile.name}` : `Custody file loaded: ${supportingFile.name}`) : (ar ? "أرفق ورقة العهدة وانتظر تحميلها." : "Attach the custody paper and wait for it to load.") },
        { ok: !!signedPaper, text: signedPaper ? (ar ? `النسخة الموقّعة يدوياً: ${signedPaper.name}` : `Hand-signed copy: ${signedPaper.name}`) : (ar ? "نزّل الورقة، وقّعها بيدك، ثم ارفع النسخة." : "Download the paper, sign it by hand, then upload the copy.") },
      ] : []),
    ];
  if (isLeave) {
    gateDefs.push({
      ok: employerAck,
      text: employerAck
        ? (ar ? "أُقرّ بعدم العمل لدى صاحب عمل آخر أثناء الإجازة (المادة 118)." : "Acknowledged: no other employer during this leave (Article 118).")
        : (ar ? "أقرّ بعدم العمل لدى صاحب عمل آخر أثناء الإجازة — المادة 118." : "Acknowledge you will not work for another employer during leave — Article 118."),
    });
  }

  if (isLeave && ["marriage", "bereavement", "bereavement_sibling", "paternity", "maternity", "iddah", "work_injury"].includes(leave)) {
    gateDefs.splice(1, 0, {
      ok: !!eventDate,
      text: eventDate ? (ar ? `تاريخ الواقعة: ${formatArDate(eventDate, lang)}` : `Event date: ${formatArDate(eventDate, lang)}`) : (ar ? "تاريخ الواقعة لازم." : "The event date is required."),
    });
  }
  if (isLeave && (leave === "maternity" || leave === "maternity_extend" || leave === "maternity_companion" || leave === "paternity" || leave === "iddah")) {
    const genderGate = checkLeaveGenderGate({ type: leave }, { profile: subject?.profile });
    gateDefs.push({
      ok: genderGate.ok,
      text: genderGate.ok
        ? (leave === "iddah"
          ? (ar ? "عدّة وفاة الزوج — ملف أنثى (المادة 160)." : "Iddah — female file (Article 160).")
          : leave === "maternity_extend"
          ? (ar ? "تمديد الوضع بلا أجر — ملف أنثى (المادة 151)." : "Unpaid maternity extension — female file (Article 151).")
          : leave === "maternity_companion"
          ? (ar ? "مرافقة مولود — ملف أنثى (المادة 151)." : "Companion month — female file (Article 151).")
          : leave === "maternity"
          ? (ar ? "إجازة أمومة — ملف أنثى (المادة 151)." : "Maternity — female file (Article 151).")
          : (ar ? "إجازة أبوة — ملف ذكر (المادة 113)." : "Paternity — male file (Article 113)."))
        : (ar ? genderGate.reason : genderGate.reasonEn),
    });
  }
  if (isLeave && from && to && counted > 0) {
    const statutory = checkSubmitLeaveGate({
      type: leave,
      startDate: from,
      endDate: to,
      days: counted,
      eventDate: eventDate || undefined,
      examRepeat: leave === "exam" ? examRepeat : undefined,
      examNoticeIssuedAt: leave === "exam" ? examNoticeIssuedAt || undefined : undefined,
      iddahPregnant: leave === "iddah" ? iddahPregnant : undefined,
      companionUnpaidExtend: leave === "maternity_companion" ? companionUnpaidExtend : undefined,
      advanceLeave: leave === "annual" && advanceLeave ? true : undefined,
      joinAnnualToSick: leave === "annual" && joinAnnualToSick && !!sickLeaveEndingBefore(subject?.leaveRequests, from) ? true : undefined,
      files: supportingFile ? [supportingFile] : [],
      noOtherEmployerAck: true,
      reason: note || "—",
    }, { profile: subject?.profile, requests: subject?.leaveRequests, otherRequests: subject?.otherRequests, employee: subject, companyId: company?.id, laborCalendar, company });
    if (!statutory.ok && statutory.error !== "NO_OTHER_EMPLOYER_ACK" && statutory.error !== "LEAVE_DATES_REQUIRED" && statutory.error !== "LEAVE_DATES_ORDER") {
      gateDefs.push({ id: statutory.error || "LEAVE_SUBMIT", ok: false, text: ar ? statutory.reason : statutory.reasonEn });
    }
    if (statutory.warning) {
      const warnText = statutory.ok
        ? (ar ? statutory.reason : statutory.reasonEn)
        : (ar ? statutory.warningReason : statutory.warningReasonEn);
      if (warnText) gateDefs.push({ id: statutory.error ? `${statutory.error}_WARN` : "LEAVE_SUBMIT_WARN", ok: false, warn: true, text: warnText });
    }
  }
  if (isLeave && leave === "exam") {
    gateDefs.push({
      id: "EXAM_STUDY_CONSENT_TRACK",
      ok: true,
      warn: examConsentGate.examLeaveTrack !== "paid",
      text: ar ? examConsentGate.reason : examConsentGate.reasonEn,
    });
  }
  if (isLeave && (leave === "annual" || leave === "sick") && holidayHit.length) {
    gateDefs.push({
      ok: true,
      warn: false,
      text: leave === "annual"
        ? (ar
          ? `${holidayHit.length} يوم عطلة رسمية داخل المدة — اللائحة 24: السنوية تُمدَّد ولا تُخصم هذه الأيام.`
          : `${holidayHit.length} official holiday days sit inside this span — regs Art. 24: annual leave is extended; those days are not charged.`)
        : (ar
          ? `${holidayHit.length} يوم عطلة رسمية داخل المرضية — تُدفع بأجر كامل ولا تدخل شريحة المادة 117.`
          : `${holidayHit.length} official holiday days sit inside sick leave — paid in full, not the Article 117 band.`),
    });
  }
  // Weekly-rest days inside the span are shown day by day in AnnualLeaveBreakdown.
  void restHit;

  gateDefs = uniqueNamedGates(gateDefs);
  const blockers = gateDefs.filter((g) => !g.ok && !g.warn);
  const canSend = blockers.length === 0 && !!company?.id && !!subject?.id && !fileBusy && !paperBusy && !(isNightFitness && !isNightFitnessRaise);

  const clearSupportingFile = () => {
    setSupportingFile(null);
    setSignedPaper(null);
    setFileError("");
    setPaperError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const readPickedFile = async (picked, { setRecord, setError, setBusy, inputRef }) => {
    if (!picked) {
      setRecord(null);
      setError("");
      if (inputRef?.current) inputRef.current.value = "";
      return;
    }
    if (!isAllowedSupportingFile(picked)) {
      setError(ar ? "الصيغ المدعومة: PDF، JPG، PNG، WEBP." : "Supported formats: PDF, JPG, PNG, WEBP.");
      if (inputRef?.current) inputRef.current.value = "";
      return;
    }
    if (picked.size > SUPPORTING_FILE_MAX_BYTES) {
      setError(ar ? "يجب ألا يتجاوز حجم الملف 10 ميجابايت." : "The file must not exceed 10 MB.");
      if (inputRef?.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    setError("");
    try {
      const record = await readSupportingFile(picked);
      if (!record?.url || !record.name) {
        setError(ar ? "تعذّر قراءة الملف." : "Could not read the file.");
        setRecord(null);
        return;
      }
      setRecord(record);
    } catch {
      setError(ar ? "تعذّر قراءة الملف." : "Could not read the file.");
      setRecord(null);
    } finally {
      setBusy(false);
    }
  };

  const onSupportingFile = async (picked) => {
    if (!picked) {
      clearSupportingFile();
      return;
    }
    setSignedPaper(null);
    setPaperError("");
    await readPickedFile(picked, {
      setRecord: setSupportingFile,
      setError: setFileError,
      setBusy: setFileBusy,
      inputRef: fileInputRef,
    });
  };

  const onSignedPaper = async (picked) => {
    if (!picked) {
      setSignedPaper(null);
      setPaperError("");
      return;
    }
    await readPickedFile(picked, {
      setRecord: setSignedPaper,
      setError: setPaperError,
      setBusy: setPaperBusy,
    });
  };

  const registerBoard = useMemo(
    () => managerEmployeeRegister(employees, lang, { stations, companyId: company?.id }),
    [employees, lang, stations, company?.id],
  );
  const selectedRegister = registerBoard.rows.find((row) => String(row.id) === String(registerId || employeeId));
  const mineOwned = mode === "mine"
    ? flattenWorkspaceRows(employees, lang).filter((row) => isOwnMineLaneRow(row, currentUser || self))
    : [];
  const rows = mode === "mine"
    ? mineInboxRows(employees, currentUser || self, lang)
    : liveInboxRows(employees, lang, { lane: mode === "manage" ? "manage" : "mine" });
  const selectedPersonId = registerId || employeeId;
  const scopedRows = mode === "manage" && selectedPersonId
    ? rows.filter((row) => String(row.employee?.id) === String(selectedPersonId))
    : rows;
  const mineStatus = mineStatusBucket;
  const mineList = mode === "mine" && (stFilter === "all" || stFilter === "approved" || stFilter === "rejected")
    ? mineOwned
    : scopedRows;
  const filtered = mineList.filter((row) => {
    const st = row.status || "pending";
    if (stFilter === "all") return true;
    if (stFilter === "approved") return mineStatus(row) === "approved";
    if (stFilter === "rejected") return mineStatus(row) === "rejected";
    if (stFilter === "pending") {
      if (mode === "mine") return isMinePendingListRow(row, currentUser || self);
      return isPendingDecideStatus(st);
    }
    return st === stFilter;
  });
  const pendingCount = scopedRows.filter((row) => isPendingDecideStatus(row.status)).length;
  const showRaiseForm = selfOnly || mode === "manage" || fileRecordOpen;
  const lawRows = lawArticleCards("requests", isResignation ? "79 مكرر" : isOtAssign ? (ot106 ? "106" : "107") : (isNightFitness ? "18632" : (isStudyConsent || (isLeave && leave === "exam") ? "115" : (isLeave ? leaveMeta.article : ""))), lang);
  const balanceRuleLive = isTopup || isLeaveCredit || (isLeave && leave === "grant");
  const judgmentRows = [...lawRows, {
      art: "ops-disc",
      kind: "ops",
      citeKind: "ops",
      source: "product",
      name: ar ? "الأيام التقديرية" : "Discretionary days",
      impl: ar
        ? `أيام بتقدير الإدارة فوق المستحق. سقف ${DISCRETIONARY_GRANT_CAP} في السنة، لا تُرحَّل ولا تُصرف نقداً؛ المادة 111 تُلزم بالمستحق النظامي فقط.`
        : `Days granted above the statutory floor. Cap ${DISCRETIONARY_GRANT_CAP} a year; they do not carry and are not paid in cash. Article 111 binds the statutory entitlement only.`,
      live: balanceRuleLive,
    }];
  const balances = balanceRows(subject?.profile, subject?.leaveRequests, lang);
  void balances;
  const sickCap = ["leave.sick.fullPayDays", "leave.sick.halfPayDays", "leave.sick.unpaidDays"]
    .reduce((sum, id) => sum + (Number(ruleValue(id)) || 0), 0);
  const sickUsed = usedLeaveDays(subject?.leaveRequests, "sick", today, subject?.profile?.hireDate);
  const sickLeft = sickCap ? Math.max(0, sickCap - sickUsed) : null;
  const hajjTaken = (subject?.leaveRequests || []).some((row) => row.type === "hajj" && row.status === "approved") || !!subject?.profile?.hajjPerformed;
  const studyLive = hasIrrevocableStudyConsent(subject?.otherRequests);
  void studyLive; void sickLeft;
  const managerId = subject?.profile?.directManagerId || self?.profile?.directManagerId || "";
  const managerPerson = (data?.employees || []).find((row) => managerId && String(row.id) === String(managerId));
  const managerLine = managerPerson?.name
    ? (ar ? `${managerPerson.name} · خلال 48 س` : `${managerPerson.name} · within 48h`)
    : "";
  // Only what is a real counted balance gets a bar: annual (Art. 109) and sick (Art. 117, three pay bands).
  // Study (Art. 115) is the exam days themselves — no balance; Hajj (Art. 114) is a once-in-service status line.
  const sickBands = [
    { key: "full", n: Number(ruleValue("leave.sick.fullPayDays")) || 0, ar: "بأجر كامل", en: "Full pay", color: "#C8A45A" },
    { key: "part", n: Number(ruleValue("leave.sick.halfPayDays")) || 0, ar: "بثلاثة أرباع الأجر", en: "Three-quarters pay", color: "#8FB79C" },
    { key: "none", n: Number(ruleValue("leave.sick.unpaidDays")) || 0, ar: "بلا أجر", en: "Unpaid", color: "rgba(255,255,255,.38)" },
  ];
  const hajjLine = (() => {
    const p = subject?.profile || {};
    // Hajj is for a Muslim on file (Art. 114) — no line when the religion is another or not recorded.
    if (religionOnFile({ profile: p }) !== "muslim") return null;
    if (hajjTaken) return ar ? "استُخدمت — مرة واحدة في الخدمة" : "Used — once in service";
    const hire = String(p.hireDate || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(hire)) {
      const due = `${Number(hire.slice(0, 4)) + 2}${hire.slice(4)}`;
      if (due > today) return ar ? `تستحقها من \u2066${due}\u2069 — بعد سنتين متصلتين` : `Due from ${due} — after two continuous years`;
    }
    return ar ? "متاحة — مرة واحدة في الخدمة، من 10 إلى 15 يوماً" : "Available — once in service, 10 to 15 days";
  })();
  const grants = subject?.profile?.discretionaryGrants || [];
  const granted = grantDaysOf(subject?.profile);
  const stationName = (id) => stations.find((station) => station.id === id)?.name || "";

  const resetForm = () => {
    setNote("");
    setAdvanceLeave(false);
    setJoinAnnualToSick(false);
    setMoneyAmount("");
    setPermFrom("");
    setPermComp(false);
    setPermTo("");
    setShiftPick("");
    setNursingUntil("");
    setDueDate("");
    setLastDay("");
    setPurpose("");
    setParty("");
    setOtherName("");
    setOtherTitle("");
    setSupportingFile(null);
    setSignedPaper(null);
    setFileError("");
    setPaperError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setExamRepeat(false);
    setExamNoticeIssuedAt("");
    setIddahPregnant(false);
    setCompanionUnpaidExtend(false);
    setEmployerAck(false);
    setDeferConsent(false);
    if (kind === "leave") {
      setFrom("");
      setTo("");
    }
    setTopupDays(1);
    setCreditPool("annual");
    setCreditDays(1);
    setOtHours("2");
    setOtTo("");
    setOt106(false);
    setOtGround("");
    setOt106Ack(false);
    setPunchTime("");
    setStudyProgram("");
    setStudyInstitution("");
    setStudyStart("");
    setStudyApprovalFile(null);
    setFitnessPermanent(false);
    setFitnessFrom("");
    setFitnessTo("");
  };

  const send = (direct = false) => {
    if (!canSend || busy) return;
    if (mode === "manage" && !isManageRaiseKind(kind)) {
      toast({
        description: ar
          ? "من الإدارة: تكليف إضافي أو إضافة رصيد أو طلب آخر فقط — الإجازة والطلبات الشخصية من ملفي."
          : "From Manage: overtime assignment, leave credit, or other only — leave and personal requests stay on My file.",
        variant: "destructive",
      });
      return;
    }
    if (direct && mode === "manage" && kind === "leave" && !MANAGE_LEAVE_KEYS.includes(leave)) {
      toast({
        description: ar
          ? "الإدارة تحدد موعد الإجازة السنوية (بإشعار 30 يوماً) أو تسجّل إجازة اضطرارية أو إصابة عمل — بقية الإجازات يرفعها الموظف من طلباتي."
          : "Management sets annual-leave dates (30 days' notice) or records emergency leave or a work injury — other leave is filed by the worker.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      if (isLeaveCredit) {
        if (!canDecide) {
          toast({
            description: ar ? "إضافة الرصيد لمن يقرر على الطلبات فقط." : "Only managers who decide on requests may credit leave balance.",
            variant: "destructive",
          });
          return;
        }
        const result = creditEmployeeLeaveBalance(company.id, subject.id, {
          pool: creditPool,
          days: creditDays,
          reason: note.trim(),
          by: currentUser?.name,
          byId: currentUser?.id,
          canCredit: canDecide,
        });
        if (!result.ok) {
          toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
          return;
        }
        toast({
          description: result.pool === "grant"
            ? (ar ? `أُضيف ${result.days} أيام تقديرية إلى رصيد ${subject.name}.` : `${result.days} discretionary days credited to ${subject.name}.`)
            : (ar ? `أُضيف ${result.days} أيام إلى الرصيد السنوي لـ ${subject.name}.` : `${result.days} days added to ${subject.name}'s annual balance.`),
        });
        resetForm();
        refresh?.();
        return;
      }
      if (isLeave) {
        const payload = {
          type: leave,
          startDate: from,
          endDate: to,
          days: counted,
          reason: note.trim(),
          files,
          eventDate: eventDate || undefined,
          examRepeat: leave === "exam" ? examRepeat : undefined,
          examNoticeIssuedAt: leave === "exam" ? examNoticeIssuedAt || undefined : undefined,
          iddahPregnant: leave === "iddah" ? iddahPregnant : undefined,
          companionUnpaidExtend: leave === "maternity_companion" ? companionUnpaidExtend : undefined,
          noOtherEmployerAck: employerAck,
          deferConsentAt: deferConsent ? new Date().toISOString() : undefined,
          expectedBirthDate: leave === "maternity" ? (eventDate || undefined) : undefined,
          advanceLeave: leave === "annual" && advanceLeave ? true : undefined,
          joinAnnualToSick: leave === "annual" && joinAnnualToSick && !!sickLeaveEndingBefore(subject?.leaveRequests, from) ? true : undefined,
          status: direct ? "approved" : "pending",
          recordedBy: direct ? currentUser?.name : undefined,
          requestedBy: currentUser?.name,
          requestedById: currentUser?.id,
        };
        const gate = checkSubmitLeaveGate(
          { ...payload, status: "pending" },
          { profile: subject.profile, requests: subject.leaveRequests, otherRequests: subject.otherRequests, employee: subject, employeeId: subject.id, companyId: company.id, recordedBy: payload.recordedBy, requestedById: payload.requestedById, actorId: payload.requestedById, employerRecorded: !!payload.recordedBy },
        );
        if (!gate.ok) {
          toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
          return;
        }
        const saved = submitLeaveRequest(company.id, subject.id, payload);
        if (!saved?.ok) {
          toast({ description: ar ? (saved?.reason || "تعذّر إرسال الطلب") : (saved?.reasonEn || "Could not send the request"), variant: "destructive" });
          return;
        }
        if (direct && (leave === "unpaid" || leave === "maternity_extend")) refreshUnpaidLeaveWage(company.id, subject.id);
      } else if (isOtAssign) {
        const saved = submitOtAssignment(company.id, subject.id, {
          reason: note.trim(),
          hours: otHours,
          date: from,
          dateTo: otTo,
          article106: ot106,
          article106Ground: otGround,
          manager106Ack: ot106Ack,
          files: supportingFile ? [supportingFile] : [],
          stationId: subject.stationId,
          by: currentUser?.name,
        });
        if (saved && saved.ok === false) {
          toast({ description: ar ? (saved.reason || "تعذّر إرسال التكليف") : (saved.reasonEn || "Could not send the assignment"), variant: "destructive" });
          return;
        }
        toast({ description: ar ? "سُجّل التكليف — بانتظار اختيار الموظف." : "Assignment recorded — awaiting the worker's choice." });
        resetForm();
        refresh?.();
        return;
      } else {
        const gate = checkSubmitOtherRequestGate({
          type: otherType,
          reason: otherReason || note,
          date: isStudyConsent ? studyStart : (isNightFitness ? fitnessFrom : (isResignation ? today : from)),
          time: isPunchKind ? parsePunchClock(punchTime) : (kind === "permission" ? permFrom : undefined),
          timeTo: kind === "permission" ? permTo : undefined,
          placement: kind === "nursing_hour" ? nursingPlacement : undefined,
          until: kind === "nursing_hour" ? nursingUntil : (isNightFitness ? fitnessTo : undefined),
          nursingSplit: kind === "nursing_hour" ? nursingSplit : undefined,
          childBirthDate: kind === "nursing_hour" ? childBirthDate : undefined,
          dueDate: kind === "pregnancy_notice" ? dueDate : undefined,
          lastDay: isResignation ? (resignationRouteFor(subject?.profile) === EXIT_ROUTE_NOTICE75 ? resignationFacts({ date: today, route: EXIT_ROUTE_NOTICE75 }).noticeEndsOn : resignationFacts({ date: today }).deemedAcceptedOn) : undefined,
          employee: subject,
          attendance: isPunchKind ? attendanceOnDate(data?.personalAttendance, subject?.id, from) : undefined,
          days: isTopup ? topupDays : undefined,
          file: (isSignableKind || isStudyConsent || isNightFitness) ? supportingFile : undefined,
          files: (isTopup || isSignableKind || isStudyConsent || isNightFitness) ? files : undefined,
          paper: isSignableKind ? signedPaper : undefined,
          program: isStudyConsent ? studyProgram : undefined,
          institution: isStudyConsent ? studyInstitution : undefined,
          startDate: isStudyConsent ? studyStart : undefined,
          from: isNightFitness ? fitnessFrom : undefined,
          to: isNightFitness ? fitnessTo : undefined,
          examDate: isNightFitness ? fitnessFrom : undefined,
          permanent: isNightFitness ? fitnessPermanent : undefined,
          issuedFile: isStudyConsent && direct ? studyApprovalFile : undefined,
          status: (isStudyConsent || isNightFitness) && direct ? "approved" : undefined,
          companyId: company.id,
          otherRequests: subject?.otherRequests,
          actorId: currentUser?.id,
          requestedById: currentUser?.id,
          employeeId: subject?.id,
          lane: mode === "manage" ? "manage" : "mine",
        });
        if (!gate.ok) {
          toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
          return;
        }
        if (isCustody) {
          const placeGate = checkRaiseSignableGate({ type: otherType, file: supportingFile, paper: signedPaper });
          if (!placeGate.ok) {
            toast({ description: ar ? placeGate.reason : placeGate.reasonEn, variant: "destructive" });
            return;
          }
        }
        const saved = submitOtherRequest(company.id, subject.id, {
          type: otherType,
          title: isOther ? otherTitle.trim() : isMoney ? `${moneyKind === "advance" ? "سلفة" : "بدل"} ${Number(moneyAmount).toLocaleString("en-US")} ر.س` : undefined,
          reason: isOther ? [otherTitle.trim(), note.trim()].filter(Boolean).join(" — ") : (otherReason || note),
          amount: isMoney ? Number(moneyAmount) || 0 : undefined,
          moneyKind: isMoney ? moneyKind : undefined,
          date: isStudyConsent ? studyStart : (isNightFitness ? fitnessFrom : (needsDates ? from : undefined)),
          program: isStudyConsent ? studyProgram.trim() : undefined,
          institution: isStudyConsent ? studyInstitution.trim() : undefined,
          startDate: isStudyConsent ? studyStart : undefined,
          from: isNightFitness ? fitnessFrom : undefined,
          to: isNightFitness ? (fitnessPermanent ? "" : fitnessTo) : undefined,
          examDate: isNightFitness ? fitnessFrom : undefined,
          until: isNightFitness ? (fitnessPermanent ? "" : fitnessTo) : (kind === "nursing_hour" ? nursingUntil : undefined),
          permanent: isNightFitness ? fitnessPermanent : undefined,
          time: isPunchKind ? parsePunchClock(punchTime) : (kind === "permission" ? permFrom : undefined),
          timeTo: kind === "permission" ? permTo : undefined,
          compLeave: kind === "permission" && permComp && !permJob ? true : undefined,
          jobSearch: kind === "permission" && permJob ? true : undefined,
          placement: kind === "nursing_hour" ? nursingPlacement : undefined,
          nursingSplit: kind === "nursing_hour" ? nursingSplit : undefined,
          childBirthDate: kind === "nursing_hour" ? childBirthDate : undefined,
          dueDate: kind === "pregnancy_notice" ? dueDate : undefined,
          lastDay: isResignation ? (resignationRouteFor(subject?.profile) === EXIT_ROUTE_NOTICE75 ? resignationFacts({ date: today, route: EXIT_ROUTE_NOTICE75 }).noticeEndsOn : resignationFacts({ date: today }).deemedAcceptedOn) : undefined,
          shiftTypeId: kind === "shift_change" ? (shiftPick || null) : undefined,
          days: isTopup ? topupDays : undefined,
          files: (isTopup || isSignableKind || isStudyConsent || isNightFitness) ? ((isStudyConsent || isNightFitness) && supportingFile ? [supportingFile] : files) : (isDutyKind && supportingFile ? [supportingFile] : undefined),
          issuedFile: isStudyConsent && direct ? studyApprovalFile : undefined,
          paper: isSignableKind ? signedPaper : undefined,
          purpose: purpose.trim() || undefined,
          party: party.trim() || undefined,
          lang: isDoc ? docLang : undefined,
          showSalary: isDoc && docMeta.salary ? showSalary : undefined,
          docKind: isDoc ? doc2 : undefined,
          stationId: subject.stationId,
          status: (direct && !isSignableKind) ? "approved" : "pending",
          recordedBy: (direct && !isSignableKind) ? currentUser?.name : undefined,
          requestedBy: currentUser?.name,
          requestedById: currentUser?.id,
        });
        if (saved && saved.ok === false) {
          toast({ description: ar ? (saved.reason || "تعذّر إرسال الطلب") : (saved.reasonEn || "Could not send the request"), variant: "destructive" });
          return;
        }
      }
      toast({
        description: isCustody
          ? (ar ? "رُفعت النسخة الموقّعة يدوياً في طلباتي — القرار يبقى هنا." : "The hand-signed copy was raised in My Requests — the decision stays here.")
          : isDoc && mode !== "manage"
          ? (ar ? "أُرسل طلب الوثيقة — تصلك مختومة على هذه البطاقة بعد إصدارها." : "Letter requested — it arrives stamped on this card once issued.")
          : direct ? (ar ? "سُجّل معتمداً باسمك." : "Recorded as approved in your name.")
          : mode === "manage"
          ? (ar ? "سُجّل من الإدارة — بانتظار الاعتماد إن لزم." : "Recorded from management — awaiting approval if needed.")
          : (ar ? "سُجّل الطلب — بانتظار الاعتماد." : "Request recorded — awaiting approval."),
      });
      resetForm();
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const decide = (row, status) => {
    const subject = row.employee || self;
    const lane = mode === "manage" ? "manage" : "mine";
    const allowed = requestMayDecideOnLane({ actor: currentUser, subject, lane, data });
    if (!allowed || (lane === "manage" && !canDecide) || !company?.id) return;
    const key = `${row.family}-${row.id}`;
    const noteVal = draftNotes[key] || "";
    const noticeIssued = String(draftExamNotice[key] || row.examNoticeIssuedAt || "").slice(0, 10);
    if (status === "revise" && !noteVal.trim()) return;
    const groundedNote = refusalGroundsFor(row)?.length && draftGround[key] ? refusalText(row, draftGround[key], noteVal, ar) : noteVal;
    setBusy(true);
    try {
      if (row.family === "leave") {
        const leaveRow = noticeIssued && String(row.type || "").toLowerCase() === "exam"
          ? { ...row, examNoticeIssuedAt: noticeIssued }
          : row;
        const flags = leaveDecideFlags[key] || {};
        if (status === "approved") {
          const gate = checkApproveLeaveGate({ ...leaveRow, agreedOtherwise: flags.agreedOtherwise === true || undefined }, !!leaveKindMeta(row.type)?.requiresFile, {
            profile: row.employee?.profile,
            requests: row.employee?.leaveRequests,
            laborCalendar,
            examNoticeIssuedAt: noticeIssued || undefined,
            company: data,
            forApproval: true,
            advanceConsent: flags.advanceConsent === true,
          });
          if (!gate.ok) {
            toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
            return;
          }
        }
        if (status === "rejected") {
          const refuse = checkRejectLeaveGate(leaveRow, { nextStatus: "rejected", actor: "manager", profile: row.employee?.profile, requests: row.employee?.leaveRequests, otherRequests: row.employee?.otherRequests, companyId: company.id, examNoticeIssuedAt: noticeIssued || undefined, rejectGround: draftGround[key], rejectVerified: !!draftVerified[key] });
          if (!refuse.ok) {
            toast({ description: ar ? refuse.reason : refuse.reasonEn, variant: "destructive" });
            return;
          }
          const named = checkRefuseRequestReasonGate(groundedNote);
          if (!named.ok) {
            toast({ description: ar ? named.reason : named.reasonEn, variant: "destructive" });
            return;
          }
        }
        const decided = setLeaveRequestStatus(company.id, row.employee.id, row.id, status === "revise" ? "revise" : status, currentUser.name, status === "rejected" ? groundedNote : noteVal, {
          actorId: currentUser.id,
          rejectGround: draftGround[key],
          rejectVerified: !!draftVerified[key],
          lang,
          examNoticeIssuedAt: noticeIssued || undefined,
          advanceConsent: flags.advanceConsent === true,
          agreedOtherwise: flags.agreedOtherwise === true,
          extensionAgreedOtherwise: flags.extensionAgreedOtherwise === true,
        });
        if (decided && decided.ok === false) {
          toast({ description: ar ? decided.reason : decided.reasonEn, variant: "destructive" });
          return;
        }
        if (status === "approved" && (row.type === "unpaid" || row.type === "maternity_extend")) {
          refreshUnpaidLeaveWage(company.id, row.employee.id);
        }
      } else {
        if (status === "rejected") {
          const grounded = checkGroundedRefusalGate({ ...row, family: "other" }, { ground: draftGround[key], verified: !!draftVerified[key], actor: "manager" });
          const rejectGate = !grounded.ok ? grounded : row.type === STUDY_CONSENT_TYPE
            ? checkRejectStudyConsentGate(row, noteVal)
            : row.type === NIGHT_FITNESS_TYPE
              ? checkRejectNightFitnessGate(row, noteVal)
              : checkRefuseRequestReasonGate(groundedNote);
          if (!rejectGate.ok) {
            toast({ description: ar ? rejectGate.reason : rejectGate.reasonEn, variant: "destructive" });
            return;
          }
        }
        if (status === "rejected" && row.type !== STUDY_CONSENT_TYPE && row.type !== NIGHT_FITNESS_TYPE) {
          const named = checkRefuseRequestReasonGate(groundedNote);
          if (!named.ok) {
            toast({ description: ar ? named.reason : named.reasonEn, variant: "destructive" });
            return;
          }
        }
        const result = setOtherRequestStatus(company.id, row.employee.id, row.id, status === "revise" ? "revise" : status, currentUser.name, status === "rejected" ? groundedNote : noteVal, {
          issuedFile: draftIssued[key],
          actorId: currentUser.id,
          rejectGround: draftGround[key],
          rejectVerified: !!draftVerified[key],
        });
        if (result && result.ok === false) {
          toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
          return;
        }
      }
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const loadIssuedFile = async (row, picked) => {
    const key = `${row.family}-${row.id}`;
    if (!picked) {
      setDraftIssued((m) => ({ ...m, [key]: null }));
      setIssuedError((m) => ({ ...m, [key]: "" }));
      return;
    }
    await readPickedFile(picked, {
      setRecord: (record) => setDraftIssued((m) => ({ ...m, [key]: record })),
      setError: (error) => setIssuedError((m) => ({ ...m, [key]: error })),
      setBusy: (on) => setIssuedBusy((m) => ({ ...m, [key]: on })),
    });
  };

  const answerOt = (row, accept) => {
    if (!company?.id || row.employee?.id !== currentUser?.id) return;
    const key = `${row.family}-${row.id}`;
    setBusy(true);
    try {
      const result = answerOtAssignment(company.id, row.employee.id, row.id, {
        accept,
        compensation: otChoice[key],
        ack: !!otAck[key],
        enjoyDate: otEnjoy[key],
        windowAgreed: !!otWindowAgreed[key],
        annualCapConsent: !!otCapChoice[key],
      });
      if (!result.ok) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return;
      }
      toast({
        description: accept
          ? (otChoice[key] === "credit"
            ? (ar ? "سُجّل اختيارك: إجازة تعويضية — بانتظار اعتماد المسؤول." : "Your leave-credit choice is on file — awaiting the manager.")
            : (ar ? "سُجّل اختيارك: أجر إضافي — بانتظار اعتماد المسؤول." : "Your overtime-pay choice is on file — awaiting the manager."))
          : (ar ? "سُجّل رفضك للتكليف." : "Your refusal of the assignment is on file."),
      });
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const loadNightPaper = async (row, picked) => {
    if (!picked || !company?.id) return;
    setBusy(true);
    try {
      const [hash, url] = await Promise.all([hashConsentFile(picked), readConsentFile(picked)]);
      const result = attachWrittenConsentPaper(company.id, row.employee.id, row.id, {
        name: picked.name,
        size: picked.size,
        hash,
        url,
        type: picked.type,
      });
      if (!result.ok) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return;
      }
      refresh?.();
    } catch {
      toast({ description: ar ? "تعذّر قراءة الملف." : "Could not read the file.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const answerNight = (row, decision) => {
    if (!company?.id || row.employee?.id !== currentUser?.id) return;
    setBusy(true);
    try {
      const result = answerNightRotate(company.id, row.employee.id, row.id, decision, {
        acknowledged: decision === "refuse" || !!nightAck[`${row.family}-${row.id}`],
        paper: row.paper,
        actorId: currentUser.id,
      });
      if (!result.ok) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return;
      }
      toast({
        description: decision === "agree"
          ? (ar ? "سُجّلت موافقتك. يحق لك سحبها في أي وقت من طلباتي." : "Your consent is on file. You may withdraw it at any time from My Requests.")
          : decision === "reduce"
            ? (ar ? "سُجّل تقليص الساعات — خرجت من صفة العامل الليلي." : "Reduced hours recorded — you are no longer a night worker.")
          : (ar ? "سُجّل رفضك — دُوِّرت الفترة إلى ساعات معتادة." : "Your refusal is on file — the period rotated to ordinary hours."),
      });
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const withdrawNight = (row) => {
    if (!company?.id || row.employee?.id !== currentUser?.id) return;
    setBusy(true);
    try {
      const result = withdrawNightRotate(company.id, row.employee.id, row.id, {
        acknowledged: !!nightAck[`${row.family}-${row.id}`],
        actorId: currentUser.id,
      });
      if (!result.ok) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return;
      }
      toast({ description: ar ? "سُحبت الموافقة. يُدوَّر العمل لساعات عادية شهراً على الأقل." : "Consent withdrawn. Work rotates to ordinary hours for at least one month." });
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const remindNight = (row) => {
    if (!company?.id || !currentUser?.id) return;
    setBusy(true);
    try {
      const result = remindNightDue(company.id, row.employee.id, { byId: currentUser.id, byName: currentUser.name });
      if (!result.ok) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return;
      }
      toast({ description: ar ? "أُرسل تذكير إلى ملفي. لم يُغلق الطلب ولم تُسجَّل موافقة." : "A reminder was sent to My file. The request was not closed and no consent was recorded." });
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const withdraw = (row, opts = {}) => {
    if (!company?.id) return;
    if (row.family === "leave") {
      const result = setLeaveRequestStatus(company.id, row.employee.id, row.id, "withdrawn", currentUser.name, "", {
        actorId: currentUser.id,
        lang,
        employeeConsent: row.status === "approved" ? opts.consent === true : true,
      });
      if (result && result.ok === false) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return;
      }
    } else {
      const lock = checkRevokeStudyConsentGate(row, "withdrawn");
      if (!lock.ok) {
        toast({ description: ar ? lock.reason : lock.reasonEn, variant: "destructive" });
        return;
      }
      const result = setOtherRequestStatus(company.id, row.employee.id, row.id, "withdrawn", currentUser.name);
      if (result && result.ok === false) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return;
      }
    }
    refresh?.();
  };

  const seeDecision = (row) => {
    if (!company?.id || row.employee?.id !== currentUser?.id) return;
    setBusy(true);
    try {
      const result = markLeaveDecisionSeen(company.id, row.employee.id, row.id, { actorId: currentUser.id });
      if (result && result.ok === false) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return;
      }
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const refile = (row) => {
    if (!company?.id) return;
    if (row.family === "leave") setLeaveRequestStatus(company.id, row.employee.id, row.id, "pending", currentUser.name);
    else {
      const lock = checkRevokeStudyConsentGate(row, "pending");
      if (!lock.ok) {
        toast({ description: ar ? lock.reason : lock.reasonEn, variant: "destructive" });
        return;
      }
      const result = setOtherRequestStatus(company.id, row.employee.id, row.id, "pending", currentUser.name);
      if (result && result.ok === false) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return;
      }
    }
    refresh?.();
  };

  const attachExamSat = async (row, picked) => {
    const key = `${row.family}-${row.id}`;
    if (!picked || !company?.id || !row.employee?.id) return;
    if (!isAllowedSupportingFile(picked)) {
      setExamSatError((m) => ({ ...m, [key]: ar ? "الصيغ المدعومة: PDF، JPG، PNG، WEBP." : "Supported formats: PDF, JPG, PNG, WEBP." }));
      return;
    }
    if (picked.size > SUPPORTING_FILE_MAX_BYTES) {
      setExamSatError((m) => ({ ...m, [key]: ar ? "يجب ألا يتجاوز حجم الملف 10 ميجابايت." : "The file must not exceed 10 MB." }));
      return;
    }
    setExamSatBusy((m) => ({ ...m, [key]: true }));
    setExamSatError((m) => ({ ...m, [key]: "" }));
    try {
      const record = await readSupportingFile(picked);
      const result = attachExamSatProof(company.id, row.employee.id, row.id, record, {
        actorId: currentUser?.id,
        actorName: currentUser?.name,
        lang,
      });
      if (result && result.ok === false) {
        setExamSatError((m) => ({ ...m, [key]: ar ? result.reason : result.reasonEn }));
        return;
      }
      toast({ description: ar ? "رُفع إثبات أداء الامتحان على البطاقة." : "Exam-sitting proof is on the card." });
      refresh?.();
    } catch {
      setExamSatError((m) => ({ ...m, [key]: ar ? "تعذّر قراءة الملف." : "Could not read the file." }));
    } finally {
      setExamSatBusy((m) => ({ ...m, [key]: false }));
    }
  };

  const grant = () => {
    if (!canDecide || !company?.id || !subject?.id) return;
    const result = grantDiscretionaryDays(company.id, subject.id, { days: grantDays, reason: grantReason, by: currentUser.name });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    setGrantReason("");
    refresh?.();
  };

  const sendLabel = canSend && manageLeave
    ? (ar ? `سجّل الإجازة معتمدة باسم ${subject?.name || "الموظف"}` : `Record the leave approved for ${subject?.name || "the worker"}`)
    : canSend
    ? (isOtAssign
      ? (ar ? "أرسل التكليف إلى الموظف" : "Send the assignment to the worker")
      : isLeaveCredit
      ? (ar ? "أضف الرصيد الآن" : "Credit the balance now")
      : isStudyConsent
      ? (ar ? "اطلب موافقة دراسية" : "Request study consent")
      : isNightFitness
      ? (ar ? "أرسل تقرير اللياقة الليلية" : "Submit the night-fitness report")
      : isTopup
      ? (ar ? "اطلب زيادة الرصيد" : "Request more leave days")
      : isDoc
      ? (mode === "manage"
        ? (ar ? "سجّل طلب الوثيقة باسم الموظف" : "File the letter request for the worker")
        : (ar ? `أرسل الطلب إلى ${docMeta.approverAr || "الموارد البشرية"}` : `Send to ${docMeta.approverEn || "HR"}`))
      : isSignableKind
      ? (ar ? "ارفع النسخة الموقّعة يدوياً — في طلباتي" : "Raise the hand-signed copy — in My Requests")
      : mode === "manage"
      ? (isOther
        ? (ar ? "أرسل الطلب باسم الإدارة" : "Send the request as management")
        : (ar ? "أرسل من الإدارة" : "Send as management"))
      : clash.length
      ? (ar ? "أرسل الطلب — مع تنبيه التقاطع" : "Send — with the clash warning")
      : (ar ? "أرسل الطلب إلى مديرك" : "Send the request to your manager"))
    : (selfOnly
      ? (ar ? "أكمل الشروط لإرسال الطلب" : "Complete the checks to send")
      : (ar ? countAr(blockers.length, "مانع واحد قبل الإرسال", "مانعان قبل الإرسال", "موانع قبل الإرسال", "مانعاً قبل الإرسال") : `${blockers.length} blockers before send`));

  const openRegister = (id) => {
    if (!id) return;
    setRegisterId(id);
    setEmployeeId(id);
    const pending = liveInboxRows(
      employees.filter((row) => String(row.id) === String(id)),
      lang,
      { lane: "manage" },
    ).find((row) => isPendingDecideStatus(row.status));
    if (pending) {
      setFocusKey(`${pending.family}-${pending.id}`);
      setStFilter("pending");
    }
  };

  const pickPending = (row) => {
    if (!row) return;
    const key = `${row.family}-${row.id}`;
    setFocusKey(key);
    setStFilter("pending");
    if (row.employee?.id) openRegister(row.employee.id);
  };

  const filters = useMemo(() => {
    const archiveCount = mode === "manage"
      ? manageArchiveRows(employees, lang, { stations, stationId: focusStationId || "all" }).rows.length
      : mineArchiveRows(employees, currentUser || self, lang).rows.length;
    if (mode !== "manage") {
      const owned = flattenWorkspaceRows(employees, lang).filter((row) => isOwnMineLaneRow(row, currentUser || self));
      const bucket = (row) => {
        const st = row.status || "pending";
        if (st === "rejected" || st === "refused_by_employee" || st === "no") return "rejected";
        if (st === "approved") return "approved";
        return "pending";
      };
      const chips = [
        ["all", ar ? "الكل" : "All", owned.length],
        ["pending", ar ? "بانتظار" : "Pending", owned.filter((row) => isMinePendingListRow(row, currentUser || self)).length],
        ["approved", ar ? "معتمدة" : "Approved", owned.filter((row) => bucket(row) === "approved").length],
        ["rejected", ar ? "مرفوضة" : "Refused", owned.filter((row) => bucket(row) === "rejected").length],
        ["archive", ar ? "الأرشيف" : "Archive", archiveCount],
      ];
      return chips.map(([id, label, n]) => ({ id, label, n }));
    }
    return ([
      ["all", ar ? "الكل" : "All"],
      ["pending", ar ? "بانتظار قرار" : "Pending"],
      ["revise", ar ? "يحتاج تعديلاً" : "Needs a change"],
      ["archive", ar ? "الأرشيف" : "Archive"],
    ].map(([id, label]) => {
      if (id === "archive") {
        return { id, label, n: archiveCount };
      }
      const n = id === "all" ? scopedRows.length : scopedRows.filter((row) => {
        const st = row.status || "pending";
        if (id === "ok") return st === "approved";
        if (id === "no") return st === "rejected" || st === "refused_by_employee";
        if (id === "withdrawn") return st === "withdrawn";
        if (id === "pending") return st === "pending" || st === "pending_employee" || st === "pending_manager" || (mode === "mine" && isUnseenApprovedLeave(row));
        return st === id;
      }).length;
      return { id, label, n };
    }));
  }, [ar, scopedRows, mode, employees, lang, stations, focusStationId, currentUser, self, initialFilter]);

  const withdrawArchivedLeave = (row) => {
    if (!company?.id || !row.employeeId || !row.requestId) return;
    const result = setLeaveRequestStatus(company.id, row.employeeId, row.requestId, "withdrawn", currentUser?.name, "", {
      actorId: currentUser?.id,
      lang,
      employeeConsent: true,
    });
    if (result && result.ok === false) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    refresh?.();
  };

  if (mode === "manage" && employees.length === 0) {
    return (
      <div className="nv-req-workspace" dir={ar ? "rtl" : "ltr"} style={{ ...slab, padding: "22px 20px" }}>
        <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.85 }}>
          {ar
            ? "لا موظف في الفروع التي تديرها. إدارة الطلبات تظهر لكل من تعمل تحت فروعك — لا تُخفى بفرع الرأس."
            : "Nobody sits in the stations you manage. Request admin covers everyone under your branches — the header station does not hide them."}
        </span>
      </div>
    );
  }

  return (
    <div className="nv-req-workspace" dir={ar ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {selfOnly ? <WrittenConsentInbox employees={employees} currentUser={currentUser} ar={ar} refresh={refresh} /> : null}
      {mode === "manage" ? (
        <PendingRequestFinder
          rows={rows}
          stations={stations}
          value={focusKey}
          onChange={pickPending}
          ar={ar}
          compact
          label={ar ? "بحث" : "Search"}
        />
      ) : null}
      <div className={`nv-req-grid${mode === "manage" ? " is-manage-register" : " is-employee-face"}`}>
        {mode === "manage" ? (
          <ManagerEmployeeRegister
            employees={employees}
            stations={stations}
            lang={lang}
            selectedId={registerId || employeeId}
            companyId={company?.id}
            recording={fileRecordOpen}
            focusStationId={focusStationId}
            onSelect={(id) => {
              openRegister(id);
              setFileRecordOpen(false);
            }}
            onRecord={(id) => {
              openRegister(id);
              setFileRecordOpen(true);
            }}
            onHideRecord={() => setFileRecordOpen(false)}
            onFocusStation={(id) => setStationScope(id || "all")}
          />
        ) : null}
        {(showRaiseForm || (mode === "manage" && canDecide)) ? (
        <RaiseFold manage={mode === "manage"} open={fileRecordOpen} onOpen={setFileRecordOpen} ar={ar}>
        {showRaiseForm && selfOnly ? (
        <section style={{ ...slab, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <strong style={{ fontSize: 15 }}>{ar ? "طلب جديد" : "New request"}</strong>
            <span style={{ fontSize: 11.5, color: MUTED }}>{ar ? "اختر نوع الطلب" : "Pick a request type"}</span>
          </div>
          <div className="nv-req-kind-grid">
            {mineTiles.map((tile) => (
              <KindFrameCard
                key={tile.id}
                on={tileOn(tile)}
                letter={tile.letter}
                title={ar ? tile.ar : tile.en}
                hint={ar ? tile.hintAr : tile.hintEn}
                onClick={() => pickTile(tile)}
              />
            ))}
          </div>
          {dutySubGrid}
          {selfOnly && (isLeave || isTopup) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: "1px solid #EEF1EF" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{ar ? "نوع الإجازة" : "Leave type"}</strong>
                <span style={{ fontSize: 11, color: MUTED }}>{ar ? "كل نوع بمادته واستحقاقه" : "Each type with its article and entitlement"}</span>
              </div>
              {!profileGender(subject?.profile) ? (
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                  {ar ? "صنّف الجنس في الملف الشخصي لتظهر إجازات الأمومة والعدّة أو الأبوة." : "Classify gender on the personal file so maternity, iddah or paternity appear."}
                </span>
              ) : null}
              {profileGender(subject?.profile) === "female" ? (
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                  {ar
                    ? "وفاة الزوج تُطلب من العدّة (المادة 160) لا من خمسة أيام. المادة 113 هنا أصل أو فرع فقط."
                    : "Husband death is requested as iddah (Article 160), not the five-day type. Article 113 here is parent or child only."}
                </span>
              ) : null}
              {!religionOnFile({ profile: subject?.profile }) ? (
                <span data-religion-missing="1" style={{ fontSize: 11.5, color: "var(--nv-warn-ink, #8A5A12)", lineHeight: 1.7, fontWeight: 600 }}>
                  {ar
                    ? (mode === "manage"
                      ? "الديانة غير محددة في ملف الموظف — لا تظهر له إجازة الحج ولا العدة حتى تحددها من ملفه (الهوية والتوظيف)."
                      : "ديانتك غير محددة في ملفك — لا تظهر لك إجازة الحج ولا العدة حتى تحددها الموارد البشرية.")
                    : "Religion is not on file — Hajj and iddah stay hidden until HR sets it."}
                </span>
              ) : null}
              {profileGender(subject?.profile) === "female" && religionOnFile({ profile: subject?.profile }) === "non_muslim" ? (
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                  {ar ? "غير مسلمة على الملف: العدّة 15 يوماً، ولا حج." : "Non-Muslim on file: 15-day iddah, and no Hajj."}
                </span>
              ) : null}
              <div className="nv-req-kind-grid">
                {leaveKinds.filter((row) => row.key !== "grant").map((row) => {
                  const title = ar ? row.ar : row.en;
                  return (
                    <KindFrameCard
                      key={row.key}
                      on={isLeave && leave === row.key}
                      letter={leadingLetter(title)}
                      title={title}
                      hint={row.cap}
                      onClick={() => pickLeaveType(row)}
                    />
                  );
                })}
                <KindFrameCard
                  on={isTopup}
                  letter={leadingLetter(ar ? "رفع رصيد إجازة" : "Leave balance top-up")}
                  title={ar ? "رفع رصيد إجازة" : "Leave balance top-up"}
                  hint={ar ? "رصيد مرحّل · بلا تاريخ — الإضافي له رصيده التعويضي" : "Carried balance · no dates — overtime has its own comp balance"}
                  onClick={() => { setKind("leave_topup"); setEmployerAck(false); }}
                />
              </div>
              {isLeave && leave === "comp" ? (() => {
                // Regs 22 bis — the comp balance is in hours, apart from annual leave.
                const bal = compBalance(subject);
                return (
                  <div data-comp-balance="1" style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--nv-ok-line)", background: "var(--nv-ok-soft)" }}>
                    <strong style={{ fontSize: 13, color: "#0B3D27" }}>
                      {bal.left > 0
                        ? (ar ? `رصيدك التعويضي: ${hoursAr(bal.left)} (${compDays(bal.left)} يوم عمل)` : `Comp balance: ${bal.left} h`)
                        : (ar ? "لا رصيد إجازة تعويضية بعد" : "No comp balance yet")}
                    </strong>
                    <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.75 }}>
                      {bal.left > 0
                        ? (ar
                          ? `اليوم الكامل يأخذ 8 ساعات من رصيدك. ${bal.nextTakeBy ? `تمتع بها حتى ${formatArDate(bal.nextTakeBy, lang)} ما لم يُتفق على موعد أبعد. ` : ""}أقل من يوم؟ اطلبه ساعاتٍ من «طلبات الدوام ← استئذان» واختر «من رصيدي التعويضي».`
                          : "A full day takes 8 hours. Less than a day? Ask for hours from Duty requests → Permission and tick “from my comp balance”.")
                        : (ar ? "يتكوّن حين تقبل تكليفاً إضافياً وتختار الإجازة بدل الأجر — ساعة ونصف عن كل ساعة (المادة 107 · اللائحة 22 مكرر)." : "It builds when you take leave instead of overtime pay — 1.5 hours per hour (Art. 107 · regs 22 bis).")}
                    </span>
                  </div>
                );
              })() : null}
            </div>
          ) : null}
          {selfOnly && (isNightFitness || isNightSideKind) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: "1px solid var(--nv-line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{ar ? "طلبات العمل الليلي" : "Night-work requests"}</strong>
                <LawGateArticleBadge article="18632" />
              </div>
              <NightWorkDefinition
                ar={ar}
                windowText={ar ? "الليل من الساعة 23 إلى الساعة 6. المسائي من 15 إلى 23 خارج الليل." : "Night is 23:00 to 06:00. Evening 15:00–23:00 is outside night."}
                performerText={ar ? "أي دقيقة داخل النافذة." : "Any minute in the window."}
                workerText={ar ? "ثلاث ساعات فأكثر داخل النافذة." : "Three hours or more in the window."}
              />
              <NightWorkRightsTable ar={ar} rows={nightWorkRequestRights()} />
              <div className="nv-req-kind-grid">
                {nightWorkRequestRights().map((row) => (
                  <KindFrameCard
                    key={row.id}
                    on={isNightFitness && nightRight === row.id}
                    letter={row.letter}
                    title={ar ? row.ar : row.en}
                    hint={ar
                      ? `${row.performer ? "يؤدي عملاً ليلياً" : "عامل ليلي فقط"} · ${row.hintAr}`
                      : `${row.performer ? "Performs night work" : "Night worker only"} · ${row.hintEn}`}
                    onClick={() => { setKind("night_fitness"); setNightRight(row.id); }}
                  />
                ))}
                {allowedKinds.some((row) => row.id === "family_duties") ? (
                  <KindFrameCard
                    key="family_duties"
                    on={kind === "family_duties"}
                    letter={ar ? "ع" : "F"}
                    title={ar ? "إبلاغ بمسؤوليات عائلية" : "Family responsibilities notice"}
                    hint={ar ? "يؤدي عملاً ليلياً · مراعاة في الإسناد الليلي (هـ)" : "Performs night work · considered for night assignment (e)"}
                    onClick={() => { setKind("family_duties"); setFrom((prev) => prev || today); setTo((prev) => prev || today); }}
                  />
                ) : null}
              </div>
              {isNightFitnessRaise ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6 }}>
                  <button type="button" onClick={() => setFitnessPermanent(false)} style={leaveTypeChip(!fitnessPermanent)}>
                    <strong style={{ fontSize: 12.5 }}>{ar ? "بين تاريخين" : "Between two dates"}</strong>
                    <span style={{ fontSize: 11, color: "var(--nv-ink2)" }}>{ar ? `${NIGHT_FITNESS_RANGE_AR} — تسقط بعد تاريخ النهاية` : `${NIGHT_FITNESS_RANGE_EN} — it lapses after the end date`}</span>
                  </button>
                  <button type="button" onClick={() => { setFitnessPermanent(true); setFitnessTo(""); }} style={leaveTypeChip(fitnessPermanent)}>
                    <strong style={{ fontSize: 12.5 }}>{ar ? "مفتوحة حتى التراجع" : "Open until withdrawn"}</strong>
                    <span style={{ fontSize: 11, color: "var(--nv-ink2)" }}>{ar ? `${NIGHT_FITNESS_PERMANENT_AR} — سارية حتى تسحبها أو تنتهي اللياقة` : `${NIGHT_FITNESS_PERMANENT_EN} — valid until you withdraw or fitness ends`}</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
        ) : null}
        {showRaiseForm ? (
        <section className="nv-req-leave-sheet" style={{ ...slab, display: "flex", flexDirection: "column" }}>
          <div className="nv-req-leave-head">
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="nv-req-title" style={{ fontSize: 14 }}>
                {mode === "manage" ? (ar ? "رفع طلب لموظف" : "File a request for a worker") : (_kindTitle || (ar ? "طلب جديد" : "New request"))}
              </span>
              {mode !== "manage" && isLeave && leave === "sick" ? <LaborArticleCite article="117" ar={ar} entitlement /> : null}
              {mode !== "manage" && isLeave && leave !== "sick" && leaveMeta?.article ? <LaborArticleCite article={leaveMeta.article} ar={ar} entitlement /> : null}
              {mode !== "manage" && isStudyConsent ? <LaborArticleCite article="115" ar={ar} entitlement /> : null}
            </span>
            {mode === "manage" || !selfOnly ? (
            <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
              {mode === "manage"
                ? (ar ? "باسمك كمدير، يُحفظ في ملف الموظف. الإجازات والوثائق يرفعها الموظف؛ أنت تعتمد أو ترفض." : "In your name as manager, it is filed on the employee. Leave and documents are raised by the worker; you approve or refuse.")
                : (ar ? "اختر النوع — الشروط والأثر يُقرآن من نظام العمل." : "Pick the type — conditions and effect are read from the Labour Law.")}
            </span>
            ) : null}
          </div>

          {!selfOnly && (
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 8 }}>
              <RequestEmployeePicker
                employees={employees}
                stations={stations}
                value={employeeId}
                onChange={setEmployeeId}
                ar={ar}
              />
              {mode === "manage" ? (
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                  {ar
                    ? isLeaveCredit
                      ? `الفاعل هو المدير. الرصيد السنوي ${remainingAnnualLabel(subject?.profile, subject?.leaveRequests, lang)} · تقديري ${annual.leftoverGrants} أيام.`
                      : "الفاعل هو المدير. الرصيد يُراجع عند إضافة الرصيد أو عند القرار أو من ملف الموظف."
                    : isLeaveCredit
                      ? `The actor is the manager. Annual ${remainingAnnualLabel(subject?.profile, subject?.leaveRequests, lang)} · discretionary ${annual.leftoverGrants} days.`
                      : "The actor is the manager. Balance is reviewed on leave credit, at decision time, or on the employee file."}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                  {ar
                    ? `رصيده السنوي ${remainingAnnualLabel(subject?.profile, subject?.leaveRequests, lang)} · تقديري ${annual.leftoverGrants} أيام`
                    : `Annual ${remainingAnnualLabel(subject?.profile, subject?.leaveRequests, lang)} · discretionary ${annual.leftoverGrants} days`}
                </span>
              )}
            </div>
          )}

          {mode === "manage" ? (
          <div className="nv-req-kind-grid" data-manage-kinds="1" style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)" }}>
            {kindChips.map((row) => {
              const meta = MANAGE_KIND_HINTS[row.id] || {};
              const title = meta.ar ? (ar ? meta.ar : meta.en) : (ar ? row.ar : row.en);
              return (
                <KindFrameCard
                  key={row.id}
                  on={!consentPicked && kind === row.id}
                  letter={leadingLetter(title)}
                  title={title}
                  hint={ar ? meta.hintAr : meta.hintEn}
                  onClick={() => { setConsentPicked(false); setKind(row.id); }}
                />
              );
            })}
            {canDecide ? (
              <KindFrameCard
                key="written_consent"
                on={consentPicked}
                letter={ar ? "م" : "C"}
                title={ar ? "طلب موافقة خطية" : "Written consent"}
                hint={ar ? "م 58 · 59 · 60 — نقل، فئة أجر، عمل مختلف" : "Arts. 58 · 59 · 60 — move, wage type, different work"}
                onClick={() => setConsentPicked(true)}
              />
            ) : null}
          </div>
          ) : selfOnly ? null : (
          <div className="nv-req-kind-grid" style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)" }}>
            {mineTiles.map((tile) => (
              <KindFrameCard
                key={tile.id}
                on={tileOn(tile)}
                letter={tile.letter}
                title={ar ? tile.ar : tile.en}
                hint={ar ? tile.hintAr : tile.hintEn}
                onClick={() => pickTile(tile)}
              />
            ))}
            {dutySubGrid ? <div style={{ gridColumn: "1 / -1" }}>{dutySubGrid}</div> : null}
          </div>
          )}

          {mode === "manage" && consentPicked ? (
            <WrittenConsentRaise employees={employees} employeeId={employeeId} ar={ar} refresh={refresh} />
          ) : kind === "rights" && mode !== "manage" ? (
            <RightsRequestRaise employee={subject} companyId={company?.id} ar={ar} refresh={refresh} />
          ) : (<>
          {isStudyConsent && (
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? STUDY_CONSENT_LABEL_AR : STUDY_CONSENT_LABEL_EN}</span>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.75 }}>{ar ? STUDY_CONSENT_SUBTITLE_AR : STUDY_CONSENT_SUBTITLE_EN}</span>
              <LaborArticleCite article="115" ar={ar} showOfficial showText entitlement />
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
                {ar
                  ? "هذا الطلب يسجّل موافقة المنشأة على الانتساب أو الاستمرار في مؤسسة تعليمية أثناء الخدمة — مسار إجازة الامتحان بأجر (المادة 115). الدراسة نفسها لا تتوقف إن رُفضت الموافقة؛ أيام الامتحان تُحسب حينها من السنوية أو بدون أجر."
                  : "This request records the establishment's agreement to enrol or continue in an educational institution during service — the paid exam-leave track (Article 115). Refusal does not stop studying; exam days then come from annual leave or unpaid."}
              </span>
              {studyUnlocked ? (
                <span style={{ fontSize: 12, color: OK, lineHeight: 1.8 }}>
                  {ar
                    ? `${STUDY_CONSENT_IRREVOCABLE_AR}${studyState.request?.approvedAt ? ` اعتُمدت في ${formatArDate(studyState.request.approvedAt, lang)}.` : ""} مسار إجازة الامتحان مدفوع.`
                    : `${STUDY_CONSENT_IRREVOCABLE_EN}${studyState.request?.approvedAt ? ` Approved on ${formatArDate(studyState.request.approvedAt, lang)}.` : ""} The exam-leave track is paid.`}
                </span>
              ) : null}
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: MUTED }}>{ar ? "البرنامج أو التخصص" : "Program or field"}</span>
                <input value={studyProgram} onChange={(e) => setStudyProgram(e.target.value)} placeholder={ar ? "مثال: بكالوريوس إدارة أعمال" : "e.g. B.A. in business"} style={fieldStyle()} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: MUTED }}>{ar ? "المؤسسة التعليمية" : "Educational institution"}</span>
                <input value={studyInstitution} onChange={(e) => setStudyInstitution(e.target.value)} placeholder={ar ? "مثال: جامعة الملك سعود" : "e.g. King Saud University"} style={fieldStyle()} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: MUTED }}>{ar ? "بداية الدراسة" : "Study start"}</span>
                <PlatformDateField ar={ar} value={studyStart} onChange={setStudyStart} />
              </label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "ملاحظة اختيارية — الجدول أو المرحلة" : "Optional note — schedule or stage"} style={fieldStyle()} />
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, color: MUTED }}>{ar ? "مرفق الانتساب — إلزامي، صورة أو PDF" : "Enrolment file — required, image or PDF"}</span>
                <AttachFileButton
                  ref={fileInputRef}
                  ar={ar}
                  accept={SUPPORTING_FILE_ACCEPT}
                  busy={fileBusy}
                  label={ar ? "أرفق خطاب القبول أو الجدول" : "Attach the acceptance letter or schedule"}
                  onPick={onSupportingFile}
                />
                {supportingFile?.name ? (
                  <span style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
                    {supportingFile.url ? (
                      <a href={supportingFile.url} download={supportingFile.name} style={{ color: OK, fontWeight: 600, textDecoration: "none" }}>
                        {supportingFile.name}{supportingFile.size ? ` · ${formatFileSize(supportingFile.size, ar)}` : ""}
                      </a>
                    ) : (
                      <span style={{ color: OK, fontWeight: 600 }}>{supportingFile.name}</span>
                    )}
                    <button type="button" onClick={clearSupportingFile} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "4px 10px", border: `1px solid ${BORDER}`, background: CARD, color: MUTED, cursor: "pointer" }}>
                      {ar ? "أزل المرفق" : "Remove"}
                    </button>
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.8 }}>
                    {fileBusy ? (ar ? "جارٍ قراءة الملف…" : "Reading the file…") : (ar ? "أرفق خطاب القبول أو الجدول أو إثبات الانتساب. لا يُطلب توقيع رقمي." : "Attach the acceptance letter, schedule, or enrolment proof. Digital signing is not required.")}
                  </span>
                )}
                {fileError ? <span style={{ fontSize: 11, color: BAD }}>{fileError}</span> : null}
              </label>
              {canDecide ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "ملف الموافقة — إلزامي عند التسجيل المباشر" : "Consent letter — required on a direct record"}</span>
                  <AttachFileButton
                    ar={ar}
                    accept={SUPPORTING_FILE_ACCEPT}
                    busy={fileBusy}
                    label={ar ? "أرفق ملف الموافقة" : "Attach the consent letter"}
                    onPick={(picked) => {
                      if (!picked) {
                        setStudyApprovalFile(null);
                        return;
                      }
                      readPickedFile(picked, {
                        setRecord: setStudyApprovalFile,
                        setError: setFileError,
                        setBusy: setFileBusy,
                      });
                    }}
                  />
                  {studyApprovalFile?.name ? (
                    <span style={{ fontSize: 11, color: OK, fontWeight: 600 }}>{studyApprovalFile.name}</span>
                  ) : (
                    <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.8 }}>{ar ? "ارفع ملف الموافقة إذا سجّلت الاعتماد مباشرة." : "Upload the consent letter if you record approval directly."}</span>
                  )}
                </label>
              ) : null}
            </div>
          )}

          {isNightFitness && mode !== "manage" && !isNightFitnessRaise && nightRightMeta ? (
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink)" }}>{ar ? nightRightMeta.ar : nightRightMeta.en}</span>
                <LaborArticleCite decisionId="18632" ar={ar} showOfficial showText entitlement />
              </span>
              <LawGateAlertRow
                slab
                ar={ar}
                status={nightRightMeta.performer ? "settled" : "void"}
                article="18632"
                summary={(
                  <span>
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                      <LawGateStatusPill
                        ar={ar}
                        status={nightRightMeta.performer ? "settled" : "void"}
                        label={nightRightMeta.performer
                          ? (ar ? "يؤدي عملاً ليلياً · استقرّ" : "Performs night work · settled")
                          : (ar ? (nightRightMeta.performerNoteAr || "يؤدي عملاً ليلياً · بلا أثر") : (nightRightMeta.performerNoteEn || "Performs night work · no effect"))}
                      />
                      <LawGateStatusPill ar={ar} status="settled" label={ar ? "عامل ليلي · استقرّ" : "Night worker · settled"} />
                    </span>
                    <span style={{ display: "block", color: "var(--nv-ink2)" }}>{ar ? nightRightMeta.hintAr : nightRightMeta.hintEn}</span>
                    <span style={{ display: "block", marginTop: 4, color: "var(--nv-muted)" }}>{ar ? nightRightMeta.whereAr : nightRightMeta.whereEn}</span>
                  </span>
                )}
              />
            </div>
          ) : null}

          {isNightFitnessRaise && mode !== "manage" && (
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? NIGHT_FITNESS_LABEL_AR : NIGHT_FITNESS_LABEL_EN}</span>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.75 }}>{ar ? NIGHT_FITNESS_SUBTITLE_AR : NIGHT_FITNESS_SUBTITLE_EN}</span>
              <LaborArticleCite decisionId="18632" ar={ar} showOfficial showText entitlement />
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
                {ar ? NIGHT_FITNESS_RECORD_ONLY_AR : NIGHT_FITNESS_RECORD_ONLY_EN}
              </span>
              {!selfOnly ? (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setFitnessPermanent(false)} style={chip(!fitnessPermanent)}>
                  {ar ? NIGHT_FITNESS_RANGE_AR : NIGHT_FITNESS_RANGE_EN}
                </button>
                <button type="button" onClick={() => { setFitnessPermanent(true); setFitnessTo(""); }} style={chip(fitnessPermanent)}>
                  {ar ? NIGHT_FITNESS_PERMANENT_AR : NIGHT_FITNESS_PERMANENT_EN}
                </button>
              </div>
              ) : null}
              {fitnessPermanent ? (
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.75 }}>
                  {ar ? "دائم — لا تاريخ نهاية. يبقى سارياً حتى يُستبدل أو يُوسم غير لائق." : "Permanent — no end date. It stays valid until replaced or marked unfit."}
                </span>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 9 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, color: MUTED }}>{ar ? NIGHT_FITNESS_FROM_AR : NIGHT_FITNESS_FROM_EN}</span>
                    <PlatformDateField ar={ar} value={fitnessFrom} onChange={setFitnessFrom} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, color: MUTED }}>{ar ? NIGHT_FITNESS_TO_AR : NIGHT_FITNESS_TO_EN}</span>
                    <PlatformDateField ar={ar} value={fitnessTo} onChange={setFitnessTo} />
                  </label>
                </div>
              )}
              {!fitnessPermanent ? null : (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? `${NIGHT_FITNESS_FROM_AR} — اختياري` : `${NIGHT_FITNESS_FROM_EN} — optional`}</span>
                  <PlatformDateField ar={ar} value={fitnessFrom} onChange={setFitnessFrom} />
                </label>
              )}
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "ملاحظة اختيارية — العيادة أو رقم التقرير" : "Optional note — clinic or report number"} style={fieldStyle()} />
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, color: MUTED }}>{ar ? "تقرير اللياقة — إلزامي، صورة أو PDF" : "Fitness report — required, image or PDF"}</span>
                <AttachFileButton
                  ref={fileInputRef}
                  ar={ar}
                  accept={SUPPORTING_FILE_ACCEPT}
                  busy={fileBusy}
                  label={ar ? "أرفق تقرير اللياقة" : "Attach the fitness report"}
                  onPick={onSupportingFile}
                />
                {supportingFile?.name ? (
                  <span style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
                    {supportingFile.url ? (
                      <a href={supportingFile.url} download={supportingFile.name} style={{ color: OK, fontWeight: 600, textDecoration: "none" }}>
                        {supportingFile.name}{supportingFile.size ? ` · ${formatFileSize(supportingFile.size, ar)}` : ""}
                      </a>
                    ) : (
                      <span style={{ color: OK, fontWeight: 600 }}>{supportingFile.name}</span>
                    )}
                    <button type="button" onClick={clearSupportingFile} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "4px 10px", border: `1px solid ${BORDER}`, background: CARD, color: MUTED, cursor: "pointer" }}>
                      {ar ? "أزل المرفق" : "Remove"}
                    </button>
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.8 }}>
                    {fileBusy ? (ar ? "جارٍ قراءة الملف…" : "Reading the file…") : (ar ? "أرفق تقرير اللياقة الطبية للعمل الليلي. لا يُطلب توقيع رقمي." : "Attach the night-work medical fitness report. Digital signing is not required.")}
                  </span>
                )}
                {fileError ? <span style={{ fontSize: 11, color: BAD }}>{fileError}</span> : null}
              </label>
            </div>
          )}

          {isDoc && (
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "نوع الوثيقة" : "Document type"}</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 6 }}>
                {DOC_KINDS.map((row) => (
                  <button key={row.id} type="button" onClick={() => { setDoc2(row.id); setShowSalary(row.salary); }} style={pickBox(doc2 === row.id)}>
                    <span style={{ fontWeight: doc2 === row.id ? 700 : 500, color: NAVY }}>{ar ? row.ar : row.en}</span>
                    <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.6 }}>
                      {(row.salary ? (ar ? "يذكر الراتب · " : "States salary · ") : (ar ? "بلا راتب · " : "No salary · "))}
                      {ar ? `اعتماد: ${row.approverAr}` : `Approval: ${row.approverEn}`}
                    </span>
                  </button>
                ))}
              </div>
              {docMeta.id === "exp" ? (
                <div data-art64="1" style={{ border: "1px solid var(--nv-line)", borderInlineStart: "3px solid #0B3D27", borderRadius: 8, background: "var(--nv-soft, #F7F9F8)", padding: "9px 12px", fontSize: 11.5, lineHeight: 1.8, color: "var(--nv-ink2)" }}>
                  {ar ? SERVICE_CERT_AR : SERVICE_CERT_EN}
                </div>
              ) : null}
              {docMeta.custom && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "اسم الوثيقة المطلوبة" : "Document name"}</span>
                  <input value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder={ar ? "مثال: خطاب تعريف لشركة تأمين" : "e.g. introduction for an insurer"} style={fieldStyle()} />
                </label>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 9 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الغرض" : "Purpose"}</span>
                  <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={ar ? "مثال: تمويل عقاري" : "e.g. a mortgage"} style={fieldStyle()} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الجهة الموجّه إليها" : "Addressee"}</span>
                  <input value={party} onChange={(e) => setParty(e.target.value)} placeholder={ar ? "مثال: بنك الرياض" : "e.g. Riyad Bank"} style={fieldStyle()} />
                </label>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "اللغة" : "Language"}</span>
                  {[["ar", ar ? "عربي" : "Arabic"], ["en", ar ? "إنجليزي" : "English"]].map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setDocLang(id)} style={chip(docLang === id)}>{label}</button>
                  ))}
                </span>
                <button
                  type="button"
                  disabled={!docMeta.salary}
                  onClick={() => docMeta.salary && setShowSalary((v) => !v)}
                  style={{
                    fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "6px 11px",
                    border: `1px solid ${docMeta.salary && showSalary ? "var(--nv-line)" : BORDER}`,
                    background: docMeta.salary && showSalary ? "#f2faf6" : CARD,
                    color: docMeta.salary ? (showSalary ? OK : NAVY) : MUTED,
                    cursor: docMeta.salary ? "pointer" : "default",
                  }}
                >
                  {docMeta.salary ? (showSalary ? (ar ? "✓ يظهر الراتب — أخفِه" : "✓ Salary shown — hide it") : (ar ? "الراتب مخفي — أظهره" : "Salary hidden — show it")) : (ar ? "هذا النوع بلا راتب" : "This type has no salary")}
                </button>
              </div>
            </div>
          )}

          {!selfOnly && (isLeave || isTopup) && (
            <div style={{ padding: isLeave && needsDates ? "14px 20px 0" : "14px 20px", borderBottom: isLeave && needsDates ? "none" : "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: isLeave ? 6 : 9 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "نوع الإجازة" : "Leave type"}</span>
              {!profileGender(subject?.profile) && (
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                  {ar ? "صنّف الجنس في الملف الشخصي لتظهر إجازات الأمومة والعدّة أو الأبوة." : "Classify gender on the personal file so maternity, iddah or paternity appear."}
                </span>
              )}
              {profileGender(subject?.profile) === "female" && (
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                  {ar
                    ? "وفاة الزوج تُطلب من العدّة (المادة 160) لا من خمسة أيام. المادة 113 هنا أصل أو فرع فقط."
                    : "Husband death is requested as iddah (Article 160), not the five-day type. Article 113 here is parent or child only."}
                </span>
              )}
              {!religionOnFile({ profile: subject?.profile }) ? (
                <span data-religion-missing="1" style={{ fontSize: 11.5, color: "var(--nv-warn-ink, #8A5A12)", lineHeight: 1.7, fontWeight: 600 }}>
                  {ar
                    ? (mode === "manage"
                      ? "الديانة غير محددة في ملف الموظف — لا تظهر له إجازة الحج ولا العدة حتى تحددها من ملفه (الهوية والتوظيف)."
                      : "ديانتك غير محددة في ملفك — لا تظهر لك إجازة الحج ولا العدة حتى تحددها الموارد البشرية.")
                    : "Religion is not on file — Hajj and iddah stay hidden until HR sets it."}
                </span>
              ) : null}
              {profileGender(subject?.profile) === "female" && religionOnFile({ profile: subject?.profile }) === "non_muslim" && (
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                  {ar ? "غير مسلمة على الملف: العدّة 15 يوماً، ولا حج." : "Non-Muslim on file: 15-day iddah, and no Hajj."}
                </span>
              )}
              <div style={selfOnly
                ? { display: "flex", flexWrap: "wrap", gap: 6 }
                : { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 6 }}>
                {leaveKinds.filter((row) => row.key !== "grant" && (!manageLeave || MANAGE_LEAVE_KEYS.includes(row.key))).map((row) => (
                  <button key={row.key} type="button" className="nv-chip" onClick={() => { setKind("leave"); setLeave(row.key); clearSupportingFile(); if (row.key === "iddah" && eventDate) { const span = iddahSpanFromEvent(eventDate, subject?.profile); if (span.start) { setFrom(span.start); setTo(span.end); } } if (row.key === "maternity_extend" || row.key === "maternity_companion") { const span = maternityFollowOnSpan(subject?.leaveRequests, row.defaultTotal || 30); if (span.start) { setFrom(span.start); setTo(span.end); } setCompanionUnpaidExtend(false); } }} style={selfOnly ? chip(isLeave && leave === row.key) : pickBox(isLeave && leave === row.key)}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: isLeave && leave === row.key ? 700 : 500, color: selfOnly && isLeave && leave === row.key ? "#fff" : NAVY }}>{ar ? row.ar : row.en}</span>
                      <StatutoryItem article={row.article} label={!row.article ? row.cite : undefined} ar={ar} entitlement={!!row.article} />
                    </span>
                    <span style={{ fontSize: 10, color: selfOnly && isLeave && leave === row.key ? "rgba(255,255,255,.86)" : MUTED, lineHeight: 1.6 }}>{row.cap}</span>
                  </button>
                ))}
                {manageLeave ? null : <button type="button" onClick={() => { setKind("leave_topup"); setEmployerAck(false); }} style={pickBox(isTopup)}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: isTopup ? 700 : 500, color: NAVY }}>{ar ? "رصيد" : "Balance"}</span>
                    <StatutoryItem label={ar ? "قرار تشغيلي" : "Operational"} ar={ar} />
                  </span>
                  <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.6 }}>{ar ? "الموظف يطلب زيادة · المسؤول يزيدها" : "The worker requests more · the manager adds it"}</span>
                </button>}
              </div>
            </div>
          )}

          {isOtAssign && (
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "تكليف ساعات إضافية" : "Overtime assignment"}</span>
              <LaborArticleCite article={ot106 ? "106" : "107"} ar={ar} showOfficial tone={ot106 ? "warn" : undefined} />
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                {ar
                  ? "الموظف يختار أجر إضافي أو رصيد إجازة (نفس حقل الرصيد السنوي). إقرار 118 للإجازة فقط — هنا إقرار باختيار التعويض."
                  : "The worker chooses overtime pay or leave credit (the same annual-balance field). Article 118 is for taking leave only — here they acknowledge the compensation choice."}
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr) minmax(0,1fr)", gap: 9 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الساعات" : "Hours"}</span>
                  <input type="number" min="0.5" step="0.5" value={otHours} onChange={(e) => setOtHours(e.target.value)} style={{ ...fieldStyle(), fontFamily: "'IBM Plex Mono', monospace" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "التاريخ" : "Date"}</span>
                  <PlatformDateField ar={ar} value={from} onChange={setFrom} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "إلى (اختياري)" : "Until (optional)"}</span>
                  <PlatformDateField ar={ar} value={otTo} onChange={setOtTo} />
                </label>
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "سبب التكليف — إلزامي" : "Assignment reason — required"} style={fieldStyle()} />
              <button type="button" onClick={() => { setOt106((v) => !v); if (ot106) { setOtGround(""); setOt106Ack(false); } }} style={chip(ot106)}>
                {ot106 ? (ar ? "✓ تكليف إجباري — المادة 106" : "✓ Mandatory — Article 106") : (ar ? "وسم تكليف إجباري (المادة 106)" : "Mark as mandatory (Article 106)")}
              </button>
              {ot106 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 11px", border: "1px solid var(--nv-warn-line)", background: "var(--nv-warn-soft)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: WARN }}>{ar ? "المادة 106 — اختر سبباً واحداً وأرفق ملف الواقعة" : "Article 106 — pick one ground and attach the incident file"}</span>
                  {ARTICLE_106_GROUNDS.map((g) => (
                    <button key={g.key} type="button" onClick={() => setOtGround(g.key)} style={pickBox(otGround === g.key)}>
                      <span style={{ fontWeight: otGround === g.key ? 700 : 500, color: NAVY }}>{ar ? g.ar : g.en}</span>
                      <span style={{ fontSize: 10, color: MUTED }}>{ar ? `المادة ${g.article}` : `Art. ${g.article}`}</span>
                    </button>
                  ))}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 11, color: MUTED }}>{ar ? "ملف الواقعة — صورة أو PDF، بلا توقيع" : "Incident file — image or PDF, no signature"}</span>
                    <AttachFileButton
                      ref={fileInputRef}
                      ar={ar}
                      accept={SUPPORTING_FILE_ACCEPT}
                      busy={fileBusy}
                      label={ar ? "أرفق ملف الواقعة" : "Attach the incident file"}
                      onPick={onSupportingFile}
                    />
                    {supportingFile?.name ? (
                      <span style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
                        {supportingFile.url ? (
                          <a href={supportingFile.url} download={supportingFile.name} style={{ color: OK, fontWeight: 600, textDecoration: "none" }}>
                            {supportingFile.name}{supportingFile.size ? ` · ${formatFileSize(supportingFile.size, ar)}` : ""}
                          </a>
                        ) : (
                          <span style={{ color: OK, fontWeight: 600 }}>{supportingFile.name}</span>
                        )}
                        <button type="button" onClick={clearSupportingFile} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "4px 10px", border: `1px solid ${BORDER}`, background: CARD, color: MUTED, cursor: "pointer" }}>
                          {ar ? "أزل المرفق" : "Remove"}
                        </button>
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.8 }}>
                        {fileBusy ? (ar ? "جارٍ قراءة الملف…" : "Reading the file…") : (ar ? "أرفق الورقة. لا يُطلب توقيع رقمي." : "Attach the paper. Digital signing is not required.")}
                      </span>
                    )}
                    {fileError ? <span style={{ fontSize: 11, color: BAD }}>{fileError}</span> : null}
                  </label>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                    <input type="checkbox" checked={ot106Ack} onChange={(e) => setOt106Ack(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>{ar ? "أقرّ بأن واقعة استثنائية قائمة وفق السبب المختار من المادة 106." : "I attest that an exceptional situation exists under the chosen Article 106 ground."}</span>
                  </label>
                </div>
              ) : null}
              {otRaiseGate.capConsentRequested ? (
                <span data-ot-cap-requested="1" style={{ fontSize: 12, color: NAVY, lineHeight: 1.7 }}>
                  {ar ? "ستُطلب موافقة العامل على تجاوز سقف 720 ساعة في السنة عند قبوله التكليف (اللائحة 22)." : "The worker will be asked to consent to passing the annual 720-hour cap when accepting (regs Art. 22)."}
                </span>
              ) : null}
            </div>
          )}

          {isTopup && (
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{canDecide ? (ar ? "زيادة رصيد الموظف" : "Add to the employee's balance") : (ar ? "طلب زيادة الرصيد" : "Request more leave days")}</span>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                {ar
                  ? `خانة واحدة: الموظف يطلب زيادة، والمسؤول يزيد الرصيد السنوي (نفس حقل 21/30 يوماً) بعد الاعتماد أو بالتسجيل المباشر. ليست أخذ إجازة. المتبقي الآن ${remainingAnnualLabel(subject?.profile, subject?.leaveRequests, lang)}.`
                  : `One slot: the worker requests more days, and the manager adds them to the annual balance (the same 21/30-day field) on approval or by direct record. This is not taking leave. Now ${remainingAnnualLabel(subject?.profile, subject?.leaveRequests, lang)}.`}
              </span>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 160 }}>
                <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الأيام الإضافية" : "Extra days"}</span>
                <input
                  type="number"
                  min={1}
                  max={LEAVE_TOPUP_MAX_DAYS}
                  value={topupDays}
                  onChange={(e) => setTopupDays(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                  style={{ ...fieldStyle(), fontFamily: "'IBM Plex Mono', monospace" }}
                />
              </label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "سبب زيادة الرصيد — إلزامي" : "Why the balance should increase — required"} style={fieldStyle()} />
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, color: MUTED }}>{ar ? "مرفق مؤيد — اختياري، بلا توقيع" : "Supporting file — optional, no signature"}</span>
                <AttachFileButton
                  ref={fileInputRef}
                  ar={ar}
                  accept={SUPPORTING_FILE_ACCEPT}
                  busy={fileBusy}
                  label={ar ? "أرفق الملف المؤيد" : "Attach the supporting file"}
                  onPick={onSupportingFile}
                />
                {supportingFile?.name ? (
                  <span style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
                    {supportingFile.url ? (
                      <a href={supportingFile.url} download={supportingFile.name} style={{ color: OK, fontWeight: 600, textDecoration: "none" }}>
                        {supportingFile.name}{supportingFile.size ? ` · ${formatFileSize(supportingFile.size, ar)}` : ""}
                      </a>
                    ) : (
                      <span style={{ color: OK, fontWeight: 600 }}>
                        {supportingFile.name}{supportingFile.size ? ` · ${formatFileSize(supportingFile.size, ar)}` : ""}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={clearSupportingFile}
                      style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "4px 10px", border: `1px solid ${BORDER}`, background: CARD, color: MUTED, cursor: "pointer" }}
                    >
                      {ar ? "أزل المرفق" : "Remove"}
                    </button>
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.8 }}>
                    {fileBusy
                      ? (ar ? "جارٍ قراءة الملف…" : "Reading the file…")
                      : (ar ? "مذكرة أو ورقة إن وُجدت. لا يُطلب توقيع رقمي." : "A note or paper if you have one. Digital signing is not required.")}
                  </span>
                )}
                {fileError ? <span style={{ fontSize: 11, color: BAD }}>{fileError}</span> : null}
              </label>
            </div>
          )}

          {isLeaveCredit && (
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "إضافة رصيد — من الإدارة" : "Add leave balance — from management"}</span>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                {ar
                  ? `تُضاف الأيام مباشرة إلى ملف الموظف دون طلب منه. ليست أخذ إجازة ولا موافقة ذاتية. المتبقي الآن ${remainingAnnualLabel(subject?.profile, subject?.leaveRequests, lang)} · تقديري ${annual.leftoverGrants}.`
                  : `Days are credited straight to the employee file without a worker request. Not taking leave and not self-approval. Now ${remainingAnnualLabel(subject?.profile, subject?.leaveRequests, lang)} · discretionary ${annual.leftoverGrants}.`}
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 6 }}>
                {LEAVE_CREDIT_POOLS.map((row) => (
                  <button key={row.key} type="button" onClick={() => setCreditPool(row.key)} style={pickBox(creditPool === row.key)}>
                    <span style={{ fontWeight: creditPool === row.key ? 700 : 500, color: NAVY }}>{ar ? row.ar : row.en}</span>
                    <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.6 }}>
                      {row.key === "annual"
                        ? (ar ? "نفس حقل 21/30 يوماً" : "Same 21/30-day field")
                        : (ar ? `سقف ${DISCRETIONARY_GRANT_CAP} أيام تقديرية` : `Cap ${DISCRETIONARY_GRANT_CAP} discretionary days`)}
                    </span>
                  </button>
                ))}
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 160 }}>
                <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الأيام المضافة" : "Days to add"}</span>
                <input
                  type="number"
                  min={1}
                  max={creditPool === "grant" ? DISCRETIONARY_GRANT_CAP : LEAVE_TOPUP_MAX_DAYS}
                  value={creditDays}
                  onChange={(e) => setCreditDays(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                  style={{ ...fieldStyle(), fontFamily: "'IBM Plex Mono', monospace" }}
                />
              </label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "سبب إضافة الرصيد — إلزامي" : "Why the balance is credited — required"} style={fieldStyle()} />
            </div>
          )}

          {needsDates && (
            <div key={isLeave ? leave : kind} className="nv-req-leave-copy" style={{ padding: isLeave ? "6px 20px 14px" : "14px 20px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: isLeave ? 6 : 10 }}>
              {isLeave ? (
                <>
                  <div data-legal-basis="1" style={{ border: "1px solid var(--nv-line)", borderInlineStart: "3px solid #0B3D27", borderRadius: 8, background: "var(--nv-soft, #F7F9F8)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0B3D27", letterSpacing: 0 }}>
                      {leave === "work_injury"
                        ? (gosiHazardCoverage(data) === false
                          ? (ar ? "السند النظامي — نظام العمل، المواد 133 إلى 139" : "Legal basis — Labour Law, Arts. 133 to 139")
                          : (ar ? "السند النظامي — نظام التأمينات الاجتماعية (الأخطار المهنية)" : "Legal basis — Social Insurance Law (occupational hazards)"))
                        : (ar ? "السند النظامي — نظام العمل" : "Legal basis — Labour Law")}
                    </span>
                    {leave === "work_injury" ? (
                      <span style={{ fontSize: 12, lineHeight: 1.8, color: "var(--nv-ink2)" }}>
                        {ar && gosiHazardCoverage(data) === false
                          ? "إصابة العمل أو المرض المهني: منشأتك غير مسجّلة في فرع الأخطار المهنية، فصاحب العمل يتحمّل علاجك كاملاً (المادة 133) وتعويضك عن أيام العجز المؤقت (المادة 137)، بتقرير طبي."
                          : ar
                          ? "إصابة العمل أو المرض المهني: العلاج والتعويض عن مدة العجز المؤقت يصرفهما نظام التأمينات الاجتماعية — فرع الأخطار المهنية، بتقرير طبي وبلاغ إصابة. لا تُخصم من الإجازة السنوية ولا من المرضية، ويُربط البلاغ بسجل السلامة."
                          : "Work injury or occupational disease: treatment and temporary-disability compensation are paid under the Social Insurance Law — occupational hazards, with a medical report and an injury report. Not taken from annual or sick leave; the report links to the safety log."}
                      </span>
                    ) : (
                      <LaborArticleCite key={leave} leaveType={leave} profile={subject?.profile} onDate={from || today} ar={ar} showText showOfficial showChip={false} />
                    )}
                  </div>
                  {leave === "work_injury" ? (() => {
                    const covered = gosiHazardCoverage(data);
                    const stop = covered !== false && gosiInjuryWageMode(data) === "stop";
                    const head = { fontSize: 12, fontWeight: 700, color: "var(--nv-ink)" };
                    const line = { fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.8, margin: 0, paddingInlineStart: 18 };
                    return (
                      <div data-injury-guide="1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10, padding: "4px 0" }}>
                        <div>
                          <span style={head}>{ar ? "متى تكون إصابة عمل" : "What counts as a work injury"}</span>
                          <ul style={line}>
                            {(ar
                              ? ["حادث أثناء العمل أو بسببه", "في الطريق بين سكنك وعملك ذهاباً وإياباً", "في الطريق إلى مكان طعامك أو صلاتك المعتاد", "أثناء تنقّل في مهمة كلّفك بها صاحب العمل", "مرض مهني سببه طبيعة عملك"]
                              : ["An accident at or because of work", "On the way between home and work", "On the way to your usual place to eat or pray", "Travelling on a task your employer gave you", "An occupational disease caused by your work"]).map((t) => <li key={t}>{t}</li>)}
                          </ul>
                        </div>
                        <div>
                          <span style={head}>{ar ? "ما يلزمك" : "What you do"}</span>
                          <ul style={line}>
                            {(ar
                              ? ["أبلغ مديرك فور وقوعها — المنشأة تبلّغ التأمينات خلال عشرة أيام", "ارفع الطلب بتاريخ الإصابة ومدة التقرير الطبي وأرفقه", "عند التمديد ارفع طلباً جديداً بتاريخ الإصابة نفسه", "التزم بالعلاج — رفضه دون سبب مشروع يُسقط حقك (المادة 139)"]
                              : ["Tell your manager at once — the establishment reports to GOSI within ten days", "Raise the request with the injury date and the medical report's span, attached", "To extend, raise a new request with the same injury date", "Follow the treatment — refusing it without a lawful reason loses the right (Art. 139)"]).map((t) => <li key={t}>{t}</li>)}
                          </ul>
                        </div>
                        <div>
                          <span style={head}>{ar ? "أجرك أثناء العلاج" : "Your pay during treatment"}</span>
                          <ul style={line}>
                            {(ar
                              ? (covered === false
                                ? ["الإجازة حتى الشفاء، لا عدد أيام ثابت", "أول 60 يوماً بأجر كامل، ثم 75% من الأجر (المادة 137)", "لا تُخصم من رصيد السنوية ولا المرضية", "إن مرّت سنة دون شفاء تُعامل عجزاً كلياً (المادة 138)"]
                                : ["الإجازة حتى الشفاء، لا عدد أيام ثابت", stop ? "يتوقف أجرك وتصرف لك التأمينات بدلاً يومياً: 100%، و75% أيام التنويم" : "يستمر أجرك كاملاً من المنشأة، والتأمينات تعوّضها", "لا تُخصم من رصيد السنوية ولا المرضية", "إن بقي عجز تقدّره اللجنة الطبية في التأمينات"])
                              : (covered === false
                                ? ["Leave lasts until recovery", "First 60 days full pay, then 75% (Art. 137)", "Not taken from annual or sick balance", "A year without recovery is total disability (Art. 138)"]
                                : ["Leave lasts until recovery", stop ? "Your wage stops; GOSI pays a daily allowance: 100%, 75% in hospital" : "Your full wage continues; GOSI reimburses the establishment", "Not taken from annual or sick balance", "Any lasting disability is rated by the GOSI medical committee"])).map((t) => <li key={t}>{t}</li>)}
                          </ul>
                        </div>
                      </div>
                    );
                  })() : null}
                  {leave === "annual" ? (
                    <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                      {ar
                        ? `المتبقي ${remainingAnnualLabel(subject?.profile, subject?.leaveRequests, lang)} — يُحسب العدد بعد اختيار من وإلى.`
                        : `${remainingAnnualLabel(subject?.profile, subject?.leaveRequests, lang)} — the count follows from and to.`}
                    </span>
                  ) : null}
                  {leave === "eid" ? (
                    <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                      {ar
                        ? "إجازة اليوم الوطني وإجازة يوم التأسيس مقفلتان في الجدول بلا طلب (المادة 112). هذا النوع لطلب عيد الفطر أو الأضحى على أيامهما."
                        : "National Day and Founding Day leave lock on the roster with no request (Article 112). This type is for requesting Eid al-Fitr or Eid al-Adha on their dates."}
                    </span>
                  ) : null}
                </>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: isLeave ? "repeat(auto-fit, minmax(min(100%, 148px), 1fr))" : (isPunchKind ? "minmax(0,1fr) 120px" : "minmax(0,1fr)"), gap: isLeave ? 6 : 9, width: "100%" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: isLeave ? 6 : 4, minWidth: 0 }}>
                  <span style={isLeave ? { fontSize: 12, fontWeight: 600, color: NAVY, lineHeight: 1.35 } : { fontSize: 11, color: MUTED }}>{isLeave ? (ar ? "من" : "From") : (ar ? "التاريخ" : "Date")}</span>
                  <PlatformDateField
                    ar={ar}
                    value={from}
                    compact={isLeave}
                    placeholder={isLeave ? "—" : undefined}
                    style={isLeave ? { borderRadius: CONTROL_RADIUS, height: 36, gap: 4, color: from ? NAVY : MUTED } : undefined}
                    onChange={(next) => {
                      setFrom(next);
                      if (!isLeave) setTo(next);
                    }}
                  />
                </label>
                {isPunchKind ? (
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, color: MUTED }}>{kind === "outfix" ? (ar ? "وقت الانصراف" : "Out time") : (ar ? "وقت الحضور" : "In time")}</span>
                    <input
                      type="time"
                      value={punchTime}
                      onChange={(e) => setPunchTime(e.target.value)}
                      style={{ ...fieldStyle(), fontFamily: "'IBM Plex Mono', monospace" }}
                    />
                  </label>
                ) : null}
                {isLeave && (
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: NAVY, lineHeight: 1.35 }}>{ar ? "إلى" : "To"}</span>
                    <PlatformDateField
                      ar={ar}
                      value={to}
                      compact
                      placeholder="—"
                      style={{ borderRadius: CONTROL_RADIUS, height: 36, gap: 4, color: to ? NAVY : MUTED }}
                      onChange={setTo}
                    />
                  </label>
                )}
                {isLeave ? (
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: NAVY, lineHeight: 1.35 }}>{ar ? "عدد الأيام" : "Days"}</span>
                    <span style={{ ...fieldStyle(), borderRadius: CONTROL_RADIUS, height: 36, display: "flex", alignItems: "center", color: NAVY, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {from && to && counted > 0 ? String(counted) : "—"}
                    </span>
                  </label>
                ) : null}
                {isLeave ? (
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: NAVY, lineHeight: 1.35 }}>{leave === "annual" ? (ar ? "ملاحظة لمديرك — اختيارية" : "Note to your manager — optional") : (ar ? "سبب الإجازة — إلزامي" : "Leave reason — required")}</span>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      style={{ ...fieldStyle(), borderRadius: CONTROL_RADIUS, height: 36, width: "100%" }}
                    />
                  </label>
                ) : null}
              </div>
              {isLeave && leave === "annual" && from && to ? (
                <AnnualLeaveBreakdown from={from} to={to} calendar={laborCalendarOf(data)} company={company} employee={subject} ar={ar} own={mode !== "manage"} />
              ) : null}
              {isLeave && ["marriage", "bereavement", "bereavement_sibling", "paternity", "maternity", "iddah", "work_injury"].includes(leave) && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{leave === "iddah" ? (ar ? "تاريخ الوفاة" : "Date of death") : leave === "maternity" ? (ar ? "التاريخ المرجح للوضع — بشهادة طبية؛ يُسجَّل الوضع الفعلي بعد الولادة (المادة 151)" : "Expected birth date — per a medical certificate; record the actual birth after it (Article 151)") : leave === "work_injury" ? (ar ? "تاريخ الإصابة — تمديد العلاج يحمل التاريخ نفسه" : "Injury date — a treatment extension keeps the same date") : (ar ? "تاريخ الواقعة" : "Event date")}</span>
                  <PlatformDateField
                    ar={ar}
                    value={eventDate}
                    onChange={(next) => {
                      setEventDate(next);
                      if (leave === "iddah") {
                        const span = iddahSpanFromEvent(next, subject?.profile);
                        if (span.start) {
                          setFrom(span.start);
                          if (!iddahPregnant || !to || to < span.end) setTo(span.end);
                        }
                      }
                    }}
                  />
                </label>
              )}
              {leave === "maternity_companion" && (
                <button type="button" onClick={() => {
                  setCompanionUnpaidExtend((v) => {
                    const next = !v;
                    const paid = maternityFollowOnSpan(subject?.leaveRequests, 30);
                    if (paid.start) {
                      setFrom(paid.start);
                      setTo(maternityFollowOnSpan(subject?.leaveRequests, next ? 60 : 30).end || paid.end);
                    }
                    return next;
                  });
                }} style={chip(companionUnpaidExtend)}>
                  {companionUnpaidExtend ? (ar ? "تمديد شهر بلا أجر بعد المرافقة" : "Unpaid extra month after companion") : (ar ? "شهر بأجر فقط — أضيفي تمديداً بلا أجر" : "Paid month only — add unpaid extension")}
                </button>
              )}
              {isLeave && leave === "annual" ? (() => {
                const alerts = annualCarryAlerts(subject?.profile, subject?.leaveRequests, undefined, company, subject);
                const sickBefore = from ? sickLeaveEndingBefore(subject?.leaveRequests, from) : null;
                const cap = annualAdvanceCap(subject?.profile, subject?.leaveRequests, from || undefined, company, subject);
                return (
                  <div data-annual-law="1" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {alerts.map((a) => (
                      <span key={`${a.kind}-${a.start}`} data-carry-alert={a.kind} style={{ fontSize: 11, lineHeight: 1.8, color: a.kind === "overdue" ? BAD : WARN }}>{ar ? a.ar : a.en}</span>
                    ))}
                    <button type="button" data-advance-leave="1" onClick={() => setAdvanceLeave((v) => !v)} style={chip(advanceLeave)}>
                      {advanceLeave
                        ? (ar ? `مقدمة بنسبة ما قضيته من السنة — المتاح ${cap.cap} يوماً، وتلزم موافقة المنشأة (اللائحة النموذجية م33)` : `Advance pro-rata to time worked — ${cap.cap} days available; the company must consent (Model Regs Art. 33)`)
                        : (ar ? "طلب جزء من إجازة هذه السنة مقدماً (اللائحة النموذجية م33)" : "Ask for part of this year's leave in advance (Model Regs Art. 33)")}
                    </button>
                    {sickBefore ? (
                      <button type="button" data-join-sick="1" onClick={() => setJoinAnnualToSick((v) => !v)} style={chip(joinAnnualToSick)}>
                        {joinAnnualToSick
                          ? (ar ? "موصولة بالإجازة المرضية السابقة (المادة 82)" : "Joined to the preceding sick leave (Article 82)")
                          : (ar ? "صِل إجازتك السنوية بالمرضية التي تنتهي قبلها (المادة 82، اللائحة م41)" : "Join this annual leave to the sick leave ending the day before (Article 82, Regs Art. 41)")}
                      </button>
                    ) : null}
                  </div>
                );
              })() : null}
              {isLeave && leave === "therapy" && therapyLeaveEligibility(subject?.profile) === "unknown" ? (
                <span data-therapy-note="1" style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                  {ar ? "الملحق 2 من اللائحة (ترتيبات ذوي الإعاقة والمرض المزمن): أيام الغياب للعلاج الطبيعي أو الوظيفي أو الكيميائي أو الإشعاعي إجازة مدفوعة الأجر بتقرير الجهة المعالجة. لا يوجد في الملف ما يبيّن الإعاقة أو المرض المزمن — يُعرض للجميع والتقرير يثبت الحالة." : "Regs Annex 2 (disability and chronic-illness accommodations): days absent for physical, occupational, chemo- or radiotherapy are paid leave on the treating provider's report. The file does not record a disability or chronic illness — shown to all; the report proves it."}
                </span>
              ) : null}
              {isLeave && leave === "hajj" && canDecide ? (
                <label data-hajj-quota="1" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: MUTED }}>
                  <span>{ar ? `حصة الحج السنوية للمنشأة (المادة 114) — الحالية: ${hajjAnnualQuotaOf(data) ?? "بلا حد"}` : `Company yearly Hajj quota (Article 114) — now: ${hajjAnnualQuotaOf(data) ?? "none"}`}</span>
                  <input type="number" min="0" defaultValue={hajjAnnualQuotaOf(data) ?? ""} onBlur={(e) => { const res = setHajjAnnualQuota(company.id, e.target.value); if (!res.ok) toast({ description: ar ? res.reason : res.reasonEn, variant: "destructive" }); else refresh?.(); }} style={{ ...fieldStyle(), width: 80, height: 30 }} />
                </label>
              ) : null}
              {leave === "iddah" && isRamadanHoursSubject({ profile: subject?.profile }) && (
                <button type="button" onClick={() => {
                  setIddahPregnant((v) => {
                    const next = !v;
                    if (!next && eventDate) {
                      const span = iddahSpanFromEvent(eventDate, subject?.profile);
                      if (span.end) setTo(span.end);
                    }
                    return next;
                  });
                }} style={chip(iddahPregnant)}>
                  {iddahPregnant ? (ar ? "حامل — تمديد بلا أجر حتى الوضع" : "Pregnant — unpaid extension until birth") : (ar ? "غير حامل — المدة بأجر فقط" : "Not pregnant — paid span only")}
                </button>
              )}
              {leave === "exam" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button type="button" onClick={() => setExamRepeat((v) => !v)} style={chip(examRepeat)}>
                    {examRepeat
                      ? (ar ? "امتحان معاد — بغير أجر" : "Repeat exam — unpaid")
                      : examConsentGate.examLeaveTrack === "paid"
                        ? (ar ? "امتحان أول — بأجر" : "First sitting — paid")
                        : (ar ? "امتحان أول — من السنوية أو بلا أجر" : "First sitting — annual or unpaid")}
                  </button>
                  <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.7 }}>{ar ? "المادة 115: يُقدَّم الطلب قبل موعدها بخمسة عشر يوماً على الأقل. إن وصل جدول المواعيد بعد المهلة ارفع الورقة وسجّل تاريخ صدورها وقدّم في يومها أو اليوم التالي. إثبات الأداء ورقة ثانية على البطاقة بعد بدء الأيام." : "Article 115: apply at least fifteen days before the leave. If the timetable paper arrives late, attach it, record its issue date, and apply that day or the next. Sitting proof is a second paper on the card after the days begin."}</span>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, color: MUTED }}>{ar ? "تاريخ صدور ورقة المواعيد — إن وصلت بعد مهلة 15 يوماً" : "Timetable paper date — if it arrived after the 15-day window"}</span>
                    <PlatformDateField ar={ar} value={examNoticeIssuedAt} onChange={setExamNoticeIssuedAt} />
                  </label>
                  <span style={{ fontSize: 11, color: examConsentGate.examLeaveTrack === "paid" ? OK : WARN, lineHeight: 1.8 }}>
                    {ar ? examConsentGate.reason : examConsentGate.reasonEn}
                  </span>
                  {examConsentGate.examLeaveTrack !== "paid" ? (
                    <button type="button" onClick={() => setKind("study_consent")} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "7px 11px", border: `1px solid ${BORDER}`, background: CARD, color: NAVY, cursor: "pointer", alignSelf: "flex-start" }}>
                      {ar ? "اطلب موافقة دراسية للمسار المدفوع" : "Request study consent for the paid track"}
                    </button>
                  ) : null}
                </div>
              )}
              {isResignation && resignationRouteFor(subject?.profile) === EXIT_ROUTE_NOTICE75 ? (() => {
                const facts = resignationFacts({ date: today, route: EXIT_ROUTE_NOTICE75 });
                return (
                  <div data-resignation-fields="notice75" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div data-legal-basis="1" style={{ border: "1px solid var(--nv-line)", borderInlineStart: "3px solid #0B3D27", borderRadius: 8, background: "var(--nv-soft, #F7F9F8)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, lineHeight: 1.8, color: "var(--nv-ink2)" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0B3D27" }}>{ar ? "السند النظامي — المادتان 74/3 و75 (عقد غير محدد المدة)" : "Legal basis — Arts. 74(3) and 75 (open-ended contract)"}</span>
                      <span>{ar ? "عقدك غير محدد المدة: تنهيه بإشعار كتابي قبل ثلاثين يوماً على الأقل، ولا يحتاج قبولاً ولا يُؤجَّل. يبقى العقد سارياً خلال المهلة." : "Your contract is open-ended: you end it by written notice at least thirty days ahead; it needs no acceptance and is not postponed. The contract runs on during the notice."}</span>
                    </div>
                    <ol data-resignation-timeline="notice75" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--nv-line)", borderRadius: 8, overflow: "hidden" }}>
                      {[
                        [ar ? "اليوم" : "Today", regulationDate(today), ar ? "يصل الإشعار ويؤرَّخ بهذا اليوم" : "The notice is delivered and dated today"],
                        [ar ? "في" : "On", regulationDate(facts.noticeEndsOn), ar ? "ينتهي العقد بانقضاء مهلة الإشعار" : "The contract ends when the notice runs out"],
                      ].map(([k, v, t]) => (
                        <li key={k} style={{ display: "grid", gridTemplateColumns: "auto auto minmax(0,1fr)", gap: 10, alignItems: "baseline", padding: "8px 12px", borderBottom: "1px solid var(--nv-line2, #EEF1EF)", fontSize: 12 }}>
                          <span style={{ color: MUTED, fontSize: 11 }}>{k}</span>
                          <strong style={{ color: NAVY, whiteSpace: "nowrap" }}>{v}</strong>
                          <span style={{ color: "var(--nv-ink2)", lineHeight: 1.7 }}>{t}</span>
                        </li>
                      ))}
                    </ol>
                    <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.75 }}>{ar ? "الإشعار لا يُسحب بإرادتك وحدك بعد وصوله — يلزم اتفاق صاحب العمل. وتستحق كل حقوقك النظامية." : "Once delivered, the notice is not withdrawn by you alone — the employer must agree. You keep all your statutory rights."}</span>
                  </div>
                );
              })() : isResignation ? (() => {
                const facts = resignationFacts({ date: today });
                return (
                  <div data-resignation-fields="1" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div data-legal-basis="1" style={{ border: "1px solid var(--nv-line)", borderInlineStart: "3px solid #0B3D27", borderRadius: 8, background: "var(--nv-soft, #F7F9F8)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, lineHeight: 1.8, color: "var(--nv-ink2)" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0B3D27" }}>{ar ? "السند النظامي — المادتان 75 و79 مكرر" : "Legal basis — Arts. 75 and 79 bis"}</span>
                      <span>{ar ? "تُعد الاستقالة مقبولة إذا مضى ثلاثون يوماً دون رد، ولصاحب العمل تأجيل القبول حتى ستين يوماً بإيضاح مكتوب قبل انتهاء الثلاثين." : "Deemed accepted after thirty days without a reply; the employer may postpone acceptance up to sixty days with a written reason given before the thirty end."}</span>
                      <span>{ar ? "يحق لك سحب الاستقالة خلال سبعة أيام من تقديمها." : "You may withdraw it within seven days of submitting it."}</span>
                    </div>
                    <ol data-resignation-timeline="1" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--nv-line)", borderRadius: 8, overflow: "hidden" }}>
                      {[
                        [ar ? "اليوم" : "Today", regulationDate(today), ar ? "تُقدَّم وتؤرَّخ بهذا اليوم، وعقدك سارٍ وتلتزم بعملك خلال المدة" : "Filed and dated today; your contract runs on meanwhile"],
                        [ar ? "حتى" : "Until", regulationDate(facts.withdrawUntil), ar ? "لك سحبها ما لم تُقبل قبل ذلك" : "You may withdraw it unless accepted earlier"],
                        [ar ? "في" : "On", regulationDate(facts.deemedAcceptedOn), ar ? "تُعد مقبولة إن لم يرد صاحب العمل — أو يؤجّل قبولها قبل هذا التاريخ حتى 60 يوماً بإيضاح مكتوب" : "Deemed accepted without a reply — or acceptance is postponed before then, up to 60 days, in writing"],
                      ].map(([k, v, t]) => (
                        <li key={k} style={{ display: "grid", gridTemplateColumns: "auto auto minmax(0,1fr)", gap: 10, alignItems: "baseline", padding: "8px 12px", borderBottom: "1px solid var(--nv-line2, #EEF1EF)", fontSize: 12 }}>
                          <span style={{ color: MUTED, fontSize: 11 }}>{k}</span>
                          <strong style={{ color: NAVY, whiteSpace: "nowrap" }}>{v}</strong>
                          <span style={{ color: "var(--nv-ink2)", lineHeight: 1.7 }}>{t}</span>
                        </li>
                      ))}
                    </ol>
                    <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.75 }}>{ar ? "ينتهي عقدك من تاريخ القبول، وتستحق كل حقوقك النظامية (المادة 79 مكرر)." : "Your contract ends from the acceptance date, with all your statutory rights (Art. 79 bis)."}</span>
                  </div>
                );
              })() : null}
              {isDutyKind ? (
                <div data-duty-fields={kind} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dutyMeta?.hintAr ? (
                    <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.75 }}>
                      {kind === "permission" ? (ar ? "الاستئذان المعتمد لا يُحتسب تأخيراً ولا خروجاً مبكراً في «سجلي»." : "An approved permission is not counted as lateness or early leave in My record.")
                        : kind === "shift_change" ? (ar ? "عند الاعتماد تتغيّر خانتك في جدول الدوام لذلك اليوم، وتُفحص أنظمة الوزارة على الجدول الجديد." : "On approval your roster cell for that day changes, and the ministry checks run on the new roster.")
                        : kind === "nursing_hour" ? (ar ? "المادة 154: للعاملة المرضع فترة لا تزيد على ساعة يومياً تُحسب من ساعات العمل الفعلية، ولا يُخصم أجرها. في أول الدوام لا تُحتسب تأخيراً." : "Article 154: a nursing worker has up to one hour a day counted as actual work, with no pay cut. At the start of the shift it is not lateness.")
                        : kind === "family_duties" ? (ar ? "القرار 18632 (هـ): تُراعى — قدر الإمكان — أوضاع ذوي المسؤوليات العائلية عند الإسناد للعمل الليلي. اكتب ظرفك باختصار (رعاية والد أو طفل مثلاً) وأرفق ما يؤيده إن وُجد. عند الاعتماد يُكتب في ملفك ويراه المدير عند إسنادك ليلاً — مراعاة لا إعفاء." : "Decision 18632 (e): family responsibilities are considered, as far as possible, for night assignment. Describe your situation briefly and attach support if you have it. On approval it is written on your file and shown to the manager when assigning nights — a consideration, not an exemption.")
                        : kind === "pregnancy_notice" ? (ar ? "القرار 18632: لا تُسند الحامل للعمل الليلي (23:00–06:00) قبل الوضع بـ24 أسبوعاً على الأقل، ويوفَّر لها عمل مناسب في الساعات المعتادة. عند الاعتماد يُكتب التاريخ في ملفك ويمنع الجدول الإسناد الليلي." : "Decision 18632: no night work (23:00–06:00) in the 24 weeks before birth, with suitable ordinary-hours work instead. On approval the date is written on your file and the roster blocks night assignment.")
                        : (ar ? "القرار 3337: لا يجوز تشغيلك تحت أشعة الشمس من 12:00 إلى 15:00 بين 15 يونيو و15 سبتمبر. البلاغ يصل الإدارة، وعند الاعتماد يُسجَّل يومك «مظلّل» في الجدول." : "Decision 3337: you may not be made to work in direct sun 12:00–15:00 from 15 June to 15 September. The report reaches management; on approval your day is marked shaded on the roster.")}
                    </span>
                  ) : null}
                  {kind === "permission" && employerNoticeOf(subject, today) ? (
                    <label data-perm-jobsearch="1" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: NAVY, lineHeight: 1.7, cursor: "pointer", padding: "8px 10px", border: "1px solid var(--nv-line)", background: "var(--nv-soft)", borderRadius: 8 }}>
                      <input type="checkbox" checked={permJob} onChange={(e) => { setPermJob(e.target.checked); if (e.target.checked) setPermComp(false); }} style={{ marginTop: 3 }} />
                      <span>{ar
                        ? `ساعات بحث عن عمل بأجرها — المادة 78: خلال مهلة إشعار صاحب العمل (حتى ${regulationDate(employerNoticeOf(subject, today).until)}) لك يوم كامل أو ثماني ساعات في الأسبوع، تحددها وتُشعر قبلها بيوم، ولا تحتاج اعتماداً. ${jobSearchHoursInWeek(subject, from || today) > 0 ? `استخدمت هذا الأسبوع ${hoursAr(jobSearchHoursInWeek(subject, from || today))}.` : "لم تستخدم شيئاً منها هذا الأسبوع."}`
                        : "Paid job-search hours — Art. 78: during the employer's notice, a full day or eight hours a week, told a day ahead, no approval."}</span>
                    </label>
                  ) : null}
                  {kind === "permission" && !permJob && compBalance(subject).left > 0 ? (
                    <label data-perm-comp="1" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: NAVY, lineHeight: 1.7, cursor: "pointer", padding: "8px 10px", border: "1px solid var(--nv-ok-line)", background: "var(--nv-ok-soft)", borderRadius: 8 }}>
                      <input type="checkbox" checked={permComp} onChange={(e) => setPermComp(e.target.checked)} style={{ marginTop: 3 }} />
                      <span>{ar ? `من رصيدي التعويضي — متبقٍّ ${hoursAr(compBalance(subject).left)} (إجازة مدفوعة عن ساعات إضافية سابقة، اللائحة 22 مكرر)` : `From my comp balance — ${compBalance(subject).left} h left`}</span>
                    </label>
                  ) : null}
                  {kind === "permission" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 9 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, color: MUTED }}>{ar ? "من الساعة" : "From"}</span>
                        <input type="time" value={permFrom} onChange={(e) => setPermFrom(e.target.value)} style={{ ...fieldStyle(), fontFamily: "'IBM Plex Mono', monospace" }} />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, color: MUTED }}>{ar ? "إلى الساعة" : "To"}</span>
                        <input type="time" value={permTo} onChange={(e) => setPermTo(e.target.value)} style={{ ...fieldStyle(), fontFamily: "'IBM Plex Mono', monospace" }} />
                      </label>
                    </div>
                  ) : null}
                  {kind === "shift_change" ? (
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الوردية المطلوبة" : "Requested shift"}</span>
                      <select value={shiftPick} onChange={(e) => setShiftPick(e.target.value)} style={fieldStyle()}>
                        <option value="">{ar ? "راحة" : "Rest"}</option>
                        {(subjectSchedule?.shiftTypes || []).map((shift) => (
                          <option key={shift.id} value={shift.id}>{`${shift.label || shift.id} · ${shift.start || ""}–${shift.end || ""}`}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {kind === "nursing_hour" ? (() => {
                    const total = (nursingSplit.start || 0) + (nursingSplit.mid || 0) + (nursingSplit.end || 0);
                    const nurseryOnSite = hoursPolicyOf(data).nurseryOnSite === true;
                    const pick = (slot, value) => setNursingSplit((prev) => {
                      // Without a nursery: one period only — picking one slot clears the others.
                      const next = nurseryOnSite ? { ...prev, [slot]: Number(value) } : { start: 0, mid: 0, end: 0, [slot]: Number(value) };
                      setNursingPlacement(next.start ? "start" : next.end ? "end" : "start");
                      return next;
                    });
                    const opts = [0, 15, 20, 30, 40, 45, 60];
                    return (
                      <div data-nursing-split="1" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 11, color: MUTED }}>{ar ? "تاريخ ميلاد الطفل — إلزامي" : "Child's birth date — required"}</span>
                          <PlatformDateField ar={ar} value={childBirthDate} onChange={setChildBirthDate} />
                        </label>
                        <span style={{ fontSize: 11, color: MUTED }}>{nurseryOnSite
                          ? (ar ? "فترات الرضاعة — تتوفر حضانة في المنشأة: فترة أو أكثر، مجموعها ساعة في اليوم كحد أعلى (المادة 154، اللائحة م31/3-ب)" : "Nursing periods — on-site nursery: one or more, an hour a day at most (Regs Art. 31(3)(b))")
                          : (ar ? "لا تتوفر حضانة في المنشأة — ساعة الرضاعة فترة واحدة أول الدوام أو آخره (اللائحة م31/3-أ). وتمتد 24 شهراً من تاريخ الوضع." : "No on-site nursery — the nursing hour is one period at the start or end (Regs Art. 31(3)(a)), for 24 months from birth.")}</span>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${nurseryOnSite ? 3 : 2}, minmax(0, 1fr))`, gap: 9 }}>
                          {[["start", ar ? "أول الدوام" : "Start"], ["mid", ar ? "وسط الدوام" : "Middle"], ["end", ar ? "آخر الدوام" : "End"]].filter(([slot]) => nurseryOnSite || slot !== "mid").map(([slot, label]) => (
                            <label key={slot} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: 11, color: MUTED }}>{label}</span>
                              <select data-nursing-slot={slot} value={String(nursingSplit[slot] || 0)} onChange={(e) => pick(slot, e.target.value)} style={fieldStyle()}>
                                {opts.map((n) => <option key={n} value={n}>{n ? (ar ? `${n} دقيقة` : `${n} min`) : (ar ? "لا شيء" : "None")}</option>)}
                              </select>
                            </label>
                          ))}
                        </div>
                        <span data-nursing-total={total} style={{ fontSize: 11.5, fontWeight: 600, color: total > 60 ? "var(--nv-bad-ink)" : total ? "var(--nv-ok-ink)" : MUTED }}>
                          {total > 60
                            ? (ar ? `المجموع ${total} دقيقة — يتجاوز الساعة.` : `Total ${total} min — over the hour.`)
                            : total
                              ? (ar ? `المجموع ${total} دقيقة — تُحسب من ساعات العمل ولا يُنقص الأجر. ما في أول الدوام لا يُحسب تأخيراً، وما في آخره لا يُحسب انصرافاً مبكراً.` : `Total ${total} min — counted as work, no pay cut.`)
                              : (ar ? "اختاري فترة واحدة على الأقل." : "Pick at least one period.")}
                        </span>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 11, color: MUTED }}>{ar ? `حتى تاريخ — اختياري${childBirthDate && nursingRightUntil(childBirthDate) ? `؛ الحد ${regulationDate(nursingRightUntil(childBirthDate))}` : ""}` : "Until — optional"}</span>
                          <PlatformDateField ar={ar} value={nursingUntil} onChange={setNursingUntil} />
                        </label>
                      </div>
                    );
                  })() : null}
                  {kind === "pregnancy_notice" ? (
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 11, color: MUTED }}>{ar ? "تاريخ الولادة المتوقع" : "Expected birth date"}</span>
                      <PlatformDateField ar={ar} value={dueDate} onChange={setDueDate} />
                    </label>
                  ) : null}
                </div>
              ) : null}
              {isOther ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "عنوان طلبك" : "Request title"}</span>
                  <input value={otherTitle} onChange={(e) => setOtherTitle(e.target.value)} placeholder={ar ? "مثال: نقل إلى فرع آخر · تعديل مسمّى وظيفي · إعادة جدولة وردية" : "e.g. move to another branch · title change · shift reschedule"} style={fieldStyle()} />
                  <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.8 }}>{ar ? "ما لا يقع في الأنواع أعلاه. يُوجَّه إلى مدير الفرع ويُقرَّر كبقية الطلبات." : "What the list above does not cover. It goes to the station manager like any other request."}</span>
                </label>
              ) : null}
              {isMoney ? (() => {
                const split = employeeWageSplit(subject?.profile || {}, subject);
                const wage = (split.base || 0) + (split.allowances || 0) - (split.night || 0);
                const cap = Math.round(wage * 0.1);
                const amt = Number(moneyAmount) || 0;
                const months = cap > 0 && amt > 0 ? Math.ceil(amt / cap) : 0;
                const seg = (on) => ({ fontFamily: "inherit", fontSize: 12.5, fontWeight: on ? 700 : 500, padding: "8px 14px", borderRadius: 8, border: `1px solid ${on ? "#0B3D27" : "var(--nv-line)"}`, background: on ? "#0B3D27" : "var(--nv-card)", color: on ? "#fff" : "var(--nv-ink2)", cursor: "pointer" });
                return (
                  <div data-money-fields="1" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div role="radiogroup" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" role="radio" aria-checked={moneyKind === "advance"} onClick={() => setMoneyKind("advance")} style={seg(moneyKind === "advance")}>{ar ? "سلفة — تُسترد من الراتب" : "Advance — recovered from pay"}</button>
                      <button type="button" role="radio" aria-checked={moneyKind === "allowance"} onClick={() => setMoneyKind("allowance")} style={seg(moneyKind === "allowance")}>{ar ? "بدل — يُصرف ولا يُسترد" : "Allowance — paid, not recovered"}</button>
                    </div>
                    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <span style={{ fontSize: 11, color: MUTED }}>{ar ? "المبلغ (ر.س) — إلزامي" : "Amount (SAR) — required"}</span>
                      <input data-money-amount="1" dir="ltr" inputMode="decimal" value={moneyAmount} onChange={(e) => setMoneyAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" style={fieldStyle()} />
                    </label>
                    {moneyKind === "advance" && cap > 0 ? (
                      <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                        {ar
                          ? `يُسترد بأقساط لا يزيد القسط على 10٪ من أجرك (${cap.toLocaleString("en-US")} ر.س شهرياً — المادة 92)${months ? ` · نحو ${months} ${months === 1 ? "شهر" : months === 2 ? "شهرين" : months <= 10 ? "أشهر" : "شهراً"}` : ""}.`
                          : `Recovered in instalments of at most 10% of your wage (SAR ${cap} a month — Art. 92)${months ? ` · about ${months} months` : ""}.`}
                      </span>
                    ) : null}
                  </div>
                );
              })() : null}
              {isLeave ? null : (
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={isMoney ? (ar ? "سبب الطلب — إلزامي" : "Reason — required") : (ar ? "تفصيل الطلب — إلزامي" : "Request detail — required")} style={fieldStyle()} />
              )}
              {needs118 ? (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                  <input type="checkbox" checked={employerAck} onChange={(e) => setEmployerAck(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>{manageLeave
                    ? (ar ? "أُبلغ الموظف بأنه لا يجوز له العمل لدى صاحب عمل آخر أثناء هذه الإجازة (المادة 118)." : "The worker was told not to work for another employer during this leave (Article 118).")
                    : (ar ? "أقرّ بأنني لن أعمل لدى صاحب عمل آخر أثناء هذه الإجازة (المادة 118)." : "I will not work for another employer during this leave (Article 118).")}</span>
                </label>
              ) : null}
              {canDecide && leave === "annual" ? (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                  <input type="checkbox" checked={deferConsent} onChange={(e) => setDeferConsent(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>{ar ? "موافقة العامل كتابةً على تأجيل رصيد السنة السابقة بعد تسعين يوماً (المادة 110) — للتسجيل المباشر فقط." : "Worker's written consent to postpone last year's leave beyond ninety days (Article 110) — for a direct record only."}</span>
                </label>
              ) : null}
              {!isSignableKind && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, color: MUTED }}>
                  {kind === "pregnancy_notice"
                    ? (ar ? "التقرير الطبي — إلزامي، صورة أو PDF (القرار 18632)" : "Medical report — required, image or PDF (Decision 18632)")
                    : needsDoc
                    ? (ar ? `المستند المؤيد — إلزامي، صورة أو PDF${leaveMeta.article ? ` (المادة ${leaveMeta.article})` : ""}` : `Supporting paper — required, image or PDF${leaveMeta.article ? ` (Art. ${leaveMeta.article})` : ""}`)
                    : (ar ? "مرفق — اختياري، صورة أو PDF، بلا توقيع" : "Attachment — optional, image or PDF, no signature")}
                </span>
                <AttachFileButton
                  ref={fileInputRef}
                  ar={ar}
                  accept={SUPPORTING_FILE_ACCEPT}
                  busy={fileBusy}
                  label={needsDoc ? (ar ? "أرفق المستند المؤيد" : "Attach the supporting paper") : (ar ? "أرفق الملف" : "Attach the file")}
                  onPick={onSupportingFile}
                />
                {supportingFile?.name ? (
                  <span style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
                    {supportingFile.url ? (
                      <a href={supportingFile.url} download={supportingFile.name} style={{ color: OK, fontWeight: 600, textDecoration: "none" }}>
                        {supportingFile.name}{supportingFile.size ? ` · ${formatFileSize(supportingFile.size, ar)}` : ""}
                      </a>
                    ) : (
                      <span style={{ color: OK, fontWeight: 600 }}>
                        {supportingFile.name}{supportingFile.size ? ` · ${formatFileSize(supportingFile.size, ar)}` : ""}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={clearSupportingFile}
                      style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "4px 10px", border: `1px solid ${BORDER}`, background: CARD, color: MUTED, cursor: "pointer" }}
                    >
                      {ar ? "أزل المرفق" : "Remove"}
                    </button>
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.8 }}>
                    {fileBusy
                      ? (ar ? "جارٍ قراءة الملف…" : "Reading the file…")
                      : needsDoc
                        ? (leave === "exam"
                          ? (ar ? "أرفق جدول المواعيد أو ورقة الأيام. إثبات أداء الامتحان يُرفع لاحقاً على بطاقة الطلب بعد بدء الأيام — المادة 115." : "Attach the timetable or exam-dates paper. Sitting proof is uploaded later on this request after the exam days begin — Article 115.")
                          : (ar ? "أرفق الورقة أو التقرير. لا يُطلب توقيع رقمي لهذا المرفق." : "Attach the paper or report. Digital signing is not required for this attachment."))
                        : (ar ? "لك حرية إرفاق ملف. لا يُطلب توقيع رقمي لهذا المرفق." : "You may attach a file. Digital signing is not required for this attachment.")}
                  </span>
                )}
                {fileError ? <span style={{ fontSize: 11, color: BAD }}>{fileError}</span> : null}
              </label>
              )}
            </div>
          )}

          {isDoc && (
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)" }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "ملاحظة للموارد البشرية — اختياري" : "Note for HR — optional"} style={fieldStyle()} />
            </div>
          )}

          {isCustody && (
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)" }}>
              <RequestSelfSignBlock
                ar={ar}
                file={supportingFile}
                paper={signedPaper}
                fileBusy={fileBusy}
                paperBusy={paperBusy}
                fileError={fileError}
                paperError={paperError}
                onPickFile={onSupportingFile}
                onClearFile={clearSupportingFile}
                onPickPaper={onSignedPaper}
                onClearPaper={() => { setSignedPaper(null); setPaperError(""); }}
                accept={SUPPORTING_FILE_ACCEPT}
                fileInputRef={fileInputRef}
                hint={ar
                  ? "أرفق الملف، وقّعه في قسم التوقيع، ثم ارفع النسخة هنا. القرار يبقى في طلباتي."
                  : "Attach the file, sign it in Digital signing, then upload the copy here. The decision stays in My Requests."}
                fileLabel={ar ? "أرفق الملف" : "Attach the file"}
                paperLabel={ar ? "ارفع النسخة الموقّعة" : "Upload the signed copy"}
              />
            </div>
          )}

          <div style={selfOnly
            ? { margin: "0 18px", display: "flex", flexDirection: "column", gap: 8, background: "var(--nv-soft, #F7F9F8)", border: "1px solid #EEF1EF", borderRadius: 10, padding: "12px 14px" }
            : { padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 8 }}>
            {gateDefs.map((g, i) => (
              <div key={g.id || g.text || i} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 10, alignItems: "start" }}>
                <span style={{
                  width: selfOnly ? 20 : 16, height: selfOnly ? 20 : 16, borderRadius: selfOnly ? "50%" : 4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: selfOnly ? 11 : 10, fontWeight: 700, marginTop: 2, flex: "none",
                  color: g.ok ? (selfOnly ? "#2F6B43" : OK) : (g.warn || !g.ok ? (selfOnly ? "#8A5A12" : (g.warn ? WARN : BAD)) : BAD),
                  border: selfOnly ? "none" : `1px solid ${g.ok ? "var(--nv-ok-line)" : g.warn ? "var(--nv-warn-line)" : "var(--nv-bad-line)"}`,
                  background: g.ok ? "#E6F2EA" : "#FBF3E1",
                }}>
                  {g.ok ? "✓" : "!"}
                </span>
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                  {g.text}{!g.ok && g.warn ? (ar ? " (تنبيه لا يمنع الإرسال — القرار للمدير)" : " (a warning, not a block — the manager decides)") : ""}
                </span>
              </div>
            ))}
          </div>

          {!(isNightFitness && !isNightFitnessRaise) ? (
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 9 }}>
            <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
              {isOtAssign
                ? (ar ? "أثر الاعتماد: إن اختار أجر إضافي يُوسم للمسير. إن اختار رصيداً يُزاد leaveTotals.annual بنفس مسار رفع الرصيد. لا إقرار 118." : "On approval: overtime pay is marked for payroll. Leave credit increments leaveTotals.annual on the same top-up path. No Article 118.")
                : isLeaveCredit
                ? (ar ? "أثر الإضافة: تُزاد الأيام فوراً في الملف باسمك. السنوي عبر مسار رفع الرصيد؛ التقديري في منحة مسجّلة. لا يوم إجازة ولا أثر على الجدول." : "On credit: days land on the file in your name now. Annual uses the top-up path; discretionary is a recorded grant. No leave day and no rota effect.")
                : isTopup
                ? (ar ? "أثر الاعتماد: يُزاد الرصيد السنوي بنفس حقل 21/30 يوماً. لا يوم إجازة ولا أثر على الجدول، ولا إقرار 118." : "On approval: the annual balance (the same 21/30-day field) increases. No leave day, no rota effect, and no Article 118.")
                : isDoc
                ? (ar ? `بعد الرفع: وثيقة بلغة ${docLang === "ar" ? "عربية" : "إنجليزية"} تُصدر وتبقى في الملف. الاعتماد بلا سبب جائز؛ الرفض يكتب سبباً يُحفظ في سجل التدقيق.` : "After raise: a letter is issued and stays on the file. Approve may skip a note; refuse writes a named reason on the audit trail.")
                : isGrant
                  ? (ar ? "أثر الاعتماد: يُخصم من الأيام التقديرية — لا من الرصيد السنوي. يوم الإجازة يُقفل في جدول الدوام." : "On approval: taken from discretionary days — not the annual balance. The leave day locks on the rota.")
                : isStudyConsent
                  ? (ar ? "أثر الاعتماد: تُسجَّل موافقة دراسية نهائية — الشركة لا ترجع عنها — وينتقل مسار إجازة الامتحان إلى الأجر (المادة 115). الدراسة لا تتوقف برفض الموافقة." : "On approval: study consent is final — the company does not withdraw it — and exam leave moves to the paid track (Article 115). Refusal does not stop studying.")
                : isNightFitness
                  ? (ar ? "أثر الاعتماد: يُكتب التقرير في ملف اللياقة الطبية (نفس حقل الجدول). تسجيل التقرير لا يتجاوز «غير لائق»." : "On approval: the report is written to the night-fitness file (the same roster field). Recording it does not override an unfit report.")
                : isLeave
                  ? (ar ? "أثر الاعتماد: يوم الإجازة يصير خلية مقفلة في جدول الدوام، وخارج حساب الحضور في التقويم." : "On approval: the leave day locks on the rota and drops out of attendance on the calendar.")
                  : (ar ? "أثر الاعتماد: يُسجَّل في سجل التدقيق ويظهر في التقويم التشغيلي يوم الواقعة." : "On approval: it is written to the audit trail and appears on the operational calendar.")}
            </span>
            <button type="button" disabled={!canSend || busy} onClick={() => send(manageLeave)} style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", height: 40, width: "100%", border: "none", borderRadius: CONTROL_RADIUS, fontSize: 13, fontWeight: 700, background: mode === "manage" ? (canSend ? "var(--nv-navy)" : "var(--nv-warn-fill)") : (canSend ? "#3C7D50" : "#E4E9E6"), color: mode === "manage" || canSend ? "#fff" : "#5B665F", cursor: canSend ? "pointer" : "default" }}>
              {sendLabel}
            </button>
            {canDecide && !isOtAssign && !isLeaveCredit && !isSignableKind && !manageLeave && (
              <>
                <button type="button" disabled={!canSend || busy || (isStudyConsent && !studyDirectGate.ok)} onClick={() => send(true)} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: 11, border: `1px solid ${canSend && !(isStudyConsent && !studyDirectGate.ok) ? BORDER : "var(--nv-line3)"}`, background: CARD, color: canSend && !(isStudyConsent && !studyDirectGate.ok) ? NAVY : MUTED, cursor: canSend && !(isStudyConsent && !studyDirectGate.ok) ? "pointer" : "default", width: "100%" }}>
                  {isStudyConsent && !studyDirectGate.ok
                    ? (ar ? studyDirectGate.reason : studyDirectGate.reasonEn)
                    : canSend ? (ar ? `تسجيل مباشر معتمد — ${isDoc ? docMeta.approverAr : "مدير الفرع"}` : `Record as approved — ${isDoc ? docMeta.approverEn : "station manager"}`) : (ar ? "لا تسجيل مباشر قبل رفع الموانع" : "Direct record waits until the blockers clear")}
                </button>
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
                  {ar ? "التسجيل المباشر للحالات التي لم يطلبها الموظف — تُقيَّد معتمدة باسم من سجّلها." : "Direct record is for cases the worker did not file — it is stored as approved in the recorder's name."}
                </span>
              </>
            )}
          </div>
          ) : null}
          </>)}
        </section>
        ) : null}
        </RaiseFold>
        ) : null}

        <div className="nv-req-inbox" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {mode !== "manage" ? (
            <section className="nv-req-balance" style={{ borderRadius: 12, overflow: "hidden", background: "linear-gradient(160deg, #0B3D27 0%, #0F5535 100%)", color: "#fff" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                <span className="nv-req-title" style={{ fontSize: 14, color: "#fff" }}>{ar ? "رصيد إجازاتي" : "My leave balance"}</span>
              </div>
              {(() => {
                const num = { fontSize: 20, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" };
                const sub = { fontSize: 11.5, color: "#C5DBCD" };
                const row = { padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,.1)", display: "flex", flexDirection: "column", gap: 8 };
                const head = (name, article, right) => (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 13, color: "#fff" }}>{name}</strong>
                      <StatutoryItem article={article} ar={ar} entitlement />
                    </span>
                    {right}
                  </div>
                );
                const annualPct = annual.statutory ? Math.max(0, Math.min(100, Math.round((annual.leftover / annual.statutory) * 100))) : 0;
                let left = sickUsed;
                const bandsLive = sickBands.map((band) => {
                  const used = Math.min(band.n, Math.max(0, left));
                  left -= used;
                  return { ...band, used, rest: band.n - used };
                });
                const current = bandsLive.find((band) => band.rest > 0);
                return (
                  <>
                    <div data-balance="annual" style={row}>
                      {head(ar ? "السنوية" : "Annual", "109", annual.statutory ? (
                        <span style={sub}><span style={num}>{annual.leftover}</span> {ar ? `متبقٍّ من ${annual.statutory} يوماً` : `left of ${annual.statutory} days`}</span>
                      ) : <span style={sub}>—</span>)}
                      <span className="nv-req-bar" style={{ background: "rgba(255,255,255,.18)" }}><span style={{ width: `${annualPct}%`, background: "#C8A45A" }} /></span>
                    </div>
                    {sickCap ? (
                      <div data-balance="sick" style={row}>
                        {head(ar ? "المرضية" : "Sick", "117", (
                          <span style={sub}>{ar ? (sickUsed ? <>استخدمت <span style={num}>{sickUsed}</span> {sickUsed <= 10 && sickUsed > 2 ? "أيام" : sickUsed === 1 ? "يوماً واحداً" : sickUsed === 2 ? "يومين" : "يوماً"} هذه السنة</> : "لم تستخدم منها شيئاً هذه السنة") : <>Used <span style={num}>{sickUsed}</span> days this year</>}</span>
                        ))}
                        <div style={{ display: "flex", gap: 3, height: 8 }}>
                          {bandsLive.map((band) => (
                            <span key={band.key} title={ar ? band.ar : band.en} style={{ flex: band.n, borderRadius: 999, background: "rgba(255,255,255,.12)", overflow: "hidden", display: "flex", justifyContent: "flex-start" }}>
                              <span style={{ width: `${band.n ? Math.round((band.rest / band.n) * 100) : 0}%`, background: band.color, borderRadius: 999 }} />
                            </span>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "#C5DBCD" }}>
                          {bandsLive.map((band) => (
                            <span key={band.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: band.color }} />
                              {ar ? `${band.ar}: ${band.rest} من ${band.n}` : `${band.en}: ${band.rest} of ${band.n}`}
                            </span>
                          ))}
                        </div>
                        <span style={{ fontSize: 11, color: "#A9CDB8", lineHeight: 1.7 }}>
                          {current
                            ? (ar ? `يومك المرضي التالي ${current.ar}.` : `Your next sick day is at ${current.en.toLowerCase()}.`)
                            : (ar ? "استُنفدت أيام هذه السنة." : "This year's days are used up.")}
                        </span>
                      </div>
                    ) : null}
                    {(() => {
                      // Work injury has no balance — it lasts until recovery. It shows only while one is on file.
                      const st = injuryStatus({ employee: subject, company: data, today });
                      if (!st || (!st.active && st.lastDay < today.slice(0, 4) + "-01-01")) return null;
                      const covered = st.covered !== false;
                      const iso = (x) => `\u2066${x}\u2069`;
                      const stop = covered && gosiInjuryWageMode(data) === "stop";
                      const pay = st.art139
                        ? (ar ? "سقط الحق — المادة 139" : "Right lost — Art. 139")
                        : covered
                          ? (stop ? (ar ? "بدل يومي من التأمينات" : "Daily allowance from GOSI") : (ar ? "أجرك كامل — والتأمينات تعوّض المنشأة" : "Full wage — GOSI reimburses the establishment"))
                          : st.phase === "full" ? (ar ? `أجر كامل حتى ${iso(st.fullUntil)}` : `Full pay until ${st.fullUntil}`) : (ar ? "75% من الأجر حتى الشفاء" : "75% of pay until recovery");
                      const pct = Math.min(100, Math.round((st.dayIndex / 365) * 100));
                      const mark = Math.round((60 / 365) * 100);
                      return (
                        <div data-balance="injury" style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,.1)", display: "flex", flexDirection: "column", gap: 7 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <strong style={{ fontSize: 13, color: "#fff" }}>{ar ? "إصابة العمل" : "Work injury"}</strong>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#0B3D27", background: st.active ? "#C8A45A" : "#C5DBCD", borderRadius: 999, padding: "2px 8px" }}>{st.active ? (ar ? "جارية" : "Ongoing") : (ar ? "انتهت" : "Closed")}</span>
                            </span>
                            <span style={{ fontSize: 11.5, color: "#C5DBCD" }}>{ar ? <>يوم العلاج <span style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{st.dayIndex}</span></> : <>Treatment day <strong>{st.dayIndex}</strong></>}</span>
                          </div>
                          {!covered ? (
                            <span style={{ position: "relative", height: 8, borderRadius: 999, background: "rgba(255,255,255,.12)", overflow: "hidden", display: "block" }}>
                              <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: `${pct}%`, background: st.phase === "full" ? "#C8A45A" : "#8FB79C", borderRadius: 999 }} />
                              <span title={ar ? "اليوم 60" : "Day 60"} style={{ position: "absolute", insetInlineStart: `${mark}%`, top: 0, bottom: 0, width: 2, background: "#fff", opacity: 0.7 }} />
                            </span>
                          ) : null}
                          <span style={{ fontSize: 11.5, color: "#C5DBCD", lineHeight: 1.7 }}>
                            {ar ? `إصابة ${iso(st.injuryDate)} · ${pay} · لا تُخصم من أي رصيد` : `Injury ${st.injuryDate} · ${pay} · not taken from any balance`}
                          </span>
                          {!covered && !st.art139 ? (
                            <span style={{ fontSize: 11, color: "#A9CDB8" }}>{ar ? `إن لم تُشفَ حتى ${iso(st.yearMark)} تُعامل عجزاً كلياً (المادة 137).` : `No recovery by ${st.yearMark} counts as total disability (Art. 137).`}</span>
                          ) : null}
                        </div>
                      );
                    })()}
                    {hajjLine ? (
                      <div data-balance="hajj" style={{ padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,.1)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 12, color: "#fff" }}>{ar ? "الحج" : "Hajj"}</strong>
                        <StatutoryItem article="114" ar={ar} entitlement />
                        <span style={{ fontSize: 11.5, color: "#C5DBCD" }}>{hajjLine}</span>
                      </div>
                    ) : null}
                    {(() => {
                      // Regs 22 bis — compensatory leave stands apart from annual leave, in hours, with its date.
                      const bal = compBalance(subject);
                      if (!(bal.earned > 0)) return null;
                      const late = bal.overdue.length > 0;
                      return (
                        <div data-balance="comp" style={{ padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,.1)", display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 12, color: "#fff" }}>{ar ? "التعويضية" : "Compensatory"}</strong>
                            <StatutoryItem article="107" ar={ar} entitlement />
                            <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginInlineStart: "auto" }}>{ar ? hoursAr(bal.left) : `${bal.left} h`}</span>
                          </span>
                          <span style={{ fontSize: 11.5, color: late ? "#F3C9A5" : bal.soon ? "#F3E3BC" : "#C5DBCD", lineHeight: 1.7 }}>
                            {ar
                              ? `${bal.left > 0 ? `${compDays(bal.left)} يوم عمل · ` : ""}مكتسبة ${hoursAr(bal.earned)} من الإضافي${bal.used ? ` · مأخوذة ${hoursAr(bal.used)}` : ""}${bal.held ? ` · محجوزة ${hoursAr(bal.held)}` : ""}${bal.nextTakeBy && bal.left > 0 ? ` · ${late ? "فات موعد التمتع" : "تمتع بها حتى"} ${formatArDate(bal.nextTakeBy, lang)}` : ""}. لا تسقط، وإن تركت العمل قبل أخذها تُصرف أجرتها.`
                              : `${bal.earned} h earned · ${bal.used} h taken${bal.nextTakeBy ? ` · take by ${bal.nextTakeBy}` : ""}. Paid out if you leave first.`}
                          </span>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
              <div style={{ padding: "10px 18px", fontSize: 10.5, color: "#A9CDB8", lineHeight: 1.7 }}>
                {ar ? "الأرقام من رصيد الملف. الزيادة من «رفع رصيد إجازة»." : "Figures come from the file. A top-up is requested, then decided."}
              </div>
            </section>
          ) : null}
          <section style={slab}>
            <header className={mode !== "manage" ? "nv-req-inbox-head is-mine" : "nv-req-inbox-head is-mine is-manage"}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <h2>
                  <span aria-hidden />
                  {mode === "manage" ? (ar ? "قائمة الطلبات" : "Request list") : (ar ? "طلباتي" : "My requests")}
                </h2>
                {mode === "manage" ? (
                  <span className="nv-req-inbox-meta">
                    {selectedRegister?.name || (focusStationId && focusStationId !== "all" ? stationName(focusStationId) : (ar ? "كل الفروع التي تديرها" : "Every branch you manage"))}
                  </span>
                ) : null}
              </div>
              <div className="nv-req-inbox-pills">
                {filters.map((f) => {
                  const on = stFilter === f.id;
                  return (
                    <button key={f.id} type="button" className="nv-chip" onClick={() => setStFilter(f.id)} style={headChip(on, true)} aria-pressed={on}>
                      {f.label}
                      <span dir="ltr" style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, background: on ? "rgba(255,255,255,.22)" : "#E6F2EA", color: on ? "#fff" : "#2F6B43", borderRadius: 999, padding: "0 6px", minWidth: 18, textAlign: "center", unicodeBidi: "isolate" }}>{f.n}</span>
                    </button>
                  );
                })}
              </div>
            </header>
            {stFilter === "archive" ? (
              <div style={{ padding: mode === "manage" ? "12px 14px 16px" : "12px 16px 18px" }}>
                <RequestArchiveBoard
                  employees={employees}
                  ar={ar}
                  currentUser={currentUser}
                  stations={stations}
                  focusStationId={focusStationId}
                  canManage={false}
                  scope={mode === "manage" ? "manage" : "mine"}
                  onWithdrawLeave={withdrawArchivedLeave}
                />
              </div>
            ) : filtered.length === 0 ? (
              <div className="nv-req-empty">
                {mode === "manage"
                  ? (managerPendingInbox(employees, lang).count
                    ? (managerPersonEmptyReason(lang) || (ar ? "لا طلبات في هذا النطاق." : "No requests in this scope."))
                    : (managerPendingInbox(employees, lang).emptyReason || (ar ? "لا طلبات في هذا النطاق." : "No requests in this scope.")))
                  : (ar ? "لا طلبات في هذا الفلتر." : "No requests in this filter.")}
              </div>
            ) : (
            <div className="nv-req-cards">
            {filtered.map((row) => {
              const st = row.status || "pending";
              const key = `${row.family}-${row.id}`;
              const noteVal = draftNotes[key] || "";
              const nightCycle = row.family === "other" && row.type === "night_consent";
              const nightStage = nightCycle ? nightRotateStage(row) : null;
              const mineNight = nightCycle && isOwnMineLaneRow(row, currentUser || self);
              const ownNightAct = mineNight && mode === "mine" && !canDecide;
              const nightSkin = nightStage === "active" ? "violation" : st;
              const skin = stateSkin(nightSkin);
              const unseenLeave = isUnseenApprovedLeave(row);
              const ownPending = (st === "pending" || st === "pending_manager") && isOwnMineLaneRow(row, currentUser || self);
              const decideLane = mode === "manage" ? "manage" : "mine";
              const headOwnDecide = requestMayDecideOnLane({
                actor: currentUser,
                subject: row.employee || self,
                lane: "mine",
                data,
              });
              const rowCanDecide = (decideLane === "mine" ? headOwnDecide : requestMayDecideOnLane({
                actor: currentUser,
                subject: row.employee || self,
                lane: "manage",
                data,
              })) && (decideLane !== "manage" || canDecide);
              const ackOn = !!nightAck[key];
              const stateLabel = nightStage === "active"
                ? (ar ? "سارية — حتى يختار الموظف" : "In force — until the worker chooses")
                : nightStage === "agreed_month" ? (ar ? "✓ موافقة محفوظة — يحق السحب" : "Consent on file — may withdraw")
                  : nightStage === "reduced_hours" ? (ar ? "✓ قُلّصت الساعات" : "Hours reduced")
                  : nightStage === "refused" ? (ar ? "✕ رُفض — دُوِّرت الفترة" : "Refused — rotated")
                    : nightStage === "withdrawn" ? (ar ? "✕ سُحبت الموافقة" : "Consent withdrawn")
                    : nightStage === "lapsed" ? (ar ? "انتهت بتغيير الدوام" : "Lapsed — roster changed")
                      : st === "pending_employee" ? (ar ? "⏳ بانتظار اختيار الموظف" : "Awaiting the worker")
                        : st === "pending_manager" ? (ar ? "⏳ بانتظار قرار المسؤول" : "Awaiting the manager")
                      : st === "pending" ? (ar ? "⏳ بانتظار قرار" : "Awaiting a decision")
                        : st === "revise" ? (ar ? "↩ يحتاج تعديلاً" : "Needs a change")
                          : st === "rejected" ? (ar ? "✕ مرفوض" : "Rejected")
                            : st === "refused_by_employee" ? (ar ? "✕ رفضه الموظف" : "Refused by the worker")
                            : st === "withdrawn" ? (ar ? "✕ مسحوب" : "Withdrawn")
                              : (row.recordedBy ? (ar ? `✓ سجّلها ${row.recordedBy}` : `Recorded by ${row.recordedBy}`) : (ar ? "✓ معتمد" : "Approved"));
              const rangeText = row.family === "leave"
                ? `${formatArDate(row.startDate, lang)}${row.endDate ? ` → ${formatArDate(row.endDate, lang)}` : ""}`
                : (row.date ? formatArDate(row.date, lang) : (row.startDate ? formatArDate(row.startDate, lang) : "—"));
              const dotColor = st === "withdrawn" ? "var(--nv-mute-fill, #C7CCD6)" : skin.edge;
              const citeNode = (
                <LaborArticleCite
                  article={row.article || ({ nursing_hour: "154", resignation: "79 مكرر" })[row.type] || undefined}
                  leaveType={row.family === "leave" ? row.type : undefined}
                  decisionId={["night_consent", NIGHT_FITNESS_TYPE, "pregnancy_notice", "family_duties"].includes(row.type) ? "18632" : (row.type === "heat_report" ? "3337" : undefined)}
                  productOnly={!row.article && !["night_consent", NIGHT_FITNESS_TYPE, "pregnancy_notice", "family_duties", "heat_report", "nursing_hour", "resignation"].includes(row.type)}
                  ar={ar}
                  showOfficial
                  entitlement={row.family === "leave" || row.type === "night_consent" || row.type === NIGHT_FITNESS_TYPE}
                  tone={isArticle106Assignment(row) ? "warn" : undefined}
                  glow={requestGlow(row)}
                />
              );
              const statusPill = (
                <span style={{ display: "inline-flex", alignItems: "center", minHeight: 22, padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: skin.color, background: skin.bg, border: `1px solid ${skin.border}` }}>{stateLabel}</span>
              );
              const cardTitle = mode === "manage"
                ? row.title
                : `${row.title}${!selfOnly && row.employee?.name ? ` · ${row.employee.name}` : ""}`;
              return (
                <article key={key} id={`nv-req-${key}`} className={`nv-req-card${focusKey === key ? " is-focus" : ""}`} style={unseenLeave ? { background: "var(--nv-ok-soft, #F7FBF9)" } : undefined}>
                  <div className="nv-req-card-top">
                    <span className="nv-req-dot" style={{ background: dotColor }} />
                    <strong>{cardTitle}</strong>
                    <div className="nv-req-card-cite">{citeNode}</div>
                    {mode === "manage" ? <span style={{ marginInlineStart: "auto" }}>{statusPill}</span> : null}
                  </div>
                  {mode === "manage" ? (
                    <dl className="nv-req-meta" data-req-meta="1">
                      {[
                        [ar ? "مقدّم الطلب" : "Filed by", row.employee?.name || "—"],
                        [ar ? "الفرع" : "Branch", employeeStationName(row.employee, stations) || "—"],
                        // A letter has no date of its own — the row only shows when the request carries one.
                        row.family === "leave" || (rangeText && rangeText !== "—") ? [row.family === "leave" ? (ar ? "الفترة" : "Period") : (ar ? "التاريخ" : "Date"), rangeText] : null,
                        row.type === "advance" && Number(row.amount) > 0 ? [ar ? (row.moneyKind === "allowance" ? "مبلغ البدل" : "مبلغ السلفة") : "Amount", `${Number(row.amount).toLocaleString("en-US")} ${ar ? "ر.س" : "SAR"}`] : null,
                        [ar ? "رُفع في" : "Filed on", row.createdAt ? formatArDate(String(row.createdAt).slice(0, 10), lang) : "—"],
                        [ar ? "رقم الطلب" : "Request no.", <span key="ref" dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", unicodeBidi: "isolate" }}>{requestPublicRef(row)}</span>],
                      ].filter(Boolean).map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <p className="nv-req-card-detail">
                    {row.family === "leave"
                      ? `${formatArDate(row.startDate, lang)} → ${formatArDate(row.endDate, lang)} · ${ar ? countAr(row.days || computeDaysSafe(row), "يوم واحد", "يومان", "أيام", "يوماً") : `${row.days || computeDaysSafe(row)}d`}${row.reason ? ` · «${row.reason}»` : ""}${leaveFileLabel(row, ar)}${String(row.type || "").toLowerCase() === "comp" ? (() => {
                        // Comp leave shows what it draws from its own balance, for both sides.
                        const bal = compBalance(row.employee, undefined, { exceptId: row.id });
                        const take = (Number(row.days) || computeDaysSafe(row)) * 8;
                        return ar ? ` · يُخصم ${hoursAr(take)} من رصيده التعويضي (${hoursAr(bal.left)} قبلها)` : ` · ${take} h of ${bal.left} h comp balance`;
                      })() : ""}`
                      : [row.type === STUDY_CONSENT_TYPE && (ar ? [row.program && `البرنامج: ${row.program}`, row.institution && `المؤسسة: ${row.institution}`, (row.startDate || row.date) && `البداية: ${formatArDate(row.startDate || row.date, lang)}`, row.approvedAt && `اعتُمدت: ${formatArDate(row.approvedAt, lang)}`, row.approvedBy && `بقرار: ${row.approvedBy}`].filter(Boolean).join(" · ") : [row.program && `Program: ${row.program}`, row.institution && `Institution: ${row.institution}`, (row.startDate || row.date) && `Start: ${formatArDate(row.startDate || row.date, lang)}`, row.approvedAt && `Approved: ${formatArDate(row.approvedAt, lang)}`, row.approvedBy && `By: ${row.approvedBy}`].filter(Boolean).join(" · ")), row.type === NIGHT_FITNESS_TYPE && (ar
                        ? [row.permanent ? NIGHT_FITNESS_PERMANENT_AR : ((row.from || row.examDate) && row.to) && `${NIGHT_FITNESS_FROM_AR} ${formatArDate(row.from || row.examDate, lang)} → ${NIGHT_FITNESS_TO_AR} ${formatArDate(row.to, lang)}`, row.approvedAt && `اعتُمد: ${formatArDate(row.approvedAt, lang)}`].filter(Boolean).join(" · ")
                        : [row.permanent ? NIGHT_FITNESS_PERMANENT_EN : ((row.from || row.examDate) && row.to) && `${NIGHT_FITNESS_FROM_EN} ${formatArDate(row.from || row.examDate, lang)} → ${NIGHT_FITNESS_TO_EN} ${formatArDate(row.to, lang)}`, row.approvedAt && `Approved: ${formatArDate(row.approvedAt, lang)}`].filter(Boolean).join(" · ")), row.type === LEAVE_TOPUP_TYPE && row.days && (ar ? `${row.days} أيام إضافية على الرصيد السنوي` : `${row.days} extra days on the annual balance`), isOvertimeAssignment(row) && otAssignmentLine(row, row.employee, ar), isArticle106Assignment(row) && (ar ? (ARTICLE_106_GROUNDS.find((g) => g.key === row.article106Ground)?.ar || "المادة 106") : (ARTICLE_106_GROUNDS.find((g) => g.key === row.article106Ground)?.en || "Art. 106")), row.type === RESIGNATION_TYPE && resignationDetail(row, ar), isDutyRequestType(row.type) && dutyRequestDetail(row, { ar, shiftLabel: ((data?.schedules || []).find((item) => String(item.stationId) === String(row.employee?.stationId))?.shiftTypes || []).find((shift) => shift.id === row.shiftTypeId)?.label || "" }), row.fileName && (ar ? `الملف: ${row.fileName}` : `File: ${row.fileName}`), row.purpose && (ar ? `الغرض: ${row.purpose}` : `Purpose: ${row.purpose}`), row.party && (ar ? `إلى: ${row.party}` : `To: ${row.party}`), row.type !== STUDY_CONSENT_TYPE && row.type !== NIGHT_FITNESS_TYPE && row.reason, row.type !== STUDY_CONSENT_TYPE && row.type !== NIGHT_FITNESS_TYPE && row.date && formatArDate(row.date, lang), mode !== "manage" && stationName(row.employee?.stationId)].filter(Boolean).join(" · ")}
                  </p>
                  {mode === "manage" && isDutyRequestType(row.type) && isPendingDecideStatus(st) ? <DutyRequestDecisionPanel row={row} data={data} ar={ar} /> : null}
                  {row.family === "leave" && String(row.type || "").toLowerCase() === "work_injury" ? (
                    <WorkInjuryPanel row={row} employee={row.employee || subject} data={data} companyId={company?.id} ar={ar} canDecide={mode === "manage" && canDecide} by={currentUser?.name || ""} onChanged={() => refresh?.()} />
                  ) : null}
                  {row.type === RESIGNATION_TYPE && row.exitRoute === EXIT_ROUTE_NOTICE75 && (isPendingDecideStatus(st) || st === "revise" || (st === "approved" && !row.settledAt)) ? (() => {
                    const rs = resignationState(row, today);
                    const canAct = mode === "manage" && rowCanDecide && st !== "approved";
                    return (
                      <div data-resignation-decision="notice75" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-soft, #F7F9F8)", fontSize: 12, lineHeight: 1.75, color: "var(--nv-ink2)" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0B3D27" }}>{ar ? "المادة 75 — إشعار إنهاء عقد غير محدد المدة" : "Article 75 — notice ending an open-ended contract"}</span>
                        <span>{ar ? `وصل الإشعار ${regulationDate(rs.submitted)} · ينتهي العقد في ${regulationDate(rs.endsOn)} دون قبول ولا تأجيل.` : `Notice delivered ${rs.submitted} · the contract ends on ${rs.endsOn}, with no acceptance or postponement.`}</span>
                        {canAct ? (
                          <button type="button" className="nv-dec-approve" disabled={busy} onClick={() => decide(row, "approved")} style={{ alignSelf: "flex-start" }}>
                            {ar ? `استلمتُ الإشعار — ابدأ إجراءات إنهاء الخدمة في ${regulationDate(rs.endsOn)}` : `Notice received — start offboarding for ${rs.endsOn}`}
                          </button>
                        ) : null}
                      </div>
                    );
                  })() : row.type === RESIGNATION_TYPE && (isPendingDecideStatus(st) || st === "revise") ? (() => {
                    const rs = resignationState(row, today);
                    const key = `${row.family}-${row.id}`;
                    const pDays = resignPostpone[key]?.days ?? "";
                    const pWhy = resignPostpone[key]?.why ?? "";
                    const pGate = checkPostponeResignationGate({ row, days: pDays, reason: pWhy, today });
                    const canAct = mode === "manage" && rowCanDecide;
                    return (
                      <div data-resignation-decision="1" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-soft, #F7F9F8)", fontSize: 12, lineHeight: 1.75, color: "var(--nv-ink2)" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0B3D27" }}>{ar ? "المادة 79 مكرر — الاستقالة لا تُرفض" : "Article 79 bis — a resignation is not refused"}</span>
                        <span>{ar ? `قُدّمت ${regulationDate(rs.submitted)} · السحب حتى ${regulationDate(rs.withdrawUntil)}` : `Filed ${rs.submitted} · withdraw until ${rs.withdrawUntil}`}</span>
                        {rs.postponedUntil
                          ? <span style={{ color: WARN, fontWeight: 600 }}>{ar ? `أُجّل القبول حتى ${regulationDate(rs.postponedUntil)} — ${row.postponeReason || ""}. تُقبل بحكم النظام عندها.` : `Acceptance postponed to ${rs.postponedUntil}. Accepted by law then.`}</span>
                          : <span style={{ color: WARN, fontWeight: 600 }}>{ar ? `دون رد تُعد مقبولة في ${regulationDate(rs.deemedAcceptedOn)}.` : `Deemed accepted on ${rs.deemedAcceptedOn} without a reply.`}</span>}
                        {canAct ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <button type="button" className="nv-dec-approve" disabled={busy} onClick={() => decide(row, "approved")} style={{ alignSelf: "flex-start" }}>
                              {ar ? "اقبل الاستقالة — ينتهي العقد اليوم" : "Accept — the contract ends today"}
                            </button>
                            {rs.canPostpone ? (
                              <div data-resignation-postpone="1" style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px dashed var(--nv-line)", paddingTop: 8 }}>
                                <strong style={{ fontSize: 12, color: NAVY }}>{ar ? `أو أجّل القبول — مرة واحدة، قبل ${regulationDate(rs.deemedAcceptedOn)}، حتى ${rs.postponeMax} يوماً` : `Or postpone acceptance — once, before ${rs.deemedAcceptedOn}, up to ${rs.postponeMax} days`}</strong>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                                  <span>{ar ? "عدد الأيام" : "Days"}</span>
                                  <input type="number" min={1} max={rs.postponeMax} value={pDays} onChange={(e) => setResignPostpone((m) => ({ ...m, [key]: { ...(m[key] || {}), days: e.target.value } }))} style={{ width: 80, height: 32, border: "1px solid var(--nv-line)", borderRadius: 6, padding: "0 8px", fontFamily: "inherit" }} />
                                  {pGate.ok ? <span style={{ color: MUTED }}>{ar ? `حتى ${regulationDate(pGate.until)}` : `until ${pGate.until}`}</span> : null}
                                </label>
                                <textarea rows={2} value={pWhy} placeholder={ar ? "الإيضاح المسبب: ما مصلحة العمل التي تقتضي التأجيل — يُسلَّم للعامل مكتوباً" : "The written reason: the work interest requiring postponement"} onChange={(e) => setResignPostpone((m) => ({ ...m, [key]: { ...(m[key] || {}), why: e.target.value } }))} style={{ border: "1px solid var(--nv-line)", borderRadius: 6, padding: 8, fontFamily: "inherit", fontSize: 12.5, resize: "vertical" }} />
                                {!pGate.ok && (pDays || pWhy) ? <span style={{ fontSize: 11.5, color: BAD }}>{ar ? pGate.reason : pGate.reasonEn}</span> : null}
                                <button type="button" className="nv-dec-return" disabled={busy || !pGate.ok} onClick={() => {
                                  const res = postponeResignation(company.id, row.employee.id, row.id, { days: pDays, reason: pWhy, actorId: currentUser?.id, actorName: currentUser?.name });
                                  if (!res.ok) { toast({ description: ar ? res.reason : res.reasonEn, variant: "destructive" }); return; }
                                  toast({ description: ar ? `أُجّل القبول حتى ${regulationDate(res.until)} — وصل الإيضاح للموظف.` : `Postponed to ${res.until} — the worker has the reason.` });
                                  refresh?.();
                                }} style={{ alignSelf: "flex-start" }}>
                                  {ar ? "أجّل القبول وأرسل الإيضاح" : "Postpone and send the reason"}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })() : null}
                  <div className="nv-req-card-status">
                    {mode === "manage" ? null : statusPill}
                    {nightCycle && nightStage === "active" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", minHeight: 22, padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: BAD, background: "var(--nv-bad-soft)", border: "1px solid var(--nv-bad-line)" }}>
                        {ar ? "موافقة خطية مطلوبة" : "Written consent is required"}
                      </span>
                    ) : null}
                  </div>
                  {mode !== "manage" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, color: "var(--nv-muted)", alignItems: "flex-end" }}>
                      <span dir="ltr" style={{ unicodeBidi: "isolate", fontWeight: 600, letterSpacing: 0.3 }}>{requestPublicRef(row)}</span>
                      <span>{rangeText}</span>
                    </div>
                  ) : null}
                  {mode !== "manage" ? <RequestDecisionPath status={st} ar={ar} managerLine={managerLine} effect={requestDecisionEffect(row, ar)} row={row} /> : null}
                  <div className="nv-req-acts">
                  {nightCycle && nightStage === "active" && ownNightAct && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                        {ar ? CONSENT_MINISTRY_HINT_AR : CONSENT_MINISTRY_HINT_EN}
                      </span>
                      <span style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <ConsentFileLink file={row.senderFile} ar={ar}>
                          {ar ? "نزّل الملف المصدر" : "Download the source file"}
                        </ConsentFileLink>
                        {row.paper?.name ? (
                          <ConsentFileLink file={row.paper} ar={ar}>
                            {ar ? `النسخة المرفوعة: ${row.paper.name}` : `Uploaded copy: ${row.paper.name}`}
                          </ConsentFileLink>
                        ) : null}
                      </span>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, color: MUTED }}>{ar ? "ارفع النسخة الموقّعة على هذا الطلب" : "Upload the signed copy on this request"}</span>
                        <AttachFileButton
                          ar={ar}
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          label={ar ? "أرفق النسخة الموقّعة" : "Attach the signed copy"}
                          onPick={(picked) => loadNightPaper(row, picked)}
                        />
                      </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                        <input type="checkbox" checked={ackOn} onChange={(e) => setNightAck((m) => ({ ...m, [key]: e.target.checked }))} style={{ marginTop: 2 }} />
                        <span>{ar ? "أقرّ بأنني كتبت موافقة خطية ووقّعت الملف في قسم التوقيع وأرفع النسخة هنا." : "I acknowledge that I wrote a written consent, signed the file in Digital signing, and upload the copy here."}</span>
                      </label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" disabled={busy || !ackOn || !row.paper?.name} onClick={() => answerNight(row, "agree")} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8, border: "none", background: ackOn && row.paper?.name ? "#3C7D50" : "#E4E9E6", color: ackOn && row.paper?.name ? "#fff" : "#555C66", cursor: ackOn && row.paper?.name ? "pointer" : "default" }}>
                          {ar ? "أوافق" : "Agree"}
                        </button>
                        <button type="button" disabled={busy} onClick={() => answerNight(row, "refuse")} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "7px 11px", border: "1px solid var(--nv-bad-line)", background: CARD, color: BAD, cursor: "pointer" }}>
                          {ar ? "أرفض" : "Refuse"}
                        </button>
                      </div>
                    </div>
                  )}
                  {nightCycle && nightStage === "agreed_month" && (
                    <div style={{ border: "1px solid var(--nv-line3)", background: SURFACE, padding: "10px 11px", display: "flex", flexDirection: "column", gap: 7 }}>
                      <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8, display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <StatutoryItem decisionId="18632" ar={ar} entitlement glow={requestGlow(row)} compact />
                        {ar ? "موافقة خطية محفوظة. يحق لك سحبها في أي وقت وفق القرار 18632 — لا تجديد شهري واجب." : "Written consent is on file. You may withdraw it at any time under decision 18632 — monthly renewal is not a legal duty."}
                      </span>
                      {ownNightAct ? (
                        <>
                          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                            <input type="checkbox" checked={ackOn} onChange={(e) => setNightAck((m) => ({ ...m, [key]: e.target.checked }))} style={{ marginTop: 2 }} />
                            <span>{ar ? "أقرّ بسحب موافقتي الخطية على الاستمرار كعامل ليلي، وأطلب التدوير لساعات عادية شهراً على الأقل." : "I withdraw my written consent to continue as a night worker, and ask to rotate to ordinary hours for at least one month."}</span>
                          </label>
                          <button type="button" disabled={busy || !ackOn} onClick={() => withdrawNight(row)} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "7px 11px", border: "1px solid var(--nv-bad-line)", background: CARD, color: BAD, cursor: ackOn ? "pointer" : "default", alignSelf: "flex-start" }}>
                            {ar ? "اسحب الموافقة" : "Withdraw consent"}
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>{ar ? "السحب حق الموظف من ملفي — الإدارة تُبلَّغ ولا تغلقها." : "Withdrawal is the worker's right from My file — management is notified and does not close it."}</span>
                      )}
                    </div>
                  )}
                  {ownPending ? (
                    <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
                      {ownPendingAwaitingNote(data, row.employee || self, lang)}
                    </span>
                  ) : null}
                  {rowCanDecide && nightCycle && nightStage === "active" && (
                    <div style={{ border: "1px solid var(--nv-bad-line)", background: "var(--nv-bad-soft)", padding: "10px 11px", display: "flex", flexDirection: "column", gap: 7, borderRadius: CONTROL_RADIUS }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: BAD }}>{ar ? "تنبيه فقط — دون تدخل" : "Notice only — no intervention"}</span>
                      <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                        {ar ? "الموظف يوافق أو يرفض من ملفي. الإدارة لا توافق عنه ولا ترفض ولا تغلق الطلب في النظام. يمكنك تذكيره يدوياً." : "The worker agrees or refuses from My file. Management does not agree, refuse, or close the request in the system. You may remind them by hand."}
                      </span>
                      <button type="button" disabled={busy} onClick={() => remindNight(row)} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "7px 11px", border: `1px solid ${BAD}`, background: CARD, color: BAD, cursor: "pointer", alignSelf: "flex-start" }}>
                        {ar ? "ذكّر الموظف" : "Remind the worker"}
                      </button>
                    </div>
                  )}
                  {isOvertimeAssignment(row) && st === "pending_employee" && isOwnMineLaneRow(row, currentUser || self) && (
                    <div style={{ border: isArticle106Assignment(row) ? "1px solid var(--nv-warn-line)" : "1px solid var(--nv-line3)", background: isArticle106Assignment(row) ? "var(--nv-warn-soft)" : SURFACE, padding: "10px 11px", display: "flex", flexDirection: "column", gap: 7 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isArticle106Assignment(row) ? WARN : MUTED }}>
                        {isArticle106Assignment(row)
                          ? (ar ? `تكليف إجباري — المادة 106 · ${ARTICLE_106_GROUNDS.find((g) => g.key === row.article106Ground)?.ar || ""}` : `Mandatory — Article 106 · ${ARTICLE_106_GROUNDS.find((g) => g.key === row.article106Ground)?.en || ""}`)
                          : (ar ? "اختر تعويض الساعات الإضافية" : "Choose overtime compensation")}
                      </span>
                      {row.fileName ? <span style={{ fontSize: 11, color: MUTED }}>{ar ? `ملف الواقعة: ${row.fileName}` : `Incident file: ${row.fileName}`}</span> : null}
                      {(() => {
                        // Both choices in the worker's own numbers — what each hour is worth, and why (Art. 107 · regs 22 bis).
                        const offer = otOffer({ employee: row.employee, hours: row.hours, date: row.date, exceptId: row.id });
                        const lines = otOfferLines(offer, ar);
                        const card = (on) => ({ fontFamily: "inherit", textAlign: "start", display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${on ? "#0B3D27" : "var(--nv-line)"}`, background: on ? "var(--nv-ok-soft)" : CARD, color: NAVY, minWidth: 0 });
                        return (
                          <div data-ot-offer="1" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 8 }}>
                              {[
                                ["pay", lines.payTitle, lines.rowsPay, offer.known ? (ar ? "المادة 107" : "Art. 107") : lines.payHow, false],
                                ["credit", lines.leaveTitle, lines.rowsLeave, ar ? "اللائحة 22 مكرر · المادة 107" : "Regs 22 bis · Art. 107", offer.year.leaveOverCap],
                              ].map(([choice, title, rows, foot, off]) => (
                                <button key={choice} type="button" data-ot-choice={choice} aria-pressed={otChoice[key] === choice} disabled={off} onClick={() => setOtChoice((m) => ({ ...m, [key]: choice }))} style={{ ...card(otChoice[key] === choice), opacity: off ? 0.55 : 1, cursor: off ? "default" : "pointer" }}>
                                  <strong style={{ fontSize: 13.5 }}>{title}</strong>
                                  {rows.length ? (
                                    <span style={{ display: "flex", flexDirection: "column", width: "100%", borderTop: "1px solid var(--nv-line2, #EEF1EF)", marginTop: 2 }}>
                                      {rows.map(([label, value, strong]) => (
                                        <span key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", borderBottom: "1px dashed var(--nv-line2, #EEF1EF)", fontSize: 11.5, color: strong ? NAVY : MUTED, fontWeight: strong ? 700 : 400 }}>
                                          <span>{label}</span>
                                          <span style={{ unicodeBidi: "isolate", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{value}</span>
                                        </span>
                                      ))}
                                    </span>
                                  ) : null}
                                  <span style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.7 }}>{foot}</span>
                                </button>
                              ))}
                            </div>
                            <span style={{ fontSize: 11, color: offer.year.overCap ? WARN : MUTED, lineHeight: 1.7 }}>{lines.yearLine}</span>
                            <span style={{ fontSize: 11, color: NAVY, lineHeight: 1.7 }}>{lines.compare}</span>
                          </div>
                        );
                      })()}
                      {otChoice[key] === "credit" ? (
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: MUTED }}>
                          {ar ? "موعد التمتع (اللائحة 22 مكرر — خلال 60 يوماً)" : "Date to take it (regs Art. 22 bis — within 60 days)"}
                          <PlatformDateField ar={ar} value={otEnjoy[key] || ""} onChange={(v) => setOtEnjoy((m) => ({ ...m, [key]: v }))} />
                          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                            <input type="checkbox" checked={!!otWindowAgreed[key]} onChange={(e) => setOtWindowAgreed((m) => ({ ...m, [key]: e.target.checked }))} style={{ marginTop: 2 }} />
                            <span>{ar ? "اتُفق على موعد أبعد من 60 يوماً." : "A later date than 60 days was agreed."}</span>
                          </label>
                        </label>
                      ) : null}
                      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                        <input type="checkbox" checked={!!otCapChoice[key]} onChange={(e) => setOtCapChoice((m) => ({ ...m, [key]: e.target.checked }))} style={{ marginTop: 2 }} />
                        <span>{ar ? "موافقة على تجاوز سقف 720 ساعة إن لزم (اللائحة 22)." : "Consent to exceed the 720-hour cap if needed (regs Art. 22)."}</span>
                      </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                        <input type="checkbox" checked={!!otAck[key]} onChange={(e) => setOtAck((m) => ({ ...m, [key]: e.target.checked }))} style={{ marginTop: 2 }} />
                        <span>{ar ? "أقرّ باختياري لتعويض هذه الساعات الإضافية." : "I acknowledge my choice of compensation for these overtime hours."}</span>
                      </label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={busy || checkEmployeeAcceptOtGate({ compensation: otChoice[key], ack: !!otAck[key], hours: row.hours, date: row.date, enjoyDate: otEnjoy[key], windowAgreed: !!otWindowAgreed[key], annualCapConsent: !!otCapChoice[key], otherRequests: row.employee?.otherRequests, exceptId: row.id }).ok === false}
                          onClick={() => answerOt(row, true)}
                          style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "7px 11px", border: "none", background: checkEmployeeAcceptOtGate({ compensation: otChoice[key], ack: !!otAck[key], hours: row.hours, date: row.date, enjoyDate: otEnjoy[key], windowAgreed: !!otWindowAgreed[key], annualCapConsent: !!otCapChoice[key], otherRequests: row.employee?.otherRequests, exceptId: row.id }).ok ? OK : WARN, color: "#fff", cursor: "pointer" }}
                        >
                          {ar ? "أقبل وأختار" : "Accept and choose"}
                        </button>
                        {isArticle106Assignment(row) ? (
                          <span style={{ fontSize: 11, color: WARN, lineHeight: 1.7 }}>{ar ? checkRefuseOtAssignmentGate(row).reason : checkRefuseOtAssignmentGate(row).reasonEn}</span>
                        ) : (
                          <button type="button" disabled={busy} onClick={() => answerOt(row, false)} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "7px 11px", border: "1px solid var(--nv-bad-line)", background: CARD, color: BAD, cursor: "pointer" }}>
                            {ar ? "أرفض التكليف" : "Refuse the assignment"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {rowCanDecide && isOvertimeAssignment(row) && st === "pending_employee" && (
                    <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>{ar ? "بانتظار اختيار الموظف لأجر إضافي أو رصيد. لا اعتماد قبل ذلك." : "Awaiting the worker's pay-or-credit choice. Approval waits."}</span>
                  )}
                  {row.type === STUDY_CONSENT_TYPE && (
                    <span style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <ConsentFileLink file={studyConsentEmployeeFileOf(row)} ar={ar}>
                        {ar ? `مرفق الموظف: ${studyConsentEmployeeFileOf(row)?.name || ""}` : `Employee file: ${studyConsentEmployeeFileOf(row)?.name || ""}`}
                      </ConsentFileLink>
                      {st === "approved" ? (
                        <ConsentFileLink file={studyConsentApprovalFileOf(row)} ar={ar}>
                          {ar ? `ملف الموافقة: ${studyConsentApprovalFileOf(row)?.name || ""}` : `Consent letter: ${studyConsentApprovalFileOf(row)?.name || ""}`}
                        </ConsentFileLink>
                      ) : null}
                    </span>
                  )}
                  {row.type === STUDY_CONSENT_TYPE && st === "approved" && (
                    <span style={{ fontSize: 12, color: OK, lineHeight: 1.85 }}>
                      {ar ? STUDY_CONSENT_IRREVOCABLE_AR : STUDY_CONSENT_IRREVOCABLE_EN}
                      {row.approvedAt ? (ar ? ` سُجّلت في ${formatArDate(row.approvedAt, lang)}.` : ` Recorded on ${formatArDate(row.approvedAt, lang)}.`) : ""}
                    </span>
                  )}
                  {row.type === NIGHT_FITNESS_TYPE && (
                    <span style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <ConsentFileLink file={nightFitnessEmployeeFileOf(row)} ar={ar}>
                        {ar ? `المرفق المقدَّم: ${nightFitnessEmployeeFileOf(row)?.name || ""}` : `Submitted file: ${nightFitnessEmployeeFileOf(row)?.name || ""}`}
                      </ConsentFileLink>
                      {st === "approved" ? (
                        <ConsentFileLink file={nightMedicalReportOf(row.employee) || nightFitnessEmployeeFileOf(row)} ar={ar}>
                          {ar ? `التقرير المسجّل: ${(nightMedicalReportOf(row.employee) || nightFitnessEmployeeFileOf(row))?.name || ""}` : `Recorded report: ${(nightMedicalReportOf(row.employee) || nightFitnessEmployeeFileOf(row))?.name || ""}`}
                        </ConsentFileLink>
                      ) : null}
                    </span>
                  )}
                  {row.type === NIGHT_FITNESS_TYPE && st === "approved" && (
                    <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
                      {ar ? NIGHT_FITNESS_RECORD_ONLY_AR : NIGHT_FITNESS_RECORD_ONLY_EN}
                    </span>
                  )}
                  {row.family === "leave" && row.type === "exam" && row.examLeaveTrack && (
                    <span style={{ fontSize: 11, color: row.examLeaveTrack === "paid" ? OK : WARN, lineHeight: 1.8 }}>
                      {row.examLeaveTrack === "paid"
                        ? (ar ? "مسار مدفوع — المادة 115." : "Paid track — Article 115.")
                        : (ar ? "من الرصيد أو بدون أجر — المادة 115." : "From annual leave or unpaid — Article 115.")}
                    </span>
                  )}
                  {row.family === "leave" && row.type === "exam" ? (
                    <LaborArticleCite article="115" ar={ar} showOfficial showText entitlement />
                  ) : null}
                  {row.family === "leave" && (row.suspension || row.unpaidComplementDays || row.recoverPay || row.joinAnnualToSick || row.advanceLeave) ? (
                    <div data-leave-law-facts="1" style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, lineHeight: 1.8 }}>
                      {row.suspension ? <span style={{ color: WARN }}>{ar ? `العقد موقوف ${row.suspension.days} يوماً (${regulationDate(row.suspension.from)} – ${regulationDate(row.suspension.to)}) — لا تُحسب في الخدمة ولا في الإجازة${row.suspension.contractEndAfter ? `، ومُدّد العقد حتى ${regulationDate(row.suspension.contractEndAfter)}` : ""} (المادة 116، اللائحة م25).` : `Contract suspended ${row.suspension.days} days (${row.suspension.from} – ${row.suspension.to})${row.suspension.contractEndAfter ? `; contract extended to ${row.suspension.contractEndAfter}` : ""} (Art. 116, Regs Art. 25).`}</span> : null}
                      {row.unpaidComplementDays ? <span style={{ color: WARN }}>{ar ? `تأخر الوضع: ${row.unpaidComplementDays} يوماً مكملة للأسابيع الستة بلا أجر (${regulationDate(row.unpaidComplementFrom)} – ${regulationDate(row.unpaidComplementTo)}) — المادة 151.` : `Late birth: ${row.unpaidComplementDays} unpaid complement days (${row.unpaidComplementFrom} – ${row.unpaidComplementTo}) — Article 151.`}</span> : null}
                      {row.recoverPay ? <span style={{ color: BAD }}>{ar ? `ثبت العمل لدى صاحب عمل آخر أثناء الإجازة — أجرها قابل للاسترداد (المادة 118): ${row.recoverReason || ""}` : `Proven work for another employer during leave — its pay is recoverable (Article 118): ${row.recoverReason || ""}`}</span> : null}
                      {row.joinAnnualToSick ? <span style={{ color: MUTED }}>{ar ? "موصولة بالإجازة المرضية السابقة بطلب العامل (المادة 82)." : "Joined to the preceding sick leave at the worker's request (Article 82)."}</span> : null}
                      {row.advanceLeave ? <span style={{ color: MUTED }}>{ar ? `جزء مقدم من إجازة السنة بنسبة ما قضاه العامل منها${row.advanceConsent ? " — بموافقة المنشأة" : " — يحتاج موافقة المنشأة"} (اللائحة النموذجية م33).` : `An advance of this year's leave pro-rata to time worked${row.advanceConsent ? " — company consented" : " — needs company consent"} (Model Regs Art. 33).`}</span> : null}
                    </div>
                  ) : null}
                  {row.family === "leave" && mode === "manage" && rowCanDecide && isPendingDecideStatus(st) && (row.advanceLeave || (row.type === "unpaid" && (unpaidSuspensionPlan(row.employee?.leaveRequests, row.employee?.profile?.hireDate, row).byRequest[row.id]?.days || 0) > 0)) ? (() => {
                    const flags = leaveDecideFlags[key] || {};
                    const set = (k, v) => setLeaveDecideFlags((m) => ({ ...m, [key]: { ...(m[key] || {}), [k]: v } }));
                    const box = (k, text) => (
                      <label key={k} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                        <input type="checkbox" checked={!!flags[k]} onChange={(e) => set(k, e.target.checked)} style={{ marginTop: 3 }} />
                        <span>{text}</span>
                      </label>
                    );
                    return (
                      <div data-leave-decide-flags="1" style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", border: "1px solid var(--nv-line3)", background: SURFACE }}>
                        {row.advanceLeave ? box("advanceConsent", ar ? "توافق المنشأة على منح هذا الجزء مقدماً (اللائحة النموذجية م33)." : "The company consents to grant this part in advance (Model Regs Art. 33).") : null}
                        {row.type === "unpaid" ? box("agreedOtherwise", ar ? "اتفق الطرفان على ألا يُوقف العقد في هذه الإجازة (المادة 116)." : "The parties agreed the contract is not suspended during this leave (Article 116).") : null}
                        {row.type === "unpaid" && !flags.agreedOtherwise ? box("extensionAgreedOtherwise", ar ? "اتفق الطرفان على عدم تمديد العقد المحدد المدة بمدة التوقف (اللائحة م25/2)." : "The parties agreed not to extend the fixed-term contract by the suspension (Regs Art. 25(2)).") : null}
                      </div>
                    );
                  })() : null}
                  {row.family === "leave" && row.type === "maternity" && st === "approved" && !row.actualBirthDate && (() => {
                    const ownRow = String(row.employee?.id || "") === String(currentUser?.id || "");
                    if (!(ownRow || rowCanDecide)) return null;
                    const val = maternityBirth[key] || "";
                    return (
                      <div data-maternity-birth="open" style={{ border: "1px solid var(--nv-line3)", background: SURFACE, padding: "10px 11px", display: "flex", flexDirection: "column", gap: 7 }}>
                        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                          {ar ? `التاريخ المرجح ${regulationDate(row.expectedBirthDate || row.eventDate)}. سجّلي تاريخ الوضع الفعلي: الأسابيع الستة بعده وجوبية، وإن تأخر الوضع فالمدة المكملة لها بلا أجر (المادة 151).` : `Expected ${row.expectedBirthDate || row.eventDate}. Record the actual birth: the six weeks after it are mandatory; if the birth is late, the complement is unpaid (Article 151).`}
                        </span>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                          <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
                            <span style={{ fontSize: 11, color: MUTED }}>{ar ? "تاريخ الوضع الفعلي" : "Actual birth date"}</span>
                            <PlatformDateField ar={ar} value={val} onChange={(v) => setMaternityBirth((m) => ({ ...m, [key]: v }))} />
                          </label>
                          <button type="button" data-maternity-birth-save="1" disabled={!val} onClick={() => {
                            const res = recordMaternityBirth(company.id, row.employee.id, row.id, val, { actor: currentUser?.name });
                            if (!res?.ok) { toast({ description: ar ? res?.reason : res?.reasonEn, variant: "destructive" }); return; }
                            toast({ description: ar ? (res.unpaidComplementDays ? `سُجّل الوضع — ${res.unpaidComplementDays} يوماً مكملة بلا أجر.` : "سُجّل الوضع وضُبطت الإجازة.") : "Birth recorded." });
                            refresh?.();
                          }} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, height: 38, padding: "0 14px", border: "none", borderRadius: 8, background: val ? "#0B3D27" : "var(--nv-line)", color: val ? "#fff" : MUTED, cursor: val ? "pointer" : "default" }}>
                            {ar ? "سجّل الوضع" : "Record the birth"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  {row.family === "leave" && st === "approved" && mode === "manage" && rowCanDecide && !row.recoverPay && String(row.employee?.id || "") !== String(currentUser?.id || "") && (() => {
                    const draft = breachDraft[key] || {};
                    if (!draft.open) {
                      return (
                        <button type="button" data-breach-open="1" onClick={() => setBreachDraft((m) => ({ ...m, [key]: { open: true } }))} style={{ alignSelf: "flex-start", fontFamily: "inherit", fontSize: 11, background: "none", border: "none", color: MUTED, textDecoration: "underline", cursor: "pointer", padding: 0 }}>
                          {ar ? "ثبت عمله لدى صاحب عمل آخر أثناء الإجازة؟ (المادة 118)" : "Proven work for another employer during this leave? (Article 118)"}
                        </button>
                      );
                    }
                    return (
                      <div data-breach="open" style={{ border: "1px solid var(--nv-bad-line)", background: "var(--nv-bad-soft)", padding: "10px 11px", display: "flex", flexDirection: "column", gap: 7 }}>
                        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>{ar ? "الإثبات على صاحب العمل: أرفق المستند واكتب ما ثبت. يصبح أجر الإجازة قابلاً للاسترداد في الرواتب (المادة 118)، ويُبلَّغ العامل وله التظلم." : "The burden is on the employer: attach the evidence and write what was proven. The leave pay becomes recoverable in payroll (Article 118); the worker is told and may object."}</span>
                        <input type="file" accept={SUPPORTING_FILE_ACCEPT} onChange={async (e) => {
                          const picked = e.target.files?.[0];
                          if (!picked) return;
                          const record = await readSupportingFile(picked);
                          setBreachDraft((m) => ({ ...m, [key]: { ...(m[key] || {}), file: record } }));
                        }} />
                        <textarea rows={2} value={draft.reason || ""} placeholder={ar ? "ما الذي ثبت: الجهة والتواريخ" : "What was proven: the employer and the dates"} onChange={(e) => setBreachDraft((m) => ({ ...m, [key]: { ...(m[key] || {}), reason: e.target.value } }))} style={{ border: "1px solid var(--nv-line)", borderRadius: 6, padding: 8, fontFamily: "inherit", fontSize: 12.5, resize: "vertical" }} />
                        <button type="button" data-breach-save="1" className="nv-dec-reject" onClick={() => {
                          const res = recordLeaveBreach(company.id, row.employee.id, row.id, { file: draft.file, reason: draft.reason, actorId: currentUser?.id, actorName: currentUser?.name });
                          if (!res.ok) { toast({ description: ar ? res.reason : res.reasonEn, variant: "destructive" }); return; }
                          toast({ description: ar ? "سُجّل الإخلال — أجر الإجازة قابل للاسترداد (المادة 118)." : "Recorded — the leave pay is recoverable (Article 118)." });
                          setBreachDraft((m) => ({ ...m, [key]: undefined }));
                          refresh?.();
                        }} style={{ alignSelf: "flex-start" }}>
                          {ar ? "سجّل الإخلال" : "Record the breach"}
                        </button>
                      </div>
                    );
                  })()}
                  {row.family === "leave" && row.type === "iddah" && st === "approved" && (() => {
                    const ownRow = String(row.employee?.id || "") === String(currentUser?.id || "");
                    if (row.iddahEndedAtBirth) {
                      return (
                        <span data-iddah-birth="done" style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.8 }}>
                          {ar ? `انتهت العدة بالوضع في ${regulationDate(row.iddahBirthDate)} — لا يُستفاد من باقيها بعد الوضع (اللائحة م40/5).` : `Iddah ended at birth on ${row.iddahBirthDate} (Regs Art. 40(5)).`}
                        </span>
                      );
                    }
                    if (!(ownRow || rowCanDecide) || !String(row.endDate || "").slice(0, 10) || String(row.endDate).slice(0, 10) < today) return null;
                    const val = iddahBirth[key] || "";
                    return (
                      <div data-iddah-birth="open" style={{ border: "1px solid var(--nv-line3)", background: SURFACE, padding: "10px 11px", display: "flex", flexDirection: "column", gap: 7 }}>
                        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                          {ar ? "إن كانت حاملاً ووضعت قبل نهاية العدة فإنها تنتهي بالوضع، ولا يُستفاد من باقيها بعده، وتبدأ إجازة الوضع (اللائحة م40/5)." : "If pregnant and the birth comes before the iddah ends, it ends at birth and maternity leave starts (Regs Art. 40(5))."}
                        </span>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                          <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
                            <span style={{ fontSize: 11, color: MUTED }}>{ar ? "تاريخ الوضع" : "Birth date"}</span>
                            <PlatformDateField ar={ar} value={val} onChange={(v) => setIddahBirth((m) => ({ ...m, [key]: v }))} />
                          </label>
                          <button type="button" data-iddah-birth-save="1" disabled={!val} onClick={() => {
                            const res = recordIddahBirth(company.id, row.employee.id, row.id, val, { actor: currentUser?.name });
                            if (!res?.ok) { toast({ description: ar ? res?.reason : res?.reasonEn, variant: "destructive" }); return; }
                            toast({ description: ar ? "سُجّل الوضع وانتهت العدة به." : "Birth recorded; iddah ended." });
                            refresh?.();
                          }} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, height: 38, padding: "0 14px", border: "none", borderRadius: 8, background: val ? "#0B3D27" : "var(--nv-line)", color: val ? "#fff" : MUTED, cursor: val ? "pointer" : "default" }}>
                            {ar ? "سجّل الوضع وأنهِ العدة" : "Record birth and end iddah"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  {row.family === "leave" && row.type === "exam" && st !== "rejected" && st !== "withdrawn" && (() => {
                    const sat = examSatState(row);
                    const settle = checkExamSittingSettleGate(row);
                    const satFile = examSatFileOf(row);
                    const notice = examNoticeFilesOf(row);
                    const ownExam = String(row.employee?.id || "") === String(currentUser?.id || "");
                    const canAttachSat = (ownExam || rowCanDecide) && sat.open && !sat.attached;
                    const due = sat.due && !sat.attached;
                    return (
                      <div style={{
                        border: due ? "1px solid var(--nv-bad-line)" : "1px solid var(--nv-line3)",
                        background: due ? "var(--nv-bad-soft)" : SURFACE,
                        padding: "10px 11px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 7,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: due || !settle.ok ? BAD : MUTED }}>
                          {sat.attached
                            ? (ar ? "إثبات أداء الامتحان — المادة 115" : "Exam sitting proof — Article 115")
                            : !settle.ok
                              ? (ar ? settle.reason : settle.reasonEn)
                              : due
                              ? (ar ? "مستحق — إثبات أداء الامتحان بعد انتهاء الأيام" : "Due — sitting proof after the exam days")
                              : (ar ? "إثبات أداء الامتحان — ورقة ثانية" : "Exam sitting proof — a second paper")}
                        </span>
                        {notice[0]?.name ? (
                          <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                            {ar ? `إثبات المواعيد: ${notice[0].name}` : `Timetable: ${notice[0].name}`}
                          </span>
                        ) : null}
                        {satFile?.name ? (
                          satFile.url ? (
                            <a href={satFile.url} download={satFile.name} style={{ fontSize: 11, color: OK, fontWeight: 600, textDecoration: "none" }}>
                              {ar ? `إثبات الأداء: ${satFile.name}` : `Sitting proof: ${satFile.name}`}
                            </a>
                          ) : (
                            <span style={{ fontSize: 11, color: OK, fontWeight: 600 }}>
                              {ar ? `إثبات الأداء: ${satFile.name}` : `Sitting proof: ${satFile.name}`}
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                            {sat.open
                              ? (ar ? "جدول المواعيد رُفع مع الطلب. أرفق هنا ما يدل على أداء الامتحان — حضور أو نتيجة — المادة 115." : "The timetable went with the request. Attach here what shows the exam was sat — attendance or a result — Article 115.")
                              : (ar ? `يُرفع إثبات الأداء بعد بدء أيام الامتحان (${formatArDate(row.startDate, lang)}).` : `Sitting proof is uploaded after the exam days begin (${formatArDate(row.startDate, lang)}).`)}
                          </span>
                        )}
                        {canAttachSat ? (
                          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 11, color: MUTED }}>{ar ? "أرفق إثبات الأداء — صورة أو PDF" : "Attach sitting proof — image or PDF"}</span>
                            <AttachFileButton
                              ar={ar}
                              accept={SUPPORTING_FILE_ACCEPT}
                              disabled={busy || !!examSatBusy[key]}
                              busy={!!examSatBusy[key]}
                              label={ar ? "أرفق إثبات الأداء" : "Attach sitting proof"}
                              onPick={(picked) => attachExamSat(row, picked)}
                            />
                          </label>
                        ) : null}
                        {examSatError[key] ? <span style={{ fontSize: 11, color: BAD }}>{examSatError[key]}</span> : null}
                      </div>
                    );
                  })()}
                  {st === "approved" && row.family === "leave" && (
                    <span style={{ fontSize: 12, color: isUnseenApprovedLeave(row) ? OK : MUTED, lineHeight: 1.85, display: "inline-flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      {leaveApprovalCardNote(row, lang)}
                      {String(row.type || "").toLowerCase() === "annual"
                        ? (ar
                          ? `حق ثابت في ${formatArDate(row.startDate, lang)} → ${formatArDate(row.endDate, lang)} بعد الاعتماد. لا تُلغى ولا يُغيَّر موعدها من الإدارة إلا بموافقة العامل وقبل حلول البدء.`
                          : `A fixed right on ${formatArDate(row.startDate, lang)} → ${formatArDate(row.endDate, lang)} after approval. Management cannot cancel or move it without the worker's consent before it starts.`)
                        : null}
                    </span>
                  )}
                  {rowCanDecide && (st === "pending" || st === "pending_manager") && !nightCycle && row.type !== RESIGNATION_TYPE && (() => {
                    const noticeIssued = String(draftExamNotice[key] || row.examNoticeIssuedAt || "").slice(0, 10);
                    const leaveForGate = row.family === "leave" && String(row.type || "").toLowerCase() === "exam" && noticeIssued
                      ? { ...row, examNoticeIssuedAt: noticeIssued }
                      : row;
                    const approveGate = row.family === "leave"
                      ? checkApproveLeaveGate(leaveForGate, !!leaveKindMeta(row.type)?.requiresFile, {
                        profile: row.employee?.profile,
                        requests: row.employee?.leaveRequests,
                        laborCalendar,
                        examNoticeIssuedAt: noticeIssued || undefined,
                      })
                      : checkApproveOtherRequestGate({ ...row, issuedFile: draftIssued[key] });
                    const rejectGate = row.family === "leave"
                      ? checkRejectLeaveGate(leaveForGate, {
                        nextStatus: "rejected",
                        actor: "manager",
                        profile: row.employee?.profile,
                        requests: row.employee?.leaveRequests,
                        otherRequests: row.employee?.otherRequests,
                        companyId: company?.id,
                        examNoticeIssuedAt: noticeIssued || undefined,
                        rejectGround: draftGround[key],
                        rejectVerified: !!draftVerified[key],
                      })
                      : (() => {
                        const grounded = checkGroundedRefusalGate({ ...row, family: "other" }, { ground: draftGround[key], verified: !!draftVerified[key], actor: "manager" });
                        if (!grounded.ok) return grounded;
                        return row.type === STUDY_CONSENT_TYPE
                          ? checkRejectStudyConsentGate(row, noteVal)
                          : row.type === NIGHT_FITNESS_TYPE
                            ? checkRejectNightFitnessGate(row, noteVal)
                            : { ok: true };
                      })();
                    const refusalGrounds = refusalGroundsFor(row);
                    const groundedNoteVal = refusalGrounds?.length && draftGround[key] ? refusalText(row, draftGround[key], noteVal, ar) : noteVal;
                    const refuseReasonGate = !rejectGate.ok || row.family === "leave" || row.type === STUDY_CONSENT_TYPE || row.type === NIGHT_FITNESS_TYPE
                      ? rejectGate
                      : checkRefuseRequestReasonGate(groundedNoteVal);
                    const refuseBlocked = !rejectGate.ok || !refuseReasonGate.ok || !groundedNoteVal.trim();
                    const noticeErrors = new Set(["EXAM_NOTICE", "EXAM_NOTICE_DATE", "EXAM_NOTICE_DELAY", "EXAM_NOTICE_PROOF"]);
                    const showExamNoticeField = row.family === "leave"
                      && String(row.type || "").toLowerCase() === "exam"
                      && (!approveGate.ok || noticeErrors.has(String(approveGate.error || "")) || !!noticeIssued);
                    const issuesFile = row.family === "other" && isLetterSignableType(row.type);
                    const showIssuedFile = issuesFile || (row.family === "other" && row.type === STUDY_CONSENT_TYPE);
                    return (
                      <RequestDecisionComposer
                        ar={ar}
                        busy={busy}
                        note={noteVal}
                        onNote={(value) => setDraftNotes((m) => ({ ...m, [key]: value }))}
                        showFile={showIssuedFile}
                        fileOptional={row.type !== STUDY_CONSENT_TYPE && !(issuesFile && row.type !== "custody" && !(row.senderFile || row.file || row.files?.[0]))}
                        fileTitle={issuesFile && row.type !== "custody" ? (ar ? "الوثيقة المختومة" : "Stamped letter") : ""}
                        fileLabel={row.type === STUDY_CONSENT_TYPE
                          ? (ar ? "ارفع ملف الموافقة" : "Upload the consent letter")
                          : (ar ? "أرفق النسخة المختومة" : "Attach the stamped copy")}
                        fileHint={row.docKind === "exp"
                          ? (ar ? `مطلوب · ${SERVICE_CERT_AR}` : `Required · ${SERVICE_CERT_EN}`)
                          : row.type === STUDY_CONSENT_TYPE
                          ? (ar ? "مطلوب قبل الاعتماد · PDF أو صورة. يُسلَّم للموظف على البطاقة." : "Required before approval · PDF or image. Delivered to the worker on this card.")
                          : issuesFile && row.type !== "custody" && !(row.senderFile || row.file || row.files?.[0])
                            ? (ar ? "مطلوب — الوثيقة الصادرة المختومة تُسلَّم للموظف على البطاقة · PDF أو صورة" : "Required — the issued stamped letter is delivered on the card · PDF or image")
                            : (ar ? "اختياري · PDF أو صورة" : "Optional · PDF or image")}
                        file={draftIssued[key] || null}
                        fileBusy={!!issuedBusy[key]}
                        fileError={issuedError[key] || ""}
                        accept={SUPPORTING_FILE_ACCEPT}
                        onPickFile={(picked) => loadIssuedFile(row, picked)}
                        onClearFile={() => {
                          setDraftIssued((m) => ({ ...m, [key]: null }));
                          setIssuedError((m) => ({ ...m, [key]: "" }));
                        }}
                        showExamNotice={showExamNoticeField}
                        examNotice={noticeIssued}
                        onExamNotice={(next) => setDraftExamNotice((m) => ({ ...m, [key]: next }))}
                        approveGate={approveGate}
                        rejectGate={rejectGate}
                        refuseBlocked={refuseBlocked}
                        noteReady={!!noteVal.trim()}
                        article106={isArticle106Assignment(row)}
                        approveLabel={row.type === "documents_return"
                          ? (ar ? "سُلّمت الوثائق" : "Documents returned")
                          : row.type === "art81_exit" || row.type === "pregnancy_notice"
                          ? (ar ? "استلم البلاغ" : "Acknowledge")
                          : row.type === "damage_objection"
                            ? (ar ? "اقبل الاعتراض ورد المبلغ" : "Accept and refund")
                            : row.type === "grievance"
                            ? (ar ? "اقبل التظلم" : "Uphold the grievance")
                            : issuesFile
                          ? (ar ? "اعتمد وأصدر الملف" : "Approve and issue the file")
                          : (ar ? "اعتمد الطلب" : "Approve the request")}
                        grounds={refusalGrounds}
                        groundName={key}
                        ground={draftGround[key] || ""}
                        onGround={(g) => setDraftGround((m) => ({ ...m, [key]: g }))}
                        verified={!!draftVerified[key]}
                        onVerified={(v) => setDraftVerified((m) => ({ ...m, [key]: v }))}
                        onApprove={() => decide(row, "approved")}
                        onReject={() => !refuseBlocked && decide(row, "rejected")}
                        onRevise={() => noteVal.trim() && decide(row, "revise")}
                      />
                    );
                  })()}
                  {((row.auditTrail || []).length || row.reviewNote || row.rejectReason) ? (
                    <div style={{ border: `1px solid ${st === "rejected" ? "var(--nv-bad-line)" : BORDER}`, background: st === "rejected" ? "var(--nv-bad-soft)" : SURFACE, padding: "10px 12px", borderRadius: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: st === "rejected" ? BAD : NAVY }}>
                        {ar ? `سجل التدقيق${row.reviewedBy ? ` · ${row.reviewedBy}` : ""}` : `Audit${row.reviewedBy ? ` · ${row.reviewedBy}` : ""}`}
                      </span>
                      {(row.auditTrail || []).length ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                          {requestAuditTrailRows(row, ar).map((event, index) => (
                            <span key={`${event.at || "e"}-${index}`} style={{ display: "block", fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
                              {event.text}
                              {event.by && !/^(system|unknown)$/i.test(String(event.by)) ? ` · ${event.by}` : ""}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ display: "block", fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.9 }}>{row.reviewNote || row.rejectReason}</span>
                      )}
                      {(requestStatuteCite(row).decisionId || requestStatuteCite(row).article) ? (
                        <span style={{ display: "block", fontSize: 10, color: MUTED, marginTop: 4 }}>
                          {requestStatuteCite(row).decisionId
                            ? (ar ? `قرار ${requestStatuteCite(row).decisionId}` : `Decision ${requestStatuteCite(row).decisionId}`)
                            : (ar ? `المادة ${requestStatuteCite(row).article}` : `Art. ${requestStatuteCite(row).article}`)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(st === "rejected" || st === "revise") && isOwnMineLaneRow(row, currentUser || self) && !nightCycle && (
                      <button type="button" onClick={() => refile(row)} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "6px 11px", border: `1px solid ${BORDER}`, background: CARD, color: NAVY, cursor: "pointer" }}>
                        {ar ? "أعد الإرسال" : "Send again"}
                      </button>
                    )}
                    {(st === "pending" || (st === "pending_manager" && row.requestedById === currentUser?.id)) && isOwnMineLaneRow(row, currentUser || self) && !nightCycle && !isOvertimeAssignment(row) && (row.type !== RESIGNATION_TYPE || resignationState(row, today).canWithdraw) && (
                      <button type="button" onClick={() => withdraw(row)} style={{ fontFamily: "inherit", fontSize: 11, padding: "6px 10px", border: `1px solid ${BORDER}`, background: CARD, color: BAD, cursor: "pointer" }}>
                        {ar ? "اسحب الطلب" : "Withdraw"}
                      </button>
                    )}
                    {st === "approved" && row.family === "leave" && isOwnMineLaneRow(row, currentUser || self) && unseenLeave && (
                      <button type="button" disabled={busy} onClick={() => seeDecision(row)} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "7px 12px", border: "none", background: OK, color: "#fff", cursor: "pointer" }}>
                        {ar ? "رأيت الاعتماد — ينتقل للأرشيف" : "I have seen the approval — move to archive"}
                      </button>
                    )}
                    {st === "approved" && row.family === "leave" && isOwnMineLaneRow(row, currentUser || self) && (() => {
                      const win = approvedLeaveWithdrawWindow(row);
                      if (!win.open) {
                        return unseenLeave ? null : (
                          <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                            {ar ? "لا يُسحب بعد حلول موعد البدء — الحق ثابت في تاريخه." : "It cannot be withdrawn after the start date — the right is fixed on that date."}
                          </span>
                        );
                      }
                      const ackOn = !!withdrawAck[key];
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%" }}>
                          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                            <input type="checkbox" checked={ackOn} onChange={(e) => setWithdrawAck((m) => ({ ...m, [key]: e.target.checked }))} style={{ marginTop: 2 }} />
                            <span>{ar ? `أقرّ بسحب إجازتي المعتمدة قبل موعد بدئها في ${formatArDate(win.start, lang)}، وإشعار الإدارة لتعديل الجدول.` : `I withdraw my approved leave before it starts on ${formatArDate(win.start, lang)}, and notify operations to adjust the roster.`}</span>
                          </label>
                          <button type="button" disabled={busy || !ackOn} onClick={() => withdraw(row, { consent: true })} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "6px 10px", border: `1px solid ${ackOn ? "var(--nv-bad-line)" : BORDER}`, background: CARD, color: ackOn ? BAD : MUTED, cursor: ackOn ? "pointer" : "default", alignSelf: "flex-start" }}>
                            {ar ? "اسحب الإجازة المعتمدة" : "Withdraw approved leave"}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                  </div>
                </article>
              );
            })}
            </div>
            )}
          </section>
        </div>
      </div>

      {selfOnly ? <RequestFilesBoard employees={employees} ar={ar} /> : null}

      {mode !== "manage" ? (
        <RequestsMinistryPanel
          ar={ar}
          lang={lang}
          subject={subject}
          liveArticle={isResignation ? "79 مكرر" : (isStudyConsent || (isLeave && leave === "exam") ? "115" : (isLeave ? (leaveMeta?.article || "") : ""))}
          liveKind={isLeave ? `leave:${leave}` : kind}
        />
      ) : null}

      {mode !== "manage" && isLeave && leave === "eid" ? (
      <div className="nv-req-lower" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <section style={slab}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span className="nv-req-title" style={{ fontSize: 14 }}>{ar ? "العطل الرسمية" : "Official holidays"}</span>
              <StatutoryItem article="112" ar={ar} entitlement />
            </span>
            <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
              {ar
                ? "بأجر كامل ولا تُخصم من السنوية. الوطني والتأسيس مقفلان في الجدول بلا طلب؛ العيد يُطلب على أيامه بعد ثبوتها."
                : "Full pay, not taken from annual. National Day and Founding Day leave lock on the roster with no request; request Eid on its dates once fixed."}
            </span>
          </div>
          {holidays.map((x) => {
            const hit = x.from && dates.some((d) => d >= x.from && d <= x.to);
            const past = x.to && x.to < today;
            const civicLocked = isRosterLockedCivicHoliday(x.id);
            const canAsk = !civicLocked && !!x.from && !!x.to && mode !== "manage";
            const leaveName = ar ? (x.ar || officialHolidayLeaveLabel(x.id, true, laborCalendar)) : (x.en || officialHolidayLeaveLabel(x.id, false, laborCalendar));
            const status = civicLocked
              ? (past
                ? (ar ? "مضت — كانت مقفلة بلا طلب" : "Past — was locked with no request")
                : (ar ? "مقفلة بلا طلب" : "Locked with no request"))
              : leave === "eid" && hit
                ? (ar ? `طلب ${officialHolidayKindLabel(x.id, true, laborCalendar)} على هذا الموعد` : `${officialHolidayKindLabel(x.id, false, laborCalendar)} request on this date`)
                : hit && leave === "annual"
                  ? (ar ? "داخل السنوية — تُمدَّد ولا تُخصم (اللائحة 24)" : "Inside annual — extended, not charged (regs Art. 24)")
                  : past
                    ? (ar ? "مضت" : "Past")
                    : canAsk
                      ? (ar ? "اضغط لطلب العيد" : "Tap to request Eid")
                      : !x.from
                        ? (ar ? "بانتظار ثبوت الموعد" : "Waiting for fixed dates")
                        : (ar ? "اطّلاع — المادة 112" : "Info — Art. 112");
            const rowStyle = {
              padding: "11px 18px",
              border: "none",
              borderBottom: "1px solid var(--nv-line3, var(--nv-soft))",
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gap: 10,
              alignItems: "center",
              background: civicLocked ? "var(--nv-mute-soft, var(--nv-soft))" : (hit ? "var(--nv-ok-soft)" : CARD),
              width: "100%",
              textAlign: "inherit",
              font: "inherit",
            };
            const body = (
              <>
                <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 12 }}>{leaveName}</strong>
                  <span style={{ fontSize: 10.5, color: MUTED }}>{ar ? x.noteAr : x.noteEn}</span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-end" }}>
                  <span dir="ltr" style={{ font: "500 11px 'IBM Plex Mono', monospace", unicodeBidi: "isolate" }}>{x.from ? (x.from === x.to ? formatArDate(x.from, lang) : `${formatArDate(x.from, lang)} → ${formatArDate(x.to, lang)}`) : (ar ? `${x.days} أيام` : `${x.days} days`)}</span>
                  <span style={{ fontSize: 10, color: canAsk ? OK : MUTED, fontWeight: 600 }}>{status}</span>
                </span>
              </>
            );
            if (canAsk) {
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => {
                    setKind("leave");
                    setLeave("eid");
                    setFrom(x.from);
                    setTo(x.to);
                  }}
                  style={{ ...rowStyle, cursor: "pointer" }}
                >
                  {body}
                </button>
              );
            }
            return (
              <div key={x.id} style={rowStyle}>
                {body}
              </div>
            );
          })}
        </section>
      </div>
      ) : null}

      {/* «إشعاراتي» lives in the header bell — not repeated here. */}


      <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
        {ar ? "بانتظار قرار:" : "Awaiting a decision:"} {pendingCount}
        {" · "}
        <Link to="/app/employees" style={{ color: NAVY, fontWeight: 600 }}>{ar ? "ملف الموظف" : "Employee file"}</Link>
        {mode === "mine" && showAdminLink ? (
          <>
            {" · "}
            <Link to="/app/requests/manage" style={{ color: NAVY, fontWeight: 600 }}>{ar ? "إدارة الطلبات" : "Request admin"}</Link>
          </>
        ) : null}
        {mode === "manage" ? (
          <>
            {" · "}
            <Link to="/app/requests" style={{ color: NAVY, fontWeight: 600 }}>{ar ? "طلباتي" : "My requests"}</Link>
          </>
        ) : null}
        {" · "}
        <Link to="/app/shifts" style={{ color: NAVY, fontWeight: 600 }}>{ar ? "جدول الدوام" : "Shift schedule"}</Link>
        {" · "}
        <Link to="/app/calendar" style={{ color: NAVY, fontWeight: 600 }}>{ar ? "التقويم التشغيلي" : "Operational calendar"}</Link>
        {" · "}
        <Link to="/verify" style={{ color: NAVY, fontWeight: 600 }}>{ar ? "التحقق" : "Verify"}</Link>
      </p>
    </div>
  );
}

function computeDaysSafe(row) {
  if (!row?.startDate || !row?.endDate) return Number(row?.days) || 0;
  return Math.max(1, Math.round((new Date(row.endDate) - new Date(row.startDate)) / 86400000) + 1);
}

function formatFileSize(bytes, ar) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return ar ? `${(n / (1024 * 1024)).toFixed(1)} م.ب` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return ar ? `${Math.max(1, Math.round(n / 1024))} ك.ب` : `${Math.max(1, Math.round(n / 1024))} KB`;
  return ar ? `${n} بايت` : `${n} B`;
}

function leaveFileLabel(row, ar) {
  const notice = (row?.files || []).find((file) => isRealSupportingFile(file) && String(file.kind || "") !== "exam_sat");
  const sat = isRealSupportingFile(row?.examSatFile) ? row.examSatFile : (row?.files || []).find((file) => String(file.kind || "") === "exam_sat" && isRealSupportingFile(file));
  const bits = [];
  if (notice?.name) bits.push(ar ? `المواعيد: ${notice.name}` : `timetable: ${notice.name}`);
  if (sat?.name) bits.push(ar ? `الأداء: ${sat.name}` : `sitting: ${sat.name}`);
  if (!bits.length) return "";
  return ` · ${bits.join(" · ")}`;
}
