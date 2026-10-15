/**
 * The server copy of the sanction gates (base44/functions/compliance · action "disciplineSave").
 * Sanction files never travel through the generic background sync (canonicalStore NOT_PUSHED_AS_IS):
 * every stage reaches the server here, where the gates run on the server row before it is stored.
 * The page checks the same gates first.
 *
 * Each stage is written to a persistent per-company outbox (disciplineOutbox.js) before it is sent, and
 * stays there until the server stores it or a gate refuses it with a reason. Pending stages are laid back
 * on top of every hydrated server copy (store.cacheCloudData), and retried on reconnect and on each
 * session refresh. A late refusal is announced with the event "powercare:discipline-rejected".
 * The local preview has no backend: nothing is queued or sent.
 */
import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import { LOCAL_PREVIEW_COMPANY_ID, isLocalPreviewActive } from "@/lib/localPreview";
import { OUTBOX_PREFIX, caseIdOf, dueStages, enqueueStage, readOutbox, settleStage, stagesForCase, writeOutbox } from "@/lib/disciplineOutbox";

const storage = () => (typeof localStorage !== "undefined" ? localStorage : null);
const isPreview = (companyId) => companyId === LOCAL_PREVIEW_COMPANY_ID || isLocalPreviewActive();

async function send(companyId, { stage, caseRow, regulation }) {
  try {
    const res = await base44.functions.invoke("compliance", {
      action: "disciplineSave",
      companyId,
      sessionToken: getCompanyToken(companyId),
      stage,
      caseRow,
      regulation: regulation?.source === "own" ? regulation : null,
    });
    const payload = res?.data || res;
    if (payload?.error) return { ok: false, error: payload.error, reason: payload.reason, reasonEn: payload.reasonEn };
    return { ok: true };
  } catch (err) {
    const data = err?.response?.data;
    if (data?.error && data?.reason) return { ok: false, error: data.error, reason: data.reason, reasonEn: data.reasonEn };
    return { ok: false, offline: true };
  }
}

/** Settles one outbox entry against the server's answer; returns the refusal if the gate said no. */
function settle(companyId, jid, result) {
  const { list, rejected } = settleStage(readOutbox(storage(), companyId), jid, result);
  writeOutbox(storage(), companyId, list);
  return rejected;
}

const caseChains = new Map(); // `${companyId}:${caseId}` → promise: one case's stages go out one at a time
const inFlightJids = new Set();

/**
 * Sends one case's pending stages oldest-first, stopping at the first that does not settle (offline,
 * backoff, transient error) so a later stage never overtakes an earlier one. `callerJid` is the stage the
 * page just recorded: the whole case is tried now, and that stage's answer is returned to the page (which
 * shows it); refusals of other stages are announced with "powercare:discipline-rejected".
 */
function runCase(companyId, caseId, callerJid = "") {
  const lock = `${companyId}:${caseId}`;
  const prev = caseChains.get(lock) || Promise.resolve();
  const run = prev.catch(() => {}).then(async () => {
    let callerResult = null;
    for (const job of stagesForCase(readOutbox(storage(), companyId), caseId)) {
      if (inFlightJids.has(job.jid)) break;
      if (!callerJid && job.nextAt && job.nextAt > Date.now()) break;
      inFlightJids.add(job.jid);
      let result;
      try {
        result = await send(companyId, job);
      } finally {
        inFlightJids.delete(job.jid);
      }
      const rejected = settle(companyId, job.jid, result);
      // A stage not yet settled (e.g. waiting behind its raise) reads as queued, not as a refusal.
      if (job.jid === callerJid) callerResult = !result.ok && !rejected ? { ok: false, offline: true, queued: true } : result;
      else if (rejected && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("powercare:discipline-rejected", { detail: rejected }));
      }
      if (!result.ok && !rejected) break; // not settled — later stages of this case wait behind it
    }
    return callerResult;
  });
  caseChains.set(lock, run);
  run.finally(() => { if (caseChains.get(lock) === run) caseChains.delete(lock); });
  return run;
}

/** Sends every due pending stage for the company, case by case, oldest first. Safe to call on every tick. */
export async function flushDisciplineOutbox(companyId) {
  if (!companyId || isPreview(companyId)) return;
  const list = readOutbox(storage(), companyId);
  const cases = [...new Set(dueStages(list).map(caseIdOf).filter(Boolean))];
  await Promise.all(cases.map((caseId) => runCase(companyId, caseId)));
}

export function pendingDisciplineStages(companyId) {
  return readOutbox(storage(), companyId);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i) || "";
        if (k.startsWith(OUTBOX_PREFIX)) flushDisciplineOutbox(k.slice(OUTBOX_PREFIX.length));
      }
    } catch {
      /* storage blocked */
    }
  });
}

export async function saveDisciplineOnServer(companyId, stage, caseRow, regulation = null) {
  if (!companyId || !caseRow?.id) return { ok: false, skipped: true };
  if (isPreview(companyId)) return { ok: true, local: true };
  const queued = enqueueStage(readOutbox(storage(), companyId), { stage, caseRow, regulation });
  writeOutbox(storage(), companyId, queued);
  const { jid } = queued[queued.length - 1];
  // Earlier stages of this case still queued go first; this one waits its turn.
  const r = await runCase(companyId, String(caseRow.id), jid);
  return r || { ok: false, offline: true, queued: true };
}
