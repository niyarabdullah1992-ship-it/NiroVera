import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, MapPin } from "lucide-react";
import { STUDY_CONSENT_TYPE } from "@/lib/otherRequestDerivations";
import { requestReplyCopy, requestReplyHref } from "@/lib/requestWorkspace";
import LocationMapModal from "@/components/attendance/LocationMapModal";
import { useI18n } from "@/lib/i18n";
import { formatTime, useTimeFormat } from "@/hooks/useTimeFormat";
import { deriveTeamAttendanceToday, getAttendanceStatus, getTodaysShift, isAttendancePolicyError, isScheduledToday } from "@/lib/attendance";
import { isServiceOutage } from "@/lib/serviceErrors";
import { hmToMinutes } from "@/lib/attendanceDerivations";
import { listLocalTodayAttendance, mergeAttendanceRows } from "@/lib/localAttendanceFallback";
import { recordManualAttendance } from "@/lib/store";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import EmployeeIdentityRow from "@/components/employees/EmployeeIdentityRow";
import { AttendanceRingChips, brokeAtLabel, buildAttendanceRings } from "@/components/attendance/AttendanceTrustChrome";
import { formatUiNumber } from "@/lib/dateFormat";
import { ACCENT, BORDER, CARD, DANGER, MUTED, NAVY, emptyState, field, SURFACE } from "@/lib/platformStyles";

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
  late: { ar: "متأخر", en: "Late", color: "#8a6516", bg: "#fdf6e8", border: "#ecd9a8" },
  absent: { ar: "غائب", en: "Absent", color: "#8a1c2b", bg: "#fbf1f2", border: "#e9c4c9" },
  outside: { ar: "خارج النطاق", en: "Outside range", color: "#8a1c2b", bg: "#fbf1f2", border: "#e9c4c9" },
  missing: { ar: "بلا انصراف", en: "No checkout", color: "#8a6516", bg: "#fdf6e8", border: "#ecd9a8" },
  early: { ar: "غادر مبكراً", en: "Left early", color: "#8a6516", bg: "#fdf6e8", border: "#ecd9a8" },
  present: { ar: "مكتمل", en: "Complete", color: "#137a49", bg: "color-mix(in oklab, #1E9E63 10%, #fff)", border: "color-mix(in oklab, #1E9E63 28%, #fff)" },
  on_leave: { ar: "إجازة", en: "Leave", color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" },
  not_scheduled: { ar: "غير مجدول", en: "Unscheduled", color: "#5A6B85", bg: "#F7F8FA", border: "#E2E8F0" },
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

function shiftWindowElapsed(shift) {
  const end = hmToMinutes(shift?.end);
  if (end == null) return false;
  return nowMinutes() > end + 60;
}

const actBtn = (kind) => {
  if (kind === "approve") {
    return { fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 13px", border: "none", background: "#137a49", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" };
  }
  if (kind === "reject") {
    return { fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 13px", border: "1px solid #e9c4c9", background: "#fff", color: "#8a1c2b", cursor: "pointer", whiteSpace: "nowrap" };
  }
  return { fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 13px", border: "none", background: "#14213d", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" };
};

export default function AttendanceDailyDashboard({ employees, currentUser, company, data, t, onQueueCount }) {
  const { lang } = useI18n();
  const { format } = useTimeFormat();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapRow, setMapRow] = useState(null);
  const [manualLoadingId, setManualLoadingId] = useState(null);
  const [checkoutEmployeeId, setCheckoutEmployeeId] = useState(null);
  const [checkoutReason, setCheckoutReason] = useState("");
  const [checkoutError, setCheckoutError] = useState("");

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
  const isPastCheckoutMissing = (r) => r?.check_in_at && !r?.check_out_at && r?.status !== "absent";
  const needsDecision = (employee) => {
    const row = byEmployee[String(employee.id)];
    const status = statusFor(employee);
    const askedManual = (employee.otherRequests || []).some((item) => item.type === "manual_punch" && (item.status || "pending") === "pending");
    return row?.location_status === "outside" || isPastCheckoutMissing(row) || !!row?.early_checkout || askedManual;
  };
  const todayAtt = deriveTeamAttendanceToday(employees, rows, data);
  const queue = employees.filter(needsDecision);
  const attentionCount = queue.length;
  const pendingRequestReplies = employees.flatMap((employee) => {
    const leave = (employee.leaveRequests || [])
      .filter((row) => (row.status || "pending") === "pending")
      .map((request) => ({ employee, family: "leave", request }));
    const study = (employee.otherRequests || [])
      .filter((row) => row.type === STUDY_CONSENT_TYPE && (row.status || "pending") === "pending")
      .map((request) => ({ employee, family: "study", request }));
    return [...leave, ...study];
  });
  const pendingRepliesMine = pendingRequestReplies.length > 0
    && pendingRequestReplies.every((row) => String(row.employee.id) === String(currentUser?.id));
  const pendingReplyHref = requestReplyHref({ mine: pendingRepliesMine });
  const notYet = employees.filter((employee) => {
    const status = statusFor(employee);
    if (status !== "absent") return false;
    return !shiftWindowElapsed(getTodaysShift(data, employee));
  }).length;
  const absentClosed = Math.max(0, todayAtt.absent - notYet);
  const kpis = [
    { label: lang === "ar" ? "مجدولون اليوم" : "Scheduled today", value: todayAtt.scheduled, note: lang === "ar" ? `سجّل ${todayAtt.presentLike} · ${todayAtt.rate}%` : `Logged ${todayAtt.presentLike} · ${todayAtt.rate}%`, accent: "#14213d", color: "#14213d" },
    { label: lang === "ar" ? "حضر في الوقت" : "On time", value: todayAtt.present, note: lang === "ar" ? "مَن وأين مؤكّدان" : "Who and where confirmed", accent: "#1d9a5b", color: "#137a49" },
    { label: lang === "ar" ? "متأخر" : "Late", value: todayAtt.late, note: lang === "ar" ? "بصم بعد بداية الوردية" : "Punched after shift start", accent: "#c9962b", color: "#8a6516" },
    { label: lang === "ar" ? "بانتظار قرار" : "Awaiting a decision", value: attentionCount, note: lang === "ar" ? "حلقة انكسرت — لا حاضر ولا غائب بعد" : "A link broke — neither present nor absent yet", accent: "#8a6516", color: "#8a6516" },
    { label: lang === "ar" ? "غاب" : "Absent", value: absentClosed, note: lang === "ar" ? "بلا تسجيل ولا إجازة بعد نافذة الوردية" : "No punch and no leave after the shift window", accent: "#8a1c2b", color: "#8a1c2b" },
    { label: lang === "ar" ? "إجازة" : "Leave", value: todayAtt.onLeave, note: lang === "ar" ? "خارج حساب الحضور" : "Outside the attendance count", accent: "#c7ccd6", color: "#4b5567" },
    { label: lang === "ar" ? "لم يبصم بعد" : "Not punched yet", value: notYet, note: lang === "ar" ? "الوردية لم تنتهِ بعد" : "The shift window is still open", accent: "#c7ccd6", color: "#4b5567" },
  ];

  useEffect(() => {
    onQueueCount?.(attentionCount);
  }, [attentionCount, onQueueCount]);

  const queueSub = attentionCount
    ? (lang === "ar"
      ? (attentionCount === 1 ? "صفٌّ واحد انكسرت فيه حلقة ولا يصحّ حكم النظام عليه — لا حاضراً بلا دليل، ولا غائباً وهو قد يكون في الموقع." : `${formatUiNumber(attentionCount)} صفوف انكسرت فيها حلقة واحدة ولا يصحّ حكم النظام عليها.`)
      : `${formatUiNumber(attentionCount)} row${attentionCount === 1 ? "" : "s"} broke a link — the system will not guess present or absent.`)
    : (lang === "ar" ? "كل الصفوف حُسمت. القرارات مسجّلة في سجل التدقيق أدناه." : "The queue is clear. Decisions are in the audit below.");
  const queueInsight = attentionCount
    ? (lang === "ar" ? "الطابور مقياس عمل لا مقياس أداء — يجب أن يصل صفراً كل يوم." : "The queue measures work, not performance — it should reach zero every day.")
    : (lang === "ar" ? "الطابور صفر — كل يوم أُغلق تلقائياً أو بقرار موقّع." : "Queue at zero — every day closed automatically or by a signed decision.");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} dir={lang === "ar" ? "rtl" : "ltr"}>
      {checkoutError ? (
        <div style={{ border: "1px solid #e9c4c9", background: "#fbf1f2", padding: "10px 14px", fontSize: 12, color: DANGER, lineHeight: 1.7 }}>
          {checkoutError}
        </div>
      ) : null}
      {!loading && employees.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 12 }}>
          {kpis.map((item) => (
            <div key={item.label} className="nv-att-kpi" style={{ background: CARD, border: `1px solid ${BORDER}`, borderTop: `3px solid ${item.accent}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: MUTED }}>{item.label}</span>
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, color: item.color, textAlign: lang === "ar" ? "right" : "left", lineHeight: 1.1 }}>{formatUiNumber(item.value)}</span>
              <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.7 }}>{item.note}</span>
            </div>
          ))}
        </div>
      ) : null}

    {pendingRequestReplies.length > 0 ? (
      <section className="nv-att-card" style={{ background: CARD, border: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
            {lang === "ar" ? "إجازة أو موافقة دراسية بانتظار الرد" : "Leave or study consent awaiting a reply"}
          </span>
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
            {lang === "ar"
              ? `${formatUiNumber(pendingRequestReplies.length)} بانتظار القرار — الاعتماد والرفض من طلباتي، لا من طابور الحضور.`
              : `${formatUiNumber(pendingRequestReplies.length)} awaiting a decision — approve and reject in My Requests, not this attendance queue.`}
          </span>
        </div>
        <Link to={pendingReplyHref} style={{ fontSize: 12, fontWeight: 700, color: "#137a49", textDecoration: "none", whiteSpace: "nowrap", alignSelf: "center" }}>
          {requestReplyCopy(lang === "ar")}
        </Link>
      </section>
    ) : null}

    <section className="nv-att-card" style={{ background: CARD, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{lang === "ar" ? "يحتاج قرارك" : "Needs your decision"}</span>
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>{queueSub}</span>
        </div>
      </div>

      <div>
      {loading ? (
        <div style={{ padding: "24px 20px", textAlign: "center", fontSize: 12, color: MUTED }}>…</div>
      ) : employees.length === 0 ? (
        <div style={{ ...emptyState, margin: 16 }}>{t("noAttendanceRecords")}</div>
      ) : queue.length === 0 ? (
        <div style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: 12, color: "#137a49", fontWeight: 600 }}>
            {lang === "ar" ? "الطابور صفر — كل يوم أُغلق تلقائياً أو بقرار موقّع." : "Queue at zero — every day closed automatically or by a signed decision."}
          </span>
        </div>
      ) : (
        queue.map((e) => {
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
              : isPastCheckoutMissing(r)
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
                  : isPastCheckoutMissing(r)
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
                <span style={{ fontSize: 12, fontWeight: 600, color: attention ? "#8a1c2b" : flag.color }}>
                  {broke || (lang === "ar" ? flag.ar : flag.en)}
                </span>
                <AttendanceRingChips rings={rings} />
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.75 }}>{reason}</span>
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
                {isManager && isPastCheckoutMissing(r) && (
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
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#137a49", background: "#f2faf6", border: "1px solid #bfe6d2", padding: "6px 11px", whiteSpace: "nowrap" }}>
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
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#137a49", background: "#f2faf6", border: "1px solid #bfe6d2", padding: "6px 11px", whiteSpace: "nowrap" }}>
                    {lang === "ar" ? "اعتُمد حضوراً" : "Approved present"}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })
      )}
      {mapRow && <LocationMapModal row={mapRow} t={t} onClose={() => setMapRow(null)} />}
      <div style={{ padding: "13px 20px" }}>
        <span style={{ fontSize: 11, color: "#4b5567", lineHeight: 1.85 }}>{queueInsight}</span>
      </div>
      </div>
    </section>
    {!loading ? (() => {
      const audit = rows
        .filter((row) => row.excused || row.manual_override || row.override_by || row.excused_by_name)
        .map((row) => ({
          id: row.id,
          text: lang === "ar"
            ? `${row.override_by || row.excused_by_name || currentUser?.name || "المدير"} ${row.excused ? "أعفى" : "اعتمد يدوياً"} ${(employees.find((emp) => String(emp.id) === String(row.employee_id ?? row.employeeId))?.name) || ""}`
            : `${row.override_by || row.excused_by_name || currentUser?.name || "Manager"} ${row.excused ? "excused" : "manually approved"} ${(employees.find((emp) => String(emp.id) === String(row.employee_id ?? row.employeeId))?.name) || ""}`,
          time: row.check_in_at ? formatTime(row.check_in_at, format, "en-GB") : "—",
          dot: row.excused ? "#c9962b" : "#137a49",
        }));
      return (
        <section className="nv-att-card" style={{ background: CARD, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{lang === "ar" ? "سجل التدقيق — قرارات اليوم" : "Audit — today's decisions"}</span>
          </div>
          {audit.length === 0 ? (
            <div style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: 11, color: MUTED }}>{lang === "ar" ? "لا قرار بعد. كل اعتماد أو إعفاء يُسجَّل هنا باسم من قرّره." : "No decision yet. Each approval or excuse is recorded here with the actor's name."}</span>
            </div>
          ) : audit.map((item) => (
            <div key={item.id} style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 12, alignItems: "baseline" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.dot }} />
              <span style={{ fontSize: 12, color: NAVY, lineHeight: 1.8, minWidth: 0 }}>{item.text}</span>
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: MUTED }}>{item.time}</span>
            </div>
          ))}
        </section>
      );
    })() : null}
    </div>
  );
}