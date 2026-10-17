/** Arts 66–73 disciplinary path. Proof Cycle evidence attaches at each step.
 *  Keep in sync with src/lib/disciplineDerivations.js
 */

import { addLaborDays, citeRule, lastRamadanDay, RAMADAN_WINDOWS, ruleValue } from "./laborRules.ts";

export const DISCIPLINE_STEPS = [
  { id: "incident", ar: "واقعة", en: "Incident" },
  { id: "notice", ar: "إشعار", en: "Notice" },
  { id: "hearing", ar: "تحقيق ومحضر", en: "Hearing & minutes" },
  { id: "decision", ar: "قرار", en: "Decision" },
  { id: "notify", ar: "تبليغ", en: "Notify" },
  { id: "appeal", ar: "تظلم داخلي", en: "Internal appeal" },
  { id: "ruling", ar: "بتّ", en: "Ruling" },
] as const;

export type DisciplineStepId = (typeof DISCIPLINE_STEPS)[number]["id"];

function dateOnly(iso?: string) {
  const s = String(iso || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function addCalendarDays(iso: string | undefined, n: number) {
  const s = dateOnly(iso);
  if (!s) return "";
  const d = new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  d.setDate(d.getDate() + Number(n));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayRiyadh() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}

function pastChargeWindow(fromIso: unknown, today: string, maxDays: number) {
  const from = dateOnly(typeof fromIso === "string" ? fromIso : "");
  if (!from || !maxDays) return false;
  const latest = addCalendarDays(from, maxDays);
  return Boolean(latest) && today > latest;
}

const ARAFAH_DAYS = ["2025-06-05", "2026-05-26", "2027-05-16", "2028-05-04"];

function isOfficialHolidayDay(value: string, calendar?: unknown) {
  const day = dateOnly(value);
  if (!day) return false;
  const md = day.slice(5);
  if (md === "09-23" || md === "02-22") return true;
  const year = Number(day.slice(0, 4));
  const win = RAMADAN_WINDOWS.find((row) => Number(String(row.from).slice(0, 4)) === year);
  if (win) {
    const last = lastRamadanDay(win, calendar as never);
    const from = addLaborDays(last, 1);
    const days = Number(ruleValue("leave.eid.fitrDays", from) || 4);
    const to = addLaborDays(from, days - 1);
    if (from && from <= day && day <= to) return true;
  }
  const arafah = ARAFAH_DAYS.find((row) => row.startsWith(String(year)));
  if (arafah) {
    const days = Number(ruleValue("leave.eid.adhaDays", arafah) || 4);
    const to = addLaborDays(arafah, days - 1);
    if (arafah <= day && day <= to) return true;
  }
  return false;
}

function countDaysExcludingOfficialHolidays(from: string, to: string, calendar?: unknown) {
  if (!from || !to || to <= from) return 0;
  let count = 0;
  let cursor = addLaborDays(from, 1);
  while (cursor && cursor <= to) {
    if (!isOfficialHolidayDay(cursor, calendar)) count += 1;
    cursor = addLaborDays(cursor, 1);
  }
  return count;
}

function pastHolidayExcludedWindow(fromIso: unknown, today: string, maxDays: number, calendar?: unknown) {
  const from = dateOnly(typeof fromIso === "string" ? fromIso : "");
  if (!from || !maxDays) return false;
  return countDaysExcludingOfficialHolidays(from, today, calendar) > maxDays;
}

export function nextDisciplineStep(status: unknown) {
  const i = DISCIPLINE_STEPS.findIndex((s) => s.id === String(status || "incident"));
  return DISCIPLINE_STEPS[Math.min(DISCIPLINE_STEPS.length - 1, i + 1)] || DISCIPLINE_STEPS[0];
}

type DisciplineMessage = { from?: string; text?: string; files?: unknown[]; kind?: string };

type DisciplineCase = {
  id?: string;
  status?: string;
  rulingOutcome?: string;
  rulingLabel?: string;
  regulationClauseId?: string;
  objectionHeardAt?: string;
  art80?: any;
  penalty?: string;
  penaltyLabel?: string;
  employeeId?: string;
  evidence?: unknown[];
  appealNote?: string;
  messages?: DisciplineMessage[];
  createdAt?: string;
  discoveredAt?: string;
  hearingEndedAt?: string;
  hearingAt?: string;
  investigationEndedAt?: string;
  signedAt?: string;
  decidedAt?: string;
  appealedAt?: string;
  penaltyKind?: string;
  penaltyId?: string;
  cutDays?: number;
  fineDays?: number;
  dismissGround?: string;
  note?: string;
  reason?: string;
  offSite?: boolean | string;
  place?: string;
  workConnected?: string;
  workLink?: string;
  hearingMinutes?: string;
};

export function resolveDisciplineWorkStationId(employee: { stationId?: string | null; station_id?: string | null } | null | undefined) {
  const id = String(employee?.stationId || employee?.station_id || "").trim();
  return id || null;
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
}: {
  employee?: { id?: string; stationId?: string | null; station_id?: string | null } | null;
  actor?: { id?: string } | null;
  note?: string;
  today?: string;
  discoveredAt?: string;
  penaltyKind?: string;
  cutDays?: number;
  dismissGround?: string;
  offSite?: boolean;
  workConnected?: string;
  cases?: DisciplineCase[];
} = {}) {
  const day = dateOnly(today) || todayRiyadh();
  if (!employee?.id) {
    return {
      ok: false as const,
      error: "DISCIPLINE_EMPLOYEE_REQUIRED",
      reason: "الواقعة مربوطة بموظف.",
      reasonEn: "The incident is tied to an employee.",
      cite: citeRule("discipline.penalties.cite", day),
    };
  }
  if (actor?.id && String(employee.id) === String(actor.id)) {
    return {
      ok: false as const,
      error: "DISCIPLINE_SELF_SANCTION",
      reason: "لا يُرفع جزاء على الملف نفسه من صاحبه.",
      reasonEn: "A sanction is not raised on the actor's own file.",
      cite: citeRule("discipline.penalties.cite", day),
    };
  }
  if (!resolveDisciplineWorkStationId(employee)) {
    return {
      ok: false as const,
      error: "STATION_REQUIRED",
      reason: "لا يُفتح ملف جزاء بلا محطة عمل للموظف — اربط ملفه بفرع أولاً.",
      reasonEn: "A sanction file does not open without the employee's work station — place their file on a branch first.",
      cite: citeRule("discipline.penalties.cite", day),
    };
  }
  if (!String(note || "").trim()) {
    return {
      ok: false as const,
      error: "DISCIPLINE_NOTE_REQUIRED",
      reason: "بلا وصف لا يصحّ الإبلاغ (المادة 71).",
      reasonEn: "Notice needs a written description (Article 71).",
      cite: citeRule("discipline.hearing.cite", day),
    };
  }
  const discovered = dateOnly(discoveredAt) || day;
  if (discovered > day) {
    return {
      ok: false as const,
      error: "DISCIPLINE_DISCOVERY_FUTURE",
      reason: "تاريخ الكشف لا يكون بعد اليوم.",
      reasonEn: "The discovery date cannot be after today.",
      cite: citeRule("discipline.charge.maxDays", day),
    };
  }
  const draft: any = { employeeId: employee.id, note, penaltyKind, cutDays: Number(cutDays) || 0, dismissGround, offSite, workConnected };
  const listed = checkListedPenaltyGate(draft, day);
  if (!listed.ok) return listed;
  const place = checkWorkplaceDisciplineGate({ offSite, workConnected }, { today: day });
  if (!place.ok) return place;
  if (listed.kind === "dismiss") {
    const art80 = checkArt80DismissGate({ dismissGround }, { today: day, stage: "raise" });
    if (!art80.ok) return art80;
  }
  const double = checkDisciplineDoubleFileGate(draft, { cases, today: day });
  if (!double.ok) return double;
  return checkAdvanceDisciplineGate({ employeeId: employee.id, discoveredAt: discovered, createdAt: day }, "notice", { today: day });
}

export function isSimpleOralOffence(item: DisciplineCase | null | undefined) {
  const stored = String(item?.penaltyKind || item?.penaltyId || "").trim();
  const days = Number(item?.cutDays || item?.fineDays || 0);
  if (stored === "warning" || stored === "caution") return true;
  if (stored.startsWith("fine") && days <= 1) return true;
  return false;
}

export function disciplineHearingMinutes(caseRow: DisciplineCase | null | undefined, extra = "") {
  if (String(extra || "").trim()) return String(extra).trim();
  if (String(caseRow?.hearingMinutes || "").trim()) return String(caseRow?.hearingMinutes || "").trim();
  const last = [...(caseRow?.messages || [])].reverse().find((m) => String(m.text || "").trim() && (m.from === "employee" || m.kind === "hearing"));
  return String(last?.text || "").trim();
}

export function checkWorkplaceDisciplineGate(caseRow: DisciplineCase | null | undefined, { today }: { today?: string } = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const cite = citeRule("discipline.workplace.cite", day);
  const offSite = caseRow?.offSite === true || caseRow?.offSite === "true" || caseRow?.place === "offsite";
  if (!offSite) return { ok: true as const, cite };
  if (String(caseRow?.workConnected || caseRow?.workLink || "").trim()) return { ok: true as const, cite };
  return {
    ok: false as const,
    error: "DISCIPLINE_OFFSITE_UNRELATED",
    reason: "موقوف — لا جزاء على أمر خارج مكان العمل ما لم يكن متصلاً بالعمل أو بصاحبه أو بمديره المسؤول (المادة 70).",
    reasonEn: "Blocked — no penalty for an act outside the workplace unless it is connected with the work, the employer, or the responsible manager (Article 70).",
    cite,
  };
}

export function disciplineEvidenceList(
  caseRow: { evidence?: unknown[]; messages?: DisciplineMessage[] } | null | undefined,
  extra: unknown[] = [],
) {
  const fromMessages = (caseRow?.messages || []).flatMap((m) => m.files || []);
  return [...(caseRow?.evidence || []), ...fromMessages, ...(extra || [])].filter(Boolean);
}

export function disciplineAppealNote(
  caseRow: { appealNote?: string; messages?: DisciplineMessage[] } | null | undefined,
  extra = "",
) {
  if (String(extra || "").trim()) return String(extra).trim();
  if (String(caseRow?.appealNote || "").trim()) return String(caseRow.appealNote).trim();
  const lastEmp = [...(caseRow?.messages || [])].reverse().find((m) => m.from === "employee" && String(m.text || "").trim());
  return String(lastEmp?.text || "").trim();
}

export function checkAdvanceDisciplineGate(
  caseRow: DisciplineCase | null | undefined,
  toStep: string,
  { files = [], appealNote = "", hearingMinutes = "", today, laborCalendar }: { files?: unknown[]; appealNote?: string; hearingMinutes?: string; today?: string; laborCalendar?: unknown } = {},
) {
  const day = dateOnly(today) || todayRiyadh();
  if (!caseRow?.employeeId) {
    return {
      ok: false as const,
      error: "DISCIPLINE_EMPLOYEE_REQUIRED",
      reason: "الواقعة مربوطة بموظف.",
      reasonEn: "The incident is tied to an employee.",
      cite: citeRule("discipline.penalties.cite", day),
    };
  }
  if (toStep === "notice") {
    const cite = citeRule("discipline.charge.maxDays", day);
    const max = ruleValue("discipline.charge.maxDays", day);
    const discovered = caseRow.discoveredAt || caseRow.createdAt;
    if (pastChargeWindow(discovered, day, max)) {
      return {
        ok: false as const,
        error: "DISCIPLINE_CHARGE_STALE",
        reason: `موقوف — لا يُتهم العامل بمخالفة مضى على كشفها أكثر من ${max} يوماً (المادة 69).`,
        reasonEn: `Blocked — a worker may not be accused more than ${max} days after the offence was discovered (Article 69).`,
        cite,
      };
    }
    return { ok: true as const, cite };
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
          ok: false as const,
          error: "DISCIPLINE_HEARING_MINUTES",
          reason: "المخالفة البسيطة تُستجوَب شفاهة على أن يُثبت ذلك في المحضر (المادة 71).",
          reasonEn: "A minor offence may be questioned orally, provided that is recorded in the minutes (Article 71).",
          cite,
        };
      }
      return { ok: true as const, cite, oral: true };
    }
    if (!hasDefenceFile && !minutes) {
      return {
        ok: false as const,
        error: "DISCIPLINE_EVIDENCE_REQUIRED",
        reason: "لا جزاء قبل محضر مكتوب في الملف: إبلاغ بما نُسب واستجواب وتحقيق الدفاع (المادة 71).",
        reasonEn: "No penalty before written minutes on file: notice of the accusation, questioning, and hearing the defence (Article 71).",
        cite,
      };
    }
    return { ok: true as const, cite };
  }
  if (toStep === "decision") {
    const cite = citeRule("discipline.charge.maxDays", day);
    const max = ruleValue("discipline.charge.maxDays", day);
    const ended = caseRow.investigationEndedAt || caseRow.hearingEndedAt || caseRow.hearingAt;
    if (pastChargeWindow(ended, day, max)) {
      return {
        ok: false as const,
        error: "DISCIPLINE_PENALTY_STALE",
        reason: `موقوف — لا يُوقَّع الجزاء بعد انتهاء التحقيق بأكثر من ${max} يوماً (المادة 69).`,
        reasonEn: `Blocked — a penalty may not be imposed more than ${max} days after the investigation ended (Article 69).`,
        cite,
      };
    }
    return { ok: true as const, cite };
  }
  if (toStep === "appeal") {
    const cite = citeRule("discipline.appeal.internalDays", day);
    const days = ruleValue("discipline.appeal.internalDays", day);
    if (!disciplineAppealNote(caseRow, appealNote)) {
      return {
        ok: false as const,
        error: "DISCIPLINE_APPEAL_NOTE",
        reason: `التظلم مكتوب خلال ${days} يوماً (المادة 72).`,
        reasonEn: `The appeal is written within ${days} days (Article 72).`,
        cite,
      };
    }
    const signed = dateOnly(caseRow.signedAt || caseRow.decidedAt);
    if (signed && pastHolidayExcludedWindow(signed, day, days, laborCalendar)) {
      return {
        ok: false as const,
        error: "DISCIPLINE_APPEAL_LATE",
        reason: `موقوف — التظلم الداخلي من الجزاء خلال ${days} يوماً عدا أيام العطل الرسمية (المادة 72).`,
        reasonEn: `Blocked — the internal appeal must be filed within ${days} days excluding official holidays (Article 72).`,
        cite,
      };
    }
    return { ok: true as const, cite };
  }
  if (toStep === "ruling") {
    const cite = citeRule("discipline.decision.days", day);
    const days = ruleValue("discipline.decision.days", day);
    const appealed = dateOnly(caseRow.appealedAt);
    // Model regulation Art. 71(1): the ruling is due within 15 days «عدا أيام العطل الرسمية».
    if (appealed && pastHolidayExcludedWindow(appealed, day, days, laborCalendar)) {
      return {
        ok: false as const,
        error: "DISCIPLINE_RULING_LATE",
        reason: `موقوف — البت في التظلم خلال ${days} يوماً من تقديمه عدا أيام العطل الرسمية (المادة 72 · النموذج الموحد م71). انتهت المهلة وللعامل الاعتراض أمام المحاكم العمالية.`,
        reasonEn: `Blocked — the appeal must be decided within ${days} days of filing, excluding official holidays (Article 72 · model Art. 71). The window ended; the worker may challenge before the labour courts.`,
        cite,
      };
    }
    return { ok: true as const, dueDays: days, cite };
  }
  return { ok: true as const, cite: citeRule("discipline.penalties.cite", day) };
}

