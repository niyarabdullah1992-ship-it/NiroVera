import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { movementReversalBlock } from "../../shared/inventoryDerivations.ts";

// Inventory actions are authorized and scoped by the active company session.
const stationRoles = ["station_manager", "inventory_keeper"];
const seniorRoles = ["owner", "director", "ops_manager", "pgm"];

// Mirrors src/lib/inventoryRights.js — the ledger now carries a reverse button, so
// every refusal on this path has to name itself in Arabic instead of returning an
// English sentence an Arabic operator cannot act on.
const REVERSAL_DENY = {
  STOCK_REVERSE_DENIED: { reason: "عكس حركة مخزون للإدارة العليا فقط.", reasonEn: "Reversing a stock movement is for senior management only." },
  MOVEMENT_NOT_FOUND: { reason: "الحركة غير موجودة في الدفتر.", reasonEn: "The movement is not on the ledger." },
  MOVEMENT_REVERSAL_ROW: { reason: "هذه حركة عكسية — الحركة العكسية لا تُعكس.", reasonEn: "This is already a reversal row — a reversal is not reversed." },
  MOVEMENT_ALREADY_REVERSED: { reason: "هذه الحركة عُكست مرة — لا تُعكس مرتين.", reasonEn: "This movement was reversed once — it is not reversed twice." },
  MOVEMENT_NOT_REVERSIBLE: { reason: "نوع هذه الحركة لا يُعكس.", reasonEn: "This movement type cannot be reversed." },
  REVERSAL_REASON_REQUIRED: { reason: "اكتب سبب العكس — يُقيَّد على الحركة المعاكسة.", reasonEn: "Write the reversal reason — it is recorded on the compensating movement." },
  MOVEMENT_ITEM_NOT_FOUND: { reason: "صنف هذه الحركة غير موجود في السجل.", reasonEn: "The item on this movement is not in the register." },
  INSUFFICIENT_REVERSAL_STOCK: { reason: "لا يمكن العكس — هذه الكمية صُرفت أو نُقلت بعد الحركة. اعكس الأحدث أولًا.", reasonEn: "Cannot reverse — this quantity was issued or moved after the movement. Reverse the newer rows first." },
  REVERSAL_HAS_DEPENDENCIES: { reason: "حركات أحدث خرجت من هذا الرصيد — اعكسها أولًا.", reasonEn: "Newer movements left this balance — reverse them first." },
};

const denyReversal = (code: keyof typeof REVERSAL_DENY, status: number, extra: Record<string, unknown> = {}) =>
  Response.json({ error: code, code, ...REVERSAL_DENY[code], ...extra }, { status });

// The other live stock paths used to answer in bare English, so a refusal reached an
// Arabic operator as a code with no reason. Same words as src/lib/inventoryRights.js.
const STOCK_DENY = {
  STOCK_ISSUE_DENIED: { reason: "الصرف للعمل لمدير الفرع أو أمين المخزن — الطلب متاح لك.", reasonEn: "Issuing to work is for the station manager or the stock keeper — requesting is open to you." },
  STOCK_PURCHASE_DENIED: { reason: "تسجيل شراء المخزون لمدير الفرع أو أمين المخزن.", reasonEn: "Recording a stock purchase is for the station manager or the stock keeper." },
  STOCK_REQUEST_DENIED: { reason: "طلب مادة من فرع آخر لموظفي الفروع — لا يملك حسابك هذه الصلاحية.", reasonEn: "Requesting material from another station is for station staff — your account does not hold that right." },
  STOCK_REVIEW_DENIED: { reason: "مراجعة طلبات المخزون لمدير الفرع المالك أو الإدارة.", reasonEn: "Reviewing stock requests is for the owning station manager or management." },
  ISSUE_FIELDS_REQUIRED: { reason: "أكمل بيانات الصرف: الصنف والفرع والكمية والمستلم ومرجع العمل وتاريخه.", reasonEn: "Complete the issue: item, station, quantity, recipient, work reference and its date." },
  ITEM_OR_RECIPIENT_NOT_FOUND: { reason: "الصنف أو المستلم غير موجود في السجل.", reasonEn: "The item or the recipient is not in the register." },
  ITEM_NOT_FOUND: { reason: "الصنف غير موجود.", reasonEn: "Stock item not found." },
  INSUFFICIENT_STATION_STOCK: { reason: "رصيد الفرع لا يكفي هذه الكمية.", reasonEn: "The station balance does not cover this quantity." },
  INSUFFICIENT_SOURCE_STOCK: { reason: "رصيد الفرع المصدر لا يكفي هذه الكمية.", reasonEn: "The supplying station does not hold this quantity." },
  ITEM_FIELDS_REQUIRED: { reason: "أكمل بيانات الشراء: الكود والاسم والفرع والكمية والسعر.", reasonEn: "Complete the purchase: code, name, station, quantity and unit price." },
  REQUEST_FIELDS_REQUIRED: { reason: "أكمل بيانات الطلب: الصنف والفرع المصدر والكمية.", reasonEn: "Complete the request: item, supplying station and quantity." },
  REQUEST_NOT_REVIEWABLE: { reason: "هذا الطلب لم يعد بانتظار القرار أو ليس من فرعك.", reasonEn: "This request is no longer awaiting a decision, or it is not your station's." },
  QUANTITY_REQUIRED: { reason: "اكتب كمية صحيحة أكبر من صفر.", reasonEn: "Write a valid quantity above zero." },
  STOCK_REVIEW_OUT_OF_REACH: { reason: "مراجعة الطلب لفرع المصدر — هذا الطلب خارج نطاقك.", reasonEn: "The supplying station reviews this request — it sits outside your scope." },
  UNKNOWN_ACTION: { reason: "إجراء غير معروف على المخزون.", reasonEn: "Unknown inventory action." },
  WORKFLOW_RETIRED: { reason: "هذا المسار لم يعد متاحًا — استخدم طلب المادة بين الفروع.", reasonEn: "This workflow is no longer available — use the inter-station material request." },
};

