/**
 * Where a branch is: country → (Saudi) administrative region → city / governorate.
 *
 * Arabic first, English kept for the EN interface. Saudi Arabia lists the cities and governorates
 * people actually use, grouped by its 13 administrative regions; other countries take a free-text
 * city. Stations store `countryCode`, `city` (the Arabic name for Saudi cities) and `cityRegion`
 * (the Saudi region id). Old stations without them get a city DERIVED from their name / location
 * text for display grouping only — nothing is written until someone saves a location.
 * Twin of src/lib/geoPlaces.js (scripts/test-org-geo.mjs keeps them equal).
 */

// deno-lint-ignore-file no-explicit-any
const str = (value: unknown): string => String(value ?? "").trim();

export const DEFAULT_COUNTRY = "SA";

export const COUNTRIES = Object.freeze([
  { code: "SA", ar: "السعودية", en: "Saudi Arabia" },
  { code: "AE", ar: "الإمارات", en: "United Arab Emirates" },
  { code: "KW", ar: "الكويت", en: "Kuwait" },
  { code: "QA", ar: "قطر", en: "Qatar" },
  { code: "BH", ar: "البحرين", en: "Bahrain" },
  { code: "OM", ar: "عُمان", en: "Oman" },
  { code: "EG", ar: "مصر", en: "Egypt" },
  { code: "JO", ar: "الأردن", en: "Jordan" },
  { code: "IQ", ar: "العراق", en: "Iraq" },
  { code: "YE", ar: "اليمن", en: "Yemen" },
  { code: "SD", ar: "السودان", en: "Sudan" },
  { code: "MA", ar: "المغرب", en: "Morocco" },
  { code: "TR", ar: "تركيا", en: "Türkiye" },
  { code: "PK", ar: "باكستان", en: "Pakistan" },
  { code: "IN", ar: "الهند", en: "India" },
  { code: "BD", ar: "بنغلاديش", en: "Bangladesh" },
  { code: "PH", ar: "الفلبين", en: "Philippines" },
  { code: "GB", ar: "المملكة المتحدة", en: "United Kingdom" },
  { code: "US", ar: "الولايات المتحدة", en: "United States" },
]);
export const COUNTRY_CODES = Object.freeze(COUNTRIES.map((c) => c.code));

type City = { ar: string; en: string; aliases: string[] };
const c = (ar: string, en: string, aliases: string[] = []): City => ({ ar, en, aliases });

