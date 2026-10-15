/**
 * Server-side merge rules for company data that reaches Base44 through the generic blob sync but must
 * not be trusted as a whole snapshot from the page:
 *
 *   • workRegulation  — لائحة تنظيم العمل (Law Arts. 12–13). Only senior HR saves or announces a version;
 *                       a re-save with a new `version` archives the old one in `versions` and resets the
 *                       acknowledgements. A worker's push can only add *their own* acknowledgement, stamped
 *                       by the server. An empty snapshot never erases an approved regulation.
 *   • disciplinaryCases — written only by compliance/disciplineSave (gates run there); each stage may change
 *                       only its own fields, on top of the server row.
 *   • abuseCases      — confidential (model regulation Art. 56(1)): readable by the filer, the members named
 *                       on that case's committee, and senior HR. Committee members may record the
 *                       investigation fields on their case only.
 *   • employerDuties  — per-employee training / medical-exam / held-document registers (Law Arts. 42–48,
 *                       143; Regs Art. 6). Records are never dropped by a stale snapshot.
 *
 * Pure (no imports) so node tests can load it directly.
 */

const str = (v: unknown) => String(v ?? "");
const hasClauses = (reg: any) => !!reg && typeof reg === "object" && !Array.isArray(reg) && Array.isArray(reg.clauses) && reg.clauses.length > 0;

/* ----------------------------- work regulation ----------------------------- */

export function regulationVersionOf(reg: any) {
  return str(reg?.version || reg?.savedAt || reg?.approvedAt).slice(0, 19);
}

/** A short history row for a superseded regulation version (kept as evidence, Art. 13). */
export function regulationVersionEntry(reg: any) {
  const acks = reg?.acks && typeof reg.acks === "object" ? reg.acks : {};
  return {
    version: regulationVersionOf(reg),
    approvalNo: str(reg?.approvalNo),
    approvedAt: str(reg?.approvedAt).slice(0, 10),
    announcedAt: str(reg?.announcedAt).slice(0, 10),
    savedAt: str(reg?.savedAt),
    savedBy: str(reg?.savedBy),
    clauses: Array.isArray(reg?.clauses) ? reg.clauses.length : 0,
    acks: Object.keys(acks).length,
  };
}

/**
 * Which regulation the sanction gates read. A stored server copy (with clauses) always wins; the page's
 * copy is used only when the server holds none yet. Returns { regulation, source }.
 */
export function pickDisciplineRegulation(serverPayload: any, pageCopy: any) {
  const server = Array.isArray(serverPayload) ? serverPayload[0] : serverPayload;
  if (hasClauses(server)) return { regulation: { ...server, source: "own" }, source: "server" };
  if (hasClauses(pageCopy)) return { regulation: { ...pageCopy, source: "own" }, source: "page" };
  return { regulation: null, source: "model" };
}

/**
 * Merge a pushed workRegulation snapshot onto the stored one.
 * Returns { payload, changed }. `payload` is what the server stores.
 */
