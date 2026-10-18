/**
 * Daily prayer times for a branch's city — computed locally, no network.
 *
 * Method: Umm al-Qura (the Saudi official convention).
 *   - Fajr: sun 18.5° below the horizon.
 *   - Sunrise / Maghrib: the sun's upper limb on the horizon (0.833° with refraction).
 *   - Dhuhr: solar noon (equation of time).
 *   - Asr: Shafi'i — the shadow equals the object plus its noon shadow (factor 1).
 *   - Isha: 90 minutes after Maghrib; 120 minutes in Ramadan.
 * Astronomy: the standard low-precision solar position (declination + equation of time, as in
 * the USNO / PrayTimes formulation), refined once around each prayer's own moment.
 *
 * Clock: Asia/Riyadh (UTC+3, no daylight saving) for Saudi cities; other countries use the fixed
 * standard offset below. GB and US keep daylight saving; their summer days read on standard time —
 * the table is small on purpose. London's summer nights never reach 18.5°, so those days give none.
 *
 * A place without coordinates gets no times: a free-text city falls back to its region capital,
 * and to nothing when there is none (see `stationPrayerPlace`).
 */
import { COUNTRY_CAPITALS, findSaCity, saRegionCapital, stationPlace } from "./geoPlaces.js";

/** Fixed UTC offsets in hours — standard time only. */
export const COUNTRY_UTC_OFFSET = Object.freeze({
  SA: 3, AE: 4, KW: 3, QA: 3, BH: 3, OM: 4, EG: 2, JO: 3, IQ: 3, YE: 3, SD: 2,
  MA: 1, TR: 3, PK: 5, IN: 5.5, BD: 6, PH: 8, GB: 0, US: -5,
});

export const UMM_AL_QURA = Object.freeze({
  id: "umm_al_qura",
  fajrAngle: 18.5,
  ishaMinutes: 90,
  ishaRamadanMinutes: 120,
  asrFactor: 1,
  horizonAngle: 0.833,
});

export const PRAYER_KEYS = Object.freeze(["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]);

export const PRAYER_NAMES = Object.freeze({
  fajr: { ar: "الفجر", en: "Fajr" },
  sunrise: { ar: "الشروق", en: "Sunrise" },
  dhuhr: { ar: "الظهر", en: "Dhuhr" },
  asr: { ar: "العصر", en: "Asr" },
  maghrib: { ar: "المغرب", en: "Maghrib" },
  isha: { ar: "العشاء", en: "Isha" },
});

/** The five prayers — sunrise is a time, not a prayer. */
export const SALAH_KEYS = Object.freeze(["fajr", "dhuhr", "asr", "maghrib", "isha"]);

const RAD = Math.PI / 180;
const sin = (d) => Math.sin(d * RAD);
const cos = (d) => Math.cos(d * RAD);
const tan = (d) => Math.tan(d * RAD);
const asin = (x) => Math.asin(x) / RAD;
const acos = (x) => Math.acos(x) / RAD;
const atan2 = (y, x) => Math.atan2(y, x) / RAD;
const acot = (x) => Math.atan(1 / x) / RAD;
const fix = (a, b) => {
  const r = a - b * Math.floor(a / b);
  return r < 0 ? r + b : r;
};

function julianDay(year, month, day) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

/** Solar declination (degrees) and equation of time (hours) at a Julian day. */
export function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const ra = fix(atan2(cos(e) * sin(L), cos(L)) / 15, 24);
  return { declination: asin(sin(e) * sin(L)), equation: q / 15 - ra };
}

function dayKeyParts(value) {
  const raw = value instanceof Date && !Number.isNaN(value.getTime())
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
    : String(value ?? "").slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { key: raw, y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) } : null;
}

