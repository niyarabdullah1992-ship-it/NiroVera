
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { getTodaysShift, isAttendancePolicyError, isForgottenCheckout, isLocationRequired } from "@/lib/attendance";
import { checkCheckInLeaveGate } from "@/lib/attendanceGate";
import { isOnLeaveToday } from "@/lib/leaveTypes";
import { getAccuratePosition, startGeoWarmup } from "@/lib/geo";
import { useI18n } from "@/lib/i18n";
import { formatTime, useTimeFormat } from "@/hooks/useTimeFormat";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { toWesternDigits } from "@/lib/dateFormat";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { isServiceOutage } from "@/lib/serviceErrors";
import {
  getLocalTodayAttendance,
  localAttendanceSettings,
  localCheckIn,
  localCheckOut,
} from "@/lib/localAttendanceFallback";
import { ACCENT, BORDER, CARD, MUTED, NAVY, SURFACE, ui } from "@/lib/platformStyles";
import { submitOtherRequest } from "@/lib/store";
import { checkSubmitOtherRequestGate } from "@/lib/otherRequestDerivations";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { parsePunchClock, riyadhNowClock } from "@/lib/attendancePunch";
import AppliedLawList from "@/components/shared/AppliedLawList";

const STATUS_PILL = {
  present: { bg: "#ECFDF3", fg: "#15803D", bd: "#BBF7D0", ar: "حاضر", en: "Present" },
  late: { bg: "#FFFBEB", fg: "#B45309", bd: "#FDE68A", ar: "متأخر", en: "Late" },
  absent: { bg: "#FEF2F2", fg: "#DC2626", bd: "#FECACA", ar: "غائب", en: "Absent" },
};

function elapsedLabel(checkInAt, lang) {
  if (!checkInAt) return "";
  const ms = Date.now() - new Date(checkInAt).getTime();
  if (ms < 0) return "";
  const ar = lang === "ar";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return ar ? `${m} دقيقة منذ الدخول` : `${m}m since check-in`;
  return ar ? `${h} س ${m} د منذ الدخول` : `${h}h ${m}m since check-in`;
}

/**
 * Employee daily check-in/out — primary punch surface on the attendance hub.
 */
