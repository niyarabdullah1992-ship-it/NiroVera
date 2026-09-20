import assert from "node:assert/strict";
import {
  CRITICAL_RATIO,
  deriveStockStatus,
  enrichStockItem,
  deriveStockAlert,
  checkIssueStockGate,
  checkRaisePoGate,
  applyPoToItems,
  clearOnOrderIfFilled,
  fillRatio,
  qtyAtStation,
  checkStationTransferRequestGate,
  movementReversalBlock,
} from "../src/lib/inventoryDerivations.js";

assert.equal(CRITICAL_RATIO, 0.5);
assert.equal(deriveStockStatus({ sku: "A", name: "A", onHand: 1, reorder: 6 }), "critical"); // 1/6 < 0.5
assert.equal(deriveStockStatus({ sku: "B", name: "B", onHand: 3, reorder: 12 }), "critical");
assert.equal(deriveStockStatus({ sku: "C", name: "C", onHand: 8, reorder: 10 }), "low");
assert.equal(deriveStockStatus({ sku: "D", name: "D", onHand: 4, reorder: 8 }), "low"); // 0.5 → low
assert.equal(deriveStockStatus({ sku: "E", name: "E", onHand: 42, reorder: 20 }), "ok");
assert.equal(deriveStockStatus({ sku: "F", name: "F", onHand: 1, reorder: 6, onOrder: true }), "on_order");

assert.equal(qtyAtStation({
  locationBalances: [{ locationId: "s1", quantity: 0 }, { locationId: "s2", quantity: 8 }],
  quantity: 8,
  currentLocationId: "s2",
}, "s1"), 0);
assert.equal(qtyAtStation({
  locationBalances: [{ locationId: "s1", quantity: 0 }, { locationId: "s2", quantity: 8 }],
  quantity: 8,
}, "s2"), 8);
assert.equal(qtyAtStation({ currentLocationId: "s1", quantity: 4 }, "s1"), 4);
assert.equal(qtyAtStation({ currentLocationId: "s1", quantity: 4 }, "s2"), 0);

const cable = { id: "ivi", locationBalances: [{ locationId: "s2", quantity: 12 }], quantity: 12 };
assert.equal(checkStationTransferRequestGate({ item: cable, sourceStationId: "s1", destStationId: "s1", quantity: 1, notes: "سبب" }).error, "SAME_STATION");
assert.equal(checkStationTransferRequestGate({ item: cable, sourceStationId: "s2", destStationId: "s1", quantity: 20, notes: "سبب كافٍ" }).error, "INSUFFICIENT_STOCK");
assert.equal(checkStationTransferRequestGate({ item: cable, sourceStationId: "s2", destStationId: "s1", quantity: 2, notes: "تمديد مؤقت" }).ok, true);

// The ledger button and both reversal gates read this one rule, so they cannot
// disagree about what is reversible.
assert.equal(movementReversalBlock({ movementType: "purchase", quantity: 10 }), null);
assert.equal(movementReversalBlock({ movementType: "transfer", quantity: 2 }), null);
assert.equal(movementReversalBlock({ movementType: "issue", quantity: 2 }), null);
assert.equal(movementReversalBlock(null), "MOVEMENT_NOT_FOUND");
assert.equal(movementReversalBlock({ movementType: "reversal", quantity: 2 }), "MOVEMENT_REVERSAL_ROW");
assert.equal(movementReversalBlock({ movementType: "purchase", quantity: 2, isReversal: true }), "MOVEMENT_REVERSAL_ROW");
assert.equal(movementReversalBlock({ movementType: "issue", quantity: 2, reversedAt: "2026-09-17T00:00:00Z" }), "MOVEMENT_ALREADY_REVERSED");
assert.equal(movementReversalBlock({ movementType: "issue", quantity: 2, reversalMovementId: "mov_9" }), "MOVEMENT_ALREADY_REVERSED");
assert.equal(movementReversalBlock({ movementType: "adjustment", quantity: 2 }), "MOVEMENT_NOT_REVERSIBLE");
assert.equal(movementReversalBlock({ movementType: "issue", quantity: 0 }), "MOVEMENT_NOT_REVERSIBLE");

assert.equal(fillRatio(1, 6), 17);
assert.equal(enrichStockItem({ sku: "E", name: "E", onHand: 42, reorder: 20 }).fillPct, 100);

const items = [
  { sku: "SPR-1042", name: "Valve", onHand: 1, reorder: 6, leadDays: 21, stationId: "jbl2" },
  { sku: "CON-0330", name: "Oil", onHand: 8, reorder: 10, leadDays: 7, stationId: "jbl1" },
  { sku: "PPE-0120", name: "Gloves", onHand: 42, reorder: 20, leadDays: 5, stationId: "shb" },
];
const alert = deriveStockAlert(items);
assert.equal(alert.criticalCount, 1);
assert.equal(alert.shortCount, 2);
assert.equal(alert.stationsAffected, 2);
assert.equal(alert.maxLeadDays, 21);

assert.equal(checkIssueStockGate(items[0], 2).error, "INSUFFICIENT_STOCK");
assert.equal(checkIssueStockGate(items[0], 1).ok, true);

assert.equal(checkRaisePoGate([]).error, "NO_SHORT_SKUS");
assert.equal(checkRaisePoGate(items, { alreadyRaised: true }).error, "ALREADY_RAISED");
const poGate = checkRaisePoGate(items);
assert.equal(poGate.ok, true);
assert.equal(poGate.skuKeys.length, 2);
assert.equal(poGate.maxLeadDays, 21);

const after = applyPoToItems(items, { id: "po1", skuKeys: poGate.skuKeys });
assert.equal(deriveStockStatus(after[0]), "on_order");
assert.equal(deriveStockStatus(after[2]), "ok");

const filled = clearOnOrderIfFilled({ ...after[0], onHand: 6, onOrder: true, poId: "po1" });
assert.equal(filled.onOrder, false);
assert.equal(filled.poId, null);

console.log("inventory derivations ok");