export function deriveDisciplineTimers(caseRow: { notifiedAt?: string; appealedAt?: string } | null | undefined, today?: string) {
  const notified = String(caseRow?.notifiedAt || "").slice(0, 10);
  const appealed = String(caseRow?.appealedAt || "").slice(0, 10);
  const appealDays = ruleValue("discipline.appeal.internalDays", today);
  const decideDays = ruleValue("discipline.decision.days", today);
  return {
    appealWindowDays: appealDays,
    decisionDueDays: decideDays,
    appealOpen: Boolean(notified) && !appealed,
    cite: citeRule("discipline.appeal.internalDays", today),
  };
}

/* ------------------------- Ported gates (keep in sync with src/lib/disciplineDerivations.js) ------------------------- */

export const DISCIPLINE_PENALTY_KINDS = [
  { id: "warning", limb: "1", days: [0] },
  { id: "fine", limb: "2", days: [1, 2, 3, 4, 5] },
  { id: "increment", limb: "3", days: [0], deferMonths: 12 },
  { id: "promotion", limb: "4", days: [0], deferMonths: 12 },
  { id: "suspend", limb: "5", days: [1, 2, 3, 4, 5] },
  { id: "dismissal_with_award", limb: "6", days: [0] },
  { id: "dismiss", limb: "6", days: [0] },
];

