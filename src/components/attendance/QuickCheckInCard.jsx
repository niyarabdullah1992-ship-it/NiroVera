import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import { getTodaysShift, isLocationRequired } from "@/lib/attendance";
import { workplaceStations } from "@/lib/stationTree";
import { checkCheckInLeaveGate } from "@/lib/attendanceGate";
import { getAccuratePosition, startGeoWarmup } from "@/lib/geo";
import { LogIn, LogOut, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { ACCENT, BORDER, MUTED, NAVY, CARD } from "@/lib/platformStyles";

export default function QuickCheckInCard({ currentUser, company }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const { data } = useAuth();
  const shift = getTodaysShift(data, currentUser);
  const scheduledStationId = shift?.stationId || currentUser.stationId || data?.stations?.[0]?.id || null;
  const workplaces = workplaceStations(data?.stations);
  const [punchStationId, setPunchStationId] = useState(scheduledStationId || "");
  const station = data?.stations?.find((s) => s.id === (punchStationId || scheduledStationId));
  const [settings, setSettings] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [setRes, attRes] = await Promise.all([
          base44.functions.invoke("supabaseAttendance", { action: "getSettings", companyId: company.id }),
          base44.functions.invoke("supabaseAttendance", { action: "getTodayStatus", employeeId: currentUser.id }),
        ]);
        const loadedSettings = setRes?.data?.settings || null;
        setSettings(loadedSettings);
        setAttendance(attRes?.data?.attendance || null);
        if (isLocationRequired(loadedSettings)) startGeoWarmup();
      } catch {
        /* keep empty until the employee marks present */
      }
    })();
  }, [currentUser?.id, company?.id]);

  const scheduleBlocks = !shift;

  const handleCheckIn = async () => {
    setError("");
    const leaveGate = checkCheckInLeaveGate(currentUser);
    if (!leaveGate.ok) {
      setError(ar ? leaveGate.reason : leaveGate.reasonEn);
      return;
    }
    if (scheduleBlocks) {
      setError(ar ? "لا يمكنك تسجيل الحضور لأنك غير مدرج في جدول اليوم." : "You cannot check in because you are not scheduled today.");
      return;
    }
    setLoading(true);
    try {
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
        action: "checkIn",
        companyId: company.id,
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        stationId: punchStationId || scheduledStationId,
        shiftStart: shift?.start,
        ...(coords ? { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy } : {}),
      });
      if (res?.data?.attendance) {
        setAttendance(res.data.attendance);
        window.dispatchEvent(new CustomEvent("attendance-updated", { detail: res.data.attendance }));
      }
    } catch (err) {
      const code = err?.response?.data?.error;
      setError(code === "ON_APPROVED_LEAVE"
        ? (ar ? "لا يمكنك تسجيل الحضور — لديك إجازة معتمدة لهذا اليوم." : "You cannot check in — you have approved leave for today.")
        : code === "NOT_SCHEDULED" ? (ar ? "لا يمكنك تسجيل الحضور لأنك غير مدرج في جدول اليوم." : "You cannot check in because you are not scheduled today.") : code === "GPS_REQUIRED" ? t("locationDenied") : code === "STATION_LOCATION_REQUIRED" ? t("locationNotSet") : code === "OUTSIDE_STATION" ? t("outsideLocation") : (code || t("aiActionFailed")));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setError("");
    setLoading(true);
    try {
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
        action: "checkOut",
        companyId: company.id,
        employeeId: currentUser.id,
        shiftEnd: shift?.end,
        ...(coords ? { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy } : {}),
      });
      if (res?.data?.attendance) {
        setAttendance(res.data.attendance);
        window.dispatchEvent(new CustomEvent("attendance-updated", { detail: res.data.attendance }));
      }
    } catch (err) {
      const code = err?.response?.data?.error;
      setError(code === "GPS_REQUIRED" ? t("locationDenied") : code === "STATION_LOCATION_REQUIRED" ? t("locationNotSet") : code === "OUTSIDE_STATION" ? t("outsideLocation") : (code || t("aiActionFailed")));
    } finally {
      setLoading(false);
    }
  };

  const checkedIn = !!attendance?.check_in_at;
  const checkedOut = !!attendance?.check_out_at;
  const punchDisabled = loading || (!checkedIn && scheduleBlocks);

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${BORDER}`,
        background: CARD,
        padding: "16px 18px",
        overflow: "hidden",
      }}
      dir={ar ? "rtl" : "ltr"}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {checkedOut ? (
            <div style={{
              width: 104, height: 104, borderRadius: "50%", border: "3px solid #BBF7D0",
              background: "#ECFDF3", display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", color: "#15803D",
            }}
            >
              <CheckCircle2 style={{ width: 28, height: 28, marginBottom: 4 }} />
              <span style={{ fontSize: 10, textAlign: "center", padding: "0 8px" }}>{t("alreadyCheckedOut")}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={checkedIn ? handleCheckOut : handleCheckIn}
              disabled={punchDisabled}
              style={{
                width: 104,
                height: 104,
                borderRadius: "50%",
                border: checkedIn ? `3px solid ${ACCENT}` : "3px solid color-mix(in oklab, #1E9E63 35%, #fff)",
                background: checkedIn ? CARD : ACCENT,
                color: checkedIn ? ACCENT : "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: punchDisabled ? "not-allowed" : "pointer",
                opacity: punchDisabled ? 0.55 : 1,
                boxShadow: "0 4px 14px rgba(20,40,75,.12)",
              }}
            >
              {loading ? (
                <Loader2 style={{ width: 26, height: 26, animation: "spin 1s linear infinite" }} />
              ) : checkedIn ? (
                <><LogOut style={{ width: 24, height: 24 }} />{ar ? "انصرف" : "Out"}</>
              ) : (
                <><LogIn style={{ width: 24, height: 24 }} />{ar ? "حضر" : "Present"}</>
              )}
            </button>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, textAlign: "center" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: NAVY }}>{ar ? "البصمة — من الجدول فقط" : "Punch — from the rota only"}</h3>
          <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
            {ar ? "ورديتك اليوم — من الجدول" : "Today's shift — from the rota"}
          </p>
          {shift ? (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: NAVY, fontFamily: "'IBM Plex Mono', monospace" }}>
              {shift.start || "—"} → {shift.end || "—"}
            </p>
          ) : (
            <Link to="/app/shifts" style={{ color: ACCENT, textDecoration: "none", fontWeight: 600, fontSize: 12 }}>
              {ar ? "غير مدرج في جدول اليوم — لا بصمة" : "Not on today's rota — no punch"}
            </Link>
          )}
          {error ? (
            <p style={{ margin: 0, fontSize: 11, color: "#DC2626" }}>{error}</p>
          ) : (
            <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
              {ar ? "اضغط عندما تصل. الموقع يظهر عند الفشل فقط." : "Tap when you arrive. Location appears only on failure."}
            </p>
          )}

          {checkedIn && (
            <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
              {t("checkedInAt")} {new Date(attendance.check_in_at).toLocaleTimeString()}
              {attendance.status === "late" && Number(attendance.late_minutes) > 0 && (
                <span style={{ color: "#B45309" }}> · {t("lateBy")} {attendance.late_minutes} {t("minutesUnit")}</span>
              )}
              {attendance.station_id && (
                <span dir="auto"> · <MapPin style={{ width: 11, height: 11, display: "inline", verticalAlign: "middle" }} /> {data?.stations?.find((s) => s.id === attendance.station_id)?.name || ""}</span>
              )}
            </p>
          )}
          {checkedOut && (
            <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
              {t("checkedOutAt")} {new Date(attendance.check_out_at).toLocaleTimeString()}
            </p>
          )}

          {!checkedIn && workplaces.length > 1 && (
            <select
              value={punchStationId || ""}
              onChange={(event) => setPunchStationId(event.target.value)}
              style={{
                height: 32,
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                background: CARD,
                color: NAVY,
                fontSize: 11,
                fontWeight: 600,
                padding: "0 8px",
                fontFamily: "inherit",
              }}
            >
              {workplaces.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          )}
          {!checkedIn && station?.name && workplaces.length <= 1 && (
            <span style={{ fontSize: 10, color: MUTED }} dir="auto">{station.name}</span>
          )}
        </div>
      </div>
    </div>
  );
}
