import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import { setStationScope } from "@/lib/stationScopeStore";
import { answerNightRotate, answerOtAssignment, attachExamSatProof, attachWrittenConsentPaper, creditEmployeeLeaveBalance, grantDiscretionaryDays, markLeaveDecisionSeen, openDueNightRotateCycles, remindNightDue, setLeaveRequestStatus, setOtherRequestStatus, submitLeaveRequest, submitOtherRequest, submitOtAssignment, withdrawNightRotate } from "@/lib/store";
import { approvedLeaveWithdrawWindow, chargeableLeaveDays, checkApproveLeaveGate, checkExamSittingSettleGate, checkLeaveGenderGate, checkRejectLeaveGate, checkSubmitLeaveGate, examNoticeFilesOf, examSatFileOf, examSatState, hasLeaveAttachment, isRealSupportingFile, leaveNeedsAttachment, leaveNeedsArticle118Ack, leaveSpanIncludesOfficialHolidays } from "@/lib/leaveDerivations";
import { usedLeaveDays } from "@/lib/leaveTypes";
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
import { generateAbsenceDeduction } from "@/lib/deductionGenerators";
import { employeeShiftOnDay, isWeekDayPublished, weekStartDate } from "@/lib/shiftWeek";
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
import { iddahSpanFromEvent, maternityFollowOnSpan } from "@/lib/leaveTypes";
import { isRamadanHoursSubject } from "@/lib/laborRules";
import { profileGender } from "@/lib/employeeProfileFields";
import { leaveApprovalCardNote } from "@/lib/leaveEntitlementCycle";
import { BORDER, CARD, CONTROL_RADIUS, MUTED, NAVY, PAPER_SHADOW, PILL_RADIUS, RADIUS, SURFACE } from "@/lib/platformStyles";
import { REQUESTS_LAW_FOOT_AR, REQUESTS_LAW_FOOT_EN, REQUESTS_LAW_LEDE_AR, REQUESTS_LAW_LEDE_EN } from "@/lib/platformJudgment";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import StatutoryItem from "@/components/labor/StatutoryItem";
import WrittenConsentInbox from "@/components/requests/WrittenConsentInbox";
import WrittenConsentRaise from "@/components/requests/WrittenConsentRaise";
import RequestArchiveBoard from "@/components/requests/RequestArchiveBoard";
import RequestFilesBoard from "@/components/requests/RequestFilesBoard";
import RequestInboxSlab from "@/components/requests/RequestInboxSlab";
import { checkRaiseSignableGate, isLetterSignableType } from "@/lib/requestSigning";
import RequestDecisionComposer from "@/components/requests/RequestDecisionComposer";
import { attendanceOnDate, checkPunchRecordGate, parsePunchClock } from "@/lib/attendancePunch";
import PendingRequestFinder from "@/components/requests/PendingRequestFinder";
import ManagerEmployeeRegister from "@/components/requests/ManagerEmployeeRegister";
import RequestEmployeePicker from "@/components/requests/RequestEmployeePicker";
import RequestSelfSignBlock from "@/components/requests/RequestSelfSignBlock";
import PlatformDateField from "@/components/shared/PlatformDateField";
import AttachFileButton from "@/components/shared/AttachFileButton";

const NAVY_FILL = "var(--nv-navy)";
const OK = "var(--nv-ok-ink)";
const WARN = "var(--nv-warn-ink)";
const BAD = "var(--nv-bad-ink)";

