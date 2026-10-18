/**
 * dutyYears.js — one person's absence and lateness, counted per year and restarted every year.
 *
 * Pure (relative imports only, node-testable). The day records come from the same derivation
 * سجلي uses (myDutyDay → a dutyStatus key per day); this module only buckets them. No new rule
 * for what counts as absent or late:
 *   absent   = status "absent"   (scheduled on a published roster, no punch, no approved leave)
 *   late     = status "late", or lateMinutes > 0 on a punched day
 *   leave    = status "leave"    (approved leave — outside attendance)
 *   holiday  = status "holiday"  (official holiday — Article 112)
 *
 * The year is the CONTRACT year by default — Labour Law Article 80(7) counts unexcused absence
 * «خلال السنة العقدية الواحدة» — anchored on the contract start / hire date in the profile.
 * A calendar-year view (1 Jan – 31 Dec) is offered as a toggle.
 *
 * Coverage: a day can only be read as absent if the platform held a duty record for it. Days
 * before the first dated record (roster day, published week or punch) — or before the contract
 * start — are «قبل بدء السجل» and are never counted. A weekly roster pattern is not stretched
 * back over years that were never recorded.
 */

/* --------------------------------- Article 80 (as the text says) --------------------------------- */

/**
 * Labour Law Article 80(7): the employer may dismiss without award, notice or compensation
 * «إذا تغيب العامل دون سبب مشروع أكثر من ثلاثين يوماً خلال السنة العقدية الواحدة أو أكثر من
 * خمسة عشر يوماً متتالية، على أن يسبق الفصل إنذار كتابي من صاحب العمل للعامل بعد غيابه عشرين
 * يوماً في الحالة الأولى وانقطاعه عشرة أيام في الحالة الثانية».
 */
export const ART80 = Object.freeze({
  article: "80",
  paragraph: 7,
  intermittentLimit: 30, // «أكثر من ثلاثين يوماً خلال السنة العقدية الواحدة»
  intermittentNotice: 20, // «إنذار كتابي … بعد غيابه عشرين يوماً»
  consecutiveLimit: 15, // «أكثر من خمسة عشر يوماً متتالية»
  consecutiveNotice: 10, // «… وانقطاعه عشرة أيام في الحالة الثانية»
  textAr: "إذا تغيب العامل دون سبب مشروع أكثر من ثلاثين يوماً خلال السنة العقدية الواحدة أو أكثر من خمسة عشر يوماً متتالية، على أن يسبق الفصل إنذار كتابي من صاحب العمل للعامل بعد غيابه عشرين يوماً في الحالة الأولى وانقطاعه عشرة أيام في الحالة الثانية.",
  textEn: "If the worker is absent without a legitimate reason for more than thirty days within one contract year or more than fifteen consecutive days, provided that dismissal is preceded by a written warning from the employer after twenty days of absence in the first case and ten days of interruption in the second.",
});

/* ------------------------------------------- dates ------------------------------------------- */

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dayKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDayKey(key) {
  const match = KEY_RE.exec(String(key || "").slice(0, 10));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function cleanDayKey(value) {
  const key = String(value || "").slice(0, 10);
  return parseDayKey(key) ? key : "";
}

export function addDayKey(key, delta) {
  const date = parseDayKey(key);
  if (!date) return "";
  return dayKeyOf(new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta));
}

/** Every yyyy-mm-dd from `from` to `to` inclusive (guarded). */
export function eachDayKey(from, to, guard = 20000) {
  const out = [];
  let key = cleanDayKey(from);
  const end = cleanDayKey(to);
  if (!key || !end) return out;
  while (key <= end && out.length < guard) {
    out.push(key);
    key = addDayKey(key, 1);
  }
  return out;
}

/** Same month/day `years` later; 29 Feb clamps to 28 Feb in a common year. */
function anniversaryKey(anchorKey, years) {
  const anchor = parseDayKey(anchorKey);
  if (!anchor) return "";
  const year = anchor.getFullYear() + years;
  const month = anchor.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  return dayKeyOf(new Date(year, month, Math.min(anchor.getDate(), last)));
}

/* ------------------------------------- anchor and coverage ------------------------------------- */

/**
 * Where the contract year starts for this person — the field the file already carries:
 * profile.contract.startDate → profile.hireDate → employee.hireDate.
 * Without one, the first duty record on the platform (`fallbackKey`) is used and said so.
 */
