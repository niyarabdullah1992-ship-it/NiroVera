/**
 * The statutory clocks on open sanction files, and the reminders they send before they run out.
 *
 *   المادة 69 — لا يُوقَّع الجزاء بعد انتهاء التحقيق بأكثر من 30 يوماً (تقويمية).
 *   المادة 72 — يُبتّ في التظلّم كتابةً خلال 15 يوماً من تقديمه؛ وللعامل أن يتظلّم خلال 30 يوماً
 *               عدا أيام العطل الرسمية من إبلاغه بالقرار. إن لم يُبتّ فله الاعتراض أمام المحاكم العمالية.
 *
 * Managers hear when the signing or ruling window is 7 days, then 2 days, from closing, and once it has
 * closed; the worker hears 7 days before his own grievance window closes, and — if his grievance went
 * undecided for 15 days — that the labour courts are open to him. Each key fires once.
 */

import { ruleValue } from "./laborRules.js";
import { countDaysExcludingOfficialHolidays } from "./ummAlQuraCalendar.js";
import { faceOf } from "./disciplineBoard.js";
import { regulationDate } from "./workRegulation.js";

const DAY = 86400000;

function dateOnly(v) {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function addDays(iso, n) {
  const s = dateOnly(iso);
  if (!s) return "";
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(n));
  return d.toISOString().slice(0, 10);
}

function between(a, b) {
  return Math.round((new Date(`${dateOnly(b)}T00:00:00Z`) - new Date(`${dateOnly(a)}T00:00:00Z`)) / DAY);
}

export const DEADLINE_SOON_DAYS = 7;

/**
 * Every running clock on the files: { caseId, employeeId, kind: "sign"|"ruling"|"grievance",
 * article, from, due, left, over, soon }. `left` is whole days until the last allowed day.
 */
export function disciplineDeadlines({ cases = [], today, calendar } = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const signMax = Number(ruleValue("discipline.charge.maxDays", day)) || 30;
  const rulingMax = Number(ruleValue("discipline.decision.days", day)) || 15;
  const grievanceMax = Number(ruleValue("discipline.appeal.internalDays", day)) || 30;
  const out = [];
  for (const item of cases || []) {
    const face = faceOf(item.status).id;
    const base = { caseId: item.id, employeeId: item.employeeId };
    if (face === "defence") {
      const from = dateOnly(item.hearingEndedAt || item.investigationEndedAt || item.hearingAt);
      if (from && !dateOnly(item.signedAt || item.decidedAt)) {
        const due = addDays(from, signMax);
        const left = between(day, due);
        out.push({ ...base, kind: "sign", article: "69", from, due, left, over: left < 0, soon: left >= 0 && left <= DEADLINE_SOON_DAYS });
      }
    }
    if (face === "objected") {
      const from = dateOnly(item.appealedAt);
      if (from && !item.rulingNote) {
        const due = addDays(from, rulingMax);
        const left = between(day, due);
        out.push({ ...base, kind: "ruling", article: "72", from, due, left, over: left < 0, soon: left >= 0 && left <= DEADLINE_SOON_DAYS });
      }
    }
    if (face === "signed") {
      const from = dateOnly(item.signedAt || item.decidedAt);
      if (from && !item.appealedAt) {
        const used = countDaysExcludingOfficialHolidays(from, day, calendar);
        const left = grievanceMax - used;
        out.push({ ...base, kind: "grievance", article: "72", from, due: "", left, over: left < 0, soon: left >= 0 && left <= DEADLINE_SOON_DAYS });
      }
    }
  }
  return out.sort((a, b) => a.left - b.left);
}

