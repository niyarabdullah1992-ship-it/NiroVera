/**
 * test-prayer-times.mjs — Umm al-Qura prayer times computed locally for a branch's city.
 *
 * Reference values: the Umm al-Qura timetables published by al-adkar.com
 * («طريقة الحساب: أم القرى (مكة المكرمة)», madhab Shafi'i — the Umm al-Qura Asr), read 2026-10-17:
 *   https://www.al-adkar.com/salat/riyadh/2026 · /salat/riyadh (October table)
 *   https://www.al-adkar.com/salat/jeddah/2026 · /salat/mecca/2026 · /salat/dammam/2026
 * Columns: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha ("-" = not in the source). Tolerance ±2 min.
 * The source keeps Isha at Maghrib + 90 even in Ramadan; the Umm al-Qura convention is 120 there,
 * so Ramadan days are checked on Maghrib and on Isha = Maghrib + 120.
 * Run: node scripts/test-prayer-times.mjs
 */
import assert from "node:assert/strict";
import { computePrayerTimes, COUNTRY_UTC_OFFSET, prayerList, stationPrayerPlace, stationPrayerTimes, UMM_AL_QURA } from "../src/lib/prayerTimes.js";
import { COUNTRY_CAPITALS, COUNTRY_CODES, SA_CITY_COORDS, SA_REGIONS, SA_REGION_CAPITALS, findSaCity } from "../src/lib/geoPlaces.js";

const TOLERANCE = 2;

export const UMM_AL_QURA_REFERENCE = [
  // city, date, Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha
  ["الرياض", "2026-01-01", "05:14", "06:38", "11:57", "14:56", "17:16", "18:46"],
  ["الرياض", "2026-06-21", "03:33", "05:05", "11:55", "15:16", "18:45", "20:15"],
  ["الرياض", "2026-10-17", "04:34", "-", "11:39", "14:57", "17:25", "18:55"],
  ["الرياض", "2026-12-22", "05:10", "06:34", "11:52", "14:50", "17:10", "18:40"],
  ["جدة", "2026-01-01", "05:40", "07:01", "12:27", "15:32", "17:52", "19:22"],
  ["جدة", "2026-06-21", "04:13", "05:42", "12:25", "15:45", "19:09", "20:39"],
  ["جدة", "2026-10-01", "04:58", "06:14", "12:13", "15:36", "18:11", "19:41"],
  ["جدة", "2026-10-17", "05:03", "06:20", "12:09", "15:28", "17:57", "19:27"],
  ["مكة المكرمة", "2026-01-01", "05:37", "06:58", "12:24", "15:29", "17:50", "19:20"],
  ["مكة المكرمة", "2026-06-21", "04:11", "05:39", "12:22", "15:42", "19:06", "20:36"],
  ["مكة المكرمة", "2026-10-01", "04:56", "06:12", "12:10", "15:33", "18:09", "19:39"],
  ["مكة المكرمة", "2026-10-17", "05:01", "06:17", "12:06", "15:25", "17:55", "19:25"],
  ["الدمام", "2026-01-01", "05:03", "06:28", "11:43", "14:39", "16:59", "18:29"],
  ["الدمام", "2026-06-21", "03:13", "04:47", "11:41", "15:07", "18:35", "20:05"],
  ["الدمام", "2026-10-01", "04:13", "05:32", "11:29", "14:53", "17:26", "18:56"],
  ["الدمام", "2026-10-17", "04:20", "05:40", "11:25", "14:42", "17:10", "18:40"],
];
/** A Ramadan day (12 Ramadan 1447): the source's Maghrib, Isha read as Maghrib + 120. */
export const UMM_AL_QURA_RAMADAN_REFERENCE = [["الرياض", "2026-03-01", "04:58", "06:16", "12:06", "15:27", "17:56"]];

const KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
const toM = (hm) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};

let worst = 0;
for (const [city, date, ...want] of UMM_AL_QURA_REFERENCE) {
  const [lat, lng] = SA_CITY_COORDS[city];
  const day = computePrayerTimes({ lat, lng, onDate: date, utcOffset: 3 });
  assert.ok(day, `${city} ${date} computes`);
  KEYS.forEach((key, i) => {
    if (want[i] === "-") return;
    const diff = Math.abs(day.minutes[key] - toM(want[i]));
    worst = Math.max(worst, diff);
    assert.ok(diff <= TOLERANCE, `${city} ${date} ${key}: got ${day.times[key]}, published ${want[i]}`);
  });
  assert.equal(day.minutes.isha - day.minutes.maghrib, UMM_AL_QURA.ishaMinutes, "Isha = Maghrib + 90 outside Ramadan");
}
for (const [city, date, ...want] of UMM_AL_QURA_RAMADAN_REFERENCE) {
  const [lat, lng] = SA_CITY_COORDS[city];
  const day = computePrayerTimes({ lat, lng, onDate: date, utcOffset: 3, ramadan: true });
  KEYS.slice(0, 5).forEach((key, i) => assert.ok(Math.abs(day.minutes[key] - toM(want[i])) <= TOLERANCE, `${city} ${date} ${key} (Ramadan)`));
  assert.equal(day.minutes.isha - day.minutes.maghrib, 120, "Isha = Maghrib + 120 in Ramadan");
  assert.equal(day.times.isha, "19:56");
}
console.log(`PASS Umm al-Qura reference — ${UMM_AL_QURA_REFERENCE.length} city-days, worst ${worst} min (±${TOLERANCE})`);

