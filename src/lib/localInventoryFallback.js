/**
 * Inventory + stock board when the `inventory` / `stock` cloud functions are down.
 * Same list/mutation shape the pages already consume.
 */
import { getCompanyData, getSession, updateCompany } from "@/lib/store";
import {
  applyPoToItems,
  checkIssueStockGate,
  checkRaisePoGate,
  checkStationTransferRequestGate,
  deriveStockAlert,
  enrichStockItem,
  movementReversalBlock,
  qtyAtStation,
} from "@/lib/inventoryDerivations";
import { notifyMoneyMany, stationManagerIds } from "@/lib/moneyNotifications";
import { INVENTORY_DENY, checkStockReviewGate, inventoryReach, inventoryRights, reversalDeny } from "@/lib/inventoryRights";
import { moneyActor } from "@/lib/financeRights";

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const forcedLocalCompanies = new Set();

function notifyInventoryChanged(companyId) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("powercare:inventory-changed", { detail: { companyId } }));
  }
}

export function forceLocalInventory(companyId) {
  if (companyId) forcedLocalCompanies.add(companyId);
  notifyInventoryChanged(companyId);
}

export function isForcedLocalInventory(companyId) {
  return !!companyId && forcedLocalCompanies.has(companyId);
}

function actor(companyId, session) {
  // A caller may hand in a session carrying only the companyId, so the stored
  // session is the authority on who is acting.
  const stored = getSession();
  const live = stored?.userId ? stored : (session || stored);
  return moneyActor(companyId, live, getCompanyData(companyId));
}

function stationRows(data) {
  return (data?.stations || []).map((station) => ({
    ...station,
    stationId: station.stationId || station.id,
    id: station.id || station.stationId,
  }));
}

function balancesOf(item) {
  if (Array.isArray(item.locationBalances) && item.locationBalances.length) {
    return item.locationBalances.map((entry) => ({
      locationId: entry.locationId,
      quantity: Number(entry.quantity) || 0,
    }));
  }
  const locationId = item.currentLocationId || item.stationId;
  const quantity = Number(item.quantity ?? item.qty) || 0;
  return locationId ? [{ locationId, quantity }] : [];
}

function balanceAt(item, stationId) {
  return balancesOf(item).find((entry) => entry.locationId === stationId)?.quantity || 0;
}

function adjustBalance(item, stationId, delta) {
  const next = balancesOf(item);
  const index = next.findIndex((entry) => entry.locationId === stationId);
  if (index < 0) next.push({ locationId: stationId, quantity: Math.max(0, delta) });
  else next[index] = { ...next[index], quantity: Math.max(0, next[index].quantity + delta) };
  return next;
}

function normalizeItem(raw, stations) {
  const fallbackStation = raw.currentLocationId || raw.stationId || stations[0]?.stationId || stations[0]?.id;
  const quantity = Number(raw.quantity ?? raw.qty) || 0;
  const locationBalances = balancesOf({ ...raw, currentLocationId: fallbackStation, quantity });
  return {
    ...raw,
    id: raw.id || uid("ivi"),
    itemCode: String(raw.itemCode || raw.sku || raw.id || uid("sku")).trim(),
    name: String(raw.name || "").trim() || "صنف",
    quantity: locationBalances.reduce((sum, entry) => sum + entry.quantity, 0),
    minimumStock: Math.max(0, Number(raw.minimumStock ?? raw.minQty) || 0),
    leadDays: Math.max(0, Number(raw.leadDays) || 7),
    currentLocationId: fallbackStation,
    locationBalances,
    archived: raw.archived === true,
  };
}