export function contractYearAnchor(employee, fallbackKey = "") {
  const profile = employee?.profile || {};
  const contract = cleanDayKey(profile.contract?.startDate || profile.contractStartDate);
  if (contract) return { key: contract, source: "contract" };
  const hire = cleanDayKey(profile.hireDate || employee?.hireDate || employee?.hire_date);
  if (hire) return { key: hire, source: "hire" };
  const fallback = cleanDayKey(fallbackKey);
  if (fallback) return { key: fallback, source: "record" };
  const created = cleanDayKey(employee?.createdAt);
  if (created) return { key: created, source: "created" };
  return { key: "", source: "none" };
}

/**
 * First day the platform holds a duty record: a dated roster day with someone on it, a published
 * week, or a punch row. Weekday patterns (keys 0–6) are a template, not a record — they are skipped.
 * With `employee`, only this person's records count: dated roster days that carry him, published
 * weeks of his home roster (or of a roster that carries him) and his own punch rows.
 */
export function dutyRecordStart({ schedules = [], rows = [], employee = null } = {}) {
  let first = "";
  const take = (key) => {
    const clean = cleanDayKey(key);
    if (clean && (!first || clean < first)) first = clean;
  };
  const id = employee?.id != null ? String(employee.id) : "";
  const carries = (ids) => Array.isArray(ids) && (id ? ids.map(String).includes(id) : ids.length > 0);
  for (const schedule of schedules || []) {
    const entries = Object.entries(schedule?.assignments || {});
    const mine = !id
      || (employee?.stationId != null && String(schedule?.stationId) === String(employee.stationId))
      || entries.some(([, day]) => day && typeof day === "object" && Object.values(day).some(carries));
    if (!mine) continue;
    for (const [key, day] of entries) {
      if (!KEY_RE.test(key) || !day || typeof day !== "object") continue;
      if (Object.values(day).some(carries)) take(key);
    }
    for (const key of Object.keys(schedule?.publishedWeeks || {})) take(key);
  }
  for (const row of rows || []) {
    const rowId = row?.employee_id ?? row?.employeeId;
    if (id && rowId != null && String(rowId) !== id) continue;
    take(row?.date || row?.dateKey);
  }
  if (!first && employee) take(employee.createdAt);
  return first;
}

/* ---------------------------------------- year windows ---------------------------------------- */

/** Contract years from the anchor through the one that holds `todayKey`. Oldest first. */
export function contractYearWindows(anchorKey, todayKey) {
  const anchor = cleanDayKey(anchorKey);
  const today = cleanDayKey(todayKey);
  if (!anchor || !today || anchor > today) return [];
  const out = [];
  for (let index = 0; index < 200; index += 1) {
    const start = anniversaryKey(anchor, index);
    if (start > today) break;
    const end = addDayKey(anniversaryKey(anchor, index + 1), -1);
    out.push({ mode: "contract", index, start, end, id: `c${index}` });
  }
  return out;
}

/** Calendar years (1 Jan – 31 Dec) from the anchor's year through today's. Oldest first. */
export function calendarYearWindows(anchorKey, todayKey) {
  const anchor = parseDayKey(anchorKey);
  const today = parseDayKey(todayKey);
  if (!anchor || !today || anchor > today) return [];
  const out = [];
  for (let year = anchor.getFullYear(); year <= today.getFullYear(); year += 1) {
    out.push({ mode: "calendar", index: year - anchor.getFullYear(), year, start: `${year}-01-01`, end: `${year}-12-31`, id: `y${year}` });
  }
  return out;
}

export function yearWindows(mode, anchorKey, todayKey) {
  return mode === "calendar" ? calendarYearWindows(anchorKey, todayKey) : contractYearWindows(anchorKey, todayKey);
}

/** The window that holds `key`, or null. */
export function windowOf(windows = [], key) {
  const clean = cleanDayKey(key);
  return (windows || []).find((win) => win.start <= clean && clean <= win.end) || null;
}

/* ------------------------------------------- tallies ------------------------------------------- */

const ATTENDED = new Set(["ontime", "late", "manual", "open", "present"]);
/** Days that are not working days: they neither count in nor break an absence run. */
const NEUTRAL = new Set(["rest", "holiday", "unscheduled", "upcoming", "nodata"]);

export function isLateDay(day) {
  return !!day && (day.status === "late" || (Number(day.lateMinutes) > 0 && !!day.inAt));
}

/**
 * Tally of one set of days (already limited to one year by the caller).
 * Consecutive absence: absent working days in a row. Rest days and official holidays between two
 * absences neither count nor break the run (the worker has not come back); a punched day or an
 * approved leave day ends it.
 */