/** Saudi Arabia — the 13 administrative regions and their cities / governorates. */
export const SA_REGIONS = Object.freeze([
  { id: "riyadh", ar: "منطقة الرياض", en: "Riyadh Region", cities: [
    c("الرياض", "Riyadh"), c("الخرج", "Al Kharj"), c("الدرعية", "Diriyah"), c("الدوادمي", "Ad Dawadimi"), c("المجمعة", "Al Majmaah"),
    c("القويعية", "Al Quwayiyah"), c("وادي الدواسر", "Wadi Ad-Dawasir"), c("الأفلاج", "Al Aflaj", ["ليلى"]), c("الزلفي", "Az Zulfi"), c("شقراء", "Shaqra"),
    c("حوطة بني تميم", "Hotat Bani Tamim"), c("عفيف", "Afif"), c("السليل", "As Sulayyil"), c("ضرما", "Dhurma"), c("المزاحمية", "Al Muzahimiyah"),
    c("رماح", "Rumah"), c("ثادق", "Thadiq"), c("حريملاء", "Huraymila"), c("الحريق", "Al Hariq"), c("الغاط", "Al Ghat"), c("مرات", "Marat"), c("الدلم", "Ad Dilam"),
  ] },
  { id: "makkah", ar: "منطقة مكة المكرمة", en: "Makkah Region", cities: [
    c("مكة المكرمة", "Makkah", ["مكة"]), c("جدة", "Jeddah", ["جده"]), c("الطائف", "Taif"), c("القنفذة", "Al Qunfudhah"), c("الليث", "Al Lith"),
    c("رابغ", "Rabigh"), c("خليص", "Khulais"), c("الجموم", "Al Jumum"), c("الكامل", "Al Kamil"), c("الخرمة", "Al Khurmah"), c("رنية", "Ranyah"),
    c("تربة", "Turabah"), c("بحرة", "Bahrah"), c("أضم", "Adham"), c("الموية", "Al Muwayh"), c("ميسان", "Maysan"), c("العرضيات", "Al Ardiyat"),
  ] },
  { id: "madinah", ar: "منطقة المدينة المنورة", en: "Madinah Region", cities: [
    c("المدينة المنورة", "Madinah", ["المدينه", "المدينة"]), c("ينبع", "Yanbu"), c("العلا", "AlUla"), c("مهد الذهب", "Mahd adh Dhahab"), c("بدر", "Badr"),
    c("خيبر", "Khaybar"), c("الحناكية", "Al Hanakiyah"), c("العيص", "Al Ais"), c("وادي الفرع", "Wadi Al Fara"),
  ] },
  { id: "qassim", ar: "منطقة القصيم", en: "Qassim Region", cities: [
    c("بريدة", "Buraydah"), c("عنيزة", "Unaizah"), c("الرس", "Ar Rass"), c("المذنب", "Al Mithnab"), c("البكيرية", "Al Bukayriyah"),
    c("البدائع", "Al Badai"), c("الأسياح", "Al Asyah"), c("النبهانية", "An Nabhaniyah"), c("الشماسية", "Ash Shimasiyah"), c("عيون الجواء", "Uyun Al Jiwa"),
    c("رياض الخبراء", "Riyadh Al Khabra"), c("عقلة الصقور", "Uqlat As Suqur"), c("ضرية", "Dariyah"),
  ] },
  { id: "eastern", ar: "المنطقة الشرقية", en: "Eastern Province", cities: [
    c("الدمام", "Dammam"), c("الخبر", "Khobar"), c("الظهران", "Dhahran"), c("الأحساء", "Al Ahsa", ["الهفوف", "المبرز", "الاحساء"]), c("الجبيل", "Jubail"),
    c("القطيف", "Qatif", ["سيهات", "صفوى"]), c("حفر الباطن", "Hafr Al Batin"), c("الخفجي", "Khafji"), c("رأس تنورة", "Ras Tanura"), c("بقيق", "Abqaiq"),
    c("النعيرية", "Al Nairyah"), c("قرية العليا", "Qaryat Al Ulya"), c("العديد", "Al Udayd"),
  ] },
  { id: "asir", ar: "منطقة عسير", en: "Asir Region", cities: [
    c("أبها", "Abha"), c("خميس مشيط", "Khamis Mushait"), c("بيشة", "Bisha"), c("النماص", "An Namas"), c("محايل عسير", "Muhayil"),
    c("ظهران الجنوب", "Dhahran Al Janub"), c("تثليث", "Tathlith"), c("سراة عبيدة", "Sarat Abidah"), c("رجال ألمع", "Rijal Almaa"), c("أحد رفيدة", "Ahad Rafidah"),
    c("بلقرن", "Balqarn"), c("المجاردة", "Al Majardah"), c("البرك", "Al Birk"), c("تنومة", "Tanomah"),
  ] },
  { id: "tabuk", ar: "منطقة تبوك", en: "Tabuk Region", cities: [
    c("تبوك", "Tabuk"), c("الوجه", "Al Wajh"), c("ضباء", "Duba"), c("تيماء", "Tayma"), c("أملج", "Umluj"), c("حقل", "Haql"), c("البدع", "Al Bad"), c("نيوم", "NEOM"),
  ] },
  { id: "hail", ar: "منطقة حائل", en: "Hail Region", cities: [
    c("حائل", "Hail"), c("بقعاء", "Baqaa"), c("الغزالة", "Al Ghazalah"), c("الشنان", "Ash Shinan"), c("الحائط", "Al Hait"), c("السليمي", "As Sulaymi"), c("الشملي", "Ash Shamli"), c("موقق", "Mawqaq"),
  ] },
  { id: "northern", ar: "منطقة الحدود الشمالية", en: "Northern Borders Region", cities: [
    c("عرعر", "Arar"), c("رفحاء", "Rafha"), c("طريف", "Turaif"), c("العويقيلة", "Al Uwayqilah"),
  ] },
  { id: "jazan", ar: "منطقة جازان", en: "Jazan Region", cities: [
    c("جازان", "Jazan", ["جيزان"]), c("صبيا", "Sabya"), c("أبو عريش", "Abu Arish"), c("صامطة", "Samtah"), c("بيش", "Baish"), c("الدرب", "Ad Darb"),
    c("العارضة", "Al Aridah"), c("أحد المسارحة", "Ahad Al Masarihah"), c("فرسان", "Farasan"), c("الريث", "Ar Rayth"), c("ضمد", "Damad"),
    c("الطوال", "At Tuwal"), c("العيدابي", "Al Idabi"), c("الدائر", "Ad Dair"),
  ] },
  { id: "najran", ar: "منطقة نجران", en: "Najran Region", cities: [
    c("نجران", "Najran"), c("شرورة", "Sharurah"), c("حبونا", "Hubuna"), c("بدر الجنوب", "Badr Al Janub"), c("يدمة", "Yadamah"), c("ثار", "Thar"), c("خباش", "Khubash"),
  ] },
  { id: "baha", ar: "منطقة الباحة", en: "Al Baha Region", cities: [
    c("الباحة", "Al Baha"), c("بلجرشي", "Baljurashi"), c("المندق", "Al Mandaq"), c("المخواة", "Al Makhwah"), c("قلوة", "Qilwah"), c("العقيق", "Al Aqiq"), c("القرى", "Al Qura"), c("بني حسن", "Bani Hasan"),
  ] },
  { id: "jouf", ar: "منطقة الجوف", en: "Al Jouf Region", cities: [
    c("سكاكا", "Sakaka"), c("القريات", "Al Qurayyat"), c("دومة الجندل", "Dumat Al Jandal"), c("طبرجل", "Tabarjal"),
  ] },
]);