function ensureLedger(data) {
  const stations = stationRows(data);
  // The legacy `inventory` array is a one-time migration source, not a second
  // ledger. It has to be emptied below, because ensureLedger runs on every read
  // and every write — re-merging it would add its quantities again each time.
  const fromLegacy = [
    ...(Array.isArray(data.inventoryItems) ? data.inventoryItems : []),
    ...(Array.isArray(data.inventory) ? data.inventory : []),
  ];
  const byCode = new Map();
  fromLegacy.forEach((raw) => {
    if (!raw || typeof raw !== "object") return;
    const item = normalizeItem(raw, stations);
    const prev = byCode.get(item.itemCode);
    if (!prev) {
      byCode.set(item.itemCode, item);
      return;
    }
    item.locationBalances.forEach((entry) => {
      prev.locationBalances = adjustBalance(prev, entry.locationId, entry.quantity);
    });
    prev.quantity = prev.locationBalances.reduce((sum, entry) => sum + entry.quantity, 0);
  });
  data.inventoryItems = [...byCode.values()];
  if (Array.isArray(data.inventory) && data.inventory.length) data.inventory = [];
  data.stockMovements = Array.isArray(data.stockMovements) ? data.stockMovements : [];
  data.materialRequests = Array.isArray(data.materialRequests) ? data.materialRequests : [];
  data.stockPurchaseOrders = Array.isArray(data.stockPurchaseOrders) ? data.stockPurchaseOrders : [];
  data.stockRaisedScopes = data.stockRaisedScopes && typeof data.stockRaisedScopes === "object" ? data.stockRaisedScopes : {};
  return data;
}

const caps = inventoryRights;

