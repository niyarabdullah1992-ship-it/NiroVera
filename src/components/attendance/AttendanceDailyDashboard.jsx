import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, MapPin } from "lucide-react";
import LocationMapModal from "@/components/attendance/LocationMapModal";
import { useI18n } from "@/lib/i18n";
import { formatTime, useTimeFormat } from "@/hooks/useTimeFormat";
import { deriveTeamAttendanceToday, getAttendanceStatus, getTodaysShift, isAttendancePolicyError, isScheduledToday } from "@/lib/attendance";
import { isServiceOutage } from "@/lib/serviceErrors";
import { todaysShiftEnded } from "@/lib/attendanceDerivations";
import { listLocalTodayAttendance, mergeAttendanceRows } from "@/lib/localAttendanceFallback";
import { decideManualPunchRequest, excuseAttendanceLocal, recordManualAttendance, reviewLateReturn, submitOtherRequest } from "@/lib/store";
import { breakDayOf as queueBreakDayOf, isLateReturnOpen, isPastCheckoutMissing as pastCheckoutMissing, pendingManualPunch, queueFacesOf } from "@/lib/attendanceQueue";
import { clockFromPunchReason, defaultManualCheckoutClock, parsePunchClock, riyadhNowClock } from "@/lib/attendancePunch";
import { minutesAr } from "@/lib/dutyAlerts";
import { citeRule } from "@/lib/laborRules";
import { PREVENTED_TYPE, checkEmployerPreventedGate } from "@/lib/modelRequests";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import EmployeeIdentityRow from "@/components/employees/EmployeeIdentityRow";
import { AttendanceChainProgress, brokeAtLabel, buildAttendanceRings } from "@/components/attendance/AttendanceTrustChrome";
import { formatUiNumber } from "@/lib/dateFormat";
import { DutyBoard } from "@/components/schedules/DutyTiles";
import FigureRow from "@/components/shared/FigureRow";
import RightHint from "@/components/shared/RightHint";
import { attRightHint } from "@/lib/rightHints.att.js";
import { dutyChip, dutyLabel } from "@/components/schedules/dutyStatus";
import { Collapsible } from "@/components/schedules/scheduleChrome";
import { ManageDutySideAuto } from "@/components/schedules/ManageDutySide";
import { fileDutyHref, openLinkStyle, revealNode, rosterPersonHref } from "@/components/schedules/dutyLinks";
import { ACCENT, BORDER, CARD, DANGER, MUTED, NAVY, emptyState, field, SURFACE } from "@/lib/platformStyles";
import NvIcon from "@/components/shared/NvIcon";
import StatusFilterPills from "@/components/shared/StatusFilterPills";

const miniBtn = (variant = "ghost") => ({
  height: 24,
  padding: "0 8px",
  borderRadius: 8,
  fontSize: 10,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
  lineHeight: 1,
  border: variant === "primary" ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
  background: variant === "primary" ? ACCENT : CARD,
  color: variant === "primary" ? "#fff" : NAVY,
});

const FLAG = {
  late: { ar: "متأخر", en: "Late", color: "var(--nv-warn-ink)", bg: "var(--nv-warn-soft)", border: "var(--nv-warn-line)" },
  absent: { ar: "غائب", en: "Absent", color: "var(--nv-bad-ink)", bg: "var(--nv-bad-soft)", border: "var(--nv-bad-line)" },
  outside: { ar: "خارج النطاق", en: "Outside range", color: "var(--nv-bad-ink)", bg: "var(--nv-bad-soft)", border: "var(--nv-bad-line)" },
  missing: { ar: "بلا انصراف", en: "No checkout", color: "var(--nv-warn-ink)", bg: "var(--nv-warn-soft)", border: "var(--nv-warn-line)" },
  early: { ar: "غادر مبكراً", en: "Left early", color: "var(--nv-warn-ink)", bg: "var(--nv-warn-soft)", border: "var(--nv-warn-line)" },
  late_return: { ar: "عودة متأخرة من الراحة", en: "Late return from break", color: "var(--nv-warn-ink)", bg: "var(--nv-warn-soft)", border: "var(--nv-warn-line)" },
  present: { ar: "مكتمل", en: "Complete", color: "var(--nv-ok-ink)", bg: "var(--nv-ok-soft)", border: "var(--nv-ok-line)" },
  on_leave: { ar: "إجازة", en: "Leave", color: "var(--nv-ink)", bg: "var(--nv-soft)", border: "var(--nv-line)" },
  not_scheduled: { ar: "غير مجدول", en: "Unscheduled", color: "var(--nv-muted)", bg: "var(--nv-soft)", border: "var(--nv-line)" },
};

// Manager-facing daily attendance table — merges the visible employee roster (local
// data) with today's attendance rows (Supabase) so unrecorded employees still show up.
function nowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function punchPolicyMessage(code, ar, kind) {
  if (code === "ON_APPROVED_LEAVE") {
    return ar
      ? (kind === "out" ? "لا يمكن إغلاق الحضور — لديه إجازة معتمدة لهذا اليوم." : "لا يمكن تسجيل الحضور — لديه إجازة معتمدة لهذا اليوم.")
      : (kind === "out" ? "Checkout blocked — approved leave today." : "Check-in blocked — approved leave today.");
  }
  if (code === "NOT_SCHEDULED") return ar ? "غير مدرج في جدول اليوم." : "Not scheduled today.";
  if (code === "ALREADY_CHECKED_IN") return ar ? "الحضور مسجّل لهذا اليوم." : "Already checked in today.";
  if (code === "ALREADY_CHECKED_OUT") return ar ? "الانصراف مسجّل لهذا اليوم." : "Already checked out today.";
  if (code === "NOT_CHECKED_IN") return ar ? "لا انصراف قبل حضور مسجّل." : "Checkout needs a recorded check-in.";
  return "";
}

/** Today's shift is over (+1 h grace). An overnight shift ends tomorrow — never «over» on its start day. */
function shiftWindowElapsed(shift) {
  return todaysShiftEnded(shift, nowMinutes(), 60);
}

/**
 * Queue actions — one height, one radius (8). «approve» is the primary green; «ghost» is neutral
 * (a note, not a penalty); «reject» keeps the bad outline for a real penalty only.
 */
