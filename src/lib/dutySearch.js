/**
 * dutySearch.js — the smart search of الحضور والدوام: one free-text box that understands
 * names, duty statuses, dates / periods and page names together, in Arabic or English.
 *
 * Pure (relative imports only, node-testable). The component resolves the parsed intent against
 * the same day records سجلي reads (myDutyDay) — this file never decides a status.
 *
 *   «غياب أحمد سبتمبر»  → people: أحمد · statuses: absent · period: September (latest past one)
 *   «تأخير هذا الأسبوع» → statuses: late · period: this week (Sunday–Saturday)
 *   «نيار 2026»          → people: نيار · period: calendar year 2026
 *   «جدولي»              → page: جدولي
 */

import { addDayKey, contractYearWindows, dayKeyOf, parseDayKey, windowOf } from "./dutyYears.js";

/* ------------------------------------------ normalize ------------------------------------------ */

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

/** Arabic-aware fold: no tashkeel/tatweel, أ/إ/آ/ٱ→ا, ة→ه, ى→ي, Arabic-Indic digits → Latin, lower case. */
export function normalizeDutyText(value) {
  return String(value || "")
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)))
    .replace(/[،؛,;،]+/g, " ")
    .replace(/[‎‏‪-‮]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------ vocabulary ------------------------------------------ */

/** Status words → dutyStatus keys (plus «ليلي» / «مكشوف», which read the roster cell). */
export const DUTY_SEARCH_STATUSES = [
  { id: "absent", ar: "غياب", en: "Absent", words: ["غياب", "غيابي", "غيابات", "غائب", "غايب", "غاب", "غائبين", "absent", "absence", "absences"] },
  { id: "late", ar: "تأخير", en: "Late", words: ["تاخير", "تاخيري", "تاخيرات", "متاخر", "متاخرين", "تاخر", "late", "lateness"] },
  { id: "attended", ar: "حضور", en: "Attended", words: ["حضور", "حضوري", "حاضر", "حضر", "present", "attended", "attendance"] },
  { id: "leave", ar: "إجازة", en: "Leave", words: ["اجازه", "اجازاتي", "اجازتي", "اجازات", "leave", "vacation"] },
  { id: "holiday", ar: "إجازة رسمية", en: "Official holiday", words: ["عيد", "رسميه", "holiday"] },
  { id: "rest", ar: "راحة", en: "Rest", words: ["راحه", "rest", "off"] },
  { id: "open", ar: "بلا انصراف", en: "No checkout", words: ["انصراف", "بلاانصراف", "checkout"] },
  { id: "manual", ar: "اعتماد يدوي", en: "Manual", words: ["يدوي", "يدويا", "manual"] },
  { id: "exposed", ar: "مكشوف", en: "Exposed", words: ["مكشوف", "مكشوفه", "exposed", "field"] },
  { id: "night", ar: "ليلي", en: "Night", words: ["ليلي", "ليليه", "ليل", "night"] },
];

const MONTHS = [
  ["يناير", "كانون الثاني", "january", "jan"],
  ["فبراير", "شباط", "february", "feb"],
  ["مارس", "اذار", "march", "mar"],
  ["ابريل", "نيسان", "april", "apr"],
  ["مايو", "ايار", "may"],
  ["يونيو", "يونيه", "حزيران", "june", "jun"],
  ["يوليو", "يوليه", "تموز", "july", "jul"],
  ["اغسطس", "اب", "august", "aug"],
  ["سبتمبر", "ايلول", "september", "sep", "sept"],
  ["اكتوبر", "تشرين الاول", "october", "oct"],
  ["نوفمبر", "تشرين الثاني", "november", "nov"],
  ["ديسمبر", "كانون الاول", "december", "dec"],
];

export const MONTH_NAMES_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export const MONTH_NAMES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Relative periods, longest phrase first so «السنه العقديه السابقه» wins over «السنه». */
const PERIOD_PHRASES = [
  ["السنه العقديه السابقه", "contract-prev"], ["السنه العقديه الماضيه", "contract-prev"], ["العقديه السابقه", "contract-prev"], ["previous contract year", "contract-prev"],
  ["السنه العقديه الحاليه", "contract"], ["السنه العقديه", "contract"], ["سنتي العقديه", "contract"], ["العقديه", "contract"], ["contract year", "contract"],
  ["الاسبوع الماضي", "week-prev"], ["الاسبوع السابق", "week-prev"], ["last week", "week-prev"],
  ["هذا الاسبوع", "week"], ["الاسبوع الحالي", "week"], ["الاسبوع", "week"], ["this week", "week"],
  ["الشهر الماضي", "month-prev"], ["الشهر السابق", "month-prev"], ["last month", "month-prev"],
  ["هذا الشهر", "this-month"], ["الشهر الحالي", "this-month"], ["الشهر", "this-month"], ["this month", "this-month"],
  ["السنه الماضيه", "year-prev"], ["السنه السابقه", "year-prev"], ["العام الماضي", "year-prev"], ["last year", "year-prev"],
  ["هذه السنه", "year"], ["السنه الحاليه", "year"], ["هذا العام", "year"], ["العام", "year"], ["this year", "year"],
  ["كل السنوات", "career"], ["المسيره", "career"], ["مسيرتي", "career"], ["career", "career"],
  ["اليوم", "today"], ["today", "today"],
  ["امس", "yesterday"], ["البارحه", "yesterday"], ["yesterday", "yesterday"],
];

/**
 * Page names → keys of dutySectionPages (both lanes). Matched as phrases before anything else so
 * «حضور الفريق» is a page, not the status «حضور».
 */
export const DUTY_SEARCH_PAGES = [
  { key: "team", side: "manage", words: ["حضور الفريق", "الفريق", "team attendance", "team"] },
  { key: "shifts-manage", side: "manage", words: ["جدول الدوام", "الروستر", "roster", "duty roster"] },
  { key: "policy", side: "manage", words: ["السياسه والمواقع", "السياسه", "المواقع", "policy", "sites"] },
  { key: "punch", side: "employee", words: ["بصمتي", "البصمه", "بصمه", "my punch", "punch"] },
  { key: "record", side: "employee", words: ["سجلي", "كشفي", "my record", "record"] },
  { key: "calendar", side: "employee", words: ["التقويم التشغيلي", "التقويم", "تقويمي", "calendar"] },
  { key: "shifts", side: "employee", words: ["جدولي", "my roster", "my shifts"] },
];


/* -------------------------------------------- hijri -------------------------------------------- */

/** Hijri months (normalised spellings), 1-based by position + 1. */
const HIJRI_MONTHS = [
  ["محرم", "muharram"],
  ["صفر", "safar"],
  ["ربيع الاول", "ربيع اول", "rabi al-awwal", "rabi i"],
  ["ربيع الاخر", "ربيع الثاني", "ربيع ثاني", "rabi al-thani", "rabi ii"],
  ["جمادي الاولي", "جمادي الاول", "جمادي اولي", "jumada al-ula", "jumada i"],
  ["جمادي الاخره", "جمادي الثانيه", "جمادي الاخر", "جمادي الثاني", "jumada al-akhira", "jumada ii"],
  ["رجب", "rajab"],
  ["شعبان", "shaban", "shaaban"],
  ["رمضان", "ramadan"],
  ["شوال", "shawwal"],
  ["ذو القعده", "ذي القعده", "ذوالقعده", "dhu al-qadah", "dhul qadah"],
  ["ذو الحجه", "ذي الحجه", "ذوالحجه", "dhu al-hijjah", "dhul hijjah"],
];
export const HIJRI_MONTH_NAMES_AR = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];

