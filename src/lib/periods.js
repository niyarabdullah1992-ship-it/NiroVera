// Single source of truth for report time periods across every section.
// Canonical ids: month / 3months / 6months / year / custom (+ optional daily, weekly).
export const PERIODS = [
  { id: "month", months: 1 },
  { id: "3months", months: 3 },
  { id: "6months", months: 6 },
  { id: "year", months: 12 },
  { id: "custom" },
];

// Opt-in only — never enabled by default on report period rails.
export const SHORT_PERIODS = [
  { id: "daily", days: 1 },
  { id: "weekly", days: 7 },
];

export const ALL_PERIODS = [...SHORT_PERIODS, ...PERIODS];

const LABELS = {
  daily: { ar: "يومي", en: "Daily" },
  weekly: { ar: "أسبوعي", en: "Weekly" },
  month: { ar: "شهر", en: "Month" },
  "3months": { ar: "3 أشهر", en: "3 months" },
  "6months": { ar: "6 أشهر", en: "6 months" },
  year: { ar: "سنة", en: "Year" },
  custom: { ar: "بين تاريخين", en: "Custom range" },
};

export function periodLabel(id, lang) {
  const entry = LABELS[id] || LABELS.month;
  return lang === "ar" ? entry.ar : entry.en;
}

// "2026-08-06" is parsed as UTC midnight by the standard — always build the
// date from its parts so every boundary in this file is local time.
function parseLocalDay(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
// The chosen end day is included in full — otherwise "until today" returns yesterday.
const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const dayString = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function formatRange(start, end, lang) {
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    numberingSystem: "latn",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function build(id, start, end, lang, valid = true) {
  return {
    id,
    valid,
    start,
    end,
    startDay: dayString(start),
    endDay: dayString(end),
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    label: formatRange(start, end, lang),
  };
}

// Resolves a period id (plus custom from/to) into an absolute local range.
// An invalid custom range is reported with valid:false instead of silently
// falling back — an export must never carry a range the user did not choose.
export function resolvePeriod(id, { from, to, lang = "en" } = {}) {
  const now = new Date();

  if (id === "custom") {
    const start = parseLocalDay(from);
    const end = parseLocalDay(to) || now;
    const valid = Boolean(start) && endOfDay(end) >= startOfDay(start);
    const safeStart = start || new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    return build("custom", startOfDay(valid ? start : safeStart), endOfDay(valid ? end : now), lang, valid);
  }

  const config = ALL_PERIODS.find((p) => p.id === id) || PERIODS[0];
  const start = config.days
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - (config.days - 1))
    : new Date(now.getFullYear(), now.getMonth() - (config.months || 1), now.getDate());

  return build(config.id, startOfDay(start), endOfDay(now), lang);
}