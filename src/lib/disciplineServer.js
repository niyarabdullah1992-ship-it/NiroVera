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
import { OUTBOX_PREFIX, dueStages, enqueueStage, readOutbox, settleStage, writeOutbox } from "@/lib/disciplineOutbox";

const storage = () => (typeof localStorage !== "undefined" ? localStorage : null);
const inFlight = new Set();
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

/** Sends every due pending stage for the company, oldest first. Safe to call on every tick. */
export async function flushDisciplineOutbox(companyId) {
  if (!companyId || isPreview(companyId) || inFlight.has(companyId)) return;
  const due = dueStages(readOutbox(storage(), companyId));
  if (!due.length) return;
  inFlight.add(companyId);
  try {
    for (const job of due) {
      const result = await send(companyId, job);
      const rejected = settle(companyId, job.jid, result);
      if (rejected && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("powercare:discipline-rejected", { detail: rejected }));
      }
      if (result.offline) break; // still offline — the rest wait for the next attempt
    }
  } finally {
    inFlight.delete(companyId);
  }
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
  const r = await send(companyId, { stage, caseRow, regulation });
  // The caller shows an immediate refusal itself; only later refusals use the event.
  settle(companyId, jid, r);
  return r;
}
