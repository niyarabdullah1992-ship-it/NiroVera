import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, MapPin } from "lucide-react";
import LocationMapModal from "@/components/attendance/LocationMapModal";
import { useI18n } from "@/lib/i18n";
import { formatTime, useTimeFormat } from "@/hooks/useTimeFormat";
import { deriveTeamAttendanceToday, getAttendanceStatus, getTodaysShift, isAttendancePolicyError, isScheduledToday } from "@/lib/attendance";
import { isServiceOutage } from "@/lib/serviceErrors";
import { hmToMinutes, todaysShiftEnded } from "@/lib/attendanceDerivations";
import { isExcusedEarlyCheckout } from "@/lib/dutyRequests";
import { listLocalTodayAttendance, mergeAttendanceRows } from "@/lib/localAttendanceFallback";
import { recordManualAttendance, submitOtherRequest } from "@/lib/store";
import { PREVENTED_TYPE, checkEmployerPreventedGate } from "@/lib/modelRequests";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import EmployeeIdentityRow from "@/components/employees/EmployeeIdentityRow";
import { AttendanceRingChips, brokeAtLabel, buildAttendanceRings } from "@/components/attendance/AttendanceTrustChrome";
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
  borderRadius: 10,
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

const actBtn = (kind) => {
  if (kind === "approve") {
    return { fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 13px", border: "none", borderRadius: 10, background: "var(--nv-ok-fill)", color: "var(--nv-btn-ink)", cursor: "pointer", whiteSpace: "nowrap" };
  }
  if (kind === "reject") {
    return { fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 13px", border: "1px solid var(--nv-bad-line)", borderRadius: 10, background: "var(--nv-card)", color: "var(--nv-bad-ink)", cursor: "pointer", whiteSpace: "nowrap" };
  }
  return { fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 13px", border: "none", borderRadius: 10, background: "var(--nv-btn-fill)", color: "var(--nv-btn-ink)", cursor: "pointer", whiteSpace: "nowrap" };
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

  const applyLocalPunch = (employee, kind, reason) => {
    const result = recordManualAttendance(company.id, {
      employeeId: employee.id,
      kind,
      date: toRiyadhDateKey(),
      reason: reason || (kind === "out" ? "manager checkout" : "manager check-in"),
      by: currentUser?.name,
      stationId: employee.stationId,
    });
    if (!result.ok) {
      setCheckoutError(lang === "ar" ? result.reason : result.reasonEn);
      return null;
    }
    return result.attendance;
  };

  const manualCheckIn = async (employee) => {
    setManualLoadingId(employee.id);
    setCheckoutError("");
    try {
      if (isLocalPreviewActive()) {
        const attendance = applyLocalPunch(employee, "in", "اعتمد حضوراً من لوحة اليوم");
        if (attendance) {
          setRows((prev) => [...prev.filter((row) => String(row.employee_id ?? row.employeeId) !== String(employee.id)), attendance]);
          window.dispatchEvent(new CustomEvent("attendance-updated", { detail: attendance }));
        }
        return;
      }
      const res = await base44.functions.invoke("supabaseAttendance", { action: "manualCheckIn", companyId: company.id, employeeId: employee.id, managerName: currentUser.name });
      const attendance = res?.data?.attendance;
      if (attendance) {
        setRows((prev) => [...prev.filter((row) => String(row.employee_id ?? row.employeeId) !== String(employee.id)), attendance]);
        window.dispatchEvent(new CustomEvent("attendance-updated", { detail: attendance }));
      }
    } catch (error) {
      const code = error?.code || error?.response?.data?.error;
      if (!isAttendancePolicyError(code) && isServiceOutage(error)) {
        const attendance = applyLocalPunch(employee, "in", "اعتمد حضوراً من لوحة اليوم");
        if (attendance) {
          setRows((prev) => [...prev.filter((row) => String(row.employee_id ?? row.employeeId) !== String(employee.id)), attendance]);
          window.dispatchEvent(new CustomEvent("attendance-updated", { detail: attendance }));
          return;
        }
      }
      setCheckoutError(punchPolicyMessage(code, lang === "ar", "in") || error?.response?.data?.error || (lang === "ar" ? "تعذر تسجيل الحضور اليدوي." : "Could not record the manual check-in."));
    } finally {
      setManualLoadingId(null);
    }
  };

  const manualCheckOut = async (employee) => {
    const reason = checkoutReason.trim();
    if (!reason) {
      setCheckoutError(lang === "ar" ? "سبب الإغلاق مطلوب." : "A reason is required.");
      return;
    }
    setCheckoutError("");
    setManualLoadingId(employee.id);
    try {
      if (isLocalPreviewActive()) {
        const attendance = applyLocalPunch(employee, "out", reason);
        if (attendance) {
          setRows((prev) => prev.map((row) => (String(row.employee_id ?? row.employeeId) === String(employee.id) ? attendance : row)));
          setCheckoutEmployeeId(null);
          setCheckoutReason("");
          window.dispatchEvent(new CustomEvent("attendance-updated", { detail: attendance }));
        }
        return;
      }
      const res = await base44.functions.invoke("supabaseAttendance", {
        action: "manualCheckOut", companyId: company.id, employeeId: employee.id, reason,
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
        const attendance = applyLocalPunch(employee, "out", reason);
        if (attendance) {
          setRows((prev) => prev.map((row) => (String(row.employee_id ?? row.employeeId) === String(employee.id) ? attendance : row)));
          setCheckoutEmployeeId(null);
          setCheckoutReason("");
          window.dispatchEvent(new CustomEvent("attendance-updated", { detail: attendance }));
          return;
        }
      }
      setCheckoutError(punchPolicyMessage(code, lang === "ar", "out") || error?.response?.data?.error || (lang === "ar" ? "تعذر إغلاق الحضور." : "Could not close attendance."));
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
    } catch {
      // best-effort
    }
  };

  const byEmployee = Object.fromEntries(rows.map((r) => [String(r.employee_id ?? r.employeeId), r]));
  const statusFor = (employee) => getAttendanceStatus(employee, byEmployee[String(employee.id)], data);
  // «بلا انصراف» only once the shift has actually ended (+1 h) — an open record mid-shift is normal.
  const isPastCheckoutMissing = (r, employee) => {
    if (!(r?.check_in_at && !r?.check_out_at && r?.status !== "absent")) return false;
    const person = employee || employees.find((e) => String(e.id) === String(r.employee_id ?? r.employeeId));
    return shiftWindowElapsed(getTodaysShift(data, person));
  };
  const needsDecision = (employee) => {
    const row = byEmployee[String(employee.id)];
    const status = statusFor(employee);
    const askedManual = (employee.otherRequests || []).some((item) => item.type === "manual_punch" && (item.status || "pending") === "pending");
    // Leaving inside her Art. 154 nursing minutes at the end of the shift is not an early checkout.
    const earlyOk = row?.early_checkout && isExcusedEarlyCheckout(employee, String(row.date || "").slice(0, 10) || toRiyadhDateKey(), row.check_out_at, getTodaysShift(data, employee)?.end);
    return row?.location_status === "outside" || isPastCheckoutMissing(row, employee) || (!!row?.early_checkout && !earlyOk) || askedManual;
  };
  const todayAtt = deriveTeamAttendanceToday(employees, rows, data);
  const queue = employees.filter(needsDecision);
  const attentionCount = queue.length;
  const notYet = employees.filter((employee) => {
    const status = statusFor(employee);
    if (status !== "absent") return false;
    return !shiftWindowElapsed(getTodaysShift(data, employee));
  }).length;
  const absentClosed = Math.max(0, todayAtt.absent - notYet);
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
  const queueFaceOf = (employee) => {
    const r = byEmployee[String(employee.id)];
    if ((employee.otherRequests || []).some((item) => item.type === "manual_punch" && (item.status || "pending") === "pending")) return "manual";
    if (r?.location_status === "outside") return "outside";
    if (isPastCheckoutMissing(r, employee)) return "missing";
    return "early";
  };
  const queueShown = queueFace === "all" ? queue : queue.filter((employee) => queueFaceOf(employee) === queueFace);
  const queueCount = (id) => queue.filter((employee) => queueFaceOf(employee) === id).length;
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
          value: formatUiNumber(absentClosed),
          suffix: ar ? "موظف" : "people",
          ...(absentClosed ? { tone: "bad", flag: ar ? "غياب دون إجازة" : "Absent, no leave" } : {}),
          hint: ar ? `إجازة ${formatUiNumber(todayAtt.onLeave)}` : `On leave ${formatUiNumber(todayAtt.onLeave)}`,
        },
      ]}
    />
  );

  const teamList = !loading && employees.length > 0 ? (
    <section className="nv-att-card" data-team-today style={panel}>
      <StatusFilterPills
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
              </span>
              <span style={{ ...chipStyle, height: 22, fontSize: 11 }}>{label}</span>
              {href ? (
                <Link to={href} data-team-open={employee.id} style={openLinkStyle()} title={self ? (ar ? "التقويم التشغيلي" : "Operations calendar") : (ar ? "ملف الدوام" : "Duty file")}>
                  {ar ? "افتح ›" : "Open ›"}
                </Link>
              ) : <span />}
            </div>
          );
        })}
      </div>
    </section>
  ) : null;

  const queuePanel = (
    <section ref={queueRef} id="nv-team-queue" className="nv-att-card" data-decision-queue style={{ ...panel, scrollMarginTop: 88 }}>
      <StatusFilterPills
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
        ]}
      >
        <span style={headNote}>{queueSub}</span>
      </StatusFilterPills>

      <div>
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
      ) : (
        queueShown.map((e) => {
          const r = byEmployee[String(e.id)];
          const status = statusFor(e);
          const scheduled = isScheduledToday(e, data) || status === "present" || status === "late" || status === "absent";
          const punched = !!r?.check_in_at;
          const geofence = r?.location_status === "outside" ? "outside" : r?.location_status === "inside" ? "inside" : "none";
          const register = r?.check_out_at ? "closed" : (status === "absent" || status === "not_scheduled" ? "missing" : punched ? "open" : "wait");
          const rings = buildAttendanceRings({ ar: lang === "ar", scheduled, punched, geofence, register, onLeave: status === "on_leave" });
          const flagKey = r?.location_status === "outside"
            ? "outside"
            : r?.early_checkout
              ? "early"
              : isPastCheckoutMissing(r, e)
                ? "missing"
                : FLAG[status]
                  ? status
                  : "present";
          const flag = FLAG[flagKey] || FLAG.present;
          const punchTime = r?.check_in_at ? formatTime(r.check_in_at, format, "en-GB") : "—";
          const asked = (e.otherRequests || []).find((item) => item.type === "manual_punch" && (item.status || "pending") === "pending");
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
                      : (lang === "ar" ? "السلسلة مكتملة." : "The chain is complete.");
          const attention = needsDecision(e);
          const broke = attention ? brokeAtLabel(lang === "ar", rings) : "";
          return (
            <div key={e.id} className={`nv-att-decision-row${attention ? " is-attention" : ""}`}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <EmployeeIdentityRow employee={e} employeeId={e.id} name={e.name} showId={false} compact />
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: MUTED }}>{punchTime}</span>
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: attention ? "var(--nv-bad-ink)" : flag.color }}>
                  {broke || (lang === "ar" ? flag.ar : flag.en)}
                </span>
                <AttendanceRingChips rings={rings} />
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.75 }}>{reason}</span>
                {status === "late" && Number(r?.late_minutes) > 0 && !asked ? (
                  <RightHint ar={ar} style={{ alignSelf: "flex-start" }} hint={attRightHint("lateness", { date: String(r.check_in_at || "").slice(0, 10), minutes: Number(r.late_minutes) }, { view: "manager", ar, employee: e })} />
                ) : null}
                <span data-queue-links="1" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <Link to={fileDutyHref(e.id)} style={openLinkStyle()}>{lang === "ar" ? "ملف الدوام ›" : "Duty file ›"}</Link>
                  <Link to={rosterPersonHref(e.id)} style={openLinkStyle()}>{lang === "ar" ? "في جدول الدوام ›" : "On the roster ›"}</Link>
                </span>
                {r?.excused ? <span style={{ fontSize: 10, color: MUTED }}>{t("excused")}</span> : null}
                {r?.location_status === "outside" ? (
                  <button type="button" onClick={() => setMapRow(r)} style={{ ...miniBtn(), alignSelf: "start" }}>
                    <MapPin style={{ width: 11, height: 11, display: "inline", verticalAlign: "middle", marginInlineEnd: 4 }} />
                    {t("viewOnMap")}
                    {r.distance_meters != null ? ` · ${formatUiNumber(r.distance_meters)}m` : ""}
                  </button>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {status === "absent" && preventedToday(e) ? (
                  <span data-prevented="1" style={{ fontSize: 11, fontWeight: 600, color: "var(--nv-ink)", background: "var(--nv-soft)", border: `1px solid ${BORDER}`, padding: "6px 11px", whiteSpace: "nowrap" }}>
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
                    <button type="button" data-prevent-btn="1" onClick={() => { setPreventId(e.id); setPreventReason(""); setPreventError(""); }} style={miniBtn()} title={lang === "ar" ? "حاضر مستعد ومنعه سبب راجع إلى المنشأة — يُستحق أجره ولا يُحتسب غياباً" : "Ready but kept from work by the company — paid, not absence"}>
                      {lang === "ar" ? "منعته المنشأة" : "Prevented by us"}
                    </button>
                  )
                ) : null}
                {isManager && isPastCheckoutMissing(r, e) && (
                  checkoutEmployeeId === e.id ? (
                    <div style={{ minWidth: 180, padding: 8, border: `1px solid ${BORDER}`, background: SURFACE }}>
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
                    <button type="button" onClick={() => { setCheckoutEmployeeId(e.id); setCheckoutReason(""); setCheckoutError(""); }} style={actBtn("navy")}>
                      {lang === "ar" ? "ثبّت الانصراف" : "Set checkout"}
                    </button>
                  )
                )}
                {(r?.manual_override || r?.location_status === "manual") ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)", border: "1px solid var(--nv-ok-line)", padding: "6px 11px", whiteSpace: "nowrap" }}>
                    {lang === "ar" ? "اعتُمد حضوراً" : "Approved present"} · {r.override_by || r.excused_by_name || "—"}
                  </span>
                ) : isManager && !r?.check_in_at && status !== "on_leave" && status !== "not_scheduled" ? (
                  <button type="button" onClick={() => manualCheckIn(e)} disabled={manualLoadingId === e.id} style={{ ...actBtn("approve"), opacity: manualLoadingId === e.id ? 0.6 : 1 }}>
                    {manualLoadingId === e.id ? <Loader2 style={{ width: 11, height: 11, display: "inline" }} /> : null}
                    {lang === "ar" ? "اعتمد حضوراً" : "Approve present"}
                  </button>
                ) : isManager && (status === "late" || r?.location_status === "outside") && r?.id && !r?.excused ? (
                  <button type="button" onClick={() => toggleExcuse(r)} style={actBtn("approve")}>
                    {lang === "ar" ? "اعتمد حضوراً" : "Approve present"}
                  </button>
                ) : r?.excused ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)", border: "1px solid var(--nv-ok-line)", padding: "6px 11px", whiteSpace: "nowrap" }}>
                    {lang === "ar" ? "اعتُمد حضوراً" : "Approved present"}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })
      )}
      {mapRow && <LocationMapModal row={mapRow} t={t} onClose={() => setMapRow(null)} />}
      {queue.length > 0 ? (
        <div style={{ padding: "12px 18px" }}>
          <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>{queueInsight}</span>
        </div>
      ) : null}
      </div>
    </section>
  );

  const audit = rows
    .filter((row) => row.excused || row.manual_override || row.override_by || row.excused_by_name)
    .map((row) => ({
      id: row.id,
      text: lang === "ar"
        ? `${row.override_by || row.excused_by_name || currentUser?.name || "المدير"} ${row.excused ? "أعفى" : "اعتمد يدوياً"} ${(employees.find((emp) => String(emp.id) === String(row.employee_id ?? row.employeeId))?.name) || ""}`
        : `${row.override_by || row.excused_by_name || currentUser?.name || "Manager"} ${row.excused ? "excused" : "manually approved"} ${(employees.find((emp) => String(emp.id) === String(row.employee_id ?? row.employeeId))?.name) || ""}`,
      time: row.check_in_at ? formatTime(row.check_in_at, format, "en-GB") : "—",
      dot: row.excused ? "var(--nv-warn-fill)" : "var(--nv-ok-ink)",
    }));
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
      {checkoutError ? (
        <div style={{ border: "1px solid var(--nv-bad-line)", background: "var(--nv-bad-soft)", padding: "10px 14px", fontSize: 12, color: DANGER, lineHeight: 1.7, borderRadius: 10 }}>
          {checkoutError}
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