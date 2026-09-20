/** Client mirror of base44/shared/workProofDerivations.ts */
import {
  HEAT_BAN_STATE_LEVEL,
  heatBanClockState,
  heatBanWindow,
  isHeatBanDate,
  isHeatBanMinuteOfDay,
} from "./contractLawDerivations.js";
import { heatBanDecisionLabel } from "./heatBanDecision.js";
import { citeRule, explainRule } from "./laborRules.js";
import { isoDayKey, normalizeTaskMode, riyadhClock, taskModeLabel } from "./opsDerivations.js";

function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Where the crew actually worked — the same three places a task carries, so the
 * vocabulary is one across the platform. It is stated at raise, never inferred:
 * a station id says nothing about whether the hands were under the sun.
 */
export function normalizeProofPlace(value) {
  return normalizeTaskMode(value);
}

export function proofPlaceLabel(value, lang = "ar") {
  return taskModeLabel(value, lang);
}

export function checkProofPlaceGate(value, lang = "ar") {
  const place = normalizeProofPlace(value);
  if (place) return { ok: true, place };
  return {
    ok: false,
    error: "PROOF_PLACE_REQUIRED",
    reason: "حدّد مكان التنفيذ: حضوري داخل المنشأة، أو ميداني في الهواء الطلق، أو عن بُعد. منه يُعرف سريان حظر العمل تحت أشعة الشمس.",
    reasonEn: "State where the work happens: on-site indoors, field in the open air, or remote. It decides whether the sun ban applies.",
    lang,
  };
}

export function isOutdoorProof(proof) {
  return normalizeProofPlace(proof?.place) === "field";
}

/**
 * Starting open-air work inside the banned hours is refused — the refusal comes
 * before the breach, while it can still be avoided.
 */
export function checkProofHeatBanGate({ place, now = new Date() } = {}) {
  if (normalizeProofPlace(place) !== "field") return { ok: true, skipped: "not_outdoor" };
  const clock = riyadhClock(now);
  if (!clock) return { ok: true, skipped: "no_clock" };
  if (!isHeatBanDate(clock.dayKey)) return { ok: true, skipped: "off_season" };
  if (!isHeatBanMinuteOfDay(clock.minutes, clock.dayKey)) return { ok: true, skipped: "off_window" };
  const win = heatBanWindow(clock.dayKey);
  const badge = explainRule("hours.heat.startHour", clock.dayKey);
  // The hours are decision 3337's; the cited article is only the basis it was issued on.
  const cite = citeRule("hours.heat.cite", clock.dayKey);
  return {
    ok: false,
    error: "HEAT_BAN",
    ruleId: "hours.heat.startHour",
    labelAr: badge?.labelAr || "قرار وزاري",
    labelEn: badge?.labelEn || "Ministerial decision",
    cite,
    window: win,
    at: clock.label,
    dayKey: clock.dayKey,
    reason: `موقوف — لا يُفتح إثبات عمل في الهواء الطلق بين ${win.startLabel} و${win.endLabel} بتوقيت الرياض ${win.seasonAr}. الوقت الآن ${clock.label}، فافتح الإثبات بعد ${win.endLabel} أو اختر العمل داخل المنشأة. الساعتان والموسم من ${heatBanDecisionLabel(true)}، الصادر على ${cite?.labelAr || "نظام العمل"}.`,
    reasonEn: `Blocked — an open-air work proof may not be opened between ${win.startLabel} and ${win.endLabel} Riyadh time ${win.seasonEn}. It is now ${clock.label} — open it after ${win.endLabel}, or state the work is indoors. The hours and the season come from ${heatBanDecisionLabel(false)}, issued on ${cite?.labelEn || "the Labour Law"}.`,
  };
}

/** Banned minutes the crew actually spent under the sun, counted day by day. */
export function proofHeatBanMinutes(proof) {
  if (!isOutdoorProof(proof)) return 0;
  const from = riyadhClock(proof?.startedAt);
  const to = riyadhClock(proof?.endedAt);
  if (!from || !to) return 0;
  if (to.dayKey < from.dayKey) return 0;
  if (to.dayKey === from.dayKey && to.minutes < from.minutes) return 0;
  let minutes = 0;
  let day = from.dayKey;
  // The guard spans a full ban season, so a long span is counted rather than truncated.
  for (let guard = 0; guard < 400 && day <= to.dayKey; guard += 1) {
    if (isHeatBanDate(day)) {
      const win = heatBanWindow(day);
      const segStart = day === from.dayKey ? from.minutes : 0;
      const segEnd = day === to.dayKey ? to.minutes : 1440;
      minutes += Math.max(0, Math.min(segEnd, win.endHour * 60) - Math.max(segStart, win.startHour * 60));
    }
    const next = new Date(`${day}T00:00:00`);
    next.setDate(next.getDate() + 1);
    day = isoDayKey(next);
  }
  return minutes;
}

