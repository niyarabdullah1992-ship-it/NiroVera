/**
 * Expenses, assets/custody, inventory.
 * Remaining budget and stock qty figures are derived — never hard-coded on screens.
 *
 * Inventory quantity home: InventoryItem.locationBalances (+ derived item.quantity total).
 * InventoryUnit is retired do-not-write — never a second live qty source.
 */

export const MONEY_FACTS = Object.freeze([
  {
    id: "expense.claim",
    domain: "expenses",
    scope: "expenseClaim",
    home: "expenseClaims / ExpenseClaim",
    path: "expenseClaims",
    storeKey: "expenseClaims",
    writer: "expense-raise",
    stored: true,
    isolation: "companyId",
    surfaceAr: "مطالباتي",
    noteAr: "المسار الذاتي للمطالبة. الإدارة تقرأ نفس الصف عبر لوحة المصروفات.",
  },
  {
    id: "expense.budget",
    domain: "expenses",
    scope: "stationBudget",
    home: "stationBudgets",
    path: "stationBudgets",
    blobCategory: "stationBudgets",
    writer: "expense-approve",
    stored: true,
    isolation: "companyId",
    legacyKeys: ["expenseBudget"],
    surfaceAr: "ميزانية المحطة",
    noteAr: "المتبقي مشتق. expenseBudget قراءة مرة فقط.",
  },
  {
    id: "asset.record",
    domain: "assets",
    scope: "asset",
    home: "assets / Asset",
    path: "assets",
    storeKey: "assets",
    writer: "asset-custody",
    stored: true,
    isolation: "companyId",
    surfaceAr: "عهدتي",
    noteAr: "holderId هو العهدة الحالية.",
  },
  {
    id: "asset.custody",
    domain: "assets",
    scope: "custody",
    home: "assetCustody / AssetCustody",
    path: "assetCustody",
    storeKey: "assetCustody",
    writer: "asset-custody",
    stored: true,
    isolation: "companyId",
    surfaceAr: "عهدتي",
  },
  {
    id: "asset.transfer",
    domain: "assets",
    scope: "transfer",
    home: "assetTransfers",
    path: "assetTransfers",
    blobCategory: "assetTransfers",
    writer: "asset-custody",
    stored: true,
    isolation: "companyId",
    surfaceAr: "نقل العهدة",
  },
  {
    id: "inventory.item",
    domain: "inventory",
    scope: "sku",
    home: "inventoryItems / InventoryItem",
    path: "inventoryItems",
    storeKey: "inventoryItems",
    writer: "inventory-ops",
    stored: true,
    isolation: "companyId",
    legacyKeys: ["stockBoard"],
    surfaceAr: "المخزون",
    noteAr: "الصنف (SKU). الكمية الحية على inventory.qty — ليس على InventoryUnit.",
  },
  {
    id: "inventory.qty",
    domain: "inventory",
    scope: "quantity",
    home: "inventoryItems[].locationBalances",
    path: "locationBalances",
    writer: "inventory-ops",
    stored: true,
    isolation: "companyId",
    surfaceAr: "رصيد المخزون",
    noteAr: "منزل الكمية الوحيد. item.quantity مجموع مشتق من locationBalances.",
    feeds: "inventory.item",
  },
  {
    id: "inventory.unitEntity",
    domain: "inventory",
    scope: "retired",
    home: "InventoryUnit",
    path: "InventoryUnit",
    writer: "do-not-write",
    stored: false,
    isolation: "companyId",
    legacyKeys: ["InventoryUnit"],
    surfaceAr: "وحدة مخزون (متقاعدة)",
    noteAr: "كيان سحابي متقاعد — لا تُكتب كمية هنا. اقرأ/اكتب locationBalances فقط.",
  },
  {
    id: "inventory.movement",
    domain: "inventory",
    scope: "movement",
    home: "stockMovements / StockMovement",
    path: "stockMovements",
    storeKey: "stockMovements",
    writer: "inventory-ops",
    stored: true,
    isolation: "companyId",
    surfaceAr: "حركة المخزون",
  },
  {
    id: "inventory.materialRequest",
    domain: "inventory",
    scope: "materialRequest",
    home: "materialRequests / MaterialRequest",
    path: "materialRequests",
    storeKey: "materialRequests",
    writer: "inventory-ops",
    stored: true,
    isolation: "companyId",
    surfaceAr: "طلب مواد",
  },
]);

