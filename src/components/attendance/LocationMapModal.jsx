import React from "react";
import { MapContainer, Marker, Popup } from "react-leaflet";
import GoogleTiles from "@/components/maps/GoogleTiles";
import L from "leaflet";
import { X } from "lucide-react";
import { dialogCard, dialogOverlay, MUTED, NAVY, ui } from "@/lib/platformStyles";
import "leaflet/dist/leaflet.css";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function LocationMapModal({ row, t, onClose }) {
  const empPos = row.check_in_lat != null && row.check_in_lng != null ? [row.check_in_lat, row.check_in_lng] : null;
  const checkoutPos = row.check_out_lat != null && row.check_out_lng != null ? [row.check_out_lat, row.check_out_lng] : null;
  const stationPos = row.station_lat != null && row.station_lng != null ? [row.station_lat, row.station_lng] : null;
  const center = empPos || checkoutPos || stationPos || [0, 0];

  return (
    <div style={dialogOverlay} onClick={onClose} role="presentation">
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...dialogCard, maxWidth: 520, padding: 0, overflow: "hidden" }}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--nv-line)" }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: NAVY }}>
            {t("employeeLocation")} / {t("stationLocation")}
          </h3>
          <button type="button" onClick={onClose} style={{ ...ui.btnGhost, padding: 4 }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div style={{ padding: "8px 16px", fontSize: 11, color: MUTED, borderBottom: "1px solid var(--nv-line)" }}>
          {t("distanceMeters")}: {row.distance_meters ?? "—"}m
        </div>
        <div style={{ height: 288, position: "relative" }}>
          <MapContainer center={center} zoom={16} style={{ height: "100%", width: "100%" }}>
            <GoogleTiles />
            {empPos && <Marker position={empPos} icon={markerIcon}><Popup>{t("checkIn")} — {t("employeeLocation")}</Popup></Marker>}
            {checkoutPos && <Marker position={checkoutPos} icon={markerIcon}><Popup>{t("checkOut")} — {t("employeeLocation")}</Popup></Marker>}
            {stationPos && <Marker position={stationPos} icon={markerIcon}><Popup>{t("stationLocation")}</Popup></Marker>}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
