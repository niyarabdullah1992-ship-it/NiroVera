const EASTERN_TO_LATIN = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

function isArabicLang(lang) {
  return lang === true || lang === "ar" || String(lang || "").startsWith("ar");
}

/** Live UI always shows Western 0–9. Arabic copy stays Arabic. */
export function toWesternDigits(value) {
  return String(value ?? "").replace(/[٠-٩]/g, (d) => EASTERN_TO_LATIN[d] || d);
}

/** Counters and ratios. Second arg is ignored — kept so existing callers stay valid. */
export function formatUiNumber(value) {
  if (value == null || value === "") return "";
  return toWesternDigits(value);
}

/** Saved UI language (`powercare_lang`). Store/notifications read this when extras.lang is absent. */
export function getUiLang() {
  try {
    const saved = globalThis.localStorage?.getItem("powercare_lang");
    return saved === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

/** Arabic labels + Gregorian calendar + Latin digits. */
export function uiDateLocale(lang) {
  return isArabicLang(lang) ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
}

/** YYYY-MM-DD day keys stay on that calendar day (not UTC midnight). */
function toGregorianDate(date) {
  if (date instanceof Date) return date;
  const raw = String(date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(date);
}

/** Arabic currency/number grouping with Latin digits. */
export function uiNumberLocale(lang) {
  return isArabicLang(lang) ? "ar-SA-u-nu-latn" : "en-US";
}

// Explicit Gregorian-calendar date formatting. Some locales (e.g. Arabic/Saudi) can
// default to the Hijri calendar in the browser — dates in this app are always shown
// using the Gregorian calendar regardless of the active UI language.
export function formatDate(date, lang = "en", options = {}) {
  if (!date) return "";
  const d = toGregorianDate(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(uiDateLocale(lang), {
    calendar: "gregory",
    ...options,
    numberingSystem: "latn",
  }).format(d);
}

export function formatDateTime(date, lang = "en") {
  return formatDate(date, lang, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Gregorian month names for Arabic-first archive / calendar labels. */
export const AR_GREGORIAN_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function toValidDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local calendar month key (YYYY-MM). */
export function archiveMonthKey(date) {
  const d = toValidDate(date);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Local calendar day key (YYYY-MM-DD) for archive grouping. */
export function archiveDayKey(date) {
  const d = toValidDate(date);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "سبتمبر 2026" / "September 2026" — never a bare 2026-09 key. */
export function formatMonthYear(date, lang = "en") {
  const d = toValidDate(date);
  if (!d) return "";
  const ar = lang === "ar" || String(lang).startsWith("ar");
  if (ar) return `${AR_GREGORIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return formatDate(d, "en", { month: "long", year: "numeric" });
}

/** "9 سبتمبر 2026" / "9 September 2026" — Gregorian day label, Western digits. */
export function formatDayMonthYear(date, lang = "en") {
  const d = toValidDate(date);
  if (!d) return "";
  const ar = lang === "ar" || String(lang).startsWith("ar");
  if (ar) return `${d.getDate()} ${AR_GREGORIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return formatDate(d, "en", { day: "numeric", month: "long", year: "numeric" });
}

/** Year → month-key → records. Only months that have items; newest first. */
export function groupArchiveByYearMonth(items) {
  const years = new Map();
  for (const it of items || []) {
    const mk = archiveMonthKey(it?.date);
    if (!mk) continue;
    const y = Number(mk.slice(0, 4));
    if (!years.has(y)) years.set(y, new Map());
    const months = years.get(y);
    if (!months.has(mk)) months.set(mk, []);
    months.get(mk).push(it);
  }
  const yearList = Array.from(years.keys()).sort((a, b) => b - a);
  const newestMk = yearList.length
    ? Array.from(years.get(yearList[0]).keys()).sort().reverse()[0]
    : "";
  return { years, yearList, newestMk };
}

/** Year → day-key → records. Only days that have items; newest first. */
export function groupArchiveByYearDay(items) {
  const years = new Map();
  for (const it of items || []) {
    const dk = archiveDayKey(it?.date);
    if (!dk) continue;
    const y = Number(dk.slice(0, 4));
    if (!years.has(y)) years.set(y, new Map());
    const days = years.get(y);
    if (!days.has(dk)) days.set(dk, []);
    days.get(dk).push(it);
  }
  const yearList = Array.from(years.keys()).sort((a, b) => b - a);
  const newestDk = yearList.length
    ? Array.from(years.get(yearList[0]).keys()).sort().reverse()[0]
    : "";
  return { years, yearList, newestDk };
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function arUnit(n, one, two, few, many) {
  const abs = Math.abs(n);
  if (abs === 0) return many;
  if (abs === 1) return one;
  if (abs === 2) return two;
  if (abs >= 3 && abs <= 10) return few;
  return many;
}

/**
 * Smart open/elapsed duration: minutes → hours → days+hours.
 * Suitable for hazards that stay open across days.
 */
export function formatOpenDuration(openedAt, lang = "en", now = Date.now()) {
  if (!openedAt) return "";
  const start = new Date(openedAt).getTime();
  if (!Number.isFinite(start)) return "";
  const elapsed = Math.max(0, now - start);
  const ar = lang === "ar" || String(lang).startsWith("ar");

  if (elapsed < MINUTE_MS) {
    return ar ? "الآن — أقل من دقيقة" : "Just now — under a minute";
  }

  const days = Math.floor(elapsed / DAY_MS);
  const hours = Math.floor((elapsed % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((elapsed % HOUR_MS) / MINUTE_MS);

  if (days === 0 && hours === 0) {
    if (ar) {
      return `${minutes} ${arUnit(minutes, "دقيقة", "دقيقتان", "دقائق", "دقيقة")}`;
    }
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }

  if (days === 0) {
    if (minutes === 0) {
      if (ar) return `${hours} ${arUnit(hours, "ساعة", "ساعتان", "ساعات", "ساعة")}`;
      return hours === 1 ? "1 hour" : `${hours} hours`;
    }
    if (ar) {
      const h = `${hours} ${arUnit(hours, "ساعة", "ساعتان", "ساعات", "ساعة")}`;
      const m = `${minutes} ${arUnit(minutes, "دقيقة", "دقيقتان", "دقائق", "دقيقة")}`;
      return `${h} و ${m}`;
    }
    return `${hours}h ${minutes}m`;
  }

  // 1+ days: show days + hours (minutes drop away)
  if (ar) {
    const d = `${days} ${arUnit(days, "يوم", "يومان", "أيام", "يومًا")}`;
    if (hours === 0) return d;
    const h = `${hours} ${arUnit(hours, "ساعة", "ساعتان", "ساعات", "ساعة")}`;
    return `${d} و ${h}`;
  }

  if (hours === 0) {
    return days === 1 ? "1 day" : `${days} days`;
  }
  return days === 1 ? `1 day ${hours}h` : `${days} days ${hours}h`;
}

/** Compact label for chips: "مفتوح 2ي 5س" / "Open 2d 5h" */
export function formatOpenDurationShort(openedAt, lang = "en", now = Date.now()) {
  if (!openedAt) return "";
  const start = new Date(openedAt).getTime();
  if (!Number.isFinite(start)) return "";
  const elapsed = Math.max(0, now - start);
  const ar = lang === "ar" || String(lang).startsWith("ar");
  const days = Math.floor(elapsed / DAY_MS);
  const hours = Math.floor((elapsed % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((elapsed % HOUR_MS) / MINUTE_MS);

  if (elapsed < MINUTE_MS) return ar ? "<1د" : "<1m";
  if (days === 0 && hours === 0) return ar ? `${minutes}د` : `${minutes}m`;
  if (days === 0) return minutes ? (ar ? `${hours}س ${minutes}د` : `${hours}h ${minutes}m`) : (ar ? `${hours}س` : `${hours}h`);
  return hours ? (ar ? `${days}ي ${hours}س` : `${days}d ${hours}h`) : (ar ? `${days}ي` : `${days}d`);
}