export function mergeWorkRegulationWrite(existingRaw: any, incomingRaw: any, { senior = false, actorId = "", actorName = "", now = new Date().toISOString() }: { senior?: boolean; actorId?: string; actorName?: string; now?: string } = {}) {
  const existing = existingRaw && typeof existingRaw === "object" && !Array.isArray(existingRaw) ? existingRaw : {};
  const incoming = incomingRaw && typeof incomingRaw === "object" && !Array.isArray(incomingRaw) ? incomingRaw : {};
  const exAcks = existing.acks && typeof existing.acks === "object" ? existing.acks : {};
  const versions = Array.isArray(existing.versions) ? existing.versions : [];
  let next: any = existing;

  // A stale device's older version never rolls the stored regulation back.
  const stale = hasClauses(existing) && regulationVersionOf(incoming) < regulationVersionOf(existing);
  if (senior && hasClauses(incoming) && !stale) {
    const newVersion = hasClauses(existing) && regulationVersionOf(incoming) !== regulationVersionOf(existing);
    if (!hasClauses(existing) || newVersion) {
      // A new approved version: archive the old one, re-announce (Art. 13), collect fresh acknowledgements.
      const history = hasClauses(existing) ? [...versions, regulationVersionEntry(existing)] : versions;
      const { acks: _a, versions: _v, ...body } = incoming;
      next = { ...body, acks: {}, versions: history };
    } else {
      // Same version: senior may announce it (never un-announce); acknowledgements stay the server's.
      const { acks: _a, versions: _v, ...body } = incoming;
      next = {
        ...existing,
        ...body,
        announcedAt: existing.announcedAt || body.announcedAt || "",
        announcedBy: existing.announcedAt ? existing.announcedBy || "" : body.announcedBy || "",
        acks: exAcks,
        versions,
      };
    }
  }

  // Anyone (worker or senior) may add their OWN acknowledgement of the announced current version.
  const id = str(actorId);
  const mine = incoming.acks && typeof incoming.acks === "object" ? incoming.acks[id] : null;
  const curAcks = next.acks && typeof next.acks === "object" ? next.acks : {};
  if (id && mine && hasClauses(next) && str(next.announcedAt).slice(0, 10) && !curAcks[id]
    && str(mine.version || "").slice(0, 19) === regulationVersionOf(next)) {
    next = { ...next, acks: { ...curAcks, [id]: { at: now, version: regulationVersionOf(next), name: str(actorName || mine.name), stampedBy: "server" } } };
  }
  return { payload: next, changed: JSON.stringify(next) !== JSON.stringify(existing) };
}

/** Non-senior readers see the regulation and only their own acknowledgement. */
export function redactRegulationAcks(payload: any, userId: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const acks = payload.acks && typeof payload.acks === "object" ? payload.acks : {};
  const id = str(userId);
  return { ...payload, acks: id && acks[id] ? { [id]: acks[id] } : {} };
}

/* ----------------------------- abuse cases ----------------------------- */

export function abuseCommitteeIds(row: any): string[] {
  return (row?.committee?.members || []).map((m: any) => str(m?.id ?? m)).filter(Boolean);
}

/** Model regulation Art. 56(1): the filer, the members named on this case's committee, and senior HR. */
export function canReadAbuseCase(row: any, { userId, senior = false }: { userId?: unknown; senior?: boolean } = {}) {
  if (senior) return true;
  const id = str(userId);
  if (!id || !row) return false;
  if (str(row.reporterId || row.userId) === id) return true;
  return abuseCommitteeIds(row).includes(id);
}

/** Fields the committee writes while investigating (model Arts. 55–56). Never the parties or the committee. */
export const ABUSE_COMMITTEE_FIELDS = ["hearings", "separation", "outcome", "referral", "status", "log", "updatedAt", "closedAt"];

/**
 * A non-senior push to abuseCases: the filer may add a new case of their own; a committee member may
 * update the investigation fields of a case they sit on (membership read from the server copy). Every
 * other row stays exactly as stored, and nothing is deleted.
 */
export function mergeAbuseCasesWrite(priorRows: any[], incomingRows: any[], userId: unknown) {
  const id = str(userId);
  const prior = Array.isArray(priorRows) ? priorRows : [];
  const incoming = Array.isArray(incomingRows) ? incomingRows : [];
  const byId = new Map(incoming.filter((r) => r?.id).map((r) => [str(r.id), r]));
  const priorIds = new Set(prior.map((r) => str(r?.id)));
  const merged = prior.map((row) => {
    const next = byId.get(str(row?.id));
    if (!next || !id || !abuseCommitteeIds(row).includes(id)) return row;
    const patch: Record<string, unknown> = {};
    for (const f of ABUSE_COMMITTEE_FIELDS) if (Object.prototype.hasOwnProperty.call(next, f)) patch[f] = next[f];
    return { ...row, ...patch };
  });
  const added = incoming.filter((r) => r?.id && !priorIds.has(str(r.id)) && id && str(r.reporterId || r.userId) === id)
    .map((r) => ({ ...r, userId: id, reporterId: id, committee: null, hearings: [], separation: null, outcome: null, referral: null, status: "filed", confidential: true }));
  return [...added, ...merged];
}