const denyStock = (code: keyof typeof STOCK_DENY, status: number) =>
  Response.json({ error: code, code, ...STOCK_DENY[code] }, { status });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const platformUser = await base44.auth.me().catch(() => null);
    let auth = null;
    if (body.sessionToken && body.companyId) {
      const sessions = await base44.asServiceRole.entities.CompanySession.filter({ token: body.sessionToken, companyId: body.companyId });
      const session = sessions[0];
      if (session && new Date(session.expiresAt).getTime() > Date.now()) {
        const employees = session.userId
          ? await base44.asServiceRole.entities.Employee.filter({ companyId: body.companyId, employeeId: session.userId })
          : [];
        const employee = employees[0];
        if (session.role === "owner") auth = { companyId: body.companyId, userId: employee?.employeeId || session.userId || null, role: "owner", name: employee?.name || "Owner", manager: true, owner: true, stationId: null, managedStations: [] };
        else if (employee) auth = { companyId: body.companyId, userId: employee.employeeId, role: employee.role, name: employee.name, manager: stationRoles.includes(employee.role), owner: false, stationId: employee.stationId || null, managedStations: employee.managedStations || [] };
      }
    }
    if (!auth && platformUser?.role === "admin" && body.companyId) auth = { companyId: body.companyId, userId: body.userId || null, role: "owner", name: platformUser.full_name || "Admin", manager: true, owner: true };
    if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Some company owners enter through their employee identity (for example after
    // switching users). Reconcile that identity with the persisted company owner
    // instead of incorrectly treating the owner as a regular employee.
    if (!auth.owner && auth.userId) {
      const [metaRows, accounts, employees] = await Promise.all([
        base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: auth.companyId, category: "companyMeta" }),
        base44.asServiceRole.entities.CompanyAccount.filter({ companyId: auth.companyId }),
        base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId: auth.userId }),
      ]);
      const ownerId = metaRows[0]?.payload?.[0]?.ownerId;
      const employee = employees[0];
      const ownerEmail = String(accounts[0]?.ownerEmail || "").trim().toLowerCase();
      const employeeEmail = String(employee?.email || "").trim().toLowerCase();
      if (ownerId === auth.userId || (ownerEmail && ownerEmail === employeeEmail)) {
        auth.owner = true;
        auth.manager = true;
        auth.role = "owner";
      }
    }

    let stations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId });
    // The owner-controlled local directory is used only to repair missing persisted
    // station rows. This keeps every module on the same canonical station roster.
    if (auth.owner && Array.isArray(body.stations) && body.stations.length) {
      const existingIds = new Set(stations.map((station) => station.stationId));
      const missing = body.stations
        .filter((station) => station?.id && !existingIds.has(station.id))
        .map((station) => ({
          stationId: station.id,
          companyId: auth.companyId,
          name: String(station.name || "Station"),
          location: String(station.location || ""),
          type: String(station.type || ""),
          status: String(station.status || "active"),
          managerId: station.managerId || null,
          lat: station.lat != null && station.lat !== "" && Number.isFinite(Number(station.lat)) ? Number(station.lat) : null,
          lng: station.lng != null && station.lng !== "" && Number.isFinite(Number(station.lng)) ? Number(station.lng) : null,
          radiusMeters: station.radiusMeters != null && station.radiusMeters !== "" && Number.isFinite(Number(station.radiusMeters)) ? Number(station.radiusMeters) : null,
          isCentralWarehouse: station.isCentralWarehouse === true,
        }));
      if (missing.length) {
        await base44.asServiceRole.entities.Station.bulkCreate(missing);
        stations = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId });
      }
    }
    const isWarehouse = false;
    const isSenior = seniorRoles.includes(auth.role);
    const isStationOperator = stationRoles.includes(auth.role) && !!auth.stationId;
    const isEmployeeRequester = auth.role === "employee" && !!auth.stationId;
    const canViewNetworkInventory = isSenior || isStationOperator;
    const canPurchase = isStationOperator || isSenior;
    const canCreateItem = isStationOperator || isSenior;
    const canDelete = isSenior || auth.role === "station_manager";
    const canApproveProcurement = false;
    const canReceiveProcurement = false;
    const allStationIds = stations.map((station) => station.stationId);
    const visibleIds = isSenior ? allStationIds : (isStationOperator || isEmployeeRequester) ? [auth.stationId] : [];
    const visible = new Set(visibleIds);
    const ensureStation = (id) => isSenior ? allStationIds.includes(id) : isStationOperator && id === auth.stationId;
    const warehouseGuard = () => denyStock("WORKFLOW_RETIRED", 410);
    const getItem = async (id) => {
      const item = (await base44.asServiceRole.entities.InventoryItem.filter({ id, companyId: auth.companyId }))[0];
      return item?.archived === true ? null : item;
    };
    const balances = (item) => Array.isArray(item.locationBalances) ? item.locationBalances.map((entry) => ({ locationId: entry.locationId, quantity: Number(entry.quantity) || 0 })) : [];
    const balanceAt = (item, stationId) => balances(item).find((entry) => entry.locationId === stationId)?.quantity || 0;
    const adjustBalance = (item, stationId, delta) => {
      const next = balances(item); const index = next.findIndex((entry) => entry.locationId === stationId);
      if (index < 0) next.push({ locationId: stationId, quantity: Math.max(0, delta) });
      else { const value = next[index].quantity + delta; if (value < 0) throw new Error("Insufficient stock"); next[index].quantity = value; }
      return next;
    };
    const nextMovementNumber = async () => {
      const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Riyadh", year: "numeric" }).format(new Date());
      const recent = await base44.asServiceRole.entities.StockMovement.filter({ companyId: auth.companyId }, "-created_date", 500);
      const highest = recent.reduce((max, entry) => {
        const match = String(entry.movementNumber || "").match(new RegExp(`^MOV-${year}-(\\d{6})$`));
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      return `MOV-${year}-${String(highest + 1).padStart(6, "0")}`;
    };
    const movement = async (data) => await base44.asServiceRole.entities.StockMovement.create({ companyId: auth.companyId, movementNumber: await nextMovementNumber(), performedBy: auth.userId || auth.name, notes: "", ...data });
    const allocateTraces = async (item, stationId, requestedQuantity, destinationId = null) => {
      const history = await base44.asServiceRole.entities.StockMovement.filter({ companyId: auth.companyId, itemId: item.id }, "created_date", 500);
      const traceStock = new Map();
      const traceKey = (locationId, traceId) => `${locationId}::${traceId}`;
      for (const entry of history) {
        const allocations = Array.isArray(entry.traceAllocations) ? entry.traceAllocations : [];
        for (const allocation of allocations) {
          const traceId = String(allocation.traceId || ""); const allocated = Number(allocation.quantity) || 0;
          if (!traceId || allocated <= 0) continue;
          if (entry.fromLocationId) {
            const sourceKey = traceKey(entry.fromLocationId, traceId); const source = traceStock.get(sourceKey);
            if (source) source.quantity = Math.max(0, source.quantity - allocated);
          }
          if (entry.toLocationId) {
            const destinationKey = traceKey(entry.toLocationId, traceId); const existing = traceStock.get(destinationKey);
            const routeStationIds = Array.isArray(allocation.routeStationIds) && allocation.routeStationIds.length ? allocation.routeStationIds : [entry.toLocationId];
            traceStock.set(destinationKey, { traceId, quantity: (existing?.quantity || 0) + allocated, routeStationIds, movementId: entry.id });
          }
        }
      }
      const candidates = [...traceStock.entries()].filter(([key, trace]) => key.startsWith(`${stationId}::`) && trace.quantity > 0).map(([, trace]) => trace);
      const actualBalance = balanceAt(item, stationId);
      const tracedBalance = candidates.reduce((sum, trace) => sum + trace.quantity, 0);
      if (tracedBalance < actualBalance) candidates.push({ traceId: `baseline-${item.id}-${stationId}`, quantity: actualBalance - tracedBalance, routeStationIds: [stationId], movementId: null });
      let remaining = requestedQuantity; const allocations = [];
      for (const trace of candidates) {
        if (remaining <= 0) break;
        const allocated = Math.min(remaining, trace.quantity); const sourceRoute = trace.routeStationIds || [stationId];
        const routeStationIds = destinationId && sourceRoute[sourceRoute.length - 1] !== destinationId ? [...sourceRoute, destinationId] : sourceRoute;
        allocations.push({ traceId: trace.traceId, quantity: allocated, parentMovementId: trace.movementId, sourceRouteStationIds: sourceRoute, routeStationIds });
        remaining -= allocated;
      }
      if (remaining > 0) allocations.push({ traceId: `baseline-${item.id}-${stationId}`, quantity: remaining, parentMovementId: null, sourceRouteStationIds: [stationId], routeStationIds: destinationId ? [stationId, destinationId] : [stationId] });
      return allocations;
    };

    if (body.action === "list") {
      const [items, movements, requests, employees] = await Promise.all([
        base44.asServiceRole.entities.InventoryItem.filter({ companyId: auth.companyId }, "-updated_date", 500),
        base44.asServiceRole.entities.StockMovement.filter({ companyId: auth.companyId }, "-created_date", 300),
        base44.asServiceRole.entities.MaterialRequest.filter({ companyId: auth.companyId }, "-created_date", 300),
        base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId }),
      ]);
      const activeItems = items.filter((item) => item.archived !== true);
      const scopedItems = activeItems.filter((item) => canViewNetworkInventory || balances(item).some((entry) => visible.has(entry.locationId))).map((item) => canViewNetworkInventory ? item : ({ ...item, quantity: balanceAt(item, auth.stationId), currentLocationId: auth.stationId, locationBalances: balances(item).filter((entry) => visible.has(entry.locationId)) }));
      const scopedRequests = requests.filter((request) => isSenior || request.requesterId === auth.userId || visible.has(request.stationId) || (isStationOperator && visible.has(request.sourceStationId)));
      const scopedMovements = movements.filter((entry) => canViewNetworkInventory || visible.has(entry.fromLocationId) || visible.has(entry.toLocationId));
      const scopedStations = stations.filter((station) => canViewNetworkInventory || visible.has(station.stationId));
      const operationalStations = stations.filter((station) => isSenior || visible.has(station.stationId));
      const purchases = (isEmployeeRequester ? movements : scopedMovements).filter((entry) => entry.movementType === "purchase");
      return Response.json({ items: scopedItems, requestItems: activeItems, historyItems: items, movements: scopedMovements, purchases, procurementRequests: [], purchaseOrders: [], requests: scopedRequests, stations: scopedStations, locations: operationalStations, transferStations: stations, employees, canManage: isStationOperator, canPurchase, canCreateItem, canIssueToWork: isStationOperator || isSenior, canIssueFromAnyStation: isSenior, canRequest: isStationOperator || isSenior || isEmployeeRequester, canReviewRequests: isStationOperator || isSenior, canReviewAllRequests: isSenior, canDelete, canApproveProcurement, canReceiveProcurement, canViewAllPurchases: canViewNetworkInventory, canWarehouseManage: false, canTransfer: false, canSetCentralWarehouse: false, canReverse: isSenior, centralWarehouseId: null });
    }

    if (["submitProcurement", "reviewProcurement", "createPurchaseOrder", "receivePurchaseOrder", "issueRequest"].includes(body.action)) return denyStock("WORKFLOW_RETIRED", 410);

    if (body.action === "submitProcurement") {
      const stationId = String(body.stationId || auth.stationId || "");
      const items = Array.isArray(body.items) ? body.items.map((item) => ({ itemCode: String(item.itemCode || "").trim(), name: String(item.name || "").trim(), quantity: Number(item.quantity), estimatedUnitCost: Number(item.estimatedUnitCost || 0) })) : [];
      if (!ensureStation(stationId) || !String(body.justification || "").trim() || !items.length || items.some((item) => !item.itemCode || !item.name || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.estimatedUnitCost) || item.estimatedUnitCost < 0)) return Response.json({ error: "Valid station, items and justification are required" }, { status: 400 });
      await base44.asServiceRole.entities.ProcurementRequest.create({ companyId: auth.companyId, requestNumber: `PR-${Date.now().toString(36).toUpperCase()}`, stationId, requesterId: auth.userId, requesterName: auth.name, items, justification: String(body.justification).trim(), status: "pending", reviewedBy: null, reviewedAt: null });
      return Response.json({ ok: true });
    }

    if (body.action === "reviewProcurement") {
      if (!canApproveProcurement) return Response.json({ error: "Procurement approval permission required" }, { status: 403 });
      const rows = await base44.asServiceRole.entities.ProcurementRequest.filter({ id: body.requestId, companyId: auth.companyId }); const request = rows[0];
      if (!request || request.status !== "pending" || !["approved", "rejected"].includes(body.decision)) return Response.json({ error: "Request cannot be reviewed" }, { status: 400 });
      await base44.asServiceRole.entities.ProcurementRequest.update(request.id, { status: body.decision, reviewedBy: auth.userId || auth.name, reviewedAt: new Date().toISOString() });
      return Response.json({ ok: true });
    }

    if (body.action === "createPurchaseOrder") {
      if (!canApproveProcurement) return Response.json({ error: "Purchase order permission required" }, { status: 403 });
      const rows = await base44.asServiceRole.entities.ProcurementRequest.filter({ id: body.requestId, companyId: auth.companyId }); const request = rows[0];
      const supplierName = String(body.supplierName || "").trim();
      const items = Array.isArray(body.items) ? body.items.map((item) => ({ itemCode: String(item.itemCode || "").trim(), name: String(item.name || "").trim(), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })) : [];
      if (!request || request.status !== "approved" || !supplierName || items.length !== request.items.length || items.some((item) => !item.itemCode || !item.name || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) return Response.json({ error: "Approved request, supplier and valid prices are required" }, { status: 400 });
      const totalCost = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      await base44.asServiceRole.entities.PurchaseOrder.create({ companyId: auth.companyId, orderNumber: `PO-${Date.now().toString(36).toUpperCase()}`, requestId: request.id, stationId: request.stationId, supplierName, items, totalCost, status: "issued", issuedBy: auth.userId || auth.name, issuedAt: new Date().toISOString(), receivedBy: null, receivedAt: null });
      await base44.asServiceRole.entities.ProcurementRequest.update(request.id, { status: "ordered" });
      return Response.json({ ok: true });
    }

    if (body.action === "receivePurchaseOrder") {
      if (!canReceiveProcurement) return Response.json({ error: "Receiving permission required" }, { status: 403 });
      const rows = await base44.asServiceRole.entities.PurchaseOrder.filter({ id: body.orderId, companyId: auth.companyId }); const order = rows[0];
      if (!order || order.status !== "issued" || !ensureStation(order.stationId)) return Response.json({ error: "Purchase order cannot be received" }, { status: 400 });
      for (const line of order.items) {
        const duplicates = await base44.asServiceRole.entities.InventoryItem.filter({ companyId: auth.companyId, itemCode: line.itemCode });
        let item = duplicates[0]; const quantity = Number(line.quantity); const before = item ? balanceAt(item, order.stationId) : 0;
        if (item) { const next = adjustBalance(item, order.stationId, quantity); await base44.asServiceRole.entities.InventoryItem.update(item.id, { name: line.name, quantity: Number(item.quantity || 0) + quantity, locationBalances: next, currentLocationId: order.stationId }); }
        else item = await base44.asServiceRole.entities.InventoryItem.create({ companyId: auth.companyId, itemCode: line.itemCode, name: line.name, currentLocationId: order.stationId, minimumStock: 0, quantity, locationBalances: [{ locationId: order.stationId, quantity }], qrCode: `PC-ITEM:${auth.companyId}:${line.itemCode}` });
        await movement({ itemId: item.id, movementType: "purchase", quantity, fromLocationId: null, toLocationId: order.stationId, employeeId: auth.userId, requestId: order.requestId, balanceBefore: before, balanceAfter: before + quantity, sourceBalanceBefore: null, sourceBalanceAfter: null, destinationBalanceBefore: before, destinationBalanceAfter: before + quantity, purchasePrice: Number(line.unitPrice), unitPrice: Number(line.unitPrice), totalCost: quantity * Number(line.unitPrice), supplierName: order.supplierName, purchaseDate: new Date().toISOString(), notes: order.orderNumber });
      }
      await base44.asServiceRole.entities.PurchaseOrder.update(order.id, { status: "received", receivedBy: auth.userId || auth.name, receivedAt: new Date().toISOString() });
      await base44.asServiceRole.entities.ProcurementRequest.update(order.requestId, { status: "received" });
      return Response.json({ ok: true });
    }

    if (body.action === "issueToWork") {
      if (!isStationOperator && !isSenior) return denyStock("STOCK_ISSUE_DENIED", 403);
      const itemId = String(body.itemId || ""); const stationId = String(isSenior ? body.fromLocationId || "" : auth.stationId || "");
      const quantity = Number(body.quantity); const employeeId = String(body.employeeId || "");
      const workReference = String(body.workReference || "").trim(); const workDate = String(body.workDate || ""); const notes = String(body.notes || "").trim();
      if (!itemId || !ensureStation(stationId) || !employeeId || !workReference || !/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !Number.isFinite(quantity) || quantity <= 0) return denyStock("ISSUE_FIELDS_REQUIRED", 400);
      const [item, employeeRows] = await Promise.all([getItem(itemId), base44.asServiceRole.entities.Employee.filter({ companyId: auth.companyId, employeeId })]);
      if (!item || !employeeRows[0]) return denyStock("ITEM_OR_RECIPIENT_NOT_FOUND", 404);
      const before = balanceAt(item, stationId);
      if (before < quantity) return denyStock("INSUFFICIENT_STATION_STOCK", 400);
      const traceAllocations = await allocateTraces(item, stationId, quantity);
      const next = adjustBalance(item, stationId, -quantity);
      await base44.asServiceRole.entities.InventoryItem.update(item.id, { quantity: Math.max(0, Number(item.quantity || 0) - quantity), locationBalances: next, currentLocationId: stationId });
      await movement({ itemId: item.id, movementType: "issue", quantity, fromLocationId: stationId, toLocationId: null, employeeId, requestId: null, balanceBefore: before, balanceAfter: before - quantity, sourceBalanceBefore: before, sourceBalanceAfter: before - quantity, destinationBalanceBefore: null, destinationBalanceAfter: null, workReference, workDate, notes, imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 10) : [], traceAllocations });
      return Response.json({ ok: true });
    }

    if (body.action === "reverseMovement") {
      if (!isSenior) return denyReversal("STOCK_REVERSE_DENIED", 403);
      const movementId = String(body.movementId || "");
      const reversalReason = String(body.reversalReason || "").trim();
      if (!reversalReason) return denyReversal("REVERSAL_REASON_REQUIRED", 400);
      if (!movementId || !/^[a-f0-9]{24}$/i.test(movementId)) return denyReversal("MOVEMENT_NOT_FOUND", 404);
      const original = (await base44.asServiceRole.entities.StockMovement.filter({ id: movementId, companyId: auth.companyId }))[0];
      const priorReversals = original
        ? await base44.asServiceRole.entities.StockMovement.filter({ companyId: auth.companyId, movementType: "reversal", reversalMovementId: original.id })
        : [];
      // One shared rule for "is this reversible", read by the ledger screen, the
      // local gate and this handler alike.
      const block = movementReversalBlock(priorReversals.length ? { ...original, reversedAt: original.reversedAt || priorReversals[0].created_date } : original);
      if (block) return denyReversal(block as keyof typeof REVERSAL_DENY, block === "MOVEMENT_NOT_FOUND" ? 404 : block === "MOVEMENT_ALREADY_REVERSED" ? 409 : 400);
      const item = await getItem(original.itemId);
      const quantity = Number(original.quantity);
      if (!item || !Number.isFinite(quantity) || quantity <= 0) return denyReversal("MOVEMENT_ITEM_NOT_FOUND", 404);

      const debitStationId = original.movementType === "issue" ? null : original.toLocationId;
      const creditStationId = original.movementType === "purchase" ? null : original.fromLocationId;
      if (debitStationId) {
        const itemMovements = await base44.asServiceRole.entities.StockMovement.filter({ companyId: auth.companyId, itemId: item.id }, "-created_date", 300);
        const originalTime = new Date(original.created_date).getTime();
        const laterOutbound = itemMovements.filter((entry) => entry.id !== original.id && !entry.isReversal && !entry.reversedAt && entry.fromLocationId === debitStationId && new Date(entry.created_date).getTime() > originalTime);
        if (laterOutbound.length) return denyReversal("REVERSAL_HAS_DEPENDENCIES", 409, { dependentMovementIds: laterOutbound.map((entry) => entry.id) });
      }
      if ((debitStationId && balanceAt(item, debitStationId) < quantity) || (!debitStationId && !creditStationId)) return denyReversal("INSUFFICIENT_REVERSAL_STOCK", 409);
      let next = balances(item);
      const debitBefore = debitStationId ? balanceAt(item, debitStationId) : null;
      const creditBefore = creditStationId ? balanceAt(item, creditStationId) : null;
      if (debitStationId) next = adjustBalance({ ...item, locationBalances: next }, debitStationId, -quantity);
      if (creditStationId) next = adjustBalance({ ...item, locationBalances: next }, creditStationId, quantity);
      const totalDelta = original.movementType === "purchase" ? -quantity : original.movementType === "issue" ? quantity : 0;
      await base44.asServiceRole.entities.InventoryItem.update(item.id, { quantity: Math.max(0, Number(item.quantity || 0) + totalDelta), locationBalances: next, currentLocationId: creditStationId || debitStationId || item.currentLocationId });

      const affectedIds = [...new Set([debitStationId, creditStationId].filter(Boolean))];
      const units = await base44.asServiceRole.entities.InventoryUnit.filter({ companyId: auth.companyId, itemId: item.id });
      const unitUpdates = []; const unitCreates = [];
      for (const locationId of affectedIds) {
        const quantityAtLocation = next.find((entry) => entry.locationId === locationId)?.quantity || 0;
        const unit = units.find((entry) => entry.locationId === locationId);
        if (unit) unitUpdates.push({ id: unit.id, quantity: quantityAtLocation });
        else unitCreates.push({ companyId: auth.companyId, itemId: item.id, locationId, quantity: quantityAtLocation });
      }
      await Promise.all([unitUpdates.length ? base44.asServiceRole.entities.InventoryUnit.bulkUpdate(unitUpdates) : null, unitCreates.length ? base44.asServiceRole.entities.InventoryUnit.bulkCreate(unitCreates) : null].filter(Boolean));
      const reversedAt = new Date().toISOString();
      const originalTraces = Array.isArray(original.traceAllocations) ? original.traceAllocations : [];
      const traceAllocations = originalTraces.map((allocation) => { const sourceRoute = allocation.routeStationIds || []; return { ...allocation, parentMovementId: original.id, sourceRouteStationIds: sourceRoute, routeStationIds: creditStationId && sourceRoute[sourceRoute.length - 1] !== creditStationId ? [...sourceRoute, creditStationId] : sourceRoute }; });
      const reversal = await movement({ itemId: item.id, movementType: "reversal", quantity, fromLocationId: debitStationId, toLocationId: creditStationId, employeeId: original.employeeId || null, requestId: original.requestId || null, sourceBalanceBefore: debitBefore, sourceBalanceAfter: debitBefore == null ? null : debitBefore - quantity, destinationBalanceBefore: creditBefore, destinationBalanceAfter: creditBefore == null ? null : creditBefore + quantity, balanceBefore: debitBefore ?? creditBefore, balanceAfter: debitBefore == null ? creditBefore + quantity : debitBefore - quantity, notes: reversalReason, isReversal: true, reversalMovementId: original.id, reversalReason, traceAllocations });
      await base44.asServiceRole.entities.StockMovement.update(original.id, { reversedBy: auth.userId || auth.name, reversedAt, reversalReason, reversalMovementId: reversal.id });
      return Response.json({ ok: true, reversalMovementId: reversal.id });
    }

    if (body.action === "deleteItem") {
      if (!canDelete) {
        return Response.json({
          error: "STOCK_DELETE_DENIED",
          reason: "حذف صنف من المخزون لمدير الفرع أو الإدارة.",
          reasonEn: "Archiving an item is for the station manager or management.",
        }, { status: 403 });
      }
      const item = await getItem(body.itemId);
      if (!item) return denyStock("ITEM_NOT_FOUND", 404);
      // Archiving hides the item from every station at once, so a station manager
      // may only do it while no stock is left standing outside their own reach.
      if (!isSenior && balances(item).some((entry) => entry.quantity > 0 && !visible.has(entry.locationId))) {
        return Response.json({
          error: "STOCK_DELETE_OUT_OF_REACH",
          reason: "لهذا الصنف رصيد في فرع خارج نطاقك — حذفه للإدارة أو لمدير ذلك الفرع.",
          reasonEn: "This item still holds stock at a station outside your scope — archiving it belongs to management or that station's manager.",
        }, { status: 403 });
      }
      // The movement ledger is the proof that the stock existed and where it went,
      // so retiring an item archives it and leaves that trail standing.
      await base44.asServiceRole.entities.InventoryItem.update(item.id, {
        archived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: auth.userId || auth.name,
      });
      return Response.json({ ok: true });
    }

    if (body.action === "createItem") {
      if (!canCreateItem) return denyStock("STOCK_PURCHASE_DENIED", 403);
      const name = String(body.name || "").trim(); const itemCode = String(body.itemCode || "").trim();
      const supplierName = String(body.supplierName || "").trim(); const locationId = String(body.locationId || auth.stationId || "");
      const quantity = Number(body.quantity); const totalCost = Number(body.totalCost); const enteredUnitPrice = body.unitPrice === "" || body.unitPrice == null ? null : Number(body.unitPrice);
      const unitPrice = enteredUnitPrice == null ? totalCost / quantity : enteredUnitPrice;
      const selectedDate = String(body.purchaseDate || "");
      const purchaseMoment = selectedDate.length === 10 ? new Date(`${selectedDate}T${new Date().toTimeString().slice(0, 8)}`) : new Date(selectedDate || Date.now());
      const purchaseDate = purchaseMoment.toISOString();
      if (!name || !itemCode || !supplierName || !ensureStation(locationId) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(totalCost) || totalCost < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return denyStock("ITEM_FIELDS_REQUIRED", 400);
      const duplicates = await base44.asServiceRole.entities.InventoryItem.filter({ companyId: auth.companyId, itemCode });
      let item = duplicates[0]; let before = 0;
      if (item) {
        before = balanceAt(item, locationId);
        const next = adjustBalance(item, locationId, quantity);
        await base44.asServiceRole.entities.InventoryItem.update(item.id, { name, quantity: Number(item.quantity || 0) + quantity, locationBalances: next, currentLocationId: locationId, archived: false, archivedAt: null, archivedBy: null });
      } else {
        const qrCode = `PC-ITEM:${auth.companyId}:${itemCode}`;
        item = await base44.asServiceRole.entities.InventoryItem.create({ companyId: auth.companyId, itemCode, name, currentLocationId: locationId, minimumStock: Math.max(0, Number(body.minimumStock || 0)), quantity, locationBalances: [{ locationId, quantity }], qrCode });
      }
      const traceId = crypto.randomUUID();
      await movement({ itemId: item.id, movementType: "purchase", quantity, fromLocationId: null, toLocationId: locationId, employeeId: auth.userId, requestId: null, balanceBefore: before, balanceAfter: before + quantity, sourceBalanceBefore: null, sourceBalanceAfter: null, destinationBalanceBefore: before, destinationBalanceAfter: before + quantity, purchasePrice: unitPrice, unitPrice, totalCost, supplierName, purchaseDate, invoiceUrl: body.invoiceUrl || null, invoiceName: body.invoiceName || null, traceAllocations: [{ traceId, quantity, parentMovementId: null, sourceRouteStationIds: [], routeStationIds: [locationId] }] });
      return Response.json({ ok: true });
    }

    if (body.action === "request") {
      if (!isStationOperator && !isSenior && !isEmployeeRequester) return denyStock("STOCK_REQUEST_DENIED", 403);
      const item = await getItem(body.itemId); const quantity = Number(body.quantity); const notes = String(body.notes || "").trim();
      const stationId = isSenior ? String(body.stationId || "") : String(auth.stationId || ""); const sourceStationId = String(body.sourceStationId || "");
      if (!item || !allStationIds.includes(stationId) || !allStationIds.includes(sourceStationId) || sourceStationId === stationId || balanceAt(item, sourceStationId) < quantity || quantity < 1 || !notes) return denyStock("REQUEST_FIELDS_REQUIRED", 400);
      const purchaseRows = await base44.asServiceRole.entities.StockMovement.filter({ companyId: auth.companyId, itemId: item.id, movementType: "purchase", toLocationId: sourceStationId }, "-purchaseDate", 1);
      const unitPrice = Number(purchaseRows[0]?.unitPrice ?? purchaseRows[0]?.purchasePrice ?? 0);
      const totalCost = quantity * unitPrice;
      await base44.asServiceRole.entities.MaterialRequest.create({ companyId: auth.companyId, requesterId: auth.userId || auth.name, stationId, sourceStationId, itemId: item.id, quantity, unitPrice, totalCost, notes, status: "pending", supervisorId: null, reviewedBy: null, reviewedAt: null, issuedAt: null });
      return Response.json({ ok: true });
    }

    if (body.action === "reviewRequest") {
      if (!isStationOperator && !isSenior) return denyStock("STOCK_REVIEW_DENIED", 403);
      const rows = await base44.asServiceRole.entities.MaterialRequest.filter({ id: body.requestId, companyId: auth.companyId }); const request = rows[0];
      if (!request || request.status !== "pending" || (!isSenior && request.sourceStationId !== auth.stationId) || !["approved", "rejected"].includes(body.decision)) return denyStock("REQUEST_NOT_REVIEWABLE", 400);
      const reviewedAt = new Date().toISOString();
      if (body.decision === "rejected") {
        await base44.asServiceRole.entities.MaterialRequest.update(request.id, { status: "rejected", reviewedBy: auth.userId || auth.name, reviewedAt });
        return Response.json({ ok: true });
      }
      const item = await getItem(request.itemId); const quantity = Number(request.quantity); const sourceId = request.sourceStationId;
      if (!item || !Number.isFinite(quantity) || quantity <= 0) return denyStock("QUANTITY_REQUIRED", 400);
      const sourceBefore = balanceAt(item, sourceId); const destinationBefore = balanceAt(item, request.stationId);
      if (sourceBefore < quantity) return denyStock("INSUFFICIENT_SOURCE_STOCK", 400);
      const sourceAfter = sourceBefore - quantity; const destinationAfter = destinationBefore + quantity;
      const traceAllocations = await allocateTraces(item, sourceId, quantity, request.stationId);
      let next = adjustBalance(item, sourceId, -quantity); next = adjustBalance({ ...item, locationBalances: next }, request.stationId, quantity);
      const currentLocationId = sourceAfter > 0 ? (item.currentLocationId || sourceId) : request.stationId;
      await base44.asServiceRole.entities.InventoryItem.update(item.id, { locationBalances: next, currentLocationId });
      const units = await base44.asServiceRole.entities.InventoryUnit.filter({ companyId: auth.companyId, itemId: item.id });
      const unitChanges = [{ locationId: sourceId, quantity: sourceAfter }, { locationId: request.stationId, quantity: destinationAfter }];
      const unitUpdates = unitChanges.filter((change) => units.some((unit) => unit.locationId === change.locationId)).map((change) => ({ id: units.find((unit) => unit.locationId === change.locationId).id, quantity: change.quantity }));
      const unitCreates = unitChanges.filter((change) => !units.some((unit) => unit.locationId === change.locationId)).map((change) => ({ companyId: auth.companyId, itemId: item.id, ...change }));
      await Promise.all([unitUpdates.length ? base44.asServiceRole.entities.InventoryUnit.bulkUpdate(unitUpdates) : null, unitCreates.length ? base44.asServiceRole.entities.InventoryUnit.bulkCreate(unitCreates) : null].filter(Boolean));
      await movement({ itemId: item.id, movementType: "transfer", quantity, fromLocationId: sourceId, toLocationId: request.stationId, employeeId: request.requesterId, requestId: request.id, balanceBefore: sourceBefore, balanceAfter: sourceAfter, sourceBalanceBefore: sourceBefore, sourceBalanceAfter: sourceAfter, destinationBalanceBefore: destinationBefore, destinationBalanceAfter: destinationAfter, unitPrice: Number(request.unitPrice || 0), totalCost: Number(request.totalCost || (quantity * Number(request.unitPrice || 0))), traceAllocations });
      await base44.asServiceRole.entities.MaterialRequest.update(request.id, { status: "issued", reviewedBy: auth.userId || auth.name, reviewedAt, issuedAt: reviewedAt });
      return Response.json({ ok: true, transferredQuantity: quantity, sourceBalance: sourceAfter, destinationBalance: destinationAfter });
    }

    if (body.action === "issueRequest") {
      const denied = warehouseGuard(); if (denied) return denied;
      const rows = await base44.asServiceRole.entities.MaterialRequest.filter({ id: body.requestId, companyId: auth.companyId }); const request = rows[0];
      if (!request || request.status !== "approved") return Response.json({ error: "Approved request required" }, { status: 400 });
      const item = await getItem(request.itemId); const sourceId = request.sourceStationId || stations.find((station) => station.isCentralWarehouse)?.stationId; const quantity = Number(request.quantity);
      if (!item || !sourceId || balanceAt(item, sourceId) < quantity) return Response.json({ error: "Insufficient stock at the supplying station" }, { status: 400 });
      const sourceBefore = balanceAt(item, sourceId); const destinationBefore = balanceAt(item, request.stationId);
      let next = adjustBalance(item, sourceId, -quantity); next = adjustBalance({ ...item, locationBalances: next }, request.stationId, quantity);
      await base44.asServiceRole.entities.InventoryItem.update(item.id, { locationBalances: next, currentLocationId: request.stationId });
      await movement({ itemId: item.id, movementType: "transfer", quantity, fromLocationId: sourceId, toLocationId: request.stationId, employeeId: request.requesterId, requestId: request.id, sourceBalanceBefore: sourceBefore, sourceBalanceAfter: sourceBefore - quantity, destinationBalanceBefore: destinationBefore, destinationBalanceAfter: destinationBefore + quantity });
      await base44.asServiceRole.entities.MaterialRequest.update(request.id, { status: "issued", issuedAt: new Date().toISOString() });
      return Response.json({ ok: true });
    }

    if (["receive", "return", "transfer"].includes(body.action)) {
      const denied = warehouseGuard(); if (denied && body.action !== "transfer") return denied;
      if (body.action === "transfer") return denyStock("WORKFLOW_RETIRED", 410);
      const item = await getItem(body.itemId); const quantity = Number(body.quantity); const from = String(body.fromLocationId || ""); const to = String(body.toLocationId || "");
      if (!item || !allStationIds.includes(from) || !allStationIds.includes(to) || from === to || !Number.isFinite(quantity) || quantity <= 0) return denyStock("REQUEST_FIELDS_REQUIRED", 400);
      if (from !== auth.stationId) return denyStock("STOCK_REVIEW_OUT_OF_REACH", 403);
      const sourceBefore = balanceAt(item, from); const destinationBefore = balanceAt(item, to);
      if (sourceBefore < quantity) return denyStock("INSUFFICIENT_SOURCE_STOCK", 400);
      let next = adjustBalance(item, from, -quantity); next = adjustBalance({ ...item, locationBalances: next }, to, quantity);
      await base44.asServiceRole.entities.InventoryItem.update(item.id, { locationBalances: next, currentLocationId: to });
      await movement({ itemId: item.id, movementType: body.action, quantity, fromLocationId: from, toLocationId: to, employeeId: body.employeeId || null, requestId: null, sourceBalanceBefore: sourceBefore, sourceBalanceAfter: sourceBefore - quantity, destinationBalanceBefore: destinationBefore, destinationBalanceAfter: destinationBefore + quantity, notes: String(body.notes || "") });
      return Response.json({ ok: true });
    }
    return denyStock("UNKNOWN_ACTION", 400);
  } catch (error) {
    console.error("Inventory error", error);
    const rateLimited = String(error?.message || "").toLowerCase().includes("rate limit");
    return Response.json(
      { error: rateLimited ? "Inventory is busy. Please retry shortly." : error.message },
      { status: rateLimited ? 429 : 500, headers: rateLimited ? { "Retry-After": "1" } : {} },
    );
  }
});