export default function CheckInOutCard({ currentUser, company, t, onStatusChange, compact = false }) {
  const { data, refresh } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { format } = useTimeFormat();
  const local = isLocalPreviewActive();
  const shift = getTodaysShift(data, currentUser);
  const defaultStationId = data?.stations?.[0]?.id || null;
  const scheduledStationId = shift?.stationId || currentUser?.stationId || defaultStationId;
  const [punchStationId, setPunchStationId] = useState(scheduledStationId || "");
  const [reqTime, setReqTime] = useState(() => riyadhNowClock());
  const [reqReason, setReqReason] = useState("");
  const [reqNote, setReqNote] = useState("");
  const [reqError, setReqError] = useState("");
  const assignedStationIds = [scheduledStationId, punchStationId, ...(currentUser?.managedStations || [])].filter(Boolean);
  const hasAssignedStation = assignedStationIds.some((id) => data?.stations?.some((station) => station.id === id));
  const [settings, setSettings] = useState(local ? localAttendanceSettings() : null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [localMode, setLocalMode] = useState(local);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    if (scheduledStationId && !punchStationId) setPunchStationId(scheduledStationId);
  }, [scheduledStationId, punchStationId]);

  const load = async () => {
    if (local || !company?.id) {
      const att = company?.id ? getLocalTodayAttendance(company.id, currentUser.id) : null;
      setSettings(localAttendanceSettings());
      setAttendance(att);
      setLocalMode(true);
      onStatusChange?.(att);
      return;
    }
    try {
      const [setRes, attRes] = await Promise.all([
        base44.functions.invoke("supabaseAttendance", { action: "getSettings", companyId: company.id }),
        base44.functions.invoke("supabaseAttendance", { action: "getTodayStatus", employeeId: currentUser.id }),
      ]);
      const loadedSettings = setRes?.data?.settings || null;
      setSettings(loadedSettings);
      if (isLocationRequired(loadedSettings) && hasAssignedStation) startGeoWarmup();
      setLocalMode(false);
      const att = attRes?.data?.attendance || null;
      setAttendance(att);
      onStatusChange?.(att);
    } catch {
      const att = getLocalTodayAttendance(company.id, currentUser.id);
      setSettings(localAttendanceSettings());
      setAttendance(att);
      setLocalMode(true);
      onStatusChange?.(att);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, company?.id]);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const scheduleBlocks = !shift;
  const onLeaveToday = isOnLeaveToday(currentUser);
  const statusPill = attendance?.status ? STATUS_PILL[attendance.status] : null;
  const elapsed = useMemo(
    () => elapsedLabel(attendance?.check_in_at, lang),
    [attendance?.check_in_at, lang, tick],
  );

  const punch = async (action) => {
    if (action === "in") {
      const leaveGate = checkCheckInLeaveGate(currentUser);
      if (!leaveGate.ok) {
        setError(ar ? leaveGate.reason : leaveGate.reasonEn);
        return;
      }
      if (scheduleBlocks) {
        setError(ar ? "لا يمكنك تسجيل الحضور لأنك غير مدرج في جدول اليوم." : "You cannot check in because you are not scheduled today.");
        return;
      }
      if (!hasAssignedStation && !localMode) {
        setError(ar ? "لا يمكنك تسجيل الحضور قبل تعيين فرع عمل لك." : "You cannot check in until a workplace is assigned.");
        return;
      }
    }
    setError("");
    setLoading(true);
    try {
      if (localMode || isLocalPreviewActive()) {
        const att = action === "in"
          ? localCheckIn(company.id, {
              employeeId: currentUser.id,
              employeeName: currentUser.name,
              stationId: punchStationId || scheduledStationId || defaultStationId,
            })
          : localCheckOut(company.id, { employeeId: currentUser.id });
        setAttendance(att);
        onStatusChange?.(att);
        window.dispatchEvent(new CustomEvent("attendance-updated", { detail: att }));
        await refresh?.();
        return;
      }
      const settingsRes = await base44.functions.invoke("supabaseAttendance", { action: "getSettings", companyId: company.id });
      const currentSettings = settingsRes?.data?.settings || settings;
      setSettings(currentSettings);
      let coords = null;
      if (isLocationRequired(currentSettings)) {
        coords = await getAccuratePosition();
        if (!coords) {
          setError(t("locationDenied"));
          return;
        }
      }
      const res = await base44.functions.invoke("supabaseAttendance", {
        action: action === "in" ? "checkIn" : "checkOut",
        companyId: company.id,
        employeeId: currentUser.id,
        ...(coords ? { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy } : {}),
        ...(action === "in"
          ? {
              employeeName: currentUser.name,
              stationId: punchStationId || scheduledStationId,
              shiftStart: shift?.start,
            }
          : {
              shiftEnd: shift?.end,
            }),
      });
      const att = res?.data?.attendance;
      if (att) {
        setAttendance(att);
        onStatusChange?.(att);
        window.dispatchEvent(new CustomEvent("attendance-updated", { detail: att }));
      }
    } catch (err) {
      const code = err?.code || err?.response?.data?.error;
      // Attendance is the first link of the proof cycle, so a punch is only stamped
      // locally when the service could not answer at all. A refused session (401/403)
      // is the server saying this account may not punch — writing the stamp anyway
      // would put an unauthenticated presence at the head of the chain.
      if (company?.id && !isAttendancePolicyError(code) && isServiceOutage(err)) {
        try {
          const att = action === "in"
            ? localCheckIn(company.id, {
                employeeId: currentUser.id,
                employeeName: currentUser.name,
                stationId: punchStationId || scheduledStationId || defaultStationId,
              })
            : localCheckOut(company.id, { employeeId: currentUser.id });
          setSettings(localAttendanceSettings());
          setLocalMode(true);
          setAttendance(att);
          onStatusChange?.(att);
          window.dispatchEvent(new CustomEvent("attendance-updated", { detail: att }));
          await refresh?.();
          return;
        } catch {
          /* fall through */
        }
      }
      setError(
        code === "ON_APPROVED_LEAVE"
          ? (ar ? "لا يمكنك تسجيل الحضور — لديك إجازة معتمدة لهذا اليوم." : "You cannot check in — you have approved leave for today.")
          : code === "ALREADY_CHECKED_IN"
          ? (ar ? "الحضور مسجّل لهذا اليوم — لا يُعاد ختمه." : "Check-in is already on file for this day — it is not stamped again.")
          : code === "ALREADY_CHECKED_OUT"
          ? (ar ? "الانصراف مسجّل لهذا اليوم — لا يُختلق وقت آخر." : "Checkout is already on file for this day — another time is not invented.")
          : code === "NOT_CHECKED_IN"
          ? (ar ? "لا انصراف قبل حضور مسجّل." : "Checkout needs a recorded check-in.")
          : code === "NOT_SCHEDULED"
          ? (ar ? "لا يمكنك تسجيل الحضور لأنك غير مدرج في جدول اليوم." : "You cannot check in because you are not scheduled today.")
          : code === "GPS_REQUIRED"
            ? t("locationDenied")
            : code === "STATION_LOCATION_REQUIRED"
              ? t("locationNotSet")
              : code === "OUTSIDE_STATION"
                ? t("outsideLocation")
                : (code || (ar ? (action === "in" ? "فشل تسجيل الحضور" : "فشل تسجيل الانصراف") : (action === "in" ? "Failed to check in" : "Failed to check out")))
      );
    } finally {
      setLoading(false);
    }
  };

  const phase = !attendance?.check_in_at
    ? "awaiting_in"
    : !attendance?.check_out_at
      ? "awaiting_out"
      : "done";

  const accentColor = phase === "awaiting_out" ? ACCENT : phase === "done" ? "#137a49" : NAVY;
  const clockLabel = toWesternDigits(formatTime(new Date(tick).toISOString(), format, "en-GB"));
  const locationFailed = /OUTSIDE_STATION|GPS_REQUIRED|STATION_LOCATION|location|موقع|النطاق/i.test(error || "");
  const forgotten = isForgottenCheckout(shift, attendance, tick);
  const inTime = attendance?.check_in_at ? toWesternDigits(formatTime(attendance.check_in_at, format, "en-GB")) : "—";
  const outTime = attendance?.check_out_at ? toWesternDigits(formatTime(attendance.check_out_at, format, "en-GB")) : "—";
  const lateMinutes = Number(attendance?.late_minutes || attendance?.lateMinutes || 0);
  const isLate = attendance?.status === "late" || lateMinutes > 0;
  const punchSub = phase === "awaiting_in"
    ? (ar ? "ضغطة واحدة عند الوصول. الوقت من ورديتك المنشورة — لا ساعة شركة." : "One tap on arrival. Time comes from your published shift — no company clock.")
    : phase === "awaiting_out"
      ? (ar ? "حضورك مسجّل. سجّل الانصراف عند المغادرة — النظام لا يفترض ساعاتك." : "Checked in. Check out when you leave — the system does not assume your hours.")
      : (ar ? "اليوم مُغلق — السجل انتقل إلى التقويم التشغيلي." : "Day closed — the record moved to the operational calendar.");
  const punchLabel = phase === "awaiting_in"
    ? (ar ? "تسجيل الحضور" : "Check in")
    : phase === "awaiting_out"
      ? (ar ? "تسجيل الانصراف" : "Check out")
      : (ar ? "اليوم مُغلق" : "Day closed");
  const punchBlocked = loading || (phase === "awaiting_in" && (scheduleBlocks || onLeaveToday)) || phase === "done";
  const punchBg = phase === "done" ? "#4b5567" : (scheduleBlocks || onLeaveToday || error ? "#8a6516" : "#137a49");

  const punchButton = (action, label) => (
    <button
      type="button"
      onClick={() => punch(action)}
      disabled={loading || (action === "in" && (scheduleBlocks || onLeaveToday))}
      style={{
        ...ui.btnPrimary,
        height: compact ? 34 : 40,
        padding: compact ? "0 14px" : "0 18px",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        opacity: loading || (action === "in" && (scheduleBlocks || onLeaveToday)) ? 0.45 : 1,
        cursor: loading || (action === "in" && (scheduleBlocks || onLeaveToday)) ? "not-allowed" : "pointer",
      }}
    >
      {loading
        ? <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />
        : action === "in"
          ? <LogIn style={{ width: 15, height: 15 }} strokeWidth={1.75} />
          : <LogOut style={{ width: 15, height: 15 }} strokeWidth={1.75} />}
      {label}
    </button>
  );

  if (compact) {
    return (
      <section
        style={{
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          background: CARD,
          overflow: "hidden",
        }}
        dir={ar ? "rtl" : "ltr"}
        className="nv-att-card"
        data-testid="check-in-out-card"
      >
        <div style={{ height: 3, background: accentColor }} />
        <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <div style={{ flex: "1 1 180px", minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: NAVY }}>
              {phase === "awaiting_in"
                ? (ar ? "البصمة — سجّل حضورك" : "Punch — check in")
                : phase === "awaiting_out"
                  ? (ar ? "البصمة — سجّل انصرافك" : "Punch — check out")
                  : (ar ? "اكتملت ورديتك" : "Shift complete")}
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: MUTED }}>
              {ar ? "حضور" : "In"} {attendance?.check_in_at ? formatTime(attendance.check_in_at, format, lang) : "—"}
              {" · "}
              {ar ? "انصراف" : "Out"} {attendance?.check_out_at ? formatTime(attendance.check_out_at, format, lang) : "—"}
              {elapsed ? ` · ${elapsed}` : ""}
            </p>
          </div>
          {statusPill && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
              background: statusPill.bg, color: statusPill.fg, border: `1px solid ${statusPill.bd}`,
            }}
            >
              {ar ? statusPill.ar : statusPill.en}
            </span>
          )}
          {error && <p style={{ margin: 0, fontSize: 11, color: "#DC2626", flex: "1 1 100%" }}>{error}</p>}
          {phase === "awaiting_in" && punchButton("in", ar ? "حضر" : "Present")}
          {phase === "awaiting_out" && punchButton("out", ar ? "انصرف" : "Out")}
        </div>
      </section>
    );
  }

  const marks = [];
  if (attendance?.check_in_at) {
    marks.push({
      label: isLate ? (ar ? "حضرت — متأخر" : "Checked in — late") : (ar ? "حضرت في الوقت" : "Checked in on time"),
      note: isLate
        ? (ar ? `${lateMinutes || "—"} دقيقة بعد بداية الوردية (${toWesternDigits(shift?.start || "—")})` : `${lateMinutes || "—"} minutes after shift start (${shift?.start || "—"})`)
        : (ar ? `في الوقت · الوردية تبدأ ${toWesternDigits(shift?.start || "—")}` : `On time · shift starts ${shift?.start || "—"}`),
      time: inTime,
      dot: isLate ? "#8a6516" : "#137a49",
      bg: isLate ? "#fdf6e8" : "#f2faf6",
      border: isLate ? "#ecd9a8" : "#bfe6d2",
    });
  }
  if (attendance?.check_out_at) {
    marks.push({
      label: ar ? "انصرفت" : "Checked out",
      note: elapsed || (ar ? "أُغلق اليوم من بصمتك." : "The day closed from your punch."),
      time: outTime,
      dot: "#137a49",
      bg: "#f2faf6",
      border: "#bfe6d2",
    });
  }

  return (
    <section
      style={{
        border: `1px solid ${BORDER}`,
        background: CARD,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
      dir={ar ? "rtl" : "ltr"}
      className="nv-att-card"
      data-testid="check-in-out-card"
    >
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "بصمتك اليوم" : "Your punch today"}</span>
        <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>{punchSub}</span>
      </div>

      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ border: `1px solid ${BORDER}`, background: SURFACE, padding: "13px 15px", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center" }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: MUTED }}>{ar ? "ورديتك — من الجدول المنشور" : "Your shift — from the published rota"}</span>
            {shift ? (
              <span style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{shift.label || (ar ? "وردية اليوم" : "Today's shift")}</span>
            ) : (
              <Link to="/app/shifts" style={{ color: ACCENT, textDecoration: "none", fontWeight: 600, fontSize: 13 }}>
                {ar ? "غير مدرج في جدول اليوم — لا بصمة" : "Not on today's rota — no punch"}
              </Link>
            )}
          </span>
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, whiteSpace: "nowrap", color: NAVY }}>
            {shift ? `${toWesternDigits(shift.start || "—")} → ${toWesternDigits(shift.end || "—")}` : clockLabel}
          </span>
        </div>

        {marks.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {marks.map((mark) => (
              <div key={mark.label} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 11, alignItems: "center", padding: "10px 13px", border: `1px solid ${mark.border}`, background: mark.bg }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: mark.dot }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{mark.label}</span>
                  <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{mark.note}</span>
                </span>
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: mark.dot, whiteSpace: "nowrap" }}>{mark.time}</span>
              </div>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => { if (phase === "awaiting_in") punch("in"); else if (phase === "awaiting_out") punch("out"); }}
          disabled={punchBlocked}
          style={{
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 700,
            padding: 15,
            border: "none",
            background: punchBg,
            color: "#fff",
            cursor: punchBlocked ? "not-allowed" : "pointer",
            width: "100%",
            minHeight: 52,
            opacity: punchBlocked ? 0.55 : 1,
          }}
        >
          {loading ? (ar ? "جارٍ التسجيل…" : "Saving…") : punchLabel}
        </button>

        {forgotten ? (
          <div style={{ border: "1px solid #ecd9a8", background: "#fdf6e8", padding: "13px 15px", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#8a6516" }}>{ar ? "انصراف منسي — أُحيل إلى مديرك" : "Forgotten checkout — sent to your manager"}</span>
            <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
              {ar
                ? `مضت ساعة على نهاية وردية ${toWesternDigits(shift?.start || "—")} → ${toWesternDigits(shift?.end || "—")} ولم تُسجّل الانصراف. سجلك ما زال مفتوحاً، وظهر صفٌّ في «يحتاج قرارك» ليضع مديرك وقت الانصراف يدوياً — النظام لا يفترض ساعاتك.`
                : `An hour has passed since ${shift?.start || "—"} → ${shift?.end || "—"}. Your register is still open, and a row appeared in “Needs your decision” so your manager can set checkout — the system does not assume your hours.`}
            </span>
          </div>
        ) : null}

        {error ? (
          <div style={{ border: "1px solid #e9c4c9", background: "#fbf1f2", padding: "13px 15px", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#8a1c2b" }}>
              {locationFailed
                ? (ar ? "النطاق — لم يُستوفَ" : "Range — not met")
                : scheduleBlocks
                  ? (ar ? "الوردية — غير مدرج" : "Shift — not scheduled")
                  : onLeaveToday
                    ? (ar ? "إجازة معتمدة اليوم" : "Approved leave today")
                    : (ar ? "تعذّر التسجيل" : "Punch failed")}
            </span>
            <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>{error}</span>
          </div>
        ) : onLeaveToday && phase === "awaiting_in" ? (
          <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", padding: "13px 15px" }}>
            <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.85 }}>
              {ar ? "إجازة معتمدة اليوم — البصمة غير متاحة." : "Approved leave today — punch is closed."}
            </span>
          </div>
        ) : null}

        <ManualPunchRequest
          ar={ar}
          phase={phase}
          companyId={company?.id}
          employee={currentUser}
          attendance={attendance}
          onLeave={onLeaveToday}
          reqTime={reqTime}
          setReqTime={setReqTime}
          reqReason={reqReason}
          setReqReason={setReqReason}
          reqNote={reqNote}
          setReqNote={setReqNote}
          reqError={reqError}
          setReqError={setReqError}
          refresh={refresh}
        />
        <AppliedLawList
          title={ar ? "ما يُطبَّق على بصمتك" : "What applies to your punch"}
          note={ar
            ? "سقف الساعات والراحة الأسبوعية من نظام العمل. اضغط المادة لقراءة النص."
            : "The hours cap and weekly rest come from the Labour Law. Press the article to read the text."}
          ruleIds={["hours.week.ordinaryMaxHours", "hours.rest.maxConsecutiveHours", "hours.rest.weeklyHours"]}
          ar={ar}
        />
      </div>
    </section>
  );
}