export const ART80 = { intermittentLimit: 30, intermittentNotice: 20, consecutiveLimit: 15, consecutiveNotice: 10 };

export const ART80_GROUNDS: Array<{ id: string; para: number; warning?: boolean; report24h?: boolean; absence?: boolean }> = [
  { id: "assault", para: 1 },
  { id: "duties", para: 2, warning: true },
  { id: "conduct", para: 3 },
  { id: "loss", para: 4, report24h: true },
  { id: "forgery", para: 5 },
  { id: "probation", para: 6 },
  { id: "absence", para: 7, absence: true },
  { id: "position", para: 8 },
  { id: "secrets", para: 9 },
];

function daysBetween(from: unknown, to: unknown) {
  const a = dateOnly(String(from || ""));
  const b = dateOnly(String(to || ""));
  if (!a || !b) return null;
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);
}

export function listedPenaltyKind(kindId: unknown) {
  return DISCIPLINE_PENALTY_KINDS.find((row) => row.id === String(kindId || "")) || null;
}

export function resolvePenaltyKind(item: any) {
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

export function incidentKey(note: unknown) {
  return String(note || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function caseCountsAsPenalty(item: any) {
  const outcome = String(item?.rulingOutcome || item?.rulingLabel || "");
  if (/void|أُلغي|الغي/i.test(outcome)) return false;
  if (item?.signedAt || item?.decidedAt) return true;
  return String(item?.status || "") !== "closed";
}

export function penaltyRank(item: any) {
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

export function checkListedPenaltyGate(item: any, today?: string): any {
  const day = dateOnly(today) || todayRiyadh();
  const cite = citeRule("discipline.listedOnly.cite", day);
  const kind = resolvePenaltyKind(item);
  const spec = listedPenaltyKind(kind);
  if (!spec) {
    return { ok: false, error: "DISCIPLINE_PENALTY_NOT_LISTED", reason: "موقوف — لا يُوقَّع جزاء غير وارد في النظام أو في لائحة تنظيم العمل (المادة 67).", reasonEn: "Blocked — no penalty may be imposed that is not in the Law or the work-organization regulations (Article 67).", cite };
  }
  const days = Number(item?.cutDays || item?.fineDays || 0);
  if ((kind === "fine" || kind === "suspend") && days > (ruleValue("discipline.fine.maxDays", day) || 5)) {
    return { ok: false, error: "DISCIPLINE_FINE_OVER_CAP", reason: "موقوف — غرامة المخالفة الواحدة أو الإيقاف بلا أجر لا يزيد على أجر خمسة أيام (المادة 70).", reasonEn: "Blocked — a single-offence fine or unpaid suspension may not exceed five days (Article 70).", cite: citeRule("discipline.fine.maxDays", day) };
  }
  const regulationShare = kind === "fine" && days > 0 && days < 1;
  if (!regulationShare && spec.days.length && !spec.days.includes(days) && !(days === 0 && spec.days.includes(0))) {
    return { ok: false, error: "DISCIPLINE_PENALTY_NOT_LISTED", reason: "موقوف — مقدار هذا الجزاء يخرج عن قائمة المادة 66.", reasonEn: "Blocked — this penalty amount is outside the Article 66 list.", cite: citeRule("discipline.penalties.cite", day) };
  }
  return { ok: true, cite: citeRule("discipline.penalties.cite", day), kind, spec };
}

export function checkDisciplineDoubleFileGate(caseRow: any, { cases = [], today }: { cases?: any[]; today?: string } = {}): any {
  const day = dateOnly(today) || todayRiyadh();
  const cite = citeRule("discipline.fine.maxDays", day);
  const empId = String(caseRow?.employeeId || "");
  const key = incidentKey(caseRow?.note || caseRow?.reason);
  if (!empId || !key) return { ok: true, cite };
  const other = (cases || []).find((row: any) => (
    String(row.id) !== String(caseRow?.id || "")
    && String(row.employeeId) === empId
    && incidentKey(row.note || row.reason) === key
    && caseCountsAsPenalty(row)
  ));
  if (!other) return { ok: true, cite };
  return { ok: false, error: "DISCIPLINE_DOUBLE_PENALTY", reason: "موقوف — لا يُوقَّع أكثر من جزاء واحد على المخالفة الواحدة (المادة 70).", reasonEn: "Blocked — more than one penalty may not be imposed for a single offence (Article 70).", cite };
}

export function monthCapDaysByKind(cases: any[], employeeId: unknown, today: string, kind: string) {
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

export function checkDisciplineMonthCapGate(caseRow: any, { cases = [], today }: { cases?: any[]; today?: string } = {}): any {
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
      reason: kind === "suspend" ? `موقوف — الإيقاف بلا أجر لا يزيد على ${cap} أيام في الشهر (المادة 70).` : `موقوف — لا يُحسم وفاءً للغرامات أكثر من أجر ${cap} أيام في الشهر (المادة 70).`,
      reasonEn: kind === "suspend" ? `Blocked — unpaid suspension may not exceed ${cap} days in a month (Article 70).` : `Blocked — monthly fine deductions may not exceed ${cap} days' wage (Article 70).`,
      cite,
    };
  }
  return { ok: true, cite, cap, used };
}

export function checkDisciplineRepeatGate(caseRow: any, { cases = [], today }: { cases?: any[]; today?: string } = {}): any {
  const day = dateOnly(today) || todayRiyadh();
  const cooloff = ruleValue("discipline.repeat.cooloffDays", day);
  const cite = citeRule("discipline.repeat.cooloffDays", day);
  const empId = String(caseRow?.employeeId || "");
  if (!empId) return { ok: true, cite };
  const prev = (cases || [])
    .filter((row: any) => String(row.employeeId) === empId && row.id !== caseRow?.id)
    .filter((row: any) => row.signedAt || row.decidedAt || ["decision", "notify", "appeal", "ruling", "closed"].includes(row.status))
    .filter(caseCountsAsPenalty)
    .sort((a: any, b: any) => String(b.signedAt || b.decidedAt || "").localeCompare(String(a.signedAt || a.decidedAt || "")))[0];
  if (!prev) return { ok: true, cite };
  const prevAt = dateOnly(prev.signedAt || prev.decidedAt || prev.notifiedAt);
  const gap = daysBetween(prevAt, day);
  if (gap != null && gap > cooloff && penaltyRank(caseRow) > penaltyRank(prev)) {
    return { ok: false, error: "DISCIPLINE_REPEAT_COOLOFF", reason: `موقوف — لا يُشدَّد الجزاء بعد مضي ${cooloff} يوماً على إبلاغ الجزاء السابق (المادة 68).`, reasonEn: `Blocked — a repeat penalty may not be increased after ${cooloff} days from notice of the previous one (Article 68).`, cite };
  }
  return { ok: true, cite };
}

function art80Fail(error: string, reason: string, reasonEn: string, day: string) {
  return { ok: false as const, error, reason, reasonEn, cite: citeRule("eos.art80.cite", day) };
}

export function checkArt80DismissGate(caseRow: any, { today, stage = "sign" }: { today?: string; stage?: string } = {}): any {
  const day = dateOnly(today) || todayRiyadh();
  const ground = ART80_GROUNDS.find((g) => g.id === String(caseRow?.dismissGround || ""));
  if (!ground) return art80Fail("DISCIPLINE_DISMISS_GROUND", "موقوف — الفصل بدون مكافأة لا يكون إلا في إحدى حالات المادة 80؛ اختر الحالة من القائمة.", "Blocked — dismissal without award is only in one of the Article 80 cases; pick the case from the list.", day);
  if (stage !== "sign") return { ok: true, ground };
  const a = caseRow?.art80 || {};
  const heard = Boolean(String(caseRow?.hearingMinutes || "").trim() || dateOnly(caseRow?.hearingEndedAt) || dateOnly(caseRow?.objectionHeardAt));
  if (!heard) return art80Fail("ART80_OBJECTION_REQUIRED", "موقوف — لا فسخ بموجب المادة 80 قبل إتاحة الفرصة للعامل لإبداء أسباب معارضته للفسخ؛ أثبت سماعه في المحضر.", "Blocked — no Article 80 dismissal before the worker is given the chance to state his objection; record the hearing.", day);
  if (ground.warning && !dateOnly(a.warnedAt)) return art80Fail("ART80_WARNING_REQUIRED", "موقوف — الفقرة 2 من المادة 80 تشترط إنذار العامل كتابة قبل الفسخ؛ سجّل تاريخ الإنذار الكتابي.", "Blocked — Article 80(2) requires a prior written warning; record its date.", day);
  if (ground.report24h) {
    const knew = dateOnly(a.discoveredAt || caseRow?.discoveredAt);
    const reported = dateOnly(a.reportedAt);
    const gap = knew && reported ? daysBetween(knew, reported) : null;
    if (!reported || (gap != null && gap > 1)) return art80Fail("ART80_LOSS_REPORT", "موقوف — الفقرة 4 من المادة 80 تشترط إبلاغ الجهات المختصة بالحادث خلال أربع وعشرين ساعة من العلم به.", "Blocked — Article 80(4) requires reporting the incident to the authorities within 24 hours of knowing.", day);
  }
  if (ground.absence) {
    const mode = a.mode === "intermittent" ? "intermittent" : "consecutive";
    const notice = mode === "intermittent" ? ART80.intermittentNotice : ART80.consecutiveNotice;
    const limit = mode === "intermittent" ? ART80.intermittentLimit : ART80.consecutiveLimit;
    const warnedAt = dateOnly(a.warnedAt);
    if (!warnedAt) return art80Fail("ART80_ABSENCE_WARNING_REQUIRED", `موقوف — يسبق الفصل إنذار كتابي بعد غياب ${notice} أيام (المادة 80/7)؛ سجّل تاريخ الإنذار.`, `Blocked — dismissal must be preceded by a written warning after ${notice} days of absence (Art. 80(7)).`, day);
    if (warnedAt > day) return art80Fail("ART80_ABSENCE_WARNING_FUTURE", "تاريخ الإنذار لا يكون بعد اليوم.", "The warning date cannot be after today.", day);
    if (!(Number(a.warnedAtDays) >= notice)) return art80Fail("ART80_ABSENCE_WARNING_EARLY", `موقوف — الإنذار يُوجَّه بعد بلوغ الغياب ${notice} يوماً (المادة 80/7).`, `Blocked — the warning is given once absence reaches ${notice} days (Art. 80(7)).`, day);
    if (!(Number(a.days) > limit)) return art80Fail("ART80_ABSENCE_UNDER_LIMIT", `موقوف — الفصل للغياب يكون إذا زاد على ${limit} يوماً (المادة 80/7).`, `Blocked — absence dismissal needs more than ${limit} days (Art. 80(7)).`, day);
  }
  return { ok: true, ground };
}

export function checkAwardDismissGate(caseRow: any, { today }: { today?: string } = {}): any {
  const day = dateOnly(today) || todayRiyadh();
  if (String(caseRow?.dismissGround || "").trim() || String(caseRow?.regulationClauseId || "").trim()) return { ok: true };
  return { ok: false, error: "DISCIPLINE_AWARD_DISMISS_REASON", reason: "الفصل مع المكافأة يكون لسبب مشروع لارتكاب المخالفة — اذكر بند اللائحة أو السبب المشروع (النموذج الموحد م58/6).", reasonEn: "Dismissal with award rests on a legitimate reason for the offence — name the regulation clause or the reason (model regulation Art. 58(6)).", cite: citeRule("discipline.penalties.cite", day) };
}

/** Regulation standing (model Art. 72) — mirrors src/lib/workRegulation.js regulationStanding. */
export function regulationStanding(regulation: any, today?: string) {
  if (regulation?.source !== "own") return { id: "model", inForce: false, effectiveFrom: "" };
  const day = dateOnly(today) || todayRiyadh();
  const announced = dateOnly(regulation.announcedAt);
  if (!announced) return { id: "draft", inForce: false, effectiveFrom: "" };
  const from = addCalendarDays(announced, 1);
  return from <= day ? { id: "inForce", inForce: true, effectiveFrom: from } : { id: "announced", inForce: false, effectiveFrom: from };
}

export function checkSignDisciplineGate(caseRow: any, { files = [], today, cases = [], regulation = null }: { files?: unknown[]; today?: string; cases?: any[]; regulation?: any } = {}): any {
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
      return { ok: false, error: "DISCIPLINE_REGULATION_NOT_IN_FORCE", reason: `موقوف — لائحة تنظيم العمل تسري على العمال من اليوم التالي لإعلانها (${standing.effectiveFrom}) — النموذج الموحد م72.`, reasonEn: `Blocked — the regulation binds workers from the day after its announcement (${standing.effectiveFrom}).`, cite: citeRule("discipline.listedOnly.cite", today) };
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