const actBtn = (kind) => {
  const base = { fontFamily: "inherit", fontSize: 12, fontWeight: 600, height: 32, padding: "0 14px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, lineHeight: 1, boxSizing: "border-box" };
  if (kind === "approve") return { ...base, border: "1px solid var(--nv-ok-fill)", background: "var(--nv-ok-fill)", color: "var(--nv-btn-ink)" };
  if (kind === "ghost") return { ...base, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)" };
  if (kind === "reject") return { ...base, border: "1px solid var(--nv-bad-line)", background: "var(--nv-card)", color: "var(--nv-bad-ink)" };
  return { ...base, border: "1px solid var(--nv-btn-fill)", background: "var(--nv-btn-fill)", color: "var(--nv-btn-ink)" };
};
/** A settled decision on the row — quiet text in the same 32 px box as the buttons. */
const doneTag = (tone = "ok") => ({ display: "inline-flex", alignItems: "center", height: 32, padding: "0 12px", borderRadius: 8, boxSizing: "border-box", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", color: tone === "ok" ? "var(--nv-ok-ink)" : "var(--nv-ink)", background: tone === "ok" ? "var(--nv-ok-soft)" : "var(--nv-soft)", border: `1px solid ${tone === "ok" ? "var(--nv-ok-line)" : BORDER}` });
const MONO_INK = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", color: "var(--nv-ink)" };
/** Each queue row names its exception once — the title line; the chip carries the one colour. */
const QUEUE_TITLE = {
  manual: { ar: "طلب بصمة يدوية", en: "Manual punch request" },
  outside: { ar: "بصمة خارج نطاق الفرع", en: "Punch outside the station range" },
  missing: { ar: "حضور بلا انصراف", en: "Checked in, no checkout" },
  early: { ar: "خروج قبل نهاية الوردية", en: "Left before the shift ended" },
  late_return: { ar: "عودة متأخرة من الراحة", en: "Late return from break" },
};

export default function AttendanceDailyDashboard({ employees, currentUser, company, data, t, onQueueCount }) {
  const { lang } = useI18n();
  const { format } = useTimeFormat();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapRow, setMapRow] = useState(null);
  const [manualLoadingId, setManualLoadingId] = useState(null);
  const [checkoutEmployeeId, setCheckoutEmployeeId] = useState(null);
  // Model Art. 46 — «منعته المنشأة»: the manager names the company-side cause; the day stays paid.
  const [preventId, setPreventId] = useState(null);
  const [preventReason, setPreventReason] = useState("");
  const [preventError, setPreventError] = useState("");
  const [preventedNow, setPreventedNow] = useState({});
  const [checkoutReason, setCheckoutReason] = useState("");
  const [checkoutTime, setCheckoutTime] = useState("");
  // «اعتمد حضوراً» for someone with no punch: the time they arrived and why — never the click time.
  const [checkInFor, setCheckInFor] = useState(null); // { id, time, reason }
  // A pending «طلب بصمة يدوية»: approve at the asked time (editable) or refuse with a written reason.
  const [punchAsk, setPunchAsk] = useState(null); // { id, mode: "approve" | "reject", time, note }
  const [rowError, setRowError] = useState({}); // employeeId → message, shown on the row that failed
  const [teamFace, setTeamFace] = useState("all");
  const [queueFace, setQueueFace] = useState("all");
  const [checkoutError, setCheckoutError] = useState("");
  const [searchParams] = useSearchParams();
  const queueRef = useRef(null);

  const load = () => {
    const apply = (cloudRows) => {
      setRows(mergeAttendanceRows(cloudRows || [], listLocalTodayAttendance(company?.id, data)));
    };
    if (!employees.length) { apply([]); setLoading(false); return; }
    setLoading(true);
    return base44.functions.invoke("supabaseAttendance", { action: "listDaily", employeeIds: employees.map((e) => e.id) })
      .then((res) => apply(res?.data?.rows || []))
      .catch(() => apply([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const onUpdated = () => load();
    window.addEventListener("attendance-updated", onUpdated);
    return () => window.removeEventListener("attendance-updated", onUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees.map((e) => e.id).join(","), company?.id]);

  const isManager = currentUser?.id === data?.ownerId || ["station_manager", "ops_manager", "director"].includes(currentUser?.role);

  const applyLocalPunch = (employee, kind, reason, time) => {
    const result = recordManualAttendance(company.id, {
      employeeId: employee.id,
      kind,
      date: toRiyadhDateKey(),
      time,
      reason,
      by: currentUser?.name,
      stationId: employee.stationId,
    });
    if (!result.ok) {
      setRowError((prev) => ({ ...prev, [employee.id]: lang === "ar" ? result.reason : result.reasonEn }));
      return null;
    }
    return result.attendance;
  };

  const manualCheckIn = async (employee) => {
    const time = parsePunchClock(checkInFor?.time);
    const reason = String(checkInFor?.reason || "").trim();
    if (!time) { setRowError((prev) => ({ ...prev, [employee.id]: lang === "ar" ? "حدد وقت الحضور." : "Set the check-in time." })); return; }
    if (reason.length < 3) { setRowError((prev) => ({ ...prev, [employee.id]: lang === "ar" ? "اكتب سبب التسجيل اليدوي." : "Write why this manual record is needed." })); return; }
    setManualLoadingId(employee.id);
    setRowError((prev) => ({ ...prev, [employee.id]: "" }));
    const done = (attendance) => {
      setRows((prev) => [...prev.filter((row) => String(row.employee_id ?? row.employeeId) !== String(employee.id)), attendance]);
      setCheckInFor(null);
      window.dispatchEvent(new CustomEvent("attendance-updated", { detail: attendance }));
    };
    try {
      if (isLocalPreviewActive()) {
        const attendance = applyLocalPunch(employee, "in", reason, time);
        if (attendance) done(attendance);
        return;
      }
      const res = await base44.functions.invoke("supabaseAttendance", { action: "manualCheckIn", companyId: company.id, employeeId: employee.id, managerName: currentUser.name, time, reason });
      const attendance = res?.data?.attendance;
      if (attendance) done(attendance);
    } catch (error) {
      const code = error?.code || error?.response?.data?.error;
      if (!isAttendancePolicyError(code) && isServiceOutage(error)) {
        const attendance = applyLocalPunch(employee, "in", reason, time);
        if (attendance) { done(attendance); return; }
      }
      const payload = error?.response?.data || {};
      setRowError((prev) => ({ ...prev, [employee.id]: punchPolicyMessage(code, lang === "ar", "in") || (lang === "ar" ? payload.reason : payload.reasonEn) || payload.error || (lang === "ar" ? "تعذر تسجيل الحضور اليدوي." : "Could not record the manual check-in.") }));
    } finally {
      setManualLoadingId(null);
    }
  };

  /** Approve / refuse a pending «طلب بصمة يدوية» — closes the request, notifies the worker. */
  const decidePunchAsk = (employee, asked) => {
    const decision = punchAsk?.mode === "reject" ? "rejected" : "approved";
    const res = decideManualPunchRequest(company.id, employee.id, asked.id, {
      decision,
      time: punchAsk?.time,
      note: punchAsk?.note,
      by: currentUser?.name,
      byId: currentUser?.id,
    });
    if (!res?.ok) {
      setRowError((prev) => ({ ...prev, [employee.id]: (lang === "ar" ? res?.reason : res?.reasonEn) || res?.error || "" }));
      return;
    }
    setPunchAsk(null);
    setRowError((prev) => ({ ...prev, [employee.id]: "" }));
    load();
  };

  const manualCheckOut = async (employee) => {
    const reason = checkoutReason.trim();
    const time = parsePunchClock(checkoutTime);
    if (!time) {
      setCheckoutError(lang === "ar" ? "حدد وقت الانصراف." : "Set the checkout time.");
      return;
    }
    if (!reason) {
      setCheckoutError(lang === "ar" ? "سبب الإغلاق مطلوب." : "A reason is required.");
      return;
    }
    setCheckoutError("");
    setManualLoadingId(employee.id);
    try {
      if (isLocalPreviewActive()) {
        const attendance = applyLocalPunch(employee, "out", reason, time);
        if (attendance) {
          setRows((prev) => prev.map((row) => (String(row.employee_id ?? row.employeeId) === String(employee.id) ? attendance : row)));
          setCheckoutEmployeeId(null);
          setCheckoutReason("");
          window.dispatchEvent(new CustomEvent("attendance-updated", { detail: attendance }));
        } else {
          setCheckoutError(rowErrorFor(employee.id));
        }
        return;
      }
      const res = await base44.functions.invoke("supabaseAttendance", {
        action: "manualCheckOut", companyId: company.id, employeeId: employee.id, reason, time,
      });
      const attendance = res?.data?.attendance;
      if (attendance) {
        setRows((prev) => prev.map((row) => (String(row.employee_id ?? row.employeeId) === String(employee.id) ? attendance : row)));
        setCheckoutEmployeeId(null);
        setCheckoutReason("");
        window.dispatchEvent(new CustomEvent("attendance-updated", { detail: attendance }));
      }
    } catch (error) {
      const code = error?.code || error?.response?.data?.error;
      if (!isAttendancePolicyError(code) && isServiceOutage(error)) {
        const attendance = applyLocalPunch(employee, "out", reason, time);
        if (attendance) {
          setRows((prev) => prev.map((row) => (String(row.employee_id ?? row.employeeId) === String(employee.id) ? attendance : row)));
          setCheckoutEmployeeId(null);
          setCheckoutReason("");
          window.dispatchEvent(new CustomEvent("attendance-updated", { detail: attendance }));
          return;
        }
      }
      const payload = error?.response?.data || {};
      setCheckoutError(punchPolicyMessage(code, lang === "ar", "out") || (lang === "ar" ? payload.reason : payload.reasonEn) || payload.error || (lang === "ar" ? "تعذر إغلاق الحضور." : "Could not close attendance."));
    } finally {
      setManualLoadingId(null);
    }
  };

  const preventedToday = (employee) => {
    const day = toRiyadhDateKey();
    return !!preventedNow[employee.id] || (employee.otherRequests || []).some((row) => row?.type === PREVENTED_TYPE && row.status === "approved" && String(row.date || "").slice(0, 10) === day);
  };
  const recordPrevented = (employee) => {
    const day = toRiyadhDateKey();
    const gate = checkEmployerPreventedGate({ employee, actorId: currentUser?.id, date: day, reason: preventReason, today: day });
    if (!gate.ok) { setPreventError(lang === "ar" ? gate.reason : gate.reasonEn); return; }
    const res = submitOtherRequest(company.id, employee.id, {
      type: PREVENTED_TYPE,
      date: day,
      reason: preventReason.trim(),
      status: "approved",
      recordedBy: currentUser?.name || "",
      requestedBy: currentUser?.name || "",
      requestedById: currentUser?.id,
    });
    if (!res?.ok) { setPreventError(lang === "ar" ? res?.reason : res?.reasonEn); return; }
    setPreventedNow((prev) => ({ ...prev, [employee.id]: true }));
    setPreventId(null);
    setPreventReason("");
    setPreventError("");
  };

  const toggleExcuse = async (r) => {
    const employeeId = String(r.employee_id ?? r.employeeId);
    setRowError((prev) => ({ ...prev, [employeeId]: "" }));
    const local = () => {
      const res = excuseAttendanceLocal(company.id, employeeId, String(r.date || toRiyadhDateKey()).slice(0, 10), { excused: !r.excused, by: currentUser?.name, byId: currentUser?.id });
      if (!res.ok) { setRowError((prev) => ({ ...prev, [employeeId]: lang === "ar" ? res.reason : res.reasonEn })); return; }
      setRows((prev) => prev.map((x) => (String(x.employee_id ?? x.employeeId) === employeeId ? { ...x, ...res.attendance } : x)));
    };
    if (isLocalPreviewActive() || r.localPreview) { local(); return; }
    try {
      const res = await base44.functions.invoke("supabaseAttendance", {
        action: "excuseAttendance",
        userRole: currentUser?.role,
        attendanceId: r.id,
        managerId: currentUser?.id,
        managerName: currentUser?.name,
        excused: !r.excused,
      });
      const updated = res?.data?.attendance;
      if (updated) setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (error) {
      if (isServiceOutage(error)) { local(); return; }
      const payload = error?.response?.data || {};
      setRowError((prev) => ({ ...prev, [employeeId]: (lang === "ar" ? payload.reason : payload.reasonEn) || payload.error || (lang === "ar" ? "تعذّر حفظ الاعتماد." : "Could not save the approval.") }));
    }
  };

  const byEmployee = Object.fromEntries(rows.map((r) => [String(r.employee_id ?? r.employeeId), r]));
  // «راحة مرنة ببصمة» per person: the punched or assumed break, and what ran past its minutes.
  const breakDayOf = (employee) => queueBreakDayOf(employee, byEmployee[String(employee.id)], data);
  /** A closed over-long break with no decision yet — late return, not a legal breach. */
  const lateReturnOpen = (employee) => isLateReturnOpen(employee, byEmployee[String(employee.id)], data);
  const rowErrorFor = (id) => rowError[id] || "";
  const [reviewError, setReviewError] = useState("");
  const decideLateReturn = async (employee, decision) => {
    setReviewError("");
    const date = toRiyadhDateKey();
    const r = byEmployee[String(employee.id)];
    try {
      if (isLocalPreviewActive() || r?.localPreview) {
        const res = reviewLateReturn(company.id, employee.id, date, { decision, by: currentUser?.name, byId: currentUser?.id });
        if (!res.ok) { setReviewError(lang === "ar" ? res.reason : res.reasonEn); return; }
        load();
        return;
      }
      const res = await base44.functions.invoke("supabaseAttendance", { action: "reviewLateReturn", companyId: company.id, employeeId: employee.id, date, decision });
      const updated = res?.data?.attendance;
      if (updated) setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (error) {
      const payload = error?.response?.data || {};
      setReviewError((lang === "ar" ? payload.reason : payload.reasonEn) || payload.error || (lang === "ar" ? "تعذّر حفظ القرار." : "Could not save the decision."));
    }
  };
  const statusFor = (employee) => getAttendanceStatus(employee, byEmployee[String(employee.id)], data);
  // «بلا انصراف» only once the shift has actually ended (+1 h) — an open record mid-shift is normal.
  const isPastCheckoutMissing = (r, employee) => {
    const person = employee || employees.find((e) => String(e.id) === String(r?.employee_id ?? r?.employeeId));
    return pastCheckoutMissing(person, r, data);
  };
  // One reading (lib/attendanceQueue) for the queue, the team list and the section badge.
  const facesOf = (employee) => queueFacesOf(employee, byEmployee[String(employee.id)], data);
  const needsDecision = (employee) => facesOf(employee).length > 0;
  const todayAtt = deriveTeamAttendanceToday(employees, rows, data);
  const queue = employees.filter(needsDecision);
  const attentionCount = queue.length;
  const notYet = employees.filter((employee) => {
    const status = statusFor(employee);
    if (status !== "absent") return false;
    return !shiftWindowElapsed(getTodaysShift(data, employee));
  }).length;

  const ar = lang === "ar";
  /** Team rows speak the employee lane's words and colours (dutyStatus). */
  const TEAM_STATUS = { present: "present", late: "late", absent: "absent", on_leave: "leave", not_scheduled: "unscheduled" };
  // «الفريق اليوم» filters as in طلباتي: الكل, what waits on you, then each duty state; empty states hide.
  const teamFaceOf = (employee) => {
    if (needsDecision(employee)) return "decide";
    const status = statusFor(employee);
    if (status === "absent" && !shiftWindowElapsed(getTodaysShift(data, employee))) return "pending";
    return TEAM_STATUS[status] || "unscheduled";
  };
  const teamShown = teamFace === "all" ? employees : employees.filter((employee) => teamFaceOf(employee) === teamFace);
  const teamCount = (id) => employees.filter((employee) => teamFaceOf(employee) === id).length;
  // «بصمات اليوم بلا حكم» by the link that broke: range, missing checkout, early out, manual ask.
  // A row with several faces is listed under each matching pill; shown as the pill picked, else its first face.
  const queueFaceOf = (employee) => {
    const faces = facesOf(employee);
    return queueFace !== "all" && faces.includes(queueFace) ? queueFace : (faces[0] || "early");
  };
  const queueShown = queueFace === "all" ? queue : queue.filter((employee) => facesOf(employee).includes(queueFace));
  const queueCount = (id) => queue.filter((employee) => facesOf(employee).includes(id)).length;
  const panel = { background: CARD, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", minWidth: 0 };
  const headNote = { fontSize: 12, color: MUTED, lineHeight: 1.65 };
  const pill = (tone) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    height: 22,
    padding: "0 8px",
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: "nowrap",
    background: `var(--nv-${tone}-soft)`,
    color: `var(--nv-${tone}-ink)`,
    border: `1px solid var(--nv-${tone}-line)`,
  });

  useEffect(() => {
    onQueueCount?.(attentionCount);
  }, [attentionCount, onQueueCount]);

  // ?focus=queue (from «يحتاج قرارك» anywhere in the section) lands on the queue.
  useEffect(() => {
    if (loading || searchParams.get("focus") !== "queue") return;
    revealNode(queueRef.current, { block: "start" });
  }, [loading, searchParams]);

  const queueSub = attentionCount
    ? (lang === "ar"
      ? (attentionCount === 1 ? "صفٌّ واحد انكسرت فيه حلقة ولا يصحّ حكم النظام عليه — لا حاضراً بلا دليل، ولا غائباً وهو قد يكون في الموقع." : `${formatUiNumber(attentionCount)} صفوف انكسرت فيها حلقة واحدة ولا يصحّ حكم النظام عليها.`)
      : `${formatUiNumber(attentionCount)} row${attentionCount === 1 ? "" : "s"} broke a link — the system will not guess present or absent.`)
    : (lang === "ar" ? "ما ينكسر من حلقات اليوم يصل هنا، وكل قرار يُسجَّل باسمك." : "Today's broken links land here; every decision is recorded in your name.");
  const queueInsight = attentionCount
    ? (lang === "ar" ? "الطابور مقياس عمل لا مقياس أداء — يجب أن يصل صفراً كل يوم." : "The queue measures work, not performance — it should reach zero every day.")
    : (lang === "ar" ? "الطابور صفر — كل يوم أُغلق تلقائياً أو بقرار موقّع." : "Queue at zero — every day closed automatically or by a signed decision.");

  const tiles = (
    <FigureRow
      ar={ar}
      figures={[
        {
          key: "team-today",
          label: ar ? "الفريق اليوم" : "The team today",
          value: formatUiNumber(todayAtt.presentLike),
          suffix: ar ? `من ${formatUiNumber(todayAtt.scheduled)} مجدولين` : `of ${formatUiNumber(todayAtt.scheduled)} scheduled`,
          ...(todayAtt.scheduled && todayAtt.presentLike < todayAtt.scheduled ? { tone: "warn", flag: ar ? "لم يكتمل الحضور" : "Not all in yet" } : {}),
          hint: ar
            ? `في الوقت ${formatUiNumber(todayAtt.present)} · متأخر ${formatUiNumber(todayAtt.late)} · لم يُسجَّل ${formatUiNumber(notYet)}`
            : `On time ${formatUiNumber(todayAtt.present)} · late ${formatUiNumber(todayAtt.late)} · not yet ${formatUiNumber(notYet)}`,
        },
        {
          key: "absent",
          label: ar ? "غاب" : "Absent",
          value: formatUiNumber(teamCount("absent")),
          suffix: ar ? "موظف" : "people",
          ...(teamCount("absent") ? { tone: "bad", flag: ar ? "غياب دون إجازة" : "Absent, no leave" } : {}),
          hint: ar ? `إجازة ${formatUiNumber(todayAtt.onLeave)}` : `On leave ${formatUiNumber(todayAtt.onLeave)}`,
        },
      ]}
    />
  );

  /** A closed absence: approve the day present (with the real time and a reason) or record that the company kept them (Model Art. 46). */
  const absentActions = (e) => (
    <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "flex-start" }}>
      {preventedToday(e) ? (
        <span data-prevented="1" style={doneTag("mute")}>{ar ? "منعته المنشأة — أجره مستحق (النموذج الموحد م46)" : "Kept from work by the company — paid (Model Art. 46)"}</span>
      ) : preventId === e.id ? (
        <div style={{ minWidth: 200, padding: 8, border: `1px solid ${BORDER}`, background: SURFACE }}>
          <input
            value={preventReason}
            onChange={(ev) => { setPreventReason(ev.target.value); setPreventError(""); }}
            placeholder={ar ? "السبب الراجع إلى المنشأة (تعطل، إغلاق، لا عمل…)" : "Company-side cause (outage, closure, no work…)"}
            style={{ ...field, height: 30, fontSize: 11, marginBottom: 6 }}
            autoFocus
          />
          {preventError && <p style={{ fontSize: 10, color: DANGER, margin: "0 0 6px" }}>{preventError}</p>}
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" onClick={() => recordPrevented(e)} style={miniBtn("primary")}>{ar ? "سجّل" : "Record"}</button>
            <button type="button" onClick={() => { setPreventId(null); setPreventReason(""); setPreventError(""); }} style={miniBtn()}>{ar ? "إلغاء" : "Cancel"}</button>
          </div>
        </div>
      ) : (
        <button type="button" data-prevent-btn="1" onClick={() => { setPreventId(e.id); setPreventReason(""); setPreventError(""); }} style={actBtn("ghost")}>
          {ar ? "منعته المنشأة" : "Prevented by us"}
        </button>
      )}
      {preventedToday(e) ? null : (
        <CheckInForm
          ar={ar}
          state={checkInFor && checkInFor.id === e.id ? checkInFor : null}
          busy={manualLoadingId === e.id}
          onOpen={() => setCheckInFor({ id: e.id, time: getTodaysShift(data, e)?.start || riyadhNowClock(), reason: "" })}
          onChange={(patch) => setCheckInFor((cur) => ({ ...cur, ...patch }))}
          onCancel={() => setCheckInFor(null)}
          onConfirm={() => manualCheckIn(e)}
        />
      )}
    </span>
  );

  const teamList = !loading && employees.length > 0 ? (
    <div className="nv-list-stack" data-team-today>
      <StatusFilterPills
        card
        dataKey="att-team"
        title={ar ? "الفريق اليوم — بالاسم" : "The team today — by name"}
        note={ar
          ? `${formatUiNumber(todayAtt.scheduled)} مجدولون · نسبة التسجيل ${todayAtt.rate}%`
          : `${formatUiNumber(todayAtt.scheduled)} scheduled · ${todayAtt.rate}% logged`}
        value={teamFace}
        onChange={setTeamFace}
        hideZero
        items={[
          { id: "all", label: ar ? "الكل" : "All", n: formatUiNumber(employees.length) },
          { id: "decide", label: ar ? "بانتظار قرارك" : "Needs you", n: formatUiNumber(teamCount("decide")) },
          { id: "pending", label: dutyLabel("pending", ar), n: formatUiNumber(teamCount("pending")) },
          { id: "late", label: dutyLabel("late", ar), n: formatUiNumber(teamCount("late")) },
          { id: "absent", label: dutyLabel("absent", ar), n: formatUiNumber(teamCount("absent")) },
          { id: "present", label: dutyLabel("present", ar), n: formatUiNumber(teamCount("present")) },
          { id: "leave", label: dutyLabel("leave", ar), n: formatUiNumber(teamCount("leave")) },
          { id: "unscheduled", label: dutyLabel("unscheduled", ar), n: formatUiNumber(teamCount("unscheduled")) },
        ]}
      />
      <section className="nv-att-card" style={{ ...panel, borderRadius: 12, overflow: "hidden" }}>
      <div className="nv-att-team-list">
        {teamShown.map((employee) => {
          const row = byEmployee[String(employee.id)];
          const status = statusFor(employee);
          const shift = getTodaysShift(data, employee);
          const decide = needsDecision(employee);
          const notYetRow = status === "absent" && !shiftWindowElapsed(shift);
          const key = TEAM_STATUS[status] || "unscheduled";
          const label = decide
            ? (ar ? "بانتظار قرارك" : "Needs you")
            : notYetRow
              ? dutyLabel("pending", ar)
              : dutyLabel(key, ar);
          const chipStyle = decide ? dutyChip("alert") : notYetRow ? dutyChip("rest") : dutyChip(key);
          const self = String(employee.id) === String(currentUser?.id);
          const href = self ? "/app/calendar" : fileDutyHref(employee.id);
          return (
            <div key={employee.id} data-team-row={status} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 10, alignItems: "center", padding: "10px 18px", borderBottom: "1px solid var(--nv-line2, #EEF1EF)", borderInlineStart: "1px solid var(--nv-line2, #EEF1EF)", minWidth: 0 }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{employee.name}</span>
                <span style={{ fontSize: 11, color: MUTED, display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  {shift ? (
                    <span>{shift.label || (ar ? "وردية" : "Shift")} <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{shift.start}–{shift.end}</span></span>
                  ) : (
                    <span>{ar ? "بلا وردية اليوم" : "No shift today"}</span>
                  )}
                  {row?.check_in_at ? (
                    <span>· {ar ? "بصم" : "in"} <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{formatTime(row.check_in_at, format, "en-GB")}</span></span>
                  ) : null}
                </span>
                <BreakLine ar={ar} day={breakDayOf(employee)} />
              </span>
              <span style={{ ...chipStyle, height: 22, fontSize: 11 }}>{label}</span>
              {href ? (
                <Link to={href} data-team-open={employee.id} style={openLinkStyle()} title={self ? (ar ? "التقويم التشغيلي" : "Operations calendar") : (ar ? "ملف الدوام" : "Duty file")}>
                  {ar ? "افتح ›" : "Open ›"}
                </Link>
              ) : <span />}
              {isManager && !self && status === "absent" && !notYetRow && !decide ? (
                <div data-absent-actions="1" style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
                  {absentActions(employee)}
                  {rowErrorFor(employee.id) ? <span role="alert" style={{ fontSize: 11.5, color: DANGER, lineHeight: 1.6 }}>{rowErrorFor(employee.id)}</span> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      </section>
    </div>
  ) : null;

  const queuePanel = (
    <div ref={queueRef} id="nv-team-queue" className="nv-list-stack" data-decision-queue style={{ scrollMarginTop: 88 }}>
      <StatusFilterPills
        card
        dataKey="att-queue"
        title={lang === "ar" ? "بصمات اليوم بلا حكم" : "Today's punches without a verdict"}
        value={queueFace}
        onChange={setQueueFace}
        hideZero
        trailing={(
          <span style={pill(attentionCount ? "warn" : "ok")}>
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{formatUiNumber(attentionCount)}</span>
            {lang === "ar" ? "في الطابور" : "in queue"}
          </span>
        )}
        items={queue.length === 0 ? [] : [
          { id: "all", label: ar ? "الكل" : "All", n: formatUiNumber(queue.length) },
          { id: "manual", label: ar ? "بصمة يدوية" : "Manual punch", n: formatUiNumber(queueCount("manual")) },
          { id: "outside", label: ar ? "خارج النطاق" : "Outside range", n: formatUiNumber(queueCount("outside")) },
          { id: "missing", label: ar ? "بلا انصراف" : "No checkout", n: formatUiNumber(queueCount("missing")) },
          { id: "early", label: ar ? "خروج مبكر" : "Early out", n: formatUiNumber(queueCount("early")) },
          { id: "late_return", label: ar ? "عودة متأخرة" : "Late return", n: formatUiNumber(queueCount("late_return")) },
        ]}
      >
        <span style={headNote}>{queueSub}</span>
      </StatusFilterPills>

      {loading || employees.length === 0 || queue.length === 0 ? (
      <section className="nv-att-card" style={{ ...panel, borderRadius: 12, overflow: "hidden" }}>
      {loading ? (
        <div style={{ padding: "24px 20px", textAlign: "center", fontSize: 12, color: MUTED }}>…</div>
      ) : employees.length === 0 ? (
        <div style={{ ...emptyState, margin: 16 }}>{t("noAttendanceRecords")}</div>
      ) : queue.length === 0 ? (
        <div data-queue-empty style={{ padding: "22px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <span aria-hidden style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--nv-ok-soft)", border: "1px solid var(--nv-ok-line)", color: "var(--nv-ok-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}><NvIcon name="check" size={16} strokeWidth={2} inline={false} /></span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ok-ink)" }}>{lang === "ar" ? "الطابور صفر" : "Queue at zero"}</span>
            <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>{lang === "ar" ? "كل يوم أُغلق تلقائياً أو بقرار موقّع." : "Every day closed automatically or by a signed decision."}</span>
          </span>
        </div>
      ) : null}
      </section>
      ) : (
      // One white card per row (hairline, radius 8) — the طلباتي / صوت الموظف row, not a tinted band.
      <div className="nv-att-queue-rows" data-queue-rows="1">
        {queueShown.map((e) => {
          const r = byEmployee[String(e.id)];
          const status = statusFor(e);
          const scheduled = isScheduledToday(e, data) || status === "present" || status === "late" || status === "absent";
          const punched = !!r?.check_in_at;
          const geofence = r?.location_status === "outside" ? "outside" : r?.location_status === "inside" ? "inside" : "none";
          const register = r?.check_out_at ? "closed" : (status === "absent" || status === "not_scheduled" ? "missing" : punched ? "open" : "wait");
          const rings = buildAttendanceRings({ ar: lang === "ar", scheduled, punched, geofence, register, onLeave: status === "on_leave" });
          const breakDay = breakDayOf(e);
          const lateReturn = lateReturnOpen(e);
          const flagKey = r?.location_status === "outside"
            ? "outside"
            : r?.early_checkout
              ? "early"
              : isPastCheckoutMissing(r, e)
                ? "missing"
                : lateReturn
                  ? "late_return"
                  : FLAG[status]
                    ? status
                    : "present";
          const flag = FLAG[flagKey] || FLAG.present;
          const punchTime = r?.check_in_at ? formatTime(r.check_in_at, format, "en-GB") : "—";
          const asked = pendingManualPunch(e);
          const reason = asked
            ? asked.reason
            : r?.location_status === "outside"
            ? (lang === "ar" ? "نقطة التسجيل خارج نطاق الفرع. راجع الموقع إن لزم." : "The punch point is outside the station range.")
            : status === "late" && Number(r?.late_minutes) > 0
              ? `${t("lateBy")} ${formatUiNumber(r.late_minutes)} ${t("minutesUnit")}`
              : status === "absent"
                ? (lang === "ar" ? "مجدول اليوم ولم يسجّل بعد." : "Scheduled today and has not punched yet.")
                : status === "not_scheduled"
                  ? (lang === "ar" ? "غير مدرج في جدول اليوم." : "Not on today's rota.")
                  : isPastCheckoutMissing(r, e)
                    ? (lang === "ar" ? "حضور بلا انصراف." : "Checked in with no checkout.")
                    : r?.early_checkout
                      ? t("earlyCheckoutLabel")
                      : lateReturn
                        ? (lang === "ar"
                          ? `أطال راحته ${minutesAr(breakDay.overMinutes)} فوق ${minutesAr(breakDay.flex.minutes)} المسموحة — عودة متأخرة، لا مخالفة نظامية.`
                          : `The break ran ${breakDay.overMinutes} min past the allowed ${breakDay.flex.minutes} — a late return, not a legal breach.`)
                        : (lang === "ar" ? "السلسلة مكتملة." : "The chain is complete.");
          const attention = needsDecision(e);
          // A late return names itself — it is not a broken link nor a legal breach.
          const broke = attention && flagKey !== "late_return" ? brokeAtLabel(lang === "ar", rings) : "";
          const kind = queueFaceOf(e);
          const titleText = kind === "late_return"
            ? (ar ? QUEUE_TITLE.late_return.ar : QUEUE_TITLE.late_return.en)
            : (QUEUE_TITLE[kind] ? (ar ? QUEUE_TITLE[kind].ar : QUEUE_TITLE[kind].en) : (broke || (ar ? flag.ar : flag.en)));
          // One chip — the row's only colour: warn for a decision, bad for a broken range.
          const chipTone = kind === "outside" ? "bad" : "warn";
          const chipText = kind === "late_return"
            ? (ar ? `عودة متأخرة ${formatUiNumber(breakDay.overMinutes)} د` : `Late return ${breakDay.overMinutes} min`)
            : kind === "manual"
              ? (ar ? "بانتظار قرارك" : "Needs you")
              : kind === "outside" && r?.distance_meters != null
                ? `${ar ? flag.ar : flag.en} · ${formatUiNumber(r.distance_meters)} ${ar ? "م" : "m"}`
                : (ar ? flag.ar : flag.en);
          const shiftNow = getTodaysShift(data, e);
          const lateRule = kind === "late_return" ? citeRule("hours.rest.duringShiftMinutes", toRiyadhDateKey()) : null;
          const lateBreak = kind === "late_return" ? (breakDay.punched.filter((row) => !row.open).pop() || breakDay.rows[breakDay.rows.length - 1] || null) : null;
          // The muted note: where the chain broke and why — never a repeat of the title or the chip.
          const bare = (text) => String(text || "").trim().replace(/[.。]$/, "");
          const noteText = [broke, kind === "early" ? "" : reason]
            .map(bare)
            .filter((text, i, list) => text && text !== bare(titleText) && text !== bare(chipText) && list.indexOf(text) === i)
            .join(" — ");
          const dot = <span aria-hidden style={{ color: "var(--nv-muted)" }}>{" · "}</span>;
          return (
            <div key={e.id} className="nv-att-decision-row" data-queue-row={kind}>
              <span data-queue-main="1" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexWrap: "wrap" }}>
                <EmployeeIdentityRow employee={e} employeeId={e.id} name={e.name} showId={false} compact />
                {r?.check_in_at ? <span dir="ltr" style={{ ...MONO_INK, fontSize: 11.5, color: MUTED }}>{punchTime}</span> : null}
                <span style={{ flex: "1 1 auto" }} />
                <span data-queue-chip={kind} style={{ ...pill(chipTone), height: 22, borderRadius: 999 }}>{chipText}</span>
              </span>
              <div className="nv-att-decision-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <span data-queue-title="1" style={{ fontSize: 13, fontWeight: 600, color: "var(--nv-ink)", lineHeight: 1.5 }}>{titleText}</span>
                {kind === "late_return" && lateBreak ? (
                  <span data-queue-facts="1" style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
                    {ar ? "راحة " : "Break "}<span dir="ltr" style={MONO_INK}>{lateBreak.start}–{lateBreak.end || "…"}</span>
                    {dot}{ar ? "ببصمة" : "punched"}
                    {dot}{ar ? "المسموح " : "allowed "}<span dir="ltr" style={MONO_INK}>{formatUiNumber(breakDay.flex.minutes)}</span>{ar ? " د" : " min"}
                  </span>
                ) : (
                  <span data-queue-facts="1" style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
                    {shiftNow ? (
                      <>{ar ? "وردية " : "Shift "}<span dir="ltr" style={MONO_INK}>{shiftNow.start}–{shiftNow.end}</span></>
                    ) : (ar ? "بلا وردية اليوم" : "No shift today")}
                    {r?.check_in_at ? <>{dot}{ar ? "حضور " : "in "}<span dir="ltr" style={MONO_INK}>{punchTime}</span></> : null}
                    {r?.check_out_at ? <>{dot}{ar ? "انصراف " : "out "}<span dir="ltr" style={MONO_INK}>{formatTime(r.check_out_at, format, "en-GB")}</span></> : null}
                  </span>
                )}
                {kind === "late_return" ? (
                  <span data-queue-rule="1" style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
                    {ar
                      ? `عودة متأخرة — لا مخالفة نظامية (${lateRule?.labelAr || "المادة 101"})`
                      : `Late return — not a legal breach (${lateRule?.labelEn || "Art. 101"})`}
                  </span>
                ) : (
                  <>
                    {noteText ? <span data-queue-note="1" style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>{noteText}</span> : null}
                    <AttendanceChainProgress rings={rings} />
                    <BreakLine ar={ar} day={breakDay} />
                  </>
                )}
                {status === "late" && Number(r?.late_minutes) > 0 && !asked ? (
                  <RightHint ar={ar} style={{ alignSelf: "flex-start" }} hint={attRightHint("lateness", { date: String(r.check_in_at || "").slice(0, 10), minutes: Number(r.late_minutes) }, { view: "manager", ar, employee: e })} />
                ) : null}
                <span data-queue-links="1" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <Link to={fileDutyHref(e.id)} style={openLinkStyle()}>{lang === "ar" ? "ملف الدوام ›" : "Duty file ›"}</Link>
                  <Link to={rosterPersonHref(e.id)} style={openLinkStyle()}>{lang === "ar" ? "في جدول الدوام ›" : "On the roster ›"}</Link>
                </span>
                {rowErrorFor(e.id) ? <span role="alert" data-row-error="1" style={{ fontSize: 11.5, color: DANGER, lineHeight: 1.6 }}>{rowErrorFor(e.id)}</span> : null}
                {r?.location_status === "outside" ? (
                  <button type="button" onClick={() => setMapRow(r)} style={{ ...miniBtn(), alignSelf: "start" }}>
                    <MapPin style={{ width: 11, height: 11, display: "inline", verticalAlign: "middle", marginInlineEnd: 4 }} />
                    {t("viewOnMap")}
                    {r.distance_meters != null ? ` · ${formatUiNumber(r.distance_meters)}m` : ""}
                  </button>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {isManager && lateReturn && String(e.id) !== String(currentUser?.id) ? (
                  <span data-late-return-actions="1" style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => decideLateReturn(e, "excused")} style={actBtn("approve")}>{lang === "ar" ? "يُعذر" : "Excuse"}</button>
                    <button type="button" onClick={() => decideLateReturn(e, "late")} style={actBtn("ghost")}>{lang === "ar" ? "تُسجَّل عودة متأخرة" : "Record late return"}</button>
                  </span>
                ) : null}
                {status === "absent" && preventedToday(e) ? (
                  <span data-prevented="1" style={doneTag("mute")}>
                    {lang === "ar" ? "منعته المنشأة — أجره مستحق (النموذج الموحد م46)" : "Kept from work by the company — paid (Model Art. 46)"}
                  </span>
                ) : isManager && status === "absent" && String(e.id) !== String(currentUser?.id) ? (
                  preventId === e.id ? (
                    <div style={{ minWidth: 200, padding: 8, border: `1px solid ${BORDER}`, background: SURFACE }}>
                      <input
                        value={preventReason}
                        onChange={(ev) => { setPreventReason(ev.target.value); setPreventError(""); }}
                        placeholder={lang === "ar" ? "السبب الراجع إلى المنشأة (تعطل، إغلاق، لا عمل…)" : "Company-side cause (outage, closure, no work…)"}
                        style={{ ...field, height: 30, fontSize: 11, marginBottom: 6 }}
                        autoFocus
                      />
                      {preventError && <p style={{ fontSize: 10, color: DANGER, margin: "0 0 6px" }}>{preventError}</p>}
                      <div style={{ display: "flex", gap: 4 }}>
                        <button type="button" onClick={() => recordPrevented(e)} style={miniBtn("primary")}>{lang === "ar" ? "سجّل" : "Record"}</button>
                        <button type="button" onClick={() => { setPreventId(null); setPreventReason(""); setPreventError(""); }} style={miniBtn()}>{lang === "ar" ? "إلغاء" : "Cancel"}</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" data-prevent-btn="1" onClick={() => { setPreventId(e.id); setPreventReason(""); setPreventError(""); }} style={actBtn("ghost")} title={lang === "ar" ? "حاضر مستعد ومنعه سبب راجع إلى المنشأة — يُستحق أجره ولا يُحتسب غياباً" : "Ready but kept from work by the company — paid, not absence"}>
                      {lang === "ar" ? "منعته المنشأة" : "Prevented by us"}
                    </button>
                  )
                ) : null}
                {isManager && isPastCheckoutMissing(r, e) && (
                  checkoutEmployeeId === e.id ? (
                    <div style={{ minWidth: 180, padding: 8, border: `1px solid ${BORDER}`, background: SURFACE }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED, marginBottom: 6 }}>
                        {lang === "ar" ? "وقت الانصراف" : "Checkout time"}
                        <input
                          type="time"
                          data-checkout-time="1"
                          value={checkoutTime}
                          max={riyadhNowClock()}
                          onChange={(ev) => { setCheckoutTime(ev.target.value); setCheckoutError(""); }}
                          style={{ ...field, height: 30, fontSize: 11, width: 110, fontFamily: "'IBM Plex Mono', monospace" }}
                          dir="ltr"
                        />
                      </label>
                      <input
                        value={checkoutReason}
                        onChange={(ev) => { setCheckoutReason(ev.target.value); setCheckoutError(""); }}
                        placeholder={lang === "ar" ? "سبب الإغلاق" : "Reason for closing"}
                        style={{ ...field, height: 30, fontSize: 11, marginBottom: 6 }}
                        autoFocus
                      />
                      {checkoutError && <p style={{ fontSize: 10, color: DANGER, margin: "0 0 6px" }}>{checkoutError}</p>}
                      <div style={{ display: "flex", gap: 4 }}>
                        <button type="button" onClick={() => manualCheckOut(e)} disabled={manualLoadingId === e.id} style={miniBtn("primary")}>
                          {manualLoadingId === e.id && <Loader2 style={{ width: 10, height: 10, display: "inline", animation: "spin 1s linear infinite" }} />}
                          {lang === "ar" ? "حفظ" : "Save"}
                        </button>
                        <button type="button" onClick={() => { setCheckoutEmployeeId(null); setCheckoutReason(""); setCheckoutError(""); }} style={miniBtn()}>
                          {lang === "ar" ? "إلغاء" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setCheckoutEmployeeId(e.id); setCheckoutReason(""); setCheckoutTime(defaultManualCheckoutClock(getTodaysShift(data, e))); setCheckoutError(""); }} style={actBtn("navy")}>
                      {lang === "ar" ? "ثبّت الانصراف" : "Set checkout"}
                    </button>
                  )
                )}
                {kind === "manual" && asked && isManager && String(e.id) !== String(currentUser?.id) ? (
                  <PunchAskActions
                    ar={ar}
                    asked={asked}
                    state={punchAsk && punchAsk.id === asked.id ? punchAsk : null}
                    onOpen={(mode) => setPunchAsk({ id: asked.id, mode, time: parsePunchClock(asked.time) || clockFromPunchReason(asked.reason) || "", note: "" })}
                    onChange={(patch) => setPunchAsk((cur) => ({ ...cur, ...patch }))}
                    onCancel={() => setPunchAsk(null)}
                    onConfirm={() => decidePunchAsk(e, asked)}
                  />
                ) : (r?.manual_override || r?.location_status === "manual") ? (
                  <span style={doneTag("ok")}>
                    {lang === "ar" ? "اعتُمد حضوراً" : "Approved present"} · {r.override_by || r.excused_by_name || "—"}
                  </span>
                ) : isManager && !r?.check_in_at && status !== "on_leave" && status !== "not_scheduled" && String(e.id) !== String(currentUser?.id) ? (
                  <CheckInForm
                    ar={ar}
                    state={checkInFor && checkInFor.id === e.id ? checkInFor : null}
                    busy={manualLoadingId === e.id}
                    onOpen={() => setCheckInFor({ id: e.id, time: getTodaysShift(data, e)?.start && getTodaysShift(data, e).start < riyadhNowClock() ? getTodaysShift(data, e).start : riyadhNowClock(), reason: "" })}
                    onChange={(patch) => setCheckInFor((cur) => ({ ...cur, ...patch }))}
                    onCancel={() => setCheckInFor(null)}
                    onConfirm={() => manualCheckIn(e)}
                  />
                ) : isManager && (status === "late" || r?.location_status === "outside") && r?.id && !r?.excused ? (
                  <button type="button" onClick={() => toggleExcuse(r)} style={actBtn("approve")}>
                    {lang === "ar" ? "اعتمد حضوراً" : "Approve present"}
                  </button>
                ) : r?.excused ? (
                  <span style={doneTag("ok")}>
                    {lang === "ar" ? "اعتُمد حضوراً" : "Approved present"}{r.excused_by_name ? ` · ${r.excused_by_name}` : ""}
                  </span>
                ) : null}
              </div>
              </div>
            </div>
          );
        })}
        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85, padding: "2px 4px" }}>{queueInsight}</span>
      </div>
      )}
      {mapRow && <LocationMapModal row={mapRow} t={t} onClose={() => setMapRow(null)} />}
    </div>
  );

  // «سجل التدقيق» — every decision today, in the name of whoever made it: manual check-in / checkout,
  // approvals of a late or out-of-range punch, late-return reviews, and decided manual-punch requests.
  const nameOf = (id) => employees.find((emp) => String(emp.id) === String(id))?.name || "";
  const hm = (iso) => (iso ? formatTime(iso, format, "en-GB") : "—");
  const today = toRiyadhDateKey();
  const audit = [];
  for (const row of rows) {
    const who = nameOf(row.employee_id ?? row.employeeId);
    const note = String(row.excused_note || "").trim();
    if (row.manual_override && row.override_by) {
      if (row.check_out_at && /manual/.test(String(row.location_status || ""))) {
        audit.push({ id: `${row.id}-out`, text: ar ? `${row.override_by} سجّل حضور ${who} يدوياً${note ? ` — ${note}` : ""}` : `${row.override_by} recorded ${who}'s attendance by hand${note ? ` — ${note}` : ""}`, time: `${hm(row.check_in_at)}–${hm(row.check_out_at)}`, dot: "var(--nv-ok-ink)" });
      } else {
        audit.push({ id: `${row.id}-in`, text: ar ? `${row.override_by} اعتمد حضور ${who}${note ? ` — ${note}` : ""}` : `${row.override_by} approved ${who} present${note ? ` — ${note}` : ""}`, time: hm(row.check_in_at), dot: "var(--nv-ok-ink)" });
      }
    }
    if (row.excused) {
      const by = row.excused_by_name || (ar ? "المدير" : "Manager");
      audit.push({ id: `${row.id}-ex`, text: ar ? `${by} اعتمد حضور ${who} رغم التأخر أو النطاق` : `${by} approved ${who} despite lateness or range`, time: hm(row.excused_at || row.check_in_at), dot: "var(--nv-warn-fill)" });
    }
    for (const [i, brk] of (Array.isArray(row.breaks) ? row.breaks : []).entries()) {
      if (!brk?.review) continue;
      const by = brk.review.by || (ar ? "المدير" : "Manager");
      audit.push({ id: `${row.id}-brk-${i}`, text: brk.review.decision === "excused" ? (ar ? `${by} عذر ${who} في إطالة الراحة` : `${by} excused ${who}'s long break`) : (ar ? `${by} سجّل عودة ${who} من الراحة متأخرة` : `${by} recorded ${who}'s late return`), time: hm(brk.review.at), dot: "var(--nv-warn-fill)" });
    }
  }
  for (const emp of employees) {
    for (const req of emp.otherRequests || []) {
      if (req.type !== "manual_punch" && req.type !== "checkout_fix") continue;
      if (!["approved", "rejected"].includes(req.status) || String(req.reviewedAt || "").slice(0, 10) !== today) continue;
      if (req.status === "approved") continue; // the approved one is already the row's manual stamp above
      audit.push({ id: `req-${req.id}`, text: ar ? `${req.reviewedBy || "المدير"} رفض طلب بصمة ${emp.name}${req.rejectReason ? ` — ${req.rejectReason}` : ""}` : `${req.reviewedBy || "Manager"} refused ${emp.name}'s punch request${req.rejectReason ? ` — ${req.rejectReason}` : ""}`, time: hm(req.reviewedAt), dot: "var(--nv-bad-ink)" });
    }
  }
  // Reference, not a task — folded under the work.
  const auditPanel = !loading ? (
    <section className="nv-att-card" data-audit style={{ ...panel, overflow: "hidden" }}>
      <Collapsible
        dataAttr="audit"
        title={lang === "ar" ? "سجل التدقيق" : "Audit trail"}
        note={lang === "ar" ? "قرارات اليوم باسم من قرّرها." : "Today's decisions, in the name of whoever made them."}
        trailing={(
          <span style={pill("mute")}>
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{formatUiNumber(audit.length)}</span>
            {lang === "ar" ? "قرار" : "decisions"}
          </span>
        )}
      >
        {audit.length === 0 ? (
          <div style={{ padding: "4px 18px 12px" }}>
            <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>{lang === "ar" ? "لا قرار بعد. كل اعتماد أو إعفاء يظهر هنا." : "No decision yet. Each approval or excuse appears here."}</span>
          </div>
        ) : audit.map((item) => (
          <div key={item.id} style={{ padding: "11px 18px", borderBottom: "1px solid var(--nv-line2, #EEF1EF)", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 12, alignItems: "baseline" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.dot }} />
            <span style={{ fontSize: 12, color: "var(--nv-ink)", lineHeight: 1.8, minWidth: 0 }}>{item.text}</span>
            <span style={{ whiteSpace: "nowrap" }}><span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: MUTED }}>{item.time}</span></span>
          </div>
        ))}
      </Collapsible>
    </section>
  ) : null;

  return (
    <>
      {checkoutError || reviewError ? (
        <div style={{ border: "1px solid var(--nv-bad-line)", background: "var(--nv-bad-soft)", padding: "10px 14px", fontSize: 12, color: DANGER, lineHeight: 1.7, borderRadius: 10 }}>
          {checkoutError || reviewError}
        </div>
      ) : null}
      {tiles}
      <DutyBoard
        main={(
          <>
            {queuePanel}
            {teamList}
            {auditPanel}
          </>
        )}
        side={(
          <ManageDutySideAuto
            ar={ar}
            queueCount={loading ? undefined : attentionCount}
            hideQueue
          />
        )}
      />
    </>
  );
}
/**
 * One quiet line per person on a flex shift: «راحة 12:05–13:02 · ببصمة» / «مفترضة». A chip only for a
 * real problem: a break past its minutes (late return) or one under the statutory minimum (short).
 */
export function BreakLine({ ar, day }) {
  if (!day?.flex) return null;
  const mono = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", color: "var(--nv-ink2)" };
  const review = day.punched.map((row) => row.review).filter(Boolean).pop() || null;
  const chipStyle = { display: "inline-flex", alignItems: "center", height: 20, padding: "0 7px", borderRadius: 7, fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap", background: "var(--nv-warn-soft)", color: "var(--nv-warn-ink)", border: "1px solid var(--nv-warn-line)" };
  if (!day.rows.length) return null;
  return (
    <span data-break-line={day.assumed ? "assumed" : day.open ? "open" : "punch"} style={{ fontSize: 11, color: MUTED, display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
      {day.open && !day.punched.some((row) => !row.open) ? (
        <span>{ar ? "في الراحة منذ " : "On break since "}<span dir="ltr" style={mono}>{day.open.start}</span></span>
      ) : (
        <span>
          {ar ? "راحة " : "Break "}
          {day.rows.map((row, i) => (
            <React.Fragment key={`${row.start}-${i}`}>
              {i ? " · " : ""}
              <span dir="ltr" style={mono}>{row.start}–{row.open ? "…" : row.end}</span>
            </React.Fragment>
          ))}
          {" · "}
          {day.assumed ? (ar ? "مفترضة" : "assumed") : (ar ? "ببصمة" : "punched")}
        </span>
      )}
      {day.overMinutes > 0 && !review ? (
        <span data-break-chip="late_return" style={chipStyle}>{ar ? `عودة متأخرة ${minutesAr(day.overMinutes)}` : `Late return ${day.overMinutes} min`}</span>
      ) : null}
      {day.shortCount > 0 ? <span data-break-chip="short" style={chipStyle}>{ar ? "راحة قصيرة" : "Short break"}</span> : null}
      {review ? (
        <span data-break-review={review.decision}>
          {review.decision === "excused" ? (ar ? `· عُذر — ${review.by || ""}` : `· excused — ${review.by || ""}`) : (ar ? `· سُجّلت عودة متأخرة — ${review.by || ""}` : `· late return recorded — ${review.by || ""}`)}
        </span>
      ) : null}
    </span>
  );
}

const formBox = { minWidth: 220, padding: 8, border: `1px solid ${BORDER}`, background: SURFACE, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 };
const timeField = { ...field, height: 30, fontSize: 11, width: 110, fontFamily: "'IBM Plex Mono', monospace" };

/** «اعتمد حضوراً» for someone with no punch — the time they arrived (never after now) and why. */
function CheckInForm({ ar, state, busy, onOpen, onChange, onCancel, onConfirm }) {
  if (!state) {
    return (
      <button type="button" data-checkin-open="1" onClick={onOpen} style={actBtn("approve")}>
        {ar ? "اعتمد حضوراً" : "Approve present"}
      </button>
    );
  }
  return (
    <div data-checkin-form="1" style={formBox}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
        {ar ? "وقت الحضور" : "Check-in time"}
        <input type="time" data-checkin-time="1" value={state.time || ""} max={riyadhNowClock()} onChange={(ev) => onChange({ time: ev.target.value })} style={timeField} dir="ltr" />
      </label>
      <input
        value={state.reason || ""}
        data-checkin-reason="1"
        onChange={(ev) => onChange({ reason: ev.target.value })}
        placeholder={ar ? "السبب (بصمة معطلة، مهمة خارجية…)" : "Reason (device down, field errand…)"}
        style={{ ...field, height: 30, fontSize: 11 }}
        autoFocus
      />
      <div style={{ display: "flex", gap: 4 }}>
        <button type="button" data-checkin-save="1" onClick={onConfirm} disabled={busy} style={miniBtn("primary")}>
          {busy ? <Loader2 style={{ width: 10, height: 10, display: "inline", animation: "spin 1s linear infinite" }} /> : null}
          {ar ? "اعتمد" : "Approve"}
        </button>
        <button type="button" onClick={onCancel} style={miniBtn()}>{ar ? "إلغاء" : "Cancel"}</button>
      </div>
    </div>
  );
}

/** A pending «طلب بصمة يدوية»: approve at the time asked (editable) or refuse with a written reason. */
function PunchAskActions({ ar, asked, state, onOpen, onChange, onCancel, onConfirm }) {
  const askedClock = parsePunchClock(asked?.time) || clockFromPunchReason(asked?.reason) || "";
  const out = asked?.type === "checkout_fix";
  if (!state) {
    return (
      <span data-punch-ask-actions="1" style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button type="button" data-punch-ask="approve" onClick={() => onOpen("approve")} style={actBtn("approve")}>
          {ar ? (askedClock ? `اعتمد ${out ? "الانصراف" : "الحضور"} ${askedClock}` : "اعتمد") : (askedClock ? `Approve ${askedClock}` : "Approve")}
        </button>
        <button type="button" data-punch-ask="reject" onClick={() => onOpen("reject")} style={actBtn("reject")}>{ar ? "ارفض" : "Refuse"}</button>
      </span>
    );
  }
  const rejecting = state.mode === "reject";
  return (
    <div data-punch-ask-form={state.mode} style={formBox}>
      {rejecting ? (
        <input
          value={state.note || ""}
          data-punch-ask-note="1"
          onChange={(ev) => onChange({ note: ev.target.value })}
          placeholder={ar ? "سبب الرفض — يصل للموظف" : "Why — the worker receives it"}
          style={{ ...field, height: 30, fontSize: 11 }}
          autoFocus
        />
      ) : (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
          {out ? (ar ? "وقت الانصراف" : "Checkout time") : (ar ? "وقت الحضور" : "Check-in time")}
          <input type="time" data-punch-ask-time="1" value={state.time || ""} max={riyadhNowClock()} onChange={(ev) => onChange({ time: ev.target.value })} style={timeField} dir="ltr" />
          {askedClock && state.time && state.time !== askedClock ? <span style={{ fontSize: 10.5 }}>{ar ? `طلب ${askedClock}` : `asked ${askedClock}`}</span> : null}
        </label>
      )}
      <div style={{ display: "flex", gap: 4 }}>
        <button type="button" data-punch-ask-save="1" onClick={onConfirm} style={miniBtn(rejecting ? "ghost" : "primary")}>
          {rejecting ? (ar ? "أرسل الرفض" : "Send refusal") : (ar ? "اعتمد" : "Approve")}
        </button>
        <button type="button" onClick={onCancel} style={miniBtn()}>{ar ? "إلغاء" : "Cancel"}</button>
      </div>
    </div>
  );
}
