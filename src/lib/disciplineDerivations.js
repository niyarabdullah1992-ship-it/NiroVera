/** Arts 66–73 disciplinary path. Proof Cycle evidence attaches at each step. */

import { citeRule, ruleValue } from "./laborRules.js";
import { countDaysExcludingOfficialHolidays } from "./ummAlQuraCalendar.js";
import { compareToRegulation, regulationRef, regulationStanding, regulationStepFor } from "./workRegulation.js";
import { ART80 } from "./dutyYears.js";

export const DISCIPLINE_STEPS = [
  { id: "incident", ar: "واقعة", en: "Incident" },
  { id: "notice", ar: "إشعار", en: "Notice" },
  { id: "hearing", ar: "تحقيق ومحضر", en: "Hearing & minutes" },
  { id: "decision", ar: "قرار", en: "Decision" },
  { id: "notify", ar: "تبليغ", en: "Notify" },
  { id: "appeal", ar: "تظلم داخلي", en: "Internal appeal" },
  { id: "ruling", ar: "بتّ", en: "Ruling" },
];

function dateOnly(iso) {
  const s = String(iso || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function addCalendarDays(iso, n) {
  const s = dateOnly(iso);
  if (!s) return "";
  const d = new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  d.setDate(d.getDate() + Number(n));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayRiyadh() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}

function pastChargeWindow(fromIso, today, maxDays) {
  const from = dateOnly(fromIso);
  if (!from || !maxDays) return false;
  const latest = addCalendarDays(from, maxDays);
  return Boolean(latest) && today > latest;
}

/** Art. 72 worker clocks: 30 days excluding official holidays. */
function pastHolidayExcludedWindow(fromIso, today, maxDays, calendar) {
  const from = dateOnly(fromIso);
  if (!from || !maxDays) return false;
  return countDaysExcludingOfficialHolidays(from, today, calendar) > maxDays;
}

export function nextDisciplineStep(status) {
  const i = DISCIPLINE_STEPS.findIndex((s) => s.id === String(status || "incident"));
  return DISCIPLINE_STEPS[Math.min(DISCIPLINE_STEPS.length - 1, i + 1)] || DISCIPLINE_STEPS[0];
}

export function disciplineEvidenceList(caseRow, extra = []) {
  const fromMessages = (caseRow?.messages || []).flatMap((m) => m.files || []);
  return [...(caseRow?.evidence || []), ...fromMessages, ...(extra || [])].filter(Boolean);
}

export function disciplineAppealNote(caseRow, extra = "") {
  if (String(extra || "").trim()) return String(extra).trim();
  if (String(caseRow?.appealNote || "").trim()) return String(caseRow.appealNote).trim();
  const lastEmp = [...(caseRow?.messages || [])].reverse().find((m) => m.from === "employee" && String(m.text || "").trim());
  return String(lastEmp?.text || "").trim();
}

export const DISCIPLINE_PENALTY_KINDS = [
  { id: "warning", limb: "1", ar: "إنذار", en: "Warning", days: [0] },
  { id: "fine", limb: "2", ar: "غرامة", en: "Fine", days: [1, 2, 3, 4, 5] },
  { id: "increment", limb: "3", ar: "حرمان من العلاوة أو تأجيلها لمدة لا تزيد على سنة", en: "Withhold or defer an increment for up to one year", days: [0], deferMonths: 12 },
  { id: "promotion", limb: "4", ar: "تأجيل الترقية مدة لا تزيد على سنة", en: "Defer promotion for up to one year", days: [0], deferMonths: 12 },
  { id: "suspend", limb: "5", ar: "الإيقاف عن العمل مع الحرمان من الأجر", en: "Unpaid suspension from work", days: [1, 2, 3, 4, 5] },
  { id: "dismissal_with_award", limb: "6", ar: "الفصل من العمل مع المكافأة", en: "Dismissal with the end-of-service award", days: [0] },
  { id: "dismiss", limb: "6", ar: "الفصل بدون مكافأة أو إشعار أو تعويض — حالات المادة 80", en: "Dismissal without award, notice or compensation — Article 80 cases", days: [0] },
];

/**
 * Labour Law Art. 80 — the only cases in which the employer may end the contract without the award,
 * notice or compensation, "provided he gives the worker the opportunity to state his reasons for
 * objecting to the dismissal". The ground is picked from this list, never written freely.
 */
export const ART80_GROUNDS = [
  { id: "assault", para: 1, ar: "اعتداء على صاحب العمل أو المدير المسؤول أو أحد رؤسائه أو مرؤوسيه أثناء العمل أو بسببه", en: "Assault on the employer, the responsible manager, a superior or subordinate during or because of work" },
  { id: "duties", para: 2, ar: "عدم أداء الالتزامات الجوهرية أو عدم إطاعة الأوامر المشروعة أو عدم مراعاة تعليمات السلامة المعلنة عمداً — رغم إنذاره كتابة", en: "Not performing essential obligations, disobeying lawful orders, or deliberately ignoring posted safety instructions — despite a written warning", warning: true },
  { id: "conduct", para: 3, ar: "سلوك سيئ أو عمل مخل بالشرف أو الأمانة", en: "Bad conduct or an act against honour or integrity" },
  { id: "loss", para: 4, ar: "فعل أو تقصير متعمد يقصد به إلحاق خسارة مادية بصاحب العمل — بشرط إبلاغ الجهات المختصة خلال 24 ساعة من العلم", en: "A deliberate act or omission meant to cause the employer material loss — provided the authorities are told within 24 hours", report24h: true },
  { id: "forgery", para: 5, ar: "اللجوء إلى التزوير للحصول على العمل", en: "Forgery to obtain the job" },
  { id: "probation", para: 6, ar: "معيّن تحت الاختبار", en: "Appointed on probation" },
  { id: "absence", para: 7, ar: "الغياب دون سبب مشروع أكثر من 30 يوماً في السنة العقدية أو أكثر من 15 يوماً متتالية — بعد إنذار كتابي", en: "Absence without a legitimate reason for more than 30 days in a contract year or 15 consecutive days — after a written warning", absence: true },
  { id: "position", para: 8, ar: "استغلال المركز الوظيفي بطريقة غير مشروعة للحصول على نتائج ومكاسب شخصية", en: "Unlawful use of the position for personal gain" },
  { id: "secrets", para: 9, ar: "إفشاء الأسرار الصناعية أو التجارية الخاصة بالعمل", en: "Disclosing the work's industrial or commercial secrets" },
];

export function art80Ground(id) {
  return ART80_GROUNDS.find((row) => row.id === String(id || "")) || null;
}

/** The absence figures for an Art. 80(7) dismissal from a dutyYears `art80Reading` (information only). */
export function art80AbsenceFromReading(reading, mode = "consecutive") {
  const part = mode === "intermittent" ? reading?.intermittent : reading?.consecutive;
  return { mode, days: Number(part?.value) || 0, notice: part?.notice, limit: part?.limit };
}

function art80Fail(error, reason, reasonEn, day) {
  return { ok: false, error, reason, reasonEn, cite: citeRule("eos.art80.cite", day) };
}

/**
 * Art. 80 gate for a dismissal without award. `stage` "raise" checks the ground is from the list;
 * "sign" also checks what the paragraph makes a condition:
 *   - the worker was given the chance to object (a hearing on file),
 *   - para 2: a prior written warning,
 *   - para 4: the authorities were told within 24 hours,
 *   - para 7: a written warning after 10 consecutive / 20 intermittent days, and more than 15 / 30 days absent.
 * `art80` on the case: { mode, days, warnedAt, warnedAtDays, reportedAt, discoveredAt }.
 */
export function checkArt80DismissGate(caseRow, { today, stage = "sign" } = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const ground = art80Ground(caseRow?.dismissGround);
  if (!ground) {
    return art80Fail(
      "DISCIPLINE_DISMISS_GROUND",
      "موقوف — الفصل بدون مكافأة لا يكون إلا في إحدى حالات المادة 80؛ اختر الحالة من القائمة.",
      "Blocked — dismissal without award is only in one of the Article 80 cases; pick the case from the list.",
      day,
    );
  }
  if (stage !== "sign") return { ok: true, ground, cite: citeRule("eos.art80.cite", day) };
  const a = caseRow?.art80 || {};
  const heard = Boolean(String(caseRow?.hearingMinutes || "").trim() || dateOnly(caseRow?.hearingEndedAt) || dateOnly(caseRow?.objectionHeardAt));
  if (!heard) {
    return art80Fail(
      "ART80_OBJECTION_REQUIRED",
      "موقوف — لا فسخ بموجب المادة 80 قبل إتاحة الفرصة للعامل لإبداء أسباب معارضته للفسخ؛ أثبت سماعه في المحضر.",
      "Blocked — no Article 80 dismissal before the worker is given the chance to state his objection; record the hearing.",
      day,
    );
  }
  if (ground.warning && !dateOnly(a.warnedAt)) {
    return art80Fail(
      "ART80_WARNING_REQUIRED",
      "موقوف — الفقرة 2 من المادة 80 تشترط إنذار العامل كتابة قبل الفسخ؛ سجّل تاريخ الإنذار الكتابي.",
      "Blocked — Article 80(2) requires a prior written warning; record its date.",
      day,
    );
  }
  if (ground.report24h) {
    const knew = dateOnly(a.discoveredAt || caseRow?.discoveredAt);
    const reported = dateOnly(a.reportedAt);
    if (!reported || (knew && daysBetween(knew, reported) > 1)) {
      return art80Fail(
        "ART80_LOSS_REPORT",
        "موقوف — الفقرة 4 من المادة 80 تشترط إبلاغ الجهات المختصة بالحادث خلال أربع وعشرين ساعة من العلم به.",
        "Blocked — Article 80(4) requires reporting the incident to the authorities within 24 hours of knowing.",
        day,
      );
    }
  }
  if (ground.absence) {
    const mode = a.mode === "intermittent" ? "intermittent" : "consecutive";
    const notice = mode === "intermittent" ? ART80.intermittentNotice : ART80.consecutiveNotice;
    const limit = mode === "intermittent" ? ART80.intermittentLimit : ART80.consecutiveLimit;
    const warnedAt = dateOnly(a.warnedAt);
    if (!warnedAt) {
      return art80Fail(
        "ART80_ABSENCE_WARNING_REQUIRED",
        `موقوف — يسبق الفصل إنذار كتابي بعد غياب ${notice} ${mode === "intermittent" ? "يوماً متقطعة" : "أيام متتالية"} (المادة 80/7)؛ سجّل تاريخ الإنذار.`,
        `Blocked — dismissal must be preceded by a written warning after ${notice} ${mode} days of absence (Art. 80(7)).`,
        day,
      );
    }
    if (warnedAt > day) {
      return art80Fail("ART80_ABSENCE_WARNING_FUTURE", "تاريخ الإنذار لا يكون بعد اليوم.", "The warning date cannot be after today.", day);
    }
    if (!(Number(a.warnedAtDays) >= notice)) {
      return art80Fail(
        "ART80_ABSENCE_WARNING_EARLY",
        `موقوف — الإنذار يُوجَّه بعد بلوغ الغياب ${notice} ${mode === "intermittent" ? "يوماً في السنة العقدية" : "أيام متتالية"} (المادة 80/7).`,
        `Blocked — the warning is given once absence reaches ${notice} ${mode} days (Art. 80(7)).`,
        day,
      );
    }
    if (!(Number(a.days) > limit)) {
      return art80Fail(
        "ART80_ABSENCE_UNDER_LIMIT",
        `موقوف — الفصل للغياب يكون إذا زاد على ${limit} ${mode === "intermittent" ? "يوماً في السنة العقدية" : "يوماً متتالية"} (المادة 80/7).`,
        `Blocked — absence dismissal needs more than ${limit} ${mode} days (Art. 80(7)).`,
        day,
      );
    }
  }
  return { ok: true, ground, cite: citeRule("eos.art80.cite", day) };
}

/** Model regulation Art. 58(6): dismissal with the award rests on a legitimate reason, written on the case. */
export function checkAwardDismissGate(caseRow, { today } = {}) {
  const day = dateOnly(today) || todayRiyadh();
  if (String(caseRow?.dismissGround || "").trim() || String(caseRow?.regulationClauseId || "").trim()) {
    return { ok: true, cite: citeRule("discipline.penalties.cite", day) };
  }
  return {
    ok: false,
    error: "DISCIPLINE_AWARD_DISMISS_REASON",
    reason: "الفصل مع المكافأة يكون لسبب مشروع لارتكاب المخالفة — اذكر بند اللائحة أو السبب المشروع (النموذج الموحد م58/6).",
    reasonEn: "Dismissal with award rests on a legitimate reason for the offence — name the regulation clause or the reason (model regulation Art. 58(6)).",
    cite: citeRule("discipline.penalties.cite", day),
  };
}

const LISTED_KIND = new Set(DISCIPLINE_PENALTY_KINDS.map((row) => row.id));

export function resolveDisciplineWorkStationId(employee) {
  const id = String(employee?.stationId || employee?.station_id || "").trim();
  return id || null;
}

export function listedPenaltyKind(kindId) {
  return DISCIPLINE_PENALTY_KINDS.find((row) => row.id === String(kindId || "")) || null;
}

export function listedPenaltyLabel(kindId, days = 0, ar = true) {
  const kind = listedPenaltyKind(kindId);
  if (!kind) return ar ? "جزاء" : "Sanction";
  const n = Number(days) || 0;
  if (kind.id === "fine") {
    // A share of one day's wage, as the regulation's percentage steps read (e.g. 10%).
    if (n > 0 && n < 1) return ar ? `غرامة ${Math.round(n * 100)}% من أجر يوم` : `Fine of ${Math.round(n * 100)}% of a day's wage`;
    if (n === 1) return ar ? "غرامة أجر يوم" : "Fine of one day's wage";
    if (n === 2) return ar ? "غرامة أجر يومين" : "Fine of two days' wage";
    return ar ? `غرامة أجر ${n} أيام` : `Fine of ${n} days' wage`;
  }
  if (kind.id === "suspend") {
    if (n === 1) return ar ? "إيقاف يوم بلا أجر" : "One-day unpaid suspension";
    if (n === 2) return ar ? "إيقاف يومين بلا أجر" : "Two-day unpaid suspension";
    return ar ? `إيقاف ${n} أيام بلا أجر` : `${n}-day unpaid suspension`;
  }
  return ar ? kind.ar : kind.en;
}

export function flattenListedPenalties() {
  return DISCIPLINE_PENALTY_KINDS.flatMap((kind) => kind.days.map((days) => ({
    id: kind.days.length === 1 ? kind.id : `${kind.id}_${days}`,
    kind: kind.id,
    days,
    deferMonths: kind.deferMonths || 0,
    limb: kind.limb,
    ar: listedPenaltyLabel(kind.id, days, true),
    en: listedPenaltyLabel(kind.id, days, false),
  })));
}

export function resolvePenaltyKind(item) {
  const stored = String(item?.penaltyKind || "").trim();
  if (stored) return stored;
  const id = String(item?.penaltyId || "");
  if (id.startsWith("fine") || id.startsWith("cut_")) return "fine";
  if (id.startsWith("suspend")) return "suspend";
  if (id === "increment" || id === "increment_defer") return "increment";
  if (id === "promotion" || id === "promotion_defer") return "promotion";
  if (id === "dismissal_with_award") return "dismissal_with_award";
  if (id === "dismiss") return "dismiss";
  if (id === "warning" || id === "caution") return "warning";
  const text = `${item?.penalty || ""} ${item?.penaltyLabel || ""}`;
  if (/مع\s*(?:ال)?مكافأة|with (?:the )?award/i.test(text)) return "dismissal_with_award";
  if (/فصل|dismiss/i.test(text)) return "dismiss";
  if (/إيقاف|suspend/i.test(text)) return "suspend";
  if (/علاوة|increment/i.test(text)) return "increment";
  if (/ترقية|promotion/i.test(text)) return "promotion";
  if (/غرامة|حسم|fine|cut/i.test(text) || Number(item?.cutDays || item?.fineDays || 0) > 0) return "fine";
  return "warning";
}

export function incidentKey(note) {
  return String(note || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isSimpleOralOffence(item) {
  const stored = String(item?.penaltyKind || item?.penaltyId || "").trim();
  const days = Number(item?.cutDays || item?.fineDays || 0);
  if (stored === "warning" || stored === "caution") return true;
  if (stored.startsWith("fine") && days <= 1) return true;
  return false;
}

export function disciplineHearingMinutes(caseRow, extra = "") {
  if (String(extra || "").trim()) return String(extra).trim();
  if (String(caseRow?.hearingMinutes || "").trim()) return String(caseRow.hearingMinutes).trim();
  const last = [...(caseRow?.messages || [])].reverse().find((m) => String(m.text || "").trim() && (m.from === "employee" || m.kind === "hearing"));
  return String(last?.text || "").trim();
}

export function checkWorkplaceDisciplineGate(caseRow, { today } = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const cite = citeRule("discipline.workplace.cite", day);
  const offSite = caseRow?.offSite === true || caseRow?.offSite === "true" || caseRow?.place === "offsite";
  if (!offSite) return { ok: true, cite };
  if (String(caseRow?.workConnected || caseRow?.workLink || "").trim()) return { ok: true, cite };
  return {
    ok: false,
    error: "DISCIPLINE_OFFSITE_UNRELATED",
    reason: "موقوف — لا جزاء على أمر خارج مكان العمل ما لم يكن متصلاً بالعمل أو بصاحبه أو بمديره المسؤول (المادة 70).",
    reasonEn: "Blocked — no penalty for an act outside the workplace unless it is connected with the work, the employer, or the responsible manager (Article 70).",
    cite,
  };
}

export function caseCountsAsPenalty(item) {
  const outcome = String(item?.rulingOutcome || item?.rulingLabel || "");
  if (/void|أُلغي|الغي/i.test(outcome)) return false;
  if (item?.signedAt || item?.decidedAt) return true;
  return String(item?.status || "") !== "closed";
}

export function penaltyRank(item) {
  const kind = resolvePenaltyKind(item);
  const days = Number(item?.cutDays || item?.fineDays || 0);
  if (kind === "warning") return 10;
  if (kind === "fine") return 20 + days;
  if (kind === "increment" || kind === "promotion") return 40;
  if (kind === "suspend") return 50 + days;
  if (kind === "dismissal_with_award") return 80;
  if (kind === "dismiss") return 90;
  return days;
}

export function checkListedPenaltyGate(item, today) {
  const day = dateOnly(today) || todayRiyadh();
  const cite = citeRule("discipline.listedOnly.cite", day);
  const kind = resolvePenaltyKind(item);
  const spec = listedPenaltyKind(kind);
  if (!spec) {
    return {
      ok: false,
      error: "DISCIPLINE_PENALTY_NOT_LISTED",
      reason: "موقوف — لا يُوقَّع جزاء غير وارد في النظام أو في لائحة تنظيم العمل (المادة 67).",
      reasonEn: "Blocked — no penalty may be imposed that is not in the Law or the work-organization regulations (Article 67).",
      cite,
    };
  }
  const days = Number(item?.cutDays || item?.fineDays || 0);
  if ((kind === "fine" || kind === "suspend") && days > (ruleValue("discipline.fine.maxDays", day) || 5)) {
    return {
      ok: false,
      error: "DISCIPLINE_FINE_OVER_CAP",
      reason: "موقوف — غرامة المخالفة الواحدة أو الإيقاف بلا أجر لا يزيد على أجر خمسة أيام (المادة 70).",
      reasonEn: "Blocked — a single-offence fine or unpaid suspension may not exceed five days (Article 70).",
      cite: citeRule("discipline.fine.maxDays", day),
    };
  }
  const regulationShare = kind === "fine" && days > 0 && days < 1;
  if (!regulationShare && spec.days.length && !spec.days.includes(days) && !(days === 0 && spec.days.includes(0))) {
    return {
      ok: false,
      error: "DISCIPLINE_PENALTY_NOT_LISTED",
      reason: "موقوف — مقدار هذا الجزاء يخرج عن قائمة المادة 66.",
      reasonEn: "Blocked — this penalty amount is outside the Article 66 list.",
      cite: citeRule("discipline.penalties.cite", day),
    };
  }
  return { ok: true, cite: citeRule("discipline.penalties.cite", day), kind, spec };
}

export function checkDisciplineDoubleFileGate(caseRow, { cases = [], today } = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const cite = citeRule("discipline.fine.maxDays", day);
  const empId = String(caseRow?.employeeId || "");
  const key = incidentKey(caseRow?.note || caseRow?.reason);
  if (!empId || !key) return { ok: true, cite };
  const other = (cases || []).find((row) => (
    String(row.id) !== String(caseRow?.id || "")
    && String(row.employeeId) === empId
    && incidentKey(row.note || row.reason) === key
    && caseCountsAsPenalty(row)
  ));
  if (!other) return { ok: true, cite };
  return {
    ok: false,
    error: "DISCIPLINE_DOUBLE_PENALTY",
    reason: "موقوف — لا يُوقَّع أكثر من جزاء واحد على المخالفة الواحدة (المادة 70).",
    reasonEn: "Blocked — more than one penalty may not be imposed for a single offence (Article 70).",
    cite,
  };
}

export function monthCapDaysByKind(cases, employeeId, today, kind) {
  const day = dateOnly(today) || todayRiyadh();
  const month = day.slice(0, 7);
  let sum = 0;
  for (const row of cases || []) {
    if (String(row.employeeId) !== String(employeeId)) continue;
    if (!caseCountsAsPenalty(row)) continue;
    if (!row.signedAt && !row.decidedAt) continue;
    const when = dateOnly(row.signedAt || row.decidedAt);
    if (!when || when.slice(0, 7) !== month) continue;
    if (resolvePenaltyKind(row) !== kind) continue;
    const outcome = String(row.rulingOutcome || "");
    if (outcome === "void" || outcome === "lower") continue;
    sum += Number(row.cutDays || row.fineDays || 0);
  }
  return sum;
}

export function checkDisciplineMonthCapGate(caseRow, { cases = [], today } = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const cite = citeRule("discipline.fine.maxDays", day);
  const cap = ruleValue("discipline.fine.maxDays", day) || 5;
  const kind = resolvePenaltyKind(caseRow);
  const days = Number(caseRow?.cutDays || caseRow?.fineDays || 0);
  if ((kind !== "fine" && kind !== "suspend") || days <= 0) return { ok: true, cite, cap };
  const used = monthCapDaysByKind(cases, caseRow?.employeeId, day, kind);
  if (used + days > cap) {
    return {
      ok: false,
      error: kind === "suspend" ? "DISCIPLINE_SUSPEND_MONTH_CAP" : "DISCIPLINE_MONTH_CAP",
      reason: kind === "suspend"
        ? `موقوف — الإيقاف بلا أجر لا يزيد على ${cap} أيام في الشهر (المادة 70).`
        : `موقوف — لا يُحسم وفاءً للغرامات أكثر من أجر ${cap} أيام في الشهر (المادة 70).`,
      reasonEn: kind === "suspend"
        ? `Blocked — unpaid suspension may not exceed ${cap} days in a month (Article 70).`
        : `Blocked — monthly fine deductions may not exceed ${cap} days' wage (Article 70).`,
      cite,
    };
  }
  return { ok: true, cite, cap, used };
}

export function checkRaiseDisciplineGate({
  employee,
  actor,
  note,
  today,
  discoveredAt,
  penaltyKind,
  cutDays,
  dismissGround,
  offSite = false,
  workConnected = "",
  cases = [],
} = {}) {
  const day = dateOnly(today) || todayRiyadh();
  if (!employee?.id) {
    return { ok: false, error: "DISCIPLINE_EMPLOYEE_REQUIRED", reason: "الواقعة مربوطة بموظف.", reasonEn: "The incident is tied to an employee.", cite: citeRule("discipline.penalties.cite", day) };
  }
  if (actor?.id && String(employee.id) === String(actor.id)) {
    return {
      ok: false,
      error: "DISCIPLINE_SELF_SANCTION",
      reason: "لا يُرفع جزاء على الملف نفسه من صاحبه.",
      reasonEn: "A sanction is not raised on the actor's own file.",
      cite: citeRule("discipline.penalties.cite", day),
    };
  }
  if (!resolveDisciplineWorkStationId(employee)) {
    return {
      ok: false,
      error: "STATION_REQUIRED",
      reason: "لا يُفتح ملف جزاء بلا محطة عمل للموظف — اربط ملفه بفرع أولاً.",
      reasonEn: "A sanction file does not open without the employee's work station — place their file on a branch first.",
      cite: citeRule("discipline.penalties.cite", day),
    };
  }
  if (!String(note || "").trim()) {
    return {
      ok: false,
      error: "DISCIPLINE_NOTE_REQUIRED",
      reason: "بلا وصف لا يصحّ الإبلاغ (المادة 71).",
      reasonEn: "Notice needs a written description (Article 71).",
      cite: citeRule("discipline.hearing.cite", day),
    };
  }
  const draft = { employeeId: employee.id, note, penaltyKind, cutDays: Number(cutDays) || 0, dismissGround, offSite, workConnected };
  const listed = checkListedPenaltyGate(draft, day);
  if (!listed.ok) return listed;
  const place = checkWorkplaceDisciplineGate(draft, { today: day });
  if (!place.ok) return place;
  if (listed.kind === "dismiss") {
    const art80 = checkArt80DismissGate({ dismissGround }, { today: day, stage: "raise" });
    if (!art80.ok) return art80;
  }
  const double = checkDisciplineDoubleFileGate(draft, { cases, today: day });
  if (!double.ok) return double;
  const discovered = dateOnly(discoveredAt) || day;
  if (discovered > day) {
    return {
      ok: false,
      error: "DISCIPLINE_DISCOVERY_FUTURE",
      reason: "تاريخ الكشف لا يكون بعد اليوم.",
      reasonEn: "The discovery date cannot be after today.",
      cite: citeRule("discipline.charge.maxDays", day),
    };
  }
  return checkAdvanceDisciplineGate({ employeeId: employee.id, discoveredAt: discovered, createdAt: day }, "notice", { today: day });
}

/**
 * Raise-form chips. Each row is the live gate for that article.
 * warn does not open a file by itself; fail matches a gate that blocks.
 */
export function deriveRaiseDisciplineChips({
  employee,
  note = "",
  today,
  discoveredAt,
  penaltyKind,
  cutDays = 0,
  dismissGround = "",
  offSite = false,
  workConnected = "",
  cases = [],
  ar = true,
  regulation = null,
  clauseId = "",
} = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const kind = listedPenaltyKind(penaltyKind);
  const days = Number(cutDays) || 0;
  const articleOf = (ruleId) => citeRule(ruleId, day)?.article || "—";
  const chipLabel = (article) => (ar ? `المادة ${article}` : `Art. ${article}`);
  const draft = {
    employeeId: employee?.id || "",
    note,
    penaltyKind,
    cutDays: days,
    dismissGround,
    offSite: Boolean(offSite),
    workConnected,
  };
  const listed = checkListedPenaltyGate(draft, day);
  const art66 = articleOf("discipline.penalties.cite");
  const kindName = kind ? (ar ? kind.ar : kind.en) : "—";
  let state66 = kind ? "pass" : "fail";
  let text66 = kind
    ? (ar ? `الجزاء من قائمة المادة ${art66}: ${kindName}.` : `Penalty on the Article ${art66} list: ${kindName}.`)
    : (ar ? (listed.reason || "—") : (listed.reasonEn || "—"));
  if (kind?.id === "dismiss") {
    const art80 = checkArt80DismissGate({ dismissGround }, { today: day, stage: "raise" });
    if (!art80.ok) {
      state66 = "fail";
      text66 = ar ? art80.reason : art80.reasonEn;
    } else {
      state66 = "warn";
      text66 = ar
        ? `المادة 80/${art80.ground.para}: ${art80.ground.ar}. لا يُوقَّع الفسخ قبل سماع معارضته${art80.ground.absence ? " والإنذار الكتابي بعد 10 أيام متتالية أو 20 متقطعة" : art80.ground.warning ? " والإنذار الكتابي السابق" : ""}.`
        : `Art. 80(${art80.ground.para}): ${art80.ground.en}. Not signed before the worker's objection is heard.`;
    }
  }

  const art67 = articleOf("discipline.listedOnly.cite");
  let state67 = kind ? "pass" : "fail";
  let text67 = kind
    ? (ar ? "الجزاء من قائمة النظام." : "The penalty is on the Law's list.")
    : (ar
      ? "موقوف — لا يُوقَّع جزاء غير وارد في النظام أو في لائحة تنظيم العمل."
      : "Blocked — no penalty may be imposed that is not in the Law or the work-organization regulations.");
  if (kind && regulation) {
    const own = regulation.source === "own";
    const standing = regulationStanding(regulation, day);
    const at = clauseId
      ? regulationStepFor({ regulation, clauseId, cases, employeeId: employee?.id, today: day, cooloffDays: ruleValue("discipline.repeat.cooloffDays", day) || 180, ar })
      : null;
    if (!at) {
      state67 = own ? "fail" : "warn";
      text67 = own
        ? (ar ? "موقوف — اختر بند المخالفة من لائحة تنظيم العمل المعتمدة؛ لا جزاء على مخالفة غير واردة فيها." : "Blocked — pick the offence clause from the approved regulation; no penalty for an offence it does not list.")
        : (ar ? "لم تُسجَّل لائحة المنشأة المعتمدة بعد — اختر البند المقابل من النموذج الاسترشادي، وسجّل لائحتك من «لائحة الجزاءات»." : "The establishment's approved regulation is not recorded — pick the matching model clause, and record yours under the penalty list.");
    } else {
      const cmp = compareToRegulation(kind.id, days, at.step);
      const ref = regulationRef(regulation, at.clause, ar);
      const says = ar ? `${ref} — ${at.timeLabel}${at.lastAt ? ` (السابقة ${at.lastAtLabel})` : ""}: ${at.label}.` : `${ref} — ${at.timeLabel}: ${at.label}.`;
      if (cmp === "harsher") {
        state67 = own ? "fail" : "warn";
        text67 = ar ? `${own ? "موقوف — " : ""}الجزاء المختار أشد مما تنص عليه اللائحة. ${says}` : `${own ? "Blocked — " : ""}The chosen penalty is harsher than the regulation. ${says}`;
      } else if (cmp === "lighter") {
        state67 = "warn";
        text67 = ar ? `الجزاء المختار أخف مما تنص عليه اللائحة — يجوز. ${says}` : `The chosen penalty is lighter than the regulation — allowed. ${says}`;
      } else {
        text67 = says + (at.lapsed && at.time === 1 ? (ar ? " مضى 180 يوماً على السابقة فلا تشديد (المادة 68)." : " 180 days passed since the previous one — no increase (Art. 68).") : "");
      }
      if (own && standing.id === "announced" && state67 !== "fail") {
        state67 = "fail";
        text67 = ar
          ? `موقوف — لائحة تنظيم العمل تسري على العمال من اليوم التالي لإعلانها (${standing.effectiveFrom}) — النموذج الموحد م72.`
          : `Blocked — the regulation binds workers from the day after its announcement (${standing.effectiveFrom}) — model Art. 72.`;
      } else if (own && standing.id === "draft" && state67 === "pass") {
        state67 = "warn";
        text67 = `${text67} ${ar ? "لم تُسجَّل واقعة إعلان اللائحة للعمال بعد (المادة 13) — أعلنها من «لائحة الجزاءات»." : "The regulation's announcement to the workers is not recorded yet (Art. 13)."}`;
      }
    }
  }

  const max = ruleValue("discipline.charge.maxDays", day);
  const art69 = articleOf("discipline.charge.maxDays");
  const discovered = dateOnly(discoveredAt) || day;
  const age = daysBetween(discovered, day);
  let state69 = "pass";
  let text69 = ar
    ? `كُشفت قبل ${age == null ? "—" : age} يوماً — ضمن مهلة ${max} يوماً.`
    : `Discovered ${age == null ? "—" : age} day(s) ago — inside the ${max}-day window.`;
  if (discovered > day) {
    state69 = "fail";
    text69 = ar ? "تاريخ الكشف لا يكون بعد اليوم." : "The discovery date cannot be after today.";
  } else if (pastChargeWindow(discovered, day, max)) {
    state69 = "fail";
    text69 = ar
      ? `موقوف — لا يُتهم العامل بمخالفة مضى على كشفها أكثر من ${max} يوماً.`
      : `Blocked — a worker may not be accused more than ${max} days after the offence was discovered.`;
  }

  const art70 = articleOf("discipline.workplace.cite");
  const place = checkWorkplaceDisciplineGate(draft, { today: day });
  const statePlace = place.ok ? "pass" : "fail";
  let textPlace = ar ? "ارتُكبت في مكان العمل." : "Committed at the workplace.";
  if (offSite) {
    textPlace = place.ok
      ? (ar ? "خارج مكان العمل ومتصلة بالعمل أو بصاحبه — يجوز الجزاء." : "Off-site and connected to the work or the employer — a penalty may be raised.")
      : (ar ? "خارج مكان العمل وغير متصلة بالعمل — لا يجوز الجزاء." : "Off-site and not connected to the work — a penalty may not be raised.");
  }

  const cap = ruleValue("discipline.fine.maxDays", day);
  const art70cap = articleOf("discipline.fine.maxDays");
  const wageKind = kind?.id === "fine" || kind?.id === "suspend";
  const month = checkDisciplineMonthCapGate(draft, { cases, today: day });
  const double = String(note || "").trim() && employee?.id
    ? checkDisciplineDoubleFileGate(draft, { cases, today: day })
    : { ok: true };
  let stateCap = "pass";
  let textCap = ar ? "هذا الجزاء بلا حسم من الأجر." : "This penalty has no wage cut.";
  if (!double.ok) {
    stateCap = "fail";
    textCap = ar ? double.reason : double.reasonEn;
  } else if (wageKind && (days > cap || listed.error === "DISCIPLINE_FINE_OVER_CAP")) {
    stateCap = "fail";
    textCap = ar
      ? `موقوف — غرامة المخالفة الواحدة أو الإيقاف بلا أجر لا يزيد على أجر ${cap} أيام.`
      : `Blocked — a single-offence fine or unpaid suspension may not exceed ${cap} days.`;
  } else if (wageKind && !month.ok) {
    stateCap = "fail";
    textCap = ar ? month.reason : month.reasonEn;
  } else if (wageKind) {
    stateCap = "warn";
    textCap = ar
      ? `الغرامة أو الإيقاف لا يتجاوزان أجر ${cap} أيام في الشهر — تُحسب في «حاسبة الحسم».`
      : `A fine or unpaid suspension may not exceed ${cap} days in a month — counted in the cut calculator.`;
  }

  const hasFacts = Boolean(String(note || "").trim());
  const art71 = articleOf("discipline.hearing.cite");
  const chips = [
    { key: "66", article: art66, label: chipLabel(art66), state: state66, text: text66 },
    { key: "67", article: art67, label: chipLabel(art67), state: state67, text: text67 },
    { key: "69", article: art69, label: chipLabel(art69), state: state69, text: text69 },
    { key: "70-place", article: art70, label: chipLabel(art70), state: statePlace, text: textPlace },
    { key: "70-cap", article: art70cap, label: chipLabel(art70cap), state: stateCap, text: textCap },
    {
      key: "71",
      article: art71,
      label: chipLabel(art71),
      state: hasFacts ? "pass" : "fail",
      text: hasFacts
        ? (ar ? "الواقعة مكتوبة وتُبلَّغ كتابةً، ثم تُسمع أقواله قبل التوقيع." : "The facts are written and will be notified in writing, then the statement is heard before signing.")
        : (ar ? "بلا وصف للواقعة لا يصح الإبلاغ" : "Without a written account of the facts, notice cannot open."),
    },
  ];
  return chips;
}

export function checkAdvanceDisciplineGate(caseRow, toStep, { files = [], appealNote = "", hearingMinutes = "", today, laborCalendar } = {}) {
  const day = dateOnly(today) || todayRiyadh();
  if (!caseRow?.employeeId) {
    return { ok: false, error: "DISCIPLINE_EMPLOYEE_REQUIRED", reason: "الواقعة مربوطة بموظف.", reasonEn: "The incident is tied to an employee.", cite: citeRule("discipline.penalties.cite", day) };
  }
  if (toStep === "notice") {
    const cite = citeRule("discipline.charge.maxDays", day);
    const max = ruleValue("discipline.charge.maxDays", day);
    const discovered = caseRow.discoveredAt || caseRow.createdAt;
    if (pastChargeWindow(discovered, day, max)) {
      return {
        ok: false,
        error: "DISCIPLINE_CHARGE_STALE",
        reason: `موقوف — لا يُتهم العامل بمخالفة مضى على كشفها أكثر من ${max} يوماً (المادة 69).`,
        reasonEn: `Blocked — a worker may not be accused more than ${max} days after the offence was discovered (Article 69).`,
        cite,
      };
    }
    return { ok: true, cite };
  }
  if (toStep === "hearing") {
    const cite = citeRule("discipline.hearing.cite", day);
    const minutes = disciplineHearingMinutes(caseRow, hearingMinutes);
    const extraFiles = (files || []).length > 0;
    const messageFiles = (caseRow?.messages || []).some((m) => (m.files || []).length);
    const hasDefenceFile = extraFiles || messageFiles;
    if (isSimpleOralOffence(caseRow)) {
      if (!minutes && !hasDefenceFile) {
        return {
          ok: false,
          error: "DISCIPLINE_HEARING_MINUTES",
          reason: "المخالفة البسيطة تُستجوَب شفاهة على أن يُثبت ذلك في المحضر (المادة 71).",
          reasonEn: "A minor offence may be questioned orally, provided that is recorded in the minutes (Article 71).",
          cite,
        };
      }
      return { ok: true, cite, oral: true };
    }
    if (!hasDefenceFile && !minutes) {
      return {
        ok: false,
        error: "DISCIPLINE_EVIDENCE_REQUIRED",
        reason: "لا جزاء قبل محضر مكتوب في الملف: إبلاغ بما نُسب واستجواب وتحقيق الدفاع (المادة 71).",
        reasonEn: "No penalty before written minutes on file: notice of the accusation, questioning, and hearing the defence (Article 71).",
        cite,
      };
    }
    return { ok: true, cite };
  }
  if (toStep === "decision") {
    const cite = citeRule("discipline.charge.maxDays", day);
    const max = ruleValue("discipline.charge.maxDays", day);
    const ended = caseRow.investigationEndedAt || caseRow.hearingEndedAt || caseRow.hearingAt;
    if (pastChargeWindow(ended, day, max)) {
      return {
        ok: false,
        error: "DISCIPLINE_PENALTY_STALE",
        reason: `موقوف — لا يُوقَّع الجزاء بعد انتهاء التحقيق بأكثر من ${max} يوماً (المادة 69).`,
        reasonEn: `Blocked — a penalty may not be imposed more than ${max} days after the investigation ended (Article 69).`,
        cite,
      };
    }
    return { ok: true, cite };
  }
  if (toStep === "appeal") {
    const cite = citeRule("discipline.appeal.internalDays", day);
    const days = ruleValue("discipline.appeal.internalDays", day);
    if (!disciplineAppealNote(caseRow, appealNote)) {
      return { ok: false, error: "DISCIPLINE_APPEAL_NOTE", reason: `التظلم مكتوب خلال ${days} يوماً (المادة 72).`, reasonEn: `The appeal is written within ${days} days (Article 72).`, cite };
    }
    const signed = dateOnly(caseRow.signedAt || caseRow.decidedAt);
    if (signed && pastHolidayExcludedWindow(signed, day, days, laborCalendar)) {
      return {
        ok: false,
        error: "DISCIPLINE_APPEAL_LATE",
        reason: `موقوف — التظلم الداخلي من الجزاء خلال ${days} يوماً عدا أيام العطل الرسمية (المادة 72).`,
        reasonEn: `Blocked — the internal appeal must be filed within ${days} days excluding official holidays (Article 72).`,
        cite,
      };
    }
    return { ok: true, cite };
  }
  if (toStep === "ruling") {
    const cite = citeRule("discipline.decision.days", day);
    const days = ruleValue("discipline.decision.days", day);
    const appealed = dateOnly(caseRow.appealedAt);
    // Model regulation Art. 71(1): the ruling is due within 15 days «عدا أيام العطل الرسمية».
    if (appealed && pastHolidayExcludedWindow(appealed, day, days, laborCalendar)) {
      return {
        ok: false,
        error: "DISCIPLINE_RULING_LATE",
        reason: `موقوف — البت في التظلم خلال ${days} يوماً من تقديمه عدا أيام العطل الرسمية (المادة 72 · النموذج الموحد م71). انتهت المهلة وللعامل الاعتراض أمام المحاكم العمالية.`,
        reasonEn: `Blocked — the appeal must be decided within ${days} days of filing, excluding official holidays (Article 72 · model Art. 71). The window ended; the worker may challenge before the labour courts.`,
        cite,
      };
    }
    return { ok: true, dueDays: days, cite };
  }
  return { ok: true, cite: citeRule("discipline.penalties.cite", day) };
}

function daysBetween(from, to) {
  const a = dateOnly(from);
  const b = dateOnly(to);
  if (!a || !b) return null;
  return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
}

/** Art. 68 — a repeat penalty may not be increased once 180 days have passed. */
export function checkDisciplineRepeatGate(caseRow, { cases = [], today } = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const cooloff = ruleValue("discipline.repeat.cooloffDays", day);
  const cite = citeRule("discipline.repeat.cooloffDays", day);
  const empId = String(caseRow?.employeeId || "");
  if (!empId) return { ok: true, cite };
  const prev = (cases || [])
    .filter((row) => String(row.employeeId) === empId && row.id !== caseRow?.id)
    .filter((row) => row.signedAt || row.decidedAt || ["decision", "notify", "appeal", "ruling", "closed"].includes(row.status))
    .filter(caseCountsAsPenalty)
    .sort((a, b) => String(b.signedAt || b.decidedAt || "").localeCompare(String(a.signedAt || a.decidedAt || "")))[0];
  if (!prev) return { ok: true, cite };
  const prevAt = dateOnly(prev.signedAt || prev.decidedAt || prev.notifiedAt);
  const gap = daysBetween(prevAt, day);
  if (gap != null && gap > cooloff && penaltyRank(caseRow) > penaltyRank(prev)) {
    return {
      ok: false,
      error: "DISCIPLINE_REPEAT_COOLOFF",
      reason: `موقوف — لا يُشدَّد الجزاء بعد مضي ${cooloff} يوماً على إبلاغ الجزاء السابق (المادة 68).`,
      reasonEn: `Blocked — a repeat penalty may not be increased after ${cooloff} days from notice of the previous one (Article 68).`,
      cite,
    };
  }
  return { ok: true, cite };
}

export function employeeContractWage(employee) {
  const profile = employee?.profile || {};
  return (Number(profile.baseSalary) || 0) + (Number(profile.allowances) || 0);
}

/** المادة 73 — سجل الغرامات/الجزاءات: الاسم والأجر والمقدار والسبب والتاريخ. */
export function buildDisciplineRegister({
  cases = [],
  employees = [],
  stations = [],
  ar = true,
} = {}) {
  const stepOf = (status) => DISCIPLINE_STEPS.find((row) => row.id === status) || DISCIPLINE_STEPS[0];
  const headers = ar
    ? ["الموظف", "الأجر", "مقدار الغرامة", "السبب", "التاريخ", "المرحلة", "الفرع"]
    : ["Employee", "Wage", "Fine amount", "Reason", "Date", "Stage", "Station"];
  const rows = (cases || []).map((item) => {
    const employee = (employees || []).find((row) => String(row.id) === String(item.employeeId));
    const station = (stations || []).find((row) => row.id === (employee?.stationId || employee?.station_id || item.stationId));
    const wage = employeeContractWage(employee);
    const days = Number(item.cutDays || item.fineDays || 0);
    const computed = days > 0 && wage > 0 && resolvePenaltyKind(item) === "fine" ? Math.round((days * wage) / 30) : null;
    const fine = item.fineAmount ?? item.penaltyAmount ?? item.fine ?? computed;
    const date = String(item.decidedAt || item.signedAt || item.updatedAt || item.createdAt || "").slice(0, 10) || "—";
    const reason = item.note || item.reason || item.appealNote || "—";
    const step = stepOf(item.status);
    return [
      employee?.name || item.employeeId || "—",
      wage > 0 ? wage : "—",
      fine != null && fine !== "" ? fine : "—",
      reason,
      date,
      ar ? step.ar : step.en,
      station?.name || "—",
    ];
  });
  const open = (cases || []).filter((item) => item.status !== "ruling" && item.status !== "closed").length;
  return {
    headers,
    rows,
    employeeIds: (cases || []).map((item) => item.employeeId || ""),
    caseIds: (cases || []).map((item) => item.id || ""),
    stats: [
      { value: rows.length, label: ar ? "ملفات الجزاء" : "Sanction files" },
      { value: open, label: ar ? "مفتوحة" : "Open" },
    ],
  };
}

export function deriveDisciplineTimers(caseRow, today, laborCalendar) {
  const signed = String(caseRow?.signedAt || caseRow?.decidedAt || "").slice(0, 10);
  const appealed = String(caseRow?.appealedAt || "").slice(0, 10);
  const appealDays = ruleValue("discipline.appeal.internalDays", today);
  const decideDays = ruleValue("discipline.decision.days", today);
  const day = dateOnly(today) || todayRiyadh();
  return {
    appealWindowDays: appealDays,
    decisionDueDays: decideDays,
    appealOpen: Boolean(signed) && !appealed,
    rulingLate: Boolean(appealed) && pastHolidayExcludedWindow(appealed, day, decideDays, laborCalendar),
    cite: citeRule("discipline.appeal.internalDays", today),
  };
}

export function checkSignDisciplineGate(caseRow, { files = [], today, cases = [], regulation = null } = {}) {
  const listed = checkListedPenaltyGate(caseRow, today);
  if (!listed.ok) return listed;
  if (listed.kind === "dismiss") {
    const art80 = checkArt80DismissGate(caseRow, { today, stage: "sign" });
    if (!art80.ok) return art80;
  }
  if (listed.kind === "dismissal_with_award") {
    const award = checkAwardDismissGate(caseRow, { today });
    if (!award.ok) return award;
  }
  const dup = checkDisciplineDoubleFileGate(caseRow, { cases, today });
  if (!dup.ok) return dup;
  if (regulation?.source === "own" && caseRow?.regulationClauseId) {
    const standing = regulationStanding(regulation, today);
    if (standing.id === "announced") {
      return {
        ok: false,
        error: "DISCIPLINE_REGULATION_NOT_IN_FORCE",
        reason: `موقوف — لائحة تنظيم العمل تسري على العمال من اليوم التالي لإعلانها (${standing.effectiveFrom}) — النموذج الموحد م72.`,
        reasonEn: `Blocked — the regulation binds workers from the day after its announcement (${standing.effectiveFrom}).`,
        cite: citeRule("discipline.listedOnly.cite", today),
      };
    }
  }
  const place = checkWorkplaceDisciplineGate(caseRow, { today });
  if (!place.ok) return place;
  const decision = checkAdvanceDisciplineGate(caseRow, "decision", { files, today });
  if (!decision.ok) return decision;
  const month = checkDisciplineMonthCapGate(caseRow, { cases, today });
  if (!month.ok) return month;
  return checkDisciplineRepeatGate(caseRow, { cases, today });
}

/**
 * Model regulation Art. 68 · Law Art. 72 — how the decision reached the worker. In hand; or, if he
 * refused or was absent, by registered mail to the address in his file, or to the personal e-mail in his
 * contract / on record. Each carries all legal effects.
 */
export const DISCIPLINE_DELIVERY_METHODS = [
  { id: "hand", ar: "سُلِّم للعامل يداً بيد ووقّع بالعلم", en: "Handed to the worker, who signed" },
  { id: "registered_mail", ar: "بالبريد المسجّل على عنوانه المختار الثابت في ملفه (امتنع أو غاب)", en: "Registered mail to the address on file (refused or absent)" },
  { id: "email", ar: "بالبريد الإلكتروني الشخصي الثابت في العقد أو المعتمد لدى المنشأة (امتنع أو غاب)", en: "Personal e-mail in the contract or on record (refused or absent)" },
];

export function checkDisciplineDeliveryGate({ method, at, ref = "", employee = null, signedAt = "", today } = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const cite = citeRule("discipline.appeal.internalDays", day);
  const row = DISCIPLINE_DELIVERY_METHODS.find((m) => m.id === method);
  if (!row) {
    return { ok: false, error: "DISCIPLINE_DELIVERY_METHOD", reason: "اختر طريقة إبلاغ القرار: يداً بيد، أو بريد مسجّل، أو بريد إلكتروني ثابت في الملف (المادة 72 · النموذج م68).", reasonEn: "Pick how the decision was delivered: in hand, registered mail, or e-mail on file (Art. 72 · model Art. 68).", cite };
  }
  const when = dateOnly(at);
  if (!when || when > day || (dateOnly(signedAt) && when < dateOnly(signedAt))) {
    return { ok: false, error: "DISCIPLINE_DELIVERY_DATE", reason: "تاريخ الإبلاغ يقع بين تاريخ توقيع القرار واليوم.", reasonEn: "The delivery date falls between the signing date and today.", cite };
  }
  const profile = employee?.profile || {};
  if (method === "registered_mail" && !String(ref || "").trim()) {
    return { ok: false, error: "DISCIPLINE_DELIVERY_REF", reason: "اكتب رقم الإرسال المسجّل.", reasonEn: "Enter the registered-mail tracking number.", cite };
  }
  if (method === "registered_mail" && !String(profile.address || profile.nationalAddress || employee?.address || "").trim()) {
    return { ok: false, error: "DISCIPLINE_DELIVERY_ADDRESS", reason: "لا عنوان مختار ثابت في ملف العامل — سجّله في ملفه أولاً (النموذج م68).", reasonEn: "No chosen address on the worker's file (model Art. 68).", cite };
  }
  if (method === "email" && !String(profile.personalEmail || employee?.email || "").trim()) {
    return { ok: false, error: "DISCIPLINE_DELIVERY_EMAIL", reason: "لا بريد إلكتروني شخصي ثابت في عقد العامل أو ملفه (النموذج م68).", reasonEn: "No personal e-mail on the worker's contract or file (model Art. 68).", cite };
  }
  return { ok: true, cite, method: row };
}

/** The «on repeat» line of the decision (model Art. 68). */
export function disciplineRepeatLine(item, ar = true) {
  const next = String(item?.regulationNext || "").trim();
  if (next) {
    return ar
      ? `إن تكررت المخالفة نفسها خلال 180 يوماً من إبلاغك بهذا القرار: ${next} (المادة 68).`
      : `If the same offence recurs within 180 days of this notice: ${next} (Art. 68).`;
  }
  return ar
    ? "إن تكررت المخالفة خلال 180 يوماً من إبلاغك بهذا القرار يُطبَّق الجزاء الأشد التالي في لائحة تنظيم العمل (المادة 68)."
    : "If the offence recurs within 180 days of this notice, the next, harsher step of the work regulation applies (Art. 68).";
}

export function fineLedgerBalance(ledger = []) {
  let posted = 0;
  let voided = 0;
  let disposed = 0;
  for (const row of ledger || []) {
    const amount = Number(row?.amount || 0);
    if (row?.kind === "posted") posted += amount;
    if (row?.kind === "voided") voided += amount;
    if (row?.kind === "disposed") disposed += amount;
  }
  return {
    posted,
    voided,
    disposed,
    available: Math.max(0, Math.round((posted - voided - disposed) * 100) / 100),
  };
}

export function planDisciplineFinePost(caseRow, employee, actor, today) {
  if (resolvePenaltyKind(caseRow) !== "fine") return null;
  const days = Number(caseRow?.cutDays || caseRow?.fineDays || 0);
  if (days <= 0) return null;
  const wage = employeeContractWage(employee);
  const amount = wage > 0 ? Math.round((days * wage) / 30 * 100) / 100 : Number(caseRow?.fineAmount || 0);
  if (!(amount > 0)) return null;
  return {
    id: `dfl_${String(caseRow?.id || "x")}_post`,
    kind: "posted",
    caseId: caseRow?.id || "",
    employeeId: caseRow?.employeeId || "",
    employeeName: employee?.name || "",
    wage,
    amount,
    days,
    reason: caseRow?.note || caseRow?.reason || "",
    at: dateOnly(today) || todayRiyadh(),
    actorName: actor?.name || "",
  };
}

export function planDisciplineFineVoid(caseRow, actor, today) {
  return {
    id: `dfl_${String(caseRow?.id || "x")}_void`,
    kind: "voided",
    caseId: caseRow?.id || "",
    employeeId: caseRow?.employeeId || "",
    amount: Number(caseRow?.fineAmount || 0),
    reason: caseRow?.note || caseRow?.reason || "",
    at: dateOnly(today) || todayRiyadh(),
    actorName: actor?.name || "",
  };
}

export function checkDisposeDisciplineFinesGate({ authority, note, ledger = [], today } = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const cite = citeRule("discipline.fines.register.cite", day);
  const balance = fineLedgerBalance(ledger);
  if (balance.available <= 0) {
    return {
      ok: false,
      error: "DISCIPLINE_FINE_DISPOSE_EMPTY",
      reason: "لا غرامات قائمة للصرف.",
      reasonEn: "There is no fine balance to dispose of.",
      cite,
    };
  }
  const who = String(authority || "");
  if (who !== "committee" && who !== "ministry") {
    return {
      ok: false,
      error: "DISCIPLINE_FINE_DISPOSE_AUTHORITY",
      reason: "لا تُصرف الغرامات إلا بقرار اللجنة العمالية في المنشأة، أو بموافقة الوزارة إن لم توجد لجنة (المادة 73).",
      reasonEn: "Fines may be disposed of only by the establishment labour committee, or with the Ministry's approval if there is no committee (Article 73).",
      cite,
    };
  }
  if (String(note || "").trim().length < 12) {
    return {
      ok: false,
      error: "DISCIPLINE_FINE_DISPOSE_NOTE",
      reason: "صرف الغرامة يحتاج سنداً مكتوباً: قرار اللجنة أو رقم موافقة الوزارة. لا يُسجَّل صرف بلا مرجع.",
      reasonEn: "Disposing of a fine needs a written instrument: the committee decision or the Ministry approval number. A disposal is not recorded without a reference.",
      cite,
    };
  }
  return { ok: true, cite, amount: balance.available };
}

export function planDisciplineFineDispose({ authority, note, ledger = [], actor, today } = {}) {
  const gate = checkDisposeDisciplineFinesGate({ authority, note, ledger, today });
  if (!gate.ok) return { ok: false, ...gate };
  return {
    ok: true,
    entry: {
      id: `dfl_disp_${Date.now().toString(36)}`,
      kind: "disposed",
      authority,
      amount: gate.amount,
      note: String(note || "").trim(),
      at: dateOnly(today) || todayRiyadh(),
      actorName: actor?.name || "",
    },
    cite: gate.cite,
  };
}
