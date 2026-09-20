import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  applyPoToItems,
  checkIssueStockGate,
  checkRaisePoGate,
  checkReceiveStockGate,
  clearOnOrderIfFilled,
  deriveStockAlert,
  enrichStockItem,
  type PurchaseOrderLike,
  type StockItemLike,
} from "../../shared/inventoryDerivations.ts";

/**
 * do-not-invoke-from-frontend — live stock is InventoryItem via inventoryApi (preview-local).
 * Do not write `stockBoard`. Leftover callers should use inventory / inventoryItems.
 */
const STOCK_CATEGORY = "inventoryItems";
const STOCK_LEGACY_CATEGORY = "stockBoard"; // do-not-write

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type StockPayload = {
  items: Array<StockItemLike & { companyId: string }>;
  purchaseOrders: Array<PurchaseOrderLike & { companyId: string }>;
  raisedScopes: Record<string, string>;
};

function emptyPayload(): StockPayload {
  return { items: [], purchaseOrders: [], raisedScopes: {} };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const action = String(body.action || "");
    const companyId = requireCompanyId(body.companyId);
    if (!companyId) {
      return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
    }

    const sessionAuth = await authPowerCareSession(base44, companyId, body.sessionToken);
    if (!sessionAuth) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const auth = {
      companyId,
      userId: sessionAuth.userId || null,
      name: sessionAuth.name || "User",
      role: sessionAuth.role || "employee",
      stationId: sessionAuth.stationId || null,
      owner: !!sessionAuth.owner || sessionAuth.role === "owner" || sessionAuth.admin,
      admin: !!sessionAuth.admin,
    };

    const stockRoles = ["owner", "director", "ops_manager", "station_manager", "inventory_keeper", "pgm", "admin"];
    const canManage = auth.owner || auth.admin || stockRoles.includes(auth.role);

    const loadBlob = async () => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({
        companyId: auth.companyId,
        category: STOCK_LEGACY_CATEGORY,
      });
      return rows[0] || null;
    };

    const loadPayload = async (): Promise<StockPayload> => {
      const blob = await loadBlob();
      const raw = blob?.payload && typeof blob.payload === "object" ? blob.payload : {};
      const base = emptyPayload();
      base.items = (Array.isArray(raw.items) ? raw.items : []).filter(
        (i: StockItemLike & { companyId?: string }) => i && i.companyId === auth.companyId && i.sku,
      );
      base.purchaseOrders = (Array.isArray(raw.purchaseOrders) ? raw.purchaseOrders : []).filter(
        (p: PurchaseOrderLike & { companyId?: string }) => p && p.companyId === auth.companyId && p.id,
      );
      base.raisedScopes = raw.raisedScopes && typeof raw.raisedScopes === "object" ? raw.raisedScopes : {};
      return base;
    };

    const savePayload = async (_payload: StockPayload) => {
      // do-not-write stockBoard. Canonical quantity is InventoryItem — not this blob.
    };

    const audit = async (actionKey: string, details: string, extra: Record<string, unknown> = {}) => {
      await base44.asServiceRole.entities.AuditLog.create({
        companyId: auth.companyId,
        action: actionKey,
        performedBy: auth.name,
        details,
        reason: extra.reason || null,
        oldValue: extra.oldValue || null,
        newValue: extra.newValue || null,
      });
    };

    const scopeKey = String(body.scope || auth.stationId || "all");

    const scopedItems = (items: StockPayload["items"]) => {
      if (scopeKey === "all" || !scopeKey) return items;
      return items.filter((i) => i.stationId === scopeKey);
    };

    const enrich = (data: StockPayload) => {
      const items = scopedItems(data.items).map(enrichStockItem);
      const alert = deriveStockAlert(items);
      return {
        ok: true,
        scope: scopeKey,
        items,
        alert,
        purchaseOrders: data.purchaseOrders.filter((p) => !p.scope || p.scope === scopeKey || scopeKey === "all"),
        poRaised: !!data.raisedScopes[scopeKey],
      };
    };

    if (action === "list") {
      const data = await loadPayload();
      return Response.json(enrich(data));
    }

    if (!canManage) {
      return Response.json({ error: "Forbidden — inventory role required" }, { status: 403 });
    }

    if (action === "upsertItem") {
      const sku = String(body.sku || "").trim().toUpperCase();
      const name = String(body.name || "").trim();
      if (!sku || !name) {
        return Response.json({ error: "SKU_NAME_REQUIRED", reason: "الرمز والاسم مطلوبان." }, { status: 400 });
      }
      const data = await loadPayload();
      const idx = data.items.findIndex((i) => i.sku === sku && (i.stationId || null) === (body.stationId || null));
      const next: StockItemLike & { companyId: string } = {
        companyId: auth.companyId,
        id: idx >= 0 ? data.items[idx].id : uid("sku"),
        sku,
        name,
        stationId: body.stationId || auth.stationId || null,
        onHand: Math.max(0, Number(body.onHand ?? (idx >= 0 ? data.items[idx].onHand : 0)) || 0),
        reorder: Math.max(0, Number(body.reorder ?? (idx >= 0 ? data.items[idx].reorder : 0)) || 0),
        leadDays: Math.max(0, Number(body.leadDays ?? (idx >= 0 ? data.items[idx].leadDays : 7)) || 0),
        onOrder: idx >= 0 ? !!data.items[idx].onOrder : false,
        poId: idx >= 0 ? data.items[idx].poId : null,
      };
      if (idx >= 0) data.items[idx] = clearOnOrderIfFilled(next) as typeof next;
      else data.items.push(next);
      await savePayload(data);
      await audit("stock.upsertItem", `Upserted ${sku}`);
      return Response.json({ ok: true, item: enrichStockItem(next), ...enrich(data) });
    }

    if (action === "issue") {
      const sku = String(body.sku || "").trim().toUpperCase();
      const data = await loadPayload();
      const idx = data.items.findIndex((i) => i.sku === sku && (!body.stationId || i.stationId === body.stationId));
      if (idx < 0) return Response.json({ error: "ITEM_NOT_FOUND" }, { status: 404 });
      const gate = checkIssueStockGate(data.items[idx], body.qty);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, onHand: "onHand" in gate ? gate.onHand : undefined }, { status: 400 });
      }
      data.items[idx] = {
        ...data.items[idx],
        onHand: gate.nextOnHand,
      };
      await savePayload(data);
      await audit("stock.issue", `Issued ${body.qty} of ${sku}`, { newValue: String(gate.nextOnHand) });
      return Response.json({ ok: true, ...enrich(data) });
    }

    if (action === "receive") {
      const sku = String(body.sku || "").trim().toUpperCase();
      const data = await loadPayload();
      const idx = data.items.findIndex((i) => i.sku === sku && (!body.stationId || i.stationId === body.stationId));
      if (idx < 0) return Response.json({ error: "ITEM_NOT_FOUND" }, { status: 404 });
      const gate = checkReceiveStockGate(data.items[idx], body.qty);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      data.items[idx] = clearOnOrderIfFilled({
        ...data.items[idx],
        onHand: gate.nextOnHand,
      }) as typeof data.items[number];
      await savePayload(data);
      await audit("stock.receive", `Received ${body.qty} of ${sku}`);
      return Response.json({ ok: true, ...enrich(data) });
    }

    if (action === "raisePo") {
      const data = await loadPayload();
      const scoped = scopedItems(data.items);
      const gate = checkRaisePoGate(scoped, { alreadyRaised: !!data.raisedScopes[scopeKey] });
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      const po: PurchaseOrderLike & { companyId: string } = {
        companyId: auth.companyId,
        id: uid("po"),
        scope: scopeKey,
        skuKeys: gate.skuKeys,
        maxLeadDays: gate.maxLeadDays,
        raisedAt: new Date().toISOString(),
        raisedBy: auth.name,
        status: "open",
      };
      data.purchaseOrders = [po, ...data.purchaseOrders];
      data.items = applyPoToItems(data.items, po) as typeof data.items;
      data.raisedScopes = { ...data.raisedScopes, [scopeKey]: po.id };
      await savePayload(data);
      await audit("stock.raisePo", `Raised PO ${po.id} covering ${gate.skuKeys.length} SKUs · max lead ${gate.maxLeadDays}d`);
      return Response.json({
        ok: true,
        po,
        lines: gate.lines,
        maxLeadDays: gate.maxLeadDays,
        signingHint: true,
        ...enrich(data),
      });
    }

    if (action === "seedDemo") {
      const data = await loadPayload();
      if (data.items.length) return Response.json({ ok: true, ...enrich(data) });
      const demo: Array<StockItemLike & { companyId: string }> = [
        { companyId: auth.companyId, id: uid("sku"), sku: "SPR-1042", name: "High-pressure valve 4\"", stationId: body.stationId || "jbl2", onHand: 1, reorder: 6, leadDays: 21 },
        { companyId: auth.companyId, id: uid("sku"), sku: "SPR-0871", name: "Industrial air filter — size B", stationId: body.stationId || "ynb", onHand: 3, reorder: 12, leadDays: 14 },
        { companyId: auth.companyId, id: uid("sku"), sku: "CON-0330", name: "Pump lubricant 20L", stationId: body.stationId || "jbl1", onHand: 8, reorder: 10, leadDays: 7 },
        { companyId: auth.companyId, id: uid("sku"), sku: "SPR-0455", name: "PT100 temperature sensor", stationId: body.stationId || "rbg", onHand: 4, reorder: 8, leadDays: 10 },
        { companyId: auth.companyId, id: uid("sku"), sku: "PPE-0120", name: "Class 2 insulating gloves", stationId: body.stationId || "shb", onHand: 42, reorder: 20, leadDays: 5 },
        { companyId: auth.companyId, id: uid("sku"), sku: "SPR-0612", name: "Drive belt B-88", stationId: body.stationId || "dmm", onHand: 11, reorder: 6, leadDays: 9 },
        { companyId: auth.companyId, id: uid("sku"), sku: "SPR-0788", name: "Flexible pressure hose 2\"", stationId: body.stationId || "ynb", onHand: 16, reorder: 8, leadDays: 12 },
      ];
      data.items = demo;
      await savePayload(data);
      await audit("stock.seedDemo", "Seeded design stockboard SKUs");
      return Response.json({ ok: true, ...enrich(data) });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String((err as Error)?.message || err) }, { status: 500 });
  }
});