/**
 * A breach that already happened is recorded and named, never refused. Refusing
 * the record would erase the only evidence that the crew was under the sun.
 */
export function deriveProofHeatBanFlag(proof) {
  const minutes = proofHeatBanMinutes(proof);
  if (minutes < 1) return null;
  const day = riyadhClock(proof?.startedAt)?.dayKey;
  const win = heatBanWindow(day);
  const badge = explainRule("hours.heat.startHour", day);
  const cite = citeRule("hours.heat.cite", day);
  return {
    id: "heat_ban",
    level: "block",
    ruleId: "hours.heat.startHour",
    labelAr: badge?.labelAr || "قرار وزاري",
    labelEn: badge?.labelEn || "Ministerial decision",
    cite,
    window: win,
    minutes,
    textAr: `مخالفة مثبّتة — عمل في الهواء الطلق داخل نافذة حظر العمل تحت أشعة الشمس: ${minutes} دقيقة بين ${win.startLabel} و${win.endLabel}. القيد محفوظ كما وقع، والمخالفة مقيَّدة في سجل التدقيق ولا تُمحى بالإقفال. ${heatBanDecisionLabel(true)}.`,
    textEn: `Recorded breach — open-air work inside the sun-ban window: ${minutes} minutes between ${win.startLabel} and ${win.endLabel}. The record stands as it happened and the breach is kept on the audit trail; closing does not erase it. ${heatBanDecisionLabel(false)}.`,
  };
}

/**
 * The open-air place always carries the ban's text, but the severity is read off
 * the Riyadh clock here rather than guessed in the form: `cite` outside the
 * season, `alert` inside the season while the hands may still work, and `block`
 * inside the banned hours — where raising this proof is actually refused.
 */
export function deriveProofHeatBanNotice({ place, now = new Date() } = {}) {
  if (normalizeProofPlace(place) !== "field") return null;
  const clock = riyadhClock(now);
  if (!clock) return null;
  const state = heatBanClockState(clock);
  const win = heatBanWindow(clock.dayKey);
  const badge = explainRule("hours.heat.startHour", clock.dayKey);
  const base = {
    state,
    level: HEAT_BAN_STATE_LEVEL[state],
    ruleId: "hours.heat.startHour",
    labelAr: badge?.labelAr || "قرار وزاري",
    labelEn: badge?.labelEn || "Ministerial decision",
    cite: citeRule("hours.heat.cite", clock.dayKey),
    window: win,
    at: clock.label,
    dayKey: clock.dayKey,
  };
  if (state === "off_season") {
    return {
      ...base,
      id: "heat_ban_off_season",
      textAr: `اليوم خارج موسم حظر العمل تحت أشعة الشمس، فالعمل في الهواء الطلق غير مقيَّد بساعة. الموسم ${win.seasonAr}، والنافذة الموقوفة داخله من ${win.startLabel} إلى ${win.endLabel} — ${heatBanDecisionLabel(true)}.`,
      textEn: `Today is outside the sun-ban season, so open-air work is not bound to an hour. The season runs ${win.seasonEn} from ${win.startLabel} to ${win.endLabel} — ${heatBanDecisionLabel(false)}.`,
    };
  }
  if (state === "in_window") {
    return {
      ...base,
      id: "heat_ban_now",
      textAr: `الوقت الآن ${clock.label} داخل نافذة حظر العمل تحت أشعة الشمس ${win.startLabel}–${win.endLabel} ${win.seasonAr}. لا يُفتح إثبات عمل في الهواء الطلق قبل ${win.endLabel} — ${heatBanDecisionLabel(true)}.`,
      textEn: `It is now ${clock.label}, inside the sun-ban window ${win.startLabel}–${win.endLabel} ${win.seasonEn}. An open-air work proof may not be opened before ${win.endLabel} — ${heatBanDecisionLabel(false)}.`,
    };
  }
  if (state === "after_window") {
    return {
      ...base,
      id: "heat_ban_passed",
      textAr: `نافذة حظر العمل تحت أشعة الشمس ${win.startLabel}–${win.endLabel} أُغلقت اليوم، والوقت الآن ${clock.label}. العمل في الهواء الطلق جائز، وتُفتح النافذة من جديد عند ${win.startLabel} ما بقي اليوم ${win.seasonAr}.`,
      textEn: `Today's sun-ban window ${win.startLabel}–${win.endLabel} has closed and it is now ${clock.label}. Open-air work is lawful, and the window opens again at ${win.startLabel} while the day falls ${win.seasonEn}.`,
    };
  }
  return {
    ...base,
    id: "heat_ban_ahead",
    textAr: `اليوم داخل موسم حظر العمل تحت أشعة الشمس ${win.seasonAr}. العمل في الهواء الطلق جائز الآن، وعلى الأيدي أن تتوقف عند ${win.startLabel} وتعود بعد ${win.endLabel}.`,
    textEn: `Today falls in the sun-ban season ${win.seasonEn}. Open-air work is lawful now; the hands must stop at ${win.startLabel} and resume after ${win.endLabel}.`,
  };
}