let hijriFormat = null;
function hijriParts(date) {
  try {
    hijriFormat = hijriFormat || new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
    const parts = hijriFormat.formatToParts(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())));
    const get = (type) => Number(parts.find((part) => part.type === type)?.value);
    return { y: get("year"), m: get("month"), d: get("day") };
  } catch {
    return null;
  }
}

/** Gregorian day key of Umm al-Qura hy/hm/hd (hd may overflow to the next month for «end of month» maths). */
const hijriCache = new Map();
export function hijriToDayKey(hy, hm, hd) {
  const key = `${hy}-${hm}-${hd}`;
  if (hijriCache.has(key)) return hijriCache.get(key);
  const approxYear = Math.round(hy * 0.970229 + 621.5643);
  let date = new Date(approxYear, 0, 1);
  const guess = hijriParts(date);
  if (!guess) return "";
  // step by days toward the target (at most ~2 years of steps)
  const target = hy * 400 + hm * 31 + hd;
  for (let i = 0; i < 900; i += 1) {
    const h = hijriParts(date);
    const now = h.y * 400 + h.m * 31 + h.d;
    if (h.y === hy && h.m === hm && h.d === hd) {
      const out = dayKeyOf(date);
      hijriCache.set(key, out);
      return out;
    }
    const step = Math.max(1, Math.min(25, Math.floor(Math.abs(target - now) * 0.9)));
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (now < target ? step : -1));
  }
  hijriCache.set(key, "");
  return "";
}

