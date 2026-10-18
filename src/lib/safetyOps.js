/**
 * Safety operations for the management lane — permits to work, inspection rounds, injury investigations
 * and the HSE rates. Pure derivations: every gate names its refusal; every figure is derived from the
 * branch's safety record (permits · inspections · incidentLog · ltiEntries) and the people in scope.
 *
 * Law threads:
 *   Art. 121–122 — the employer protects workers and bears the cost of protection.
 *   Art. 125     — fire prevention means and usable escape exits (in the inspection round).
 *   Decision 3337 — no sun-exposed work 12:00–15:00, 15 June – 15 September (an outdoor permit cannot cover it).
 *   GOSI employer guide — a work injury is reported within ten days (gosi.injury.reportDays).
 */
import { ruleValue } from "./laborRules.js";
import { isHeatBanDate } from "./contractLawDerivations.js";
import { CHECKLIST_GROUPS, PERMIT_REQUIREMENTS, PERMIT_TYPES } from "./safetyStandards.js";

const DAY = 86400000;
const HOUR = 3600000;

/* ─────────────────────────── Permits to work ─────────────────────────── */

/** Controls a permit of each type cannot be issued without (all must be confirmed on issue). */
export const PERMIT_CONTROLS = {
  hot: ["ppe", "firewatch", "gas", "barricade"],
  height: ["ppe", "barricade", "rescue"],
  confined: ["ppe", "gas", "isolation", "rescue"],
  electrical: ["ppe", "isolation", "barricade"],
  excavation: ["ppe", "barricade", "gas"],
};

/** One permit covers one shift. */
export const PERMIT_MAX_HOURS = 12;

export function permitTypeRow(type) {
  const row = PERMIT_TYPES.find((item) => item[0] === type);
  return row ? { id: row[0], ar: row[1], en: row[2] } : null;
}

export function permitControlRows(type) {
  return (PERMIT_CONTROLS[type] || []).map((id) => {
    const row = PERMIT_REQUIREMENTS.find((item) => item[0] === id);
    return { id, ar: row ? row[1] : id, en: row ? row[2] : id };
  });
}

/** "YYYY-MM-DDTHH:MM" read as Riyadh wall-clock time (UTC+3, no DST). */
export function riyadhLocalMs(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 3, +m[5]);
}

