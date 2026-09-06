/** Arts 66–73 disciplinary path. Proof Cycle evidence attaches at each step.
 *  Keep in sync with src/lib/disciplineDerivations.js
 */

import { citeRule, ruleValue } from "./laborRules.ts";

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

export function nextDisciplineStep(status: unknown) {
  const i = DISCIPLINE_STEPS.findIndex((s) => s.id === String(status || "incident"));
  return DISCIPLINE_STEPS[Math.min(DISCIPLINE_STEPS.length - 1, i + 1)] || DISCIPLINE_STEPS[0];
}

type DisciplineMessage = { from?: string; text?: string; files?: unknown[] };

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
};

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
  { files = [], appealNote = "", today }: { files?: unknown[]; appealNote?: string; today?: string } = {},
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
    if (!disciplineEvidenceList(caseRow, files).length) {
      return {
        ok: false as const,
        error: "DISCIPLINE_EVIDENCE_REQUIRED",
        reason: "لا جزاء قبل محضر مكتوب في الملف: إبلاغ بما نُسب واستجواب وتحقيق الدفاع (المادة 71).",
        reasonEn: "No penalty before written minutes on file: notice of the accusation, questioning, and hearing the defence (Article 71).",
        cite: citeRule("discipline.hearing.cite", day),
      };
    }
    return { ok: true as const, cite: citeRule("discipline.hearing.cite", day) };
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
    return { ok: true as const, cite };
  }
  if (toStep === "ruling") {
    return { ok: true as const, dueDays: ruleValue("discipline.decision.days", day), cite: citeRule("discipline.appeal.internalDays", day) };
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
