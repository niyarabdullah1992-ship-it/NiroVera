import { isLocalPreviewActive, LOCAL_PREVIEW_COMPANY_ID } from "@/lib/localPreview";
import {
  forceLocalInventory,
  isForcedLocalInventory,
  localInventoryCall,
} from "@/lib/localInventoryFallback";

const pendingLists = new Map();

/**
 * The board could not be read, so nothing is claimed on its behalf. Every right used
 * to default to `true` here, which meant a failed read handed the screen full purchase,
 * issue, archive and reversal rights — the loudest possible way for a fallback to be
 * more permissive than the layer it stands in for.
 */
function emptyList(session) {
  try {
    return localInventoryCall(session, "list", {});
  } catch {
    return {
      items: [],
      requestItems: [],
      historyItems: [],
      movements: [],
      purchases: [],
      procurementRequests: [],
      purchaseOrders: [],
      requests: [],
      stations: [],
      locations: [],
      transferStations: [],
      employees: [],
      canManage: false,
      canPurchase: false,
      canCreateItem: false,
      canIssueToWork: false,
      canIssueFromAnyStation: false,
      canRequest: false,
      canReviewRequests: false,
      canReviewAllRequests: false,
      canDelete: false,
      canApproveProcurement: false,
      canReceiveProcurement: false,
      canViewAllPurchases: false,
      canWarehouseManage: false,
      canTransfer: false,
      canSetCentralWarehouse: false,
      canReverse: false,
      centralWarehouseId: null,
    };
  }
}

/**
 * One inventory adapter. Preview is forced-local (`inventoryItems` in the company cache).
 * Sole qty home: inventoryItems[].locationBalances (facts inventory.qty).
 * InventoryUnit is retired do-not-write. Do not add a parallel stockBoard reader.
 */
export async function inventoryCall(session, action, payload = {}) {
  forceLocalInventory(session?.companyId);
  if (action !== "list") {
    return localInventoryCall(session, action, payload);
  }

  const key = `${session?.companyId || "none"}:local`;
  if (pendingLists.has(key)) return pendingLists.get(key);
  const pending = Promise.resolve().then(() => {
    try {
      return localInventoryCall(session, action, payload);
    } catch {
      return emptyList(session);
    }
  });
  pendingLists.set(key, pending);
  try {
    return await pending;
  } finally {
    if (pendingLists.get(key) === pending) pendingLists.delete(key);
  }
}

export function isInventoryLocal(session) {
  return isLocalPreviewActive()
    || session?.companyId === LOCAL_PREVIEW_COMPANY_ID
    || isForcedLocalInventory(session?.companyId);
}