/* ----------------------------- employer-duty registers ----------------------------- */

const LISTS = ["trainings", "medicalExams", "heldDocuments"];

function unionById(a: any[], b: any[]) {
  const out = new Map<string, any>();
  for (const r of Array.isArray(a) ? a : []) if (r?.id) out.set(str(r.id), r);
  for (const r of Array.isArray(b) ? b : []) {
    if (!r?.id) continue;
    const prev = out.get(str(r.id));
    // Register rows only gain fields (documentedAt, returnedAt…): keep every field either side holds.
    out.set(str(r.id), prev ? { ...prev, ...r } : r);
  }
  return [...out.values()];
}

/**
 * Per-employee duty rows. `canWrite(row)` decides whether this writer may touch an employee's row
 * (senior: all; HR with manage_employees: their scope). A record is never removed by a snapshot.
 */
export function mergeEmployerDutyRoster(priorRows: any[], incomingRows: any[], canWrite: (row: any) => boolean = () => true, stationOf: ((employeeId: string) => string | null | undefined) | null = null) {
  const prior = Array.isArray(priorRows) ? priorRows : [];
  const incoming = Array.isArray(incomingRows) ? incomingRows : [];
  const out = new Map<string, any>();
  for (const r of prior) if (r?.employeeId) out.set(str(r.employeeId), r);
  for (const r of incoming) {
    if (!r?.employeeId) continue;
    const key = str(r.employeeId);
    const before = out.get(key);
    // The employee's station comes from the Employee record when known — never from the pushed row.
    const station = stationOf ? (stationOf(key) ?? null) : (r.stationId ?? before?.stationId ?? null);
    if (!canWrite({ employeeId: key, stationId: station })) continue;
    const next: any = { ...(before || {}), id: key, employeeId: key, stationId: station };
    for (const list of LISTS) next[list] = unionById(before?.[list], r[list]);
    if (Object.prototype.hasOwnProperty.call(r, "occupationalExposure")) next.occupationalExposure = !!r.occupationalExposure;
    if (Object.prototype.hasOwnProperty.call(r, "exposureHazard")) next.exposureHazard = str(r.exposureHazard);
    out.set(key, next);
  }
  return [...out.values()];
}

/* ----------------------------- discipline stage writes ----------------------------- */

/** The fields each disciplineSave stage may set on top of the server row. `raise` creates the row. */
export const DISCIPLINE_STAGE_FIELDS: Record<string, string[]> = {
  hearing: ["status", "hearingEndedAt", "hearingAt", "notifiedAt", "hearingMode", "hearingMinutes"],
  sign: ["status", "decidedAt", "signedAt", "signedBy", "notifiedAt", "hearingEndedAt", "regulationNext", "fineAmount"],
  appeal: ["status", "appealNote", "appealedAt", "appealFile"],
  withdraw: ["status", "appealNote", "appealedAt", "appealFile"],
  ruling: ["status", "rulingOutcome", "rulingAt", "rulingBy", "rulingLabel", "rulingNote", "penaltyKind", "penalty", "cutDays", "fineAmount"],
  close: ["status", "rulingAt", "rulingBy", "rulingLabel", "rulingNote"],
  delivery: ["notifyMethod", "notifyDeliveredAt", "notifyRef", "notifyRecordedBy"],
  paper: ["signedPaper"],
  message: ["messages", "evidence", "appealNote"],
};

/** Stages a worker may send for their own file (Art. 72 grievance, and the case thread). */
export const DISCIPLINE_WORKER_STAGES = ["appeal", "withdraw", "message"];

