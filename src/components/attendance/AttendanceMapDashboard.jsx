import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { MapContainer, CircleMarker, Circle, Marker, Popup, useMap } from "react-leaflet";
import GoogleTiles from "@/components/maps/GoogleTiles";
import L from "leaflet";
import { Loader2, MapPin } from "lucide-react";
import ComparisonExportButtons from "@/components/reports/ComparisonExportButtons";
import "leaflet/dist/leaflet.css";
import EmployeeNameLink from "@/components/employees/EmployeeNameLink";
import { useI18n } from "@/lib/i18n";
import AttendanceLocationsPanel from "@/components/attendance/AttendanceLocationsPanel";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { ACCENT, BORDER, MUTED, NAVY, field, tableShell } from "@/lib/platformStyles";

const stationIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [map, JSON.stringify(points)]);
  return null;
}

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(value)));
}

export default function AttendanceMapDashboard({ employees, t }) {
  const { data } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stationFilter, setStationFilter] = useState("all");

  useEffect(() => {
    if (employees.length === 0) return;
    setLoading(true);
    base44.functions
      .invoke("supabaseAttendance", { action: "listDaily", employeeIds: employees.map((e) => e.id), date })
      .then((res) => setRows(res?.data?.rows || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [date, employees.length]);

  const allStations = data?.stations || [];
  const defaultStationId = allStations[0]?.id || null;
  const located = rows
    .filter((r) => r.check_in_lat != null && r.check_in_lng != null)
    .map((r) => {
      const stationId = r.station_id || defaultStationId;
      const station = allStations.find((s) => s.id === stationId && s.lat != null && s.lng != null);
      const distance = station
        ? distanceMeters(
            { lat: Number(r.check_in_lat), lng: Number(r.check_in_lng) },
            { lat: Number(station.lat), lng: Number(station.lng) }
          )
        : null;
      return {
        ...r,
        mapStationId: stationId,
        mapDistance: distance,
        mapInside: distance != null && distance <= (Number(station.radiusMeters) || 200),
      };
    })
    .filter((r) => stationFilter === "all" || r.mapStationId === stationFilter);
  const stations = allStations
    .filter((s) => s.lat != null && s.lng != null)
    .filter((s) => stationFilter === "all" || s.id === stationFilter);

  const points = [...located.map((r) => [r.check_in_lat, r.check_in_lng]), ...stations.map((s) => [s.lat, s.lng])];
  const insideCount = located.filter((r) => r.mapInside).length;
  const outsideCount = located.length - insideCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} dir={ar ? "rtl" : "ltr"}>
    <AttendanceLocationsPanel t={t} lang={lang} />
    <div className="nv-att-card" style={tableShell}>
      <div style={{ padding: "11px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <div style={{ flex: "1 1 180px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "نقاط البصمة اليوم" : "Today's punch points"}</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.7 }}>
            {ar
              ? "أداة نطاق، لا مراقبة. تُحفظ نقطة التسجيل فقط — بلا مسار وبلا مراسي NFC."
              : "A range tool, not surveillance. Only the punch point is kept — no path, no NFC anchors."}
            {" · "}
            {date}
          </div>
        </div>
        <div style={{ width: 220 }}>
          <PlatformDateField compact ar={ar} value={date} onChange={setDate} allowClear={false} />
        </div>
        <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)} style={{ ...field, minWidth: 140, maxWidth: 220 }}>
          <option value="all">{t("all")}</option>
          {(data?.stations || []).map((station) => (
            <option key={station.id} value={station.id}>
              {station.location ? `${station.name} — ${station.location}` : station.name}
            </option>
          ))}
        </select>
        {loading && <Loader2 style={{ width: 16, height: 16, color: MUTED, animation: "spin 1s linear infinite" }} />}
        <ComparisonExportButtons
          title={`${t("mapTab")} — ${date}`}
          headers={[t("employeeName"), t("checkIn"), t("locationStatus"), t("distanceMeters"), "Lat", "Lng"]}
          rows={located.map((r) => [
            r.employee_name || r.employee_id,
            r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString() : "—",
            r.mapInside ? t("insideLocation") : t("outsideLocation"),
            r.mapDistance ?? "—",
            r.check_in_lat,
            r.check_in_lng,
          ])}
          compact
        />
      </div>

      <div data-nv-att-line style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: MUTED }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT }} />
          {t("insideLocation")} ({insideCount})
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--nv-bad-fill)" }} />
          {t("outsideLocation")} ({outsideCount})
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <MapPin style={{ width: 12, height: 12 }} /> {t("stationLocation")}
        </span>
      </div>

      {located.length === 0 && stations.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", fontSize: 12, color: MUTED }}>{t("noMapData")}</div>
      ) : (
        <div style={{ height: 420, position: "relative" }}>
          <MapContainer center={points[0] || [24.7, 46.7]} zoom={12} style={{ height: "100%", width: "100%" }}>
            <GoogleTiles />
            <FitBounds points={points} />
            {stations.map((s) => {
              const stationRows = located.filter((r) => r.mapStationId === s.id);
              const zoneColor = stationRows.length === 0 ? "#b8860b" : stationRows.every((r) => r.mapInside) ? "#059669" : "#dc2626";
              return (
                <React.Fragment key={s.id}>
                  <Marker position={[s.lat, s.lng]} icon={stationIcon}>
                    <Popup><span dir="auto">{s.name}</span></Popup>
                  </Marker>
                  {s.radiusMeters != null && (
                    <Circle center={[s.lat, s.lng]} radius={s.radiusMeters} pathOptions={{ color: zoneColor, fillColor: zoneColor, fillOpacity: 0.08, weight: 2 }} />
                  )}
                </React.Fragment>
              );
            })}
            {located.map((r) => (
              <CircleMarker
                key={r.id}
                center={[r.check_in_lat, r.check_in_lng]}
                radius={9}
                pathOptions={{
                  color: r.mapInside ? "#059669" : "var(--nv-bad-ink)",
                  fillColor: r.mapInside ? "#10b981" : "var(--nv-bad-ink)",
                  fillOpacity: 0.85,
                  weight: 2,
                }}
              >
                <Popup>
                  <div style={{ fontSize: 11 }} dir="auto">
                    <EmployeeNameLink employeeId={r.employee_id} employeeName={r.employee_name || r.employee_id} style={{ fontWeight: 600, color: NAVY }} />
                    <p style={{ margin: "4px 0 0" }}>{t("checkedInAt")} {r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString() : "—"}</p>
                    {r.mapDistance != null && <p style={{ margin: "2px 0 0" }}>{t("distanceMeters")}: {r.mapDistance}m</p>}
                    <p style={{ margin: "2px 0 0", color: r.mapInside ? "var(--nv-ok-ink)" : "var(--nv-bad-ink)" }}>
                      {r.mapInside ? t("insideLocation") : t("outsideLocation")}
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}

      {rows.length > 0 && located.length === 0 && (
        <p style={{ padding: "10px 14px", fontSize: 11, color: MUTED }}>{t("noLocatedCheckins")}</p>
      )}
    </div>
    </div>
  );
}
