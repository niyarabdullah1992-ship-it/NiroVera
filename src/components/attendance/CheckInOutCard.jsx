
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { getTodaysShift, isAttendancePolicyError, isForgottenCheckout, isLocationRequired } from "@/lib/attendance";
import { checkCheckInLeaveGate } from "@/lib/attendanceGate";
import { isStatutoryOffDay } from "@/lib/leaveTypes";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
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

const STATUS_PILL = {
  present: { bg: "var(--nv-accent-soft)", fg: "#15803D", bd: "#BBF7D0", ar: "حاضر", en: "Present" },
  late: { bg: "var(--tint-amber-bg)", fg: "var(--tint-amber-fg)", bd: "var(--nv-warn-line)", ar: "متأخر", en: "Late" },
  absent: { bg: "var(--nv-bad-soft)", fg: "var(--nv-bad-ink)", bd: "var(--nv-bad-line)", ar: "غائب", en: "Absent" },
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
export default function CheckInOutCard({ currentUser, company, t, onStatusChange, compact = false, manualAsk = 0 }) {
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
  const [manualOpen, setManualOpen] = useState(false);

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

  useEffect(() => {
    if (manualAsk) setManualOpen(true);
  }, [manualAsk]);

  const scheduleBlocks = !shift;
  const onLeaveToday = !!isStatutoryOffDay(currentUser, toRiyadhDateKey(), laborCalendarOf(data));
  const statusPill = attendance?.status ? STATUS_PILL[attendance.status] : null;
  const elapsed = useMemo(
    () => elapsedLabel(attendance?.check_in_at, lang),
    [attendance?.check_in_at, lang, tick],
  );

  const punch = async (action) => {
    if (action === "in") {
      const leaveGate = checkCheckInLeaveGate(currentUser, toRiyadhDateKey(), laborCalendarOf(data));
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
  const punchBlocked = loading || (phase === "awaiting_in" && (scheduleBlocks || onLeaveToday)) || phase === "done";

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
          borderRadius: 14,
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
          {error && <p style={{ margin: 0, fontSize: 11, color: "var(--nv-bad-ink)", flex: "1 1 100%" }}>{error}</p>}
          {phase === "awaiting_in" && punchButton("in", ar ? "حضر" : "Present")}
          {phase === "awaiting_out" && punchButton("out", ar ? "انصرف" : "Out")}
        </div>
      </section>
    );
  }

  const station = (data?.stations || []).find((row) => row.id === (scheduledStationId || punchStationId));
  const radius = station?.radiusMeters != null ? Math.round(Number(station.radiusMeters)) : null;
  const loc = attendance?.location_status || attendance?.locationStatus || "";
  const dist = attendance?.distance_meters ?? attendance?.distanceMeters;
  const inside = loc === "inside";
  const outside = loc === "outside" || locationFailed;
  const shade = shift?.outdoor === true
    ? (ar ? "موقع مكشوف" : "Exposed site")
    : shift?.outdoor === false
      ? (ar ? "موقع مظلّل" : "Shaded site")
      : "";
  const siteLine = [station?.name || "—", shade].filter(Boolean).join(" · ");
  const startClock = toWesternDigits(shift?.start || "—");
  const endClock = toWesternDigits(shift?.end || "—");
  const pvDate = new Date(tick).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const shiftLine = shift
    ? `${shift.label || (ar ? "وردية" : "Shift")} · \u2066${startClock}–${endClock}\u2069`
    : (ar ? "لا وردية منشورة" : "No published shift");
  const band = breakBand(shift);
  const worked = workedClock(attendance?.check_in_at, attendance?.check_out_at, tick, band);
  const targetLabel = band?.targetLabel || "8:00";
  const dayPct = Math.min(100, Math.round((worked.minutes / (band?.targetMin || 480)) * 100));
  const inn = phase !== "awaiting_in";
  const done = phase === "done";
  const statusText = onLeaveToday && !inn
    ? (ar ? "إجازة معتمدة اليوم" : "Approved leave today")
    : !shift && !inn
      ? (ar ? "لا وردية منشورة — لا بصمة" : "No published shift — no punch")
      : !inn
        ? (ar ? "لم تسجّل حضورك بعد" : "Not checked in yet")
        : isLate
          ? (ar ? `حضرت متأخراً ${lateMinutes || "—"} دقيقة — يُحسب من الجدول المنشور` : `Late by ${lateMinutes || "—"} min — measured from the published rota`)
          : done
            ? (ar ? `اكتمل اليوم · ${worked.label}` : `Day complete · ${worked.label}`)
            : (ar ? "حضرت في الوقت" : "Checked in on time");
  const statusColor = (!inn || (onLeaveToday && !inn))
    ? "var(--nv-muted)"
    : isLate
      ? "var(--nv-warn-ink)"
      : "var(--nv-ok-ink)";
  const orbLabel = loading
    ? (ar ? "جارٍ التسجيل…" : "Saving…")
    : !inn
      ? (ar ? "حضر" : "In")
      : !done
        ? (ar ? "انصرف" : "Out")
        : (ar ? "اكتمل اليوم ✓" : "Day complete ✓");
  const orbSub = !inn
    ? (ar ? `تبدأ ورديتك ${startClock}` : `Shift starts ${startClock}`)
    : !done
      ? (ar ? `تنتهي ورديتك ${endClock}` : `Shift ends ${endClock}`)
      : (ar ? "سُجّل اليوم كاملاً" : "Today is on file");
  const orbStyle = done
    ? { background: "var(--nv-ok-soft, #E6F2EA)", color: "var(--nv-ok-ink, #2F6B43)", boxShadow: "0 0 0 10px var(--nv-soft, #F2F5F3)" }
    : !inn
      ? { background: "var(--nv-accent, #3C7D50)", color: "#fff", boxShadow: "0 0 0 10px var(--nv-ok-soft, #E6F2EA), 0 12px 28px rgba(60,125,80,.28)" }
      : { background: "var(--nv-navy, #0B3D27)", color: "#fff", boxShadow: "0 0 0 10px var(--nv-warn-soft, #FBF3E1), 0 12px 28px rgba(11,61,39,.28)" };
  const rangeChip = !isLocationRequired(settings)
    ? null
    : outside
      ? { ok: false, t: ar ? `خارج نطاق الفرع${radius ? ` · ${radius} م` : ""}` : `Outside range${radius ? ` · ${radius} m` : ""}` }
      : inside
        ? { ok: true, t: ar ? `داخل نطاق الفرع · ${dist != null ? `${Math.round(Number(dist))} م` : (radius ? `${radius} م` : "—")}` : `Inside range · ${dist != null ? `${Math.round(Number(dist))} m` : (radius ? `${radius} m` : "—")}` }
        : { ok: false, wait: true, t: ar ? `نطاق الفرع${radius ? ` · ${radius} م` : ""}` : `Station range${radius ? ` · ${radius} m` : ""}` };
  const checks = [
    shift
      ? { ok: true, t: ar ? "الوردية منشورة" : "Shift published" }
      : { ok: false, t: ar ? "لا وردية منشورة" : "No published shift" },
    rangeChip,
    isLocationRequired(settings)
      ? (locationFailed
        ? { ok: false, t: ar ? "تعذّر موقع الجهاز" : "Device location failed" }
        : { ok: inside || outside, wait: !inside && !outside, t: ar ? "موقع الجهاز" : "Device location" })
      : null,
  ].filter(Boolean);

  return (
    <section
      style={{
        border: `1px solid ${BORDER}`,
        background: CARD,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        borderRadius: 14,
      }}
      dir={ar ? "rtl" : "ltr"}
      className="nv-att-card"
      data-testid="check-in-out-card"
    >
      <header style={{ background: "linear-gradient(135deg,#0B3D27,#0F5535)", color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "#A9CDB8", fontWeight: 600 }}>{pvDate}</span>
          <strong style={{ fontSize: 16 }}>{shiftLine}</strong>
          <span style={{ fontSize: 11.5, color: "#C5DBCD" }}>{siteLine}</span>
        </div>
        <strong dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 30, letterSpacing: ".02em" }}>{clockLabel}</strong>
      </header>
      <div style={{ padding: "22px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <button
          type="button"
          className="nv-att-punch-orb"
          onClick={() => { if (phase === "awaiting_in") punch("in"); else if (phase === "awaiting_out") punch("out"); }}
          disabled={punchBlocked}
          style={{
            fontFamily: "inherit",
            border: "none",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            cursor: punchBlocked ? "default" : "pointer",
            opacity: punchBlocked && !done ? 0.55 : 1,
            ...orbStyle,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, whiteSpace: "nowrap" }}>{orbSub}</span>
          <strong style={{ fontSize: 22 }}>{orbLabel}</strong>
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: statusColor, textAlign: "center" }}>{statusText}</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {checks.map((chip) => (
            <span
              key={chip.t}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 26,
                padding: "0 10px",
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 600,
                whiteSpace: "nowrap",
                background: chip.ok ? "var(--nv-ok-soft, #E6F2EA)" : chip.wait ? "var(--nv-soft)" : "var(--nv-bad-soft, #FBEBED)",
                color: chip.ok ? "var(--nv-ok-ink, #2F6B43)" : chip.wait ? "var(--nv-muted)" : "var(--nv-bad-ink, #9B2335)",
                border: `1px solid ${chip.ok ? "var(--nv-ok-line)" : chip.wait ? "var(--nv-line)" : "var(--nv-bad-line)"}`,
              }}
            >
              <span>{chip.ok ? "✓" : chip.wait ? "—" : "✕"}</span>
              {chip.t}
            </span>
          ))}
        </div>
        {forgotten ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-warn-ink)", textAlign: "center" }}>
            {ar ? "انصراف منسي — أُحيل إلى مديرك. السجل يبقى مفتوحاً حتى يضع وقت الانصراف." : "Forgotten checkout — sent to your manager. The register stays open until they set the time."}
          </span>
        ) : null}
        {error ? <span style={{ fontSize: 12, color: "var(--nv-bad-ink)", textAlign: "center", lineHeight: 1.7 }}>{error}</span> : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderTop: "1px solid var(--nv-line2, #EEF1EF)" }}>
        {[
          [ar ? "الحضور" : "In", inn ? inTime : "—", ar ? `الجدول ${startClock}` : `Rota ${startClock}`],
          [ar ? "الانصراف" : "Out", done ? outTime : "—", ar ? `الجدول ${endClock}` : `Rota ${endClock}`],
          [ar ? "المنجز" : "Worked", inn ? worked.label : "—", ar ? `من ${targetLabel}` : `of ${targetLabel}`],
        ].map((cell) => (
          <div key={cell[0]} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "12px 16px", borderInlineStart: "1px solid var(--nv-line2, #EEF1EF)" }}>
            <span style={{ fontSize: 11, color: MUTED }}>{cell[0]}</span>
            <strong dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, textAlign: "start", color: "var(--nv-ink)" }}>{cell[1]}</strong>
            <span style={{ fontSize: 10.5, color: "var(--nv-ink3, var(--nv-muted))" }}>{cell[2]}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 20px 16px", display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--nv-line2, #EEF1EF)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: MUTED }}>
          <span>{ar ? "ساعات اليوم" : "Today"}</span>
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{inn ? worked.label : "0:00"} / {targetLabel}</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--nv-line2, #EEF1EF)", overflow: "hidden", position: "relative" }}>
          <div style={{ height: "100%", width: `${inn ? dayPct : 0}%`, background: done ? "var(--nv-ok-fill, #3C7D50)" : "var(--nv-warn-fill, #C8A45A)", borderRadius: 999 }} />
          {band?.label ? (
            <span
              title={ar ? `راحة ${band.label}` : `Break ${band.label}`}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                insetInlineStart: `${band.leftPct}%`,
                width: `${band.widthPct}%`,
                background: "repeating-linear-gradient(45deg,#C8A45A 0 3px,transparent 3px 6px)",
                opacity: 0.85,
              }}
            />
          ) : null}
        </div>
        <span style={{ fontSize: 10.5, color: "var(--nv-ink3, var(--nv-muted))" }}>
          {band?.label
            ? (ar ? `الشريط المخطّط: راحة ${band.label} (المادة 101)` : `Hatched band: break ${band.label} (Art. 101)`)
            : (ar ? "راحة الوردية تُخصم من المنجز — المادة 101" : "Shift rest is excluded from worked time — Art. 101")}
        </span>
        <button
          type="button"
          onClick={() => setManualOpen((open) => !open)}
          style={{
            marginTop: 4,
            alignSelf: "flex-start",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--nv-ok-ink, #2F6B43)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {ar ? "نسيت البصمة؟ اطلب تسجيل حضور يدوي ←" : "Missed the punch? Ask for a manual record →"}
        </button>
        {manualOpen ? (
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
        ) : null}
      </div>
    </section>
  );
}

