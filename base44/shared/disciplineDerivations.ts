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
  if (String(penaltyKind || "warning") === "dismiss" && !String(dismissGround || "").trim()) {
    return {
      ok: false as const,
      error: "DISCIPLINE_DISMISS_GROUND",
      reason: "الفصل لا يُفتح إلا بذكر الحالة المقررة في النظام — المادة 66 مع المادة 80 عند الفصل بغير مكافأة.",
      reasonEn: "Dismissal does not open without the prescribed statutory case — Article 66, with Article 80 when dismissal is without award.",
      cite: citeRule("eos.art80.cite", day),
    };
  }
  const place = checkWorkplaceDisciplineGate({ offSite, workConnected }, { today: day });
  if (!place.ok) return place;
  void cutDays;
  void cases;
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
    if (appealed && pastChargeWindow(appealed, day, days)) {
      return {
        ok: false as const,
        error: "DISCIPLINE_RULING_LATE",
        reason: `موقوف — البت في التظلم خلال ${days} يوماً من تقديمه (المادة 72). انتهت المهلة وللعامل الاعتراض أمام المحاكم العمالية.`,
        reasonEn: `Blocked — the appeal must be decided within ${days} days of filing (Article 72). The window ended; the worker may challenge before the labour courts.`,
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
