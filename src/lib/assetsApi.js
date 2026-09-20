import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import { isLocalPreviewActive, LOCAL_PREVIEW_COMPANY_ID } from "@/lib/localPreview";
import { localAssetsCall } from "@/lib/localAssetsFallback";
import { canFallBackForRead, isServiceOutage, refusalError } from "@/lib/serviceErrors";

function skipCloud(session) {
  return isLocalPreviewActive() || session?.companyId === LOCAL_PREVIEW_COMPANY_ID;
}

// 401/403 is the server answering "no", not the server being down. Falling back to
// the local ledger there would re-run a refused write without any guard. The rule
// itself is shared — every api layer asks `serviceErrors` the same question.
function cloudDown(error, action) {
  return action === "list" ? canFallBackForRead(error) : isServiceOutage(error);
}

export async function assetsCall(session, action, payload = {}) {
  if (skipCloud(session)) return localAssetsCall(session, action, payload);
  try {
    const sessionToken = session.token || getCompanyToken(session.companyId);
    const res = await base44.functions.invoke("assets", {
      action,
      companyId: session.companyId,
      sessionToken,
      ...payload,
    });
    return res.data;
  } catch (error) {
    if (cloudDown(error, action)) return localAssetsCall(session, action, payload);
    throw refusalError(error);
  }
}

export const ASSET_STATUSES = ["available", "in_custody", "inspection", "maintenance", "lost", "retired"];

export const assetStatusLabel = (status, lang) => {
  const ar = { available: "متاح", in_custody: "في العهدة", inspection: "قيد الفحص", maintenance: "تحت الصيانة", lost: "مفقود", retired: "مستبعد" };
  const en = { available: "Available", in_custody: "In custody", inspection: "Inspection", maintenance: "Maintenance", lost: "Lost", retired: "Retired" };
  return (lang === "ar" ? ar : en)[status] || status;
};