/* the method constants */
assert.equal(UMM_AL_QURA.fajrAngle, 18.5);
assert.equal(UMM_AL_QURA.asrFactor, 1, "Shafi'i Asr");
assert.equal(UMM_AL_QURA.ishaRamadanMinutes, 120);

/* every Saudi city has coordinates inside the Kingdom; region capitals resolve */
const all = SA_REGIONS.flatMap((r) => r.cities);
assert.equal(Object.keys(SA_CITY_COORDS).length, all.length, "one coordinate pair per listed city");
for (const city of all) {
  const at = SA_CITY_COORDS[city.ar];
  assert.ok(at, `coordinates for ${city.ar}`);
  assert.ok(at[0] > 16 && at[0] < 32.5 && at[1] > 34 && at[1] < 56, `${city.ar} inside Saudi Arabia`);
  assert.ok(Number.isFinite(findSaCity(city.ar).lat), `findSaCity carries lat for ${city.ar}`);
}
assert.equal(Object.keys(SA_REGION_CAPITALS).length, 13);
for (const code of COUNTRY_CODES) {
  assert.ok(COUNTRY_CAPITALS[code], `capital for ${code}`);
  assert.ok(COUNTRY_UTC_OFFSET[code] != null, `offset for ${code}`);
}
console.log("PASS coordinates — every Saudi city, 13 region capitals, every listed country's capital");

/* a station's place: the city, else its region capital, else nothing */
assert.equal(stationPrayerPlace({ countryCode: "SA", city: "الخفجي", cityRegion: "eastern" }).via, "city");
assert.equal(stationPrayerPlace({ name: "فرع الخفجي" }).cityAr, "الخفجي", "a city derived from the name");
const freeText = stationPrayerPlace({ countryCode: "SA", city: "حي لا يوجد", cityRegion: "qassim" });
assert.deepEqual([freeText.via, freeText.cityAr], ["region", "بريدة"], "free text → the region capital");
assert.equal(stationPrayerPlace({ countryCode: "SA", city: "حي لا يوجد" }), null, "no region → no prayer times");
{
  // No city and no pin: an approximate Riyadh day, marked — the prayer right never vanishes for an empty field.
  const approx = stationPrayerTimes({ name: "المكتب الرئيسي" }, "2026-10-17");
  assert.equal(approx?.place?.via, "default", "no place → approximate Riyadh, marked");
  // The branch's attendance pin wins over its city.
  assert.equal(stationPrayerPlace({ city: "الرياض", lat: 28.43, lng: 48.49 }).via, "pin", "the pin is the place");
  assert.equal(stationPrayerTimes({ countryCode: "ZZ" }, "2026-10-17"), null, "an unknown country stays without times");
}
const dubai = stationPrayerPlace({ countryCode: "AE", city: "Dubai" });
assert.deepEqual([dubai.via, dubai.cityEn, dubai.utcOffset], ["capital", "Abu Dhabi", 4], "another country → its capital, its fixed offset");
const khafji = stationPrayerTimes({ name: "فرع الخفجي" }, "2026-10-17");
assert.equal(khafji.place.utcOffset, 3, "Saudi cities on Asia/Riyadh (UTC+3)");
assert.equal(prayerList(khafji).length, 6);
assert.equal(prayerList(khafji).filter((p) => p.salah).length, 5, "sunrise is listed but is not a prayer");
assert.ok(/^\d{2}:\d{2}$/.test(khafji.times.dhuhr), "Latin-digit clock");
assert.equal(computePrayerTimes({ lat: null, lng: 1, onDate: "2026-10-17" }), null, "no coordinates → null");
assert.equal(computePrayerTimes({ lat: 24, lng: 46, onDate: "bad" }), null, "bad date → null");
console.log("PASS station place fallback — city → region capital → none; foreign capital with its offset");
console.log("ALL PASS test-prayer-times");
