/**
 * The server copy of the sanction gates (base44/functions/compliance · action "disciplineSave").
 * The page checks the same gates first; the server re-checks and stores the file so a gate cannot be
 * skipped from a stale browser. Network failure is not a refusal — the local file stays and syncs.
 */
import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";

export async function saveDisciplineOnServer(companyId, stage, caseRow, regulation = null) {
  if (!companyId || !caseRow?.id) return { ok: false, skipped: true };
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