function parseHm(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function breakBand(shift) {
  const start = parseHm(shift?.start);
  const end = parseHm(shift?.end);
  if (start == null || end == null) return null;
  let span = end - start;
  if (span <= 0) span += 1440;
  const rest = shift?.restMinutes == null ? (span > 5 * 60 ? 30 : 0) : Math.max(0, Number(shift.restMinutes) || 0);
  if (!rest || span <= 5 * 60) {
    return { leftPct: 0, widthPct: 0, label: "", targetMin: span, targetLabel: `${Math.floor(span / 60)}:${String(span % 60).padStart(2, "0")}` };
  }
  const offset = Math.round((span - rest) / 2);
  const fmt = (mins) => {
    const clock = (start + mins) % 1440;
    return `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
  };
  return {
    leftPct: (offset / span) * 100,
    widthPct: (rest / span) * 100,
    label: `${fmt(offset)}–${fmt(offset + rest)}`,
    rest,
    start,
    offset,
    targetMin: span,
    targetLabel: `${Math.floor(span / 60)}:${String(span % 60).padStart(2, "0")}`,
  };
}

function workedClock(checkIn, checkOut, now, band) {
  if (!checkIn) return { label: "0:00", minutes: 0 };
  const start = new Date(checkIn).getTime();
  const end = checkOut ? new Date(checkOut).getTime() : now;
  let minutes = Math.max(0, Math.round((end - start) / 60000));
  if (band?.rest) {
    const inMin = new Date(checkIn).getHours() * 60 + new Date(checkIn).getMinutes();
    const outDate = checkOut ? new Date(checkOut) : new Date(now);
    const outMin = outDate.getHours() * 60 + outDate.getMinutes() + (outDate.getDate() !== new Date(checkIn).getDate() ? 1440 : 0);
    const breakStart = band.start + band.offset;
    const breakEnd = breakStart + band.rest;
    const overlap = Math.max(0, Math.min(outMin, breakEnd) - Math.max(inMin, breakStart));
    minutes = Math.max(0, minutes - overlap);
  }
  return { label: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`, minutes };
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
        <span style={{ fontSize: 11, color: "var(--nv-bad-ink)", lineHeight: 1.85 }}>
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
            color: pending ? "#8a6516" : (latest.status === "approved" ? "var(--nv-ok-ink)" : "var(--nv-bad-ink)"),
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
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: "7px 8px", border: `1px solid ${BORDER}`, background: "var(--nv-card)", color: NAVY, outline: "none", width: "100%", boxSizing: "border-box", minWidth: 0 }}
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
                    border: `1px solid ${on ? "var(--nv-btn-fill)" : "var(--nv-line)"}`,
                    background: on ? "var(--nv-btn-fill)" : "var(--nv-card)",
                    color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)",
                    fontWeight: on ? 600 : 400,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    borderRadius: 10,
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
            style={{ fontFamily: "inherit", fontSize: 12, padding: "9px 10px", border: `1px solid ${BORDER}`, background: "var(--nv-card)", color: NAVY, outline: "none", width: "100%", boxSizing: "border-box" }}
          />
          {reqError ? <span style={{ fontSize: 11, color: "var(--nv-bad-ink)" }}>{reqError}</span> : null}
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
              background: canSend ? "var(--nv-btn-fill)" : "#8a6516",
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
