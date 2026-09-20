/** Work Proof chain — capture → supervisor approve → seal → client accept.
 *  Design: NiroVera Platform.dc.html (workproof / seal / selfBlock / geoBlock).
 */
import {
  HEAT_BAN_STATE_LEVEL,
  heatBanClockState,
  heatBanWindow,
  isHeatBanDate,
  isHeatBanMinuteOfDay,
} from "./contractLawDerivations.ts";
import { heatBanDecisionLabel } from "./heatBanDecision.ts";
import { citeRule, explainRule } from "./laborRules.ts";
import { isoDayKey, normalizeTaskMode, riyadhClock, taskModeLabel, type TaskMode } from "./opsDerivations.ts";

export type GeoVerdict = "in" | "out";

export type WorkProofLike = {
  id?: string;
  ref: string;
  title?: string;
  entityName?: string;
  entityScope?: "internal" | "external" | string | null;
  entityStationId?: string | null;
  entityKind?: string | null;
  people?: Array<{
    name?: string;
    phone?: string;
    id?: string;
    title?: string;
    employeeId?: string;
    homeStationId?: string;
    visitor?: boolean;
  }>;
  vehicles?: Array<Record<string, string | undefined>>;
  personName?: string | null;
  client?: string;
  stationId?: string;
  /** Where the crew's hands were — stated at raise, never inferred from the station. */
  place?: TaskMode | string | null;
  startedAt?: string | null;
  techId?: string | null;
  raiserId?: string | null;
  raiserName?: string | null;
  beforeStamp?: string | null;
  afterStamp?: string | null;
  geoVerdict?: GeoVerdict | string | null;
  geoCleared?: boolean;
  geoClearReason?: string | null;
  status?: string | null; // await | ready | sealed | accepted | rejected
  approvedBy?: string | null;
  approvedAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  sealId?: string | null;
  archived?: boolean;
  archivedAt?: string | null;
  createdAt?: string | null;
  endedAt?: string | null;
  endedById?: string | null;
  endedBy?: string | null;
  editedAt?: string | null;
  editedBy?: string | null;
  editedById?: string | null;
  auditTrail?: Array<{
    id?: string;
    type?: string;
    at?: string;
    actorId?: string | null;
    actorName?: string | null;
    detail?: string;
  }>;
  attachments?: Array<{ id?: string; url?: string; name?: string; type?: string }>;
  /** Named breach stamped at end/seal — kept on the record so closing cannot drop it. */
  heatBanFlag?: ProofHeatBanFlag | null;
};

export type ProofHeatBanFlag = {
  id: "heat_ban";
  level: "block";
  ruleId: string;
  labelAr: string;
  labelEn: string;
  cite: ReturnType<typeof citeRule>;
  window: ReturnType<typeof heatBanWindow>;
  minutes: number;
  textAr: string;
  textEn: string;
};