/** Minutes after local midnight → "HH:MM" (Latin digits). */
export function prayerClock(minutes) {
  if (!Number.isFinite(minutes)) return "";
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * The day's times for a point. `onDate` "YYYY-MM-DD"; `utcOffset` in hours; `ramadan` switches Isha
 * to 120 minutes. Returns { date, method, utcOffset, times: { fajr: "HH:MM", ... },
 * minutes: { fajr: n, ... } } — minutes after local midnight, rounded to the nearest minute —
 * or null when the inputs cannot give a time (no coordinates, bad date, polar day/night).
 */
export function computePrayerTimes({ lat, lng, onDate, utcOffset = 3, ramadan = false } = {}) {
  const parts = dayKeyParts(onDate);
  const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
  const la = num(lat);
  const lo = num(lng);
  if (!parts || !Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 66) return null;
  const method = UMM_AL_QURA;
  const jd = julianDay(parts.y, parts.mo, parts.d) - lo / (15 * 24);
  const noonAt = (t) => fix(12 - sunPosition(jd + t).equation, 24);
  const angleTime = (angle, t, beforeNoon) => {
    const { declination } = sunPosition(jd + t);
    const noon = noonAt(t);
    const x = (-sin(angle) - sin(declination) * sin(la)) / (cos(declination) * cos(la));
    if (x < -1 || x > 1) return NaN;
    const h = acos(x) / 15;
    return noon + (beforeNoon ? -h : h);
  };
  const asrTime = (factor, t) => {
    const { declination } = sunPosition(jd + t);
    return angleTime(-acot(factor + tan(Math.abs(la - declination))), t, false);
  };
  // First guess at each moment, then one refinement at the computed moment (hours, solar clock).
  const guess = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18 };
  const solve = (g) => ({
    fajr: angleTime(method.fajrAngle, g.fajr / 24, true),
    sunrise: angleTime(method.horizonAngle, g.sunrise / 24, true),
    dhuhr: noonAt(g.dhuhr / 24),
    asr: asrTime(method.asrFactor, g.asr / 24),
    maghrib: angleTime(method.horizonAngle, g.maghrib / 24, false),
  });
  const first = solve(guess);
  const solar = solve(first);
  const shift = utcOffset - lo / 15;
  const minutes = {};
  for (const key of ["fajr", "sunrise", "dhuhr", "asr", "maghrib"]) {
    const h = solar[key];
    if (!Number.isFinite(h)) return null;
    minutes[key] = Math.round((h + shift) * 60);
  }
  minutes.isha = minutes.maghrib + (ramadan ? method.ishaRamadanMinutes : method.ishaMinutes);
  const times = {};
  for (const key of PRAYER_KEYS) times[key] = prayerClock(minutes[key]);
  return { date: parts.key, method: method.id, utcOffset, ramadan: !!ramadan, times, minutes };
}

/**
 * Where the prayer times for a station come from: the Saudi city's own coordinates; a free-text
 * Saudi city → its region capital; another country → its capital. Null when nothing has
 * coordinates — then no prayer times are shown.
 * Returns { lat, lng, utcOffset, countryCode, cityAr, cityEn, via: "city"|"region"|"capital" }.
 */
export function stationPrayerPlace(station) {
  if (!station) return null;
  const place = stationPlace(station);
  const code = String(place.countryCode || "").toUpperCase();
  // The branch's own attendance pin is the most exact place there is — use it whenever it is set.
  const lat = Number(station.lat ?? station.latitude);
  const lng = Number(station.lng ?? station.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) {
    const cc = code || "SA";
    const offset = COUNTRY_UTC_OFFSET[cc] ?? COUNTRY_UTC_OFFSET.SA;
    return { lat, lng, utcOffset: offset, countryCode: cc, cityAr: place.city || "", cityEn: place.cityEn || "", via: "pin" };
  }
  if (!code && !place.city) {
    // No city and no pin yet: Riyadh as an approximate default (the platform is Saudi-first), marked so the
    // card says so — never hiding the employee's prayer right because a branch field is empty.
    const riyadh = findSaCity("الرياض");
    return riyadh && Number.isFinite(riyadh.lat)
      ? { lat: riyadh.lat, lng: riyadh.lng, utcOffset: COUNTRY_UTC_OFFSET.SA, countryCode: "SA", cityAr: riyadh.ar, cityEn: riyadh.en, via: "default" }
      : null;
  }
  if (!code || code === "SA") {
    const sa = findSaCity(place.city);
    if (sa && Number.isFinite(sa.lat)) {
      return { lat: sa.lat, lng: sa.lng, utcOffset: COUNTRY_UTC_OFFSET.SA, countryCode: "SA", cityAr: sa.ar, cityEn: sa.en, via: "city" };
    }
    const cap = saRegionCapital(place.cityRegion);
    if (cap) return { lat: cap.lat, lng: cap.lng, utcOffset: COUNTRY_UTC_OFFSET.SA, countryCode: "SA", cityAr: cap.ar, cityEn: cap.en, via: "region" };
    return null;
  }
  const cap = COUNTRY_CAPITALS[code];
  const offset = COUNTRY_UTC_OFFSET[code];
  if (!cap || offset == null) return null;
  return { lat: cap.lat, lng: cap.lng, utcOffset: offset, countryCode: code, cityAr: cap.ar, cityEn: cap.en, via: "capital" };
}

/** The station's prayer times on a day, or null when its place has no coordinates. */
export function stationPrayerTimes(station, onDate, { ramadan = false } = {}) {
  const place = stationPrayerPlace(station);
  if (!place) return null;
  const day = computePrayerTimes({ lat: place.lat, lng: place.lng, onDate, utcOffset: place.utcOffset, ramadan });
  return day ? { ...day, place } : null;
}

/** Flat, ordered list: [{ key, ar, en, clock, minutes }]. Sunrise is kept but marked `salah: false`. */
export function prayerList(day) {
  if (!day?.minutes) return [];
  return PRAYER_KEYS.map((key) => ({
    key,
    ar: PRAYER_NAMES[key].ar,
    en: PRAYER_NAMES[key].en,
    clock: day.times[key],
    minutes: day.minutes[key],
    salah: key !== "sunrise",
  }));
}