function nextMovementNumber(movements) {
  const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Riyadh", year: "numeric" }).format(new Date());
  const highest = movements.reduce((max, entry) => {
    const match = String(entry.movementNumber || "").match(new RegExp(`^MOV-${year}-(\\d{6})$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `MOV-${year}-${String(highest + 1).padStart(6, "0")}`;
}

function syncIncomingStations(companyId, incoming) {
  if (!Array.isArray(incoming) || !incoming.length) return;
  updateCompany(companyId, (data) => {
    if (!data) return;
    const have = new Set((data.stations || []).map((station) => station.id || station.stationId));
    const extra = incoming.filter((station) => {
      const id = station?.id || station?.stationId;
      return id && !have.has(id);
    });
    if (extra.length) data.stations = [...(data.stations || []), ...extra];
    ensureLedger(data);
  });
}

function listState(companyId, session) {
  const data = getCompanyData(companyId) || { stations: [], employees: [] };
  ensureLedger(data);
  const auth = actor(companyId, session);
  const rights = caps(auth);
  const stations = stationRows(data);
  const items = (data.inventoryItems || []).filter((item) => item.archived !== true);
  const movements = data.stockMovements || [];
  const requests = data.materialRequests || [];
  return {
    items,
    requestItems: items,
    historyItems: data.inventoryItems || [],
    movements,
    purchases: movements.filter((entry) => entry.movementType === "purchase"),
    procurementRequests: [],
    purchaseOrders: data.stockPurchaseOrders || [],
    requests,
    stations,
    locations: stations,
    transferStations: stations,
    employees: data.employees || [],
    canManage: rights.stationOp,
    canPurchase: rights.canPurchase,
    canCreateItem: rights.canCreateItem,
    canIssueToWork: rights.canIssueToWork,
    canIssueFromAnyStation: rights.canIssueFromAnyStation,
    canRequest: rights.canRequest,
    canReviewRequests: rights.canReviewRequests,
    canReviewAllRequests: rights.canReviewAllRequests,
    canDelete: rights.canDelete,
    canApproveProcurement: false,
    canReceiveProcurement: false,
    canViewAllPurchases: rights.canViewNetwork,
    canWarehouseManage: false,
    canTransfer: false,
    canSetCentralWarehouse: false,
    canReverse: rights.canReverse,
    centralWarehouseId: null,
  };
}

/**
 * `extra` is either a short code string or a named gate ({ error, reason, reasonEn }).
 * The named shape has to survive onto `response.data` untouched, otherwise
 * `namedServiceReason` cannot find the Arabic reason and the operator reads English.
 */
function fail(message, extra) {
  const error = new Error(message);
  const named = extra && typeof extra === "object" ? extra : { code: extra };
  error.response = { data: { error: named.error || message, ...named } };
  throw error;
}

function denyWith(gate) {
  fail(gate.reason || gate.error, { error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn });
}

export function localInventoryCall(session, action, payload = {}) {
  const companyId = session?.companyId || getSession()?.companyId;
  if (!companyId) fail("Missing companyId");
  const auth = actor(companyId, session);
  const rights = caps(auth);

  if (action === "list") {
    try {
      syncIncomingStations(companyId, payload.stations);
      const current = getCompanyData(companyId);
      const first = current?.inventoryItems?.[0];
      const needsMigrate = (first && !Array.isArray(first.locationBalances)) || !Array.isArray(current?.stockMovements);
      if (needsMigrate) updateCompany(companyId, (data) => { if (data) ensureLedger(data); });
      return listState(companyId, session);
    } catch (error) {
      console.error("NiroVera local inventory list:", error);
      return listState(companyId, session);
    }
  }

  if (action === "createItem") {
    if (!rights.canCreateItem) denyWith(INVENTORY_DENY.PURCHASE);
    const name = String(payload.name || "").trim();
    const itemCode = String(payload.itemCode || "").trim();
    const supplierName = String(payload.supplierName || "").trim();
    const locationId = String(payload.locationId || auth.stationId || "");
    const quantity = Number(payload.quantity);
    const totalCost = Number(payload.totalCost);
    const enteredUnitPrice = payload.unitPrice === "" || payload.unitPrice == null ? null : Number(payload.unitPrice);
    const unitPrice = enteredUnitPrice == null ? totalCost / quantity : enteredUnitPrice;
    if (!name) fail("اسم الصنف مطلوب.", { error: "NAME_REQUIRED", reason: "اسم الصنف مطلوب.", reasonEn: "Item name is required." });
    if (!itemCode) fail("كود الصنف مطلوب.", { error: "CODE_REQUIRED", reason: "كود الصنف مطلوب.", reasonEn: "Item code is required." });
    if (!supplierName) fail("اسم المورد مطلوب.", { error: "SUPPLIER_REQUIRED", reason: "اسم المورد مطلوب.", reasonEn: "Supplier name is required." });
    if (!locationId) fail("حدد فرع الشراء.", { error: "STATION_REQUIRED", reason: "حدد فرع الشراء.", reasonEn: "Set the buying station." });
    if (!Number.isFinite(quantity) || quantity <= 0) {
      fail("الكمية يجب أن تكون أكبر من صفر.", { error: "QTY_REQUIRED", reason: "الكمية يجب أن تكون أكبر من صفر.", reasonEn: "Quantity must be greater than zero." });
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(totalCost) || totalCost < 0) {
      fail("التكلفة يجب أن تكون صفرًا أو أكثر.", { error: "COST_REQUIRED", reason: "التكلفة يجب أن تكون صفرًا أو أكثر.", reasonEn: "Cost must be zero or more." });
    }
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      let item = data.inventoryItems.find((entry) => entry.itemCode === itemCode && entry.archived !== true);
      let before = 0;
      if (item) {
        before = balanceAt(item, locationId);
        item.locationBalances = adjustBalance(item, locationId, quantity);
        item.quantity = item.locationBalances.reduce((sum, entry) => sum + entry.quantity, 0);
        item.name = name;
        item.unitPrice = unitPrice;
        item.price = unitPrice;
        item.currentLocationId = locationId;
        item.archived = false;
        if (Array.isArray(payload.imageUrls) && payload.imageUrls.length) {
          item.imageUrls = [...(item.imageUrls || []), ...payload.imageUrls].slice(-10);
        }
      } else {
        item = normalizeItem({
          id: uid("ivi"),
          itemCode,
          name,
          quantity,
          unitPrice,
          price: unitPrice,
          minimumStock: Math.max(0, Number(payload.minimumStock) || 0),
          currentLocationId: locationId,
          imageUrls: Array.isArray(payload.imageUrls) ? payload.imageUrls.slice(0, 10) : [],
          qrCode: `PC-ITEM:${companyId}:${itemCode}`,
        }, stationRows(data));
        data.inventoryItems.push(item);
      }
      data.stockMovements.unshift({
        id: uid("mov"),
        movementNumber: nextMovementNumber(data.stockMovements),
        itemId: item.id,
        movementType: "purchase",
        quantity,
        fromLocationId: null,
        toLocationId: locationId,
        employeeId: auth.userId,
        requestId: null,
        balanceBefore: before,
        balanceAfter: before + quantity,
        purchasePrice: unitPrice,
        unitPrice,
        totalCost,
        supplierName,
        purchaseDate: payload.purchaseDate || new Date().toISOString(),
        invoiceUrl: payload.invoiceUrl || null,
        invoiceName: payload.invoiceName || null,
        imageUrls: Array.isArray(payload.imageUrls) ? payload.imageUrls.slice(0, 10) : [],
        performedBy: auth.userId,
        created_date: new Date().toISOString(),
      });
    });
    forceLocalInventory(companyId);
    return { ok: true };
  }

  if (action === "request") {
    if (!rights.canRequest) denyWith(INVENTORY_DENY.REQUEST);
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const item = data.inventoryItems.find((entry) => entry.id === payload.itemId && entry.archived !== true);
      const quantity = Number(payload.quantity);
      const notes = String(payload.notes || "").trim();
      const stationId = rights.senior ? String(payload.stationId || "") : String(auth.stationId || "");
      const sourceStationId = String(payload.sourceStationId || "");
      const gate = checkStationTransferRequestGate({
        item,
        sourceStationId,
        destStationId: stationId,
        quantity,
        notes,
      });
      if (!gate.ok) fail(gate.reason || gate.error, { error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn });
      data.materialRequests.unshift({
        id: uid("req"),
        requesterId: auth.userId,
        stationId,
        sourceStationId,
        itemId: item.id,
        quantity,
        notes,
        status: "pending",
        created_date: new Date().toISOString(),
      });
    });
    notifyInventoryChanged(companyId);
    const reqData = getCompanyData(companyId);
    const last = reqData?.materialRequests?.[0];
    if (last) {
      notifyMoneyMany(companyId, [last.requesterId, ...stationManagerIds(reqData, last.sourceStationId)], {
        ar: `طلب مخزون بانتظار فرع المصدر — ${last.notes || last.id}.`,
        en: `Stock request waiting on the supplying station — ${last.notes || last.id}.`,
        to: "/app/inventory",
        key: `inv-req-${last.id}`,
      });
    }
    return { ok: true };
  }

  if (action === "reviewRequest") {
    if (!rights.canReviewRequests) denyWith(INVENTORY_DENY.REVIEW);
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const request = data.materialRequests.find((entry) => entry.id === payload.requestId);
      if (!request || request.status !== "pending" || !["approved", "rejected"].includes(payload.decision)) {
        fail("هذا الطلب لم يعد قابلاً للمراجعة.", {
          error: "REQUEST_NOT_REVIEWABLE",
          reason: "هذا الطلب لم يعد قابلاً للمراجعة.",
          reasonEn: "This request is no longer reviewable.",
        });
      }
      const reviewGate = checkStockReviewGate(auth, rights, request);
      if (!reviewGate.ok) denyWith(reviewGate);
      const reviewedAt = new Date().toISOString();
      if (payload.decision === "rejected") {
        request.status = "rejected";
        request.reviewedBy = auth.userId;
        request.reviewedAt = reviewedAt;
        return;
      }
      const item = data.inventoryItems.find((entry) => entry.id === request.itemId);
      const quantity = Number(request.quantity);
      const sourceBefore = qtyAtStation(item, request.sourceStationId);
      const gate = checkIssueStockGate({ ...item, onHand: sourceBefore }, quantity);
      if (!gate.ok) fail(gate.reason || gate.error, { error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn });
      const destBefore = balanceAt(item, request.stationId);
      item.locationBalances = adjustBalance(item, request.sourceStationId, -quantity);
      item.locationBalances = adjustBalance(item, request.stationId, quantity);
      item.quantity = item.locationBalances.reduce((sum, entry) => sum + entry.quantity, 0);
      item.currentLocationId = request.stationId;
      data.stockMovements.unshift({
        id: uid("mov"),
        movementNumber: nextMovementNumber(data.stockMovements),
        itemId: item.id,
        movementType: "transfer",
        quantity,
        fromLocationId: request.sourceStationId,
        toLocationId: request.stationId,
        employeeId: request.requesterId,
        requestId: request.id,
        sourceBalanceBefore: sourceBefore,
        sourceBalanceAfter: sourceBefore - quantity,
        destinationBalanceBefore: destBefore,
        destinationBalanceAfter: destBefore + quantity,
        performedBy: auth.userId,
        created_date: reviewedAt,
      });
      request.status = "issued";
      request.reviewedBy = auth.userId;
      request.reviewedAt = reviewedAt;
      request.issuedAt = reviewedAt;
    });
    notifyInventoryChanged(companyId);
    const afterReview = getCompanyData(companyId);
    const reviewed = afterReview?.materialRequests?.find((entry) => entry.id === payload.requestId);
    if (reviewed) {
      notifyMoneyMany(companyId, [reviewed.requesterId, ...stationManagerIds(afterReview, reviewed.sourceStationId)], {
        ar: reviewed.status === "rejected"
          ? `رُفض طلب المخزون — ${reviewed.notes || reviewed.id}.`
          : `اعتُمد طلب المخزون ونُفّذ النقل — ${reviewed.notes || reviewed.id}.`,
        en: reviewed.status === "rejected"
          ? `Stock request rejected — ${reviewed.notes || reviewed.id}.`
          : `Stock request approved and issued — ${reviewed.notes || reviewed.id}.`,
        to: "/app/inventory",
        key: `inv-rev-${reviewed.id}-${reviewed.status}`,
      });
    }
    return { ok: true };
  }

  if (action === "issueToWork") {
    if (!rights.canIssueToWork) denyWith(INVENTORY_DENY.ISSUE);
    const quantity = Number(payload.quantity);
    const workReference = String(payload.workReference || "").trim();
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const item = data.inventoryItems.find((entry) => entry.id === payload.itemId && entry.archived !== true);
      const stationId = String(rights.senior ? payload.fromLocationId || "" : auth.stationId || "");
      if (!stationId) fail("حدد فرع الصرف.", { error: "STATION_REQUIRED", reason: "حدد فرع الصرف.", reasonEn: "Set the issuing station." });
      if (!payload.employeeId) fail("حدد المستلم.", { error: "RECIPIENT_REQUIRED", reason: "حدد المستلم.", reasonEn: "Set the recipient." });
      if (!workReference) fail("مرجع العمل مطلوب.", { error: "WORK_REF_REQUIRED", reason: "مرجع العمل مطلوب.", reasonEn: "A work reference is required." });
      const before = qtyAtStation(item, stationId);
      const gate = checkIssueStockGate({ ...item, onHand: before }, quantity);
      if (!gate.ok) fail(gate.reason || gate.error, { error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn });
      item.locationBalances = adjustBalance(item, stationId, -quantity);
      item.quantity = item.locationBalances.reduce((sum, entry) => sum + entry.quantity, 0);
      data.stockMovements.unshift({
        id: uid("mov"),
        movementNumber: nextMovementNumber(data.stockMovements),
        itemId: item.id,
        movementType: "issue",
        quantity,
        fromLocationId: stationId,
        toLocationId: null,
        employeeId: payload.employeeId,
        workReference,
        workDate: payload.workDate,
        notes: payload.notes || "",
        imageUrls: Array.isArray(payload.imageUrls) ? payload.imageUrls.slice(0, 10) : [],
        balanceBefore: before,
        balanceAfter: before - quantity,
        performedBy: auth.userId,
        created_date: new Date().toISOString(),
      });
    });
    notifyInventoryChanged(companyId);
    notifyMoneyMany(companyId, [auth.userId, payload.employeeId].filter(Boolean), {
      ar: `صُرف مخزون للعمل — مرجع ${workReference}.`,
      en: `Stock issued to work — ref ${workReference}.`,
      to: "/app/inventory",
      key: `inv-issue-${payload.itemId}-${workReference}-${quantity}`,
    });
    return { ok: true };
  }

  if (action === "deleteItem") {
    if (!rights.canDelete) denyWith(INVENTORY_DENY.DELETE);
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const item = data.inventoryItems.find((entry) => entry.id === payload.itemId);
      if (!item) fail("الصنف غير موجود.", { error: "ITEM_NOT_FOUND", reason: "الصنف غير موجود.", reasonEn: "Stock item not found." });
      // Archiving hides the item from every station at once, so a station manager
      // may only do it while no stock is left standing outside their own reach.
      if (!rights.senior) {
        const reach = inventoryReach(auth);
        const outside = balancesOf(item).some(
          (entry) => entry.quantity > 0 && !reach.has(String(entry.locationId)),
        );
        if (outside) denyWith(INVENTORY_DENY.DELETE_OUT_OF_REACH);
      }
      // The ledger keeps the movements; the item row keeps who retired it and when.
      item.archived = true;
      item.archivedAt = new Date().toISOString();
      item.archivedBy = auth.userId || auth.name;
    });
    notifyInventoryChanged(companyId);
    return { ok: true };
  }

  if (action === "reverseMovement") {
    if (!rights.canReverse) denyWith(INVENTORY_DENY.REVERSE);
    const reversalReason = String(payload.reversalReason || "").trim();
    if (!reversalReason) denyWith(reversalDeny("REVERSAL_REASON_REQUIRED"));
    let reversal = null;
    let reversed = null;
    updateCompany(companyId, (data) => {
      ensureLedger(data);
      const original = data.stockMovements.find((entry) => entry.id === payload.movementId);
      // Same rule the ledger screen reads, so a visible affordance and the gate
      // cannot disagree about what is reversible.
      const block = movementReversalBlock(original);
      if (block) denyWith(reversalDeny(block));
      const item = data.inventoryItems.find((entry) => entry.id === original.itemId);
      const quantity = Number(original.quantity);
      if (!item) denyWith(reversalDeny("MOVEMENT_ITEM_NOT_FOUND"));
      const debitStationId = original.movementType === "issue" ? null : original.toLocationId;
      const creditStationId = original.movementType === "purchase" ? null : original.fromLocationId;
      if (debitStationId && balanceAt(item, debitStationId) < quantity) {
        denyWith(reversalDeny("INSUFFICIENT_REVERSAL_STOCK"));
      }
      if (debitStationId) item.locationBalances = adjustBalance(item, debitStationId, -quantity);
      if (creditStationId) item.locationBalances = adjustBalance(item, creditStationId, quantity);
      item.quantity = item.locationBalances.reduce((sum, entry) => sum + entry.quantity, 0);
      const reversedAt = new Date().toISOString();
      // The original row is never removed: it keeps its number and gains the mark
      // that it was reversed, and the correction is a new movement of its own.
      original.reversedAt = reversedAt;
      original.reversedBy = auth.userId;
      original.reversalReason = reversalReason;
      reversal = {
        id: uid("mov"),
        movementNumber: nextMovementNumber(data.stockMovements),
        itemId: item.id,
        movementType: "reversal",
        isReversal: true,
        reversalMovementId: original.id,
        reversalMovementNumber: original.movementNumber || original.id,
        quantity,
        fromLocationId: debitStationId,
        toLocationId: creditStationId,
        notes: reversalReason,
        reversalReason,
        performedBy: auth.userId,
        created_date: reversedAt,
      };
      original.reversalMovementId = reversal.id;
      data.stockMovements.unshift(reversal);
      reversed = { ...original, itemName: item.name };
    });
    notifyInventoryChanged(companyId);
    if (reversal && reversed) {
      const after = getCompanyData(companyId);
      notifyMoneyMany(companyId, [
        auth.userId,
        reversed.performedBy,
        reversed.employeeId,
        ...stationManagerIds(after, reversal.fromLocationId),
        ...stationManagerIds(after, reversal.toLocationId),
      ].filter(Boolean), {
        ar: `عُكست حركة المخزون ${reversed.movementNumber || reversed.id} على «${reversed.itemName}» — ${reversalReason} الحركة الأصلية باقية في الدفتر وقُيّدت حركة معاكسة ${reversal.movementNumber}.`,
        en: `Stock movement ${reversed.movementNumber || reversed.id} on «${reversed.itemName}» was reversed — ${reversalReason} The original row stays on the ledger and compensating movement ${reversal.movementNumber} was booked.`,
        to: "/app/inventory?tab=movements",
        key: `inv-reverse-${reversal.id}`,
      });
    }
    return { ok: true, reversalMovementId: reversal?.id || null };
  }

  fail("Unknown action");
  return { ok: false };
}

function stockRowsFromLedger(data, scope = "all") {
  ensureLedger(data);
  const rows = [];
  (data.inventoryItems || []).filter((item) => item.archived !== true).forEach((item) => {
    balancesOf(item).forEach((entry) => {
      if (scope !== "all" && String(entry.locationId) !== String(scope)) return;
      rows.push(enrichStockItem({
        id: `${item.id}-${entry.locationId}`,
        sku: item.itemCode,
        name: item.name,
        stationId: entry.locationId,
        onHand: entry.quantity,
        reorder: Number(item.minimumStock) || 0,
        leadDays: Number(item.leadDays) || 7,
        onOrder: !!item.onOrder,
        poId: item.poId || null,
      }));
    });
  });
  return rows;
}

export function localStockCall(companyId, payload = {}) {
  const action = String(payload.action || "list");
  const scope = String(payload.scope || "all");
  const data = getCompanyData(companyId) || { stations: [] };
  ensureLedger(data);

  const enrich = () => {
    const items = stockRowsFromLedger(getCompanyData(companyId) || data, scope);
    return {
      ok: true,
      scope,
      items,
      alert: deriveStockAlert(items),
      purchaseOrders: (getCompanyData(companyId)?.stockPurchaseOrders || []).filter(
        (order) => !order.scope || order.scope === scope || scope === "all",
      ),
      poRaised: !!(getCompanyData(companyId)?.stockRaisedScopes || {})[scope],
    };
  };

  if (action === "list" || action === "seedDemo") return enrich();

  if (action === "raisePo") {
    let result = null;
    updateCompany(companyId, (next) => {
      ensureLedger(next);
      const items = stockRowsFromLedger(next, scope);
      const gate = checkRaisePoGate(items, { alreadyRaised: !!next.stockRaisedScopes[scope] });
      if (!gate.ok) fail(gate.reason || gate.error, gate.error);
      const po = {
        id: uid("po"),
        scope,
        skuKeys: gate.skuKeys,
        maxLeadDays: gate.maxLeadDays,
        raisedAt: new Date().toISOString(),
        status: "open",
      };
      next.stockPurchaseOrders = [po, ...(next.stockPurchaseOrders || [])];
      next.stockRaisedScopes = { ...next.stockRaisedScopes, [scope]: po.id };
      next.inventoryItems = applyPoToItems(
        next.inventoryItems.map((item) => ({ ...item, sku: item.itemCode })),
        po,
      ).map(({ sku, ...item }) => item);
      result = { ok: true, po, lines: gate.lines, maxLeadDays: gate.maxLeadDays };
    });
    return { ...enrich(), ...result };
  }

  return enrich();
}
