/**
 * «طلبات الدوام» — requests that change how a duty day is read, each tied to a ministry rule:
 *   استئذان (permission)        — an approved absence window inside the shift is not lateness or early leave.
 *   تغيير وردية (shift_change)   — on approval the roster cell changes (existing store path).
 *   ساعة الرضاعة (nursing_hour)  — Labour Law Art. 154: up to one hour a day counted as actual work.
 *   إبلاغ حمل (pregnancy_notice) — Decision 18632: no night assignment in the 24 weeks before birth.
 *   بلاغ عمل مكشوف (heat_report) — Decision 3337: exposed work in the ban hours is a violation.
 * Pure helpers only — store.js applies approvals, myDutyDay reads the excusals.
 * Server twin of the nursing reading: base44/shared/nursingHour.ts.
 */
import { ruleValue } from "./laborRules.js";

export const DUTY_REQUEST_TYPES = ["permission", "shift_change", "nursing_hour", "pregnancy_notice", "heat_report", "family_duties"];
export const NURSING_HOUR_MAX_MINUTES = 60;

export const DUTY_REQUEST_META = {
  permission: {
    ar: "استئذان", en: "Permission",
    hintAr: "خروج أو تأخير بإذن — لا يُحتسب تأخيراً", hintEn: "Leave the shift with permission — not counted as lateness",
    cite: "",
  },
  shift_change: {
    ar: "تغيير وردية", en: "Shift change",
    hintAr: "يتغيّر الجدول عند الاعتماد", hintEn: "The roster changes on approval",
    cite: "",
  },
  nursing_hour: {
    ar: "ساعة الرضاعة", en: "Nursing hour",
    hintAr: "م 154 · ساعة يومياً من ساعات العمل الفعلية", hintEn: "Art. 154 · one hour a day counted as work",
    cite: "154", gender: "female",
  },
  pregnancy_notice: {
    ar: "إبلاغ حمل", en: "Pregnancy notice",
    hintAr: "قرار 18632 · لا عمل ليلي قبل الوضع بـ24 أسبوعاً", hintEn: "Decision 18632 · no night work in the 24 weeks before birth",
    cite: "18632", gender: "female",
  },
  family_duties: {
    ar: "إبلاغ بمسؤوليات عائلية", en: "Family responsibilities notice",
    hintAr: "قرار 18632 (هـ) · مراعاة في الإسناد الليلي", hintEn: "Decision 18632 (e) · considered for night assignment",
    cite: "18632",
  },
  heat_report: {
    ar: "بلاغ عمل مكشوف", en: "Exposed-work report",
    hintAr: "قرار 3337 · كُلّفت بعمل تحت الشمس وقت الحظر", hintEn: "Decision 3337 · assigned sun work in the ban hours",
    cite: "3337",
  },
};

export function isDutyRequestType(type) {
  return DUTY_REQUEST_TYPES.includes(type);
}