function riyadhParts(ms) {
  const d = new Date(ms + 3 * HOUR);
  return {
    key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

/** Does [start, end) touch the decision-3337 window on an in-season day? Returns the first such day key or "". */
export function permitHeatBanDay(startMs, endMs) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return "";
  const from = ruleValue("hours.heat.startHour") * 60;
  const to = ruleValue("hours.heat.endHour") * 60;
  for (let t = startMs; t < endMs; t += 15 * 60000) {
    const { key, minutes } = riyadhParts(t);
    if (minutes >= from && minutes < to && isHeatBanDate(key)) return key;
  }
  return "";
}

/** Named gate for issuing a permit. */
export function checkPermitIssueGate(draft = {}, { now = Date.now() } = {}) {
  const fail = (reason, reasonEn, field) => ({ ok: false, reason, reasonEn, field });
  const type = permitTypeRow(draft.type);
  if (!type) return fail("اختر نوع التصريح.", "Pick the permit type.", "type");
  if (!draft.stationId) return fail("اختر الفرع الذي يجري فيه العمل.", "Pick the branch where the work happens.", "stationId");
  if (String(draft.description || "").trim().length < 8) return fail("صف العمل وموقعه بدقة (8 أحرف على الأقل).", "Describe the work and its place (at least 8 characters).", "description");
  if (!draft.holderId) return fail("سمِّ منفّذ العمل المسؤول عن التصريح.", "Name the person responsible for the work.", "holderId");
  const start = riyadhLocalMs(draft.startAt);
  const end = riyadhLocalMs(draft.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return fail("حدّد بداية التصريح ونهايته.", "Set the permit start and end.", "startAt");
  if (end <= start) return fail("نهاية التصريح يجب أن تكون بعد بدايته.", "The permit must end after it starts.", "endAt");
  if (end - start > PERMIT_MAX_HOURS * HOUR) return fail(`التصريح لوردية واحدة — ${PERMIT_MAX_HOURS} ساعة كحدّ أقصى، ويُجدَّد بتصريح جديد.`, `A permit covers one shift — ${PERMIT_MAX_HOURS} hours at most; renew with a new permit.`, "endAt");
  if (end <= now) return fail("لا يُصدر تصريح انتهى وقته.", "A permit whose time has passed is not issued.", "endAt");
  const confirmed = new Set(Array.isArray(draft.controls) ? draft.controls : []);
  const missing = permitControlRows(draft.type).filter((row) => !confirmed.has(row.id));
  if (missing.length) {
    return fail(
      `لم يُؤكَّد: ${missing.map((row) => row.ar).join("، ")} — لا يبدأ ${type.ar} قبلها.`,
      `Not confirmed: ${missing.map((row) => row.en).join(", ")} — ${type.en} does not start without them.`,
      "controls",
    );
  }
  if (draft.outdoor) {
    const day = permitHeatBanDay(start, end);
    if (day) {
      const w = `${String(ruleValue("hours.heat.startHour")).padStart(2, "0")}:00–${String(ruleValue("hours.heat.endHour")).padStart(2, "0")}:00`;
      return fail(
        `القرار 3337: لا عمل مكشوف تحت الشمس ${w} يوم ${day}. قدّم النهاية أو أخّر البداية خارج الساعات.`,
        `Decision 3337: no sun-exposed work ${w} on ${day}. Move the window outside those hours.`,
        "endAt",
      );
    }
  }
  return { ok: true };
}

export function permitCode(at = new Date(), seed = Math.random()) {
  const d = new Date(at);
  const yy = String(d.getUTCFullYear()).slice(2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const tail = Math.floor(seed * 36 ** 4).toString(36).toUpperCase().padStart(4, "0");
  return `PTW-${yy}${mm}-${tail}`;
}

/** Permit state on the clock: open · suspended · closed · cancelled · expired. */
export function permitStatus(permit, now = Date.now()) {
  if (!permit) return "";
  if (permit.status === "cancelled") return "cancelled";
  if (permit.status === "closed") return "closed";
  const end = Number.isFinite(riyadhLocalMs(permit.endAt)) ? riyadhLocalMs(permit.endAt) : new Date(permit.validUntil).getTime();
  if (Number.isFinite(end) && end < now) return "expired";
  if (permit.status === "suspended") return "suspended";
  return "open";
}

export const PERMIT_STATUS_LABEL = {
  open: { ar: "ساري", en: "Live", tone: "ok" },
  suspended: { ar: "موقوف", en: "Suspended", tone: "warn" },
  closed: { ar: "مُغلق بتوقيع", en: "Closed, signed", tone: "idle" },
  cancelled: { ar: "ملغى", en: "Cancelled", tone: "idle" },
  expired: { ar: "انتهى دون إغلاق", en: "Expired unclosed", tone: "bad" },
};

/** Named gate for an action on a live permit: suspend · resume · close · cancel. */
export function checkPermitActionGate(permit, action, { note = "", areaSafe = false, now = Date.now() } = {}) {
  const fail = (reason, reasonEn) => ({ ok: false, reason, reasonEn });
  if (!permit) return fail("التصريح غير موجود.", "Permit not found.");
  const state = permitStatus(permit, now);
  if (action === "suspend") {
    if (state !== "open") return fail("لا يوقف إلا تصريح ساري.", "Only a live permit is suspended.");
    if (String(note).trim().length < 5) return fail("اكتب سبب الإيقاف — يُقرأ في سجل التصريح.", "Write why the work is stopped — it stays on the permit's trail.");
    return { ok: true };
  }
  if (action === "resume") {
    if (state !== "suspended") return fail("لا يُستأنف إلا تصريح موقوف لم ينتهِ وقته.", "Only a suspended permit within its time resumes.");
    if (String(note).trim().length < 5) return fail("اكتب ما عولج قبل الاستئناف.", "Write what was fixed before resuming.");
    return { ok: true };
  }
  if (action === "close") {
    if (!["open", "suspended", "expired"].includes(state)) return fail("التصريح مُغلق أصلاً.", "The permit is already closed.");
    if (!areaSafe) return fail("أكّد أن الموقع تُرك آمناً وأُعيدت العوازل والطاقة — ثم أغلق.", "Confirm the site was left safe and isolations restored — then close.");
    return { ok: true };
  }
  if (action === "cancel") {
    if (state !== "open" && state !== "suspended") return fail("لا يُلغى إلا تصريح لم يُغلق.", "Only an unclosed permit is cancelled.");
    if (String(note).trim().length < 5) return fail("اكتب سبب الإلغاء.", "Write why it is cancelled.");
    return { ok: true };
  }
  return fail("إجراء غير معروف.", "Unknown action.");
}

/** Permit figures for a scope. */
export function permitBoard(permits = [], now = Date.now()) {
  const rows = permits.map((permit) => ({ permit, state: permitStatus(permit, now) }));
  const live = rows.filter((row) => row.state === "open");
  const endingSoon = live.filter((row) => {
    const end = riyadhLocalMs(row.permit.endAt);
    return Number.isFinite(end) && end - now <= 2 * HOUR;
  });
  const monthKey = riyadhParts(now).key.slice(0, 7);
  return {
    rows,
    live: live.length,
    suspended: rows.filter((row) => row.state === "suspended").length,
    endingSoon: endingSoon.length,
    unclosed: rows.filter((row) => row.state === "expired").length,
    closedMonth: rows.filter((row) => row.state === "closed" && String(row.permit.closedAt || "").slice(0, 7) === monthKey).length,
  };
}

/* ─────────────────────────── Inspection rounds ─────────────────────────── */

export function inspectionItems() {
  return CHECKLIST_GROUPS.flatMap((group) => group.items.map(([id, ar, en, ruleId]) => ({ id, ar, en, group: group.id, groupAr: group.ar, groupEn: group.en, ruleId: ruleId || "" })));
}

/** Monthly round. */
export const INSPECTION_EVERY_DAYS = 30;

export function inspectionScore(results = {}, items = inspectionItems()) {
  let yes = 0;
  let no = 0;
  items.forEach((item) => {
    const status = results[item.id]?.status;
    if (status === "yes") yes += 1;
    if (status === "no") no += 1;
  });
  const judged = yes + no;
  return { yes, no, na: items.filter((item) => results[item.id]?.status === "na").length, pct: judged ? Math.round((yes / judged) * 100) : null };
}

export function inspectionFindings(results = {}, items = inspectionItems()) {
  return items.filter((item) => results[item.id]?.status === "no").map((item) => ({ ...item, comment: String(results[item.id]?.comment || "").trim() }));
}

export function checkInspectionGate({ stationId, results = {} } = {}, items = inspectionItems()) {
  const fail = (reason, reasonEn) => ({ ok: false, reason, reasonEn });
  if (!stationId) return fail("اختر الفرع الذي تفتّشه.", "Pick the branch you are inspecting.");
  const open = items.filter((item) => !["yes", "no", "na"].includes(results[item.id]?.status));
  if (open.length) return fail(`بقي ${open.length} بنداً بلا حكم — احكم على كل بند: مطابق أو غير مطابق أو لا ينطبق.`, `${open.length} items have no verdict — mark each one: met, not met, or n/a.`);
  const bare = inspectionFindings(results, items).filter((row) => row.comment.length < 4);
  if (bare.length) return fail(`اكتب ما وجدته في كل بند غير مطابق (${bare.length}) — يتحوّل إلى بلاغ يُعالج.`, `Write what you found on each item not met (${bare.length}) — it becomes a report to fix.`);
  return { ok: true };
}

/** Latest round per branch and whether the monthly round is due. */
export function branchInspectionState(rec = {}, now = Date.now()) {
  const rounds = (Array.isArray(rec.inspections) ? rec.inspections : []).filter((row) => row && row.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const last = rounds[0] || null;
  const lastAt = last ? new Date(last.at).getTime() : NaN;
  const age = Number.isFinite(lastAt) ? Math.floor((now - lastAt) / DAY) : null;
  return {
    rounds,
    last,
    pct: last ? last.score : null,
    age,
    due: age == null || age >= INSPECTION_EVERY_DAYS,
    dueIn: age == null ? null : INSPECTION_EVERY_DAYS - age,
  };
}

/* ─────────────────────────── Incidents & investigations ─────────────────────────── */

export const ROOT_CAUSES = [
  { id: "act", ar: "تصرّف غير آمن", en: "Unsafe act" },
  { id: "condition", ar: "حالة غير آمنة", en: "Unsafe condition" },
  { id: "equipment", ar: "عطل معدّة", en: "Equipment failure" },
  { id: "procedure", ar: "إجراء غائب أو ناقص", en: "Missing procedure" },
  { id: "training", ar: "نقص تدريب", en: "Training gap" },
  { id: "supervision", ar: "ضعف إشراف", en: "Supervision gap" },
];

/** Incident class on the Bird pyramid, from the card and its investigation. */
export function incidentClass(item = {}) {
  const card = item.card || {};
  const lost = Number(item.investigation?.lostDays) || 0;
  if (Number(card.severity) === 5 && card.injured) return "fatality";
  if (lost > 0) return "lti";
  if (card.injured && Number(card.severity) >= 3) return "medical";
  if (card.injured || Number(card.severity) === 2) return "firstAid";
  if (Number(card.kind) === 2) return "nearMiss";
  if (Number(card.kind) === 3) return "damage";
  if (card.positive) return "positive";
  return "observation";
}

export const INCIDENT_CLASS_LABEL = {
  fatality: { ar: "وفاة أو عجز", en: "Fatality / disability", rank: 0 },
  lti: { ar: "إصابة مضيّعة للوقت", en: "Lost-time injury", rank: 1 },
  medical: { ar: "علاج طبي", en: "Medical treatment", rank: 2 },
  firstAid: { ar: "إسعاف أولي", en: "First aid", rank: 3 },
  damage: { ar: "ضرر بلا إصابة", en: "Damage, no injury", rank: 4 },
  nearMiss: { ar: "حادث وشيك", en: "Near miss", rank: 5 },
  observation: { ar: "ملاحظة / حالة غير آمنة", en: "Observation", rank: 6 },
  positive: { ar: "ملاحظة إيجابية", en: "Positive note", rank: 7 },
};

/** Incidents the register follows (everything but plain observations and positive notes). */
export function isTrackedIncident(item) {
  return !["observation", "positive"].includes(incidentClass(item));
}

/** GOSI: an injury is reported within ten days. */
export function injuryReportState(item = {}, now = Date.now()) {
  const card = item.card || {};
  if (!card.injured) return null;
  const days = ruleValue("gosi.injury.reportDays") || 10;
  const at = new Date(item.at).getTime();
  if (!Number.isFinite(at)) return null;
  const due = at + days * DAY;
  const reported = item.investigation?.gosiReportedAt ? new Date(item.investigation.gosiReportedAt).getTime() : NaN;
  if (Number.isFinite(reported)) {
    return { state: reported <= due + DAY - 1 ? "onTime" : "late", days, dueKey: new Date(due).toISOString().slice(0, 10) };
  }
  const left = Math.ceil((due - now) / DAY);
  return { state: left < 0 ? "overdue" : "due", left, days, dueKey: new Date(due).toISOString().slice(0, 10) };
}

export function checkInvestigationGate(item, draft = {}, { now = Date.now() } = {}) {
  const fail = (reason, reasonEn, field) => ({ ok: false, reason, reasonEn, field });
  if (!item) return fail("الحادث غير موجود.", "Incident not found.");
  if (!ROOT_CAUSES.some((row) => row.id === draft.rootCause)) return fail("حدّد السبب الجذري.", "Pick the root cause.", "rootCause");
  if (String(draft.capa || "").trim().length < 10) return fail("اكتب الإجراء التصحيحي الذي يمنع التكرار (10 أحرف على الأقل).", "Write the corrective action that prevents a repeat (at least 10 characters).", "capa");
  if (String(draft.capaOwner || "").trim().length < 2) return fail("سمِّ مسؤول تنفيذ الإجراء.", "Name who carries out the action.", "capaOwner");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(draft.capaDue || ""))) return fail("حدّد موعد تنفيذ الإجراء.", "Set the action's due date.", "capaDue");
  const lost = Number(draft.lostDays);
  if (draft.lostDays !== "" && draft.lostDays != null && (!Number.isInteger(lost) || lost < 0 || lost > 365)) return fail("أيام العمل المفقودة رقم صحيح من 0 إلى 365.", "Lost workdays is a whole number from 0 to 365.", "lostDays");
  if (draft.gosiReportedAt) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(draft.gosiReportedAt))) return fail("تاريخ إبلاغ التأمينات غير صالح.", "The GOSI report date is not valid.", "gosiReportedAt");
    const incidentDay = String(item.at || "").slice(0, 10);
    if (incidentDay && draft.gosiReportedAt < incidentDay) return fail("لا يسبق الإبلاغ تاريخ الحادث.", "The report cannot precede the incident.", "gosiReportedAt");
    if (new Date(`${draft.gosiReportedAt}T00:00:00Z`).getTime() > now + DAY) return fail("تاريخ الإبلاغ في المستقبل.", "The report date is in the future.", "gosiReportedAt");
  }
  return { ok: true };
}

