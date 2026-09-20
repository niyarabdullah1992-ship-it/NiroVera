import React, { useState, useRef, useEffect } from "react";
import { MapContainer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import GoogleTiles from "@/components/maps/GoogleTiles";
import LocationSearchBox from "@/components/maps/LocationSearchBox";
import { X, MapPin, LocateFixed, Loader2, Check } from "lucide-react";
import "leaflet/dist/leaflet.css";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const DEFAULT_CENTER = [24.7136, 46.6753];

function ClickToPlace({ onPick }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

function Recenter({ pos }) {
  const map = useMap();
  React.useEffect(() => {
    if (pos) map.setView(pos, Math.max(map.getZoom(), 15));
  }, [pos?.[0], pos?.[1]]);
  return null;
}

function FitArea({ area }) {
  const map = useMap();
  React.useEffect(() => {
    if (!area) return;
    if (area.bounds) map.fitBounds(area.bounds);
    else map.setView(area.center, 12);
  }, [area]);
  return null;
}

const BROAD_TYPES = new Set(["city", "town", "village", "state", "county", "suburb", "neighbourhood", "quarter", "administrative", "region", "municipality"]);
function isBroadResult(r) {
  return r && (r.class === "boundary" || BROAD_TYPES.has(r.type));
}

export default function StationLocationEditor({ t, station, onSave, onCancel, inline = false }) {
  const [pos, setPos] = useState(station.lat != null && station.lng != null ? [station.lat, station.lng] : null);
  const [radius, setRadius] = useState(station.radiusMeters ?? 200);
  const [locating, setLocating] = useState(false);
  const [area, setArea] = useState(null);
  const [areaHint, setAreaHint] = useState("");
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState("");

  const watchRef = useRef(null);
  const bestRef = useRef(null);

  const stopTracking = () => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setLocating(false);
  };

  useEffect(() => stopTracking, []);

  const useMyLocation = () => {
    setError("");
    setAccuracy(null);
    bestRef.current = null;
    if (!navigator.geolocation) { setError(t("locationDenied")); return; }
    stopTracking();
    setLocating(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null };
        const best = bestRef.current;
        if (!best || (fix.accuracy != null && (best.accuracy == null || fix.accuracy < best.accuracy))) {
          bestRef.current = fix;
          setPos([fix.lat, fix.lng]);
          setAccuracy(fix.accuracy != null ? Math.round(fix.accuracy) : null);
        }
        if (bestRef.current.accuracy != null && bestRef.current.accuracy <= 10) stopTracking();
      },
      () => {
        stopTracking();
        if (!bestRef.current) setError(t("locationDenied"));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
  };

  const submit = () => {
    onSave({
      lat: pos ? pos[0] : null,
      lng: pos ? pos[1] : null,
      radiusMeters: Number(radius) || 200,
    });
  };

  const card = (
    <div className={inline ? "w-full border border-[#dfe3ea] bg-white overflow-hidden" : "w-full max-w-lg rounded-xl border border-border bg-card overflow-hidden"}>
      {!inline ? (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#14284B]" /> {t("setLocation")} — <span dir="auto">{station.name}</span>
          </h3>
          <button type="button" onClick={onCancel} className="p-1 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
      ) : null}

      <div className="px-4 py-2 flex items-center justify-between gap-2 border-b border-border">
        <p className="text-[11px] text-muted-foreground font-body">{t("tapMapToSet")}</p>
        <button
          type="button"
          onClick={locating ? stopTracking : useMyLocation}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] bg-[#F7F8FA] text-[#14284B] text-xs font-body hover:bg-white shrink-0"
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
          {locating ? `${t("locating")}${accuracy != null ? ` ±${accuracy}${t("metersUnit")}` : ""}` : t("useMyLocation")}
        </button>
      </div>

      <div className="px-4 py-2 border-b border-border">
        <LocationSearchBox
          t={t}
          onPick={(p, r) => {
            stopTracking();
            setAccuracy(null);
            if (isBroadResult(r)) {
              const bb = r?.boundingbox?.map(Number);
              setArea({ center: p, bounds: bb?.length === 4 ? [[bb[0], bb[2]], [bb[1], bb[3]]] : null });
              setAreaHint(r?.display_name?.split(",")[0] || "");
            } else {
              setArea(null);
              setAreaHint("");
              setPos(p);
            }
          }}
        />
        {areaHint && !pos && (
          <p className="mt-1 text-[11px] text-accent font-body" dir="auto">📍 {areaHint} — {t("tapMapToSet")}</p>
        )}
      </div>

      <div className="relative" style={{ height: inline ? 230 : 288 }}>
        <MapContainer center={pos || DEFAULT_CENTER} zoom={pos ? 17 : 6} style={{ height: "100%", width: "100%" }}>
          <GoogleTiles />
          <ClickToPlace onPick={(p) => { stopTracking(); setAccuracy(null); setArea(null); setPos(p); }} />
          <Recenter pos={pos} />
          <FitArea area={area} />
          {pos && accuracy != null && (
            <Circle center={pos} radius={accuracy} pathOptions={{ color: "#3b82f6", weight: 1, fillOpacity: 0.08 }} />
          )}
          {pos && <Marker position={pos} icon={markerIcon} />}
          {pos && <Circle center={pos} radius={Number(radius) || 200} pathOptions={{ color: "#1E9E63", fillOpacity: 0.12 }} />}
        </MapContainer>
      </div>

      <div className="px-4 py-3 space-y-2 border-t border-border">
        {error && <p className="text-xs text-destructive font-body">{error}</p>}
        {accuracy != null && (
          <p className={`text-xs font-body ${accuracy <= 30 ? "text-emerald-600" : "text-amber-600"}`}>
            {t("gpsAccuracy")}: ±{accuracy}{t("metersUnit")}{accuracy > 30 ? ` — ${t("lowAccuracyHint")}` : ""}
          </p>
        )}
        <div className="flex items-center gap-3">
          <input type="range" min="50" max="400" step="10" value={Number(radius) || 200} onChange={(e) => setRadius(e.target.value)} style={{ width: "100%", accentColor: "#1d9a5b" }} />
          <span className="text-sm font-mono whitespace-nowrap">{Number(radius) || 200} {t("metersUnit")}</span>
        </div>
        <div className="flex items-center gap-2">
          {!inline ? (
            <button type="button" onClick={onCancel} className="px-3 py-1.5 border border-border text-xs font-body hover:bg-muted">{t("cancel")}</button>
          ) : null}
          <button
            type="button"
            onClick={submit}
            disabled={!pos}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#137a49] text-white text-xs font-semibold disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" /> {t("save")}
          </button>
        </div>
      </div>
    </div>
  );

  if (inline) return card;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()}>{card}</div>
    </div>
  );
}