/** Arabic-tolerant fold: no diacritics/tatweel, one alef, ى→ي, ة→ه, Latin lower-case. */
export function foldPlace(value: unknown): string {
  return str(value)
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type SaCity = City & { regionId: string; regionAr: string; regionEn: string };
const SA_CITIES: SaCity[] = SA_REGIONS.flatMap((r) => r.cities.map((city) => ({ ...city, regionId: r.id, regionAr: r.ar, regionEn: r.en })));

export function countryOf(code: unknown) {
  return COUNTRIES.find((c2) => c2.code === str(code).toUpperCase()) || null;
}
export function saRegionOf(id: unknown) {
  return SA_REGIONS.find((r) => r.id === str(id)) || null;
}

/** A Saudi city by its Arabic or English name (or a known alias), or null. */
export function findSaCity(name: unknown): SaCity | null {
  const f = foldPlace(name);
  if (!f) return null;
  return SA_CITIES.find((city) => foldPlace(city.ar) === f || foldPlace(city.en) === f || city.aliases.some((a) => foldPlace(a) === f)) || null;
}

/**
 * Picker search inside Saudi cities: name starts first, then contains; the region name matches too.
 * @returns {Array<{ ar, en, regionId, regionAr, regionEn }>}
 */
export function searchSaCities(query: unknown, limit = 40): SaCity[] {
  const f = foldPlace(query);
  if (!f) return SA_CITIES.slice(0, limit);
  const rank = (city: SaCity) => {
    const names = [city.ar, city.en, ...city.aliases].map(foldPlace);
    if (names.some((n) => n.startsWith(f))) return 0;
    if (names.some((n) => n.includes(f))) return 1;
    if (foldPlace(city.regionAr).includes(f) || foldPlace(city.regionEn).includes(f)) return 2;
    return 9;
  };
  return SA_CITIES.map((city) => ({ city, r: rank(city) }))
    .filter((x) => x.r < 9)
    .sort((a, b) => a.r - b.r)
    .slice(0, limit)
    .map((x) => x.city);
}

/**
 * The migration matcher: a Saudi city named in free text («فرع جدة» → جدة, «Dammam site» →
 * الدمام), whole words only, the longest name wins («خميس مشيط» before «خميس»). Null when unclear.
 */
export function matchCityInText(text: unknown): SaCity | null {
  const f = ` ${foldPlace(text)} `;
  if (!f.trim()) return null;
  let best: SaCity | null = null;
  let bestLen = 0;
  SA_CITIES.forEach((city) => {
    [city.ar, city.en, ...city.aliases].forEach((name) => {
      const n = foldPlace(name);
      if (n.length < 3) return;
      // whole word: Arabic names may take a leading «ب/ل/و» rarely — only exact words count here
      if (f.includes(` ${n} `) && n.length > bestLen) { best = city; bestLen = n.length; }
    });
  });
  return best;
}

/**
 * A station's place: stored fields first; else derived from its city / location / name text
 * (display only). Returns { countryCode, city, cityRegion, cityEn, regionAr, regionEn, derived }.
 * `city` is "" when nothing is known.
 */
export function stationPlace(station: any) {
  const code = str(station?.countryCode).toUpperCase();
  const storedCity = str(station?.city);
  if (code || storedCity) {
    const sa = (!code || code === "SA") ? findSaCity(storedCity) : null;
    const region = saRegionOf(station?.cityRegion) || (sa ? saRegionOf(sa.regionId) : null);
    return {
      countryCode: code || (sa ? "SA" : DEFAULT_COUNTRY),
      city: sa ? sa.ar : storedCity,
      cityEn: sa ? sa.en : storedCity,
      cityRegion: region?.id || "",
      regionAr: region?.ar || "",
      regionEn: region?.en || "",
      derived: false,
    };
  }
  const hit = matchCityInText(`${str(station?.location)} ${str(station?.name)}`);
  if (!hit) return { countryCode: "", city: "", cityEn: "", cityRegion: "", regionAr: "", regionEn: "", derived: false };
  return { countryCode: "SA", city: hit.ar, cityEn: hit.en, cityRegion: hit.regionId, regionAr: hit.regionAr, regionEn: hit.regionEn, derived: true };
}

/**
 * The location gate (same rule on the server): a known country; a Saudi branch needs a city
 * from the list. Returns { ok, place } with the normalised fields, or a named reason.
 */
export type StationPlace = { countryCode: string; city: string; cityRegion: string };
export type GeoGate =
  | { ok: true; place: StationPlace }
  | { ok: false; error: string; reason: string; reasonEn: string };

export function checkStationLocationGate({ countryCode, city, cityRegion }: { countryCode?: unknown; city?: unknown; cityRegion?: unknown } = {}): GeoGate {
  const code = str(countryCode).toUpperCase();
  if (!code) return { ok: false, error: "GEO_COUNTRY_REQUIRED", reason: "اختر الدولة.", reasonEn: "Pick the country." };
  if (!COUNTRY_CODES.includes(code)) return { ok: false, error: "GEO_COUNTRY_UNKNOWN", reason: "دولة غير معروفة في القائمة.", reasonEn: "Unknown country." };
  const name = str(city);
  if (code === "SA") {
    if (!name) return { ok: false, error: "GEO_CITY_REQUIRED", reason: "اختر المدينة — مطلوبة لفروع السعودية.", reasonEn: "Pick the city — required for branches in Saudi Arabia." };
    const sa = findSaCity(name);
    if (!sa) return { ok: false, error: "GEO_CITY_UNKNOWN", reason: "المدينة ليست في قائمة مدن السعودية — اخترها من القائمة.", reasonEn: "That city is not on the Saudi list — pick it from the list." };
    return { ok: true, place: { countryCode: "SA", city: sa.ar, cityRegion: sa.regionId } };
  }
  if (name.length > 80) return { ok: false, error: "GEO_CITY_LONG", reason: "اسم المدينة طويل.", reasonEn: "The city name is too long." };
  return { ok: true, place: { countryCode: code, city: name, cityRegion: str(cityRegion) } };
}
