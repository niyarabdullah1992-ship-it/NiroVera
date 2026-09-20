/** City-centre pins so preview branches are not "no point" on the attendance map. */

export const PREVIEW_STATION_PINS = {
  "فرع الخفجي": { lat: 28.4391, lng: 48.4912, radiusMeters: 200 },
  "فرع رابغ": { lat: 22.7984, lng: 39.0349, radiusMeters: 200 },
  "فرع جدة": { lat: 21.5433, lng: 39.1728, radiusMeters: 200 },
  "فرع الدمام": { lat: 26.4207, lng: 50.0888, radiusMeters: 200 },
  "المكتب الرئيسي": { lat: 26.432, lng: 50.1036, radiusMeters: 200 },
  "ميناء الدمام": { lat: 26.494, lng: 50.2, radiusMeters: 200 },
  "NiroVera Preview": { lat: 24.7136, lng: 46.6753, radiusMeters: 200 },
  "المنطقة الشرقية": { lat: 26.3927, lng: 49.9777, radiusMeters: 200 },
  "المنطقة الغربية": { lat: 21.4858, lng: 39.1925, radiusMeters: 200 },
};

export function applyPreviewStationPin(station) {
  if (!station?.name) return false;
  const pin = PREVIEW_STATION_PINS[station.name];
  if (!pin) return false;
  if (station.lat != null && station.lng != null) return false;
  station.lat = pin.lat;
  station.lng = pin.lng;
  if (station.radiusMeters == null) station.radiusMeters = pin.radiusMeters;
  return true;
}

export function migratePreviewStationPins(data) {
  let changed = false;
  for (const station of data?.stations || []) {
    if (applyPreviewStationPin(station)) changed = true;
  }
  return changed;
}
