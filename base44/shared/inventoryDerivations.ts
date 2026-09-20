/** Inventory stockboard — status from on-hand vs reorder; PO moves shorts to on_order.
 *  Design: NiroVera Platform.dc.html (inventory / raisePO / stockAlert).
 */

export const CRITICAL_RATIO = 0.5; // onHand/reorder < 0.5 → critical

export type StockStatus = "critical" | "low" | "ok" | "on_order";

export type StockItemLike = {
  id?: string;
  sku: string;
  name: string;
  stationId?: string | null;
  onHand: number;
  reorder: number;
  leadDays?: number;
  /** When set, item is covered by an open PO and status is on_order. */
  onOrder?: boolean;
  poId?: string | null;
  companyId?: string;
};

export type PurchaseOrderLike = {
  id: string;
  scope?: string | null;
  skuKeys: string[];
  maxLeadDays: number;
  raisedAt?: string | null;
  raisedBy?: string | null;
  status?: "open" | "received" | "cancelled";
};

/** On-hand at one station. Zero is zero — do not fall through to company total. */
export function qtyAtStation(item: { locationBalances?: { locationId?: string; quantity?: number }[]; currentLocationId?: string | null; stationId?: string | null; quantity?: number; onHand?: number } | null | undefined, stationId?: string | null) {
  if (!item || stationId == null || stationId === "") return 0;
  const balances = item.locationBalances;
  if (Array.isArray(balances) && balances.length) {
    const row = balances.find((entry) => String(entry.locationId) === String(stationId));
    return row ? Math.max(0, Number(row.quantity) || 0) : 0;
  }
  if (String(item.currentLocationId || item.stationId) === String(stationId)) {
    return Math.max(0, Number(item.quantity ?? item.onHand) || 0);
  }
  return 0;
}

export function fillRatio(onHand: number, reorder: number) {
  const r = Number(reorder) || 0;
  if (r <= 0) return Number(onHand) > 0 ? 100 : 0;
  return Math.min(100, Math.round((Math.max(0, Number(onHand) || 0) / r) * 100));
}

/** Derive stock status. on_order wins while a PO covers the SKU. */
export function deriveStockStatus(item: StockItemLike): StockStatus {
  if (item.onOrder) return "on_order";
  const onHand = Math.max(0, Number(item.onHand) || 0);
  const reorder = Math.max(0, Number(item.reorder) || 0);
  if (reorder <= 0) return onHand > 0 ? "ok" : "critical";
  if (onHand >= reorder) return "ok";
  const ratio = onHand / reorder;
  if (ratio < CRITICAL_RATIO) return "critical";
  return "low";
}

export function isShortSku(item: StockItemLike) {
  const status = deriveStockStatus(item);
  return status === "critical" || status === "low";
}

export function enrichStockItem(item: StockItemLike) {
  const onHand = Math.max(0, Number(item.onHand) || 0);
  const reorder = Math.max(0, Number(item.reorder) || 0);
  const status = deriveStockStatus({ ...item, onHand, reorder });
  const shortfall = Math.max(0, reorder - onHand);
  return {
    ...item,
    onHand,
    reorder,
    leadDays: Math.max(0, Number(item.leadDays) || 0),
    status,
    shortfall,
    fillPct: status === "ok" ? 100 : fillRatio(onHand, reorder),
    short: status === "critical" || status === "low",
  };
}

export function deriveStockAlert(items: StockItemLike[] = []) {
  const enriched = items.map(enrichStockItem);
  const short = enriched.filter((i) => i.short);
  const critical = enriched.filter((i) => i.status === "critical");
  const onOrder = enriched.filter((i) => i.status === "on_order");
  const stations = new Set(short.map((i) => i.stationId).filter(Boolean));
  const maxLead = short.reduce((m, i) => Math.max(m, i.leadDays || 0), 0)
    || onOrder.reduce((m, i) => Math.max(m, i.leadDays || 0), 0);
  return {
    shortCount: short.length,
    criticalCount: critical.length,
    onOrderCount: onOrder.length,
    stationsAffected: stations.size,
    maxLeadDays: maxLead,
    covered: short.length === 0 && onOrder.length > 0,
  };
}

export function shortfallQty(item: StockItemLike) {
  const onHand = Math.max(0, Number(item.onHand) || 0);
  const reorder = Math.max(0, Number(item.reorder) || 0);
  return Math.max(0, reorder - onHand);
}

export function checkStationTransferRequestGate({
  item,
  sourceStationId,
  destStationId,
  quantity,
  notes,
}: {
  item?: { locationBalances?: { locationId?: string; quantity?: number }[]; currentLocationId?: string | null; stationId?: string | null; quantity?: number; onHand?: number } | null;
  sourceStationId?: string | null;
  destStationId?: string | null;
  quantity?: number;
  notes?: string | null;
}) {
  const source = String(sourceStationId || "");
  const dest = String(destStationId || "");
  if (!source || !dest) {
    return { ok: false as const, error: "STATIONS_REQUIRED", reason: "حدد فرع المصدر والوجهة.", reasonEn: "Set source and destination stations." };
  }
  if (source === dest) {
    return { ok: false as const, error: "SAME_STATION", reason: "الطلب بين فرعين مختلفين.", reasonEn: "A request is between two different stations." };
  }
  if (!item) {
    return { ok: false as const, error: "ITEM_NOT_FOUND", reason: "الصنف غير موجود.", reasonEn: "Stock item not found." };
  }
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0) {
    return { ok: false as const, error: "QTY_REQUIRED", reason: "الكمية يجب أن تكون أكبر من صفر.", reasonEn: "Quantity must be greater than zero." };
  }
  const avail = qtyAtStation(item, source);
  if (q > avail) {
    return {
      ok: false as const,
      error: "INSUFFICIENT_STOCK",
      reason: `لا يكفي المخزون في فرع المصدر — المتاح ${avail}.`,
      reasonEn: `Insufficient stock at the source station — ${avail} on hand.`,
      onHand: avail,
      requested: q,
    };
  }
  if (!String(notes || "").trim()) {
    return { ok: false as const, error: "REASON_REQUIRED", reason: "اكتب سبب الطلب.", reasonEn: "Write the request reason." };
  }
  return { ok: true as const, source, dest, quantity: q };
}