function fnv1a(str: string) {
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
export function normalizeProofPlace(value: unknown) {
  return normalizeTaskMode(value);
}

export function proofPlaceLabel(value: unknown, lang: "ar" | "en" = "ar") {
  return taskModeLabel(value, lang);
}

export function checkProofPlaceGate(value: unknown, lang: "ar" | "en" = "ar") {
  const place = normalizeProofPlace(value);
  if (place) return { ok: true as const, place };
  return {
    ok: false as const,
    error: "PROOF_PLACE_REQUIRED",
    reason: "حدّد مكان التنفيذ: حضوري داخل المنشأة، أو ميداني في الهواء الطلق، أو عن بُعد. منه يُعرف سريان حظر العمل تحت أشعة الشمس.",
    reasonEn: "State where the work happens: on-site indoors, field in the open air, or remote. It decides whether the sun ban applies.",
    lang,
  };
}

export function isOutdoorProof(proof: WorkProofLike | null | undefined) {
  return normalizeProofPlace(proof?.place) === "field";
}

/**
 * Starting open-air work inside the banned hours is refused — the refusal comes
 * before the breach, while it can still be avoided.
 */
export function checkProofHeatBanGate(
  { place, now = new Date() }: { place?: unknown; now?: Date | string | number } = {},
) {
  if (normalizeProofPlace(place) !== "field") return { ok: true as const, skipped: "not_outdoor" as const };
  const clock = riyadhClock(now);
  if (!clock) return { ok: true as const, skipped: "no_clock" as const };
  if (!isHeatBanDate(clock.dayKey)) return { ok: true as const, skipped: "off_season" as const };
  if (!isHeatBanMinuteOfDay(clock.minutes, clock.dayKey)) return { ok: true as const, skipped: "off_window" as const };
  const win = heatBanWindow(clock.dayKey);
  const badge = explainRule("hours.heat.startHour", clock.dayKey);
  // The hours are decision 3337's; the cited article is only the basis it was issued on.
  const cite = citeRule("hours.heat.cite", clock.dayKey);
  return {
    ok: false as const,
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
export function proofHeatBanMinutes(proof: WorkProofLike | null | undefined) {
  if (!isOutdoorProof(proof)) return 0;
  const from = riyadhClock(proof?.startedAt || "");
  const to = riyadhClock(proof?.endedAt || "");
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
export function deriveProofHeatBanFlag(proof: WorkProofLike | null | undefined): ProofHeatBanFlag | null {
  const minutes = proofHeatBanMinutes(proof);
  if (minutes < 1) return null;
  const day = riyadhClock(proof?.startedAt || "")?.dayKey;
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
export function deriveProofHeatBanNotice(
  { place, now = new Date() }: { place?: unknown; now?: Date | string | number } = {},
) {
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

/** Seal covers ref + both stamps + location verdict — altering any invalidates it. */
export function sealIdFor(proof: {
  ref: string;
  beforeStamp?: string | null;
  afterStamp?: string | null;
  geoVerdict?: string | null;
}) {
  const geo: GeoVerdict = String(proof.geoVerdict || "in").toLowerCase().startsWith("out") ? "out" : "in";
  const src = `${proof.ref}|${proof.beforeStamp || ""}|${proof.afterStamp || ""}|${geo}`;
  const h = fnv1a(src);
  const tail = (h % 1679616).toString(36).toUpperCase().padStart(4, "0");
  const refDigits = String(proof.ref || "").replace(/\D/g, "").slice(-4) || "0000";
  return `NV-WP-${refDigits}-${tail}`;
}

export function hasAfterCapture(proof: WorkProofLike) {
  const after = String(proof.afterStamp || "").trim();
  return !!after && after !== "—";
}

export function isOutsideGeofence(proof: WorkProofLike) {
  const v = String(proof.geoVerdict || "in").toLowerCase();
  return v === "out" || v.includes("outside") || v.includes("خارج");
}

/** Derive stage from record fields — never a free-form literal alone. */
export function deriveProofStage(proof: WorkProofLike): "await" | "ready" | "sealed" | "accepted" | "rejected" {
  if (proof.status === "rejected") return "rejected";
  if (proof.status === "accepted" || proof.acceptedAt) return "accepted";
  if (proof.status === "sealed" || proof.sealId || proof.approvedAt) return "sealed";
  if (!hasAfterCapture(proof)) return "await";
  return "ready";
}

/** Sealed / accepted / rejected leave the live board — same rule as ops done and visitor "left". */
export function isWorkProofArchived(proof?: WorkProofLike | null) {
  if (!proof) return false;
  const stage = deriveProofStage(proof);
  return stage === "sealed" || stage === "accepted" || stage === "rejected";
}

export function applyWorkProofArchive(proof?: WorkProofLike | null, at?: string | null) {
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

export function workProofArchiveDate(proof?: WorkProofLike | null) {
  return proof?.archivedAt
    || proof?.endedAt
    || proof?.approvedAt
    || proof?.acceptedAt
    || proof?.rejectedAt
    || proof?.createdAt
    || (proof as { startedAt?: string | null })?.startedAt
    || null;
}

export function deriveProofCounts(proofs: WorkProofLike[]) {
  const list = Array.isArray(proofs) ? proofs : [];
  const counts = { total: list.length, await: 0, ready: 0, sealed: 0, accepted: 0, rejected: 0, live: 0, archived: 0 };
  for (const p of list) {
    const st = deriveProofStage(p);
    counts[st] += 1;
    if (isWorkProofArchived(p)) counts.archived += 1;
    else counts.live += 1;
  }
  return counts;
}

export function isSameProofBranch(actorStationId?: string | null, proofStationId?: string | null) {
  return !!(actorStationId && proofStationId && String(actorStationId) === String(proofStationId));
}

export function isProofCrewMember(proof: WorkProofLike | null | undefined, actorUserId?: string | null) {
  const id = String(actorUserId || "").trim();
  if (!id || !proof) return false;
  return (Array.isArray(proof.people) ? proof.people : []).some(
    (person) => String(person?.employeeId || "").trim() === id,
  );
}

function actorMayMutateProof(input: {
  proof: WorkProofLike | null | undefined;
  actorUserId?: string | null;
  sameBranch?: boolean;
  isManager?: boolean;
}) {
  const isRaiser = input.actorUserId && input.proof?.raiserId && String(input.actorUserId) === String(input.proof.raiserId);
  const onCrew = isProofCrewMember(input.proof, input.actorUserId);
  return !!(isRaiser || input.sameBranch || input.isManager || onCrew);
}

export function checkEndWorkProofGate(input: {
  proof: WorkProofLike | null | undefined;
  actorUserId?: string | null;
  sameBranch?: boolean;
  isManager?: boolean;
}) {
  const proof = input.proof;
  if (!proof) {
    return { ok: false as const, error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود.", reasonEn: "Proof not found." };
  }
  if (deriveProofStage(proof) !== "await") {
    return { ok: false as const, error: "NOT_IN_PROGRESS", reason: "هذا الإثبات ليس بانتظار الإنهاء.", reasonEn: "This proof is not waiting to be ended." };
  }
  if (!actorMayMutateProof(input)) {
    return {
      ok: false as const,
      error: "CREW_OR_BRANCH_REQUIRED",
      reason: "إنهاء العمل لمن رفعه أو لمن في الطاقم أو لموظف في فرع التنفيذ.",
      reasonEn: "Only the raiser, a listed crew member, or someone at the executing branch can end the work.",
    };
  }
  return { ok: true as const, autoApprove: true };
}

/** Ending with an after photo is the approval act — always seal. */
export function shouldSealOnEnd() {
  return true;
}

export const WORK_PROOF_EDIT_MS = 24 * 60 * 60 * 1000;

export function proofEditDeadline(proof: WorkProofLike | null | undefined) {
  const created = new Date(proof?.createdAt || 0).getTime();
  if (!Number.isFinite(created) || created <= 0) return null;
  return created + WORK_PROOF_EDIT_MS;
}

export function checkEditWorkProofGate(input: {
  proof: WorkProofLike | null | undefined;
  actorUserId?: string | null;
  sameBranch?: boolean;
  isManager?: boolean;
  now?: number;
}) {
  const proof = input.proof;
  if (!proof) {
    return { ok: false as const, error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود.", reasonEn: "Proof not found." };
  }
  const stage = deriveProofStage(proof);
  if (stage === "sealed" || stage === "accepted" || stage === "rejected") {
    return {
      ok: false as const,
      error: "LOCKED_AFTER_SEAL",
      reason: "بعد الختم أو الرفض لا يُعدَّل الإثبات.",
      reasonEn: "A sealed, accepted, or rejected proof cannot be edited.",
    };
  }
  const now = input.now ?? Date.now();
  const deadline = proofEditDeadline(proof);
  if (!deadline || now > deadline) {
    return {
      ok: false as const,
      error: "EDIT_WINDOW_CLOSED",
      reason: "انتهت مهلة التعديل — يوم واحد من الرفع.",
      reasonEn: "The one-day edit window from raise time has closed.",
    };
  }
  if (!actorMayMutateProof(input)) {
    return {
      ok: false as const,
      error: "CREW_OR_BRANCH_REQUIRED",
      reason: "التعديل لمن رفعه أو لمن في الطاقم أو لموظف في فرع التنفيذ.",
      reasonEn: "Only the raiser, a listed crew member, or someone at the executing branch can edit.",
    };
  }
  return { ok: true as const, until: new Date(deadline).toISOString() };
}

/** Approve the ending → seal. Named gates only. The raiser cannot approve. */
export function checkApproveWorkProofGate(input: {
  proof: WorkProofLike | null | undefined;
  actorUserId?: string | null;
  geoClearReason?: string | null;
}) {
  const proof = input.proof;
  if (!proof) {
    return { ok: false as const, error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود في نطاق الشركة.", reasonEn: "Proof not found in this company." };
  }
  const stage = deriveProofStage(proof);
  if (stage === "rejected") {
    return { ok: false as const, error: "PROOF_REJECTED", reason: "الإثبات مرفوض — يلزم إعادة التصوير.", reasonEn: "Proof was rejected — re-capture is required." };
  }
  if (stage !== "ready") {
    return {
      ok: false as const,
      error: stage === "await" ? "AFTER_PHOTO_REQUIRED" : "NOT_AWAITING_APPROVAL",
      reason: stage === "await" ? "لا اعتماد قبل إنهاء العمل وصورة البعد." : "الإثبات ليس بانتظار اعتماد الإنهاء.",
      reasonEn: stage === "await" ? "Cannot approve before the work is ended with an after photo." : "Proof is not awaiting end approval.",
    };
  }
  const alreadyEnded = hasAfterCapture(proof) && (proof.endedAt || proof.endedById);
  if (input.actorUserId && proof.raiserId && String(input.actorUserId) === String(proof.raiserId) && !alreadyEnded) {
    return {
      ok: false as const,
      error: "SELF_APPROVE_FORBIDDEN",
      reason: "من رفع الإثبات لا يعتمده قبل إنهائه بصورة البعد.",
      reasonEn: "The raiser cannot approve before ending the work with an after photo.",
    };
  }
  if (isOutsideGeofence(proof) && !proof.geoCleared) {
    const reason = String(input.geoClearReason || "").trim();
    if (!reason) {
      return {
        ok: false as const,
        error: "GEO_CLEARANCE_REQUIRED",
        reason: "التقاط خارج النطاق يوقف عند الاعتماد — اقبل بسبب مكتوب أو ارفض.",
        reasonEn: "Out-of-geofence capture stops at approval — accept with a written reason or reject.",
      };
    }
  }
  return { ok: true as const, sealId: sealIdFor(proof) };
}

export function checkAcceptGate(proof: WorkProofLike | null | undefined) {
  if (!proof) {
    return { ok: false as const, error: "PROOF_NOT_FOUND", reason: "الإثبات غير موجود.", reasonEn: "Proof not found." };
  }
  const stage = deriveProofStage(proof);
  if (stage !== "sealed") {
    return {
      ok: false as const,
      error: "NOT_SEALED",
      reason: "لا استلام من العميل قبل ختم المشرف.",
      reasonEn: "Client cannot accept before the supervisor seal.",
    };
  }
  const expected = sealIdFor(proof);
  if (proof.sealId && proof.sealId !== expected) {
    return {
      ok: false as const,
      error: "SEAL_INVALID",
      reason: "الختم باطل — تغيّر مرجع أو طوابع أو حكم الموقع.",
      reasonEn: "Seal is invalid — ref, stamps, or location verdict changed.",
    };
  }
  return { ok: true as const, sealId: expected };
}

function formatProofAuditWhen(iso?: string | null) {
  const raw = String(iso || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 16).replace("T", " ");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function appendWorkProofAudit(
  proof: WorkProofLike | null | undefined,
  type: string,
  actor: { id?: string | null; userId?: string | null; name?: string | null } = {},
  extra: { id?: string; at?: string; actorName?: string; detail?: string } = {},
) {
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

function derivedWorkProofAudit(proof: WorkProofLike) {
  const events: NonNullable<WorkProofLike["auditTrail"]> = [];
  if (proof.createdAt || proof.raiserName || proof.raiserId) {
    events.push({
      type: "raise",
      at: proof.createdAt || null,
      actorId: proof.raiserId || null,
      actorName: proof.raiserName || "",
    });
  }
  if ((proof as { editedAt?: string }).editedAt || (proof as { editedBy?: string }).editedBy) {
    events.push({
      type: "edit",
      at: (proof as { editedAt?: string }).editedAt || "",
      actorId: (proof as { editedById?: string }).editedById || null,
      actorName: (proof as { editedBy?: string }).editedBy || "",
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
      at: (proof as { rejectedAt?: string }).rejectedAt || "",
      actorId: (proof as { rejectedById?: string }).rejectedById || null,
      actorName: (proof as { rejectedBy?: string }).rejectedBy || "",
      detail: (proof as { rejectReason?: string }).rejectReason || "",
    });
  }
  return events;
}

export function buildWorkProofAuditTimeline(proof: WorkProofLike | null | undefined, lang = "ar") {
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
  const labels: Record<string, string> = {
    raise: ar ? "أُنشئ الإثبات" : "Proof created",
    create: ar ? "أُنشئ الإثبات" : "Proof created",
    edit: ar ? "عُدّل الإثبات" : "Proof edited",
    end: ar ? "أُغلق الإثبات" : "Proof closed",
    seal: ar ? "أُغلق الإثبات" : "Proof closed",
    reject: ar ? "رُفض الإثبات" : "Proof rejected",
    attach: ar ? "أُرفق مستند" : "Document attached",
    heat_ban: ar ? "قُيّدت مخالفة حظر العمل تحت أشعة الشمس" : "Sun-ban breach recorded",
  };
  const tones: Record<string, string> = {
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
    const by = String(event.actorName || "").trim();
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
