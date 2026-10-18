
import { checkEarlyCheckInGate, checkLateCheckInGate, checkSelfCheckoutGate, dutyClockMinutes, dutyDayOf, earlyCheckInMinutes, earlyLeaveMinutesOf, getShiftOnDate, isOvernightShift, lateMinutesFromScheduledStart, overnightClosedLinger, previousDateKey, riyadhMinutesOf } from "@/lib/attendanceDerivations";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { getTodaysShift, isAttendancePolicyError, isForgottenCheckout, isLocationRequired } from "@/lib/attendance";
import { checkCheckInLeaveGate } from "@/lib/attendanceGate";
import LeaveCutOffer from "@/components/attendance/LeaveCutOffer";
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
  localBreakPunch,
  localCheckIn,
  localCheckOut,
} from "@/lib/localAttendanceFallback";
import { BORDER, CARD, MUTED, NAVY, SURFACE, ui } from "@/lib/platformStyles";
import { closeAttendanceDay, setRestPlan, submitOtherRequest } from "@/lib/store";
import RestPlanPicker from "@/components/attendance/RestPlanPicker";
import { checkSubmitOtherRequestGate } from "@/lib/otherRequestDerivations";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { parsePunchClock, riyadhNowClock } from "@/lib/attendancePunch";
import { dutyTone } from "@/components/schedules/dutyStatus";
import RightHint from "@/components/shared/RightHint";
import { attRightHint } from "@/lib/rightHints.att.js";
import { citeRule, isRamadanDay, ruleValue } from "@/lib/laborRules";
import NvIcon from "@/components/shared/NvIcon";
import { employeeShiftOnDay, isWeekDayPublished, prayerBreakHint, prayersInShift, rosterBreakWindows, sunExposureMark, SUN_FIELD, SUN_OFFICE } from "@/lib/shiftWeek";
import { heatBanClockState, heatBanWindow, isHeatBanDate } from "@/lib/contractLawDerivations";
import { stationPrayerTimes } from "@/lib/prayerTimes";
import { deriveDutyAlerts, minutesAr } from "@/lib/dutyAlerts";
import { breakClockOf, countdownLabel, dutyContextOf } from "@/lib/dutyTicker";
import { autoOvertimeLine } from "@/lib/autoOvertime";
import { punchClockMinutes, resolveDayBreaks } from "@/lib/actualDuty";
import { nursingCreditOf, nursingHourOn, nursingWindowsOf } from "@/lib/dutyRequests";
import { checkFlexBreakPunchGate, checkRestPlanGate } from "@/lib/shiftDerivations";
import { hoursPolicyOf } from "@/lib/laborHoursPolicy";

const STATUS_PILL = {
  present: { bg: "var(--nv-accent-soft)", fg: "#15803D", bd: "#BBF7D0", ar: "حاضر", en: "Present" },
  late: { bg: "var(--tint-amber-bg)", fg: "var(--tint-amber-fg)", bd: "var(--nv-warn-line)", ar: "متأخر", en: "Late" },
  absent: { bg: "var(--nv-bad-soft)", fg: "var(--nv-bad-ink)", bd: "var(--nv-bad-line)", ar: "غائب", en: "Absent" },
};

