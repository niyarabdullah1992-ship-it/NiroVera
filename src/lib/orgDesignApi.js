/**
 * Org design reads from the server — for people who cannot read orgSeats (senior-only):
 * the employee's own place and a manager's subtree, derived and gated in base44/functions/org.
 * Preview and an unreachable service fall back to the local derivation (null here).
 */
import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import { isLocalPreviewActive, LOCAL_PREVIEW_COMPANY_ID } from "@/lib/localPreview";

function skipCloud(companyId) {
  return !companyId || isLocalPreviewActive() || companyId === LOCAL_PREVIEW_COMPANY_ID;
}

export async function fetchOrgPlace(companyId, action = "myPlace", extra = {}) {
  if (skipCloud(companyId)) return null;
  try {
    const res = await base44.functions.invoke("org", {
      action,
      companyId,
      sessionToken: getCompanyToken(companyId),
      ...extra,
    });
    const body = res?.data ?? res;
    return body?.ok ? body : null;
  } catch {
    return null;
  }
}
