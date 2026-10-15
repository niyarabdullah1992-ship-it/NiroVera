/**
 * The server copy of the sanction gates (base44/functions/compliance · action "disciplineSave").
 * Sanction files never travel through the generic background sync (canonicalStore NOT_PUSHED_AS_IS):
 * every stage reaches the server here, where the gates run on the server row before it is stored.
 * The page checks the same gates first. Network failure is not a refusal — the local file stays and the
 * write is retried when the connection returns. The local preview has no backend: nothing is sent.
 */
import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import { LOCAL_PREVIEW_COMPANY_ID, isLocalPreviewActive } from "@/lib/localPreview";

const pending = new Map();
let retryTimer = null;

function scheduleRetry(delay = 15000) {
  if (retryTimer || !pending.size) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    flushDisciplineQueue();
  }, delay);
}

export function flushDisciplineQueue() {
  const jobs = [...pending.values()];
  pending.clear();
  jobs.forEach((job) => {
    job.tries += 1;
    send(job).then((r) => {
      if (r.offline && job.tries < 8) {
        pending.set(job.key, job);
        scheduleRetry(Math.min(120000, 15000 * job.tries));
      }
    });
  });
}

if (typeof window !== "undefined") window.addEventListener("online", flushDisciplineQueue);

async function send({ companyId, stage, caseRow, regulation }) {
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

export async function saveDisciplineOnServer(companyId, stage, caseRow, regulation = null) {
  if (!companyId || !caseRow?.id) return { ok: false, skipped: true };
  if (companyId === LOCAL_PREVIEW_COMPANY_ID || isLocalPreviewActive()) return { ok: true, local: true };
  const job = { key: `${companyId}:${caseRow.id}:${stage}`, companyId, stage, caseRow, regulation, tries: 0 };
  const r = await send(job);
  if (r.offline) {
    pending.set(job.key, job);
    scheduleRetry();
  }
  return r;
}