/** First and last Gregorian day of a Hijri month. */
export function hijriMonthRange(hy, hm) {
  const from = hijriToDayKey(hy, hm, 1);
  const nextY = hm === 12 ? hy + 1 : hy;
  const nextM = hm === 12 ? 1 : hm + 1;
  const next = hijriToDayKey(nextY, nextM, 1);
  return { from, to: next ? addDayKey(next, -1) : "" };
}

export function hijriOfDayKey(key) {
  const date = parseDayKey(key);
  return date ? hijriParts(date) : null;
}

/** Find a Hijri month name in text → { month (1–12), rest }. Longest names first. */
function takeHijriMonth(text) {
  const all = [];
  HIJRI_MONTHS.forEach((names, index) => names.forEach((name) => all.push([name, index + 1])));
  all.sort((a, b) => b[0].length - a[0].length);
  for (const [name, month] of all) {
    const [found, rest] = takePhrase(text, name);
    if (found) return { month, rest };
  }
  return null;
}

/* -------------------------------------------- parse -------------------------------------------- */

/** Filler words that are neither a name nor a filter. */
const STOP_WORDS = new Set(["في", "من", "عن", "على", "مع", "كل", "الى", "حتى", "يوم", "ايام", "الايام", "اليوم", "كم", "عدد", "اعرض", "ابحث", "سجل", "خلال", "شهر", "of", "in", "for", "the", "show", "days", "day"]);

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove a phrase (whole words) from text; returns [found, rest]. Arabic «و/ب/ل/ال» prefixes allowed on one-word phrases. */
function takePhrase(text, phrase) {
  const prefix = phrase.includes(" ") || /^[a-z]/.test(phrase) ? "" : "(?:و|ب|ل|في)?";
  const re = new RegExp(`(^|\\s)${prefix}${escapeRe(phrase)}(?=\\s|$)`, "u");
  if (!re.test(text)) return [false, text];
  return [true, text.replace(re, " ").replace(/\s+/g, " ").trim()];
}

function monthIndexOf(word) {
  return MONTHS.findIndex((names) => names.includes(word));
}


/** One endpoint of a range: «1 سبتمبر 2026», «15/9», «2026-09-01», «سبتمبر», «5», «1 رمضان 1448», «شعبان». */
function parseEndpoint(raw) {
  let text = String(raw || "").replace(/(^|\s)(?:يوم|تاريخ)(?=\s)/g, " ").replace(/\s*هـ?$/u, "").trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return { cal: "g", y: Number(iso[1]), m: Number(iso[2]) - 1, d: Number(iso[3]) };
  const dmy = text.match(/^(\d{1,2})\s*[/\\.]\s*(\d{1,2})(?:\s*[/\\.]\s*(\d{2,4}))?$/);
  if (dmy) {
    const y = dmy[3] ? Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]) : null;
    if (y && y > 1300 && y < 1600) return { cal: "h", y, m: Number(dmy[2]), d: Number(dmy[1]) };
    return { cal: "g", y, m: Number(dmy[2]) - 1, d: Number(dmy[1]) };
  }
  const hijri = takeHijriMonth(text);
  if (hijri) {
    const nums = (hijri.rest.match(/\d+/g) || []).map(Number);
    const d = nums.find((n) => n >= 1 && n <= 30 && n < 1000) ?? null;
    const y = nums.find((n) => n > 1300 && n < 1600) ?? null;
    return { cal: "h", y, m: hijri.month, d };
  }
  let month = -1;
  let rest = text;
  for (const names of MONTHS) {
    for (const name of names) {
      const [found, left] = takePhrase(rest, name);
      if (found) { month = monthIndexOf(name); rest = left; break; }
    }
    if (month >= 0) break;
  }
  const nums = (rest.match(/\d+/g) || []).map(Number);
  const y = nums.find((n) => n >= 1900 && n < 2200) ?? null;
  const d = nums.find((n) => n >= 1 && n <= 31) ?? null;
  if (month >= 0) return { cal: "g", y, m: month, d };
  if (d != null && nums.length === 1) return { cal: "g", y: null, m: null, d };
  return null;
}