/** Statuses a file may be closed from — the board offers «close» on a heard file (no sanction) or a signed one. */
export const DISCIPLINE_CLOSE_FROM = ["hearing", "decision", "notify"];
/** Art. 72 grievance rulings: uphold, lower to a written warning, or void — never a heavier penalty. */
export const DISCIPLINE_RULING_OUTCOMES = ["keep", "lower", "void"];
const DISCIPLINE_DELIVERY_METHOD_IDS = ["hand", "registered_mail", "email"];
const PENALTY_FIELDS = ["penaltyKind", "penalty", "penaltyAr", "penaltyEn", "penaltyId", "cutDays", "fineAmount", "deferMonths"];
const ALL_STAGE_FIELDS = [...new Set(Object.values(DISCIPLINE_STAGE_FIELDS).flat())];
const RAISE_KEEPS = ["penaltyKind", "penalty", "cutDays", "messages", "evidence"];
const dayOf = (v: unknown) => { const d = str(v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ""; };
const refuse = (error: string, reason: string, reasonEn: string) => ({ ok: false as const, error, reason, reasonEn });
const msgKey = (m: any) => (m && typeof m === "object" ? str(m.id || m.hash || JSON.stringify(m)) : str(m));

/**
 * Builds the row disciplineSave stores: the server row plus only this stage's fields from the page.
 * Messages/evidence only grow. A worker (non-manager) writes as themself: no evidence, and each new
 * message is stamped from:"employee" with the authenticated name and the server time.
 * Returns { ok, row } or a named refusal.
 */
export function planDisciplineStageWrite(stage: string, existing: any, incoming: any, opts: { worker?: boolean; actor?: { id?: string; name?: string }; now?: string; today?: string } = {}) {
  const s = str(stage);
  const now = opts.now || new Date().toISOString();
  const today = dayOf(opts.today) || now.slice(0, 10);
  const inc = incoming || {};
  if (s === "raise") {
    if (opts.worker) return refuse("FORBIDDEN", "ملفات الجزاء للإدارة.", "Sanction files are management-only.");
    if (existing && str(existing.status) && existing.status !== "notice") {
      return refuse("DISCIPLINE_CASE_EXISTS", "ملف الجزاء قائم وتجاوز مرحلة الإبلاغ — لا يُعاد فتحه (المادة 71).", "The sanction file already exists past the notice stage (Article 71).");
    }
    // A raise opens the notice only: no hearing, signature, grievance or ruling rides along (Art. 71).
    const body: any = { ...inc };
    // The proposed penalty (checked by the raise gate) and the opening note stay; everything later is stripped.
    for (const f of ALL_STAGE_FIELDS) if (!RAISE_KEEPS.includes(f)) delete body[f];
    const row: any = { ...(existing || {}), ...body, status: "notice", notifiedAt: existing?.notifiedAt || now };
    if (existing?.employeeId) row.employeeId = existing.employeeId;
    if (existing) { row.messages = existing.messages || []; row.evidence = existing.evidence || []; }
    return { ok: true, row };
  }
  const fields = DISCIPLINE_STAGE_FIELDS[s];
  if (!fields) return refuse("STAGE_REQUIRED", "حدّد المرحلة.", "Name the stage.");
  if (!existing) {
    return refuse("DISCIPLINE_CASE_MISSING", "لا ملف جزاء محفوظ بهذا الرقم — يُفتح الملف أولاً بالإبلاغ (المادة 71).", "No stored sanction file with this id — open it with the notice first (Article 71).");
  }
  if (opts.worker && !DISCIPLINE_WORKER_STAGES.includes(s)) return refuse("FORBIDDEN", "ملفات الجزاء للإدارة.", "Sanction files are management-only.");
  if (s === "withdraw" && existing.status !== "appeal") {
    return refuse("DISCIPLINE_NO_APPEAL", "لا تظلّم قائم لسحبه (المادة 72).", "There is no pending grievance to withdraw (Article 72).");
  }
  if (s === "close" && !DISCIPLINE_CLOSE_FROM.includes(str(existing.status))) {
    return refuse("DISCIPLINE_CLOSE_STAGE", "يُغلق الملف بعد سماع الدفاع (بلا جزاء) أو بعد توقيع القرار — لا قبل ذلك، ولا أثناء تظلّم قائم (المادتان 71–72).", "A file closes after the defence is heard (no sanction) or after signing — not earlier, nor during a pending grievance (Arts. 71–72).");
  }
  if (s === "ruling") {
    if (existing.status !== "appeal") return refuse("DISCIPLINE_RULING_STAGE", "يُبتّ في التظلّم القائم فقط (المادة 72).", "Only a pending grievance is ruled on (Article 72).");
    if (!DISCIPLINE_RULING_OUTCOMES.includes(str(inc.rulingOutcome))) {
      return refuse("DISCIPLINE_RULING_OUTCOME", "نتيجة التظلّم: تثبيت الجزاء، أو تخفيفه إلى إنذار، أو إلغاؤه — ولا يُشدَّد على المتظلّم (المادة 72).", "A grievance ruling upholds, lowers to a warning, or voids — never a heavier penalty (Article 72).");
    }
  }
  if ((s === "delivery" || s === "paper") && !dayOf(existing.signedAt || existing.decidedAt)) {
    return refuse("DISCIPLINE_NOT_SIGNED", "لا يُسجَّل إبلاغ القرار أو نسخته الموقّعة قبل توقيعه (المادة 72 · النموذج م68).", "The decision's delivery or signed copy is recorded only after signing (Art. 72 · model Art. 68).");
  }
  if (s === "delivery") {
    const when = dayOf(inc.notifyDeliveredAt);
    if (!DISCIPLINE_DELIVERY_METHOD_IDS.includes(str(inc.notifyMethod))) {
      return refuse("DISCIPLINE_DELIVERY_METHOD", "اختر طريقة إبلاغ القرار: يداً بيد، أو بريد مسجّل، أو بريد إلكتروني ثابت في الملف (المادة 72 · النموذج م68).", "Pick how the decision was delivered (Art. 72 · model Art. 68).");
    }
    if (!when || when > today || when < dayOf(existing.signedAt || existing.decidedAt)) {
      return refuse("DISCIPLINE_DELIVERY_DATE", "تاريخ الإبلاغ يقع بين تاريخ توقيع القرار واليوم.", "The delivery date falls between the signing date and today.");
    }
    if (inc.notifyMethod === "registered_mail" && !str(inc.notifyRef).trim()) {
      return refuse("DISCIPLINE_DELIVERY_REF", "اكتب رقم الإرسال المسجّل.", "Enter the registered-mail tracking number.");
    }
  }
  const row: any = { ...existing };
  for (const f of fields) {
    if (!Object.prototype.hasOwnProperty.call(inc, f)) continue;
    if (f === "evidence" && opts.worker) continue;
    if (f === "messages" || f === "evidence") {
      const seen = new Set((existing[f] || []).map(msgKey));
      let add = (inc[f] || []).filter((m: any) => !seen.has(msgKey(m)));
      if (f === "messages" && opts.worker) {
        add = add.map((m: any) => ({ ...(m && typeof m === "object" ? m : { text: str(m) }), from: "employee", senderName: str(opts.actor?.name), senderId: str(opts.actor?.id), createdAt: now }));
      }
      row[f] = [...(existing[f] || []), ...add];
    } else if (f === "appealNote" && s === "message") {
      row.appealNote = existing.appealNote || inc.appealNote || "";
    } else {
      row[f] = inc[f];
    }
  }
  if (s === "ruling") {
    const outcome = str(inc.rulingOutcome);
    for (const f of PENALTY_FIELDS) row[f] = existing[f];
    if (outcome === "lower") {
      // Lowered to a written warning with no fine — the only lighter step the board offers.
      Object.assign(row, { penaltyKind: "warning", penalty: str(inc.penalty) || existing.penalty, cutDays: 0, fineAmount: 0 });
    }
    row.rulingOutcome = outcome;
  }
  // The stage, not the page, decides where the file now stands.
  const status: Record<string, string> = { hearing: "hearing", sign: "notify", appeal: "appeal", withdraw: "notify", close: "closed" };
  if (status[s]) row.status = status[s];
  if (s === "ruling") row.status = str(inc.rulingOutcome) === "void" ? "closed" : "ruling";
  return { ok: true, row };
}