export function sealIdFor(proof) {
  const geo = String(proof.geoVerdict || "in").toLowerCase().startsWith("out") ? "out" : "in";
  const src = `${proof.ref}|${proof.beforeStamp || ""}|${proof.afterStamp || ""}|${geo}`;
  const h = fnv1a(src);
  const tail = (h % 1679616).toString(36).toUpperCase().padStart(4, "0");
  const refDigits = String(proof.ref || "").replace(/\D/g, "").slice(-4) || "0000";
  return `NV-WP-${refDigits}-${tail}`;
}

export function hasAfterCapture(proof) {
  const after = String(proof.afterStamp || "").trim();
  return !!after && after !== "—";
}

export function isOutsideGeofence(proof) {
  const v = String(proof.geoVerdict || "in").toLowerCase();
  return v === "out" || v.includes("outside") || v.includes("خارج");
}

export function deriveProofStage(proof) {
  if (proof.status === "rejected") return "rejected";
  if (proof.status === "accepted" || proof.acceptedAt) return "accepted";
  if (proof.status === "sealed" || proof.sealId || proof.approvedAt) return "sealed";
  if (!hasAfterCapture(proof)) return "await";
  return "ready";
}

/** Sealed / accepted / rejected leave the live board — same rule as ops done and visitor "left". */
export function isWorkProofArchived(proof) {
  if (!proof) return false;
  const stage = deriveProofStage(proof);
  return stage === "sealed" || stage === "accepted" || stage === "rejected";
}

export function applyWorkProofArchive(proof, at) {
  const when = at
    || proof?.archivedAt
    || proof?.endedAt
    || proof?.approvedAt
    || proof?.acceptedAt
    || proof?.rejectedAt
    || new Date().toISOString();
  return {
    archived: true,
    archivedAt: proof?.archivedAt || when,
  };
}

export function workProofArchiveDate(proof) {
  return proof?.archivedAt
    || proof?.endedAt
    || proof?.approvedAt
    || proof?.acceptedAt
    || proof?.rejectedAt
    || proof?.createdAt
    || proof?.startedAt
    || null;
}

export function deriveProofCounts(proofs = []) {
  const list = Array.isArray(proofs) ? proofs : [];
  const counts = { total: list.length, await: 0, ready: 0, sealed: 0, accepted: 0, rejected: 0, live: 0, archived: 0 };
  for (const p of list) {
    counts[deriveProofStage(p)] += 1;
    if (isWorkProofArchived(p)) counts.archived += 1;
    else counts.live += 1;
  }
  return counts;
}

export function isSameProofBranch(actorStationId, proofStationId) {
  return !!(actorStationId && proofStationId && String(actorStationId) === String(proofStationId));
}

export function isProofCrewMember(proof, actorUserId) {
  const id = String(actorUserId || "").trim();
  if (!id || !proof) return false;
  return (Array.isArray(proof.people) ? proof.people : []).some(
    (person) => String(person?.employeeId || "").trim() === id,
  );
}

function actorMayMutateProof({ proof, actorUserId, sameBranch, isManager }) {
  const isRaiser = actorUserId && proof?.raiserId && String(actorUserId) === String(proof.raiserId);
  const onCrew = isProofCrewMember(proof, actorUserId);
  return !!(isRaiser || sameBranch || isManager || onCrew);
}

