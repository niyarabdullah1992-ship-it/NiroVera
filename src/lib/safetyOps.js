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

/* ─────────────────────────── Permits to work ───────────────────────────
 * Lifecycle (ISO 45001 §8.1 operational control — separation of duties):
 *   requested  — the worker asks (type · place · time); nothing may start.
 *   open       — an authorised issuer confirmed every control; work still may not start until the holder signs.
 *   active     — the holder acknowledged the controls (open + acknowledgedAt): work may proceed.
 *   closing    — the holder reports the work finished; the issuer closes with a site-safe signature.
 *   suspended · closed · cancelled · declined · expired.
 * Issuer and holder are never the same person.
 */

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

/** The worker's request: what, where, when — no controls yet (those are the issuer's to confirm). */
export function checkPermitRequestGate(draft = {}, { now = Date.now() } = {}) {
  const fail = (reason, reasonEn, field) => ({ ok: false, reason, reasonEn, field });
  const type = permitTypeRow(draft.type);
  if (!type) return fail("اختر نوع العمل.", "Pick the kind of work.", "type");
  if (!draft.stationId) return fail("لا فرع مرتبط بحسابك — لا يُرفع الطلب.", "No branch is linked to your account.", "stationId");
  if (String(draft.description || "").trim().length < 8) return fail("صف العمل وموقعه بدقة (8 أحرف على الأقل).", "Describe the work and its place (at least 8 characters).", "description");
  const start = riyadhLocalMs(draft.startAt);
  const end = riyadhLocalMs(draft.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return fail("حدّد بداية العمل ونهايته.", "Set the work start and end.", "startAt");
  if (end <= start) return fail("النهاية يجب أن تكون بعد البداية.", "The end must come after the start.", "endAt");
  if (end - start > PERMIT_MAX_HOURS * HOUR) return fail(`التصريح لوردية واحدة — ${PERMIT_MAX_HOURS} ساعة كحدّ أقصى.`, `A permit covers one shift — ${PERMIT_MAX_HOURS} hours at most.`, "endAt");
  if (end <= now) return fail("لا يُطلب تصريح لوقت مضى.", "A permit cannot be requested for a time that has passed.", "endAt");
  if (draft.outdoor) {
    const day = permitHeatBanDay(start, end);
    if (day) {
      const w = `${String(ruleValue("hours.heat.startHour")).padStart(2, "0")}:00–${String(ruleValue("hours.heat.endHour")).padStart(2, "0")}:00`;
      return fail(`القرار 3337: لا عمل مكشوف تحت الشمس ${w} يوم ${day}. اطلب وقتاً خارج الساعات.`, `Decision 3337: no sun-exposed work ${w} on ${day}. Ask for a time outside those hours.`, "endAt");
    }
  }
  return { ok: true };
}

/** Named gate for issuing a permit (directly, or from a worker's request). */
export function checkPermitIssueGate(draft = {}, { now = Date.now() } = {}) {
  const fail = (reason, reasonEn, field) => ({ ok: false, reason, reasonEn, field });
  const type = permitTypeRow(draft.type);
  if (!type) return fail("اختر نوع التصريح.", "Pick the permit type.", "type");
  if (!draft.stationId) return fail("اختر الفرع الذي يجري فيه العمل.", "Pick the branch where the work happens.", "stationId");
  if (String(draft.description || "").trim().length < 8) return fail("صف العمل وموقعه بدقة (8 أحرف على الأقل).", "Describe the work and its place (at least 8 characters).", "description");
  if (!draft.holderId) return fail("سمِّ منفّذ العمل المسؤول عن التصريح.", "Name the person responsible for the work.", "holderId");
  if (draft.issuerId && String(draft.issuerId) === String(draft.holderId)) return fail("لا يُصدر المنفّذ تصريحه لنفسه — التصريح شهادة طرف ثانٍ.", "The holder cannot issue his own permit — a permit is a second party's confirmation.", "holderId");
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
  if (permit.status === "requested") return "requested";
  if (permit.status === "declined") return "declined";
  if (permit.status === "cancelled") return "cancelled";
  if (permit.status === "closed") return "closed";
  const end = Number.isFinite(riyadhLocalMs(permit.endAt)) ? riyadhLocalMs(permit.endAt) : new Date(permit.validUntil).getTime();
  if (Number.isFinite(end) && end < now) return "expired";
  if (permit.status === "suspended") return "suspended";
  if (permit.closeRequestedAt) return "closing";
  return permit.acknowledgedAt ? "active" : "open";
}

/** Work may proceed only on an issued permit the holder has signed, inside its time. */
export function permitWorkAllowed(permit, now = Date.now()) {
  return permitStatus(permit, now) === "active";
}

export const PERMIT_STATUS_LABEL = {
  requested: { ar: "طلب بانتظار الإصدار", en: "Requested", tone: "warn" },
  declined: { ar: "رُفض بسبب", en: "Declined", tone: "idle" },
  open: { ar: "صدر — بانتظار توقيع المنفّذ", en: "Issued — awaiting holder's signature", tone: "warn" },
  active: { ar: "ساري — العمل جارٍ", en: "Active — work in progress", tone: "ok" },
  closing: { ar: "انتهى العمل — بانتظار إغلاق المُصدر", en: "Work done — awaiting issuer's close", tone: "warn" },
  suspended: { ar: "موقوف", en: "Suspended", tone: "warn" },
  closed: { ar: "مُغلق بتوقيع", en: "Closed, signed", tone: "idle" },
  cancelled: { ar: "ملغى", en: "Cancelled", tone: "idle" },
  expired: { ar: "انتهى دون إغلاق", en: "Expired unclosed", tone: "bad" },
};

/** Named gate for an action on a live permit: suspend · resume · close · cancel. */
export function checkPermitActionGate(permit, action, { note = "", areaSafe = false, actorId = "", now = Date.now() } = {}) {
  const fail = (reason, reasonEn) => ({ ok: false, reason, reasonEn });
  if (!permit) return fail("التصريح غير موجود.", "Permit not found.");
  const state = permitStatus(permit, now);
  const live = state === "open" || state === "active" || state === "closing";
  const isHolder = actorId && String(permit.holderId || "") === String(actorId);
  if (action === "decline") {
    if (state !== "requested") return fail("لا يُرفض إلا طلب لم يُصدر.", "Only an unissued request is declined.");
    if (String(note).trim().length < 5) return fail("اكتب سبب الرفض — يصل الطالب.", "Write why — the requester is told.");
    return { ok: true };
  }
  if (action === "acknowledge") {
    if (state !== "open") return fail(state === "active" ? "وقّعت على هذا التصريح من قبل." : "لا يُوقَّع إلا تصريح صادر لم يُوقَّع بعد.", state === "active" ? "You already signed this permit." : "Only an issued, unsigned permit is acknowledged.");
    if (!isHolder) return fail("يوقّع المنفّذ المسمّى في التصريح وحده.", "Only the named holder signs.");
    return { ok: true };
  }
  if (action === "requestClose") {
    if (state !== "active") return fail(state === "open" ? "وقّع على الاستلام أولاً." : "لا يُطلب الإغلاق إلا لتصريح ساري.", state === "open" ? "Sign the acknowledgement first." : "Close is requested only on an active permit.");
    if (!isHolder) return fail("يطلب الإغلاق المنفّذ المسمّى وحده.", "Only the named holder requests the close.");
    return { ok: true };
  }
  if (action === "suspend") {
    if (!live) return fail("لا يوقف إلا تصريح ساري.", "Only a live permit is suspended.");
    if (String(note).trim().length < 5) return fail("اكتب سبب الإيقاف — يُقرأ في سجل التصريح.", "Write why the work is stopped — it stays on the permit's trail.");
    return { ok: true };
  }
  if (action === "resume") {
    if (state !== "suspended") return fail("لا يُستأنف إلا تصريح موقوف لم ينتهِ وقته.", "Only a suspended permit within its time resumes.");
    if (String(note).trim().length < 5) return fail("اكتب ما عولج قبل الاستئناف.", "Write what was fixed before resuming.");
    return { ok: true };
  }
  if (action === "close") {
    if (!live && state !== "suspended" && state !== "expired") return fail("التصريح مُغلق أصلاً.", "The permit is already closed.");
    if (isHolder) return fail("يغلق التصريحَ مُصدِرُه أو مسؤول السلامة، لا منفّذه.", "The issuer or the safety officer closes — not the holder.");
    if (!areaSafe) return fail("أكّد أن الموقع تُرك آمناً وأُعيدت العوازل والطاقة — ثم أغلق.", "Confirm the site was left safe and isolations restored — then close.");
    return { ok: true };
  }
  if (action === "cancel") {
    if (!live && state !== "suspended" && state !== "requested") return fail("لا يُلغى إلا تصريح لم يُغلق.", "Only an unclosed permit is cancelled.");
    if (String(note).trim().length < 5) return fail("اكتب سبب الإلغاء.", "Write why it is cancelled.");
    return { ok: true };
  }
  return fail("إجراء غير معروف.", "Unknown action.");
}

/** Permit figures for a scope. */
export function permitBoard(permits = [], now = Date.now()) {
  const rows = permits.map((permit) => ({ permit, state: permitStatus(permit, now) }));
  const live = rows.filter((row) => ["open", "active", "closing"].includes(row.state));
  const endingSoon = live.filter((row) => {
    const end = riyadhLocalMs(row.permit.endAt);
    return Number.isFinite(end) && end - now <= 2 * HOUR;
  });
  const monthKey = riyadhParts(now).key.slice(0, 7);
  return {
    rows,
    live: live.length,
    requested: rows.filter((row) => row.state === "requested").length,
    awaitingAck: rows.filter((row) => row.state === "open").length,
    closing: rows.filter((row) => row.state === "closing").length,
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

/* ─────────────────────────── Risk assessment register (ISO 45001 §6.1.2) ─────────────────────────── */

/** Hierarchy of controls, most to least effective — the control level a residual score is judged against. */
export const RISK_CONTROL_LEVELS = [
  { id: "elim", ar: "الإزالة", en: "Elimination", rank: 1 },
  { id: "sub", ar: "الاستبدال", en: "Substitution", rank: 2 },
  { id: "eng", ar: "ضابط هندسي", en: "Engineering control", rank: 3 },
  { id: "adm", ar: "ضابط إداري", en: "Administrative control", rank: 4 },
  { id: "ppe", ar: "معدات الوقاية الشخصية", en: "PPE", rank: 5 },
];

/** Review at least every twelve months, or after an incident on the activity. */
export const RISK_REVIEW_MONTHS = 12;
export const RISK_INTOLERABLE = 15;

export function riskBand(score) {
  if (score == null || !Number.isFinite(score) || score <= 0) return "";
  if (score >= 15) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

export const RISK_BAND_LABEL = {
  critical: { ar: "حرج — لا يُقبل", en: "Critical — intolerable", tone: "bad" },
  high: { ar: "مرتفع", en: "High", tone: "bad" },
  medium: { ar: "متوسط", en: "Medium", tone: "warn" },
  low: { ar: "منخفض", en: "Low", tone: "ok" },
};

const grade = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };

export function checkRiskAssessmentGate(draft = {}) {
  const fail = (reason, reasonEn, field) => ({ ok: false, reason, reasonEn, field });
  if (!draft.stationId) return fail("اختر الفرع.", "Pick the branch.", "stationId");
  if (String(draft.activity || "").trim().length < 3) return fail("سمِّ النشاط أو المهمة.", "Name the activity.", "activity");
  if (String(draft.hazard || "").trim().length < 5) return fail("صف الخطر وكيف يقع الضرر (5 أحرف على الأقل).", "Describe the hazard and how harm occurs.", "hazard");
  const L = grade(draft.likelihood); const S = grade(draft.severity);
  if (!L || !S) return fail("قدّر الاحتمال والشدة قبل الضوابط (1–5).", "Grade likelihood and severity before controls (1–5).", "likelihood");
  if (!RISK_CONTROL_LEVELS.some((row) => row.id === draft.controlId)) return fail("اختر مستوى الضابط من هرم الضوابط.", "Pick the control level from the hierarchy.", "controlId");
  if (String(draft.control || "").trim().length < 5) return fail("اكتب الضابط نفسه — ما الذي يُفعل.", "Write the control itself — what is done.", "control");
  const rL = grade(draft.residualLikelihood); const rS = grade(draft.residualSeverity);
  if (!rL || !rS) return fail("قدّر الخطر المتبقي بعد الضابط (1–5).", "Grade the residual risk after the control (1–5).", "residualLikelihood");
  if (rL * rS > L * S) return fail("الخطر المتبقي لا يزيد على الخطر الأصلي.", "Residual risk cannot exceed the inherent risk.", "residualLikelihood");
  if (rL * rS >= RISK_INTOLERABLE) return fail(`خطر متبقٍ ${rL * rS}/25 لا يُقبل — ارفع مستوى الضابط أو أوقف النشاط حتى يُضبط.`, `A residual of ${rL * rS}/25 is intolerable — raise the control level or stop the activity.`, "residualLikelihood");
  if (String(draft.owner || "").trim().length < 2) return fail("سمِّ مسؤول الضابط.", "Name the control's owner.", "owner");
  return { ok: true };
}

export function riskRegisterState(items = [], now = Date.now()) {
  const rows = (Array.isArray(items) ? items : []).map((item) => {
    const inherent = (grade(item.likelihood) || 0) * (grade(item.severity) || 0);
    const residual = (grade(item.residualLikelihood) || 0) * (grade(item.residualSeverity) || 0);
    const reviewedAt = new Date(item.reviewedAt || item.createdAt).getTime();
    const ageDays = Number.isFinite(reviewedAt) ? Math.floor((now - reviewedAt) / DAY) : null;
    const reviewDue = ageDays == null || ageDays >= RISK_REVIEW_MONTHS * 30;
    const level = RISK_CONTROL_LEVELS.find((row) => row.id === item.controlId) || null;
    return { item, inherent, residual, band: riskBand(residual), level, ageDays, reviewDue, ppeOnly: level?.id === "ppe" && residual >= 10 };
  });
  return {
    rows,
    total: rows.length,
    high: rows.filter((row) => row.band === "high" || row.band === "critical").length,
    reviewDue: rows.filter((row) => row.reviewDue).length,
    ppeOnly: rows.filter((row) => row.ppeOnly).length,
  };
}

/* ─────────────────────────── Emergency preparedness (ISO 45001 §8.2) ─────────────────────────── */

export const DRILL_TYPES = [
  { id: "evacuation", ar: "تمرين إخلاء", en: "Evacuation drill", everyMonths: 6, cite: "safety.fire.cite" },
  { id: "fire", ar: "تمرين مكافحة حريق", en: "Fire-fighting drill", everyMonths: 12, cite: "safety.fire.cite" },
  { id: "firstAid", ar: "تمرين إسعاف أولي", en: "First-aid drill", everyMonths: 12, cite: "" },
];

export function checkDrillGate(draft = {}, { now = Date.now() } = {}) {
  const fail = (reason, reasonEn, field) => ({ ok: false, reason, reasonEn, field });
  const type = DRILL_TYPES.find((row) => row.id === draft.type);
  if (!type) return fail("اختر نوع التمرين.", "Pick the drill type.", "type");
  if (!draft.stationId) return fail("اختر الفرع.", "Pick the branch.", "stationId");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(draft.date || ""))) return fail("حدّد تاريخ التمرين.", "Set the drill date.", "date");
  if (new Date(`${draft.date}T00:00:00Z`).getTime() > now + DAY) return fail("لا يُسجَّل تمرين لم يُجرَ بعد.", "A drill is recorded after it is held.", "date");
  const n = Number(draft.participants);
  if (!Number.isInteger(n) || n < 1) return fail("كم شارك؟ (1 على الأقل)", "How many took part? (at least 1)", "participants");
  if (type.id === "evacuation") {
    const m = Number(draft.evacuationMinutes);
    if (!Number.isFinite(m) || m <= 0 || m > 120) return fail("زمن الإخلاء الكامل بالدقائق مطلوب.", "Full-evacuation time in minutes is required.", "evacuationMinutes");
  }
  if (draft.outcome !== "met" && draft.outcome !== "gaps") return fail("احكم: الهدف تحقق أم ظهرت ثغرات؟", "Judge: objective met, or gaps found?", "outcome");
  if (draft.outcome === "gaps" && String(draft.findings || "").trim().length < 5) return fail("اكتب الثغرات — تتحوّل إلى بلاغ يُعالج.", "Write the gaps — they become a report to fix.", "findings");
  return { ok: true };
}

/** Per drill type: last held and whether the cadence is due. */
export function drillState(rec = {}, now = Date.now()) {
  const drills = (Array.isArray(rec.drills) ? rec.drills : []).filter((row) => row && row.date);
  const types = DRILL_TYPES.map((type) => {
    const last = drills.filter((row) => row.type === type.id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
    const at = last ? new Date(`${last.date}T00:00:00Z`).getTime() : NaN;
    const ageDays = Number.isFinite(at) ? Math.floor((now - at) / DAY) : null;
    const limit = type.everyMonths * 30;
    return { type, last, ageDays, due: ageDays == null || ageDays >= limit, dueIn: ageDays == null ? null : limit - ageDays };
  });
  return { drills, types, due: types.filter((row) => row.due).length, compliant: types.every((row) => !row.due) };
}

/* ─────────────────────────── Leading indicators ─────────────────────────── */

/**
 * The leading side of the board (what is done before harm), beside the lagging rates:
 *   near-miss ratio    — near misses reported per recordable injury (higher = a reporting culture);
 *   round compliance   — branches whose monthly round is current;
 *   drill compliance   — branches whose drills are all within cadence;
 *   CAPA closure       — corrective actions done on time, of those due;
 *   finding closure    — inspection findings closed, of those raised in the window.
 */
export function leadingIndicators({ incidents = [], branches = [], now = Date.now() } = {}) {
  const since = now - 365 * DAY;
  const inWindow = incidents.filter((item) => { const at = new Date(item?.at).getTime(); return Number.isFinite(at) && at >= since; });
  const nearMiss = inWindow.filter((item) => incidentClass(item) === "nearMiss").length;
  const recordables = inWindow.filter((item) => ["fatality", "lti", "medical"].includes(incidentClass(item))).length;
  const todayKey = riyadhParts(now).key;
  const capas = incidents.filter((item) => item?.investigation?.capa);
  const capaDue = capas.filter((item) => item.investigation.capaDoneAt || String(item.investigation.capaDue || "") < todayKey);
  const capaOnTime = capaDue.filter((item) => item.investigation.capaDoneAt && String(item.investigation.capaDoneAt).slice(0, 10) <= String(item.investigation.capaDue || "")).length;
  const findings = inWindow.filter((item) => item.source?.kind === "inspection");
  const findingsClosed = findings.filter((item) => item.status === "closed").length;
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);
  return {
    nearMissRatio: recordables ? Math.round((nearMiss / recordables) * 10) / 10 : (nearMiss ? Infinity : null),
    nearMiss,
    recordables,
    roundCompliance: pct(branches.filter((b) => !b.roundDue).length, branches.length),
    drillCompliance: pct(branches.filter((b) => b.drillsCompliant).length, branches.length),
    capaClosure: pct(capaOnTime, capaDue.length),
    capaDue: capaDue.length,
    findingClosure: pct(findingsClosed, findings.length),
    findings: findings.length,
  };
}
