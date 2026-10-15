/**
 * Inventory (المخزون), expenses (المصروفات، مصروفات الفرع، المطالبات) and the asset
 * register (الأصول) were removed from NiroVera — it is an HR product. Employee
 * custody (العهدة) stays: it lives on the offboarding case and the custody request
 * in طلباتي, not in these bags.
 *
 * Existing company blobs in localStorage still carry the old bags. This sweep drops
 * them once on read so no residue remains; it is idempotent (a second run changes
 * nothing and returns false).
 */
export const PURGED_MODULE_KEYS = Object.freeze([
  // Inventory / stock / procurement
  "inventory",
  "inventoryItems",
  "stockMovements",
  "materialRequests",
  "stockPurchaseOrders",
  "stockRaisedScopes",
  "stockBoard",
  // Expenses / station budgets
  "expenses",
  "expenseClaims",
  "stationBudgets",
  "expenseBudget",
  // Asset register (custody now lives on the offboarding case)
  "assets",
  "assetCustody",
  "assetMaintenance",
  "assetTransfers",
]);

/**
 * Notices the removed desks used to send (stock requests, asset transfers, expense claims).
 * Employee custody notices («عهدة») are NOT matched — they belong to طلباتي.
 */
const REMOVED_DESK_NOTICE = /طلب مخزون|طلب المخزون|طلب مادة|طلب مواد|صرف للعمل|صُرف مخزون|حركة المخزون|stock request|material request|inventory request|issued to work|أصل\s*«|asset «|custody of asset|asset transfer|نقل أصل|مطالبة مصروف|مطالبة المصروف|expense claim|operating claim|وعاء الفرع/i;

export function isRemovedModuleNotice(text) {
  return REMOVED_DESK_NOTICE.test(String(text || ""));
}

/** Delete the removed modules' bags (and their desk notices) from one company blob. Returns true when something was removed. */
export function purgeRemovedModuleKeys(data) {
  if (!data || typeof data !== "object") return false;
  let changed = false;
  for (const key of PURGED_MODULE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    delete data[key];
    changed = true;
  }
  if (Array.isArray(data.notifications)) {
    const kept = data.notifications.filter((note) => !isRemovedModuleNotice(typeof note === "string" ? note : note?.text));
    if (kept.length !== data.notifications.length) {
      data.notifications = kept;
      changed = true;
    }
  }
  return changed;
}