export function checkIssueStockGate(item: StockItemLike | null | undefined, qty: number) {
  if (!item) {
    return {
      ok: false as const,
      error: "ITEM_NOT_FOUND",
      reason: "الصنف غير موجود.",
      reasonEn: "Stock item not found.",
    };
  }
  const q = Number(qty);
  if (!Number.isFinite(q) || q <= 0) {
    return {
      ok: false as const,
      error: "QTY_REQUIRED",
      reason: "الكمية يجب أن تكون أكبر من صفر.",
      reasonEn: "Quantity must be greater than zero.",
    };
  }
  const onHand = Math.max(0, Number(item.onHand) || 0);
  if (q > onHand) {
    return {
      ok: false as const,
      error: "INSUFFICIENT_STOCK",
      reason: `لا يكفي المخزون — المتاح ${onHand}.`,
      reasonEn: `Insufficient stock — ${onHand} on hand.`,
      onHand,
      requested: q,
    };
  }
  return { ok: true as const, onHand, requested: q, nextOnHand: onHand - q };
}

/**
 * Which ledger rows a reversal may touch. A reversal never erases the original —
 * it books a new compensating movement — so the original row stays readable and
 * carries the mark that it was reversed.
 */
export const REVERSIBLE_MOVEMENTS = ["purchase", "transfer", "issue", "return", "receive"];

export type MovementLike = {
  movementType?: string | null;
  quantity?: number | null;
  isReversal?: boolean | null;
  reversedAt?: string | null;
  reversalMovementId?: string | null;
};

/**
 * Why this movement cannot be reversed, or null when it can. The ledger screen and
 * the write gate both ask this, so a row never offers a reversal the gate refuses.
 */
export function movementReversalBlock(movement: MovementLike | null | undefined) {
  if (!movement) return "MOVEMENT_NOT_FOUND";
  if (movement.isReversal || String(movement.movementType) === "reversal") return "MOVEMENT_REVERSAL_ROW";
  if (movement.reversedAt || movement.reversalMovementId) return "MOVEMENT_ALREADY_REVERSED";
  if (!REVERSIBLE_MOVEMENTS.includes(String(movement.movementType))) return "MOVEMENT_NOT_REVERSIBLE";
  if (!(Number(movement.quantity) > 0)) return "MOVEMENT_NOT_REVERSIBLE";
  return null;
}

export function checkReceiveStockGate(item: StockItemLike | null | undefined, qty: number) {
  if (!item) {
    return {
      ok: false as const,
      error: "ITEM_NOT_FOUND",
      reason: "الصنف غير موجود.",
      reasonEn: "Stock item not found.",
    };
  }
  const q = Number(qty);
  if (!Number.isFinite(q) || q <= 0) {
    return {
      ok: false as const,
      error: "QTY_REQUIRED",
      reason: "الكمية يجب أن تكون أكبر من صفر.",
      reasonEn: "Quantity must be greater than zero.",
    };
  }
  return { ok: true as const, nextOnHand: Math.max(0, Number(item.onHand) || 0) + q };
}

/** Raise a PO covering every short SKU in scope — design: one PO for all shorts. */
export function checkRaisePoGate(items: StockItemLike[] = [], opts: { alreadyRaised?: boolean } = {}) {
  if (opts.alreadyRaised) {
    return {
      ok: false as const,
      error: "ALREADY_RAISED",
      reason: "أمر الشراء أُنشئ بالفعل لهذا النطاق.",
      reasonEn: "The purchase order is already raised for this scope.",
    };
  }
  const short = items.map(enrichStockItem).filter((i) => i.short);
  if (!short.length) {
    return {
      ok: false as const,
      error: "NO_SHORT_SKUS",
      reason: "لا أصناف ناقصة تحتاج أمر شراء.",
      reasonEn: "No short SKUs need a purchase order.",
    };
  }
  const maxLeadDays = short.reduce((m, i) => Math.max(m, i.leadDays || 0), 0);
  const lines = short.map((i) => ({
    sku: i.sku,
    name: i.name,
    stationId: i.stationId || null,
    qty: shortfallQty(i) || 1,
    leadDays: i.leadDays || 0,
  }));
  return { ok: true as const, lines, maxLeadDays, skuKeys: short.map((i) => i.sku) };
}

export function applyPoToItems(items: StockItemLike[], po: { id: string; skuKeys: string[] }) {
  const set = new Set(po.skuKeys);
  return items.map((item) => {
    if (!set.has(item.sku)) return item;
    return { ...item, onOrder: true, poId: po.id };
  });
}

/** After receipt, clear on_order when onHand meets reorder again. */
export function clearOnOrderIfFilled(item: StockItemLike) {
  const onHand = Math.max(0, Number(item.onHand) || 0);
  const reorder = Math.max(0, Number(item.reorder) || 0);
  if (item.onOrder && onHand >= reorder) {
    return { ...item, onOrder: false, poId: null };
  }
  return item;
}