export function readExpenseClaims(company) {
  return Array.isArray(company?.expenseClaims) ? company.expenseClaims : [];
}

export function readStationBudgets(company) {
  return Array.isArray(company?.stationBudgets) ? company.stationBudgets : [];
}

export function readAssets(company) {
  return Array.isArray(company?.assets) ? company.assets : [];
}

export function readAssetCustody(company) {
  return Array.isArray(company?.assetCustody) ? company.assetCustody : [];
}

export function readInventoryItems(company) {
  return Array.isArray(company?.inventoryItems) ? company.inventoryItems : [];
}

export function readStockMovements(company) {
  return Array.isArray(company?.stockMovements) ? company.stockMovements : [];
}

export function readMaterialRequests(company) {
  return Array.isArray(company?.materialRequests) ? company.materialRequests : [];
}

/** Canonical per-location balances. Empty array means zero stock everywhere. */
export function locationBalancesOf(item) {
  if (Array.isArray(item?.locationBalances) && item.locationBalances.length) {
    return item.locationBalances.map((entry) => ({
      locationId: entry.locationId,
      quantity: Math.max(0, Number(entry.quantity) || 0),
    }));
  }
  const locationId = item?.currentLocationId || item?.stationId;
  const quantity = Math.max(0, Number(item?.quantity ?? item?.onHand ?? item?.qty) || 0);
  return locationId ? [{ locationId, quantity }] : [];
}

/** Derived company total — never invent stock. */
export function totalQtyFromBalances(item) {
  return locationBalancesOf(item).reduce((sum, entry) => sum + entry.quantity, 0);
}

/** On-hand at one station. Zero is zero — do not fall through to company total. */
export function qtyAtLocation(item, stationId) {
  if (!item || stationId == null || stationId === "") return 0;
  const balances = locationBalancesOf(item);
  if (Array.isArray(item?.locationBalances) && item.locationBalances.length) {
    const row = balances.find((entry) => String(entry.locationId) === String(stationId));
    return row ? row.quantity : 0;
  }
  if (String(item.currentLocationId || item.stationId) === String(stationId)) {
    return Math.max(0, Number(item.quantity ?? item.onHand) || 0);
  }
  return 0;
}

/** Keep display total in lockstep with locationBalances (sole qty home). */
export function syncItemQuantityFromBalances(item) {
  if (!item || typeof item !== "object") return item;
  const locationBalances = locationBalancesOf(item);
  return {
    ...item,
    locationBalances,
    quantity: locationBalances.reduce((sum, entry) => sum + entry.quantity, 0),
  };
}

export function adjustLocationBalance(item, stationId, delta) {
  const next = locationBalancesOf(item);
  const index = next.findIndex((entry) => String(entry.locationId) === String(stationId));
  if (index < 0) next.push({ locationId: stationId, quantity: Math.max(0, delta) });
  else next[index] = { ...next[index], quantity: Math.max(0, next[index].quantity + delta) };
  return syncItemQuantityFromBalances({ ...item, locationBalances: next });
}

/** Assets held by this employee (عهدتي). */
export function assetsHeldBy(company, employeeId) {
  const id = String(employeeId || "");
  if (!id) return [];
  return readAssets(company).filter((row) => String(row?.holderId || "") === id);
}

/** Expense claims raised by this employee (مطالباتي). */
export function expenseClaimsBy(company, employeeId) {
  const id = String(employeeId || "");
  if (!id) return [];
  return readExpenseClaims(company).filter((row) => String(row?.requesterId || "") === id);
}
