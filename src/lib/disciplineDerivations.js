/** Arts 66–73 disciplinary path. Proof Cycle evidence attaches at each step. */

import { citeRule, ruleValue } from "./laborRules.js";
import { countDaysExcludingOfficialHolidays } from "./ummAlQuraCalendar.js";

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
  { id: "suspend", limb: "5", ar: "إيقاف عن العمل مع الحرمان من الأجر", en: "Unpaid suspension from work", days: [1, 2, 3, 4, 5] },
  { id: "dismiss", limb: "6", ar: "فصل من العمل في الحالات المقررة في النظام", en: "Dismissal in the cases prescribed in the Law", days: [0] },
];

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
  if (id === "dismiss") return "dismiss";
  if (id === "warning" || id === "caution") return "warning";
  const text = `${item?.penalty || ""} ${item?.penaltyLabel || ""}`;
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
  if (spec.days.length && !spec.days.includes(days) && !(days === 0 && spec.days.includes(0))) {
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
  if (listed.kind === "dismiss" && !String(dismissGround || "").trim()) {
    return {
      ok: false,
      error: "DISCIPLINE_DISMISS_GROUND",
      reason: "الفصل لا يُفتح إلا بذكر الحالة المقررة في النظام — المادة 66 مع المادة 80 عند الفصل بغير مكافأة.",
      reasonEn: "Dismissal does not open without the prescribed statutory case — Article 66, with Article 80 when dismissal is without award.",
      cite: citeRule("eos.art80.cite", day),
    };
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
    if (appealed && pastChargeWindow(appealed, day, days)) {
      return {
        ok: false,
        error: "DISCIPLINE_RULING_LATE",
        reason: `موقوف — البت في التظلم خلال ${days} يوماً من تقديمه (المادة 72). انتهت المهلة وللعامل الاعتراض أمام المحاكم العمالية.`,
        reasonEn: `Blocked — the appeal must be decided within ${days} days of filing (Article 72). The window ended; the worker may challenge before the labour courts.`,
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

export function deriveDisciplineTimers(caseRow, today) {
  const signed = String(caseRow?.signedAt || caseRow?.decidedAt || "").slice(0, 10);
  const appealed = String(caseRow?.appealedAt || "").slice(0, 10);
  const appealDays = ruleValue("discipline.appeal.internalDays", today);
  const decideDays = ruleValue("discipline.decision.days", today);
  const day = dateOnly(today) || todayRiyadh();
  return {
    appealWindowDays: appealDays,
    decisionDueDays: decideDays,
    appealOpen: Boolean(signed) && !appealed,
    rulingLate: Boolean(appealed) && pastChargeWindow(appealed, day, decideDays),
    cite: citeRule("discipline.appeal.internalDays", today),
  };
}

export function checkSignDisciplineGate(caseRow, { files = [], today, cases = [] } = {}) {
  const listed = checkListedPenaltyGate(caseRow, today);
  if (!listed.ok) return listed;
  if (listed.kind === "dismiss" && !String(caseRow?.dismissGround || "").trim()) {
    return {
      ok: false,
      error: "DISCIPLINE_DISMISS_GROUND",
      reason: "الفصل لا يُوقَّع إلا بذكر الحالة المقررة في النظام (المادة 66).",
      reasonEn: "Dismissal is not signed without the prescribed statutory case (Article 66).",
      cite: citeRule("eos.art80.cite", today),
    };
  }
  const place = checkWorkplaceDisciplineGate(caseRow, { today });
  if (!place.ok) return place;
  const decision = checkAdvanceDisciplineGate(caseRow, "decision", { files, today });
  if (!decision.ok) return decision;
  const month = checkDisciplineMonthCapGate(caseRow, { cases, today });
  if (!month.ok) return month;
  return checkDisciplineRepeatGate(caseRow, { cases, today });
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