export function tallyDutyDays(days = []) {
  const sorted = (days || []).filter((day) => day && day.key).slice().sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const out = {
    attended: 0,
    scheduled: 0,
    absent: 0,
    lateDays: 0,
    lateMinutes: 0,
    leave: 0,
    holiday: 0,
    manual: 0,
    maxStreak: 0,
    streakFrom: "",
    streakTo: "",
    currentStreak: 0,
    recorded: 0,
    notable: [],
  };
  let run = 0;
  let runFrom = "";
  let lastAbsent = "";
  for (const day of sorted) {
    const status = day.status;
    if (status === "upcoming" || status === "nodata") continue;
    out.recorded += 1;
    if (ATTENDED.has(status)) out.attended += 1;
    if (ATTENDED.has(status) || status === "absent" || status === "pending") out.scheduled += 1;
    if (status === "manual") out.manual += 1;
    if (status === "leave") out.leave += 1;
    if (status === "holiday") out.holiday += 1;
    const late = isLateDay(day);
    if (late) {
      out.lateDays += 1;
      out.lateMinutes += day.inAt ? Number(day.lateMinutes) || 0 : 0;
    }
    if (status === "absent") {
      out.absent += 1;
      if (!run) runFrom = day.key;
      run += 1;
      lastAbsent = day.key;
      if (run > out.maxStreak) {
        out.maxStreak = run;
        out.streakFrom = runFrom;
        out.streakTo = day.key;
      }
    } else if (!NEUTRAL.has(status) && status !== "pending") {
      run = 0;
      runFrom = "";
    }
    if (status === "absent" || late || status === "leave" || status === "holiday" || status === "manual" || status === "open") {
      out.notable.push(day);
    }
  }
  out.currentStreak = lastAbsent ? run : 0;
  return out;
}

/** Article 80 reading of one contract-year tally — information, not a decision. */
export function art80Reading(tally) {
  const absent = Number(tally?.absent) || 0;
  const streak = Number(tally?.maxStreak) || 0;
  const level = (value, notice, limit) => (value > limit ? "over" : value >= notice ? "notice" : value > 0 ? "some" : "none");
  return {
    intermittent: { value: absent, limit: ART80.intermittentLimit, notice: ART80.intermittentNotice, level: level(absent, ART80.intermittentNotice, ART80.intermittentLimit) },
    consecutive: { value: streak, limit: ART80.consecutiveLimit, notice: ART80.consecutiveNotice, level: level(streak, ART80.consecutiveNotice, ART80.consecutiveLimit), from: tally?.streakFrom || "", to: tally?.streakTo || "" },
  };
}

/**
 * Per-year records for one person. `days` are day records ({ key, status, lateMinutes, inAt })
 * from the shared derivation; `coverageStart` is the first recorded day. Newest year first.
 * Each year restarts every count.
 */
export function dutyYears({ days = [], anchorKey, todayKey, mode = "contract", coverageStart = "" } = {}) {
  const windows = yearWindows(mode, anchorKey, todayKey);
  const today = cleanDayKey(todayKey);
  const anchor = cleanDayKey(anchorKey);
  const cover = cleanDayKey(coverageStart);
  const sorted = (days || []).filter((day) => day && cleanDayKey(day.key));
  return windows.map((win) => {
    const from = [win.start, anchor, cover].filter(Boolean).sort().pop();
    const to = win.end < today ? win.end : today;
    const inside = from <= to ? sorted.filter((day) => day.key >= from && day.key <= to) : [];
    const tally = tallyDutyDays(inside);
    const covered = !!cover && cover <= to;
    return {
      ...win,
      from,
      to,
      current: win.start <= today && today <= win.end,
      covered,
      partial: covered && cover > win.start,
      tally,
      art80: mode === "contract" ? art80Reading(tally) : null,
    };
  }).reverse();
}

/** Long careers stay tidy: the newest years in view, a picked year always shown, the rest behind one fold. */
export const CAREER_VISIBLE_YEARS = 3;
export function careerVisibleYears(covered = [], { openId = "", showAll = false, limit = CAREER_VISIBLE_YEARS } = {}) {
  if (showAll || covered.length <= limit) return { shown: covered, hidden: 0 };
  const head = covered.slice(0, limit);
  const picked = covered.find((year) => year.id === openId);
  const shown = picked && !head.includes(picked) ? [...head, picked] : head;
  return { shown, hidden: covered.length - shown.length };
}
