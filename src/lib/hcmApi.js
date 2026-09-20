import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import { isLocalPreviewActive, LOCAL_PREVIEW_COMPANY_ID } from "@/lib/localPreview";
import { localHcmCall } from "@/lib/localHcmFallback";
import { canFallBackForRead, isServiceOutage, refusalError } from "@/lib/serviceErrors";

function skipCloud(companyId) {
  return isLocalPreviewActive() || companyId === LOCAL_PREVIEW_COMPANY_ID;
}

const READ_ACTIONS = new Set(["list", "assignment", "objectiveBoard"]);

export async function hcmCall(payload = {}) {
  const companyId = payload.companyId;
  if (skipCloud(companyId)) return localHcmCall(payload);
  try {
    const res = await base44.functions.invoke("hcm", {
      ...payload,
      companyId,
      sessionToken: payload.sessionToken || getCompanyToken(companyId),
    });
    return res?.data ?? res;
  } catch (error) {
    // The register writes hires, transfers and terminations. A 401/403 there is the
    // gate refusing this account, not the service being down, so only an unreachable
    // service falls back — and only a read may fall back on a refusal.
    const reading = READ_ACTIONS.has(String(payload.action || ""));
    if (reading ? canFallBackForRead(error) : isServiceOutage(error)) return localHcmCall(payload);
    throw refusalError(error);
  }
}