/* ─────────────────────────── HSE rates ─────────────────────────── */

/**
 * Rolling twelve months. Exposure hours are estimated as headcount × the weekly cap (Art. 98) × 52 —
 * labelled as an estimate wherever shown.
 *   TRIR  = recordables × 200,000 / hours   (recordable: fatality · LTI · medical treatment)
 *   LTIFR = LTIs × 1,000,000 / hours
 *   Severity = lost days × 200,000 / hours
 */
export function hseRates({ incidents = [], headcount = 0, now = Date.now() } = {}) {
  const since = now - 365 * DAY;
  const inWindow = incidents.filter((item) => {
    const at = new Date(item?.at).getTime();
    return Number.isFinite(at) && at >= since && at <= now;
  });
  const counts = { fatality: 0, lti: 0, medical: 0, firstAid: 0, damage: 0, nearMiss: 0, observation: 0, positive: 0 };
  let lostDays = 0;
  inWindow.forEach((item) => {
    counts[incidentClass(item)] += 1;
    lostDays += Math.max(0, Number(item.investigation?.lostDays) || 0);
  });
  const weekly = ruleValue("hours.week.ordinaryMaxHours") || 48;
  const hours = Math.max(0, Number(headcount) || 0) * weekly * 52;
  const recordables = counts.fatality + counts.lti + counts.medical;
  const rate = (n, base) => (hours ? Math.round(((n * base) / hours) * 100) / 100 : null);
  return {
    counts,
    recordables,
    lostDays,
    hours,
    weekly,
    trir: rate(recordables, 200000),
    ltifr: rate(counts.fatality + counts.lti, 1000000),
    severity: rate(lostDays, 200000),
  };
}

/** Days since the last lost-time injury (or fatality) in the records; null when none is recorded. */
export function daysSinceLastLti(incidents = [], ltiEntries = [], now = Date.now()) {
  let last = 0;
  incidents.forEach((item) => {
    const cls = incidentClass(item);
    if (cls !== "lti" && cls !== "fatality") return;
    const at = new Date(item.at).getTime();
    if (Number.isFinite(at)) last = Math.max(last, at);
  });
  ltiEntries.forEach((entry) => {
    const at = new Date(entry?.date).getTime();
    if (Number.isFinite(at)) last = Math.max(last, at);
  });
  return last ? Math.max(0, Math.floor((now - last) / DAY)) : null;
}

/** Open corrective actions from investigations, with overdue flags. */
export function openCapas(incidents = [], now = Date.now()) {
  const todayKey = riyadhParts(now).key;
  return incidents
    .filter((item) => item?.investigation?.capa && !item.investigation.capaDoneAt)
    .map((item) => ({ item, due: item.investigation.capaDue, overdue: String(item.investigation.capaDue || "") < todayKey }))
    .sort((a, b) => String(a.due).localeCompare(String(b.due)));
}
