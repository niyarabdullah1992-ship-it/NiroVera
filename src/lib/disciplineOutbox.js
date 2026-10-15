/**
 * Persistent outbox for sanction-file stage writes (compliance · disciplineSave).
 *
 * A stage the server has not yet confirmed (offline, timeout, 5xx, expired session) stays here, per
 * company, in localStorage. Every hydrated server copy of disciplinaryCases gets the pending stages laid
 * back on top, so a newer download never erases a hearing, signature, grievance or message the user
 * already recorded. An entry leaves the outbox only when the server stores it, or when the server's
 * gate refuses it with a named reason (the user is then told why — Arts. 66–72).
 *
 * Pure apart from the storage handle passed in (node-testable). The stage field lists mirror
 * base44/shared/syncLaw.ts so the local re-application matches what the server will store.
 */

const str = (v) => String(v ?? "");
export const OUTBOX_PREFIX = "powercare_discipline_outbox_";

/** Mirrors syncLaw.ts DISCIPLINE_STAGE_FIELDS. */
export const DISCIPLINE_STAGE_FIELDS = {
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

const STAGE_STATUS = { hearing: "hearing", sign: "notify", appeal: "appeal", withdraw: "notify", close: "closed" };
const itemKey = (m) => (m && typeof m === "object" ? str(m.id || m.hash || JSON.stringify(m)) : str(m));

/** Lays one pending stage onto a case row (same rules the server applies). */
export function applyStage(stage, row, incoming) {
  if (stage === "raise") return { ...(incoming || {}), ...(row || {}) };
  const fields = DISCIPLINE_STAGE_FIELDS[stage];
  if (!fields || !row) return row;
  const next = { ...row };
  for (const f of fields) {
    if (!incoming || !Object.prototype.hasOwnProperty.call(incoming, f)) continue;
    if (f === "messages" || f === "evidence") {
      const seen = new Set((row[f] || []).map(itemKey));
      next[f] = [...(row[f] || []), ...(incoming[f] || []).filter((m) => !seen.has(itemKey(m)))];
    } else if (f === "appealNote" && stage === "message") {
      next.appealNote = row.appealNote || incoming.appealNote || "";
    } else {
      next[f] = incoming[f];
    }
  }
  if (STAGE_STATUS[stage]) next.status = STAGE_STATUS[stage];
  if (stage === "ruling") next.status = incoming?.status === "closed" ? "closed" : "ruling";
  return next;
}

export function readOutbox(storage, companyId) {
  if (!storage || !companyId) return [];
  try {
    const list = JSON.parse(storage.getItem(OUTBOX_PREFIX + companyId) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function writeOutbox(storage, companyId, list) {
  if (!storage || !companyId) return;
  try {
    if (list.length) storage.setItem(OUTBOX_PREFIX + companyId, JSON.stringify(list));
    else storage.removeItem(OUTBOX_PREFIX + companyId);
  } catch {
    /* storage full / blocked — the in-flight call still carries the write */
  }
}

/** Adds (or replaces) a pending stage. The latest write of a stage for a case supersedes the older one. */
export function enqueueStage(list, job, now = Date.now()) {
  const key = `${job.caseRow?.id}:${job.stage}`;
  const rest = (list || []).filter((j) => j.key !== key);
  const jid = `${key}:${now}:${Math.random().toString(36).slice(2, 8)}`;
  return [...rest, { jid, key, stage: job.stage, caseRow: job.caseRow, regulation: job.regulation || null, queuedAt: now, tries: 0, nextAt: now }];
}

/**
 * The server's answer decides the entry's fate:
 *   ok                      → drop (stored)
 *   error with a reason     → drop, and report the refusal (a gate named its article)
 *   anything else           → keep, back off (offline, 5xx, session)
 */
export function settleStage(list, jid, result, now = Date.now()) {
  // Settled by the job's own id: an answer for an older write never drops the newer one that replaced it.
  const job = (list || []).find((j) => j.jid === jid);
  if (!job) return { list: list || [], rejected: null };
  if (result?.ok) return { list: list.filter((j) => j.jid !== jid), rejected: null };
  if (result?.error && result?.reason) {
    return { list: list.filter((j) => j.jid !== jid), rejected: { ...job, error: result.error, reason: result.reason, reasonEn: result.reasonEn || "" } };
  }
  const tries = (job.tries || 0) + 1;
  const nextAt = now + Math.min(300000, 5000 * 2 ** Math.min(tries, 6));
  return { list: list.map((j) => (j.jid === jid ? { ...j, tries, nextAt } : j)), rejected: null };
}

export function dueStages(list, now = Date.now()) {
  return (list || []).filter((j) => !j.nextAt || j.nextAt <= now);
}

/** Re-applies every pending stage, in the order it was recorded, on top of a hydrated server copy. */
export function applyPendingStages(cases, list) {
  let rows = Array.isArray(cases) ? [...cases] : [];
  for (const job of list || []) {
    const id = str(job.caseRow?.id);
    if (!id) continue;
    const i = rows.findIndex((r) => str(r?.id) === id);
    if (i < 0) {
      if (job.stage === "raise") rows = [job.caseRow, ...rows];
      continue;
    }
    rows[i] = applyStage(job.stage, rows[i], job.caseRow);
  }
  return rows;
}
