/**
 * Where a branch is: country → (Saudi) administrative region → city / governorate.
 *
 * Arabic first, English kept for the EN interface. Saudi Arabia lists the cities and governorates
 * people actually use, grouped by its 13 administrative regions; other countries take a free-text
 * city. Stations store `countryCode`, `city` (the Arabic name for Saudi cities) and `cityRegion`
 * (the Saudi region id). Old stations without them get a city DERIVED from their name / location
 * text for display grouping only — nothing is written until someone saves a location.
 * The server twin is base44/shared/geoPlaces.ts (org createBranch, companyDirectory syncStations).
 */

const str = (value) => String(value ?? "").trim();

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

const c = (ar, en, aliases = []) => ({ ar, en, aliases });

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
export function foldPlace(value) {
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

/**
 * Coordinates of every Saudi city above — [lat, lng], decimal degrees (city / governorate seat).
 * Used for the branch's prayer times (prayerTimes.js); a city missing here gets none.
 */
export const SA_CITY_COORDS = Object.freeze({
  // منطقة الرياض
  "الرياض": [24.7136, 46.6753], "الخرج": [24.1556, 47.3120], "الدرعية": [24.7340, 46.5750], "الدوادمي": [24.5070, 44.3920],
  "المجمعة": [25.9040, 45.3450], "القويعية": [24.0730, 45.2810], "وادي الدواسر": [20.4600, 44.7830], "الأفلاج": [22.2900, 46.7270],
  "الزلفي": [26.2990, 44.8150], "شقراء": [25.2500, 45.2530], "حوطة بني تميم": [23.4900, 46.7560], "عفيف": [23.9070, 42.9170],
  "السليل": [20.4610, 45.5770], "ضرما": [24.6000, 46.1270], "المزاحمية": [24.4720, 46.2630], "رماح": [25.5660, 47.1580],
  "ثادق": [25.2880, 45.8670], "حريملاء": [25.1280, 46.1110], "الحريق": [23.6200, 46.5150], "الغاط": [26.0280, 44.9600],
  "مرات": [25.0700, 45.4600], "الدلم": [23.9930, 47.1620],
  // منطقة مكة المكرمة
  "مكة المكرمة": [21.4225, 39.8262], "جدة": [21.4858, 39.1925], "الطائف": [21.2703, 40.4158], "القنفذة": [19.1260, 41.0790],
  "الليث": [20.1500, 40.2700], "رابغ": [22.7984, 39.0349], "خليص": [22.1470, 39.3250], "الجموم": [21.6170, 39.7000],
  "الكامل": [22.2000, 39.9800], "الخرمة": [21.9190, 42.0410], "رنية": [21.2590, 42.8500], "تربة": [21.2140, 41.6330],
  "بحرة": [21.4000, 39.4500], "أضم": [20.4800, 40.1000], "الموية": [22.4330, 41.7580], "ميسان": [20.7400, 40.8700],
  "العرضيات": [19.7300, 41.4400],
  // منطقة المدينة المنورة
  "المدينة المنورة": [24.4672, 39.6111], "ينبع": [24.0890, 38.0630], "العلا": [26.6085, 37.9232], "مهد الذهب": [23.4990, 40.8570],
  "بدر": [23.7800, 38.7900], "خيبر": [25.6950, 39.2930], "الحناكية": [24.8600, 40.5100], "العيص": [25.0620, 38.1060],
  "وادي الفرع": [23.8700, 39.4400],
  // منطقة القصيم
  "بريدة": [26.3260, 43.9750], "عنيزة": [26.0840, 43.9930], "الرس": [25.8690, 43.4980], "المذنب": [25.8600, 44.2220],
  "البكيرية": [26.1400, 43.6600], "البدائع": [25.9800, 43.7300], "الأسياح": [26.4500, 44.3000], "النبهانية": [25.8700, 43.0500],
  "الشماسية": [26.3070, 44.2700], "عيون الجواء": [26.5000, 43.7800], "رياض الخبراء": [25.9900, 43.5500], "عقلة الصقور": [25.8300, 42.1800],
  "ضرية": [24.3800, 43.2800],
  // المنطقة الشرقية
  "الدمام": [26.4207, 50.0888], "الخبر": [26.2172, 50.1971], "الظهران": [26.2886, 50.1140], "الأحساء": [25.3830, 49.5860],
  "الجبيل": [27.0174, 49.6225], "القطيف": [26.5560, 50.0090], "حفر الباطن": [28.4342, 45.9636], "الخفجي": [28.4391, 48.4912],
  "رأس تنورة": [26.6440, 50.1590], "بقيق": [25.9350, 49.6680], "النعيرية": [27.4700, 48.4900], "قرية العليا": [27.5500, 47.7000],
  "العديد": [24.6500, 51.3000],
  // منطقة عسير
  "أبها": [18.2164, 42.5053], "خميس مشيط": [18.3000, 42.7300], "بيشة": [19.9840, 42.6050], "النماص": [19.1200, 42.1300],
  "محايل عسير": [18.5440, 42.0510], "ظهران الجنوب": [17.6500, 43.5200], "تثليث": [19.5300, 43.5100], "سراة عبيدة": [18.0900, 43.1500],
  "رجال ألمع": [18.2160, 42.2660], "أحد رفيدة": [18.2100, 42.8500], "بلقرن": [19.8000, 41.9300], "المجاردة": [19.1200, 41.9100],
  "البرك": [18.2100, 41.5400], "تنومة": [18.9300, 42.1600],
  // منطقة تبوك
  "تبوك": [28.3838, 36.5550], "الوجه": [26.2350, 36.4700], "ضباء": [27.3500, 35.6900], "تيماء": [27.6300, 38.5500],
  "أملج": [25.0210, 37.2690], "حقل": [29.2900, 34.9400], "البدع": [28.4900, 35.0200], "نيوم": [27.9500, 35.3000],
  // منطقة حائل
  "حائل": [27.5114, 41.7208], "بقعاء": [27.8900, 42.4000], "الغزالة": [26.7900, 41.3200], "الشنان": [27.1800, 42.4400],
  "الحائط": [25.9900, 40.4700], "السليمي": [26.2900, 41.3600], "الشملي": [26.7900, 40.3200], "موقق": [27.3800, 41.1700],
  // منطقة الحدود الشمالية
  "عرعر": [30.9753, 41.0381], "رفحاء": [29.6260, 43.4950], "طريف": [31.6720, 38.6630], "العويقيلة": [30.3400, 42.2500],
  // منطقة جازان
  "جازان": [16.8892, 42.5511], "صبيا": [17.1500, 42.6250], "أبو عريش": [16.9690, 42.8320], "صامطة": [16.5960, 42.9440],
  "بيش": [17.3800, 42.5300], "الدرب": [17.7200, 42.2500], "العارضة": [17.0300, 43.0700], "أحد المسارحة": [16.7100, 42.9600],
  "فرسان": [16.7020, 42.1180], "الريث": [17.6700, 42.8500], "ضمد": [17.1100, 42.7700], "الطوال": [16.5400, 42.9900],
  "العيدابي": [17.2400, 43.0500], "الدائر": [17.3500, 43.1500],
  // منطقة نجران
  "نجران": [17.4924, 44.1277], "شرورة": [17.4840, 47.1150], "حبونا": [17.8000, 44.2000], "بدر الجنوب": [17.8800, 43.7300],
  "يدمة": [18.6700, 44.4900], "ثار": [17.5800, 43.9300], "خباش": [17.6500, 46.4000],
  // منطقة الباحة
  "الباحة": [20.0129, 41.4677], "بلجرشي": [19.8600, 41.5600], "المندق": [20.1600, 41.2800], "المخواة": [19.7900, 41.4300],
  "قلوة": [19.8800, 41.3000], "العقيق": [20.2700, 41.6400], "القرى": [20.1200, 41.3700], "بني حسن": [20.1000, 41.3500],
  // منطقة الجوف
  "سكاكا": [29.9697, 40.2064], "القريات": [31.3317, 37.3428], "دومة الجندل": [29.8114, 39.8681], "طبرجل": [30.5000, 38.2200],
});

/** Each Saudi region's capital (its seat) — the fallback for a city with no coordinates. */
export const SA_REGION_CAPITALS = Object.freeze({
  riyadh: "الرياض", makkah: "مكة المكرمة", madinah: "المدينة المنورة", qassim: "بريدة", eastern: "الدمام",
  asir: "أبها", tabuk: "تبوك", hail: "حائل", northern: "عرعر", jazan: "جازان", najran: "نجران", baha: "الباحة", jouf: "سكاكا",
});

/** Capitals of the other listed countries — the only point a free-text foreign city resolves to. */
export const COUNTRY_CAPITALS = Object.freeze({
  SA: { ar: "الرياض", en: "Riyadh", lat: 24.7136, lng: 46.6753 },
  AE: { ar: "أبوظبي", en: "Abu Dhabi", lat: 24.4539, lng: 54.3773 },
  KW: { ar: "الكويت", en: "Kuwait City", lat: 29.3759, lng: 47.9774 },
  QA: { ar: "الدوحة", en: "Doha", lat: 25.2854, lng: 51.5310 },
  BH: { ar: "المنامة", en: "Manama", lat: 26.2235, lng: 50.5876 },
  OM: { ar: "مسقط", en: "Muscat", lat: 23.5880, lng: 58.3829 },
  EG: { ar: "القاهرة", en: "Cairo", lat: 30.0444, lng: 31.2357 },
  JO: { ar: "عمّان", en: "Amman", lat: 31.9454, lng: 35.9284 },
  IQ: { ar: "بغداد", en: "Baghdad", lat: 33.3152, lng: 44.3661 },
  YE: { ar: "صنعاء", en: "Sanaa", lat: 15.3694, lng: 44.1910 },
  SD: { ar: "الخرطوم", en: "Khartoum", lat: 15.5007, lng: 32.5599 },
  MA: { ar: "الرباط", en: "Rabat", lat: 34.0209, lng: -6.8416 },
  TR: { ar: "أنقرة", en: "Ankara", lat: 39.9334, lng: 32.8597 },
  PK: { ar: "إسلام آباد", en: "Islamabad", lat: 33.6844, lng: 73.0479 },
  IN: { ar: "نيودلهي", en: "New Delhi", lat: 28.6139, lng: 77.2090 },
  BD: { ar: "دكا", en: "Dhaka", lat: 23.8103, lng: 90.4125 },
  PH: { ar: "مانيلا", en: "Manila", lat: 14.5995, lng: 120.9842 },
  GB: { ar: "لندن", en: "London", lat: 51.5074, lng: -0.1278 },
  US: { ar: "واشنطن", en: "Washington", lat: 38.9072, lng: -77.0369 },
});

const SA_CITIES = SA_REGIONS.flatMap((r) => r.cities.map((city) => {
  const at = SA_CITY_COORDS[city.ar];
  return { ...city, regionId: r.id, regionAr: r.ar, regionEn: r.en, ...(at ? { lat: at[0], lng: at[1] } : {}) };
}));

/** The region capital as a city with coordinates, or null. */
export function saRegionCapital(regionId) {
  const name = SA_REGION_CAPITALS[str(regionId)];
  if (!name) return null;
  return SA_CITIES.find((city) => city.ar === name && Number.isFinite(city.lat)) || null;
}

export function countryOf(code) {
  return COUNTRIES.find((c2) => c2.code === str(code).toUpperCase()) || null;
}
export function saRegionOf(id) {
  return SA_REGIONS.find((r) => r.id === str(id)) || null;
}

/** A Saudi city by its Arabic or English name (or a known alias), or null. */
export function findSaCity(name) {
  const f = foldPlace(name);
  if (!f) return null;
  return SA_CITIES.find((city) => foldPlace(city.ar) === f || foldPlace(city.en) === f || city.aliases.some((a) => foldPlace(a) === f)) || null;
}

/**
 * Picker search inside Saudi cities: name starts first, then contains; the region name matches too.
 * @returns {Array<{ ar, en, regionId, regionAr, regionEn }>}
 */
export function searchSaCities(query, limit = 40) {
  const f = foldPlace(query);
  if (!f) return SA_CITIES.slice(0, limit);
  const rank = (city) => {
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
export function matchCityInText(text) {
  const f = ` ${foldPlace(text)} `;
  if (!f.trim()) return null;
  let best = null;
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
export function stationPlace(station) {
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
export function checkStationLocationGate({ countryCode, city, cityRegion } = {}) {
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