const RANGE_RE = /(?:^|\s)(?:من|بين|from|between)\s+(.+?)\s+(?:الي|حتي|لغايه|لين|و|to|until|and|-|–)\s+(.+?)(?=$|\s(?:غياب|تاخير|حضور|اجازه|راحه|ليلي|مكشوف)(?:\s|$))/u;

/**
 * Parse free text into an intent. `people` = [{ id, name }] the viewer may see (in the employee
 * lane only himself). Returns { text, pages, statuses, period, people, words, empty }.
 */
export function parseDutyQuery(raw, { people = [] } = {}) {
  let text = normalizeDutyText(raw);
  const out = { raw: String(raw || ""), text, pages: [], statuses: [], period: null, people: [], words: [], empty: !text };
  if (!text) return out;

  // 1) pages (phrases)
  for (const page of DUTY_SEARCH_PAGES) {
    for (const word of page.words) {
      const [found, rest] = takePhrase(text, word);
      if (found) {
        if (!out.pages.includes(page.key)) out.pages.push(page.key);
        text = rest;
      }
    }
  }

  // 1b) a range «من … إلى …» / «بين … و …» (Gregorian or Hijri endpoints)
  const range = text.match(RANGE_RE);
  if (range) {
    const a = parseEndpoint(range[1]);
    const b = parseEndpoint(range[2]);
    if (a && b) {
      out.period = { kind: "range", a, b };
      text = text.replace(range[0], " ").replace(/\s+/g, " ").trim();
    }
  }

  // 1c) a Hijri date or month alone: «15 شعبان 1448», «رمضان 1448», «رمضان», «5/9/1448»
  if (!out.period) {
    const hijriNum = text.match(/(^|\s)(\d{1,2})\s*[/\\.]\s*(\d{1,2})\s*[/\\.]\s*(1[34]\d{2})(?=\s|$)/);
    if (hijriNum) {
      out.period = { kind: "hijri", y: Number(hijriNum[4]), m: Number(hijriNum[3]), d: Number(hijriNum[2]) };
      text = text.replace(hijriNum[0], " ").trim();
    } else {
      const hm = takeHijriMonth(text);
      if (hm) {
        let rest = hm.rest;
        const yHit = rest.match(/(^|\s)(1[34]\d{2})\s*(?:هـ|ه)?(?=\s|$)/);
        const y = yHit ? Number(yHit[2]) : null;
        if (yHit) rest = rest.replace(yHit[0], " ").trim();
        const dHit = rest.match(/(^|\s)([1-9]|[12]\d|30)(?=\s|$)/);
        const d = dHit ? Number(dHit[2]) : null;
        if (dHit) rest = rest.replace(dHit[0], " ").trim();
        out.period = { kind: "hijri", y, m: hm.month, d };
        text = rest.replace(/(^|\s)(?:هـ|ه)(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
      }
    }
  }

  // 2) explicit dates: yyyy-mm-dd · d/m/yyyy · d/m · d-m
  const iso = out.period ? null : text.match(/(^|\s)(\d{4})-(\d{1,2})-(\d{1,2})(?=\s|$)/);
  if (iso) {
    out.period = { kind: "day", y: Number(iso[2]), m: Number(iso[3]) - 1, d: Number(iso[4]) };
    text = text.replace(iso[0], " ").trim();
  } else if (!out.period) {
    const dmy = text.match(/(^|\s)(\d{1,2})\s*[/\\.-]\s*(\d{1,2})(?:\s*[/\\.-]\s*(\d{2,4}))?(?=\s|$)/);
    if (dmy) {
      const year = dmy[4] ? Number(dmy[4].length === 2 ? `20${dmy[4]}` : dmy[4]) : null;
      out.period = { kind: "day", y: year, m: Number(dmy[3]) - 1, d: Number(dmy[2]) };
      text = text.replace(dmy[0], " ").trim();
    }
  }

  // 3) relative periods
  if (!out.period) {
    for (const [phrase, kind] of PERIOD_PHRASES) {
      const [found, rest] = takePhrase(text, phrase);
      if (found) {
        out.period = { kind };
        text = rest;
        break;
      }
    }
  }

  // 4) month names (two-word Levantine names first) + an optional year
  if (!out.period || out.period.kind === "year") {
    let month = -1;
    for (const names of MONTHS) {
      for (const name of names.filter((n) => n.includes(" "))) {
        const [found, rest] = takePhrase(text, name);
        if (found) { month = monthIndexOf(name); text = rest; break; }
      }
      if (month >= 0) break;
    }
    if (month < 0) {
      for (const token of text.split(" ")) {
        const bare = token.replace(/^(?:في|ب)(?=.{3,})/, "");
        const index = monthIndexOf(bare);
        if (index >= 0 && bare.length >= 2) {
          month = index;
          text = text.split(" ").filter((t) => t !== token).join(" ");
          break;
        }
      }
    }
    if (month >= 0) out.period = { kind: "month", m: month, y: null };
  }

  // 5) a four-digit year (alone → calendar year; with a month → that month of that year)
  const yearHit = text.match(/(^|\s)((?:19|20)\d{2})(?=\s|$)/);
  if (yearHit && !["range", "hijri"].includes(out.period?.kind)) {
    const y = Number(yearHit[2]);
    if (out.period?.kind === "month" || out.period?.kind === "day") out.period.y = out.period.y ?? y;
    else if (!out.period) out.period = { kind: "calendar-year", y };
    text = text.replace(yearHit[0], " ").trim();
  }
  // 6) a lone day number (1–31) with nothing else → that day of this month
  const lone = text.match(/(^|\s)(\d{1,2})(?=\s|$)/);
  if (lone && !out.period && Number(lone[2]) >= 1 && Number(lone[2]) <= 31) {
    out.period = { kind: "day", y: null, m: null, d: Number(lone[2]) };
    text = text.replace(lone[0], " ").trim();
  }

  // 7) statuses
  const tokens = text.split(" ").filter(Boolean);
  const left = [];
  for (const token of tokens) {
    const bare = token.replace(/^(?:و|ب)?(?:ال)?(?=.{3,})/, "");
    const hit = DUTY_SEARCH_STATUSES.find((status) => status.words.includes(token) || status.words.includes(bare));
    if (hit) {
      if (!out.statuses.includes(hit.id)) out.statuses.push(hit.id);
    } else {
      left.push(token);
    }
  }

  // 8) people: every remaining token (≥ 2 letters) must start a word of the name
  const nameTokens = left.filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  if (nameTokens.length) {
    const scored = [];
    for (const person of people || []) {
      const parts = normalizeDutyText(person?.name).split(" ").filter(Boolean);
      if (!parts.length) continue;
      const hits = nameTokens.filter((token) => parts.some((part) => part.startsWith(token) || part.replace(/^ال/, "").startsWith(token)));
      if (hits.length) scored.push({ person, hits, score: hits.length * 10 + hits.reduce((n, t) => n + t.length, 0) });
    }
    const best = scored.length ? Math.max(...scored.map((row) => row.hits.length)) : 0;
    const used = new Set();
    for (const row of scored.filter((item) => item.hits.length === best).sort((a, b) => b.score - a.score)) {
      out.people.push(row.person);
      row.hits.forEach((token) => used.add(token));
    }
    out.words = nameTokens.filter((token) => !used.has(token));
  }
  out.rest = text;
  return out;
}

/* ------------------------------------------- periods ------------------------------------------- */

function monthRange(y, m) {
  return { from: dayKeyOf(new Date(y, m, 1)), to: dayKeyOf(new Date(y, m + 1, 0)) };
}

/**
 * Resolve a parsed period to { from, to, kind, label } (to ≤ today never forced — the caller clips).
 * `anchorKey` = the person's contract-year anchor (for «السنة العقدية»). A month without a year is
 * its latest occurrence that is not in the future.
 */
export function resolveDutyPeriod(period, { todayKey, anchorKey = "", ar = true } = {}) {
  const today = parseDayKey(todayKey) || new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth();
  const months = ar ? MONTH_NAMES_AR : MONTH_NAMES_EN;
  if (!period) return null;
  switch (period.kind) {
    case "today":
      return { kind: "today", from: todayKey, to: todayKey, label: ar ? "اليوم" : "Today" };
    case "yesterday": {
      const key = addDayKey(todayKey, -1);
      return { kind: "yesterday", from: key, to: key, label: ar ? "أمس" : "Yesterday" };
    }
    case "week":
    case "week-prev": {
      const back = period.kind === "week" ? 0 : 7;
      const start = new Date(ty, tm, today.getDate() - today.getDay() - back);
      return { kind: period.kind, from: dayKeyOf(start), to: dayKeyOf(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)), label: period.kind === "week" ? (ar ? "هذا الأسبوع" : "This week") : (ar ? "الأسبوع الماضي" : "Last week") };
    }
    case "this-month":
    case "month-prev": {
      const date = new Date(ty, tm - (period.kind === "this-month" ? 0 : 1), 1);
      return { kind: period.kind, ...monthRange(date.getFullYear(), date.getMonth()), label: period.kind === "this-month" ? (ar ? "هذا الشهر" : "This month") : `${months[date.getMonth()]} ${date.getFullYear()}` };
    }
    case "year":
    case "year-prev": {
      const y = ty - (period.kind === "year" ? 0 : 1);
      return { kind: "calendar-year", from: `${y}-01-01`, to: `${y}-12-31`, label: ar ? `سنة ${y} الميلادية` : `Calendar ${y}` };
    }
    case "calendar-year":
      return { kind: "calendar-year", from: `${period.y}-01-01`, to: `${period.y}-12-31`, label: ar ? `سنة ${period.y}` : String(period.y) };
    default:
      break;
  }
  if (period.kind === "month") {
    let y = period.y;
    if (y == null) y = period.m > tm ? ty - 1 : ty;
    return { kind: "month", ...monthRange(y, period.m), label: `${months[period.m]} ${y}` };
  }
  if (period.kind === "day") {
    const m = period.m == null ? tm : period.m;
    let y = period.y;
    if (y == null) {
      const candidate = new Date(ty, m, period.d);
      y = candidate > today ? ty - 1 : ty;
      if (period.m == null && candidate > today) {
        const prev = new Date(ty, tm - 1, period.d);
        return { kind: "day", from: dayKeyOf(prev), to: dayKeyOf(prev), label: dayLabel(prev, months) };
      }
    }
    const date = new Date(y, m, period.d);
    if (date.getMonth() !== m) return null;
    return { kind: "day", from: dayKeyOf(date), to: dayKeyOf(date), label: dayLabel(date, months) };
  }
  if (period.kind === "contract" || period.kind === "contract-prev") {
    const windows = contractYearWindows(anchorKey, todayKey);
    const current = windowOf(windows, todayKey);
    const win = period.kind === "contract" ? current : windows[(current?.index ?? 0) - 1];
    if (!win) return { kind: period.kind, from: "", to: "", label: ar ? "السنة العقدية" : "Contract year", empty: true };
    return { kind: period.kind, from: win.start, to: win.end, label: period.kind === "contract" ? (ar ? "السنة العقدية الحالية" : "Current contract year") : (ar ? "السنة العقدية السابقة" : "Previous contract year") };
  }
  if (period.kind === "hijri") {
    const span = hijriSpan(period, today);
    if (!span) return null;
    return { kind: "hijri", from: span.from, to: span.to, label: `${span.label} (${shortGreg(span.from, months)}${span.from !== span.to ? ` – ${shortGreg(span.to, months)}` : ""})` };
  }
  if (period.kind === "range") {
    let { a, b } = period;
    a = { ...a };
    b = { ...b };
    // fill a missing year / month from the other end
    if (a.cal === b.cal) {
      if (a.y == null && b.y != null) a.y = b.y;
      if (b.y == null && a.y != null) b.y = a.y;
      if (a.m == null && b.m != null) a.m = b.m;
      if (b.m == null && a.m != null) b.m = a.m;
    }
    const end = endpointSpan(b, today);
    if (!end) return null;
    if (a.cal === b.cal && a.y == null) {
      const endDate = parseDayKey(end.from);
      a.y = a.cal === "h" ? (hijriOfDayKey(end.from)?.y ?? null) : endDate.getFullYear();
      const probe = endpointSpan(a, today);
      if (probe && probe.from > end.to) a.y -= 1;
    }
    const start = endpointSpan(a, today);
    if (!start) return null;
    let from = start.from;
    let to = end.to;
    if (from > to) [from, to] = [end.from, start.to];
    const label = `${start.label} – ${end.label}`;
    const greg = (a.cal === "h" || b.cal === "h") ? ` (${shortGreg(from, months)} – ${shortGreg(to, months)})` : "";
    return { kind: "range", from, to, label: label + greg };
  }
  if (period.kind === "career") {
    return { kind: "career", from: anchorKey || "", to: todayKey, label: ar ? "المسيرة كلها" : "Whole career" };
  }
  return null;
}

function shortGreg(key, months) {
  const date = parseDayKey(key);
  return date ? `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}` : key;
}

/** Latest Hijri year whose month hm (day hd) is not after today. */
function latestHijriYear(hm, hd, today) {
  const now = hijriParts(today);
  if (!now) return null;
  const later = hm > now.m || (hm === now.m && (hd || 1) > now.d);
  return later ? now.y - 1 : now.y;
}

function hijriSpan({ y, m, d }, today) {
  const hy = y ?? latestHijriYear(m, d, today);
  if (!hy || !m) return null;
  const name = HIJRI_MONTH_NAMES_AR[m - 1];
  if (d) {
    const key = hijriToDayKey(hy, m, d);
    return key ? { from: key, to: key, label: `${d} ${name} ${hy}هـ` } : null;
  }
  const span = hijriMonthRange(hy, m);
  return span.from ? { ...span, label: `${name} ${hy}هـ` } : null;
}

/** Resolve one range endpoint to { from, to, label } (a whole month when no day). */
function endpointSpan(spec, today) {
  if (!spec) return null;
  if (spec.cal === "h") return hijriSpan(spec, today);
  const ty = today.getFullYear();
  const tm = today.getMonth();
  const m = spec.m == null ? tm : spec.m;
  let y = spec.y;
  if (y == null) y = new Date(ty, m, spec.d || 1) > today ? ty - 1 : ty;
  if (spec.d == null) {
    const range = monthRange(y, m);
    return { ...range, label: `${MONTH_NAMES_AR[m]} ${y}` };
  }
  const date = new Date(y, m, spec.d);
  if (date.getMonth() !== m) return null;
  const key = dayKeyOf(date);
  return { from: key, to: key, label: dayLabel(date, MONTH_NAMES_AR) };
}

function dayLabel(date, months) {
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/* ------------------------------------------- matching ------------------------------------------- */

const ATTENDED = new Set(["ontime", "late", "manual", "open", "present"]);

/** Does one derived day (myDutyDay + flags { night, exposed }) match the asked statuses? */
export function dutyDayMatches(day, statuses = []) {
  if (!day) return false;
  if (!statuses.length) return !["upcoming", "nodata"].includes(day.status);
  return statuses.some((id) => {
    if (id === "attended") return ATTENDED.has(day.status);
    if (id === "late") return day.status === "late" || (Number(day.lateMinutes) > 0 && !!day.inAt);
    if (id === "rest") return day.status === "rest";
    if (id === "night") return !!day.night;
    if (id === "exposed") return !!day.exposed;
    return day.status === id;
  });
}
