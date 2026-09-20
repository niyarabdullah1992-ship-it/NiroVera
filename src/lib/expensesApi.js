import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import { isLocalPreviewActive, LOCAL_PREVIEW_COMPANY_ID } from "@/lib/localPreview";
import { localExpensesCall } from "@/lib/localExpensesFallback";
import { canFallBackForRead, isServiceOutage, refusalError } from "@/lib/serviceErrors";

function skipCloud(session) {
  return isLocalPreviewActive() || session?.companyId === LOCAL_PREVIEW_COMPANY_ID;
}

// 401/403 is the server answering "no" with a named reason, not the server being
// down. Re-running a refused review or submit on the local ledger would carry out
// the very write the gate just refused, so only a truly unreachable service falls
// back — and only reading may fall back on an auth refusal. The rule is shared.
function cloudDown(error, action) {
  return action === "list" ? canFallBackForRead(error) : isServiceOutage(error);
}

export async function expensesCall(session, action, payload = {}) {
  if (skipCloud(session)) return localExpensesCall(session, action, payload);
  try {
    const response = await base44.functions.invoke("expenses", {
      action,
      companyId: session.companyId,
      sessionToken: session.token || getCompanyToken(session.companyId),
      ...payload,
    });
    return response.data;
  } catch (error) {
    if (cloudDown(error, action)) return localExpensesCall(session, action, payload);
    throw refusalError(error);
  }
}