const REQ_REASONS_AR = ["خارج النطاق", "تعذّر الموقع", "عمل ميداني", "سبب آخر"];
const REQ_REASONS_EN = ["Outside range", "Location failed", "Field work", "Other"];

function ManualPunchRequest({
  ar,
  phase,
  companyId,
  employee,
  attendance,
  onLeave,
  reqTime,
  setReqTime,
  reqReason,
  setReqReason,
  reqNote,
  setReqNote,
  reqError,
  setReqError,
  refresh,
}) {
  const reasons = ar ? REQ_REASONS_AR : REQ_REASONS_EN;
  const punchType = phase === "awaiting_out" ? "checkout_fix" : "manual_punch";
  const pending = (employee?.otherRequests || []).find((row) => row.type === punchType && (row.status || "pending") === "pending");
  const decided = (employee?.otherRequests || []).find((row) => row.type === punchType && (row.status === "approved" || row.status === "rejected"));
  const noteReady = String(reqNote || "").trim().length >= 3;
  const timeReady = !!parsePunchClock(reqTime);
  const canSend = noteReady && timeReady;
  const reasonLabel = reqReason || reasons[0];

  const send = () => {
    if (!companyId || !employee?.id) return;
    const reason = `${reqTime} · ${reasonLabel} — ${String(reqNote || "").trim()}`;
    const gate = checkSubmitOtherRequestGate({
      type: phase === "awaiting_out" ? "checkout_fix" : "manual_punch",
      reason,
      date: toRiyadhDateKey(),
      time: reqTime,
      employee,
      attendance,
    });
    if (!gate.ok) {
      setReqError(ar ? gate.reason : gate.reasonEn);
      return;
    }
    setReqError("");
    submitOtherRequest(companyId, employee.id, {
      type: phase === "awaiting_out" ? "checkout_fix" : "manual_punch",
      reason,
      date: toRiyadhDateKey(),
      time: reqTime,
    });
    setReqNote("");
    refresh?.();
  };

  const latest = pending || decided;

  return (
    <div style={{ border: `1px solid ${BORDER}`, background: SURFACE, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 9 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>
        {phase === "awaiting_out" ? (ar ? "تصحيح انصراف" : "Checkout correction") : (ar ? "طلب تسجيل يدوي" : "Manual punch request")}
      </span>
      {onLeave ? (
        <span style={{ fontSize: 11, color: "#8a1c2b", lineHeight: 1.85 }}>
          {phase === "awaiting_out"
            ? (ar ? "لا يمكن تصحيح الانصراف — لديك إجازة معتمدة لهذا اليوم." : "Checkout correction blocked — you have approved leave for this day.")
            : (ar ? "لا يمكن تسجيل الحضور — لديك إجازة معتمدة لهذا اليوم." : "Check-in blocked — you have approved leave for this day.")}
        </span>
      ) : phase === "done" && !latest ? (
        <span style={{ fontSize: 11, color: "#4b5567", lineHeight: 1.85 }}>
          {ar
            ? "اليوم مغلق. الحضور والانصراف مسجّلان — لا يُعاد ختم الوقت ولا يُختلق."
            : "The day is closed. Check-in and checkout are on file — the time is not restamped or invented."}
        </span>
      ) : latest ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: pending ? "#8a6516" : (latest.status === "approved" ? "#137a49" : "#8a1c2b"),
          }}
          >
            {pending
              ? (ar ? "الطلب بانتظار قرار المدير" : "Waiting for the manager")
              : latest.status === "approved"
                ? (ar ? "اعتمد المدير طلبك" : "The manager approved your request")
                : (ar ? "رفض المدير الطلب" : "The manager rejected the request")}
          </span>
          <span style={{ fontSize: 11, color: "#4b5567", lineHeight: 1.85 }}>
            {latest.reason}
            {pending
              ? (ar ? " — يظهر في طابور «يحتاج قرارك» ولا يُغلق يومك قبل القرار." : " — it appears in “Needs your decision” and the day stays open until decided.")
              : ""}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#4b5567", lineHeight: 1.85 }}>
            {ar
              ? "إن تعذّرت البصمة — خارج النطاق، تعذّر الموقع، أو عمل ميداني — اكتب السبب وأرسله. المدير يقرّر، والقرار يُسجَّل باسمه."
              : "If the punch failed — outside range, location failed, or field work — write the reason and send it. The manager decides, and the decision is recorded in their name."}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "78px minmax(0,1fr)", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: MUTED }}>{phase === "awaiting_out" ? (ar ? "وقت الانصراف" : "Out time") : (ar ? "وقت الحضور" : "In time")}</span>
            <input
              type="time"
              value={reqTime}
              onChange={(event) => setReqTime(event.target.value)}
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: "7px 8px", border: `1px solid ${BORDER}`, background: "#fff", color: NAVY, outline: "none", width: "100%", boxSizing: "border-box", minWidth: 0 }}
            />
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {reasons.map((item) => {
              const on = reasonLabel === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setReqReason(item)}
                  style={{
                    fontFamily: "inherit",
                    fontSize: 11,
                    padding: "5px 10px",
                    border: `1px solid ${on ? "#14213d" : "#dfe3ea"}`,
                    background: on ? "#14213d" : "#fff",
                    color: on ? "#fff" : "#4b5567",
                    fontWeight: on ? 600 : 400,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <input
            value={reqNote}
            onChange={(event) => { setReqNote(event.target.value); setReqError(""); }}
            placeholder={ar ? "تفصيل السبب — إلزامي" : "Reason detail — required"}
            style={{ fontFamily: "inherit", fontSize: 12, padding: "9px 10px", border: `1px solid ${BORDER}`, background: "#fff", color: NAVY, outline: "none", width: "100%", boxSizing: "border-box" }}
          />
          {reqError ? <span style={{ fontSize: 11, color: "#8a1c2b" }}>{reqError}</span> : null}
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            style={{
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
              padding: "10px 13px",
              border: "none",
              background: canSend ? "#137a49" : "#8a6516",
              color: "#fff",
              cursor: canSend ? "pointer" : "default",
              textAlign: "center",
            }}
          >
            {canSend
              ? (ar ? "أرسل الطلب للمدير" : "Send to the manager")
              : !timeReady
                ? (phase === "awaiting_out" ? (ar ? "حدد وقت الانصراف." : "Set the checkout time.") : (ar ? "حدد وقت الحضور." : "Set the check-in time."))
                : (ar ? "اكتب تفصيل السبب أولاً" : "Write the reason first")}
          </button>
        </div>
      )}
    </div>
  );
}