const MINE_TILES = [
  { id: "leave", ar: "إجازة", en: "Leave", hintAr: "م 109 · السنوية والمرضية ورفع الرصيد", hintEn: "Art. 109 · annual, sick, and a balance top-up", letter: "إ" },
  { id: "study_consent", ar: "موافقة دراسية", en: "Study consent", hintAr: "م 115 · للامتحان أو الانتظام", hintEn: "Art. 115 · an exam or enrolment", letter: "د" },
  { id: "night_fitness", ar: "موافقة عمل ليلي", en: "Night-work consent", hintAr: "قرار 18632 · لياقة وموافقة خطية", hintEn: "Decision 18632 · fitness and written consent", letter: "ل" },
  { id: "manual", ar: "تسجيل حضور يدوي", en: "Manual punch", hintAr: "سلسلة الإثبات · حلقة بصمة مكسورة", hintEn: "Proof chain · a broken punch", letter: "ح" },
  { id: "outfix", ar: "تصحيح انصراف", en: "Checkout correction", hintAr: "سلسلة الإثبات · سجل لم يُغلق", hintEn: "Proof chain · a checkout left open", letter: "ص" },
  { id: "doc", ar: "وثيقة أو شهادة", en: "Document or letter", hintAr: "تعريف أو شهادة خدمة", hintEn: "A salary letter or service certificate", letter: "و" },
  { id: "money", ar: "سلفة أو بدل", en: "Advance or allowance", hintAr: "م 93 · الخصم لا يتجاوز نصف الأجر", hintEn: "Art. 93 · a deduction stays under half the wage", letter: "ف" },
  { id: "custody", ar: "عهدة", en: "Custody", hintAr: "تسليم أو إرجاع", hintEn: "Hand over or return", letter: "ع" },
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

function requestDecisionEffect(row, ar) {
  const title = `${row?.title || ""} ${row?.type || ""}`;
  if (/سلفة|بدل|advance|allowance/.test(title) || row?.type === "advance" || row?.type === "loan") {
    return ar ? "صرف أو رفض بسبب · م 93" : "Pay or refuse with a reason · Art. 93";
  }
  if (row?.family === "doc" || /وثيقة|شهادة|تعريف/.test(title)) return ar ? "يصدر في ملفك" : "Issued on your file";
  if (row?.type === "manual_punch" || row?.type === "checkout_fix" || /حضور|انصراف|بصمة/.test(title)) {
    return ar ? "قبل إقفال المسير" : "Before payroll closes";
  }
  if (row?.type === "sick" || /مرضية/.test(title)) return ar ? "بالتقرير · م 117" : "With the report · Art. 117";
  if (row?.family === "leave" || /إجازة/.test(title)) return ar ? "يُحسم من الرصيد" : "Taken from the balance";
  return ar ? "بقرار مكتوب" : "A written decision";
}

function RequestDecisionPath({ status, ar, managerLine, effect }) {
  const steps = ar
    ? [["رُفع", "أنت"], ["مديرك المباشر", managerLine || "خلال 48 س"], ["القرار", effect || ""]]
    : [["Raised", "You"], ["Your manager", managerLine || "Within 48h"], ["Decision", effect || ""]];
  const path = requestPathIndex(status);
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
  const [leave, setLeave] = useState("annual");
  const [doc2, setDoc2] = useState("salary");
  const [from, setFrom] = useState(() => (initialKind === "leave" ? "" : today));
  const [to, setTo] = useState(() => (initialKind === "leave" ? "" : today));
  const [note, setNote] = useState("");
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
  const [draftIssued, setDraftIssued] = useState({});
  const [draftExamNotice, setDraftExamNotice] = useState({});
  const [issuedBusy, setIssuedBusy] = useState({});
  const [issuedError, setIssuedError] = useState({});
  const [examSatBusy, setExamSatBusy] = useState({});
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
  const [otCapAck, setOtCapAck] = useState(false);
  const [otChoice, setOtChoice] = useState({});
  const [otAck, setOtAck] = useState({});
  const [otEnjoy, setOtEnjoy] = useState({});
  const [otWindowAgreed, setOtWindowAgreed] = useState({});
  const [otCapChoice, setOtCapChoice] = useState({});
  const [withdrawAck, setWithdrawAck] = useState({});
  const [punchTime, setPunchTime] = useState("");
  const [studyProgram, setStudyProgram] = useState("");
  const [studyInstitution, setStudyInstitution] = useState("");
  const [studyStart, setStudyStart] = useState("");
  const [studyApprovalFile, setStudyApprovalFile] = useState(null);
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
  const isStudyConsent = kind === "study_consent";
  const isNightFitness = kind === "night_fitness";
  const isPunchKind = kind === "manual" || kind === "outfix";
  const isSignableKind = isDoc || isCustody;
  const needsDates = !isDoc && !isTopup && !isLeaveCredit && !isOtAssign && !isStudyConsent && !isNightFitness;
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
  const otRaiseGate = checkRaiseOtAssignmentGate({
    reason: note,
    hours: otHours,
    date: from,
    dateTo: otTo,
    article106: ot106,
    article106Ground: otGround,
    manager106Ack: ot106Ack,
    annualCapConsent: otCapAck,
    files: supportingFile ? [supportingFile] : [],
    otherRequests: subject?.otherRequests,
  });
  const topupDaysGate = checkLeaveTopupDaysGate({ days: topupDays });
  const topupDaysOk = topupDaysGate.ok;
  const leaveKinds = leaveKindsFor(subject?.profile, ar, subject?.leaveRequests);
  useEffect(() => {
    if (kind !== "leave") return;
    if (leave && !leaveKinds.some((row) => row.key === leave)) setLeave("annual");
  }, [employeeId, kind, leave, leaveKinds]);
  const holidays = officialHolidays(today, laborCalendarOf(data));
  const needs118 = isLeave && leaveNeedsArticle118Ack(leave);
  const dates = rangeDates(from, to);
  const holidayHit = dates.filter((day) => holidays.some((h) => h.from && day >= h.from && day <= h.to));
  const counted = isLeave && (leave === "annual" || leave === "sick")
    ? (dates.length ? chargeableLeaveDays(from, to, leave, laborCalendarOf(data)) : 0)
    : dates.length;
  const annual = annualRemainingWithGrants(subject?.profile, subject?.leaveRequests);
  const isGrant = isLeave && leave === "grant";
  const overGrant = isGrant && counted > annual.leftoverGrants;
  const overBalance = (isLeave && leave === "annual" && counted > annual.remaining) || overGrant;
  const needsDoc = isLeave && (leaveNeedsAttachment({ type: leave, startDate: from, endDate: to, days: counted }, !!leaveMeta.requiresFile));
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
  const clash = needsDates
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
          ? `موافقة عمل ليلي · ${fitnessPermanent ? "مفتوحة" : "بين تاريخين"}`
          : `Night-work consent · ${fitnessPermanent ? "open" : "between dates"}`)
      : isOther
        ? (otherTitle.trim() || (ar ? "طلب آخر" : "Other request"))
        : (ar ? REQUEST_KINDS.find((row) => row.id === kind)?.ar : REQUEST_KINDS.find((row) => row.id === kind)?.en);

  const otherType = isDoc ? docMeta.type : (REQUEST_KINDS.find((row) => row.id === kind)?.type || "document");
  const otherReason = isDoc
    ? [purpose.trim(), party.trim(), note.trim(), otherName.trim()].filter(Boolean).join(" · ")
    : note.trim();

  const kindChips = allowedKinds.filter((row) => row.id !== "leave_topup");
  const mineTiles = MINE_TILES.filter((tile) => {
    if (tile.id === "leave") return allowedKinds.some((row) => row.id === "leave");
    return allowedKinds.some((row) => row.id === tile.id);
  });
  const tileOn = (tile) => (tile.id === "leave" ? (isLeave || isTopup) : kind === tile.id);
  const pickTile = (tile) => {
    if (tile.id === "leave") {
      setKind("leave");
      if (!leave || leave === "grant") setLeave("annual");
      return;
    }
    setKind(tile.id);
  };
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
  let gateDefs = isOtAssign
    ? [
      { ok: Number(otHours) > 0, text: Number(otHours) > 0
        ? (ar ? `${otHours} ساعة إضافية — الرصيد المقابل إن اختير: ${otCreditDays(otHours, from)} يوم.` : `${otHours} overtime hours — credit if chosen: ${otCreditDays(otHours, from)} days.`)
        : (ar ? "حدد ساعات التكليف." : "Set the assignment hours.") },
      { ok: !!from, text: from ? (ar ? `اليوم: ${formatArDate(from, lang)}` : `Day: ${formatArDate(from, lang)}`) : (ar ? "حدد تاريخ التكليف." : "Set the assignment date.") },
      { ok: note.trim().length >= 3, text: note.trim().length >= 3
        ? (ar ? "سبب التكليف مكتوب." : "The assignment reason is written.")
        : (ar ? "اكتب سبب التكليف." : "Write why this assignment is needed.") },
      { ok: !ot106 || !!otGround, text: !ot106
        ? (ar ? "تكليف اختياري — الموظف يقدر يرفض." : "Ordinary assignment — the worker may refuse.")
        : (otGround ? (ar ? `المادة 106: ${ARTICLE_106_GROUNDS.find((g) => g.key === otGround)?.ar || ""}` : `Article 106: ${ARTICLE_106_GROUNDS.find((g) => g.key === otGround)?.en || ""}`) : (ar ? "المادة 106: اختر أحد الأسباب الثلاثة." : "Article 106: pick one of the three grounds.")) },
      { ok: !ot106 || !!supportingFile, text: !ot106
        ? (ar ? "لا ملف إلا إذا وُسم التكليف بالمادة 106." : "No file unless this is marked Article 106.")
        : (supportingFile ? (ar ? `ملف الواقعة: ${supportingFile.name}` : `Incident file: ${supportingFile.name}`) : (ar ? "أرفق ملف الواقعة — ورقة حقيقية بلا توقيع." : "Attach the incident file — a real paper, no signature.")) },
      { ok: !ot106 || ot106Ack, text: !ot106
        ? (ar ? "إقرار 106 للمسؤول فقط عند التكليف الإجباري." : "The manager's Article 106 acknowledgement is only for mandatory work.")
        : (ot106Ack ? (ar ? "أُقرّ بأن واقعة استثنائية قائمة وفق المادة 106." : "Acknowledged: an exceptional Article 106 situation exists.") : (ar ? "أقرّ بأن واقعة استثنائية قائمة وفق السبب المختار (المادة 106)." : "Acknowledge that an exceptional situation exists under the chosen ground (Article 106).")) },
      { ok: !ot106 || otRaiseGate.ok || otRaiseGate.error !== "ARTICLE_106_YEAR_CAP", text: otRaiseGate.error === "ARTICLE_106_YEAR_CAP"
        ? (ar ? otRaiseGate.reason : otRaiseGate.reasonEn)
        : (ot106 && otGround === "pressure_inventory"
          ? (ar ? "سقف المادة 106 للجرد أو الضغط: 30 يوماً في السنة." : "Article 106 inventory/pressure cap: 30 days in the year.")
          : (ar ? "لا سقف سنوي لهذا السبب." : "This ground has no annual day cap.")) },
      { ok: otRaiseGate.ok || otRaiseGate.error !== "OT_ANNUAL_CAP" || otCapAck, text: otRaiseGate.error === "OT_ANNUAL_CAP"
        ? (ar ? otRaiseGate.reason : otRaiseGate.reasonEn)
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
      { ok: !!supportingFile, text: supportingFile ? (ar ? `الملف محمّل: ${supportingFile.name}` : `File loaded: ${supportingFile.name}`) : (ar ? "أرفق PDF أو صورة وانتظر تحميله." : "Attach a PDF or image and wait for it to load.") },
      { ok: !!signedPaper, text: signedPaper ? (ar ? `النسخة الموقّعة يدوياً: ${signedPaper.name}` : `Hand-signed copy: ${signedPaper.name}`) : (ar ? "نزّل الملف، وقّعه بيدك، ثم ارفع النسخة هنا." : "Download the file, sign it by hand, then upload the copy here.") },
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
        : (hasDoc ? (ar ? `المستند المؤيد مرفق: ${supportingFile.name} — المادة ${leaveMeta.article || "—"}.` : `Supporting document attached: ${supportingFile.name} — Art. ${leaveMeta.article || "—"}.`) : (ar ? `أرفق المستند المؤيد قبل الإرسال.` : "Attach the supporting document before sending.")) },
      { ok: !overBalance, text: !isLeave
        ? (ar ? "لا رصيد يُخصم لهذا النوع." : "No annual balance is deducted for this type.")
        : isGrant
          ? (overGrant
            ? (ar ? `الطلب ${counted} يوماً والمتبقي من الرصيد التقديري ${annual.leftoverGrants} — لا يُسحب من المستحق النظامي.` : `The request is ${counted} days; ${annual.leftoverGrants} discretionary days remain — not taken from the statutory entitlement.`)
            : (ar ? `يُخصم من الأيام التقديرية: ${counted} من ${annual.leftoverGrants}. لا يمسّ المستحق النظامي.` : `${counted} of ${annual.leftoverGrants} discretionary days. The statutory entitlement is untouched.`))
          : leave !== "annual"
            ? (ar ? "لا رصيد يُخصم لهذا النوع." : "No annual balance is deducted for this type.")
            : (overBalance ? (ar ? `الطلب ${counted} يوماً والمتبقي ${annual.remaining}.` : `The request is ${counted} days; ${annual.remaining} remain.`) : (ar ? `يُخصم من الرصيد السنوي: ${counted} من ${annual.remaining}.` : `${counted} of ${annual.remaining} annual days.`)) },
      { ok: clash.length === 0, warn: true, text: clash.length ? (ar ? `يتقاطع مع ${clash.length} وردية منشورة — إجازة على وردية منشورة — يحتاج بديلاً. التعيين يبقى حتى يُسند بديل ويُعاد النشر.` : `Clashes with ${clash.length} published shifts — leave on a published shift — needs a substitute. The assignment stays until a substitute is assigned and the week is republished.`) : (ar ? "لا تقاطع مع ورديات منشورة." : "No clash with a published shift.") },
      { ok: !isOther || otherTitle.trim().length > 2, text: !isOther ? (ar ? "نوع الطلب محدّد من القائمة." : "The type is already named.") : (otherTitle.trim().length > 2 ? (ar ? `عنوان طلبك: ${otherTitle.trim()}` : `Title: ${otherTitle.trim()}`) : (ar ? "اكتب عنوان طلبك قبل الإرسال." : "Write the title of your request before sending.")) },
      { ok: !!note.trim(), text: note.trim() ? (ar ? "السبب مكتوب — يظهر في طابور القرار." : "The reason is written — it appears in the decision queue.") : (ar ? "اكتب السبب: كل طلب يحمل سببه في سجل التدقيق." : "Write the reason — every request carries it in the audit trail.") },
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

  if (isLeave && ["marriage", "bereavement", "bereavement_sibling", "paternity", "maternity", "iddah"].includes(leave)) {
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
      files: supportingFile ? [supportingFile] : [],
      noOtherEmployerAck: true,
      reason: note || "—",
    }, { profile: subject?.profile, requests: subject?.leaveRequests, otherRequests: subject?.otherRequests, employee: subject, companyId: company?.id, laborCalendar });
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

  gateDefs = uniqueNamedGates(gateDefs);
  const blockers = gateDefs.filter((g) => !g.ok && !g.warn);
  const canSend = blockers.length === 0 && !!company?.id && !!subject?.id && !fileBusy && !paperBusy;

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
  const lawRows = lawArticleCards(lawFilter, isOtAssign ? (ot106 ? "106" : "107") : (isNightFitness ? "18632" : (isStudyConsent || (isLeave && leave === "exam") ? "115" : (isLeave ? leaveMeta.article : ""))), lang);
  const balanceRuleLive = isTopup || isLeaveCredit || (isLeave && leave === "grant");
  const judgmentRows = (lawFilter === "leave" || lawFilter === "all")
    ? [...lawRows, {
      art: "ops-disc",
      kind: "ops",
      citeKind: "ops",
      source: "product",
      name: ar ? "الأيام التقديرية" : "Discretionary days",
      impl: ar
        ? `أيام بتقدير الإدارة فوق المستحق. سقف ${DISCRETIONARY_GRANT_CAP} في السنة، لا تُرحَّل ولا تُصرف نقداً؛ المادة 111 تُلزم بالمستحق النظامي فقط.`
        : `Days granted above the statutory floor. Cap ${DISCRETIONARY_GRANT_CAP} a year; they do not carry and are not paid in cash. Article 111 binds the statutory entitlement only.`,
      live: balanceRuleLive,
    }]
    : lawRows;
  const balances = balanceRows(subject?.profile, subject?.leaveRequests, lang);
  void balances;
  const sickCap = ["leave.sick.fullPayDays", "leave.sick.halfPayDays", "leave.sick.unpaidDays"]
    .reduce((sum, id) => sum + (Number(ruleValue(id)) || 0), 0);
  const sickUsed = usedLeaveDays(subject?.leaveRequests, "sick", today, subject?.profile?.hireDate);
  const sickLeft = sickCap ? Math.max(0, sickCap - sickUsed) : null;
  const hajjTaken = (subject?.leaveRequests || []).some((row) => row.type === "hajj" && row.status === "approved") || !!subject?.profile?.hajjPerformed;
  const studyLive = hasIrrevocableStudyConsent(subject?.otherRequests);
  const managerId = subject?.profile?.directManagerId || self?.profile?.directManagerId || "";
  const managerPerson = (data?.employees || []).find((row) => managerId && String(row.id) === String(managerId));
  const managerLine = managerPerson?.name
    ? (ar ? `${managerPerson.name} · خلال 48 س` : `${managerPerson.name} · within 48h`)
    : "";
  const faceBalances = [
    {
      name: ar ? "السنوية" : "Annual",
      article: "109",
      val: annual.statutory ? String(annual.leftover) : "—",
      of: annual.statutory ? (ar ? `من ${annual.statutory}` : `of ${annual.statutory}`) : "",
      pct: annual.statutory ? Math.max(0, Math.min(100, Math.round((annual.leftover / annual.statutory) * 100))) : 0,
    },
    {
      name: ar ? "المرضية" : "Sick",
      article: "117",
      val: sickLeft == null ? "—" : String(sickLeft),
      of: sickCap ? (ar ? `من ${sickCap}` : `of ${sickCap}`) : "",
      pct: sickCap ? Math.max(0, Math.min(100, Math.round(((sickLeft || 0) / sickCap) * 100))) : 0,
    },
    {
      name: ar ? "الدراسية" : "Study",
      article: "115",
      val: studyLive ? (ar ? "حسب الجدول" : "Per the schedule") : "—",
      of: "",
      pct: studyLive ? 100 : 0,
    },
    {
      name: ar ? "الحج" : "Hajj",
      article: "114",
      val: hajjTaken ? (ar ? "استُخدمت" : "Used") : (ar ? "مرة" : "Once"),
      of: ar ? "في الخدمة" : "in service",
      pct: hajjTaken ? 0 : 100,
    },
  ];
  const grants = subject?.profile?.discretionaryGrants || [];
  const granted = grantDaysOf(subject?.profile);
  const stationName = (id) => stations.find((station) => station.id === id)?.name || "";

  const resetForm = () => {
    setNote("");
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
        if (direct && (leave === "unpaid" || leave === "maternity_extend")) generateAbsenceDeduction(company.id, subject.id, "direct", counted, currentUser);
      } else if (isOtAssign) {
        const saved = submitOtAssignment(company.id, subject.id, {
          reason: note.trim(),
          hours: otHours,
          date: from,
          dateTo: otTo,
          article106: ot106,
          article106Ground: otGround,
          manager106Ack: ot106Ack,
          annualCapConsent: otCapAck,
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
          date: isStudyConsent ? studyStart : (isNightFitness ? fitnessFrom : from),
          time: isPunchKind ? parsePunchClock(punchTime) : undefined,
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
          until: isNightFitness ? fitnessTo : undefined,
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
        if (isSignableKind) {
          const placeGate = checkRaiseSignableGate({ type: otherType, file: supportingFile, paper: signedPaper });
          if (!placeGate.ok) {
            toast({ description: ar ? placeGate.reason : placeGate.reasonEn, variant: "destructive" });
            return;
          }
        }
        const saved = submitOtherRequest(company.id, subject.id, {
          type: otherType,
          title: isOther ? otherTitle.trim() : undefined,
          reason: isOther ? [otherTitle.trim(), note.trim()].filter(Boolean).join(" — ") : (otherReason || note),
          date: isStudyConsent ? studyStart : (isNightFitness ? fitnessFrom : (needsDates ? from : undefined)),
          program: isStudyConsent ? studyProgram.trim() : undefined,
          institution: isStudyConsent ? studyInstitution.trim() : undefined,
          startDate: isStudyConsent ? studyStart : undefined,
          from: isNightFitness ? fitnessFrom : undefined,
          to: isNightFitness ? (fitnessPermanent ? "" : fitnessTo) : undefined,
          examDate: isNightFitness ? fitnessFrom : undefined,
          until: isNightFitness ? (fitnessPermanent ? "" : fitnessTo) : undefined,
          permanent: isNightFitness ? fitnessPermanent : undefined,
          time: isPunchKind ? parsePunchClock(punchTime) : undefined,
          days: isTopup ? topupDays : undefined,
          files: (isTopup || isSignableKind || isStudyConsent || isNightFitness) ? ((isStudyConsent || isNightFitness) && supportingFile ? [supportingFile] : files) : undefined,
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
        description: isSignableKind
          ? (ar ? "رُفعت النسخة الموقّعة يدوياً في طلباتي — القرار يبقى هنا." : "The hand-signed copy was raised in My Requests — the decision stays here.")
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
    setBusy(true);
    try {
      if (row.family === "leave") {
        const leaveRow = noticeIssued && String(row.type || "").toLowerCase() === "exam"
          ? { ...row, examNoticeIssuedAt: noticeIssued }
          : row;
        if (status === "approved") {
          const gate = checkApproveLeaveGate(leaveRow, !!leaveKindMeta(row.type)?.requiresFile, {
            profile: row.employee?.profile,
            requests: row.employee?.leaveRequests,
            laborCalendar,
            examNoticeIssuedAt: noticeIssued || undefined,
          });
          if (!gate.ok) {
            toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
            return;
          }
        }
        if (status === "rejected") {
          const refuse = checkRejectLeaveGate(leaveRow, { nextStatus: "rejected", actor: "manager", profile: row.employee?.profile, requests: row.employee?.leaveRequests, otherRequests: row.employee?.otherRequests, companyId: company.id, examNoticeIssuedAt: noticeIssued || undefined });
          if (!refuse.ok) {
            toast({ description: ar ? refuse.reason : refuse.reasonEn, variant: "destructive" });
            return;
          }
          const named = checkRefuseRequestReasonGate(noteVal);
          if (!named.ok) {
            toast({ description: ar ? named.reason : named.reasonEn, variant: "destructive" });
            return;
          }
        }
        const decided = setLeaveRequestStatus(company.id, row.employee.id, row.id, status === "revise" ? "revise" : status, currentUser.name, noteVal, {
          actorId: currentUser.id,
          lang,
          examNoticeIssuedAt: noticeIssued || undefined,
        });
        if (decided && decided.ok === false) {
          toast({ description: ar ? decided.reason : decided.reasonEn, variant: "destructive" });
          return;
        }
        if (status === "approved" && (row.type === "unpaid" || row.type === "maternity_extend")) {
          generateAbsenceDeduction(company.id, row.employee.id, row.id, Number(row.days) || computeDaysSafe(row), currentUser);
        }
      } else {
        if (status === "rejected") {
          const rejectGate = row.type === STUDY_CONSENT_TYPE
            ? checkRejectStudyConsentGate(row, noteVal)
            : row.type === NIGHT_FITNESS_TYPE
              ? checkRejectNightFitnessGate(row, noteVal)
              : checkRefuseRequestReasonGate(noteVal);
          if (!rejectGate.ok) {
            toast({ description: ar ? rejectGate.reason : rejectGate.reasonEn, variant: "destructive" });
            return;
          }
        }
        if (status === "rejected" && row.type !== STUDY_CONSENT_TYPE && row.type !== NIGHT_FITNESS_TYPE) {
          const named = checkRefuseRequestReasonGate(noteVal);
          if (!named.ok) {
            toast({ description: ar ? named.reason : named.reasonEn, variant: "destructive" });
            return;
          }
        }
        const result = setOtherRequestStatus(company.id, row.employee.id, row.id, status === "revise" ? "revise" : status, currentUser.name, noteVal, {
          issuedFile: draftIssued[key],
          actorId: currentUser.id,
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
            ? (ar ? "سُجّل اختيارك: رصيد إجازة — بانتظار اعتماد المسؤول." : "Your leave-credit choice is on file — awaiting the manager.")
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

  const sendLabel = canSend
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
        <div className="nv-req-raise" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
              {profileGender(subject?.profile) === "female" && !isRamadanHoursSubject({ profile: subject?.profile }) ? (
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
                  hint={ar ? "رصيد مرحّل أو تعويض · بلا تاريخ" : "Carried or compensated · no dates"}
                  onClick={() => { setKind("leave_topup"); setEmployerAck(false); }}
                />
              </div>
            </div>
          ) : null}
          {selfOnly && isNightFitness ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: "1px solid #EEF1EF" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{ar ? "مدة الموافقة" : "Consent span"}</strong>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#2F6B43", background: "#E6F2EA", borderRadius: 999, padding: "1px 8px" }}>{ar ? "قرار 18632" : "Decision 18632"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6 }}>
                <button type="button" onClick={() => setFitnessPermanent(false)} style={leaveTypeChip(!fitnessPermanent)}>
                  <strong style={{ fontSize: 12.5 }}>{ar ? "بين تاريخين" : "Between two dates"}</strong>
                  <span style={{ fontSize: 11, color: "#555C66" }}>{ar ? `${NIGHT_FITNESS_RANGE_AR} — تسقط بعد تاريخ النهاية` : `${NIGHT_FITNESS_RANGE_EN} — it lapses after the end date`}</span>
                </button>
                <button type="button" onClick={() => { setFitnessPermanent(true); setFitnessTo(""); }} style={leaveTypeChip(fitnessPermanent)}>
                  <strong style={{ fontSize: 12.5 }}>{ar ? "مفتوحة حتى التراجع" : "Open until withdrawn"}</strong>
                  <span style={{ fontSize: 11, color: "#555C66" }}>{ar ? `${NIGHT_FITNESS_PERMANENT_AR} — سارية حتى تسحبها أو تنتهي اللياقة` : `${NIGHT_FITNESS_PERMANENT_EN} — valid until you withdraw or fitness ends`}</span>
                </button>
              </div>
              <span style={{ fontSize: 11.5, color: "#3A4048", lineHeight: 1.7, background: "#F7F9F8", border: "1px solid #EEF1EF", borderRadius: 9, padding: "8px 11px" }}>
                {ar
                  ? "القرار 18632: لا يُسند عمل ليلي بلا لياقة طبية سارية وموافقة خطية منك. لك التراجع في أي وقت، ويُعاد جدولك بعد التراجع بإشعار. الموافقة المفتوحة تُراجَع مع كل تجديد للياقة."
                  : "Decision 18632: night work is not assigned without current medical fitness and your written consent. You may withdraw at any time, and the roster is reset after notice. An open consent is reviewed on each fitness renewal."}
              </span>
            </div>
          ) : null}
        </section>
        ) : null}
        {showRaiseForm ? (
        <section className="nv-req-leave-sheet" style={{ ...slab, display: "flex", flexDirection: "column" }}>
          <div className="nv-req-leave-head">
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="nv-req-title" style={{ fontSize: 14 }}>
                {mode === "manage" ? (ar ? "من الإدارة — تكليف أو رصيد" : "From management — assignment or credit") : (_kindTitle || (ar ? "طلب جديد" : "New request"))}
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
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", gap: 5, flexWrap: "wrap" }}>
            {kindChips.map((row) => (
              <button key={row.id} type="button" className="nv-chip" onClick={() => setKind(row.id)} style={chip(kind === row.id)}>
                {ar ? row.ar : row.en}
              </button>
            ))}
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
          </div>
          )}

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

          {isNightFitness && mode !== "manage" && (
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
              {profileGender(subject?.profile) === "female" && !isRamadanHoursSubject({ profile: subject?.profile }) && (
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                  {ar ? "غير مسلمة على الملف: العدّة 15 يوماً، ولا حج." : "Non-Muslim on file: 15-day iddah, and no Hajj."}
                </span>
              )}
              <div style={selfOnly
                ? { display: "flex", flexWrap: "wrap", gap: 6 }
                : { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 6 }}>
                {leaveKinds.filter((row) => row.key !== "grant").map((row) => (
                  <button key={row.key} type="button" className="nv-chip" onClick={() => { setKind("leave"); setLeave(row.key); clearSupportingFile(); if (row.key === "iddah" && eventDate) { const span = iddahSpanFromEvent(eventDate, subject?.profile); if (span.start) { setFrom(span.start); setTo(span.end); } } if (row.key === "maternity_extend" || row.key === "maternity_companion") { const span = maternityFollowOnSpan(subject?.leaveRequests, row.defaultTotal || 30); if (span.start) { setFrom(span.start); setTo(span.end); } setCompanionUnpaidExtend(false); } }} style={selfOnly ? chip(isLeave && leave === row.key) : pickBox(isLeave && leave === row.key)}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: isLeave && leave === row.key ? 700 : 500, color: selfOnly && isLeave && leave === row.key ? "#fff" : NAVY }}>{ar ? row.ar : row.en}</span>
                      <StatutoryItem article={row.article} label={!row.article ? row.cite : undefined} ar={ar} entitlement={!!row.article} />
                    </span>
                    <span style={{ fontSize: 10, color: selfOnly && isLeave && leave === row.key ? "rgba(255,255,255,.86)" : MUTED, lineHeight: 1.6 }}>{row.cap}</span>
                  </button>
                ))}
                <button type="button" onClick={() => { setKind("leave_topup"); setEmployerAck(false); }} style={pickBox(isTopup)}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: isTopup ? 700 : 500, color: NAVY }}>{ar ? "رصيد" : "Balance"}</span>
                    <StatutoryItem label={ar ? "قرار تشغيلي" : "Operational"} ar={ar} />
                  </span>
                  <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.6 }}>{ar ? "الموظف يطلب زيادة · المسؤول يزيدها" : "The worker requests more · the manager adds it"}</span>
                </button>
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
                      <span style={{ fontSize: 10, color: MUTED }}>{ar ? "المادة 106" : "Art. 106"}</span>
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
              {otRaiseGate.error === "OT_ANNUAL_CAP" ? (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                  <input type="checkbox" checked={otCapAck} onChange={(e) => setOtCapAck(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>{ar ? "موافقة العامل مسجّلة على تجاوز سقف 720 ساعة في السنة (اللائحة 22)." : "The worker's consent to exceed the annual 720-hour cap is on file (regs Art. 22)."}</span>
                </label>
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
                  <LaborArticleCite key={leave} leaveType={leave} profile={subject?.profile} onDate={from || today} ar={ar} showText showOfficial showChip={false} />
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
                    <span style={{ fontSize: 12, fontWeight: 600, color: NAVY, lineHeight: 1.35 }}>{ar ? "سبب الإجازة — إلزامي" : "Leave reason — required"}</span>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      style={{ ...fieldStyle(), borderRadius: CONTROL_RADIUS, height: 36, width: "100%" }}
                    />
                  </label>
                ) : null}
              </div>
              {isLeave && ["marriage", "bereavement", "bereavement_sibling", "paternity", "maternity", "iddah"].includes(leave) && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{leave === "iddah" ? (ar ? "تاريخ الوفاة" : "Date of death") : (ar ? "تاريخ الواقعة" : "Event date")}</span>
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
              {isOther ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "عنوان طلبك" : "Request title"}</span>
                  <input value={otherTitle} onChange={(e) => setOtherTitle(e.target.value)} placeholder={ar ? "مثال: نقل إلى فرع آخر · تعديل مسمّى وظيفي · إعادة جدولة وردية" : "e.g. move to another branch · title change · shift reschedule"} style={fieldStyle()} />
                  <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.8 }}>{ar ? "ما لا يقع في الأنواع أعلاه. يُوجَّه إلى مدير الفرع ويُقرَّر كبقية الطلبات." : "What the list above does not cover. It goes to the station manager like any other request."}</span>
                </label>
              ) : null}
              {isLeave ? null : (
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "تفصيل الطلب — إلزامي" : "Request detail — required"} style={fieldStyle()} />
              )}
              {needs118 ? (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                  <input type="checkbox" checked={employerAck} onChange={(e) => setEmployerAck(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>{ar ? "أقرّ بأنني لن أعمل لدى صاحب عمل آخر أثناء هذه الإجازة (المادة 118)." : "I will not work for another employer during this leave (Article 118)."}</span>
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
                  {needsDoc
                    ? (ar ? `المستند المؤيد — إلزامي، صورة أو PDF (المادة ${leaveMeta.article || "—"})` : `Supporting paper — required, image or PDF (Art. ${leaveMeta.article || "—"})`)
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

          {isSignableKind && (
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
            <button type="button" disabled={!canSend || busy} onClick={() => send(false)} style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", height: 40, width: "100%", border: "none", borderRadius: CONTROL_RADIUS, fontSize: 13, fontWeight: 700, background: mode === "manage" ? (canSend ? "var(--nv-navy)" : "var(--nv-warn-fill)") : (canSend ? "#3C7D50" : "#E4E9E6"), color: mode === "manage" || canSend ? "#fff" : "#5B665F", cursor: canSend ? "pointer" : "default" }}>
              {sendLabel}
            </button>
            {canDecide && !isOtAssign && !isLeaveCredit && !isSignableKind && (
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
        </section>
        ) : null}
        {mode === "manage" && canDecide ? (
          <WrittenConsentRaise employees={employees} stations={stations} ar={ar} refresh={refresh} />
        ) : null}
        </div>
        ) : null}

        <div className="nv-req-inbox" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {mode !== "manage" ? (
            <section className="nv-req-balance" style={{ borderRadius: 12, overflow: "hidden", background: "linear-gradient(160deg, #0B3D27 0%, #0F5535 100%)", color: "#fff" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                <span className="nv-req-title" style={{ fontSize: 14, color: "#fff" }}>{ar ? "رصيد إجازاتي" : "My leave balance"}</span>
              </div>
              {faceBalances.map((b) => (
                <div key={b.article} style={{ padding: "11px 18px", borderBottom: "1px solid rgba(255,255,255,.1)", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 12, color: "#fff" }}>{b.name}</strong>
                      <StatutoryItem article={b.article} ar={ar} entitlement />
                    </span>
                    <span dir="ltr" style={{ font: "500 11px 'IBM Plex Mono', monospace", color: "#C5DBCD", whiteSpace: "nowrap", unicodeBidi: "isolate" }}>{b.of ? `${b.val} ${b.of}` : b.val}</span>
                  </div>
                  <span className="nv-req-bar" style={{ background: "rgba(255,255,255,.18)" }}><span style={{ width: `${b.pct}%`, background: "#C8A45A" }} /></span>
                </div>
              ))}
              <div style={{ padding: "10px 18px", fontSize: 10.5, color: "#A9CDB8", lineHeight: 1.7 }}>
                {ar ? "الأرقام من رصيد الملف. الزيادة من «رفع رصيد إجازة»." : "Figures come from the file. A top-up is requested, then decided."}
              </div>
            </section>
          ) : null}
          <section style={slab}>
            <header className={mode !== "manage" ? "nv-req-inbox-head is-mine" : "nv-req-inbox-head"}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <h2>
                  <span aria-hidden />
                  {mode === "manage" ? (ar ? "القرار" : "Decision") : (ar ? "طلباتي" : "My requests")}
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
                    <button key={f.id} type="button" className="nv-chip" onClick={() => setStFilter(f.id)} style={headChip(on, mode !== "manage")} aria-pressed={on}>
                      {f.label}
                      <span dir="ltr" style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, background: mode !== "manage" ? (on ? "rgba(255,255,255,.22)" : "#E6F2EA") : (on ? "#0B3D27" : "rgba(255,255,255,.22)"), color: mode !== "manage" ? (on ? "#fff" : "#2F6B43") : "#fff", borderRadius: 999, padding: "0 6px", minWidth: 18, textAlign: "center", unicodeBidi: "isolate" }}>{f.n}</span>
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
                  article={row.article || undefined}
                  leaveType={row.family === "leave" ? row.type : undefined}
                  decisionId={row.type === "night_consent" || row.type === NIGHT_FITNESS_TYPE ? "18632" : undefined}
                  productOnly={!row.article && row.type !== "night_consent" && row.type !== NIGHT_FITNESS_TYPE}
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
                    {mode === "manage" ? <span className="nv-req-card-date">{rangeText}</span> : null}
                  </div>
                  {mode === "manage" ? (
                    <span className="nv-req-card-who">
                      {row.regardingLine || requestRegardingLine({
                        name: row.employee?.name,
                        stationName: employeeStationName(row.employee, stations),
                        lang,
                      }) || row.employee?.name || "—"}
                    </span>
                  ) : null}
                  <p className="nv-req-card-detail">
                    {row.family === "leave"
                      ? `${formatArDate(row.startDate, lang)} → ${formatArDate(row.endDate, lang)} · ${ar ? countAr(row.days || computeDaysSafe(row), "يوم واحد", "يومان", "أيام", "يوماً") : `${row.days || computeDaysSafe(row)}d`}${row.reason ? ` · «${row.reason}»` : ""}${leaveFileLabel(row, ar)}`
                      : [row.type === STUDY_CONSENT_TYPE && (ar ? [row.program && `البرنامج: ${row.program}`, row.institution && `المؤسسة: ${row.institution}`, (row.startDate || row.date) && `البداية: ${formatArDate(row.startDate || row.date, lang)}`, row.approvedAt && `اعتُمدت: ${formatArDate(row.approvedAt, lang)}`, row.approvedBy && `بقرار: ${row.approvedBy}`].filter(Boolean).join(" · ") : [row.program && `Program: ${row.program}`, row.institution && `Institution: ${row.institution}`, (row.startDate || row.date) && `Start: ${formatArDate(row.startDate || row.date, lang)}`, row.approvedAt && `Approved: ${formatArDate(row.approvedAt, lang)}`, row.approvedBy && `By: ${row.approvedBy}`].filter(Boolean).join(" · ")), row.type === NIGHT_FITNESS_TYPE && (ar
                        ? [row.permanent ? NIGHT_FITNESS_PERMANENT_AR : ((row.from || row.examDate) && row.to) && `${NIGHT_FITNESS_FROM_AR} ${formatArDate(row.from || row.examDate, lang)} → ${NIGHT_FITNESS_TO_AR} ${formatArDate(row.to, lang)}`, row.approvedAt && `اعتُمد: ${formatArDate(row.approvedAt, lang)}`].filter(Boolean).join(" · ")
                        : [row.permanent ? NIGHT_FITNESS_PERMANENT_EN : ((row.from || row.examDate) && row.to) && `${NIGHT_FITNESS_FROM_EN} ${formatArDate(row.from || row.examDate, lang)} → ${NIGHT_FITNESS_TO_EN} ${formatArDate(row.to, lang)}`, row.approvedAt && `Approved: ${formatArDate(row.approvedAt, lang)}`].filter(Boolean).join(" · ")), row.type === LEAVE_TOPUP_TYPE && row.days && (ar ? `${row.days} أيام إضافية على الرصيد السنوي` : `${row.days} extra days on the annual balance`), isOvertimeAssignment(row) && row.hours && (ar ? `${row.hours} ساعة` : `${row.hours} h`), isArticle106Assignment(row) && (ar ? (ARTICLE_106_GROUNDS.find((g) => g.key === row.article106Ground)?.ar || "المادة 106") : (ARTICLE_106_GROUNDS.find((g) => g.key === row.article106Ground)?.en || "Art. 106")), row.fileName && (ar ? `الملف: ${row.fileName}` : `File: ${row.fileName}`), row.purpose && (ar ? `الغرض: ${row.purpose}` : `Purpose: ${row.purpose}`), row.party && (ar ? `إلى: ${row.party}` : `To: ${row.party}`), row.type !== STUDY_CONSENT_TYPE && row.type !== NIGHT_FITNESS_TYPE && row.reason, row.type !== STUDY_CONSENT_TYPE && row.type !== NIGHT_FITNESS_TYPE && row.date && formatArDate(row.date, lang), stationName(row.employee?.stationId)].filter(Boolean).join(" · ")}
                  </p>
                  <div className="nv-req-card-status">
                    {statusPill}
                    {nightCycle && nightStage === "active" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", minHeight: 22, padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: BAD, background: "var(--nv-bad-soft)", border: "1px solid var(--nv-bad-line)" }}>
                        {ar ? "موافقة خطية مطلوبة" : "Written consent is required"}
                      </span>
                    ) : null}
                  </div>
                  {mode !== "manage" ? (
                    <div dir="ltr" style={{ display: "flex", flexDirection: "column", gap: 2, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--nv-muted)", unicodeBidi: "isolate" }}>
                      <span>{row.id || "—"}</span>
                      <span>{rangeText}</span>
                    </div>
                  ) : null}
                  {mode !== "manage" ? <RequestDecisionPath status={st} ar={ar} managerLine={managerLine} effect={requestDecisionEffect(row, ar)} /> : null}
                  <div className="nv-req-acts">
                  {nightCycle && nightStage === "active" && ownNightAct && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                        {ar ? CONSENT_MINISTRY_HINT_AR : CONSENT_MINISTRY_HINT_EN}
                      </span>
                      <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                        {ar ? "بعد ثلاثة أشهر كعامل ليلي تُطلب موافقة خطية محفوظة مع حق التراجع في أي وقت — لا تجديد شهري واجب — أو يُدوَّر العمل لساعات عادية شهراً على الأقل. أسبوع صباحي واحد لا يصفّر العدّ." : "After three months as a night worker, written consent stays on file with the right to withdraw at any time — monthly renewal is not a legal duty — or the work rotates to ordinary hours for at least one month. One morning week does not reset the clock."}
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
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => setOtChoice((m) => ({ ...m, [key]: "pay" }))} style={chip(otChoice[key] === "pay")}>{ar ? "أجر إضافي" : "Overtime pay"}</button>
                        <button type="button" onClick={() => setOtChoice((m) => ({ ...m, [key]: "credit" }))} style={chip(otChoice[key] === "credit")}>
                          {ar ? `رصيد إجازة · ${otCreditDays(row.hours, row.date)} يوم` : `Leave credit · ${otCreditDays(row.hours, row.date)} days`}
                        </button>
                      </div>
                      {otChoice[key] === "credit" ? (
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: MUTED }}>
                          {ar ? "موعد التمتع (اللائحة 22 مكرر — خلال 60 يوماً)" : "Date to take it (regs Art. 22 bis — within 60 days)"}
                          <input
                            type="date"
                            value={otEnjoy[key] || ""}
                            onChange={(e) => setOtEnjoy((m) => ({ ...m, [key]: e.target.value }))}
                            style={{ fontFamily: "inherit", fontSize: 12, padding: "6px 8px", border: `1px solid ${BORDER}`, background: CARD, color: NAVY }}
                          />
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
                  {rowCanDecide && (st === "pending" || st === "pending_manager") && !nightCycle && (() => {
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
                      })
                      : row.type === STUDY_CONSENT_TYPE
                        ? checkRejectStudyConsentGate(row, noteVal)
                        : row.type === NIGHT_FITNESS_TYPE
                          ? checkRejectNightFitnessGate(row, noteVal)
                          : { ok: true };
                    const refuseReasonGate = !rejectGate.ok || row.family === "leave" || row.type === STUDY_CONSENT_TYPE || row.type === NIGHT_FITNESS_TYPE
                      ? rejectGate
                      : checkRefuseRequestReasonGate(noteVal);
                    const refuseBlocked = !rejectGate.ok || !refuseReasonGate.ok || !noteVal.trim();
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
                        fileOptional={row.type !== STUDY_CONSENT_TYPE}
                        fileLabel={row.type === STUDY_CONSENT_TYPE
                          ? (ar ? "ارفع ملف الموافقة" : "Upload the consent letter")
                          : (ar ? "أرفق النسخة المختومة" : "Attach the stamped copy")}
                        fileHint={row.type === STUDY_CONSENT_TYPE
                          ? (ar ? "مطلوب قبل الاعتماد · PDF أو صورة. يُسلَّم للموظف على البطاقة." : "Required before approval · PDF or image. Delivered to the worker on this card.")
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
                        approveLabel={issuesFile
                          ? (ar ? "اعتمد وأصدر الملف" : "Approve and issue the file")
                          : (ar ? "اعتمد الطلب" : "Approve the request")}
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
                    {(st === "pending" || (st === "pending_manager" && row.requestedById === currentUser?.id)) && isOwnMineLaneRow(row, currentUser || self) && !nightCycle && !isOvertimeAssignment(row) && (
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

      {mode !== "manage" ? (
      <div className="nv-req-lower">
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

      {mode !== "manage" ? (
        <RequestInboxSlab employees={employees} notifications={data?.notifications || []} userId={viewerEmployeeId(currentUser) || currentUser?.id} viewer={currentUser || self} ar={ar} ownOnly={selfOnly} />
      ) : null}

      {mode !== "manage" ? (
      <div className="nv-req-lower">
        <section style={slab}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span className="nv-req-title" style={{ fontSize: 14 }}>{ar ? "أيام تقديرية" : "Discretionary days"}</span>
              <StatutoryItem label={ar ? "قرار تشغيلي — بلا مادة" : "Operational — no article"} ar={ar} />
            </span>
          </div>
          {grants.map((g) => (
            <div key={g.id || `${g.at}-${g.reason}`} style={{ padding: "12px 20px", borderBottom: "1px solid var(--nv-line2)", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10 }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{g.reason}</span>
                <span style={{ fontSize: 10, color: MUTED }}>{ar ? `منحه ${g.by} · ${formatArDate(g.at, lang)}` : `Granted by ${g.by} · ${formatArDate(g.at, lang)}`}</span>
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: OK }}>+{g.days}</span>
            </div>
          ))}
          <div style={{ padding: "13px 20px", borderTop: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "قواعد الأيام التقديرية" : "Discretionary-day rules"}</span>
            {(ar
              ? ["لا تُرحَّل: تسقط بنهاية السنة التقويمية ولا تُضاف لرصيد السنة التالية.", "لا تُصرف نقداً عند نهاية الخدمة — المادة 111 تُلزم بصرف المستحق النظامي غير المستخدم فقط.", `سقف ${DISCRETIONARY_GRANT_CAP} أيام في السنة، ومن مدير الفرع وما فوق، ولكل منحة سببها المكتوب.`]
              : ["They do not carry: they lapse at year-end.", "They are not paid in cash at exit — Article 111 pays unused statutory days only.", `Cap ${DISCRETIONARY_GRANT_CAP} days a year, from the station manager up, each grant with a written reason.`]
            ).map((text) => (
              <div key={text} style={{ display: "grid", gridTemplateColumns: "6px minmax(0,1fr)", gap: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c7ccd6", marginTop: 7 }} />
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>{text}</span>
              </div>
            ))}
          </div>
          {canDecide && fileRecordOpen && (
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 9, borderTop: "1px solid var(--nv-line3)" }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "منح أيام — للمدير" : "Grant days — manager"}</span>
              <div style={{ display: "grid", gridTemplateColumns: "84px minmax(0,1fr)", gap: 8 }}>
                <input type="number" min={1} max={30} value={grantDays} onChange={(e) => setGrantDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} style={{ ...fieldStyle(), fontFamily: "'IBM Plex Mono', monospace" }} />
                <input value={grantReason} onChange={(e) => setGrantReason(e.target.value)} placeholder={ar ? "سبب المنح — إلزامي" : "Grant reason — required"} style={fieldStyle()} />
              </div>
              <button
                type="button"
                onClick={grant}
                disabled={!grantReason.trim() || granted + grantDays > DISCRETIONARY_GRANT_CAP}
                style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: 10, border: "none", background: grantReason.trim() && granted + grantDays <= DISCRETIONARY_GRANT_CAP ? OK : WARN, color: "#fff", cursor: grantReason.trim() ? "pointer" : "default" }}
              >
                {granted + grantDays > DISCRETIONARY_GRANT_CAP
                  ? (ar ? `يتجاوز سقف ${DISCRETIONARY_GRANT_CAP} أيام — المتاح ${Math.max(0, DISCRETIONARY_GRANT_CAP - granted)}` : `Over the ${DISCRETIONARY_GRANT_CAP}-day cap — ${Math.max(0, DISCRETIONARY_GRANT_CAP - granted)} left`)
                  : (grantReason.trim() ? (ar ? `امنح ${grantDays} وسجّلها` : `Grant ${grantDays} and record them`) : (ar ? "اكتب سبب المنح أولاً" : "Write the grant reason first"))}
              </button>
            </div>
          )}
        </section>
      </div>
      ) : null}

      {selfOnly ? <RequestFilesBoard employees={employees} ar={ar} /> : null}

      {mode !== "manage" ? (() => {
        const toneOf = (row) => (row.warn && row.live ? "warn" : row.live ? "ok" : "na");
        const okN = judgmentRows.filter((row) => toneOf(row) === "ok").length;
        const naN = judgmentRows.filter((row) => toneOf(row) === "na").length;
        const warnRows = judgmentRows.filter((row) => toneOf(row) === "warn");
        const head = warnRows.length
          ? (ar ? `${warnRows.length} تنبيه نظامي` : `${warnRows.length} statutory alerts`)
          : (ar ? `مستقر · ${okN} مستوفى · ${naN} بلا أثر` : `Steady · ${okN} met · ${naN} with no effect`);
        const shown = lawOpen ? judgmentRows : warnRows;
        const tonePill = (tone) => {
          if (tone === "warn") return { label: ar ? "! تنبيه" : "! Alert", color: "#8A5A12", background: "#FBF3E1" };
          if (tone === "ok") return { label: ar ? "✓ مستقر" : "✓ Steady", color: "#2F6B43", background: "#E6F2EA" };
          return { label: ar ? "— بلا أثر" : "— No effect", color: "#555C66", background: "#F2F5F3" };
        };
        return (
      <section style={slab}>
        <div style={{ padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="nv-req-title" style={{ fontSize: 14 }}>{ar ? "حكم المنصة على طلبك" : "Platform judgment on your request"}</span>
          <span style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "0 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: warnRows.length ? "#FBF3E1" : "#E6F2EA", color: warnRows.length ? "#8A5A12" : "#2F6B43" }}>{head}</span>
          <span style={{ flex: 1, minWidth: 12 }} />
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {[["leave", ar ? "الإجازات" : "Leave"], ["work", ar ? "وقت العمل" : "Hours"], ["all", ar ? "الكل" : "All"]].map(([id, label]) => (
              <button key={id} type="button" onClick={() => { setLawFilter(id); setLawOpen(true); }} style={chip(lawFilter === id)}>{label}</button>
            ))}
          </div>
          <button type="button" onClick={() => setLawOpen((open) => !open)} style={chip(lawOpen)} aria-expanded={lawOpen}>
            {lawOpen
              ? (ar ? "أخفِ المواد" : "Hide the articles")
              : (ar ? `عرض المواد (${judgmentRows.length})` : `Show articles (${judgmentRows.length})`)}
          </button>
        </div>
        {shown.length ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {shown.map((a) => {
              const ops = a.citeKind === "ops" || a.source === "product";
              const ministerial = a.citeKind === "decision" || a.source === "ministerial";
              const src = ops
                ? (ar ? "داخل الشركة" : "Inside the company")
                : ministerial
                  ? (ar ? "قرار وزاري" : "Ministerial decision")
                  : (ar ? "نظام العمل" : "Labour Law");
              const tone = tonePill(toneOf(a));
              return (
                <div key={a.art} style={{ padding: "12px 16px", borderTop: "1px solid #EEF1EF", display: "flex", flexDirection: "column", gap: 6, background: a.live ? "var(--nv-ok-soft)" : CARD }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {ops ? (
                      <StatutoryItem label={ar ? "قرار تشغيلي" : "Operational"} ar={ar} />
                    ) : (
                      <StatutoryItem
                        article={ministerial ? undefined : a.art}
                        decisionId={ministerial ? a.art : undefined}
                        citeKind={a.citeKind}
                        source={a.source}
                        ruleId={a.art === "18632" ? "hours.night.rotateWeeks" : a.art === "104" ? "hours.rest.weeklyHours" : undefined}
                        ar={ar}
                        entitlement={a.entitlement}
                        warn={a.warn}
                        compact
                        glow={a.art === "18632" ? lawGlow("18632") : a.art === "104" ? lawGlow("hours.rest.weeklyHours") : "off"}
                      />
                    )}
                    <span style={{ fontSize: 11, color: MUTED }}>{src}{a.name ? ` · ${a.name}` : ""}</span>
                    <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: tone.color, background: tone.background }}>{tone.label}</span>
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--nv-ink)", lineHeight: 1.75 }}>{a.text || "—"}</span>
                  <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>
                    {a.impl || "—"}
                    {" · "}
                    {a.live ? (ar ? "ينطبق على هذا الطلب" : "Applies to this request") : (ar ? "لا ينطبق على السجل الحالي" : "Does not apply to the current record")}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
        <div style={{ padding: "10px 16px", fontSize: 11, color: MUTED, lineHeight: 1.7, borderTop: "1px solid #EEF1EF", background: "var(--nv-soft, #FAFBFA)" }}>
          {ar ? REQUESTS_LAW_LEDE_AR : REQUESTS_LAW_LEDE_EN}
          {" "}
          {ar ? REQUESTS_LAW_FOOT_AR : REQUESTS_LAW_FOOT_EN}
        </div>
      </section>
        );
      })() : null}

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