/** One plain line for a clock. */
export function deadlineText(row, name = "", ar = true) {
  const who = String(name || "").trim() || (ar ? "موظف" : "An employee");
  const days = (n) => (ar ? (n === 0 ? "اليوم آخر يوم" : n === 1 ? "باقي يوم واحد" : n === 2 ? "باقي يومان" : `باقي ${n} أيام`) : (n === 0 ? "today is the last day" : `${n} day(s) left`));
  if (row.kind === "sign") {
    return row.over
      ? (ar ? `انتهت مهلة توقيع جزاء ${who} — مضى على انتهاء التحقيق أكثر من 30 يوماً، فلا يُوقَّع (المادة 69).` : `The signing window for ${who} has closed — over 30 days since the investigation ended (Art. 69).`)
      : (ar ? `مهلة توقيع جزاء ${who}: ${days(row.left)} (حتى ${regulationDate(row.due, true)}). بعدها لا يُوقَّع (المادة 69).` : `Signing window for ${who}: ${days(row.left)} (until ${regulationDate(row.due, false)}) — Art. 69.`);
  }
  if (row.kind === "ruling") {
    return row.over
      ? (ar ? `لم يُبتّ في تظلّم ${who} خلال 15 يوماً — صار له الاعتراض أمام المحاكم العمالية (المادة 72).` : `${who}'s grievance went undecided for 15 days — the labour courts are open to them (Art. 72).`)
      : (ar ? `البتّ في تظلّم ${who}: ${days(row.left)} (حتى ${regulationDate(row.due, true)}) — كتابةً (المادة 72).` : `Rule on ${who}'s grievance: ${days(row.left)} (until ${regulationDate(row.due, false)}) — Art. 72.`);
  }
  return row.over
    ? (ar ? "انتهت مهلة التظلّم من هذا الجزاء (المادة 72)." : "The grievance window on this sanction has closed (Art. 72).")
    : (ar ? `مهلة تظلّمك من الجزاء: ${days(row.left)} عدا أيام العطل الرسمية (المادة 72).` : `Your grievance window: ${days(row.left)}, official holidays excluded (Art. 72).`);
}

function stageOf(row) {
  if (row.over) return "over";
  if (row.left <= 2) return "2";
  if (row.left <= DEADLINE_SOON_DAYS) return "7";
  return "";
}

/**
 * Notices to send now: [{ userId, key, text, to }]. Managers come from `audienceOf(employee)`;
 * the worker hears about his own grievance window and, after an undecided grievance, the courts.
 */
export function planDisciplineDeadlineNotices({ data, today, existingKeys = [], audienceOf, calendar, ar = true } = {}) {
  const seen = new Set((existingKeys || []).filter(Boolean));
  const plans = [];
  const push = (userId, key, text) => {
    if (!userId || seen.has(key)) return;
    seen.add(key);
    plans.push({ userId, key, text, to: "/app/discipline" });
  };
  const employees = data?.employees || [];
  for (const row of disciplineDeadlines({ cases: data?.disciplinaryCases || [], today, calendar })) {
    const stage = stageOf(row);
    if (!stage) continue;
    const employee = employees.find((e) => String(e.id) === String(row.employeeId));
    if (!employee) continue;
    if (row.kind === "grievance") {
      if (stage === "7") push(employee.id, `disc-deadline:${row.caseId}:grievance:7:${employee.id}`, deadlineText(row, employee.name, ar));
      continue;
    }
    const managers = (audienceOf ? audienceOf(employee) : []).filter((m) => m?.id && String(m.id) !== String(employee.id));
    for (const m of managers) push(m.id, `disc-deadline:${row.caseId}:${row.kind}:${stage}:${m.id}`, deadlineText(row, employee.name, ar));
    if (row.kind === "ruling" && stage === "over") {
      push(employee.id, `disc-deadline:${row.caseId}:court:${employee.id}`, ar
        ? "لم يُبتّ في تظلّمك كتابةً خلال 15 يوماً من تقديمه — لك الاعتراض على قرار الجزاء أمام المحاكم العمالية خلال 30 يوماً عدا العطل الرسمية (المادة 72)."
        : "Your grievance was not decided in writing within 15 days — you may object before the labour courts within 30 days, official holidays excluded (Art. 72).");
    }
  }
  return plans;
}