export function checkEndWorkProofGate({ proof, actorUserId, sameBranch, isManager }) {
  if (!proof) return { ok: false, error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود.", reasonEn: "Proof not found." };
  if (deriveProofStage(proof) !== "await") {
    return { ok: false, error: "NOT_IN_PROGRESS", reason: "هذا الإثبات ليس بانتظار الإنهاء.", reasonEn: "This proof is not waiting to be ended." };
  }
  if (!actorMayMutateProof({ proof, actorUserId, sameBranch, isManager })) {
    return {
      ok: false,
      error: "CREW_OR_BRANCH_REQUIRED",
      reason: "إنهاء العمل لمن رفعه أو لمن في الطاقم أو لموظف في فرع التنفيذ.",
      reasonEn: "Only the raiser, a listed crew member, or someone at the executing branch can end the work.",
    };
  }
  return { ok: true, autoApprove: true };
}

/** Ending with an after photo is the approval act — always seal. */
export function shouldSealOnEnd() {
  return true;
}

export const WORK_PROOF_EDIT_MS = 24 * 60 * 60 * 1000;

export function proofEditDeadline(proof) {
  const created = new Date(proof?.createdAt || 0).getTime();
  if (!Number.isFinite(created) || created <= 0) return null;
  return created + WORK_PROOF_EDIT_MS;
}

export function checkEditWorkProofGate({ proof, actorUserId, sameBranch, isManager, now = Date.now() }) {
  if (!proof) return { ok: false, error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود.", reasonEn: "Proof not found." };
  const stage = deriveProofStage(proof);
  if (stage === "sealed" || stage === "accepted" || stage === "rejected") {
    return {
      ok: false,
      error: "LOCKED_AFTER_SEAL",
      reason: "بعد الختم أو الرفض لا يُعدَّل الإثبات.",
      reasonEn: "A sealed, accepted, or rejected proof cannot be edited.",
    };
  }
  const deadline = proofEditDeadline(proof);
  if (!deadline || now > deadline) {
    return {
      ok: false,
      error: "EDIT_WINDOW_CLOSED",
      reason: "انتهت مهلة التعديل — يوم واحد من الرفع.",
      reasonEn: "The one-day edit window from raise time has closed.",
    };
  }
  if (!actorMayMutateProof({ proof, actorUserId, sameBranch, isManager })) {
    return {
      ok: false,
      error: "CREW_OR_BRANCH_REQUIRED",
      reason: "التعديل لمن رفعه أو لمن في الطاقم أو لموظف في فرع التنفيذ.",
      reasonEn: "Only the raiser, a listed crew member, or someone at the executing branch can edit.",
    };
  }
  return { ok: true, until: new Date(deadline).toISOString() };
}

export function checkApproveWorkProofGate({ proof, actorUserId, geoClearReason }) {
  if (!proof) return { ok: false, error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود في نطاق الشركة." };
  const stage = deriveProofStage(proof);
  if (stage === "rejected") return { ok: false, error: "PROOF_REJECTED", reason: "الإثبات مرفوض — يلزم إعادة التصوير." };
  if (stage !== "ready") {
    return {
      ok: false,
      error: stage === "await" ? "AFTER_PHOTO_REQUIRED" : "NOT_AWAITING_APPROVAL",
      reason: stage === "await" ? "لا اعتماد قبل إنهاء العمل وصورة البعد." : "الإثبات ليس بانتظار اعتماد الإنهاء.",
    };
  }
  const alreadyEnded = hasAfterCapture(proof) && (proof.endedAt || proof.endedById);
  if (actorUserId && proof.raiserId && String(actorUserId) === String(proof.raiserId) && !alreadyEnded) {
    return {
      ok: false,
      error: "SELF_APPROVE_FORBIDDEN",
      reason: "من رفع الإثبات لا يعتمده قبل إنهائه بصورة البعد.",
    };
  }
  if (isOutsideGeofence(proof) && !proof.geoCleared && !String(geoClearReason || "").trim()) {
    return {
      ok: false,
      error: "GEO_CLEARANCE_REQUIRED",
      reason: "التقاط خارج النطاق يوقف عند الاعتماد — اقبل بسبب مكتوب أو ارفض.",
    };
  }
  return { ok: true, sealId: sealIdFor(proof) };
}

export function checkAcceptGate(proof) {
  if (!proof) return { ok: false, error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود." };
  if (deriveProofStage(proof) !== "sealed") {
    return { ok: false, error: "NOT_SEALED", reason: "لا استلام من العميل قبل ختم المشرف." };
  }
  const expected = sealIdFor(proof);
  if (proof.sealId && proof.sealId !== expected) {
    return { ok: false, error: "SEAL_INVALID", reason: "الختم باطل — تغيّر مرجع أو طوابع أو حكم الموقع." };
  }
  return { ok: true, sealId: expected };
}

function formatProofAuditWhen(iso) {
  const raw = String(iso || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 16).replace("T", " ");
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function appendWorkProofAudit(proof, type, actor = {}, extra = {}) {
  const trail = Array.isArray(proof?.auditTrail) ? proof.auditTrail.filter(Boolean) : [];
  return [
    ...trail,
    {
      id: extra.id || `wpa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      at: extra.at || new Date().toISOString(),
      actorId: actor.id || actor.userId || null,
      actorName: String(actor.name || extra.actorName || "").trim(),
      detail: String(extra.detail || "").trim(),
    },
  ];
}

function derivedWorkProofAudit(proof) {
  if (!proof) return [];
  const events = [];
  if (proof.createdAt || proof.raiserName || proof.raiserId) {
    events.push({
      type: "raise",
      at: proof.createdAt || proof.startedAt || "",
      actorId: proof.raiserId || null,
      actorName: proof.raiserName || "",
    });
  }
  if (proof.editedAt || proof.editedBy) {
    events.push({
      type: "edit",
      at: proof.editedAt || "",
      actorId: proof.editedById || null,
      actorName: proof.editedBy || "",
    });
  }
  if (proof.endedAt || proof.endedBy || proof.endedById) {
    events.push({
      type: "end",
      at: proof.endedAt || proof.approvedAt || "",
      actorId: proof.endedById || null,
      actorName: proof.endedBy || proof.approvedBy || "",
    });
  } else if ((proof.status === "sealed" || proof.sealId || proof.approvedAt) && (proof.approvedBy || proof.approvedAt)) {
    events.push({
      type: "end",
      at: proof.approvedAt || "",
      actorId: null,
      actorName: proof.approvedBy || "",
    });
  }
  if (proof.status === "rejected") {
    events.push({
      type: "reject",
      at: proof.rejectedAt || proof.editedAt || "",
      actorId: proof.rejectedById || null,
      actorName: proof.rejectedBy || "",
      detail: proof.rejectReason || "",
    });
  }
  return events;
}

export function buildWorkProofAuditTimeline(proof, lang = "ar") {
  if (!proof) return [];
  const ar = lang === "ar";
  const stored = Array.isArray(proof.auditTrail) ? proof.auditTrail.filter(Boolean) : [];
  let events = stored.length ? stored.slice() : derivedWorkProofAudit(proof);
  if (stored.length) {
    if (!stored.some((event) => event.type === "raise" || event.type === "create")) {
      events = [...derivedWorkProofAudit(proof).filter((event) => event.type === "raise"), ...events];
    }
    if (
      (proof.endedAt || proof.endedBy || proof.status === "sealed" || proof.sealId)
      && !stored.some((event) => event.type === "end" || event.type === "seal")
    ) {
      events = [...events, ...derivedWorkProofAudit(proof).filter((event) => event.type === "end")];
    }
  }
  const labels = {
    raise: ar ? "أُنشئ الإثبات" : "Proof created",
    create: ar ? "أُنشئ الإثبات" : "Proof created",
    edit: ar ? "عُدّل الإثبات" : "Proof edited",
    end: ar ? "أُغلق الإثبات" : "Proof closed",
    seal: ar ? "أُغلق الإثبات" : "Proof closed",
    reject: ar ? "رُفض الإثبات" : "Proof rejected",
    attach: ar ? "أُرفق مستند" : "Document attached",
    heat_ban: ar ? "قُيّدت مخالفة حظر العمل تحت أشعة الشمس" : "Sun-ban breach recorded",
  };
  const tones = {
    raise: "#14284B",
    create: "#14284B",
    edit: "#B45309",
    end: "#1E9E63",
    seal: "#1E9E63",
    reject: "#DC2626",
    attach: "#1D4ED8",
    heat_ban: "#B91C1C",
  };
  return events.map((event, index) => {
    const type = String(event.type || "edit");
    const by = String(event.actorName || event.by || "").trim();
    const verb = labels[type] || (ar ? "حُدّث الإثبات" : "Proof updated");
    const byLine = by ? (ar ? ` بواسطة ${by}` : ` by ${by}`) : "";
    return {
      id: event.id || `${type}_${event.at || index}`,
      type,
      at: event.at || "",
      when: formatProofAuditWhen(event.at),
      by,
      detail: String(event.detail || "").trim(),
      tone: tones[type] || "#64748B",
      text: `${verb}${byLine}`,
    };
  });
}