function clockMinutes(value) {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function approved(row) {
  return (row?.status || "pending") === "approved";
}

/** Approved استئذان windows on one day: [{ from, to }] in minutes. */
export function approvedPermissionWindows(employee, dateKey) {
  return (employee?.otherRequests || [])
    .filter((row) => row?.type === "permission" && approved(row) && String(row.date || "").slice(0, 10) === dateKey)
    .map((row) => ({ from: clockMinutes(row.time), to: clockMinutes(row.timeTo) }))
    .filter((win) => win.from != null && win.to != null && win.to > win.from);
}

/**
 * Art. 154 allows «a period or periods» totalling at most one hour a day. The split is minutes at the
 * start, in the middle and at the end of the shift. An older request with only a placement is a full
 * hour there.
 */
export function nursingSplitOf(row = {}) {
  const n = (v) => Math.max(0, Math.min(60, Math.round(Number(v) || 0)));
  const raw = row.nursingSplit;
  if (raw && typeof raw === "object") return { start: n(raw.start), mid: n(raw.mid), end: n(raw.end) };
  if (row.placement === "end") return { start: 0, mid: 0, end: 60 };
  if (row.placement === "start") return { start: 60, mid: 0, end: 0 };
  return { start: 0, mid: 0, end: 0 };
}

/** Regs Art. 31(1): the nursing break runs 24 months from the date of birth — the last day it covers. */
export function nursingRightUntil(birthDate) {
  const b = String(birthDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b)) return "";
  const d = new Date(`${b}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 24);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Regs Art. 31(3): without a nursery on site the worker picks one nursing hour at the start or the end
 * of the shift; with a nursery she may split it into periods totalling an hour.
 */
export function checkNursingNurseryGate(split, nurseryOnSite) {
  if (nurseryOnSite === true) return { ok: true };
  const parts = ["start", "mid", "end"].filter((k) => (split?.[k] || 0) > 0);
  if (parts.length > 1 || parts[0] === "mid") {
    return {
      ok: false,
      error: "NURSING_NO_NURSERY_SPLIT",
      reason: "لا تتوفر حضانة داخل المنشأة — فترة الرضاعة تكون أول الدوام أو آخره فقط، فترة واحدة (اللائحة م31/3-أ). التقسيم على فترات حين تتوفر حضانة.",
      reasonEn: "There is no on-site nursery — the nursing hour is one period at the start or the end of the shift (Regs Art. 31(3)(a)). Splitting is for when a nursery exists.",
    };
  }
  return { ok: true };
}

export function nursingSplitTotal(split) {
  return (split?.start || 0) + (split?.mid || 0) + (split?.end || 0);
}

/** One line for the card and the file: «30 د أول الدوام + 30 د آخره». */
export function nursingSplitLabel(split, ar = true) {
  const parts = [
    split?.start ? (ar ? `${split.start} د أول الدوام` : `${split.start} min at start`) : "",
    split?.mid ? (ar ? `${split.mid} د وسط الدوام` : `${split.mid} min mid-shift`) : "",
    split?.end ? (ar ? `${split.end} د آخر الدوام` : `${split.end} min at end`) : "",
  ].filter(Boolean);
  return parts.join(ar ? " + " : " + ");
}

/**
 * Art. 154 — the nursing hour on file for that day: { placement, minutes, startMinutes, midMinutes,
 * endMinutes, split, from, until } or null. Active when from ≤ day ≤ until; an open «until» stops at
 * 24 months from the child's birth (Regs Art. 31(1)). Minutes never pass the catalog's daily figure
 * (leave.nursing.dailyMinutes) — the start part first, then the end, then the middle.
 */
export function nursingHourOn(employee, dateKey) {
  const fromFile = employee?.profile?.nursingHour;
  const rows = [
    ...(fromFile ? [fromFile] : []),
    ...(employee?.otherRequests || [])
      .filter((row) => row?.type === "nursing_hour" && approved(row))
      .map((row) => ({ placement: row.placement, nursingSplit: row.nursingSplit, childBirthDate: row.childBirthDate, from: row.date, until: row.until })),
  ];
  const day = String(dateKey || "").slice(0, 10);
  const untilOf = (row) => String(row?.until || "").slice(0, 10) || nursingRightUntil(row?.childBirthDate);
  const hit = rows.find((row) => {
    const from = String(row?.from || "").slice(0, 10);
    const until = untilOf(row);
    return (!from || day >= from) && (!until || day <= until);
  });
  if (!hit) return null;
  const split = nursingSplitOf(hit);
  const cap = Number(ruleValue("leave.nursing.dailyMinutes", day)) || NURSING_HOUR_MAX_MINUTES;
  const startMinutes = Math.min(cap, split.start);
  const endMinutes = Math.min(cap - startMinutes, split.end);
  const midMinutes = Math.min(cap - startMinutes - endMinutes, split.mid);
  const minutes = startMinutes + endMinutes + midMinutes;
  if (!minutes) return null;
  return {
    placement: split.start ? "start" : split.end ? "end" : "mid",
    minutes,
    startMinutes,
    midMinutes,
    endMinutes,
    split,
    from: String(hit.from || "").slice(0, 10),
    until: untilOf(hit),
  };
}

/**
 * Art. 154 — the nursing minutes she was away for, credited as actual work (never more than her
 * minutes that day). Clocks are minutes on the shift day's clock: the start part covers a late
 * arrival up to its minutes, the end part an early checkout, the middle part what is still short
 * of the roster after both. Returns { minutes, start, mid, end }.
 */
export function nursingCreditOf(nursing, { inMinutes, outMinutes, shiftStart, shiftEnd, workedMinutes = 0, rosteredMinutes = 0 } = {}) {
  const none = { minutes: 0, start: 0, mid: 0, end: 0 };
  if (!nursing || inMinutes == null || outMinutes == null || shiftStart == null || shiftEnd == null) return none;
  const start = Math.min(nursing.startMinutes || 0, Math.max(0, inMinutes - shiftStart));
  const end = Math.min(nursing.endMinutes || 0, Math.max(0, shiftEnd - outMinutes));
  const mid = Math.min(nursing.midMinutes || 0, Math.max(0, rosteredMinutes - workedMinutes - start - end));
  const minutes = Math.min(nursing.minutes || 0, start + mid + end);
  return { minutes, start, mid, end };
}

/** The nursing periods of the day as clocks on the shift: [{ part, from, to }] in minutes (start / end only). */
export function nursingWindowsOf(nursing, shiftStart, shiftEnd) {
  if (!nursing || shiftStart == null || shiftEnd == null) return [];
  const out = [];
  if (nursing.startMinutes) out.push({ part: "start", from: shiftStart, to: shiftStart + nursing.startMinutes });
  if (nursing.endMinutes) out.push({ part: "end", from: shiftEnd - nursing.endMinutes, to: shiftEnd });
  return out;
}

/**
 * Minutes after the shift start that are excused on this day — an approved permission that covers
 * the start, or a nursing hour placed at the start. Never more than the window itself.
 */
export function excusedStartMinutes(employee, dateKey, shiftStart) {
  const start = clockMinutes(shiftStart);
  let excused = 0;
  let reason = "";
  if (start != null) {
    for (const win of approvedPermissionWindows(employee, dateKey)) {
      if (win.from <= start && win.to > start) {
        const span = win.to - start;
        if (span > excused) { excused = span; reason = "permission"; }
      }
    }
  }
  const nursing = nursingHourOn(employee, dateKey);
  if (nursing?.startMinutes && nursing.startMinutes > excused) {
    excused = nursing.startMinutes;
    reason = "nursing";
  }
  return { minutes: excused, reason };
}

/** Art. 154 — minutes before the shift end she may leave on this day (the end part of her nursing hour). */
export function excusedEndMinutes(employee, dateKey) {
  return nursingHourOn(employee, dateKey)?.endMinutes || 0;
}

/**
 * An early checkout that sits inside her nursing minutes at the end of the shift is not early.
 * checkOutIso is the punch, shiftEnd "HH:MM".
 */
export function isExcusedEarlyCheckout(employee, dateKey, checkOutIso, shiftEnd) {
  const allow = excusedEndMinutes(employee, dateKey);
  const end = clockMinutes(shiftEnd);
  if (!allow || end == null || !checkOutIso) return false;
  const d = new Date(checkOutIso);
  const riyadh = new Date(d.getTime() + (3 * 60 + d.getTimezoneOffset()) * 60000);
  const out = riyadh.getHours() * 60 + riyadh.getMinutes();
  return out >= end - allow;
}

/** Field checks before submit — one place for the form and the store. */
export function checkDutyRequestFields(input = {}) {
  const type = input.type;
  const fail = (error, reason, reasonEn) => ({ ok: false, error, reason, reasonEn });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || "").slice(0, 10))) {
    return fail("DATE_REQUIRED", "حدد تاريخ الطلب.", "Set the request date.");
  }
  if (type === "permission") {
    const from = clockMinutes(input.time);
    const to = clockMinutes(input.timeTo);
    if (from == null || to == null) return fail("TIME_REQUIRED", "حدد وقت الخروج ووقت العودة.", "Set the leave and return times.");
    if (to <= from) return fail("TIME_ORDER", "وقت العودة قبل وقت الخروج.", "The return time is before the leave time.");
  }
  if (type === "nursing_hour") {
    const split = nursingSplitOf(input);
    const total = nursingSplitTotal(split);
    if (!total) return fail("PLACEMENT_REQUIRED", "حددي فترة الرضاعة: أول الدوام أو وسطه أو آخره.", "Set the nursing period: start, middle or end of shift.");
    if (total > 60) return fail("NURSING_OVER_HOUR", `مجموع الفترات ${total} دقيقة — المادة 154 لا تتجاوز ساعة في اليوم.`, `The periods total ${total} minutes — Art. 154 allows at most an hour a day.`);
    const nursery = checkNursingNurseryGate(split, input.nurseryOnSite);
    if (!nursery.ok) return nursery;
    if (input.childBirthDate !== undefined) {
      const birth = String(input.childBirthDate || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return fail("BIRTH_REQUIRED", "حددي تاريخ ميلاد الطفل — الحق يبدأ بعد العودة من إجازة الوضع.", "Set the child's birth date — the right starts after returning from maternity leave.");
      if (birth > String(input.date).slice(0, 10)) return fail("BIRTH_ORDER", "تاريخ ميلاد الطفل بعد تاريخ بداية الساعة.", "The birth date is after the start date.");
      const lastDay = nursingRightUntil(birth);
      if (String(input.date).slice(0, 10) > lastDay) return fail("NURSING_OVER_24M", `انتهى حق ساعة الرضاعة في ${lastDay} — أربعة وعشرون شهراً من تاريخ الوضع (اللائحة م31/1).`, `The nursing right ended on ${lastDay} — 24 months from birth (Regs Art. 31(1)).`);
      const askedUntil = String(input.until || "").slice(0, 10);
      if (askedUntil && askedUntil > lastDay) return fail("NURSING_OVER_24M", `ساعة الرضاعة حتى ${lastDay} كحد أقصى — أربعة وعشرون شهراً من تاريخ الوضع (اللائحة م31/1).`, `The nursing hour runs until ${lastDay} at most — 24 months from birth (Regs Art. 31(1)).`);
    }
    const until = String(input.until || "").slice(0, 10);
    if (until && until < String(input.date).slice(0, 10)) return fail("UNTIL_ORDER", "تاريخ النهاية قبل البداية.", "The end date is before the start.");
  }
  if (type === "pregnancy_notice") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.dueDate || "").slice(0, 10))) {
      return fail("DUE_REQUIRED", "حددي تاريخ الولادة المتوقع.", "Set the expected birth date.");
    }
    if (!input.file && !(Array.isArray(input.files) && input.files.filter(Boolean).length)) {
      return fail("FILE_REQUIRED", "أرفقي تقريراً طبياً يثبت الحمل.", "Attach a medical report confirming the pregnancy.");
    }
  }
  return { ok: true };
}

/** One line of what was asked — for the request card. */
export function dutyRequestDetail(row, { ar = true, shiftLabel = "" } = {}) {
  if (!row || !isDutyRequestType(row.type)) return "";
  if (row.type === "permission") {
    return row.time && row.timeTo ? (ar ? `من ${row.time} إلى ${row.timeTo}` : `From ${row.time} to ${row.timeTo}`) : "";
  }
  if (row.type === "shift_change") {
    return ar ? `المطلوب: ${shiftLabel || (row.shiftTypeId ? row.shiftTypeId : "راحة")}` : `Asked: ${shiftLabel || row.shiftTypeId || "rest"}`;
  }
  if (row.type === "nursing_hour") {
    const where = nursingSplitLabel(nursingSplitOf(row), ar);
    return [
      where,
      row.childBirthDate ? (ar ? `ميلاد الطفل ${row.childBirthDate}` : `child born ${row.childBirthDate}`) : "",
      row.until ? (ar ? `حتى ${row.until}` : `until ${row.until}`) : "",
    ].filter(Boolean).join(" · ");
  }
  if (row.type === "pregnancy_notice") {
    return row.dueDate ? (ar ? `الولادة المتوقعة: ${row.dueDate}` : `Expected birth: ${row.dueDate}`) : "";
  }
  return "";
}

/** What approval does — the manager reads this before deciding. */
export function dutyRequestEffect(type, ar = true) {
  const copy = {
    permission: ["عند الاعتماد: لا يُحتسب هذا الوقت تأخيراً ولا خروجاً مبكراً في سجل الموظف.", "On approval: this window is not lateness or early leave on the record."],
    shift_change: ["عند الاعتماد: تتغيّر خانة الموظف في جدول الدوام لذلك اليوم، وتُفحص أنظمة الوزارة على الجدول الجديد.", "On approval: the roster cell for that day changes and the ministry checks rerun."],
    nursing_hour: ["عند الاعتماد: تُكتب الساعة في ملفها وتُحسب من ساعات العمل الفعلية بلا خصم (المادة 154). رفضها يحتاج سبباً نظامياً.", "On approval: the hour is written on her file and counted as work with no pay cut (Art. 154). Refusing needs a lawful reason."],
    pregnancy_notice: ["عند الاعتماد: يُكتب تاريخ الولادة في ملفها، ويمنع الجدول إسنادها للعمل الليلي في الـ24 أسبوعاً قبل الوضع (القرار 18632)، ويلزم توفير عمل مناسب في الساعات المعتادة.", "On approval: the due date is written on her file; the roster blocks night work in the 24 weeks before birth (18632) and ordinary-hours work must be offered."],
    family_duties: ["عند الاعتماد: تُكتب «مسؤوليات عائلية» في ملفه، ويظهر للمدير عند إسناده لوردية ليلية أنه يُراعى قدر الإمكان (القرار 18632 هـ) — مراعاة لا مانع. الرفض يحتاج سبباً مكتوباً.", "On approval: family responsibilities are written on the file and the roster notes them on night assignment (18632 e) — a consideration, not a block. Refusing needs a written reason."],
    heat_report: ["عند الاعتماد: يُسجَّل يومه «مظلّل» في الجدول — أي أنك نقلته من العمل تحت الشمس. إن لم يُنقل فارفض واكتب السبب؛ تبقى المخالفة ظاهرة (القرار 3337).", "On approval: his day is marked shaded — you moved him out of the sun. If not, refuse with a reason; the violation stays visible (3337)."],
  }[type];
  return copy ? (ar ? copy[0] : copy[1]) : "";
}

/**
 * What the roster already says about this request — so the manager decides with the facts:
 *   pregnancy_notice → night days already assigned inside the 24-week ban,
 *   heat_report      → the day's current sun mark and whether the shift touches the ban hours.
 */
export function dutyRequestRosterFacts({ row, schedule, ar = true, nightDays = [], sunMark = "" } = {}) {
  if (!row) return [];
  const facts = [];
  if (row.type === "pregnancy_notice") {
    facts.push(nightDays.length
      ? { tone: "bad", text: ar ? `عليها ورديات ليلية داخل فترة الحظر: ${nightDays.join("، ")} — تُنقل قبل النشر.` : `Night shifts inside the ban: ${nightDays.join(", ")} — move them before publishing.` }
      : { tone: "ok", text: ar ? "لا وردية ليلية عليها داخل فترة الحظر في الجدول الحالي." : "No night shift for her inside the ban on the current roster." });
  }
  if (row.type === "heat_report") {
    facts.push(sunMark === "field"
      ? { tone: "bad", text: ar ? "الخانة محدّدة «مكشوف» في الجدول — مخالفة ظاهرة للموظف والإدارة." : "The cell is marked exposed — a visible violation." }
      : sunMark === "office"
        ? { tone: "ok", text: ar ? "الخانة محدّدة «مظلّل» في الجدول." : "The cell is marked shaded." }
        : { tone: "warn", text: ar ? "لم يُحدَّد «مكشوف / مظلّل» لهذا اليوم في الجدول." : "No exposed/shaded mark for this day on the roster." });
  }
  return facts;
}

/** Pending «طلبات الدوام» of the given people — newest first. */
export function pendingDutyRequests(people = []) {
  const rows = [];
  for (const employee of people || []) {
    for (const row of employee?.otherRequests || []) {
      if (isDutyRequestType(row?.type) && (row.status || "pending") === "pending") rows.push({ ...row, employee });
    }
  }
  return rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