/** A punch instant as a clock on the Riyadh time zone — the punch's own clock, never the device's. */
function riyadhTime(iso, format, locale) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return formatTime(iso, format, locale);
  return at.toLocaleTimeString(locale || undefined, { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hourCycle: format === "12" ? "h12" : "h23" });
}

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
export default function CheckInOutCard({ currentUser, company, t, onStatusChange, compact = false, manualAsk = 0, dockOnPhone = false }) {
  const { data, refresh } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { format } = useTimeFormat();
  const local = isLocalPreviewActive();
  // The duty day: today, or last night's overnight shift after midnight — open, not punched yet
  // (a late check-in lands on its own date), or just checked out (the closed day, not «لا وردية»).
  const dutyNow = dutyDayOf(data, currentUser, new Date(), null, { includeClosed: true });
  const baseShift = dutyNow.shift;
  const defaultStationId = data?.stations?.[0]?.id || null;
  const scheduledStationId = baseShift?.stationId || currentUser?.stationId || defaultStationId;
  const [punchStationId, setPunchStationId] = useState(scheduledStationId || "");
  const [reqTime, setReqTime] = useState(() => riyadhNowClock());
  const [reqReason, setReqReason] = useState("");
  const [reqNote, setReqNote] = useState("");
  const [reqError, setReqError] = useState("");
  const assignedStationIds = [scheduledStationId, punchStationId, ...(currentUser?.managedStations || [])].filter(Boolean);
  const hasAssignedStation = assignedStationIds.some((id) => data?.stations?.some((station) => station.id === id));
  const [settings, setSettings] = useState(local ? localAttendanceSettings() : null);
  const [attendance, setAttendance] = useState(null);
  // The cloud answers with the duty-day row; after midnight that may be yesterday's open overnight one,
  // or — right after its checkout — that closed night (overnightClosedLinger, the local reading).
  const attDay = String(attendance?.date || "").slice(0, 10);
  const todayKeyNow = toRiyadhDateKey();
  const attShift = attDay && attDay !== dutyNow.dateKey ? getShiftOnDate(data, currentUser, attDay) : null;
  const cloudCarry = !!attShift && !!attendance?.check_in_at && isOvernightShift(attShift)
    && (!attendance?.check_out_at || (attDay === previousDateKey(todayKeyNow) && overnightClosedLinger({
      yesterdayRow: attendance,
      yesterdayShift: attShift,
      todayShift: getShiftOnDate(data, currentUser, todayKeyNow),
      nowMin: riyadhMinutesOf(new Date()),
      earlyWindowMin: earlyCheckInMinutes(data),
      today: todayKeyNow,
    })));
  const shift = cloudCarry ? getShiftOnDate(data, currentUser, attDay) : baseShift;
  const dutyDateKey = cloudCarry ? attDay : dutyNow.dateKey;
  const [confirmOut, setConfirmOut] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [leaveCut, setLeaveCut] = useState(false);
  const [localMode, setLocalMode] = useState(local);
  const [tick, setTick] = useState(Date.now());
  const [manualOpen, setManualOpen] = useState(false);
  const [dockBottom, setDockBottom] = useState(0);

  /** Phone dock sits above the bottom tab bar when one is shown (it already pads the safe area). */
  useEffect(() => {
    if (!dockOnPhone || typeof window === "undefined") return undefined;
    const measure = () => {
      const nav = document.querySelector(".tech-bottom-nav");
      const rect = nav ? nav.getBoundingClientRect() : null;
      setDockBottom(rect && rect.height > 0 && getComputedStyle(nav).display !== "none" ? Math.round(rect.height) : 0);
    };
    measure();
    const late = window.setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(late);
      window.removeEventListener("resize", measure);
    };
  }, [dockOnPhone]);

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
  const offDay = isStatutoryOffDay(currentUser, dutyDateKey, laborCalendarOf(data));
  // An official holiday blocks only when nothing is rostered: rostered holiday work is punched,
  // and every hour of it is overtime (Art. 107(3)). Approved leave always blocks.
  const onLeaveToday = !!offDay && (offDay.kind === "approved" || !shift);
  const onApprovedLeave = offDay?.kind === "approved";
  const statusPill = attendance?.status ? STATUS_PILL[attendance.status === "late" && nursingExcusedLate(currentUser, data, attendance, shift) ? "present" : attendance.status] : null;
  const elapsed = useMemo(
    () => elapsedLabel(attendance?.check_in_at, lang),
    [attendance?.check_in_at, lang, tick],
  );

  const punch = async (action) => {
    if (action === "in") {
      const leaveGate = checkCheckInLeaveGate(currentUser, dutyDateKey, laborCalendarOf(data));
      if (!leaveGate.ok) {
        setError(ar ? leaveGate.reason : leaveGate.reasonEn);
        setLeaveCut(leaveGate.error === "ON_APPROVED_LEAVE");
        return;
      }
      setLeaveCut(false);
      if (scheduleBlocks) {
        setError(ar ? "لا يمكنك تسجيل الحضور لأنك غير مدرج في جدول اليوم." : "You cannot check in because you are not scheduled today.");
        return;
      }
      // The check-in opens a set time before the published shift (policy, default 60 min) — on the
      // Riyadh clock of the duty day (after midnight of an overnight shift: +1440), never the device's.
      const dutyMin = dutyClockMinutes(dutyDateKey, new Date());
      if (closedDay) {
        setError(ar ? "انتهت ورديتك — يومك مسجّل." : "Your shift is over — the day is on file.");
        return;
      }
      const early = checkEarlyCheckInGate(shift, dutyMin, earlyCheckInMinutes(data));
      if (!early.ok) {
        setError(ar ? early.reason : early.reasonEn);
        return;
      }
      // After the shift has ended the self check-in is closed — the day is a manual entry.
      const lateGate = checkLateCheckInGate(shift, dutyMin);
      if (!lateGate.ok) {
        setError(ar ? lateGate.reason : lateGate.reasonEn);
        setManualOpen(true);
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
              ...(assumedAtCheckout() ? { assumedBreak: assumedAtCheckout() } : {}),
            }),
      });
      const att = res?.data?.attendance;
      if (att) {
        setAttendance(att);
        onStatusChange?.(att);
        window.dispatchEvent(new CustomEvent("attendance-updated", { detail: att }));
        // The day closed: its overtime is recorded automatically (Art. 107), on the server's week count.
        if (action === "out" && company?.id) {
          try {
            closeAttendanceDay(company.id, currentUser.id, String(att.date || toRiyadhDateKey()).slice(0, 10), {
              row: att,
              weekPriorOrdinaryMinutes: res?.data?.overtime?.weekPriorOrdinaryMinutes ?? null,
            });
            await refresh?.();
          } catch { /* best-effort; the checkout is saved */ }
        }
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
      // A gate that names its reason (TOO_EARLY, the late check-in gate, …) is shown in its own words.
      const payload = err?.response?.data || {};
      const named = ar ? (err?.reason || payload.reason) : (err?.reasonEn || payload.reasonEn);
      if (named) { setError(named); return; }
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

  const locationFailed = /OUTSIDE_STATION|GPS_REQUIRED|STATION_LOCATION|location|موقع|النطاق/i.test(error || "");
  const forgotten = isForgottenCheckout(shift, attendance, tick);
  const inTime = attendance?.check_in_at ? toWesternDigits(riyadhTime(attendance.check_in_at, format, "en-GB")) : "—";
  const outTime = attendance?.check_out_at ? toWesternDigits(riyadhTime(attendance.check_out_at, format, "en-GB")) : "—";
  // Art. 154: arriving inside her nursing minutes at the start is on time — read from the punch clock,
  // so a row stored before the excuse (late) and one stored after it (present) read the same.
  const nursingEmployee = (data?.employees || []).find((row) => String(row.id) === String(currentUser?.id)) || currentUser;
  const nursingToday = shift ? nursingHourOn(nursingEmployee, String(attendance?.date || dutyDateKey).slice(0, 10)) : null;
  const shiftStartMin = shift?.start ? punchClockMinutes(shift.start) : null;
  const shiftEndMin = shift?.end && shiftStartMin != null ? (() => { const e = punchClockMinutes(shift.end); return e <= shiftStartMin ? e + 1440 : e; })() : null;
  const inClockMin = attendance?.check_in_at ? punchClockMinutes(attendance.check_in_at) : null;
  const storedLate = Number(attendance?.late_minutes || attendance?.lateMinutes || 0);
  const afterStart = nursingToday?.startMinutes && inClockMin != null && shiftStartMin != null ? Math.max(0, inClockMin - shiftStartMin) : 0;
  const inNursing = !!nursingToday?.startMinutes && afterStart > 0 && afterStart <= nursingToday.startMinutes;
  const lateMinutes = nursingToday?.startMinutes && inClockMin != null && shiftStartMin != null
    ? Math.max(0, afterStart - nursingToday.startMinutes)
    : storedLate;
  const isLate = !inNursing && (lateMinutes > 0 || (attendance?.status === "late" && !nursingToday?.startMinutes));
  // Before the check-in window the orb is closed and says when it opens — not a live button that refuses.
  // Read on the duty day's Riyadh clock (dutyClockMinutes), never the device's.
  const tickMin = dutyClockMinutes(dutyDateKey, new Date(tick));
  const earlyGate = phase === "awaiting_in" && shift
    ? checkEarlyCheckInGate(shift, tickMin, earlyCheckInMinutes(data))
    : { ok: true };
  // After the shift (+ the forgotten hour) the self check-in is closed and points to the manual request.
  const lateInGate = phase === "awaiting_in" && shift
    ? checkLateCheckInGate(shift, tickMin)
    : { ok: true };
  // A just-closed overnight day whose row this card does not hold (cloud reload): calm, never a new punch.
  const closedDay = !!dutyNow.closed && !cloudCarry && phase === "awaiting_in";
  // Not checked in past the start + grace: the lateness so far, said before the punch (deriveActualDuty's reading).
  const lateSoFar = phase === "awaiting_in" && shift?.start && !closedDay && earlyGate.ok && lateInGate.ok
    ? lateMinutesFromScheduledStart(tickMin, shift.start, ruleValue("hours.grace.minutes", dutyDateKey), nursingToday?.startMinutes || 0).lateMinutes
    : 0;
  // The self checkout: closed while a «تثبيت الانصراف» request waits; early or forgotten asks once.
  const pendingFixRow = phase === "awaiting_out"
    ? ((data?.employees || []).find((row) => String(row.id) === String(currentUser?.id))?.otherRequests || [])
      .find((row) => row?.type === "checkout_fix" && (row.status || "pending") === "pending" && (!row.date || String(row.date).slice(0, 10) === (attDay || dutyDateKey)))
    : null;
  const outGate = phase === "awaiting_out"
    ? checkSelfCheckoutGate({
      shift,
      attendance,
      now: tick,
      pendingFix: pendingFixRow ? { time: pendingFixRow.time || String(pendingFixRow.reason || "").slice(0, 5) } : null,
      nursingEndMinutes: nursingToday?.endMinutes || 0,
    })
    : { ok: true, confirm: null };
  const punchBlocked = loading
    || (phase === "awaiting_in" && (scheduleBlocks || onLeaveToday || closedDay || !earlyGate.ok || !lateInGate.ok))
    || (phase === "awaiting_out" && !outGate.ok)
    || phase === "done";
  /** Every punch goes through here: a checkout that is early or past the forgotten hour is confirmed once. */
  const requestPunch = (action) => {
    if (action === "out") {
      const gate = checkSelfCheckoutGate({
        shift,
        attendance,
        now: Date.now(),
        pendingFix: pendingFixRow ? { time: pendingFixRow.time || "" } : null,
        nursingEndMinutes: nursingToday?.endMinutes || 0,
      });
      if (!gate.ok) { setError(ar ? gate.reason : gate.reasonEn); return; }
      if (gate.confirm && !confirmOut) { setConfirmOut(gate.confirm); return; }
    }
    setConfirmOut(null);
    punch(action);
  };
  const confirmBlock = confirmOut && phase === "awaiting_out" ? (
    <div data-confirm-out={confirmOut.kind} role="alertdialog" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 300, padding: "10px 12px", border: "1px solid var(--nv-warn-line)", background: "var(--nv-warn-soft)", borderRadius: 10, fontSize: 12, lineHeight: 1.7, color: "var(--nv-ink)" }}>
      <span>
        {confirmOut.kind === "early"
          ? (ar
            ? <>تنصرف قبل نهاية ورديتك بـ <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{confirmOut.minutes}</span> دقيقة — يُسجَّل انصرافاً مبكراً يراه مديرك.</>
            : <>You are leaving <span style={{ fontWeight: 700 }}>{confirmOut.minutes}</span> min before your shift ends — it is recorded as an early checkout your manager sees.</>)
          : (ar
            ? <>مرّت <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{confirmOut.minutes}</span> دقيقة على نهاية ورديتك — انصرافك الآن يُحتسب وقتاً إضافياً بانتظار قرار مديرك. إن كنت نسيت البصمة فاطلب تثبيت الانصراف بوقته الصحيح.</>
            : <><span style={{ fontWeight: 700 }}>{confirmOut.minutes}</span> min have passed since your shift ended — checking out now counts as overtime pending your manager. If you forgot to punch, ask to fix the checkout at its real time.</>)}
      </span>
      <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" data-confirm-out-go onClick={() => { setConfirmOut(null); punch("out"); }} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: "none", background: "var(--nv-navy, #0B3D27)", color: "#fff", cursor: "pointer" }}>
          {ar ? "انصرف الآن" : "Check out now"}
        </button>
        {confirmOut.kind === "forgotten" ? (
          <button type="button" onClick={() => { setConfirmOut(null); setManualOpen(true); }} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ok-ink)", cursor: "pointer" }}>
            {ar ? "اطلب تثبيت الانصراف" : "Ask to fix the checkout"}
          </button>
        ) : null}
        <button type="button" onClick={() => setConfirmOut(null)} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink2)", cursor: "pointer" }}>
          {ar ? "ألغِ" : "Cancel"}
        </button>
      </span>
    </div>
  ) : null;

  const punchButton = (action, label) => (
    <button
      type="button"
      onClick={() => requestPunch(action)}
      disabled={loading || (action === "in" && (scheduleBlocks || onLeaveToday || closedDay || !lateInGate.ok)) || (action === "out" && !outGate.ok)}
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

  const dutyDay = dutyDateKey;
  const laborCal = laborCalendarOf(data);
  const dutySchedule = shift ? (data?.schedules || []).find((row) => String(row.stationId) === String(shift.stationId)) : null;
  // The published shift type behind today's assignment: its rest, placed breaks and exposure mark.
  const dutyShift = shift ? { ...(employeeShiftOnDay(dutySchedule, currentUser?.id, dutyDay) || {}), ...shift } : null;
  const dutyEmployee = (data?.employees || []).find((row) => String(row.id) === String(currentUser?.id)) || currentUser;
  const dutyStation = (data?.stations || []).find((row) => String(row.id) === String(shift?.stationId || scheduledStationId));
  const ramadanToday = isRamadanDay(dutyDay, laborCal);
  // The prayer right never disappears for a missing branch field: the branch's pin, else its city, else an
  // approximate Riyadh day that says so (prayerTimes.stationPrayerPlace).
  const prayerStation = dutyStation
    || (data?.stations || []).find((row) => String(row.id) === String(dutyEmployee?.stationId || dutyEmployee?.profile?.workStationId))
    || { id: "_default" };
  const prayerDay = shift ? stationPrayerTimes(prayerStation, dutyDay, { ramadan: ramadanToday }) : null;
  const prayerApprox = prayerDay?.place?.via === "default";
  const prayerPoints = dutyShift ? prayersInShift(dutyShift, prayerDay) : [];
  const exposedToday = dutyShift ? sunExposureMark(dutySchedule, currentUser?.id, dutyDay, dutyShift).mark === SUN_FIELD : false;
  const breakHint = dutyShift ? prayerBreakHint({ shift: dutyShift, onDate: dutyDay, prayers: prayerDay, employee: dutyEmployee, company: data, published: isWeekDayPublished(dutySchedule, dutyDay) }) : null;
  const dutyAlerts = deriveDutyAlerts({
    shift: dutyShift,
    punches: { checkIn: attendance?.check_in_at, checkOut: attendance?.check_out_at, breaks: attendance?.breaks },
    prayers: prayerDay,
    exposed: exposedToday,
    onDate: dutyDay,
    laborCalendar: laborCal,
    ramadan: ramadanToday,
    employee: dutyEmployee,
    company: data,
    now: new Date(tick),
  });
  const currentAlert = dutyAlerts.current;
  // Bell / toast / device notices are sent by the one app-level ticker (Layout → useDutyTicker), on any page.

  // The running break, to the second — the same clock as the header pill (dutyTicker.breakClockOf).
  const breakClock = shift && attendance?.check_in_at && !attendance?.check_out_at
    ? breakClockOf(dutyContextOf({ data, user: currentUser, attendance, now: tick, shift }), tick)
    : null;
  const [secNow, setSecNow] = useState(() => Date.now());
  useEffect(() => {
    if (!breakClock) return undefined;
    const id = window.setInterval(() => setSecNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [!!breakClock, breakClock?.endAt]);
  const breakLeftMs = breakClock ? breakClock.endAt - Math.max(secNow, tick) : 0;
  // The minute the break's end passes, re-read the alerts at once (not on the next 30-s tick).
  useEffect(() => {
    if (!breakClock || breakLeftMs > 0) return;
    setTick(Date.now());
  }, [breakClock?.endAt, breakLeftMs <= 0]);

  // «فعّل تنبيهات الجهاز» — asked only from this explicit button, never automatically.
  const notifySupported = typeof window !== "undefined" && "Notification" in window;
  const [notifyPerm, setNotifyPerm] = useState(() => (notifySupported ? window.Notification.permission : "unsupported"));
  const askDeviceNotify = async () => {
    if (!notifySupported) return;
    try {
      const result = await window.Notification.requestPermission();
      setNotifyPerm(result);
    } catch { /* the browser refused to ask */ }
  };

  // A notice «بدأت راحتي» lands here with focus=break: the button is focused and in view.
  const location = useLocation();
  const breakBtnRef = useRef(null);
  const wantsBreakFocus = new URLSearchParams(location?.search || "").get("focus") === "break";

  // Overtime recorded automatically by the day's close (Art. 107) — one quiet line.
  const otLine = attendance?.check_out_at
    ? autoOvertimeLine(data?.otDecisions?.[`${currentUser?.id}:${String(attendance?.date || dutyDay).slice(0, 10)}`], { ar, onDate: dutyDay })
    : null;

  // «راحة مرنة ببصمة»: the day read from the break punches — the buttons, the timeline and the bar use it.
  const continuous103 = hoursPolicyOf(data, dutyEmployee).continuousWork103 === true;
  // The worker's own rest plan for the day (he places his break where it suits him) — lib/shiftDerivations.
  const restPlan = data?.restPlans?.[`${currentUser?.id}:${dutyDay}`] || null;
  const flexDay = resolveDayBreaks({
    plan: restPlan?.parts || null,
    shift: dutyShift,
    breaks: attendance?.breaks,
    checkIn: attendance?.check_in_at,
    checkOut: attendance?.check_out_at,
    now: new Date(tick),
    onDate: dutyDay,
    prayers: prayerDay,
    company: data,
    employee: dutyEmployee,
  });
  const flexOn = !!flexDay.flex;
  const breakAction = flexDay.open ? "end" : "start";
  const breakGate = flexOn && attendance?.check_in_at && !attendance?.check_out_at
    ? checkFlexBreakPunchGate({ action: breakAction, shift: dutyShift, breaks: attendance?.breaks, checkIn: attendance?.check_in_at, now: new Date(tick), onDate: dutyDay, continuous103 })
    : null;
  useEffect(() => {
    if (!wantsBreakFocus || !breakBtnRef.current) return;
    breakBtnRef.current.scrollIntoView?.({ block: "center", behavior: "smooth" });
    breakBtnRef.current.focus?.({ preventScroll: true });
  }, [wantsBreakFocus, !!breakGate]);
  /** Where the card would place an unpunched break if the day closed now — sent with a cloud checkout. */
  function assumedAtCheckout() {
    if (!flexOn) return null;
    const closing = resolveDayBreaks({ plan: restPlan?.parts || null, shift: dutyShift, breaks: attendance?.breaks, checkIn: attendance?.check_in_at, checkOut: new Date().toISOString(), onDate: dutyDay, prayers: prayerDay, company: data, employee: dutyEmployee });
    return closing.assumed && !closing.punched.length ? { start: closing.assumed.start, end: closing.assumed.end } : null;
  }
  const [breakBusy, setBreakBusy] = useState(false);
  const [breakError, setBreakError] = useState("");
  const breakPunch = async () => {
    if (!breakGate?.ok) return;
    setBreakError("");
    setBreakBusy(true);
    try {
      let att = null;
      if (localMode || isLocalPreviewActive()) {
        att = localBreakPunch(company.id, { employeeId: currentUser.id, action: breakAction });
      } else {
        // The break follows the check-in's location rule — lighter: no station radius, a rest may be off site.
        let coords = null;
        if (isLocationRequired(settings)) {
          coords = await getAccuratePosition();
          if (!coords) {
            setBreakError(t("locationDenied"));
            return;
          }
        }
        const res = await base44.functions.invoke("supabaseAttendance", {
          action: breakAction === "start" ? "breakStart" : "breakEnd",
          companyId: company.id,
          employeeId: currentUser.id,
          ...(coords ? { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy } : {}),
        });
        att = res?.data?.attendance || null;
      }
      if (att) {
        setAttendance(att);
        onStatusChange?.(att);
        window.dispatchEvent(new CustomEvent("attendance-updated", { detail: att }));
      }
      setTick(Date.now());
    } catch (err) {
      const payload = err?.response?.data || {};
      setBreakError((ar ? (err?.reason || payload.reason) : (err?.reasonEn || payload.reasonEn)) || err?.code || payload.error || (ar ? "تعذّر تسجيل الراحة." : "Could not record the break."));
    } finally {
      setBreakBusy(false);
    }
  };

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
              {ar ? "حضور" : "In"} {attendance?.check_in_at ? riyadhTime(attendance.check_in_at, format, lang) : "—"}
              {" · "}
              {ar ? "انصراف" : "Out"} {attendance?.check_out_at ? riyadhTime(attendance.check_out_at, format, lang) : "—"}
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
          {leaveCut || (onApprovedLeave && phase === "awaiting_in") ? <LeaveCutOffer ar={ar} companyId={company?.id} employee={currentUser} onDone={async () => { setError(""); setLeaveCut(false); await refresh?.(); }} /> : null}
          {phase === "awaiting_in" && punchButton("in", ar ? "حضر" : "Present")}
          {phase === "awaiting_out" && punchButton("out", ar ? "انصرف" : "Out")}
          {confirmBlock}
          {phase === "awaiting_out" && !outGate.ok ? <p style={{ margin: 0, fontSize: 11, color: "var(--nv-warn-ink)", flex: "1 1 100%" }}>{ar ? outGate.reason : outGate.reasonEn}</p> : null}
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
  // The station is named once, in the header context line («محطتي») — only the shade note stays here.
  const siteLine = shade || "";
  const startClock = toWesternDigits(shift?.start || "—");
  const endClock = toWesternDigits(shift?.end || "—");
  // The header names the duty day — after midnight an open overnight shift still reads as its start day.
  const pastDuty = !!dutyDateKey && dutyDateKey !== toRiyadhDateKey(new Date(tick));
  const pvDate = new Date(pastDuty ? `${dutyDateKey}T12:00:00+03:00` : tick).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const shiftLine = shift
    ? `${shift.label || (ar ? "وردية" : "Shift")} · \u2066${startClock}–${endClock}\u2069`
    : (ar ? "لا وردية منشورة" : "No published shift");
  const band = breakBand(dutyShift, dutyDay);
  // While the day is open past the shift end, «المنجز اليوم» stops at the end — the rest is unconfirmed
  // until the checkout (or its fix) says otherwise.
  const shiftEndAt = shift?.end && /^\d{4}-\d{2}-\d{2}$/.test(dutyDay)
    ? (() => { const at = new Date(`${dutyDay}T${shift.end}:00+03:00`).getTime(); return isOvernightShift(shift) ? at + 86400000 : at; })()
    : null;
  const openPastEnd = !!attendance?.check_in_at && !attendance?.check_out_at && shiftEndAt != null && tick > shiftEndAt;
  const workedNow = openPastEnd ? shiftEndAt : tick;
  // An early punch is presence, not work — «المنجز اليوم» counts from the published start (same as the OT close).
  const shiftStartAt = shift?.start && /^\d{4}-\d{2}-\d{2}$/.test(dutyDay) ? new Date(`${dutyDay}T${shift.start}:00+03:00`).getTime() : null;
  const inAt = attendance?.check_in_at ? new Date(attendance.check_in_at).getTime() : null;
  const workFrom = inAt != null && shiftStartAt != null && inAt < shiftStartAt && shiftStartAt - inAt <= 720 * 60000
    ? new Date(shiftStartAt).toISOString()
    : attendance?.check_in_at;
  const workedRaw = workedClock(workFrom, attendance?.check_out_at, workedNow, band, flexOn ? flexDay : null);
  // Art. 154: the nursing minutes she was away for count as work — the start part from the check-in,
  // the end and middle parts once the day closes. Never overtime (the day's close reads the punches).
  const outClockMin = attendance?.check_out_at ? punchClockMinutes(attendance.check_out_at) : null;
  const nursingCredit = nursingToday && inClockMin != null && shiftStartMin != null && shiftEndMin != null
    ? nursingCreditOf(nursingToday, {
      inMinutes: inClockMin,
      outMinutes: outClockMin == null ? shiftEndMin : (outClockMin < inClockMin ? outClockMin + 1440 : outClockMin),
      shiftStart: shiftStartMin,
      shiftEnd: shiftEndMin,
      workedMinutes: outClockMin == null ? Infinity : workedRaw.minutes,
      rosteredMinutes: Math.max(0, (band?.targetMin || 0) - (band?.rest || 0)),
    })
    : { minutes: 0 };
  const workedMin = workedRaw.minutes + (nursingCredit.minutes || 0);
  const worked = { minutes: workedMin, label: `${Math.floor(workedMin / 60)}:${String(workedMin % 60).padStart(2, "0")}` };
  // «المنجز اليوم» counts work (rest excluded, Art. 102), so its target is the shift less its rest —
  // 07:00–16:00 with a 60-minute break is 8:00 of work, not 9:00. The bar stays a timeline of the
  // shift span (presence so far), with the break bands laid on it.
  const restPlanned = flexOn ? Math.max(0, Number(flexDay.flex?.minutes) || 0) : Math.max(0, Number(band?.rest) || 0);
  const workTargetMin = Math.max(0, (band?.targetMin || 480) - restPlanned);
  const targetLabel = band ? `${Math.floor(workTargetMin / 60)}:${String(workTargetMin % 60).padStart(2, "0")}` : "8:00";
  const presenceMin = attendance?.check_in_at
    ? Math.max(0, Math.round(((attendance?.check_out_at ? new Date(attendance.check_out_at).getTime() : workedNow) - new Date(attendance.check_in_at).getTime()) / 60000))
    : 0;
  const dayPct = Math.min(100, Math.round((presenceMin / (band?.targetMin || 480)) * 100));
  const inn = phase !== "awaiting_in";
  const done = phase === "done";
  // An early checkout is said as such — never «سُجّل اليوم كاملاً».
  const earlyLeftMin = done
    ? earlyLeaveMinutesOf({ shift, checkIn: attendance?.check_in_at, checkOut: attendance?.check_out_at, nursingEndMinutes: nursingToday?.endMinutes || 0 })
    : 0;
  const statusText = onLeaveToday && !inn
    ? (ar ? "إجازة معتمدة اليوم" : "Approved leave today")
    : !shift && !inn
      ? (ar ? "لا وردية منشورة — لا بصمة" : "No published shift — no punch")
      : closedDay
        ? (ar ? "انتهت ورديتك — يومك مسجّل" : "Your shift is over — the day is on file")
        : !inn && lateSoFar > 0
          ? (ar ? `لم تسجّل حضورك — متأخر ${lateSoFar} دقيقة عن ورديتك` : `Not checked in — ${lateSoFar} min late for your shift`)
        : !inn
        ? (ar ? "لم تسجّل حضورك بعد" : "Not checked in yet")
        : isLate
          ? (ar ? `حضرت متأخراً ${lateMinutes || "—"} دقيقة — يُحسب من الجدول المنشور` : `Late by ${lateMinutes || "—"} min — measured from the published rota`)
          : done
            ? (earlyLeftMin > 0
              ? (ar ? `انصرفت مبكراً بـ ${earlyLeftMin} دقيقة · ${worked.label}` : `Left ${earlyLeftMin} min early · ${worked.label}`)
              : (ar ? `اكتمل اليوم · ${worked.label}` : `Day complete · ${worked.label}`))
            : inNursing
              ? (ar ? "حضرت في الوقت — ضمن ساعة الرضاعة" : "On time — inside your nursing hour")
              : (ar ? "حضرت في الوقت" : "Checked in on time");
  const statusColor = !inn && lateSoFar > 0
    ? "var(--nv-warn-ink)"
    : (!inn || (onLeaveToday && !inn))
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
        : <><NvIcon name="check" size={14} /> {ar ? "اكتمل اليوم" : "Day complete"}</>;
  const orbSub = !inn
    ? (onLeaveToday
      ? (ar ? "إجازة اليوم — لا بصمة" : "On leave today — no punch")
      : !shift
        ? (ar ? "لا وردية لك اليوم" : "No shift for you today")
        : closedDay
          ? (ar ? `انتهت ورديتك ${endClock}` : `Shift ended ${endClock}`)
        : !earlyGate.ok
          ? (ar ? `يُفتح الحضور ${earlyGate.opensAt} · ورديتك ${startClock}` : `Opens ${earlyGate.opensAt} · shift ${startClock}`)
          : !lateInGate.ok
            ? (ar ? `انتهت ورديتك ${endClock} — اطلب تسجيلاً يدوياً` : `Shift ended ${endClock} — request a manual entry`)
            : (ar ? `تبدأ ورديتك ${startClock}` : `Shift starts ${startClock}`))
    : !done
      ? (!outGate.ok
        ? (ar ? "بانتظار قرار مديرك" : "Awaiting your manager")
        : (ar ? `تنتهي ورديتك ${endClock}` : `Shift ends ${endClock}`))
      : earlyLeftMin > 0
        ? (ar ? `انصراف مبكر · ${earlyLeftMin} د` : `Early checkout · ${earlyLeftMin} min`)
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

  const toned = (key) => {
    const tone = dutyTone(key);
    return { bg: tone.soft, fg: tone.ink, bd: tone.line };
  };
  const lanePill = onLeaveToday && !inn
    ? { t: ar ? "إجازة" : "On leave", ...toned("leave") }
    : !shift && !inn
      ? { t: ar ? "لا وردية" : "No shift", ...toned("rest") }
      : closedDay
        ? { t: ar ? "انتهت" : "Ended", ...toned("rest") }
      : !inn && lateSoFar > 0
        ? { t: ar ? "متأخر" : "Late", ...toned("warn") }
      : !inn
        ? { t: ar ? "لم تبدأ" : "Not started", ...toned("rest") }
        : !done
          ? (isLate
            ? { t: ar ? "متأخر" : "Late", ...toned("warn") }
            : { t: ar ? "حاضر" : "In", ...toned("ok") })
          : { t: ar ? "انصرفت" : "Checked out", bg: "var(--nv-ok-fill, #3C7D50)", fg: "#fff", bd: "var(--nv-ok-fill, #3C7D50)" };
  const orbReady = !punchBlocked && (phase === "awaiting_in" || phase === "awaiting_out");
  const orbClick = () => { if (phase === "awaiting_in") requestPunch("in"); else if (phase === "awaiting_out") requestPunch("out"); };
  const steps = shift
    ? [
        { key: "start", kind: "plan", label: ar ? "بداية الوردية" : "Shift starts", note: ar ? "من الجدول المنشور" : "From the published rota", value: startClock },
        {
          key: "in",
          kind: "punch",
          state: inn ? (isLate ? "late" : "done") : (phase === "awaiting_in" && !punchBlocked ? "now" : "wait"),
          label: ar ? "بصمة الحضور" : "Check-in",
          note: inn
            ? (isLate
              ? (ar ? `متأخر ${lateMinutes || "—"} دقيقة` : `Late ${lateMinutes || "—"} min`)
              : inNursing
                ? (ar ? "في الوقت — ضمن ساعة الرضاعة" : "On time — inside your nursing hour")
                : (ar ? "في الوقت" : "On time"))
            : lateSoFar > 0
              ? (ar ? `لم تُسجَّل — متأخر ${lateSoFar} دقيقة` : `Not punched — ${lateSoFar} min late`)
              : (ar ? "بانتظار ضغطتك" : "Waiting for your tap"),
          value: inn ? inTime : "—",
          hint: inn && isLate && lateMinutes ? attRightHint("lateness", { date: dutyDateKey, minutes: lateMinutes }, { view: "employee", ar }) : null,
        },
        ...(band?.label
          ? [{ key: "rest", kind: "plan", at: band.start + band.offset, label: ar ? "الراحة" : "Break", note: (() => {
            // Plain words: the rest is not working time (Art. 102), so the day's work is the shift minus it.
            const restMin = Number(band.rest) || 0;
            const hm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
            if (!restMin) return ar ? "لا تُحسب من ساعات عملك" : "Not counted as working time";
            return ar
              ? `${restMin} دقيقة لا تُحسب من ساعات عملك — عملك اليوم ${hm(band.targetMin - restMin)} من ${hm(band.targetMin)}`
              : `${restMin} min not counted as work — your work today is ${hm(band.targetMin - restMin)} of ${hm(band.targetMin)}`;
          })(), sub: breakHint ? (ar ? breakHint.textAr : breakHint.textEn) : "", value: band.label, hint: attRightHint("rest", {}, { view: "employee", ar }) }]
          : []),
        ...(flexOn ? flexSteps(flexDay, { ar, hint: attRightHint("rest", {}, { view: "employee", ar }), plan: restPlan?.parts ? checkRestPlanGate({ shift: dutyShift, onDate: dutyDay, parts: restPlan.parts, continuous103 }) : null }) : []),
        { key: "end", kind: "plan", at: (band?.start ?? 0) + (band?.targetMin ?? 0), label: ar ? "نهاية الوردية" : "Shift ends", note: ar ? "من الجدول المنشور" : "From the published rota", value: endClock },
        {
          key: "out",
          kind: "punch",
          state: done ? "done" : (phase === "awaiting_out" && !punchBlocked ? "now" : "wait"),
          label: ar ? "بصمة الانصراف" : "Check-out",
          note: done
            ? (ar ? `أُغلق اليوم · ${worked.label}` : `Day closed · ${worked.label}`)
            : (inn ? (elapsed || (ar ? "اليوم مفتوح" : "Day open")) : (ar ? "بعد الحضور" : "After check-in")),
          value: done ? outTime : "—",
        },
      ]
    : [];
  // Prayers inside the shift window — quiet points placed by time between the plan steps. Each names its
  // law: the prayer sits inside the Art. 101 rest, and that rest is not working time (Art. 102).
  const restCite = citeRule("hours.rest.duringShiftMinutes", dutyDay);
  const notWorkCite = citeRule("hours.rest.notWorkingHours.cite", dutyDay);
  const consecCite = citeRule("hours.rest.maxConsecutiveHours", dutyDay);
  const lawBadge = (...cites) => {
    const arts = [...new Set(cites.map((c) => c?.article).filter(Boolean))];
    return arts.length ? (ar ? `م ${arts.join(" · ")}` : `Art. ${arts.join(" · ")}`) : "";
  };
  const placeByTime = (point, minutes) => {
    const at = steps.findIndex((step, i) => i > 1 && step.at != null && step.at > minutes);
    if (at < 0) steps.splice(Math.max(2, steps.length - 1), 0, point);
    else steps.splice(at, 0, point);
  };
  for (const p of prayerPoints) {
    placeByTime({
      key: `prayer-${p.key}`,
      kind: "prayer",
      at: p.minutes,
      label: ar ? p.ar : p.en,
      value: p.clock,
      badge: lawBadge(restCite, notWorkCite),
      note: (ar ? "وقت الصلاة من فترة الراحة والصلاة والطعام — لا يُحسب من ساعات العمل" : "Prayer sits in the rest, prayer and meal period — not counted as work")
        + (prayerApprox ? (ar ? " · الوقت تقريبي بتوقيت الرياض حتى تُحدَّد مدينة الفرع" : " · approximate (Riyadh) until the branch city is set") : ""),
      hint: attRightHint("rest", {}, { view: "employee", ar }),
    }, p.minutes);
  }
  // Art. 101: the five-hour mark from the shift start — the rest must begin before it (Art. 103 is exempt).
  const consecMax = Number(ruleValue("hours.rest.maxConsecutiveHours", dutyDay)) || 0;
  const restMin = Number(ruleValue("hours.rest.duringShiftMinutes", dutyDay)) || 0;
  // A saved rest plan is already checked against this limit — the five-hour mark would only repeat it.
  const planHoldsLimit = flexOn && !!restPlan?.parts && checkRestPlanGate({ shift: dutyShift, onDate: dutyDay, parts: restPlan.parts, continuous103 }).ok;
  // The count restarts after every rest already in the day (the roster's fixed break, or the punched parts):
  // a break at 10:45–11:15 on 07:00–15:00 leaves no five-hour stretch, so no mark is shown at all.
  const knownRests = flexOn
    ? (flexDay.punched || []).filter((row) => row.endMin != null).map((row) => ({ start: row.startMin, end: row.endMin }))
    : (dutyShift ? rosterBreakWindows(dutyShift, dutyDay) : []).map((w) => ({ start: (band?.start || 0) + w.from, end: (band?.start || 0) + w.from + w.minutes }));
  let consecFrom = band?.start ?? 0;
  for (const rest of knownRests.sort((a, b) => a.start - b.start)) {
    if (rest.start - consecFrom <= consecMax * 60) consecFrom = Math.max(consecFrom, rest.end);
  }
  const bandEndMin = (band?.start ?? 0) + (band?.targetMin ?? 0);
  if (band && !continuous103 && !planHoldsLimit && consecMax > 0 && consecFrom + consecMax * 60 < bandEndMin) {
    const markAt = consecFrom + consecMax * 60;
    const hh = String(Math.floor((markAt % 1440) / 60)).padStart(2, "0");
    const mm = String(markAt % 60).padStart(2, "0");
    placeByTime({
      key: "limit-5h",
      kind: "limit",
      at: markAt,
      label: ar ? `حد ${consecMax} ساعات متواصلة` : `${consecMax}-hour limit`,
      value: `${hh}:${mm}`,
      badge: lawBadge(consecCite),
      note: ar
        ? (consecFrom > band.start
          ? `لا عمل أكثر من ${consecMax} ساعات متواصلة بعد راحتك — خذ راحة (${restMin} دقيقة على الأقل) قبل هذا الوقت`
          : `لا عمل أكثر من ${consecMax} ساعات متواصلة — تبدأ راحتك (${restMin} دقيقة على الأقل) قبل هذا الوقت`)
        : `No more than ${consecMax} hours in a row — your rest (at least ${restMin} min) starts before this time`,
      hint: attRightHint("rest", {}, { view: "employee", ar }),
    }, markAt);
  }
  // Art. 154: her nursing hour in time order — counted as actual work, no wage cut, until its last day.
  if (nursingToday && band) {
    const nursingCite = citeRule("leave.nursing.dailyMinutes", dutyDay);
    const clockAt = (m) => `${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String((((m % 1440) + 1440) % 1440) % 60).padStart(2, "0")}`;
    const untilTxt = nursingToday.until ? `\u2066${toWesternDigits(nursingToday.until)}\u2069` : "";
    const nursingNote = ar
      ? `تُحسب من ساعات العمل الفعلية ولا يُخصم بها الأجر${untilTxt ? ` — حتى\u00A0${untilTxt}` : ""}`
      : `Counted as actual working time, no wage cut${untilTxt ? ` — until\u00A0${untilTxt}` : ""}`;
    const nursingHint = attRightHint("nursing", { birthDate: nursingEmployee?.profile?.nursingHour?.childBirthDate || "", nurseryOnSite: hoursPolicyOf(data).nurseryOnSite === true }, { view: "employee", ar });
    const parts = nursingWindowsOf(nursingToday, band.start, band.start + band.targetMin);
    if (nursingToday.midMinutes) parts.push({ part: "mid", from: band.start + Math.round(band.targetMin / 2), to: null });
    for (const part of parts) {
      const point = {
        key: `nursing-${part.part}`,
        kind: "nursing",
        at: part.from,
        label: ar
          ? `ساعة الرضاعة${parts.length > 1 ? (part.part === "start" ? " · أول الدوام" : part.part === "end" ? " · آخر الدوام" : " · وسط الدوام") : ""}`
          : `Nursing hour${parts.length > 1 ? ` · ${part.part}` : ""}`,
        value: part.to == null ? (ar ? `${nursingToday.midMinutes} د` : `${nursingToday.midMinutes} min`) : `${clockAt(part.from)}–${clockAt(part.to)}`,
        badge: lawBadge(nursingCite),
        note: nursingNote,
        hint: nursingHint,
      };
      // The start part opens with the shift — it sits before the check-in it covers.
      if (part.part === "start") steps.splice(1, 0, point);
      else placeByTime(point, part.from);
    }
  }

  // Decision 3337: the midday sun ban sits on «مسار اليوم» whenever the shift touches its hours — every day of
  // the year. Outside its season it reads as reference; in season it says what the day's sun mark means and
  // gives the way: refuse exposed work and report it from طلباتي («بلاغ عمل مكشوف»).
  if (band && dutyShift) {
    const win = heatBanWindow(dutyDay);
    const banFrom = win.startHour * 60;
    const banTo = win.endHour * 60;
    const shiftEnd = band.start + (band.spanMin || band.targetMin || 0);
    const touches = [0, 1440].some((d) => Math.min(shiftEnd, d + banTo) > Math.max(band.start, d + banFrom));
    if (touches) {
      const inSeason = isHeatBanDate(dutyDay);
      const sunMark = sunExposureMark(dutySchedule, currentUser?.id, dutyDay, dutyShift).mark;
      const clockState = inSeason ? heatBanClockState({ dayKey: dutyDay, minutes: riyadhMinutesOf(new Date()) }) : "off_season";
      const heatCite = citeRule("hours.heat.startHour", dutyDay);
      let note;
      let tone = "cite";
      let action = null;
      if (!inSeason) {
        note = ar ? `خارج موسمه — يُطبَّق ${win.seasonAr}. لا قيد اليوم.` : `Out of season — it applies ${win.seasonEn}. No limit today.`;
      } else if (sunMark === SUN_FIELD) {
        tone = clockState === "in_window" ? "block" : "alert";
        note = clockState === "in_window"
          ? (ar ? `الآن ساعات الحظر وورديتك «مكشوف» — لا عمل تحت الشمس المباشرة حتى ${win.endLabel}. يحق لك رفض العمل المكشوف والانتقال إلى مكان مظلّل.` : `Ban hours now and your shift is marked exposed — no work in direct sun until ${win.endLabel}. You may refuse exposed work and move to shade.`)
          : (ar ? `ورديتك اليوم «مكشوف» — لا عمل تحت الشمس المباشرة في هذه الساعات. يحق لك رفض العمل المكشوف.` : `Your shift today is marked exposed — no work in direct sun in these hours. You may refuse exposed work.`);
        action = { to: "/app/requests?kind=heat_report", label: ar ? "بلّغ عن عمل مكشوف ›" : "Report exposed work ›" };
      } else if (sunMark === SUN_OFFICE) {
        tone = "ok";
        note = ar ? "يومك «مظلّل» — لا عمل تحت الشمس في هذه الساعات." : "Your day is marked shaded — no sun work in these hours.";
      } else {
        tone = "alert";
        note = ar ? "في موسم الحظر ولم يُحدَّد يومك «مكشوف / مظلّل». إن شُغّلت تحت الشمس في هذه الساعات فبلّغ." : "In the ban season and your day has no exposed/shaded mark. If you are put in the sun in these hours, report it.";
        action = { to: "/app/requests?kind=heat_report", label: ar ? "بلّغ عن عمل مكشوف ›" : "Report exposed work ›" };
      }
      const heatBadge = heatCite?.article ? (ar ? `م ${heatCite.article}` : `Art. ${heatCite.article}`) : (ar ? "القرار 3337" : "Dec. 3337");
      placeByTime({
        key: "heat-ban",
        kind: "heat",
        at: banFrom,
        tone,
        season: inSeason,
        live: clockState === "in_window",
        label: ar ? "بداية حظر الشمس" : "Sun ban starts",
        value: win.startLabel,
        badge: heatBadge,
        note,
        action,
      }, banFrom);
      // The end mark: where the ban lifts — only while the shift is still running then.
      if ([0, 1440].some((d) => shiftEnd >= d + banTo && band.start < d + banTo)) {
        const endNote = !inSeason
          ? (ar ? "خارج موسمه — لا قيد اليوم." : "Out of season — no limit today.")
          : sunMark === SUN_FIELD
            ? (ar ? "ينتهي الحظر — يجوز العمل المكشوف بعده." : "The ban lifts — exposed work is allowed after it.")
            : (ar ? "ينتهي الحظر." : "The ban lifts.");
        placeByTime({
          key: "heat-ban-end",
          kind: "heat",
          at: banTo,
          season: inSeason,
          live: clockState === "in_window",
          tone: !inSeason ? "cite" : (clockState === "after_window" ? "ok" : "cite"),
          label: ar ? "نهاية حظر الشمس" : "Sun ban ends",
          value: win.endLabel,
          badge: heatBadge,
          note: endNote,
        }, banTo - 0.5); // before «نهاية الوردية» when both fall on the same minute
      }
    }
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
        borderRadius: 14,
      }}
      dir={ar ? "rtl" : "ltr"}
      className="nv-att-card nv-punch-hero"
      data-testid="check-in-out-card"
      data-phase={phase}
    >
      <header className="nv-punch-head" style={{ background: "var(--nv-soft, #FAFBFA)", borderBottom: "1px solid var(--nv-line2, #EEF1EF)", color: "var(--nv-ink)", padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 220px" }}>
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)", fontWeight: 600 }}>{pastDuty ? (ar ? `ورديتك · ${pvDate}` : `Your shift · ${pvDate}`) : (ar ? `ورديتك اليوم · ${pvDate}` : `Today's shift · ${pvDate}`)}</span>
          <strong style={{ fontSize: 18, fontFamily: "var(--font-heading)", letterSpacing: 0, color: "var(--nv-ink)" }}>{shiftLine}</strong>
          {siteLine ? <span style={{ fontSize: 12, color: "var(--nv-ink3, var(--nv-muted))" }}>{siteLine}</span> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {/* No clock here: the time is already in the page header. */}
          <span
            data-punch-state
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 24,
              padding: "0 10px",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 700,
              whiteSpace: "nowrap",
              background: lanePill.bg,
              color: lanePill.fg,
              border: `1px solid ${lanePill.bd}`,
            }}
          >
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
            {lanePill.t}
          </span>
        </div>
      </header>

      <div className="nv-punch-body">
        <div className="nv-punch-orb-col" style={{ padding: "26px 20px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, minWidth: 0 }}>
          <button
            type="button"
            className={`nv-att-punch-orb${orbReady ? " is-ready" : ""}`}
            onClick={orbClick}
            disabled={punchBlocked}
            style={{
              fontFamily: "inherit",
              border: "none",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              position: "relative",
              cursor: punchBlocked ? "default" : "pointer",
              opacity: punchBlocked && !done ? 0.55 : 1,
              ...orbStyle,
            }}
          >
            {loading
              ? <Loader2 style={{ width: 22, height: 22, animation: "spin 1s linear infinite" }} />
              : !inn
                ? <LogIn style={{ width: 22, height: 22 }} strokeWidth={1.75} />
                : !done
                  ? <LogOut style={{ width: 22, height: 22 }} strokeWidth={1.75} />
                  : null}
            <strong style={{ fontSize: 24, lineHeight: 1.2 }}>{orbLabel}</strong>
            <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85, whiteSpace: "nowrap" }}>{orbSub}</span>
          </button>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: statusColor, textAlign: "center", lineHeight: 1.6 }}>{statusText}</span>
          {confirmBlock}
          {phase === "awaiting_out" && !outGate.ok ? (
            <span data-out-gate={outGate.error} style={{ fontSize: 11.5, color: "var(--nv-warn-ink)", textAlign: "center", lineHeight: 1.7, maxWidth: 300 }}>{ar ? outGate.reason : outGate.reasonEn}</span>
          ) : null}
          {phase === "awaiting_in" && shift && !lateInGate.ok ? (
            <span data-in-gate={lateInGate.error} style={{ fontSize: 11.5, color: "var(--nv-warn-ink)", textAlign: "center", lineHeight: 1.7, maxWidth: 300 }}>{ar ? lateInGate.reason : lateInGate.reasonEn}</span>
          ) : null}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
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
                <span aria-hidden style={{ display: "inline-flex" }}>{chip.ok ? <NvIcon name="check" size={12} strokeWidth={2} inline={false} /> : chip.wait ? "—" : <NvIcon name="cross" size={12} strokeWidth={2} inline={false} />}</span>
                {chip.t}
              </span>
            ))}
          </div>
          {flexOn && inn && !done ? (
            <BreakPunch
              ar={ar}
              day={flexDay}
              gate={breakGate}
              busy={breakBusy}
              error={breakError}
              onPunch={breakPunch}
              leftMs={breakClock?.kind === "flex" ? breakLeftMs : null}
              buttonRef={breakBtnRef}
            />
          ) : null}
          {breakClock?.kind === "fixed" ? (
            <span data-break-countdown="fixed" style={{ fontSize: 12, color: "var(--nv-ink2)", textAlign: "center" }}>
              {ar ? "راحتك" : "Your break"} <span dir="ltr" style={MONO}>{breakClock.start}–{breakClock.end}</span>
              {" · "}{ar ? "باقٍ" : "left"} <span dir="ltr" style={{ ...MONO, fontWeight: 700 }}>{countdownLabel(Math.max(0, breakLeftMs))}</span>
            </span>
          ) : null}
          {inn && !done && shift && notifySupported && notifyPerm === "default" ? (
            <button
              type="button"
              data-device-notify="ask"
              onClick={askDeviceNotify}
              style={{ fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: "var(--nv-ok-ink)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              {ar ? "فعّل تنبيهات الجهاز ›" : "Turn on device alerts ›"}
            </button>
          ) : null}
          {forgotten ? (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-warn-ink)", textAlign: "center", lineHeight: 1.7 }}>
              {ar ? "انصراف منسي — أُحيل إلى مديرك. السجل يبقى مفتوحاً حتى يضع وقت الانصراف." : "Forgotten checkout — sent to your manager. The register stays open until they set the time."}
            </span>
          ) : null}
          {error ? <span style={{ fontSize: 12, color: "var(--nv-bad-ink)", textAlign: "center", lineHeight: 1.7 }}>{error}</span> : null}
          {onApprovedLeave && !inn ? <LeaveCutOffer ar={ar} companyId={company?.id} employee={currentUser} onDone={async () => { setError(""); setLeaveCut(false); await refresh?.(); }} /> : null}
        </div>

        <div className="nv-punch-day" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <strong style={{ fontSize: 14, fontWeight: 700, color: "var(--nv-ink)", letterSpacing: 0 }}>{ar ? "مسار اليوم" : "Today's timeline"}</strong>
            <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? "الجدول يحدّد الوقت، وبصمتك تثبته." : "The rota sets the time; your punch proves it."}</span>
          </div>
          {currentAlert ? (
            <div
              role="status"
              aria-live="polite"
              data-duty-alert={currentAlert.id}
              data-breach={currentAlert.breach ? "1" : "0"}
              style={{ display: "grid", gridTemplateColumns: "16px minmax(0,1fr) auto", gap: 8, alignItems: "start", padding: "8px 0", borderBottom: "1px solid var(--nv-line2, #EEF1EF)" }}
            >
              <span aria-hidden style={{ display: "inline-flex", paddingTop: 2, color: currentAlert.breach ? "var(--nv-warn-ink)" : "var(--nv-muted)" }}>
                <NvIcon name={currentAlert.breach ? "warning" : currentAlert.id === "prayer_next" ? "prayer" : String(currentAlert.id).startsWith("nursing_") ? "nursing" : "clock"} size={14} inline={false} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 12, lineHeight: 1.7, fontWeight: currentAlert.breach ? 700 : 500, color: currentAlert.breach ? "var(--nv-warn-ink)" : "var(--nv-ink2)" }}>
                  {ar ? currentAlert.textAr : currentAlert.textEn}
                </span>
                {currentAlert.hint ? <RightHint ar={ar} hint={attRightHint(currentAlert.hint.kind, currentAlert.hint.item, { view: "employee", ar, employee: dutyEmployee })} style={{ alignSelf: "flex-start" }} /> : null}
              </span>
              {currentAlert.at ? (
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)", paddingTop: 1 }}>{currentAlert.at}</span>
              ) : null}
            </div>
          ) : null}
          {steps.length ? (
            <ol className="nv-punch-steps" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
              {steps.map((step, index) => {
                const last = index === steps.length - 1;
                if (step.kind === "prayer" || step.kind === "limit" || step.kind === "nursing" || step.kind === "heat") {
                  const heatInk = step.kind === "heat"
                    ? (step.tone === "block" ? "var(--nv-bad-ink)" : step.tone === "alert" ? "var(--nv-warn-ink)" : step.tone === "ok" ? "var(--nv-ok-ink)" : "var(--nv-muted)")
                    : null;
                  // In season the sun-ban marks glow in the sun's own amber — brighter while the ban hours run.
                  const glow = step.kind === "heat" && step.season;
                  return (
                    <li key={step.key} data-step={step.key} data-state={step.kind} data-heat-season={glow ? (step.live ? "live" : "on") : undefined} className={glow ? "nv-heat-glow" : undefined} style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr) auto", gap: 12, alignItems: "start", position: "relative", paddingBottom: last ? 0 : 12, ...(glow ? { padding: "8px 8px", marginBottom: last ? 0 : 12, marginInline: -8, borderRadius: 10, background: `linear-gradient(${ar ? 270 : 90}deg, rgba(232,163,23,.18), rgba(232,163,23,.05))`, boxShadow: step.live ? "0 0 0 1px rgba(214,138,0,.55), 0 0 18px rgba(232,163,23,.38)" : "0 0 0 1px rgba(214,138,0,.32), 0 0 12px rgba(232,163,23,.18)" } : {}) }}>
                      {!last && !glow ? <span aria-hidden style={{ position: "absolute", insetInlineStart: 10, top: 18, bottom: 0, width: 2, background: "var(--nv-line2, #EEF1EF)", borderRadius: 2 }} /> : null}
                      <span aria-hidden style={{ width: 22, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, color: glow ? "#B86E00" : (heatInk || (step.kind === "limit" ? "var(--nv-ink2)" : step.kind === "nursing" ? "var(--nv-ok-ink)" : "var(--nv-muted)")), background: glow ? "#FFE9B8" : "var(--nv-card)", ...(glow ? { borderRadius: 999, boxShadow: "0 0 10px rgba(232,163,23,.55)" } : {}) }}>
                        <NvIcon name={step.kind === "heat" ? "sun" : step.kind === "limit" ? "clock" : step.kind === "nursing" ? "nursing" : "prayer"} size={12} inline={false} />
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{step.label}</span>
                          {step.badge ? <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--nv-ink2)", background: "var(--nv-soft)", border: "1px solid var(--nv-line)", borderRadius: 999, padding: "0 7px", lineHeight: "17px", whiteSpace: "nowrap" }}>{step.badge}</span> : null}
                        </span>
                        {step.note ? <span data-heat-tone={step.kind === "heat" ? step.tone : undefined} style={{ fontSize: 11, color: heatInk && step.tone !== "cite" ? heatInk : "var(--nv-muted)", fontWeight: heatInk && (step.tone === "block" || step.tone === "alert") ? 600 : 400, lineHeight: 1.6 }}>{step.note}</span> : null}
                        {step.action ? <Link to={step.action.to} data-heat-action="1" style={{ alignSelf: "flex-start", fontSize: 11.5, fontWeight: 700, color: "var(--nv-ok-ink)", textDecoration: "none" }}>{step.action.label}</Link> : null}
                        {step.hint ? <RightHint ar={ar} hint={step.hint} style={{ alignSelf: "flex-start" }} /> : null}
                      </span>
                      <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", fontSize: 12, fontWeight: 500, color: "var(--nv-ink2)", whiteSpace: "nowrap", paddingTop: 1 }}>{step.value}</span>
                    </li>
                  );
                }
                const tone = step.kind === "plan"
                  ? { bg: "var(--nv-card)", bd: "var(--nv-mute-fill, #C5CEC9)", fg: "var(--nv-muted)" }
                  : step.state === "done"
                    ? { bg: "var(--nv-ok-fill, #3C7D50)", bd: "var(--nv-ok-fill, #3C7D50)", fg: "#fff" }
                    : step.state === "late"
                      ? { bg: "var(--nv-warn-fill, #C8A45A)", bd: "var(--nv-warn-fill, #C8A45A)", fg: "#fff" }
                      : step.state === "now"
                        ? { bg: "var(--nv-ok-soft, #E6F2EA)", bd: "var(--nv-ok-fill, #3C7D50)", fg: "var(--nv-ok-ink)" }
                        : { bg: "var(--nv-card)", bd: "var(--nv-line)", fg: "var(--nv-muted)" };
                return (
                  <li key={step.key} data-step={step.key} data-state={step.state || "plan"} style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr) auto", gap: 12, alignItems: "start", position: "relative", paddingBottom: last ? 0 : 14 }}>
                    {!last ? <span aria-hidden style={{ position: "absolute", insetInlineStart: 10, top: 22, bottom: 0, width: 2, background: "var(--nv-line2, #EEF1EF)", borderRadius: 2 }} /> : null}
                    <span aria-hidden style={{ width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
                      {step.kind === "plan" ? (
                        <span style={{ width: 10, height: 10, borderRadius: "50%", boxSizing: "border-box", background: "var(--nv-card)", border: `2px ${step.assumed ? "dashed" : "solid"} var(--nv-mute-fill, #C5CEC9)` }} />
                      ) : (
                        <span
                          className={step.state === "now" ? "nv-punch-step-now" : undefined}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            boxSizing: "border-box",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            background: tone.bg,
                            color: tone.fg,
                            border: `${step.state === "wait" ? "1.5px dashed" : "2px solid"} ${tone.bd}`,
                          }}
                        >
                          {step.state === "done" || step.state === "late" ? <NvIcon name="check" size={12} strokeWidth={2.25} inline={false} /> : step.state === "now" ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--nv-ok-fill, #3C7D50)" }} /> : ""}
                        </span>
                      )}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12.5, fontWeight: step.kind === "punch" ? 700 : 600, color: step.kind === "punch" ? "var(--nv-ink)" : "var(--nv-ink2)" }}>{step.label}</span>
                      <span style={{ fontSize: 11, color: step.state === "late" ? "var(--nv-warn-ink)" : "var(--nv-muted)", lineHeight: 1.5 }}>{step.note}</span>
                      {step.sub ? (
                        <span data-break-hint style={{ fontSize: 11, color: "var(--nv-ink3, var(--nv-muted))", lineHeight: 1.6, display: "inline-flex", gap: 5, alignItems: "baseline" }}>
                          <NvIcon name="prayer" size={11} />
                          <span>{step.sub}</span>
                        </span>
                      ) : null}
                      {step.hint ? <RightHint ar={ar} hint={step.hint} style={{ alignSelf: "flex-start" }} /> : null}
                    </span>
                    <span style={{ whiteSpace: "nowrap", paddingTop: 1 }}>
                      <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", fontSize: step.kind === "punch" ? 15 : 13, fontWeight: step.kind === "punch" ? 700 : 500, color: step.value === "—" ? "var(--nv-mute-fill, #C5CEC9)" : step.kind === "punch" ? "var(--nv-ink)" : "var(--nv-ink2)" }}>{step.value}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="nv-att-well" style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
              {onLeaveToday
                ? (ar ? "إجازة معتمدة اليوم — لا بصمة ولا يُحتسب غياب." : "Approved leave today — no punch and no absence.")
                : (ar ? "لا وردية منشورة لك اليوم. البصمة تُفتح حين تُنشر ورديتك في جدول الدوام." : "No published shift for you today. The punch opens once your shift is published.")}
              {" "}
              <Link to="/app/shifts" style={{ color: "var(--nv-ok-ink)", fontWeight: 700, textDecoration: "none" }}>{ar ? "جدولي ←" : "My roster →"}</Link>
            </div>
          )}

          {otLine ? (
            <div data-ot-auto={otLine.open ? "open" : "decided"} style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", fontSize: 12, lineHeight: 1.7, color: "var(--nv-ink2)" }}>
              <span>
                {ar ? "إضافي اليوم " : "Overtime today "}
                <span dir="ltr" style={{ ...MONO, fontWeight: 700 }}>{otLine.clock}</span>
                {ar ? ` — سُجّل تلقائياً (المادة ${otLine.article}) · ${otLine.status}` : ` — recorded automatically (Art. ${otLine.article}) · ${otLine.status}`}
              </span>
              <Link to="/app/requests" style={{ color: "var(--nv-ok-ink)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>{ar ? "طلباتي ›" : "My requests ›"}</Link>
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 12, borderTop: "1px solid var(--nv-line2, #EEF1EF)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>
                {ar ? "المنجز اليوم" : "Worked today"}
                {openPastEnd ? <span data-worked-capped style={{ fontWeight: 500, color: "var(--nv-warn-ink)" }}>{ar ? " · بانتظار الانصراف" : " · awaiting checkout"}</span> : null}
              </span>
              <span style={{ whiteSpace: "nowrap" }}>
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>{inn ? worked.label : "0:00"} / {targetLabel}</span>
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "var(--nv-line2, #EEF1EF)", overflow: "hidden", position: "relative" }}>
              <div style={{ height: "100%", width: `${inn ? dayPct : 0}%`, background: done ? "var(--nv-ok-fill, #3C7D50)" : "var(--nv-warn-fill, #C8A45A)", borderRadius: 999 }} />
              {flexOn && band?.targetMin ? flexDay.rows.map((row, i) => (
                <span
                  key={`brk-bar-${i}`}
                  data-break-bar={row.source}
                  title={ar ? `راحة ${row.start}–${row.end || "…"}${row.source === "assumed" ? " · مفترضة" : ""}` : `Break ${row.start}–${row.end || "…"}${row.source === "assumed" ? " · assumed" : ""}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    insetInlineStart: `${Math.max(0, Math.min(100, ((row.startMin - band.start) / band.targetMin) * 100))}%`,
                    width: `${Math.max(0, Math.min(100, ((Math.max(row.startMin, row.endMin ?? row.startMin) - row.startMin) / band.targetMin) * 100))}%`,
                    background: row.source === "assumed"
                      ? "repeating-linear-gradient(45deg,var(--nv-mute-fill, #C5CEC9) 0 3px,transparent 3px 6px)"
                      : "repeating-linear-gradient(45deg,var(--nv-card, #fff) 0 3px,transparent 3px 6px)", // a break cut into the presence bar
                    opacity: 0.85,
                  }}
                />
              )) : null}
              {band?.label ? (
                <span
                  title={ar ? `راحة ${band.label}` : `Break ${band.label}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    insetInlineStart: `${band.leftPct}%`,
                    width: `${band.widthPct}%`,
                    background: "repeating-linear-gradient(45deg,var(--nv-card, #fff) 0 3px,transparent 3px 6px)", // a break cut into the presence bar
                    opacity: 0.85,
                  }}
                />
              ) : null}
            </div>
            <span style={{ fontSize: 10.5, color: "var(--nv-ink3, var(--nv-muted))" }}>
              {flexOn
                ? (flexDay.rows.length
                  ? (flexDay.assumed
                    ? (ar ? "الجزء المخطّط راحة مفترضة — لم تُثبت ببصمة، ولا تُحسب من ساعات عملك (المادة 102)." : "The hatched part is an assumed break — not punched, still excluded (Art. 102).")
                    : (ar ? "الجزء المخطّط راحتك كما بصمتها — لا تُحتسب ساعات عمل." : "The hatched part is your break as punched — not counted as work."))
                  : (ar ? "راحتك المرنة تُخصم حين تبصمها — لا تُحتسب ساعات عمل." : "Your flex break is excluded once you punch it."))
                : band?.label
                  ? (ar ? "الجزء المخطّط هو الراحة — لا تُحتسب ساعات عمل." : "The hatched part is the break — not counted as work.")
                  : (ar ? "راحة الوردية لا تُحسب من ساعات عملك" : "Shift rest is not counted as working time")}
              {nursingCredit.minutes ? (
                <span data-nursing-credit={nursingCredit.minutes}>
                  {ar ? " · يشمل ساعة الرضاعة " : " · includes the nursing hour "}
                  <span dir="ltr" style={{ ...MONO, color: "var(--nv-ink)" }}>{nursingCredit.minutes}</span>
                  {ar ? " د (م 154)" : " min (Art. 154)"}
                </span>
              ) : null}
            </span>
          </div>
        </div>
      </div>

      {/* «وقت راحتك» — its own band under the day: open at 9 hours and more, information below that. */}
      {(flexOn && !done && !flexDay.punched.length) || (!flexOn && !continuous103 && band && !done) ? (
        <div data-rest-plan-band="1" style={{ padding: "16px 22px", borderTop: "1px solid var(--nv-line2, #EEF1EF)", display: "flex", flexDirection: "column", gap: 10 }}>
          {!flexOn && !continuous103 && band && !done ? (
            // The option is shown as information on a day of 8 hours or less: it opens at 9 hours and more.
            <div data-rest-plan="info" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", border: "1px dashed var(--nv-line)", borderRadius: 10, background: "var(--nv-card)" }}>
              <NvIcon name="lock" size={14} inline={false} style={{ color: "var(--nv-muted)", marginTop: 2 }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink2)" }}>{ar ? "حدّد وقت راحتك — يُفتح عند 9 ساعات فأعلى" : "Set your break time — opens at 9 hours or more"}</span>
                <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
                  {ar
                    ? `إذا كان دوامك أكثر من 8 ساعات تكون لك ساعة راحة تختار وقتها بنفسك هنا. ورديتك اليوم ${band.targetMin % 60 ? band.targetLabel : band.targetMin / 60} ساعات${band.label ? `، وراحتها من الجدول ${band.label}` : ""}.`
                    : `When your duty is longer than 8 hours you get a one-hour break you place yourself here. Today's shift is ${band.targetLabel}${band.label ? `, its break set by the roster at ${band.label}` : ""}.`}
                </span>
              </span>
            </div>
          ) : null}
          {flexOn && !done && !flexDay.punched.length ? (
            <RestPlanPicker
              key={`${dutyDay}:${restPlan?.at || ""}`}
              ar={ar}
              shift={dutyShift}
              onDate={dutyDay}
              continuous103={continuous103}
              saved={restPlan}
              locked={!!flexDay.assumed && !flexDay.assumedRunning}
              onSave={async (parts) => {
                setRestPlan(company.id, currentUser.id, dutyDay, parts);
                await refresh?.();
              }}
            />
          ) : null}
        </div>
      ) : null}

      <div style={{ padding: "12px 22px 16px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--nv-line2, #EEF1EF)", background: "var(--nv-soft, #FAFBFA)" }}>
        <button
          type="button"
          onClick={() => setManualOpen((open) => !open)}
          aria-expanded={manualOpen}
          style={{
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
            date={attDay || dutyDateKey}
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
      {dockOnPhone && (orbReady || loading) && typeof document !== "undefined" ? createPortal(
        <div
          className="nv-punch-dock"
          data-punch-dock="1"
          dir={ar ? "rtl" : "ltr"}
          style={{ bottom: dockBottom ? dockBottom + 10 : "calc(10px + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            type="button"
            onClick={orbClick}
            disabled={punchBlocked}
            style={{
              fontFamily: "inherit",
              width: "100%",
              minHeight: 54,
              border: "none",
              borderRadius: 14,
              background: phase === "awaiting_out" ? "var(--nv-navy)" : "var(--nv-ok-fill, #3C7D50)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "8px 16px",
              cursor: punchBlocked ? "default" : "pointer",
              boxShadow: "0 10px 26px rgba(6,61,38,.28)",
            }}
          >
            {loading
              ? <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
              : phase === "awaiting_out"
                ? <LogOut style={{ width: 20, height: 20 }} strokeWidth={1.9} />
                : <LogIn style={{ width: 20, height: 20 }} strokeWidth={1.9} />}
            <strong style={{ fontSize: 17, fontWeight: 700 }}>{orbLabel}</strong>
            <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85, whiteSpace: "nowrap" }}>{orbSub}</span>
          </button>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}

/** A stored «late» row that sits inside her Art. 154 nursing minutes at the start (the compact card). */
function nursingExcusedLate(user, data, attendance, shift) {
  if (!attendance?.check_in_at || !shift?.start) return false;
  const employee = (data?.employees || []).find((row) => String(row.id) === String(user?.id)) || user;
  const allow = nursingHourOn(employee, String(attendance.date || toRiyadhDateKey()).slice(0, 10))?.startMinutes || 0;
  const start = punchClockMinutes(shift.start);
  const inM = punchClockMinutes(attendance.check_in_at);
  return !!allow && start != null && inM != null && inM - start <= allow;
}

function parseHm(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** The roster's (first) break as a band on the day bar — the same window `rosterBreakWindows` places. */
export function breakBand(shift, onDate) {
  const start = parseHm(shift?.start);
  const end = parseHm(shift?.end);
  if (start == null || end == null) return null;
  let span = end - start;
  if (span <= 0) span += 1440;
  const targetLabel = `${Math.floor(span / 60)}:${String(span % 60).padStart(2, "0")}`;
  const w = rosterBreakWindows(shift, onDate)[0];
  if (!w) return { leftPct: 0, widthPct: 0, label: "", targetMin: span, targetLabel, start };
  return {
    leftPct: (w.from / span) * 100,
    widthPct: (w.minutes / span) * 100,
    label: `${w.start}–${w.end}`,
    rest: w.minutes,
    start,
    offset: w.from,
    targetMin: span,
    targetLabel,
  };
}

/**
 * «المنجز اليوم»: presence minus the rest. A flex day (`flexDay`, resolveDayBreaks) subtracts its
 * actual break punches — the open one up to now — or the assumed one; otherwise the roster's band.
 */
export function workedClock(checkIn, checkOut, now, band, flexDay = null) {
  if (!checkIn) return { label: "0:00", minutes: 0 };
  const start = new Date(checkIn).getTime();
  const end = checkOut ? new Date(checkOut).getTime() : now;
  let minutes = Math.max(0, Math.round((end - start) / 60000));
  if (flexDay?.flex) {
    const rest = (flexDay.rows || []).reduce((sum, row) => sum + Math.max(0, (row.endMin ?? row.startMin) - row.startMin), 0);
    minutes = Math.max(0, minutes - rest);
  } else if (band?.rest) {
    // On the Riyadh clock, never the device's.
    const inMin = riyadhMinutesOf(checkIn);
    const outDate = checkOut ? new Date(checkOut) : new Date(now);
    const outMin = riyadhMinutesOf(outDate) + (toRiyadhDateKey(outDate) !== toRiyadhDateKey(checkIn) ? 1440 : 0);
    const breakStart = band.start + band.offset;
    const breakEnd = breakStart + band.rest;
    const overlap = Math.max(0, Math.min(outMin, breakEnd) - Math.max(inMin, breakStart));
    minutes = Math.max(0, minutes - overlap);
  }
  return { label: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`, minutes };
}

/** «مسار اليوم» rows of a flex day: the window as a range, then each punched part or the assumed one. */
export function flexSteps(day, { ar = true, hint = null, plan = null } = {}) {
  const flex = day?.flex;
  if (!flex) return [];
  const steps = [{
    key: "rest-window",
    kind: "plan",
    at: flex.fromMin,
    label: ar ? "نافذة الراحة" : "Break window",
    note: ar
      ? `راحتك بيدك: ${minutesAr(flex.minutes)} تختار وقتها داخل هذه النافذة${flex.splitEffective ? `، ويمكن تقسيمها جزأين (${minutesAr(flex.minPart)} على الأقل لكل جزء)` : ""} — تبدؤها وتنهيها ببصمة`
      : `Flex break ${flex.minutes} min${flex.splitEffective ? " · may split" : ""} — you punch its start and end`,
    value: `${flex.from}–${flex.to}`,
    hint,
  }];
  const parts = day.rows.filter((row) => row.source === "punch");
  // His own plan, before he punches it: «راحتك المخطّطة» in time order (one row per part).
  if (!parts.length && plan?.ok && !day.rows.some((row) => row.source === "assumed")) {
    plan.rows.forEach((row, i) => steps.push({
      key: `brk-plan-${i}`,
      kind: "plan",
      at: row.startMin,
      label: plan.rows.length > 1 ? (ar ? `راحتك المخطّطة · الجزء ${i + 1}` : `Planned break · part ${i + 1}`) : (ar ? "راحتك المخطّطة" : "Your planned break"),
      note: ar ? `${minutesAr(row.minutes)} اخترتها أنت — اضغط «بدأت راحتي» عند بدايتها` : `${row.minutes} min you chose — tap “I started my break” when it starts`,
      value: `${row.start}–${row.end}`,
    }));
  }
  day.rows.forEach((row, i) => {
    if (row.source === "assumed") {
      steps.push({
        key: "brk-assumed",
        kind: "plan",
        assumed: true,
        at: row.startMin,
        label: ar ? "راحة مفترضة" : "Assumed break",
        note: ar ? "مفترضة — لم تُثبت ببصمة · تُخصم (المادة 102)" : "Assumed — not proven by a punch · deducted (Art. 102)",
        value: `${row.start}–${row.end}`,
      });
      return;
    }
    const n = parts.indexOf(row) + 1;
    const short = !row.open && row.minutes < flex.minPart;
    // A closed part that carried the day past its break is a late return — said on the row, in minutes.
    const before = parts.slice(0, n - 1).reduce((sum, part) => sum + (Number(part.minutes) || 0), 0);
    const over = !row.open ? Math.max(0, before + (Number(row.minutes) || 0) - Math.max(before, Number(flex.minutes) || 0)) : 0;
    steps.push({
      key: `brk-${i}`,
      kind: "punch",
      at: row.startMin,
      state: row.open ? (day.overMinutes > 0 ? "late" : "now") : (short || over > 0) ? "late" : "done",
      label: parts.length > 1 ? (ar ? `راحتك · الجزء ${n}` : `Your break · part ${n}`) : (ar ? "راحتك" : "Your break"),
      note: row.open
        ? (ar ? `مفتوحة منذ ${row.start} · ${minutesAr(row.minutes)}` : `Open since ${row.start} · ${row.minutes} min`)
        : over > 0
          ? (ar ? `ببصمة · ${minutesAr(row.minutes)} — عودة متأخرة ${minutesAr(over)} فوق راحتك (${minutesAr(flex.minutes)})` : `Punched · ${row.minutes} min — back ${over} min late over your ${flex.minutes}-min break`)
          : (ar ? `ببصمة · ${minutesAr(row.minutes)}${short ? " · قصيرة" : ""}` : `Punched · ${row.minutes} min${short ? " · short" : ""}`),
      value: row.open ? `${row.start}–…` : `${row.start}–${row.end}`,
    });
  });
  return steps;
}

/** «بدأت راحتي» / «أنهيت راحتي» — a plain button inside the card; a disabled one names its reason. */
function BreakPunch({ ar, day, gate, busy, error, onPunch, leftMs = null, buttonRef = null }) {
  if (!gate) return null;
  const open = !!day.open;
  const label = open ? (ar ? "أنهيت راحتي" : "I ended my break") : (ar ? "بدأت راحتي" : "I started my break");
  const disabled = busy || !gate.ok;
  const clockAt = (mins) => {
    const m = ((Math.round(mins) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  const reason = !gate.ok
    ? `${ar ? gate.reason : gate.reasonEn}${gate.error === "BREAK_BELOW_MIN" && gate.endsAtMin != null ? (ar ? ` — تنهيها من ${clockAt(gate.endsAtMin)}` : ` — you can end it from ${clockAt(gate.endsAtMin)}`) : ""}`
    : gate.short
      ? (ar ? `${gate.reason} — إن أنهيتها الآن تُسجَّل راحة قصيرة.` : `${gate.reasonEn} — ending now records a short break.`)
      : gate.warn
        ? (ar ? gate.warn : gate.warnEn)
        : "";
  const remaining = !open && day.punched.length && day.flex.splitEffective && day.remaining > 0 && day.windowState !== "closed"
    ? (ar ? `باقٍ ${minutesAr(day.remaining)} من راحتك` : `${day.remaining} min of your break left`)
    : "";
  // The live countdown («باقٍ 12:34») — reaching 0:00 the minute «انتهت راحتك» is sent.
  const running = open
    ? (leftMs != null && leftMs > 0
      ? (ar
        ? <>في راحتك منذ <span dir="ltr" style={MONO}>{day.open.start}</span> · باقٍ <span dir="ltr" data-break-countdown="flex" style={{ ...MONO, fontWeight: 700 }}>{countdownLabel(leftMs)}</span></>
        : <>On break since <span dir="ltr" style={MONO}>{day.open.start}</span> · <span dir="ltr" data-break-countdown="flex" style={{ ...MONO, fontWeight: 700 }}>{countdownLabel(leftMs)}</span> left</>)
      : leftMs != null
        ? <span style={{ color: "var(--nv-warn-ink)", fontWeight: 600 }}>{ar ? "انتهت راحتك — عُد للعمل واضغط «أنهيت راحتي»." : "Your break is over — back to work, then tap “I ended my break”."}</span>
        : (ar ? <>في راحتك منذ <span dir="ltr" style={MONO}>{day.open.start}</span> · {minutesAr(day.runningMinutes)}</> : <>On break since <span dir="ltr" style={MONO}>{day.open.start}</span> · {day.runningMinutes} min</>))
    : day.assumedRunning && day.assumed
      // None punched: the assumed break counts down like a punched one; «بدأت راحتي» replaces it.
      ? (ar
        ? <span data-break-assumed-running="1">راحتك <span dir="ltr" style={MONO}>{day.assumed.start}–{day.assumed.end}</span> تُحتسب تلقائياً{leftMs != null && leftMs > 0 ? <> · باقٍ <span dir="ltr" data-break-countdown="flex" style={{ ...MONO, fontWeight: 700 }}>{countdownLabel(leftMs)}</span></> : null}</span>
        : <span data-break-assumed-running="1">Your break <span dir="ltr" style={MONO}>{day.assumed.start}–{day.assumed.end}</span> counts automatically{leftMs != null && leftMs > 0 ? <> · <span dir="ltr" data-break-countdown="flex" style={{ ...MONO, fontWeight: 700 }}>{countdownLabel(leftMs)}</span> left</> : null}</span>)
      : null;
  return (
    <div data-break-punch={open ? "open" : "closed"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, maxWidth: 280, textAlign: "center" }}>
      <button
        type="button"
        ref={buttonRef}
        data-break-action={open ? "end" : "start"}
        onClick={onPunch}
        disabled={disabled}
        aria-describedby={reason ? "nv-break-reason" : undefined}
        style={{
          ...ui.btnSecondary,
          height: 34,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 600,
          color: disabled ? "var(--nv-muted)" : "var(--nv-ink)",
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {busy ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <NvIcon name="clock" size={14} inline={false} />}
        {label}
      </button>
      {running ? <span style={{ fontSize: 11.5, color: "var(--nv-ink2)" }}>{running}</span> : null}
      {remaining ? <span data-break-remaining style={{ fontSize: 11.5, color: "var(--nv-ink2)", fontWeight: 600 }}>{remaining}</span> : null}
      {reason ? <span id="nv-break-reason" data-break-reason={gate.error || (gate.warn ? "BREAK_LEFTOVER_SHORT" : "")} style={{ fontSize: 11, lineHeight: 1.6, color: gate.short || gate.warn ? "var(--nv-warn-ink)" : "var(--nv-muted)" }}>{reason}</span> : null}
      {error ? <span style={{ fontSize: 11, lineHeight: 1.6, color: "var(--nv-bad-ink)" }}>{error}</span> : null}
    </div>
  );
}

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", color: "var(--nv-ink)" };

const REQ_REASONS_AR = ["نسيت البصمة", "خارج النطاق", "تعذّر الموقع", "عمل ميداني", "سبب آخر"];
const REQ_REASONS_EN = ["Forgot to punch", "Outside range", "Location failed", "Field work", "Other"];

export function ManualPunchRequest({
  ar,
  phase,
  date = "",
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
  const day = date || toRiyadhDateKey();
  // A named day (سجلي) reads only that day's request; today's card keeps its original reading.
  const sameDay = (row) => !date || String(row.date || "").slice(0, 10) === date;
  const pending = (employee?.otherRequests || []).find((row) => row.type === punchType && (row.status || "pending") === "pending" && sameDay(row));
  const decided = (employee?.otherRequests || []).find((row) => row.type === punchType && (row.status === "approved" || row.status === "rejected") && sameDay(row));
  const noteReady = String(reqNote || "").trim().length >= 3;
  const timeReady = !!parsePunchClock(reqTime);
  // No reason is preselected — the worker names it (a wrong default would travel to the manager).
  const reasonLabel = reasons.includes(reqReason) ? reqReason : "";
  const canSend = noteReady && timeReady && !!reasonLabel;

  const send = () => {
    if (!companyId || !employee?.id) return;
    const reason = `${reqTime} · ${reasonLabel} — ${String(reqNote || "").trim()}`;
    const gate = checkSubmitOtherRequestGate({
      type: phase === "awaiting_out" ? "checkout_fix" : "manual_punch",
      reason,
      date: day,
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
      date: day,
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
                : !reasonLabel
                  ? (ar ? "اختر السبب" : "Pick the reason")
                  : (ar ? "اكتب تفصيل السبب أولاً" : "Write the reason first")}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The same manual-punch / checkout-fix request, for a named day (سجلي → اطلب تصحيح).
 * Owns its own form state; the gate and the store call are the card's.
 */
export function ManualPunchRequestBox({ ar, date, attendance, companyId, employee, onLeave = false }) {
  const { refresh } = useAuth();
  const [reqTime, setReqTime] = useState(() => {
    const at = attendance?.check_in_at || attendance?.checkInAt;
    return at && !(attendance?.check_out_at || attendance?.checkOutAt) ? "" : riyadhNowClock();
  });
  const [reqReason, setReqReason] = useState("");
  const [reqNote, setReqNote] = useState("");
  const [reqError, setReqError] = useState("");
  const inAt = attendance?.check_in_at || attendance?.checkInAt;
  const outAt = attendance?.check_out_at || attendance?.checkOutAt;
  const phase = !inAt ? "awaiting_in" : !outAt ? "awaiting_out" : "done";
  return (
    <ManualPunchRequest
      ar={ar}
      phase={phase}
      date={date}
      companyId={companyId}
      employee={employee}
      attendance={attendance}
      onLeave={onLeave}
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
  );
}
